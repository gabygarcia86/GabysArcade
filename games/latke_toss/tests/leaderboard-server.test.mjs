// Checks for the scoring rules and the leaderboard Edge Function's round replay. No browser
// or Deno needed. From the repository root:
//   node --test games/latke_toss/tests/leaderboard-server.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { RoundScore } from '../js/scoring.js';
import { cleanName as clientCleanName } from '../js/leaderboard.js';
import { verifyRound, cleanName as serverCleanName, LIMITS } from '../supabase/functions/latke-toss-score/verify.js';

const GAME_COPIES = ['config.js', 'scoring.js'];

/** Builds a round log in any order. `toss()` returns the new throw number. */
function round() {
  const events = [];
  let thrown = 0;
  return {
    events,
    toss(t, golden = false) {
      events.push(golden ? [t, 'throw', thrown, 'golden'] : [t, 'throw', thrown]);
      return thrown++;
    },
    add(...entry) {
      events.push(entry);
      return this;
    },
    /** The log in time order, as the game writes it. The sort is stable, so ties keep their order. */
    sorted() {
      return [...events].sort((a, b) => a[0] - b[0]);
    },
  };
}

/** Throws `count` latkes from `start`, one every `gap` seconds, each landing `flight` later. */
function landings(r, start, count, { gap = 0.5, flight = 1, clean = false } = {}) {
  for (let i = 0; i < count; i++) {
    const t = start + i * gap;
    const latke = r.toss(t);
    if (clean) r.add(t + flight, 'hit', latke, 'clean');
    else r.add(t + flight, 'hit', latke);
  }
}

function rejectedFor(events, score, difficulty = 'easy') {
  const result = verifyRound(events, score, difficulty);
  assert.equal(result.ok, false, 'expected the round to be rejected');
  return result.reason;
}

// ---------- The scoring rules (js/scoring.js) ----------

test('a latke is worth 10, plus 5 for a clean drop, and 50 if golden', () => {
  const scoring = new RoundScore();
  assert.equal(scoring.landLatke({ golden: false, clean: false }).points, 10);
  assert.equal(scoring.landLatke({ golden: false, clean: true }).points, 15);
  // The third in a row reaches the 1.5x tier and scores with it: 55 x 1.5.
  assert.equal(scoring.landLatke({ golden: true, clean: true }).points, 83);
  assert.equal(scoring.score, 108);
});

test('streak tiers apply from the latke that reaches them, and a miss resets them', () => {
  const scoring = new RoundScore();
  const multipliers = [];
  for (let i = 0; i < 50; i++) multipliers.push(scoring.landLatke({ golden: false, clean: false }).multiplier);
  // Ignore the menorah, which doubles everything from the 10th latke on.
  const streak = multipliers.map((m, i) => (i >= 9 ? m / 2 : m));
  assert.deepEqual([streak[1], streak[2], streak[5], streak[9], streak[14], streak[19], streak[49]], [1, 1.5, 2, 4, 8, 16, 256]);
  assert.deepEqual(scoring.missLatke(), { lost: 50, tierLost: true });
  assert.equal(scoring.multiplier, 2);
});

test('the ninth candle starts the menorah bonus after its own latke scores, and a menorah hit ends it', () => {
  const scoring = new RoundScore();
  for (let i = 0; i < 8; i++) {
    scoring.landLatke({ golden: false, clean: false });
    scoring.missLatke(); // keeps the streak out of the way
  }
  const ninth = scoring.landLatke({ golden: false, clean: false });
  assert.equal(ninth.points, 10);
  assert.equal(ninth.menorahLit, true);
  assert.equal(scoring.multiplier, 2);
  assert.deepEqual(scoring.hitMenorah(), { candleOut: true, bonusLost: true });
  assert.equal(scoring.multiplier, 1);
  assert.equal(scoring.landLatke({ golden: false, clean: false }).menorahLit, true);
});

test('dreidel boosts double points for 10 seconds each and stack', () => {
  const scoring = new RoundScore();
  scoring.hitDreidel(1);
  scoring.hitDreidel(4);
  assert.equal(scoring.multiplier, 4);
  assert.equal(scoring.expireBoosts(10.9), false);
  assert.equal(scoring.expireBoosts(11), true);
  assert.equal(scoring.multiplier, 2);
});

test('the Final Fry doubles points for the last 10 seconds', () => {
  const scoring = new RoundScore();
  assert.equal(scoring.checkFinalFry(49.9), false);
  assert.equal(scoring.checkFinalFry(50), true);
  assert.equal(scoring.checkFinalFry(51), false);
  assert.equal(scoring.multiplier, 2);
});

// ---------- The leaderboard's round replay (verify.js) ----------

test('the function scores with exact copies of the game\'s scoring files', () => {
  for (const file of GAME_COPIES) {
    const game = readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
    const copy = readFileSync(new URL(`../supabase/functions/latke-toss-score/game/${file}`, import.meta.url), 'utf8');
    assert.equal(copy, game, `supabase/functions/latke-toss-score/game/${file} is out of date. Copy js/${file} over it.`);
  }
});

test('the server cleans names the same way the game does', () => {
  for (const raw of ['  Gaby  ', 'a\tb\nc', 'x'.repeat(30), 'emoji 🥔 name', '\u0007bell', '   ', 'trailing space after cut ']) {
    assert.equal(serverCleanName(raw), clientCleanName(raw));
  }
});

test('a plain round scores its landings, and the round must have lasted a full minute', () => {
  const r = round();
  landings(r, 1, 2);
  r.add(5, 'miss', r.toss(4));
  const result = verifyRound(r.sorted(), 20, 'easy');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.score, 20);
  assert.ok(result.minSeconds > 61);
});

