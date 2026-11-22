/*
 * Parallax backgrounds. Every level and boss arena has its own scene: a sky, pre-rendered
 * scenery strips and animated effects.
 */
(function (MQ) {
  const { rng, shade, alpha, glow, poly, oval, box, line, makeCanvas, clamp } = MQ.U;
  const { sin, cos, abs, floor, max, PI } = Math;
  const TAU = MQ.TAU;
  const STRIP_W = 1700;
  const STRIP_H = 900;
  const VW = 1280;
  const VH = 720;

  const wrapPos = (value, size) => ((value % size) + size) % size;

  /* ---------- Layer painters ---------- */

  // Repeats each item one strip to the left and right, so the strip tiles seamlessly.
  function scatter(ctx, random, count, draw) {
    for (let i = 0; i < count; i++) {
      const x = ((i + random.range(0.1, 0.9)) * STRIP_W) / count;
      const seed = floor(random() * 1e9);
      for (const offset of [-STRIP_W, 0, STRIP_W]) {
        ctx.save();
        ctx.translate(x + offset, 0);
        draw(rng(seed), i);
        ctx.restore();
      }
    }
  }

  function fillBelow(ctx, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, STRIP_W, STRIP_H - y);
  }

  function ridge(ctx, random, layer, jagged) {
    const steps = jagged ? 34 : 17;
    const heights = Array.from({ length: steps }, () => random.range(0.15, 1) * layer.h);
    heights.push(heights[0]);
    ctx.beginPath();
    ctx.moveTo(0, STRIP_H);
    ctx.lineTo(0, layer.y - heights[0]);
    for (let i = 1; i <= steps; i++) {
      const x = (i * STRIP_W) / steps;
      if (jagged) {
        ctx.lineTo(x, layer.y - heights[i]);
      } else {
        const px = ((i - 1) * STRIP_W) / steps;
        ctx.bezierCurveTo((px + x) / 2, layer.y - heights[i - 1], (px + x) / 2, layer.y - heights[i], x, layer.y - heights[i]);
      }
    }
    ctx.lineTo(STRIP_W, STRIP_H);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, layer.y - layer.h, 0, layer.y + 150);
    gradient.addColorStop(0, shade(layer.color, 0.16));
    gradient.addColorStop(1, shade(layer.color, -0.12));
    ctx.fillStyle = gradient;
    ctx.fill();
    return heights;
  }

  const PAINT = {
    dunes: (ctx, random, layer) => ridge(ctx, random, layer, false),

    peaks(ctx, random, layer) {
      const heights = ridge(ctx, random, layer, true);
      if (!layer.cap) return;
      for (let i = 1; i < heights.length - 1; i++) {
        const h = heights[i];
        if (h < heights[i - 1] || h < heights[i + 1]) continue;
        const step = STRIP_W / (heights.length - 1);
        const x = i * step;
        const top = layer.y - h;
        const k = 0.36;
        poly(ctx, [x, top, x + step * k, top + (h - heights[i + 1]) * k, x + 5, top + 12, x - 6, top + 22, x - step * k, top + (h - heights[i - 1]) * k], layer.cap);
      }
    },

    mesas(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(90, 200);
        const h = r.range(0.45, 1) * layer.h;
        const top = layer.y - h;
        poly(ctx, [-w * 0.7, layer.y + 4, -w * 0.48, top + 10, -w * 0.3, top, w * 0.34, top + 3, w * 0.46, top + 18, w * 0.72, layer.y + 4], layer.color);
        poly(ctx, [w * 0.2, top + 2, w * 0.34, top + 3, w * 0.46, top + 18, w * 0.72, layer.y + 4, w * 0.3, layer.y + 4], shade(layer.color, -0.14));
        for (let i = 1; i < 4; i++) line(ctx, -w * 0.42, top + i * h * 0.2, w * 0.38, top + i * h * 0.2 + 3, shade(layer.color, 0.1), 3);
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    spires(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(26, 70);
        const h = r.range(0.4, 1) * layer.h;
        const top = layer.y - h;
        poly(ctx, [-w, layer.y + 4, -w * 0.5, top + 30, -w * 0.62, top + 12, 0, top, w * 0.55, top + 14, w * 0.4, top + 36, w * 0.95, layer.y + 4], layer.color);
        poly(ctx, [w * 0.1, top + 4, w * 0.55, top + 14, w * 0.4, top + 36, w * 0.95, layer.y + 4, w * 0.3, layer.y + 4], shade(layer.color, -0.15));
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    arches(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(120, 190);
        const h = r.range(0.6, 1) * layer.h;
        const base = layer.y + 4;
        ctx.beginPath();
        ctx.moveTo(-w, base);
        ctx.quadraticCurveTo(-w * 0.8, base - h, 0, base - h);
        ctx.quadraticCurveTo(w * 0.8, base - h, w, base);
        ctx.lineTo(w * 0.55, base);
        ctx.quadraticCurveTo(w * 0.5, base - h * 0.7, 0, base - h * 0.7);
        ctx.quadraticCurveTo(-w * 0.5, base - h * 0.7, -w * 0.5, base);
        ctx.fillStyle = layer.color;
        ctx.fill();
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    volcano(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(220, 360);
        const h = r.range(0.6, 1) * layer.h;
        const top = layer.y - h;
        poly(ctx, [-w, layer.y + 4, -w * 0.18, top, w * 0.16, top, w, layer.y + 4], layer.color);
        line(ctx, 0, top + 4, -14, top + h * 0.3, "#ff6a2a", 5);
        line(ctx, -14, top + h * 0.3, 4, top + h * 0.6, "#c23c1c", 3);
        line(ctx, 14, top + 5, 46, top + h * 0.4, "#c23c1c", 3);
        glow(ctx, 0, top, 90, "#ff7a2a", 0.7);
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    city(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(55, 120);
        const h = r.range(0.35, 1) * layer.h;
        const top = layer.y - h;
        box(ctx, -w / 2, top, w, h + 4, 5, layer.color);
        if (r() > 0.55) oval(ctx, 0, top, w * 0.4, 24, layer.color);
        if (r() > 0.5) line(ctx, w * 0.25, top, w * 0.25, top - r.range(20, 50), layer.color, 3);
        box(ctx, w * 0.24, top + 4, w * 0.22, h, 0, shade(layer.color, -0.15));
        if (!layer.light) return;
        for (let row = 0; row < (h - 30) / 30; row++) {
          for (let col = 0; col < 3; col++) {
            if (r() > 0.68) box(ctx, -w * 0.36 + col * w * 0.22, top + 16 + row * 30, 7, 10, 1, layer.light);
          }
        }
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    domes(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(70, 130);
        const h = r.range(0.4, 1) * layer.h;
        ctx.beginPath();
        ctx.ellipse(0, layer.y - h * 0.35, w / 2, h * 0.6, 0, PI, TAU);
        ctx.lineTo(w / 2, layer.y + 4);
        ctx.lineTo(-w / 2, layer.y + 4);
        ctx.fillStyle = layer.color;
        ctx.fill();
        box(ctx, -8, layer.y - h * 0.3, 16, h * 0.3, 8, shade(layer.color, -0.3));
        if (r() > 0.5) box(ctx, w * 0.5, layer.y - h * 1.2, 16, h * 1.2, 4, shade(layer.color, -0.1));
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    // The shattered domes of Mandalore.
    ruins(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(90, 190);
        const h = r.range(0.5, 1) * layer.h;
        const base = layer.y + 4;
        poly(ctx, [-w / 2, base, -w / 2, base - h * 0.6, -w * 0.3, base - h, -w * 0.12, base - h * 0.75, 0, base - h * 0.85, w * 0.18, base - h * 0.4, w * 0.34, base - h * 0.62, w / 2, base - h * 0.3, w / 2, base], layer.color);
        for (let i = 0; i < 4; i++) line(ctx, -w * 0.4 + i * w * 0.24, base, -w * 0.4 + i * w * 0.24, base - h * r.range(0.2, 0.5), shade(layer.color, 0.12), 3);
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    forest(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const h = r.range(0.5, 1) * layer.h;
        const w = h * 0.3;
        const base = layer.y + 8;
        box(ctx, -5, base - h * 0.7, 10, h * 0.7, 0, shade(layer.color, -0.2));
        for (let i = 0; i < 5; i++) {
          const y = base - h * 0.18 - i * h * 0.16;
          const s = w * (1 - i * 0.15);
          poly(ctx, [-s, y, -s * 0.2, y - h * 0.12, 0, y - h * 0.28, s * 0.2, y - h * 0.12, s, y, 0, y - h * 0.05], layer.color);
          if (layer.cap) poly(ctx, [-s * 0.5, y - h * 0.09, 0, y - h * 0.28, s * 0.3, y - h * 0.12], layer.cap);
        }
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    giantTrees(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const h = r.range(0.6, 1) * layer.h;
        const base = layer.y + 8;
        const top = base - h;
        poly(ctx, [-34, base, -16, base - 50, -11, top, 11, top, 17, base - 60, 40, base], layer.color);
        line(ctx, 0, base - h * 0.55, r.range(-110, -50), base - h * 0.75, layer.color, 12);
        line(ctx, 0, base - h * 0.65, r.range(50, 110), base - h * 0.85, layer.color, 10);
        for (let i = 0; i < 7; i++) oval(ctx, r.range(-100, 100), top + r.range(-30, 60), r.range(40, 75), r.range(22, 40), layer.cap || layer.color);
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    pillars(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(30, 62);
        poly(ctx, [-w, 0, -w * 0.35, 120, -w * 0.4, layer.y - 80, -w, layer.y + 4, w, layer.y + 4, w * 0.4, layer.y - 80, w * 0.35, 120, w, 0], layer.color);
        line(ctx, w * 0.1, 130, w * 0.12, layer.y - 90, shade(layer.color, -0.2), 5);
        if (layer.light && r() > 0.4) {
          const y = r.range(200, layer.y - 120);
          poly(ctx, [0, y - 10, 7, y, 0, y + 10, -7, y], layer.light);
          glow(ctx, 0, y, 36, layer.light, 0.5);
        }
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    // Hangs from the ceiling.
    stalactites(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(22, 64);
        const h = r.range(0.3, 1) * layer.h;
        poly(ctx, [-w, -2, -w * 0.3, h * 0.5, 0, h, w * 0.35, h * 0.45, w, -2], layer.color);
        poly(ctx, [w * 0.1, 0, 0, h, w * 0.35, h * 0.45, w, -2], shade(layer.color, -0.15));
      });
    },

    crystals(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        for (let i = 0; i < 4; i++) {
          const h = r.range(0.3, 1) * layer.h;
          const x = (i - 1.5) * 22;
          const tilt = (i - 1.5) * 12;
          poly(ctx, [x - 11, layer.y + 4, x + tilt - 7, layer.y - h + 14, x + tilt, layer.y - h, x + tilt + 7, layer.y - h + 14, x + 11, layer.y + 4], i % 2 ? layer.light : shade(layer.light, -0.45));
        }
        glow(ctx, 0, layer.y - layer.h * 0.4, 100, layer.light, 0.28);
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    ribs(ctx, random, layer) {
      scatter(ctx, random, layer.n, () => {
        poly(ctx, [-42, 0, 10, 0, 34, 70, 34, layer.y - 70, 10, layer.y + 4, -42, layer.y + 4, -12, layer.y - 80, -12, 80], layer.color);
        box(ctx, 8, 100, 6, layer.y - 200, 2, shade(layer.color, 0.18));
        if (layer.light) {
          for (let y = 130; y < layer.y - 120; y += 90) {
            box(ctx, -6, y, 8, 24, 2, layer.light);
            glow(ctx, -2, y + 12, 26, layer.light, 0.4);
          }
        }
      });
      box(ctx, 0, 0, STRIP_W, 34, 0, shade(layer.color, -0.15));
      fillBelow(ctx, layer.y, layer.color);
    },

    machinery(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r, i) => {
        const w = r.range(60, 120);
        const h = r.range(0.4, 1) * layer.h;
        const top = layer.y - h;
        box(ctx, -w / 2, top, w, h + 4, 8, layer.color);
        for (let y = top + 18; y < layer.y - 12; y += 34) box(ctx, -w / 2, y, w, 6, 0, shade(layer.color, -0.2));
        line(ctx, w / 2, top + 24, w + 20, top + 24, layer.color, 12);
        if (i % 2) {
          box(ctx, -5, top + 10, 10, h * 0.5, 4, layer.light);
          glow(ctx, 0, top + 10 + h * 0.25, 60, layer.light, 0.4);
        }
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    citadel(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const w = r.range(50, 100);
        const h = r.range(0.4, 1) * layer.h;
        const top = layer.y - h;
        poly(ctx, [-w, layer.y + 4, -w * 0.5, top + 70, -w * 0.5, top + 24, -w * 0.2, top + 24, 0, top, w * 0.2, top + 24, w * 0.5, top + 24, w * 0.5, top + 70, w, layer.y + 4], layer.color);
        line(ctx, 0, top + 34, 0, top + h * 0.55, layer.light, 4);
        glow(ctx, 0, top + 40, 40, layer.light, 0.4);
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    bones(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r) => {
        const h = r.range(0.6, 1) * layer.h;
        ctx.strokeStyle = layer.color;
        ctx.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          const x = (i - 2) * 54;
          const s = h * (1 - abs(i - 2) * 0.17);
          ctx.lineWidth = 17 - abs(i - 2) * 2;
          ctx.beginPath();
          ctx.moveTo(x, layer.y + 8);
          ctx.quadraticCurveTo(x - 60, layer.y - s * 0.8, x + 30, layer.y - s);
          ctx.stroke();
        }
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    // Giant carved mythosaur skull of the sanctuary.
    skull(ctx, random, layer) {
      scatter(ctx, random, layer.n, () => {
        ctx.translate(0, layer.y - layer.h * 0.55);
        ctx.scale(layer.h / 400, layer.h / 400);
        const c = layer.color;
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.scale(side, 1);
          ctx.beginPath();
          ctx.moveTo(60, -30);
          ctx.bezierCurveTo(230, -40, 250, 160, 120, 210);
          ctx.bezierCurveTo(190, 110, 160, 30, 60, 34);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.restore();
        }
        poly(ctx, [-90, -90, -50, -140, 0, -156, 50, -140, 90, -90, 78, 20, 40, 70, 30, 150, -30, 150, -40, 70, -78, 20], c);
        for (const side of [-1, 1]) {
          poly(ctx, [side * 16, -30, side * 62, -50, side * 56, 0, side * 22, 4], "#0a1418");
          glow(ctx, side * 38, -22, 34, layer.light, 0.8);
        }
        poly(ctx, [0, 30, 14, 70, -14, 70], "#0a1418");
      });
      fillBelow(ctx, layer.y, layer.color);
    },

    hangar(ctx, random, layer) {
      scatter(ctx, random, layer.n, (r, i) => {
        poly(ctx, [-190, layer.y + 4, -190, 170, -120, 100, 120, 100, 190, 170, 190, layer.y + 4], layer.color);
        poly(ctx, [-150, layer.y + 4, -150, 190, -104, 144, 104, 144, 150, 190, 150, layer.y + 4], shade(layer.color, -0.35));
        ctx.save();
        ctx.translate(0, i % 2 ? 260 : 330);
        MQ.VehicleArt.draw(ctx, "fighter");
        ctx.restore();
        for (const x of [-170, 170]) {
          box(ctx, x - 3, 200, 6, 90, 2, layer.light);
          glow(ctx, x, 245, 40, layer.light, 0.35);
        }
      });
      fillBelow(ctx, layer.y, layer.color);
    },
  };

  /* ---------- Scenes ---------- */

  const layer = (paint, color, y, h, n, parallax, extra) => ({ paint, color, y, h, n, parallax, ...extra });

  const SCENES = {
    arvala: {
      sky: ["#2c2348", "#9a4f5c", "#eea264", "#f6cf94"],
      layers: [layer("mesas", "#a4644f", 460, 180, 9, 0.08), layer("spires", "#7c4639", 540, 190, 11, 0.2), layer("dunes", "#5c3128", 645, 90, 0, 0.38)],
      fx: [["sun", 930, 230, 48, "#ffe3a6"], ["planet", 270, 150, 34, "#7d5a78"], ["clouds", "#d98a6a", 4, 0.25], ["dust", "#f6cf94"]],
      front: [["haze", "#eea264", 0.07]],
    },
    canyon: {
      sky: ["#3d6c98", "#86aeb8", "#e6cfa4", "#eec188"],
      layers: [layer("spires", "#b48b6b", 470, 260, 10, 0.07), layer("arches", "#93603f", 545, 250, 4, 0.18), layer("mesas", "#6b3d2c", 650, 200, 7, 0.36)],
      fx: [["sun", 260, 160, 40, "#fff3c8"], ["clouds", "#f1e3cf", 6, 0.4], ["birds", "#4a3328"], ["dust", "#eec188"]],
    },
    nevarro: {
      sky: ["#140d1c", "#3b1a28", "#86302a", "#c4562c"],
      layers: [layer("volcano", "#33202a", 470, 260, 3, 0.05), layer("city", "#2a1b22", 550, 190, 17, 0.17, { light: "#ffad4d" }), layer("city", "#170f15", 680, 240, 9, 0.36, { light: "#ff6a3d" })],
      fx: [["smoke", "#4a3038"], ["embers", "#ff8a3d"]],
      front: [["haze", "#ff5a2a", 0.05], ["ash"]],
    },
    wilds: {
      sky: ["#14302f", "#376056", "#8ca37c", "#c9a96a"],
      layers: [layer("volcano", "#3f5c52", 450, 220, 3, 0.05), layer("forest", "#2b4a3d", 570, 190, 22, 0.16, { cap: "#35584a" }), layer("giantTrees", "#132721", 700, 470, 6, 0.36, { cap: "#183229" })],
      fx: [["clouds", "#7d9a84", 4, 0.22], ["smoke", "#40564c"], ["fireflies", "#d9ff8a"]],
    },
    tatooine: {
      sky: ["#3f86bd", "#8fbfd0", "#efd9a4", "#f4c98a"],
      layers: [layer("dunes", "#d9b27a", 450, 80, 0, 0.06), layer("domes", "#c0925e", 520, 80, 12, 0.16), layer("dunes", "#9c6c42", 640, 120, 0, 0.34)],
      fx: [["sun", 920, 150, 44, "#fffbe0"], ["sun", 1030, 205, 30, "#ffc07a"], ["crawler", "#a57850"], ["dust", "#fff0c8"]],
      front: [["sandstorm", "#f4d7a0"]],
    },
    mandalore: {
      sky: ["#0c1a1c", "#1c3a37", "#3b5f50", "#58705a"],
      layers: [layer("ruins", "#2b4a44", 450, 230, 10, 0.07), layer("pillars", "#1a2f2d", 620, 0, 5, 0.18, { light: "#58d6c2" }), layer("stalactites", "#0d1a19", 0, 220, 16, 0.34, { top: true }), layer("ruins", "#0e1d1b", 715, 200, 7, 0.36)],
      fx: [["shafts", "#9fd8b8"], ["embers", "#ff9a3d"]],
    },
    sanctuary: {
      sky: ["#061019", "#0c2836", "#154555", "#1d5f68"],
      layers: [layer("pillars", "#12323e", 520, 0, 7, 0.08, { light: "#58d6c2" }), layer("crystals", "#0b232d", 640, 170, 7, 0.2, { light: "#3fb8c9" }), layer("stalactites", "#061219", 0, 250, 14, 0.36, { top: true })],
      fx: [["shafts", "#8fe8e0"], ["waterfalls", "#7fd4e8"], ["fireflies", "#8ff7e8"]],
    },
    fortress: {
      sky: ["#1b2a40", "#4b6a88", "#93aec4", "#c8d8e2"],
      layers: [layer("peaks", "#7890a8", 480, 250, 0, 0.06, { cap: "#e6eef5" }), layer("citadel", "#44566b", 570, 260, 6, 0.17, { light: "#ff5348" }), layer("forest", "#26364a", 690, 190, 13, 0.36, { cap: "#8fa6ba" })],
      fx: [["clouds", "#aec2d2", 5, 0.35], ["ship", "cruiser", 300, 130, 0.45]],
      front: [["snow"]],
    },
    starship: {
      sky: ["#02030a", "#0a0d22", "#151230", "#24163a"],
      layers: [layer("ribs", "#161b27", 700, 0, 5, 0.12, { light: "#6fb8ff" }), layer("machinery", "#0e121b", 720, 260, 9, 0.3, { light: "#b04cff" })],
      fx: [["stars"], ["planet", 900, 300, 190, "#3a5a8c"], ["ship", "fighter", 180, 150, 0.8], ["ship", "cruiser", 700, 420, 0.3]],
      top: [["sparks"], ["pulse", "#b04cff"]],
    },
    storm: {
      sky: ["#0c0a18", "#221a3a", "#43305c", "#5a3a5e"],
      layers: [layer("peaks", "#2a1f3e", 500, 200, 0, 0.06), layer("citadel", "#1d1630", 590, 330, 7, 0.17, { light: "#d24cff" }), layer("spires", "#0f0b1c", 700, 240, 9, 0.36)],
      fx: [["planet", 980, 170, 80, "#4c2f5e"], ["lightning", "#e0b8ff"], ["clouds", "#352648", 8, 0.6]],
      front: [["rain"]],
    },

    // Boss arenas
    mudhornDen: {
      sky: ["#3a2230", "#8c4433", "#d9863f", "#f0b45c"],
      layers: [layer("spires", "#7c3f2c", 470, 320, 8, 0.06), layer("bones", "#c59a6a", 560, 190, 3, 0.18), layer("mesas", "#3f2119", 700, 170, 8, 0.34)],
      fx: [["sun", 640, 280, 90, "#ffd08a"], ["dust", "#f6cf94"]],
      front: [["sandstorm", "#e0a868"]],
    },
    nest: {
      sky: ["#1a0f14", "#4a1c1c", "#a8401f", "#e0752c"],
      layers: [layer("volcano", "#3a1a18", 480, 340, 2, 0.05), layer("spires", "#241114", 570, 300, 9, 0.18), layer("bones", "#5a3a30", 705, 160, 4, 0.34)],
      fx: [["smoke", "#4a2522"], ["birds", "#12080a"], ["embers", "#ffb04d"]],
      front: [["ash"]],
    },
    kraytPit: {
      sky: ["#140b07", "#3a1e10", "#7a3a18", "#b35a22"],
      layers: [layer("pillars", "#3a2114", 540, 0, 5, 0.08, { light: "#ff8a3d" }), layer("bones", "#8a6444", 600, 260, 3, 0.18), layer("stalactites", "#170d08", 0, 230, 18, 0.34, { top: true })],
      fx: [["embers", "#ffb04d"], ["dust", "#e0a868"]],
    },
    sanctum: {
      sky: ["#04090e", "#0b2229", "#123c40", "#1a5552"],
      layers: [layer("skull", "#1f4a4c", 520, 420, 1, 0.07, { light: "#58d6c2" }), layer("pillars", "#0c242a", 680, 0, 4, 0.2, { light: "#d4a93f" }), layer("stalactites", "#040b0e", 0, 170, 18, 0.34, { top: true })],
      fx: [["shafts", "#8fe8e0"], ["fireflies", "#ffd98a"]],
    },
    hangarBay: {
      sky: ["#0d1118", "#1c2530", "#33404e", "#4b5a6a"],
      layers: [layer("hangar", "#2a3440", 560, 0, 3, 0.1, { light: "#ff5348" }), layer("machinery", "#141a22", 715, 160, 10, 0.3, { light: "#ff5348" })],
      fx: [],
      top: [["pulse", "#ff3a30"], ["sparks"]],
      front: [["snow"]],
    },
    throne: {
      sky: ["#05040c", "#170f28", "#2f1a44", "#47204c"],
      layers: [layer("ribs", "#120c20", 690, 0, 4, 0.12, { light: "#d24cff" }), layer("machinery", "#0a0714", 720, 190, 8, 0.28, { light: "#ff3a5a" })],
      fx: [["stars"], ["lightning", "#e0b8ff"]],
      top: [["starmap", "#b98cff"], ["pulse", "#d24cff"]],
    },

    // Cinematics and menus
    space: {
      sky: ["#01020a", "#070b1e", "#11142c", "#1a1634"],
      layers: [],
      fx: [["nebula"], ["stars"], ["planet", 1060, 180, 70, "#8c5a44"], ["planet", 230, 520, 26, "#4d7c8c"]],
    },
    galaxy: {
      sky: ["#01020a", "#060a1c", "#0d1128", "#15122e"],
      layers: [],
      fx: [["nebula"], ["stars"], ["spiral"]],
    },
  };

  /* ---------- Animated effects. c is the camera's horizontal position. ---------- */

  const STARS = (() => {
    const random = rng(99);
    return Array.from({ length: 210 }, () => [random() * VW, random() * VH, random.range(0.5, 1.9), random() * TAU]);
  })();

  const FX = {
    stars(ctx, f, t, c) {
      for (const [x, y, size, phase] of STARS) {
        ctx.globalAlpha = 0.55 + sin(t * 2 + phase) * 0.4;
        ctx.fillStyle = size > 1.6 ? "#ffe9b8" : "#dbe8ff";
        ctx.fillRect(wrapPos(x - c * 0.01 * size, VW), y, size, size);
      }
      ctx.globalAlpha = 1;
    },
    nebula(ctx, f, t) {
      glow(ctx, 280 + sin(t * 0.1) * 30, 190, 420, "#2b3f8c", 0.3);
      glow(ctx, 940, 480 + cos(t * 0.12) * 24, 460, "#5c2470", 0.26);
      glow(ctx, 700, 120, 260, "#8c4a2b", 0.14);
    },
    spiral(ctx, f, t) {
      ctx.save();
      ctx.translate(640, 360);
      ctx.scale(1, 0.48);
      ctx.rotate(t * 0.025);
      for (let arm = 0; arm < 4; arm++) {
        for (let i = 2; i < 34; i++) {
          const a = arm * (PI / 2) + i * 0.16;
          const r = i * 18;
          glow(ctx, cos(a) * r, sin(a) * r, 20 + i, i % 5 ? "#4f6fc9" : "#c98cff", 0.13);
        }
      }
      glow(ctx, 0, 0, 150, "#ffd9a0", 0.5);
      ctx.restore();
    },
    sun(ctx, [, x, y, r, color], t, c) {
      const sx = x - c * 0.012;
      glow(ctx, sx, y, r * 4.2, color, 0.6 + sin(t) * 0.05);
      oval(ctx, sx, y, r, r, color);
    },
    planet(ctx, [, x, y, r, color], t, c) {
      const sx = x - c * 0.015;
      glow(ctx, sx, y, r * 1.7, color, 0.35);
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, y, r, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.clip();
      for (let i = 0; i < 5; i++) oval(ctx, sx + sin(i * 2.1) * r * 0.4, y - r * 0.8 + i * r * 0.4, r * 1.1, r * 0.1, shade(color, i % 2 ? 0.16 : -0.15));
      oval(ctx, sx + r * 0.6, y + r * 0.35, r * 1.15, r * 1.15, "rgba(0,0,0,0.38)");
      ctx.restore();
    },
    clouds(ctx, [, color, count, speed], t, c) {
      for (let i = 0; i < count; i++) {
        const x = wrapPos(i * 383 + t * speed * (30 + i * 5) - c * 0.04, VW + 500) - 250;
        const y = 70 + ((i * 97) % 220);
        ctx.globalAlpha = 0.28;
        oval(ctx, x, y, 150, 22, color);
        oval(ctx, x + 40, y - 14, 80, 26, color);
        oval(ctx, x - 60, y - 6, 60, 18, color);
      }
      ctx.globalAlpha = 1;
    },
    birds(ctx, [, color], t, c) {
      for (let i = 0; i < 6; i++) {
        const x = wrapPos(i * 230 + t * 46 - c * 0.05, VW + 100) - 50;
        const y = 130 + ((i * 71) % 170) + sin(t + i) * 14;
        const flap = sin(t * 7 + i) * 7;
        line(ctx, x - 11, y - flap, x, y, color, 3);
        line(ctx, x, y, x + 11, y - flap, color, 3);
      }
    },
    dust(ctx, [, color], t, c) {
      ctx.fillStyle = alpha(color, 0.5);
      for (let i = 0; i < 46; i++) {
        ctx.fillRect(wrapPos(i * 137 + t * (20 + (i % 7) * 9) - c * 0.2, VW), wrapPos(i * 83 + sin(t + i) * 20, VH), 2 + (i % 3), 1.5);
      }
    },
    embers(ctx, [, color], t, c) {
      for (let i = 0; i < 40; i++) {
        const x = wrapPos(i * 173 + sin(t * 1.3 + i) * 30 - c * 0.22, VW);
        const y = wrapPos(i * 91 - t * (30 + (i % 5) * 16), VH);
        oval(ctx, x, y, 1.4 + (i % 3) * 0.6, 1.4 + (i % 3) * 0.6, color);
        if (i % 4 === 0) glow(ctx, x, y, 11, color, 0.5);
      }
    },
    smoke(ctx, [, color], t, c) {
      for (let i = 0; i < 4; i++) {
        const bx = wrapPos(i * 390 + 120 - c * 0.07, VW + 300) - 150;
        for (let j = 0; j < 6; j++) {
          const k = (t * 0.06 + j / 6 + i * 0.13) % 1;
          ctx.globalAlpha = 0.3 * (1 - k);
          oval(ctx, bx + k * 110 + sin(k * 9) * 12, 440 - k * 400, 18 + k * 62, 14 + k * 44, color);
        }
      }
      ctx.globalAlpha = 1;
    },
    fireflies(ctx, [, color], t, c) {
      for (let i = 0; i < 24; i++) {
        glow(ctx, wrapPos(i * 211 + sin(t * 0.5 + i) * 50 - c * 0.18, VW), wrapPos(i * 127 + cos(t * 0.4 + i) * 40, VH), 9, color, 0.45 + sin(t * 3 + i) * 0.35);
      }
    },
    shafts(ctx, [, color], t, c) {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const x = wrapPos(i * 470 + 100 - c * 0.06, VW + 300) - 150;
        poly(ctx, [x - 30, 0, x + 30, 0, x + 190, VH, x + 20, VH], alpha(color, 0.04 + (sin(t * 0.8 + i) + 1) * 0.015));
      }
      ctx.globalCompositeOperation = "source-over";
    },
    waterfalls(ctx, [, color], t, c) {
      for (let i = 0; i < 3; i++) {
        const x = wrapPos(i * 520 + 250 - c * 0.1, VW + 200) - 100;
        ctx.fillStyle = alpha(color, 0.16);
        ctx.fillRect(x - 20, 0, 40, 600);
        for (let j = 0; j < 9; j++) line(ctx, x - 16 + j * 4, (t * 300 + j * 97) % 570, x - 16 + j * 4, ((t * 300 + j * 97) % 570) + 30, alpha(color, 0.4), 2);
        glow(ctx, x, 600, 80, color, 0.3);
      }
    },
    crawler(ctx, [, color], t, c) {
      ctx.save();
      ctx.translate(wrapPos(900 - t * 7 - c * 0.08, VW + 500) - 250, 478);
      ctx.scale(0.4, 0.4);
      ctx.globalAlpha = 0.55;
      MQ.VehicleArt.draw(ctx, "crawler");
      ctx.restore();
    },
    ship(ctx, [, kind, x, y, scale], t, c) {
      ctx.save();
      ctx.translate(wrapPos(x + t * 24 * scale - c * 0.03, VW + 400) - 200, y + sin(t * 0.7) * 6);
      ctx.scale(scale, scale);
      MQ.VehicleArt.draw(ctx, kind, t);
      ctx.restore();
    },
    lightning(ctx, [, color], t) {
      const cycle = floor(t / 2.7);
      const k = t / 2.7 - cycle;
      if (k > 0.13) return;
      const random = rng(cycle * 77 + 3);
      let x = random.range(100, 1180);
      let y = 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < 480) {
        x += random.range(-45, 45);
        y += random.range(30, 70);
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - k / 0.13;
      ctx.stroke();
      glow(ctx, x, 180, 360, color, 0.4);
      ctx.globalAlpha = 1;
    },
    sparks(ctx, f, t, c) {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.9 + i * 0.27) % 1;
        if (k > 0.45) continue;
        const x = wrapPos(i * 370 + floor(t * 0.9 + i * 0.27) * 131 - c * 0.3, VW);
        const y = 150 + ((i * 163) % 300);
        for (let j = 0; j < 7; j++) {
          const sx = x + (j - 3) * k * 90;
          const sy = y + k * k * 600 - ((j * 13) % 40) * k;
          line(ctx, sx, sy, sx - (j - 3) * 2, sy - 8, "#ffd98a", 1.6);
        }
      }
    },
    pulse(ctx, [, color], t, c) {
      for (let i = 0; i < 5; i++) {
        glow(ctx, wrapPos(i * 310 + 90 - c * 0.2, VW + 200) - 100, 560, 110, color, 0.12 + max(0, sin(t * 3 + i * 1.3)) * 0.25);
      }
    },
    starmap(ctx, [, color], t) {
      ctx.save();
      ctx.translate(640, 290);
      ctx.scale(1, 0.62);
      glow(ctx, 0, 0, 280, color, 0.35 + sin(t * 2) * 0.08);
      ctx.strokeStyle = alpha(color, 0.55);
      ctx.lineWidth = 2;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, i * 70, t * 0.3 * (i % 2 ? 1 : -1), t * 0.3 * (i % 2 ? 1 : -1) + TAU * 0.8);
        ctx.stroke();
        for (let j = 0; j < i * 3; j++) {
          const a = t * 0.2 * (i % 2 ? 1 : -1) + (j * TAU) / (i * 3);
          oval(ctx, cos(a) * i * 70, sin(a) * i * 70, 4, 4, color);
        }
      }
      ctx.restore();
    },
    sandstorm(ctx, [, color], t, c) {
      ctx.strokeStyle = alpha(color, 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 34; i++) {
        const x = wrapPos(i * 197 + t * (330 + (i % 5) * 70) - c, VW + 160) - 80;
        const y = wrapPos(i * 89 + t * 18, VH);
        ctx.moveTo(x, y);
        ctx.lineTo(x - 34 - (i % 4) * 12, y - 3);
      }
      ctx.stroke();
    },
    snow(ctx, f, t, c) {
      ctx.fillStyle = "rgba(240,248,255,0.8)";
      for (let i = 0; i < 90; i++) {
        const size = 1.5 + (i % 4);
        ctx.fillRect(wrapPos(i * 149 + t * (50 + (i % 6) * 22) - c * (0.5 + (i % 3) * 0.3), VW), wrapPos(i * 67 + t * (55 + (i % 5) * 24), VH), size, size);
      }
    },
    ash(ctx, f, t, c) {
      ctx.fillStyle = "rgba(190,165,160,0.45)";
      for (let i = 0; i < 40; i++) ctx.fillRect(wrapPos(i * 163 + t * 25 - c * 0.6, VW), wrapPos(i * 79 + t * (28 + (i % 4) * 10), VH), 2 + (i % 2), 2 + (i % 3));
    },
    rain(ctx, f, t, c) {
      ctx.strokeStyle = "rgba(190,180,230,0.28)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 80; i++) {
        const x = wrapPos(i * 113 - t * 190 - c * 0.7, VW + 40);
        const y = wrapPos(i * 59 + t * (820 + (i % 4) * 90), VH + 40);
        ctx.moveTo(x, y);
        ctx.lineTo(x - 7, y + 28);
      }
      ctx.stroke();
    },
    haze(ctx, [, color, opacity]) {
      ctx.fillStyle = alpha(color, opacity);
      ctx.fillRect(0, 0, VW, VH);
    },
  };

  class Background {
    constructor(name, scale = 0.85) {
      const scene = SCENES[name];
      this.name = name;
      this.scene = scene;
      this.sky = makeCanvas(4, 256);
      const g = this.sky.getContext("2d");
      const gradient = g.createLinearGradient(0, 0, 0, 256);
      scene.sky.forEach((color, i) => gradient.addColorStop([0, 0.36, 0.66, 1][i], color));
      g.fillStyle = gradient;
      g.fillRect(0, 0, 4, 256);

      this.strips = scene.layers.map((def, i) => {
        const canvas = makeCanvas(STRIP_W * scale, STRIP_H * scale);
        const c = canvas.getContext("2d");
        c.scale(scale, scale);
        PAINT[def.paint](c, rng(1000 + i * 31 + name.length * 7), def);
        return { canvas, def, below: def.paint === "dunes" || def.paint === "peaks" ? shade(def.color, -0.12) : def.color };
      });
    }

    // rise is how far the camera has climbed above the bottom of the level.
    draw(ctx, camX, rise, time) {
      ctx.drawImage(this.sky, 0, 0, 4, 256, 0, 0, VW, VH);
      for (const f of this.scene.fx) FX[f[0]](ctx, f, time, camX);
      for (const { canvas, def, below } of this.strips) {
        const offsetY = def.top ? clamp(rise * def.parallax * 0.15 - 30, -60, 0) : clamp(rise * def.parallax * 0.4, 0, 230);
        for (let x = -wrapPos(camX * def.parallax, STRIP_W); x < VW; x += STRIP_W) {
          ctx.drawImage(canvas, x, offsetY, STRIP_W + 1, STRIP_H);
        }
        if (!def.top && offsetY + STRIP_H < VH) {
          ctx.fillStyle = below;
          ctx.fillRect(0, offsetY + STRIP_H, VW, VH);
        }
      }
      if (this.scene.top) for (const f of this.scene.top) FX[f[0]](ctx, f, time, camX);
    }

    drawFront(ctx, camX, time) {
      if (this.scene.front) for (const f of this.scene.front) FX[f[0]](ctx, f, time, camX);
    }
  }

  // Keeps the few most recent scenes, so cinematics and arenas don't re-render.
  const cache = new Map();
  function get(name) {
    let background = cache.get(name);
    if (background) cache.delete(name);
    else background = new Background(name);
    cache.set(name, background);
    if (cache.size > 4) cache.delete(cache.keys().next().value);
    return background;
  }

  MQ.Backgrounds = { get, SCENES };
})(window.MQ);
