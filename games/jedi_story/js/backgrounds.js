/*
 * Parallax backdrops. Each planet is built once into seamless strips, then scrolled
 * at different speeds. Weather and moving details are drawn live on top.
 */
(function (J) {
  const { rng, makeCanvas, clamp } = J.U;
  const TAU = J.TAU;
  const STRIP = 1600;

  function sky(stops) {
    const canvas = makeCanvas(4, J.VIEW_H);
    const c = canvas.getContext("2d");
    const g = c.createLinearGradient(0, 0, 0, J.VIEW_H);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    c.fillStyle = g;
    c.fillRect(0, 0, 4, J.VIEW_H);
    return canvas;
  }

  // Draws into a strip so anything crossing the seam shows up on both ends.
  function strip(draw, seed) {
    const canvas = makeCanvas(STRIP, J.VIEW_H);
    const c = canvas.getContext("2d");
    const r = rng(seed);
    const wrap = (fn) => {
      for (const dx of [-STRIP, 0, STRIP]) {
        c.save();
        c.translate(dx, 0);
        fn();
        c.restore();
      }
    };
    draw(c, r, wrap);
    return canvas;
  }

  const stars = (c, r, count, maxY) => {
    for (let i = 0; i < count; i++) {
      c.fillStyle = `rgba(255,255,255,${r.range(0.25, 0.95)})`;
      const s = r.range(0.6, 1.9);
      c.fillRect(r() * STRIP, r() * maxY, s, s);
    }
  };

  function ridge(c, r, y, amp, color, step = 60) {
    const points = [];
    const n = Math.round(STRIP / step);
    for (let i = 0; i <= n; i++) points.push(r.range(-amp, amp));
    points[n] = points[0];
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, J.VIEW_H);
    points.forEach((p, i) => c.lineTo(i * (STRIP / n), y + p));
    c.lineTo(STRIP, J.VIEW_H);
    c.closePath();
    c.fill();
  }

  function towers(c, r, wrap, { count, minH, maxH, wMin, wMax, color, windows, base = J.VIEW_H, win = 0.5 }) {
    const list = [];
    for (let i = 0; i < count; i++) list.push([r() * STRIP, r.range(minH, maxH), r.range(wMin, wMax), r() * 3]);
    wrap(() => {
      for (const [x, h, w, kind] of list) {
        const y = base - h;
        c.fillStyle = color;
        c.fillRect(x, y, w, h);
        if (kind > 2) {
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + w / 2, y - h * 0.16);
          c.lineTo(x + w, y);
          c.fill();
        } else if (kind > 1) {
          c.fillRect(x + w * 0.3, y - 26, w * 0.4, 26);
          c.fillRect(x + w / 2 - 1, y - 58, 2, 34);
        }
        if (windows) {
          const sub = rng(Math.floor(x * 13));
          c.fillStyle = windows;
          for (let wy = y + 8; wy < base - 8; wy += 11) {
            for (let wx = x + 4; wx < x + w - 6; wx += 8) {
              if (sub() < win) c.fillRect(wx, wy, 3, 5);
            }
          }
        }
      }
    });
  }

  function giantTrees(c, r, wrap, { count, wMin, wMax, color, bark, top = 0 }) {
    const list = [];
    for (let i = 0; i < count; i++) list.push([r() * STRIP, r.range(wMin, wMax)]);
    wrap(() => {
      for (const [x, w] of list) {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(x - w * 0.8, J.VIEW_H);
        c.quadraticCurveTo(x, J.VIEW_H - 120, x + w * 0.14, top);
        c.lineTo(x + w * 0.86, top);
        c.quadraticCurveTo(x + w, J.VIEW_H - 120, x + w * 1.8, J.VIEW_H);
        c.closePath();
        c.fill();
        c.strokeStyle = bark;
        c.lineWidth = 2;
        for (let k = 1; k < 4; k++) {
          c.beginPath();
          c.moveTo(x + (w * k) / 4, top);
          c.lineTo(x + (w * k) / 4 + 4, J.VIEW_H);
          c.stroke();
        }
      }
    });
  }

  function disc(c, x, y, radius, inner, outer, glow) {
    if (glow) {
      const g = c.createRadialGradient(x, y, radius * 0.7, x, y, radius * 3);
      g.addColorStop(0, glow);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(x, y, radius * 3, 0, TAU);
      c.fill();
    }
    const g = c.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, radius, 0, TAU);
    c.fill();
  }

  const BUILDERS = {
    temple: {
      sky: sky([[0, "#1c1846"], [0.45, "#6a3a78"], [0.75, "#e0764e"], [1, "#ffc06a"]]),
      layers: [
        { f: 0.06, draw(c, r) {
          stars(c, r, 90, 200);
          disc(c, 1180, 130, 52, "#ffe7c8", "#d08a70", "rgba(255,200,150,.28)");
        } },
        { f: 0.15, draw(c, r, wrap) {
          towers(c, r, wrap, { count: 46, minH: 150, maxH: 340, wMin: 34, wMax: 74, color: "#45305e", windows: "rgba(255,200,120,.5)" });
          wrap(() => {
            // The Temple on the skyline: a ziggurat with five spires.
            const x = 520;
            const base = 470;
            c.fillStyle = "#54406a";
            for (let i = 0; i < 4; i++) c.fillRect(x + i * 36, base - i * 52 - 52, 460 - i * 72, 54);
            for (const [dx, h] of [[150, 300], [230, 390], [310, 300], [190, 330], [270, 330]]) {
              c.beginPath();
              c.moveTo(x + dx - 13, base - 190);
              c.lineTo(x + dx, base - h);
              c.lineTo(x + dx + 13, base - 190);
              c.fill();
            }
          });
        } },
        { f: 0.32, draw(c, r, wrap) {
          towers(c, r, wrap, { count: 24, minH: 90, maxH: 240, wMin: 50, wMax: 110, color: "#2c2146", windows: "rgba(255,226,160,.7)", win: 0.4 });
        } },
      ],
      live: "traffic",
    },
    kashyyyk: {
      sky: sky([[0, "#a8d8a6"], [0.5, "#5da77f"], [1, "#1e5a50"]]),
      layers: [
        { f: 0.1, draw(c, r, wrap) { giantTrees(c, r, wrap, { count: 12, wMin: 60, wMax: 110, color: "#6bab8a", bark: "rgba(255,255,255,.08)" }); } },
        { f: 0.22, draw(c, r, wrap) {
          giantTrees(c, r, wrap, { count: 9, wMin: 90, wMax: 150, color: "#3d7d62", bark: "rgba(0,0,0,.12)" });
        } },
        { f: 0.42, draw(c, r, wrap) {
          giantTrees(c, r, wrap, { count: 6, wMin: 130, wMax: 220, color: "#1f4a38", bark: "rgba(0,0,0,.25)" });
          const vines = [];
          for (let i = 0; i < 40; i++) vines.push([r() * STRIP, r.range(70, 230)]);
          wrap(() => {
            c.strokeStyle = "#16382a";
            c.lineWidth = 2;
            for (const [x, h] of vines) {
              c.beginPath();
              c.moveTo(x, 0);
              c.quadraticCurveTo(x + 9, h / 2, x - 4, h);
              c.stroke();
            }
          });
        } },
      ],
      live: "rays",
      weather: "motes",
    },
    tatooine: {
      sky: sky([[0, "#e9a860"], [0.5, "#f6cf8c"], [1, "#fbe6b8"]]),
      layers: [
        { f: 0.05, draw(c) {
          disc(c, 1040, 110, 44, "#fffbe0", "#ffd96a", "rgba(255,240,180,.5)");
          disc(c, 1140, 150, 26, "#fff0d0", "#ffb25a", "rgba(255,220,160,.4)");
        } },
        { f: 0.14, draw(c, r) { ridge(c, r, 330, 34, "#d9a266", 140); } },
        { f: 0.28, draw(c, r, wrap) {
          const mesas = [];
          for (let i = 0; i < 8; i++) mesas.push([r() * STRIP, r.range(90, 210), r.range(120, 280)]);
          wrap(() => {
            c.fillStyle = "#b67c44";
            for (const [x, h, w] of mesas) {
              c.beginPath();
              c.moveTo(x - 30, 470);
              c.lineTo(x + 8, 470 - h);
              c.lineTo(x + w - 8, 470 - h);
              c.lineTo(x + w + 30, 470);
              c.closePath();
              c.fill();
            }
          });
          ridge(c, r, 430, 18, "#c79055", 120);
        } },
        { f: 0.45, draw(c, r, wrap) {
          const vaporators = [];
          for (let i = 0; i < 7; i++) vaporators.push(r() * STRIP);
          ridge(c, r, 470, 14, "#a9743e", 100);
          wrap(() => {
            c.fillStyle = "#5a4630";
            for (const x of vaporators) {
              c.fillRect(x, 400, 5, 80);
              c.fillRect(x - 9, 420, 23, 4);
              c.fillRect(x - 6, 438, 17, 3);
            }
          });
        } },
      ],
      weather: "sand",
    },
    mustafar: {
      sky: sky([[0, "#1a0608"], [0.5, "#5a1408"], [0.82, "#c43c0c"], [1, "#ff7a1e"]]),
      layers: [
        { f: 0.08, draw(c, r) { ridge(c, r, 310, 50, "#3a0e0a", 90); } },
        { f: 0.2, draw(c, r, wrap) {
          const spires = [];
          for (let i = 0; i < 22; i++) spires.push([r() * STRIP, r.range(120, 320), r.range(24, 70)]);
          wrap(() => {
            c.fillStyle = "#220a0a";
            for (const [x, h, w] of spires) {
              c.beginPath();
              c.moveTo(x - w, 500);
              c.lineTo(x, 500 - h);
              c.lineTo(x + w, 500);
              c.closePath();
              c.fill();
            }
          });
        } },
        { f: 0.36, draw(c, r, wrap) {
          const falls = [];
          for (let i = 0; i < 6; i++) falls.push([r() * STRIP, r.range(16, 40), r.range(120, 230)]);
          wrap(() => {
            for (const [x, w, y] of falls) {
              const g = c.createLinearGradient(0, y, 0, 540);
              g.addColorStop(0, "#ffe08a");
              g.addColorStop(0.5, "#ff7a1e");
              g.addColorStop(1, "#c42a08");
              c.fillStyle = g;
              c.fillRect(x, y, w, 540 - y);
            }
          });
          ridge(c, r, 470, 26, "#140606", 70);
        } },
      ],
      weather: "embers",
    },
    hoth: {
      sky: sky([[0, "#7fb4d8"], [0.55, "#c9e4f2"], [1, "#eaf6fb"]]),
      layers: [
        { f: 0.08, draw(c, r) {
          disc(c, 320, 96, 34, "#ffffff", "#dbeaf4", "rgba(255,255,255,.35)");
          ridge(c, r, 300, 46, "#d6e9f4", 130);
        } },
        { f: 0.2, draw(c, r, wrap) {
          ridge(c, r, 370, 34, "#bcd8ea", 110);
          wrap(() => {
            // A half-buried base on the far ridge.
            c.fillStyle = "#8aa8bc";
            c.fillRect(980, 318, 240, 50);
            c.beginPath();
            c.arc(1100, 318, 60, Math.PI, 0);
            c.fill();
            c.fillStyle = "#58d0ff";
            for (let x = 1000; x < 1200; x += 34) c.fillRect(x, 334, 12, 5);
          });
        } },
        { f: 0.4, draw(c, r, wrap) {
          ridge(c, r, 450, 22, "#a2c8de", 90);
          const shards = [];
          for (let i = 0; i < 16; i++) shards.push([r() * STRIP, r.range(50, 170), r.range(14, 42)]);
          wrap(() => {
            c.fillStyle = "#8fbcd6";
            for (const [x, h, w] of shards) {
              c.beginPath();
              c.moveTo(x - w, 480);
              c.lineTo(x + w * 0.2, 480 - h);
              c.lineTo(x + w, 480);
              c.closePath();
              c.fill();
            }
          });
        } },
      ],
      weather: "snow",
    },
    narshaddaa: {
      sky: sky([[0, "#08041a"], [0.5, "#2a0f4a"], [0.85, "#7a1a6e"], [1, "#ff3a9a"]]),
      layers: [
        { f: 0.08, draw(c, r, wrap) {
          towers(c, r, wrap, { count: 40, minH: 220, maxH: 460, wMin: 44, wMax: 90, color: "#1c1238", windows: "rgba(120,240,255,.4)", win: 0.3 });
        } },
        { f: 0.2, draw(c, r, wrap) {
          towers(c, r, wrap, { count: 20, minH: 180, maxH: 400, wMin: 70, wMax: 130, color: "#120a26", windows: "rgba(255,90,190,.55)", win: 0.3 });
          const signs = [];
          for (let i = 0; i < 16; i++) signs.push([r() * STRIP, r.range(120, 380), r.pick(["#ff3ab0", "#3affd8", "#ffe23d", "#7a6aff"]), r.int(14, 34), r.int(36, 72)]);
          wrap(() => {
            for (const [x, y, color, w, h] of signs) {
              c.fillStyle = color;
              c.globalAlpha = 0.85;
              c.fillRect(x, y, w, h);
              c.globalAlpha = 1;
              c.fillStyle = "rgba(0,0,0,.55)";
              for (let k = 6; k < h - 6; k += 11) c.fillRect(x + 4, y + k, w - 8, 3);
            }
          });
        } },
        { f: 0.4, draw(c, r, wrap) {
          towers(c, r, wrap, { count: 9, minH: 110, maxH: 250, wMin: 110, wMax: 190, color: "#0a0618" });
        } },
      ],
      live: "traffic",
      weather: "rain",
    },
    endor: {
      sky: sky([[0, "#0f1a33"], [0.5, "#2b4a55"], [0.82, "#a78a55"], [1, "#e6b070"]]),
      layers: [
        { f: 0.05, draw(c, r) {
          stars(c, r, 60, 180);
          // The half-built battle station hangs in the dusk.
          disc(c, 1120, 120, 62, "#c8ccd0", "#6a7078", "rgba(180,200,220,.2)");
          c.fillStyle = "#2b3a4a";
          c.beginPath();
          c.arc(1168, 92, 62, 0, TAU);
          c.fill();
          c.fillStyle = "#3e4650";
          c.beginPath();
          c.arc(1104, 92, 13, 0, TAU);
          c.fill();
        } },
        { f: 0.14, draw(c, r, wrap) { giantTrees(c, r, wrap, { count: 18, wMin: 22, wMax: 42, color: "#3a4f4a", bark: "rgba(0,0,0,.1)" }); } },
        { f: 0.28, draw(c, r, wrap) { giantTrees(c, r, wrap, { count: 12, wMin: 40, wMax: 76, color: "#253a30", bark: "rgba(0,0,0,.2)" }); } },
        { f: 0.46, draw(c, r, wrap) {
          giantTrees(c, r, wrap, { count: 7, wMin: 70, wMax: 120, color: "#14241c", bark: "rgba(0,0,0,.3)" });
          wrap(() => {
            // A distant bipedal walker between the trunks.
            c.fillStyle = "#101a14";
            c.fillRect(1000, 360, 52, 30);
            c.fillRect(1044, 368, 22, 11);
            c.fillRect(1012, 390, 7, 90);
            c.fillRect(1034, 390, 7, 90);
          });
        } },
      ],
      weather: "motes",
    },
    deathstar: {
      sky: sky([[0, "#05070e"], [0.6, "#0d1220"], [1, "#182234"]]),
      layers: [
        { f: 0.04, draw(c, r) {
          stars(c, r, 160, 540);
          disc(c, 1100, 170, 92, "#7fc06a", "#22503a", "rgba(120,200,160,.2)");
        } },
        { f: 0.2, draw(c, r, wrap) {
          // Huge bulkhead ribs and viewport frames.
          wrap(() => {
            c.fillStyle = "#1b2030";
            for (let x = 0; x < STRIP; x += 400) {
              c.fillRect(x, 0, 90, J.VIEW_H);
              c.fillRect(x, 0, 400, 44);
              c.fillRect(x, 470, 400, 70);
            }
            c.fillStyle = "#3ad0ff";
            c.globalAlpha = 0.5;
            for (let x = 24; x < STRIP; x += 400) for (let y = 70; y < 460; y += 50) c.fillRect(x, y, 40, 3);
            c.globalAlpha = 1;
          });
        } },
        { f: 0.42, draw(c, r, wrap) {
          wrap(() => {
            c.fillStyle = "#121622";
            for (let x = 120; x < STRIP; x += 533) {
              c.fillRect(x, 0, 150, 100);
              c.fillRect(x + 30, 100, 90, 44);
              c.fillRect(x - 40, 440, 230, 100);
            }
          });
        } },
      ],
      overlay: "rgba(255,30,20,.14)",
    },
    exegol: {
      sky: sky([[0, "#05070f"], [0.5, "#142038"], [1, "#2c4468"]]),
      layers: [
        { f: 0.06, draw(c, r, wrap) {
          const ships = [];
          for (let i = 0; i < 7; i++) ships.push([r() * STRIP, r.range(60, 280), r.range(120, 220)]);
          wrap(() => {
            c.fillStyle = "#1a2438";
            for (const [x, y, w] of ships) {
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(x + w, y - w * 0.09);
              c.lineTo(x + w, y + w * 0.13);
              c.closePath();
              c.fill();
              c.fillRect(x + w * 0.7, y - w * 0.15, w * 0.1, w * 0.1);
            }
          });
        } },
        { f: 0.18, draw(c, r, wrap) {
          const spires = [];
          for (let i = 0; i < 18; i++) spires.push([r() * STRIP, r.range(150, 390), r.range(18, 50)]);
          wrap(() => {
            c.fillStyle = "#101828";
            for (const [x, h, w] of spires) {
              c.beginPath();
              c.moveTo(x - w, 540);
              c.lineTo(x - 6, 540 - h);
              c.lineTo(x + 6, 540 - h);
              c.lineTo(x + w, 540);
              c.closePath();
              c.fill();
            }
          });
        } },
        { f: 0.38, draw(c, r) { ridge(c, r, 440, 44, "#090d18", 70); } },
      ],
      live: "storm",
      weather: "ash",
    },
    throne: {
      sky: sky([[0, "#020204"], [0.55, "#0e0a16"], [1, "#2a0c18"]]),
      layers: [
        { f: 0.08, draw(c, r, wrap) {
          wrap(() => {
            // Rows of hooded colossi carved into the walls.
            c.fillStyle = "#0e0c14";
            for (let x = 40; x < STRIP; x += 300) {
              c.fillRect(x, 150, 150, 390);
              c.beginPath();
              c.arc(x + 75, 150, 62, Math.PI, 0);
              c.fill();
              c.fillStyle = "#5a1020";
              c.fillRect(x + 56, 132, 12, 4);
              c.fillRect(x + 84, 132, 12, 4);
              c.fillStyle = "#0e0c14";
            }
          });
        } },
        { f: 0.2, draw(c, r, wrap) {
          wrap(() => {
            for (let x = 190; x < STRIP; x += 300) {
              const g = c.createLinearGradient(x, 0, x + 60, 0);
              g.addColorStop(0, "rgba(120,170,255,0)");
              g.addColorStop(0.5, "rgba(120,170,255,.14)");
              g.addColorStop(1, "rgba(120,170,255,0)");
              c.fillStyle = g;
              c.beginPath();
              c.moveTo(x + 20, 0);
              c.lineTo(x + 40, 0);
              c.lineTo(x + 90, 540);
              c.lineTo(x - 30, 540);
              c.closePath();
              c.fill();
            }
          });
        } },
        { f: 0.36, draw(c, r, wrap) {
          wrap(() => {
            c.fillStyle = "#07060b";
            for (let x = 0; x < STRIP; x += 533) {
              c.fillRect(x, 0, 66, 540);
              c.fillRect(x, 0, 533, 30);
            }
          });
        } },
      ],
      live: "storm",
      weather: "ash",
    },
  };

  class Background {
    constructor(themeId) {
      const spec = BUILDERS[themeId];
      this.spec = spec;
      this.sky = spec.sky;
      this.layers = spec.layers.map((layer, i) => ({ f: layer.f, canvas: strip(layer.draw, (themeId.length + 3) * 977 + i * 131) }));
      this.motes = [];
      this.traffic = [];
      this.flash = 0;
      this.nextBolt = 2;
      const r = rng(themeId.length * 71 + 5);
      for (let i = 0; i < 70; i++) this.motes.push({ x: r() * J.VIEW_W, y: r() * J.VIEW_H, z: r.range(0.4, 1), p: r() * TAU });
      for (let i = 0; i < 14; i++) this.traffic.push({ x: r() * J.VIEW_W, y: r.range(70, 330), v: r.range(40, 120) * (i % 2 ? 1 : -1), c: r.pick(["#ffd76a", "#ff6a50", "#7cc8ff"]) });
    }

    update(dt) {
      this.flash = Math.max(0, this.flash - dt * 2.4);
      if (this.spec.live === "storm") {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = J.U.rand(1.6, 5);
          this.flash = 1;
          this.boltX = J.U.rand(J.VIEW_W);
        }
      }
    }

    drawLayers(ctx, camX, camY, baseY, t) {
      ctx.drawImage(this.sky, 0, 0, J.VIEW_W, J.VIEW_H);
      const lift = clamp((baseY - camY) * 0.05, -40, 70);
      for (const layer of this.layers) {
        const offset = ((camX * layer.f) % STRIP + STRIP) % STRIP;
        const y = lift * layer.f * 4;
        ctx.drawImage(layer.canvas, -offset, y);
        if (offset > STRIP - J.VIEW_W) ctx.drawImage(layer.canvas, STRIP - offset, y);
      }
      this.drawLive(ctx, t);
    }

    drawLive(ctx, t) {
      const { live } = this.spec;
      if (live === "traffic") {
        for (const v of this.traffic) {
          const x = ((v.x + v.v * t) % J.VIEW_W + J.VIEW_W) % J.VIEW_W;
          ctx.fillStyle = v.c;
          ctx.fillRect(x, v.y, 4, 1.6);
        }
      } else if (live === "rays") {
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 4; i++) {
          const x = 120 + i * 230 + Math.sin(t * 0.3 + i) * 30;
          const g = ctx.createLinearGradient(x, 0, x + 120, 540);
          g.addColorStop(0, "rgba(220,255,200,.13)");
          g.addColorStop(1, "rgba(220,255,200,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x + 60, 0);
          ctx.lineTo(x + 260, 540);
          ctx.lineTo(x + 100, 540);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      } else if (live === "storm" && this.flash > 0.45) {
        J.Art.lightning(ctx, this.boltX, 0, this.boltX + 50, 360, "#a8d0ff", 2, 30);
      }
    }

    // Weather sits in front of the world, and hides behind the HUD.
    drawWeather(ctx, t, quality) {
      const { weather, overlay } = this.spec;
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(190,220,255,${this.flash * 0.14})`;
        ctx.fillRect(0, 0, J.VIEW_W, J.VIEW_H);
      }
      if (overlay && this.alarm) {
        ctx.fillStyle = `rgba(255,30,20,${(0.07 + Math.sin(t * 5) * 0.05) * this.alarm})`;
        ctx.fillRect(0, 0, J.VIEW_W, J.VIEW_H);
      }
      if (!weather) return;
      const count = quality === "low" ? 30 : this.motes.length;
      const W = J.VIEW_W;
      const H = J.VIEW_H;
      for (let i = 0; i < count; i++) {
        const m = this.motes[i];
        let x;
        let y;
        switch (weather) {
          case "snow":
            x = (m.x - t * 34 * m.z + Math.sin(t + m.p) * 16 + W * 9) % W;
            y = (m.y + t * 90 * m.z) % H;
            ctx.fillStyle = "rgba(255,255,255,.85)";
            ctx.fillRect(x, y, 2.4 * m.z, 2.4 * m.z);
            break;
          case "sand":
            x = W - ((m.x + t * 300 * m.z) % W);
            y = (m.y + Math.sin(t * 2 + m.p) * 12 + H) % H;
            ctx.fillStyle = "rgba(226,180,110,.35)";
            ctx.fillRect(x, y, 14 * m.z, 1.2);
            break;
          case "embers":
            x = (m.x + Math.sin(t + m.p) * 24 + W) % W;
            y = H - ((m.y + t * 70 * m.z) % H);
            ctx.fillStyle = i % 3 ? "#ff8a2a" : "#ffd070";
            ctx.fillRect(x, y, 2.2 * m.z, 2.2 * m.z);
            break;
          case "rain":
            x = W - ((m.x + t * 120) % W);
            y = (m.y + t * 620 * m.z) % H;
            ctx.strokeStyle = "rgba(160,200,255,.3)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 3, y + 15);
            ctx.stroke();
            break;
          case "ash":
            x = (m.x + t * 16 * m.z + Math.sin(t * 0.7 + m.p) * 20 + W) % W;
            y = (m.y + t * 26 * m.z) % H;
            ctx.fillStyle = "rgba(170,180,200,.4)";
            ctx.fillRect(x, y, 2 * m.z, 2 * m.z);
            break;
          default: // motes
            x = (m.x + Math.sin(t * 0.6 + m.p) * 26 + W) % W;
            y = (m.y + Math.cos(t * 0.5 + m.p) * 18 + H) % H;
            ctx.globalAlpha = 0.4 + Math.sin(t * 3 + m.p) * 0.3;
            ctx.fillStyle = "#e8ffb0";
            ctx.fillRect(x, y, 2 * m.z, 2 * m.z);
            ctx.globalAlpha = 1;
        }
      }
    }
  }

  // Small still picture of a planet's scenery, for the level select cards.
  function drawThumbnail(canvas, themeId) {
    const c = canvas.getContext("2d");
    const bg = new Background(themeId);
    const k = canvas.width / J.VIEW_W;
    c.save();
    c.scale(k, k);
    bg.drawLayers(c, 300, 0, 0, 0);
    const theme = J.THEMES[themeId];
    c.fillStyle = theme.base;
    c.fillRect(0, 440, J.VIEW_W, 100);
    c.fillStyle = theme.cap;
    c.fillRect(0, 430, J.VIEW_W, 14);
    c.fillRect(220, 330, 180, 14);
    c.fillRect(600, 260, 170, 14);
    c.restore();
  }

  // Space scene shared by the menus and the cinematics.
  class Starfield {
    constructor(count = 180) {
      const r = rng(4242);
      this.stars = [];
      for (let i = 0; i < count; i++) this.stars.push({ x: r() * J.VIEW_W, y: r() * J.VIEW_H, s: r.range(0.5, 2), p: r() * TAU });
      const nebula = makeCanvas(J.VIEW_W, J.VIEW_H);
      const c = nebula.getContext("2d");
      for (let i = 0; i < 9; i++) {
        const x = r() * J.VIEW_W;
        const y = r() * J.VIEW_H;
        const radius = r.range(140, 320);
        const g = c.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, r.pick(["rgba(60,90,200,.2)", "rgba(130,50,170,.16)", "rgba(40,130,170,.14)"]));
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, J.VIEW_W, J.VIEW_H);
      }
      this.nebula = nebula;
    }

    draw(ctx, t) {
      ctx.fillStyle = "#03040c";
      ctx.fillRect(0, 0, J.VIEW_W, J.VIEW_H);
      ctx.drawImage(this.nebula, 0, 0);
      for (const star of this.stars) {
        ctx.globalAlpha = 0.5 + Math.sin(t * 1.4 + star.p) * 0.4;
        ctx.fillStyle = "#fff";
        ctx.fillRect(star.x, star.y, star.s, star.s);
      }
      ctx.globalAlpha = 1;
    }
  }

  // A shaded planet with bands, used in space shots.
  function drawPlanet(ctx, x, y, radius, colors, t = 0) {
    ctx.save();
    const halo = ctx.createRadialGradient(x, y, radius * 0.9, x, y, radius * 1.3);
    halo.addColorStop(0, colors.halo || "rgba(150,200,255,.34)");
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.clip();
    ctx.fillStyle = colors.base;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    const r = rng(colors.seed || 7);
    for (let i = 0; i < 16; i++) {
      const by = y - radius + r() * radius * 2;
      ctx.fillStyle = r.pick(colors.bands);
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.ellipse(x + ((r() * radius * 3 + t * 8) % (radius * 3)) - radius * 1.5, by, radius * r.range(0.3, 1), radius * r.range(0.03, 0.1), 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const shadow = ctx.createRadialGradient(x - radius * 0.45, y - radius * 0.4, radius * 0.2, x - radius * 0.1, y, radius * 1.3);
    shadow.addColorStop(0, "rgba(255,255,255,.12)");
    shadow.addColorStop(0.5, "rgba(0,0,0,0)");
    shadow.addColorStop(1, "rgba(0,0,0,.92)");
    ctx.fillStyle = shadow;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  J.Background = Background;
  J.Starfield = Starfield;
  J.drawPlanet = drawPlanet;
  J.drawThumbnail = drawThumbnail;
})(window.JEDI);
