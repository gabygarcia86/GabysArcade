// Game sessions: one class runs every mode (championship, quick race, time trial, freestyle,
// free ride) on top of shared pieces: jet ski entities, the chase camera, effects emission,
// scoring, collectibles, weather events and results.
import * as THREE from 'three';
import { JetSkiBody, deriveHandling, FIXED_DT, collideBodies } from './physics.js';
import { JetSkiModel } from './jetSki.js';
import { Rider } from './rider.js';
import { TrickSystem } from './tricks.js';
import { WakeTrail, createBlobShadow, P_SPRAY, P_FOAM, P_BUBBLE } from './effects.js';
import { RaceTracker, GhostRecorder, GhostPlayer } from './racing.js';
import { AIDriver } from './ai.js';
import {
  skiById, RIVALS, BOSSES, CUPS, DIFFICULTY, TRICKS, RACE_POINTS, POSITION_COINS,
  CHALLENGES, SHOWDOWN_SECONDS, MPH, SKIS, DEFAULT_RIDER, HAIR_STYLES, SKIN_TONES, HAIR_COLORS, FACES,
} from './data.js';
import { ENVIRONMENTS } from './environments.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();

// ---------------------------------------------------------------- Jet ski + rider entity
export class SkiEntity {
  constructor(app, o) {
    this.app = app;
    this.name = o.name || 'You';
    this.isPlayer = !!o.isPlayer;
    this.persona = o.persona || null;
    this.skiId = o.skiId;
    this.custom = o.custom;
    this.body = new JetSkiBody(app.physics, o.handling);
    this.model = new JetSkiModel(o.skiId, o.custom, { lowDetail: !this.isPlayer && app.quality === 'low' });
    this.rider = new Rider(o.look, { lowDetail: !this.isPlayer && app.quality !== 'high' });
    this.model.body.add(this.rider.root);
    this.rider.fitToSki(this.model);
    const shadows = app.quality !== 'low' && (this.isPlayer || app.quality === 'high');
    this.model.group.traverse((m) => { if (m.isMesh) m.castShadow = shadows && m.castShadow; });
    app.scene.add(this.model.group);
    this.wake = new WakeTrail(app.water.normalTex, this.isPlayer ? 90 : 56);
    app.scene.add(this.wake.mesh);
    this.shadow = createBlobShadow();
    app.scene.add(this.shadow);
    this.tricks = new TrickSystem(this.isPlayer);
    this.acc = { spray: 0, foam: 0, side: 0, drip: 0, bubble: 0 };
    this.crashT = 0;
    this.riderVel = new THREE.Vector3();
    this.riderSpin = new THREE.Vector3();
    this.celebrate = false;
    this.safe = { x: 0, z: 0, yaw: 0, t: 0 };
    this.stern = new THREE.Vector3();
    this.prevWet = 0;
  }

  place(x, z, yaw) {
    this.body.place(x, z, yaw);
    this.wake.reset();
    this.tricks.reset();
    this.model.trickPivot.rotation.set(0, 0, 0);
    this.safe.x = x; this.safe.z = z; this.safe.yaw = yaw;
    // After a wipeout the rider is floating in the scene: put them back on the seat.
    if (this.rider.root.parent !== this.model.body) this.restoreRider();
    this.crashT = 0;
    this.body.boost = this.body.h.boostMax;
  }

