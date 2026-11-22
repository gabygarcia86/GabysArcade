/* Keyboard and multi-touch input, merged into one set of actions. */
(function (MQ) {
  const ACTIONS = ["left", "right", "up", "down", "jump", "attack", "force", "switch", "dodge"];
  const KEYS = {
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    Space: "jump",
    KeyJ: "attack",
    KeyK: "force",
    KeyL: "switch",
    ShiftLeft: "dodge", ShiftRight: "dodge",
  };
  const DOUBLE_TAP_MS = 250;
  const VIBRATE_MS = 8;
  const STICK_DEAD = 0.14;

  class InputManager {
    constructor() {
      this.held = {};
      this.queued = {};
      this.counts = {};
      this.keys = new Set();
      this.pointers = new Map();
      this.stick = { x: 0, y: 0 };
      this.resetStick = () => {};
      this.enabled = false;
      this.usingTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      this.onPause = () => {};
      this.onDeviceChange = () => {};
      this.lastTap = { action: "", at: -Infinity };
      this.tapDodge = 0;
      for (const action of ACTIONS) {
        this.held[action] = false;
        this.queued[action] = false;
        this.counts[action] = 0;
      }

      window.addEventListener("keydown", (event) => this.keyDown(event));
      window.addEventListener("keyup", (event) => this.keyUp(event));
      window.addEventListener("blur", () => this.clear());
      window.addEventListener("pointerdown", (event) => this.setTouch(event.pointerType === "touch"), true);
    }

    setTouch(on) {
      if (on === this.usingTouch) return;
      this.usingTouch = on;
      this.onDeviceChange(on);
    }

    keyDown(event) {
      // Escape works even while a menu is open.
      if (event.code === "Escape") {
        if (!event.repeat) this.onPause();
        event.preventDefault();
        return;
      }
      const action = KEYS[event.code];
      if (!action || !this.enabled || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      if (event.repeat || this.keys.has(event.code)) return;
      this.setTouch(false);
      this.keys.add(event.code);
      this.press(action);
    }

    keyUp(event) {
      if (!this.keys.delete(event.code)) return;
      this.release(KEYS[event.code]);
    }

    press(action) {
      if (this.counts[action]++ > 0) return;
      this.held[action] = true;
      this.queued[action] = true;
      if (action === "left" || action === "right") {
        const now = performance.now();
        if (this.lastTap.action === action && now - this.lastTap.at < DOUBLE_TAP_MS) {
          this.tapDodge = action === "left" ? -1 : 1;
          this.lastTap.action = "";
        } else {
          this.lastTap.action = action;
          this.lastTap.at = now;
        }
      }
    }

    release(action) {
      this.counts[action] = Math.max(0, this.counts[action] - 1);
      if (!this.counts[action]) this.held[action] = false;
    }

    // True once for each press.
    take(action) {
      if (!this.queued[action]) return false;
      this.queued[action] = false;
      return true;
    }

    // -1 or 1 after a double tap on a direction, otherwise 0.
    takeTapDodge() {
      const direction = this.tapDodge;
      this.tapDodge = 0;
      return direction;
    }

    axis() {
      return (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    }

    setEnabled(on) {
      if (on === this.enabled) return;
      this.enabled = on;
      this.clear();
    }

    clear() {
      this.keys.clear();
      this.tapDodge = 0;
      this.lastTap.action = "";
      for (const pointer of this.pointers.values()) pointer.element?.classList.remove("is-down");
      this.pointers.clear();
      this.resetStick();
      for (const action of ACTIONS) {
        this.held[action] = false;
        this.queued[action] = false;
        this.counts[action] = 0;
      }
    }

    /*
     * Binds a set of on-screen buttons. On a movement pad, pointers can slide between left and
     * right without lifting, and near misses still land on the closest movement button.
     */
    bindTouch(root) {
      const pad = root.querySelector("[data-move-pad]");
      const left = pad?.querySelector('[data-action="left"]');
      const right = pad?.querySelector('[data-action="right"]');

      const moveTarget = (event) => {
        const rect = pad.getBoundingClientRect();
        return event.clientX < rect.left + rect.width / 2 ? left : right;
      };

      const setTarget = (pointer, element) => {
        if (pointer.element === element) return;
        if (pointer.element) {
          this.release(pointer.element.dataset.action);
          pointer.element.classList.remove("is-down");
        }
        pointer.element = element;
        element.classList.add("is-down");
        this.press(element.dataset.action);
      };

      root.addEventListener("pointerdown", (event) => {
        const inPad = !!pad?.contains(event.target);
        const element = inPad ? moveTarget(event) : event.target.closest("[data-action]");
        if (!element || !this.enabled) return;
        event.preventDefault();
        const pointer = { element: null, slide: inPad };
        this.pointers.set(event.pointerId, pointer);
        try {
          root.setPointerCapture(event.pointerId);
        } catch (error) {
          // The pointer was already released.
        }
        setTarget(pointer, element);
        if (event.pointerType === "touch" && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(VIBRATE_MS);
      });

      root.addEventListener("pointermove", (event) => {
        const pointer = this.pointers.get(event.pointerId);
        if (pointer?.slide) setTarget(pointer, moveTarget(event));
      });

      const end = (event) => {
        const pointer = this.pointers.get(event.pointerId);
        if (!pointer) return;
        this.pointers.delete(event.pointerId);
        pointer.element.classList.remove("is-down");
        this.release(pointer.element.dataset.action);
      };
      root.addEventListener("pointerup", end);
      root.addEventListener("pointercancel", end);
      root.addEventListener("lostpointercapture", end);
      root.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    // The analog stick. It measures from the middle of its base, and takes one finger.
    bindStick(zone) {
      const base = zone.querySelector(".stick-base");
      const knob = zone.querySelector(".stick-knob");
      let finger = null;
      let cx = 0;
      let cy = 0;
      let radius = 1;

      const set = (x, y) => {
        this.stick.x = x;
        this.stick.y = y;
      };
      const move = (event) => {
        let x = (event.clientX - cx) / radius;
        let y = (event.clientY - cy) / radius;
        const length = Math.hypot(x, y);
        if (length > 1) {
          x /= length;
          y /= length;
        }
        knob.style.transform = `translate(${x * radius * 0.6}px, ${y * radius * 0.6}px)`;
        const reach = Math.min(1, length);
        if (reach < STICK_DEAD) set(0, 0);
        else {
          const ease = (reach - STICK_DEAD) / (1 - STICK_DEAD) / reach;
          set(x * ease, y * ease);
        }
      };
      this.resetStick = () => {
        finger = null;
        set(0, 0);
        knob.style.transform = "";
      };

      zone.addEventListener("pointerdown", (event) => {
        if (!this.enabled || finger !== null) return;
        event.preventDefault();
        event.stopPropagation();
        this.setTouch(event.pointerType === "touch");
        finger = event.pointerId;
        const rect = base.getBoundingClientRect();
        cx = rect.left + rect.width / 2;
        cy = rect.top + rect.height / 2;
        radius = (rect.width / 2) * 0.8;
        try {
          zone.setPointerCapture(event.pointerId);
        } catch (error) {
          // The pointer was already released.
        }
        move(event);
      });
      zone.addEventListener("pointermove", (event) => {
        if (event.pointerId === finger) move(event);
      });
      const end = (event) => {
        if (event.pointerId === finger) this.resetStick();
      };
      zone.addEventListener("pointerup", end);
      zone.addEventListener("pointercancel", end);
      zone.addEventListener("lostpointercapture", end);
      zone.addEventListener("contextmenu", (event) => event.preventDefault());
    }
  }

  MQ.InputManager = InputManager;
})(window.MQ);
