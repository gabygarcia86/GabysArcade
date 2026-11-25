/*
 * The flying saucer, its pilot and its shield, and everything the Customize UFO screen can
 * change: the ship, hull, trim and dome colors, rim light pattern, an accessory on top and
 * the alien driver. Every ship is drawn around (0, 0) = the middle of the disc and is about
 * the same size, so the choice only changes the look, never how the game plays.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const OUT = D.OUT;
  const TAU = U.TAU;
  const Art = (U.Art = U.Art || {});

  // ---------------------------------------------------------------- Options

  const HULLS = [
    { id: "lavender", name: "Lavender", g: ["#ffffff", "#d6cff7", "#8f82d8"], under: "#6a4fd8" },
    { id: "silver", name: "Silver", g: ["#ffffff", "#dfe4ec", "#8e98aa"], under: "#5c6578" },
    { id: "mint", name: "Mint", g: ["#ffffff", "#c6f7e2", "#5fc9a0"], under: "#2f9a78" },
    { id: "sky", name: "Sky", g: ["#ffffff", "#c8ecff", "#5aaee6"], under: "#2f74c0" },
    { id: "sunny", name: "Sunny", g: ["#fffbe6", "#ffe98a", "#e8b52e"], under: "#c0811f" },
    { id: "peach", name: "Peach", g: ["#fff4ec", "#ffd0b0", "#f08a5a"], under: "#c4583a" },
    { id: "bubblegum", name: "Bubblegum", g: ["#fff2fa", "#ffc6e6", "#f07ab8"], under: "#c4458a" },
    { id: "ruby", name: "Ruby", g: ["#ffe0e0", "#ff7a7a", "#c42a3a"], under: "#8a1d2c" },
    { id: "midnight", name: "Midnight", g: ["#9aa2d8", "#4a5290", "#232858"], under: "#161a3c" },
    { id: "gold", name: "Gold", g: ["#fffbe0", "#ffd84a", "#b88a1a"], under: "#7a5a10" },
  ];

  const TRIMS = [
    { id: "pink", name: "Pink", c: "#ff5fb4" },
    { id: "cyan", name: "Cyan", c: "#4fe6ff" },
    { id: "lime", name: "Lime", c: "#8dff5a" },
    { id: "gold", name: "Gold", c: "#ffd23f" },
    { id: "orange", name: "Orange", c: "#ff8a3d" },
    { id: "red", name: "Red", c: "#ff3b4a" },
    { id: "purple", name: "Purple", c: "#a77bff" },
    { id: "white", name: "White", c: "#ffffff" },
    { id: "black", name: "Black", c: "#2a2240" },
  ];

  const DOMES = [
    { id: "clear", name: "Clear", c: "rgba(150, 235, 255, 0.38)", swatch: "#8fe3ff" },
    { id: "pink", name: "Rose", c: "rgba(255, 160, 215, 0.42)", swatch: "#ffa0d7" },
    { id: "green", name: "Lime", c: "rgba(170, 255, 140, 0.4)", swatch: "#aaff8c" },
    { id: "amber", name: "Amber", c: "rgba(255, 200, 100, 0.42)", swatch: "#ffc864" },
    { id: "purple", name: "Violet", c: "rgba(190, 150, 255, 0.42)", swatch: "#be96ff" },
    { id: "smoke", name: "Smoky", c: "rgba(40, 30, 80, 0.5)", swatch: "#3a3060" },
  ];

  const LIGHT_MODES = [
    { id: "rainbow", name: "Rainbow" },
    { id: "chase", name: "Chase" },
    { id: "steady", name: "Steady" },
    { id: "twinkle", name: "Twinkle" },
    { id: "siren", name: "Siren" },
    { id: "disco", name: "Disco" },
    { id: "off", name: "Off" },
  ];

  const ACCESSORIES = [
    { id: "antenna", name: "Antenna" },
    { id: "none", name: "Nothing" },
    { id: "partyHat", name: "Party Hat" },
    { id: "crown", name: "Crown" },
    { id: "propeller", name: "Propeller" },
    { id: "cowboyHat", name: "Cowboy Hat" },
    { id: "bow", name: "Big Bow" },
    { id: "flower", name: "Flower" },
    { id: "flag", name: "Flag" },
    { id: "dish", name: "Radar Dish" },
    { id: "horns", name: "Horns" },
    { id: "halo", name: "Halo" },
  ];

  // Drivers: skin and body colors, eyes (count and style), and what's on top of their head.
  const DRIVERS = [
    { id: "zib", name: "Zib", skin: "#8dff5a", body: "#6ee86e", eyes: 2, eyeStyle: "alien", top: "bobbles", bob: "#ffe36b" },
    { id: "blorp", name: "Blorp", skin: "#c08cff", body: "#9a6ae8", eyes: 1, eyeStyle: "round", top: "stalk", bob: "#ff5fb4" },
    { id: "trix", name: "Trix", skin: "#6fd8ff", body: "#3fa8e0", eyes: 3, eyeStyle: "round", top: "bobbles", bob: "#ff5fb4" },
    { id: "grey", name: "Grey", skin: "#cfd3e0", body: "#a3a8bc", eyes: 2, eyeStyle: "big", top: "none", ry: 14.5 },
    { id: "gloop", name: "Gloop", skin: "#ff9ad0", body: "#f06aa8", eyes: 2, eyeStyle: "round", top: "tentacles", spots: "#e45a9c" },
    { id: "fuzz", name: "Fuzz", skin: "#ffb35a", body: "#f08a2a", eyes: 2, eyeStyle: "round", top: "bear" },
    { id: "mew", name: "Mew", skin: "#7ff0d0", body: "#4fd6b0", eyes: 2, eyeStyle: "alien", top: "cat", whiskers: true },
    { id: "robo", name: "Robo", skin: "#b8c4d8", body: "#8a96ac", eyes: 2, eyeStyle: "alien", top: "bolt", robot: true },
  ];

  // ---------------------------------------------------------------- Shared pieces

  const gradients = new WeakMap();
  function hullGradient(ctx, hull) {
    let byHull = gradients.get(ctx);
    if (!byHull) {
      byHull = new Map();
      gradients.set(ctx, byHull);
    }
    let g = byHull.get(hull.id);
    if (!g) {
      g = ctx.createLinearGradient(0, -18, 0, 16);
      g.addColorStop(0, hull.g[0]);
      g.addColorStop(0.45, hull.g[1]);
      g.addColorStop(1, hull.g[2]);
      byHull.set(hull.id, g);
    }
    return g;
  }

  // Path pieces for the red hurt flash, so only the saucer itself is tinted.
  function pathEll(ctx, x, y, rx, ry, a0 = 0, a1 = TAU) {
    ctx.moveTo(x + Math.cos(a0) * rx, y + Math.sin(a0) * ry);
    ctx.ellipse(x, y, rx, ry, 0, a0, a1);
    ctx.closePath();
  }
  function pathPoly(ctx, pts) {
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  // Glass dome: the top half of an ellipse, with a shine.
  function dome(ctx, P, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fillStyle = P.glass;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    domeShine(ctx, cx, cy, Math.min(rx, ry) * 0.75);
  }
  function domeShine(ctx, cx, cy, r) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.2, Math.PI * 1.42);
    ctx.stroke();
  }

  // The trim stripe along the front of a disc.
  function band(ctx, P, cx, cy, rx, ry, w = 4) {
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
  }

  function shine(ctx, cx, cy, rx, ry) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();
  }

  // The little window underneath, which brightens while the beam is on.
  function port(ctx, P, x, y, rx, ry) {
    D.ell(ctx, x, y, rx, ry, P.o.beam ? "#bfffee" : "#9fe7ff", 2.5);
  }

  // The pilot sits in a dome centred at cy, scaled by s.
  function pilot(ctx, P, cy, s = 1) {
    ctx.save();
    ctx.translate(0, cy + 8 * s);
    ctx.scale(s, s);
    drawDriver(ctx, P.S.driver, P.o, P.t);
    ctx.restore();
  }

  // Rim lights along the front of an ellipse, in the chosen pattern.
  function rimLights(ctx, P, rx, ry, cy, n = 7, a0 = 0.13, a1 = 0.87, size = 4.4) {
    const mode = P.S.lights.id;
    const t = P.t;
    const color = P.S.lightColor.c;
    const speed = P.o.beam ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (a0 + (i / (n - 1)) * (a1 - a0));
      const lx = Math.cos(a) * rx;
      const ly = cy + Math.sin(a) * ry;
      let fill;
      let lit;
      if (mode === "rainbow") {
        const phase = (((i - t * speed) % n) + n) % n;
        lit = phase < 2;
        const hue = (i * 52 + t * 90) % 360;
        fill = lit ? `hsl(${hue}, 100%, 70%)` : `hsl(${hue}, 60%, 40%)`;
      } else if (mode === "chase") {
        const phase = (((i - t * speed) % n) + n) % n;
        lit = phase < 2;
        fill = color;
      } else if (mode === "steady") {
        lit = true;
        fill = color;
      } else if (mode === "twinkle") {
        lit = Math.sin(t * (5 + (i % 3)) + i * 2.3) > 0.35;
        fill = color;
      } else if (mode === "siren") {
        const left = i < n / 2;
        const on = Math.floor(t * (P.o.beam ? 8 : 4)) % 2 === 0;
        lit = left === on;
        fill = left ? "#ff3b4a" : "#3b8cff";
      } else if (mode === "disco") {
        lit = true;
        fill = `hsl(${(t * 300 + i * 70) % 360}, 100%, 65%)`;
      } else {
        lit = false;
        fill = "#5a5470";
      }
      D.circ(ctx, lx, ly, size, lit || mode === "rainbow" || mode === "off" ? fill : "#3a3352", 2);
      if (!lit && mode !== "rainbow" && mode !== "off") {
        // Unlit bulbs keep a hint of their color.
        ctx.globalAlpha *= 0.35;
        D.circ(ctx, lx, ly, size - 1, fill, 0);
        ctx.globalAlpha /= 0.35;
      }
      if (lit) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.35;
        D.circ(ctx, lx, ly, size * 2, fill, 0);
        ctx.globalAlpha = prev;
      }
    }
  }

  // ---------------------------------------------------------------- Ships

  const SHIPS = [
    {
      id: "classic",
      name: "Classic Saucer",
      draw(ctx, P) {
        D.ell(ctx, 0, 8, 44, 14, P.under, 3);
        port(ctx, P, 0, 15, 20, 6);
        pilot(ctx, P, -8);
        dome(ctx, P, 0, -8, 31, 29);
        accessory(ctx, P, -37);
        D.ell(ctx, 0, 0, 66, 17, P.hull, 3);
        band(ctx, P, 0, 2, 60, 11);
        shine(ctx, 0, -2, 50, 10);
        rimLights(ctx, P, 54, 9, 3, 7);
      },
      flash(ctx) {
        pathEll(ctx, 0, 0, 66, 17);
        pathEll(ctx, 0, 8, 44, 14, 0, Math.PI);
        pathEll(ctx, 0, -8, 31, 29, Math.PI, TAU);
      },
    },
    {
      id: "mothership",
      name: "Mothership",
      draw(ctx, P) {
        D.ell(ctx, 0, 12, 40, 10, P.under, 3);
        for (const x of [-26, 26]) D.circ(ctx, x, 19, 4, P.under, 2.5);
        port(ctx, P, 0, 18, 16, 5);
        pilot(ctx, P, -18, 0.8);
        dome(ctx, P, 0, -18, 24, 20);
        accessory(ctx, P, -38);
        D.ell(ctx, 0, -8, 44, 10, P.hull, 3);
        for (let i = 0; i < 5; i++) D.circ(ctx, -28 + i * 14, -11, 2.8, "#bff6ff", 1.8);
        D.ell(ctx, 0, 6, 70, 13, P.hull, 3);
        band(ctx, P, 0, 8, 64, 8);
        shine(ctx, 0, 3, 56, 8);
        rimLights(ctx, P, 60, 6, 9, 9, 0.1, 0.9, 4);
      },
      flash(ctx) {
        pathEll(ctx, 0, 6, 70, 13);
        pathEll(ctx, 0, -8, 44, 10);
        pathEll(ctx, 0, 12, 40, 10, 0, Math.PI);
        pathEll(ctx, 0, -18, 24, 20, Math.PI, TAU);
      },
    },
    {
      id: "diamond",
      name: "Diamond",
      draw(ctx, P) {
        D.poly(ctx, [-36, 14, 36, 14, 12, 28, -12, 28], P.under, 3);
        port(ctx, P, 0, 25, 10, 3.5);
        pilot(ctx, P, -14, 0.85);
        D.poly(ctx, [-30, -10, -20, -34, 20, -34, 30, -10], P.glass, 3);
        D.line(ctx, -18, -28, -24, -14, "rgba(255,255,255,0.85)", 3.5);
        accessory(ctx, P, -34);
        D.poly(ctx, [-72, 2, -42, -12, 42, -12, 72, 2, 42, 16, -42, 16], P.hull, 3);
        D.line(ctx, -42, -12, -30, 2, P.dark, 2);
        D.line(ctx, 42, -12, 30, 2, P.dark, 2);
        D.line(ctx, -64, 4, 64, 4, P.trim, 4);
        D.line(ctx, -50, -6, -20, -6, "rgba(255,255,255,0.9)", 3);
        rimLights(ctx, P, 56, 6, 8, 7, 0.12, 0.88, 4.2);
      },
      flash(ctx) {
        pathPoly(ctx, [-72, 2, -42, -12, 42, -12, 72, 2, 42, 16, -42, 16]);
        pathPoly(ctx, [-36, 14, 36, 14, 12, 28, -12, 28]);
        pathPoly(ctx, [-30, -10, -20, -34, 20, -34, 30, -10]);
      },
    },
    {
      id: "ring",
      name: "Ring Runner",
      draw(ctx, P) {
        ring(ctx, P, Math.PI, TAU);
        D.ell(ctx, 0, 6, 34, 20, P.hull, 3);
        port(ctx, P, 0, 22, 14, 4);
        pilot(ctx, P, -10, 0.85);
        dome(ctx, P, 0, -10, 26, 25);
        accessory(ctx, P, -35);
        band(ctx, P, 0, 6, 30, 12, 3.5);
        ring(ctx, P, 0, Math.PI);
        rimLights(ctx, P, 66, 15, 4, 9, 0.06, 0.94, 4);
      },
      flash(ctx) {
        ctx.moveTo(73, 4);
        ctx.ellipse(0, 4, 73, 22, 0, 0, TAU);
        ctx.moveTo(59, 4);
        ctx.ellipse(0, 4, 59, 10, 0, TAU, 0, true);
        pathEll(ctx, 0, 6, 34, 20);
        pathEll(ctx, 0, -10, 26, 25, Math.PI, TAU);
      },
    },
    {
      id: "bubble",
      name: "Bubble Pod",
      draw(ctx, P) {
        for (const s of [-1, 1]) D.poly(ctx, [s * 48, 8, s * 74, -14, s * 66, 14], P.trim, 3);
        D.ell(ctx, 0, 18, 26, 9, P.under, 3);
        port(ctx, P, 0, 24, 12, 3.5);
        pilot(ctx, P, -6, 0.95);
        D.circ(ctx, 0, -6, 32, P.glass, 3);
        domeShine(ctx, 0, -6, 24);
        accessory(ctx, P, -38);
        D.ell(ctx, 0, 12, 62, 11, P.hull, 3);
        band(ctx, P, 0, 13, 56, 7);
        shine(ctx, 0, 9, 50, 7);
        rimLights(ctx, P, 54, 6, 14, 7, 0.13, 0.87, 4);
      },
      flash(ctx) {
        pathEll(ctx, 0, 12, 62, 11);
        pathEll(ctx, 0, -6, 32, 32);
        pathEll(ctx, 0, 18, 26, 9, 0, Math.PI);
      },
    },
    {
      id: "bell",
      name: "Retro Bell",
      draw(ctx, P) {
        for (const [x, y] of [[-34, 18], [0, 21], [34, 18]]) {
          D.circ(ctx, x, y, 8, P.under, 3);
          D.circ(ctx, x - 2.5, y - 2.5, 2.5, "rgba(255,255,255,0.6)", 0);
        }
        pilot(ctx, P, -18, 0.75);
        dome(ctx, P, 0, -18, 21, 20);
        accessory(ctx, P, -38);
        bellPath(ctx);
        ctx.fillStyle = P.hull;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.line(ctx, -36, -6, 36, -6, P.dark, 2);
        for (let i = 0; i < 5; i++) D.circ(ctx, -28 + i * 14, -11, 3.2, "#bff6ff", 1.8);
        band(ctx, P, 0, 4, 58, 7);
        rimLights(ctx, P, 60, 7, 10, 9, 0.08, 0.92, 3.8);
      },
      flash(ctx) {
        bellPath(ctx, true);
        pathEll(ctx, 0, -18, 21, 20, Math.PI, TAU);
        for (const [x, y] of [[-34, 18], [0, 21], [34, 18]]) pathEll(ctx, x, y, 8, 8);
      },
    },
    {
      id: "jelly",
      name: "Space Jelly",
      draw(ctx, P) {
        ctx.lineCap = "round";
        for (let i = 0; i < 5; i++) {
          const x = -32 + i * 16;
          const w = Math.sin(P.t * 4 + i) * 5;
          ctx.beginPath();
          ctx.moveTo(x, 6);
          ctx.quadraticCurveTo(x + w, 20, x - w * 0.6, 34);
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.strokeStyle = P.trim;
          ctx.lineWidth = 4.5;
          ctx.stroke();
        }
        pilot(ctx, P, -6, 1);
        dome(ctx, P, 0, -4, 40, 34);
        accessory(ctx, P, -38);
        D.ell(ctx, 0, 2, 52, 11, P.hull, 3);
        shine(ctx, 0, -1, 42, 7);
        rimLights(ctx, P, 46, 7, 4, 7, 0.1, 0.9, 4);
      },
      flash(ctx) {
        pathEll(ctx, 0, 2, 52, 11);
        pathEll(ctx, 0, -4, 40, 34, Math.PI, TAU);
      },
    },
    {
      id: "star",
      name: "Star Cruiser",
      draw(ctx, P) {
        D.ell(ctx, 0, 8, 40, 13, P.under, 3);
        port(ctx, P, 0, 15, 18, 5);
        pilot(ctx, P, -8, 0.95);
        dome(ctx, P, 0, -8, 30, 28);
        accessory(ctx, P, -36);
        D.poly(ctx, starPoints(), P.hull, 3);
        band(ctx, P, 0, 2, 52, 9);
        shine(ctx, 0, -2, 44, 8);
        rimLights(ctx, P, 50, 8, 3, 7, 0.12, 0.88, 4.2);
      },
      flash(ctx) {
        pathPoly(ctx, starPoints());
        pathEll(ctx, 0, 8, 40, 13, 0, Math.PI);
        pathEll(ctx, 0, -8, 30, 28, Math.PI, TAU);
      },
    },
    {
      id: "teacup",
      name: "Teacup",
      draw(ctx, P) {
        D.ell(ctx, 0, 20, 56, 8, P.hull, 3);
        D.ell(ctx, 0, 19, 30, 4, P.dark, 0);
        // Handle.
        ctx.beginPath();
        ctx.ellipse(48, 2, 13, 11, 0, 0, TAU);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 10;
        ctx.stroke();
        ctx.strokeStyle = P.mid;
        ctx.lineWidth = 5;
        ctx.stroke();
        pilot(ctx, P, -12, 0.9);
        dome(ctx, P, 0, -12, 32, 26);
        accessory(ctx, P, -38);
        cupPath(ctx);
        ctx.fillStyle = P.hull;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.ell(ctx, 0, -12, 50, 6, P.mid, 3);
        band(ctx, P, 0, -4, 46, 8);
        rimLights(ctx, P, 36, 8, 4, 6, 0.12, 0.88, 3.8);
      },
      flash(ctx) {
        cupPath(ctx, true);
        pathEll(ctx, 0, 20, 56, 8);
        pathEll(ctx, 0, -12, 32, 26, Math.PI, TAU);
      },
    },
    {
      id: "burger",
      name: "Burger Bomber",
      draw(ctx, P) {
        D.ell(ctx, 0, 14, 52, 11, P.hull, 3);
        // Top bun, with sesame seeds and a round window for the pilot.
        ctx.beginPath();
        ctx.ellipse(0, -2, 52, 34, 0, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = P.hull;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        for (const [x, y, r] of [[-34, -14, 0.5], [-24, -26, -0.3], [26, -26, 0.4], [36, -12, -0.5], [-42, -4, 0.2], [44, -4, -0.2], [0, -33, 0]]) {
          D.ell(ctx, x, y, 3.2, 1.8, "#fff6dc", 1.2, r);
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, -12, 17, 0, TAU);
        ctx.fillStyle = "#2a2050";
        ctx.fill();
        ctx.clip();
        pilot(ctx, P, -17, 0.72);
        ctx.restore();
        D.circ(ctx, 0, -12, 17, P.glass, 3);
        domeShine(ctx, 0, -12, 12);
        accessory(ctx, P, -36);
        D.ell(ctx, 0, 6, 58, 8, "#7a3f22", 3);
        for (const x of [-40, -14, 14, 40]) D.poly(ctx, [x - 11, 1, x + 11, 1, x, 13], "#ffd23f", 2);
        // Lettuce, in the trim color.
        ctx.beginPath();
        ctx.moveTo(-58, -3);
        ctx.lineTo(58, -3);
        for (let x = 58; x > -58; x -= 12) ctx.quadraticCurveTo(x - 6, 9, x - 12, 2);
        ctx.closePath();
        ctx.fillStyle = P.trim;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        rimLights(ctx, P, 44, 7, 17, 7, 0.14, 0.86, 3.6);
      },
      flash(ctx) {
        pathEll(ctx, 0, 14, 52, 11);
        pathEll(ctx, 0, 6, 58, 8);
        pathEll(ctx, 0, -2, 52, 34, Math.PI, TAU);
      },
    },
  ];

  function ring(ctx, P, a0, a1) {
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.ellipse(0, 4, 66, 16, 0, a0, a1);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 14;
    ctx.stroke();
    ctx.strokeStyle = P.mid;
    ctx.lineWidth = 8.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 4, 66, 16, 0, a0, a1);
    ctx.strokeStyle = P.trim;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  function bellPath(ctx, keep) {
    if (!keep) ctx.beginPath();
    ctx.moveTo(-66, 10);
    ctx.quadraticCurveTo(-46, -6, -24, -18);
    ctx.lineTo(24, -18);
    ctx.quadraticCurveTo(46, -6, 66, 10);
    ctx.ellipse(0, 10, 66, 9, 0, 0, Math.PI);
    ctx.closePath();
  }

  function cupPath(ctx, keep) {
    if (!keep) ctx.beginPath();
    ctx.moveTo(-50, -12);
    ctx.lineTo(50, -12);
    ctx.quadraticCurveTo(46, 16, 22, 18);
    ctx.lineTo(-22, 18);
    ctx.quadraticCurveTo(-46, 16, -50, -12);
    ctx.closePath();
  }

  let starCache = null;
  function starPoints() {
    if (!starCache) {
      starCache = [];
      const n = 10;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * TAU;
        const r = i % 2 ? 56 : 74;
        starCache.push(Math.cos(a) * r, Math.sin(a) * r * 0.26);
      }
    }
    return starCache;
  }

  // ---------------------------------------------------------------- Accessories

  // Drawn on top of the dome; `top` is the y of the dome's highest point.
  function accessory(ctx, P, top) {
    const t = P.t;
    const trim = P.trim;
    ctx.lineCap = "round";
    switch (P.S.accessory.id) {
      case "antenna": {
        D.line(ctx, 0, top, 0, top - 9, OUT, 3);
        const blink = Math.sin(t * 6) > 0;
        const c = P.S.lights.id === "rainbow" ? "#ff5fb4" : P.S.lightColor.c;
        D.circ(ctx, 0, top - 11, 4.5, blink ? c : "#f4eaff", 2.5);
        break;
      }
      case "partyHat":
        D.poly(ctx, [-12, top + 4, 12, top + 4, 0, top - 22], trim, 2.5);
        D.line(ctx, -6, top - 6, 5, top - 2, "#ffffff", 2.5);
        D.line(ctx, -3, top - 14, 3, top - 12, "#ffffff", 2.5);
        D.circ(ctx, 0, top - 23, 4, "#ffffff", 2);
        break;
      case "crown":
        D.poly(ctx, [-15, top + 3, 15, top + 3, 16, top - 12, 8, top - 4, 0, top - 15, -8, top - 4, -16, top - 12], "#ffd23f", 2.5);
        D.circ(ctx, 0, top - 2, 2.8, trim, 1.5);
        D.circ(ctx, -9, top, 2, trim, 1.5);
        D.circ(ctx, 9, top, 2, trim, 1.5);
        break;
      case "propeller": {
        ctx.beginPath();
        ctx.arc(0, top + 4, 13, Math.PI, TAU);
        ctx.closePath();
        ctx.fillStyle = trim;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.line(ctx, 0, top - 9, 0, top - 3, OUT, 2.5);
        const w = Math.cos(t * 25) * 18;
        D.ell(ctx, -w / 2, top - 11, Math.abs(w) / 2 + 1.5, 3, "#ffd23f", 2);
        D.ell(ctx, w / 2, top - 11, Math.abs(w) / 2 + 1.5, 3, "#5fd0ff", 2);
        D.circ(ctx, 0, top - 11, 2.5, "#e8463c", 1.5);
        break;
      }
      case "cowboyHat":
        D.rect(ctx, -11, top - 15, 22, 17, "#a0612f", 2.5, 6);
        D.rect(ctx, -11, top - 4, 22, 4, trim, 0);
        D.ell(ctx, 0, top + 2, 24, 5, "#8a5a2b", 2.5);
        break;
      case "bow":
        D.poly(ctx, [0, top - 4, -18, top - 15, -18, top + 5], trim, 2.5);
        D.poly(ctx, [0, top - 4, 18, top - 15, 18, top + 5], trim, 2.5);
        D.circ(ctx, 0, top - 5, 4.5, trim, 2.5);
        break;
      case "flower": {
        const sway = Math.sin(t * 2) * 3;
        const fx = sway;
        const fy = top - 20;
        ctx.strokeStyle = "#3fae5a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, top + 2);
        ctx.quadraticCurveTo(-3, top - 10, fx, fy);
        ctx.stroke();
        D.ell(ctx, 5, top - 8, 5, 2.5, "#4fc35a", 1.5, -0.5);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + t * 0.5;
          D.circ(ctx, fx + Math.cos(a) * 6, fy + Math.sin(a) * 6, 4.2, trim, 1.8);
        }
        D.circ(ctx, fx, fy, 4, "#ffd23f", 1.8);
        break;
      }
      case "flag": {
        D.line(ctx, 0, top + 2, 0, top - 30, OUT, 2.5);
        const w = Math.sin(t * 6) * 2.5;
        D.poly(ctx, [1, top - 29, 24, top - 27 + w, 24, top - 15 + w, 1, top - 17], trim, 2);
        D.star(ctx, 12, top - 22 + w / 2, 4, "#ffffff", 0);
        D.circ(ctx, 0, top - 31, 2.5, "#ffd23f", 1.5);
        break;
      }
      case "dish":
        D.line(ctx, 0, top + 1, 0, top - 10, OUT, 3);
        ctx.save();
        ctx.translate(0, top - 13);
        ctx.rotate(Math.sin(t * 0.9) * 0.6 - 0.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI);
        ctx.closePath();
        ctx.fillStyle = "#e9e4f2";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.line(ctx, 0, 3, 0, -8, OUT, 2);
        D.circ(ctx, 0, -9, 2.4, Math.sin(t * 5) > 0 ? trim : "#f4eaff", 1.5);
        ctx.restore();
        break;
      case "horns":
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 17, top + 8);
          ctx.quadraticCurveTo(s * 25, top - 5, s * 19, top - 15);
          ctx.quadraticCurveTo(s * 15, top - 3, s * 7, top + 5);
          ctx.closePath();
          ctx.fillStyle = "#ff3b4a";
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = OUT;
          ctx.stroke();
        }
        break;
      case "halo": {
        const y = top - 12 + Math.sin(t * 2) * 1.5;
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * 0.3;
        D.ell(ctx, 0, y, 22, 8, "#fff3a0", 0);
        ctx.globalAlpha = prev;
        ctx.beginPath();
        ctx.ellipse(0, y, 15, 4.5, 0, 0, TAU);
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 6.5;
        ctx.stroke();
        ctx.strokeStyle = "#ffe36b";
        ctx.lineWidth = 3.5;
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- Driver

  const EYE_SPOTS = {
    1: [[0, -1, 6.2]],
    2: [[-5.5, -1, 4.5], [5.5, -1, 4.5]],
    3: [[-7, 0, 3.6], [0, -5.5, 3.6], [7, 0, 3.6]],
  };

  function drawDriver(ctx, dr, o, t) {
    const look = U.clamp(o.look || 0, -1, 1);
    const bob = Math.sin(t * 3) * 1.2;
    const hx = look * 6;
    const hy = -16 + bob;
    const mood = o.cheer ? "happy" : o.mood || "normal";

    // Body, and arms up when cheering.
    if (dr.robot) D.rect(ctx, hx * 0.6 - 12, -9, 24, 17, dr.body, 2.5, 5);
    else D.ell(ctx, hx * 0.6, -1, 13, 9, dr.body, 2.5);
    if (o.cheer) {
      const w = Math.sin(t * 20) * 0.4;
      D.limb(ctx, hx - 9, -4, hx - 17, -22 + w * 6, 3.5, dr.body, 2);
      D.limb(ctx, hx + 9, -4, hx + 17, -22 - w * 6, 3.5, dr.body, 2);
    }

    // Whatever is on top of the head goes behind it.
    const sway = Math.sin(t * 4) * 3;
    switch (dr.top) {
      case "bobbles":
        D.line(ctx, hx - 5, hy - 10, hx - 9 + sway, hy - 21, OUT, 2);
        D.line(ctx, hx + 5, hy - 10, hx + 9 + sway, hy - 21, OUT, 2);
        D.circ(ctx, hx - 9 + sway, hy - 22, 3, dr.bob, 1.8);
        D.circ(ctx, hx + 9 + sway, hy - 22, 3, dr.bob, 1.8);
        break;
      case "stalk":
        D.line(ctx, hx, hy - 11, hx + sway, hy - 24, OUT, 2.2);
        D.circ(ctx, hx + sway, hy - 26, 3.8, dr.bob, 1.8);
        break;
      case "tentacles":
        ctx.lineCap = "round";
        // Short curly tentacles, flopping outward.
        for (const k of [-1, 0, 1]) {
          const w = sway * 0.4;
          ctx.beginPath();
          ctx.moveTo(hx + k * 7, hy - 9);
          ctx.quadraticCurveTo(hx + k * 6 + w, hy - 20, hx + k * 14 + w + (k === 0 ? 5 : 0), hy - 18);
          ctx.strokeStyle = OUT;
          ctx.lineWidth = 6.5;
          ctx.stroke();
          ctx.strokeStyle = dr.skin;
          ctx.lineWidth = 3.5;
          ctx.stroke();
          D.circ(ctx, hx + k * 14 + w + (k === 0 ? 5 : 0), hy - 18, 2.4, dr.spots || dr.skin, 1.5);
        }
        break;
      case "bear":
        for (const s of [-1, 1]) {
          D.circ(ctx, hx + s * 10, hy - 9, 5.5, dr.skin, 2.5);
          D.circ(ctx, hx + s * 10, hy - 9, 2.6, dr.body, 0);
        }
        break;
      case "cat":
        for (const s of [-1, 1]) {
          D.poly(ctx, [hx + s * 13, hy - 3, hx + s * 12, hy - 20, hx + s * 3, hy - 10], dr.skin, 2.5);
          D.poly(ctx, [hx + s * 11, hy - 7, hx + s * 11, hy - 15, hx + s * 6, hy - 10], "#ff9ad0", 0);
        }
        break;
      case "bolt":
        D.line(ctx, hx, hy - 11, hx, hy - 20, OUT, 2.2);
        D.circ(ctx, hx, hy - 22, 3, Math.sin(t * 5) > 0 ? "#ff3b4a" : "#7a1d2a", 1.8);
        break;
      default:
        break;
    }

    // Head.
    if (dr.robot) {
      D.rect(ctx, hx - 14, hy - 12, 28, 24, dr.skin, 2.5, 6);
      D.rect(ctx, hx - 11, hy - 8, 22, 13, "#bff6ff", 2, 4);
    } else {
      D.ell(ctx, hx, hy, 14, dr.ry || 12.5, dr.skin, 2.5);
    }
    if (dr.spots) {
      D.circ(ctx, hx - 9, hy - 6, 1.8, dr.spots, 0);
      D.circ(ctx, hx + 10, hy - 4, 1.4, dr.spots, 0);
      D.circ(ctx, hx + 7, hy - 9, 1.2, dr.spots, 0);
    }

    // Eyes.
    const blink = (t % 3.7) < 0.12;
    const ex = hx + look * 3;
    const spots = dr.eyeStyle === "big" ? [[-6, 0, 5.2], [6, 0, 5.2]] : EYE_SPOTS[dr.eyes];
    for (const [dx, dy, r0] of spots) {
      const r = dr.robot ? r0 * 0.78 : r0;
      const x = ex + dx;
      const y = hy + dy;
      if (mood === "happy") D.eye(ctx, x, y, r, 0, 0, "happy");
      else if (mood === "dizzy") D.eye(ctx, x, y, r, 0, 0, "dizzy", t);
      else if (blink) D.line(ctx, x - r * 0.8, y, x + r * 0.8, y, OUT, 2.5);
      else if (dr.eyeStyle === "round") D.eye(ctx, x, y, r, look * 0.6, -0.1, "normal");
      else {
        const tilt = (dx === 0 ? 0 : Math.sign(dx)) * (dr.eyeStyle === "big" ? 0.5 : 0.35);
        ctx.fillStyle = OUT;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.93, r * 1.24, tilt, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x - 1 + look, y - r * 0.45, Math.max(1.2, r * 0.35), 0, TAU);
        ctx.fill();
      }
    }

    // Mouth.
    const my = hy + (dr.robot ? 8.5 : dr.eyes === 1 ? 7.5 : 6);
    if (mood === "worried") {
      D.mouth(ctx, hx + look * 2, my + 1, 6, "wavy");
      D.sweat(ctx, hx + 13, hy - 8, 3.5, t);
    } else if (mood === "happy") {
      D.mouth(ctx, hx + look * 2, my, 7, "grin");
    } else {
      D.mouth(ctx, hx + look * 2, my, 5, "smile");
    }
    if (dr.whiskers) {
      for (const s of [-1, 1]) {
        D.line(ctx, hx + s * 8, hy + 4, hx + s * 17, hy + 2, OUT, 1.3);
        D.line(ctx, hx + s * 8, hy + 6, hx + s * 17, hy + 7, OUT, 1.3);
      }
    }
  }

  // ---------------------------------------------------------------- Style

  const PARTS = {
    ship: SHIPS,
    hull: HULLS,
    trim: TRIMS,
    dome: DOMES,
    lights: LIGHT_MODES,
    lightColor: TRIMS,
    accessory: ACCESSORIES,
    driver: DRIVERS,
  };

  // Turns a saved style ({ ship: "classic", ... }) into the parts it names, using the default
  // for anything missing or unknown.
  function resolve(style) {
    const S = {};
    for (const key of Object.keys(PARTS)) {
      const list = PARTS[key];
      const want = style && style[key];
      S[key] = list.find((p) => p.id === want) || list.find((p) => p.id === U.UFO_DEFAULT[key]) || list[0];
    }
    return S;
  }

  function savedStyle() {
    return U.Storage && U.Storage.data ? U.Storage.data.ufo : null;
  }

  // o: { t, tilt, flash, mood, look, beam, scale, cheer, alpha, style }
  // `style` overrides the saved one (the customize screen uses it for previews).
  Art.drawUFO = function (ctx, x, y, o) {
    const t = o.t || 0;
    const S = resolve(o.style || savedStyle());
    ctx.save();
    ctx.translate(x, y);
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.rotate(o.tilt || 0);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;

    // Engine glow under the saucer.
    const pulse = 0.75 + Math.sin(t * 9) * 0.25;
    ctx.fillStyle = o.beam ? "rgba(120, 255, 220, 0.55)" : `rgba(120, 220, 255, ${0.35 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(0, 16, 38 * pulse, 10, 0, 0, U.TAU);
    ctx.fill();

    const P = {
      S,
      o,
      t,
      hull: hullGradient(ctx, S.hull),
      mid: S.hull.g[1],
      dark: S.hull.g[2],
      under: S.hull.under,
      trim: S.trim.c,
      glass: S.dome.c,
    };
    S.ship.draw(ctx, P);

    if (o.flash) {
      // A red wash over the ship, drawn as its own shapes so the scenery behind isn't tinted.
      ctx.fillStyle = "rgba(255, 70, 70, 0.6)";
      ctx.beginPath();
      S.ship.flash(ctx);
      ctx.fill();
    }
    ctx.restore();
  };

  // The driver on their own, for previews. Drawn around the middle of their body.
  Art.drawDriver = function (ctx, x, y, scale, driverId, o = {}) {
    const dr = DRIVERS.find((d) => d.id === driverId) || DRIVERS[0];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawDriver(ctx, dr, o, o.t || 0);
    ctx.restore();
  };

  // The saved driver's skin color, for the pilot's parachute escape after a crash.
  Art.driverSkin = function () {
    return resolve(savedStyle()).driver.skin;
  };

  Art.resolveUFO = resolve;
  U.UFO_PARTS = PARTS;

  // A shimmering bubble. `left` is the seconds remaining, so it flickers before it ends.
  Art.drawShield = function (ctx, x, y, t, left) {
    if (left < 2 && Math.floor(t * 10) % 2 === 0) return;
    const r = 84 + Math.sin(t * 6) * 3;
    const g = ctx.createRadialGradient(x, y - 6, r * 0.55, x, y - 6, r);
    g.addColorStop(0, "rgba(120, 240, 255, 0)");
    g.addColorStop(0.8, "rgba(120, 240, 255, 0.18)");
    g.addColorStop(1, "rgba(180, 255, 255, 0.55)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 6, r, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 255, 255, ${0.6 + Math.sin(t * 9) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 6, r - 10, Math.PI * 1.15 + t, Math.PI * 1.35 + t);
    ctx.stroke();
  };
})(window.UFO);
