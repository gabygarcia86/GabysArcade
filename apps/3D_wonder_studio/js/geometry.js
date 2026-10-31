// SculptMesh is the editable surface behind every object, plus the shape generators.
//
// Render vertices may be duplicated along texture seams (a sphere's UV edge, a cube's faces).
// `canon` maps each one to a single representative, so sculpting treats the surface as one
// welded skin: adjacency and normals are shared and seam copies always move together. That
// is what keeps gaps from opening at a seam.
//
// Corners (triangle * 3 + k) are threaded into a linked list per representative vertex,
// which gives constant-time topology updates when an edge splits mid-stroke.
import * as THREE from "three";
import { BVH } from "./bvh.js";

const CHUNK = 256;

export class SculptMesh {
  constructor({ positions, uvs, indices, canon = null }) {
    this.vCount = positions.length / 3;
    this.tCount = indices.length / 3;
    this.maxTris = 400000;
    this._alloc(Math.ceil(this.vCount * 1.2) + 64, Math.ceil(this.tCount * 1.2) + 64);
    this.pos.set(positions);
    this.uv.set(uvs);
    this.idx.set(indices);
    if (canon) this.canon.set(canon);
    else this._weld();
    this._dropDegenerate();
    this.geometry = new THREE.BufferGeometry();
    this._bindAttributes();
    this._rebuildTopology();
    this.computeNormals();
    this.bvh = new BVH(this);
  }

  _alloc(vCap, tCap) {
    this.vCap = vCap;
    this.tCap = tCap;
    this.pos = new Float32Array(vCap * 3);
    this.nor = new Float32Array(vCap * 3);
    this.uv = new Float32Array(vCap * 2);
    this.canon = new Int32Array(vCap);
    this.dupNext = new Int32Array(vCap);
    this.head = new Int32Array(vCap);
    this.idx = new Uint32Array(tCap * 3);
    this.next = new Int32Array(tCap * 3);
    this._allocScratch();
  }

  _allocScratch() {
    const n = this.vCap;
    this.queryMark = new Uint32Array(n);
    this.queryId = 0;
    this.qList = new Int32Array(n);
    this.qDist = new Float32Array(n);
    this.accMark = new Uint32Array(n);
    this.accId = 0;
    this.acc = new Float32Array(n * 4);
    this.accList = new Int32Array(n);
    this.accN = 0;
    this.ringMark = new Uint32Array(n);
    this.ringId = 0;
    this.ring = new Int32Array(n);
    this.dirtyV = new Uint8Array(Math.ceil(n / CHUNK) + 1);
    this.dirtyT = new Uint8Array(Math.ceil(this.tCap / CHUNK) + 1);
    this.uvDirtyFrom = -1;
  }

  _bindAttributes() {
    const make = (array, size) => {
      const attr = new THREE.BufferAttribute(array, size);
      attr.setUsage(THREE.DynamicDrawUsage);
      return attr;
    };
    const g = this.geometry;
    g.setAttribute("position", make(this.pos, 3));
    g.setAttribute("normal", make(this.nor, 3));
    g.setAttribute("uv", make(this.uv, 2));
    g.setIndex(make(this.idx, 1));
    g.setDrawRange(0, this.tCount * 3);
  }

  _ensure(vNeed, tNeed) {
    if (vNeed <= this.vCap && tNeed <= this.tCap) return;
    const vCap = Math.ceil(Math.max(vNeed, this.vCap * 1.5));
    const tCap = Math.ceil(Math.max(tNeed, this.tCap * 1.5));
    const old = {
      pos: this.pos, nor: this.nor, uv: this.uv, canon: this.canon,
      dupNext: this.dupNext, head: this.head, idx: this.idx, next: this.next,
    };
    this._alloc(vCap, tCap);
    for (const key of Object.keys(old)) this[key].set(old[key]);
    this.geometry.dispose();
    this._bindAttributes();
    this.bvh.growTris(tCap);
  }

  /** Finds render vertices that sit at exactly the same place. */
  _weld() {
    const { pos, canon } = this;
    const n = this.vCount;
    let size = 1024;
    while (size < n * 2) size *= 2;
    const mask = size - 1;
    const table = new Int32Array(size).fill(-1);
    for (let v = 0; v < n; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      const qx = Math.round(x * 4096), qy = Math.round(y * 4096), qz = Math.round(z * 4096);
      let h = (Math.imul(qx, 73856093) ^ Math.imul(qy, 19349663) ^ Math.imul(qz, 83492791)) & mask;
      for (;;) {
        const other = table[h];
        if (other === -1) {
          table[h] = v;
          canon[v] = v;
          break;
        }
        if (pos[other * 3] === x && pos[other * 3 + 1] === y && pos[other * 3 + 2] === z) {
          canon[v] = other;
          break;
        }
        h = (h + 1) & mask;
      }
    }
  }

