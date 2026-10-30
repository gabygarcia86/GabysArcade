/**
 * Race HUD and minimap, drawn on the game canvas in CSS pixels.
 *
 *  top left      lap, position and a compact standings list
 *  top right     race time, current and best lap (Time Trial: PB and ghost gap)
 *  bottom left   speed gauge, boost tank, drift charge
 *  bottom right  minimap generated from the track geometry
 *  center        countdown, GO, lap / position / finish notices, WRONG WAY
 *
 * On touch screens the bottom elements move up out of the thumbs' way.
 */
import { CONFIG } from './config.js';
import { formatTime, ordinal, clamp, TAU } from './utils.js';
import { makeCanvas } from './gfx.js';

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
const MONO = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

function panel(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(4,10,28,0.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(56,214,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(ctx, str, x, y, size, color = '#e8eeff', align = 'left', weight = 800, font = FONT) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export class Minimap {
  constructor(geo, theme) {
    this.geo = geo;
    this.theme = theme;
    this.size = 0;
  }

  /** Panel height for a given width: trimmed to the track's shape, never taller than wide. */
  heightFor(size) {
    const b = this.geo.bounds;
    const pad = 0.08;
    const scale = (size * (1 - pad * 2)) / Math.max(b.w, b.h);
    return Math.min(size, b.h * scale + size * pad * 2);
  }

  /** (Re)renders the track outline when the minimap size changes. */
  prepare(size, dpr) {
    const px = Math.round(size * dpr);
    if (this.px === px) return;
    this.px = px;
    this.size = size;
    const g = this.geo;
    const b = g.bounds;
    const pad = 0.08;
    const pyH = Math.round(this.heightFor(size) * dpr);
    this.scale = (size * dpr * (1 - pad * 2)) / Math.max(b.w, b.h);
    this.ox = (px - b.w * this.scale) / 2 - b.x0 * this.scale;
    this.oy = (pyH - b.h * this.scale) / 2 - b.y0 * this.scale;
    const { c, g: m } = makeCanvas(px, pyH);
    m.lineJoin = 'round';
    m.lineCap = 'round';
    const path = new Path2D();
    for (let k = 0; k <= g.n; k += 2) {
      const i = k % g.n;
      const x = g.x[i] * this.scale + this.ox;
      const y = g.y[i] * this.scale + this.oy;
      if (k === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    path.closePath();
    m.strokeStyle = 'rgba(0,0,0,0.6)';
    m.lineWidth = Math.max(5, 200 * this.scale + 4 * dpr);
    m.stroke(path);
    m.strokeStyle = this.theme.accent;
    m.globalAlpha = 0.35;
    m.lineWidth = Math.max(4, 200 * this.scale + 2 * dpr);
    m.stroke(path);
    m.globalAlpha = 1;
    m.strokeStyle = '#e8eeff';
    m.lineWidth = Math.max(1.5, 2 * dpr);
    m.stroke(path);
    // start line
    const x = g.x[0] * this.scale + this.ox;
    const y = g.y[0] * this.scale + this.oy;
    m.save();
    m.translate(x, y);
    m.rotate(Math.atan2(g.ty[0], g.tx[0]));
    m.fillStyle = '#ffffff';
    m.fillRect(-1.5 * dpr, -6 * dpr, 3 * dpr, 12 * dpr);
    m.restore();
    this.canvas = c;
  }

  draw(ctx, x, y, size, dpr, race, ghost) {
    this.prepare(size, dpr);
    const h = this.heightFor(size);
    panel(ctx, x - 6, y - 6, size + 12, h + 12, 12);
    ctx.drawImage(this.canvas, x, y, size, h);
    const k = this.scale / dpr;
    const ox = this.ox / dpr;
    const oy = this.oy / dpr;
    // probe patrols as small red marks
    for (const hz of race.hazards) {
      if (hz.kind !== 'probe') continue;
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(x + hz.x * k + ox - 2, y + hz.y * k + oy - 2, 4, 4);
    }
    if (ghost && ghost.visible) {
      ctx.fillStyle = 'rgba(200,230,255,0.55)';
      ctx.beginPath();
      ctx.arc(x + ghost.x * k + ox, y + ghost.y * k + oy, 4, 0, TAU);
      ctx.fill();
    }
    const order = race.racers.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const r of order) {
      const px = x + r.x * k + ox;
      const py = y + r.y * k + oy;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(px, py, r.isPlayer ? 5.5 : 4.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = r.isPlayer ? '#ffffff' : 'rgba(0,0,0,0.7)';
      ctx.lineWidth = r.isPlayer ? 2 : 1;
      ctx.stroke();
    }
  }
}

export function drawHud(ctx, rv, W, H, dpr) {
  const race = rv.race;
  const p = race.player;
  const s = clamp(Math.min(W, H) / 720, 0.62, 1.35);
  const m = 14 * s;
  const touch = rv.touchMode;
  ctx.textBaseline = 'alphabetic';

  /* ---- top left: lap + position */
  const lapW = 150 * s;
  panel(ctx, m, m, lapW, race.mode === 'timetrial' ? 62 * s : 108 * s);
  text(ctx, 'LAP', m + 12 * s, m + 22 * s, 13 * s, '#8fa3d9');
  const lapLabel = `${p.finished ? CONFIG.laps : p.displayLap}/${CONFIG.laps}`;
  text(ctx, lapLabel, m + 12 * s, m + 52 * s, 32 * s, '#ffffff', 'left', 900);
  if (race.mode !== 'timetrial') {
    text(ctx, 'POS', m + 12 * s, m + 74 * s, 13 * s, '#8fa3d9');
    const place = p.place;
    const col = place === 1 ? '#ffd34a' : '#ffffff';
    text(ctx, ordinal(place), m + 12 * s, m + 100 * s, 30 * s, col, 'left', 900);
    text(ctx, `/ ${race.racers.length}`, m + 80 * s, m + 100 * s, 16 * s, '#8fa3d9');

    // compact standings under the lap panel
    const list = race.standings();
    let ly = m + 108 * s + 10 * s;
    panel(ctx, m, ly, lapW, (list.length * 20 + 10) * s, 8);
    ly += 19 * s;
    list.forEach((r, i) => {
      ctx.fillStyle = r.color;
      ctx.fillRect(m + 10 * s, ly - 10 * s, 6 * s, 12 * s);
      text(ctx, `${i + 1}`, m + 24 * s, ly, 13 * s, '#8fa3d9', 'left', 800, MONO);
      text(ctx, r.isPlayer ? 'YOU' : r.name, m + 40 * s, ly, 13 * s, r.isPlayer ? '#ffffff' : '#c9d6ff', 'left', r.isPlayer ? 900 : 700);
      ly += 20 * s;
    });
  }

  /* ---- top right: times */
  const tw = 210 * s;
  // clear the mute/pause column (42px buttons, 10px from the edge; not scaled with the HUD)
  const tx = W - tw - 62;
  panel(ctx, tx, m, tw, 92 * s);
  text(ctx, 'TIME', tx + 12 * s, m + 22 * s, 13 * s, '#8fa3d9');
  const raceTime = race.state === 'countdown' ? 0 : p.finished ? p.finishTime : race.time;
  text(ctx, formatTime(raceTime), tx + tw - 12 * s, m + 26 * s, 22 * s, '#ffffff', 'right', 800, MONO);
  const lapNow = race.state === 'countdown' || p.finished ? 0 : race.time - p.lapStart;
  text(ctx, 'LAP', tx + 12 * s, m + 50 * s, 12 * s, '#8fa3d9');
  text(ctx, formatTime(lapNow), tx + tw - 12 * s, m + 50 * s, 15 * s, '#c9d6ff', 'right', 700, MONO);
  const best = Math.min(p.bestLap, rv.recordLap ?? Infinity);
  text(ctx, race.mode === 'timetrial' ? 'RECORD' : 'BEST', tx + 12 * s, m + 74 * s, 12 * s, '#8fa3d9');
  text(ctx, formatTime(race.mode === 'timetrial' ? best : p.bestLap), tx + tw - 12 * s, m + 74 * s, 15 * s, '#ffd34a', 'right', 700, MONO);
  if (race.mode === 'timetrial' && rv.ghostGap != null) {
    const gp = rv.ghostGap;
    panel(ctx, tx, m + 98 * s, tw, 32 * s, 8);
    text(ctx, 'GHOST', tx + 12 * s, m + 120 * s, 12 * s, '#8fa3d9');
    text(ctx, `${gp >= 0 ? '+' : '−'}${Math.abs(gp).toFixed(2)}`, tx + tw - 12 * s, m + 121 * s, 16 * s, gp <= 0 ? '#7dff8a' : '#ff6a6a', 'right', 800, MONO);
  }

  /* ---- bottom left: speed and boost */
  const inset = touch ? rv.touchInset || 0 : 0;
  const gw = 220 * s;
  const gh = 96 * s;
  const gx = m;
  const gy = H - m - gh - (touch ? rv.touchInsetLeft || 0 : 0);
  panel(ctx, gx, gy, gw, gh);
  const ratio = clamp(p.speed / (p.h.topSpeed * p.h.boostSpeed), 0, 1);
  // arc gauge
  const cx = gx + 52 * s;
  const cy = gy + 58 * s;
  const R = 34 * s;
  ctx.lineCap = 'round';
  ctx.lineWidth = 7 * s;
  ctx.strokeStyle = 'rgba(143,163,217,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.8, Math.PI * 2.2);
  ctx.stroke();
  ctx.strokeStyle = p.boosting ? '#ff9a2e' : '#38d6ff';
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * ratio));
  ctx.stroke();
  text(ctx, String(Math.round(p.speed * 0.5)), cx, cy + 6 * s, 22 * s, '#ffffff', 'center', 900, MONO);
  text(ctx, 'SPD', cx, cy + 22 * s, 10 * s, '#8fa3d9', 'center');
  // boost tank
  const bx = gx + 100 * s;
  const by = gy + 24 * s;
  const bw = gw - 112 * s;
  text(ctx, p.boosting ? 'BOOST!' : 'BOOST', bx, by, 12 * s, p.boosting ? '#ff9a2e' : '#8fa3d9');
  const barY = by + 8 * s;
  const barH = 16 * s;
  ctx.fillStyle = 'rgba(143,163,217,0.2)';
  ctx.fillRect(bx, barY, bw, barH);
  const e = p.energy;
  const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  grad.addColorStop(0, p.ship.flameColor);
  grad.addColorStop(1, '#ffffff');
  ctx.fillStyle = e < CONFIG.boost.minToStart && !p.boosting ? '#ff4a5a' : grad;
  ctx.fillRect(bx, barY, bw * e, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, barY, bw, barH);
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = 'rgba(4,10,28,0.7)';
    ctx.fillRect(bx + (bw * i) / 4 - 1, barY, 2, barH);
  }
  // drift charge pips
  const dy = barY + barH + 22 * s;
  text(ctx, 'DRIFT', bx, dy, 11 * s, '#8fa3d9');
  for (let i = 0; i < 3; i++) {
    const on = p.driftTier > i;
    ctx.fillStyle = on ? CONFIG.drift.colors[i] : 'rgba(143,163,217,0.25)';
    ctx.beginPath();
    ctx.arc(bx + 52 * s + i * 18 * s, dy - 4 * s, 5.5 * s, 0, TAU);
    ctx.fill();
  }
  if (p.driftTime > 0 && p.driftTier < 3) {
    const next = CONFIG.drift.tiers[p.driftTier];
    const prev = p.driftTier ? CONFIG.drift.tiers[p.driftTier - 1] : 0;
    const f = clamp((p.driftTime - prev) / (next - prev), 0, 1);
    ctx.strokeStyle = CONFIG.drift.colors[p.driftTier];
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(bx + 52 * s + p.driftTier * 18 * s, dy - 4 * s, 8 * s, -Math.PI / 2, -Math.PI / 2 + TAU * f);
    ctx.stroke();
  }

  /* ---- minimap */
  let ms = clamp(Math.min(W, H) * (touch ? 0.24 : 0.26), 96, 230);
  let mx = W - m - ms - 6 - (touch ? 52 : 0); // clear of the pause/mute column on touch screens
  let my = H - m - rv.minimap.heightFor(ms) - 6 - inset;
  if (touch && H > W) {
    // portrait: tuck it under the time panel, same width, clear of the pedals
    ms = tw - 12;
    mx = tx + 6;
    my = m + (race.mode === 'timetrial' ? 130 : 92) * s + 12;
  }
  rv.minimap.draw(ctx, mx, my, ms, dpr, race, race.ghostPos);

  /* ---- center notices */
  drawCenter(ctx, rv, W, H, s);
}

function drawCenter(ctx, rv, W, H, s) {
  const race = rv.race;
  const p = race.player;
  const cx = W / 2;
  const cy = H * 0.36;
  ctx.textBaseline = 'middle';

  if (race.state === 'countdown') {
    const cd = race.countdown;
    const n = Math.ceil(cd);
    if (n <= CONFIG.race.countdown) {
      const f = cd - Math.floor(cd);
      const scale = 1 + f * 0.6;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.globalAlpha = clamp(f * 2.5, 0, 1);
      text(ctx, String(n), 0, 0, 110 * s, n === 1 ? '#ffd34a' : '#ffffff', 'center', 900);
      ctx.restore();
    } else {
      text(ctx, 'GET READY', cx, cy, 46 * s, '#38d6ff', 'center', 900);
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 8;
    text(ctx, 'Hit the throttle on "1" for a rocket start', cx, H * 0.72, 16 * s, 'rgba(232,238,255,0.95)', 'center', 800);
    ctx.restore();
  }

  for (const msg of rv.messages) {
    const appear = clamp(msg.t / 0.15, 0, 1);
    const fade = clamp((msg.dur - msg.t) / 0.35, 0, 1);
    ctx.save();
    ctx.globalAlpha = appear * fade;
    const y = cy + (msg.slot || 0) * 70 * s + (msg.big ? 0 : 40 * s);
    ctx.translate(cx, y);
    const sc = msg.big ? 1 + (1 - appear) * 0.5 : 1;
    ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 12;
    text(ctx, msg.text, 0, 0, (msg.big ? 76 : 34) * s, msg.color || '#ffffff', 'center', 900);
    if (msg.sub) text(ctx, msg.sub, 0, (msg.big ? 54 : 30) * s, 17 * s, 'rgba(232,238,255,0.9)', 'center', 700);
    ctx.restore();
  }

  if (race.active && !p.finished && p.wrongWay > CONFIG.recovery.wrongWayTime) {
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    if (blink) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 14;
      text(ctx, 'WRONG WAY', cx, H * 0.55, 54 * s, '#ff4a5a', 'center', 900);
      ctx.restore();
    }
  }
  if (race.active && p.needsReset && !p.finished) {
    text(ctx, rv.touchMode ? 'Tap ⟲ to get back on track' : 'Press R to get back on track', cx, H * 0.64, 18 * s, '#ffd34a', 'center', 800);
  }
  ctx.textBaseline = 'alphabetic';
}
