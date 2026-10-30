/**
 * Game flow and main loop.
 *
 * States: menus → intro → racing ⇄ paused → post (results / standings /
 * champion) → menus … The menus are DOM screens over an animated canvas
 * backdrop; during a race the canvas shows the RaceView. Frames use
 * requestAnimationFrame; the race splits each frame into fixed substeps.
 *
 * Flow: a mode (grandprix, quick, timetrial, browse) decides where the ship
 * and track screens lead next.
 */
import { CONFIG } from './config.js';
import { Race } from './race.js';
import { RaceView } from './raceView.js';
import { TitleScene } from './titleScene.js';
import { Championship, pickOpponents } from './grandPrix.js';
import { getTrack } from './tracks.js';
import { getRecord, getGhost, saveRun, clearRecords } from './timeTrial.js';
import { storage } from './storage.js';

export class Game {
  constructor({ canvas, ui, input, audio, settings, params }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.input = input;
    this.audio = audio;
    this.settings = settings;
    this.params = params;
    this.state = 'menus';
    this.stack = [];
    this.flow = { mode: 'quick' };
    this.cupId = CONFIG.cups[0].id;
    this.title = new TitleScene();
    this.race = null;
    this.view = null;
    this.gp = null;
    this.lastTs = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /* ------------------------------------------------------------ loop */

  start() {
    this.ui.show('title');
    this.audio.startMusic('menu');
    const frame = (ts) => {
      const dt = this.lastTs ? Math.min(0.1, (ts - this.lastTs) / 1000) : 1 / 60;
      this.lastTs = ts;
      this.frame(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  resize() {
    const dprCap = this.settings.effects ? 2 : 1.25;
    this.dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  frame(dt) {
    if (document.hidden) return;
    const { W, H, dpr, ctx } = this;
    if (this.view && this.state !== 'menus') {
      const v = this.view;
      v.touchMode = this.ui.isTouch;
      v.touchInset = this.ui.touchInset();
      v.touchInsetLeft = this.ui.touchInsetLeft();
      v.hideHud = this.state === 'intro';
      if (this.state === 'racing') {
        this.race.update(dt);
        v.update(dt, W, H);
        this.ui.setResetVisible(!!this.race.player.needsReset);
      } else if (this.state === 'intro') {
        this.introPan(dt);
        v.update(dt, W, H);
      } else if (this.state === 'post') {
        v.update(dt, W, H);
      }
      v.draw(ctx, W, H, dpr);
    } else {
      this.title.update(dt, W, H);
      this.title.draw(ctx, W, H, dpr);
    }
    this.ui.tick(dt);
  }

  /** During the intro the camera sweeps back along the track to the grid. */
  introPan(dt) {
    this.introT += dt;
    const race = this.race;
    const p = race.player;
    const k = Math.min(1, this.introT / 2.6);
    const e = 1 - (1 - k) ** 3;
    const f = race.geo.at(p.s + 1900 * (1 - e), {});
    this.view.camera.snap(f.x + (p.x - f.x) * e, f.y + (p.y - f.y) * e);
    // keep the race frozen; the camera snaps in follow() otherwise
    this.view.camera.ready = true;
  }

  isRacing() {
    return this.state === 'racing';
  }

  saveSettings() {
    storage.set('settings', this.settings);
  }

  toggleMute() {
    this.settings.muted = !this.settings.muted;
    this.audio.applySettings();
    this.ui.syncSettings();
    this.saveSettings();
  }

  /* ------------------------------------------------------- navigation */

  go(screen) {
    if (this.ui.current) this.stack.push(this.ui.current);
    this.ui.show(screen);
    this.onScreen(screen);
  }

  back() {
    const prev = this.stack.pop() || 'title';
    this.audio.play('back');
    this.ui.show(prev);
    this.onScreen(prev);
  }

  onScreen(screen) {
    if (screen === 'ships') this.ui.buildShips(this.settings.ship);
    if (screen === 'tracks') this.ui.buildTracks(this.flow.mode, this.settings.track);
    if (screen === 'cups') this.ui.buildCups(this.cupId);
    if (screen === 'settings') this.ui.syncSettings();
  }

  requestAction(a) {
    if (a === 'escape') {
      if (this.state === 'racing') return this.pause();
      if (this.state === 'paused' && this.ui.current === 'pause') return this.resume();
      if (this.state === 'intro') return this.beginCountdown();
      if (this.ui.current && this.ui.current !== 'title' && this.ui.current !== 'results' && this.ui.current !== 'standings' && this.ui.current !== 'champion') return this.back();
      return;
    }
    if (a === 'confirm') {
      // a focused button already handles Enter itself
      if (document.activeElement?.tagName === 'BUTTON') return;
      if (this.state === 'intro') return this.beginCountdown();
      if (this.ui.current === 'title') return this.onAction('play');
    }
  }

  requestReset() {
    if (this.state === 'racing') this.race.requestReset();
  }

  onAction(action, el) {
    const s = this.settings;
    const quiet = new Set(['pick-ship', 'pick-track', 'pick-cup', 'rot-left', 'rot-right', 'rot-auto', 'mute', 'back']);
    if (!quiet.has(action)) this.audio.play('select');
    switch (action) {
      case 'play':
        this.go('menu');
        break;
      case 'help':
        this.go('help');
        break;
      case 'settings':
        this.go('settings');
        break;
      case 'back':
        this.back();
        break;
      case 'mute':
        this.toggleMute();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;
      case 'reset-records':
        if (window.confirm('Delete all Time Trial records and ghosts?')) {
          clearRecords();
          this.audio.play('back');
        }
        break;

      case 'mode-grandprix':
        this.flow = { mode: 'grandprix' };
        this.go('cups');
        break;
      case 'mode-quick':
        this.flow = { mode: 'quick' };
        this.go('ships');
        break;
      case 'mode-timetrial':
        this.flow = { mode: 'timetrial' };
        this.go('ships');
        break;
      case 'browse-ships':
        this.flow = { mode: 'browse' };
        this.go('ships');
        break;
      case 'browse-tracks':
        this.flow = { mode: 'browse' };
        this.go('tracks');
        break;

      case 'pick-cup':
        this.cupId = el.dataset.id;
        this.ui.selectCup(this.cupId);
        this.audio.play('tick');
        break;
      case 'cup-next':
        this.go('ships');
        break;
      case 'pick-ship':
        s.ship = el.dataset.id;
        this.ui.selectShip(s.ship);
        this.audio.play('tick');
        this.saveSettings();
        break;
      case 'rot-left':
        this.ui.rotatePreview(-1);
        break;
      case 'rot-right':
        this.ui.rotatePreview(1);
        break;
      case 'rot-auto':
        this.ui.toggleAutoRotate();
        break;
      case 'ship-confirm':
        this.saveSettings();
        if (this.flow.mode === 'grandprix') this.startChampionship();
        else if (this.flow.mode === 'browse') this.back();
        else this.go('tracks');
        break;
      case 'pick-track':
        s.track = el.dataset.id;
        this.ui.selectTrack(s.track);
        this.audio.play('tick');
        this.saveSettings();
        break;
      case 'track-confirm':
        if (this.flow.mode === 'browse') this.flow = { mode: 'quick' };
        this.startRace();
        break;

      case 'intro-go':
        this.beginCountdown();
        break;
      case 'pause':
        if (this.state === 'racing') this.pause();
        break;
      case 'resume':
        this.resume();
        break;
      case 'restart':
        this.restartRace();
        break;
      case 'quit':
        this.quitToMenu();
        break;
      case 'change-track':
        this.endRace();
        this.state = 'menus';
        this.stack = ['title', 'menu'];
        this.ui.show('tracks');
        this.onScreen('tracks');
        this.audio.startMusic('menu');
        break;
      case 'gp-standings':
        this.ui.showStandings(this.gp);
        break;
      case 'gp-next':
        if (this.gp.done) {
          this.ui.showChampion(this.gp);
          this.audio.startMusic('results');
          this.audio.play(this.gp.standings()[0].isPlayer ? 'win' : 'finish');
        } else {
          this.startRace();
        }
        break;
    }
  }

  toggleFullscreen() {
    const d = document;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else {
        const el = d.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    } catch {
      /* not supported (e.g. iPhone Safari) */
    }
  }

  /* ------------------------------------------------------------ races */

  startChampionship() {
    const cup = CONFIG.cups.find((c) => c.id === this.cupId) || CONFIG.cups[0];
    this.gp = new Championship(cup, this.settings.difficulty, this.settings.ship);
    this.startRace();
  }

  /** Builds the race for the current flow and shows the intro. */
  startRace() {
    this.endRace();
    const s = this.settings;
    const mode = this.flow.mode;
    let opts;
    let kicker;
    if (mode === 'grandprix') {
      const gp = this.gp;
      const rc = gp.raceConfig();
      opts = { track: getTrack(gp.trackId), mode, ...rc };
      kicker = `${gp.cup.name.toUpperCase()} · RACE ${gp.round + 1} OF ${gp.trackIds.length} · ${rc.difficulty.toUpperCase()}`;
    } else if (mode === 'timetrial') {
      opts = { track: getTrack(s.track), mode, playerShip: s.ship, ghost: getGhost(s.track) };
      kicker = 'TIME TRIAL';
    } else {
      opts = { track: getTrack(s.track), mode: 'quick', playerShip: s.ship, opponents: pickOpponents(s.ship), difficulty: s.difficulty, playerSlot: 3 };
      kicker = `QUICK RACE · ${s.difficulty.toUpperCase()}`;
    }
    opts.autopilot = this.params.has('autopilot');
    this.lastOpts = opts;
    this.lastKicker = kicker;
    this.launch(opts, kicker);
  }

  launch(opts, kicker) {
    const race = new Race(opts);
    race.playerSource = (r, dt) => Object.assign(r.controls, this.input.read(dt, this.settings));
    race.on((type) => {
      if (type === 'raceOver') this.onRaceOver();
    });
    this.race = race;
    const rec = opts.mode === 'timetrial' ? getRecord(opts.track.id) : null;
    this.view = new RaceView(race, this.ctx, this.settings, this.audio, { recordLap: rec?.bestLap });
    this.state = 'intro';
    this.introT = 0;
    this.input.reset();
    this.ui.setRaceChrome(true);
    this.ui.showIntro(race, kicker);
    this.stack = [];
    if (this.params.has('autostart')) this.beginCountdown();
  }

  beginCountdown() {
    if (this.state !== 'intro') return;
    this.audio.unlock();
    this.ui.hideAll();
    this.view.camera.snap(this.race.player.x, this.race.player.y);
    this.state = 'racing';
  }

  pause() {
    if (this.state !== 'racing') return;
    this.state = 'paused';
    this.input.reset();
    this.audio.updateEngine(0, 0, false, 0);
    this.audio.stopEngine();
    this.stack = [];
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.hideAll();
    this.audio.startEngine();
    this.lastTs = 0;
    this.state = 'racing';
  }

  restartRace() {
    if (this.flow.mode === 'grandprix' && this.gp && this.state !== 'paused') return;
    if (!this.lastOpts) return;
    const opts = { ...this.lastOpts };
    if (opts.mode === 'timetrial') opts.ghost = getGhost(opts.track.id);
    this.endRace();
    this.launch(opts, this.lastKicker);
  }

  endRace() {
    if (this.view) this.view.destroy();
    this.view = null;
    this.race = null;
    this.ui.setRaceChrome(false);
    this.ui.setResetVisible(false);
  }

  quitToMenu() {
    this.endRace();
    this.gp = this.flow.mode === 'grandprix' ? null : this.gp;
    this.state = 'menus';
    this.stack = ['title'];
    this.ui.show('menu');
    this.audio.startMusic('menu');
  }

  onRaceOver() {
    const race = this.race;
    const results = race.results();
    this.state = 'post';
    this.ui.setResetVisible(false);
    this.audio.stopEngine();
    const info = { race, results, mode: race.mode };
    if (race.mode === 'grandprix') {
      info.gp = this.gp;
      info.awarded = this.gp.record(results);
    } else if (race.mode === 'timetrial') {
      const me = results.find((r) => r.isPlayer);
      const best = race.bestRun;
      info.tt = saveRun(race.track.id, {
        bestLap: me.bestLap,
        total: me.time,
        shipId: me.shipId,
        ghost: best && Math.abs(best.time - me.bestLap) < 1e-6 ? { frames: best.frames, dt: best.dt, ship: best.ship, time: best.time } : null,
      });
    }
    setTimeout(() => {
      if (this.race !== race) return;
      this.ui.setRaceChrome(false);
      this.ui.showResults(info);
      this.audio.startMusic('results');
    }, 1600);
  }

  /** Called when the tab is hidden. */
  onHidden() {
    if (this.state === 'racing') this.pause();
    this.input.reset();
  }
}
