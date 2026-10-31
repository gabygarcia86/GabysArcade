/*
 * GameManager runs the game: the main loop, the flow between states and the rules that
 * tie the other systems together.
 *
 *   menu      any menu screen, over the attract animation
 *   ready     level intro or respawn, nothing moves
 *   play      normal play
 *   defeat    short freeze after an enemy is defeated
 *   dying     the droid was caught
 *   clear     victory dance
 *   galaxy    the celebration after Level 10
 *   gameover  no lives left
 *
 * Logic runs on a fixed 120 Hz step, so speed doesn't depend on the display's refresh
 * rate, and nothing can move far enough in one step to skip past a collision.
 */
(function (D) {
  const STEP = 1 / 120;
  const MAX_STEPS = 12;
  const READY_TIME = 2.2;
  const RESPAWN_TIME = 1.5;
  const DEFEAT_FREEZE = 0.45;
  const DYING_TIME = 1.9;
  const CLEAR_TIME = 5.2;
  const GALAXY_TIME = 12;
  const SPRITE_SCALE = 1.62;
  const MAX_DPR = 2;
  const UNLOCK_B1_LEVEL = 5;
  const { POINTS } = D.ScoreManager;
  const COLORS = Object.fromEntries(D.ENEMIES.map((enemy) => [enemy.id, enemy.color]));

  class GameManager {
    constructor() {
      this.canvas = document.getElementById("game");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.save = new D.SaveData();
      if (this.save.data.droid === "b1" && !this.save.data.unlockedB1) this.save.data.droid = "r2d2";

      this.audio = new D.AudioManager(this.save.options);
      this.input = new D.InputManager();
      this.levels = new D.LevelManager();
      this.score = new D.ScoreManager(this.save);
      this.collision = new D.CollisionManager();
      this.anim = new D.AnimationManager();
      this.sprites = new D.Sprites();
      this.art = new D.ThemeArt();
      this.director = new D.EnemyAI.EnemyDirector();
      this.player = new D.Player();
      this.enemyIds = D.ENEMY_IDS;
      this.enemies = D.ENEMY_IDS.map((id) => new D.Enemy(id));
      this.galaxyCast = [...D.DROIDS, ...D.ENEMIES].map((droid) => droid.id);
      this.ui = new D.UIManager(this);
      this.renderer = new D.GameRenderer(this);

      this.state = "menu";
      this.stateTime = 0;
      this.clock = 0;
      this.paused = false;
      this.maze = null;
      this.tuning = null;
      this.powerLeft = 0;
      this.confettiLeft = 0;
      this.showLevelName = false;
      this.dancers = [];
      this.view = { W: 1, H: 1, dpr: 1, tile: 20, boardX: 0, boardY: 0, boardW: 420, boardH: 460 };
      this.last = 0;
      this.accumulator = 0;
      this.frame = this.frame.bind(this);

      this.bindEvents();
    }

    get droidId() { return this.save.data.droid; }

    enemyColor(enemy) { return COLORS[enemy.id]; }

    bindEvents() {
      const { input, ui, audio } = this;
      input.onPress = (dir) => {
        if (ui.open || (!ui.banner.hidden && this.state === "galaxy")) ui.moveFocus(dir);
        else if (this.player.maze && !this.paused) this.player.press(dir);
      };
      input.onPause = () => {
        if (this.paused && ui.current !== "pause") ui.back();
        else if (this.isPausable) this.togglePause();
        else ui.back();
      };
      input.onConfirm = () => (ui.open || this.state === "galaxy" ? ui.confirm() : false);
      input.bindPad(ui.pad);
      input.bindSwipe(this.canvas);

      const unlock = () => audio.unlock();
      window.addEventListener("pointerdown", unlock);
      window.addEventListener("keydown", unlock);
      window.addEventListener("resize", () => this.resize());
      window.addEventListener("orientationchange", () => this.resize());
      window.addEventListener("blur", () => this.autoPause());
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.autoPause();
      });
    }

    start() {
      this.ui.setPlaying(false);
      this.resize();
      this.ui.show("menu");
      this.audio.menuMusic();
      requestAnimationFrame(this.frame);
    }

    /* ---------- Layout ---------- */

    // Fits the board into whatever space the HUD and touch pad leave free.
    resize() {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const portrait = H >= W;
      const compact = !portrait && H < 560;
      const touch = this.ui.touchEnabled;
      document.body.classList.toggle("portrait", portrait);
      document.body.classList.toggle("compact", compact);

      this.canvas.width = Math.round(W * dpr);
      this.canvas.height = Math.round(H * dpr);

      const showPad = this.isInPlayLayout && touch;
      this.ui.pad.hidden = !showPad;

      const hud = this.ui.hud.getBoundingClientRect();
      const pad = this.ui.pad.getBoundingClientRect();
      let left = 6;
      let right = W - 6;
      let top = 6;
      let bottom = H - 6;
      if (compact) {
        left = hud.right + 6;
        if (showPad) right = pad.left - 6;
      } else {
        top = hud.bottom + 8;
        if (showPad && portrait) bottom = pad.top - 6;
        else if (showPad) {
          right = pad.left - 6;
          left = W - right;
        }
      }

      const cols = 21;
      const rows = 23;
      const tile = Math.max(8, Math.floor(Math.min((right - left) / cols, (bottom - top) / rows) * dpr) / dpr);
      const boardW = tile * cols;
      const boardH = tile * rows;
      this.view = {
        W, H, dpr, tile, boardW, boardH,
        boardX: Math.round(left + (right - left - boardW) / 2),
        boardY: Math.round(top + (bottom - top - boardH) / 2),
      };
      const { style } = document.documentElement;
      style.setProperty("--board-x", `${this.view.boardX}px`);
      style.setProperty("--board-y", `${this.view.boardY}px`);
      style.setProperty("--board-w", `${boardW}px`);
      this.sprites.resize(tile * SPRITE_SCALE, dpr);
      if (this.maze) {
        this.art.build(this.maze, this.view);
        if (this.state === "clear" || this.state === "gameover") this.placeDancers();
      }
      this.ui.hudState.lives = null;
      if (this.isInPlayLayout) this.ui.updateHud();
    }

    get isInPlayLayout() {
      return this.state !== "menu" && this.state !== "galaxy";
    }

    /* ---------- Flow ---------- */

    setState(state) {
      this.state = state;
      this.stateTime = 0;
    }

    newGame() {
      this.paused = false;
      this.ui.hide();
      this.ui.hideBanner();
      this.audio.stopMusic();
      this.levels.start(this.save.options.difficulty);
      this.score.start(this.levels.lives);
      this.loadLevel();
    }

    loadLevel() {
      const { levels } = this;
      this.maze = new D.Maze(levels.level);
      this.tuning = levels.tuning();
      this.anim.clear();
      this.ui.hideBanner();
      this.setState("ready");
      this.ui.setPlaying(true);
      this.resize();
      this.resetActors();
      this.showLevelName = true;
      this.audio.sfx("ready");
      setTimeout(() => this.audio.voice(this.droidId), 300);
      this.ui.updateHud();
    }

    resetActors() {
      const { maze, tuning, levels, player, enemies } = this;
      const [px, py] = levels.level.player;
      player.place(maze, px, py);
      player.speed = tuning.playerSpeed;
      this.director.reset();
      this.powerLeft = 0;
      this.score.chain = 0;
      let waiting = 0;
      enemies.forEach((enemy, i) => {
        const [x, y] = levels.level.starts[i];
        const inHouse = maze.isHouse(x, y);
        enemy.reset(this, x, y, inHouse ? (waiting + 0.5) * tuning.release : 0);
        if (inHouse) waiting++;
      });
    }

    update(dt) {
      this.stateTime += dt;
      this.clock += dt;
      this.anim.update(dt);

      switch (this.state) {
        case "ready":
          if (this.input.direction >= 0) this.player.press(this.input.direction);
          if (this.stateTime >= (this.showLevelName ? READY_TIME : RESPAWN_TIME)) {
            this.setState("play");
            this.audio.levelMusic(this.levels.level.song);
          }
          break;
        case "play":
          this.updatePlay(dt);
          break;
        case "defeat":
          if (this.stateTime >= DEFEAT_FREEZE) this.state = "play";
          break;
        case "dying":
          this.updateDying();
          break;
        case "clear":
          this.updateClear(dt);
          break;
        case "galaxy":
          this.updateGalaxy(dt);
          break;
        default:
          break;
      }
    }

    updatePlay(dt) {
      const { player, enemies, maze, input, collision } = this;
      if (input.direction >= 0) player.press(input.direction);
      player.update(dt);

      const item = collision.collect(player, maze);
      if (item === D.Maze.GEAR) {
        this.score.add(POINTS.gear);
        this.audio.sfx("gear");
      } else if (item === D.Maze.POWER) {
        this.collectPower();
      }
      if (maze.gears === 0) {
        this.levelClear();
        return;
      }

      if (this.powerLeft > 0) {
        this.powerLeft -= dt;
        if (this.powerLeft <= 0) this.endPower();
      }
      this.director.update(dt, this, this.powerLeft > 0);
      for (const enemy of enemies) {
        const wasWaiting = enemy.state === "waiting";
        enemy.update(dt);
        if (wasWaiting && enemy.state === "leaving") this.audio.voice(enemy.id);
      }

      const enemy = collision.enemyTouching(player, enemies, maze.cols);
      if (enemy) {
        if (enemy.frightened) this.defeatEnemy(enemy);
        else this.droidCaught();
      }
      this.ui.updateHud();
    }

    collectPower() {
      this.score.add(POINTS.power);
      this.score.chain = 0;
      this.powerLeft = this.tuning.powerTime;
      for (const enemy of this.enemies) enemy.setFrightened(true);
      this.audio.sfx("power");
      this.audio.voice(this.droidId);
      this.audio.setPowerMood(true);
      this.anim.flashScreen("#ff7a4a", 0.32);
      const [x, y] = this.boardToScreen(this.player.x, this.player.y);
      this.anim.burst(x, y, "#ffb48a", 22, 190);
    }

    endPower() {
      this.powerLeft = 0;
      for (const enemy of this.enemies) enemy.setFrightened(false);
      this.audio.setPowerMood(false);
    }

    defeatEnemy(enemy) {
      const points = this.score.defeatBonus();
      enemy.defeat();
      const [x, y] = this.boardToScreen(enemy.x, enemy.y);
      this.anim.popup(x, y - this.view.tile * 0.4, D.fmt(points), "#7df9ff");
      this.anim.burst(x, y, this.enemyColor(enemy), 26, 210);
      this.anim.shake = 7;
      this.audio.sfx("defeat");
      this.audio.voice(enemy.id);
      this.setState("defeat");
    }

    droidCaught() {
      this.audio.stopMusic();
      this.audio.sfx("hurt");
      for (const enemy of this.enemies) enemy.frightened = false;
      this.powerLeft = 0;
      this.anim.shake = 10;
      this.input.releaseAll();
      this.setState("dying");
    }

    updateDying() {
      const t = this.stateTime;
      if (Math.floor(t * 12) !== Math.floor((t - STEP) * 12) && t < 1.2) {
        const [x, y] = this.boardToScreen(this.player.x, this.player.y);
        this.anim.burst(x, y, "#ffe14d", 5, 170);
      }
      if (t < DYING_TIME) return;
      this.score.lives--;
      this.ui.updateHud();
      if (this.score.lives <= 0) {
        this.gameOver();
        return;
      }
      this.resetActors();
      this.showLevelName = false;
      this.setState("ready");
      this.audio.sfx("ready");
    }

    levelClear() {
      const { levels, save } = this;
      this.endPower();
      this.maze.clearItems();
      this.score.add(POINTS.level);
      this.ui.updateHud();
      this.audio.stopMusic();
      this.audio.sfx("fanfare");
      this.input.releaseAll();
      this.setState("clear");
      this.confettiLeft = 0;
      this.placeDancers();
      this.ui.pad.hidden = true;
      this.ui.showLevelClear(levels.level.name, POINTS.level);
      if (levels.number >= UNLOCK_B1_LEVEL && !save.data.unlockedB1) {
        save.data.unlockedB1 = true;
        save.save();
        this.audio.sfx("unlock");
        this.ui.toast("B1 Battle Droid unlocked!");
      }
    }

    // Everyone lines up on stage: the hero in the middle, the enemies around it.
    placeDancers() {
      const { view, player, enemies, droidId, state } = this;
      const { boardW, boardH, tile } = view;
      const size = boardW / 10.5;
      const floor = boardH * 0.74;
      const at = (x) => (x + 0.5) * tile;
      const dancer = (id, fromX, fromY, x, y, scale, delay, offset) => ({
        id, fromX, fromY, x, y, delay, offset, size: size * scale, fallen: false,
      });

      const list = [];
      if (droidId !== "b1") {
        // Two B1s turn up as backup dancers.
        list.push(dancer("b1", -tile * 2, boardH * 0.5, boardW * 0.33, floor - size * 1.5, 0.8, 0.7, 0.2));
        list.push(dancer("b1", boardW + tile * 2, boardH * 0.5, boardW * 0.67, floor - size * 1.5, 0.8, 0.7, 0.45));
      }
      const spots = [0.1, 0.27, 0.73, 0.9];
      enemies.forEach((enemy, i) => {
        list.push(dancer(enemy.id, at(enemy.x), at(enemy.y), boardW * spots[i], floor, 1, 0.45 + i * 0.08, i * 0.1));
      });
      const hero = dancer(droidId, at(player.x), at(player.y), boardW / 2, floor + size * 0.15, 1.35, 0.45, 0);
      hero.fallen = state === "gameover";
      list.push(hero);
      this.dancers = list;
    }

    updateClear(dt) {
      const { stateTime: t, view } = this;
      if (t > 0.45 && t - dt <= 0.45) this.audio.danceMusic();
      if (t > 1.25 && t - dt <= 1.25) this.audio.voice(this.droidId);
      if (t > 1.1) {
        this.confettiLeft -= dt;
        if (this.confettiLeft <= 0) {
          this.confettiLeft = 0.1;
          this.anim.confetti(view.boardX, view.boardW, view.boardY, 5);
        }
      }
      const left = Math.max(1, Math.ceil(CLEAR_TIME - t));
      this.ui.setCountdown(this.levels.lastLevel ? "The galaxy awaits..." : `Next level in ${left}`);
      if (t < CLEAR_TIME) return;
      this.audio.stopMusic();
      if (this.levels.lastLevel) {
        this.startGalaxy();
      } else {
        this.levels.advance();
        this.loadLevel();
      }
    }

    startGalaxy() {
      this.score.add(POINTS.galaxy);
      this.ui.hud.style.visibility = "hidden";
      this.ui.hideBanner();
      this.anim.clear();
      this.setState("galaxy");
      this.confettiLeft = 0;
      this.ui.pad.hidden = true;
      this.audio.sfx("galaxy");
      this.audio.galaxyMusic();
      this.ui.showGalaxy(this.levels.cycle, POINTS.galaxy);
    }

    updateGalaxy(dt) {
      const { W, H } = this.view;
      this.confettiLeft -= dt;
      if (this.confettiLeft <= 0) {
        this.confettiLeft = 0.45;
        this.anim.firework(W * (0.1 + Math.random() * 0.8), H * (0.12 + Math.random() * 0.6), Math.min(W, H) * 0.3);
      }
      this.ui.setCountdown(`Next cycle in ${Math.max(1, Math.ceil(GALAXY_TIME - this.stateTime))}`);
      if (this.stateTime >= GALAXY_TIME) this.finishGalaxy();
    }

    finishGalaxy() {
      if (this.state !== "galaxy") return;
      this.audio.stopMusic();
      this.levels.advance();
      this.ui.hud.style.visibility = "visible";
      this.loadLevel();
    }

    gameOver() {
      const { levels, score } = this;
      score.record(this.droidId, levels.number, levels.cycle);
      this.ui.prepareSubmit();
      this.setState("gameover");
      this.placeDancers();
      this.audio.stopMusic();
      this.audio.sfx("gameover");
      this.ui.pad.hidden = true;
      this.ui.hudState.high = null;
      this.ui.updateHud();
      setTimeout(() => {
        if (this.state === "gameover" && !this.ui.open) this.ui.show("gameover");
      }, 1500);
    }

    toMenu() {
      this.paused = false;
      this.maze = null;
      this.player.maze = null;
      this.ui.hideBanner();
      this.setState("menu");
      this.anim.clear();
      this.ui.setPlaying(false);
      this.resize();
      this.ui.show("menu");
      this.audio.menuMusic();
    }

    /* ---------- Pause ---------- */

    get isPausable() {
      return !this.paused && (this.state === "ready" || this.state === "play" || this.state === "defeat"
        || this.state === "dying" || this.state === "clear");
    }

    togglePause() {
      if (this.paused) this.resume();
      else this.pause();
    }

    pause() {
      if (!this.isPausable) return;
      this.paused = true;
      this.input.releaseAll();
      this.audio.holdMusic(true);
      this.audio.sfx("pause");
      this.ui.returnTo = "pause";
      this.ui.show("pause");
    }

    resume() {
      if (!this.paused) return;
      this.paused = false;
      this.ui.hide();
      this.audio.holdMusic(false);
      this.audio.sfx("pause");
      this.last = performance.now();
    }

    // Leaving the tab or window pauses the game, so nobody loses a life while away.
    autoPause() {
      this.input.releaseAll();
      this.pause();
    }

    /* ---------- Loop ---------- */

    boardToScreen(x, y) {
      const { boardX, boardY, tile } = this.view;
      return [boardX + (x + 0.5) * tile, boardY + (y + 0.5) * tile];
    }

    frame(now) {
      requestAnimationFrame(this.frame);
      const elapsed = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;

      if (!this.paused) {
        this.accumulator += elapsed;
        let steps = 0;
        while (this.accumulator >= STEP && steps < MAX_STEPS) {
          this.update(STEP);
          this.accumulator -= STEP;
          steps++;
        }
        if (steps === MAX_STEPS) this.accumulator = 0;
      }

      this.renderer.render();
      this.ui.tick(performance.now() / 1000);
    }
  }

  D.GameManager = GameManager;
})(window.DROID);
