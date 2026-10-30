/**
 * Presentation of a running race: camera, world rendering, ships, trails,
 * particles, weather, screen effects, HUD notices and sound. It listens to the
 * race's events and never changes the simulation.
 */
import { CONFIG } from './config.js';
import { TrackRenderer } from './trackRenderer.js';
import { Camera } from './camera.js';
import { Particles } from './particles.js';
import { Minimap, drawHud } from './hud.js';
import { drawShip, nozzlePositions } from './shipRender.js';
import { glow } from './gfx.js';
import { getRosterShip } from './shipRoster.js';
import { ordinal, formatTime, clamp, TAU } from './utils.js';

const DUST = {
  sand: '#c98a52', snow: '#ffffff', moss: '#6a8a4a', grating: '#8a8f99', field: '#c58bff',
  lava: '#ff7a2a', scrap: '#bfa27a', hover: '#7fd8ff', dust: '#d9a670', slick: '#ffffff', ice: '#e8f6ff',
};

export class RaceView {
  constructor(race, ctx, settings, audio, opts = {}) {
    this.race = race;
    this.settings = settings;
    this.audio = audio;
    this.renderer = new TrackRenderer(race.track, race.geo, ctx);
    this.theme = this.renderer.theme;
    this.camera = new Camera();
    this.camera.snap(race.player.x, race.player.y);
    this.particles = new Particles(CONFIG.effects.maxParticles);
    this.minimap = new Minimap(race.geo, this.theme);
    this.messages = [];
    this.weather = [];
    this.trails = new Map();
    this.banks = new Map();
    this.t = 0;
    this.flash = 0;
    this.fireworkTimer = 2;
    this.recordLap = opts.recordLap;
    this.ghostGap = null;
    this.touchMode = false;
    this.touchInset = 0;
    this.racerColors = race.racers.map((r) => r.color);
    this.noz = [];
    this.prepareGhost();
    race.on((type, d) => this.onEvent(type, d));
    audio.startEngine();
    audio.startAmbient(this.theme.ambient);
    audio.startMusic(race.track.music);
  }

  destroy() {
    this.audio.stopEngine();
    this.audio.stopAmbient();
    this.particles.clear();
  }

  /* ---------------------------------------------------------- messages */

  say(text, o = {}) {
    if (o.replace) this.messages = this.messages.filter((m) => m.tag !== o.replace);
    this.messages.push({ text, sub: o.sub, color: o.color, big: !!o.big, dur: o.dur || 1.4, t: 0, slot: o.slot || 0, tag: o.replace });
    if (this.messages.length > 4) this.messages.shift();
  }

  volAt(x, y) {
    const d = Math.hypot(x - this.race.player.x, y - this.race.player.y);
    return clamp(1 - d / 1500, 0, 1);
  }

