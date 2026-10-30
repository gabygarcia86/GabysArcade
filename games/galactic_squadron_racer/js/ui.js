/**
 * DOM menus: screen switching, the hangar (ship grid, animated preview,
 * stats), the track browser (procedural thumbnails rendered from the real
 * track art), cups, race intro, results, standings, the trophy, settings and
 * the touch-control overlay. Button clicks are forwarded to the game as
 * named actions (data-action attributes).
 */
import { CONFIG } from './config.js';
import { ROSTER, STAT_KEYS, STAT_LABELS, getRosterShip } from './shipRoster.js';
import { TRACKS, getTrack } from './tracks.js';
import { getGeometry } from './trackGeometry.js';
import { TrackRenderer } from './trackRenderer.js';
import { drawShip } from './shipRender.js';
import { getRecord } from './timeTrial.js';
import { formatTime, ordinal, clamp, TAU } from './utils.js';
import { glow } from './gfx.js';

const SCREENS = ['title', 'menu', 'cups', 'ships', 'tracks', 'intro', 'pause', 'results', 'standings', 'champion', 'settings', 'help'];

function shipIcon(canvas, ship, size, heading = -Math.PI / 2) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const spr = ship.getSprite();
  const k = (size * 0.82) / Math.max(spr.w * ship.scale, spr.h * ship.scale * 1.15);
  ctx.save();
  ctx.translate(size / 2, size / 2 - size * 0.04);
  ctx.scale(k, k);
  drawShip(ctx, ship, { x: 0, y: 0, heading, throttle: 0.4, t: 0.3 });
  ctx.restore();
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export class UI {
  constructor(settings, audio) {
    this.settings = settings;
    this.audio = audio;
    this.canvas = this.el('#game');
    this.touchControls = this.el('#touch-controls');
    this.hudButtons = this.el('#hud-buttons');
    this.screens = {};
    for (const id of SCREENS) this.screens[id] = this.el('#screen-' + id);
    this.current = null;
    this.thumbs = new Map();
    this.previews = new Map();
    this.preview = { angle: -Math.PI / 2, auto: true, boost: 0, t: 0, spin: 0 };
    this.trackAnim = 0;
  }

  el(sel) {
    return document.querySelector(sel);
  }

  bind(game) {
    this.game = game;
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'test-boost') return;
      this.audio.unlock();
      game.onAction(action, btn);
    });
    // hold-to-boost in the hangar preview
    const tb = this.el('[data-action="test-boost"]');
    const on = (e) => {
      e.preventDefault();
      this.preview.boosting = true;
      tb.classList.add('active');
      this.audio.play('boost');
    };
    const off = () => {
      this.preview.boosting = false;
      tb.classList.remove('active');
    };
    tb.addEventListener('pointerdown', on);
    tb.addEventListener('pointerup', off);
    tb.addEventListener('pointerleave', off);
    tb.addEventListener('pointercancel', off);

    for (const seg of document.querySelectorAll('[data-seg]')) {
      seg.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-value]');
        if (!b) return;
        this.settings[seg.dataset.seg] = b.dataset.value;
        this.audio.play('tick');
        this.syncSegs();
        this.syncSettings();
        game.saveSettings();
      });
    }

    for (const input of document.querySelectorAll('[data-setting]')) {
      const key = input.dataset.setting;
      const apply = () => {
        const v = input.type === 'checkbox' ? input.checked : input.type === 'range' ? parseFloat(input.value) : input.value;
        this.settings[key] = v;
        this.audio.applySettings();
        this.syncSettings();
        this.syncSegs();
        game.saveSettings();
        if (key === 'touchSteer') {
          this.applyTouchSteer();
          this.insetKey = null;
        }
        if (key === 'effects') game.resize();
      };
      input.addEventListener('input', apply);
      input.addEventListener('change', apply);
    }

    // grids: arrow keys move the selection
    for (const id of ['#ship-grid', '#track-grid', '#cup-list']) {
      this.el(id).addEventListener('keydown', (e) => this.gridKeys(e, id));
    }
    this.syncSettings();
    this.syncSegs();
    this.applyTouchSteer();
  }

  /* ------------------------------------------------------------ screens */

  show(name) {
    for (const [id, el] of Object.entries(this.screens)) el.hidden = id !== name;
    this.current = name;
    const focusable = name && this.screens[name]?.querySelector('.btn.primary, .btn, .menu-card');
    if (focusable && !this.isTouch) {
      try {
        focusable.focus({ preventScroll: true });
      } catch {
        /* focus is optional */
      }
    }
  }

  hideAll() {
    this.show(null);
  }

  setRaceChrome(visible) {
    this.hudButtons.hidden = !visible;
    this.touchControls.hidden = !(visible && this.isTouch);
  }

  setTouchMode(on) {
    this.isTouch = on;
    document.body.classList.toggle('touch', on);
    if (this.game) this.setRaceChrome(this.game.isRacing() || this.game.state === 'intro');
  }

  applyTouchSteer() {
    this.touchControls.classList.toggle('stick-mode', this.settings.touchSteer === 'stick');
  }

  showStick(x, y, dx) {
    const base = this.el('#stick-base');
    const zone = this.el('#stick-zone').getBoundingClientRect();
    base.style.left = `${x - zone.left}px`;
    base.style.top = `${y - zone.top}px`;
    base.classList.add('show');
    this.el('#stick-knob').style.transform = `translateX(${dx}px)`;
  }

  hideStick() {
    this.el('#stick-base')?.classList.remove('show');
  }

  setResetVisible(on) {
    const b = this.el('#btn-reset');
    if (b.hidden === !on) return;
    b.hidden = !on;
  }

  /** Height (CSS px) the touch controls take at the bottom of the screen. */
  touchInset() {
    if (!this.isTouch || this.touchControls.hidden) return 0;
    // measured once per layout: distance from the top of the highest pedal to the bottom
    const key = `${window.innerWidth}x${window.innerHeight}`;
    if (this.insetKey !== key) {
      this.insetKey = key;
      let top = window.innerHeight;
      for (const id of ['#btn-boost', '#btn-accel', '#btn-brake']) top = Math.min(top, this.el(id).getBoundingClientRect().top);
      this.insetValue = Math.max(0, window.innerHeight - top + 6);
      // left side: the stick floats under the thumb, so only clear the ◀ ▶ buttons when they're used
      const lb = this.el('#btn-left').getBoundingClientRect();
      this.insetLeft = this.settings.touchSteer === 'buttons' && lb.height ? window.innerHeight - lb.top + 6 : Math.min(this.insetValue, 110);
      // on skinny screens the brake reaches into the left half: clear it too
      const br = this.el('#btn-brake').getBoundingClientRect();
      if (br.height && br.left < 240) this.insetLeft = Math.max(this.insetLeft, window.innerHeight - br.top + 6);
    }
    return this.insetValue;
  }

  touchInsetLeft() {
    this.touchInset();
    return this.isTouch && !this.touchControls.hidden ? this.insetLeft : 0;
  }

  syncMute() {
    for (const b of document.querySelectorAll('[data-action="mute"]')) {
      b.classList.toggle('is-muted', this.settings.muted);
      b.setAttribute('aria-pressed', String(this.settings.muted));
    }
  }

  syncSettings() {
    for (const input of document.querySelectorAll('[data-setting]')) {
      const v = this.settings[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = !!v;
      else input.value = String(v);
    }
    this.syncMute();
  }

  syncSegs() {
    for (const seg of document.querySelectorAll('[data-seg]')) {
      const v = this.settings[seg.dataset.seg];
      for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.value === v));
    }
  }

  gridKeys(e, id) {
    const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -100, ArrowDown: 100 };
    if (!(e.key in keys)) return;
    const items = [...this.el(id).children];
    const idx = items.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    let step = keys[e.key];
    if (Math.abs(step) === 100) {
      const top = items[0].offsetTop;
      const perRow = items.filter((x) => x.offsetTop === top).length || 1;
      step = Math.sign(step) * perRow;
    }
    const next = items[clamp(idx + step, 0, items.length - 1)];
    next.focus();
    next.click();
  }

  /* ------------------------------------------------------------- cups */

  buildCups(selectedId) {
    const list = this.el('#cup-list');
    list.textContent = '';
    for (const cup of CONFIG.cups) {
      const b = document.createElement('button');
      b.className = 'cup';
      b.setAttribute('role', 'radio');
      b.dataset.action = 'pick-cup';
      b.dataset.id = cup.id;
      b.setAttribute('aria-checked', String(cup.id === selectedId));
      const tracks = cup.tracks ? cup.tracks.map((t) => getTrack(t).name) : ['4 random tracks'];
      b.innerHTML = `<b>${cup.name.toUpperCase()}</b><small>${cup.desc}</small><div class="chips">${tracks.map((n) => `<span class="chip">${n}</span>`).join('')}</div>`;
      list.appendChild(b);
    }
  }

  selectCup(id) {
    for (const b of this.el('#cup-list').children) b.setAttribute('aria-checked', String(b.dataset.id === id));
  }

  /* ------------------------------------------------------------- ships */

  buildShips(selectedId) {
    const grid = this.el('#ship-grid');
    if (!grid.children.length) {
      for (const ship of ROSTER) {
        const b = document.createElement('button');
        b.className = 'ship-tile';
        b.setAttribute('role', 'radio');
        b.dataset.action = 'pick-ship';
        b.dataset.id = ship.id;
        const c = document.createElement('canvas');
        shipIcon(c, ship, 64);
        const name = document.createElement('span');
        name.textContent = ship.name;
        const cls = document.createElement('small');
        cls.textContent = ship.cls.toUpperCase();
        b.append(c, name, cls);
        grid.appendChild(b);
      }
    }
    this.selectShip(selectedId);
  }

  selectShip(id) {
    const ship = getRosterShip(id);
    for (const b of this.el('#ship-grid').children) b.setAttribute('aria-checked', String(b.dataset.id === ship.id));
    this.el('#ship-name').textContent = ship.name;
    this.el('#ship-class').textContent = ship.cls + (ship.kind === 'enemy' ? ' · ENEMY FLEET' : ship.kind === 'ally' ? ' · ALLY' : '');
    this.el('#ship-desc').textContent = ship.desc;
    const dl = this.el('#ship-stats');
    dl.textContent = '';
    for (const k of STAT_KEYS) {
      const dt = document.createElement('dt');
      dt.textContent = STAT_LABELS[k];
      const dd = document.createElement('dd');
      const v = ship.stats[k];
      for (let i = 1; i <= 10; i++) {
        const pip = document.createElement('span');
        pip.className = 'pip' + (i <= v ? ' on' : '') + (i <= v && v >= 8 ? ' hi' : '');
        dd.appendChild(pip);
      }
      dd.setAttribute('aria-label', `${STAT_LABELS[k]} ${v} of 10`);
      dl.append(dt, dd);
    }
    this.previewShip = ship;
    this.preview.spin = 0.6;
  }

  drawShipPreview(dt) {
    const c = this.el('#ship-preview');
    const ship = this.previewShip;
    if (!ship || this.current !== 'ships') return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const p = this.preview;
    p.t += dt;
    if (p.auto) p.angle += dt * 0.6;
    p.boost += ((p.boosting ? 1 : 0) - p.boost) * Math.min(1, dt * 8);
    p.spin = Math.max(0, p.spin - dt);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // hangar floor: grid and moving speed streaks when boosting
    ctx.strokeStyle = 'rgba(56,214,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = ((p.t * 40) % 32) - 32; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    glow(ctx, ship.flameColor, W / 2, H / 2, Math.min(W, H) * 0.9, 0.25 + p.boost * 0.3);
    const spr = ship.getSprite();
    const k = (Math.min(W, H) * 0.56) / Math.max(spr.w * ship.scale, spr.h * ship.scale * 1.5);
    const bank = Math.sin(p.t * 1.3) * 0.5;
    ctx.save();
    ctx.translate(W / 2, H / 2 - H * 0.03);
    ctx.scale(k, k);
    // pop when a new ship is picked
    const pop = 1 + p.spin * 0.25 * Math.sin(p.spin * 12);
    ctx.scale(pop, pop);
    drawShip(ctx, ship, { x: 0, y: 0, heading: p.angle, bank, throttle: 0.6 + 0.4 * Math.sin(p.t * 3), boost: p.boost, t: p.t, shadow: 10 });
    ctx.restore();
  }

  rotatePreview(dir) {
    this.preview.auto = false;
    this.preview.angle += dir * (Math.PI / 4);
    this.el('[data-action="rot-auto"]').setAttribute('aria-pressed', 'false');
  }

  toggleAutoRotate() {
    this.preview.auto = !this.preview.auto;
    this.el('[data-action="rot-auto"]').setAttribute('aria-pressed', String(this.preview.auto));
  }

  /* ------------------------------------------------------------- tracks */

  buildTracks(mode, selectedId) {
    this.trackMode = mode;
    this.el('#tracks-title').textContent = mode === 'timetrial' ? 'TIME TRIAL · CHOOSE TRACK' : 'QUICK RACE · CHOOSE TRACK';
    this.el('#track-diff-row').hidden = mode === 'timetrial';
    this.el('[data-action="track-confirm"]').textContent = mode === 'timetrial' ? 'START TRIAL ›' : 'RACE ›';
    const grid = this.el('#track-grid');
    if (!grid.children.length) {
      for (const t of TRACKS) {
        const b = document.createElement('button');
        b.className = 'track-tile';
        b.setAttribute('role', 'radio');
        b.dataset.action = 'pick-track';
        b.dataset.id = t.id;
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 200;
        const name = document.createElement('span');
        name.className = 'tt-name';
        name.textContent = `${String(t.num).padStart(2, '0')} · ${t.name.toUpperCase()}`;
        const meta = document.createElement('span');
        meta.className = 'tt-meta';
        meta.innerHTML = `<span class="stars">${stars(t.difficulty)}</span><span class="rec"></span>`;
        b.append(c, name, meta);
        grid.appendChild(b);
      }
      this.queueThumbs();
    }
    for (const b of grid.children) {
      const rec = getRecord(b.dataset.id);
      b.querySelector('.rec').textContent = rec?.bestLap ? `⏱ ${formatTime(rec.bestLap)}` : '';
    }
    this.selectTrack(selectedId);
  }

  /** Renders thumbnails one at a time so the menu stays responsive. */
  queueThumbs() {
    const tiles = [...this.el('#track-grid').children];
    let i = 0;
    const next = () => {
      if (i >= tiles.length) return;
      const tile = tiles[i++];
      const c = tile.querySelector('canvas');
      try {
        this.renderThumb(tile.dataset.id, c);
      } catch (err) {
        console.warn('thumbnail failed', err);
      }
      setTimeout(next, 16);
    };
    setTimeout(next, 30);
  }

  renderThumb(id, canvas) {
    const track = getTrack(id);
    const r = new TrackRenderer(track, getGeometry(track), canvas.getContext('2d'), { lowRes: true });
    r.renderOverview(canvas);
    this.thumbs.set(id, canvas);
  }

  selectTrack(id) {
    const t = getTrack(id);
    this.selectedTrack = t;
    for (const b of this.el('#track-grid').children) b.setAttribute('aria-checked', String(b.dataset.id === t.id));
    this.el('#track-name').textContent = `${String(t.num).padStart(2, '0')} · ${t.name}`;
    const geo = getGeometry(t);
    this.el('#track-meta').innerHTML = `<span class="stars">${stars(t.difficulty)}</span> · ${(geo.length / 1000).toFixed(1)} km · ${CONFIG.laps} laps`;
    this.el('#track-desc').textContent = t.desc;
    const rec = getRecord(t.id);
    this.el('#track-record').textContent = rec ? `Best lap ${formatTime(rec.bestLap)} · Best race ${formatTime(rec.bestTotal)}` : this.trackMode === 'timetrial' ? 'No record yet: set the first ghost.' : '';
    this.trackAnim = 0;
  }

  /** Big preview: the overview art plus a marker lapping the circuit. */
  drawTrackPreview(dt) {
    if (this.current !== 'tracks' || !this.selectedTrack) return;
    const c = this.el('#track-preview');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (!W || !H) return;
    const t = this.selectedTrack;
    let pv = this.previews.get(t.id);
    const pw = Math.round(W * dpr);
    const ph = Math.round(H * dpr);
    if (!pv || pv.w !== pw) {
      const off = document.createElement('canvas');
      off.width = pw;
      off.height = ph;
      const r = new TrackRenderer(t, getGeometry(t), off.getContext('2d'), { lowRes: true });
      const info = r.renderOverview(off);
      pv = { canvas: off, w: pw, info };
      this.previews.set(t.id, pv);
    }
    if (c.width !== pw || c.height !== ph) {
      c.width = pw;
      c.height = ph;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pv.canvas, 0, 0);
    const geo = getGeometry(t);
    this.trackAnim += dt;
    const { scale, cam } = pv.info;
    const f = {};
    for (let k = 0; k < 4; k++) {
      const s = (this.trackAnim * 2400 + k * 160) % geo.length;
      geo.at(s, f);
      const x = pw / 2 + (f.x - cam.x) * scale;
      const y = ph / 2 + (f.y - cam.y) * scale;
      glow(ctx, k === 0 ? '#38d6ff' : CONFIG.ai.colors[k - 1], x, y, 26 * dpr, 1 - k * 0.15);
    }
  }

  /* ------------------------------------------------------------- intro */

  showIntro(race, kicker) {
    const t = race.track;
    this.el('#intro-kicker').textContent = kicker;
    this.el('#intro-track').textContent = `${String(t.num).padStart(2, '0')} · ${t.name.toUpperCase()}`;
    this.el('#intro-desc').textContent = t.desc;
    const lineup = this.el('#intro-lineup');
    lineup.textContent = '';
    const grid = race.racers.slice().sort((a, b) => a.slot - b.slot);
    for (const r of grid) {
      const card = document.createElement('div');
      card.className = 'racer-card';
      card.style.setProperty('--c', r.color);
      const c = document.createElement('canvas');
      shipIcon(c, r.ship, 48);
      const info = document.createElement('div');
      info.innerHTML = `<b>${r.slot + 1}. ${r.isPlayer ? 'YOU' : r.name}</b><small>${r.ship.name} · ${r.ship.cls}</small>`;
      card.append(c, info);
      lineup.appendChild(card);
    }
    if (race.mode === 'timetrial') {
      const g = document.createElement('div');
      g.className = 'racer-card';
      g.style.setProperty('--c', '#c9d6ff');
      const rec = getRecord(t.id);
      g.innerHTML = `<div><b>GHOST</b><small>${race.ghost ? `Best lap ${formatTime(rec?.bestLap)}` : 'No ghost yet: set a lap to create one'}</small></div>`;
      lineup.appendChild(g);
    }
    this.show('intro');
  }

  /* ------------------------------------------------------------- results */

  showResults(info) {
    const { race, results, mode, gp, awarded, tt } = info;
    const me = results.find((r) => r.isPlayer);
    const title = this.el('#results-title');
    const sub = this.el('#results-sub');
    const sum = this.el('#results-summary');
    const table = this.el('#results-table');
    sum.textContent = '';
    if (mode === 'timetrial') {
      title.textContent = 'TIME TRIAL';
      sub.textContent = race.track.name.toUpperCase();
      sum.append(
        this.stat('TOTAL', formatTime(me.time), tt.newTotal ? 'RECORD' : ''),
        this.stat('BEST LAP', formatTime(me.bestLap), tt.newLap ? 'RECORD' : ''),
        this.stat('PERSONAL BEST', formatTime(Math.min(me.bestLap, tt.prevLap ?? Infinity))),
      );
      table.innerHTML = `<tr><th>LAP</th><th class="num">TIME</th></tr>` + me.lapTimes.map((t, i) => `<tr class="${t === me.bestLap ? 'me' : ''}"><td>LAP ${i + 1}</td><td class="num">${formatTime(t)}</td></tr>`).join('');
    } else {
      title.textContent = me.place === 1 ? 'VICTORY!' : `${ordinal(me.place)} PLACE`;
      sub.textContent = (gp ? `${gp.cup.name.toUpperCase()} · RACE ${gp.round} OF ${gp.trackIds.length} · ` : '') + race.track.name.toUpperCase();
      sum.append(this.stat('POSITION', ordinal(me.place), '', me.place === 1), this.stat('TOTAL TIME', formatTime(me.time)), this.stat('BEST LAP', formatTime(me.bestLap)));
      if (gp) sum.append(this.stat('POINTS', `+${awarded.find((a) => a.name === 'YOU')?.points ?? 0}`));
      const rows = results.map((r) => {
        const pts = gp ? `<td class="num">+${awarded.find((a) => a.name === r.name)?.points ?? 0}</td>` : '';
        return `<tr class="${r.isPlayer ? 'me' : ''}"><td class="pos">${ordinal(r.place)}</td><td><span class="dot" style="background:${r.color}"></span>${r.isPlayer ? 'YOU' : r.name}</td><td class="hide-sm">${r.shipName}</td><td class="num">${formatTime(r.time)}${r.estimated ? '*' : ''}</td><td class="num hide-sm">${formatTime(r.bestLap)}</td>${pts}</tr>`;
      });
      table.innerHTML = `<tr><th>POS</th><th>RACER</th><th class="hide-sm">SHIP</th><th class="num">TIME</th><th class="num hide-sm">BEST LAP</th>${gp ? '<th class="num">PTS</th>' : ''}</tr>` + rows.join('');
      if (results.some((r) => r.estimated)) table.innerHTML += `<tr><td colspan="6" class="note">* still racing: projected from their pace</td></tr>`;
    }
    const btns = this.el('#results-buttons');
    btns.querySelector('[data-action="restart"]').hidden = !!gp;
    btns.querySelector('[data-action="change-track"]').hidden = !!gp;
    btns.querySelector('[data-action="gp-standings"]').hidden = !gp;
    btns.querySelector('[data-action="restart"]').classList.toggle('primary', !gp);
    this.show('results');
  }

  stat(label, value, badge = '', hl = false) {
    const d = document.createElement('div');
    d.className = 'stat' + (hl || badge ? ' hl' : '');
    d.innerHTML = `<small>${label}</small><b>${value}${badge ? `<span class="badge">${badge}</span>` : ''}</b>`;
    return d;
  }

  standingsTable(gp) {
    const order = gp.standings();
    const head = `<tr><th>POS</th><th>DRIVER</th><th class="hide-sm">SHIP</th>${gp.trackIds.map((_, i) => `<th class="num hide-sm">R${i + 1}</th>`).join('')}<th class="num">PTS</th></tr>`;
    const rows = order.map((d, i) => {
      const per = gp.trackIds.map((_, k) => `<td class="num hide-sm">${d.results[k] ? ordinal(d.results[k].place) : '–'}</td>`).join('');
      return `<tr class="${d.isPlayer ? 'me' : ''}"><td class="pos">${ordinal(i + 1)}</td><td><span class="dot" style="background:${d.color}"></span>${d.name}</td><td class="hide-sm">${getRosterShip(d.shipId).name}</td>${per}<td class="num"><b>${d.points}</b></td></tr>`;
    });
    return head + rows.join('');
  }

  showStandings(gp) {
    this.el('#standings-sub').textContent = `${gp.cup.name.toUpperCase()} · AFTER RACE ${gp.round} OF ${gp.trackIds.length}`;
    this.el('#standings-table').innerHTML = this.standingsTable(gp);
    const next = this.el('[data-action="gp-next"]');
    next.textContent = gp.done ? 'FINAL RESULTS ›' : `NEXT: ${getTrack(gp.trackId).name.toUpperCase()} ›`;
    this.show('standings');
  }

  showChampion(gp) {
    const order = gp.standings();
    const winner = order[0];
    const sum = gp.playerSummary();
    this.championWon = winner.isPlayer;
    this.el('#champ-title').textContent = winner.isPlayer ? 'CHAMPION!' : `${ordinal(sum.position)} OVERALL`;
    this.el('#champ-sub').textContent = `${gp.cup.name.toUpperCase()} · WINNER: ${winner.isPlayer ? 'YOU' : winner.name} (${getRosterShip(winner.shipId).name})`;
    const box = this.el('#champ-summary');
    box.textContent = '';
    box.append(
      this.stat('POINTS', String(sum.points), '', true),
      this.stat('WINS', String(sum.wins)),
      this.stat('PODIUMS', String(sum.podiums)),
      this.stat('AVG FINISH', sum.avgPlace.toFixed(1)),
      this.stat('BEST LAP', formatTime(sum.bestLap)),
    );
    this.el('#champ-table').innerHTML = this.standingsTable(gp);
    this.trophyT = 0;
    this.show('champion');
  }

  drawTrophy(dt) {
    if (this.current !== 'champion') return;
    const c = this.el('#trophy');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = c.clientWidth;
    if (!S) return;
    if (c.width !== Math.round(S * dpr)) {
      c.width = c.height = Math.round(S * dpr);
    }
    this.trophyT = (this.trophyT || 0) + dt;
    const t = this.trophyT;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S, S);
    const gold = this.championWon;
    const main = gold ? '#ffd34a' : '#c9d6ff';
    const dark = gold ? '#a86a10' : '#6a7aa0';
    // rays
    ctx.save();
    ctx.translate(S / 2, S * 0.45);
    ctx.rotate(t * 0.3);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.fillStyle = gold ? 'rgba(255,211,74,0.08)' : 'rgba(160,200,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(S * 0.6, -S * 0.08);
      ctx.lineTo(S * 0.6, S * 0.08);
      ctx.fill();
    }
    ctx.restore();
    // the cup rises in
    const rise = Math.min(1, t / 0.8);
    const e = 1 - (1 - rise) ** 3;
    ctx.save();
    ctx.translate(S / 2, S * 0.5 + (1 - e) * S * 0.4);
    ctx.globalAlpha = e;
    const k = S / 260;
    ctx.scale(k, k);
    const grad = ctx.createLinearGradient(-70, 0, 70, 0);
    grad.addColorStop(0, dark);
    grad.addColorStop(0.45, main);
    grad.addColorStop(0.55, '#ffffff');
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 3;
    // bowl
    ctx.beginPath();
    ctx.moveTo(-62, -80);
    ctx.lineTo(62, -80);
    ctx.quadraticCurveTo(60, 0, 0, 12);
    ctx.quadraticCurveTo(-60, 0, -62, -80);
    ctx.fill();
    ctx.stroke();
    // handles
    ctx.lineWidth = 9;
    ctx.strokeStyle = main;
    ctx.beginPath();
    ctx.arc(-66, -52, 22, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(66, -52, 22, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    // stem and base
    ctx.fillStyle = grad;
    ctx.fillRect(-10, 10, 20, 34);
    ctx.fillRect(-42, 44, 84, 16);
    ctx.fillRect(-54, 60, 108, 20);
    ctx.fillStyle = dark;
    ctx.fillRect(-30, 64, 60, 12);
    // star emblem
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const r = i % 2 ? 8 : 18;
      ctx.lineTo(Math.cos(a) * r, -44 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    // shine sweep, clipped to the bowl
    const sw = ((t * 0.6) % 1.6) - 0.3;
    ctx.beginPath();
    ctx.moveTo(-62, -80);
    ctx.lineTo(62, -80);
    ctx.quadraticCurveTo(60, 0, 0, 12);
    ctx.quadraticCurveTo(-60, 0, -62, -80);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-70 + sw * 140, -84);
    ctx.lineTo(-50 + sw * 140, -84);
    ctx.lineTo(-80 + sw * 140, 20);
    ctx.lineTo(-100 + sw * 140, 20);
    ctx.fill();
    ctx.restore();
    // sparkles
    for (let i = 0; i < 10; i++) {
      const a = i * 2.4 + t * 0.7;
      const r = S * (0.3 + 0.12 * Math.sin(t * 1.3 + i));
      const tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.7);
      glow(ctx, gold ? '#ffe79a' : '#bfe8ff', S / 2 + Math.cos(a) * r, S * 0.45 + Math.sin(a) * r * 0.8, 18 * tw + 4, tw);
    }
  }

  tick(dt) {
    this.drawShipPreview(dt);
    this.drawTrackPreview(dt);
    this.drawTrophy(dt);
  }
}
