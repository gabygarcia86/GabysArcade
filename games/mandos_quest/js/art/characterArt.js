/* The Mandalorian, Baby G and Moff Gideon. */
(function (MQ) {
  const { box, poly, oval, line, glow, metal, shade, alpha, clamp } = MQ.U;
  const INK = MQ.INK;
  const { sin, abs, max } = Math;

  /* ---------- Mandalorian armor ---------- */

  function scratches(ctx, color, x, y, scale = 1) {
    line(ctx, x - 5 * scale, y - 2 * scale, x + 1 * scale, y + 3 * scale, shade(color, -0.45), 1);
    line(ctx, x + 2 * scale, y - 4 * scale, x + 4 * scale, y, shade(color, 0.45), 0.9);
    line(ctx, x - 2 * scale, y + 4 * scale, x + 3 * scale, y + 5 * scale, shade(color, -0.35), 0.8);
  }

  function helmetShape(ctx, style) {
    ctx.beginPath();
    if (style === "heavy") {
      ctx.moveTo(-14.5, 11);
      ctx.lineTo(-14.5, -5);
      ctx.bezierCurveTo(-14.5, -19, 14.5, -19, 14.5, -5);
      ctx.lineTo(15.5, 8);
      ctx.lineTo(10, 14);
      ctx.lineTo(-10, 14);
    } else if (style === "scout") {
      ctx.moveTo(-12, 8);
      ctx.lineTo(-12.5, -4);
      ctx.bezierCurveTo(-11, -17, 12, -17, 13, -4);
      ctx.lineTo(12, 7);
      ctx.lineTo(7, 12);
      ctx.lineTo(-6, 11);
    } else {
      ctx.moveTo(-12.5, 10);
      ctx.lineTo(-13, -3);
      ctx.bezierCurveTo(-13, -18, 13, -18, 13, -3);
      ctx.lineTo(13.5, 6);
      ctx.lineTo(11, 12.5);
      ctx.lineTo(3, 11.5);
      ctx.lineTo(-6, 12.5);
    }
    ctx.closePath();
  }

  const PAINT = {
    stripe: (ctx, c) => poly(ctx, [1, -20, 6, -20, 7.5, -5, 2.5, -5], c),
    brow: (ctx, c) => poly(ctx, [-18, -11, 18, -11, 18, -6, -18, -6.5], c),
    cheeks(ctx, c) {
      poly(ctx, [-9, 1, 1, 1.5, 0, 11, -8, 11], c);
      poly(ctx, [9, 1, 18, 1, 18, 9, 10, 11], c);
    },
    chevrons(ctx, c) {
      for (let i = 0; i < 2; i++) {
        const y = -15 + i * 4.5;
        poly(ctx, [-5, y + 4, 4, y, 11, y + 4, 11, y + 6, 4, y + 2.4, -5, y + 6.4], c);
      }
    },
    split: (ctx, c) => poly(ctx, [-20, -20, 4, -20, 4, 18, -20, 18], c),
    war(ctx, c) {
      poly(ctx, [-18, -14, 2, -8, -6, -5, 0, 0, -18, 7], c);
      poly(ctx, [10, 2, 18, -1, 18, 5, 12, 12], c);
      line(ctx, 7, -15, 9, -9, c, 2.4);
    },
  };

  function helmet(ctx, look, time = 0) {
    const { style, color, paint, accent } = look.helmet;
    const dark = shade(color, -0.45);
    box(ctx, -6, 8, 12, 7, 2, "#22232a");

    helmetShape(ctx, style);
    ctx.fillStyle = metal(ctx, color, -17, 13);
    ctx.fill();
    ctx.save();
    ctx.clip();
    poly(ctx, [-16, -2, -8, -4, -9, 14, -16, 14], alpha(dark, 0.6)); // Shaded back of the helmet.
    PAINT[paint]?.(ctx, accent);
    if (style === "damaged") {
      scratches(ctx, color, -5, -8, 1.3);
      scratches(ctx, color, 8, 7, 0.8);
      oval(ctx, -7, 5, 3, 2.2, dark);
    }
    ctx.restore();
    helmetShape(ctx, style);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.stroke();

    line(ctx, -5, -12.5, 2, -14, "rgba(255,255,255,0.5)", 2);
    line(ctx, -10.5, -4, -10.5, 4, "rgba(255,255,255,0.15)", 1.4);
    poly(ctx, [-9, 1, -4, 2, -4, 9, -8, 10], null, alpha(dark, 0.9), 1.1);
    line(ctx, -1, 5.5, 0, 9, dark, 1);
    line(ctx, 11.5, 5, 11, 9, dark, 1);

    const visor =
      style === "scout" ? [-6, -4, 12.5, -4, 12.5, 1, 8, 1.5, 7, 6, 4.5, 6, 3.5, 1.5, -5, 0.5]
      : style === "heavy" ? [-7, -5.5, 15, -5.5, 15, -0.5, 8.5, 0, 8.5, 11, 4, 11, 4, 0, -6, -1]
      : [-6.5, -4.5, 12.8, -4.5, 12.8, 0, 8, 0.6, 7.2, 11, 4.2, 11, 3.6, 0.7, -5.5, 0];
    poly(ctx, visor, look.visor, INK, 1.2);
    line(ctx, -3.5, -3, 4, -3, "rgba(255,255,255,0.4)", 1.2);
    line(ctx, 5.5, 2, 5.6, 7, "rgba(255,255,255,0.16)", 1);
    if (look.visor !== "#0b0d12") glow(ctx, 5, -1.5, 12, look.visor, 0.3);

    // Ear cap
    oval(ctx, -9.5, -1.5, 2.6, 3.4, metal(ctx, color, -5, 2), INK, 1);

    if (style === "heavy") {
      poly(ctx, [-13, -9, 14, -9, 15.5, -5.5, -14, -5.5], metal(ctx, color, -9, -5), INK, 1);
      box(ctx, -3, -18, 8, 4, 1, shade(color, -0.2), INK, 1);
    } else if (style === "scout") {
      line(ctx, -10, -6, -12, -22, INK, 2.5);
      oval(ctx, -12, -22, 1.8, 1.8, sin(time * 5) > 0 ? "#ff5348" : "#7a2824");
      poly(ctx, [-11, -8, 13, -8, 17, -4.5, -11, -5], shade(color, -0.15), INK, 1);
    } else if (style === "reinforced") {
      poly(ctx, [0, -15.5, 6, -14, 8, -6, 2, -6], metal(ctx, shade(color, -0.1), -15, -6), INK, 1);
      for (const x of [-6, 11]) oval(ctx, x, -7, 1.2, 1.2, shade(color, 0.5), INK, 0.6);
      poly(ctx, [-11, 6, -5, 8, -5, 12, -11, 11], metal(ctx, color, 6, 12), INK, 1);
    } else if (style === "damaged") {
      ctx.beginPath();
      ctx.moveTo(-2, -15);
      ctx.lineTo(1, -11);
      ctx.lineTo(-1, -9);
      ctx.lineTo(3, -6);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }
  }

  // One chest design for each armor set, in torso space.
  const CHEST = {
    classic(ctx, c) {
      const fill = metal(ctx, c, -28, -12);
      poly(ctx, [-12, -27, -1, -27, -1, -17, -9, -13, -12, -19], fill, INK, 1.3);
      poly(ctx, [1.5, -27, 12.5, -27, 12.5, -19, 8, -12, 1.5, -17], fill, INK, 1.3);
      poly(ctx, [1, -15, 5.5, -9.5, 1, -4.5, -3.5, -9.5], metal(ctx, c, -15, -4), INK, 1.2);
      line(ctx, 3.5, -25, 10, -25, "rgba(255,255,255,0.45)", 1.4);
    },
    worn(ctx, c, s) {
      CHEST.classic(ctx, c);
      poly(ctx, [1.5, -27, 12.5, -27, 12.5, -19, 8, -12, 1.5, -17], alpha(s.trim, 0.35));
      scratches(ctx, c, -6, -21);
      scratches(ctx, c, 7, -18, 0.8);
    },
    scout(ctx, c, s) {
      box(ctx, -8, -26, 19, 14, 4, metal(ctx, c, -26, -12), INK, 1.3);
      line(ctx, -11, -27, 10, -3, s.trim, 3);
      box(ctx, 3, -11, 7, 7, 1.5, shade(s.trim, -0.35), INK, 1);
    },
    heavy(ctx, c, s) {
      poly(ctx, [-15, -29, 15, -29, 16, -15, 8, -9, -10, -9, -15, -15], metal(ctx, c, -29, -9), INK, 1.5);
      box(ctx, -8, -8.5, 17, 6, 1.5, metal(ctx, c, -9, -2), INK, 1.2);
      box(ctx, 2, -24, 10, 3, 1, s.trim);
      for (const x of [-11, -2, 12]) oval(ctx, x, -13, 1.2, 1.2, shade(c, 0.5), INK, 0.6);
      box(ctx, -13, -31, 26, 4, 2, shade(c, -0.3), INK, 1);
    },
    desert(ctx, c, s) {
      box(ctx, -10, -27, 22, 13, 6, metal(ctx, c, -27, -14), INK, 1.3);
      for (let i = 0; i < 3; i++) line(ctx, -10, -11 + i * 4, 11, -13 + i * 4, i === 1 ? s.trim : shade(s.cloth, 0.15), 3);
    },
    shadow(ctx, c, s) {
      const fill = metal(ctx, c, -28, -8, 0.4);
      poly(ctx, [-13, -28, 0, -23, 13, -28, 11, -17, 1, -8, -10, -16], fill, INK, 1.3);
      line(ctx, -9, -22, 0, -18, s.trim, 1.3);
      line(ctx, 0, -18, 9, -22, s.trim, 1.3);
      line(ctx, 0.5, -17, 0.5, -11, s.trim, 1.3);
      glow(ctx, 0, -18, 12, s.trim, 0.3);
    },
    ancient(ctx, c, s) {
      for (let i = 0; i < 3; i++) {
        const y = -27 + i * 7;
        const w = 12.5 - i * 1.5;
        poly(ctx, [-w, y, w, y, w - 1, y + 5, 1, y + 9, -w + 1, y + 5], metal(ctx, c, y, y + 9), INK, 1.2);
      }
      poly(ctx, [1, -24, 4, -20, 1, -16, -2, -20], null, s.trim, 1.4);
      glow(ctx, 1, -20, 10, s.trim, 0.4);
    },
    arctic(ctx, c, s) {
      box(ctx, -12, -26, 25, 17, 5, metal(ctx, c, -26, -9, 0.2), INK, 1.3);
      line(ctx, 1, -25, 1, -10, shade(c, -0.3), 1.2);
      line(ctx, -11, -18, 12, -18, shade(c, -0.3), 1.2);
      box(ctx, 4, -16, 6, 3, 1, s.trim);
      for (let i = 0; i < 6; i++) oval(ctx, -11 + i * 4.6, -27, 3.6, 3.2, "#e8dfd0");
    },
    imperial(ctx, c, s) {
      poly(ctx, [-13, -27, 13, -27, 12, -10, -11, -10], metal(ctx, c, -27, -10), INK, 1.3);
      box(ctx, 2, -23, 9, 6, 1, "#15171b", INK, 1);
      for (let i = 0; i < 3; i++) box(ctx, 3 + i * 2.8, -22, 2, 4, 0, i === 1 ? "#d7dde3" : s.trim);
      line(ctx, -9, -14, -1, -14, shade(c, 0.4), 1.5);
    },
    royal(ctx, c, s) {
      poly(ctx, [-13, -28, 13, -28, 12, -17, 1, -7, -11, -17], metal(ctx, c, -28, -7, 0.36), s.trim, 2);
      ctx.beginPath();
      ctx.moveTo(-8, -23);
      ctx.quadraticCurveTo(-1, -23, 1, -15);
      ctx.quadraticCurveTo(3, -23, 10, -23);
      ctx.strokeStyle = s.trim;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      poly(ctx, [1, -22, 4, -19, 1, -16, -2, -19], "#e04756", s.trim, 1);
    },
  };

  const SHOULDER = {
    classic(ctx, c) {
      poly(ctx, [-7, 5, -7, -2, -4, -6, 3, -6, 7, -2, 7, 5, 0, 8], metal(ctx, c, -6, 8), INK, 1.3);
    },
    worn(ctx, c) {
      SHOULDER.classic(ctx, c);
      scratches(ctx, c, 0, 0, 0.7);
    },
    scout: (ctx, c) => box(ctx, -5.5, -5, 11, 10, 4, metal(ctx, c, -5, 5), INK, 1.3),
    heavy(ctx, c, s) {
      box(ctx, -9, -1, 18, 11, 3, shade(c, -0.25), INK, 1.3);
      box(ctx, -10, -8, 20, 12, 4, metal(ctx, c, -8, 4), INK, 1.3);
      box(ctx, -5, -3, 10, 2.4, 1, s.trim);
    },
    desert(ctx, c, s) {
      box(ctx, -7, -6, 14, 13, 6, metal(ctx, c, -6, 7), INK, 1.3);
      line(ctx, -6, 4, 6, 2, s.trim, 2.6);
    },
    shadow(ctx, c, s) {
      poly(ctx, [-12, -9, 2, -7, 8, 0, 1, 9, -7, 3], metal(ctx, c, -9, 9, 0.4), INK, 1.3);
      line(ctx, -7, -5, 3, 1, s.trim, 1.2);
    },
    ancient(ctx, c, s) {
      box(ctx, -7, 1, 14, 8, 2, metal(ctx, c, 1, 9), INK, 1.2);
      box(ctx, -8, -7, 16, 10, 3, metal(ctx, c, -7, 3), INK, 1.2);
      oval(ctx, 0, -2, 2, 2, s.trim);
    },
    arctic(ctx, c) {
      box(ctx, -8, -4, 16, 12, 5, metal(ctx, c, -4, 8, 0.2), INK, 1.3);
      for (let i = 0; i < 4; i++) oval(ctx, -6 + i * 4, -5, 3, 3, "#e8dfd0");
    },
    imperial(ctx, c, s) {
      box(ctx, -7.5, -6, 15, 13, 1.5, metal(ctx, c, -6, 7), INK, 1.3);
      box(ctx, -4, -2, 8, 2.5, 0, s.trim);
    },
    royal(ctx, c, s) {
      poly(ctx, [-12, -7, -2, -9, 7, -4, 8, 4, 0, 9, -7, 3], metal(ctx, c, -9, 9), s.trim, 1.7);
      oval(ctx, 0, 0, 1.8, 1.8, "#e04756");
    },
  };

  // Small markings shared by the gauntlets and leg plates of each set.
  function plateDetail(ctx, set, color, x, y, length) {
    switch (set.id) {
      case "worn": scratches(ctx, color, x + length / 2, y + 3, 0.6); break;
      case "scout": line(ctx, x + 2, y + 1, x + 2, y + 6, set.trim, 2); break;
      case "heavy":
        oval(ctx, x + 2.5, y + 3, 1.1, 1.1, set.trim);
        oval(ctx, x + length - 2.5, y + 3, 1.1, 1.1, set.trim);
        break;
      case "desert":
        for (let i = 1; i < 4; i++) line(ctx, x + (i * length) / 4, y, x + (i * length) / 4 - 2, y + 7, set.trim, 1.6);
        break;
      case "ancient": poly(ctx, [x + length / 2, y + 1, x + length / 2 + 3, y + 3.5, x + length / 2, y + 6, x + length / 2 - 3, y + 3.5], null, set.trim, 1); break;
      case "arctic": line(ctx, x + length - 1, y, x + length - 1, y + 7, "#e8dfd0", 3); break;
      case "imperial": box(ctx, x + length / 2, y + 2, 4, 2.5, 0, set.trim); break;
      case "shadow":
      case "royal": line(ctx, x + 2, y + 2, x + length - 2, y + 4, set.trim, 1.2); break;
      default: line(ctx, x + 2, y + 2, x + length - 3, y + 2, "rgba(255,255,255,0.35)", 1);
    }
  }

  function cape(ctx, look, flow, lift, time) {
    const { style, color } = look.cape;
    if (style === "none") return;
    const length = style === "short" || style === "poncho" ? 36 : 56;
    const back = clamp(flow, -0.25, 1) * 30;
    const up = clamp(lift, -0.3, 1) * 16 + max(0, flow) * 8;
    const wave = sin(time * (4 + abs(flow) * 8)) * (2 + abs(flow) * 5);

    ctx.beginPath();
    ctx.moveTo(4, -28);
    ctx.lineTo(-11, -27);
    ctx.bezierCurveTo(-16 - back * 0.3, -14, -14 - back * 0.7, length * 0.2 - up, -17 - back + wave * 0.5, length - 22 - up);
    const ragged = style === "torn" ? 6 : style === "poncho" ? 4 : 1.5;
    for (let i = 1; i <= 5; i++) {
      const x = -17 - back + i * 4.4;
      const y = length - 22 - up * (1 - i / 7) + wave * sin(i) + (i % 2 ? -ragged : ragged);
      ctx.lineTo(x, y);
    }
    ctx.bezierCurveTo(7 - back * 0.3, 0, 8, -14, 4, -28);
    ctx.closePath();
    ctx.fillStyle = metal(ctx, color, -28, 34, 0.18);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    line(ctx, -8, -22, -11 - back * 0.7, length - 30 - up + wave, shade(color, -0.3), 1.8);
    line(ctx, -1, -18, -4 - back * 0.5, length - 33 - up * 0.6, shade(color, 0.12), 1.4);
  }

  function jetpack(ctx, look, thrust, time) {
    const { style, color } = look.jetpack;
    const fill = metal(ctx, color, -30, 0);
    let nozzle = -16;
    ctx.save();
    if (style === "single") {
      poly(ctx, [-22, -24, -17, -36, -12, -24], metal(ctx, "#b94234", -36, -24), INK, 1.4);
      box(ctx, -23, -25, 12, 22, 4, fill, INK, 1.4);
      poly(ctx, [-21, -3, -13, -3, -11, 3, -23, 3], "#383c43", INK, 1.2);
      nozzle = -17;
    } else if (style === "heavy") {
      box(ctx, -27, -30, 18, 25, 4, fill, INK, 1.5);
      for (let i = 0; i < 3; i++) line(ctx, -24, -25 + i * 5, -13, -25 + i * 5, shade(color, -0.5), 2);
      poly(ctx, [-27, -5, -11, -5, -9, 3, -29, 3], "#383c43", INK, 1.2);
      nozzle = -19;
    } else {
      for (const x of [-25, -16]) {
        box(ctx, x, -28, 9, 22, 4, fill, INK, 1.3);
        poly(ctx, [x + 1.5, -6, x + 7.5, -6, x + 9, 1, x, 1], "#383c43", INK, 1.1);
        line(ctx, x + 3, -25, x + 3, -10, "rgba(255,255,255,0.3)", 1.3);
      }
    }
    if (thrust > 0) {
      const size = (19 + sin(time * 55) * 5) * thrust;
      glow(ctx, nozzle, 6, 32 * thrust, "#ff9a30", 0.8);
      for (const x of style === "twin" ? [-20.5, -11.5] : [nozzle]) {
        poly(ctx, [x - 4.5, 1, x + 4.5, 1, x + 1, size * 0.6, x - 1, size + 4], "#ff8a22");
        poly(ctx, [x - 2.2, 1, x + 2.2, 1, x, size * 0.65], "#fff0b0");
      }
    }
    ctx.restore();
  }

  function mandoModel(actor) {
    const { look } = actor;
    const D = MQ.DATA;
    const chestSet = D.set(look.chest.style);
    const shoulderSet = D.set(look.shoulders.style);
    const gauntletSet = D.set(look.gauntlets.style);
    const legSet = D.set(look.legs.style);
    const plate = (color, front) => (front ? color : shade(color, -0.3));

    return {
      suit: chestSet.suit,
      glove: "#2b2420",
      back(ctx, a) {
        cape(ctx, look, a.flow || 0, a.lift || 0, a.time);
        if (a.jetpack) jetpack(ctx, look, a.thrust || 0, a.time);
      },
      torso(ctx, a) {
        poly(ctx, [-11, -27, 11, -27, 12.5, -13, 9, 4, -9, 4, -11.5, -12], metal(ctx, chestSet.suit, -27, 4, 0.12), INK, 1.5);
        line(ctx, -7, -8, -8, -1, shade(chestSet.suit, 0.2), 1);
        line(ctx, 7, -8, 6, -2, shade(chestSet.suit, -0.4), 1);
        line(ctx, -11, -24, 9, -2, "#5d3f29", 4.5);
        for (let i = 0; i < 4; i++) box(ctx, -8 + i * 4.6, -22 + i * 5, 3.2, 4.5, 1, "#a88a5c", INK, 0.6);
        CHEST[chestSet.id](ctx, look.chest.color, chestSet);
        box(ctx, -11, -2, 22, 6.5, 2, "#4a3424", INK, 1.3);
        box(ctx, -1, -2.4, 7, 7, 1, metal(ctx, look.chest.color, -3, 5), INK, 1);
        box(ctx, -9.5, 0, 6, 6.5, 1.5, "#664832", INK, 1);
        if (look.cape.style === "poncho") {
          const sway = sin(a.time * 4) * 1.5;
          poly(ctx, [-14, -29, 9, -29, 13, -22, 2 + sway, -6, -5, -11, -15 + sway, -5], metal(ctx, look.cape.color, -29, -5, 0.15), INK, 1.4);
        } else if (look.cape.style === "fur") {
          for (let i = 0; i < 7; i++) oval(ctx, -14 + i * 3.4, -28 + (i % 2), 4, 3.6, i % 2 ? "#d9cdbb" : "#eee6d9");
        }
      },
      head: (ctx, a) => helmet(ctx, look, a.time),
      thigh(ctx, length, front) {
        const c = plate(look.legs.color, front);
        box(ctx, 3, -6, length - 7, 8, 3, metal(ctx, c, -6, 2), INK, 1.2);
        plateDetail(ctx, legSet, c, 3, -6, length - 7);
      },
      shin(ctx, length, front) {
        const c = plate(look.legs.color, front);
        box(ctx, -4, -6, 8, 11, 4, metal(ctx, c, -6, 5), INK, 1.2);
        box(ctx, 5, -5, max(4, length - 8), 7, 3, metal(ctx, c, -5, 2), INK, 1.1);
      },
      boot(ctx, front) {
        const c = front ? "#4a3628" : "#32251d";
        poly(ctx, [-6, -6, 4, -6, 6, -1.5, 13, 0, 13, 3.2, -6.5, 3.2], c, INK, 1.4);
        line(ctx, -5, 2.5, 12, 2.5, "#1d1714", 1.6);
      },
      gauntlet(ctx, length, front, a) {
        const c = plate(look.gauntlets.color, front);
        box(ctx, 2.5, -5, length - 5, 8.5, 2.5, metal(ctx, c, -5, 4), INK, 1.2);
        plateDetail(ctx, gauntletSet, c, 2.5, -4, length - 5);
        if (front && (a.weapon === "birds" || a.weapon === "rocket")) {
          box(ctx, 1, -10, 13, 5, 1.5, "#3c434c", INK, 1);
          oval(ctx, 14, -7.5, 1.8, 1.8, a.weapon === "birds" ? "#ffd45c" : "#e0523f");
        }
      },
      shoulder(ctx, front) {
        SHOULDER[shoulderSet.id](ctx, plate(look.shoulders.color, front), shoulderSet);
      },
      weapon(ctx, a) {
        if (a.weapon && a.weapon !== "birds" && a.weapon !== "rocket") MQ.WeaponArt.draw(ctx, a.weapon, a);
      },
    };
  }

  /*
   * actor: { look, pose, time, flow, lift, jetpack, thrust, weapon, saber, power }
   * The model is kept on the actor and rebuilt only when the look changes.
   */
  function mando(ctx, actor) {
    const { look } = actor;
    if (actor.modelLook !== look || actor.modelKey !== `${look.chest.style}${look.shoulders.style}${look.gauntlets.style}${look.legs.style}`) {
      actor.modelLook = look;
      actor.modelKey = `${look.chest.style}${look.shoulders.style}${look.gauntlets.style}${look.legs.style}`;
      actor.model = mandoModel(actor);
    }
    MQ.Anim.drawHumanoid(ctx, actor.pose, actor.model, actor);
  }

  /* ---------- Baby G ---------- */

  function babyFace(ctx, mood, time) {
    const blink = (time * 0.31) % 1 > 0.95;
    const closed = blink || mood === "force";
    const earAngle = { happy: -0.3, victory: -0.38, worried: 0.38, sad: 0.5, force: -0.12 }[mood] ?? sin(time * 1.7) * 0.07;
    const skin = "#8fb573";

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 11, -1);
      ctx.scale(side, 1);
      ctx.rotate(earAngle + (side > 0 ? sin(time * 2.3) * 0.04 : 0));
      ctx.beginPath();
      ctx.moveTo(-2, -5);
      ctx.bezierCurveTo(9, -8, 18, -7, 26, -2);
      ctx.bezierCurveTo(17, 3, 9, 5, -2, 5);
      ctx.closePath();
      ctx.fillStyle = metal(ctx, skin, -8, 5, 0.18);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      poly(ctx, [1, -1, 10, -3.5, 21, -2, 10, 1.5], "#c78e84");
      ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(-14, -1);
    ctx.bezierCurveTo(-14, -17, 14, -17, 14, -1);
    ctx.bezierCurveTo(14, 8, 7, 11, 0, 11);
    ctx.bezierCurveTo(-7, 11, -14, 8, -14, -1);
    ctx.fillStyle = metal(ctx, skin, -14, 11, 0.2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const crease = shade(skin, -0.3);
    for (let i = 0; i < 2; i++) line(ctx, -5 + i, -10 + i * 3, 5 - i, -10 + i * 3, crease, 0.8);
    for (let i = 0; i < 3; i++) line(ctx, -2 + i * 2, -12, -2.5 + i * 2.5, -15.5, "#d8dcc8", 0.6);

    for (const side of [-1, 1]) {
      const x = side * 6.8 + 0.8;
      if (closed) {
        line(ctx, x - 3.5, 0, x + 3.5, 0, INK, 1.8);
      } else if (mood === "happy" || mood === "victory") {
        oval(ctx, x, 0, 4.4, 4.7, "#191210", crease, 1.2);
        oval(ctx, x + 1.4, -1.6, 1.7, 1.7, "#ffffff");
        oval(ctx, x - 1.5, 2, 0.8, 0.8, "#ffffff");
      } else {
        const wide = mood === "worried" || mood === "sad" ? 0.7 : 0;
        oval(ctx, x, 0, 4.4 + wide, 4.2 + wide, "#191210", crease, 1.2);
        oval(ctx, x + 1.4, -1.5, 1.4, 1.4, "#ffffff");
      }
      if (mood === "worried" || mood === "sad") line(ctx, x - side * 4, -7.5, x + side * 3, -5.5, crease, 1.6);
      if (mood === "force") line(ctx, x - side * 4, -4.5, x + side * 3, -6, crease, 1.6);
    }

    line(ctx, 0, 4.2, 1.6, 4.2, crease, 1.6);
    ctx.beginPath();
    if (mood === "happy" || mood === "victory") {
      ctx.arc(1, 5.4, 3.2, 0.2, Math.PI - 0.2);
      ctx.closePath();
      ctx.fillStyle = "#6b3a34";
      ctx.fill();
    } else {
      const bend = mood === "worried" || mood === "sad" ? -1.6 : 0.8;
      ctx.moveTo(-1.5, 7.6);
      ctx.quadraticCurveTo(1, 7.6 + bend, 3.5, 7.6);
      ctx.strokeStyle = "#4f3a2c";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
  }

  // The origin is the center of the floating pram.
  function baby(ctx, mood = "idle", time = 0, options = {}) {
    const { pram = true, power = 0 } = options;
    const cheer = mood === "victory" || mood === "happy";
    const hop = cheer ? -abs(sin(time * 8)) * 4 : 0;

    if (pram) {
      oval(ctx, 0, -2, 25, 20, "#20242b", INK, 1.5);
      ctx.beginPath();
      ctx.ellipse(-3, -5, 25, 21, -0.2, Math.PI * 0.75, Math.PI * 1.55);
      ctx.strokeStyle = "#8b939c";
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(1, hop + (mood === "force" ? -5 : 0));
    poly(ctx, [-12, -8, 12, -8, 16, 14, -16, 14], metal(ctx, "#b79a70", -8, 14, 0.18), INK, 1.4);
    poly(ctx, [-10, -10, 0, -3, 10, -10, 12, -5, 0, 2, -12, -5], "#d8c3a0", INK, 1);

    const reach = mood === "force" ? 1 : cheer ? 0.6 + sin(time * 12) * 0.2 : 0;
    if (reach) {
      const hx = mood === "force" ? 26 : 17;
      const hy = mood === "force" ? -11 : -15 - reach * 4;
      line(ctx, 8, 0, hx - 3, hy + 2, INK, 8);
      line(ctx, 8, 0, hx - 3, hy + 2, "#b79a70", 5.5);
      for (let i = -1; i <= 1; i++) line(ctx, hx - 3, hy + 2, hx + 3, hy + i * 3.5, "#8fb573", 2.2);
      if (cheer) {
        line(ctx, -8, 0, -15, hy + 4, "#b79a70", 5.5);
        oval(ctx, -16, hy + 3, 2.5, 2.5, "#8fb573");
      }
      if (mood === "force") glow(ctx, hx, hy, 18 + power * 20, "#7fd4ff", 0.8);
    } else {
      oval(ctx, 11, 3, 3, 2.6, "#8fb573", INK, 1);
    }

    ctx.translate(0, -16);
    ctx.rotate(sin(time * 1.3) * 0.05);
    babyFace(ctx, mood, time);
    ctx.restore();

    if (!pram) return;
    ctx.beginPath();
    ctx.moveTo(-27, 0);
    ctx.quadraticCurveTo(0, 7, 27, -2);
    ctx.bezierCurveTo(27, 20, 14, 25, 0, 25);
    ctx.bezierCurveTo(-15, 25, -28, 19, -27, 0);
    ctx.fillStyle = metal(ctx, "#9aa3ab", -2, 25, 0.35);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.stroke();
    line(ctx, -18, 12, 18, 11, "#57606a", 2);
    box(ctx, 8, 14, 10, 3.5, 1.5, "#6ee7ff");
    box(ctx, -19, 4, 8, 4, 1.5, "#6d7680", INK, 0.8);
    glow(ctx, 13, 16, 12, "#6ee7ff", 0.55);
    glow(ctx, 0, 27, 17 + sin(time * 9) * 2, "#58b8ff", 0.35);
  }

  /* ---------- Moff Gideon ---------- */

  const gideonModel = {
    suit: "#17191e",
    glove: "#0d0e11",
    legWidth: 11,
    back(ctx, a) {
      const flow = clamp(a.flow || 0, 0, 1);
      const wave = sin(a.time * (3 + flow * 8)) * 3;
      const hem = 46 - flow * 12;
      poly(ctx, [4, -28, -12, -28, -17 - flow * 24, 4, -23 - flow * 32 + wave, hem, -8 - flow * 20, hem + wave * 0.5, 6, hem - 10], "#121318", INK, 1.5);
      poly(ctx, [-6, -22, -13 - flow * 22, 10, -15 - flow * 28 + wave, hem - 4, -8 - flow * 16, 12], "#6e1a1d");
    },
    torso(ctx, a) {
      poly(ctx, [-12, -27, 12, -27, 13, -12, 9, 4, -9, 4, -12, -12], metal(ctx, "#1d2026", -27, 4), INK, 1.5);
      const fill = metal(ctx, "#343842", -28, -8, 0.4);
      poly(ctx, [-14, -29, 14, -29, 13, -15, 1, -10, -12, -15], fill, INK, 1.5);
      poly(ctx, [-8, -9, 9, -9, 7, -3, -6, -3], fill, INK, 1.1);
      box(ctx, 4, -24, 6, 2.5, 0, "#d23b34");
      box(ctx, -8, -24, 5, 2.5, 0, "#c9d0d8");
      box(ctx, -11, -1, 22, 5, 1.5, "#101115", INK, 1);
      box(ctx, -2, -1.5, 5, 6, 1, "#8c949e");
      if (a.rage) glow(ctx, 2, -17, 26, "#e03a30", 0.3 + sin(a.time * 12) * 0.12);
    },
    head(ctx, a) {
      const skin = "#8a5a3c";
      box(ctx, -5, 7, 10, 8, 2, "#16171b");
      ctx.beginPath();
      ctx.moveTo(-10, 4);
      ctx.bezierCurveTo(-13, -15, 9, -18, 11, -3);
      ctx.lineTo(12.5, 3);
      ctx.lineTo(10.5, 4);
      ctx.lineTo(10, 10);
      ctx.lineTo(3, 12.5);
      ctx.lineTo(-7, 9);
      ctx.closePath();
      ctx.fillStyle = metal(ctx, skin, -15, 12, 0.22);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      poly(ctx, [-10.5, 3, -11, -6, -7, -12, 1, -14, -3, -11, -5, -6, -5.5, 1], "#33302f");
      poly(ctx, [1, 5, 10, 4.5, 10, 10, 3, 12.5, -3, 10.5, -2, 8, 2, 8.5], "#5a5551");
      line(ctx, 2, 4.5, 9.5, 4.2, "#3a3532", 2);
      line(ctx, 2, -3.5, 10, -2.5, "#2a1c16", 1.9);
      oval(ctx, 6.5, -0.8, 1.8, 1.2, a.rage ? "#ff5a45" : "#f1eadf");
      oval(ctx, 7.1, -0.8, 0.9, 1.1, "#1b1210");
      oval(ctx, -5.5, 1, 2.3, 3.2, skin, INK, 0.8);
      line(ctx, 11, -1, 12, 3, shade(skin, -0.3), 1);
      poly(ctx, [-8, 8, 6, 12, 5, 16, -9, 14], "#16171b", INK, 1);
    },
    thigh: (ctx, length) => box(ctx, 3, -6, length - 6, 8, 2, metal(ctx, "#2d3038", -6, 2), INK, 1),
    shin: (ctx, length) => box(ctx, 1, -5.5, length - 2, 8, 2, metal(ctx, "#2d3038", -5, 3), INK, 1),
    boot: (ctx) => poly(ctx, [-6, -6, 4, -6, 13, 0, 13, 3.2, -6.5, 3.2], "#0f1013", INK, 1.4),
    gauntlet: (ctx, length) => box(ctx, 2, -5, length - 4, 8, 2, metal(ctx, "#343842", -5, 3), INK, 1),
    shoulder(ctx) {
      poly(ctx, [-9, -6, 3, -8, 8, -3, 7, 6, -7, 6], metal(ctx, "#343842", -8, 6, 0.4), INK, 1.3);
      line(ctx, -6, 1, 5, 1, "#8f1f22", 1.6);
    },
    weapon(ctx, a) {
      if (a.armed === "saber") MQ.WeaponArt.saber(ctx, a.saber || MQ.DATA.saber("classic"), a.time, a.power || 0, 84);
      else if (a.armed === "blaster") MQ.WeaponArt.draw(ctx, "blaster");
    },
  };

  const gideon = (ctx, actor) => MQ.Anim.drawHumanoid(ctx, actor.pose, gideonModel, actor);

  MQ.CharacterArt = { mando, baby, gideon, helmet };
})(window.MQ);
