/*
 * Start-up: loads saved data, sizes the canvas to the screen, handles full screen, and
 * runs the game loop.
 *
 * The view is always 720 units tall. Its width follows the screen's shape (420 to 1440
 * units). In portrait with touch controls, the picture sits at the top and the joystick
 * and buttons get their own strip below it.
 */
(function (G) {
  "use strict";

  const MIN_VW = 420;
  const MAX_VW = 1440;
  const MAX_PIXELS = 2560 * 1440;
  const MAX_STEP = 1 / 60;

  const app = document.getElementById("app");
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  const touchRoot = document.getElementById("touch");

  const storage = G.Storage;
  storage.load();
  const settings = storage.data.settings;
  const audio = G.Audio;
  audio.init(settings);
  const input = new G.Input(settings);
  const game = new G.Game(canvas, storage, audio, input);

  // ---------------------------------------------------------------- Full screen

  let optOut = false; // set when the player leaves full screen themselves

  const fs = {
    supported() {
      const root = document.documentElement;
      return !!(root.requestFullscreen || root.webkitRequestFullscreen);
    },
    isOn() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    },
    enter() {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request || this.isOn()) return;
      try {
        // The prefixed version returns no promise. If refused, the game runs in the window.
        Promise.resolve(request.call(root, { navigationUI: "hide" })).catch(() => {});
      } catch (error) {
        // Some browsers throw instead of rejecting.
      }
    },
    exit() {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && this.isOn()) Promise.resolve(exit.call(document)).catch(() => {});
    },
    // Called when a heist starts (always from a click or tap, which browsers require).
    auto() {
      if (!settings.fullscreen) return;
      optOut = false;
      this.enter();
    },
    toggle() {
      if (this.isOn()) {
        optOut = true;
        this.exit();
      } else {
        optOut = false;
        this.enter();
      }
    },
  };

  const ui = new G.UI(game, { storage, audio, input, relayout: resize, fullscreen: fs });
  game.ui = ui;

  input.onTouchSeen = () => {
    if (ui.current === "play") input.showTouch(true);
    resize();
  };
  input.onFullscreenKey = () => fs.toggle();
  input.onMuteKey = () => {
    audio.setMuted(!settings.muted);
    storage.save();
    if (ui.current === "title") ui.showTitle();
  };

  // Phones sometimes drop out of full screen (a swipe, a notification). While a heist is on,
  // the next tap puts it back, unless the player turned it off.
  const reFullscreen = () => {
    if (optOut || !settings.fullscreen) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (game.state !== "play" && game.state !== "ready" && game.state !== "intro") return;
    fs.enter();
  };
  window.addEventListener("pointerup", reFullscreen, true);
  window.addEventListener("touchend", reFullscreen, true);

  // ---------------------------------------------------------------- Sizing

  function resize() {
    const screenW = app.clientWidth;
    const screenH = app.clientHeight;
    if (!screenW || !screenH) return;
    const cs = getComputedStyle(app);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const W = screenW - pl - pr;
    const H = screenH - pt - pb;
    const portrait = screenH > screenW;
    const touchShown = !touchRoot.hidden;
    const controlsH = portrait && touchShown ? G.clamp(H * 0.3, 180, 270) : 0;
    app.classList.toggle("portrait", portrait && touchShown);
    app.style.setProperty("--controls-h", `${controlsH + pb}px`);

    const availH = H - controlsH;
    let scale = availH / G.VH;
    let VW = W / scale;
    if (VW > MAX_VW) VW = MAX_VW;
    if (VW < MIN_VW) {
      VW = MIN_VW;
      scale = W / MIN_VW;
    }
    const cssW = VW * scale;
    const cssH = G.VH * scale;
    const left = pl + (W - cssW) / 2;
    const top = pt + (controlsH ? Math.max(0, (availH - cssH) / 2) : (H - cssH) / 2);
    Object.assign(stage.style, { width: `${cssW}px`, height: `${cssH}px`, left: `${left}px`, top: `${top}px` });

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let bw = Math.round(cssW * dpr);
    let bh = Math.round(cssH * dpr);
    if (bw * bh > MAX_PIXELS) {
      const k = Math.sqrt(MAX_PIXELS / (bw * bh));
      bw = Math.round(bw * k);
      bh = Math.round(bh * k);
    }
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    game.VW = VW;
    game.pxScale = bw / VW;
    // The pause button is 46px plus a 10px margin, measured in screen pixels.
    game.rightInset = 64 / scale;
    if (game.world) game.updateCamera(1);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("webkitfullscreenchange", resize);
  if (window.ResizeObserver) {
    const observer = new ResizeObserver(resize);
    observer.observe(app);
    observer.observe(document.getElementById("safe-corner"));
  }

  // Pause when the player switches tabs or apps.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      game.pause();
      if (audio.ctx && audio.ctx.state === "running") audio.ctx.suspend().catch(() => {});
    } else if (audio.ctx && audio.ctx.state === "suspended") {
      audio.ctx.resume().catch(() => {});
    }
  });
  window.addEventListener("blur", () => game.pause());
  window.addEventListener("pagehide", () => storage.save());

  if (document.fonts && document.fonts.load) document.fonts.load("800 20px Oxanium").catch(() => {});

  // ---------------------------------------------------------------- Loop

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    // A long gap (a hidden tab, a debugger) shouldn't fling everything across the map.
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    try {
      while (dt > 0) {
        const step = Math.min(dt, MAX_STEP);
        game.update(step);
        dt -= step;
      }
      game.render();
    } catch (error) {
      // Report once and keep the loop alive rather than freezing the page.
      if (!frame.reported) {
        frame.reported = true;
        console.error(error);
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  ui.showTitle();
  requestAnimationFrame(frame);

  G.game = game;
  G.ui = ui;
})(window.GH);
