// Rules for scores and multipliers. These need no browser. From the repository root:
//   node --test games/turkey_toss/tests/scoring.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Multipliers, MAX_VALUE } from '../js/multipliers.js';
import { scoreLanding, addScore, formatNumber, resultMessage } from '../js/scoring.js';

function withHits({ cranberry = 0, gravy = 0, table = false } = {}) {
  const multipliers = new Multipliers();
  for (let i = 0; i < cranberry; i++) multipliers.addBowlHit('cranberry', 0);
  for (let i = 0; i < gravy; i++) multipliers.addBowlHit('gravy', 0);
  if (table) multipliers.completeTable();
  return multipliers;
}

test('a plain landing scores the plate value with no calculation', () => {
  for (const points of [1, 2, 3, 5, 10]) {
    const result = scoreLanding(points, new Multipliers());
    assert.equal(result.points, points);
    assert.equal(result.multiplier, 1);
    assert.equal(result.calculation, null);
  }
});

test('each bonus applies its own factor', () => {
  assert.equal(withHits({ cranberry: 1 }).total, 2);
  assert.equal(withHits({ gravy: 1 }).total, 3);
  assert.equal(withHits({ table: true }).total, 4);
  assert.equal(scoreLanding(5, new Multipliers(), { bounced: true }).points, 50);
});

test('repeat bowl hits each add another level', () => {
  assert.equal(withHits({ cranberry: 3 }).total, 8);
  assert.equal(withHits({ gravy: 2 }).total, 9);
});

test('the example from the design: 2 x 2 x 3 x 10 on a 50 point hit is 6,000', () => {
  const result = scoreLanding(50, withHits({ cranberry: 2, gravy: 1 }), { bounced: true });
  assert.equal(result.multiplier, 120);
  assert.equal(result.points, 6000);
  assert.equal(result.calculation, '50 × 120X = 6,000');
});

test('every bonus combination multiplies', () => {
  for (const cranberry of [0, 1, 2, 3]) {
    for (const gravy of [0, 1, 2, 3]) {
      for (const table of [false, true]) {
        for (const bounced of [false, true]) {
          const expected = 2 ** cranberry * 3 ** gravy * (table ? 4 : 1) * (bounced ? 10 : 1);
          assert.equal(withHits({ cranberry, gravy, table }).totalFor({ bounced }), expected);
        }
      }
    }
  }
});

test('the bounce bonus belongs to one landing and never carries over', () => {
  const multipliers = withHits({ cranberry: 1 });
  scoreLanding(5, multipliers, { bounced: true });
  assert.equal(multipliers.total, 2);
  assert.equal(scoreLanding(5, multipliers).points, 10);
});

test('the table bonus can only be earned once', () => {
  const multipliers = new Multipliers();
  assert.equal(multipliers.completeTable(), true);
  assert.equal(multipliers.completeTable(), false);
  assert.equal(multipliers.total, 4);
});

test('reset clears everything for the next round', () => {
  const multipliers = withHits({ cranberry: 2, gravy: 2, table: true });
  multipliers.reset();
  assert.equal(multipliers.total, 1);
});

test('an unknown bowl is a bug, not a silent no-op', () => {
  assert.throws(() => new Multipliers().addBowlHit('stuffing', 0));
});

test('huge stacks stop at the largest exact score instead of losing precision', () => {
  const multipliers = withHits({ cranberry: 60, gravy: 60, table: true });
  assert.equal(multipliers.total, MAX_VALUE);
  assert.equal(scoreLanding(10, multipliers, { bounced: true }).points, MAX_VALUE);
  assert.equal(addScore(MAX_VALUE - 1, 10), MAX_VALUE);
  assert.ok(Number.isSafeInteger(addScore(MAX_VALUE, MAX_VALUE)));
});

test('a cornucopia hit doubles scores until its 10 seconds run out', () => {
  const multipliers = new Multipliers();
  multipliers.addCornucopiaHit(5);
  assert.equal(multipliers.total, 2);
  assert.equal(scoreLanding(5, multipliers).points, 10);
  assert.equal(multipliers.secondsLeft('cornucopia', 8), 7);
  assert.equal(multipliers.expireBoosts(14.9), false);
  assert.equal(multipliers.total, 2);
  assert.equal(multipliers.expireBoosts(15), true);
  assert.equal(multipliers.total, 1);
  assert.equal(multipliers.secondsLeft('cornucopia', 15), 0);
  assert.equal(multipliers.cornucopiaHits, 1);
});

test('bowl bonuses last 10 seconds, but their hit counts stay for the results', () => {
  const multipliers = withHits({ cranberry: 1, gravy: 1 });
  assert.equal(multipliers.total, 6);
  assert.equal(multipliers.expireBoosts(9.9), false);
  assert.equal(multipliers.total, 6);
  assert.equal(multipliers.secondsLeft('gravy', 4), 6);
  assert.equal(multipliers.expireBoosts(10), true);
  assert.equal(multipliers.total, 1);
  assert.equal(multipliers.cranberryHits, 1);
  assert.equal(multipliers.gravyHits, 1);
});

test('overlapping bowl hits stack and end one at a time', () => {
  const multipliers = new Multipliers();
  multipliers.addBowlHit('gravy', 0);
  multipliers.addBowlHit('gravy', 6);
  assert.equal(multipliers.total, 9);
  assert.equal(multipliers.secondsLeft('gravy', 6), 10);
  multipliers.expireBoosts(10);
  assert.equal(multipliers.total, 3);
  multipliers.expireBoosts(16);
  assert.equal(multipliers.total, 1);
});

test('the table bonus outlasts the timers', () => {
  const multipliers = withHits({ cranberry: 1, table: true });
  multipliers.expireBoosts(60);
  assert.equal(multipliers.total, 4);
});

test('overlapping cornucopia hits stack and end one at a time', () => {
  const multipliers = withHits({ table: true });
  multipliers.addCornucopiaHit(0);
  multipliers.addCornucopiaHit(4);
  assert.equal(multipliers.total, 16);
  multipliers.expireBoosts(11);
  assert.equal(multipliers.total, 8);
  multipliers.expireBoosts(14);
  assert.equal(multipliers.total, 4);
});

test('reset clears running cornucopia boosts', () => {
  const multipliers = new Multipliers();
  multipliers.addCornucopiaHit(0);
  multipliers.reset();
  assert.equal(multipliers.total, 1);
  assert.equal(multipliers.cornucopiaHits, 0);
});

test('the floor penalty can never make a score negative', () => {
  assert.equal(addScore(10, -2), 8);
  assert.equal(addScore(1, -2), 0);
  assert.equal(addScore(0, -2), 0);
});

test('numbers stay readable', () => {
  assert.equal(formatNumber(6000), '6,000');
  assert.equal(formatNumber(1250000000), '1.25B');
});

test('every score gets a results message', () => {
  assert.match(resultMessage(0), /dog/);
  assert.match(resultMessage(1), /modest/);
  assert.match(resultMessage(MAX_VALUE), /Legendary/);
});
