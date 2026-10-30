/**
 * The look of each of the ten environments: tile textures (ground, track
 * surface, run-off), curbs, walls, scattered and roadside decorations,
 * parallax backdrops, overhead layers, weather and lighting.
 *
 * Decorations are painted once into sprites (DECOR painters below) and placed
 * procedurally by trackRenderer.js. Everything is drawn in code.
 *
 * Painter coordinates: the sprite is centered on (0, 0) with radius r. Light
 * comes from the top-left, so shadows fall to the bottom-right.
 */
import { TAU } from './utils.js';
import { blob, radial, linearG, speckle, wrapDraw, glow, roundRect, rngFor } from './gfx.js';
import { getSprites } from '../../galactic_squadron/js/sprites.js';

const SH = 'rgba(0,0,0,0.32)';

function shadowBlob(g, x, y, r, rng, a = 0.3) {
  g.fillStyle = `rgba(0,0,0,${a})`;
  blob(g, x + r * 0.14, y + r * 0.2, r, rng, 9, 0.25);
  g.fill();
}

function stripes(g, x, y, w, h, c1, c2, step) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = c1;
  g.fillRect(x, y, w, h);
  g.fillStyle = c2;
  for (let k = -h; k < w + h; k += step * 2) {
    g.beginPath();
    g.moveTo(x + k, y);
    g.lineTo(x + k + step, y);
    g.lineTo(x + k + step - h, y + h);
    g.lineTo(x + k - h, y + h);
    g.fill();
  }
  g.restore();
}

/* ================================================================ DECOR */

