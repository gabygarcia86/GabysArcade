/*
 * Core: the XM namespace, shared helpers, the fixed-step game loop and the canvas
 * that scales to any screen. Plain scripts (not ES modules) so the game also runs
 * when index.html is opened straight from disk.
 */
(function () {
  "use strict";
  const XM = (window.XM = window.XM || {});

  XM.T = 40; // tile size in world pixels
  XM.VIEW = { w: 960, h: 540 }; // logical view; width follows the screen's shape
  XM.DEBUG = /[?&]debug\b/.test(location.search);

  const U = (XM.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    approach(v, target, step) {
      return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
    },
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (list) => list[Math.floor(Math.random() * list.length)],
    sign: (v) => (v < 0 ? -1 : 1),
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    easeOut: (t) => 1 - (1 - t) * (1 - t),
    easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    fmt: (n) => Math.floor(n).toLocaleString("en-US"),
    time(sec) {
      sec = Math.max(0, Math.floor(sec));
      return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    },
    // Small seeded random generator so level art and music stay the same every visit.
    rng(seed) {
      let s = seed >>> 0 || 1;
      return function () {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    escape(text) {
      return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    },
    // Word-wraps text for canvas drawing and returns the lines.
    wrap(ctx, text, maxWidth) {
      const words = String(text).split(/\s+/);
      const lines = [];
      let line = "";
      for (const word of words) {
        const test = line ? line + " " + word : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      if (line) lines.push(line);
      return lines;
    },
  });

  // Fixed 60 Hz simulation with an accumulator, so speed is the same at any frame rate.
  class Engine {
    constructor(canvas, hooks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.hooks = hooks;
      this.step = 1 / 60;
      this.acc = 0;
      this.last = 0;
      this.running = false;
      this.fps = 60;
      this.frames = 0;
      this.fpsTime = 0;
      this.pixelRatio = 1;
      this.quality = "high";
      this.frame = this.frame.bind(this);
      this.resize = this.resize.bind(this);
      window.addEventListener("resize", this.resize);
      window.addEventListener("orientationchange", () => setTimeout(this.resize, 200));
      document.addEventListener("fullscreenchange", this.resize);
      this.resize();
    }

    setQuality(quality) {
      this.quality = quality;
      this.resize();
    }

    resize() {
      const w = window.innerWidth || 960;
      const h = window.innerHeight || 540;
      const aspect = w / h;
      XM.VIEW.h = 540;
      XM.VIEW.w = Math.round(U.clamp(540 * aspect, 720, 1280));
      const maxRatio = this.quality === "low" ? 1 : this.quality === "medium" ? 1.5 : 2;
      const ratio = Math.min(window.devicePixelRatio || 1, maxRatio);
      // Fit the logical view into the window, letterboxing only past the aspect limits.
      const scale = Math.min(w / XM.VIEW.w, h / XM.VIEW.h);
      const cssW = Math.round(XM.VIEW.w * scale);
      const cssH = Math.round(XM.VIEW.h * scale);
      this.canvas.style.width = cssW + "px";
      this.canvas.style.height = cssH + "px";
      this.canvas.width = Math.round(cssW * ratio);
      this.canvas.height = Math.round(cssH * ratio);
      this.scale = (cssW * ratio) / XM.VIEW.w;
      this.cssScale = scale;
      this.ctx.imageSmoothingEnabled = true;
      if (this.hooks.resize) this.hooks.resize();
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.frame);
    }

    stop() {
      this.running = false;
    }

    frame(now) {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25; // tab was in the background
      this.acc += dt;
      let steps = 0;
      while (this.acc >= this.step && steps < 5) {
        this.hooks.update(this.step);
        this.acc -= this.step;
        steps++;
      }
      if (steps === 5) this.acc = 0;
      this.frames++;
      this.fpsTime += dt;
      if (this.fpsTime >= 1) {
        this.fps = Math.round(this.frames / this.fpsTime);
        this.frames = 0;
        this.fpsTime = 0;
      }
      const ctx = this.ctx;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.hooks.render(ctx, this.acc / this.step);
      requestAnimationFrame(this.frame);
    }
  }
  XM.Engine = Engine;
})();
