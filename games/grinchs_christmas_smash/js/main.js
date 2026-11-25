/*
 * Start-up: loads saved data, sizes the canvas to the screen, handles full screen, wires
 * up the mouse, touch and keyboard, and runs the game loop.
 *
 * The canvas always fills the screen. The game keeps its whole 1920 x 1080 stage in view
 * at the same proportions (so the physics never stretches), and the extra room on taller
 * or wider screens just shows more sky and snow.
 */
(function (G) {
  "use strict";

  const app = document.getElementById("app");
  const canvas = document.getElementById("game");
  const rotateHint = document.getElementById("rotate-hint");

  const storage = G.Storage;
  storage.load();
  const settings = storage.data.settings;
  const audio = G.Audio;
  audio.init(settings);
  const game = new G.Game(canvas, storage, audio);

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
        Promise.resolve(request.call(root, { navigationUI: "hide" }))
          .then(() => {
            // Prefer landscape on phones, where the browser allows it.
            if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
          })
          .catch(() => {});
      } catch (error) {
        // Some browsers throw instead of rejecting.
      }
    },
    exit() {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit && this.isOn()) Promise.resolve(exit.call(document)).catch(() => {});
    },
    // Called from a click or tap (browsers only allow full screen then).
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

  const ui = new G.UI(game, { storage, audio, fullscreen: fs });
  game.ui = ui;

  // Phones sometimes drop out of full screen (a swipe, a notification). During a level, the
  // next tap puts it back, unless the player turned it off.
  const reFullscreen = () => {
    if (optOut || !settings.fullscreen || fs.isOn()) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (game.state !== "play" && game.state !== "intro") return;
    fs.enter();
  };
  window.addEventListener("pointerup", reFullscreen, true);

  // ---------------------------------------------------------------- Sizing

  // Notches and rounded corners: a hidden probe element is padded by the safe-area insets.
  const probe = document.getElementById("safe-probe");
  function readSafe() {
    const cs = getComputedStyle(probe);
    return {
      t: parseFloat(cs.paddingTop) || 0,
      r: parseFloat(cs.paddingRight) || 0,
      b: parseFloat(cs.paddingBottom) || 0,
      l: parseFloat(cs.paddingLeft) || 0,
    };
  }

  function resize() {
    const w = app.clientWidth;
    const h = app.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Very large screens don't need every pixel; cap the canvas size for speed.
    const k = Math.min(1, Math.sqrt((2560 * 1440) / (w * h * dpr * dpr)));
    game.resize(w, h, dpr * k, readSafe());
    const portrait = h > w * 1.05 && window.matchMedia("(pointer: coarse)").matches;
    rotateHint.hidden = !portrait;
  }

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 150));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", resize);
  document.addEventListener("webkitfullscreenchange", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(app);

  // ---------------------------------------------------------------- Pointer input

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button > 0) return;
    const p = pos(e);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (error) {
      // Capture isn't essential.
    }
    game.pointerDown(e.pointerId, p.x, p.y);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = pos(e);
    game.pointerMove(e.pointerId, p.x, p.y);
  });
  const up = (e) => {
    const p = pos(e);
    game.pointerMove(e.pointerId, p.x, p.y);
    game.pointerUp(e.pointerId);
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", (e) => {
    if (game.aim && game.aim.id === e.pointerId) game.cancelAim();
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------------------------------------------------------------- Keyboard

  window.addEventListener("keydown", (e) => {
    const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA");
    if (typing) return;
    const key = e.key;
    if (key === "Escape" || key === "p" || key === "P") {
      if (game.state === "play" || game.state === "intro") {
        game.pause();
      } else if (game.state === "paused" && ui.current === "pause") {
        game.resume();
      } else {
        ui.back();
      }
      e.preventDefault();
    } else if (key === "r" || key === "R") {
      if (game.state === "play" || game.state === "intro" || (game.state === "paused" && ui.current === "pause")) game.restartLevel();
    } else if (key === "m" || key === "M") {
      audio.setMuted(!settings.muted);
      storage.save();
      if (ui.current === "title") ui.showTitle();
    } else if (key === "f" || key === "F") {
      fs.toggle();
    } else if (key === " ") {
      if (game.state === "play" && game.shot === "flying") {
        game.triggerSpecial();
        e.preventDefault();
      }
    } else if (/^[1-9]$/.test(key) && game.state === "play") {
      game.selectAmmo(Number(key) - 1);
    }
  });

  // Pause when the player switches tabs or apps.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      game.pause();
      if (audio.ctx && audio.ctx.state === "running") audio.ctx.suspend().catch(() => {});
    } else if (audio.ctx && audio.ctx.state === "suspended") {
      audio.ctx.resume().catch(() => {});
    }
  });
  window.addEventListener("pagehide", () => storage.save());

  if (document.fonts && document.fonts.load) {
    document.fonts.load("800 20px Oxanium").then(() => G.Art.clearSprites()).catch(() => {});
  }

  // ---------------------------------------------------------------- Loop

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    // A long gap (a hidden tab, a debugger) shouldn't fling everything across the stage.
    if (dt > 0.1) dt = 0.1;
    if (dt < 0) dt = 0;
    try {
      game.update(dt);
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
  ui.showSplash();
  requestAnimationFrame(frame);

  G.game = game;
  G.ui = ui;
})(window.GS);