  crash() {
    if (this.crashT > 0) return;
    this.crashT = 2.2;
    this.body.crashed = true;
    this.tricks.reset();
    this.model.trickPivot.rotation.set(0, 0, 0);
    this.app.scene.attach(this.rider.root);
    this.riderVel.copy(this.body.vel).multiplyScalar(0.7);
    this.riderVel.y = Math.max(this.riderVel.y, 0) + 4;
    this.riderSpin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8);
  }

  restoreRider() {
    this.model.body.add(this.rider.root);
    this.rider.root.position.copy(this.model.seatTop);
    this.rider.root.rotation.set(0, 0, 0);
    this.rider.root.scale.setScalar(this.rider.look.body === 'female' ? 0.96 : 1);
    this.rider.snap();
    this.body.crashed = false;
  }

  visual(alpha, dt, now, cam) {
    const app = this.app;
    const b = this.body;
    const g = this.model.group;
    b.interpolate(alpha);
    g.position.copy(b.renderPos);
    g.quaternion.copy(b.renderQuat);
    this.model.setSteer(b.input.steer);
    const d2 = g.position.distanceToSquared(cam);
    const far = !this.isPlayer && d2 > 200 * 200;
    if (this.crashT > 0) {
      // Rider tumbles off and bobs in the water.
      const r = this.rider.root;
      this.riderVel.y -= 9.8 * dt;
      r.position.addScaledVector(this.riderVel, dt);
      const h = app.waves.heightAt(r.position.x, r.position.z) - 0.6;
      if (r.position.y < h) {
        r.position.y = h;
        this.riderVel.multiplyScalar(0.9);
        this.riderVel.y = 0;
        this.riderSpin.multiplyScalar(0.9);
      }
      r.rotation.x += this.riderSpin.x * dt;
      r.rotation.y += this.riderSpin.y * dt;
      r.rotation.z += this.riderSpin.z * dt;
    } else if (!far) {
      this.rider.update(dt, {
        steer: b.input.steer, throttle: b.input.throttle, brake: b.input.brake,
        airborne: b.airborne, trickPose: this.tricks.pose, speed: b.speed, celebrate: this.celebrate,
      });
    }
    this.rider.root.visible = !far || this.crashT > 0;

    // Wake, shadow and spray.
    this.stern.copy(this.model.nozzleLocal).applyQuaternion(b.renderQuat).add(b.renderPos);
    const inWater = b.rearWet > 0 && !b.airborne;
    this.wake.track(now, this.stern.x, this.stern.z, b.fwdFlat.x, b.fwdFlat.z, b.speed, inWater);
    this.wake.uniforms.uColor.value.setScalar(app.sprayTint);
    this.wake.update(now, app.waves);
    const wh = app.waves.heightAt(b.renderPos.x, b.renderPos.z);
    const ground = Math.max(wh, app.physics.ramps.length ? app.physics.rampSurface(b.renderPos.x, b.renderPos.z) : -Infinity);
    const hgt = b.renderPos.y - ground;
    this.shadow.position.set(b.renderPos.x, ground + 0.06, b.renderPos.z);
    this.shadow.rotation.set(-Math.PI / 2, 0, b.yaw());
    this.shadow.material.opacity = Math.max(0, Math.min(0.55, 0.65 - hgt * 0.05));
    this.shadow.visible = hgt > 0.25 && !far;
    if (!far) this.emit(dt, wh);
  }

  emit(dt, wh) {
    const app = this.app;
    const P = app.particles;
    const b = this.body;
    const dens = app.particleDensity * (this.isPlayer ? 1 : 0.5);
    const fwd = b.fwd;
    const sp = b.speed;
    const light = app.sprayTint;
    const a = this.acc;
    if (b.rearWet > 0 && !b.airborne && sp > 2.5 && this.crashT <= 0) {
      // Rooster tail from the jet nozzle.
      a.spray += dt * (sp * 2.2 + (b.boosting ? 30 : 0)) * dens;
      while (a.spray > 1) {
        a.spray -= 1;
        const lift = 3 + sp * 0.2 + (b.boosting ? 3 : 0);
        P.emit(this.stern.x, wh + 0.2, this.stern.z,
          -fwd.x * sp * 0.3 + (Math.random() - 0.5) * 2, lift * (0.7 + Math.random() * 0.5), -fwd.z * sp * 0.3 + (Math.random() - 0.5) * 2,
          0.6 + Math.random() * 0.5, 0.2, 0.95 + sp * 0.025, 0.55, light, light, light, 9.8, 0.7, P_SPRAY);
      }
      // Foam on the surface behind the hull.
      a.foam += dt * sp * 0.9 * dens;
      while (a.foam > 1) {
        a.foam -= 1;
        P.emit(this.stern.x + (Math.random() - 0.5) * 1.2, wh, this.stern.z + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5, 1.6 + Math.random(), 0.6, 1.8, 0.32, light, light, light, 0, 1.2, P_FOAM);
      }
      // Exhaust bubbles fizzing at the stern.
      a.bubble += dt * sp * 0.5 * dens;
      while (a.bubble > 1) {
        a.bubble -= 1;
        P.emit(this.stern.x + (Math.random() - 0.5) * 0.5, wh + 0.05, this.stern.z + (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.45, 0.12, 0.22, 0.8, light * 0.85, light, light, -1, 1, P_BUBBLE);
      }
      // Side sheets of spray when carving hard.
      const st = b.input.steer;
      if (Math.abs(st) > 0.35 && sp > 9) {
        a.side += dt * sp * Math.abs(st) * 2.4 * dens;
        const s = Math.sign(st);
        _side.set(-fwd.z, 0, fwd.x).multiplyScalar(-s); // outside of the turn
        while (a.side > 1) {
          a.side -= 1;
          const px = b.renderPos.x + _side.x * 0.6 - fwd.x * 0.3, pz = b.renderPos.z + _side.z * 0.6 - fwd.z * 0.3;
          P.emit(px, wh + 0.1, pz,
            _side.x * sp * 0.28 + fwd.x * sp * 0.2, 2 + Math.random() * 2.5, _side.z * sp * 0.28 + fwd.z * sp * 0.2,
            0.6, 0.15, 0.8, 0.5, light, light, light, 9.8, 0.9, P_SPRAY);
        }
      }
      // Bow slamming into chop.
      if ((b.depths[0] > 0.3 || b.depths[1] > 0.3) && Math.random() < dt * 20) {
        for (let k = 0; k < 6 * dens; k++) {
          P.emit(b.renderPos.x + fwd.x * 1.3, wh + 0.2, b.renderPos.z + fwd.z * 1.3,
            (Math.random() - 0.5) * 4 + fwd.x * sp * 0.4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4 + fwd.z * sp * 0.4,
            0.55, 0.2, 0.8, 0.5, light, light, light, 9.8, 0.8, P_SPRAY);
        }
      }
    } else if (b.airborne) {
      // Water streaming off the hull in the air.
      a.drip += dt * 18 * dens * Math.max(0, 1 - b.airTime);
      while (a.drip > 1) {
        a.drip -= 1;
        P.emit(b.renderPos.x + (Math.random() - 0.5), b.renderPos.y - 0.3, b.renderPos.z + (Math.random() - 0.5),
          b.vel.x * 0.85, b.vel.y * 0.6 - 1, b.vel.z * 0.85, 0.8, 0.12, 0.3, 0.7, light, light, light, 9.8, 0.2, P_SPRAY);
      }
    }
  }

  splash(strength) {
    const P = this.app.particles;
    const b = this.body;
    const light = this.app.sprayTint;
    const wh = this.app.waves.heightAt(b.pos.x, b.pos.z);
    const n = Math.round(Math.min(110, 18 + strength * 10) * this.app.particleDensity);
    for (let k = 0; k < n; k++) {
      const ang = Math.random() * Math.PI * 2;
      const v = 2 + Math.random() * (3 + strength * 0.5);
      P.emit(b.pos.x + Math.cos(ang) * 0.8, wh + 0.1, b.pos.z + Math.sin(ang) * 0.8,
        Math.cos(ang) * v + b.vel.x * 0.3, 2 + Math.random() * (2 + strength * 0.7), Math.sin(ang) * v + b.vel.z * 0.3,
        0.7 + Math.random() * 0.6, 0.25, 1.1 + strength * 0.08, 0.6, light, light, light, 9.8, 0.7, P_SPRAY);
    }
    for (let k = 0; k < n * 0.4; k++) {
      const ang = Math.random() * Math.PI * 2;
      P.emit(b.pos.x + Math.cos(ang) * 1.5, wh, b.pos.z + Math.sin(ang) * 1.5, Math.cos(ang) * 2.5, 0, Math.sin(ang) * 2.5, 2.2, 0.8, 2.4, 0.4, light, light, light, 0, 1.4, P_FOAM);
    }
  }

  dispose() {
    this.model.group.removeFromParent();
    this.rider.root.removeFromParent();
    this.wake.mesh.removeFromParent();
    this.shadow.removeFromParent();
    this.wake.mesh.geometry.dispose();
    this.wake.mesh.material.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
    this.model.dispose();
    this.rider.dispose();
  }
}

