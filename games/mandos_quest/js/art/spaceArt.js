/*
 * Everything drawn in the space stages. All original designs. Enemies face -x, and are
 * painted once into sprites, as dozens can be on screen.
 */
(function (MQ) {
  const { box, poly, oval, line, glow, metal, shade, alpha, rng, makeCanvas, clamp } = MQ.U;
  const { sin, cos, abs, max, min, floor, PI } = Math;
  const TAU = MQ.TAU;
  const INK = MQ.INK;
  const RESOLUTION = 1.5;

  function redLight(ctx, x, y, r = 4) {
    oval(ctx, x, y, r, r, "#ff5348");
    glow(ctx, x, y, r * 4, "#ff5348", 0.8);
  }

  function engine(ctx, x, y, r, color = "#ff8a5c") {
    glow(ctx, x + 5, y, r * 3.4, color, 0.9);
    oval(ctx, x, y, r * 0.5, r, "#ffe6d0");
  }

  /* ---------- Small ships ---------- */

  // Forked prongs ahead of a narrow body.
  function forked(ctx, hull, trim) {
    engine(ctx, 20, 0, 6);
    poly(ctx, [12, -8, 2, -22, -34, -26, -14, -15, -6, -6], shade(hull, -0.3), INK, 2);
    poly(ctx, [12, 8, 2, 22, -34, 26, -14, 15, -6, 6], shade(hull, -0.4), INK, 2);
    poly(ctx, [-28, 0, -12, -8, 18, -10, 24, 0, 18, 10, -12, 8], metal(ctx, hull, -10, 10), INK, 2);
    line(ctx, -2, -17, -22, -22, trim, 3);
    line(ctx, -2, 17, -22, 22, trim, 3);
    poly(ctx, [-20, -1, -11, -5, -3, -4, -5, 1], "#10141a", INK, 1);
    redLight(ctx, -27, 0, 2.5);
  }

  // A needle with swept-back blades.
  function needle(ctx, hull, trim) {
    engine(ctx, 22, 0, 5, "#ff6a8a");
    poly(ctx, [2, -4, 26, -20, 30, -18, 18, -2], shade(hull, -0.25), INK, 1.5);
    poly(ctx, [2, 4, 26, 20, 30, 18, 18, 2], shade(hull, -0.4), INK, 1.5);
    poly(ctx, [-36, 1, -8, -8, 22, -6, 24, 5, -6, 7], metal(ctx, hull, -8, 7), INK, 2);
    poly(ctx, [-10, -6, 2, -5, 2, 0, -14, 0], "#10141a");
    line(ctx, 4, -1, 20, -2, trim, 2.5);
  }

  function gunship(ctx, hull, trim) {
    for (const y of [-15, 15]) engine(ctx, 50, y, 8);
    box(ctx, 0, -30, 48, 22, 6, metal(ctx, shade(hull, -0.2), -30, -8), INK, 2);
    box(ctx, 0, 8, 48, 22, 6, metal(ctx, shade(hull, -0.3), 8, 30), INK, 2);
    poly(ctx, [-60, 6, -44, -14, 14, -18, 38, -6, 38, 12, -30, 18], metal(ctx, hull, -18, 18), INK, 2.5);
    poly(ctx, [-42, -10, -22, -13, -20, -5, -48, -2], "#10141a", INK, 1);
    box(ctx, -56, 10, 30, 6, 2, "#262b31", INK, 1.5);
    box(ctx, -30, -24, 26, 6, 2, "#262b31", INK, 1.5);
    line(ctx, 4, -4, 32, -2, trim, 5);
    redLight(ctx, -12, 4, 3);
  }

  function transport(ctx) {
    for (const y of [-28, 0, 28]) engine(ctx, 136, y, 11);
    poly(ctx, [-142, 14, -118, -30, -40, -44, 132, -44, 140, 34, 60, 50, -110, 46], metal(ctx, "#6a737d", -44, 50), INK, 3);
    poly(ctx, [-120, -22, -84, -32, -70, -12, -128, -6], "#10141a", INK, 2);
    line(ctx, -118, -19, -84, -26, "#ff8a70", 2);
    for (let i = 0; i < 4; i++) {
      box(ctx, -46 + i * 44, -32, 38, 58, 3, i % 2 ? "#4a525c" : "#58616c", INK, 2);
      line(ctx, -40 + i * 44, -10, -14 + i * 44, -10, "#39414b", 4);
      redLight(ctx, -27 + i * 44, 16, 3);
    }
    box(ctx, -20, -56, 70, 14, 4, "#4a525c", INK, 2);
    box(ctx, -100, 30, 50, 12, 3, "#2c323a", INK, 2);
  }

  function capital(ctx) {
    for (const y of [-38, 0, 38]) engine(ctx, 198, y, 14, "#7fb8ff");
    // A hammerhead prow on a long stepped spine.
    poly(ctx, [-208, -44, -194, -68, -156, -70, -138, -26, 150, -46, 196, -54, 200, 54, 150, 50, -138, 28, -156, 72, -194, 70, -208, 46], metal(ctx, "#68727d", -70, 72), INK, 3);
    poly(ctx, [-110, -22, 120, -42, 120, -4, -110, -4], shade("#68727d", -0.2), INK, 2);
    box(ctx, 60, -72, 70, 28, 4, metal(ctx, "#78838f", -72, -44), INK, 2);
    for (let i = 0; i < 5; i++) line(ctx, 68 + i * 12, -60, 74 + i * 12, -60, "#cfe8ff", 3);
    for (let i = 0; i < 6; i++) {
      box(ctx, -124 + i * 42, 4 + i * 2, 22, 12, 2, "#333a43", INK, 1.5);
      line(ctx, -124 + i * 42, -12, -108 + i * 42, -14, "#cfe8ff", 2);
    }
    poly(ctx, [-200, -38, -176, -50, -176, 52, -200, 40], "#3a414b", INK, 2);
    for (let i = 0; i < 4; i++) line(ctx, -192, -24 + i * 16, -183, -24 + i * 16, "#cfe8ff", 3);
    redLight(ctx, -180, -60, 4);
    redLight(ctx, -180, 62, 4);
  }

  function platform(ctx) {
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + (i * PI) / 2;
      line(ctx, 0, 0, cos(a) * 56, sin(a) * 50, "#39414b", 14);
      oval(ctx, cos(a) * 56, sin(a) * 50, 13, 13, "#59626c", INK, 2);
      redLight(ctx, cos(a) * 56, sin(a) * 50, 3);
    }
    poly(ctx, [-38, 0, -20, -34, 20, -34, 38, 0, 20, 34, -20, 34], metal(ctx, "#6a737d", -34, 34), INK, 3);
    oval(ctx, 0, 0, 16, 16, "#1a1f26", "#58d6c2", 4);
    glow(ctx, 0, 0, 30, "#58d6c2", 0.7);
    box(ctx, -62, -5, 28, 10, 2, "#2c323a", INK, 2);
  }

  const SHIPS = {
    fighter: [86, 70, (ctx) => forked(ctx, "#717b86", "#c8463c")],
    heavyFighter: [100, 84, (ctx) => {
      ctx.scale(1.22, 1.2);
      forked(ctx, "#59636e", "#e0a43a");
      box(ctx, -12, -4, 16, 8, 2, "#262b31", INK, 1.5);
    }],
    attackFighter: [94, 80, (ctx) => {
      ctx.scale(1.14, 1.1);
      forked(ctx, "#3f4654", "#d24cff");
    }],
    interceptor: [94, 64, (ctx) => needle(ctx, "#8b949e", "#ff5348")],
    eliteInterceptor: [94, 64, (ctx) => needle(ctx, "#3c3550", "#ff4fd8")],
    gunship: [164, 92, (ctx) => gunship(ctx, "#66707b", "#c8463c")],
    eliteGunship: [164, 92, (ctx) => gunship(ctx, "#3c3550", "#d24cff")],
    drone: [66, 66, (ctx) => {
      for (let i = 0; i < 3; i++) {
        const a = PI + (i * TAU) / 3;
        line(ctx, 0, 0, cos(a) * 21, sin(a) * 21, "#39414b", 7);
        oval(ctx, cos(a) * 21, sin(a) * 21, 5, 5, "#8b949e", INK, 1.5);
      }
      poly(ctx, [-13, 0, 0, -13, 13, 0, 0, 13], metal(ctx, "#59626c", -13, 13), INK, 2);
      redLight(ctx, -2, 0, 4);
    }],
    bomber: [124, 82, (ctx) => {
      engine(ctx, 38, -6, 9);
      poly(ctx, [-44, -4, -20, -22, 34, -24, 44, -4, 24, 6, -30, 8], metal(ctx, "#737c70", -24, 8), INK, 2.5);
      for (let i = 0; i < 3; i++) {
        oval(ctx, -20 + i * 22, 15, 9, 9, "#2b302c", "#ff9b38", 2);
        line(ctx, -20 + i * 22, 0, -20 + i * 22, 8, INK, 4);
      }
      poly(ctx, [-30, -10, -18, -17, -8, -15, -16, -7], "#10141a");
    }],
    missileDrone: [86, 78, (ctx) => {
      engine(ctx, 22, 0, 6, "#ff6a3d");
      poly(ctx, [-20, 0, -6, -14, 20, -12, 24, 0, 20, 12, -6, 14], metal(ctx, "#6b5a5a", -14, 14), INK, 2);
      for (const y of [-19, 19]) {
        box(ctx, -22, y - 6, 32, 12, 3, "#39414b", INK, 1.5);
        poly(ctx, [-22, y - 4, -30, y, -22, y + 4], "#ff6a3d");
      }
      redLight(ctx, -10, 0, 3);
    }],
    defender: [148, 100, (ctx) => {
      engine(ctx, 42, 0, 11);
      poly(ctx, [-18, -20, 30, -24, 46, -8, 46, 8, 30, 24, -18, 20], metal(ctx, "#59626c", -24, 24), INK, 2);
      // The plate that turns shots aside.
      poly(ctx, [-30, -36, -14, -34, -22, -14, -22, 14, -14, 34, -30, 36, -50, 14, -50, -14], metal(ctx, "#a9b4bf", -36, 36), INK, 2.5);
      line(ctx, -40, -10, -40, 10, "#e0a43a", 4);
      redLight(ctx, 10, 0, 3);
    }],
    turret: [80, 68, (ctx) => {
      box(ctx, -20, 4, 40, 18, 3, "#39414b", INK, 2);
      line(ctx, -4, -4, -30, -18, INK, 11);
      line(ctx, -4, -4, -30, -18, "#6a737d", 7);
      oval(ctx, 2, -1, 15, 13, metal(ctx, "#59626c", -14, 12), INK, 2);
      redLight(ctx, -4, -3, 3.5);
    }],
    generator: [80, 80, (ctx) => {
      box(ctx, -18, 6, 36, 18, 3, "#2c3a3c", INK, 2);
      for (let i = 0; i < 3; i++) box(ctx, -12, -14 + i * 8, 24, 5, 2, "#7c8b98", INK, 1);
      oval(ctx, 0, -16, 9, 9, "#8ff0e0", INK, 2);
      glow(ctx, 0, -14, 30, "#58d6c2", 0.8);
    }],
    transport: [340, 150, transport],
    platform: [170, 150, platform],
    capital: [480, 190, capital],
  };

  /* ---------- Boss hulls ---------- */

  function warden(ctx) {
    for (const y of [-62, 62]) engine(ctx, 128, y, 16);
    engine(ctx, 150, 0, 18);
    for (const side of [-1, 1]) {
      const y = side * 62;
      poly(ctx, [10, side * 30, 60, side * 20, 96, y, 40, y], "#39414b", INK, 3);
      poly(ctx, [-46, y, -14, y - 22, 120, y - 26, 124, y + 22, -18, y + 20], metal(ctx, "#5c6671", y - 26, y + 22), INK, 3);
      box(ctx, -86, y - 7, 56, 14, 3, "#262b31", INK, 2);
      line(ctx, 6, y, 100, y, "#c8463c", 5);
    }
    poly(ctx, [-178, 12, -150, -20, -70, -52, 96, -46, 152, -22, 150, 30, 60, 52, -90, 44], metal(ctx, "#75808b", -52, 52), INK, 3.5);
    box(ctx, -198, -9, 62, 18, 4, "#262b31", INK, 2.5);
    poly(ctx, [20, -44, 70, -42, 78, -20, 10, -22], "#10141a", INK, 2);
    for (let i = 0; i < 4; i++) redLight(ctx, 26 + i * 13, -31, 2.5);
    for (let i = 0; i < 4; i++) line(ctx, 18 + i * 24, 10, 28 + i * 24, 30, "#4a525c", 5);
  }

  function bastion(ctx) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 180, 195, 0, 0, TAU);
    ctx.strokeStyle = "rgba(88,214,194,0.3)";
    ctx.lineWidth = 10;
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + 0.2;
      const x = cos(a) * 112;
      const y = sin(a) * 112;
      line(ctx, 0, 0, x, y, "#2c343c", 20);
      box(ctx, x - 14, y - 14, 28, 28, 5, "#4a555f", INK, 2.5);
      redLight(ctx, x, y, 3);
    }
    oval(ctx, 0, 0, 88, 88, metal(ctx, "#5c6975", -88, 88), INK, 4);
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16;
      line(ctx, cos(a) * 72, sin(a) * 72, cos(a) * 84, sin(a) * 84, "#2c343c", 5);
    }
    box(ctx, -124, -13, 66, 26, 4, "#262b31", INK, 3);
  }

  function command(ctx) {
    for (const y of [-190, -60, 60, 190]) engine(ctx, 226, y, 22, "#b98cff");
    for (const side of [-1, 1]) {
      poly(ctx, [-70, side * 168, -22, side * 160, 120, side * 150, 226, side * 160, 226, side * 222, 40, side * 226, -58, side * 206], metal(ctx, "#4d5464", -226, 226), INK, 3.5);
      poly(ctx, [40, side * 120, 170, side * 120, 190, side * 160, 20, side * 160], "#2b3039", INK, 3);
      for (let i = 0; i < 7; i++) line(ctx, 10 + i * 28, side * 186, 22 + i * 28, side * 186, "#cfe8ff", 3);
    }
    poly(ctx, [-140, -40, -110, -130, 20, -152, 226, -120, 240, 0, 226, 120, 20, 152, -110, 130, -140, 40, -60, 0], metal(ctx, "#5a6273", -152, 152), INK, 4);
    poly(ctx, [40, -70, 170, -56, 180, 56, 40, 70], "#353b47", INK, 3);
    box(ctx, 90, -22, 70, 44, 5, "#12151c", INK, 2.5);
    for (let i = 0; i < 4; i++) line(ctx, 98 + i * 16, -8, 106 + i * 16, -8, "#d24cff", 4);
    for (let i = 0; i < 5; i++) line(ctx, -20 + i * 14, -120, -30 + i * 14, -92, "#39404d", 6);
    for (let i = 0; i < 5; i++) line(ctx, -30 + i * 14, 92, -20 + i * 14, 120, "#39404d", 6);
  }

  const HULLS = { warden: [430, 220, warden], bastion: [410, 430, bastion], command: [560, 480, command] };

  /* ---------- Sprite cache ---------- */

  const sprites = new Map();

  function whiten(source) {
    const canvas = makeCanvas(source.width, source.height);
    const c = canvas.getContext("2d");
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = "rgba(255,255,255,0.75)";
    c.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function sprite(name) {
    let cached = sprites.get(name);
    if (cached) return cached;
    const [w, h, paint] = SHIPS[name] || HULLS[name];
    const canvas = makeCanvas(w * RESOLUTION, h * RESOLUTION);
    const c = canvas.getContext("2d");
    c.scale(RESOLUTION, RESOLUTION);
    c.translate(w / 2, h / 2);
    paint(c);
    cached = { w, h, plain: canvas, lit: whiten(canvas) };
    sprites.set(name, cached);
    return cached;
  }

  function enemy(ctx, name, x, y, face, flash, ceiling, tilt) {
    const { w, h, plain, lit } = sprite(name);
    const image = flash ? lit : plain;
    if (face < 0 && !ceiling && !tilt) {
      ctx.drawImage(image, x - w / 2, y - h / 2, w, h);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face < 0 ? 1 : -1, ceiling ? -1 : 1);
    if (tilt) ctx.rotate(tilt);
    ctx.drawImage(image, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* ---------- Rocks and structures ---------- */

  const ROCKS = {
    stone: ["#6b5e5a", "#3f3634"],
    ember: ["#5a3a34", "#ff7a32"],
    jade: ["#52665f", "#58d6c2"],
    debris: ["#59606c", "#2b3039"],
  };
  const rockSprites = new Map();

  function rockSprite(style) {
    let list = rockSprites.get(style);
    if (list) return list;
    const [color, detail] = ROCKS[style];
    list = [0, 1, 2, 3].map((variant) => {
      const random = rng(70 + variant * 13 + style.length);
      const canvas = makeCanvas(144, 144);
      const c = canvas.getContext("2d");
      c.translate(72, 72);
      const jagged = style === "debris";
      const points = [];
      const steps = jagged ? 7 : 12;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * TAU;
        const r = random.range(jagged ? 38 : 54, 68);
        points.push(cos(a) * r, sin(a) * r);
      }
      poly(c, points, metal(c, color, -66, 66), INK, 3);
      for (let i = 0; i < 6; i++) {
        const x = random.range(-34, 34);
        const y = random.range(-34, 34);
        if (style === "stone") oval(c, x, y, random.range(5, 13), random.range(4, 10), detail);
        else line(c, x, y, x + random.range(-20, 20), y + random.range(-20, 20), detail, 3);
      }
      return { plain: canvas, lit: whiten(canvas) };
    });
    rockSprites.set(style, list);
    return list;
  }

  function rock(ctx, x, y, r, angle, seed, style, solid, flash) {
    const image = rockSprite(style)[seed % 4];
    const size = r * 2.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(flash ? image.lit : image.plain, -size / 2, -size / 2, size, size);
    // A second dark shell marks the ones that can't be broken.
    if (solid) oval(ctx, 0, 0, r * 0.72, r * 0.62, "rgba(10,10,14,0.3)", "rgba(10,10,14,0.5)", 3);
    ctx.restore();
  }

  const BLOCKS = {
    crust: ["#33201f", "#ff6a2c"],
    station: ["#35434a", "#58d6c2"],
    rock: ["#45564f", "#6d8278"],
    hull: ["#3f4657", "#b98cff"],
  };

  function block(ctx, o, time) {
    const { x, y, w, h, style } = o;
    if (style === "wreck") {
      wreck(ctx, o, time);
      return;
    }
    const [color, light] = BLOCKS[style];
    const left = max(-10, x);
    const right = min(MQ.VW + 10, x + w);
    if (right <= left) return;
    ctx.fillStyle = color;
    ctx.fillRect(left, y, right - left, h);
    // The face the player flies along.
    const edge = o.fromTop ? y + h : y;
    const inward = o.fromTop ? -1 : 1;
    const step = 56;
    for (let i = max(0, floor((left - x) / step)); x + i * step < right; i++) {
      const px = x + i * step;
      const width = min(step, x + w - px);
      const n = (i * 37 + o.seed) % 7;
      if (style === "crust" || style === "rock") {
        poly(ctx, [px, edge, px + width * 0.4, edge - inward * (4 + n), px + width, edge, px + width * 0.6, edge + inward * 14], shade(color, 0.15));
        if (n < 4) line(ctx, px + 8, edge + inward * 20, px + width * 0.7, edge + inward * (24 + n * 4), alpha(light, 0.75), style === "crust" ? 3 : 2);
      } else {
        ctx.fillStyle = shade(color, n % 2 ? 0.12 : -0.15);
        ctx.fillRect(px + 2, o.fromTop ? edge - 18 : edge + 3, max(0, width - 4), 15);
        if (n < 3) {
          ctx.fillStyle = alpha(light, 0.85);
          ctx.fillRect(px + 10, edge + inward * 32, min(18, width), 4);
        }
      }
    }
    line(ctx, left, edge, right, edge, alpha(light, 0.85), 3, "butt");
    for (const side of [x, x + w]) if (side > -10 && side < MQ.VW + 10) line(ctx, side, y, side, y + h, INK, 4, "butt");
  }

  // A derelict clan ship, broken open.
  function wreck(ctx, { x, y, w, h }, time) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(w / 300, h / 100);
    poly(ctx, [-150, -8, -116, -38, -30, -46, 10, -50, 4, -20, 40, -36, 120, -40, 150, -10, 136, 34, 52, 46, 20, 22, -18, 50, -120, 32], metal(ctx, "#57655f", -50, 50), INK, 3);
    poly(ctx, [-30, -20, 8, -8, -10, 10, 30, 14, 6, 30, -40, 14], "#141a19", INK, 2);
    poly(ctx, [-104, -22, -88, -22, -80, -8, -96, 14, -112, -8], "#9b7a48", INK, 2);
    for (let i = 0; i < 4; i++) line(ctx, 54 + i * 22, -26, 48 + i * 22, 28, "#3a4743", 5);
    if (sin(time * 5) > 0.4) redLight(ctx, 108, -16, 3);
    ctx.restore();
  }

  function arm(ctx, { x, y, w, angle }, time) {
    const ex = cos(angle) * w;
    const ey = sin(angle) * w;
    line(ctx, x - ex, y - ey, x + ex, y + ey, INK, 28);
    line(ctx, x - ex, y - ey, x + ex, y + ey, "#59656c", 21);
    line(ctx, x - ex * 0.9, y - ey * 0.9, x + ex * 0.9, y + ey * 0.9, "#2c343c", 5);
    oval(ctx, x, y, 28, 28, "#39434a", INK, 3);
    oval(ctx, x, y, 10, 10, "#58d6c2");
    for (const side of [-1, 1]) oval(ctx, x + ex * side, y + ey * side, 6, 6, sin(time * 8) > 0 ? "#ff5348" : "#6b2b2b");
  }

  function strike(ctx, o, from, time) {
    const { x, y, w } = o;
    const length = y - from;
    if (o.style === "lightning") {
      for (let bolt = 0; bolt < 3; bolt++) {
        ctx.beginPath();
        ctx.moveTo(x, from);
        for (let i = 1; i <= 8; i++) ctx.lineTo(x + sin(i * 7.3 + bolt * 2 + floor(time * 18)) * w * 0.42, from + (length * i) / 8);
        ctx.strokeStyle = bolt ? "rgba(130,225,255,0.8)" : "#ffffff";
        ctx.lineWidth = bolt ? 7 : 4;
        ctx.stroke();
      }
      glow(ctx, x, y, w, "#9fe8ff", 0.8);
      return;
    }
    const half = w / 2;
    const wave = sin(time * 34) * 6;
    poly(ctx, [x - half, from, x - half * 0.8 + wave, from + length * 0.6, x - 10, y, x + wave, y - length * 0.05, x + half * 0.7 - wave, from + length * 0.65, x + half, from], "rgba(255,100,40,0.85)");
    poly(ctx, [x - half * 0.5, from, x - 8 + wave, from + length * 0.75, x + half * 0.5, from], "#ffd36b");
    glow(ctx, x, from + length * 0.4, w, "#ff8a3d", 0.7);
  }

  /* ---------- Mando's ship ---------- */

  function player(ctx, v) {
    const { levels, time } = v;
    ctx.save();
    ctx.scale(0.52, 0.52);

    if (levels.rear) {
      box(ctx, -120, -22, 40, 12, 3, "#39414b", INK, 2);
      oval(ctx, -121, -16, 5, 6, "#ff9bd2");
      if (levels.rear > 1) box(ctx, -114, 0, 30, 9, 3, "#39414b", INK, 2);
    }
    for (let i = 0; i < levels.missile; i++) {
      box(ctx, -34 + i * 46, 24, 40, 18, 4, "#39414b", INK, 2);
      for (let j = 0; j < 3; j++) oval(ctx, -24 + i * 46 + j * 11, 33, 3.5, 3.5, "#ff9b4d");
    }

    MQ.VehicleArt.draw(ctx, "gunship", time, v.thrust);

    // Baby G rides in the passenger bubble, with Mando in the cockpit.
    ctx.save();
    ctx.translate(-2, -36);
    oval(ctx, 0, 4, 34, 22, "#14202a", INK, 2);
    ctx.translate(0, 9);
    ctx.scale(1.15, 1.15);
    MQ.CharacterArt.baby(ctx, v.mood, time, { pram: false });
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(-2, -34, 36, 34, 0, PI, TAU);
    ctx.fillStyle = "rgba(150,225,255,0.13)";
    ctx.fill();
    ctx.strokeStyle = "rgba(200,240,255,0.75)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (v.look) {
      ctx.save();
      ctx.translate(76, -29);
      ctx.scale(0.98, 0.98);
      MQ.CharacterArt.helmet(ctx, v.look, time);
      ctx.restore();
    }

    if (levels.twin) {
      for (const y of [-5, 24]) {
        box(ctx, 62, y - 5, 74, 10, 3, "#59626c", INK, 2);
        oval(ctx, 136, y, 4, 5, "#7fd4ff");
      }
      if (levels.twin > 1) box(ctx, 120, -4, 44, 8, 2, "#8b949e", INK, 2);
    }
    for (let i = 0; i < levels.spread; i++) {
      line(ctx, 36 - i * 30, -20, 62 - i * 30, -40, "#ffd45c", 7);
      line(ctx, 36 - i * 30, 24, 62 - i * 30, 44, "#ffd45c", 7);
    }
    if (levels.laser) {
      box(ctx, 100, -7, 62, 14, 4, "#4a3860", "#c58cff", 2.5);
      glow(ctx, 160, 0, 22 + levels.laser * 8, "#c58cff", 0.8);
    }
    for (let i = 0; i < levels.speed; i++) glow(ctx, -104 - i * 24, 2, 34, "#7dffb2", 0.55);
    if (v.vanguard) {
      line(ctx, -50, 14, 66, 16, "#e2bd57", 5);
      line(ctx, -40, -14, 44, -14, "#e2bd57", 3);
    }

    if (v.hp < 0.75) {
      line(ctx, -22, -12, -8, 2, "#262226", 5);
      line(ctx, -8, 2, -16, 10, "#262226", 3);
    }
    if (v.hp < 0.5) {
      oval(ctx, 34, 8, 14, 9, "rgba(30,22,22,0.7)");
      poly(ctx, [-70, 10, -56, 14, -62, 26, -76, 22], "#201c20");
    }
    if (v.hp < 0.25) glow(ctx, -58, 18, 40, "#ff7a32", 0.6 + sin(time * 22) * 0.3);
    if (v.muzzle) glow(ctx, 150, 0, 34, "#8fe6ff", 0.9);
    if (v.flash) glow(ctx, 10, -6, 130, "#ff5348", 0.9);
    ctx.restore();
  }

  /* ---------- Bosses ---------- */

  function bossSystem(ctx, part, art, time) {
    const { x, y, rx, ry } = part;
    if (part.hp <= 0) {
      oval(ctx, x, y, rx * 0.8, ry * 0.8, "#15161a", "#3a2a28", 3);
      glow(ctx, x, y, rx, "#ff7a32", 0.25 + sin(time * 12 + x) * 0.15);
      return;
    }
    const color = part.flash > 0 ? "#ffffff" : art === "bastion" ? "#58d6c2" : part.id === "missile" ? "#ff6a3d" : "#ff4f7d";
    if (art === "bastion") {
      poly(ctx, [x - rx, y, x, y - ry, x + rx, y, x, y + ry], "#2c3a3c", color, 4);
    } else {
      box(ctx, x - rx, y - ry * 0.8, rx * 2, ry * 1.6, 6, "#2b3039", INK, 3);
      box(ctx, x - rx - 22, y - 6, 34, 12, 3, "#14171d", INK, 2);
      if (part.id === "missile") for (let i = -1; i <= 1; i++) oval(ctx, x + i * 18, y, 6, 6, "#14171d", color, 2);
    }
    oval(ctx, x, y, 10, 10, color);
    glow(ctx, x, y, 34, color, 0.6);
  }

  function boss(ctx, b, time) {
    const { art } = b.spec;
    const { w, h, plain, lit } = sprite(art);
    ctx.drawImage(b.core.flash > 0 ? lit : plain, b.x - w / 2, b.y - h / 2, w, h);

    if (art === "bastion") {
      for (let i = 0; i < b.weapons.length; i++) {
        if (b.weapons[i].hp > 0) line(ctx, b.x, b.y, b.weapons[i].x, b.weapons[i].y, "rgba(88,214,194,0.45)", 4 + sin(time * 14 + i) * 2);
      }
    }
    for (let i = 0; i < b.parts.length; i++) if (!b.parts[i].core) bossSystem(ctx, b.parts[i], art, time);

    const { core } = b;
    const r = art === "warden" ? 26 : art === "bastion" ? 40 : 34;
    const color = b.phase === 3 ? "#ff4f3d" : core.shielded ? "#58d6c2" : "#ffb04d";
    poly(ctx, [core.x - r, core.y, core.x - r * 0.5, core.y - r * 0.87, core.x + r * 0.5, core.y - r * 0.87, core.x + r, core.y, core.x + r * 0.5, core.y + r * 0.87, core.x - r * 0.5, core.y + r * 0.87], "#14171d", color, 4);
    // Its shutters open when it can be hurt.
    const open = core.shielded ? 0.15 : 0.55 + sin(time * 6) * 0.12;
    oval(ctx, core.x, core.y, r * 0.7, r * open, color);
    glow(ctx, core.x, core.y, r * 2.2, color, core.shielded ? 0.3 : 0.75);
  }

  /* ---------- Upgrade icons, collectibles and the results picture ---------- */

  const ICONS = {
    speed(ctx) {
      for (const x of [-9, 1]) poly(ctx, [x, -9, x + 10, 0, x, 9, x + 3, 0], ctx.fillStyle);
    },
    twin(ctx) {
      for (const y of [-6, 6]) ctx.fillRect(-11, y - 2.5, 22, 5);
    },
    spread(ctx) {
      for (let i = -1; i <= 1; i++) line(ctx, -9, 0, 10, i * 9, ctx.fillStyle, 3.5);
    },
    rear(ctx) {
      line(ctx, 10, 0, -6, 0, ctx.fillStyle, 4);
      poly(ctx, [-12, 0, -3, -8, -3, 8], ctx.fillStyle);
    },
    missile(ctx) {
      line(ctx, -7, -9, 2, 3, ctx.fillStyle, 5);
      poly(ctx, [8, 11, -2, 7, 6, 0], ctx.fillStyle);
    },
    shield(ctx) {
      poly(ctx, [0, -11, 10, -6, 8, 6, 0, 12, -8, 6, -10, -6], null, ctx.fillStyle, 3.5);
    },
    laser(ctx) {
      ctx.fillRect(-12, -2.5, 24, 5);
      for (const x of [-5, 5]) ctx.fillRect(x - 1.5, -9, 3, 18);
    },
  };

  function icon(ctx, id, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ICONS[id](ctx);
    ctx.restore();
  }

  function relic(ctx, id, w, h, time, owned) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(min(w, h) / 100, min(w, h) / 100);
    if (!owned) ctx.globalAlpha = 0.25;
    if (id === "beacon") {
      box(ctx, -16, -8, 32, 38, 5, metal(ctx, "#59626c", -8, 30), INK, 2);
      line(ctx, 0, -8, 8, -30, "#8b949e", 4);
      for (let i = 0; i < 3; i++) line(ctx, -9, 4 + i * 8, 9, 4 + i * 8, "#39414b", 3);
      oval(ctx, 8, -32, 6, 6, "#ff5348");
      glow(ctx, 8, -32, 28, "#ff5348", owned ? 0.5 + sin(time * 5) * 0.35 : 0.2);
    } else {
      glow(ctx, 0, 0, 46, "#b98cff", owned ? 0.7 : 0.2);
      poly(ctx, [-6, -36, 14, -10, 8, 30, -14, 14, -18, -8], "#5b3f8c", "#e6d8ff", 2.5);
      poly(ctx, [-6, -36, 2, -4, 8, 30, -14, 14], "#8f6ad0");
      for (let i = 0; i < 4; i++) {
        const a = time * 0.8 + (i * TAU) / 4;
        oval(ctx, cos(a) * 34, sin(a) * 20, 2.5, 2.5, "#ffe9b0");
      }
    }
    ctx.restore();
  }

  const MISSION = { warden: [0.62, 0], bastion: [0.4, 0], command: [0.36, 0] };

  // The picture on each mission's results: the ship leaving its wrecked boss behind.
  function mission(ctx, level, w, h, time, look, vanguard, levels) {
    MQ.SpaceBackground.get(level.backdrop).thumbnail(ctx, w, h, time);
    const [scale] = MISSION[level.bossKind];
    const wreckage = sprite(level.bossKind);
    ctx.save();
    ctx.translate(w * 0.24, h * 0.5);
    ctx.rotate(-0.3);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(wreckage.plain, (-wreckage.w * scale) / 2, (-wreckage.h * scale) / 2, wreckage.w * scale, wreckage.h * scale);
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const k = (time * 0.5 + i / 4) % 1;
      glow(ctx, w * (0.16 + i * 0.05), h * (0.35 + ((i * 3) % 4) * 0.1), 12 + k * 34, i % 2 ? "#ffb04d" : level.accent, 1 - k);
    }
    ctx.save();
    ctx.translate(w * 0.7, h * 0.55 + sin(time * 2) * 5);
    player(ctx, { time, thrust: 1.2, hp: 1, flash: false, mood: "victory", look, levels, vanguard, muzzle: false });
    ctx.restore();
  }

  /* ---------- For cinematics ---------- */

  const register = (kind, name = kind) => MQ.VehicleArt.register(kind, (ctx, time) => {
    const { w, h, plain } = sprite(name);
    ctx.drawImage(plain, -w / 2, -h / 2, w, h);
    if (name === "warden") glow(ctx, -60, 0, 50, "#ffb04d", 0.6 + sin(time * 5) * 0.2);
    else if (name === "bastion") glow(ctx, 0, 0, 90, "#58d6c2", 0.6 + sin(time * 4) * 0.2);
    else if (name === "command") glow(ctx, -80, 0, 80, "#d24cff", 0.6 + sin(time * 4) * 0.2);
  });
  register("imperialFighter", "fighter");
  for (const kind of ["eliteInterceptor", "transport", "platform", "capital", "warden", "bastion", "command"]) register(kind);

  MQ.SpaceArt = { player, enemy, rock, block, arm, strike, boss, icon, relic, mission };
})(window.MQ);
