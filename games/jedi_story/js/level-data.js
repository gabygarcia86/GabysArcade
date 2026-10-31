/*
 * The campaign. Each entry has its story text and a build(b) function that lays the
 * level out, left to right, using the LevelBuilder chunks from levels.js.
 */
(function (J) {
  const level = (o) => ({ boss: null, ...o });

  J.OPENING_CRAWL = [
    "CHAPTER ONE",
    "THE PADAWAN",
    "",
    "The Jedi Order is scattered and in hiding.",
    "Across the galaxy, a cold silence is",
    "falling on the Force.",
    "",
    "Stormtroopers march beside droid armies",
    "long thought destroyed. Whispers tell of",
    "a hidden Sith world, and of a dark power",
    "gathering strength beyond the stars.",
    "",
    "In a forgotten outpost beneath the Jedi",
    "Temple, Master Orin Vael trains the last",
    "of the young Padawans, unaware that the",
    "Empire has finally found them....",
  ];

  J.LEVELS = [
    level({
      id: "temple", theme: "temple", music: "level1", name: "The Jedi Awakening", planet: "Jedi Temple, Coruscant", difficulty: 1,
      intro: "A routine training mission turns to fire. Imperial forces have found the Jedi outpost. Master Vael holds the gate so you can run. Fight your way out of the temple grounds.",
      build(b) {
        b.start().tip("Move with A / D or the Arrow keys. Press Space to jump.", "move");
        b.run(420, ["training"], { crystals: 5 }).tip("Press J to swing your lightsaber. Press it again to chain a combo.", "attack");
        b.pits([100, 120], 190).run(360, ["training", "training"]);
        b.checkpoint().tip("Force Push with K. It shoves enemies off ledges and hits switches.", "push");
        b.door();
        b.run(380, ["storm"], { crystals: 4 }).tip("Hold L to Deflect. Press it just as a bolt lands for a PERFECT return.", "deflect");
        b.stairs(3, 66, 150).secretHigh(205);
        b.run(460, ["storm", "scout"]);
        b.lasers(3, { spacing: 170 });
        b.checkpoint();
        b.secretRoom();
        b.floats([40, 90, 50], { gap: 112 });
        b.run(420, ["storm", "storm"], { crystals: 5 });
        b.arena(760, [["storm", "scout"], ["storm", "storm", "scout"]], { platforms: [[230, 86, 150], [420, 86, 150]] });
        b.checkpoint();
        b.movers(2, { span: 150, speed: 1.2 });
        b.lift(190, { speed: 0.9 });
        b.run(360, ["scout", "storm"], { crystals: 4 });
        b.secretLedge(190);
        b.run(300, ["storm"]);
        b.crateWall(150).run(340, ["scout", "training"]);
        b.bridge(320);
        b.run(380, ["storm", "scout", "storm"], { crystals: 5 });
        b.exit();
      },
    }),
    level({
      id: "kashyyyk", theme: "kashyyyk", music: "level2", name: "The Forest of Secrets", planet: "Kashyyyk", difficulty: 2, boss: "maul",
      intro: "Wookiee scouts report Sith activity deep in the wroshyr forests. Droid armies long thought destroyed are marching beside stormtroopers. Find out who is commanding them.",
      build(b) {
        b.start();
        b.run(420, ["b1", "b1"], { crystals: 5 });
        b.spikeRun(2);
        b.floats([50, 86, 40], { gap: 118 });
        b.run(400, ["b1", "storm"], { crystals: 3 }).secretHigh(205, -180);
        b.checkpoint();
        b.tower(340, { enemies: { 2: "b1", 3: "b1" } });
        b.run(320, ["probe"], { crystals: 3 });
        b.crumble(4, { gap: 100 });
        b.run(360, ["b2"]);
        b.fallers(3, { height: 280, w: 44, len: 40 });
        b.checkpoint();
        b.secretRoom();
        b.arena(800, [["b1", "b1", "b1"], ["storm", "b2"], ["probe", "b1", "b1"]], { platforms: [[150, 86, 150], [510, 86, 150]] });
        b.movers(3, { span: 150, speed: 1.3 });
        b.run(320, ["storm", "probe"], { crystals: 4 });
        b.door({ high: 80 });
        b.down(2, 80, 170);
        b.spikeRun(2, { spacing: 220 });
        b.run(380, ["b2", "storm"], { crystals: 4 });
        b.secretLedge(190);
        b.checkpoint();
        b.run(260, null);
        b.bossArena("maul", { platforms: [[120, 96, 170], [670, 96, 170]] });
      },
    }),
    level({
      id: "tatooine", theme: "tatooine", music: "level3", name: "The Desert Trial", planet: "Tatooine", difficulty: 3,
      intro: "Maul's last words point to Tatooine, and to an ancient clue buried beneath the sands. Imperial patrols are already searching the ruins. Reach them first.",
      build(b) {
        b.start().tip("New power! Press Jump again in midair to double jump.", "jump");
        b.run(420, ["sand", "b1"], { crystals: 5 });
        b.pits([170, 190, 210], 160);
        b.run(380, ["sand", "probe"], { crystals: 3 });
        b.vents(3, { jet: "#e6c48a", height: 170 });
        b.checkpoint();
        b.stairs(2, 110, 180).secretHigh(250, -100);
        b.run(420, ["sand", "security"]);
        b.crumble(5, { gap: 130, w: 100 });
        b.run(340, ["b1", "b1", "sand"], { crystals: 4 });
        b.secretRoom();
        b.checkpoint();
        b.movers(3, { span: 170, speed: 1.1 });
        b.arena(820, [["sand", "sand"], ["security", "b1", "b1"], ["probe", "security", "sand"]], { platforms: [[120, 100, 160], [540, 100, 160]] });
        b.down(2, 90, 170);
        b.spikeRun(3, { w: 120, spacing: 250 });
        b.floats([90, 150, 80, 130], { gap: 150, w: 110 });
        b.checkpoint();
        b.run(320, ["security"], { crystals: 3 });
        b.bridge(380);
        b.vents(4, { jet: "#e6c48a", height: 200, spacing: 170, period: 2.2 });
        b.run(360, ["sand", "security", "sand"], { crystals: 5 });
        b.secretLedge(220);
        b.tower(360, { enemies: { 1: "b1", 3: "sand" } });
        b.run(380, ["probe", "sand"], { crystals: 4 });
        b.exit();
      },
    }),
    level({
      id: "mustafar", theme: "mustafar", music: "level4", name: "The Fallen Temple", planet: "Mustafar", difficulty: 4, boss: "dooku",
      intro: "The clue names a Sith temple on Mustafar, abandoned to the lava. It holds secrets about the dark side that someone wants badly. It is heavily guarded, and the ground itself wants you dead.",
      build(b) {
        b.start().tip("Your Force Push is stronger now, and it costs less energy.", "push");
        b.run(400, ["storm", "security"], { crystals: 4 });
        b.floats([50, 110, 60], { gap: 150, w: 110 });
        b.run(360, ["sithguard"]).tip("Guards block from the front. Force Push breaks their stance.", "push");
        b.vents(3, { jet: "#ff8a2a", height: 210, period: 2.4 });
        b.checkpoint();
        b.crumble(5, { gap: 140, w: 96 });
        b.run(360, ["security", "advanced"], { crystals: 4 });
        b.stairs(2, 110, 170).secretHigh(250, -90);
        b.run(320, ["sithguard", "storm"]);
        b.movers(3, { span: 180, speed: 1.4, w: 110 });
        b.checkpoint();
        b.secretRoom();
        b.arena(840, [["storm", "storm", "advanced"], ["sithguard", "security"], ["sithguard", "advanced", "advanced"]], { platforms: [[140, 100, 150], [550, 100, 150]] });
        b.down(3, 80, 150);
        b.lasers(4, { spacing: 150, period: 2 });
        b.secretLedge(200);
        b.run(340, ["advanced", "storm"], { crystals: 4 });
        b.tower(420, { enemies: { 2: "advanced", 4: "security" } });
        b.checkpoint();
        b.door({ high: 100 });
        b.vents(4, { jet: "#ff8a2a", height: 230, spacing: 170, period: 2.1 });
        b.run(380, ["sithguard", "sithguard"], { crystals: 5 });
        b.checkpoint();
        b.run(240, null);
        b.bossArena("dooku", { platforms: [[380, 100, 200]] });
      },
    }),
    level({
      id: "hoth", theme: "hoth", music: "level5", name: "The Frozen Frontier", planet: "Hoth", difficulty: 5,
      intro: "Dooku spoke of an Imperial research station buried under the ice of Hoth. Survive the cold, watch your footing on the ice, and find out what the Empire is building down there.",
      build(b) {
        b.start().tip("The ice is slick, so give yourself room to stop. Your deflection timing is sharper now too.", "move");
        b.run(460, ["snow", "probe"], { crystals: 5 });
        b.fallers(3, { height: 260, spacing: 180 });
        b.pits([170, 200], 180, [["snow"]]);
        b.checkpoint();
        b.floats([60, 120, 70, 130], { gap: 150, w: 120 });
        b.run(380, ["snow", "security"], { crystals: 4 }).secretHigh(250, -150);
        b.tower(340, { enemies: { 2: "snow", 3: "probe" } });
        b.fallers(4, { height: 240, spacing: 150 });
        b.checkpoint();
        b.secretRoom();
        b.arena(860, [["snow", "snow", "probe"], ["heavy", "snow"], ["heavy", "security", "probe"]], { platforms: [[150, 100, 160], [550, 100, 160]] });
        b.crumble(5, { gap: 130, w: 100 });
        b.run(360, ["heavy"], { crystals: 3 });
        b.lasers(4, { spacing: 150, period: 2.1 });
        b.checkpoint();
        b.movers(3, { axis: "y", span: 150, speed: 1.2, height: 0 });
        b.run(340, ["snow", "security"], { crystals: 4 });
        b.secretLedge(220);
        b.crateWall(230);
        b.run(380, ["heavy", "snow"], { crystals: 4 });
        b.door({ high: 110 });
        b.fallers(3, { height: 260 });
        b.down(2, 100, 170);
        b.run(420, ["security", "heavy", "snow"], { crystals: 5 });
        b.exit();
      },
    }),
    level({
      id: "narshaddaa", theme: "narshaddaa", music: "level6", name: "The Shadow City", planet: "Nar Shaddaa", difficulty: 6, boss: "ventress",
      intro: "The Hoth data was wiped, but it names a buyer: a Sith informant hiding on the Smuggler's Moon. Mercenaries, bounty hunters and Imperials all want this rooftop. Move fast.",
      build(b) {
        b.start().tip("Attack in midair now to spin and hang in the air. Chain it three times.", "attack");
        b.run(420, ["merc", "imperial"], { crystals: 5 });
        b.pits([180, 200, 220], 150, [["merc"], null, ["imperial"]]);
        b.movers(3, { span: 200, speed: 1.6, w: 110 });
        b.run(340, ["security", "merc"]);
        b.checkpoint();
        b.arcs(3, { height: 38, spacing: 220 });
        b.stairs(3, 100, 150).secretHigh(250, -60);
        b.run(360, ["assassin"], { crystals: 3 }).tip("Assassin droids blink around you. Keep moving.", "move");
        b.floats([80, 150, 90, 160], { gap: 160, w: 100 });
        b.checkpoint();
        b.secretRoom();
        b.vents(4, { jet: "#7fffe0", height: 200, spacing: 170, period: 2.1 });
        b.arena(880, [["merc", "merc", "imperial"], ["assassin", "security"], ["assassin", "merc", "imperial"]], { platforms: [[130, 104, 150], [590, 104, 150], [360, 170, 150]] });
        b.lift(280);
        b.run(340, ["imperial", "merc"], { crystals: 4 });
        b.crumble(5, { gap: 150, w: 92 });
        b.checkpoint();
        b.arcs(4, { height: 38, spacing: 190, period: 2 });
        b.secretLedge(220);
        b.tower(380, { enemies: { 2: "merc", 3: "imperial" } });
        b.run(400, ["assassin", "merc", "security"], { crystals: 5 });
        b.bridge(400);
        b.checkpoint();
        b.run(240, null);
        b.bossArena("ventress", { platforms: [[140, 104, 170], [650, 104, 170], [395, 196, 170]], perches: [[225, 104], [735, 104], [480, 196]] });
      },
    }),
    level({
      id: "endor", theme: "endor", music: "level7", name: "The Imperial Stronghold", planet: "Forest Moon of Endor", difficulty: 7,
      intro: "Ventress's data leads to Endor. A shield bunker hidden in the forest protects something enormous in orbit. Slip through the trees, break into the installation, and bring that shield down.",
      build(b) {
        b.start().tip("Your Force meter is larger now, and refills faster.", "push");
        b.run(460, ["scout", "scout"], { crystals: 5 });
        b.floats([70, 130, 90], { gap: 160, w: 110 });
        b.run(360, ["storm", "scout", "probe"], { crystals: 3 });
        b.fallers(3, { height: 280, w: 44, len: 40 });
        b.checkpoint();
        b.tower(380, { enemies: { 2: "scout", 3: "storm" } });
        b.movers(3, { span: 200, speed: 1.5, w: 110 });
        b.run(380, ["heavy", "scout"], { crystals: 4 }).secretHigh(250, -180);
        b.secretRoom();
        b.checkpoint();
        b.arena(880, [["storm", "scout", "scout"], ["heavy", "darktrooper"], ["darktrooper", "storm", "storm"]], { platforms: [[140, 104, 160], [580, 104, 160]] });
        b.lasers(4, { spacing: 140, period: 1.9 });
        b.door({ high: 110 });
        b.crushers(3, { period: 3.1 });
        b.checkpoint();
        b.run(360, ["darktrooper"], { crystals: 3 });
        b.arcs(4, { height: 38, spacing: 190 });
        b.secretLedge(220);
        b.crumble(5, { gap: 150, w: 96 });
        b.stairs(3, 100, 150);
        b.run(420, ["heavy", "storm", "darktrooper"], { crystals: 5 });
        b.bridge(420);
        b.crushers(4, { period: 2.7, spacing: 210 });
        b.run(380, ["scout", "darktrooper"], { crystals: 4 });
        b.exit();
      },
    }),
    level({
      id: "deathstar", theme: "deathstar", music: "level8", name: "The Dark Side Rises", planet: "Death Star II", difficulty: 8, boss: "vader",
      intro: "The shield is down. You stow away on a shuttle bound for the battle station. The Empire's final preparations are under way, and at the heart of the station something cold is waiting for you.",
      build(b) {
        b.start().tip("Your combo now ends in a whirling fourth strike.", "attack");
        b.run(440, ["storm", "storm"], { crystals: 5 });
        b.lasers(4, { spacing: 150, period: 1.9 });
        b.movers(3, { span: 210, speed: 1.6, w: 110 });
        b.run(380, ["security", "darktrooper"], { crystals: 3 }).secretHigh(250, -120);
        b.checkpoint();
        b.crushers(4, { period: 2.8 });
        b.lift(320);
        b.run(360, ["royal"], { crystals: 3 }).tip("Royal Guards won't let a saber through. Break their guard with Force Push.", "push");
        b.floats([90, 160, 90, 170], { gap: 165, w: 100 });
        b.checkpoint();
        b.secretRoom();
        b.arena(900, [["storm", "storm", "security"], ["royal", "royal"], ["darktrooper", "royal", "security"]], { platforms: [[140, 104, 160], [600, 104, 160]] });
        b.arcs(4, { height: 38, spacing: 180, period: 1.9 });
        b.door({ high: 110 });
        b.down(3, 90, 150);
        b.secretLedge(220);
        b.run(360, ["royal", "storm"], { crystals: 4 });
        b.tower(420, { enemies: { 2: "storm", 3: "security", 4: "darktrooper" } });
        b.checkpoint();
        b.crushers(3, { period: 2.5, spacing: 210 });
        b.bridge(440);
        b.lasers(5, { spacing: 130, period: 1.8, onTime: 0.9 });
        b.run(420, ["darktrooper", "royal", "royal"], { crystals: 5 });
        b.checkpoint();
        b.run(260, null);
        b.bossArena("vader");
      },
    }),
    level({
      id: "exegol", theme: "exegol", music: "level9", name: "The Ancient Sith World", planet: "Exegol", difficulty: 9,
      intro: "Exegol: a dead world under an endless storm. The Sith fleet sleeps in its sky, and something ancient has been calling your name since Coruscant. Reach the citadel. Do not listen to the voices.",
      build(b) {
        b.start().tip("Force Push now shatters guards and stuns everything it touches.", "push");
        b.run(440, ["sithtrooper", "cultist"], { crystals: 5 });
        b.arcs(4, { height: 38, spacing: 190, period: 1.9 });
        b.floats([90, 170, 100, 180], { gap: 170, w: 96 });
        b.run(380, ["advanced", "sithtrooper"], { crystals: 3 }).secretHigh(255, -160);
        b.checkpoint();
        b.crumble(6, { gap: 160, w: 90 });
        b.run(340, ["elite", "cultist"], { crystals: 3 });
        b.tower(440, { enemies: { 2: "cultist", 3: "sithtrooper", 4: "advanced" } });
        b.spikeRun(3, { w: 130, spacing: 260 });
        b.checkpoint();
        b.secretRoom();
        b.vision();
        b.movers(3, { axis: "y", span: 170, speed: 1.5, w: 100 });
        b.arena(900, [["sithtrooper", "sithtrooper", "cultist"], ["elite", "advanced"], ["elite", "elite", "cultist"]], { platforms: [[140, 106, 160], [600, 106, 160]] });
        b.checkpoint();
        b.arcs(5, { height: 38, spacing: 170, period: 1.8 });
        b.secretLedge(220);
        b.run(380, ["sithtrooper", "elite"], { crystals: 4 });
        b.movers(4, { span: 210, speed: 1.8, w: 100 });
        b.stairs(3, 100, 150);
        b.bridge(440);
        b.run(420, ["elite", "cultist", "advanced"], { crystals: 5 });
        b.exit();
      },
    }),
    level({
      id: "throne", theme: "throne", music: "level10", name: "The Final Confrontation", planet: "Emperor's Throne Room, Exegol", difficulty: 10, boss: "palpatine",
      intro: "The citadel doors stand open. He wants you to come. Every world, every battle, every choice has led to this room. The fate of the galaxy rests on your blade.",
      build(b) {
        b.start().tip("Every power is yours now. Trust the Force.", "attack");
        b.run(420, ["sithtrooper", "advanced"], { crystals: 5 });
        b.lasers(4, { spacing: 150, period: 1.8 });
        b.floats([90, 170, 90], { gap: 170, w: 100 });
        b.run(360, ["elite"], { crystals: 3 }).secretHigh(255, -120);
        b.checkpoint();
        b.arcs(4, { height: 38, spacing: 180, period: 1.8 });
        b.crushers(3, { period: 2.6, spacing: 210 });
        b.secretRoom();
        b.arena(900, [["sithtrooper", "sithtrooper", "advanced"], ["elite", "elite"], ["elite", "advanced", "advanced", "sithtrooper"]], { platforms: [[140, 106, 160], [600, 106, 160]] });
        b.checkpoint();
        b.movers(4, { span: 210, speed: 1.9, w: 100 });
        b.secretLedge(220);
        b.run(380, ["elite", "sithtrooper"], { crystals: 4 });
        b.tower(440, { enemies: { 2: "advanced", 3: "sithtrooper", 4: "elite" } });
        b.door({ high: 110 });
        b.lasers(5, { spacing: 130, period: 1.7, onTime: 0.85 });
        b.run(400, ["elite", "elite", "advanced"], { crystals: 5 });
        b.checkpoint();
        b.run(260, null);
        b.bossArena("palpatine", { spots: [170, 480, 790] });
      },
    }),
  ];

  // A scripted stop mid-level: the vision that opens onto the Dark Reflection fight.
  J.LevelBuilder.prototype.vision = function vision() {
    const startX = this.x;
    this.ground(760);
    const y = this.y;
    const left = this.solid({ x: startX - 12, y: y - 520, w: 12, h: 520, kind: "barrier", active: false });
    const right = this.solid({ x: this.x - 12, y: y - 520, w: 12, h: 520, kind: "barrier", active: false });
    this.level.barriers.push(left, right);
    this.level.triggers.push({ x: startX + 120, type: "vision", walls: [left, right], x0: startX + 560, y, fired: false });
    return this;
  };

  J.VISION_LINES = [
    ["palpatine", "A voice in the storm", "Why do you fight for an Order that hid from you? That left you alone?"],
    ["shadow", "Your own voice", "Everyone you failed is out there. Everyone you could have saved, if you had only taken the power."],
    ["player", null, "You're not me."],
    ["shadow", "Your own voice", "I'm the part of you that wants to win."],
  ];

  J.VISION_END = [
    ["mentor", "Master Orin Vael", "Fear is a shadow, nothing more. You have walked through yours. Now go. The citadel is close."],
  ];

  J.ENDING_SHOTS = [
    { scene: "exegolDawn", text: "The citadel fell silent. For the first time in an age, the storm over Exegol broke, and starlight touched the ground." },
    { scene: "fleet", text: "Across the galaxy the droid armies stopped mid-stride. Imperial fleets lost their voice. Worlds that had forgotten the sky looked up." },
    { scene: "planets", text: "Kashyyyk's forests began to grow back. On Tatooine, Coruscant and Hoth, people came out of hiding and started to rebuild." },
    { scene: "temple", text: "And in the ruins of the Jedi Temple, a Knight lit one lightsaber, and the first new Padawans gathered to learn." },
  ];
})(window.JEDI);
