/* UI building blocks: tooltips, toasts, modal windows, friendly dialogs, form controls,
 * popovers and a little confetti celebration. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { h, clamp } = GAS;

  let tipEl, toastBox, modalRoot;

  function init() {
    tipEl = h("div", { class: "tooltip", role: "tooltip", hidden: true });
    toastBox = h("div", { class: "toasts", "aria-live": "polite" });
    modalRoot = h("div", { class: "modal-root" });
    document.body.append(tipEl, toastBox, modalRoot);
    setupTooltips();
    setupPressFeedback();
  }

  /* ---------- tooltips ---------- */
  function setupTooltips() {
    let timer = 0, current = null;
    const hide = () => { clearTimeout(timer); tipEl.hidden = true; current = null; };
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const el = e.target.closest("[data-tip]");
      if (el === current) return;
      hide();
      if (!el) return;
      current = el;
      timer = setTimeout(() => {
        if (!document.contains(el)) return;
        tipEl.textContent = el.dataset.tip;
        if (el.dataset.key) tipEl.appendChild(h("kbd", null, el.dataset.key));
        tipEl.hidden = false;
        const r = el.getBoundingClientRect();
        const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
        let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
        if (el.closest(".rail")) { x = r.right + 10; y = r.top + r.height / 2 - th / 2; }
        if (el.closest(".timeline") && !el.closest(".modal")) y = r.top - th - 8;
        if (y + th > innerHeight - 4) y = r.top - th - 8;
        tipEl.style.left = clamp(x, 6, innerWidth - tw - 6) + "px";
        tipEl.style.top = clamp(y, 6, innerHeight - th - 6) + "px";
      }, 380);
    });
    document.addEventListener("pointerdown", hide, true);
    document.addEventListener("pointerout", (e) => { if (current && !current.contains(e.relatedTarget)) hide(); });
    window.addEventListener("blur", hide);
  }

  /* A small bounce on every button press. */
  function setupPressFeedback() {
    document.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      b.classList.remove("is-pressed");
      void b.offsetWidth;
      b.classList.add("is-pressed");
      setTimeout(() => b.classList.remove("is-pressed"), 260);
    });
  }

  /* ---------- toasts ---------- */
  let lastQuick = null;
  function toast(text, opts = {}) {
    if (!toastBox) return;
    if (opts.quick && lastQuick && lastQuick.isConnected) lastQuick.remove();
    const el = h("div", { class: "toast" + (opts.kind ? " is-" + opts.kind : "") },
      opts.color ? h("span", { class: "toast-swatch", style: { background: opts.color } }) : null,
      h("span", null, text));
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    if (opts.quick) lastQuick = el;
    setTimeout(() => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 300); }, opts.duration || (opts.quick ? 1300 : 3200));
  }

  /* ---------- modals ---------- */
  const openModals = [];
  function modal({ title, icon, body, actions = [], wide, className, onClose, dismissable = true }) {
    const I = GAS.icons.svg;
    const close = () => {
      if (!overlay.isConnected) return;
      overlay.classList.add("is-leaving");
      setTimeout(() => overlay.remove(), 180);
      const i = openModals.indexOf(api);
      if (i >= 0) openModals.splice(i, 1);
      if (onClose) onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    };
    const footer = h("div", { class: "modal-actions" });
    const setActions = (list) => {
      footer.innerHTML = "";
      for (const a of list) {
        const b = h("button", { class: "btn " + (a.kind ? "btn-" + a.kind : ""), type: "button", disabled: a.disabled },
          a.icon ? I(a.icon) : null, h("span", null, a.label));
        b.addEventListener("click", async () => {
          const r = a.onClick ? await a.onClick() : true;
          if (r !== false) close();
        });
        footer.appendChild(b);
      }
      footer.hidden = !list.length;
    };
    setActions(actions);
    const closeBtn = dismissable ? h("button", { class: "icon-btn modal-close", type: "button", "aria-label": "Close", tip: "Close", onclick: () => { if (api.beforeClose && api.beforeClose() === false) return; close(); } }, I("close")) : null;
    const dialog = h("div", { class: "modal" + (wide ? " is-wide" : "") + (className ? " " + className : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "modal-head" }, icon ? h("span", { class: "modal-icon" }, I(icon)) : null, h("h2", null, title), closeBtn),
      h("div", { class: "modal-body" }, body),
      footer);
    const overlay = h("div", { class: "modal-overlay" }, dialog);
    if (dismissable) overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) { overlay._downOnBg = true; } });
    if (dismissable) overlay.addEventListener("click", (e) => { if (e.target === overlay && overlay._downOnBg) close(); overlay._downOnBg = false; });
    const prevFocus = document.activeElement;
    modalRoot.appendChild(overlay);
    const api = { el: dialog, overlay, close, setActions, dismissable, beforeClose: null };
    openModals.push(api);
    requestAnimationFrame(() => {
      const f = dialog.querySelector("[autofocus], input, textarea, .btn-primary");
      if (f) f.focus({ preventScroll: true });
    });
    return api;
  }
  const topModal = () => openModals[openModals.length - 1] || null;
  function closeTopModal() {
    const m = topModal();
    if (m && m.dismissable) { if (m.beforeClose && m.beforeClose() === false) return true; m.close(); return true; }
    return !!m;
  }

  function alert({ title, text, icon = "help", ok = "OK" }) {
    return new Promise((resolve) => {
      modal({ title, icon, body: h("p", { class: "dialog-text" }, text), actions: [{ label: ok, kind: "primary", onClick: () => resolve() }], onClose: () => resolve() });
    });
  }
  function confirm({ title, text, ok = "Yes", cancel = "No, keep it", danger, icon = "help" }) {
    return new Promise((resolve) => {
      let answered = false;
      modal({
        title, icon, body: h("p", { class: "dialog-text" }, text),
        actions: [
          { label: cancel, kind: "ghost", onClick: () => { answered = true; resolve(false); } },
          { label: ok, kind: danger ? "danger" : "primary", onClick: () => { answered = true; resolve(true); } },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
    });
  }
  function prompt({ title, label, value = "", ok = "OK", icon = "rename" }) {
    return new Promise((resolve) => {
      let answered = false;
      const input = h("input", { class: "text-input", type: "text", value, maxlength: 60, autofocus: true });
      const m = modal({
        title, icon,
        body: h("label", { class: "field" }, h("span", { class: "field-label" }, label), input),
        actions: [
          { label: "Cancel", kind: "ghost", onClick: () => { answered = true; resolve(null); } },
          { label: ok, kind: "primary", onClick: () => { answered = true; resolve(input.value.trim() || value); } },
        ],
        onClose: () => { if (!answered) resolve(null); },
      });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { answered = true; resolve(input.value.trim() || value); m.close(); } });
      setTimeout(() => input.select(), 50);
    });
  }
  function busy(text) {
    const lbl = h("p", { class: "dialog-text busy-text" }, h("span", { class: "spinner" }), h("span", null, text));
    const m = modal({ title: "Just a moment…", icon: "clock", body: lbl, actions: [], dismissable: false });
    return { close: m.close, set: (t) => { lbl.lastChild.textContent = t; } };
  }

  /* ---------- form controls ---------- */
  function select(options, value, onChange) {
    const s = h("select", { class: "select" }, options.map((o) => h("option", { value: o.value, selected: String(o.value) === String(value) }, o.label)));
    s.addEventListener("change", () => onChange(s.value));
    return s;
  }
  function toggle(label, checked, onChange, disabled) {
    const input = h("input", { type: "checkbox", checked: !!checked, disabled: !!disabled });
    input.addEventListener("change", () => onChange(input.checked));
    return h("label", { class: "toggle" + (disabled ? " is-disabled" : "") }, input, h("span", { class: "toggle-track" }, h("span", { class: "toggle-thumb" })), h("span", { class: "toggle-label" }, label));
  }
  /* Slider with a label and value readout. */
  function slider({ label, min, max, step = 1, value, format, onInput, onChange, tip }) {
    const out = h("output", { class: "slider-value" });
    const input = h("input", { type: "range", min, max, step, value, "aria-label": label });
    const show = () => { out.textContent = format ? format(+input.value) : input.value; input.style.setProperty("--p", ((input.value - min) / (max - min)) * 100 + "%"); };
    input.addEventListener("input", () => { show(); onInput && onInput(+input.value); });
    input.addEventListener("change", () => onChange && onChange(+input.value));
    show();
    const el = h("label", { class: "slider", tip }, h("span", { class: "slider-head" }, h("span", { class: "slider-label" }, label), out), input);
    el.setValue = (v) => { input.value = v; show(); };
    return el;
  }
  /* Row of buttons where one is chosen. options: [{value, label, icon, tip}] */
  function segmented(options, value, onChange, cls) {
    const I = GAS.icons.svg;
    const wrap = h("div", { class: "segmented " + (cls || ""), role: "group" });
    const btns = options.map((o) => {
      const b = h("button", { class: "seg-btn", type: "button", tip: o.tip, "aria-label": o.tip || o.label, dataset: { value: String(o.value) } },
        o.icon ? I(o.icon) : null, o.swatch ? h("span", { class: "seg-swatch", style: { background: o.swatch } }) : null, o.label ? h("span", null, o.label) : null);
      b.addEventListener("click", () => { set(o.value); onChange(o.value); });
      wrap.appendChild(b);
      return b;
    });
    const set = (v) => btns.forEach((b) => { const on = b.dataset.value === String(v); b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
    set(value);
    wrap.setValue = set;
    return wrap;
  }
  function colorInput(value, onChange, tip) {
    const i = h("input", { type: "color", class: "color-input", value, tip });
    i.addEventListener("input", () => onChange(i.value, true));
    i.addEventListener("change", () => onChange(i.value, false));
    return i;
  }

  /* ---------- popovers ---------- */
  let openPop = null;
  function popover(anchor, content, opts = {}) {
    closePopover();
    const el = h("div", { class: "popover " + (opts.className || "") }, content);
    document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth, hh = el.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
    if (opts.above || y + hh > innerHeight - 8) y = r.top - hh - 8;
    el.style.left = clamp(x, 8, innerWidth - w - 8) + "px";
    el.style.top = clamp(y, 8, innerHeight - hh - 8) + "px";
    const onDown = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
    setTimeout(() => document.addEventListener("pointerdown", onDown, true), 0);
    openPop = { el, onDown, anchor };
    anchor.classList.add("is-open");
    return { el, close: closePopover };
  }
  function closePopover() {
    if (!openPop) return false;
    document.removeEventListener("pointerdown", openPop.onDown, true);
    openPop.anchor.classList.remove("is-open");
    openPop.el.remove();
    openPop = null;
    return true;
  }
  /* Simple menu popover. items: [{label, icon, key, onClick, danger}] or "-" */
  function menu(anchor, items, opts) {
    const I = GAS.icons.svg;
    const list = h("div", { class: "menu", role: "menu" }, items.map((it) => {
      if (it === "-") return h("hr", { class: "menu-sep" });
      const b = h("button", { class: "menu-item" + (it.danger ? " is-danger" : ""), type: "button", role: "menuitem", disabled: it.disabled },
        it.icon ? I(it.icon) : null, h("span", null, it.label), it.key ? h("kbd", null, it.key) : null);
      b.addEventListener("click", () => { closePopover(); it.onClick(); });
      return b;
    }));
    return popover(anchor, list, opts);
  }

  /* ---------- celebration ---------- */
  function celebrate() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = h("canvas", { class: "confetti" });
    document.body.appendChild(c);
    const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    const colors = ["#ef476f", "#ffd23f", "#06d6a0", "#118ab2", "#9b5de5", "#f15bb5", "#ff9f1c"];
    const bits = Array.from({ length: 120 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 4,
      a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)], s: Math.random() < 0.5,
    }));
    let t = 0;
    const step = () => {
      t++;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const b of bits) {
        b.vy += 0.42; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.va;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c;
        if (b.s) ctx.fillRect(-b.r / 2, -b.r / 4, b.r, b.r / 2);
        else { ctx.beginPath(); ctx.arc(0, 0, b.r / 2.4, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      }
      if (t < 130) requestAnimationFrame(step);
      else c.remove();
    };
    requestAnimationFrame(step);
  }

  GAS.ui = {
    init, toast, modal, topModal, closeTopModal, alert, confirm, prompt, busy,
    select, toggle, slider, segmented, colorInput, popover, closePopover, menu, celebrate,
    get modalOpen() { return openModals.length > 0; },
  };
})();