  onEvent(type, d) {
    const P = this.particles;
    const a = this.audio;
    const shake = (n) => this.camera.shake(n);
    switch (type) {
      case 'count':
        a.play('count');
        break;
      case 'go':
        a.play('go');
        this.say('GO!', { big: true, color: '#7dff8a', dur: 1 });
        break;
      case 'rocketStart':
        if (d.racer.isPlayer) {
          a.play('rocket');
          this.say('ROCKET START!', { color: '#ffd34a', dur: 1.4, slot: 1 });
        }
        this.exhaustBurst(d.racer, 14);
        break;
      case 'stall':
        if (d.racer.isPlayer) {
          a.play('stall');
          this.say('OVERHEATED', { sub: 'Wait for "1" next time', color: '#ff6a4a', dur: 1.6, slot: 1 });
        }
        break;
      case 'boostStart':
        a.play('boost', d.racer.isPlayer ? 1 : this.volAt(d.racer.x, d.racer.y) * 0.6);
        this.exhaustBurst(d.racer, 8);
        break;
      case 'driftBoost':
        a.play('drift' + d.tier, d.racer.isPlayer ? 1 : this.volAt(d.racer.x, d.racer.y) * 0.5);
        if (d.racer.isPlayer) this.say(['', 'DRIFT BOOST', 'SUPER DRIFT', 'ULTRA DRIFT'][d.tier], { color: CONFIG.drift.colors[d.tier - 1], dur: 0.9, slot: 1, replace: 'drift' });
        P.burst('spark', d.racer.x, d.racer.y, 10 + d.tier * 6, 420, 0.4, 3, 1, CONFIG.drift.colors[d.tier - 1]);
        break;
      case 'wallHit': {
        const n = Math.min(16, 4 + Math.floor(d.impact / 40));
        P.burst('spark', d.x, d.y, n, 380, 0.35, 3, 1, '#ffd38a');
        P.burst('glow', d.x, d.y, 2, 60, 0.3, 40, 10, '#ffb347');
        a.play('wall', (d.racer.isPlayer ? 1 : this.volAt(d.x, d.y) * 0.7) * clamp(d.impact / 300, 0.3, 1));
        if (d.racer.isPlayer) shake(Math.min(14, d.impact / 40));
        break;
      }
      case 'barrierHit':
        P.burst('spark', d.x, d.y, 10, 380, 0.35, 3, 1, '#ffd38a');
        a.play('wall', d.racer.isPlayer ? 1 : this.volAt(d.x, d.y) * 0.7);
        if (d.racer.isPlayer) shake(Math.min(14, d.impact / 35));
        break;
      case 'racerHit':
        P.burst('spark', d.x, d.y, 8, 300, 0.3, 2.5, 1, '#bfe8ff');
        a.play('bump', d.a.isPlayer || d.b.isPlayer ? 1 : this.volAt(d.x, d.y) * 0.6);
        if (d.a.isPlayer || d.b.isPlayer) shake(Math.min(10, d.impact / 40));
        break;
      case 'hazardHit': {
        const col = { probe: '#ff4a3a', shock: '#9fe4ff', lava: '#ff7a2a', rock: '#d9a26a', asteroid: '#c9b9a8' }[d.kind] || '#ffffff';
        P.burst('spark', d.racer.x, d.racer.y, 18, 460, 0.5, 3, 1, col);
        P.burst('glow', d.racer.x, d.racer.y, 4, 120, 0.4, 70, 20, col);
        P.burst('smoke', d.racer.x, d.racer.y, 6, 80, 1.1, 30, 90, '#55565c', { top: false });
        a.play(d.kind === 'shock' ? 'shock' : 'hazard', d.racer.isPlayer ? 1 : this.volAt(d.racer.x, d.racer.y));
        if (d.racer.isPlayer) {
          shake(16);
          this.flash = Math.max(this.flash, 0.25);
        }
        break;
      }
      case 'probeHit':
        a.play('probe', this.volAt(d.x, d.y));
        break;
      case 'rockLand': {
        const col = { ice: '#e8f6ff', log: '#7a5a36', scrap: '#9a8a70' }[d.look] || '#c98a52';
        P.burst('smoke', d.x, d.y, 10, 160, 1.2, 40, 120, col, { top: false });
        P.burst('chunk', d.x, d.y, 8, 260, 0.7, 10, 6, col);
        const v = this.volAt(d.x, d.y);
        a.play('rock', v);
        if (v > 0.6) shake(8 * v);
        break;
      }
      case 'eruption': {
        P.burst('glow', d.x, d.y, 14, 260, 0.9, 60, 20, '#ff8a2a');
        P.burst('smoke', d.x, d.y, 10, 120, 1.8, 50, 160, '#2a1a16', { top: true });
        P.burst('chunk', d.x, d.y, 10, 340, 0.8, 8, 5, '#ffb347');
        const v = this.volAt(d.x, d.y);
        a.play('explode', v);
        if (v > 0.5) shake(10 * v);
        break;
      }
      case 'ventWarn':
      case 'asteroidWarn':
        a.play('warn', this.volAt(d.x, d.y));
        break;
      case 'gateOn':
        a.play('zap', this.volAt(d.x, d.y));
        break;
      case 'sandstormWarn':
        this.say('SANDSTORM INCOMING', { sub: 'Crosswinds on the main straight', color: '#ffc26a', dur: 2.2, slot: 1, replace: 'storm' });
        a.play('warn');
        break;
      case 'boostPad':
        a.play('pad', d.racer.isPlayer ? 1 : this.volAt(d.racer.x, d.racer.y) * 0.5);
        P.burst('glow', d.racer.x, d.racer.y, 6, 200, 0.4, 40, 10, '#38d6ff');
        break;
      case 'respawn':
        P.burst('ring', d.racer.x, d.racer.y, 1, 0, 0.6, 10, 120, '#7fd8ff', { drag: 0 });
        P.burst('glow', d.racer.x, d.racer.y, 8, 160, 0.5, 40, 10, '#7fd8ff');
        if (d.racer.isPlayer) {
          a.play('respawn');
          this.say(d.reason === 'lava' ? 'RESCUED FROM THE LAVA' : 'BACK ON TRACK', { color: '#7fd8ff', dur: 1.3, slot: 1 });
        }
        break;
      case 'lap':
        if (d.racer.isPlayer && !d.racer.finished) {
          const best = d.time <= d.racer.bestLap + 1e-6 && d.racer.lapTimes.length > 1;
          const sub = `${formatTime(d.time)}${best ? '  ·  BEST LAP' : ''}`;
          if (d.lap === CONFIG.laps) {
            a.play('finalLap');
            this.say('FINAL LAP', { sub, big: true, color: '#ffd34a', dur: 2 });
          } else {
            a.play('lap');
            this.say(`LAP ${d.lap}`, { sub, big: true, dur: 1.6 });
          }
        }
        break;
      case 'position':
        if (d.to < d.from) {
          a.play('posUp');
          this.say(`▲ ${ordinal(d.to)}`, { color: '#7dff8a', dur: 1.1, slot: 2, replace: 'pos' });
        } else {
          a.play('posDown');
          this.say(`▼ ${ordinal(d.to)}`, { color: '#ff6a6a', dur: 1.1, slot: 2, replace: 'pos' });
        }
        break;
      case 'finish':
        if (d.racer.isPlayer) {
          a.play(d.place === 1 && this.race.mode !== 'timetrial' ? 'win' : 'finish');
          const sub = this.race.mode === 'timetrial' ? formatTime(d.racer.finishTime) : `${ordinal(d.place)} PLACE  ·  ${formatTime(d.racer.finishTime)}`;
          this.say('FINISH!', { sub, big: true, color: d.place === 1 ? '#ffd34a' : '#ffffff', dur: 3.2 });
          this.flash = 0.6;
          if (d.place === 1) for (let i = 0; i < 4; i++) this.firework(d.racer.x + (Math.random() - 0.5) * 600, d.racer.y + (Math.random() - 0.5) * 400);
        }
        break;
    }
  }

