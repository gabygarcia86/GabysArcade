/*
 * Procedural animation. Turns a character's state into a pose, and draws jointed
 * bodies from that pose using two-bone inverse kinematics.
 *
 * Body space: the origin is between the feet, +x is forward and -y is up. Hands are
 * measured from the shoulder, inside the leaning torso.
 */
(function (MQ) {
  const { clamp, lerp, smooth } = MQ.U;
  const { sin, cos, abs, max, hypot } = Math;
  const TAU = MQ.TAU;

  const HIP = -42;
  const SHOULDER = -24;
  const THIGH = 21;
  const SHIN = 20;
  const ARM = 15.5;

  const createPose = () => ({
    hip: HIP, lean: 0, head: 0, roll: 0, fx: 7, fy: 0, bx: -7, by: 0,
    hfx: 12, hfy: 18, hbx: -7, hby: 24, weapon: 0,
  });

  function feet(p, fx, fy, bx, by) {
    p.fx = fx;
    p.fy = fy;
    p.bx = bx;
    p.by = by;
  }

  function hands(p, fx, fy, bx, by) {
    p.hfx = fx;
    p.hfy = fy;
    p.hbx = bx;
    p.hby = by;
  }

  // Full body movement. As phase rises, a foot is planted while it moves back and lifted while it swings forward.
  const MOVES = {
    idle(p, t) {
      const breath = sin(t * 2.4);
      p.hip = HIP + breath * 0.5;
      p.head = sin(t * 0.7) * 0.04;
      feet(p, 8, 0, -8, 0);
      hands(p, 12, 19 + breath, -7, 25 + breath);
      p.weapon = 0.5;
    },
    walk(p, t, phase) {
      const c = cos(phase);
      p.hip = HIP + 1 - abs(sin(phase)) * 1.5;
      p.lean = 0.06;
      feet(p, c * 14, -max(0, -sin(phase)) * 6, -c * 14, -max(0, sin(phase)) * 6);
      hands(p, 13 - c * 4, 18, -5 + c * 10, 24);
      p.weapon = 0.35;
    },
    run(p, t, phase) {
      const c = cos(phase);
      p.hip = HIP + 3 - abs(sin(phase)) * 5;
      p.lean = 0.22;
      p.head = -0.12;
      feet(p, c * 23, -max(0, -sin(phase)) * 15, -c * 23, -max(0, sin(phase)) * 15);
      hands(p, 14 - c * 8, 14, -4 + c * 18, 18);
      p.weapon = 0.25;
    },
    jump(p) {
      p.hip = HIP - 3;
      p.lean = 0.1;
      feet(p, 14, -15, -11, -6);
      hands(p, 18, 6, -14, 13);
    },
    fall(p, t) {
      p.hip = HIP - 2;
      p.lean = 0.04;
      feet(p, 10, -6 + sin(t * 13) * 2, -13, -12);
      hands(p, 20, 4, -20, -2);
      p.head = 0.12;
    },
    fly(p, t) {
      const sway = sin(t * 7) * 2;
      p.hip = HIP - 2;
      p.lean = 0.3;
      p.head = -0.24;
      feet(p, -6 + sway, -5, -17 - sway, -10);
      hands(p, 14, 18, -14, 20);
    },
    land(p) {
      p.hip = HIP + 9;
      p.lean = 0.3;
      feet(p, 14, 0, -13, 0);
      hands(p, 20, 14, -16, 16);
    },
    dodge(p, t, phase, time) {
      const k = clamp(time / MQ.DATA.PHYSICS.dodgeTime, 0, 1);
      p.hip = HIP + 17;
      p.lean = 0.5;
      p.roll = k * TAU;
      feet(p, 12, -16, -4, -12);
      hands(p, 14, 12, 6, 16);
    },
    hurt(p) {
      p.hip = HIP + 3;
      p.lean = -0.36;
      p.head = -0.2;
      feet(p, 12, -3, -14, 0);
      hands(p, 5, -8, -17, 4);
    },
    crouch(p, t) {
      p.hip = HIP + 15;
      p.lean = 0.16;
      feet(p, 15, 0, -15, 0);
      hands(p, 24, 3 + sin(t * 2), 17, 8);
    },
    victory(p, t) {
      p.hip = HIP + sin(t * 3) * 1.5;
      p.lean = -0.1;
      p.head = -0.2;
      feet(p, 11, 0, -11, 0);
      hands(p, 12, -26 + sin(t * 6) * 2, -13, 9);
      p.weapon = -1.4;
    },
    sit(p) {
      p.hip = -22;
      p.lean = 0.1;
      feet(p, 30, 0, 22, 0);
      hands(p, 18, 14, 12, 17);
    },
    dead(p, t, phase, time) {
      const k = smooth(time / 0.5);
      p.hip = lerp(HIP, -27, k);
      p.roll = -k * 1.45;
      p.lean = -0.2;
      p.head = 0.35;
      feet(p, 18, -5 * k, -3, 0);
      hands(p, 4, -10, -17, 3);
    },
  };

  // Arms, layered over the movement. k is progress from 0 to 1.
  const ACTIONS = {
    aim(p, k, variant, angle) {
      const kick = sin(clamp(k, 0, 1) * Math.PI) * (variant ? 6 : 3.5);
      const a = angle - p.lean;
      hands(p, cos(a) * (28 - kick), sin(a) * (28 - kick), -7, 22);
      p.weapon = a - kick * 0.03;
    },
    rifle(p, k, variant, angle) {
      const kick = sin(clamp(k, 0, 1) * Math.PI) * (variant ? 7 : 3);
      const a = angle - p.lean;
      const c = cos(a);
      const s = sin(a);
      hands(p, c * (17 - kick), s * (17 - kick) + 5, c * (30 - kick), s * (30 - kick) + 6);
      p.weapon = a;
    },
    launch(p, k, variant, angle) {
      const a = angle - p.lean;
      const reach = 30 - sin(k * Math.PI) * 5;
      hands(p, cos(a) * reach, sin(a) * reach, 5, 12);
      p.head = angle * 0.4;
    },
    hold(p) {
      p.hfx = 17;
      p.hfy = 12;
      p.weapon = -0.75;
    },
    swing(p, k, variant) {
      const e = smooth(Math.min(1, k * 1.5));
      let a;
      let reach = 27;
      if (variant === 1) a = lerp(1.2, -1.9, e);
      else if (variant === 2) {
        a = lerp(-0.4, 0.05, e);
        reach = lerp(8, 32, e);
      } else if (variant === 3) {
        a = lerp(-2.8, 1.25, e);
        p.lean += e * 0.35;
      } else a = lerp(-2.1, 0.95, e);
      hands(p, cos(a) * reach, sin(a) * reach, -12, 12);
      p.weapon = a * 1.08;
    },
    windup(p, k) {
      hands(p, -9 - k * 4, -18 - k * 5, 14, 8);
      p.lean -= 0.1 * k;
      p.weapon = -2.15;
    },
    push(p, k) {
      const e = smooth(Math.min(1, k * 2));
      hands(p, lerp(5, 29, e), lerp(10, -6, e), lerp(2, 25, e), lerp(14, 3, e));
    },
    guard(p) {
      hands(p, 22, -2, 15, 11);
      p.weapon = -1.35;
    },
    point(p) {
      hands(p, 29, -6, -9, 22);
      p.weapon = -0.2;
    },
    raise(p) {
      hands(p, 11, -28, -11, -26);
      p.weapon = -1.5;
    },
    carry(p) {
      hands(p, 19, 10, 22, 12);
    },
  };

  function human(p, anim, t, phase, animTime, action, k = 0, variant = 0, angle = 0) {
    p.lean = 0;
    p.head = 0;
    p.roll = 0;
    p.weapon = 0;
    (MOVES[anim] || MOVES.idle)(p, t, phase, animTime);
    if (action && anim !== "dead" && ACTIONS[action]) ACTIONS[action](p, k, variant, angle);
    return p;
  }

  const joint = { x: 0, y: 0, ex: 0, ey: 0 };

  // bend 1 puts the middle joint forward (knees), -1 behind (elbows).
  function ik(ax, ay, bx, by, first, second, bend) {
    let dx = bx - ax;
    let dy = by - ay;
    let d = hypot(dx, dy) || 0.001;
    dx /= d;
    dy /= d;
    d = clamp(d, abs(first - second) + 0.01, first + second - 0.01);
    const along = (first * first - second * second + d * d) / (2 * d);
    const out = Math.sqrt(max(0, first * first - along * along)) * bend;
    joint.x = ax + dx * along + dy * out;
    joint.y = ay + dy * along - dx * out;
    joint.ex = ax + dx * d;
    joint.ey = ay + dy * d;
    return joint;
  }

  function limb(ctx, x0, y0, x1, y1, x2, y2, width, color, lowerColor = color) {
    const { line, shade } = MQ.U;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = MQ.INK;
    ctx.lineWidth = width + 3;
    ctx.stroke();
    line(ctx, x1, y1, x2, y2, lowerColor, width * 0.86);
    line(ctx, x0, y0, x1, y1, color, width);
    line(ctx, x0, y0 - width * 0.2, x1, y1 - width * 0.2, shade(color, 0.16), width * 0.25);
  }

  // Runs draw() with x along the bone, from the first joint to the second.
  function bone(ctx, x0, y0, x1, y1, draw, ...args) {
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    draw(ctx, hypot(x1 - x0, y1 - y0), ...args);
    ctx.restore();
  }

  function leg(ctx, model, actor, hx, hy, fx, fy, front) {
    const j = ik(hx, hy, fx, fy - 3, THIGH, SHIN, 1);
    const { x, y, ex, ey } = j;
    const suit = front ? model.suit : MQ.U.shade(model.suit, -0.3);
    limb(ctx, hx, hy, x, y, x + (ex - x) * 0.8, y + (ey - y) * 0.8, model.legWidth || 10, suit);
    if (model.thigh) bone(ctx, hx, hy, x, y, model.thigh, front, actor);
    if (model.shin) bone(ctx, x, y, ex, ey, model.shin, front, actor);
    ctx.save();
    ctx.translate(ex, ey);
    if (ey < -5) ctx.rotate(0.3);
    model.boot(ctx, front, actor);
    ctx.restore();
  }

  function arm(ctx, model, actor, p, sx, hx, hy, front) {
    const j = ik(sx, SHOULDER, sx + hx, SHOULDER + hy, ARM, ARM, -1);
    const { x, y, ex, ey } = j;
    const suit = front ? model.suit : MQ.U.shade(model.suit, -0.3);
    limb(ctx, sx, SHOULDER, x, y, ex, ey, model.armWidth || 8, suit);
    if (model.gauntlet) bone(ctx, x, y, ex, ey, model.gauntlet, front, actor);
    if (front && model.weapon) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(p.weapon);
      model.weapon(ctx, actor);
      ctx.restore();
    }
    MQ.U.oval(ctx, ex, ey, 4, 4, model.glove || "#26242a", MQ.INK, 1.5);
    if (model.shoulder) {
      ctx.save();
      ctx.translate(sx, SHOULDER);
      ctx.rotate(Math.atan2(y - SHOULDER, x - sx) - Math.PI / 2);
      ctx.scale(0.84, 0.84);
      model.shoulder(ctx, front, actor);
      ctx.restore();
    }
  }

  // A model supplies the painters for each part of the body.
  function drawHumanoid(ctx, p, model, actor) {
    ctx.save();
    if (p.roll) {
      ctx.translate(0, p.hip);
      ctx.rotate(p.roll);
      ctx.translate(0, -p.hip);
    }

    ctx.save();
    ctx.translate(0, p.hip);
    ctx.rotate(p.lean);
    model.back?.(ctx, actor);
    arm(ctx, model, actor, p, -5, p.hbx, p.hby, false);
    ctx.restore();

    leg(ctx, model, actor, -3.5, p.hip, p.bx, p.by, false);
    leg(ctx, model, actor, 3.5, p.hip, p.fx, p.fy, true);

    ctx.translate(0, p.hip);
    ctx.rotate(p.lean);
    model.torso(ctx, actor);
    ctx.save();
    ctx.translate(1, -39);
    ctx.rotate(p.head);
    model.head(ctx, actor);
    ctx.restore();
    model.overlay?.(ctx, actor);
    arm(ctx, model, actor, p, 2, p.hfx, p.hfy, true);
    ctx.restore();
  }

  /*
   * Where a point held in the front hand ends up in body space, following the same steps
   * as drawHumanoid: (wx, wy) is in the weapon's frame, x along the weapon from the grip.
   */
  function frontHandPoint(p, wx, wy, out) {
    const j = ik(2, SHOULDER, 2 + p.hfx, SHOULDER + p.hfy, ARM, ARM, -1);
    const cw = cos(p.weapon);
    const sw = sin(p.weapon);
    const tx = j.ex + wx * cw - wy * sw;
    const ty = j.ey + wx * sw + wy * cw;
    const cl = cos(p.lean);
    const sl = sin(p.lean);
    let x = tx * cl - ty * sl;
    let y = tx * sl + ty * cl;
    if (p.roll) {
      const cr = cos(p.roll);
      const sr = sin(p.roll);
      const rx = x * cr - y * sr;
      y = x * sr + y * cr;
      x = rx;
    }
    out.x = x;
    out.y = y + p.hip;
    return out;
  }

  MQ.Anim = { createPose, human, ik, limb, bone, drawHumanoid, frontHandPoint };
})(window.MQ);
