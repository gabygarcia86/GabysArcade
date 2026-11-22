/* Level 6: a three-tier descent beneath Mandalore, built around the jetpack. */
MQ.defineLevel({
  id: 6,
  title: "The Mythosaur Awakens",
  planet: "Mandalore",
  theme: "Underground cities and ruined temples",
  scene: "mandalore",
  material: "ruin",
  boss: "Krayt Dragon",
  width: 5200,
  height: 3200,
  start: [140, 600],
  par: 300,
  objectives: [
    { text: "Descend beneath the city", done: "descent" },
    { text: "Restore the ancient forge", done: "forge" },
    { text: "Find the buried archive", done: "archive" },
    { text: "Defeat the Krayt Dragon", done: "boss" },
  ],

  intro: [
    {
      scene: "mandalore", ground: "#172522",
      cast: [{ a: "mando", x: 440, jetpack: true }, { a: "baby", x: 280, y: 410 }],
      who: "The Mandalorian", text: "Mandalore. They told us it was poison and glass. But the Core's power line runs straight beneath it.",
    },
    {
      scene: "sanctuary", ground: "#0b232d",
      cast: [{ a: "enemy", art: "ancient", x: 360, scale: 2 }, { a: "enemy", art: "miner", x: 900, scale: 2, flip: true }],
      who: "Narrator", text: "Imperial drills bite into cities that slept for centuries, while their ancient guardians still stand watch.",
    },
    {
      scene: "kraytPit", ground: "#3a1e10",
      cast: [{ a: "boss", kind: "krayt", x: 620, scale: 1.2 }],
      who: "Narrator", text: "Beneath even the legends, something has made its den in the warmth of the old forges.",
    },
  ],
  outro: [
    {
      scene: "sanctum", ground: "#0c242a",
      cast: [{ a: "mando", x: 420, anim: "crouch", jetpack: true }, { a: "map", x: 760, y: 340 }],
      who: "The Mandalorian", text: "These records are older than any clan. They speak of a living Mythosaur, and of our people sworn to keep it sleeping.",
    },
    {
      scene: "sanctum",
      cast: [{ a: "boss", kind: "mythosaur", x: 640, y: 640, scale: 1.2, shadow: true }],
      who: "Narrator", text: "The last carving shows the great beast curled around a single point of light: the heart of the Star Map.",
    },
  ],
  conclusion: "Ancient records reveal the forgotten history of Mandalore, and a living Mythosaur guarding a sanctuary deeper still.",

  build(b) {
    // Upper city
    b.block(0, 600, 1500, 400);
    b.block(700, 340, 300, 260);
    b.hint(240, "JETPACK: jump, then keep holding Space to fly. Release to stop. Fuel refills on the ground.", { touch: "JETPACK: jump, then keep holding Jump to fly. Let go to stop. Fuel refills on the ground.", needs: "jetpack" });
    b.hint(1260, "Wide gap. Jump, hold to fly, and watch your fuel.", { needs: "jetpack" });
    b.block(1500, 760, 600, 240, "basalt");
    b.hazard("lava", 1500, 690, 600, 70);
    b.block(2100, 600, 600, 400);
    b.block(2700, 760, 800, 240, "basalt");
    b.hazard("lava", 2700, 690, 800, 70);
    b.fall(2800, 560, 120);
    b.fall(3030, 520, 120);
    b.fall(3260, 570, 120);
    b.block(3500, 600, 1300, 400);
    b.block(3770, 160, 180, 30);
    b.puck(3860, 100);
    b.deco("column", 380, 600);
    b.deco("column", 560, 600, { broken: true });
    b.deco("statue", 1380, 600);
    b.deco("banner", 2200, 600);
    b.deco("column", 2480, 600, { broken: true });
    b.deco("statue", 4100, 600);
    b.foe("miner", 1150, 600);
    b.foe("ancientDroid", 1350, 600);
    b.foe("stormtrooper", 2300, 600);
    b.foe("probe", 2500, 440);
    b.foe("ancientDroid", 3900, 600);
    b.foe("stormtrooper", 4400, 600);
    b.foe("hunterJet", 4550, 430);
    b.checkpoint(2160, 600);
    b.checkpoint(3560, 600);

    // Lava chambers, heading west
    b.room("ruin", 400, 1000, 4400, 700);
    b.reach("descent", 4800, 1100, 400, 400);
    b.ledge(4820, 1120, 120);
    b.ledge(5060, 1400, 130);
    b.block(4100, 1700, 1100, 400);
    b.block(1500, 1860, 2600, 240, "basalt");
    b.hazard("lava", 1500, 1790, 2600, 70);
    b.block(3700, 1620, 160, 240);
    b.block(3250, 1500, 160, 360);
    b.move(2770, 1480, 130, 0, 170, 4.5);
    b.block(2350, 1560, 160, 300);
    b.fall(2120, 1530, 110);
    b.block(1840, 1640, 150, 220);
    b.block(400, 1700, 1100, 400);
    b.checkpoint(4650, 1700);
    b.checkpoint(1400, 1700);
    b.foe("miner", 4400, 1700);
    b.foe("probe", 3500, 1340);
    b.foe("probe", 2600, 1330);
    b.foe("flyer", 2000, 1400);
    b.foe("heavyDroid", 1250, 1700);
    b.foe("stormtrooper", 1000, 1700);
    b.supplies(2430, 1560);

    b.block(2810, 1230, 440, 28);
    b.block(3222, 1000, 28, 230);
    b.wall(2940, 1230, 28, 230);
    b.secret(2968, 1000, 254, 230);
    b.puck(3110, 1170);

    b.say(1300, "The Mandalorian", "The forge still has power. Baby G, can you feel the mechanism?", [1500, 1710]);
    b.mechanism("forge", 850, 1700);
    b.deco("statue", 700, 1700);
    b.deco("column", 1100, 1700);
    b.block(540, 1000, 40, 500);
    b.gate(548, 1500, 1700, ["forge"], { seal: 1500, energy: true, color: "#58d6c2" });

    // Deep temple, heading east
    b.material("temple");
    b.room("temple", 0, 2100, 3400, 800);
    b.ledge(0, 1850, 120);
    b.ledge(250, 2150, 130);
    b.ledge(0, 2450, 120);
    b.ledge(250, 2680, 130);
    b.ground(0, 1300, 2900);
    b.ground(1300, 1750, 3100, "basalt");
    b.hazard("lava", 1300, 2990, 450, 110);
    b.fall(1380, 2800, 110);
    b.fall(1560, 2770, 110);
    b.ground(1750, 5200, 2900);
    b.checkpoint(500, 2900);
    b.checkpoint(1830, 2900);
    b.foe("ancientDroid", 800, 2900);
    b.foe("crawler", 1100, 2900);
    b.foe("spider", 1150, 2138);
    b.foe("ancientDroid", 2150, 2900);
    b.foe("ancientDroid", 2500, 2900);
    b.foe("crawler", 2750, 2900);
    b.hazard("rocks", 1950, 2300, 80, 600, { period: 3.2 });
    b.block(2210, 2500, 390, 30);
    b.block(2572, 2280, 28, 220);
    b.block(2300, 2250, 300, 30);
    b.rubbleWall(2300, 2500, 44, 220);
    b.puck(2480, 2440);
    b.deco("statue", 2000, 2900);
    b.deco("column", 2380, 2900);
    b.deco("statue", 2900, 2900, { flip: true });
    b.reach("archive", 3040, 2100, 120, 800);
    b.say(3040, "The Mandalorian", "The archive. And something has been sleeping on top of it.", [2580, 2910]);
    b.checkpoint(3200, 2900);
    b.health(3260, 2900);

    // Krayt pit
    b.ledge(3600, 2760, 140);
    b.ledge(3820, 2640, 120);
    b.ledge(4600, 2640, 120);
    b.ledge(4840, 2760, 140);
    b.deco("bones", 4100, 2900);
    b.deco("bones", 4700, 2900, { flip: true });
    b.arena("krayt", 3400, 5120, 2900, "kraytPit");
  },
});
