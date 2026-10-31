/*
 * Input maps the keyboard and the on-screen buttons onto named actions. Game code
 * asks isDown("jump") or pressed("attack"), and never looks at raw events.
 */
(function (J) {
  const KEYS = {
    KeyA: "left", ArrowLeft: "left",
    KeyD: "right", ArrowRight: "right",
    KeyW: "up", ArrowUp: "up",
    KeyS: "down", ArrowDown: "down",
    Space: "jump",
    KeyJ: "attack",
    KeyK: "push",
    KeyL: "deflect",
    Escape: "pause",
    Enter: "confirm",
  };

  class Input {
    constructor() {
      this.down = {};
      this.justPressed = {};
      this.justReleased = {};
      this.onAnyPress = null;

      window.addEventListener("keydown", (event) => {
        const action = KEYS[event.code];
        if (!action) return;
        // Typing in the Jedi name box shouldn't move anything.
        if (event.target && event.target.tagName === "INPUT" && event.target.type === "text") return;
        if (!event.target.closest || !event.target.closest("button, input") || action === "pause") event.preventDefault();
        if (!event.repeat) this.set(action, true);
      });
      window.addEventListener("keyup", (event) => {
        const action = KEYS[event.code];
        if (action) this.set(action, false);
      });
      window.addEventListener("blur", () => this.releaseAll());
    }

    set(action, isDown) {
      if (isDown && !this.down[action]) {
        this.justPressed[action] = true;
        if (this.onAnyPress) this.onAnyPress(action);
      }
      if (!isDown && this.down[action]) this.justReleased[action] = true;
      this.down[action] = isDown;
    }

    isDown(action) { return !!this.down[action]; }
    pressed(action) { return !!this.justPressed[action]; }
    released(action) { return !!this.justReleased[action]; }

    // Called once per frame after the game has read this frame's presses.
    endFrame() {
      this.justPressed = {};
      this.justReleased = {};
    }

    releaseAll() {
      for (const action of Object.keys(this.down)) this.set(action, false);
    }

    // Wires the DOM buttons from index.html. Pointer events give real multi-touch.
    bindTouch(onPause) {
      const root = document.getElementById("touch");
      root.addEventListener("contextmenu", (event) => event.preventDefault());

      const pad = document.getElementById("touch-move");
      const leftBtn = pad.querySelector('[data-dir="left"]');
      const rightBtn = pad.querySelector('[data-dir="right"]');
      const pointers = new Map();
      const updatePad = () => {
        let left = false;
        let right = false;
        const middle = (leftBtn.getBoundingClientRect().right + rightBtn.getBoundingClientRect().left) / 2;
        // A thumb can slide between the two arrows without lifting.
        for (const x of pointers.values()) {
          if (x < middle) left = true;
          else right = true;
        }
        this.set("left", left);
        this.set("right", right);
        leftBtn.classList.toggle("on", left);
        rightBtn.classList.toggle("on", right);
      };
      pad.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        pad.setPointerCapture(event.pointerId);
        pointers.set(event.pointerId, event.clientX);
        updatePad();
      });
      pad.addEventListener("pointermove", (event) => {
        if (!pointers.has(event.pointerId)) return;
        pointers.set(event.pointerId, event.clientX);
        updatePad();
      });
      const lift = (event) => {
        pointers.delete(event.pointerId);
        updatePad();
      };
      pad.addEventListener("pointerup", lift);
      pad.addEventListener("pointercancel", lift);

      root.querySelectorAll("[data-action]").forEach((button) => {
        const action = button.dataset.action;
        const press = (event) => {
          event.preventDefault();
          button.setPointerCapture(event.pointerId);
          button.classList.add("on");
          this.set(action, true);
        };
        const release = () => {
          button.classList.remove("on");
          this.set(action, false);
        };
        button.addEventListener("pointerdown", press);
        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
      });

      document.getElementById("touch-pause").addEventListener("click", onPause);
    }
  }

  J.Input = Input;
})(window.JEDI);
