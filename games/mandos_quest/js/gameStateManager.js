/*
 * The game's flow: menu, cinematic, playing, paused and results, and the moves between them.
 * Story Mode runs intro, level, outro, completion, rewards, then the next intro.
 * A level is played by World on the ground, or by SpaceLevelManager in space.
 */
(function (MQ) {
  const D = MQ.DATA;
  const STATE = { MENU: "menu", CINEMATIC: "cinematic", PLAYING: "playing", PAUSED: "paused", RESULT: "result" };
  const FADE_SPEED = 2.6;

  class GameStateManager {
    constructor({ saveManager, progression, customization, audio, input, uiRoot, onChange }) {
      this.saveManager = saveManager;
      this.progression = progression;
      this.customization = customization;
      this.audio = audio;
      this.input = input;
      this.onChange = onChange;

      this.state = STATE.MENU;
      this.world = null;
      this.time = 0;
      this.fade = 1;
      this.canFullscreen = !!document.fullscreenEnabled;

      this.hud = new MQ.Hud(input);
      this.spaceUI = new MQ.SpaceUIManager(this.hud);
      this.stage = new MQ.Stage(() => this.customization.look);
      this.cinematic = new MQ.CinematicPlayer(this.stage, audio, input);
      this.antics = new MQ.MenuAntics(() => this.customization.look, audio, () => this.save.settings);
      this.menuScene = new MQ.MenuScene(this.stage, this.antics);
      this.ui = new MQ.UIManager(uiRoot, this);
      input.onPause = () => this.escape();
    }

    get save() {
      return this.saveManager.data;
    }

    get inLevel() {
      return this.state === STATE.PAUSED;
    }

    setState(state) {
      this.state = state;
      this.input.setEnabled(state === STATE.PLAYING);
      this.audio.duck(state === STATE.PAUSED);
      this.onChange();
    }

    disposeWorld() {
      this.world?.dispose();
      this.world = null;
    }

    /* ---------- Moving between states ---------- */

    showMenu() {
      this.disposeWorld();
      this.setState(STATE.MENU);
      this.ui.show("main");
      this.audio.music("menu");
      this.fade = 1;
    }

    playCinematic(shots, done, heading, music = "cinematic") {
      this.disposeWorld();
      this.ui.hide();
      this.setState(STATE.CINEMATIC);
      this.cinematic.play(shots, done, heading);
      this.audio.music(music);
      this.fade = 1;
    }

    startLevel(id, withIntro = true) {
      if (!this.progression.isUnlocked(id)) return;
      this.autoFullscreen();
      const level = MQ.LEVELS[id - 1];
      if (withIntro) this.playCinematic(level.intro, () => this.beginLevel(level), `Level ${id}: ${level.title}`);
      else this.beginLevel(level);
    }

    beginLevel(level) {
      this.disposeWorld();
      this.ui.hide();
      this.progression.refresh();
      const Mode = level.mode === "space" ? MQ.SpaceLevelManager : MQ.World;
      this.world = new Mode(level, {
        saveManager: this.saveManager,
        progression: this.progression,
        customization: this.customization,
        audio: this.audio,
        hud: this.hud,
        spaceUI: this.spaceUI,
        onFinish: (world) => this.levelFinished(world),
        onGameOver: (world) => this.gameOver(world),
        onWeapon: () => this.saveManager.write(),
      });
      this.setState(STATE.PLAYING);
      this.fade = 1;
    }

    pause() {
      if (this.state !== STATE.PLAYING || !this.world || this.world.state === "over") return;
      this.setState(STATE.PAUSED);
      this.ui.show("pause");
    }

    resume() {
      if (this.state !== STATE.PAUSED) return;
      this.ui.hide();
      this.setState(STATE.PLAYING);
    }

    levelFinished(world) {
      const result = this.progression.completeLevel(world.def, world.run);
      const last = result.finale;
      const screen = world.mode === "space" ? "spaceComplete" : "complete";
      this.playCinematic(
        world.def.outro,
        () => {
          this.setState(STATE.RESULT);
          this.ui.show(screen, { result });
          this.audio.music(last ? "ending" : "menu");
          if (result.rewards.length) this.audio.sfx("unlock");
        },
        "",
        last ? "ending" : "cinematic",
      );
    }

    gameOver(world) {
      const runScore = world.scoreSoFar;
      this.setState(STATE.RESULT);
      this.ui.show("gameOver", {
        level: world.def,
        entry: this.progression.leaderboardEntry(world.def.id, runScore, false),
      });
    }

    escape() {
      switch (this.state) {
        case STATE.PLAYING:
          this.pause();
          break;
        case STATE.PAUSED:
          if (!this.ui.back()) this.resume();
          break;
        case STATE.CINEMATIC:
          this.cinematic.skip();
          break;
        default:
          this.ui.escape();
      }
    }

    /* ---------- Menu actions ---------- */

    action(name, id, data) {
      switch (name) {
        case "story":
          if (this.progression.started) this.ui.open("story");
          else this.startLevel(1);
          break;
        case "storyContinue":
          this.startLevel(this.progression.nextLevel());
          break;
        case "storyStart":
          this.startLevel(1);
          break;
        case "play":
          this.startLevel(Number(id));
          break;
        case "resume":
          this.resume();
          break;
        case "restart":
          this.ui.open("confirm", {
            title: this.world.mode === "space" ? "Restart mission?" : "Restart level?",
            message: this.attemptWarning(),
            label: "Restart",
            run: () => {
              this.autoFullscreen();
              this.beginLevel(this.world.def);
            },
          });
          break;
        case "quit":
          this.ui.open("confirm", {
            title: this.world.mode === "space" ? "Leave this mission?" : "Leave this level?",
            message: this.attemptWarning(),
            label: "Main Menu",
            run: () => this.showMenu(),
          });
          break;
        case "retry":
          this.autoFullscreen();
          this.beginLevel(data.level);
          break;
        case "toMenu":
          this.showMenu();
          break;
        case "afterComplete":
          this.ui.show("levelUp", { result: data.result });
          break;
        case "resultCustomize":
          this.ui.open("customize");
          break;
        case "afterRewards":
          if (!data.result.finale) {
            // The next uncleared stage, or the following one on a replay.
            this.startLevel(data.result.first ? this.progression.nextLevel() : data.result.level.id + 1);
          } else {
            this.ui.show("credits", { ending: true });
            this.audio.music("credits");
          }
          break;
        case "afterCredits":
          this.ui.show("finalScore");
          break;
        case "reset":
          this.ui.open("confirm", {
            title: "Reset all progress?",
            message: "Levels, XP, scores, times and pucks go back to 0, and every unlock and custom look is erased from this browser. Your settings are kept. This can't be undone.",
            label: "Erase progress",
            run: () => this.resetProgress(),
          });
          break;
        case "fullscreen":
          this.toggleFullscreen();
          break;
        case "touchLayout":
          this.touchLayout.open(() => this.ui.render());
          break;
      }
    }

    attemptWarning() {
      const lost = "You'll lose your progress in this attempt.";
      return this.world.mode === "space" ? `${lost} Ship upgrades from capsules are lost too.` : `${lost} Collected Bounty Pucks are kept.`;
    }

    resetProgress() {
      this.saveManager.reset();
      this.progression.refresh();
      this.customization.load();
      this.saveManager.write();
      this.showMenu();
    }

    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else this.requestFullscreen();
    }

    // Phones and tablets go full screen when a level starts. It has to be called straight from
    // the button, as browsers only allow it just after a tap.
    autoFullscreen() {
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      this.requestFullscreen();
    }

    requestFullscreen() {
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!request) return; // iPhones only allow fullscreen video.
      // The prefixed version returns no promise. If refused, the game runs in the normal window.
      Promise.resolve(request.call(root, { navigationUI: "hide" })).catch(() => {});
    }

    equip(id) {
      if (!this.progression.hasWeapon(id)) return;
      if (this.world && this.inLevel && this.world.mode !== "space") this.world.player.weapons.select(id);
      this.save.weapon = id;
      this.saveManager.write();
    }

    setSaberColor(id) {
      if (!this.save.darksaber) return;
      this.save.saberColor = D.saber(id).id;
      this.saveManager.write();
      this.audio.sfx("saberOn");
    }

    changeSetting(key, value) {
      this.save.settings[key] = value;
      this.saveManager.write();
      this.audio.applyVolume();
      if (this.world && key !== "difficulty") {
        this.world.camera.shakeEnabled = this.save.settings.shake;
        this.world.particles.setQuality(this.save.settings.effects);
      }
      this.onChange();
    }

    // A newer finished run may have replaced the score while it was being sent.
    clearPendingScore(sent) {
      if (this.save.pendingScore !== sent) return;
      this.save.pendingScore = null;
      this.saveManager.write();
    }

    /* ---------- Loop ---------- */

    step(dt) {
      if (this.state === STATE.PLAYING) this.world.update(this.input, dt);
    }

    frame(dt) {
      this.time += dt;
      this.fade = Math.max(0, this.fade - dt * FADE_SPEED);
      if (this.state === STATE.CINEMATIC) this.cinematic.update(dt);
    }

    draw(ctx) {
      if (this.world) {
        this.world.draw(ctx);
        if (this.state === STATE.PLAYING) {
          if (this.world.mode === "space") this.world.drawHud(ctx);
          else this.hud.draw(ctx, this.world);
        } else {
          ctx.fillStyle = "rgba(3,5,12,0.5)";
          ctx.fillRect(0, 0, MQ.VW, MQ.VH);
        }
      } else if (this.state === STATE.CINEMATIC) {
        this.cinematic.draw(ctx);
      } else {
        this.menuScene.draw(ctx, this.time, this.ui.current?.name === "main", this.hud.scale);
      }
      if (this.fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${this.fade})`;
        ctx.fillRect(0, 0, MQ.VW, MQ.VH);
      }
      if (this.ui.visible) this.ui.draw(this.time);
    }
  }

  GameStateManager.STATE = STATE;
  MQ.GameStateManager = GameStateManager;
})(window.MQ);
