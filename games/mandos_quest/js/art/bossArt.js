/* Large creatures and machines for the boss fights. */
(function (MQ) {
  const { box, poly, oval, line, glow, metal, shade, rng, lerp } = MQ.U;
  const INK = MQ.INK;
  const { sin, cos, max, PI } = Math;

  function fillPath(ctx, fill, width = 2.5) {
    ctx.fillStyle = fill;
    ctx.fill();
    if (width) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }

  function leg(ctx, hx, hy, fx, fy, first, second, bend, color, width, claws = 3) {
    const j = MQ.Anim.ik(hx, hy, fx, fy, first, second, bend);
    const { ex, ey } = j;
    MQ.Anim.limb(ctx, hx, hy, j.x, j.y, ex, ey, width, color);
    poly(ctx, [ex - width * 0.6, ey - width * 0.3, ex + width * 0.7, ey - width * 0.3, ex + width * 0.95, ey + width * 0.45, ex - width * 0.7, ey + width * 0.45], shade(color, -0.2), INK, 2);
    for (let i = 0; i < claws; i++) {
      const x = ex + width * (i * 0.42 - 0.1);
      poly(ctx, [x, ey + width * 0.2, x + width * 0.28, ey + width * 0.2, x + width * 0.3, ey + width * 0.5], "#d8cbb0", INK, 1);
    }
  }

  function stars(ctx, x, y, time) {
    for (let i = 0; i < 4; i++) {
      const a = time * 4 + (i * PI) / 2;
      glow(ctx, x + cos(a) * 34, y + sin(a) * 9, 13, "#ffe27a", 0.9);
      oval(ctx, x + cos(a) * 34, y + sin(a) * 9, 3, 3, "#fff6c9");
    }
  }

  // Fixed fur strands, so the coat doesn't shimmer.
  const FUR = (() => {
    const random = rng(42);
    return Array.from({ length: 110 }, () => {
      const a = random() * MQ.TAU;
      const d = Math.sqrt(random());
      return [-35 + cos(a) * d * 108, -105 + sin(a) * d * 52, random.range(10, 22), random() > 0.55];
    });
  })();

  /* ---------- Mudhorn ---------- */

  function mudhorn(ctx, b) {
    const t = b.time;
    const g = b.gait;
    const moving = b.moving;
    const stride = (offset) => (moving ? cos(g + offset) * 28 : 0);
    const lift = (offset) => (moving ? max(0, sin(g + offset)) * 18 : 0);
    const rear = b.rear || 0;

    leg(ctx, -105, -92, -100 + stride(2), -10 - lift(2), 46, 46, 1, "#3b2c22", 28);
    leg(ctx, 40, -92 - rear * 30, 52 + stride(4.5), -10 - lift(4.5) - rear * 50, 46, 46, -1, "#3b2c22", 28);

    ctx.save();
    ctx.translate(-90, -70);
    ctx.rotate(-rear * 0.28 + sin(t * 2.2) * 0.006);
    ctx.translate(90, 70);

    ctx.beginPath();
    ctx.moveTo(-160, -88);
    ctx.bezierCurveTo(-166, -152, -110, -164, -55, -162);
    ctx.bezierCurveTo(-30, -190, 45, -196, 72, -150);
    ctx.bezierCurveTo(108, -110, 92, -56, 40, -56);
    ctx.bezierCurveTo(-30, -40, -100, -48, -135, -60);
    ctx.closePath();
    fillPath(ctx, metal(ctx, "#725641", -185, -48, 0.3), 3);
    for (const [x, y, length, light] of FUR) line(ctx, x, y, x - 6, y + length, light ? "#8d6e54" : "#4d3829", 2.4);
    for (let i = 0; i < 5; i++) {
      const x = -118 + i * 40;
      const y = -152 - sin((i / 4) * PI) * 22;
      poly(ctx, [x - 20, y + 16, x - 6, y - 4, x + 14, y - 2, x + 22, y + 18], metal(ctx, "#5c5449", y - 4, y + 18), INK, 2);
    }
    line(ctx, -158, -110, -176, -70 + sin(t * 3) * 8, "#4d3829", 8);

    ctx.save();
    ctx.translate(74, -120);
    ctx.rotate(b.head || 0);
    ctx.beginPath();
    ctx.moveTo(-14, -34);
    ctx.bezierCurveTo(30, -46, 62, -20, 78, 6);
    ctx.lineTo(92, 34);
    ctx.bezierCurveTo(84, 58, 48, 62, 24, 52);
    ctx.bezierCurveTo(-12, 44, -26, 4, -14, -34);
    fillPath(ctx, metal(ctx, "#6b513f", -40, 58, 0.3), 3);
    poly(ctx, [-8, -32, 26, -36, 52, -16, 38, 2, 4, -6], metal(ctx, "#857866", -36, 2), INK, 2);

    ctx.beginPath();
    ctx.moveTo(46, -4);
    ctx.bezierCurveTo(96, -10, 124, -44, 130, -96);
    ctx.bezierCurveTo(150, -36, 132, 22, 80, 32);
    ctx.closePath();
    fillPath(ctx, metal(ctx, "#d8c6a2", -96, 32, 0.3), 2.5);
    for (let i = 0; i < 3; i++) line(ctx, 74 + i * 18, -6 - i * 14, 84 + i * 18, 16 - i * 17, "#a08b69", 2);
    poly(ctx, [40, -20, 52, -52, 58, -14], metal(ctx, "#cbb892", -52, -14), INK, 2);
    poly(ctx, [-6, -24, -32, -40, -22, -8], "#4d3829", INK, 2);

    oval(ctx, 30, 2, 7, 6, "#1a120e", INK);
    const color = b.dazed ? "#ffe27a" : b.enraged ? "#ff4a3d" : "#ffb347";
    oval(ctx, 32, 2, 3, 3, color);
    glow(ctx, 32, 2, b.enraged ? 22 : 11, color, 0.7);
    line(ctx, 16, -10, 42, -5, INK, 4);
    oval(ctx, 80, 36, 5, 4, "#20150f");
    if (b.mouth) poly(ctx, [36, 44, 78, 48, 46, 62], "#4a1d1a", INK, 2);
    if (b.snort) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 2.4 + i / 3) % 1;
        oval(ctx, 92 + k * 34, 40 - k * 12, 5 + k * 13, 4 + k * 9, `rgba(235,220,200,${0.4 * (1 - k)})`);
      }
    }
    if (b.dazed) stars(ctx, 30, -62, t);
    ctx.restore();
    ctx.restore();

    leg(ctx, -120, -88, -124 + stride(0), -10 - lift(0), 46, 46, 1, "#5f4736", 31);
    const paw = b.paw ? sin(t * 20) * 18 : 0;
    leg(ctx, 52, -86 - rear * 30, 62 + stride(3) - paw, -10 - lift(3) - rear * 62 - Math.abs(paw) * 0.5, 46, 46, -1, "#5f4736", 31);
  }

  /* ---------- Nevarro Reptavian, drawn from the center of its body ---------- */

  function reptavian(ctx, r) {
    const t = r.time;
    const flap = r.flying ? sin(r.flap) : 0.15;

    const wing = (color, depth) => {
      const wx = r.flying ? -14 - depth * 12 : -30;
      const wy = r.flying ? -14 - flap * 78 : -44;
      const tx = r.flying ? -104 + depth * 20 : -82;
      const ty = r.flying ? -10 - flap * 62 : 14;
      ctx.beginPath();
      ctx.moveTo(14, -14);
      ctx.quadraticCurveTo(8, wy, wx, wy);
      ctx.lineTo(tx, ty);
      ctx.quadraticCurveTo(-70, ty + 8, -64, 16 - flap * 14);
      ctx.quadraticCurveTo(-44, 4, -38, 24);
      ctx.quadraticCurveTo(-20, 8, -2, 18);
      ctx.closePath();
      fillPath(ctx, metal(ctx, color, -80, 30, 0.3));
      for (const [ex, ey] of [[tx, ty], [-64, 16 - flap * 14], [-38, 24]]) line(ctx, wx, wy, ex, ey, shade(color, -0.45), 3);
      line(ctx, 14, -14, wx, wy, shade(color, -0.3), 7);
      poly(ctx, [wx - 4, wy, wx + 4, wy + 2, wx + 4, wy - 12], "#d8cbb0", INK, 1);
    };

    wing("#57282c", 1);

    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.quadraticCurveTo(-70, 10 + sin(t * 5) * 8, -98, -8 + sin(t * 5) * 12);
    ctx.lineTo(-62, 18);
    ctx.quadraticCurveTo(-40, 22, -20, 16);
    ctx.closePath();
    fillPath(ctx, r.color || "#8c4038", 2);

    const swing = r.flying ? sin(t * 4) * 3 : 0;
    for (const [x, c] of [[-14, "#57282c"], [6, "#7a3832"]]) {
      if (r.flying) leg(ctx, x, 14, x - 16, 46 + swing, 22, 22, 1, c, 9);
      else leg(ctx, x, 14, x + 12 + sin(r.gait + x) * 10, 60, 26, 26, 1, c, 10);
    }

    ctx.beginPath();
    ctx.ellipse(0, 4, 40, 24, -0.2, 0, MQ.TAU);
    fillPath(ctx, metal(ctx, r.color || "#8c4038", -24, 30, 0.35));
    for (let i = 0; i < 5; i++) line(ctx, 4 + i * 6, 12 - i * 3, 2 + i * 6, 22 - i * 3, "#d79a66", 4);

    ctx.save();
    ctx.translate(36, -18);
    ctx.rotate(r.head || 0);
    poly(ctx, [-16, 2, 2, -22, 20, -14, 4, 20], metal(ctx, r.color || "#8c4038", -22, 20), INK, 2);
    poly(ctx, [6, -30, -40, -50, -6, -16], "#d8893c", INK, 2);
    poly(ctx, [-2, -18, -32, -26, -10, -8], "#b5623a", INK, 2);
    const open = r.mouth ? 14 : 3;
    poly(ctx, [22, -10, 66, -2, 24, 2 + open], "#4a1d1a", INK, 2);
    poly(ctx, [4, -28, 30, -26, 78, -4 - open * 0.3, 26, -6, 6, -6], metal(ctx, "#c9854f", -28, -4), INK, 2);
    poly(ctx, [8, -4, 24, 0, 70, 4 + open, 22, 10 + open * 0.6, 4, 6], metal(ctx, "#a3603d", -4, 18), INK, 2);
    for (let i = 0; i < 4; i++) poly(ctx, [34 + i * 9, -6, 39 + i * 9, -5, 36 + i * 9, 1], "#f1e6cc");
    const eyeColor = r.active ? "#ffe23d" : "#8d7a4a";
    oval(ctx, 22, -18, 4.5, 3.5, eyeColor, INK, 1.2);
    oval(ctx, 23.5, -18, 1.4, 3, INK);
    if (r.active) glow(ctx, 22, -18, 15, eyeColor, 0.6);
    if (r.dazed) stars(ctx, 14, -56, t);
    ctx.restore();

    wing(r.wing || "#a84b3c", 0);
  }

  /* ---------- Krayt Dragon, rising out of the ground at the origin ---------- */

  function krayt(ctx, b) {
    const t = b.time;
    const hx = b.headX;
    const hy = b.headY;
    const baseX = -70;
    const baseY = 70;
    const cx = baseX - 40;
    const cy = Math.min(hy - 40, -120);
    const dx = hx - 150;
    const dy = hy + 20;

    const SEGMENTS = 18;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const u = 1 - s;
      const x = u * u * u * baseX + 3 * u * u * s * cx + 3 * u * s * s * dx + s * s * s * hx;
      const y = u * u * u * baseY + 3 * u * u * s * cy + 3 * u * s * s * dy + s * s * s * hy + sin(t * 3 - i * 0.5) * 3;
      const r = lerp(64, 38, s);
      if (i % 2 === 0) {
        poly(ctx, [x - r * 0.75, y - r * 0.5, x - r * 1.45, y - r * 0.95, x - r * 0.15, y - r * 0.85], "#e0c58d", INK, 2);
      }
      oval(ctx, x, y, r, r * 0.9, i % 2 ? "#97764c" : "#a98657", "#5b4128", 2);
      oval(ctx, x + r * 0.35, y + r * 0.25, r * 0.48, r * 0.55, "#cfae78");
      line(ctx, x - r * 0.5, y - r * 0.1, x - r * 0.1, y - r * 0.45, "#c9a56c", 5);
    }

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(b.head || 0);
    const open = b.mouth || 0;

    for (const [x0, y0, x1, y1, w] of [[-18, -34, -96, -84, 12], [-6, -42, -52, -108, 10], [-30, -14, -104, -30, 9]]) {
      poly(ctx, [x0 - w, y0 + w, x1, y1, x0 + w, y0 - w * 0.4], metal(ctx, "#d8c9a8", -108, 0), INK, 2);
    }

    poly(ctx, [-10, 14, 30, 20, 108, 14 + open * 40, 70, 28 + open * 50, 10, 46, -22, 30], metal(ctx, "#8a6a44", 10, 60), INK, 3);
    if (open > 0.1) {
      poly(ctx, [10, 12, 96, 4, 100, 12 + open * 38, 28, 24 + open * 10], "#5a1e1a", INK, 2);
      glow(ctx, 40, 18 + open * 14, 46, b.weak ? "#ff7a3d" : "#c9423c", 0.9);
    }
    poly(ctx, [-38, 20, -34, -28, -2, -48, 42, -36, 112, -14, 124, 4, 60, 12, 10, 16], metal(ctx, "#b08d5c", -48, 20, 0.35), INK, 3);
    poly(ctx, [-6, -44, 36, -38, 66, -24, 20, -22], metal(ctx, "#d1b27c", -44, -22), INK, 2);
    for (let i = 0; i < 6; i++) {
      const x = 36 + i * 14;
      poly(ctx, [x, 8, x + 8, 7, x + 3, 22], "#f1e6cc", INK, 1);
      if (open > 0.1) poly(ctx, [x - 3, 24 + open * (i + 1) * 5, x + 5, 24 + open * (i + 1) * 5, x + 2, 12 + open * (i + 1) * 5], "#f1e6cc", INK, 1);
    }
    for (let i = 0; i < 4; i++) poly(ctx, [4 + i * 18, -38 + i * 5, 16 + i * 18, -36 + i * 5, 2 + i * 18, -56 + i * 7], "#e0c58d", INK, 1.5);

    const color = b.dazed ? "#ffe27a" : b.enraged ? "#ff4a3d" : "#ffb02e";
    oval(ctx, 22, -18, 10, 6, "#24180f", INK);
    oval(ctx, 24, -18, 5, 4.5, color);
    oval(ctx, 25, -18, 1.5, 4.5, INK);
    glow(ctx, 24, -18, 20, color, 0.6);
    oval(ctx, 106, -8, 4, 3, "#3a2618");
    if (b.dazed) stars(ctx, 10, -80, t);
    ctx.restore();
  }

  /* ---------- Mythosaur ---------- */

  function mythosaur(ctx, b) {
    const t = b.time;
    const g = b.gait;
    const stride = (offset) => (b.moving ? cos(g + offset) * 36 : 0);
    const lift = (offset) => (b.moving ? max(0, sin(g + offset)) * 24 : 0);
    const rear = b.rear || 0;

    leg(ctx, -130, -150, -130 + stride(2), -14 - lift(2), 72, 72, 1, "#2e3634", 40, 4);
    leg(ctx, 70, -150 - rear * 50, 92 + stride(4.6), -14 - lift(4.6) - rear * 96, 72, 72, -1, "#2e3634", 40, 4);

    ctx.beginPath();
    ctx.moveTo(-170, -170);
    ctx.quadraticCurveTo(-280, -110 + sin(t * 1.5) * 12, -330, -24 + sin(t * 1.5) * 20);
    ctx.quadraticCurveTo(-240, -70, -150, -100);
    ctx.closePath();
    fillPath(ctx, metal(ctx, "#48534f", -180, -20), 3);

    ctx.save();
    ctx.translate(-110, -120);
    ctx.rotate(-rear * 0.2 + sin(t * 1.6) * 0.004);
    ctx.translate(110, 120);

    ctx.beginPath();
    ctx.moveTo(-200, -130);
    ctx.bezierCurveTo(-200, -230, -110, -250, -40, -256);
    ctx.bezierCurveTo(60, -276, 140, -226, 148, -160);
    ctx.bezierCurveTo(140, -90, 60, -76, -20, -78);
    ctx.bezierCurveTo(-120, -76, -190, -80, -200, -130);
    ctx.closePath();
    fillPath(ctx, metal(ctx, "#56635e", -262, -76, 0.32), 3.5);
    for (let i = 0; i < 7; i++) {
      const x = -175 + i * 46;
      const y = -200 - sin((i / 6) * PI) * 52;
      poly(ctx, [x - 30, y + 34, x - 14, y, x + 18, y - 4, x + 32, y + 30], metal(ctx, "#6f7c71", y - 4, y + 34), INK, 2.5);
      poly(ctx, [x - 10, y + 2, x + 12, y, x - 8, y - 30], "#c9bfa3", INK, 2);
    }
    for (let i = 0; i < 7; i++) line(ctx, -150 + i * 38, -150, -160 + i * 38, -102, "#3f4946", 4);
    for (let i = 0; i < 5; i++) {
      oval(ctx, -100 + i * 44, -166, 4, 4, "#58d6c2");
      glow(ctx, -100 + i * 44, -166, 14, "#58d6c2", 0.35);
    }

    // Neck and head follow the attack.
    const hx = b.headX;
    const hy = b.headY;
    poly(ctx, [60, -226, hx - 20, hy - 34, hx - 10, hy + 46, 110, -120], metal(ctx, "#4c5854", -240, -60), INK, 3);

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(b.head || 0);
    const bone = metal(ctx, "#d3c9b1", -70, 70, 0.3);

    // Far tusk
    ctx.beginPath();
    ctx.moveTo(-6, -22);
    ctx.bezierCurveTo(-20, -90, 60, -110, 92, -70);
    ctx.bezierCurveTo(40, -78, 16, -60, 22, -26);
    ctx.closePath();
    fillPath(ctx, "#9d947f", 2.5);

    poly(ctx, [-44, -30, -12, -56, 34, -48, 70, -8, 84, 34, 62, 56, 30, 40, 4, 62, -22, 40, -48, 22], bone, INK, 3);
    poly(ctx, [-8, -44, 26, -38, 50, -6, 20, -14], "#e7dfca", INK, 1.5);
    poly(ctx, [4, -6, 40, -2, 34, 14, 8, 12], "#141a19", INK, 2);
    const color = b.dazed ? "#ffe27a" : b.enraged ? "#ff6a3d" : "#58d6c2";
    oval(ctx, 24, 4, 6, 5, color);
    glow(ctx, 24, 4, 28, color, 0.8);
    poly(ctx, [62, 20, 72, 30, 60, 36], "#141a19");
    for (let i = 0; i < 4; i++) line(ctx, 34 + i * 9, 40, 34 + i * 9, 52, "#8f8670", 3);
    if (b.mouth) poly(ctx, [0, 46, 62, 56, 14, 84], "#4a1d1a", INK, 2);

    // Near tusk
    ctx.beginPath();
    ctx.moveTo(-34, 6);
    ctx.bezierCurveTo(-54, 92, 80, 128, 158, 22);
    ctx.bezierCurveTo(90, 74, 10, 70, 0, 20);
    ctx.closePath();
    fillPath(ctx, metal(ctx, "#efe6cf", 6, 110, 0.3), 3);
    poly(ctx, [-40, -18, -96, -62, -22, -44], bone, INK, 2.5);
    if (b.weak) glow(ctx, 20, 0, 80, "#ffd45c", 0.35 + sin(t * 8) * 0.15);
    if (b.dazed) stars(ctx, 10, -100, t);
    ctx.restore();
    ctx.restore();

    leg(ctx, -150, -140, -156 + stride(0), -14 - lift(0), 72, 72, 1, "#48534f", 44, 4);
    leg(ctx, 92, -140 - rear * 50, 110 + stride(3), -14 - lift(3) - rear * 110, 72, 72, -1, "#48534f", 44, 4);
  }

  /* ---------- Imperial Guardian ---------- */

  function guardian(ctx, b) {
    const t = b.time;
    const g = b.gait;
    const slam = b.slam || 0;
    const open = b.open || 0;
    const hull = "#5b6570";

    for (const [x, o, color] of [[-52, 0, "#2e343b"], [46, PI, "#434b55"]]) {
      const fx = x + (b.moving ? cos(g + o) * 24 : 0);
      const fy = -14 - (b.moving ? max(0, sin(g + o)) * 18 : 0);
      const j = MQ.Anim.ik(x * 0.6, -118, fx, fy, 64, 64, -1);
      const { x: kx, y: ky } = j;
      MQ.Anim.limb(ctx, x * 0.6, -118, kx, ky, fx, fy, 22, color);
      oval(ctx, kx, ky, 15, 15, metal(ctx, "#6b7581", ky - 15, ky + 15), INK, 2);
      poly(ctx, [fx - 30, 0, fx - 18, -22, fx + 22, -22, fx + 36, 0], metal(ctx, color, -22, 0), INK, 2);
    }

    const ram = (color, offset) => {
      const sx = 30 + offset;
      const ex = lerp(96, 118, slam) + offset;
      const ey = slam < 0.5 ? lerp(-150, -250, slam * 2) : lerp(-250, -12, (slam - 0.5) * 2);
      const j = MQ.Anim.ik(sx, -186, ex, ey, 92, 92, -1);
      MQ.Anim.limb(ctx, sx, -186, j.x, j.y, j.ex, j.ey, 18, color);
      box(ctx, j.ex - 22, j.ey - 20, 44, 34, 5, metal(ctx, "#7b8591", j.ey - 20, j.ey + 14), INK, 2);
      line(ctx, j.ex - 14, j.ey - 3, j.ex + 14, j.ey - 3, "#e0a43a", 4);
    };
    ram("#39414a", -26);

    box(ctx, -46, -134, 92, 30, 6, "#2b3037", INK, 2);
    poly(ctx, [-78, -150, -66, -222, -10, -246, 64, -234, 84, -186, 62, -128, -56, -124], metal(ctx, hull, -246, -124, 0.34), INK, 3);
    for (let i = 0; i < 4; i++) line(ctx, -62, -204 + i * 14, -30, -208 + i * 14, "#2b3037", 4);
    poly(ctx, [-12, -240, 48, -232, 60, -210, -6, -214], metal(ctx, "#49525c", -240, -210), INK, 2);
    line(ctx, 6, -222, 50, -220, "#ff3a30", 4);
    glow(ctx, 32, -221, 30, "#ff3a30", 0.6);

    // The armor doors slide apart to show the reactor.
    box(ctx, -8, -200, 62, 58, 8, "#15181d", INK, 2);
    if (open > 0.05) {
      oval(ctx, 23, -171, 20 * open, 20 * open, "#ffd45c");
      oval(ctx, 23, -171, 10 * open, 10 * open, "#ffffff");
      glow(ctx, 23, -171, 80 * open, "#ff9a30", 0.8 + sin(t * 12) * 0.2);
    }
    const door = metal(ctx, "#6b7581", -200, -142);
    poly(ctx, [-8, -200, 54, -200, 54, -172 - open * 26, -8, -172 - open * 26], door, INK, 2);
    poly(ctx, [-8, -170 + open * 24, 54, -170 + open * 24, 54, -142, -8, -142], door, INK, 2);

    // Cannon
    ctx.save();
    ctx.translate(-30, -246);
    ctx.rotate(b.aim || 0);
    box(ctx, 8, -9, 74, 7, 2, "#30363e", INK, 2);
    box(ctx, 8, 2, 74, 7, 2, "#30363e", INK, 2);
    box(ctx, -22, -18, 44, 30, 8, metal(ctx, "#69737f", -18, 12), INK, 2);
    if (b.charge) glow(ctx, 84, 0, 22 + b.charge * 34, "#ff4a3d", 0.9);
    ctx.restore();

    box(ctx, -70, -188, 30, 22, 3, "#39414a", INK, 2);
    line(ctx, -62, -177, -48, -177, "#c9d0d8", 3);
    ram("#59636e", 14);
    if (b.dazed) stars(ctx, 10, -280, t);
  }

  MQ.BossArt = { mudhorn, reptavian, krayt, mythosaur, guardian };
})(window.MQ);
