// Race courses (spline tracks), checkpoints, laps, positions and time-trial ghosts.
import * as THREE from 'three';

// ---------------------------------------------------------------- Track
export class Track {
  // points: [[x, z], ...] describing a closed loop. length: desired lap length in metres.
  constructor(points, halfWidth, length = 0) {
    this.halfWidth = halfWidth;
    let pts = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    let curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    if (length) {
      const k = length / curve.getLength();
      pts = pts.map((p) => p.multiplyScalar(k));
      curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    }
    this.curve = curve;
    this.length = curve.getLength();
    const n = Math.ceil(this.length / 2);
    this.n = n;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.tx = new Float32Array(n);
    this.tz = new Float32Array(n);
    this.s = new Float32Array(n);
    this.curv = new Float32Array(n);
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const u = i / n;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      this.x[i] = p.x; this.z[i] = p.z;
      const l = Math.hypot(t.x, t.z) || 1;
      this.tx[i] = t.x / l; this.tz[i] = t.z / l;
      this.s[i] = u * this.length;
    }
    // Signed curvature (heading change per metre), smoothed.
    for (let i = 0; i < n; i++) {
      const a = (i - 3 + n) % n, b = (i + 3) % n;
      const h0 = Math.atan2(this.tx[a], this.tz[a]);
      const h1 = Math.atan2(this.tx[b], this.tz[b]);
      let d = h1 - h0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.curv[i] = d / 12;
    }
  }

  wrap(i) { return ((i % this.n) + this.n) % this.n; }

  nearest(x, z, hint = -1) {
    let best = -1, bestD = Infinity;
    if (hint >= 0) {
      for (let k = -45; k <= 45; k++) {
        const i = this.wrap(hint + k);
        const dx = this.x[i] - x, dz = this.z[i] - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) { bestD = d; best = i; }
      }
      if (bestD < 60 * 60) return best;
    }
    for (let i = 0; i < this.n; i += 4) {
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    for (let k = -4; k <= 4; k++) {
      const i = this.wrap(best + k);
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  indexAt(s) {
    return this.wrap(Math.round((s / this.length) * this.n));
  }

  distanceTo(x, z) {
    const i = this.nearest(x, z);
    return Math.hypot(this.x[i] - x, this.z[i] - z);
  }

  // Signed lateral offset: positive = left of the racing direction.
  lateral(x, z, i) {
    return (x - this.x[i]) * this.tz[i] - (z - this.z[i]) * this.tx[i];
  }

  // World point at sample i with lateral offset (left positive).
  offsetPoint(i, off, out) {
    out.x = this.x[i] + this.tz[i] * off;
    out.z = this.z[i] - this.tx[i] * off;
    return out;
  }
}

// ---------------------------------------------------------------- Race tracking
export class RaceTracker {
  constructor(track, laps) {
    this.track = track;
    this.laps = laps;
    const count = Math.max(6, Math.min(12, Math.round(track.length / 150)));
    this.cps = [];
    for (let k = 0; k < count; k++) {
      const i = track.indexAt((k / count) * track.length);
      this.cps.push({ i, x: track.x[i], z: track.z[i], tx: track.tx[i], tz: track.tz[i], s: track.s[i] });
    }
    this.spacing = track.length / count;
    this.racers = [];
    this.finishOrder = [];
  }

  addRacer(r) {
    Object.assign(r, {
      idx: this.track.nearest(r.body.pos.x, r.body.pos.z), lap: 0, nextCp: 0, started: false,
      progress: 0, finished: false, finishTime: 0, lapStart: 0, bestLap: 0, lapTimes: [],
      cpSide: [], wrongWayT: 0, offTrackT: 0, position: 1, lastCpTime: 0, missed: false,
    });
    for (const cp of this.cps) r.cpSide.push(this.side(cp, r.body.pos));
    this.racers.push(r);
    return r;
  }

  side(cp, p) {
    return (p.x - cp.x) * cp.tx + (p.z - cp.z) * cp.tz;
  }

  // Returns events: [{ type: 'cp'|'lap'|'finish'|'start', racer, lapTime }]
  update(time, dt, events) {
    const tr = this.track;
    for (const r of this.racers) {
      const b = r.body;
      r.idx = tr.nearest(b.pos.x, b.pos.z, r.idx);
      for (let k = 0; k < this.cps.length; k++) {
        const cp = this.cps[k];
        const d = this.side(cp, b.pos);
        const prev = r.cpSide[k];
        r.cpSide[k] = d;
        if (r.finished) continue;
        if (!(prev < 0 && d >= 0)) continue;
        const lat = Math.abs((b.pos.x - cp.x) * cp.tz - (b.pos.z - cp.z) * cp.tx);
        if (lat > tr.halfWidth + 14) continue;
        if (k !== r.nextCp) {
          if (k !== 0 || r.started) r.missed = k > r.nextCp || (r.nextCp === 0 && k > 0);
          continue;
        }
        r.missed = false;
        r.lastCpTime = time;
        if (k === 0) {
          if (!r.started) {
            r.started = true;
            r.lapStart = time;
            events.push({ type: 'start', racer: r });
          } else {
            const lapTime = time - r.lapStart;
            r.lapTimes.push(lapTime);
            if (!r.bestLap || lapTime < r.bestLap) r.bestLap = lapTime;
            r.lap++;
            r.lapStart = time;
            if (r.lap >= this.laps) {
              r.finished = true;
              r.finishTime = time;
              this.finishOrder.push(r);
              events.push({ type: 'finish', racer: r, lapTime });
            } else {
              events.push({ type: 'lap', racer: r, lapTime });
            }
          }
          r.nextCp = 1 % this.cps.length;
        } else {
          r.nextCp = (k + 1) % this.cps.length;
          events.push({ type: 'cp', racer: r, index: k });
        }
      }
      // Continuous progress for standings.
      if (!r.started) {
        r.progress = tr.s[r.idx] > tr.length * 0.5 ? tr.s[r.idx] - tr.length : tr.s[r.idx];
      } else {
        const lastIdx = (r.nextCp - 1 + this.cps.length) % this.cps.length;
        const base = this.cps[lastIdx].s;
        let along = tr.s[r.idx] - base;
        if (along < -tr.length * 0.5) along += tr.length;
        if (along > tr.length * 0.5) along -= tr.length;
        along = Math.max(-20, Math.min(this.spacing + 20, along));
        r.progress = r.lap * tr.length + lastIdx * this.spacing + along;
      }
      // Wrong-way detection.
      const dot = b.fwdFlat.x * tr.tx[r.idx] + b.fwdFlat.z * tr.tz[r.idx];
      if (dot < -0.35 && b.speed > 3) r.wrongWayT += dt; else r.wrongWayT = 0;
      const lat = Math.abs(tr.lateral(b.pos.x, b.pos.z, r.idx));
      if (lat > tr.halfWidth + 32) r.offTrackT += dt; else r.offTrackT = Math.max(0, r.offTrackT - dt * 2);
    }
    // Standings.
    const order = this.racers.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    order.forEach((r, i) => { r.position = i + 1; });
    this.order = order;
  }

  nextCheckpoint(r) {
    return this.cps[r.nextCp];
  }
}

// ---------------------------------------------------------------- Ghost replay
export class GhostRecorder {
  constructor() {
    this.frames = [];
    this.timer = 0;
  }

  update(dt, body) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer += 0.1;
    const p = body.renderPos, q = body.renderQuat;
    this.frames.push(
      Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100,
      Math.round(q.x * 1000) / 1000, Math.round(q.y * 1000) / 1000, Math.round(q.z * 1000) / 1000, Math.round(q.w * 1000) / 1000,
    );
  }

  export(time, ski, custom) {
    return { v: 1, dt: 0.1, time, ski, custom, f: this.frames };
  }
}

const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

export class GhostPlayer {
  constructor(data, object) {
    this.data = data;
    this.object = object;
    this.count = Math.floor(data.f.length / 7);
  }

  update(t) {
    const f = this.data.f;
    const x = t / this.data.dt;
    const i = Math.min(this.count - 1, Math.max(0, Math.floor(x)));
    const j = Math.min(this.count - 1, i + 1);
    const a = Math.min(1, Math.max(0, x - i));
    const o = this.object;
    o.visible = t < this.count * this.data.dt + 1;
    const ia = i * 7, ja = j * 7;
    o.position.set(f[ia] + (f[ja] - f[ia]) * a, f[ia + 1] + (f[ja + 1] - f[ia + 1]) * a, f[ia + 2] + (f[ja + 2] - f[ia + 2]) * a);
    _qa.set(f[ia + 3], f[ia + 4], f[ia + 5], f[ia + 6]).normalize();
    _qb.set(f[ja + 3], f[ja + 4], f[ja + 5], f[ja + 6]).normalize();
    o.quaternion.slerpQuaternions(_qa, _qb, a);
  }
}

export function formatTime(t) {
  if (!t || !isFinite(t)) return '--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
