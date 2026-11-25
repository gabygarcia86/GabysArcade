// Aerial tricks: starting them in the air, animating the trick pivot, and scoring combos on landing.
import { TRICKS, PRO_TRICKS } from './data.js';

const ease = (t) => t * t * (3 - 2 * t);

export class TrickSystem {
  constructor(isPlayer = true) {
    this.isPlayer = isPlayer;
    this.active = null; // { id, def, t }
    this.jump = []; // tricks completed during the current jump
    this.combo = []; // names across chained jumps
    this.comboCount = 0;
    this.comboTimer = 0;
    this.ringBonus = 1;
    this.lastResult = null;
  }

  reset() {
    this.active = null;
    this.jump.length = 0;
    this.combo.length = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.ringBonus = 1;
  }

  get busy() { return !!this.active; }
  get pose() { return this.active ? this.active.def.pose : null; }

  // Returns the started trick id or null.
  request(input, pro, body) {
    if (this.active || body.crashed) return null;
    // Airborne, or just launched and still rising clear of the water.
    const leaving = body.launchT > 0 && body.vel.y > 2;
    if (!body.airborne && !leaving) return null;
    if (body.heightAboveWater < 0.9 && body.vel.y < 1) return null;
    const id = pro && PRO_TRICKS[input] ? PRO_TRICKS[input] : input;
    const def = TRICKS[id];
    if (!def) return null;
    this.active = { id, def, t: 0 };
    body.trickLock = true;
    return id;
  }

  // Animates the pivot. Returns a completed trick id on the frame one finishes.
  update(dt, body, model) {
    let finished = null;
    const pivot = model.trickPivot;
    if (this.active) {
      const a = this.active;
      a.t += dt;
      const p = Math.min(1, a.t / a.def.dur);
      const ang = ease(p) * Math.PI * 2 * a.def.turns;
      pivot.rotation.set(0, 0, 0);
      if (a.def.axis === 'x') pivot.rotation.x = ang;
      else if (a.def.axis === 'y') pivot.rotation.y = ang;
      else if (a.def.axis === 'z') pivot.rotation.z = ang;
      else pivot.rotation.x = -Math.sin(p * Math.PI) * 0.25; // pose tricks: slight nose lift
      if (p >= 1) {
        finished = a.id;
        this.jump.push(a.id);
        this.active = null;
        body.trickLock = false;
        pivot.rotation.set(0, 0, 0);
      }
    } else if (pivot.rotation.x || pivot.rotation.y || pivot.rotation.z) {
      pivot.rotation.set(0, 0, 0);
    }
    if (!body.airborne && this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.endCombo();
    }
    return finished;
  }

  endCombo() {
    this.combo.length = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
  }

  // Called when the jet ski touches down. Returns a landing result.
  land(info, body, model, tolerance) {
    let crash = false;
    if (this.active) {
      const a = this.active;
      const p = a.t / a.def.dur;
      const need = a.def.axis ? 0.8 : 0.55;
      if (p >= need) {
        this.jump.push(a.id);
      } else {
        crash = true;
      }
      this.active = null;
      body.trickLock = false;
      model.trickPivot.rotation.set(0, 0, 0);
    }
    if (!crash && info.upDot < tolerance) crash = true;
    if (crash) {
      const lost = this.comboCount + this.jump.length;
      this.jump.length = 0;
      this.endCombo();
      this.ringBonus = 1;
      return { crash: true, lost };
    }
    if (!this.jump.length) {
      this.ringBonus = 1;
      return { crash: false, tricks: [], points: 0, air: info.airTime };
    }
    let sum = 0;
    const names = [];
    const unique = new Set();
    for (const id of this.jump) {
      sum += TRICKS[id].points;
      names.push(TRICKS[id].name);
      unique.add(TRICKS[id].name);
    }
    this.comboCount += this.jump.length;
    for (const n of names) this.combo.push(n);
    const mult = Math.min(5, this.comboCount);
    const perfect = info.upDot > 0.96 && info.fwdDot > 0.75;
    const points = Math.round(sum * mult * this.ringBonus + (perfect ? 250 : 0));
    const result = {
      crash: false,
      tricks: this.jump.slice(),
      names,
      uniqueCount: unique.size,
      comboNames: this.combo.slice(-6),
      multiplier: mult,
      ring: this.ringBonus > 1,
      perfect,
      points,
      air: info.airTime,
      comboCount: this.comboCount,
    };
    this.jump.length = 0;
    this.ringBonus = 1;
    this.comboTimer = 2.6;
    this.lastResult = result;
    return result;
  }
}
