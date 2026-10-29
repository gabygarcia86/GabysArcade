// Parallax city: sky (sunset, day or night, see themes.js), sun or moon,
// clouds, a far skyline, mid-rise buildings and street-level shopfronts. Buildings are pre-rendered into a
// small set of cached offscreen canvases and laid out in shuffled blocks, so
// the scenery is endless but cheap to draw and never repeats side by side.

import { hash } from '../rng.js';
import { THEMES } from './themes.js';

const TAU = Math.PI * 2;
const MID_COLORS = ['#6c5ce7', '#4b7bec', '#e8566c', '#f39c4a', '#2bb3a3', '#d65db1', '#5b5fa8', '#3fa4d8'];
const SHOP_COLORS = ['#ff7f50', '#ffd23f', '#4dd4ac', '#7b8cff', '#ff6fae', '#b57bff', '#5ad1ff'];
const SIGNS = ['DOCKING BAY 97', 'NEKO-DO DOJO', 'PIZZA PLANET', 'SKATE SHOP', 'FLYNN\'S ARCADE', 'FLIPPER\'S ARCADE', 'CITY SUSHI', 'BLOCKBUSTER', 'AA UNIFORM', 'DANDEE DONUTS', 'CULVER\'S', 'BENNIGAN\'S', 'TCBY YOGURT', 'NABGAB87 STUDIO', 'KID STRONG', 'VICKY BAKERY', 'TATE\'S COMICS'];
const MID_VARIANTS = 10;
const SHOP_VARIANTS = SIGNS.length; // one shopfront per sign
const FONT = '"Arial Black", "Segoe UI Black", Impact, sans-serif';

export class Background {
  constructor() {
    this.cache = new Map();
    this.orders = new Map(); // shuffled slot blocks, see slotVariant()
    this.px = 1;
    this.sky = null;
    this.skyKey = '';
    this.theme = THEMES.sunset;
  }

  // Building sprites bake in the theme's colors, so a new theme repaints them.
  setTheme(theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    this.cache.clear();
    this.sky = null;
  }

  // Called on resize: cached sprites are rendered at the current resolution.
  invalidate(pxPerUnit) {
    this.cache.clear();
    this.px = Math.min(pxPerUnit, 1.6);
    this.sky = null;
  }

  draw(ctx, camX, camY, viewW, viewH, groundY, time) {
    const horizon = groundY - 34;
    this.drawSky(ctx, viewW, viewH, groundY);
    if (this.theme.stars) this.drawStars(ctx, camX, viewW, horizon, time);
    if (this.theme.body === 'retroSun') this.drawSun(ctx, viewW, horizon, camY);
    else if (this.theme.body === 'sun') this.drawDaySun(ctx, viewW, horizon, camY);
    else this.drawMoon(ctx, viewW, horizon, camY);
    this.drawClouds(ctx, camX, viewW, horizon, camY, time);
    this.drawFar(ctx, camX * 0.12, viewW, horizon + camY * 0.12);
    this.drawLayer(ctx, 'mid', camX * 0.35, viewW, horizon + camY * 0.35, 200, MID_VARIANTS);
    this.drawLayer(ctx, 'shop', camX * 0.7, viewW, horizon + camY * 0.7, 270, SHOP_VARIANTS);
  }

