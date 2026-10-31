// A bounding volume hierarchy over a SculptMesh's triangles.
//
// three's own raycaster tests every triangle, which is far too slow for a dense sculpt.
// This tree stays valid while the mesh changes: moved vertices refit only the leaves they
// touch, and triangles created by edge splits join the leaf of the triangle they came from.
// Crowded leaves split in place, so a full rebuild is only needed after undo or subdivide.

const LEAF_TARGET = 8;
const LEAF_LIMIT = 24;
const stack = new Int32Array(2048);

export class BVH {
  constructor(mesh) {
    this.mesh = mesh;
    this.build();
  }

  build() {
    const m = this.mesh;
    const n = m.tCount;
    const cap = Math.max(64, n * 2 + 32);
    this.nodeCap = cap;
    this.bounds = new Float32Array(cap * 6);
    this.a = new Int32Array(cap); // first child, or -1 on a leaf
    this.b = new Int32Array(cap); // second child, or the head of a leaf's triangle list
    this.parent = new Int32Array(cap);
    this.count = new Int32Array(cap);
    this.dirtyMark = new Uint8Array(cap);
    this.dirty = [];
    this.triLeaf = new Int32Array(m.tCap);
    this.triNext = new Int32Array(m.tCap);
    this.leaves = new Int32Array(1024);
    this.nodeCount = 1;

    const { pos, idx } = m;
    const cen = new Float32Array(n * 3);
    const order = new Int32Array(n);
    for (let t = 0; t < n; t++) {
      order[t] = t;
      const a = idx[t * 3] * 3;
      const b = idx[t * 3 + 1] * 3;
      const c = idx[t * 3 + 2] * 3;
      cen[t * 3] = (pos[a] + pos[b] + pos[c]) / 3;
      cen[t * 3 + 1] = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3;
      cen[t * 3 + 2] = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    }

    this.parent[0] = -1;
    const work = [0, 0, n];
    while (work.length) {
      const end = work.pop();
      const start = work.pop();
      const node = work.pop();
      if (end - start <= LEAF_TARGET) {
        this._makeLeaf(node, order, start, end);
        continue;
      }
      let mid = partition(order, cen, start, end);
      if (mid === start || mid === end) mid = (start + end) >> 1;
      const left = this.nodeCount++;
      const right = this.nodeCount++;
      this.a[node] = left;
      this.b[node] = right;
      this.parent[left] = node;
      this.parent[right] = node;
      work.push(left, start, mid, right, mid, end);
    }

    // Children always have larger ids than their parent, so one backward pass fills bounds.
    for (let node = this.nodeCount - 1; node >= 0; node--) {
      if (this.a[node] === -1) this._refitLeaf(node);
      else this._union(node);
    }
  }

  _makeLeaf(node, order, start, end) {
    this.a[node] = -1;
    this.count[node] = end - start;
    let head = -1;
    for (let i = end - 1; i >= start; i--) {
      const t = order[i];
      this.triNext[t] = head;
      this.triLeaf[t] = node;
      head = t;
    }
    this.b[node] = head;
  }