  _dropDegenerate() {
    const { idx, canon } = this;
    let out = 0;
    for (let t = 0; t < this.tCount; t++) {
      const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2];
      const ca = canon[a], cb = canon[b], cc = canon[c];
      if (ca === cb || cb === cc || ca === cc) continue;
      idx[out * 3] = a;
      idx[out * 3 + 1] = b;
      idx[out * 3 + 2] = c;
      out++;
    }
    this.tCount = out;
  }

  _rebuildTopology() {
    const { canon, dupNext, head, next, idx } = this;
    head.fill(-1, 0, this.vCount);
    for (let v = 0; v < this.vCount; v++) dupNext[v] = v;
    for (let v = 0; v < this.vCount; v++) {
      const c = canon[v];
      if (c !== v) {
        dupNext[v] = dupNext[c];
        dupNext[c] = v;
      }
    }
    for (let corner = 0; corner < this.tCount * 3; corner++) {
      const c = canon[idx[corner]];
      next[corner] = head[c];
      head[c] = corner;
    }
  }

  computeNormals() {
    const { pos, nor, idx, canon } = this;
    nor.fill(0, 0, this.vCount * 3);
    for (let t = 0; t < this.tCount; t++) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (let k = 0; k < 3; k++) {
        const o = canon[idx[t * 3 + k]] * 3;
        nor[o] += nx;
        nor[o + 1] += ny;
        nor[o + 2] += nz;
      }
    }
    for (let v = 0; v < this.vCount; v++) {
      const c = canon[v];
      if (c === v) {
        const o = v * 3;
        const len = Math.hypot(nor[o], nor[o + 1], nor[o + 2]) || 1;
        nor[o] /= len;
        nor[o + 1] /= len;
        nor[o + 2] /= len;
      }
    }
    for (let v = 0; v < this.vCount; v++) {
      const c = canon[v];
      if (c !== v) {
        nor[v * 3] = nor[c * 3];
        nor[v * 3 + 1] = nor[c * 3 + 1];
        nor[v * 3 + 2] = nor[c * 3 + 2];
      }
    }
  }

  /** Finds welded vertices within a sphere. Fills qList and qDist (0 at center, 1 at edge). */
  queryVerts(x, y, z, r) {
    const { pos, idx, canon, qList, qDist, queryMark } = this;
    const bvh = this.bvh;
    const triNext = bvh.triNext;
    const id = ++this.queryId;
    const r2 = r * r;
    const leaves = bvh.leavesInSphere(x, y, z, r);
    let n = 0;
    for (let i = 0; i < leaves; i++) {
      for (let t = bvh.b[bvh.leaves[i]]; t !== -1; t = triNext[t]) {
        for (let k = 0; k < 3; k++) {
          const c = canon[idx[t * 3 + k]];
          if (queryMark[c] === id) continue;
          queryMark[c] = id;
          const dx = pos[c * 3] - x, dy = pos[c * 3 + 1] - y, dz = pos[c * 3 + 2] - z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < r2) {
            qList[n] = c;
            qDist[n] = Math.sqrt(d2) / r;
            n++;
          }
        }
      }
    }
    return n;
  }

  /** Lists triangles in leaves near a sphere into `out`, an ordinary array. */
  queryTris(x, y, z, r, out) {
    const bvh = this.bvh;
    const leaves = bvh.leavesInSphere(x, y, z, r);
    out.length = 0;
    for (let i = 0; i < leaves; i++) {
      for (let t = bvh.b[bvh.leaves[i]]; t !== -1; t = bvh.triNext[t]) out.push(t);
    }
    return out;
  }

  accBegin() {
    this.accId++;
    this.accN = 0;
  }

  /** Adds one brush's displacement for a vertex. Weights blend overlapping mirrored brushes. */
  accAdd(v, dx, dy, dz, w) {
    const { acc } = this;
    const o = v * 4;
    if (this.accMark[v] !== this.accId) {
      this.accMark[v] = this.accId;
      this.accList[this.accN++] = v;
      acc[o] = acc[o + 1] = acc[o + 2] = acc[o + 3] = 0;
    }
    acc[o] += dx * w;
    acc[o + 1] += dy * w;
    acc[o + 2] += dz * w;
    acc[o + 3] += w;
  }

  accApply() {
    const { acc, accList, pos, dupNext } = this;
    for (let i = 0; i < this.accN; i++) {
      const v = accList[i];
      const o = v * 4;
      const w = acc[o + 3];
      if (w <= 0) continue;
      const x = (pos[v * 3] += acc[o] / w);
      const y = (pos[v * 3 + 1] += acc[o + 1] / w);
      const z = (pos[v * 3 + 2] += acc[o + 2] / w);
      this.dirtyV[v / CHUNK | 0] = 1;
      for (let d = dupNext[v]; d !== v; d = dupNext[d]) {
        pos[d * 3] = x;
        pos[d * 3 + 1] = y;
        pos[d * 3 + 2] = z;
        this.dirtyV[d / CHUNK | 0] = 1;
      }
    }
    this.updateAround(accList, this.accN);
  }

  /** Refreshes normals and tree bounds for welded vertices and their neighbours. */
  updateAround(list, count) {
    const { pos, nor, idx, canon, head, next, ring, ringMark, dupNext, bvh } = this;
    const id = ++this.ringId;
    let m = 0;
    for (let i = 0; i < count; i++) {
      for (let c = head[list[i]]; c !== -1; c = next[c]) {
        const t = c / 3 | 0;
        bvh.touch(t);
        for (let k = 0; k < 3; k++) {
          const u = canon[idx[t * 3 + k]];
          if (ringMark[u] !== id) {
            ringMark[u] = id;
            ring[m++] = u;
          }
        }
      }
    }
    for (let i = 0; i < m; i++) {
      const u = ring[i];
      let nx = 0, ny = 0, nz = 0;
      for (let c = head[u]; c !== -1; c = next[c]) {
        const t = c / 3 | 0;
        const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, d = idx[t * 3 + 2] * 3;
        const ex = pos[b] - pos[a], ey = pos[b + 1] - pos[a + 1], ez = pos[b + 2] - pos[a + 2];
        const fx = pos[d] - pos[a], fy = pos[d + 1] - pos[a + 1], fz = pos[d + 2] - pos[a + 2];
        nx += ey * fz - ez * fy;
        ny += ez * fx - ex * fz;
        nz += ex * fy - ey * fx;
      }
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      let d = u;
      do {
        nor[d * 3] = nx;
        nor[d * 3 + 1] = ny;
        nor[d * 3 + 2] = nz;
        this.dirtyV[d / CHUNK | 0] = 1;
        d = dupNext[d];
      } while (d !== u);
    }
    bvh.refit();
  }

  /** Averages a welded vertex's neighbours into `out`. Returns the neighbour count. */
  neighbourAverage(v, out) {
    const { pos, idx, canon, head, next } = this;
    let x = 0, y = 0, z = 0, n = 0;
    for (let c = head[v]; c !== -1; c = next[c]) {
      const t = c / 3 | 0;
      for (let k = 0; k < 3; k++) {
        const u = canon[idx[t * 3 + k]];
        if (u === v) continue;
        x += pos[u * 3];
        y += pos[u * 3 + 1];
        z += pos[u * 3 + 2];
        n++;
      }
    }
    if (n) {
      out[0] = x / n;
      out[1] = y / n;
      out[2] = z / n;
    }
    return n;
  }

  /** Bisects over-long edges near a sphere so fine details have geometry to live on. */
  splitEdgesIn(x, y, z, r, maxEdge, budget) {
    if (this.tCount >= this.maxTris) return 0;
    const queue = this.queryTris(x, y, z, r * 1.1, this._splitQueue ??= []);
    const reach = (r + maxEdge) * (r + maxEdge);
    const limit = maxEdge * maxEdge;
    const created = (this._created ??= []);
    created.length = 0;
    let done = 0;
    for (let i = 0; i < queue.length && done < budget; i++) {
      const t = queue[i];
      const { pos, idx } = this;
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      const cx = (pos[a] + pos[b] + pos[c]) / 3 - x;
      const cy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - y;
      const cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - z;
      if (cx * cx + cy * cy + cz * cz > reach) continue;
      const ab = dist2(pos, a, b), bc = dist2(pos, b, c), ca = dist2(pos, c, a);
      const longest = Math.max(ab, bc, ca);
      if (longest <= limit) continue;
      const edge = longest === ab ? 0 : longest === bc ? 1 : 2;
      const before = this.tCount;
      created.push(this._splitEdge(t, edge));
      done++;
      queue.push(t);
      for (let n = before; n < this.tCount; n++) queue.push(n);
      if (this.tCount >= this.maxTris) break;
    }
    if (created.length) {
      this.updateAround(created, created.length);
      this.geometry.setDrawRange(0, this.tCount * 3);
    }
    return done;
  }

  /** Splits the edge starting at corner `edge` of triangle `t`, in every triangle sharing it. */
  _splitEdge(t, edge) {
    const { idx, canon, head, next } = this;
    const ca = canon[idx[t * 3 + edge]];
    const cb = canon[idx[t * 3 + (edge + 1) % 3]];
    const around = [];
    for (let c = head[ca]; c !== -1; c = next[c]) {
      const T = c / 3 | 0;
      const k = c - T * 3;
      if (canon[idx[T * 3 + (k + 1) % 3]] === cb) around.push(T, k);
      else if (canon[idx[T * 3 + (k + 2) % 3]] === cb) around.push(T, (k + 2) % 3);
    }
    this._ensure(this.vCount + around.length, this.tCount + around.length);

    const mids = [];
    let primary = -1;
    for (let i = 0; i < around.length; i += 2) {
      const T = around[i];
      const k = around[i + 1];
      const p = this.idx[T * 3 + k];
      const q = this.idx[T * 3 + (k + 1) % 3];
      const z = this.idx[T * 3 + (k + 2) % 3];
      let m = -1;
      for (let j = 0; j < mids.length; j += 3) {
        if ((mids[j] === p && mids[j + 1] === q) || (mids[j] === q && mids[j + 1] === p)) m = mids[j + 2];
      }
      if (m === -1) {
        m = this._midVertex(p, q, primary);
        if (primary === -1) primary = m;
        mids.push(p, q, m);
      }
      this._setCorner(T * 3 + (k + 1) % 3, m);
      const added = this.tCount++;
      this.idx[added * 3] = m;
      this.idx[added * 3 + 1] = q;
      this.idx[added * 3 + 2] = z;
      for (let n = 0; n < 3; n++) this._linkCorner(added * 3 + n);
      this.bvh.addTri(added, this.bvh.triLeaf[T]);
      this.bvh.touch(T);
      this.dirtyT[T / CHUNK | 0] = 1;
      this.dirtyT[added / CHUNK | 0] = 1;
    }
    return primary;
  }

  _midVertex(p, q, primary) {
    const { pos, nor, uv, canon, dupNext, head } = this;
    const m = this.vCount++;
    for (let i = 0; i < 3; i++) {
      pos[m * 3 + i] = (pos[p * 3 + i] + pos[q * 3 + i]) / 2;
      nor[m * 3 + i] = (nor[p * 3 + i] + nor[q * 3 + i]) / 2;
    }
    uv[m * 2] = (uv[p * 2] + uv[q * 2]) / 2;
    uv[m * 2 + 1] = (uv[p * 2 + 1] + uv[q * 2 + 1]) / 2;
    head[m] = -1;
    if (primary === -1) {
      canon[m] = m;
      dupNext[m] = m;
    } else {
      canon[m] = primary;
      dupNext[m] = dupNext[primary];
      dupNext[primary] = m;
    }
    this.dirtyV[m / CHUNK | 0] = 1;
    if (this.uvDirtyFrom === -1 || m < this.uvDirtyFrom) this.uvDirtyFrom = m;
    return m;
  }

  _linkCorner(corner) {
    const c = this.canon[this.idx[corner]];
    this.next[corner] = this.head[c];
    this.head[c] = corner;
  }

  _setCorner(corner, v) {
    const { idx, canon, head, next } = this;
    const old = canon[idx[corner]];
    if (head[old] === corner) {
      head[old] = next[corner];
    } else {
      let c = head[old];
      while (next[c] !== corner) c = next[c];
      next[c] = next[corner];
    }
    idx[corner] = v;
    this._linkCorner(corner);
  }

  /** Sends changed ranges to the GPU. Call once a frame after editing. */
  flush() {
    const flushRanges = (attrs, marks) => {
      for (const { attr } of attrs) attr.clearUpdateRanges();
      let start = -1;
      let any = false;
      for (let i = 0; i <= marks.length; i++) {
        if (i < marks.length && marks[i]) {
          if (start === -1) start = i;
          marks[i] = 0;
        } else if (start !== -1) {
          any = true;
          for (const { attr, size } of attrs) {
            const from = start * CHUNK * size;
            attr.addUpdateRange(from, Math.min((i - start) * CHUNK * size, attr.array.length - from));
          }
          start = -1;
        }
      }
      if (any) for (const { attr } of attrs) attr.needsUpdate = true;
    };
    const g = this.geometry;
    flushRanges(
      [{ attr: g.attributes.position, size: 3 }, { attr: g.attributes.normal, size: 3 }],
      this.dirtyV,
    );
    flushRanges([{ attr: g.index, size: 3 }], this.dirtyT);
    if (this.uvDirtyFrom !== -1) {
      const attr = g.attributes.uv;
      attr.clearUpdateRanges();
      attr.addUpdateRange(this.uvDirtyFrom * 2, (this.vCount - this.uvDirtyFrom) * 2);
      attr.needsUpdate = true;
      this.uvDirtyFrom = -1;
    }
  }

  _uploadAll() {
    const g = this.geometry;
    for (const attr of [g.attributes.position, g.attributes.normal, g.attributes.uv, g.index]) {
      attr.clearUpdateRanges();
      attr.needsUpdate = true;
    }
    g.setDrawRange(0, this.tCount * 3);
    this.dirtyV.fill(0);
    this.dirtyT.fill(0);
    this.uvDirtyFrom = -1;
  }

  /** Remembers the current surface so endEdit can produce a compact undo record. */
  beginEdit() {
    const posLen = this.vCount * 3;
    const idxLen = this.tCount * 3;
    if (!this.shadowPos || this.shadowPos.length < posLen) this.shadowPos = new Float32Array(posLen);
    if (!this.shadowIdx || this.shadowIdx.length < idxLen) this.shadowIdx = new Uint32Array(idxLen);
    this.shadowPos.set(this.pos.subarray(0, posLen));
    this.shadowIdx.set(this.idx.subarray(0, idxLen));
    this.shadowV = this.vCount;
    this.shadowT = this.tCount;
  }

  /** Compares against beginEdit and returns the change, or null if nothing moved. */
  endEdit() {
    const { pos, idx, shadowPos, shadowIdx, shadowV: v0, shadowT: t0 } = this;
    const moved = [];
    for (let v = 0; v < v0; v++) {
      const o = v * 3;
      if (pos[o] !== shadowPos[o] || pos[o + 1] !== shadowPos[o + 1] || pos[o + 2] !== shadowPos[o + 2]) moved.push(v);
    }
    const rewired = [];
    for (let t = 0; t < t0; t++) {
      const o = t * 3;
      if (idx[o] !== shadowIdx[o] || idx[o + 1] !== shadowIdx[o + 1] || idx[o + 2] !== shadowIdx[o + 2]) rewired.push(t);
    }
    const v1 = this.vCount;
    const t1 = this.tCount;
    if (!moved.length && !rewired.length && v1 === v0 && t1 === t0) return null;

    const pick = (ids, stride, source, Type) => {
      const out = new Type(ids.length * stride);
      ids.forEach((id, i) => {
        for (let k = 0; k < stride; k++) out[i * stride + k] = source[id * stride + k];
      });
      return out;
    };
    const delta = {
      v0, v1, t0, t1,
      moved: Int32Array.from(moved),
      posOld: pick(moved, 3, shadowPos, Float32Array),
      posNew: pick(moved, 3, pos, Float32Array),
      rewired: Int32Array.from(rewired),
      triOld: pick(rewired, 3, shadowIdx, Uint32Array),
      triNew: pick(rewired, 3, idx, Uint32Array),
      tailPos: pos.slice(v0 * 3, v1 * 3),
      tailUv: this.uv.slice(v0 * 2, v1 * 2),
      tailCanon: this.canon.slice(v0, v1),
      tailIdx: idx.slice(t0 * 3, t1 * 3),
    };
    delta.bytes = delta.moved.byteLength * 7 + delta.rewired.byteLength * 7 + delta.tailPos.byteLength + delta.tailUv.byteLength + delta.tailCanon.byteLength + delta.tailIdx.byteLength;
    return delta;
  }

  /** Replays a delta from endEdit. `forward` is true for redo, false for undo. */
  applyDelta(d, forward) {
    const topology = d.v0 !== d.v1 || d.t0 !== d.t1 || d.rewired.length > 0;
    if (forward) this._ensure(d.v1, d.t1);
    const values = forward ? d.posNew : d.posOld;
    const { pos, idx } = this;
    d.moved.forEach((v, i) => {
      pos[v * 3] = values[i * 3];
      pos[v * 3 + 1] = values[i * 3 + 1];
      pos[v * 3 + 2] = values[i * 3 + 2];
      this.dirtyV[v / CHUNK | 0] = 1;
    });
    if (!topology) {
      const list = this._editList ??= [];
      list.length = 0;
      d.moved.forEach((v) => { if (this.canon[v] === v) list.push(v); });
      this.updateAround(list, list.length);
      this.flush();
      return;
    }
    const tris = forward ? d.triNew : d.triOld;
    d.rewired.forEach((t, i) => {
      idx[t * 3] = tris[i * 3];
      idx[t * 3 + 1] = tris[i * 3 + 1];
      idx[t * 3 + 2] = tris[i * 3 + 2];
    });
    if (forward) {
      pos.set(d.tailPos, d.v0 * 3);
      this.uv.set(d.tailUv, d.v0 * 2);
      this.canon.set(d.tailCanon, d.v0);
      idx.set(d.tailIdx, d.t0 * 3);
    }
    this.vCount = forward ? d.v1 : d.v0;
    this.tCount = forward ? d.t1 : d.t0;
    this.rebuild();
  }

  rebuild() {
    this._rebuildTopology();
    this.computeNormals();
    this.bvh.build();
    this._uploadAll();
  }

  /** Splits every triangle into four, for more sculpting detail everywhere. */
  subdivide() {
    const T = this.tCount;
    const oldIdx = this.idx.slice(0, T * 3);
    this._ensure(this.vCount + T * 3, T * 4);
    const { pos, uv, canon, idx } = this;
    const renderMids = new Map();
    const weldedMids = new Map();
    const span = this.vCap;
    const mid = (p, q) => {
      const key = Math.min(p, q) * span + Math.max(p, q);
      let m = renderMids.get(key);
      if (m !== undefined) return m;
      m = this.vCount++;
      renderMids.set(key, m);
      pos[m * 3] = (pos[p * 3] + pos[q * 3]) / 2;
      pos[m * 3 + 1] = (pos[p * 3 + 1] + pos[q * 3 + 1]) / 2;
      pos[m * 3 + 2] = (pos[p * 3 + 2] + pos[q * 3 + 2]) / 2;
      uv[m * 2] = (uv[p * 2] + uv[q * 2]) / 2;
      uv[m * 2 + 1] = (uv[p * 2 + 1] + uv[q * 2 + 1]) / 2;
      const cp = canon[p], cq = canon[q];
      const weldKey = Math.min(cp, cq) * span + Math.max(cp, cq);
      const shared = weldedMids.get(weldKey);
      if (shared === undefined) {
        weldedMids.set(weldKey, m);
        canon[m] = m;
      } else {
        canon[m] = shared;
      }
      return m;
    };
    let out = 0;
    const tri = (a, b, c) => {
      idx[out++] = a;
      idx[out++] = b;
      idx[out++] = c;
    };
    for (let t = 0; t < T; t++) {
      const a = oldIdx[t * 3], b = oldIdx[t * 3 + 1], c = oldIdx[t * 3 + 2];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      tri(a, ab, ca);
      tri(ab, b, bc);
      tri(ca, bc, c);
      tri(ab, bc, ca);
    }
    this.tCount = T * 4;
    this.rebuild();
  }

  /** Relaxes the whole surface. Used by the Smooth All button and high quality export. */
  smoothAll(strength = 0.5, passes = 1) {
    const out = [0, 0, 0];
    const { pos, canon, dupNext } = this;
    for (let pass = 0; pass < passes; pass++) {
      const next = new Float32Array(this.vCount * 3);
      for (let v = 0; v < this.vCount; v++) {
        if (canon[v] !== v) continue;
        const moved = this.neighbourAverage(v, out) > 0;
        for (let k = 0; k < 3; k++) {
          next[v * 3 + k] = moved ? pos[v * 3 + k] + (out[k] - pos[v * 3 + k]) * strength : pos[v * 3 + k];
        }
      }
      for (let v = 0; v < this.vCount; v++) {
        if (canon[v] !== v) continue;
        let d = v;
        do {
          pos[d * 3] = next[v * 3];
          pos[d * 3 + 1] = next[v * 3 + 1];
          pos[d * 3 + 2] = next[v * 3 + 2];
          d = dupNext[d];
        } while (d !== v);
      }
    }
    this.rebuild();
  }

  /** Returns tightly sized copies of the arrays that define the surface. */
  serialize() {
    return {
      positions: this.pos.slice(0, this.vCount * 3),
      uvs: this.uv.slice(0, this.vCount * 2),
      indices: this.idx.slice(0, this.tCount * 3),
      canon: this.canon.slice(0, this.vCount),
    };
  }

  clone() {
    const copy = new SculptMesh(this.serialize());
    copy.maxTris = this.maxTris;
    return copy;
  }

  /** A plain geometry with no spare capacity, for exporters. */
  toExportGeometry() {
    const data = this.serialize();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(this.nor.slice(0, this.vCount * 3), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(data.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return g;
  }

  dispose() {
    this.geometry.dispose();
  }
}

function dist2(pos, a, b) {
  const x = pos[a] - pos[b], y = pos[a + 1] - pos[b + 1], z = pos[a + 2] - pos[b + 2];
  return x * x + y * y + z * z;
}

// ---- Shape builders --------------------------------------------------------------------
// Every shape is made of grids, each with its own rectangle of the texture, so paint never
// lands in two places. Positions at shared edges come from the same lookup values, so
// _weld() can match them exactly.

class Builder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.idx = [];
  }

  /** Adds an nu by nv grid. `at(i, j)` returns a position; `rect` is its texture area. */
  grid(nu, nv, at, rect) {
    const base = this.pos.length / 3;
    const [u0, v0, u1, v1] = rect;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const p = at(i, j);
        this.pos.push(p[0] + 0, p[1] + 0, p[2] + 0);
        this.uv.push(u0 + (u1 - u0) * (i / nu), v0 + (v1 - v0) * (j / nv));
      }
    }
    const row = nu + 1;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = base + j * row + i;
        this.idx.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
      }
    }
  }

  finish() {
    return {
      positions: Float32Array.from(this.pos),
      uvs: Float32Array.from(this.uv),
      indices: Uint32Array.from(this.idx),
    };
  }
}

