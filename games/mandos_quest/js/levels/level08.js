/* Level 8: up a frozen mountain, through the base and up its ventilation updrafts. */
MQ.defineLevel({
  id: 8,
  title: "The Imperial Fortress",
  planet: "Frozen Fortress",
  theme: "An Imperial base inside a frozen mountain",
  scene: "fortress",
  material: "ice",
  boss: "Imperial Guardian",
  miniBoss: true,
  width: 7600,
  height: 3000,
  start: [140, 2750],
  par: 330,
  objectives: [
    { text: "Scale the mountain", done: "base" },
    { text: "Disable the first security relay", done: "relayA" },
    { text: "Disable the second security relay", done: "relayB" },
    { text: "Secure the hangar", done: "hangar" },
    { text: "Destroy the Imperial Guardian", done: "boss" },
  ],

  intro: [
    {
      scene: "fortress", ground: "#8fa6ba",
      cast: [{ a: "mando", x: 420, jetpack: true, weapon: "pulse" }, { a: "baby", x: 270, y: 410, mood: "worried" }, { a: "ship", kind: "shuttle", x: 1000, y: 200, scale: 1.2 }],
      who: "The Mandalorian", text: "He isn't hiding the Core anymore. He's using it, sweeping the galaxy sector by sector, and it's looking for you.",
    },
    {
      scene: "hangarBay", ground: "#2b323b",
      cast: [{ a: "gideon", x: 450, action: "point" }, { a: "core", x: 880, y: 350 }],
      who: "Moff Gideon", text: "The scan has found the child on our doorstep. How considerate. Wake the Guardian.",
    },
    {
      scene: "hangarBay", ground: "#2b323b",
      cast: [{ a: "boss", kind: "guardian", x: 640, scale: 1.4, flip: true }],
      who: "Narrator", text: "Deep in the mountain, a war machine built to hold the fortress alone comes online.",
    },
  ],
  outro: [
    {
      scene: "hangarBay", ground: "#2b323b",
      cast: [{ a: "boss", kind: "guardian", x: 870, scale: 1.1, flip: true, down: true }, { a: "mando", x: 340, jetpack: true, action: "aim", weapon: "pulse" }],
      who: "The Mandalorian", text: "The cradle's empty. The scanner, the power lines, all of it ripped out and loaded onto transports.",
    },
    {
      scene: "space",
      cast: [{ a: "ship", kind: "cruiser", x: 720, y: 300, scale: 1.4, vx: 14 }, { a: "core", x: 760, y: 220, scale: 0.3 }],
      who: "Narrator", text: "High above the storm, Gideon's command ship carries the Star Map Core toward its final activation.",
    },
  ],
  conclusion: "The Guardian has fallen, but Gideon has moved the Star Map Core to his command ship.",

  build(b) {
    // Mountain
    b.ground(0, 1100, 2750);
    b.ground(1100, 1500, 2420);
    b.ground(1750, 2100, 2150);
    b.ledge(1560, 2300, 110);
    b.ground(2100, 2420, 2000);
    b.wind(1500, 2300, 250, 700, 520);
    b.deco("pine", 300, 2750);
    b.deco("pine", 520, 2750, { scale: 1.3 });
    b.deco("pine", 1300, 2420);
    b.deco("antenna", 1900, 2150);
    b.foe("scout", 800, 2750);
    b.foe("stormtrooper", 980, 2750);
    b.foe("scout", 1380, 2420);
    b.foe("probe", 1600, 2150);
    b.foe("hunterJet", 1950, 1900);
    b.hazard("rocks", 1180, 2100, 80, 320, { period: 3.4 });
    b.checkpoint(1160, 2420);
    b.block(1480, 1800, 180, 30);
    b.puck(1570, 1740);

    // Base corridors
    b.material("base");
    b.ground(2420, 4420, 2000);
    b.room("base", 2500, 1600, 1920, 400);
    b.block(2500, 0, 1920, 1600, "ice"); // The mountain above, so the base can't be flown over.
    b.block(2500, 1600, 40, 200);
    b.reach("base", 2500, 1800, 120, 200);
    b.checkpoint(2600, 2000);
    b.say(2620, "The Mandalorian", "Two relays run the blast doors. Expect turrets.", [1800, 2010]);
    b.block(2900, 1810, 300, 28);
    b.foe("turret", 3150, 1810);
    b.foe("stormtrooper", 2850, 2000);
    b.hazard("laser", 3000, 1840, 20, 160, { period: 2.6, duty: 0.4 });
    b.node("relayA", 2990, 1810, { color: "#ff5348", hp: 90 });
    b.foe("heavyTrooper", 3350, 2000);
    b.hazard("electric", 3480, 1940, 80, 60, { period: 2.4, duty: 0.45 });
    b.block(3640, 1790, 120, 210);
    b.node("relayB", 3700, 1790, { color: "#ff5348", hp: 110 });
    b.foe("officer", 3900, 2000);
    b.foe("securityDroid", 4050, 2000);
    b.foe("turret", 4180, 2000);
    b.deco("console", 2760, 2000);
    b.deco("cargo", 3260, 2000);
    b.deco("tank", 3850, 2000);
    b.crate(3560, 2000, { drop: "health" });
    b.boulder(4230, 1720, 60, 120, [0, -130], { heavy: true });
    b.block(4150, 1720, 270, 24);
    b.puck(4360, 1672);
    b.gate(4396, 1744, 2000, ["relayA", "relayB"], { seal: 1520, color: "#ff5348" });

    // Hangar
    b.ground(4420, 5700, 2000);
    b.room("base", 4420, 1400, 1080, 600);
    b.block(4420, 0, 1080, 1400, "ice");
    b.checkpoint(4500, 2000);
    b.ledge(4720, 1870, 130);
    b.ledge(5180, 1870, 130);
    b.deco("cargo", 4900, 2000, { scale: 1.3 });
    b.deco("banner", 5050, 2000, { imperial: true, color: "#23262c", h: 250 });
    b.supplies(4780, 1870);
    b.encounter("hangar", { x0: 4600, x1: 5420, floor: 2000, height: 420 }, [
      [["stormtrooper", 4700, 2000], ["stormtrooper", 5350, 2000], ["probe", 5000, 1750]],
      [["heavyTrooper", 5330, 2000], ["hunterJet", 4750, 1720], ["hunterElite", 5200, 2000]],
    ]);

    // Updraft climb
    b.block(5440, 1400, 40, 340);
    b.gate(5448, 1740, 2000, ["hangar"], { seal: 1400, color: "#ff5348" });
    b.wind(5560, 1420, 130, 580, 480);
    b.block(5700, 1420, 260, 1580);
    b.checkpoint(5830, 1420);
    b.foe("combatMachine", 5880, 1420, { range: 20 });
    b.wind(5980, 900, 120, 520, 480);
    b.ledge(5980, 1300, 120);
    b.material("ice");
    b.block(6110, 1060, 60, 1940);
    b.block(6170, 900, 1430, 2100);
    b.foe("scout", 6230, 900, { range: 20 });
    b.checkpoint(6240, 900);
    b.health(6300, 900);
    b.block(5640, 560, 160, 30);
    b.puck(5720, 500);

    // Summit
    b.ledge(6560, 770, 150, "base");
    b.ledge(6820, 660, 140, "base");
    b.ledge(7120, 770, 150, "base");
    b.deco("antenna", 6500, 900);
    b.deco("pine", 7440, 900);
    b.arena("guardian", 6380, 7540, 900, "hangarBay");
  },
});
