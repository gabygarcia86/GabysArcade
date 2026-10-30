/**
 * AI drivers. Each track gets one racing line (a minimum-curvature path found
 * by relaxing points sideways within the track). Each AI then builds its own
 * speed profile for that line from its ship's turn rate, grip and brakes, so a
 * heavy gunship really does brake earlier than a light fighter.
 *
 * Every step the driver:
 *  - steers by pure pursuit toward a point ahead on (racing line + avoidance);
 *  - brakes when it is faster than the slowest profile speed coming up;
 *  - boosts on straights and corner exits (more often on harder settings);
 *  - steps around hazards it can see coming and pulls out to overtake;
 *  - backs out when stuck and asks the race for a respawn if it stays lost.
 *
 * There is no rubber-banding: pace comes from driving and the ship's stats.
 */
import { CONFIG } from './config.js';
import { turnFactor } from './physics.js';
import { clamp, damp, wrapAngle, loopDelta, wrapLen } from './utils.js';

const STEP = 4; // racing line resolution, in centerline samples
const lineCache = new Map();

/** Minimum-curvature racing line: lateral offsets every STEP samples. */
export function getRacingLine(geo) {
  let line = lineCache.get(geo.def.id);
  if (line) return line;
  const m = Math.floor(geo.n / STEP);
  const cx = new Float32Array(m);
  const cy = new Float32Array(m);
  const nx = new Float32Array(m);
  const ny = new Float32Array(m);
  const lim = new Float32Array(m);
  const off = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    const i = k * STEP;
    cx[k] = geo.x[i];
    cy[k] = geo.y[i];
    nx[k] = -geo.ty[i];
    ny[k] = geo.tx[i];
    lim[k] = Math.max(0, geo.hw[i] - CONFIG.ai.lineMargin);
  }
  for (let iter = 0; iter < 500; iter++) {
    for (let k = 0; k < m; k++) {
      const a = (k - 2 + m) % m;
      const b = (k + 2) % m;
      const ax = cx[a] + nx[a] * off[a];
      const ay = cy[a] + ny[a] * off[a];
      const bx = cx[b] + nx[b] * off[b];
      const by = cy[b] + ny[b] * off[b];
      const px = cx[k] + nx[k] * off[k];
      const py = cy[k] + ny[k] * off[k];
      const d = ((ax + bx) / 2 - px) * nx[k] + ((ay + by) / 2 - py) * ny[k];
      off[k] = clamp(off[k] + d * 0.7, -lim[k], lim[k]);
    }
  }
  // smooth the result a little so steering targets don't kink
  const sm = new Float32Array(m);
  for (let k = 0; k < m; k++) {
    let acc = 0;
    for (let o = -2; o <= 2; o++) acc += off[(k + o + m) % m];
    sm[k] = clamp(acc / 5, -lim[k], lim[k]);
  }
  const curv = new Float32Array(m);
  const span = 3;
  for (let k = 0; k < m; k++) {
    const a = (k - span + m) % m;
    const b = (k + span) % m;
    const ax = cx[a] + nx[a] * sm[a];
    const ay = cy[a] + ny[a] * sm[a];
    const bx = cx[b] + nx[b] * sm[b];
    const by = cy[b] + ny[b] * sm[b];
    const px = cx[k] + nx[k] * sm[k];
    const py = cy[k] + ny[k] * sm[k];
    // Menger curvature of the three points
    const area2 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const la = Math.hypot(px - ax, py - ay);
    const lb = Math.hypot(bx - px, by - py);
    const lc = Math.hypot(bx - ax, by - ay);
    curv[k] = Math.abs((2 * area2) / (la * lb * lc || 1));
  }
  line = { m, off: sm, curv, spacing: geo.ds * STEP };
  lineCache.set(geo.def.id, line);
  return line;
}

function lineOffsetAt(line, s) {
  const f = wrapLen(s, line.m * line.spacing) / line.spacing;
  const k = Math.floor(f) % line.m;
  const t = f - Math.floor(f);
  return line.off[k] + (line.off[(k + 1) % line.m] - line.off[k]) * t;
}

/** Highest speed the ship can hold through curvature k on a surface with this grip. */
function cornerSpeed(h, k, grip) {
  const top = h.topSpeed * h.boostSpeed;
  if (k < 1e-5) return top;
  const slideLoss = 0.62 + 0.3 * Math.min(1, grip);
  let lo = 60;
  let hi = top;
  for (let i = 0; i < 18; i++) {
    const v = (lo + hi) / 2;
    const maxK = (h.turnRate * turnFactor(v / h.topSpeed) * slideLoss) / v;
    if (maxK >= k) lo = v;
    else hi = v;
  }
  return lo;
}

