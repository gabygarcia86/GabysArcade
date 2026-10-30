/**
 * Track hazards. Every timed hazard is telegraphed before it can hurt you:
 * shock gates crackle, vents glow, falling rocks cast a growing shadow and
 * asteroids are announced by blinking markers at the lane edge. Each hazard
 * also lists itself in race.obstacles so the AI can steer around it.
 *
 * Interface: update(dt, race), collide(racer, race), obstacles(list),
 * affect(racer, dt, race) for area effects, draw(ctx, t) under the ships and
 * drawTop(ctx, t) above them.
 */
import { hazardHit } from './collision.js';
import { getProbeSprite } from './shipRoster.js';
import { getGlow } from './sprites.js';
import { clamp, wrapLen, mulberry32, TAU } from './utils.js';

let nextId = 1;
const F = {};

/** Pushes a racer out of a solid circle and bounces it. Returns the impact speed. */
function bounceCircle(r, cx, cy, radius, restitution = 0.45, ovx = 0, ovy = 0) {
  const dx = r.x - cx;
  const dy = r.y - cy;
  const rr = radius + r.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return 0;
  const d = Math.sqrt(d2) || 1;
  const nx = dx / d;
  const ny = dy / d;
  r.x = cx + nx * rr;
  r.y = cy + ny * rr;
  const vn = (r.vx - ovx) * nx + (r.vy - ovy) * ny;
  if (vn >= 0) return 0;
  r.vx -= nx * vn * (1 + restitution);
  r.vy -= ny * vn * (1 + restitution);
  r.vx *= 0.88;
  r.vy *= 0.88;
  return -vn;
}

