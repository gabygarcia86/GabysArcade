/**
 * A single race: four racers (or one in Time Trial), a countdown, three laps.
 * This module is pure simulation — no DOM, no drawing — so it can also run
 * headless. Everything the presentation layer needs to react to (sounds,
 * particles, HUD notices) is published through emit(type, data).
 *
 * States: countdown → racing → finishing (player done, others still racing)
 * → done. The frame dt is split into fixed-size substeps.
 */
import { CONFIG } from './config.js';
import { getGeometry } from './trackGeometry.js';
import { Racer } from './racer.js';
import { AIController } from './aiRacer.js';
import { stepVehicle } from './physics.js';
import { collideWall, collideRacers } from './collision.js';
import { createHazards } from './trackHazards.js';
import { getRosterShip } from './shipRoster.js';
import { wrapLen } from './utils.js';

const SURF = CONFIG.surfaces;
const REC_DT = 1 / 30;
const PLAYER_COLOR = '#38d6ff';

export function buildZones(track, geo) {
  return (track.zones || []).map((z) => {
    if (z.type === 'boost') {
      return { type: 'boost', s0: wrapLen(geo.u2s(z.at) - z.len / 2, geo.length), span: z.len, lat: z.lat, halfW: 52 };
    }
    const s0 = geo.u2s(z.from);
    return { type: z.type, surface: z.type, s0, span: wrapLen(geo.u2s(z.to) - s0, geo.length), lat: z.lat, halfW: z.width / 2 };
  });
}

export class Race {
  /**
   * opts: track, mode ('quick' | 'grandprix' | 'timetrial'), playerShip (id),
   * opponents [{ shipId, name, color }], difficulty, playerSlot (grid slot,
   * 0 = pole), ghost (Time Trial playback), autopilot (AI drives the player).
   */
  constructor(opts) {
    this.track = opts.track;
    this.mode = opts.mode || 'quick';
    this.difficulty = opts.difficulty || 'normal';
    this.geo = getGeometry(this.track);
    this.laps = CONFIG.laps;
    this.listeners = [];
    this.clock = 0;
    this.time = 0;
    this.state = 'countdown';
    this.countdown = CONFIG.race.countdown + 0.9;
    this.shownCount = 0;
    this.zones = buildZones(this.track, this.geo);
    this.obstacles = [];
    this.racers = [];
    this.finishOrder = [];
    this.finishTimer = 0;
    this.playerSource = null;
    this.hazards = createHazards(this.track, this);

    const solo = this.mode === 'timetrial';
    const opponents = solo ? [] : opts.opponents || [];
    const total = 1 + opponents.length;
    const playerSlot = solo ? 0 : Math.min(total - 1, opts.playerSlot ?? total - 1);
    this.player = new Racer({ ship: getRosterShip(opts.playerShip), name: opts.playerName || 'YOU', color: PLAYER_COLOR, isPlayer: true, slot: playerSlot });
    let slot = 0;
    for (const o of opponents) {
      if (slot === playerSlot) slot++;
      const r = new Racer({ ship: getRosterShip(o.shipId), name: o.name, color: o.color, slot });
      this.racers.push(r);
      slot++;
    }
    this.racers.splice(playerSlot, 0, this.player);
    this.racers.sort((a, b) => a.slot - b.slot);

    const R = CONFIG.race;
    for (const r of this.racers) {
      const s = this.geo.length - 60 - r.slot * R.gridSpacing;
      const lat = solo ? 0 : (r.slot % 2 === 0 ? -1 : 1) * this.geo.hw[this.geo.index(s)] * R.gridLateral;
      r.placeAt(this.geo, s, lat);
    }
    for (const r of this.racers) {
      if (!r.isPlayer) r.controller = new AIController(r, this, this.difficulty);
    }
    if (opts.autopilot) this.player.controller = new AIController(this.player, this, 'hard');
    this.standings().forEach((r, i) => (r.place = i + 1));

    // time trial ghost
    this.ghost = opts.ghost || null;
    this.ghostPos = { visible: false, x: 0, y: 0, heading: 0 };
    this.lapFrames = [];
    this.recTimer = 0;
    this.bestRun = null;
    this.proj = {};
  }

