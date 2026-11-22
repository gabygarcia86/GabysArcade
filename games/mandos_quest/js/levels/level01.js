/* Level 1: desert dunes, a cave and a two-floor research facility. */
MQ.defineLevel({
  id: 1,
  title: "The Hidden Child",
  planet: "Arvala-7",
  theme: "Desert wasteland and an abandoned research facility",
  scene: "arvala",
  material: "sand",
  width: 8000,
  height: 1000,
  start: [140, 800],
  par: 240,
  objectives: [
    { text: "Infiltrate the research facility", done: "facility" },
    { text: "Destroy both containment locks", done: "cellOpen" },
    { text: "Escape to your gunship" },
  ],

  intro: [
    {
      scene: "space", cast: [{ a: "ship", kind: "gunship", x: 300, y: 330, scale: 1.5, vx: 38 }],
      who: "Narrator", text: "An unmarked bounty crosses the Outer Rim. No name and no face. Only a fee large enough to keep people from asking questions.",
    },
    {
      scene: "arvala", ground: "#6f4030",
      cast: [{ a: "mando", x: 360, anim: "idle", weapon: "blaster" }, { a: "ship", kind: "gunship", x: 1040, y: 478, scale: 1.4, thrust: 0 }],
      who: "The Mandalorian", text: "The fob points to an Imperial research station on Arvala-7. The asset is listed as dangerous. They usually are.",
    },
    {
      scene: "hangarBay", ground: "#2b323b",
      cast: [{ a: "cell", x: 640 }, { a: "enemy", art: "security", x: 360 }, { a: "enemy", art: "hunter", x: 930, flip: true }],
      who: "Narrator", text: "Behind droid sentries and hired guns, something very small waits inside a containment field.",
    },
  ],
  outro: [
    {
      scene: "arvala", ground: "#6f4030",
      cast: [{ a: "mando", x: 440, anim: "run", weapon: "blaster" }, { a: "baby", x: 290, y: 420, mood: "happy" }, { a: "ship", kind: "gunship", x: 1030, y: 478, scale: 1.4, thrust: 0.3 }],
      who: "The Mandalorian", text: "Whoever paid for you can keep their credits. You're coming with me.",
    },
    {
      scene: "space",
      cast: [{ a: "ship", kind: "gunship", x: 380, y: 320, scale: 1.3, vx: 46 }, { a: "baby", x: 1080, y: 440, mood: "idle", scale: 2.4 }],
      who: "Narrator", text: "The child reaches out a tiny hand, and a loose bolt floats across the cockpit. Some things are worth more than a bounty.",
    },
  ],
  conclusion: "You walked away from the bounty and became Baby G's protector. Somewhere, a very powerful client has just noticed.",

  build(b) {
    // Dunes
    b.ground(0, 900, 800);
    b.block(620, 730, 90, 70, "canyon");
    b.hill([[900, 800], [1080, 730], [1260, 760], [1420, 700]]);
    b.ground(1420, 1700, 700);
    b.ground(1860, 2700, 700);
    b.deco("rock", 320, 800);
    b.deco("bush", 480, 800);
    b.deco("bones", 820, 800);
    b.deco("wreck", 1540, 700);
    b.deco("bush", 1980, 700);
    b.deco("antenna", 2180, 700);

    b.hint(90, "Use A and D, or the arrow keys, to move.", { touch: "Use the arrows on the left to move.", first: true });
    b.hint(440, "Press Space to jump. Hold it to jump higher.", { touch: "Tap Jump, or hold it to jump higher.", first: true });
    b.hint(1500, "Jump the gap. Press Shift, or double-tap a direction, to dodge through danger.", { touch: "Jump the gap. Double-tap an arrow to dodge through danger.", first: true });
    b.hint(1900, "Press J to fire. Hold it for continuous fire.", { touch: "Tap or hold Fire to shoot.", first: true });
    b.say(1300, "The Mandalorian", "Fresh tracks. Droids, and at least one mercenary crew.");

    b.foe("skitter", 1560, 700);
    b.foe("securityDroid", 2160, 700);
    b.foe("hunter", 2560, 700);
    b.crate(2060, 700, { drop: "health" });

    // A climb over the top of the cave
    b.ledge(2360, 590, 110);
    b.ledge(2480, 480, 100);
    b.ledge(2350, 370, 110);
    b.ledge(2480, 270, 100);

    // Cave, with an alcove in its roof
    b.material("cave");
    b.hill([[2700, 700], [2900, 820]]);
    b.ground(2900, 3500, 820);
    b.ground(3660, 4020, 820);
    b.room("cave", 2620, 300, 1360, 700);
    b.block(2600, 200, 500, 320);
    b.block(3100, 200, 300, 100);
    b.block(3400, 200, 600, 320);
    b.ledge(3150, 700, 100);
    b.ledge(3270, 585, 100);
    b.ledge(3110, 470, 280);
    b.secret(3102, 300, 296, 172);
    b.puck(3180, 420);
    b.puck(3800, 150);
    b.deco("crystal", 2970, 820, { color: "#e0a43a", scale: 0.7 });
    b.deco("crystal", 3930, 820, { color: "#e0a43a", scale: 0.8 });
    b.deco("lamp", 3420, 820);
    b.foe("crawler", 3050, 820);
    b.foe("spider", 3450, 558);
    b.foe("crawler", 3880, 820);
    b.health(3960, 820);

    // Approach
    b.material("sand");
    b.ground(4020, 4700, 820);
    b.checkpoint(4120, 820);
    b.deco("rock", 4260, 820);
    b.deco("antenna", 4560, 820);
    b.foe("securityDroid", 4380, 820);
    b.foe("hunterMelee", 4600, 820);

    // Facility
    b.material("facility");
    b.ground(4700, 6700, 760);
    b.room("facility", 4760, 200, 1940, 560);
    b.block(4760, 140, 1940, 60);
    b.block(4760, 200, 40, 400);
    b.block(4800, 520, 900, 30);
    b.block(6090, 200, 44, 360);
    b.ledge(5720, 650, 110);
    b.ledge(5840, 560, 130);
    b.reach("facility", 4860, 600, 100, 160);
    b.checkpoint(4920, 760);
    b.say(4960, "The Mandalorian", "The asset is upstairs. There's a containment lock on each floor.", [560, 780]);
    b.foe("stormtrooper", 5300, 760);
    b.foe("securityDroid", 5800, 760);
    b.foe("hunter", 5480, 520);
    b.foe("securityDroid", 5640, 520, { range: 40 });
    b.hazard("laser", 5180, 600, 20, 160, { period: 3, duty: 0.45 });
    b.node("lockLower", 5530, 760);
    b.node("lockUpper", 5340, 520);
    b.containment("cellOpen", 5130, 520, ["lockLower", "lockUpper"]);
    b.wall(4990, 520, 26, 320);
    b.secret(4802, 200, 188, 318);
    b.puck(4890, 470);
    b.deco("console", 5240, 520);
    b.deco("tank", 5380, 760);
    b.deco("cargo", 5940, 760);
    b.deco("console", 5060, 760, { color: "#e0a43a" });
    b.crate(5600, 760, { drop: "health" });
    b.gate(6100, 560, 760, ["cellOpen"], { w: 24 });

    // Escape
    b.checkpoint(6200, 760);
    b.say(6260, "Imperial Radio", "All units, the asset is loose! Do not let that Mandalorian reach the landing pad.");
    b.foe("stormtrooper", 6420, 760);
    b.foe("stormtrooper", 6600, 760);
    b.deco("cargo", 6500, 760);
    b.deco("banner", 6340, 760, { imperial: true, color: "#23262c", h: 190 });

    b.material("sand");
    b.ledge(6790, 700, 90, "facility");
    b.ground(6960, 8000, 760);
    b.foe("securityDroid", 7120, 760);
    b.foe("hunter", 7360, 760);
    b.crate(7240, 760, { barrel: true });
    b.deco("bush", 7480, 760);
    b.deco("gunship", 7790, 760);
    b.exit(7750, 760);
  },
});
