/*
 * UIManager owns the DOM side of the game: the screens, the HUD, the level-complete and
 * galaxy banners and the touch pad. Screens are plain HTML buttons, so focus, Enter and
 * screen readers work without extra code. Arrow keys move focus to the nearest button.
 */
(function (D) {
  const { LevelManager } = D;

  const icon = {
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v11.6A3.5 3.5 0 1 0 11 18V8h8V4z"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM15.5 8.5a5 5 0 0 1 0 7l-1.2-1.2a3.3 3.3 0 0 0 0-4.6z"/></svg>',
  };

  class UIManager {
    constructor(game) {
      this.game = game;
      this.screens = document.getElementById("screens");
      this.banner = document.getElementById("banner");
      this.hud = document.getElementById("hud");
      this.pad = document.getElementById("pad");
      this.toastBox = document.getElementById("toast");
      this.current = null;
      this.returnTo = "menu";
      this.previews = [];
      this.pendingDroid = null;
      this.hudState = {};
      this.toastTimer = null;

      this.hud.innerHTML = `
        <div class="stat"><span>Score</span><b id="hud-score">0</b></div>
        <div class="stat"><span>High</span><b id="hud-high">0</b></div>
        <div class="stat"><span>Level</span><b id="hud-level">1</b></div>
        <div class="stat"><span>Cycle</span><b id="hud-cycle">1</b></div>
        <div class="stat lives"><span>Lives</span><canvas id="hud-lives" aria-label="Lives remaining"></canvas></div>
        <div class="hud-buttons">
          <button type="button" id="hud-music" aria-label="Toggle music" title="Music">${icon.music}</button>
          <button type="button" id="hud-sound" aria-label="Toggle all sound" title="Sound">${icon.sound}</button>
          <button type="button" id="hud-pause" aria-label="Pause" title="Pause (Esc)">${icon.pause}</button>
        </div>`;
      this.hudEls = {
        score: document.getElementById("hud-score"),
        high: document.getElementById("hud-high"),
        level: document.getElementById("hud-level"),
        cycle: document.getElementById("hud-cycle"),
        lives: document.getElementById("hud-lives"),
      };

      document.getElementById("hud-pause").addEventListener("click", () => this.game.togglePause());
      document.getElementById("hud-music").addEventListener("click", (event) => {
        this.toggleOption("musicOn");
        event.currentTarget.blur();
      });
      document.getElementById("hud-sound").addEventListener("click", (event) => {
        this.toggleOption("muted");
        event.currentTarget.blur();
      });

      // Every button on every screen is wired up through its data-action.
      const onClick = (event) => {
        const button = event.target.closest("[data-action]");
        if (!button || button.disabled) return;
        const [action, value] = button.dataset.action.split(":");
        const fromKeyboard = event.detail === 0;
        this.actions[action].call(this, value, fromKeyboard);
      };
      this.screens.addEventListener("click", onClick);
      this.banner.addEventListener("click", onClick);
      this.screens.addEventListener("input", (event) => {
        const { key } = event.target.dataset;
        if (!key) return;
        this.game.save.setOption(key, Number(event.target.value));
        this.game.audio.applyVolumes();
      });
      this.screens.addEventListener("change", (event) => {
        if (event.target.dataset.key === "sfx") this.game.audio.sfx("gear");
      });
      this.screens.addEventListener("focusin", (event) => {
        const { droid } = event.target.dataset;
        if (droid) this.setInfo(droid);
      });

      this.syncAudioButtons();
    }

    /* ---------- Screens ---------- */

    get open() { return this.current !== null; }

    show(name) {
      this.current = name;
      this.previews.length = 0;
      this.screens.innerHTML = this.templates[name].call(this);
      this.screens.scrollTop = 0;
      this.collectPreviews(this.screens);
      this.onShown[name] && this.onShown[name].call(this);
      const first = this.screens.querySelector("[data-primary]") || this.screens.querySelector("button:not([disabled])");
      if (first) first.focus({ preventScroll: true });
    }

    hide() {
      this.current = null;
      this.previews.length = 0;
      this.screens.innerHTML = "";
    }

    showBanner(html) {
      this.banner.innerHTML = html;
      this.banner.hidden = false;
      this.collectPreviews(this.banner);
      const button = this.banner.querySelector("button");
      if (button) button.focus({ preventScroll: true });
    }

    hideBanner() {
      this.banner.hidden = true;
      this.banner.classList.remove("full");
      this.banner.innerHTML = "";
    }

    collectPreviews(root) {
      root.querySelectorAll("canvas[data-art]").forEach((canvas) => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const box = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(box.width * dpr));
        canvas.height = Math.max(1, Math.round(box.height * dpr));
        const context = canvas.getContext("2d");
        const entry = { canvas, context, art: canvas.dataset.art, dpr, w: box.width, h: box.height };
        if (entry.art === "gear" || entry.art === "power") this.paintIcon(entry);
        else this.previews.push(entry);
      });
    }

    paintIcon({ context: c, art, dpr, w, h }) {
      c.setTransform(dpr, 0, 0, dpr, w / 2 * dpr, h / 2 * dpr);
      if (art === "gear") D.Art.gear(c, Math.min(w, h) * 0.3, "#ffe88a", "#3a3010");
      else D.Art.insignia(c, Math.min(w, h) * 0.42, "#ff6a4a");
    }

    // Keeps every visible droid portrait moving. Called once per frame.
    tick(t) {
      const { anim } = this.game;
      for (const preview of this.previews) {
        const { context: c, canvas, art, dpr, w, h } = preview;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, canvas.width, canvas.height);
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
        const size = Math.min(w, h) * 0.44;
        const active = canvas.closest(".picked");
        if (active) anim.drawDancer(c, art, w / 2, h / 2, size * 0.86, t);
        else anim.drawPortrait(c, art, w / 2, h / 2, size, t + (D.SPRITE_INDEX[art] || 0), false);
      }
    }

    // Moves focus to the closest control in the pressed direction.
    moveFocus(dir) {
      const root = this.current ? this.screens : this.banner;
      const items = [...root.querySelectorAll("button:not([disabled]), input")];
      if (!items.length) return;
      const active = document.activeElement;
      if (!root.contains(active) || active === root) {
        items[0].focus();
        return;
      }
      const from = active.getBoundingClientRect();
      const fromX = from.left + from.width / 2;
      const fromY = from.top + from.height / 2;
      let best = null;
      let bestScore = Infinity;
      for (const item of items) {
        if (item === active) continue;
        const box = item.getBoundingClientRect();
        const dx = box.left + box.width / 2 - fromX;
        const dy = box.top + box.height / 2 - fromY;
        const along = dx * D.DX[dir] + dy * D.DY[dir];
        const across = Math.abs(dx * D.DY[dir]) + Math.abs(dy * D.DX[dir]);
        if (along <= 1) continue;
        const score = along + across * 2.2;
        if (score < bestScore) {
          bestScore = score;
          best = item;
        }
      }
      if (best) {
        best.focus();
        best.scrollIntoView({ block: "nearest" });
        this.game.audio.sfx("move");
      }
    }

    // Enter presses the focused button, or the screen's main button if nothing has focus.
    confirm() {
      const root = this.current ? this.screens : this.banner;
      const active = document.activeElement;
      const focused = active && active.tagName === "BUTTON" && root.contains(active) ? active : null;
      const button = focused || root.querySelector("[data-primary]") || root.querySelector("button");
      if (!button) return false;
      button.click();
      return true;
    }

    back() {
      if (!this.current || this.current === "menu" || this.current === "gameover") return;
      this.game.audio.sfx("back");
      if (this.current === "pause") {
        this.game.resume();
        return;
      }
      this.show(this.returnTo);
    }

    setInfo(id) {
      const info = D.DROIDS.find((droid) => droid.id === id);
      const box = document.getElementById("droid-info");
      if (!info || !box) return;
      const locked = id === "b1" && !this.game.save.data.unlockedB1;
      box.textContent = locked ? "Clear Level 5 to unlock this droid." : `${info.name}: ${info.line}`;
    }

    /* ---------- HUD ---------- */

    setPlaying(on) {
      this.hud.hidden = false;
      this.hud.style.visibility = on ? "visible" : "hidden";
      this.pad.hidden = !(on && this.touchEnabled);
    }

    get touchEnabled() {
      const { touch } = this.game.save.options;
      if (touch === "on") return true;
      if (touch === "off") return false;
      return window.matchMedia("(pointer: coarse)").matches;
    }

    syncAudioButtons() {
      const { musicOn, muted } = this.game.save.options;
      document.getElementById("hud-music").classList.toggle("off", !musicOn);
      document.getElementById("hud-sound").classList.toggle("off", muted);
    }

    toggleOption(key) {
      const { save, audio } = this.game;
      save.setOption(key, !save.options[key]);
      audio.applyVolumes();
      this.syncAudioButtons();
    }

    updateHud() {
      const { score, levels, droidId } = this.game;
      const state = this.hudState;
      const set = (key, value, el, text) => {
        if (state[key] === value) return;
        state[key] = value;
        el.textContent = text;
      };
      set("score", score.score, this.hudEls.score, D.fmt(score.score));
      set("high", score.high, this.hudEls.high, D.fmt(score.high));
      set("level", levels.number, this.hudEls.level, `${levels.number}/10`);
      set("cycle", levels.cycle, this.hudEls.cycle, String(levels.cycle));
      const livesKey = `${score.lives}:${droidId}`;
      if (state.lives !== livesKey) {
        state.lives = livesKey;
        this.drawLives(score.lives, droidId);
      }
    }

    drawLives(count, id) {
      const canvas = this.hudEls.lives;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      const h = box.height || 22;
      const w = box.width || 90;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const c = canvas.getContext("2d");
      c.scale(dpr, dpr);
      const size = h / 2;
      const shown = Math.min(count, Math.floor(w / (size * 2)));
      for (let i = 0; i < shown; i++) {
        c.save();
        c.translate(size + i * size * 2, size);
        c.scale(size * 0.9, size * 0.9);
        D.Art.draw(c, id);
        c.restore();
      }
      canvas.setAttribute("aria-label", `${count} lives remaining`);
    }

    toast(text) {
      this.toastBox.textContent = text;
      this.toastBox.classList.add("show");
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => this.toastBox.classList.remove("show"), 3600);
    }

    /* ---------- Banners ---------- */

    showLevelClear(levelName, bonus) {
      this.showBanner(`
        <div class="clear-card">
          <h2>Level Complete!</h2>
          <p class="clear-sub">${levelName} cleared</p>
          <p class="clear-bonus">+${D.fmt(bonus)}</p>
          <p class="clear-next" id="clear-next"></p>
        </div>`);
    }

    setCountdown(text) {
      const el = document.getElementById("clear-next");
      if (el && el.textContent !== text) el.textContent = text;
    }

    showGalaxy(cycle, bonus) {
      this.banner.classList.add("full");
      this.showBanner(`
        <div class="galaxy-card">
          <h2>The Galaxy Is Safe!</h2>
          <p class="clear-sub">Cycle ${cycle} complete. All ten worlds cleared.</p>
          <p class="clear-bonus">+${D.fmt(bonus)}</p>
          <p class="clear-next" id="clear-next"></p>
          <button type="button" class="btn primary" data-action="continue">Start Cycle ${cycle + 1}</button>
        </div>`);
    }
  }

  /* ---------- Button behavior ---------- */

  UIManager.prototype.actions = {
    play() {
      this.game.audio.sfx("select");
      this.game.newGame();
    },
    open(name) {
      this.game.audio.sfx("select");
      this.returnTo = this.current === "pause" ? "pause" : "menu";
      this.show(name);
    },
    back() { this.back(); },
    pick(id, fromKeyboard) {
      const { save, audio } = this.game;
      if (id === "b1" && !save.data.unlockedB1) {
        audio.sfx("back");
        return;
      }
      this.pendingDroid = id;
      audio.voice(id);
      this.screens.querySelectorAll(".droid-card").forEach((card) => {
        card.classList.toggle("picked", card.dataset.droid === id);
      });
      this.setInfo(id);
      if (fromKeyboard) this.actions.confirmDroid.call(this);
    },
    confirmDroid() {
      const { save, audio } = this.game;
      if (this.pendingDroid) {
        save.data.droid = this.pendingDroid;
        save.save();
      }
      audio.sfx("select");
      this.show("menu");
    },
    difficulty(value) {
      this.game.save.setOption("difficulty", value);
      this.game.audio.sfx("select");
      this.markChoice("difficulty", value);
    },
    touch(value) {
      this.game.save.setOption("touch", value);
      this.game.audio.sfx("select");
      this.markChoice("touch", value);
      this.game.resize();
    },
    mute() {
      this.toggleOption("muted");
      this.show("options");
      this.game.audio.sfx("select");
    },
    resume() { this.game.resume(); },
    restart() {
      this.game.audio.sfx("select");
      this.game.newGame();
    },
    quit() {
      this.game.audio.sfx("back");
      this.game.toMenu();
    },
    continue() { this.game.finishGalaxy(); },
  };

  UIManager.prototype.markChoice = function (group, value) {
    this.screens.querySelectorAll(`[data-action^="${group}:"]`).forEach((button) => {
      const on = button.dataset.action === `${group}:${value}`;
      button.classList.toggle("on", on);
      button.setAttribute("aria-pressed", on);
    });
  };

  const scoreRows = (scores) => {
    if (!scores.length) return '<p class="muted">No scores yet. Be the first droid on the board.</p>';
    return `<ol class="scores">${scores.map((entry) => {
      const droid = D.DROIDS.find((d) => d.id === entry.droid);
      return `<li><b>${D.fmt(entry.score)}</b><span>${droid ? droid.name : ""}</span><span>L${entry.level} C${entry.cycle}</span></li>`;
    }).join("")}</ol>`;
  };

  /* ---------- Screen markup ---------- */

  UIManager.prototype.templates = {
    menu() {
      const { data } = this.game.save;
      return `
        <div class="panel menu">
          <h1 class="logo" aria-label="Droid-Chomp">DROID<span>-</span>CHOMP</h1>
          <p class="tagline">Collect the gears. Dodge the Empire. Dance about it.</p>
          <div class="menu-cast" aria-hidden="true">
            <canvas data-art="${data.droid}"></canvas>
            ${D.ENEMY_IDS.map((id) => `<canvas data-art="${id}"></canvas>`).join("")}
          </div>
          <div class="menu-body">
            <div class="menu-buttons">
              <button type="button" class="btn primary" data-primary data-action="play">Play Game</button>
              <button type="button" class="btn" data-action="open:select">Choose Droid</button>
              <button type="button" class="btn" data-action="open:instructions">Instructions</button>
              <button type="button" class="btn" data-action="open:options">Options</button>
            </div>
            <section class="menu-scores" aria-label="High scores">
              <h2>High Scores</h2>
              ${scoreRows(data.scores)}
            </section>
          </div>
        </div>`;
    },

    select() {
      const { data } = this.game.save;
      this.pendingDroid = data.droid;
      const cards = D.DROIDS.map((droid) => {
        const locked = droid.locked && !data.unlockedB1;
        return `
          <button type="button" class="droid-card${droid.id === data.droid ? " picked" : ""}${locked ? " locked" : ""}"
            data-droid="${droid.id}" data-action="pick:${droid.id}" ${droid.id === data.droid ? "data-primary" : ""}
            aria-label="${droid.name}${locked ? ", locked" : ""}">
            <canvas data-art="${droid.id}" aria-hidden="true"></canvas>
            <span>${locked ? "Locked" : droid.name}</span>
          </button>`;
      }).join("");
      return `
        <div class="panel wide">
          <h2>Choose Your Droid</h2>
          <div class="droid-grid">${cards}</div>
          <p class="droid-info" id="droid-info" aria-live="polite"></p>
          <div class="row">
            <button type="button" class="btn" data-action="back">Back</button>
            <button type="button" class="btn primary" data-action="confirmDroid">Select Droid</button>
          </div>
        </div>`;
    },

    instructions() {
      const enemies = D.ENEMIES.map((enemy) => `
        <li><canvas data-art="${enemy.id}" aria-hidden="true"></canvas>
          <div><b style="color:${enemy.color}">${enemy.name}</b><span>${enemy.role}</span></div></li>`).join("");
      return `
        <div class="panel wide scroll">
          <h2>How to Play</h2>
          <div class="help-grid">
            <section>
              <h3>Mission</h3>
              <p>Collect every gear in the maze to clear the level. Clear all ten worlds, then do it again, faster.</p>
              <ul class="items">
                <li><canvas data-art="gear" aria-hidden="true"></canvas><div><b>Gear</b><span>10 points</span></div></li>
                <li><canvas data-art="power" aria-hidden="true"></canvas><div><b>Rebel Insignia</b><span>50 points. Enemies turn blue and can be defeated, for about 8 seconds.</span></div></li>
              </ul>
              <h3>Controls</h3>
              <table class="keys">
                <tr><th>Move</th><td>Arrow keys or WASD. On touch screens, the pad or a swipe.</td></tr>
                <tr><th>Pause</th><td>Esc, or the pause button</td></tr>
                <tr><th>Confirm</th><td>Enter</td></tr>
              </table>
              <p class="muted">Press a direction early and your droid takes the next turn that way. Tunnels at the maze edges wrap around, and they slow enemies down.</p>
            </section>
            <section>
              <h3>Enemies</h3>
              <ul class="items">${enemies}</ul>
              <h3>Scoring</h3>
              <table class="keys">
                <tr><th>Enemies on one insignia</th><td>200, 400, 800, 1,600</td></tr>
                <tr><th>Level complete</th><td>1,000</td></tr>
                <tr><th>All ten levels</th><td>5,000</td></tr>
              </table>
            </section>
          </div>
          <div class="row"><button type="button" class="btn primary" data-primary data-action="back">Back</button></div>
        </div>`;
    },

    options() {
      const { options } = this.game.save;
      const choice = (group, value, label) => {
        const on = options[group] === value;
        return `<button type="button" class="chip${on ? " on" : ""}" aria-pressed="${on}" data-action="${group}:${value}">${label}</button>`;
      };
      const levels = Object.entries(LevelManager.DIFFICULTY).map(([key, value]) => choice("difficulty", key, value.label)).join("");
      return `
        <div class="panel">
          <h2>Options</h2>
          <label class="slider">Music <input type="range" min="0" max="1" step="0.05" value="${options.music}" data-key="music"></label>
          <label class="slider">Sound effects <input type="range" min="0" max="1" step="0.05" value="${options.sfx}" data-key="sfx"></label>
          <div class="option-row"><span>All audio</span>
            <button type="button" class="chip${options.muted ? " on" : ""}" aria-pressed="${options.muted}" data-action="mute">${options.muted ? "Muted" : "Mute"}</button></div>
          <div class="option-row"><span>Difficulty</span><div class="chips">${levels}</div></div>
          <p class="muted">Difficulty sets lives, enemy speed and power-up time. It applies from the next new game.</p>
          <div class="option-row"><span>Touch pad</span><div class="chips">
            ${choice("touch", "auto", "Auto")}${choice("touch", "on", "On")}${choice("touch", "off", "Off")}</div></div>
          <div class="row"><button type="button" class="btn primary" data-primary data-action="back">Back</button></div>
        </div>`;
    },

    pause() {
      const { levels } = this.game;
      return `
        <div class="panel">
          <h2>Paused</h2>
          <p class="muted">Level ${levels.number}: ${levels.level.name}, cycle ${levels.cycle}</p>
          <div class="menu-buttons">
            <button type="button" class="btn primary" data-primary data-action="resume">Resume</button>
            <button type="button" class="btn" data-action="open:options">Options</button>
            <button type="button" class="btn" data-action="open:instructions">Instructions</button>
            <button type="button" class="btn" data-action="restart">Restart Game</button>
            <button type="button" class="btn" data-action="quit">Main Menu</button>
          </div>
        </div>`;
    },

    gameover() {
      const { score, levels, save } = this.game;
      return `
        <div class="panel over">
          <h2 class="danger">Game Over</h2>
          <p class="final">${D.fmt(score.score)}</p>
          <p class="muted">Reached Level ${levels.number}: ${levels.level.name}, cycle ${levels.cycle}</p>
          ${score.newHigh ? '<p class="new-high">New High Score!</p>' : `<p class="muted">High score: ${D.fmt(save.data.highScore)}</p>`}
          <div class="row">
            <button type="button" class="btn primary" data-primary data-action="restart">Restart</button>
            <button type="button" class="btn" data-action="quit">Main Menu</button>
          </div>
        </div>`;
    },
  };

  UIManager.prototype.onShown = {
    select() { this.setInfo(this.pendingDroid); },
  };

  D.UIManager = UIManager;
})(window.DROID);
