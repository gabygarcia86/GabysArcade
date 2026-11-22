/* Tuning for the space stages: the ship, upgrades, pickups and every enemy type. */
(function (MQ) {
  const enemy = (name, art, rx, ry, hp, speed, points, options = {}) => ({
    name, art, rx, ry, hp, speed, points,
    fire: null, // aim, burst, fan, bomb, seeker, ring or launch
    every: 2.2, // Seconds between attacks.
    shot: 310, // Projectile speed.
    damage: 11,
    ram: 18, // Damage for flying into it.
    drop: null, // Overrides the capsule chance.
    heavy: false, // Survives a collision with the player.
    armored: false, // Shrugs off most damage from the front.
    surface: false, // A target for ground missiles.
    ...options,
  });

  MQ.SPACE = {
    // The part of the 1280x720 view between the two HUD bands.
    FIELD: { left: 0, right: 1280, top: 76, bottom: 650 },

    SHIP: {
      rx: 42,
      ry: 16,
      // The limits for the middle of the ship, which keep all of it on screen.
      minX: 100,
      maxX: 1186,
      minY: 118,
      maxY: 622,
      startX: 220,
      startY: 360,
      speed: 350,
      speedStep: 50, // Each Speed Up.
      accel: 3000,
      brake: 2300,
      maxHp: 100,
      hitSafe: 1.15,
      shieldSafe: 0.4,
      respawnDelay: 1.7,
      warpIn: 0.85,
      respawnSafe: 2.8,
    },

    PRIMARY: {
      cooldown: 0.15,
      speed: 1100,
      damage: 12,
      twinDamage: 10,
      spreadDamage: 7,
      rearDamage: 12,
      missileEvery: 0.72,
      missileDamage: 34,
      missileBlast: 62,
      laserEvery: 0.6,
      laserTime: 0.17,
      laserDamage: [42, 64],
      laserWidth: [10, 18],
      vanguardDamage: 1.3,
    },

    SECONDARY: { name: "Seeker Rockets", count: 3, vanguardCount: 5, damage: 24, speed: 560, ammo: 6, recharge: 4.5, cooldown: 0.5 },

    // The shield button. The Energy Shield upgrade is separate, and stays up until it's used up.
    DEFLECTOR: { charges: 2, time: 3, recharge: 22, absorb: 55 },
    ENERGY_SHIELD: { absorb: 60, improved: 105 },

    // The upgrade bar, in order. level is the stage that unlocks it.
    UPGRADES: [
      { id: "speed", name: "Speed Up", short: "SPEED", max: 3, color: "#7dffb2" },
      { id: "twin", name: "Twin Blaster", short: "TWIN", max: 2, color: "#7fd4ff" },
      { id: "spread", name: "Spread Shot", short: "SPREAD", max: 2, color: "#ffd45c", level: 4 },
      { id: "rear", name: "Rear Shot", short: "REAR", max: 2, color: "#ff9bd2" },
      { id: "missile", name: "Missile Launcher", short: "MISSILE", max: 2, color: "#ff9b4d" },
      { id: "shield", name: "Energy Shield", short: "SHIELD", max: 1, color: "#9fb4ff" },
      { id: "laser", name: "Laser Cannon", short: "LASER", max: 2, color: "#c58cff", level: 8 },
    ],

    // What losing a life does to collected upgrades, by difficulty: all, half or none are kept.
    KEEP_ON_DEATH: { story: "all", standard: "half", veteran: "none" },
    // How hard the enemy fights, by difficulty.
    AGGRESSION: { story: 0.8, standard: 1, veteran: 1.2 },

    PICKUPS: {
      chance: 0.08, // For any enemy without its own drop chance.
      healthChance: 0.035,
      life: 11,
      blink: 3,
      drift: 55,
      reach: 24,
      magnet: 120,
      health: 35,
      fullBonus: 500, // For a capsule when every upgrade is maxed.
    },

    ENEMIES: {
      fighter: enemy("Imperial Fighter", "fighter", 27, 22, 20, 215, 100, { fire: "aim" }),
      interceptor: enemy("Interceptor", "interceptor", 28, 17, 14, 330, 120, { fire: "aim", every: 2.5, shot: 360, damage: 9 }),
      heavyFighter: enemy("Heavy Fighter", "heavyFighter", 34, 25, 52, 170, 190, { fire: "burst", every: 2.6, shot: 340 }),
      gunship: enemy("Armored Gunship", "gunship", 58, 30, 130, 120, 350, { fire: "fan", every: 2.3, shot: 270, damage: 13, heavy: true, drop: 0.35 }),
      drone: enemy("Defense Drone", "drone", 19, 19, 16, 230, 80, { fire: "aim", every: 3.2, shot: 250, damage: 8, ram: 12 }),
      bomber: enemy("Imperial Bomber", "bomber", 44, 24, 72, 140, 240, { fire: "bomb", every: 2.5, shot: 190, damage: 14 }),
      missileDrone: enemy("Missile Drone", "missileDrone", 25, 23, 36, 160, 180, { fire: "seeker", every: 3.4, shot: 235, damage: 15 }),
      eliteInterceptor: enemy("Elite Interceptor", "eliteInterceptor", 28, 17, 26, 380, 180, { fire: "burst", every: 2.4, shot: 390, damage: 10 }),
      attackFighter: enemy("Advanced Fighter", "attackFighter", 32, 22, 44, 235, 210, { fire: "fan", every: 2.5, shot: 330 }),
      defender: enemy("Armored Defense Ship", "defender", 48, 32, 115, 115, 360, { fire: "burst", every: 2.4, shot: 310, armored: true, heavy: true, drop: 0.4 }),
      eliteGunship: enemy("Elite Gunship", "eliteGunship", 58, 30, 200, 130, 480, { fire: "fan", every: 1.8, shot: 310, damage: 14, heavy: true, drop: 0.5 }),
      turret: enemy("Defense Turret", "turret", 24, 22, 42, 0, 160, { fire: "aim", every: 2.1, shot: 290, surface: true, drop: 0.2 }),
      generator: enemy("Shield Generator", "generator", 25, 25, 85, 0, 250, { surface: true, heavy: true, drop: 0 }),
      transport: enemy("Imperial Transport", "transport", 140, 52, 620, 90, 1500, { fire: "launch", every: 2.6, damage: 12, heavy: true, drop: 1 }),
      platform: enemy("Defense Platform", "platform", 66, 58, 300, 100, 700, { fire: "ring", every: 2.7, shot: 220, damage: 12, heavy: true, drop: 1 }),
      capital: enemy("Capital Ship", "capital", 205, 72, 1500, 80, 2500, { fire: "broadside", every: 2.1, shot: 260, damage: 13, heavy: true, drop: 1 }),
    },
  };
})(window.MQ);
