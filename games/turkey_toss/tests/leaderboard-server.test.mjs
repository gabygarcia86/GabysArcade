// Checks for the leaderboard Edge Function's round replay. No browser or Deno needed.
// From the repository root:
//   node --test games/turkey_toss/tests/leaderboard-server.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { verifyRound, cleanName as serverCleanName, LIMITS } from '../supabase/functions/turkey-toss-score/verify.js';
import { cleanName as clientCleanName } from '../js/leaderboard.js';
import { PLATES } from '../js/config.js';

const GAME_COPIES = ['config.js', 'multipliers.js', 'scoring.js'];

/** Builds a round log in any order. `toss()` returns the new throw number. */
function round() {
  const events = [];
  let thrown = 0;
  return {
    events,
    toss(t) {
      events.push([t, 'throw', thrown]);
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
    endOnTime() {
      events.push([60.00000000000001, 'end', 'time']);
      return this.sorted();
    },
  };
}

/** One thrown leg that lands on `plateId` `flight` seconds later. */
function landing(r, t, plateId, flight = 1.5) {
  const slice = r.toss(t);
  r.add(t + flight, 'plate', slice, plateId);
}

function rejectedFor(events, score) {
  const result = verifyRound(events, score);
  assert.equal(result.ok, false, 'expected the round to be rejected');
  return result.reason;
}

test('the function scores with exact copies of the game\'s scoring files', () => {
  for (const file of GAME_COPIES) {
    const game = readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
    const copy = readFileSync(new URL(`../supabase/functions/turkey-toss-score/game/${file}`, import.meta.url), 'utf8');
    assert.equal(copy, game, `supabase/functions/turkey-toss-score/game/${file} is out of date. Copy js/${file} over it.`);
  }
});

test('the server cleans names the same way the game does', () => {
  for (const raw of ['  Gaby  ', 'a\tb\nc', 'x'.repeat(30), 'emoji 🦃 name', '\u0007bell', '   ', 'trailing space after cut ']) {
    assert.equal(serverCleanName(raw), clientCleanName(raw));
  }
});

test('a plain round scores its landings', () => {
  const r = round();
  landing(r, 0.5, 'center-back');
  landing(r, 1.5, 'left-1');
  const result = verifyRound(r.endOnTime(), 11);
  assert.equal(result.ok, true);
  assert.equal(result.score, 11);
  assert.ok(result.minSeconds > 61, 'the round must have lasted the ready count plus 60 seconds');
});

test('bowl bonuses multiply later landings until their 10 seconds run out', () => {
  const r = round();
  const gravy = r.toss(1);
  r.add(2.5, 'bowl', gravy, 'gravy'); // 3x until 12.5
  landing(r, 2, 'right-4', 2); // 5 x 3 at 4
  landing(r, 11, 'right-4', 1.4); // 5 x 3 at 12.4
  landing(r, 11.5, 'right-4', 1); // 5 at 12.5: the bonus has ended
  assert.deepEqual(verifyRound(r.endOnTime(), 15 + 15 + 5).ok, true);
});

test('the ninth plate scores before the table bonus, and later landings get 4x', () => {
  const r = round();
  PLATES.forEach((plate, i) => landing(r, 0.5 + i * 0.5, plate.id));
  landing(r, 10, 'left-1');
  const plain = PLATES.reduce((sum, plate) => sum + plate.points, 0);
  assert.equal(verifyRound(r.endOnTime(), plain + 4).score, plain + 4);
});

test('a bounce gives that landing 10x', () => {
  const r = round();
  const slice = r.toss(1);
  r.add(1.6, 'bounce', slice).add(3, 'plate', slice, 'left-3');
  assert.equal(verifyRound(r.endOnTime(), 30).ok, true);
});

test('floor drops cost 10 but never go below zero, and the flying turkey adds 100', () => {
  const r = round();
  r.add(1, 'floor', r.toss(0.5)); // 0 - 10 stays at 0
  landing(r, 2, 'center-back'); // 10
  r.add(20, 'flyer', r.toss(19)); // 110
  r.add(22, 'floor', 2); // the knocked-down leg reaches the floor: 100
  assert.equal(verifyRound(r.endOnTime(), 100).ok, true);
});

test('legs still flying at the buzzer can land, at the buzzer\'s time', () => {
  const r = round();
  const slice = r.toss(59.8);
  r.endOnTime();
  r.add(60.00000000000001, 'plate', slice, 'center-back');
  assert.equal(verifyRound(r.sorted(), 10).ok, true);
});

test('a round that runs out of legs early ends then', () => {
  const r = round();
  for (let i = 0; i < 60; i++) r.toss(0.5 + i * 0.5);
  r.add(31.5, 'plate', 59, 'center-back');
  r.add(32, 'end', 'slices');
  const result = verifyRound(r.sorted(), 10);
  assert.equal(result.ok, true, result.reason);
  assert.ok(result.minSeconds > 33 && result.minSeconds < 34);
});

test('a near-perfect real round worth over 15 billion is accepted', () => {
  const r = round();
  PLATES.forEach((plate, i) => landing(r, 0.5 + i * 0.5, plate.id, 2));
  // 17 gravy hits, one every half second, then a bounce onto a 3 point plate.
  for (let i = 0; i < 17; i++) r.add(20 + i * 0.5 + 1.2, 'bowl', r.toss(20 + i * 0.5), 'gravy');
  const last = r.toss(28.5);
  r.add(29.1, 'bounce', last).add(30.5, 'plate', last, 'left-3');
  const expected = 32 + 3 * 3 ** 17 * 4 * 10;
  const result = verifyRound(r.endOnTime(), expected);
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.score, 15_496_819_592);
});

