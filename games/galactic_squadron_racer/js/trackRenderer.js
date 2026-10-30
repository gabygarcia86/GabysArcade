/**
 * Draws a track and its environment.
 *
 * The surface is built from the shared centerline: each layer (wall, run-off,
 * curb, racing surface) is a thick round-capped stroke of the centerline in
 * short chunks, so tight corners never fold or tear. Curbs and lane markings
 * are dashed offset lines over the whole loop. Chunks and decorations are
 * culled against the camera view every frame.
 *
 * Decorations are placed once per track from a seeded RNG using a coarse
 * distance field (distance to the nearest wall), so nothing ever sits on the
 * racing surface unless it is meant to.
 *
 * Layers, bottom to top: backdrop (parallax) → ground + ground decor → track →
 * [hazards] → standing decor → [racers, particles] → overhead.
 */
import { getTheme, DECOR, SECTION_STYLE } from './scenery.js';
import { makeCanvas, rngFor, glow, softGlow, makePattern, radial, silhouette } from './gfx.js';
import { buildZones } from './race.js';
import { getSprites } from '../../galactic_squadron/js/sprites.js';
import { TAU, wrapLen, mulberry32 } from './utils.js';

const CELL = 512;
const FIELD = 64;
const FAR = 4000;

export class TrackRenderer {
  constructor(track, geo, ctx, opts = {}) {
    this.track = track;
    this.geo = geo;
    this.theme = getTheme(track.theme);
    this.lowRes = !!opts.lowRes;
    this.sprites = new Map();
    this.patterns = this.buildPatterns(ctx);
    this.chunks = this.buildChunks();
    this.loops = this.buildLoops();
    this.buildField();
    this.items = [];
    this.buckets = new Map();
    this.frame = 0;
    this.placeDecor();
    this.wallLights = this.buildWallLights();
    this.gates = this.buildGates();
    this.zones = buildZones(track, geo);
    this.flyovers = [];
    this.flyTimer = 2;
    this.critters = this.theme.critters ? this.makeCritters() : [];
    if (this.theme.space) this.stars = [0.04, 0.12, 0.25].map((f, i) => ({ f, ...makePattern(ctx, 512, (g, S, rng) => starTile(g, S, rng, i), `stars${i}`) }));
    if (this.theme.cityDepth) this.cityLayers = this.makeCityLayers();
    if (this.theme.overhead === 'traffic') this.traffic = this.makeTraffic();
  }

  /* ================================================================ build */

