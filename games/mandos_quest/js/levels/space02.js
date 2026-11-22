/* Space mission 2, stage 8 of 13: a blockade of shielded structures, tight openings and storms. */
MQ.defineSpaceLevel({
  mission: 2,
  tier: 2,
  title: "Mandalore Orbit",
  planet: "Mandalore Orbit",
  theme: "Ruined stations, shield generators and planetary storms",
  backdrop: "mandaloreOrbit",
  accent: "#58d6c2",
  boss: "Orbital Bastion",
  bossKind: "bastion",
  bossHint: "Destroy the generators, then the core",
  par: 270,
  victory: "Blockade Broken",

  intro: [
    {
      scene: "mandaloreOrbit",
      cast: [{ a: "ship", kind: "gunship", x: 280, y: 300, scale: 1.4, vx: 30 }, { a: "baby", x: 1080, y: 450, scale: 2.4 }],
      who: "The Mandalorian", text: "The archive puts the sanctuary's only way in on the far side of Mandalore. The quickest road there is over the top.",
    },
    {
      scene: "mandaloreOrbit",
      cast: [{ a: "ship", kind: "bastion", x: 870, y: 290, scale: 0.9 }, { a: "ship", kind: "platform", x: 440, y: 400, scale: 1.1 }],
      who: "Narrator", text: "But Gideon's forces have strung a blockade through the wreckage of the old orbital stations, each piece feeding the next one's shield.",
    },
    {
      scene: "mandaloreOrbit",
      cast: [{ a: "gideon", x: 640, holo: true, action: "point" }],
      who: "Moff Gideon", text: "Mandalore has been a graveyard for years. One more wreck in its sky will go unnoticed.",
    },
  ],
  outro: [
    {
      scene: "mandaloreOrbit",
      cast: [{ a: "ship", kind: "bastion", x: 900, y: 300, scale: 0.8, smoke: true }, { a: "ship", kind: "gunship", x: 250, y: 330, scale: 1.1, vx: 55 }],
      who: "The Mandalorian", text: "There, a hole in the storms. That's our road down.",
    },
    {
      scene: "space",
      cast: [{ a: "planet", x: 700, y: 350, r: 230, color: "#2f6b5e" }, { a: "ship", kind: "gunship", x: 250, y: 220, scale: 0.6, vx: 40 }],
      who: "Narrator", text: "The gunship drops through the clouds toward an underground lake, and the living legend that sleeps beside it.",
    },
  ],
  conclusion: "The blockade is broken. A safe route opens through the storms to the sanctuary of the living Mythosaur.",

  script(b) {
    // The outer picket.
    b.wait(3);
    b.wave("interceptor", "row", { n: 6, y: 250, capsule: true });
    b.wait(4);
    b.wave("heavyFighter", "vee", { n: 3, y: 420, capsule: true });
    b.wait(4);
    b.wave("drone", "swarm", { n: 6, y: 300, capsule: true });
    b.wait(4);
    b.platform(330, { hold: 7 });
    b.wave("interceptor", "diagonal", { n: 4, y: 450, capsule: true, vy: -75 });
    b.wait(7);

    // Defenses fed by shield generators.
    b.say("The Mandalorian", "Those turrets are shielded. Take out the generators beside them.");
    b.surface("bottom", 12, 86, { style: "station", turrets: [0.2, 0.45, 0.8], generators: [0.1, 0.6] });
    b.wait(4);
    b.wave("heavyFighter", "row", { n: 3, y: 230, gap: 0.8, capsule: true });
    b.wait(4);
    b.surface("top", 9, 70, { style: "station", turrets: [0.3, 0.7], generators: [0.5] });
    b.wait(3);
    b.wave("drone", "circle", { n: 6, y: 380, amp: 100, capsule: true });
    b.wait(6);
    b.health(360);

    // Narrow openings through the old stations and the rocks.
    b.banner("NARROW PASSAGE");
    b.wait(2);
    b.opening(360, 260);
    b.wait(3.2);
    b.opening(260, 220, { style: "rock" });
    b.wait(1.2);
    b.capsule(260);
    b.wait(2);
    b.opening(470, 210);
    b.wait(3.2);
    b.opening(340, 190, { style: "rock", width: 170 });
    b.wait(3.6);
    b.opening(230, 200);
    b.wait(3);
    b.wave("interceptor", "column", { n: 3, y: 360, capsule: true });
    b.wait(3);

    // The derelicts, and the arms that still turn.
    b.say("The Mandalorian", "Those were our ships, once. Don't look too long, kid.");
    b.wreck(200, { width: 320 });
    b.wait(2);
    b.arm(420, { length: 130, spin: 1 });
    b.wait(3);
    b.wreck(540, { width: 260 });
    b.wave("missileDrone", "retreat", { n: 2, y: 300, hold: 5, capsule: true });
    b.wait(4);
    b.arm(250, { length: 115, spin: -1.2, angle: 0.4 });
    b.wait(2.5);
    b.arm(480, { length: 115, spin: 1.2, angle: 2 });
    b.wave("drone", "row", { n: 4, y: 360, amp: 120, capsule: true });
    b.wait(6);

    // The mini-boss.
    b.elite("platform", "SHIELD RELAY PLATFORM", { y: 355, hold: 28, generators: 3, hp: 650, stopX: 960 });
    b.wait(1.5);
    b.health(300);
    b.capsule(420);
    b.wait(3);

    // Storms reaching up from the planet.
    b.banner("ORBITAL STORM");
    b.speed(220);
    b.strike(420, { style: "lightning", fromTop: true, reach: 330, width: 100 });
    b.strike(840, { style: "lightning", reach: 300, width: 100, warn: 1.7 });
    b.wait(2);
    b.wave("bomber", "row", { n: 3, y: 200, gap: 1, amp: 30, capsule: true });
    b.wait(3);
    b.strike(260, { style: "lightning", reach: 380, width: 110 });
    b.strike(680, { style: "lightning", fromTop: true, reach: 280, width: 100, warn: 1.8 });
    b.wait(3);
    b.wave("interceptor", "loop", { n: 3, y: 200 });
    b.wave("missileDrone", "column", { n: 2, y: 400, step: 170, capsule: true });
    b.wait(4);
    b.rocks(9, { every: 0.75, min: 26, max: 72, style: "jade" });
    b.wait(4);
    b.strike(540, { style: "lightning", fromTop: true, reach: 400, width: 120, warn: 1.5 });
    b.wait(4);
    b.speed(180);
    b.health();

    // The inner ring of the blockade.
    b.surface("bottom", 12, 100, { style: "station", turrets: [0.25, 0.5, 0.75], generators: [0.4] });
    b.wait(2);
    b.wave("gunship", "retreat", { n: 2, y: 250, hold: 5 });
    b.wait(4);
    b.wave("heavyFighter", "dive", { n: 4, y: 300, capsule: true });
    b.wait(4);
    b.platform(260, { hold: 8, generators: 2 });
    b.wave("drone", "swarm", { n: 7, y: 380, capsule: true });
    b.wait(7);
    b.capsule();
    b.health(420);
    b.wait(4);
    b.boss();
  },
});
