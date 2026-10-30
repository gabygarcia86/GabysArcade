/**
 * Racing roster. Every ship comes from Galactic Squadron (this game keeps its
 * own copies of ships.js and sprites.js): the 14 hangar ships, the three
 * enemy fighters and the allied Falcon. Only the Probe-Fighter is left out:
 * it patrols the tracks as a hazard instead (see trackHazards.js).
 *
 * Stats are 1–10 and every ship's six stats add up to 36, so each one buys its
 * strengths with weaknesses. deriveHandling() turns them into physics values.
 */
import { SHIPS, getShipSprite } from './ships.js';
import { getSprites } from './sprites.js';

export const STAT_KEYS = ['topSpeed', 'accel', 'handling', 'boostPower', 'boostCapacity', 'weight'];
export const STAT_LABELS = {
  topSpeed: 'Top Speed',
  accel: 'Acceleration',
  handling: 'Handling',
  boostPower: 'Boost Power',
  boostCapacity: 'Boost Capacity',
  weight: 'Weight / Stability',
};

export const FLAME_COLORS = {
  cyan: '#38d6ff',
  red: '#ff4a3a',
  orange: '#ff9a2e',
  violet: '#b26bff',
  gold: '#ffcf5a',
  blue: '#6f9bff',
};

const s = (topSpeed, accel, handling, boostPower, boostCapacity, weight) => ({ topSpeed, accel, handling, boostPower, boostCapacity, weight });

/* Racing setup for the hangar ships, keyed by their Galactic Squadron id. */
const HANGAR = {
  'x-ship': { cls: 'Elite Fighter', stats: s(6, 6, 6, 6, 6, 6), desc: 'The squadron standard. No weak spot, no trick: it rewards clean lines.' },
  'a-ship': { cls: 'Light Fighter', stats: s(6, 9, 8, 5, 5, 3), desc: 'Leaps off the line and darts through chicanes, but runs out of road on long straights.' },
  'boba-ship': { cls: 'Heavy Gunship', stats: s(8, 5, 4, 7, 6, 6), desc: 'Slow to wake up, impossible to push around. Its boost hits like a freight train.' },
  'gauntlet-ship': { cls: 'Heavy Fighter', stats: s(8, 5, 4, 6, 5, 8), desc: 'Twin blade wings keep it planted at speed. Brake early for hairpins.' },
  'g-ship': { cls: 'Light Fighter', stats: s(6, 8, 9, 5, 5, 3), desc: 'A pixel-sharp dart with the tightest turning circle in the hangar.' },
  'j-ship': { cls: 'Elite Fighter', stats: s(7, 7, 6, 7, 5, 4), desc: 'Quick, stable and punchy on boost. A favorite of aggressive pilots.' },
  'land-ship': { cls: 'Light Speeder', stats: s(7, 8, 5, 6, 6, 4), desc: 'An open-cockpit hot rod with three engines and a lot of nerve.' },
  'n1-ship': { cls: 'Elite Fighter', stats: s(7, 6, 7, 6, 6, 4), desc: 'Gleaming, nimble and precise. Holds a line through fast sweepers.' },
  'n1-ship-modified': { cls: 'Elite Fighter', stats: s(7, 6, 6, 8, 5, 4), desc: 'Stripped panels, tuned injectors: trades a little grip for a vicious boost.' },
  'pod-ship': { cls: 'Pod Racer', stats: s(10, 6, 4, 6, 4, 6), desc: 'Two giant engines and a prayer. Fastest thing in the field when it points straight.' },
  'razor-ship': { cls: 'Heavy Gunship', stats: s(9, 4, 4, 8, 4, 7), desc: 'Huge side engines give it a monstrous top end. Turning is a negotiation.' },
  'snow-ship': { cls: 'Heavy Fighter', stats: s(6, 5, 7, 5, 6, 7), desc: 'Built for frozen worlds. Heavy, sure-footed and calm on ice.' },
  'yo-ship': { cls: 'Light Fighter', stats: s(6, 7, 8, 6, 4, 5), desc: 'Split-prong interceptor that loves to drift. Small boost tank, so spend it well.' },
  'y-ship': { cls: 'Heavy Bomber', stats: s(6, 5, 5, 6, 8, 6), desc: 'An old workhorse with the biggest boost tank in the galaxy.' },
};

