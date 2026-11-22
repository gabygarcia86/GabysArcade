/* One attempt at a level: owns every gameplay system and the rules that connect them. */
(function (MQ) {
  const { hypot, abs } = Math;
  const D = MQ.DATA;

  const PLAYER = 0;
  const FALL_DAMAGE = 18;
  const INTRO_TIME = 3.4;
  const RESPAWN_DELAY = 1.7;
  const VICTORY_AT = 2.6;
  const LEAVE_AT = 5.2;
  const EXIT_DELAY = 1.8;
  const DROP_CHANCE = 0.16;
  const BOSS_FIGHT_DAMAGE = 1.4;

  class World {
    /*
     * services: { saveManager, progression, customization, audio, hud, onFinish, onGameOver, onWeapon }
     */
    constructor(def, services) {
      this.def = def;
      this.services = services;
      this.progression = services.progression;
      this.save = services.saveManager.data;
      this.settings = this.save.settings;
      this.stats = { ...services.progression.stats };
      this.difficulty = D.DIFFICULTY[this.settings.difficulty];
      this.firstVisit = this.save.completed < def.id;

      this.state = "play";
      this.stateTime = 0;
      this.time = 0;
      this.step = 0;
      // The multiplier is fixed at the start, so switching difficulty mid-level can't raise a score.
      this.run = { time: 0, points: 0, kills: 0, lives: D.LIVES, multiplier: this.difficulty.score };
      this.targets = [];
      this.enemies = [];
      this.boss = null;
      this.arena = null;
      this.arenaBackground = null;

      this.particles = new MQ.ParticleSystem(this.settings.effects);
      this.level = new MQ.LevelManager(this, def);
      this.col = this.level.col;
      this.width = def.width;
      this.height = def.height;
      this.dustColor = MQ.MATERIALS[def.material].top;

      this.camera = new MQ.Camera(def.width, def.height);
      this.camera.shakeEnabled = this.settings.shake;
      this.projectiles = new MQ.ProjectileManager(this);

      const [x, y] = def.start;
      this.checkpointX = x;
      this.checkpointY = y;
      this.player = new MQ.Player(this, x, y);
      this.baby = new MQ.BabyG(this, def.id > 1);
      this.force = new MQ.ForceAbility(this);
      this.collectibles = new MQ.CollectibleManager(this, this.level.data.pucks, this.level.data.pickups);
      for (const foe of this.level.data.foes) this.spawn(foe.type, foe.x, foe.y, foe.options, true);

      this.background = MQ.Backgrounds.get(def.scene);
      this.camera.snap(this.player);
      this.hud = services.hud;
      this.hud.reset();
      this.hud.title(`LEVEL ${def.id}  ·  ${def.planet.toUpperCase()}`, def.title);
      this.hud.toast("OBJECTIVE", this.level.objectiveText);
      services.audio.music(`level${def.id}`);
    }

    get look() {
      return this.services.customization.look;
    }

    // True while the player has no control.
    get frozen() {
      return this.state !== "play";
    }

    /* ---------- Messages ---------- */

    sfx(name) {
      this.services.audio.sfx(name);
    }

    say(who, text) {
      this.hud.say(who, text);
      this.sfx("transmission");
    }

    toast(title, detail) {
      this.hud.toast(title, detail);
    }

    banner(text) {
      this.hud.banner(text);
    }

    showHint(trigger) {
      if (!this.settings.hints) return;
      if (trigger.needs === "jetpack" && !this.stats.jetpack) return;
      if (trigger.needs === "force" && !this.stats.force) return;
      if (trigger.first && !this.firstVisit) return;
      this.hud.hint(trigger.text, trigger.touch);
    }

    weaponChanged() {
      const weapon = this.player.weapons.current;
      this.hud.weaponChanged(weapon);
      this.services.onWeapon(weapon);
    }

    /* ---------- Rules ---------- */

    addPoints(points, x, y) {
      if (!points) return;
      this.run.points += points;
      this.particles.label(x, y - 20, `+${points}`, "#ffd45c", 16);
    }

    spawn(type, x, y, options = {}, silent = false) {
      let settings = options;
      // Anything summoned during a boss fight stays in the arena.
      if (!silent && this.arena?.locked && !options.group) settings = { ...options, group: this.arena };
      const enemy = new MQ.Enemy(this, type, x, y, settings);
      this.enemies.push(enemy);
      if (!silent) {
        this.particles.ring(x, y - 40, 70, "#ff8a70", 0.4);
        this.particles.dust(x, y, "#9a8a7a", 8);
      }
      return enemy;
    }

    hurtPlayer(amount, fromX, knock) {
      return this.player.hurt(this.boss?.active ? amount * BOSS_FIGHT_DAMAGE : amount, fromX, knock);
    }

    enemyDefeated(enemy, lost) {
      this.run.kills++;
      this.addPoints(enemy.points, enemy.x, enemy.y - enemy.h);
      if (!lost && enemy.points && Math.random() < DROP_CHANCE) {
        const floor = this.col.floorBelow(enemy.x, enemy.y - 10, 400);
        if (floor < Infinity && !this.level.hazardAt(enemy.x, floor - 4)) {
          this.collectibles.drop(Math.random() < 0.72 ? "health" : "ammo", enemy.x, floor);
        }
      }
    }

    // A weapon swing. Returns true if it hit anything.
    melee(left, top, right, bottom, damage, kind, executeBelow) {
      let hit = false;
      const from = this.player.x;
      const struck = [];
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        const owner = t.owner || t;
        if (!t.hittable || struck.includes(owner) || !MQ.touches(t, left, top, right, bottom)) continue;
        // Walls block blades too.
        const middle = Math.min(Math.max(t.y - t.h / 2, top), bottom);
        if (!t.isBoss && !this.col.clearLine(from, this.player.y - 55, t.x, middle) && abs(t.x - from) > 45) continue;
        struck.push(owner);
        t.hurt(damage, from, 170, kind, executeBelow);
        this.particles.sparks(t.x, middle, kind === "saber" ? "#ffffff" : "#8ff7ff", 10);
        hit = true;
      }
      const solids = this.col.query(left, top, right, bottom).slice();
      for (const solid of solids) {
        if (!solid.hurt) continue;
        solid.hurt(damage, from, 0, kind);
        hit = true;
      }
      this.projectiles.cut(left, top, right, bottom);
      return hit;
    }

    blast(x, y, radius, damage, team) {
      this.particles.explosion(x, y, radius / 110);
      this.camera.shake(0.4);
      this.sfx("explosion");
      if (team !== PLAYER) {
        if (MQ.nearBody(this.player, x, y, radius * 0.8)) this.hurtPlayer(damage, x, 320);
        return;
      }
      const struck = [];
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        const owner = t.owner || t;
        if (!t.hittable || struck.includes(owner) || !MQ.nearBody(t, x, y, radius)) continue;
        struck.push(owner);
        const falloff = 1 - Math.min(0.5, hypot(t.x - x, t.y - t.h / 2 - y) / (radius * 4));
        t.hurt(damage * falloff, x, 320, "blast");
      }
      const solids = this.col.query(x - radius, y - radius, x + radius, y + radius).slice();
      for (const solid of solids) solid.hurt?.(damage, x, 0, "blast");
    }

    setCheckpoint(x, y, announce) {
      this.checkpointX = x;
      this.checkpointY = y;
      if (!announce) return;
      this.player.heal(this.player.maxHp * 0.25);
      this.particles.ring(x, y - 70, 90, "#6dff9a");
      this.sfx("checkpoint");
      this.hud.toast("CHECKPOINT", "Progress through this level secured");
    }

    fellIntoHazard(kind) {
      const { player } = this;
      if (player.dead || this.frozen) return;
      const color = kind === "lava" ? "#ff8a3d" : kind === "water" ? "#8ff0f0" : "#c8ff8a";
      this.particles.sparks(player.x, player.y - 20, color, 22, 400);
      this.rescueFromFall();
    }

    rescueFromFall() {
      const { player } = this;
      player.safeTime = 0;
      player.hurt(FALL_DAMAGE, player.x, 0);
      if (player.dead) return;
      player.recover(player.safeX, player.safeY);
      this.camera.snap(player);
      this.baby.snap();
    }

    rememberSafeSpot() {
      const { player, col, level } = this;
      if (!player.grounded || player.dead || player.sinking) return;
      if (player.ground && !player.ground.terrain) return;
      for (const side of [-28, 28]) {
        if (abs(col.floorBelow(player.x + side, player.y - 12, 40) - player.y) > 16) return;
      }
      if (level.hazardNear(player.x, player.y - 4, 36)) return;
      player.safeX = player.x;
      player.safeY = player.y;
    }

    rescueBaby(cell) {
      this.baby.join(cell.x, cell.y - 78);
      this.particles.ring(cell.x, cell.y - 80, 150, "#8fdcff", 0.8);
      this.sfx("unlock");
      this.banner("BABY G RESCUED");
      this.say("The Mandalorian", "The bounty didn't say it was a child. Contract cancelled. Stay close to me.");
    }

    darksaberUnlocked() {
      this.player.weapons.refresh();
      this.hud.banner("THE DARKSABER IS YOURS");
      this.hud.toast("SECRET WEAPON UNLOCKED", "Change Weapon to wield the Darksaber");
      this.sfx("saberOn");
      this.sfx("unlock");
    }

    /* ---------- Boss fights ---------- */

    startBoss(arena) {
      this.arena = arena;
      this.arenaBackground = MQ.Backgrounds.get(arena.scene);
      this.boss = MQ.createBoss(this, arena);
      this.boss.facePlayer();
      this.boss.updateParts();

      for (const e of this.enemies) {
        if (e.x > arena.x0 - 500 && e.x < arena.x1 + 500) e.remove = true;
      }
      this.projectiles.clear();
      this.setCheckpoint(arena.x0 + 130, arena.floor, false);
      if (arena.boss === "gideon") this.cageBaby();

      this.player.vx = 0;
      this.state = "bossIntro";
      this.stateTime = 0;
      this.hud.bossIntro(this.boss);
      this.services.audio.music(`boss${this.boss.sound}`);
      this.sfx(`bossIntro${this.boss.sound}`);
    }

    cageBaby() {
      this.baby.cage(this.arena.x0 + 130, this.arena.floor - 250);
    }

    updateBossIntro(dt) {
      const { boss, camera, arena } = this;
      const k = this.stateTime / INTRO_TIME;
      boss.introUpdate(dt, k);
      camera.focus = { x: boss.x, y: arena.floor - 190, zoom: 1.12 };
      if (k > 0.35 && k < 0.6) camera.shake(dt * 3);
      if (this.stateTime < INTRO_TIME) return;

      camera.focus = null;
      camera.setArena(arena);
      boss.active = true;
      boss.setState("idle");
      this.state = "play";
      this.hud.endBossIntro();
      if (arena.boss === "gideon") this.banner(boss.phaseNames[0]);
    }

    skipIntro() {
      if (this.state === "bossIntro" && this.stateTime > 0.5) this.stateTime = INTRO_TIME;
    }

    bossDefeated() {
      const { player, boss } = this;
      // A knockout at the same moment still counts as a win.
      if (player.dead) {
        player.dead = false;
        player.hp = 1;
      }
      player.sinking = false;
      this.state = "bossDown";
      this.stateTime = 0;
      this.run.kills++;
      this.addPoints(5000, boss.x, boss.y - 200);
      this.projectiles.clear();
      for (const e of this.enemies) e.die(false);
      this.baby.release();
      this.hud.endBossIntro();
      this.banner(this.arena.boss === "mythosaur" ? "THE LEGEND YIELDS" : `${boss.name} DEFEATED`);
      this.sfx("bossDown");
      this.camera.shake(1);
      this.level.activate("boss");
    }

    updateBossDown(dt) {
      const { player } = this;
      if (this.stateTime >= VICTORY_AT && !player.victory) {
        player.victory = true;
        player.facing = this.boss.x < player.x ? -1 : 1;
        this.baby.react("victory", 10);
        this.sfx("levelComplete");
        this.particles.ring(player.x, player.y - 50, 180, "#ffd45c", 0.8);
      }
      if (player.victory && Math.random() < dt * 14) {
        this.particles.sparks(player.x + (Math.random() - 0.5) * 220, player.y - 80 - Math.random() * 160, "#ffd45c", 6);
      }
      if (this.stateTime >= LEAVE_AT) this.end();
    }

    /* ---------- Ending an attempt ---------- */

    finish() {
      if (this.state !== "play") return;
      this.state = "exit";
      this.stateTime = 0;
      this.player.victory = true;
      this.baby.react("victory", 6);
      this.projectiles.clear();
      this.sfx("levelComplete");
      this.banner("OBJECTIVE COMPLETE");
    }

    end() {
      this.state = "over";
      this.services.onFinish(this);
    }

    playerDied() {
      this.run.lives--;
      this.stateTime = 0;
      this.baby.react("sad", 3);
    }

    updateDeath() {
      if (this.player.deadTime < RESPAWN_DELAY) return;
      if (this.run.lives > 0) {
        this.respawn();
      } else {
        this.state = "over";
        this.sfx("gameOver");
        this.services.onGameOver(this);
      }
    }

    respawn() {
      this.projectiles.clear();
      this.level.resetEncounters();
      if (this.boss && !this.boss.dead) {
        for (const e of this.enemies) {
          if (e.group === this.arena) e.remove = true;
        }
        this.boss.reset();
      }
      this.player.respawn(this.checkpointX, this.checkpointY);
      this.force.refill();
      if (!this.baby.caged) this.baby.snap();
      this.baby.mood = "idle";
      this.camera.snap(this.player);
      this.hud.toast("TRY AGAIN", `${this.run.lives} ${this.run.lives === 1 ? "life" : "lives"} remaining`);
    }

    get scoreSoFar() {
      return Math.round(this.run.points * this.difficulty.score);
    }

    /* ---------- Loop ---------- */

    update(input, dt) {
      if (this.state === "over") return;
      this.step++;
      this.time += dt;
      this.stateTime += dt;

      if (this.state === "bossIntro" && (input.held.jump || input.held.attack) && this.stateTime > 1) this.skipIntro();
      if (this.state === "play" && !this.player.dead) this.run.time += dt;

      const { player, enemies, boss, level } = this;
      this.collectTargets();
      level.updatePlatforms(dt, this.time);
      player.update(input, dt);
      this.force.update(dt);

      if (this.state === "play" || this.state === "bossDown") {
        for (let i = 0; i < enemies.length; i++) {
          if (!enemies[i].remove) enemies[i].update(dt);
        }
      }
      if (boss) {
        if (this.state === "bossIntro") this.updateBossIntro(dt);
        else boss.update(dt);
      }

      this.projectiles.update(dt);
      level.update(dt, this.time);
      this.collectibles.update(dt);
      this.baby.update(dt);
      this.particles.update(dt);

      let count = 0;
      for (let i = 0; i < enemies.length; i++) {
        if (!enemies[i].remove) enemies[count++] = enemies[i];
      }
      enemies.length = count;

      if (player.y > this.height + 90) {
        if (player.dead) player.y = this.height + 90;
        else if (this.frozen) player.recover(player.safeX, player.safeY);
        else this.rescueFromFall();
      }
      this.rememberSafeSpot();

      if (this.state === "bossDown") this.updateBossDown(dt);
      else if (this.state === "exit" && this.stateTime >= EXIT_DELAY) this.end();
      else if (player.dead) this.updateDeath();

      this.camera.update(player, dt);
      this.hud.update(dt);
    }

    collectTargets() {
      const { targets, enemies, boss, level } = this;
      targets.length = 0;
      for (let i = 0; i < enemies.length; i++) {
        if (!enemies[i].dead && abs(enemies[i].x - this.player.x) < 1500) targets.push(enemies[i]);
      }
      if (boss?.active) {
        for (let i = 0; i < boss.parts.length; i++) targets.push(boss.parts[i]);
      }
      for (let i = 0; i < level.targets.length; i++) {
        if (level.targets[i].hittable) targets.push(level.targets[i]);
      }
    }

    draw(ctx) {
      const { camera, level, time, boss } = this;
      const rise = this.height - (camera.y + camera.viewH);
      const background = this.arenaBackground || this.background;
      background.draw(ctx, camera.x, this.arena ? this.arena.floor - camera.y - camera.viewH * 0.82 : rise, time);

      ctx.save();
      camera.apply(ctx);
      level.drawBack(ctx, camera, time);
      this.collectibles.draw(ctx, camera, time);
      if (boss) boss.drawStrikes(ctx);
      if (boss) boss.draw(ctx);
      for (let i = 0; i < this.enemies.length; i++) this.enemies[i].draw(ctx);
      this.baby.draw(ctx);
      this.player.draw(ctx);
      this.force.draw(ctx);
      this.projectiles.draw(ctx, camera);
      level.drawFront(ctx, camera, time);
      this.particles.draw(ctx, camera);
      this.particles.drawLabels(ctx);
      ctx.restore();

      if (this.settings.effects === "high") background.drawFront(ctx, camera.x, time);
    }

    dispose() {
      this.level.dispose();
      this.projectiles.clear();
      this.targets.length = 0;
      this.enemies.length = 0;
    }
  }

  MQ.World = World;
})(window.MQ);