// ---------------------------------------------------------------- Chase camera
export class ChaseCam {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.heading = new THREE.Vector3(0, 0, 1);
    this.mode = 0;
    this.shake = 0;
    this.fov = 62;
    this.orbit = 0;
  }

  snap(e) {
    const b = e.body;
    this.heading.copy(b.fwdFlat);
    this.pos.copy(b.pos).addScaledVector(this.heading, -8).add(_v.set(0, 3, 0));
    this.look.copy(b.pos);
  }

  update(dt, e, waves, celebrate = false) {
    const b = e.body;
    const cam = this.camera;
    if (celebrate) {
      // Orbit the winner.
      this.orbit += dt * 0.45;
      const r = 7.5;
      _v.set(b.renderPos.x + Math.sin(this.orbit) * r, b.renderPos.y + 2.4, b.renderPos.z + Math.cos(this.orbit) * r);
      this.pos.lerp(_v, 1 - Math.exp(-dt * 3));
      this.look.lerp(_v2.copy(b.renderPos).add(_up.set(0, 1, 0)), 1 - Math.exp(-dt * 5));
    } else {
      const rate = b.airborne ? 1.6 : 4.5;
      this.heading.lerp(b.fwdFlat, 1 - Math.exp(-dt * rate)).normalize();
      if (this.heading.lengthSq() < 0.1) this.heading.copy(b.fwdFlat);
      const modes = [[7.2, 2.7], [11, 4.2], [5, 1.5]];
      const [dist, height] = modes[this.mode];
      const dd = dist + Math.min(b.speed, 35) * 0.05;
      _v.copy(b.renderPos).addScaledVector(this.heading, -dd);
      _v.y = b.renderPos.y * (b.airborne ? 0.7 : 1) + height + (b.airborne ? b.heightAboveWater * 0.2 : 0);
      this.pos.lerp(_v, 1 - Math.exp(-dt * 7));
      _v2.copy(b.renderPos).addScaledVector(this.heading, 5).add(_up.set(0, 1.1, 0));
      this.look.lerp(_v2, 1 - Math.exp(-dt * 12));
    }
    const floor = waves.heightAt(this.pos.x, this.pos.z) + 1.1;
    if (this.pos.y < floor) this.pos.y = floor;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    cam.position.copy(this.pos);
    if (this.shake > 0) {
      const s = this.shake * 0.25;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.look);
    const target = 60 + Math.min(14, b.speed * 0.38) + (b.boosting ? 7 : 0);
    this.fov += (target - this.fov) * (1 - Math.exp(-dt * 3));
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}

// ---------------------------------------------------------------- Helpers
export function playerLoadout(save, skiId) {
  const d = save.data;
  const id = skiId || d.skis.selected;
  const def = skiById(id);
  return {
    skiId: id,
    custom: { ...def.colors, ...d.skis.custom[id] },
    look: { ...d.rider },
    handling: deriveHandling(def.stats, save.upgradeLevels(id)),
  };
}

function randomLook(seed) {
  let s = seed * 7919;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  return {
    ...DEFAULT_RIDER,
    body: r() < 0.5 ? 'male' : 'female', skin: pick(SKIN_TONES), hair: pick(HAIR_STYLES).id, hairColor: pick(HAIR_COLORS), face: pick(FACES).id,
    top: pick(['wetsuit', 'rashguard', 'jersey', 'prosuit']), helmet: pick(['full', 'visor', 'open', 'none']), eyewear: pick(['none', 'goggles', 'sunglasses']),
    vest: pick(['race', 'classic', 'pro']), bottom: pick(['wetsuit', 'racepants', 'boardshorts']),
  };
}

function aiEntity(app, persona, diff, index, playerStats) {
  const def = skiById(persona.ski);
  const bonus = persona.bonus || 1;
  // Rivals ride their own skis, but performance is pulled toward the player's machine so
  // races stay close whether you're on the starter ski or the Ultimate Pro. Bosses use theirs.
  const mix = persona.boss ? 0.75 : 0.3;
  const stats = {};
  for (const k of ['speed', 'handling', 'accel', 'stability']) stats[k] = playerStats[k] + (def.stats[k] - playerStats[k]) * mix;
  const handling = deriveHandling(stats, {}, { speed: diff.speed * bonus, accel: diff.accel * bonus, corner: diff.corner * (persona.boss ? 1.08 : 1) });
  const look = randomLook(index + 3 + persona.name.length);
  look.topColor = persona.main;
  look.accentColor = persona.secondary;
  look.vestColor = persona.secondary;
  look.helmetColor = persona.main;
  look.bottomColor = persona.secondary;
  return new SkiEntity(app, {
    name: persona.name, persona, skiId: persona.ski, handling, look,
    custom: { ...def.colors, main: persona.main, secondary: persona.secondary, number: persona.number },
  });
}

function medalTimes(track) {
  const L = track.length * 3;
  return { gold: Math.round(L / 24.5), silver: Math.round(L / 22), bronze: Math.round(L / 19.5) };
}

// ---------------------------------------------------------------- Session
export class GameSession {
  // config: { mode, env, weather, laps, difficulty, freestyle, challenge, cup, raceIndex, ghost }
  constructor(app, config) {
    this.app = app;
    this.cfg = config;
    this.ui = app.ui;
    this.save = app.save;
    this.time = 0;
    this.raceTime = 0;
    this.acc = 0;
    this.paused = false;
    this.over = false;
    this.entities = [];
    this.ai = [];
    this.events = [];
    this.messages = [];
    this.stats = { tricks: 0, bestCombo: 0, crashes: 0, air: 0, trickPoints: 0, backflips: 0, landings: 0, distance0: 0 };
    this.score = 0;
    this.cleanScore = 0;
    this.countdown = 0;
    this.go = false;
    this.megaT = 12;
    this.weatherT = 45 + Math.random() * 40;
    this.finishT = 0;
    this.envId = config.env;
    this.def = ENVIRONMENTS[config.env];
    this.cam = new ChaseCam(app.camera);
    this.cam.mode = { near: 0, far: 1, low: 2 }[app.save.settings.camera] ?? 0;
    this.challenge = config.challenge ? CHALLENGES.find((c) => c.id === config.challenge) : null;
    this.newAchievements = [];
    this.setup();
  }

  get mode() { return this.cfg.mode; }
  get racing() { return this.mode === 'championship' || this.mode === 'quick'; }
  get timed() { return this.mode === 'timetrial'; }
  get stunt() { return this.mode === 'freestyle'; }

