/**
 * Track geometry shared by every system (physics, walls, checkpoints, AI,
 * rendering, minimap).
 *
 * A layout is a closed polygon of corner vertices [x, y, radius]. Each corner
 * is rounded with a circular fillet of that radius and joined to the next by a
 * straight, so corners and straights are exact. The centerline is resampled
 * every SAMPLE units into parallel typed arrays, indexed from the start line in
 * racing direction:
 *
 *   x, y     centerline        tx, ty  unit tangent (racing direction)
 *   hw       track half-width  ro      run-off width beyond the edge (wall at hw + ro)
 *   curv     signed curvature  (+ = right-hand turn on screen)
 *   kind     section type index into `kinds` (0 = plain track)
 *
 * The right-hand normal is (-ty, tx); `lat` > 0 means right of the centerline.
 *
 * Positions along the layout are written as "u" values: vertex index plus a
 * fraction toward the next vertex (u = 2.5 is halfway from corner 2 to 3).
 */
import { CONFIG } from './config.js';
import { smoothstep, wrapLen, loopDelta } from './utils.js';

export const SAMPLE = 8;
const LOCAL_WINDOW = 24;

function buildPieces(points) {
  const n = points.length;
  const corners = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i - 1 + n) % n];
    const [x, y, r] = points[i];
    const [qx, qy] = points[(i + 1) % n];
    const la = Math.hypot(x - px, y - py);
    const lb = Math.hypot(qx - x, qy - y);
    const ax = (x - px) / la;
    const ay = (y - py) / la;
    const bx = (qx - x) / lb;
    const by = (qy - y) / lb;
    const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    const t = Math.abs(turn) < 1e-4 ? 0 : r * Math.tan(Math.abs(turn) / 2);
    corners.push({ x, y, r, turn, t, ax, ay, bx, by, outLen: lb });
  }

  const pieces = [];
  const errors = [];
  for (let i = 0; i < n; i++) {
    const c = corners[i];
    const next = corners[(i + 1) % n];
    if (c.t + next.t > c.outLen + 0.5) {
      errors.push(`corners ${i} and ${(i + 1) % n}: fillets overlap by ${Math.round(c.t + next.t - c.outLen)}`);
    }
    if (c.t > 0) {
      const sx = c.x - c.ax * c.t;
      const sy = c.y - c.ay * c.t;
      const side = Math.sign(c.turn);
      const cx = sx - c.ay * c.r * side;
      const cy = sy + c.ax * c.r * side;
      pieces.push({ type: 'arc', cx, cy, r: c.r, a0: Math.atan2(sy - cy, sx - cx), sweep: c.turn, len: c.r * Math.abs(c.turn), vertex: i });
    } else {
      pieces.push({ type: 'mark', len: 0, vertex: i });
    }
    const ex = c.x + c.bx * c.t;
    const ey = c.y + c.by * c.t;
    const nsx = next.x - next.ax * next.t;
    const nsy = next.y - next.ay * next.t;
    const len = Math.hypot(nsx - ex, nsy - ey);
    if (len > 0.01) pieces.push({ type: 'line', x0: ex, y0: ey, dx: (nsx - ex) / len, dy: (nsy - ey) / len, len, vertex: i });
  }
  return { pieces, corners, errors };
}

function samplePiece(p, d, out) {
  if (p.type === 'line') {
    out.x = p.x0 + p.dx * d;
    out.y = p.y0 + p.dy * d;
    out.tx = p.dx;
    out.ty = p.dy;
    out.k = 0;
  } else {
    const a = p.a0 + (p.sweep > 0 ? 1 : -1) * (d / p.r);
    const c = Math.cos(a);
    const s = Math.sin(a);
    out.x = p.cx + c * p.r;
    out.y = p.cy + s * p.r;
    out.tx = p.sweep > 0 ? -s : s;
    out.ty = p.sweep > 0 ? c : -c;
    out.k = (p.sweep > 0 ? 1 : -1) / p.r;
  }
  return out;
}