  _refitLeaf(node) {
    const { pos, idx } = this.mesh;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let t = this.b[node]; t !== -1; t = this.triNext[t]) {
      for (let k = 0; k < 3; k++) {
        const p = idx[t * 3 + k] * 3;
        const x = pos[p], y = pos[p + 1], z = pos[p + 2];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (z < z0) z0 = z;
        if (z > z1) z1 = z;
      }
    }
    const b = this.bounds;
    const o = node * 6;
    b[o] = x0; b[o + 1] = y0; b[o + 2] = z0;
    b[o + 3] = x1; b[o + 4] = y1; b[o + 5] = z1;
  }

  _union(node) {
    const b = this.bounds;
    const o = node * 6;
    const l = this.a[node] * 6;
    const r = this.b[node] * 6;
    for (let i = 0; i < 3; i++) {
      b[o + i] = Math.min(b[l + i], b[r + i]);
      b[o + 3 + i] = Math.max(b[l + 3 + i], b[r + 3 + i]);
    }
  }

  growTris(cap) {
    const leaf = new Int32Array(cap);
    leaf.set(this.triLeaf);
    this.triLeaf = leaf;
    const next = new Int32Array(cap);
    next.set(this.triNext);
    this.triNext = next;
  }

  _growNodes() {
    const cap = this.nodeCap * 2;
    const grow = (arr, size) => {
      const copy = new arr.constructor(size);
      copy.set(arr);
      return copy;
    };
    this.bounds = grow(this.bounds, cap * 6);
    this.a = grow(this.a, cap);
    this.b = grow(this.b, cap);
    this.parent = grow(this.parent, cap);
    this.count = grow(this.count, cap);
    this.dirtyMark = grow(this.dirtyMark, cap);
    this.nodeCap = cap;
  }

  /** Marks the triangle's leaf as needing new bounds. */
  touch(t) {
    const leaf = this.triLeaf[t];
    if (!this.dirtyMark[leaf]) {
      this.dirtyMark[leaf] = 1;
      this.dirty.push(leaf);
    }
  }

  /** Adds a new triangle to a leaf, normally the leaf of the triangle it split from. */
  addTri(t, leaf) {
    this.triLeaf[t] = leaf;
    this.triNext[t] = this.b[leaf];
    this.b[leaf] = t;
    this.count[leaf]++;
    this.touch(t);
  }

  /** Recomputes the bounds of every touched leaf and their ancestors. */
  refit() {
    const list = this.dirty;
    for (let i = 0; i < list.length; i++) {
      let node = list[i];
      this.dirtyMark[node] = 0;
      if (this.a[node] === -1 && this.count[node] > LEAF_LIMIT) this._splitLeaf(node);
      if (this.a[node] === -1) this._refitLeaf(node);
      else this._union(node);
      node = this.parent[node];
      while (node !== -1) {
        this._union(node);
        node = this.parent[node];
      }
    }
    list.length = 0;
  }

  _splitLeaf(node) {
    const { pos, idx } = this.mesh;
    const tris = [];
    let min = [Infinity, Infinity, Infinity];
    let max = [-Infinity, -Infinity, -Infinity];
    const centroid = (t, axis) =>
      (pos[idx[t * 3] * 3 + axis] + pos[idx[t * 3 + 1] * 3 + axis] + pos[idx[t * 3 + 2] * 3 + axis]) / 3;
    for (let t = this.b[node]; t !== -1; t = this.triNext[t]) {
      tris.push(t);
      for (let axis = 0; axis < 3; axis++) {
        const c = centroid(t, axis);
        if (c < min[axis]) min[axis] = c;
        if (c > max[axis]) max[axis] = c;
      }
    }
    const axis = widest(min, max);
    const split = (min[axis] + max[axis]) / 2;
    const low = [];
    const high = [];
    for (const t of tris) (centroid(t, axis) < split ? low : high).push(t);
    if (!low.length || !high.length) {
      // Identical centroids can't be separated. Halving by count keeps the leaf from growing.
      low.length = 0;
      high.length = 0;
      tris.forEach((t, i) => (i < tris.length >> 1 ? low : high).push(t));
    }
    while (this.nodeCount + 2 > this.nodeCap) this._growNodes();
    const left = this.nodeCount++;
    const right = this.nodeCount++;
    this.a[node] = left;
    this.b[node] = right;
    this.count[node] = 0;
    this.parent[left] = node;
    this.parent[right] = node;
    this._makeLeaf(left, low, 0, low.length);
    this._makeLeaf(right, high, 0, high.length);
    this._refitLeaf(left);
    this._refitLeaf(right);
  }

  /** Finds the nearest triangle along a ray. Fills `hit` and returns true on a hit. */
  raycast(ox, oy, oz, dx, dy, dz, hit) {
    const { pos, idx } = this.mesh;
    const { bounds, a, b, triNext } = this;
    // A zero direction would turn the slab test into NaN on boxes that touch the ray.
    const ix = 1 / (dx || 1e-12), iy = 1 / (dy || 1e-12), iz = 1 / (dz || 1e-12);
    let best = Infinity;
    let found = false;
    let sp = 0;
    stack[sp++] = 0;
    while (sp) {
      const node = stack[--sp];
      const o = node * 6;
      let t1 = (bounds[o] - ox) * ix, t2 = (bounds[o + 3] - ox) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (bounds[o + 1] - oy) * iy; t2 = (bounds[o + 4] - oy) * iy;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (bounds[o + 2] - oz) * iz; t2 = (bounds[o + 5] - oz) * iz;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (!(tmax >= Math.max(tmin, 0)) || tmin > best) continue;

      if (a[node] !== -1) {
        stack[sp++] = a[node];
        stack[sp++] = b[node];
        continue;
      }
      for (let tri = b[node]; tri !== -1; tri = triNext[tri]) {
        const i0 = idx[tri * 3] * 3, i1 = idx[tri * 3 + 1] * 3, i2 = idx[tri * 3 + 2] * 3;
        const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2];
        const e1x = pos[i1] - ax, e1y = pos[i1 + 1] - ay, e1z = pos[i1 + 2] - az;
        const e2x = pos[i2] - ax, e2y = pos[i2 + 1] - ay, e2z = pos[i2 + 2] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-12 && det < 1e-12) continue;
        const inv = 1 / det;
        const sx = ox - ax, sy = oy - ay, sz = oz - az;
        const u = (sx * px + sy * py + sz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-6 && t < best) {
          best = t;
          found = true;
          hit.t = t;
          hit.tri = tri;
          hit.u = u;
          hit.v = v;
        }
      }
    }
    return found;
  }

  /** Collects leaves whose bounds reach a sphere. Results are in this.leaves. */
  leavesInSphere(cx, cy, cz, r) {
    const { bounds, a, b } = this;
    const r2 = r * r;
    let n = 0;
    let sp = 0;
    stack[sp++] = 0;
    while (sp) {
      const node = stack[--sp];
      const o = node * 6;
      let d = 0;
      let e = Math.max(bounds[o] - cx, 0, cx - bounds[o + 3]);
      d += e * e;
      e = Math.max(bounds[o + 1] - cy, 0, cy - bounds[o + 4]);
      d += e * e;
      e = Math.max(bounds[o + 2] - cz, 0, cz - bounds[o + 5]);
      d += e * e;
      if (d > r2) continue;
      if (a[node] !== -1) {
        stack[sp++] = a[node];
        stack[sp++] = b[node];
        continue;
      }
      if (n === this.leaves.length) {
        const more = new Int32Array(n * 2);
        more.set(this.leaves);
        this.leaves = more;
      }
      this.leaves[n++] = node;
    }
    return n;
  }

  rootBounds() {
    return this.bounds.subarray(0, 6);
  }
}

function widest(min, max) {
  const dx = max[0] - min[0];
  const dy = max[1] - min[1];
  const dz = max[2] - min[2];
  return dx >= dy && dx >= dz ? 0 : dy >= dz ? 1 : 2;
}

function partition(order, cen, start, end) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = start; i < end; i++) {
    const t = order[i] * 3;
    for (let k = 0; k < 3; k++) {
      const c = cen[t + k];
      if (c < min[k]) min[k] = c;
      if (c > max[k]) max[k] = c;
    }
  }
  const axis = widest(min, max);
  const split = (min[axis] + max[axis]) / 2;
  let lo = start;
  let hi = end - 1;
  while (lo <= hi) {
    if (cen[order[lo] * 3 + axis] < split) {
      lo++;
    } else {
      const swap = order[lo];
      order[lo] = order[hi];
      order[hi] = swap;
      hi--;
    }
  }
  return lo;
}
