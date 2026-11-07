/* UI toolkit: toasts, dialogs, menus, tooltips, color picker and form controls. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, $, clear, bus, clamp, normalizeHex, prefs } = CBS;

  /* ---------- toasts ---------- */
  let toastBox = null;
  function toast(msg, opts = {}) {
    if (!toastBox) { toastBox = h("div", { class: "toasts", role: "status", "aria-live": "polite" }); document.body.append(toastBox); }
    const t = h("div", { class: "toast " + (opts.kind || "info") }, msg);
    if (opts.action) t.append(h("button", { class: "toast-btn", onclick: () => { opts.action.fn(); t.remove(); } }, opts.action.label));
    toastBox.append(t);
    while (toastBox.children.length > 4) toastBox.firstChild.remove();
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, opts.ms || (opts.kind === "error" ? 5000 : 2600));
  }

  /* ---------- dialogs ---------- */
  const openDialogs = [];
  function dialog(o) {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    const close = (value) => {
      if (!wrap.isConnected) return;
      wrap.classList.add("closing");
      setTimeout(() => wrap.remove(), 160);
      openDialogs.splice(openDialogs.indexOf(api), 1);
      document.removeEventListener("keydown", onKey, true);
      if (o.onClose) o.onClose(value);
      resolve(value);
      if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* ignore */ }
    };
    const lastFocus = document.activeElement;
    const footer = o.buttons && o.buttons.length
      ? h("div", { class: "dlg-foot" }, o.footLeft || null, h("div", { class: "spacer" }), o.buttons.map((b) => h("button", {
        class: "btn " + (b.kind || ""), disabled: b.disabled,
        onclick: async () => {
          if (b.onClick) { const r = await b.onClick(api); if (r === false) return; }
          close(b.value);
        },
      }, b.label)))
      : null;
    const box = h("div", { class: "dlg " + (o.wide ? "wide " : "") + (o.className || ""), role: "dialog", "aria-modal": "true", "aria-label": o.title || "Dialog" },
      h("div", { class: "dlg-head" }, h("h2", null, o.title || ""), o.noClose ? null : h("button", { class: "icon-btn dlg-x", "aria-label": "Close", onclick: () => close(undefined) }, "✕")),
      h("div", { class: "dlg-body" }, o.body),
      footer);
    const wrap = h("div", { class: "dlg-wrap", onmousedown: (e) => { if (e.target === wrap && !o.modal) close(undefined); } }, box);
    const onKey = (e) => {
      if (openDialogs[openDialogs.length - 1] !== api) return;
      if (e.key === "Escape" && !o.noClose) { e.preventDefault(); e.stopPropagation(); close(undefined); }
      else if (e.key === "Enter" && o.enterValue !== undefined && !(e.target && e.target.tagName === "TEXTAREA")) { e.preventDefault(); close(o.enterValue); }
    };
    document.addEventListener("keydown", onKey, true);
    document.body.append(wrap);
    const api = { el: box, wrap, close, promise };
    openDialogs.push(api);
    requestAnimationFrame(() => {
      const f = box.querySelector("[autofocus]") || box.querySelector("input, select, textarea, .btn.primary");
      if (f) f.focus();
    });
    return api;
  }
  const anyDialogOpen = () => openDialogs.length > 0;

  function confirm(message, o = {}) {
    return dialog({
      title: o.title || "Are you sure?", body: h("p", { class: "dlg-msg" }, message), enterValue: true,
      buttons: [{ label: o.cancel || "Cancel", value: false }, { label: o.ok || "OK", kind: o.danger ? "danger" : "primary", value: true }],
    }).promise.then((v) => !!v);
  }
  function prompt(message, value = "", o = {}) {
    const input = h("input", { type: "text", class: "input", value, autofocus: true, maxlength: o.maxLength || 120 });
    const d = dialog({
      title: o.title || "Enter a value", body: h("div", null, message ? h("p", { class: "dlg-msg" }, message) : null, input),
      buttons: [{ label: "Cancel", value: null }, { label: o.ok || "OK", kind: "primary", onClick: () => { d.result = input.value; } , value: "__ok" }],
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); d.result = input.value; d.close("__ok"); } });
    requestAnimationFrame(() => input.select());
    return d.promise.then((v) => (v === "__ok" ? d.result : null));
  }
  function alert(message, o = {}) {
    return dialog({ title: o.title || "Note", body: h("p", { class: "dlg-msg" }, message), enterValue: true, buttons: [{ label: "OK", kind: "primary", value: true }] }).promise;
  }

  /* ---------- menus ---------- */
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener("pointerdown", outside, true); } }
  function outside(e) { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }
  function buildMenu(items) {
    const m = h("div", { class: "menu", role: "menu" });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { m.append(h("div", { class: "menu-sep" })); continue; }
      if (it.header) { m.append(h("div", { class: "menu-head" }, it.header)); continue; }
      const row = h("button", {
        class: "menu-item" + (it.checked ? " checked" : "") + (it.danger ? " danger" : ""), role: "menuitem", disabled: it.disabled,
        onclick: (e) => {
          if (it.submenu) { e.stopPropagation(); return; }
          closeMenu();
          if (it.action) it.action();
        },
      },
      h("span", { class: "mi-icon" }, it.checked ? "✓" : it.icon || ""),
      h("span", { class: "mi-label" }, it.label),
      it.shortcut ? h("span", { class: "mi-key" }, it.shortcut) : null,
      it.submenu ? h("span", { class: "mi-key" }, "▸") : null);
      if (it.submenu) {
        const sub = buildMenu(it.submenu);
        sub.classList.add("submenu");
        row.append(sub);
        row.addEventListener("click", () => row.classList.toggle("open"));
      }
      m.append(row);
    }
    return m;
  }
  function menu(items, at) {
    closeMenu();
    const m = buildMenu(items);
    document.body.append(m);
    let x, y;
    if (at && at.getBoundingClientRect) { const r = at.getBoundingClientRect(); x = r.left; y = r.bottom + 4; }
    else { x = at.x; y = at.y; }
    const r = m.getBoundingClientRect();
    m.style.left = clamp(x, 4, innerWidth - r.width - 4) + "px";
    m.style.top = (y + r.height > innerHeight - 4 ? Math.max(4, y - r.height - (at.getBoundingClientRect ? 40 : 0)) : y) + "px";
    openMenu = m;
    setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
    return m;
  }

  /* ---------- tooltips ---------- */
  let tipEl = null, tipTimer = 0, tipFor = null;
  function initTooltips() {
    tipEl = h("div", { class: "tooltip", role: "tooltip" });
    document.body.append(tipEl);
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (t === tipFor) return;
      tipFor = t;
      clearTimeout(tipTimer);
      tipEl.classList.remove("show");
      if (!t || e.pointerType === "touch" || prefs.get("tooltips", true) === false) return;
      tipTimer = setTimeout(() => {
        if (!t.isConnected) return;
        tipEl.textContent = t.getAttribute("data-tip");
        const r = t.getBoundingClientRect();
        tipEl.classList.add("show");
        const tr = tipEl.getBoundingClientRect();
        let x = r.left + r.width / 2 - tr.width / 2, y = r.bottom + 8;
        if (t.closest(".toolbox")) { x = r.right + 10; y = r.top + r.height / 2 - tr.height / 2; }
        if (y + tr.height > innerHeight - 4) y = r.top - tr.height - 8;
        tipEl.style.left = clamp(x, 4, innerWidth - tr.width - 4) + "px";
        tipEl.style.top = clamp(y, 4, innerHeight - tr.height - 4) + "px";
      }, 450);
    });
    document.addEventListener("pointerdown", () => { clearTimeout(tipTimer); tipEl.classList.remove("show"); }, true);
  }

  /* ---------- colors ---------- */
  const PALETTE = [
    "#000000", "#1f2937", "#6b7280", "#d1d5db", "#ffffff", "#7c2d12",
    "#e63946", "#f97316", "#facc15", "#fde68a", "#a3e635", "#16a34a",
    "#14b8a6", "#22d3ee", "#3b82f6", "#1e3a8a", "#8b5cf6", "#ec4899",
    "#f9d4b4", "#f1c27d", "#c68642", "#8d5524", "#5c3a21", "#fff3a8",
  ];
  const colors = {
    primary: prefs.get("primaryColor", "#111111"),
    secondary: prefs.get("secondaryColor", "#ffd43b"),
    recent: prefs.get("recentColors", []),
    set(which, hex) {
      hex = normalizeHex(hex) || hex;
      this[which] = hex;
      prefs.set(which + "Color", hex);
      this.addRecent(hex);
      bus.emit("colors:changed");
    },
    swap() { const p = this.primary; this.primary = this.secondary; this.secondary = p; prefs.set("primaryColor", this.primary); prefs.set("secondaryColor", this.secondary); bus.emit("colors:changed"); },
    addRecent(hex) {
      if (!normalizeHex(hex)) return;
      this.recent = [hex, ...this.recent.filter((c) => c !== hex)].slice(0, 12);
      prefs.set("recentColors", this.recent);
    },
  };

  let colorPop = null;
  function closeColorPop() { if (colorPop) { colorPop.remove(); colorPop = null; document.removeEventListener("pointerdown", outsideColor, true); } }
  function outsideColor(e) { if (colorPop && !colorPop.contains(e.target) && !(colorPop._anchor && colorPop._anchor.contains(e.target))) closeColorPop(); }
  /* Open the color popover. onPick(hex, final) is called live; final=true when the user is done. */
  function colorPopover(anchor, value, onPick, o = {}) {
    closeColorPop();
    const hexInput = h("input", { class: "input hex", value: value && value !== "transparent" ? value : "", maxlength: 7, spellcheck: "false", "aria-label": "Hex color" });
    const native = h("input", { type: "color", class: "native-color", value: normalizeHex(value) || "#000000", "aria-label": "Custom color" });
    const pick = (c, final = true) => {
      onPick(c, final);
      if (normalizeHex(c)) { hexInput.value = c; native.value = c; }
      if (final && normalizeHex(c)) colors.addRecent(c);
      pop.querySelectorAll(".sw").forEach((s) => s.classList.toggle("on", s.dataset.c === c));
    };
    const sw = (c) => h("button", { class: "sw" + (c === value ? " on" : ""), "data-c": c, style: { background: c }, "aria-label": c, tip: c, onclick: () => { pick(c); if (o.closeOnPick) closeColorPop(); } });
    native.addEventListener("input", () => pick(native.value, false));
    native.addEventListener("change", () => pick(native.value, true));
    hexInput.addEventListener("change", () => { const c = normalizeHex(hexInput.value); if (c) pick(c); else hexInput.value = value; });
    const eyedrop = window.EyeDropper ? h("button", {
      class: "btn sm", tip: "Pick a color from anywhere on screen",
      onclick: async () => { try { const r = await new window.EyeDropper().open(); pick(normalizeHex(r.sRGBHex) || r.sRGBHex); } catch (e) { /* cancelled */ } },
    }, "💧 Pick") : null;
    const pop = h("div", { class: "color-pop" },
      o.title ? h("div", { class: "cp-title" }, o.title) : null,
      h("div", { class: "cp-grid" }, PALETTE.map(sw)),
      colors.recent.length ? h("div", { class: "cp-label" }, "Recent") : null,
      colors.recent.length ? h("div", { class: "cp-grid recent" }, colors.recent.map(sw)) : null,
      h("div", { class: "cp-row" }, native, hexInput, eyedrop,
        o.allowNone ? h("button", { class: "btn sm", onclick: () => { onPick("transparent", true); closeColorPop(); } }, "None") : null));
    pop._anchor = anchor;
    document.body.append(pop);
    const r = anchor.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    let x = r.left, y = r.bottom + 6;
    if (x + pr.width > innerWidth - 6) x = innerWidth - pr.width - 6;
    if (y + pr.height > innerHeight - 6) y = Math.max(6, r.top - pr.height - 6);
    pop.style.left = Math.max(6, x) + "px";
    pop.style.top = y + "px";
    colorPop = pop;
    setTimeout(() => document.addEventListener("pointerdown", outsideColor, true), 0);
    return pop;
  }

  /* ---------- form controls ---------- */
  function field(label, control, o = {}) {
    return h("label", { class: "field" + (o.inline ? " inline" : "") + (o.className ? " " + o.className : ""), tip: o.tip },
      h("span", { class: "f-label" }, label), control);
  }
  function row(...children) { return h("div", { class: "frow" }, ...children); }
  function section(title, ...children) {
    return h("div", { class: "psec" }, title ? h("div", { class: "psec-title" }, title) : null, ...children);
  }

  /* Slider + number box. onInput(v) fires live; onCommit(v) fires when the user lets go. */
  function slider(o) {
    const fmt = o.format || ((v) => String(Math.round(v * 100) / 100));
    const range = h("input", { type: "range", class: "range", min: o.min, max: o.max, step: o.step || 1, value: o.value, "aria-label": o.label });
    const num = h("input", { type: "number", class: "input num", min: o.min, max: o.max, step: o.step || 1, value: fmt(o.value), "aria-label": o.label });
    let live = false;
    range.addEventListener("input", () => { const v = parseFloat(range.value); num.value = fmt(v); if (!live) { live = true; o.onStart && o.onStart(); } o.onInput && o.onInput(v); });
    range.addEventListener("change", () => { live = false; o.onCommit && o.onCommit(parseFloat(range.value)); });
    num.addEventListener("change", () => {
      let v = parseFloat(num.value);
      if (isNaN(v)) { num.value = fmt(parseFloat(range.value)); return; }
      v = clamp(v, o.hardMin != null ? o.hardMin : o.min, o.hardMax != null ? o.hardMax : o.max);
      range.value = v; num.value = fmt(v);
      o.onStart && o.onStart();
      o.onInput && o.onInput(v);
      o.onCommit && o.onCommit(v);
    });
    const el = h("div", { class: "slider" + (o.className ? " " + o.className : "") }, o.label ? h("span", { class: "f-label" }, o.label) : null, range, num, o.unit ? h("span", { class: "unit" }, o.unit) : null);
    el.setValue = (v) => { range.value = v; num.value = fmt(v); };
    if (o.tip) el.setAttribute("data-tip", o.tip);
    return el;
  }

  function numberInput(o) {
    const input = h("input", { type: "number", class: "input num", value: o.value, step: o.step || 1, min: o.min, max: o.max, "aria-label": o.label });
    input.addEventListener("change", () => { const v = parseFloat(input.value); if (!isNaN(v)) o.onChange(v); else input.value = o.value; });
    return o.label ? h("label", { class: "numbox" }, h("span", null, o.label), input) : input;
  }

  function select(options, value, onChange, o = {}) {
    const s = h("select", { class: "input select", "aria-label": o.label || "Choose" });
    const add = (v, l, parent) => parent.append(h("option", { value: v, selected: String(v) === String(value) }, l));
    if (Array.isArray(options)) {
      for (const opt of options) {
        if (opt && opt.group) {
          const g = h("optgroup", { label: opt.group });
          for (const [v, l] of opt.items) add(v, l, g);
          s.append(g);
        } else add(opt[0], opt[1], s);
      }
    } else for (const [v, l] of Object.entries(options)) add(v, l, s);
    s.addEventListener("change", () => onChange(s.value));
    if (o.style) Object.assign(s.style, o.style);
    return s;
  }

  function toggle(label, checked, onChange, o = {}) {
    const input = h("input", { type: "checkbox", checked });
    input.addEventListener("change", () => onChange(input.checked));
    return h("label", { class: "toggle", tip: o.tip }, input, h("span", { class: "tg-track" }, h("span", { class: "tg-dot" })), h("span", { class: "tg-label" }, label));
  }

  function segmented(options, value, onChange, o = {}) {
    const el = h("div", { class: "seg" + (o.small ? " sm" : ""), role: "radiogroup", "aria-label": o.label || "" });
    const entries = Array.isArray(options) ? options : Object.entries(options);
    for (const [v, l, tip] of entries) {
      el.append(h("button", {
        class: "seg-btn" + (String(v) === String(value) ? " on" : ""), role: "radio", "aria-checked": String(String(v) === String(value)), tip,
        onclick: () => { el.querySelectorAll(".seg-btn").forEach((b) => { b.classList.remove("on"); b.setAttribute("aria-checked", "false"); }); const b = el.querySelector(`[data-v="${CSS.escape(String(v))}"]`); if (b) { b.classList.add("on"); b.setAttribute("aria-checked", "true"); } onChange(v); },
        "data-v": v,
      }, l));
    }
    return el;
  }

  function colorButton(value, onChange, o = {}) {
    const b = h("button", { class: "color-btn" + (o.big ? " big" : ""), "aria-label": o.label || "Color", tip: o.tip || o.label });
    const paint = (v) => {
      b.style.setProperty("--c", v && v !== "transparent" ? v : "transparent");
      b.classList.toggle("none", !v || v === "transparent");
    };
    paint(value);
    let started = false;
    b.addEventListener("click", () => {
      colorPopover(b, value, (c, final) => {
        if (!started) { started = true; o.onStart && o.onStart(); }
        value = c;
        paint(c);
        onChange(c, final);
        if (final) started = false;
      }, { allowNone: o.allowNone, title: o.label });
    });
    b.setValue = (v) => { value = v; paint(v); };
    return b;
  }

  function button(label, onClick, o = {}) {
    return h("button", { class: "btn " + (o.kind || "") + (o.small ? " sm" : ""), onclick: onClick, tip: o.tip, disabled: o.disabled }, o.icon ? h("span", { class: "b-ico" }, o.icon) : null, label);
  }

  function textarea(value, onInput, o = {}) {
    const t = h("textarea", { class: "input textarea", rows: o.rows || 3, placeholder: o.placeholder || "", "aria-label": o.label || "Text" });
    t.value = value || "";
    let started = false;
    t.addEventListener("input", () => { if (!started) { started = true; o.onStart && o.onStart(); } onInput(t.value); });
    t.addEventListener("change", () => { started = false; o.onCommit && o.onCommit(t.value); });
    t.addEventListener("blur", () => { if (started) { started = false; o.onCommit && o.onCommit(t.value); } });
    return t;
  }

  /* Busy overlay for long jobs (export, open). */
  function busy(message) {
    const bar = h("div", { class: "busy-bar" }, h("div", { class: "busy-fill" }));
    const label = h("div", { class: "busy-label" }, message);
    const el = h("div", { class: "busy" }, h("div", { class: "busy-box" }, h("div", { class: "spinner" }), label, bar));
    document.body.append(el);
    return {
      set(msg, frac) { if (msg) label.textContent = msg; if (frac != null) bar.firstChild.style.width = Math.round(clamp(frac, 0, 1) * 100) + "%"; },
      done() { el.remove(); },
    };
  }

  CBS.ui = {
    toast, dialog, confirm, prompt, alert, anyDialogOpen, menu, closeMenu, initTooltips,
    PALETTE, colorPopover, closeColorPop, field, row, section, slider, numberInput, select, toggle, segmented, colorButton, button, textarea, busy,
  };
  CBS.colors = colors;
  void $; void clear;
})();
