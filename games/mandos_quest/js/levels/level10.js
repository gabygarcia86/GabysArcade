/* Level 10: a gauntlet over the storm, with three ambushes before the throne. */
MQ.defineLevel({
  id: 10,
  title: "The Darksaber",
  planet: "Star Map Citadel",
  theme: "An Imperial citadel in an endless storm",
  scene: "storm",
  material: "citadel",
  boss: "Moff Gideon",
  width: 9500,
  height: 2000,
  start: [140, 1500],
  par: 400,
  objectives: [
    { text: "Break the outer guard", done: "outerGuard" },
    { text: "Take the high bridge", done: "highBridge" },
    { text: "Overload the first Core conduit", done: "conduitA" },
    { text: "Overload the second Core conduit", done: "conduitB" },
    { text: "Clear the throne approach", done: "throneGuard" },
    { text: "Defeat Moff Gideon", done: "boss" },
  ],

  intro: [
    {
      scene: "storm", ground: "#1d1630",
      cast: [{ a: "mando", x: 400, jetpack: true, weapon: "disruptor", action: "rifle" }, { a: "baby", x: 240, y: 410, mood: "worried" }],
      who: "The Mandalorian", text: "One more door, kid. Whatever happens in there, you don't stop fighting. Neither will I.",
    },
    {
      scene: "throne", ground: "#120c20",
      cast: [{ a: "core", x: 640, y: 280, scale: 1.6 }, { a: "gideon", x: 300, action: "raise" }],
      who: "Moff Gideon", text: "Do you know what the Core truly is? A census of every gifted being alive. I won't rule planets. I will own the future itself.",
    },
    {
      scene: "throne", ground: "#120c20",
      cast: [{ a: "gideon", x: 720, armed: "saber", action: "guard", scale: 2.6, flip: true }],
      who: "Moff Gideon", text: "And I will begin with the child.",
    },
  ],
  outro: [
    {
      scene: "throne", ground: "#120c20",
      cast: [{ a: "core", x: 800, y: 300, scale: 1.5 }, { a: "mando", x: 330, jetpack: true, action: "rifle", weapon: "heavy" }, { a: "baby", x: 480, y: 400, mood: "force" }],
      who: "The Mandalorian", text: "Together, kid. All of it, right into the heart.",
    },
    {
      scene: "storm",
      cast: [{ a: "core", x: 640, y: 320, scale: 1.4, broken: true }],
      who: "Narrator", text: "The Star Map Core shatters. A million stolen points of light scatter into the storm, unreadable forever.",
    },
    {
      scene: "storm", ground: "#1d1630",
      cast: [{ a: "mando", x: 560, anim: "crouch", jetpack: true, action: "carry" }, { a: "baby", x: 650, y: 460, mood: "happy", pram: false }],
      who: "The Mandalorian", text: "I've got you. I've got you. Let's get out of the rain.",
    },
    {
      scene: "space",
      cast: [{ a: "ship", kind: "gunship", x: 260, y: 300, scale: 1.3, vx: 52 }, { a: "planet", x: 1040, y: 420, r: 150, color: "#5a3a6e" }],
      who: "Narrator", text: "Gideon's plan is finished and the galaxy is safe. But out in the dark, new signals are already flickering to life.",
    },
    {
      scene: "space",
      cast: [{ a: "mando", x: 470, y: 520, anim: "sit", scale: 2.6 }, { a: "baby", x: 820, y: 400, mood: "happy", scale: 2.6 }],
      who: "The Mandalorian", text: "Pick a star, kid. Any star. We'll see what's there.",
    },
    { scene: "space", cast: [{ a: "ship", kind: "gunship", x: 520, y: 560, scale: 0.8, vx: 40 }], title: "MANDO'S QUEST", subtitle: "The journey continues..." },
  ],
  conclusion: "Moff Gideon is defeated, the Star Map Core is destroyed and Baby G is safe. The journey continues.",

  build(b) {
    // Storm platforms
    b.ground(0, 700, 1500);
    b.deco("banner", 420, 1500, { imperial: true, color: "#23262c" });
    b.deco("generator", 600, 1500, { color: "#d24cff" });
    b.foe("eliteTrooper", 480, 1500);
    b.move(740, 1480, 130, 250, 0, 4);
    b.block(1120, 1400, 120, 40);
    b.hazard("laser", 1300, 1140, 20, 440, { period: 2.6, duty: 0.4 });
    b.move(1390, 1420, 130, 0, -120, 3);
    b.foe("probe", 1200, 1200);

    b.ground(1700, 2700, 1400);
    b.checkpoint(1740, 1400);
    b.ledge(2000, 1270, 130);
    b.ledge(2300, 1270, 130);
    b.encounter("outerGuard", { x0: 1780, x1: 2640, floor: 1400, height: 480 }, [
      [["eliteTrooper", 1880, 1400], ["eliteTrooper", 2560, 1400]],
      [["darkTrooper", 2540, 1400], ["probe", 2100, 1150]],
    ]);
    b.deco("console", 2180, 1400, { color: "#d24cff" });

    // Towers
    b.block(2660, 0, 50, 1000);
    b.gate(2670, 1000, 1400, ["outerGuard"], { seal: 1000, energy: true, color: "#d24cff" });
    b.ledge(2720, 1720, 150);
    b.puck(2780, 1660);
    b.wind(2885, 1280, 90, 720, 560);
    b.block(2980, 1250, 120, 750);
    b.foe("turret", 3040, 1250);
    b.move(3180, 1180, 130, 200, 0, 3.6);
    b.block(3540, 1080, 130, 920);
    b.foe("hunterJet", 3350, 950);
    b.block(3300, 560, 140, 30);
    b.puck(3370, 500);

    // High bridge
    b.block(3800, 1000, 1100, 1500);
    b.checkpoint(3840, 1000);
    b.ledge(4100, 870, 130);
    b.ledge(4450, 870, 130);
    b.supplies(4510, 870);
    b.encounter("highBridge", { x0: 3890, x1: 4800, floor: 1000, height: 500 }, [
      [["guard", 4000, 1000], ["guard", 4700, 1000]],
      [["hunterElite", 4000, 1000], ["heavyDroid", 4680, 1000]],
      [["darkTrooper", 4700, 1000], ["repairDroid", 4400, 820]],
    ]);

    // Energy crossing
    b.block(4830, 0, 50, 700);
    b.gate(4840, 700, 1000, ["highBridge"], { seal: 700, energy: true, color: "#d24cff" });
    b.move(4940, 990, 130, 200, 0, 3.4);
    b.hazard("laser", 5300, 760, 20, 330, { period: 2.4, duty: 0.4 });
    b.fall(5340, 950, 120);
    b.move(5560, 1000, 120, 0, -120, 3);
    b.hazard("laser", 5760, 720, 20, 380, { period: 2.4, duty: 0.4, phase: 1.2 });
    b.foe("probe", 5450, 780);

    // Machinery hall
    b.ground(5850, 9500, 1000);
    b.room("citadel", 5900, 420, 1750, 580);
    b.block(5900, 360, 1750, 60);
    b.checkpoint(5950, 1000);
    b.say(5960, "Moff Gideon", "You're too late to stop the Core and too stubborn to run. I almost admire it.", [700, 1010]);
    b.hazard("steam", 6100, 840, 50, 160, { period: 2.8, duty: 0.4, fire: true });
    b.foe("combatMachine", 6420, 1000);
    b.block(6180, 800, 130, 30);
    b.node("conduitA", 6245, 800, { color: "#d24cff", hp: 170 });
    b.hazard("electric", 6520, 940, 90, 60, { period: 2.2, duty: 0.45 });
    b.foe("darkTrooper", 6700, 1000);
    b.node("conduitB", 6840, 1000, { big: true, color: "#d24cff", hp: 200 });
    b.deco("generator", 6360, 1000, { color: "#d24cff" });
    b.deco("tank", 6640, 1000, { light: "#d24cff" });
    b.block(6330, 640, 450, 28);
    b.block(6752, 420, 28, 220);
    b.boulder(6420, 640, 60, 220, [0, -240], { heavy: true });
    b.secret(6480, 420, 272, 220);
    b.puck(6640, 580);
    b.gate(6940, 420, 1000, ["conduitA", "conduitB"], { energy: true, color: "#d24cff" });

    b.checkpoint(7000, 1000);
    b.health(7060, 1000);
    b.ledge(7200, 870, 120);
    b.encounter("throneGuard", { x0: 7090, x1: 7590, floor: 1000, height: 480 }, [
      [["guard", 7170, 1000], ["guard", 7520, 1000]],
      [["darkTrooper", 7510, 1000], ["eliteTrooper", 7180, 1000]],
    ]);
    b.block(7616, 420, 34, 320);
    b.gate(7620, 740, 1000, ["throneGuard"], { color: "#d24cff" });

    // Throne room
    b.checkpoint(7700, 1000);
    b.health(7760, 1000);
    b.supplies(7810, 1000);
    b.ledge(8100, 865, 140);
    b.ledge(8340, 750, 120);
    b.ledge(8760, 750, 120);
    b.ledge(8990, 865, 140);
    b.arena("gideon", 7850, 9400, 1000, "throne");
  },
});
