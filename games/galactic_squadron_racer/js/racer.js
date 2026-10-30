/**
 * One ship in a race: physical state, boost tank, drift charge, lap and
 * checkpoint progress, and timing. Controls are written each step by its
 * controller (player input or AI), then race.js runs physics and collisions.
 *
 * Checkpoints: the lap is split into `checkpointCount` equal segments. A racer
 * only advances by entering the next segment in order (and steps back if it
 * reverses), so a lap counts only when every segment was driven in sequence.
 */
import { CONFIG } from './config.js';
import { TURBO_TIME } from './physics.js';

const B = CONFIG.boost;
const D = CONFIG.drift;

export class Racer {
  constructor({ ship, name, color, isPlayer = false, slot = 0 }) {
    this.ship = ship;
    this.h = ship.handling;
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.slot = slot;
    this.r = CONFIG.physics.racerRadius;
    this.controls = { throttle: 0, brake: 0, steer: 0, boost: false };
    this.controller = null;

    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.angVel = 0;
    this.spinVel = 0;
    this.forward = 0;
    this.speed = 0;
    this.slip = 0;
    this.powerSlide = false;

    this.energy = 1;
    this.boosting = false;
    this.rechargeWait = 0;
    this.turbo = 0;
    this.turboPower = 0;
    this.padTime = 0;
    this.driftTime = 0;
    this.driftTier = 0;
    this.driftGrace = 0;
    this.driftDir = 0;

    this.stun = 0;
    this.flash = 0;
    this.ghost = 0;          // can't collide while > 0 (after a respawn)
    this.hitCooldown = 0;
    this.surface = 'track';
    this.surfaceName = 'track';
    this.inLava = 0;

    this.ti = -1;            // nearest centerline sample (search hint)
    this.s = 0;
    this.lat = 0;
    this.hw = 100;
    this.ro = 0;
    this.kindIdx = 0;
    this.seg = 0;
    this.lap = 0;
    this.progress = 0;
    this.place = 1;
    this.lastProgress = 0;
    this.noProgress = 0;
    this.wrongWay = 0;
    this.stuck = 0;

    this.finished = false;
    this.finishTime = Infinity;
    this.lapStart = 0;
    this.lapTimes = [];
    this.bestLap = Infinity;
    this.wallHits = 0;
    this.hazardHits = 0;
    this.driftBoosts = 0;
    this.maxSpeed = 0;
    this.wallTouch = 0;
  }

  /** Puts the racer on the grid at distance s / lateral offset, facing the racing direction. */
  placeAt(geo, s, lat) {
    const f = geo.point(s, lat, {});
    this.x = f.x;
    this.y = f.y;
    this.heading = Math.atan2(f.ty, f.tx);
    this.vx = this.vy = 0;
    this.angVel = this.spinVel = 0;
    this.ti = f.i;
    this.trackUpdate(geo, null);
    this.seg = geo.segmentOf(this.s);
    this.lap = this.s > geo.length / 2 ? 0 : 1;
    this.progress = (this.lap - 1) * geo.length + this.s;
    this.lastProgress = this.progress;
  }

  /* --------------------------------------------------------------- boost */

  updateBoost(dt, want, race) {
    const canStart = this.boosting ? this.energy > 0 : this.energy >= B.minToStart;
    if (want && canStart && this.stun <= 0) {
      if (!this.boosting) {
        this.boosting = true;
        this.vx += Math.cos(this.heading) * B.kick;
        this.vy += Math.sin(this.heading) * B.kick;
        race?.emit('boostStart', { racer: this });
      }
      this.energy = Math.max(0, this.energy - this.h.boostDrain * dt);
      if (this.energy <= 0) this.boosting = false;
      this.rechargeWait = B.rechargeDelay;
    } else {
      this.boosting = false;
      if (this.rechargeWait > 0) this.rechargeWait -= dt;
      else this.energy = Math.min(1, this.energy + B.rechargeRate * dt);
    }
    if (this.turbo > 0) this.turbo -= dt;
    if (this.padTime > 0) this.padTime -= dt;
  }

  /* --------------------------------------------------------------- drift */

  updateDrift(dt, onTrack, race) {
    const sliding = onTrack && this.forward > this.h.topSpeed * D.minSpeed && Math.abs(this.slip) > D.minSlip && this.stun <= 0;
    if (sliding) {
      this.driftTime += dt;
      this.driftGrace = 0;
      this.driftDir = Math.sign(this.slip);
      let tier = 0;
      while (tier < D.tiers.length && this.driftTime >= D.tiers[tier]) tier++;
      this.driftTier = tier;
      return;
    }
    if (this.driftTime <= 0) return;
    this.driftGrace += dt;
    if (this.driftGrace < 0.14) return;
    if (this.driftTier > 0) {
      const t = this.driftTier - 1;
      this.energy = Math.min(1, this.energy + D.reward[t]);
      this.turbo = TURBO_TIME;
      this.turboPower = D.turbo[t];
      this.driftBoosts++;
      race?.emit('driftBoost', { racer: this, tier: this.driftTier });
    }
    this.driftTime = 0;
    this.driftTier = 0;
    this.driftGrace = 0;
  }

  cancelDrift() {
    this.driftTime = 0;
    this.driftTier = 0;
    this.driftGrace = 0;
  }

  /* ------------------------------------------------------------ progress */

  /** Projects onto the track and advances checkpoints. Returns 'lap', 'unlap' or null. */
  trackUpdate(geo, out) {
    const p = geo.project(this.x, this.y, this.ti, out || {});
    this.ti = p.i;
    this.s = p.s;
    this.lat = p.lat;
    this.hw = p.hw;
    this.ro = p.ro;
    this.kindIdx = p.kind;
    this.alongTrack = this.vx * p.tx + this.vy * p.ty;
    this.tx = p.tx;
    this.ty = p.ty;
    if (!out) return null;

    const n = geo.checkpointCount;
    const seg = geo.segmentOf(this.s);
    let result = null;
    if (seg !== this.seg) {
      if (seg === (this.seg + 1) % n) {
        if (seg === 0) {
          this.lap++;
          result = 'lap';
        }
        this.seg = seg;
      } else if (seg === (this.seg - 1 + n) % n) {
        if (this.seg === 0) {
          this.lap--;
          result = 'unlap';
        }
        this.seg = seg;
      }
      // any other jump means a segment was skipped: it doesn't count
    }
    this.progress = (this.lap - 1) * geo.length + this.s;
    return result;
  }

  /** Called when the racer crosses the line forward; returns true if that finished the race. */
  completeLap(time, laps) {
    if (this.lap >= 2 && this.lap - 1 <= laps) {
      const lapTime = time - this.lapStart;
      // only count a lap once per crossing (reversing over the line and back doesn't add laps)
      if (this.lapTimes.length < this.lap - 1) {
        this.lapTimes.push(lapTime);
        if (lapTime < this.bestLap) this.bestLap = lapTime;
        this.lapStart = time;
      }
    }
    if (this.lap > laps && !this.finished) {
      this.finished = true;
      this.finishTime = time;
      return true;
    }
    return false;
  }

  get displayLap() {
    return Math.max(1, Math.min(CONFIG.laps, this.lap));
  }
}
