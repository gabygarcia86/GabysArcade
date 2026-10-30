/**
 * Arcade hover-ship physics, shared by the player, AI and ghost-free time
 * trials. Velocity is split into forward and sideways parts every step:
 *
 *  - forward: thrust (fading toward the speed limit), braking, reverse,
 *    coasting drag, and a pull back down when over the limit (after a boost
 *    or on rough ground);
 *  - sideways: exponential grip. High grip carves, low grip slides. Part of
 *    the speed scrubbed off sideways is fed back forward so drifts keep pace;
 *  - turning: angular velocity eases toward the stick so input is smooth but
 *    immediate. The turn rate peaks at low-medium speed and falls off at top
 *    speed, so fast corners have a wider radius.
 *
 * Holding brake while steering at speed starts a power-slide: grip drops,
 * turning sharpens and most of the braking turns into the slide.
 */
import { CONFIG } from './config.js';
import { clamp, damp } from './utils.js';

const P = CONFIG.physics;
export const TURBO_TIME = 0.35;

/** Turn-rate multiplier for a share of top speed (0 … 1+). */
export function turnFactor(ratio) {
  const r = clamp(ratio, 0, 1.3);
  if (r < P.turnPeakAt) return P.turnLowSpeed + (1 - P.turnLowSpeed) * (r / P.turnPeakAt);
  const t = Math.min(1, (r - P.turnPeakAt) / (1 - P.turnPeakAt));
  return 1 + (P.turnHighSpeed - 1) * t;
}

/**
 * Advances one racer by dt.
 *  c    — controls { throttle 0..1, brake 0..1, steer -1..1 }
 *  surf — CONFIG.surfaces entry under the ship
 */
export function stepVehicle(r, c, surf, dt) {
  const h = r.h;
  const fx = Math.cos(r.heading);
  const fy = Math.sin(r.heading);
  let vf = r.vx * fx + r.vy * fy;
  let vl = -r.vx * fy + r.vy * fx;

  const stunned = r.stun > 0;
  const boostMul = r.boosting ? h.boostSpeed : 1;
  const padMul = r.padTime > 0 ? CONFIG.boostPad.speed : 1;
  // heavier ships lose less on rough ground
  const surfSpeed = surf.speed < 1 ? Math.min(1, surf.speed + (h.stability - 0.6) * 0.08) : surf.speed;
  const limit = h.topSpeed * surfSpeed * Math.max(boostMul, padMul) * (stunned ? 0.85 : 1);
  const ratio = Math.abs(vf) / h.topSpeed;

  /* ---- power-slide */
  const PS = P.powerSlide;
  r.powerSlide = c.brake > 0.3 && Math.abs(c.steer) > 0.25 && vf > h.topSpeed * PS.minSpeed && !stunned;

  /* ---- steering */
  let turn = c.steer * h.turnRate * turnFactor(ratio);
  if (P.reverseSteerFlip && vf < -20) turn = -turn;
  if (r.powerSlide) turn *= PS.turnBoost;
  if (stunned) turn *= 0.45;
  r.angVel += (turn - r.angVel) * damp(P.steerResponse, dt);
  r.spinVel *= Math.exp(-3.2 * dt);
  r.heading += (r.angVel + r.spinVel) * dt;

  /* ---- thrust, brake, reverse */
  const thrust = h.accel * surf.accel * (r.boosting ? h.boostAccel : 1);
  if (c.throttle > 0) {
    if (vf < -20) {
      vf += P.brakeDecel * c.throttle * dt; // throttle while reversing brakes first
    } else {
      const fade = Math.max(0.06, 1 - P.accelFalloff * Math.min(1, (vf / limit) ** 2));
      if (vf < limit) vf = Math.min(limit, vf + thrust * c.throttle * fade * dt);
    }
  }
  if (c.brake > 0) {
    if (vf > 15) {
      const decel = P.brakeDecel * (r.powerSlide ? PS.brakeFactor : 1);
      vf = Math.max(0, vf - decel * c.brake * dt);
    } else {
      vf = Math.max(-h.topSpeed * P.reverseSpeed, vf - P.reverseAccel * c.brake * dt);
    }
  }
  if (c.throttle <= 0 && c.brake <= 0) vf *= Math.exp(-P.coastDrag * dt);
  vf *= Math.exp(-P.rollDrag * dt);
  if (vf > limit) vf = limit + (vf - limit) * Math.exp(-(P.overSpeedDrag + surf.drag) * dt);
  if (r.turbo > 0) {
    // mini-turbo after a drift: a short push that may exceed the limit
    vf += (r.turboPower / TURBO_TIME) * dt;
  }

  /* ---- sideways grip */
  // heavy ships stay planted at speed; light ones start to float
  let grip = h.grip * surf.grip * (1 - P.gripHighSpeedLoss * (1.3 - h.stability * 0.6) * Math.min(1, ratio) ** 2);
  if (r.powerSlide) grip *= PS.grip;
  if (stunned) grip *= 0.35;
  const newVl = vl * Math.exp(-grip * dt);
  if (vf > 0) vf += (Math.abs(vl) - Math.abs(newVl)) * P.slideRetention;
  vl = newVl;

  r.vx = fx * vf - fy * vl;
  r.vy = fy * vf + fx * vl;
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.forward = vf;
  r.speed = Math.hypot(r.vx, r.vy);
  r.slip = Math.atan2(vl, Math.max(60, Math.abs(vf)));
}
