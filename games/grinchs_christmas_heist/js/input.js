/*
 * Keyboard and touch input, merged into one movement vector plus sneak and boost.
 * Touch uses pointer events tracked by pointerId, so the joystick and buttons work at
 * the same time with two thumbs. The joystick floats: it appears under the thumb.
 */
(function (G) {
  "use strict";

  const MOVE_KEYS = {
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
  };
  const STICK_RADIUS = 52;
  const DEADZONE = 0.14;

  class Input {
    constructor(settings) {
      this.settings = settings;
      this.held = { up: false, down: false, left: false, right: false };
      this.keySneak = false;
      this.touchSneak = false;
      this.boostPressed = false;
      this.pausePressed = false;
      this.enabled = false;
      this.stick = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
      this.sneakPointer = null;
      this.touchSeen = false;
      this.onTouchSeen = null;
      this.onFullscreenKey = null;
      this.onMuteKey = null;

      this.touchRoot = document.getElementById("touch");
      this.stickZone = this.touchRoot.querySelector(".stick-zone");
      this.stickBase = this.touchRoot.querySelector(".stick-base");
      this.stickKnob = this.touchRoot.querySelector(".stick-knob");
      this.sneakBtn = this.touchRoot.querySelector(".sneak-btn");
      this.boostBtn = this.touchRoot.querySelector(".boost-btn");

      this.bindKeyboard();
      this.bindTouch();
    }

    bindKeyboard() {
      window.addEventListener("keydown", (e) => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        const dir = MOVE_KEYS[e.code];
        if (dir) {
          this.held[dir] = true;
          if (this.enabled) e.preventDefault();
        } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
          this.keySneak = true;
        } else if (e.code === "Space") {
          if (this.enabled) e.preventDefault();
          if (!e.repeat) this.boostPressed = true;
        } else if (e.code === "Escape" || e.code === "KeyP") {
          if (!e.repeat) this.pausePressed = true;
        } else if (e.code === "KeyF") {
          if (!e.repeat && this.onFullscreenKey) this.onFullscreenKey();
        } else if (e.code === "KeyM") {
          if (!e.repeat && this.onMuteKey) this.onMuteKey();
        }
      });
      window.addEventListener("keyup", (e) => {
        const dir = MOVE_KEYS[e.code];
        if (dir) this.held[dir] = false;
        else if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keySneak = false;
      });
      // Keys held while the window loses focus would otherwise stay stuck down.
      window.addEventListener("blur", () => this.release());
    }

    bindTouch() {
      window.addEventListener(
        "pointerdown",
        (e) => {
          if (e.pointerType === "touch" && !this.touchSeen) {
            this.touchSeen = true;
            if (this.onTouchSeen) this.onTouchSeen();
          }
        },
        true,
      );

      const zone = this.stickZone;
      zone.addEventListener("pointerdown", (e) => {
        if (this.stick.id !== null) return;
        e.preventDefault();
        this.stick.id = e.pointerId;
        try {
          zone.setPointerCapture(e.pointerId);
        } catch (error) {
          // Capture can fail on some browsers; moves still arrive while over the zone.
        }
        const zoneRect = zone.getBoundingClientRect();
        const half = this.stickBase.offsetWidth / 2 || 64;
        const cx = G.clamp(e.clientX, zoneRect.left + half, zoneRect.right - half);
        const cy = G.clamp(e.clientY, zoneRect.top + half, zoneRect.bottom - half);
        this.stickBase.style.left = `${cx - zoneRect.left}px`;
        this.stickBase.style.top = `${cy - zoneRect.top}px`;
        this.stick.cx = cx;
        this.stick.cy = cy;
        zone.classList.add("active");
        this.moveStick(e.clientX, e.clientY);
      });
      zone.addEventListener("pointermove", (e) => {
        if (e.pointerId !== this.stick.id) return;
        e.preventDefault();
        this.moveStick(e.clientX, e.clientY);
      });
      const endStick = (e) => {
        if (e.pointerId !== this.stick.id) return;
        this.resetStick();
      };
      zone.addEventListener("pointerup", endStick);
      zone.addEventListener("pointercancel", endStick);
      zone.addEventListener("lostpointercapture", endStick);

      const sneak = this.sneakBtn;
      sneak.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (this.sneakPointer !== null) return;
        this.sneakPointer = e.pointerId;
        try {
          sneak.setPointerCapture(e.pointerId);
        } catch (error) {
          // See above.
        }
        this.touchSneak = true;
        sneak.classList.add("pressed");
      });
      const endSneak = (e) => {
        if (e.pointerId !== this.sneakPointer) return;
        this.sneakPointer = null;
        this.touchSneak = false;
        sneak.classList.remove("pressed");
      };
      sneak.addEventListener("pointerup", endSneak);
      sneak.addEventListener("pointercancel", endSneak);
      sneak.addEventListener("lostpointercapture", endSneak);

      const boost = this.boostBtn;
      boost.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.boostPressed = true;
        boost.classList.add("pressed");
      });
      const endBoost = () => boost.classList.remove("pressed");
      boost.addEventListener("pointerup", endBoost);
      boost.addEventListener("pointercancel", endBoost);
      boost.addEventListener("pointerleave", endBoost);

      // Stop the page itself from scrolling, zooming or showing a context menu mid-game.
      const stop = (e) => {
        if (e.target.closest && e.target.closest(".screen")) return;
        e.preventDefault();
      };
      document.addEventListener("touchmove", stop, { passive: false });
      document.addEventListener("gesturestart", (e) => e.preventDefault());
      document.addEventListener("dblclick", (e) => e.preventDefault());
      document.addEventListener("contextmenu", (e) => {
        if (!e.target.closest || !e.target.closest("input")) e.preventDefault();
      });
    }

    moveStick(px, py) {
      let dx = (px - this.stick.cx) / STICK_RADIUS;
      let dy = (py - this.stick.cy) / STICK_RADIUS;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.stick.x = dx;
      this.stick.y = dy;
      this.stickKnob.style.transform = `translate(${dx * STICK_RADIUS}px, ${dy * STICK_RADIUS}px)`;
    }

    resetStick() {
      this.stick.id = null;
      this.stick.x = 0;
      this.stick.y = 0;
      this.stickKnob.style.transform = "";
      this.stickZone.classList.remove("active");
      this.stickBase.style.left = "";
      this.stickBase.style.top = "";
    }

    // Movement as a vector of length 0..1. Keyboard diagonals are normalized.
    getMove() {
      let x = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
      let y = (this.held.down ? 1 : 0) - (this.held.up ? 1 : 0);
      if (x && y) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      const sl = Math.hypot(this.stick.x, this.stick.y);
      if (sl > DEADZONE) {
        const k = (sl - DEADZONE) / (1 - DEADZONE) / sl;
        x += this.stick.x * k;
        y += this.stick.y * k;
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    }

    sneakHeld() {
      return this.keySneak || this.touchSneak;
    }

    consumeBoost() {
      const b = this.boostPressed;
      this.boostPressed = false;
      return b;
    }

    consumePause() {
      const p = this.pausePressed;
      this.pausePressed = false;
      return p;
    }

    release() {
      this.held.up = this.held.down = this.held.left = this.held.right = false;
      this.keySneak = false;
      this.touchSneak = false;
      this.boostPressed = false;
      this.pausePressed = false;
      this.sneakPointer = null;
      this.sneakBtn.classList.remove("pressed");
      this.boostBtn.classList.remove("pressed");
      this.resetStick();
    }

    // Shows the on-screen controls while playing, following the "touch controls" setting.
    wantsTouch() {
      const pref = this.settings.touch;
      return pref === "on" || (pref === "auto" && (this.touchSeen || window.matchMedia("(pointer: coarse)").matches));
    }

    showTouch(playing) {
      this.touchRoot.hidden = !(this.wantsTouch() && playing);
    }

    setBoostReady(ready) {
      this.boostBtn.classList.toggle("cooling", !ready);
    }
  }

  G.Input = Input;
})(window.GH);
