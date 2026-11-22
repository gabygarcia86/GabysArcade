/* Level 5: up through a sandcrawler, over a tower and down a well into buried ruins. */
MQ.defineLevel({
  id: 5,
  title: "The Sands of Tatooine",
  planet: "Tatooine",
  theme: "Settlements, dunes and buried ruins",
  scene: "tatooine",
  material: "sand",
  width: 7600,
  height: 2200,
  start: [130, 1300],
  par: 300,
  objectives: [
    { text: "Cross the dunes to the old well", done: "well" },
    { text: "Have Baby G wake the ancient beacon", done: "beacon" },
    { text: "Leave through the ruins" },
  ],

  intro: [
    {
      scene: "space",
      cast: [{ a: "planet", x: 980, y: 340, r: 230, color: "#c9975c" }, { a: "ship", kind: "gunship", x: 260, y: 340, vx: 55 }],
      who: "Narrator", text: "The research records end on a desert world with two suns, where an ancient structure has started to hum.",
    },
    {
      scene: "tatooine", ground: "#9c6c42",
      cast: [{ a: "enemy", art: "jawa", x: 330, n: 2, scale: 1.8 }, { a: "mando", x: 820, flip: true }],
      who: "The Mandalorian", text: "The Jawas say the sand sings at night now. The Tuskens won't let anyone near the old well. We'll go near the old well.",
    },
    {
      scene: "tatooine", ground: "#9c6c42",
      cast: [{ a: "enemy", art: "raider", x: 800, n: 3, flip: true, action: "hold" }, { a: "baby", x: 330, y: 410, mood: "worried" }],
      who: "Narrator", text: "Far beneath the dunes, something answers whenever the child comes closer.",
    },
  ],
  outro: [
    {
      scene: "sanctum",
      cast: [{ a: "map", x: 640, y: 290, scale: 1.5 }, { a: "baby", x: 340, y: 470, mood: "force" }],
      who: "Narrator", text: "At Baby G's touch the beacon paints the dark with stars. A dozen ancient sites across the galaxy, all linked to one Core.",
    },
    {
      scene: "tatooine", ground: "#9c6c42",
      cast: [{ a: "mando", x: 600, anim: "fly", lift: 150, jetpack: true }, { a: "baby", x: 400, y: 320, mood: "happy" }],
      who: "The Mandalorian", text: "The brightest point is Mandalore. Where we're going, the ground can't be trusted, so we'll fly.",
    },
  ],
  conclusion: "The signal comes from a network of ancient sites across the galaxy. The brightest of them all lies on Mandalore.",

  build(b) {
    // Settlement
    b.ground(0, 1900, 1300);
    b.material("adobe");
    b.block(420, 1190, 280, 110);
    b.block(760, 1085, 260, 215);
    b.ledge(1040, 1195, 100);
    b.block(1180, 1080, 300, 220);
    b.ledge(1500, 1190, 100);
    b.deco("hut", 220, 1300);
    b.deco("vaporator", 360, 1300);
    b.deco("vaporator", 860, 1085, { scale: 0.7 });
    b.deco("hut", 1740, 1300, { scale: 0.8 });
    b.foe("jawa", 560, 1190, { range: 60 });
    b.foe("raider", 900, 1085, { range: 70 });
    b.foe("jawa", 1300, 1080, { range: 70 });
    b.foe("scavenger", 1650, 1300);
    b.crate(1400, 1080, { drop: "health" });

    // Sinking sand
    b.material("sand");
    b.ground(1900, 2400, 1420);
    b.hazard("sinksand", 1900, 1302, 500, 118);
    b.fall(1990, 1270, 110);
    b.fall(2190, 1250, 120);
    b.hint(1700, "Sinking sand pulls you under. Keep jumping to get free.", { touch: "Sinking sand pulls you under. Keep tapping Jump to get free.", area: [1150, 1310] });
    b.ground(2400, 4400, 1300);
    b.checkpoint(2450, 1300);

    // Sandcrawler
    b.material("rust");
    b.room("rust", 2540, 640, 1120, 660);
    b.block(2500, 640, 40, 480);
    b.block(3660, 640, 40, 660);
    b.block(2700, 1080, 960, 30);
    b.ledge(2560, 1185, 120);
    b.block(2540, 860, 860, 30);
    b.ledge(3440, 975, 120);
    b.block(2700, 640, 960, 40);
    b.ledge(2560, 750, 120);
    b.wall(3450, 1300, 28, 190);
    b.secret(3480, 1110, 178, 190);
    b.puck(3570, 1240);
    b.ledge(3080, 530, 130);
    b.ledge(3240, 425, 130);
    b.ledge(3080, 320, 130);
    b.puck(3140, 250);
    b.deco("cargo", 2900, 1300);
    b.deco("tank", 3120, 1080, { color: "#7a5140" });
    b.deco("cargo", 2780, 860);
    b.foe("scavenger", 2900, 1300);
    b.foe("jawa", 3000, 1080);
    b.foe("scavenger", 3250, 1080);
    b.foe("jawa", 2900, 860);
    b.foe("jawa", 3100, 860);
    b.crate(3300, 860, { drop: "health" });
    b.foe("scavenger", 3400, 640);
    b.checkpoint(3560, 640);

    // Dunes and tower
    b.material("sand");
    b.ground(4400, 4420, 1300);
    b.block(4420, 1300, 580, 300);
    b.foe("raider", 4000, 1300);
    b.foe("skitter", 4200, 1300);
    b.foe("raider", 4480, 1300);
    b.foe("flyer", 4100, 1060);
    b.deco("bones", 3900, 1300);
    b.deco("bush", 4300, 1300);
    b.material("adobe");
    b.block(4860, 760, 140, 540);
    b.ledge(4740, 1190, 120);
    b.ledge(4600, 1080, 120);
    b.ledge(4740, 970, 120);
    b.ledge(4600, 865, 120);
    b.ledge(4750, 765, 110);
    b.checkpoint(4930, 760);

    // Well shaft
    b.block(5300, 600, 2300, 1000);
    b.reach("well", 5000, 600, 300, 1000);
    b.ledge(5010, 1000, 110);
    b.ledge(5180, 1170, 120);
    b.ledge(5010, 1340, 110);
    b.ledge(5180, 1510, 120);
    b.ledge(5020, 1680, 120);

    // Ruins
    b.material("ruin");
    b.room("adobe", 4420, 1600, 3180, 300);
    b.ground(4420, 5760, 1900);
    b.rubbleWall(4690, 1900, 50, 300);
    b.secret(4420, 1600, 268, 300);
    b.puck(4540, 1840);
    b.checkpoint(5240, 1900);
    b.say(5300, "The Mandalorian", "This isn't a well. It's an antenna, built long before the Republic.", [1700, 1910]);
    b.foe("ancientDroid", 5520, 1900);
    b.ground(5760, 6120, 2050);
    b.hazard("sinksand", 5760, 1904, 360, 146);
    b.move(5780, 1880, 120, 200, 0, 4);
    b.ground(6120, 7600, 1900);
    b.foe("scavenger", 6250, 1900);
    b.foe("crawler", 6420, 1900);
    b.hazard("electric", 6520, 1850, 70, 50, { period: 2.6, duty: 0.45 });
    b.deco("column", 6180, 1900);
    b.deco("column", 6620, 1900, { broken: true });
    b.deco("statue", 6900, 1900);
    b.mechanism("beacon", 6760, 1900);
    b.deco("crystal", 6700, 1900, { color: "#58d6c2", scale: 0.7 });
    b.health(6330, 1900);
    b.gate(7050, 1600, 1900, ["beacon"], { seal: 1600, energy: true, color: "#58d6c2" });
    b.exit(7380, 1900);
  },
});
