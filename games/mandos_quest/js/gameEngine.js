/* The frame loop, Canvas scaling and page-level events. */
(function (MQ) {
  const { clamp } = MQ.U;
  const STATE = MQ.GameStateManager.STATE;
  const MAX_FRAME = 0.1;
  const MAX_WIDTH = { high: 1920, low: 960 };
  const COMMON_RATES = [30, 60, 120];
  const PAUSE_BUTTON_SPACE = 64; // CSS pixels kept clear for the pause button.

  class GameEngine {
    constructor() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.app = document.getElementById("app");
      this.stage = document.getElementById("stage");
      this.touch = document.getElementById("touch");
      this.spaceTouch = document.getElementById("space-touch");
      this.pauseButton = document.getElementById("pause");
      this.cinematicControls = document.getElementById("cinematic-controls");
      this.accumulator = 0;
      this.last = 0;

      const saveManager = new MQ.SaveManager();
      const progression = new MQ.ProgressionManager(saveManager);
      const customization = new MQ.Customization(saveManager);
      const audio = new MQ.AudioManager(() => saveManager.data.settings);
      this.input = new MQ.InputManager();
      this.input.bindTouch(this.touch);
      this.input.bindTouch(this.spaceTouch);
      this.input.bindStick(this.spaceTouch.querySelector(".space-stick"));

      this.states = new MQ.GameStateManager({
        saveManager, progression, customization, audio,
        input: this.input,
        uiRoot: document.getElementById("ui"),
        onChange: () => this.syncControls(),
      });
      this.input.onDeviceChange = () => this.syncControls();
      this.bindEvents();
      this.bindMenuAntics();
    }

    bindEvents() {
      const resize = () => this.resize();
      window.addEventListener("resize", resize);
      window.visualViewport?.addEventListener("resize", resize);
      document.addEventListener("fullscreenchange", resize);
      // Notch insets can change without a resize event, as when going full screen. #safe-corner
      // catches a half turn, which moves the notch but leaves #app's usable size the same.
      const safeArea = new ResizeObserver(resize);
      safeArea.observe(this.app);
      safeArea.observe(document.getElementById("safe-corner"));

      window.addEventListener("blur", () => this.states.pause());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.states.pause();
        this.last = 0;
      });

      this.pauseButton.addEventListener("click", () => this.states.pause());
      document.getElementById("cinematic-next").addEventListener("click", () => this.states.cinematic.next());
      document.getElementById("cinematic-skip").addEventListener("click", () => this.states.cinematic.skip());
      this.stage.addEventListener("pointerdown", () => {
        if (this.states.state === STATE.CINEMATIC) this.states.cinematic.next();
        else if (this.states.state === STATE.PLAYING) this.states.world.skipIntro();
      });
      window.addEventListener("keydown", (event) => {
        // A focused Skip or Next button already handles Space and Enter itself.
        if (this.states.state !== STATE.CINEMATIC || event.repeat || event.target.closest?.("button")) return;
        if (event.code === "Space" || event.code === "Enter" || event.code === "KeyJ") {
          event.preventDefault();
          this.states.cinematic.next();
        }
      });
      // Safari ignores user-scalable=no.
      document.addEventListener("gesturestart", (event) => event.preventDefault());
      document.addEventListener("dblclick", (event) => {
        if (event.target.closest("#touch, #space-touch, #stage")) event.preventDefault();
      });
    }

    /*
     * The menu's HTML covers the Canvas, so the easter eggs listen on it. They use click,
     * as pointerdown would also fire when scrolling the menu.
     */
    bindMenuAntics() {
      const ui = document.getElementById("ui");
      const heroAt = (event) => {
        const { states } = this;
        if (states.state !== STATE.MENU || states.ui.current?.name !== "main") return null;
        if (event.target.closest?.("button, a")) return null;
        const rect = this.stage.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * MQ.VW;
        const y = ((event.clientY - rect.top) / rect.height) * MQ.VH;
        if (x < 0 || x > MQ.VW || y < 0 || y > MQ.VH) return null;
        return states.antics.hit(x, y);
      };
      ui.addEventListener("click", (event) => {
        const who = heroAt(event);
        if (who) this.states.antics.poke(who);
      });
      ui.addEventListener("pointermove", (event) => {
        ui.classList.toggle("over-hero", event.pointerType === "mouse" && !!heroAt(event));
      });
      ui.addEventListener("pointerleave", () => ui.classList.remove("over-hero"));
    }

    syncControls() {
      const { state } = this.states;
      const preference = this.states.save.settings.touch;
      const playing = state === STATE.PLAYING;
      const touchWanted = preference === "on" || (preference === "auto" && this.input.usingTouch);

      const inSpace = this.states.world?.mode === "space";
      this.touch.hidden = !(playing && touchWanted && !inSpace);
      this.spaceTouch.hidden = !(playing && touchWanted && inSpace);
      this.pauseButton.hidden = !playing;
      this.cinematicControls.hidden = state !== STATE.CINEMATIC;
      this.app.dataset.state = state;
      this.app.classList.toggle("touch-mode", touchWanted);
      this.resize();
    }

    resize() {
      const screenWidth = this.app.clientWidth;
      const screenHeight = this.app.clientHeight;
      if (!screenWidth || !screenHeight) return;
      // The picture fits inside the safe area, so a notch can't cover it.
      const safe = getComputedStyle(this.app);
      const safeLeft = parseFloat(safe.paddingLeft);
      const safeTop = parseFloat(safe.paddingTop);
      const width = screenWidth - safeLeft - parseFloat(safe.paddingRight);
      const height = screenHeight - safeTop - parseFloat(safe.paddingBottom);

      const scale = Math.min(width / MQ.VW, height / MQ.VH);
      const cssWidth = MQ.VW * scale;
      const cssHeight = MQ.VH * scale;
      const left = (width - cssWidth) / 2;
      // In portrait the picture moves up, leaving room for the controls below it.
      const spare = height - cssHeight;
      const portrait = screenHeight > screenWidth;
      const top = portrait && this.app.classList.contains("touch-mode") ? Math.min(spare * 0.2, 72) : spare / 2;
      Object.assign(this.stage.style, {
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
        left: `${safeLeft + left}px`,
        top: `${safeTop + top}px`,
      });

      const effects = this.states.save.settings.effects;
      const backing = Math.round(Math.min(cssWidth * (window.devicePixelRatio || 1), MAX_WIDTH[effects]));
      const backingHeight = Math.round((backing * MQ.VH) / MQ.VW);
      if (this.canvas.width !== backing || this.canvas.height !== backingHeight) {
        this.canvas.width = backing;
        this.canvas.height = backingHeight;
      }

      // Keep the HUD readable on small screens, and clear of the pause button.
      const { hud } = this.states;
      hud.scale = clamp(0.8 / scale, 1, 1.5);
      const buttonReaches = top < 56;
      hud.rightInset = buttonReaches ? Math.max(12, (PAUSE_BUTTON_SPACE - left) / scale) : 12;

      // Measured after the stage moves, as the touch controls can overlap it.
      const stageLeft = safeLeft + left;
      const stageTop = safeTop + top;
      const shown = [this.touch, this.spaceTouch].filter((el) => !el.hidden);
      const controls = shown.flatMap((el) => [...el.querySelectorAll(".touch-btn, .stick-base")]);
      const buttons = controls.map((el) => el.getBoundingClientRect());
      const smallOrTouch = hud.crowded || this.input.usingTouch || this.app.classList.contains("touch-mode");
      hud.notices.layout(
        { left: stageLeft, right: stageLeft + cssWidth, bottom: stageTop + cssHeight },
        { left: safeLeft, right: safeLeft + width, bottom: safeTop + height },
        buttons,
        smallOrTouch,
      );
      this.states.spaceUI.layout(
        { left: stageLeft, right: stageLeft + cssWidth, top: stageTop },
        this.spaceTouch.hidden ? [] : controls,
      );
    }

    start() {
      this.states.showMenu();
      this.resize();
      document.fonts?.load(`700 20px "Oxanium"`).catch(() => {});
      requestAnimationFrame((time) => this.frame(time));
    }

    frame(now) {
      requestAnimationFrame((time) => this.frame(time));
      let dt = this.last ? (now - this.last) / 1000 : 1 / 60;
      this.last = now;
      dt = clamp(dt, 0, MAX_FRAME);
      // Snap tiny timer jitter to the display's rate, for smooth scrolling.
      for (const rate of COMMON_RATES) {
        if (Math.abs(dt - 1 / rate) < 0.0007) dt = 1 / rate;
      }

      this.accumulator += dt;
      while (this.accumulator >= MQ.STEP - 1e-7) {
        this.accumulator -= MQ.STEP;
        this.states.step(MQ.STEP);
      }
      this.states.frame(dt);

      const { ctx, canvas } = this;
      ctx.setTransform(canvas.width / MQ.VW, 0, 0, canvas.height / MQ.VH, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      this.states.hud.notices.clear();
      this.states.draw(ctx);
    }
  }

  MQ.GameEngine = GameEngine;
})(window.MQ);
