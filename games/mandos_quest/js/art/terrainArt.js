/*
 * Terrain, interiors and scenery. These never change, so they are rendered once into
 * cached tiles.
 */
(function (MQ) {
  const { box, poly, oval, line, glow, metal, shade, alpha, rng, makeCanvas } = MQ.U;
  const INK = MQ.INK;
  const { floor, max, min, ceil, abs, PI } = Math;
  const TILE = 512;
  const MAX_TILES = 28;

  const MATERIALS = {
    sand: { style: "soil", top: "#e0b273", face: "#a86b45", trim: "#f2d19a" },
    canyon: { style: "strata", top: "#c98d58", face: "#86492f", trim: "#e6b27a" },
    cave: { style: "rock", top: "#6b5547", face: "#3d2e2a", trim: "#8f7563" },
    facility: { style: "panel", top: "#77808a", face: "#39414b", trim: "#e0a43a" },
    city: { style: "brick", top: "#8a6a5c", face: "#4a3434", trim: "#b98a6a" },
    basalt: { style: "rock", top: "#5c4a50", face: "#2b2229", trim: "#ff6a2a" },
    mine: { style: "panel", top: "#8a7650", face: "#3b332c", trim: "#ffb347" },
    moss: { style: "soil", top: "#5f8a4a", face: "#3c3328", trim: "#93bd62" },
    adobe: { style: "plaster", top: "#e6c89a", face: "#b88c60", trim: "#f5e2bc" },
    rust: { style: "panel", top: "#9c6a45", face: "#5a3b29", trim: "#ffd45c" },
    ruin: { style: "brick", top: "#6f8378", face: "#2e403b", trim: "#58d6c2" },
    temple: { style: "brick", top: "#8c9a88", face: "#24434a", trim: "#d4a93f" },
    ice: { style: "ice", top: "#eef6fb", face: "#5f7e9c", trim: "#b9dcef" },
    base: { style: "panel", top: "#8796a5", face: "#36424f", trim: "#ff5348" },
    ship: { style: "panel", top: "#5f6b80", face: "#1e2432", trim: "#6fb8ff" },
    citadel: { style: "panel", top: "#62567a", face: "#231c32", trim: "#d24cff" },
  };

  function hash(a, b) {
    let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* Texture for the part of a shape inside the given area. The caller has clipped. */
  function texture(ctx, mat, x0, y0, x1, y1) {
    const c = mat.face;
    switch (mat.style) {
      case "soil": {
        const size = 46;
        for (let i = floor(x0 / size); i <= ceil(x1 / size); i++) {
          for (let j = floor(y0 / size); j <= ceil(y1 / size); j++) {
            const r = hash(i, j);
            if (r < 0.4) oval(ctx, (i + r) * size, (j + hash(j, i)) * size, 3 + r * 16, 2 + r * 9, shade(c, r < 0.2 ? -0.16 : 0.08));
            else if (r > 0.9) line(ctx, i * size, j * size, (i + 0.8) * size, (j + 0.2) * size, shade(c, -0.12), 2);
          }
        }
        break;
      }
      case "strata": {
        for (let j = floor(y0 / 34); j <= ceil(y1 / 34); j++) {
          const r = hash(j, 7);
          ctx.beginPath();
          const start = floor(x0 / 120) * 120;
          ctx.moveTo(start, j * 34);
          for (let x = start; x <= x1 + 120; x += 120) ctx.lineTo(x, j * 34 + (hash(x, j) - 0.5) * 14);
          ctx.strokeStyle = shade(c, r > 0.5 ? 0.12 : -0.14);
          ctx.lineWidth = 3 + r * 9;
          ctx.stroke();
        }
        break;
      }
      case "rock": {
        const size = 84;
        for (let i = floor(x0 / size) - 1; i <= ceil(x1 / size); i++) {
          for (let j = floor(y0 / size) - 1; j <= ceil(y1 / size); j++) {
            const r = hash(i, j);
            const x = i * size + r * 18;
            const y = j * size + hash(j, i) * 18;
            poly(ctx, [x, y + 16, x + 22, y, x + 62, y + 6, x + 76, y + 36, x + 58, y + 68, x + 16, y + 62, x - 4, y + 40], shade(c, r < 0.5 ? 0.07 : -0.12));
            line(ctx, x + 22, y + 2, x + 60, y + 8, shade(c, 0.17), 2.5);
          }
        }
        break;
      }
      case "brick": {
        const w = 78;
        const h = 38;
        for (let j = floor(y0 / h); j <= ceil(y1 / h); j++) {
          for (let i = floor(x0 / w) - 1; i <= ceil(x1 / w); i++) {
            const r = hash(i, j);
            const x = (i + (j % 2 ? 0.5 : 0)) * w;
            box(ctx, x + 2, j * h + 2, w - 4, h - 4, 4, shade(c, (r - 0.5) * 0.22));
            line(ctx, x + 7, j * h + 5, x + w - 9, j * h + 5, shade(c, 0.15), 1.5);
            if (r > 0.94) poly(ctx, [x + w / 2, j * h + 9, x + w / 2 + 9, j * h + 19, x + w / 2, j * h + 29, x + w / 2 - 9, j * h + 19], null, alpha(mat.trim, 0.8), 2);
          }
        }
        break;
      }
      case "panel": {
        const size = 96;
        for (let i = floor(x0 / size); i <= ceil(x1 / size); i++) {
          for (let j = floor(y0 / size); j <= ceil(y1 / size); j++) {
            const x = i * size;
            const y = j * size;
            const r = hash(i, j);
            box(ctx, x + 3, y + 3, size - 6, size - 6, 3, shade(c, (r - 0.5) * 0.14));
            line(ctx, x + 5, y + 5, x + size - 5, y + 5, shade(c, 0.17), 1.5);
            for (const [bx, by] of [[12, 14], [size - 12, size - 14]]) oval(ctx, x + bx, y + by, 2, 2, shade(c, -0.4));
            if (r > 0.83) {
              box(ctx, x + 22, y + 40, 46, 5, 1, alpha(mat.trim, 0.7));
            } else if (r < 0.14) {
              for (let k = 0; k < 4; k++) line(ctx, x + 20, y + 26 + k * 12, x + 72, y + 26 + k * 12, shade(c, -0.3), 3);
            }
          }
        }
        break;
      }
      case "plaster": {
        for (let i = floor(x0 / 70); i <= ceil(x1 / 70); i++) {
          for (let j = floor(y0 / 70); j <= ceil(y1 / 70); j++) {
            const r = hash(i, j);
            if (r < 0.25) line(ctx, i * 70, j * 70, i * 70 + 18, j * 70 + 12, shade(c, -0.18), 1.6);
            else if (r > 0.86) box(ctx, i * 70, j * 70, 34, 16, 5, shade(c, -0.12));
          }
        }
        break;
      }
      case "ice": {
        for (let i = floor(x0 / 90) - 1; i <= ceil(x1 / 90); i++) {
          for (let j = floor(y0 / 90) - 1; j <= ceil(y1 / 90); j++) {
            const r = hash(i, j);
            const x = i * 90;
            const y = j * 90;
            poly(ctx, [x, y, x + 90 * r + 20, y + 14, x + 60, y + 88, x - 10, y + 60], shade(c, (r - 0.5) * 0.25));
            line(ctx, x + 8, y + 8, x + 30 + r * 30, y + 20, shade(c, 0.35), 2);
          }
        }
        break;
      }
    }
  }

  function surface(ctx, mat, x, y, w, seed) {
    switch (mat.style) {
      case "panel": {
        box(ctx, x, y, w, 11, 0, mat.top);
        box(ctx, x, y, w, 3, 0, shade(mat.top, 0.3));
        box(ctx, x, y + 11, w, 3, 0, alpha(mat.trim, 0.85));
        for (let i = x + 8; i < x + w - 12; i += 26) line(ctx, i, y + 8, i + 8, y + 4, shade(mat.top, -0.3), 2, "butt");
        break;
      }
      case "brick":
      case "plaster":
        box(ctx, x - 2, y, w + 4, 15, 3, mat.top, INK, 1.2);
        line(ctx, x, y + 3, x + w, y + 3, alpha(mat.trim, 0.8), 2);
        for (let i = x + 40; i < x + w - 10; i += 80) line(ctx, i, y + 2, i, y + 14, shade(mat.top, -0.25), 1.5);
        break;
      default: {
        const depth = mat.style === "ice" ? 20 : 14;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + w + 3, y);
        ctx.lineTo(x + w + 2, y + depth * 0.5);
        for (let i = w; i > 0; i -= 24) ctx.lineTo(x + i, y + depth * (0.55 + hash(seed + i, 3) * 0.9));
        ctx.lineTo(x - 2, y + depth * 0.7);
        ctx.closePath();
        ctx.fillStyle = mat.top;
        ctx.fill();
        line(ctx, x, y + 2, x + w, y + 2, mat.style === "ice" ? "#ffffff" : mat.trim, 3);
        if (mat.style === "soil") {
          for (let i = 10; i < w - 8; i += 37) {
            if (hash(seed + i, 9) < 0.5) continue;
            line(ctx, x + i, y + 1, x + i - 4, y - 7, mat.top, 2);
            line(ctx, x + i + 2, y + 1, x + i + 5, y - 9, mat.trim, 2);
          }
        }
      }
    }
  }

  function solid(ctx, s, clip) {
    const mat = MATERIALS[s.mat];
    const x0 = max(s.x, clip.x0);
    const y0 = max(s.y, clip.y0);
    const x1 = min(s.x + s.w, clip.x1);
    const y1 = min(s.y + s.h, clip.y1);

    if (x1 > x0 && y1 > y0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.clip();
      ctx.fillStyle = mat.face;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      texture(ctx, mat, x0, y0, x1, y1);
      const gradient = ctx.createLinearGradient(0, s.y, 0, s.y + 380);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.36)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      if (!s.joinLeft) ctx.fillRect(s.x, s.y, 3, s.h);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      if (!s.joinRight) ctx.fillRect(s.x + s.w - 4, s.y, 4, s.h);
      ctx.fillRect(s.x, s.y + s.h - 5, s.w, 5);
      ctx.restore();
    }
    if (!s.covered) surface(ctx, mat, s.x, s.y, s.w, s.x);
  }

  function slope(ctx, s, clip) {
    const mat = MATERIALS[s.mat];
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1 + 0.5, s.y1);
    ctx.lineTo(s.x1 + 0.5, s.bottom);
    ctx.lineTo(s.x0, s.bottom);
    ctx.closePath();
    ctx.fillStyle = mat.face;
    ctx.fill();
    ctx.clip();
    texture(ctx, mat, max(s.x0, clip.x0), max(min(s.y0, s.y1), clip.y0), min(s.x1, clip.x1), min(s.bottom, clip.y1));
    // The same depth shading as flat ground, sheared to follow the slope.
    ctx.transform(1, (s.y1 - s.y0) / (s.x1 - s.x0), 0, 1, s.x0, s.y0);
    const gradient = ctx.createLinearGradient(0, 0, 0, 380);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.36)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s.x1 - s.x0 + 1, s.bottom);
    ctx.restore();
    line(ctx, s.x0, s.y0 + 7, s.x1, s.y1 + 7, mat.top, 14);
    line(ctx, s.x0, s.y0 + 2, s.x1, s.y1 + 2, mat.trim, 3);
  }

  function ledge(ctx, s) {
    const mat = MATERIALS[s.mat];
    const { x, y, w } = s;
    switch (mat.style) {
      case "panel":
        box(ctx, x, y, w, 14, 2, metal(ctx, mat.face, y, y + 14), INK, 1.5);
        line(ctx, x + 2, y + 2, x + w - 2, y + 2, mat.top, 3);
        for (let i = x + 12; i < x + w - 8; i += 30) box(ctx, i, y + 6, 12, 3, 1, mat.trim);
        for (const px of [x + 12, x + w - 12]) line(ctx, px, y + 14, px + (px < x + w / 2 ? 14 : -14), y + 28, shade(mat.face, -0.3), 4);
        break;
      case "soil":
      case "plaster":
        box(ctx, x, y + 2, w, 13, 5, metal(ctx, "#7b5638", y + 2, y + 15), INK, 1.5);
        for (let i = x + 14; i < x + w - 6; i += 22) line(ctx, i, y + 4, i - 2, y + 13, "#5b3d28", 2);
        line(ctx, x + 2, y + 2, x + w - 2, y + 2, mat.top, 5);
        break;
      default:
        poly(ctx, [x, y, x + w, y, x + w - 6, y + 12, x + w * 0.62, y + 20, x + w * 0.34, y + 16, x + 7, y + 12], mat.face, INK, 1.5);
        line(ctx, x + 2, y + 2, x + w - 2, y + 2, mat.top, 5);
        line(ctx, x + w * 0.4, y + 8, x + w * 0.5, y + 15, shade(mat.face, -0.3), 2);
    }
  }

  function room(ctx, r, clip) {
    const { x, y, w, h, kind } = r;
    const color = {
      cave: "#241b19", facility: "#232a33", city: "#2a1c1f", mine: "#211a18", rust: "#33231b",
      ruin: "#172522", temple: "#102329", base: "#1f2832", ship: "#121722", citadel: "#171224", adobe: "#5a3f2e", moss: "#1c241c",
    }[kind];
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);

    const size = 160;
    for (let i = floor(max(x, clip.x0) / size); i <= ceil(min(x + w, clip.x1) / size); i++) {
      const px = i * size;
      if (kind === "cave" || kind === "mine" || kind === "moss") {
        for (let j = floor(y / size); j <= ceil((y + h) / size); j++) {
          const q = hash(i, j);
          oval(ctx, px + q * 90, j * size + q * 50, 50 + q * 60, 26 + q * 34, shade(color, q > 0.5 ? 0.06 : -0.2));
        }
        if (kind === "mine") {
          box(ctx, px, y, 12, h, 0, "#4a3826");
          box(ctx, px - 20, y + 6, 52, 10, 0, "#4a3826");
        }
      } else {
        box(ctx, px, y, 22, h, 0, shade(color, 0.07));
        box(ctx, px + 4, y, 4, h, 0, shade(color, 0.14));
        box(ctx, px + 40, y + 24, size - 60, max(10, h - 60), 6, null, shade(color, 0.07), 3);
        if (hash(i, y) > 0.5) {
          const light = { city: "#ffad4d", rust: "#ffd45c", ruin: "#58d6c2", temple: "#d4a93f", base: "#ff5348", ship: "#6fb8ff", citadel: "#d24cff", facility: "#e0a43a", adobe: "#ffd98a" }[kind];
          box(ctx, px + 74, y + 34, 30, 7, 3, light);
          glow(ctx, px + 89, y + 40, 90, light, 0.22);
        }
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x, y, w, 14);
    ctx.fillRect(x, y, 10, h);
    ctx.restore();
  }

  /* ---------- Scenery, drawn from the middle of its base ---------- */

  const DECOR = {
    rock(ctx, r, o) {
      const c = o.color || "#8a5a3f";
      poly(ctx, [-38, 2, -30, -20, -10, -32, 18, -28, 36, -10, 40, 2], metal(ctx, c, -32, 2), INK, 1.5);
      poly(ctx, [-10, -32, 18, -28, 4, -16, -22, -14], alpha(shade(c, 0.3), 0.5));
    },
    bush(ctx, r, o) {
      const c = o.color || "#8a7a4a";
      for (let i = 0; i < 11; i++) {
        const a = -PI * (0.1 + (i / 10) * 0.8);
        line(ctx, 0, 2, Math.cos(a) * r.range(16, 32), Math.sin(a) * r.range(18, 36), i % 2 ? c : shade(c, -0.3), 3);
      }
    },
    fern(ctx, r, o) {
      const c = o.color || "#4f8a4a";
      for (let i = 0; i < 7; i++) {
        const tx = (i - 3) * 15;
        const ty = -50 + abs(i - 3) * 8;
        line(ctx, 0, 2, tx, ty, shade(c, -0.2), 2.5);
        for (let j = 1; j < 5; j++) {
          const k = j / 5;
          line(ctx, tx * k, ty * k, tx * k + 8, ty * k - 5, c, 3);
          line(ctx, tx * k, ty * k, tx * k - 8, ty * k - 5, c, 3);
        }
      }
    },
    tree(ctx) {
      poly(ctx, [-26, 4, -12, -40, -10, -230, 10, -230, 14, -50, 30, 4], metal(ctx, "#4a3a2c", -230, 4, 0.15), INK, 2);
      line(ctx, 0, -120, -64, -166, "#4a3a2c", 10);
      line(ctx, 0, -150, 62, -200, "#4a3a2c", 9);
      for (const [x, y, w] of [[-70, -178, 60], [66, -212, 64], [0, -246, 90], [-30, -226, 50], [30, -262, 56]]) {
        oval(ctx, x, y + 8, w, w * 0.4, "#28452c");
        oval(ctx, x - 4, y, w * 0.9, w * 0.34, "#3b6038");
      }
    },
    pine(ctx) {
      box(ctx, -5, -30, 10, 32, 2, "#3a2c26");
      for (let i = 0; i < 4; i++) {
        const y = -16 - i * 26;
        const w = 44 - i * 9;
        poly(ctx, [-w, y, 0, y - 46, w, y], "#274252", INK, 1.5);
        poly(ctx, [-w * 0.5, y - 23, 0, y - 46, w * 0.36, y - 29, 4, y - 25], "#dcebf3");
      }
    },
    bones(ctx) {
      ctx.lineCap = "round";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-40 + i * 24, 4);
        ctx.quadraticCurveTo(-62 + i * 24, -40, -24 + i * 24, -54 + abs(i - 1.5) * 10);
        ctx.strokeStyle = "#d8c9a8";
        ctx.lineWidth = 6;
        ctx.stroke();
      }
      oval(ctx, 70, -10, 16, 12, "#d8c9a8", INK, 1);
      oval(ctx, 75, -12, 4, 4, "#3a2c26");
    },
    crystal(ctx, r, o) {
      const c = o.color || "#b04cff";
      for (const [x, h, w] of [[-18, 34, 9], [0, 62, 12], [18, 40, 8]]) {
        poly(ctx, [x - w, 3, x - w * 0.7 + x * 0.3, -h + 12, x + x * 0.3, -h, x + w * 0.7 + x * 0.3, -h + 12, x + w, 3], metal(ctx, c, -h, 3), INK, 1);
      }
      glow(ctx, 0, -26, 60, c, 0.4);
    },
    pipe(ctx, r, o) {
      const h = o.h || 200;
      box(ctx, -14, -h, 28, h + 2, 4, metal(ctx, "#4b4248", -h, 2, 0.2), INK, 1.5);
      for (let y = 20; y < h; y += 60) box(ctx, -18, -y, 36, 10, 2, "#62575e", INK, 1);
    },
    tank(ctx, r, o) {
      const c = o.color || "#5f6b76";
      box(ctx, -34, -92, 68, 94, 20, metal(ctx, c, -92, 2), INK, 2);
      for (const y of [-72, -30]) box(ctx, -34, y, 68, 7, 0, shade(c, -0.3));
      box(ctx, -8, -60, 16, 20, 3, "#1a1e24");
      box(ctx, -4, -56, 8, 8, 1, o.light || "#6dff9a");
    },
    lamp(ctx, r, o) {
      const c = o.color || "#ffd98a";
      box(ctx, -4, -124, 8, 126, 2, "#3a3e46", INK, 1);
      box(ctx, -16, -134, 32, 10, 3, "#4b515a", INK, 1);
      box(ctx, -12, -125, 24, 4, 1, c);
      glow(ctx, 0, -116, 80, c, 0.4);
    },
    hut(ctx) {
      ctx.beginPath();
      ctx.moveTo(-90, 2);
      ctx.lineTo(-90, -70);
      ctx.bezierCurveTo(-90, -150, 90, -150, 90, -70);
      ctx.lineTo(90, 2);
      ctx.closePath();
      ctx.fillStyle = metal(ctx, "#cfa878", -130, 2, 0.2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      box(ctx, -22, -62, 44, 64, 18, "#4a3426", INK, 2);
      for (const x of [-58, 58]) box(ctx, x - 9, -78, 18, 14, 5, "#4a3426");
      box(ctx, -96, -8, 192, 10, 3, "#b48a5e");
    },
    vaporator(ctx) {
      box(ctx, -6, -150, 12, 152, 2, metal(ctx, "#b9b3a4", -150, 2, 0.2), INK, 1.5);
      for (const [y, w] of [[-138, 22], [-108, 30], [-64, 18]]) box(ctx, -w / 2, y, w, 14, 3, "#9b9484", INK, 1.5);
      line(ctx, 0, -150, 0, -178, INK, 2);
      poly(ctx, [-14, 2, -7, -22, 7, -22, 14, 2], "#8a8374", INK, 1.5);
    },
    wreck(ctx) {
      ctx.save();
      ctx.rotate(-0.12);
      poly(ctx, [-90, 12, -70, -40, 30, -54, 100, -10, 70, 16], metal(ctx, "#5d5a5c", -54, 16), INK, 2);
      poly(ctx, [-30, -44, 10, -48, 0, -26, -38, -22], "#1c1b1e");
      line(ctx, 40, -50, 80, -96, "#4a4749", 8);
      ctx.restore();
    },
    antenna(ctx) {
      for (let i = 0; i < 4; i++) line(ctx, -16 + i * 4, -i * 46, 12 - i * 4, -(i + 1) * 46, "#5b636c", 3);
      line(ctx, -16, 2, -3, -190, "#6b747e", 4);
      line(ctx, 16, 2, 3, -190, "#6b747e", 4);
      oval(ctx, 8, -200, 26, 12, "#8d97a1", INK, 1.5, -0.4);
      oval(ctx, 0, -215, 4, 4, "#ff5348");
    },
    console(ctx, r, o) {
      const c = o.color || "#6fd4ff";
      poly(ctx, [-30, 2, -26, -40, 26, -40, 30, 2], metal(ctx, "#3c444e", -40, 2), INK, 1.5);
      poly(ctx, [-24, -42, -18, -74, 22, -74, 26, -42], "#22272e", INK, 1.5);
      for (let i = 0; i < 4; i++) line(ctx, -12, -67 + i * 6, -12 + r.range(8, 28), -67 + i * 6, c, 2);
      glow(ctx, 2, -58, 36, c, 0.35);
    },
    cargo(ctx, r, o) {
      for (const [x, y, w, h] of [[-34, -34, 40, 36], [10, -28, 34, 30], [-18, -62, 34, 28]]) {
        const c = o.color || r.pick(["#6b5a48", "#55606a", "#7a5140"]);
        box(ctx, x, y, w, h, 3, metal(ctx, c, y, y + h, 0.2), INK, 1.5);
        line(ctx, x + 4, y + h / 2, x + w - 4, y + h / 2, shade(c, -0.3), 3);
      }
    },
    banner(ctx, r, o) {
      const c = o.color || "#8e2633";
      const h = o.h || 130;
      box(ctx, -26, -h - 60, 52, 6, 2, "#3a3e46");
      poly(ctx, [-22, -h - 54, 22, -h - 54, 22, -60, 0, -76, -22, -60], metal(ctx, c, -h - 54, -60, 0.2), INK, 1.5);
      if (o.imperial) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          ctx.moveTo(0, -h + 4);
          ctx.lineTo(Math.cos((i * PI) / 3) * 15, -h + 4 + Math.sin((i * PI) / 3) * 15);
        }
        ctx.strokeStyle = "#cfd6dc";
        ctx.lineWidth = 3;
        ctx.stroke();
      } else {
        poly(ctx, [0, -h - 14, 12, -h + 2, 0, -h + 22, -12, -h + 2], null, "#d4a93f", 3);
      }
    },
    statue(ctx) {
      const stone = "#5f756f";
      box(ctx, -44, -26, 88, 28, 3, metal(ctx, stone, -26, 2, 0.15), INK, 2);
      poly(ctx, [-26, -26, -22, -110, -34, -118, -30, -140, 30, -140, 34, -118, 22, -110, 26, -26], metal(ctx, stone, -140, -26, 0.2), INK, 2);
      poly(ctx, [-22, -142, -22, -176, -10, -194, 10, -194, 22, -176, 22, -142], metal(ctx, stone, -194, -142, 0.2), INK, 2);
      poly(ctx, [-15, -174, 15, -174, 14, -166, 4, -165, 3, -148, -3, -148, -4, -165, -14, -166], "#16211f");
      line(ctx, 30, -120, 34, -30, shade(stone, -0.25), 8);
    },
    column(ctx, r, o) {
      const h = o.h || 170;
      const c = o.color || "#50665f";
      box(ctx, -20, -h, 40, h + 2, 2, metal(ctx, c, -h, 2, 0.15), INK, 1.5);
      box(ctx, -28, -14, 56, 16, 2, shade(c, 0.1), INK, 1.5);
      if (!o.broken) box(ctx, -28, -h - 6, 56, 16, 2, shade(c, 0.1), INK, 1.5);
      else poly(ctx, [-21, -h, -8, -h + 14, 6, -h + 4, 21, -h + 22, 21, -h - 2, -21, -h - 2], "#101817");
      for (const x of [-9, 3]) line(ctx, x, -h + 24, x, -20, shade(c, -0.25), 3);
    },
    nest(ctx, r) {
      for (let i = 0; i < 28; i++) line(ctx, r.range(-64, 30), r.range(-18, 2), r.range(-20, 66), r.range(-24, 0), i % 2 ? "#6b4c32" : "#8a6644", 4);
      for (const x of [-22, 4, 26]) oval(ctx, x, -24, 13, 17, metal(ctx, "#d9c6a0", -40, -8), INK, 1.5);
    },
    light(ctx, r, o) {
      const c = o.color || "#6fb8ff";
      box(ctx, -5, -30, 10, 32, 2, "#333a44", INK, 1);
      box(ctx, -3, -27, 6, 14, 2, c);
      glow(ctx, 0, -20, 44, c, 0.5);
    },
    gunship(ctx) {
      ctx.translate(0, -42);
      MQ.VehicleArt.draw(ctx, "gunship", 0, 0);
    },
    crawler: (ctx) => MQ.VehicleArt.draw(ctx, "crawler"),
    generator(ctx, r, o) {
      const c = o.color || "#b04cff";
      box(ctx, -40, -24, 80, 26, 4, "#2b303a", INK, 2);
      box(ctx, -18, -120, 36, 96, 8, "#1c2028", INK, 2);
      for (let i = 0; i < 4; i++) box(ctx, -12, -110 + i * 21, 24, 8, 3, c);
      glow(ctx, 0, -70, 90, c, 0.35);
    },
  };

  class TerrainRenderer {
    constructor(world, scale = 1) {
      this.world = world;
      this.scale = scale;
      this.tiles = new Map();
      this.spare = [];
    }

    render(key, tx, ty) {
      const canvas = this.spare.pop() || makeCanvas(TILE * this.scale, TILE * this.scale);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(this.scale, 0, 0, this.scale, -tx * TILE * this.scale, -ty * TILE * this.scale);

      const clip = { x0: tx * TILE, y0: ty * TILE, x1: (tx + 1) * TILE, y1: (ty + 1) * TILE };
      const inTile = (x0, y0, x1, y1) => x0 < clip.x1 && x1 > clip.x0 && y0 < clip.y1 && y1 > clip.y0;
      const { rooms, decor, terrain, slopes } = this.world;

      for (const r of rooms) if (inTile(r.x, r.y, r.x + r.w, r.y + r.h)) room(ctx, r, clip);
      for (const d of decor) {
        if (!inTile(d.x - 220, d.y - 340, d.x + 220, d.y + 30)) continue;
        ctx.save();
        ctx.translate(d.x, d.y);
        const s = d.options.scale || 1;
        ctx.scale(s * (d.options.flip ? -1 : 1), s);
        DECOR[d.type](ctx, rng(d.x * 13 + d.y), d.options);
        ctx.restore();
      }
      for (const s of slopes) if (inTile(s.x0, min(s.y0, s.y1) - 12, s.x1, s.bottom)) slope(ctx, s, clip);
      for (const s of terrain) {
        if (!inTile(s.x - 4, s.y - 14, s.x + s.w + 4, s.y + s.h + 32)) continue;
        if (s.oneWay) ledge(ctx, s);
        else solid(ctx, s, clip);
      }

      this.tiles.set(key, canvas);
      if (this.tiles.size > MAX_TILES) {
        const oldest = this.tiles.keys().next().value;
        this.spare.push(this.tiles.get(oldest));
        this.tiles.delete(oldest);
      }
      return canvas;
    }

    draw(ctx, camera) {
      const x0 = floor(camera.x / TILE);
      const x1 = floor((camera.x + camera.viewW) / TILE);
      const y0 = floor(camera.y / TILE);
      const y1 = floor((camera.y + camera.viewH) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        for (let ty = y0; ty <= y1; ty++) {
          const key = (tx + 8) * 1000 + ty + 8;
          let canvas = this.tiles.get(key);
          if (canvas) {
            // Re-insert, so the tile used longest ago is dropped first.
            this.tiles.delete(key);
            this.tiles.set(key, canvas);
          } else {
            canvas = this.render(key, tx, ty);
          }
          // The small overlap hides seams between tiles.
          ctx.drawImage(canvas, tx * TILE, ty * TILE, TILE + 0.6, TILE + 0.6);
        }
      }
    }

    // Frees the tile memory straight away when a level ends.
    dispose() {
      for (const canvas of [...this.tiles.values(), ...this.spare]) {
        canvas.width = 1;
        canvas.height = 1;
      }
      this.tiles.clear();
      this.spare.length = 0;
    }
  }

  MQ.TerrainRenderer = TerrainRenderer;
  MQ.MATERIALS = MATERIALS;
})(window.MQ);
