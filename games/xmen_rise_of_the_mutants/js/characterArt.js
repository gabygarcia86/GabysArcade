/*
 * Procedural hero art. Each hero is a small skeleton (hips, knees, feet, shoulders,
 * elbows, hands, head) posed per animation state, then drawn as outlined comic-style
 * shapes in the outfit's palette. Hero-specific heads, capes, coats, hair, tails,
 * claws and Professor X's hover-chair are layered on top.
 *
 * anim: { state, t, phase, kind, prog, combo, power, speed, vy }
 *   state: idle walk run jump fall glide climb attack special ultimate hurt dodge ko victory
 */
(function (XM) {
  "use strict";
  const A = XM.Art;
  const U = XM.U;
  const sin = Math.sin;
  const cos = Math.cos;
  const J = (o, a, len) => ({ x: o.x + sin(a) * len, y: o.y + cos(a) * len });
  const L = U.lerp;

  // ---------------- Poses ----------------
  function attackPose(kind, k, combo, p) {
    const s = k < 0.22 ? 0 : Math.min(1, (k - 0.22) / 0.2) * (k > 0.65 ? 1 - ((k - 0.65) / 0.35) * 0.55 : 1);
    p.legF = [0.42, 0.32];
    p.legB = [-0.38, 0.14];
    switch (kind) {
      case "punch": {
        const armP = [L(-0.4, 1.62, s), L(1.8, 0.05, s)];
        const guard = [0.55, 1.9];
        if (combo === 1) {
          p.armB = armP;
          p.armF = guard;
        } else {
          p.armF = armP;
          p.armB = guard;
        }
        p.lean = 0.08 + s * 0.22;
        break;
      }
      case "slash":
        if (combo === 0) {
          p.armF = [L(2.6, 0.5, s), 0.25];
          p.armB = [0.3, 1.2];
        } else if (combo === 1) {
          p.armF = [L(0.3, 2.3, s), 0.2];
          p.armB = [L(0.5, 1.4, s), 0.3];
        } else {
          p.armF = [L(2.8, 0.9, s), 0.1];
          p.armB = [L(2.4, 1.2, s), 0.2];
        }
        p.lean = 0.12 + s * 0.2;
        break;
      case "blast":
        p.armF = [L(1.0, 1.57, s), L(0.8, 0, s)];
        p.armB = [1.15, 0.5];
        p.lean = 0.1 - s * 0.04;
        break;
      case "aimUp":
        p.armF = [L(1.6, 2.35, s), 0];
        p.armB = [1.5, 0.6];
        p.lean = 0;
        break;
      case "visor":
        p.armF = [2.1, 2.4];
        p.armB = [0.35, 0.7];
        p.lean = 0.06;
        p.headTilt = -0.05;
        break;
      case "throw":
        p.armF = [L(-1.4, 1.9, s), L(1.4, 0.1, s)];
        p.armB = [0.6, 1.0];
        p.lean = 0.15 * s;
        break;
      case "heavy":
        p.armF = [L(3.0, 1.1, s), 0.2];
        p.armB = [L(2.8, 1.25, s), 0.25];
        p.lean = L(-0.1, 0.35, s);
        p.legF = [0.6, 0.3 + 0.7 * s];
        p.legB = [-0.5, 0.4];
        break;
      case "slam":
        p.armF = [L(3.0, 0.5, s), 0.1];
        p.armB = [L(2.9, 0.6, s), 0.1];
        p.lean = L(-0.15, 0.55, s);
        p.legF = [0.7, 0.5 + s];
        p.legB = [-0.6, 0.6 + s * 0.4];
        break;
      case "wave":
        p.armF = [L(0.9, 1.45, s), L(1.2, 0.05, s)];
        p.armB = [L(0.8, 1.3, s), L(1.0, 0.1, s)];
        p.lean = 0.15 * s;
        break;
      case "rise":
        p.armF = [L(1.2, 2.75, s), 0.2];
        p.armB = [L(1.0, 2.5, s), 0.2];
        p.lift = 8 * s;
        p.legF = [0.15, 0.3];
        p.legB = [-0.05, 0.4];
        p.grounded = false;
        break;
      case "stab":
        p.armF = [L(0.8, 1.6, s), L(1.6, 0, s)];
        p.armB = [0.4, 1.4];
        p.lean = 0.25 * s;
        break;
      case "spin":
        p.armF = [1.6, 0.1];
        p.armB = [1.6, 0.1];
        p.rot = k * Math.PI * 4;
        p.legF = [0.5, 1.2];
        p.legB = [0.3, 1.2];
        p.grounded = false;
        break;
      case "temple":
        p.armF = [L(1.0, 2.0, s), L(1.0, 2.6, s)];
        p.armB = [L(0.6, 1.5, s), 0.1];
        break;
      case "kick":
        p.legF = [L(0.3, 1.5, s), L(1.2, 0.05, s)];
        p.legB = [-0.25, 0.25];
        p.armF = [0.6, 1.8];
        p.armB = [-0.6, 1.0];
        p.lean = -0.2 * s;
        break;
      default:
        p.armF = [1.4, 0.2];
    }
  }

  function victoryPose(kind, t, p) {
    switch (kind) {
      case "fistUp":
        p.armF = [3.0, 0.1];
        p.armB = [-0.25, 0.5];
        p.bob = -Math.abs(sin(t * 3)) * 2;
        break;
      case "clawsCross":
        p.armF = [1.9, 1.6];
        p.armB = [1.6, 1.8];
        p.legF = [0.5, 0.7];
        p.legB = [-0.45, 0.5];
        p.lean = 0.15;
        break;
      case "float":
        p.lift = 12 + sin(t * 2) * 3;
        p.grounded = false;
        p.armF = [2.4, 0.2];
        p.armB = [2.2, 0.25];
        p.legF = [0.1, 0.25];
        p.legB = [-0.05, 0.35];
        break;
      case "cardFlourish":
        p.armF = [1.7, 1.7];
        p.armB = [0.1, 0.3];
        p.lean = -0.06;
        break;
      case "bow": {
        const b = Math.min(1, t * 1.5);
        p.lean = 0.65 * b;
        p.armF = [1.2, 1.3];
        p.armB = [-0.9 * b, 0.2];
        break;
      }
      case "flex":
        p.armF = [1.75, 1.45];
        p.armB = [1.35, 1.65];
        p.legF = [0.35, 0.25];
        p.legB = [-0.35, 0.2];
        break;
      case "iceArms":
        p.armF = [2.85, 0.25];
        p.armB = [2.6, 0.3];
        break;
      case "bladeReady":
        p.armF = [1.25, 1.3];
        p.armB = [0.5, 1.0];
        p.legF = [0.55, 0.55];
        p.legB = [-0.5, 0.35];
        p.lean = 0.12;
        break;
      case "sparkle":
        p.armF = [2.95, 0.15];
        p.armB = [1.0, 0.6];
        p.lift = Math.abs(sin(t * 4)) * 8;
        p.grounded = p.lift < 0.5;
        break;
      case "temple":
        p.armF = [2.0, 2.6];
        p.armB = [2.4, 0.3];
        break;
    }
  }

  function pose(ch, an) {
    const t = an.t || 0;
    const ph = an.phase || 0;
    const p = { lean: ch.body.lean || 0.04, bob: 0, legF: [0.1, 0.12], legB: [-0.1, 0.1], armF: [0.2, 0.45], armB: [-0.15, 0.4], rot: 0, lift: 0, headTilt: 0, grounded: true };
    const s = sin(ph);
    const c = cos(ph);
    switch (an.state) {
      case "idle": {
        const b = sin(t * 2.4);
        p.bob = b * 0.8;
        p.armF = [0.2 + b * 0.04, 0.45];
        p.armB = [-0.15 - b * 0.03, 0.4];
        if (ch.id === "wolverine" || ch.id === "beast") {
          p.legF = [0.4, 0.6];
          p.legB = [-0.35, 0.45];
          p.armF = [0.7 + b * 0.05, 1.0];
          p.armB = [0.4, 0.9];
        }
        if (ch.id === "colossus") {
          p.legF = [0.22, 0.12];
          p.legB = [-0.22, 0.1];
        }
        if (ch.id === "psylocke") {
          p.armF = [0.9, 1.1];
          p.legF = [0.35, 0.3];
          p.legB = [-0.3, 0.2];
        }
        break;
      }
      case "walk":
        p.legF = [s * 0.45, 0.15 + Math.max(0, c) * 0.5];
        p.legB = [-s * 0.45, 0.15 + Math.max(0, -c) * 0.5];
        p.armF = [-s * 0.4, 0.4];
        p.armB = [s * 0.4, 0.4];
        p.lean += 0.06;
        p.bob = -Math.abs(c) * 1.2;
        break;
      case "run":
        p.legF = [s * 0.8 + 0.15, 0.3 + Math.max(0, c) * 1.1];
        p.legB = [-s * 0.8 + 0.15, 0.3 + Math.max(0, -c) * 1.1];
        p.armF = [-s * 0.9, 1.3];
        p.armB = [s * 0.9, 1.3];
        p.lean += 0.22;
        p.bob = -Math.abs(c) * 2.4;
        if (ch.id === "wolverine" || ch.id === "nightcrawler") p.armF = [0.9 - s * 0.3, 1.2];
        break;
      case "jump":
        p.grounded = false;
        p.legF = [0.75, 1.3];
        p.legB = [-0.1, 0.55];
        p.armF = [2.5, 0.3];
        p.armB = [-0.6, 0.6];
        p.lean = 0.1;
        if (an.flip) p.rot = Math.min(1, an.flip) * Math.PI * 2;
        break;
      case "fall":
        p.grounded = false;
        p.legF = [0.3, 0.5];
        p.legB = [-0.25, 0.35];
        p.armF = [1.95, 0.4];
        p.armB = [-1.5, 0.3];
        p.lean = 0;
        break;
      case "glide":
        p.grounded = false;
        p.legF = [0.15, 0.2];
        p.legB = [-0.25, 0.3];
        p.armF = [1.7, 0.1];
        p.armB = [1.4, 0.1];
        p.lean = 0.35;
        break;
      case "climb":
        p.grounded = false;
        p.legF = [0.4 + 0.3 * s, 1.0 + 0.4 * s];
        p.legB = [0.4 - 0.3 * s, 1.0 - 0.4 * s];
        p.armF = [2.9 + 0.3 * s, 0.2];
        p.armB = [2.9 - 0.3 * s, 0.2];
        p.lean = 0;
        break;
      case "hurt":
        p.legF = [0.3, 0.4];
        p.legB = [-0.3, 0.3];
        p.armF = [-0.6, 0.8];
        p.armB = [-1.2, 0.5];
        p.lean = -0.35;
        break;
      case "dodge":
        p.grounded = false;
        p.legF = [1.2, 2.0];
        p.legB = [1.0, 2.1];
        p.armF = [1.4, 1.6];
        p.armB = [1.2, 1.7];
        p.rot = (an.prog || 0) * Math.PI * 2;
        p.lift = -10;
        break;
      case "ko":
        p.rot = -1.45;
        p.legF = [0.2, 0.2];
        p.legB = [-0.1, 0.1];
        p.armF = [2.6, 0.3];
        p.armB = [2.2, 0.3];
        p.lift = -12;
        p.grounded = false;
        break;
      case "victory":
        victoryPose(ch.victory, t, p);
        break;
      case "attack":
      case "special":
      case "ultimate":
        attackPose(an.kind, an.prog || 0, an.combo || 0, p);
        if (an.air) {
          p.grounded = false;
          p.legF = [0.6, 1.1];
          p.legB = [-0.1, 0.6];
        }
        break;
    }
    return p;
  }

  function skeleton(ch, p) {
    const b = ch.body;
    const thigh = b.legs * 0.5;
    const shin = b.legs * 0.52;
    const o = { x: 0, y: 0 };
    const kF = J(o, p.legF[0], thigh);
    const fF = J(kF, p.legF[0] - p.legF[1], shin);
    const kB = J(o, p.legB[0], thigh);
    const fB = J(kB, p.legB[0] - p.legB[1], shin);
    let hipY = p.grounded ? -Math.max(fF.y, fB.y) : -b.legs * 0.95;
    hipY += p.bob - p.lift;
    const off = (q) => ({ x: q.x, y: q.y + hipY });
    const hip = { x: 0, y: hipY };
    const neck = { x: hip.x + sin(p.lean) * b.torso, y: hip.y - cos(p.lean) * b.torso };
    const sh = { x: hip.x + sin(p.lean) * b.torso * 0.86, y: hip.y - cos(p.lean) * b.torso * 0.86 };
    const ha = p.lean * 0.6 + p.headTilt;
    const head = { x: neck.x + sin(ha) * b.head * 1.05, y: neck.y - cos(ha) * b.head * 1.05 };
    const upper = b.torso * 0.55;
    const fore = b.torso * 0.52;
    const eF = J(sh, p.armF[0], upper);
    const hF = J(eF, p.armF[0] + p.armF[1], fore);
    const eB = J(sh, p.armB[0], upper);
    const hB = J(eB, p.armB[0] + p.armB[1], fore);
    return { hip, neck, sh, head, ha, kF: off(kF), fF: off(fF), kB: off(kB), fB: off(fB), eF, hF, eB, hB, lean: p.lean };
  }

  // ---------------- Body parts ----------------
  const dk = (c, dark) => (dark ? A.shade(c, -0.25) : c);

  function legColor(f, pal) {
    if (f.fur || (f.iceForm && !f.suitOver) || f.snowman) return pal.skin;
    return pal.suit;
  }

  function drawLeg(ctx, ch, hip, knee, foot, pal, f, dark, t) {
    const w = ch.body.leg;
    const col = dk(legColor(f, pal), dark);
    A.limb2(ctx, hip, knee, foot, w * 1.05, w * 0.9, col);
    if (f.steel) steelLines(ctx, knee, foot, w);
    const mid = { x: L(knee.x, foot.x, 0.5), y: L(knee.y, foot.y, 0.5) };
    const bootCol = dk(f.fur ? pal.skin : pal.boots, dark);
    if (!f.fur && !f.snowman && (!f.iceForm || f.suitOver || pal.boots !== pal.suit)) A.limb(ctx, mid.x, mid.y, foot.x, foot.y, w * 0.95, bootCol, false);
    const big = ch.id === "beast" ? 1.6 : ch.id === "colossus" ? 1.2 : 1;
    A.ellipse(ctx, foot.x + w * 0.45 * big, foot.y - 1, w * 0.85 * big, w * 0.42, 0, bootCol, true, 1.5);
    if (f.armor) A.circle(ctx, knee.x + 1, knee.y, w * 0.55, dk(pal.trim, dark), true, 1.5);
    else if (f.tactical) A.ellipse(ctx, knee.x + 1, knee.y, w * 0.6, w * 0.45, 0, dark ? "#141414" : "#262a30", true, 1);
    if (f.damaged && !dark) {
      ctx.fillStyle = pal.skin;
      ctx.fillRect(L(hip.x, knee.x, 0.5) - 2, L(hip.y, knee.y, 0.5) - 1, 4, 3);
    }
    if (f.stealth) glowLine(ctx, hip, knee, foot, pal.glow, t);
  }

  function steelLines(ctx, a, b, w) {
    ctx.strokeStyle = "rgba(40,50,70,0.55)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const x = L(a.x, b.x, i / 3);
      const y = L(a.y, b.y, i / 3);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.45, y);
      ctx.lineTo(x + w * 0.45, y);
      ctx.stroke();
    }
  }

  function glowLine(ctx, a, b, c, color, t) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55 + 0.35 * sin(t * 4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function armColor(ch, f, pal) {
    if (f.jacket || f.coat || f.labcoat || f.robe || f.smock || f.spaceSuit) return f.spaceSuit ? pal.suit : pal.coat;
    if (f.sleeveless || f.fur || (f.iceForm && !f.suitOver) || f.snowman) return pal.skin;
    if (ch.id === "colossus") return pal.skin;
    return pal.suit;
  }

  function drawArm(ctx, ch, sh, el, hand, pal, f, dark, front, an) {
    const w = ch.body.arm;
    const col = dk(armColor(ch, f, pal), dark);
    A.limb2(ctx, sh, el, hand, w * 1.05, w * 0.92, col);
    if (f.steel && (f.sleeveless || ch.id === "colossus")) steelLines(ctx, sh, el, w);
    const gl = { x: L(el.x, hand.x, 0.45), y: L(el.y, hand.y, 0.45) };
    const gloveCol = dk(pal.gloves, dark);
    if (pal.gloves !== pal.skin && !f.fur) A.limb(ctx, gl.x, gl.y, hand.x, hand.y, w * 0.95, gloveCol, false);
    const handR = w * (ch.id === "beast" ? 0.72 : ch.id === "colossus" ? 0.66 : 0.62);
    A.circle(ctx, hand.x, hand.y, handR, f.fur ? dk(pal.skin, dark) : gloveCol, true, 1.5);
    if (front && f.armor) A.ellipse(ctx, sh.x, sh.y + 1, w * 0.95, w * 0.7, 0.3, pal.trim, true, 1.5);
    if (front && f.tactical && !f.armor) A.ellipse(ctx, sh.x, sh.y + 2, w * 0.7, w * 0.5, 0.3, "#30353d", true, 1);
    if (f.stealth) glowLine(ctx, sh, el, hand, pal.glow, an.t || 0);
    // Claws: always out for Wolverine, on both hands during combo finishers.
    if (ch.id === "wolverine" && f.claws !== false && (front || (an.state === "attack" && an.combo >= 1) || an.state === "victory")) {
      const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
      ctx.strokeStyle = A.OUTLINE;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let i = -1; i <= 1; i++) {
        const ox = cos(ang + Math.PI / 2) * i * 2.2;
        const oy = sin(ang + Math.PI / 2) * i * 2.2;
        ctx.beginPath();
        ctx.moveTo(hand.x + ox, hand.y + oy);
        ctx.lineTo(hand.x + ox + cos(ang) * 13, hand.y + oy + sin(ang) * 13);
        ctx.stroke();
      }
      ctx.strokeStyle = pal.claws;
      ctx.lineWidth = 1.6;
      for (let i = -1; i <= 1; i++) {
        const ox = cos(ang + Math.PI / 2) * i * 2.2;
        const oy = sin(ang + Math.PI / 2) * i * 2.2;
        ctx.beginPath();
        ctx.moveTo(hand.x + ox, hand.y + oy);
        ctx.lineTo(hand.x + ox + cos(ang) * 12.5, hand.y + oy + sin(ang) * 12.5);
        ctx.stroke();
      }
    }
    // Psylocke's psychic blade appears while she fights.
    if (ch.id === "psylocke" && front && (an.state === "attack" || an.state === "special" || an.state === "ultimate" || an.state === "victory")) {
      const ang = Math.atan2(hand.y - el.y, hand.x - el.x);
      A.glow(ctx, hand.x + cos(ang) * 12, hand.y + sin(ang) * 12, 16, pal.glow, 0.7);
      A.limb(ctx, hand.x, hand.y, hand.x + cos(ang) * 24, hand.y + sin(ang) * 24, 3.5, "#ffd9fb", false);
    }
    // A glowing hand while charging energy powers.
    if (front && an.power > 0) A.glow(ctx, hand.x, hand.y, 10 + an.power * 10, pal.glow, 0.8);
    if (front && ch.id === "gambit" && (an.state === "attack" || an.state === "victory" || an.state === "special")) {
      ctx.save();
      ctx.translate(hand.x, hand.y);
      ctx.rotate(0.3);
      A.glow(ctx, 0, 0, 9, pal.glow, 0.9);
      A.box(ctx, -3, -5, 6, 9, "#fff6fb", true, 1, 1);
      ctx.fillStyle = "#c4161c";
      ctx.fillRect(-1, -2, 2, 3);
      ctx.restore();
    }
  }

  function torsoColor(f, pal) {
    if (f.fur || (f.iceForm && !f.suitOver) || f.snowman) return pal.skin;
    return pal.suit;
  }

  function drawTorso(ctx, ch, S, pal, f, an) {
    const b = ch.body;
    ctx.save();
    ctx.translate(S.hip.x, S.hip.y);
    ctx.rotate(S.lean);
    const Lt = b.torso;
    const cw = b.chest / 2;
    const hw = b.hip / 2;
    const body = [-hw, 2, hw, 2, cw, -Lt * 0.72, cw * 0.78, -Lt - 1, -cw * 0.78, -Lt - 1, -cw, -Lt * 0.72];
    A.poly(ctx, body, torsoColor(f, pal), true, 2);
    TORSO[ch.id] && TORSO[ch.id](ctx, Lt, cw, hw, pal, f, an);
    // Shared costume layers
    if (f.trunks) {
      A.poly(ctx, [-hw - 1, -5, hw + 1, -5, hw + 1, 3, 2, 6, -hw - 1, 3], pal.suit2, true, 1.5);
    }
    if (f.belt !== false && !f.robe && !f.smock) {
      ctx.fillStyle = pal.belt;
      ctx.fillRect(-hw - 0.5, -6, hw * 2 + 1, 3.5);
      ctx.strokeStyle = A.OUTLINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(-hw - 0.5, -6, hw * 2 + 1, 3.5);
      if (!f.tactical) A.xLogo(ctx, hw * 0.45, -4.3, 2.8, "#f6c22b", "#c4161c", true);
    }
    if (f.tactical) {
      ctx.strokeStyle = "#2a2e34";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.7, -Lt * 0.95);
      ctx.lineTo(hw * 0.8, -6);
      ctx.stroke();
      A.box(ctx, -hw, -8, 5, 5, "#3a3f47", true, 1, 1);
      A.box(ctx, hw - 4, -8, 5, 5, "#3a3f47", true, 1, 1);
    }
    if (f.vest) A.poly(ctx, [-cw, -Lt * 0.95, cw * 0.95, -Lt * 0.95, hw + 1, -4, -hw - 1, -4], pal.suit2, true, 1.5);
    if (f.armor) {
      A.poly(ctx, [-cw * 0.9, -Lt * 0.92, cw * 0.95, -Lt * 0.92, cw * 0.8, -Lt * 0.4, -cw * 0.7, -Lt * 0.4], pal.trim, true, 1.5);
      ctx.strokeStyle = A.shade(pal.trim, -0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -Lt * 0.9);
      ctx.lineTo(0, -Lt * 0.42);
      ctx.stroke();
    }
    if (f.harness) {
      ctx.strokeStyle = "#6a6e76";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.8, -Lt * 0.8);
      ctx.lineTo(cw * 0.8, -Lt * 0.5);
      ctx.moveTo(-cw * 0.8, -Lt * 0.5);
      ctx.lineTo(cw * 0.8, -Lt * 0.8);
      ctx.stroke();
    }
    if (f.damaged) {
      ctx.fillStyle = pal.skin;
      ctx.beginPath();
      ctx.moveTo(cw * 0.2, -Lt * 0.75);
      ctx.lineTo(cw * 0.7, -Lt * 0.62);
      ctx.lineTo(cw * 0.25, -Lt * 0.55);
      ctx.fill();
      ctx.fillStyle = "rgba(30,20,20,0.35)";
      ctx.beginPath();
      ctx.arc(-cw * 0.4, -Lt * 0.3, 3, 0, Math.PI * 2);
      ctx.arc(cw * 0.3, -Lt * 0.15, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(120,20,20,0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.6, -Lt * 0.8);
      ctx.lineTo(-cw * 0.2, -Lt * 0.6);
      ctx.stroke();
    }
    if (f.stealth) {
      ctx.strokeStyle = pal.glow;
      ctx.globalAlpha = 0.6 + 0.3 * sin((an.t || 0) * 4);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.6, -Lt * 0.9);
      ctx.lineTo(0, -Lt * 0.5);
      ctx.lineTo(cw * 0.6, -Lt * 0.9);
      ctx.moveTo(0, -Lt * 0.5);
      ctx.lineTo(0, -6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (f.ultimate) {
      A.glow(ctx, cw * 0.25, -Lt * 0.6, 9, pal.glow, 0.6 + 0.3 * sin((an.t || 0) * 5));
      A.xLogo(ctx, cw * 0.25, -Lt * 0.6, 3.6, pal.glow, "#111", true);
    }
    if (f.phoenix) phoenixEmblem(ctx, cw * 0.2, -Lt * 0.62, 5, f.ultimate ? "#f5c542" : pal.suit2);
    if (f.tie) {
      A.poly(ctx, [cw * 0.25, -Lt + 1, cw * 0.6, -Lt + 1, cw * 0.55, -Lt * 0.35, cw * 0.4, -Lt * 0.3], pal.suit2, false);
      A.poly(ctx, [cw * 0.38, -Lt + 2, cw * 0.52, -Lt + 2, cw * 0.5, -Lt * 0.45, cw * 0.42, -Lt * 0.4], pal.accent, true, 1);
    }
    ctx.restore();
  }

  function phoenixEmblem(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.strokeStyle = A.OUTLINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.4, -r * 1.2, -r * 1.6, r * 0.2);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.1, 0, r * 1.2);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.1, r * 1.6, r * 0.2);
    ctx.quadraticCurveTo(r * 1.4, -r * 1.2, 0, -r * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Hero-specific torso details, drawn in the torso's own frame (hip at 0, chest at -Lt).
  const TORSO = {
    cyclops(ctx, Lt, cw, hw, pal, f) {
      A.poly(ctx, [-cw, -Lt * 0.72, cw, -Lt * 0.72, cw * 0.78, -Lt - 1, -cw * 0.78, -Lt - 1], pal.suit2, false);
      if (f.straps) {
        ctx.strokeStyle = A.OUTLINE;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-cw * 0.7, -Lt * 0.98);
        ctx.lineTo(cw * 0.5, -6);
        ctx.moveTo(cw * 0.7, -Lt * 0.98);
        ctx.lineTo(-cw * 0.3, -6);
        ctx.stroke();
        ctx.strokeStyle = pal.accent;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      }
    },
    wolverine(ctx, Lt, cw, hw, pal, f) {
      if (f.jacket || f.sleeveless) return;
      // Dark side panels that flare up to the shoulders.
      A.poly(ctx, [-cw, -Lt * 0.72, -cw * 0.78, -Lt - 1, -cw * 0.1, -Lt - 1, -cw * 0.45, -Lt * 0.55, -hw, -6], pal.suit2, true, 1.2);
      A.poly(ctx, [cw, -Lt * 0.72, cw * 0.78, -Lt - 1, cw * 0.35, -Lt - 1, cw * 0.55, -Lt * 0.55, hw, -6], pal.suit2, true, 1.2);
      // Dark stripes along the ribs.
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-cw * 0.45, -Lt * (0.25 + i * 0.12));
        ctx.lineTo(-cw * 0.1, -Lt * (0.3 + i * 0.12));
        ctx.stroke();
      }
    },
    storm(ctx, Lt, cw, hw, pal) {
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.5, -Lt);
      ctx.lineTo(cw * 0.25, -Lt * 0.55);
      ctx.lineTo(cw * 0.75, -Lt);
      ctx.stroke();
    },
    jean(ctx, Lt, cw, hw, pal, f) {
      if (f.sash) {
        A.poly(ctx, [-hw - 1, -8, hw + 1, -9, hw + 1, -3, -hw - 1, -2], pal.suit2, true, 1);
        return;
      }
      A.poly(ctx, [-cw * 0.2, -Lt - 1, cw * 0.78, -Lt - 1, cw * 0.4, -Lt * 0.75], pal.suit2, true, 1);
    },
    beast(ctx, Lt, cw, hw, pal, f) {
      if (f.fur !== false) {
        ctx.fillStyle = A.shade(pal.skin, 0.18);
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cw * 0.1 + i * 3, -Lt * 0.85 + i * 4);
          ctx.lineTo(cw * 0.35 + i * 3, -Lt * 0.78 + i * 4);
          ctx.lineTo(cw * 0.15 + i * 3, -Lt * 0.7 + i * 4);
          ctx.fill();
        }
      }
      if (f.shorts) A.poly(ctx, [-hw - 2, -8, hw + 2, -8, hw + 3, 4, -hw - 3, 4], pal.suit, true, 1.5);
      if (f.labcoat) A.poly(ctx, [-cw, -Lt * 0.9, -cw * 0.3, -Lt, -cw * 0.2, 2, -hw - 2, 2], pal.coat, true, 1.5);
    },
    gambit(ctx, Lt, cw, hw, pal, f) {
      A.poly(ctx, [-cw * 0.85, -Lt * 0.95, cw * 0.95, -Lt * 0.95, cw * 0.8, -Lt * 0.4, -cw * 0.6, -Lt * 0.4], pal.suit2, true, 1.5);
      if (!f.headpiece) return;
      ctx.strokeStyle = A.shade(pal.suit2, -0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.2, -Lt * 0.9);
      ctx.lineTo(-cw * 0.1, -Lt * 0.45);
      ctx.stroke();
    },
    nightcrawler(ctx, Lt, cw, hw, pal, f) {
      if (f.robe) return;
      A.poly(ctx, [-cw * 0.2, -Lt - 1, cw * 0.78, -Lt - 1, cw * 0.95, -Lt * 0.72, cw * 0.1, -Lt * 0.2, -cw * 0.25, -Lt * 0.35], pal.suit2, true, 1.2);
    },
    colossus(ctx, Lt, cw, hw, pal, f) {
      if (f.sleeveless) {
        // Tank top: steel shoulders and collar show above the suit.
        A.poly(ctx, [-cw * 0.78, -Lt - 1, cw * 0.78, -Lt - 1, cw * 0.5, -Lt * 0.82, -cw * 0.5, -Lt * 0.82], pal.skin, true, 1.2);
      }
      if (!f.smock) A.poly(ctx, [-cw * 0.25, -Lt * 0.82, cw * 0.35, -Lt * 0.82, cw * 0.25, -4, -cw * 0.15, -4], pal.suit2, true, 1.2);
      else {
        A.poly(ctx, [-cw * 0.9, -Lt * 0.9, cw * 0.9, -Lt * 0.9, hw + 3, 6, -hw - 3, 6], pal.coat, true, 1.5);
        ["#e94b3c", "#3c8ae9", "#f2c230"].forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(-cw * 0.3 + i * 5, -Lt * (0.5 - i * 0.1), 1.8, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    },
    iceman(ctx, Lt, cw, hw, pal, f) {
      if (f.suitOver || f.snowman) return;
      ctx.strokeStyle = A.rgba("#ffffff", 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.6, -Lt * 0.9);
      ctx.lineTo(cw * 0.1, -Lt * 0.6);
      ctx.lineTo(cw * 0.7, -Lt * 0.85);
      ctx.moveTo(cw * 0.1, -Lt * 0.6);
      ctx.lineTo(-cw * 0.1, -Lt * 0.2);
      ctx.lineTo(hw * 0.8, -4);
      ctx.stroke();
      if (f.damaged) {
        ctx.strokeStyle = "#2a5a7a";
        ctx.beginPath();
        ctx.moveTo(-cw * 0.5, -Lt * 0.4);
        ctx.lineTo(-cw * 0.1, -Lt * 0.5);
        ctx.lineTo(cw * 0.2, -Lt * 0.35);
        ctx.stroke();
      }
    },
    psylocke(ctx, Lt, cw, hw, pal, f) {
      A.poly(ctx, [-hw, 2, hw, 2, cw * 0.5, -Lt * 0.55, -cw * 0.3, -Lt * 0.55], pal.suit2, false);
      if (f.sash) A.poly(ctx, [-hw - 1, -9, hw + 1, -10, hw + 1, -4, -hw - 1, -3], pal.accent, true, 1);
    },
    jubilee(ctx, Lt, cw, hw, pal) {
      A.poly(ctx, [-hw - 1, -9, hw + 1, -9, hw + 2, 3, -hw - 2, 3], pal.suit2, true, 1.2);
    },
  };

  // ---------------- Heads ----------------
  function face(ctx, r, skin) {
    A.ellipse(ctx, 0, 0.5, r * 0.96, r * 1.02, 0, skin, true, 2);
  }

  function eye(ctx, r, color = "#1a1a1a", hd) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(r * 0.48, -r * 0.05, r * 0.11, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hd) {
      ctx.strokeStyle = A.OUTLINE;
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.35);
      ctx.lineTo(r * 0.72, -r * 0.3);
      ctx.stroke();
    }
  }

  function mouth(ctx, r, hd, grin) {
    if (!hd) return;
    ctx.strokeStyle = A.OUTLINE;
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    if (grin) {
      ctx.moveTo(r * 0.35, r * 0.5);
      ctx.quadraticCurveTo(r * 0.6, r * 0.68, r * 0.85, r * 0.45);
    } else {
      ctx.moveTo(r * 0.45, r * 0.55);
      ctx.lineTo(r * 0.82, r * 0.52);
    }
    ctx.stroke();
  }

  const HEADS = {
    cyclops(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      if (f.cowl) {
        A.poly(ctx, [r * 0.75, -r * 0.4, r * 0.55, -r * 1.0, -r * 0.3, -r * 1.12, -r * 1.05, -r * 0.55, -r * 1.0, r * 0.4, -r * 0.55, r * 0.95, -r * 0.1, r * 0.35, r * 0.25, -r * 0.2], pal.mask, true, 2);
      } else {
        A.poly(ctx, [r * 0.8, -r * 0.5, r * 0.5, -r * 1.15, -r * 0.4, -r * 1.2, -r * 1.0, -r * 0.6, -r * 0.9, r * 0.1, -r * 0.4, -r * 0.3, r * 0.2, -r * 0.55], pal.hair, true, 2);
      }
      A.box(ctx, -r * 0.25, -r * 0.42, r * 1.3, r * 0.44, pal.visor, true, r * 0.1, 1.5);
      ctx.fillStyle = pal.eye;
      ctx.fillRect(r * 0.15, -r * 0.33, r * 0.85, r * 0.26);
      if (an.power > 0 || an.kind === "visor") A.glow(ctx, r * 0.9, -r * 0.2, r * 1.6, pal.glow, 0.8);
      mouth(ctx, r, hd);
    },
    wolverine(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      if (f.cowl) {
        A.poly(ctx, [r * 0.8, -r * 0.3, r * 0.65, -r * 1.0, -r * 0.3, -r * 1.12, -r * 1.05, -r * 0.5, -r * 1.0, r * 0.45, -r * 0.5, r * 0.95, -r * 0.1, r * 0.2, r * 0.3, r * 0.05], pal.mask, true, 2);
        if (f.fins) {
          // The cowl's swept-back fins: the silhouette everyone knows.
          A.poly(ctx, [r * 0.6, -r * 0.5, r * 0.15, -r * 1.05, -r * 1.7, -r * 1.75, -r * 0.75, -r * 0.85, -r * 0.2, -r * 0.4], pal.fin, true, 1.5);
          A.poly(ctx, [r * 0.7, -r * 0.2, r * 0.25, -r * 0.5, -r * 0.65, -r * 0.6, -r * 0.2, -r * 0.1], pal.fin, true, 1);
        }
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(r * 0.5, -r * 0.18, r * 0.2, r * 0.13, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        A.poly(ctx, [r * 0.7, -r * 0.6, r * 0.6, -r * 1.3, r * 0.1, -r * 1.05, -r * 0.3, -r * 1.55, -r * 0.5, -r * 1.0, -r * 1.15, -r * 1.25, -r * 1.05, -r * 0.3, -r * 0.6, r * 0.5, -r * 0.2, -r * 0.2, r * 0.2, r * 0.3, r * 0.25, -r * 0.4], pal.hair, true, 2);
        eye(ctx, r, "#1a1a1a", hd);
      }
      mouth(ctx, r, hd, true);
    },
    storm(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      if (f.mohawk) {
        A.poly(ctx, [r * 0.5, -r * 0.8, r * 0.2, -r * 1.9, -r * 0.4, -r * 1.7, -r * 0.9, -r * 0.6, -r * 0.3, -r * 0.7], pal.hair, true, 1.5);
      } else {
        A.poly(ctx, [r * 0.85, -r * 0.4, r * 0.6, -r * 1.15, -r * 0.4, -r * 1.25, -r * 1.1, -r * 0.6, -r * 0.95, r * 0.3, -r * 0.4, -r * 0.2, r * 0.2, -r * 0.6], pal.hair, true, 2);
      }
      if (f.tiara) {
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = r * 0.18;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.75);
        ctx.lineTo(r * 0.75, -r * 0.55);
        ctx.stroke();
        A.circle(ctx, r * 0.7, -r * 0.58, r * 0.16, "#e94b3c", true, 1);
      }
      const powered = an.power > 0 || an.state === "special" || an.state === "ultimate";
      eye(ctx, r, powered ? "#ffffff" : "#2a1a10", hd);
      if (powered) A.glow(ctx, r * 0.5, -r * 0.05, r * 1.2, "#e8f6ff", 0.9);
      mouth(ctx, r, hd);
    },
    jean(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      A.poly(ctx, [r * 0.9, -r * 0.35, r * 0.7, -r * 1.2, -r * 0.3, -r * 1.45, -r * 1.25, -r * 0.8, -r * 1.2, r * 0.5, -r * 0.5, r * 0.1, -r * 0.2, -r * 0.5, r * 0.35, -r * 0.75], pal.hair, true, 2);
      eye(ctx, r, f.phoenix || an.state === "ultimate" ? "#ffcf4a" : pal.eye, hd);
      if (f.spaceSuit) {
        ctx.strokeStyle = "rgba(200,230,255,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(180,220,255,0.15)";
        ctx.fill();
      }
      mouth(ctx, r, hd);
    },
    beast(ctx, r, pal, f, an, hd) {
      if (f.fur === false) {
        face(ctx, r, pal.skin);
        A.poly(ctx, [r * 0.8, -r * 0.5, r * 0.5, -r * 1.15, -r * 0.5, -r * 1.15, -r * 1.0, -r * 0.4, -r * 0.8, r * 0.2, -r * 0.3, -r * 0.4], pal.hair, true, 2);
        eye(ctx, r, "#1a1a1a", hd);
        mouth(ctx, r, hd, true);
        return;
      }
      // Furry head with a mane, pointed ears and a fanged grin.
      A.poly(ctx, [-r * 0.9, -r * 0.6, -r * 0.4, -r * 1.25, r * 0.2, -r * 1.15, r * 0.95, -r * 0.6, r * 1.15, r * 0.25, r * 0.85, r * 0.9, -r * 0.2, r * 1.15, -r * 1.2, r * 0.6, -r * 1.35, -r * 0.1], pal.hair, true, 2);
      face(ctx, r * 0.9, pal.skin);
      A.poly(ctx, [-r * 0.35, -r * 0.7, -r * 0.6, -r * 1.55, -r * 0.05, -r * 0.85], pal.skin, true, 1.5);
      ctx.fillStyle = A.shade(pal.skin, 0.35);
      ctx.beginPath();
      ctx.ellipse(r * 0.55, r * 0.35, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      eye(ctx, r, pal.eye, hd);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(r * 0.45, r * 0.55);
      ctx.lineTo(r * 0.55, r * 0.85);
      ctx.lineTo(r * 0.65, r * 0.55);
      ctx.fill();
      if (f.glasses) {
        ctx.strokeStyle = "#1a1a1a";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(r * 0.5, -r * 0.05, r * 0.28, 0, Math.PI * 2);
        ctx.moveTo(r * 0.22, -r * 0.1);
        ctx.lineTo(-r * 0.4, -r * 0.2);
        ctx.stroke();
      }
    },
    gambit(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      // Long hair falls out the back of the headpiece.
      A.poly(ctx, [-r * 0.5, -r * 0.9, -r * 1.3, -r * 0.2, -r * 1.5, r * 1.3, -r * 0.8, r * 0.8, -r * 0.4, r * 0.2], pal.hair, true, 1.5);
      if (f.headpiece) {
        A.poly(ctx, [r * 0.85, -r * 0.6, r * 0.55, -r * 1.12, -r * 0.4, -r * 1.15, -r * 1.05, -r * 0.5, -r * 0.95, r * 0.6, -r * 0.4, r * 1.05, -r * 0.05, r * 0.95, -r * 0.05, r * 0.1, r * 0.3, -r * 0.45], pal.mask, true, 2);
      } else {
        A.poly(ctx, [r * 0.85, -r * 0.5, r * 0.5, -r * 1.15, -r * 0.5, -r * 1.15, -r * 1.0, -r * 0.3, -r * 0.4, -r * 0.3, r * 0.2, -r * 0.6], pal.hair, true, 2);
      }
      // Red-on-black eyes.
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.ellipse(r * 0.5, -r * 0.08, r * 0.17, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(r * 0.55, -r * 0.08, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      mouth(ctx, r, hd, true);
    },
    nightcrawler(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      A.poly(ctx, [-r * 0.3, -r * 0.4, -r * 1.3, -r * 1.1, -r * 0.7, -r * 0.1], pal.skin, true, 1.5);
      A.poly(ctx, [r * 0.75, -r * 0.45, r * 0.45, -r * 1.2, -r * 0.6, -r * 1.2, -r * 1.05, -r * 0.5, -r * 0.4, -r * 0.6, r * 0.1, -r * 0.4, r * 0.25, -r * 0.75], pal.hair, true, 2);
      A.glow(ctx, r * 0.5, -r * 0.05, r * 0.7, pal.eye, 0.6);
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.ellipse(r * 0.5, -r * 0.05, r * 0.2, r * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(r * 0.5, r * 0.45);
      ctx.lineTo(r * 0.58, r * 0.7);
      ctx.lineTo(r * 0.66, r * 0.45);
      ctx.fill();
      mouth(ctx, r, hd, true);
    },
    colossus(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      ctx.strokeStyle = "rgba(40,50,70,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, r * 0.1);
      ctx.lineTo(r * 0.9, r * 0.1);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
      A.glow(ctx, -r * 0.4, -r * 0.4, r * 0.6, "#ffffff", 0.35);
      A.poly(ctx, [r * 0.7, -r * 0.6, r * 0.4, -r * 1.12, -r * 0.5, -r * 1.12, -r * 1.0, -r * 0.4, -r * 0.6, -r * 0.55, r * 0.1, -r * 0.65], pal.hair, true, 2);
      eye(ctx, r, pal.eye, hd);
      mouth(ctx, r, hd);
    },
    iceman(ctx, r, pal, f, an, hd) {
      if (f.snowman) {
        A.circle(ctx, 0, 0, r * 1.05, pal.skin, true, 2);
        ctx.fillStyle = "#e0eaf2";
        ctx.beginPath();
        ctx.arc(-r * 0.4, -r * 0.4, r * 0.3, 0, Math.PI * 2);
        ctx.arc(r * 0.1, r * 0.5, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        eye(ctx, r, "#1a1a1a", hd);
        return;
      }
      face(ctx, r, pal.skin);
      // Crystal crest
      A.poly(ctx, [r * 0.6, -r * 0.7, r * 0.3, -r * 1.5, -r * 0.1, -r * 1.0, -r * 0.5, -r * 1.6, -r * 0.7, -r * 0.9, -r * 1.2, -r * 1.2, -r * 1.0, -r * 0.4], pal.hair, true, 1.5);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.3);
      ctx.lineTo(0, r * 0.2);
      ctx.lineTo(-r * 0.3, r * 0.7);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(r * 0.5, -r * 0.05, r * 0.16, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (f.goggles) {
        A.box(ctx, -r * 0.6, -r * 0.4, r * 1.5, r * 0.45, "#ff8a1a", true, r * 0.2, 1.5);
      }
      if (f.crown) A.poly(ctx, [-r * 0.6, -r * 0.9, -r * 0.4, -r * 1.6, -r * 0.1, -r * 1.05, r * 0.2, -r * 1.7, r * 0.45, -r * 1.0], "#e8fbff", true, 1.5);
      mouth(ctx, r, hd, true);
    },
    psylocke(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      A.poly(ctx, [r * 0.9, -r * 0.3, r * 0.7, -r * 1.2, -r * 0.3, -r * 1.4, -r * 1.25, -r * 0.7, -r * 1.2, r * 0.4, -r * 0.5, 0, -r * 0.1, -r * 0.6, r * 0.4, -r * 0.7], pal.hair, true, 2);
      eye(ctx, r, pal.eye, hd);
      if (f.faceMask) A.poly(ctx, [r * 0.95, r * 0.1, r * 0.9, r * 0.9, -r * 0.4, r * 0.9, -r * 0.3, r * 0.2], pal.mask, true, 1.5);
      if (an.state === "attack" || an.state === "special" || an.state === "ultimate" || an.power > 0) {
        A.glow(ctx, r * 0.45, -r * 0.1, r * 1.3, pal.glow, 0.85);
        phoenixEmblem(ctx, r * 0.45, -r * 0.15, r * 0.5, pal.glow);
      }
      if (!f.faceMask) mouth(ctx, r, hd);
    },
    jubilee(ctx, r, pal, f, an, hd) {
      face(ctx, r, pal.skin);
      A.poly(ctx, [r * 0.9, -r * 0.3, r * 0.6, -r * 1.15, -r * 0.4, -r * 1.25, -r * 1.15, -r * 0.6, -r * 1.05, r * 0.55, -r * 0.6, r * 0.6, -r * 0.4, -r * 0.1, r * 0.2, -r * 0.5, r * 0.6, -r * 0.2], pal.hair, true, 2);
      if (f.helmet) A.poly(ctx, [r * 0.85, -r * 0.4, r * 0.6, -r * 1.2, -r * 0.5, -r * 1.3, -r * 1.1, -r * 0.5, r * 0.85, -r * 0.4], "#2a9ad6", true, 1.5);
      if (f.glasses) {
        A.box(ctx, -r * 0.3, -r * 1.1, r * 1.1, r * 0.35, pal.mask, true, r * 0.15, 1.2);
      }
      eye(ctx, r, pal.eye, hd);
      A.circle(ctx, -r * 0.15, r * 0.5, r * 0.18, null, true, 1);
      mouth(ctx, r, hd, true);
    },
    professorx(ctx, r, pal, f, an, hd) {
      face(ctx, r * 1.02, pal.skin);
      A.glow(ctx, -r * 0.2, -r * 0.6, r * 0.6, "#ffffff", 0.3);
      if (f.helmet) {
        A.poly(ctx, [r * 0.8, -r * 0.3, r * 0.6, -r * 1.1, -r * 0.5, -r * 1.2, -r * 1.1, -r * 0.4, -r * 0.9, r * 0.2, r * 0.8, -r * 0.3], pal.trim, true, 2);
        ctx.strokeStyle = "#3a8ad0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, -r * 0.2);
        ctx.quadraticCurveTo(-r * 1.6, r * 0.6, -r * 1.2, r * 1.3);
        ctx.stroke();
      }
      eye(ctx, r, pal.eye, hd);
      ctx.strokeStyle = A.OUTLINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-r * 0.6, r * 0.05, r * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      if (an.power > 0 || an.state === "attack" || an.state === "special" || an.state === "ultimate") A.glow(ctx, r * 0.3, -r * 0.3, r * 2.2, pal.glow, 0.5);
      mouth(ctx, r, hd);
    },
  };

  // ---------------- Back layers: capes, coats, hair, tails ----------------
  function drawBack(ctx, ch, S, pal, f, an) {
    const t = an.t || 0;
    const flow = U.clamp(Math.abs(an.speed || 0) / 300, 0, 1);
    const flap = sin(t * 9) * (2 + flow * 4);
    const lift = U.clamp(-(an.vy || 0) / 600, -1, 1);
    const r = ch.body.head;
    if (f.longHair || ch.id === "psylocke") {
      const hc = pal.hair;
      const hx = S.head.x;
      const hy = S.head.y;
      const len = ch.id === "storm" ? 26 : 22;
      A.poly(ctx, [hx + r * 0.2, hy - r * 0.9, hx - r * 1.2, hy - r * 0.4, hx - r * 1.5 - flow * 10 + flap * 0.4, hy + len * 0.6 + lift * 6, hx - r * 0.4 - flow * 8 + flap * 0.3, hy + len + lift * 8, hx - r * 0.2, hy + r * 0.6], hc, true, 2);
    }
    if (f.tail) {
      const hx = S.hip.x - 3;
      const hy = S.hip.y - 2;
      const sw = sin(t * 3) * 6;
      ctx.lineCap = "round";
      ctx.strokeStyle = A.OUTLINE;
      ctx.lineWidth = 5;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.bezierCurveTo(hx - 18, hy + 6, hx - 26 - flow * 6, hy - 10 + sw, hx - 18 - flow * 8, hy - 22 + sw);
      };
      path();
      ctx.stroke();
      ctx.strokeStyle = pal.skin;
      ctx.lineWidth = 2.8;
      path();
      ctx.stroke();
      const tx = hx - 18 - flow * 8;
      const ty = hy - 22 + sw;
      A.poly(ctx, [tx, ty - 6, tx + 4, ty, tx, ty + 3, tx - 4, ty], pal.skin, true, 1.5);
    }
    if (f.cape) {
      const sx = S.sh.x;
      const sy = S.sh.y;
      const bottom = S.hip.y + ch.body.legs * 0.85;
      const back = -10 - flow * 18 - lift * 4;
      const wide = ch.id === "storm" ? 1.3 : 1;
      A.poly(ctx, [sx + 3, sy - 2, sx - 4, sy - 3, sx + back * wide + flap, (sy + bottom) / 2 - lift * 6, sx + back * 1.25 * wide + flap * 1.3, bottom - lift * 10, sx + back * 0.8 + flap, bottom + 3 - lift * 8, sx + back * 0.45 + flap * 0.6, bottom - lift * 8, sx + 2, S.hip.y], pal.capeIn || A.shade(pal.cape, 0.2), true, 2);
      A.poly(ctx, [sx + 3, sy - 2, sx - 4, sy - 3, sx + back * wide * 0.9 + flap, (sy + bottom) / 2 - lift * 6, sx + back * 1.1 * wide + flap, bottom - 6 - lift * 10, sx - 2, S.hip.y - 4], pal.cape, false);
    }
    if (f.coat || f.robe || f.labcoat || f.smock) {
      const col = pal.coatIn || A.shade(pal.coat, -0.25);
      const sx = S.sh.x;
      const sy = S.sh.y;
      const len = ch.body.legs * (f.robe ? 0.95 : 0.75);
      const back = -8 - flow * 14;
      A.poly(ctx, [sx + 4, sy, sx - ch.body.chest * 0.55, sy + 1, S.hip.x + back + flap * 0.5, S.hip.y + len - lift * 4, S.hip.x + 6, S.hip.y + len + 1], col, true, 2);
    }
    if (f.staff) {
      ctx.save();
      ctx.translate(S.sh.x - 2, S.sh.y + 4);
      ctx.rotate(-0.6);
      A.limb(ctx, 0, -18, 0, 22, 2.5, pal.staff);
      ctx.restore();
    }
    if (f.scarf) {
      const sx = S.neck.x;
      const sy = S.neck.y + 2;
      A.poly(ctx, [sx - 2, sy - 2, sx - 14 - flow * 10, sy + 2 + flap * 0.5, sx - 16 - flow * 14, sy + 6 + flap, sx - 2, sy + 3], pal.accent, true, 1.5);
    }
  }

  function drawCoatFront(ctx, ch, S, pal, f, an) {
    if (!(f.coat || f.robe || f.labcoat || f.smock || f.jacket)) return;
    const flow = U.clamp(Math.abs(an.speed || 0) / 300, 0, 1);
    const sx = S.sh.x;
    const sy = S.sh.y;
    if (f.jacket) {
      ctx.save();
      ctx.translate(S.hip.x, S.hip.y);
      ctx.rotate(S.lean);
      const Lt = ch.body.torso;
      const cw = ch.body.chest / 2;
      A.poly(ctx, [-cw - 1, -Lt - 1, cw * 0.3, -Lt - 1, cw * 0.05, -Lt * 0.5, cw * 0.2, -2, -ch.body.hip / 2 - 1, -2], pal.coat, true, 1.8);
      ctx.restore();
      return;
    }
    const len = ch.body.legs * (f.robe ? 0.95 : 0.75);
    A.poly(ctx, [sx + 3, sy, sx + 6, sy + 4, S.hip.x + 4 - flow * 4, S.hip.y + len, S.hip.x - 3 - flow * 6, S.hip.y + len - 2, S.hip.x - 2, S.hip.y - 4], pal.coat, true, 1.8);
  }

  // ---------------- Professor X and his hover-chair ----------------
  function drawXavier(ctx, ch, pal, f, an, p) {
    const t = an.t || 0;
    const ko = an.state === "ko";
    const hover = ko ? 0 : sin(t * 2.2) * 2 - (an.state === "glide" || an.state === "jump" ? 4 : 0) - p.lift;
    const tilt = ko ? 0.25 : U.clamp((an.speed || 0) / 2000, -0.12, 0.12);
    ctx.save();
    ctx.translate(0, hover);
    ctx.rotate(tilt);
    if (f.aura || f.ultimate || an.power > 0) A.glow(ctx, 0, -30, 46, f.ultimate ? pal.glow : f.aura ? "#ffe9a0" : pal.glow, 0.45);
    // Hover field under the chair.
    if (!ko) {
      const g = 0.5 + 0.3 * sin(t * 6);
      A.glow(ctx, 0, -6, 22, pal.glow, g);
      ctx.fillStyle = A.rgba(pal.glow, 0.4);
      ctx.beginPath();
      ctx.ellipse(0, -4, 16, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (f.cape) A.poly(ctx, [-6, -46, -16, -40, -22, -14, -8, -18], pal.suit2, true, 1.5);
    // Chair back and base
    A.box(ctx, -15, -50, 7, 30, pal.chair, true, 3, 2);
    A.poly(ctx, [-16, -22, 16, -22, 12, -10, -12, -10], pal.chair, true, 2);
    A.poly(ctx, [-12, -10, 12, -10, 7, -6, -7, -6], pal.chair2, true, 1.5);
    A.circle(ctx, -6, -8, 2, pal.glow, false);
    A.circle(ctx, 6, -8, 2, pal.glow, false);
    // Seated body
    const hip = { x: -4, y: -24 };
    const knee = { x: 10, y: -25 };
    const foot = { x: 13, y: -11 };
    A.limb2(ctx, hip, knee, foot, 8, 7, A.shade(pal.suit, -0.15));
    A.ellipse(ctx, foot.x + 3, foot.y, 5, 2.5, 0, pal.boots, true, 1.5);
    const neck = { x: -2 + p.lean * 6, y: -46 };
    A.poly(ctx, [hip.x - 7, hip.y + 2, hip.x + 7, hip.y + 2, neck.x + 8, neck.y + 3, neck.x - 8, neck.y + 3], pal.suit, true, 2);
    A.poly(ctx, [neck.x + 1, neck.y + 2, neck.x + 6, neck.y + 2, neck.x + 3, neck.y + 12], pal.suit2, true, 1);
    if (f.tie) A.poly(ctx, [neck.x + 3, neck.y + 3, neck.x + 5, neck.y + 4, neck.x + 4, neck.y + 13, neck.x + 2.5, neck.y + 12], pal.accent, true, 0.8);
    if (f.armor) A.ellipse(ctx, neck.x, neck.y + 4, 9, 4, 0, pal.trim, true, 1.5);
    if (f.damaged) {
      ctx.fillStyle = "rgba(30,20,20,0.35)";
      ctx.beginPath();
      ctx.arc(neck.x - 2, neck.y + 14, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (f.stealth) {
      ctx.strokeStyle = pal.glow;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(neck.x - 6, neck.y + 4);
      ctx.lineTo(hip.x, hip.y);
      ctx.stroke();
    }
    if (f.ultimate) A.xLogo(ctx, neck.x - 1, neck.y + 11, 3.2, pal.glow, "#111");
    // Arms
    const sh = { x: neck.x, y: neck.y + 4 };
    const up = 11;
    const fo = 11;
    const eB = J(sh, p.armB[0], up);
    const hB = J(eB, p.armB[0] + p.armB[1], fo);
    const eF = J(sh, p.armF[0], up);
    const hF = J(eF, p.armF[0] + p.armF[1], fo);
    A.limb2(ctx, sh, eB, hB, 6, 5, A.shade(pal.suit, -0.25));
    A.circle(ctx, hB.x, hB.y, 3, pal.skin, true, 1);
    // Armrest in front of the back arm
    A.box(ctx, -10, -27, 22, 4, pal.chair2, true, 2, 1.5);
    // Head
    const head = { x: neck.x + 2, y: neck.y - 9 };
    ctx.save();
    ctx.translate(head.x, head.y);
    HEADS.professorx(ctx, ch.body.head, pal, f, an, an.hd);
    ctx.restore();
    A.limb2(ctx, sh, eF, hF, 6, 5, pal.suit);
    A.circle(ctx, hF.x, hF.y, 3, pal.skin, true, 1);
    if (an.power > 0 || an.state === "attack" || an.state === "special") A.glow(ctx, hF.x, hF.y, 10, pal.glow, 0.8);
    ctx.restore();
  }

  // ---------------- Public API ----------------
  const CharArt = {
    pose,
    // Draws a hero with feet at (x, y). look = outfit {pal, flags}.
    draw(ctx, charId, look, an, x, y, facing = 1, scale = 1, alpha = 1) {
      const ch = XM.CHAR[charId];
      const pal = look.pal;
      const f = look.flags;
      const p = pose(ch, an);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(facing * scale, scale);
      if (alpha < 1) ctx.globalAlpha = alpha;
      if (charId === "professorx") {
        drawXavier(ctx, ch, pal, f, an, p);
        ctx.restore();
        return;
      }
      const S = skeleton(ch, p);
      if (p.rot) {
        const cy = S.hip.y - ch.body.torso * 0.3;
        ctx.translate(0, cy);
        ctx.rotate(p.rot);
        ctx.translate(0, -cy);
      }
      const t = an.t || 0;
      if (f.aura || f.ultimate) {
        const auraCol = f.ultimate ? pal.glow : "#ffe9a0";
        A.glow(ctx, S.hip.x, S.hip.y - ch.body.torso * 0.4, 40 + sin(t * 3) * 4, auraCol, 0.4);
      }
      if (an.power > 0) A.glow(ctx, S.hip.x, S.hip.y - 10, 38 + an.power * 20, pal.glow, 0.35 + an.power * 0.3);
      drawBack(ctx, ch, S, pal, f, an);
      drawArm(ctx, ch, S.sh, S.eB, S.hB, pal, f, true, false, an);
      drawLeg(ctx, ch, S.hip, S.kB, S.fB, pal, f, true, t);
      drawTorso(ctx, ch, S, pal, f, an);
      drawLeg(ctx, ch, S.hip, S.kF, S.fF, pal, f, false, t);
      drawCoatFront(ctx, ch, S, pal, f, an);
      // Neck and head
      A.limb(ctx, S.neck.x - 1, S.neck.y + 3, S.head.x - 1, S.head.y + ch.body.head * 0.5, ch.body.head * 0.75, f.fur || f.steel || f.iceForm ? pal.skin : pal.skin);
      ctx.save();
      ctx.translate(S.head.x, S.head.y);
      ctx.rotate(S.ha);
      HEADS[charId](ctx, ch.body.head, pal, f, an, an.hd);
      ctx.restore();
      drawArm(ctx, ch, S.sh, S.eF, S.hF, pal, f, false, true, an);
      if (f.ultimate && Math.random() < 0.3) A.glow(ctx, S.hip.x + (Math.random() - 0.5) * 30, S.hip.y - Math.random() * 40, 4, pal.glow, 0.9);
      ctx.restore();
    },

    // Head-and-shoulders portrait, clipped to a circle or box.
    portrait(ctx, charId, look, x, y, size, opts = {}) {
      const ch = XM.CHAR[charId];
      ctx.save();
      ctx.beginPath();
      if (opts.box) ctx.rect(x - size / 2, y - size / 2, size, size);
      else ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.clip();
      if (opts.bg !== false) {
        const g = ctx.createLinearGradient(x, y - size / 2, x, y + size / 2);
        g.addColorStop(0, A.shade(ch.color, 0.25));
        g.addColorStop(1, A.shade(ch.color, -0.55));
        ctx.fillStyle = g;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = A.halftone(ctx, "rgba(0,0,0,0.18)");
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
      const scale = (size / (ch.body.head * 2)) * 0.42;
      const headY = charId === "professorx" ? 55 : ch.body.legs + ch.body.torso + ch.body.head;
      const an = { state: "idle", t: opts.t || 0, hd: true, power: opts.power || 0 };
      this.draw(ctx, charId, look, an, x - size * 0.06, y + headY * scale + size * 0.05, opts.facing || 1, scale);
      ctx.restore();
      if (opts.ring !== false) {
        ctx.strokeStyle = opts.ring || A.OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (opts.box) ctx.rect(x - size / 2, y - size / 2, size, size);
        else ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  };

  XM.CharArt = CharArt;
})(window.XM);
