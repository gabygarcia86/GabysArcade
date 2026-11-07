/* Reading mode: the finished comic without editing controls. Single page or two-page spreads,
 * fullscreen, fit-to-screen and zoom, keyboard / click / swipe navigation. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, clear, clamp, prefs } = CBS;
  const doc = () => CBS.doc;

  let el = null, stageEl, scroller, info, scrub, modeSeg, zoomLabel;
  let views = [], index = 0, mode = prefs.get("readerMode", "single"), zoom = 1, cache = new Map();

  function buildViews() {
    const pages = doc().project.pages;
    views = [];
    if (mode === "single") { pages.forEach((pg, i) => views.push([i])); return; }
    let i = 0;
    if (pages[0] && pages[0].isCover) { views.push([0]); i = 1; }
    else if (pages.length) { views.push([0]); i = 1; } // first page on its own, like a printed comic
    for (; i < pages.length; i += 2) views.push(pages[i + 1] ? [i, i + 1] : [i]);
  }

  function pageImage(i) {
    const pg = doc().project.pages[i];
    if (cache.has(pg.id)) return cache.get(pg.id);
    const s = doc().size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.min(2.5, Math.max(innerHeight, 700) * dpr * Math.max(1, zoom) / s.h);
    const c = CBS.render.pageCanvas(pg, k);
    c.className = "reader-page";
    cache.set(pg.id, c);
    return c;
  }

  function show(dir = 0) {
    if (!views.length) return;
    index = clamp(index, 0, views.length - 1);
    const v = views[index];
    const s = doc().size;
    const spread = h("div", { class: "reader-spread" + (dir > 0 ? " turn-next" : dir < 0 ? " turn-prev" : "") });
    // available area
    const r = scroller.getBoundingClientRect();
    const cols = mode === "spread" ? 2 : 1;
    const fitH = (r.height - 24) / s.h, fitW = (r.width - 24) / (s.w * cols);
    const k = Math.min(fitH, fitW) * zoom;
    for (const i of v) {
      const c = pageImage(i);
      c.style.width = s.w * k + "px";
      c.style.height = s.h * k + "px";
      spread.append(c);
    }
    if (mode === "spread" && v.length === 1 && index === 0) spread.classList.add("solo-right");
    clear(stageEl).append(spread);
    stageEl.style.minWidth = Math.max(r.width, s.w * k * v.length + 24) + "px";
    stageEl.style.minHeight = Math.max(r.height, s.h * k + 24) + "px";
    const pages = doc().project.pages;
    const labels = v.map((i) => (pages[i].isCover ? "Cover" : "Page " + CBS.pagesPanel.label(pages[i])));
    info.textContent = labels.join(" – ") + ` · ${index + 1} / ${views.length}`;
    scrub.max = String(views.length - 1);
    scrub.value = String(index);
    zoomLabel.textContent = Math.round(zoom * 100) + "%";
    el.querySelector(".rd-prev").disabled = index === 0;
    el.querySelector(".rd-next").disabled = index === views.length - 1;
  }

  function go(d) {
    const n = clamp(index + d, 0, views.length - 1);
    if (n === index) return;
    index = n;
    show(d);
  }
  function setMode(m) {
    const firstPage = views[index] ? views[index][0] : 0;
    mode = m;
    prefs.set("readerMode", m);
    buildViews();
    index = Math.max(0, views.findIndex((v) => v.includes(firstPage)));
    show();
  }
  function setZoom(z) {
    const old = zoom;
    zoom = clamp(z, 1, 4);
    if (Math.ceil(zoom) !== Math.ceil(old)) cache.clear();
    show();
  }

  function onKey(e) {
    if (!el) return;
    if (e.key === "Escape") { if (document.fullscreenElement) return; close(); }
    else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
    else if (e.key === "Home") { index = 0; show(); }
    else if (e.key === "End") { index = views.length - 1; show(); }
    else if (e.key === "f" || e.key === "F") toggleFullscreen();
    else if (e.key === "+" || e.key === "=") setZoom(zoom + 0.5);
    else if (e.key === "-") setZoom(zoom - 0.5);
    else if (e.key === "0") setZoom(1);
    else return;
    e.stopPropagation();
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) { (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).catch(() => CBS.ui.toast("Fullscreen isn't available here.")); }
    else document.exitFullscreen();
  }

  async function open() {
    const p = doc().project;
    if (!p) return;
    CBS.editor.stopEditing();
    await CBS.assets.ensureLoaded(p.pages);
    cache = new Map();
    zoom = 1;
    const btn = (label, tip, fn, cls = "") => h("button", { class: "btn rd-btn " + cls, tip, "aria-label": tip, onclick: fn }, label);
    stageEl = h("div", { class: "reader-stage" });
    scroller = h("div", { class: "reader-scroll" }, stageEl);
    info = h("span", { class: "rd-info" });
    scrub = h("input", { type: "range", class: "range rd-scrub", min: 0, max: 0, value: 0, "aria-label": "Jump to page" });
    scrub.addEventListener("input", () => { const n = parseInt(scrub.value, 10); const d = n - index; index = n; show(Math.sign(d)); });
    modeSeg = CBS.ui.segmented([["single", "▯ Single page"], ["spread", "▯▯ Two-page spread"]], mode, setMode, { small: true });
    zoomLabel = h("span", { class: "rd-zoom" }, "100%");
    el = h("div", { class: "reader", role: "dialog", "aria-label": "Comic preview" },
      h("div", { class: "reader-top" },
        h("b", { class: "rd-title" }, p.title),
        p.author ? h("span", { class: "rd-author" }, "by " + p.author) : null,
        h("div", { class: "spacer" }),
        modeSeg,
        btn("−", "Zoom out", () => setZoom(zoom - 0.5)), zoomLabel, btn("＋", "Zoom in", () => setZoom(zoom + 0.5)),
        btn("Fit", "Fit to screen", () => setZoom(1)),
        btn("⛶", "Fullscreen (F)", toggleFullscreen),
        btn("✕ Close", "Back to editing (Esc)", close, "primary")),
      scroller,
      h("div", { class: "reader-bottom" },
        btn("◀ Previous", "Previous page (←)", () => go(-1), "rd-prev"),
        h("div", { class: "rd-mid" }, info, scrub),
        btn("Next ▶", "Next page (→)", () => go(1), "rd-next")));
    document.body.append(el);
    // click the left / right third of the page area to turn pages
    scroller.addEventListener("click", (e) => {
      if (zoom > 1) return;
      const r = scroller.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.33) go(-1); else if (x > 0.67) go(1);
    });
    // swipe
    let sx = null, sy = null;
    scroller.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { sx = e.clientX; sy = e.clientY; } });
    scroller.addEventListener("pointerup", (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = sy = null;
      if (zoom === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    });
    // drag to pan when zoomed in
    let pan = null;
    scroller.addEventListener("pointerdown", (e) => { if (zoom > 1 && e.pointerType === "mouse") { pan = { x: e.clientX, y: e.clientY, l: scroller.scrollLeft, t: scroller.scrollTop }; scroller.classList.add("panning"); } });
    window.addEventListener("pointermove", onPanMove);
    window.addEventListener("pointerup", onPanUp);
    function onPanMove(e) { if (pan) { scroller.scrollLeft = pan.l - (e.clientX - pan.x); scroller.scrollTop = pan.t - (e.clientY - pan.y); } }
    function onPanUp() { pan = null; scroller.classList.remove("panning"); }
    el._cleanup = () => { window.removeEventListener("pointermove", onPanMove); window.removeEventListener("pointerup", onPanUp); };
    scroller.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); } }, { passive: false });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    buildViews();
    const cur = doc().pageIndex;
    index = Math.max(0, views.findIndex((v) => v.includes(cur)));
    requestAnimationFrame(() => show());
  }
  const onResize = CBS.debounce(() => { if (el) show(); }, 120);
  function close() {
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onResize);
    if (el._cleanup) el._cleanup();
    el.remove();
    el = null;
    cache.clear();
  }

  CBS.reader = { open, close, get isOpen() { return !!el; } };
})();
