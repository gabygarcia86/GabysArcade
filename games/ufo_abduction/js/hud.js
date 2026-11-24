/*
 * The in-game HUD, drawn on the canvas in screen space. It adapts to the view width:
 * below 820 units wide (portrait phones) it switches to a compact layout.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const FONT = "Oxanium, sans-serif";
  const POWER_ORDER = ["super", "shield", "speed", "double", "beacon"];

  function text(ctx, str, x, y, size, color, align = "left", weight = 800, stroke = 5) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    if (stroke) {
      ctx.lineWidth = stroke;
      ctx.strokeStyle = D.OUT;
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function panel(ctx, x, y, w, h, alpha = 0.72) {
    ctx.fillStyle = `rgba(20, 10, 48, ${alpha})`;
    D.roundRectPath(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(160, 130, 255, 0.7)";
    ctx.stroke();
  }

  class HUD {
    constructor(game) {
      this.game = game;
      this.banners = [];
      this.big = null;
      this.flash = 0;
      this.healthFlash = 0;
      this.comboPop = 0;
      this.scoreShown = 0;
      this.lastCombo = 0;
    }

    reset() {
      this.banners = [];
      this.big = null;
      this.flash = 0;
      this.healthFlash = 0;
      this.scoreShown = this.game.scoring.score;
    }

    banner(str, o = {}) {
      // The same message twice in a row just refreshes the first one.
      const same = this.banners.find((b) => b.text === str);
      if (same) {
        same.t = 0;
        return;
      }
      this.banners.push({ text: str, color: o.color || "#ffffff", size: o.size || 30, time: o.time || 1.6, t: 0, sub: o.sub || "", icon: o.icon || null });
      if (this.banners.length > 4) this.banners.shift();
    }

    // Big centered text, as for level intros and "TIME'S UP!".
    bigText(title, sub, time, color = "#8dff5a") {
      this.big = { title, sub, time, t: 0, color };
    }

    update(dt) {
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter((b) => b.t < b.time);
      if (this.big) {
        this.big.t += dt;
        if (this.big.t >= this.big.time) this.big = null;
      }
      this.flash = Math.max(0, this.flash - dt * 2);
      this.healthFlash = Math.max(0, this.healthFlash - dt);
      this.comboPop = Math.max(0, this.comboPop - dt * 3);
      // The score counts up quickly rather than jumping.
      const target = this.game.scoring.score;
      this.scoreShown = target - this.scoreShown < 1 ? target : U.damp(this.scoreShown, target, 10, dt);
      if (this.game.scoring.combo !== this.lastCombo) {
        if (this.game.scoring.combo > this.lastCombo) this.comboPop = 1;
        this.lastCombo = this.game.scoring.combo;
      }
    }

    draw(ctx, t) {
      const g = this.game;
      const VW = g.VW;
      const compact = VW < 820;

      // Red edges while hurt or on the last hull point.
      const low = g.player.health === 1 && g.player.alive;
      if (this.flash > 0 || low) {
        const a = Math.max(this.flash * 0.7, low ? 0.18 + Math.sin(t * 5) * 0.1 : 0);
        const grad = ctx.createRadialGradient(VW / 2, U.VH / 2, U.VH * 0.35, VW / 2, U.VH / 2, VW * 0.75);
        grad.addColorStop(0, "rgba(255,0,40,0)");
        grad.addColorStop(1, `rgba(255,0,40,${a})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, VW, U.VH);
      }

      this.drawEdgeIndicators(ctx, t);
      this.drawScore(ctx, compact, t);
      this.drawTimer(ctx, compact, t);
      this.drawHealth(ctx, compact, t);
      this.drawBanners(ctx, t);
      this.drawBig(ctx, t);
    }

    drawScore(ctx, compact, t) {
      const g = this.game;
      const s = g.scoring;
      const w = compact ? 156 : 232;
      panel(ctx, 10, 10, w, compact ? 62 : 70);
      text(ctx, "SCORE", 24, 26, 12, "#b9acdf", "left", 700, 0);
      text(ctx, U.formatScore(this.scoreShown), 22, compact ? 50 : 54, compact ? 26 : 32, "#ffd23f", "left", 800, 5);
      // Abductions.
      const ax = 10 + w - 12;
      text(ctx, `${s.abductions}`, ax, 26, 15, "#fff", "right", 800, 4);
      ctx.fillStyle = "rgba(150, 255, 226, 0.8)";
      const iconX = ax - ctx.measureText(`${s.abductions}`).width - 14;
      ctx.beginPath();
      ctx.moveTo(iconX - 4, 20);
      ctx.lineTo(iconX + 4, 20);
      ctx.lineTo(iconX + 8, 32);
      ctx.lineTo(iconX - 8, 32);
      ctx.fill();
      D.ell(ctx, iconX, 19, 9, 3.5, "#d6cff7", 1.5);

      // Combo.
      let y = compact ? 82 : 92;
      if (s.combo >= 2) {
        const mult = s.multiplier();
        const pop = 1 + this.comboPop * 0.35;
        const colors = ["#ffffff", "#8dff5a", "#5fd0ff", "#ff5fb4", "#ffd23f"];
        ctx.save();
        ctx.translate(34, y + 10);
        ctx.scale(pop, pop);
        text(ctx, `x${mult}`, 0, 0, compact ? 28 : 34, colors[mult - 1], "center", 900, 6);
        ctx.restore();
        text(ctx, `COMBO ${s.combo}`, 66, y + 2, compact ? 15 : 17, "#fff", "left", 800, 4);
        const bw = compact ? 96 : 130;
        const k = U.clamp(s.comboTimer / U.COMBO_WINDOW, 0, 1);
        ctx.fillStyle = "rgba(20,10,48,0.7)";
        D.roundRectPath(ctx, 66, y + 14, bw, 7, 3.5);
        ctx.fill();
        ctx.fillStyle = k < 0.3 ? "#ff5f6b" : "#8dff5a";
        D.roundRectPath(ctx, 66, y + 14, Math.max(4, bw * k), 7, 3.5);
        ctx.fill();
        y += 44;
      }

      // Active power-ups with countdown rings.
      const p = g.player;
      let px = 30;
      for (const k of POWER_ORDER) {
        const left = p.power[k];
        if (left <= 0) continue;
        const def = U.POWERUPS[k];
        const r = compact ? 15 : 17;
        if (left > 2 || Math.floor(t * 8) % 2 === 0) U.drawPowerIcon(ctx, k, px, y + r, r, t, false);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(px, y + r, r + 5, -Math.PI / 2, -Math.PI / 2 + U.TAU * (left / def.dur));
        ctx.stroke();
        text(ctx, `${Math.ceil(left)}`, px, y + r * 2 + 12, 13, "#fff", "center", 800, 3);
        px += r * 2 + 16;
      }
    }

    drawTimer(ctx, compact, t) {
      const g = this.game;
      const cx = g.VW / 2;
      const w = compact ? 104 : 150;
      panel(ctx, cx - w / 2, 8, w, compact ? 50 : 56);
      let label;
      let value;
      let warn = false;
      if (g.mode === "endless") {
        label = `ZONE ${g.zone + 1}`;
        value = U.formatDuration(g.playSeconds);
      } else {
        label = `LEVEL ${g.levelIndex + 1}`;
        value = U.formatTime(g.timeLeft);
        warn = g.timeLeft <= 10 && g.state === "playing";
      }
      text(ctx, label, cx, 21, 11.5, "#b9acdf", "center", 700, 0);
      const pulse = warn ? 1 + Math.max(0, Math.sin(t * 10)) * 0.15 : 1;
      ctx.save();
      ctx.translate(cx, compact ? 41 : 44);
      ctx.scale(pulse, pulse);
      text(ctx, value, 0, 0, compact ? 24 : 30, warn ? "#ff5f6b" : "#ffffff", "center", 800, 5);
      ctx.restore();
      if (!compact) text(ctx, g.env.name.toUpperCase(), cx, 76, 13, "#ffffff", "center", 700, 4);
      this.drawMinimap(ctx, cx, compact ? 66 : 90, compact ? Math.min(140, g.VW * 0.28) : Math.min(320, g.VW * 0.26), t);
    }

    drawMinimap(ctx, cx, y, w, t) {
      const g = this.game;
      const x0 = cx - w / 2;
      const sx = (wx) => x0 + (wx / U.WORLD_W) * w;
      ctx.fillStyle = "rgba(20, 10, 48, 0.6)";
      D.roundRectPath(ctx, x0 - 4, y - 6, w + 8, 12, 6);
      ctx.fill();
      // The part of the world on screen.
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(sx(g.camX), y - 5, (g.VW / U.WORLD_W) * w, 10);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (const tg of g.targets) ctx.fillRect(sx(tg.x) - 0.5, y - 1, 1.5, 2);
      ctx.fillStyle = "#ff4b5c";
      for (const h of g.hazards) ctx.fillRect(sx(h.x) - 1.5, y - 2, 3, 4);
      ctx.fillStyle = "#ffd23f";
      for (const it of g.powerups.items) ctx.fillRect(sx(it.x) - 2, y - 2, 4, 4);
      for (const a of g.rescue.aliens) {
        if (g.player.power.beacon > 0 || a.state !== "hiding") {
          D.circ(ctx, sx(a.x), y, 3.5 + Math.sin(t * 8) * 1, "#c08cff", 1.5);
        }
      }
      D.circ(ctx, sx(g.player.x), y, 4, "#8dff5a", 1.5);
    }

    drawHealth(ctx, compact, t) {
      const g = this.game;
      const p = g.player;
      // Leaves room for the pause button, which is sized in screen pixels.
      const right = g.VW - Math.max(50, g.rightInset || 66);
      const size = compact ? 28 : 34;
      const flashing = this.healthFlash > 0 && Math.floor(t * 12) % 2 === 0;
      for (let i = 0; i < p.maxHealth; i++) {
        const x = right - (p.maxHealth - 1 - i) * (size + 6) - size / 2;
        const y = 30;
        const full = i < p.health;
        ctx.save();
        ctx.translate(x, y);
        const s = size / 44;
        ctx.scale(s, s);
        if (full && !(flashing && i === p.health)) {
          D.ell(ctx, 0, -6, 12, 11, "rgba(150,235,255,0.8)", 2.5);
          D.ell(ctx, 0, 2, 22, 7, flashing ? "#ff5f6b" : "#d6cff7", 2.5);
          D.circ(ctx, -10, 3, 2, "#ff5fb4", 0);
          D.circ(ctx, 0, 4, 2, "#8dff5a", 0);
          D.circ(ctx, 10, 3, 2, "#ffd23f", 0);
        } else {
          ctx.globalAlpha = 0.45;
          D.ell(ctx, 0, -6, 12, 11, "rgba(40,30,60,0.6)", 2.5);
          D.ell(ctx, 0, 2, 22, 7, "#4a3f6e", 2.5);
          ctx.globalAlpha = 1;
          if (flashing && i === p.health) {
            D.line(ctx, -14, -12, 14, 10, "#ff5f6b", 4);
            D.line(ctx, 14, -12, -14, 10, "#ff5f6b", 4);
          }
        }
        ctx.restore();
      }

      // Family tracker: lit heads for the relatives rescued this run.
      const fy = compact ? 62 : 70;
      const gap = compact ? 17 : 22;
      const fx0 = right + size / 2 - (U.FAMILY.length - 1) * gap;
      text(ctx, `FAMILY ${g.rescue.count}/7`, right + size / 2, fy - 2 + (compact ? 22 : 24), 12, "#c9ffb0", "right", 800, 3);
      U.FAMILY.forEach((m, i) => {
        const x = fx0 + i * gap;
        const got = g.rescue.rescuedRun.has(m.id);
        const style = U.Art.FAMILY_STYLE[m.id];
        D.circ(ctx, x, fy, compact ? 7.5 : 8.5, got ? style.skin : "#3b315c", 2);
        if (got) {
          ctx.fillStyle = D.OUT;
          ctx.beginPath();
          ctx.ellipse(x - 2.8, fy, 1.8, 2.6, -0.3, 0, U.TAU);
          ctx.ellipse(x + 2.8, fy, 1.8, 2.6, 0.3, 0, U.TAU);
          ctx.fill();
        } else {
          text(ctx, "?", x, fy + 1, 10, "#7d70a8", "center", 800, 0);
        }
      });
    }

    drawEdgeIndicators(ctx, t) {
      const g = this.game;
      const VW = g.VW;
      const p = g.player;
      // Beacon arrows toward stranded aliens.
      if (p.power.beacon > 0) {
        for (const a of g.rescue.aliens) {
          if (a.state === "lifting" || a.state === "rescued") continue;
          const sx = a.x - g.camX;
          if (sx > 30 && sx < VW - 30) continue;
          const left = sx < 0;
          const x = left ? 34 : VW - 34;
          const y = U.clamp(a.y - 40, 150, 520);
          this.arrow(ctx, x, y, left ? Math.PI : 0, "#c08cff", t);
          const dist = Math.round(Math.abs(a.x - p.x) / 10);
          text(ctx, `${dist}m`, x + (left ? 12 : -12), y + 28, 13, "#e4d1ff", left ? "left" : "right", 800, 3);
          ctx.save();
          ctx.translate(x + (left ? 14 : -14), y - 24);
          ctx.scale(0.45, 0.45);
          U.Art.drawAlien(ctx, a.member.id, { t, happy: false, wave: true, lx: 0 });
          ctx.restore();
        }
      }
      // Hazards closing in from off-screen.
      for (const h of g.hazards) {
        if (h.dead) continue;
        const sx = h.x - g.camX;
        if (sx > -10 && sx < VW + 10) continue;
        const dist = sx < 0 ? -sx : sx - VW;
        if (dist > 700) continue;
        const chasing = h.key === "helicopter" || h.key === "eagle" || h.charging || h.key === "rocket" || h.key === "tank";
        if (!chasing) continue;
        const left = sx < 0;
        const y = U.clamp((h.ground ? h.groundY - 60 : h.y), 140, 600);
        const x = left ? 26 : VW - 26;
        ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 8));
        this.arrow(ctx, x, y, left ? Math.PI : 0, "#ff4b5c", t, 0.8);
        ctx.globalAlpha = 1;
      }
    }

    arrow(ctx, x, y, angle, color, t, scale = 1) {
      const bob = Math.sin(t * 6) * 4;
      ctx.save();
      ctx.translate(x + Math.cos(angle) * bob, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      D.poly(ctx, [18, 0, -8, -16, -2, 0, -8, 16], color, 3);
      ctx.restore();
    }

    drawBanners(ctx, t) {
      const g = this.game;
      let y = 186;
      for (const b of this.banners) {
        const inK = U.easeOutBack(U.clamp(b.t / 0.25, 0, 1));
        const outK = U.clamp((b.time - b.t) / 0.3, 0, 1);
        const size = Math.min(b.size, g.VW / Math.max(8, b.text.length) * 1.5);
        ctx.globalAlpha = outK;
        ctx.save();
        ctx.translate(g.VW / 2, y);
        ctx.scale(inK, inK);
        text(ctx, b.text, 0, 0, size, b.color, "center", 900, 7);
        if (b.sub) text(ctx, b.sub, 0, size * 0.85, Math.round(size * 0.5), "#ffffff", "center", 700, 4);
        ctx.restore();
        ctx.globalAlpha = 1;
        y += size * (b.sub ? 1.9 : 1.25);
      }
    }

    drawBig(ctx, t) {
      const b = this.big;
      if (!b) return;
      const g = this.game;
      const inK = U.easeOutBack(U.clamp(b.t / 0.35, 0, 1));
      const outK = U.clamp((b.time - b.t) / 0.3, 0, 1);
      ctx.globalAlpha = outK;
      ctx.save();
      ctx.translate(g.VW / 2, 300);
      ctx.scale(inK, inK);
      const size = Math.min(64, (g.VW / Math.max(6, b.title.length)) * 1.4);
      text(ctx, b.title, 0, 0, size, b.color, "center", 900, 9);
      if (b.sub) {
        const lines = wrap(ctx, b.sub, Math.min(g.VW - 60, 640), 20);
        lines.forEach((line, i) => text(ctx, line, 0, size * 0.75 + 12 + i * 26, 20, "#ffffff", "center", 700, 5));
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function wrap(ctx, str, maxW, size) {
    ctx.font = `700 ${size}px ${FONT}`;
    const words = str.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  U.HUD = HUD;
  U.hudText = text;
})(window.UFO);
