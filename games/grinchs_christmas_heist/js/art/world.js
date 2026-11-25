/*
 * Drawing code for loot, power-ups and scenery. Loot and power-ups draw at the origin
 * (their spot on the ground). Scenery draws in world coordinates from its own fields.
 */
(function (G) {
  "use strict";

  const TAU = Math.PI * 2;
  const Art = G.Art;
  const LIGHTS = ["#ff4d4d", "#ffd23f", "#4cd964", "#5fd0ff", "#ff7ad9", "#ff9f1c"];

  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  Art.glow = glow;

  function box(ctx, w, h, body, ribbon, lid) {
    // A gift box seen slightly from above: top face plus front face.
    const top = h * 0.32;
    ctx.fillStyle = body;
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.fillStyle = lid || shade(body, 1.2);
    ctx.fillRect(-w / 2 - 1.5, -h - top, w + 3, top + 2);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(w / 6, -h, w / 3, h);
    ctx.fillStyle = ribbon;
    ctx.fillRect(-w * 0.09, -h - top, w * 0.18, h + top);
    ctx.fillRect(-w / 2 - 1.5, -h - top * 0.55, w + 3, top * 0.3);
    // Bow.
    const bs = Math.max(4, w * 0.22);
    ctx.beginPath();
    ctx.ellipse(-bs * 0.7, -h - top - bs * 0.35, bs * 0.75, bs * 0.45, -0.5, 0, TAU);
    ctx.ellipse(bs * 0.7, -h - top - bs * 0.35, bs * 0.75, bs * 0.45, 0.5, 0, TAU);
    ctx.fill();
    Art.circle(ctx, 0, -h - top - bs * 0.2, bs * 0.32, shade(ribbon, 0.8));
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
    const b = Math.min(255, Math.round((n & 255) * k));
    return `rgb(${r},${g},${b})`;
  }
  Art.shade = shade;

  const GIFT_COLORS = [
    ["#e0303a", "#ffd23f"],
    ["#2f6fe0", "#ffffff"],
    ["#27a35a", "#ff4d4d"],
    ["#9b4dff", "#ffe066"],
    ["#ff7ad9", "#ffffff"],
    ["#ff9f1c", "#2f6fe0"],
  ];

  // ---------------------------------------------------------------- Loot

  Art.item = (ctx, type, v, t, noShadow) => {
    const bob = Math.sin(t * 3 + v) * 2;
    if (!noShadow) Art.shadow(ctx, type === "giant" ? 26 : type === "tree" ? 18 : 12, undefined, 0.18);
    ctx.save();
    ctx.translate(0, -3 + bob);
    const c = GIFT_COLORS[v % GIFT_COLORS.length];
    switch (type) {
      case "small":
        box(ctx, 18, 14, c[0], c[1]);
        break;
      case "large":
        box(ctx, 28, 21, c[0], c[1]);
        break;
      case "giant":
        glow(ctx, 0, -26, 46, "rgba(255,230,120,0.9)", 0.35 + Math.sin(t * 4) * 0.1);
        box(ctx, 46, 34, c[0], c[1]);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(-20, -32, 5, 26);
        break;
      case "golden":
        glow(ctx, 0, -22, 44, "rgba(255,220,80,1)", 0.5 + Math.sin(t * 6) * 0.15);
        box(ctx, 32, 25, "#f2b632", "#ffffff", "#ffd75e");
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillRect(-13, -23, 4, 18);
        break;
      case "candy": {
        ctx.lineCap = "round";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(3, 0);
        ctx.lineTo(3, -18);
        ctx.arc(-2, -18, 5, 0, Math.PI, true);
        ctx.stroke();
        ctx.strokeStyle = "#e0303a";
        ctx.setLineDash([3.5, 3.5]);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case "stocking":
        ctx.fillStyle = "#d62f3a";
        ctx.beginPath();
        ctx.moveTo(-6, -22);
        ctx.lineTo(5, -22);
        ctx.lineTo(5, -8);
        ctx.quadraticCurveTo(6, 0, -3, 0);
        ctx.lineTo(-11, 0);
        ctx.quadraticCurveTo(-15, -4, -10, -8);
        ctx.lineTo(-6, -9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        Art.roundRect(ctx, -8, -27, 15, 7, 3);
        ctx.fill();
        ctx.fillStyle = "#4cd964";
        ctx.fillRect(-2, -33, 5, 7);
        ctx.fillStyle = "#ffd23f";
        Art.circle(ctx, -5, -30, 3);
        ctx.fill();
        break;
      case "wreath": {
        ctx.lineWidth = 7;
        ctx.strokeStyle = "#1f7a3a";
        ctx.beginPath();
        ctx.arc(0, -14, 10, 0, TAU);
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#35a855";
        ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#e0303a";
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + 0.4;
          Art.circle(ctx, Math.cos(a) * 10, -14 + Math.sin(a) * 10, 1.8);
          ctx.fill();
        }
        ctx.fillStyle = "#e0303a";
        ctx.beginPath();
        ctx.ellipse(-4, -3, 4, 2.6, -0.4, 0, TAU);
        ctx.ellipse(4, -3, 4, 2.6, 0.4, 0, TAU);
        ctx.fill();
        break;
      }
      case "ornament": {
        const oc = ["#e0303a", "#2f6fe0", "#9b4dff", "#27a35a", "#ff7ad9"][v % 5];
        Art.circle(ctx, 0, -10, 9, oc);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        Art.ellipse(ctx, -3, -13, 2.6, 3.6);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8, -9);
        ctx.quadraticCurveTo(0, -5, 8, -9);
        ctx.stroke();
        ctx.fillStyle = "#d9b44a";
        ctx.fillRect(-3, -21, 6, 4);
        ctx.strokeStyle = "#d9b44a";
        ctx.beginPath();
        ctx.arc(0, -23, 2.2, 0, TAU);
        ctx.stroke();
        break;
      }
      case "bell": {
        glow(ctx, 0, -12, 32, "rgba(255,220,80,1)", 0.45 + Math.sin(t * 5) * 0.15);
        ctx.fillStyle = "#f2b632";
        ctx.beginPath();
        ctx.moveTo(-11, -3);
        ctx.quadraticCurveTo(-9, -6, -8, -14);
        ctx.quadraticCurveTo(-7, -24, 0, -24);
        ctx.quadraticCurveTo(7, -24, 8, -14);
        ctx.quadraticCurveTo(9, -6, 11, -3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffe48a";
        Art.ellipse(ctx, -3, -16, 2.2, 5);
        ctx.fill();
        Art.ellipse(ctx, 0, -3, 11, 2.6, "#c98a12");
        Art.circle(ctx, 0, -1, 2.8, "#8a5a0a");
        ctx.fillStyle = "#e0303a";
        ctx.beginPath();
        ctx.ellipse(-4, -25, 4, 2.4, -0.4, 0, TAU);
        ctx.ellipse(4, -25, 4, 2.4, 0.4, 0, TAU);
        ctx.fill();
        break;
      }
      case "cookie": {
        ctx.fillStyle = "#b8743a";
        Art.circle(ctx, 0, -20, 5.5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4, -16);
        ctx.lineTo(-11, -12);
        ctx.lineTo(-10, -8);
        ctx.lineTo(-4, -10);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-2, 0);
        ctx.lineTo(0, -6);
        ctx.lineTo(2, 0);
        ctx.lineTo(7, 0);
        ctx.lineTo(4, -10);
        ctx.lineTo(10, -8);
        ctx.lineTo(11, -12);
        ctx.lineTo(4, -16);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        Art.circle(ctx, -2, -21, 1);
        ctx.fill();
        Art.circle(ctx, 2, -21, 1);
        ctx.fill();
        ctx.fillStyle = "#e0303a";
        Art.circle(ctx, 0, -12, 1.3);
        ctx.fill();
        ctx.fillStyle = "#4cd964";
        Art.circle(ctx, 0, -8, 1.3);
        ctx.fill();
        break;
      }
      case "tree": {
        ctx.fillStyle = "#b5552a";
        ctx.fillRect(-7, -9, 14, 9);
        const tiers = [
          [-14, 14, -8, -24],
          [-11, 11, -18, -33],
          [-8, 8, -27, -42],
        ];
        for (const [l, r, b, top] of tiers) {
          ctx.fillStyle = "#1f8a3e";
          ctx.beginPath();
          ctx.moveTo(l, b);
          ctx.lineTo(0, top);
          ctx.lineTo(r, b);
          ctx.closePath();
          ctx.fill();
        }
        for (let i = 0; i < 7; i++) {
          ctx.fillStyle = Math.sin(t * 5 + i * 1.7) > 0 ? LIGHTS[i % 6] : "#ffffff";
          Art.circle(ctx, Math.sin(i * 2.1) * (6 + (i % 3)), -12 - i * 4.2, 1.9);
          ctx.fill();
        }
        ctx.fillStyle = "#ffd23f";
        Art.star(ctx, 0, -44, 5, t);
        break;
      }
      default:
        box(ctx, 18, 14, c[0], c[1]);
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- Power-ups

  const POWER_COLORS = {
    slippers: "#c77dff",
    coat: "#4a5bd6",
    magnet: "#ff4d4d",
    maxdog: "#c98a4a",
    sugar: "#ff7ad9",
    golden: "#ffd23f",
  };
  Art.POWER_COLORS = POWER_COLORS;

  Art.powerIcon = (ctx, type, t = 0) => {
    switch (type) {
      case "slippers":
        ctx.fillStyle = "#9b4dff";
        ctx.beginPath();
        ctx.ellipse(0, 2, 12, 6, -0.1, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#e7c6ff";
        ctx.beginPath();
        ctx.ellipse(4, 0, 6, 3.5, -0.1, 0, TAU);
        ctx.fill();
        Art.circle(ctx, -9, -3, 4.5, "#ffffff");
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-16, -8);
        ctx.lineTo(-20, -11);
        ctx.moveTo(-16, -2);
        ctx.lineTo(-21, -2);
        ctx.stroke();
        break;
      case "coat":
        ctx.fillStyle = "#2b2f6a";
        ctx.beginPath();
        ctx.moveTo(-5, -12);
        ctx.lineTo(5, -12);
        ctx.lineTo(12, 11);
        ctx.quadraticCurveTo(0, 14, -12, 11);
        ctx.closePath();
        ctx.fill();
        Art.circle(ctx, 0, -12, 5.5, "#3b4290");
        ctx.fillStyle = "#cfe0ff";
        for (let i = 0; i < 3; i++) Art.star(ctx, Math.sin(t * 2 + i * 2) * 6, -2 + i * 5, 2.4, t + i);
        break;
      case "magnet":
        ctx.lineWidth = 7;
        ctx.strokeStyle = "#e0303a";
        ctx.beginPath();
        ctx.arc(0, -1, 8, Math.PI, 0, false);
        ctx.lineTo(8, 9);
        ctx.moveTo(-8, -1);
        ctx.lineTo(-8, 9);
        ctx.stroke();
        ctx.fillStyle = "#dfe6f0";
        ctx.fillRect(-11.5, 6, 7, 5);
        ctx.fillRect(4.5, 6, 7, 5);
        break;
      case "maxdog":
        // A bone.
        ctx.fillStyle = "#fff3d6";
        ctx.save();
        ctx.rotate(-0.5);
        ctx.fillRect(-9, -3, 18, 6);
        for (const sx of [-1, 1]) {
          Art.circle(ctx, sx * 10, -3.5, 4);
          ctx.fill();
          Art.circle(ctx, sx * 10, 3.5, 4);
          ctx.fill();
        }
        ctx.restore();
        break;
      case "sugar":
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 2);
        ctx.lineTo(0, 14);
        ctx.stroke();
        Art.circle(ctx, 0, -4, 10, "#ff7ad9");
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let a = 0; a < TAU * 2.2; a += 0.25) {
          const r = a * 1.35;
          const px = Math.cos(a + t * 3) * r;
          const py = -4 + Math.sin(a + t * 3) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      case "golden":
        ctx.save();
        ctx.translate(0, 9);
        box(ctx, 20, 15, "#f2b632", "#ffffff", "#ffd75e");
        ctx.restore();
        break;
    }
  };

  Art.powerup = (ctx, type, t, fade = 1) => {
    const bob = Math.sin(t * 3) * 3;
    Art.shadow(ctx, 14, 5, 0.18);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(0, -26 + bob);
    const col = POWER_COLORS[type] || "#ffffff";
    glow(ctx, 0, 0, 34, col, 0.45);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    Art.circle(ctx, 0, 0, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, t * 2, t * 2 + 1.2);
    ctx.stroke();
    Art.powerIcon(ctx, type, t);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  // ---------------------------------------------------------------- Scenery: houses

  function stringLights(ctx, x1, x2, y, t, sag = 4, spacing = 13, seed = 0) {
    ctx.strokeStyle = "#1d3b24";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const n = Math.max(1, Math.floor((x2 - x1) / spacing));
    for (let i = 0; i <= n; i++) {
      const px = x1 + (i / n) * (x2 - x1);
      const py = y + Math.sin((i / n) * Math.PI * n) * 0 + (i % 2 ? sag : 0);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    for (let i = 0; i <= n; i++) {
      const px = x1 + (i / n) * (x2 - x1);
      const py = y + (i % 2 ? sag : 0) + 2.5;
      const on = Math.sin(t * 3 + i * 1.3 + seed) > -0.5;
      ctx.fillStyle = on ? LIGHTS[(i + seed) % LIGHTS.length] : "#4a4a55";
      ctx.beginPath();
      ctx.ellipse(px, py, 2.2, 3, 0, 0, TAU);
      ctx.fill();
    }
  }
  Art.stringLights = stringLights;

  function window2(ctx, x, y, w, h, t, seed, frame = "#ffffff") {
    const flick = 0.9 + Math.sin(t * 2 + seed) * 0.05;
    ctx.fillStyle = frame;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, `rgba(255, 236, 150, ${flick})`);
    g.addColorStop(1, `rgba(255, 180, 80, ${flick})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = frame;
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    // Snow on sill.
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x - 4, y + h + 1, w + 8, 4, 2);
    ctx.fill();
  }

  Art.house = (ctx, h, t) => {
    const { x, y, w } = h;
    const d = h.h;
    const wallH = h.wallH;
    const wallTop = y + d - wallH;
    const roofTop = y - h.lift;
    const skew = h.skew || 0;

    // Ground shadow.
    ctx.fillStyle = "rgba(40, 70, 120, 0.16)";
    ctx.fillRect(x + 8, y + d - 2, w, 12);

    // Front wall with siding.
    ctx.fillStyle = h.wall;
    ctx.fillRect(x, wallTop, w, wallH);
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let yy = wallTop + 8; yy < y + d; yy += 9) ctx.fillRect(x, yy, w, 1.5);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(x + w - 8, wallTop, 8, wallH);

    // Door with wreath.
    const dw = 24;
    const dh = Math.min(38, wallH - 12);
    const dx = x + w / 2 - dw / 2 + (h.doorShift || 0);
    const dy = y + d - dh;
    ctx.fillStyle = h.door;
    Art.roundRect(ctx, dx, dy, dw, dh + 2, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(dx + 4, dy + 8, dw - 8, 3);
    Art.circle(ctx, dx + dw - 5, dy + dh * 0.6, 1.8, "#ffd23f");
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "#1f7a3a";
    ctx.beginPath();
    ctx.arc(dx + dw / 2, dy + 11, 5.5, 0, TAU);
    ctx.stroke();
    Art.circle(ctx, dx + dw / 2, dy + 16, 2, "#e0303a");
    // Step.
    ctx.fillStyle = "#e8eef8";
    ctx.fillRect(dx - 5, y + d - 2, dw + 10, 6);

    // Windows either side of the door.
    const wy = wallTop + 12;
    const ww = 20;
    const wh = Math.min(20, wallH - 30);
    const slots = Math.max(1, Math.floor((w - dw - 30) / 2 / 36));
    for (let i = 0; i < slots; i++) {
      const offs = 18 + i * 36;
      window2(ctx, dx - offs - ww + 4, wy, ww, wh, t, h.seed + i, h.trim);
      window2(ctx, dx + dw + offs - 4, wy, ww, wh, t, h.seed + i + 3, h.trim);
    }

    // Tower (some fancy houses).
    if (h.tower) {
      const tx = x + 10;
      const tw = 46;
      ctx.fillStyle = shade(h.wall, 0.92);
      ctx.fillRect(tx, roofTop - 30, tw, wallTop - roofTop + 32);
      window2(ctx, tx + 13, roofTop - 14, 20, 18, t, h.seed + 9, h.trim);
      ctx.fillStyle = h.roof;
      ctx.beginPath();
      ctx.moveTo(tx - 8, roofTop - 28);
      ctx.lineTo(tx + tw + 8, roofTop - 28);
      ctx.quadraticCurveTo(tx + tw * 0.6, roofTop - 60, tx + tw * 0.5 + 18, roofTop - 92);
      ctx.quadraticCurveTo(tx + tw * 0.5 + 30, roofTop - 96, tx + tw * 0.5 + 26, roofTop - 84);
      ctx.quadraticCurveTo(tx + tw * 0.4, roofTop - 56, tx - 8, roofTop - 28);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(tx - 10, roofTop - 26);
      ctx.quadraticCurveTo(tx + tw / 2, roofTop - 40, tx + tw + 10, roofTop - 26);
      ctx.quadraticCurveTo(tx + tw / 2, roofTop - 34, tx - 10, roofTop - 26);
      ctx.fill();
      Art.circle(ctx, tx + tw * 0.5 + 26, roofTop - 86, 4, "#ffd23f");
    }

    // Roof: front slope from the ridge down to the eave.
    const eave = wallTop + 6;
    ctx.fillStyle = h.roof;
    ctx.beginPath();
    ctx.moveTo(x - 12, eave);
    ctx.lineTo(x + w + 12, eave);
    ctx.lineTo(x + w - 6 + skew, roofTop);
    ctx.quadraticCurveTo(x + w / 2 + skew, roofTop - 10, x + 6 + skew, roofTop);
    ctx.closePath();
    ctx.fill();
    // Shingle rows.
    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1.5;
    const rows = Math.floor((eave - roofTop) / 11);
    for (let i = 1; i < rows; i++) {
      const yy = roofTop + i * 11;
      const k = (yy - roofTop) / (eave - roofTop);
      ctx.beginPath();
      ctx.moveTo(x + 6 + skew * (1 - k) - 18 * k, yy);
      ctx.lineTo(x + w - 6 + skew * (1 - k) + 18 * k, yy);
      ctx.stroke();
    }
    // Snow blanket on the upper roof, with drips.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    const snowBottom = roofTop + (eave - roofTop) * 0.55;
    ctx.moveTo(x + 4 + skew, roofTop - 2);
    ctx.quadraticCurveTo(x + w / 2 + skew, roofTop - 14, x + w - 4 + skew, roofTop - 2);
    const steps = 7;
    for (let i = steps; i >= 0; i--) {
      const px = x - 4 + (i / steps) * (w + 8);
      const drip = (i * 37 + h.seed * 13) % 9;
      ctx.lineTo(px, snowBottom + drip);
      ctx.lineTo(px - (w + 8) / steps / 2, snowBottom - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(170, 200, 240, 0.35)";
    ctx.fillRect(x + 6, snowBottom - 3, w - 12, 2);

    // Chimney with smoke.
    if (h.chimney) {
      const cx = x + w * 0.72 + skew * 0.5;
      const cy = roofTop + 4;
      ctx.fillStyle = "#a44a3a";
      ctx.fillRect(cx, cy - 26, 17, 30);
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      for (let yy = cy - 22; yy < cy + 2; yy += 6) ctx.fillRect(cx, yy, 17, 1.2);
      ctx.fillStyle = "#ffffff";
      Art.roundRect(ctx, cx - 3, cy - 30, 23, 7, 3.5);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.4 + i / 3) % 1;
        ctx.globalAlpha = 0.5 * (1 - k);
        Art.circle(ctx, cx + 8 + Math.sin(k * 6 + i) * 6 + k * 10, cy - 36 - k * 40, 5 + k * 8, "#eef3ff");
      }
      ctx.globalAlpha = 1;
    }

    // Eave trim, icicles and string lights.
    ctx.fillStyle = h.trim;
    ctx.fillRect(x - 12, eave - 3, w + 24, 5);
    ctx.fillStyle = "#dff4ff";
    for (let px = x - 8; px < x + w + 8; px += 11) {
      const len = 4 + ((px * 7 + h.seed) % 7);
      ctx.beginPath();
      ctx.moveTo(px, eave + 2);
      ctx.lineTo(px + 3, eave + 2);
      ctx.lineTo(px + 1.5, eave + 2 + len);
      ctx.fill();
    }
    stringLights(ctx, x - 10, x + w + 10, eave + 1, t, 4, 13, h.seed);
  };

  // ---------------------------------------------------------------- Trees and decorations

  Art.pine = (ctx, tr, t) => {
    const s = tr.size;
    const x = tr.x;
    const y = tr.y;
    ctx.fillStyle = "rgba(40, 70, 120, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 4, y, 30 * s, 10 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7a4a26";
    ctx.fillRect(x - 5 * s, y - 14 * s, 10 * s, 15 * s);
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const half = (38 - i * 8) * s;
      const base = y - 10 * s - i * 20 * s;
      const top = base - 38 * s;
      ctx.fillStyle = tr.dark || "#1d6b3a";
      ctx.beginPath();
      ctx.moveTo(x - half, base);
      ctx.quadraticCurveTo(x, base + 6 * s, x + half, base);
      ctx.lineTo(x, top);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = tr.light || "#2b8a4a";
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + half, base);
      ctx.quadraticCurveTo(x + half * 0.5, base + 4 * s, x + 2 * s, base + 3 * s);
      ctx.closePath();
      ctx.fill();
      // Snow on the tier edge.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x - half, base);
      for (let k = 0; k <= 6; k++) {
        const px = x - half + (k / 6) * half * 2;
        ctx.lineTo(px, base - 3 * s + (k % 2 ? 3 * s : 0));
      }
      ctx.lineTo(x + half * 0.8, base - 7 * s);
      ctx.lineTo(x - half * 0.8, base - 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + 7 * s, top + 10 * s);
      ctx.lineTo(x - 7 * s, top + 10 * s);
      ctx.closePath();
      ctx.fill();
    }
    if (tr.decorated) {
      const n = Math.round(14 * s);
      for (let i = 0; i < n; i++) {
        const k = ((i * 0.618 + tr.seed * 0.13) % 1) * 0.9;
        const lvl = k * tiers;
        const half = (38 - lvl * 8) * s * 0.75;
        const py = y - 16 * s - lvl * 20 * s - ((i * 7) % 10) * s;
        const px = x + Math.sin(i * 2.4 + tr.seed) * half;
        if (tr.lights) {
          const on = Math.sin(t * 4 + i * 1.7) > -0.3;
          ctx.fillStyle = on ? LIGHTS[i % LIGHTS.length] : "#555";
          Art.circle(ctx, px, py, 2.3 * s + 0.4);
          ctx.fill();
        } else {
          ctx.fillStyle = LIGHTS[(i + tr.seed) % LIGHTS.length];
          Art.circle(ctx, px, py, 3.2 * s);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          Art.circle(ctx, px - s, py - s, 1 * s);
          ctx.fill();
        }
      }
      const topY = y - 10 * s - (tiers - 1) * 20 * s - 38 * s;
      glow(ctx, x, topY, 22 * s, "rgba(255,230,100,1)", 0.5);
      ctx.fillStyle = "#ffd23f";
      Art.star(ctx, x, topY - 2 * s, 8 * s, Math.sin(t) * 0.2);
    }
  };

  Art.snowman = (ctx, o, t) => {
    const { x, y } = o;
    ctx.fillStyle = "rgba(40, 70, 120, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y, 24, 8, 0, 0, TAU);
    ctx.fill();
    const balls = [
      [0, -16, 18],
      [0, -42, 13],
      [0, -61, 10],
    ];
    for (const [bx, by, r] of balls) {
      Art.circle(ctx, x + bx, y + by, r, "#ffffff");
      ctx.fillStyle = "rgba(150, 180, 230, 0.35)";
      ctx.beginPath();
      ctx.arc(x + bx + 2, y + by + 2, r, 0.2, Math.PI * 0.9);
      ctx.fill();
    }
    // Arms.
    ctx.strokeStyle = "#6b4226";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 44);
    ctx.lineTo(x - 28, y - 56);
    ctx.moveTo(x - 22, y - 52);
    ctx.lineTo(x - 26, y - 60);
    ctx.moveTo(x + 11, y - 44);
    ctx.lineTo(x + 28, y - 54 + Math.sin(t * 2 + o.seed) * 2);
    ctx.stroke();
    // Face.
    ctx.fillStyle = "#222";
    Art.circle(ctx, x - 3.5, y - 63, 1.6);
    ctx.fill();
    Art.circle(ctx, x + 3.5, y - 63, 1.6);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      Art.circle(ctx, x - 5 + i * 2.5, y - 56 + Math.sin(i * 0.8) * 1.2, 0.9);
      ctx.fill();
    }
    ctx.fillStyle = "#ff8a1c";
    ctx.beginPath();
    ctx.moveTo(x, y - 61);
    ctx.lineTo(x + 11, y - 59);
    ctx.lineTo(x, y - 58);
    ctx.fill();
    for (let i = 0; i < 3; i++) Art.circle(ctx, x, y - 46 + i * 7, 1.8, "#222");
    // Scarf and hat.
    ctx.fillStyle = o.scarf || "#e0303a";
    Art.roundRect(ctx, x - 11, y - 54, 22, 5, 2.5);
    ctx.fill();
    ctx.fillRect(x + 4, y - 52, 5, 12);
    ctx.fillStyle = "#222";
    ctx.fillRect(x - 8, y - 84, 16, 14);
    ctx.fillRect(x - 12, y - 71, 24, 3);
    ctx.fillStyle = o.scarf || "#e0303a";
    ctx.fillRect(x - 8, y - 75, 16, 3);
  };

  Art.lamp = (ctx, o, t) => {
    const { x, y } = o;
    glow(ctx, x, y - 84, 70, "rgba(255, 220, 140, 1)", 0.28);
    ctx.fillStyle = "rgba(40, 70, 120, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 2, y, 9, 3, 0, 0, TAU);
    ctx.fill();
    // Candy-striped post.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 3, y - 78, 6, 78);
    ctx.fillStyle = "#e0303a";
    for (let yy = y - 76; yy < y; yy += 10) {
      ctx.beginPath();
      ctx.moveTo(x - 3, yy);
      ctx.lineTo(x + 3, yy - 4);
      ctx.lineTo(x + 3, yy + 1);
      ctx.lineTo(x - 3, yy + 5);
      ctx.fill();
    }
    ctx.fillStyle = "#2a2a3a";
    ctx.fillRect(x - 8, y - 82, 16, 4);
    ctx.fillStyle = "#fff2b8";
    Art.roundRect(ctx, x - 7, y - 96, 14, 15, 3);
    ctx.fill();
    ctx.fillStyle = "#2a2a3a";
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 96);
    ctx.lineTo(x, y - 104);
    ctx.lineTo(x + 10, y - 96);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x - 10, y - 101, 20, 4, 2);
    ctx.fill();
    // Wreath on the post.
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1f7a3a";
    ctx.beginPath();
    ctx.arc(x, y - 50, 6, 0, TAU);
    ctx.stroke();
    Art.circle(ctx, x, y - 44, 2, "#e0303a");
  };

  Art.fence = (ctx, o) => {
    const { x, y, w, h } = o;
    const vertical = h > w;
    ctx.fillStyle = "#f6efe2";
    if (!vertical) {
      ctx.fillRect(x, y - 14, w, 4);
      ctx.fillRect(x, y - 6, w, 4);
      for (let px = x; px <= x + w - 6; px += 12) {
        ctx.fillStyle = "#f6efe2";
        ctx.beginPath();
        ctx.moveTo(px, y + h);
        ctx.lineTo(px, y - 20);
        ctx.lineTo(px + 3, y - 24);
        ctx.lineTo(px + 6, y - 20);
        ctx.lineTo(px + 6, y + h);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(px - 1, y - 23, 8, 3);
      }
    } else {
      for (let py = y; py <= y + h; py += 12) {
        ctx.fillStyle = "#f6efe2";
        ctx.fillRect(x, py - 18, 6, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x - 1, py - 21, 8, 3);
      }
      ctx.fillStyle = "#d9cfbd";
      ctx.fillRect(x + 1, y - 12, 4, h + 10);
    }
  };

  Art.hedge = (ctx, o) => {
    const { x, y, w, h } = o;
    const lift = 22;
    ctx.fillStyle = "rgba(40,70,120,0.16)";
    ctx.fillRect(x + 5, y + h - 2, w, 8);
    ctx.fillStyle = "#1f6b3a";
    Art.roundRect(ctx, x, y - lift, w, h + lift, 8);
    ctx.fill();
    ctx.fillStyle = "#2b8a4a";
    Art.roundRect(ctx, x, y - lift, w, h, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x + 2, y - lift - 2, w - 4, Math.min(h * 0.6, 14), 7);
    ctx.fill();
    ctx.fillStyle = "#e0303a";
    for (let i = 0; i < w / 30; i++) {
      Art.circle(ctx, x + 10 + i * 30, y + h - 4 + (i % 2) * 2, 2);
      ctx.fill();
    }
  };

  Art.bench = (ctx, o) => {
    const { x, y, w } = o;
    ctx.fillStyle = "#7a4a26";
    ctx.fillRect(x, y - 16, w, 6);
    ctx.fillRect(x, y - 30, w, 5);
    ctx.fillStyle = "#3a3a44";
    ctx.fillRect(x + 4, y - 16, 4, 16);
    ctx.fillRect(x + w - 8, y - 16, 4, 16);
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x, y - 33, w, 4, 2);
    ctx.fill();
  };

  Art.fountain = (ctx, o, t) => {
    const { x, y, r } = o;
    ctx.fillStyle = "#c9d6e8";
    ctx.beginPath();
    ctx.ellipse(x, y - 8, r + 8, (r + 8) * 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#a9e6ff";
    ctx.beginPath();
    ctx.ellipse(x, y - 12, r, r * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - 15, r * 0.4, r * 0.12, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#dfe8f4";
    ctx.fillRect(x - 6, y - 50, 12, 40);
    Art.ellipse(ctx, x, y - 50, 18, 7, "#c9d6e8");
    ctx.fillStyle = "#cfefff";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(x - 15 + i * 6, y - 48);
      ctx.lineTo(x - 13 + i * 6, y - 48);
      ctx.lineTo(x - 14 + i * 6, y - 36 - (i % 3) * 3);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd23f";
    Art.star(ctx, x, y - 62, 8, t * 0.5);
  };

  Art.stall = (ctx, o, t) => {
    const { x, y, w, h } = o;
    const wallTop = y + h - 34;
    ctx.fillStyle = "rgba(40,70,120,0.16)";
    ctx.fillRect(x + 6, y + h - 2, w, 10);
    // Back wall.
    ctx.fillStyle = "#8a5a32";
    ctx.fillRect(x + 4, y - 40, w - 8, h + 6);
    // Counter.
    ctx.fillStyle = "#b5773f";
    ctx.fillRect(x, wallTop, w, 34);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    for (let px = x + 10; px < x + w; px += 16) ctx.fillRect(px, wallTop, 2, 34);
    ctx.fillStyle = "#d9a066";
    ctx.fillRect(x - 3, wallTop - 4, w + 6, 6);
    // Goods on the counter.
    const goods = o.goods || 0;
    for (let i = 0; i < Math.floor(w / 26); i++) {
      const gx = x + 14 + i * 26;
      const c = GIFT_COLORS[(i + goods) % GIFT_COLORS.length];
      if ((i + goods) % 3 === 0) {
        ctx.fillStyle = c[0];
        ctx.fillRect(gx - 7, wallTop - 14, 14, 10);
        ctx.fillStyle = c[1];
        ctx.fillRect(gx - 1.5, wallTop - 14, 3, 10);
      } else if ((i + goods) % 3 === 1) {
        Art.circle(ctx, gx, wallTop - 9, 5.5, c[0]);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        Art.circle(ctx, gx - 2, wallTop - 11, 1.6);
        ctx.fill();
      } else {
        ctx.fillStyle = "#b8743a";
        Art.circle(ctx, gx, wallTop - 9, 5);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(gx - 3, wallTop - 10, 6, 1.5);
      }
    }
    // Striped awning.
    const ay = y - 46;
    const stripes = Math.ceil(w / 18);
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : o.color || "#e0303a";
      ctx.beginPath();
      const sx = x - 8 + i * ((w + 16) / stripes);
      const sw = (w + 16) / stripes;
      ctx.moveTo(sx, ay);
      ctx.lineTo(sx + sw, ay);
      ctx.lineTo(sx + sw, ay + 26);
      ctx.quadraticCurveTo(sx + sw / 2, ay + 34, sx, ay + 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x - 10, ay - 6, w + 20, 9, 4);
    ctx.fill();
    stringLights(ctx, x - 6, x + w + 6, ay + 30, t, 3, 14, o.goods || 0);
  };

  Art.cart = (ctx, o, t) => {
    const { x, y, w, h } = o;
    ctx.fillStyle = "rgba(40,70,120,0.18)";
    ctx.fillRect(x + 4, y + h - 2, w, 8);
    ctx.fillStyle = "#c0392b";
    Art.roundRect(ctx, x, y - 10, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "#e85a4a";
    ctx.fillRect(x + 4, y - 10, w - 8, 6);
    // Presents piled in the cart.
    for (let i = 0; i < 4; i++) {
      const c = GIFT_COLORS[(i + (o.seed || 0)) % GIFT_COLORS.length];
      ctx.fillStyle = c[0];
      ctx.fillRect(x + 6 + i * ((w - 20) / 3), y - 26 + (i % 2) * 4, 14, 14);
      ctx.fillStyle = c[1];
      ctx.fillRect(x + 12 + i * ((w - 20) / 3), y - 26 + (i % 2) * 4, 3, 14);
    }
    const spin = t * 6;
    for (const wx of [x + 12, x + w - 12]) {
      Art.circle(ctx, wx, y + h - 6, 7, "#3a2a1a");
      ctx.strokeStyle = "#d9a066";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(spin) * 6, y + h - 6 + Math.sin(spin) * 6);
      ctx.lineTo(wx - Math.cos(spin) * 6, y + h - 6 - Math.sin(spin) * 6);
      ctx.stroke();
    }
  };

  // ---------------------------------------------------------------- Factory

  Art.wall = (ctx, o) => {
    const { x, y, w, h } = o;
    const lift = 40;
    ctx.fillStyle = "#6c5f7a";
    ctx.fillRect(x, y - lift, w, h + lift);
    ctx.fillStyle = "#8a7c99";
    ctx.fillRect(x, y - lift, w, Math.max(8, h));
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let yy = y - lift + 10; yy < y + h; yy += 10) {
      for (let xx = x + ((yy / 10) % 2) * 10; xx < x + w; xx += 20) ctx.fillRect(xx, yy, 1.5, 10);
      ctx.fillRect(x, yy, w, 1.2);
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y - lift - 3, w, 4);
  };

  Art.giftStack = (ctx, o) => {
    const { x, y, w, h } = o;
    ctx.fillStyle = "rgba(40,70,120,0.18)";
    ctx.fillRect(x + 4, y + h - 2, w, 8);
    const cols = Math.max(1, Math.round(w / 34));
    const bw = w / cols;
    let k = o.seed || 0;
    for (let row = 0; row < 3; row++) {
      for (let c = 0; c < cols - (row === 2 ? 1 : 0); c++) {
        const gc = GIFT_COLORS[k++ % GIFT_COLORS.length];
        const bx = x + c * bw + (row === 2 ? bw / 2 : 0);
        const by = y + h - 26 - row * 24;
        ctx.fillStyle = gc[0];
        ctx.fillRect(bx + 1, by, bw - 2, 24);
        ctx.fillStyle = shade(gc[0], 1.2);
        ctx.fillRect(bx + 1, by, bw - 2, 5);
        ctx.fillStyle = gc[1];
        ctx.fillRect(bx + bw / 2 - 2, by, 4, 24);
      }
    }
  };

  Art.machine = (ctx, o, t) => {
    const { x, y, w, h } = o;
    // A present-wrapping stamper: a heavy press slams down onto the floor in front.
    ctx.fillStyle = "rgba(40,70,120,0.2)";
    ctx.fillRect(x + 6, y + h - 2, w, 10);
    ctx.fillStyle = "#5a6a8a";
    ctx.fillRect(x, y - 50, w, h + 50);
    ctx.fillStyle = "#7a8aaa";
    ctx.fillRect(x, y - 50, w, 14);
    ctx.fillStyle = "#3a4560";
    ctx.fillRect(x + 8, y - 30, w - 16, 26);
    // Gauges and blinking lights.
    for (let i = 0; i < 3; i++) {
      const on = Math.sin(t * 5 + i * 2) > 0;
      Art.circle(ctx, x + 14 + i * 14, y - 43, 3.5, on ? LIGHTS[i] : "#333");
    }
    Art.circle(ctx, x + w - 18, y - 18, 8, "#e8eef8");
    ctx.strokeStyle = "#e0303a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - 18, y - 18);
    ctx.lineTo(x + w - 18 + Math.cos(t * 3) * 6, y - 18 + Math.sin(t * 3) * 6);
    ctx.stroke();
    ctx.fillStyle = "#ffd23f";
    ctx.font = "800 11px Oxanium, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("WRAP-O-MATIC", x + w / 2, y - 8);
  };

  // The press head, drawn over the hazard zone. `drop` is 0 (up) to 1 (slammed down).
  Art.press = (ctx, z, drop, warn) => {
    const { x, y, w, h } = z;
    // Hazard stripes on the floor.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = warn ? "rgba(255, 210, 63, 0.95)" : "rgba(255, 210, 63, 0.55)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(30,30,40,0.8)";
    for (let i = -h; i < w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + 8, y + h);
      ctx.lineTo(x + i + 8 + h, y);
      ctx.lineTo(x + i + h, y);
      ctx.fill();
    }
    ctx.restore();
    // Press head and piston.
    const headY = y - 60 + drop * 58;
    ctx.fillStyle = "#9aa6bf";
    ctx.fillRect(x + w / 2 - 6, y - 70, 12, headY - (y - 70) + 4);
    ctx.fillStyle = "#c0392b";
    Art.roundRect(ctx, x + 4, headY, w - 8, h - 6, 5);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 8, headY + 4, w - 16, 4);
  };

  // ---------------------------------------------------------------- Mansion and town square

  Art.mansion = (ctx, m, t) => {
    const { x, y, w } = m;
    const d = m.h;
    const wallH = 120;
    const wallTop = y + d - wallH;
    const roofTop = y - 60;
    ctx.fillStyle = "rgba(40,70,120,0.18)";
    ctx.fillRect(x + 10, y + d - 2, w, 16);
    // Facade.
    ctx.fillStyle = "#f3e6d4";
    ctx.fillRect(x, wallTop, w, wallH);
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    for (let yy = wallTop + 12; yy < y + d; yy += 12) ctx.fillRect(x, yy, w, 1.5);
    // Windows in two rows.
    const cols = Math.floor(w / 56);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = x + 22 + c * ((w - 44) / (cols - 1 || 1)) - 11;
        if (Math.abs(wx + 11 - (x + w / 2)) < 50) continue;
        window2(ctx, wx, wallTop + 14 + r * 52, 22, 30, t, c + r * 7, "#ffffff");
      }
    }
    // Columns and grand door.
    for (let i = 0; i < 4; i++) {
      const cx = x + w / 2 - 66 + i * 44;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx - 6, wallTop + 6, 12, wallH - 6);
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.fillRect(cx + 2, wallTop + 6, 3, wallH - 6);
    }
    ctx.fillStyle = "#7a2a3a";
    Art.roundRect(ctx, x + w / 2 - 22, y + d - 56, 44, 58, 20);
    ctx.fill();
    ctx.fillStyle = "#ffd23f";
    Art.circle(ctx, x + w / 2 - 5, y + d - 26, 2.5);
    ctx.fill();
    Art.circle(ctx, x + w / 2 + 5, y + d - 26, 2.5);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#1f7a3a";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + d - 70, 11, 0, TAU);
    ctx.stroke();
    // Pediment.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 90, wallTop + 8);
    ctx.lineTo(x + w / 2, wallTop - 34);
    ctx.lineTo(x + w / 2 + 90, wallTop + 8);
    ctx.closePath();
    ctx.fill();
    // Roof.
    const eave = wallTop + 4;
    ctx.fillStyle = "#4a3a6a";
    ctx.beginPath();
    ctx.moveTo(x - 14, eave);
    ctx.lineTo(x + w / 2 - 92, eave);
    ctx.lineTo(x + w / 2, wallTop - 36);
    ctx.lineTo(x + w / 2 + 92, eave);
    ctx.lineTo(x + w + 14, eave);
    ctx.lineTo(x + w - 10, roofTop);
    ctx.lineTo(x + 10, roofTop);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x + 8, roofTop - 2);
    ctx.lineTo(x + w - 8, roofTop - 2);
    for (let i = 10; i >= 0; i--) {
      const px = x + (i / 10) * w;
      ctx.lineTo(px, roofTop + 30 + ((i * 7) % 8));
    }
    ctx.closePath();
    ctx.fill();
    // Turrets.
    for (const tx of [x - 10, x + w - 46]) {
      ctx.fillStyle = "#efe0cc";
      ctx.fillRect(tx, roofTop - 40, 56, wallTop - roofTop + 44);
      window2(ctx, tx + 17, roofTop - 24, 22, 26, t, tx, "#ffffff");
      ctx.fillStyle = "#4a3a6a";
      ctx.beginPath();
      ctx.moveTo(tx - 8, roofTop - 38);
      ctx.lineTo(tx + 28, roofTop - 110);
      ctx.lineTo(tx + 64, roofTop - 38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(tx - 8, roofTop - 38);
      ctx.lineTo(tx + 10, roofTop - 74);
      ctx.lineTo(tx + 46, roofTop - 74);
      ctx.lineTo(tx + 64, roofTop - 38);
      ctx.closePath();
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffd23f";
      Art.star(ctx, tx + 28, roofTop - 116, 8, t * 0.6);
    }
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(x - 14, eave - 3, w + 28, 4);
    stringLights(ctx, x - 12, x + w + 12, eave + 1, t, 5, 16, 3);
  };

  Art.bigTree = (ctx, o, t) => {
    Art.pine(ctx, { x: o.x, y: o.y, size: o.size, decorated: true, lights: true, seed: 7, dark: "#18603a", light: "#22804a" }, t);
    // Extra garland swoops.
    const s = o.size;
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const by = o.y - 20 * s - i * 22 * s;
      const half = (32 - i * 8) * s;
      ctx.beginPath();
      ctx.moveTo(o.x - half, by - 8 * s);
      ctx.quadraticCurveTo(o.x, by + 4 * s, o.x + half, by - 12 * s);
      ctx.stroke();
    }
    // Presents piled around the base.
    for (let i = 0; i < 6; i++) {
      const c = GIFT_COLORS[i % GIFT_COLORS.length];
      const a = -0.3 + (i / 5) * (Math.PI + 0.6);
      const px = o.x + Math.cos(a) * 34 * s * 0.9;
      const py = o.y + Math.sin(a) * 6 * s + 4;
      ctx.fillStyle = c[0];
      ctx.fillRect(px - 9, py - 16, 18, 14);
      ctx.fillStyle = c[1];
      ctx.fillRect(px - 1.5, py - 16, 3, 14);
    }
  };

  Art.statue = (ctx, o, t) => {
    const { x, y } = o;
    ctx.fillStyle = "rgba(40,70,120,0.18)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y, 26, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#b9c4d6";
    ctx.fillRect(x - 22, y - 26, 44, 26);
    ctx.fillStyle = "#d6deea";
    ctx.fillRect(x - 25, y - 30, 50, 6);
    ctx.fillStyle = "#ffffff";
    Art.roundRect(ctx, x - 25, y - 33, 50, 6, 3);
    ctx.fill();
    glow(ctx, x, y - 60, 40, "rgba(255,220,90,1)", 0.35);
    ctx.fillStyle = "#f2b632";
    Art.star(ctx, x, y - 58, 22, Math.sin(t) * 0.1);
  };

  // ---------------------------------------------------------------- Parade floats

  Art.float = (ctx, f, t) => {
    const { x, y, w, h } = f;
    ctx.fillStyle = "rgba(40,70,120,0.2)";
    ctx.fillRect(x + 8, y + h - 2, w, 12);
    // Platform skirt.
    ctx.fillStyle = f.color;
    ctx.fillRect(x, y - 16, w, h + 16);
    ctx.fillStyle = shade(f.color, 0.8);
    ctx.fillRect(x, y + h - 24, w, 24);
    ctx.fillStyle = "#ffffff";
    for (let px = x; px < x + w; px += 16) {
      ctx.beginPath();
      ctx.arc(px + 8, y + h - 24, 8, 0, Math.PI);
      ctx.fill();
    }
    stringLights(ctx, x + 4, x + w - 4, y + h - 30, t, 4, 14, 2);
    const cx = x + w / 2;
    const cy = y + h * 0.4;
    if (f.kind === "present") {
      ctx.save();
      ctx.translate(cx, cy + 10);
      ctx.scale(2.6, 2.6);
      box(ctx, 34, 26, "#2f6fe0", "#ffd23f");
      ctx.restore();
    } else if (f.kind === "candy") {
      ctx.lineCap = "round";
      for (const sx of [-1, 1]) {
        ctx.lineWidth = 12;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(cx + sx * 34, cy + 20);
        ctx.lineTo(cx + sx * 34, cy - 60);
        ctx.arc(cx + sx * 22, cy - 60, 12, 0, Math.PI, true);
        ctx.stroke();
        ctx.strokeStyle = "#e0303a";
        ctx.setLineDash([9, 9]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (f.kind === "snowman") {
      Art.snowman(ctx, { x: cx, y: cy + 26, seed: 1, scarf: "#2f6fe0" }, t);
      ctx.save();
      ctx.translate(cx, cy + 26);
      ctx.restore();
    } else {
      Art.pine(ctx, { x: cx, y: cy + 30, size: 0.95, decorated: true, lights: true, seed: 3 }, t);
    }
    // Wheels.
    for (const wx of [x + 18, x + w - 18]) Art.circle(ctx, wx, y + h + 2, 8, "#2a2a3a");
  };

  // ---------------------------------------------------------------- Getaways

  Art.getaway = (ctx, g, t, active) => {
    const { x, y } = g;
    // Pulsing target ring on the ground.
    if (active) {
      const p = (t * 0.8) % 1;
      ctx.strokeStyle = `rgba(92, 255, 120, ${0.8 * (1 - p)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(x, y, 50 + p * 30, (50 + p * 30) * 0.45, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(92, 255, 120, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x, y, 62, 28, 0, 0, TAU);
    ctx.fill();

    if (g.kind === "sled") {
      ctx.fillStyle = "rgba(40,70,120,0.2)";
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 52, 12, 0, 0, TAU);
      ctx.fill();
      // Runners.
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - 44, y + 2);
      ctx.lineTo(x + 36, y + 2);
      ctx.quadraticCurveTo(x + 54, y + 2, x + 50, y - 16);
      ctx.quadraticCurveTo(x + 46, y - 24, x + 40, y - 16);
      ctx.stroke();
      // Body.
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.moveTo(x - 46, y - 8);
      ctx.lineTo(x + 30, y - 8);
      ctx.quadraticCurveTo(x + 42, y - 10, x + 40, y - 30);
      ctx.lineTo(x + 30, y - 30);
      ctx.lineTo(x + 26, y - 20);
      ctx.lineTo(x - 30, y - 20);
      ctx.quadraticCurveTo(x - 40, y - 46, x - 52, y - 40);
      ctx.quadraticCurveTo(x - 56, y - 20, x - 46, y - 8);
      ctx.fill();
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(x - 40, y - 14, 66, 3);
      // A big empty sack waiting for the loot.
      Art.fur(ctx, x - 10, y - 32, 18, 13, 9, 1.5, "#b5452f");
      Art.circle(ctx, x - 10, y - 46, 3, "#e8b04a");
      // Lantern.
      ctx.strokeStyle = "#3a3a44";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 44, y - 22);
      ctx.lineTo(x + 44, y - 44);
      ctx.stroke();
      glow(ctx, x + 44, y - 48, 26, "rgba(255,220,120,1)", 0.5 + Math.sin(t * 6) * 0.1);
      ctx.fillStyle = "#ffe08a";
      ctx.fillRect(x + 39, y - 54, 10, 10);
    } else if (g.kind === "tunnel") {
      // A snowbank with a hidden hole and a crooked sign.
      ctx.fillStyle = "#e6eefa";
      ctx.beginPath();
      ctx.ellipse(x, y - 6, 58, 30, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(x - 8, y - 14, 48, 22, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#1a1530";
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 26, 22, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = "#8a5a32";
      ctx.fillRect(x - 30, y - 30, 6, 30);
      ctx.fillRect(x + 24, y - 30, 6, 30);
      ctx.fillRect(x - 32, y - 32, 64, 6);
      ctx.save();
      ctx.translate(x + 44, y - 30);
      ctx.rotate(0.15);
      ctx.fillStyle = "#7a4a26";
      ctx.fillRect(-2, 0, 4, 28);
      ctx.fillStyle = "#c98a4a";
      ctx.fillRect(-18, -12, 36, 14);
      ctx.fillStyle = "#3a2010";
      ctx.font = "800 8px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("NOT A", 0, -6);
      ctx.fillText("TUNNEL", 0, 1);
      ctx.restore();
    } else if (g.kind === "mountain") {
      ctx.fillStyle = "#6a6a8a";
      ctx.beginPath();
      ctx.moveTo(x - 80, y + 4);
      ctx.lineTo(x - 40, y - 80);
      ctx.lineTo(x - 10, y - 60);
      ctx.lineTo(x + 20, y - 110);
      ctx.lineTo(x + 80, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x - 40, y - 80);
      ctx.lineTo(x - 28, y - 56);
      ctx.lineTo(x - 18, y - 64);
      ctx.lineTo(x - 10, y - 60);
      ctx.lineTo(x + 6, y - 82);
      ctx.lineTo(x + 20, y - 110);
      ctx.lineTo(x + 36, y - 74);
      ctx.lineTo(x + 24, y - 80);
      ctx.lineTo(x + 12, y - 68);
      ctx.lineTo(x - 50, y - 62);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#1a1530";
      ctx.beginPath();
      ctx.moveTo(x - 26, y + 2);
      ctx.lineTo(x - 26, y - 22);
      ctx.quadraticCurveTo(x, y - 50, x + 26, y - 22);
      ctx.lineTo(x + 26, y + 2);
      ctx.closePath();
      ctx.fill();
      glow(ctx, x, y - 16, 30, "rgba(120,255,140,1)", 0.25 + Math.sin(t * 3) * 0.1);
    } else {
      // A giant gift box with the lid propped open.
      ctx.save();
      ctx.translate(x, y + 2);
      box(ctx, 74, 56, "#27a35a", "#e0303a");
      ctx.restore();
      ctx.fillStyle = "#1a1530";
      ctx.fillRect(x - 16, y - 40, 32, 42);
      ctx.fillStyle = "#3fbf72";
      ctx.save();
      ctx.translate(x - 16, y - 40);
      ctx.rotate(-0.6 + Math.sin(t * 3) * 0.05);
      ctx.fillRect(0, -2, 32, 4);
      ctx.restore();
    }
  };

  Art.snowball = (ctx, b) => {
    const { x, y, r, rot } = b;
    ctx.fillStyle = "rgba(40,70,120,0.25)";
    ctx.beginPath();
    ctx.ellipse(x + 6, y + 2, r * 1.05, r * 0.35, 0, 0, TAU);
    ctx.fill();
    const cy = y - r * 0.9;
    Art.circle(ctx, x, cy, r, "#ffffff");
    ctx.fillStyle = "rgba(150, 180, 230, 0.4)";
    ctx.beginPath();
    ctx.arc(x + r * 0.15, cy + r * 0.15, r, 0.3, Math.PI * 1.1);
    ctx.fill();
    ctx.fillStyle = "rgba(170, 195, 235, 0.7)";
    for (let i = 0; i < 6; i++) {
      const a = rot + i * 1.05;
      const px = x + Math.cos(a) * r * 0.6;
      const py = cy + Math.sin(a) * r * 0.6;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 0.12, r * 0.08, a, 0, TAU);
      ctx.fill();
    }
    // Stuff caught in the snowball.
    ctx.save();
    ctx.translate(x + Math.cos(rot) * r * 0.5, cy + Math.sin(rot) * r * 0.5);
    ctx.rotate(rot);
    ctx.fillStyle = "#6b4226";
    ctx.fillRect(-12, -1.5, 24, 3);
    ctx.restore();
  };

  Art.log = (ctx, o, t) => {
    const { x, y, w, h } = o;
    const k = o.fall; // 0..1 falling progress
    if (k < 1) {
      // Still toppling: a tree leaning over.
      ctx.save();
      ctx.translate(o.px, o.py);
      ctx.rotate((o.dirSign || 1) * k * k * (Math.PI / 2));
      Art.pine(ctx, { x: 0, y: 0, size: 1, decorated: true, seed: 2 }, t);
      ctx.restore();
      return;
    }
    ctx.fillStyle = "rgba(40,70,120,0.2)";
    ctx.fillRect(x + 4, y + h - 4, w, 8);
    const vertical = h > w;
    ctx.fillStyle = "#1d6b3a";
    if (vertical) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + 30 + i * (h - 40) / 4);
        ctx.lineTo(x - 18 + i * 3, y + 60 + i * (h - 40) / 4);
        ctx.lineTo(x + w + 18 - i * 3, y + 60 + i * (h - 40) / 4);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const px = x + 30 + i * (w - 40) / 4;
        ctx.moveTo(px, y + h / 2);
        ctx.lineTo(px + 36, y - 14 + i * 2);
        ctx.lineTo(px + 36, y + h + 10 - i * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#7a4a26";
    if (vertical) ctx.fillRect(x + w / 2 - 6, y, 12, h);
    else ctx.fillRect(x, y + h / 2 - 6, w, 12);
    ctx.fillStyle = "#ffffff";
    if (vertical) ctx.fillRect(x + w / 2 - 6, y, 12, 4);
    else ctx.fillRect(x, y + h / 2 - 8, w, 4);
  };
})(window.GH);
