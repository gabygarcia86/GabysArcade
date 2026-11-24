/*
 * Keyboard and touch input, merged into one movement vector and one beam switch.
 * Touch uses pointer events tracked by pointerId, so the joystick and the beam button
 * work at the same time with two thumbs.
 */
(function (U) {
  "use strict";

  const MOVE_KEYS = {
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
  };
  const STICK_RADIUS = 54;
  const DEADZONE = 0.12;

  class Input {
    constructor(app, settings) {
      this.app = app;
      this.settings = settings;
      this.held = { up: false, down: false, left: false, right: false };
      this.keyBeam = false;
      this.touchBeam = false;
      this.toggled = false;
      this.pausePressed = false;
      this.enabled = false; // true while a level is being played
      this.stick = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
      this.beamPointer = null;
      this.touchSeen = false;
      this.onTouchSeen = null;

      this.touchRoot = document.getElementById("touch");
      this.stickZone = this.touchRoot.querySelector(".stick-zone");
      this.stickBase = this.touchRoot.querySelector(".stick-base");
      this.stickKnob = this.touchRoot.querySelector(".stick-knob");
      this.beamZone = this.touchRoot.querySelector(".beam-zone");
      this.beamBtn = this.touchRoot.querySelector(".beam-btn");

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
        } else if (e.code === "Space") {
          if (this.enabled) e.preventDefault();
          if (!e.repeat) {
            this.keyBeam = true;
            if (this.settings.beamMode === "toggle") this.toggled = !this.toggled;
          }
        } else if (e.code === "Escape" || e.code === "KeyP") {
          if (!e.repeat) this.pausePressed = true;
        }
      });
      window.addEventListener("keyup", (e) => {
        const dir = MOVE_KEYS[e.code];
        if (dir) this.held[dir] = false;
        else if (e.code === "Space") this.keyBeam = false;
      });
      // Keys held while the window loses focus would otherwise stay stuck down.
      window.addEventListener("blur", () => this.release());
    }

    bindTouch() {
      // Any touch anywhere turns on the on-screen controls in "auto" mode.
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
        const baseRect = this.stickBase.getBoundingClientRect();
        if (this.settings.stick === "floating") {
          // The stick jumps to the thumb, kept fully inside the zone.
          const half = baseRect.width / 2;
          const cx = U.clamp(e.clientX, zoneRect.left + half, zoneRect.right - half);
          const cy = U.clamp(e.clientY, zoneRect.top + half, zoneRect.bottom - half);
          this.stickBase.style.left = `${cx - zoneRect.left}px`;
          this.stickBase.style.right = "auto";
          this.stickBase.style.top = `${cy - zoneRect.top}px`;
          this.stickBase.style.margin = `-${half}px 0 0 -${half}px`;
          this.stick.cx = cx;
          this.stick.cy = cy;
        } else {
          this.stick.cx = baseRect.left + baseRect.width / 2;
          this.stick.cy = baseRect.top + baseRect.height / 2;
        }
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

      const beam = this.beamZone;
      beam.addEventListener("pointerdown", (e) => {
        if (this.beamPointer !== null) return;
        e.preventDefault();
        this.beamPointer = e.pointerId;
        try {
          beam.setPointerCapture(e.pointerId);
        } catch (error) {
          // See above.
        }
        this.touchBeam = true;
        if (this.settings.beamMode === "toggle") this.toggled = !this.toggled;
        this.updateBeamButton();
      });
      const endBeam = (e) => {
        if (e.pointerId !== this.beamPointer) return;
        this.beamPointer = null;
        this.touchBeam = false;
        this.updateBeamButton();
      };
      beam.addEventListener("pointerup", endBeam);
      beam.addEventListener("pointercancel", endBeam);
      beam.addEventListener("lostpointercapture", endBeam);

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
      if (this.settings.stick === "floating") this.placeStickHome();
    }

    placeStickHome() {
      this.stickBase.style.left = "";
      this.stickBase.style.right = "";
      this.stickBase.style.top = "";
      this.stickBase.style.margin = "";
    }

    updateBeamButton() {
      const on = this.settings.beamMode === "toggle" ? this.toggled : this.touchBeam;
      this.beamBtn.classList.toggle("pressed", on);
    }

    setBeamDisabled(disabled) {
      this.beamBtn.classList.toggle("disabled", disabled);
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
        // Rescale so the stick ramps up smoothly from the edge of the deadzone.
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

    beamHeld() {
      if (this.settings.beamMode === "toggle") return this.toggled;
      return this.keyBeam || this.touchBeam;
    }

    consumePause() {
      const p = this.pausePressed;
      this.pausePressed = false;
      return p;
    }

    release() {
      this.held.up = this.held.down = this.held.left = this.held.right = false;
      this.keyBeam = false;
      this.touchBeam = false;
      this.toggled = false;
      this.pausePressed = false;
      this.beamPointer = null;
      this.resetStick();
      this.updateBeamButton();
    }

    // Shows or hides the on-screen controls following the "touch controls" setting.
    showTouch(playing) {
      const pref = this.settings.touch;
      const want = pref === "on" || (pref === "auto" && (this.touchSeen || window.matchMedia("(pointer: coarse)").matches));
      this.touchRoot.hidden = !(want && playing);
      this.touchRoot.classList.toggle("left-handed", !!this.settings.leftHanded);
      return want;
    }
  }

  U.Input = Input;
})(window.UFO);