const FULL = [0.004, 0.004, 0.996, 0.996];

/** Builds a closed box surface, then moves each point through `shape`. */
function cubeShape(tris, shape) {
  const n = Math.max(2, Math.round(Math.sqrt(tris / 12)));
  const lat = [];
  for (let i = 0; i <= n; i++) lat.push(-1 + 2 * i / n);
  const b = new Builder();
  // Each face picks lattice coordinates so that its i axis crossed with its j axis points out.
  const faces = [
    (i, j) => [n, i, j],
    (i, j) => [0, i, n - j],
    (i, j) => [j, n, i],
    (i, j) => [i, 0, j],
    (i, j) => [i, j, n],
    (i, j) => [j, i, 0],
  ];
  const pad = 0.012;
  faces.forEach((face, f) => {
    const cx = f % 3;
    const cy = f < 3 ? 0 : 1;
    const rect = [cx / 3 + pad, cy / 2 + pad, (cx + 1) / 3 - pad, (cy + 1) / 2 - pad];
    b.grid(n, n, (i, j) => {
      const c = face(i, j);
      return shape(lat[c[0]], lat[c[1]], lat[c[2]]);
    }, rect);
  });
  return b.finish();
}

function ball(x, y, z) {
  const xx = x * x, yy = y * y, zz = z * z;
  return [
    x * Math.sqrt(1 - yy / 2 - zz / 2 + yy * zz / 3),
    y * Math.sqrt(1 - zz / 2 - xx / 2 + zz * xx / 3),
    z * Math.sqrt(1 - xx / 2 - yy / 2 + xx * yy / 3),
  ];
}

