/*
 * LevelRenderer draws the world itself: platforms, hazards, props and pickups.
 * Each planet is a THEMES entry, and surface textures are drawn once into a tile
 * and then used as a repeating pattern so large floors stay cheap.
 */
(function (J) {
  const { rng, makeCanvas, roundRect, rand } = J.U;
  const { Art } = J;
  const TAU = J.TAU;
  const { shade } = Art;

  const THEMES = {
    temple: { style: "stone", base: "#b8ab92", dark: "#7c6f5c", cap: "#e2d2a8", capEdge: "#caa54e", accent: "#ffcf6a", laser: "#ff4a4a", dust: "rgba(220,205,170,.6)", pit: "void", pitColor: "#1a1230", glow: "#3a2a60" },
    kashyyyk: { style: "wood", base: "#5a4028", dark: "#3a2818", cap: "#4f8a3a", capEdge: "#2f5e28", accent: "#9fe07a", laser: "#7cff5a", dust: "rgba(120,160,90,.6)", pit: "bog", pitColor: "#0f2a22", glow: "#1f5a44" },
    tatooine: { style: "sand", base: "#c99a5e", dark: "#96703f", cap: "#ecc98c", capEdge: "#d1a766", accent: "#ffd76a", laser: "#ff7a3a", dust: "rgba(226,190,130,.7)", pit: "sand", pitColor: "#8a5e30", glow: "#c08a4a" },
    mustafar: { style: "basalt", base: "#2c2224", dark: "#191315", cap: "#4a3432", capEdge: "#ff6a20", accent: "#ff8a2a", laser: "#ff5a20", dust: "rgba(120,90,80,.6)", pit: "lava", pitColor: "#ff5a14", glow: "#ff6a20" },
    hoth: { style: "ice", base: "#a9cfe4", dark: "#6c9ec0", cap: "#f2fbff", capEdge: "#c6e6f6", accent: "#58d0ff", laser: "#58d0ff", dust: "rgba(235,248,255,.8)", pit: "void", pitColor: "#16324a", glow: "#3a7aa0", ice: true },
    narshaddaa: { style: "grate", base: "#2a2c3e", dark: "#171827", cap: "#3c3f58", capEdge: "#ff3ab0", accent: "#3affd8", laser: "#ff3ab0", dust: "rgba(150,140,190,.5)", pit: "city", pitColor: "#2a0f44", glow: "#ff3ab0" },
    endor: { style: "bunker", base: "#4a5048", dark: "#2c302c", cap: "#58724a", capEdge: "#3a5a34", accent: "#ffb648", laser: "#ff4a3a", dust: "rgba(120,130,100,.6)", pit: "bog", pitColor: "#141f14", glow: "#23401f" },
    deathstar: { style: "panel", base: "#5c626c", dark: "#343940", cap: "#8a919c", capEdge: "#3ad0ff", accent: "#3ad0ff", laser: "#ff3a3a", dust: "rgba(170,180,190,.5)", pit: "shaft", pitColor: "#05070c", glow: "#3ad0ff" },
    exegol: { style: "obsidian", base: "#1e2028", dark: "#0f1016", cap: "#2e303c", capEdge: "#7ac8ff", accent: "#7ac8ff", laser: "#9fd8ff", dust: "rgba(100,110,130,.5)", pit: "void", pitColor: "#0a0c18", glow: "#2a5a9a" },
    throne: { style: "obsidian", base: "#17151c", dark: "#0a090e", cap: "#2c2632", capEdge: "#ff3a4a", accent: "#ff3a4a", laser: "#ff3a4a", dust: "rgba(100,90,110,.5)", pit: "void", pitColor: "#150610", glow: "#7a1a2a" },
  };

  const TILE = 128;

  // Draws one seamless square of surface in a theme's style.
  function buildTile(theme, seed) {
    const canvas = makeCanvas(TILE * 2, TILE * 2);
    const c = canvas.getContext("2d");
    c.scale(2, 2);
    const r = rng(seed);
    c.fillStyle = theme.base;
    c.fillRect(0, 0, TILE, TILE);
    const dark = theme.dark;
    const light = shade(theme.base, 0.14);

    const speckle = (count, color, size = 2) => {
      c.fillStyle = color;
      for (let i = 0; i < count; i++) c.fillRect(r() * TILE, r() * TILE, 1 + r() * size, 1 + r() * size);
    };

    switch (theme.style) {
      case "stone":
        speckle(70, dark, 2);
        c.strokeStyle = dark;
        c.lineWidth = 1.5;
        for (let row = 0; row < 3; row++) {
          const y = row * 43;
          c.beginPath();
          c.moveTo(0, y);
          c.lineTo(TILE, y);
          for (let i = 0; i < 2; i++) {
            const x = (i * 64 + (row % 2) * 32) % TILE;
            c.moveTo(x, y);
            c.lineTo(x, y + 43);
          }
          c.stroke();
        }
        c.fillStyle = light;
        for (let row = 0; row < 3; row++) c.fillRect(0, row * 43 + 1.5, TILE, 1);
        break;
      case "wood":
        c.strokeStyle = dark;
        for (let i = 0; i < 9; i++) {
          const x = i * 14.2 + r() * 5;
          c.lineWidth = 1 + r() * 2.4;
          c.beginPath();
          c.moveTo(x, 0);
          c.bezierCurveTo(x + 5, 42, x - 5, 86, x, TILE);
          c.stroke();
        }
        speckle(50, light, 2);
        break;
      case "sand":
        speckle(170, dark, 2);
        speckle(120, light, 2);
        c.strokeStyle = shade(theme.base, -0.14);
        c.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const y = 14 + i * 32;
          c.beginPath();
          c.moveTo(0, y);
          c.quadraticCurveTo(TILE / 2, y + 8, TILE, y);
          c.stroke();
        }
        break;
      case "basalt":
        speckle(90, dark, 3);
        c.strokeStyle = "rgba(255,110,30,.65)";
        c.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          let x = r() * TILE;
          let y = r() * TILE;
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 5; k++) {
            x += (r() - 0.5) * 28;
            y += r() * 18;
            c.lineTo(x, y);
          }
          c.stroke();
        }
        break;
      case "ice":
        c.fillStyle = theme.dark;
        for (let i = 0; i < 7; i++) {
          c.beginPath();
          const x = r() * TILE;
          const y = r() * TILE;
          c.moveTo(x, y);
          c.lineTo(x + 18 + r() * 24, y + 8);
          c.lineTo(x + 8, y + 30);
          c.closePath();
          c.globalAlpha = 0.35;
          c.fill();
        }
        c.globalAlpha = 0.65;
        c.strokeStyle = "#f2fbff";
        c.lineWidth = 1;
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.moveTo(r() * TILE, r() * TILE);
          c.lineTo(r() * TILE, r() * TILE);
          c.stroke();
        }
        c.globalAlpha = 1;
        break;
      case "grate":
        c.strokeStyle = dark;
        c.lineWidth = 3;
        for (let i = 0; i <= 8; i++) {
          c.beginPath();
          c.moveTo(i * 16, 0);
          c.lineTo(i * 16, TILE);
          c.moveTo(0, i * 16);
          c.lineTo(TILE, i * 16);
          c.stroke();
        }
        c.fillStyle = "rgba(255,58,176,.25)";
        c.fillRect(0, 62, TILE, 3);
        break;
      case "bunker":
        speckle(60, dark, 3);
        c.strokeStyle = dark;
        c.lineWidth = 3;
        c.strokeRect(1.5, 1.5, TILE - 3, TILE - 3);
        c.fillStyle = "#23261f";
        for (const [x, y] of [[9, 9], [TILE - 9, 9], [9, TILE - 9], [TILE - 9, TILE - 9]]) {
          c.beginPath();
          c.arc(x, y, 3, 0, TAU);
          c.fill();
        }
        break;
      case "panel":
        c.strokeStyle = dark;
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          c.strokeRect(i * 42.6 + 1, 1, 42, TILE / 2 - 2);
          c.strokeRect(i * 64, TILE / 2 + 1, 64, TILE / 2 - 2);
        }
        c.fillStyle = "#3ad0ff";
        c.fillRect(14, 28, 16, 2);
        c.fillStyle = "#ffb648";
        c.fillRect(84, 96, 10, 2);
        speckle(16, light, 2);
        break;
      default: // obsidian
        speckle(40, dark, 3);
        c.strokeStyle = theme.capEdge;
        c.globalAlpha = 0.25;
        c.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          let x = r() * TILE;
          let y = r() * TILE;
          c.beginPath();
          c.moveTo(x, y);
          for (let k = 0; k < 4; k++) {
            x += (r() - 0.5) * 36;
            y += (r() - 0.5) * 36;
            c.lineTo(x, y);
          }
          c.stroke();
        }
        c.globalAlpha = 1;
    }
    return canvas;
  }

  class LevelRenderer {
    constructor(level) {
      this.level = level;
      this.theme = level.theme;
      this.tile = buildTile(this.theme, level.seed);
    }

    pattern(ctx) {
      if (!this.bodyPattern) {
        this.bodyPattern = ctx.createPattern(this.tile, "repeat");
        this.bodyPattern.setTransform(new DOMMatrix().scale(0.5));
      }
      return this.bodyPattern;
    }

    drawBack(ctx, cam, t) {
      const { level } = this;
      const vx0 = cam.x - 60;
      const vx1 = cam.x + J.VIEW_W + 60;
      const vy0 = cam.y - 60;
      const vy1 = cam.y + J.VIEW_H + 60;
      const visible = (s) => s.x < vx1 && s.x + s.w > vx0 && s.y < vy1 && s.y + s.h > vy0;

      for (const pit of level.pits) if (pit.x < vx1 && pit.x + pit.w > vx0) this.drawPit(ctx, pit, t);
      for (const room of level.rooms) if (visible(room)) this.drawRoom(ctx, room);
      for (const s of level.solids) {
        if (!visible(s)) continue;
        if (s.kind === "ground" || s.kind === "wall") this.drawGround(ctx, s, vy1);
      }
      for (const s of level.solids) {
        if (!visible(s) || !s.active) continue;
        if (s.kind === "float" || s.kind === "mover") this.drawFloat(ctx, s, t);
        else if (s.kind === "crumble") this.drawCrumble(ctx, s);
        else if (s.kind === "bridge") this.drawFloat(ctx, s, t);
        else if (s.kind === "crate") this.drawCrate(ctx, s);
      }
      for (const b of level.breakables) if (!b.broken && visible(b)) this.drawCracked(ctx, b);
      for (const d of level.doors) if (visible(d)) this.drawDoor(ctx, d, t);
      for (const b of level.barriers) if (b.active && visible(b)) this.drawBarrier(ctx, b, t);
      for (const s of level.switches) if (visible(s)) this.drawSwitch(ctx, s, t);
      for (const c of level.checkpoints) if (visible(c)) this.drawCheckpoint(ctx, c, t);
      if (level.exit && visible(level.exit)) this.drawExit(ctx, level.exit, t);
      for (const p of level.pickups) if (!p.taken && visible(p)) this.drawPickup(ctx, p, t);
      for (const h of level.hazards) if (visible(h.bounds)) this.drawHazard(ctx, h, t);
    }

    drawFront(ctx, cam) {
      for (const cover of this.level.covers) {
        if (cover.alpha <= 0) continue;
        if (cover.x > cam.x + J.VIEW_W || cover.x + cover.w < cam.x) continue;
        ctx.globalAlpha = cover.alpha;
        ctx.fillStyle = this.pattern(ctx);
        ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
        ctx.fillStyle = "rgba(0,0,0,.18)";
        ctx.fillRect(cover.x, cover.y, cover.w, cover.h);
        ctx.globalAlpha = 1;
      }
    }

    drawGround(ctx, s, viewBottom) {
      const { theme } = this;
      const h = Math.min(s.h, viewBottom - s.y + 10);
      ctx.fillStyle = this.pattern(ctx);
      ctx.fillRect(s.x, s.y, s.w, h);
      const shadow = ctx.createLinearGradient(0, s.y, 0, s.y + 200);
      shadow.addColorStop(0, "rgba(0,0,0,0)");
      shadow.addColorStop(1, "rgba(0,0,0,.72)");
      ctx.fillStyle = shadow;
      ctx.fillRect(s.x, s.y, s.w, h);
      ctx.fillStyle = "rgba(0,0,0,.28)";
      ctx.fillRect(s.x, s.y + 3, 3, h);
      ctx.fillRect(s.x + s.w - 3, s.y + 3, 3, h);
      if (s.kind === "ground") {
        ctx.fillStyle = theme.cap;
        ctx.fillRect(s.x, s.y, s.w, 7);
        ctx.fillStyle = theme.capEdge;
        ctx.fillRect(s.x, s.y + 7, s.w, 2.5);
        if (theme.style === "wood") this.drawMoss(ctx, s);
      }
    }

    drawMoss(ctx, s) {
      ctx.fillStyle = this.theme.cap;
      for (let x = s.x + 8; x < s.x + s.w - 8; x += 34) {
        const w = 12 + ((x * 7) % 18);
        ctx.beginPath();
        ctx.moveTo(x, s.y + 9);
        ctx.quadraticCurveTo(x + w / 2, s.y + 18 + (x % 6), x + w, s.y + 9);
        ctx.fill();
      }
    }

    drawRoom(ctx, room) {
      ctx.fillStyle = "rgba(4,4,10,.78)";
      ctx.fillRect(room.x, room.y, room.w, room.h);
    }

    drawFloat(ctx, s, t) {
      const { theme } = this;
      ctx.fillStyle = shade(theme.dark, -0.2);
      roundRect(ctx, s.x, s.y + 2, s.w, s.h, 4);
      ctx.fill();
      ctx.fillStyle = this.pattern(ctx);
      roundRect(ctx, s.x + 1, s.y, s.w - 2, s.h - 2, 4);
      ctx.fill();
      ctx.fillStyle = theme.cap;
      ctx.fillRect(s.x + 1, s.y, s.w - 2, 5);
      if (s.kind === "mover") {
        ctx.fillStyle = theme.accent;
        const pulse = 0.5 + Math.sin(t * 5) * 0.5;
        ctx.globalAlpha = 0.45 + pulse * 0.5;
        ctx.fillRect(s.x + 8, s.y + s.h - 5, s.w - 16, 2.5);
        ctx.globalAlpha = 1;
      }
    }

    drawCrumble(ctx, s) {
      const shakeX = s.shake > 0 ? rand(-2, 2) : 0;
      const x = s.x + shakeX;
      ctx.fillStyle = this.pattern(ctx);
      ctx.fillRect(x, s.y, s.w, s.h);
      ctx.fillStyle = this.theme.cap;
      ctx.fillRect(x, s.y, s.w, 4);
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + s.w * 0.3, s.y);
      ctx.lineTo(x + s.w * 0.4, s.y + s.h * 0.6);
      ctx.lineTo(x + s.w * 0.55, s.y + s.h);
      ctx.moveTo(x + s.w * 0.72, s.y);
      ctx.lineTo(x + s.w * 0.64, s.y + s.h * 0.7);
      ctx.stroke();
    }

    drawCrate(ctx, s) {
      const { theme } = this;
      ctx.fillStyle = shade(theme.base, -0.25);
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.lineWidth = 2;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 7, s.y + 7, s.w - 14, s.h - 14);
      ctx.beginPath();
      ctx.moveTo(s.x + 7, s.y + 7);
      ctx.lineTo(s.x + s.w - 7, s.y + s.h - 7);
      ctx.stroke();
    }

    drawCracked(ctx, b) {
      ctx.fillStyle = this.pattern(ctx);
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = "rgba(0,0,0,.2)";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = this.theme.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const cx = b.x + b.w / 2;
      for (const [dx, dy] of [[-b.w * 0.45, -22], [b.w * 0.42, -12], [-b.w * 0.38, 16], [b.w * 0.45, 26], [0, -b.h * 0.46], [2, b.h * 0.46]]) {
        ctx.moveTo(cx, b.y + b.h / 2);
        ctx.lineTo(cx + dx, b.y + b.h / 2 + dy);
      }
      ctx.stroke();
    }

    drawDoor(ctx, d, t) {
      const h = d.fullH * (1 - d.progress);
      if (h <= 1) return;
      const { theme } = this;
      ctx.fillStyle = shade(theme.base, -0.3);
      ctx.fillRect(d.x, d.y, d.w, h);
      ctx.strokeStyle = "rgba(0,0,0,.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, h - 2);
      ctx.fillStyle = theme.accent;
      for (let y = d.y + 22; y < d.y + h - 8; y += 46) ctx.fillRect(d.x + 6, y, d.w - 12, 3);
      ctx.fillStyle = Math.sin(t * 4) > 0 ? "#ff5a4a" : "#a02a20";
      ctx.fillRect(d.x + d.w / 2 - 4, d.y + h - 16, 8, 8);
    }

    drawBarrier(ctx, b, t) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = this.theme.laser;
      ctx.globalAlpha = 0.2 + Math.sin(t * 8) * 0.06;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 0.85;
      for (let y = b.y + ((t * 60) % 26); y < b.y + b.h; y += 26) ctx.fillRect(b.x, y, b.w, 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawSwitch(ctx, s, t) {
      const { theme } = this;
      ctx.fillStyle = "#23262d";
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.lineWidth = 2;
      roundRect(ctx, s.x, s.y, s.w, s.h, 4);
      ctx.fill();
      ctx.stroke();
      const on = s.on;
      ctx.fillStyle = on ? "#6ef2a4" : theme.accent;
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + 15, 7, 0, TAU);
      ctx.fill();
      if (!on) {
        ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.2;
        ctx.strokeStyle = theme.accent;
        ctx.beginPath();
        ctx.arc(s.x + s.w / 2, s.y + 15, 13 + Math.sin(t * 5) * 3, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(s.x + s.w / 2, s.y + s.h - 12);
      ctx.rotate(on ? 0.5 : -0.5);
      ctx.fillStyle = "#9aa6b2";
      ctx.fillRect(-2, -13, 4, 13);
      ctx.restore();
    }

    drawCheckpoint(ctx, c, t) {
      const on = c.reached;
      const color = on ? "#6ef2a4" : "#7cc8ff";
      const x = c.x + c.w / 2;
      const base = c.y + c.h;
      ctx.fillStyle = "#3a3f49";
      ctx.fillRect(x - 3, base - 62, 6, 62);
      ctx.fillRect(x - 14, base - 6, 28, 6);
      ctx.save();
      ctx.translate(x, base - 74);
      ctx.rotate(t * (on ? 1.2 : 0.5));
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, base - 74, 22 + Math.sin(t * 3) * 3, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawExit(ctx, e, t) {
      const color = e.open ? this.theme.accent : "#555";
      ctx.fillStyle = "#23262d";
      ctx.fillRect(e.x - 10, e.y, 14, e.h);
      ctx.fillRect(e.x + e.w - 4, e.y, 14, e.h);
      ctx.fillRect(e.x - 10, e.y - 14, e.w + 20, 16);
      if (!e.open) return;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(e.x, 0, e.x + e.w, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.15;
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawPickup(ctx, p, t) {
      const bob = Math.sin(t * 3 + p.x * 0.01) * 4;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2 + bob;
      ctx.globalCompositeOperation = "lighter";
      const glow = { crystal: "#58c8ff", holocron: "#ffcf6a", bacta: "#6ef2a4", force: "#b45cff" }[p.kind];
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.24;
      ctx.beginPath();
      ctx.arc(cx, cy, p.kind === "holocron" ? 24 : 15, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.save();
      ctx.translate(cx, cy);
      if (p.kind === "crystal") {
        ctx.fillStyle = "#a6e6ff";
        ctx.strokeStyle = "#1c5a86";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(5.5, -2);
        ctx.lineTo(3, 8);
        ctx.lineTo(-3, 8);
        ctx.lineTo(-5.5, -2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.fillRect(-1.5, -5, 2, 6);
      } else if (p.kind === "holocron") {
        ctx.rotate(t * 0.8);
        ctx.fillStyle = "#c98a2a";
        ctx.strokeStyle = "#ffe08a";
        ctx.lineWidth = 2;
        ctx.fillRect(-11, -11, 22, 22);
        ctx.strokeRect(-11, -11, 22, 22);
        ctx.fillStyle = "#fff4c8";
        ctx.fillRect(-3.5, -3.5, 7, 7);
        ctx.strokeRect(-7, -7, 14, 14);
      } else if (p.kind === "bacta") {
        ctx.fillStyle = "#14352a";
        roundRect(ctx, -8, -11, 16, 22, 3);
        ctx.fill();
        ctx.fillStyle = "#6ef2a4";
        ctx.fillRect(-2, -7, 4, 14);
        ctx.fillRect(-6, -2, 12, 4);
      } else {
        ctx.fillStyle = "#2a1450";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#c79aff";
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawPit(ctx, pit, t) {
      const { theme } = this;
      const y = pit.y - 22;
      const bottom = pit.y + 300;
      const color = theme.pitColor;
      if (theme.pit === "lava") {
        const g = ctx.createLinearGradient(0, y, 0, bottom);
        g.addColorStop(0, "#ffd070");
        g.addColorStop(0.08, "#ff7a1e");
        g.addColorStop(1, "#7a1604");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(pit.x, bottom);
        ctx.lineTo(pit.x, y);
        for (let x = pit.x; x <= pit.x + pit.w; x += 18) ctx.lineTo(x, y + Math.sin(x * 0.04 + t * 3) * 3);
        ctx.lineTo(pit.x + pit.w, bottom);
        ctx.closePath();
        ctx.fill();
        return;
      }
      if (theme.pit === "sand" || theme.pit === "bog") {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(pit.x, bottom);
        ctx.lineTo(pit.x, y);
        for (let x = pit.x; x <= pit.x + pit.w; x += 22) ctx.lineTo(x, y + Math.sin(x * 0.03 + t * 1.4) * 2.5);
        ctx.lineTo(pit.x + pit.w, bottom);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.fillRect(pit.x, y + 4, pit.w, 3);
        return;
      }
      // Bottomless drops fade into haze instead of ending in a surface.
      const g = ctx.createLinearGradient(0, pit.y - 170, 0, pit.y + 30);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.fillRect(pit.x, pit.y - 170, pit.w, 200);
      ctx.fillStyle = color;
      ctx.fillRect(pit.x, pit.y + 30, pit.w, 300);
    }

    drawHazard(ctx, h, t) {
      const { theme } = this;
      const color = theme.laser;
      switch (h.type) {
        case "laser": {
          ctx.fillStyle = "#23262d";
          ctx.fillRect(h.x - 8, h.top - 10, 16, 12);
          ctx.fillRect(h.x - 8, h.y - 6, 16, 6);
          if (h.on) {
            Art.glowLine(ctx, [[h.x, h.top], [h.x, h.y - 4]], color, 3.2);
          } else if (h.warn) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = color;
            ctx.fillRect(h.x - 0.75, h.top, 1.5, h.y - h.top);
            ctx.globalAlpha = 1;
          }
          break;
        }
        case "arc": {
          ctx.fillStyle = "#23262d";
          ctx.fillRect(h.x - 5, h.y - h.height - 10, 10, h.height + 10);
          ctx.fillRect(h.x + h.w - 5, h.y - h.height - 10, 10, h.height + 10);
          if (h.on) Art.lightning(ctx, h.x, h.y - h.height, h.x + h.w, h.y - h.height, color, 2.2, 7);
          else if (h.warn) {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = color;
            ctx.fillRect(h.x, h.y - h.height, h.w, 1.5);
            ctx.globalAlpha = 1;
          }
          break;
        }
        case "vent": {
          ctx.fillStyle = "#23262d";
          ctx.fillRect(h.x - h.w / 2 - 6, h.y - 8, h.w + 12, 8);
          ctx.fillStyle = theme.dark;
          ctx.fillRect(h.x - h.w / 2, h.y - 5, h.w, 3);
          if (h.on) {
            const top = h.y - h.height;
            const g = ctx.createLinearGradient(0, top, 0, h.y);
            g.addColorStop(0, "rgba(255,255,255,0)");
            g.addColorStop(0.3, h.jet);
            g.addColorStop(1, "#fff");
            ctx.fillStyle = g;
            const sway = Math.sin(t * 22) * 3;
            ctx.beginPath();
            ctx.moveTo(h.x - h.w / 2, h.y - 6);
            ctx.lineTo(h.x - h.w / 2 - 3 + sway, top);
            ctx.lineTo(h.x + h.w / 2 + 3 - sway, top);
            ctx.lineTo(h.x + h.w / 2, h.y - 6);
            ctx.closePath();
            ctx.fill();
          } else if (h.warn) {
            ctx.fillStyle = h.jet;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(h.x - h.w / 2, h.y - 14, h.w, 8);
            ctx.globalAlpha = 1;
          }
          break;
        }
        case "crusher": {
          const bottom = h.top + h.drop;
          ctx.fillStyle = "#3a3e46";
          ctx.fillRect(h.x + h.w / 2 - 7, h.anchor, 14, bottom - 30 - h.anchor);
          ctx.fillStyle = shade(theme.base, -0.34);
          ctx.fillRect(h.x, bottom - 34, h.w, 34);
          ctx.fillStyle = "#ffd23a";
          for (let x = h.x + 4; x < h.x + h.w - 8; x += 16) ctx.fillRect(x, bottom - 7, 8, 7);
          break;
        }
        case "spike": {
          ctx.fillStyle = theme.style === "ice" ? "#e8f6ff" : theme.style === "wood" ? "#3a5a2a" : "#70757e";
          ctx.strokeStyle = "rgba(0,0,0,.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const n = Math.max(2, Math.floor(h.w / 16));
          for (let i = 0; i < n; i++) {
            const a = h.x + (i * h.w) / n;
            ctx.moveTo(a, h.y);
            ctx.lineTo(a + h.w / n / 2, h.y - h.height);
            ctx.lineTo(a + h.w / n, h.y);
          }
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "faller": {
          if (h.gone) break;
          ctx.fillStyle = theme.style === "ice" ? "#d6f0ff" : theme.dark;
          ctx.strokeStyle = "rgba(0,0,0,.5)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(h.x - h.w / 2, h.cy);
          ctx.lineTo(h.x + h.w / 2, h.cy);
          ctx.lineTo(h.x + rand(-0.4, 0.4), h.cy + h.height);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        default:
      }
    }
  }

  J.THEMES = THEMES;
  J.LevelRenderer = LevelRenderer;
})(window.JEDI);
