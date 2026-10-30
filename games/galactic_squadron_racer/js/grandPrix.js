/**
 * Grand Prix championship: a cup is a list of tracks raced back to back by
 * the same four drivers. Points per finishing place come from CONFIG.points.
 * After the first round the grid is set in reverse championship order, so the
 * leader starts at the back.
 */
import { CONFIG } from './config.js';
import { ROSTER } from './shipRoster.js';
import { TRACKS } from './tracks.js';
import { shuffle } from './utils.js';

/** Three distinct AI drivers with distinct ships (never the Probe-Fighter, which isn't in the roster). */
export function pickOpponents(playerShipId, count = 3) {
  const ships = shuffle(ROSTER.filter((s) => s.id !== playerShipId).map((s) => s.id));
  const names = shuffle(CONFIG.ai.names.slice());
  const colors = CONFIG.ai.colors;
  return Array.from({ length: count }, (_, i) => ({ shipId: ships[i], name: names[i], color: colors[i % colors.length] }));
}

export class Championship {
  constructor(cup, difficulty, playerShipId) {
    this.cup = cup;
    this.difficulty = difficulty;
    this.trackIds = cup.tracks ? cup.tracks.slice() : shuffle(TRACKS.map((t) => t.id)).slice(0, cup.randomCount || 4);
    this.round = 0;
    const ai = pickOpponents(playerShipId);
    this.drivers = [
      { id: 'player', name: 'YOU', shipId: playerShipId, color: '#38d6ff', isPlayer: true, points: 0, results: [] },
      ...ai.map((o, i) => ({ id: 'ai' + i, ...o, isPlayer: false, points: 0, results: [] })),
    ];
  }

  get trackId() {
    return this.trackIds[this.round];
  }

  get done() {
    return this.round >= this.trackIds.length;
  }

  get player() {
    return this.drivers[0];
  }

  /** Grid order for this round: reverse standings after round one (player 4th in round one). */
  gridOrder() {
    if (this.round === 0) return [...this.drivers.slice(1), this.drivers[0]];
    return this.standings().reverse();
  }

  raceConfig() {
    const grid = this.gridOrder();
    const playerSlot = grid.findIndex((d) => d.isPlayer);
    const opponents = grid.filter((d) => !d.isPlayer).map((d) => ({ shipId: d.shipId, name: d.name, color: d.color, driverId: d.id }));
    return { playerShip: this.player.shipId, opponents, playerSlot, difficulty: this.difficulty };
  }

  /** Awards points from race results (matched by name) and advances to the next round. */
  record(results) {
    const awarded = [];
    for (const r of results) {
      const d = r.isPlayer ? this.player : this.drivers.find((x) => !x.isPlayer && x.name === r.name);
      if (!d) continue;
      const pts = CONFIG.points[r.place - 1] || 0;
      d.points += pts;
      d.results.push({ trackId: this.trackId, place: r.place, time: r.time, bestLap: r.bestLap, points: pts });
      awarded.push({ name: d.name, points: pts });
    }
    this.round++;
    return awarded;
  }

  standings() {
    return this.drivers.slice().sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      // tie-break: more wins, then better best finish
      const wins = (d) => d.results.filter((r) => r.place === 1).length;
      if (wins(b) !== wins(a)) return wins(b) - wins(a);
      const best = (d) => Math.min(...d.results.map((r) => r.place), 9);
      return best(a) - best(b);
    });
  }

  /** Summary of the player's championship for the final screen. */
  playerSummary() {
    const res = this.player.results;
    const places = res.map((r) => r.place);
    const bestLap = Math.min(...res.map((r) => r.bestLap));
    return {
      points: this.player.points,
      wins: places.filter((p) => p === 1).length,
      podiums: places.filter((p) => p <= 3).length,
      avgPlace: places.length ? places.reduce((a, b) => a + b, 0) / places.length : 0,
      bestLap,
      bestLapTrack: res.find((r) => r.bestLap === bestLap)?.trackId,
      position: this.standings().findIndex((d) => d.isPlayer) + 1,
    };
  }
}
