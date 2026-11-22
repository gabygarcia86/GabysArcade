/* Level 2: mesas, gorges and Force puzzles, ending in the Mudhorn's den. */
MQ.defineLevel({
  id: 2,
  title: "The Mudhorn Valley",
  planet: "Arvala-7",
  theme: "Rocky canyons and dangerous wilderness",
  scene: "canyon",
  material: "canyon",
  boss: "Mudhorn",
  width: 8400,
  height: 1300,
  start: [140, 1000],
  par: 260,
  objectives: [
    { text: "Cross the valley", done: "valley" },
    { text: "Defeat the Mudhorn", done: "boss" },
  ],

  intro: [
    {
      scene: "canyon", ground: "#7c4730",
      cast: [{ a: "ship", kind: "gunship", x: 950, y: 478, scale: 1.4, thrust: 0, smoke: true }, { a: "mando", x: 420 }, { a: "baby", x: 280, y: 420, mood: "worried" }],
      who: "The Mandalorian", text: "They holed the fuel line before we left atmosphere. There's a settlement past the valley with the parts we need.",
    },
    {
      scene: "canyon", ground: "#7c4730",
      cast: [{ a: "enemy", art: "jawa", x: 330, scale: 1.8 }, { a: "mando", x: 820, flip: true }],
      who: "Settler", text: "Nobody crosses the valley anymore. Something with a horn as long as a speeder tears through every caravan we send.",
    },
    {
      scene: "mudhornDen", ground: "#3f2119",
      cast: [{ a: "boss", kind: "mudhorn", x: 760, scale: 1.5, flip: true }],
      who: "Narrator", text: "Deep in the valley, the ground begins to shake.",
    },
  ],
  outro: [
    {
      scene: "mudhornDen", ground: "#3f2119",
      cast: [{ a: "mando", x: 380, anim: "crouch" }, { a: "baby", x: 580, y: 420, mood: "force" }, { a: "boss", kind: "mudhorn", x: 970, scale: 1.1, flip: true, down: true }],
      who: "The Mandalorian", text: "You stopped a creature that size... without touching it. What are you, kid?",
    },
    {
      scene: "canyon", ground: "#7c4730",
      cast: [{ a: "mando", x: 700, anim: "walk" }, { a: "baby", x: 530, y: 420, mood: "sad" }, { a: "ship", kind: "gunship", x: 1050, y: 180, scale: 0.7 }],
      who: "Narrator", text: "The child sleeps for a full day. The Mandalorian understands now why someone would cross a galaxy to take him.",
    },
  ],
  conclusion: "The valley is safe, and you have seen the first real sign of Baby G's extraordinary connection to the Force.",

  build(b) {
    // Mesas
    b.ground(0, 700, 1000);
    b.ground(700, 900, 890);
    b.ground(900, 1150, 780);
    b.ground(1330, 1700, 820);
    b.hill([[1700, 820], [1900, 900], [2100, 1000]]);
    b.ground(2100, 2900, 1000);
    b.deco("rock", 300, 1000);
    b.deco("bush", 520, 1000);
    b.deco("bones", 1020, 780);
    b.deco("rock", 1560, 820, { scale: 0.8 });
    b.foe("skitter", 560, 1000);
    b.foe("hunter", 1060, 780);
    b.foe("flyer", 1240, 620);
    b.foe("hunterMelee", 1560, 820);
    b.crate(820, 890, { drop: "health" });

    // Tunnel blocked by rubble
    b.block(2250, 500, 500, 350);
    b.puck(2500, 440); // Needs the jetpack, so it waits for a replay.
    b.hint(2110, "Baby G can clear rubble marked with a blue rune. Press K for Force Push.", { touch: "Baby G can clear rubble marked with a blue rune. Tap Force.", needs: "force" });
    b.rubbleWall(2400, 1000, 70, 150);
    b.checkpoint(2180, 1000);
    b.foe("skitter", 2620, 1000);

    // A boulder becomes a stepping stone
    b.boulder(2760, 1000, 140, 130, [270, 130]);
    b.say(2560, "The Mandalorian", "That gap is too wide. Think you could move that boulder, kid?");
    b.ground(3300, 3700, 1000);
    b.ground(3700, 3900, 890);
    b.ground(3900, 4150, 780);
    b.checkpoint(3380, 1000);
    b.foe("hunter", 3560, 1000);
    b.foe("skitter", 3820, 890);
    b.foe("flyer", 3980, 600);
    b.deco("bush", 3460, 1000);

    // Crumbling gorge
    b.fall(4230, 760, 120);
    b.fall(4420, 740, 120);
    b.fall(4570, 760, 90);
    b.foe("flyer", 4440, 560);
    b.ground(4700, 5300, 780);
    b.ledge(4820, 670, 110);
    b.ledge(4940, 580, 110);
    b.block(5060, 500, 240, 28);
    b.block(5140, 300, 160, 50);
    b.block(5276, 350, 24, 150);
    b.rubbleWall(5140, 500, 40, 150);
    b.puck(5230, 450);
    b.hazard("rocks", 4760, 420, 70, 360, { period: 3 });
    b.foe("hunter", 4900, 780);
    b.foe("hunterMelee", 5180, 780);
    b.deco("bones", 5000, 780);

    // Cave system
    b.hill([[5300, 780], [5480, 900], [5700, 1040]]);
    b.material("cave");
    b.ground(5700, 6100, 1040);
    b.ground(6240, 6600, 1040);
    b.room("cave", 5720, 620, 860, 680);
    b.block(5700, 600, 300, 270);
    b.block(6000, 600, 300, 100);
    b.block(6300, 600, 300, 270);
    b.ledge(6010, 940, 120);
    b.ledge(6000, 840, 300);
    b.wall(6180, 840, 26, 140);
    b.secret(6206, 700, 92, 140);
    b.puck(6255, 800);
    b.foe("spider", 5860, 908);
    b.foe("spider", 6380, 908);
    b.foe("crawler", 6480, 1040);
    b.hazard("spikes", 5960, 1016, 40, 24, { color: "#8f7563" });
    b.deco("crystal", 5780, 1040, { color: "#e0a43a", scale: 0.6 });

    // The den
    b.material("canyon");
    b.ground(6600, 8400, 1040);
    b.checkpoint(6660, 1040);
    b.health(6740, 1040);
    b.reach("valley", 6640, 0, 100, 1040);
    b.say(6700, "The Mandalorian", "Horn marks on every rock. Stay behind me. When it charges, get out of its way.");
    b.ledge(7020, 915, 150);
    b.ledge(7220, 800, 150);
    b.ledge(7880, 800, 150);
    b.ledge(8080, 915, 120);
    for (const x of [7120, 7500, 7560, 7960]) b.crate(x, 1040, { drop: x === 7500 ? "health" : undefined });
    b.deco("bones", 7380, 1040);
    b.deco("bones", 7760, 1040, { flip: true });
    b.block(8300, 500, 100, 540);
    b.arena("mudhorn", 6880, 8280, 1040, "mudhornDen");
  },
});