  exhaustBurst(r, n) {
    nozzlePositions(r.ship, r.x, r.y, r.heading, this.noz);
    for (let i = 0; i < this.noz.length; i += 2) {
      this.particles.burst('glow', this.noz[i], this.noz[i + 1], n, 160, 0.35, 30, 6, r.ship.flameColor, { vx: -r.vx * 0.3, vy: -r.vy * 0.3 });
    }
  }

  firework(x, y) {
    const cols = ['#ff5a6a', '#ffd34a', '#7dff8a', '#5ad0ff', '#c58bff', '#ffffff'];
    const c = cols[Math.floor(Math.random() * cols.length)];
    this.particles.burst('glow', x, y, 26, 520, 1.3, 22, 6, c, { drag: 1.6, grav: 60 });
    this.particles.burst('spark', x, y, 16, 600, 0.9, 3, 1, c, { drag: 1.2, grav: 80 });
    this.audio.play('firework', this.volAt(x, y) * 0.8);
  }

  /* ---------------------------------------------------------- ghost */

  prepareGhost() {
    const g = this.race.ghost;
    if (!g) return;
    const geo = this.race.geo;
    const n = Math.floor(g.frames.length / 3);
    const s = new Float32Array(n);
    let hint = -1;
    const p = {};
    for (let i = 0; i < n; i++) {
      geo.project(g.frames[i * 3], g.frames[i * 3 + 1], hint, p);
      hint = p.i;
      s[i] = p.s;
    }
    this.ghostS = s;
    this.ghostCursor = 0;
  }