export class AIController {
  constructor(racer, race, difficulty) {
    this.racer = racer;
    this.race = race;
    this.diff = CONFIG.ai.difficulty[difficulty] || CONFIG.ai.difficulty.normal;
    this.line = getRacingLine(race.geo);
    this.profile = this.buildProfile();
    this.avoidLat = 0;
    this.avoidTarget = 0;
    this.avoidTimer = 0;
    this.threatDist = Infinity;
    this.boostTimer = Math.random();
    this.boostWant = false;
    this.mistake = 0;
    this.mistakeSteer = 0;
    this.nextMistake = 6 + Math.random() * 10;
    this.reverse = 0;
    this.ignored = new Set();
    this.lineScale = this.diff.line;
    this.pace = 0.985 + Math.random() * 0.03; // small personal variation
  }

  buildProfile() {
    const { line, racer, race } = this;
    const h = racer.h;
    const m = line.m;
    const v = new Float32Array(m);
    const baseGrip = CONFIG.surfaces[race.track.surface]?.grip ?? 1;
    const P = CONFIG.physics;
    for (let k = 0; k < m; k++) {
      const s = k * line.spacing;
      const grip = race.surfaceGripAt ? race.surfaceGripAt(s, line.off[k]) : baseGrip;
      v[k] = cornerSpeed(h, line.curv[k], grip) * this.diff.cornerSpeed;
    }
    // look back from every corner so braking starts in time
    const decel = P.brakeDecel * 0.55 * (0.6 + 0.4 * Math.min(1, baseGrip));
    for (let pass = 0; pass < 2; pass++) {
      for (let k = m - 1; k >= 0; k--) {
        const next = v[(k + 1) % m];
        const lim = Math.sqrt(next * next + 2 * decel * line.spacing);
        if (v[k] > lim) v[k] = lim;
      }
    }
    return v;
  }

  profileAt(s) {
    const m = this.line.m;
    const k = Math.floor(wrapLen(s, m * this.line.spacing) / this.line.spacing) % m;
    return this.profile[k];
  }

  /** Lowest profile speed over the next `dist` units. */
  minProfile(s, dist) {
    const sp = this.line.spacing;
    let lo = Infinity;
    for (let d = 0; d <= dist; d += sp) lo = Math.min(lo, this.profileAt(s + d));
    return lo;
  }

  update(dt) {
    const r = this.racer;
    const race = this.race;
    const geo = race.geo;
    const c = r.controls;
    const d = this.diff;
    const v = Math.max(0, r.forward);
    const lim = Math.max(10, r.hw - r.r - 10);

    /* ---- recovery: back away from a wall we are stuck against */
    if (this.reverse > 0) {
      this.reverse -= dt;
      const ahead = geo.point(r.s + 160, 0, {});
      const err = wrapAngle(Math.atan2(ahead.y - r.y, ahead.x - r.x) - r.heading);
      c.throttle = 0;
      c.brake = 1;
      c.steer = clamp(-err * 2, -1, 1);
      c.boost = false;
      return;
    }
    if (r.stuck > CONFIG.recovery.stuckTime * 0.5 && race.state === 'racing') {
      this.reverse = 0.9;
      r.stuck = 0;
      return;
    }

    /* ---- avoidance: hazards and other racers, re-planned 12 times a second */
    this.avoidTimer -= dt;
    if (this.avoidTimer <= 0) {
      this.avoidTimer = 0.083;
      this.avoidTarget = this.planAvoid(v, lim);
    }
    this.avoidLat += (this.avoidTarget - this.avoidLat) * damp(5, dt);

    /* ---- steering: pure pursuit */
    let look = 80 + v * 0.34;
    // something right in front: aim at a closer point so the turn-out is sharp
    if (this.threatDist < 220) look = Math.min(look, 45 + this.threatDist * 0.45);
    const lineLat = lineOffsetAt(this.line, r.s + look) * this.lineScale;
    let lat = clamp(lineLat + this.avoidLat, -lim, lim);
    const tgt = geo.point(r.s + look, lat, {});
    const desired = Math.atan2(tgt.y - r.y, tgt.x - r.x);
    // aim the velocity, not just the nose, so slides get counter-steered
    const travel = r.speed > 120 ? Math.atan2(r.vy, r.vx) : r.heading;
    const aimFrom = r.heading + wrapAngle(travel - r.heading) * 0.45;
    const err = wrapAngle(desired - aimFrom);
    let steer = err * 3.1 - r.angVel * 0.1;

    /* ---- mistakes (easy, a little on normal) */
    this.nextMistake -= dt;
    if (this.nextMistake <= 0 && d.mistakes > 0) {
      this.nextMistake = 5 + Math.random() * 12;
      if (Math.random() < d.mistakes * 3) {
        this.mistake = 0.45 + Math.random() * 0.5;
        this.mistakeSteer = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.4);
      }
    }
    if (this.mistake > 0) {
      this.mistake -= dt;
      steer += this.mistakeSteer;
    }
    c.steer = clamp(steer, -1, 1);

