// Jet ski rigid-body physics: four-point buoyancy on the Gerstner ocean, hydrodynamic drag,
// thrust, steering, airborne flight, landing stabilization and simple world collisions.
// Runs on a fixed timestep; the renderer interpolates between the last two states.
import * as THREE from 'three';
import { GRAVITY } from './water.js';
import { UPGRADE_STEP } from './data.js';

export const FIXED_DT = 1 / 120;

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _cur = { x: 0, z: 0 };

// Local buoyancy sample points (front-left, front-right, rear-left, rear-right). +Z is forward.
const POINTS = [
  new THREE.Vector3(0.42, -0.22, 1.05),
  new THREE.Vector3(-0.42, -0.22, 1.05),
  new THREE.Vector3(0.48, -0.22, -1.0),
  new THREE.Vector3(-0.48, -0.22, -1.0),
];
const INERTIA = new THREE.Vector3(0.9, 1.0, 0.3); // pitch, yaw, roll (per unit mass)

// ---------------------------------------------------------------- World collision data
export class PhysicsWorld {
  constructor(waves) {
    this.waves = waves;
    this.cell = 24;
    this.grid = new Map();
    this.colliders = [];
    this.ramps = [];
    this.boundary = null; // (body) => void
    this.currentFn = null; // (x, z, out) => out
  }

  clear() {
    this.grid.clear();
    this.colliders.length = 0;
    this.ramps.length = 0;
    this.boundary = null;
    this.currentFn = null;
  }

  // Circle collider. top: height above sea level (Infinity = solid rock), float: rides the waves.
  addCircle(x, z, r, opts = {}) {
    const c = { x, z, r, top: opts.top ?? Infinity, bounce: opts.bounce ?? 0.35, kind: opts.kind || 'rock', float: !!opts.float, obj: opts.obj || null, y: 0 };
    this.colliders.push(c);
    const c0 = Math.floor((x - r) / this.cell), c1 = Math.floor((x + r) / this.cell);
    const r0 = Math.floor((z - r) / this.cell), r1 = Math.floor((z + r) / this.cell);
    for (let i = c0; i <= c1; i++) {
      for (let j = r0; j <= r1; j++) {
        const key = i * 73856093 ^ j * 19349663;
        let list = this.grid.get(key);
        if (!list) { list = []; this.grid.set(key, list); }
        list.push(c);
      }
    }
    return c;
  }

  addRamp(x, z, yaw, len, width, height) {
    const r = { x, z, yaw, len, width, height, fx: Math.sin(yaw), fz: Math.cos(yaw), base: -0.7 };
    this.ramps.push(r);
    return r;
  }

  query(x, z) {
    return this.grid.get(Math.floor(x / this.cell) * 73856093 ^ Math.floor(z / this.cell) * 19349663);
  }

  rampLocal(r, x, z, out) {
    const dx = x - r.x, dz = z - r.z;
    out.u = dx * r.fx + dz * r.fz;
    out.v = dx * r.fz - dz * r.fx;
    return out;
  }

  rampSurface(x, z) {
    let best = -Infinity;
    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      const dx = x - r.x, dz = z - r.z;
      const u = dx * r.fx + dz * r.fz;
      if (u < 0 || u > r.len) continue;
      const v = dx * r.fz - dz * r.fx;
      if (Math.abs(v) > r.width * 0.5) continue;
      const s = r.base + (r.height - r.base) * Math.pow(u / r.len, 1.35);
      if (s > best) best = s;
    }
    return best;
  }

  current(x, z) {
    if (this.currentFn) return this.currentFn(x, z, _cur);
    _cur.x = 0; _cur.z = 0;
    return _cur;
  }
}