  setup() {
    const app = this.app;
    const env = app.loadEnvironment(this.cfg.env, this.cfg.weather);
    this.env = env;
    const lo = playerLoadout(this.save, this.cfg.skiId);
    this.player = new SkiEntity(app, { ...lo, isPlayer: true, name: 'You' });
    this.entities.push(this.player);
    const track = env.track;

    if (this.racing || this.timed) {
      this.laps = this.cfg.laps || 3;
      this.tracker = new RaceTracker(track, this.laps);
      const grid = [];
      for (let row = 0; row < 3; row++) {
        for (const lat of [0.35, -0.35]) {
          const i = track.indexAt(track.length - 14 - row * 13 - (lat > 0 ? 0 : 6));
          const p = track.offsetPoint(i, lat * track.halfWidth, { x: 0, z: 0 });
          grid.push({ x: p.x, z: p.z, yaw: Math.atan2(track.tx[i], track.tz[i]) });
        }
      }
      if (this.racing) {
        const diff = DIFFICULTY[this.cfg.difficulty] || DIFFICULTY.medium;
        this.diff = diff;
        let personas;
        if (this.mode === 'championship') {
          const cup = CUPS.find((c) => c.id === this.cfg.cup);
          const race = cup.races[this.cfg.raceIndex];
          const offset = CUPS.indexOf(cup) * 2;
          personas = [0, 1, 2, 3, 4].map((k) => RIVALS[(k + offset) % RIVALS.length]);
          if (race.boss) personas[0] = BOSSES[race.boss];
          this.boss = race.boss ? BOSSES[race.boss].name : null;
        } else {
          const start = Math.floor(Math.random() * RIVALS.length);
          personas = [0, 1, 2, 3, 4].map((k) => RIVALS[(start + k) % RIVALS.length]);
        }
        const slots = [0, 1, 3, 4, 5];
        const ps = skiById(lo.skiId).stats;
        const up = this.save.upgradeLevels(lo.skiId);
        const playerStats = { speed: ps.speed + up.engine * 0.25, handling: ps.handling + up.steering * 0.25, accel: ps.accel + up.accel * 0.25, stability: ps.stability + up.stability * 0.25 };
        personas.forEach((p, k) => {
          const e = aiEntity(app, p, diff, k, playerStats);
          const g = grid[slots[k]];
          e.place(g.x, g.z, g.yaw);
          this.entities.push(e);
          const racer = this.tracker.addRacer({ body: e.body, name: p.name, entity: e, isPlayer: false });
          this.ai.push(new AIDriver(racer, track, app.physics, p, diff, k + 1));
        });
        this.player.place(grid[2].x, grid[2].z, grid[2].yaw);
      } else {
        this.player.place(grid[0].x, grid[0].z, grid[0].yaw);
        this.medals = medalTimes(track);
        this.recorder = new GhostRecorder();
        const ghost = this.cfg.ghost !== false ? this.save.loadGhost(this.cfg.env) : null;
        if (ghost && ghost.f && ghost.f.length > 14) this.setupGhost(ghost);
      }
      this.playerRacer = this.tracker.addRacer({ body: this.player.body, name: 'You', entity: this.player, isPlayer: true });
      this.countdown = 3.6;
    } else if (this.stunt) {
      this.player.place(env.spawn.x, env.spawn.z, env.spawn.yaw);
      const t = this.challenge ? this.challenge.time : this.cfg.freestyle === 'showdown' ? SHOWDOWN_SECONDS : 0;
      this.timeLeft = t;
      this.countdown = 3.6;
      this.challengeState = { backflips: 0, done: false };
    } else {
      this.player.place(env.spawn.x, env.spawn.z, env.spawn.yaw);
      this.go = true;
      this.msg(`${this.def.name}`, 'big', 2.5);
      this.msg('Explore, find golden shells and hidden places', 'small', 3.5);
    }
    // Hide shells that were already collected.
    for (const s of env.shells) if (this.save.data.collect.shells.includes(s.id)) { s.taken = true; s.obj.visible = false; }
    this.cam.snap(this.player);
    this.stats.distance0 = 0;
    app.audio.playMusic(this.stunt ? 'stunt' : 'race');
    this.ui.showHUD(this);
  }