export const DECOR = {
  /* ---------------------------------------------------------- imperial */
  hangar: {
    layer: 'mid', pad: 1.25,
    paint(g, r, rng) {
      const w = r * 1.5;
      const h = r * 1.05;
      g.fillStyle = SH;
      g.fillRect(-w / 2 + 22, -h / 2 + 28, w, h);
      g.fillStyle = linearG(g, 0, -h / 2, 0, h / 2, [[0, '#4b525e'], [1, '#2b3039']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#161a20';
      g.lineWidth = 4;
      g.strokeRect(-w / 2, -h / 2, w, h);
      // roof ribs
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 3;
      for (let x = -w / 2 + 24; x < w / 2; x += 34) {
        g.beginPath();
        g.moveTo(x, -h / 2 + 6);
        g.lineTo(x, h / 2 - 6);
        g.stroke();
      }
      g.fillStyle = '#5d6572';
      g.fillRect(-w / 2 + 6, -6, w - 12, 12);
      // open hangar mouth, glowing inside
      g.fillStyle = '#0a0c10';
      g.fillRect(-w * 0.32, h / 2 - 22, w * 0.64, 26);
      g.fillStyle = 'rgba(255,90,70,0.5)';
      g.fillRect(-w * 0.3, h / 2 - 10, w * 0.6, 8);
      stripes(g, -w * 0.34, h / 2 - 4, w * 0.68, 8, '#e9b632', '#151515', 8);
    },
  },
  tower: {
    layer: 'mid', pad: 1.3,
    paint(g, r) {
      g.fillStyle = SH;
      g.beginPath();
      g.arc(r * 0.25, r * 0.3, r * 0.9, 0, TAU);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.3, r * 0.1, r, [[0, '#6c7584'], [1, '#272c35']]);
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = '#14171d';
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = '#3a414c';
      g.beginPath();
      g.arc(0, 0, r * 0.55, 0, TAU);
      g.fill();
      g.stroke();
    },
    anim(ctx, d, t) {
      // rotating turret with twin barrels and a red sensor
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(t * 0.35 + d.seed);
      ctx.fillStyle = '#525b68';
      ctx.fillRect(-d.r * 0.32, -d.r * 0.32, d.r * 0.64, d.r * 0.64);
      ctx.fillStyle = '#1e2229';
      ctx.fillRect(d.r * 0.25, -d.r * 0.2, d.r * 0.85, d.r * 0.12);
      ctx.fillRect(d.r * 0.25, d.r * 0.08, d.r * 0.85, d.r * 0.12);
      ctx.restore();
      glow(ctx, '#ff3a3a', d.x, d.y, d.r * 0.6, 0.6 + 0.4 * Math.sin(t * 4 + d.seed));
    },
  },
  pad: {
    layer: 'ground', pad: 1.05,
    paint(g, r) {
      g.fillStyle = '#232830';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.strokeStyle = '#e2b437';
      g.lineWidth = r * 0.06;
      g.beginPath();
      g.arc(0, 0, r * 0.8, 0, TAU);
      g.stroke();
      g.setLineDash([r * 0.15, r * 0.1]);
      g.strokeStyle = '#d0d6de';
      g.lineWidth = r * 0.03;
      g.beginPath();
      g.arc(0, 0, r * 0.55, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#d0d6de';
      g.fillRect(-r * 0.3, -r * 0.05, r * 0.6, r * 0.1);
      g.fillRect(-r * 0.05, -r * 0.3, r * 0.1, r * 0.6);
    },
    anim(ctx, d, t) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        const on = Math.floor(t * 2 + i) % 4 === 0;
        glow(ctx, '#ffd257', d.x + Math.cos(a) * d.r * 0.92, d.y + Math.sin(a) * d.r * 0.92, d.r * 0.25, on ? 1 : 0.3);
      }
    },
  },
  parked: {
    layer: 'mid', pad: 1.1,
    paint(g, r, rng) {
      g.fillStyle = '#20252c';
      roundRect(g, -r, -r, r * 2, r * 2, r * 0.2);
      g.fill();
      g.strokeStyle = '#e2b437';
      g.lineWidth = 3;
      g.strokeRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
      const sp = getSprites();
      const pick = [sp.interceptor, sp.heavy, sp.bomber][Math.floor(rng() * 3)];
      const k = (r * 1.25) / Math.max(pick.w, pick.h);
      g.save();
      g.rotate(rng() < 0.5 ? 0 : Math.PI);
      g.drawImage(pick.canvas, (-pick.w * k) / 2, (-pick.h * k) / 2, pick.w * k, pick.h * k);
      g.restore();
    },
  },
  crates: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      for (let i = 0; i < 5; i++) {
        const x = (rng() - 0.5) * r * 1.2;
        const y = (rng() - 0.5) * r * 1.2;
        const s = r * (0.3 + rng() * 0.2);
        g.fillStyle = SH;
        g.fillRect(x - s / 2 + 6, y - s / 2 + 8, s, s);
        g.fillStyle = ['#59606b', '#6b5a3d', '#3f4a59'][i % 3];
        g.fillRect(x - s / 2, y - s / 2, s, s);
        g.strokeStyle = '#15181d';
        g.lineWidth = 2;
        g.strokeRect(x - s / 2, y - s / 2, s, s);
        g.beginPath();
        g.moveTo(x - s / 2, y - s / 2);
        g.lineTo(x + s / 2, y + s / 2);
        g.stroke();
      }
    },
  },
  beacon: {
    layer: 'mid', pad: 1.5,
    paint(g, r) {
      g.fillStyle = SH;
      g.beginPath();
      g.arc(4, 6, r, 0, TAU);
      g.fill();
      g.fillStyle = '#2c313a';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.strokeStyle = '#11141a';
      g.lineWidth = 2;
      g.stroke();
    },
    anim(ctx, d, t) {
      const on = (Math.sin(t * 3 + d.seed * 0.7) + 1) / 2;
      glow(ctx, d.color || '#ff3a3a', d.x, d.y, d.r * 5, 0.3 + on * 0.7);
    },
  },

  /* ---------------------------------------------------------- desert */
  mesa: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      shadowBlob(g, 0, 0, r, rngFor(rng() * 1e9), 0.35);
      const rr = rngFor(rng() * 1e9);
      const layers = ['#8c4f2a', '#a8653a', '#c27f4a', '#d89b62'];
      layers.forEach((c, i) => {
        g.fillStyle = c;
        const k = 1 - i * 0.2;
        blob(g, -i * r * 0.04, -i * r * 0.05, r * k, rngFor(rr() * 1e9), 11, 0.28);
        g.fill();
      });
      g.strokeStyle = 'rgba(80,40,20,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        const a = rr() * TAU;
        g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
        g.lineTo(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75);
        g.stroke();
      }
    },
  },
  boulder: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      shadowBlob(g, 0, 0, r, rng, 0.35);
      g.fillStyle = radial(g, -r * 0.3, -r * 0.35, r * 0.1, r * 1.1, [[0, '#e0a470'], [0.6, '#a5683d'], [1, '#6a3d1f']]);
      blob(g, 0, 0, r, rng, 9, 0.35);
      g.fill();
      g.strokeStyle = 'rgba(60,30,10,0.5)';
      g.lineWidth = 2;
      g.stroke();
    },
  },
  dune: {
    layer: 'ground', pad: 1.1,
    paint(g, r, rng) {
      g.fillStyle = radial(g, -r * 0.2, -r * 0.25, r * 0.1, r, [[0, 'rgba(255,200,130,0.55)'], [0.6, 'rgba(230,150,80,0.3)'], [1, 'rgba(200,110,50,0)']]);
      blob(g, 0, 0, r, rng, 10, 0.3, 0.6);
      g.fill();
      g.strokeStyle = 'rgba(150,80,35,0.35)';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(r * 0.1, r * 0.12, r * 0.7, r * 0.22, -0.2, 0.2, Math.PI - 0.2);
      g.stroke();
    },
  },
  hut: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const d = i === 0 ? 0 : r * 0.55;
        const x = Math.cos(a) * d;
        const y = Math.sin(a) * d;
        const s = i === 0 ? r * 0.55 : r * (0.25 + rng() * 0.15);
        g.fillStyle = SH;
        g.beginPath();
        g.arc(x + s * 0.3, y + s * 0.35, s, 0, TAU);
        g.fill();
        g.fillStyle = radial(g, x - s * 0.35, y - s * 0.4, s * 0.1, s, [[0, '#f3dcb5'], [0.7, '#cfa77a'], [1, '#9b7650']]);
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
        g.strokeStyle = '#7d5c3c';
        g.lineWidth = 2;
        g.stroke();
        g.fillStyle = '#3a2a1c';
        g.beginPath();
        g.arc(x + s * 0.45, y + s * 0.45, s * 0.18, 0, TAU);
        g.fill();
      }
    },
  },
  vaporator: {
    layer: 'mid', pad: 2,
    paint(g, r) {
      g.fillStyle = SH;
      g.fillRect(0, -r * 0.1, r * 1.6, r * 0.25);
      g.fillStyle = radial(g, -r * 0.2, -r * 0.2, 1, r, [[0, '#e8e8e2'], [1, '#8b8d88']]);
      g.beginPath();
      g.arc(0, 0, r * 0.5, 0, TAU);
      g.fill();
      g.strokeStyle = '#55574f';
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.3, 0, TAU);
      g.stroke();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        g.fillStyle = '#a6a8a0';
        g.fillRect(Math.cos(a) * r * 0.5 - 2, Math.sin(a) * r * 0.5 - 2, 4 + Math.cos(a) * r * 0.4, 4 + Math.sin(a) * r * 0.4);
      }
    },
  },
  bones: {
    layer: 'ground', pad: 1.1,
    paint(g, r, rng) {
      g.strokeStyle = '#efe4cf';
      g.lineCap = 'round';
      g.lineWidth = r * 0.07;
      g.beginPath();
      g.moveTo(-r * 0.9, 0);
      g.lineTo(r * 0.7, 0);
      g.stroke();
      for (let i = 0; i < 7; i++) {
        const x = -r * 0.6 + i * r * 0.2;
        const curve = r * (0.4 + rng() * 0.15);
        g.lineWidth = r * 0.045;
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + r * 0.1, -curve, x + r * 0.2, -curve * 1.1);
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + r * 0.1, curve, x + r * 0.2, curve * 1.1);
        g.stroke();
      }
      g.fillStyle = '#e6dac2';
      g.beginPath();
      g.ellipse(r * 0.8, 0, r * 0.2, r * 0.14, 0, 0, TAU);
      g.fill();
    },
  },

  /* ---------------------------------------------------------- ice */
  lake: {
    layer: 'ground', pad: 1.05,
    paint(g, r, rng) {
      g.fillStyle = radial(g, -r * 0.3, -r * 0.3, r * 0.1, r, [[0, '#d8f2ff'], [0.5, '#9fd6f2'], [1, '#6cb4dd']]);
      blob(g, 0, 0, r, rng, 12, 0.3, 0.8);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 5;
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        let x = (rng() - 0.5) * r;
        let y = (rng() - 0.5) * r * 0.7;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rng() - 0.5) * r * 0.35;
          y += (rng() - 0.5) * r * 0.35;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(-r * 0.3, -r * 0.25, r * 0.35, r * 0.08, -0.5, 0, TAU);
      g.fill();
    },
  },
  crystal: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      const n = 4 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU;
        const len = r * (0.5 + rng() * 0.5);
        const w = r * (0.12 + rng() * 0.1);
        const ox = (rng() - 0.5) * r * 0.3;
        const oy = (rng() - 0.5) * r * 0.3;
        g.save();
        g.translate(ox, oy);
        g.rotate(a);
        g.fillStyle = 'rgba(40,80,120,0.25)';
        g.beginPath();
        g.moveTo(6, 8);
        g.lineTo(len + 10, 8 + w * 0.2);
        g.lineTo(6, w + 8);
        g.fill();
        g.fillStyle = linearG(g, 0, -w, 0, w, [[0, '#ffffff'], [0.5, '#b7e6ff'], [1, '#5aa5d6']]);
        g.beginPath();
        g.moveTo(0, -w);
        g.lineTo(len, 0);
        g.lineTo(0, w);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(30,70,110,0.6)';
        g.lineWidth = 1.5;
        g.stroke();
        g.restore();
      }
    },
  },
  peak: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      shadowBlob(g, 0, 0, r, rng, 0.25);
      const n = 7;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng() * 0.3;
        pts.push([Math.cos(a) * r * (0.75 + rng() * 0.25), Math.sin(a) * r * (0.75 + rng() * 0.25)]);
      }
      const top = [(rng() - 0.5) * r * 0.3, (rng() - 0.5) * r * 0.3];
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % n];
        const mid = Math.atan2((p[1] + q[1]) / 2, (p[0] + q[0]) / 2);
        const lit = 0.5 + 0.5 * Math.cos(mid + Math.PI * 0.75);
        const c = Math.round(150 + lit * 105);
        g.fillStyle = `rgb(${c - 10},${c + 0},${Math.min(255, c + 20)})`;
        g.beginPath();
        g.moveTo(top[0], top[1]);
        g.lineTo(p[0], p[1]);
        g.lineTo(q[0], q[1]);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(60,90,120,0.45)';
      g.lineWidth = 2;
      for (const p of pts) {
        g.beginPath();
        g.moveTo(top[0], top[1]);
        g.lineTo(p[0], p[1]);
        g.stroke();
      }
    },
  },
  dome: {
    layer: 'mid', pad: 1.3,
    paint(g, r) {
      g.fillStyle = 'rgba(30,60,90,0.3)';
      g.beginPath();
      g.arc(r * 0.2, r * 0.25, r * 0.85, 0, TAU);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.35, r * 0.05, r * 0.85, [[0, '#ffffff'], [0.6, '#cfdbe6'], [1, '#8597a8']]);
      g.beginPath();
      g.arc(0, 0, r * 0.8, 0, TAU);
      g.fill();
      g.strokeStyle = '#6d7f91';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = 'rgba(90,110,130,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(0, 0, r * 0.8, (i / 6) * TAU, (i / 6) * TAU + 0.01);
        g.lineTo(0, 0);
        g.stroke();
      }
      g.fillStyle = '#41505f';
      g.fillRect(-r * 0.15, r * 0.6, r * 0.3, r * 0.3);
    },
    anim(ctx, d, t) {
      glow(ctx, '#ff5050', d.x, d.y - d.r * 0.1, d.r * 0.4, 0.5 + 0.5 * Math.sin(t * 2 + d.seed));
    },
  },
  dish: {
    layer: 'mid', pad: 1.3,
    paint(g, r) {
      g.fillStyle = 'rgba(30,60,90,0.3)';
      g.beginPath();
      g.ellipse(r * 0.25, r * 0.3, r * 0.9, r * 0.8, 0, 0, TAU);
      g.fill();
      g.fillStyle = radial(g, -r * 0.2, -r * 0.2, 1, r, [[0, '#f4f7fa'], [0.8, '#a8b6c4'], [1, '#6f8090']]);
      g.beginPath();
      g.arc(0, 0, r * 0.85, 0, TAU);
      g.fill();
      g.strokeStyle = '#5b6b7b';
      g.lineWidth = 3;
      g.stroke();
      for (const k of [0.6, 0.35]) {
        g.beginPath();
        g.arc(0, 0, r * k, 0, TAU);
        g.stroke();
      }
      g.fillStyle = '#56687a';
      g.beginPath();
      g.arc(0, 0, r * 0.1, 0, TAU);
      g.fill();
    },
    anim(ctx, d, t) {
      glow(ctx, '#7fd8ff', d.x, d.y, d.r * 0.5, 0.6 + 0.4 * Math.sin(t * 5));
    },
  },
  drift: {
    layer: 'ground', pad: 1.05,
    paint(g, r, rng) {
      g.fillStyle = radial(g, -r * 0.2, -r * 0.3, 1, r, [[0, 'rgba(255,255,255,0.8)'], [0.7, 'rgba(225,238,250,0.45)'], [1, 'rgba(200,220,240,0)']]);
      blob(g, 0, 0, r, rng, 10, 0.4, 0.45);
      g.fill();
    },
  },

  /* ---------------------------------------------------------- forest */
  tree: {
    layer: 'mid', pad: 1.15,
    paint(g, r, rng) {
      // trunk seen from above with buttress roots
      const t = r * 0.42;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.arc(r * 0.12, r * 0.16, t * 1.4, 0, TAU);
      g.fill();
      g.strokeStyle = '#4a321c';
      g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        const a = rng() * TAU;
        g.lineWidth = t * (0.25 + rng() * 0.2);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a + 0.3) * t * 1.2, Math.sin(a + 0.3) * t * 1.2, Math.cos(a) * t * (1.6 + rng() * 0.6), Math.sin(a) * t * (1.6 + rng() * 0.6));
        g.stroke();
      }
      g.fillStyle = radial(g, -t * 0.3, -t * 0.3, 1, t, [[0, '#8a6038'], [0.7, '#5e3e20'], [1, '#3d2712']]);
      blob(g, 0, 0, t, rng, 10, 0.18);
      g.fill();
      g.strokeStyle = 'rgba(30,18,8,0.6)';
      g.lineWidth = 1.5;
      for (let k = 0.3; k < 1; k += 0.22) {
        g.beginPath();
        g.arc(0, 0, t * k, 0, TAU);
        g.stroke();
      }
    },
    paintTop(g, r, rng) {
      // canopy: layered translucent leaf clumps
      for (let i = 0; i < 9; i++) {
        const a = rng() * TAU;
        const d = rng() * r * 0.45;
        const s = r * (0.35 + rng() * 0.25);
        g.fillStyle = `rgba(${20 + Math.floor(rng() * 30)},${70 + Math.floor(rng() * 50)},${30 + Math.floor(rng() * 20)},0.55)`;
        blob(g, Math.cos(a) * d, Math.sin(a) * d, s, rng, 9, 0.35);
        g.fill();
      }
      g.fillStyle = 'rgba(150,210,110,0.25)';
      for (let i = 0; i < 6; i++) {
        blob(g, -r * 0.2 + (rng() - 0.5) * r * 0.6, -r * 0.2 + (rng() - 0.5) * r * 0.6, r * 0.15, rng, 7, 0.4);
        g.fill();
      }
    },
  },
  fern: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      const n = 7 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng() * 0.4;
        const len = r * (0.7 + rng() * 0.3);
        g.strokeStyle = ['#2f6b2a', '#3d8233', '#245a22'][i % 3];
        g.lineWidth = r * 0.06;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, 0);
        const cx = Math.cos(a + 0.3) * len * 0.6;
        const cy = Math.sin(a + 0.3) * len * 0.6;
        g.quadraticCurveTo(cx, cy, Math.cos(a) * len, Math.sin(a) * len);
        g.stroke();
        g.lineWidth = r * 0.03;
        for (let k = 0.3; k < 1; k += 0.15) {
          const x = Math.cos(a) * len * k;
          const y = Math.sin(a) * len * k;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a + 1.2) * r * 0.18, y + Math.sin(a + 1.2) * r * 0.18);
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(a - 1.2) * r * 0.18, y + Math.sin(a - 1.2) * r * 0.18);
          g.stroke();
        }
      }
    },
  },
  logpile: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      for (let i = 0; i < 3; i++) {
        const y = (i - 1) * r * 0.32;
        const len = r * (1.3 + rng() * 0.4);
        g.fillStyle = SH;
        g.fillRect(-len / 2 + 6, y - r * 0.14 + 8, len, r * 0.28);
        g.fillStyle = linearG(g, 0, y - r * 0.14, 0, y + r * 0.14, [[0, '#8b6540'], [1, '#4d3420']]);
        roundRect(g, -len / 2, y - r * 0.14, len, r * 0.28, r * 0.13);
        g.fill();
        g.fillStyle = '#c49a64';
        g.beginPath();
        g.ellipse(len / 2, y, r * 0.06, r * 0.13, 0, 0, TAU);
        g.fill();
      }
    },
  },
  platform: {
    layer: 'mid', pad: 1.15,
    paint(g, r, rng) {
      g.fillStyle = SH;
      g.beginPath();
      g.arc(r * 0.15, r * 0.2, r * 0.95, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(0, 0, r * 0.95, 0, TAU);
      g.clip();
      for (let y = -r; y < r; y += r * 0.16) {
        g.fillStyle = rng() < 0.5 ? '#8d6a42' : '#7a5a36';
        g.fillRect(-r, y, r * 2, r * 0.15);
      }
      g.restore();
      g.strokeStyle = '#4a321c';
      g.lineWidth = r * 0.06;
      g.beginPath();
      g.arc(0, 0, r * 0.95, 0, TAU);
      g.stroke();
      // hut on the platform
      g.fillStyle = radial(g, -r * 0.15, -r * 0.15, 1, r * 0.45, [[0, '#c9a46c'], [1, '#6e5030']]);
      g.beginPath();
      g.arc(0, 0, r * 0.42, 0, TAU);
      g.fill();
      g.strokeStyle = '#4a321c';
      g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
        g.stroke();
      }
    },
  },
  mushroom: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      for (let i = 0; i < 4; i++) {
        const x = (rng() - 0.5) * r;
        const y = (rng() - 0.5) * r;
        const s = r * (0.2 + rng() * 0.25);
        g.fillStyle = SH;
        g.beginPath();
        g.arc(x + 4, y + 5, s, 0, TAU);
        g.fill();
        g.fillStyle = radial(g, x - s * 0.3, y - s * 0.3, 1, s, [[0, '#f2d7a0'], [1, '#b36a3a']]);
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,245,220,0.8)';
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.arc(x + (rng() - 0.5) * s, y + (rng() - 0.5) * s, s * 0.12, 0, TAU);
          g.fill();
        }
      }
    },
  },

  /* ---------------------------------------------------------- station */
  reactor: {
    layer: 'ground', pad: 1.05,
    paint(g, r) {
      g.fillStyle = radial(g, 0, 0, r * 0.2, r, [[0, '#05070c'], [0.7, '#0c1220'], [1, '#2a303a']]);
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.strokeStyle = '#545d6b';
      g.lineWidth = r * 0.03;
      g.stroke();
      for (const k of [0.85, 0.62, 0.4]) {
        g.strokeStyle = 'rgba(120,140,170,0.35)';
        g.lineWidth = r * 0.015;
        g.beginPath();
        g.arc(0, 0, r * k, 0, TAU);
        g.stroke();
      }
      g.strokeStyle = 'rgba(90,110,140,0.4)';
      g.lineWidth = r * 0.02;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
        g.lineTo(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98);
        g.stroke();
      }
    },
    anim(ctx, d, t) {
      const r = d.r;
      const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
      glow(ctx, '#6fd6ff', d.x, d.y, r * 1.2 * pulse, 0.55);
      glow(ctx, '#ffffff', d.x, d.y, r * 0.35, 0.9);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.rotate(t * (0.25 + k * 0.15) * (k % 2 ? -1 : 1));
        ctx.strokeStyle = `rgba(110,210,255,${0.35 - k * 0.08})`;
        ctx.lineWidth = r * 0.025;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.32 + k * 0.17), 0, TAU * 0.7);
        ctx.stroke();
      }
      // energy beams feeding the core
      ctx.strokeStyle = `rgba(140,230,255,${0.25 + 0.2 * Math.sin(t * 9)})`;
      ctx.lineWidth = r * 0.02;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
        ctx.lineTo(0, 0);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  machine: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      const w = r * 1.5;
      const h = r * (0.8 + rng() * 0.5);
      g.fillStyle = SH;
      g.fillRect(-w / 2 + 14, -h / 2 + 18, w, h);
      g.fillStyle = linearG(g, -w / 2, 0, w / 2, 0, [[0, '#596270'], [0.5, '#7c8695'], [1, '#4c5461']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#1a1e25';
      g.lineWidth = 3;
      g.strokeRect(-w / 2, -h / 2, w, h);
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + w * (0.2 + i * 0.3);
        g.fillStyle = '#2a3039';
        g.beginPath();
        g.arc(x, 0, h * 0.22, 0, TAU);
        g.fill();
        g.strokeStyle = '#8a95a5';
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.moveTo(x - h * 0.15, 0);
        g.lineTo(x + h * 0.15, 0);
        g.stroke();
      }
      g.fillStyle = '#c9a227';
      g.fillRect(-w / 2, h / 2 - 6, w, 6);
    },
    anim(ctx, d, t) {
      const on = Math.sin(t * 5 + d.seed) > 0.3;
      glow(ctx, on ? '#6fd6ff' : '#ff9a2e', d.x + d.r * 0.5, d.y - d.r * 0.3, d.r * 0.35, 0.8);
    },
  },
  window: {
    layer: 'ground', pad: 1.05,
    paint(g, r, rng) {
      const w = r * 1.8;
      const h = r * 0.9;
      g.fillStyle = '#1d222b';
      g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
      g.fillStyle = '#02030a';
      g.fillRect(-w / 2, -h / 2, w, h);
      // stars and a slice of nebula seen through the floor window
      g.fillStyle = radial(g, w * 0.2, 0, 1, w * 0.6, [[0, 'rgba(120,80,200,0.5)'], [1, 'rgba(40,20,80,0)']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + rng() * 0.7})`;
        g.fillRect(-w / 2 + rng() * w, -h / 2 + rng() * h, 1.5 + rng() * 1.5, 1.5 + rng() * 1.5);
      }
      g.strokeStyle = '#59657a';
      g.lineWidth = 4;
      for (let x = -w / 2; x <= w / 2 + 1; x += w / 4) {
        g.beginPath();
        g.moveTo(x, -h / 2);
        g.lineTo(x, h / 2);
        g.stroke();
      }
      g.strokeRect(-w / 2, -h / 2, w, h);
    },
  },
  conduit: {
    layer: 'ground', pad: 1.05,
    paint(g, r) {
      g.fillStyle = '#1a1f27';
      g.fillRect(-r, -r * 0.08, r * 2, r * 0.16);
      g.fillStyle = '#0e2a3a';
      g.fillRect(-r, -r * 0.04, r * 2, r * 0.08);
    },
    anim(ctx, d, t) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(80,200,255,0.25)';
      ctx.fillRect(-d.r, -d.r * 0.04, d.r * 2, d.r * 0.08);
      for (let k = 0; k < 3; k++) {
        const p = ((t * 0.5 + k / 3 + d.seed) % 1) * 2 - 1;
        ctx.fillStyle = 'rgba(160,235,255,0.8)';
        ctx.fillRect(p * d.r - d.r * 0.1, -d.r * 0.04, d.r * 0.2, d.r * 0.08);
      }
      ctx.restore();
    },
  },
  pipes: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      const n = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * r * 0.3;
        g.fillStyle = SH;
        g.fillRect(-r + 8, y - r * 0.1 + 10, r * 2, r * 0.2);
        g.fillStyle = linearG(g, 0, y - r * 0.1, 0, y + r * 0.1, [[0, '#9aa4b2'], [0.5, '#5d6674'], [1, '#353b45']]);
        g.fillRect(-r, y - r * 0.1, r * 2, r * 0.2);
        g.fillStyle = '#2a2f37';
        for (let x = -r + r * 0.3; x < r; x += r * 0.5) g.fillRect(x, y - r * 0.12, r * 0.06, r * 0.24);
      }
    },
  },
  blastdoor: {
    layer: 'mid', pad: 1.1,
    paint(g, r) {
      const w = r * 2;
      const h = r * 0.5;
      g.fillStyle = SH;
      g.fillRect(-w / 2 + 10, -h / 2 + 12, w, h);
      g.fillStyle = '#4d5562';
      g.fillRect(-w / 2, -h / 2, w, h);
      stripes(g, -w / 2, -h / 2, w, h * 0.22, '#e3b52f', '#1b1b1b', 14);
      stripes(g, -w / 2, h / 2 - h * 0.22, w, h * 0.22, '#e3b52f', '#1b1b1b', 14);
      g.strokeStyle = '#191d24';
      g.lineWidth = 3;
      g.strokeRect(-w / 2, -h / 2, w, h);
      g.beginPath();
      g.moveTo(0, -h / 2);
      g.lineTo(0, h / 2);
      g.stroke();
    },
  },

  /* ---------------------------------------------------------- asteroid */
  bigrock: {
    layer: 'mid', pad: 1.25,
    paint(g, r, rng) {
      g.fillStyle = 'rgba(0,0,0,0.35)';
      blob(g, r * 0.15, r * 0.2, r, rng, 11, 0.35);
      g.fill();
      g.fillStyle = radial(g, -r * 0.35, -r * 0.4, r * 0.1, r * 1.15, [[0, '#a39a92'], [0.55, '#5f5852'], [1, '#26221f']]);
      blob(g, 0, 0, r, rng, 11, 0.35);
      g.fill();
      for (let i = 0; i < 7; i++) {
        const x = (rng() - 0.5) * r * 1.2;
        const y = (rng() - 0.5) * r * 1.2;
        const s = r * (0.08 + rng() * 0.14);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.beginPath();
        g.arc(x, y, s, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.beginPath();
        g.arc(x - s * 0.25, y - s * 0.25, s * 0.7, 0, TAU);
        g.fill();
      }
    },
  },
  satellite: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      g.rotate(rng() * TAU);
      g.fillStyle = '#2a3a66';
      g.fillRect(-r, -r * 0.18, r * 0.7, r * 0.36);
      g.fillRect(r * 0.3, -r * 0.18, r * 0.7, r * 0.36);
      g.strokeStyle = '#7f95c8';
      g.lineWidth = 1.5;
      for (let x = -r; x < -r * 0.3; x += r * 0.14) g.strokeRect(x, -r * 0.18, r * 0.14, r * 0.36);
      for (let x = r * 0.3; x < r; x += r * 0.14) g.strokeRect(x, -r * 0.18, r * 0.14, r * 0.36);
      g.fillStyle = '#9aa3b0';
      g.beginPath();
      g.arc(0, 0, r * 0.28, 0, TAU);
      g.fill();
      g.strokeStyle = '#3a414c';
      g.lineWidth = 2;
      g.stroke();
    },
    anim(ctx, d, t) {
      glow(ctx, '#ff3a3a', d.x, d.y, d.r * 0.4, Math.sin(t * 3 + d.seed) > 0.6 ? 1 : 0.15);
    },
  },

  /* ---------------------------------------------------------- lava */
  lavapool: {
    layer: 'ground', pad: 1.05,
    paint(g, r, rng) {
      g.fillStyle = '#1a0805';
      blob(g, 0, 0, r * 1.04, rngFor(rng() * 1e9 + 1), 12, 0.3);
      g.fill();
      const rr = rngFor(rng() * 1e9);
      g.fillStyle = radial(g, 0, 0, r * 0.1, r, [[0, '#ffe08a'], [0.35, '#ff8a1e'], [0.8, '#c8320a'], [1, '#6a1404']]);
      blob(g, 0, 0, r * 0.94, rr, 12, 0.3);
      g.fill();
      g.strokeStyle = 'rgba(255,240,170,0.6)';
      g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        const a = rng() * TAU;
        const d = rng() * r * 0.5;
        g.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.08 + rng() * 0.12), 0, TAU * 0.6);
        g.stroke();
      }
    },
    anim(ctx, d, t) {
      glow(ctx, '#ff6a1a', d.x, d.y, d.r * 2.4, 0.35 + 0.1 * Math.sin(t * 1.5 + d.seed));
    },
  },
  spire: {
    layer: 'mid', pad: 1.3,
    paint(g, r, rng) {
      shadowBlob(g, 0, 0, r * 0.9, rng, 0.45);
      g.fillStyle = radial(g, -r * 0.3, -r * 0.3, 1, r, [[0, '#4a3c38'], [0.6, '#231a18'], [1, '#0d0908']]);
      blob(g, 0, 0, r * 0.85, rng, 8, 0.45);
      g.fill();
      g.strokeStyle = 'rgba(255,110,40,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        let x = 0;
        let y = 0;
        g.beginPath();
        g.moveTo(x, y);
        const a = rng() * TAU;
        for (let k = 0; k < 4; k++) {
          x += Math.cos(a + (rng() - 0.5)) * r * 0.2;
          y += Math.sin(a + (rng() - 0.5)) * r * 0.2;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    },
  },
  refinery: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      const w = r * 1.6;
      const h = r * 1.1;
      g.fillStyle = SH;
      g.fillRect(-w / 2 + 16, -h / 2 + 20, w, h);
      g.fillStyle = linearG(g, 0, -h / 2, 0, h / 2, [[0, '#3c3f46'], [1, '#1c1e22']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#0a0b0d';
      g.lineWidth = 4;
      g.strokeRect(-w / 2, -h / 2, w, h);
      stripes(g, -w / 2, -h / 2, w, 10, '#e07a1f', '#1a1a1a', 12);
      for (let i = 0; i < 3; i++) {
        const x = -w / 2 + w * (0.2 + i * 0.3);
        const y = (rng() - 0.5) * h * 0.3;
        g.fillStyle = '#5b5f68';
        g.beginPath();
        g.arc(x, y, h * 0.2, 0, TAU);
        g.fill();
        g.strokeStyle = '#1a1c20';
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = '#20242a';
        g.beginPath();
        g.arc(x, y, h * 0.1, 0, TAU);
        g.fill();
      }
    },
    anim(ctx, d, t) {
      glow(ctx, '#ff8a2e', d.x - d.r * 0.5, d.y, d.r * 0.4, 0.5 + 0.5 * Math.sin(t * 6 + d.seed));
      glow(ctx, '#ff8a2e', d.x + d.r * 0.5, d.y, d.r * 0.4, 0.5 + 0.5 * Math.sin(t * 6 + d.seed + 2));
    },
    smoke: true,
  },

  /* ---------------------------------------------------------- city */
  skyscraper: {
    layer: 'mid', pad: 1.35,
    paint(g, r, rng) {
      const w = r * (1.1 + rng() * 0.4);
      const h = r * (1.1 + rng() * 0.4);
      // long shadow down onto the haze
      g.fillStyle = 'rgba(0,0,10,0.45)';
      g.fillRect(-w / 2 + r * 0.25, -h / 2 + r * 0.3, w, h);
      const hue = Math.floor(rng() * 3);
      const top = ['#2c3350', '#33304a', '#24394a'][hue];
      g.fillStyle = linearG(g, -w / 2, -h / 2, w / 2, h / 2, [[0, top], [1, '#121522']]);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#5a6a9a';
      g.lineWidth = 2;
      g.strokeRect(-w / 2, -h / 2, w, h);
      // rooftop: tier, vents, landing pad or antenna
      g.fillStyle = '#3a4466';
      g.fillRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.64);
      g.strokeStyle = '#6f80b5';
      g.strokeRect(-w * 0.32, -h * 0.32, w * 0.64, h * 0.64);
      if (rng() < 0.5) {
        g.strokeStyle = '#e3c55a';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(0, 0, w * 0.22, 0, TAU);
        g.stroke();
      } else {
        g.fillStyle = '#1b2032';
        for (let i = 0; i < 4; i++) g.fillRect(-w * 0.25 + i * w * 0.14, -h * 0.2, w * 0.08, h * 0.4);
      }
      // window grid on the edges
      g.fillStyle = 'rgba(255,220,140,0.6)';
      for (let x = -w / 2 + 6; x < w / 2 - 6; x += 10) {
        if (rng() < 0.6) g.fillRect(x, -h / 2 + 3, 5, 3);
        if (rng() < 0.6) g.fillRect(x, h / 2 - 6, 5, 3);
      }
    },
    anim(ctx, d, t) {
      glow(ctx, '#ff3a5a', d.x, d.y, d.r * 0.3, Math.sin(t * 2.5 + d.seed) > 0.4 ? 1 : 0.2);
    },
  },
  billboard: {
    layer: 'mid', pad: 1.4,
    paint(g, r) {
      const w = r * 1.8;
      const h = r * 0.6;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
      g.fillStyle = '#0b0d18';
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#2a3050';
      g.lineWidth = 3;
      g.strokeRect(-w / 2, -h / 2, w, h);
    },
    anim(ctx, d, t) {
      // neon advert: abstract shapes cycling color (no text)
      const w = d.r * 1.8;
      const h = d.r * 0.6;
      const hue = (t * 40 + d.seed * 90) % 360;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `hsla(${hue},90%,60%,0.85)`;
      const phase = Math.floor(t * 1.5 + d.seed) % 3;
      if (phase === 0) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(-w * 0.28 + i * w * 0.28, 0, h * 0.3, 0, TAU);
          ctx.fill();
        }
      } else if (phase === 1) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.4, h * 0.3);
        ctx.lineTo(0, -h * 0.35);
        ctx.lineTo(w * 0.4, h * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        for (let i = 0; i < 5; i++) ctx.fillRect(-w * 0.42 + i * w * 0.18, -h * 0.3 + ((i + Math.floor(t * 4)) % 3) * h * 0.1, w * 0.12, h * 0.5);
      }
      ctx.strokeStyle = `hsla(${(hue + 180) % 360},90%,65%,0.9)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6);
      ctx.restore();
      glow(ctx, `#ff5ad0`, d.x, d.y, d.r * 2.2, 0.25);
    },
  },

  /* ---------------------------------------------------------- graveyard */
  destroyer: {
    layer: 'mid', pad: 1.1,
    paint(g, r, rng) {
      // a giant wedge-shaped capital ship half buried in sand
      g.save();
      g.rotate(-0.3);
      g.fillStyle = 'rgba(80,50,20,0.35)';
      g.beginPath();
      g.moveTo(-r * 0.95 + 40, -r * 0.55 + 50);
      g.lineTo(r * 1.0 + 40, 50);
      g.lineTo(-r * 0.95 + 40, r * 0.55 + 50);
      g.closePath();
      g.fill();
      g.fillStyle = linearG(g, 0, -r * 0.55, 0, r * 0.55, [[0, '#a9a49a'], [0.5, '#7c776e'], [1, '#55514a']]);
      g.beginPath();
      g.moveTo(-r * 0.95, -r * 0.55);
      g.lineTo(r * 1.0, 0);
      g.lineTo(-r * 0.95, r * 0.55);
      g.closePath();
      g.fill();
      g.strokeStyle = '#3a362f';
      g.lineWidth = 5;
      g.stroke();
      g.strokeStyle = 'rgba(40,35,30,0.55)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-r * 0.95, 0);
      g.lineTo(r * 0.95, 0);
      for (let k = -0.7; k < 0.8; k += 0.25) {
        g.moveTo(r * k, -r * 0.48 * (1 - (k + 0.95) / 1.95));
        g.lineTo(r * k, r * 0.48 * (1 - (k + 0.95) / 1.95));
      }
      g.stroke();
      // superstructure tower
      g.fillStyle = '#8f8a80';
      g.fillRect(-r * 0.75, -r * 0.14, r * 0.3, r * 0.28);
      g.fillStyle = '#6d685f';
      g.fillRect(-r * 0.7, -r * 0.08, r * 0.2, r * 0.16);
      // sand piled over the far end, rust streaks
      g.fillStyle = 'rgba(214,180,120,0.9)';
      blob(g, -r * 0.85, r * 0.3, r * 0.35, rng, 10, 0.3, 0.6);
      g.fill();
      blob(g, r * 0.55, -r * 0.05, r * 0.22, rng, 10, 0.4, 0.8);
      g.fill();
      g.fillStyle = 'rgba(130,60,25,0.35)';
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.ellipse((rng() - 0.6) * r, (rng() - 0.5) * r * 0.5, r * 0.08, r * 0.025, 0, 0, TAU);
        g.fill();
      }
      g.restore();
    },
  },
  ringwreck: {
    layer: 'mid', pad: 1.15,
    paint(g, r, rng) {
      g.fillStyle = 'rgba(80,50,20,0.3)';
      g.beginPath();
      g.arc(r * 0.1, r * 0.14, r, 0, TAU);
      g.arc(r * 0.1, r * 0.14, r * 0.7, 0, TAU, true);
      g.fill();
      g.fillStyle = '#8b8378';
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.arc(0, 0, r * 0.7, 0, TAU, true);
      g.fill();
      g.strokeStyle = '#3e3932';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.stroke();
      g.beginPath();
      g.arc(0, 0, r * 0.7, 0, TAU);
      g.stroke();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        g.stroke();
      }
      g.fillStyle = 'rgba(214,180,120,0.95)';
      blob(g, r * 0.6, r * 0.55, r * 0.45, rng, 10, 0.3, 0.7);
      g.fill();
    },
  },
  hulk: {
    layer: 'mid', pad: 1.2,
    paint(g, r, rng) {
      g.rotate(rng() * TAU);
      g.fillStyle = 'rgba(80,50,20,0.35)';
      g.beginPath();
      g.ellipse(r * 0.15, r * 0.2, r * 0.95, r * 0.6, 0, 0, TAU);
      g.fill();
      g.fillStyle = radial(g, -r * 0.3, -r * 0.3, 1, r, [[0, '#b5ad9f'], [0.7, '#7a7266'], [1, '#4c463e']]);
      g.beginPath();
      g.ellipse(0, 0, r * 0.9, r * 0.55, 0, 0, TAU);
      g.fill();
      g.strokeStyle = '#3a342c';
      g.lineWidth = 4;
      g.stroke();
      g.fillStyle = '#5a5248';
      g.fillRect(r * 0.4, -r * 0.65, r * 0.3, r * 0.3);
      g.fillRect(r * 0.4, r * 0.35, r * 0.3, r * 0.3);
      g.fillStyle = '#1e1a16';
      g.beginPath();
      g.arc(-r * 0.2, -r * 0.05, r * 0.2, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(214,180,120,0.9)';
      blob(g, -r * 0.6, r * 0.25, r * 0.3, rng, 9, 0.4, 0.7);
      g.fill();
    },
  },
  engine: {
    layer: 'mid', pad: 1.25,
    paint(g, r, rng) {
      g.rotate(rng() * TAU);
      g.fillStyle = 'rgba(80,50,20,0.35)';
      g.fillRect(-r * 0.8 + 10, -r * 0.35 + 12, r * 1.6, r * 0.7);
      g.fillStyle = linearG(g, 0, -r * 0.35, 0, r * 0.35, [[0, '#a59c8e'], [0.5, '#6b6459'], [1, '#3e3933']]);
      g.fillRect(-r * 0.8, -r * 0.35, r * 1.6, r * 0.7);
      g.fillStyle = '#25211c';
      g.beginPath();
      g.ellipse(r * 0.8, 0, r * 0.12, r * 0.35, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(40,35,30,0.7)';
      g.lineWidth = 3;
      for (let x = -r * 0.6; x < r * 0.8; x += r * 0.3) {
        g.beginPath();
        g.moveTo(x, -r * 0.35);
        g.lineTo(x, r * 0.35);
        g.stroke();
      }
      g.fillStyle = 'rgba(140,65,25,0.45)';
      g.fillRect(-r * 0.3, -r * 0.2, r * 0.5, r * 0.25);
    },
  },
  scrapheap: {
    layer: 'mid', pad: 1.25,
    paint(g, r, rng) {
      shadowBlob(g, 0, 0, r, rng, 0.3);
      for (let i = 0; i < 9; i++) {
        const x = (rng() - 0.5) * r * 1.1;
        const y = (rng() - 0.5) * r * 1.1;
        const s = r * (0.2 + rng() * 0.25);
        g.save();
        g.translate(x, y);
        g.rotate(rng() * TAU);
        g.fillStyle = ['#8a8274', '#6e665a', '#9a5c33', '#5a544b'][i % 4];
        g.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
        g.strokeStyle = '#2b2620';
        g.lineWidth = 2;
        g.strokeRect(-s, -s * 0.4, s * 2, s * 0.8);
        g.restore();
      }
    },
  },

  /* ---------------------------------------------------------- grand prix */
  stands: {
    layer: 'mid', pad: 1.1,
    paint(g, r, rng) {
      const w = r * 2;
      const h = r * 0.7;
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
      g.fillStyle = '#1a1f33';
      g.fillRect(-w / 2, -h / 2, w, h);
      // tiers of spectators (tiny colored dots)
      const colors = ['#ff5a6a', '#ffd34a', '#7dff8a', '#5ad0ff', '#c58bff', '#ffffff', '#ff9a2e'];
      for (let row = 0; row < 6; row++) {
        const y = -h / 2 + 8 + row * ((h - 16) / 6);
        g.fillStyle = row % 2 ? '#262c45' : '#20253b';
        g.fillRect(-w / 2 + 4, y - 2, w - 8, (h - 16) / 6);
        for (let x = -w / 2 + 8; x < w / 2 - 6; x += 7) {
          if (rng() < 0.85) {
            g.fillStyle = colors[Math.floor(rng() * colors.length)];
            g.fillRect(x, y + 1, 4, 4);
          }
        }
      }
      g.fillStyle = '#3a4470';
      g.fillRect(-w / 2, h / 2 - 8, w, 8);
      g.strokeStyle = '#6a78b8';
      g.lineWidth = 2;
      g.strokeRect(-w / 2, -h / 2, w, h);
    },
    anim(ctx, d, t) {
      // crowd waves: a moving band of flashes
      const w = d.r * 2;
      const p = ((t * 0.35 + d.seed) % 1) * w - w / 2;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(p - 30, -d.r * 0.35, 60, d.r * 0.7);
      ctx.restore();
      if (Math.sin(t * 7 + d.seed * 13) > 0.97) glow(ctx, '#ffffff', d.x + (Math.random() - 0.5) * d.r, d.y, 30, 1);
    },
  },
  screen: {
    layer: 'mid', pad: 1.3,
    paint(g, r) {
      const w = r * 1.8;
      const h = r * 1.0;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(-w / 2 + 12, -h / 2 + 16, w, h);
      g.fillStyle = '#05060d';
      g.fillRect(-w / 2, -h / 2, w, h);
      g.strokeStyle = '#59627f';
      g.lineWidth = 5;
      g.strokeRect(-w / 2, -h / 2, w, h);
    },
    anim(ctx, d, t, view) {
      // giant display: live bars in each racer's color, a spinning emblem
      const w = d.r * 1.8;
      const h = d.r * 1.0;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalCompositeOperation = 'lighter';
      const cols = view?.racerColors || ['#38d6ff', '#ff5a6a', '#ffc94a', '#7dff8a'];
      cols.forEach((c, i) => {
        const bh = h * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7 + d.seed)));
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(-w * 0.42 + i * w * 0.15, h * 0.4 - bh, w * 0.1, bh);
      });
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const a = t * 1.5;
      for (let i = 0; i < 5; i++) {
        const ang = a + (i / 5) * TAU * 2;
        const x = w * 0.28 + Math.cos(ang) * h * 0.3;
        const y = Math.sin(ang) * h * 0.3;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      glow(ctx, '#7fb8ff', d.x, d.y, d.r * 2.5, 0.25);
    },
  },
  holo: {
    layer: 'mid', pad: 1.4,
    paint(g, r) {
      g.fillStyle = '#141826';
      g.beginPath();
      g.arc(0, 0, r * 0.35, 0, TAU);
      g.fill();
      g.strokeStyle = '#4a5580';
      g.lineWidth = 3;
      g.stroke();
    },
    anim(ctx, d, t) {
      const hue = (t * 60 + d.seed * 100) % 360;
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.rotate(t * (0.6 + k * 0.4) * (k % 2 ? -1 : 1));
        ctx.scale(1, 0.45 + k * 0.2);
        ctx.strokeStyle = `hsla(${(hue + k * 60) % 360},95%,65%,0.7)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, d.r * (0.6 + k * 0.18), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      ctx.rotate(t);
      ctx.strokeStyle = `hsla(${hue},95%,70%,0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        ctx.lineTo(Math.cos(a) * d.r * 0.4, Math.sin(a) * d.r * 0.4);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      glow(ctx, '#9f7bff', d.x, d.y, d.r * 2, 0.35);
    },
  },
  floodlight: {
    layer: 'mid', pad: 1.6,
    paint(g, r) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(-r * 0.3 + 6, -r * 0.3 + 8, r * 0.6, r * 0.6);
      g.fillStyle = '#2a3048';
      g.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
      g.fillStyle = '#f6f2d8';
      for (let i = 0; i < 4; i++) g.fillRect(-r * 0.24 + (i % 2) * r * 0.26, -r * 0.24 + Math.floor(i / 2) * r * 0.26, r * 0.2, r * 0.2);
    },
    anim(ctx, d) {
      glow(ctx, '#fff6d0', d.x, d.y, d.r * 4, 0.35);
    },
  },
};