test('a full round with every bonus matches the game\'s scoring', () => {
  const r = round();
  // Twelve clean landings in a row: streak tiers, then the menorah from the 10th on.
  landings(r, 1, 12, { clean: true });
  // A dreidel boost from a latke that missed, then a golden latke and a Final Fry landing.
  const bouncer = r.toss(8);
  r.add(8.6, 'dreidel', bouncer, 3).add(9, 'miss', bouncer);
  r.add(10, 'hit', r.toss(9, true));
  r.add(51, 'hit', r.toss(50));

  const expected = new RoundScore();
  for (let i = 0; i < 12; i++) expected.landLatke({ golden: false, clean: true });
  expected.hitDreidel(8.6);
  expected.missLatke();
  expected.landLatke({ golden: true, clean: false }); // dreidel 2x, menorah 2x
  expected.expireBoosts(51);
  expected.checkFinalFry(51);
  expected.landLatke({ golden: false, clean: false }); // menorah 2x, Final Fry 2x
  const result = verifyRound(r.sorted(), expected.score, 'medium');
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.score, expected.score);
});

test('a score that does not match its round is rejected', () => {
  const r = round();
  landings(r, 1, 3);
  assert.match(rejectedFor(r.sorted(), 99_999_999), /does not match/);
});

test('the difficulty must be real, and scores must fit the board', () => {
  const r = round();
  landings(r, 1, 1);
  assert.match(rejectedFor(r.sorted(), 10, 'impossible'), /difficulty/);
  const empty = round();
  empty.add(2, 'miss', empty.toss(1));
  assert.match(rejectedFor(empty.sorted(), 0), /above zero/);
});

test('throws faster than the game allows are rejected', () => {
  const quick = round();
  quick.toss(1);
  quick.toss(1.1);
  assert.match(rejectedFor(quick.sorted(), 1), /too quickly/);

  // A script throwing every 0.3 s into a dreidel: the boost window fills up.
  const script = round();
  for (let i = 0; i < 30; i++) script.add(i * 0.3 + 0.5, 'dreidel', script.toss(i * 0.3), 0);
  assert.equal(LIMITS.maxThrowsPerWindow < 30, true);
  assert.match(rejectedFor(script.sorted(), 1), /too quickly/);
});

test('golden latkes can\'t come more often than the game makes them', () => {
  const first = round();
  first.add(2, 'hit', first.toss(1, true));
  assert.match(rejectedFor(first.sorted(), 50), /golden/);

  const close = round();
  for (let i = 0; i < 6; i++) close.toss(1 + i * 0.5);
  close.toss(4, true); // the 7th latke: allowed
  for (let i = 0; i < 6; i++) close.toss(5 + i * 0.5);
  close.toss(8.5, true); // only 6 latkes after the last golden one: allowed, it's the 7th
  close.toss(9, true); // right after: not allowed
  assert.match(rejectedFor(close.sorted(), 1), /golden/);
});

test('a latke can\'t reach the pot faster than the hardest throw', () => {
  const r = round();
  r.add(1.05, 'hit', r.toss(1));
  assert.match(rejectedFor(r.sorted(), 10), /faster than a throw/);
});

test('each latke lands or misses once, and only it can hit things', () => {
  const twice = round();
  const latke = twice.toss(1);
  twice.add(2, 'hit', latke).add(2.5, 'hit', latke);
  assert.match(rejectedFor(twice.sorted(), 20), /twice/);

  const ghost = round();
  ghost.add(2, 'hit', 4);
  assert.match(rejectedFor(ghost.sorted(), 10), /never thrown/);

  const sameDreidel = round();
  const d = sameDreidel.toss(1);
  sameDreidel.add(1.5, 'dreidel', d, 2).add(1.7, 'dreidel', d, 2);
  assert.match(rejectedFor(sameDreidel.sorted(), 1), /same dreidel/);

  const sixth = round();
  sixth.add(1.5, 'dreidel', sixth.toss(1), 5);
  assert.match(rejectedFor(sixth.sorted(), 1), /unknown dreidel/);

  const afterPot = round();
  const p = afterPot.toss(1);
  afterPot.add(2, 'hit', p).add(2.2, 'menorah', p);
  assert.match(rejectedFor(afterPot.sorted(), 10), /after landing/);
});

test('the clock is checked', () => {
  const unordered = round();
  landings(unordered, 5, 1);
  unordered.toss(1);
  assert.match(rejectedFor(unordered.events, 10), /out of order/);

  const late = round();
  late.add(60.5, 'hit', late.toss(59.8));
  assert.match(rejectedFor(late.sorted(), 20), /after the buzzer/);
});

test('malformed logs are rejected without throwing', () => {
  for (const events of [undefined, null, 'log', {}, [], [[1]], [['1', 'throw', 0]], [[0, 'teleport', 0]],
    [[0, 'throw', 0, 'shiny']], [[0, 'throw', 0], [1, 'hit', 0, 'dirty']], [[0, 'throw', 0], [1, 'miss', 0, 'x']],
    [[0, 'throw', 0], [1, 'dreidel', 0, '1']], [[NaN, 'throw', 0]], [[-1, 'throw', 0]], [[0, 'throw', 0.5]],
    new Array(LIMITS.maxEvents + 1).fill([0, 'miss', 0])]) {
    assert.equal(verifyRound(events, 1, 'easy').ok, false, JSON.stringify(events)?.slice(0, 80));
  }
});