function roundedBox(radius) {
  const inner = 1 - radius;
  const clamp = (v) => Math.max(-inner, Math.min(inner, v));
  return (x, y, z) => {
    const cx = clamp(x), cy = clamp(y), cz = clamp(z);
    const dx = x - cx, dy = y - cy, dz = z - cz;
    const len = Math.hypot(dx, dy, dz) || 1;
    return [cx + dx / len * radius, cy + dy / len * radius, cz + dz / len * radius];
  };
}

/** Spins a profile of [radius, height] points around the Y axis. Ends should have radius 0. */
export function revolve(tris, profile) {
  let length = 0;
  for (let i = 1; i < profile.length; i++) {
    length += Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]);
  }
  const maxR = Math.max(...profile.map((p) => p[0]));
  const aspect = Math.max(0.3, length / (Math.PI * 2 * maxR || 1));
  const segments = Math.max(12, Math.round(Math.sqrt(tris / 2 / aspect)));
  const step = length / Math.max(6, Math.round(segments * aspect));

  const rows = [profile[0]];
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = profile[i - 1];
    const [r1, y1] = profile[i];
    const count = Math.max(1, Math.round(Math.hypot(r1 - r0, y1 - y0) / step));
    for (let k = 1; k <= count; k++) {
      const t = k / count;
      rows.push([r0 + (r1 - r0) * t, y0 + (y1 - y0) * t]);
    }
  }
  const cos = [];
  const sin = [];
  for (let i = 0; i < segments; i++) {
    cos.push(Math.cos(i / segments * Math.PI * 2));
    sin.push(Math.sin(i / segments * Math.PI * 2));
  }
  const b = new Builder();
  b.grid(segments, rows.length - 1, (i, j) => {
    const a = i % segments;
    const [r, y] = rows[j];
    return [r * cos[a], y, -r * sin[a]];
  }, FULL);
  return b.finish();
}

