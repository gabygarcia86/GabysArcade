// AI racers. They drive the same JetSkiBody as the player, steering toward a look-ahead point
// on their preferred racing line, slowing for tight corners, dodging obstacles, using ramps,
// showing off in the air, and occasionally making mistakes.
import { TRICK_INPUTS } from './data.js';

const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const _p = { x: 0, z: 0 };

export class AIDriver {
  constructor(racer, track, physics, persona, diff, seed) {
    this.r = racer;
    this.track = track;
    this.physics = physics;
    this.p = persona;
    this.diff = diff;
    this.seed = seed;
    this.time = seed * 3.1;
    this.mistakeT = 6 + Math.random() * 10;
    this.mistake = 0;
    this.mistakeSteer = 0;
    this.stuckT = 0;
    this.avoid = 0;
    this.trickCool = 0;
    this.baseMax = racer.body.h.maxSpeed;
    this.baseAccel = racer.body.h.accel;
  }

  update(dt, ctx) {
    const b = this.r.body;
    const inp = b.input;
    this.time += dt;
    if (!ctx.go || b.crashed) {
      inp.throttle = 0; inp.steer = 0; inp.boost = false; inp.brake = 0; inp.jump = false;
      return;
    }
    // After the flag, cruise around at a gentle pace.
    this.drive(dt, ctx, this.r.finished ? 0.4 : 1);
  }

  drive(dt, ctx, throttleCap) {
    const b = this.r.body;
    const inp = b.input;
    const t = this.track;
    const hw = t.halfWidth;
    const idx = this.r.idx;
    const speed = b.speed;

    // Rubber band: keep the pack close to the player so races stay exciting.
    let band = 1;
    if (ctx.playerProgress != null) {
      const gap = this.r.progress - ctx.playerProgress;
      if (gap > 120) band = Math.max(0.9, 1 - (gap - 120) / 1500);
      else if (gap < -120) band = Math.min(1.08, 1 + (-gap - 120) / 1500);
    }
    b.h.maxSpeed = this.baseMax * band;

    // Curvature ahead decides the cornering speed.
    const ahead = Math.round((12 + speed * 1.3) / 2);
    let curv = 0;
    for (let k = 4; k < ahead + 20; k += 4) curv = Math.max(curv, Math.abs(t.curv[t.wrap(idx + k)]));
    const cornerSkill = this.diff.corner;
    const allowed = b.h.maxSpeed * (1 - Math.min(0.5, curv * 18 / cornerSkill));

    // Preferred line, weaving gently, cutting the inside of corners on harder difficulties.
    const look = t.wrap(idx + Math.round((10 + speed * 0.75) / 2));
    let off = this.p.line * hw * 0.8 + Math.sin(this.time * 0.17 + this.seed) * hw * 0.22;
    off += t.curv[look] * hw * 20 * (cornerSkill - 0.6);
    // Ramps: flair riders aim at them.
    if (this.p.flair > 0.4) {
      for (const ramp of this.physics.ramps) {
        const dx = ramp.x - b.pos.x, dz = ramp.z - b.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 70 * 70 && d2 > 8 * 8 && dx * b.fwdFlat.x + dz * b.fwdFlat.z > 0) {
          const ri = t.nearest(ramp.x, ramp.z, idx);
          off = t.lateral(ramp.x, ramp.z, ri);
          break;
        }
      }
    }
    // Obstacles: probe ahead and dodge sideways.
    this.avoid *= Math.exp(-dt * 1.5);
    for (const dist of [10, 20, 30]) {
      const px = b.pos.x + b.fwdFlat.x * dist, pz = b.pos.z + b.fwdFlat.z * dist;
      const list = this.physics.query(px, pz);
      if (!list) continue;
      for (const c of list) {
        if (c.kind === 'buoy') continue;
        const dx = px - c.x, dz = pz - c.z;
        if (dx * dx + dz * dz < (c.r + 2.4) * (c.r + 2.4)) {
          const side = (c.x - b.pos.x) * b.fwdFlat.z - (c.z - b.pos.z) * b.fwdFlat.x; // >0 obstacle on the left
          this.avoid = side > 0 ? -9 : 9;
        }
      }
    }
    off += this.avoid;
    off = Math.max(-hw * 0.85, Math.min(hw * 0.85, off));
    t.offsetPoint(look, off, _p);
    const desired = Math.atan2(_p.x - b.pos.x, _p.z - b.pos.z);
    const err = wrapAngle(desired - b.yaw());
    let steer = Math.max(-1, Math.min(1, -err * 2.4));

    // Mistakes: a wobble or a lift off the throttle now and then.
    this.mistakeT -= dt;
    if (this.mistakeT <= 0) {
      this.mistakeT = (9 + Math.random() * 14) / this.diff.mistakes;
      if (Math.random() < 0.4 + this.p.wobble * 0.5) {
        this.mistake = 0.5 + Math.random() * 0.6;
        this.mistakeSteer = (Math.random() - 0.5) * 1.6;
      }
    }
    let throttle = throttleCap;
    if (this.mistake > 0) {
      this.mistake -= dt;
      steer = Math.max(-1, Math.min(1, steer + this.mistakeSteer));
      throttle *= 0.55;
    }
    let brake = 0;
    if (speed > allowed + 2) { throttle = 0.25; if (speed > allowed + 6) brake = 0.4; }
    if (Math.abs(err) > 1.2 && speed > 8) { throttle = 0.2; brake = 0.5; }
    inp.steer = steer;
    inp.throttle = throttle;
    inp.brake = brake;
    inp.boost = throttleCap >= 1 && Math.abs(err) < 0.15 && curv < 0.012 && b.boost > 35 && Math.sin(this.time * 0.5 + this.seed) < this.p.aggression * 1.4 - 0.4;
    inp.jump = false;

    // Show off in the air.
    this.trickCool -= dt;
    if (b.airborne && b.heightAboveWater > 2.4 && this.trickCool <= 0 && ctx.tricks) {
      this.trickCool = 3;
      if (Math.random() < this.p.flair * 0.7) {
        const pick = TRICK_INPUTS[Math.floor(Math.random() * TRICK_INPUTS.length)];
        ctx.tricks.request(pick, false, b);
      }
    }

    // Stuck or lost: respawn on the racing line.
    if (speed < 2 && throttleCap >= 1) this.stuckT += dt; else this.stuckT = 0;
    if (this.stuckT > 3.5 || this.r.offTrackT > 3 || this.r.wrongWayT > 3) {
      this.stuckT = 0;
      ctx.respawn(this.r);
    }
  }
}
