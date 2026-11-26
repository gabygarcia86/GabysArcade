/*
 * Input: rebindable keyboard, gamepad, and on-screen touch controls (a joystick and
 * buttons that can be dragged and resized). Everything becomes the same set of
 * actions, polled once per game step.
 */
(function (XM) {
  "use strict";

  const ACTIONS = ["left", "right", "up", "down", "jump", "dodge", "attack", "special", "ultimate", "interact", "pause", "info"];
  const LABELS = {
    left: "Move Left",
    right: "Move Right",
    up: "Aim Up / Climb",
    down: "Crouch / Drop / Climb Down",
    jump: "Jump",
    dodge: "Dodge",
    attack: "Basic Attack",
    special: "Special Ability",
    ultimate: "Ultimate Attack",
    interact: "Interact",
    pause: "Pause",
    info: "Character Info",
  };
  // Default touch layout: control centers as a share of the screen.
  const TOUCH_DEFAULTS = {
    stick: { x: 0.12, y: 0.72 },
    jump: { x: 0.27, y: 0.86 },
    attack: { x: 0.88, y: 0.8 },
    special: { x: 0.76, y: 0.88 },
    ultimate: { x: 0.9, y: 0.56 },
    dodge: { x: 0.76, y: 0.66 },
    interact: { x: 0.64, y: 0.86 },
  };

  const Input = {
    ACTIONS,
    LABELS,
    TOUCH_DEFAULTS,
    keysDown: new Set(),
    hits: {},
    down: {},
    prev: {},
    touch: {},
    stick: { x: 0, y: 0, id: null },
    gameActive: false,
    captureCb: null,
    touchVisible: false,
    editing: false,
    usingTouch: false,
    axis: 0,

    init() {
      ACTIONS.forEach((a) => {
        this.down[a] = false;
        this.prev[a] = false;
        this.hits[a] = false;
        this.touch[a] = false;
      });
      window.addEventListener("keydown", (e) => this.onKey(e, true));
      window.addEventListener("keyup", (e) => this.onKey(e, false));
      window.addEventListener("blur", () => this.clear());
      this.usingTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
      window.addEventListener("touchstart", () => {
        if (!this.usingTouch) {
          this.usingTouch = true;
          this.refreshTouch();
        }
      }, { passive: true });
      this.setupTouch();
    },

    bindings() {
      return XM.Save.data.settings.keys;
    },

    actionForCode(code) {
      const keys = this.bindings();
      for (const a of ACTIONS) if (keys[a][0] === code || keys[a][1] === code) return a;
      return null;
    },

    onKey(e, isDown) {
      if (this.captureCb && isDown) {
        e.preventDefault();
        const cb = this.captureCb;
        this.captureCb = null;
        cb(e.code === "Escape" ? null : e.code);
        return;
      }
      const action = this.actionForCode(e.code);
      if (isDown) this.keysDown.add(e.code);
      else this.keysDown.delete(e.code);
      if (action && this.gameActive) {
        e.preventDefault();
        if (isDown && !e.repeat) this.hits[action] = true;
      } else if (e.code === "Tab" && this.gameActive) e.preventDefault();
      if (isDown && !e.repeat && this.onAnyKey) this.onAnyKey(e);
    },

    clear() {
      this.keysDown.clear();
      ACTIONS.forEach((a) => (this.touch[a] = false));
      this.stick.x = this.stick.y = 0;
    },

    // Waits for the next key for rebinding. Escape cancels.
    capture(cb) {
      this.captureCb = cb;
    },

    poll() {
      const keys = this.bindings();
      const pad = this.readGamepad();
      for (const a of ACTIONS) {
        this.prev[a] = this.down[a];
        const k = keys[a];
        this.down[a] = this.keysDown.has(k[0]) || this.keysDown.has(k[1]) || this.touch[a] || !!pad[a];
      }
      const sx = Math.abs(this.stick.x) > 0.3 ? this.stick.x : 0;
      const px = pad.axis || 0;
      this.axis = (this.down.right ? 1 : 0) - (this.down.left ? 1 : 0);
      if (sx) this.axis = XM.U.clamp(sx * 1.4, -1, 1);
      else if (px) this.axis = px;
      this.pressedNow = {};
      for (const a of ACTIONS) {
        this.pressedNow[a] = (this.down[a] && !this.prev[a]) || this.hits[a];
        this.hits[a] = false;
      }
    },

    pressed(a) {
      return !!(this.pressedNow && this.pressedNow[a]);
    },

    held(a) {
      return this.down[a];
    },

    readGamepad() {
      const out = {};
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const p = pads && Array.from(pads).find((g) => g && g.connected);
      if (!p) return out;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0;
      const ay = p.axes[1] || 0;
      out.left = b(14) || ax < -0.4;
      out.right = b(15) || ax > 0.4;
      out.up = b(12) || ay < -0.55;
      out.down = b(13) || ay > 0.55;
      out.jump = b(0);
      out.dodge = b(1) || b(6);
      out.attack = b(2);
      out.special = b(3);
      out.ultimate = b(5) || b(7);
      out.interact = b(4);
      out.pause = b(9);
      out.info = b(8);
      if (Math.abs(ax) > 0.25) out.axis = ax;
      if (this.onPad && (out.jump || out.pause)) this.onPad(out);
      return out;
    },

    // ---------- Touch controls ----------
    setupTouch() {
      this.root = document.getElementById("touch");
      if (!this.root) return;
      const stickEl = this.root.querySelector('[data-ctl="stick"]');
      const knob = stickEl.querySelector(".t-knob");
      const moveStick = (e) => {
        const r = stickEl.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        let dx = (e.clientX - cx) / (r.width / 2);
        let dy = (e.clientY - cy) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          dx /= len;
          dy /= len;
        }
        this.stick.x = dx;
        this.stick.y = dy;
        knob.style.transform = `translate(${dx * 38}%, ${dy * 38}%)`;
        this.touch.left = dx < -0.3;
        this.touch.right = dx > 0.3;
        this.touch.up = dy < -0.55;
        this.touch.down = dy > 0.6;
      };
      const releaseStick = () => {
        this.stick.id = null;
        this.stick.x = this.stick.y = 0;
        knob.style.transform = "";
        this.touch.left = this.touch.right = this.touch.up = this.touch.down = false;
      };
      stickEl.addEventListener("pointerdown", (e) => {
        if (this.editing) return;
        e.preventDefault();
        this.stick.id = e.pointerId;
        stickEl.setPointerCapture(e.pointerId);
        moveStick(e);
      });
      stickEl.addEventListener("pointermove", (e) => {
        if (this.stick.id === e.pointerId) moveStick(e);
      });
      stickEl.addEventListener("pointerup", releaseStick);
      stickEl.addEventListener("pointercancel", releaseStick);

      this.root.querySelectorAll("[data-action]").forEach((btn) => {
        const action = btn.dataset.action;
        const on = (e) => {
          if (this.editing) return;
          e.preventDefault();
          if (!this.touch[action]) this.hits[action] = true;
          this.touch[action] = true;
          btn.classList.add("on");
          try {
            btn.setPointerCapture(e.pointerId);
          } catch (error) {
            /* older browsers */
          }
        };
        const off = () => {
          this.touch[action] = false;
          btn.classList.remove("on");
        };
        btn.addEventListener("pointerdown", on);
        btn.addEventListener("pointerup", off);
        btn.addEventListener("pointercancel", off);
        btn.addEventListener("lostpointercapture", off);
        btn.addEventListener("contextmenu", (e) => e.preventDefault());
      });

      // Dragging controls while the layout editor is open.
      this.root.querySelectorAll(".t-ctl").forEach((el) => {
        el.addEventListener("pointerdown", (e) => {
          if (!this.editing) return;
          e.preventDefault();
          el.setPointerCapture(e.pointerId);
          const move = (ev) => {
            const x = XM.U.clamp(ev.clientX / window.innerWidth, 0.04, 0.96);
            const y = XM.U.clamp(ev.clientY / window.innerHeight, 0.08, 0.95);
            this.editLayout[el.dataset.ctl] = { x, y };
            this.place(el, x, y);
          };
          const up = () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", up);
          };
          el.addEventListener("pointermove", move);
          el.addEventListener("pointerup", up);
        });
      });
      window.addEventListener("resize", () => this.applyLayout());
      this.applyLayout();
    },

    place(el, x, y) {
      el.style.left = x * 100 + "%";
      el.style.top = y * 100 + "%";
    },

    layout() {
      const saved = (XM.Save.data && XM.Save.data.settings.touch.layout) || {};
      const out = {};
      for (const k of Object.keys(TOUCH_DEFAULTS)) {
        const s = saved[k];
        out[k] = s && Number.isFinite(s.x) && Number.isFinite(s.y) ? s : TOUCH_DEFAULTS[k];
      }
      return this.editing ? Object.assign(out, this.editLayout) : out;
    },

    applyLayout() {
      if (!this.root || !XM.Save.data) return;
      const t = XM.Save.data.settings.touch;
      this.root.style.setProperty("--t-size", t.size);
      this.root.style.setProperty("--t-opacity", t.opacity);
      const lay = this.layout();
      this.root.querySelectorAll(".t-ctl").forEach((el) => {
        const p = lay[el.dataset.ctl];
        if (p) this.place(el, p.x, p.y);
      });
    },

    showTouch(show) {
      this.touchVisible = show;
      this.refreshTouch();
    },

    refreshTouch() {
      if (!this.root) return;
      const want = (this.touchVisible || this.editing) && (this.usingTouch || XM.Save.data.settings.touch.forceShow || this.editing);
      this.root.hidden = !want;
      if (!want) this.clear();
    },

    setInteractVisible(show) {
      const el = this.root && this.root.querySelector('[data-ctl="interact"]');
      if (el && !this.editing) el.classList.toggle("ghost", !show);
    },

    startEdit() {
      this.editing = true;
      this.editLayout = {};
      this.root.classList.add("editing");
      this.applyLayout();
      this.refreshTouch();
    },

    endEdit(save) {
      if (save) {
        XM.Save.data.settings.touch.layout = Object.assign({}, this.layout());
        XM.Save.write();
      }
      this.editing = false;
      this.root.classList.remove("editing");
      this.applyLayout();
      this.refreshTouch();
    },

    resetLayout() {
      XM.Save.data.settings.touch.layout = {};
      this.editLayout = {};
      XM.Save.write();
      this.applyLayout();
    },

    keyName(code) {
      if (!code) return "—";
      if (code.startsWith("Key")) return code.slice(3);
      if (code.startsWith("Digit")) return code.slice(5);
      const names = { Space: "Space", ShiftLeft: "L-Shift", ShiftRight: "R-Shift", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc", ControlLeft: "L-Ctrl", ControlRight: "R-Ctrl", AltLeft: "L-Alt", AltRight: "R-Alt", Enter: "Enter", Tab: "Tab" };
      return names[code] || code;
    },
  };

  XM.Input = Input;
})(window.XM);