export class TrackGeometry {
  constructor(def) {
    this.def = def;
    const { pieces, corners, errors } = buildPieces(def.points);
    this.errors = errors;
    this.corners = corners;
    const rawLen = pieces.reduce((a, p) => a + p.len, 0);

    // s (raw, from piece 0) of each vertex: the middle of its fillet
    const vertexS = new Array(def.points.length).fill(0);
    let acc = 0;
    for (const p of pieces) {
      if (p.type === 'arc' || p.type === 'mark') vertexS[p.vertex] = acc + p.len / 2;
      acc += p.len;
    }
    this.rawLength = rawLen;
    this.vertexS = vertexS;
    this.startRaw = this.u2sRaw(def.start ?? 0.3);

    const n = Math.max(64, Math.round(rawLen / SAMPLE));
    const ds = rawLen / n;
    this.n = n;
    this.ds = ds;
    this.length = rawLen;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.ty = new Float32Array(n);
    this.curv = new Float32Array(n);
    this.hw = new Float32Array(n);
    this.ro = new Float32Array(n);
    this.kind = new Uint8Array(n);

    const tmp = { x: 0, y: 0, tx: 1, ty: 0, k: 0 };
    let pi = 0;
    let pStart = 0;
    // walk the pieces from the start line, wrapping once
    const order = [];
    for (let k = 0; k < n; k++) order.push(wrapLen(this.startRaw + k * ds, rawLen));
    for (let k = 0; k < n; k++) {
      const sr = order[k];
      if (k === 0 || sr < order[k - 1]) {
        pi = 0;
        pStart = 0;
      }
      while (pi < pieces.length - 1 && pStart + pieces[pi].len <= sr) {
        pStart += pieces[pi].len;
        pi++;
      }
      samplePiece(pieces[pi], Math.min(sr - pStart, pieces[pi].len), tmp);
      this.x[k] = tmp.x;
      this.y[k] = tmp.y;
      this.tx[k] = tmp.tx;
      this.ty[k] = tmp.ty;
      this.curv[k] = tmp.k;
    }

    this.applySections(def);
    this.checkpointCount = Math.max(6, Math.round(this.length / CONFIG.race.checkpointSpacing));

    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const m = this.hw[k] + this.ro[k] + 60;
      x0 = Math.min(x0, this.x[k] - m);
      y0 = Math.min(y0, this.y[k] - m);
      x1 = Math.max(x1, this.x[k] + m);
      y1 = Math.max(y1, this.y[k] + m);
    }
    this.bounds = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  /* --------------------------------------------------------- positions */

  /** Raw (piece-order) distance of a u position. */
  u2sRaw(u) {
    const vs = this.vertexS;
    const m = vs.length;
    const i = ((Math.floor(u) % m) + m) % m;
    const f = u - Math.floor(u);
    const a = vs[i];
    let b = vs[(i + 1) % m];
    if (b <= a) b += this.rawLength;
    return wrapLen(a + (b - a) * f, this.rawLength);
  }

  /** Distance from the start line of a u position. */
  u2s(u) {
    return wrapLen(this.u2sRaw(u) - this.startRaw, this.length);
  }

  index(s) {
    return Math.floor(wrapLen(s, this.length) / this.ds) % this.n;
  }

  /** Interpolated centerline frame at distance s: writes x, y, tx, ty, nx, ny, hw, ro. */
  at(s, out) {
    const f = wrapLen(s, this.length) / this.ds;
    const i = Math.floor(f) % this.n;
    const j = (i + 1) % this.n;
    const t = f - Math.floor(f);
    out.x = this.x[i] + (this.x[j] - this.x[i]) * t;
    out.y = this.y[i] + (this.y[j] - this.y[i]) * t;
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * t;
    let ty = this.ty[i] + (this.ty[j] - this.ty[i]) * t;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    out.tx = tx;
    out.ty = ty;
    out.nx = -ty;
    out.ny = tx;
    out.hw = this.hw[i] + (this.hw[j] - this.hw[i]) * t;
    out.ro = this.ro[i] + (this.ro[j] - this.ro[i]) * t;
    out.i = i;
    return out;
  }

  /** World point at distance s and lateral offset lat. */
  point(s, lat, out) {
    this.at(s, out);
    out.x += out.nx * lat;
    out.y += out.ny * lat;
    return out;
  }