function shadow(ctx, x, y, rx, ry, a = 0.35) {
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function glow(ctx, color, x, y, size, alpha = 1) {
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(getGlow(color), x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Lumpy rock outline from a seed, drawn with top-left lighting. */
export function drawRock(ctx, x, y, r, seed, rot, palette) {
  const rng = mulberry32(seed);
  const n = 9;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.78 + rng() * 0.32);
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, palette[0]);
  g.addColorStop(0.6, palette[1]);
  g.addColorStop(1, palette[2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc((rng() - 0.5) * r, (rng() - 0.5) * r, r * (0.1 + rng() * 0.12), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const ROCK_LOOKS = {
  rock: ['#d9a26a', '#9a6237', '#5a3418'],
  ice: ['#f4fbff', '#9fd0ea', '#4f86a8'],
  log: ['#8a6a44', '#5a3f22', '#2f2010'],
  scrap: ['#a39a8c', '#6e6458', '#3a332b'],
  asteroid: ['#9a8f86', '#5f5852', '#2c2724'],
};

/* ------------------------------------------------------------ Probe-Fighter */

class ProbePatrol {
  constructor(spec, race) {
    const geo = race.geo;
    this.id = nextId++;
    this.kind = 'probe';
    this.s0 = geo.u2s(spec.from);
    this.span = Math.max(200, wrapLen(geo.u2s(spec.to) - this.s0, geo.length));
    this.p = Math.random() * this.span;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = 85 + Math.random() * 45;
    this.phase = Math.random() * TAU;
    this.weave = TAU / (4.6 + Math.random() * 2.4);
    this.pause = 0;
    this.stunned = 0;
    this.spin = 0;
    this.r = 22;
    this.lat = 0;
    this.vlat = 0;
    this.anim = Math.random() * 10;
    this.update(0, race);
  }

  update(dt, race) {
    const geo = race.geo;
    this.anim += dt;
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.spin += dt * 9 * Math.max(0, this.stunned);
      return;
    }
    if (this.pause > 0) {
      this.pause -= dt;
    } else {
      this.p += this.dir * this.speed * dt;
      if (this.p < 0 || this.p > this.span) {
        this.dir = -this.dir;
        this.p = clamp(this.p, 0, this.span);
      }
      if (Math.random() < dt * 0.1) this.pause = 0.6 + Math.random() * 0.6; // hovers to scan now and then
    }
    this.phase += this.weave * dt * (this.pause > 0 ? 0.3 : 1);
    const s = this.s0 + this.p;
    geo.at(s, F);
    const prev = this.lat;
    this.lat = Math.sin(this.phase) * Math.max(0, F.hw - 48) * 0.9;
    this.vlat = dt > 0 ? (this.lat - prev) / dt : 0;
    this.x = F.x + F.nx * this.lat;
    this.y = F.y + F.ny * this.lat;
    const mx = F.tx * this.dir * this.speed + F.nx * this.vlat;
    const my = F.ty * this.dir * this.speed + F.ny * this.vlat;
    if (this.pause <= 0) this.heading = Math.atan2(my, mx);
    this.s = wrapLen(s, geo.length);
  }

  collide(r, race) {
    if (this.stunned > 0) return;
    const dx = r.x - this.x;
    const dy = r.y - this.y;
    if (dx * dx + dy * dy > (r.r + this.r) ** 2) return;
    if (hazardHit(r, race, { x: this.x, y: this.y, power: 1, kind: 'probe' })) {
      this.stunned = 1.6;
      race.emit('probeHit', { x: this.x, y: this.y });
    }
  }

  obstacles(list) {
    if (this.stunned > 0.2) return;
    list.push({ id: this.id, s: this.s, lat: this.lat, r: this.r + 8, vlat: this.vlat });
  }

  draw(ctx) {
    const sp = getProbeSprite();
    shadow(ctx, this.x + 12, this.y + 18, 20, 12, 0.3);
    const pulse = 0.45 + 0.2 * Math.sin(this.anim * 6);
    glow(ctx, '#ff3a3a', this.x, this.y, 70, pulse);
    ctx.save();
    ctx.translate(this.x, this.y);
    // scanning beam ahead of it (telegraphs where it's heading)
    if (this.stunned <= 0) {
      const sweep = Math.sin(this.anim * 2.4) * 0.35;
      ctx.rotate(this.heading + sweep);
      const g = ctx.createLinearGradient(0, 0, 150, 0);
      g.addColorStop(0, 'rgba(255,60,60,0.28)');
      g.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(150, -34);
      ctx.lineTo(150, 34);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-sweep);
    } else {
      ctx.rotate(this.heading + this.spin);
    }
    ctx.rotate(Math.PI / 2);
    const k = 1.1;
    ctx.drawImage(sp.canvas, (-sp.w * k) / 2, (-sp.h * k) / 2, sp.w * k, sp.h * k);
    if (this.stunned > 0 && Math.floor(this.anim * 16) % 2 === 0) {
      ctx.globalAlpha = 0.7;
      ctx.drawImage(sp.flash, (-sp.w * k) / 2, (-sp.h * k) / 2, sp.w * k, sp.h * k);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------ moving barrier */

class Barrier {
  constructor(spec, race) {
    const geo = race.geo;
    this.id = nextId++;
    this.kind = 'barrier';
    this.look = spec.look || 'barrier';
    this.s = geo.u2s(spec.at);
    geo.at(this.s, F);
    this.cx = F.x;
    this.cy = F.y;
    this.tx = F.tx;
    this.ty = F.ty;
    this.hw = F.hw;
    this.width = spec.width;
    this.depth = this.look === 'traffic' ? 44 : 30;
    this.speed = spec.speed;
    this.phase = spec.phase || 0;
    this.lat = 0;
    this.vlat = 0;
    this.amp = Math.max(0, this.hw - this.width / 2 - 26);
    this.update(0, race);
  }

  update(dt, race) {
    const prev = this.lat;
    this.lat = Math.sin(race.clock * this.speed + this.phase) * this.amp;
    this.vlat = dt > 0 ? (this.lat - prev) / dt : 0;
    this.x = this.cx - this.ty * this.lat;
    this.y = this.cy + this.tx * this.lat;
  }

  collide(r, race) {
    const dx = r.x - this.x;
    const dy = r.y - this.y;
    const a = dx * this.tx + dy * this.ty;
    const b = -dx * this.ty + dy * this.tx;
    const ha = this.depth / 2;
    const hb = this.width / 2;
    const ca = clamp(a, -ha, ha);
    const cb = clamp(b, -hb, hb);
    let ea = a - ca;
    let eb = b - cb;
    let d = Math.hypot(ea, eb);
    if (d >= r.r) return;
    if (d < 1e-3) {
      // center inside the box: push out along the shortest axis
      if (ha - Math.abs(a) < hb - Math.abs(b)) {
        ea = Math.sign(a) || 1;
        eb = 0;
      } else {
        ea = 0;
        eb = Math.sign(b) || 1;
      }
      d = 0;
    } else {
      ea /= d;
      eb /= d;
    }
    const nx = this.tx * ea - this.ty * eb;
    const ny = this.ty * ea + this.tx * eb;
    const pen = r.r - d;
    r.x += nx * pen;
    r.y += ny * pen;
    const bvx = -this.ty * this.vlat;
    const bvy = this.tx * this.vlat;
    const vn = (r.vx - bvx) * nx + (r.vy - bvy) * ny;
    if (vn < 0) {
      r.vx -= nx * vn * 1.4;
      r.vy -= ny * vn * 1.4;
      r.vx *= 0.82;
      r.vy *= 0.82;
      r.cancelDrift();
      if (-vn > 90) race.emit('barrierHit', { racer: r, x: r.x - nx * r.r, y: r.y - ny * r.r, impact: -vn });
    }
  }

  obstacles(list) {
    list.push({ id: this.id, s: this.s, lat: this.lat, r: this.width / 2 + 6, vlat: this.vlat });
  }

  draw(ctx, t) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.ty, this.tx));
    const w = this.width;
    const d = this.depth;
    shadow(ctx, 10, 14, d * 0.7, w * 0.55, 0.3);
    if (this.look === 'traffic') {
      // hover freighter drifting across the skyway
      ctx.fillStyle = '#2a3346';
      ctx.fillRect(-d / 2, -w / 2, d, w);
      ctx.fillStyle = '#ffb347';
      ctx.fillRect(-d / 2 + 4, -w / 2 + 6, d - 8, 10);
      ctx.fillStyle = '#3d4c6b';
      ctx.fillRect(-d / 2 + 4, -w / 2 + 22, d - 8, w - 44);
      ctx.fillStyle = '#9fe8ff';
      for (let y = -w / 2 + 28; y < w / 2 - 24; y += 14) ctx.fillRect(-4, y, 8, 6);
      const blink = Math.sin(t * 8) > 0 ? 1 : 0.3;
      glow(ctx, '#ff3a3a', 0, -w / 2 + 2, 28, blink);
      glow(ctx, '#ff3a3a', 0, w / 2 - 2, 28, blink);
      glow(ctx, '#7fd8ff', -d / 2 - 6, 0, 40, 0.7);
    } else {
      ctx.fillStyle = this.look === 'door' ? '#4a5260' : '#30343c';
      ctx.fillRect(-d / 2, -w / 2, d, w);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-d / 2 + 3, -w / 2 + 3, d - 6, w - 6);
      ctx.clip();
      ctx.fillStyle = '#f2c230';
      for (let y = -w / 2 - d; y < w / 2 + d; y += 18) {
        ctx.beginPath();
        ctx.moveTo(-d / 2, y);
        ctx.lineTo(d / 2, y + 9);
        ctx.lineTo(d / 2, y + 18);
        ctx.lineTo(-d / 2, y + 9);
        ctx.fill();
      }
      ctx.restore();
      ctx.strokeStyle = '#11141a';
      ctx.lineWidth = 3;
      ctx.strokeRect(-d / 2, -w / 2, d, w);
      const blink = (Math.sin(t * 6) + 1) / 2;
      glow(ctx, '#ff4040', 0, -w / 2, 34, 0.4 + 0.6 * blink);
      glow(ctx, '#ff4040', 0, w / 2, 34, 0.4 + 0.6 * (1 - blink));
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------ shock gate */

class ElectricGate {
  constructor(spec, race) {
    const geo = race.geo;
    this.id = nextId++;
    this.kind = 'electric';
    this.s = geo.u2s(spec.at);
    geo.at(this.s, F);
    this.f = { ...F };
    this.period = spec.period || 4.6;
    this.offset = spec.offset || 0;
    this.side = 1;
    this.state = 'off';
    this.cycle = -1;
    this.seed = 1;
  }

  update(dt, race) {
    const t = race.clock + this.offset;
    const cycle = Math.floor(t / this.period);
    if (cycle !== this.cycle) {
      this.cycle = cycle;
      this.side = cycle % 2 === 0 ? 1 : -1;
    }
    const ph = t - cycle * this.period;
    const prev = this.state;
    this.state = ph < this.period - 2.4 ? 'off' : ph < this.period - 1.4 ? 'warn' : 'on';
    if (this.state === 'on' && prev !== 'on') race.emit('gateOn', { x: this.f.x, y: this.f.y });
    this.seed = Math.floor(race.clock * 24);
  }

  collide(r, race) {
    if (this.state !== 'on') return;
    const f = this.f;
    const dx = r.x - f.x;
    const dy = r.y - f.y;
    const a = dx * f.tx + dy * f.ty;
    const b = (-dx * f.ty + dy * f.tx) * this.side;
    if (Math.abs(a) < 22 + r.r * 0.6 && b > -r.r * 0.5 && b < f.hw + f.ro) {
      hazardHit(r, race, { x: r.x - f.nx * this.side * 30, y: r.y - f.ny * this.side * 30, power: 0.8, kind: 'shock' });
    }
  }

  obstacles(list) {
    if (this.state === 'off') return;
    const hw = this.f.hw;
    list.push({ id: this.id, s: this.s, lat: (this.side * hw) / 2, r: hw / 2 + 14, vlat: 0 });
  }

  draw(ctx, t) {
    const f = this.f;
    const hw = f.hw;
    const end = (lat) => [f.x + f.nx * lat, f.y + f.ny * lat];
    // pylons at both edges and the hovering node at the center
    for (const lat of [-(hw + 16), hw + 16]) {
      const [x, y] = end(lat);
      ctx.fillStyle = '#20252e';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#59657a';
      ctx.lineWidth = 3;
      ctx.stroke();
      const hot = (lat > 0) === (this.side > 0) && this.state !== 'off';
      glow(ctx, hot ? '#7fd8ff' : '#2f5f88', x, y, hot ? 70 : 34, hot ? 0.9 : 0.5);
    }
    const [cx, cy] = end(0);
    ctx.fillStyle = '#2a303b';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, TAU);
    ctx.fill();
    glow(ctx, '#7fd8ff', cx, cy, this.state === 'off' ? 26 : 60, this.state === 'off' ? 0.5 : 1);
    // floor strip shows the danger half
    if (this.state !== 'off') {
      const [ex, ey] = end(this.side * (hw + 16));
      ctx.strokeStyle = this.state === 'on' ? 'rgba(140,220,255,0.35)' : `rgba(255,220,90,${0.25 + 0.25 * Math.sin(t * 20)})`;
      ctx.lineWidth = 40;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  drawTop(ctx) {
    if (this.state === 'off') return;
    const f = this.f;
    const rng = mulberry32(this.seed * 31 + this.id);
    const strands = this.state === 'on' ? 3 : 1;
    const reach = this.state === 'on' ? 1 : 0.35;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < strands; k++) {
      ctx.strokeStyle = k === 0 ? 'rgba(220,245,255,0.95)' : 'rgba(110,200,255,0.7)';
      ctx.lineWidth = k === 0 ? 3 : 2;
      ctx.beginPath();
      const len = (f.hw + 16) * reach;
      for (let i = 0; i <= 10; i++) {
        const lat = this.side * (i / 10) * len;
        const jit = i === 0 || i === 10 ? 0 : (rng() - 0.5) * 30;
        const x = f.x + f.nx * lat + f.tx * jit;
        const y = f.y + f.ny * lat + f.ty * jit;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (this.state === 'warn') {
        // warning crackle from the far pylon
        ctx.beginPath();
        for (let i = 0; i <= 4; i++) {
          const lat = this.side * (f.hw + 16 - i * 14);
          const jit = (rng() - 0.5) * 18;
          const x = f.x + f.nx * lat + f.tx * jit;
          const y = f.y + f.ny * lat + f.ty * jit;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

/* ------------------------------------------------------------ falling rocks */

class FallingRocks {
  constructor(spec, race) {
    const geo = race.geo;
    this.kind = 'rocks';
    this.look = spec.look || 'rock';
    this.s0 = geo.u2s(spec.from);
    this.span = wrapLen(geo.u2s(spec.to) - this.s0, geo.length);
    this.every = spec.every || 3.5;
    this.timer = 2 + Math.random() * this.every;
    this.rocks = [];
  }

  update(dt, race) {
    const geo = race.geo;
    this.timer -= dt;
    if (this.timer <= 0 && this.rocks.length < 3 && race.state !== 'countdown') {
      this.timer = this.every * (0.7 + Math.random() * 0.6);
      const s = wrapLen(this.s0 + Math.random() * this.span, geo.length);
      geo.at(s, F);
      const lat = (Math.random() * 2 - 1) * Math.max(0, F.hw - 46);
      this.rocks.push({
        id: nextId++, s, lat, x: F.x + F.nx * lat, y: F.y + F.ny * lat,
        r: 28 + Math.random() * 10, state: 'fall', t: 1.35, rot: Math.random() * TAU, seed: (Math.random() * 1e6) | 0,
      });
    }
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const k = this.rocks[i];
      k.t -= dt;
      if (k.state === 'fall' && k.t <= 0) {
        k.state = 'land';
        k.t = 5;
        race.emit('rockLand', { x: k.x, y: k.y, look: this.look });
        for (const r of race.racers) {
          if ((r.x - k.x) ** 2 + (r.y - k.y) ** 2 < (k.r + r.r + 16) ** 2) hazardHit(r, race, { x: k.x, y: k.y, power: 1.15, kind: 'rock' });
        }
      } else if (k.state === 'land' && k.t <= 0) {
        k.state = 'fade';
        k.t = 0.6;
      } else if (k.state === 'fade' && k.t <= 0) {
        this.rocks.splice(i, 1);
      }
    }
  }

  collide(r, race) {
    if (r.ghost > 0) return;
    for (const k of this.rocks) {
      if (k.state !== 'land') continue;
      const hit = bounceCircle(r, k.x, k.y, k.r * 0.9);
      if (hit > 90) {
        r.cancelDrift();
        race.emit('barrierHit', { racer: r, x: k.x, y: k.y, impact: hit });
      }
    }
  }

  obstacles(list) {
    for (const k of this.rocks) {
      if (k.state === 'fade') continue;
      list.push({ id: k.id, s: k.s, lat: k.lat, r: k.r + (k.state === 'fall' ? 16 : 4), vlat: 0 });
    }
  }

  draw(ctx, t) {
    const pal = ROCK_LOOKS[this.look] || ROCK_LOOKS.rock;
    for (const k of this.rocks) {
      if (k.state === 'fall') {
        const p = 1 - k.t / 1.35;
        shadow(ctx, k.x, k.y, k.r * (0.4 + p * 0.8), k.r * (0.3 + p * 0.6), 0.15 + p * 0.35);
        const blink = Math.sin(t * 18) > 0;
        ctx.strokeStyle = blink ? 'rgba(255,90,60,0.85)' : 'rgba(255,200,80,0.5)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(k.x, k.y, k.r + 14, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalAlpha = k.state === 'fade' ? Math.max(0, k.t / 0.6) : 1;
        shadow(ctx, k.x + 8, k.y + 10, k.r, k.r * 0.75, 0.35);
        drawRock(ctx, k.x, k.y, k.r, k.seed, k.rot, pal);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawTop(ctx) {
    const pal = ROCK_LOOKS[this.look] || ROCK_LOOKS.rock;
    for (const k of this.rocks) {
      if (k.state !== 'fall') continue;
      const p = 1 - k.t / 1.35;
      const h = (1 - p) * 260; // falls in from above-left
      const sc = 1 + (1 - p) * 0.8;
      ctx.globalAlpha = Math.min(1, p * 2.5);
      drawRock(ctx, k.x - h * 0.5, k.y - h, k.r * sc, k.seed, k.rot + p * 3, pal);
      ctx.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------ asteroids */

class AsteroidCrossings {
  constructor(spec, race) {
    const geo = race.geo;
    this.kind = 'asteroids';
    this.len = geo.length;
    this.every = spec.every || 5.5;
    this.lanes = spec.at.map((u) => {
      const s = geo.u2s(u);
      geo.at(s, F);
      return { s, f: { ...F }, timer: 1.5 + Math.random() * this.every, rock: null };
    });
  }

  update(dt, race) {
    for (const lane of this.lanes) {
      const f = lane.f;
      const edge = f.hw + f.ro + 90;
      if (!lane.rock) {
        lane.timer -= dt;
        if (lane.timer <= 0 && race.state !== 'countdown') {
          const side = Math.random() < 0.5 ? -1 : 1;
          lane.rock = {
            id: nextId++, side, lat: -side * edge, speed: 170 + Math.random() * 70, r: 30 + Math.random() * 16,
            state: 'warn', t: 1.5, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 2, seed: (Math.random() * 1e6) | 0, drift: (Math.random() - 0.5) * 50, along: 0,
          };
          race.emit('asteroidWarn', { x: f.x, y: f.y });
        }
        continue;
      }
      const k = lane.rock;
      k.rot += k.spin * dt;
      if (k.state === 'warn') {
        k.t -= dt;
        if (k.t <= 0) k.state = 'fly';
      } else {
        k.lat += k.side * k.speed * dt;
        k.along += k.drift * dt;
        if (k.lat * k.side > edge + 40) {
          lane.rock = null;
          lane.timer = this.every * (0.6 + Math.random() * 0.8);
          continue;
        }
      }
      k.x = f.x + f.nx * k.lat + f.tx * k.along;
      k.y = f.y + f.ny * k.lat + f.ty * k.along;
    }
  }

  collide(r, race) {
    if (r.ghost > 0) return;
    for (const lane of this.lanes) {
      const k = lane.rock;
      if (!k || k.state !== 'fly') continue;
      const vx = lane.f.nx * k.side * k.speed;
      const vy = lane.f.ny * k.side * k.speed;
      const dx = r.x - k.x;
      const dy = r.y - k.y;
      if (dx * dx + dy * dy < (k.r + r.r) ** 2) {
        hazardHit(r, race, { x: k.x, y: k.y, power: 0.9, kind: 'asteroid' });
        bounceCircle(r, k.x, k.y, k.r, 0.6, vx, vy);
      }
    }
  }

  obstacles(list) {
    for (const lane of this.lanes) {
      const k = lane.rock;
      if (!k) continue;
      list.push({ id: k.id, s: wrapLen(lane.s + k.along, this.len), lat: k.lat, r: k.r + 10, vlat: k.state === 'fly' ? k.side * k.speed : 0 });
    }
  }

  draw(ctx, t) {
    for (const lane of this.lanes) {
      const k = lane.rock;
      if (!k) continue;
      const f = lane.f;
      if (k.state === 'warn' || Math.abs(k.lat) > f.hw) {
        // chevrons at the lane edge it will come from, and its path across
        const blink = Math.sin(t * 14) > -0.2;
        const lat = -k.side * (f.hw + 10);
        const x = f.x + f.nx * lat;
        const y = f.y + f.ny * lat;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(f.ny * k.side, f.nx * k.side));
        ctx.strokeStyle = blink ? 'rgba(255,170,60,0.95)' : 'rgba(255,170,60,0.3)';
        ctx.lineWidth = 6;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(i * 22 - 8, -18);
          ctx.lineTo(i * 22 + 6, 0);
          ctx.lineTo(i * 22 - 8, 18);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,170,60,0.18)';
        ctx.lineWidth = k.r * 2;
        ctx.beginPath();
        ctx.moveTo(f.x - f.nx * (f.hw + 20), f.y - f.ny * (f.hw + 20));
        ctx.lineTo(f.x + f.nx * (f.hw + 20), f.y + f.ny * (f.hw + 20));
        ctx.stroke();
      }
      shadow(ctx, k.x + 18, k.y + 26, k.r * 0.9, k.r * 0.6, 0.25);
      drawRock(ctx, k.x, k.y, k.r, k.seed, k.rot, ROCK_LOOKS.asteroid);
    }
  }
}

/* ------------------------------------------------------------ static debris */

class Debris {
  constructor(spec, race) {
    const geo = race.geo;
    this.kind = 'debris';
    this.theme = race.track.theme;
    const rng = mulberry32(geo.n * 7 + spec.at.length);
    this.pieces = [];
    for (const u of spec.at) {
      const s = geo.u2s(u);
      geo.at(s, F);
      const hw = F.hw;
      const count = spec.count || 1;
      // one piece per side of the lane, staggered into a slalom so there is always a gap to pass
      const first = rng() < 0.5 ? -1 : 1;
      for (let i = 0; i < count; i++) {
        const slot = (i % 2 === 0 ? first : -first) * 0.5;
        const ss = s + (i - (count - 1) / 2) * 200;
        geo.at(ss, F);
        const lat = (slot + (rng() - 0.5) * 0.2) * hw;
        this.pieces.push({ id: nextId++, s: wrapLen(ss, geo.length), lat, x: F.x + F.nx * lat, y: F.y + F.ny * lat, r: 24 + rng() * 12, rot: rng() * TAU, seed: (rng() * 1e6) | 0 });
      }
    }
  }

  update() {}

  collide(r, race) {
    if (r.ghost > 0) return;
    for (const p of this.pieces) {
      const hit = bounceCircle(r, p.x, p.y, p.r);
      if (hit > 90) {
        r.cancelDrift();
        race.emit('barrierHit', { racer: r, x: p.x, y: p.y, impact: hit });
      }
    }
  }

  obstacles(list) {
    for (const p of this.pieces) list.push({ id: p.id, s: p.s, lat: p.lat, r: p.r + 4, vlat: 0 });
  }

  draw(ctx) {
    for (const p of this.pieces) {
      shadow(ctx, p.x + 8, p.y + 10, p.r, p.r * 0.7, 0.35);
      if (this.theme === 'asteroid') {
        drawRock(ctx, p.x, p.y, p.r, p.seed, p.rot, ROCK_LOOKS.asteroid);
        continue;
      }
      // scrap: a bent hull plate with rivets and rust
      const rng = mulberry32(p.seed);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(-p.r, -p.r * 0.5);
      ctx.lineTo(-p.r * 0.2, -p.r * (0.8 + rng() * 0.2));
      ctx.lineTo(p.r, -p.r * 0.3);
      ctx.lineTo(p.r * 0.7, p.r * 0.6);
      ctx.lineTo(-p.r * 0.5, p.r * (0.7 + rng() * 0.2));
      ctx.closePath();
      ctx.fillStyle = '#7a7266';
      ctx.fill();
      ctx.strokeStyle = '#2b2620';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(150,70,30,0.55)';
      ctx.beginPath();
      ctx.arc(p.r * 0.2, p.r * 0.1, p.r * 0.45, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,25,20,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-p.r * 0.6, -p.r * 0.2);
      ctx.lineTo(p.r * 0.6, p.r * 0.1);
      ctx.stroke();
      ctx.fillStyle = '#c9c0b0';
      for (let i = 0; i < 4; i++) ctx.fillRect(-p.r * 0.5 + i * p.r * 0.32, -p.r * 0.35, 3, 3);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------ lava vents */

class LavaVents {
  constructor(spec, race) {
    const geo = race.geo;
    this.kind = 'vents';
    this.vents = spec.at.map(([u, lat]) => {
      const s = geo.u2s(u);
      geo.at(s, F);
      return { id: nextId++, s, lat, x: F.x + F.nx * lat, y: F.y + F.ny * lat, r: 62, state: 'idle', t: 2 + Math.random() * 5 };
    });
  }

  update(dt, race) {
    for (const v of this.vents) {
      v.t -= dt;
      if (v.t > 0) continue;
      if (v.state === 'idle') {
        v.state = 'warn';
        v.t = 1.5;
        race.emit('ventWarn', { x: v.x, y: v.y });
      } else if (v.state === 'warn') {
        v.state = 'erupt';
        v.t = 1.05;
        race.emit('eruption', { x: v.x, y: v.y });
      } else {
        v.state = 'idle';
        v.t = 3.5 + Math.random() * 3.5;
      }
    }
  }

  collide(r, race) {
    for (const v of this.vents) {
      if (v.state !== 'erupt') continue;
      if ((r.x - v.x) ** 2 + (r.y - v.y) ** 2 < (v.r + r.r * 0.4) ** 2) hazardHit(r, race, { x: v.x, y: v.y, power: 1, kind: 'lava' });
    }
  }

  obstacles(list) {
    for (const v of this.vents) {
      if (v.state === 'warn' || (v.state === 'erupt' && v.t > 0.15)) list.push({ id: v.id, s: v.s, lat: v.lat, r: v.r + 6, vlat: 0 });
    }
  }

  draw(ctx, t) {
    for (const v of this.vents) {
      ctx.fillStyle = '#1a0c08';
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.r * 0.55, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#3a1a10';
      ctx.lineWidth = 6;
      ctx.stroke();
      let heat = 0.25 + 0.1 * Math.sin(t * 3 + v.id);
      if (v.state === 'warn') heat = 0.4 + 0.6 * (1 - v.t / 1.5) * (0.75 + 0.25 * Math.sin(t * 22));
      if (v.state === 'erupt') heat = 1;
      glow(ctx, '#ff5a1a', v.x, v.y, v.r * (1.2 + heat * 1.6), heat);
      if (v.state !== 'idle') {
        ctx.strokeStyle = v.state === 'erupt' ? 'rgba(255,230,120,0.9)' : `rgba(255,120,40,${0.4 + 0.4 * Math.sin(t * 16)})`;
        ctx.lineWidth = 4;
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  drawTop(ctx, t) {
    for (const v of this.vents) {
      if (v.state !== 'erupt') continue;
      const p = 1 - v.t / 1.05;
      const a = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      glow(ctx, '#ffd36a', v.x, v.y, v.r * 2.6, a);
      glow(ctx, '#ff4a12', v.x, v.y - 20, v.r * 4, a * 0.8);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU + t * 2;
        const len = v.r * (0.8 + 0.5 * Math.sin(t * 13 + i * 2)) * a;
        ctx.strokeStyle = `rgba(255,${120 + i * 15},40,${0.6 * a})`;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(v.x + Math.cos(ang) * len, v.y + Math.sin(ang) * len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------ sandstorm */

class Sandstorm {
  constructor(spec, race) {
    const geo = race.geo;
    this.kind = 'sandstorm';
    this.s0 = geo.u2s(spec.from);
    this.span = wrapLen(geo.u2s(spec.to) - this.s0, geo.length);
    this.cycle = spec.cycle || 18;
    this.duration = spec.duration || 7;
    this.t = this.cycle * 0.35;
    this.intensity = 0;
    this.warn = false;
    this.active = false;
    this.wind = 1;
  }

  update(dt, race) {
    this.t += dt;
    const ph = this.t % this.cycle;
    const start = this.cycle - this.duration;
    const wasWarn = this.warn;
    const wasActive = this.active;
    this.warn = ph >= start - 2.5 && ph < start;
    this.active = ph >= start;
    if (this.warn && !wasWarn) race.emit('sandstormWarn', {});
    if (this.active && !wasActive) this.wind = Math.random() < 0.5 ? -1 : 1;
    const target = this.active ? 1 : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * 1.5);
  }

  inZone(r, geo) {
    return geo.inRange(r.s, this.s0 - 300, this.span + 600);
  }

  affect(r, dt, race) {
    if (this.intensity < 0.05 || !this.inZone(r, race.geo)) return;
    // crosswind pushes sideways across the track
    const push = 70 * this.intensity * this.wind * dt;
    r.vx += -r.ty * push;
    r.vy += r.tx * push;
  }

  collide() {}
  obstacles() {}
  draw() {}
}

const TYPES = {
  probe: ProbePatrol,
  barrier: Barrier,
  electric: ElectricGate,
  rocks: FallingRocks,
  asteroids: AsteroidCrossings,
  debris: Debris,
  vents: LavaVents,
  sandstorm: Sandstorm,
};

export function createHazards(track, race) {
  return (track.hazards || []).map((spec) => new TYPES[spec.type](spec, race));
}
