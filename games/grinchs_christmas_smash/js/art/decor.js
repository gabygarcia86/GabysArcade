/*
 * Art for every Christmas object. Each kind paints itself in "design" coordinates (origin
 * at the bottom centre, or the centre for round things) and is cached as a sprite. Faces,
 * cracks, fizzing fuses and hit flashes are drawn live on top.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const TAU = Math.PI * 2;
  const shade = G.shade;

  // ---------------------------------------------------------------- Painters

  const P = {};

  P.ornament = (ctx, t) => {
    const r = t.def.radius;
    const c = t.color;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, shade(c, 0.55));
    g.addColorStop(0.45, c);
    g.addColorStop(1, shade(c, -0.45));
    Art.circle(ctx, 0, 0, r, g);
    const kind = Math.floor(t.seed) % 3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.clip();
    if (kind === 0) {
      // A zig-zag band.
      ctx.strokeStyle = "#fff6c8";
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = -r + (i / 12) * 2 * r;
        const y = (i % 2 ? -1 : 1) * r * 0.14;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (kind === 1) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      const rnd = Art.rng(t.seed);
      for (let i = 0; i < 7; i++) Art.circle(ctx, (rnd() - 0.5) * 1.6 * r, (rnd() - 0.5) * 1.6 * r, r * 0.1, "rgba(255,255,255,0.85)");
    } else {
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(-r, -r * 0.32, 2 * r, r * 0.12);
      ctx.fillRect(-r, r * 0.22, 2 * r, r * 0.12);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = -2; i <= 2; i++) Art.circle(ctx, i * r * 0.36, -r * 0.03, r * 0.06, "rgba(255,255,255,0.85)");
    }
    ctx.restore();
    Art.ellipse(ctx, -r * 0.38, -r * 0.42, r * 0.24, r * 0.14, "rgba(255,255,255,0.75)", -0.6);
    // Cap and hook.
    const cw = Math.max(5, r * 0.32);
    const ch = Math.max(4, r * 0.22);
    const cg = ctx.createLinearGradient(-cw, 0, cw, 0);
    cg.addColorStop(0, "#b8862a");
    cg.addColorStop(0.5, "#ffe58a");
    cg.addColorStop(1, "#a0701f");
    ctx.fillStyle = cg;
    Art.roundRect(ctx, -cw, -r - ch * 0.6, cw * 2, ch, 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a13a";
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.arc(0, -r - ch * 0.6 - r * 0.12, r * 0.13, 0, TAU);
    ctx.stroke();
  };

  P.stocking = (ctx, t) => {
    const c = t.color === "#ffd23f" ? "#e0303a" : t.color;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(-14, -46);
    ctx.lineTo(13, -46);
    ctx.lineTo(14, -20);
    ctx.quadraticCurveTo(26, -14, 23, -5);
    ctx.quadraticCurveTo(20, 1, 8, 0);
    ctx.lineTo(-6, 0);
    ctx.quadraticCurveTo(-17, -1, -15, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(c, -0.35);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Stripes.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    for (let y = -40; y < 0; y += 11) ctx.fillRect(-20, y, 50, 4);
    ctx.restore();
    // Heel and toe patches.
    ctx.fillStyle = "#2fbf71";
    ctx.beginPath();
    ctx.arc(-11, -6, 6, Math.PI * 0.5, Math.PI * 1.4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19, -6, 6, -Math.PI * 0.4, Math.PI * 0.5);
    ctx.fill();
    // Fluffy cuff.
    Art.roundRect(ctx, -17, -59, 34, 15, 6);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    for (let i = 0; i < 5; i++) Art.circle(ctx, -14 + i * 7, -58 + (i % 2) * 2, 4, "#ffffff");
    ctx.strokeStyle = "#d8e6f5";
    ctx.lineWidth = 1;
    Art.roundRect(ctx, -17, -59, 34, 15, 6);
    ctx.stroke();
    // A candy cane peeking out.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, -58);
    ctx.lineTo(8, -70);
    ctx.arc(4, -70, 4, 0, -Math.PI, true);
    ctx.stroke();
    ctx.strokeStyle = "#e0303a";
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  P.candyCane = (ctx, t, w, h) => {
    const R = w * 0.95;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, -w * 0.5);
      ctx.lineTo(0, -h + w / 2 + R);
      ctx.arc(-R, -h + w / 2 + R, R, 0, -Math.PI, true);
      ctx.lineTo(-2 * R, -h + w / 2 + R + R * 0.7);
    };
    ctx.lineCap = "round";
    path();
    ctx.strokeStyle = "#b8c7d8";
    ctx.lineWidth = w + 2;
    ctx.stroke();
    path();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = w;
    ctx.stroke();
    path();
    ctx.strokeStyle = t.def.key === "candyCaneTall" ? "#2fae5c" : "#e0303a";
    ctx.lineCap = "butt";
    ctx.setLineDash([w * 0.55, w * 0.65]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = w * 0.18;
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -w);
    ctx.lineTo(-w * 0.22, -h + w + R);
    ctx.stroke();
  };

  P.wreath = (ctx, t) => {
    const r = t.def.radius;
    const rnd = Art.rng(t.seed);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      Art.circle(ctx, Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, r * 0.3, "#1f7a3a");
    }
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + 0.15;
      Art.circle(ctx, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66 - 1, r * 0.22, i % 2 ? "#2fa34d" : "#38b85a");
    }
    for (let i = 0; i < 9; i++) {
      const a = rnd() * TAU;
      const d = r * (0.55 + rnd() * 0.25);
      Art.circle(ctx, Math.cos(a) * d, Math.sin(a) * d, 3.2, "#e0303a");
      Art.circle(ctx, Math.cos(a) * d - 1, Math.sin(a) * d - 1, 1, "#ffb3b3");
    }
    Art.bow(ctx, 0, r * 0.72, r * 0.42, "#e0303a");
  };

  function bellBody(ctx, s, golden) {
    ctx.save();
    ctx.scale(s, s);
    const g = ctx.createLinearGradient(-28, 0, 28, 0);
    if (golden) {
      g.addColorStop(0, "#a0700a");
      g.addColorStop(0.3, "#ffe680");
      g.addColorStop(0.55, "#ffc82e");
      g.addColorStop(1, "#8a5a05");
    } else {
      g.addColorStop(0, "#8c5a16");
      g.addColorStop(0.3, "#f2c45a");
      g.addColorStop(0.6, "#d79b2a");
      g.addColorStop(1, "#7a4a10");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-15, -54);
    ctx.quadraticCurveTo(0, -64, 15, -54);
    ctx.bezierCurveTo(18, -34, 18, -16, 28, -6);
    ctx.quadraticCurveTo(29, 0, 24, 0);
    ctx.lineTo(-24, 0);
    ctx.quadraticCurveTo(-29, 0, -28, -6);
    ctx.bezierCurveTo(-18, -16, -18, -34, -15, -54);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = golden ? "#8a5a05" : "#6b3f0c";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Rim band.
    ctx.fillStyle = golden ? "rgba(255,240,170,0.7)" : "rgba(255,220,140,0.5)";
    ctx.fillRect(-25, -10, 50, 3);
    // Clapper.
    Art.circle(ctx, 0, 2, 5, golden ? "#c58a10" : "#7a4a10");
    // Shine.
    Art.ellipse(ctx, -7, -36, 3, 10, "rgba(255,255,255,0.55)", 0.15);
    // Holly and a bow on top.
    if (golden) {
      ctx.fillStyle = "#2f9e4a";
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * 9, -60, 9, 4, side * 0.5, 0, TAU);
        ctx.fill();
      }
      Art.circle(ctx, -2, -60, 3, "#e0303a");
      Art.circle(ctx, 3, -61, 3, "#e0303a");
    } else {
      Art.bow(ctx, 0, -60, 9, "#e0303a");
    }
    ctx.restore();
  }

  P.bell = (ctx) => bellBody(ctx, 1, false);
  P.goldenBell = (ctx) => {
    bellBody(ctx, 76 / 54, true);
    Art.sparkle(ctx, 24, -70, 7, "#fffbe0");
    Art.sparkle(ctx, -30, -30, 5, "#fffbe0");
  };

  P.star = (ctx, t) => {
    const r = t.def.r;
    const cy = -t.def.lift;
    const glow = ctx.createRadialGradient(0, cy, r * 0.3, 0, cy, r * 1.5);
    glow.addColorStop(0, "rgba(255, 240, 150, 0.6)");
    glow.addColorStop(1, "rgba(255, 240, 150, 0)");
    Art.circle(ctx, 0, cy, r * 1.5, glow);
    const g = ctx.createRadialGradient(-r * 0.3, cy - r * 0.3, 2, 0, cy, r * 1.2);
    g.addColorStop(0, "#fff7c2");
    g.addColorStop(0.5, "#ffd23f");
    g.addColorStop(1, "#e09a10");
    Art.starPath(ctx, 0, cy, r * 1.2, 0, 5, 0.5);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#b8780a";
    ctx.lineWidth = 2;
    ctx.stroke();
    Art.starPath(ctx, 0, cy, r * 0.55, 0, 5, 0.5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fill();
  };

  const PATTERNS = ["dots", "stripes", "stars", "zigzag", "plain"];

  function presentBox(ctx, t, w, h, base, ribbon, pattern) {
    const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    g.addColorStop(0, shade(base, 0.2));
    g.addColorStop(1, shade(base, -0.2));
    Art.roundRect(ctx, -w / 2, -h, w, h, 3);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const rnd = Art.rng(t.seed);
    ctx.fillStyle = "rgba(255,255,255,0.38)";
    if (pattern === "dots") {
      for (let y = -h + 6; y < 0; y += 11) for (let x = -w / 2 + 6 + ((y / 11) % 2 ? 5 : 0); x < w / 2; x += 11) Art.circle(ctx, x, y, 2.2, "rgba(255,255,255,0.4)");
    } else if (pattern === "stripes") {
      ctx.save();
      ctx.rotate(-0.6);
      for (let x = -w * 1.5; x < w * 1.5; x += 12) ctx.fillRect(x, -h * 2, 5, h * 4);
      ctx.restore();
    } else if (pattern === "stars") {
      for (let i = 0; i < Math.max(3, (w * h) / 500); i++) {
        Art.starPath(ctx, (rnd() - 0.5) * w, -rnd() * h, 4, 0);
        ctx.fill();
      }
    } else if (pattern === "zigzag") {
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.lineWidth = 2.5;
      for (let y = -h + 8; y < 0; y += 14) {
        ctx.beginPath();
        for (let x = -w / 2; x <= w / 2; x += 6) ctx.lineTo(x, y + ((x / 6) % 2 ? 3 : -3));
        ctx.stroke();
      }
    }
    // Lid shadow.
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(-w / 2, -h + h * 0.2, w, 3);
    ctx.restore();
    // Ribbon.
    const rw = Math.max(5, w * 0.14);
    ctx.fillStyle = ribbon;
    ctx.fillRect(-rw / 2, -h, rw, h);
    ctx.fillRect(-w / 2, -h * 0.62 - rw / 2, w, rw);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(-rw / 2, -h, rw * 0.3, h);
    ctx.strokeStyle = shade(base, -0.45);
    ctx.lineWidth = 1.5;
    Art.roundRect(ctx, -w / 2, -h, w, h, 3);
    ctx.stroke();
  }

  P.present = (ctx, t, w, h) => {
    const pattern = PATTERNS[Math.floor(t.seed * 7) % PATTERNS.length];
    const ribbon = t.ribbon === t.color ? "#ffffff" : t.ribbon;
    presentBox(ctx, t, w, h, t.color, ribbon, pattern);
    Art.bow(ctx, 0, -h, Math.max(7, w * 0.22), ribbon);
  };

  P.goldPresent = (ctx, t, w, h) => {
    presentBox(ctx, t, w, h, "#f2b705", "#e0303a", "stars");
    Art.bow(ctx, 0, -h, w * 0.26, "#e0303a");
    Art.sparkle(ctx, w * 0.36, -h * 0.75, 6);
    Art.sparkle(ctx, -w * 0.3, -h * 0.25, 4);
  };

  P.boomPresent = (ctx, t, w, h) => {
    presentBox(ctx, t, w, h, "#c4161c", "#1d1d1d", "plain");
    // Hazard stripes along the bottom.
    ctx.save();
    Art.roundRect(ctx, -w / 2, -h * 0.28, w, h * 0.28, 3);
    ctx.clip();
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = "#1d1d1d";
    for (let x = -w; x < w; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x + 13, -h * 0.3);
      ctx.lineTo(x + 8, -h * 0.3);
      ctx.fill();
    }
    ctx.restore();
    // "BOOM!" label.
    ctx.fillStyle = "#ffd23f";
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 3;
    ctx.font = `900 ${Math.round(h * 0.3)}px Oxanium, "Trebuchet MS", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("BOOM!", 0, -h * 0.55);
    ctx.fillText("BOOM!", 0, -h * 0.55);
    // Fuse.
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(6, -h - 8, -6, -h - 12, 3, -h - 18);
    ctx.stroke();
  };

  P.snowman = (ctx, t) => {
    const s = t.def.scale;
    const balls = t.def.balls;
    // Stick arms behind the body.
    const mid = balls[1];
    ctx.strokeStyle = "#6b4321";
    ctx.lineWidth = 3 * s;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * mid[1] * 0.7, mid[0]);
      ctx.lineTo(side * mid[1] * 1.75, mid[0] - mid[1] * 0.75);
      ctx.moveTo(side * mid[1] * 1.45, mid[0] - mid[1] * 0.45);
      ctx.lineTo(side * mid[1] * 1.6, mid[0] - mid[1] * 0.95);
      ctx.stroke();
    }
    for (const [cy, r] of balls) {
      const g = ctx.createRadialGradient(-r * 0.35, cy - r * 0.4, r * 0.1, 0, cy, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.7, "#eef6ff");
      g.addColorStop(1, "#b9d3ec");
      Art.circle(ctx, 0, cy, r, g);
    }
    // Buttons.
    for (let i = -1; i <= 1; i++) Art.circle(ctx, 0, mid[0] + i * mid[1] * 0.42, 2.6 * s, "#2b2b35");
    Art.circle(ctx, 0, balls[0][0] - balls[0][1] * 0.25, 2.8 * s, "#2b2b35");
    // Scarf.
    const head = balls[2];
    const neck = head[0] + head[1] * 0.85;
    const scarf = t.color === "#ffd23f" ? "#e0303a" : t.color;
    Art.roundRect(ctx, -head[1] * 1.05, neck - 4 * s, head[1] * 2.1, 8 * s, 4 * s);
    ctx.fillStyle = scarf;
    ctx.fill();
    ctx.fillRect(head[1] * 0.3, neck, 7 * s, 18 * s);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(head[1] * 0.3, neck + 8 * s, 7 * s, 3 * s);
    ctx.fillRect(-head[1] * 0.5, neck - 4 * s, 3 * s, 8 * s);
    // Top hat.
    const top = head[0] - head[1];
    ctx.fillStyle = "#24242e";
    ctx.fillRect(-head[1] * 1.0, top + 1 * s, head[1] * 2.0, 4 * s);
    Art.roundRect(ctx, -head[1] * 0.68, top - head[1] * 1.1, head[1] * 1.36, head[1] * 1.15, 2 * s);
    ctx.fill();
    ctx.fillStyle = "#e0303a";
    ctx.fillRect(-head[1] * 0.68, top - head[1] * 0.25, head[1] * 1.36, 4 * s);
    Art.circle(ctx, head[1] * 0.4, top - head[1] * 0.2, 2.5 * s, "#2fbf71");
  };

  function treeBody(ctx, t, w, h) {
    const tk = h * 0.09;
    const mega = t.def.mega;
    // Trunk and pot.
    ctx.fillStyle = "#7a4a22";
    ctx.fillRect(-w * 0.08, -tk * 1.8, w * 0.16, tk * 1.8);
    ctx.fillStyle = "#c4161c";
    ctx.beginPath();
    ctx.moveTo(-w * 0.17, -tk);
    ctx.lineTo(w * 0.17, -tk);
    ctx.lineTo(w * 0.13, 0);
    ctx.lineTo(-w * 0.13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(-w * 0.17, -tk, w * 0.34, tk * 0.22);
    // Three tiers of branches, each with a snowy fringe.
    const fh = h - tk;
    const tiers = mega ? 4 : 3;
    for (let i = 0; i < tiers; i++) {
      const k = i / tiers;
      const base = -tk - fh * k * 0.78;
      const half = (w / 2) * (1 - k * 0.72);
      const top = base - fh * (0.42 + (mega ? 0.02 : 0.08));
      const apex = i === tiers - 1 ? -h : top;
      const g = ctx.createLinearGradient(-half, 0, half, 0);
      g.addColorStop(0, "#1c6b33");
      g.addColorStop(0.45, "#2fa34d");
      g.addColorStop(1, "#155a29");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, apex);
      ctx.lineTo(half, base);
      for (let j = 6; j >= 0; j--) {
        const x = -half + (j / 6) * 2 * half;
        ctx.quadraticCurveTo(x + half / 6, base + 7, x, base);
      }
      ctx.closePath();
      ctx.fill();
      // Snow along the bottom edge.
      ctx.fillStyle = "#f4fbff";
      for (let j = 0; j <= 6; j++) {
        const x = -half + (j / 6) * 2 * half;
        Art.ellipse(ctx, x, base + 1, half / 7, 4, "#f4fbff");
      }
    }
    // Garland.
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = mega ? 4 : 2.5;
    for (let i = 0; i < (mega ? 5 : 3); i++) {
      const y = -tk - fh * (0.18 + i * (mega ? 0.15 : 0.22));
      const half = (w / 2) * (1 - (y + tk) / -fh) * 0.82;
      ctx.beginPath();
      ctx.moveTo(-half, y - half * 0.12);
      ctx.quadraticCurveTo(0, y + half * 0.25, half, y + half * 0.12);
      ctx.stroke();
    }
    // Baubles.
    const rnd = Art.rng(t.seed);
    const n = mega ? 34 : Math.round(w / 9);
    for (let i = 0; i < n; i++) {
      const fy = 0.08 + rnd() * 0.75;
      const y = -tk - fh * fy;
      const half = (w / 2) * (1 - fy) * 0.78;
      const x = (rnd() * 2 - 1) * half;
      const r = mega ? 6 + rnd() * 4 : 4 + rnd() * 2.5;
      const col = G.Objects.COLORS[Math.floor(rnd() * G.Objects.COLORS.length)];
      Art.circle(ctx, x, y, r, col);
      Art.circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.3, "rgba(255,255,255,0.7)");
    }
    if (mega) {
      // Candy canes tucked in.
      for (let i = 0; i < 6; i++) {
        const fy = 0.15 + i * 0.11;
        const y = -tk - fh * fy;
        const x = (i % 2 ? 1 : -1) * (w / 2) * (1 - fy) * 0.5;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x, y - 6);
        ctx.arc(x - 6, y - 6, 6, 0, -Math.PI, true);
        ctx.stroke();
        ctx.strokeStyle = "#e0303a";
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Star on top.
    const sr = mega ? 34 : w * 0.16;
    const sg = ctx.createRadialGradient(0, -h - sr * 0.2, 2, 0, -h, sr * 1.6);
    sg.addColorStop(0, "rgba(255,240,150,0.7)");
    sg.addColorStop(1, "rgba(255,240,150,0)");
    Art.circle(ctx, 0, -h - sr * 0.3, sr * 1.6, sg);
    Art.starPath(ctx, 0, -h - sr * 0.35, sr, 0, 5, 0.48);
    ctx.fillStyle = "#ffd23f";
    ctx.fill();
    ctx.strokeStyle = "#c98a0a";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  P.tree = (ctx, t) => treeBody(ctx, t, t.def.w, t.def.h);

  P.gingerHouse = (ctx, t) => {
    const W = 66;
    // Chimney.
    ctx.fillStyle = "#9a5a2a";
    ctx.fillRect(28, -122, 16, 30);
    ctx.fillStyle = "#fff";
    ctx.fillRect(26, -126, 20, 6);
    // Walls.
    ctx.fillStyle = "#b8733b";
    ctx.fillRect(-W, -74, W * 2, 74);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = -64; y < 0; y += 14) ctx.fillRect(-W, y, W * 2, 2);
    // Roof.
    ctx.fillStyle = "#8a4f25";
    ctx.beginPath();
    ctx.moveTo(-W - 10, -70);
    ctx.lineTo(0, -130);
    ctx.lineTo(W + 10, -70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      Art.circle(ctx, -W - 10 + k * (W + 10), -70 - k * 60, 5.5, "#ffffff");
      Art.circle(ctx, W + 10 - k * (W + 10), -70 - k * 60, 5.5, "#ffffff");
    }
    // Icing drips along the eaves.
    for (let x = -W; x <= W; x += 12) Art.ellipse(ctx, x, -71, 4, 6, "#ffffff");
    // Gumdrops on the roof.
    const cols = ["#e0303a", "#2fbf71", "#ffd23f", "#9b4dff", "#2f7de1"];
    for (let i = 0; i < 5; i++) {
      const k = 0.18 + i * 0.16;
      Art.ellipse(ctx, -W * 0.55 + i * W * 0.28, -84 - Math.sin(k * Math.PI) * 18, 5, 4, cols[i]);
    }
    // Door with candy-cane frame.
    Art.roundRect(ctx, -12, -40, 24, 40, 10);
    ctx.fillStyle = "#6b3a1a";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "#e0303a";
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    Art.circle(ctx, 6, -20, 2, "#ffd23f");
    // Lit windows.
    for (const x of [-44, 30]) {
      ctx.fillStyle = "#ffe27a";
      ctx.fillRect(x, -56, 16, 16);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, -56, 16, 16);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 8, -56);
      ctx.lineTo(x + 8, -40);
      ctx.moveTo(x, -48);
      ctx.lineTo(x + 16, -48);
      ctx.stroke();
    }
    // Candy along the bottom.
    for (let x = -W + 6; x < W; x += 14) Art.circle(ctx, x, -4, 4, cols[Math.abs(x) % 5]);
  };

  P.gingerMan = (ctx) => {
    const c = "#b8733b";
    ctx.fillStyle = c;
    ctx.strokeStyle = c;
    ctx.lineCap = "round";
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(-28, -62);
    ctx.lineTo(28, -62);
    ctx.moveTo(-12, -40);
    ctx.lineTo(-22, -8);
    ctx.moveTo(12, -40);
    ctx.lineTo(22, -8);
    ctx.stroke();
    Art.ellipse(ctx, 0, -50, 22, 26, c);
    Art.circle(ctx, 0, -92, 24, c);
    // Icing.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) ctx.lineTo(side * (30 - i * 1.2), -68 + (i % 2) * 5 + i * 1.5);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) ctx.lineTo(side * (20 + (i % 2) * 6), -12 + i * 1.6);
      ctx.stroke();
    }
    // Buttons and bow tie.
    Art.circle(ctx, 0, -50, 4, "#e0303a");
    Art.circle(ctx, 0, -36, 4, "#2fbf71");
    ctx.fillStyle = "#2f7de1";
    ctx.beginPath();
    ctx.moveTo(0, -68);
    ctx.lineTo(-9, -73);
    ctx.lineTo(-9, -63);
    ctx.closePath();
    ctx.moveTo(0, -68);
    ctx.lineTo(9, -73);
    ctx.lineTo(9, -63);
    ctx.closePath();
    ctx.fill();
  };

  P.gingerBit = (ctx, t) => {
    const r = t.def.radius;
    ctx.fillStyle = "#b8733b";
    ctx.beginPath();
    ctx.arc(0, 0, r, 0.5, TAU - 0.2);
    ctx.arc(r * 0.95, -r * 0.1, r * 0.35, Math.PI * 1.4, Math.PI * 0.6, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0.8, 2.6);
    ctx.stroke();
    Art.circle(ctx, -r * 0.2, -r * 0.25, 2.5, t.color);
  };

  P.gumdrop = (ctx, t) => {
    const c = t.color;
    const g = ctx.createRadialGradient(-5, -16, 2, 0, -10, 22);
    g.addColorStop(0, shade(c, 0.5));
    g.addColorStop(1, shade(c, -0.25));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.quadraticCurveTo(-17, -24, 0, -25);
    ctx.quadraticCurveTo(17, -24, 16, 0);
    ctx.closePath();
    ctx.fill();
    const rnd = Art.rng(t.seed);
    for (let i = 0; i < 9; i++) Art.circle(ctx, (rnd() - 0.5) * 24, -rnd() * 20 - 2, 1.2, "rgba(255,255,255,0.85)");
  };

  P.plank = (ctx, t, w, h) => {
    const horizontal = w >= h;
    const g = horizontal ? ctx.createLinearGradient(0, -h, 0, 0) : ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, "#d99a5b");
    g.addColorStop(1, "#a8692f");
    ctx.fillStyle = g;
    Art.roundRect(ctx, -w / 2, -h, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(90, 50, 20, 0.45)";
    ctx.lineWidth = 1.2;
    const rnd = Art.rng(t.seed);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      if (horizontal) {
        const y = -h + (h * (i + 1)) / 4;
        ctx.moveTo(-w / 2 + 3, y);
        ctx.bezierCurveTo(-w / 6, y + (rnd() - 0.5) * 4, w / 6, y + (rnd() - 0.5) * 4, w / 2 - 3, y);
      } else {
        const x = -w / 2 + (w * (i + 1)) / 4;
        ctx.moveTo(x, -h + 3);
        ctx.bezierCurveTo(x + (rnd() - 0.5) * 4, -h * 0.66, x + (rnd() - 0.5) * 4, -h * 0.33, x, -3);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "#6e3f16";
    ctx.lineWidth = 1.6;
    Art.roundRect(ctx, -w / 2, -h, w, h, 3);
    ctx.stroke();
    // Nails.
    if (horizontal) {
      Art.circle(ctx, -w / 2 + 6, -h / 2, 1.8, "#5a5a66");
      Art.circle(ctx, w / 2 - 6, -h / 2, 1.8, "#5a5a66");
      // A little snow on top.
      ctx.fillStyle = "#f4fbff";
      Art.roundRect(ctx, -w / 2 + 1, -h - 3, w - 2, 5, 2.5);
      ctx.fill();
      for (let x = -w / 2 + 8; x < w / 2 - 4; x += 16) Art.ellipse(ctx, x, -h + 2, 4, 2.5, "#f4fbff");
    } else {
      Art.circle(ctx, 0, -h + 6, 1.8, "#5a5a66");
      Art.circle(ctx, 0, -6, 1.8, "#5a5a66");
    }
  };

  P.ice = (ctx, t, w, h) => {
    const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    g.addColorStop(0, "rgba(220, 248, 255, 0.95)");
    g.addColorStop(0.5, "rgba(150, 215, 245, 0.88)");
    g.addColorStop(1, "rgba(100, 175, 225, 0.92)");
    Art.roundRect(ctx, -w / 2, -h, w, h, 5);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 5, -h + 6);
    ctx.lineTo(-w / 2 + Math.min(w, h) * 0.4, -h + 6);
    ctx.moveTo(-w / 2 + 5, -h + 6);
    ctx.lineTo(-w / 2 + 5, -h + Math.min(w, h) * 0.45);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    const rnd = Art.rng(t.seed);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo((rnd() - 0.5) * w * 0.8, -rnd() * h);
      ctx.lineTo((rnd() - 0.5) * w * 0.8, -rnd() * h);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(60, 130, 190, 0.7)";
    ctx.lineWidth = 1.5;
    Art.roundRect(ctx, -w / 2, -h, w, h, 5);
    ctx.stroke();
  };

  P.candyBeam = (ctx, t, w, h) => {
    Art.roundRect(ctx, -w / 2, -h, w, h, Math.min(w, h) / 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.save();
    ctx.clip();
    const horizontal = w >= h;
    ctx.translate(0, -h / 2);
    ctx.rotate(horizontal ? -0.7 : 0.7 + Math.PI / 2);
    const L = Math.max(w, h) * 1.6;
    for (let x = -L; x < L; x += 18) {
      ctx.fillStyle = "#e0303a";
      ctx.fillRect(x, -L, 7, L * 2);
      ctx.fillStyle = "#2fae5c";
      ctx.fillRect(x + 10, -L, 3, L * 2);
    }
    ctx.restore();
    ctx.strokeStyle = "#b8c7d8";
    ctx.lineWidth = 1.5;
    Art.roundRect(ctx, -w / 2, -h, w, h, Math.min(w, h) / 2);
    ctx.stroke();
  };

  // ---------------------------------------------------------------- Bounds

  // The sprite box (in design coordinates) for a thing, with room for bows, hats and hooks.
  function bounds(t) {
    const d = t.def;
    if (d.radius) {
      const r = d.radius;
      return [-r - 6, -r - r * 0.5 - 8, r * 2 + 12, r * 2 + r * 0.5 + 24];
    }
    let w;
    let h;
    if (d.sized) {
      w = t.w;
      h = t.h;
    } else {
      const xs = d.verts.map((v) => v[0]);
      const ys = d.verts.map((v) => v[1]);
      w = Math.max(...xs) - Math.min(...xs);
      h = -Math.min(...ys);
    }
    const padX = d.kind === "snowman" ? w * 0.45 : d.kind === "candyCane" ? w * 2.6 : d.kind === "star" ? 18 : 14;
    const padTop = d.kind === "present" || d.kind === "goldPresent" ? w * 0.3 + 10 : d.kind === "snowman" ? h * 0.2 : d.kind === "tree" ? 60 : d.kind === "boomPresent" ? 24 : 18;
    return [-w / 2 - padX, -h - padTop, w + padX * 2, h + padTop + 8];
  }

  function spriteFor(t) {
    const d = t.def;
    const sized = d.sized ? `${t.w}x${t.h}` : "";
    const variant = d.kind === "tree" || d.kind === "plank" || d.kind === "ice" || d.kind === "ornament" || d.kind === "present" || d.kind === "gumdrop" ? Math.floor(t.seed) % 6 : 0;
    const key = `${d.key}|${sized}|${t.color}|${t.ribbon}|${variant}`;
    const [x, y, w, h] = bounds(t);
    return Art.sprite(key, x, y, w, h, (ctx) => {
      const painter = P[d.kind];
      const seedSave = t.seed;
      t.seed = variant + 1 + (seedSave % 1);
      if (painter) painter(ctx, t, d.sized ? t.w : bw(d), d.sized ? t.h : bh(d));
      t.seed = seedSave;
    });
  }

  function bw(d) {
    if (!d.verts) return 0;
    const xs = d.verts.map((v) => v[0]);
    return Math.max(...xs) - Math.min(...xs);
  }

  function bh(d) {
    if (!d.verts) return 0;
    return -Math.min(...d.verts.map((v) => v[1]));
  }

  // ---------------------------------------------------------------- Live overlays

  // Eyes and mouth. `look` is a unit vector the eyes glance along (in design space).
  function face(ctx, t, x, y, s, style, time, lookX, lookY) {
    const mood = t.mood;
    const blink = mood === "calm" && (time + t.seed) % 4 < 0.12;
    const eyeDX = 6 * s;
    const lx = lookX * 1.8 * s;
    const ly = lookY * 1.8 * s;
    const ink = style === "ginger" ? "#ffffff" : "#1d1d26";
    ctx.lineCap = "round";
    for (const side of [-1, 1]) {
      const ex = x + side * eyeDX;
      const ey = y - 3 * s;
      if (mood === "dizzy") {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        for (let a = 0; a < TAU * 1.5; a += 0.35) {
          const rr = a * 0.55 * s;
          const px = ex + Math.cos(a + time * 9) * rr;
          const py = ey + Math.sin(a + time * 9) * rr;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }
      if (style === "ornament") {
        const big = mood === "worried" ? 1.35 : 1;
        Art.ellipse(ctx, ex, ey, 4.2 * s * big, 5 * s * big, "#ffffff");
        if (!blink) Art.circle(ctx, ex + lx, ey + ly, 2.3 * s, "#1d1d26");
      } else if (blink) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6 * s;
        ctx.beginPath();
        ctx.moveTo(ex - 2.5 * s, ey);
        ctx.lineTo(ex + 2.5 * s, ey);
        ctx.stroke();
      } else {
        const big = mood === "worried" ? 1.5 : 1;
        if (mood === "worried") Art.circle(ctx, ex, ey, 3.6 * s * big, style === "ginger" ? "rgba(0,0,0,0.25)" : "#ffffff");
        Art.circle(ctx, ex + lx * 0.6, ey + ly * 0.6, 2.4 * s, ink);
      }
      if (mood === "worried") {
        ctx.strokeStyle = style === "ginger" ? "#ffffff" : "#1d1d26";
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.moveTo(ex - 3.5 * s, ey - 7 * s + side * 1.5 * s);
        ctx.lineTo(ex + 3.5 * s, ey - 7 * s - side * 1.5 * s);
        ctx.stroke();
      }
    }
    // Carrot nose for snowmen.
    if (style === "snowman") {
      ctx.fillStyle = "#ff8a1f";
      ctx.beginPath();
      ctx.moveTo(x - 1 * s, y - 1.5 * s);
      ctx.lineTo(x + 13 * s, y + 1 * s);
      ctx.lineTo(x - 1 * s, y + 2.5 * s);
      ctx.closePath();
      ctx.fill();
    }
    // Mouth.
    const my = y + 6 * s;
    if (mood === "worried") {
      Art.ellipse(ctx, x, my + 1 * s, 2.8 * s, 3.6 * s, style === "ginger" ? "#ffffff" : "#1d1d26");
    } else if (mood === "dizzy") {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) ctx.lineTo(x - 6 * s + i * 2 * s, my + Math.sin(i * 1.7 + time * 12) * 1.4 * s);
      ctx.stroke();
    } else if (style === "snowman") {
      for (let i = -2; i <= 2; i++) Art.circle(ctx, x + i * 2.6 * s, my + Math.abs(i) * -0.8 * s + 1 * s, 1.1 * s, "#1d1d26");
    } else {
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.8 * s;
      ctx.beginPath();
      ctx.arc(x, my - 2 * s, 5 * s, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }
  }

  // Cracks appear as an object loses health.
  function cracks(ctx, t, path) {
    const hp = t.health;
    if (hp > 0.7) return;
    const n = hp > 0.4 ? 2 : 4;
    const rnd = Art.rng(t.seed * 7 + 3);
    ctx.save();
    path();
    ctx.clip();
    ctx.strokeStyle = t.def.mat === "ice" || t.def.mat === "glass" ? "rgba(255,255,255,0.9)" : "rgba(40, 20, 10, 0.6)";
    ctx.lineWidth = 1.6;
    const b = t.body;
    const span = b.bound;
    for (let i = 0; i < n; i++) {
      let x = (rnd() - 0.5) * span;
      let y = (rnd() - 0.5) * span;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * span * 0.6;
        y += (rnd() - 0.5) * span * 0.6;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // Path of the body's real collision shape in body-local coordinates.
  function bodyPath(ctx, b) {
    ctx.beginPath();
    if (b.type === "circle") {
      ctx.arc(0, 0, b.r, 0, TAU);
      return;
    }
    for (let i = 0; i < b.n; i++) {
      if (i === 0) ctx.moveTo(b.lx[i], b.ly[i]);
      else ctx.lineTo(b.lx[i], b.ly[i]);
    }
    ctx.closePath();
  }

  // Draws one thing. `time` drives faces and fuses; `look` aims nervous eyes.
  Art.drawThing = (ctx, t, time, look) => {
    const b = t.body;
    const d = t.def;
    ctx.save();
    let sx = 0;
    if (t.shake > 0) sx = Math.sin(time * 70 + t.seed) * t.shake * 3;
    if (t.wobble > 0) sx += Math.sin(time * 16) * t.wobble * 6;
    ctx.translate(b.x + sx, b.y);
    ctx.rotate(b.a);
    // Body-local space: cracks and flashes follow the real shape.
    const local = () => bodyPath(ctx, b);
    ctx.save();
    ctx.translate(-(b.offX || 0), -(b.offY || 0));
    Art.stamp(ctx, spriteFor(t));
    ctx.restore();
    cracks(ctx, t, local);
    ctx.save();
    ctx.translate(-(b.offX || 0), -(b.offY || 0));
    // Turn the look direction into this object's rotated frame.
    let lx = 0;
    let ly = 0;
    if (look) {
      const c = Math.cos(-b.a);
      const s = Math.sin(-b.a);
      lx = look.x * c - look.y * s;
      ly = look.x * s + look.y * c;
    }
    if (d.kind === "snowman") {
      const head = d.balls[2];
      face(ctx, t, 0, head[0] + 2 * d.scale, d.scale, "snowman", time, lx, ly);
    } else if (d.kind === "gingerMan") {
      face(ctx, t, 0, -92, 1.3, "ginger", time, lx, ly);
    } else if (d.face && d.radius) {
      face(ctx, t, 0, 4, d.radius / 18, "ornament", time, lx, ly);
    } else if (d.kind === "boomPresent") {
      // A fizzing fuse.
      const h = 48;
      const f = (Math.sin(time * 30 + t.seed) + 1) / 2;
      Art.circle(ctx, 3, -h - 19, 4 + f * 3, `rgba(255, ${180 + f * 60}, 60, 0.9)`);
      Art.sparkle(ctx, 3, -h - 19, 6 + f * 4, "#fff6a0");
    } else if (d.special === "ring" && t.ringGlow > 0) {
      Art.circle(ctx, 0, -40, 50 + (1 - t.ringGlow) * 30, `rgba(255, 230, 120, ${t.ringGlow * 0.35})`);
    }
    ctx.restore();
    if (t.flash > 0) {
      local();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.75, t.flash * 0.75)})`;
      ctx.fill();
    }
    ctx.restore();
  };

  // A small picture of an object for menus (drawn fresh, not cached).
  Art.thingIcon = (ctx, key, x, y, size) => {
    const d = G.DEFS[key];
    const fake = { def: d, color: "#e0303a", ribbon: "#ffd23f", seed: 2.3, w: 60, h: 20, mood: "calm", health: 1 };
    const [bx, by, bw2, bh2] = bounds(fake);
    const k = size / Math.max(bw2, bh2);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.translate(-(bx + bw2 / 2), -(by + bh2 / 2));
    P[d.kind](ctx, fake, d.sized ? 60 : bw(d), d.sized ? 20 : bh(d));
    ctx.restore();
  };
})(window.GS);
