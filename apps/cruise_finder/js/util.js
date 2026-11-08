/* Cruise Finder - shared helpers on the CF namespace.
 * h() DOM builder, integer-cent money math, UTC date helpers, seeded random numbers, event bus. */
(function () {
  "use strict";
  const CF = (window.CF = window.CF || {});
  CF.version = "1.0.0";
  CF.pages = CF.pages || {}; // page modules register here before app.js starts the router

  /* ---------- DOM ---------- */
  // h("div", {class: "x", onClick: fn}, child, [children], "text"). Children may be nodes, strings, arrays, null.
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let deferredValue;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k === "html") el.innerHTML = v; // trusted, app-generated markup only (SVG art)
        else if (k === "dataset") Object.assign(el.dataset, v);
        else if (k === "value") deferredValue = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      }
    }
    append(el, kids);
    if (deferredValue !== undefined) el.value = deferredValue;
    return el;
  }
  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : String(k));
    }
    return el;
  }
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- money: integer cents, never floats ---------- */
  // All amounts are stored and added as integer US-dollar cents. Percentages round once, at the line they apply to.
  const money = {
    dollars: (d) => Math.round(Number(d || 0) * 100),
    toDollars: (c) => Math.round(c) / 100,
    pct: (cents, pct) => Math.round((cents * pct) / 100),
    mul: (cents, n) => Math.round(cents * n),
    sum: (arr) => arr.reduce((a, b) => a + Math.round(b || 0), 0),
    // Display in the chosen currency. Conversion is display-only and labelled approximate in the UI.
    fmt(cents, opts = {}) {
      const cur = opts.currency || CF.settings?.currency?.() || "USD";
      const rate = cur === "USD" ? 1 : CF.data?.fxRate(cur) || 1;
      const value = (cents / 100) * rate;
      const decimals = opts.decimals ?? (Math.abs(value) >= 1000 || opts.whole ? 0 : 2);
      const s = new Intl.NumberFormat(undefined, { style: "currency", currency: cur, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
      return opts.sign && cents > 0 ? "+" + s : s;
    },
    // Parse a typed amount ("1,250.50", "$300") into cents in USD, converting from the display currency.
    parse(text, currency) {
      const n = parseFloat(String(text ?? "").replace(/[^0-9.\-]/g, ""));
      if (!isFinite(n)) return 0;
      const cur = currency || CF.settings?.currency?.() || "USD";
      const rate = cur === "USD" ? 1 : CF.data?.fxRate(cur) || 1;
      return Math.max(0, Math.round((n / rate) * 100));
    },
    // Cents -> number in the display currency, for input fields.
    toInput(cents, currency) {
      const cur = currency || CF.settings?.currency?.() || "USD";
      const rate = cur === "USD" ? 1 : CF.data?.fxRate(cur) || 1;
      const v = (cents / 100) * rate;
      return v ? String(Math.round(v * 100) / 100) : "";
    },
  };

  /* ---------- dates: ISO "YYYY-MM-DD" strings, handled in UTC so they never shift a day ---------- */
  const DAY = 86400000;
  const date = {
    parse: (iso) => new Date(iso + "T00:00:00Z"),
    iso: (d) => d.toISOString().slice(0, 10),
    today: () => {
      const n = new Date();
      return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
    },
    add: (iso, days) => date.iso(new Date(date.parse(iso).getTime() + days * DAY)),
    diff: (a, b) => Math.round((date.parse(b) - date.parse(a)) / DAY),
    dow: (iso) => date.parse(iso).getUTCDay(),
    month: (iso) => iso.slice(0, 7),
    fmt: (iso, style = "medium") => {
      if (!iso) return "";
      const o = style === "short" ? { month: "short", day: "numeric" }
        : style === "long" ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
        : style === "month" ? { month: "long", year: "numeric" }
        : style === "monthShort" ? { month: "short", year: "numeric" }
        : style === "dow" ? { weekday: "short", month: "short", day: "numeric" }
        : { month: "short", day: "numeric", year: "numeric" };
      return new Intl.DateTimeFormat(undefined, { ...o, timeZone: "UTC" }).format(date.parse(iso.length === 7 ? iso + "-01" : iso));
    },
    fmtTime: (ts) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ts)),
    monthsBetween(fromIso, toIso) {
      const out = [];
      let y = +fromIso.slice(0, 4), m = +fromIso.slice(5, 7);
      const ey = +toIso.slice(0, 4), em = +toIso.slice(5, 7);
      while (y < ey || (y === ey && m <= em)) {
        out.push(`${y}-${String(m).padStart(2, "0")}`);
        if (++m > 12) { m = 1; y++; }
      }
      return out;
    },
    endOfMonth(ym) {
      const [y, m] = ym.split("-").map(Number);
      return date.iso(new Date(Date.UTC(y, m, 0)));
    },
  };

  /* ---------- seeded random numbers, so sample data is identical on every visit ---------- */
  function hashStr(s) {
    let h1 = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h1 = Math.imul(h1 ^ s.charCodeAt(i), 3432918353);
      h1 = (h1 << 13) | (h1 >>> 19);
    }
    return (h1 >>> 0) || 1;
  }
  function rng(seed) {
    let a = typeof seed === "number" ? seed : hashStr(String(seed));
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- small helpers ---------- */
  const bus = {
    _h: {},
    on(ev, fn) { (this._h[ev] ||= new Set()).add(fn); return () => this._h[ev].delete(fn); },
    // Iterate a snapshot: a handler may re-render a page, which removes and adds listeners for the same event.
    emit(ev, data) { [...(this._h[ev] || [])].forEach((fn) => { try { fn(data); } catch (e) { CF.log?.error(e); } }); },
  };
  const uid = (p = "id") => p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;
  const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  // URL-safe base64 for share links (UTF-8 safe).
  const b64 = {
    enc: (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))))),
  };
  function download(filename, content, type = "text/plain") {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = h("a", { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function csv(rows) {
    return rows.map((r) => r.map((c) => {
      const s = String(c ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")).join("\r\n");
  }

  Object.assign(CF, { h, append, clear, $, $$, esc, money, date, rng, hashStr, bus, uid, clone, clamp, plural, debounce, b64, download, csv });
})();