  on(fn) {
    this.listeners.push(fn);
    return fn;
  }

  emit(type, data) {
    for (const fn of this.listeners) fn(type, data, this);
  }

  /* ----------------------------------------------------------- queries */

  get active() {
    return this.state === 'racing' || this.state === 'finishing';
  }

  surfaceName(r) {
    if (Math.abs(r.lat) > r.hw + 4) return this.track.offroad;
    for (const z of this.zones) {
      if (z.surface && this.geo.inRange(r.s, z.s0, z.span) && Math.abs(r.lat - z.lat) < z.halfW) return z.surface;
    }
    return this.track.surface;
  }

  /** Grip of the racing surface at (s, lat); used by AI to plan corner speeds. */
  surfaceGripAt(s, lat) {
    for (const z of this.zones) {
      if (z.surface && this.geo.inRange(s, z.s0, z.span) && Math.abs(lat - z.lat) < z.halfW) return SURF[z.surface].grip;
    }
    return SURF[this.track.surface].grip;
  }

  /** Racers ordered by position. */
  standings() {
    return this.racers.slice().sort((a, b) => {
      if (a.finished || b.finished) return (a.finished ? a.finishTime : Infinity) - (b.finished ? b.finishTime : Infinity) || b.progress - a.progress;
      return b.progress - a.progress;
    });
  }

  /* ------------------------------------------------------------ update */

  update(frameDt) {
    if (this.state === 'done') return;
    const dt = Math.min(frameDt, CONFIG.maxFrameDt);
    const n = Math.max(1, Math.ceil(dt / CONFIG.stepDt - 1e-6));
    const h = dt / n;
    for (let i = 0; i < n; i++) this.step(h);
  }

