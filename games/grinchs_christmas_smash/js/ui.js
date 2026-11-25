/*
 * Menus and overlay screens, built as HTML over the canvas. Every button is wired through
 * data-action, so a screen's markup and its behaviour sit side by side. Pictures in the
 * menus (snowballs, the Grinch, decorations) are drawn with the game's own art code and
 * turned into images once.
 */
(function (G) {
  "use strict";

  const esc = G.escapeHtml;
  const Art = G.Art;
  const TYPE_ORDER = ["normal", "mega", "bouncy", "explosive", "split", "rainbow"];

  class UI {
    constructor(game, deps) {
      this.game = game;
      this.root = document.getElementById("ui");
      this.pauseBtn = document.getElementById("pause-btn");
      this.ammoBox = document.getElementById("ammo");
      this.finishBtn = document.getElementById("finish-btn");
      this.storage = deps.storage;
      this.audio = deps.audio;
      this.fs = deps.fullscreen;
      this.lb = G.Leaderboard;
      this.actions = {};
      this.backAction = null;
      this.current = null;
      this.submitted = false;
      this.submitting = false;
      this.boardToken = 0;
      this.icons = {};

      this.root.addEventListener("click", (e) => this.onClick(e, this.root));
      this.ammoBox.addEventListener("click", (e) => {
        const el = e.target.closest("[data-slot]");
        if (el) this.game.selectAmmo(Number(el.dataset.slot));
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
      this.finishBtn.addEventListener("click", () => {
        this.audio.play("click");
        this.game.requestFinish();
        this.finishBtn.hidden = true;
      });
      // Keep taps on the HUD buttons from starting an aim on the canvas below.
      for (const el of [this.pauseBtn, this.finishBtn, this.ammoBox]) {
        el.addEventListener("pointerdown", (e) => e.stopPropagation());
      }
    }

    onClick(e, root) {
      const el = e.target.closest("[data-action]");
      if (!el || !root.contains(el)) return;
      const fn = this.actions[el.dataset.action];
      if (!fn) return;
      e.preventDefault();
      this.audio.play("click");
      fn(el);
    }

    // ---------------------------------------------------------------- Plumbing

    show(name, html, opts = {}) {
      this.current = name;
      this.actions = opts.actions || {};
      this.backAction = opts.back || null;
      this.root.innerHTML = `<div class="screen ${opts.cls || ""}" role="dialog" aria-label="${esc(opts.label || name)}">${html}</div>`;
      this.root.hidden = false;
      this.setHud(false);
      const el = this.root.firstElementChild;
      if (opts.after) opts.after(el);
      if (!opts.noFocus) {
        const first = el.querySelector("[data-focus], .btn");
        if (first && window.matchMedia("(pointer: fine)").matches) first.focus({ preventScroll: true });
      }
    }

    hide() {
      this.root.innerHTML = "";
      this.root.hidden = true;
      this.current = null;
      this.actions = {};
      this.backAction = null;
    }

    back() {
      if (this.backAction) {
        this.audio.play("click");
        this.backAction();
        return true;
      }
      return false;
    }

    setHud(on) {
      this.pauseBtn.hidden = !on;
      this.ammoBox.hidden = !on;
      if (!on) this.finishBtn.hidden = true;
    }

    showHud() {
      this.hide();
      this.current = "play";
      this.setHud(true);
      this.updateAmmo();
    }

    // Pictures for the menus, drawn once with the game's art.
    icon(key, draw, w = 64, h = 64) {
      if (this.icons[key]) return this.icons[key];
      const c = document.createElement("canvas");
      c.width = w * 2;
      c.height = h * 2;
      const ctx = c.getContext("2d");
      ctx.scale(2, 2);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      draw(ctx, w, h);
      const url = c.toDataURL();
      this.icons[key] = url;
      return url;
    }

    ballImg(type, size = 40) {
      const src = this.icon(`ball-${type}`, (ctx, w, h) => Art.drawSnowball(ctx, w / 2, h / 2 + 2, type === "mega" ? 26 : 22, type, 0.4, 0.3, true, 1), 64, 64);
      return `<img src="${src}" width="${size}" height="${size}" alt="">`;
    }

    grinchImg(anim, size = 120, at = 0.3) {
      const src = this.icon(
        `grinch-${anim}`,
        (ctx, w, h) => {
          ctx.translate(w * 0.45, h * 0.97);
          ctx.scale(0.62, 0.62);
          Art.drawGrinch(ctx, { x: 0, y: 0, anim, at, power: 0.5, pouch: { x: 90, y: -120 } }, 1.2);
        },
        200,
        250,
      );
      return `<img class="grinch-pic" src="${src}" width="${size}" height="${Math.round(size * 1.11)}" alt="">`;
    }

    thingImg(key, size = 44) {
      const src = this.icon(`thing-${key}`, (ctx, w, h) => Art.thingIcon(ctx, key, w / 2, h / 2, w * 0.86), 64, 64);
      return `<img src="${src}" width="${size}" height="${size}" alt="">`;
    }

    starRow(n, animate = false) {
      let out = "";
      for (let i = 0; i < 3; i++) out += `<span class="star ${i < n ? "on" : ""} ${animate ? "pop" : ""}" style="animation-delay:${0.35 + i * 0.35}s">&#9733;</span>`;
      return `<div class="stars">${out}</div>`;
    }

    // ---------------------------------------------------------------- Snowball tray

    updateAmmo() {
      const g = this.game;
      if (this.current !== "play") return;
      const n = g.ammo.length;
      const slots = g.ammo
        .map((type, i) => {
          const sel = i === g.selected && g.shot === "ready";
          return `<button class="slot ${sel ? "sel" : ""}" data-slot="${i}" type="button" aria-label="${esc(G.SNOWBALLS[type].name)}${sel ? " (selected)" : ""}">${this.ballImg(type, 34)}</button>`;
        })
        .join("");
      const cur = g.ammo[g.selected];
      this.ammoBox.innerHTML = `
        <div class="ammo-count" aria-label="${n} snowballs left">${this.ballImg("normal", 30)}<b>&times;${n}</b></div>
        <div class="ammo-slots">${slots}</div>
        ${cur && g.shot === "ready" ? `<div class="ammo-name">${esc(G.SNOWBALLS[cur].name)}</div>` : ""}`;
      this.finishBtn.hidden = !(g.goalReached && !g.levelEnding && g.state === "play");
    }

    // ---------------------------------------------------------------- Splash and title

    showSplash() {
      this.show(
        "splash",
        `<div class="splash">
          <h1 class="logo"><span>GRINCH'S</span><span class="xmas">CHRISTMAS</span><span class="smash">SMASH!</span></h1>
          <button class="btn primary huge" data-action="start" data-focus>&#10052; Tap to Play &#10052;</button>
          <p class="sub">Best with sound on${this.fs.supported() ? " &middot; plays full screen" : ""}</p>
        </div>`,
        {
          cls: "clear",
          label: "Start",
          actions: {
            start: () => {
              this.fs.auto();
              this.audio.ensure();
              this.audio.music("menu");
              this.showTitle();
            },
          },
        },
      );
    }

    showTitle() {
      this.game.state = "menu";
      const muted = this.storage.data.settings.muted;
      const fsOn = this.fs.isOn();
      this.show(
        "title",
        `<div class="corner-btns">
            <button class="icon-btn" data-action="mute" aria-label="${muted ? "Turn sound on" : "Turn sound off"}" title="Sound">${muted ? "&#128263;" : "&#128266;"}</button>
            ${this.fs.supported() ? `<button class="icon-btn" data-action="fullscreen" aria-label="${fsOn ? "Exit full screen" : "Full screen"}" title="Full screen">&#9974;</button>` : ""}
          </div>
          <div class="title-wrap">
          <h1 class="logo small"><span>GRINCH'S</span><span class="xmas">CHRISTMAS</span><span class="smash">SMASH!</span></h1>
          <div class="menu">
            <button class="btn primary big" data-action="play">&#9654; Play</button>
            <button class="btn gold" data-action="levels">Level Select</button>
            <button class="btn sky" data-action="howto">How to Play</button>
            <button class="btn purple" data-action="scores">High Scores</button>
            <button class="btn red" data-action="leaderboard">&#127942; Leaderboard</button>
            <button class="btn ghost" data-action="settings">Settings</button>
            <a class="btn ghost" href="../../index.html" aria-label="Back to the arcade">&#8592; Arcade</a>
          </div>
        </div>`,
        {
          cls: "clear title",
          label: "Main menu",
          actions: {
            play: () => {
              this.fs.auto();
              this.game.startCampaign();
            },
            levels: () => this.showLevels(),
            howto: () => this.showHowTo(() => this.showTitle()),
            scores: () => this.showScores(),
            leaderboard: () => this.showLeaderboard(() => this.showTitle()),
            settings: () => this.showSettings(() => this.showTitle()),
            mute: () => {
              this.audio.setMuted(!this.storage.data.settings.muted);
              this.storage.save();
              this.showTitle();
            },
            fullscreen: () => {
              this.fs.toggle();
              setTimeout(() => this.current === "title" && this.showTitle(), 300);
            },
          },
        },
      );
    }

    // ---------------------------------------------------------------- How to play

    showHowTo(back) {
      const types = TYPE_ORDER.map((t) => {
        const s = G.SNOWBALLS[t];
        const unlock = t === "normal" ? "From the start" : `Beat level ${G.UNLOCKS[t]}${t === "rainbow" ? " (or 3-star 5 levels)" : ""}`;
        return `<li>${this.ballImg(t, 38)}<span><b>${esc(s.name)}</b> ${esc(s.desc)}<small>${unlock}</small></span></li>`;
      }).join("");
      const specials = [
        ["presentBoom", "Explosive Present", "Blasts everything nearby with snow."],
        ["ornamentGiant", "Giant Ornament", "Rolls around flattening things."],
        ["goldenBell", "Golden Bell", "Rings and makes light things jump."],
        ["gingerMan", "Giant Gingerbread Man", "Crumbles into extra pieces."],
        ["presentGold", "Golden Present", "500 points and a bonus snowball!"],
        ["treeMega", "Mega Christmas Tree", "Heavy, but worth a huge bonus."],
      ]
        .map(([k, n, d]) => `<li>${this.thingImg(k, 40)}<span><b>${n}</b> ${d}</span></li>`)
        .join("");
      this.show(
        "howto",
        `<div class="panel wide scroll">
          <h2>How to Play</h2>
          <div class="howto-grid">
            <section>
              <h3>Fling snowballs</h3>
              <ol class="steps">
                <li><b>Press and drag back</b> anywhere (mouse or finger). The further you pull, the harder the throw.</li>
                <li>Follow the <b>dotted line</b> to aim high, low or straight.</li>
                <li><b>Let go</b> to launch!</li>
                <li>Tap a snowball in the tray (bottom left) to pick which one to throw next.</li>
              </ol>
              <h3>Win the level</h3>
              <p>Reach the <b>goal score</b> before your snowballs run out. Smash more for up to <b>3 stars</b>. Unused snowballs are worth 750 points each, so tap <b>FINISH</b> once you're happy.</p>
              <h3>Combos</h3>
              <p>Smashes in quick succession build a chain: <b>5 = x2</b>, <b>10 = x3</b>, <b>20 = x5</b> points, plus a chain bonus. Knocked-over snowmen and trees count as smashed!</p>
              <h3>Keys</h3>
              <p><kbd>Esc</kbd> pause &middot; <kbd>R</kbd> restart level &middot; <kbd>1</kbd>-<kbd>9</kbd> pick snowball &middot; <kbd>Space</kbd> split/detonate &middot; <kbd>M</kbd> mute &middot; <kbd>F</kbd> full screen</p>
            </section>
            <section>
              <h3>Snowballs</h3>
              <ul class="icon-list">${types}</ul>
              <h3>Special decorations</h3>
              <ul class="icon-list">${specials}</ul>
              <p class="sub">Watch out for surprises: Snowball Frenzy, Ornament Storms, Max's accidents and more!</p>
            </section>
          </div>
          <div class="btn-row"><button class="btn primary" data-action="back">Got it!</button></div>
        </div>`,
        { label: "How to play", back, actions: { back } },
      );
    }

    // ---------------------------------------------------------------- Levels

    showLevels() {
      const d = this.storage.data;
      const open = Math.min(20, d.highestLevel + 1);
      const cells = G.LEVELS.map((L, i) => {
        const n = i + 1;
        const rec = d.levels[n];
        const locked = n > open;
        const stars = rec ? rec.stars : 0;
        return `<button class="level-cell ${locked ? "locked" : ""} sky-${L.sky}" ${locked ? "disabled" : ""} data-action="pick" data-level="${i}" aria-label="Level ${n}: ${esc(L.name)}${locked ? " (locked)" : ""}">
          <span class="num">${locked ? "&#128274;" : n}</span>
          <span class="lname">${esc(L.name)}</span>
          <span class="mini-stars">${[0, 1, 2].map((k) => `<i class="${k < stars ? "on" : ""}">&#9733;</i>`).join("")}</span>
          ${rec ? `<span class="best">${G.fmt(rec.score)}</span>` : ""}
        </button>`;
      }).join("");
      this.show(
        "levels",
        `<div class="panel wide scroll">
          <h2>Level Select</h2>
          <p class="sub">Practice any level you've unlocked. Practice games don't go on the leaderboard; press <b>Play</b> on the main menu for a full run.</p>
          <div class="level-grid">${cells}</div>
          <div class="btn-row"><button class="btn ghost" data-action="back">Back</button></div>
        </div>`,
        {
          label: "Level select",
          back: () => this.showTitle(),
          actions: {
            back: () => this.showTitle(),
            pick: (el) => {
              this.fs.auto();
              this.game.startPractice(Number(el.dataset.level));
            },
          },
        },
      );
    }

    // ---------------------------------------------------------------- High scores

    showScores() {
      const d = this.storage.data;
      const stat = (label, val) => `<div class="stat"><span>${esc(label)}</span><b>${val}</b></div>`;
      const balls = TYPE_ORDER.map((t) => `<span class="ball-chip ${this.storage.isUnlocked(t) ? "" : "locked"}" title="${esc(G.SNOWBALLS[t].name)}">${this.ballImg(t, 34)}${this.storage.isUnlocked(t) ? "" : "<i>&#128274;</i>"}</span>`).join("");
      const rows = G.LEVELS.map((L, i) => {
        const rec = d.levels[i + 1];
        return `<tr><td>${i + 1}</td><td class="name">${esc(L.name)}</td><td class="num">${rec ? G.fmt(rec.score) : "&ndash;"}</td><td class="st">${rec ? "&#9733;".repeat(rec.stars) + "<span class='dim'>" + "&#9733;".repeat(3 - rec.stars) + "</span>" : "<span class='dim'>&#9733;&#9733;&#9733;</span>"}</td></tr>`;
      }).join("");
      this.show(
        "scores",
        `<div class="panel wide scroll">
          <h2>High Scores</h2>
          <div class="stats">
            ${stat("Best score", G.fmt(d.bestScore))}
            ${stat("Levels completed", `${d.highestLevel} / 20`)}
            ${stat("Stars earned", `${this.storage.starsTotal()} / 60`)}
            ${stat("Decorations smashed", G.fmt(d.totalSmashed))}
            ${stat("Best combo", G.fmt(d.bestCombo))}
            ${stat("Chain reactions", G.fmt(d.totalChains))}
            ${stat("Golden presents", G.fmt(d.goldenSmashed))}
            ${stat("Games played", G.fmt(d.gamesPlayed))}
          </div>
          <h3>Snowballs unlocked</h3>
          <div class="ball-row">${balls}</div>
          <h3>Best on each level</h3>
          <table class="board levels-table"><thead><tr><th>#</th><th>Level</th><th>Best</th><th>Stars</th></tr></thead><tbody>${rows}</tbody></table>
          <div class="btn-row">
            <button class="btn red" data-action="board">&#127942; Online Leaderboard</button>
            <button class="btn ghost" data-action="reset">Reset Progress</button>
            <button class="btn primary" data-action="back">Back</button>
          </div>
        </div>`,
        {
          label: "High scores",
          back: () => this.showTitle(),
          actions: {
            back: () => this.showTitle(),
            board: () => this.showLeaderboard(() => this.showScores()),
            reset: () => this.confirmReset(() => this.showScores()),
          },
        },
      );
    }

    confirmReset(back) {
      this.show(
        "confirm",
        `<div class="panel">
          <h2>Reset progress?</h2>
          <p>This clears your best scores, stars, unlocked levels and snowballs on this device. Settings are kept. The online leaderboard isn't affected.</p>
          <div class="btn-row">
            <button class="btn red" data-action="yes">Reset</button>
            <button class="btn ghost" data-action="no" data-focus>Cancel</button>
          </div>
        </div>`,
        {
          label: "Confirm reset",
          back,
          actions: {
            yes: () => {
              this.storage.resetProgress();
              back();
            },
            no: back,
          },
        },
      );
    }

    // ---------------------------------------------------------------- Settings

    showSettings(back) {
      const s = this.storage.data.settings;
      const pct = (v) => Math.round(v * 100);
      const choice = (key, val, label) => `<label class="choice"><input type="radio" name="${key}" value="${val}" data-setting="${key}" ${String(s[key]) === val ? "checked" : ""}><span>${label}</span></label>`;
      const fsOn = this.fs.isOn();
      this.show(
        "settings",
        `<div class="panel">
          <h2>Settings</h2>
          <div class="setting"><label for="set-music">Music volume <b id="music-val">${pct(s.music)}%</b></label><input id="set-music" type="range" min="0" max="100" value="${pct(s.music)}" data-setting="music"></div>
          <div class="setting"><label for="set-sfx">Sound effects volume <b id="sfx-val">${pct(s.sfx)}%</b></label><input id="set-sfx" type="range" min="0" max="100" value="${pct(s.sfx)}" data-setting="sfx"></div>
          <div class="setting row"><span>Sound</span><div class="choices">${choice("muted", "false", "On")}${choice("muted", "true", "Off")}</div></div>
          <div class="setting row"><span>Aim guide</span><div class="choices">${choice("aimGuide", "true", "Full")}${choice("aimGuide", "false", "Short")}</div></div>
          ${this.fs.supported() ? `<div class="setting row"><span>Full screen on start</span><div class="choices">${choice("fullscreen", "true", "On")}${choice("fullscreen", "false", "Off")}</div></div>` : ""}
          <div class="btn-row">
            ${this.fs.supported() ? `<button class="btn purple" data-action="fs">${fsOn ? "Exit Full Screen" : "Go Full Screen"}</button>` : ""}
            <button class="btn primary" data-action="back">Done</button>
          </div>
        </div>`,
        {
          label: "Settings",
          back,
          actions: {
            back,
            fs: () => {
              this.fs.toggle();
              setTimeout(() => this.current === "settings" && this.showSettings(back), 300);
            },
          },
        },
      );
    }

    onSetting(el) {
      const s = this.storage.data.settings;
      const key = el.dataset.setting;
      if (key === "music" || key === "sfx") {
        s[key] = Number(el.value) / 100;
        const label = this.root.querySelector(`#${key}-val`);
        if (label) label.textContent = `${el.value}%`;
        this.audio.applyVolumes();
        if (key === "sfx" && el.type === "range") this.audio.play("bell", 0.6);
      } else if (key === "muted") {
        this.audio.setMuted(el.value === "true");
      } else if (key === "fullscreen" || key === "aimGuide") {
        s[key] = el.value === "true";
      }
      this.storage.save();
    }

    // ---------------------------------------------------------------- Pause

    showPause() {
      const campaign = this.game.mode === "campaign";
      this.show(
        "pause",
        `<div class="panel">
          <h2>Paused</h2>
          <p class="sub">Level ${this.game.levelIndex + 1}: ${esc(this.game.level.name)}</p>
          <p class="quip">"${esc(G.pick(["DON'T TAKE TOO LONG. CHRISTMAS WON'T SMASH ITSELF!", "A GRINCH NEEDS A BREAK TOO.", "I'M COUNTING THE ORNAMENTS. ALL OF THEM."]))}"</p>
          <div class="btn-col">
            <button class="btn primary big" data-action="resume">&#9654; Resume</button>
            <button class="btn gold" data-action="restart">Restart Level</button>
            <button class="btn sky" data-action="howto">How to Play</button>
            <button class="btn ghost" data-action="settings">Settings</button>
            <button class="btn red" data-action="quit">${campaign ? "End Run" : "Main Menu"}</button>
          </div>
        </div>`,
        {
          label: "Paused",
          back: () => this.game.resume(),
          actions: {
            resume: () => this.game.resume(),
            restart: () => this.game.restartLevel(),
            howto: () => this.showHowTo(() => this.showPause()),
            settings: () => this.showSettings(() => this.showPause()),
            quit: () => {
              if (campaign) {
                this.game.endRun();
              } else {
                this.game.quitToMenu();
                this.showTitle();
              }
            },
          },
        },
      );
    }

    // ---------------------------------------------------------------- Level results

    showLevelComplete(r) {
      const campaign = r.mode === "campaign";
      const bonusRows = r.bonuses.map(([label, pts, note]) => `<div class="bonus"><span>${esc(label)} <small>${esc(note)}</small></span><b>+${G.fmt(pts)}</b></div>`).join("");
      const unlocks = r.unlocked
        .map((t) => `<div class="unlock">${this.ballImg(t, 44)}<span><b>NEW: ${esc(G.SNOWBALLS[t].name)}!</b><small>${esc(G.SNOWBALLS[t].desc)}</small></span></div>`)
        .join("");
      const stat = (label, val) => `<div class="stat"><span>${esc(label)}</span><b>${val}</b></div>`;
      const nextLabel = r.last ? (campaign ? "Finish Run!" : "Level Select") : "Next Level &#9654;";
      setTimeout(() => {
        for (let i = 0; i < r.stars; i++) setTimeout(() => this.current === "complete" && this.audio.play("star", i), 350 + i * 350);
      }, 0);
      this.show(
        "complete",
        `<div class="panel result win">
          <div class="result-top">
            ${this.grinchImg("celebrate", 96, 0.15)}
            <div>
              <h2>LEVEL ${r.level} COMPLETE!</h2>
              <p class="sub">${esc(r.name)}</p>
              ${this.starRow(r.stars, true)}
            </div>
          </div>
          <p class="final-score">${G.fmt(r.score)}${r.newBest ? ' <span class="good-tag">NEW BEST!</span>' : ""}</p>
          <div class="stats">
            ${stat("Objects smashed", `${r.counted} / ${r.total}`)}
            ${stat("Destruction", `${r.percent}%`)}
            ${stat("Highest combo", r.bestCombo)}
            ${stat("Snowballs left", r.unused)}
          </div>
          ${bonusRows ? `<div class="bonuses">${bonusRows}</div>` : ""}
          ${unlocks}
          ${campaign ? `<p class="meta">Run total: <b>${G.fmt(r.runTotal)}</b> &middot; Lives: <b>${this.game.run.lives}</b></p>` : ""}
          <div class="btn-row">
            <button class="btn ghost" data-action="retry">Retry Level</button>
            <button class="btn primary big" data-action="next" data-focus>${nextLabel}</button>
            <button class="btn red" data-action="menu">${campaign ? "End Run" : "Main Menu"}</button>
          </div>
        </div>`,
        {
          label: "Level complete",
          actions: {
            retry: () => this.game.retryLevel(),
            next: () => this.game.nextLevel(),
            menu: () => {
              if (campaign) this.game.endRun();
              else {
                this.game.quitToMenu();
                this.showTitle();
              }
            },
          },
        },
      );
    }

    showLevelFailed(r, final) {
      const campaign = r.mode === "campaign";
      const stat = (label, val) => `<div class="stat"><span>${esc(label)}</span><b>${val}</b></div>`;
      this.show(
        "failed",
        `<div class="panel result lose">
          <div class="result-top">
            ${this.grinchImg("disappointed", 96, 0.5)}
            <div>
              <h2>${final ? "OUT OF LIVES!" : "OUT OF SNOWBALLS!"}</h2>
              <p class="sub">Level ${r.level}: ${esc(r.name)}</p>
              <p class="quip small">"${esc(G.pick(G.QUIPS.fail))}"</p>
            </div>
          </div>
          <p class="final-score">${G.fmt(r.score)} <small>/ ${G.fmt(r.target)} needed</small></p>
          <div class="stats">
            ${stat("Objects smashed", `${r.counted} / ${r.total}`)}
            ${stat("Destruction", `${r.percent}%`)}
            ${stat("Highest combo", r.bestCombo)}
            ${campaign ? stat("Lives left", r.lives) : stat("Goal", G.fmt(r.target))}
          </div>
          <p class="sub tip">Tip: ${esc(this.game.level.tip)}</p>
          <div class="btn-row">
            ${
              final
                ? '<button class="btn primary big" data-action="over" data-focus>See Results</button>'
                : `<button class="btn primary big" data-action="retry" data-focus>Try Again</button>
                   <button class="btn red" data-action="menu">${campaign ? "End Run" : "Main Menu"}</button>`
            }
          </div>
        </div>`,
        {
          label: "Level failed",
          actions: {
            retry: () => this.game.retryLevel(),
            over: () => {
              if (this.game.state === "result") this.game.gameOver(false);
            },
            menu: () => {
              if (campaign) this.game.endRun();
              else {
                this.game.quitToMenu();
                this.showTitle();
              }
            },
          },
        },
      );
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
        `<div class="panel result ${r.victory ? "win" : "lose"} scroll">
          <div class="result-top">
            ${this.grinchImg(r.victory ? "celebrate" : "laugh", 100, r.victory ? 0.15 : 0.4)}
            <div>
              <h2>${r.victory ? "CHRISTMAS IS SMASHED!" : "GAME OVER"}</h2>
              <p class="final-label">Final score</p>
              <p class="final-score">${G.fmt(r.score)}</p>
              ${r.newBest ? '<span class="good-tag">NEW BEST SCORE!</span>' : `<p class="sub">Best: ${G.fmt(r.best)}</p>`}
            </div>
          </div>
          <div class="stats">
            ${stat("Levels completed", `${r.completed} / 20`)}
            ${stat("Objects smashed", G.fmt(r.smashed))}
            ${stat("Chain reactions", G.fmt(r.chains))}
            ${stat("Highest combo", G.fmt(r.bestCombo))}
            ${stat("Best score", G.fmt(r.best))}
            ${stat("Reached level", r.reached)}
          </div>
          <div class="submit-box">
            <h3>&#127942; Online Leaderboard</h3>
            ${
              canSubmit
                ? `<form class="name-form" data-form="submit" ${this.submitted ? "hidden" : ""}>
                    <input id="player-name" type="text" maxlength="${this.lb.NAME_MAX}" autocomplete="nickname" enterkeyhint="send" placeholder="Your name" value="${esc(name)}" aria-label="Your name for the leaderboard">
                    <button class="btn gold" type="submit" data-submit>Submit Score</button>
                  </form>`
                : '<p class="sub">Smash something next time to get on the leaderboard!</p>'
            }
            <p class="status" id="submit-status" role="status">${this.submitted ? "Score submitted!" : ""}</p>
            <div id="inline-board"></div>
          </div>
          <div class="btn-row">
            <button class="btn primary big" data-action="again">Play Again</button>
            <button class="btn red" data-action="board">View Leaderboard</button>
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
          level: r.reached,
          smashed: r.smashed,
          combo: r.bestCombo,
          chains: r.chains,
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
              <td class="num">${row.finished ? "&#127873; 20" : row.level}</td>
              <td class="num">${G.fmt(row.smashed)}</td>
              <td class="num">${G.fmt(row.combo)}</td>
            </tr>`;
          })
          .join("");
        box.innerHTML = `<table class="board">
          <thead><tr><th>#</th><th>Name</th><th>Score</th><th>Level</th><th>Smashed</th><th>Combo</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
        ${highlight && !marked ? '<p class="sub">Your score didn\'t make the top 10 this time. Keep smashing!</p>' : ""}`;
      } catch (error) {
        if (token !== this.boardToken || !box.isConnected) return;
        box.innerHTML = `<p class="sub">${esc(this.lb.explain(error))}</p><div class="btn-row"><button class="btn small" data-action="retryBoard">Try Again</button></div>`;
      }
    }

    showLeaderboard(back) {
      this.show(
        "leaderboard",
        `<div class="panel wide scroll">
          <h2>&#127942; Leaderboard</h2>
          <p class="sub">The top 10 Grinches of all time. Finish a run to add your score!</p>
          <div id="board-box"></div>
          <div class="btn-row">
            <button class="btn sky" data-action="refresh">Refresh</button>
            <button class="btn primary" data-action="back">Back</button>
          </div>
        </div>`,
        {
          label: "Leaderboard",
          back,
          actions: {
            back,
            refresh: () => this.renderBoard(this.root.querySelector("#board-box"), this.highlight),
            retryBoard: () => this.renderBoard(this.root.querySelector("#board-box"), this.highlight),
          },
          after: (el) => this.renderBoard(el.querySelector("#board-box"), this.highlight),
        },
      );
    }
  }

  G.UI = UI;
})(window.GS);