test('a score that does not match its round is rejected', () => {
  const r = round();
  landing(r, 0.5, 'center-back');
  assert.match(rejectedFor(r.endOnTime(), 15_000_000_000), /does not match/);
});

test('rounds with no positive score are rejected', () => {
  const r = round();
  r.toss(0.5);
  assert.match(rejectedFor(r.endOnTime(), 0), /above zero/);
});

test('throws faster than the game allows are rejected', () => {
  const quick = round();
  quick.toss(1);
  quick.toss(1.1);
  assert.match(rejectedFor(quick.endOnTime(), 1), /too quickly/);

  // A script throwing every 0.3 s, all into the gravy: the bonus window fills up.
  const script = round();
  for (let i = 0; i < 30; i++) script.add(i * 0.3 + 1.2, 'bowl', script.toss(i * 0.3), 'gravy');
  assert.equal(LIMITS.maxThrowsPerWindow < 30, true);
  assert.match(rejectedFor(script.endOnTime(), 1), /too quickly/);
});

test('a leg cannot reach a target faster than the hardest throw', () => {
  const r = round();
  r.add(0.8, 'bowl', r.toss(0.5), 'gravy');
  assert.match(rejectedFor(r.endOnTime(), 1), /faster than a throw/);

  const plate = round();
  plate.add(0.6, 'plate', plate.toss(0.5), 'center-back');
  assert.match(rejectedFor(plate.endOnTime(), 10), /faster than a throw/);
});

test('each leg finishes once', () => {
  const twice = round();
  const slice = twice.toss(0.5);
  twice.add(2, 'plate', slice, 'left-1').add(2.5, 'plate', slice, 'left-1');
  assert.match(rejectedFor(twice.endOnTime(), 2), /already finished/);

  const ghost = round();
  ghost.add(2, 'plate', 3, 'left-1');
  assert.match(rejectedFor(ghost.endOnTime(), 1), /never thrown/);

  const bouncy = round();
  const b = bouncy.toss(0.5);
  for (let i = 0; i < 4; i++) bouncy.add(1 + i * 0.3, 'bounce', b);
  assert.match(rejectedFor(bouncy.endOnTime(), 1), /bounced too many/);
});

test('the flying turkey is hit at most once, and only while it is around', () => {
  const early = round();
  early.add(5, 'flyer', early.toss(4));
  assert.match(rejectedFor(early.endOnTime(), 100), /while it was away/);

  const twice = round();
  twice.add(20, 'flyer', twice.toss(19));
  twice.add(21, 'flyer', twice.toss(20));
  assert.match(rejectedFor(twice.endOnTime(), 200), /hit twice/);
});

test('the clock and the round end are checked', () => {
  const unordered = round();
  landing(unordered, 5, 'left-1');
  unordered.toss(1);
  unordered.endOnTime();
  assert.match(rejectedFor(unordered.events, 1), /out of order/);

  const endless = round();
  landing(endless, 1, 'left-1');
  assert.match(rejectedFor(endless.sorted(), 1), /never ended/);

  const short = round();
  landing(short, 1, 'left-1');
  short.add(30, 'end', 'time');
  assert.match(rejectedFor(short.sorted(), 1), /before time ran out/);

  const notEmpty = round();
  landing(notEmpty, 1, 'left-1');
  notEmpty.add(30, 'end', 'slices');
  assert.match(rejectedFor(notEmpty.sorted(), 1), /still on the platter/);

  const ticking = round();
  const slice = ticking.toss(59);
  ticking.endOnTime();
  ticking.add(61, 'plate', slice, 'left-1');
  assert.match(rejectedFor(ticking.sorted(), 1), /after the buzzer/);

  const lateThrow = round();
  lateThrow.endOnTime();
  lateThrow.toss(60.00000000000001);
  assert.match(rejectedFor(lateThrow.sorted(), 1), /after the buzzer/);

  const greedy = round();
  for (let i = 0; i < 61; i++) greedy.toss(i * 0.5);
  assert.match(rejectedFor(greedy.endOnTime(), 1), /more than 60/);
});

test('malformed logs are rejected without throwing', () => {
  for (const events of [undefined, null, 'log', {}, [], [[1]], [['1', 'throw', 0]], [[0, 'teleport', 0]],
    [[0, 'throw', 0], [1, 'bowl', 0, 'butter']], [[0, 'throw', 0], [2, 'plate', 0, 'table']],
    [[NaN, 'throw', 0]], [[-1, 'throw', 0]], [[0, 'throw', 0.5]], new Array(LIMITS.maxEvents + 1).fill([0, 'end', 'time'])]) {
    assert.equal(verifyRound(events, 1).ok, false, JSON.stringify(events)?.slice(0, 80));
  }
});
