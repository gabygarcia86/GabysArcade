/* Weapons, drawn pointing along +x with the grip at the origin. */
(function (MQ) {
  const { box, poly, oval, line, glow, metal } = MQ.U;
  const INK = MQ.INK;
  const { sin } = Math;

  const GUNS = {
    blaster(ctx) {
      poly(ctx, [-3, -3, 4, -3, 2, 8, -5, 8], "#4a3527", INK);
      box(ctx, -5, -9, 17, 7, 2, metal(ctx, "#59616b", -9, -2), INK);
      box(ctx, 11, -7.5, 15, 3.6, 1.2, "#39404a", INK);
      box(ctx, 23, -8.5, 4, 5.5, 1, "#8c97a3", INK, 1);
      box(ctx, 0, -11.5, 8, 2.6, 1, "#272b31", INK, 1);
      line(ctx, 0, -6, 8, -6, "#aab4be", 1);
    },
    pulse(ctx, color) {
      poly(ctx, [-20, -7, -5, -8, -5, -1, -18, 4], "#2c333d", INK);
      poly(ctx, [-2, -2, 4, -2, 2, 8, -4, 8], "#23272e", INK);
      box(ctx, -8, -10, 30, 9, 2, metal(ctx, "#4c6275", -10, -1), INK);
      box(ctx, 21, -8, 17, 4, 1.5, "#252b33", INK);
      box(ctx, 8, -1, 8, 6, 1, "#39434f", INK);
      line(ctx, -3, -6, 18, -6, color, 2.2);
      glow(ctx, 37, -6, 7, color, 0.8);
    },
    heavy(ctx, color) {
      poly(ctx, [-22, -8, -8, -9, -8, 2, -20, 5], "#3d3229", INK);
      box(ctx, -11, -13, 35, 14, 3, metal(ctx, "#565b61", -13, 1), INK);
      box(ctx, 22, -11, 18, 9, 2, "#34383d", INK);
      box(ctx, 37, -13, 5, 13, 1.5, "#777f88", INK);
      box(ctx, 2, 1, 12, 8, 2, "#40362c", INK);
      for (let i = 0; i < 3; i++) box(ctx, -4 + i * 8, -10, 3, 7, 1, color);
    },
    flame(ctx, color) {
      box(ctx, -14, -11, 20, 10, 5, metal(ctx, "#8d4034", -11, -1), INK);
      box(ctx, 4, -8, 20, 5, 1.5, "#4a4f56", INK);
      poly(ctx, [22, -10, 30, -11, 30, 0, 22, -1], "#30343a", INK);
      poly(ctx, [-2, -2, 4, -2, 2, 7, -4, 7], "#23272e", INK);
      glow(ctx, 31, -5, 8, color, 0.9);
    },
    disruptor(ctx, color) {
      poly(ctx, [-26, -5, -8, -8, -8, -1, -24, 5], "#5a3c28", INK);
      poly(ctx, [-3, -2, 3, -2, 1, 7, -5, 7], "#3b2a1f", INK);
      box(ctx, -10, -9, 29, 7, 2, metal(ctx, "#514a5c", -9, -2), INK);
      box(ctx, 18, -8, 24, 3, 1, "#2b2832", INK);
      line(ctx, 42, -6.5, 52, -11, "#9aa2ad", 2);
      line(ctx, 42, -6.5, 52, -1, "#9aa2ad", 2);
      box(ctx, -6, -14, 15, 3.5, 1.5, "#22242a", INK, 1);
      glow(ctx, 49, -6, 10, color, 0.9);
    },
    staff(ctx, color) {
      box(ctx, -26, -3, 70, 5, 2.5, "#2c2f36", INK);
      for (const x of [-24, 42]) {
        box(ctx, x - 5, -4, 10, 7, 2, color, INK, 1);
        glow(ctx, x, 0, 14, color, 0.7);
      }
    },
    club(ctx) {
      box(ctx, -18, -3, 56, 5, 2, "#8a6a48", INK);
      poly(ctx, [32, -3, 46, -11, 50, 2, 36, 5], "#7b7467", INK);
      line(ctx, -4, -2, 4, -2, "#c7ad84", 3);
    },
    baton(ctx, color) {
      box(ctx, -5, -3, 12, 5, 2, "#33363d", INK);
      box(ctx, 7, -2.5, 22, 4, 2, color, INK, 1);
      glow(ctx, 22, 0, 13, color, 0.6);
    },
  };

  function blade(ctx, time = 0) {
    box(ctx, -8, -3.5, 13, 6.5, 2, "#3a322c", INK);
    box(ctx, 4, -6, 4, 11, 1, "#808a94", INK, 1);
    poly(ctx, [8, -3.5, 35, -4.5, 43, -0.5, 8, 3], metal(ctx, "#b9c7d1", -5, 3), INK, 1.2);
    line(ctx, 10, -2, 38, -2 + sin(time * 80) * 0.6, "#8ff7ff", 1.4);
    glow(ctx, 26, 0, 20, "#8ff7ff", 0.25);
  }

  // A flat, angular blade with a raked tip and a dark core.
  function saber(ctx, color, time = 0, power = 0, length = 72) {
    box(ctx, -12, -3.5, 17, 7, 1.5, metal(ctx, "#30343b", -4, 4), INK);
    poly(ctx, [3, -7, 9, -5, 9, 4, 3, 7], "#7a828c", INK, 1);
    for (let i = 0; i < 3; i++) box(ctx, -9 + i * 4, -3, 1.5, 6, 0, "#6c737c");

    const tip = 9 + length;
    const flicker = 0.85 + sin(time * 47) * 0.15;
    const spread = 22 + power * 14;
    for (let i = 1; i <= 4; i++) glow(ctx, 9 + (length * i) / 4.4, 0, spread, color.glow, (0.3 + power * 0.3) * flicker);

    const shape = [9, -4.5, tip - 18, -5.5, tip, -2.5 + sin(time * 33) * 0.7, tip - 11, 4, 9, 3.5];
    poly(ctx, shape, color.core, color.glow, 2.3 + power * 1.5);
    poly(ctx, [12, -1.5, tip - 20, -2.2, tip - 9, -0.8, 12, 0.6], MQ.U.alpha(color.glow, color.core === "#ffffff" ? 0.7 : 0.14));
  }

  function draw(ctx, id, options) {
    if (id === "blade") return blade(ctx, options?.time);
    if (id === "saber") return saber(ctx, options?.saber || MQ.DATA.saber("classic"), options?.time, options?.power);
    return GUNS[id]?.(ctx, options?.color || MQ.DATA.weapon(id).color);
  }

  // A large, centered picture for the weapons screen.
  function showcase(ctx, id, width, height, saberColor, time) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    const s = width / 96;
    ctx.scale(s, s);
    if (id === "birds" || id === "rocket") {
      box(ctx, -32, -11, 40, 22, 6, metal(ctx, "#8e9aa6", -11, 11), INK);
      box(ctx, -27, -15, 25, 8, 3, "#4a525c", INK);
      if (id === "birds") {
        for (let i = 0; i < 4; i++) {
          const y = (i - 1.5) * 8;
          poly(ctx, [12, y - 2, 25, y, 12, y + 2], "#ffd45c", INK, 1);
          glow(ctx, 12, y, 8, "#ffd45c", 0.7);
        }
      } else {
        box(ctx, 2, -15, 24, 8, 3, "#aa4036", INK);
        poly(ctx, [26, -15, 36, -11, 26, -7], "#d7dde3", INK);
        glow(ctx, 2, -11, 12, "#ffb347", 0.8);
      }
      oval(ctx, -38, 2, 7, 7, "#26242a", INK);
    } else if (id === "saber") {
      ctx.scale(0.86, 0.86);
      ctx.translate(-37, 0);
      saber(ctx, saberColor, time, 0.3);
    } else {
      ctx.translate({ blaster: -11, blade: -18, pulse: -9, heavy: -10, flame: -8, disruptor: -13 }[id] || 0, 2);
      draw(ctx, id);
    }
    ctx.restore();
  }

  MQ.WeaponArt = { draw, saber, showcase, muzzle: { blaster: 27, pulse: 39, heavy: 42, flame: 31, disruptor: 52 } };
})(window.MQ);