  updateGhostGap() {
    const r = this.race;
    const p = r.player;
    if (!this.ghostS || !r.active || p.finished || p.lap < 1) {
      this.ghostGap = null;
      return;
    }
    const L = r.geo.length;
    const elapsed = r.time - p.lapStart;
    // ghost frames are lap-relative; find when the ghost passed the player's spot
    const s = p.lap === 1 && p.s > L / 2 ? p.s - L : p.s;
    const S = this.ghostS;
    let i = 0;
    while (i < S.length - 1) {
      const gs = i < 20 && S[i] > L / 2 ? S[i] - L : S[i];
      if (gs >= s) break;
      i++;
    }
    this.ghostGap = elapsed - i * r.ghost.dt;
  }

  /* ---------------------------------------------------------- update */

  update(dt, W, H) {
    this.t += dt;
    const race = this.race;
    const p = race.player;
    this.camera.follow(p, dt, W, H, this.settings);
    this.particles.setLimit(this.settings.effects ? CONFIG.effects.maxParticles : CONFIG.effects.maxParticlesLow);
    this.particles.update(dt);
    this.renderer.tick(dt, this.camera, race);
    for (const m of this.messages) m.t += dt;
    this.messages = this.messages.filter((m) => m.t < m.dur);
    if (this.flash > 0) this.flash -= dt;

    const fx = this.settings.effects;
    for (const r of race.racers) {
      // smoothed bank for drawing
      const target = clamp(r.angVel / r.h.turnRate, -1, 1);
      const b = this.banks.get(r) || 0;
      this.banks.set(r, b + (target - b) * Math.min(1, dt * 10));
      this.recordTrail(r);
      const near = this.volAt(r.x, r.y) > 0;
      if (!near) continue;
      nozzlePositions(r.ship, r.x, r.y, r.heading, this.noz);
      if (r.boosting && fx) {
        for (let i = 0; i < this.noz.length; i += 2) {
          this.particles.spawn('glow', this.noz[i], this.noz[i + 1], -r.vx * 0.2 + (Math.random() - 0.5) * 60, -r.vy * 0.2 + (Math.random() - 0.5) * 60, 0.35, 26, 4, r.ship.flameColor, { drag: 3 });
        }
      }
      if (r.driftTime > 0.1 && r.driftTier > 0) {
        const col = CONFIG.drift.colors[r.driftTier - 1];
        const back = r.heading + Math.PI;
        for (let k = 0; k < (fx ? 2 : 1); k++) {
          const side = (Math.random() < 0.5 ? -1 : 1) * 16;
          const x = r.x + Math.cos(back) * 24 - Math.sin(back) * side;
          const y = r.y + Math.sin(back) * 24 + Math.cos(back) * side;
          const a = back + (Math.random() - 0.5) * 1.2;
          this.particles.spawn('spark', x, y, Math.cos(a) * 360, Math.sin(a) * 360, 0.25, 2.5, 1, col);
        }
      }
      const surf = r.surface;
      if (surf !== 'track' && r.speed > 140 && Math.random() < (fx ? 0.7 : 0.25)) {
        const col = DUST[surf] || '#aaaaaa';
        const kind = surf === 'lava' || surf === 'field' || surf === 'hover' ? 'glow' : 'smoke';
        this.particles.spawn(kind, r.x - r.vx * 0.04, r.y - r.vy * 0.04, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.8, kind === 'glow' ? 18 : 26, kind === 'glow' ? 4 : 70, col, { top: false });
      }
      if (r.stun > 0 && Math.random() < 0.5) this.particles.spawn('smoke', r.x, r.y, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.9, 20, 60, '#44464c', { top: false });
    }

    this.ambientEffects(dt);
    if (fx) this.updateWeather(dt, W, H);
    if (race.mode === 'timetrial') this.updateGhostGap();
    this.audio.updateEngine(clamp(p.speed / p.h.topSpeed, 0, 1.5), p.controls.throttle, p.boosting, clamp(Math.abs(p.slip) * 2, 0, 1));
  }