  /**
   * Nearest sample to (x, y). With a hint (the racer's previous index) it walks
   * downhill locally, which is cheap and never jumps to a neighboring section
   * of track; far from the hint it falls back to a full scan.
   */
  nearest(x, y, hint = -1) {
    const n = this.n;
    const X = this.x;
    const Y = this.y;
    if (hint >= 0) {
      let best = hint;
      let bestD = (X[hint] - x) ** 2 + (Y[hint] - y) ** 2;
      for (let pass = 0; pass < 8; pass++) {
        const center = best;
        for (let o = -LOCAL_WINDOW; o <= LOCAL_WINDOW; o++) {
          const k = (center + o + n) % n;
          const d = (X[k] - x) ** 2 + (Y[k] - y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        if (best === center) break;
      }
      const lim = this.hw[best] + this.ro[best] + 260;
      if (bestD < lim * lim) return best;
    }
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < n; k++) {
      const d = (X[k] - x) ** 2 + (Y[k] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  /** Track-relative coordinates of (x, y): writes i, s, lat, hw, ro, tx, ty. */
  project(x, y, hint, out) {
    const i = this.nearest(x, y, hint);
    const dx = x - this.x[i];
    const dy = y - this.y[i];
    const tx = this.tx[i];
    const ty = this.ty[i];
    out.i = i;
    out.s = wrapLen(i * this.ds + dx * tx + dy * ty, this.length);
    out.lat = -dx * ty + dy * tx;
    out.hw = this.hw[i];
    out.ro = this.ro[i];
    out.tx = tx;
    out.ty = ty;
    out.kind = this.kind[i];
    return out;
  }

  /** Checkpoint segment index for a distance along the lap. */
  segmentOf(s) {
    return Math.min(this.checkpointCount - 1, Math.floor((wrapLen(s, this.length) / this.length) * this.checkpointCount));
  }

  /* ---------------------------------------------------------- sections */

  /**
   * Sections override width and run-off over a u range and tag the samples
   * with a kind (bridge, tunnel, canyon …). Changes fade in over `fade` units
   * outside the range.
   */
  applySections(def) {
    const n = this.n;
    this.kinds = ['track'];
    this.hw.fill(def.halfWidth);
    this.ro.fill(def.runoff);
    this.sections = [];
    for (const sec of def.sections || []) {
      const s0 = this.u2s(sec.from);
      const s1 = this.u2s(sec.to);
      const span = wrapLen(s1 - s0, this.length);
      const fade = sec.fade ?? 220;
      let kindIdx = 0;
      if (sec.kind) {
        kindIdx = this.kinds.indexOf(sec.kind);
        if (kindIdx < 0) kindIdx = this.kinds.push(sec.kind) - 1;
      }
      this.sections.push({ ...sec, s0, s1, span });
      for (let k = 0; k < n; k++) {
        const s = k * this.ds;
        const into = wrapLen(s - s0, this.length);
        let w;
        if (into <= span) w = 1;
        else {
          const before = wrapLen(s0 - s, this.length);
          const after = into - span;
          const gap = Math.min(before, after);
          w = gap < fade ? 1 - smoothstep(gap / fade) : 0;
        }
        if (w <= 0) continue;
        if (sec.w != null) this.hw[k] += (sec.w - this.hw[k]) * w;
        if (sec.ro != null) this.ro[k] += (sec.ro - this.ro[k]) * w;
        if (kindIdx && into <= span) this.kind[k] = kindIdx;
      }
    }
  }

  /** True when distance s lies inside [s0, s0 + span) on the loop. */
  inRange(s, s0, span) {
    return wrapLen(s - s0, this.length) < span;
  }

  /* -------------------------------------------------------- validation */

  /**
   * Development check: fillet overlaps, corners too tight for the track width
   * and sections of track whose walls come too close to each other.
   */
  validate() {
    const issues = [...this.errors];
    const n = this.n;
    for (let k = 0; k < n; k++) {
      const k1 = Math.abs(this.curv[k]);
      if (k1 > 0 && 1 / k1 < this.hw[k] + 40) {
        issues.push(`sample ${k} (s=${Math.round(k * this.ds)}): radius ${Math.round(1 / k1)} too tight for half-width ${Math.round(this.hw[k])}`);
        k += Math.round(200 / this.ds);
      }
    }
    const stride = 3;
    let minGap = Infinity;
    let worst = null;
    for (let a = 0; a < n; a += stride) {
      const ra = this.hw[a] + this.ro[a];
      for (let b = a + stride; b < n; b += stride) {
        const rb = this.hw[b] + this.ro[b];
        const along = Math.abs(loopDelta(a * this.ds, b * this.ds, this.length));
        if (along < (ra + rb) * 2.2 + 300) continue;
        const gap = Math.hypot(this.x[a] - this.x[b], this.y[a] - this.y[b]) - ra - rb;
        if (gap < minGap) {
          minGap = gap;
          worst = [a, b];
        }
      }
    }
    if (minGap < 40) {
      issues.push(`walls too close: gap ${Math.round(minGap)} between s=${Math.round(worst[0] * this.ds)} and s=${Math.round(worst[1] * this.ds)}`);
    }
    return { issues, minGap, length: this.length };
  }
}

const cache = new Map();

/** Geometry is built once per track and shared (it is read-only). */
export function getGeometry(def) {
  let g = cache.get(def.id);
  if (!g) {
    g = new TrackGeometry(def);
    cache.set(def.id, g);
  }
  return g;
}
