import { FLYING_TURKEY } from './config.js';
import { FlightPhase } from './props.js';
import { formatNumber } from './scoring.js';
import { leaderboard, cleanName, loadName, saveName, NAME_MAX } from './leaderboard.js';

const $ = (id) => document.getElementById(id);

const BOOST_LABELS = { cranberry: 'Cranberry', gravy: 'Gravy', cornucopia: 'Cornucopia' };

const FLYING_TEXT = {
  [FlightPhase.WAITING]: 'Flying turkey: waiting',
  [FlightPhase.INCOMING]: 'Flying turkey: incoming!',
  [FlightPhase.FLYING]: 'Flying turkey: hit it!',
  [FlightPhase.HIT]: `Flying turkey: hit! +${FLYING_TURKEY.bonusPoints}`,
  [FlightPhase.GONE]: 'Flying turkey: got away',
};

/**
 * Thin wrapper around the DOM overlay: screens, HUD values, popups and button wiring.
 * Holds no game rules; the Game decides what to show and when.
 */
export class UI {
  constructor() {
    this.screens = {
      menu: $('screen-menu'),
      how: $('screen-how'),
      pause: $('screen-pause'),
      over: $('screen-over'),
      leaderboard: $('screen-leaderboard'),
      error: $('screen-error'),
    };
    this.hud = $('hud');
    this.hudControls = $('hud-controls');
    this.scoreBox = $('hud-score-box');
    this.scoreValue = $('hud-score');
    this.timeBox = $('hud-time-box');
    this.timeValue = $('hud-time');
    this.slicesValue = $('hud-slices');
    this.platesBox = $('hud-plates-box');
    this.platesValue = $('hud-plates');
    this.calculation = $('hud-calc');
    this.flyingChip = $('chip-flying');
    this.hint = $('hint');
    this.banner = $('banner');
    this.popupLayer = $('popup-layer');
    this.pauseButton = $('btn-pause');
    this.muteButtons = Array.from(document.querySelectorAll('.mute-toggle'));
    this.sfxSliders = Array.from(document.querySelectorAll('.volume-sfx'));
    this.musicSliders = Array.from(document.querySelectorAll('.volume-music'));
    this.currentScreen = 'menu';
    this.flyingPhase = null;
    this.boostText = {};
    this._lastTime = null;
    this._bannerTimer = 0;
    this._calculationTimer = 0;
    this.boardReturn = 'menu';
    this.boardRequest = 0;
    this.pendingScore = null;
    this.overRun = 0;
    this.submitting = false;
  }

