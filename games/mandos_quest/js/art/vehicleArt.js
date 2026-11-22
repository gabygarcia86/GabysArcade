/* Ships and vehicles, centered on the origin and pointing along +x. */
(function (MQ) {
  const { box, poly, oval, line, glow, metal } = MQ.U;
  const INK = MQ.INK;
  const { sin } = Math;

  const SHIPS = {
    // The Mandalorian's own gunship.
    gunship(ctx, time, thrust) {
      if (thrust) {
        for (const y of [-34, 22]) {
          const size = 70 + sin(time * 40 + y) * 10;
          poly(ctx, [-96, y - 9, -96 - size * thrust, y, -96, y + 9], "rgba(100,200,255,0.55)");
          glow(ctx, -100, y, 48 * thrust, "#7fd4ff", 0.9);
        }
      }
      box(ctx, -98, -52, 70, 34, 12, metal(ctx, "#68707a", -52, -18), INK, 2);
      poly(ctx, [-70, -28, 40, -30, 96, -14, 138, 4, 96, 20, -30, 26, -76, 14], metal(ctx, "#9da5ab", -30, 26, 0.35), INK, 2.5);
      poly(ctx, [40, -28, 70, -38, 98, -22, 104, -10, 56, -8], metal(ctx, "#7c858d", -38, -8), INK, 2);
      poly(ctx, [62, -30, 72, -33, 93, -21, 96, -14, 64, -14], "#14202a", INK);
      line(ctx, 68, -28, 86, -21, "#7fd4ff", 2);
      box(ctx, -98, 4, 78, 36, 12, metal(ctx, "#78818a", 4, 40), INK, 2);
      for (let i = 0; i < 3; i++) line(ctx, -84 + i * 20, 10, -84 + i * 20, 34, "#4b535c", 3);
      poly(ctx, [-30, -8, 20, -8, 8, 4, -42, 4], "#a5553b");
      line(ctx, -20, -22, 30, -22, "#5f676e", 2);
      line(ctx, 100, 6, 160, 8, INK, 3);
      box(ctx, 0, 24, 20, 8, 2, "#4b535c", INK);
    },

    cruiser(ctx, time) {
      poly(ctx, [-190, 30, -190, -22, -120, -30, 210, 22], metal(ctx, "#69727c", -30, 30, 0.25), INK, 2);
      poly(ctx, [-190, 30, 210, 22, -60, 48, -186, 48], "#3a4047", INK, 2);
      poly(ctx, [-150, -28, -140, -56, -86, -56, -70, -22], metal(ctx, "#78818b", -56, -22), INK, 2);
      box(ctx, -132, -72, 50, 14, 3, "#59626c", INK, 2);
      for (let i = 0; i < 16; i++) {
        if ((i * 7) % 5) line(ctx, -170 + i * 20, 10 + (i % 3) * 5, -164 + i * 20, 10 + (i % 3) * 5, "#cfe8ff", 2);
      }
      for (const y of [-10, 10, 34]) glow(ctx, -194, y, 26 + sin(time * 20 + y) * 3, "#7fb8ff", 0.9);
    },

    fighter(ctx) {
      poly(ctx, [-8, -34, 6, -42, 22, -30, 4, -22], "#2b3037", INK, 2);
      poly(ctx, [-8, 34, 6, 42, 22, 30, 4, 22], "#2b3037", INK, 2);
      line(ctx, 0, -28, 0, 28, "#59626c", 7);
      poly(ctx, [-22, -8, -4, -16, 18, -12, 30, 0, 18, 12, -4, 16, -22, 8], metal(ctx, "#59626c", -16, 16), INK, 2);
      oval(ctx, 14, 0, 7, 7, "#12161b", "#8a939d", 1.5);
      glow(ctx, -24, 0, 16, "#ff5348", 0.9);
    },

    shuttle(ctx, time, thrust) {
      poly(ctx, [-40, -10, -22, -78, 2, -10], metal(ctx, "#b9c0c7", -78, -10), INK, 2);
      poly(ctx, [-60, 18, -56, -14, 36, -18, 76, 6, 48, 20], metal(ctx, "#d3d9de", -18, 20, 0.3), INK, 2);
      poly(ctx, [-30, 16, 10, 16, -24, 58, -44, 58], metal(ctx, "#aab2ba", 16, 58), INK, 2);
      poly(ctx, [36, -12, 58, -2, 34, -2], "#14202a", INK);
      if (thrust) glow(ctx, -62, 2, 34, "#7fb8ff", 0.9);
    },

    crawler(ctx) {
      for (let i = 0; i < 2; i++) {
        box(ctx, -170 + i * 190, -56, 150, 56, 22, "#2f2721", INK, 3);
        for (let j = 0; j < 4; j++) oval(ctx, -146 + i * 190 + j * 34, -28, 14, 14, "#5a4a3c", INK, 2);
      }
      poly(ctx, [-190, -50, -180, -190, 120, -205, 200, -60, 160, -46], metal(ctx, "#8a5f3f", -205, -46, 0.25), INK, 3);
      for (let i = 0; i < 4; i++) line(ctx, -170, -170 + i * 32, 130 + i * 14, -176 + i * 32, "#63432c", 4);
      for (let i = 0; i < 6; i++) box(ctx, -150 + i * 40, -150, 16, 9, 2, i % 2 ? "#ffd45c" : "#33261d");
      poly(ctx, [120, -190, 150, -140, 100, -140, 92, -190], "#241b15", INK, 2);
    },
  };

  MQ.VehicleArt = {
    register(kind, paint) {
      SHIPS[kind] = paint;
    },
    draw(ctx, kind, time = 0, thrust = 1) {
      SHIPS[kind](ctx, time, thrust);
    },
  };
})(window.MQ);
