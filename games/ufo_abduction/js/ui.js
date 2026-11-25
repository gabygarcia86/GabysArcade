/*
 * Menus and overlay screens, built as HTML over the canvas. Every button is wired through
 * data-action, so a screen's markup and its behaviour sit side by side.
 */
(function (U) {
  "use strict";

  const esc = U.escapeHtml;

  class UI {
    constructor(game, deps) {
      this.game = game;
      this.root = document.getElementById("ui");
      this.pauseBtn = document.getElementById("pause-btn");
      this.storage = deps.storage;
      this.audio = deps.audio;
      this.input = deps.input;
      this.lb = U.Leaderboard;
      this.relayout = deps.relayout;
      this.autoFullscreen = deps.autoFullscreen;
      this.toggleFullscreen = deps.toggleFullscreen;
      this.actions = {};
      this.backAction = null;
      this.result = null;
      this.submitted = false;
      this.boardMode = "classic";
      this.boardToken = 0;

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
      const focus = this.root.querySelector("[autofocus], .btn.primary, .btn, .mode-card");
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
      const prev = { name: this.current, html: this.root.innerHTML };
      this.show(
        "confirm",
        `<div class="panel confirm">
          <h2>${esc(title)}</h2>
          <p>${esc(message)}</p>
          <div class="btn-row">
            <button class="btn pink" data-action="yes">${esc(yesLabel)}</button>
            <button class="btn ghost" data-action="no">Cancel</button>
          </div>
        </div>`,
        { actions: { yes: onYes, no: onNo }, back: onNo },
      );
      return prev;
    }

    // ---------------------------------------------------------------- Title and modes

    showTitle() {
      this.audio.playMusic("menu");
      this.show(
        "title",
        `<h1 class="logo">UFO<span>ABDUCTION</span></h1>
        <p class="tagline">Beam 'em up. Dodge the bulls. Bring the family home.</p>
        <div class="menu">
          <button class="btn primary" data-action="start">&#9654; Start Game</button>
          <button class="btn mint" data-action="customize">Customize UFO</button>
          <div class="menu-row">
            <button class="btn gold" data-action="leaderboard">Leaderboard</button>
            <button class="btn pink" data-action="album">Family Album</button>
          </div>
          <div class="menu-row">
            <button class="btn sky" data-action="howto">How to Play</button>
            <button class="btn" data-action="highscores">High Scores</button>
          </div>
          <div class="menu-row">
            <button class="btn purple" data-action="settings">Settings</button>
            <a class="btn orange" href="../../index.html">Arcade</a>
          </div>
        </div>`,
        {
          cls: "title-screen",
          label: "Title",
          actions: {
            start: () => this.showModes(),
            customize: () => this.showCustomize(() => this.showTitle()),
            leaderboard: () => this.showLeaderboard("classic", () => this.showTitle()),
            album: () => this.showAlbum(() => this.showTitle()),
            howto: () => this.showHowTo(() => this.showTitle()),
            highscores: () => this.showHighScores(() => this.showTitle()),
            settings: () => this.showSettings(() => this.showTitle()),
          },
        },
      );
    }

    showModes() {
      const best = (m) => U.formatScore(this.storage.best(m));
      this.show(
        "modes",
        `<div class="panel wide">
          <h2>Choose a Mission</h2>
          <p class="sub">Your best scores are saved on this device.</p>
          <div class="mode-cards">
            <button class="mode-card" data-action="classic">
              <strong>Classic Arcade</strong>
              <span>Five levels, from the Country Farm to a Tropical Island. Beam up as many as you can before each clock runs out. Three hull points.</span>
              <em>Best: ${best("classic")}</em>
            </button>
            <button class="mode-card endless" data-action="endless">
              <strong>Endless Abduction</strong>
              <span>No clock. The world changes every minute and gets tougher each time. Keep going until your saucer goes down.</span>
              <em>Best: ${best("endless")}</em>
            </button>
          </div>
          <div class="btn-row"><button class="btn ghost" data-action="back">Back</button></div>
        </div>`,
        {
          label: "Choose a mode",
          back: () => this.showTitle(),
          actions: {
            classic: () => this.start("classic"),
            endless: () => this.start("endless"),
          },
        },
      );
    }

    start(mode) {
      // Phones and tablets go full screen. It has to happen straight from the tap.
      this.autoFullscreen();
      this.game.startRun(mode);
    }

    // ---------------------------------------------------------------- How to play

    showHowTo(back) {
      const targetCards = Object.entries(U.TARGET_TYPES)
        .map(([key, t]) => `<div class="sprite-card"><canvas data-target="${key}" width="168" height="140"></canvas><b>${esc(t.name)}</b><span class="pts">${t.points}</span></div>`)
        .join("");
      const hazardCards = Object.entries(U.HAZARDS)
        .map(([key, h]) => `<div class="sprite-card bad"><canvas data-hazard="${key}" width="168" height="140"></canvas><b>${esc(h.name)}</b>${esc(h.desc)}</div>`)
        .join("");
      const familyCards = U.FAMILY.map((m) => `<div class="sprite-card"><canvas data-alien="${m.id}" width="168" height="140"></canvas><b>${esc(m.name)}</b><span class="pts">+${U.formatScore(m.points)}</span></div>`).join("");
      const powerCards = Object.entries(U.POWERUPS)
        .map(([key, p]) => `<div class="sprite-card"><canvas data-power="${key}" width="168" height="140"></canvas><b>${esc(p.name)}</b>${esc(p.desc)}</div>`)
        .join("");

      this.show(
        "howto",
        `<div class="panel wide howto">
          <h2>How to Play</h2>
          <h3>Flying the saucer</h3>
          <div class="keys">
            <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>&#8592;</kbd><kbd>&#8593;</kbd><kbd>&#8594;</kbd><kbd>&#8595;</kbd></span><span>Fly in any direction</span>
            <span><kbd>Space</kbd></span><span>Tractor beam (hold, or tap to toggle in Settings)</span>
            <span><kbd>Esc</kbd> / <kbd>P</kbd></span><span>Pause</span>
            <span>Touch</span><span>Joystick on the left, big BEAM button on the right</span>
          </div>
          <h3>The tractor beam</h3>
          <ul>
            <li>The beam only reaches about <b>half the screen</b> down, so <b>fly low</b> to grab people and animals.</li>
            <li>Hold it over them and they float up in about a second. Several at once is fine!</li>
            <li>Move too fast, or let go, and they fall back down.</li>
          </ul>
          <h3>Targets</h3>
          <div class="sprite-grid">${targetCards}</div>
          <h3>Danger! Don't touch, don't beam</h3>
          <ul>
            <li>Hazards have <b>angry eyebrows</b> and a <b>red ring</b> under them. A red <b>!</b> means one is about to strike.</li>
            <li>Beaming a hazard <b>hurts your saucer</b>. You have <b>3 hull points</b>; damage also resets your combo.</li>
          </ul>
          <div class="sprite-grid">${hazardCards}</div>
          <h3>Rescue your alien family</h3>
          <ul>
            <li>Your relatives are stranded on rooftops, towers and in bushes, next to their crashed escape pods.</li>
            <li>They hide until you fly near, then wave and shout. Beam them aboard for a big bonus.</li>
            <li>Rescue <b>all seven in one game</b> for the <b>Family Reunion: +10,000!</b></li>
          </ul>
          <div class="sprite-grid">${familyCards}</div>
          <h3>Power-ups</h3>
          <p>Fly into them, or pull them in with the beam.</p>
          <div class="sprite-grid">${powerCards}</div>
          <h3>Scoring</h3>
          <ul>
            <li>Abduct quickly to build a <b>combo</b>: every 4 in a row adds to the multiplier, up to <b>x5</b>.</li>
            <li>Wait more than 4 seconds, or take damage, and the combo resets.</li>
            <li>Streaks: <b>5 in a row +500</b>, <b>10 in a row +1,500</b>, then +3,000 every 10 after 20.</li>
            <li>Classic level bonuses: <b>1,000 x level</b>, <b>no damage +2,500</b>, <b>20+ abductions +2,000</b>.</li>
          </ul>
          <div class="btn-row"><button class="btn primary" data-action="back">Got it!</button></div>
        </div>`,
        { label: "How to play", back, after: (el) => this.paintPreviews(el) },
      );
    }

    paintPreviews(el) {
      const t = 1.3;
      el.querySelectorAll("canvas").forEach((c) => {
        const ctx = c.getContext("2d");
        ctx.setTransform(2, 0, 0, 2, 0, 0);
        ctx.clearRect(0, 0, 84, 70);
        if (c.dataset.target) {
          const type = U.TARGET_TYPES[c.dataset.target];
          const s = Math.min(1, 58 / type.h, 76 / (type.w + 20)) * (type.scale || 1);
          ctx.translate(42, 66);
          ctx.scale(s, s);
          U.Art.drawCharacter(ctx, type.art, { t, phase: 1, moving: false, lx: 0.4, ly: 0 });
        } else if (c.dataset.hazard) {
          drawHazardPreview(ctx, c.dataset.hazard, t);
        } else if (c.dataset.alien) {
          ctx.translate(42, 66);
          ctx.scale(0.62, 0.62);
          U.Art.drawAlien(ctx, c.dataset.alien, { t, wave: true, lx: 0 });
        } else if (c.dataset.power) {
          U.drawPowerIcon(ctx, c.dataset.power, 42, 36, 20, t, true);
        }
      });
    }

    // ---------------------------------------------------------------- Settings

    showSettings(back) {
      const s = this.storage.data.settings;
      const slider = (key, label) => `
        <div class="setting">
          <label for="set-${key}">${label}</label>
          <input id="set-${key}" type="range" min="0" max="100" step="5" value="${Math.round(s[key] * 100)}" data-setting="${key}">
          <output id="out-${key}">${Math.round(s[key] * 100)}</output>
        </div>`;
      const choice = (key, label, options) => `
        <div class="setting choice">
          <span>${label}</span>
          <div class="seg" role="group" aria-label="${esc(label)}">
            ${options.map(([value, text]) => `<button type="button" data-action="choose" data-key="${key}" data-value="${value}" aria-pressed="${String(s[key]) === String(value)}">${text}</button>`).join("")}
          </div>
        </div>`;
      this.show(
        "settings",
        `<div class="panel">
          <h2>Settings</h2>
          <div class="settings">
            <h3>Sound</h3>
            ${slider("master", "Master volume")}
            ${slider("music", "Music")}
            ${slider("sfx", "Sound effects")}
            ${choice("muted", "Mute all", [["false", "Sound on"], ["true", "Muted"]])}
            <h3>Controls</h3>
            ${choice("beamMode", "Tractor beam", [["hold", "Hold"], ["toggle", "Tap to toggle"]])}
            ${choice("touch", "Touch controls", [["auto", "Auto"], ["on", "Always"], ["off", "Hidden"]])}
            ${choice("stick", "Joystick", [["floating", "Follows thumb"], ["fixed", "Fixed"]])}
            ${choice("leftHanded", "Layout", [["false", "Stick left"], ["true", "Stick right"]])}
            <h3>Display</h3>
            ${choice("shake", "Screen shake", [["true", "On"], ["false", "Off"]])}
            <div class="setting choice"><span>Full screen</span><div class="seg"><button type="button" data-action="fullscreen">Toggle full screen</button></div></div>
          </div>
          <div class="btn-row">
            <button class="btn primary" data-action="back">Done</button>
            <button class="btn ghost small" data-action="reset">Reset progress</button>
          </div>
        </div>`,
        {
          label: "Settings",
          back,
          actions: {
            choose: (el) => {
              const key = el.dataset.key;
              let value = el.dataset.value;
              if (value === "true" || value === "false") value = value === "true";
              s[key] = value;
              el.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
              this.applySettings();
            },
            fullscreen: () => this.toggleFullscreen(),
            reset: () =>
              this.confirm(
                "Reset progress?",
                "This clears your high scores, the family album and your totals on this device. Settings are kept.",
                "Reset",
                () => {
                  this.storage.resetProgress();
                  this.showSettings(back);
                },
                () => this.showSettings(back),
              ),
          },
          after: (el) => {
            el.querySelectorAll("input[type=range]").forEach((input) => {
              input.addEventListener("input", () => {
                const key = input.dataset.setting;
                s[key] = Number(input.value) / 100;
                el.querySelector(`#out-${key}`).textContent = input.value;
                this.applySettings();
              });
              input.addEventListener("change", () => this.audio.play("click"));
            });
          },
        },
      );
    }

    applySettings() {
      this.audio.applyVolumes();
      this.storage.saveSoon();
      this.input.placeStickHome();
      this.input.updateBeamButton();
      this.relayout();
    }

    // ---------------------------------------------------------------- Customize UFO

    showCustomize(back, tab = "ship") {
      const parts = U.UFO_PARTS;
      const style = this.storage.data.ufo;
      const tabs = [
        ["ship", "Ship"],
        ["colors", "Colors"],
        ["lights", "Lights"],
        ["extras", "Accessories"],
        ["driver", "Driver"],
      ];
      let current = tab;
      let cheerUntil = 0;

      // An unknown saved value shows the default as chosen, since that's what gets drawn.
      const chosen = (key) => (parts[key].some((p) => p.id === style[key]) ? style[key] : U.UFO_DEFAULT[key]);
      const pressed = (key, id) => String(chosen(key) === id);
      const card = (key, p) =>
        `<button type="button" class="opt-card" data-action="pick" data-key="${key}" data-value="${p.id}" aria-pressed="${pressed(key, p.id)}">
          <canvas data-preview="${key}" data-value="${p.id}" width="192" height="160" aria-hidden="true"></canvas>
          <b>${esc(p.name)}</b>
        </button>`;
      const swatches = (key, label, bg) =>
        `<h3>${label}</h3>
        <div class="swatches" role="group" aria-label="${esc(label)}">
          ${parts[key].map((p) => `<button type="button" class="swatch" data-action="pick" data-key="${key}" data-value="${p.id}" aria-pressed="${pressed(key, p.id)}" aria-label="${esc(p.name)}" title="${esc(p.name)}" style="--sw: ${bg(p)}"></button>`).join("")}
        </div>`;
      const bodies = {
        ship: () => `<div class="opt-grid">${parts.ship.map((p) => card("ship", p)).join("")}</div>`,
        colors: () =>
          swatches("hull", "Hull", (p) => `linear-gradient(180deg, ${p.g[0]}, ${p.g[1]} 45%, ${p.g[2]})`) +
          swatches("trim", "Trim", (p) => p.c) +
          swatches("dome", "Dome glass", (p) => p.swatch),
        lights: () =>
          `<h3>Pattern</h3>
          <div class="seg" role="group" aria-label="Light pattern">
            ${parts.lights.map((p) => `<button type="button" data-action="pick" data-key="lights" data-value="${p.id}" aria-pressed="${pressed("lights", p.id)}">${esc(p.name)}</button>`).join("")}
          </div>
          ${swatches("lightColor", "Light color", (p) => p.c)}
          <p class="cust-note">Rainbow, Siren and Disco pick their own colors.</p>`,
        extras: () => `<div class="opt-grid">${parts.accessory.map((p) => card("accessory", p)).join("")}</div>`,
        driver: () => `<div class="opt-grid">${parts.driver.map((p) => card("driver", p)).join("")}</div>`,
      };

      let root = null;
      const caption = () => {
        const S = U.Art.resolveUFO(style);
        root.querySelector(".ufo-name").textContent = `${S.ship.name}, piloted by ${S.driver.name}`;
      };
      const paintCards = () => {
        root.querySelectorAll("canvas[data-preview]").forEach((c) => {
          const ctx = c.getContext("2d");
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, c.width, c.height);
          ctx.setTransform(2, 0, 0, 2, 0, 0);
          const key = c.dataset.preview;
          const value = c.dataset.value;
          if (key === "driver") {
            U.Art.drawDriver(ctx, 48, 62, 1.9, value, { t: 1.3, mood: "happy" });
          } else {
            const s = { ...style, [key]: value };
            U.Art.drawUFO(ctx, 48, key === "accessory" ? 54 : 48, { t: 1.3, look: 0.2, scale: key === "accessory" ? 0.6 : 0.62, style: s });
          }
        });
      };
      const renderBody = () => {
        root.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === current)));
        root.querySelector(".cust-body").innerHTML = bodies[current]();
        paintCards();
        caption();
      };
      const changed = () => {
        this.storage.saveSoon();
        cheerUntil = performance.now() + 1100;
        caption();
      };

      this.show(
        "customize",
        `<div class="panel wide customize">
          <h2>Customize UFO</h2>
          <div class="ufo-stage">
            <canvas class="ufo-preview" aria-hidden="true"></canvas>
            <div class="ufo-name" aria-live="polite"></div>
          </div>
          <div class="tabs" role="tablist" aria-label="Customize">
            ${tabs.map(([id, label]) => `<button type="button" role="tab" data-action="tab" data-tab="${id}" aria-selected="${id === current}">${label}</button>`).join("")}
          </div>
          <div class="cust-body"></div>
          <div class="btn-row">
            <button class="btn gold" data-action="random">Surprise Me!</button>
            <button class="btn primary" data-action="back">Done</button>
          </div>
          <div class="btn-row"><button class="btn ghost small" data-action="reset">Back to the classic look</button></div>
        </div>`,
        {
          label: "Customize UFO",
          back,
          actions: {
            tab: (el) => {
              current = el.dataset.tab;
              renderBody();
            },
            pick: (el) => {
              style[el.dataset.key] = el.dataset.value;
              root.querySelectorAll(`[data-action="pick"][data-key="${el.dataset.key}"]`).forEach((b) => b.setAttribute("aria-pressed", String(b === el)));
              paintCards();
              changed();
            },
            random: () => {
              for (const key of Object.keys(parts)) style[key] = U.pick(parts[key]).id;
              // Keep the lights on for a surprise; "Off" can still be chosen by hand.
              if (style.lights === "off") style.lights = "rainbow";
              renderBody();
              changed();
            },
            reset: () => {
              Object.assign(style, U.UFO_DEFAULT);
              renderBody();
              changed();
            },
          },
          after: (el) => {
            root = el;
            renderBody();
            const canvas = el.querySelector(".ufo-preview");
            const ctx = canvas.getContext("2d");
            // The big preview animates until the screen closes.
            const frame = (now) => {
              if (!canvas.isConnected) return;
              const dpr = Math.min(2, window.devicePixelRatio || 1);
              const w = canvas.clientWidth;
              const h = canvas.clientHeight;
              if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
                canvas.width = Math.round(w * dpr);
                canvas.height = Math.round(h * dpr);
              }
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, w, h);
              const t = now / 1000;
              const s = Math.min(1.55, w / 190);
              U.Draw.shadow(ctx, w / 2, h - 14, 46 * s, 0.25);
              U.Art.drawUFO(ctx, w / 2, h * 0.62 + Math.sin(t * 2) * 4, {
                t,
                tilt: Math.sin(t * 1.3) * 0.06,
                look: Math.sin(t * 0.7),
                beam: t % 5 > 3.6,
                cheer: now < cheerUntil,
                scale: s,
              });
              requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          },
        },
      );
    }

    // ---------------------------------------------------------------- Pause

    showPause() {
      this.show(
        "pause",
        `<div class="panel confirm">
          <h2>Paused</h2>
          <p class="sub">Your saucer is hovering patiently.</p>
          <div class="menu" style="margin: 10px auto 0">
            <button class="btn primary" data-action="resume">&#9654; Resume</button>
            <button class="btn sky" data-action="restart">Restart</button>
            <div class="menu-row">
              <button class="btn purple" data-action="settings">Settings</button>
              <button class="btn sky" data-action="howto">How to Play</button>
            </div>
            <button class="btn pink" data-action="menu">Main Menu</button>
          </div>
        </div>`,
        {
          label: "Paused",
          actions: {
            resume: () => this.game.resume(),
            restart: () =>
              this.confirm("Restart?", "Your current score will be lost.", "Restart", () => {
                this.autoFullscreen();
                this.game.restart();
              }, () => this.showPause()),
            settings: () => this.showSettings(() => this.showPause()),
            howto: () => this.showHowTo(() => this.showPause()),
            menu: () => this.confirm("Quit to the main menu?", "Your current score will be lost.", "Quit", () => this.game.toMenu(), () => this.showPause()),
          },
        },
      );
    }

    // ---------------------------------------------------------------- Level complete

    showLevelComplete(d) {
      const rows = [
        ["Level score", U.formatScore(d.stageScore)],
        ["Abductions", d.abductions],
        ["Alien rescues", d.rescues],
      ];
      const bonusRows = d.bonuses.map((b) => `<div class="bonus" style="animation-delay:${0.1 * (rows.length + 1)}s"><span>${esc(b.label)}</span><b>+${U.formatScore(b.points)}</b></div>`).join("");
      this.show(
        "levelComplete",
        `<div class="panel">
          <h2>Level ${d.level} Complete!</h2>
          <p class="sub">${esc(d.name)} has been thoroughly abducted.</p>
          <div class="stats">
            ${rows.map(([k, v], i) => `<div style="animation-delay:${i * 0.1}s"><span>${k}</span><b>${v}</b></div>`).join("")}
            ${bonusRows}
            <div class="total" style="animation-delay:${0.1 * (rows.length + d.bonuses.length + 1)}s"><span>Total score</span><b>${U.formatScore(d.score)}</b></div>
          </div>
          ${d.repaired ? `<p>The repair crew patched up one hull point.</p>` : ""}
          ${d.last ? `<p>That was the final level. Time to head home!</p>` : ""}
          <div class="btn-row"><button class="btn primary" data-action="continue">${d.last ? "Finish Mission" : "Next Level &#9654;"}</button></div>
        </div>`,
        { label: "Level complete", actions: { continue: () => this.game.continueAfterLevel() } },
      );
    }

    // ---------------------------------------------------------------- Game over

    showGameOver(result) {
      if (result) {
        this.result = result;
        this.submitted = false;
      }
      const r = this.result;
      const title = r.completed ? "Mission Complete!" : r.mode === "endless" ? "UFO Down!" : "Game Over";
      const levelLabel = r.mode === "classic" ? (r.finished ? "All 5 levels" : `Level ${r.level}`) : `Zone ${r.level}`;
      const name = this.lb.loadName();
      const canSubmit = r.score > 0;
      this.show(
        "gameOver",
        `<div class="panel">
          <h2>${title}</h2>
          <div class="big-score">${U.formatScore(r.score)}</div>
          ${r.newBest ? `<div class="badge">NEW HIGH SCORE!</div>` : `<p class="sub">Best ${r.mode === "classic" ? "Classic" : "Endless"} score: ${U.formatScore(this.storage.best(r.mode))}</p>`}
          <div class="stats">
            <div><span>Reached</span><b>${levelLabel}</b></div>
            <div><span>Total abductions</span><b>${r.abductions}</b></div>
            <div><span>Alien rescues</span><b>${r.rescues}${r.reunions ? ` (${r.reunions} reunion${r.reunions > 1 ? "s" : ""}!)` : ""}</b></div>
            <div><span>Highest combo</span><b>${r.bestCombo}</b></div>
            <div><span>Flight time</span><b>${U.formatDuration(r.seconds)}</b></div>
          </div>
          <div class="submit-box">
            <h3>Online Leaderboard</h3>
            ${
              canSubmit
                ? `<form class="name-form" data-form="submit" ${this.submitted ? "hidden" : ""}>
                    <input id="player-name" type="text" maxlength="24" autocomplete="nickname" enterkeyhint="send" placeholder="Your name" value="${esc(name)}" aria-label="Your name for the leaderboard">
                    <button class="btn gold" type="submit" data-submit>Submit Score</button>
                  </form>`
                : `<p>Score some points to get on the board!</p>`
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
          actions: {
            again: () => {
              this.autoFullscreen();
              this.game.startRun(r.mode);
            },
            board: () => this.showLeaderboard(r.mode, () => this.showGameOver()),
            menu: () => this.game.toMenu(),
            submitScore: () => this.submitScore(),
          },
          after: (el) => {
            if (this.submitted) this.renderBoard(el.querySelector("#inline-board"), r.mode, true);
          },
        },
      );
    }

    async submitScore() {
      if (this.submitted || this.submitting) return;
      const r = this.result;
      const input = this.root.querySelector("#player-name");
      const status = this.root.querySelector("#submit-status");
      const button = this.root.querySelector("[data-submit]");
      if (!input || !status) return;
      const name = this.lb.cleanName(input.value);
      if (!name) {
        status.className = "status err";
        status.textContent = "Type a name first.";
        input.focus();
        return;
      }
      this.submitting = true;
      button.disabled = true;
      status.className = "status";
      status.textContent = "Sending your score...";
      try {
        await this.lb.submit({ ...r, name });
        this.lb.saveName(name);
        this.submitted = true;
        this.myEntry = { name, score: r.score, mode: r.mode };
        if (this.current !== "gameOver") return;
        status.className = "status ok";
        status.textContent = "Score submitted!";
        const form = this.root.querySelector("[data-form=submit]");
        if (form) form.hidden = true;
        this.renderBoard(this.root.querySelector("#inline-board"), r.mode, true);
      } catch (error) {
        if (this.current !== "gameOver") return;
        status.className = "status err";
        status.textContent = this.lb.explain(error);
        button.disabled = false;
      } finally {
        this.submitting = false;
      }
    }

    // Fetches a top 10 into `box`, highlighting the score just submitted.
    async renderBoard(box, mode, compact) {
      if (!box) return;
      const token = ++this.boardToken;
      box.innerHTML = `<div class="board-msg">Loading the top 10...</div>`;
      try {
        const rows = await this.lb.top(mode, 10);
        if (token !== this.boardToken || !box.isConnected) return;
        if (!rows.length) {
          box.innerHTML = `<div class="board-msg">No scores yet. Be the first!</div>`;
          return;
        }
        let marked = false;
        const me = this.myEntry && this.myEntry.mode === mode ? this.myEntry : null;
        const body = rows
          .map((row, i) => {
            const mine = !marked && me && row.name === me.name && row.score === me.score;
            if (mine) marked = true;
            const detail = mode === "classic" ? (row.finished ? "All 5 levels" : `Level ${row.level}`) : `Zone ${row.level} &middot; ${U.formatDuration(row.seconds)}`;
            return `<tr class="${mine ? "me" : ""}">
              <td>${i + 1}</td>
              <td class="name">${esc(row.name)}${compact ? "" : `<div class="detail">${detail} &middot; ${row.rescues} rescued &middot; combo ${row.bestCombo}</div>`}</td>
              <td class="num">${U.formatScore(row.score)}</td>
            </tr>`;
          })
          .join("");
        box.innerHTML = `<table class="board"><thead><tr><th>#</th><th>Name</th><th class="num">Score</th></tr></thead><tbody>${body}</tbody></table>`;
      } catch (error) {
        if (token !== this.boardToken || !box.isConnected) return;
        box.innerHTML = `<div class="board-msg">${esc(this.lb.explain(error))}</div>`;
      }
    }

    // ---------------------------------------------------------------- Leaderboard

    showLeaderboard(mode, back) {
      this.boardMode = mode || this.boardMode;
      const tab = (m, label) => `<button type="button" role="tab" data-action="tab" data-mode="${m}" aria-selected="${this.boardMode === m}">${label}</button>`;
      this.show(
        "leaderboard",
        `<div class="panel">
          <h2>Leaderboard</h2>
          <p class="sub">The top 10 saucer pilots in the world.</p>
          <div class="tabs" role="tablist">${tab("classic", "Classic")}${tab("endless", "Endless")}</div>
          <div id="board"></div>
          <div class="btn-row">
            <button class="btn primary" data-action="back">Back</button>
            <button class="btn ghost small" data-action="refresh">Refresh</button>
          </div>
        </div>`,
        {
          label: "Leaderboard",
          back,
          actions: {
            tab: (el) => {
              this.boardMode = el.dataset.mode;
              this.root.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b === el)));
              this.renderBoard(this.root.querySelector("#board"), this.boardMode, false);
            },
            refresh: () => this.renderBoard(this.root.querySelector("#board"), this.boardMode, false),
          },
          after: (el) => this.renderBoard(el.querySelector("#board"), this.boardMode, false),
        },
      );
    }

    showHighScores(back) {
      const list = (mode) => {
        const rows = this.storage.data.high[mode];
        if (!rows.length) return `<div class="board-msg">No ${mode} games yet.</div>`;
        return `<table class="board"><thead><tr><th>#</th><th>Reached</th><th class="num">Score</th></tr></thead><tbody>${rows
          .map((r, i) => `<tr><td>${i + 1}</td><td class="name">${mode === "classic" ? `Level ${r.level}` : `Zone ${r.level}`}<div class="detail">${r.abductions} abducted &middot; ${r.rescues} rescued &middot; ${esc(r.date)}</div></td><td class="num">${U.formatScore(r.score)}</td></tr>`)
          .join("")}</tbody></table>`;
      };
      this.show(
        "highscores",
        `<div class="panel">
          <h2>High Scores</h2>
          <p class="sub">Your best games on this device.</p>
          <h3>Classic Arcade</h3>
          ${list("classic")}
          <h3>Endless Abduction</h3>
          ${list("endless")}
          <div class="btn-row"><button class="btn primary" data-action="back">Back</button></div>
        </div>`,
        { label: "High scores", back },
      );
    }

    // ---------------------------------------------------------------- Family album

    showAlbum(back) {
      const data = this.storage.data;
      const found = U.FAMILY.filter((m) => this.storage.isUnlocked(m.id)).length;
      const cards = U.FAMILY.map((m) => {
        const n = data.album[m.id] || 0;
        return `<div class="album-card ${n ? "found" : ""}">
          <canvas data-portrait="${m.id}" width="220" height="220" aria-hidden="true"></canvas>
          <b>${n ? esc(m.name) : "???"}</b>
          <span class="pts">+${U.formatScore(m.points)}</span>
          <span class="state">${n ? `Rescued &times;${n}` : "Still missing"}</span>
        </div>`;
      }).join("");
      this.show(
        "album",
        `<div class="panel wide">
          <h2>Alien Family Album</h2>
          <p class="sub">Rescue a relative to unlock their portrait. Find all seven in one game for a family reunion!</p>
          <div class="album-grid">${cards}</div>
          <div class="album-summary">${found}/7 found &middot; ${data.reunions} reunion${data.reunions === 1 ? "" : "s"} &middot; ${U.formatScore(data.totals.abductions)} lifetime abductions</div>
          <div class="btn-row"><button class="btn primary" data-action="back">Back</button></div>
        </div>`,
        {
          label: "Family album",
          back,
          after: (el) => {
            el.querySelectorAll("canvas[data-portrait]").forEach((c) => {
              const id = c.dataset.portrait;
              const ctx = c.getContext("2d");
              ctx.setTransform(2, 0, 0, 2, 0, 0);
              ctx.translate(55, 102);
              ctx.scale(1.12, 1.12);
              U.Art.drawAlien(ctx, id, { t: 1.2, happy: true, wave: false, lx: 0 });
              if (!this.storage.isUnlocked(id)) {
                // A silhouette: paint over only the alien's own pixels.
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalCompositeOperation = "source-atop";
                ctx.fillStyle = "#120a2a";
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.globalCompositeOperation = "source-over";
                ctx.fillStyle = "#8c78e8";
                ctx.font = "800 64px Oxanium, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("?", c.width / 2, c.height * 0.48);
              }
            });
          },
        },
      );
    }
  }

  // Small previews of each hazard for the instructions, using made-up state.
  function drawHazardPreview(ctx, key, t) {
    const views = {
      bull: [0.55, 64], tractor: [0.5, 64], fence: [0.33, 58], power: [0.38, 64], rocket: [0.5, 62],
      giantFarmer: [0.25, 66], tank: [0.5, 62], policeCar: [0.55, 60], resident: [0.55, 64], jeep: [0.5, 62],
      dustDevil: [0.18, 66], monkey: [0.85, 62], helicopter: [0.42, 40], cloud: [0.36, 34], eagle: [0.6, 40], pelican: [0.55, 40],
    };
    const [s, y] = views[key];
    const m = {
      x: 0, y: 0, groundY: 0, facing: 1, phase: 1, moving: false, lift: 0, charging: false, snort: 0, spin: 0.5,
      aim: 0.6, recoil: 0, w: key === "power" ? 180 : 220, variant: key === "power" ? "power" : key === "pelican" ? "pelican" : "farm",
      zapTop: -170, zapping: true, tilt: 0, telegraph: 0, diving: false, throwT: 0, shout: 0, height: 330,
      boltBottom: 80, striking: key === "cloud", alpha: 1,
    };
    const art = key === "power" ? "fence" : key === "pelican" ? "eagle" : key;
    ctx.save();
    ctx.translate(42, y);
    ctx.scale(s, s);
    U.Art.hazards[art](ctx, m, t);
    ctx.restore();
  }

  U.UI = UI;
})(window.UFO);