function circleProfile(segments, from, to, centerY, radius) {
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const a = from + (to - from) * i / segments;
    out.push([Math.max(0, Math.cos(a) * radius), centerY + Math.sin(a) * radius]);
  }
  if (from === -Math.PI / 2) out[0][0] = 0;
  if (to === Math.PI / 2) out[segments][0] = 0;
  return out;
}

const arcSteps = (tris) => Math.max(16, Math.round(Math.sqrt(tris / 2)));

function torus(tris, tube = 0.36) {
  const major = Math.max(12, Math.round(Math.sqrt(tris / 2 * 2.2)));
  const minor = Math.max(6, Math.round(major / 2.2));
  const b = new Builder();
  const cosA = [], sinA = [], cosB = [], sinB = [];
  for (let i = 0; i < major; i++) {
    cosA.push(Math.cos(i / major * Math.PI * 2));
    sinA.push(Math.sin(i / major * Math.PI * 2));
  }
  for (let j = 0; j < minor; j++) {
    cosB.push(Math.cos(j / minor * Math.PI * 2));
    sinB.push(Math.sin(j / minor * Math.PI * 2));
  }
  b.grid(major, minor, (i, j) => {
    const a = i % major, c = j % minor;
    const ring = 1 + tube * cosB[c];
    return [ring * cosA[a], tube * sinB[c], -ring * sinA[a]];
  }, FULL);
  return b.finish();
}

