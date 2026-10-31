/*
 * InputManager turns the keyboard, the on-screen pad and swipes into direction presses.
 * GameManager reads `direction` every step and sets `onPress` for instant reactions, so
 * game code never looks at a raw event.
 */
(function (D) {
  const KEYS = {
    ArrowUp: D.UP, KeyW: D.UP,
    ArrowRight: D.RIGHT, KeyD: D.RIGHT,
    ArrowDown: D.DOWN, KeyS: D.DOWN,
    ArrowLeft: D.LEFT, KeyA: D.LEFT,
  };
  const SWIPE_MIN = 18; // CSS pixels.
  const PAD_DEAD_ZONE = 0.16; // Share of the pad's width, around its center.

  class InputManager {
    constructor() {
      this.held = []; // Directions being held. The newest press wins.
      this.padDir = -1;
      this.onPress = null; // (dir) when a direction is first pressed.
      this.onPause = null;
      this.onConfirm = null;

      window.addEventListener("keydown", (event) => {
        if (event.code === "Escape") {
          event.preventDefault();
          if (!event.repeat && this.onPause) this.onPause();
          return;
        }
        if (event.code === "Enter" || event.code === "NumpadEnter") {
          if (!event.repeat && this.onConfirm && this.onConfirm(event)) event.preventDefault();
          return;
        }
        const dir = KEYS[event.code];
        if (dir === undefined) return;
        if (event.target && event.target.tagName === "INPUT" && dir % 2 === 1) return; // Sliders.
        event.preventDefault();
        if (event.repeat) return;
        if (!this.held.includes(dir)) this.held.push(dir);
        if (this.onPress) this.onPress(dir);
      });
      window.addEventListener("keyup", (event) => {
        const dir = KEYS[event.code];
        if (dir !== undefined) this.held = this.held.filter((d) => d !== dir);
      });
      window.addEventListener("blur", () => this.releaseAll());
    }

    // The direction being held right now, or -1.
    get direction() {
      if (this.padDir >= 0) return this.padDir;
      return this.held.length ? this.held[this.held.length - 1] : -1;
    }

    releaseAll() {
      this.held.length = 0;
      this.setPad(-1);
    }

    setPad(dir) {
      if (dir === this.padDir) return;
      this.padDir = dir;
      if (this.padArrows) this.padArrows.forEach((el, i) => el.classList.toggle("on", i === dir));
      if (dir >= 0 && this.onPress) this.onPress(dir);
    }

    // The pad reads the angle from its center, so a thumb can slide around without lifting.
    bindPad(pad) {
      this.padArrows = [...pad.querySelectorAll("[data-dir]")].sort((a, b) => a.dataset.dir - b.dataset.dir);
      pad.addEventListener("contextmenu", (event) => event.preventDefault());
      let active = null;
      const read = (event) => {
        const box = pad.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height / 2);
        if (Math.hypot(dx, dy) < box.width * PAD_DEAD_ZONE) return;
        if (Math.abs(dx) > Math.abs(dy)) this.setPad(dx > 0 ? D.RIGHT : D.LEFT);
        else this.setPad(dy > 0 ? D.DOWN : D.UP);
      };
      pad.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        active = event.pointerId;
        pad.setPointerCapture(active);
        read(event);
      });
      pad.addEventListener("pointermove", (event) => {
        if (event.pointerId === active) read(event);
      });
      const lift = (event) => {
        if (event.pointerId !== active) return;
        active = null;
        this.setPad(-1);
      };
      pad.addEventListener("pointerup", lift);
      pad.addEventListener("pointercancel", lift);
    }

    // Swiping across the game view also steers, for players who prefer it to the pad.
    bindSwipe(surface) {
      let startX = 0;
      let startY = 0;
      let tracking = false;
      surface.addEventListener("pointerdown", (event) => {
        startX = event.clientX;
        startY = event.clientY;
        tracking = true;
      });
      surface.addEventListener("pointermove", (event) => {
        if (!tracking) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
        if (this.onPress) {
          if (Math.abs(dx) > Math.abs(dy)) this.onPress(dx > 0 ? D.RIGHT : D.LEFT);
          else this.onPress(dy > 0 ? D.DOWN : D.UP);
        }
        startX = event.clientX;
        startY = event.clientY;
      });
      const stop = () => { tracking = false; };
      surface.addEventListener("pointerup", stop);
      surface.addEventListener("pointercancel", stop);
    }
  }

  D.InputManager = InputManager;
})(window.DROID);
