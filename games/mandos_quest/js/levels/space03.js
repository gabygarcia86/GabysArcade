/* Space mission 3, stage 12 of 13: a fast assault along capital ships, through lasers and gates. */
MQ.defineSpaceLevel({
  mission: 3,
  tier: 3,
  title: "Assault on Gideon's Fleet",
  planet: "Imperial Fleet",
  theme: "Capital ships, laser barriers and Gideon's finest pilots",
  backdrop: "fleet",
  accent: "#d77bff",
  boss: "Gideon's Command Ship",
  bossKind: "command",
  bossHint: "Destroy the weapon systems, then the core",
  par: 300,
  victory: "Fleet Shattered",

  intro: [
    {
      scene: "fleet",
      cast: [{ a: "map", x: 900, y: 290 }, { a: "ship", kind: "gunship", x: 300, y: 320, scale: 1.2, vx: 20 }],
      who: "The Mandalorian", text: "The Core can't hide. It lights up every chart we have. It's with his fleet, and the fleet is guarding the citadel.",
    },
    {
      scene: "fleet",
      cast: [
        { a: "ship", kind: "capital", x: 820, y: 230, scale: 1 },
        { a: "ship", kind: "capital", x: 480, y: 410, scale: 0.6 },
        { a: "ship", kind: "eliteInterceptor", x: 1060, y: 420, scale: 1.4, vx: -26 },
      ],
      who: "Narrator", text: "Dozens of capital ships stand between one small gunship and the Star Map Citadel.",
    },
    {
      scene: "fleet",
      cast: [{ a: "ship", kind: "command", x: 900, y: 300, scale: 0.8 }, { a: "gideon", x: 300, holo: true, armed: "saber" }],
      who: "Moff Gideon", text: "One ship. He brings one ship against my fleet. Show the Mandalorian what that earns him.",
    },
  ],
  outro: [
    {
      scene: "fleet",
      cast: [{ a: "ship", kind: "command", x: 920, y: 280, scale: 0.7, smoke: true }, { a: "ship", kind: "gunship", x: 280, y: 360, scale: 1.1, vx: 70, smoke: true }],
      who: "The Mandalorian", text: "We're hit. Engines are gone. I can still glide her in... mostly.",
    },
    {
      scene: "storm", ground: "#1d1630",
      cast: [{ a: "ship", kind: "gunship", x: 930, y: 488, scale: 1.4, thrust: 0, smoke: true }, { a: "mando", x: 420, jetpack: true }, { a: "baby", x: 270, y: 410, mood: "worried" }],
      who: "Narrator", text: "The gunship skids to a stop on the storm cliffs. Above them rise the towers of Gideon's Star Map Citadel.",
    },
  ],
  conclusion: "Gideon's command fleet is shattered. One emergency landing later, the Star Map Citadel stands in front of you.",

  script(b) {
    // Straight into the screen.
    b.speed(230);
    b.wait(2.5);
    b.wave("eliteInterceptor", "diagonal", { n: 5, y: 240, capsule: true, vy: 90 });
    b.wait(3);
    b.wave("attackFighter", "vee", { n: 5, y: 400, capsule: true });
    b.wait(4);
    b.wave("missileDrone", "circle", { n: 4, y: 350, amp: 120, capsule: true });
    b.wait(4);
    b.wave("eliteInterceptor", "loop", { n: 2, y: 220 });
    b.wave("bomber", "row", { n: 3, y: 480, gap: 0.8, amp: 30, capsule: true });
    b.wait(6);

    // Along the hulls of the capital ships.
    b.banner("INTO THE FLEET");
    b.surface("bottom", 12, 92, { style: "hull", turrets: [0.15, 0.35, 0.6, 0.85] });
    b.wait(2);
    b.surface("top", 9, 66, { style: "hull", turrets: [0.25, 0.65] });
    b.wait(3);
    b.wave("defender", "retreat", { n: 1, y: 360, hold: 5 });
    b.wait(4);
    b.wave("attackFighter", "row", { n: 4, y: 340, amp: 90, capsule: true });
    b.wait(6);
    b.health();

    // Laser barriers, fixed and then moving.
    b.say("The Mandalorian", "Laser nets. The gaps move, so move with them.");
    b.wait(1);
    b.barrier(360, 250);
    b.wait(2.4);
    b.barrier(250, 220);
    b.wait(2.4);
    b.barrier(440, 220, { amp: 50 });
    b.wait(2.6);
    b.barrier(360, 210, { amp: 100, freq: 1.2 });
    b.wait(2.6);
    b.barrier(360, 200, { amp: 120, freq: 1.4 });
    b.capsule(360);
    b.wait(4);

    // Gates that only open from their emitters.
    b.say("The Mandalorian", "Solid beam ahead. Shoot out the emitter.");
    b.wait(1);
    b.gate(300);
    b.wait(4);
    b.wave("drone", "swarm", { n: 6, y: 300, capsule: true });
    b.gate(460, 85);
    b.wait(4);
    b.gate(220, 85);
    b.wave("missileDrone", "retreat", { n: 2, y: 400, hold: 4 });
    b.wait(6);

    // The mini-boss.
    b.elite("capital", "IMPERIAL PICKET CRUISER", { y: 355, hold: 30, stopX: 1030, amp: 90 });
    b.wait(1.5);
    b.health(300);
    b.capsule(420);
    b.wait(3);

    // The run through the debris, at full speed.
    b.banner("FULL THROTTLE");
    b.speed(340);
    b.rocks(13, { every: 0.65, min: 20, max: 60, style: "debris" });
    b.wait(2);
    b.wave("eliteInterceptor", "dive", { n: 4, y: 330, capsule: true });
    b.wait(4);
    b.opening(300, 230, { style: "hull", width: 220 });
    b.wait(3);
    b.opening(450, 210, { style: "hull", width: 220 });
    b.wait(2);
    b.wave("attackFighter", "diagonal", { n: 4, y: 260, capsule: true, vy: 85 });
    b.wait(5);
    b.speed(240);
    b.health();

    // Gideon's guard.
    b.say("Moff Gideon", "Enough. Send in my personal guard.");
    b.wave("eliteGunship", "retreat", { n: 2, y: 350, hold: 6 });
    b.wait(2);
    b.wave("eliteInterceptor", "loop", { n: 3, y: 200 });
    b.wait(3);
    b.barrier(330, 230, { amp: 80 });
    b.wait(3);
    b.wave("defender", "column", { n: 2, y: 360, step: 220, capsule: true });
    b.wait(3);
    b.wave("missileDrone", "swarm", { n: 4, y: 360, capsule: true });
    b.surface("bottom", 8, 80, { style: "hull", turrets: [0.3, 0.7] });
    b.wait(6);
    b.wave("attackFighter", "circle", { n: 6, y: 350, amp: 130, capsule: true });
    b.wait(6);
    b.capsule();
    b.health(420);
    b.wait(4);
    b.boss();
  },
});
