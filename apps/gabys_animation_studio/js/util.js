/* Gaby's Animation Studio - shared helpers.
 * Every script attaches to the single global namespace `GAS`. */
(function () {
  "use strict";
  const GAS = (window.GAS = window.GAS || {});

  /* ---------- small math helpers ---------- */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  let idCounter = 0;
  const uid = (prefix = "id") =>
    prefix + "_" + Date.now().toString(36) + "_" + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 6);

  /* Seeded random generator (mulberry32) so effects look the same every time they draw. */
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

  /* ---------- DOM helper ----------
   * h("button", {class: "x", onclick: fn, tip: "Hi"}, "Label", childNode) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object") {
          for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith("--")) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        }
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "html") el.innerHTML = v;
        else if (k === "tip") el.dataset.tip = v;
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      }
    }
    appendKids(el, children);
    return el;
  }
  function appendKids(el, kids) {
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) appendKids(el, c);
      else el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    }
  }
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- event bus ---------- */
  const listeners = new Map();
  const bus = {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit(name, data) {
      const set = listeners.get(name);
      if (set) for (const fn of Array.from(set)) {
        try { fn(data); } catch (err) { console.error("[bus]", name, err); }
      }
    },
  };

  /* ---------- canvases ---------- */
  function makeCanvas(w, h, readFrequently) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    c._ctx = c.getContext("2d", readFrequently ? { willReadFrequently: true } : undefined);
    return c;
  }
  const ctxOf = (c) => c._ctx || (c._ctx = c.getContext("2d"));

  function copyCanvas(src, readFrequently) {
    const c = makeCanvas(src.width, src.height, readFrequently);
    ctxOf(c).drawImage(src, 0, 0);
    return c;
  }

  function canvasToBlob(canvas, type = "image/png", quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
      } else {
        resolve(dataURLToBlob(canvas.toDataURL(type, quality)));
      }
    });
  }
  function dataURLToBlob(dataURL) {
    const [head, body] = dataURL.split(",");
    const mime = (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    const isB64 = /;base64/.test(head);
    const raw = isB64 ? atob(body) : decodeURIComponent(body);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = src;
    });
  }
  /* Draws an image source (blob/dataURL/img) into a canvas of the given size. */
  async function imageToCanvas(src, w, h, readFrequently) {
    const img = typeof src === "string" ? await loadImage(src)
      : src instanceof Blob ? await loadImage(URL.createObjectURL(src)) : src;
    const c = makeCanvas(w || img.naturalWidth || img.width, h || img.naturalHeight || img.height, readFrequently);
    ctxOf(c).drawImage(img, 0, 0, c.width, c.height);
    if (src instanceof Blob) URL.revokeObjectURL(img.src);
    return c;
  }

  /* ---------- downloads ---------- */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function safeFileName(name, fallback = "my-animation") {
    const s = String(name || "").trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").slice(0, 60);
    return s || fallback;
  }

  /* ---------- colors ---------- */
  function hexToRgb(hex) {
    let s = String(hex || "").trim().replace(/^#/, "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    const n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const toHex2 = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  const rgbToHex = (r, g, b) => "#" + toHex2(r) + toHex2(g) + toHex2(b);
  function normalizeHex(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHex(rgb.r, rgb.g, rgb.b) : null;
  }
  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
  }
  /* Picks black or white text for a background color. */
  function contrastText(hex) {
    const c = hexToRgb(hex) || { r: 255, g: 255, b: 255 };
    return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 > 150 ? "#1d1a3a" : "#ffffff";
  }

  /* ---------- misc ---------- */
  function debounce(fn, ms) {
    let t = 0;
    const d = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
    d.flush = (...args) => { clearTimeout(t); fn(...args); };
    d.cancel = () => clearTimeout(t);
    return d;
  }
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const isTyping = (el) => {
    el = el || document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA" || el.isContentEditable) return true;
    if (tag === "SELECT") return true;
    if (tag === "INPUT") {
      const t = (el.type || "text").toLowerCase();
      return !["button", "checkbox", "radio", "range", "color", "submit", "reset", "file"].includes(t);
    }
    return false;
  };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const fmtTime = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  const fmtDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return "Today, " + fmtTime(ts);
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" }) + ", " + fmtTime(ts);
  };
  const fmtBytes = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB");

  /* Local storage that never throws (private windows can block it). */
  const prefs = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem("gas:" + key);
        return v == null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("gas:" + key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  Object.assign(GAS, {
    clamp, lerp, dist, uid, rng, h, $, $$, bus,
    makeCanvas, ctxOf, copyCanvas, canvasToBlob, dataURLToBlob, blobToDataURL, loadImage, imageToCanvas,
    downloadBlob, safeFileName,
    hexToRgb, rgbToHex, normalizeHex, hsvToRgb, rgbToHsv, contrastText,
    debounce, nextFrame, wait, isTyping, isMac, fmtTime, fmtDate, fmtBytes, prefs,
  });
})();
