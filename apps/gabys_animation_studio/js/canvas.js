/* The editor canvas: a stack of canvases (background fill, background painting, onion skin,
 * drawing layer, objects, playback) inside a zoomable "art board", plus a screen-sized overlay
 * for handles and the brush cursor. Also handles zoom, pan and pinch gestures. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, ctxOf, clamp, model } = GAS;

  let stage, art, overlay, octx;
  const views = {};
  let live = null; // {kind: "draw"|"bg", canvas, alpha, erase}
  let fitPending = true;
  let overlayQueued = false;

  function init(stageEl) {
    stage = stageEl;
    art = h("div", { class: "art", id: "art" });
    for (const name of ["bgfill", "bglayer", "onion", "draw", "objects", "play"]) {
      const c = document.createElement("canvas");
      c.className = "v v-" + name;
      art.appendChild(c);
      views[name] = c;
    }
    overlay = h("canvas", { class: "overlay", "aria-hidden": "true" });
    stage.appendChild(art);
    stage.appendChild(overlay);
    octx = overlay.getContext("2d");
    new ResizeObserver(() => {
      resizeOverlay();
      if (fitPending) fit();
      else applyTransform();
    }).observe(stage);
    setupPointers();
  }

  function setup(project) {
    for (const c of Object.values(views)) {
      c.width = project.width;
      c.height = project.height;
      c._ctx = null;
    }
    art.style.width = project.width + "px";
    art.style.height = project.height + "px";
    fitPending = true;
    fit();
  }

  /* ---------- transform ---------- */
  function applyTransform() {
    art.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    art.classList.toggle("is-pixelated", state.zoom >= 3);
    GAS.bus.emit("zoom-changed", state.zoom);
    queueOverlay();
  }

  function fit() {
    const p = state.project;
    if (!p || !stage.clientWidth) return;
    fitPending = false;
    const margin = stage.clientWidth < 600 ? 16 : 48;
    const z = Math.min((stage.clientWidth - margin) / p.width, (stage.clientHeight - margin) / p.height, 2.5);
    state.zoom = Math.max(0.05, z);
    state.panX = (stage.clientWidth - p.width * state.zoom) / 2;
    state.panY = (stage.clientHeight - p.height * state.zoom) / 2;
    applyTransform();
  }

  function setZoom(z, cx, cy) {
    const r = stage.getBoundingClientRect();
    if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
    z = clamp(z, 0.05, 16);
    const ax = (cx - r.left - state.panX) / state.zoom;
    const ay = (cy - r.top - state.panY) / state.zoom;
    state.zoom = z;
    state.panX = cx - r.left - ax * z;
    state.panY = cy - r.top - ay * z;
    applyTransform();
  }
  const zoomBy = (f, cx, cy) => setZoom(state.zoom * f, cx, cy);

  function toArt(clientX, clientY) {
    const r = stage.getBoundingClientRect();
    return { x: (clientX - r.left - state.panX) / state.zoom, y: (clientY - r.top - state.panY) / state.zoom };
  }
  /* art -> overlay (CSS px relative to the stage) */
  const toScreen = (x, y) => ({ x: state.panX + x * state.zoom, y: state.panY + y * state.zoom });

  /* ---------- layer views ---------- */
  function refreshBgFill() {
    const p = state.project, f = GAS.curFrame();
    const c = views.bgfill, ctx = ctxOf(c);
    ctx.clearRect(0, 0, c.width, c.height);
    const fill = model.frameBgFill(p, f);
    GAS.render.drawBgFill(ctx, fill, p.width, p.height, p);
    art.classList.toggle("is-transparent", fill.type === "transparent");
  }

  function refreshLayer(kind) {
    const p = state.project, f = GAS.curFrame();
    if (!p || !f) return;
    const c = kind === "bg" ? views.bglayer : views.draw;
    const ctx = ctxOf(c);
    const layer = kind === "bg" ? model.frameBgLayer(p, f) : f.draw;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!layer.empty) ctx.drawImage(layer.canvas, 0, 0);
    if (live && live.kind === kind) {
      ctx.globalAlpha = live.alpha;
      ctx.globalCompositeOperation = live.erase ? "destination-out" : "source-over";
      ctx.drawImage(live.canvas, 0, 0);
    }
    ctx.restore();
    if (state.float && state.float.kind === kind) GAS.selection.drawFloat(ctx);
  }

  function refreshObjects() {
    const p = state.project, f = GAS.curFrame();
    if (!p || !f) return;
    const c = views.objects, ctx = ctxOf(c);
    ctx.clearRect(0, 0, c.width, c.height);
    for (const o of f.objects) GAS.render.drawObject(ctx, o, p);
  }

  function refreshOnion() {
    const c = views.onion, ctx = ctxOf(c);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!state.playing) GAS.onion.render(ctx);
  }

  function refreshAll() {
    if (!state.project) return;
    refreshBgFill();
    refreshLayer("bg");
    refreshOnion();
    refreshLayer("draw");
    refreshObjects();
    updateLayerFocus();
    queueOverlay();
  }

  function updateLayerFocus() {
    art.classList.toggle("is-bg-active", state.activeLayer === "bg");
  }

  function setLive(kind, canvas, alpha, erase) {
    live = { kind, canvas, alpha, erase };
  }
  function clearLive() {
    const k = live && live.kind;
    live = null;
    if (k) refreshLayer(k);
  }

  /* ---------- overlay ---------- */
  function resizeOverlay() {
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(stage.clientWidth * dpr);
    overlay.height = Math.round(stage.clientHeight * dpr);
    overlay.style.width = stage.clientWidth + "px";
    overlay.style.height = stage.clientHeight + "px";
    queueOverlay();
  }
  function queueOverlay() {
    if (overlayQueued) return;
    overlayQueued = true;
    requestAnimationFrame(drawOverlay);
  }
  function drawOverlay() {
    overlayQueued = false;
    const dpr = window.devicePixelRatio || 1;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    if (!state.project) return;
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Canvas border so the drawing area is always easy to see.
    const a = toScreen(0, 0);
    octx.strokeStyle = "rgba(43,35,64,0.25)";
    octx.lineWidth = 1;
    octx.strokeRect(Math.round(a.x) - 0.5, Math.round(a.y) - 0.5, Math.round(state.project.width * state.zoom) + 1, Math.round(state.project.height * state.zoom) + 1);
    if (state.playing) return;
    GAS.selection.drawOverlay(octx);
    GAS.tools.drawCursor(octx);
  }

  /* ---------- pointers & gestures ---------- */
  const pointers = new Map();
  let gesture = null; // {kind: "pinch"|"pan", ...}
  let toolPointer = null;

  function setupPointers() {
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onCancel);
    stage.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { GAS.tools.hover(null); queueOverlay(); } });
    stage.addEventListener("lostpointercapture", (e) => { if (pointers.has(e.pointerId)) onUp(e); });
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("contextmenu", (e) => e.preventDefault());
    stage.addEventListener("dblclick", (e) => {
      if (state.playing) return;
      GAS.selection.dblclick(toArt(e.clientX, e.clientY));
    });
    // Stop iOS from turning a pinch into a page zoom.
    stage.addEventListener("gesturestart", (e) => e.preventDefault());
  }

  function onDown(e) {
    if (e.target.closest(".stage-ui")) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body && GAS.isTyping()) document.activeElement.blur();

    if (state.playing) { GAS.anim.pause(); return; }

    // Two fingers: cancel whatever the first finger started and pinch/pan instead.
    if (pointers.size === 2 && e.pointerType === "touch") {
      if (toolPointer != null) { GAS.tools.cancel(); toolPointer = null; }
      startPinch();
      return;
    }
    if (pointers.size > 1) return;

    const panMode = e.button === 1 || state.tool === "hand" || (GAS.keys && GAS.keys.spaceHeld);
    if (panMode) {
      gesture = { kind: "pan", x: e.clientX, y: e.clientY, px: state.panX, py: state.panY };
      stage.classList.add("is-panning");
      return;
    }
    toolPointer = e.pointerId;
    GAS.tools.down(withArt(e));
  }

  function withArt(e) {
    const p = toArt(e.clientX, e.clientY);
    return {
      x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY,
      pressure: e.pointerType === "pen" ? (e.pressure || 0.5) : 1,
      isPen: e.pointerType === "pen", isTouch: e.pointerType === "touch",
      shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey, raw: e,
    };
  }

  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture && gesture.kind === "pinch") { movePinch(); return; }
    if (gesture && gesture.kind === "pan") {
      state.panX = gesture.px + (e.clientX - gesture.x);
      state.panY = gesture.py + (e.clientY - gesture.y);
      applyTransform();
      return;
    }
    if (toolPointer === e.pointerId) {
      // Coalesced events give smoother lines on fast movement.
      const list = e.getCoalescedEvents ? e.getCoalescedEvents() : null;
      if (list && list.length > 1) for (const ce of list) GAS.tools.move(withArt(ce));
      else GAS.tools.move(withArt(e));
    } else if (!pointers.size && e.pointerType !== "touch") {
      GAS.tools.hover(withArt(e));
      queueOverlay();
    }
  }

  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture) {
      if (pointers.size === 0) { gesture = null; stage.classList.remove("is-panning"); }
      else if (gesture.kind === "pinch") gesture = null;
      return;
    }
    if (toolPointer === e.pointerId) {
      toolPointer = null;
      GAS.tools.up(withArt(e));
    }
  }
  function onCancel(e) {
    pointers.delete(e.pointerId);
    if (toolPointer === e.pointerId) { toolPointer = null; GAS.tools.cancel(); }
    if (!pointers.size) { gesture = null; stage.classList.remove("is-panning"); }
  }

  function pinchInfo() {
    const [a, b] = Array.from(pointers.values());
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  }
  function startPinch() {
    const p = pinchInfo();
    const r = stage.getBoundingClientRect();
    gesture = { kind: "pinch", start: p, zoom: state.zoom, ax: (p.cx - r.left - state.panX) / state.zoom, ay: (p.cy - r.top - state.panY) / state.zoom };
  }
  function movePinch() {
    if (pointers.size < 2) return;
    const p = pinchInfo();
    const r = stage.getBoundingClientRect();
    const z = clamp(gesture.zoom * (p.d / gesture.start.d), 0.05, 16);
    state.zoom = z;
    state.panX = p.cx - r.left - gesture.ax * z;
    state.panY = p.cy - r.top - gesture.ay * z;
    applyTransform();
  }

  function onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
    } else {
      const k = e.deltaMode === 1 ? 20 : 1;
      state.panX -= (e.shiftKey ? e.deltaY : e.deltaX) * k;
      state.panY -= (e.shiftKey ? 0 : e.deltaY) * k;
      applyTransform();
    }
  }

  GAS.view = {
    init, setup, fit, setZoom, zoomBy, toArt, toScreen, applyTransform,
    refreshAll, refreshBgFill, refreshLayer, refreshObjects, refreshOnion, updateLayerFocus,
    setLive, clearLive, queueOverlay,
    get views() { return views; },
    get stage() { return stage; },
    get art() { return art; },
    get toolActive() { return toolPointer != null; },
  };
})();
