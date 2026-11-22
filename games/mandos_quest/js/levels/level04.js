/* Level 4: a climb from the forest floor, over the treetops, to the clifftop nests. */
MQ.defineLevel({
  id: 4,
  title: "The Reptavian Nest",
  planet: "Nevarro Wilderness",
  theme: "Dense forest, cliffs and creature nests",
  scene: "wilds",
  material: "moss",
  boss: "Nevarro Reptavians",
  width: 8000,
  height: 2300,
  start: [300, 2050],
  par: 280,
  objectives: [
    { text: "Search the research outpost", done: "research" },
    { text: "Climb to the nests", done: "nests" },
    { text: "Defeat the Reptavians", done: "boss" },
  ],

  intro: [
    {
      scene: "wilds", ground: "#1c2c20",
      cast: [{ a: "mando", x: 420, weapon: "blaster" }, { a: "baby", x: 270, y: 410, mood: "worried" }],
      who: "The Mandalorian", text: "The outpost went silent a month ago. No distress call, no bodies. Only claw marks on the landing pad.",
    },
    {
      scene: "wilds", ground: "#1c2c20",
      cast: [{ a: "enemy", art: "nestling", x: 350, scale: 2 }, { a: "enemy", art: "stalker", x: 820, scale: 2, flip: true }],
      who: "Narrator", text: "Imperial experiments poured crystal energy into the wildlife. The wildlife did not take it kindly.",
    },
    {
      scene: "nest", ground: "#241114",
      cast: [{ a: "boss", kind: "reptavian", x: 400, y: 230, scale: 1.4 }, { a: "boss", kind: "reptavian", x: 900, y: 300, scale: 1.8, flip: true }],
      who: "Narrator", text: "Now the Reptavians rule the cliffs, and they hunt as a pack.",
    },
  ],
  outro: [
    {
      scene: "nest", ground: "#241114",
      cast: [{ a: "mando", x: 420, anim: "crouch" }, { a: "map", x: 760, y: 360 }],
      who: "The Mandalorian", text: "Field notes. They weren't studying the animals. They were measuring how living things react to the Force.",
    },
    {
      scene: "space",
      cast: [{ a: "gideon", x: 640, holo: true }],
      who: "Moff Gideon", text: "Project Star Map continues. The wilderness was only a test. The child will be the proof.",
    },
  ],
  conclusion: "The nests are quiet. The research notes prove the experiments were one piece of a far larger project.",

  build(b) {
    // Forest floor, with a cave behind the start
    b.ground(0, 700, 2050);
    b.block(0, 1790, 190, 100);
    b.rubbleWall(150, 2050, 40, 160);
    b.secret(0, 1890, 148, 160);
    b.puck(70, 1995);
    b.ground(700, 1500, 1940);
    for (const [x, y, scale] of [[480, 2050, 1.2], [820, 1940, 0.9], [1220, 1940, 1.3], [1440, 1940, 0.8]]) b.deco("tree", x, y, { scale });
    b.deco("fern", 600, 2050);
    b.deco("fern", 1000, 1940);
    b.foe("stalker", 1000, 1940);
    b.foe("nestling", 1280, 1940);
    b.foe("flyer", 1380, 1780);

    // Acid bog
    b.ground(1500, 1900, 2120);
    b.hazard("acid", 1500, 2040, 400, 80);
    b.ledge(1560, 1870, 110);
    b.ledge(1730, 1800, 110);

    // Outpost
    b.ground(1900, 2700, 1800);
    b.room("facility", 2000, 1610, 420, 190);
    b.block(2000, 1560, 420, 50, "facility");
    b.deco("console", 2300, 1800);
    b.deco("tank", 2120, 1800, { light: "#6dff9a" });
    b.reach("research", 2240, 1000, 100, 800);
    b.say(2250, "The Mandalorian", "Specimen cages, all torn open from the inside. The trail leads up the cliffs.", [1640, 1810]);
    b.foe("securityDroid", 2360, 1800);
    b.checkpoint(1960, 1800);
    b.crate(2440, 1800, { drop: "health" });
    b.ledge(2500, 1690, 110);
    b.ledge(2590, 1590, 100);
    b.ground(2700, 3300, 1500);
    b.deco("tree", 2780, 1500);
    b.deco("fern", 3000, 1500);
    b.foe("stormtrooper", 2900, 1500);
    b.foe("stormtrooper", 3120, 1500);
    b.checkpoint(2760, 1500);

    // Treetops
    b.ledge(3360, 1400, 130);
    b.ledge(3540, 1310, 130);
    b.fall(3720, 1340, 110);
    b.move(3890, 1330, 120, 0, -80, 3.4);
    b.ledge(4080, 1310, 130);
    b.ledge(3640, 1205, 120);
    b.ledge(3800, 1100, 120);
    b.puck(3860, 1030);
    b.ground(3300, 4300, 2200, "basalt");
    b.hazard("lava", 3300, 2130, 1000, 70);
    b.foe("flyer", 3600, 1150);
    b.foe("flyer", 4120, 1120);

    // Sealed station
    b.ground(4300, 5000, 1280);
    b.checkpoint(4380, 1280);
    b.deco("tree", 4340, 1280, { scale: 1.1 });
    b.room("facility", 4640, 1000, 300, 280);
    b.block(4640, 960, 300, 50, "facility");
    b.block(4800, 1010, 24, 90, "facility");
    b.gate(4800, 1100, 1280, ["stationPower"]);
    b.mechanism("stationPower", 4700, 1280);
    b.hint(4560, "Force Push wakes old machinery. Stand near it and press K.", { touch: "Force Push wakes old machinery. Stand near it and tap Force.", area: [1100, 1290] });
    b.foe("securityDroid", 4520, 1280);
    b.foe("stormtrooper", 4910, 1280);
    b.deco("tank", 4880, 1280);

    // Cliff nests
    b.hill([[5000, 1280], [5200, 1230], [5400, 1120]]);
    b.ground(5400, 5600, 1120);
    b.ground(5600, 5850, 1005);
    b.ground(5850, 8000, 890, "basalt");
    b.block(5420, 560, 160, 30, "basalt");
    b.puck(5500, 500); // Needs the jetpack, so it waits for a replay.
    b.deco("nest", 5500, 1120);
    b.deco("nest", 5720, 1005);
    b.deco("nest", 6020, 890);
    b.foe("nestling", 5480, 1120);
    b.foe("nestling", 5740, 1005);
    b.foe("nestling", 5990, 890);
    b.foe("flyer", 5700, 820);
    b.hazard("steam", 5880, 730, 50, 160, { period: 3.2, duty: 0.35, fire: true });
    b.checkpoint(6110, 890);
    b.health(6180, 890);
    b.reach("nests", 6100, 0, 120, 890);

    // Nest summit
    b.material("basalt");
    b.ledge(6460, 770, 150);
    b.ledge(6700, 660, 130);
    b.ledge(7280, 660, 130);
    b.ledge(7480, 770, 130);
    b.hazard("steam", 6940, 700, 60, 190, { period: 5.2, duty: 0.25, fire: true });
    b.deco("nest", 6440, 890);
    b.deco("bones", 7100, 890);
    b.deco("nest", 7600, 890);
    b.block(7700, 400, 300, 490);
    b.arena("reptavians", 6300, 7680, 890, "nest");
  },
});
