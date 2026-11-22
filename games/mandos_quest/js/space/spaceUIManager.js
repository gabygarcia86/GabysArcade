/*
 * The space HUD: hull, shields and Baby G along the top, the upgrade bar along the bottom,
 * and popups that keep off the ship. Popups use the ground HUD's queue and look.
 */
(function (MQ) {
  const S = MQ.SPACE;
  const { box, text, oval, glow, poly, line, clamp, alpha } = MQ.U;
  const { min, max, sin, round } = Math;

  const GOLD = "#ffd45c";
  const BAND = "rgba(4,7,14,0.9)";
  const EDGE = "rgba(143,220,255,0.3)";
  const { top: TOP, bottom: BOTTOM } = S.FIELD;
  const POPUP_HEIGHT = 132;
  const RETURN_GAP = 60;

  class SpaceUIManager {
    constructor(hud) {
      this.hud = hud;
      this.upgradeLabel = document.getElementById("space-upgrade-name");
      this.labelText = "";
      this.controls = [];
      this.barLeft = 0;
      this.barRight = MQ.VW;
      this.reset();
    }

    reset() {
      this.hud.reset();
      this.warning = "";
      this.time = 0;
      this.low = false;
      this.showControls();
    }

    showControls() {
      for (const control of this.controls) this.setFade(control, false, false);
    }

    /* ---------- Messages ---------- */

    title(top, main) {
      this.hud.title(top, main);
    }

    say(who, text) {
      this.hud.say(who, text);
    }

    hint(text, touch) {
      this.hud.hint(text, touch);
    }

    toast(title, detail) {
      this.hud.toast(title, detail);
    }

    banner(text) {
      this.hud.banner(text);
    }

    installed(upgrade, level) {
      this.hud.weaponChanged({ name: `${upgrade.name}${level > 1 ? ` ${level}` : ""} installed` });
    }

    bossWarning(name) {
      this.warning = name;
      this.hud.hintItem = null;
    }

    endBossWarning() {
      this.warning = "";
    }

    /*
     * In CSS pixels: stage is the picture and elements the visible touch controls.
     * The bar sits between the controls, which fade while the ship is behind them.
     */
    layout(stage, elements) {
      this.showControls();
      const unit = MQ.VW / (stage.right - stage.left);
      let left = 12;
      let right = MQ.VW - 12;
      this.controls = elements.map((element) => {
        const r = element.getBoundingClientRect();
        const control = {
          element,
          behind: false,
          over: false,
          left: (r.left - stage.left) * unit,
          right: (r.right - stage.left) * unit,
          top: (r.top - stage.top) * unit,
          bottom: (r.bottom - stage.top) * unit,
        };
        if (control.top < MQ.VH && control.bottom > BOTTOM) {
          if (control.right <= MQ.VW / 2) left = max(left, control.right + 10);
          else if (control.left >= MQ.VW / 2) right = min(right, control.left - 10);
        }
        return control;
      });
      this.barLeft = left;
      this.barRight = right;
    }

    // behind: the ship is under it. over: part of a boss is.
    setFade(control, behind, over) {
      if (control.behind !== behind) control.element.classList.toggle("is-behind", behind);
      if (control.over !== over) control.element.classList.toggle("is-over", over);
      control.behind = behind;
      control.over = over;
    }

    update(dt) {
      this.time += dt;
      this.hud.update(dt);
    }

    draw(ctx, world) {
      const { player } = world;
      // Bigger type on phones, inside the same two bands.
      const k = this.hud.crowded ? 1.3 : 1;

      ctx.fillStyle = BAND;
      ctx.fillRect(0, 0, MQ.VW, TOP - 6);
      ctx.fillRect(0, BOTTOM + 2, MQ.VW, MQ.VH - BOTTOM - 2);
      ctx.fillStyle = EDGE;
      ctx.fillRect(0, TOP - 7, MQ.VW, 1);
      ctx.fillRect(0, BOTTOM + 2, MQ.VW, 1);

      this.drawShip(ctx, world, k);
      this.drawProgress(ctx, world, k);
      this.drawScore(ctx, world, k);
      this.drawBar(ctx, world, k);

      if (this.warning) {
        this.hud.showing = "none";
        this.drawWarning(ctx, world);
      } else {
        this.drawPopup(ctx, world);
      }

      if (player.hp < player.maxHp * 0.25 && !player.dead) {
        ctx.strokeStyle = `rgba(255,50,50,${0.18 + sin(this.time * 7) * 0.1})`;
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, MQ.VW - 10, MQ.VH - 10);
      }
      this.syncControls(world);
    }

    /* ---------- Top band ---------- */

    drawShip(ctx, world, k) {
      const { player, run } = world;
      ctx.save();
      box(ctx, 10, 7, 56, 56, 7, "#16202d", "#8fdcff", 1.5);
      ctx.beginPath();
      ctx.rect(11, 8, 54, 54);
      ctx.clip();
      ctx.translate(37, 50);
      ctx.scale(1.12, 1.12);
      MQ.CharacterArt.baby(ctx, player.dead ? "sad" : world.victory ? "victory" : player.mood, this.time, { pram: false });
      ctx.restore();

      const hp = player.hp / player.maxHp;
      const color = hp > 0.5 ? "#3fd07c" : hp > 0.25 ? "#f2b33d" : "#f0443c";
      box(ctx, 76, 8, 246, 25, 4, "rgba(255,255,255,0.12)");
      if (hp > 0) box(ctx, 76, 8, 246 * hp, 25, 4, color);
      text(ctx, `HULL ${player.hp} / ${player.maxHp}`, 199, 27, 15 * k, "#ffffff", "center", 800);
      for (let i = 0; i < MQ.DATA.LIVES; i++) {
        const alive = i < run.lives;
        poly(ctx, [334 + i * 24, 12, 352 + i * 24, 20, 334 + i * 24, 28, 339 + i * 24, 20], alive ? "#ff6a5c" : "rgba(255,255,255,0.14)", alive ? "#ffd0c8" : null, 1);
      }

      text(ctx, "SHIELD", 76, 56, 12 * k, "#8fdcff", "left", 800);
      for (let i = 0; i < S.DEFLECTOR.charges; i++) {
        const x = 150 + i * 24;
        oval(ctx, x, 51, 8, 8, i < player.charges ? "#7fd4ff" : "rgba(255,255,255,0.12)", "#8fdcff", 1.2);
        if (i === player.charges) {
          ctx.beginPath();
          ctx.arc(x, 51, 5, -Math.PI / 2, -Math.PI / 2 + MQ.TAU * min(1, player.chargeTime / S.DEFLECTOR.recharge));
          ctx.strokeStyle = "#7fd4ff";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
      if (player.energy > 0) {
        box(ctx, 194, 44, 58, 13, 3, "rgba(255,255,255,0.12)");
        box(ctx, 194, 44, 58 * (player.energy / player.energyMax), 13, 3, "#9fb4ff");
      }
      text(ctx, "ROCKETS", 266, 56, 12 * k, GOLD, "left", 800);
      text(ctx, player.weapons.ammo, 378, 57, 17 * k, player.weapons.ammo ? "#ffffff" : "#f0443c", "right", 800);
    }

    drawProgress(ctx, world, k) {
      const left = 420;
      const right = MQ.VW - this.hud.rightInset - 190;
      const width = min(440, right - left);
      const x = (left + right - width) / 2;
      const { boss, miniBoss } = world;

      let label;
      let detail = "";
      let fraction;
      let color;
      if (boss && !boss.dead && boss.state !== "intro") {
        label = boss.name;
        detail = boss.status;
        fraction = boss.health;
        color = boss.exposed ? "#e0443c" : "#58d6c2";
      } else if (miniBoss?.active) {
        label = miniBoss.boss;
        fraction = max(0, miniBoss.hp / miniBoss.maxHp);
        color = miniBoss.shielded ? "#58d6c2" : "#ff8a5c";
        if (miniBoss.shielded) detail = "SHIELDED";
      } else {
        label = `${world.def.id}. ${world.def.title.toUpperCase()}`;
        fraction = world.progress;
        color = world.def.accent;
      }

      // A long name and a long status can't share the line, so they shrink together.
      const size = 13 * k;
      ctx.font = `800 ${size}px ${MQ.FONT}`;
      const needed = ctx.measureText(`${label}${detail}`).width + (detail ? 14 : 0);
      const fitted = size * min(1, width / needed);
      text(ctx, label, detail ? x : x + width / 2, 25, fitted, "#ffffff", detail ? "left" : "center", 800);
      if (detail) text(ctx, detail, x + width, 25, fitted, GOLD, "right", 800);

      const thick = boss || miniBoss ? 18 : 8;
      const y = 44 - thick / 2;
      box(ctx, x, y, width, thick, 3, "rgba(255,255,255,0.12)");
      if (fraction > 0) box(ctx, x, y, width * fraction, thick, 3, color);
      if (boss && boss.exposed && !boss.dead) {
        const coreShare = boss.core.maxHp / boss.parts.reduce((total, part) => total + part.maxHp, 0);
        for (const threshold of boss.spec.thresholds) {
          if (threshold) line(ctx, x + width * threshold * coreShare, y, x + width * threshold * coreShare, y + thick, "#0a0d14", 3, "butt");
        }
      } else if (!boss && !miniBoss) {
        poly(ctx, [x + width * fraction - 6, 37, x + width * fraction + 8, 44, x + width * fraction - 6, 51], "#ffffff");
      }
    }

    drawScore(ctx, world, k) {
      const x = MQ.VW - this.hud.rightInset - 12;
      text(ctx, world.scoreSoFar.toLocaleString(), x, 29, 19 * k, GOLD, "right", 800);
      text(ctx, `${world.run.kills} DESTROYED`, x, 55, 12 * k, "#b8c6d6", "right", 700);
    }

    /* ---------- The upgrade bar ---------- */

    drawBar(ctx, world, k) {
      const { weapons, energy, energyMax } = world.player;
      const list = S.UPGRADES;
      const room = min(940, this.barRight - this.barLeft);
      const start = (this.barLeft + this.barRight - room) / 2;
      const slot = room / list.length;
      const named = !this.hud.crowded && slot >= 92; // Too small to read on phones.
      const y = 686;
      const highlight = weapons.cursor;

      for (let i = 1; i < list.length; i++) line(ctx, start + slot * i - 3, y, start + slot * i + 3, y, "rgba(143,220,255,0.4)", 4, "butt");
      for (let i = 0; i < list.length; i++) {
        const upgrade = list[i];
        const x = start + slot * (i + 0.5);
        const half = slot / 2 - 3;
        const unlocked = weapons.unlocked(upgrade);
        const level = weapons.levels[upgrade.id];
        const on = upgrade.id === "shield" ? energy > 0 : level > 0;
        const lit = i === highlight;
        const point = min(12, half * 0.4);

        if (lit) glow(ctx, x, y, half + 16, GOLD, 0.5 + sin(this.time * 9) * 0.2);
        poly(
          ctx,
          [x - half, y, x - half + point, y - 26, x + half - point, y - 26, x + half, y, x + half - point, y + 26, x - half + point, y + 26],
          lit ? "rgba(255,212,92,0.3)" : on ? alpha(upgrade.color, 0.2) : "rgba(16,24,38,0.9)",
          lit ? GOLD : on ? upgrade.color : "rgba(143,220,255,0.22)",
          lit ? 3.5 : 1.5,
        );

        const color = !unlocked ? "#4b5563" : lit ? "#fff6d0" : on ? upgrade.color : "#9aa8b8";
        const iconX = named ? x - half + point + 16 : x;
        if (unlocked) {
          MQ.SpaceArt.icon(ctx, upgrade.id, iconX, named ? y : y - 5, named ? 22 : min(26, half), color);
        } else {
          box(ctx, iconX - 7, y - 5, 14, 12, 2, color);
          oval(ctx, iconX, y - 6, 5, 6, null, color, 2.5);
        }
        if (named) {
          const space = half * 2 - point - 34;
          const size = min(12.5 * k, space / (upgrade.short.length * 0.68));
          text(ctx, upgrade.short, iconX + 15, y + (unlocked ? 1 : 4), size, color, "left", 800);
        }
        if (!unlocked || upgrade.id === "shield") {
          if (on && energy < energyMax) box(ctx, x - half * 0.5, y + 15, half * (energy / energyMax), 4, 2, upgrade.color);
          continue;
        }
        for (let n = 0; n < upgrade.max; n++) {
          oval(ctx, x + (n - (upgrade.max - 1) / 2) * 11, y + 17, 3.2, 3.2, n < level ? upgrade.color : "rgba(255,255,255,0.18)");
        }
      }

      // With icons alone, the highlighted one is named above the bar.
      if (!named && highlight >= 0) {
        const name = list[highlight].name.toUpperCase();
        ctx.font = `800 ${15 * k}px ${MQ.FONT}`;
        const width = ctx.measureText(name).width + 24;
        box(ctx, start + room / 2 - width / 2, BOTTOM - 30, width, 28, 6, BAND, GOLD, 1);
        text(ctx, name, start + room / 2, BOTTOM - 9, 15 * k, GOLD, "center", 800);
      }
    }

    syncControls(world) {
      const { player, boss } = world;
      const name = player.weapons.highlighted?.short || "None";
      if (name !== this.labelText && this.upgradeLabel) {
        this.labelText = name;
        this.upgradeLabel.textContent = name;
        this.upgradeLabel.parentElement.parentElement.classList.toggle("is-ready", name !== "None");
      }
      for (let i = 0; i < this.controls.length; i++) {
        const c = this.controls[i];
        const behind = !player.dead && player.x + 70 > c.left && player.x - 70 < c.right && player.y + 26 > c.top && player.y - 40 < c.bottom;
        let over = false;
        if (boss && !boss.dead) {
          for (let j = 0; j < boss.parts.length && !over; j++) {
            const p = boss.parts[j];
            over = p.hp > 0 && p.x + p.rx > c.left && p.x - p.rx < c.right && p.y + p.ry > c.top && p.y - p.ry < c.bottom;
          }
        }
        this.setFade(c, behind, over);
      }
    }

    /* ---------- Over the field ---------- */

    drawWarning(ctx, world) {
      const t = world.stateTime;
      const opacity = clamp(min(t * 4, 2.8 - t), 0, 1);
      const { player } = world;
      const centre = player.y < 340 ? 470 : 210;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "rgba(60,6,12,0.75)";
      ctx.fillRect(0, centre - 56, MQ.VW, 112);
      for (let i = 0; i < 18; i++) {
        const x = ((i * 80 + t * 120) % (MQ.VW + 80)) - 60;
        for (const y of [centre - 56, centre + 46]) poly(ctx, [x, y + 10, x + 16, y, x + 40, y, x + 24, y + 10], "#e0443c");
      }
      text(ctx, "WARNING", MQ.VW / 2, centre - 10, 22, GOLD, "center", 800);
      text(ctx, this.warning.toUpperCase(), MQ.VW / 2, centre + 33, 42, "#ffffff", "center", 800);
      ctx.globalAlpha = 1;
    }

    drawPopup(ctx, world) {
      const { hud } = this;
      const kind = hud.nextPopup();
      hud.showing = kind || "none";
      if (!kind) {
        this.low = false;
        return;
      }

      const { notices } = hud;
      if (notices.below) {
        const target = notices.ctx;
        const ratio = notices.canvas.width / notices.width;
        target.setTransform(ratio, 0, 0, ratio, 0, 0);
        const card = hud.popup(target, kind, notices.width - 24);
        const scale = min(1, (notices.height - 24) / card.height);
        target.save();
        target.translate(notices.width / 2, 12);
        target.scale(scale, scale);
        hud.drawPopup(target, world, kind, card);
        target.restore();
        return;
      }

      const s = hud.crowded ? 1.35 : 1;
      const card = hud.popup(ctx, kind, 560);
      const scale = s * min(1, POPUP_HEIGHT / (card.height * s));
      const height = card.height * scale;
      const halfWidth = (card.width * scale) / 2;
      const x = MQ.VW / 2;

      const { player } = world;
      const beside = player.x + 80 < x - halfWidth || player.x - 80 > x + halfWidth;
      const high = TOP + 14;
      const gap = this.low ? RETURN_GAP : 0;
      const clearHigh = beside || player.y - 50 > high + height + gap;
      const clearLow = beside || player.y + 30 < BOTTOM - 10 - height;
      this.low = !clearHigh && clearLow;

      ctx.save();
      ctx.translate(x, round(this.low ? BOTTOM - 10 - height : high));
      ctx.scale(scale, scale);
      hud.drawPopup(ctx, world, kind, card);
      ctx.restore();
    }
  }

  MQ.SpaceUIManager = SpaceUIManager;
})(window.MQ);
