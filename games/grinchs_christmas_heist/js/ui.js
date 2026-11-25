/*
 * Menus and overlay screens, built as HTML over the canvas. Every button is wired through
 * data-action, so a screen's markup and its behaviour sit side by side. Pictures in the
 * menus are drawn with the game's own art code and turned into images once.
 */
(function (G) {
  "use strict";

  const esc = G.escapeHtml;
  const Art = G.Art;

  const TITLE_QUIPS = [
    "MERRY CHRISTMAS? NOT ON MY WATCH!",
    "THAT'S A LOT OF PRESENTS!",
    "MAX! STOP BARKING!",
    "THE WHOS ARE ON TO US!",
    "MY PRECIOUS CHRISTMAS LOOT!",
    "I NEED A BIGGER SACK!",
  ];
  const WIN_QUIPS = ["WHAT A HAUL!", "HEH HEH HEH... ALL MINE!", "THE WHOS NEVER SAW ME COMING!", "MY PRECIOUS CHRISTMAS LOOT!"];
  const FAIL_QUIPS = ["CURSES! FOILED BY A CLOCK!", "NEXT TIME, WHOS... NEXT TIME!", "BAH! HUMBUG!", "MAX! WHY DIDN'T YOU REMIND ME?!"];
  const GETAWAY_NAMES = { sled: "Getaway Sled", tunnel: "Hidden Tunnel", mountain: "Secret Mountain Entrance", giftbox: "Giant Gift Box" };

  class UI {
    constructor(game, deps) {
      this.game = game;
      this.root = document.getElementById("ui");
      this.pauseBtn = document.getElementById("pause-btn");
      this.storage = deps.storage;
      this.audio = deps.audio;
      this.input = deps.input;
      this.lb = G.Leaderboard;
      this.relayout = deps.relayout;
      this.fs = deps.fullscreen;
      this.actions = {};
      this.backAction = null;
      this.current = null;
      this.submitted = false;
      this.submitting = false;
      this.boardToken = 0;
      this.icons = {};
      this.heroRunning = false;

      this.root.addEventListener("click", (e) => {
        const el = e.target.closest("[data-action]");
        if (!el || !this.root.contains(el)) return;
        const fn = this.actions[el.dataset.action];
        if (!fn) return;
        e.preventDefault();
        this.audio.play("click");
        fn(el);
      });
      this.root.addEventListener("submit", (e) => {
        e.preventDefault();
        const fn = this.actions.submitScore;
        if (fn) fn();
      });
      this.root.addEventListener("input", (e) => {
        const el = e.target;
        if (el.dataset && el.dataset.setting) this.onSetting(el);
      });
      this.root.addEventListener("change", (e) => {
        const el = e.target;
        if (el.dataset && el.dataset.setting) this.onSetting(el);
      });
      this.pauseBtn.addEventListener("click", () => {
        this.audio.play("click");
        this.game.pause();
      });
      window.addEventListener("keydown", (e) => {
        if (e.code !== "Escape" && e.code !== "KeyP") return;
        if (e.target && e.target.tagName === "INPUT") {
          if (e.code === "Escape") e.target.blur();
          return;
        }
        if (this.game.state === "paused" && this.current === "pause") {
          e.preventDefault();
          this.game.resume();
        } else if (this.backAction && e.code === "Escape") {
          e.preventDefault();
          this.backAction();
        }
      });
    }

    // ---------------------------------------------------------------- Plumbing

    show(name, html, opts = {}) {
      this.current = name;
      this.actions = opts.actions || {};
      this.backAction = opts.back || null;
      if (opts.back && !this.actions.back) this.actions.back = opts.back;
      this.root.innerHTML = `<div class="screen ${opts.cls || "dim"}" role="dialog" aria-label="${esc(opts.label || name)}">${html}</div>`;
      this.pauseBtn.hidden = true;
      this.input.showTouch(false);
      this.relayout();
      const focus = this.root.querySelector("[autofocus], .btn.primary, .btn");
      if (focus && !opts.noFocus && window.matchMedia("(pointer: fine)").matches) focus.focus({ preventScroll: true });
      if (opts.after) opts.after(this.root.firstElementChild);
    }

    enterPlay() {
      this.current = "play";
      this.root.innerHTML = "";
      this.actions = {};
      this.backAction = null;
      this.pauseBtn.hidden = false;
      this.input.showTouch(true);
      this.relayout();
    }

    confirm(title, message, yesLabel, onYes, onNo) {
      this.show(
        "confirm",
        `<div class="panel confirm">
          <h2>${esc(title)}</h2>
          <p>${esc(message)}</p>
          <div class="btn-row">
            <button class="btn red" data-action="yes">${esc(yesLabel)}</button>
            <button class="btn ghost" data-action="no">Cancel</button>
          </div>
        </div>`,
        { actions: { yes: onYes, no: onNo }, back: onNo },
      );
    }

    // ---------------------------------------------------------------- Pictures

    icon(key, draw, w = 64, h = 64) {
      if (this.icons[key]) return this.icons[key];
      const scale = 2;
      const c = document.createElement("canvas");
      c.width = w * scale;
      c.height = h * scale;
      const ctx = c.getContext("2d");
      ctx.scale(scale, scale);
      try {
        draw(ctx, w, h);
      } catch (error) {
        // A picture that fails to draw just stays blank.
      }
      this.icons[key] = c.toDataURL("image/png");
      return this.icons[key];
    }

    itemImg(type, size = 40) {
      const src = this.icon(`item-${type}`, (ctx, w, h) => {
        ctx.translate(w / 2, h * 0.82);
        const s = type === "giant" ? 0.85 : type === "tree" ? 0.95 : 1.3;
        ctx.scale(s, s);
        Art.item(ctx, type, 0, 1, true);
      });
      return `<img src="${src}" width="${size}" height="${size}" alt="">`;
    }

    powerImg(type, size = 44) {
      const src = this.icon(`power-${type}`, (ctx, w, h) => {
        ctx.translate(w / 2, h / 2);
        ctx.scale(1.25, 1.25);
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        Art.circle(ctx, 0, 0, 20);
        ctx.fill();
        ctx.strokeStyle = Art.POWER_COLORS[type];
        ctx.lineWidth = 3;
        ctx.stroke();
        Art.powerIcon(ctx, type, 0.5);
      });
      return `<img src="${src}" width="${size}" height="${size}" alt="">`;
    }

    grinchImg(sack = 0.4, anim = null, size = 72, mode = "idle", key = "") {
      const src = this.icon(`grinch-${sack}-${anim}-${mode}-${key}`, (ctx, w, h) => {
        ctx.translate(w / 2 + 4, h - 6);
        const s = h / 104;
        ctx.scale(s, s);
        Art.grinch(ctx, { dir: "down", t: 0.6, phase: 0.8, speed01: mode === "idle" ? 0 : 1, mode, anim, animT: 0.5, sack, overloaded: sack > 1 });
      }, 80, 100);
      return `<img src="${src}" width="${size * 0.8}" height="${size}" alt="">`;
    }

    whoImg(kind = "adult", mood = "calm", cone = false, size = 64) {
      const src = this.icon(`who-${kind}-${mood}-${cone}`, (ctx, w, h) => {
        if (cone) {
          const g = ctx.createRadialGradient(w * 0.3, h * 0.78, 4, w * 0.3, h * 0.78, w * 0.75);
          g.addColorStop(0, mood === "alert" ? "rgba(255,80,80,0.5)" : "rgba(255,230,120,0.55)");
          g.addColorStop(1, "rgba(255,230,120,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(w * 0.3, h * 0.78);
          ctx.arc(w * 0.3, h * 0.78, w * 0.75, -0.55, 0.55);
          ctx.closePath();
          ctx.fill();
        }
        ctx.translate(cone ? w * 0.3 : w / 2, h * 0.9);
        const s = kind === "kid" ? 0.62 : 0.6;
        ctx.scale(s, s);
        const look = kind === "kid" ? Art.KID_LOOKS[0] : kind === "guard" ? Art.GUARD_LOOK : Art.WHO_LOOKS[0];
        Art.who(ctx, { dir: cone ? "right" : "down", t: 0.3, phase: 0, speed01: 0, look, kind, mood });
      });
      return `<img src="${src}" width="${size}" height="${size}" alt="">`;
    }

    dogImg(max = false, mood = "calm", size = 56) {
      const src = this.icon(`dog-${max}-${mood}`, (ctx, w, h) => {
        ctx.translate(w / 2 - 4, h * 0.82);
        ctx.scale(1.3, 1.3);
        Art.dog(ctx, { face: 1, t: 0.4, phase: 0, speed01: 0, look: max ? Art.MAX_LOOK : Art.DOG_LOOKS[0], barking: mood === "bark", max, mood });
      });
      return `<img src="${src}" width="${size}" height="${size}" alt="">`;
    }

    getawayImg(kind, size = 70) {
      const src = this.icon(`getaway-${kind}`, (ctx, w, h) => {
        ctx.translate(0, 0);
        const s = 0.62;
        ctx.translate(w / 2, h * 0.86);
        ctx.scale(s, s);
        Art.getaway(ctx, { x: 0, y: 0, kind }, 0.5, false);
      }, 90, 80);
      return `<img src="${src}" width="${size}" height="${size * 0.89}" alt="">`;
    }

    stars(n, max = 3) {
      let s = "";
      for (let i = 0; i < max; i++) s += `<span class="star ${i < n ? "on" : ""}">★</span>`;
      return `<span class="stars" aria-label="${n} of ${max} stars">${s}</span>`;
    }

    // An animated Grinch on the title screen.
    startHero() {
      if (this.heroRunning) return;
      this.heroRunning = true;
      const loop = (now) => {
        const c = this.root.querySelector(".hero-canvas");
        if (!c || this.current !== "title") {
          this.heroRunning = false;
          return;
        }
        const ctx = c.getContext("2d");
        const W = c.width;
        const H = c.height;
        const t = now / 1000;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const s = H / 150;
        ctx.setTransform(s, 0, 0, s, 0, 0);
        const cycle = t % 9;
        let anim = null;
        let mode = "sneak";
        let speed = 1;
        if (cycle < 3) {
          mode = "sneak";
        } else if (cycle < 4.6) {
          anim = "laugh";
          speed = 0;
          mode = "idle";
        } else if (cycle < 6.5) {
          mode = "walk";
        } else {
          anim = "celebrate";
          speed = 0;
          mode = "idle";
        }
        const vw = W / s;
        ctx.save();
        ctx.translate(vw / 2 - 10, 138);
        ctx.scale(1.25, 1.25);
        Art.grinch(ctx, { dir: "down", t, phase: t * 9, speed01: speed, mode, anim, animT: 0.5, sack: 0.85, overloaded: false });
        ctx.restore();
        ctx.save();
        ctx.translate(vw / 2 + 62, 140);
        ctx.scale(-1.1, 1.1);
        Art.dog(ctx, { face: 1, t, phase: t * 6, speed01: cycle > 6.5 ? 0 : 0.4, look: Art.MAX_LOOK, max: true, mood: cycle > 6.5 ? "spin" : "happy", barking: cycle > 3 && cycle < 3.4 });
        ctx.restore();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------------- Title

    showTitle() {
      this.audio.playMusic("menu");
      const s = this.storage.data;
      const muted = s.settings.muted;
      this.show(
        "title",
        `<div class="title-wrap">
          <canvas class="hero-canvas" width="360" height="200" aria-hidden="true"></canvas>
          <h1 class="logo"><span class="l1">GRINCH'S</span><span class="l2">CHRISTMAS HEIST</span></h1>
          <p class="quip">"${esc(G.pick(TITLE_QUIPS))}"</p>
          <div class="menu">
            <button class="btn primary big" data-action="play">&#9654; Play</button>
            <div class="menu-row">
              <button class="btn sky" data-action="howto">How to Play</button>
              <button class="btn gold" data-action="leaderboard">Leaderboard</button>
            </div>
            <div class="menu-row">
              <button class="btn purple" data-action="highscores">High Scores</button>
              <button class="btn" data-action="settings">Settings</button>
            </div>
            <div class="menu-row">
              <button class="btn ${muted ? "ghost" : "green"}" data-action="sound" aria-pressed="${!muted}">${muted ? "&#128263; Sound: Off" : "&#128266; Sound: On"}</button>
              <a class="btn orange" href="../../index.html">Arcade</a>
            </div>
          </div>
          ${s.bestScore ? `<p class="best-line">Best score: <b>${G.fmt(s.bestScore)}</b></p>` : ""}
        </div>`,
        {
          cls: "title-screen",
          label: "Title",
          actions: {
            play: () => this.showPlayMenu(),
            howto: () => this.showHowTo(() => this.showTitle()),
            leaderboard: () => this.showLeaderboard(() => this.showTitle()),
            highscores: () => this.showHighScores(() => this.showTitle()),
            settings: () => this.showSettings(() => this.showTitle()),
            sound: () => {
              this.audio.setMuted(!this.storage.data.settings.muted);
              this.storage.save();
              this.showTitle();
            },
          },
          after: (el) => {
            const c = el.querySelector(".hero-canvas");
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            c.width = 360 * dpr;
            c.height = 200 * dpr;
            this.startHero();
          },
        },
      );
    }

    showPlayMenu() {
      const s = this.storage.data;
      this.show(
        "play-menu",
        `<div class="panel narrow">
          <h2>Ready for a heist?</h2>
          <div class="mode-list">
            <button class="mode-card primary-card" data-action="campaign">
              ${this.grinchImg(0.9, "laugh", 76)}
              <span><b>New Heist</b><small>All 10 levels, 3 lives. Scores go on the leaderboard.</small></span>
            </button>
            <button class="mode-card" data-action="levels">
              ${this.dogImg(true, "happy", 64)}
              <span><b>Level Select</b><small>Practice any level you've unlocked (${Math.min(10, s.highestLevel + 1)} of 10).</small></span>
            </button>
          </div>
          <div class="btn-row"><button class="btn ghost" data-action="back">Back</button></div>
        </div>`,
        {
          label: "Play",
          back: () => this.showTitle(),
          actions: {
            campaign: () => {
              this.fs.auto();
              this.game.startCampaign();
            },
            levels: () => this.showLevelSelect(() => this.showPlayMenu()),
          },
        },
      );
    }

    showLevelSelect(back) {
      const s = this.storage.data;
      const unlocked = Math.min(10, s.highestLevel + 1);
      const cards = G.LEVELS.map((L) => {
        const open = L.id <= unlocked;
        const best = s.levels[L.id];
        return `<button class="level-card ${open ? "" : "locked"}" data-action="${open ? "pick" : "locked"}" data-level="${L.id}" ${open ? "" : 'aria-disabled="true"'}>
          <span class="lv-num">${L.id}</span>
          <span class="lv-name">${esc(L.name)}</span>
          ${open ? this.stars(best ? best.stars : 0) : '<span class="lock">&#128274; Locked</span>'}
          ${open && best ? `<span class="lv-best">Best ${G.fmt(best.score)}</span>` : ""}
        </button>`;
      }).join("");
      this.show(
        "levels",
        `<div class="panel wide">
          <h2>Level Select</h2>
          <p class="sub">Practice runs are just for fun and don't go on the leaderboard. Escape a level to unlock the next one.</p>
          <div class="level-grid">${cards}</div>
          <div class="btn-row"><button class="btn ghost" data-action="back">Back</button></div>
        </div>`,
        {
          label: "Level select",
          back,
          actions: {
            pick: (el) => {
              this.fs.auto();
              this.game.startPractice(Number(el.dataset.level));
            },
            locked: () => {},
          },
        },
      );
    }

    // ---------------------------------------------------------------- Level intro and pause

    showLevelIntro(L) {
      const s = this.storage.data;
      const best = s.levels[L.id];
      const g = this.game;
      const C = L.crowd;
      const threats = [];
      const whos = C.wander + C.patrol + (C.idle || 0) + (C.spectators || 0);
      if (whos) threats.push(`${this.whoImg("adult", "calm", false, 40)}<span>${whos} Whos</span>`);
      if (C.kids) threats.push(`${this.whoImg("kid", "calm", false, 40)}<span>${C.kids} kids</span>`);
      if (C.guards) threats.push(`${this.whoImg("guard", "calm", false, 40)}<span>${C.guards} guards</span>`);
      if (C.dogs) threats.push(`${this.dogImg(false, "calm", 40)}<span>${C.dogs} dogs</span>`);
      if (C.marchers) threats.push(`${this.whoImg("adult", "party", false, 40)}<span>Marching band</span>`);
      const hz = L.hazards || {};
      const tags = [];
      if (hz.ice > 2) tags.push("Icy roads");
      if (hz.lights) tags.push("Tangled lights");
      if (hz.snowmen > 2) tags.push("Snowmen blocking paths");
      if (hz.carts) tags.push("Rolling carts");
      if (hz.floats) tags.push("Parade floats");
      if (L.theme === "factory") tags.push("Conveyor belts", "Wrapping presses");
      this.show(
        "intro",
        `<div class="panel intro">
          <p class="kicker">${g.mode === "campaign" ? `Level ${L.id} of 10` : `Practice · Level ${L.id}`}</p>
          <h2>${esc(L.name)}</h2>
          <p class="sub">${esc(L.blurb)}</p>
          <div class="intro-grid">
            <div class="intro-getaway">${this.getawayImg(L.getaway, 84)}<span>Getaway:<br><b>${esc(GETAWAY_NAMES[L.getaway])}</b></span></div>
            <div class="threats">${threats.map((t) => `<div class="threat">${t}</div>`).join("")}</div>
          </div>
          ${tags.length ? `<p class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}
          <p class="tip"><b>Tip:</b> ${esc(L.tip)}</p>
          <p class="meta">You have 60 seconds. ${g.mode === "campaign" ? `Lives: <b>${g.lives}</b> · Score: <b>${G.fmt(g.score)}</b>` : best ? `Your best: <b>${G.fmt(best.score)}</b> ${this.stars(best.stars)}` : ""}</p>
          <div class="btn-row">
            <button class="btn primary big" data-action="go">Start Heist!</button>
            <button class="btn ghost" data-action="quit">Quit</button>
          </div>
        </div>`,
        {
          label: "Level intro",
          back: () => this.askQuit(() => this.showLevelIntro(L)),
          actions: {
            go: () => {
              this.fs.auto();
              this.game.beginLevel();
            },
            quit: () => this.askQuit(() => this.showLevelIntro(L)),
          },
        },
      );
    }

    askQuit(back) {
      if (this.game.mode !== "campaign") {
        this.game.quitToMenu();
        this.showTitle();
        return;
      }
      this.confirm(
        "Quit this heist?",
        "Your progress in this game will be lost. Your best scores stay saved.",
        "Quit",
        () => {
          this.game.quitToMenu();
          this.showTitle();
        },
        back,
      );
    }

    showPause() {
      const g = this.game;
      const fsOn = this.fs.isOn();
      this.show(
        "pause",
        `<div class="panel narrow">
          <h2>Paused</h2>
          <p class="sub">${esc(g.L.name)} · ${Math.ceil(g.timeLeft)}s left</p>
          <div class="menu">
            <button class="btn primary big" data-action="resume">&#9654; Resume</button>
            <button class="btn sky" data-action="restart">Restart Level</button>
            <button class="btn" data-action="settings">Settings</button>
            ${this.fs.supported() ? `<button class="btn purple" data-action="fullscreen">${fsOn ? "Exit Full Screen" : "Full Screen"}</button>` : ""}
            <button class="btn red" data-action="quit">Quit to Menu</button>
          </div>
        </div>`,
        {
          label: "Paused",
          actions: {
            resume: () => g.resume(),
            restart: () =>
              this.confirm(
                "Restart this level?",
                g.mode === "campaign" ? "The loot from this level will be lost. Your score from earlier levels is kept." : "Start this level again from the beginning.",
                "Restart",
                () => g.restartLevel(),
                () => this.showPause(),
              ),
            settings: () => this.showSettings(() => this.showPause()),
            fullscreen: () => {
              this.fs.toggle();
              setTimeout(() => {
                if (this.current === "pause") this.showPause();
              }, 250);
            },
            quit: () =>
              this.confirm(
                "Quit to the menu?",
                g.mode === "campaign" ? "This game will end and won't be scored." : "Leave this practice run?",
                "Quit",
                () => {
                  g.quitToMenu();
                  this.showTitle();
                },
                () => this.showPause(),
              ),
          },
        },
      );
    }

    // ---------------------------------------------------------------- Level end

    showLevelEnd(r) {
      const L = r.level;
      const counts = G.ITEM_ORDER.filter((k) => r.counts[k])
        .map((k) => `<div class="loot-chip">${this.itemImg(k, 34)}<span>x${r.counts[k]}</span></div>`)
        .join("");
      const row = (label, val, cls = "") => `<div class="row ${cls}"><span>${esc(label)}</span><b>${val}</b></div>`;
      const rows = [
        row(`Loot stolen (${r.items} items)`, G.fmt(r.loot)),
        r.escaped ? row("Escape bonus", `+${G.fmt(r.escapeBonus)}`) : "",
        r.escaped ? row(`Time bonus (${r.timeLeft}s left)`, `+${G.fmt(r.timeBonus)}`) : "",
        r.cleanBonus ? row("Never caught!", `+${G.fmt(r.cleanBonus)}`) : "",
        r.extra ? row("Golden gifts and Max bonuses", `+${G.fmt(r.extra)}`) : "",
        r.penalty ? row("Failed getaway (lose 25% of loot)", `-${G.fmt(r.penalty)}`, "bad") : "",
        row("Level total", G.fmt(r.total), "total"),
      ].join("");
      const quip = r.escaped ? G.pick(WIN_QUIPS) : G.pick(FAIL_QUIPS);
      let livesLine = "";
      if (r.campaign) {
        let hats = "";
        for (let i = 0; i < Math.max(r.lives, 0); i++) hats += this.grinchHeadImg();
        livesLine = `<p class="lives-line">Lives: ${hats || "none"} ${r.lifeLost ? '<span class="bad-tag">-1 life</span>' : ""} ${r.lifeGained ? '<span class="good-tag">Extra life!</span>' : ""}</p>`;
      }
      let buttons;
      const actions = {};
      if (r.campaign) {
        const label = r.gameOver ? "See Results" : r.last ? "Finish the Heist!" : "Next Level &#9654;";
        buttons = `<button class="btn primary big" data-action="next">${label}</button>`;
        actions.next = () => this.game.continueCampaign();
      } else {
        const unlocked = Math.min(10, this.storage.data.highestLevel + 1);
        buttons = `<button class="btn primary" data-action="retry">Retry</button>`;
        if (L.id < 10 && L.id + 1 <= unlocked) buttons += `<button class="btn green" data-action="nextPractice">Next Level</button>`;
        buttons += `<button class="btn sky" data-action="levels">Level Select</button>`;
        actions.retry = () => this.game.retryLevel();
        actions.nextPractice = () => this.game.startPractice(L.id + 1);
        actions.levels = () => {
          this.game.quitToMenu();
          this.showLevelSelect(() => this.showPlayMenu());
        };
      }
      buttons += `<button class="btn ghost" data-action="menu">Main Menu</button>`;
      actions.menu = () => {
        if (r.campaign && !r.gameOver && !r.last) {
          this.confirm(
            "Leave this game?",
            "Your progress in this game will be lost. Your best scores stay saved.",
            "Leave",
            () => {
              this.game.quitToMenu();
              this.showTitle();
            },
            () => this.showLevelEnd(r),
          );
        } else if (r.campaign) {
          this.game.continueCampaign();
        } else {
          this.game.quitToMenu();
          this.showTitle();
        }
      };
      this.show(
        "level-end",
        `<div class="panel result ${r.escaped ? "win" : "lose"}">
          <p class="kicker">Level ${L.id} · ${esc(L.name)}</p>
          <h2>${r.escaped ? "HEIST COMPLETE!" : "TIME'S UP!"}</h2>
          <div class="result-top">
            ${this.grinchImg(Math.min(1.3, r.items / 14), r.escaped ? "celebrate" : "caught", 96)}
            <div>
              ${this.stars(r.stars)}
              <p class="rating">${esc(r.rating)}</p>
              <p class="quip small">"${esc(quip)}"</p>
              ${r.newBest ? '<span class="good-tag">New level best!</span>' : ""}
            </div>
          </div>
          ${counts ? `<div class="loot-chips">${counts}</div>` : '<p class="sub">No loot this time!</p>'}
          <div class="breakdown">${rows}</div>
          ${r.campaign ? `<p class="meta">Total score: <b>${G.fmt(r.score)}</b></p>` : ""}
          ${livesLine}
          <div class="btn-row">${buttons}</div>
        </div>`,
        { label: "Level complete", actions },
      );
    }

    grinchHeadImg() {
      const src = this.icon("grinch-head", (ctx, w, h) => {
        Art.grinchHead(ctx, w / 2 - 2, h * 0.62, 1.15, 0.5);
      }, 40, 40);
      return `<img src="${src}" width="28" height="28" alt="life">`;
    }

    // ---------------------------------------------------------------- Game over and leaderboard

    showGameOver(r, keepSubmitted = false) {
      if (!keepSubmitted) {
        this.submitted = false;
        this.result = r;
      }
      const name = this.lb.loadName();
      const canSubmit = r.score > 0;
      const stat = (label, val) => `<div class="stat"><span>${esc(label)}</span><b>${val}</b></div>`;
      this.show(
        "gameover",
        `<div class="panel result ${r.victory ? "win" : "lose"}">
          <h2>${r.victory ? "YOU STOLE CHRISTMAS!" : "GAME OVER"}</h2>
          <div class="result-top">
            ${this.grinchImg(r.victory ? 1.3 : 0.2, r.victory ? "celebrate" : "caught", 100)}
            <div>
              <p class="final-label">Final score</p>
              <p class="final-score">${G.fmt(r.score)}</p>
              ${r.newBest ? '<span class="good-tag">NEW BEST SCORE!</span>' : `<p class="sub">Best: ${G.fmt(r.best)}</p>`}
              <p class="quip small">"${esc(r.victory ? "THAT'S A LOT OF PRESENTS!" : "THE WHOS ARE ON TO US!")}"</p>
            </div>
          </div>
          <div class="stats">
            ${stat("Presents stolen", G.fmt(r.presents))}
            ${stat("Candy canes", G.fmt(r.candy))}
            ${stat("Total loot", G.fmt(r.loot))}
            ${stat("Whos avoided", G.fmt(r.avoided))}
            ${stat("Times caught", G.fmt(r.caught))}
            ${stat("Getaways", `${r.escapes} / ${r.level}`)}
            ${stat("Reached level", r.level)}
            ${stat("Best score", G.fmt(r.best))}
          </div>
          <div class="submit-box">
            <h3>Online Leaderboard</h3>
            ${
              canSubmit
                ? `<form class="name-form" data-form="submit" ${this.submitted ? "hidden" : ""}>
                    <input id="player-name" type="text" maxlength="${this.lb.NAME_MAX}" autocomplete="nickname" enterkeyhint="send" placeholder="Your name" value="${esc(name)}" aria-label="Your name for the leaderboard">
                    <button class="btn gold" type="submit" data-submit>Submit Score</button>
                  </form>`
                : '<p class="sub">Steal something next time to get on the leaderboard!</p>'
            }
            <p class="status" id="submit-status" role="status">${this.submitted ? "Score submitted!" : ""}</p>
            <div id="inline-board"></div>
          </div>
          <div class="btn-row">
            <button class="btn primary" data-action="again">Play Again</button>
            <button class="btn gold" data-action="board">View Leaderboard</button>
            <button class="btn ghost" data-action="menu">Main Menu</button>
          </div>
        </div>`,
        {
          label: "Game over",
          noFocus: true,
          back: () => {
            this.game.quitToMenu();
            this.showTitle();
          },
          actions: {
            again: () => {
              this.fs.auto();
              this.game.startCampaign();
            },
            board: () => this.showLeaderboard(() => this.showGameOver(this.result, true)),
            menu: () => {
              this.game.quitToMenu();
              this.showTitle();
            },
            submitScore: () => this.submitScore(),
            retryBoard: () => this.renderBoard(this.root.querySelector("#inline-board"), this.highlight),
          },
          after: (el) => {
            if (this.submitted) this.renderBoard(el.querySelector("#inline-board"), this.highlight);
          },
        },
      );
    }

    async submitScore() {
      if (this.submitted || this.submitting || !this.result) return;
      const input = this.root.querySelector("#player-name");
      const status = this.root.querySelector("#submit-status");
      const button = this.root.querySelector("[data-submit]");
      if (!input || !status) return;
      const name = this.lb.cleanName(input.value);
      if (!name) {
        status.textContent = "Please type a name first.";
        input.focus();
        return;
      }
      this.submitting = true;
      if (button) button.disabled = true;
      status.textContent = "Sending...";
      const r = this.result;
      try {
        await this.lb.submit({
          name,
          score: r.score,
          level: r.level,
          loot: r.loot,
          presents: r.presents,
          caught: r.caught,
          seconds: r.seconds,
          finished: r.victory,
        });
        this.lb.saveName(name);
        this.submitted = true;
        this.highlight = { name, score: Math.floor(r.score) };
        if (this.current !== "gameover") return;
        status.textContent = "Score submitted!";
        const form = this.root.querySelector("[data-form=submit]");
        if (form) form.hidden = true;
        this.renderBoard(this.root.querySelector("#inline-board"), this.highlight);
      } catch (error) {
        if (this.current === "gameover") {
          status.textContent = this.lb.explain(error);
          if (button) button.disabled = false;
        }
      } finally {
        this.submitting = false;
      }
    }

    // Fetches the top 10 into `box`, highlighting the score just submitted.
    async renderBoard(box, highlight) {
      if (!box) return;
      const token = ++this.boardToken;
      box.innerHTML = '<p class="sub loading">Loading the top 10...</p>';
      try {
        const rows = await this.lb.top(10);
        if (token !== this.boardToken || !box.isConnected) return;
        if (!rows.length) {
          box.innerHTML = '<p class="sub">No scores yet. Be the first Grinch on the board!</p>';
          return;
        }
        let marked = false;
        const body = rows
          .map((row, i) => {
            const me = highlight && !marked && row.name === highlight.name && row.score === highlight.score;
            if (me) marked = true;
            const medal = i === 0 ? "&#129351;" : i === 1 ? "&#129352;" : i === 2 ? "&#129353;" : i + 1;
            return `<tr class="${me ? "me" : ""}">
              <td class="rank">${medal}</td>
              <td class="name">${esc(row.name)}</td>
              <td class="num">${G.fmt(row.score)}</td>
              <td class="num">${row.finished ? "&#127873; 10" : row.level}</td>
              <td class="num">${G.fmt(row.loot)}</td>
            </tr>`;
          })
          .join("");
        box.innerHTML = `<table class="board">
          <thead><tr><th>#</th><th>Name</th><th>Score</th><th>Level</th><th>Loot</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
        ${highlight && !marked ? '<p class="sub">Your score didn\'t make the top 10 this time. Keep stealing!</p>' : ""}`;
      } catch (error) {
        if (token !== this.boardToken || !box.isConnected) return;
        box.innerHTML = `<p class="sub">${esc(this.lb.explain(error))}</p><div class="btn-row"><button class="btn small" data-action="retryBoard">Try Again</button></div>`;
      }
    }

    showLeaderboard(back) {
      this.show(
        "leaderboard",
        `<div class="panel wide">
          <h2>&#127942; Leaderboard</h2>
          <p class="sub">The top 10 Grinches of all time. Finish a game to add your score!</p>
          <div id="board-box"></div>
          <div class="btn-row">
            <button class="btn sky" data-action="refresh">Refresh</button>
            <button class="btn ghost" data-action="back">Back</button>
          </div>
        </div>`,
        {
          label: "Leaderboard",
          back,
          actions: {
            refresh: () => this.renderBoard(this.root.querySelector("#board-box"), this.highlight),
            retryBoard: () => this.renderBoard(this.root.querySelector("#board-box"), this.highlight),
          },
          after: (el) => this.renderBoard(el.querySelector("#board-box"), this.highlight),
        },
      );
    }

    // ---------------------------------------------------------------- High scores (this device)

    showHighScores(back) {
      const s = this.storage.data;
      const rows = G.LEVELS.map((L) => {
        const b = s.levels[L.id];
        return `<tr>
          <td class="rank">${L.id}</td>
          <td class="name">${esc(L.name)}</td>
          <td class="num">${b ? G.fmt(b.score) : "-"}</td>
          <td>${b ? this.stars(b.stars) : '<span class="sub">-</span>'}</td>
        </tr>`;
      }).join("");
      this.show(
        "highscores",
        `<div class="panel wide">
          <h2>High Scores</h2>
          <p class="sub">Saved on this device.</p>
          <div class="stats">
            <div class="stat"><span>Best score</span><b>${G.fmt(s.bestScore)}</b></div>
            <div class="stat"><span>Highest level escaped</span><b>${s.highestLevel} / 10</b></div>
            <div class="stat"><span>Presents stolen (all time)</span><b>${G.fmt(s.totalPresents)}</b></div>
            <div class="stat"><span>Loot stolen (all time)</span><b>${G.fmt(s.totalLoot)}</b></div>
            <div class="stat"><span>Games played</span><b>${G.fmt(s.gamesPlayed)}</b></div>
          </div>
          <table class="board">
            <thead><tr><th>Lv</th><th>Level</th><th>Best</th><th>Stars</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="btn-row">
            <button class="btn red" data-action="reset">Reset Progress</button>
            <button class="btn ghost" data-action="back">Back</button>
          </div>
        </div>`,
        {
          label: "High scores",
          back,
          actions: {
            reset: () => this.askReset(() => this.showHighScores(back)),
          },
        },
      );
    }

    askReset(back) {
      this.confirm(
        "Reset all progress?",
        "This clears your best scores, stars, unlocked levels and loot totals on this device. Settings are kept. The online leaderboard isn't affected.",
        "Reset",
        () => {
          this.storage.resetProgress();
          back();
        },
        back,
      );
    }

    // ---------------------------------------------------------------- How to play

    showHowTo(back) {
      const itemRows = G.ITEM_ORDER.filter((k) => k !== "golden")
        .map((k) => `<div class="item-row">${this.itemImg(k, 38)}<span>${esc(G.ITEMS[k].name)}</span><b>${G.ITEMS[k].pts}</b></div>`)
        .join("");
      const powerRows = Object.keys(G.POWERUPS)
        .map((k) => `<div class="power-row">${this.powerImg(k, 42)}<span><b>${esc(G.POWERUPS[k].name)}</b>${esc(G.POWERUPS[k].desc)}${G.POWERUPS[k].time ? ` for ${G.POWERUPS[k].time} seconds` : ""}.</span></div>`)
        .join("");
      const section = (title, art, body) => `<section class="howto-sec"><div class="howto-art">${art}</div><div><h3>${title}</h3>${body}</div></section>`;
      this.show(
        "howto",
        `<div class="panel wide howto">
          <h2>How to Play</h2>
          <p class="sub">Steal as much Christmas as you can in 60 seconds, then get back to your getaway!</p>
          ${section(
            "1. Move",
            this.grinchImg(0.3, null, 80, "walk", "move"),
            `<p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or the <kbd>&#8593;</kbd><kbd>&#8592;</kbd><kbd>&#8595;</kbd><kbd>&#8594;</kbd> keys move the Grinch. On a phone or tablet, drag the joystick on the left.</p>
            <p>Hold <kbd>Shift</kbd> (or <b>SNEAK</b>) to tiptoe: slower, but much harder to see and silent. Press <kbd>Space</kbd> (or <b>BOOST</b>) for a burst of speed. It needs a few seconds to recharge.</p>
            <p><kbd>Esc</kbd> or <kbd>P</kbd> pauses, <kbd>F</kbd> toggles full screen and <kbd>M</kbd> mutes.</p>`,
          )}
          ${section(
            "2. Steal the loot",
            this.itemImg("giant", 80),
            `<p>Walk into Christmas goodies to stuff them in your sack. Some are hidden behind houses, trees and stalls. Watch for sparkles over the rooftops!</p><div class="item-grid">${itemRows}</div><p>A rare <b>Golden Present</b> (200) sometimes appears. Grab it before it vanishes!</p>`,
          )}
          ${section(
            "3. Mind the sack",
            `<div class="sack-stages">${this.grinchImg(0.25, null, 60, "idle", "s1")}${this.grinchImg(0.7, null, 60, "idle", "s2")}${this.grinchImg(1.2, null, 60, "idle", "s3")}</div>`,
            `<p>The sack meter shows how full it is. <b>Light</b>: full speed. <b>Heavy</b>: 10% slower. <b>Overloaded</b>: 20% slower and easier to spot. You can keep stuffing it, but will you still make it to the getaway?</p>`,
          )}
          ${section(
            "4. Avoid the Whos",
            this.whoImg("adult", "calm", true, 80),
            `<p>Whos see in the <b>yellow cone</b> in front of them. Walls, houses, trees and stalls block their view, so hide behind them. When a Who starts to notice you, a meter fills and they say <b>?</b>. If it fills, they shout <b>!</b> and chase you. Break their line of sight and they'll give up.</p>
            <p>Kids don't chase, but they yell for the grown-ups. Guards stand still and sweep their eyes around. If you're caught, you're stunned for a moment and <b>some loot falls out</b>. Grab it back!</p>`,
          )}
          ${section(
            "5. Dogs",
            this.dogImg(false, "bark", 70),
            `<p>Dogs can't see far, but they sense you nearby (the dashed ring). They bark, and barking brings Whos running. Sneak past them! Get too close and they'll snatch something from your sack.</p>`,
          )}
          ${section(
            "6. Max",
            this.dogImg(true, "happy", 70),
            `<p>Max shows up now and then. He usually helps: he <b>distracts Whos</b>, <b>digs up hidden presents</b>, <b>fetches dropped loot</b> or does a happy dance for <b>double points</b>. But sometimes he barks at the worst moment, crashes into you, or gets tangled in lights. Rescue him for a bonus!</p>`,
          )}
          ${section("7. Power-ups", this.powerImg("sugar", 70), `<div class="power-grid">${powerRows}</div>`)}
          ${section(
            "8. Watch out!",
            this.itemImg("tree", 70),
            `<p><b>Tangled lights</b> slow you down. <b>Ice</b> makes you slide. <b>Snowmen</b> block paths. Later levels add rolling <b>carts</b>, factory <b>conveyor belts</b> and <b>presses</b>, and <b>parade floats</b>. Random events like a giant <b>snowball</b>, a <b>falling tree</b> or a surprise <b>Who party</b> keep every heist different.</p>`,
          )}
          ${section(
            "9. Escape!",
            this.getawayImg("sled", 80),
            `<p>Follow the <b>green arrow</b> back to your getaway (a sled, a tunnel, a mountain cave or a giant gift box) with at least one piece of loot before the timer hits zero. You'll earn an <b>escape bonus</b>, a <b>time bonus</b> and a bonus for never being caught.</p>
            <p>If time runs out, you keep 75% of the loot's points but <b>lose a life</b>. Lose all 3 lives (or finish all 10 levels) and the game ends. You get an extra life every 3,000 points.</p>`,
          )}
          <div class="btn-row"><button class="btn primary" data-action="back">Got it!</button></div>
        </div>`,
        { label: "How to play", back, cls: "dim scroll" },
      );
    }

    // ---------------------------------------------------------------- Settings

    showSettings(back) {
      const s = this.storage.data.settings;
      const choice = (key, value, label) =>
        `<label class="choice"><input type="radio" name="${key}" value="${value}" data-setting="${key}" ${String(s[key]) === String(value) ? "checked" : ""}><span>${label}</span></label>`;
      this.show(
        "settings",
        `<div class="panel narrow settings">
          <h2>Settings</h2>
          <div class="setting">
            <label for="set-music">Music</label>
            <input id="set-music" type="range" min="0" max="1" step="0.05" value="${s.music}" data-setting="music">
          </div>
          <div class="setting">
            <label for="set-sfx">Sound effects</label>
            <input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-setting="sfx">
          </div>
          <div class="setting">
            <span class="label">Sound</span>
            <div class="choices">${choice("muted", "false", "On")}${choice("muted", "true", "Muted")}</div>
          </div>
          <div class="setting">
            <span class="label">Full screen when a heist starts</span>
            <div class="choices">${choice("fullscreen", "true", "On")}${choice("fullscreen", "false", "Off")}</div>
          </div>
          <div class="setting">
            <span class="label">Touch controls</span>
            <div class="choices">${choice("touch", "auto", "Auto")}${choice("touch", "on", "On")}${choice("touch", "off", "Off")}</div>
          </div>
          <div class="setting">
            <span class="label">Tutorial hints (level 1)</span>
            <div class="choices">${choice("hints", "true", "On")}${choice("hints", "false", "Off")}</div>
          </div>
          <div class="btn-row">
            ${this.fs.supported() ? `<button class="btn purple" data-action="fsNow">${this.fs.isOn() ? "Exit Full Screen" : "Full Screen Now"}</button>` : ""}
            <button class="btn red" data-action="reset">Reset Progress</button>
          </div>
          <div class="btn-row"><button class="btn primary" data-action="back">Done</button></div>
        </div>`,
        {
          label: "Settings",
          back,
          actions: {
            reset: () => this.askReset(() => this.showSettings(back)),
            fsNow: () => {
              this.fs.toggle();
              setTimeout(() => {
                if (this.current === "settings") this.showSettings(back);
              }, 250);
            },
          },
        },
      );
    }

    onSetting(el) {
      const s = this.storage.data.settings;
      const key = el.dataset.setting;
      if (key === "music" || key === "sfx") {
        s[key] = Number(el.value);
        this.audio.applyVolumes();
        if (key === "sfx") this.audio.play("collect", { gap: 0.15 });
      } else if (key === "muted") {
        this.audio.setMuted(el.value === "true");
      } else if (key === "fullscreen" || key === "hints") {
        s[key] = el.value === "true";
      } else if (key === "touch") {
        s.touch = el.value;
      }
      this.storage.save();
    }
  }

  G.UI = UI;
})(window.GH);
