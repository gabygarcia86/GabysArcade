/* Every regular enemy. Humanoids share a skeleton but have their own silhouettes. */
(function (MQ) {
  const { box, poly, oval, line, glow, metal, shade } = MQ.U;
  const INK = MQ.INK;
  const { sin, cos, abs, max, PI } = Math;

  const eye = (ctx, x, y, r, color) => {
    oval(ctx, x, y, r, r, color);
    glow(ctx, x, y, r * 4, color, 0.7);
  };

  /* ---------- Heads ---------- */

  const HEAD = {
    trooper(ctx, a, o) {
      const c = o.helmet || "#eef1f4";
      poly(ctx, [-12, 6, -12, -6, -8, -14, 4, -16, 11, -10, 13, -2, 14, 8, 9, 13, -3, 12, -11, 12], metal(ctx, c, -16, 13, 0.2), INK);
      poly(ctx, [-12, -7, 11, -9, 12, -6, -12, -4], "#30343b");
      poly(ctx, [-3, -4, 4, -4, 3, 1, -3, 0], "#0c0e12", INK, 1);
      poly(ctx, [6.5, -4, 12, -5, 12.5, 0, 7, 1], "#0c0e12", INK, 1);
      poly(ctx, [4.5, 5, 10.5, 4.5, 11.5, 10, 3.5, 10], "#4b515a");
      for (let i = 0; i < 3; i++) line(ctx, 5.5 + i * 2.2, 6, 5 + i * 2.5, 9, c, 0.9);
      line(ctx, -8, 5, -4, 7, "#5f7d99", 2);
      line(ctx, -2, -2, 2, -3, "rgba(255,255,255,0.4)", 1);
    },
    scout(ctx) {
      const c = "#e7eaee";
      poly(ctx, [-11, 6, -12, -8, -5, -15, 8, -14, 13, -7, 11, -5, -9, -4], metal(ctx, c, -15, 4, 0.2), INK);
      poly(ctx, [-9, -5, 12, -6, 11, 2, 3, 3, 1, 0, -8, 0], "#14171c", INK, 1);
      poly(ctx, [-10, 2, 1, 3, 4, 6, 11, 4, 9, 12, -8, 11], "#33373e", INK, 1.2);
      poly(ctx, [-6, -11, 12, -12, 17, -7, 2, -8], c, INK, 1.2);
      line(ctx, 1, -4, 8, -4, "#66bde0", 1.4);
    },
    officer(ctx, a, o) {
      const skin = o.skin || "#c79474";
      poly(ctx, [-9, -6, 9, -6, 11, 2, 12.5, 4, 10, 5, 9, 10, 1, 12, -8, 8], metal(ctx, skin, -8, 12, 0.18), INK);
      poly(ctx, [-11, -5, -12, -13, 9, -15, 11, -6], metal(ctx, "#4b5348", -15, -5), INK);
      poly(ctx, [-11, -7, 11, -8, 16, -4, -11, -4], "#22261f", INK, 1);
      oval(ctx, 5, -11, 2, 2, "#c9d0d8");
      line(ctx, 3, -1, 9, -1, "#2a1c18", 1.8);
      line(ctx, 4, 8, 9, 7.5, "#5a342a", 1.2);
      oval(ctx, -5, 2, 2.2, 3, skin, INK, 0.8);
    },
    dark(ctx, a) {
      poly(ctx, [-12, 10, -13, -8, -6, -16, 6, -16, 13, -8, 14, 8, 8, 14, -6, 14], metal(ctx, "#20232a", -16, 14, 0.4), INK);
      poly(ctx, [-2, -6, 4, -5, 4, -1, -3, -2], "#ff2f2f");
      poly(ctx, [7, -5, 12.5, -6, 12, -2, 7, -1], "#ff2f2f");
      glow(ctx, 5, -3, 14, "#ff2f2f", 0.6 + sin(a.time * 6) * 0.2);
      poly(ctx, [3, 4, 11, 3, 10, 11, 3, 11], "#0c0e11", "#4d545e", 1.1);
      line(ctx, -8, -12, 3, -14, "#59616c", 2);
    },
    guard(ctx) {
      poly(ctx, [-12, 11, -12, -8, -2, -20, 10, -9, 13, 9, 6, 14, -7, 14], metal(ctx, "#9d242b", -20, 14), INK);
      poly(ctx, [-4, -5, 12, -6, 12, -2, 7, -1, 6, 7, 3, 7, 2, -1, -4, -1], "#0d0e12", INK, 1);
      line(ctx, -1, -17, 3, -9, "#d85a5a", 1.6);
    },
    bandit(ctx, a, o) {
      oval(ctx, 1, 0, 11, 12.5, metal(ctx, o.skin || "#b98567", -12, 12, 0.2), INK);
      poly(ctx, [-12, 4, -12, -8, -5, -14, 7, -13, 12, -6, -5, -5, -6, 6], shade(o.trim, -0.4), INK, 1.2);
      poly(ctx, [-10, 3, 12, 2, 11, 10, 2, 14, -9, 10], o.trim, INK, 1.2);
      for (const x of [0, 9]) oval(ctx, x, -2.5, 3.6, 3.4, "#28262a", "#9d8a6c", 1.3);
      line(ctx, 0, -4, 1, -3, "#ffffff", 1);
    },
    horned(ctx, a, o) {
      for (let i = 0; i < 4; i++) poly(ctx, [-9 + i * 5.5, -8, -5 + i * 5.5, -8, -8 + i * 6.3, -19 + (i % 2) * 3], "#cdb99a", INK, 1);
      oval(ctx, 1, 0, 11.5, 12.5, metal(ctx, "#9c4a3b", -12, 12), INK);
      poly(ctx, [-9, -4, 12, -6, 12, -1, -8, 1], "#231b1b");
      eye(ctx, 7, -3, 1.8, "#ffd45c");
      eye(ctx, -1, -2.5, 1.6, "#ffd45c");
      line(ctx, 3, 7, 10, 6, "#3a1612", 1.5);
      line(ctx, -10, 3, -12, 14, o.trim, 4);
    },
    brute(ctx, a, o) {
      box(ctx, -14, -15, 29, 29, 7, metal(ctx, "#5f5a4e", -15, 14), INK);
      box(ctx, -4, -8, 19, 8, 2, "#17191c", INK, 1);
      line(ctx, -1, -4, 12, -4, o.trim, 2.4);
      glow(ctx, 6, -4, 10, o.trim, 0.5);
      for (let i = 0; i < 3; i++) line(ctx, 3 + i * 4, 4, 3 + i * 4, 10, "#2f2c27", 2);
      oval(ctx, -11, 2, 4, 5, "#4a463d", INK);
    },
    pilot(ctx, a, o) {
      oval(ctx, 0, -1, 12.5, 14, metal(ctx, o.trim, -15, 13), INK);
      poly(ctx, [-5, -7, 12, -8, 13, 2, 5, 5, -4, 2], "#101318", INK, 1);
      line(ctx, 0, -4, 8, -5, "#77d7ff", 1.5);
      box(ctx, 3, 6, 10, 7, 2, "#3a3e45", INK, 1);
      line(ctx, -9, -8, -15, -17, INK, 2);
    },
    elite(ctx, a) {
      poly(ctx, [-11, 12, -13, -4, -7, -16, 5, -17, 12, -6, 14, 7, 6, 15, -4, 13], metal(ctx, "#4d4058", -17, 15, 0.4), INK);
      poly(ctx, [-4, -6, 12, -4, 11, 0, -3, -2], "#0c0d11");
      line(ctx, -1, -3.6, 9, -2.4, "#d77bff", 1.4);
      glow(ctx, 4, -3, 12, "#d77bff", 0.5 + sin(a.time * 5) * 0.2);
      line(ctx, 4, -15, 7, -8, "#d4a93f", 2);
    },
    raider(ctx) {
      oval(ctx, 0, 0, 12, 13, metal(ctx, "#c7ab80", -13, 13, 0.2), INK);
      for (let i = 0; i < 4; i++) line(ctx, -10, -8 + i * 5, 9, -10 + i * 6, "#8f7250", 1.4);
      for (const x of [0, 8]) box(ctx, x - 2, -7, 5, 5, 1, "#4a4034", INK, 1);
      poly(ctx, [4, 2, 13, 4, 11, 9, 3, 8], "#5a4c3d", INK, 1);
      for (const x of [-5, 4]) poly(ctx, [x - 2, -11, x + 2, -11, x + 1, -17], "#777064", INK, 0.8);
    },
    jawa(ctx, a) {
      poly(ctx, [-14, 13, -15, -8, -6, -18, 8, -16, 14, -3, 11, 14], metal(ctx, "#6f4a30", -18, 14, 0.2), INK);
      oval(ctx, 4, 0, 8.5, 10, "#0b0807");
      const blink = (a.time * 0.5) % 1 < 0.94;
      if (blink) {
        eye(ctx, 1, -2, 2.2, "#ffd23d");
        eye(ctx, 8, -2, 2.2, "#ffd23d");
      }
    },
    security(ctx, a) {
      box(ctx, -8, -16, 18, 26, 5, metal(ctx, "#39414b", -16, 10), INK);
      box(ctx, -3, -9, 14, 6, 2, "#12151a", INK, 1);
      eye(ctx, 2 + sin(a.time * 3) * 3, -6, 2, "#56d8ff");
      line(ctx, -5, -15, -9, -23, INK, 2);
      line(ctx, 2, 4, 9, 4, "#77818d", 2);
    },
    battle(ctx) {
      line(ctx, 0, 12, 1, -4, INK, 5);
      line(ctx, 0, 12, 1, -4, "#8f7c5c", 3);
      poly(ctx, [-9, -15, 3, -14, 17, 1, 13, 5, -6, -3], metal(ctx, "#c2a878", -15, 5), INK);
      eye(ctx, 3, -7, 1.8, "#26221c");
      line(ctx, 10, 0, 14, 2, "#7d6a4b", 1.5);
      line(ctx, -7, -13, -11, -20, INK, 1.8);
    },
    ancient(ctx, a) {
      poly(ctx, [-12, 11, -13, -8, -15, -20, -5, -14, 5, -14, 15, -21, 13, -6, 14, 8, 3, 15], metal(ctx, "#8a7758", -20, 14), INK);
      poly(ctx, [-5, -6, 12, -7, 11, -2, 6, -1, 5, 8, 2, 8, 2, -1, -5, -1], "#14110c");
      if (a.awake !== false) eye(ctx, 6, -4, 2.3, "#58d6c2");
    },
  };

  /* ---------- Torsos ---------- */

  const TORSO = {
    plate(ctx, a, o) {
      poly(ctx, [-11, -27, 11, -27, 11, -10, 9, 4, -9, 4, -11, -10], o.suit, INK);
      poly(ctx, [-12, -27, 12, -27, 12, -15, 6, -11, -9, -12], metal(ctx, o.plate, -27, -11, 0.2), INK, 1.3);
      box(ctx, -8, -10, 17, 6, 2, metal(ctx, o.plate, -10, -4, 0.2), INK, 1);
      box(ctx, -11, -2, 22, 5, 1.5, o.belt || "#3a3e45", INK, 1);
      if (o.trim) box(ctx, 3, -23, 6, 3, 0, o.trim);
      box(ctx, -9, -1, 6, 5, 1, shade(o.plate, -0.2), INK, 0.8);
    },
    bulk(ctx, a, o) {
      poly(ctx, [-15, -30, 15, -30, 16, -14, 10, 5, -10, 5, -15, -14], metal(ctx, o.suit, -30, 5), INK);
      poly(ctx, [-16, -30, 16, -30, 15, -15, 2, -10, -14, -15], metal(ctx, o.plate, -30, -10), INK, 1.4);
      for (const x of [-10, 10]) oval(ctx, x, -18, 1.5, 1.5, shade(o.plate, 0.4), INK, 0.6);
      box(ctx, -12, -2, 24, 7, 2, "#2a2c31", INK, 1);
      if (o.trim) {
        box(ctx, -3, -25, 9, 4, 1, o.trim);
        glow(ctx, 1, -23, 11, o.trim, 0.3);
      }
    },
    uniform(ctx, a, o) {
      poly(ctx, [-11, -27, 11, -27, 10, -8, 12, 8, -11, 8, -10, -8], metal(ctx, o.suit, -27, 8, 0.18), INK);
      line(ctx, 4, -26, 5, 5, shade(o.suit, -0.4), 1.4);
      for (let i = 0; i < 4; i++) box(ctx, -6 + (i % 2) * 4, -23 + Math.floor(i / 2) * 3.2, 3.4, 2.6, 0, i % 2 ? "#4d7fc2" : "#c9423c");
      box(ctx, -11, -4, 22, 5, 1, "#15171a", INK, 1);
      box(ctx, 0, -4.5, 5, 6, 1, "#b7bec6");
    },
    coat(ctx, a, o) {
      const sway = sin(a.time * 5) * 2;
      poly(ctx, [-12, -27, 11, -27, 12, -8, 14 + sway, 13, 3, 5, -15 + sway, 13, -12, -8], metal(ctx, o.suit, -27, 13, 0.2), INK);
      poly(ctx, [-7, -27, 6, -27, 5, -11, -5, -11], metal(ctx, o.plate, -27, -11), INK, 1.1);
      line(ctx, -10, -25, 9, -3, "#3b2a1f", 4);
      box(ctx, -11, -3, 22, 5, 1, "#3b2a1f", INK, 1);
      box(ctx, 1, -3.5, 5, 6, 1, o.trim);
    },
    robe(ctx, a, o) {
      const sway = sin(a.time * 4) * 2;
      poly(ctx, [-10, -28, 10, -28, 14, 0, 16 + sway, 24, -15 + sway, 24, -13, 0], metal(ctx, o.suit, -28, 24, 0.2), INK);
      line(ctx, -3, -20, -5 + sway, 22, shade(o.suit, -0.3), 2);
      line(ctx, -11, -24, 10, -4, o.trim, 3);
      box(ctx, -12, -4, 24, 5, 2, shade(o.suit, -0.45), INK, 1);
      box(ctx, 1, -5, 8, 8, 2, o.plate, INK, 1);
    },
    frame(ctx, a, o) {
      poly(ctx, [-10, -28, 10, -28, 8, -13, 4, -9, -4, -9, -8, -13], metal(ctx, o.plate, -28, -9), INK);
      box(ctx, -3, -10, 6, 10, 1, o.suit, INK, 1);
      box(ctx, -8, -2, 16, 6, 2, metal(ctx, o.plate, -2, 4), INK, 1);
      box(ctx, 0, -23, 5, 5, 1, o.trim);
      glow(ctx, 2, -20, 9, o.trim, 0.4);
    },
  };

  function makeModel(o) {
    return {
      suit: o.suit,
      glove: o.glove || "#202227",
      legWidth: o.legWidth,
      armWidth: o.armWidth,
      back(ctx, a) {
        if (o.cape) {
          const sway = sin(a.time * 4) * 3;
          poly(ctx, [3, -27, -11, -27, -24 + sway, 32, -8, 36, 4, 30], o.cape, INK);
        }
        if (o.pack) {
          box(ctx, -25, -30, 15, 25, 4, metal(ctx, o.pack, -30, -5), INK);
          if (o.thruster) {
            poly(ctx, [-24, -5, -12, -5, -10, 2, -26, 2], "#2c2f35", INK, 1);
            if (a.thrust) {
              const size = 16 + sin(a.time * 50) * 5;
              poly(ctx, [-23, 2, -13, 2, -18, size], "#ff9a30");
              glow(ctx, -18, 8, 22, "#ff9a30", 0.7);
            }
          }
        }
      },
      torso: (ctx, a) => TORSO[o.torso](ctx, a, o),
      head: (ctx, a) => HEAD[o.head](ctx, a, o),
      thigh: o.legPlate && ((ctx, length) => box(ctx, 3, -6, length - 7, 8, 3, metal(ctx, o.legPlate, -6, 2, 0.2), INK, 1)),
      shin: o.legPlate && ((ctx, length) => box(ctx, 1, -5, length - 4, 8, 3, metal(ctx, o.legPlate, -5, 3, 0.2), INK, 1)),
      gauntlet: o.armPlate && ((ctx, length) => box(ctx, 2, -4.5, length - 5, 8, 3, metal(ctx, o.armPlate, -5, 4, 0.2), INK, 1)),
      shoulder: o.pauldron && ((ctx) => {
        const size = o.pauldronSize || 1;
        box(ctx, -7 * size, -6 * size, 14 * size, 13 * size, 5, metal(ctx, o.pauldron, -6, 7, 0.24), INK, 1.2);
      }),
      boot: (ctx) => poly(ctx, [-6, -6, 4, -6, 12, 0, 12, 3.2, -6, 3.2], o.boot || "#202227", INK, 1.2),
      weapon(ctx, a) {
        if (o.weapon) MQ.WeaponArt.draw(ctx, o.weapon, { time: a.time, color: o.weaponColor });
      },
    };
  }

  const ARMOR = "#eef1f4";
  const MODELS = {
    trooper: makeModel({ torso: "plate", head: "trooper", suit: "#26282d", plate: ARMOR, legPlate: ARMOR, armPlate: ARMOR, pauldron: ARMOR, boot: "#d5dade", weapon: "pulse", weaponColor: "#ff5348" }),
    eliteTrooper: makeModel({ torso: "plate", head: "trooper", helmet: "#c9ced4", suit: "#26282d", plate: ARMOR, trim: "#c9423c", legPlate: ARMOR, armPlate: "#c9423c", pauldron: "#c9423c", pauldronSize: 1.2, weapon: "pulse", weaponColor: "#ff5348" }),
    scout: makeModel({ torso: "plate", head: "scout", suit: "#34373d", plate: "#e7eaee", armPlate: "#e7eaee", pauldron: "#e7eaee", pauldronSize: 0.8, boot: "#4b5058", weapon: "disruptor", weaponColor: "#ff5348" }),
    heavyTrooper: makeModel({ torso: "bulk", head: "trooper", suit: "#26282d", plate: "#dfe4e8", trim: "#dd7429", legPlate: ARMOR, armPlate: ARMOR, pauldron: "#dd7429", pauldronSize: 1.35, pack: "#3b4048", legWidth: 12, armWidth: 10, weapon: "heavy", weaponColor: "#ff5348" }),
    officer: makeModel({ torso: "uniform", head: "officer", suit: "#535c50", boot: "#101114", glove: "#101114", weapon: "blaster" }),
    darkTrooper: makeModel({ torso: "bulk", head: "dark", suit: "#15171b", plate: "#262a31", trim: "#ff2f2f", legPlate: "#262a31", armPlate: "#30353d", pauldron: "#262a31", pauldronSize: 1.4, pack: "#1d2026", thruster: true, legWidth: 12, armWidth: 11 }),
    guard: makeModel({ torso: "plate", head: "guard", suit: "#351216", plate: "#9d242b", trim: "#d4a93f", cape: "#6d181d", legPlate: "#8b2026", armPlate: "#9d242b", pauldron: "#b02c33", weapon: "staff", weaponColor: "#ff5a6a" }),
    hunter: makeModel({ torso: "coat", head: "bandit", suit: "#5a4936", plate: "#7d7158", trim: "#b5653a", armPlate: "#6d6250", boot: "#3b2a1f", weapon: "blaster" }),
    hunterMelee: makeModel({ torso: "coat", head: "horned", suit: "#3a3138", plate: "#694a42", trim: "#c79a52", armPlate: "#584039", pauldron: "#694a42", weapon: "blade" }),
    hunterHeavy: makeModel({ torso: "bulk", head: "brute", suit: "#3a3934", plate: "#6c6656", trim: "#ffb347", legPlate: "#5a5548", armPlate: "#5a5548", pauldron: "#6c6656", pauldronSize: 1.3, legWidth: 13, armWidth: 11, weapon: "flame" }),
    hunterJet: makeModel({ torso: "plate", head: "pilot", suit: "#34404a", plate: "#6b7c88", trim: "#e0a43a", pack: "#8b6038", thruster: true, armPlate: "#6b7c88", legPlate: "#55646e", weapon: "blaster" }),
    hunterElite: makeModel({ torso: "coat", head: "elite", suit: "#2a2433", plate: "#5b4d68", trim: "#d4a93f", cape: "#3a2a48", legPlate: "#4d4058", armPlate: "#5b4d68", pauldron: "#5b4d68", weapon: "disruptor" }),
    raider: makeModel({ torso: "robe", head: "raider", suit: "#b99a6e", plate: "#5a4c3d", trim: "#6d5238", glove: "#6d5238", boot: "#6d5238", weapon: "club" }),
    jawa: makeModel({ torso: "robe", head: "jawa", suit: "#6f4a30", plate: "#3f2b1c", trim: "#a8793e", weapon: "blaster" }),
    security: makeModel({ torso: "frame", head: "security", suit: "#23272d", plate: "#4d5863", trim: "#56d8ff", legWidth: 6, armWidth: 5.5, legPlate: "#434c56", pauldron: "#4d5863", weapon: "baton", weaponColor: "#56d8ff" }),
    battle: makeModel({ torso: "frame", head: "battle", suit: "#8f7c5c", plate: "#c2a878", trim: "#e0523f", legWidth: 5, armWidth: 4.5, boot: "#a38c66", glove: "#8f7c5c", pack: "#8f7c5c", weapon: "pulse", weaponColor: "#ff5348" }),
    ancient: makeModel({ torso: "bulk", head: "ancient", suit: "#4c4436", plate: "#8a7758", trim: "#58d6c2", legPlate: "#7a6a4f", armPlate: "#7a6a4f", pauldron: "#8a7758", legWidth: 11, armWidth: 9, weapon: "club" }),
  };

  /* ---------- Machines and creatures ---------- */

  function jointed(ctx, hx, hy, fx, fy, first, second, bend, color, width) {
    const j = MQ.Anim.ik(hx, hy, fx, fy, first, second, bend);
    MQ.Anim.limb(ctx, hx, hy, j.x, j.y, j.ex, j.ey, width, color);
  }

  const BODIES = {
    probe(ctx, a) {
      const t = a.time;
      ctx.translate(0, sin(t * 3) * 4);
      for (let i = 0; i < 5; i++) {
        const x = -14 + i * 7;
        const tip = x + sin(t * 2 + i) * 5 + (i - 2) * 3;
        ctx.beginPath();
        ctx.moveTo(x, -24);
        ctx.quadraticCurveTo(x * 1.5, -12, tip, 2);
        ctx.strokeStyle = "#252a31";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      poly(ctx, [-21, -38, 21, -38, 16, -24, -16, -24], metal(ctx, "#4a525c", -38, -24), INK);
      oval(ctx, 0, -43, 21, 14, metal(ctx, "#58626d", -57, -29), INK);
      box(ctx, -22, -42, 44, 5, 2, "#2b3038", INK, 1);
      oval(ctx, 10, -45, 5, 5, "#14171c", INK);
      eye(ctx, 11, -45, 2.6, a.windup ? "#ffffff" : "#ff4a3d");
      line(ctx, -8, -55, -11, -66, INK, 2);
      line(ctx, 14, -34, 26, -32, "#2b3038", 4);
    },

    turret(ctx, a) {
      poly(ctx, [-22, 0, -15, -18, 15, -18, 22, 0], metal(ctx, "#414852", -18, 0), INK);
      box(ctx, -4, -30, 8, 14, 1, "#2b3038", INK);
      ctx.translate(0, -35);
      ctx.rotate(a.aim || 0);
      box(ctx, 4, -5, 33, 4, 1, "#30353c", INK);
      box(ctx, 4, 2, 33, 4, 1, "#30353c", INK);
      box(ctx, -18, -12, 30, 22, 6, metal(ctx, "#5c6672", -12, 10), INK);
      eye(ctx, 5, -3, 3, a.windup ? "#ffffff" : "#ff4a3d");
    },

    repair(ctx, a) {
      const bob = sin(a.time * 4) * 3;
      ctx.translate(0, bob);
      const spin = sin(a.time * 10) * 4;
      line(ctx, 8, -28, 22, -16 + spin, INK, 3);
      line(ctx, 22, -16 + spin, 31, -24, "#9aa3ad", 2.5);
      line(ctx, -8, -28, -20, -12, INK, 3);
      box(ctx, -17, -51, 34, 28, 10, metal(ctx, "#d8c768", -51, -23), INK);
      box(ctx, -12, -44, 24, 9, 3, "#23262c", INK, 1);
      eye(ctx, 5, -39.5, 2.6, "#6dff9a");
      line(ctx, 0, -51, 0, -60, INK, 2);
      eye(ctx, 0, -61, 2, sin(a.time * 8) > 0 ? "#6dff9a" : "#2a6b40");
      glow(ctx, 0, -18, 18, "#6dff9a", 0.3);
    },

    heavyDroid(ctx, a) {
      const s = sin(a.phase) * 5;
      for (const [x, o] of [[-26, s], [20, -s], [0, s * 0.5]]) {
        jointed(ctx, x * 0.5, -32, x + o, -2, 22, 22, x < 0 ? -1 : 1, "#4d4650", 7);
        box(ctx, x + o - 7, -5, 14, 5, 2, "#2d2930", INK);
      }
      poly(ctx, [-22, -48, -14, -70, 10, -72, 22, -56, 20, -36, -16, -32], metal(ctx, "#75604c", -72, -32), INK);
      box(ctx, -9, -66, 20, 9, 2, "#1c1a1f", INK, 1);
      eye(ctx, 5, -61, 2.4, "#ff6a3d");
      for (const y of [-52, -42]) {
        box(ctx, 8, y, 29, 6, 2, "#3c3640", INK);
        if (a.windup) glow(ctx, 38, y + 3, 14, "#ff6a3d", 0.9);
      }
    },

    machine(ctx, a) {
      const p = a.phase;
      for (const [x, o, c] of [[-18, 0, "#32373e"], [14, PI, "#48505a"]]) {
        jointed(ctx, x * 0.6, -70, x + cos(p + o) * 14, -5 - max(0, sin(p + o)) * 10, 40, 38, -1, c, 11);
        box(ctx, x + cos(p + o) * 14 - 14, -8 - max(0, sin(p + o)) * 10, 28, 8, 2, c, INK);
      }
      box(ctx, -18, -82, 34, 20, 4, "#2b3038", INK);
      poly(ctx, [-36, -86, -30, -120, 18, -124, 40, -108, 42, -90, 24, -78, -28, -78], metal(ctx, "#68727d", -124, -78), INK, 2);
      box(ctx, 4, -114, 28, 10, 2, "#161a1f", INK);
      line(ctx, 9, -109, 28, -109, "#ff4a3d", 2.5);
      glow(ctx, 19, -109, 18, "#ff4a3d", 0.4);
      box(ctx, 22, -96, 38, 7, 2, "#333941", INK);
      box(ctx, -20, -100, 18, 14, 3, "#4d5661", INK, 1);
      if (a.windup) glow(ctx, 60, -92, 22, "#ff4a3d", 0.9);
    },

    miner(ctx, a) {
      box(ctx, -36, -24, 66, 24, 12, "#2b2d31", INK, 2);
      for (let i = 0; i < 4; i++) oval(ctx, -25 + i * 15, -12, 6, 6, "#666a70", INK);
      poly(ctx, [-32, -24, -30, -62, 12, -66, 28, -46, 30, -24], metal(ctx, "#c99834", -66, -24), INK, 2);
      for (let i = 0; i < 4; i++) poly(ctx, [-28 + i * 14, -28, -21 + i * 14, -28, -27 + i * 14, -36, -34 + i * 14, -36], "#2b2d31");
      box(ctx, -4, -58, 18, 12, 2, "#1a1c20", INK);
      eye(ctx, 8, -52, 3, "#ffd45c");
      poly(ctx, [28, -48, 70, -33, 28, -20], metal(ctx, "#8e969f", -48, -20), INK);
      const speed = a.windup || a.attacking ? 30 : 4;
      for (let i = 0; i < 3; i++) {
        const k = ((a.time * speed + i * 4) % 12) / 12;
        line(ctx, 30 + k * 34, -46 + k * 12, 34 + k * 30, -22 - k * 10, "#4b525a", 2.5);
      }
      line(ctx, -22, -62, -22, -76, INK, 4);
    },

    scavenger(ctx, a) {
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const x = -18 + i * 7;
        const step = sin(a.phase * 2 + i * 2) * 4;
        jointed(ctx, x, -18, x + side * 14 + step, -1, 16, 16, side, "#5d574d", 3.5);
      }
      poly(ctx, [-24, -16, -18, -34, 12, -36, 25, -20, 10, -11], metal(ctx, "#97714a", -36, -11), INK);
      oval(ctx, 11, -24, 7, 7, "#25221f", INK);
      eye(ctx, 12, -24, 3, "#ffb347");
      line(ctx, -8, -34, -2, -46, INK, 3);
      line(ctx, -2, -46, 12, -44, "#8a8f96", 3);
      if (a.windup) glow(ctx, 14, -44, 18, "#66d9ff", 0.9);
    },

    skitter(ctx, a) {
      const buried = a.buried || 0;
      ctx.translate(0, buried * 22);
      for (let i = 0; i < 4; i++) {
        const x = -18 + i * 12;
        jointed(ctx, x, -20, x + sin(a.phase * 2 + i * 2) * 7, -1, 13, 13, 1, i % 2 ? "#7c5a38" : "#97714a", 4);
      }
      poly(ctx, [-54, -16, -26, -22, -20, -30, 6, -32, 24, -22, 12, -10, -22, -10], metal(ctx, "#b68b55", -32, -10), INK);
      for (let i = 0; i < 4; i++) poly(ctx, [-22 + i * 9, -27, -16 + i * 9, -29, -22 + i * 9, -39], "#6d4c30", INK, 1);
      const open = a.windup || a.attacking ? 8 : 2;
      poly(ctx, [16, -30, 34, -27, 40, -20, 20, -19], metal(ctx, "#c99b62", -30, -19), INK);
      poly(ctx, [19, -18, 38, -18 + open * 0.4, 18, -12 + open * 0.5], "#8c6340", INK, 1);
      for (let i = 0; i < 3; i++) poly(ctx, [24 + i * 5, -20, 27 + i * 5, -20, 25.5 + i * 5, -16], "#f1e6cc");
      eye(ctx, 27, -24.5, 2, "#ffd23d");
    },

    flyer(ctx, a) {
      ctx.translate(0, -26);
      const flap = sin(a.time * 14);
      const wing = (color, scale) => {
        poly(ctx, [0, -4, -16 * scale, -10 - flap * 26, -44 * scale, -2 - flap * 20, -30 * scale, 3 - flap * 6, -18, 8, -4, 8], color, INK);
        line(ctx, 0, -2, -16 * scale, -10 - flap * 26, shade("#6b4a5c", -0.4), 2);
      };
      wing("#4c3446", 0.8);
      poly(ctx, [-22, 2, -8, -7, 12, -6, 18, 2, 4, 10, -12, 8], metal(ctx, "#7b5667", -7, 10), INK);
      poly(ctx, [10, -8, 24, -8, 36, 1, 20, 4], metal(ctx, "#8e6476", -8, 4), INK);
      poly(ctx, [10, -8, 2, -18, 17, -9], "#4c3446", INK, 1);
      eye(ctx, 21, -4, 2.2, "#ff8a3d");
      wing("#8e5f72", 1);
    },

    crawler(ctx, a) {
      for (let i = 0; i < 4; i++) {
        const x = -22 + i * 14;
        jointed(ctx, x, -16, x + 5 + sin(a.phase * 2 + i * 1.7) * 6, -1, 12, 13, -1, "#37333d", 5);
      }
      ctx.beginPath();
      ctx.moveTo(-36, -10);
      ctx.bezierCurveTo(-34, -52, 26, -54, 30, -12);
      ctx.closePath();
      ctx.fillStyle = metal(ctx, "#5f5868", -46, -10, 0.35);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 3; i++) line(ctx, -18 + i * 16, -14, -14 + i * 12, -38, "#39343f", 2);
      for (const [x, y] of [[-16, -30], [2, -36], [14, -26]]) eye(ctx, x, y, 1.6, "#58d6c2");
      poly(ctx, [24, -26, 40, -24, 38, -8, 26, -8], "#453f4c", INK);
      poly(ctx, [34, -14, 52, -20, 46, -8], "#d8c9a8", INK, 1);
      eye(ctx, 34, -20, 2, "#ff6a3d");
    },

    spider(ctx, a) {
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1;
        const pair = Math.floor(i / 2);
        const reach = (20 + pair * 5) * side + sin(a.phase * 2 + i * 1.5) * 4;
        jointed(ctx, side * 6, -22, reach, -1, 20, 22, side, i % 4 < 2 ? "#4d5a55" : "#34403c", 3.2);
      }
      oval(ctx, -10, -27, 17, 14, metal(ctx, "#55645e", -41, -13), INK);
      oval(ctx, -11, -31, 6, 4, "#8fe0b0");
      oval(ctx, 11, -22, 11, 10, metal(ctx, "#43504b", -32, -12), INK);
      for (let i = 0; i < 4; i++) eye(ctx, 12 + (i % 2) * 6, -27 + Math.floor(i / 2) * 5, 1.5, "#9cff57");
      line(ctx, 18, -16, 22, -8 + (a.windup ? -5 : 0), "#d8c9a8", 2.6);
    },

    stalker(ctx, a) {
      const p = a.phase;
      for (const [x, o, c] of [[-24, 1.8, "#26352c"], [16, 4.8, "#26352c"], [-20, 0, "#3d5544"], [20, 3, "#3d5544"]]) {
        jointed(ctx, x, -30, x + cos(p + o) * 14, -2 - max(0, sin(p + o)) * 7, 17, 17, x < 0 ? 1 : -1, c, 7);
      }
      ctx.beginPath();
      ctx.moveTo(-32, -38);
      ctx.quadraticCurveTo(-52, -30 + sin(a.time * 5) * 6, -66, -48);
      ctx.strokeStyle = "#31463a";
      ctx.lineWidth = 5;
      ctx.stroke();
      const crouch = a.windup ? 7 : 0;
      poly(ctx, [-36, -40, -20, -48, 10, -46 + crouch, 28, -44 + crouch, 24, -26 + crouch, -8, -28, -30, -24], metal(ctx, "#456650", -48, -24), INK);
      for (let i = 0; i < 5; i++) poly(ctx, [-24 + i * 10, -45, -18 + i * 10, -45, -26 + i * 10, -56], "#9cc46d", INK, 1);
      poly(ctx, [20, -52 + crouch, 36, -54 + crouch, 52, -40 + crouch, 36, -30 + crouch, 22, -34 + crouch], metal(ctx, "#4f7459", -54, -30), INK);
      poly(ctx, [34, -35 + crouch, 50, -38 + crouch, 36, -30 + crouch], "#1b2420");
      for (let i = 0; i < 3; i++) poly(ctx, [38 + i * 4, -37 + crouch, 41 + i * 4, -38 + crouch, 40 + i * 4, -33 + crouch], "#f1e6cc");
      eye(ctx, 37, -45 + crouch, 2.4, "#d9ff4d");
    },

    nestling(ctx, a) {
      const p = a.phase;
      const hop = -abs(sin(p)) * 5;
      for (const [x, o] of [[-6, 0], [6, PI]]) jointed(ctx, x, -20 + hop, x + cos(p + o) * 9, -2, 12, 12, -1, "#a8653d", 3.5);
      ctx.translate(0, hop);
      poly(ctx, [-22, -22, -8, -38, 10, -36, 14, -22, -2, -16], metal(ctx, "#b5523f", -38, -16), INK);
      const flap = a.grounded ? sin(a.time * 4) * 3 : sin(a.time * 24) * 14;
      poly(ctx, [-4, -34, -30, -42 - flap, -20, -20], "#74352d", INK);
      poly(ctx, [6, -50, 18, -52, 32, -40, 14, -34, 4, -38], metal(ctx, "#c9664c", -52, -34), INK);
      poly(ctx, [6, -50, -4, -58, 14, -51], "#e0a43a", INK, 1);
      if (a.windup) poly(ctx, [18, -39, 32, -40, 20, -30], "#5a241f", INK, 1);
      eye(ctx, 16, -45, 2, "#ffe23d");
    },

    eel(ctx, a) {
      ctx.translate(0, -22);
      ctx.rotate(a.angle || 0);
      for (let i = 9; i >= 0; i--) {
        const r = 14 - i * 1.15;
        const y = sin(a.time * 9 - i * 0.7) * i;
        oval(ctx, -i * 10, y, r, r, i % 2 ? "#2d7d86" : "#256a72", INK, 1.2);
        if (i % 3 === 0) oval(ctx, -i * 10, y, 2.5, 2.5, "#9dfff0");
      }
      poly(ctx, [2, -15, 30, -6, 18, -1], "#2d7d86", INK);
      poly(ctx, [2, 14, 28, 8, 14, 1], "#1d5860", INK);
      for (let i = 0; i < 3; i++) poly(ctx, [12 + i * 6, -4, 15 + i * 6, -4, 13.5 + i * 6, 2], "#e9fff9");
      eye(ctx, 9, -9, 2.4, "#d9ff4d");
    },
  };

  // The caller positions, scales and flips the context to the enemy's feet.
  function draw(ctx, a) {
    const { art } = a;
    if (MODELS[art]) MQ.Anim.drawHumanoid(ctx, a.pose, MODELS[art], a);
    else BODIES[art](ctx, a);
  }

  MQ.EnemyArt = { draw, jointed };
})(window.MQ);
