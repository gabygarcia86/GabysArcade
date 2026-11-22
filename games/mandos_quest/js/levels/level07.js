/* Level 7: a flooded cavern of rafts and stone pillars, with seals at the bottom and top. */
MQ.defineLevel({
  id: 7,
  title: "The Living Legend",
  planet: "Mandalore",
  theme: "Underground lakes and an ancient sanctuary",
  scene: "sanctuary",
  material: "temple",
  boss: "Mythosaur",
  width: 9200,
  height: 2200,
  start: [140, 1700],
  par: 330,
  objectives: [
    { text: "Wake the lake seal", done: "lakeSeal" },
    { text: "Wake the sunken seal", done: "sunkenSeal" },
    { text: "Wake the high seal", done: "highSeal" },
    { text: "Face the living legend", done: "boss" },
  ],

  intro: [
    {
      scene: "sanctuary", ground: "#0b232d",
      cast: [{ a: "mando", x: 430, jetpack: true }, { a: "baby", x: 270, y: 410, mood: "idle" }],
      who: "The Mandalorian", text: "Three seals guard the sanctuary. The records say only a hand that asks, and doesn't take, can open them.",
    },
    {
      scene: "sanctuary", ground: "#0b232d",
      cast: [{ a: "enemy", art: "trooper", x: 720, n: 3, flip: true }, { a: "enemy", art: "probe", x: 400, y: 440, scale: 2 }],
      who: "Narrator", text: "Imperial scavengers got here first. Most of them never found their way back out.",
    },
    {
      scene: "sanctum", ground: "#0c242a",
      cast: [{ a: "boss", kind: "mythosaur", x: 680, scale: 1.25, flip: true }],
      who: "Narrator", text: "It has guarded this place for generations. It has never once been overpowered.",
    },
  ],
  outro: [
    {
      scene: "sanctum", ground: "#0c242a",
      cast: [{ a: "boss", kind: "mythosaur", x: 800, scale: 1.1, flip: true, bow: true }, { a: "mando", x: 250, anim: "crouch", jetpack: true }, { a: "baby", x: 130, y: 420, mood: "happy" }],
      who: "Narrator", text: "The great creature lowers its head. It was never testing strength. It was testing who the Mandalorian fought for.",
    },
    {
      scene: "space",
      cast: [{ a: "map", x: 640, y: 300, scale: 1.5 }],
      who: "The Mandalorian", text: "The sanctuary's map shows one point burning red: a fortress in a frozen mountain. Gideon is preparing the Core there.",
    },
  ],
  conclusion: "The Mythosaur yields and reveals the location of the Imperial fortress where Moff Gideon is preparing the Star Map Core.",

  build(b) {
    // The lake
    b.ground(0, 7200, 2160, "cave");
    b.hazard("water", 900, 1990, 6300, 170);
    b.ground(0, 900, 1700);
    b.deco("statue", 300, 1700);
    b.deco("crystal", 620, 1700, { color: "#3fb8c9" });
    b.foe("stormtrooper", 600, 1700);
    b.foe("scavenger", 780, 1700);
    b.move(930, 1760, 150, 300, 0, 5);
    b.move(1470, 1720, 150, 0, 110, 3.6);
    b.ledge(1700, 1700, 100);
    b.foe("eel", 1380, 1990);
    b.foe("eel", 1640, 1990);
    b.ground(1900, 2500, 1700);
    b.checkpoint(1980, 1700);
    b.foe("ancientDroid", 2250, 1700);
    b.mechanism("lakeSeal", 2380, 1700);
    b.deco("column", 2120, 1700);
    b.bridge("lakeSeal", 2540, 1650, 520);
    b.block(2850, 0, 60, 1300);
    b.gate(2870, 1300, 1990, ["lakeSeal"], { seal: 1300, energy: true, color: "#58d6c2" });
    b.foe("eel", 2700, 1990);

    // Hanging cavern
    b.ground(3100, 3380, 1650);
    b.checkpoint(3170, 1650);
    b.say(3180, "The Mandalorian", "Two seals left. One at the waterline, one near the roof.", [1400, 1660]);
    b.ground(3820, 4120, 1830);
    b.mechanism("sunkenSeal", 3980, 1830);
    b.foe("crawler", 3900, 1830, { range: 60 });
    b.block(3500, 1470, 150, 520);
    b.block(3700, 1230, 130, 60);
    b.block(4000, 1390, 140, 50);
    b.move(4250, 1330, 130, 0, -260, 5);
    b.block(4480, 1180, 130, 60);
    b.block(4300, 740, 120, 40);
    b.fall(4660, 980, 110);
    b.block(3640, 600, 150, 40);
    b.puck(3715, 540);
    b.foe("probe", 3650, 1100);
    b.foe("hunterJet", 4400, 1000);
    b.foe("eel", 4450, 1990);
    b.supplies(4065, 1390);

    b.block(4150, 1600, 260, 30, "cave");
    b.block(4386, 1430, 24, 170, "cave");
    b.block(4200, 1420, 210, 30, "cave");
    b.wall(4200, 1600, 24, 150);
    b.secret(4224, 1450, 162, 150, "cave");
    b.puck(4310, 1545);

    // High terrace
    b.block(4800, 850, 900, 120);
    b.checkpoint(4860, 850);
    b.foe("securityDroid", 5100, 850);
    b.foe("heavyTrooper", 5300, 850);
    b.mechanism("highSeal", 5480, 850);
    b.deco("statue", 4980, 850);
    b.deco("column", 5360, 850);
    b.block(5640, 0, 60, 600);
    b.gate(5658, 600, 850, ["lakeSeal", "sunkenSeal", "highSeal"], { seal: 600, energy: true, color: "#d4a93f" });
    b.block(5640, 970, 60, 1190);

    // Machinery descent
    b.block(5700, 850, 250, 1310);
    b.move(6000, 900, 130, 0, 300, 5.5);
    b.block(6220, 1150, 200, 1010);
    b.hazard("laser", 6310, 990, 20, 160, { period: 2.8, duty: 0.4 });
    b.move(6480, 1250, 120, 200, 0, 4);
    b.block(6820, 1400, 160, 760);
    b.foe("battleDroid", 5850, 850, { range: 50 });
    b.foe("probe", 6150, 920);
    b.foe("stormtrooper", 6340, 1150, { range: 50 });
    b.foe("combatMachine", 6900, 1400, { range: 20 });
    b.deco("column", 6380, 1150, { broken: true });

    b.block(5970, 420, 490, 36);
    b.block(6424, 210, 36, 210);
    b.block(6100, 180, 360, 30);
    b.boulder(6100, 420, 66, 210, [0, -230], { heavy: true });
    b.puck(6330, 360);

    // Sanctum
    b.ground(7000, 9200, 1700);
    b.checkpoint(7090, 1700);
    b.health(7170, 1700);
    b.deco("statue", 7130, 1700);
    b.say(7060, "The Mandalorian", "It's real. Don't try to push it, kid. When it lowers its head, that's our moment.", [1300, 1710]);
    b.fall(7420, 1565, 160);
    b.fall(7680, 1440, 160);
    b.fall(8460, 1440, 160);
    b.fall(8720, 1565, 160);
    b.ledge(8060, 1380, 160);
    b.deco("column", 7560, 1700, { h: 220 });
    b.deco("column", 8600, 1700, { h: 220 });
    b.arena("mythosaur", 7260, 9120, 1700, "sanctum");
  },
});
