/*
 * The Grinch (an original drawing: green fur, yellow eyes, Santa hat, red coat and huge
 * gloves), his Snow-Slinger launcher, the snowballs, Max the dog and speech bubbles.
 *
 * The Grinch is drawn from a simple skeleton (hips, shoulders, two-bone arms and legs), so
 * each animation is just a pose function of time.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const TAU = Math.PI * 2;
  const FUR = "#5cb531";
  const FUR_DARK = "#3c8a1e";
  const FUR_LIGHT = "#86d455";
  const COAT = "#d42a33";
  const COAT_DARK = "#9c1820";

  // Two-bone reach: returns the elbow/knee point for a limb from (ax, ay) to (bx, by).
  function joint(ax, ay, bx, by, l1, l2, bendSign) {
    let dx = bx - ax;
    let dy = by - ay;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
      bx = ax + dx;
      by = ay + dy;
      d = max;
    }
    d = Math.max(d, 1);
    const a = Math.acos(G.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const base = Math.atan2(dy, dx);
    const ang = base + a * bendSign;
    return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, bx, by };
  }

  function limb(ctx, ax, ay, jx, jy, bx, by, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(jx, jy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // Fur tufts at the joint.
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) Art.circle(ctx, jx + (i - 1) * 3, jy + (i % 2) * 2, w * 0.55);
  }

  function glove(ctx, x, y, r, open, fist) {
    Art.circle(ctx, x, y, r, "#ffffff");
    ctx.strokeStyle = "#c9d6e6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    if (open) {
      for (let i = -1; i <= 1; i++) Art.ellipse(ctx, x + i * r * 0.55, y - r * 0.95, r * 0.28, r * 0.5, "#ffffff");
      Art.ellipse(ctx, x + r * 0.95, y - r * 0.2, r * 0.45, r * 0.25, "#ffffff");
    } else if (fist) {
      ctx.strokeStyle = "#c9d6e6";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * r * 0.45, y - r * 0.5, r * 0.25, Math.PI, 0);
        ctx.stroke();
      }
    }
    // Red cuff.
    Art.ellipse(ctx, x - r * 0.1, y + r * 0.85, r * 0.85, r * 0.35, COAT);
  }

  // ---------------------------------------------------------------- Face

  function face(ctx, expr, time) {
    // Head-local coordinates: (0, 0) is the centre of the head, facing right.
    const blink = (expr === "sly" || expr === "grin") && time % 3.4 < 0.12;
    ctx.lineCap = "round";
    // Eyes.
    const eyes = [
      [6, -6, 7.5],
      [24, -7, 6.5],
    ];
    for (let i = 0; i < 2; i++) {
      const [ex, ey, er] = eyes[i];
      if (expr === "laugh" || expr === "joy") {
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex, ey + 2, er * 0.75, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        continue;
      }
      if (expr === "dizzy") {
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let a = 0; a < TAU * 1.6; a += 0.3) {
          const rr = a * 0.75;
          const px = ex + Math.cos(a + time * 8) * rr;
          const py = ey + Math.sin(a + time * 8) * rr;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }
      const big = expr === "shock" ? 1.4 : 1;
      const squint = expr === "squint" && i === 0;
      Art.ellipse(ctx, ex, ey, er * big, er * 0.82 * big, "#fff36b");
      ctx.strokeStyle = "#2c5a12";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (blink || squint) {
        ctx.fillStyle = FUR;
        ctx.fillRect(ex - er - 1, ey - er - 1, er * 2 + 2, er + 2);
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - er, ey + (squint ? 0 : 1));
        ctx.lineTo(ex + er, ey + (squint ? 0 : 1));
        ctx.stroke();
        if (blink) continue;
        if (squint) continue;
      }
      const pr = expr === "shock" ? er * 0.3 : er * 0.42;
      const look = expr === "sad" ? 2 : expr === "mad" ? 0 : 1.5;
      Art.circle(ctx, ex + look, ey + (expr === "sad" ? 2 : 0.5), pr, "#c0182c");
      Art.circle(ctx, ex + look, ey + (expr === "sad" ? 2 : 0.5), pr * 0.5, "#1d1010");
      if (expr === "sad" || expr === "sly") {
        // Heavy lids.
        ctx.fillStyle = FUR;
        ctx.fillRect(ex - er - 1, ey - er - 1, er * 2 + 2, er * (expr === "sad" ? 0.9 : 0.7));
      }
    }
    // Brows.
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (expr === "mad" || expr === "squint") {
      ctx.moveTo(-1, -17);
      ctx.lineTo(13, -11);
      ctx.moveTo(18, -11);
      ctx.lineTo(31, -18);
    } else if (expr === "shock") {
      ctx.moveTo(-1, -22);
      ctx.lineTo(12, -24);
      ctx.moveTo(18, -24);
      ctx.lineTo(31, -22);
    } else if (expr === "sad") {
      ctx.moveTo(-1, -12);
      ctx.lineTo(12, -17);
      ctx.moveTo(19, -17);
      ctx.lineTo(31, -11);
    } else if (expr !== "joy" && expr !== "laugh") {
      ctx.moveTo(-2, -14);
      ctx.lineTo(12, -17);
      ctx.moveTo(18, -19);
      ctx.lineTo(31, -12);
    }
    ctx.stroke();
    // Nose.
    Art.ellipse(ctx, 33, 1, 4.5, 3, FUR_DARK);
    // Mouth.
    ctx.strokeStyle = "#1d2a12";
    ctx.lineWidth = 2.5;
    if (expr === "laugh" || expr === "joy") {
      ctx.fillStyle = "#3a1010";
      ctx.beginPath();
      ctx.moveTo(-2, 8);
      ctx.quadraticCurveTo(14, 30, 34, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff7a8a";
      Art.ellipse(ctx, 16, 18, 7, 4);
      ctx.fill();
      ctx.fillStyle = "#fffbe0";
      ctx.fillRect(2, 8, 28, 3);
    } else if (expr === "shock") {
      Art.ellipse(ctx, 18, 14, 6, 8, "#3a1010");
    } else if (expr === "mad") {
      ctx.fillStyle = "#fffbe0";
      Art.roundRect(ctx, 4, 8, 26, 9, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        ctx.moveTo(4 + i * 5.2, 8);
        ctx.lineTo(4 + i * 5.2, 17);
      }
      ctx.stroke();
    } else if (expr === "sad") {
      ctx.beginPath();
      ctx.moveTo(4, 17);
      ctx.quadraticCurveTo(17, 7, 30, 16);
      ctx.stroke();
    } else if (expr === "dizzy") {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) ctx.lineTo(4 + i * 3.4, 13 + Math.sin(i * 1.6 + time * 10) * 2);
      ctx.stroke();
    } else {
      // The sly grin: wide and curling up at the cheek.
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.quadraticCurveTo(14, 20, 34, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(34, 4);
      ctx.lineTo(38, -1);
      ctx.stroke();
      if (expr === "squint") {
        ctx.fillStyle = "#ff6b8a";
        Art.ellipse(ctx, 22, 15, 4, 5, "#ff6b8a");
      }
    }
  }

  // ---------------------------------------------------------------- Pose

  // Returns the pose for animation `anim` at `at` seconds in, plus the idle clock.
  function pose(g, time) {
    const at = g.at;
    const p = {
      hipY: -86 + Math.sin(time * 2.2) * 1.5,
      lean: 0.04,
      headTilt: 0,
      jump: 0,
      fall: 0,
      expr: "sly",
      back: { x: -20, y: -78 },
      front: { x: 34, y: -72 },
      footL: { x: -10, y: 0 },
      footR: { x: 14, y: 0 },
      backOpen: false,
      frontOpen: false,
      fist: false,
      hatPop: 0,
      shake: 0,
      steam: false,
      sweat: false,
      stars: false,
    };
    // Rubbing hands sneakily now and then.
    if (g.anim === "idle") {
      const cycle = time % 7;
      if (cycle > 4.6 && cycle < 6.2) {
        const r = Math.sin(time * 18) * 4;
        p.back = { x: 18 + r, y: -112 };
        p.front = { x: 30 - r, y: -110 };
        p.expr = "grin";
      }
      p.footR.x = 14 + (time % 3 < 0.25 ? 3 : 0);
    } else if (g.anim === "load") {
      const k = Math.min(1, at / 0.6);
      const dip = Math.sin(k * Math.PI);
      p.hipY = -86 + dip * 22;
      p.lean = 0.04 + dip * 0.5;
      p.front = { x: G.lerp(40, g.pouchLX, k * k), y: G.lerp(-12, g.pouchLY, k * k) };
      p.back = { x: G.lerp(30, -10, k), y: G.lerp(-20, -80, k) };
      p.expr = "grin";
    } else if (g.anim === "aim") {
      p.lean = -0.1 - g.power * 0.12;
      p.hipY = -84 + g.power * 6;
      p.front = { x: g.pouchLX - 4, y: g.pouchLY + 2 };
      p.back = { x: g.pouchLX - 14, y: g.pouchLY + 8 };
      p.expr = g.power > 0.75 ? "mad" : "squint";
      p.footR.x = 22;
      p.footL.x = -18;
    } else if (g.anim === "throw") {
      const k = Math.min(1, at / 0.35);
      p.lean = 0.25 * Math.sin(k * Math.PI * 0.8);
      p.front = { x: 70, y: -130 + k * 30 };
      p.back = { x: -40, y: -100 };
      p.frontOpen = true;
      p.expr = "grin";
      p.footR.x = 26;
    } else if (g.anim === "celebrate") {
      p.jump = -Math.abs(Math.sin(at * 7)) * 34;
      p.back = { x: -40, y: -214 + Math.sin(at * 14) * 6 };
      p.front = { x: 46, y: -218 + Math.cos(at * 14) * 6 };
      p.backOpen = true;
      p.frontOpen = true;
      p.expr = "joy";
      p.hatPop = Math.abs(Math.sin(at * 7)) * 8;
      p.footL = { x: -14, y: p.jump < -10 ? -10 : 0 };
    } else if (g.anim === "laugh") {
      p.shake = Math.sin(at * 40) * 2;
      p.lean = -0.18 + Math.sin(at * 10) * 0.05;
      p.headTilt = -0.25;
      p.back = { x: 0, y: -84 };
      p.front = { x: 22, y: -80 };
      p.expr = "laugh";
      p.hipY = -86 + Math.abs(Math.sin(at * 10)) * 4;
    } else if (g.anim === "frustrated") {
      const stomp = Math.sin(at * 16);
      p.footL = { x: -10, y: stomp > 0 ? -stomp * 16 : 0 };
      p.footR = { x: 14, y: stomp < 0 ? stomp * 16 : 0 };
      p.back = { x: -24, y: -214 + Math.sin(at * 30) * 8 };
      p.front = { x: 30, y: -212 + Math.cos(at * 30) * 8 };
      p.fist = true;
      p.expr = "mad";
      p.steam = true;
      p.shake = Math.sin(at * 50) * 1.5;
    } else if (g.anim === "surprised") {
      const k = Math.min(1, at / 0.25);
      p.jump = -Math.sin(Math.min(1, at / 0.5) * Math.PI) * 26;
      p.back = { x: -46, y: -150 };
      p.front = { x: 52, y: -152 };
      p.backOpen = true;
      p.frontOpen = true;
      p.expr = "shock";
      p.hatPop = 18 * k * (1 - Math.min(1, Math.max(0, at - 0.6) / 0.4));
      p.lean = -0.15;
    } else if (g.anim === "disappointed") {
      p.lean = 0.3;
      p.hipY = -80;
      p.headTilt = 0.35;
      p.back = { x: -6, y: -34 };
      p.front = { x: 14, y: -30 };
      p.expr = "sad";
      p.sweat = true;
    } else if (g.anim === "dance") {
      const s = Math.sin(at * 10);
      p.lean = s * 0.15;
      p.hipY = -86 + Math.abs(Math.cos(at * 10)) * 6;
      p.footL = { x: -14 + s * 4, y: s > 0.3 ? -14 : 0 };
      p.footR = { x: 16 + s * 4, y: s < -0.3 ? -14 : 0 };
      p.back = { x: -40 + s * 10, y: -170 + s * 30 };
      p.front = { x: 46 + s * 10, y: -170 - s * 30 };
      p.backOpen = true;
      p.frontOpen = true;
      p.expr = "joy";
      p.headTilt = s * 0.15;
    } else if (g.anim === "hold") {
      // Title screen: hugging a giant snowball, bouncing it a little.
      const b = Math.sin(time * 3) * 4;
      p.back = { x: 30, y: -118 + b };
      p.front = { x: 88, y: -112 + b };
      p.lean = 0.05;
      p.expr = time % 5 > 3.6 ? "laugh" : "grin";
      p.holdY = -118 + b;
    } else if (g.anim === "fallback") {
      const k = at < 0.35 ? at / 0.35 : at < 1.7 ? 1 : Math.max(0, 1 - (at - 1.7) / 0.5);
      p.fall = -1.45 * G.easeOutBack(Math.min(1, k));
      p.expr = at < 1.7 ? "laugh" : "dizzy";
      p.stars = at > 0.35 && at < 2.1;
      const kick = Math.sin(at * 22);
      p.footL = { x: -10 + kick * 8, y: at > 0.35 && at < 1.7 ? -30 - kick * 14 : 0 };
      p.footR = { x: 14 - kick * 8, y: at > 0.35 && at < 1.7 ? -36 + kick * 14 : 0 };
      p.back = { x: -10, y: -84 };
      p.front = { x: 18, y: -80 };
    }
    return p;
  }

  // ---------------------------------------------------------------- Grinch

  // g: { x, y, anim, at, power, pouch: {x, y} } with (x, y) the point between the feet.
  Art.drawGrinch = (ctx, g, time) => {
    // Hands aim at the pouch, given relative to the feet.
    const S = g.scale || 1.22;
    g.pouchLX = g.pouch ? (g.pouch.x - g.x) / S : 60;
    g.pouchLY = g.pouch ? (g.pouch.y - g.y) / S : -110;
    const p = pose(g, time);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(S, S);
    ctx.translate(p.shake, p.jump);
    if (p.fall) ctx.rotate(p.fall);
    // Shadow.
    ctx.save();
    ctx.rotate(-p.fall);
    Art.ellipse(ctx, 0, 2 - p.jump, 46, 7, "rgba(40, 60, 100, 0.25)");
    ctx.restore();

    const hipY = p.hipY;
    const hip = { x: 0, y: hipY };
    // Torso leans around the hips.
    const lean = p.lean;
    const sh = { x: Math.sin(lean) * 52, y: hipY - Math.cos(lean) * 52 };
    const neck = { x: Math.sin(lean) * 66, y: hipY - Math.cos(lean) * 66 };

    // Back leg and arm.
    const legW = 10;
    const kL = joint(hip.x - 6, hip.y, p.footL.x, p.footL.y - 6, 46, 44, -1);
    limb(ctx, hip.x - 6, hip.y, kL.jx, kL.jy, kL.bx, kL.by, legW, FUR_DARK);
    Art.ellipse(ctx, kL.bx + 6, kL.by + 4, 15, 6, FUR_DARK);
    const aB = joint(sh.x - 8, sh.y, p.back.x, p.back.y, 44, 44, 1);
    limb(ctx, sh.x - 8, sh.y, aB.jx, aB.jy, aB.bx, aB.by, 9, FUR_DARK);
    glove(ctx, aB.bx, aB.by, 12, p.backOpen, p.fist);

    // Body: furry belly, red coat with white trim and a belt.
    ctx.save();
    ctx.translate(hip.x, hip.y);
    ctx.rotate(lean);
    Art.fluff(ctx, 0, -26, 30, 40, 14, 0.08, FUR);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(-30, -52);
    ctx.quadraticCurveTo(-38, -10, -32, 14);
    ctx.lineTo(30, 14);
    ctx.quadraticCurveTo(40, -10, 26, -52);
    ctx.quadraticCurveTo(0, -64, -30, -52);
    ctx.closePath();
    ctx.fill();
    // Open front showing the furry belly.
    Art.fluff(ctx, 12, -18, 13, 26, 9, 0.12, FUR_LIGHT);
    ctx.fillStyle = "#1d1d26";
    ctx.fillRect(-32, -6, 64, 9);
    ctx.fillStyle = "#ffd23f";
    Art.roundRect(ctx, 6, -8, 14, 13, 2);
    ctx.fill();
    ctx.fillStyle = "#1d1d26";
    ctx.fillRect(10, -4, 6, 5);
    // White fur trim.
    for (let i = 0; i < 8; i++) Art.circle(ctx, -30 + i * 8.6, 14, 6, "#ffffff");
    for (let i = 0; i < 5; i++) Art.circle(ctx, -24 + i * 12, -54 + Math.abs(i - 2) * 1.5, 6, "#ffffff");
    ctx.restore();

    // Front leg.
    const kR = joint(hip.x + 8, hip.y, p.footR.x, p.footR.y - 6, 46, 44, -1);
    limb(ctx, hip.x + 8, hip.y, kR.jx, kR.jy, kR.bx, kR.by, legW, FUR);
    Art.ellipse(ctx, kR.bx + 7, kR.by + 4, 16, 6.5, FUR);
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(kR.bx + 14 + i * 2, kR.by + 1);
      ctx.lineTo(kR.bx + 22 + i * 2, kR.by + 3);
      ctx.stroke();
    }

    // Head.
    ctx.save();
    ctx.translate(neck.x + 4, neck.y - 26);
    ctx.rotate(lean * 0.6 + p.headTilt);
    // Neck fur.
    Art.fluff(ctx, -4, 22, 15, 12, 8, 0.15, FUR);
    // Head shape: tall pear with a pointy chin, fur tufts on the cheeks.
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.bezierCurveTo(-26, -34, 34, -40, 34, -10);
    ctx.bezierCurveTo(48, 6, 34, 26, 16, 26);
    ctx.bezierCurveTo(0, 26, -20, 20, -22, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const [tx, ty, a] of [[-22, 6, 2.6], [-18, 16, 2.2], [40, 8, -0.4]]) {
      ctx.fillStyle = FUR;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 5);
      ctx.lineTo(tx + Math.cos(a) * 12, ty + Math.sin(a) * 12);
      ctx.lineTo(tx, ty + 5);
      ctx.closePath();
      ctx.fill();
    }
    face(ctx, p.expr, time);
    // Santa hat flopping back, with a pompom.
    ctx.save();
    ctx.translate(0, -p.hatPop);
    const flop = Math.sin(time * 3) * 0.08 + (p.jump ? 0.25 : 0);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(-24, -24);
    ctx.quadraticCurveTo(0, -78, -36 + flop * 30, -64);
    ctx.quadraticCurveTo(-54 + flop * 40, -50, -60 + flop * 30, -30);
    ctx.lineTo(-52 + flop * 30, -26);
    ctx.quadraticCurveTo(-36, -50, -6, -48);
    ctx.quadraticCurveTo(26, -50, 34, -26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COAT_DARK;
    ctx.beginPath();
    ctx.moveTo(-36 + flop * 30, -64);
    ctx.quadraticCurveTo(-54 + flop * 40, -50, -60 + flop * 30, -30);
    ctx.lineTo(-52 + flop * 30, -26);
    ctx.quadraticCurveTo(-44, -48, -36 + flop * 30, -64);
    ctx.fill();
    Art.fluff(ctx, -62 + flop * 30, -26, 10, 10, 8, 0.2, "#ffffff");
    Art.roundRect(ctx, -30, -34, 68, 14, 7);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    for (let i = 0; i < 6; i++) Art.circle(ctx, -26 + i * 12, -27 + (i % 2), 6, "#ffffff");
    ctx.restore();
    if (p.steam) {
      for (let i = 0; i < 2; i++) {
        const k = (time * 2 + i * 0.5) % 1;
        Art.fluff(ctx, -26 - k * 14, -10 - k * 40, 6 + k * 8, 5 + k * 6, 6, 0.2, `rgba(255,255,255,${0.8 - k * 0.8})`);
      }
    }
    if (p.sweat) {
      const k = (time * 0.8) % 1;
      ctx.fillStyle = "#7fd0ff";
      ctx.beginPath();
      ctx.moveTo(-14, -12 + k * 20);
      ctx.quadraticCurveTo(-20, -2 + k * 20, -14, 0 + k * 20);
      ctx.quadraticCurveTo(-8, -2 + k * 20, -14, -12 + k * 20);
      ctx.fill();
    }
    if (p.stars) {
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + (i * TAU) / 3;
        ctx.fillStyle = "#ffd23f";
        Art.starPath(ctx, Math.cos(a) * 30, -46 + Math.sin(a) * 9, 7);
        ctx.fill();
      }
    }
    ctx.restore();

    if (p.holdY) Art.drawSnowball(ctx, 62, p.holdY, 40, "normal", 0, time, true, 1);

    // Front arm on top.
    const aF = joint(sh.x + 10, sh.y + 2, p.front.x, p.front.y, 44, 44, 1);
    limb(ctx, sh.x + 10, sh.y + 2, aF.jx, aF.jy, aF.bx, aF.by, 9.5, FUR);
    glove(ctx, aF.bx, aF.by, 13, p.frontOpen, p.fist);
    ctx.restore();
  };

  // ---------------------------------------------------------------- Launcher

  G.LAUNCH = { x: 340, y: 690, tipBack: { x: 322, y: 676 }, tipFront: { x: 360, y: 672 } };

  Art.drawLauncherBack = (ctx, pouch) => {
    const L = G.LAUNCH;
    // Back prong and band.
    ctx.strokeStyle = "#5a3416";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(340, 760);
    ctx.quadraticCurveTo(326, 720, L.tipBack.x, L.tipBack.y);
    ctx.stroke();
    band(ctx, L.tipBack, pouch, "#2a6e2f");
  };

  Art.drawLauncherFront = (ctx, pouch, hasBall) => {
    const L = G.LAUNCH;
    band(ctx, L.tipFront, pouch, "#3c9a3f");
    // Pouch: a stolen stocking.
    if (hasBall || pouch) {
      ctx.fillStyle = "#c4161c";
      Art.roundRect(ctx, pouch.x - 12, pouch.y - 9, 20, 18, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(pouch.x - 12, pouch.y - 9, 5, 18);
    }
    // Trunk and front prong.
    ctx.strokeStyle = "#7a4a22";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(340, G.HILL_Y + 6);
    ctx.lineTo(340, 750);
    ctx.quadraticCurveTo(356, 718, L.tipFront.x, L.tipFront.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(336, G.HILL_Y);
    ctx.lineTo(336, 752);
    ctx.stroke();
    // Snow on top of the prongs and a wooden sign.
    Art.ellipse(ctx, L.tipFront.x, L.tipFront.y - 6, 10, 5, "#ffffff");
    Art.ellipse(ctx, L.tipBack.x, L.tipBack.y - 6, 9, 4, "#f0f6fc");
    ctx.save();
    ctx.translate(340, 786);
    ctx.rotate(0.05);
    Art.roundRect(ctx, -34, -11, 68, 22, 4);
    ctx.fillStyle = "#a8692f";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 10px Oxanium, 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SNOW-SLINGER", 0, 0);
    ctx.restore();
  };

  function band(ctx, tip, pouch, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(pouch.x, pouch.y);
    ctx.stroke();
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------------------------------------------------------------- Snowballs

  const RAINBOW = ["#ff4b5c", "#ff9f1c", "#ffd23f", "#4be37a", "#3fb7ff", "#9b4dff"];
  G.SNOWBALL_COLORS = {
    normal: "#ffffff",
    mega: "#bfe8ff",
    bouncy: "#ff7ad9",
    explosive: "#ff4b5c",
    split: "#9fe6ff",
    rainbow: "#ffd23f",
  };

  // A snowball with a determined little face.
  Art.drawSnowball = (ctx, x, y, r, type, spin, time, faceOn = true, vx = 1) => {
    ctx.save();
    ctx.translate(x, y);
    if (type === "rainbow") {
      ctx.save();
      ctx.rotate(spin);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, (i / 6) * TAU, ((i + 1) / 6) * TAU);
        ctx.closePath();
        ctx.fillStyle = RAINBOW[i];
        ctx.fill();
      }
      ctx.restore();
      const hg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      hg.addColorStop(0, "rgba(255,255,255,0.8)");
      hg.addColorStop(0.5, "rgba(255,255,255,0.15)");
      hg.addColorStop(1, "rgba(255,255,255,0)");
      Art.circle(ctx, 0, 0, r, hg);
    } else {
      const base = { normal: ["#ffffff", "#b5d3ef"], mega: ["#eef9ff", "#7fc2f0"], bouncy: ["#ffd1f1", "#e04fb4"], explosive: ["#ffd0d0", "#d61f2c"], split: ["#f2fcff", "#6fc8e8"] }[type] || ["#fff", "#b5d3ef"];
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, base[0]);
      g.addColorStop(1, base[1]);
      Art.circle(ctx, 0, 0, r, g);
      ctx.save();
      ctx.rotate(spin);
      if (type === "bouncy") {
        ctx.strokeStyle = "#5fd0ff";
        ctx.lineWidth = r * 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
      } else if (type === "explosive") {
        ctx.fillStyle = "#1d1d1d";
        ctx.fillRect(-r, -r * 0.14, r * 2, r * 0.28);
        ctx.fillStyle = "#ffd23f";
        for (let i = -3; i <= 3; i++) ctx.fillRect(i * r * 0.3 - r * 0.07, -r * 0.14, r * 0.14, r * 0.28);
      } else if (type === "split") {
        ctx.strokeStyle = "rgba(40, 120, 170, 0.7)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos((i * TAU) / 3) * r, Math.sin((i * TAU) / 3) * r);
          ctx.stroke();
        }
      } else if (type === "mega") {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
          ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
          ctx.stroke();
        }
      } else {
        // Lumpy snow texture.
        Art.circle(ctx, r * 0.35, r * 0.3, r * 0.14, "rgba(160, 195, 230, 0.5)");
        Art.circle(ctx, -r * 0.3, r * 0.45, r * 0.1, "rgba(160, 195, 230, 0.5)");
      }
      ctx.restore();
    }
    if (type === "explosive") {
      const f = (Math.sin(time * 40) + 1) / 2;
      Art.circle(ctx, 0, -r - 3, 3 + f * 3, "#ffb030");
      Art.sparkle(ctx, 0, -r - 3, 5 + f * 3, "#fff6a0");
    }
    if (faceOn) {
      // Angry little eyebrows and eyes, always upright, looking the way it flies.
      const d = vx >= 0 ? 1 : -1;
      const s = r / 20;
      ctx.fillStyle = "#1d1d26";
      Art.circle(ctx, d * 3 * s, -3 * s, 2.6 * s, "#1d1d26");
      Art.circle(ctx, d * 11 * s, -3 * s, 2.4 * s, "#1d1d26");
      ctx.strokeStyle = "#1d1d26";
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.moveTo(d * -1 * s, -10 * s);
      ctx.lineTo(d * 6 * s, -7 * s);
      ctx.moveTo(d * 8 * s, -7 * s);
      ctx.lineTo(d * 15 * s, -10 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d * 3 * s, 6 * s);
      ctx.quadraticCurveTo(d * 8 * s, 3 * s, d * 13 * s, 6 * s);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- Max

  // Max the dog with his antler headband. dir: 1 running right, -1 left.
  Art.drawMax = (ctx, x, y, time, dir, state) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    const run = state === "run" || state === "bump";
    const ph = time * (run ? 18 : 4);
    const bob = run ? Math.abs(Math.sin(ph)) * -5 : 0;
    Art.ellipse(ctx, 0, 2, 34, 6, "rgba(40,60,100,0.25)");
    ctx.translate(0, bob);
    const fur = "#8a5a33";
    const dark = "#5e3a1e";
    // Legs.
    ctx.strokeStyle = dark;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    for (const [lx, o] of [[-18, 0], [-10, Math.PI], [14, Math.PI * 0.5], [22, Math.PI * 1.5]]) {
      const sw = run ? Math.sin(ph + o) * 10 : 0;
      ctx.beginPath();
      ctx.moveTo(lx, -22);
      ctx.lineTo(lx + sw, -2);
      ctx.stroke();
    }
    // Tail.
    ctx.strokeStyle = fur;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-28, -32);
    ctx.quadraticCurveTo(-40, -48 + Math.sin(time * 20) * 6, -44, -56 + Math.sin(time * 20) * 8);
    ctx.stroke();
    // Body.
    Art.fluff(ctx, 0, -32, 32, 15, 14, 0.12, fur);
    // Head.
    Art.fluff(ctx, 34, -50, 17, 15, 10, 0.12, fur);
    Art.ellipse(ctx, 48, -44, 10, 7, "#a87448");
    Art.circle(ctx, 57, -46, 4, "#1d1d1d");
    Art.circle(ctx, 38, -55, 3.4, "#1d1d1d");
    Art.circle(ctx, 39, -56, 1.2, "#ffffff");
    // Ear.
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(26, -50, 6, 13, 0.5 + Math.sin(ph) * 0.2, 0, TAU);
    ctx.fill();
    // Tongue when running.
    if (run) Art.ellipse(ctx, 52, -36, 4, 6, "#ff7a8a");
    // Antler headband with red string.
    ctx.strokeStyle = "#c98a4b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(34, -62);
    ctx.lineTo(36, -84);
    ctx.moveTo(35, -74);
    ctx.lineTo(44, -82);
    ctx.moveTo(36, -82);
    ctx.lineTo(30, -90);
    ctx.stroke();
    ctx.strokeStyle = "#e0303a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(34, -64);
    ctx.quadraticCurveTo(40, -54, 46, -50);
    ctx.stroke();
    // Collar.
    ctx.strokeStyle = "#e0303a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(28, -42, 9, 0.4, 2.2);
    ctx.stroke();
    Art.circle(ctx, 26, -33, 3, "#ffd23f");
    ctx.restore();
  };

  // ---------------------------------------------------------------- Speech bubble

  // A rounded bubble whose tail points at (tx, ty). Text is drawn in world units.
  Art.bubble = (ctx, x, y, text, alpha, tx, ty) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "800 22px Oxanium, 'Trebuchet MS', sans-serif";
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > 300 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34;
    const h = lines.length * 26 + 22;
    const bx = x;
    const by = y - h;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1d2a4a";
    ctx.lineWidth = 3.5;
    Art.roundRect(ctx, bx, by, w, h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 26, by + h - 2);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 52, by + h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 26, by + h);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 52, by + h);
    ctx.stroke();
    ctx.fillStyle = "#1d2a4a";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, bx + 17, by + 12 + i * 26));
    ctx.restore();
  };
})(window.GS);