  buildPatterns(ctx) {
    const th = this.theme;
    const id = this.track.id;
    const p = {};
    if (th.ground) p.ground = makePattern(ctx, 512, th.ground, id + ':ground').pattern;
    p.surface = makePattern(ctx, 256, th.surface, id + ':surface').pattern;
    p.runoff = makePattern(ctx, 256, th.runoff, id + ':runoff').pattern;
    p.deck = makePattern(ctx, 128, (g, S) => {
      g.fillStyle = '#45413c';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = '#25221f';
      g.lineWidth = 3;
      for (let x = 0; x <= S; x += 16) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,120,40,0.15)';
      g.fillRect(0, 0, S, 8);
    }, 'deck').pattern;
    return p;
  }

  buildChunks() {
    const g = this.geo;
    const n = g.n;
    const chunks = [];
    let i = 0;
    while (i < n) {
      const hw0 = g.hw[i];
      const ro0 = g.ro[i];
      const k0 = g.kind[i];
      let j = i + 1;
      while (j < n && j - i < 40 && Math.abs(g.hw[j] - hw0) < 2 && Math.abs(g.ro[j] - ro0) < 2 && g.kind[j] === k0) j++;
      const path = new Path2D();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let k = i; k <= j; k++) {
        const idx = k % n;
        const x = g.x[idx];
        const y = g.y[idx];
        if (k === i) path.moveTo(x, y);
        else path.lineTo(x, y);
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      const mid = (i + Math.min(j, n - 1)) >> 1;
      const m = g.hw[mid] + g.ro[mid] + 160;
      chunks.push({ i0: i, i1: j, hw: g.hw[mid], ro: g.ro[mid], kind: g.kinds[k0], path, x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m });
      i = j;
    }
    return chunks;
  }

  /** Whole-loop offset lines: curbs and lane markings (dashes stay continuous). */
  buildLoops() {
    const g = this.geo;
    const th = this.theme;
    const curbW = th.curbW || 16;
    const offsetPath = (fn) => {
      const p = new Path2D();
      for (let k = 0; k <= g.n; k++) {
        const i = k % g.n;
        const o = fn(i);
        const x = g.x[i] - g.ty[i] * o;
        const y = g.y[i] + g.tx[i] * o;
        if (k === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      return p;
    };
    const loops = {
      center: offsetPath(() => 0),
      curbL: offsetPath((i) => -(g.hw[i] - curbW / 2)),
      curbR: offsetPath((i) => g.hw[i] - curbW / 2),
      lanes: [],
      rails: null,
    };
    if (th.lane) for (const o of th.lane.offsets) loops.lanes.push(offsetPath(() => o));
    return loops;
  }

  /** Coarse grid of (distance to centerline − half-width − run-off): < 0 is inside the walls. */
  buildField() {
    const g = this.geo;
    const b = g.bounds;
    const pad = 1800;
    this.fx0 = b.x0 - pad;
    this.fy0 = b.y0 - pad;
    this.fw = Math.ceil((b.w + pad * 2) / FIELD);
    this.fh = Math.ceil((b.h + pad * 2) / FIELD);
    const f = new Float32Array(this.fw * this.fh).fill(FAR);
    const reach = 1700;
    const rc = Math.ceil(reach / FIELD);
    for (let i = 0; i < g.n; i += 3) {
      const x = g.x[i];
      const y = g.y[i];
      const lim = g.hw[i] + g.ro[i];
      const cx = Math.floor((x - this.fx0) / FIELD);
      const cy = Math.floor((y - this.fy0) / FIELD);
      for (let yy = Math.max(0, cy - rc); yy <= Math.min(this.fh - 1, cy + rc); yy++) {
        const py = this.fy0 + (yy + 0.5) * FIELD;
        for (let xx = Math.max(0, cx - rc); xx <= Math.min(this.fw - 1, cx + rc); xx++) {
          const px = this.fx0 + (xx + 0.5) * FIELD;
          const d = Math.hypot(px - x, py - y) - lim;
          const k = yy * this.fw + xx;
          if (d < f[k]) f[k] = d;
        }
      }
    }
    this.field = f;
  }

  fieldAt(x, y) {
    const cx = Math.floor((x - this.fx0) / FIELD);
    const cy = Math.floor((y - this.fy0) / FIELD);
    if (cx < 0 || cy < 0 || cx >= this.fw || cy >= this.fh) return FAR;
    // FIELD-sized cells: be conservative by the cell half-diagonal
    return this.field[cy * this.fw + cx] - FIELD * 0.71;
  }

  /** Exact distance to the walls (slower; for few points). */
  wallDistance(x, y) {
    const g = this.geo;
    let best = Infinity;
    for (let i = 0; i < g.n; i += 2) {
      const d = Math.hypot(g.x[i] - x, g.y[i] - y) - g.hw[i] - g.ro[i];
      if (d < best) best = d;
    }
    return best;
  }

  addItem(it) {
    const spec = DECOR[it.kind];
    it.layer = spec.layer;
    it.seed = it.seed ?? Math.random() * 100;
    it.pad = spec.pad || 1.2;
    this.items.push(it);
    const R = it.r * it.pad;
    for (let cy = Math.floor((it.y - R) / CELL); cy <= Math.floor((it.y + R) / CELL); cy++) {
      for (let cx = Math.floor((it.x - R) / CELL); cx <= Math.floor((it.x + R) / CELL); cx++) {
        const key = cx * 100003 + cy;
        let list = this.buckets.get(key);
        if (!list) this.buckets.set(key, (list = []));
        list.push(it);
      }
    }
  }

  overlaps(x, y, r, layer) {
    const R = r + 260;
    for (let cy = Math.floor((y - R) / CELL); cy <= Math.floor((y + R) / CELL); cy++) {
      for (let cx = Math.floor((x - R) / CELL); cx <= Math.floor((x + R) / CELL); cx++) {
        const list = this.buckets.get(cx * 100003 + cy);
        if (!list) continue;
        for (const o of list) {
          if (o.layer !== layer) continue;
          const min = (r + o.r) * (layer === 'ground' ? 0.7 : 0.85);
          if ((o.x - x) ** 2 + (o.y - y) ** 2 < min * min) return true;
        }
      }
    }
    return false;
  }

  /** Rotation that turns a decoration's +y side toward the nearest track point. */
  faceTrack(x, y) {
    const i = this.geo.nearest(x, y);
    const dx = this.geo.x[i] - x;
    const dy = this.geo.y[i] - y;
    return Math.atan2(-dx, dy);
  }

  placeDecor() {
    const th = this.theme;
    const g = this.geo;
    const rng = rngFor(this.track.id + ':decor');
    const facing = new Set(['hangar', 'stands', 'screen', 'billboard', 'blastdoor', 'refinery']);

    for (const lm of this.track.landmarks || []) {
      this.addItem({ kind: lm.kind, x: lm.x, y: lm.y, r: lm.r, rot: 0, variant: 0, baseR: lm.r });
    }

    // roadside rows
    for (const a of th.along || []) {
      for (let s = a.spacing / 2; s < g.length; s += a.spacing) {
        if (a.minStraight) {
          let curvy = false;
          for (let d = -300; d <= 300; d += 40) if (Math.abs(g.curv[g.index(s + d)]) > 1 / 2000) curvy = true;
          if (curvy) continue;
        }
        const f = g.at(s, {});
        for (const side of a.sides || [-1, 1]) {
          const lat = side * (f.hw + f.ro + a.offset);
          const x = f.x + f.nx * lat;
          const y = f.y + f.ny * lat;
          const r = a.r;
          if (this.wallDistance(x, y) < a.offset * 0.7) continue;
          if (this.overlaps(x, y, r, DECOR[a.kind].layer)) continue;
          this.addItem({ kind: a.kind, x, y, r, rot: Math.atan2(side * f.nx, -side * f.ny), variant: Math.floor(rng() * 3), baseR: r, color: a.color });
        }
      }
    }

    // dense walls of scenery along special sections
    const sectionDecor = {
      canyon: { kind: 'boulder', step: 70, r: [50, 95], off: [10, 60] },
      tunnel: { kind: 'crystal', step: 90, r: [45, 80], off: [5, 40] },
      narrow: this.track.theme === 'forest' ? { kind: 'tree', step: 230, r: [130, 200], off: [20, 80] } : this.track.theme === 'graveyard' ? { kind: 'scrapheap', step: 120, r: [50, 80], off: [10, 50] } : null,
      technical: { kind: 'floodlight', step: 400, r: [36, 40], off: [40, 60] },
    };
    for (const sec of g.sections) {
      const sd = sectionDecor[sec.kind];
      if (!sd) continue;
      for (let d = 0; d <= sec.span; d += sd.step) {
        const f = g.at(sec.s0 + d, {});
        for (const side of [-1, 1]) {
          const r = sd.r[0] + rng() * (sd.r[1] - sd.r[0]);
          const lat = side * (f.hw + f.ro + r * 0.5 + sd.off[0] + rng() * (sd.off[1] - sd.off[0]));
          const x = f.x + f.nx * lat;
          const y = f.y + f.ny * lat;
          if (this.wallDistance(x, y) < r * 0.3) continue;
          if (this.overlaps(x, y, r * 0.8, DECOR[sd.kind].layer)) continue;
          this.addItem({ kind: sd.kind, x, y, r, rot: rng() * TAU, variant: Math.floor(rng() * 3), baseR: sd.r[1] });
        }
      }
    }

    // scattered scenery, biggest first
    const b = g.bounds;
    const specs = (th.decor || []).slice().sort((p, q) => q.r[1] - p.r[1]);
    for (const spec of specs) {
      const layer = DECOR[spec.kind].layer;
      let placed = 0;
      const span = spec.gap[1] + spec.r[1];
      for (let tries = 0; tries < spec.count * 40 && placed < spec.count; tries++) {
        const x = b.x0 - span + rng() * (b.w + span * 2);
        const y = b.y0 - span + rng() * (b.h + span * 2);
        const r = spec.r[0] + rng() * (spec.r[1] - spec.r[0]);
        const d = this.fieldAt(x, y) - r;
        if (d < spec.gap[0] || d > spec.gap[1]) continue;
        if (this.overlaps(x, y, r, layer)) continue;
        if (d < 60 && this.wallDistance(x, y) - r < spec.gap[0]) continue;
        const rot = facing.has(spec.kind) ? this.faceTrack(x, y) : rng() * TAU;
        this.addItem({ kind: spec.kind, x, y, r, rot, variant: Math.floor(rng() * 3), baseR: spec.r[1] });
        placed++;
      }
    }
  }

  buildWallLights() {
    const wl = this.theme.wallLights;
    if (!wl) return [];
    const g = this.geo;
    const lights = [];
    let idx = 0;
    for (let s = 0; s < g.length; s += wl.spacing) {
      const f = g.at(s, {});
      for (const side of [-1, 1]) {
        const lat = side * (f.hw + f.ro + 4);
        const x = f.x + f.nx * lat;
        const y = f.y + f.ny * lat;
        if (this.wallDistance(x, y) < -2) continue; // inside a tight corner: no wall there
        lights.push({ x, y, k: idx++, s });
      }
    }
    return lights;
  }

  buildGates() {
    const g = this.geo;
    const gates = [];
    for (let k = 1; k < g.checkpointCount; k++) {
      const s = (k / g.checkpointCount) * g.length;
      gates.push({ s, f: g.at(s, {}) });
    }
    return gates;
  }

  /* ============================================================== sprites */

  sprite(it, top = false) {
    const key = it.kind + (top ? ':top:' : ':') + it.variant + ':' + Math.round(it.baseR);
    let s = this.sprites.get(key);
    if (s) return s;
    const spec = DECOR[it.kind];
    const R = it.baseR;
    const res = this.lowRes ? 0.14 : R > 500 ? 0.5 : R > 260 ? 0.6 : R > 140 ? 0.8 : 1;
    const size = 2 * R * it.pad * res;
    const { c, g } = makeCanvas(size, size);
    g.setTransform(res, 0, 0, res, c.width / 2, c.height / 2);
    const rng = rngFor(this.track.id + key);
    (top ? spec.paintTop : spec.paint)(g, R, rng);
    s = c;
    this.sprites.set(key, s);
    return s;
  }

  /* ============================================================== drawing */

  visibleItems(view, layer, out) {
    this.frame++;
    out.length = 0;
    const m = 0;
    for (let cy = Math.floor((view.y0 - m) / CELL); cy <= Math.floor((view.y1 + m) / CELL); cy++) {
      for (let cx = Math.floor((view.x0 - m) / CELL); cx <= Math.floor((view.x1 + m) / CELL); cx++) {
        const list = this.buckets.get(cx * 100003 + cy);
        if (!list) continue;
        for (const it of list) {
          if (it.layer !== layer || it.frame === this.frame) continue;
          it.frame = this.frame;
          const R = it.r * it.pad;
          if (it.x + R < view.x0 || it.x - R > view.x1 || it.y + R < view.y0 || it.y - R > view.y1) continue;
          out.push(it);
        }
      }
    }
    return out;
  }

  drawItems(ctx, view, layer, t, extra) {
    const list = this.visibleItems(view, layer, this._vis || (this._vis = []));
    for (const it of list) {
      const spr = this.sprite(it);
      const R = it.r * it.pad;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      ctx.drawImage(spr, -R, -R, R * 2, R * 2);
      ctx.restore();
    }
    for (const it of list) {
      const spec = DECOR[it.kind];
      if (spec.anim) spec.anim(ctx, it, t, extra);
    }
    return list;
  }

  /** Screen-space backdrop: starfields, the city far below. Called with an identity (device px) transform. */
  drawBackdrop(ctx, cam, W, H, t) {
    const th = this.theme;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, W, H);
    const s = cam.scale;
    if (this.stars) {
      // nebulae and distant planets drift slowly
      const c = this.geo.bounds;
      const mx = (c.x0 + c.x1) / 2;
      const my = (c.y0 + c.y1) / 2;
      const neb = [[-1800, -900, 2600, '#5a2a9a'], [2200, 600, 2200, '#1a4a9a'], [400, 1900, 1800, '#9a2a6a']];
      for (const [nx, ny, nr, col] of neb) {
        const f = 0.12;
        const x = W / 2 + (mx + nx - cam.x) * s * f;
        const y = H / 2 + (my + ny - cam.y) * s * f;
        softGlow(ctx, col, x, y, nr * s * f * 2.2, 0.5);
      }
      for (const L of this.stars) {
        const ox = -cam.x * s * L.f;
        const oy = -cam.y * s * L.f;
        L.pattern.setTransform?.(new DOMMatrix([1, 0, 0, 1, ox % 512, oy % 512]));
        ctx.fillStyle = L.pattern;
        ctx.fillRect(0, 0, W, H);
      }
      const pf = 0.06;
      const px = W / 2 + (mx + 2600 - cam.x) * s * pf;
      const py = H / 2 + (my - 1400 - cam.y) * s * pf;
      const pr = 900 * s * pf * 2.4;
      ctx.fillStyle = radial(ctx, px - pr * 0.35, py - pr * 0.35, pr * 0.1, pr, [[0, '#d98a5a'], [0.7, '#7a3a2a'], [1, '#2a1010']]);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, TAU);
      ctx.fill();
      softGlow(ctx, '#ff9a6a', px, py, pr * 2.6, 0.25);
    }
    if (this.cityLayers) this.drawCityDepth(ctx, cam, W, H, t);
  }

  /** Ground pattern under everything (world transform active). */
  drawGround(ctx, view, t) {
    if (this.patterns.ground) {
      ctx.fillStyle = this.patterns.ground;
      ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    }
    this.drawItems(ctx, view, 'ground', t);
  }

  visibleChunks(view) {
    const out = this._chunks || (this._chunks = []);
    out.length = 0;
    for (const c of this.chunks) {
      if (c.x1 < view.x0 || c.x0 > view.x1 || c.y1 < view.y0 || c.y0 > view.y1) continue;
      out.push(c);
    }
    return out;
  }

  drawTrack(ctx, view, t, race) {
    const th = this.theme;
    const vis = this.visibleChunks(view);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const wallW = th.wall.width;

    // walls: outer band, then a lighter top edge
    ctx.strokeStyle = th.wall.color;
    for (const c of vis) {
      const extra = c.kind === 'canyon' ? SECTION_STYLE.canyon.wallWidth : c.kind === 'bridge' ? 0 : wallW;
      if (c.kind === 'canyon') ctx.strokeStyle = SECTION_STYLE.canyon.wall;
      ctx.lineWidth = 2 * (c.hw + c.ro + extra);
      ctx.stroke(c.path);
      if (c.kind === 'canyon') ctx.strokeStyle = th.wall.color;
    }
    ctx.strokeStyle = th.wall.top;
    for (const c of vis) {
      if (c.kind === 'bridge') continue;
      if (c.kind === 'canyon') ctx.strokeStyle = SECTION_STYLE.canyon.wallTop;
      ctx.lineWidth = 2 * (c.hw + c.ro + (c.kind === 'canyon' ? 26 : 5));
      ctx.stroke(c.path);
      if (c.kind === 'canyon') ctx.strokeStyle = th.wall.top;
    }

    // run-off (lava flows)
    if (th.runoffFlow && this.patterns.runoff.setTransform) {
      const o = (t * th.runoffFlow) % 256;
      this.patterns.runoff.setTransform(new DOMMatrix([1, 0, 0, 1, o, o * 0.4]));
    }
    ctx.strokeStyle = this.patterns.runoff;
    for (const c of vis) {
      ctx.lineWidth = 2 * (c.hw + c.ro);
      ctx.stroke(c.path);
    }
    if (th.runoffFlow) {
      // lava glows under the bridges and along the platforms
      ctx.strokeStyle = `rgba(255,140,40,${0.18 + 0.06 * Math.sin(t * 2)})`;
      ctx.lineWidth = 2 * (this.track.halfWidth + this.track.runoff * 0.5);
      ctx.stroke(this.loops.center);
    }

    // bridge pillars and shadows in the lava
    for (const c of vis) {
      if (c.kind !== 'bridge') continue;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2 * c.hw + 40;
      ctx.save();
      ctx.translate(18, 26);
      ctx.stroke(c.path);
      ctx.restore();
    }

    // racing surface
    for (const c of vis) {
      if (c.kind === 'bridge') ctx.strokeStyle = this.patterns.deck;
      else if (c.kind === 'technical') ctx.strokeStyle = SECTION_STYLE.technical.surface;
      else ctx.strokeStyle = this.patterns.surface;
      ctx.lineWidth = 2 * c.hw;
      ctx.stroke(c.path);
    }

    this.drawZones(ctx, view, t, race);

    // curbs
    const L = this.loops;
    if (th.curb) {
      const w = th.curbW || 16;
      ctx.lineCap = 'butt';
      ctx.lineWidth = w;
      ctx.strokeStyle = th.curb[1];
      ctx.stroke(L.curbL);
      ctx.stroke(L.curbR);
      ctx.setLineDash([46, 46]);
      ctx.strokeStyle = th.curb[0];
      ctx.stroke(L.curbL);
      ctx.stroke(L.curbR);
      ctx.setLineDash([]);
    } else if (th.edge) {
      ctx.lineWidth = 10;
      ctx.strokeStyle = th.edge;
      ctx.stroke(L.curbL);
      ctx.stroke(L.curbR);
    }
    if (th.lane) {
      ctx.lineCap = 'butt';
      ctx.strokeStyle = th.lane.color;
      ctx.lineWidth = th.lane.width;
      ctx.setLineDash(th.lane.dash);
      for (const p of L.lanes) ctx.stroke(p);
      ctx.setLineDash([]);
    }

    // bridge rails
    for (const c of vis) {
      if (c.kind !== 'bridge') continue;
      ctx.lineCap = 'butt';
      ctx.strokeStyle = SECTION_STYLE.bridge.rail;
      ctx.lineWidth = 2 * c.hw + 12;
      ctx.setLineDash([10, 34]);
      ctx.stroke(c.path);
      ctx.setLineDash([]);
    }
    this.drawLights(ctx, view, t);
    this.drawStartAndGates(ctx, view, t, race);
  }

  drawZones(ctx, view, t, race) {
    const g = this.geo;
    const f = this._f || (this._f = {});
    for (const z of this.zones) {
      g.at(z.s0 + z.span / 2, f);
      if (f.x < view.x0 - 400 || f.x > view.x1 + 400 || f.y < view.y0 - 400 || f.y > view.y1 + 400) continue;
      if (z.type === 'boost') {
        ctx.save();
        ctx.translate(f.x + f.nx * z.lat, f.y + f.ny * z.lat);
        ctx.rotate(Math.atan2(f.ty, f.tx));
        const len = z.span;
        const w = z.halfW * 2;
        ctx.fillStyle = 'rgba(10,30,50,0.85)';
        ctx.fillRect(-len / 2, -w / 2, len, w);
        ctx.strokeStyle = '#38d6ff';
        ctx.lineWidth = 3;
        ctx.strokeRect(-len / 2, -w / 2, len, w);
        for (let i = 0; i < 3; i++) {
          const on = (Math.floor(t * 6) % 3) === i;
          ctx.strokeStyle = on ? '#bff4ff' : 'rgba(56,214,255,0.55)';
          ctx.lineWidth = 8;
          const x = -len / 2 + 22 + i * 34;
          ctx.beginPath();
          ctx.moveTo(x, -w * 0.32);
          ctx.lineTo(x + 18, 0);
          ctx.lineTo(x, w * 0.32);
          ctx.stroke();
        }
        ctx.restore();
        glow(ctx, '#38d6ff', f.x + f.nx * z.lat, f.y + f.ny * z.lat, 160, 0.35 + 0.15 * Math.sin(t * 8));
        continue;
      }
      // surface patches: build an outline along the zone
      ctx.beginPath();
      const steps = Math.max(4, Math.ceil(z.span / 30));
      for (let i = 0; i <= steps; i++) {
        const s = z.s0 + (i / steps) * z.span;
        g.at(s, f);
        const wob = Math.sin(i * 1.7 + z.s0) * 10 * Math.sin((i / steps) * Math.PI);
        const w = z.halfW * Math.sin((i / steps) * Math.PI) ** 0.4 + wob;
        const lat = z.lat - w;
        if (i === 0) ctx.moveTo(f.x + f.nx * lat, f.y + f.ny * lat);
        else ctx.lineTo(f.x + f.nx * lat, f.y + f.ny * lat);
      }
      for (let i = steps; i >= 0; i--) {
        const s = z.s0 + (i / steps) * z.span;
        g.at(s, f);
        const w = z.halfW * Math.sin((i / steps) * Math.PI) ** 0.4;
        const lat = z.lat + w;
        ctx.lineTo(f.x + f.nx * lat, f.y + f.ny * lat);
      }
      ctx.closePath();
      if (z.type === 'slick') {
        ctx.fillStyle = 'rgba(225,248,255,0.75)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(200,140,80,0.6)';
        ctx.fill();
      }
    }
  }

  drawLights(ctx, view, t) {
    const wl = this.theme.wallLights;
    if (!wl) return;
    for (const L of this.wallLights) {
      if (L.x < view.x0 - 40 || L.x > view.x1 + 40 || L.y < view.y0 - 40 || L.y > view.y1 + 40) continue;
      let a = 1;
      if (wl.chase) a = (Math.floor(t * wl.blink) + L.k) % 6 < 2 ? 1 : 0.25;
      else if (wl.blink) a = 0.45 + 0.55 * Math.max(0, Math.sin(t * wl.blink + L.k * 0.9));
      glow(ctx, wl.color, L.x, L.y, 46, a);
    }
  }

  drawStartAndGates(ctx, view, t, race) {
    const g = this.geo;
    const f = g.at(0, this._f || (this._f = {}));
    if (f.x > view.x0 - 500 && f.x < view.x1 + 500 && f.y > view.y0 - 500 && f.y < view.y1 + 500) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.atan2(f.ty, f.tx));
      const sq = 16;
      const n = Math.ceil((f.hw * 2) / sq);
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = (i + r) % 2 ? '#111' : '#f4f4f4';
          ctx.fillRect(-sq + r * sq, -f.hw + i * sq, sq, Math.min(sq, f.hw * 2 - i * sq));
        }
      }
      // grid boxes behind the line
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 4;
      for (let k = 0; k < 4; k++) {
        const x = -60 - k * 105;
        const y = (k % 2 === 0 ? -1 : 1) * f.hw * 0.42;
        ctx.beginPath();
        ctx.moveTo(x + 30, y - 30);
        ctx.lineTo(x - 30, y - 30);
        ctx.lineTo(x - 30, y + 30);
        ctx.lineTo(x + 30, y + 30);
        ctx.stroke();
      }
      ctx.restore();
      // start gantry posts
      for (const side of [-1, 1]) glow(ctx, race?.state === 'countdown' ? '#ff3a3a' : '#7dff8a', f.x + f.nx * side * (f.hw + 14), f.y + f.ny * side * (f.hw + 14), 70, 0.9);
    }
    // checkpoint gates: faint holo lines with posts
    ctx.lineCap = 'butt';
    for (const gt of this.gates) {
      const q = gt.f;
      if (q.x < view.x0 - 300 || q.x > view.x1 + 300 || q.y < view.y0 - 300 || q.y > view.y1 + 300) continue;
      ctx.strokeStyle = `rgba(120,220,255,${0.12 + 0.05 * Math.sin(t * 3 + gt.s)})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(q.x - q.nx * q.hw, q.y - q.ny * q.hw);
      ctx.lineTo(q.x + q.nx * q.hw, q.y + q.ny * q.hw);
      ctx.stroke();
      for (const side of [-1, 1]) glow(ctx, '#7fd8ff', q.x + q.nx * side * (q.hw + 6), q.y + q.ny * side * (q.hw + 6), 34, 0.7);
    }
  }

  drawMid(ctx, view, t, extra) {
    this.drawItems(ctx, view, 'mid', t, extra);
    for (const c of this.critters) this.drawCritter(ctx, c, t);
  }

  /* ============================================================ overhead */

  tick(dt, cam, race) {
    if (this.theme.overhead === 'flyover') {
      this.flyTimer -= dt;
      if (this.flyTimer <= 0) {
        this.flyTimer = 6 + Math.random() * 6;
        const a = Math.random() * TAU;
        const sp = getSprites();
        const kinds = [sp.interceptor, sp.interceptor, sp.heavy, sp.bomber];
        const dist = 1600;
        const n = 3 + Math.floor(Math.random() * 3);
        const lead = kinds[Math.floor(Math.random() * kinds.length)];
        const ships = [];
        for (let i = 0; i < n; i++) ships.push({ ox: (i - (n - 1) / 2) * 70, oy: Math.abs(i - (n - 1) / 2) * 60, spr: i === 0 ? lead : kinds[Math.floor(Math.random() * kinds.length)] });
        this.flyovers.push({ x: cam.x - Math.cos(a) * dist, y: cam.y - Math.sin(a) * dist, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, a, ships, life: 6 });
      }
      for (let i = this.flyovers.length - 1; i >= 0; i--) {
        const f = this.flyovers[i];
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.life -= dt;
        if (f.life <= 0) this.flyovers.splice(i, 1);
      }
    }
    if (this.critters.length) this.tickCritters(dt, race);
  }

  drawOverhead(ctx, view, t, cam, race) {
    const ov = this.theme.overhead;
    if (ov === 'canopy') {
      const list = this.visibleItems(view, 'mid', this._top || (this._top = []));
      for (const it of list) {
        if (it.kind !== 'tree') continue;
        const spr = this.sprite(it, true);
        const R = it.r * it.pad * 1.25;
        // tall canopies sit closer to the camera: a little parallax
        const px = it.x + (it.x - cam.x) * 0.1;
        const py = it.y + (it.y - cam.y) * 0.1;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(it.rot);
        ctx.drawImage(spr, -R, -R, R * 2, R * 2);
        ctx.restore();
      }
      // drifting mist
      for (let i = 0; i < 5; i++) {
        const mx = cam.x + Math.sin(t * 0.05 + i * 1.7) * 900 + (i - 2) * 300;
        const my = cam.y + Math.cos(t * 0.04 + i * 2.3) * 700;
        softGlow(ctx, '#cfe8d0', mx, my, 900, 0.12);
      }
    } else if (ov === 'tunnels') {
      ctx.lineCap = 'butt';
      for (const c of this.visibleChunks(view)) {
        if (c.kind !== 'tunnel') continue;
        ctx.strokeStyle = SECTION_STYLE.tunnel.roof;
        ctx.lineWidth = 2 * (c.hw + c.ro + 34);
        ctx.stroke(c.path);
        ctx.strokeStyle = SECTION_STYLE.tunnel.rib;
        ctx.setLineDash([14, 110]);
        ctx.lineWidth = 2 * (c.hw + c.ro + 34);
        ctx.stroke(c.path);
        ctx.setLineDash([]);
      }
    } else if (ov === 'flyover') {
      for (const f of this.flyovers) {
        for (const s of f.ships) {
          const cos = Math.cos(f.a);
          const sin = Math.sin(f.a);
          const x = f.x - s.oy * cos - s.ox * sin;
          const y = f.y - s.oy * sin + s.ox * cos;
          const k = 1.5;
          const sp = s.spr;
          // shadow on the ground, then the ship itself high above (parallax)
          ctx.save();
          ctx.translate(x + 90, y + 120);
          ctx.rotate(f.a + Math.PI / 2);
          ctx.globalAlpha = 0.25;
          ctx.drawImage(silhouette(sp.canvas), (-sp.w * k) / 2, (-sp.h * k) / 2, sp.w * k, sp.h * k);
          ctx.restore();
          const px = x + (x - cam.x) * 0.35;
          const py = y + (y - cam.y) * 0.35;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(f.a + Math.PI / 2);
          ctx.drawImage(getSprites().flames.red, -4, sp.h * 0.45, 8, 22);
          ctx.drawImage(sp.canvas, (-sp.w * k * 1.35) / 2, (-sp.h * k * 1.35) / 2, sp.w * k * 1.35, sp.h * k * 1.35);
          ctx.restore();
        }
      }
    } else if (ov === 'traffic') {
      this.drawTraffic(ctx, view, t, cam, true);
    } else if (ov === 'stadium') {
      this.drawGantries(ctx, view, t, cam);
    }
  }

  drawGantries(ctx, view, t, cam) {
    const g = this.geo;
    const f = this._gf || (this._gf = {});
    for (const s of [g.length * 0.004, g.length * 0.33, g.length * 0.66]) {
      g.at(s, f);
      if (f.x < view.x0 - 600 || f.x > view.x1 + 600 || f.y < view.y0 - 600 || f.y > view.y1 + 600) continue;
      const px = f.x + (f.x - cam.x) * 0.12;
      const py = f.y + (f.y - cam.y) * 0.12;
      const half = f.hw + f.ro + 50;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(f.ty, f.tx));
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-14 + 50, -half + 60, 28, half * 2);
      ctx.fillStyle = '#2a3150';
      ctx.fillRect(-16, -half, 32, half * 2);
      ctx.strokeStyle = '#7f8fd6';
      ctx.lineWidth = 3;
      ctx.strokeRect(-16, -half, 32, half * 2);
      for (let y = -half + 20; y < half - 10; y += 40) {
        const on = (Math.floor(t * 5) + Math.floor(y / 40)) % 2 === 0;
        ctx.fillStyle = on ? '#ffd34a' : '#ff5ad0';
        ctx.fillRect(-6, y, 12, 12);
      }
      ctx.restore();
    }
  }

  /* ============================================================== city */

  makeCityLayers() {
    const variants = [];
    for (let v = 0; v < 10; v++) {
      const rng = mulberry32(v * 977 + 13);
      const w = 120 + rng() * 120;
      const h = 120 + rng() * 120;
      const { c, g } = makeCanvas(w + 8, h + 8);
      g.translate(4, 4);
      g.fillStyle = ['#151a33', '#1a1636', '#11202f'][v % 3];
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2b3566';
      g.lineWidth = 2;
      g.strokeRect(0, 0, w, h);
      g.fillStyle = '#1f2747';
      g.fillRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = rng() < 0.7 ? 'rgba(255,214,140,0.75)' : 'rgba(120,220,255,0.75)';
        g.fillRect(4 + rng() * (w - 10), 4 + rng() * (h - 10), 3, 3);
      }
      variants.push({ c, w, h });
    }
    return { variants, depths: [0.38, 0.56, 0.75] };
  }

  drawCityDepth(ctx, cam, W, H, t) {
    const L = this.cityLayers;
    const g0 = ctx.createLinearGradient(0, 0, 0, H);
    g0.addColorStop(0, '#0b0e24');
    g0.addColorStop(1, '#15081f');
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, W, H);
    const cell = 300;
    for (const f of L.depths) {
      const sc = cam.scale * f;
      ctx.setTransform(sc, 0, 0, sc, W / 2 - cam.x * sc, H / 2 - cam.y * sc);
      const hx = W / 2 / sc;
      const hy = H / 2 / sc;
      const x0 = Math.floor((cam.x - hx) / cell) - 1;
      const x1 = Math.floor((cam.x + hx) / cell) + 1;
      const y0 = Math.floor((cam.y - hy) / cell) - 1;
      const y1 = Math.floor((cam.y + hy) / cell) + 1;
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const hsh = (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(Math.round(f * 100), 83492791)) >>> 0;
          if (hsh % 10 < 3) continue;
          const v = L.variants[hsh % L.variants.length];
          const ox = ((hsh >>> 8) % 60) - 30;
          const oy = ((hsh >>> 16) % 60) - 30;
          ctx.drawImage(v.c, cx * cell + ox, cy * cell + oy);
        }
      }
      if (this.traffic && f === L.depths[1]) this.drawTraffic(ctx, null, t, cam, false);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(16,12,40,0.38)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  makeTraffic() {
    const b = this.geo.bounds;
    const rng = mulberry32(77);
    const lanes = [];
    for (let i = 0; i < 14; i++) {
      const horizontal = i % 2 === 0;
      const p = horizontal ? b.y0 + rng() * b.h : b.x0 + rng() * b.w;
      lanes.push({ horizontal, p, dir: rng() < 0.5 ? 1 : -1, speed: 260 + rng() * 380, gap: 220 + rng() * 300, above: i % 3 === 0, hue: Math.floor(rng() * 360) });
    }
    return lanes;
  }

  drawTraffic(ctx, view, t, cam, above) {
    const b = this.geo.bounds;
    for (const lane of this.traffic) {
      if (lane.above !== above) continue;
      const span = lane.horizontal ? b.w + 2000 : b.h + 2000;
      const start = lane.horizontal ? b.x0 - 1000 : b.y0 - 1000;
      const count = Math.ceil(span / lane.gap);
      for (let k = 0; k < count; k++) {
        const along = start + wrapLen(k * lane.gap + t * lane.speed * lane.dir, span);
        let x = lane.horizontal ? along : lane.p;
        let y = lane.horizontal ? lane.p : along;
        if (above) {
          x += (x - cam.x) * 0.25;
          y += (y - cam.y) * 0.25;
          if (view && (x < view.x0 - 100 || x > view.x1 + 100 || y < view.y0 - 100 || y > view.y1 + 100)) continue;
        }
        const ang = lane.horizontal ? (lane.dir > 0 ? 0 : Math.PI) : lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        const s = above ? 1.3 : 1;
        ctx.fillStyle = `hsl(${(lane.hue + k * 37) % 360},45%,${above ? 55 : 35}%)`;
        ctx.fillRect(-22 * s, -9 * s, 44 * s, 18 * s);
        ctx.fillStyle = 'rgba(180,230,255,0.8)';
        ctx.fillRect(6 * s, -6 * s, 10 * s, 12 * s);
        ctx.restore();
        glow(ctx, '#fff2c0', x + Math.cos(ang) * 24 * s, y + Math.sin(ang) * 24 * s, 26 * s, 0.8);
        glow(ctx, '#ff3a3a', x - Math.cos(ang) * 24 * s, y - Math.sin(ang) * 24 * s, 22 * s, 0.8);
      }
    }
  }

  /* ============================================================ critters */

  makeCritters() {
    const g = this.geo;
    const rng = mulberry32(31);
    const out = [];
    for (let i = 0; i < 18; i++) {
      const s = rng() * g.length;
      const side = rng() < 0.5 ? -1 : 1;
      const f = g.at(s, {});
      const lat = side * (f.hw + f.ro + 30 + rng() * 120);
      out.push({ x: f.x + f.nx * lat, y: f.y + f.ny * lat, hx: f.x + f.nx * lat, hy: f.y + f.ny * lat, a: rng() * TAU, hop: rng() * 3, flee: 0, fx: 0, fy: 0 });
    }
    return out;
  }

  tickCritters(dt, race) {
    for (const c of this.critters) {
      c.hop -= dt;
      let near = null;
      if (race) {
        for (const r of race.racers) {
          if ((r.x - c.x) ** 2 + (r.y - c.y) ** 2 < 220 * 220) near = r;
        }
      }
      if (near) {
        const dx = c.x - near.x;
        const dy = c.y - near.y;
        const l = Math.hypot(dx, dy) || 1;
        c.fx = dx / l;
        c.fy = dy / l;
        c.flee = 0.6;
      }
      if (c.flee > 0) {
        c.flee -= dt;
        c.x += c.fx * 260 * dt;
        c.y += c.fy * 260 * dt;
        c.a = Math.atan2(c.fy, c.fx);
      } else if (c.hop <= 0) {
        c.hop = 0.8 + Math.random() * 2.5;
        c.a = Math.atan2(c.hy - c.y, c.hx - c.x) + (Math.random() - 0.5) * 2.5;
      } else if (c.hop > 0.5) {
        c.x += Math.cos(c.a) * 40 * dt;
        c.y += Math.sin(c.a) * 40 * dt;
      }
    }
  }

  drawCritter(ctx, c, t) {
    const bob = Math.abs(Math.sin(t * 10 + c.hx)) * (c.flee > 0 || c.hop > 0.5 ? 3 : 0);
    ctx.save();
    ctx.translate(c.x, c.y - bob);
    ctx.rotate(c.a);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 4 + bob, 11, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a5434';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5a3b22';
    ctx.beginPath();
    ctx.arc(9, 0, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3a2614';
    ctx.beginPath();
    ctx.arc(10, -5, 2.5, 0, TAU);
    ctx.arc(10, 5, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ============================================================ overview */

  /** Renders the whole track scaled into a canvas (menu thumbnails and previews). */
  renderOverview(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const b = this.geo.bounds;
    const pad = opts.pad ?? 0.06;
    const scale = Math.min(W / (b.w * (1 + pad * 2)), H / (b.h * (1 + pad * 2)));
    const cam = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, scale };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackdrop(ctx, cam, W, H, 0);
    ctx.setTransform(scale, 0, 0, scale, W / 2 - cam.x * scale, H / 2 - cam.y * scale);
    const view = { x0: cam.x - W / 2 / scale, y0: cam.y - H / 2 / scale, x1: cam.x + W / 2 / scale, y1: cam.y + H / 2 / scale };
    this.drawGround(ctx, view, 0);
    this.drawTrack(ctx, view, 0, opts.race || null);
    this.drawItems(ctx, view, 'mid', 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return { scale, cam };
  }
}

function starTile(g, S, rng, layer) {
  const count = [260, 120, 50][layer];
  for (let i = 0; i < count; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const r = [0.6, 1.0, 1.6][layer] * (0.6 + rng() * 0.8);
    const a = 0.35 + rng() * 0.65;
    g.fillStyle = rng() < 0.15 ? `rgba(160,200,255,${a})` : rng() < 0.1 ? `rgba(255,210,170,${a})` : `rgba(255,255,255,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
}
