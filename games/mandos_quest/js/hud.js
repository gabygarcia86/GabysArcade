/* The in-game heads-up display, drawn on the Canvas. */
(function (MQ) {
  const { box, text, glow, clamp, wrap, formatTime, alpha, oval, shade, smooth, damp } = MQ.U;
  const { max, min, sin } = Math;
  const INK = "rgba(6,9,16,0.72)";
  const EDGE = "rgba(143,220,255,0.3)";
  const GOLD = "#ffd45c";
  const MAX_TOASTS = 3;

  class Hud {
    constructor(input) {
      this.input = input;
      this.scale = 1;
      this.rightInset = 72;
      this.portraitPose = MQ.Anim.createPose();
      MQ.Anim.human(this.portraitPose, "idle", 0, 0, 0);
      this.reset();
    }

    reset() {
      this.time = 0;
      this.messages = [];
      this.message = null;
      this.hintItem = null;
      this.toasts = [];
      this.bannerText = "";
      this.bannerTime = 0;
      this.titleTime = 0;
      this.titleTop = "";
      this.titleMain = "";
      this.introBoss = null;
      this.weaponTime = 0;
      this.weaponName = "";
      this.shownHp = 1;
      this.shownBoss = 1;
    }

    title(top, main) {
      this.titleTop = top;
      this.titleMain = main;
      this.titleTime = 3.4;
    }

    say(who, message) {
      this.messages.push({ who, text: message, life: 2.6 + message.length * 0.045, age: 0 });
    }

    hint(message, touchMessage) {
      this.hintItem = { text: message, touch: touchMessage, life: 6.5 };
    }

    toast(title, detail) {
      this.toasts.push({ title, detail, life: 3.6, age: 0 });
      if (this.toasts.length > MAX_TOASTS) this.toasts.shift();
    }

    banner(message) {
      this.bannerText = message;
      this.bannerTime = 2.4;
    }

    weaponChanged(weapon) {
      this.weaponName = weapon.name;
      this.weaponTime = 1.6;
    }

    bossIntro(boss) {
      this.introBoss = boss;
      this.shownBoss = 1;
      this.titleTime = 0;
      this.hintItem = null;
    }

    endBossIntro() {
      this.introBoss = null;
    }

    update(dt) {
      this.time += dt;
      this.bannerTime -= dt;
      this.titleTime -= dt;
      this.weaponTime -= dt;

      if (!this.message && this.messages.length) this.message = this.messages.shift();
      if (this.message) {
        this.message.age += dt;
        // Hurry along when more lines are waiting.
        this.message.life -= dt * (this.messages.length ? 1.4 : 1);
        if (this.message.life <= 0) this.message = null;
      }
      if (this.hintItem) {
        this.hintItem.life -= dt;
        if (this.hintItem.life <= 0) this.hintItem = null;
      }
      if (this.toasts.length) {
        const toast = this.toasts[0];
        toast.life -= dt * (this.toasts.length > 1 ? 1.5 : 1);
        toast.age += dt;
        if (toast.life <= 0) this.toasts.shift();
      }
    }

    draw(ctx, world) {
      if (this.introBoss && world.state === "bossIntro") {
        this.drawBossIntro(ctx, world);
        return;
      }
      const { scale: s } = this;

      ctx.save();
      ctx.scale(s, s);
      this.drawStatus(ctx, world);
      ctx.restore();

      ctx.save();
      ctx.translate(MQ.VW - this.rightInset, 0);
      ctx.scale(s, s);
      this.drawMission(ctx, world);
      ctx.restore();

      // Everything in the middle is laid out top to bottom.
      ctx.save();
      ctx.translate(MQ.VW / 2, 0);
      ctx.scale(s, s);
      // With the HUD enlarged on small screens there's no room between the two panels.
      const crowded = s > 1.12;
      let y = crowded ? 166 : 14;
      if (world.boss && world.arena?.locked && !world.boss.dead) {
        ctx.save();
        if (crowded) ctx.translate(0, MQ.VH / s - 66);
        this.drawBossBar(ctx, world.boss);
        ctx.restore();
        if (!crowded) y = 66;
      }
      if (this.message) y = this.drawMessage(ctx, world, y);
      if (this.hintItem) y = this.drawHint(ctx, y);
      if (this.toasts.length) this.drawToast(ctx, Math.max(y, 80));
      ctx.restore();

      this.drawTitles(ctx);
      if (world.player.hp < world.player.maxHp * 0.25 && !world.player.dead) {
        const pulse = 0.12 + sin(this.time * 7) * 0.06;
        ctx.fillStyle = `rgba(255,50,50,${pulse})`;
        ctx.fillRect(0, 0, MQ.VW, 10);
        ctx.fillRect(0, MQ.VH - 10, MQ.VW, 10);
        ctx.fillRect(0, 0, 10, MQ.VH);
        ctx.fillRect(MQ.VW - 10, 0, 10, MQ.VH);
      }
    }

    bar(ctx, x, y, w, h, fraction, color) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w * clamp(fraction, 0, 1), h);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(x, y, w * clamp(fraction, 0, 1), Math.ceil(h / 3));
    }

    drawStatus(ctx, world) {
      const { player, stats, force, save } = world;
      const height = stats.jetpack ? 150 : 128;
      box(ctx, 12, 12, 286, height, 10, INK, EDGE, 1.5);

      box(ctx, 22, 22, 46, 46, 8, "#1b2433", "#8fdcff", 1.5);
      ctx.save();
      ctx.translate(45, 47);
      ctx.scale(1.35, 1.35);
      MQ.CharacterArt.helmet(ctx, world.look, this.time);
      ctx.restore();

      text(ctx, `LV ${save.playerLevel}`, 78, 36, 15, GOLD, "left", 800);
      for (let i = 0; i < MQ.DATA.LIVES; i++) {
        const alive = i < world.run.lives;
        oval(ctx, 244 + i * 18, 31, 6, 6, alive ? "#ff6a5c" : "rgba(255,255,255,0.14)", alive ? "#ffd0c8" : null, 1.2);
      }

      const hp = player.hp / player.maxHp;
      this.shownHp = hp < this.shownHp ? damp(this.shownHp, hp, 4, 1 / 60) : hp;
      this.bar(ctx, 78, 44, 208, 17, this.shownHp, "rgba(255,255,255,0.5)");
      this.bar(ctx, 78, 44, 208, 17, hp, hp > 0.5 ? "#3fd07c" : hp > 0.25 ? "#f2b33d" : "#f0443c");
      text(ctx, `${player.hp} / ${player.maxHp}`, 182, 57, 13, "#ffffff", "center", 800);

      text(ctx, "FORCE", 24, 85, 12, "#8fdcff");
      if (world.baby.present && force.power && !world.baby.caged) {
        this.bar(ctx, 78, 76, 208, 10, force.energy / 100, "#4fb8f0");
      } else {
        text(ctx, world.baby.caged ? "BABY G CAPTURED" : "LOCKED", 78, 85, 12, "#7d8794");
      }

      let y = 98;
      if (stats.jetpack) {
        text(ctx, "FUEL", 24, 106, 12, "#ffb36b");
        this.bar(ctx, 78, 97, 208, 10, player.jetpack.fraction, player.jetpack.fraction > 0.2 ? "#ff9a38" : "#f0443c");
        y = 120;
      }
      this.drawWeapon(ctx, world, y);
    }

    drawWeapon(ctx, world, y) {
      const { weapons } = world.player;
      const weapon = weapons.current;
      const color = weapon.id === "saber" ? MQ.DATA.saber(world.save.saberColor).glow : weapon.color;

      ctx.save();
      const wide = weapon.id === "saber" ? 58 : 82; // The blade would otherwise cover the name.
      ctx.translate(44 - wide / 2, y - 8);
      MQ.WeaponArt.showcase(ctx, weapon.id, wide, 44, MQ.DATA.saber(world.save.saberColor), this.time);
      ctx.restore();
      text(ctx, weapon.name.toUpperCase(), 80, y + 10, 14, "#ffffff", "left", 800);

      if (weapon.ammo) {
        const count = weapons.ammoMax[weapon.id];
        const step = min(23, 208 / count);
        for (let i = 0; i < count; i++) box(ctx, 80 + i * step, y + 17, step - 5, 8, 2, i < weapons.ammo[weapon.id] ? color : "rgba(255,255,255,0.14)");
      } else if (weapon.id === "flame") {
        this.bar(ctx, 80, y + 17, 206, 7, weapons.heat / weapon.heat, weapons.overheated ? "#f0443c" : color);
      } else if (weapon.id === "saber" && weapons.hold > 0) {
        this.bar(ctx, 80, y + 17, 206, 7, weapons.charge, color);
      } else {
        this.bar(ctx, 80, y + 17, 206, 7, 1 - max(0, weapons.cooldown) / weapon.cooldown, color);
      }
    }

    drawMission(ctx, world) {
      const { def, progression, level, run } = world;
      const width = 270;
      ctx.font = `600 13px ${MQ.FONT}`;
      const lines = wrap(ctx, level.objectiveText, width - 24);
      const height = 86 + lines.length * 16;
      box(ctx, -width, 12, width, height, 10, INK, EDGE, 1.5);
      text(ctx, `${def.id}. ${def.title.toUpperCase()}`, -width + 12, 32, 13, "#ffffff", "left", 800);

      const owned = world.save.pucks[def.id - 1];
      for (let i = 0; i < owned.length; i++) {
        const x = -width + 22 + i * 25;
        oval(ctx, x, 51, 9, 9, owned[i] ? "#59616b" : "rgba(255,255,255,0.08)", owned[i] ? "#c3cbd3" : "rgba(255,255,255,0.3)", 1.5);
        if (owned[i]) {
          oval(ctx, x, 51, 3.5, 3.5, "#ff4a3d");
          glow(ctx, x, 51, 14, "#ff4a3d", 0.6);
        }
      }
      text(ctx, `${progression.totalPucks()}/30`, -width + 92, 56, 13, "#b8c6d6");
      text(ctx, formatTime(run.time) === "--:--" ? "0:00" : formatTime(run.time), -12, 48, 13, "#b8c6d6", "right");
      text(ctx, world.scoreSoFar.toLocaleString(), -12, 64, 13, GOLD, "right");

      text(ctx, "OBJECTIVE", -width + 12, 81, 11, "#8fdcff", "left", 800);
      for (let i = 0; i < lines.length; i++) text(ctx, lines[i], -width + 12, 97 + i * 16, 13, "#e6edf5", "left", 600);
    }

    drawBossBar(ctx, boss) {
      const width = 380;
      box(ctx, -width / 2 - 8, 8, width + 16, 52, 8, INK, "rgba(255,90,80,0.5)", 1.5);
      text(ctx, boss.name, -width / 2, 28, 16, "#ffd9d2", "left", 800);
      text(ctx, boss.barLabel || `PHASE ${boss.phase}`, width / 2, 28, 12, GOLD, "right", 800);
      const fraction = boss.hp / boss.maxHp;
      this.shownBoss = max(fraction, this.shownBoss - 0.004);
      if (fraction > this.shownBoss) this.shownBoss = fraction;
      this.bar(ctx, -width / 2, 36, width, 15, this.shownBoss, "rgba(255,255,255,0.45)");
      this.bar(ctx, -width / 2, 36, width, 15, fraction, boss.barLabel ? "#58d6c2" : "#e0443c");
      for (const threshold of boss.thresholds) {
        ctx.fillStyle = "#0a0d14";
        ctx.fillRect(-width / 2 + width * threshold - 1, 36, 3, 15);
      }
    }

    drawMessage(ctx, world, y) {
      const m = this.message;
      const available = MQ.VW / this.scale - 2 * 310;
      const width = clamp(available, 340, 560);
      ctx.font = `600 15px ${MQ.FONT}`;
      const lines = wrap(ctx, m.text, width - 92);
      const height = max(70, 38 + lines.length * 18);
      ctx.globalAlpha = min(1, m.age * 5, m.life * 3);

      const villain = m.who === "Moff Gideon" || m.who === "Imperial Radio";
      const color = villain ? "#ff6a5c" : m.who === "Baby G" ? "#9fd88a" : "#8fdcff";
      const x = -width / 2;
      box(ctx, x, y, width, height, 9, "rgba(6,9,16,0.84)", alpha(color, 0.6), 1.5);

      const size = 56;
      ctx.save();
      MQ.U.roundPath(ctx, x + 8, y + 7, size, size, 6);
      ctx.fillStyle = shade(color, -0.75);
      ctx.fill();
      ctx.clip();
      ctx.translate(x + 8 + size / 2, y + 7 + size / 2);
      this.drawPortrait(ctx, world, m.who);
      if (villain) {
        for (let i = -28; i < 28; i += 5) {
          ctx.fillStyle = "rgba(255,80,70,0.18)";
          ctx.fillRect(-28, i + ((this.time * 20) % 5), 56, 2);
        }
      }
      ctx.restore();

      text(ctx, m.who.toUpperCase(), x + 76, y + 24, 13, color, "left", 800);
      const visible = Math.floor(m.age * 70);
      let used = 0;
      for (let i = 0; i < lines.length; i++) {
        if (visible <= used) break;
        text(ctx, lines[i].slice(0, visible - used), x + 76, y + 44 + i * 18, 15, "#ffffff", "left", 600);
        used += lines[i].length;
      }
      ctx.globalAlpha = 1;
      return y + height + 8;
    }

    drawPortrait(ctx, world, who) {
      switch (who) {
        case "The Mandalorian":
          ctx.scale(1.7, 1.7);
          MQ.CharacterArt.helmet(ctx, world.look, this.time);
          break;
        case "Baby G":
          ctx.translate(0, 8);
          MQ.CharacterArt.baby(ctx, "happy", this.time);
          break;
        case "Moff Gideon":
          ctx.translate(-2, 108);
          ctx.scale(1.35, 1.35);
          MQ.CharacterArt.gideon(ctx, this.portraitActor || (this.portraitActor = { pose: this.portraitPose, time: 0 }));
          break;
        default:
          for (let i = 0; i < 7; i++) {
            const height = 8 + Math.abs(sin(this.time * 9 + i)) * 24;
            box(ctx, -23 + i * 7, -height / 2, 4, height, 2, "#ff6a5c");
          }
      }
    }

    drawHint(ctx, y) {
      const hint = this.hintItem;
      const message = this.input.usingTouch && hint.touch ? hint.touch : hint.text;
      const width = 430;
      ctx.font = `600 15px ${MQ.FONT}`;
      const lines = wrap(ctx, message, width - 30);
      const height = 18 + lines.length * 19;
      ctx.globalAlpha = min(1, hint.life * 2);
      box(ctx, -width / 2, y, width, height, 8, "rgba(44,36,10,0.86)", "rgba(255,212,92,0.75)", 1.5);
      for (let i = 0; i < lines.length; i++) text(ctx, lines[i], 0, y + 24 + i * 19, 15, "#fff3c8", "center", 600);
      ctx.globalAlpha = 1;
      return y + height + 8;
    }

    drawToast(ctx, y) {
      const t = this.toasts[0];
      ctx.globalAlpha = min(1, t.age * 5, t.life * 2.5);
      const slide = (1 - smooth(t.age * 4)) * -12;
      ctx.font = `600 14px ${MQ.FONT}`;
      const width = max(260, ctx.measureText(t.detail).width + 36, t.title.length * 12);
      box(ctx, -width / 2, y + slide, width, 50, 8, INK, "rgba(255,212,92,0.6)", 1.5);
      text(ctx, t.title, 0, y + slide + 21, 14, GOLD, "center", 800);
      text(ctx, t.detail, 0, y + slide + 39, 14, "#e6edf5", "center", 600);
      ctx.globalAlpha = 1;
    }

    drawTitles(ctx) {
      const cx = MQ.VW / 2;
      if (this.titleTime > 0) {
        ctx.globalAlpha = min(1, this.titleTime, (3.4 - this.titleTime) * 3);
        const top = this.scale > 1.12 ? 420 : 270;
        text(ctx, this.titleTop, cx, top, 22, "#8fdcff", "center", 700);
        text(ctx, this.titleMain.toUpperCase(), cx, top + 56, 54, "#ffffff", "center", 800);
        ctx.globalAlpha = 1;
      } else if (this.bannerTime > 0) {
        ctx.globalAlpha = min(1, this.bannerTime * 2, (2.4 - this.bannerTime) * 5);
        const size = 42 + max(0, this.bannerTime - 2.1) * 40;
        text(ctx, this.bannerText, cx, 290, size, GOLD, "center", 800);
        ctx.globalAlpha = 1;
      }
      if (this.weaponTime > 0) {
        ctx.globalAlpha = min(1, this.weaponTime * 3);
        text(ctx, this.weaponName.toUpperCase(), cx, 560, 24 * this.scale, "#ffffff", "center", 800);
        ctx.globalAlpha = 1;
      }
    }

    drawBossIntro(ctx, world) {
      const boss = this.introBoss;
      const t = world.stateTime;
      const k = smooth(t * 2);
      ctx.fillStyle = "#020308";
      ctx.fillRect(0, 0, MQ.VW, 70 * k);
      ctx.fillRect(0, MQ.VH - 130 * k, MQ.VW, 130 * k);
      ctx.globalAlpha = smooth((t - 0.5) * 2);
      const x = 70 + (1 - smooth((t - 0.5) * 2)) * 60;
      ctx.fillStyle = "#e0443c";
      ctx.fillRect(x, MQ.VH - 108, 6, 84);
      text(ctx, world.def.miniBoss ? "MINI-BOSS" : "MAJOR BOSS", x + 22, MQ.VH - 90, 18, "#ff8a70", "left", 800);
      text(ctx, boss.name, x + 22, MQ.VH - 50, 46, "#ffffff", "left", 800);
      text(ctx, boss.title, x + 22, MQ.VH - 24, 19, GOLD, "left", 600);
      ctx.globalAlpha = 1;
      if (t > 1) text(ctx, this.input.usingTouch ? "Tap Jump to skip" : "Space to skip", MQ.VW - this.rightInset - 16, 44, 17, "#8a94a3", "right", 600);
    }
  }

  MQ.Hud = Hud;
})(window.MQ);