function plane(tris) {
  const n = Math.max(2, Math.round(Math.sqrt(tris / 2)));
  const lat = [];
  for (let i = 0; i <= n; i++) lat.push(-1 + 2 * i / n);
  const b = new Builder();
  b.grid(n, n, (i, j) => [lat[i], 0, lat[n - j]], FULL);
  return b.finish();
}

/** Sweeps a circle along a smooth path, with a radius at each path point. Ends are rounded. */
export function tube(tris, points, radii, flatten = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, "centripetal");
  const length = curve.getLength();
  const avg = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const around = Math.max(10, Math.round(Math.sqrt(tris / 2 * (Math.PI * 2 * avg) / length)));
  const along = Math.max(14, Math.round(tris / 2 / around));
  const frames = curve.computeFrenetFrames(along, false);
  const radiusAt = (t) => {
    const f = t * (radii.length - 1);
    const i = Math.min(radii.length - 2, Math.floor(f));
    const s = f - i;
    const eased = s * s * (3 - 2 * s);
    return radii[i] + (radii[i + 1] - radii[i]) * eased;
  };
  const rows = [];
  const capT = Math.min(0.2, radii[0] / length * 1.1);
  const capE = Math.min(0.2, radii[radii.length - 1] / length * 1.1);
  for (let j = 0; j <= along; j++) {
    const t = j / along;
    let r = radiusAt(t);
    if (t < capT) r *= Math.sqrt(Math.max(0, 1 - (1 - t / capT) ** 2));
    if (t > 1 - capE) r *= Math.sqrt(Math.max(0, 1 - (1 - (1 - t) / capE) ** 2));
    if (j === 0 || j === along) r = 0;
    rows.push({ center: curve.getPointAt(t), n: frames.normals[j], b: frames.binormals[j], r });
  }
  const cos = [];
  const sin = [];
  for (let i = 0; i < around; i++) {
    cos.push(Math.cos(i / around * Math.PI * 2));
    sin.push(Math.sin(i / around * Math.PI * 2));
  }
  const b = new Builder();
  b.grid(around, along, (i, j) => {
    const a = i % around;
    const row = rows[j];
    const c = cos[a] * row.r;
    const s = sin[a] * row.r * flatten;
    return [
      row.center.x + row.n.x * c + row.b.x * s,
      row.center.y + row.n.y * c + row.b.y * s,
      row.center.z + row.n.z * c + row.b.z * s,
    ];
  }, FULL);
  return b.finish();
}

