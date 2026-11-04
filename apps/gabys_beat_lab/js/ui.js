/* UIManager basics: settings, tooltips, toasts, dialogs, menus, knobs, faders, confetti, UI sounds. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clamp, bus, store, drag } = GBL;

  /* ---------- settings ---------- */
  const DEFAULTS = { autosave: true, uiSounds: true, beginner: false, helpMusic: false, tooltips: true, visualTheme: "bars" };
  const settings = {
    data: Object.assign({}, DEFAULTS, store.get("settings", {})),
    get(k) { return this.data[k]; },
    set(k, v) { this.data[k] = v; store.set("settings", this.data); bus.emit("settings", k, v); },
  };
  GBL.settings = settings;

  /* ---------- tooltips ---------- */
  const tipEl = h("div", { class: "tooltip", role: "tooltip" });
  let tipTimer = 0, tipTarget = null;
  function showTip(el) {
    const text = el.getAttribute("data-tip");
    if (!text || !settings.get("tooltips")) return;
    tipEl.textContent = text;
    tipEl.classList.add("show");
    const r = el.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
    if (y + th > window.innerHeight - 4) y = r.top - th - 8;
    x = clamp(x, 6, window.innerWidth - tw - 6);
    tipEl.style.left = x + "px";
    tipEl.style.top = y + "px";
  }
  function hideTip() { clearTimeout(tipTimer); tipEl.classList.remove("show"); tipTarget = null; }
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (el === tipTarget) return;
    hideTip();
    if (!el) return;
    tipTarget = el;
    tipTimer = setTimeout(() => showTip(el), settings.get("beginner") ? 250 : 550);
  });
  document.addEventListener("pointerdown", hideTip, true);
  document.addEventListener("scroll", hideTip, true);

  /* ---------- toasts ---------- */
  const toastBox = h("div", { class: "toasts", "aria-live": "polite" });
  function toast(msg, ms = 2600) {
    const t = h("div", { class: "toast" }, msg);
    toastBox.append(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
  }
  bus.on("toast", (m) => toast(m));

  /* ---------- modal dialogs ---------- */
  const stack = [];
  function modal({ title, icon, body, actions, wide, full, onClose, cls, closeLabel }) {
    const prevFocus = document.activeElement;
    const closeBtn = h("button", { class: "icon-btn close-btn", "aria-label": "Close", tip: "Close (Esc)" }, "✕");
    const dlg = h("div", { class: "modal" + (wide ? " wide" : "") + (full ? " full" : "") + (cls ? " " + cls : ""), role: "dialog", "aria-modal": "true", "aria-label": title || "Dialog" },
      h("div", { class: "modal-head" }, icon ? h("span", { class: "modal-icon" }, icon) : null, h("h2", {}, title || ""), closeBtn),
      h("div", { class: "modal-body" }, body),
      actions && actions.length ? h("div", { class: "modal-actions" }, actions) : null);
    const back = h("div", { class: "modal-back" }, dlg);
    let closed = false;
    const api = {
      el: dlg, back,
      close(result) {
        if (closed) return;
        closed = true;
        back.classList.remove("show");
        setTimeout(() => back.remove(), 180);
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        onClose && onClose(result);
        if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* */ }
      },
    };
    closeBtn.onclick = () => api.close();
    back.addEventListener("pointerdown", (e) => { if (e.target === back && !full) api.close(); });
    document.body.append(back);
    requestAnimationFrame(() => back.classList.add("show"));
    stack.push(api);
    setTimeout(() => { const f = dlg.querySelector("input,select,textarea,button.primary"); if (f) f.focus(); }, 30);
    return api;
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stack.length) { e.preventDefault(); e.stopPropagation(); stack[stack.length - 1].close(); }
  }, true);
  const anyModal = () => stack.length > 0;

  function confirm(title, msg, ok = "OK", cancel = "Cancel") {
    return new Promise((res) => {
      let v = false;
      const okB = h("button", { class: "btn primary" }, ok);
      const noB = h("button", { class: "btn" }, cancel);
      const m = modal({ title, icon: "❓", body: h("p", { class: "modal-text" }, msg), actions: [noB, okB], onClose: () => res(v) });
      okB.onclick = () => { v = true; m.close(); };
      noB.onclick = () => m.close();
    });
  }
  function alert(title, msg) {
    return new Promise((res) => {
      const okB = h("button", { class: "btn primary" }, "OK");
      const m = modal({ title, icon: "ℹ️", body: h("p", { class: "modal-text" }, msg), actions: [okB], onClose: res });
      okB.onclick = () => m.close();
    });
  }
  function prompt(title, value, ok = "OK") {
    return new Promise((res) => {
      let v = null;
      const input = h("input", { type: "text", value: value || "", maxlength: 80, class: "wide-input" });
      const okB = h("button", { class: "btn primary" }, ok);
      const noB = h("button", { class: "btn" }, "Cancel");
      const m = modal({ title, icon: "✏️", body: input, actions: [noB, okB], onClose: () => res(v) });
      const done = () => { v = input.value; m.close(); };
      okB.onclick = done;
      noB.onclick = () => m.close();
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") done(); });
      setTimeout(() => input.select(), 40);
    });
  }
  function form(title, fields, ok = "OK") {
    return new Promise((res) => {
      let v = null;
      const inputs = {};
      const rows = fields.map((f) => {
        let el;
        if (f.type === "choice") el = h("select", {}, f.options.map(([val, label]) => h("option", { value: val, selected: val === f.value }, label)));
        else el = h("input", { type: f.type || "text", value: f.value == null ? "" : f.value, min: f.min, max: f.max, step: f.step });
        inputs[f.id] = el;
        return h("label", { class: "form-row" }, h("span", {}, f.label), el);
      });
      const okB = h("button", { class: "btn primary" }, ok);
      const noB = h("button", { class: "btn" }, "Cancel");
      const m = modal({ title, icon: "💾", body: h("div", { class: "export-form" }, rows), actions: [noB, okB], onClose: () => res(v) });
      okB.onclick = () => { v = {}; for (const f of fields) v[f.id] = f.type === "number" ? +inputs[f.id].value : inputs[f.id].value; m.close(); };
      noB.onclick = () => m.close();
    });
  }

  /* ---------- popover menus ---------- */
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
  function menu(anchor, items, opts = {}) {
    closeMenu();
    const el = h("div", { class: "menu", role: "menu" });
    for (const it of items) {
      if (!it) continue;
      if (it.sep) { el.append(h("div", { class: "menu-sep" })); continue; }
      if (it.header) { el.append(h("div", { class: "menu-header" }, it.header)); continue; }
      const b = h("button", { class: "menu-item" + (it.checked ? " checked" : "") + (it.adv ? " adv" : ""), role: "menuitem", disabled: it.disabled, tip: it.tip },
        h("span", { class: "menu-icon" }, it.icon || (it.checked ? "✔" : "")), h("span", { class: "menu-label" }, it.label), it.kbd ? h("kbd", {}, it.kbd) : null);
      b.onclick = (e) => { e.stopPropagation(); closeMenu(); it.onClick && it.onClick(); };
      el.append(b);
    }
    document.body.append(el);
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
    const mw = el.offsetWidth, mh = el.offsetHeight;
    let x = opts.alignRight ? r.right - mw : r.left, y = r.bottom + 4;
    if (y + mh > window.innerHeight - 6) y = Math.max(6, r.top - mh - 4);
    x = clamp(x, 6, window.innerWidth - mw - 6);
    el.style.left = x + "px";
    el.style.top = y + "px";
    openMenu = el;
    const f = el.querySelector(".menu-item:not([disabled])");
    if (f) f.focus();
    el.addEventListener("keydown", (e) => {
      const list = [...el.querySelectorAll(".menu-item:not([disabled])")];
      const i = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); (list[i + 1] || list[0]).focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (list[i - 1] || list[list.length - 1]).focus(); }
      if (e.key === "Escape") { e.stopPropagation(); closeMenu(); }
    });
    return el;
  }
  document.addEventListener("pointerdown", (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openMenu) { e.stopPropagation(); closeMenu(); } }, true);

  /* ---------- knob ---------- */
  function knob(o) {
    const min = o.min, max = o.max;
    const toNorm = (v) => (o.log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
    const fromNorm = (n) => {
      n = clamp(n, 0, 1);
      let v = o.log ? min * Math.pow(max / min, n) : min + n * (max - min);
      if (o.step) v = Math.round(v / o.step) * o.step;
      return clamp(v, min, max);
    };
    let value = o.value;
    const size = o.size || 38;
    const arc = h("path", { class: "knob-arc", fill: "none", "stroke-width": 4, "stroke-linecap": "round" });
    const bg = h("path", { class: "knob-bg", fill: "none", "stroke-width": 4, "stroke-linecap": "round" });
    const dot = h("line", { class: "knob-dot", "stroke-width": 3, "stroke-linecap": "round" });
    const svg = h("svg", { viewBox: "0 0 40 40", width: size, height: size, "aria-hidden": "true" }, bg, arc, h("circle", { cx: 20, cy: 20, r: 12, class: "knob-cap" }), dot);
    const valEl = h("span", { class: "knob-val" });
    const el = h("div", { class: "knob" + (o.cls ? " " + o.cls : ""), tabindex: 0, role: "slider", "aria-label": o.label, "aria-valuemin": min, "aria-valuemax": max, tip: o.tip || o.label, style: { "--kc": o.color || "var(--cyan)" } },
      svg, o.label ? h("span", { class: "knob-label" }, o.label) : null, o.showValue === false ? null : valEl);
    const polar = (deg, r) => { const a = ((deg - 90) * Math.PI) / 180; return [20 + r * Math.cos(a), 20 + r * Math.sin(a)]; };
    const arcPath = (a0, a1, r) => { const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r); return "M" + x0 + " " + y0 + " A" + r + " " + r + " 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + x1 + " " + y1; };
    bg.setAttribute("d", arcPath(-135, 135, 17));
    function render() {
      const n = clamp(toNorm(value), 0, 1);
      const bipolar = o.bipolar;
      const a = -135 + n * 270;
      if (bipolar) arc.setAttribute("d", a >= 0 ? arcPath(0, Math.max(0.01, a), 17) : arcPath(a, 0, 17));
      else arc.setAttribute("d", arcPath(-135, Math.max(-134.9, a), 17));
      const [x0, y0] = polar(a, 5), [x1, y1] = polar(a, 11);
      dot.setAttribute("x1", x0); dot.setAttribute("y1", y0); dot.setAttribute("x2", x1); dot.setAttribute("y2", y1);
      const txt = o.fmt ? o.fmt(value) : (Math.round(value * 100) / 100).toString() + (o.unit || "");
      valEl.textContent = txt;
      el.setAttribute("aria-valuenow", value);
      el.setAttribute("aria-valuetext", txt);
    }
    function setV(v, fire) {
      value = clamp(v, min, max);
      render();
      if (fire) o.onInput && o.onInput(value);
    }
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.focus();
      const start = toNorm(value);
      el.classList.add("active");
      drag(e, (dx, dy, ev) => {
        const sens = ev.shiftKey ? 600 : 160;
        setV(fromNorm(start + (-dy + dx * 0.3) / sens), true);
      }, () => { el.classList.remove("active"); o.onChange && o.onChange(value); });
    });
    el.addEventListener("dblclick", () => { if (o.def != null) { setV(o.def, true); o.onChange && o.onChange(value); } });
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      setV(fromNorm(toNorm(value) - Math.sign(e.deltaY) * 0.03), true);
      clearTimeout(el._wt);
      el._wt = setTimeout(() => o.onChange && o.onChange(value), 250);
    }, { passive: false });
    el.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      setV(fromNorm(toNorm(value) + d * (e.shiftKey ? 0.1 : 0.02)), true);
      o.onChange && o.onChange(value);
    });
    render();
    el.setValue = (v) => { value = v; render(); };
    return el;
  }

  /* ---------- vertical fader ---------- */
  function fader(o) {
    let value = o.value;
    const max = o.max || 1;
    const thumb = h("div", { class: "fader-thumb" });
    const fill = h("div", { class: "fader-fill" });
    const track = h("div", { class: "fader-track" }, fill, thumb);
    const el = h("div", { class: "fader", tabindex: 0, role: "slider", "aria-label": o.label || "Volume", "aria-valuemin": 0, "aria-valuemax": max, tip: o.tip || "Volume: drag up or down" }, track);
    const render = () => {
      const n = clamp(value / max, 0, 1);
      thumb.style.bottom = "calc(" + n * 100 + "% - " + n * 14 + "px)";
      fill.style.height = n * 100 + "%";
      el.setAttribute("aria-valuenow", value.toFixed(2));
      el.setAttribute("aria-valuetext", Math.round((value / 0.8) * 100) + "%");
    };
    const set = (v, fire) => { value = clamp(v, 0, max); render(); if (fire) o.onInput && o.onInput(value); };
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.focus();
      const r = track.getBoundingClientRect();
      if (e.target !== thumb) set(((r.bottom - e.clientY) / r.height) * max, true);
      const start = value;
      drag(e, (dx, dy) => set(start - (dy / r.height) * max, true), () => o.onChange && o.onChange(value));
    });
    el.addEventListener("dblclick", () => { set(o.def == null ? 0.8 : o.def, true); o.onChange && o.onChange(value); });
    el.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      set(value + d * 0.02 * max, true);
      o.onChange && o.onChange(value);
    });
    el.addEventListener("wheel", (e) => { e.preventDefault(); set(value - Math.sign(e.deltaY) * 0.02 * max, true); clearTimeout(el._wt); el._wt = setTimeout(() => o.onChange && o.onChange(value), 250); }, { passive: false });
    render();
    el.setValue = (v) => { value = v; render(); };
    return el;
  }

  /* ---------- confetti ---------- */
  function confetti() {
    const c = h("canvas", { class: "confetti" });
    document.body.append(c);
    const W = window.innerWidth, H = window.innerHeight;
    const ctx = GBL.fitCanvas(c, W, H);
    const parts = [];
    for (let i = 0; i < 140; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 200, y: H * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 3, c: GBL.pick(GBL.PALETTE), a: Math.random() * 6 });
    let f = 0;
    (function step() {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.a += 0.15;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      }
      if (++f < 120) requestAnimationFrame(step); else c.remove();
    })();
  }

  /* ---------- UI sounds (tiny blips, can be turned off) ---------- */
  function uiSound(kind) {
    if (!settings.get("uiSounds")) return;
    const eng = GBL.audio && GBL.audio.engine;
    if (!eng || !eng.ctx || eng.ctx.state !== "running") return;
    const ctx = eng.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f = { click: 880, on: 1320, off: 660, open: 990, success: 1568, error: 220 }[kind] || 880;
    o.type = kind === "error" ? "square" : "triangle";
    o.frequency.setValueAtTime(f, t);
    if (kind === "success") o.frequency.setValueAtTime(f * 1.5, t + 0.07);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "success" ? 0.2 : 0.07));
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.25);
  }

  function mount() { document.body.append(tipEl, toastBox); }

  GBL.ui = { settings, toast, modal, confirm, alert, prompt, form, menu, closeMenu, knob, fader, confetti, uiSound, mount, anyModal, hideTip };
})();