/* ================================================================ TILES */

function plates(g, S, rng, base, seam, size) {
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += size) {
    for (let x = 0; x < S; x += size) {
      const v = Math.floor((rng() - 0.5) * 14);
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`;
      g.fillRect(x, y, size, size);
    }
  }
  g.strokeStyle = seam;
  g.lineWidth = 2;
  for (let p = 0; p <= S; p += size) {
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, S);
    g.moveTo(0, p);
    g.lineTo(S, p);
    g.stroke();
  }
}

function grating(g, S, base, line, step) {
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = line;
  g.lineWidth = 2;
  for (let p = 0; p <= S; p += step) {
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, S);
    g.moveTo(0, p);
    g.lineTo(S, p);
    g.stroke();
  }
}

function noise(g, S, rng, base, colors, count, rMin, rMax) {
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  speckle(g, S, rng, count, colors, rMin, rMax);
}

function ripples(g, S, rng, color, count, width) {
  g.strokeStyle = color;
  g.lineWidth = width;
  for (let i = 0; i < count; i++) {
    const x = rng() * S;
    const y = rng() * S;
    const len = 30 + rng() * 60;
    wrapDraw(S, (ox, oy) => {
      g.beginPath();
      g.moveTo(x + ox - len / 2, y + oy);
      g.quadraticCurveTo(x + ox, y + oy - 6, x + ox + len / 2, y + oy);
      g.stroke();
    });
  }
}

/* ================================================================ THEMES */

export const THEMES = {
  imperial: {
    bg: '#14171d',
    accent: '#ff3a3a',
    thumb: ['#1b1f27', '#3a0f12'],
    ground: (g, S, rng) => {
      plates(g, S, rng, '#2a2f37', '#1a1d23', 64);
      speckle(g, S, rng, 30, ['#3a4049', '#20242b'], 2, 4);
    },
    surface: (g, S, rng) => {
      noise(g, S, rng, '#1c1f25', ['#22262d', '#17191e', '#262a31'], 400, 1, 3);
      g.strokeStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < S; y += 32) g.strokeRect(0, y, S, 32);
    },
    runoff: (g, S) => grating(g, S, '#242830', '#141619', 16),
    curb: ['#c32a34', '#d8dde3'],
    lane: { color: 'rgba(255,200,60,0.45)', width: 5, dash: [70, 60], offsets: [0] },
    wall: { color: '#0b0d11', top: '#5b6573', width: 26 },
    wallLights: { color: '#ff3a3a', spacing: 300, blink: 1.4 },
    decor: [
      { kind: 'hangar', count: 8, gap: [80, 700], r: [220, 300] },
      { kind: 'tower', count: 10, gap: [40, 500], r: [60, 85] },
      { kind: 'pad', count: 7, gap: [60, 900], r: [120, 170] },
      { kind: 'parked', count: 8, gap: [40, 600], r: [55, 70] },
      { kind: 'crates', count: 18, gap: [20, 900], r: [50, 80] },
    ],
    along: [{ kind: 'beacon', spacing: 520, offset: 44, r: 10, color: '#ff3a3a' }],
    overhead: 'flyover',
    weather: null,
    tint: null,
    ambient: 'base',
  },

  desert: {
    bg: '#c9864a',
    accent: '#ffb347',
    thumb: ['#f4a65a', '#7a3a1a'],
    ground: (g, S, rng) => {
      noise(g, S, rng, '#d48d4f', ['#c97f43', '#dc9a5e', '#bf7438'], 500, 1, 3);
      ripples(g, S, rng, 'rgba(150,80,30,0.25)', 40, 3);
    },
    surface: (g, S, rng) => {
      noise(g, S, rng, '#e3b47e', ['#d9a670', '#ebc28f', '#cf9a63'], 600, 1, 3);
      speckle(g, S, rng, 20, ['rgba(120,70,30,0.35)'], 3, 6);
    },
    runoff: (g, S, rng) => {
      noise(g, S, rng, '#c47a3c', ['#b86f33', '#cf8748'], 400, 1, 3);
      ripples(g, S, rng, 'rgba(120,60,20,0.35)', 50, 3);
    },
    curb: ['#a5532a', '#f1d6ae'],
    lane: null,
    wall: { color: '#6b3a1c', top: '#a8683a', width: 34 },
    wallLights: null,
    decor: [
      { kind: 'mesa', count: 10, gap: [60, 1000], r: [220, 420] },
      { kind: 'dune', count: 24, gap: [20, 1200], r: [200, 380] },
      { kind: 'boulder', count: 40, gap: [10, 900], r: [30, 80] },
      { kind: 'hut', count: 6, gap: [100, 700], r: [80, 120] },
      { kind: 'vaporator', count: 14, gap: [30, 800], r: [24, 34] },
      { kind: 'bones', count: 3, gap: [80, 700], r: [120, 160] },
    ],
    along: [],
    overhead: 'suns',
    weather: 'dust',
    tint: 'desert',
    ambient: 'wind',
  },

  ice: {
    bg: '#dfeaf4',
    accent: '#7fd8ff',
    thumb: ['#e8f4ff', '#6fa4cc'],
    ground: (g, S, rng) => {
      noise(g, S, rng, '#e6eff7', ['#f4f9fd', '#d6e4ef', '#dce8f2'], 500, 2, 5);
      speckle(g, S, rng, 80, ['rgba(255,255,255,0.9)'], 0.8, 1.6);
    },
    surface: (g, S, rng) => {
      g.fillStyle = '#b9d9ee';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        const x = rng() * S;
        const y = rng() * S;
        const a = rng() * TAU;
        const l = 20 + rng() * 60;
        wrapDraw(S, (ox, oy) => {
          g.beginPath();
          g.moveTo(x + ox, y + oy);
          g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
          g.stroke();
        });
      }
      speckle(g, S, rng, 60, ['rgba(255,255,255,0.6)', 'rgba(140,190,225,0.5)'], 1, 3);
    },
    runoff: (g, S, rng) => {
      noise(g, S, rng, '#f2f7fb', ['#ffffff', '#e3edf5'], 400, 2, 6);
      ripples(g, S, rng, 'rgba(160,190,215,0.35)', 30, 4);
    },
    curb: ['#3f8fd0', '#ffffff'],
    lane: null,
    wall: { color: '#a9c3d8', top: '#ffffff', width: 30 },
    wallLights: { color: '#ff5a3a', spacing: 700, blink: 0.8 },
    decor: [
      { kind: 'peak', count: 12, gap: [120, 1200], r: [260, 480] },
      { kind: 'lake', count: 6, gap: [40, 900], r: [200, 360] },
      { kind: 'drift', count: 30, gap: [10, 1000], r: [120, 260] },
      { kind: 'crystal', count: 30, gap: [10, 700], r: [40, 90] },
      { kind: 'dome', count: 6, gap: [60, 700], r: [90, 130] },
      { kind: 'dish', count: 3, gap: [100, 700], r: [120, 160] },
    ],
    along: [],
    overhead: 'tunnels',
    weather: 'snow',
    tint: 'ice',
    ambient: 'blizzard',
  },

  forest: {
    bg: '#1f3a1c',
    accent: '#9be36a',
    thumb: ['#2f5a2a', '#0f220e'],
    ground: (g, S, rng) => {
      noise(g, S, rng, '#24421f', ['#2b4f24', '#1d361a', '#2f5527', '#3a5a22'], 700, 2, 6);
      speckle(g, S, rng, 40, ['rgba(120,90,40,0.5)'], 2, 4);
    },
    surface: (g, S, rng) => {
      noise(g, S, rng, '#6e5233', ['#7a5c3a', '#634829', '#80623f'], 600, 1, 4);
      speckle(g, S, rng, 40, ['rgba(60,100,40,0.5)', 'rgba(150,110,50,0.5)'], 2, 4);
    },
    runoff: (g, S, rng) => noise(g, S, rng, '#2f5527', ['#386330', '#28491f', '#477a33'], 600, 2, 6),
    curb: null,
    edge: 'rgba(30,20,10,0.6)',
    lane: null,
    wall: { color: '#13240f', top: '#4f3a20', width: 30 },
    wallLights: null,
    decor: [
      { kind: 'tree', count: 46, gap: [-10, 1000], r: [130, 230] },
      { kind: 'fern', count: 60, gap: [0, 700], r: [40, 80] },
      { kind: 'platform', count: 5, gap: [60, 600], r: [100, 140] },
      { kind: 'logpile', count: 8, gap: [10, 600], r: [50, 80] },
      { kind: 'mushroom', count: 20, gap: [0, 600], r: [30, 50] },
    ],
    along: [],
    overhead: 'canopy',
    weather: 'pollen',
    tint: 'forest',
    ambient: 'forest',
    critters: true,
  },

  station: {
    bg: '#2a2f38',
    accent: '#6fd6ff',
    thumb: ['#3a414c', '#0b1a2a'],
    ground: (g, S, rng) => {
      plates(g, S, rng, '#3b414b', '#262a31', 128);
      g.fillStyle = '#2e333b';
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(rng() * 4) * 128 + 16, Math.floor(rng() * 4) * 128 + 16, 96, 8);
    },
    surface: (g, S, rng) => {
      noise(g, S, rng, '#5a616c', ['#606773', '#545b65'], 300, 1, 3);
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 2;
      for (let y = 0; y < S; y += 64) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
      }
    },
    runoff: (g, S) => grating(g, S, '#30353d', '#1c1f24', 20),
    curb: ['#2f7bff', '#c9d2dc'],
    lane: { color: 'rgba(120,200,255,0.4)', width: 4, dash: [40, 40], offsets: [-55, 55] },
    wall: { color: '#1a1e25', top: '#9aa6b6', width: 30 },
    wallLights: { color: '#5ad0ff', spacing: 200, blink: 0 },
    decor: [
      { kind: 'machine', count: 20, gap: [20, 600], r: [70, 120] },
      { kind: 'window', count: 6, gap: [60, 600], r: [140, 190] },
      { kind: 'conduit', count: 16, gap: [20, 700], r: [180, 300] },
      { kind: 'pipes', count: 14, gap: [10, 500], r: [70, 110] },
    ],
    along: [{ kind: 'blastdoor', spacing: 1300, offset: 70, r: 80 }],
    overhead: null,
    weather: null,
    tint: null,
    ambient: 'hum',
  },

  asteroid: {
    bg: '#02030a',
    accent: '#ff5ad0',
    thumb: ['#090b1c', '#2a0f3a'],
    space: true,
    ground: null,
    surface: (g, S, rng) => {
      g.fillStyle = '#122452';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(90,170,255,0.18)';
      g.lineWidth = 2;
      for (let p = 0; p <= S; p += 64) {
        g.beginPath();
        g.moveTo(p, 0);
        g.lineTo(p, S);
        g.moveTo(0, p);
        g.lineTo(S, p);
        g.stroke();
      }
      speckle(g, S, rng, 30, ['rgba(150,210,255,0.35)'], 1, 2);
    },
    runoff: (g, S, rng) => {
      g.fillStyle = '#1c0f2c';
      g.fillRect(0, 0, S, S);
      speckle(g, S, rng, 60, ['rgba(220,120,255,0.25)'], 1, 3);
    },
    curb: ['#ff5ad0', '#5ad0ff'],
    curbW: 8,
    lane: { color: 'rgba(120,200,255,0.35)', width: 3, dash: [20, 40], offsets: [0] },
    wall: { color: '#3a1440', top: '#ff5ad0', width: 12 },
    wallLights: { color: '#ff5ad0', spacing: 160, blink: 2 },
    decor: [
      { kind: 'bigrock', count: 45, gap: [-20, 900], r: [80, 240] },
      { kind: 'bigrock', count: 60, gap: [-30, 400], r: [30, 70] },
      { kind: 'satellite', count: 6, gap: [40, 600], r: [40, 60] },
    ],
    along: [],
    overhead: null,
    weather: 'motes',
    tint: null,
    ambient: 'space',
  },

  lava: {
    bg: '#120807',
    accent: '#ff7a2a',
    thumb: ['#3a120a', '#0b0504'],
    ground: (g, S, rng) => {
      noise(g, S, rng, '#1d1412', ['#251a17', '#16100e', '#2b201c'], 500, 2, 6);
      g.strokeStyle = 'rgba(255,90,30,0.55)';
      g.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        let x = rng() * S;
        let y = rng() * S;
        const pts = [[x, y]];
        for (let k = 0; k < 5; k++) {
          x += (rng() - 0.5) * 60;
          y += (rng() - 0.5) * 60;
          pts.push([x, y]);
        }
        wrapDraw(S, (ox, oy) => {
          g.beginPath();
          pts.forEach(([px, py], k) => (k ? g.lineTo(px + ox, py + oy) : g.moveTo(px + ox, py + oy)));
          g.stroke();
        });
      }
    },
    surface: (g, S, rng) => {
      plates(g, S, rng, '#3a3633', '#211e1c', 64);
      speckle(g, S, rng, 30, ['rgba(255,120,40,0.25)'], 1, 2);
    },
    runoff: (g, S, rng) => {
      g.fillStyle = '#d2400e';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) {
        const x = rng() * S;
        const y = rng() * S;
        const r = 10 + rng() * 40;
        wrapDraw(S, (ox, oy) => {
          g.fillStyle = radial(g, x + ox, y + oy, 1, r, [[0, 'rgba(255,230,120,0.9)'], [1, 'rgba(255,120,20,0)']]);
          g.beginPath();
          g.arc(x + ox, y + oy, r, 0, TAU);
          g.fill();
        });
      }
      speckle(g, S, rng, 50, ['rgba(80,15,5,0.6)'], 3, 9);
    },
    runoffFlow: 22,
    curb: ['#e0621f', '#262322'],
    lane: { color: 'rgba(255,140,40,0.35)', width: 4, dash: [30, 50], offsets: [0] },
    wall: { color: '#0a0606', top: '#5a2a18', width: 24 },
    wallLights: null,
    decor: [
      { kind: 'lavapool', count: 14, gap: [30, 900], r: [180, 360] },
      { kind: 'spire', count: 40, gap: [0, 900], r: [50, 120] },
      { kind: 'refinery', count: 7, gap: [60, 600], r: [140, 190] },
    ],
    along: [],
    overhead: null,
    weather: 'embers',
    tint: 'lava',
    ambient: 'lava',
  },

  city: {
    bg: '#070a18',
    accent: '#ff5ad0',
    thumb: ['#140f3a', '#05060f'],
    cityDepth: true,
    ground: null,
    surface: (g, S, rng) => {
      noise(g, S, rng, '#1b1e2c', ['#20243a', '#171a27'], 300, 1, 3);
      g.strokeStyle = 'rgba(120,140,255,0.08)';
      g.lineWidth = 2;
      for (let x = 0; x < S; x += 32) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
    },
    runoff: (g, S, rng) => {
      g.fillStyle = '#0d2836';
      g.fillRect(0, 0, S, S);
      g.strokeStyle = 'rgba(90,220,255,0.12)';
      g.lineWidth = 2;
      for (let p = 0; p <= S; p += 32) {
        g.beginPath();
        g.moveTo(p, 0);
        g.lineTo(p, S);
        g.stroke();
      }
      speckle(g, S, rng, 30, ['rgba(120,230,255,0.3)'], 1, 2);
    },
    curb: ['#ff3ad0', '#3ad8ff'],
    curbW: 10,
    lane: { color: 'rgba(255,255,255,0.45)', width: 4, dash: [60, 60], offsets: [-58, 58] },
    wall: { color: '#0f4f66', top: '#5ae0ff', width: 14 },
    wallLights: { color: '#ff3ad0', spacing: 240, blink: 3 },
    decor: [
      { kind: 'skyscraper', count: 50, gap: [30, 900], r: [120, 230] },
      { kind: 'billboard', count: 14, gap: [30, 400], r: [90, 130] },
    ],
    along: [],
    overhead: 'traffic',
    weather: null,
    tint: 'city',
    ambient: 'city',
  },

  graveyard: {
    bg: '#cfae7a',
    accent: '#ffcf7a',
    thumb: ['#e0c08c', '#6a5030'],
    ground: (g, S, rng) => {
      noise(g, S, rng, '#d2b07b', ['#c9a56f', '#dbbb87', '#bf9a63'], 500, 1, 3);
      ripples(g, S, rng, 'rgba(140,100,50,0.25)', 30, 3);
      speckle(g, S, rng, 14, ['rgba(80,70,60,0.6)', 'rgba(130,70,30,0.5)'], 2, 4, 'rect');
    },
    surface: (g, S, rng) => {
      noise(g, S, rng, '#a98a5f', ['#9e7f55', '#b39468', '#94764d'], 600, 1, 3);
      g.strokeStyle = 'rgba(70,50,30,0.18)';
      g.lineWidth = 6;
      for (const y of [S * 0.3, S * 0.7]) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
      }
    },
    runoff: (g, S, rng) => {
      noise(g, S, rng, '#c19c66', ['#b58f59', '#ccaa75'], 400, 1, 3);
      speckle(g, S, rng, 50, ['#6e665a', '#8a5a33', '#4c463e'], 2, 6, 'rect');
    },
    curb: ['#8a4a26', '#cfc6b4'],
    lane: null,
    wall: { color: '#4a3e30', top: '#9a8a70', width: 30 },
    wallLights: { color: '#ffb347', spacing: 900, blink: 1 },
    decor: [
      { kind: 'destroyer', count: 2, gap: [120, 1500], r: [700, 900] },
      { kind: 'ringwreck', count: 2, gap: [80, 1200], r: [260, 340] },
      { kind: 'hulk', count: 8, gap: [40, 900], r: [140, 220] },
      { kind: 'engine', count: 14, gap: [10, 700], r: [60, 100] },
      { kind: 'scrapheap', count: 30, gap: [0, 800], r: [40, 80] },
      { kind: 'dune', count: 14, gap: [20, 1200], r: [200, 320] },
    ],
    along: [],
    overhead: null,
    weather: 'dust',
    tint: 'graveyard',
    ambient: 'wind',
  },

  grandprix: {
    bg: '#10132a',
    accent: '#ffd34a',
    thumb: ['#20255a', '#0a0b1a'],
    ground: (g, S, rng) => {
      g.fillStyle = '#151a36';
      g.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 64) {
        for (let x = 0; x < S; x += 64) {
          if ((x + y) % 128 === 0) {
            g.fillStyle = '#191f40';
            g.fillRect(x, y, 64, 64);
          }
        }
      }
      speckle(g, S, rng, 20, ['rgba(120,140,255,0.2)'], 1, 2);
    },
    surface: (g, S, rng) => {
      noise(g, S, rng, '#23252d', ['#292b34', '#1f2128'], 400, 1, 3);
    },
    runoff: (g, S) => {
      g.fillStyle = '#1d3a7a';
      g.fillRect(0, 0, S, S);
      g.fillStyle = '#244a99';
      for (let y = 0; y < S; y += 32) for (let x = (y / 32) % 2 ? 32 : 0; x < S; x += 64) g.fillRect(x, y, 32, 32);
    },
    curb: ['#e8283a', '#ffffff'],
    curbW: 18,
    lane: { color: 'rgba(255,255,255,0.4)', width: 4, dash: [50, 50], offsets: [0] },
    wall: { color: '#e8eaf2', top: '#ffffff', width: 22 },
    wallLights: { color: '#ffd34a', spacing: 120, blink: 6, chase: true },
    decor: [
      { kind: 'holo', count: 10, gap: [80, 600], r: [70, 110] },
      { kind: 'screen', count: 6, gap: [60, 500], r: [160, 200] },
      { kind: 'floodlight', count: 16, gap: [40, 400], r: [36, 46] },
    ],
    along: [{ kind: 'stands', spacing: 520, offset: 150, r: 220, minStraight: true }],
    overhead: 'stadium',
    weather: null,
    tint: null,
    ambient: 'crowd',
  },
};

/* Kinds of track section that change the look of the surface. */
export const SECTION_STYLE = {
  canyon: { wall: '#5a2e14', wallTop: '#c98a4e', wallWidth: 90 },
  tunnel: { roof: 'rgba(150,200,235,0.42)', rib: 'rgba(255,255,255,0.55)' },
  bridge: { deck: '#46423d', rail: '#c9c3b8' },
  technical: { surface: '#2c2433' },
};

export function getTheme(id) {
  return THEMES[id] || THEMES.imperial;
}

