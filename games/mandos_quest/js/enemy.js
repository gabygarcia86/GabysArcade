/*
 * Regular enemies. Each type has its own brain. Attacks are shared building blocks with
 * a visible wind-up, so every hit can be seen coming.
 */
(function (MQ) {
  const { clamp, approach, damp, rand, glow, line, oval, text } = MQ.U;
  const { abs, sign, sin, cos, atan2, hypot, max, min } = Math;
  const GRAVITY = MQ.DATA.PHYSICS.gravity;
  const ENEMY = 1;
  const ACTIVE_RANGE = 1300;
  const SIGHT = 600;
  const RED = "#ff5348";

  /* ---------- Attacks ---------- */

  // wind: warning time, time: active time, rest: opening afterwards.
  const ATTACKS = {
    shot: { wind: 0.5, time: 0.15, rest: 0.5, begin: (e) => e.shoot() },
    lowShot: { wind: 0.5, time: 0.15, rest: 0.5, begin: (e) => e.shootFlat(-38) },
    burst: { wind: 0.5, time: 0.4, rest: 0.6, tick: (e, dt) => e.repeat(dt, 0.18, 3, () => e.shoot(0.05)) },
    volley: { wind: 0.65, time: 0.5, rest: 0.8, tick: (e, dt) => e.repeat(dt, 0.22, 3, () => e.shootFlat(-52)) },
    barrage: {
      wind: 0.85, time: 0.8, rest: 1.1,
      tick: (e, dt) => e.repeat(dt, 0.14, 6, (i) => e.shoot((i - 2.5) * 0.07, { exact: true })),
    },
    snipe: {
      wind: 1.15, time: 0.2, rest: 1,
      aim(e) {
        // The laser sight stops tracking just before the shot.
        if (e.stateTime < 0.8) e.trackPlayer();
      },
      begin: (e) => e.shootAt(e.lockX, e.lockY, { speed: 1100, damage: e.damage * 1.7, big: true }),
    },
    fan: {
      wind: 0.6, time: 0.2, rest: 0.7,
      begin(e) {
        for (const spread of [-0.22, 0, 0.22]) e.shoot(spread, { exact: true, color: "#d77bff" });
      },
    },
    chargedShot: { wind: 0.9, time: 0.2, rest: 0.8, begin: (e) => e.shoot(0, { exact: true, speed: 760, damage: e.damage * 1.6, color: "#d77bff", big: true }) },
    twin: {
      wind: 0.8, time: 1, rest: 1.6,
      tick: (e, dt) => e.repeat(dt, 0.33, 3, (i) => e.shootFlat(i % 2 ? -58 : -30, "#ff8a3d")),
    },
    cannon: { wind: 0.75, time: 0.7, rest: 1, tick: (e, dt) => e.repeat(dt, 0.16, 4, () => e.shoot(0.04, { speed: 560 })) },
    ion: { wind: 0.6, time: 0.1, rest: 1, begin: (e) => e.shoot(0, { kind: "ion", color: "#66d9ff", speed: 400 }) },
    web: { wind: 0.6, time: 0.1, rest: 1.2, begin: (e) => e.lob("web", "#d8f5e4", 7) },
    throwRock: { wind: 0.65, time: 0.15, rest: 0.8, begin: (e) => e.lob("rock", "#9c8468", 10) },
    grenade: { wind: 0.75, time: 0.15, rest: 1.1, begin: (e) => e.lob("grenade", "#ff5348", 9, 95) },

    strike: { wind: 0.42, time: 0.18, rest: 0.65, melee: 78, begin: (e) => { e.vx = e.facing * 200; e.sfx("enemyMelee"); } },
    combo: {
      wind: 0.5, time: 0.62, rest: 0.9, melee: 100, swings: 2,
      tick(e, dt) {
        e.repeat(dt, 0.34, 2, () => {
          e.vx = e.facing * 310;
          e.hasHit = false;
          e.sfx("enemyMelee");
        });
      },
    },
    dash: {
      wind: 0.55, time: 0.42, rest: 0.75, melee: 60, offEdges: false,
      begin: (e) => e.sfx("enemyMelee"),
      tick: (e) => { e.vx = e.facing * 680; },
    },
    charge: {
      wind: 0.8, time: 0.95, rest: 1.3, body: true, offEdges: false,
      begin: (e) => e.sfx("creature"),
      tick(e) {
        e.vx = e.facing * e.def.charge;
        if (!e.wall) return;
        e.stun = 1.5;
        e.state = "move";
        e.world.camera.shake(0.2);
        e.world.particles.chunks(e.x + e.facing * 30, e.y - 30, "#6b625b", 8);
      },
    },
    pounce: {
      wind: 0.6, time: 1.1, rest: 0.8, body: true,
      begin(e) {
        e.vy = -540;
        e.vx = clamp(e.dx / 0.52, -600, 600);
        e.grounded = false;
        e.sfx("creature");
      },
      tick(e) {
        if (e.grounded && e.stateTime > 0.15) e.finishAttack();
      },
    },
    hopPeck: {
      wind: 0.35, time: 0.8, rest: 0.4, body: true,
      begin(e) {
        e.vy = -430;
        e.vx = clamp(e.dx / 0.42, -420, 420);
        e.grounded = false;
      },
      tick(e) {
        if (e.grounded && e.stateTime > 0.15) e.finishAttack();
      },
    },
    rocketSlam: {
      wind: 0.85, time: 1.6, rest: 1.2, body: true, marker: true,
      aim(e) {
        if (e.stateTime >= 0.5) return;
        e.lockX = e.world.player.x;
        e.lockY = e.world.col.floorBelow(e.lockX, e.world.player.y - 20, 600);
      },
      begin(e) {
        e.vy = -760;
        e.vx = clamp((e.lockX - e.x) / 0.72, -700, 700);
        e.grounded = false;
        e.thrust = 1;
        e.sfx("jetStart");
      },
      tick(e) {
        if (!e.grounded || e.stateTime < 0.2) return;
        e.shockwaves();
        e.finishAttack();
      },
    },
    stomp: { wind: 0.7, time: 0.2, rest: 1, begin: (e) => e.shockwaves() },
    swoop: {
      wind: 0.65, time: 1.05, rest: 0.8, body: true,
      aim(e) {
        if (e.stateTime < 0.35) e.trackPlayer();
      },
      begin(e) {
        e.vx = (e.lockX - e.x) / 0.48;
        e.vy = (e.lockY - e.y) / 0.48;
        e.sfx("creature");
      },
      tick(e, dt) {
        if (e.stateTime > 0.5) e.vy = approach(e.vy, -300, 1600 * dt);
      },
    },
    whirl: {
      wind: 0.6, time: 1.2, rest: 1.2, melee: 75, around: true, offEdges: false,
      begin: (e) => e.sfx("enemyMelee"),
      tick(e, dt) {
        e.vx = approach(e.vx, sign(e.dx) * 270, 1400 * dt);
      },
    },
    flameBurst: {
      wind: 0.6, time: 0.7, rest: 0.9, melee: 130,
      tick(e, dt) {
        e.repeat(dt, 0.04, 99, () => {
          e.world.particles.flame(e.x + e.facing * 34, e.y - 64, e.facing * rand(300, 460), rand(-40, 70), rand(8, 13), 0.3);
          e.sfx("flame");
        });
      },
    },
  };

  /* ---------- Brains ---------- */

  const BRAINS = {
    // Patrols, then keeps a medium distance and fires.
    soldier(e) {
      if (!e.aggro) return e.patrol();
      e.keepDistance(230, 420);
      if (e.ready && e.canSee) e.use("shot");
    },
    // Keeps advancing while firing.
    assault(e) {
      if (!e.aggro) return e.patrol();
      e.keepDistance(120, 180);
      if (!e.ready || !e.canSee) return;
      if (e.close < 90) e.use("strike");
      else e.use("burst");
    },
    // Holds position, aims with a visible laser and backs away up close.
    sniper(e) {
      if (!e.aggro) return e.patrol(0.4);
      e.faceTarget();
      if (e.close < 170 && e.grounded && e.special <= 0) {
        e.special = 2.5;
        if (e.hop(-sign(e.dx), 280, -420)) return;
      }
      if (e.ready && e.canSee) e.use("snipe");
    },
    gunner(e) {
      if (!e.aggro) return e.patrol(0.5);
      e.keepDistance(200, 460);
      if (e.ready && e.canSee) e.use("barrage");
    },
    // Retreats, rallies allies and calls for backup once.
    officer(e) {
      if (!e.aggro) return e.patrol(0.6);
      e.keepDistance(330, 520);
      if (e.special <= 0) {
        e.special = 5;
        e.rally();
        if (!e.called) e.callBackup();
      } else if (e.ready && e.canSee) {
        e.use("shot");
      }
    },
    // Relentless: punches up close, rocket-jumps from range.
    dark(e) {
      if (!e.aggro) return;
      e.approachPlayer(55);
      if (!e.ready) return;
      if (e.close < 80 && e.level < 90) e.use("strike");
      else if (e.close > 200 && e.close < 540 && e.level < 260) e.use("rocketSlam");
    },
    // Blocks from the front until it attacks.
    guard(e) {
      if (!e.aggro) return;
      e.blocking = true;
      e.approachPlayer(80);
      if (e.ready && e.close < 115 && e.level < 80) e.use("combo");
    },
    // Rolls out of the way of incoming fire.
    evasive(e) {
      if (!e.aggro) return e.patrol();
      if (e.special <= 0 && e.grounded && e.world.projectiles.threatens(e, 210)) {
        e.special = 2.2;
        e.evade();
        return;
      }
      e.keepDistance(210, 380);
      if (e.ready && e.canSee) e.use("burst");
    },
    // Vaults over the player to attack from behind.
    flanker(e) {
      if (!e.aggro) return e.patrol();
      if (e.special <= 0 && e.grounded && e.close < 190 && e.close > 60 && e.level < 70) {
        e.special = 3;
        if (e.hop(sign(e.dx), min(440, (e.close + 100) / 0.55), -560)) return;
      }
      e.approachPlayer(60);
      if (!e.ready || e.level > 80) return;
      if (e.close < 80) e.use("strike");
      else if (e.close < 280) e.use("dash");
    },
    grenadier(e) {
      if (!e.aggro) return e.patrol(0.5);
      e.keepDistance(110, 380);
      if (!e.ready) return;
      if (e.close < 130 && e.level < 70) e.use("flameBurst");
      else if (e.canSee) e.use("grenade");
    },
    // Hovers above and strafes.
    airborne(e) {
      if (!e.aggro) return e.hover(e.homeX, e.homeY);
      const side = sign(e.x - e.world.player.x) || 1;
      e.hover(e.world.player.x + side * (230 + sin(e.time * 1.3) * 80), e.world.player.y - 130 + sin(e.time * 2.1) * 45);
      e.faceTarget();
      e.thrust = 1;
      if (e.ready && e.canSee) e.use("burst");
    },
    elite(e) {
      if (!e.aggro) return e.patrol();
      if (e.special <= 0 && e.grounded && (e.close < 120 || e.world.projectiles.threatens(e, 200))) {
        e.special = 1.8;
        if (e.close < 120 && e.hop(sign(e.dx), 380, -600)) return;
        e.evade();
        return;
      }
      e.keepDistance(200, 340);
      if (!e.ready || !e.canSee) return;
      e.use(e.alternate ? "chargedShot" : "fan");
      e.alternate = !e.alternate;
    },
    // Cycles an energy shield on and off.
    shielded(e) {
      if (!e.aggro) return e.patrol();
      e.shield = e.time % 4.2 < 1.9;
      e.approachPlayer(e.shield ? 60 : 160);
      if (!e.ready) return;
      if (e.close < 80 && e.level < 70) e.use("strike");
      else if (!e.shield && e.canSee) e.use("shot");
    },
    // Flat volleys that can be jumped.
    squad(e) {
      if (!e.aggro) return e.patrol();
      e.keepDistance(180, 360);
      if (e.ready && e.level < 120 && e.canSee) e.use("volley");
    },
    // Armored in front until its cannons overheat.
    siege(e) {
      if (!e.aggro) return e.patrol(0.5);
      e.blocking = true;
      e.keepDistance(150, 420);
      if (e.ready && e.level < 160 && e.canSee) e.use("twin");
    },
    // Runs away and repairs its allies.
    repair(e, dt) {
      const ally = e.woundedAlly();
      e.beam = null;
      if (ally && hypot(ally.x - e.x, ally.y - e.y) < 340) {
        e.hover(ally.x - sign(ally.x - e.x) * 70, ally.y - 60);
        e.facing = sign(ally.x - e.x) || 1;
        ally.hp = min(ally.maxHp, ally.hp + 26 * dt);
        e.beam = ally;
      } else if (e.aggro && e.close < 280) {
        e.hover(e.x - sign(e.dx) * 160, e.homeY);
      } else {
        e.hover(e.homeX, e.homeY);
      }
    },
    walker(e) {
      if (!e.aggro) return e.patrol(0.5);
      e.approachPlayer(200);
      if (!e.ready) return;
      if (e.close < 130 && e.level < 100) e.use("stomp");
      else if (e.canSee) e.use("cannon");
    },
    turret(e) {
      e.vx = 0;
      if (!e.aggro) return;
      e.faceTarget();
      e.aimAngle = clamp(atan2(e.world.player.y - 45 - (e.y - 35), abs(e.dx)), -1.2, 1.2);
      if (e.ready && e.canSee) e.use("shot");
    },
    driller(e) {
      if (!e.aggro) return e.patrol();
      e.approachPlayer(90);
      if (e.ready && e.level < 80 && e.close < 480) e.use("charge");
    },
    // Hides in the sand until the player is close.
    burrower(e, dt) {
      const wake = e.aggro && e.close < (e.buried > 0.5 ? 210 : 520);
      e.buried = approach(e.buried, wake ? 0 : 1, dt * 3);
      if (e.buried > 0.05) return;
      e.approachPlayer(70);
      if (e.ready && e.close < 230 && e.level < 120) e.use("pounce");
    },
    scuttler(e) {
      if (!e.aggro) return e.patrol();
      e.approachPlayer(110);
      if (!e.ready) return;
      if (e.close < 80 && e.level < 70) e.use("hopPeck");
      else if (e.canSee && e.close < 320) e.use("ion");
    },
    diver(e) {
      if (!e.aggro) return e.hover(e.homeX + sin(e.time) * 120, e.homeY + sin(e.time * 2) * 18);
      const p = e.world.player;
      const tx = p.x + sin(e.time * 1.1) * 210;
      e.hover(tx, p.y - 175);
      e.facing = sign(tx - e.x) || e.facing;
      if (e.ready && e.close < 300 && e.canSee) e.use("swoop");
    },
    // Shell in front, soft behind.
    roller(e) {
      if (!e.aggro) return e.patrol();
      e.blocking = true;
      e.approachPlayer(120);
      if (e.ready && e.level < 60 && e.close < 380) e.use("charge");
    },
    // Hangs from the ceiling and drops.
    lurker(e, dt) {
      if (e.hanging) {
        e.vx = 0;
        e.vy = 0;
        if (e.aggro && e.close < 110 && e.dy > -20) {
          e.hanging = false;
          e.flip = false;
          e.sfx("creature");
        }
        return;
      }
      if (!e.aggro) return e.patrol();
      e.approachPlayer(60);
      if (!e.ready) return;
      if (e.close < 150 && e.level < 100) e.use("hopPeck");
      else if (e.canSee && e.close < 360) e.use("web");
    },
    stalker(e) {
      if (!e.aggro) return e.patrol(0.6);
      if (e.special <= 0 && e.close < 70 && e.grounded) {
        e.special = 2;
        if (e.hop(-sign(e.dx), 330, -330)) return;
      }
      e.approachPlayer(150);
      if (e.ready && e.close < 330 && e.level < 140) e.use("pounce");
    },
    hopper(e) {
      if (!e.aggro) return e.patrol();
      if (e.grounded && e.special <= 0 && e.close >= 110) {
        e.special = rand(0.5, 1);
        e.hop(sign(e.dx), 250, -370);
      }
      if (e.grounded) e.faceTarget();
      if (e.ready && e.close < 170 && e.level < 120) e.use("hopPeck");
    },
    // Leaps out of the water.
    eel(e) {
      if (e.leaping) return;
      e.x = e.homeX + sin(e.time) * 25;
      e.y = e.homeY + 70;
      if (e.ready && e.aggro && e.close < 260 && e.dy < 100) {
        e.leaping = true;
        e.vx = clamp(e.dx / 0.6, -260, 260);
        e.vy = -Math.sqrt(2 * GRAVITY * 0.6 * clamp(70 + max(0, -e.dy) + 60, 150, 320));
        e.world.particles.sparks(e.x, e.homeY, "#8ff0f0", 12);
        e.sfx("creature");
      }
    },
    // Skittish: shoots an ion blaster and runs.
    skittish(e) {
      if (!e.aggro) return e.patrol();
      if (e.close < 200) {
        if (!e.walk(-sign(e.dx), 1.35)) e.faceTarget();
      } else {
        e.vx = 0;
        e.faceTarget();
      }
      if (e.ready && e.canSee) {
        e.faceTarget();
        e.use("ion");
      }
    },
    raider(e) {
      if (!e.aggro) return e.patrol();
      e.approachPlayer(80);
      if (!e.ready) return;
      if (e.close < 90 && e.level < 70) e.use("strike");
      else if (e.close < 250 && e.level < 120 && Math.random() < 0.5) e.use("pounce");
      else if (e.close > 150 && e.close < 480) e.use("throwRock");
    },
    // A statue until someone comes near.
    ancient(e) {
      if (!e.awake) {
        if (e.close < 230 && e.level < 130) {
          e.awake = true;
          e.cooldown = 0.8;
          e.world.particles.ring(e.x, e.y - 50, 90, "#58d6c2");
          e.sfx("mechanism");
        }
        return;
      }
      e.approachPlayer(90);
      if (e.ready && e.close < 220 && e.level < 90) e.use("whirl");
    },
  };

  /* ---------- Types ---------- */

  const type = (name, art, brain, w, h, hp, damage, speed, points, extra) => ({
    name, art, brain, w, h, hp, damage, speed, points, scale: 1, human: false, cooldown: 1.4, charge: 520, ...extra,
  });
  const human = { human: true };

  const TYPES = {
    stormtrooper: type("Stormtrooper", "trooper", "soldier", 30, 82, 42, 10, 85, 120, human),
    eliteTrooper: type("Elite Stormtrooper", "eliteTrooper", "assault", 30, 82, 78, 11, 130, 220, { human: true, cooldown: 1.2 }),
    scout: type("Scout Trooper", "scout", "sniper", 30, 80, 34, 10, 90, 160, { human: true, cooldown: 2 }),
    heavyTrooper: type("Heavy Stormtrooper", "heavyTrooper", "gunner", 40, 92, 125, 13, 48, 280, { human: true, scale: 1.12, large: true, cooldown: 2.2 }),
    officer: type("Imperial Officer", "officer", "officer", 30, 82, 52, 9, 95, 240, human),
    darkTrooper: type("Dark Trooper", "darkTrooper", "dark", 42, 94, 175, 17, 105, 400, { human: true, scale: 1.14, large: true, droid: true, cooldown: 1.8 }),
    guard: type("Imperial Guard", "guard", "guard", 32, 86, 105, 15, 140, 300, { human: true, scale: 1.04 }),
    hunter: type("Bounty Hunter", "hunter", "evasive", 30, 80, 55, 10, 140, 180, human),
    hunterMelee: type("Blade Hunter", "hunterMelee", "flanker", 30, 82, 65, 14, 190, 210, human),
    hunterHeavy: type("Heavy Bounty Hunter", "hunterHeavy", "grenadier", 42, 94, 135, 16, 55, 290, { human: true, scale: 1.12, large: true, cooldown: 2 }),
    hunterJet: type("Jetpack Hunter", "hunterJet", "airborne", 30, 78, 62, 10, 220, 250, { human: true, fly: true }),
    hunterElite: type("Elite Bounty Hunter", "hunterElite", "elite", 32, 84, 115, 13, 160, 350, human),
    securityDroid: type("Security Droid", "security", "shielded", 28, 82, 48, 10, 110, 140, { human: true, droid: true }),
    probe: type("Probe Droid", "probe", "airborne", 42, 62, 34, 9, 170, 150, { fly: true, droid: true }),
    battleDroid: type("Battle Droid", "battle", "squad", 26, 80, 30, 9, 90, 110, { human: true, droid: true }),
    heavyDroid: type("Heavy Combat Droid", "heavyDroid", "siege", 56, 74, 150, 15, 65, 320, { large: true, droid: true, cooldown: 1.6 }),
    repairDroid: type("Repair Droid", "repair", "repair", 36, 58, 32, 0, 180, 170, { fly: true, droid: true }),
    combatMachine: type("Imperial Combat Machine", "machine", "walker", 70, 122, 260, 15, 60, 480, { large: true, droid: true, cooldown: 1.7 }),
    turret: type("Security Turret", "turret", "turret", 42, 48, 60, 11, 0, 160, { fixed: true, droid: true, cooldown: 1.5 }),
    miner: type("Mining Machine", "miner", "driller", 70, 66, 140, 17, 70, 280, { large: true, droid: true, charge: 430, cooldown: 1.8 }),
    scavenger: type("Scavenger Droid", "scavenger", "scuttler", 44, 38, 32, 8, 170, 120, { droid: true }),
    ancientDroid: type("Ancient Droid", "ancient", "ancient", 36, 88, 115, 16, 105, 300, { human: true, scale: 1.08, droid: true }),
    skitter: type("Sand Skitter", "skitter", "burrower", 54, 34, 30, 11, 160, 120, { creature: true }),
    flyer: type("Winged Stinger", "flyer", "diver", 44, 36, 26, 11, 200, 140, { fly: true, creature: true, cooldown: 1.7 }),
    crawler: type("Cave Crawler", "crawler", "roller", 62, 42, 70, 14, 85, 180, { creature: true }),
    spider: type("Cave Spider", "spider", "lurker", 46, 38, 36, 10, 135, 140, { creature: true }),
    stalker: type("Forest Stalker", "stalker", "stalker", 62, 52, 68, 14, 180, 190, { creature: true, cooldown: 1.1 }),
    nestling: type("Reptavian Nestling", "nestling", "hopper", 36, 50, 34, 10, 150, 130, { creature: true, cooldown: 0.9 }),
    eel: type("Lake Serpent", "eel", "eel", 44, 34, 42, 13, 0, 160, { fly: true, creature: true, cooldown: 1.6 }),
    raider: type("Tusken Raider", "raider", "raider", 32, 82, 58, 12, 150, 170, human),
    jawa: type("Jawa Scavenger", "jawa", "skittish", 26, 58, 22, 5, 170, 80, { human: true, scale: 0.7 }),
  };

  /* ---------- Enemy ---------- */

  class Enemy {
    constructor(world, typeId, x, y, options = {}) {
      const def = TYPES[typeId];
      if (!def) throw new Error(`Unknown enemy type "${typeId}"`);
      const { id } = world.def;

      this.world = world;
      this.def = def;
      this.think = BRAINS[def.brain];
      this.large = !!def.large;
      this.x = this.homeX = x;
      this.y = this.homeY = y;
      this.vx = 0;
      this.vy = 0;
      this.w = def.w;
      this.h = def.h;
      this.hp = this.maxHp = def.hp * (1 + (id - 1) * 0.09);
      this.damage = def.damage * (1 + (id - 1) * 0.04);
      this.baseDamage = this.damage;
      this.points = options.points ?? def.points;
      this.group = options.group || null;
      this.range = options.range ?? 130;
      this.aggro = !!options.aggro;
      this.alert = !!options.aggro;

      this.facing = options.facing || -1;
      this.patrolDirection = this.facing;
      this.grounded = false;
      this.ground = null;
      this.wall = 0;
      this.dead = false;
      this.remove = false;
      this.state = "move";
      this.stateTime = 0;
      this.attack = null;
      this.cooldown = rand(0.5, 1.2);
      this.special = rand(1, 2.5);
      this.stun = 0;
      this.flash = 0;
      this.barTime = 0;
      this.pushed = 0;
      this.rallied = 0;
      this.time = rand(0, 4);
      this.seeTime = 0;
      this.canSee = false;
      this.dx = this.dy = this.close = this.level = 9999;
      this.repeatCount = 0;
      this.repeatTime = 0;
      this.lockX = x;
      this.lockY = y;
      this.hasHit = false;
      this.blocking = false;
      this.shield = false;
      this.thrust = 0;
      this.aimAngle = 0;
      this.awake = def.brain !== "ancient";
      this.buried = def.brain === "burrower" ? 1 : 0;
      this.hanging = def.brain === "lurker" && options.hang !== false;
      this.flip = this.hanging;
      this.leaping = false;
      this.called = false;
      this.alternate = false;
      this.beam = null;
      this.claimed = -1;
      this.burned = -1;
      this.deadTime = 0;

      this.phase = 0;
      this.animTime = 0;
      this.anim = "idle";
      this.pose = def.human ? MQ.Anim.createPose() : null;
      this.view = {
        art: def.art, pose: this.pose, time: 0, phase: 0, windup: false, attacking: false,
        thrust: 0, aim: 0, buried: 0, grounded: true, awake: true, angle: 0,
      };
    }

    get hittable() {
      return !this.dead && this.buried < 0.6 && !(this.def.brain === "eel" && !this.leaping);
    }

    get ready() {
      return this.cooldown <= 0 && this.state === "move" && (this.grounded || this.def.fly || this.def.fixed);
    }

    sfx(name) {
      this.world.sfx(name);
    }

    update(dt) {
      if (this.dead) {
        this.updateCorpse(dt);
        return;
      }
      const { player } = this.world;
      if (abs(player.x - this.x) > ACTIVE_RANGE || abs(player.y - this.y) > ACTIVE_RANGE) return;

      this.time += dt;
      this.cooldown -= dt;
      this.special -= dt;
      this.flash -= dt;
      this.barTime -= dt;
      this.pushed -= dt;
      this.rallied -= dt;
      this.seeTime -= dt;
      this.damage = this.rallied > 0 ? this.baseDamage * 1.3 : this.baseDamage;

      this.dx = player.x - this.x;
      this.dy = player.y - this.y;
      this.close = abs(this.dx);
      this.level = abs(this.dy);
      if (this.seeTime <= 0) this.look();

      this.blocking = false;
      if (this.stun > 0) {
        this.stun -= dt;
        this.shield = false;
        this.vx = approach(this.vx, 0, (this.grounded ? 1100 : 220) * dt);
        if (this.def.fly) this.vy = approach(this.vy, 0, 700 * dt);
      } else if (this.state === "move") {
        if (!this.def.fly && this.grounded) this.vx = 0;
        if (player.dead) this.patrol();
        else this.think(this, dt);
      } else {
        this.runAttack(dt);
      }

      this.move(dt);
      this.animate(dt);
    }

    look() {
      this.seeTime = 0.2;
      const { player, camera, col } = this.world;
      const top = this.y - this.h * 0.8;
      this.canSee = !player.dead && camera.sees(this.x, top, 0) &&
        hypot(this.dx, this.dy) < SIGHT * 1.35 && col.clearLine(this.x, top, player.x, player.y - 50);
      if (this.alert) {
        this.aggro = true;
      } else if (this.aggro) {
        if (this.close > SIGHT * 1.7 || this.level > 420) this.aggro = false;
      } else if (this.close < SIGHT && this.level < 320 && camera.sees(this.x, top, 0)) {
        this.aggro = this.canSee || this.close < 260;
      }
    }

    /* ---------- Movement ---------- */

    faceTarget() {
      if (this.dx) this.facing = sign(this.dx);
    }

    footing(direction, distance = this.w / 2 + 12) {
      return this.world.col.floorBelow(this.x + direction * distance, this.y - 22, 70) !== Infinity &&
        !this.world.level.hazardAt(this.x + direction * distance, this.y - 4);
    }

    walk(direction, speed = 1) {
      if (!direction) {
        this.vx = 0;
        return false;
      }
      this.facing = direction;
      if (!this.grounded) return true;
      if (this.wall === direction || !this.footing(direction)) {
        this.vx = 0;
        return false;
      }
      this.vx = direction * this.def.speed * speed;
      return true;
    }

    patrol(speed = 0.6) {
      if (this.def.fixed || !this.awake || this.buried || this.hanging) return;
      if (this.def.fly) {
        this.hover(this.homeX, this.homeY);
        return;
      }
      if (!this.grounded) return;
      const offset = this.x - this.homeX;
      if (abs(offset) > this.range) this.patrolDirection = -sign(offset);
      if (!this.walk(this.patrolDirection, speed)) this.patrolDirection *= -1;
    }

    keepDistance(nearest, farthest) {
      if (this.close < nearest) {
        this.walk(-sign(this.dx), 0.8);
        this.facing = sign(this.dx) || this.facing;
      } else if (this.close > farthest) {
        this.walk(sign(this.dx));
      } else {
        if (this.grounded) this.vx = 0;
        this.faceTarget();
      }
    }

    approachPlayer(stop) {
      if (this.close > stop) {
        this.walk(sign(this.dx));
      } else {
        if (this.grounded) this.vx = 0;
        this.faceTarget();
      }
    }

    hop(direction, vx, vy) {
      if (!direction || !this.grounded) return false;
      // Only jump where there is somewhere to land.
      const landing = this.x + direction * vx * ((-2 * vy) / GRAVITY);
      if (this.world.col.floorBelow(landing, this.y - 80, 180) === Infinity || this.world.level.hazardAt(landing, this.y - 4)) return false;
      this.vx = direction * vx;
      this.vy = vy;
      this.grounded = false;
      return true;
    }

    evade() {
      const away = -sign(this.dx) || 1;
      if (!this.hop(away, 300, -430)) this.hop(-away, 300, -520);
    }

    hover(x, y) {
      const { speed } = this.def;
      this.vx = damp(this.vx, clamp((x - this.x) * 2, -speed, speed), 5, MQ.STEP);
      this.vy = damp(this.vy, clamp((y - this.y) * 2.5, -speed, speed), 5, MQ.STEP);
    }

    move(dt) {
      const { def, world } = this;
      if (def.brain === "eel") {
        this.swim(dt);
        return;
      }
      if (this.hanging || def.fixed) return;
      if (!def.fly) this.vy = min(this.vy + GRAVITY * dt, 1050);
      world.col.move(this, dt, MOVE);
      // Enemies walk back inside rather than leave a locked arena.
      if (this.group?.locked) this.x = clamp(this.x, this.group.x0 + this.w, this.group.x1 - this.w);
      if (this.y > world.height + 60 || world.level.deadlyAt(this.x, this.y - 2)) this.die(true);
    }

    swim(dt) {
      if (!this.leaping) return;
      this.vy += GRAVITY * 0.6 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.facing = sign(this.vx) || this.facing;
      if (MQ.touches(this.world.player, this.x - 22, this.y - 38, this.x + 22, this.y)) this.world.hurtPlayer(this.damage, this.x);
      if (this.vy > 0 && this.y > this.homeY + 70) {
        this.leaping = false;
        this.cooldown = this.def.cooldown;
        this.world.particles.sparks(this.x, this.homeY, "#8ff0f0", 10);
      }
    }

    /* ---------- Attacking ---------- */

    use(name) {
      const { col } = this.world;
      const attack = ATTACKS[name];
      // Never start a charge straight off a ledge.
      if (attack.offEdges === false && this.grounded && col.floorBelow(this.x + sign(this.dx) * (this.w / 2 + 20), this.y - 22, 70) === Infinity) return;
      this.attack = attack;
      this.state = "wind";
      this.stateTime = 0;
      this.faceTarget();
      this.trackPlayer();
      if (this.grounded) this.vx = 0;
      if (this.world.camera.sees(this.x, this.y - 30, 40)) this.sfx("enemyWarn");
    }

    trackPlayer() {
      this.lockX = this.world.player.x;
      this.lockY = this.world.player.y - 44;
    }

    runAttack(dt) {
      const { attack, def } = this;
      this.stateTime += dt;

      if (this.state === "wind") {
        attack.aim?.(this);
        if (this.grounded) this.vx = approach(this.vx, 0, 2000 * dt);
        else if (def.fly) {
          this.vx *= 0.96;
          this.vy *= 0.94;
        }
        if (this.stateTime < attack.wind) return;
        this.state = "act";
        this.stateTime = 0;
        this.hasHit = false;
        this.repeatCount = 0;
        this.repeatTime = 0;
        attack.begin?.(this);
      } else if (this.state === "act") {
        attack.tick?.(this, dt);
        if (this.state !== "act") return;
        if (attack.offEdges === false && this.grounded && !this.footing(sign(this.vx) || this.facing)) this.vx = 0;
        this.hitPlayer(attack);
        if (this.stateTime >= attack.time) this.finishAttack();
      } else {
        if (this.grounded) this.vx = approach(this.vx, 0, 1400 * dt);
        else if (def.fly) {
          this.vx *= 0.98;
          this.vy *= 0.98;
        }
        if (this.stateTime < attack.rest) return;
        this.state = "move";
        this.cooldown = def.cooldown * rand(0.8, 1.25);
      }
    }

    finishAttack() {
      this.state = "rest";
      this.stateTime = 0;
      this.thrust = 0;
    }

    hitPlayer(attack) {
      if (this.hasHit || (!attack.body && !attack.melee)) return;
      let left = this.x - this.w / 2;
      let right = this.x + this.w / 2;
      if (attack.melee) {
        if (attack.around) {
          left = this.x - attack.melee;
          right = this.x + attack.melee;
        } else if (this.facing > 0) {
          right = this.x + attack.melee;
        } else {
          left = this.x - attack.melee;
        }
      }
      const top = this.y - max(this.h, attack.melee ? 70 : 0);
      if (MQ.touches(this.world.player, left, top, right, this.y) && this.world.hurtPlayer(this.damage, this.x)) this.hasHit = true;
    }

    repeat(dt, every, count, fn) {
      this.repeatTime -= dt;
      if (this.repeatTime > 0 || this.repeatCount >= count) return;
      this.repeatTime = every;
      fn(this.repeatCount++);
    }

    muzzleY() {
      return this.y - (this.def.human ? 66 * this.def.scale : this.h * 0.68);
    }

    shoot(spread = 0, options) {
      const { player } = this.world;
      this.faceTarget();
      const x = this.x + this.facing * (this.w / 2 + 14);
      const y = this.muzzleY();
      const wobble = options?.exact ? spread : spread + rand(-0.06, 0.06);
      const angle = atan2(player.y - 44 - y, player.x - x) + wobble;
      this.launch(x, y, angle, options);
    }

    shootAt(tx, ty, options) {
      const x = this.x + this.facing * (this.w / 2 + 14);
      const y = this.muzzleY();
      this.launch(x, y, atan2(ty - y, tx - x), options);
    }

    shootFlat(height, color = RED) {
      this.launch(this.x + this.facing * (this.w / 2 + 14), this.y + height, this.facing > 0 ? 0 : Math.PI, { color, speed: 440 });
    }

    launch(x, y, angle, options) {
      const speed = options?.speed ?? 480;
      const color = options?.color ?? RED;
      // As with the player, shots start at the body and only the flash is at the muzzle.
      const p = this.world.projectiles.fire(ENEMY, options?.kind ?? "bolt", this.x, y, cos(angle) * speed, sin(angle) * speed, options?.damage ?? this.damage, color, 2.2);
      if (options?.big) p.r = 9;
      this.world.particles.flash(x, y, 26, color);
      this.sfx("enemyShot");
    }

    lob(kind, color, radius, blast = 0) {
      const { player } = this.world;
      const gravity = 1000;
      const x = this.x + this.facing * 20;
      const y = this.muzzleY();
      const time = clamp(this.close / 380, 0.55, 1.15);
      const vy = (player.y - 30 - y) / time - 0.5 * gravity * time;
      const p = this.world.projectiles.fire(ENEMY, kind, x, y, (player.x - x) / time, max(vy, -900), this.damage, color, 3);
      p.gravity = gravity;
      p.r = radius;
      p.blast = blast;
      this.sfx("enemyMelee");
    }

    shockwaves() {
      const { world } = this;
      for (const direction of [-1, 1]) {
        const p = world.projectiles.fire(ENEMY, "shock", this.x + direction * 24, this.y, direction * 360, 0, this.damage, "#ff9a5c", 0.7);
        p.r = 30;
      }
      world.camera.shake(0.25);
      world.particles.dust(this.x, this.y, "#a89c90", 12, 190);
      this.sfx("explosion");
    }

    rally() {
      this.world.particles.ring(this.x, this.y - 50, 260, "#ffd45c", 0.6);
      for (const ally of this.world.enemies) {
        if (ally === this || ally.dead || abs(ally.x - this.x) > 280 || abs(ally.y - this.y) > 160) continue;
        ally.rallied = 5;
        ally.aggro = true;
      }
    }

    callBackup() {
      this.called = true;
      const { col, height } = this.world;
      const x = this.x + (sign(this.dx) || 1) * -70;
      const floor = col.floorBelow(x, this.y - 30, 100);
      if (floor === Infinity || floor >= height || !col.free(x, floor, 30, 82)) return;
      this.world.spawn("stormtrooper", x, floor, { aggro: true, points: 0, group: this.group });
      this.sfx("transmission");
    }

    woundedAlly() {
      let best = null;
      let lowest = 0.98;
      const { enemies } = this.world;
      for (let i = 0; i < enemies.length; i++) {
        const ally = enemies[i];
        if (ally === this || ally.dead) continue;
        const ratio = ally.hp / ally.maxHp;
        if (ratio < lowest && abs(ally.x - this.x) < 520) {
          lowest = ratio;
          best = ally;
        }
      }
      return best;
    }

    /* ---------- Damage ---------- */

    hurt(amount, fromX, knock = 0, kind = "", executeBelow = 0) {
      if (!this.hittable) return false;
      const { world } = this;
      this.aggro = true;
      this.awake = true;
      this.hanging = false;
      this.flip = false;

      const through = kind === "blade" || kind === "saber" || kind === "blast" || kind === "force" || kind === "lance";
      const fromFront = (sign(fromX - this.x) || this.facing) === this.facing;
      let damage = amount;
      let blocked = false;
      if (this.shield && kind !== "force" && kind !== "saber") {
        damage *= through ? 0.6 : 0.12;
        blocked = !through;
      } else if (this.blocking && fromFront && !through && this.stun <= 0) {
        damage *= 0.15;
        blocked = true;
      }

      this.hp -= damage;
      this.flash = 0.1;
      this.barTime = 2.5;
      if (executeBelow && !this.large && this.hp > 0 && this.hp < this.maxHp * executeBelow) {
        this.hp = 0;
        world.particles.label(this.x, this.y - this.h - 30, "FINISHER", "#ffffff", 20);
      }

      if (this.hp <= 0) {
        this.die(false);
        return true;
      }
      if (blocked) {
        world.particles.sparks(this.x + this.facing * this.w * 0.6, this.y - this.h * 0.6, "#8fdcff", 6);
        if (kind !== "flame") world.particles.label(this.x, this.y - this.h - 16, "BLOCKED", "#8fdcff", 13);
      } else {
        world.sfx("enemyHit");
        if (knock && !this.large && !this.def.fixed && this.state !== "act") this.vx += (sign(this.x - fromX) || 1) * knock;
      }
      return true;
    }

    push(direction, strength) {
      if (this.dead || this.buried > 0.6) return;
      this.aggro = true;
      this.awake = true;
      this.hanging = false;
      this.flip = false;
      this.shield = false;
      this.state = "move";
      this.thrust = 0;
      this.cooldown = max(this.cooldown, 0.6);
      this.pushed = 3;
      this.stun = (this.large ? 0.9 : 0.75) * strength;
      this.world.particles.label(this.x, this.y - this.h - 18, "STAGGERED", "#8fdcff", 14);
      if (this.def.fixed || this.def.brain === "eel") return;
      const power = this.large ? 260 : 640;
      this.vx = direction * power * strength;
      this.vy = this.large ? -120 : -330;
      this.grounded = false;
    }

    die(lost) {
      if (this.dead) return;
      this.dead = true;
      this.deadTime = 0;
      this.shield = false;
      this.beam = null;
      const { world } = this;
      const y = this.y - this.h / 2;
      if (this.def.droid) {
        world.particles.explosion(this.x, y, this.large ? 0.8 : 0.45);
        world.sfx("droidDown");
      } else {
        world.particles.sparks(this.x, y, "#ffd9b0", 12);
        world.particles.dust(this.x, this.y, "#9a8a7a", 8);
        world.sfx("enemyDown");
      }
      // Falls only score if the player caused them.
      if (!lost || this.pushed > 0 || this.hp < this.maxHp) world.enemyDefeated(this, lost);
      if (lost || (this.def.droid && !this.def.human) || this.def.brain === "eel") this.remove = true;
    }

    updateCorpse(dt) {
      this.deadTime += dt;
      this.time += dt;
      this.vx = approach(this.vx, 0, 700 * dt);
      this.vy = min(this.vy + GRAVITY * dt, 1050);
      this.world.col.move(this, dt);
      this.animTime += dt;
      if (this.deadTime > 1.1) this.remove = true;
    }

    /* ---------- Drawing ---------- */

    animate(dt) {
      let anim;
      if (this.stun > 0) anim = "hurt";
      else if (this.def.fly && this.def.human) anim = "fly";
      else if (!this.grounded && !this.def.fly) anim = this.vy < 0 ? "jump" : "fall";
      else if (abs(this.vx) > 170) anim = "run";
      else if (abs(this.vx) > 10) anim = "walk";
      else anim = this.def.brain === "sniper" && this.state !== "move" ? "land" : "idle";

      if (anim !== this.anim) {
        this.anim = anim;
        this.animTime = 0;
      }
      this.animTime += dt;
      this.phase += max(abs(this.vx), this.def.fly ? 120 : 0) * 0.045 * dt;
    }

    drawArms() {
      const { state, attack, def } = this;
      if (this.stun > 0 || this.dead) return null;
      if (state !== "move") {
        if (attack.melee || attack === ATTACKS.throwRock) return state === "wind" ? "windup" : state === "act" ? "swing" : "hold";
        if (attack === ATTACKS.grenade) return state === "wind" ? "windup" : "point";
        if (attack === ATTACKS.rocketSlam) return "raise";
      }
      switch (def.art) {
        case "guard": return "guard";
        case "raider":
        case "ancient":
        case "hunterMelee":
        case "security": return "hold";
        case "darkTrooper": return null;
        case "officer":
        case "jawa":
        case "hunter":
        case "hunterJet": return this.aggro ? "aim" : null;
        default: return "rifle";
      }
    }

    draw(ctx) {
      const { def, view, world } = this;
      if (!world.camera.sees(this.x, this.y - this.h / 2, 160)) return;
      if (def.brain === "eel" && !this.leaping) {
        oval(ctx, this.x, this.homeY + 8, 22, 4, "rgba(150,255,240,0.28)");
        return;
      }

      const winding = !this.dead && this.state === "wind" && this.stun <= 0;
      if (winding) this.drawWarning(ctx);
      if (this.beam) {
        line(ctx, this.x, this.y - 36, this.beam.x, this.beam.y - this.beam.h / 2, "rgba(109,255,154,0.6)", 3);
        glow(ctx, this.beam.x, this.beam.y - this.beam.h / 2, 30, "#6dff9a", 0.5);
      }

      if (this.pose) {
        const aiming = this.aggro && !this.dead;
        const angle = aiming ? clamp(atan2(this.dy + 20, this.close + 1), -0.9, 0.9) : 0.15;
        const k = this.state === "act" ? clamp(this.stateTime / max(0.12, this.attack.time), 0, 1) : winding ? this.stateTime / this.attack.wind : 0;
        MQ.Anim.human(this.pose, this.dead ? "dead" : this.anim, this.time, this.phase, this.animTime, this.drawArms(), k, 0, angle);
      }

      view.time = this.time;
      view.phase = this.phase;
      view.windup = winding;
      view.attacking = !this.dead && this.state === "act";
      view.thrust = this.thrust || (def.fly ? 1 : 0);
      view.aim = this.aimAngle;
      view.buried = this.buried;
      view.grounded = this.grounded;
      view.awake = this.awake;
      view.angle = def.brain === "eel" ? atan2(this.vy, abs(this.vx) + 1) * 0.8 : 0;

      ctx.save();
      if (this.dead) ctx.globalAlpha = clamp((1.1 - this.deadTime) * 2, 0, 1);
      ctx.translate(this.x, this.y);
      if (this.buried > 0.01) {
        ctx.beginPath();
        ctx.rect(-90, -110, 180, 110);
        ctx.clip();
      }
      if (this.flip) {
        ctx.translate(0, -this.h);
        line(ctx, 0, 0, 0, -90, "rgba(220,240,230,0.4)", 1.5);
        ctx.scale(1, -1);
      }
      ctx.scale(this.facing * def.scale, def.scale);
      if (this.dead && !this.pose) ctx.scale(1, -0.6);
      MQ.EnemyArt.draw(ctx, view);
      ctx.restore();

      if (this.buried > 0.05) {
        oval(ctx, this.x, this.y, 28, 7 + sin(this.time * 6) * 1.5, "rgba(150,105,65,0.9)");
        return;
      }
      if (this.dead) return;

      const middle = this.y - this.h / 2;
      if (this.flash > 0) glow(ctx, this.x, middle, max(this.w, this.h) * 0.8, "#ffffff", 0.55);
      if (this.shield) {
        oval(ctx, this.x, middle, this.w / 2 + 18, this.h / 2 + 12, "rgba(86,216,255,0.12)", "rgba(130,225,255,0.8)", 2);
      }
      if (this.rallied > 0) glow(ctx, this.x, this.y - this.h, 20, "#ffd45c", 0.7);
      if (this.stun > 0) {
        for (let i = 0; i < 3; i++) glow(ctx, this.x + cos(this.time * 6 + i * 2.1) * 20, this.y - this.h - 8, 9, "#8fdcff", 0.9);
      }
      if (this.barTime > 0) {
        const width = max(40, this.w);
        const top = this.y - this.h - 16;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(this.x - width / 2, top, width, 5);
        ctx.fillStyle = "#ff6a5c";
        ctx.fillRect(this.x - width / 2, top, width * clamp(this.hp / this.maxHp, 0, 1), 5);
      }
      if (winding) text(ctx, "!", this.x, this.y - this.h - 22, 27, "#ffd45c", "center", 800);
    }

    drawWarning(ctx) {
      const { attack } = this;
      const k = this.stateTime / attack.wind;
      if (attack === ATTACKS.snipe || attack === ATTACKS.swoop) {
        ctx.globalAlpha = 0.25 + k * 0.6;
        line(ctx, this.x + this.facing * 20, this.muzzleY(), this.lockX, this.lockY, RED, 1 + k * 1.5);
        ctx.globalAlpha = 1;
      } else if (attack.marker && this.lockY < Infinity) {
        oval(ctx, this.lockX, this.lockY - 2, 42, 8, `rgba(255,83,72,${0.15 + k * 0.4})`, RED, 2);
      } else if (!attack.melee && !attack.body) {
        glow(ctx, this.x + this.facing * 28, this.muzzleY(), 10 + k * 26, RED, 0.4 + k * 0.4);
      }
    }
  }

  const MOVE = { step: 20 };

  Enemy.TYPES = TYPES;
  MQ.Enemy = Enemy;
})(window.MQ);
