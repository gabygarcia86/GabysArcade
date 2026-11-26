/*
 * Game-wide tuning: weapons, armor, colors and the reward for each level.
 * "after" is the level that must be completed before something unlocks, by its number
 * in the 13-stage campaign: ten on the ground and space battles at 4, 8 and 12.
 */
(function (MQ) {
  /*
   * The campaign order. The ten ground levels (levels/level01.js to level10.js) keep their
   * own numbers in their files, and the three space levels (levels/space01.js to space03.js)
   * slot in between. A level's id is always its place among the 13.
   */
  const GROUND_STAGES = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13];
  const SPACE_STAGES = [4, 8, 12];

  MQ.LEVELS = [];
  MQ.defineLevel = (level) => {
    const id = GROUND_STAGES[level.id - 1];
    MQ.LEVELS[id - 1] = { ...level, id, ground: level.id };
  };
  MQ.defineSpaceLevel = (level) => {
    const id = SPACE_STAGES[level.mission - 1];
    MQ.LEVELS[id - 1] = { ...level, id, mode: "space" };
  };

  MQ.DATA = {
    TOTAL_LEVELS: GROUND_STAGES.length + SPACE_STAGES.length,
    TOTAL_GROUND: GROUND_STAGES.length,
    GROUND_STAGES,
    SPACE_STAGES,
    TOTAL_PUCKS: 30,
    LIVES: 3,
    PUCK_POINTS: 1500,
    CREDIT_POINTS: 25, // Each credit chip, before the difficulty multiplier.

    PHYSICS: {
      gravity: 2100,
      maxFall: 1050,
      run: 330,
      groundAccel: 3400,
      groundFriction: 3900,
      airAccel: 2300,
      airFriction: 900,
      jump: 820,
      jumpCut: 0.48,
      coyote: 0.11,
      jumpBuffer: 0.13,
      dodgeSpeed: 720,
      dodgeTime: 0.24,
      dodgeCooldown: 0.62,
    },

    DIFFICULTY: {
      story: { name: "Story", hurt: 0.55, score: 0.75 },
      standard: { name: "Standard", hurt: 1, score: 1 },
      veteran: { name: "Veteran", hurt: 1.45, score: 1.25 },
    },

    WEAPONS: [
      {
        id: "blaster", name: "Blaster Pistol", after: 0, color: "#ff6548",
        damage: 11, cooldown: 0.24, speed: 980, range: 780,
        info: "Fast, reliable and never runs dry.",
      },
      {
        id: "blade", name: "Vibroblade", after: 2, color: "#8ff7ff",
        damage: 22, cooldown: 0.23, reach: 92,
        info: "Three-hit melee combo that cuts through guard.",
      },
      {
        id: "birds", name: "Whistling Birds", after: 3, color: "#ffd45c",
        damage: 24, cooldown: 0.85, speed: 620, range: 1300, ammo: 6, recharge: 7,
        info: "Four homing darts per launch. Limited ammunition.",
      },
      {
        id: "pulse", name: "Pulse Rifle", after: 5, color: "#54d8ff",
        damage: 22, cooldown: 0.2, speed: 1150, range: 640,
        info: "Rapid medium-range energy shots.",
      },
      {
        id: "heavy", name: "Heavy Blaster", after: 6, color: "#ff9b38",
        damage: 72, cooldown: 0.68, speed: 820, range: 900,
        info: "Slow, piercing bolts with a brutal kick.",
      },
      {
        id: "flame", name: "Flamethrower", after: 7, color: "#ff8a2a",
        damage: 11, cooldown: 0.07, range: 560, heat: 2.4,
        info: "Long stream of fire for groups. Watch the heat.",
      },
      {
        id: "rocket", name: "Wrist Rockets", after: 9, color: "#ffb347",
        damage: 110, cooldown: 1, speed: 640, range: 1100, ammo: 6, recharge: 9, blast: 120,
        info: "Explosive rockets with a wide blast. Limited ammunition.",
      },
      {
        id: "disruptor", name: "Disruptor Rifle", after: 10, color: "#d77bff",
        damage: 170, cooldown: 1.25, speed: 2200, range: 1500,
        info: "A long-range piercing lance. Slow to fire.",
      },
      {
        id: "saber", name: "Darksaber", after: 13, secret: true, color: "#ffffff",
        damage: 34, cooldown: 0.22, reach: 122, charge: 0.6,
        info: "Four-hit combo and finisher. Hold attack, then release, for an energy wave.",
      },
    ],

    COLORS: [
      { name: "Silver", hex: "#aeb9c4", after: 0 },
      { name: "Black", hex: "#2b2e36", after: 0 },
      { name: "Dark Gray", hex: "#5b626c", after: 0 },
      { name: "Red", hex: "#b23a32", after: 0 },
      { name: "Blue", hex: "#3466b0", after: 0 },
      { name: "Green", hex: "#4c7d4a", after: 0 },
      { name: "Gold", hex: "#d4a93f", after: 3 },
      { name: "White", hex: "#eef1f4", after: 3 },
      { name: "Orange", hex: "#dd7429", after: 3 },
      { name: "Purple", hex: "#7650a8", after: 3 },
    ],
    CUSTOM_COLOR_AFTER: 3,

    // Each set defines default colors plus the plate shape used by every slot that picks it.
    SETS: [
      { id: "classic", name: "Classic Beskar", after: 0, color: "#aeb9c4", suit: "#4a4038", trim: "#6d7883", cape: "long", cloth: "#4c423c", helmet: "classic", pack: "twin" },
      { id: "worn", name: "Battle-Worn", after: 0, color: "#8a6a50", suit: "#3c3834", trim: "#b5a58c", cape: "torn", cloth: "#5c4a3c", helmet: "damaged", pack: "twin" },
      { id: "scout", name: "Scout Armor", after: 2, color: "#64795a", suit: "#30362c", trim: "#c7b98c", cape: "short", cloth: "#3f4a37", helmet: "scout", pack: "single" },
      { id: "heavy", name: "Heavy Armor", after: 5, color: "#59677a", suit: "#262a31", trim: "#e0a43a", cape: "none", cloth: "#2a303a", helmet: "heavy", pack: "heavy" },
      { id: "desert", name: "Desert Armor", after: 6, color: "#c7a56e", suit: "#6b5138", trim: "#8f4f2c", cape: "poncho", cloth: "#9a7650", helmet: "scout", pack: "single" },
      { id: "shadow", name: "Shadow Armor", after: 7, color: "#2b2e38", suit: "#16171c", trim: "#b04cff", cape: "long", cloth: "#191a22", helmet: "classic", pack: "twin" },
      { id: "ancient", name: "Ancient Mandalorian", after: 9, color: "#9b7a48", suit: "#39302a", trim: "#58d6c2", cape: "torn", cloth: "#3b4a46", helmet: "reinforced", pack: "heavy" },
      { id: "arctic", name: "Arctic Armor", after: 10, color: "#e6edf2", suit: "#7c8b98", trim: "#4c9fd6", cape: "fur", cloth: "#6c7c8b", helmet: "reinforced", pack: "heavy" },
      { id: "imperial", name: "Imperial Remnant", after: 10, color: "#3a3f47", suit: "#1b1d22", trim: "#d63a3a", cape: "short", cloth: "#15161a", helmet: "reinforced", pack: "single" },
      { id: "royal", name: "Royal Mandalorian", after: 11, color: "#2e5394", suit: "#1c2033", trim: "#e2bd57", cape: "long", cloth: "#8e2633", helmet: "heavy", pack: "twin" },
    ],

    HELMETS: [
      { id: "classic", name: "Classic T-Visor", after: 0 },
      { id: "damaged", name: "Battle-Damaged", after: 0 },
      { id: "scout", name: "Scout", after: 2 },
      { id: "heavy", name: "Heavy", after: 5 },
      { id: "reinforced", name: "Reinforced", after: 9 },
    ],
    PAINTS: [
      { id: "solid", name: "Solid", after: 0 },
      { id: "stripe", name: "Center Stripe", after: 0 },
      { id: "brow", name: "Brow Band", after: 0 },
      { id: "cheeks", name: "Cheek Panels", after: 1 },
      { id: "chevrons", name: "Chevrons", after: 3 },
      { id: "split", name: "Two-Tone Split", after: 5 },
      { id: "war", name: "War Paint", after: 11 },
    ],
    CAPES: [
      { id: "long", name: "Long Cape", after: 0 },
      { id: "torn", name: "Torn Cape", after: 0 },
      { id: "none", name: "No Cape", after: 0 },
      { id: "short", name: "Half Cape", after: 2 },
      { id: "poncho", name: "Poncho", after: 6 },
      { id: "fur", name: "Fur Mantle", after: 10 },
    ],
    PACKS: [
      { id: "twin", name: "Twin Thruster", after: 0 },
      { id: "single", name: "Single Rocket", after: 2 },
      { id: "heavy", name: "Heavy Turbine", after: 5 },
    ],
    VISORS: [
      { name: "Obsidian", hex: "#0b0d12" },
      { name: "Cyan", hex: "#2fd3e8" },
      { name: "Red", hex: "#f0443c" },
      { name: "Amber", hex: "#f2b33d" },
      { name: "Green", hex: "#4be07c" },
      { name: "Violet", hex: "#a968ff" },
      { name: "Ice", hex: "#cfefff" },
    ],

    // The dark core is part of the silhouette; only the glow changes.
    SABERS: [
      { id: "classic", name: "Black and White", glow: "#ffffff", core: "#050507" },
      { id: "blue", name: "Blue", glow: "#3d7dff", core: "#050918" },
      { id: "green", name: "Green", glow: "#3dff7a", core: "#04120a" },
      { id: "red", name: "Red", glow: "#ff3438", core: "#160405" },
      { id: "purple", name: "Purple", glow: "#b04cff", core: "#0f0418" },
      { id: "yellow", name: "Yellow", glow: "#ffe23d", core: "#141104" },
      { id: "cyan", name: "Cyan", glow: "#35f4ff", core: "#041316" },
      { id: "orange", name: "Orange", glow: "#ff8a24", core: "#160b03" },
      { id: "white", name: "White", glow: "#e6f6ff", core: "#ffffff" },
    ],

    FORCE_UPGRADES: [
      { after: 1, name: "Force Push I", info: "Push enemies, break rubble and wake old machinery." },
      { after: 2, name: "Stronger Force Push", info: "Pushes and staggers hit harder." },
      { after: 3, name: "Stronger Push II", info: "Maximum shove and a longer stagger." },
      { after: 6, name: "Wider Force Range", info: "Reaches much farther and higher." },
      { after: 7, name: "Extended Force Range", info: "Even greater reach." },
      { after: 9, name: "Heavy Object Movement", info: "Moves huge objects marked with a gold rune." },
      { after: 11, name: "Powerful Force Burst", info: "A damaging burst in every direction." },
    ],

    JETPACK_UPGRADES: [
      { after: 6, name: "Jetpack", fuel: 1.5, refill: 0.8, speed: 350 },
      { after: 7, name: "Expanded Fuel Cell", fuel: 2, refill: 1, speed: 350 },
      { after: 9, name: "Improved Thrusters", fuel: 2.5, refill: 1.4, speed: 400 },
    ],

    // What the space missions award.
    SHIP_REWARDS: {
      spreadShot: 4,
      hull: [[4, 25], [12, 50]],
      laser: 8,
      improvedShield: 8,
      engines: [8, 45],
      vanguard: 12,
    },
    RELICS: [
      { id: "beacon", name: "Pursuit Fleet Beacon", after: 4, info: "The tracker that led an entire fleet to its end over Nevarro." },
      { id: "starShard", name: "Star Map Shard", after: 12, info: "A sliver of living starlight, cut from the command ship's navigation core." },
    ],

    // Shown on the level-up screen. The effects themselves live in ProgressionManager.
    REWARDS: [
      ["Baby G joins you as a companion", "Force Push unlocked", "Blaster Pistol certified", "Cheek Panel helmet paint"],
      ["Vibroblade", "Maximum health +25", "Stronger Force Push", "Scout armor, helmet and half cape"],
      ["Whistling Birds", "Faster blaster firing", "Stronger Push II", "Gold, white, orange, purple and custom colors"],
      ["Spread Shot for the gunship", "Maximum ship health +25", "Space mission collectible: Pursuit Fleet Beacon"],
      ["Pulse Rifle", "Maximum health +25", "Heavy armor and helmet"],
      ["Jetpack", "Jetpack tutorial", "Heavy Blaster", "Wider Force Range", "Desert armor and poncho"],
      ["Flamethrower", "Improved jetpack fuel", "Extended Force Range", "Shadow armor"],
      ["Laser Cannon for the gunship", "Improved Energy Shield", "Ship movement speed +45"],
      ["Wrist Rockets", "Improved jetpack thrusters", "Heavy Object Movement", "Ancient Mandalorian armor"],
      ["Disruptor Rifle", "Beskar plating: 15% less damage taken", "Weapon damage +15%", "Arctic and Imperial Remnant armor"],
      ["Advanced Blaster: twin bolts", "Powerful Force Burst", "Royal armor and War Paint"],
      ["Vanguard configuration: the final ship loadout", "Maximum ship health +50", "Space mission collectible: Star Map Shard", "The Star Map Citadel unlocked"],
      ["Final Arsenal: damage +15% and extra ammunition", "Story Mode completed", "Darksaber eligibility"],
    ],
  };

  MQ.DATA.weapon = (id) => MQ.DATA.WEAPONS.find((w) => w.id === id) || MQ.DATA.WEAPONS[0];
  MQ.DATA.set = (id) => MQ.DATA.SETS.find((s) => s.id === id) || MQ.DATA.SETS[0];
  MQ.DATA.saber = (id) => MQ.DATA.SABERS.find((s) => s.id === id) || MQ.DATA.SABERS[0];
})(window.MQ);