  setupGhost(data) {
    const model = new JetSkiModel(data.ski || 'paradise100', data.custom || {}, { lowDetail: true });
    model.group.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.35;
        o.material.depthWrite = false;
        o.castShadow = false;
      }
    });
    this.app.scene.add(model.group);
    this.ghostModel = model;
    this.ghost = new GhostPlayer(data, model.group);
    this.ghostBest = data.time;
  }

  msg(text, cls = '', dur = 2) {
    this.ui.message(text, cls, dur);
  }

  achievement(id) {
    const a = this.save.unlock(id);
    if (a) {
      this.newAchievements.push(a);
      this.ui.toast(`🏆 ${a.name} · +${a.reward} coins`);
      this.app.audio.coin();
    }
  }

  respawn(racerOrEntity) {
    const r = racerOrEntity.entity ? racerOrEntity : null;
    const e = r ? r.entity : racerOrEntity;
    const tr = this.env.track;
    if (tr && (this.racing || this.timed || (this.env.def.river))) {
      const i = r ? r.idx : tr.nearest(e.body.pos.x, e.body.pos.z);
      const back = tr.wrap(i - 4);
      e.place(tr.x[back], tr.z[back], Math.atan2(tr.tx[back], tr.tz[back]));
      if (r) { r.offTrackT = 0; r.wrongWayT = 0; }
      // Keep checkpoint crossing state consistent after teleporting.
      if (r && this.tracker) {
        this.tracker.cps.forEach((cp, k) => { r.cpSide[k] = this.tracker.side(cp, e.body.pos); });
      }
    } else {
      e.place(e.safe.x, e.safe.z, e.safe.yaw);
    }
  }

  // ---------------------------------------------------------------- Frame
  update(dt) {
    if (this.paused) return;
    const app = this.app;
    const input = app.input;
    const P = this.player;
    this.time += dt;

    // Countdown.
    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.6);
      if (n !== this.lastCount && n >= 1 && n <= 3) { this.lastCount = n; this.ui.countdown(String(n)); app.audio.countdown(false); }
      if (this.countdown <= 0.6 && !this.go) {
        this.go = true;
        this.ui.countdown('GO!');
        app.audio.countdown(true);
      }
    }
    if (this.go && !this.over) this.raceTime += dt;

    // Player controls.
    const st = input.state(app.save.settings.autoThrottle && input.usingTouch);
    const bi = P.body.input;
    const canDrive = this.go && !this.finished;
    bi.throttle = canDrive ? st.throttle : 0;
    bi.brake = canDrive ? st.brake : 0;
    bi.steer = canDrive ? st.steer : 0;
    if (canDrive && st.boost && !P.body.boosting && P.body.boost > 5) {
      if (!this.boostHeld) app.audio.boostStart();
    }
    this.boostHeld = st.boost;
    bi.boost = canDrive && st.boost;
    bi.jump = canDrive && input.pressed.has('jump');
    if (input.consume('camera')) { this.cam.mode = (this.cam.mode + 1) % 3; app.save.settings.camera = ['near', 'far', 'low'][this.cam.mode]; }
    if (canDrive) {
      for (const t of input.trickPresses()) {
        const id = P.tricks.request(t, input.is('jump'), P.body);
        if (id) { app.audio.trickStart(); this.ui.trickName(TRICKS[id].name); }
      }
    }
    // AI.
    const actx = {
      go: this.go, tricks: null, playerProgress: this.playerRacer ? this.playerRacer.progress : null,
      respawn: (r) => this.respawn(r), cruise: true,
    };
    for (const d of this.ai) { actx.tricks = d.r.entity.tricks; d.update(dt, actx); }

    // Fixed-step physics.
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= FIXED_DT) {
      this.acc -= FIXED_DT;
      app.waves.update(FIXED_DT);
      for (const e of this.entities) e.body.step(FIXED_DT);
      for (let i = 0; i < this.entities.length; i++) {
        for (let j = i + 1; j < this.entities.length; j++) {
          const hit = collideBodies(this.entities[i].body, this.entities[j].body);
          if (hit > 4 && (i === 0 || j === 0)) { app.audio.bump(); this.cam.shake = Math.min(1, hit / 10); }
        }
      }
      bi.jump = false;
    }
    const alpha = this.acc / FIXED_DT;

    // Per-entity events, tricks and visuals.
    const now = this.time;
    for (const e of this.entities) this.entityEvents(e, dt);
    for (const e of this.entities) {
      const done = e.tricks.update(dt, e.body, e.model);
      if (done && e === P) this.ui.trickDone(TRICKS[done].name);
      e.visual(alpha, dt, now, app.camera.position);
      if (e.crashT > 0) {
        e.crashT -= dt;
        if (e.crashT <= 0) {
          const racer = this.tracker && this.tracker.racers.find((r) => r.entity === e);
          if (racer) this.respawn(racer); else this.respawn(e);
        }
      } else if (!e.body.airborne && e.body.wet > 0) {
        e.safe.t += dt;
        if (e.safe.t > 1) { e.safe.t = 0; e.safe.x = e.body.pos.x; e.safe.z = e.body.pos.z; e.safe.yaw = e.body.yaw(); }
      }
    }

    if (this.tracker) this.updateRace(dt);
    if (this.stunt) this.updateStunt(dt);
    if (this.mode === 'freeride') this.updateFree(dt);
    this.updateWorld(dt);

    // Camera, audio, HUD.
    this.cam.update(dt, P, app.waves, this.finished && this.celebrateCam);
    const b = P.body;
    const rival = this.ai.length ? Math.min(...this.ai.map((d) => d.r.body.pos.distanceTo(b.pos))) : null;
    app.audio.updateEngine({
      rpm: Math.min(1, (b.input.throttle * 0.55 + b.speed / b.h.maxSpeed * 0.6) * (b.airborne ? 1.1 : 1)), speed: b.speed,
      wet: b.wet > 0 ? 1 : 0, boost: b.boosting, on: !b.crashed, airborne: b.airborne, rivalDist: rival,
    });
    this.ui.updateHUD(this, dt);
    input.endFrame();
  }

  entityEvents(e, dt) {
    const b = e.body;
    const ev = b.events;
    const isP = e === this.player;
    const app = this.app;
    if (ev.jumped) {
      ev.jumped = false;
      if (isP) app.audio.jump();
    }
    if (ev.hit) {
      const h = ev.hit;
      ev.hit = null;
      if (isP && h.speed > 3) {
        app.audio.bump();
        this.cam.shake = Math.min(1.2, h.speed / 10);
        if (h.speed > 7) e.splash(h.speed * 0.4);
      }
      if (h.speed > 17 && h.kind !== 'buoy' && h.kind !== 'bank') {
        e.crash();
        if (isP) this.onCrash('Wipeout!');
      }
    }
    if (ev.landed) {
      const info = ev.landed;
      ev.landed = null;
      const strength = Math.max(0, info.vy);
      if (info.airTime > 0.35) {
        e.splash(strength * 0.8);
        e.rider.land(Math.min(1, strength / 9));
      }
      if (b.crashed) return;
      const res = e.tricks.land(info, b, e.model, b.h.landTolerance);
      if (!isP) {
        if (res.crash) e.crash();
        return;
      }
      if (info.airTime > 0.35) {
        app.audio.land(Math.min(1.4, strength / 8));
        this.cam.shake = Math.min(1, strength / 12);
      }
      this.stats.air = Math.max(this.stats.air, info.airTime);
      if (info.airTime >= 4) this.achievement('air4');
      if (this.challenge && this.challenge.id === 'air5' && info.airTime >= 5) this.completeChallenge();
      if (res.crash) {
        e.crash();
        this.onCrash(res.lost ? `Combo lost!` : 'Wipeout!');
        return;
      }
      if (res.points > 0) this.onTricksLanded(res);
    }
  }

  onCrash(text) {
    const app = this.app;
    app.audio.crash();
    this.stats.crashes++;
    this.cleanScore = 0;
    this.cam.shake = 1.2;
    this.msg(text, 'bad', 1.8);
    if (this.challenge && this.challenge.id === 'clean10k') this.challengeState.clean = 0;
  }

  onTricksLanded(res) {
    const app = this.app;
    this.stats.tricks += res.tricks.length;
    this.stats.landings++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, res.comboCount);
    this.stats.trickPoints += res.points;
    for (const id of res.tricks) if (id === 'backflip' || id === 'doubleBackflip' || id === 'supermanBackflip') this.stats.backflips++;
    this.score += res.points;
    this.cleanScore += res.points;
    app.audio.trickLand(res.multiplier);
    this.ui.comboPopup(res);
    // Tricks refill boost.
    const b = this.player.body;
    b.boost = Math.min(b.h.boostMax, b.boost + res.points / 60);
    this.achievement('firstTrick');
    if (res.comboCount >= 3) this.achievement('combo3');
    if (res.comboCount >= 5) this.achievement('combo5');
    if (res.tricks.includes('doubleBackflip')) this.achievement('doubleFlip');
    const c = this.challenge;
    if (c && !this.challengeState.done) {
      if (c.id === 'backflips3' && this.stats.backflips >= 3) this.completeChallenge();
      if (c.id === 'combo4' && res.comboCount >= 4) this.completeChallenge();
      if (c.id === 'double' && res.uniqueCount >= 2) this.completeChallenge();
      if (c.id === 'clean10k' && this.cleanScore >= 10000) this.completeChallenge();
      if (c.id === 'score5k' && this.score >= 5000) this.completeChallenge();
    }
  }

  completeChallenge() {
    if (!this.challenge || this.challengeState.done) return;
    this.challengeState.done = true;
    this.msg('CHALLENGE COMPLETE!', 'good big', 3);
    this.app.audio.finish(true);
    this.endTimer = 2.5;
  }

  // ---------------------------------------------------------------- Racing
  updateRace(dt) {
    const tr = this.tracker;
    const app = this.app;
    const events = this.events;
    events.length = 0;
    tr.update(this.raceTime, dt, events);
    const pr = this.playerRacer;
    for (const ev of events) {
      if (!ev.racer.isPlayer) continue;
      if (ev.type === 'cp') app.audio.checkpoint();
      if (ev.type === 'lap') {
        app.audio.lap();
        const final = pr.lap === this.laps - 1;
        this.msg(final ? 'FINAL LAP!' : `LAP ${pr.lap + 1}/${this.laps}`, 'big', 2);
      }
      if (ev.type === 'finish') this.playerFinished();
    }
    if (pr.missed && !this.finished) this.ui.warn('Missed a checkpoint! Go back');
    else if (pr.wrongWayT > 1.2 && !this.finished) this.ui.warn('WRONG WAY');
    else this.ui.warn('');
    if (pr.offTrackT > 4 && !this.finished) {
      this.respawn(pr);
      this.msg('Back on course', 'small', 1.5);
    }
    if (this.env.gates.length) this.env.highlightGate(this.finished ? -1 : pr.nextCp);
    if (this.recorder && this.go && !this.finished) this.recorder.update(dt, this.player.body);
    if (this.ghost) this.ghost.update(this.raceTime);
    if (this.finished) {
      this.finishT += dt;
      if (this.finishT > 4.5 && !this.over) this.endRace();
    }
  }

  playerFinished() {
    this.finished = true;
    const app = this.app;
    const pr = this.playerRacer;
    this.celebrateCam = true;
    const win = this.timed || pr.position === 1;
    this.player.celebrate = win || pr.position <= 3;
    app.audio.finish(win);
    this.msg(this.timed ? 'FINISH!' : `${pr.position === 1 ? 'YOU WIN!' : 'FINISHED ' + ['1st', '2nd', '3rd', '4th', '5th', '6th'][pr.position - 1]}`, 'big good', 4);
  }

  endRace() {
    this.over = true;
    const tr = this.tracker;
    const pr = this.playerRacer;
    const save = this.save;
    const d = save.data;
    const result = { mode: this.mode, env: this.envId, envName: this.def.name, laps: this.laps, time: pr.finishTime, bestLap: pr.bestLap, lapTimes: pr.lapTimes, tricks: this.stats.tricks, trickPoints: this.stats.trickPoints };
    let coins = 0;
    const rec = save.record(this.envId);
    if (pr.bestLap && (!rec.bestLap || pr.bestLap < rec.bestLap)) { rec.bestLap = pr.bestLap; result.newBestLap = true; coins += 100; }
    if (this.timed) {
      const t = pr.finishTime;
      result.medals = this.medals;
      result.medal = t <= this.medals.gold ? 'gold' : t <= this.medals.silver ? 'silver' : t <= this.medals.bronze ? 'bronze' : '';
      const order = ['', 'bronze', 'silver', 'gold'];
      if (order.indexOf(result.medal) > order.indexOf(rec.medal || '')) {
        coins += { gold: 500, silver: 300, bronze: 150 }[result.medal] || 0;
        rec.medal = result.medal;
        result.newMedal = true;
      }
      if (!rec.bestTT || t < rec.bestTT) {
        result.newRecord = !!rec.bestTT;
        rec.bestTT = t;
        save.saveGhost(this.envId, this.recorder.export(t, this.player.skiId, this.player.custom));
        coins += 150;
      }
      result.best = rec.bestTT;
      coins += 80;
      if (result.medal === 'gold') this.achievement('ttGold');
    } else {
      // Final standings: unfinished AI are ranked by progress.
      const order = tr.order.slice();
      // Riders still on course get a projected time from their average pace.
      const total = tr.track.length * this.laps;
      const projected = (r) => {
        const pace = Math.max(8, r.progress / Math.max(1, this.raceTime));
        return this.raceTime + Math.max(0, total - r.progress) / pace;
      };
      result.standings = order.map((r, i) => ({ name: r.name, isPlayer: r.isPlayer, pos: i + 1, time: r.finished ? r.finishTime : projected(r), est: !r.finished, boss: !!(r.entity.persona && r.entity.persona.boss) }));
      const pos = pr.position;
      result.position = pos;
      const diff = this.diff;
      coins += 100 + Math.round(POSITION_COINS[pos - 1] * diff.coins) + Math.round(this.stats.trickPoints / 100);
      if (!rec.bestRace || pr.finishTime < rec.bestRace) rec.bestRace = pr.finishTime;
      d.stats.races++;
      if (pos === 1) d.stats.wins++;
      if (pos <= 3) d.stats.podiums++;
      this.achievement('firstRace');
      if (pos === 1) this.achievement('firstWin');
      if (this.cfg.weather === 'night' || (this.cfg.weather === 'default' && this.def.weather === 'night')) this.achievement('nightRider');
      if (this.envId === 'storm') this.achievement('stormSurvivor');
      if (this.boss) {
        const bossR = order.find((r) => r.entity.persona && r.entity.persona.boss);
        if (bossR && pos < bossR.position) { this.achievement('beatBoss'); result.beatBoss = this.boss; }
      }
      if (this.mode === 'championship') this.championshipResult(result);
    }
    result.coins = save.addCoins(coins);
    this.finishCommon(result);
  }

  championshipResult(result) {
    const save = this.save;
    const d = save.data;
    const cup = CUPS.find((c) => c.id === this.cfg.cup);
    const state = d.cups[cup.id] || (d.cups[cup.id] = {});
    const run = state.run || { raceIndex: 0, points: {} };
    for (const s of result.standings) run.points[s.name] = (run.points[s.name] || 0) + RACE_POINTS[s.pos - 1];
    run.raceIndex = this.cfg.raceIndex + 1;
    result.cup = { id: cup.id, name: cup.name, race: this.cfg.raceIndex + 1, total: cup.races.length };
    result.cupPoints = Object.entries(run.points).map(([name, pts]) => ({ name, pts, isPlayer: name === 'You' })).sort((a, b) => b.pts - a.pts);
    if (run.raceIndex >= cup.races.length) {
      const place = result.cupPoints.findIndex((p) => p.isPlayer) + 1;
      result.cupFinal = place;
      const trophy = ['gold', 'silver', 'bronze'][place - 1] || '';
      result.trophy = trophy;
      const prize = cup.prize[place - 1] || 0;
      result.prize = save.addCoins(prize);
      if (!state.best || place < state.best) { state.best = place; state.trophy = trophy; }
      delete state.run;
      if (place <= 3) {
        this.achievement('cupPodium');
        const unlocks = [];
        for (const other of CUPS) if (other.unlock === cup.id && !d.cups[other.id]?.unlocked) { (d.cups[other.id] = d.cups[other.id] || {}).unlocked = true; unlocks.push(other.name); }
        if (cup.id === 'paradise') {
          for (const env of ['volcano', 'jungle', 'storm']) if (!d.unlockedCourses.includes(env)) { d.unlockedCourses.push(env); unlocks.push(ENVIRONMENTS[env].name); }
        }
        result.unlocks = unlocks;
      }
      if (place === 1) {
        this.achievement('cupWin');
        state.won = true;
        if (CUPS.every((c) => d.cups[c.id]?.won)) this.achievement('allCups');
      }
    } else {
      state.run = run;
      result.nextRace = run.raceIndex;
    }
  }

  // ---------------------------------------------------------------- Freestyle
  updateStunt(dt) {
    if (!this.go || this.over) return;
    const P = this.player;
    if (this.timeLeft > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.graceT = 0;
      }
    }
    const timeUp = (this.challenge ? this.challenge.time > 0 : this.cfg.freestyle === 'showdown') && this.timeLeft <= 0;
    if (timeUp && !this.endTimer) {
      // Let the current jump land before ending.
      this.graceT = (this.graceT || 0) + dt;
      if (!P.body.airborne || this.graceT > 5) this.endTimer = 0.01;
    }
    if (this.endTimer) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.endStunt();
    }
  }

  endStunt() {
    if (this.over) return;
    this.over = true;
    const save = this.save;
    const d = save.data;
    const result = { mode: 'freestyle', type: this.challenge ? 'challenge' : this.cfg.freestyle, score: this.score, tricks: this.stats.tricks, bestCombo: this.stats.bestCombo, air: this.stats.air, crashes: this.stats.crashes };
    let coins = Math.round(this.score / 50);
    if (this.cfg.freestyle === 'showdown' && !this.challenge) {
      result.prevBest = d.stunt.highScore;
      if (this.score > d.stunt.highScore) { d.stunt.highScore = this.score; result.newBest = true; coins += 200; }
      result.leaderboard = this.score > 0;
      result.seconds = SHOWDOWN_SECONDS;
      result.ski = this.player.skiId;
    } else if (!this.challenge) {
      if (this.score > d.stunt.endlessBest) { d.stunt.endlessBest = this.score; result.newBest = true; }
    }
    if (this.challenge) {
      result.challenge = this.challenge;
      result.success = this.challengeState.done;
      if (result.success && !d.stunt.challenges.includes(this.challenge.id)) {
        d.stunt.challenges.push(this.challenge.id);
        coins += this.challenge.reward;
        result.firstClear = true;
      }
      if (CHALLENGES.every((c) => d.stunt.challenges.includes(c.id))) this.achievement('allChallenges');
    }
    if (this.score >= 25000) this.achievement('score25k');
    result.coins = save.addCoins(coins);
    this.finishCommon(result);
  }

  quitEndless() {
    // Endless practice and free ride end from the pause menu.
    if (this.stunt) this.endStunt();
    else this.endFree();
  }

  // ---------------------------------------------------------------- Free ride
  updateFree() {
    // Nothing time-based; collectibles and places are handled in updateWorld.
  }

  endFree() {
    if (this.over) return;
    this.over = true;
    const coins = Math.round(this.stats.trickPoints / 100);
    const result = { mode: 'freeride', envName: this.def.name, tricks: this.stats.tricks, trickPoints: this.stats.trickPoints, shells: this.shellsFound || 0, places: this.placesFound || 0 };
    result.coins = this.save.addCoins(coins);
    this.finishCommon(result);
  }

  // ---------------------------------------------------------------- Shared world events
  updateWorld(dt) {
    const app = this.app;
    const env = this.env;
    const P = this.player;
    const b = P.body;
    const save = this.save;
    env.update(dt, app.camera.position);
    // Golden shells.
    for (const s of env.shells) {
      if (s.taken) continue;
      const dx = b.pos.x - s.x, dz = b.pos.z - s.z, dy = b.pos.y - s.obj.position.y;
      if (dx * dx + dz * dz + dy * dy < 4 * 4) {
        s.taken = true;
        s.obj.visible = false;
        if (!save.data.collect.shells.includes(s.id)) save.data.collect.shells.push(s.id);
        save.addCoins(100);
        this.shellsFound = (this.shellsFound || 0) + 1;
        app.audio.shell();
        this.msg('GOLDEN SHELL! +100', 'good', 2.2);
        const n = save.data.collect.shells.length;
        if (n >= 10) this.achievement('shells10');
        if (n >= 35) this.achievement('shellsAll');
        save.save();
      }
    }
    // Hidden places.
    for (const p of env.places) {
      if (save.data.collect.places.includes(p.id)) continue;
      const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
      if (dx * dx + dz * dz < p.r * p.r) {
        save.data.collect.places.push(p.id);
        save.addCoins(50);
        this.placesFound = (this.placesFound || 0) + 1;
        app.audio.coin();
        this.ui.toast(`📍 Discovered: ${p.name} · +50 coins`);
        if (save.data.collect.places.length >= 14) this.achievement('explorer');
        save.save();
      }
    }
    // Multiplier rings.
    for (const r of env.rings) {
      if (r.cool > 0 || !b.airborne) continue;
      const dx = b.pos.x - r.x, dy = b.pos.y - r.y, dz = b.pos.z - r.z;
      if (dx * dx + dy * dy + dz * dz < (r.r + 1) * (r.r + 1)) {
        r.cool = 3;
        P.tricks.ringBonus = 2;
        app.audio.coin();
        this.msg('RING BONUS x2!', 'good', 1.5);
      }
    }
    // Massive wave events.
    const mega = this.def.mega;
    if (mega && this.go) {
      this.megaT -= dt;
      if (this.megaT <= 0 && !app.waves.event.active) {
        this.megaT = mega.every[0] + Math.random() * (mega.every[1] - mega.every[0]);
        let ox, oz, ang;
        if (this.def.arena) {
          const a = Math.random() * Math.PI * 2;
          ox = Math.cos(a) * 60; oz = Math.sin(a) * 60;
          ang = Math.atan2(-oz, -ox) + (Math.random() - 0.5);
        } else {
          ox = b.pos.x + b.fwdFlat.x * 95; oz = b.pos.z + b.fwdFlat.z * 95;
          ang = Math.atan2(-b.fwdFlat.z, -b.fwdFlat.x) + (Math.random() - 0.5) * 0.5;
        }
        app.waves.startEvent(ox, oz, ang, { amp: mega.amp, width: 10, halfLen: 95, speed: 8, start: -60, life: 22 });
        this.msg('MEGA WAVE INCOMING!', 'warn big', 2.5);
        app.audio.wave();
      }
    }
    // Weather shifts.
    if (!this.def.arena && this.go) {
      this.weatherT -= dt;
      if (this.weatherT <= 0) {
        this.weatherT = 50 + Math.random() * 50;
        const base = app.baseWaveIntensity;
        const up = Math.random() < 0.5;
        app.waves.setIntensity(base * (up ? 1.3 + Math.random() * 0.15 : 0.8));
        this.msg(up ? 'The swell is building!' : 'The water is calming down', 'small', 2.5);
      }
    }
    // Lightning.
    if (app.lightning.update(dt, app.camera.position, app.lighting.lightning)) {
      this.thunderT = 0.8 + Math.random() * 1.6;
    }
    if (this.thunderT > 0) { this.thunderT -= dt; if (this.thunderT <= 0) app.audio.thunder(); }
    app.applyFlash(app.lightning.flash);
    save.data.stats.playSeconds += dt;
  }

  finishCommon(result) {
    const save = this.save;
    const d = save.data;
    d.stats.tricks += this.stats.tricks;
    d.stats.bestCombo = Math.max(d.stats.bestCombo, this.stats.bestCombo);
    d.stats.bestAir = Math.max(d.stats.bestAir, this.stats.air);
    d.stats.crashes += this.stats.crashes;
    d.stats.distance += this.player.body.distance;
    if (d.totalCoins >= 25000) this.achievement('rich');
    result.achievements = this.newAchievements.slice();
    result.config = this.cfg;
    save.save();
    this.app.audio.silenceEngine();
    this.ui.showResults(result);
  }

  setPaused(p) {
    if (this.over) return;
    this.paused = p;
    if (p) this.app.audio.silenceEngine();
  }

  dispose() {
    for (const e of this.entities) e.dispose();
    if (this.ghostModel) { this.ghostModel.group.removeFromParent(); this.ghostModel.dispose(); }
    this.app.particles.clear();
    this.app.waves.event.active = false;
  }
}