/* The enemy fighters and the Falcon, rendered from Galactic Squadron's sprite set. */
const EXTRA = [
  {
    id: 't-fighter', name: 'T-Fighter', kind: 'enemy', sprite: 'interceptor', scale: 1.22, flame: 'red',
    engines: [[0, 5, 6]], cls: 'Light Fighter', stats: s(7, 8, 8, 5, 4, 4),
    desc: 'The swarm fighter: twitchy, light and fast to react. Fragile in a shoving match.',
  },
  {
    id: 't-interceptor', name: 'T-Interceptor', kind: 'enemy', sprite: 'heavy', scale: 1.15, flame: 'orange',
    engines: [[0, 14, 7]], cls: 'Elite Fighter', stats: s(8, 6, 7, 5, 4, 6),
    desc: 'Bent wings and a hot reactor. Strong everywhere except the boost tank.',
  },
  {
    id: 't-bomber', name: 'T-Bomber', kind: 'enemy', sprite: 'bomber', scale: 1.2, flame: 'violet',
    engines: [[-5.6, 10, 6], [6.1, 10, 6]], cls: 'Heavy Bomber', stats: s(7, 5, 4, 7, 7, 6),
    desc: 'Twin pods, long legs. Lumbers out of corners and then boosts forever.',
  },
  {
    id: 'falcon', name: 'The Falcon', kind: 'ally', sprite: 'falcon', scale: 0.82, flame: 'cyan',
    engines: [[-11, 37, 10], [0, 37.5, 10], [11, 37, 10]], cls: 'Heavy Freighter', stats: s(8, 4, 3, 8, 4, 9),
    desc: 'The legendary freighter. Heaviest ship on the grid with a boost to match.',
  },
];

const DEFAULT_SETUP = { cls: 'Fighter', stats: s(6, 6, 6, 6, 6, 6), desc: 'A Galactic Squadron ship.' };

function hangarEntry(ship) {
  const setup = HANGAR[ship.id] || DEFAULT_SETUP;
  return {
    id: ship.id,
    name: ship.name,
    kind: 'player',
    cls: setup.cls,
    desc: setup.desc,
    stats: setup.stats,
    flame: ship.flame,
    engines: ship.engines,
    scale: 1,
    getSprite: () => getShipSprite(ship.id),
  };
}

function extraEntry(e) {
  return { ...e, getSprite: () => getSprites()[e.sprite] };
}

/** Every racer-eligible ship: all hangar ships (new ones are picked up automatically) plus the extras. */
export const ROSTER = [...SHIPS.map(hangarEntry), ...EXTRA.map(extraEntry)];
for (const ship of ROSTER) {
  ship.flameColor = FLAME_COLORS[ship.flame] || FLAME_COLORS.cyan;
  ship.handling = deriveHandling(ship.stats);
}

export function getRosterShip(id) {
  return ROSTER.find((ship) => ship.id === id) || ROSTER[0];
}

/** The Probe-Fighter sprite, used only by the track hazard. */
export function getProbeSprite() {
  return getSprites().ace;
}

/** Turns 1–10 stats into the numbers physics.js uses. */
export function deriveHandling(st) {
  return {
    topSpeed: 630 + st.topSpeed * 30,              // 660 … 930 units/s
    accel: 430 + st.accel * 42,                    // 472 … 850 units/s²
    turnRate: 2.45 + st.handling * 0.17,           // 2.6 … 4.15 rad/s at peak
    grip: 9.5 + st.handling * 0.5 + st.weight * 0.45,
    boostSpeed: 1.22 + st.boostPower * 0.024,      // top speed multiplier while boosting
    boostAccel: 1.45 + st.boostPower * 0.07,       // thrust multiplier while boosting
    boostDrain: 1 / (1.5 + st.boostCapacity * 0.26), // tank lasts 1.76 … 4.1 s
    mass: 0.75 + st.weight * 0.11,
    stability: 0.3 + st.weight * 0.07,             // 0.37 … 1.0: resists hazards and rough ground
  };
}