    /* ---- speed */
    const brakeLook = 60 + v * 0.55;
    let target = this.minProfile(r.s, brakeLook) * this.pace;
    target = Math.min(target, r.h.topSpeed * (r.boosting ? r.h.boostSpeed : 1) * d.straightCap * this.pace + (r.boosting ? 0 : 5));
    if (Math.abs(err) > 1.2) target = Math.min(target, 260); // facing the wrong way: turn tight
    const over = v - target;
    if (over > 30 && this.mistake <= 0) {
      c.throttle = 0;
      c.brake = clamp(over / 160, 0.25, 1);
    } else if (over > 0) {
      c.throttle = 0.3;
      c.brake = 0;
    } else {
      c.throttle = 1;
      c.brake = 0;
    }

    /* ---- boost */
    this.boostTimer -= dt;
    if (this.boostTimer <= 0) {
      this.boostTimer = 0.4;
      const fast = r.h.topSpeed * r.h.boostSpeed * 0.92;
      const clear = this.minProfile(r.s, 250 + v * 1.1) >= fast;
      const exiting = this.minProfile(r.s, 140) >= fast * 0.8 && v < r.h.topSpeed * 0.85;
      const reserve = r.energy > (this.diff.boost >= 1 ? 0.2 : 0.4);
      const roll = Math.random() < d.boost;
      this.boostWant = reserve && roll && Math.abs(c.steer) < 0.4 && (clear || (d.boost >= 1 && exiting));
      if (r.boosting && clear && r.energy > 0.05) this.boostWant = true;
    }
    c.boost = this.boostWant && c.brake === 0;
  }

  /** Lateral shift (relative to the racing line) that dodges what is coming up. */
  planAvoid(v, lim) {
    const r = this.racer;
    const race = this.race;
    const L = race.geo.length;
    const d = this.diff;
    const baseLat = clamp(lineOffsetAt(this.line, r.s + 120) * this.lineScale, -lim, lim);
    let want = baseLat;
    let threat = Infinity;

    const choose = (oLat, clearance, vlat = 0) => {
      const left = oLat - clearance;
      const right = oLat + clearance;
      const roomL = left + lim;
      const roomR = lim - right;
      if (roomL < 0 && roomR < 0) return Math.abs(oLat) > 0 ? -Math.sign(oLat) * lim : lim;
      if (roomL < 0) return right;
      if (roomR < 0) return left;
      // pass behind something that is sliding sideways, otherwise take the nearer side
      if (Math.abs(vlat) > 15) return vlat > 0 ? left : right;
      return Math.abs(left - baseLat) <= Math.abs(right - baseLat) ? left : right;
    };

    // hazards
    const reach = (160 + v * 0.8) * d.react;
    for (const ob of race.obstacles) {
      const ds = loopDelta(ob.s, r.s, L);
      if (ds < -20 || ds > reach) {
        this.ignored.delete(ob.id);
        continue;
      }
      // a missed obstacle is only noticed late, never ignored all the way into it
      const late = 60 + v * 0.5;
      if (this.ignored.has(ob.id) && ds > late) continue;
      const t = Math.min(0.7, ds / Math.max(120, v));
      const pred = ob.lat + (ob.vlat || 0) * t;
      const clearance = ob.r + r.r + 26;
      // where we will be when we reach it: easing from our current lane toward the plan
      const pathLat = r.lat + (want - r.lat) * Math.min(1, Math.max(0, ds) / 260);
      if ((Math.abs(pred - want) < clearance || Math.abs(pred - pathLat) < clearance) && ds < threat) {
        if (!this.ignored.has(ob.id) && ds > late && Math.random() < d.avoidMiss) {
          this.ignored.add(ob.id);
          continue;
        }
        threat = ds;
        want = choose(pred, clearance, ob.vlat || 0);
      }
    }

    // racers ahead: pull out to pass (more eagerly when aggressive)
    if (threat === Infinity) {
      const passReach = 120 + 160 * d.aggression;
      for (const o of race.racers) {
        if (o === r || o.ghost > 0 || o.finished !== r.finished) continue;
        const ds = loopDelta(o.s, r.s, L);
        if (ds < -10 || ds > passReach) continue;
        if (Math.abs(o.lat - want) < r.r * 2.3 && o.forward < r.forward + 40) {
          want = choose(o.lat, r.r * 2.7);
          break;
        }
      }
    }
    this.threatDist = threat;
    return clamp(want, -lim, lim) - baseLat;
  }
}
