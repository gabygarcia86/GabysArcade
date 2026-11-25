// Keyboard (rebindable), multitouch buttons and optional tilt steering, merged into one state.
import { TRICK_INPUTS } from './data.js';

export const ACTIONS = [
  { id: 'accel', name: 'Accelerate' }, { id: 'brake', name: 'Brake / Reverse' },
  { id: 'left', name: 'Steer Left' }, { id: 'right', name: 'Steer Right' },
  { id: 'boost', name: 'Boost' }, { id: 'jump', name: 'Jump / Pro Trick' },
  { id: 'backflip', name: 'Backflip' }, { id: 'frontflip', name: 'Frontflip' },
  { id: 'rollLeft', name: 'Barrel Roll Left' }, { id: 'rollRight', name: 'Barrel Roll Right' },
  { id: 'spin', name: '360 Spin' }, { id: 'superman', name: 'Superman' },
  { id: 'noHander', name: 'No-Hander' }, { id: 'oneHander', name: 'One-Hander' },
  { id: 'camera', name: 'Change Camera' }, { id: 'pause', name: 'Pause' },
];

export const DEFAULT_KEYS = {
  accel: ['KeyW', 'ArrowUp'], brake: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  boost: ['ShiftLeft', 'ShiftRight'], jump: ['Space'], backflip: ['KeyQ'], frontflip: ['KeyE'],
  rollLeft: ['KeyZ'], rollRight: ['KeyX'], spin: ['KeyR'], superman: ['KeyF'], noHander: ['KeyC'], oneHander: ['KeyV'],
  camera: ['KeyT'], pause: ['Escape', 'KeyP'],
};

export function keyLabel(code) {
  if (!code) return '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'Shift', ShiftRight: 'R-Shift', Space: 'Space', Escape: 'Esc', ControlLeft: 'Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'Alt', Enter: 'Enter', Tab: 'Tab' };
  return map[code] || code;
}

export class Input {
  constructor(save) {
    this.save = save;
    this.down = new Set();
    this.touch = new Set();
    this.pressed = new Set(); // edge-triggered actions this frame
    this.tilt = 0;
    this.tiltEnabled = false;
    this.capture = null; // rebinding callback
    this.onPause = null;
    this.usingTouch = false;
    this.keys = { ...DEFAULT_KEYS, ...(save.settings.keys || {}) };
    this.codeMap = new Map();
    this.rebuild();

    window.addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const act = this.codeMap.get(e.code);
      if (act) {
        if (this.gameActive || act === 'pause') e.preventDefault();
        if (!this.down.has(act)) this.pressed.add(act);
        this.down.add(act);
        if (act === 'pause' && this.onPause) this.onPause();
      }
    });
    window.addEventListener('keyup', (e) => {
      const act = this.codeMap.get(e.code);
      if (act) this.down.delete(act);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.touch.clear(); });
    this.bindTouch();
  }

  rebuild() {
    this.codeMap.clear();
    for (const [act, codes] of Object.entries(this.keys)) for (const c of codes) if (c) this.codeMap.set(c, act);
  }

  setKey(action, slot, code) {
    // Remove the code from any other action first.
    for (const [act, codes] of Object.entries(this.keys)) {
      this.keys[act] = codes.map((c) => (c === code ? '' : c));
    }
    const list = (this.keys[action] || []).slice();
    list[slot] = code;
    this.keys[action] = list;
    this.save.settings.keys = this.keys;
    this.save.save();
    this.rebuild();
  }

  resetKeys() {
    this.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    this.save.settings.keys = null;
    this.save.save();
    this.rebuild();
  }

  bindTouch() {
    const root = document.getElementById('touch');
    const active = new Map(); // pointerId -> action
    const press = (btn, id) => {
      const act = btn.dataset.key;
      active.set(id, act);
      if (!this.touch.has(act)) this.pressed.add(act);
      this.touch.add(act);
      btn.classList.add('on');
    };
    const release = (id) => {
      const act = active.get(id);
      if (!act) return;
      active.delete(id);
      if (![...active.values()].includes(act)) {
        this.touch.delete(act);
        root.querySelectorAll(`[data-key="${act}"]`).forEach((b) => b.classList.remove('on'));
      }
    };
    root.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('[data-key]');
      if (!btn) return;
      e.preventDefault();
      this.usingTouch = true;
      try { btn.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      press(btn, e.pointerId);
    });
    // Sliding a finger between buttons (e.g. left to right steering) switches the action.
    root.addEventListener('pointermove', (e) => {
      if (!active.has(e.pointerId)) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const btn = el && el.closest && el.closest('#touch [data-key]');
      const cur = active.get(e.pointerId);
      if (btn && btn.dataset.key !== cur) { release(e.pointerId); press(btn, e.pointerId); }
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      root.addEventListener(ev, (e) => { if (ev !== 'pointerleave' || e.pointerType !== 'mouse') release(e.pointerId); });
    }
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('touchstart', () => { this.usingTouch = true; }, { passive: true });
  }

  async enableTilt(on) {
    this.tiltEnabled = on;
    if (!on) { this.tilt = 0; return true; }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') { this.tiltEnabled = false; return false; }
      }
    } catch (error) {
      this.tiltEnabled = false;
      return false;
    }
    if (!this.tiltBound) {
      this.tiltBound = true;
      window.addEventListener('deviceorientation', (e) => {
        if (!this.tiltEnabled || e.beta == null) return;
        // In landscape, beta measures the steering-wheel tilt; flip for the other landscape side.
        const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
        let v = Math.abs(angle) === 90 ? e.beta * (angle === 90 ? 1 : -1) : e.gamma;
        v = Math.max(-30, Math.min(30, v || 0)) / 22;
        this.tilt = Math.max(-1, Math.min(1, v));
      });
    }
    return true;
  }

  is(act) { return this.down.has(act) || this.touch.has(act); }

  // Produces the driving state for this frame.
  state(autoThrottle) {
    let steer = (this.is('right') ? 1 : 0) - (this.is('left') ? 1 : 0);
    if (this.tiltEnabled && steer === 0) steer = Math.abs(this.tilt) > 0.08 ? this.tilt : 0;
    const brake = this.is('brake') ? 1 : 0;
    const throttle = this.is('accel') || (autoThrottle && !brake) ? 1 : 0;
    return { steer, throttle, brake, boost: this.is('boost'), jump: this.is('jump') };
  }

  // Trick button presses this frame (edge-triggered), plus whether PRO is held.
  trickPresses() {
    const out = [];
    for (const t of TRICK_INPUTS) if (this.pressed.has(t)) out.push(t);
    return out;
  }

  consume(act) {
    if (this.pressed.has(act)) { this.pressed.delete(act); return true; }
    return false;
  }

  endFrame() { this.pressed.clear(); }
}
