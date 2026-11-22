/*
 * One attempt at a space stage: the scrolling, the rules, and the order it all runs in.
 * GameStateManager runs it in place of World for levels with mode "space".
 */
(function (MQ) {
  const S = MQ.SPACE;
  const D = MQ.DATA;
  const { approach } = MQ.U;
  const { sin, max, min, round } = Math;

  const START_SPEED = 170;
  const BOSS_SPEED = 110;
  const VICTORY_SPEED = 900;
  const START_TIME = 2.2; // Before enemies may fire.
  const CLEAR_LIMIT = 5; // Longest wait for the field to empty before a boss.
  const COMPLETE_AT = 3.2;
  const LEAVE_AT = 6.8;

  class SpaceLevelManager {
    /* services are the same as World's. */
    constructor(def, services) {
      this.mode = "space";
      this.def = def;
      this.services = services;
      this.save = services.saveManager.data;
      this.settings = this.save.settings;
      this.stats = { ...services.progression.stats.ship };
      // Fixed at the start, so switching mid-stage can't raise a score or keep upgrades.
      this.difficultyId = this.settings.difficulty;
      this.difficulty = D.DIFFICULTY[this.difficultyId];
      this.firstVisit = !this.save.cleared[def.id - 1];

      this.tier = def.tier;
      this.aggression = S.AGGRESSION[this.difficultyId] * (0.9 + this.tier * 0.1);
      this.shotPace = 0.9 + this.tier * 0.07;
      this.enemyPace = 0.92 + this.tier * 0.08;
      this.enemyHealth = 0.85 + this.tier * 0.15;
      this.bossHealth = this.difficultyId === "story" ? 0.8 : 1;
      this.threat = 0.95 + this.tier * 0.22; // Damage, rising through the campaign.

      this.state = "play";
      this.stateTime = 0;
      this.time = 0;
      this.scroll = 0;
      this.speed = this.targetSpeed = START_SPEED;
      this.run = { time: 0, points: 0, kills: 0, lives: D.LIVES, multiplier: this.difficulty.score, capsules: 0, upgrades: 0 };
      this.boss = null;
      this.miniBoss = null;
      this.victory = false;
      // GameStateManager sets shakeEnabled when the option changes.
      this.camera = { shakeEnabled: this.settings.shake, trauma: 0, sees: () => true };

      this.particles = new MQ.SpaceParticleSystem(this.settings.effects);
      this.projectiles = new MQ.SpaceProjectiles(this);
      this.enemies = new MQ.SpaceEnemyPool(this);
      this.obstacles = new MQ.SpaceObstaclePool(this);
      this.powerUps = new MQ.SpacePowerUps(this);
      this.collision = new MQ.SpaceCollisionManager(this);
      this.player = new MQ.SpacePlayer(this);
      this.waves = new MQ.SpaceWaveManager(this, def);
      this.ui = services.spaceUI;
      this.ui.reset();
      this.ui.title(`LEVEL ${def.id}  ·  ${def.planet.toUpperCase()}`, def.title);

      services.audio.music(`level${def.id}`);
    }

    get look() {
      return this.services.customization.look;
    }

    get frozen() {
      return this.state === "victory" || this.state === "over";
    }

    // The player can't be hurt.
    get protected() {
      return this.state === "bossIntro" || this.frozen;
    }

    // Enemies may fire.
    get hostile() {
      return this.time > START_TIME && !this.protected && this.state !== "approach";
    }

    get progress() {
      return this.boss ? 1 : this.waves.progress;
    }

    get scoreSoFar() {
      return round(this.run.points * this.difficulty.score);
    }

    /* ---------- Messages ---------- */

    sfx(name) {
      this.services.audio.sfx(name);
    }

    shake(amount) {
      if (this.camera.shakeEnabled) this.camera.trauma = min(1, this.camera.trauma + amount);
    }

    banner(text) {
      this.ui.banner(text);
    }

    say(who, text) {
      this.ui.say(who, text);
      this.sfx("transmission");
    }

    hint(text, touch) {
      if (this.settings.hints && this.firstVisit) this.ui.hint(text, touch);
    }

    /* ---------- Rules ---------- */

    addPoints(points, x, y) {
      this.run.points += points;
      if (x !== undefined) this.particles.label(x, y - 30, `+${points}`, "#ffd45c", 16);
    }

    enemyDestroyed(enemy) {
      const { def } = enemy;
      this.run.kills++;
      if (def.heavy) this.addPoints(def.points, enemy.x, enemy.y);
      else this.addPoints(def.points);

      const { CAPSULE, HEALTH } = MQ.SpacePowerUps;
      const x = min(MQ.VW - 40, enemy.x);
      if (enemy.capsule || Math.random() < (def.drop ?? S.PICKUPS.chance)) this.powerUps.drop(CAPSULE, x, enemy.y);
      else if (Math.random() < S.PICKUPS.healthChance) this.powerUps.drop(HEALTH, x, enemy.y);
      if (def.heavy && enemy.rx > 100) this.player.react("happy", 2);
    }

    eliteArrived(ship) {
      this.miniBoss = ship;
      this.banner(ship.boss);
      this.sfx("enemyWarn");
      this.player.react("worried", 2);
    }

    eliteGone() {
      if (this.miniBoss && this.miniBoss.hp <= 0) {
        this.banner("TARGET DESTROYED");
        this.player.react("happy", 2);
      }
      this.miniBoss = null;
    }

    collect(kind, x, y) {
      const { player, particles } = this;
      if (kind === MQ.SpacePowerUps.HEALTH) {
        const gained = player.heal(S.PICKUPS.health);
        if (gained) particles.label(x, y - 30, `+${gained} HULL`, "#5dff9a");
        else this.addPoints(100, x, y);
        particles.ring(x, y, 70, "#5dff9a", 0.35);
        this.sfx("pickup");
        player.react("happy", 1.2);
        return;
      }
      this.run.capsules++;
      particles.ring(x, y, 80, "#ffc84d", 0.4);
      particles.sparks(x, y, "#ffd45c", 14, 300);
      this.sfx("capsule");
      player.react("happy", 1.2);
      if (player.weapons.collectCapsule()) {
        particles.label(x, y - 30, player.weapons.highlighted.name.toUpperCase(), "#ffd45c", 16);
        if (this.run.capsules === 1) this.hint("Press L to install the highlighted upgrade, or collect more capsules for a later one.", "Tap Upgrade to install the highlighted upgrade, or collect more capsules for a later one.");
      } else {
        this.addPoints(S.PICKUPS.fullBonus, x, y);
      }
    }

    activateUpgrade() {
      const { player, particles } = this;
      const upgrade = player.weapons.activate();
      if (!upgrade) return;
      this.run.upgrades++;
      const level = player.weapons.levels[upgrade.id];
      this.ui.installed(upgrade, upgrade.max > 1 ? level : 0);
      particles.ring(player.x, player.y, 130, upgrade.color, 0.5);
      particles.sparks(player.x, player.y, upgrade.color, 24, 420);
      this.sfx("upgrade");
      player.react("happy", 1.5);
    }

    playerDied() {
      this.run.lives--;
      this.projectiles.clearEnemy(true);
      if (this.boss && this.boss.state !== "intro") {
        this.boss.cancelAttack();
        this.boss.setState("rest");
      }
    }

    updateDeath() {
      const { player } = this;
      if (player.deadTime < S.SHIP.respawnDelay) return;
      if (this.run.lives > 0) {
        this.projectiles.clearEnemy();
        player.respawn();
        this.particles.ring(player.x, player.y, 160, "#8fe6ff", 0.6);
        this.sfx("shipRespawn");
        this.ui.toast("SHIP RESTORED", `${this.run.lives} ${this.run.lives === 1 ? "life" : "lives"} remaining`);
      } else {
        this.state = "over";
        this.sfx("gameOver");
        this.services.onGameOver(this);
      }
    }

    /* ---------- The boss ---------- */

    approachBoss() {
      this.state = "approach";
      this.stateTime = 0;
    }

    startBoss() {
      this.state = "bossIntro";
      this.stateTime = 0;
      this.enemies.clear();
      this.obstacles.clear();
      this.projectiles.clearEnemy();
      this.targetSpeed = BOSS_SPEED;
      this.boss = MQ.createSpaceBoss(this, this.def.bossKind);
      this.ui.bossWarning(this.def.boss);
      this.player.react("worried", 3);
      this.services.audio.music(`boss${this.boss.spec.sound}`);
      this.sfx(`bossIntro${this.boss.spec.sound}`);
    }

    skipIntro() {
      if (this.state === "bossIntro") this.boss.skipIntro();
    }

    bossReady() {
      this.state = "boss";
      this.ui.endBossWarning();
      this.ui.toast("DESTROY", this.def.bossHint);
    }

    bossDefeated() {
      const { player, boss } = this;
      // A knockout at the same moment still counts as a win.
      if (player.dead) {
        player.dead = false;
        player.hp = 1;
      }
      this.state = "victory";
      this.stateTime = 0;
      this.run.kills++;
      this.addPoints(5000, boss.core.x, boss.core.y);
      this.projectiles.clearEnemy(true);
      this.enemies.destroyAll();
      this.banner(`${boss.name} DESTROYED`);
      this.particles.explosion(boss.core.x, boss.core.y, 2.4);
      this.sfx("bossDown");
      this.shake(1);
    }

    updateVictory() {
      if (!this.victory && this.stateTime >= COMPLETE_AT) {
        this.victory = true;
        this.targetSpeed = VICTORY_SPEED;
        this.banner(this.def.victory.toUpperCase());
        this.sfx("spaceComplete");
        this.particles.ring(this.player.x, this.player.y, 200, "#ffd45c", 0.8);
      }
      if (this.stateTime >= LEAVE_AT) {
        this.state = "over";
        this.services.onFinish(this);
      }
    }

    /* ---------- Loop ---------- */

    update(input, dt) {
      if (this.state === "over") return;
      this.time += dt;
      this.stateTime += dt;
      if (!this.frozen && !this.player.dead) this.run.time += dt;
      this.speed = approach(this.speed, this.targetSpeed, (this.victory ? 700 : 160) * dt);
      this.scroll += this.speed * dt;
      this.camera.trauma = max(0, this.camera.trauma - dt * 1.6);

      if (this.state === "bossIntro" && (input.held.jump || input.held.attack) && this.stateTime > 1.2) this.skipIntro();
      if (this.state === "play") this.waves.update(dt);

      this.collision.gather();
      this.player.update(input, dt);
      this.enemies.update(dt);
      this.obstacles.update(dt);
      this.boss?.update(dt);
      this.projectiles.update(dt);
      if (!this.frozen) this.collision.update();
      this.powerUps.update(dt);
      this.particles.update(dt);

      if (this.state === "approach" && (this.stateTime >= CLEAR_LIMIT || (!this.enemies.count() && !this.obstacles.any()))) this.startBoss();
      else if (this.state === "victory") this.updateVictory();
      else if (this.player.dead) this.updateDeath();
      this.ui.update(dt);
    }

    draw(ctx) {
      const { time, camera } = this;
      const power = camera.trauma * camera.trauma;
      ctx.save();
      MQ.SpaceBackground.get(this.def.backdrop).draw(ctx, this.scroll, time, {
        progress: this.progress,
        low: this.settings.effects === "low",
        warp: max(0, (this.speed - 420) / (VICTORY_SPEED - 420)),
      });
      if (power) ctx.translate(sin(time * 61) * 14 * power, sin(time * 47 + 2) * 11 * power);
      this.obstacles.draw(ctx, time);
      this.powerUps.draw(ctx, time);
      this.boss?.draw(ctx, time);
      this.enemies.draw(ctx, time);
      this.player.draw(ctx);
      this.projectiles.draw(ctx, time);
      this.particles.draw(ctx, camera);
      this.particles.drawLabels(ctx);
      ctx.restore();
    }

    drawHud(ctx) {
      this.ui.draw(ctx, this);
    }

    dispose() {
      this.projectiles.clear();
      this.enemies.clear();
      this.obstacles.clear();
      this.powerUps.clear();
      this.ui.reset();
    }
  }

  MQ.SpaceLevelManager = SpaceLevelManager;
})(window.MQ);