  recordTrail(r) {
    let tr = this.trails.get(r);
    const N = CONFIG.effects.trailLength;
    if (!tr) this.trails.set(r, (tr = { xs: new Float32Array(N), ys: new Float32Array(N), head: 0, count: 0 }));
    const back = r.heading + Math.PI;
    const k = r.ship.scale;
    const ey = Math.max(...r.ship.engines.map((e) => e[1])) * k;
    tr.xs[tr.head] = r.x + Math.cos(back) * ey;
    tr.ys[tr.head] = r.y + Math.sin(back) * ey;
    tr.head = (tr.head + 1) % N;
    tr.count = Math.min(N, tr.count + 1);
  }

  ambientEffects(dt) {
    const th = this.race.track.theme;
    const cam = this.camera;
    if (th === 'grandprix') {
      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 2.5 + Math.random() * 3;
        const a = Math.random() * TAU;
        this.firework(cam.x + Math.cos(a) * 500, cam.y + Math.sin(a) * 350);
      }
    }
    if (th === 'lava' && Math.random() < dt * 6) {
      // smoke from refinery stacks and embers off the lava
      const x = cam.x + (Math.random() - 0.5) * 1600;
      const y = cam.y + (Math.random() - 0.5) * 1200;
      this.particles.spawn('smoke', x, y, 20, -40, 3, 60, 220, '#2a1c18', { top: true, alpha: 0.6, drag: 0.2 });
    }
    if (th === 'station' && Math.random() < dt * 2) {
      const x = cam.x + (Math.random() - 0.5) * 1400;
      const y = cam.y + (Math.random() - 0.5) * 1000;
      this.particles.burst('spark', x, y, 6, 240, 0.4, 2, 1, '#ffd38a');
    }
  }

  updateWeather(dt, W, H) {
    const kind = this.theme.weather;
    const w = this.weather;
    if (!kind) return;
    const want = { snow: 140, dust: 70, embers: 60, pollen: 40, motes: 60 }[kind];
    const cam = this.camera;
    const dx = cam.x - (this.lastCamX ?? cam.x);
    const dy = cam.y - (this.lastCamY ?? cam.y);
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
    while (w.length < want) w.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.9, ph: Math.random() * TAU });
    const storm = this.stormIntensity();
    for (const p of w) {
      let vx = 0;
      let vy = 0;
      if (kind === 'snow') {
        vx = -60 - storm * 400;
        vy = 80;
      } else if (kind === 'dust') {
        vx = -140 - storm * 700;
        vy = 20 * Math.sin(p.ph + this.t);
      } else if (kind === 'embers') {
        vx = 10 * Math.sin(p.ph + this.t * 2);
        vy = -60;
      } else if (kind === 'pollen') {
        vx = 12 * Math.sin(p.ph + this.t);
        vy = 10 * Math.cos(p.ph + this.t * 0.7);
      } else {
        vx = 4;
        vy = 4;
      }
      p.x += (vx * p.z) * dt - dx * cam.zoom * p.z * 0.6;
      p.y += (vy * p.z) * dt - dy * cam.zoom * p.z * 0.6;
      if (p.x < -20) p.x += W + 40;
      if (p.x > W + 20) p.x -= W + 40;
      if (p.y < -20) p.y += H + 40;
      if (p.y > H + 20) p.y -= H + 40;
    }
  }

  stormIntensity() {
    for (const hz of this.race.hazards) {
      if (hz.kind === 'sandstorm' && hz.inZone(this.race.player, this.race.geo)) return hz.intensity;
    }
    return 0;
  }

  /* ---------------------------------------------------------- draw */

  draw(ctx, W, H, dpr) {
    const race = this.race;
    const cam = this.camera;
    const Wd = W * dpr;
    const Hd = H * dpr;
    const scale = cam.zoom * dpr;
    cam.scale = scale;
    const view = cam.view(W, H, 80);
    const t = this.t;
    const camShaken = { x: view.cx, y: view.cy, scale };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.renderer.drawBackdrop(ctx, camShaken, Wd, Hd, t);
    ctx.setTransform(scale, 0, 0, scale, Wd / 2 - view.cx * scale, Hd / 2 - view.cy * scale);

    this.renderer.drawGround(ctx, view, t);
    this.renderer.drawTrack(ctx, view, t, race);
    for (const hz of race.hazards) hz.draw(ctx, t, view);
    this.renderer.drawMid(ctx, view, t, { racerColors: this.racerColors });
    this.particles.draw(ctx, false, view);
    this.drawTrails(ctx);
    this.drawGhost(ctx, t);
    this.drawRacers(ctx, t, view);
    this.particles.draw(ctx, true, view);
    for (const hz of race.hazards) if (hz.drawTop) hz.drawTop(ctx, t, view);
    this.renderer.drawOverhead(ctx, view, t, camShaken, race);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawScreenFx(ctx, W, H);
    if (!this.hideHud) drawHud(ctx, this, W, H, dpr);
  }

  drawTrails(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const r of this.race.racers) {
      const tr = this.trails.get(r);
      if (!tr || tr.count < 3) continue;
      const N = tr.xs.length;
      const strength = r.boosting ? 1 : clamp(r.speed / r.h.topSpeed - 0.4, 0, 0.6);
      if (strength <= 0.02) continue;
      ctx.strokeStyle = r.ship.flameColor;
      for (let k = 1; k < tr.count; k++) {
        const i0 = (tr.head - k + N) % N;
        const i1 = (tr.head - k - 1 + N) % N;
        const f = 1 - k / tr.count;
        ctx.globalAlpha = f * 0.5 * strength;
        ctx.lineWidth = (r.boosting ? 14 : 7) * f + 1;
        ctx.beginPath();
        ctx.moveTo(tr.xs[i0], tr.ys[i0]);
        ctx.lineTo(tr.xs[i1], tr.ys[i1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawGhost(ctx, t) {
    const g = this.race.ghostPos;
    if (!g || !g.visible) return;
    const ship = getRosterShip(this.race.ghost.ship);
    drawShip(ctx, ship, { x: g.x, y: g.y, heading: g.heading, t, alpha: 0.35, throttle: 0.6 });
  }

  drawRacers(ctx, t, view) {
    const race = this.race;
    const fontPx = 15;
    for (const r of race.racers) {
      if (r.x < view.x0 - 100 || r.x > view.x1 + 100 || r.y < view.y0 - 100 || r.y > view.y1 + 100) continue;
      // identification ring under each ship
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = r.isPlayer ? 0.55 : 0.75;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 36, 36, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const blink = r.ghost > 0 && Math.floor(t * 12) % 2 === 0;
      drawShip(ctx, r.ship, {
        x: r.x, y: r.y, heading: r.heading, bank: this.banks.get(r) || 0,
        throttle: r.controls.throttle, boost: r.boosting ? 1 : r.turbo > 0 || r.padTime > 0.4 ? 0.6 : 0,
        t, flash: r.flash > 0 ? r.flash * 3 : 0, alpha: blink ? 0.35 : 1, shadow: 16,
      });
    }
    // name tags above opponents
    ctx.font = `800 ${fontPx}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (const r of race.racers) {
      if (r.isPlayer) continue;
      if (r.x < view.x0 || r.x > view.x1 || r.y < view.y0 || r.y > view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(r.name, r.x + 1.5, r.y - 50 + 1.5);
      ctx.fillStyle = r.color;
      ctx.fillText(r.name, r.x, r.y - 50);
    }
  }

  drawScreenFx(ctx, W, H) {
    const p = this.race.player;
    const fx = this.settings.effects;
    const kind = this.theme.weather;
    const t = this.t;

    // weather
    if (fx && kind) {
      for (const w of this.weather) {
        if (kind === 'snow') {
          ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * w.z})`;
          ctx.beginPath();
          ctx.arc(w.x, w.y, 1.2 + w.z * 2.2, 0, TAU);
          ctx.fill();
        } else if (kind === 'dust') {
          ctx.fillStyle = `rgba(230,180,120,${0.25 + 0.25 * w.z})`;
          ctx.fillRect(w.x, w.y, 6 + w.z * 10, 1.5 + w.z);
        } else if (kind === 'embers') {
          glow(ctx, '#ff8a2a', w.x, w.y, 6 + w.z * 8, 0.6 + 0.4 * Math.sin(t * 6 + w.ph));
        } else if (kind === 'pollen') {
          glow(ctx, '#e8ff9a', w.x, w.y, 5 + w.z * 6, 0.4 + 0.4 * Math.sin(t * 3 + w.ph));
        } else {
          ctx.fillStyle = `rgba(200,210,255,${0.2 + 0.2 * w.z})`;
          ctx.fillRect(w.x, w.y, 1.5, 1.5);
        }
      }
    }

    // sandstorm wall of dust
    const storm = this.stormIntensity();
    if (storm > 0.02) {
      ctx.fillStyle = `rgba(214,150,86,${0.45 * storm})`;
      ctx.fillRect(0, 0, W, H);
    }

    // environment light
    const tint = this.theme.tint;
    if (tint === 'desert') {
      const g = ctx.createLinearGradient(W, 0, 0, H);
      g.addColorStop(0, 'rgba(255,170,80,0.28)');
      g.addColorStop(0.5, 'rgba(255,140,60,0.06)');
      g.addColorStop(1, 'rgba(120,40,20,0.18)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      glow(ctx, '#fff0c0', W * 1.02, -H * 0.05, Math.max(W, H) * 0.5, 0.45);
      glow(ctx, '#ffb070', W * 0.88, -H * 0.12, Math.max(W, H) * 0.35, 0.35);
    } else if (tint) {
      const col = { ice: '210,235,255', forest: '6,20,6', lava: '90,10,0', city: '40,0,60', graveyard: '120,80,30' }[tint];
      const a = { ice: 0.35, forest: 0.55, lava: 0.5, city: 0.4, graveyard: 0.25 }[tint];
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(1, `rgba(${col},${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // speed streaks while boosting: tapered lines rushing out from the center
    if (fx && (p.boosting || p.turbo > 0)) {
      const cx = W / 2;
      const cy = H / 2;
      const diag = Math.hypot(W, H) / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 28; i++) {
        const h = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
        const a = (h - Math.floor(h)) * TAU;
        const ph = ((t * 2.2 + (Math.sin(i * 78.233) * 0.5 + 0.5)) % 1);
        const r0 = diag * (0.35 + ph * 0.75);
        const len = diag * (0.08 + 0.18 * ph);
        const x0 = cx + Math.cos(a) * r0;
        const y0 = cy + Math.sin(a) * r0;
        const x1 = cx + Math.cos(a) * (r0 + len);
        const y1 = cy + Math.sin(a) * (r0 + len);
        const gr = ctx.createLinearGradient(x0, y0, x1, y1);
        gr.addColorStop(0, 'rgba(255,240,220,0)');
        gr.addColorStop(1, `rgba(255,240,220,${0.28 * ph})`);
        ctx.strokeStyle = gr;
        ctx.lineWidth = 1.5 + ph * 2.5;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (p.boosting && fx) {
      // zoom blur: blend a slightly enlarged copy of the frame over itself
      const c = ctx.canvas;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 0.16;
      const z = 1.035;
      ctx.drawImage(c, (c.width * (1 - z)) / 2, (c.height * (1 - z)) / 2, c.width * z, c.height * z);
      ctx.restore();
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,140,40,0)');
      g.addColorStop(1, `rgba(${p.ship.flameColor === '#38d6ff' ? '56,214,255' : '255,140,40'},0.22)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, this.flash * 0.8)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // gentle vignette everywhere
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
}
