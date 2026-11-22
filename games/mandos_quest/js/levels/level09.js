/*
 * Level 9: an open hub. A central shaft joins wings on four decks, and the three
 * regulators can be destroyed in any order.
 */
MQ.defineLevel({
  id: 9,
  title: "The Star Map Core",
  planet: "Imperial Command Ship",
  theme: "Machinery, energy chambers and secret rooms",
  scene: "starship",
  material: "ship",
  width: 5000,
  height: 2600,
  start: [2500, 2400],
  par: 360,
  objectives: [
    { text: "Destroy all three Core regulators", done: "regulators" },
    { text: "Reach the command chamber on the top deck" },
  ],

  intro: [
    {
      scene: "space",
      cast: [{ a: "ship", kind: "cruiser", x: 760, y: 260, scale: 1.5 }, { a: "ship", kind: "gunship", x: 220, y: 480, scale: 0.6, vx: 30 }],
      who: "Narrator", text: "A single small gunship slips into the shadow of the command ship.",
    },
    {
      scene: "starship", ground: "#1e2432",
      cast: [{ a: "enemy", art: "darkTrooper", x: 760, n: 3, flip: true }, { a: "mando", x: 340, jetpack: true, action: "rifle", weapon: "pulse" }],
      who: "The Mandalorian", text: "Three regulators feed the Core: one low, one in the middle, one high. Break them all and the machine starves.",
    },
    {
      scene: "throne", ground: "#120c20",
      cast: [{ a: "gideon", x: 420, armed: "saber", action: "point" }, { a: "core", x: 840, y: 300, scale: 1.3 }],
      who: "Moff Gideon", text: "It needs only one more component: a living mind that can hear the whole galaxy at once. Bring me the child.",
    },
  ],
  outro: [
    {
      scene: "throne", ground: "#120c20",
      cast: [{ a: "core", x: 840, y: 300, scale: 1.5 }, { a: "mando", x: 330, jetpack: true, action: "aim", weapon: "blaster" }, { a: "baby", x: 180, y: 410, mood: "worried" }],
      who: "The Mandalorian", text: "The regulators are scrap. So why is it still running?",
    },
    {
      scene: "throne", ground: "#120c20",
      cast: [{ a: "gideon", x: 640, holo: true, armed: "saber" }],
      who: "Moff Gideon", text: "Because I started it an hour ago. The Core sails to my citadel, Mandalorian. Come and watch the galaxy unfold.",
    },
  ],
  conclusion: "You reached the command chamber, but the Star Map Core is already active. The final confrontation begins at Gideon's citadel.",

  build(b) {
    b.ground(0, 5000, 2400);

    // Central shaft
    for (const [x, y, dy, period] of [[2180, 2290, -440, 7], [2690, 1780, -420, 6.5], [2420, 1260, -400, 6]]) b.move(x, y, 140, 0, dy, period);
    b.ledge(2420, 2140, 160);
    b.ledge(2140, 1420, 140);
    b.ledge(2720, 890, 150);
    b.checkpoint(2420, 2400);
    b.say(2300, "The Mandalorian", "Regulators are in the wings, and they can go in any order. The way out is on the top deck.", [2200, 2410]);
    b.hint(2560, "Explore in any direction. Fly up the shaft and land on ledges to refuel.", { area: [2200, 2410] });
    b.foe("probe", 2500, 1600);
    b.foe("probe", 2400, 900);

    // Lower left: the laser gallery
    b.room("ship", 0, 1870, 2100, 530);
    b.block(0, 1750, 700, 120);
    b.block(900, 1750, 1200, 120);
    b.block(1500, 2260, 130, 140);
    b.hazard("laser", 1720, 2230, 20, 170, { period: 2.4, duty: 0.4 });
    b.hazard("laser", 1300, 2230, 20, 170, { period: 2.4, duty: 0.4, phase: 1.2 });
    b.hazard("electric", 1000, 2340, 100, 60, { period: 2.2, duty: 0.45 });
    b.foe("eliteTrooper", 1900, 2400);
    b.foe("darkTrooper", 1150, 2400);
    b.foe("repairDroid", 820, 2290);
    b.foe("turret", 600, 2400);
    b.node("regulatorA", 300, 2400, { big: true, color: "#6fb8ff", hp: 240 });
    b.checkpoint(1420, 2400);
    b.ledge(700, 2110, 120);
    b.ledge(790, 1900, 110);
    b.deco("generator", 450, 2400, { color: "#6fb8ff" });
    b.deco("tank", 1800, 2400);

    // Middle left
    b.room("ship", 0, 1220, 2100, 530);
    b.block(0, 1100, 2100, 120);
    b.foe("battleDroid", 1500, 1750);
    b.foe("battleDroid", 1620, 1750);
    b.foe("heavyDroid", 1150, 1750);
    b.foe("eliteTrooper", 620, 1750);
    b.checkpoint(1980, 1750);
    b.wall(400, 1750, 30, 530);
    b.secret(0, 1220, 400, 530);
    b.puck(180, 1680);
    b.health(250, 1750);
    b.deco("console", 1000, 1750);
    b.deco("cargo", 1380, 1750);

    // Upper left: the collapsing catwalks
    b.room("ship", 0, 520, 2100, 580);
    b.block(0, 400, 2100, 120);
    b.checkpoint(1990, 1100);
    b.hazard("electric", 800, 1070, 800, 30);
    b.fall(1480, 990, 110);
    b.fall(1270, 940, 110);
    b.fall(1060, 910, 110);
    b.fall(860, 960, 110);
    b.foe("eliteTrooper", 1800, 1100);
    b.foe("hunterJet", 1200, 720);
    b.foe("darkTrooper", 560, 1100);
    b.node("regulatorC", 260, 1100, { big: true, color: "#ffb347", hp: 240 });
    b.deco("generator", 400, 1100, { color: "#ffb347" });
    b.block(120, 170, 200, 30);
    b.puck(220, 120);

    // Lower right: the cargo hold
    b.room("ship", 2900, 1970, 2100, 430);
    b.block(2900, 1850, 2100, 120);
    b.foe("battleDroid", 3200, 2400);
    b.foe("combatMachine", 3700, 2400);
    b.foe("eliteTrooper", 4200, 2400);
    b.crate(3350, 2400, { barrel: true });
    b.crate(3500, 2400, { drop: "health" });
    b.deco("cargo", 3900, 2400, { scale: 1.2 });
    b.block(4480, 2120, 520, 30);
    b.boulder(4480, 2400, 80, 250, [0, -280], { heavy: true });
    b.secret(4560, 2150, 440, 250);
    b.puck(4780, 2340);

    // Middle right: the Force-locked chamber
    b.room("ship", 2900, 1320, 2100, 530);
    b.block(2900, 1200, 2100, 120);
    b.checkpoint(3000, 1850);
    b.foe("darkTrooper", 3300, 1850);
    b.block(3460, 1600, 150, 36);
    b.mechanism("chamberPower", 3535, 1600);
    b.foe("eliteTrooper", 3700, 1850);
    b.foe("turret", 3900, 1850);
    b.block(4180, 1320, 30, 250);
    b.gate(4183, 1570, 1850, ["chamberPower"], { seal: 1570, energy: true, color: "#b04cff" });
    b.foe("guard", 4400, 1850);
    b.node("regulatorB", 4700, 1850, { big: true, color: "#b04cff", hp: 240 });
    b.deco("generator", 4560, 1850);
    b.deco("console", 3200, 1850, { color: "#b04cff" });

    // Upper right
    b.room("ship", 2900, 720, 2100, 480);
    b.checkpoint(3000, 1200);
    b.foe("securityDroid", 3250, 1200);
    b.foe("securityDroid", 3500, 1200);
    b.foe("heavyTrooper", 3900, 1200);
    b.foe("repairDroid", 4050, 1080);
    b.supplies(4600, 1200);
    b.deco("tank", 4400, 1200);

    // Command deck
    b.room("ship", 2900, 140, 2100, 460);
    b.block(2900, 600, 2100, 120);
    b.block(2900, 80, 2100, 60);
    b.checkpoint(2990, 600);
    b.foe("guard", 3300, 600);
    b.foe("officer", 3500, 600);
    b.block(3746, 140, 36, 180);
    b.gate(3750, 320, 600, ["regulatorA", "regulatorB", "regulatorC"], { energy: true, color: "#6fb8ff" });
    b.foe("darkTrooper", 4150, 600);
    b.deco("banner", 4400, 600, { imperial: true, color: "#23262c", h: 220 });
    b.exit(4760, 600);
    b.combine("regulators", ["regulatorA", "regulatorB", "regulatorC"]);
  },
});
