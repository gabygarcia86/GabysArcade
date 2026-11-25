/*
 * Classic mode's five levels, and how Endless mode builds its zones.
 *
 * targets      relative weights for which people and animals appear
 * targetCap    how many can be on the map at once
 * hazards      { type, first (seconds in), every (seconds), cap (at once) }
 * statics      hazards placed at fixed spots (fences, power lines, monkeys in palms)
 * rescues      how many alien family appearances the level schedules
 * diff         targetSpeed, hazardRate (attack frequency) and hazardSpeed multipliers
 */
(function (U) {
  "use strict";

  const LEVELS = [
    {
      env: "farm",
      duration: 60,
      music: "farm",
      targets: { cow: 3, pig: 2, chicken: 2.4, horse: 1.3, farmer: 1.5, sheep: 2, goat: 1.2, duck: 1.1 },
      targetCap: 15,
      targetEvery: 1.5,
      hazards: [
        { type: "bull", first: 10, every: 22, cap: 2 },
        { type: "tractor", first: 28, every: 30, cap: 1 },
      ],
      statics: [{ type: "fence", x: 1480 }, { type: "fence", x: 3000 }],
      rescues: 1,
      powerEvery: 12,
      diff: { targetSpeed: 1, hazardRate: 1, hazardSpeed: 1 },
      tip: "Fly low and hold the beam over animals. Never beam angry bulls or tractors!",
    },
    {
      env: "suburbia",
      duration: 70,
      music: "suburbia",
      targets: { human: 3, dog: 2.4, mail: 1.5, guard: 1.2, cat: 2 },
      targetCap: 16,
      targetEvery: 1.35,
      hazards: [
        { type: "policeCar", first: 12, every: 26, cap: 1 },
        { type: "resident", first: 18, every: 22, cap: 1 },
        { type: "helicopter", first: 38, every: 36, cap: 1 },
      ],
      statics: [],
      rescues: 2,
      powerEvery: 10,
      diff: { targetSpeed: 1, hazardRate: 0.85, hazardSpeed: 0.9 },
      tip: "Police helicopters fire stun shots. Keep moving and dodge!",
    },
    {
      env: "desert",
      duration: 80,
      music: "desert",
      targets: { cowboy: 2.5, horse: 2, tourist: 2, human: 1.4, cow: 1.2, goat: 1, chicken: 1.2 },
      targetCap: 17,
      targetEvery: 1.25,
      hazards: [
        { type: "jeep", first: 12, every: 26, cap: 1 },
        { type: "bull", first: 18, every: 26, cap: 1 },
        { type: "dustDevil", first: 26, every: 30, cap: 1 },
        { type: "eagle", first: 32, every: 26, cap: 1 },
        { type: "giantFarmer", first: 50, every: 55, cap: 1 },
      ],
      statics: [],
      rescues: 2,
      powerEvery: 10,
      diff: { targetSpeed: 1.03, hazardRate: 0.9, hazardSpeed: 0.92 },
      tip: "Eagles flash a warning before they swoop. Dust storms knock you around!",
    },
    {
      env: "city",
      duration: 90,
      music: "city",
      targets: { office: 3, construction: 2, tourist: 2, guard: 1.5, pedestrian: 3 },
      targetCap: 18,
      targetEvery: 1.15,
      hazards: [
        { type: "helicopter", first: 14, every: 30, cap: 1 },
        { type: "tank", first: 22, every: 30, cap: 1 },
        { type: "rocket", first: 34, every: 34, cap: 1 },
      ],
      statics: [{ type: "power", x: 1280 }, { type: "power", x: 2620 }],
      rescues: 3,
      powerEvery: 9,
      diff: { targetSpeed: 1.06, hazardRate: 0.95, hazardSpeed: 0.95 },
      tip: "Rockets follow you for a while. Lead them away, then turn hard!",
    },
    {
      env: "island",
      duration: 100,
      music: "island",
      targets: { beachgoer: 3, surfer: 2, seagull: 2.4, crab: 2.4, islander: 2 },
      targetCap: 19,
      targetEvery: 1.05,
      hazards: [
        { type: "cloud", first: 7, every: 18, cap: 2 },
        { type: "jeep", first: 15, every: 24, cap: 1 },
        { type: "pelican", first: 20, every: 18, cap: 2 },
      ],
      statics: [{ type: "monkey", palms: [720, 2100, 3400] }],
      rescues: 3,
      powerEvery: 10,
      diff: { targetSpeed: 1.25, hazardRate: 1.22, hazardSpeed: 1.16 },
      tip: "Lightning fries your beam. Stay out from under angry clouds!",
    },
  ];

  const ZONE_TIME = 60;

  // Endless mode: zones visit the environments in a random order (see Game.nextEndlessLevel),
  // and everything gets a little tougher each zone.
  function endlessStage(zone, levelIndex) {
    const base = LEVELS[levelIndex];
    const lap = Math.floor(zone / LEVELS.length);
    const ramp = 1 + zone * 0.07;
    const hazards = base.hazards.map((h) => ({
      type: h.type,
      first: Math.max(4, h.first * 0.6),
      every: h.every / ramp,
      cap: h.cap + Math.floor(zone / 3),
    }));
    // From the second lap, guests from other levels drop by.
    if (lap >= 1) {
      const extra = ["eagle", "helicopter", "bull", "cloud", "rocket"][zone % 5];
      if (!hazards.some((h) => h.type === extra)) hazards.push({ type: extra, first: 15, every: 26 / ramp, cap: 1 });
    }
    return {
      ...base,
      duration: ZONE_TIME,
      hazards,
      targetCap: base.targetCap + Math.min(6, zone),
      targetEvery: Math.max(0.6, base.targetEvery / ramp),
      powerEvery: Math.max(8, base.powerEvery),
      rescues: 0,
      diff: {
        targetSpeed: Math.min(1.7, base.diff.targetSpeed + zone * 0.035),
        hazardRate: Math.min(2.2, base.diff.hazardRate + zone * 0.06),
        hazardSpeed: Math.min(1.6, base.diff.hazardSpeed + zone * 0.03),
      },
    };
  }

  U.LEVELS = LEVELS;
  U.ZONE_TIME = ZONE_TIME;
  U.endlessStage = endlessStage;
})(window.UFO);
