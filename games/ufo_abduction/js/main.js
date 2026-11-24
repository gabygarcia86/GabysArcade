/*
 * Start-up: loads saved data, sizes the canvas to the screen, and runs the game loop.
 *
 * The view is always 720 units tall. Its width follows the screen's shape (420 to 1440
 * units), so phones in portrait see a narrower slice of the world instead of a tiny
 * letterboxed picture. In portrait with touch controls, the picture sits at the top and
 * the joystick and beam button get their own strip below it.
 */
(function (U) {
  "use strict";

  const MIN_VW = 420;
  const MAX_VW = 1440;
  const MAX_PIXELS = 2560 * 1440;
  const MAX_STEP = 1 / 30;

  const app = document.getElementById("app");
  const stage = document.getElementById("stage");
  const canvas = document.getElementById("game");
  const touchRoot = document.getElementById("touch");

  const storage = U.Storage;
  storage.load();
  const settings = storage.data.settings;
  const audio = U.Audio;
  audio.init(settings);
  const input = new U.Input(app, settings);
  const game = new U.Game(canvas, storage, audio, input);
  const ui = new U.UI(game, { storage, audio, input, relayout: resize, autoFullscreen, toggleFullscreen });
  game.ui = ui;

  input.onTouchSeen = () => {
    if (ui.current === "play") input.showTouch(true);
    resize();
  };

  function resize() {
    const screenW = app.clientWidth;
    const screenH = app.clientHeight;
    if (!screenW || !screenH) return;
    // The picture fits inside the safe area, so a notch can't cover it.
    const cs = getComputedStyle(app);
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const W = screenW - pl - pr;
    const H = screenH - pt - pb;
    const portrait = screenH > screenW;
    const touchShown = !touchRoot.hidden;
    const controlsH = portrait && touchShown ? U.clamp(H * 0.3, 190, 280) : 0;
    app.classList.toggle("portrait", portrait && touchShown);
    app.style.setProperty("--controls-h", `${controlsH + pb}px`);

    const availH = H - controlsH;
    let scale = availH / U.VH;
    let VW = W / scale;
    if (VW > MAX_VW) VW = MAX_VW;
    if (VW < MIN_VW) {
      VW = MIN_VW;
      scale = W / MIN_VW;
    }
    const cssW = VW * scale;
    const cssH = U.VH * scale;
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
    game.camX = U.clamp(game.camX, 0, Math.max(0, U.WORLD_W - VW));
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 120));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("webkitfullscreenchange", resize);
  if (window.ResizeObserver) {
    // Notch insets can change without a resize event, as when going full screen.
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

  function requestFullscreen() {
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) return; // iPhones only allow full screen video.
    // The prefixed version returns no promise. If refused, the game runs in the normal window.
    try {
      Promise.resolve(request.call(root, { navigationUI: "hide" })).catch(() => {});
    } catch (error) {
      // Some browsers throw instead of rejecting.
    }
  }

  // Set when the player turns full screen off in Settings, so taps stop turning it back on.
  let fullscreenOptOut = false;

  function autoFullscreen() {
    if (fullscreenOptOut) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    requestFullscreen();
  }

  function toggleFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      fullscreenOptOut = true;
      if (exit) Promise.resolve(exit.call(document)).catch(() => {});
    } else {
      fullscreenOptOut = false;
      requestFullscreen();
    }
  }

  // Phones and tablets go full screen on the first tap, and again on the next tap if the
  // browser drops out of it (a back swipe, a notification). Browsers only allow it in
  // response to a tap, so it can't happen before the player touches the screen.
  window.addEventListener("pointerup", autoFullscreen, true);
  window.addEventListener("touchend", autoFullscreen, true);

  // The canvas uses the arcade's Oxanium font. Load it before the first big titles.
  if (document.fonts && document.fonts.load) document.fonts.load("800 20px Oxanium").catch(() => {});

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    // A long gap (a hidden tab, a debugger) shouldn't fling everything across the map.
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;
    while (dt > 0) {
      const step = Math.min(dt, MAX_STEP);
      game.update(step);
      dt -= step;
    }
    game.render();
    requestAnimationFrame(frame);
  }

  resize();
  ui.showTitle();
  requestAnimationFrame(frame);

  U.game = game;
})(window.UFO);
