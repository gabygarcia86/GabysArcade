/*
 * All the character art. One jointed rig draws every humanoid: poses set the joint
 * angles, and a "skin" says how each body part looks. Angles are radians measured
 * from straight down, positive toward the direction the character faces.
 */
(function (J) {
  const { clamp, lerp, ease } = J.U;
  const { sin, cos, PI } = Math;
  const TAU = J.TAU;
  const OUTLINE = "rgba(6,8,14,.85)";

  // ---------- Color helper ----------

  const shadeCache = new Map();
  function shade(hex, amount) {
    const key = hex + amount;
    if (shadeCache.has(key)) return shadeCache.get(key);
    const n = parseInt(hex.slice(1), 16);
    const mixTo = amount < 0 ? 0 : 255;
    const k = Math.abs(amount);
    const part = (v) => Math.round(v + (mixTo - v) * k);
    const out = `rgb(${part(n >> 16)},${part((n >> 8) & 255)},${part(n & 255)})`;
    shadeCache.set(key, out);
    return out;
  }

  // ---------- Poses ----------

  const BASE = {
    hip: 0, lean: 0, head: 0, rot: 0,
    fThigh: 0.12, fShin: -0.05, bThigh: -0.12, bShin: -0.25,
    fArm: 0.2, fFore: 0.6, bArm: -0.1, bFore: 0.3,
    sab: 2.4,
  };
  const P = (o) => ({ ...BASE, ...o });
  const KEYS = Object.keys(BASE);
  const mix = (a, b, t) => {
    const out = {};
    for (const key of KEYS) out[key] = lerp(a[key], b[key], t);
    return out;
  };

  const GUARD = P({ hip: 2, lean: 0.08, fThigh: 0.34, fShin: -0.12, bThigh: -0.3, bShin: -0.62, fArm: 0.62, fFore: 1.45, bArm: 0.25, bFore: 1.0, sab: 2.35 });
  const SLASH = {
    s1a: P({ hip: 2, lean: -0.15, fThigh: 0.2, fShin: -0.3, bThigh: -0.2, bShin: -0.5, fArm: -1.0, fFore: -0.5, bArm: 0.1, bFore: 0.9, sab: -1.9 }),
    s1b: P({ hip: 3, lean: 0.34, fThigh: 0.6, fShin: 0.02, bThigh: -0.42, bShin: -0.8, fArm: 1.6, fFore: 1.75, bArm: -0.7, bFore: -0.2, sab: 1.28 }),
    s2a: P({ hip: 2, lean: 0.25, fThigh: 0.4, fShin: -0.1, bThigh: -0.36, bShin: -0.7, fArm: 0.8, fFore: 0.95, bArm: -0.4, bFore: 0, sab: 0.55 }),
    s2b: P({ hip: 1, lean: -0.1, fThigh: 0.5, fShin: 0.05, bThigh: -0.4, bShin: -0.7, fArm: 2.1, fFore: 2.5, bArm: -0.6, bFore: -0.1, sab: 3.2 }),
    s3a: P({ hip: 1, lean: -0.22, fThigh: 0.3, fShin: -0.3, bThigh: -0.3, bShin: -0.7, fArm: 2.8, fFore: 3.2, bArm: 2.6, bFore: 3.0, sab: 3.9 }),
    s3b: P({ hip: 5, lean: 0.5, fThigh: 0.8, fShin: 0.02, bThigh: -0.6, bShin: -1.0, fArm: 1.3, fFore: 1.5, bArm: 1.2, bFore: 1.4, sab: 1.2 }),
    airA: P({ fThigh: 0.9, fShin: -0.2, bThigh: 0.1, bShin: -0.9, fArm: 2.9, fFore: 3.2, bArm: 0.2, bFore: 0.5, sab: 3.8 }),
    airB: P({ lean: 0.4, fThigh: 0.6, fShin: 0.1, bThigh: -0.4, bShin: -0.9, fArm: 1.2, fFore: 1.3, bArm: -0.6, bFore: 0, sab: 0.9 }),
  };

  const poses = {
    idle: (t) => {
      const b = sin(t * 2.4);
      return { ...GUARD, hip: GUARD.hip + b * 0.6, fArm: GUARD.fArm + b * 0.02, sab: GUARD.sab + sin(t * 1.5) * 0.03 };
    },
    relaxed: (t) => P({ hip: sin(t * 2) * 0.4, fArm: 0.15, fFore: 0.3, bArm: -0.08, bFore: 0.2, sab: 0.45 }),
    run: (t) => {
      const c = t * 13;
      const s = sin(c);
      const lift = (phase) => 0.4 + 0.9 * clamp(sin(phase + 1.2), 0, 1);
      const fThigh = 0.82 * s;
      const bThigh = -0.82 * s;
      return P({
        hip: Math.abs(cos(c)) * -2 + 1.5, lean: 0.2,
        fThigh, fShin: fThigh - lift(c), bThigh, bShin: bThigh - lift(c + PI),
        fArm: -0.6 - bThigh * 0.2, fFore: -0.1, bArm: fThigh * 0.8, bFore: fThigh * 0.8 + 0.9,
        sab: -2.0 + s * 0.08,
      });
    },
    walk: (t) => {
      const s = sin(t * 7);
      return P({ hip: Math.abs(cos(t * 7)) * -1 + 1, fThigh: 0.45 * s, fShin: 0.45 * s - 0.3 - Math.max(0, -cos(t * 7)) * 0.4, bThigh: -0.45 * s, bShin: -0.45 * s - 0.3 - Math.max(0, cos(t * 7)) * 0.4, fArm: 0.15 - s * 0.3, fFore: 0.5 - s * 0.2, bArm: s * 0.3, bFore: s * 0.3 + 0.3, sab: 0.5 });
    },
    jump: () => P({ lean: 0.1, fThigh: 1.0, fShin: -0.1, bThigh: -0.25, bShin: -0.9, fArm: 1.5, fFore: 2.0, bArm: -0.9, bFore: -0.4, sab: 2.5 }),
    fall: () => P({ lean: -0.04, fThigh: 0.45, fShin: -0.4, bThigh: -0.35, bShin: -1.05, fArm: 2.1, fFore: 2.5, bArm: -1.5, bFore: -1.1, sab: 2.8 }),
    slash1: (t) => mix(SLASH.s1a, SLASH.s1b, ease.out(clamp(t * 1.5, 0, 1))),
    slash2: (t) => mix(SLASH.s2a, SLASH.s2b, ease.out(clamp(t * 1.5, 0, 1))),
    slash3: (t) => mix(SLASH.s3a, SLASH.s3b, ease.out(clamp(t * 1.5, 0, 1))),
    slash4: (t) => ({ ...mix(SLASH.s1a, SLASH.s1b, 0.75), rot: ease.inOut(clamp(t * 1.2, 0, 1)) * TAU, sab: 1.5 }),
    airslash: (t) => mix(SLASH.airA, SLASH.airB, ease.out(clamp(t * 1.5, 0, 1))),
    airspin: (t) => ({ ...P({ fThigh: 1.2, fShin: -0.4, bThigh: 0.9, bShin: -0.6, fArm: 1.5, fFore: 1.6, bArm: 0.9, bFore: 1.8, sab: 1.55 }), rot: t * TAU * 1.5 }),
    push: (t) => {
      const e = ease.out(clamp(t * 2.5, 0, 1));
      return mix(GUARD, P({ hip: 2, lean: 0.24, fThigh: 0.5, fShin: 0.04, bThigh: -0.4, bShin: -0.7, fArm: -0.6, fFore: -0.2, bArm: 1.55, bFore: 1.7, sab: -2.1 }), e);
    },
    deflect: (t) => ({ ...P({ hip: 4, lean: 0.06, fThigh: 0.45, fShin: -0.22, bThigh: -0.45, bShin: -0.9, fArm: 0.95, fFore: 2.2, bArm: 0.6, bFore: 1.6 }), sab: 2.92 + sin(t * 14) * 0.05 }),
    deflectHit: (t) => ({ ...P({ hip: 4, lean: -0.06, fThigh: 0.4, fShin: -0.25, bThigh: -0.45, bShin: -0.9, fArm: 1.25, fFore: 2.55, bArm: 0.6, bFore: 1.6 }), sab: 2.4 - t * 0.3 }),
    hurt: () => P({ hip: 1, lean: -0.42, head: -0.3, fThigh: 0.3, fShin: -0.3, bThigh: 0.1, bShin: -0.4, fArm: 1.0, fFore: 1.4, bArm: 1.2, bFore: 1.8, sab: 2.8 }),
    dead: (t) => ({ ...P({ hip: 6, lean: -0.2, head: -0.2, fThigh: 0.5, fShin: 0.2, bThigh: 0.3, bShin: -0.2, fArm: 1.8, fFore: 1.9, bArm: 2.2, bFore: 2.3, sab: 1.6 }), rot: -1.5 * ease.out(clamp(t * 2.4, 0, 1)) }),
    victory: (t) => {
      const e = ease.back(clamp(t * 1.8, 0, 1));
      return mix(GUARD, P({ fThigh: 0.2, fShin: -0.05, bThigh: -0.2, bShin: -0.3, fArm: 2.9, fFore: 3.1, bArm: -0.3, bFore: 0.2, sab: 3.14, head: -0.1 }), e);
    },
    bow: (t) => P({ hip: 2, lean: 0.25 + sin(t) * 0.02, head: 0.3, fArm: 0.5, fFore: 1.4, bArm: 0.3, bFore: 1.2, sab: 0.2 }),
    kneel: (t) => P({ hip: 15, lean: 0.25 + sin(t) * 0.02, head: 0.25, fThigh: 1.4, fShin: -0.1, bThigh: 0.1, bShin: -1.5, fArm: 0.5, fFore: 0.9, bArm: 0.2, bFore: 0.6, sab: 0.6 }),
    aim: (a = 0) => P({ hip: 1, lean: 0.03, fThigh: 0.25, fShin: -0.05, bThigh: -0.2, bShin: -0.4, fArm: 1.2 + a, fFore: 1.6 + a, bArm: 0.8 + a, bFore: 1.7 + a }),
    aimWalk: (t, a = 0) => {
      const w = poses.walk(t);
      return { ...w, fArm: 1.2 + a, fFore: 1.6 + a, bArm: 0.8 + a, bFore: 1.7 + a };
    },
    meleeUp: () => P({ lean: -0.2, fArm: 2.5, fFore: 2.9, bArm: 2.2, bFore: 2.7, fThigh: 0.3, bThigh: -0.3, bShin: -0.6, sab: 3.6 }),
    meleeDown: () => P({ lean: 0.36, hip: 3, fArm: 1.3, fFore: 1.5, bArm: 1.0, bFore: 1.3, fThigh: 0.5, fShin: 0.02, bThigh: -0.4, bShin: -0.8, sab: 1.2 }),
    cast: (t) => P({ hip: 1, lean: 0.1, fThigh: 0.25, fShin: -0.08, bThigh: -0.25, bShin: -0.5, fArm: 1.45 + sin(t * 40) * 0.04, fFore: 1.6, bArm: -0.3, bFore: 0.2, sab: 0.4 }),
    castUp: (t) => P({ hip: sin(t * 3) * 1, lean: -0.1, fArm: 2.5, fFore: 2.8, bArm: 2.4, bFore: 2.9, sab: 3.1, head: -0.15 }),
    choked: (t) => P({ lean: -0.05, head: -0.35, fThigh: 0.1 + sin(t * 18) * 0.2, fShin: -0.3, bThigh: -0.1 - sin(t * 18) * 0.2, bShin: -0.5, fArm: 2.4, fFore: -2.4, bArm: 2.2, bFore: -2.6, sab: 0 }),
    lunge: () => P({ hip: 5, lean: 0.55, fThigh: 0.95, fShin: 0.15, bThigh: -0.75, bShin: -1.1, fArm: 1.6, fFore: 1.6, bArm: -1.0, bFore: -0.6, sab: 1.58 }),
    ready: (t) => {
      const b = sin(t * 3);
      return P({ hip: 3 + b * 0.5, lean: 0.14, fThigh: 0.45, fShin: -0.1, bThigh: -0.4, bShin: -0.75, fArm: 1.1, fFore: 2.2, bArm: 0.4, bFore: 1.3, sab: 2.05 });
    },
    spin: (t) => P({ hip: 2, lean: 0.1, fThigh: 0.5, fShin: 0, bThigh: -0.4, bShin: -0.8, fArm: 1.4, fFore: 1.6, bArm: 1.1, bFore: 1.4, sab: t * 28 }),
    throw: (t) => mix(P({ fArm: -1.2, fFore: -0.6, lean: -0.2, sab: -2 }), P({ lean: 0.3, hip: 3, fArm: 1.6, fFore: 1.7, fThigh: 0.5, bThigh: -0.4, bShin: -0.8, sab: 1.6 }), ease.out(clamp(t * 2, 0, 1))),
  };

  const pose = (name, t, extra) => poses[name](t, extra);

  // ---------- The rig ----------

  const SIZE = { thigh: 15, shin: 15, torso: 22, arm: 12, fore: 12, neck: 11 };

  function joints(p) {
    const hipY = -30 + p.hip;
    const lean = p.lean;
    const neckX = sin(lean) * SIZE.torso;
    const neckY = hipY - cos(lean) * SIZE.torso;
    const headAngle = lean + p.head;
    const chain = (ox, oy, a, b, la, lb) => {
      const ex = ox + sin(a) * la;
      const ey = oy + cos(a) * la;
      return [ex, ey, ex + sin(b) * lb, ey + cos(b) * lb];
    };
    const f = chain(1.5, hipY, p.fThigh, p.fShin, SIZE.thigh, SIZE.shin);
    const b = chain(-1.5, hipY, p.bThigh, p.bShin, SIZE.thigh, SIZE.shin);
    const sx = neckX;
    const sy = neckY + 3;
    const fa = chain(sx + 1, sy, p.fArm, p.fFore, SIZE.arm, SIZE.fore);
    const ba = chain(sx - 1, sy, p.bArm, p.bFore, SIZE.arm, SIZE.fore);
    return {
      hipX: 0, hipY, neckX, neckY, sx, sy,
      headX: neckX + sin(headAngle) * SIZE.neck * 0.92,
      headY: neckY - cos(headAngle) * SIZE.neck * 0.92,
      fKx: f[0], fKy: f[1], fFx: f[2], fFy: f[3],
      bKx: b[0], bKy: b[1], bFx: b[2], bFy: b[3],
      fEx: fa[0], fEy: fa[1], fHx: fa[2], fHy: fa[3],
      bEx: ba[0], bEy: ba[1], bHx: ba[2], bHy: ba[3],
      lean,
    };
  }

  function limb(ctx, x0, y0, x1, y1, x2, y2, width, color) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = width + 2;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function foot(ctx, x, y, color, len = 8) {
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    J.U.roundRect(ctx, x - 3.2, y - 3.5, len, 5, 2);
    ctx.fill();
    ctx.stroke();
  }

  function torsoShape(ctx, j, topW, botW, topExtra = 0) {
    const nx = cos(j.lean);
    const ny = sin(j.lean);
    ctx.beginPath();
    ctx.moveTo(j.neckX - nx * topW, j.neckY + ny * topW + topExtra);
    ctx.lineTo(j.neckX + nx * topW, j.neckY - ny * topW + topExtra);
    ctx.lineTo(j.hipX + botW, j.hipY + 3);
    ctx.lineTo(j.hipX - botW, j.hipY + 3);
    ctx.closePath();
  }

  function fillOutlined(ctx, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  }

  function skirt(ctx, j, length, color, spread, sway) {
    const hx = j.hipX;
    const hy = j.hipY - 1;
    const mid = (j.fKx + j.bKx) / 2;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy);
    ctx.lineTo(hx + 8, hy);
    ctx.quadraticCurveTo(hx + 8 + spread * 0.4, hy + length * 0.6, mid + spread + sway, hy + length);
    ctx.lineTo(mid - spread + sway * 1.3, hy + length);
    ctx.quadraticCurveTo(hx - 8 - spread * 0.4, hy + length * 0.6, hx - 8, hy);
    ctx.closePath();
    fillOutlined(ctx, color);
  }

  function cape(ctx, j, length, color, wave, width = 9) {
    const x = j.sx - 4;
    const y = j.sy - 2;
    const swing = wave;
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 2);
    ctx.quadraticCurveTo(x - 10 - swing * 8, y + length * 0.5, x - 6 - swing * 26 - width, y + length - Math.abs(swing) * 10);
    ctx.lineTo(x + 6 - swing * 20, y + length - Math.abs(swing) * 6 + sin(wave * 9) * 2);
    ctx.quadraticCurveTo(x + 8 - swing * 6, y + length * 0.5, x + 8, y);
    ctx.closePath();
    fillOutlined(ctx, color);
  }

  // Draws a posed humanoid at the origin, feet at y=0, facing +x.
  function drawRig(ctx, p, skin, ext = {}) {
    const j = joints(p);
    const t = ext.t || 0;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (p.rot) {
      ctx.translate(0, j.hipY);
      ctx.rotate(p.rot);
      ctx.translate(0, -j.hipY);
    }
    if (skin.behind) skin.behind(ctx, j, ext);
    const armW = skin.armW || 5;
    const legW = skin.legW || 6;

    if (ext.backProp) ext.backProp(ctx, j, t);
    limb(ctx, j.sx - 1, j.sy, j.bEx, j.bEy, j.bHx, j.bHy, armW, shade(skin.sleeve, -0.28));
    if (skin.glove) {
      ctx.fillStyle = shade(skin.glove, -0.2);
      ctx.beginPath();
      ctx.arc(j.bHx, j.bHy, armW * 0.55, 0, TAU);
      ctx.fill();
    }
    limb(ctx, -1.5, j.hipY, j.bKx, j.bKy, j.bFx, j.bFy, legW, shade(skin.leg, -0.28));
    if (skin.boot) limb(ctx, lerp(j.bKx, j.bFx, 0.4), lerp(j.bKy, j.bFy, 0.4), lerp(j.bKx, j.bFx, 0.7), lerp(j.bKy, j.bFy, 0.7), j.bFx, j.bFy, legW + 0.4, shade(skin.boot, -0.22));
    foot(ctx, j.bFx, j.bFy, shade(skin.boot || skin.leg, -0.22), skin.footLen);

    limb(ctx, 1.5, j.hipY, j.fKx, j.fKy, j.fFx, j.fFy, legW, skin.leg);
    if (skin.boot) limb(ctx, lerp(j.fKx, j.fFx, 0.4), lerp(j.fKy, j.fFy, 0.4), lerp(j.fKx, j.fFx, 0.7), lerp(j.fKy, j.fFy, 0.7), j.fFx, j.fFy, legW + 0.4, skin.boot);
    foot(ctx, j.fFx, j.fFy, skin.boot || skin.leg, skin.footLen);
    if (skin.legDetail) skin.legDetail(ctx, j);

    skin.torso(ctx, j, ext);
    ctx.save();
    ctx.translate(j.headX, j.headY);
    ctx.rotate(j.lean + p.head);
    skin.head(ctx, ext);
    ctx.restore();

    if (ext.prop) ext.prop(ctx, j, t, p);
    limb(ctx, j.sx + 1, j.sy, j.fEx, j.fEy, j.fHx, j.fHy, armW, skin.sleeve);
    if (skin.shoulder) skin.shoulder(ctx, j);
    if (skin.glove) {
      ctx.fillStyle = skin.glove;
      ctx.beginPath();
      ctx.arc(j.fHx, j.fHy, armW * 0.55, 0, TAU);
      ctx.fill();
    }
    if (ext.handProp) ext.handProp(ctx, j, t, p);
  }

  // ---------- Heads ----------

  function eye(ctx, x, y, w, h, color = "#14161c", shine = true) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, TAU);
    ctx.fill();
    if (shine) {
      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.beginPath();
      ctx.arc(x + w * 0.3, y - h * 0.3, Math.min(w, h) * 0.35, 0, TAU);
      ctx.fill();
    }
  }

  function headBall(ctx, color, r = 9) {
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,.12)";
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.6, PI * 0.5, PI * 1.5);
    ctx.fill();
  }

  function face(ctx, skin, opts = {}) {
    eye(ctx, 3.6, -1, 1.5, 1.8, opts.eyeColor);
    eye(ctx, 7.2, -1, 1.15, 1.7, opts.eyeColor);
    ctx.strokeStyle = shade(skin, -0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, -3.6);
    ctx.lineTo(5.2, -4);
    ctx.moveTo(6.2, -4);
    ctx.lineTo(8.2, -3.6);
    ctx.moveTo(4, 4.4);
    ctx.quadraticCurveTo(6, 5, 7.6, 4.2);
    ctx.stroke();
  }

  // Lekku sway with the body; the swing value comes from the Jedi's movement.
  function tendril(ctx, x, y, cx, cy, ex, ey, width, color, stripe) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = width + 1.6;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    if (stripe) {
      ctx.setLineDash([2.2, 3]);
      ctx.strokeStyle = stripe;
      ctx.lineWidth = width * 0.8;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const HEADS = {
    human(ctx, skin, j, hair) {
      if (j.pattern === 2) {
        ctx.fillStyle = shade(hair, -0.15);
        ctx.beginPath();
        ctx.moveTo(-3, -9);
        ctx.quadraticCurveTo(-15, 0, -11, 15);
        ctx.lineTo(-2, 11);
        ctx.closePath();
        ctx.fill();
      }
      headBall(ctx, skin);
      face(ctx, skin);
      if (j.pattern === 3) {
        ctx.fillStyle = hair;
        ctx.beginPath();
        ctx.moveTo(-1, 3.5);
        ctx.quadraticCurveTo(3, 6, 9, 3.2);
        ctx.quadraticCurveTo(8, 11, 2.5, 10.5);
        ctx.quadraticCurveTo(-1, 9, -1, 3.5);
        ctx.fill();
        ctx.fillStyle = shade(skin, -0.3);
        ctx.beginPath();
        ctx.arc(-1, -3, 8.2, PI * 0.9, PI * 1.5);
        ctx.lineTo(-1, -3);
        ctx.fill();
        return;
      }
      ctx.fillStyle = hair;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8.5, -4);
      ctx.quadraticCurveTo(5, -11.5, -2, -10.2);
      ctx.quadraticCurveTo(-11.2, -8, -9.6, 3.5);
      ctx.quadraticCurveTo(-6, 4.2, -4.6, -0.5);
      ctx.quadraticCurveTo(1, -6.5, 8.5, -4);
      ctx.fill();
      ctx.stroke();
      if (j.pattern === 1) tendril(ctx, -6, 1, -9, 8, -5, 16, 1.8, hair, "#d9cdb4");
    },
    twilek(ctx, skin, j, hair, swing) {
      const stripe = j.pattern === 1 ? shade(skin, -0.45) : j.pattern === 2 ? shade(skin, 0.5) : null;
      tendril(ctx, -5, -3, -17 - swing * 7, 7, -13 - swing * 13, 25 - Math.abs(swing) * 5, 5, shade(skin, -0.12), stripe);
      headBall(ctx, skin);
      tendril(ctx, -3, -5, -13 - swing * 5, 3, -7 - swing * 9, 20 - Math.abs(swing) * 3, 5.4, skin, stripe);
      face(ctx, skin);
      ctx.fillStyle = shade(skin, 0.14);
      ctx.beginPath();
      ctx.ellipse(-1, -7, 5, 2, 0.1, 0, TAU);
      ctx.fill();
    },
    togruta(ctx, skin, j) {
      const tint = [["#ffffff", "#2d63b5"], ["#fafafa", "#c9c9d6"], ["#d7d7d7", "#23252e"]][j.pattern];
      const montral = (x, cx, tipX, tipY, w) => {
        tendril(ctx, x, -6, cx, -20, tipX, tipY, w, tint[0], tint[1]);
      };
      montral(-5, -6, -13, -22, 5);
      tendril(ctx, -6, 1, -14, 8, -11, 21, 5, tint[0], tint[1]);
      headBall(ctx, skin);
      montral(3, 2, -4, -25, 5.4);
      tendril(ctx, 2, 3, -1, 11, 3, 19, 4.6, tint[0], tint[1]);
      ctx.fillStyle = "#fafaf4";
      ctx.beginPath();
      ctx.moveTo(1, -8);
      ctx.quadraticCurveTo(5, -3.6, 9, -7);
      ctx.quadraticCurveTo(6, -1.6, 8.6, 2);
      ctx.lineTo(2, 2);
      ctx.closePath();
      ctx.fill();
      face(ctx, skin);
    },
    zabrak(ctx, skin, j) {
      headBall(ctx, skin);
      face(ctx, skin);
      if (j.pattern === 1) {
        ctx.strokeStyle = "rgba(16,16,22,.82)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (const [a, b, c, d] of [[1, -6, 3, 1], [5, -6.5, 5.6, 1], [8.2, -5, 7.4, 1], [-2, -6, -1, 3], [5, 2, 6, 8]]) {
          ctx.moveTo(a, b);
          ctx.lineTo(c, d);
        }
        ctx.stroke();
      } else if (j.pattern === 2) {
        ctx.strokeStyle = "rgba(186,30,34,.85)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(1, -1, 6.6, PI * 1.1, PI * 1.9);
        ctx.stroke();
      }
      ctx.fillStyle = "#eee0c8";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.8;
      for (const [x, y, a] of [[-5, -8, -0.6], [-1.6, -9.4, -0.2], [2.2, -9.4, 0.15], [5.6, -7.8, 0.5], [-8, -4.6, -1.1]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(-1.8, 0.8);
        ctx.lineTo(0, -4.6);
        ctx.lineTo(1.8, 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    },
    rodian(ctx, skin, j) {
      const eyeColor = ["#101018", "#4c2a8a", "#b0700e"][j.pattern];
      ctx.strokeStyle = shade(skin, -0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-3, -8);
      ctx.quadraticCurveTo(-5, -15, -10, -17);
      ctx.moveTo(1, -9);
      ctx.quadraticCurveTo(1, -15, -3, -19);
      ctx.stroke();
      ctx.fillStyle = shade(skin, -0.18);
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-16, -7);
      ctx.lineTo(-7, 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(5, 1);
      ctx.quadraticCurveTo(15, 2, 14.5, 6);
      ctx.quadraticCurveTo(10, 9.5, 2, 8.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      headBall(ctx, skin);
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.ellipse(4.6, -2.2, 5, 5.6, 0.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.28)";
      ctx.beginPath();
      ctx.ellipse(3.4, -4.4, 2.2, 1.5, -0.4, 0, TAU);
      ctx.fill();
    },
    mirialan(ctx, skin, j, hair) {
      ctx.fillStyle = shade(hair, -0.2);
      ctx.beginPath();
      ctx.moveTo(4, -9.4);
      ctx.quadraticCurveTo(-13, -10, -11, 10);
      ctx.lineTo(-3, 7);
      ctx.closePath();
      ctx.fill();
      headBall(ctx, skin);
      face(ctx, skin);
      ctx.fillStyle = hair;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8.8, -4);
      ctx.quadraticCurveTo(4, -11.4, -3, -9.8);
      ctx.quadraticCurveTo(-10, -7, -9.4, 2);
      ctx.quadraticCurveTo(-3, -5.6, 8.8, -4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1c1d2b";
      if (j.pattern === 0) {
        for (let i = 0; i < 4; i++) {
          const x = 1.6 + i * 2.1;
          ctx.beginPath();
          ctx.moveTo(x, 5.6);
          ctx.lineTo(x + 1, 6.8);
          ctx.lineTo(x, 8);
          ctx.lineTo(x - 1, 6.8);
          ctx.closePath();
          ctx.fill();
        }
      } else if (j.pattern === 1) {
        ctx.fillRect(2.8, 5.6, 1.1, 2.8);
        ctx.fillRect(5, 5.6, 1.1, 3);
        ctx.fillRect(7.1, 5.4, 1.1, 2.4);
      } else {
        ctx.fillRect(1.4, 1.2, 3.2, 1);
        ctx.fillRect(1.4, 2.9, 2.4, 1);
      }
    },
    nautolan(ctx, skin, j, hair, swing) {
      const band = j.pattern === 1 ? shade(skin, -0.42) : null;
      const tip = j.pattern === 2 ? shade(skin, 0.5) : null;
      const strands = [[-8, -4, -21, 8, -21, 21], [-6, 0, -17, 12, -15, 25], [-3, 3, -10, 15, -8, 25]];
      strands.forEach(([x, y, cx, cy, ex, ey], i) => {
        tendril(ctx, x, y, cx - swing * 7, cy, ex - swing * 13, ey - Math.abs(swing) * 5, 3.8, shade(skin, -0.18 + i * 0.03), band);
      });
      headBall(ctx, skin);
      const front = [[-6, -6, -18, -2, -15, 14], [-3, -8, -14, -9, -10, 19], [1, -8, -8, -2, -2, 17]];
      front.forEach(([x, y, cx, cy, ex, ey]) => {
        tendril(ctx, x, y, cx - swing * 6, cy, ex - swing * 10, ey, 4, skin, band);
        if (tip) {
          ctx.fillStyle = tip;
          ctx.beginPath();
          ctx.arc(ex - swing * 10, ey, 2.2, 0, TAU);
          ctx.fill();
        }
      });
      ctx.fillStyle = "#07080c";
      ctx.beginPath();
      ctx.ellipse(4.6, -1.8, 2.9, 2.6, 0, 0, TAU);
      ctx.ellipse(8.2, -1.8, 1.7, 2.3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = shade(skin, -0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(3.8, 4.6);
      ctx.quadraticCurveTo(6.2, 5.6, 8, 4.4);
      ctx.stroke();
    },
    keldor(ctx, skin, j) {
      const metal = ["#7c8692", "#a08643", "#2c2e36"][j.pattern];
      headBall(ctx, skin);
      ctx.fillStyle = shade(skin, -0.25);
      for (const a of [-1.7, -1.1, -0.5, -2.3, -2.9]) {
        ctx.beginPath();
        ctx.moveTo(cos(a) * 8, sin(a) * 8);
        ctx.lineTo(cos(a + 0.2) * 12.2, sin(a + 0.2) * 12.2);
        ctx.lineTo(cos(a + 0.4) * 8, sin(a + 0.4) * 8);
        ctx.fill();
      }
      ctx.fillStyle = "#10121a";
      ctx.strokeStyle = metal;
      ctx.lineWidth = 1.3;
      for (const [x, w] of [[3.4, 3.4], [8.2, 2.3]]) {
        ctx.beginPath();
        ctx.ellipse(x, -2.4, w, 3, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = metal;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-3, 1.6);
      ctx.lineTo(10, 1.6);
      ctx.lineTo(9.2, 8.4);
      ctx.lineTo(2, 11);
      ctx.lineTo(-3, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(2 + i * 2.2, 3);
        ctx.lineTo(2 + i * 2.2, 8.6);
      }
      ctx.stroke();
    },
    pantoran(ctx, skin, j, hair) {
      headBall(ctx, skin);
      face(ctx, skin, { eyeColor: "#d6a43a" });
      const mark = j.pattern === 2 ? "#dfe6ee" : "#e7c04e";
      ctx.strokeStyle = mark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (j.pattern === 0) {
        ctx.moveTo(2, -6.6);
        ctx.lineTo(5.4, -5.2);
        ctx.lineTo(8.6, -6.6);
        ctx.moveTo(2.4, 7);
        ctx.lineTo(5.4, 8.2);
        ctx.lineTo(8, 6.6);
      } else if (j.pattern === 1) {
        ctx.moveTo(3, 6);
        ctx.lineTo(3, 8.6);
        ctx.moveTo(5.4, 6);
        ctx.lineTo(5.4, 8.8);
        ctx.moveTo(7.6, 5.6);
        ctx.lineTo(7.6, 8);
      } else {
        ctx.moveTo(1.4, 2);
        ctx.lineTo(5, 2.6);
        ctx.moveTo(1.4, 4);
        ctx.lineTo(4, 4.4);
      }
      ctx.stroke();
      ctx.fillStyle = hair;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8.2, -5.6);
      ctx.quadraticCurveTo(3, -11.8, -4, -9.6);
      ctx.quadraticCurveTo(-12, -6, -10, 7);
      ctx.quadraticCurveTo(-6, 7.6, -5, 1);
      ctx.quadraticCurveTo(0, -5.6, 8.2, -5.6);
      ctx.fill();
      ctx.stroke();
    },
    miraluka(ctx, skin, j, hair) {
      headBall(ctx, skin);
      const wrap = ["#d6cbb4", "#2b2c36", "#c9a24a"][j.pattern];
      ctx.fillStyle = wrap;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(9, -5.4);
      ctx.lineTo(-9, -4);
      ctx.lineTo(-9, 2);
      ctx.lineTo(9.3, 1.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      tendril(ctx, -8, -1, -14, 3, -14, 11, 2.4, wrap);
      ctx.strokeStyle = shade(skin, -0.5);
      ctx.beginPath();
      ctx.moveTo(4, 5);
      ctx.quadraticCurveTo(6, 5.6, 7.6, 4.6);
      ctx.stroke();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(7.4, -6.2);
      ctx.quadraticCurveTo(0, -11.6, -7, -7.6);
      ctx.quadraticCurveTo(-10, -5, -9.2, -3.8);
      ctx.closePath();
      ctx.fill();
    },
  };

  // ---------- The Jedi ----------

  const { SPECIES, OUTFITS, PALETTES, HAIR } = J.JediCustomization;

  function hood(ctx, color, up = true) {
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(9.4, -5);
      ctx.quadraticCurveTo(7, -14, -3, -12.6);
      ctx.quadraticCurveTo(-14, -9, -11, 8);
      ctx.lineTo(-3, 9);
      ctx.quadraticCurveTo(-5, -5, 9.4, -5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function jediSkin(jedi) {
    const species = SPECIES[jedi.species];
    const skinTone = species.skins[jedi.skin][1];
    const pal = PALETTES[jedi.palette];
    const outfit = OUTFITS[jedi.outfit].id;
    const hair = HAIR[jedi.hair][1];
    const drawHead = HEADS[species.id];
    const longRobe = outfit === "consular";
    const hasCloak = outfit === "knight" || outfit === "shadow" || outfit === "consular";

    return {
      sleeve: pal.tunic,
      leg: pal.pants,
      boot: pal.boots,
      glove: skinTone,
      behind(ctx, j, ext) {
        if (hasCloak) cape(ctx, j, longRobe ? 47 : 42, pal.cloak, ext.capeSwing || 0, 10);
      },
      torso(ctx, j, ext) {
        const sway = -(ext.capeSwing || 0) * 7;
        if (longRobe) skirt(ctx, j, 27, pal.tunic, 11, sway);
        else skirt(ctx, j, 13, pal.tunic, 9, sway);
        torsoShape(ctx, j, 8.5, 7);
        fillOutlined(ctx, pal.tunic);
        // Crossed tabard over the tunic.
        ctx.strokeStyle = pal.tabard;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(j.neckX + 4.2, j.neckY + 1);
        ctx.lineTo(j.hipX - 2, j.hipY + 2);
        ctx.moveTo(j.neckX - 4.2, j.neckY + 1);
        ctx.lineTo(j.hipX + 2, j.hipY + 2);
        ctx.stroke();
        ctx.fillStyle = pal.tabard;
        ctx.beginPath();
        ctx.moveTo(j.hipX + 4, j.hipY);
        ctx.lineTo(j.hipX - 4, j.hipY);
        ctx.lineTo(j.hipX - 3 + sway * 0.6, j.hipY + (longRobe ? 24 : 13));
        ctx.lineTo(j.hipX + 3 + sway * 0.6, j.hipY + (longRobe ? 24 : 13));
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.belt;
        ctx.save();
        ctx.translate(j.hipX, j.hipY - 1);
        ctx.rotate(j.lean * 0.4);
        ctx.fillRect(-8, -2, 16, 4.2);
        ctx.fillStyle = "#c9a24a";
        ctx.fillRect(3.5, -1.6, 3, 3.4);
        ctx.restore();
        if (outfit === "guardian") {
          ctx.fillStyle = "#7f8a96";
          torsoShape(ctx, j, 6, 5, 2);
          ctx.fill();
          ctx.fillStyle = pal.tabard;
          ctx.fillRect(j.neckX - 1.6, j.neckY + 3, 3.2, 13);
        }
      },
      shoulder(ctx, j) {
        if (outfit !== "guardian") return;
        ctx.fillStyle = "#9aa6b2";
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(j.sx + 1, j.sy - 0.5, 6.5, 4.6, 0.3, 0, TAU);
        ctx.fill();
        ctx.stroke();
      },
      head(ctx, ext) {
        drawHead(ctx, skinTone, jedi, hair, ext.capeSwing || 0, ext.t || 0);
        if (outfit === "shadow" && species.id !== "togruta" && species.id !== "rodian") hood(ctx, shade(pal.cloak, -0.1));
      },
    };
  }

  // ---------- Generic skins for enemies ----------

  // Plain armored soldier. Colors and the helmet change per type.
  function trooperSkin(o) {
    return {
      sleeve: o.armor,
      leg: o.armor,
      boot: o.boot || o.armor,
      glove: o.glove || "#22242a",
      armW: o.armW || 5,
      legW: o.legW || 6,
      torso(ctx, j) {
        if (o.skirt) skirt(ctx, j, 15, o.skirt, 9, 0);
        torsoShape(ctx, j, o.chestW || 8, 6.5);
        fillOutlined(ctx, o.armor);
        ctx.fillStyle = o.under || "#1a1c22";
        ctx.fillRect(j.neckX - 2.6, j.neckY + 4, 8, 3);
        ctx.fillRect(j.neckX * 0.6 - 3, j.neckY + 10, 10, 2.2);
        ctx.fillStyle = "#30323a";
        ctx.fillRect(j.hipX - 7.5, j.hipY - 2.4, 15, 3.8);
        if (o.pad) {
          ctx.fillStyle = o.pad;
          ctx.beginPath();
          ctx.ellipse(j.sx, j.sy, 6.5, 4.4, 0.2, 0, TAU);
          ctx.fill();
        }
        if (o.pack) {
          ctx.fillStyle = o.pack;
          ctx.fillRect(j.neckX - 13, j.neckY + 2, 6, 16);
        }
      },
      legDetail(ctx, j) {
        ctx.strokeStyle = o.under || "#1a1c22";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(j.fKx - 3, j.fKy);
        ctx.lineTo(j.fKx + 3, j.fKy);
        ctx.stroke();
      },
      head(ctx) { o.helmet(ctx, o); },
    };
  }

  const helmets = {
    storm(ctx, o) {
      headBall(ctx, o.armor, 9.6);
      ctx.fillStyle = o.under || "#14161c";
      ctx.beginPath();
      ctx.moveTo(1, -3.6);
      ctx.lineTo(9.6, -3);
      ctx.lineTo(9.2, 0.6);
      ctx.lineTo(4.4, 1);
      ctx.lineTo(2.4, 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(o.armor, -0.12);
      ctx.beginPath();
      ctx.moveTo(1, 2.4);
      ctx.lineTo(10, 2.4);
      ctx.lineTo(8.6, 9);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#14161c";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(5.2 + i, 4);
        ctx.lineTo(5 + i * 0.9, 8);
      }
      ctx.moveTo(-9.4, 1);
      ctx.lineTo(0, 2.2);
      ctx.stroke();
      ctx.fillStyle = "#6c7480";
      ctx.fillRect(-2.6, 2.4, 3, 3);
    },
    scout(ctx, o) {
      headBall(ctx, o.armor, 9.2);
      ctx.fillStyle = "#16181e";
      ctx.fillRect(1.4, -3.2, 8.2, 3.6);
      ctx.fillStyle = o.armor;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-2, 1);
      ctx.lineTo(12.6, 1.4);
      ctx.lineTo(9.6, 7);
      ctx.lineTo(-2, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2a2d34";
      ctx.fillRect(-9.8, -5.6, 4, 7);
    },
    snow(ctx, o) {
      helmets.storm(ctx, o);
      ctx.fillStyle = shade(o.armor, -0.1);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(6, -9);
      ctx.quadraticCurveTo(-12, -14, -13, 10);
      ctx.lineTo(-3, 11);
      ctx.quadraticCurveTo(-5, -3, 3, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#58d0ff";
      ctx.fillRect(2.4, -3.2, 7.2, 3);
    },
    sith(ctx, o) {
      headBall(ctx, o.armor, 9.6);
      ctx.fillStyle = "#16080a";
      ctx.beginPath();
      ctx.moveTo(1, -4.4);
      ctx.lineTo(9.6, -3.6);
      ctx.lineTo(9.8, -0.4);
      ctx.lineTo(1.6, 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#16080a";
      ctx.fillRect(3, 3, 6.6, 5);
      ctx.fillStyle = shade(o.armor, 0.2);
      ctx.beginPath();
      ctx.moveTo(-1, -10);
      ctx.lineTo(1, -13);
      ctx.lineTo(3, -9.4);
      ctx.closePath();
      ctx.fill();
    },
    officer(ctx, o) {
      headBall(ctx, o.armor, 9.4);
      ctx.fillStyle = "#101216";
      ctx.fillRect(1.4, -3.6, 8.2, 3.2);
      ctx.fillStyle = o.visor || "#d84a3a";
      ctx.fillRect(3, -2.8, 5.8, 1.6);
      ctx.fillStyle = shade(o.armor, -0.2);
      ctx.fillRect(1, 2.2, 8.6, 6.4);
    },
    merc(ctx, o) {
      headBall(ctx, "#c49a78", 9);
      ctx.fillStyle = o.armor;
      ctx.beginPath();
      ctx.arc(0, -2, 9.8, PI, TAU);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2c1e18";
      ctx.fillRect(1, 2, 9, 7);
      ctx.fillStyle = o.visor || "#ffb648";
      ctx.fillRect(2, -1.6, 7.6, 2.4);
    },
    b1(ctx) {
      ctx.fillStyle = "#c7b184";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-7, -4);
      ctx.quadraticCurveTo(-1, -9, 5, -3);
      ctx.lineTo(16, 1);
      ctx.quadraticCurveTo(17, 3.4, 13, 3.2);
      ctx.lineTo(1, 4);
      ctx.quadraticCurveTo(-6, 5, -7, -4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#3a3320";
      ctx.beginPath();
      ctx.arc(2.4, -2, 1.9, 0, TAU);
      ctx.fill();
    },
    b2(ctx) {
      ctx.fillStyle = "#5e6c80";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      J.U.roundRect(ctx, -5, -5, 11, 8, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff5040";
      ctx.fillRect(2, -2.6, 3.6, 2);
    },
    tallDroid(ctx, o) {
      headBall(ctx, o.armor, 7.6);
      ctx.fillStyle = o.visor || "#e6ecf5";
      ctx.beginPath();
      ctx.ellipse(2.4, -1.6, 2, 2.6, 0, 0, TAU);
      ctx.ellipse(6, -1.6, 1.4, 2.4, 0, 0, TAU);
      ctx.fill();
    },
    assassin(ctx) {
      ctx.fillStyle = "#3a3f49";
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1;
      J.U.roundRect(ctx, -5, -13, 10, 21, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ff3a2a";
      for (let i = 0; i < 3; i++) ctx.fillRect(2.4, -10 + i * 5, 2.4, 2.4);
      ctx.fillStyle = "#6a7180";
      ctx.fillRect(-6, 4, 12, 2);
    },
    cowl(ctx, o) {
      headBall(ctx, "#13131a", 8.4);
      hood(ctx, o.armor);
      ctx.fillStyle = o.visor || "#ff4a3a";
      ctx.beginPath();
      ctx.arc(4.6, -1.2, 1.3, 0, TAU);
      ctx.arc(7.6, -1.2, 1, 0, TAU);
      ctx.fill();
    },
    royal(ctx, o) {
      ctx.fillStyle = o.armor;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.quadraticCurveTo(-13, -13, 0, -15);
      ctx.quadraticCurveTo(12, -13, 10.5, -2);
      ctx.lineTo(8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0d0d11";
      ctx.fillRect(3, -3.4, 7, 2.2);
      ctx.fillStyle = shade(o.armor, 0.2);
      ctx.fillRect(-1, -14, 2, 14);
    },
  };

  const robedSkin = (o) => ({
    ...trooperSkin(o),
    torso(ctx, j) {
      skirt(ctx, j, 28, shade(o.armor, -0.1), 11, 0);
      torsoShape(ctx, j, 9, 8);
      fillOutlined(ctx, o.armor);
      ctx.fillStyle = shade(o.armor, -0.3);
      ctx.fillRect(j.hipX - 8, j.hipY - 2, 16, 3);
    },
  });

  // Blaster prop drawn along the aiming forearm.
  function rifle(ctx, j, heavy) {
    const a = Math.atan2(j.fHy - j.fEy, j.fHx - j.fEx);
    ctx.save();
    ctx.translate(j.fHx, j.fHy);
    ctx.rotate(a);
    ctx.fillStyle = "#1b1d22";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.8;
    if (heavy) {
      ctx.fillRect(-14, -3.4, 30, 6.8);
      ctx.fillStyle = "#3a3e46";
      ctx.fillRect(16, -2, 8, 4);
      ctx.fillRect(-4, 3, 6, 5);
    } else {
      ctx.fillRect(-10, -2, 22, 4);
      ctx.fillStyle = "#3a3e46";
      ctx.fillRect(10, -1.2, 9, 2.4);
      ctx.fillRect(-3, -4, 8, 2);
    }
    ctx.restore();
  }

  function staff(ctx, j, t, color) {
    const a = Math.atan2(j.fHy - j.fEy, j.fHx - j.fEx) - 1.3;
    ctx.save();
    ctx.translate(j.fHx, j.fHy);
    ctx.rotate(a);
    ctx.strokeStyle = "#20222a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.4 + sin(t * 30);
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(44, 0);
    ctx.moveTo(-26, 0);
    ctx.lineTo(-38, 0);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  const SKINS = {
    storm: trooperSkin({ armor: "#e9ecf0", helmet: helmets.storm, under: "#22242c" }),
    scout: trooperSkin({ armor: "#dfe3e6", under: "#23262d", boot: "#20232a", helmet: helmets.scout }),
    snow: trooperSkin({ armor: "#dbe6ee", under: "#55708a", skirt: "#c6d4de", pack: "#a9bac8", helmet: helmets.snow }),
    sand: trooperSkin({ armor: "#e4d7bb", under: "#3c3226", pad: "#d0752b", pack: "#8f7f62", helmet: helmets.storm }),
    heavy: trooperSkin({ armor: "#8a919c", under: "#1f2228", chestW: 10.5, pad: "#59616c", armW: 6.5, legW: 7.5, helmet: helmets.officer, visor: "#ffb648" }),
    imperial: trooperSkin({ armor: "#3e434d", under: "#14161b", helmet: helmets.storm }),
    sithtrooper: trooperSkin({ armor: "#b0241f", under: "#190808", helmet: helmets.sith, boot: "#6e1412" }),
    merc: trooperSkin({ armor: "#7a5c3a", under: "#2c2018", pad: "#a8452e", boot: "#2c2018", skirt: "#5b4228", helmet: helmets.merc }),
    b1: trooperSkin({ armor: "#c7b184", under: "#7d6a43", armW: 3, legW: 3.4, chestW: 5.5, helmet: helmets.b1, glove: "#7d6a43" }),
    b1red: trooperSkin({ armor: "#3a404c", under: "#b0241f", armW: 3, legW: 3.4, chestW: 5.5, helmet: helmets.b1, glove: "#20242c" }),
    b2: trooperSkin({ armor: "#5e6c80", under: "#384355", armW: 7.4, legW: 6.4, chestW: 11.5, helmet: helmets.b2 }),
    security: trooperSkin({ armor: "#2c2f38", under: "#16181e", armW: 3.8, legW: 4.2, chestW: 7.5, helmet: helmets.tallDroid, visor: "#e6ecf5" }),
    darktrooper: trooperSkin({ armor: "#23262e", under: "#ff5a3a", armW: 6.6, legW: 7, chestW: 10.5, helmet: helmets.tallDroid, visor: "#ff5a3a" }),
    assassin: trooperSkin({ armor: "#3a3f49", under: "#1c1f26", armW: 3.6, legW: 3.8, chestW: 6, helmet: helmets.assassin }),
    sithguard: robedSkin({ armor: "#37131a", under: "#1a0a0e", helmet: helmets.cowl, visor: "#ff4a3a" }),
    royal: robedSkin({ armor: "#b81f24", under: "#7c1216", helmet: helmets.royal }),
    elite: robedSkin({ armor: "#1b1b22", under: "#b81f24", helmet: helmets.royal }),
    cultist: robedSkin({ armor: "#26242e", under: "#111016", helmet: helmets.cowl, visor: "#6ef0ff" }),
  };

  // ---------- Bosses and story characters ----------

  function maulHead(ctx) {
    headBall(ctx, "#c8201e");
    ctx.fillStyle = "#101014";
    ctx.beginPath();
    ctx.moveTo(1, -8.6);
    ctx.lineTo(9.2, -3.8);
    ctx.lineTo(5.4, -2.6);
    ctx.lineTo(3.2, -3.6);
    ctx.lineTo(1, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(4, 1, 5, 2);
    ctx.fillRect(2, 3.6, 2, 4.6);
    ctx.fillRect(6.4, 4.2, 2, 4.6);
    ctx.fillRect(-6, -6, 2, 8);
    ctx.fillRect(-2, -7, 1.6, 7);
    eye(ctx, 4.6, -1, 1.5, 1.4, "#ffc531", false);
    eye(ctx, 7.4, -1, 1.1, 1.3, "#ffc531", false);
    ctx.fillStyle = "#e3d4b6";
    for (const [x, y, a] of [[-5, -8, -0.6], [-1.5, -9.6, -0.2], [2.4, -9.4, 0.15], [5.6, -7.4, 0.5], [-8, -4.5, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-1.5, 1);
      ctx.lineTo(0, -4.2);
      ctx.lineTo(1.5, 1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function dookuHead(ctx) {
    headBall(ctx, "#e4bda0");
    ctx.fillStyle = "#e8e8ec";
    ctx.beginPath();
    ctx.moveTo(8.4, -5);
    ctx.quadraticCurveTo(3, -11, -4, -9.6);
    ctx.quadraticCurveTo(-11, -6, -9, 4);
    ctx.quadraticCurveTo(-5, 1, -4, -2);
    ctx.quadraticCurveTo(1, -6, 8.4, -5);
    ctx.fill();
    face(ctx, "#e4bda0");
    ctx.fillStyle = "#e8e8ec";
    ctx.beginPath();
    ctx.moveTo(1, 3);
    ctx.quadraticCurveTo(5, 5.4, 9, 3);
    ctx.quadraticCurveTo(8, 12, 5, 14);
    ctx.quadraticCurveTo(1, 10, 1, 3);
    ctx.fill();
  }

  function ventressHead(ctx) {
    headBall(ctx, "#e7e4ea");
    face(ctx, "#b8b4c4", { eyeColor: "#7fb0e0" });
    ctx.strokeStyle = "#47314d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.quadraticCurveTo(-2, -8, 7, -6.2);
    ctx.moveTo(-8, 1);
    ctx.quadraticCurveTo(-3, -3, 1.6, -4);
    ctx.moveTo(-6.4, 5);
    ctx.quadraticCurveTo(-3, 1, 0.4, -1);
    ctx.stroke();
  }

  function vaderHead(ctx) {
    ctx.fillStyle = "#0e0f14";
    ctx.strokeStyle = "#2c2f3a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.quadraticCurveTo(-13, -13, 0, -13.4);
    ctx.quadraticCurveTo(10.6, -13, 10.4, -3);
    ctx.lineTo(8, 11);
    ctx.lineTo(-2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(170,190,220,.22)";
    ctx.beginPath();
    ctx.ellipse(-1, -8, 6.4, 2.4, -0.1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#3b3f4a";
    ctx.beginPath();
    ctx.moveTo(2, -3.4);
    ctx.lineTo(10, -3);
    ctx.lineTo(6.5, 1.2);
    ctx.lineTo(2.4, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6a1e22";
    ctx.beginPath();
    ctx.ellipse(4.4, -1.4, 2, 1.2, 0, 0, TAU);
    ctx.ellipse(8, -1.2, 1.2, 1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#2a2c34";
    ctx.beginPath();
    ctx.moveTo(4, 2.5);
    ctx.lineTo(10, 2.2);
    ctx.lineTo(8.4, 10);
    ctx.lineTo(3, 8.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a909c";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(5 + i * 1.2, 4);
      ctx.lineTo(4.8 + i * 1.1, 8);
    }
    ctx.stroke();
  }

  function palpatineHead(ctx) {
    headBall(ctx, "#b9b2ae", 8.2);
    ctx.strokeStyle = "#7c7470";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.quadraticCurveTo(5, -6.4, 8, -4.6);
    ctx.moveTo(1, 2);
    ctx.quadraticCurveTo(4, 5, 3, 7);
    ctx.moveTo(5, 5.4);
    ctx.lineTo(8, 5);
    ctx.stroke();
    eye(ctx, 4, -1.6, 1.5, 1.2, "#ffc92e", false);
    eye(ctx, 7.2, -1.5, 1.1, 1.1, "#ffc92e", false);
    hood(ctx, "#0f0f15");
  }

  function mentorHead(ctx) {
    headBall(ctx, "#d9b08c");
    face(ctx, "#d9b08c");
    ctx.fillStyle = "#b9bcc4";
    ctx.beginPath();
    ctx.moveTo(8, -5);
    ctx.quadraticCurveTo(3, -11, -4, -9.4);
    ctx.quadraticCurveTo(-11, -6, -9, 5);
    ctx.quadraticCurveTo(-5, 1, -3, -3);
    ctx.quadraticCurveTo(2, -6, 8, -5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.quadraticCurveTo(5, 5, 9, 3);
    ctx.quadraticCurveTo(8, 11, 3.6, 11);
    ctx.quadraticCurveTo(0, 9, 0, 3);
    ctx.fill();
  }

  const bossTorso = (o) => (ctx, j, ext) => {
    if (o.long) skirt(ctx, j, o.long, o.robe2 || o.robe, o.spread || 11, -(ext.capeSwing || 0) * 7);
    torsoShape(ctx, j, o.chest || 8.5, 7);
    fillOutlined(ctx, o.robe);
    if (o.detail) o.detail(ctx, j);
    ctx.fillStyle = o.belt || "#1a1a1e";
    ctx.fillRect(j.hipX - 8, j.hipY - 2, 16, 4);
  };

  const BOSS_SKINS = {
    maul: { sleeve: "#17171d", leg: "#15151a", boot: "#0c0c10", glove: "#111", head: maulHead,
      torso: bossTorso({ robe: "#1b1b22", long: 16 }) },
    dooku: { sleeve: "#2e2520", leg: "#28211c", boot: "#14100c", glove: "#141014", head: dookuHead,
      behind(ctx, j, ext) { cape(ctx, j, 48, "#3a2616", ext.capeSwing || 0, 11); },
      torso: bossTorso({ robe: "#2e2520", long: 22, belt: "#7c7c88",
        detail(ctx, j) {
          ctx.strokeStyle = "#a8a8b4";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(j.neckX - 5, j.neckY + 2);
          ctx.quadraticCurveTo(j.neckX, j.neckY + 6, j.neckX + 5, j.neckY + 2);
          ctx.stroke();
        } }) },
    ventress: { sleeve: "#e7e4ea", leg: "#1a1720", boot: "#0f0d14", glove: "#26202e", armW: 4, legW: 5, head: ventressHead,
      torso: bossTorso({ robe: "#1e1a26", long: 18, chest: 7, spread: 8, belt: "#5a3d7a",
        detail(ctx, j) {
          ctx.fillStyle = "#5a3d7a";
          ctx.fillRect(j.neckX - 2, j.neckY + 2, 4, 15);
        } }) },
    vader: { sleeve: "#101117", leg: "#0d0e13", boot: "#07070a", glove: "#07070a", armW: 6, legW: 7, head: vaderHead,
      behind(ctx, j, ext) { cape(ctx, j, 54, "#08090d", ext.capeSwing || 0, 15); },
      torso: bossTorso({ robe: "#14151c", long: 24, chest: 11, belt: "#3b3f4a",
        detail(ctx, j) {
          ctx.fillStyle = "#2a2d36";
          ctx.fillRect(j.neckX - 5, j.neckY + 4, 10, 8);
          ctx.fillStyle = "#e14a3c";
          ctx.fillRect(j.neckX - 4, j.neckY + 5, 2, 2);
          ctx.fillStyle = "#47c6ff";
          ctx.fillRect(j.neckX - 1, j.neckY + 5, 2, 2);
          ctx.fillStyle = "#6fe07a";
          ctx.fillRect(j.neckX + 2, j.neckY + 5, 2, 2);
          ctx.fillStyle = "#8a8f99";
          ctx.fillRect(j.neckX - 3, j.neckY + 9, 6, 1.6);
        } }) },
    palpatine: { sleeve: "#101015", leg: "#0e0e12", boot: "#08080b", glove: "#b9b2ae", armW: 6, legW: 6, head: palpatineHead,
      behind(ctx, j, ext) { cape(ctx, j, 50, "#0b0b10", ext.capeSwing || 0, 12); },
      torso: bossTorso({ robe: "#111116", long: 32, spread: 14, belt: "#26262e" }) },
    mentor: { sleeve: "#d8caae", leg: "#a8926c", boot: "#3b2a1c", glove: "#d9b08c", head: mentorHead,
      behind(ctx, j, ext) { cape(ctx, j, 46, "#5b3f28", ext.capeSwing || 0, 10); },
      torso: bossTorso({ robe: "#d8caae", long: 26, belt: "#5b3d24" }) },
  };

  // ---------- Public drawing API ----------

  const Art = {
    shade,
    pose,
    joints,
    drawRig,
    SKINS,
    BOSS_SKINS,
    jediSkin,
    rifle,
    staff,
    glowLine,

    // Draws a Jedi at feet position (x, y). Used in play, in menus and in cinematics.
    jedi(ctx, skin, saber, x, y, facing, p, t, capeSwing, scaleXY = 1, saberOn = true) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * scaleXY, scaleXY);
      drawRig(ctx, p, skin, {
        t,
        capeSwing,
        prop: saberOn ? (c, j, time, pp) => saber.draw(c, j.fHx, j.fHy, pp.sab, time) : (c, j) => {
          c.fillStyle = "#b9c2cc";
          c.fillRect(j.hipX + 4, j.hipY - 2, 3, 11);
        },
      });
      ctx.restore();
    },

    // World position of the saber tip, for the swing trail.
    saberTip(p, x, y, facing, length) {
      const j = joints(p);
      const reach = length + 6;
      let lx = j.fHx + sin(p.sab) * reach;
      let ly = j.fHy + cos(p.sab) * reach;
      if (p.rot) {
        const py = ly - j.hipY;
        const c = cos(p.rot);
        const s = sin(p.rot);
        const rx = lx * c - py * s;
        ly = lx * s + py * c + j.hipY;
        lx = rx;
      }
      return { x: x + lx * facing, y: y + ly };
    },

    // A head-and-shoulders picture for dialogue boxes.
    bust(ctx, who, x, y, size, t, jedi) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, size, size);
      ctx.clip();
      const grd = ctx.createLinearGradient(x, y, x, y + size);
      const sith = ["maul", "dooku", "ventress", "vader", "palpatine", "shadow"].includes(who);
      grd.addColorStop(0, sith ? "#3a0a10" : "#123058");
      grd.addColorStop(1, sith ? "#110306" : "#071426");
      ctx.fillStyle = grd;
      ctx.fillRect(x, y, size, size);
      const k = size / 26;
      ctx.translate(x + size * 0.46, y + size * 0.44 + 58 * k);
      ctx.scale(k, k);
      const skin = who === "player" || who === "shadow" ? jediSkin(jedi) : BOSS_SKINS[who];
      drawRig(ctx, { ...poses.relaxed(t), fArm: 0, fFore: 0.2, bArm: 0, bFore: 0.1 }, skin, { t });
      ctx.restore();
      ctx.strokeStyle = sith ? "#ff5a55" : "#7cc8ff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, size, size);
    },

    enemy(ctx, e, t) {
      const c = e.config;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.facing * c.scale, c.scale);
      if (c.fly) {
        c.drawFly(ctx, e, t);
        ctx.restore();
        return;
      }
      const p = e.pose(t);
      const skin = SKINS[c.skin] || e.skinOverride;
      const ext = { t };
      if (c.prop === "rifle") ext.prop = (cx, j) => rifle(cx, j, false);
      else if (c.prop === "heavy") ext.prop = (cx, j) => rifle(cx, j, true);
      else if (c.prop === "staff") ext.prop = (cx, j, time) => staff(cx, j, time, c.staffColor || "#7a4cff");
      else if (c.prop === "saber") ext.prop = (cx, j, time, pp) => e.saber.draw(cx, j.fHx, j.fHy, pp.sab, time);
      drawRig(ctx, p, skin, ext);
      ctx.restore();
    },

    probe(ctx, e, t) {
      const bob = sin(t * 4 + e.seed) * 2;
      ctx.translate(0, -30 + bob);
      ctx.strokeStyle = "#20232a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(i * 4, 8);
        ctx.quadraticCurveTo(i * 8, 22, i * 6 + sin(t * 5 + i) * 2, 34);
      }
      ctx.moveTo(-4, -12);
      ctx.lineTo(-9, -28);
      ctx.moveTo(4, -12);
      ctx.lineTo(7, -24);
      ctx.stroke();
      const g = ctx.createRadialGradient(-3, -4, 2, 0, 0, 14);
      g.addColorStop(0, "#5a6170");
      g.addColorStop(1, "#16181e");
      ctx.fillStyle = g;
      ctx.strokeStyle = OUTLINE;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = e.alert > 0 ? "#ff3a2a" : "#ffb648";
      for (const [x, y] of [[7, -3], [9, 3], [3, 4]]) {
        ctx.beginPath();
        ctx.arc(x, y, 1.9, 0, TAU);
        ctx.fill();
      }
    },

    remote(ctx, e, t) {
      const bob = sin(t * 7 + e.seed) * 2.4;
      ctx.translate(0, -8 + bob);
      const g = ctx.createRadialGradient(-2, -3, 1, 0, 0, 11);
      g.addColorStop(0, "#c9d0da");
      g.addColorStop(1, "#4b5260");
      ctx.fillStyle = g;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#2a2e38";
      for (const a of [0.4, 1.4, 2.4, 3.4, 4.4, 5.4]) {
        ctx.beginPath();
        ctx.arc(cos(a) * 6.4, sin(a) * 6.4, 1.5, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#58c8ff";
      ctx.beginPath();
      ctx.arc(4, 0, 2.6, 0, TAU);
      ctx.fill();
    },
  };

  function glowLine(ctx, points, color, width = 2.4) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    points.forEach((point, i) => (i ? ctx.lineTo(point[0], point[1]) : ctx.moveTo(point[0], point[1])));
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = width * 3.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = width * 0.4;
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  // A jagged bolt from one point to another. Each call is a new random path, which is the flicker.
  Art.lightning = function lightning(ctx, x0, y0, x1, y1, color = "#9fd8ff", width = 2.2, jag = 22) {
    const pts = [[x0, y0]];
    const steps = Math.max(4, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 34));
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      pts.push([lerp(x0, x1, k) + J.U.rand(-jag, jag), lerp(y0, y1, k) + J.U.rand(-jag, jag)]);
    }
    pts.push([x1, y1]);
    glowLine(ctx, pts, color, width);
  };

  J.Art = Art;
})(window.JEDI);
