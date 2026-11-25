/*
 * Backgrounds and fixed scenery: the sky (day, dusk, night or aurora), distant mountains
 * and a snowy village, the ground, the Grinch's hill, ledges, ramps, poles and the strings
 * of Christmas lights.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const TAU = Math.PI * 2;
  const GY = G.GROUND_Y;

  const SKIES = {
    day: { top: "#4fb8f5", mid: "#9fdcff", low: "#e6f7ff", hill: ["#cfe6f7", "#b5d4ee"], far: "#9fc1e0", village: "#7d9ec4", glow: false },
    dusk: { top: "#2d2a6e", mid: "#b45a8c", low: "#ffbb7a", hill: ["#a593c4", "#8d7bb0"], far: "#6c5a96", village: "#4c3d70", glow: true },
    night: { top: "#070c2a", mid: "#1a2560", low: "#3b4a8a", hill: ["#3a4a80", "#2d3b6c"], far: "#243263", village: "#18224a", glow: true },
    aurora: { top: "#031426", mid: "#0d2f4a", low: "#245a6e", hill: ["#2e5d78", "#234b64"], far: "#1b3d55", village: "#122a3e", glow: true },
  };
  Art.SKIES = SKIES;

  // ---------------------------------------------------------------- Sky

  // Fills the whole view (which may be larger than the stage) with the sky.
  Art.drawSky = (ctx, theme, view, time) => {
    const s = SKIES[theme] || SKIES.day;
    const g = ctx.createLinearGradient(0, view.y, 0, GY);
    g.addColorStop(0, s.top);
    g.addColorStop(0.55, s.mid);
    g.addColorStop(1, s.low);
    ctx.fillStyle = g;
    ctx.fillRect(view.x, view.y, view.w, GY - view.y + 10);
    if (theme === "day") {
      const sg = ctx.createRadialGradient(1640, 170, 10, 1640, 170, 150);
      sg.addColorStop(0, "rgba(255,255,220,1)");
      sg.addColorStop(0.3, "rgba(255,245,180,0.8)");
      sg.addColorStop(1, "rgba(255,245,180,0)");
      Art.circle(ctx, 1640, 170, 150, sg);
      // Drifting clouds.
      for (let i = 0; i < 4; i++) {
        const x = ((i * 560 + time * 14) % 2600) - 400;
        const y = 120 + (i % 2) * 90;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (let k = 0; k < 4; k++) Art.ellipse(ctx, x + k * 46, y + (k % 2) * -16, 58, 30);
        ctx.fill();
      }
    } else {
      // Stars.
      const rnd = Art.rng(theme === "dusk" ? 7 : 13);
      const n = theme === "dusk" ? 40 : 110;
      for (let i = 0; i < n; i++) {
        const x = view.x + rnd() * view.w;
        const y = view.y + rnd() * (GY * 0.55 - view.y);
        const tw = 0.5 + 0.5 * Math.sin(time * (1 + rnd() * 3) + i);
        Art.circle(ctx, x, y, 1 + rnd() * 1.6, `rgba(255,255,255,${0.35 + tw * 0.6})`);
      }
      if (theme === "night" || theme === "dusk") {
        const mx = theme === "night" ? 1660 : 1480;
        const my = theme === "night" ? 160 : 190;
        const mg = ctx.createRadialGradient(mx, my, 20, mx, my, 120);
        mg.addColorStop(0, "rgba(255,250,220,0.45)");
        mg.addColorStop(1, "rgba(255,250,220,0)");
        Art.circle(ctx, mx, my, 120, mg);
        Art.circle(ctx, mx, my, 48, "#fff8dc");
        Art.circle(ctx, mx + 14, my - 10, 9, "rgba(220,210,170,0.6)");
        Art.circle(ctx, mx - 16, my + 12, 6, "rgba(220,210,170,0.6)");
      }
      if (theme === "aurora") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let band = 0; band < 3; band++) {
          const col = band === 1 ? [160, 90, 255] : [60, 255, 170];
          ctx.beginPath();
          const base = 140 + band * 70;
          for (let x = view.x; x <= view.x + view.w; x += 40) {
            const y = base + Math.sin(x * 0.004 + time * 0.5 + band) * 45 + Math.sin(x * 0.011 - time * 0.8) * 18;
            if (x === view.x) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let x = view.x + view.w; x >= view.x; x -= 40) {
            const y = base + 150 + Math.sin(x * 0.004 + time * 0.5 + band) * 45;
            ctx.lineTo(x, y);
          }
          ctx.closePath();
          const ag = ctx.createLinearGradient(0, base - 40, 0, base + 200);
          ag.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0)`);
          ag.addColorStop(0.35, `rgba(${col[0]},${col[1]},${col[2]},0.22)`);
          ag.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
          ctx.fillStyle = ag;
          ctx.fill();
        }
        ctx.restore();
      }
    }
  };

  // Mountains and a snowy village, painted once per theme.
  Art.drawBackdrop = (ctx, theme) => {
    const s = SKIES[theme] || SKIES.day;
    const spr = Art.sprite(`backdrop|${theme}`, -400, 300, 2720, GY - 300 + 6, (c) => {
      // Far mountains.
      c.fillStyle = s.far;
      c.beginPath();
      c.moveTo(-400, GY);
      const peaks = [[-400, 640], [-120, 470], [150, 600], [430, 420], [720, 590], [980, 380], [1260, 560], [1520, 400], [1820, 570], [2080, 440], [2320, 600]];
      for (const [x, y] of peaks) c.lineTo(x, y);
      c.lineTo(2320, GY);
      c.closePath();
      c.fill();
      // Snow caps.
      c.fillStyle = "rgba(255,255,255,0.75)";
      for (let i = 1; i < peaks.length - 1; i++) {
        const [x, y] = peaks[i];
        if (y > 520) continue;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + 70, y + 60);
        c.lineTo(x + 40, y + 52);
        c.lineTo(x + 15, y + 66);
        c.lineTo(x - 15, y + 50);
        c.lineTo(x - 45, y + 62);
        c.lineTo(x - 70, y + 60);
        c.closePath();
        c.fill();
      }
      // Rolling snowy hills.
      for (let layer = 0; layer < 2; layer++) {
        c.fillStyle = s.hill[layer];
        c.beginPath();
        c.moveTo(-400, GY);
        for (let x = -400; x <= 2320; x += 40) {
          const y = 760 + layer * 70 + Math.sin(x * 0.004 + layer * 2) * 40 + Math.sin(x * 0.011 + layer) * 16;
          c.lineTo(x, y);
        }
        c.lineTo(2320, GY);
        c.closePath();
        c.fill();
      }
      // Distant village: little houses with glowing windows and pine trees.
      const rnd = Art.rng(theme.length * 31);
      for (let i = 0; i < 26; i++) {
        const x = 520 + i * 58 + rnd() * 20;
        const base = 880 + Math.sin(x * 0.004 + 2) * 40 + Math.sin(x * 0.011 + 1) * 16 - 2;
        if (rnd() < 0.35) {
          c.fillStyle = s.village;
          c.beginPath();
          c.moveTo(x, base - 70 - rnd() * 30);
          c.lineTo(x + 22, base);
          c.lineTo(x - 22, base);
          c.closePath();
          c.fill();
          continue;
        }
        const w = 36 + rnd() * 22;
        const h = 30 + rnd() * 26;
        c.fillStyle = s.village;
        c.fillRect(x - w / 2, base - h, w, h);
        c.beginPath();
        c.moveTo(x - w / 2 - 6, base - h);
        c.lineTo(x + (rnd() - 0.5) * 10, base - h - 26 - rnd() * 18);
        c.lineTo(x + w / 2 + 6, base - h);
        c.closePath();
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.8)";
        c.fillRect(x - w / 2 - 6, base - h - 3, w + 12, 4);
        c.fillStyle = s.glow ? "#ffd86b" : "rgba(255,240,200,0.9)";
        c.fillRect(x - w / 4 - 4, base - h * 0.6, 7, 8);
        c.fillRect(x + w / 4 - 3, base - h * 0.6, 7, 8);
      }
    });
    Art.stamp(ctx, spr);
  };

  // ---------------------------------------------------------------- Ground and hill

  Art.drawGround = (ctx, view, theme) => {
    const g = ctx.createLinearGradient(0, GY, 0, GY + 120);
    g.addColorStop(0, "#f4fbff");
    g.addColorStop(0.25, "#dcecf8");
    g.addColorStop(1, theme === "day" ? "#b9d2e8" : "#8ea7cc");
    ctx.fillStyle = g;
    ctx.fillRect(view.x, GY, view.w, view.y + view.h - GY + 10);
    ctx.fillStyle = "rgba(160, 190, 220, 0.35)";
    for (let x = Math.floor(view.x / 90) * 90; x < view.x + view.w; x += 90) Art.ellipse(ctx, x + 30, GY + 22 + ((x / 90) % 3) * 9, 26, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(view.x, GY - 2, view.w, 6);
  };

  Art.drawHill = (ctx, time) => {
    const v = G.HILL_VERTS;
    // Rock under the snow.
    ctx.fillStyle = "#6b7fa6";
    Art.poly(ctx, v.map(([x, y]) => [x, y + 16]));
    ctx.fill();
    const g = ctx.createLinearGradient(0, G.HILL_Y, 0, GY);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#d3e6f6");
    ctx.fillStyle = g;
    Art.poly(ctx, v);
    ctx.fill();
    // Snow lumps along the top.
    for (let x = -180; x < 360; x += 46) Art.ellipse(ctx, x, G.HILL_Y + 2, 30, 9, "#ffffff");
    // A crooked sign: the Grinch's opinion of Christmas.
    ctx.save();
    ctx.translate(64, G.HILL_Y);
    ctx.rotate(-0.08 + Math.sin(time * 1.3) * 0.01);
    ctx.fillStyle = "#7a4a22";
    ctx.fillRect(-4, -96, 8, 96);
    Art.roundRect(ctx, -62, -128, 124, 46, 6);
    ctx.fillStyle = "#a8692f";
    ctx.fill();
    ctx.strokeStyle = "#5a3416";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 17px Oxanium, 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NO MORE", 0, -114);
    ctx.fillText("CHRISTMAS!", 0, -96);
    Art.fluff(ctx, -30, -128, 34, 7, 7, 0.25, "#ffffff");
    ctx.restore();
    // A pile of spare snowballs.
    for (const [x, y, r] of [[300, 806, 14], [328, 806, 14], [314, 784, 14], [280, 810, 10]]) {
      const sg = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, r);
      sg.addColorStop(0, "#ffffff");
      sg.addColorStop(1, "#bcd6ee");
      Art.circle(ctx, x, y, r, sg);
    }
  };

  // ---------------------------------------------------------------- Fixed pieces

  function snowCap(ctx, x, y, w) {
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x - 4, y - 8, w + 8, 14, 7);
    ctx.fill();
    for (let i = 0; i < w / 22; i++) Art.ellipse(ctx, x + 10 + i * 22, y + 6, 7, 5, "#ffffff");
  }

  Art.drawStatic = (ctx, s, time) => {
    if (s.hidden) return;
    if (s.kind === "ramp") {
      ctx.fillStyle = "#e9f4fc";
      Art.poly(ctx, s.verts);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(s.verts[0][0], s.verts[0][1]);
      ctx.lineTo(s.verts[1][0], s.verts[1][1]);
      ctx.stroke();
      return;
    }
    if (s.kind === "wire") {
      // A candy-striped crane arm to hang things from.
      ctx.lineCap = "round";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y);
      ctx.lineTo(s.x2, s.y);
      ctx.stroke();
      ctx.strokeStyle = "#e0303a";
      ctx.setLineDash([10, 10]);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (s.kind === "pole") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(s.x - s.w / 2, s.y, s.w, s.h);
      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x - s.w / 2, s.y, s.w, s.h);
      ctx.clip();
      ctx.fillStyle = "#e0303a";
      for (let y = s.y - 20; y < s.y + s.h; y += 34) {
        ctx.beginPath();
        ctx.moveTo(s.x - s.w, y);
        ctx.lineTo(s.x + s.w, y - 16);
        ctx.lineTo(s.x + s.w, y);
        ctx.lineTo(s.x - s.w, y + 16);
        ctx.fill();
      }
      ctx.restore();
      Art.circle(ctx, s.x, s.y - 4, 13, "#ffd23f");
      Art.sparkle(ctx, s.x, s.y - 4, 10, "#ffffff");
      return;
    }
    const { x, y, w, h, style } = s;
    if (style === "stone" || style === "snow" || style === "snowhill") {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, style === "stone" ? "#8f9bb8" : "#eaf4fb");
      g.addColorStop(1, style === "stone" ? "#5f6a88" : "#c4d9ec");
      ctx.fillStyle = g;
      Art.roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
      if (style === "stone") {
        ctx.strokeStyle = "rgba(40,50,80,0.35)";
        ctx.lineWidth = 2;
        for (let i = 1; i < h / 26; i++) {
          ctx.beginPath();
          ctx.moveTo(x, y + i * 26);
          ctx.lineTo(x + w, y + i * 26);
          ctx.stroke();
        }
      }
      snowCap(ctx, x, y, w);
    } else if (style === "ice") {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "rgba(210, 245, 255, 0.95)");
      g.addColorStop(1, "rgba(110, 185, 230, 0.9)");
      ctx.fillStyle = g;
      Art.roundRect(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 5);
      ctx.lineTo(x + w - 6, y + 5);
      ctx.stroke();
      // Icicles.
      if (s.kind === "ledge") {
        ctx.fillStyle = "rgba(200, 240, 255, 0.9)";
        for (let i = 0; i < w / 26; i++) {
          const ix = x + 12 + i * 26;
          const len = 10 + ((i * 7) % 5) * 4;
          ctx.beginPath();
          ctx.moveTo(ix - 5, y + h);
          ctx.lineTo(ix + 5, y + h);
          ctx.lineTo(ix, y + h + len);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (style === "cloud") {
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      for (let i = 0; i <= w / 40; i++) Art.ellipse(ctx, x + 20 + i * 40, y + h / 2 + 4 + (i % 2) * 4, 34, h * 0.7);
      ctx.fill();
      ctx.fillStyle = "rgba(190, 215, 240, 0.8)";
      for (let i = 0; i <= w / 40; i++) Art.ellipse(ctx, x + 20 + i * 40, y + h * 0.95, 26, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, w, h * 0.45);
      // Little sparkles show it's magic.
      Art.sparkle(ctx, x + w * 0.2, y + h + 10 + Math.sin(time * 3 + x) * 4, 5, "#ffffff");
      Art.sparkle(ctx, x + w * 0.75, y + h + 14 + Math.sin(time * 2.4 + x) * 4, 4, "#ffffff");
    } else if (style === "brick") {
      ctx.fillStyle = "#a33b2b";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255, 220, 200, 0.45)";
      ctx.lineWidth = 2;
      for (let i = 0; i * 18 < h; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y + i * 18);
        ctx.lineTo(x + w, y + i * 18);
        ctx.stroke();
        for (let k = 0; k * 34 < w + 34; k++) {
          const bx = x + k * 34 + (i % 2) * 17;
          if (bx > x + w) continue;
          ctx.beginPath();
          ctx.moveTo(bx, y + i * 18);
          ctx.lineTo(bx, y + i * 18 + 18);
          ctx.stroke();
        }
      }
    } else if (style === "mantel") {
      ctx.fillStyle = "#6b3f1f";
      Art.roundRect(ctx, x, y, w, h, 4);
      ctx.fill();
      ctx.fillStyle = "#8a5530";
      ctx.fillRect(x + 4, y + 3, w - 8, 6);
      // Garland under the mantel.
      ctx.strokeStyle = "#2f9e4a";
      ctx.lineWidth = 10;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const sx = x + (i / 6) * w;
        ctx.moveTo(sx, y + h);
        ctx.quadraticCurveTo(sx + w / 12, y + h + 24, sx + w / 6, y + h);
      }
      ctx.stroke();
      for (let i = 0; i < 12; i++) Art.circle(ctx, x + 30 + i * (w - 60) / 11, y + h + 10 + (i % 2) * 6, 4, i % 2 ? "#ffd23f" : "#e0303a");
    } else if (style === "wood" || style === "track") {
      ctx.fillStyle = style === "track" ? "#5a3a22" : "#7a4a22";
      ctx.fillRect(x, y, w, h);
      if (style === "track") {
        ctx.fillStyle = "#9aa6bf";
        ctx.fillRect(x, y - 3, w, 5);
        ctx.fillStyle = "#3d2715";
        for (let i = 0; i < w / 30; i++) ctx.fillRect(x + i * 30 + 4, y + 4, 14, h - 6);
      } else {
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
      }
    }
  };

  // ---------------------------------------------------------------- Light strings

  Art.drawLights = (ctx, L, time) => {
    const pts = L.path(L.tangle ? 6 : 12);
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1f4a2a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    // Bulbs.
    const n = pts.length;
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i];
      const col = L.bulbs[(i + L.id) % L.bulbs.length];
      const on = 0.55 + 0.45 * Math.sin(time * 4 + i * 1.7 + L.phase);
      const glow = ctx.createRadialGradient(p.x, p.y + 6, 1, p.x, p.y + 6, 16);
      glow.addColorStop(0, col);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = on * 0.45;
      Art.circle(ctx, p.x, p.y + 6, 16, glow);
      ctx.globalAlpha = 1;
      Art.ellipse(ctx, p.x, p.y + 6, 4, 6.5, col);
      Art.circle(ctx, p.x - 1.2, p.y + 4, 1.4, "rgba(255,255,255,0.8)");
      ctx.fillStyle = "#335533";
      ctx.fillRect(p.x - 2.5, p.y - 1, 5, 3);
    }
  };
})(window.GS);
