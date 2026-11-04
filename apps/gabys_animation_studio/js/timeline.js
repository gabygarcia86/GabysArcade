/* Bottom timeline: frame thumbnails (tap to pick, drag to reorder), frame buttons, and playback
 * controls (play, stop, step, speed, loop, onion skin, big-screen preview). */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, ctxOf, clamp } = GAS;

  let root, strip, tiles = new Map(); // frame id -> {el, canvas, rev}
  let playBtn, loopBtn, onionBtn, fpsSel, holdBtn, pasteBtn, frameLabel;
  const thumbQueue = new Set();
  let thumbTimer = 0;

  function init(el) {
    root = el;
    const I = GAS.icons.svg;
    const btn = (icon, label, tip, fn, cls, key) => {
      const b = h("button", { class: "tl-btn " + (cls || ""), type: "button", tip, "aria-label": label, dataset: key ? { key } : undefined }, I(icon), label ? h("span", { class: "tl-btn-label" }, label) : null);
      b.addEventListener("click", fn);
      return b;
    };

    // Frame actions
    const addBlank = btn("plus", "New", "Add a blank frame", () => GAS.app.addFrame("blank"), "is-add", "N");
    const addCopy = btn("copy", "Copy", "Duplicate: a new frame with a copy of this drawing (best for animating!)", () => GAS.app.addFrame("copy"), "is-dup", "D");
    holdBtn = btn("clock", "×1", "How long this frame stays on screen", openHold, "is-hold");
    pasteBtn = btn("paste", "", "Paste a copied frame after this one", () => GAS.app.pasteFrame());
    const frameMore = btn("more", "", "More frame options", (e) => { const anchor = e.currentTarget; GAS.ui.menu(anchor, [
      { label: "Frame timing (×" + (GAS.curFrame().hold || 1) + ")", icon: "clock", onClick: () => openHold({ currentTarget: anchor }) },
      { label: "Copy this frame", icon: "copy", onClick: () => GAS.app.copyFrame() },
      { label: "Paste frame after this one", icon: "paste", onClick: () => GAS.app.pasteFrame(), disabled: !GAS.app.hasFrameClipboard },
      "-",
      { label: "Move frame left", icon: "moveLeft", onClick: () => GAS.app.moveFrame(state.cur, state.cur - 1), disabled: state.cur === 0 },
      { label: "Move frame right", icon: "moveRight", onClick: () => GAS.app.moveFrame(state.cur, state.cur + 1), disabled: state.cur >= state.project.frames.length - 1 },
      "-",
      { label: "Clear this frame", icon: "clear", onClick: async () => { if (await GAS.ui.confirm({ title: "Clear this frame?", text: "Everything on frame " + (state.cur + 1) + " will be wiped. You can press Undo if you change your mind.", ok: "Clear it", danger: true, icon: "clear" })) GAS.app.clearFrame(); } },
      { label: "Delete this frame", icon: "trash", danger: true, onClick: () => GAS.app.deleteFrame() },
    ], { above: true }); });
    const frameGroup = h("div", { class: "tl-group tl-frames-group" },
      addBlank, addCopy,
      btn("trash", "", "Delete this frame", () => GAS.app.deleteFrame(), "is-danger"),
      btn("moveLeft", "", "Move this frame left", () => GAS.app.moveFrame(state.cur, state.cur - 1), "hide-sm"),
      btn("moveRight", "", "Move this frame right", () => GAS.app.moveFrame(state.cur, state.cur + 1), "hide-sm"),
      btn("copy", "", "Copy this frame (then paste it anywhere)", () => GAS.app.copyFrame(), "hide-sm is-copyframe"),
      pasteBtn,
      btn("clear", "", "Clear this frame", async () => { if (await GAS.ui.confirm({ title: "Clear this frame?", text: "Everything on frame " + (state.cur + 1) + " will be wiped. You can press Undo if you change your mind.", ok: "Clear it", danger: true, icon: "clear" })) GAS.app.clearFrame(); }, "hide-sm"),
      holdBtn, frameMore);
    pasteBtn.classList.add("hide-sm");
    frameMore.classList.add("show-sm");

    // Playback
    playBtn = btn("play", "", "Play your animation", () => GAS.anim.toggle(), "is-play", "Space");
    frameLabel = h("span", { class: "tl-frame-label" });
    const playGroup = h("div", { class: "tl-group tl-play-group" },
      btn("prev", "", "Previous frame", () => GAS.app.goToFrame(state.cur - 1), "", "←"),
      playBtn,
      btn("stop", "", "Stop and go back to the start", () => GAS.anim.stop()),
      btn("next", "", "Next frame", () => GAS.app.goToFrame(state.cur + 1), "", "→"),
      frameLabel);

    // Settings
    fpsSel = GAS.ui.select(GAS.anim.FPS_CHOICES.map((f) => ({ value: f, label: f + " fps" })), 8, (v) => { state.project.fps = +v; GAS.bus.emit("dirty"); updateInfo(); });
    fpsSel.dataset.tip = "Speed: frames per second. More = faster!";
    fpsSel.classList.add("tl-fps");
    const speedSel = GAS.ui.select(GAS.anim.SPEEDS.map((s) => ({ value: s, label: s === 1 ? "1× speed" : s + "× speed" })), 1, (v) => { state.project.speed = +v; GAS.bus.emit("dirty"); });
    speedSel.dataset.tip = "Preview speed (slow motion or fast forward)";
    speedSel.classList.add("tl-speed", "hide-sm");
    loopBtn = btn("loop", "", "Loop: play again and again", () => { state.project.loop = !state.project.loop; GAS.bus.emit("dirty"); syncButtons(); GAS.ui.toast(state.project.loop ? "Looping on: it plays forever" : "Looping off: it plays once", { quick: true }); });
    onionBtn = btn("onion", "", "Onion skin: see the frames before and after", () => GAS.onion.toggle(), "", "O");
    const onionCfg = btn("chevronDown", "", "Onion skin settings", (e) => openOnion(e.currentTarget), "is-narrow");
    const theater = btn("theater", "", "Watch it big (preview)", () => GAS.screens.theater());
    const setGroup = h("div", { class: "tl-group tl-set-group" }, fpsSel, speedSel, loopBtn, h("span", { class: "tl-onion" }, onionBtn, onionCfg), theater);
    setGroup._speed = speedSel;

    strip = h("div", { class: "tl-strip", role: "listbox", "aria-label": "Frames" });
    const bar = h("div", { class: "tl-bar" }, frameGroup, playGroup, setGroup);
    root.append(bar, strip);
    root._speed = speedSel;

    // Toasts float just above the bottom controls, whatever the screen size.
    new ResizeObserver(() => {
      const r = GAS.view.stage.getBoundingClientRect();
      document.documentElement.style.setProperty("--tl-h", Math.max(0, innerHeight - r.bottom) + "px");
    }).observe(GAS.view.stage);

    strip.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { strip.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });

    GAS.bus.on("project-loaded", () => { rebuild(true); syncButtons(); });
    GAS.bus.on("frames-changed", () => rebuild());
    GAS.bus.on("frame-selected", () => { syncSelected(); updateInfo(); });
    GAS.bus.on("frame-changed", (f) => { queueThumb(f.id); updateBadges(f); updateInfo(); });
    GAS.bus.on("canvas-resized", () => rebuild(true));
    GAS.bus.on("onion-changed", syncButtons);
    GAS.bus.on("frame-clipboard", syncButtons);
    GAS.bus.on("play-state", (on) => { syncButtons(); root.classList.toggle("is-playing", on); if (!on) syncSelected(); });
    GAS.bus.on("play-frame", (i) => {
      const f = state.project.frames[i];
      strip.querySelectorAll(".frame-tile.is-playhead").forEach((t) => t.classList.remove("is-playhead"));
      const t = f && tiles.get(f.id);
      if (t) { t.el.classList.add("is-playhead"); scrollIntoView(t.el); }
      frameLabel.textContent = `${i + 1} / ${state.project.frames.length}`;
    });
  }

  /* ---------- tiles ---------- */
  function thumbSize() {
    const p = state.project;
    const small = matchMedia("(max-width: 760px)").matches;
    const hh = small ? 50 : 66;
    return { w: Math.max(30, Math.round((hh * p.width) / p.height)), h: hh };
  }

  function makeTile(f) {
    const { w, h: hh } = thumbSize();
    const canvas = h("canvas", { class: "thumb", width: w * 2, height: hh * 2, style: { width: w + "px", height: hh + "px" } });
    const el = h("div", { class: "frame-tile", role: "option", tabindex: "0", dataset: { id: f.id } },
      h("div", { class: "thumb-wrap" }, canvas),
      h("span", { class: "frame-num" }),
      h("span", { class: "frame-badges" }));
    const t = { el, canvas, rev: -1 };
    setupTileEvents(el);
    return t;
  }

  function rebuild(resetThumbs) {
    const p = state.project;
    if (!p) return;
    if (resetThumbs) { tiles.clear(); strip.innerHTML = ""; }
    const seen = new Set();
    const frag = document.createDocumentFragment();
    p.frames.forEach((f, i) => {
      let t = tiles.get(f.id);
      if (!t) { t = makeTile(f); tiles.set(f.id, t); }
      t.el.querySelector(".frame-num").textContent = i + 1;
      t.el.dataset.index = i;
      seen.add(f.id);
      updateBadges(f, t);
      frag.appendChild(t.el);
      if (t.rev !== f.rev) queueThumb(f.id);
    });
    for (const id of Array.from(tiles.keys())) if (!seen.has(id)) tiles.delete(id);
    strip.innerHTML = "";
    strip.appendChild(frag);
    strip.appendChild(addTile());
    syncSelected();
    updateInfo();
  }

  function addTile() {
    const I = GAS.icons.svg;
    const { h: hh } = thumbSize();
    return h("div", { class: "frame-add", style: { height: hh + 28 + "px" } },
      h("button", { class: "add-half", type: "button", tip: "New blank frame", "aria-label": "New blank frame", onclick: () => { GAS.app.goToFrame(state.project.frames.length - 1); GAS.app.addFrame("blank"); } }, I("plus"), h("span", null, "Blank")),
      h("button", { class: "add-half is-dup", type: "button", tip: "New frame that copies the last one", "aria-label": "Copy last frame", onclick: () => { GAS.app.goToFrame(state.project.frames.length - 1); GAS.app.addFrame("copy"); } }, I("copy"), h("span", null, "Copy")));
  }

  function updateBadges(f, t) {
    t = t || tiles.get(f.id);
    if (!t) return;
    const b = t.el.querySelector(".frame-badges");
    b.innerHTML = "";
    if (f.sound) b.appendChild(h("span", { class: "badge badge-sound", title: GAS.audio.label(f.sound.ref) }, GAS.audio.emoji(f.sound.ref)));
    if ((f.hold || 1) > 1) b.appendChild(h("span", { class: "badge badge-hold" }, "×" + f.hold));
    if (f.id === (GAS.curFrame() || {}).id) holdBtn.querySelector(".tl-btn-label").textContent = "×" + (f.hold || 1);
  }

  function queueThumb(id) {
    thumbQueue.add(id);
    if (!thumbTimer) thumbTimer = setTimeout(drainThumbs, 120);
  }
  function drainThumbs() {
    thumbTimer = 0;
    const p = state.project;
    if (!p) return;
    const start = performance.now();
    // Current frame first, then whatever is waiting, a few at a time to keep things smooth.
    const ids = Array.from(thumbQueue);
    const curId = GAS.curFrame() && GAS.curFrame().id;
    ids.sort((a, b) => (a === curId ? -1 : b === curId ? 1 : 0));
    for (const id of ids) {
      thumbQueue.delete(id);
      const f = GAS.findFrame(id), t = tiles.get(id);
      if (!f || !t) continue;
      const ctx = ctxOf(t.canvas);
      ctx.clearRect(0, 0, t.canvas.width, t.canvas.height);
      GAS.render.renderFrame(ctx, p, f, { scale: t.canvas.width / p.width });
      t.rev = f.rev;
      if (performance.now() - start > 12) break;
    }
    if (thumbQueue.size) thumbTimer = setTimeout(drainThumbs, 16);
  }

  function syncSelected() {
    const cur = GAS.curFrame();
    for (const [id, t] of tiles) {
      const on = cur && id === cur.id;
      t.el.classList.toggle("is-current", on);
      t.el.setAttribute("aria-selected", on);
      t.el.classList.remove("is-playhead");
      if (on) { scrollIntoView(t.el); updateBadges(cur, t); }
    }
  }
  function scrollIntoView(el) {
    const r = el.getBoundingClientRect(), s = strip.getBoundingClientRect();
    if (r.left < s.left + 10) strip.scrollLeft -= s.left + 10 - r.left + 40;
    else if (r.right > s.right - 10) strip.scrollLeft += r.right - (s.right - 10) + 40;
  }
  function updateInfo() {
    const p = state.project;
    if (!p) return;
    frameLabel.textContent = `${state.cur + 1} / ${p.frames.length}`;
    frameLabel.dataset.tip = `Frame ${state.cur + 1} of ${p.frames.length} · ${GAS.anim.duration(p).toFixed(1)} seconds long`;
    const f = GAS.curFrame();
    if (f) holdBtn.querySelector(".tl-btn-label").textContent = "×" + (f.hold || 1);
  }

  function syncButtons() {
    const p = state.project;
    if (!p) return;
    playBtn.replaceChildren(GAS.icons.svg(state.playing ? "pause" : "play"));
    playBtn.dataset.tip = state.playing ? "Pause" : "Play your animation";
    playBtn.classList.toggle("is-active", state.playing);
    loopBtn.classList.toggle("is-active", p.loop);
    onionBtn.classList.toggle("is-active", p.onion.enabled);
    fpsSel.value = String(p.fps);
    if (!GAS.anim.FPS_CHOICES.includes(p.fps)) fpsSel.appendChild(h("option", { value: p.fps, selected: true }, p.fps + " fps"));
    root._speed.value = String(p.speed || 1);
    pasteBtn.disabled = !GAS.app.hasFrameClipboard;
    document.body.classList.toggle("onion-on", p.onion.enabled);
  }

  /* ---------- tile pointer handling: tap to select, drag to reorder ---------- */
  function setupTileEvents(el) {
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); GAS.app.goToFrame(+el.dataset.index); }
    });
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const from = +el.dataset.index;
      const sx = e.clientX, sy = e.clientY;
      let dragging = false, longTimer = 0, ghost = null, marker = null, target = from;
      const touch = e.pointerType === "touch";
      const startDrag = () => {
        dragging = true;
        el.setPointerCapture(e.pointerId);
        el.classList.add("is-dragging");
        ghost = el.cloneNode(true);
        ghost.classList.add("tile-ghost");
        const r = el.getBoundingClientRect();
        ghost.style.width = r.width + "px";
        document.body.appendChild(ghost);
        marker = h("div", { class: "drop-marker" });
        strip.appendChild(marker);
        if (navigator.vibrate) navigator.vibrate(15);
      };
      if (touch) longTimer = setTimeout(startDrag, 380);
      const move = (ev) => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
            if (touch) { clearTimeout(longTimer); cleanup(); return; } // finger is scrolling the strip
            startDrag();
          } else return;
        }
        ev.preventDefault();
        ghost.style.transform = `translate(${ev.clientX - 30}px, ${ev.clientY - 40}px) rotate(-4deg)`;
        // Auto-scroll near the edges.
        const s = strip.getBoundingClientRect();
        if (ev.clientX < s.left + 40) strip.scrollLeft -= 12;
        else if (ev.clientX > s.right - 40) strip.scrollLeft += 12;
        // Work out where it would land.
        const list = Array.from(strip.querySelectorAll(".frame-tile"));
        let idx = list.length;
        for (let i = 0; i < list.length; i++) {
          const r = list[i].getBoundingClientRect();
          if (ev.clientX < r.left + r.width / 2) { idx = i; break; }
        }
        target = idx > from ? idx - 1 : idx;
        const ref = list[idx] || list[list.length - 1];
        const rr = ref.getBoundingClientRect();
        const x = (list[idx] ? rr.left : rr.right) - s.left + strip.scrollLeft - 3;
        marker.style.transform = `translateX(${x}px)`;
      };
      const cleanup = () => {
        clearTimeout(longTimer);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        if (ghost) ghost.remove();
        if (marker) marker.remove();
        el.classList.remove("is-dragging");
      };
      const up = () => {
        const wasDragging = dragging;
        cleanup();
        if (wasDragging) { if (target !== from) GAS.app.moveFrame(from, target); }
        else GAS.app.goToFrame(+el.dataset.index);
      };
      const cancel = () => cleanup();
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
    });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  /* ---------- popovers ---------- */
  function openHold(e) {
    const f = GAS.curFrame();
    const content = h("div", { class: "pop-form" },
      h("p", { class: "pop-title" }, "Show frame " + (state.cur + 1) + " for…"),
      GAS.ui.segmented([1, 2, 3, 4, 6, 8].map((n) => ({ value: n, label: "×" + n })), f.hold || 1, (v) => { GAS.app.setHold(f, v); updateInfo(); }),
      h("p", { class: "hint" }, "×2 keeps this frame on screen twice as long. Great for pauses!"));
    GAS.ui.popover(e.currentTarget, content, { above: true });
  }
  function openOnion(anchor) {
    const o = state.project.onion;
    const content = h("div", { class: "pop-form onion-pop" },
      h("p", { class: "pop-title" }, "Onion skin"),
      GAS.ui.toggle("Show ghost frames", o.enabled, (v) => GAS.onion.toggle(v)),
      h("div", { class: "field" }, h("span", { class: "field-label" }, h("span", { class: "dot prev" }), "Frames before"),
        GAS.ui.segmented([0, 1, 2, 3].map((n) => ({ value: n, label: String(n) })), o.prev, (v) => GAS.onion.set({ prev: v, enabled: true }))),
      h("div", { class: "field" }, h("span", { class: "field-label" }, h("span", { class: "dot next" }), "Frames after"),
        GAS.ui.segmented([0, 1, 2, 3].map((n) => ({ value: n, label: String(n) })), o.next, (v) => GAS.onion.set({ next: v, enabled: true }))),
      GAS.ui.slider({ label: "How see-through", min: 10, max: 80, value: Math.round(o.opacity * 100), format: (v) => v + "%", onInput: (v) => GAS.onion.set({ opacity: v / 100 }) }),
      GAS.ui.toggle("Color them (pink before, blue after)", o.tint, (v) => GAS.onion.set({ tint: v })));
    GAS.ui.popover(anchor, content, { above: true });
  }

  /* Little bounce on a newly added frame. */
  function pulseFrame(i) {
    const f = state.project.frames[i];
    const t = f && tiles.get(f.id);
    if (t) { t.el.classList.remove("is-new"); void t.el.offsetWidth; t.el.classList.add("is-new"); }
  }

  GAS.timeline = { init, rebuild, syncButtons };
  GAS.ui.pulseFrame = pulseFrame;
})();