/** Makes a shape's triangles face outward. */
function orient(data) {
  const { positions: p, indices: ix } = data;
  let volume = 0;
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
    volume +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  if (volume < 0) {
    for (let t = 0; t < ix.length; t += 3) {
      const swap = ix[t + 1];
      ix[t + 1] = ix[t + 2];
      ix[t + 2] = swap;
    }
  }
  return data;
}

export const SHAPES = {
  sphere: { label: "Sphere", area: 12.6, build: (t) => cubeShape(t, ball) },
  uvsphere: {
    label: "UV Sphere", area: 12.6,
    build: (t) => revolve(t, circleProfile(arcSteps(t), -Math.PI / 2, Math.PI / 2, 0, 1)),
  },
  cube: { label: "Cube", area: 17, build: (t) => cubeShape(t, (x, y, z) => [x * 0.82, y * 0.82, z * 0.82]) },
  rounded: {
    label: "Rounded Cube", area: 16,
    build: (t) => {
      const box = roundedBox(0.28);
      return cubeShape(t, (x, y, z) => box(x, y, z).map((v) => v * 0.86));
    },
  },
  cylinder: { label: "Cylinder", area: 16, build: (t) => revolve(t, [[0, -1], [0.75, -1], [0.75, 1], [0, 1]]) },
  cone: { label: "Cone", area: 12, build: (t) => revolve(t, [[0, -0.9], [0.9, -0.9], [0, 1.1]]) },
  torus: { label: "Torus", area: 20, build: (t) => torus(t) },
  capsule: {
    label: "Capsule", area: 14,
    build: (t) => revolve(t, [
      ...circleProfile(arcSteps(t), -Math.PI / 2, 0, -0.65, 0.65),
      ...circleProfile(arcSteps(t), 0, Math.PI / 2, 0.65, 0.65),
    ]),
  },
  plane: { label: "Plane", area: 8, open: true, build: (t) => plane(t) },
};

/** Builds surface data for a shape id, or for {lathe} and {tube} shapes used by templates. */
export function buildShape(shape, tris, params = {}) {
  if (shape === "lathe") return orient(revolve(tris, params.profile));
  if (shape === "tube") return orient(tube(tris, params.points, params.radii, params.flatten ?? 1));
  if (shape === "torus") return orient(torus(tris, params.tube ?? 0.36));
  const data = SHAPES[shape].build(tris);
  return SHAPES[shape].open ? data : orient(data);
}
