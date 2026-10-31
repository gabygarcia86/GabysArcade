// End-of-song results.

import { cleanName, leaderboard, loadName, NAME_MAX, saveName, submitBlockReason } from '../leaderboard.js?v=2';
import { $, el, topModal } from '../util/dom.js';

const ROWS = [
  ['perfect', 'PERFECT', '#ffffff'],
  ['great', 'GREAT', '#7df9ff'],
  ['good', 'GOOD', '#c9a6ff'],
  ['miss', 'MISS', '#ff4d6d'],
];

export class ResultsScreen {
  constructor(app) {
    this.app = app;
    $('#btn-replay').addEventListener('click', () => app.replay());
    $('#btn-results-songs').addEventListener('click', () => app.ui.reset('songs'));
    $('#btn-results-board').addEventListener('click', () => app.leaderboard.open(app.currentSong?.id, app.currentDifficulty));
    $('#score-name').maxLength = NAME_MAX;
    $('#score-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitScore();
    });
    this.counterRaf = 0;
    this.pendingRun = null;
    this.run = 0;
    this.submitting = false;
  }

  prepareSubmit(song, difficulty, summary) {
    const reason = summary.score > 0 ? submitBlockReason(song, this.app.settings.get('timingWindows')) : '';
    const canSubmit = summary.score > 0 && !reason;
    this.pendingRun = canSubmit ? { song: song.id, difficulty, score: summary.score, accuracy: summary.accuracy } : null;
    this.run += 1;
    $('#score-form').hidden = !canSubmit;
    $('#score-name').value = loadName();
    this.setMessage(reason, false);
  }

  setMessage(text, isError) {
    const message = $('#score-message');
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle('error', isError);
  }

  async submitScore() {
    if (this.submitting || !this.pendingRun) return;
    const input = $('#score-name');
    const name = cleanName(input.value);
    if (!name) {
      this.setMessage('Enter a name first', true);
      input.focus();
      return;
    }

    const entry = { ...this.pendingRun, name };
    const run = this.run;
    const button = $('#score-form button');
    const label = button.textContent;
    this.submitting = true;
    button.disabled = true;
    button.textContent = 'Sending…';
    this.setMessage('', false);
    saveName(name);

    let sent = true;
    try {
      await leaderboard.submit(entry);
    } catch {
      sent = false;
    }

    this.submitting = false;
    button.disabled = false;
    button.textContent = label;
    if (run !== this.run) return;

    if (!sent) {
      this.setMessage('Score not sent. Check your connection and try again.', true);
      return;
    }
    this.pendingRun = null;
    $('#score-form').hidden = true;
    this.setMessage('Score submitted!', false);
    if (this.app.ui.current === 'results' && !topModal()) {
      this.app.leaderboard.open(entry.song, entry.difficulty, { name, score: entry.score });
    }
  }

  onShow({ summary, song, difficulty, newBest }) {
    $('#results-song').textContent = `${song.title} — ${difficulty.toUpperCase()}`;
    $('#results-grade').textContent = summary.grade;
    const badges = [];
    if (summary.fullCombo) badges.push('FULL COMBO');
    if (newBest) badges.push('NEW BEST');
    $('#results-badges').textContent = badges.join(' · ');
    $('#results-accuracy').textContent = `${summary.accuracy.toFixed(2)}%`;
    $('#results-combo').textContent = String(summary.maxCombo);
    $('#results-holds').textContent = `${summary.holds.completed}/${summary.holds.total}`;

    const total = Math.max(1, summary.counts.perfect + summary.counts.great + summary.counts.good + summary.counts.miss);
    const list = $('#results-judgements');
    list.replaceChildren(
      ...ROWS.map(([key, label, color]) => {
        const bar = el('i', { style: { background: color, boxShadow: `0 0 8px ${color}` } });
        const li = el('li', {}, el('span', { text: label, style: { color } }), el('div', { class: 'bar' }, bar), el('b', { text: String(summary.counts[key]) }));
        requestAnimationFrame(() => requestAnimationFrame(() => (bar.style.width = `${(summary.counts[key] / total) * 100}%`)));
        return li;
      }),
    );

    const d = summary.meanDeltaMs;
    const hits = summary.counts.perfect + summary.counts.great + summary.counts.good;
    let hint = '';
    if (hits >= 20 && Math.abs(d) >= 25) {
      hint = `Your hits averaged ${Math.abs(d)} ms ${d > 0 ? 'late' : 'early'}. Try ${d > 0 ? 'raising' : 'lowering'} the audio offset by about ${Math.round(Math.abs(d) / 5) * 5} ms in Settings (or run the calibration).`;
    } else if (hits >= 20) {
      hint = `Timing centred: average error ${d > 0 ? '+' : ''}${d} ms.`;
    }
    $('#results-hint').textContent = hint;
    this.prepareSubmit(song, difficulty, summary);

    // animated score counter
    cancelAnimationFrame(this.counterRaf);
    const scoreEl = $('#results-score');
    const start = performance.now();
    const target = summary.score;
    const step = (now) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      scoreEl.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (t < 1) this.counterRaf = requestAnimationFrame(step);
    };
    this.counterRaf = requestAnimationFrame(step);
  }
}
