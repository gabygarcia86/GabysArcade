/*
 * ThemeArt paints each planet: the backdrop behind the board, the walls and floor, the
 * props on the walls and the animated weather on top. The backdrop and the board are
 * painted once per level into offscreen canvases, so playing only redraws what moves.
 *
 * Ambient effects are worked out from the clock rather than stored, so there are no
 * particle lists to update while the game runs.
 */
(function (D) {
  const { TAU } = D;
  const AMBIENT_COUNT = 70;

  const grad = (c, x0, y0, x1, y1, stops) => {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
    return g;
  };

  const disc = (c, x, y, r, fill) => {
    c.fillStyle = fill;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  };

  const rect = (c, x, y, w, h, fill) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
  };

  const line = (c, x1, y1, x2, y2, color, width) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };

  // A rolling horizon, filled to the bottom of the screen.
  const hills = (c, W, H, base, height, fill, rng) => {
    const p1 = rng() * TAU;
    const p2 = rng() * TAU;
    c.fillStyle = fill;
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 12) {
      c.lineTo(x, base - Math.sin(x * 0.006 + p1) * height - Math.sin(x * 0.017 + p2) * height * 0.4);
    }
    c.lineTo(W, H);
    c.closePath();
    c.fill();
  };

  const stars = (c, W, H, count, rng, color = "#fff") => {
    c.fillStyle = color;
    for (let i = 0; i < count; i++) {
      c.globalAlpha = 0.25 + rng() * 0.7;
      const s = rng() < 0.1 ? 2 : 1;
      c.fillRect(rng() * W, rng() * H, s, s);
    }
    c.globalAlpha = 1;
  };

  const THEMES = {
    tatooine: {
      floor: "#6a3d17", floorLine: "rgba(255,200,120,.1)", wall: "#d9a760", wallAlt: "#c18a45",
      rim: "#7f4c1e", glow: "rgba(255,180,80,.45)", door: "#ffe29a",
      gear: "#fff0a8", gearHole: "#8a5a1e", light: "#ff5a3c", frame: "#e8b873",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#f39a3d", "#f7c26a", "#ffe6a8"]));
        disc(c, W * 0.14, H * 0.2, Math.min(W, H) * 0.075, "#fff6cf");
        disc(c, W * 0.25, H * 0.13, Math.min(W, H) * 0.045, "#ffe08a");
        hills(c, W, H, H * 0.68, H * 0.05, "#e2a453", rng);
        hills(c, W, H, H * 0.8, H * 0.05, "#cb8a3d", rng);
        for (let i = 0; i < 6; i++) drawVaporator(c, rng() * W, H * (0.72 + rng() * 0.2), H * 0.11);
      },
      texture(c, w, h, s, rng) {
        for (let y = 0; y < h; y += s * 0.33) rect(c, 0, y, w, 1, "rgba(120,70,20,.2)");
        for (let i = 0; i < w * h * 0.002; i++) rect(c, rng() * w, rng() * h, 2, 2, rng() < 0.5 ? "rgba(255,235,190,.3)" : "rgba(110,60,20,.28)");
      },
      prop(c, x, y, s, rng, lights) {
        drawVaporator(c, x, y + s * 0.42, s * 0.84);
        lights.push({ x, y: y - s * 0.3, color: "#ff5a3c", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        // Blowing sand
        c.fillStyle = "rgba(255,226,170,.28)";
        for (let i = 0; i < AMBIENT_COUNT; i++) {
          const speed = 90 + (i * 37) % 160;
          const x = (i * 211 + t * speed) % (W + 80) - 40;
          const y = ((i * 97) % H) + Math.sin(t + i) * 8;
          c.fillRect(x, y, 16 + (i % 4) * 6, 1.5);
        }
      },
    },

    deathstar: {
      floor: "#1b1f27", floorLine: "rgba(150,170,200,.09)", wall: "#6a7380", wallAlt: "#535b67",
      rim: "#2d333d", glow: "rgba(255,50,50,.3)", door: "#ff5a4f",
      gear: "#dfe9f5", gearHole: "#3a4250", light: "#ff3030", frame: "#8d97a5",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, "#10131a");
        for (let y = 0; y < H; y += 46) {
          for (let x = (y / 46) % 2 ? -46 : 0; x < W; x += 92) {
            rect(c, x + 3, y + 3, 86, 40, rng() < 0.5 ? "#1e232c" : "#262c36");
            if (rng() < 0.3) rect(c, x + 14, y + 14, 40, 6, rng() < 0.4 ? "#ff4040" : "#49566b");
          }
        }
        rect(c, 0, H * 0.5 - 3, W, 6, "#39414e");
      },
      texture(c, w, h, s, rng) {
        for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
          c.strokeStyle = "rgba(20,24,30,.5)";
          c.lineWidth = 1;
          c.strokeRect(x + 0.5, y + 0.5, s, s);
          if (rng() < 0.3) disc(c, x + s * 0.2, y + s * 0.2, 1.1, "rgba(220,230,240,.5)");
        }
      },
      prop(c, x, y, s, rng, lights) {
        rect(c, x - s * 0.36, y - s * 0.34, s * 0.72, s * 0.6, "#10141b");
        rect(c, x - s * 0.3, y - s * 0.28, s * 0.6, s * 0.34, "#0c3a4e");
        for (let i = 0; i < 3; i++) rect(c, x - s * 0.25, y - s * (0.23 - i * 0.09), s * (0.25 + rng() * 0.25), 1.4, "#54e0ff");
        lights.push({ x: x + s * 0.2, y: y + s * 0.14, color: "#ff3030", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        // Red alert sweeps the whole station.
        const pulse = (Math.sin(t * 3.2) + 1) / 2;
        const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        g.addColorStop(0, "rgba(255,0,0,0)");
        g.addColorStop(1, `rgba(255,20,20,${0.04 + pulse * 0.2})`);
        rect(c, 0, 0, W, H, g);
      },
    },

    hoth: {
      floor: "#26476b", floorLine: "rgba(220,240,255,.14)", wall: "#e4f2fc", wallAlt: "#b5d9f0",
      rim: "#6aa3cf", glow: "rgba(190,230,255,.5)", door: "#9fe9ff",
      gear: "#fffbd0", gearHole: "#4a7aa6", light: "#5cd1ff", frame: "#dff1fc",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#7fa8cf", "#bcd8ec", "#eaf6fd"]));
        hills(c, W, H, H * 0.55, H * 0.1, "#cfe4f3", rng);
        hills(c, W, H, H * 0.72, H * 0.07, "#e4f1fa", rng);
        hills(c, W, H, H * 0.86, H * 0.04, "#f6fcff", rng);
        // Shield generator dish on the ridge
        c.strokeStyle = "#6c8aa4";
        c.lineWidth = 5;
        c.beginPath();
        c.arc(W * 0.87, H * 0.52, H * 0.05, 0.1, Math.PI - 0.1);
        c.stroke();
        line(c, W * 0.87, H * 0.56, W * 0.87, H * 0.68, "#6c8aa4", 5);
      },
      texture(c, w, h, s, rng) {
        // Snow caps and frost
        c.strokeStyle = "rgba(255,255,255,.7)";
        c.lineWidth = 1.5;
        for (let i = 0; i < w * h * 0.0006; i++) {
          const x = rng() * w;
          const y = rng() * h;
          line(c, x, y, x + s * 0.3, y - s * 0.3, "rgba(255,255,255,.75)", 1.4);
        }
      },
      prop(c, x, y, s, rng, lights) {
        // A piece of frozen machinery, half buried in ice crystals.
        rect(c, x - s * 0.28, y - s * 0.1, s * 0.56, s * 0.4, "#7890a6");
        rect(c, x - s * 0.2, y - s * 0.03, s * 0.4, s * 0.1, "#3a5168");
        c.fillStyle = "#c8f0ff";
        for (const dx of [-0.34, 0, 0.3]) {
          c.beginPath();
          c.moveTo(x + s * dx - s * 0.13, y + s * 0.34);
          c.lineTo(x + s * dx, y - s * (0.28 + rng() * 0.16));
          c.lineTo(x + s * dx + s * 0.13, y + s * 0.34);
          c.fill();
        }
        lights.push({ x, y: y + s * 0.02, color: "#5cd1ff", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        c.fillStyle = "rgba(255,255,255,.85)";
        for (let i = 0; i < AMBIENT_COUNT; i++) {
          const speed = 40 + (i * 13) % 70;
          const y = (i * 131 + t * speed) % (H + 10);
          const x = (i * 83 + Math.sin(t * 0.8 + i) * 22 + t * 18) % W;
          const r = 1 + (i % 3) * 0.7;
          c.fillRect(x, y, r, r);
        }
      },
    },

    endor: {
      floor: "#1c3318", floorLine: "rgba(170,220,120,.1)", wall: "#5f4426", wallAlt: "#46331d",
      rim: "#2d4a1f", glow: "rgba(120,220,90,.35)", door: "#c8f58a",
      gear: "#f2ffb0", gearHole: "#37541f", light: "#ffc75a", frame: "#6d8f3c",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#1d3d25", "#2f5a2c", "#14280f"]));
        for (let i = 0; i < 26; i++) {
          const x = rng() * W;
          const w = 18 + rng() * 34;
          const shade = 28 + Math.floor(rng() * 34);
          rect(c, x, 0, w, H, `rgb(${shade + 24},${shade + 8},${shade - 12})`);
          rect(c, x + w * 0.2, 0, w * 0.12, H, "rgba(0,0,0,.2)");
        }
        for (let i = 0; i < 70; i++) disc(c, rng() * W, rng() * H * 0.28, 26 + rng() * 40, rng() < 0.5 ? "#2c6a2a" : "#1f5222");
        hills(c, W, H, H * 0.92, H * 0.03, "#16300f", rng);
      },
      texture(c, w, h, s, rng) {
        // Bark grain with moss on top.
        c.lineWidth = 1;
        for (let x = 0; x < w; x += s * 0.2) {
          c.strokeStyle = "rgba(25,14,5,.4)";
          c.beginPath();
          c.moveTo(x, 0);
          for (let y = 0; y < h; y += 10) c.lineTo(x + Math.sin(y * 0.09 + x) * 2, y);
          c.stroke();
        }
        for (let i = 0; i < w * h * 0.0012; i++) disc(c, rng() * w, rng() * h, 1.5 + rng() * 3, rng() < 0.5 ? "rgba(90,170,60,.55)" : "rgba(60,130,50,.55)");
      },
      prop(c, x, y, s, rng, lights) {
        // A small tree, or an Ewok lantern hung from a post.
        if (rng() < 0.6) {
          rect(c, x - s * 0.08, y, s * 0.16, s * 0.42, "#2d1c0c");
          disc(c, x, y - s * 0.1, s * 0.4, "#2b7a2d");
          disc(c, x - s * 0.16, y - s * 0.02, s * 0.26, "#35933a");
          disc(c, x + s * 0.14, y - s * 0.22, s * 0.2, "#49ab46");
        } else {
          rect(c, x - s * 0.05, y - s * 0.4, s * 0.1, s * 0.82, "#3a2610");
          line(c, x, y - s * 0.32, x + s * 0.3, y - s * 0.36, "#3a2610", 2);
          disc(c, x + s * 0.28, y - s * 0.18, s * 0.13, "#ffcf70");
          lights.push({ x: x + s * 0.28, y: y - s * 0.18, color: "#ffc75a", phase: rng() * TAU });
        }
      },
      ambient(c, t, W, H) {
        // Fireflies
        for (let i = 0; i < AMBIENT_COUNT / 2; i++) {
          const x = (i * 149 + Math.sin(t * 0.4 + i * 2) * 60 + W) % W;
          const y = (i * 71 + Math.cos(t * 0.5 + i) * 44 + H) % H;
          const on = Math.max(0, Math.sin(t * 1.6 + i * 1.7));
          c.fillStyle = `rgba(220,255,130,${on * 0.85})`;
          c.fillRect(x, y, 2.5, 2.5);
        }
      },
    },

    bespin: {
      floor: "#54304f", floorLine: "rgba(255,210,220,.12)", wall: "#e9cfc6", wallAlt: "#d3a2a0",
      rim: "#b65a68", glow: "rgba(255,160,160,.45)", door: "#ffd2a0",
      gear: "#fff4c0", gearHole: "#924b5a", light: "#ffc45a", frame: "#f5d8cf",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#f58d5c", "#f7a981", "#f3a6b8", "#c982b5"]));
        for (let i = 0; i < 34; i++) {
          c.fillStyle = `rgba(255,${220 + Math.floor(rng() * 30)},${200 + Math.floor(rng() * 40)},${0.12 + rng() * 0.3})`;
          c.beginPath();
          c.ellipse(rng() * W, H * (0.3 + rng() * 0.75), 80 + rng() * 170, 18 + rng() * 34, 0, 0, TAU);
          c.fill();
        }
        // The city hangs on its central stalk.
        const x = W * 0.11;
        const y = H * 0.5;
        const u = H * 0.09;
        c.fillStyle = "#c9b3b6";
        c.beginPath();
        c.ellipse(x, y, u * 1.6, u * 0.46, 0, 0, TAU);
        c.fill();
        c.fillStyle = "#a68b95";
        c.beginPath();
        c.moveTo(x - u * 0.34, y + u * 0.3);
        c.lineTo(x + u * 0.34, y + u * 0.3);
        c.lineTo(x + u * 0.07, y + u * 1.8);
        c.lineTo(x - u * 0.07, y + u * 1.8);
        c.fill();
        for (let i = -3; i <= 3; i++) rect(c, x + i * u * 0.3 - u * 0.1, y - u * (0.5 + (3 - Math.abs(i)) * 0.14), u * 0.2, u * (0.3 + (3 - Math.abs(i)) * 0.14), "#dfcdd0");
      },
      texture(c, w, h, s) {
        c.strokeStyle = "rgba(170,80,100,.34)";
        c.lineWidth = 1.5;
        for (let y = s * 0.5; y < h; y += s) {
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(w, y);
          c.stroke();
        }
      },
      prop(c, x, y, s, rng, lights) {
        // A tiny floating platform with a spire.
        c.fillStyle = "#b0778a";
        c.beginPath();
        c.ellipse(x, y + s * 0.14, s * 0.4, s * 0.15, 0, 0, TAU);
        c.fill();
        rect(c, x - s * 0.12, y - s * 0.26, s * 0.24, s * 0.36, "#f5ecea");
        rect(c, x - s * 0.04, y - s * 0.42, s * 0.08, s * 0.2, "#f5ecea");
        lights.push({ x, y: y - s * 0.42, color: "#ffc45a", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        // Slow cloud banks passing in front of everything.
        for (let i = 0; i < 7; i++) {
          const speed = 9 + i * 4;
          const x = (i * 310 + t * speed) % (W + 500) - 250;
          const y = H * (0.1 + (i * 0.137) % 0.85);
          c.fillStyle = "rgba(255,235,225,.1)";
          c.beginPath();
          c.ellipse(x, y, 190 - i * 12, 26 + i * 4, 0, 0, TAU);
          c.fill();
        }
        // Cloud cars
        for (let i = 0; i < 2; i++) {
          const x = W - ((i * 500 + t * 70) % (W + 60));
          rect(c, x, H * (0.2 + i * 0.5), 12, 4, "rgba(120,50,60,.7)");
        }
      },
    },

    mustafar: {
      floor: "#2a0f0b", floorLine: "rgba(255,120,50,.14)", wall: "#3c2522", wallAlt: "#2a1817",
      rim: "#ff5a18", glow: "rgba(255,90,20,.7)", door: "#ffb040",
      gear: "#ffe48a", gearHole: "#7a2a10", light: "#ff8a2a", frame: "#ff6a1e",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#1d0806", "#5a140a", "#c23a0c"]));
        for (let i = 0; i < 5; i++) {
          const x = rng() * W;
          const b = H * (0.34 + rng() * 0.3);
          c.fillStyle = "#170706";
          c.beginPath();
          c.moveTo(x - H * 0.3, H);
          c.lineTo(x - H * 0.03, b);
          c.lineTo(x + H * 0.03, b);
          c.lineTo(x + H * 0.3, H);
          c.fill();
          line(c, x, b, x + (rng() - 0.5) * 80, H, "#ff7a1c", 4);
        }
        c.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          c.strokeStyle = "#ff9326";
          c.lineWidth = 6 + rng() * 10;
          c.beginPath();
          let x = rng() * W;
          let y = H * 0.82;
          c.moveTo(x, y);
          for (let j = 0; j < 5; j++) {
            x += (rng() - 0.5) * 150;
            y += H * 0.05;
            c.lineTo(x, y);
          }
          c.stroke();
        }
      },
      texture(c, w, h, s, rng) {
        // Lava cracks glowing through the rock
        c.lineCap = "round";
        for (let i = 0; i < w * h * 0.00022; i++) {
          let x = rng() * w;
          let y = rng() * h;
          c.strokeStyle = "rgba(255,110,30,.8)";
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(x, y);
          for (let j = 0; j < 4; j++) {
            x += (rng() - 0.5) * s;
            y += (rng() - 0.5) * s;
            c.lineTo(x, y);
          }
          c.stroke();
        }
      },
      prop(c, x, y, s, rng, lights) {
        // Industrial piston over a crucible.
        rect(c, x - s * 0.08, y - s * 0.42, s * 0.16, s * 0.5, "#5a5a62");
        rect(c, x - s * 0.24, y - s * 0.12, s * 0.48, s * 0.16, "#7a7a84");
        rect(c, x - s * 0.34, y + s * 0.1, s * 0.68, s * 0.28, "#1d1d22");
        rect(c, x - s * 0.28, y + s * 0.14, s * 0.56, s * 0.1, "#ff7a1c");
        lights.push({ x, y: y + s * 0.2, color: "#ff8a2a", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        const pulse = (Math.sin(t * 1.3) + 1) / 2;
        rect(c, 0, 0, W, H, `rgba(255,70,0,${0.02 + pulse * 0.06})`);
        for (let i = 0; i < AMBIENT_COUNT; i++) {
          const speed = 30 + (i * 17) % 80;
          const y = H - ((i * 113 + t * speed) % (H + 10));
          const x = (i * 139 + Math.sin(t + i) * 24) % W;
          c.fillStyle = `rgba(255,${120 + (i % 5) * 26},40,${0.3 + (y / H) * 0.6})`;
          c.fillRect(x, y, 2.4, 2.4);
        }
      },
    },

    geonosis: {
      floor: "#40200f", floorLine: "rgba(255,170,90,.12)", wall: "#c9682a", wallAlt: "#a14f1e",
      rim: "#5e2c10", glow: "rgba(255,130,50,.4)", door: "#ffc27a",
      gear: "#fff0b0", gearHole: "#7a3a14", light: "#ffdd55", frame: "#d97932",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#d9662a", "#f09a4a", "#f5be70"]));
        disc(c, W * 0.83, H * 0.2, Math.min(W, H) * 0.12, "#f7d6b0");
        // Termite-mound spires
        for (let i = 0; i < 16; i++) {
          const x = rng() * W;
          const w = 30 + rng() * 60;
          const top = H * (0.3 + rng() * 0.4);
          c.fillStyle = i % 2 ? "#a4531f" : "#8a4318";
          c.beginPath();
          c.moveTo(x - w, H);
          c.quadraticCurveTo(x - w * 0.4, top + H * 0.2, x, top);
          c.quadraticCurveTo(x + w * 0.5, top + H * 0.2, x + w, H);
          c.fill();
        }
        hills(c, W, H, H * 0.88, H * 0.03, "#6f3512", rng);
      },
      texture(c, w, h, s, rng) {
        for (let i = 0; i < w * h * 0.0016; i++) {
          c.fillStyle = rng() < 0.5 ? "rgba(90,40,10,.3)" : "rgba(255,190,120,.2)";
          c.beginPath();
          c.ellipse(rng() * w, rng() * h, s * (0.1 + rng() * 0.25), s * (0.05 + rng() * 0.1), rng() * 3, 0, TAU);
          c.fill();
        }
      },
      prop(c, x, y, s, rng, lights) {
        // A half-built droid head on the assembly line.
        rect(c, x - s * 0.42, y + s * 0.2, s * 0.84, s * 0.12, "#3b3b40");
        for (let i = -1; i <= 1; i++) disc(c, x + i * s * 0.28, y + s * 0.26, s * 0.05, "#8a8a92");
        c.fillStyle = "#d9bd83";
        c.beginPath();
        c.moveTo(x - s * 0.1, y + s * 0.2);
        c.lineTo(x + s * 0.1, y + s * 0.2);
        c.lineTo(x + s * 0.05, y - s * 0.32);
        c.lineTo(x - s * 0.05, y - s * 0.32);
        c.fill();
        lights.push({ x, y: y - s * 0.02, color: "#ffdd55", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        // Welding sparks burst at fixed spots along the walls.
        for (let i = 0; i < 6; i++) {
          const period = 2.3 + i * 0.4;
          const phase = (t / period + i * 0.37) % 1;
          if (phase > 0.28) continue;
          const cx = (i * 271 + 90) % W;
          const cy = (i * 193 + 60) % H;
          for (let j = 0; j < 8; j++) {
            const a = j * 0.78 + i;
            const d = phase * 300;
            c.fillStyle = "rgba(255,230,120,.85)";
            c.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d + d * phase * 2, 2.2, 2.2);
          }
        }
        c.fillStyle = "rgba(255,210,150,.16)";
        for (let i = 0; i < 30; i++) c.fillRect((i * 173 + t * 34) % W, (i * 89) % H, 3, 1.5);
      },
    },

    coruscant: {
      floor: "#0d0b26", floorLine: "rgba(120,120,255,.1)", wall: "#1a1646", wallAlt: "#251d5e",
      rim: "#ff3df0", glow: "rgba(255,60,240,.6)", door: "#58f2ff",
      gear: "#b8fff0", gearHole: "#1a1646", light: "#58f2ff", frame: "#58f2ff",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#160a3c", "#50207c", "#c74a8c", "#ffa070"]));
        for (let layer = 0; layer < 3; layer++) {
          for (let x = -20; x < W; x += 34 + rng() * 50) {
            const w = 28 + rng() * 54;
            const top = H * (0.16 + layer * 0.17 + rng() * 0.26);
            rect(c, x, top, w, H - top, ["#2c1a5e", "#1e1148", "#120a32"][layer]);
            for (let wy = top + 8; wy < H; wy += 10) {
              for (let wx = x + 4; wx < x + w - 5; wx += 8) {
                if (rng() < 0.45) rect(c, wx, wy, 4, 5, ["#ffd76a", "#58f2ff", "#ff7ae0"][Math.floor(rng() * 3)]);
              }
            }
          }
        }
      },
      texture(c, w, h, s, rng) {
        for (let y = 0; y < h; y += s * 0.26) for (let x = 0; x < w; x += s * 0.26) {
          if (rng() < 0.3) rect(c, x, y, s * 0.13, s * 0.15, ["#ffd76a", "#58f2ff", "#ff7ae0", "#7aff9a"][Math.floor(rng() * 4)]);
        }
      },
      prop(c, x, y, s, rng, lights) {
        const color = ["#ff3df0", "#58f2ff", "#ffe14d"][Math.floor(rng() * 3)];
        rect(c, x - s * 0.36, y - s * 0.26, s * 0.72, s * 0.5, "#090720");
        c.strokeStyle = color;
        c.lineWidth = 2;
        c.strokeRect(x - s * 0.3, y - s * 0.2, s * 0.6, s * 0.38);
        line(c, x - s * 0.18, y + s * 0.06, x + s * 0.18, y - s * 0.08, color, 2);
        lights.push({ x, y, color, phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        // Lanes of speeder traffic
        for (let lane = 0; lane < 6; lane++) {
          const y = H * (0.1 + lane * 0.16);
          const dir = lane % 2 ? 1 : -1;
          const color = lane % 2 ? "rgba(255,120,120,.8)" : "rgba(255,240,180,.8)";
          for (let i = 0; i < 5; i++) {
            const offset = (i * 283 + t * (130 + lane * 26)) % (W + 40);
            c.fillStyle = color;
            c.fillRect(dir > 0 ? offset - 20 : W - offset, y, 12, 2.5);
          }
        }
      },
    },

    kamino: {
      floor: "#1b3c56", floorLine: "rgba(180,235,255,.13)", wall: "#f0f6fa", wallAlt: "#c8dfec",
      rim: "#2f8fc7", glow: "rgba(120,210,255,.5)", door: "#7ff0ff",
      gear: "#ffffc8", gearHole: "#2f6f96", light: "#3fd2ff", frame: "#e6f2f8",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#3b4f63", "#5f7d93", "#27465f"]));
        rect(c, 0, H * 0.74, W, H * 0.26, grad(c, 0, H * 0.74, 0, H, ["#2b5372", "#10293e"]));
        // Stilted domes rising out of the storm sea
        for (let i = 0; i < 6; i++) {
          const x = rng() * W;
          const r = H * (0.06 + rng() * 0.06);
          const y = H * (0.48 + rng() * 0.16);
          for (const dx of [-0.6, 0, 0.6]) rect(c, x + dx * r - 3, y, 6, H * 0.8 - y, "#c2d3de");
          c.fillStyle = "#eaf3f8";
          c.beginPath();
          c.ellipse(x, y, r, r * 0.46, 0, 0, TAU);
          c.fill();
          rect(c, x - r * 0.82, y - 2, r * 1.64, 4, "#64b9e0");
        }
      },
      texture(c, w, h, s) {
        for (let y = s * 0.3; y < h; y += s) rect(c, 0, y, w, s * 0.08, "rgba(90,170,215,.5)");
      },
      prop(c, x, y, s, rng, lights) {
        // A clone growth pod.
        c.fillStyle = "#b9e7f7";
        c.beginPath();
        c.roundRect(x - s * 0.2, y - s * 0.38, s * 0.4, s * 0.76, s * 0.18);
        c.fill();
        rect(c, x - s * 0.24, y + s * 0.26, s * 0.48, s * 0.14, "#5a7e96");
        disc(c, x, y - s * 0.12, s * 0.09, "#e8b28f");
        rect(c, x - s * 0.07, y - s * 0.04, s * 0.14, s * 0.24, "#e8b28f");
        lights.push({ x, y: y + s * 0.33, color: "#3fd2ff", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        c.strokeStyle = "rgba(190,225,245,.5)";
        c.lineWidth = 1.2;
        c.beginPath();
        for (let i = 0; i < AMBIENT_COUNT; i++) {
          const speed = 420 + (i * 31) % 260;
          const y = (i * 137 + t * speed) % (H + 20) - 10;
          const x = (i * 97 - t * 110 + W * 8) % W;
          c.moveTo(x, y);
          c.lineTo(x - 5, y + 16);
        }
        c.stroke();
      },
    },

    exegol: {
      floor: "#0d0614", floorLine: "rgba(190,60,255,.11)", wall: "#21102f", wallAlt: "#160a20",
      rim: "#9b35e8", glow: "rgba(170,50,255,.55)", door: "#ff3a4a",
      gear: "#f3c8ff", gearHole: "#2c1040", light: "#ff2a3a", frame: "#b24bff",
      backdrop(c, W, H, rng) {
        rect(c, 0, 0, W, H, grad(c, 0, 0, 0, H, ["#05020a", "#1c0a2c", "#3a1250"]));
        stars(c, W, H * 0.5, 120, rng, "#d7b5ff");
        // Rows of spires and hanging Sith fleets
        for (let i = 0; i < 18; i++) {
          const x = rng() * W;
          const w = 14 + rng() * 36;
          const top = H * (0.2 + rng() * 0.5);
          c.fillStyle = i % 2 ? "#120618" : "#0b0410";
          c.beginPath();
          c.moveTo(x - w, H);
          c.lineTo(x, top);
          c.lineTo(x + w, H);
          c.fill();
          disc(c, x, top + 14, 2, "#ff2a3a");
        }
      },
      texture(c, w, h, s, rng) {
        // Red runes cut into black stone
        for (let i = 0; i < w * h * 0.00045; i++) {
          const x = rng() * w;
          const y = rng() * h;
          c.strokeStyle = "rgba(255,40,70,.55)";
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + s * 0.16, y + s * 0.2);
          c.lineTo(x - s * 0.08, y + s * 0.3);
          c.stroke();
        }
      },
      prop(c, x, y, s, rng, lights) {
        // A hooded statue with one lit eye slit.
        c.fillStyle = "#3a1b52";
        c.beginPath();
        c.moveTo(x - s * 0.3, y + s * 0.42);
        c.lineTo(x - s * 0.13, y - s * 0.2);
        c.quadraticCurveTo(x, y - s * 0.5, x + s * 0.13, y - s * 0.2);
        c.lineTo(x + s * 0.3, y + s * 0.42);
        c.fill();
        rect(c, x - s * 0.09, y - s * 0.17, s * 0.18, s * 0.05, "#ff2a3a");
        lights.push({ x, y: y - s * 0.14, color: "#ff2a3a", phase: rng() * TAU });
      },
      ambient(c, t, W, H) {
        // Every few seconds a red bolt forks down the screen.
        const period = 2.6;
        const beat = Math.floor(t / period);
        const age = t / period - beat;
        if (age > 0.14) return;
        const rng = D.seeded(beat * 7919);
        const flicker = age < 0.05 || (age > 0.08 && age < 0.11) ? 1 : 0.35;
        rect(c, 0, 0, W, H, `rgba(255,40,70,${0.12 * flicker})`);
        c.lineJoin = "round";
        for (let bolt = 0; bolt < 2; bolt++) {
          let x = W * (0.1 + rng() * 0.8);
          let y = -10;
          c.strokeStyle = `rgba(255,70,90,${flicker})`;
          c.lineWidth = 3;
          c.shadowColor = "#ff2040";
          c.shadowBlur = 16;
          c.beginPath();
          c.moveTo(x, y);
          while (y < H * (0.6 + rng() * 0.4)) {
            x += (rng() - 0.5) * 90;
            y += 20 + rng() * 40;
            c.lineTo(x, y);
          }
          c.stroke();
        }
        c.shadowBlur = 0;
      },
    },
  };

  function drawVaporator(c, x, base, h) {
    const w = h * 0.1;
    rect(c, x - w * 0.5, base - h, w, h, "#b9bcc0");
    rect(c, x - w * 1.5, base - h * 0.42, w * 3, h * 0.08, "#8d9096");
    rect(c, x - w * 2.1, base - h * 0.72, w * 4.2, h * 0.05, "#a3a6ab");
    rect(c, x - w * 1.3, base - h * 0.9, w * 2.6, h * 0.05, "#a3a6ab");
    rect(c, x - w, base - h * 0.14, w * 2, h * 0.14, "#74777d");
  }

  // Corners only round off where two open sides meet, which makes wall blocks read as one shape.
  function addWallCell(path, maze, x, y, s, inset, insetBottom, radius) {
    const open = (cx, cy) => cx >= 0 && cx < maze.cols && cy >= 0 && cy < maze.rows && !maze.isWall(cx, cy);
    const top = open(x, y - 1);
    const right = open(x + 1, y);
    const bottom = open(x, y + 1);
    const left = open(x - 1, y);
    const x0 = x * s + (left ? inset : 0);
    const x1 = (x + 1) * s - (right ? inset : 0);
    const y0 = y * s + (top ? inset : 0);
    const y1 = (y + 1) * s - (bottom ? insetBottom : 0);
    const tl = top && left ? radius : 0;
    const tr = top && right ? radius : 0;
    const br = bottom && right ? radius : 0;
    const bl = bottom && left ? radius : 0;
    path.moveTo(x0 + tl, y0);
    path.lineTo(x1 - tr, y0);
    if (tr) path.arcTo(x1, y0, x1, y0 + tr, tr);
    path.lineTo(x1, y1 - br);
    if (br) path.arcTo(x1, y1, x1 - br, y1, br);
    path.lineTo(x0 + bl, y1);
    if (bl) path.arcTo(x0, y1, x0, y1 - bl, bl);
    path.lineTo(x0, y0 + tl);
    if (tl) path.arcTo(x0, y0, x0 + tl, y0, tl);
    path.closePath();
  }

  class ThemeArt {
    constructor() {
      this.theme = null;
      this.backdropCanvas = document.createElement("canvas");
      this.boardCanvas = document.createElement("canvas");
      this.lights = [];
      this.gearFrames = [];
      this.powerSprite = document.createElement("canvas");
    }

    // Paints everything that only changes with the level or the window size.
    build(maze, view) {
      const theme = THEMES[maze.level.theme];
      this.theme = theme;
      const seed = D.LEVELS.indexOf(maze.level) * 131 + 17;
      this.paintBackdrop(theme, view, D.seeded(seed));
      this.paintBoard(maze, theme, view, D.seeded(seed + 1));
      this.paintCollectibles(theme, view);
    }

    paintBackdrop(theme, view, rng) {
      const { W, H, dpr, boardX, boardY, boardW, boardH } = view;
      const canvas = this.backdropCanvas;
      canvas.width = Math.ceil(W * dpr);
      canvas.height = Math.ceil(H * dpr);
      const c = canvas.getContext("2d");
      c.scale(dpr, dpr);
      theme.backdrop(c, W, H, rng);
      // Frame around the board
      c.save();
      c.shadowColor = theme.glow;
      c.shadowBlur = 24;
      rect(c, boardX - 4, boardY - 4, boardW + 8, boardH + 8, theme.frame);
      c.restore();
    }

    paintBoard(maze, theme, view, rng) {
      const { tile: s, boardW: w, boardH: h, dpr } = view;
      const canvas = this.boardCanvas;
      canvas.width = Math.ceil(w * dpr);
      canvas.height = Math.ceil(h * dpr);
      const c = canvas.getContext("2d");
      c.scale(dpr, dpr);

      // Floor
      rect(c, 0, 0, w, h, theme.floor);
      c.strokeStyle = theme.floorLine;
      c.lineWidth = 1;
      c.beginPath();
      for (let x = 0; x <= maze.cols; x++) { c.moveTo(x * s, 0); c.lineTo(x * s, h); }
      for (let y = 0; y <= maze.rows; y++) { c.moveTo(0, y * s); c.lineTo(w, y * s); }
      c.stroke();

      // House floor and door
      for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) {
        if (maze.isHouse(x, y)) rect(c, x * s, y * s, s, s, "rgba(0,0,0,.42)");
      }

      // Walls: an outer rim shape with a smaller face on top. The bottom rim is thicker,
      // which gives the blocks a little height.
      const rim = new Path2D();
      const face = new Path2D();
      const radius = s * 0.3;
      for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) {
        if (!maze.isWall(x, y)) continue;
        addWallCell(rim, maze, x, y, s, 0, 0, radius);
        addWallCell(face, maze, x, y, s, s * 0.09, s * 0.22, radius * 0.7);
      }
      c.save();
      c.shadowColor = theme.glow;
      c.shadowBlur = s * 0.45;
      c.fillStyle = theme.rim;
      c.fill(rim);
      c.restore();
      c.fillStyle = grad(c, 0, 0, w, h, [theme.wall, theme.wallAlt, theme.wall]);
      c.fill(face);
      c.save();
      c.clip(face);
      theme.texture(c, w, h, s, rng);
      c.restore();

      rect(c, maze.door.x * s, maze.door.y * s + s * 0.34, s, s * 0.32, theme.door);

      // Props sit on wall tiles that have another wall beside them, away from the house.
      this.lights.length = 0;
      const candidates = [];
      for (let y = 1; y < maze.rows - 1; y++) for (let x = 1; x < maze.cols - 1; x++) {
        if (!maze.isWall(x, y)) continue;
        if (Math.abs(x - maze.door.x) < 5 && y >= maze.door.y - 1 && y <= maze.door.y + 3) continue;
        if (maze.isWall(x - 1, y) && maze.isWall(x + 1, y)) candidates.push([x, y]);
      }
      const placed = [];
      const wanted = 16;
      for (let tries = 0; tries < 300 && placed.length < wanted && candidates.length; tries++) {
        const [x, y] = candidates[Math.floor(rng() * candidates.length)];
        if (placed.some(([px, py]) => Math.abs(px - x) + Math.abs(py - y) < 4)) continue;
        placed.push([x, y]);
        theme.prop(c, (x + 0.5) * s, (y + 0.45) * s, s, rng, this.lights);
      }
    }

    paintCollectibles(theme, view) {
      const { tile: s, dpr } = view;
      const size = Math.ceil(s * 1.1 * dpr);
      const steps = 6;
      this.gearFrames.length = 0;
      for (let i = 0; i < steps; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const c = canvas.getContext("2d");
        c.translate(size / 2, size / 2);
        c.rotate(((i / steps) * D.TAU) / 8);
        c.shadowColor = theme.gear;
        c.shadowBlur = s * 0.3 * dpr;
        D.Art.gear(c, s * 0.21 * dpr, theme.gear, theme.gearHole);
        this.gearFrames.push(canvas);
      }
      const px = Math.ceil(s * 1.7 * dpr);
      const canvas = this.powerSprite;
      canvas.width = px;
      canvas.height = px;
      const c = canvas.getContext("2d");
      c.translate(px / 2, px / 2);
      c.shadowColor = "#ff5a3c";
      c.shadowBlur = s * 0.34 * dpr;
      D.Art.insignia(c, s * 0.5 * dpr, "#ff6a4a");
      c.shadowBlur = 0;
      D.Art.insignia(c, s * 0.46 * dpr, "#fff0e0");
    }

    // Blinking lights on the props. Coordinates are relative to the board.
    drawLights(c, t) {
      for (const light of this.lights) {
        const on = Math.sin(t * 3 + light.phase);
        if (on < -0.2) continue;
        c.globalAlpha = 0.4 + on * 0.5;
        c.fillStyle = light.color;
        c.beginPath();
        c.arc(light.x, light.y, 2.4, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }

    // Weather and lighting across the whole screen.
    drawAmbient(c, t, W, H) {
      this.theme.ambient(c, t, W, H);
    }
  }

  D.ThemeArt = ThemeArt;
})(window.DROID);
