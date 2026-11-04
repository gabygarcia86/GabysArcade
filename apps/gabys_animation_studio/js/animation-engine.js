/* Playback. A Player draws frames onto a canvas at the right speed, playing frame sounds as it goes.
 * The editor uses one for the Play button; previews and the export window use their own. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, ctxOf } = GAS;

  const FPS_CHOICES = [1, 2, 4, 6, 8, 10, 12, 15, 24, 30];
  const SPEEDS = [0.5, 1, 2];

  /* Milliseconds a frame stays on screen. */
  const frameMs = (project, frame, fps, speed) => ((frame.hold || 1) * 1000) / ((fps || project.fps) * (speed || 1));

  class Player {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.opts = opts; // {project, fps?, loop?, speed?, sound?, onFrame?, onEnd?, bg?}
      this.i = 0;
      this.raf = 0;
      this.running = false;
    }
    get project() { return this.opts.project || state.project; }
    render() {
      const p = this.project, f = p.frames[this.i];
      const ctx = ctxOf(this.canvas);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (this.opts.matte) { ctx.fillStyle = this.opts.matte; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
      ctx.restore();
      if (f) GAS.render.renderFrame(ctx, p, f, { scale: this.canvas.width / p.width });
    }
    show(i) {
      const p = this.project;
      this.i = Math.max(0, Math.min(p.frames.length - 1, i));
      this.render();
      const f = p.frames[this.i];
      if (this.running && this.opts.sound !== false && f && f.sound) GAS.audio.play(f.sound.ref, f.sound.volume);
      if (this.opts.onFrame) this.opts.onFrame(this.i);
    }
    start(from = 0) {
      this.stop();
      this.running = true;
      this.acc = 0;
      this.last = 0;
      this.show(from);
      const tick = (now) => {
        if (!this.running) return;
        if (!this.last) this.last = now;
        this.acc += Math.min(250, now - this.last);
        this.last = now;
        const p = this.project;
        let guard = 0;
        while (this.running && this.acc >= frameMs(p, p.frames[this.i], this.opts.fps, this.opts.speed) && guard++ < 10) {
          this.acc -= frameMs(p, p.frames[this.i], this.opts.fps, this.opts.speed);
          let next = this.i + 1;
          if (next >= p.frames.length) {
            const loop = this.opts.loop != null ? this.opts.loop : p.loop;
            if (!loop) { this.stop(); if (this.opts.onEnd) this.opts.onEnd(); return; }
            next = 0;
          }
          this.show(next);
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    stop() {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }

  /* ---------- editor playback ---------- */
  let player = null;

  function play() {
    const p = state.project;
    if (!p || state.playing) return;
    GAS.selection.deselect();
    GAS.tools.cancel();
    const v = GAS.view.views.play;
    v.width = p.width;
    v.height = p.height;
    state.playing = true;
    GAS.view.stage.classList.add("is-playing");
    let from = state.cur;
    if (!p.loop && from >= p.frames.length - 1) from = 0;
    player = new Player(v, {
      project: p,
      speed: p.speed,
      onFrame: (i) => GAS.bus.emit("play-frame", i),
      onEnd: () => pause(),
    });
    player.start(from);
    GAS.view.refreshOnion();
    GAS.view.queueOverlay();
    GAS.bus.emit("play-state", true);
  }

  function pause() {
    if (!state.playing) return;
    const i = player ? player.i : state.cur;
    if (player) player.stop();
    player = null;
    state.playing = false;
    GAS.view.stage.classList.remove("is-playing");
    GAS.bus.emit("play-state", false);
    GAS.app.goToFrame(i);
  }

  function stop() {
    if (state.playing) pause();
    GAS.app.goToFrame(0);
  }

  const toggle = () => (state.playing ? pause() : play());

  /* Total running time in seconds (one loop). */
  function duration(project, fps) {
    return project.frames.reduce((s, f) => s + frameMs(project, f, fps, 1), 0) / 1000;
  }

  GAS.anim = { FPS_CHOICES, SPEEDS, Player, frameMs, play, pause, stop, toggle, duration };
})();
