/* Onion skin: faint copies of the frames before (pink) and after (blue) the current one,
 * drawn underneath the current drawing so you can see where things move. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, ctxOf } = GAS;

  const PREV_TINT = "#ff3d7f";
  const NEXT_TINT = "#1f8fff";
  let scratch = null;

  function ghost(ctx, frame, alpha, tint) {
    const p = state.project;
    if (!scratch || scratch.width !== p.width || scratch.height !== p.height) scratch = GAS.makeCanvas(p.width, p.height);
    const s = ctxOf(scratch);
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.clearRect(0, 0, p.width, p.height);
    GAS.render.renderFrame(s, p, frame, { bg: false });
    if (tint) {
      s.globalCompositeOperation = "source-atop";
      s.globalAlpha = 0.6;
      s.fillStyle = tint;
      s.fillRect(0, 0, p.width, p.height);
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(scratch, 0, 0);
    ctx.restore();
  }

  function render(ctx) {
    const p = state.project;
    if (!p || !p.onion.enabled) return;
    const o = p.onion, frames = p.frames, cur = state.cur;
    // Farthest first, so the nearest ghost sits on top.
    for (let i = o.next; i >= 1; i--) {
      const f = frames[cur + i];
      if (f) ghost(ctx, f, o.opacity * (1 - (i - 1) / (o.next + 1)) * 0.85, o.tint ? NEXT_TINT : null);
    }
    for (let i = o.prev; i >= 1; i--) {
      const f = frames[cur - i];
      if (f) ghost(ctx, f, o.opacity * (1 - (i - 1) / (o.prev + 1)), o.tint ? PREV_TINT : null);
    }
  }

  function toggle(force) {
    const p = state.project;
    if (!p) return;
    p.onion.enabled = force == null ? !p.onion.enabled : !!force;
    GAS.view.refreshOnion();
    GAS.bus.emit("onion-changed", p.onion);
    GAS.bus.emit("dirty");
  }

  function set(changes) {
    Object.assign(state.project.onion, changes);
    GAS.view.refreshOnion();
    GAS.bus.emit("onion-changed", state.project.onion);
    GAS.bus.emit("dirty");
  }

  GAS.onion = { render, toggle, set, PREV_TINT, NEXT_TINT };
})();