// ---------------------------------------------------------------- Handling derived from stats
export function deriveHandling(stats, upgrades = {}, mult = { speed: 1, accel: 1, corner: 1 }) {
  const up = (k) => (upgrades[k] || 0) * UPGRADE_STEP;
  const speed = stats.speed + up('engine');
  const hand = stats.handling + up('steering');
  const acc = stats.accel + up('accel');
  const stab = stats.stability + up('stability');
  return {
    maxSpeed: (19.5 + 1.35 * speed) * (mult.speed || 1),
    accel: (5.2 + 0.95 * acc) * (mult.accel || 1),
    turnRate: (1.2 + 0.105 * hand) * (mult.corner || 1),
    grip: 2.4 + 0.36 * hand,
    stability: stab,
    buoyDamp: 2.6 + 0.16 * stab,
    landTolerance: 0.5 + 0.035 * stab, // cos of the worst survivable landing tilt
    boostMax: 100 + 18 * (upgrades.boost || 0),
    boostRegen: 4 + 0.9 * (upgrades.boost || 0),
  };
}

// ---------------------------------------------------------------- Rigid body
export class JetSkiBody {
  constructor(world, handling) {
    this.world = world;
    this.h = handling;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.angVel = new THREE.Vector3();
    this.prevPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.renderPos = new THREE.Vector3();
    this.renderQuat = new THREE.Quaternion();
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.fwdFlat = new THREE.Vector3(0, 0, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.input = { throttle: 0, brake: 0, steer: 0, boost: false, jump: false, pitch: 0 };
    this.boost = handling.boostMax;
    this.boosting = false;
    this.speed = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.wet = 0;
    this.rearWet = 0;
    this.onRamp = 0;
    this.airTimer = 0;
    this.airborne = false;
    this.airTime = 0;
    this.maxAirHeight = 0;
    this.heightAboveWater = 0;
    this.jumpCooldown = 0;
    this.jumpBuffer = 0;
    this.launchT = 0;
    this.crashed = false;
    this.trickLock = false; // tricks drive orientation visuals; body holds steady
    this.radius = 1.05;
    this.depths = [0, 0, 0, 0];
    this.events = { landed: null, hit: null, jumped: false };
    this.distance = 0;
  }

  place(x, z, yaw, y = null) {
    const h = y ?? this.world.waves.heightAt(x, z);
    this.pos.set(x, h + 0.1, z);
    this.vel.set(0, 0, 0);
    this.angVel.set(0, 0, 0);
    this.quat.setFromAxisAngle(_v1.set(0, 1, 0), yaw);
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.renderPos.copy(this.pos);
    this.renderQuat.copy(this.quat);
    this.airborne = false;
    this.airTimer = 0;
    this.crashed = false;
    this.boosting = false;
    this.jumpBuffer = 0;
    this.updateBasis();
  }

  yaw() {
    return Math.atan2(this.fwdFlat.x, this.fwdFlat.z);
  }

  updateBasis() {
    this.fwd.set(0, 0, 1).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
    const fl = Math.hypot(this.fwd.x, this.fwd.z);
    if (fl > 0.2) this.fwdFlat.set(this.fwd.x / fl, 0, this.fwd.z / fl);
  }

  step(dt) {
    const w = this.world;
    const waves = w.waves;
    const h = this.h;
    const inp = this.crashed ? DEAD_INPUT : this.input;
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
    this.updateBasis();
    if (this.launchT > 0) this.launchT -= dt;

    // Arcade hang time: gravity is softer once the hull has left the water.
    const force = _v1.set(0, -GRAVITY * (this.airborne ? 0.65 : 1), 0);
    const torque = _v2.set(0, 0, 0);
    let wet = 0, rearWet = 0, ramp = 0;
    const kB = 26, cB = h.buoyDamp;

    for (let i = 0; i < 4; i++) {
      const r = _v3.copy(POINTS[i]).applyQuaternion(this.quat);
      const px = this.pos.x + r.x, py = this.pos.y + r.y, pz = this.pos.z + r.z;
      // Velocity of this point: v + w x r (only the vertical part matters here).
      const pvy = this.vel.y + (this.angVel.z * r.x - this.angVel.x * r.z);
      const water = waves.heightAt(px, pz);
      const rs = w.ramps.length ? w.rampSurface(px, pz) : -Infinity;
      let fy = 0;
      if (rs > water - 0.25 && py < rs + 0.08 && py > rs - 1.6) {
        const d = rs - py;
        if (d > -0.02) {
          fy = 190 * Math.max(d, 0) - 16 * pvy;
          if (fy < 0) fy = 0;
          ramp++;
        }
        this.depths[i] = d;
      } else {
        const d = water - py;
        this.depths[i] = d;
        if (d > 0) {
          // Right after a jump the hull is leaving the water: no damping drag on the way up.
          fy = kB * Math.min(d, 0.9) - (this.launchT > 0 && pvy > 0 ? 0 : cB * pvy);
          if (fy < 0) fy *= 0.25;
          wet++;
          if (i >= 2) rearWet++;
        }
      }
      if (fy !== 0) {
        force.y += fy;
        // r x (0, fy, 0) = (-r.z * fy, 0, r.x * fy)
        torque.x += -r.z * fy;
        torque.z += r.x * fy;
      }
    }

    this.wet = wet;
    this.rearWet = rearWet;
    this.onRamp = ramp;
    const contact = wet + ramp > 0;
    const fwdFlat = this.fwdFlat;
    const rx = fwdFlat.z, rz = -fwdFlat.x; // +X-ish side vector (rider's left)
    const vf = this.vel.x * fwdFlat.x + this.vel.z * fwdFlat.z;
    const vl = this.vel.x * rx + this.vel.z * rz;
    this.forwardSpeed = vf;
    this.lateralSpeed = vl;
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // Boost tank.
    this.boosting = false;
    if (inp.boost && this.boost > 0 && contact && !this.crashed) {
      this.boosting = true;
      this.boost = Math.max(0, this.boost - 30 * dt);
    } else {
      this.boost = Math.min(h.boostMax, this.boost + h.boostRegen * dt);
    }

    // Measured roll (positive = left side up, i.e. leaning right) and pitch (positive = nose up).
    const axX = 1 - 2 * (this.quat.y * this.quat.y + this.quat.z * this.quat.z);
    const axY = 2 * (this.quat.x * this.quat.y + this.quat.w * this.quat.z);
    void axX;
    const roll = Math.asin(Math.max(-1, Math.min(1, axY)));
    const pitch = Math.asin(Math.max(-1, Math.min(1, this.fwd.y)));
    const rollRate = this.angVel.dot(this.fwd);
    // Right-hand axis in world space (local +X).
    const sideX = 1 - 2 * (this.quat.y * this.quat.y + this.quat.z * this.quat.z);
    const sideY = axY;
    const sideZ = 2 * (this.quat.x * this.quat.z - this.quat.w * this.quat.y);
    const pitchRate = this.angVel.x * sideX + this.angVel.y * sideY + this.angVel.z * sideZ;

    if (wet > 0) {
      const wf = Math.min(1, wet / 2);
      const target = this.boosting ? h.maxSpeed * 1.3 : h.maxSpeed;
      let a = 0;
      // Thrust stays strong until close to top speed, then tapers off.
      const r = Math.max(0, vf) / target;
      if (inp.throttle > 0 && rearWet > 0) {
        a += h.accel * (this.boosting ? 1.6 : 1) * inp.throttle * Math.max(0, 1 - r * r * r * r);
      } else if (this.boosting && rearWet > 0) {
        a += h.accel * 1.2 * Math.max(0, 1 - r * r * r);
      }
      if (inp.brake > 0) {
        if (vf > 0.6) a -= 13 * inp.brake;
        else if (vf > -6) a -= 5 * inp.brake;
      }
      // Hull drag: light under power, heavier when coasting, strong above top speed.
      a -= vf * (inp.throttle > 0 ? 0.035 : 0.14);
      if (vf > target) a -= (vf - target) * 0.9;
      force.x += fwdFlat.x * a * wf;
      force.z += fwdFlat.z * a * wf;

      // Hull grip: lateral sliding is resisted; part of it is carried into the carve.
      const lat = -vl * h.grip * wf;
      force.x += rx * lat;
      force.z += rz * lat;
      const carve = Math.abs(vl * h.grip * wf) * 0.3 * Math.sign(vf || 1);
      force.x += fwdFlat.x * carve;
      force.z += fwdFlat.z * carve;

      // Vertical water drag and planing lift.
      if (!(this.launchT > 0 && this.vel.y > 0)) force.y -= this.vel.y * 1.1 * wf;
      force.y += Math.min(this.speed * this.speed * 0.0042, 2.6) * wf;

      // River currents push the hull along.
      const cur = w.current(this.pos.x, this.pos.z);
      force.x += (cur.x - this.vel.x * 0.06) * 0.9 * wf;
      force.z += (cur.z - this.vel.z * 0.06) * 0.9 * wf;

      // Steering: yaw rate target scales with speed (less authority when slow or flat out).
      const auth = Math.min(1, Math.max(0.32, this.speed / 7)) * (1 - 0.3 * Math.min(1, Math.max(0, (this.speed - 14) / 22)));
      const thrustFactor = inp.throttle > 0 || this.boosting ? 1 : 0.72;
      const targetYaw = -inp.steer * h.turnRate * auth * thrustFactor * (vf < -0.5 ? -0.6 : 1);
      torque.y += (targetYaw - this.angVel.y) * 8 * wf;

      // Lean into turns, settle pitch.
      const lean = inp.steer * 0.44 * Math.min(1, this.speed / 14);
      const rollT = (lean - roll) * 16 - rollRate * 3.2;
      torque.x += this.fwd.x * rollT * wf;
      torque.y += this.fwd.y * rollT * wf;
      torque.z += this.fwd.z * rollT * wf;
      const trim = 0.05 * Math.min(1, this.speed / 18) + (this.boosting ? 0.03 : 0);
      const pitchT = -(trim - pitch) * (2.5 + h.stability * 0.25) - pitchRate * 0.6;
      torque.x += sideX * pitchT * wf;
      torque.y += sideY * pitchT * wf;
      torque.z += sideZ * pitchT * wf;

      const damp = Math.exp(-dt * 2.4 * wf);
      this.angVel.x *= damp;
      this.angVel.z *= damp;

    } else if (ramp > 0) {
      // Sliding up a ramp: little friction, a touch of steering, keep the nose pointed.
      force.x -= this.vel.x * 0.05;
      force.z -= this.vel.z * 0.05;
      torque.y += (-inp.steer * 0.5 - this.angVel.y) * 4;
      const rollT = -roll * 14 - rollRate * 3;
      torque.x += this.fwd.x * rollT;
      torque.y += this.fwd.y * rollT;
      torque.z += this.fwd.z * rollT;
      // Lateral grip on the ramp deck.
      force.x += rx * -vl * 3;
      force.z += rz * -vl * 3;
    } else {
      // Airborne.
      this.vel.multiplyScalar(1 - 0.03 * dt);
      if (!this.trickLock && !this.crashed) {
        const pitchIn = inp.throttle - inp.brake; // W = nose down, S = nose up
        const pt = pitchIn * 2.6;
        torque.x += sideX * pt;
        torque.y += sideY * pt;
        torque.z += sideZ * pt;
        torque.y += (-inp.steer * 1.2 - this.angVel.y) * 2.5;
      }
      // Landing stabilization: as the water approaches, level the roll and match the flight path.
      const flight = Math.atan2(this.vel.y, Math.max(this.speed, 4)) * 0.45;
      const near = this.vel.y < 0 ? Math.min(1, 1.6 / Math.max(0.3, this.heightAboveWater)) : 0.35;
      const st = (2 + h.stability * 0.35) * near;
      const rollT = (-roll * 6 - rollRate * 2) * st * 0.5;
      torque.x += this.fwd.x * rollT;
      torque.y += this.fwd.y * rollT;
      torque.z += this.fwd.z * rollT;
      const clampFlight = Math.max(-0.35, Math.min(0.32, flight));
      const pitchT = -(clampFlight - pitch) * st * 0.6 - pitchRate * 0.5 * near;
      torque.x += sideX * pitchT;
      torque.y += sideY * pitchT;
      torque.z += sideZ * pitchT;
      const damp = Math.exp(-dt * 0.9);
      this.angVel.x *= damp;
      this.angVel.z *= damp;
    }

    // Jump: hop off the water, stronger at speed. The press is buffered briefly, and a jump
    // still works for a moment after the hull skips off a crest.
    this.jumpCooldown -= dt;
    if (inp.jump) this.jumpBuffer = 0.25;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.jumpBuffer > 0 && this.jumpCooldown <= 0 && !this.crashed && (wet > 0 || this.airTimer < 0.15)) {
      this.vel.y = Math.max(this.vel.y, 0) + 3.8 + Math.min(this.speed, 32) * 0.09;
      this.angVel.addScaledVector(_v3.set(sideX, sideY, sideZ), -0.9);
      this.jumpCooldown = 0.7;
      this.jumpBuffer = 0;
      this.launchT = 0.3;
      this.events.jumped = true;
    }

    if (this.crashed) {
      this.vel.x *= Math.exp(-dt * 1.4);
      this.vel.z *= Math.exp(-dt * 1.4);
    }

    // Integrate linear motion.
    this.vel.addScaledVector(force, dt);
    this.pos.addScaledVector(this.vel, dt);
    this.distance += this.speed * dt;

    // Integrate rotation: torque to local space, divide by inertia, back to world.
    _qInv.copy(this.quat).invert();
    torque.applyQuaternion(_qInv);
    torque.x /= INERTIA.x; torque.y /= INERTIA.y; torque.z /= INERTIA.z;
    torque.applyQuaternion(this.quat);
    this.angVel.addScaledVector(torque, dt);
    const maxW = 9;
    if (this.angVel.lengthSq() > maxW * maxW) this.angVel.setLength(maxW);
    _q1.set(this.angVel.x * dt * 0.5, this.angVel.y * dt * 0.5, this.angVel.z * dt * 0.5, 0);
    _q1.multiply(this.quat);
    this.quat.x += _q1.x; this.quat.y += _q1.y; this.quat.z += _q1.z; this.quat.w += _q1.w;
    this.quat.normalize();

    this.collide();
    if (w.boundary) w.boundary(this);

    // Airborne bookkeeping.
    const waterHere = waves.heightAt(this.pos.x, this.pos.z);
    const rampHere = w.ramps.length ? w.rampSurface(this.pos.x, this.pos.z) : -Infinity;
    this.heightAboveWater = this.pos.y - Math.max(waterHere, rampHere);
    if (contact) {
      if (this.airborne) {
        this.airborne = false;
        this.updateBasis();
        this.events.landed = {
          airTime: this.airTime,
          vy: -this.vel.y,
          upDot: this.up.y,
          fwdDot: this.fwd.dot(_v3.copy(this.vel).normalize()),
          height: this.maxAirHeight,
        };
        // Landing absorption: kill bounce and spin, bleed a bit of speed.
        this.angVel.multiplyScalar(0.35);
        if (this.vel.y < 0) this.vel.y *= 0.3;
        const loss = 1 - Math.min(0.25, Math.max(0, (1 - this.up.y)) * 0.6);
        this.vel.x *= loss;
        this.vel.z *= loss;
      }
      this.airTimer = 0;
    } else {
      this.airTimer += dt;
      if (!this.airborne && this.airTimer > 0.1 && this.heightAboveWater > 0.25) {
        this.airborne = true;
        this.airTime = 0;
        this.maxAirHeight = 0;
      }
      if (this.airborne) {
        this.airTime += dt;
        this.maxAirHeight = Math.max(this.maxAirHeight, this.heightAboveWater);
      }
    }
    // Never sink through the water entirely.
    if (this.pos.y < waterHere - 1.2) {
      this.pos.y = waterHere - 1.2;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    this.updateBasis();
  }

  collide() {
    const w = this.world;
    const list = w.query(this.pos.x, this.pos.z);
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        const top = c.float ? c.y + c.top : c.top;
        if (this.pos.y > top) continue;
        const dx = this.pos.x - c.x, dz = this.pos.z - c.z;
        const min = c.r + this.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        this.pos.x += nx * (min - d);
        this.pos.z += nz * (min - d);
        const vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) {
          this.vel.x -= (1 + c.bounce) * vn * nx;
          this.vel.z -= (1 + c.bounce) * vn * nz;
          this.vel.x *= 0.82;
          this.vel.z *= 0.82;
          this.angVel.y += (Math.random() - 0.5) * 1.5;
          if (!this.events.hit || -vn > this.events.hit.speed) this.events.hit = { speed: -vn, kind: c.kind, collider: c };
        }
      }
    }
    // Solid sides of ramps: only when the hull is well below the deck.
    for (const r of w.ramps) {
      const dx = this.pos.x - r.x, dz = this.pos.z - r.z;
      const u = dx * r.fx + dz * r.fz;
      const v = dx * r.fz - dz * r.fx;
      const hw = r.width * 0.5 + 0.6;
      if (u < -0.2 || u > r.len + 0.6 || Math.abs(v) > hw) continue;
      const s = r.base + (r.height - r.base) * Math.pow(Math.max(0, Math.min(1, u / r.len)), 1.35);
      if (this.pos.y > s - 1.0) continue;
      const pBack = r.len + 0.6 - u, pSide = hw - Math.abs(v);
      let nx, nz, pen;
      if (pBack < pSide) { nx = r.fx; nz = r.fz; pen = pBack; } else { const sg = Math.sign(v) || 1; nx = r.fz * sg; nz = -r.fx * sg; pen = pSide; }
      this.pos.x += nx * pen;
      this.pos.z += nz * pen;
      const vn = this.vel.x * nx + this.vel.z * nz;
      if (vn < 0) {
        this.vel.x -= 1.3 * vn * nx;
        this.vel.z -= 1.3 * vn * nz;
        if (!this.events.hit || -vn > this.events.hit.speed) this.events.hit = { speed: -vn, kind: 'ramp' };
      }
    }
  }

  interpolate(alpha) {
    this.renderPos.lerpVectors(this.prevPos, this.pos, alpha);
    this.renderQuat.slerpQuaternions(this.prevQuat, this.quat, alpha);
  }
}

const DEAD_INPUT = { throttle: 0, brake: 0, steer: 0, boost: false, jump: false, pitch: 0 };

// Push two jet skis apart and trade momentum.
export function collideBodies(a, b) {
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const dy = b.pos.y - a.pos.y;
  if (Math.abs(dy) > 1.6) return 0;
  const min = a.radius + b.radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min || d2 < 1e-6) return 0;
  const d = Math.sqrt(d2);
  const nx = dx / d, nz = dz / d;
  const pen = (min - d) * 0.5;
  a.pos.x -= nx * pen; a.pos.z -= nz * pen;
  b.pos.x += nx * pen; b.pos.z += nz * pen;
  const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
  if (rv < 0) {
    const j = -rv * 0.65;
    a.vel.x -= nx * j; a.vel.z -= nz * j;
    b.vel.x += nx * j; b.vel.z += nz * j;
    a.angVel.y += (Math.random() - 0.5) * 0.8;
    b.angVel.y += (Math.random() - 0.5) * 0.8;
    return -rv;
  }
  return 0;
}