  step(dt) {
    const geo = this.geo;
    this.clock += dt;
    if (this.state === 'countdown') this.stepCountdown(dt);
    else if (this.active) this.time += dt;
    const racing = this.active;

    // controls
    for (const r of this.racers) {
      const c = r.controls;
      if (r.controller) r.controller.update(dt);
      else if (this.playerSource) this.playerSource(r, dt, this);
      if (!racing) {
        if (r.isPlayer && this.state === 'countdown') this.trackStartTiming(r);
        c.steer = 0;
        c.brake = 0;
        c.boost = false;
        if (this.state === 'countdown') c.throttle = 0;
      }
      if (r.stall > 0) {
        r.stall -= dt;
        c.throttle *= 0.3;
      }
    }

    for (const hz of this.hazards) hz.update(dt, this);
    const obs = this.obstacles;
    obs.length = 0;
    for (const hz of this.hazards) hz.obstacles(obs);

    // movement
    for (const r of this.racers) {
      r.surface = this.surfaceName(r);
      if (this.state === 'countdown') continue;
      r.updateBoost(dt, r.controls.boost && racing, this);
      stepVehicle(r, r.controls, SURF[r.surface], dt);
      for (const hz of this.hazards) if (hz.affect) hz.affect(r, dt, this);
    }

    // collisions
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) collideRacers(rs[i], rs[j], this);
    }
    for (const r of rs) {
      for (const hz of this.hazards) hz.collide(r, this);
    }

    // track position, walls, laps, zones
    for (const r of rs) {
      const res = r.trackUpdate(geo, this.proj);
      collideWall(r, this);
      if (res === 'lap' && racing) this.onLap(r);
      this.applyZones(r, dt);
      r.updateDrift(dt, Math.abs(r.lat) <= r.hw, this);
      this.tickTimers(r, dt);
      if (racing) this.checkRecovery(r, dt);
    }

    if (racing) {
      this.updatePlaces();
      this.updateGhost(dt);
    }
    if (this.state === 'finishing') {
      this.finishTimer -= dt;
      if (this.finishTimer <= 0 || this.racers.every((r) => r.finished)) this.end();
    }
  }

  stepCountdown(dt) {
    this.countdown -= dt;
    const n = Math.ceil(this.countdown);
    if (n <= CONFIG.race.countdown && n !== this.shownCount && n > 0) {
      this.shownCount = n;
      this.emit('count', { n });
    }
    if (this.countdown <= 0) {
      this.state = 'racing';
      this.time = 0;
      for (const r of this.racers) {
        r.lapStart = 0;
        this.applyStart(r);
      }
      this.emit('go', {});
    }
  }

  /** Throttle pressed during "1" = rocket start. Held since "3" or "2" = overheated, stalls briefly. */
  trackStartTiming(r) {
    const held = r.controls.throttle > 0.5;
    const cd = this.countdown;
    if (!held) {
      if (r.startState === 'early' && cd > 1) r.startState = null;
      return;
    }
    if (cd > 1.35 && cd <= CONFIG.race.countdown) r.startState = 'early';
    else if (cd <= 1 && r.startState !== 'early') r.startState = 'good';
  }

  applyStart(r) {
    if (!r.isPlayer || r.controller) {
      const chance = { easy: 0.2, normal: 0.5, hard: 0.85 }[this.difficulty] ?? 0.5;
      r.startState = Math.random() < chance ? 'good' : null;
    }
    if (r.startState === 'good') {
      r.vx += Math.cos(r.heading) * 260;
      r.vy += Math.sin(r.heading) * 260;
      r.turbo = 0.35;
      r.turboPower = 60;
      this.emit('rocketStart', { racer: r });
    } else if (r.startState === 'early') {
      r.stall = 0.7;
      this.emit('stall', { racer: r });
    }
  }

  applyZones(r, dt) {
    if (r.surface === 'lava') {
      r.inLava += dt;
      if (r.inLava > CONFIG.lavaRescueTime) this.respawn(r, 'lava');
    } else {
      r.inLava = Math.max(0, r.inLava - dt * 2);
    }
    for (const z of this.zones) {
      if (z.type !== 'boost') continue;
      if (!this.geo.inRange(r.s, z.s0, z.span) || Math.abs(r.lat - z.lat) > z.halfW) continue;
      if (r.padTime <= 0.3) {
        const B = CONFIG.boostPad;
        r.vx += r.tx * B.kick;
        r.vy += r.ty * B.kick;
        r.energy = Math.min(1, r.energy + B.energy);
        this.emit('boostPad', { racer: r });
      }
      r.padTime = 0.8;
    }
  }

  tickTimers(r, dt) {
    if (r.stun > 0) r.stun -= dt;
    if (r.flash > 0) r.flash -= dt;
    if (r.ghost > 0) r.ghost -= dt;
    if (r.hitCooldown > 0) r.hitCooldown -= dt;
    if (r.wallTouch > 0) r.wallTouch -= dt;
    if (r.speed > r.maxSpeed) r.maxSpeed = r.speed;
  }

  checkRecovery(r, dt) {
    const R = CONFIG.recovery;
    if (r.finished && !r.controller) return;
    r.stuck = r.speed < R.stuckSpeed ? r.stuck + dt : Math.max(0, r.stuck - dt * 2);
    if (r.progress > r.lastProgress + 120) {
      r.lastProgress = r.progress;
      r.noProgress = 0;
    } else {
      r.noProgress += dt;
    }
    r.wrongWay = r.alongTrack < -40 ? r.wrongWay + dt : 0;
    if (!r.isPlayer || r.controller) {
      if (r.noProgress > R.respawnTime) this.respawn(r, 'lost');
    } else {
      r.needsReset = r.noProgress > R.playerRespawnHint || r.wrongWay > R.wrongWayTime * 3;
    }
  }

  onLap(r) {
    const finished = r.completeLap(this.time, this.laps);
    if (r.lap >= 2 || finished) this.emit('lap', { racer: r, lap: r.lap, time: r.lapTimes[r.lapTimes.length - 1] });
    if (r.isPlayer && this.mode === 'timetrial') this.closeGhostLap(r);
    if (finished) this.onFinish(r);
  }

  onFinish(r) {
    this.finishOrder.push(r);
    r.place = this.finishOrder.length;
    this.emit('finish', { racer: r, place: r.place });
    if (r.isPlayer) {
      this.state = 'finishing';
      this.finishTimer = this.mode === 'timetrial' ? 2.5 : CONFIG.race.finishWait;
      if (!r.controller) r.controller = new AIController(r, this, 'normal');
    }
  }

  /** Ends the race, estimating finish times for anyone still on track. */
  end() {
    const L = this.geo.length;
    for (const r of this.racers) {
      if (r.finished) continue;
      const remaining = this.laps * L - r.progress;
      const avg = Math.max(200, r.progress / Math.max(1, this.time));
      r.finished = true;
      r.estimated = true;
      r.finishTime = this.time + remaining / avg;
    }
    this.finishOrder = this.racers.slice().sort((a, b) => a.finishTime - b.finishTime);
    this.finishOrder.forEach((r, i) => (r.place = i + 1));
    this.state = 'done';
    this.emit('raceOver', { results: this.results() });
  }

  results() {
    return this.finishOrder.map((r) => ({
      name: r.name,
      shipId: r.ship.id,
      shipName: r.ship.name,
      color: r.color,
      isPlayer: r.isPlayer,
      place: r.place,
      time: r.finishTime,
      bestLap: r.bestLap,
      lapTimes: r.lapTimes.slice(),
      estimated: !!r.estimated,
      stats: { maxSpeed: r.maxSpeed, wallHits: r.wallHits, hazardHits: r.hazardHits, driftBoosts: r.driftBoosts },
    }));
  }

  updatePlaces() {
    const order = this.standings();
    order.forEach((r, i) => {
      const place = i + 1;
      if (r.isPlayer && place !== r.place && !r.finished && this.time > 1) {
        this.emit('position', { racer: r, from: r.place, to: place });
      }
      if (!r.finished || r.estimated) r.place = place;
    });
  }

  /** Puts a racer back on the centerline where it is, briefly untouchable. */
  respawn(r, reason) {
    const f = this.geo.at(r.s, {});
    r.x = f.x;
    r.y = f.y;
    r.heading = Math.atan2(f.ty, f.tx);
    r.vx = f.tx * 140;
    r.vy = f.ty * 140;
    r.angVel = 0;
    r.spinVel = 0;
    r.stun = 0;
    r.inLava = 0;
    r.stuck = 0;
    r.noProgress = 0;
    r.wrongWay = 0;
    r.needsReset = false;
    r.ghost = CONFIG.collision.ghostAfterRespawn;
    r.ti = f.i;
    r.cancelDrift();
    r.trackUpdate(this.geo, null);
    this.emit('respawn', { racer: r, reason });
  }

  /** Player asked for a reset (R key / reset button). */
  requestReset() {
    if (this.active && !this.player.finished) this.respawn(this.player, 'manual');
  }

  /* ------------------------------------------------------------- ghost */

  updateGhost(dt) {
    const p = this.player;
    if (this.mode !== 'timetrial') return;
    if (!p.finished) {
      this.recTimer += dt;
      while (this.recTimer >= REC_DT) {
        this.recTimer -= REC_DT;
        this.lapFrames.push(Math.round(p.x), Math.round(p.y), Math.round(p.heading * 100) / 100);
      }
    }
    const g = this.ghost;
    const gp = this.ghostPos;
    gp.visible = false;
    if (!g || p.finished) return;
    const t = (this.time - p.lapStart) / g.dt;
    const i = Math.floor(t);
    const f = g.frames;
    if (i < 0 || (i + 1) * 3 + 2 >= f.length) return;
    const k = t - i;
    gp.visible = true;
    gp.x = f[i * 3] + (f[i * 3 + 3] - f[i * 3]) * k;
    gp.y = f[i * 3 + 1] + (f[i * 3 + 4] - f[i * 3 + 1]) * k;
    let dh = f[i * 3 + 5] - f[i * 3 + 2];
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    gp.heading = f[i * 3 + 2] + dh * k;
  }

  closeGhostLap(p) {
    const lapTime = p.lapTimes[p.lapTimes.length - 1];
    if (lapTime != null && (!this.bestRun || lapTime < this.bestRun.time)) {
      this.bestRun = { time: lapTime, frames: this.lapFrames, dt: REC_DT, ship: p.ship.id };
    }
    this.lapFrames = [];
    this.recTimer = 0;
  }
}
