/*
 * GameEngine owns the loop, the canvas and everything shared. GameStateManager
 * switches between the menu, cinematics and play. Campaign flow and the events
 * that levels and combat report back (kills, pickups, triggers) are handled here.
 */
(function (J) {
  const { clamp, rand, pick } = J.U;
  const W = J.VIEW_W;
  const H = J.VIEW_H;

  const DIFFICULTY = {
    padawan: { damage: 0.6, enemyHp: 0.85, bossHp: 0.8 },
    knight: { damage: 1, enemyHp: 1, bossHp: 1 },
    master: { damage: 1.4, enemyHp: 1.2, bossHp: 1.25 },
  };

  class GameStateManager {
    constructor(game) {
      this.game = game;
      this.name = null;
      this.cinematic = null;
    }

    menu() {
      this.name = "menu";
      this.cinematic = null;
    }

    play() {
      this.name = "play";
      this.cinematic = null;
    }

    cinema(cinematic) {
      this.name = "cinematic";
      this.cinematic = cinematic;
    }

    gameOver() { this.name = "over"; }
  }

  class GameEngine {
    constructor() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.stage = document.getElementById("stage");
      this.touchRoot = document.getElementById("touch");
      this.save = new J.SaveManager();
      this.audio = new J.AudioManager(this.save.options);
      this.input = new J.Input();
      this.camera = new J.Camera();
      this.camera.shakeEnabled = this.save.options.shake;
      this.particles = new J.ParticleSystem();
      this.projectiles = new J.ProjectilePool(this);
      this.hud = new J.HUD(this);
      this.ui = new J.UI(this);
      this.states = new GameStateManager(this);
      this.levels = new J.LevelManager(this);
      this.menuStars = new J.Starfield();
      this.jedi = J.JediCustomization.normalize(this.save.data.jedi);

      this.level = null;
      this.player = null;
      this.enemies = [];
      this.boss = null;
      this.bg = null;
      this.scene = null;
      this.paused = false;
      this.stats = this.freshStats();
      this.storyMode = false;
      this.levelIndex = 0;
      this.t = 0;
      this.lastTime = 0;
      this.stopT = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.flashT = 0;
      this.flashLength = 1;
      this.flashColor = "#fff";
      this.letterbox = 0;
      this.letterboxTarget = 0;
      this.bossCard = null;
      this.waves = null;
      this.tapped = false;
      this.scale = 1;

      this.input.bindTouch(() => this.pause());
      this.canvas.addEventListener("pointerdown", () => { this.tapped = true; });
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("orientationchange", () => this.resize());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          this.pause();
          this.audio.suspend();
        } else {
          this.audio.resume();
        }
      });
      // Browsers hold audio back until the first press or tap.
      const unlock = () => this.audio.unlock();
      window.addEventListener("pointerdown", unlock);
      window.addEventListener("keydown", unlock);
      this.touchQuery = window.matchMedia("(pointer: coarse)");
    }

    get difficulty() { return DIFFICULTY[this.save.options.difficulty] || DIFFICULTY.knight; }
    get damageScale() { return this.difficulty.damage; }

    get touchActive() {
      const { touch } = this.save.options;
      if (touch === "on") return true;
      if (touch === "off") return false;
      return this.touchQuery.matches;
    }

    freshStats() {
      return { score: 0, enemies: 0, crystals: 0, holocrons: 0, time: 0, deaths: 0, damageTaken: 0, perfects: 0, totalCrystals: 0, totalHolocrons: 0 };
    }

    start() {
      this.applyQuality();
      this.resize();
      this.states.menu();
      this.ui.showMain();
      this.audio.playMusic("menu");
      requestAnimationFrame((time) => this.loop(time));
    }

    // ---------- Screen ----------

    resize() {
      const app = document.getElementById("app");
      const availW = app.clientWidth;
      const availH = app.clientHeight;
      const scale = Math.min(availW / W, availH / H);
      const cssW = Math.floor(W * scale);
      const cssH = Math.floor(H * scale);
      this.stage.style.width = `${cssW}px`;
      this.stage.style.height = `${cssH}px`;
      const quality = this.save.options.quality;
      const dpr = quality === "low" ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
      this.scale = this.canvas.width / W;
      document.getElementById("ui").style.setProperty("--u", `${cssW / W}px`);
    }

    applyQuality() {
      this.particles.limit = this.save.options.quality === "low" ? 320 : 900;
      this.resize();
    }

    updateTouch() {
      this.touchRoot.hidden = !(this.touchActive && this.states.name === "play" && !this.paused);
    }

    // ---------- Jedi ----------

    setJedi(jedi) {
      this.jedi = J.JediCustomization.normalize(jedi);
      this.save.setJedi(this.jedi);
    }

    resetJedi() { this.jedi = J.JediCustomization.normalize(null); }

    // The first time through, players build their Jedi before anything else.
    requireJedi(then) {
      if (this.save.data.jedi) then();
      else this.ui.showCustomize(() => (this.save.data.jedi ? then() : this.ui.showMain()));
    }

    // ---------- Campaign flow ----------

    beginCampaign() {
      this.ui.close();
      this.storyMode = true;
      this.save.data.seenOpening = true;
      this.save.save();
      this.states.cinema(new J.Cinematics.Crawl(this, () => this.playLevel(0, true)));
    }

    grantAbilities(index) {
      let card = null;
      J.ABILITY_UNLOCKS.forEach((entry, i) => {
        if (i > index) return;
        const isNew = entry.ids.some((id) => !this.save.hasAbility(id));
        if (this.save.unlockAbilities(entry.ids) && isNew && i === index && i > 0) card = entry;
      });
      return card;
    }

    playLevel(index, story) {
      this.ui.close();
      this.storyMode = story;
      this.levelIndex = index;
      this.clearWorld();
      this.touchRoot.hidden = true;
      const card = this.grantAbilities(index);
      this.states.cinema(new J.Cinematics.LevelIntro(this, index, card, () => this.loadLevel(index)));
    }

    clearWorld() {
      this.audio.stopAllLoops();
      this.audio.stopHum();
      this.audio.stopAmbient();
      this.scene = null;
      this.paused = false;
      this.waves = null;
      this.vision = null;
      this.boss = null;
      this.bossCard = null;
      this.letterboxTarget = 0;
      this.letterbox = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.flashT = 0;
      this.finishing = false;
      this.exitT = 0;
      this.bossEnd = null;
    }

    loadLevel(index) {
      this.clearWorld();
      this.level = this.levels.build(index);
      const { level } = this;
      this.player = new J.Player(this, this.jedi);
      this.player.placeAt(level.spawn.x, level.spawn.y);
      this.enemies = level.spawns.map((s) => new J.Enemy(this, s.type, s.x, s.y, s.opts));
      this.projectiles.clear();
      this.particles.clear();
      this.bg = new J.Background(level.def.theme);
      this.stats = this.freshStats();
      this.stats.totalCrystals = level.totalCrystals;
      this.stats.totalHolocrons = level.totalHolocrons;
      const { camera } = this;
      camera.lock = null;
      camera.bounds = { left: 0, right: level.width, top: level.top, bottom: level.bottom };
      camera.floorAt = (x) => level.floorAt(x);
      camera.snap(this.player);
      this.hud.reset();
      this.hud.shownHp = this.player.hp;
      this.audio.playMusic(level.def.music);
      this.audio.playAmbient(level.def.theme);
      this.audio.play("saberOn");
      this.audio.startHum();
      this.player.saber.power = 0;
      this.states.play();
      this.updateTouch();
    }

    restartLevel() {
      this.ui.close();
      this.loadLevel(this.levelIndex);
    }

    toMenu() {
      this.clearWorld();
      this.level = null;
      this.player = null;
      this.enemies = [];
      this.projectiles.clear();
      this.states.menu();
      this.updateTouch();
      this.audio.playMusic("menu");
      this.ui.showMain();
    }

    pause() {
      if (this.states.name !== "play" || this.paused) return;
      this.paused = true;
      this.input.releaseAll();
      this.updateTouch();
      this.ui.showPause();
    }

    resume() {
      this.ui.close();
      this.paused = false;
      // The Esc press that closed the menu must not reopen it on the next frame.
      this.input.endFrame();
      this.updateTouch();
    }

    // ---------- Events from the world ----------

    hitStop(seconds) { this.stopT = Math.max(this.stopT, seconds); }

    slowMo(scale, seconds) {
      this.timeScale = scale;
      this.slowT = seconds;
    }

    flash(color, seconds) {
      this.flashColor = color;
      this.flashT = seconds;
      this.flashLength = seconds;
    }

    addScore(points) { this.stats.score += points; }

    collect(p) {
      switch (p.kind) {
        case "crystal":
          this.stats.crystals++;
          this.addScore(25);
          this.audio.play("crystal");
          this.particles.sparks(p.x, p.y, "#a6e6ff", 5, 110);
          break;
        case "holocron":
          this.stats.holocrons++;
          this.addScore(500);
          this.audio.play("holocron");
          this.hud.toast(`HOLOCRON FOUND ${this.stats.holocrons}/${this.level.totalHolocrons}`);
          this.particles.forceRing(p.x, p.y, "#ffd76a", 50);
          break;
        case "bacta":
          this.player.heal(35);
          this.audio.play("heal");
          this.particles.text(p.x, p.y - 8, "+HEALTH", "#6ef2a4", 13);
          break;
        default:
          this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 45);
          this.audio.play("heal");
          this.particles.text(p.x, p.y - 8, "+FORCE", "#c79aff", 13);
      }
    }

    spawnPickup(kind, x, y) {
      const size = 18;
      const floor = this.level.groundBelow(x, y + 30);
      const py = floor ? floor.y - 30 : y;
      this.level.pickups.push({ kind, x: x - size / 2, y: py, w: size, h: size, taken: false });
    }

    spawnEnemy(type, x, y, opts = {}) {
      const enemy = new J.Enemy(this, type, x, y, { left: x - 140, right: x + 140, ...opts });
      enemy.dormant = false;
      enemy.state = "engage";
      this.enemies.push(enemy);
      return enemy;
    }

    onEnemyKilled(enemy, fell) {
      this.stats.enemies++;
      const bonus = fell ? 1.5 : 1;
      const points = Math.round(enemy.config.score * bonus);
      this.addScore(points);
      this.particles.text(enemy.x, enemy.y - enemy.h - 6, fell ? `KNOCKED OUT +${points}` : `+${points}`, fell ? "#ffe680" : "#fff", 13);
      if (!enemy.noDrop && !fell) {
        const roll = Math.random();
        if (roll < 0.14) this.spawnPickup("bacta", enemy.x, enemy.y - 20);
        else if (roll < 0.3) this.spawnPickup("force", enemy.x, enemy.y - 20);
      }
    }

    onCheckpoint() {
      this.audio.play("checkpoint");
      this.hud.toast("CHECKPOINT");
      this.player.heal(30);
      this.addScore(100);
    }

    tipText(tip) {
      if (!this.touchActive) return tip.text;
      return tip.text
        .replace("Move with A / D or the Arrow keys.", "Move with the arrow buttons.")
        .replace("Press Space", "Tap JUMP")
        .replace("Press J", "Tap SABER")
        .replace("with K", "with PUSH")
        .replace("Hold L", "Hold DEFLECT");
    }

    fireTrigger(trigger) {
      if (trigger.type === "arena") this.startWaves(trigger);
      else if (trigger.type === "boss") this.startBoss(trigger);
      else if (trigger.type === "vision") this.startVision(trigger);
    }

    startWaves(trigger) {
      trigger.walls.forEach((wall) => { wall.active = true; });
      this.waves = { trigger, index: 0, delay: 0.3 };
      this.audio.play("door");
      this.hud.toast("ENEMIES INCOMING");
    }

    updateWaves(dt) {
      const w = this.waves;
      if (!w) return;
      if (this.enemies.some((e) => e.wave === w.trigger && !e.dead)) return;
      w.delay -= dt;
      if (w.delay > 0) return;
      const list = w.trigger.waves[w.index];
      if (!list) {
        w.trigger.walls.forEach((wall) => { wall.active = false; });
        this.waves = null;
        this.audio.play("door");
        this.hud.toast("AREA CLEAR");
        this.addScore(300);
        return;
      }
      list.forEach((type, i) => {
        const fromLeft = i % 2 === 1;
        const x = (fromLeft ? w.trigger.spawnLeft : w.trigger.spawnRight) + (fromLeft ? 1 : -1) * (i * 34);
        this.spawnEnemy(type, x, w.trigger.y, { wave: w.trigger, alwaysActive: true });
        this.particles.forceRing(x, w.trigger.y - 34, this.level.theme.accent, 40);
      });
      this.audio.play("switch");
      w.index++;
      w.delay = 1;
    }

    startVision(trigger) {
      const { player } = this;
      trigger.walls.forEach((wall) => { wall.active = true; });
      player.frozen = true;
      this.letterboxTarget = 1;
      this.flash("#000000", 0.8);
      this.audio.play("bossIntro");
      this.scene = new J.Cinematics.DialogueScene(this, J.VISION_LINES, () => {
        player.frozen = false;
        this.letterboxTarget = 0;
        const shadowJedi = { ...this.jedi, palette: 2, outfit: 4 };
        const enemy = this.spawnEnemy("shadow", trigger.x0, trigger.y, { jedi: shadowJedi, alwaysActive: true, noDrop: true });
        this.particles.forceRing(enemy.x, enemy.y - 34, "#ff3a4a", 80);
        this.audio.play("saberOn");
        this.vision = { trigger, enemy };
      });
    }

    updateVision() {
      const v = this.vision;
      if (!v || !v.enemy.dead) return;
      this.vision = null;
      v.trigger.walls.forEach((wall) => { wall.active = false; });
      this.player.heal(40);
      this.player.frozen = true;
      this.scene = new J.Cinematics.DialogueScene(this, J.VISION_END, () => { this.player.frozen = false; });
    }

    startBoss(trigger) {
      const { arena } = trigger;
      const def = J.BOSS_DEFS[trigger.boss];
      const { player, camera } = this;
      trigger.wall.active = true;
      this.bossTrigger = trigger;
      camera.lock = { x: arena.left, y: arena.floor + 176 - H };
      camera.bounds.left = arena.left;
      camera.bounds.right = arena.right;
      this.boss = J.createBoss(this, trigger.boss, arena.right - 200, arena.floor, arena);
      this.boss.y = this.boss.def.id === "palpatine" ? this.boss.y : arena.floor;
      player.frozen = true;
      player.facing = 1;
      this.letterboxTarget = 1;
      this.audio.stopMusic();
      this.audio.play("bossIntro");
      this.audio.play(def.sting);
      this.bossCard = { name: def.name, title: def.title, t: 0 };

      const begin = () => {
        player.frozen = false;
        this.letterboxTarget = 0;
        this.bossCard = null;
        this.boss.begin();
        this.audio.playMusic(def.music);
        this.audio.play("saberOn");
      };
      // A retry goes straight back into the fight.
      const lines = trigger.seen ? [def.intro[def.intro.length - 1]] : def.intro;
      trigger.seen = true;
      this.scene = new J.Cinematics.DialogueScene(this, lines, begin);
    }

    onBossDefeated(boss) {
      const { player } = this;
      this.projectiles.clearHostile();
      this.enemies.forEach((enemy) => {
        if (enemy.wave === "emperor" && !enemy.dead) enemy.kill(0);
      });
      this.addScore(5000);
      this.audio.stopMusic();
      this.audio.play("bossDown");
      this.camera.shake(12, 0.8);
      this.slowMo(0.3, 1.1);
      this.flash("#ffffff", 0.5);
      this.particles.explosion(boss.x, boss.y - 40, 1.4);
      boss.downT = 0;
      player.frozen = true;
      player.choke = null;
      player.invuln = 99;
      this.bossEnd = { boss, t: 0, phase: 0 };
      this.letterboxTarget = 1;
    }

    updateBossEnd(dt) {
      const end = this.bossEnd;
      if (!end) return;
      const { boss } = end;
      const { player } = this;
      end.t += dt;
      boss.downT += dt;
      if (boss.id === "palpatine") {
        // The reflected storm burns him away.
        if (Math.random() < 0.7) this.particles.spawn(boss.x + rand(-18, 18), boss.y - rand(0, 70), rand(-50, 50), rand(-160, -40), 0.8, rand(2, 4), pick(["#9fd8ff", "#ffffff", "#c8a0ff"]), { glow: true });
        this.camera.shake(5, 0.1);
      }
      if (end.phase === 0 && end.t > 1.6) {
        end.phase = 1;
        player.scriptPose = "victory";
        player.scriptT = 0;
        player.facing = Math.sign(boss.x - player.x) || 1;
        this.audio.play("victory");
        this.scene = new J.Cinematics.DialogueScene(this, boss.def.outro, () => { end.phase = 2; end.t = 0; });
      }
      if (end.phase >= 1) player.scriptT = clamp((player.scriptT || 0) + dt, 0, 1);
      if (end.phase === 2) {
        if (boss.id === "palpatine" && !end.burned) {
          end.burned = true;
          this.flash("#ffffff", 1.6);
          this.audio.play("explosion");
          this.particles.explosion(boss.x, boss.y - 40, 2.4);
          boss.hiddenForever = true;
          boss.hidden = true;
        }
        if (end.t > (boss.id === "palpatine" ? 1.8 : 0.6)) {
          this.bossEnd = null;
          this.completeLevel();
        }
      }
    }

    onExitReached() {
      if (this.finishing) return;
      this.finishing = true;
      const { player } = this;
      player.frozen = true;
      this.audio.play("victory");
      this.addScore(300);
      this.exitT = 0.9;
    }

    completeLevel() {
      if (this.states.name !== "play") return;
      const { stats } = this;
      const index = this.levelIndex;
      stats.score += Math.max(0, 3000 - Math.floor(stats.time) * 8);
      stats.score += stats.holocrons * 500;
      if (stats.deaths === 0) stats.score += 1500;
      this.save.completeLevel(index, { ...stats }, J.LEVELS.length);
      this.audio.stopHum();
      this.audio.stopAmbient();
      this.audio.stopAllLoops();
      this.input.releaseAll();
      this.touchRoot.hidden = true;
      if (index === J.LEVELS.length - 1) {
        this.states.cinema(new J.Cinematics.Ending(this, () => {
          this.states.menu();
          this.level = null;
          this.player = null;
          this.ui.showComplete(stats, index);
        }));
        return;
      }
      this.audio.playMusic("menu");
      this.states.gameOver();
      this.ui.showComplete(stats, index);
    }

    // Lost a life: back to the checkpoint, or to the corner of a boss arena.
    onPlayerDeathFinished() {
      const { player } = this;
      if (player.lives <= 1) {
        player.lives = 0;
        this.audio.stopHum();
        this.audio.stopAllLoops();
        this.audio.stopMusic();
        this.audio.play("defeat");
        this.input.releaseAll();
        this.touchRoot.hidden = true;
        this.states.gameOver();
        this.ui.showGameOver();
        return;
      }
      player.lives--;
      this.projectiles.clearHostile();
      this.audio.stopLoop("bossBeam");
      if (this.boss) {
        const { arena } = this.boss;
        this.boss.regroup();
        player.respawn({ x: arena.left + 110, y: arena.floor });
        return;
      }
      this.returnToCheckpoint();
    }

    returnToCheckpoint() {
      const { player } = this;
      if (this.boss) this.resetBossFight();
      if (this.waves) this.resetWaves();
      if (this.vision) this.resetVision();
      player.respawn(this.level.checkpoint);
      this.camera.snap(player);
    }

    // Game Over's gentler choice: three fresh lives at the last checkpoint.
    continueFromCheckpoint() {
      const { player } = this;
      this.ui.close();
      this.states.play();
      player.lives = 3;
      this.stats.score = Math.floor(this.stats.score / 2);
      this.projectiles.clearHostile();
      this.returnToCheckpoint();
      this.audio.playMusic(this.level.def.music);
      this.audio.startHum();
      this.updateTouch();
    }

    resetBossFight() {
      const trigger = this.bossTrigger;
      trigger.wall.active = false;
      trigger.fired = false;
      this.enemies = this.enemies.filter((e) => e.wave !== "emperor");
      this.boss = null;
      this.camera.lock = null;
      this.camera.bounds.left = 0;
      this.camera.bounds.right = this.level.width;
      this.level.alarm = 0;
      this.audio.playMusic(this.level.def.music);
    }

    resetWaves() {
      const { trigger } = this.waves;
      trigger.walls.forEach((wall) => { wall.active = false; });
      trigger.fired = false;
      this.enemies = this.enemies.filter((e) => e.wave !== trigger);
      this.waves = null;
    }

    resetVision() {
      const { trigger, enemy } = this.vision;
      trigger.walls.forEach((wall) => { wall.active = false; });
      trigger.fired = false;
      this.enemies = this.enemies.filter((e) => e !== enemy);
      this.vision = null;
    }

    // ---------- Loop ----------

    loop(time) {
      requestAnimationFrame((next) => this.loop(next));
      let dt = (time - this.lastTime) / 1000;
      this.lastTime = time;
      if (!(dt > 0)) return;
      dt = Math.min(dt, 1 / 20);
      this.frame(dt);
    }

    frame(dt) {
      // Split long frames so a slow device still moves in small steps.
      const steps = Math.ceil(dt / (1 / 60) - 0.01);
      const step = dt / steps;
      for (let i = 0; i < steps; i++) {
        this.update(step);
        if (i === 0) this.input.endFrame();
      }
      this.tapped = false;
      this.render();
    }

    update(dt) {
      this.t += dt;
      const { name, cinematic } = this.states;
      if (name === "cinematic") {
        cinematic.update(dt);
        return;
      }
      if (name !== "play" || this.paused) return;
      if (this.input.pressed("pause") && !this.scene) {
        this.pause();
        return;
      }
      this.updatePlay(dt);
    }

    updatePlay(dt) {
      const { player, level, camera } = this;
      this.letterbox += (this.letterboxTarget - this.letterbox) * Math.min(1, dt * 6);
      this.flashT = Math.max(0, this.flashT - dt);
      this.hud.update(dt);
      this.bg.update(dt);
      if (this.exitT > 0) {
        this.exitT -= dt;
        if (this.exitT <= 0) {
          this.completeLevel();
          return;
        }
      }
      this.bg.alarm = level.alarm;
      if (player.saber.power < 1) player.saber.power = Math.min(1, player.saber.power + dt * 3.4);
      if (this.bossCard) this.bossCard.t += dt;

      if (this.scene) {
        this.scene.update(dt);
        this.particles.update(dt);
        camera.follow(player, dt);
        if (this.boss) this.boss.animT += dt;
        this.updateBossEnd(dt);
        return;
      }

      if (this.stopT > 0) {
        this.stopT -= dt;
        camera.follow(player, dt);
        return;
      }

      let sim = dt;
      if (this.slowT > 0) {
        this.slowT -= dt;
        sim = dt * this.timeScale;
      }

      this.stats.time += sim;
      level.update(sim, this);
      player.update(sim, this.input);
      for (const enemy of this.enemies) enemy.update(sim);
      if (this.enemies.length > 60) this.enemies = this.enemies.filter((e) => !e.gone);
      if (this.boss) this.boss.update(sim);
      this.projectiles.update(sim);
      this.particles.update(sim);
      this.updateWaves(sim);
      this.updateVision();
      this.updateBossEnd(sim);
      camera.follow(player, dt);
    }

    render() {
      const { ctx } = this;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      const { name, cinematic } = this.states;
      if (name === "cinematic") {
        cinematic.draw(ctx);
      } else if ((name === "play" || name === "over") && this.level) {
        this.renderWorld(ctx);
      } else {
        this.renderMenu(ctx);
      }
    }

    renderWorld(ctx) {
      const { camera, level, player, boss } = this;
      const { t } = this;
      const cx = camera.viewX;
      const cy = camera.viewY;
      this.bg.drawLayers(ctx, cx, cy, level.baseY - H * 0.68, t);

      ctx.save();
      ctx.translate(-cx, -cy);
      const view = { x: cx, y: cy };
      level.drawBack(ctx, view, t);
      for (const enemy of this.enemies) enemy.draw(ctx, t);
      if (boss && !boss.hiddenForever) boss.draw(ctx, t);
      player.draw(ctx, t);
      this.projectiles.draw(ctx, t);
      this.particles.draw(ctx);
      level.drawFront(ctx, view);
      ctx.restore();

      this.bg.drawWeather(ctx, t, this.save.options.quality);

      if (this.letterbox > 0.01) {
        const bar = this.letterbox * 58;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, bar);
        ctx.fillRect(0, H - bar, W, bar);
      }
      if (this.bossCard) J.Cinematics.drawBossCard(ctx, this.bossCard.name, this.bossCard.title, this.bossCard.t);
      if (this.flashT > 0) {
        ctx.globalAlpha = clamp(this.flashT / this.flashLength, 0, 1);
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (this.scene) this.scene.draw(ctx);
      else this.hud.draw(ctx, t);
    }

    renderMenu(ctx) {
      const { t } = this;
      this.menuStars.draw(ctx, t);
      J.drawPlanet(ctx, 790, 430, 230, J.Cinematics.PLANETS.tatooine, t);
      this.drawLogo(ctx, t);
    }

    drawLogo(ctx, t) {
      if (this.ui.screen && !this.ui.screen.querySelector(".logo-spacer")) return;
      ctx.textAlign = "center";
      ctx.font = `800 84px ${J.FONT}`;
      ctx.lineJoin = "round";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#ffd76a";
      ctx.strokeText("JEDI STORY", W / 2, 116);
      ctx.fillStyle = "#05060f";
      ctx.fillText("JEDI STORY", W / 2, 116);
      if (!this.logoSaber) this.logoSaber = new J.Lightsaber("blue", "single");
      const s = this.logoSaber;
      s.length = 440;
      s.draw(ctx, 250, 142, Math.PI / 2, t);
    }
  }

  J.GameEngine = GameEngine;
  J.GameStateManager = GameStateManager;
})(window.JEDI);
