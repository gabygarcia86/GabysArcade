/*
 * A small 2D rigid-body physics engine, written for this game so it needs no library.
 *
 *  - Shapes: circles and convex polygons.
 *  - Collisions: separating-axis tests with clipped two-point contacts, so boxes stack flat.
 *  - Solver: sequential impulses with warm starting and Coulomb friction. Overlap is fixed
 *    with "split impulses" (a separate pseudo-velocity pass) so pushing things apart never
 *    adds real speed, which keeps stacks calm instead of jittery.
 *  - Sleeping: still bodies stop being simulated until something moving touches them, the
 *    thing under them disappears, or they lose all contact.
 *  - Ropes: one-sided distance joints (Christmas light strings) that can snap.
 *
 * Units are world pixels and seconds. y points down, so a positive angle turns clockwise.
 */
(function (G) {
  "use strict";

  const MARGIN = 1; // contacts are kept while surfaces are this close (px), which stops chatter
  const SLOP = 0.5; // overlap allowed before position correction starts (px)
  const BAUMGARTE = 0.22; // fraction of the overlap fixed each step
  const MAX_CORRECTION = 500; // fastest the position fix may push (px/s)
  const BOUNCE_MIN = 160; // impacts slower than this don't bounce (px/s)
  const SLEEP_LIN = 9; // px/s
  const SLEEP_ANG = 0.09; // rad/s
  const SLEEP_TIME = 0.55; // seconds of stillness before sleeping
  const WAKE_SPEED = 14; // a sleeping body wakes when something faster touches it

  let nextId = 1;

  // ---------------------------------------------------------------- Shapes

  // Returns { verts, area, inertia (per unit density), offX, offY } with verts recentred on
  // the centroid and wound so outward normals are (ey, -ex).
  function polygonInfo(points) {
    let pts = points.map((p) => ({ x: p[0], y: p[1] }));
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const cr = a.x * b.y - b.x * a.y;
      area += cr;
      cx += (a.x + b.x) * cr;
      cy += (a.y + b.y) * cr;
    }
    area *= 0.5;
    if (area < 0) {
      pts.reverse();
      area = -area;
      cx = -cx;
      cy = -cy;
    }
    cx /= 6 * area;
    cy /= 6 * area;
    pts = pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
    // Inertia about the centroid, per unit density.
    let num = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const cr = Math.abs(a.x * b.y - b.x * a.y);
      num += cr * (a.x * a.x + a.x * b.x + b.x * b.x + a.y * a.y + a.y * b.y + b.y * b.y);
    }
    return { verts: pts, area, inertia: num / 12, offX: cx, offY: cy };
  }

  G.Shapes = {
    box: (w, h) => [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ],
    // A regular polygon, flat side down when n is even.
    ngon: (n, r, rot = 0) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        out.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return out;
    },
  };

  // ---------------------------------------------------------------- Body

  class Body {
    constructor(o) {
      this.id = nextId++;
      this.x = o.x || 0;
      this.y = o.y || 0;
      this.a = o.angle || 0;
      this.vx = o.vx || 0;
      this.vy = o.vy || 0;
      this.w = o.w || 0;
      this.pvx = 0;
      this.pvy = 0;
      this.pw = 0;
      this.fr = o.friction == null ? 0.6 : o.friction;
      this.re = o.restitution == null ? 0.1 : o.restitution;
      this.linDamp = o.linearDamping == null ? 0.02 : o.linearDamping;
      this.angDamp = o.angularDamping == null ? 0.1 : o.angularDamping;
      this.isStatic = !!o.isStatic;
      this.sleeping = !!o.sleeping && !this.isStatic;
      this.sleepT = 0;
      this.group = o.group || 0; // bodies sharing a non-zero group never collide
      this.noCollide = !!o.noCollide;
      this.gravityScale = o.gravityScale == null ? 1 : o.gravityScale;
      this.owner = o.owner || null;
      this.contacts = 0;
      this.removed = false;

      const density = o.density == null ? 0.001 : o.density;
      if (o.radius) {
        this.type = "circle";
        this.r = o.radius;
        this.area = Math.PI * this.r * this.r;
        this.mass = density * this.area;
        this.inertia = 0.5 * this.mass * this.r * this.r;
        this.bound = this.r;
      } else {
        this.type = "poly";
        const info = polygonInfo(o.verts);
        // Shift the body so its centroid stays where the caller's local origin implied.
        const c = Math.cos(this.a);
        const s = Math.sin(this.a);
        this.x += c * info.offX - s * info.offY;
        this.y += s * info.offX + c * info.offY;
        this.offX = info.offX;
        this.offY = info.offY;
        const n = info.verts.length;
        this.n = n;
        this.lx = new Float64Array(n);
        this.ly = new Float64Array(n);
        this.lnx = new Float64Array(n);
        this.lny = new Float64Array(n);
        this.wx = new Float64Array(n);
        this.wy = new Float64Array(n);
        this.wnx = new Float64Array(n);
        this.wny = new Float64Array(n);
        let bound = 0;
        for (let i = 0; i < n; i++) {
          this.lx[i] = info.verts[i].x;
          this.ly[i] = info.verts[i].y;
          bound = Math.max(bound, Math.hypot(this.lx[i], this.ly[i]));
        }
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ex = this.lx[j] - this.lx[i];
          const ey = this.ly[j] - this.ly[i];
          const len = Math.hypot(ex, ey) || 1;
          this.lnx[i] = ey / len;
          this.lny[i] = -ex / len;
        }
        this.bound = bound;
        this.area = info.area;
        this.mass = density * info.area;
        this.inertia = density * info.inertia;
        // Local y of the lowest point, used to sit a body exactly on a surface.
        this.bottom = Math.max(...this.ly);
        this.top = Math.min(...this.ly);
      }
      if (o.radius) {
        this.bottom = this.r;
        this.top = -this.r;
      }
      if (this.isStatic) {
        this.im = 0;
        this.ii = 0;
      } else {
        this.im = 1 / this.mass;
        this.ii = o.fixedRotation ? 0 : 1 / this.inertia;
      }
      this.updateGeometry();
    }

    updateGeometry() {
      if (this.type === "circle") {
        this.minX = this.x - this.r;
        this.maxX = this.x + this.r;
        this.minY = this.y - this.r;
        this.maxY = this.y + this.r;
        return;
      }
      const c = Math.cos(this.a);
      const s = Math.sin(this.a);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < this.n; i++) {
        const x = this.x + c * this.lx[i] - s * this.ly[i];
        const y = this.y + s * this.lx[i] + c * this.ly[i];
        this.wx[i] = x;
        this.wy[i] = y;
        this.wnx[i] = c * this.lnx[i] - s * this.lny[i];
        this.wny[i] = s * this.lnx[i] + c * this.lny[i];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      this.minX = minX;
      this.maxX = maxX;
      this.minY = minY;
      this.maxY = maxY;
    }

    get speed() {
      return Math.hypot(this.vx, this.vy) + Math.abs(this.w) * this.bound;
    }

    wake() {
      if (this.isStatic) return;
      this.sleeping = false;
      this.sleepT = 0;
    }

    sleep() {
      this.sleeping = true;
      this.vx = 0;
      this.vy = 0;
      this.w = 0;
    }

    applyImpulse(ix, iy, px, py) {
      if (this.isStatic) return;
      this.wake();
      this.vx += ix * this.im;
      this.vy += iy * this.im;
      if (px != null) this.w += ((px - this.x) * iy - (py - this.y) * ix) * this.ii;
    }

    // World position of a point given in body-local coordinates.
    toWorld(lx, ly) {
      const c = Math.cos(this.a);
      const s = Math.sin(this.a);
      return { x: this.x + c * lx - s * ly, y: this.y + s * lx + c * ly };
    }

    toLocal(wx, wy) {
      const c = Math.cos(this.a);
      const s = Math.sin(this.a);
      const dx = wx - this.x;
      const dy = wy - this.y;
      return { x: c * dx + s * dy, y: -s * dx + c * dy };
    }

    containsPoint(px, py) {
      if (this.type === "circle") return (px - this.x) ** 2 + (py - this.y) ** 2 <= this.r * this.r;
      for (let i = 0; i < this.n; i++) {
        if ((px - this.wx[i]) * this.wnx[i] + (py - this.wy[i]) * this.wny[i] > 0) return false;
      }
      return true;
    }
  }

  // ---------------------------------------------------------------- Narrow phase
  // Each test fills `out` with a normal pointing from body a to body b and up to two points
  // ({x, y, depth, id}) and returns true when the shapes touch (within MARGIN).

  function circleCircle(a, b, out) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d2 = dx * dx + dy * dy;
    const rr = a.r + b.r + MARGIN;
    if (d2 > rr * rr) return false;
    const d = Math.sqrt(d2);
    let nx = 1;
    let ny = 0;
    if (d > 1e-9) {
      nx = dx / d;
      ny = dy / d;
    }
    out.nx = nx;
    out.ny = ny;
    const depth = a.r + b.r - d;
    const px = a.x + nx * (a.r - depth / 2);
    const py = a.y + ny * (a.r - depth / 2);
    out.count = 1;
    setPoint(out, 0, px, py, depth, 1);
    return true;
  }

  // Polygon p against circle c; the normal points from p to c.
  function polyCircle(p, c, out) {
    let best = -Infinity;
    let face = 0;
    for (let i = 0; i < p.n; i++) {
      const s = (c.x - p.wx[i]) * p.wnx[i] + (c.y - p.wy[i]) * p.wny[i];
      if (s > c.r + MARGIN) return false;
      if (s > best) {
        best = s;
        face = i;
      }
    }
    const i2 = (face + 1) % p.n;
    const v1x = p.wx[face];
    const v1y = p.wy[face];
    const v2x = p.wx[i2];
    const v2y = p.wy[i2];
    let nx;
    let ny;
    let depth;
    if (best < 1e-6) {
      nx = p.wnx[face];
      ny = p.wny[face];
      depth = c.r - best;
    } else {
      const u1 = (c.x - v1x) * (v2x - v1x) + (c.y - v1y) * (v2y - v1y);
      const u2 = (c.x - v2x) * (v1x - v2x) + (c.y - v2y) * (v1y - v2y);
      if (u1 <= 0 || u2 <= 0) {
        const vx = u1 <= 0 ? v1x : v2x;
        const vy = u1 <= 0 ? v1y : v2y;
        const dx = c.x - vx;
        const dy = c.y - vy;
        const d = Math.hypot(dx, dy);
        if (d > c.r + MARGIN) return false;
        nx = d > 1e-9 ? dx / d : p.wnx[face];
        ny = d > 1e-9 ? dy / d : p.wny[face];
        depth = c.r - d;
      } else {
        nx = p.wnx[face];
        ny = p.wny[face];
        depth = c.r - best;
      }
    }
    out.nx = nx;
    out.ny = ny;
    out.count = 1;
    setPoint(out, 0, c.x - nx * (c.r - depth / 2), c.y - ny * (c.r - depth / 2), depth, 2);
    return true;
  }

  // Largest gap between polygon a's faces and polygon b (negative means overlap).
  function maxSeparation(a, b, res) {
    let best = -Infinity;
    let face = 0;
    for (let i = 0; i < a.n; i++) {
      const nx = a.wnx[i];
      const ny = a.wny[i];
      const vx = a.wx[i];
      const vy = a.wy[i];
      let min = Infinity;
      for (let j = 0; j < b.n; j++) {
        const s = (b.wx[j] - vx) * nx + (b.wy[j] - vy) * ny;
        if (s < min) min = s;
      }
      if (min > best) {
        best = min;
        face = i;
        if (best > MARGIN) break;
      }
    }
    res.sep = best;
    res.face = face;
  }

  const sepA = { sep: 0, face: 0 };
  const sepB = { sep: 0, face: 0 };

  function polyPoly(a, b, out) {
    maxSeparation(a, b, sepA);
    if (sepA.sep > MARGIN) return false;
    maxSeparation(b, a, sepB);
    if (sepB.sep > MARGIN) return false;

    let ref = a;
    let inc = b;
    let face = sepA.face;
    let flip = false;
    if (sepB.sep > sepA.sep + 0.1) {
      ref = b;
      inc = a;
      face = sepB.face;
      flip = true;
    }
    const nx = ref.wnx[face];
    const ny = ref.wny[face];
    // Incident edge: the face on the other polygon most opposed to the reference normal.
    let incFace = 0;
    let minDot = Infinity;
    for (let i = 0; i < inc.n; i++) {
      const d = inc.wnx[i] * nx + inc.wny[i] * ny;
      if (d < minDot) {
        minDot = d;
        incFace = i;
      }
    }
    const i2 = (incFace + 1) % inc.n;
    let p1x = inc.wx[incFace];
    let p1y = inc.wy[incFace];
    let p2x = inc.wx[i2];
    let p2y = inc.wy[i2];
    const f2 = (face + 1) % ref.n;
    const r1x = ref.wx[face];
    const r1y = ref.wy[face];
    const r2x = ref.wx[f2];
    const r2y = ref.wy[f2];
    let tx = r2x - r1x;
    let ty = r2y - r1y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    // Clip the incident edge to the sides of the reference face.
    const lo = r1x * tx + r1y * ty;
    const hi = r2x * tx + r2y * ty;
    let d1 = p1x * tx + p1y * ty;
    let d2 = p2x * tx + p2y * ty;
    if (d1 < lo && d2 < lo) return false;
    if (d1 > hi && d2 > hi) return false;
    if (d1 < lo) {
      const k = (lo - d1) / (d2 - d1);
      p1x += (p2x - p1x) * k;
      p1y += (p2y - p1y) * k;
      d1 = lo;
    } else if (d2 < lo) {
      const k = (lo - d2) / (d1 - d2);
      p2x += (p1x - p2x) * k;
      p2y += (p1y - p2y) * k;
      d2 = lo;
    }
    if (d1 > hi) {
      const k = (d1 - hi) / (d1 - d2);
      p1x += (p2x - p1x) * k;
      p1y += (p2y - p1y) * k;
    } else if (d2 > hi) {
      const k = (d2 - hi) / (d2 - d1);
      p2x += (p1x - p2x) * k;
      p2y += (p1y - p2y) * k;
    }
    out.nx = flip ? -nx : nx;
    out.ny = flip ? -ny : ny;
    out.count = 0;
    const base = (flip ? 1000 : 0) + face * 40 + incFace;
    const s1 = (p1x - r1x) * nx + (p1y - r1y) * ny;
    const s2 = (p2x - r1x) * nx + (p2y - r1y) * ny;
    if (s1 <= MARGIN) setPoint(out, out.count++, p1x - (nx * s1) / 2, p1y - (ny * s1) / 2, -s1, base * 2 + 10);
    if (s2 <= MARGIN) setPoint(out, out.count++, p2x - (nx * s2) / 2, p2y - (ny * s2) / 2, -s2, base * 2 + 11);
    return out.count > 0;
  }

  function setPoint(out, i, x, y, depth, id) {
    const p = out.pts[i];
    p.x = x;
    p.y = y;
    p.depth = depth;
    p.id = id;
  }

  const scratch = { nx: 0, ny: 0, count: 0, pts: [{}, {}] };

  function collide(a, b, out) {
    if (a.type === "circle") {
      if (b.type === "circle") return circleCircle(a, b, out);
      if (!polyCircle(b, a, out)) return false;
      out.nx = -out.nx;
      out.ny = -out.ny;
      return true;
    }
    if (b.type === "circle") return polyCircle(a, b, out);
    return polyPoly(a, b, out);
  }

  // ---------------------------------------------------------------- Contact manifold

  class Manifold {
    constructor(a, b) {
      this.a = a;
      this.b = b;
      this.nx = 0;
      this.ny = 0;
      this.points = [];
      this.stamp = 0;
      this.isNew = true;
      this.approach = 0; // fastest closing speed found this step
      this.impulse = 0; // estimated impact impulse this step
    }
  }

  function makePoint() {
    return { x: 0, y: 0, depth: 0, id: 0, rax: 0, ray: 0, rbx: 0, rby: 0, pn: 0, pt: 0, pp: 0, mn: 0, mt: 0, bounce: 0, bias: 0, spec: 0 };
  }

  // ---------------------------------------------------------------- Rope joint

  class Rope {
    constructor(o) {
      this.id = nextId++;
      this.a = o.a; // body, or null for a fixed point
      this.b = o.b;
      this.lax = o.lax || 0; // local anchor on a (or world point if a is null)
      this.lay = o.lay || 0;
      this.lbx = o.lbx || 0;
      this.lby = o.lby || 0;
      this.len = o.len;
      this.breakImpulse = o.breakImpulse || Infinity;
      this.acc = 0;
      this.accP = 0;
      this.broken = false;
      this.owner = o.owner || null;
      this.pull = o.pull || 0; // shortens the rope over time (tangles)
      this.minLen = o.minLen || 0;
    }

    anchorA() {
      return this.a ? this.a.toWorld(this.lax, this.lay) : { x: this.lax, y: this.lay };
    }

    anchorB() {
      return this.b ? this.b.toWorld(this.lbx, this.lby) : { x: this.lbx, y: this.lby };
    }
  }

  // ---------------------------------------------------------------- World

  class World {
    constructor(opts = {}) {
      this.gravity = opts.gravity == null ? 1300 : opts.gravity;
      this.bodies = [];
      this.ropes = [];
      this.manifolds = new Map();
      this.stamp = 0;
      this.iterations = opts.iterations || 10;
      this.posIterations = opts.posIterations || 4;
      this.onImpact = null; // (manifold) => void, called for new or hard contacts
      this.onRopeBreak = null;
      this.list = [];
    }

    add(body) {
      this.bodies.push(body);
      return body;
    }

    addRope(rope) {
      this.ropes.push(rope);
      if (rope.a) rope.a.wake();
      if (rope.b) rope.b.wake();
      return rope;
    }

    remove(body) {
      if (body.removed) return;
      body.removed = true;
      const i = this.bodies.indexOf(body);
      if (i >= 0) this.bodies.splice(i, 1);
      // Wake whatever was touching it, so nothing is left floating.
      for (const [key, m] of this.manifolds) {
        if (m.a === body || m.b === body) {
          (m.a === body ? m.b : m.a).wake();
          this.manifolds.delete(key);
        }
      }
      for (const rope of this.ropes) {
        if (rope.a === body || rope.b === body) {
          rope.broken = true;
          if (rope.a) rope.a.wake();
          if (rope.b) rope.b.wake();
        }
      }
      this.ropes = this.ropes.filter((r) => !r.broken);
    }

    clear() {
      this.bodies = [];
      this.ropes = [];
      this.manifolds.clear();
    }

    wakeAround(x, y, radius) {
      for (const b of this.bodies) {
        if (!b.isStatic && Math.hypot(b.x - x, b.y - y) < radius + b.bound) b.wake();
      }
    }

    // A push away from (x, y), strongest at the centre. Returns the bodies it moved.
    explode(x, y, radius, power) {
      const hit = [];
      for (const b of this.bodies) {
        if (b.isStatic || b.noCollide) continue;
        const dx = b.x - x;
        const dy = b.y - y;
        const d = Math.hypot(dx, dy);
        if (d > radius + b.bound) continue;
        const k = 1 - Math.min(1, Math.max(0, d - b.bound * 0.5) / radius);
        const nx = d > 1 ? dx / d : 0;
        const ny = d > 1 ? dy / d : -1;
        const dv = power * k;
        // Same speed change for light and heavy things alike, slightly tamed for heavy ones.
        const scale = Math.min(1, 6 / Math.sqrt(b.mass));
        b.wake();
        b.vx += nx * dv * scale;
        b.vy += (ny * dv - dv * 0.25) * scale;
        b.w += (Math.random() - 0.5) * 8 * k * scale;
        hit.push({ body: b, dv: dv * scale });
      }
      return hit;
    }

    step(dt) {
      this.stamp++;
      const bodies = this.bodies;
      const g = this.gravity;

      // 1. Forces.
      for (const b of bodies) {
        b.contacts = 0;
        if (b.isStatic || b.sleeping) continue;
        b.vy += g * b.gravityScale * dt;
        const ld = 1 / (1 + dt * b.linDamp);
        const ad = 1 / (1 + dt * b.angDamp);
        b.vx *= ld;
        b.vy *= ld;
        b.w *= ad;
      }

      // 2. Collision detection (sort and sweep on x).
      const list = this.list;
      list.length = 0;
      for (const b of bodies) {
        if (!b.noCollide) {
          b.updateGeometry();
          list.push(b);
        }
      }
      list.sort((p, q) => p.minX - q.minX);
      const active = [];
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          if (b.minX > a.maxX + MARGIN) break;
          if (b.minY > a.maxY + MARGIN || b.maxY < a.minY - MARGIN) continue;
          const aIdle = a.isStatic || a.sleeping;
          const bIdle = b.isStatic || b.sleeping;
          if (a.isStatic && b.isStatic) continue;
          if (a.group && a.group === b.group) continue;
          // Always test in id order, so the same pair picks the same reference face every
          // step (otherwise the saved impulses would be thrown away and stacks would wobble).
          // Sleeping pairs are still tested (cheaply), only to know what is resting on what.
          const lo = a.id < b.id ? a : b;
          const hi = lo === a ? b : a;
          if (!collide(lo, hi, scratch)) continue;
          a.contacts++;
          b.contacts++;
          if (aIdle && bIdle) continue;
          // A moving body wakes a sleeping one it touches.
          if (a.sleeping && !bIdle && (b.speed > WAKE_SPEED || maxDepth(scratch) > 2)) a.wake();
          if (b.sleeping && !aIdle && (a.speed > WAKE_SPEED || maxDepth(scratch) > 2)) b.wake();
          const key = lo.id * 1048576 + hi.id;
          let m = this.manifolds.get(key);
          if (!m) {
            m = new Manifold(lo, hi);
            this.manifolds.set(key, m);
          } else {
            m.isNew = m.stamp !== this.stamp - 1;
          }
          m.stamp = this.stamp;
          updateManifold(m, scratch);
          active.push(m);
        }
      }
      for (const [key, m] of this.manifolds) if (m.stamp !== this.stamp) this.manifolds.delete(key);

      // A sleeping body touching nothing at all (and not hanging on a rope) has lost its support.
      for (const r of this.ropes) {
        if (r.broken) continue;
        if (r.a) r.a.contacts++;
        if (r.b) r.b.contacts++;
      }
      for (const b of bodies) if (b.sleeping && b.contacts === 0 && !b.noCollide) b.wake();

      // 3. Prepare contacts and warm start.
      const inv = 1 / dt;
      for (const m of active) prepare(m, dt, inv);
      const ropes = this.ropes;
      for (const r of ropes) prepareRope(r, inv);

      // 4. Velocity iterations.
      for (let it = 0; it < this.iterations; it++) {
        for (const r of ropes) solveRope(r);
        for (const m of active) solveVelocity(m);
      }
      // 5. Position (pseudo velocity) iterations.
      for (let it = 0; it < this.posIterations; it++) {
        for (const r of ropes) solveRopePosition(r);
        for (const m of active) solvePosition(m);
      }

      // 6. Report impacts.
      if (this.onImpact) {
        for (const m of active) if (m.impulse > 0) this.onImpact(m);
      }

      // 7. Integrate positions and handle sleep.
      for (const b of bodies) {
        if (b.isStatic || b.sleeping) {
          b.pvx = b.pvy = b.pw = 0;
          continue;
        }
        b.x += (b.vx + b.pvx) * dt;
        b.y += (b.vy + b.pvy) * dt;
        b.a += (b.w + b.pw) * dt;
        b.pvx = b.pvy = b.pw = 0;
        const lin = b.vx * b.vx + b.vy * b.vy;
        if (lin < SLEEP_LIN * SLEEP_LIN && Math.abs(b.w) < SLEEP_ANG && b.contacts > 0 && !b.noSleep) {
          b.sleepT += dt;
          if (b.sleepT > SLEEP_TIME) b.sleep();
        } else {
          b.sleepT = 0;
        }
      }

      // 8. Ropes that were pulled too hard snap.
      if (ropes.length) {
        let broke = false;
        for (const r of ropes) {
          if (!r.broken && Math.abs(r.acc) > r.breakImpulse) {
            r.broken = true;
            broke = true;
            if (r.a) r.a.wake();
            if (r.b) r.b.wake();
            if (this.onRopeBreak) this.onRopeBreak(r);
          }
          if (r.pull && r.len > r.minLen) r.len = Math.max(r.minLen, r.len - r.pull * dt);
        }
        if (broke) this.ropes = ropes.filter((r) => !r.broken);
      }
    }

    // Bodies whose shape contains the point.
    pointQuery(x, y) {
      const out = [];
      for (const b of this.bodies) {
        if (b.noCollide) continue;
        b.updateGeometry();
        if (b.containsPoint(x, y)) out.push(b);
      }
      return out;
    }

    // Does a circle at (x, y) overlap any body?
    circleFree(x, y, r, ignore) {
      const probe = new Body({ x, y, radius: r, isStatic: true });
      for (const b of this.bodies) {
        if (b === ignore || b.noCollide) continue;
        b.updateGeometry();
        if (collide(probe, b, scratch) && maxDepth(scratch) > 0) return false;
      }
      return true;
    }

    // Any awake, moving, non-ignored body?
    isCalm(threshold = 25) {
      for (const b of this.bodies) {
        if (b.isStatic || b.sleeping || b.noCollide || b.ignoreCalm) continue;
        if (b.speed > threshold) return false;
      }
      return true;
    }
  }

  function maxDepth(s) {
    let d = -Infinity;
    for (let i = 0; i < s.count; i++) d = Math.max(d, s.pts[i].depth);
    return d;
  }

  // Copies fresh contact points into the manifold, keeping accumulated impulses for points
  // that persist (matched by feature id), which is what makes stacks stable.
  function updateManifold(m, s) {
    m.nx = s.nx;
    m.ny = s.ny;
    const old = m.points;
    const fresh = [];
    for (let i = 0; i < s.count; i++) {
      const src = s.pts[i];
      let p = null;
      for (let k = 0; k < old.length; k++) {
        if (old[k] && old[k].id === src.id) {
          p = old[k];
          old[k] = null;
          break;
        }
      }
      if (!p) p = makePoint();
      p.x = src.x;
      p.y = src.y;
      p.depth = src.depth;
      p.id = src.id;
      fresh.push(p);
    }
    m.points = fresh;
  }

  function invMasses(m) {
    const a = m.a;
    const b = m.b;
    const idleA = a.isStatic || a.sleeping;
    const idleB = b.isStatic || b.sleeping;
    return [idleA ? 0 : a.im, idleA ? 0 : a.ii, idleB ? 0 : b.im, idleB ? 0 : b.ii];
  }

  function prepare(m, dt, inv) {
    const a = m.a;
    const b = m.b;
    const [ima, iia, imb, iib] = invMasses(m);
    m.ima = ima;
    m.iia = iia;
    m.imb = imb;
    m.iib = iib;
    const nx = m.nx;
    const ny = m.ny;
    const tx = -ny;
    const ty = nx;
    m.fr = Math.sqrt(a.fr * b.fr);
    const e = Math.max(a.re, b.re);
    m.approach = 0;
    m.impulse = 0;
    for (const p of m.points) {
      p.rax = p.x - a.x;
      p.ray = p.y - a.y;
      p.rbx = p.x - b.x;
      p.rby = p.y - b.y;
      const rna = p.rax * ny - p.ray * nx;
      const rnb = p.rbx * ny - p.rby * nx;
      const kn = ima + imb + iia * rna * rna + iib * rnb * rnb;
      p.mn = kn > 0 ? 1 / kn : 0;
      const rta = p.rax * ty - p.ray * tx;
      const rtb = p.rbx * ty - p.rby * tx;
      const kt = ima + imb + iia * rta * rta + iib * rtb * rtb;
      p.mt = kt > 0 ? 1 / kt : 0;
      const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
      const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
      const vn = dvx * nx + dvy * ny;
      p.bounce = 0;
      p.spec = 0;
      if (p.depth < 0) {
        // A speculative contact: allow closing the gap, no more.
        p.spec = p.depth * inv;
      } else if (vn < -BOUNCE_MIN) {
        p.bounce = -e * vn;
      }
      if (-vn > m.approach) m.approach = -vn;
      p.bias = Math.min(MAX_CORRECTION, (BAUMGARTE * inv) * Math.max(0, p.depth - SLOP));
      p.pp = 0;
      // Warm start (a contact that is brand new has nothing to carry over).
      if (m.isNew) {
        p.pn = 0;
        p.pt = 0;
      } else {
        p.pn *= 0.98;
        p.pt *= 0.98;
        const px = nx * p.pn + tx * p.pt;
        const py = ny * p.pn + ty * p.pt;
        a.vx -= px * ima;
        a.vy -= py * ima;
        a.w -= (p.rax * py - p.ray * px) * iia;
        b.vx += px * imb;
        b.vy += py * imb;
        b.w += (p.rbx * py - p.rby * px) * iib;
      }
    }
    // A rough impact impulse (the bodies' combined mass times the closing speed). The game
    // turns it into a speed change for each body to decide how much damage it takes.
    m.impulse = m.approach > 60 && ima + imb > 0 ? (m.approach * (1 + e)) / (ima + imb) : 0;
    m.e = e;

    // Two-point contacts are solved together (a "block" solve), which is what stops tall
    // stacks from slowly rocking themselves over.
    m.block = false;
    if (m.points.length === 2) {
      const p1 = m.points[0];
      const p2 = m.points[1];
      const rn1a = p1.rax * ny - p1.ray * nx;
      const rn1b = p1.rbx * ny - p1.rby * nx;
      const rn2a = p2.rax * ny - p2.ray * nx;
      const rn2b = p2.rbx * ny - p2.rby * nx;
      const k11 = ima + imb + iia * rn1a * rn1a + iib * rn1b * rn1b;
      const k22 = ima + imb + iia * rn2a * rn2a + iib * rn2b * rn2b;
      const k12 = ima + imb + iia * rn1a * rn2a + iib * rn1b * rn2b;
      const det = k11 * k22 - k12 * k12;
      if (k11 * k11 < 1000 * det) {
        m.block = true;
        m.k11 = k11;
        m.k12 = k12;
        m.k22 = k22;
        m.i11 = k22 / det;
        m.i12 = -k12 / det;
        m.i22 = k11 / det;
      } else {
        // The two points are nearly the same; keep the deeper one.
        m.points.length = 1;
        if (p2.depth > p1.depth) m.points[0] = p2;
      }
    }
  }

  function applyNormal(m, p, lam) {
    const a = m.a;
    const b = m.b;
    const px = m.nx * lam;
    const py = m.ny * lam;
    a.vx -= px * m.ima;
    a.vy -= py * m.ima;
    a.w -= (p.rax * py - p.ray * px) * m.iia;
    b.vx += px * m.imb;
    b.vy += py * m.imb;
    b.w += (p.rbx * py - p.rby * px) * m.iib;
  }

  function normalVel(m, p) {
    const a = m.a;
    const b = m.b;
    const dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
    const dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
    return dvx * m.nx + dvy * m.ny;
  }

  // Box2D's block solver: finds impulses for both points at once that leave neither point
  // approaching, trying each combination of active points in turn.
  function solveBlock(m) {
    const p1 = m.points[0];
    const p2 = m.points[1];
    const a1 = p1.pn;
    const a2 = p2.pn;
    const t1 = p1.depth < 0 ? p1.spec : p1.bounce;
    const t2 = p2.depth < 0 ? p2.spec : p2.bounce;
    let b1 = normalVel(m, p1) - t1 - (m.k11 * a1 + m.k12 * a2);
    let b2 = normalVel(m, p2) - t2 - (m.k12 * a1 + m.k22 * a2);
    let x1 = -(m.i11 * b1 + m.i12 * b2);
    let x2 = -(m.i12 * b1 + m.i22 * b2);
    if (!(x1 >= 0 && x2 >= 0)) {
      x1 = -b1 / m.k11;
      x2 = 0;
      const vn2 = m.k12 * x1 + b2;
      if (!(x1 >= 0 && vn2 >= 0)) {
        x1 = 0;
        x2 = -b2 / m.k22;
        const vn1 = m.k12 * x2 + b1;
        if (!(x2 >= 0 && vn1 >= 0)) {
          x1 = 0;
          x2 = 0;
          if (!(b1 >= 0 && b2 >= 0)) return; // no valid solution; leave as is this pass
        }
      }
    }
    applyNormal(m, p1, x1 - a1);
    applyNormal(m, p2, x2 - a2);
    p1.pn = x1;
    p2.pn = x2;
  }

  function solveVelocity(m) {
    const a = m.a;
    const b = m.b;
    const { ima, iia, imb, iib } = m;
    const nx = m.nx;
    const ny = m.ny;
    const tx = -ny;
    const ty = nx;
    for (const p of m.points) {
      // Friction.
      let dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
      let dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
      const vt = dvx * tx + dvy * ty;
      let lam = -vt * p.mt;
      const maxF = m.fr * p.pn;
      const newT = Math.max(-maxF, Math.min(maxF, p.pt + lam));
      lam = newT - p.pt;
      p.pt = newT;
      let px = tx * lam;
      let py = ty * lam;
      a.vx -= px * ima;
      a.vy -= py * ima;
      a.w -= (p.rax * py - p.ray * px) * iia;
      b.vx += px * imb;
      b.vy += py * imb;
      b.w += (p.rbx * py - p.rby * px) * iib;
      if (m.block) continue;
      // Normal.
      dvx = b.vx - b.w * p.rby - a.vx + a.w * p.ray;
      dvy = b.vy + b.w * p.rbx - a.vy - a.w * p.rax;
      const vn = dvx * nx + dvy * ny;
      const target = p.depth < 0 ? p.spec : p.bounce;
      lam = (target - vn) * p.mn;
      const newN = Math.max(0, p.pn + lam);
      lam = newN - p.pn;
      p.pn = newN;
      px = nx * lam;
      py = ny * lam;
      a.vx -= px * ima;
      a.vy -= py * ima;
      a.w -= (p.rax * py - p.ray * px) * iia;
      b.vx += px * imb;
      b.vy += py * imb;
      b.w += (p.rbx * py - p.rby * px) * iib;
    }
    if (m.block) solveBlock(m);
  }

  function solvePosition(m) {
    const a = m.a;
    const b = m.b;
    const { ima, iia, imb, iib } = m;
    const nx = m.nx;
    const ny = m.ny;
    for (const p of m.points) {
      if (p.bias <= 0) continue;
      const dvx = b.pvx - b.pw * p.rby - a.pvx + a.pw * p.ray;
      const dvy = b.pvy + b.pw * p.rbx - a.pvy - a.pw * p.rax;
      const vn = dvx * nx + dvy * ny;
      let lam = (p.bias - vn) * p.mn;
      const newP = Math.max(0, p.pp + lam);
      lam = newP - p.pp;
      p.pp = newP;
      const px = nx * lam;
      const py = ny * lam;
      a.pvx -= px * ima;
      a.pvy -= py * ima;
      a.pw -= (p.rax * py - p.ray * px) * iia;
      b.pvx += px * imb;
      b.pvy += py * imb;
      b.pw += (p.rbx * py - p.rby * px) * iib;
    }
  }

  // ---------------------------------------------------------------- Rope solver

  function ropeIdle(body) {
    return !body || body.isStatic || body.sleeping;
  }

  function prepareRope(r, inv) {
    const pa = r.anchorA();
    const pb = r.anchorB();
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len = Math.hypot(dx, dy);
    r.active = len > r.len - 0.5 && len > 1e-6;
    r.acc = 0;
    r.accP = 0;
    if (!r.active) return;
    // A taut rope tugging on a sleeping body wakes it.
    if (r.a && r.a.sleeping && !ropeIdle(r.b) && r.b.speed > WAKE_SPEED) r.a.wake();
    if (r.b && r.b.sleeping && !ropeIdle(r.a) && r.a.speed > WAKE_SPEED) r.b.wake();
    r.nx = dx / len;
    r.ny = dy / len;
    r.rax = r.a ? pa.x - r.a.x : 0;
    r.ray = r.a ? pa.y - r.a.y : 0;
    r.rbx = r.b ? pb.x - r.b.x : 0;
    r.rby = r.b ? pb.y - r.b.y : 0;
    r.ima = ropeIdle(r.a) ? 0 : r.a.im;
    r.iia = ropeIdle(r.a) ? 0 : r.a.ii;
    r.imb = ropeIdle(r.b) ? 0 : r.b.im;
    r.iib = ropeIdle(r.b) ? 0 : r.b.ii;
    const rna = r.rax * r.ny - r.ray * r.nx;
    const rnb = r.rbx * r.ny - r.rby * r.nx;
    const k = r.ima + r.imb + r.iia * rna * rna + r.iib * rnb * rnb;
    r.m = k > 0 ? 1 / k : 0;
    r.bias = Math.min(MAX_CORRECTION * 0.6, BAUMGARTE * inv * Math.max(0, len - r.len - 0.5));
  }

  function ropeVel(r, pseudo) {
    const a = r.a;
    const b = r.b;
    let vax = 0;
    let vay = 0;
    let vbx = 0;
    let vby = 0;
    if (a) {
      const vx = pseudo ? a.pvx : a.vx;
      const vy = pseudo ? a.pvy : a.vy;
      const w = pseudo ? a.pw : a.w;
      vax = vx - w * r.ray;
      vay = vy + w * r.rax;
    }
    if (b) {
      const vx = pseudo ? b.pvx : b.vx;
      const vy = pseudo ? b.pvy : b.vy;
      const w = pseudo ? b.pw : b.w;
      vbx = vx - w * r.rby;
      vby = vy + w * r.rbx;
    }
    return (vbx - vax) * r.nx + (vby - vay) * r.ny;
  }

  function applyRope(r, lam, pseudo) {
    const px = r.nx * lam;
    const py = r.ny * lam;
    const a = r.a;
    const b = r.b;
    if (a && r.ima) {
      if (pseudo) {
        a.pvx -= px * r.ima;
        a.pvy -= py * r.ima;
        a.pw -= (r.rax * py - r.ray * px) * r.iia;
      } else {
        a.vx -= px * r.ima;
        a.vy -= py * r.ima;
        a.w -= (r.rax * py - r.ray * px) * r.iia;
      }
    }
    if (b && r.imb) {
      if (pseudo) {
        b.pvx += px * r.imb;
        b.pvy += py * r.imb;
        b.pw += (r.rbx * py - r.rby * px) * r.iib;
      } else {
        b.vx += px * r.imb;
        b.vy += py * r.imb;
        b.w += (r.rbx * py - r.rby * px) * r.iib;
      }
    }
  }

  function solveRope(r) {
    if (!r.active || !r.m) return;
    const vn = ropeVel(r, false);
    let lam = -vn * r.m;
    const next = Math.min(0, r.acc + lam);
    lam = next - r.acc;
    r.acc = next;
    applyRope(r, lam, false);
  }

  function solveRopePosition(r) {
    if (!r.active || !r.m || r.bias <= 0) return;
    const vn = ropeVel(r, true);
    let lam = (-r.bias - vn) * r.m;
    const next = Math.min(0, r.accP + lam);
    lam = next - r.accP;
    r.accP = next;
    applyRope(r, lam, true);
  }

  G.Physics = { Body, World, Rope, MARGIN };
})(typeof window !== "undefined" ? window.GS : (globalThis.GS = globalThis.GS || {}));
