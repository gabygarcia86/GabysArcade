/* Each space stage's parallax backdrop. Scenery is painted once into strips that repeat. */
(function (MQ) {
  const { rng, shade, alpha, glow, poly, oval, box, line, makeCanvas, clamp } = MQ.U;
  const { sin, cos, floor, max, min, PI } = Math;
  const TAU = MQ.TAU;
  const VW = 1280;
  const VH = 720;
  const STRIP = 1600;
  const DETAIL = 0.8;

  const wrapPos = (value, size) => ((value % size) + size) % size;

  const STARS = (() => {
    const random = rng(515);
    // x, y, size, and how fast it passes.
    return Array.from({ length: 260 }, () => {
      const depth = random();
      return [random() * VW, random() * VH, 0.8 + depth * depth * 2, 0.03 + depth * depth * 0.4];
    });
  })();

  /* ---------- Strip painters ---------- */

  function repeat(ctx, random, count, draw) {
    for (let i = 0; i < count; i++) {
      const x = ((i + random.range(0.15, 0.85)) * STRIP) / count;
      const seed = floor(random() * 1e9);
      for (const offset of [-STRIP, 0, STRIP]) {
        ctx.save();
        ctx.translate(x + offset, 0);
        draw(rng(seed), i);
        ctx.restore();
      }
    }
  }

  const PAINT = {
    volcanoes(ctx, random, layer) {
      const { color, h } = layer;
      ctx.fillStyle = color;
      ctx.fillRect(0, h - 70, STRIP, 70);
      repeat(ctx, random, 7, (r, i) => {
        const height = r.range(100, h - 40);
        const half = r.range(120, 230);
        const mouth = r.range(14, 30);
        poly(ctx, [-half, h - 60, -mouth, h - height, mouth, h - height, half, h - 60], i % 2 ? color : shade(color, 0.08));
        glow(ctx, 0, h - height, mouth * 3, "#ff7a32", 0.9);
        for (let n = 0; n < 3; n++) {
          let x = r.range(-mouth, mouth);
          let y = h - height;
          while (y < h - 70) {
            const nx = x + r.range(-22, 22);
            const ny = y + r.range(20, 36);
            line(ctx, x, y, nx, ny, "rgba(255,110,45,0.6)", 3);
            x = nx;
            y = ny;
          }
        }
      });
    },

    lavaField(ctx, random, { color, h }) {
      ctx.fillStyle = color;
      ctx.fillRect(0, h * 0.45, STRIP, h * 0.55);
      repeat(ctx, random, 14, (r) => {
        const w = r.range(60, 120);
        poly(ctx, [-w, h * 0.5, -w * 0.3, h * r.range(0.1, 0.3), w * 0.4, h * r.range(0.15, 0.35), w, h * 0.5], color);
        oval(ctx, r.range(-40, 40), h * r.range(0.62, 0.9), r.range(26, 70), r.range(3, 8), "#c8431f");
      });
    },

    convoy(ctx, random, { color, h }) {
      repeat(ctx, random, 4, (r) => {
        ctx.translate(0, r.range(30, h - 30));
        const s = r.range(0.45, 0.9);
        ctx.scale(s, s);
        poly(ctx, [-90, 8, -70, -18, 80, -22, 92, 18, -60, 22], color);
        box(ctx, 0, -34, 44, 12, 2, color);
        for (let i = 0; i < 4; i++) oval(ctx, -40 + i * 30, 2, 2.5, 2.5, "#ff9a5c");
      });
    },

    planet(ctx, random, { h }) {
      const ground = ctx.createLinearGradient(0, 60, 0, h);
      ground.addColorStop(0, "#4f9384");
      ground.addColorStop(0.25, "#245b55");
      ground.addColorStop(1, "#0b2426");
      ctx.beginPath();
      ctx.moveTo(0, h);
      // A whole number of waves, so it tiles.
      for (let x = 0; x <= STRIP; x += 20) ctx.lineTo(x, 70 - sin((x / STRIP) * TAU) * 16);
      ctx.lineTo(STRIP, h);
      ctx.closePath();
      ctx.fillStyle = ground;
      ctx.fill();
      // Glassed plains, and the domes of dead cities.
      repeat(ctx, random, 9, (r, i) => {
        const y = r.range(120, h - 30);
        oval(ctx, 0, y, r.range(50, 140), r.range(8, 20), i % 2 ? "rgba(150,235,215,0.12)" : "rgba(4,20,22,0.4)");
        if (i % 2) return;
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(-40 + j * 28, y, r.range(9, 20), PI, TAU);
          ctx.fillStyle = "#16403d";
          ctx.fill();
          oval(ctx, -40 + j * 28, y - 4, 1.8, 1.8, "#d4a93f");
        }
      });
    },

    stations(ctx, random, { color, h }) {
      repeat(ctx, random, 4, (r, i) => {
        ctx.translate(0, r.range(80, h - 80));
        ctx.rotate(r.range(-0.4, 0.4));
        const radius = r.range(40, 85);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius, radius * 0.45, 0, 0.5, i % 2 ? 4.4 : 5.6);
        ctx.strokeStyle = color;
        ctx.lineWidth = 12;
        ctx.stroke();
        box(ctx, -8, -radius * 0.8, 16, radius * 1.6, 4, color);
        line(ctx, -radius, 0, radius * 0.4, 0, color, 6);
        for (let n = 0; n < 4; n++) box(ctx, r.range(-radius, radius), r.range(-40, 40), r.range(5, 15), r.range(3, 8), 1, color);
        oval(ctx, 0, -radius * 0.5, 2.5, 2.5, "#58d6c2");
      });
    },

    clouds(ctx, random, { color, h }) {
      repeat(ctx, random, 12, (r) => {
        for (let i = 0; i < 5; i++) oval(ctx, (i - 2) * 46, h * 0.5 + r.range(-18, 22), r.range(44, 86), r.range(14, 30), alpha(color, 0.22));
      });
    },

    fleet(ctx, random, { color, h, count, size }) {
      repeat(ctx, random, count, (r) => {
        ctx.translate(0, r.range(60, h - 60));
        const s = r.range(0.6, 1) * size;
        ctx.scale(s, s);
        poly(ctx, [-170, -26, -158, -42, -130, -42, -118, -18, 120, -30, 160, -36, 164, 34, 120, 28, -118, 18, -130, 44, -158, 44, -170, 28], color);
        box(ctx, 50, -48, 56, 22, 3, color);
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = r() > 0.5 ? "rgba(207,232,255,0.8)" : "rgba(255,110,120,0.7)";
          ctx.fillRect(-110 + i * 22, r.range(-8, 10), 5, 2);
        }
        glow(ctx, 166, 0, 34, "#7fb8ff", 0.7);
      });
    },
  };

  /* ---------- The three backdrops ---------- */

  const layer = (paint, color, y, h, parallax, options = {}) => ({ paint, color, y, h, parallax, ...options });

  const SCENES = {
    nevarroOrbit: {
      sky: ["#07040b", "#1c0a14", "#4a1620", "#8f321f"],
      stars: 130,
      layers: [
        layer("convoy", "#32131b", 120, 200, 0.07, { extra: true }),
        layer("volcanoes", "#35141a", 390, 270, 0.16),
        layer("lavaField", "#1c0c10", 550, 170, 0.5),
      ],
    },
    mandaloreOrbit: {
      sky: ["#01060c", "#04121c", "#082730", "#0e3f40"],
      stars: 200,
      layers: [
        layer("stations", "#12333a", 70, 330, 0.09, { extra: true }),
        layer("planet", "", 420, 300, 0.14),
        layer("clouds", "#b9eee2", 470, 120, 0.3),
        layer("clouds", "#1b4a4c", 580, 140, 0.6, { extra: true }),
      ],
    },
    fleet: {
      sky: ["#010107", "#080618", "#150b2c", "#210e36"],
      stars: 260,
      layers: [
        layer("fleet", "#1b1730", 70, 330, 0.05, { count: 5, size: 0.4, extra: true }),
        layer("fleet", "#241d3b", 240, 420, 0.14, { count: 3, size: 0.85 }),
      ],
    },
  };

  /* ---------- What moves ---------- */

  const BEHIND = {
    nevarroOrbit(ctx, scroll, time) {
      glow(ctx, 900, 560, 420, "#ff5a2c", 0.22);
      oval(ctx, 1030, 170, 46, 46, "#3b1a20");
      oval(ctx, 1018, 160, 34, 34, "#4c242a");
    },
    mandaloreOrbit(ctx) {
      glow(ctx, 640, 640, 520, "#58d6c2", 0.16);
      oval(ctx, 250, 150, 26, 26, "#16363c");
    },
    fleet(ctx, scroll, time, options) {
      glow(ctx, 300, 250, 340, "#6a2fb0", 0.22);
      glow(ctx, 980, 480, 300, "#b02f6a", 0.14);
      // Gideon's ship waits in the distance, nearer all the time.
      if (options.progress >= 1) return;
      const s = 0.22 + options.progress * 0.55;
      ctx.save();
      ctx.translate(1080, 300 + sin(time * 0.3) * 6);
      ctx.scale(s, s);
      poly(ctx, [-150, -40, -110, -150, 60, -170, 220, -130, 240, 0, 220, 130, 60, 170, -110, 150, -150, 40, -60, 0], "#191126");
      for (const y of [-100, 0, 100]) oval(ctx, 40, y, 6, 6, "#d24cff");
      glow(ctx, -70, 0, 90, "#d24cff", 0.4 + sin(time * 3) * 0.1);
      ctx.restore();
    },
  };

  const FRONT = {
    nevarroOrbit(ctx, scroll, time) {
      ctx.fillStyle = "#ff9a4c";
      for (let i = 0; i < 34; i++) {
        const x = wrapPos(i * 137 - scroll * (0.4 + (i % 4) * 0.15), VW + 20);
        const y = wrapPos(i * 83 - time * (24 + (i % 5) * 9), 420) + 290;
        ctx.globalAlpha = 0.25 + sin(time * 4 + i) * 0.15;
        ctx.fillRect(x, y, 3, 3);
      }
      ctx.globalAlpha = 1;
    },
    mandaloreOrbit(ctx, scroll, time) {
      // Storms flickering down in the cloud deck.
      for (let i = 0; i < 3; i++) {
        const beat = (time * 0.37 + i / 3) % 1;
        if (beat > 0.05) continue;
        const x = wrapPos((i + floor(time * 0.37 + i / 3)) * 397 - scroll * 0.3, VW);
        glow(ctx, x, 555, 150, "#9fe8ff", 0.5);
        line(ctx, x, 520, x - 14, 552, "rgba(220,250,255,0.8)", 2);
        line(ctx, x - 14, 552, x + 8, 590, "rgba(220,250,255,0.8)", 2);
      }
    },
    fleet(ctx, scroll, time) {
      // The distant battle.
      for (let i = 0; i < 4; i++) {
        const k = (time * 0.4 + i / 4) % 1;
        const n = floor(time * 0.4 + i / 4) + i * 5;
        const x = wrapPos(n * 271, VW);
        const y = 110 + wrapPos(n * 157, 470);
        if (k < 0.18) glow(ctx, x, y, 14 + k * 190, "#ff9b5c", 0.45 * (1 - k / 0.18));
        else if (k < 0.3) line(ctx, x, y, x + (i % 2 ? 120 : -120), y - 18, "rgba(255,90,120,0.28)", 2);
      }
    },
  };

  class SpaceBackground {
    constructor(name) {
      const scene = SCENES[name];
      this.name = name;
      this.scene = scene;
      this.options = { progress: 0, low: false, warp: 0 };
      this.small = null;

      this.sky = makeCanvas(4, 256);
      const g = this.sky.getContext("2d");
      const gradient = g.createLinearGradient(0, 0, 0, 256);
      scene.sky.forEach((color, i) => gradient.addColorStop(i / (scene.sky.length - 1), color));
      g.fillStyle = gradient;
      g.fillRect(0, 0, 4, 256);

      this.strips = scene.layers.map((def, i) => {
        const canvas = makeCanvas(STRIP * DETAIL, def.h * DETAIL);
        const c = canvas.getContext("2d");
        c.scale(DETAIL, DETAIL);
        PAINT[def.paint](c, rng(600 + i * 29 + name.length * 11), def);
        return { def, canvas, pattern: null };
      });
    }

    draw(ctx, scroll, time, options = this.options) {
      ctx.drawImage(this.sky, 0, 0, 4, 256, 0, 0, VW, VH);
      this.drawStars(ctx, scroll, options);
      BEHIND[this.name](ctx, scroll, time, options);
      for (let i = 0; i < this.strips.length; i++) {
        const strip = this.strips[i];
        const { def, canvas } = strip;
        if (options.low && def.extra) continue;
        if (strip.owner !== ctx) {
          strip.owner = ctx;
          strip.pattern = ctx.createPattern(canvas, "repeat-x");
        }
        const offset = wrapPos(scroll * def.parallax, STRIP);
        ctx.save();
        ctx.translate(-offset, def.y);
        ctx.scale(STRIP / canvas.width, def.h / canvas.height);
        ctx.fillStyle = strip.pattern;
        ctx.fillRect((offset * canvas.width) / STRIP, 0, (VW * canvas.width) / STRIP, canvas.height);
        ctx.restore();
      }
      if (!options.low) FRONT[this.name](ctx, scroll, time);
    }

    drawStars(ctx, scroll, options) {
      const count = options.low ? this.scene.stars >> 1 : this.scene.stars;
      const stretch = clamp(options.warp, 0, 1) * 260;
      ctx.fillStyle = "#dbe8ff";
      for (let i = 0; i < count; i++) {
        const [x, y, size, speed] = STARS[i];
        ctx.globalAlpha = min(1, 0.35 + speed * 1.8);
        // Near stars smear out as the ship speeds up.
        ctx.fillRect(wrapPos(x - scroll * speed, VW), y, max(size, stretch * speed), size);
      }
      ctx.globalAlpha = 1;
    }

    thumbnail(ctx, width, height, time) {
      const scale = max(width / VW, height / VH);
      ctx.save();
      ctx.translate((width - VW * scale) / 2, (height - VH * scale) / 2);
      ctx.scale(scale, scale);
      this.draw(ctx, time * 120, time);
      ctx.restore();
    }
  }

  const cache = new Map();

  MQ.SpaceBackground = {
    has: (name) => !!SCENES[name],
    get(name) {
      let background = cache.get(name);
      if (!background) cache.set(name, (background = new SpaceBackground(name)));
      return background;
    },
  };
})(window.MQ);