// ---------------------------------------------------------------- Menu background
export class AttractMode {
  constructor(app, envId) {
    this.app = app;
    this.env = app.loadEnvironment(envId, ENVIRONMENTS[envId].weather);
    const lo = playerLoadout(app.save);
    const t = this.env.track;
    const persona = { ...RIVALS[2], line: 0.1, flair: 1, aggression: 0.6, wobble: 0.1 };
    this.entity = new SkiEntity(app, { ...lo, name: 'Attract', handling: deriveHandling(skiById(lo.skiId).stats, {}, { speed: 0.9, accel: 1, corner: 1 }) });
    this.entity.place(t.x[0], t.z[0], Math.atan2(t.tx[0], t.tz[0]));
    this.racer = { body: this.entity.body, entity: this.entity, idx: 0, progress: 0, offTrackT: 0, wrongWayT: 0, finished: false };
    this.ai = new AIDriver(this.racer, t, app.physics, persona, DIFFICULTY.medium, 3);
    this.acc = 0;
    this.time = 0;
    this.angle = 0;
    this.camPos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.camPos.set(t.x[0] + 20, 8, t.z[0] - 20);
  }

  update(dt) {
    const app = this.app;
    const e = this.entity;
    const t = this.env.track;
    this.time += dt;
    this.racer.idx = t.nearest(e.body.pos.x, e.body.pos.z, this.racer.idx);
    this.ai.update(dt, { go: true, tricks: e.tricks, respawn: () => { const i = this.racer.idx; e.place(t.x[i], t.z[i], Math.atan2(t.tx[i], t.tz[i])); }, playerProgress: null });
    // Hop now and then for some air.
    if (Math.random() < dt * 0.25 && !e.body.airborne && e.body.speed > 15) e.body.input.jump = true;
    if (e.body.airborne && e.body.heightAboveWater > 1.2 && !e.tricks.busy && Math.random() < dt * 3) {
      e.tricks.request(['backflip', 'rollRight', 'spin', 'superman', 'noHander'][Math.floor(Math.random() * 5)], false, e.body);
    }
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= FIXED_DT) {
      this.acc -= FIXED_DT;
      app.waves.update(FIXED_DT);
      e.body.step(FIXED_DT);
      e.body.input.jump = false;
    }
    const ev = e.body.events;
    if (ev.landed) {
      const res = e.tricks.land(ev.landed, e.body, e.model, 0);
      void res;
      if (ev.landed.airTime > 0.35) e.splash(Math.max(0, ev.landed.vy) * 0.7);
      ev.landed = null;
    }
    ev.hit = null;
    ev.jumped = false;
    e.tricks.update(dt, e.body, e.model);
    e.visual(this.acc / FIXED_DT, dt, this.time, app.camera.position);
    this.env.update(dt, app.camera.position);
    // Slow cinematic orbit around the rider.
    this.angle += dt * 0.12;
    const p = e.body.renderPos;
    const r = 13 + Math.sin(this.time * 0.2) * 4;
    const target = _v.set(p.x + Math.sin(this.angle) * r, p.y + 3.5 + Math.sin(this.time * 0.3) * 1.5, p.z + Math.cos(this.angle) * r);
    this.camPos.lerp(target, 1 - Math.exp(-dt * 1.5));
    this.camPos.y = Math.max(this.camPos.y, app.waves.heightAt(this.camPos.x, this.camPos.z) + 1.5);
    this.look.lerp(_v2.copy(p).add(_up.set(0, 1, 0)), 1 - Math.exp(-dt * 4));
    app.camera.position.copy(this.camPos);
    app.camera.lookAt(this.look);
    if (app.camera.fov !== 55) { app.camera.fov = 55; app.camera.updateProjectionMatrix(); }
    app.lightning.update(dt, app.camera.position, app.lighting.lightning);
    app.applyFlash(app.lightning.flash);
  }

  refreshLoadout() {
    const app = this.app;
    const lo = playerLoadout(app.save);
    const old = this.entity;
    const body = old.body;
    const e = new SkiEntity(app, { ...lo, name: 'Attract', handling: body.h });
    e.body.pos.copy(body.pos); e.body.vel.copy(body.vel); e.body.quat.copy(body.quat); e.body.angVel.copy(body.angVel);
    e.body.prevPos.copy(body.pos); e.body.prevQuat.copy(body.quat);
    old.dispose();
    this.entity = e;
    this.racer.body = e.body;
    this.racer.entity = e;
    this.ai.r = this.racer;
  }

  dispose() {
    this.entity.dispose();
    this.app.particles.clear();
  }
}

export { SKIS, MPH };
