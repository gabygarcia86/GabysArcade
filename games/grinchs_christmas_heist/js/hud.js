/*
 * The in-game HUD, drawn on the canvas in view units (720 tall): score, timer, level,
 * loot count and sack meter, lives, active power-ups, banners, edge arrows (getaway,
 * golden presents, Max), tutorial hints and the start countdown.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const FONT = 'Oxanium, "Trebuchet MS", sans-serif';

  function panel(ctx, x, y, w, h, r = 14) {
    ctx.fillStyle = "rgba(18, 28, 58, 0.74)";
    Art.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function text(ctx, str, x, y, size, color, align = "left", weight = 800, stroke = true) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    if (stroke) {
      ctx.lineWidth = Math.max(3, size / 6);
      ctx.strokeStyle = "rgba(12, 18, 40, 0.9)";
      ctx.lineJoin = "round";
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  class HUD {
    constructor(game) {
      this.game = game;
      this.banners = [];
      this.hintStep = 0;
      this.hintT = 0;
      this.scoreShown = 0;
    }

    reset() {
      this.banners = [];
      this.hintStep = 0;
      this.hintT = 0;
    }

    banner(title, sub, color) {
      this.banners.push({ title, sub, color: color || "#ffffff", t: 0, life: 2.8 });
      if (this.banners.length > 3) this.banners.shift();
    }

    update(dt) {
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter((b) => b.t < b.life);
      const g = this.game;
      const target = g.displayScore();
      this.scoreShown = G.approach(this.scoreShown, target, Math.max(60, Math.abs(target - this.scoreShown) * 6) * dt);
      this.updateHints(dt);
    }

    updateHints(dt) {
      const g = this.game;
      if (!g.storage.data.settings.hints || g.L.id !== 1 || g.mode === "menu" || g.state !== "play") return;
      this.hintT += dt;
      const p = g.player;
      const s = this.hintStep;
      const next = () => {
        this.hintStep++;
        this.hintT = 0;
      };
      if (s === 0 && (g.distMoved > 220 || this.hintT > 9)) next();
      else if (s === 1 && (p.sack.length >= 3 || this.hintT > 12)) next();
      else if (s === 2 && (this.hintT > 7 || g.sneakTime > 1.2)) next();
      else if (s === 3 && (this.hintT > 7 || g.boostsUsed > 0)) next();
      else if (s === 4 && (p.sack.length >= 8 || g.timeLeft < 28) && this.hintT > 2) next();
      else if (s === 5 && this.hintT > 9) next();
    }

    hintText() {
      const g = this.game;
      if (!g.storage.data.settings.hints || g.L.id !== 1 || g.state !== "play") return null;
      const touch = g.input.wantsTouch();
      switch (this.hintStep) {
        case 0:
          return touch ? "Drag the joystick to move the Grinch" : "Move with WASD or the arrow keys";
        case 1:
          return "Walk into presents and goodies to steal them!";
        case 2:
          return touch ? "Whos see in their yellow cones. Hold SNEAK to tiptoe" : "Whos see in their yellow cones. Hold SHIFT to tiptoe";
        case 3:
          return touch ? "Tap BOOST for a burst of speed" : "Press SPACE for a burst of speed";
        case 4:
          return "A full sack slows you down. Watch the sack meter!";
        case 5:
          return "Follow the green arrow back to your sled to escape!";
        default:
          return null;
      }
    }

    draw(ctx, VW, VH) {
      const g = this.game;
      const compact = VW < 700;
      const p = g.player;
      ctx.save();

      // Red edges while being chased.
      if (g.chased && g.state === "play") {
        const a = 0.22 + Math.sin(g.time * 8) * 0.08;
        const grd = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85);
        grd.addColorStop(0, "rgba(255,0,0,0)");
        grd.addColorStop(1, `rgba(255,40,40,${a})`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, VW, VH);
      }

      // ---- Score panel (top left).
      const pw = compact ? 176 : 236;
      panel(ctx, 10, 10, pw, compact ? 98 : 106);
      text(ctx, "SCORE", 24, 28, 12, "#9fe7ff", "left", 700, false);
      text(ctx, G.fmt(this.scoreShown), 24, 52, compact ? 26 : 32, "#ffffff");
      if (g.multT > 0) {
        const mx = 24 + ctx.measureText(G.fmt(this.scoreShown)).width + 12;
        if (mx < pw - 10) text(ctx, "x2", Math.min(mx, pw - 30), 52, 20, "#ffd23f");
      }
      let lvl = `LV ${g.L.id}  ${g.L.name}`;
      ctx.font = `700 12px ${FONT}`;
      while (ctx.measureText(lvl).width > pw - 30 && lvl.length > 8) lvl = lvl.slice(0, -2);
      if (lvl !== `LV ${g.L.id}  ${g.L.name}`) lvl += "…";
      text(ctx, lvl, 24, 76, 12, "#ffe08a", "left", 700, false);
      // Loot count and sack meter.
      const my = compact ? 94 : 98;
      ctx.save();
      ctx.translate(30, my + 4);
      ctx.scale(0.42, 0.42);
      Art.item(ctx, "large", 0, g.time, true);
      ctx.restore();
      text(ctx, `x${p.sack.length}`, 42, my - 4, 14, "#ffffff", "left", 800);
      const bx = 78;
      const bw = pw - bx - 14;
      const fill = Math.min(1, p.weight / G.SACK_SHOW);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      Art.roundRect(ctx, bx, my - 10, bw, 12, 6);
      ctx.fill();
      const col = p.stage === 3 ? "#ff4d4d" : p.stage === 2 ? "#ffb52e" : "#4cd964";
      if (fill > 0) {
        ctx.fillStyle = col;
        Art.roundRect(ctx, bx, my - 10, Math.max(12, bw * fill), 12, 6);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(bx + bw * (G.SACK_HEAVY / G.SACK_SHOW), my - 10, 2, 12);
      ctx.fillRect(bx + bw * (G.SACK_OVER / G.SACK_SHOW), my - 10, 2, 12);
      const stageName = p.stage === 3 ? "OVERLOADED!" : p.stage === 2 ? "HEAVY" : "LIGHT";
      if (p.stage === 3 && Math.sin(g.time * 8) < 0) {
        // Blink.
      } else {
        text(ctx, stageName, bx + bw / 2, my - 4, 9, "#ffffff", "center", 800);
      }

      // ---- Timer (top centre).
      const tx = VW / 2;
      const ty = 50;
      const tl = Math.max(0, Math.ceil(g.timeLeft));
      const hurry = g.timeLeft <= 10 && g.state === "play";
      const pulse = hurry ? 1 + Math.max(0, Math.sin(g.time * 10)) * 0.08 : 1;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(pulse, pulse);
      // Wreath ring.
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#1f7a3a";
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, G.TAU);
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#35a855";
      ctx.setLineDash([4, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Remaining time arc.
      ctx.lineWidth = 5;
      ctx.strokeStyle = hurry ? "#ff4d4d" : "#ffd23f";
      ctx.beginPath();
      ctx.arc(0, 0, 36, -Math.PI / 2, -Math.PI / 2 + G.TAU * G.clamp(g.timeLeft / G.ROUND_TIME, 0, 1));
      ctx.stroke();
      ctx.fillStyle = hurry ? "#ffe3e3" : "#ffffff";
      Art.circle(ctx, 0, 0, 29);
      ctx.fill();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * G.TAU + 0.3;
        Art.circle(ctx, Math.cos(a) * 36, Math.sin(a) * 36, 3.2, "#e0303a");
      }
      ctx.font = `900 30px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = hurry ? "#d61f2c" : "#1d2340";
      ctx.fillText(String(tl), 0, 2);
      ctx.restore();

      // Getaway reminder under the timer.
      if (g.state === "play" && g.timeLeft <= 15 && Math.sin(g.time * 6) > -0.4) {
        text(ctx, "GET TO THE GETAWAY!", tx, ty + 56, compact ? 14 : 17, "#7dff8a", "center");
      }

      // ---- Lives (top right).
      const rx = VW - g.rightInset - 8;
      const hats = Math.max(0, g.lives);
      const hw = compact ? 24 : 30;
      panel(ctx, rx - hw * Math.max(3, hats) - 14, 10, hw * Math.max(3, hats) + 14, 44, 12);
      for (let i = 0; i < Math.max(3, hats); i++) {
        ctx.globalAlpha = i < hats ? 1 : 0.25;
        Art.grinchHead(ctx, rx - hw * (i + 0.5) - 6, 36, compact ? 0.62 : 0.74, g.time + i);
      }
      ctx.globalAlpha = 1;

      // Max multiplier badge.
      let ry = 64;
      if (g.multT > 0) {
        panel(ctx, rx - 120, ry, 120, 34, 10);
        text(ctx, "MAX x2!", rx - 60, ry + 14, 16, "#ffd23f", "center");
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(rx - 110, ry + 27, 100 * Math.min(1, g.multT / 8), 3);
        ry += 42;
      }

      // ---- Active power-ups (under the timer, or right side when compact).
      const actives = [];
      for (const k in p.powers) if (p.powers[k] > 0) actives.push(k);
      if (actives.length) {
        const size = 38;
        const gap = 8;
        const total = actives.length * size + (actives.length - 1) * gap;
        let x0 = compact ? rx - total : tx - total / 2;
        const y0 = compact ? ry + 4 : ty + (g.timeLeft <= 15 ? 78 : 50);
        for (const k of actives) {
          const cx = x0 + size / 2;
          const cy = y0 + size / 2;
          const frac = p.powers[k] / G.POWERUPS[k].time;
          ctx.fillStyle = "rgba(18, 28, 58, 0.8)";
          Art.circle(ctx, cx, cy, size / 2);
          ctx.fill();
          ctx.strokeStyle = Art.POWER_COLORS[k];
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, cy, size / 2 - 2, -Math.PI / 2, -Math.PI / 2 + G.TAU * frac);
          ctx.stroke();
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(0.8, 0.8);
          Art.powerIcon(ctx, k, g.time);
          ctx.restore();
          text(ctx, String(Math.ceil(p.powers[k])), cx + size / 2 - 4, cy + size / 2 - 4, 12, "#ffffff", "center", 800);
          x0 += size + gap;
        }
      }

      // ---- Edge markers.
      this.drawMarkers(ctx, VW, VH);

      // ---- Banners.
      const b = this.banners[this.banners.length - 1];
      if (b) {
        const k = b.t / b.life;
        const s = b.t < 0.25 ? G.easeOutBack(b.t / 0.25) : 1;
        const alpha = k > 0.8 ? (1 - k) / 0.2 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(VW / 2, VH * 0.27);
        ctx.scale(s, s);
        text(ctx, b.title, 0, 0, compact ? 26 : 38, b.color, "center", 900);
        if (b.sub) text(ctx, b.sub, 0, compact ? 28 : 36, compact ? 14 : 18, "#ffffff", "center", 700);
        ctx.restore();
      }

      // ---- Tutorial hint.
      const hint = this.hintText();
      if (hint) {
        ctx.font = `700 ${compact ? 14 : 17}px ${FONT}`;
        const w = ctx.measureText(hint).width + 36;
        const hy = VH - (g.input.wantsTouch() && !compact ? 150 : 56);
        const hx = VW / 2;
        const bob = Math.sin(g.time * 3) * 3;
        panel(ctx, hx - w / 2, hy - 20 + bob, w, 40, 20);
        text(ctx, hint, hx, hy + bob, compact ? 14 : 17, "#fff6a8", "center", 700, false);
      }

      // ---- Countdown.
      if (g.state === "ready") {
        const left = g.readyT;
        const n = Math.ceil(left);
        const str = n > 0 ? String(n) : "GO!";
        const frac = left - Math.floor(left);
        const s = 1 + frac * 0.6;
        ctx.save();
        ctx.translate(VW / 2, VH / 2 - 40);
        ctx.scale(s, s);
        ctx.globalAlpha = 0.4 + (1 - frac) * 0.6;
        text(ctx, str, 0, 0, 90, n > 0 ? "#ffd23f" : "#7dff8a", "center", 900);
        ctx.restore();
        text(ctx, g.L.name.toUpperCase(), VW / 2, VH / 2 + 40, compact ? 20 : 28, "#ffffff", "center", 900);
      }

      // Flash when caught.
      if (g.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, g.flash)})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      ctx.restore();
    }

    drawMarkers(ctx, VW, VH) {
      const g = this.game;
      const list = [{ x: g.world.getaway.x, y: g.world.getaway.y, label: "GETAWAY", color: "#5cff7a", getaway: true }];
      for (const m of g.markers) list.push({ x: m.obj.x, y: m.obj.y, label: m.label, color: m.color });
      const top = 120;
      for (const m of list) {
        const sx = m.x - g.camX;
        const sy = m.y - g.camY - 30;
        const inside = sx > 20 && sx < VW - 20 && sy > top - 20 && sy < VH - 20;
        if (inside) {
          if (m.getaway && !(g.player.sack.length > 0 && g.getawayArmed)) continue;
          const bob = Math.sin(g.time * 6) * 6;
          ctx.save();
          ctx.translate(sx, sy - 70 + bob);
          ctx.fillStyle = m.color;
          ctx.beginPath();
          ctx.moveTo(-12, -10);
          ctx.lineTo(12, -10);
          ctx.lineTo(0, 6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(12,18,40,0.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
          text(ctx, m.getaway ? "ESCAPE!" : m.label, sx, sy - 92 + bob, 14, m.color, "center");
          continue;
        }
        const cx = VW / 2;
        const cy = (VH + top) / 2;
        const dx = sx - cx;
        const dy = sy - cy;
        const k = Math.min((VW / 2 - 34) / Math.abs(dx || 1e-6), ((VH - top) / 2 - 34) / Math.abs(dy || 1e-6));
        const ex = cx + dx * k;
        const ey = cy + dy * k;
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.fillStyle = "rgba(18, 28, 58, 0.8)";
        Art.circle(ctx, 0, 0, 22);
        ctx.fill();
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.rotate(ang);
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(18, -9);
        ctx.lineTo(18, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const dist = Math.round(G.dist(g.player.x, g.player.y, m.x, m.y) / 10);
        text(ctx, m.label, ex, ey - 4, 10, m.color, "center", 800);
        text(ctx, `${dist}m`, ex, ey + 9, 10, "#ffffff", "center", 700);
      }
    }
  }

  G.HUD = HUD;
})(window.GH);
