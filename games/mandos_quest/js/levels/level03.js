/* Level 3: a switchback from rooftops, down through tunnels, into a lava mine. */
MQ.defineLevel({
  id: 3,
  title: "The Nevarro Underworld",
  planet: "Nevarro",
  theme: "Volcanic streets, tunnels and mines",
  scene: "nevarro",
  material: "city",
  width: 6400,
  height: 2000,
  start: [140, 1000],
  par: 300,
  objectives: [
    { text: "Find a way beneath the city", done: "tunnels" },
    { text: "Destroy the tunnel extractor", done: "extractorA" },
    { text: "Destroy the first mine extractor", done: "extractorB" },
    { text: "Destroy the last extractor", done: "extractorC" },
    { text: "Leave with the stolen map" },
  ],

  intro: [
    {
      scene: "space",
      cast: [{ a: "ship", kind: "gunship", x: 380, y: 340, scale: 1.3, vx: 30 }, { a: "map", x: 990, y: 300 }],
      who: "The Mandalorian", text: "That signal was buried in the bounty's encryption. It repeats every nine minutes, and it's coming from Nevarro.",
    },
    {
      scene: "nevarro", ground: "#2a1b22",
      cast: [{ a: "mando", x: 380, weapon: "blaster", action: "aim" }, { a: "enemy", art: "trooper", x: 840, n: 3, flip: true, action: "rifle" }],
      who: "Narrator", text: "Beneath the lava flats, Imperial crews work in secret, cutting strange glowing crystals from the rock.",
    },
    {
      scene: "nevarro", ground: "#2a1b22",
      cast: [{ a: "gideon", x: 640, holo: true, action: "point" }, { a: "enemy", art: "officer", x: 350 }],
      who: "Moff Gideon", text: "Every crystal brings the Star Map Core closer to waking. Double the shifts. And find me that child.",
    },
  ],
  outro: [
    {
      scene: "nevarro", ground: "#2a1b22",
      cast: [{ a: "mando", x: 400 }, { a: "map", x: 760, y: 330 }, { a: "baby", x: 260, y: 420, mood: "idle" }],
      who: "The Mandalorian", text: "These shipments don't leave the planet. They go to a creature research outpost out in the wilderness.",
    },
    {
      scene: "nevarro",
      cast: [{ a: "core", x: 640, y: 300, scale: 1.2 }],
      who: "Narrator", text: "Every manifest ends with the same three words, stamped in red: Star Map Core.",
    },
  ],
  conclusion: "The crystal operation is in ruins, and a stolen map points to an abandoned creature research facility in the wilds.",

  build(b) {
    // Streets and rooftops
    b.block(0, 1000, 4600, 200);
    b.block(500, 880, 300, 120);
    b.block(900, 770, 300, 230);
    b.ledge(1235, 890, 90);
    b.ledge(1280, 760, 90);
    b.block(1400, 660, 420, 340);
    b.move(1830, 650, 110, 200, 0, 4.2);
    b.ledge(1840, 890, 100);
    b.ledge(1990, 780, 100);
    b.block(2150, 660, 500, 340);
    b.ledge(2250, 545, 120);
    b.ledge(2370, 440, 120);
    b.puck(2430, 370);
    b.ledge(2662, 890, 90);
    b.block(2760, 780, 300, 220);
    b.deco("pipe", 440, 1000, { h: 170 });
    b.deco("lamp", 260, 1000, { color: "#ffad4d" });
    b.deco("antenna", 1480, 660);
    b.deco("lamp", 2100, 1000, { color: "#ffad4d" });
    b.deco("pipe", 2560, 660, { h: 100 });
    b.deco("banner", 3300, 1000, { imperial: true, color: "#23262c" });
    b.deco("cargo", 3500, 1000);
    b.deco("lamp", 3900, 1000, { color: "#ff6a3d" });
    b.foe("stormtrooper", 720, 880, { range: 60 });
    b.foe("hunter", 1080, 770, { range: 70 });
    b.foe("scout", 1660, 660, { range: 90 });
    b.foe("battleDroid", 2300, 660);
    b.foe("stormtrooper", 2560, 660);
    b.foe("hunter", 2900, 780, { range: 80 });
    b.foe("stormtrooper", 3500, 1000);
    b.foe("battleDroid", 3720, 1000);
    b.foe("battleDroid", 3830, 1000);
    b.crate(3400, 1000, { drop: "health" });
    b.crate(3650, 1000, { barrel: true });
    b.checkpoint(3180, 1000);
    b.say(3260, "The Mandalorian", "The signal is right under our feet. There's a lift shaft at the end of this street.", [700, 1010]);

    // Lift shaft
    b.block(4900, 200, 1500, 1080);
    b.ledge(4620, 1130, 120);
    b.ledge(4770, 1250, 120);
    b.ledge(4620, 1370, 120);

    // Tunnels, heading back west
    b.material("basalt");
    b.room("mine", 500, 1200, 4400, 280);
    b.reach("tunnels", 4600, 1260, 300, 220);
    b.block(4000, 1480, 900, 120);
    b.block(3500, 1580, 500, 20);
    b.hazard("lava", 3500, 1506, 500, 74);
    b.move(3520, 1470, 130, 350, 0, 4.5);
    b.block(2700, 1480, 800, 120);
    b.block(2500, 1580, 200, 20);
    b.hazard("lava", 2500, 1506, 200, 74);
    b.ledge(2565, 1440, 70);
    b.block(500, 1480, 2000, 120);
    b.checkpoint(4480, 1480);
    b.foe("stormtrooper", 4250, 1480);
    b.foe("battleDroid", 3300, 1480);
    b.foe("hunterMelee", 3000, 1480);
    b.foe("hunterHeavy", 2100, 1480);
    b.foe("miner", 1500, 1480);
    b.foe("stormtrooper", 900, 1480);
    b.hazard("steam", 2900, 1300, 50, 180, { period: 3, duty: 0.4, fire: true });
    b.hazard("steam", 1800, 1300, 50, 180, { period: 2.6, duty: 0.4 });
    b.node("extractorA", 1250, 1480, { big: true, color: "#b04cff", hp: 90 });
    b.crate(1650, 1480, { drop: "health" });
    b.checkpoint(1050, 1480);
    b.deco("crystal", 2300, 1480);
    b.deco("crystal", 700, 1480);
    b.deco("cargo", 4150, 1480);

    // Secret past the shaft
    b.block(5200, 1280, 1200, 320);
    b.block(4900, 1480, 300, 120);
    b.wall(4900, 1480, 30, 200);
    b.secret(4930, 1280, 268, 200);
    b.puck(5090, 1420);

    // Descent and heavy boulder alcove
    b.room("mine", 0, 1200, 500, 700);
    b.ledge(360, 1590, 130);
    b.ledge(250, 1700, 120);
    b.ledge(360, 1800, 130);
    b.block(0, 1680, 150, 40);
    b.boulder(150, 1900, 70, 180, [0, -190], { heavy: true });
    b.secret(0, 1720, 150, 178);
    b.puck(70, 1850); // Needs Heavy Object Movement, so it waits for a replay.

    // The mine, heading east
    b.material("mine");
    b.room("mine", 500, 1600, 5900, 400);
    b.ground(0, 900, 1900);
    b.ground(900, 1600, 1986, "basalt");
    b.hazard("lava", 900, 1932, 700, 54);
    b.move(920, 1890, 130, 220, 0, 3.8);
    b.fall(1310, 1860, 100);
    b.fall(1470, 1875, 90);
    b.ground(1600, 2600, 1900);
    b.ground(2600, 3000, 1986, "basalt");
    b.hazard("lava", 2600, 1932, 400, 54);
    b.fall(2680, 1870, 100);
    b.fall(2850, 1850, 100);
    b.ground(3000, 6400, 1900);
    b.checkpoint(700, 1900);
    b.checkpoint(3120, 1900);
    b.say(600, "Moff Gideon", "Mandalorian. You have something of mine. Every mine you break only tells me where you are.", [1700, 1910]);
    b.foe("miner", 2000, 1900);
    b.foe("battleDroid", 2350, 1900);
    b.foe("battleDroid", 2450, 1900);
    b.foe("heavyDroid", 3700, 1900);
    b.foe("repairDroid", 3900, 1800);
    b.foe("officer", 4250, 1900);
    b.node("extractorB", 2520, 1900, { big: true, color: "#b04cff", hp: 110 });
    b.node("extractorC", 4100, 1900, { big: true, color: "#b04cff", hp: 130 });
    b.crate(3300, 1900, { drop: "health" });
    b.crate(3540, 1900, { barrel: true });
    b.crate(4400, 1900, { drop: "ammo" });
    b.deco("crystal", 1750, 1900);
    b.deco("tank", 3220, 1900, { light: "#ffb347" });
    b.deco("crystal", 3600, 1900);
    b.deco("generator", 4700, 1900);
    b.gate(4500, 1600, 1900, ["extractorA", "extractorB", "extractorC"], { seal: 1600, energy: true, color: "#b04cff" });
    b.foe("stormtrooper", 5000, 1900);
    b.foe("stormtrooper", 5250, 1900);
    b.exit(5700, 1900);
  },
});
