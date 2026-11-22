/* Space mission 1, stage 4 of 13: a running escape over Nevarro, through eruptions and asteroids. */
MQ.defineSpaceLevel({
  mission: 1,
  tier: 1,
  title: "Escape from Nevarro",
  planet: "Nevarro Orbit",
  theme: "Volcanic skies, asteroid fields and an Imperial pursuit fleet",
  backdrop: "nevarroOrbit",
  accent: "#ff9a5c",
  boss: "Warden Gunship",
  bossKind: "warden",
  bossHint: "Hit the gunship's glowing reactor",
  par: 240,
  victory: "Nevarro Escaped",

  intro: [
    {
      scene: "nevarroOrbit",
      cast: [{ a: "ship", kind: "gunship", x: 260, y: 300, scale: 1.4, vx: 34 }, { a: "baby", x: 1050, y: 440, mood: "worried", scale: 2.4 }],
      who: "The Mandalorian", text: "That map had a tracker in it. They've known where we are since we lifted it. Hold on to something, kid.",
    },
    {
      scene: "nevarroOrbit",
      cast: [
        { a: "ship", kind: "transport", x: 900, y: 220, scale: 1.1, vx: -14 },
        { a: "ship", kind: "imperialFighter", x: 620, y: 390, scale: 1.6, vx: -30 },
        { a: "ship", kind: "imperialFighter", x: 1010, y: 450, scale: 1.2, vx: -24 },
      ],
      who: "Narrator", text: "An Imperial pursuit fleet rises through the smoke of Nevarro's volcanoes and launches its fighters.",
    },
    {
      scene: "nevarroOrbit",
      cast: [{ a: "ship", kind: "warden", x: 830, y: 290, scale: 1.1 }, { a: "gideon", x: 300, holo: true, action: "point" }],
      who: "Moff Gideon", text: "Follow the signal. Burn the ship if you must, but the child is not to reach open space.",
    },
  ],
  outro: [
    {
      scene: "nevarroOrbit",
      cast: [{ a: "ship", kind: "gunship", x: 280, y: 300, scale: 1.4, vx: 60 }, { a: "baby", x: 1080, y: 450, mood: "happy", scale: 2.4 }],
      who: "The Mandalorian", text: "Tracker's out the airlock. They can chase it all the way to the sun.",
    },
    {
      scene: "space",
      cast: [{ a: "planet", x: 960, y: 330, r: 190, color: "#8c4a32" }, { a: "ship", kind: "gunship", x: 220, y: 380, scale: 0.8, vx: 46 }],
      who: "Narrator", text: "Hidden in the debris, the gunship doubles back to the far side of Nevarro, where the research outpost waits in the wilds.",
    },
  ],
  conclusion: "The pursuit fleet is burning in orbit. With the tracker gone, you can slip back down to the Nevarro wilderness unseen.",

  script(b) {
    // Launch: open sky and simple formations.
    b.wait(1.5);
    b.hint("Move with WASD or the arrow keys. Hold J to fire, K launches rockets and Shift raises the shield.", "Steer with the stick. Hold Fire, tap Rockets, and tap Shield when it gets crowded.");
    b.wait(2.5);
    b.wave("fighter", "row", { n: 5, y: 260, capsule: true });
    b.wait(4);
    b.wave("fighter", "row", { n: 5, y: 480, capsule: true });
    b.wait(4);
    b.wave("drone", "column", { n: 4, y: 360 });
    b.wait(3);
    b.wave("interceptor", "diagonal", { n: 4, y: 230, capsule: true, vy: 70 });
    b.wait(4);
    b.wave("drone", "circle", { n: 6, y: 350, capsule: true });
    b.wait(5);
    b.wave("gunship", "retreat", { n: 1, y: 320, hold: 5 });
    b.wave("fighter", "vee", { n: 5, y: 380, capsule: true });
    b.wait(6);

    // The volcano line: eruptions climb out of the crust.
    b.say("The Mandalorian", "We're low over the lava fields. Watch for eruptions. They glow before they blow.");
    b.surface("bottom", 14, 52, { style: "crust", turrets: [0.3, 0.75] });
    b.wait(2);
    b.strike(620);
    b.wave("fighter", "row", { n: 4, y: 220, capsule: true });
    b.wait(3);
    b.strike(380, { reach: 360 });
    b.strike(930, { warn: 1.8 });
    b.wait(3.5);
    b.wave("bomber", "row", { n: 2, y: 190, gap: 1.2, amp: 25 });
    b.wait(3);
    b.strike(260, { reach: 250 });
    b.strike(720, { reach: 420, warn: 1.7 });
    b.wait(2.5);
    b.wave("interceptor", "dive", { n: 3, y: 300, capsule: true });
    b.wait(5);
    b.health(300);
    b.wait(1);

    // The asteroid field.
    b.banner("ASTEROID FIELD");
    b.speed(230);
    b.rocks(18, { every: 0.8, min: 22, max: 62 });
    b.wait(3);
    b.wave("drone", "swarm", { n: 6, y: 360, capsule: true });
    b.wait(6);
    b.wave("fighter", "diagonal", { n: 4, y: 420, capsule: true, vy: -60 });
    b.wait(5);
    b.wave("bomber", "row", { n: 2, y: 500, gap: 1.4, amp: 30, capsule: true });
    b.wait(6);
    b.speed(170);

    // Interceptors that circle round behind.
    b.say("The Mandalorian", "They're circling behind us. A rear gun would be nice about now.");
    b.wave("interceptor", "loop", { n: 2, y: 200 });
    b.wait(2.5);
    b.wave("fighter", "column", { n: 4, y: 360, capsule: true, move: "sine" });
    b.wait(5);

    // The mini-boss.
    b.elite("transport", "IMPERIAL TROOP TRANSPORT", { y: 330, hold: 24 });
    b.wait(1.5);
    b.capsule(300);
    b.health(420);
    b.wait(3);

    // The last push out of the atmosphere.
    b.speed(260);
    b.say("Moff Gideon", "He is breaking for orbit. All remaining squadrons, close on that gunship.");
    b.wave("fighter", "vee", { n: 7, y: 360, capsule: true });
    b.wait(4);
    b.wave("gunship", "retreat", { n: 2, y: 350, hold: 5 });
    b.wait(4);
    b.rocks(8, { every: 1.1, style: "ember" });
    b.wave("interceptor", "diagonal", { n: 5, y: 300, capsule: true, vy: 80 });
    b.wait(4);
    b.wave("drone", "circle", { n: 8, y: 350, amp: 130, capsule: true });
    b.wait(4);
    b.strike(500, { reach: 400 });
    b.wave("fighter", "row", { n: 6, y: 200, capsule: true });
    b.wait(5);
    b.health();
    b.wait(4);
    b.boss();
  },
});
