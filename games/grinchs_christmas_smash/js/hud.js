/*
 * The in-game heads-up display, drawn on the canvas in screen space: level and score
 * (top left), the goal bar with star markers and destruction % (top centre), lives (top
 * right, beside the pause button), the combo meter and big pop-up banners.
 * The snowball tray and the Finish button are HTML (see ui.js) so they're easy to tap.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const FONT = 'Oxanium, "Trebuchet MS", sans-serif';

  class HUD {
    constructor() {
      this.banners = [];
      this.scoreShown = 0;
      this.bump = 0;
    }

    reset() {
      this.banners.length = 0;
      this.scoreShown = 0;
    }

    // A big centred message, e.g. a combo or an event.
    banner(title, sub, color = "#ffffff", dur = 2) {
      // A newer banner replaces any banner of the same kind still on screen.
      this.banners = this.banners.filter((b) => b.t > b.dur - 0.25 || b.title !== title);
      while (this.banners.length > 1) this.banners.shift();
      this.banners.push({ title, sub, color, t: 0, dur });
    }

    update(dt, score) {
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter((b) => b.t < b.dur);
      if (score > this.scoreShown) {
        this.scoreShown = Math.min(score, this.scoreShown + Math.max(10, (score - this.scoreShown) * 8 * dt));
        this.bump = 1;
      } else {
        this.scoreShown = score;
      }
      this.bump = Math.max(0, this.bump - dt * 4);
    }

    draw(ctx, game, W, H, dpr) {
      const u = dpr * G.clamp(Math.min(W / dpr / 1100, H / dpr / 620), 0.6, 1.2);
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      const safeL = game.safe.l * dpr;
      const safeT = game.safe.t * dpr;
      const safeR = game.safe.r * dpr;
      if (game.state !== "menu" && game.state !== "over") {
        this.drawScore(ctx, game, u, 12 * dpr + safeL, 10 * dpr + safeT);
        this.drawGoal(ctx, game, u, W / 2, 10 * dpr + safeT);
        if (game.mode === "campaign" && game.run) this.drawLives(ctx, game, u, W - 70 * dpr - safeR, 33 * dpr + safeT);
        this.drawCombo(ctx, game, u, W / 2, 104 * u + safeT);
      }
      this.drawBanners(ctx, u, W, H);
      ctx.restore();
    }

    panel(ctx, x, y, w, h, r) {
      Art.roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = "rgba(16, 26, 60, 0.72)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawScore(ctx, game, u, x, y) {
      const w = 220 * u;
      const h = 70 * u;
      this.panel(ctx, x, y, w, h, 14 * u);
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffd23f";
      ctx.font = `800 ${13 * u}px ${FONT}`;
      const name = game.level ? game.level.name.toUpperCase() : "";
      ctx.fillText(`LEVEL ${game.levelIndex + 1}${game.mode === "practice" ? " · PRACTICE" : ""}`, x + 14 * u, y + 16 * u);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = `700 ${11 * u}px ${FONT}`;
      let label = name;
      while (label.length > 4 && ctx.measureText(label).width > w - 28 * u) label = label.slice(0, -2);
      if (label !== name) label += "…";
      ctx.fillText(label, x + 14 * u, y + 31 * u);
      const s = 1 + this.bump * 0.08;
      ctx.save();
      ctx.translate(x + 14 * u, y + 52 * u);
      ctx.scale(s, s);
      ctx.font = `900 ${24 * u}px ${FONT}`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(G.fmt(this.scoreShown), 0, 0);
      ctx.restore();
      if (game.mode === "campaign" && game.run && game.run.score > 0) {
        ctx.textAlign = "right";
        ctx.font = `700 ${10 * u}px ${FONT}`;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(`RUN ${G.fmt(game.run.score)}`, x + w - 12 * u, y + 54 * u);
      }
    }

    drawGoal(ctx, game, u, cx, y) {
      const w = 340 * u;
      const h = 70 * u;
      const x = cx - w / 2;
      this.panel(ctx, x, y, w, h, 14 * u);
      const score = this.scoreShown;
      const top = game.star3;
      const bx = x + 16 * u;
      const bw = w - 32 * u;
      const by = y + 30 * u;
      const bh = 14 * u;
      ctx.textAlign = "left";
      ctx.font = `800 ${12 * u}px ${FONT}`;
      ctx.fillStyle = game.goalReached ? "#7dff9a" : "#ffffff";
      ctx.fillText(game.goalReached ? "GOAL REACHED!" : `GOAL: ${G.fmt(game.target)} POINTS`, bx, y + 15 * u);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffd23f";
      ctx.fillText(`${game.scoring.percent}% SMASHED`, bx + bw, y + 15 * u);
      // Bar.
      Art.roundRect(ctx, bx, by, bw, bh, bh / 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();
      const k = G.clamp(score / top, 0, 1);
      if (k > 0) {
        const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        g.addColorStop(0, "#2fbf71");
        g.addColorStop(0.6, "#ffd23f");
        g.addColorStop(1, "#ff7a3a");
        Art.roundRect(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2);
        ctx.fillStyle = g;
        ctx.fill();
      }
      // Star markers at each threshold.
      const marks = [game.target, game.star2, game.star3];
      marks.forEach((m, i) => {
        const mx = bx + bw * G.clamp(m / top, 0, 1);
        const got = score >= m;
        ctx.fillStyle = got ? "#ffd23f" : "rgba(255,255,255,0.35)";
        ctx.strokeStyle = got ? "#b8780a" : "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1.5 * u;
        Art.starPath(ctx, Math.min(mx, bx + bw - 8 * u), by + bh + 12 * u, (i === 0 ? 7 : 8) * u);
        ctx.fill();
        ctx.stroke();
      });
      ctx.textAlign = "left";
      ctx.font = `700 ${10 * u}px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(`MULTIPLIER x${game.scoring.multiplier}`, bx, by + bh + 12 * u);
    }

    drawLives(ctx, game, u, rx, cy) {
      const n = game.run.lives;
      ctx.textAlign = "right";
      for (let i = 0; i < 3; i++) {
        const x = rx - i * 28 * u;
        ctx.globalAlpha = i < n ? 1 : 0.25;
        ctx.save();
        ctx.translate(x - 10 * u, cy);
        ctx.scale(u * 0.9, u * 0.9);
        // A little Grinch face per life.
        Art.circle(ctx, 0, 0, 12, "#5cb531");
        Art.ellipse(ctx, -4, -2, 3.2, 2.6, "#fff36b");
        Art.ellipse(ctx, 4, -2, 3.2, 2.6, "#fff36b");
        Art.circle(ctx, -3.5, -1.8, 1.2, "#c0182c");
        Art.circle(ctx, 4.5, -1.8, 1.2, "#c0182c");
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-6, 4);
        ctx.quadraticCurveTo(0, 9, 7, 3);
        ctx.stroke();
        ctx.fillStyle = "#d42a33";
        ctx.beginPath();
        ctx.moveTo(-11, -6);
        ctx.quadraticCurveTo(0, -24, 14, -16);
        ctx.lineTo(10, -6);
        ctx.closePath();
        ctx.fill();
        Art.circle(ctx, 14, -16, 3.5, "#ffffff");
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    drawCombo(ctx, game, u, cx, cy) {
      const s = game.scoring;
      if (s.chain < 2) return;
      const mult = s.multiplier;
      const pulse = 1 + Math.sin(game.time * 14) * 0.04 * mult;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(pulse, pulse);
      ctx.textAlign = "center";
      ctx.font = `900 ${26 * u}px ${FONT}`;
      ctx.lineWidth = 6 * u;
      ctx.strokeStyle = "#1d2a4a";
      const col = mult >= 5 ? "#ff7ad9" : mult >= 3 ? "#ff9f1c" : mult >= 2 ? "#ffd23f" : "#ffffff";
      const text = `COMBO ${s.chain}${mult > 1 ? `  x${mult}` : ""}`;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = col;
      ctx.fillText(text, 0, 0);
      // Chain timer.
      const w = 150 * u;
      const k = G.clamp(s.chainT / 1.3, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(-w / 2, 18 * u, w, 5 * u);
      ctx.fillStyle = col;
      ctx.fillRect(-w / 2, 18 * u, w * k, 5 * u);
      ctx.restore();
    }

    drawBanners(ctx, u, W, H) {
      this.banners.forEach((b, i) => {
        const k = b.t / b.dur;
        const pop = G.easeOutElastic(Math.min(1, b.t * 2.2));
        const a = Math.min(1, (b.dur - b.t) * 3);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(W / 2, H * 0.3 + i * 100 * u - k * 14 * u);
        ctx.scale(pop, pop);
        ctx.rotate(Math.sin(b.t * 6) * 0.02);
        ctx.textAlign = "center";
        let size = 46 * u;
        ctx.font = `900 ${size}px ${FONT}`;
        while (ctx.measureText(b.title).width > W * 0.9 && size > 14) {
          size -= 2;
          ctx.font = `900 ${size}px ${FONT}`;
        }
        ctx.lineWidth = size * 0.22;
        ctx.strokeStyle = "#1d2a4a";
        ctx.strokeText(b.title, 0, 0);
        ctx.fillStyle = b.color;
        ctx.fillText(b.title, 0, 0);
        if (b.sub) {
          ctx.font = `800 ${16 * u}px ${FONT}`;
          ctx.lineWidth = 5 * u;
          ctx.strokeText(b.sub, 0, size * 0.75);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(b.sub, 0, size * 0.75);
        }
        ctx.restore();
      });
    }
  }

  G.HUD = HUD;
})(window.GS);
