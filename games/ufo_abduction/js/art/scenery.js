/*
 * The five environments: sky, parallax layers, ground and props. Props are drawn at world
 * scale, and some have a "perch" where a stranded alien can hide (a barn roof, a water tower).
 *
 * Layers scroll at different speeds: far 0.2, mid 0.5, world 1.0.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const OUT = D.OUT;
  const FAR = 0.2;
  const MID = 0.5;

  // ---------------------------------------------------------------- Props

  const PROPS = {
    // ---- Farm
    barn: {
      w: 210,
      perch: [0, -206],
      draw(ctx, x, b) {
        D.rect(ctx, x - 92, b - 150, 184, 150, "#d7443e", 3);
        D.poly(ctx, [x - 104, b - 146, x, b - 206, x + 104, b - 146], "#9b2d2d", 3);
        D.poly(ctx, [x - 80, b - 150, x, b - 196, x + 80, b - 150], "#b8363a", 0);
        D.rect(ctx, x - 40, b - 86, 80, 86, "#f4efe6", 3);
        D.rect(ctx, x - 34, b - 80, 68, 80, "#c13a35", 2.5);
        D.line(ctx, x - 34, b - 80, x + 34, b, "#f4efe6", 5);
        D.line(ctx, x + 34, b - 80, x - 34, b, "#f4efe6", 5);
        D.rect(ctx, x - 18, b - 140, 36, 30, "#f4efe6", 3);
        D.rect(ctx, x - 13, b - 135, 26, 22, "#4a2a22", 0);
        D.circ(ctx, x, b - 125, 6, "#f2d06b", 0);
      },
    },
    windmill: {
      w: 190,
      perch: [0, -118],
      draw(ctx, x, b, t) {
        D.poly(ctx, [x - 34, b, x + 34, b, x + 16, b - 196, x - 16, b - 196], "#f1ece0", 3);
        for (let i = 1; i < 6; i++) D.line(ctx, x - 34 + i * 3, b - i * 33, x + 34 - i * 3, b - i * 33, "#cfc6b0", 2);
        D.rect(ctx, x - 28, b - 122, 56, 8, "#8a5a2b", 2.5, 2);
        D.rect(ctx, x - 10, b - 40, 20, 40, "#8a5a2b", 2.5, 4);
        D.poly(ctx, [x - 22, b - 196, x + 22, b - 196, x, b - 224], "#d7443e", 3);
        ctx.save();
        ctx.translate(x, b - 200);
        ctx.rotate(t * 1.4);
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          D.rect(ctx, 6, -9, 84, 18, "#fff8e6", 2.5, 3);
          D.line(ctx, 10, 0, 88, 0, "#cfc6b0", 2);
        }
        ctx.restore();
        D.circ(ctx, x, b - 200, 8, "#8a5a2b", 3);
      },
    },
    silo: {
      w: 90,
      perch: [0, -222],
      draw(ctx, x, b) {
        D.rect(ctx, x - 34, b - 196, 68, 196, "#8fb0c9", 3);
        for (let i = 1; i < 6; i++) D.line(ctx, x - 33, b - i * 34, x + 33, b - i * 34, "#6d8ea8", 3);
        ctx.beginPath();
        ctx.arc(x, b - 196, 34, Math.PI, U.TAU);
        ctx.closePath();
        ctx.fillStyle = "#c9d8e4";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
      },
    },
    farmhouse: {
      w: 200,
      perch: [40, -172],
      draw(ctx, x, b, t) {
        D.rect(ctx, x + 28, b - 176, 22, 40, "#a0612f", 3);
        smokePuffs(ctx, x + 39, b - 182, t);
        D.rect(ctx, x - 86, b - 110, 172, 110, "#f6d66b", 3);
        D.poly(ctx, [x - 100, b - 106, x - 60, b - 160, x + 60, b - 160, x + 100, b - 106], "#7a4a22", 3);
        D.rect(ctx, x - 14, b - 64, 28, 64, "#8a5a2b", 2.5, 3);
        for (const wx of [-58, 42]) {
          D.rect(ctx, x + wx, b - 82, 30, 28, "#bfefff", 2.5);
          D.line(ctx, x + wx + 15, b - 82, x + wx + 15, b - 54, OUT, 2);
        }
        D.rect(ctx, x - 92, b - 18, 184, 8, "#fff", 2);
      },
    },
    haystack: {
      w: 120,
      perch: [0, -74],
      draw(ctx, x, b) {
        ctx.beginPath();
        ctx.moveTo(x - 60, b);
        ctx.quadraticCurveTo(x - 58, b - 76, x, b - 74);
        ctx.quadraticCurveTo(x + 58, b - 76, x + 60, b);
        ctx.closePath();
        ctx.fillStyle = "#f2d06b";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        for (let i = 0; i < 6; i++) D.line(ctx, x - 40 + i * 16, b - 10, x - 34 + i * 14, b - 50 + (i % 2) * 12, "#c9a336", 2);
      },
    },
    tree: {
      w: 120,
      draw(ctx, x, b, t, o) {
        const c = (o && o.color) || "#3f9e4a";
        D.rect(ctx, x - 9, b - 70, 18, 70, "#8a5a2b", 3, 3);
        const sway = Math.sin(t * 1.3 + x) * 2;
        D.circ(ctx, x - 26 + sway, b - 92, 32, c, 3);
        D.circ(ctx, x + 26 + sway, b - 96, 34, c, 3);
        D.circ(ctx, x + sway, b - 128, 36, c, 3);
        D.circ(ctx, x - 26 + sway, b - 92, 29, c, 0);
        D.circ(ctx, x + 26 + sway, b - 96, 31, c, 0);
      },
    },
    corn: {
      w: 170,
      draw(ctx, x, b, t) {
        for (let i = 0; i < 8; i++) {
          const cx = x - 75 + i * 21;
          const sway = Math.sin(t * 2 + i) * 3;
          D.line(ctx, cx, b, cx + sway, b - 72, "#4fa33f", 4);
          D.ell(ctx, cx + sway + 5, b - 50, 4, 10, "#ffd23f", 2, 0.3);
          D.ell(ctx, cx + sway - 7, b - 38, 9, 3, "#6fc35a", 2, -0.5);
        }
      },
    },
    scarecrow: {
      w: 80,
      draw(ctx, x, b, t) {
        D.line(ctx, x, b, x, b - 96, "#8a5a2b", 5);
        D.line(ctx, x - 36, b - 70, x + 36, b - 70, "#8a5a2b", 5);
        D.rect(ctx, x - 16, b - 80, 32, 36, "#5f8cff", 2.5, 4);
        D.circ(ctx, x, b - 96, 13, "#f2d06b", 2.5);
        D.ell(ctx, x, b - 106, 20, 4, "#c9a336", 2.5);
        D.circ(ctx, x - 4, b - 97, 2, OUT, 0);
        D.circ(ctx, x + 4, b - 97, 2, OUT, 0);
      },
    },

    // ---- Suburbia
    house: {
      w: 210,
      perch: [0, -180],
      draw(ctx, x, b, t, o) {
        const wall = (o && o.color) || "#8fd3ff";
        const roof = (o && o.roof) || "#5a4fa8";
        D.rect(ctx, x + 40, b - 180, 22, 46, "#a0612f", 3);
        D.rect(ctx, x - 88, b - 118, 176, 118, wall, 3);
        D.poly(ctx, [x - 102, b - 114, x, b - 182, x + 102, b - 114], roof, 3);
        D.rect(ctx, x - 16, b - 66, 32, 66, "#fff", 2.5, 3);
        D.circ(ctx, x + 9, b - 32, 2.5, "#ffd23f", 1);
        for (const wx of [-70, 38]) {
          D.rect(ctx, x + wx, b - 92, 32, 30, "#fff9d6", 2.5);
          D.line(ctx, x + wx + 16, b - 92, x + wx + 16, b - 62, OUT, 2);
          D.line(ctx, x + wx, b - 77, x + wx + 32, b - 77, OUT, 2);
        }
        D.circ(ctx, x, b - 140, 12, "#fff9d6", 2.5);
      },
    },
    doghouse: {
      w: 80,
      perch: [0, -66],
      draw(ctx, x, b) {
        D.rect(ctx, x - 30, b - 40, 60, 40, "#e8463c", 3);
        D.poly(ctx, [x - 38, b - 38, x, b - 66, x + 38, b - 38], "#9b2d2d", 3);
        ctx.beginPath();
        ctx.arc(x, b - 12, 12, Math.PI, U.TAU);
        ctx.lineTo(x + 12, b);
        ctx.lineTo(x - 12, b);
        ctx.closePath();
        ctx.fillStyle = "#2a1a20";
        ctx.fill();
      },
    },
    swings: {
      w: 160,
      perch: [0, -120],
      draw(ctx, x, b, t) {
        D.line(ctx, x - 70, b, x - 56, b - 118, "#e8463c", 6);
        D.line(ctx, x - 42, b, x - 56, b - 118, "#e8463c", 6);
        D.line(ctx, x + 70, b, x + 56, b - 118, "#e8463c", 6);
        D.line(ctx, x + 42, b, x + 56, b - 118, "#e8463c", 6);
        D.line(ctx, x - 60, b - 118, x + 60, b - 118, "#ffd23f", 7);
        for (const sx of [-24, 24]) {
          const a = Math.sin(t * 2 + sx) * 0.35;
          const ex = x + sx + Math.sin(a) * 80;
          const ey = b - 118 + Math.cos(a) * 80;
          D.line(ctx, x + sx, b - 118, ex, ey, OUT, 2);
          D.rect(ctx, ex - 12, ey - 3, 24, 6, "#5fd0ff", 2, 2);
        }
      },
    },
    pool: {
      w: 190,
      draw(ctx, x, b, t) {
        D.rect(ctx, x - 90, b - 20, 180, 20, "#e9e4f2", 3, 8);
        D.rect(ctx, x - 80, b - 17, 160, 13, "#43c6ff", 2, 5);
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const wx = x - 60 + i * 38 + Math.sin(t * 2 + i) * 6;
          D.line(ctx, wx, b - 11, wx + 14, b - 11, "rgba(255,255,255,0.8)", 2);
        }
        D.ell(ctx, x + 30, b - 14, 14, 5, "#ff5fb4", 2);
        D.line(ctx, x - 70, b - 20, x - 70, b - 40, "#bbb", 3);
        D.line(ctx, x - 60, b - 20, x - 60, b - 40, "#bbb", 3);
      },
    },
    mailbox: {
      w: 40,
      draw(ctx, x, b) {
        D.line(ctx, x, b, x, b - 40, "#8a5a2b", 5);
        D.rect(ctx, x - 14, b - 56, 28, 18, "#2d5bff", 2.5, 6);
        D.rect(ctx, x + 10, b - 64, 4, 12, "#e8463c", 1.5);
      },
    },
    lamp: {
      w: 40,
      draw(ctx, x, b, t, o) {
        D.line(ctx, x, b, x, b - 140, "#4b5063", 5);
        D.line(ctx, x, b - 140, x + 22, b - 146, "#4b5063", 5);
        D.ell(ctx, x + 26, b - 142, 10, 5, (o && o.lit) ? "#fff36b" : "#dde", 2);
        if (o && o.lit) {
          ctx.fillStyle = "rgba(255, 240, 140, 0.18)";
          ctx.beginPath();
          ctx.moveTo(x + 18, b - 140);
          ctx.lineTo(x + 34, b - 140);
          ctx.lineTo(x + 70, b);
          ctx.lineTo(x - 18, b);
          ctx.fill();
        }
      },
    },
    picket: {
      w: 160,
      draw(ctx, x, b) {
        D.rect(ctx, x - 80, b - 30, 160, 6, "#fff", 2);
        for (let i = 0; i < 9; i++) D.poly(ctx, [x - 78 + i * 19, b, x - 66 + i * 19, b, x - 66 + i * 19, b - 40, x - 72 + i * 19, b - 46, x - 78 + i * 19, b - 40], "#fff", 2);
      },
    },

    // ---- Desert
    saloon: {
      w: 210,
      perch: [0, -192],
      draw(ctx, x, b) {
        D.rect(ctx, x - 96, b - 150, 192, 150, "#c9884a", 3);
        D.rect(ctx, x - 80, b - 190, 160, 44, "#b0733a", 3);
        ctx.fillStyle = "#fff4d6";
        ctx.font = "800 26px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("SALOON", x, b - 167);
        D.rect(ctx, x - 100, b - 100, 200, 10, "#8a5a2b", 3);
        for (let i = 0; i < 6; i++) D.line(ctx, x - 92 + i * 37, b - 100, x - 92 + i * 37, b - 70, "#8a5a2b", 3);
        D.rect(ctx, x - 26, b - 56, 24, 40, "#8a5a2b", 2.5, 2);
        D.rect(ctx, x + 2, b - 56, 24, 40, "#8a5a2b", 2.5, 2);
        for (const wx of [-78, 46]) D.rect(ctx, x + wx, b - 140, 32, 30, "#ffe8a3", 2.5);
      },
    },
    waterTower: {
      w: 140,
      perch: [0, -232],
      draw(ctx, x, b) {
        for (const lx of [-40, 40]) D.line(ctx, x + lx, b, x + lx * 0.6, b - 150, "#7a4a22", 6);
        D.line(ctx, x - 36, b - 70, x + 36, b - 70, "#7a4a22", 4);
        D.line(ctx, x - 38, b - 70, x + 30, b - 140, "#7a4a22", 3);
        D.rect(ctx, x - 52, b - 214, 104, 70, "#b8743d", 3, 6);
        for (let i = 1; i < 5; i++) D.line(ctx, x - 52 + i * 21, b - 214, x - 52 + i * 21, b - 144, "#8a5a2b", 2);
        D.poly(ctx, [x - 58, b - 212, x, b - 234, x + 58, b - 212], "#7a4a22", 3);
      },
    },
    cactus: {
      w: 90,
      draw(ctx, x, b) {
        const g = "#3fae5a";
        D.rect(ctx, x - 14, b - 140, 28, 140, g, 3, 14);
        D.rect(ctx, x - 46, b - 96, 34, 18, g, 3, 9);
        D.rect(ctx, x - 46, b - 130, 18, 50, g, 3, 9);
        D.rect(ctx, x + 12, b - 76, 30, 18, g, 3, 9);
        D.rect(ctx, x + 26, b - 112, 18, 52, g, 3, 9);
        D.rect(ctx, x - 12, b - 96, 24, 14, g, 0);
        D.line(ctx, x, b - 130, x, b - 10, "#2e8a46", 2);
        D.circ(ctx, x, b - 142, 6, "#ff5fb4", 2);
      },
    },
    gasStation: {
      w: 220,
      perch: [-30, -132],
      draw(ctx, x, b) {
        D.rect(ctx, x + 40, b - 90, 70, 90, "#f4efe6", 3);
        D.rect(ctx, x + 56, b - 60, 24, 60, "#5fd0ff", 2.5);
        D.rect(ctx, x - 120, b - 132, 150, 22, "#e8463c", 3, 4);
        ctx.fillStyle = "#fff";
        ctx.font = "800 15px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GAS & SNAX", x - 45, b - 121);
        D.line(ctx, x - 104, b - 110, x - 104, b, "#ccc", 6);
        D.line(ctx, x + 14, b - 110, x + 14, b, "#ccc", 6);
        D.rect(ctx, x - 60, b - 54, 26, 54, "#ffd23f", 3, 4);
        D.rect(ctx, x - 55, b - 46, 16, 12, "#fff", 2);
      },
    },
    rocks: {
      w: 150,
      perch: [8, -84],
      draw(ctx, x, b) {
        D.poly(ctx, [x - 72, b, x - 60, b - 50, x - 20, b - 80, x + 30, b - 86, x + 66, b - 44, x + 76, b], "#c56b3b", 3);
        D.poly(ctx, [x - 20, b - 80, x + 30, b - 86, x + 20, b - 60, x - 10, b - 56], "#e08a52", 0);
        D.line(ctx, x - 40, b - 30, x - 10, b - 40, "#9a4f2a", 2);
      },
    },
    windpump: {
      w: 90,
      draw(ctx, x, b, t) {
        D.line(ctx, x - 26, b, x - 4, b - 150, "#8a8f9c", 4);
        D.line(ctx, x + 26, b, x + 4, b - 150, "#8a8f9c", 4);
        ctx.save();
        ctx.translate(x, b - 156);
        ctx.rotate(t * 3);
        for (let i = 0; i < 12; i++) {
          ctx.rotate(U.TAU / 12);
          D.line(ctx, 4, 0, 30, 0, "#d9dde6", 4);
        }
        ctx.restore();
        D.circ(ctx, x, b - 156, 5, "#555", 2);
        D.poly(ctx, [x - 4, b - 156, x - 46, b - 166, x - 46, b - 146], "#e8463c", 2.5);
      },
    },

    // ---- City
    building: {
      w: 190,
      perch: [0, 0],
      draw(ctx, x, b, t, o) {
        const h = o.h;
        const c = o.color;
        D.rect(ctx, x - 88, b - h, 176, h, c, 3);
        D.rect(ctx, x - 92, b - h - 8, 184, 12, D.OUT, 0);
        const lit = ["#ffe68a", "#ffe68a", "#5a6c9a", "#ffe68a", "#5a6c9a"];
        for (let r = 0; r * 34 + 30 < h - 60; r++) {
          for (let cIdx = 0; cIdx < 4; cIdx++) {
            const k = (r * 7 + cIdx * 3 + o.seed) % lit.length;
            ctx.fillStyle = lit[k];
            ctx.fillRect(x - 72 + cIdx * 40, b - h + 22 + r * 34, 24, 20);
          }
        }
        D.rect(ctx, x - 26, b - 56, 52, 56, "#2a2f45", 3);
        D.rect(ctx, x - 40, b - 64, 80, 10, "#e8463c", 2.5, 3);
        if (o.tank) {
          for (const lx of [-50, -26]) D.line(ctx, x + lx, b - h - 4, x + lx, b - h - 26, "#4b5063", 3);
          D.rect(ctx, x - 60, b - h - 60, 46, 38, "#8a5a2b", 3, 4);
          D.poly(ctx, [x - 64, b - h - 58, x - 37, b - h - 74, x - 10, b - h - 58], "#6b3b1f", 3);
        }
        if (o.antenna) {
          D.line(ctx, x + 50, b - h - 4, x + 50, b - h - 60, "#4b5063", 3);
          D.circ(ctx, x + 50, b - h - 62, 4, Math.sin(t * 4) > 0 ? "#ff3b3b" : "#7a1d1d", 2);
        }
      },
    },
    billboard: {
      w: 200,
      perch: [0, -196],
      draw(ctx, x, b, t) {
        D.line(ctx, x - 50, b, x - 50, b - 110, "#4b5063", 7);
        D.line(ctx, x + 50, b, x + 50, b - 110, "#4b5063", 7);
        D.rect(ctx, x - 96, b - 194, 192, 90, "#fff4d6", 3, 4);
        D.rect(ctx, x - 88, b - 186, 176, 74, "#ff5fb4", 2, 3);
        ctx.fillStyle = "#fff";
        ctx.font = "800 20px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("UFOs? NOT", x, b - 162);
        ctx.fillText("IN MY TOWN!", x, b - 136);
        const blink = Math.floor(t * 2) % 2;
        for (let i = 0; i < 9; i++) D.circ(ctx, x - 88 + i * 22, b - 196, 3, (i + blink) % 2 ? "#fff36b" : "#a88", 1);
      },
    },
    crane: {
      w: 240,
      perch: [-30, -334],
      draw(ctx, x, b, t) {
        const top = b - 320;
        D.rect(ctx, x - 14, top, 28, 320, "#ffd23f", 3);
        for (let i = 0; i < 9; i++) D.line(ctx, x - 13, top + i * 36, x + 13, top + i * 36 + 36, "#e0a800", 2.5);
        D.rect(ctx, x - 110, top - 14, 240, 14, "#ffd23f", 3);
        D.rect(ctx, x - 46, top - 14, 34, 28, "#e8463c", 3, 3);
        D.rect(ctx, x - 40, top - 8, 22, 14, "#bfefff", 2);
        D.rect(ctx, x - 110, top, 30, 20, "#777", 3);
        const sw = Math.sin(t * 1.2) * 8;
        D.line(ctx, x + 100, top, x + 100 + sw, top + 150, OUT, 2);
        D.rect(ctx, x + 70 + sw, top + 150, 60, 12, "#e8463c", 3);
        D.circ(ctx, x, top - 20, 4, Math.sin(t * 5) > 0 ? "#ff3b3b" : "#7a1d1d", 2);
      },
    },
    busStop: {
      w: 140,
      perch: [0, -104],
      draw(ctx, x, b) {
        D.rect(ctx, x - 62, b - 104, 124, 12, "#2d5bff", 3, 3);
        D.line(ctx, x - 56, b - 92, x - 56, b, "#4b5063", 4);
        D.line(ctx, x + 56, b - 92, x + 56, b, "#4b5063", 4);
        D.rect(ctx, x - 50, b - 88, 100, 54, "rgba(190, 240, 255, 0.5)", 2.5);
        D.rect(ctx, x - 42, b - 30, 84, 8, "#8a5a2b", 2.5);
        D.circ(ctx, x + 56, b - 120, 14, "#2d5bff", 3);
        ctx.fillStyle = "#fff";
        ctx.font = "800 13px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("BUS", x + 56, b - 120);
      },
    },
    hotdog: {
      w: 100,
      draw(ctx, x, b) {
        D.rect(ctx, x - 40, b - 52, 80, 40, "#e8463c", 3, 5);
        D.circ(ctx, x - 26, b - 8, 8, "#333", 2.5);
        D.circ(ctx, x + 26, b - 8, 8, "#333", 2.5);
        D.line(ctx, x, b - 52, x, b - 100, "#ccc", 3);
        ctx.beginPath();
        ctx.moveTo(x - 46, b - 88);
        ctx.quadraticCurveTo(x, b - 120, x + 46, b - 88);
        ctx.closePath();
        ctx.fillStyle = "#ffd23f";
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3;
        ctx.stroke();
        D.ell(ctx, x, b - 36, 22, 7, "#f2a35a", 2);
        D.ell(ctx, x, b - 38, 18, 4, "#c4352b", 1.5);
      },
    },

    // ---- Island
    palm: {
      w: 140,
      perch: [34, -206],
      draw(ctx, x, b, t) {
        const sway = Math.sin(t * 1.4 + x * 0.01) * 4;
        ctx.lineCap = "round";
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.moveTo(x, b);
        ctx.quadraticCurveTo(x - 4, b - 120, x + 34 + sway, b - 196);
        ctx.stroke();
        ctx.strokeStyle = "#b8803d";
        ctx.lineWidth = 14;
        ctx.stroke();
        for (let i = 1; i < 8; i++) {
          const k = i / 8;
          const px = U.lerp(x, x + 34 + sway, k * k);
          const py = b - 196 * k;
          D.line(ctx, px - 6, py, px + 6, py - 2, "#8a5a2b", 2);
        }
        const cx = x + 34 + sway;
        const cy = b - 200;
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i - 2.5) * 0.62 + Math.sin(t * 2 + i) * 0.05;
          const ex = cx + Math.cos(a) * 78;
          const ey = cy + Math.sin(a) * 30 + 26;
          D.limb3(ctx, cx, cy, cx + Math.cos(a) * 44, cy + Math.sin(a) * 34 - 6, ex, ey, 11, "#3fae5a", 2.5);
        }
        D.circ(ctx, cx - 8, cy + 8, 7, "#7a4a22", 2.5);
        D.circ(ctx, cx + 6, cy + 10, 7, "#7a4a22", 2.5);
      },
    },
    hut: {
      w: 160,
      perch: [0, -136],
      draw(ctx, x, b) {
        D.rect(ctx, x - 58, b - 76, 116, 76, "#d9a05b", 3);
        for (let i = 0; i < 7; i++) D.line(ctx, x - 50 + i * 17, b - 74, x - 50 + i * 17, b - 2, "#b8803d", 2);
        D.rect(ctx, x - 16, b - 50, 32, 50, "#5a3416", 2.5, 4);
        D.poly(ctx, [x - 82, b - 66, x, b - 138, x + 82, b - 66], "#e8c46b", 3);
        for (let i = 0; i < 9; i++) D.line(ctx, x - 70 + i * 17, b - 68, x - 64 + i * 15, b - 80, "#c9a336", 2);
      },
    },
    lighthouse: {
      w: 120,
      perch: [0, -236],
      draw(ctx, x, b, t) {
        D.poly(ctx, [x - 36, b, x + 36, b, x + 22, b - 210, x - 22, b - 210], "#ffffff", 3);
        for (let i = 0; i < 4; i++) {
          const y1 = b - 30 - i * 50;
          const k1 = (b - y1) / 210;
          const k2 = (b - y1 + 22) / 210;
          D.poly(ctx, [x - 36 + 14 * k1, y1, x + 36 - 14 * k1, y1, x + 36 - 14 * k2, y1 - 22, x - 36 + 14 * k2, y1 - 22], "#e8463c", 0);
        }
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 36, b);
        ctx.lineTo(x - 22, b - 210);
        ctx.moveTo(x + 36, b);
        ctx.lineTo(x + 22, b - 210);
        ctx.stroke();
        D.rect(ctx, x - 32, b - 222, 64, 12, "#333", 3);
        D.rect(ctx, x - 18, b - 254, 36, 32, "#fff36b", 3);
        D.poly(ctx, [x - 24, b - 254, x, b - 276, x + 24, b - 254], "#e8463c", 3);
        const a = t * 1.5;
        const dir = Math.cos(a);
        ctx.fillStyle = "rgba(255, 245, 160, 0.22)";
        ctx.beginPath();
        ctx.moveTo(x, b - 238);
        ctx.lineTo(x + dir * 320, b - 270);
        ctx.lineTo(x + dir * 320, b - 206);
        ctx.closePath();
        ctx.fill();
      },
    },
    resort: {
      w: 230,
      perch: [-40, -176],
      draw(ctx, x, b) {
        D.rect(ctx, x - 106, b - 170, 212, 170, "#ffc6dc", 3);
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 4; c++) {
            const wx = x - 88 + c * 48;
            const wy = b - 156 + r * 46;
            D.rect(ctx, wx, wy, 30, 26, "#bfefff", 2.5, 3);
            D.rect(ctx, wx - 4, wy + 26, 38, 6, "#fff", 2);
          }
        }
        D.rect(ctx, x - 112, b - 178, 224, 10, "#5fd0ff", 3);
        ctx.fillStyle = "#fff";
        ctx.font = "800 14px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        D.rect(ctx, x + 10, b - 206, 92, 26, "#ff5fb4", 3, 6);
        ctx.fillStyle = "#fff";
        ctx.fillText("RESORT", x + 56, b - 192);
      },
    },
    umbrella: {
      w: 90,
      draw(ctx, x, b) {
        D.line(ctx, x, b, x - 6, b - 90, "#fff", 4);
        ctx.beginPath();
        ctx.moveTo(x - 56, b - 80);
        ctx.quadraticCurveTo(x - 6, b - 128, x + 46, b - 92);
        ctx.closePath();
        ctx.fillStyle = "#ff5f5f";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.poly(ctx, [x - 30, b - 88, x - 6, b - 112, x + 14, b - 88], "#fff", 0);
        D.rect(ctx, x - 40, b - 12, 60, 10, "#5fd0ff", 2.5, 3);
      },
    },
    torch: {
      w: 30,
      draw(ctx, x, b, t) {
        D.line(ctx, x, b, x, b - 70, "#8a5a2b", 6);
        D.rect(ctx, x - 7, b - 82, 14, 14, "#c9a336", 2.5, 2);
        const f = Math.sin(t * 18) * 3;
        D.poly(ctx, [x - 7, b - 82, x + f, b - 108, x + 7, b - 82], "#ffb02e", 2);
        D.poly(ctx, [x - 3, b - 82, x + f * 0.5, b - 98, x + 3, b - 82], "#fff36b", 0);
      },
    },
    surfboards: {
      w: 80,
      draw(ctx, x, b) {
        const colors = ["#ff5fb4", "#ffd23f", "#5fd0ff"];
        colors.forEach((c, i) => {
          D.ell(ctx, x - 22 + i * 22, b - 50, 10, 50, c, 3, (i - 1) * 0.15);
          D.line(ctx, x - 22 + i * 22, b - 90, x - 22 + i * 22, b - 10, "#fff", 2);
        });
      },
    },
  };

  function smokePuffs(ctx, x, y, t) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.4 + i / 3) % 1;
      ctx.fillStyle = `rgba(240, 240, 250, ${0.7 - k * 0.7})`;
      ctx.beginPath();
      ctx.arc(x + k * 26, y - k * 60, 8 + k * 12, 0, U.TAU);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- Environments

  const ENVIRONMENTS = {
    farm: {
      name: "Country Farm",
      sky: ["#4fb8ff", "#9fe0ff", "#fff1c9"],
      sun: { x: 0.78, y: 104, r: 46, color: "#fff2a0" },
      clouds: "#ffffff",
      night: { sky: ["#0b1640", "#22346e", "#4a5a96"], clouds: "#3e4a80" },
      far: { kind: "hills", colors: ["#8fd47a", "#6fbf62"], base: 470, amp: [40, 110] },
      mid: { kind: "trees", color: "#4f9e4f" },
      ground: ["#86d65e", "#5ab442"],
      detail: "crops",
      props: [
        ["tree", 140], ["barn", 420], ["corn", 650], ["windmill", 900], ["haystack", 1180], ["scarecrow", 1350],
        ["silo", 1700], ["tree", 1860], ["farmhouse", 2160], ["corn", 2420], ["haystack", 2700], ["tree", 2880],
        ["windmill", 3120], ["barn", 3480], ["tree", 3740],
      ],
      ground_spots: [800, 2560],
    },
    suburbia: {
      name: "Suburbia",
      sky: ["#6aa8ff", "#b5d7ff", "#ffe2f1"],
      sun: { x: 0.2, y: 120, r: 42, color: "#fff7c2" },
      clouds: "#ffffff",
      night: { sky: ["#0e1238", "#2a2f6a", "#5a4f8a"], clouds: "#454878" },
      far: { kind: "hills", colors: ["#9cc8a0", "#7fb487"], base: 470, amp: [20, 60], tower: true },
      mid: { kind: "roofs", color: "#8aa6c8" },
      ground: ["#7ccf6a", "#5aaf4e"],
      detail: "street",
      props: [
        ["tree", 120, { color: "#4fae5a" }], ["house", 360, { color: "#8fd3ff", roof: "#5a4fa8" }], ["mailbox", 500], ["pool", 650], ["lamp", 780],
        ["house", 980, { color: "#ffd1e8", roof: "#c4352b" }], ["doghouse", 1180], ["picket", 1330], ["swings", 1560], ["tree", 1760, { color: "#4fae5a" }],
        ["house", 2000, { color: "#fff0a8", roof: "#2d8b6a" }], ["mailbox", 2140], ["lamp", 2260], ["pool", 2430],
        ["house", 2700, { color: "#d6c4ff", roof: "#5a4fa8" }], ["picket", 2900], ["tree", 3050, { color: "#4fae5a" }],
        ["house", 3300, { color: "#b6f0c8", roof: "#c4352b" }], ["doghouse", 3520], ["tree", 3720, { color: "#4fae5a" }],
      ],
      ground_spots: [1400, 2860],
    },
    desert: {
      name: "Desert Town",
      sky: ["#ff9a4a", "#ffc97a", "#fff0c4"],
      sun: { x: 0.5, y: 96, r: 58, color: "#fff4c0" },
      clouds: null,
      night: { sky: ["#140f3a", "#3a2a6a", "#7a4f7a"], clouds: null },
      far: { kind: "mesas", colors: ["#e08a52", "#c56b3b"], base: 472 },
      mid: { kind: "spires", color: "#d9925a" },
      ground: ["#f2cf8a", "#deb06a"],
      detail: "sand",
      props: [
        ["cactus", 150], ["saloon", 420], ["windpump", 640], ["waterTower", 860], ["cactus", 1060], ["rocks", 1300],
        ["gasStation", 1640], ["cactus", 1880], ["saloon", 2150], ["rocks", 2450], ["windpump", 2640], ["waterTower", 2900],
        ["cactus", 3120], ["gasStation", 3420], ["cactus", 3720],
      ],
      ground_spots: [1150, 2780],
      tumbleweeds: true,
    },
    city: {
      name: "Big City",
      sky: ["#4f9cf0", "#a6cff7", "#ffe6d2"],
      sun: { x: 0.85, y: 110, r: 40, color: "#fff4c0" },
      clouds: "#ffffff",
      night: { sky: ["#070a24", "#1c1f52", "#46307a"], clouds: "#3a3468" },
      far: { kind: "skyline", colors: ["#8796c4", "#7383b4"], base: 480 },
      mid: { kind: "towers", color: "#6f7fae" },
      ground: ["#9aa0b5", "#6e7488"],
      detail: "road",
      lamps: true,
      props: [
        ["building", 140, { h: 250, color: "#7f8cff", seed: 1, tank: true }], ["busStop", 360], ["building", 580, { h: 290, color: "#ff8fa8", seed: 4, antenna: true }],
        ["hotdog", 790], ["lamp", 900], ["crane", 1120], ["building", 1420, { h: 230, color: "#5fd0ff", seed: 2 }], ["billboard", 1660],
        ["building", 1900, { h: 300, color: "#c08cff", seed: 3, antenna: true }], ["lamp", 2100], ["busStop", 2240],
        ["building", 2480, { h: 260, color: "#ffc46b", seed: 5, tank: true }], ["hotdog", 2700], ["billboard", 2920],
        ["building", 3180, { h: 280, color: "#8dff9a", seed: 6, antenna: true }], ["lamp", 3400], ["building", 3660, { h: 240, color: "#ff8fa8", seed: 7 }],
      ],
      ground_spots: [1000, 2600],
    },
    island: {
      name: "Tropical Island",
      sky: ["#2fc6ff", "#8fe8ff", "#e8fff6"],
      sun: { x: 0.3, y: 100, r: 50, color: "#fff8b0" },
      clouds: "#ffffff",
      night: { sky: ["#06183e", "#12407a", "#2f7aa8"], clouds: "#36507e" },
      far: { kind: "sea", colors: ["#3fa8d8", "#2b8fc4"], base: 480 },
      mid: { kind: "islands", color: "#3e9a7a" },
      ground: ["#ffe7a8", "#f2cf80"],
      detail: "beach",
      ocean: true,
      props: [
        ["palm", 140], ["hut", 380], ["umbrella", 560], ["palm", 720], ["torch", 860], ["lighthouse", 1060], ["surfboards", 1250],
        ["palm", 1420], ["resort", 1700], ["umbrella", 1940], ["palm", 2100], ["torch", 2260], ["hut", 2460], ["palm", 2700],
        ["umbrella", 2880], ["resort", 3140], ["palm", 3400], ["surfboards", 3560], ["palm", 3740],
      ],
      ground_spots: [1500, 2990],
    },
  };

  // ---------------------------------------------------------------- Night

  // Night copies of the environments share everything with the day version except the sky.
  // The scenery is darkened with a tint, then the lights below are drawn on top of it.
  const NIGHT_TINT = "#5c66a6";
  const nightEnvs = {};
  function nightEnv(key) {
    if (!nightEnvs[key]) {
      const day = ENVIRONMENTS[key];
      nightEnvs[key] = {
        ...day,
        ...day.night,
        name: `${day.name} at Night`,
        isNight: true,
        stars: true,
        sun: { ...day.sun, r: Math.round(day.sun.r * 0.75), color: "#f6f2d8" },
      };
    }
    return nightEnvs[key];
  }

  // Soft round glows, drawn once to small canvases and scaled when used.
  const glowSprites = {};
  function glowSprite(rgb) {
    if (!glowSprites[rgb]) {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, `rgba(${rgb}, 1)`);
      grad.addColorStop(0.35, `rgba(${rgb}, 0.45)`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      glowSprites[rgb] = c;
    }
    return glowSprites[rgb];
  }
  const WARM = "255, 214, 120";
  const FIRE = "255, 150, 50";
  const RED = "255, 60, 60";

  function glow(ctx, x, y, r, rgb, alpha) {
    const prevOp = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(rgb), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  }

  // A lit window: bright glass inside the existing outline, with optional frame bars.
  function litWindow(ctx, x, y, w, h, bars) {
    ctx.fillStyle = "#ffe58a";
    ctx.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
    if (bars) {
      D.line(ctx, x + w / 2, y, x + w / 2, y + h, OUT, 2);
      if (bars === 2) D.line(ctx, x, y + h / 2, x + w, y + h / 2, OUT, 2);
    }
    glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 1.4, WARM, 0.45);
  }

  // What lights up at night, keyed by prop. Drawn after the darkening tint.
  const LIGHTS = {
    lamp(ctx, x, b) {
      ctx.fillStyle = "rgba(255, 236, 150, 0.2)";
      ctx.beginPath();
      ctx.moveTo(x + 18, b - 140);
      ctx.lineTo(x + 34, b - 140);
      ctx.lineTo(x + 70, b);
      ctx.lineTo(x - 18, b);
      ctx.fill();
      D.ell(ctx, x + 26, b - 142, 8, 3.5, "#fff6b0", 0);
      glow(ctx, x + 26, b - 142, 44, WARM, 0.9);
      glow(ctx, x + 26, b - 4, 70, WARM, 0.35);
    },
    torch(ctx, x, b, t) {
      const f = Math.sin(t * 18) * 3;
      D.poly(ctx, [x - 7, b - 82, x + f, b - 108, x + 7, b - 82], "#ffb02e", 0);
      D.poly(ctx, [x - 3, b - 82, x + f * 0.5, b - 98, x + 3, b - 82], "#fff36b", 0);
      glow(ctx, x, b - 94, 58 + Math.sin(t * 11) * 4, FIRE, 0.75);
    },
    lighthouse(ctx, x, b, t) {
      ctx.fillStyle = "#fff36b";
      ctx.fillRect(x - 16.5, b - 252.5, 33, 29);
      const dir = Math.cos(t * 1.5);
      ctx.fillStyle = "rgba(255, 245, 160, 0.3)";
      ctx.beginPath();
      ctx.moveTo(x, b - 238);
      ctx.lineTo(x + dir * 420, b - 286);
      ctx.lineTo(x + dir * 420, b - 190);
      ctx.closePath();
      ctx.fill();
      glow(ctx, x, b - 238, 80, WARM, 0.85);
    },
    barn(ctx, x, b) {
      litWindow(ctx, x - 13, b - 135, 26, 22, 0);
    },
    farmhouse(ctx, x, b) {
      for (const wx of [-58, 42]) litWindow(ctx, x + wx, b - 82, 30, 28, 1);
      glow(ctx, x, b - 30, 40, WARM, 0.3);
    },
    house(ctx, x, b) {
      for (const wx of [-70, 38]) litWindow(ctx, x + wx, b - 92, 32, 30, 2);
      D.circ(ctx, x, b - 140, 10.5, "#ffe58a", 0);
      glow(ctx, x, b - 140, 26, WARM, 0.4);
    },
    saloon(ctx, x, b) {
      for (const wx of [-78, 46]) litWindow(ctx, x + wx, b - 140, 32, 30, 0);
      glow(ctx, x, b - 40, 56, WARM, 0.45);
    },
    gasStation(ctx, x, b) {
      litWindow(ctx, x + 56, b - 60, 24, 60, 0);
      glow(ctx, x - 45, b - 121, 90, WARM, 0.35);
      glow(ctx, x - 45, b - 70, 110, WARM, 0.2);
    },
    building(ctx, x, b, t, o) {
      const h = o.h;
      ctx.fillStyle = "#ffe58a";
      for (let r = 0; r * 34 + 30 < h - 60; r++) {
        for (let cIdx = 0; cIdx < 4; cIdx++) {
          if ((r * 7 + cIdx * 3 + o.seed) % 5 === 2 || (r * 5 + cIdx + o.seed) % 4 === 0) continue;
          ctx.fillRect(x - 72 + cIdx * 40, b - h + 22 + r * 34, 24, 20);
        }
      }
      glow(ctx, x, b - 30, 70, WARM, 0.3);
      if (o.antenna && Math.sin(t * 4) > 0) glow(ctx, x + 50, b - h - 62, 22, RED, 0.9);
    },
    resort(ctx, x, b) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          if ((r * 4 + c) % 3 === 1) continue;
          litWindow(ctx, x - 88 + c * 48, b - 156 + r * 46, 30, 26, 0);
        }
      }
    },
    hut(ctx, x, b) {
      ctx.fillStyle = "#ffb04a";
      ctx.fillRect(x - 14, b - 48, 28, 47);
      glow(ctx, x, b - 26, 60, FIRE, 0.5);
    },
    billboard(ctx, x, b) {
      glow(ctx, x, b - 150, 120, WARM, 0.35);
    },
    busStop(ctx, x, b) {
      glow(ctx, x, b - 70, 70, WARM, 0.35);
    },
    crane(ctx, x, b, t) {
      if (Math.sin(t * 5) > 0) glow(ctx, x, b - 340, 24, RED, 0.9);
    },
  };

  // Darkens everything below the upper sky, so the moon and stars stay bright.
  const tints = new WeakMap();
  function nightTint(ctx) {
    let g = tints.get(ctx);
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, U.VH);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(150 / U.VH, "#ffffff");
      g.addColorStop(300 / U.VH, NIGHT_TINT);
      g.addColorStop(1, NIGHT_TINT);
      tints.set(ctx, g);
    }
    return g;
  }

  function drawMoon(ctx, x, y, r, t) {
    glow(ctx, x, y, r * 3.2, "200, 215, 255", 0.35 + Math.sin(t * 0.8) * 0.03);
    D.circ(ctx, x, y, r, "#f6f2d8", 0);
    D.circ(ctx, x - r * 0.35, y - r * 0.2, r * 0.22, "#ddd8b8", 0);
    D.circ(ctx, x + r * 0.3, y + r * 0.3, r * 0.15, "#ddd8b8", 0);
    D.circ(ctx, x + r * 0.25, y - r * 0.4, r * 0.1, "#ddd8b8", 0);
  }

  // ---------------------------------------------------------------- Scene

  function build(key, night) {
    const env = night ? nightEnv(key) : ENVIRONMENTS[key];
    const rnd = U.seeded(key.length * 977 + key.charCodeAt(0) * 31);
    const scene = { key, env, night: !!night, props: [], lights: [], perches: [], decor: [], clouds: [], farPts: [], midItems: [], tumbleweeds: [], birds: [] };

    for (const [k, x, opts] of env.props) {
      const def = PROPS[k];
      const prop = { def, k, x, base: U.PROP_BASE, opts: opts || null };
      scene.props.push(prop);
      if (night && LIGHTS[k]) scene.lights.push(prop);
      if (def.perch) {
        const dy = k === "building" ? -opts.h - 8 : def.perch[1];
        scene.perches.push({ x: x + def.perch[0], y: U.PROP_BASE + dy, prop: k, ground: false });
      }
    }
    for (const gx of env.ground_spots) scene.perches.push({ x: gx, y: U.FEET_MIN + 30, prop: "bush", ground: true });

    // Far layer outline.
    const farW = U.WORLD_W * FAR + 1600;
    const far = env.far;
    if (far.kind === "hills") {
      for (let x = -40; x <= farW + 40; x += 40) {
        const h = U.lerp(far.amp[0], far.amp[1], 0.5 + 0.5 * Math.sin(x * 0.004 + 1) * Math.cos(x * 0.0017));
        scene.farPts.push(x, far.base - h);
      }
    } else if (far.kind === "mesas") {
      let x = -60;
      while (x < farW + 60) {
        const w = 120 + rnd() * 220;
        const h = 50 + rnd() * 110;
        scene.farPts.push({ x, w, h });
        x += w + 40 + rnd() * 160;
      }
    } else if (far.kind === "skyline") {
      let x = -40;
      while (x < farW + 40) {
        const w = 50 + rnd() * 70;
        const h = 90 + rnd() * 220;
        scene.farPts.push({ x, w, h, s: Math.floor(rnd() * 1000) });
        x += w + 4 + rnd() * 18;
      }
    }

    // Mid layer.
    const midW = U.WORLD_W * MID + 1600;
    let mx = -60;
    while (mx < midW + 60) {
      scene.midItems.push({ x: mx, s: 0.7 + rnd() * 0.6, v: rnd() });
      mx += 70 + rnd() * 150;
    }

    // Clouds.
    if (env.clouds) {
      for (let i = 0; i < 9; i++) scene.clouds.push({ x: rnd() * (U.WORLD_W * 0.15 + 1600), y: 50 + rnd() * 200, s: 0.6 + rnd() * 0.8 });
    }

    // Ground decorations (flowers, rocks, shells, cracks).
    for (let x = 30; x < U.WORLD_W; x += 40 + rnd() * 90) {
      scene.decor.push({ x, y: U.FEET_MIN - 4 + rnd() * 150, v: rnd() });
    }

    if (env.tumbleweeds) {
      for (let i = 0; i < 3; i++) scene.tumbleweeds.push({ x: rnd() * U.WORLD_W, y: 600 + rnd() * 80, vx: 60 + rnd() * 60, spin: 0 });
    }
    for (let i = 0; i < 4; i++) scene.birds.push({ x: rnd() * 2000, y: 120 + rnd() * 160, v: 30 + rnd() * 30, p: rnd() * 6 });
    return scene;
  }

  function update(scene, dt) {
    for (const tw of scene.tumbleweeds) {
      tw.x += tw.vx * dt;
      tw.spin += tw.vx * dt * 0.05;
      if (tw.x > U.WORLD_W + 100) tw.x = -100;
    }
    for (const b of scene.birds) {
      b.x += b.v * dt;
      if (b.x > 2600) b.x = -100;
    }
  }

  const gradients = new WeakMap();
  function skyGradient(ctx, env) {
    let byEnv = gradients.get(ctx);
    if (!byEnv) {
      byEnv = new Map();
      gradients.set(ctx, byEnv);
    }
    let g = byEnv.get(env);
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, U.HORIZON + 40);
      g.addColorStop(0, env.sky[0]);
      g.addColorStop(0.6, env.sky[1]);
      g.addColorStop(1, env.sky[2]);
      const gr = ctx.createLinearGradient(0, U.HORIZON, 0, U.VH);
      gr.addColorStop(0, env.ground[0]);
      gr.addColorStop(1, env.ground[1]);
      g = { sky: g, ground: gr };
      byEnv.set(env, g);
    }
    return g;
  }

  // Draws everything behind the characters. The world transform is NOT applied yet.
  function drawBackground(ctx, scene, camX, VW, t) {
    const env = scene.env;
    const grads = skyGradient(ctx, env);
    ctx.fillStyle = grads.sky;
    ctx.fillRect(0, 0, VW, U.HORIZON + 10);

    if (env.stars) {
      const count = env.isNight ? 70 : 40;
      for (let i = 0; i < count; i++) {
        const sx = ((i * 197.3 - camX * 0.03) % (VW + 20) + VW + 20) % (VW + 20);
        const sy = (i * 53.7) % 260;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
        ctx.fillStyle = "#fff";
        ctx.fillRect(sx, sy, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
      }
      ctx.globalAlpha = 1;
    }

    // Sun, or the moon at night.
    const sun = env.sun;
    const sx = sun.x * VW - camX * 0.03;
    if (env.isNight) {
      drawMoon(ctx, sx, sun.y, sun.r, t);
    } else {
      ctx.fillStyle = "rgba(255, 250, 200, 0.25)";
      ctx.beginPath();
      ctx.arc(sx, sun.y, sun.r * 1.7 + Math.sin(t) * 3, 0, U.TAU);
      ctx.fill();
      D.circ(ctx, sx, sun.y, sun.r, sun.color, 0);
    }

    // Clouds.
    if (env.clouds) {
      const span = U.WORLD_W * 0.15 + 1600;
      for (const c of scene.clouds) {
        let x = ((c.x + t * 8 * c.s - camX * 0.15) % span + span) % span - 200;
        if (x < -220 || x > VW + 220) continue;
        drawCloud(ctx, x, c.y, c.s, env.clouds);
      }
    }

    // Background birds (they've gone to roost at night).
    ctx.strokeStyle = "rgba(40, 30, 70, 0.55)";
    ctx.lineWidth = 2;
    for (const b of env.isNight ? [] : scene.birds) {
      const x = b.x - camX * 0.1;
      if (x < -20 || x > VW + 20) continue;
      const f = Math.sin(t * 8 + b.p) * 4;
      ctx.beginPath();
      ctx.moveTo(x - 8, b.y - f);
      ctx.lineTo(x, b.y);
      ctx.lineTo(x + 8, b.y - f);
      ctx.stroke();
    }

    drawFar(ctx, scene, camX * FAR, VW, t);
    drawMid(ctx, scene, camX * MID, VW, t);

    // Ground.
    ctx.fillStyle = grads.ground;
    ctx.fillRect(0, U.HORIZON, VW, U.VH - U.HORIZON);
    if (env.ocean) drawOcean(ctx, VW, camX, t);

    ctx.save();
    ctx.translate(-camX, 0);
    drawGroundDetail(ctx, scene, camX, VW, t);
    for (const p of scene.props) {
      const w = p.def.w || 200;
      if (p.x + w < camX - 120 || p.x - w > camX + VW + 120) continue;
      p.def.draw(ctx, p.x, p.base, t, p.opts);
    }
    for (const tw of scene.tumbleweeds) {
      if (tw.x < camX - 60 || tw.x > camX + VW + 60) continue;
      const bounce = Math.abs(Math.sin(tw.spin * 2)) * 14;
      ctx.save();
      ctx.translate(tw.x, tw.y - 18 - bounce);
      ctx.rotate(tw.spin);
      ctx.strokeStyle = "#a0763d";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 10 + i * 2, i * 0.7, 0, U.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    if (env.isNight) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = nightTint(ctx);
      ctx.fillRect(0, 0, VW, U.VH);
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(-camX, 0);
      for (const p of scene.lights) {
        const w = p.def.w || 200;
        if (p.x + w < camX - 200 || p.x - w > camX + VW + 200) continue;
        LIGHTS[p.k](ctx, p.x, p.base, t, p.opts);
      }
      ctx.restore();
    }
  }

  function drawCloud(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 26 * s, 0, U.TAU);
    ctx.arc(x + 30 * s, y - 12 * s, 32 * s, 0, U.TAU);
    ctx.arc(x + 64 * s, y, 26 * s, 0, U.TAU);
    ctx.arc(x + 32 * s, y + 8 * s, 26 * s, 0, U.TAU);
    ctx.fill();
  }

  function drawFar(ctx, scene, off, VW, t) {
    const far = scene.env.far;
    const [c1, c2] = far.colors;
    if (far.kind === "hills") {
      ctx.fillStyle = c1;
      ctx.beginPath();
      ctx.moveTo(-off - 40, U.HORIZON + 20);
      const pts = scene.farPts;
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i] - off;
        if (x < -80 || x > VW + 80) continue;
        ctx.lineTo(x, pts[i + 1]);
      }
      ctx.lineTo(VW + 40, U.HORIZON + 20);
      ctx.lineTo(-40, U.HORIZON + 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(-40, U.HORIZON + 20);
      for (let x = -40; x <= VW + 40; x += 30) {
        const wx = x + off * 1.6;
        ctx.lineTo(x, far.base + 10 - 26 - 18 * Math.sin(wx * 0.006));
      }
      ctx.lineTo(VW + 40, U.HORIZON + 20);
      ctx.closePath();
      ctx.fill();
      if (far.tower) {
        const tx = 900 - off;
        if (tx > -60 && tx < VW + 60) {
          ctx.fillStyle = "#6f8fa8";
          ctx.fillRect(tx - 3, 360, 6, 80);
          ctx.fillRect(tx + 24, 360, 6, 80);
          ctx.beginPath();
          ctx.ellipse(tx + 13, 350, 30, 22, 0, 0, U.TAU);
          ctx.fill();
        }
      }
    } else if (far.kind === "mesas") {
      for (const m of scene.farPts) {
        const x = m.x - off;
        if (x + m.w < -40 || x > VW + 40) continue;
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.moveTo(x - 20, far.base + 10);
        ctx.lineTo(x + 10, far.base - m.h);
        ctx.lineTo(x + m.w - 10, far.base - m.h);
        ctx.lineTo(x + m.w + 20, far.base + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.fillRect(x + 6, far.base - m.h + 18, m.w - 12, 8);
      }
    } else if (far.kind === "skyline") {
      for (const b of scene.farPts) {
        const x = b.x - off;
        if (x + b.w < -10 || x > VW + 10) continue;
        ctx.fillStyle = c1;
        ctx.fillRect(x, far.base - b.h, b.w, b.h + 10);
        ctx.fillStyle = "rgba(255, 230, 140, 0.55)";
        for (let wy = far.base - b.h + 12; wy < far.base - 10; wy += 18) {
          if ((wy + b.s) % 3 === 0) continue;
          ctx.fillRect(x + 6, wy, b.w - 12, 4);
        }
      }
    } else if (far.kind === "sea") {
      ctx.fillStyle = c1;
      ctx.fillRect(0, 420, VW, 80);
      for (let i = 0; i < 3; i++) {
        const ix = ((i * 700 + 300 - off) % (VW + 600) + VW + 600) % (VW + 600) - 300;
        ctx.fillStyle = "#4fa88a";
        ctx.beginPath();
        ctx.ellipse(ix, 424, 120 + i * 30, 26, 0, Math.PI, U.TAU);
        ctx.fill();
      }
    }
  }

  function drawMid(ctx, scene, off, VW, t) {
    const mid = scene.env.mid;
    ctx.fillStyle = mid.color;
    for (const it of scene.midItems) {
      const x = it.x - off;
      if (x < -120 || x > VW + 120) continue;
      const s = it.s;
      const base = U.HORIZON + 8;
      switch (mid.kind) {
        case "trees":
          ctx.beginPath();
          ctx.arc(x, base - 40 * s, 30 * s, 0, U.TAU);
          ctx.arc(x + 26 * s, base - 30 * s, 24 * s, 0, U.TAU);
          ctx.fill();
          ctx.fillRect(x - 4, base - 20 * s, 8, 20 * s);
          if (it.v > 0.8) {
            ctx.fillStyle = "#b85a52";
            ctx.fillRect(x + 50, base - 46, 50, 46);
            ctx.beginPath();
            ctx.moveTo(x + 44, base - 44);
            ctx.lineTo(x + 75, base - 66);
            ctx.lineTo(x + 106, base - 44);
            ctx.fill();
            ctx.fillStyle = mid.color;
          }
          break;
        case "roofs":
          ctx.fillRect(x, base - 40 * s, 70 * s, 40 * s);
          ctx.beginPath();
          ctx.moveTo(x - 8, base - 38 * s);
          ctx.lineTo(x + 35 * s, base - 64 * s);
          ctx.lineTo(x + 78 * s, base - 38 * s);
          ctx.fill();
          break;
        case "spires":
          ctx.beginPath();
          ctx.moveTo(x - 24 * s, base);
          ctx.lineTo(x - 10 * s, base - 90 * s);
          ctx.lineTo(x + 10 * s, base - 96 * s);
          ctx.lineTo(x + 24 * s, base);
          ctx.fill();
          if (it.v > 0.5) {
            ctx.fillStyle = "#4f9e5a";
            ctx.fillRect(x + 50, base - 50 * s, 10, 50 * s);
            ctx.fillRect(x + 40, base - 34 * s, 30, 7);
            ctx.fillStyle = mid.color;
          }
          break;
        case "towers": {
          const h = 120 + it.v * 140;
          ctx.fillRect(x, base - h, 60 * s + 20, h);
          ctx.fillStyle = "rgba(255, 240, 170, 0.6)";
          for (let wy = base - h + 10; wy < base - 12; wy += 16) {
            for (let wx = 6; wx < 60 * s + 14; wx += 14) {
              if ((wx * 3 + wy + Math.floor(it.v * 10)) % 5 === 0) continue;
              ctx.fillRect(x + wx, wy, 6, 7);
            }
          }
          ctx.fillStyle = mid.color;
          break;
        }
        case "islands":
          if (it.v > 0.6) {
            ctx.beginPath();
            ctx.ellipse(x, base - 30, 60 * s, 14, 0, Math.PI, U.TAU);
            ctx.fill();
            ctx.strokeStyle = mid.color;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(x, base - 40);
            ctx.quadraticCurveTo(x + 4, base - 70, x + 14, base - 80);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x + 14, base - 82, 22, 7, 0.2, 0, U.TAU);
            ctx.fill();
          } else if (it.v < 0.15) {
            // A little sailboat.
            const bx = x + Math.sin(t * 0.5 + it.x) * 8;
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.moveTo(bx, base - 70);
            ctx.lineTo(bx, base - 34);
            ctx.lineTo(bx + 26, base - 34);
            ctx.fill();
            ctx.fillStyle = "#e8463c";
            ctx.fillRect(bx - 18, base - 34, 50, 8);
            ctx.fillStyle = mid.color;
          }
          break;
        default:
          break;
      }
    }
  }

  function drawOcean(ctx, VW, camX, t) {
    const top = U.HORIZON - 20;
    const shore = U.PROP_BASE - 6;
    const g = ctx.createLinearGradient(0, top, 0, shore);
    g.addColorStop(0, "#2b8fc4");
    g.addColorStop(1, "#5fd6e8");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, VW, shore - top);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.5;
    for (let row = 0; row < 3; row++) {
      const y = top + 16 + row * 18;
      ctx.beginPath();
      for (let x = -20; x <= VW + 20; x += 10) {
        const wx = x + camX * (0.6 + row * 0.2);
        const yy = y + Math.sin(wx * 0.03 + t * (1.5 + row * 0.5)) * 3;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Foam where the waves meet the sand.
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.moveTo(0, shore + 6);
    for (let x = 0; x <= VW + 20; x += 20) {
      const wx = x + camX;
      ctx.lineTo(x, shore + Math.sin(wx * 0.02 + t * 2) * 4);
    }
    ctx.lineTo(VW + 20, shore + 10);
    ctx.lineTo(0, shore + 10);
    ctx.fill();
  }

  // In world space: roads, crops, shells.
  function drawGroundDetail(ctx, scene, camX, VW, t) {
    const env = scene.env;
    const x0 = camX - 40;
    const x1 = camX + VW + 40;
    switch (env.detail) {
      case "crops":
        ctx.fillStyle = "rgba(60, 140, 40, 0.35)";
        for (let y = U.FEET_MIN + 6; y < U.VH; y += 26) ctx.fillRect(x0, y, x1 - x0, 7);
        ctx.fillStyle = "#c9a26b";
        ctx.fillRect(x0, 612, x1 - x0, 16);
        break;
      case "street":
        ctx.fillStyle = "#d9d6e2";
        ctx.fillRect(x0, U.PROP_BASE, x1 - x0, 20);
        ctx.fillStyle = "#5c5a6e";
        ctx.fillRect(x0, 600, x1 - x0, 58);
        ctx.fillStyle = "#ffd23f";
        for (let x = Math.floor(x0 / 80) * 80; x < x1; x += 80) ctx.fillRect(x, 626, 40, 5);
        break;
      case "sand":
        ctx.fillStyle = "#d2a368";
        ctx.fillRect(x0, 606, x1 - x0, 34);
        ctx.strokeStyle = "rgba(150, 100, 50, 0.4)";
        ctx.lineWidth = 2;
        break;
      case "road":
        ctx.fillStyle = "#c2c6d4";
        ctx.fillRect(x0, U.PROP_BASE, x1 - x0, 46);
        ctx.strokeStyle = "rgba(80, 80, 100, 0.35)";
        ctx.lineWidth = 2;
        for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, U.PROP_BASE);
          ctx.lineTo(x, U.PROP_BASE + 46);
          ctx.stroke();
        }
        ctx.fillStyle = "#4b4d5e";
        ctx.fillRect(x0, 600, x1 - x0, U.VH - 600);
        ctx.fillStyle = "#fff";
        for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) ctx.fillRect(x, 648, 46, 5);
        for (let x = Math.floor(x0 / 900) * 900 + 450; x < x1; x += 900) {
          for (let i = 0; i < 6; i++) ctx.fillRect(x + i * 16, 604, 9, 112);
        }
        break;
      case "beach":
        ctx.fillStyle = "rgba(240, 200, 120, 0.5)";
        ctx.fillRect(x0, U.PROP_BASE + 2, x1 - x0, 12);
        break;
      default:
        break;
    }
    for (const d of scene.decor) {
      if (d.x < x0 || d.x > x1) continue;
      switch (env.detail) {
        case "crops":
        case "street":
          if (d.y > 598 && d.y < 662 && env.detail === "street") break;
          D.circ(ctx, d.x, d.y, 3.5, d.v > 0.5 ? "#fff" : "#ffd23f", 1.2);
          D.circ(ctx, d.x, d.y, 1.5, "#ff8a3d", 0);
          break;
        case "sand":
          if (d.v > 0.85) {
            ctx.fillStyle = "#3fae5a";
            ctx.fillRect(d.x - 3, d.y - 16, 6, 16);
          } else {
            D.ell(ctx, d.x, d.y, 6 + d.v * 6, 4, "#c9a26b", 1.5);
          }
          break;
        case "beach":
          if (d.v > 0.7) D.star(ctx, d.x, d.y, 8, "#ff8a6b", 1.5, 5, 0.45, d.v * 6);
          else if (d.v > 0.4) D.ell(ctx, d.x, d.y, 5, 4, "#fff4f8", 1.5);
          break;
        default:
          break;
      }
    }
  }

  // A bush for a stranded alien hiding at ground level.
  function drawBush(ctx, x, y, t) {
    const s = Math.sin(t * 2 + x) * 1.5;
    D.circ(ctx, x - 24, y - 16, 20, "#3f9e4a", 3);
    D.circ(ctx, x + 24, y - 16, 20, "#3f9e4a", 3);
    D.circ(ctx, x + s, y - 30, 26, "#4fae5a", 3);
    D.circ(ctx, x - 24, y - 16, 17, "#3f9e4a", 0);
    D.circ(ctx, x + 24, y - 16, 17, "#3f9e4a", 0);
    D.circ(ctx, x + 10 + s, y - 38, 4, "#ff5fb4", 1.5);
    D.circ(ctx, x - 12 + s, y - 22, 4, "#ffd23f", 1.5);
  }

  U.ENVIRONMENTS = ENVIRONMENTS;
  U.ENV_ORDER = ["farm", "suburbia", "desert", "city", "island"];
  U.Scenery = { build, update, drawBackground, drawBush, drawCloud, PROPS };
})(window.UFO);