  /** Wires buttons to handler callbacks. */
  bind(handlers) {
    const on = (id, handler) => $(id).addEventListener('click', () => handler());
    on('btn-start', handlers.onStart);
    on('btn-how', () => this.showScreen('how'));
    on('btn-how-back', () => this.showScreen('menu'));
    on('btn-pause', handlers.onPauseToggle);
    on('btn-restart', handlers.onRestart);
    on('btn-resume', handlers.onPauseToggle);
    on('btn-pause-restart', handlers.onRestart);
    on('btn-pause-menu', handlers.onMenu);
    on('btn-play-again', handlers.onRestart);
    on('btn-over-menu', handlers.onMenu);
    on('btn-menu-board', () => this.openLeaderboard('menu'));
    on('btn-over-board', () => this.openLeaderboard('over'));
    on('btn-board-back', () => this.closeLeaderboard());
    $('score-name').maxLength = NAME_MAX;
    $('score-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.submitScore();
    });
    for (const button of this.muteButtons) button.addEventListener('click', () => handlers.onMuteToggle());
    this._bindSliders(this.sfxSliders, handlers.onSfxVolume);
    this._bindSliders(this.musicSliders, handlers.onMusicVolume);
    // Any button press counts as the user gesture that unlocks audio.
    document.addEventListener('pointerdown', handlers.onAnyInteraction, { capture: true });
    document.addEventListener('keydown', handlers.onAnyInteraction, { capture: true });
  }

  // There's a copy of each slider on the menu and pause screens, so keep the pair in step.
  _bindSliders(sliders, handler) {
    for (const slider of sliders) {
      slider.addEventListener('input', () => {
        for (const other of sliders) other.value = slider.value;
        handler(Number(slider.value) / 100);
      });
    }
  }

  setVolumes(sfx, music) {
    for (const slider of this.sfxSliders) slider.value = String(Math.round(sfx * 100));
    for (const slider of this.musicSliders) slider.value = String(Math.round(music * 100));
  }

  showScreen(name) {
    for (const [key, element] of Object.entries(this.screens)) {
      element.classList.toggle('hidden', key !== name);
    }
    this.currentScreen = name;
  }

  /** Escape on a screen opened from another screen. Returns true if it closed one. */
  closeSubScreen() {
    if (this.currentScreen === 'leaderboard') {
      this.closeLeaderboard();
      return true;
    }
    if (this.currentScreen === 'how') {
      this.showScreen('menu');
      return true;
    }
    return false;
  }

  setHudVisible(visible) {
    this.hud.classList.toggle('hidden', !visible);
    this.hudControls.classList.toggle('hidden', !visible);
  }

  setBest(best) {
    $('menu-best').textContent = formatNumber(best);
  }

  setScore(score, animate = false) {
    this.scoreValue.textContent = formatNumber(score);
    if (animate) {
      this.scoreBox.classList.remove('bump');
      // Force a reflow so the animation restarts on rapid hits.
      void this.scoreBox.offsetWidth;
      this.scoreBox.classList.add('bump');
    }
  }

  /** Shows a timed bonus and its countdown, or nothing when it isn't running. */
  setBoost(kind, factor, secondsLeft) {
    const text = factor > 1 ? `${BOOST_LABELS[kind]} ×${formatNumber(factor)} ${Math.ceil(secondsLeft)}s` : '';
    if (text === this.boostText[kind]) return;
    this.boostText[kind] = text;
    const chip = $(`chip-${kind}`);
    chip.textContent = text;
    chip.classList.toggle('hidden', !text);
  }

  flashPenalty() {
    this.scoreBox.classList.remove('penalty');
    // Force a reflow so the animation restarts on rapid hits.
    void this.scoreBox.offsetWidth;
    this.scoreBox.classList.add('penalty');
  }

  setSlices(count) {
    this.slicesValue.textContent = String(count);
  }

  setPlates(count) {
    this.platesValue.textContent = String(count);
    this.platesBox.classList.toggle('complete', count === 9);
  }

  /** Shows the combined multiplier and whether the table bonus is active. */
  setMultipliers({ total, table }) {
    const totalChip = $('hud-total');
    totalChip.textContent = `×${formatNumber(total)}`;
    totalChip.classList.toggle('active', total > 1);
    $('chip-table').classList.toggle('hidden', table <= 1);
  }

  setFlyingStatus(phase) {
    this.flyingPhase = phase;
    this.flyingChip.textContent = FLYING_TEXT[phase];
    this.flyingChip.dataset.phase = phase;
  }

  /** Shows a score sum such as "5 × 12X = 60" under the HUD for a moment. */
  setCalculation(text) {
    clearTimeout(this._calculationTimer);
    this.calculation.textContent = text || '';
    this.calculation.classList.toggle('hidden', !text);
    if (text) {
      this._calculationTimer = setTimeout(() => this.calculation.classList.add('hidden'), 2400);
    }
  }

  setTime(secondsLeft) {
    const shown = Math.max(0, Math.ceil(secondsLeft));
    if (shown === this._lastTime) return;
    this._lastTime = shown;
    this.timeValue.textContent = String(shown);
    this.timeBox.classList.toggle('low', shown <= 10 && shown > 0);
  }

  resetTime() {
    this._lastTime = null;
  }

  setPaused(paused) {
    this.pauseButton.innerHTML = paused ? '&#9654;' : '&#10074;&#10074;';
    this.pauseButton.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
  }

  setMuted(muted) {
    for (const button of this.muteButtons) {
      button.innerHTML = muted ? '&#128263;' : '&#128266;';
      button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    }
  }

  showHint(visible) {
    this.hint.classList.toggle('hidden', !visible);
    this.hint.classList.remove('faded');
  }

  fadeHint() {
    this.hint.classList.add('faded');
  }

  showBanner(text, { gold = false, duration = 900 } = {}) {
    clearTimeout(this._bannerTimer);
    this.banner.textContent = text;
    this.banner.classList.toggle('gold', gold);
    this.banner.classList.remove('hidden');
    // Restart the entry animation.
    this.banner.style.animation = 'none';
    void this.banner.offsetWidth;
    this.banner.style.animation = '';
    if (duration > 0) {
      this._bannerTimer = setTimeout(() => this.hideBanner(), duration);
    }
  }

  hideBanner() {
    clearTimeout(this._bannerTimer);
    this.banner.classList.add('hidden');
  }

  /** Floating text at a canvas pixel position (e.g. "+5" above a plate). */
  popup(x, y, html, className = '') {
    const element = document.createElement('div');
    element.className = `popup ${className}`.trim();
    element.innerHTML = html;
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    element.addEventListener('animationend', () => element.remove(), { once: true });
    this.popupLayer.appendChild(element);
    // Safety net in case animationend never fires (e.g. reduced motion settings).
    setTimeout(() => element.remove(), 2000);
  }

  clearPopups() {
    this.popupLayer.replaceChildren();
  }

  showGameOver(result) {
    const { score, best, isNewBest } = result;
    $('final-title').textContent = result.title;
    $('final-score').textContent = formatNumber(score);
    $('final-score').classList.toggle('long', score >= 1e6);
    $('final-new-best').classList.toggle('hidden', !isNewBest || best === 0);
    $('final-message').textContent = result.message;
    $('stat-multiplier').textContent = `×${formatNumber(result.highestMultiplier)}`;
    $('stat-plates').textContent = `${result.plates} / 9`;
    $('stat-cranberry').textContent = String(result.cranberryHits);
    $('stat-gravy').textContent = String(result.gravyHits);
    $('stat-cornucopia').textContent = String(result.cornucopiaHits);
    $('stat-floor').textContent = String(result.floorDrops);
    $('stat-bounces').textContent = String(result.bounces);
    $('stat-flying').textContent = result.flyingHit ? 'Hit!' : 'Missed';

    this.pendingScore = score > 0 ? score : null;
    this.overRun += 1;
    $('score-form').classList.toggle('hidden', !this.pendingScore);
    $('score-name').value = loadName();
    this.setScoreMessage('');
    this.showScreen('over');
    $('btn-play-again').focus({ preventScroll: true });
  }

  setScoreMessage(text, isError = false) {
    const message = $('score-message');
    message.textContent = text;
    message.classList.toggle('hidden', !text);
    message.classList.toggle('error', isError);
  }

  // ---------- Leaderboard ----------

  async submitScore() {
    if (this.submitting || !this.pendingScore) return;
    const input = $('score-name');
    const name = cleanName(input.value);
    if (!name) {
      this.setScoreMessage('Enter a name first', true);
      input.focus();
      return;
    }

    const score = this.pendingScore;
    const run = this.overRun;
    const button = $('score-form').querySelector('button');
    const label = button.textContent;
    this.submitting = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    this.setScoreMessage('');
    saveName(name);

    let sent = true;
    try {
      await leaderboard.submit(name, score);
    } catch {
      sent = false;
    }

    this.submitting = false;
    button.disabled = false;
    button.textContent = label;
    if (run !== this.overRun) return;

    if (!sent) {
      this.setScoreMessage('Score not sent. Check your connection and try again.', true);
      return;
    }
    this.pendingScore = null;
    $('score-form').classList.add('hidden');
    this.setScoreMessage('Score submitted');
    if (this.currentScreen === 'over') this.openLeaderboard('over', { name, score });
  }

  /** Opens the board. `own` ({ name, score }) highlights a score just submitted. */
  openLeaderboard(returnTo, own = null) {
    this.boardReturn = returnTo;
    this.showScreen('leaderboard');
    this.loadBoard(own);
    $('btn-board-back').focus({ preventScroll: true });
  }

  closeLeaderboard() {
    this.showScreen(this.boardReturn);
  }

  async loadBoard(own = null) {
    const list = $('board-list');
    const status = $('board-status');
    const request = ++this.boardRequest;
    list.replaceChildren();
    status.textContent = 'Loading…';

    let rows = null;
    try {
      rows = await leaderboard.top();
    } catch {
      rows = null;
    }
    if (request !== this.boardRequest) return;

    if (!rows) {
      status.textContent = 'Leaderboard unavailable. Check your connection and try again.';
      return;
    }
    if (!rows.length) {
      status.textContent = 'No scores yet. Be the first!';
      return;
    }

    let ownRow = null;
    for (const row of rows) {
      const item = document.createElement('li');
      const name = document.createElement('span');
      const score = document.createElement('b');
      name.textContent = row.name;
      score.textContent = formatNumber(row.score);
      item.append(name, score);
      if (own && !ownRow && row.name === own.name && row.score === own.score) ownRow = item;
      list.append(item);
    }

    if (ownRow) ownRow.classList.add('own');
    status.textContent = own && !ownRow ? `Your ${formatNumber(own.score)} didn't reach the top 10` : '';
  }

  showError(message) {
    if (message) $('error-message').textContent = message;
    this.setHudVisible(false);
    this.showScreen('error');
  }

  setGrabCursor(canGrab) {
    document.body.classList.toggle('can-grab', canGrab);
  }

  setAimingCursor(aiming) {
    document.body.classList.toggle('is-aiming', aiming);
  }
}
