/* Comic Book Studio - shared helpers.
 * Every script attaches to the single global namespace `CBS`. */
(function () {
  "use strict";
  const CBS = (window.CBS = window.CBS || {});

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  let idCounter = 0;
  const uid = (prefix = "id") =>
    prefix + "_" + Date.now().toString(36) + (idCounter++).toString(36) + Math.random().toString(36).slice(2, 6);
  const deepClone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  const DEG = Math.PI / 180;

  /* Seeded random generator (mulberry32). */
  function rng(seed) {
    let a = (typeof seed === "string" ? hashString(seed) : seed) >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const SVG_TAGS = new Set(["svg", "path", "circle", "rect", "g", "polygon", "line", "polyline", "ellipse", "text"]);
  /* DOM helper: h("button", {class: "x", onclick: fn, tip: "Hi"}, "Label", childNode) */
  function h(tag, attrs, ...children) {
    const el = SVG_TAGS.has(tag) ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
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

  function readFile(file, as = "dataURL") {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error || new Error("Could not read file"));
      if (as === "text") r.readAsText(file);
      else if (as === "buffer") r.readAsArrayBuffer(file);
      else r.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("Could not load image"));
      img.src = src;
    });
  }

  function canvasToBlob(canvas, type = "image/png", quality) {
    return new Promise((res, rej) => {
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode image"))), type, quality);
    });
  }

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  /* Pick the first file from a native file picker. */
  function pickFile(accept, multiple = false) {
    return new Promise((res) => {
      const input = h("input", { type: "file", accept, style: { display: "none" } });
      if (multiple) input.multiple = true;
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        input.remove();
        res(multiple ? files : files[0] || null);
      });
      input.addEventListener("cancel", () => { input.remove(); res(multiple ? [] : null); });
      document.body.append(input);
      input.click();
    });
  }

  /* Colors */
  function hexToRgb(hex) {
    let s = String(hex || "").trim().replace("#", "");
    if (s.length === 3) s = s.split("").map((c) => c + c).join("");
    const n = parseInt(s.slice(0, 6), 16);
    if (isNaN(n)) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgbToHex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  function normalizeHex(v) {
    if (typeof v !== "string") return null;
    let s = v.trim();
    if (!s.startsWith("#")) s = "#" + s;
    if (/^#[0-9a-f]{3}$/i.test(s)) s = "#" + s.slice(1).split("").map((c) => c + c).join("");
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
  }
  function withAlpha(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function shade(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const f = (v) => (amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return rgbToHex(f(r), f(g), f(b));
  }

  /* Geometry */
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  function rotatePt(x, y, cx, cy, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const dx = x - cx, dy = y - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  }
  function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
    }
    return inside;
  }
  function polyBounds(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /* Ramer-Douglas-Peucker simplification for freehand polygons. */
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const segDist = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
      t = clamp(t, 0, 1);
      return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    };
    const rec = (s, e, out) => {
      let md = 0, mi = -1;
      for (let i = s + 1; i < e; i++) { const d = segDist(pts[i], pts[s], pts[e]); if (d > md) { md = d; mi = i; } }
      if (md > eps && mi > 0) { rec(s, mi, out); out.pop(); rec(mi, e, out); }
      else out.push(pts[s], pts[e]);
      return out;
    };
    return rec(0, pts.length - 1, []);
  }

  /* Parse "1-3, 5, 8-" style page ranges into zero-based indices. */
  function parseRange(str, count) {
    const out = new Set();
    for (const part of String(str || "").split(",")) {
      const p = part.trim();
      if (!p) continue;
      const m = p.match(/^(\d*)\s*-\s*(\d*)$/);
      if (m) {
        const a = m[1] ? parseInt(m[1], 10) : 1;
        const b = m[2] ? parseInt(m[2], 10) : count;
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (i >= 1 && i <= count) out.add(i - 1);
      } else if (/^\d+$/.test(p)) {
        const n = parseInt(p, 10);
        if (n >= 1 && n <= count) out.add(n - 1);
      } else return null;
    }
    return Array.from(out).sort((a, b) => a - b);
  }

  /* CRC32 + store-only ZIP writer (for multi-image exports). */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  async function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true);
      local.setUint16(10, dosTime, true);
      local.setUint16(12, dosDate, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);
      parts.push(new Uint8Array(local.buffer), name, data);
      const cen = new DataView(new ArrayBuffer(46));
      cen.setUint32(0, 0x02014b50, true);
      cen.setUint16(4, 20, true);
      cen.setUint16(6, 20, true);
      cen.setUint16(8, 0x0800, true);
      cen.setUint16(10, 0, true);
      cen.setUint16(12, dosTime, true);
      cen.setUint16(14, dosDate, true);
      cen.setUint32(16, crc, true);
      cen.setUint32(20, data.length, true);
      cen.setUint32(24, data.length, true);
      cen.setUint16(28, name.length, true);
      cen.setUint32(42, offset, true);
      central.push(new Uint8Array(cen.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cenSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cenSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  /* Preferences in localStorage (always wrapped: storage can be blocked). */
  const PREF_KEY = "cbs-prefs-v1";
  const prefs = {
    _data: null,
    _load() {
      if (this._data) return this._data;
      try { this._data = JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (e) { this._data = {}; }
      return this._data;
    },
    get(k, def) { const d = this._load(); return k in d ? d[k] : def; },
    set(k, v) {
      this._load()[k] = v;
      try { localStorage.setItem(PREF_KEY, JSON.stringify(this._data)); } catch (e) { /* ignore */ }
      bus.emit("prefs:changed", k, v);
    },
  };

  function safeFilename(s, fallback = "comic") {
    const out = String(s || "").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    return out || fallback;
  }
  function timeAgo(ts) {
    if (!ts) return "";
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 7) return Math.round(s / 86400) + " d ago";
    return new Date(ts).toLocaleDateString();
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl";
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  Object.assign(CBS, {
    clamp, lerp, uid, deepClone, pick, rng, hashString, DEG,
    h, $, $$, clear, bus, debounce, downloadBlob, readFile, loadImage, canvasToBlob, makeCanvas, pickFile,
    hexToRgb, rgbToHex, normalizeHex, withAlpha, shade,
    dist, rotatePt, pointInPoly, polyBounds, simplify, parseRange, crc32, makeZip,
    prefs, safeFilename, timeAgo, isMac, modKey, nextFrame, wait,
  });
})();
