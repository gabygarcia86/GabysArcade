/*
 * HUD is drawn on the canvas during play. UI builds the menus as HTML over the
 * canvas, sized from --u so they scale with the 960x540 game view.
 */
(function (J) {
  const { clamp, formatTime, roundRect, wrapText } = J.U;
  const { Art, JediCustomization } = J;
  const { SPECIES, HAIR, OUTFITS, PALETTES, SABER_TYPES } = JediCustomization;
  const W = J.VIEW_W;
  const H = J.VIEW_H;

  // ---------- HUD ----------

  class HUD {
    constructor(game) {
      this.game = game;
      this.damage = 0;
      this.energyFlash = 0;
      this.tipText = "";
      this.tipT = 0;
      this.bannerLine = null;
      this.bannerT = 0;
      this.toastText = "";
      this.toastT = 0;
      this.nameT = 0;
      this.shownHp = 100;
    }

    reset() {
      this.tipT = 0;
      this.bannerT = 0;
      this.toastT = 0;
      this.nameT = 4;
    }

    flashDamage() { this.damage = 1; }
    flashEnergy() { this.energyFlash = 0.5; }
    tip(text) {
      this.tipText = text;
      this.tipT = 6;
    }
    toast(text) {
      this.toastText = text;
      this.toastT = 2.6;
    }
    banner(speaker, text, seconds = 3) {
      this.bannerLine = { speaker, text };
      this.bannerT = seconds;
    }

    update(dt) {
      this.damage = Math.max(0, this.damage - dt * 2.4);
      this.energyFlash = Math.max(0, this.energyFlash - dt);
      this.tipT = Math.max(0, this.tipT - dt);
      this.bannerT = Math.max(0, this.bannerT - dt);
      this.toastT = Math.max(0, this.toastT - dt);
      this.nameT = Math.max(0, this.nameT - dt);
      const { player } = this.game;
      if (player) this.shownHp += (player.hp - this.shownHp) * Math.min(1, dt * 7);
    }

    bar(ctx, x, y, w, h, fraction, color, back = "rgba(4,8,18,.8)") {
      ctx.fillStyle = back;
      ctx.beginPath();
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - 6, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      const fill = clamp(fraction, 0, 1) * (w - 4);
      if (fill > 0) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 2);
        ctx.lineTo(x + 2 + fill, y + 2);
        ctx.lineTo(x + 2 + fill - 5, y + h - 2);
        ctx.lineTo(x + 2, y + h - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(160,210,255,.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - 6, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.stroke();
    }

    draw(ctx, t) {
      const { game } = this;
      const { player, stats, level } = game;
      if (!player) return;

      if (this.damage > 0) {
        const g = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 560);
        g.addColorStop(0, "rgba(255,0,0,0)");
        g.addColorStop(1, `rgba(255,20,10,${this.damage * 0.5})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Portrait, health, Force and lives, top left.
      Art.bust(ctx, "player", 14, 12, 50, t, game.jedi);
      const lowHp = player.hp < 30 && Math.floor(t * 4) % 2 === 0;
      this.bar(ctx, 70, 14, 210, 15, this.shownHp / player.maxHp, lowHp ? "#ff8a70" : "#ff4a4a");
      this.bar(ctx, 70, 32, 170, 11, player.energy / player.maxEnergy, this.energyFlash > 0 ? "#ffffff" : player.saber.fxColor(t));
      for (let i = 0; i < player.lives; i++) {
        ctx.save();
        ctx.translate(79 + i * 19, 54);
        ctx.fillStyle = "#ffd76a";
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, 0);
        ctx.lineTo(0, 6);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Score and pickups, top right.
      ctx.textAlign = "right";
      ctx.font = `800 20px ${J.FONT}`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      const right = game.touchActive ? W - 66 : W - 16;
      ctx.strokeText(String(stats.score).padStart(6, "0"), right, 32);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(stats.score).padStart(6, "0"), right, 32);
      ctx.font = `600 13px ${J.FONT}`;
      const line = `◆ ${stats.crystals}   ▣ ${stats.holocrons}/${level.totalHolocrons}`;
      ctx.strokeText(line, right, 52);
      ctx.fillStyle = "#a6e6ff";
      ctx.fillText(line, right, 52);

      if (this.nameT > 0) {
        ctx.globalAlpha = clamp(this.nameT, 0, 1);
        ctx.textAlign = "center";
        ctx.font = `700 15px ${J.FONT}`;
        ctx.strokeText(level.def.name.toUpperCase(), W / 2, 30);
        ctx.fillStyle = "#ffd76a";
        ctx.fillText(level.def.name.toUpperCase(), W / 2, 30);
        ctx.globalAlpha = 1;
      }

      const { boss } = game;
      if (boss && boss.state === "fight") {
        const bw = 520;
        const x = (W - bw) / 2;
        ctx.textAlign = "center";
        ctx.font = `800 14px ${J.FONT}`;
        ctx.strokeText(boss.name, W / 2, H - 42);
        ctx.fillStyle = "#ffd0c8";
        ctx.fillText(boss.name, W / 2, H - 42);
        this.bar(ctx, x, H - 36, bw, 16, boss.hp / boss.maxHp, "#e0322a");
      }
      if (boss && boss.clash) {
        const bw = 360;
        const x = (W - bw) / 2;
        this.bar(ctx, x, 130, bw, 18, boss.clash.meter, "#ffffff", "rgba(120,0,30,.85)");
      }
      if (player.choke) {
        ctx.textAlign = "center";
        ctx.font = `800 20px ${J.FONT}`;
        ctx.fillStyle = "#ffd76a";
        ctx.strokeText(game.touchActive ? "TAP SABER TO BREAK FREE!" : "HAMMER J TO BREAK FREE!", W / 2, 150);
        ctx.fillText(game.touchActive ? "TAP SABER TO BREAK FREE!" : "HAMMER J TO BREAK FREE!", W / 2, 150);
      }

      if (this.toastT > 0) {
        ctx.globalAlpha = clamp(this.toastT, 0, 1);
        ctx.textAlign = "center";
        ctx.font = `800 20px ${J.FONT}`;
        ctx.strokeText(this.toastText, W / 2, 104);
        ctx.fillStyle = "#6ef2a4";
        ctx.fillText(this.toastText, W / 2, 104);
        ctx.globalAlpha = 1;
      }

      if (this.bannerT > 0 && this.bannerLine) {
        const { speaker, text } = this.bannerLine;
        ctx.globalAlpha = clamp(this.bannerT * 2, 0, 1);
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillRect(0, 76, W, 44);
        ctx.textAlign = "center";
        ctx.font = `600 16px ${J.FONT}`;
        ctx.fillStyle = speaker ? "#ffb0a0" : "#ffd76a";
        ctx.fillText(speaker ? `${speaker}: ${text}` : text, W / 2, 103);
        ctx.globalAlpha = 1;
      }

      if (this.tipT > 0 && !game.scene) {
        ctx.globalAlpha = clamp(this.tipT * 2, 0, 1);
        ctx.font = `600 15px ${J.FONT}`;
        const lines = wrapText(ctx, this.tipText, 620);
        const boxW = Math.min(660, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
        const boxH = 16 + lines.length * 21;
        const y = game.touchActive ? 72 : H - boxH - 16;
        ctx.fillStyle = "rgba(6,12,30,.85)";
        ctx.strokeStyle = "rgba(124,200,255,.6)";
        ctx.lineWidth = 1;
        roundRect(ctx, (W - boxW) / 2, y, boxW, boxH, 5);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "#e6f0ff";
        lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 22 + i * 21));
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------- Menus ----------

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const CONTROLS = [
    ["Move", "A / D or Left / Right", "Arrow buttons"],
    ["Jump (hold for height)", "Space", "JUMP"],
    ["Lightsaber attack", "J", "SABER"],
    ["Force Push", "K", "PUSH"],
    ["Deflect (hold, time it for PERFECT)", "L", "DEFLECT"],
    ["Pause", "Esc", "II button"],
  ];

  class UI {
    constructor(game) {
      this.game = game;
      this.root = document.getElementById("ui");
      this.screen = null;
      this.backAction = null;
      this.previewLoop = null;
      this.thumbs = new Map();

      this.root.addEventListener("mouseover", (event) => {
        const target = event.target.closest && event.target.closest("button");
        if (target && !target.disabled && target !== this.lastHover) {
          this.lastHover = target;
          game.audio.play("hover");
        }
      });
      this.root.addEventListener("click", (event) => {
        if (event.target.closest && event.target.closest("button")) game.audio.play("click");
      });
      window.addEventListener("keydown", (event) => this.onKey(event));
    }

    get open() { return !!this.screen; }

    onKey(event) {
      if (!this.screen) return;
      if (event.code === "Escape") {
        if (event.target.tagName !== "INPUT" || event.target.type !== "text") {
          if (this.backAction) this.backAction();
          event.preventDefault();
        } else {
          event.target.blur();
        }
        return;
      }
      const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
      const dir = dirs[event.code];
      if (!dir) return;
      const active = document.activeElement;
      if (active && active.tagName === "INPUT" && active.type === "text") return;
      if (active && active.type === "range" && dir[0]) return;
      event.preventDefault();
      this.moveFocus(dir);
    }

    // Arrow keys jump to the nearest control in that direction.
    moveFocus([dx, dy]) {
      const items = [...this.screen.querySelectorAll("button:not([disabled]), input, a[href]")];
      if (!items.length) return;
      const active = document.activeElement;
      if (!items.includes(active)) {
        items[0].focus();
        return;
      }
      const from = active.getBoundingClientRect();
      const ax = from.left + from.width / 2;
      const ay = from.top + from.height / 2;
      let best = null;
      let bestScore = Infinity;
      for (const item of items) {
        if (item === active) continue;
        const r = item.getBoundingClientRect();
        const ox = r.left + r.width / 2 - ax;
        const oy = r.top + r.height / 2 - ay;
        const along = ox * dx + oy * dy;
        if (along <= 1) continue;
        const across = Math.abs(ox * dy) + Math.abs(oy * dx);
        const score = along + across * 2.4;
        if (score < bestScore) {
          bestScore = score;
          best = item;
        }
      }
      if (best) {
        best.focus();
        best.scrollIntoView({ block: "nearest" });
        this.game.audio.play("hover");
      }
    }

    show(screen, back) {
      this.close();
      this.screen = screen;
      this.backAction = back || null;
      this.root.appendChild(screen);
      const first = screen.querySelector("[data-first]") || screen.querySelector("button:not([disabled])");
      if (first) first.focus({ preventScroll: true });
    }

    close() {
      this.stopPreview();
      if (this.screen) this.screen.remove();
      this.screen = null;
      this.backAction = null;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    }

    button(label, onClick, cls = "") {
      const b = el("button", `btn ${cls}`, label);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    // ---------- Main menu ----------

    showMain() {
      const { game } = this;
      const s = el("div", "screen start");
      s.append(el("div", "logo-spacer"));
      const menu = el("div", "menu");
      menu.append(
        this.button("STORY MODE", () => this.showStory(), "primary"),
        this.button("LEVEL SELECT", () => game.requireJedi(() => this.showLevels())),
        this.button("CHARACTER CUSTOMIZATION", () => this.showCustomize(() => this.showMain())),
        this.button("OPTIONS", () => this.showOptions(() => this.showMain())),
        this.button("CREDITS", () => this.showCredits()),
      );
      s.append(menu);
      const back = el("a", "back-link", "Back to the arcade");
      back.href = "../../index.html";
      s.append(back);
      this.show(s);
    }

    pips() {
      const { game } = this;
      const row = el("div", "pips");
      J.LEVELS.forEach((def, i) => {
        const pip = el("div", "pip", String(i + 1));
        if (game.save.isCompleted(i)) pip.classList.add("done");
        else if (game.save.isUnlocked(i)) pip.classList.add("open");
        if (def.boss) pip.classList.add("boss");
        pip.title = def.name;
        row.append(pip);
      });
      return row;
    }

    showStory() {
      const { game } = this;
      const { save } = game;
      const s = el("div", "screen dim");
      s.append(el("h2", "title", "STORY MODE"));
      const done = Object.keys(save.data.completed).length;
      const started = !!save.data.jedi && (done > 0 || save.data.seenOpening);
      s.append(el("p", "sub", started ? `${done} of ${J.LEVELS.length} levels complete. Dashed rings are boss levels.` : "Ten worlds. Five Sith. One young Jedi."));
      s.append(this.pips());
      const menu = el("div", "menu");
      if (started) {
        const next = Math.min(save.data.unlockedLevel, J.LEVELS.length - 1);
        menu.append(this.button(`CONTINUE: LEVEL ${next + 1}`, () => game.playLevel(next, true), "primary"));
        const newRun = this.button("NEW CAMPAIGN", () => {
          this.confirm("Start a new campaign? Your completed levels and unlocked abilities will be erased. Your Jedi stays.", () => {
            save.resetCampaign();
            game.beginCampaign();
          }, () => this.showStory());
        }, "danger");
        menu.append(newRun);
      } else {
        menu.append(this.button("BEGIN", () => game.requireJedi(() => game.beginCampaign()), "primary"));
      }
      menu.append(this.button("BACK", () => this.showMain()));
      s.append(menu);
      this.show(s, () => this.showMain());
    }

    confirm(message, yes, no) {
      const s = el("div", "screen dim");
      s.append(el("h2", "title", "ARE YOU SURE?"));
      s.append(el("p", "sub", message));
      const row = el("div", "row");
      row.append(this.button("CANCEL", no), this.button("YES", yes, "danger"));
      s.append(row);
      this.show(s, no);
    }

    // ---------- Level select ----------

    showLevels() {
      const { game } = this;
      const { save } = game;
      const s = el("div", "screen solid");
      s.append(el("h2", "title", "LEVEL SELECT"));
      const grid = el("div", "level-grid");
      J.LEVELS.forEach((def, i) => {
        const unlocked = save.isUnlocked(i);
        const done = save.data.completed[i];
        const card = el("button", "level-card");
        card.type = "button";
        card.disabled = !unlocked;
        if (i === 0) card.dataset.first = "1";
        card.setAttribute("aria-label", `Level ${i + 1}: ${def.name}, ${def.planet}. ${unlocked ? (done ? "Completed" : "Unlocked") : "Locked"}`);
        card.append(this.thumbnail(def));
        const info = el("div", "level-info");
        info.append(el("b", null, `${i + 1}. ${def.name}`));
        info.append(el("span", null, def.planet));
        const meta = el("div", "level-meta");
        meta.append(el("span", null, `${"★".repeat(Math.ceil(def.difficulty / 2))}${"☆".repeat(5 - Math.ceil(def.difficulty / 2))}`));
        meta.append(el("span", null, done ? `▣ ${done.holocrons}/${done.totalHolocrons}` : ""));
        info.append(meta);
        card.append(info);
        if (done) card.append(el("span", "badge done", "COMPLETE"));
        else if (!unlocked) card.append(el("span", "badge lock", "LOCKED"));
        if (def.boss) card.append(el("span", "badge boss", "BOSS"));
        card.addEventListener("click", () => game.playLevel(i, false));
        grid.append(card);
      });
      s.append(grid);
      const row = el("div", "row");
      row.style.marginTop = ".7em";
      row.append(this.button("BACK", () => this.showMain()));
      s.append(row);
      this.show(s, () => this.showMain());
    }

    // Thumbnails take a moment to draw, so each is made once and then reused.
    thumbnail(def) {
      const canvas = J.U.makeCanvas(256, 144);
      const ctx = canvas.getContext("2d");
      const done = () => ctx.drawImage(this.thumbs.get(def.theme), 0, 0);
      if (this.thumbs.has(def.theme)) {
        done();
      } else {
        ctx.fillStyle = J.THEMES[def.theme].dark;
        ctx.fillRect(0, 0, 256, 144);
        setTimeout(() => {
          const source = J.U.makeCanvas(256, 144);
          J.drawThumbnail(source, def.theme);
          this.thumbs.set(def.theme, source);
          done();
        }, 16);
      }
      return canvas;
    }

    // ---------- Customization ----------

    showCustomize(onDone) {
      const { game } = this;
      const jedi = { ...game.jedi };
      const s = el("div", "screen solid start");
      s.style.padding = ".7em 1em";
      const layout = el("div", "custom");

      const preview = el("div", "custom-preview");
      const canvas = el("canvas");
      preview.append(canvas);
      const anims = el("div", "chips");
      preview.append(anims);
      const summary = el("div", "opt-title");
      preview.append(summary);
      const row = el("div", "row");
      const saveAndLeave = () => {
        jedi.name = JediCustomization.cleanName(nameInput.value);
        game.setJedi(jedi);
        onDone();
      };
      row.append(this.button("CONFIRM JEDI", saveAndLeave, "primary"), this.button("CANCEL", onDone));
      preview.append(row);

      const opts = el("div", "custom-opts");
      opts.append(el("div", "opt-title", "NAME"));
      const nameInput = el("input", "name-input");
      nameInput.type = "text";
      nameInput.maxLength = 14;
      nameInput.value = jedi.name;
      nameInput.setAttribute("aria-label", "Jedi name");
      opts.append(nameInput);

      const skinChipHost = el("div", "chips");
      const patternHost = el("div", "chips");
      const hairRow = el("div");
      const hairHost = el("div", "chips");

      const chips = (host, items, isOn, pick) => {
        host.replaceChildren();
        items.forEach((item, i) => {
          const chip = el("button", "chip");
          chip.type = "button";
          if (item.color) {
            const swatch = el("span", "swatch");
            swatch.style.background = item.color;
            chip.append(swatch);
          }
          chip.append(document.createTextNode(item.label));
          chip.classList.toggle("on", isOn(i, item));
          chip.setAttribute("aria-pressed", String(isOn(i, item)));
          chip.addEventListener("click", () => {
            pick(i, item);
            refresh();
            chip.focus({ preventScroll: true });
          });
          host.append(chip);
        });
      };

      const speciesHost = el("div", "chips");
      const outfitHost = el("div", "chips");
      const paletteHost = el("div", "chips");
      const saberHost = el("div", "chips");
      const typeHost = el("div", "chips");

      const sections = [
        ["SPECIES", speciesHost], ["SKIN", skinChipHost], ["MARKINGS AND FEATURES", patternHost],
        ["HAIR", hairHost], ["ROBES", outfitHost], ["COLORS", paletteHost],
        ["BLADE COLOR", saberHost], ["BLADE TYPE", typeHost],
      ];
      for (const [title, host] of sections) {
        const wrap = title === "HAIR" ? hairRow : el("div");
        wrap.append(el("div", "opt-title", title), host);
        opts.append(wrap);
      }

      const state = { anim: "auto", turn: 0, saber: new J.Lightsaber(jedi.saber, jedi.saberType) };

      const refresh = () => {
        const species = SPECIES[jedi.species];
        chips(speciesHost, SPECIES.map((sp) => ({ label: sp.name })), (i) => i === jedi.species, (i) => {
          jedi.species = i;
          jedi.skin = 0;
          jedi.pattern = 0;
        });
        chips(skinChipHost, species.skins.map(([label, color]) => ({ label, color })), (i) => i === jedi.skin, (i) => { jedi.skin = i; });
        chips(patternHost, species.patterns.map((label) => ({ label })), (i) => i === jedi.pattern, (i) => { jedi.pattern = i; });
        hairRow.hidden = !species.hair;
        chips(hairHost, HAIR.map(([label, color]) => ({ label, color })), (i) => i === jedi.hair, (i) => { jedi.hair = i; });
        chips(outfitHost, OUTFITS.map((o) => ({ label: o.name })), (i) => i === jedi.outfit, (i) => { jedi.outfit = i; });
        chips(paletteHost, PALETTES.map((p) => ({ label: p.name, color: p.tunic })), (i) => i === jedi.palette, (i) => { jedi.palette = i; });
        chips(saberHost, Object.entries(J.Lightsaber.COLORS).map(([id, c]) => ({ label: c.name, id, color: c.rainbow ? "conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" : c.blade })),
          (i, item) => item.id === jedi.saber, (i, item) => {
            jedi.saber = item.id;
            game.audio.play("saberOn");
          });
        chips(typeHost, SABER_TYPES.map((o) => ({ label: o.name, id: o.id })), (i, item) => item.id === jedi.saberType, (i, item) => {
          jedi.saberType = item.id;
          game.audio.play("saberOn");
        });
        state.saber = new J.Lightsaber(jedi.saber, jedi.saberType);
        state.skin = Art.jediSkin(jedi);
        summary.textContent = `${species.name} · ${OUTFITS[jedi.outfit].name} · ${J.Lightsaber.COLORS[jedi.saber].name} ${jedi.saberType === "double" ? "double blade" : "blade"}`;
      };

      const ANIMS = [["Auto", "auto"], ["Idle", "idle"], ["Run", "run"], ["Attack", "attack"], ["Deflect", "deflect"], ["Push", "push"]];
      const drawAnimChips = () => {
        chips(anims, ANIMS.map(([label, id]) => ({ label, id })), (i, item) => item.id === state.anim, (i, item) => {
          state.anim = item.id;
          drawAnimChips();
        });
      };

      refresh();
      drawAnimChips();
      layout.append(preview, opts);
      s.append(layout);
      this.show(s, onDone);
      this.startPreview(canvas, state);
    }

    startPreview(canvas, state) {
      const ctx = canvas.getContext("2d");
      const start = performance.now();
      let dragging = false;
      let lastX = 0;
      canvas.addEventListener("pointerdown", (event) => {
        dragging = true;
        lastX = event.clientX;
        canvas.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        state.turn += (event.clientX - lastX) * 0.012;
        lastX = event.clientX;
      });
      canvas.addEventListener("pointerup", () => { dragging = false; });
      canvas.addEventListener("pointercancel", () => { dragging = false; });

      const frame = (now) => {
        if (this.previewLoop === null) return;
        this.previewLoop = requestAnimationFrame(frame);
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(10, Math.round(rect.width * dpr));
        const h = Math.max(10, Math.round(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const t = (now - start) / 1000;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#101a38");
        g.addColorStop(1, "#050812");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "rgba(124,200,255,.12)";
        ctx.beginPath();
        ctx.ellipse(w * 0.42, h * 0.84, w * 0.34, h * 0.04, 0, 0, J.TAU);
        ctx.fill();

        let anim = state.anim;
        if (anim === "auto") anim = ["idle", "attack", "run", "deflect", "push"][Math.floor(t / 2.4) % 5];
        const cycle = t % 1;
        let p;
        if (anim === "attack") p = Art.pose(["slash1", "slash2", "slash3"][Math.floor(t * 2) % 3], (t * 2) % 1);
        else if (anim === "push") p = Art.pose("push", cycle);
        else if (anim === "deflect") p = Art.pose("deflect", t);
        else if (anim === "run") p = Art.pose("run", t);
        else p = Art.pose("idle", t);

        const turn = state.turn + (dragging ? 0 : Math.sin(t * 0.4) * 0.14);
        const c = Math.cos(turn);
        const facing = c >= 0 ? 1 : -1;
        const squeeze = Math.max(0.3, Math.abs(c));
        const scale = Math.min(h / 105, w / 125) * 0.8;
        ctx.save();
        ctx.translate(w * 0.42, h * 0.84);
        ctx.scale(scale * squeeze * facing, scale);
        Art.jedi(ctx, state.skin, state.saber, 0, 0, 1, p, t, anim === "run" ? 0.8 : Math.sin(t * 1.3) * 0.1);
        ctx.restore();
      };
      this.previewLoop = requestAnimationFrame(frame);
    }

    stopPreview() {
      if (this.previewLoop !== null) cancelAnimationFrame(this.previewLoop);
      this.previewLoop = null;
    }

    // ---------- Options, controls, credits ----------

    showOptions(back) {
      const { game } = this;
      const { options } = game.save;
      const s = el("div", "screen solid");
      s.append(el("h2", "title", "OPTIONS"));
      const panel = el("div", "panel");
      panel.style.width = "34em";

      const slider = (label, key, apply) => {
        const row = el("label", "opt-row");
        row.append(el("span", null, label));
        const input = el("input");
        input.type = "range";
        input.min = "0";
        input.max = "1";
        input.step = "0.05";
        input.value = String(options[key]);
        input.addEventListener("input", () => {
          game.save.setOption(key, Number(input.value));
          apply();
        });
        row.append(input);
        return row;
      };
      const segment = (label, key, items, apply) => {
        const row = el("div", "opt-row");
        row.append(el("span", null, label));
        const seg = el("div", "seg");
        const draw = () => {
          seg.replaceChildren();
          items.forEach(([text, value]) => {
            const chip = el("button", "chip", text);
            chip.type = "button";
            chip.classList.toggle("on", options[key] === value);
            chip.addEventListener("click", () => {
              game.save.setOption(key, value);
              if (apply) apply();
              draw();
              seg.querySelector(".on").focus({ preventScroll: true });
            });
            seg.append(chip);
          });
        };
        draw();
        row.append(seg);
        return row;
      };

      panel.append(
        slider("Music", "music", () => game.audio.applyVolumes()),
        slider("Sound effects", "sfx", () => {
          game.audio.applyVolumes();
          game.audio.play("deflect");
        }),
        segment("Difficulty", "difficulty", [["Padawan", "padawan"], ["Knight", "knight"], ["Master", "master"]]),
        segment("Screen shake", "shake", [["On", true], ["Off", false]], () => { game.camera.shakeEnabled = options.shake; }),
        segment("Touch controls", "touch", [["Auto", "auto"], ["On", "on"], ["Off", "off"]], () => game.updateTouch()),
        segment("Graphics", "quality", [["High", "high"], ["Low", "low"]], () => game.applyQuality()),
      );
      s.append(panel);
      const row = el("div", "row");
      row.style.marginTop = ".8em";
      row.append(this.button("BACK", back));
      row.append(this.button("RESET ALL PROGRESS", () => {
        this.confirm("Erase your Jedi, campaign and unlocks? This can't be undone.", () => {
          game.save.resetAll();
          game.resetJedi();
          back();
        }, () => this.showOptions(back));
      }, "danger"));
      s.append(row);
      this.show(s, back);
    }

    controlsTable() {
      const table = el("table", "controls-table");
      const head = el("tr");
      ["ACTION", "KEYBOARD", "TOUCH"].forEach((label) => head.append(el("th", null, label)));
      table.append(head);
      for (const row of CONTROLS) {
        const tr = el("tr");
        row.forEach((cell) => tr.append(el("td", null, cell)));
        table.append(tr);
      }
      return table;
    }

    showControls(back) {
      const s = el("div", "screen solid");
      s.append(el("h2", "title", "CONTROLS"));
      s.append(this.controlsTable());
      const note = el("p", "sub", "Guards block from the front. Break them with Force Push. A timed Deflect parries a boss's sword strike and leaves them open.");
      note.style.marginTop = ".8em";
      note.style.maxWidth = "34em";
      s.append(note);
      s.append(this.button("BACK", back));
      this.show(s, back);
    }

    showCredits() {
      const back = () => this.showMain();
      const s = el("div", "screen solid");
      s.append(el("h2", "title", "CREDITS"));
      const box = el("div", "scroll");
      const add = (title, text) => {
        box.append(el("h3", null, title));
        box.append(el("p", null, text));
      };
      add("JEDI STORY", "Designed and built for Gaby's Arcade.");
      add("ART AND SOUND", "Every character, planet, effect, sound and music cue is generated in code, with no image or audio files. The music is original.");
      add("A FAN PROJECT", "This is a free, non-commercial fan tribute. Star Wars and all related names and characters belong to Lucasfilm Ltd. and The Walt Disney Company. This game is not affiliated with or endorsed by them.");
      s.append(box);
      const row = el("div", "row");
      row.style.marginTop = ".8em";
      row.append(this.button("BACK", back));
      s.append(row);
      this.show(s, back);
    }

    // ---------- In-game screens ----------

    showPause() {
      const { game } = this;
      const s = el("div", "screen dim");
      s.append(el("h2", "title", "PAUSED"));
      const again = () => this.showPause();
      const menu = el("div", "menu");
      menu.append(
        this.button("RESUME", () => game.resume(), "primary"),
        this.button("RESTART LEVEL", () => this.confirm("Restart this level from the beginning?", () => game.restartLevel(), again)),
        this.button("CONTROLS", () => this.showControls(again)),
        this.button("OPTIONS", () => this.showOptions(again)),
        this.button("RETURN TO MAIN MENU", () => this.confirm("Leave this level? Progress in it will be lost.", () => game.toMenu(), again), "danger"),
      );
      s.append(menu);
      this.show(s, () => game.resume());
    }

    showComplete(stats, index) {
      const { game } = this;
      const s = el("div", "screen dim");
      const last = index === J.LEVELS.length - 1;
      s.append(el("h2", "title", last ? "CAMPAIGN COMPLETE" : "LEVEL COMPLETE"));
      s.append(el("p", "sub", J.LEVELS[index].name));
      const grid = el("div", "stats");
      const rows = [
        ["Score", stats.score.toLocaleString()],
        ["Enemies defeated", stats.enemies],
        ["Kyber crystals", `${stats.crystals} / ${stats.totalCrystals}`],
        ["Holocrons found", `${stats.holocrons} / ${stats.totalHolocrons}`],
        ["Time taken", formatTime(stats.time)],
      ];
      rows.forEach(([a, b]) => grid.append(el("span", null, a), el("span", null, String(b))));
      s.append(grid);
      const menu = el("div", "menu");
      if (!last) {
        menu.append(this.button("CONTINUE TO NEXT LEVEL", () => game.playLevel(index + 1, game.storyMode), "primary"));
      }
      menu.append(
        this.button("REPLAY LEVEL", () => game.playLevel(index, game.storyMode)),
        this.button("RETURN TO LEVEL SELECT", () => { game.toMenu(); this.showLevels(); }),
      );
      s.append(menu);
      this.show(s, () => game.toMenu());
    }

    showGameOver() {
      const { game } = this;
      const s = el("div", "screen dim");
      s.append(el("h2", "title", "THE FORCE FADES"));
      s.append(el("p", "sub", "No lives left. Continuing halves your score."));
      const menu = el("div", "menu");
      menu.append(
        this.button("CONTINUE FROM CHECKPOINT", () => game.continueFromCheckpoint(), "primary"),
        this.button("RESTART LEVEL", () => game.restartLevel()),
        this.button("RETURN TO MAIN MENU", () => game.toMenu()),
      );
      s.append(menu);
      this.show(s, () => game.toMenu());
    }
  }

  J.HUD = HUD;
  J.UI = UI;
})(window.JEDI);
