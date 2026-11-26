/*
 * App controller: boots the game, owns the loop, and moves between the splash screen,
 * menus, story scenes, gameplay, results, game over and credits. Also applies settings
 * and writes progress to the save after each level.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const A = XM.Art;

  const clone = (v) => JSON.parse(JSON.stringify(v));

  class App {
    constructor() {
      XM.app = this;
      XM.Save.load();
      XM.FX.init();
      XM.Input.init();
      this.canvas = document.getElementById("game");
      this.engine = new XM.Engine(this.canvas, {
        update: (dt) => this.update(dt),
        render: (ctx) => this.render(ctx),
        resize: () => XM.Input.applyLayout && XM.Input.applyLayout(),
      });
      this.story = new XM.StoryPlayer();
      this.hud = new XM.HUD();
      this.menus = new XM.Menus(this);
      this.world = null;
      this.state = "splash";
      this.t = 0;
      this.storyControls = document.getElementById("story-controls");
      this.applySettings();
      this.bindGlobal();
      this.menus.show("splash", {}, false);
      this.engine.start();
    }

    // ---------- settings ----------
    applySettings() {
      const s = XM.Save.data.settings;
      XM.Audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
      this.engine.setQuality(s.quality);
      XM.FX.setQuality(s.quality);
      XM.FX.shakeEnabled = s.shake;
      XM.Input.applyLayout();
    }

    setSetting(key, value) {
      const s = XM.Save.data.settings;
      switch (key) {
        case "touchSize":
          s.touch.size = value;
          break;
        case "touchOpacity":
          s.touch.opacity = value;
          break;
        case "touchForce":
          s.touch.forceShow = value;
          XM.Input.refreshTouch();
          break;
        default:
          s[key] = value;
      }
      this.applySettings();
      XM.Save.write();
    }

    bindGlobal() {
      const startOnce = (e) => {
        if (this.state !== "splash") return;
        if (e.type === "keydown" && ["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        this.start();
      };
      window.addEventListener("pointerdown", startOnce);
      window.addEventListener("keydown", startOnce);
      window.addEventListener("keydown", (e) => {
        if (XM.Input.captureCb) return;
        if (e.code === "Escape") {
          if (this.state === "story") {
            e.preventDefault();
            return this.story.finish();
          }
          if (this.state === "credits") return this.skipCredits();
          if (this.menus.visible && !["main", "splash", "results", "gameover", "finalscore", "touchEdit"].includes(this.menus.current) && this.state !== "play") {
            e.preventDefault();
            this.menus.back();
          }
        }
        if (this.state === "story" && (e.code === "Enter" || e.code === "Space")) {
          e.preventDefault();
          this.story.advance();
        }
      });
      this.canvas.addEventListener("pointerdown", () => {
        if (this.state === "story") this.story.advance();
      });
      document.getElementById("story-skip").addEventListener("click", () => this.story.finish());
      document.getElementById("story-next").addEventListener("click", () => this.story.advance());
      document.getElementById("pause-btn").addEventListener("click", () => {
        if (this.state === "play") this.pause();
      });
      const autoPause = () => {
        if (this.state === "play" && XM.Save.data.settings.pauseOnBlur) this.pause();
      };
      window.addEventListener("blur", autoPause);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) autoPause();
      });
      XM.Input.onPad = (pad) => {
        if (this.state === "splash") this.start();
      };
    }

    start() {
      if (this.state !== "splash") return;
      XM.Audio.init();
      this.requestFullscreen();
      this.toMenu();
    }

    requestFullscreen() {
      const root = document.documentElement;
      if (document.fullscreenElement || document.webkitFullscreenElement) return;
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!req) return;
      Promise.resolve(req.call(root, { navigationUI: "hide" })).catch(() => {});
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
    }

    toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else this.requestFullscreen();
      setTimeout(() => this.menus.current === "settings" && this.menus.refresh(), 300);
    }

    // ---------- flow ----------
    setPlaying(on) {
      XM.Input.gameActive = on;
      XM.Input.showTouch(on);
      document.getElementById("pause-btn").hidden = !on;
    }

    toMenu() {
      this.world = null;
      this.state = "menu";
      this.setPlaying(false);
      this.storyControls.hidden = true;
      XM.FX.clear();
      this.menus.resetTo("main");
      XM.Audio.music("menu");
    }

    newGame() {
      const d = XM.Save.data;
      if (d.campaign.started) {
        const fresh = XM.Save.data.levels.map(() => ({ cleared: false, best: 0, stars: 0, x: [false, false, false], orbs: 0, orbsTotal: 0, secrets: 0, secretsTotal: 0, bestTime: 0, rare: false }));
        d.levels = fresh;
        d.campaign = { unlocked: 1, started: true, finished: false, introSeen: true };
        d.art = [];
      }
      d.campaign.started = true;
      XM.Save.write();
      this.playOpening(() => this.menus.resetTo("chars", { mode: "play", level: 0, sel: d.selected }));
    }

    continueGame() {
      const d = XM.Save.data;
      this.menus.show("chars", { mode: "play", level: Math.min(19, d.campaign.unlocked - 1), sel: d.selected });
    }

    playStory(panels, opts) {
      this.state = "story";
      this.setPlaying(false);
      this.menus.hide();
      this.storyControls.hidden = false;
      XM.Audio.music(opts.music || "story");
      this.story.play(clone(panels), Object.assign({}, opts, {
        done: () => {
          this.storyControls.hidden = true;
          opts.done();
        },
      }));
    }

    playOpening(done) {
      XM.Save.data.campaign.introSeen = true;
      XM.Save.write();
      this.playStory(XM.STORY.OPENING, { hero: XM.Save.data.selected, done });
    }

    launch(levelIndex, charId) {
      const L = XM.LEVELS[levelIndex];
      const story = XM.STORY.LEVELS[levelIndex];
      if (window.matchMedia("(pointer: coarse)").matches) this.requestFullscreen();
      const played = XM.Save.data.stats.played;
      if (!played.includes(charId)) played.push(charId);
      XM.Save.write();
      this.playStory([{ bg: L.theme, lines: story.intro }], {
        title: `LEVEL ${L.number}: ${L.name.toUpperCase()}`,
        subtitle: L.location,
        hero: charId,
        done: () => this.beginLevel(levelIndex, charId),
      });
    }

    beginLevel(levelIndex, charId) {
      this.menus.hide();
      XM.FX.clear();
      this.world = new XM.World(this, levelIndex, charId);
      this.state = "play";
      this.setPlaying(true);
      XM.Audio.music(this.world.theme.music);
      this.hud.banner = null;
      XM.Achievements.check();
    }

    pause() {
      if (this.state !== "play") return;
      this.state = "paused";
      this.setPlaying(false);
      this.menus.resetTo("pause");
    }

    resume() {
      if (!this.world) return this.toMenu();
      this.menus.hide();
      this.menus.stack = [];
      this.state = "play";
      this.setPlaying(true);
    }

    restartLevel() {
      const w = this.world;
      this.beginLevel(w.levelIndex, w.player.id);
    }

    quitToMenu() {
      this.toMenu();
    }

    editTouch() {
      this.state = "touchEdit";
      XM.Input.startEdit();
      this.menus.show("touchEdit");
    }

    endTouchEdit() {
      this.state = this.world ? "paused" : "menu";
      this.menus.back();
    }

    resetSave() {
      XM.Save.reset();
      XM.Save.write();
      this.applySettings();
      this.toMenu();
      this.hud.toast("Save data deleted", "Starting fresh.", "info");
    }

    // ---------- level end ----------
    levelComplete(world) {
      const res = world.results();
      const d = XM.Save.data;
      const i = res.index;
      const s = res.stats;
      const lv = d.levels[i];
      const newBest = res.total > lv.best;
      const rareNew = s.rare && !lv.rare;
      lv.cleared = true;
      lv.best = Math.max(lv.best, res.total);
      lv.stars = Math.max(lv.stars, res.stars);
      lv.x = lv.x.map((v, k) => v || s.x[k]);
      lv.orbs = Math.max(lv.orbs, s.orbs);
      lv.orbsTotal = Math.max(lv.orbsTotal, s.orbsTotal);
      lv.secrets = Math.max(lv.secrets, s.secrets);
      lv.secretsTotal = s.secretsTotal;
      lv.bestTime = lv.bestTime ? Math.min(lv.bestTime, s.time) : s.time;
      if (rareNew) lv.rare = true;
      const unlocks = [];
      if (res.first) d.campaign.unlocked = Math.min(20, Math.max(d.campaign.unlocked, i + 2));
      if (lv.x.every(Boolean) && !d.art.includes(i)) {
        d.art.push(i);
        unlocks.push(`🎨 Concept Art #${i + 1} unlocked in the Database`);
      }
      for (const c of XM.CHARS) {
        if (c.joinsAfter === i + 1 && !d.chars[c.id].unlocked) {
          d.chars[c.id].unlocked = true;
          unlocks.push(`⭐ ${c.name} has joined the X-Men!`);
          this.hud.toast("New X-Man!", `${c.name} joined the team`, "unlock");
        }
      }
      const st = d.stats;
      st.kills += s.kills;
      st.sentinelKills += s.sentinelKills;
      st.orbs += s.orbs;
      st.maxCombo = Math.max(st.maxCombo, s.maxCombo);
      st.playTime += s.time;
      if (res.noDamage) st.noDamageClears++;
      if (res.fast) st.fastClears++;
      if (res.boss) {
        const id = res.boss.statId || res.boss.id;
        if (!st.bosses.includes(id)) st.bosses.push(id);
      }
      if (i === 19) d.campaign.finished = true;
      const cs = d.chars[res.charId];
      cs.played++;
      const passivesBefore = XM.Progress.passives(res.charId).length;
      const ups = XM.Progress.addXP(res.charId, res.xp);
      if (rareNew) cs.points++;
      const newPassives = XM.Progress.passives(res.charId).slice(passivesBefore);
      if (ups.levels.length) this.hud.toast("Level up!", `${XM.CHAR[res.charId].name} reached level ${cs.level}`, "unlock");
      for (const o of XM.Outfits.checkAll()) {
        unlocks.push(`👕 New outfit: ${XM.CHAR[o.charId].name} – ${o.outfit.name}`);
        this.hud.toast("Outfit unlocked!", `${XM.CHAR[o.charId].name}: ${o.outfit.name}`, "unlock");
      }
      XM.Achievements.check();
      XM.Save.write();

      const story = XM.STORY.LEVELS[i];
      const data = { res, levelUps: ups, levelAfter: cs.level, newPassives, unlocks, next: story.next, hasNext: i < 19, newBest, rare: rareNew };
      const showResults = () => {
        this.state = "results";
        this.world = null;
        this.menus.resetTo("results", data);
        XM.Audio.music("victory");
      };
      this.setPlaying(false);
      if (i === 19) {
        this.playStory(XM.STORY.FINALE, {
          hero: res.charId,
          music: "credits",
          done: () => this.playCredits(true, () => {
            this.state = "results";
            this.world = null;
            this.menus.resetTo("results", data);
          }),
        });
      } else if (story.outro.length) {
        this.playStory([{ bg: XM.LEVELS[i].theme, lines: story.outro }], { title: "MISSION DEBRIEF", subtitle: XM.LEVELS[i].name, hero: res.charId, done: showResults });
      } else showResults();
    }

    nextMission() {
      const r = this.menus.data.res;
      const next = Math.min(19, r.index + 1);
      this.menus.show("chars", { mode: "play", level: next, sel: XM.Save.data.selected });
    }

    gameOver(world) {
      this.state = "gameover";
      this.setPlaying(false);
      const s = world.stats;
      const st = XM.Save.data.stats;
      st.kills += s.kills;
      st.sentinelKills += s.sentinelKills;
      st.orbs += s.orbs;
      st.maxCombo = Math.max(st.maxCombo, s.maxCombo);
      XM.Achievements.check();
      XM.Save.write();
      const entry = XM.Leaderboard.campaignEntry(s.score, world.player.id);
      this.menus.resetTo("gameover", { levelIndex: world.levelIndex, charId: world.player.id, runScore: s.score, entry });
      XM.Audio.music("defeat");
    }

    // ---------- credits ----------
    playCredits(fromFinale, after) {
      this.state = "credits";
      this.setPlaying(false);
      this.storyControls.hidden = true;
      this.creditsT = 0;
      this.creditsFinale = fromFinale;
      this.creditsAfter = after;
      this.menus.resetTo("credits");
      XM.Audio.music("credits");
    }

    skipCredits() {
      if (this.state !== "credits") return;
      if (this.creditsFinale) {
        this.playStory(XM.STORY.POST_CREDITS, {
          hero: XM.Save.data.selected,
          done: () => {
            const entry = XM.Leaderboard.campaignEntry(0);
            XM.Save.data.pendingScore = entry;
            XM.Save.write();
            if (this.creditsAfter) this.creditsAfter();
            this.menus.stack = [];
            this.menus.show("finalscore", { entry, pending: true });
          },
        });
      } else this.toMenu();
    }

    // ---------- loop ----------
    update(dt) {
      this.t += dt;
      this.hud.update(dt);
      this.menus.tick(dt);
      const I = XM.Input;
      switch (this.state) {
        case "play": {
          if (XM.FX.hitstop > 0) {
            XM.FX.hitstop -= dt;
            break;
          }
          I.poll();
          if (I.pressed("pause")) return this.pause();
          if (I.pressed("info")) {
            this.pause();
            this.menus.show("info");
            return;
          }
          this.world.update(dt, I);
          break;
        }
        case "story":
          I.poll();
          this.story.update(dt);
          if (I.pressed("attack") || I.pressed("interact")) this.story.advance();
          break;
        case "credits":
          this.creditsT += dt;
          if (this.creditsT > XM.STORY.CREDITS.length * 1.6 + 8) this.skipCredits();
          break;
        case "gameover":
        case "paused":
          if (this.world) {
            XM.FX.update(dt * 0.3);
          }
          break;
      }
    }

    render(ctx) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      switch (this.state) {
        case "play":
        case "paused":
        case "gameover":
          if (this.world) {
            this.world.draw(ctx);
            this.hud.draw(ctx, this.world);
            if (this.state !== "play") {
              ctx.fillStyle = "rgba(5,3,12,0.55)";
              ctx.fillRect(0, 0, vw, vh);
            }
          }
          break;
        case "story":
          this.story.draw(ctx);
          break;
        case "credits":
          this.drawCredits(ctx);
          break;
        default:
          this.drawMenuBg(ctx);
      }
      XM.FX.drawScreen(ctx);
    }

    drawMenuBg(ctx) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const themes = [0, 16, 8, 13, 17];
      const idx = themes[Math.floor(this.t / 12) % themes.length];
      const bg = XM.BG.build(idx, XM.Save.data.settings.quality);
      XM.BG.draw(ctx, bg, this.t * 40, 0, this.t, vh);
      ctx.fillStyle = "rgba(8,4,20,0.45)";
      ctx.fillRect(0, 0, vw, vh);
      // The team, lined up on the right.
      const ids = ["professorx", "storm", "cyclops", "wolverine", "jean", "gambit"];
      ids.forEach((id, i) => {
        const x = vw * 0.56 + i * Math.min(80, vw * 0.07);
        if (!XM.Save.char(id).unlocked && this.state !== "splash") return;
        XM.CharArt.draw(ctx, id, XM.Outfits.current(id), { state: "idle", t: this.t + i }, x, vh - 40 - (i % 2) * 18, -1, 1.7);
      });
      ctx.fillStyle = A.halftone(ctx, "rgba(255,255,255,0.04)");
      ctx.fillRect(0, 0, vw, vh);
    }

    drawCredits(ctx) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const bg = XM.BG.build(16, XM.Save.data.settings.quality);
      XM.BG.draw(ctx, bg, this.creditsT * 20, 0, this.creditsT, vh);
      ctx.fillStyle = "rgba(6,4,14,0.7)";
      ctx.fillRect(0, 0, vw, vh);
      const y0 = vh + 20 - this.creditsT * 48;
      XM.STORY.CREDITS.forEach(([text, kind], i) => {
        const y = y0 + i * 40;
        if (y < -40 || y > vh + 40) return;
        const size = kind === "title" ? 30 : kind === "head" ? 20 : kind === "small" ? 12 : 16;
        const col = kind === "title" ? "#ffe14a" : kind === "head" ? "#ff7a5a" : kind === "small" ? "#a8a0b8" : "#ffffff";
        A.text(ctx, text, vw / 2, y, size, col, "center");
      });
      XM.CHARS.forEach((c, i) => {
        XM.CharArt.draw(ctx, c.id, XM.Outfits.current(c.id), { state: "victory", t: this.creditsT + i * 0.4 }, 40 + (i * (vw - 80)) / 11, vh - 14, 1, 0.9);
      });
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    try {
      new App();
    } catch (error) {
      console.error(error);
      const el = document.getElementById("boot-error");
      if (el) {
        el.hidden = false;
        el.textContent = "The game couldn't start: " + error.message;
      }
    }
  });
})(window.XM);