  drawSky(ctx, viewW, viewH, groundY) {
    const key = `${viewW}|${viewH}|${groundY}`;
    if (!this.sky || this.skyKey !== key) {
      const g = ctx.createLinearGradient(0, 0, 0, groundY);
      for (const [at, color] of this.theme.sky) g.addColorStop(at, color);
      this.sky = g;
      this.skyKey = key;
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  drawSun(ctx, viewW, horizon, camY) {
    const x = viewW * 0.7;
    const r = 86;
    const y = horizon - 150 + camY * 0.05;
    const g = ctx.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, '#fff3a3');
    g.addColorStop(1, '#ff5f8f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // retro stripes cut through the lower half
    ctx.fillStyle = '#ff7f9c';
    for (let i = 0; i < 5; i++) {
      const sy = y + 12 + i * 15;
      ctx.fillRect(x - r, sy, r * 2, 2 + i * 1.3);
    }
  }

  drawDaySun(ctx, viewW, horizon, camY) {
    const x = viewW * 0.74;
    const y = horizon - 270 + camY * 0.05;
    const halo = ctx.createRadialGradient(x, y, 30, x, y, 120);
    halo.addColorStop(0, 'rgba(255,248,200,0.6)');
    halo.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 120, y - 120, 240, 240);
    const g = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, 44);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(1, '#ffd23f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 44, 0, TAU);
    ctx.fill();
  }

  drawMoon(ctx, viewW, horizon, camY) {
    const x = viewW * 0.74;
    const y = horizon - 260 + camY * 0.05;
    const r = 38;
    const halo = ctx.createRadialGradient(x, y, r, x, y, r * 3);
    halo.addColorStop(0, 'rgba(200,215,255,0.28)');
    halo.addColorStop(1, 'rgba(200,215,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    ctx.fillStyle = '#f2efdc';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(170,165,150,0.45)';
    for (const [cx, cy, cr] of [[-12, -8, 8], [10, 6, 10], [-6, 16, 5], [16, -16, 5]]) {
      ctx.beginPath();
      ctx.arc(x + cx, y + cy, cr, 0, TAU);
      ctx.fill();
    }
  }

  // Twinkling stars, nearly fixed to the screen with a hint of parallax.
  drawStars(ctx, camX, viewW, horizon, time) {
    const off = camX * 0.02;
    const slot = 40;
    ctx.fillStyle = '#fff';
    for (let i = Math.floor(off / slot) - 1; i <= Math.floor((off + viewW) / slot) + 1; i++) {
      if (hash(i, 41) < 0.35) continue;
      const x = i * slot - off + hash(i, 42) * slot;
      const y = hash(i, 43) * (horizon - 120);
      const s = 1 + hash(i, 44) * 1.6;
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(time * (0.8 + hash(i, 45) * 1.5) + i));
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawClouds(ctx, camX, viewW, horizon, camY, time) {
    const off = camX * 0.05 + time * 8;
    const slot = 320;
    ctx.fillStyle = this.theme.cloud;
    for (let i = Math.floor(off / slot) - 1; i <= Math.floor((off + viewW) / slot) + 1; i++) {
      if (hash(i, 3) < 0.35) continue;
      const x = i * slot - off + hash(i, 4) * 120;
      const y = horizon - 230 - hash(i, 5) * 120 + camY * 0.06;
      const s = 0.7 + hash(i, 6) * 0.6;
      ctx.beginPath();
      ctx.ellipse(x, y, 46 * s, 14 * s, 0, 0, TAU);
      ctx.ellipse(x + 26 * s, y - 10 * s, 28 * s, 16 * s, 0, 0, TAU);
      ctx.ellipse(x - 22 * s, y - 6 * s, 22 * s, 12 * s, 0, 0, TAU);
      ctx.fill();
    }
  }

  // Silhouette skyline with the occasional pagoda.
  drawFar(ctx, off, viewW, base) {
    const slot = 70;
    ctx.fillStyle = this.theme.far;
    for (let i = Math.floor(off / slot) - 1; i <= Math.floor((off + viewW) / slot) + 1; i++) {
      const x = i * slot - off;
      const r = hash(i, 9);
      if (r > 0.92) {
        // pagoda
        const h = 150;
        for (let tier = 0; tier < 4; tier++) {
          const ty = base - (tier + 1) * (h / 4);
          const tw = 60 - tier * 11;
          ctx.fillRect(x + 35 - tw * 0.3, ty, tw * 0.6, h / 4);
          ctx.beginPath();
          ctx.moveTo(x + 35 - tw / 2 - 8, ty + 6);
          ctx.quadraticCurveTo(x + 35, ty - 10, x + 35 + tw / 2 + 8, ty + 6);
          ctx.fill();
        }
        ctx.fillRect(x + 34, base - h - 22, 2, 22);
        continue;
      }
      const h = 70 + r * 170;
      const w = slot - 4 - hash(i, 10) * 18;
      ctx.fillRect(x, base - h, w, h);
      if (hash(i, 11) > 0.7) ctx.fillRect(x + w * 0.4, base - h - 24, 3, 24);
    }
    if (this.theme.farLights) this.drawFarLights(ctx, off, viewW, base);
  }

  // Scattered lit windows on the far skyline at night (same layout as drawFar).
  drawFarLights(ctx, off, viewW, base) {
    const slot = 70;
    ctx.fillStyle = 'rgba(255,214,120,0.75)';
    for (let i = Math.floor(off / slot) - 1; i <= Math.floor((off + viewW) / slot) + 1; i++) {
      const r = hash(i, 9);
      if (r > 0.92) continue; // pagodas stay dark
      const x = i * slot - off;
      const h = 70 + r * 170;
      const w = slot - 4 - hash(i, 10) * 18;
      for (let row = 0, wy = base - h + 10; wy < base - 12; row++, wy += 16) {
        for (let col = 0, wx = x + 6; wx < x + w - 6; col++, wx += 12) {
          if (hash(i * 131 + row * 11 + col, 47) > 0.82) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }

  drawLayer(ctx, layer, off, viewW, base, slot, variants) {
    for (let i = Math.floor(off / slot) - 1; i <= Math.floor((off + viewW) / slot) + 1; i++) {
      const v = this.variant(layer, this.slotVariant(layer, i, variants));
      const x = i * slot - off + (slot - v.w) * 0.5;
      ctx.drawImage(v.canvas, x, base - v.h, v.w, v.h);
    }
  }

  // Slots come in blocks of `variants`, each holding every variant once in a
  // shuffled order. If a block would start with the previous block's last
  // variant, its first two swap, so neighbours always differ.
  slotVariant(layer, i, variants) {
    const block = Math.floor(i / variants);
    const key = layer + block;
    let order = this.orders.get(key);
    if (!order) {
      const salt = layer === 'mid' ? 21 : 37;
      order = shuffledOrder(variants, block, salt);
      const prevLast = shuffledOrder(variants, block - 1, salt)[variants - 1];
      if (order[0] === prevLast) [order[0], order[1]] = [order[1], order[0]];
      if (this.orders.size > 16) this.orders.clear();
      this.orders.set(key, order);
    }
    return order[i - block * variants];
  }

  variant(layer, idx) {
    const key = layer + idx;
    let v = this.cache.get(key);
    if (v) return v;
    const r = (n) => hash(idx * 31 + n, layer === 'mid' ? 11 : 23);
    const w = layer === 'mid' ? 140 + r(1) * 52 : 230 + r(1) * 36;
    const h = layer === 'mid' ? 170 + r(2) * 170 : 112 + r(2) * 40;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(w * this.px));
    canvas.height = Math.max(1, Math.ceil(h * this.px));
    const g = canvas.getContext('2d');
    g.scale(this.px, this.px);
    if (layer === 'mid') paintTower(g, w, h, r, idx, this.theme);
    else paintShop(g, w, h, r, idx, this.theme);
    v = { canvas, w, h };
    this.cache.set(key, v);
    return v;
  }
}

// Fisher-Yates shuffle of 0..n-1, deterministic per block.
function shuffledOrder(n, block, salt) {
  const order = Array.from({ length: n }, (_, k) => k);
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(hash(block * 97 + k, salt) * (k + 1));
    [order[k], order[j]] = [order[j], order[k]];
  }
  return order;
}

// Wash the sprite drawn so far in the theme's tint (night darkens, day lifts).
function applyTint(g, w, h, theme) {
  if (!theme.tint) return;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = theme.tint;
  g.fillRect(0, 0, w, h);
  g.restore();
}

function paintTower(g, w, h, r, idx, theme) {
  const color = MID_COLORS[Math.floor(r(3) * MID_COLORS.length)];
  const roof = 18;
  g.fillStyle = color;
  g.fillRect(0, roof, w, h - roof);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(w * 0.78, roof, w * 0.22, h - roof);
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.fillRect(0, roof, w, 6);
  // rooftop: water tower or AC units
  g.fillStyle = 'rgba(30,20,60,0.85)';
  if (r(4) > 0.5) {
    g.fillRect(w * 0.2, roof - 16, 26, 16);
    g.fillRect(w * 0.2 + 4, roof - 22, 18, 6);
  } else {
    g.fillRect(w * 0.55, roof - 10, 20, 10);
    g.fillRect(w * 0.3, roof - 7, 14, 7);
  }
  applyTint(g, w, h, theme);
  // windows (after the tint so lit ones glow at night)
  const cols = Math.floor((w - 16) / 22);
  const rows = Math.floor((h - roof - 20) / 26);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const lit = hash(row * 17 + col * 3 + Math.floor(r(5) * 1000), 2) > 1 - theme.litChance;
      g.fillStyle = lit ? theme.litWindow : theme.darkWindow;
      g.fillRect(12 + col * 22, roof + 14 + row * 26, 12, 15);
    }
  }
  // vertical neon sign on some towers
  if (r(6) > 0.6) {
    const word = SIGNS[idx % SIGNS.length].slice(0, 4); // distinct per tower variant
    g.fillStyle = '#1a1033';
    g.fillRect(w - 26, roof + 20, 20, word.length * 18 + 10);
    g.font = `900 14px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = r(8) > 0.5 ? '#3de1ff' : '#ff3d7f';
    for (let i = 0; i < word.length; i++) g.fillText(word[i], w - 16, roof + 34 + i * 18);
  }
}

function paintShop(g, w, h, r, idx, theme) {
  const color = SHOP_COLORS[Math.floor(r(3) * SHOP_COLORS.length)];
  const accent = SHOP_COLORS[(Math.floor(r(3) * SHOP_COLORS.length) + 3) % SHOP_COLORS.length];
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, h - 10, w, 10);
  g.fillStyle = 'rgba(255,255,255,0.2)';
  g.fillRect(0, 0, w, 5);

  // striped awning
  const ay = 44;
  for (let x = 6, i = 0; x < w - 6; x += 18, i++) {
    g.fillStyle = i % 2 === 0 ? '#fff6ee' : accent;
    g.beginPath();
    g.moveTo(x, ay);
    g.lineTo(x + 18, ay);
    g.lineTo(x + 18, ay + 14);
    g.quadraticCurveTo(x + 9, ay + 20, x, ay + 14);
    g.closePath();
    g.fill();
  }

  applyTint(g, w, h, theme);

  // big window with reflections + door (after the tint so shops glow at night)
  const wy = ay + 24;
  const wh = h - wy - 12;
  g.fillStyle = theme.shopWindow;
  g.fillRect(14, wy, w * 0.58, wh);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.moveTo(24, wy + wh);
  g.lineTo(44, wy);
  g.lineTo(56, wy);
  g.lineTo(36, wy + wh);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(40,20,80,0.35)';
  g.fillRect(14, wy + wh - 6, w * 0.58, 6);
  g.fillStyle = '#3b2a5a';
  g.fillRect(w * 0.7, wy - 4, w * 0.2, wh + 4);
  g.fillStyle = '#ffd23f';
  g.fillRect(w * 0.7 + 5, wy + wh / 2, 4, 4);
  g.strokeStyle = '#1a1033';
  g.lineWidth = 3;
  g.strokeRect(14, wy, w * 0.58, wh);

  // sign board (also after the tint, so it stays bright like neon)
  const word = SIGNS[idx];
  g.fillStyle = '#1a1033';
  g.fillRect(16, 10, w - 32, 28);
  g.strokeStyle = accent;
  g.lineWidth = 3;
  g.strokeRect(18, 12, w - 36, 24);
  g.font = `900 18px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = accent;
  g.fillText(word, w / 2, 25);
}
