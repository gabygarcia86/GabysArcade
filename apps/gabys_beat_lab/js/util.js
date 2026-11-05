/* Gaby's Beat Lab - shared helpers.
 * Every script attaches to the single global namespace `GBL`. */
(function () {
  "use strict";
  const GBL = (window.GBL = window.GBL || {});

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  let idCounter = 0;
  const uid = (prefix = "id") =>
    prefix + "_" + Date.now().toString(36) + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 6);
  const deepClone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];

  /* Seeded random generator (mulberry32). */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* DOM helper: h("button", {class: "x", onclick: fn, tip: "Hi"}, "Label", childNode) */
  function h(tag, attrs, ...children) {
    const el = tag === "svg" || tag === "path" || tag === "circle" || tag === "rect" || tag === "g" || tag === "polygon" || tag === "line" || tag === "polyline"
      ? document.createElementNS("http://www.w3.org/2000/svg", tag)
      : document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.setAttribute("class", v);
        else if (k === "style" && typeof v === "object") {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith("--")) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        } else if (k === "tip") el.setAttribute("data-tip", v);
        else if (k === "html") el.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "value" && "value" in el) el.value = v;
        else if (k === "checked" || k === "disabled" || k === "selected") el[k] = !!v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /* Tiny event bus */
  const listeners = {};
  const bus = {
    on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); return () => bus.off(name, fn); },
    off(name, fn) { const l = listeners[name]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(name, ...args) {
      for (const fn of (listeners[name] || []).slice()) {
        try { fn(...args); } catch (e) { console.error("[bus " + name + "]", e); }
      }
    },
  };

  function debounce(fn, ms) {
    let t = 0;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); fn(...a); };
    d.cancel = () => clearTimeout(t);
    return d;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function safeFileName(name, ext) {
    const base = String(name || "my-song").trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 80) || "my-song";
    return base + (ext ? "." + ext : "");
  }

  function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function base64ToArrayBuffer(b64) {
    const s = atob(b64);
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes.buffer;
  }

  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem("gbl." + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem("gbl." + key, JSON.stringify(value)); } catch (e) { /* storage blocked */ } },
  };

  /* Pointer drag helper: calls move(dx, dy, e) and up(e). */
  function drag(e, move, up) {
    const sx = e.clientX, sy = e.clientY;
    const target = e.currentTarget || e.target;
    try { target.setPointerCapture && target.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const mv = (ev) => move && move(ev.clientX - sx, ev.clientY - sy, ev);
    const end = (ev) => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      up && up(ev);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  function fmtTime(sec) {
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec * 10) % 10);
    return m + ":" + String(s).padStart(2, "0") + "." + cs;
  }

  /* Hi-DPI canvas sizing. Returns the 2d context scaled to CSS pixels. */
  function fitCanvas(canvas, w, h2) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h2 * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    canvas.style.width = w + "px";
    canvas.style.height = h2 + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function hexToRgba(hex, a) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || "");
    if (!m) return "rgba(160,160,255," + a + ")";
    return "rgba(" + parseInt(m[1], 16) + "," + parseInt(m[2], 16) + "," + parseInt(m[3], 16) + "," + a + ")";
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const isTyping = (e) => {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  };

  const PALETTE = ["#ff4f8b", "#ff8a3d", "#ffd23f", "#4ade80", "#22d3ee", "#3b82f6", "#a855f7", "#f472b6", "#2dd4bf", "#fb7185", "#facc15", "#818cf8"];

  Object.assign(GBL, {
    clamp, lerp, uid, deepClone, pick, rng, h, $, $$, clear, bus, debounce, downloadBlob, safeFileName,
    arrayBufferToBase64, base64ToArrayBuffer, store, drag, fmtTime, fitCanvas, hexToRgba, isMac, isTyping, PALETTE,
  });
})();
