// Menus, setup screens, HUD, results, leaderboard and settings. Screens are rendered as HTML
// strings into #screens; buttons carry data-action attributes handled by one delegated listener.
import {
  SKIS, skiById, CUPS, DIFFICULTY, CHALLENGES, ACHIEVEMENTS, WEATHERS, MPH, SHOWDOWN_SECONDS, TRICKS,
} from './data.js';
import { ENVIRONMENTS, RACE_ENVS, ALL_ENVS } from './environments.js';
import { formatTime, ordinal } from './racing.js';
import { ACTIONS, keyLabel } from './input.js';
import { showCharacter, showGarage, statBars } from './customization.js';
import { fetchTop, submitScore, explain, cleanName, loadName, saveName, NAME_MAX } from './leaderboard.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString();
const COURSE_PRICE = 2000;

export class UI {
  constructor(app) {
    this.app = app;
    this.root = document.getElementById('screens');
    this.hudEl = document.getElementById('hud');
    this.touchEl = document.getElementById('touch');
    this.toastsEl = document.getElementById('toasts');
    this.handlers = null;
    this.current = null;
    this.hudT = 0;
    this.mapT = 0;
    this.fpsT = 0;
    this.frames = 0;
    const $ = (id) => document.getElementById(id);
    this.h = {
      pos: $('hud-pos'), posOf: $('hud-pos-of'), lap: $('hud-lap'), time: $('hud-time'), best: $('hud-best'), cp: $('hud-cp'),
      score: $('hud-score'), hi: $('hud-hiscore'), timer: $('hud-timer'), timerCard: $('hud-timer-card'), speed: $('hud-speed'),
      boost: $('hud-boost'), trick: $('hud-trick'), combo: $('hud-combo'), msgs: $('hud-messages'), countdown: $('hud-countdown'),
      fps: $('hud-fps'), map: $('minimap'), speedo: $('speedo-canvas'), arrow: $('hud-cp-arrow'), envName: $('hud-env-name'),
      shells: $('hud-shells'), freeScore: $('hud-free-score'), challenge: $('hud-challenge'), challengeText: $('hud-challenge-text'),
    };
    this.warnEl = document.createElement('div');
    this.warnEl.className = 'hud-warn';
    this.hudEl.appendChild(this.warnEl);
    this.mapCtx = this.h.map.getContext('2d');
    this.speedoCtx = this.h.speedo.getContext('2d');

    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || !this.handlers) return;
      const action = el.dataset.action;
      if (el.disabled) return;
      this.app.audio.click();
      if (action === 'back' && this.handlers.back) { this.pendingBuy = null; this.handlers.back(); return; }
      if (this.handlers.onAction) this.handlers.onAction(action, el.dataset.value, el, e);
    });
    this.root.addEventListener('input', (e) => {
      const el = e.target.closest('[data-input]');
      if (el && this.handlers && this.handlers.onInput) this.handlers.onInput(el.dataset.input, el.type === 'checkbox' ? el.checked : el.value, el);
    });
    this.root.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (el && this.handlers && this.handlers.onChange) this.handlers.onChange(el.dataset.change, el.type === 'checkbox' ? el.checked : el.value, el);
    });
    this.root.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.handlers && this.handlers.onSubmit) this.handlers.onSubmit(e.target);
    });
    document.getElementById('pause-btn').addEventListener('click', () => app.pause());
    // Esc / Backspace go back in menus.
    window.addEventListener('keydown', (e) => {
      if (app.session && !app.session.over && !app.session.paused) return;
      if (e.code === 'Escape' && this.handlers && this.handlers.back && !app.input.capture) {
        if (app.session && app.session.paused) return;
        e.preventDefault();
        this.handlers.back();
      }
    });
  }

  coinBadge() {
    return `<span class="coins" title="Paradise Coins">🪙 <b>${fmt(this.app.save.coins)}</b></span>`;
  }

  // Renders a screen. opts: { onAction, onInput, onChange, onSubmit, back, showroom: 'ski'|'rider', cls }
  screen(name, html, opts = {}) {
    // Redrawing the same screen (after picking a colour, a tab, a part...) keeps each
    // scrolling area where it was, instead of jumping back to the top.
    const scrollers = ['.screen', '.side-panel', '.panel-body'];
    const kept = name === this.current
      ? scrollers.map((sel) => { const el = this.root.querySelector(sel); return el ? el.scrollTop : 0; })
      : null;
    this.current = name;
    this.handlers = opts;
    this.root.innerHTML = `<div class="screen screen-${name}${opts.showroom ? ' showroom-screen' : ''}${opts.cls ? ' ' + opts.cls : ''}">${html}</div>`;
    if (kept) {
      scrollers.forEach((sel, i) => {
        const el = this.root.querySelector(sel);
        if (el && kept[i]) el.scrollTop = kept[i];
      });
    }
    this.app.setShowroom(opts.showroom || null);
    const first = this.root.querySelector('[autofocus]');
    if (first) first.focus();
  }

  clear() {
    this.root.innerHTML = '';
    this.handlers = null;
    this.current = null;
    this.app.setShowroom(null);
  }

  toast(text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    this.toastsEl.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3200);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild.remove();
  }

  // ---------------------------------------------------------------- Splash and main menu
  showSplash(onStart) {
    this.screen('splash', `
      <div class="splash">
        <h1 class="logo">JET SKI<span>PARADISE</span></h1>
        <p class="tagline">RIDE THE WAVES. OWN THE OCEAN.</p>
        <button type="button" class="btn big pulse" data-action="start" autofocus>Tap to start</button>
        <p class="hint">${this.app.save.settings.fullscreen ? 'The game will go full screen. ' : ''}Best with sound on.</p>
      </div>`, { onAction: (a) => { if (a === 'start') onStart(); } });
  }

  showMainMenu() {
    const app = this.app;
    app.ensureAttract();
    app.audio.playMusic('menu');
    const d = app.save.data;
    this.screen('menu', `
      <div class="menu-wrap">
        <div class="menu-top">
          <a class="arcade-link" href="../../index.html">‹ Gaby's Arcade</a>
          ${this.coinBadge()}
        </div>
        <h1 class="logo small">JET SKI<span>PARADISE</span></h1>
        <p class="tagline">RIDE THE WAVES. OWN THE OCEAN.</p>
        <nav class="main-nav">
          <button type="button" class="btn big" data-action="play" autofocus>Play<small>Championship</small></button>
          <button type="button" class="btn" data-action="modes">Game Modes</button>
          <button type="button" class="btn" data-action="character">Character</button>
          <button type="button" class="btn" data-action="garage">Jet Ski Garage</button>
          <button type="button" class="btn" data-action="courses">Courses</button>
          <button type="button" class="btn" data-action="achievements">Achievements</button>
          <button type="button" class="btn gold" data-action="leaderboard">Leaderboard</button>
          <button type="button" class="btn" data-action="settings">Settings</button>
        </nav>
        <p class="menu-foot">Riding the <b>${esc(skiById(d.skis.selected).name)}</b> · ${Object.keys(d.achievements).length}/${ACHIEVEMENTS.length} achievements</p>
      </div>`, {
      onAction: (a) => {
        const back = () => this.showMainMenu();
        if (a === 'play') this.showChampionship(back);
        if (a === 'modes') this.showModes(back);
        if (a === 'character') showCharacter(this, () => { app.refreshAttract(); back(); });
        if (a === 'garage') showGarage(this, () => { app.refreshAttract(); back(); });
        if (a === 'courses') this.showCourses(back);
        if (a === 'achievements') this.showAchievements(back);
        if (a === 'leaderboard') this.showLeaderboard(back);
        if (a === 'settings') this.showSettings(back);
      },
    });
  }

  panel(title, body, opts = {}) {
    return `<div class="panel${opts.wide ? ' wide' : ''}">
      <header class="panel-head"><button type="button" class="back" data-action="back">‹ Back</button><h2>${title}</h2>${this.coinBadge()}</header>
      <div class="panel-body">${body}</div>
      ${opts.foot ? `<footer class="panel-foot">${opts.foot}</footer>` : ''}
    </div>`;
  }

  // ---------------------------------------------------------------- Game modes
  showModes(back) {
    const modes = [
      ['championship', '🏆', 'Championship', 'Three cups of 3-lap races against 5 rivals. Earn points, trophies and new courses.'],
      ['quick', '🏁', 'Quick Race', 'Pick any unlocked course, laps, weather and difficulty.'],
      ['timetrial', '⏱️', 'Time Trial', 'Beat the clock and your own ghost. Earn medals.'],
      ['freestyle', '🤸', 'Freestyle Stunts', 'Stunt Showdown, endless practice and stunt challenges.'],
      ['freeride', '🌴', 'Free Ride', 'No timer, no rivals. Explore, find shells and hidden spots.'],
    ];
    this.screen('modes', this.panel('Game Modes', `<div class="mode-grid">${modes.map(([id, icon, name, desc]) => `
      <button type="button" class="mode-card" data-action="${id}"><span class="mode-icon">${icon}</span><b>${name}</b><small>${desc}</small></button>`).join('')}</div>`, { wide: true }), {
      back,
      onAction: (a) => {
        const me = () => this.showModes(back);
        if (a === 'championship') this.showChampionship(me);
        if (a === 'quick') this.showRaceSetup('quick', me);
        if (a === 'timetrial') this.showRaceSetup('timetrial', me);
        if (a === 'freestyle') this.showFreestyle(me);
        if (a === 'freeride') this.showFreeRide(me);
      },
    });
  }

  envPicker(list, current, unlocked) {
    return `<div class="env-grid">${list.map((id) => {
      const e = ENVIRONMENTS[id];
      const open = unlocked.includes(id);
      return `<button type="button" class="env-card env-${id}${id === current ? ' on' : ''}${open ? '' : ' locked'}" data-action="env" data-value="${id}"${open ? '' : ' disabled'}>
        <b>${esc(e.name)}</b><small>${open ? esc(e.water) : '🔒 Locked'}</small></button>`;
    }).join('')}</div>`;
  }

  skiPicker(current) {
    const d = this.app.save.data;
    return `<div class="chips">${d.skis.owned.map((id) => `<button type="button" class="chip${id === current ? ' on' : ''}" data-action="ski" data-value="${id}">${esc(skiById(id).name)}</button>`).join('')}</div>`;
  }

  weatherPicker(current) {
    const opts = [['default', 'Course default'], ...Object.entries(WEATHERS).map(([k, v]) => [k, v.name])];
    return `<div class="chips">${opts.map(([k, n]) => `<button type="button" class="chip${k === current ? ' on' : ''}" data-action="weather" data-value="${k}">${n}</button>`).join('')}</div>`;
  }

  showRaceSetup(mode, back) {
    const save = this.app.save;
    const d = save.data;
    const last = d.last;
    const cfg = {
      mode, env: d.unlockedCourses.includes(last.env) ? last.env : 'paradise', laps: last.laps || 3,
      difficulty: last.difficulty || 'medium', weather: last.weather || 'default', skiId: d.skis.selected, ghost: true,
    };
    const render = () => {
      const rec = d.records[cfg.env] || {};
      const isTT = mode === 'timetrial';
      const body = `
        <div class="opt-group"><h4>Course</h4>${this.envPicker(RACE_ENVS, cfg.env, d.unlockedCourses)}</div>
        <p class="env-desc">${esc(ENVIRONMENTS[cfg.env].desc)}</p>
        <div class="opt-row">
          ${isTT ? `<div class="opt-group"><h4>Ghost</h4><div class="chips"><button type="button" class="chip${cfg.ghost ? ' on' : ''}" data-action="ghost" data-value="1">On</button><button type="button" class="chip${cfg.ghost ? '' : ' on'}" data-action="ghost" data-value="0">Off</button></div><p class="tiny">${rec.bestTT ? `Best ${formatTime(rec.bestTT)} ${rec.medal ? medalIcon(rec.medal) : ''}` : 'No ghost yet: set a time first.'}</p></div>`
          : `<div class="opt-group"><h4>Laps</h4><div class="chips">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip${n === cfg.laps ? ' on' : ''}" data-action="laps" data-value="${n}">${n}</button>`).join('')}</div></div>
             <div class="opt-group"><h4>Difficulty</h4><div class="chips">${Object.entries(DIFFICULTY).map(([k, v]) => `<button type="button" class="chip${k === cfg.difficulty ? ' on' : ''}" data-action="diff" data-value="${k}">${v.name}</button>`).join('')}</div></div>`}
        </div>
        <div class="opt-group"><h4>Weather</h4>${this.weatherPicker(cfg.weather)}</div>
        <div class="opt-group"><h4>Jet ski</h4>${this.skiPicker(cfg.skiId)}</div>
        <p class="tiny">Best lap here: ${formatTime(rec.bestLap)}${isTT ? '' : ` · Best race: ${formatTime(rec.bestRace)}`}</p>`;
      this.screen('setup', this.panel(mode === 'quick' ? 'Quick Race' : 'Time Trial', body, { wide: true, foot: '<button type="button" class="btn big" data-action="start">Start</button>' }), {
        back,
        onAction: (a, v) => {
          if (a === 'env') cfg.env = v;
          if (a === 'laps') cfg.laps = Number(v);
          if (a === 'diff') cfg.difficulty = v;
          if (a === 'weather') cfg.weather = v;
          if (a === 'ski') cfg.skiId = v;
          if (a === 'ghost') cfg.ghost = v === '1';
          if (a === 'start') {
            Object.assign(d.last, { env: cfg.env, laps: cfg.laps, difficulty: cfg.difficulty, weather: cfg.weather });
            d.skis.selected = cfg.skiId;
            save.save();
            this.app.startSession({ ...cfg, laps: isTT ? 3 : cfg.laps });
            return;
          }
          render();
        },
      });
    };
    render();
  }

  showChampionship(back) {
    const save = this.app.save;
    const d = save.data;
    let diff = d.last.difficulty || 'medium';
    const unlocked = (cup) => !cup.unlock || d.cups[cup.id]?.unlocked || d.cups[cup.unlock]?.best <= 3;
    const render = () => {
      const cards = CUPS.map((cup) => {
        const st = d.cups[cup.id] || {};
        const open = unlocked(cup);
        const run = st.run;
        const status = !open ? `🔒 Finish the ${CUPS.find((c) => c.id === cup.unlock).name} on the podium`
          : run ? `In progress: race ${run.raceIndex + 1} of ${cup.races.length}` : st.trophy ? `${medalIcon(st.trophy)} Best: ${ordinal(st.best)}` : 'Not started';
        const races = cup.races.map((r, i) => `<li class="${run && i < run.raceIndex ? 'done' : ''}">${esc(ENVIRONMENTS[r.env].name)} <small>${WEATHERS[r.weather].name}${r.boss ? ' · BOSS' : ''}</small></li>`).join('');
        let standings = '';
        if (run) {
          const rows = Object.entries(run.points).sort((a, b) => b[1] - a[1]).slice(0, 6);
          standings = `<table class="mini-table">${rows.map(([n, p], i) => `<tr class="${n === 'You' ? 'me' : ''}"><td>${i + 1}</td><td>${esc(n)}</td><td>${p}</td></tr>`).join('')}</table>`;
        }
        return `<div class="cup-card${open ? '' : ' locked'}">
          <h3>${esc(cup.name)}</h3><p>${esc(cup.desc)}</p><ol class="race-list">${races}</ol>${standings}
          <p class="cup-status">${status}</p>
          <p class="tiny">Prize: ${cup.prize.map((p) => fmt(p)).join(' / ')} coins</p>
          ${open ? `<div class="btn-row">${run ? `<button type="button" class="btn" data-action="continue" data-value="${cup.id}">Continue</button><button type="button" class="btn ghost" data-action="restart" data-value="${cup.id}">Restart</button>` : `<button type="button" class="btn" data-action="begin" data-value="${cup.id}">Start Cup</button>`}</div>` : ''}
        </div>`;
      }).join('');
      const body = `<div class="opt-group"><h4>Difficulty</h4><div class="chips">${Object.entries(DIFFICULTY).map(([k, v]) => `<button type="button" class="chip${k === diff ? ' on' : ''}" data-action="diff" data-value="${k}">${v.name}</button>`).join('')}</div>
        <p class="tiny">Harder rivals pay more coins. Points per race: 10, 8, 6, 4, 2, 1.</p></div><div class="cup-grid">${cards}</div>`;
      this.screen('championship', this.panel('Championship', body, { wide: true }), {
        back,
        onAction: (a, v) => {
          if (a === 'diff') { diff = v; d.last.difficulty = v; save.save(); render(); return; }
          const cup = CUPS.find((c) => c.id === v);
          if (!cup) return;
          const st = d.cups[cup.id] || (d.cups[cup.id] = {});
          if (a === 'begin' || a === 'restart') st.run = { raceIndex: 0, points: {}, difficulty: diff };
          if (a === 'continue' && !st.run) return;
          if (st.run && !st.run.difficulty) st.run.difficulty = diff;
          save.save();
          this.startCupRace(cup.id);
        },
      });
    };
    render();
  }

  startCupRace(cupId) {
    const d = this.app.save.data;
    const cup = CUPS.find((c) => c.id === cupId);
    const run = d.cups[cupId].run;
    const race = cup.races[run.raceIndex];
    this.app.startSession({ mode: 'championship', cup: cupId, raceIndex: run.raceIndex, env: race.env, weather: race.weather, laps: 3, difficulty: run.difficulty || 'medium' });
  }

  showFreestyle(back) {
    const save = this.app.save;
    const d = save.data;
    let pick = 'showdown';
    const render = () => {
      const opts = [
        ['showdown', 'Stunt Showdown', `${SHOWDOWN_SECONDS / 60} minutes to score as much as you can. Scores go on the online leaderboard. Best: ${fmt(d.stunt.highScore)}`],
        ['endless', 'Endless Practice', `No timer. Practise tricks and combos at your own pace. Best: ${fmt(d.stunt.endlessBest)}`],
      ];
      const ch = CHALLENGES.map((c) => {
        const done = d.stunt.challenges.includes(c.id);
        return `<button type="button" class="list-item${pick === c.id ? ' on' : ''}" data-action="pick" data-value="${c.id}"><b>${done ? '✅ ' : ''}${esc(c.name)}</b><small>${esc(c.desc)}${c.time ? ` (${c.time}s)` : ''} · ${done ? 'Completed' : `Reward ${c.reward} coins`}</small></button>`;
      }).join('');
      const body = `<div class="list">${opts.map(([id, n, desc]) => `<button type="button" class="list-item${pick === id ? ' on' : ''}" data-action="pick" data-value="${id}"><b>${n}</b><small>${desc}</small></button>`).join('')}</div>
        <div class="opt-group"><h4>Stunt challenges (${d.stunt.challenges.length}/${CHALLENGES.length})</h4><div class="list">${ch}</div></div>
        <div class="opt-group"><h4>Jet ski</h4>${this.skiPicker(d.skis.selected)}</div>
        <p class="tiny">Hit ramps, ride the mega waves and fly through the pink rings for a x2 bonus.</p>`;
      this.screen('setup', this.panel('Freestyle Stunts', body, { wide: true, foot: '<button type="button" class="btn big" data-action="start">Start</button><button type="button" class="btn ghost" data-action="help">Trick list</button>' }), {
        back,
        onAction: (a, v) => {
          if (a === 'pick') { pick = v; render(); return; }
          if (a === 'ski') { d.skis.selected = v; save.save(); render(); return; }
          if (a === 'help') { this.showHelp(() => render()); return; }
          if (a === 'start') {
            const isCh = CHALLENGES.some((c) => c.id === pick);
            this.app.startSession({ mode: 'freestyle', env: 'arena', weather: 'default', freestyle: isCh ? 'challenge' : pick, challenge: isCh ? pick : null, skiId: d.skis.selected });
          }
        },
      });
    };
    render();
  }

  showFreeRide(back, envId) {
    const save = this.app.save;
    const d = save.data;
    const cfg = { env: envId || 'paradise', weather: 'default' };
    const avail = [...d.unlockedCourses, 'arena'];
    const render = () => {
      const shells = d.collect.shells.filter((s) => s.startsWith(cfg.env + '-')).length;
      const body = `<div class="opt-group"><h4>Where to?</h4>${this.envPicker(ALL_ENVS, cfg.env, avail)}</div>
        <p class="env-desc">${esc(ENVIRONMENTS[cfg.env].desc)}</p>
        <p class="tiny">Golden shells found here: ${shells}/5 · Hidden places found: ${ENVIRONMENTS[cfg.env].places.filter((p) => d.collect.places.includes(p.id)).length}/2</p>
        <div class="opt-group"><h4>Weather</h4>${this.weatherPicker(cfg.weather)}</div>
        <div class="opt-group"><h4>Jet ski</h4>${this.skiPicker(d.skis.selected)}</div>`;
      this.screen('setup', this.panel('Free Ride', body, { wide: true, foot: '<button type="button" class="btn big" data-action="start">Ride</button>' }), {
        back,
        onAction: (a, v) => {
          if (a === 'env') cfg.env = v;
          if (a === 'weather') cfg.weather = v;
          if (a === 'ski') { d.skis.selected = v; save.save(); }
          if (a === 'start') { this.app.startSession({ mode: 'freeride', env: cfg.env, weather: cfg.weather, skiId: d.skis.selected }); return; }
          render();
        },
      });
    };
    render();
  }

  // ---------------------------------------------------------------- Courses, achievements, leaderboard
  showCourses(back) {
    const save = this.app.save;
    const d = save.data;
    const render = () => {
      const cards = ALL_ENVS.map((id) => {
        const e = ENVIRONMENTS[id];
        const open = id === 'arena' || d.unlockedCourses.includes(id);
        const rec = d.records[id] || {};
        const shells = d.collect.shells.filter((s) => s.startsWith(id + '-')).length;
        const places = e.places.filter((p) => d.collect.places.includes(p.id)).length;
        const stats = id === 'arena'
          ? `<p class="tiny">Freestyle venue · Shells ${shells}/5 · Places ${places}/2</p>`
          : `<p class="tiny">Best lap ${formatTime(rec.bestLap)} · Time trial ${formatTime(rec.bestTT)} ${rec.medal ? medalIcon(rec.medal) : ''}<br>Shells ${shells}/5 · Places ${places}/2</p>`;
        const actions = open
          ? (id === 'arena'
            ? '<button type="button" class="btn small" data-action="freestyle">Freestyle</button><button type="button" class="btn small ghost" data-action="ride" data-value="arena">Free Ride</button>'
            : `<button type="button" class="btn small" data-action="race" data-value="${id}">Quick Race</button><button type="button" class="btn small ghost" data-action="tt" data-value="${id}">Time Trial</button><button type="button" class="btn small ghost" data-action="ride" data-value="${id}">Free Ride</button>`)
          : `<p class="tiny">Unlock by finishing the Paradise Cup on the podium, or:</p><button type="button" class="btn small gold" data-action="buy" data-value="${id}">Unlock for ${fmt(COURSE_PRICE)} 🪙</button>`;
        return `<div class="course-card${open ? '' : ' locked'}"><div class="course-art env-${id}"></div><h3>${esc(e.name)}</h3>
          <p class="tiny">${esc(e.water)} · ${WEATHERS[e.weather].name}</p><p>${esc(e.desc)}</p>${stats}<div class="btn-row">${actions}</div></div>`;
      }).join('');
      this.screen('courses', this.panel('Courses', `<div class="course-grid">${cards}</div>`, { wide: true }), {
        back,
        onAction: (a, v) => {
          const me = () => this.showCourses(back);
          if (a === 'race' || a === 'tt') { d.last.env = v; save.save(); this.showRaceSetup(a === 'race' ? 'quick' : 'timetrial', me); }
          if (a === 'ride') this.showFreeRide(me, v);
          if (a === 'freestyle') this.showFreestyle(me);
          if (a === 'buy') {
            if (this.pendingBuy !== `course:${v}`) { this.pendingBuy = `course:${v}`; this.toast(`Tap again to unlock ${ENVIRONMENTS[v].name} for ${fmt(COURSE_PRICE)} coins`); return; }
            this.pendingBuy = null;
            if (!save.spend(COURSE_PRICE)) { this.toast(`You need ${fmt(COURSE_PRICE - save.coins)} more coins`); return; }
            d.unlockedCourses.push(v);
            save.save();
            this.app.audio.coin();
            this.toast(`${ENVIRONMENTS[v].name} unlocked!`);
            render();
          }
        },
      });
    };
    render();
  }

  showAchievements(back) {
    const d = this.app.save.data;
    const s = d.stats;
    const list = ACHIEVEMENTS.map((a) => {
      const done = !!d.achievements[a.id];
      return `<div class="ach${done ? ' done' : ''}"><span class="ach-icon">${done ? '🏆' : '🔒'}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><em>${a.reward} 🪙</em></div>`;
    }).join('');
    const stats = [
      ['Races finished', s.races], ['Wins', s.wins], ['Podiums', s.podiums], ['Tricks landed', s.tricks],
      ['Best combo', `x${Math.min(5, s.bestCombo)} (${s.bestCombo} tricks)`], ['Longest airtime', `${s.bestAir.toFixed(1)} s`],
      ['Distance ridden', `${(s.distance / 1609).toFixed(1)} miles`], ['Wipeouts', s.crashes], ['Coins earned', fmt(d.totalCoins)],
      ['Stunt high score', fmt(d.stunt.highScore)], ['Golden shells', `${d.collect.shells.length}/35`], ['Hidden places', `${d.collect.places.length}/14`],
      ['Time played', `${Math.floor(s.playSeconds / 60)} min`],
    ];
    const body = `<p class="tiny">${Object.keys(d.achievements).length} of ${ACHIEVEMENTS.length} unlocked</p><div class="ach-grid">${list}</div>
      <div class="opt-group"><h4>Player statistics</h4><div class="stat-grid">${stats.map(([n, v]) => `<div><small>${n}</small><b>${v}</b></div>`).join('')}</div></div>`;
    this.screen('achievements', this.panel('Achievements', body, { wide: true }), { back });
  }

  showLeaderboard(back, highlight = null) {
    const render = (content) => {
      this.screen('leaderboard', this.panel('🏆 Leaderboard', `<p class="tiny">Top 10 Stunt Showdown scores (${SHOWDOWN_SECONDS / 60}-minute freestyle sessions in the Stunt Arena).</p>${content}`, {
        foot: '<button type="button" class="btn" data-action="refresh">Refresh</button>',
      }), { back, onAction: (a) => { if (a === 'refresh') load(); } });
    };
    const load = async () => {
      render('<p class="loading-msg">Loading scores...</p>');
      try {
        const rows = await fetchTop(10);
        if (!rows.length) { render('<p class="empty">No scores yet. Be the first: play Stunt Showdown!</p>'); return; }
        render(`<table class="board"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Tricks</th><th>Combo</th><th>Jet ski</th></tr></thead><tbody>${rows.map((r, i) => {
          const me = highlight && r.name === highlight.name && r.score === highlight.score;
          return `<tr class="${me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td>${fmt(r.score)}</td><td>${r.tricks}</td><td>${r.combo}</td><td>${esc(r.ski)}</td></tr>`;
        }).join('')}</tbody></table>`);
      } catch (error) {
        render(`<p class="error">${esc(explain(error))}</p>`);
      }
    };
    load();
  }

  // ---------------------------------------------------------------- Settings and help
  showSettings(back, fromPause = false) {
    const app = this.app;
    const save = app.save;
    const s = save.settings;
    let rebinding = null;
    const render = () => {
      const q = ['auto', 'low', 'medium', 'high'];
      const keys = ACTIONS.map((a) => {
        const codes = app.input.keys[a.id] || [];
        return `<div class="key-row"><span>${a.name}</span>${[0, 1].map((slot) => `<button type="button" class="key${rebinding && rebinding[0] === a.id && rebinding[1] === slot ? ' wait' : ''}" data-action="bind" data-value="${a.id}:${slot}">${rebinding && rebinding[0] === a.id && rebinding[1] === slot ? 'Press a key' : keyLabel(codes[slot])}</button>`).join('')}</div>`;
      }).join('');
      const body = `
        <div class="opt-group"><h4>Graphics</h4><div class="chips">${q.map((k) => `<button type="button" class="chip${s.quality === k ? ' on' : ''}" data-action="quality" data-value="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
          <p class="tiny">Now using ${app.quality.toUpperCase()}. Low: simple water, no shadows, fewer particles. High: full water detail, shadows and particles.</p></div>
        <div class="opt-group"><h4>Volume</h4>
          <label class="slider">Music <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-input="music"></label>
          <label class="slider">Sound effects <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-input="sfx"></label></div>
        <div class="opt-group"><h4>Display</h4>
          <label class="check"><input type="checkbox" data-change="fullscreen" ${s.fullscreen ? 'checked' : ''}> Go full screen when the game starts</label>
          <button type="button" class="btn small" data-action="fs">${app.isFullscreen() ? 'Exit full screen' : 'Full screen now'}</button>
          <label class="check"><input type="checkbox" data-change="fps" ${s.fps ? 'checked' : ''}> Show frame rate</label>
          <label class="check"><input type="checkbox" data-change="shake" ${s.shake ? 'checked' : ''}> Camera shake</label>
          <div class="chips small">${[['near', 'Close camera'], ['far', 'Far camera'], ['low', 'Low camera']].map(([k, n]) => `<button type="button" class="chip${s.camera === k ? ' on' : ''}" data-action="camera" data-value="${k}">${n}</button>`).join('')}</div></div>
        <div class="opt-group"><h4>Touch controls</h4>
          <label class="check"><input type="checkbox" data-change="tilt" ${s.tilt ? 'checked' : ''}> Tilt to steer (motion sensor)</label>
          <label class="check"><input type="checkbox" data-change="autoThrottle" ${s.autoThrottle ? 'checked' : ''}> Auto-accelerate on touch screens</label></div>
        <div class="opt-group"><h4>Keyboard controls</h4><div class="keys">${keys}</div><button type="button" class="btn small ghost" data-action="resetkeys">Reset keys</button></div>
        ${fromPause ? '' : '<div class="opt-group"><h4>Progress</h4><button type="button" class="btn small danger" data-action="reset">Reset all progress</button><p class="tiny">Clears coins, unlocks, records and customization on this device. Settings are kept. The online leaderboard is not affected.</p></div>'}
        <button type="button" class="btn ghost" data-action="help">How to play</button>`;
      this.screen('settings', this.panel('Settings', body, { wide: true }), {
        back: () => { app.input.capture = null; back(); },
        onAction: async (a, v) => {
          if (a === 'quality') { s.quality = v; save.save(); app.setQuality(app.resolveQuality(v)); render(); }
          if (a === 'fs') { await app.toggleFullscreen(); setTimeout(render, 300); }
          if (a === 'camera') { s.camera = v; save.save(); if (app.session) app.session.cam.mode = { near: 0, far: 1, low: 2 }[v]; render(); }
          if (a === 'bind') {
            const [id, slot] = v.split(':');
            rebinding = [id, Number(slot)];
            render();
            app.input.capture = (code) => {
              rebinding = null;
              if (code !== 'Escape' || id === 'pause') app.input.setKey(id, Number(slot), code);
              render();
            };
          }
          if (a === 'resetkeys') { app.input.resetKeys(); render(); }
          if (a === 'help') this.showHelp(() => render());
          if (a === 'reset') {
            if (this.pendingBuy !== 'reset') { this.pendingBuy = 'reset'; this.toast('Tap Reset again to erase all progress'); return; }
            this.pendingBuy = null;
            save.reset();
            app.refreshAttract();
            this.toast('Progress reset');
            render();
          }
        },
        onInput: (name, value) => {
          if (name === 'music' || name === 'sfx') { s[name] = Number(value); app.audio.applyVolumes(); save.save(); }
        },
        onChange: async (name, value) => {
          if (name === 'tilt') {
            const ok = await app.input.enableTilt(value);
            s.tilt = value && ok;
            if (value && !ok) this.toast('Motion sensor not available');
            app.updateTouchLayout();
          } else {
            s[name] = value;
          }
          if (name === 'fps') this.h.fps.classList.toggle('hidden', !value);
          save.save();
          render();
        },
      });
    };
    render();
  }

  showHelp(back) {
    const k = (id) => (this.app.input.keys[id] || []).filter(Boolean).map(keyLabel).join(' / ');
    const tricks = Object.entries(TRICKS).filter(([id]) => id !== 'rollRight' && id !== 'doubleRollRight').map(([id, t]) => {
      const keys = {
        backflip: k('backflip'), frontflip: k('frontflip'), rollLeft: `${k('rollLeft')} or ${k('rollRight')}`, superman: k('superman'), noHander: k('noHander'), oneHander: k('oneHander'), spin: k('spin'),
        doubleBackflip: `Hold ${k('jump')} + ${k('backflip')}`, doubleRollLeft: `Hold ${k('jump')} + ${k('rollLeft')} or ${k('rollRight')}`, supermanBackflip: `Hold ${k('jump')} + ${k('superman')}`,
      }[id];
      return `<tr><td>${t.name}</td><td>${keys}</td><td>${fmt(t.points)}</td></tr>`;
    }).join('');
    const body = `
      <div class="opt-group"><h4>Riding</h4><ul class="help">
        <li><b>${k('accel')}</b> accelerate · <b>${k('brake')}</b> brake and reverse · <b>${k('left')}</b> / <b>${k('right')}</b> steer</li>
        <li><b>${k('boost')}</b> boost (refills over time and faster when you land tricks)</li>
        <li><b>${k('jump')}</b> hop off the water. Crests of big waves, ramps and mega waves launch you higher.</li>
        <li>In the air, accelerate tilts the nose down and brake tilts it up. Land level to keep your combo.</li>
        <li><b>${k('camera')}</b> change camera · <b>${k('pause')}</b> pause</li></ul></div>
      <div class="opt-group"><h4>Tricks (in the air)</h4><table class="board"><thead><tr><th>Trick</th><th>Keys</th><th>Points</th></tr></thead><tbody>${tricks}</tbody></table>
        <p class="tiny">Chain tricks in one jump or land and take off again within 2.5 seconds to build a combo: 2 tricks = x2 up to x5. Points count when you land. Landing mid-flip wipes out the combo. Pink rings double the next landing.</p></div>
      <div class="opt-group"><h4>Touch screens</h4><p class="tiny">Steer with the arrows on the left, GAS / BRAKE / BOOST / JUMP on the right, and tap the trick buttons in the air. Hold JUMP in the air for PRO tricks (double flips and rolls). Use several fingers at once. Tilt steering and auto-accelerate are in Settings.</p></div>`;
    this.screen('help', this.panel('How to Play', body, { wide: true }), { back });
  }

  // ---------------------------------------------------------------- Pause and results
  showPause() {
    const app = this.app;
    const s = app.session;
    const endable = s.mode === 'freeride' || (s.mode === 'freestyle' && s.cfg.freestyle === 'endless');
    this.screen('pause', `<div class="panel narrow"><h2>Paused</h2><nav class="main-nav">
      <button type="button" class="btn big" data-action="resume" autofocus>Resume</button>
      ${endable ? '<button type="button" class="btn" data-action="end">Finish &amp; collect coins</button>' : ''}
      <button type="button" class="btn" data-action="restart">Restart</button>
      <button type="button" class="btn" data-action="settings">Settings</button>
      <button type="button" class="btn" data-action="help">How to play</button>
      <button type="button" class="btn" data-action="fs">${app.isFullscreen() ? 'Exit full screen' : 'Full screen'}</button>
      <button type="button" class="btn ghost" data-action="quit">Quit to menu</button></nav></div>`, {
      back: () => app.resume(),
      onAction: async (a) => {
        if (a === 'resume') app.resume();
        if (a === 'end') { app.resume(true); s.quitEndless(); }
        if (a === 'restart') app.restart();
        if (a === 'settings') this.showSettings(() => this.showPause(), true);
        if (a === 'help') this.showHelp(() => this.showPause());
        if (a === 'fs') { await app.toggleFullscreen(); setTimeout(() => this.showPause(), 300); }
        if (a === 'quit') app.quitToMenu();
      },
    });
  }

  showResults(r) {
    const app = this.app;
    this.hideHUD();
    let title = 'Results';
    let body = '';
    const ach = (r.achievements || []).map((a) => `<li>🏆 ${esc(a.name)} <small>+${a.reward}</small></li>`).join('');
    const coinLine = `<div class="coin-earned">+${fmt(r.coins + (r.prize || 0))} 🪙 <small>Paradise Coins</small></div>`;
    if (r.mode === 'championship' || r.mode === 'quick') {
      title = r.position === 1 ? '🏆 Victory!' : `You finished ${ordinal(r.position)}`;
      body = `<p class="sub">${esc(r.envName)}${r.cup ? ` · ${esc(r.cup.name)} race ${r.cup.race}/${r.cup.total}` : ''}</p>
        <table class="board"><thead><tr><th>Pos</th><th>Racer</th><th>Time</th></tr></thead><tbody>${r.standings.map((s) => `<tr class="${s.isPlayer ? 'me' : ''}"><td>${ordinal(s.pos)}</td><td>${esc(s.name)}${s.boss ? ' <span class="tag bad">BOSS</span>' : ''}</td><td>${s.est ? '~' : ''}${formatTime(s.time)}</td></tr>`).join('')}</tbody></table>
        <div class="result-stats"><div><small>Race time</small><b>${formatTime(r.time)}</b></div><div><small>Best lap</small><b>${formatTime(r.bestLap)}${r.newBestLap ? ' <span class="tag good">RECORD</span>' : ''}</b></div><div><small>Tricks</small><b>${r.tricks} · ${fmt(r.trickPoints)} pts</b></div></div>`;
      if (r.beatBoss) body += `<p class="good-line">You beat ${esc(r.beatBoss)}!</p>`;
      if (r.cupPoints) {
        body += `<h4>${r.cupFinal ? 'Final championship standings' : 'Championship standings'}</h4><table class="board small"><tbody>${r.cupPoints.map((p, i) => `<tr class="${p.isPlayer ? 'me' : ''}"><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.pts} pts</td></tr>`).join('')}</tbody></table>`;
        if (r.cupFinal) body += `<p class="good-line">${r.trophy ? `${medalIcon(r.trophy)} ${esc(r.cup.name)}: ${ordinal(r.cupFinal)} place! Prize ${fmt(r.prize)} coins` : `${ordinal(r.cupFinal)} place overall. Finish in the top 3 for a trophy.`}</p>`;
      }
    } else if (r.mode === 'timetrial') {
      title = r.medal ? `${medalIcon(r.medal)} ${r.medal[0].toUpperCase() + r.medal.slice(1)} medal!` : 'Time Trial complete';
      body = `<div class="result-stats"><div><small>Time</small><b>${formatTime(r.time)}${r.newRecord ? ' <span class="tag good">NEW BEST</span>' : ''}</b></div><div><small>Best lap</small><b>${formatTime(r.bestLap)}</b></div><div><small>Personal best</small><b>${formatTime(r.best)}</b></div></div>
        <p class="tiny">Medals: 🥇 ${formatTime(r.medals.gold)} · 🥈 ${formatTime(r.medals.silver)} · 🥉 ${formatTime(r.medals.bronze)}</p>
        <p class="tiny">Laps: ${r.lapTimes.map((t) => formatTime(t)).join(' · ')}</p>`;
    } else if (r.mode === 'freestyle') {
      title = r.challenge ? (r.success ? 'Challenge complete!' : 'Challenge failed') : 'Freestyle over!';
      body = `${r.challenge ? `<p class="sub">${esc(r.challenge.name)}: ${esc(r.challenge.desc)}${r.firstClear ? ` · +${r.challenge.reward} coins` : ''}</p>` : ''}
        <div class="big-score">${fmt(r.score)}<small>points${r.newBest ? ' · NEW BEST!' : ''}</small></div>
        <div class="result-stats"><div><small>Tricks</small><b>${r.tricks}</b></div><div><small>Best combo</small><b>${r.bestCombo} tricks</b></div><div><small>Longest air</small><b>${r.air.toFixed(1)} s</b></div><div><small>Wipeouts</small><b>${r.crashes}</b></div></div>`;
      if (r.leaderboard) {
        const name = loadName() || app.save.settings.lastName || '';
        body += `<form class="lb-form" autocomplete="off"><h4>Online leaderboard</h4>
          <div class="lb-row"><input id="lb-name" name="name" type="text" maxlength="${NAME_MAX}" placeholder="Your name" value="${esc(name)}" aria-label="Your name for the leaderboard" enterkeyhint="send">
          <button type="submit" class="btn gold" id="lb-submit">Submit score</button></div>
          <p class="lb-status tiny" id="lb-status"></p></form>`;
      }
    } else {
      title = 'Free Ride over';
      body = `<p class="sub">${esc(r.envName)}</p><div class="result-stats"><div><small>Tricks</small><b>${r.tricks}</b></div><div><small>Trick points</small><b>${fmt(r.trickPoints)}</b></div><div><small>Shells found</small><b>${r.shells}</b></div><div><small>Places found</small><b>${r.places}</b></div></div>`;
    }
    if (r.unlocks && r.unlocks.length) body += `<div class="unlock-box"><h4>Unlocked!</h4><p>${r.unlocks.map(esc).join(' · ')}</p></div>`;
    if (ach) body += `<div class="unlock-box"><h4>Achievements</h4><ul>${ach}</ul></div>`;
    const next = r.nextRace != null ? '<button type="button" class="btn big" data-action="next">Next race</button>' : '';
    const retry = r.mode === 'championship' ? (r.nextRace != null ? '' : '') : '<button type="button" class="btn" data-action="retry">Retry</button>';
    const lb = r.leaderboard ? '<button type="button" class="btn gold" data-action="board">View leaderboard</button>' : '';
    const champ = r.mode === 'championship' && r.nextRace == null ? '<button type="button" class="btn" data-action="champ">Championships</button>' : '';
    this.screen('results', `<div class="panel results"><h2>${title}</h2>${coinLine}${body}
      <div class="btn-row">${next}${retry}${lb}${champ}<button type="button" class="btn ghost" data-action="menu">Main menu</button></div></div>`, {
      onAction: (a) => {
        if (a === 'next') this.startCupRace(r.cup.id);
        if (a === 'retry') app.restart();
        if (a === 'menu') app.quitToMenu();
        if (a === 'champ') { app.quitToMenu(true); this.showChampionship(() => this.showMainMenu()); }
        if (a === 'board') this.showLeaderboard(() => this.showResults(r), this.submitted);
      },
      onSubmit: async (form) => {
        const input = form.querySelector('#lb-name');
        const status = form.querySelector('#lb-status');
        const btn = form.querySelector('#lb-submit');
        const name = cleanName(input.value);
        if (!name) { status.textContent = 'Type a name first.'; input.focus(); return; }
        if (this.submittedResult === r) { status.textContent = 'Already submitted.'; return; }
        btn.disabled = true;
        status.textContent = 'Sending...';
        try {
          await submitScore({ name, score: r.score, tricks: r.tricks, combo: r.bestCombo, ski: r.ski, seconds: r.seconds });
          saveName(name);
          this.submittedResult = r;
          this.submitted = { name, score: r.score };
          status.textContent = 'Score submitted!';
          this.showLeaderboard(() => this.showResults(r), this.submitted);
        } catch (error) {
          btn.disabled = false;
          status.textContent = explain(error);
        }
      },
    });
  }

  // ---------------------------------------------------------------- HUD
  showHUD(session) {
    const el = this.hudEl;
    el.classList.remove('hidden', 'mode-race', 'mode-tt', 'mode-stunt', 'mode-free');
    el.classList.add(session.racing ? 'mode-race' : session.timed ? 'mode-tt' : session.stunt ? 'mode-stunt' : 'mode-free');
    this.h.timerCard.classList.toggle('hidden', !(session.stunt && session.timeLeft > 0));
    this.h.challenge.classList.toggle('hidden', !session.challenge);
    if (session.challenge) this.h.challengeText.textContent = session.challenge.desc;
    this.h.hi.textContent = fmt(session.cfg.freestyle === 'showdown' ? this.app.save.data.stunt.highScore : this.app.save.data.stunt.endlessBest);
    this.h.envName.textContent = session.def.name;
    this.h.fps.classList.toggle('hidden', !this.app.save.settings.fps);
    this.h.msgs.innerHTML = '';
    this.h.trick.textContent = '';
    this.h.combo.innerHTML = '';
    this.warn('');
    this.clear();
    this.prepareMap(session);
    this.app.updateTouchLayout();
  }

  hideHUD() {
    this.hudEl.classList.add('hidden');
    this.touchEl.classList.add('hidden');
    this.h.countdown.classList.add('hidden');
  }

  message(text, cls = '', dur = 2) {
    const m = document.createElement('div');
    m.className = `hud-msg ${cls}`;
    m.textContent = text;
    this.h.msgs.appendChild(m);
    setTimeout(() => m.classList.add('out'), dur * 1000);
    setTimeout(() => m.remove(), dur * 1000 + 500);
    while (this.h.msgs.children.length > 3) this.h.msgs.firstChild.remove();
  }

  warn(text) {
    if (this.warnText === text) return;
    this.warnText = text;
    this.warnEl.textContent = text;
    this.warnEl.classList.toggle('on', !!text);
  }

  countdown(text) {
    const c = this.h.countdown;
    c.textContent = text;
    c.classList.remove('hidden', 'pop');
    void c.offsetWidth;
    c.classList.add('pop');
    clearTimeout(this.cdTimer);
    this.cdTimer = setTimeout(() => c.classList.add('hidden'), text === 'GO!' ? 900 : 950);
  }

  trickName(name) {
    const t = this.h.trick;
    t.textContent = `${name.toUpperCase()}!`;
    t.classList.remove('pop', 'done');
    void t.offsetWidth;
    t.classList.add('pop');
    clearTimeout(this.trickTimer);
    this.trickTimer = setTimeout(() => { t.textContent = ''; }, 1800);
  }

  trickDone(name) {
    const t = this.h.trick;
    t.textContent = `${name.toUpperCase()} ✓`;
    t.classList.add('done');
  }

  comboPopup(res) {
    const c = this.h.combo;
    const tags = [res.perfect ? '<span class="tag good">PERFECT LANDING +250</span>' : '', res.ring ? '<span class="tag pink">RING x2</span>' : ''].join('');
    c.innerHTML = `<div class="combo-names">${res.comboNames.map((n) => esc(n.toUpperCase())).join(' + ')}</div>
      ${res.multiplier > 1 ? `<div class="combo-mult">COMBO x${res.multiplier}</div>` : ''}
      <div class="combo-points">${fmt(res.points)} POINTS!</div>${tags}`;
    c.classList.remove('pop');
    void c.offsetWidth;
    c.classList.add('pop');
    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => { c.innerHTML = ''; }, 2600);
  }

  prepareMap(session) {
    const env = session.env;
    const tr = env.track;
    const pts = [];
    let minX, maxX, minZ, maxZ;
    if (tr) {
      for (let i = 0; i < tr.n; i += 3) pts.push([tr.x[i], tr.z[i]]);
      ({ minX, maxX, minZ, maxZ } = env.bbox);
    } else {
      minX = -env.radius; maxX = env.radius; minZ = -env.radius; maxZ = env.radius;
    }
    const pad = 30;
    const span = Math.max(maxX - minX, maxZ - minZ) + pad * 2;
    this.map = { pts, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, span, session };
  }

  drawMap() {
    const m = this.map;
    if (!m) return;
    const ctx = this.mapCtx;
    const W = this.h.map.width;
    const s = m.session;
    const k = (W - 16) / m.span;
    // Map is drawn with +X to the left so that it matches the driver's view when heading +Z.
    const X = (x) => W / 2 - (x - m.cx) * k;
    const Y = (z) => W / 2 - (z - m.cz) * k;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(4, 30, 50, 0.55)';
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); ctx.fill();
    const env = s.env;
    ctx.fillStyle = 'rgba(240, 220, 170, 0.75)';
    for (const isl of env.islands) {
      if (isl.r < 3) continue;
      ctx.beginPath(); ctx.arc(X(isl.x), Y(isl.z), Math.max(1.5, isl.r * k), 0, Math.PI * 2); ctx.fill();
    }
    if (m.pts.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, env.track.halfWidth * k * 0.7);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      m.pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))));
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(0), Y(0), (env.radius - 10) * k, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#ffd23f';
    for (const r of this.app.physics.ramps) { ctx.fillRect(X(r.x) - 2, Y(r.z) - 2, 4, 4); }
    if (s.tracker) {
      const pr = s.playerRacer;
      const cp = s.tracker.nextCheckpoint(pr);
      if (cp && !s.finished) {
        ctx.strokeStyle = '#18d6ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(cp.x), Y(cp.z), 5, 0, Math.PI * 2); ctx.stroke();
      }
      for (const r of s.tracker.racers) {
        if (r.isPlayer) continue;
        ctx.fillStyle = r.entity.persona && r.entity.persona.boss ? '#ff3b3b' : '#ff9a3c';
        ctx.beginPath(); ctx.arc(X(r.body.pos.x), Y(r.body.pos.z), 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    const ev = this.app.waves.event;
    if (ev.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      const fx = ev.x + ev.dx * ev.front, fz = ev.z + ev.dz * ev.front;
      ctx.beginPath();
      ctx.moveTo(X(fx - ev.dz * ev.halfLen), Y(fz + ev.dx * ev.halfLen));
      ctx.lineTo(X(fx + ev.dz * ev.halfLen), Y(fz - ev.dx * ev.halfLen));
      ctx.stroke();
    }
    const b = s.player.body;
    const px = X(b.pos.x), py = Y(b.pos.z);
    const yaw = b.yaw();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - yaw);
    ctx.fillStyle = '#2ef2ff';
    ctx.strokeStyle = '#003040';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawSpeedo(speedMph, frac, boost) {
    const ctx = this.speedoCtx;
    const W = 200;
    ctx.clearRect(0, 0, W, W);
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    ctx.lineCap = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(100, 100, 82, a0, a1); ctx.stroke();
    const grd = ctx.createLinearGradient(20, 180, 180, 20);
    grd.addColorStop(0, '#2ef2ff');
    grd.addColorStop(0.7, '#ffd23f');
    grd.addColorStop(1, '#ff4d2e');
    ctx.strokeStyle = grd;
    ctx.beginPath(); ctx.arc(100, 100, 82, a0, a0 + (a1 - a0) * Math.min(1, frac)); ctx.stroke();
    if (boost) {
      ctx.strokeStyle = 'rgba(255,90,200,0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(100, 100, 94, a0, a0 + (a1 - a0) * Math.min(1, frac)); ctx.stroke();
    }
  }

  updateHUD(s, dt) {
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 0.5) {
      this.h.fps.textContent = `${Math.round(this.frames / this.fpsT)} fps · ${this.app.quality}`;
      this.frames = 0;
      this.fpsT = 0;
    }
    this.hudT += dt;
    this.mapT += dt;
    const b = s.player.body;
    const mph = b.speed * MPH;
    if (this.hudT > 1 / 30) {
      this.hudT = 0;
      this.drawSpeedo(mph, b.speed / (b.h.maxSpeed * 1.3), b.boosting);
      this.h.speed.textContent = Math.round(mph);
      this.h.boost.style.width = `${(b.boost / b.h.boostMax) * 100}%`;
      this.h.boost.classList.toggle('on', b.boosting);
      if (s.tracker) {
        const pr = s.playerRacer;
        if (s.racing) {
          this.h.pos.innerHTML = `${pr.position}<sup>${ordinal(pr.position).slice(-2)}</sup>`;
          this.h.posOf.textContent = `/ ${s.tracker.racers.length}`;
        }
        this.h.lap.textContent = `Lap ${Math.min(s.laps, pr.lap + 1)}/${s.laps}`;
        const lapT = pr.started ? s.raceTime - pr.lapStart : 0;
        this.h.time.textContent = formatTime(s.finished ? pr.finishTime : s.raceTime);
        this.h.best.textContent = `Lap ${formatTime(lapT)} · Best ${formatTime(pr.bestLap)}`;
        const cps = s.tracker.cps.length;
        this.h.cp.textContent = `Checkpoint ${pr.started ? (pr.nextCp === 0 ? cps : pr.nextCp) : 0}/${cps}`;
        // Arrow toward the next checkpoint.
        const cp = s.tracker.nextCheckpoint(pr);
        if (cp && !s.finished && s.go) {
          const ang = Math.atan2(cp.x - b.pos.x, cp.z - b.pos.z) - b.yaw();
          this.h.arrow.classList.remove('hidden');
          this.h.arrow.style.transform = `rotate(${-ang}rad)`;
        } else this.h.arrow.classList.add('hidden');
      } else {
        this.h.arrow.classList.add('hidden');
      }
      if (s.stunt) {
        this.h.score.textContent = fmt(s.score);
        if (s.timeLeft > 0 || (s.challenge && s.challenge.time) || s.cfg.freestyle === 'showdown') {
          const t = Math.max(0, Math.ceil(s.timeLeft));
          this.h.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
          this.h.timerCard.classList.toggle('low', t <= 10);
        }
        if (s.challenge) this.h.challengeText.textContent = `${s.challenge.desc}${s.challengeState.done ? ' ✅' : ''}`;
      }
      if (s.mode === 'freeride') {
        const d = this.app.save.data;
        this.h.shells.textContent = `Golden shells ${d.collect.shells.filter((x) => x.startsWith(s.envId + '-')).length}/5`;
        this.h.freeScore.textContent = `Trick points ${fmt(s.stats.trickPoints)}`;
      }
    }
    if (this.mapT > 0.1) {
      this.mapT = 0;
      this.drawMap();
    }
  }
}

export function medalIcon(m) {
  return { gold: '🥇', silver: '🥈', bronze: '🥉' }[m] || '';
}

export { statBars };
