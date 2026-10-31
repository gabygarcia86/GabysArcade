// Leaderboard dialog: pick a song and difficulty, see that board's top 10.

import { hasBoard, leaderboard } from '../leaderboard.js?v=2';
import { $, $$, el, openModal, topModal } from '../util/dom.js';

export class LeaderboardModal {
  constructor(app) {
    this.app = app;
    this.modal = $('#modal-leaderboard');
    this.songSelect = $('#board-song');
    this.difficulty = 'normal';
    this.request = 0;
    this.songSelect.addEventListener('change', () => this.load());
    for (const tab of $$('#board-difficulty button')) {
      tab.addEventListener('click', () => {
        this.setDifficulty(tab.dataset.diff);
        this.load();
      });
    }
  }

  setDifficulty(difficulty) {
    this.difficulty = difficulty;
    for (const tab of $$('#board-difficulty button')) {
      tab.setAttribute('aria-checked', String(tab.dataset.diff === difficulty));
    }
  }

  /** Opens on a song and difficulty. `own` ({ name, score }) highlights a score just submitted. */
  open(songId, difficulty, own = null) {
    const songs = this.app.library.songs.filter(hasBoard);
    this.songSelect.replaceChildren(...songs.map((s) => el('option', { value: s.id, text: `${s.title} — ${s.artist}` })));
    this.songSelect.value = songs.some((s) => s.id === songId) ? songId : songs[0].id;
    this.setDifficulty(difficulty);
    if (topModal() !== this.modal) openModal('modal-leaderboard');
    this.load(own);
  }

  async load(own = null) {
    const list = $('#board-list');
    const status = $('#board-status');
    const request = ++this.request;
    list.replaceChildren();
    status.textContent = 'Loading…';

    let rows = null;
    try {
      rows = await leaderboard.top(this.songSelect.value, this.difficulty);
    } catch {
      rows = null;
    }
    if (request !== this.request) return;

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
      const item = el(
        'li',
        {},
        el('span', { text: row.name }),
        el('b', { text: row.score.toLocaleString('en-US') }),
        el('small', { text: `${row.accuracy.toFixed(2)}%` }),
      );
      if (own && !ownRow && row.name === own.name && row.score === own.score) ownRow = item;
      list.append(item);
    }

    ownRow?.classList.add('own');
    status.textContent = own && !ownRow ? `Your ${own.score.toLocaleString('en-US')} didn't reach the top 10` : '';
  }
}
