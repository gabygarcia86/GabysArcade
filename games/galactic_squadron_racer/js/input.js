/**
 * Keyboard, gamepad and touch input, merged into one set of race controls.
 *
 * Keyboard steering ramps in over ~0.13 s so a tap gives a small correction
 * and a hold gives a full turn. Analog input (stick, gamepad) is used as is.
 * Steering sensitivity from the settings scales the final value.
 *
 * Touch: a floating stick (or ◀ ▶ buttons) on the left, ACCEL / BRAKE /
 * BOOST on the right, plus a reset button that appears when you're stuck.
 */
import { CONFIG } from './config.js';
import { clamp } from './utils.js';

const SCHEMES = {
  both: { up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], boost: ['Space', 'ShiftLeft', 'ShiftRight'] },
  wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], boost: ['Space'] },
  arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], boost: ['ShiftLeft', 'ShiftRight'] },
};
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight']);

const isFormControl = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');

export class Input {
  constructor() {
    this.keys = new Set();
    this.kbSteer = 0;
    this.stick = { id: null, x0: 0, y0: 0, x: 0, active: false, value: 0 };
    this.held = { accel: new Set(), brake: new Set(), boost: new Set(), left: new Set(), right: new Set() };
    this.out = { throttle: 0, brake: 0, steer: 0, boost: false };
    this.usingTouch = false;
  }

  attach(game, ui) {
    this.game = game;
    this.ui = ui;
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());

    const tc = ui.touchControls;
    const bind = (el, set) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        set.add(e.pointerId);
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          /* optional */
        }
        el.classList.add('active');
        this.markTouch(e);
      });
      const up = (e) => {
        set.delete(e.pointerId);
        if (!set.size) el.classList.remove('active');
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
    };
    bind(ui.el('#btn-accel'), this.held.accel);
    bind(ui.el('#btn-brake'), this.held.brake);
    bind(ui.el('#btn-boost'), this.held.boost);
    bind(ui.el('#btn-left'), this.held.left);
    bind(ui.el('#btn-right'), this.held.right);
    ui.el('#btn-reset')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.requestReset();
    });

    const zone = ui.el('#stick-zone');
    zone.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null || this.game.settings.touchSteer !== 'stick') return;
      e.preventDefault();
      this.stick.id = e.pointerId;
      this.stick.x0 = e.clientX;
      this.stick.y0 = e.clientY;
      this.stick.x = e.clientX;
      this.stick.active = true;
      try {
        zone.setPointerCapture(e.pointerId);
      } catch {
        /* optional */
      }
      this.markTouch(e);
      ui.showStick(e.clientX, e.clientY, 0);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      e.preventDefault();
      const R = 56;
      let dx = e.clientX - this.stick.x0;
      // re-anchor if the thumb drifts far so reversing stays immediate
      if (Math.abs(dx) > R * 1.6) {
        this.stick.x0 = e.clientX - Math.sign(dx) * R * 1.6;
        dx = e.clientX - this.stick.x0;
      }
      this.stick.x = e.clientX;
      const v = clamp(dx / R, -1, 1);
      this.stick.value = Math.abs(v) < 0.08 ? 0 : v;
      ui.showStick(this.stick.x0, this.stick.y0, clamp(dx, -R, R));
    });
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null;
      this.stick.active = false;
      this.stick.value = 0;
      ui.hideStick();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);

    for (const el of [ui.canvas, tc]) el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.markTouch(e);
    }, { passive: true, capture: true });
  }

  markTouch(e) {
    if (e.pointerType === 'mouse') return;
    if (!this.usingTouch) {
      this.usingTouch = true;
      this.ui.setTouchMode(true);
    }
  }

  reset() {
    this.keys.clear();
    for (const s of Object.values(this.held)) s.clear();
    this.stick.id = null;
    this.stick.value = 0;
    this.kbSteer = 0;
    this.ui?.hideStick();
  }

  onKeyDown(e) {
    const code = e.code;
    const inRace = this.game.isRacing();
    const focused = document.activeElement;
    if (GAME_KEYS.has(code) && (inRace || !isFormControl(focused))) {
      if (inRace) e.preventDefault();
    }
    if (!inRace && isFormControl(focused) && code !== 'Escape') return;
    this.keys.add(code);
    if (e.repeat) return;
    if (this.usingTouch && code.startsWith('Key')) {
      this.usingTouch = false;
      this.ui.setTouchMode(false);
    }
    if (code === 'Escape' || code === 'KeyP') this.game.requestAction('escape');
    else if (code === 'KeyM') this.game.toggleMute();
    else if (code === 'KeyR' && inRace) this.game.requestReset();
    else if (code === 'Enter') this.game.requestAction('confirm');
  }

  any(codes) {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  /** Current controls for the player's racer. */
  read(dt, settings) {
    const sc = SCHEMES[settings.keyboard] || SCHEMES.both;
    const P = CONFIG.physics;
    const o = this.out;

    // keyboard
    const kl = this.any(sc.left) || this.held.left.size > 0;
    const kr = this.any(sc.right) || this.held.right.size > 0;
    const kdir = (kr ? 1 : 0) - (kl ? 1 : 0);
    if (kdir !== 0) {
      if (Math.sign(this.kbSteer) !== kdir && this.kbSteer !== 0) this.kbSteer = 0; // reversing: snap through center
      this.kbSteer = clamp(this.kbSteer + kdir * P.keyboardSteerRise * dt, -1, 1);
    } else {
      const f = P.keyboardSteerFall * dt;
      this.kbSteer = Math.abs(this.kbSteer) <= f ? 0 : this.kbSteer - Math.sign(this.kbSteer) * f;
    }
    let throttle = this.any(sc.up) || this.held.accel.size > 0 ? 1 : 0;
    let brake = this.any(sc.down) || this.held.brake.size > 0 ? 1 : 0;
    let boost = this.any(sc.boost) || this.held.boost.size > 0;
    let steer = this.kbSteer;

    if (this.stick.active) steer = this.stick.value;
    if (this.usingTouch && settings.autoAccel && !brake) throttle = 1;
    // the touch BOOST button also accelerates: one thumb can't hold ACCEL and BOOST together
    if (this.held.boost.size > 0) throttle = 1;

    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer = ax;
      const rt = gp.buttons[7]?.value || 0;
      const lt = gp.buttons[6]?.value || 0;
      if (rt > 0.05 || gp.buttons[0]?.pressed) throttle = Math.max(throttle, gp.buttons[0]?.pressed ? 1 : rt);
      if (lt > 0.05 || gp.buttons[1]?.pressed) brake = Math.max(brake, gp.buttons[1]?.pressed ? 1 : lt);
      if (gp.buttons[2]?.pressed || gp.buttons[5]?.pressed) boost = true;
      if (gp.buttons[9]?.pressed && !this.padStart) this.game.requestAction('escape');
      this.padStart = !!gp.buttons[9]?.pressed;
      break;
    }

    o.throttle = throttle;
    o.brake = brake;
    o.steer = steer * settings.steering;
    o.boost = boost;
    return o;
  }
}
