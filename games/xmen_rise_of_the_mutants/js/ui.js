/*
 * In-game HUD drawn on the canvas (portrait, meters, score, collectibles, boss bar,
 * combo counter, boss intro banner) and DOM toasts for unlocks and achievements.
 */
(function (XM) {
  "use strict";
  const A = XM.Art;
  const U = XM.U;

  class HUD {
    constructor() {
      this.toastRoot = document.getElementById("toasts");
      this.banner = null;
      this.dispHp = 1;
      this.t = 0;
      this.toastQueue = [];
      this.toastBusy = 0;
    }

    toast(title, text, kind = "info") {
      this.toastQueue.push({ title, text, kind });
    }

    flushAchievements() {
      while (XM.Achievements.queue.length) {
        const a = XM.Achievements.queue.shift();
        this.toast(a.title, a.text, "ach");
      }
    }

    update(dt) {
      this.t += dt;
      this.flushAchievements();
      this.toastBusy -= dt;
      if (this.toastBusy <= 0 && this.toastQueue.length && this.toastRoot) {
        const q = this.toastQueue.shift();
        const el = document.createElement("div");
        el.className = `toast toast-${q.kind}`;
        el.innerHTML = `<b>${U.escape(q.title)}</b><span>${U.escape(q.text)}</span>`;
        this.toastRoot.appendChild(el);
        setTimeout(() => el.classList.add("out"), 3200);
        setTimeout(() => el.remove(), 3800);
        this.toastBusy = 0.6;
      }
      if (this.banner) {
        this.banner.t += dt;
        if (this.banner.t > 3.2) this.banner = null;
      }
    }

    bossIntro(boss) {
      this.banner = { boss, t: 0 };
    }

    meter(ctx, x, y, w, h, frac, color, back = "rgba(0,0,0,0.55)", ghost = null) {
      A.box(ctx, x, y, w, h, back, true, h / 2, 2);
      if (ghost !== null && ghost > frac) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        A.roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * ghost), h - 4, (h - 4) / 2);
        ctx.fill();
      }
      if (frac > 0) {
        ctx.fillStyle = color;
        A.roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * frac), h - 4, (h - 4) / 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(x + h / 2, y + 3, Math.max(0, (w - h) * frac), 2);
      }
    }

    draw(ctx, w) {
      const p = w.player;
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const t = this.t;
      const save = XM.Save.char(p.id);

      // ---- Portrait with the Ultimate ring ----
      const px = 52;
      const py = 52;
      const ultFrac = p.ult / 100;
      const ready = p.ult >= 100;
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(px, py, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ready ? `hsl(${(t * 220) % 360},100%,62%)` : "#ffd23f";
      ctx.beginPath();
      ctx.arc(px, py, 38, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ultFrac);
      ctx.stroke();
      if (ready) A.glow(ctx, px, py, 60 + Math.sin(t * 8) * 6, "#ffd23f", 0.45);
      XM.CharArt.portrait(ctx, p.id, p.look, px, py, 64, { t, power: p.power });
      A.box(ctx, px - 24, py + 30, 48, 18, "#c4161c", true, 4, 2);
      A.text(ctx, `LV ${save.level}`, px, py + 39, 11, "#ffffff", "center", false);
      if (ready) {
        A.burst(ctx, px - 30, py - 30, 16, 8, "#ffd23f", t * 2);
        A.text(ctx, "ULT", px - 30, py - 30, 10, "#7a1a00", "center", false);
      }

      // ---- Name, health, energy, ultimate ----
      const bx = 100;
      A.text(ctx, p.ch.name.toUpperCase(), bx, 22, 16, "#ffffff", "left");
      const hpFrac = U.clamp(p.hp / p.st.maxHp, 0, 1);
      this.dispHp = U.approach(this.dispHp, hpFrac, 0.006);
      if (this.dispHp < hpFrac) this.dispHp = hpFrac;
      const hpCol = hpFrac > 0.5 ? "#3ad06a" : hpFrac > 0.25 ? "#f2c230" : "#ff4a3a";
      this.meter(ctx, bx, 34, 230, 16, hpFrac, hpCol, undefined, this.dispHp);
      A.text(ctx, `${Math.ceil(p.hp)} / ${p.st.maxHp}`, bx + 115, 42, 10, "#ffffff", "center", false);
      this.meter(ctx, bx, 54, 190, 11, p.energy / p.st.maxEnergy, p.energy >= p.st.cost ? "#3aa8ff" : "#2a5a8a");
      A.text(ctx, "X", bx + 198, 60, 10, "#7ad0ff", "left");
      this.meter(ctx, bx, 69, 160, 9, ultFrac, ready ? `hsl(${(t * 220) % 360},100%,60%)` : "#ffd23f");
      A.text(ctx, ready ? "ULTIMATE READY!" : "ULT", bx + 168, 74, 10, ready ? "#ffe14a" : "#ffd23f", "left");
      // Lives
      for (let i = 0; i < 3; i++) A.xLogo(ctx, bx + 8 + i * 20, 92, 7, i < w.lives ? "#ffe14a" : "#555", i < w.lives ? "#c4161c" : "#222");

      // ---- Right side: level, score, orbs, X symbols, time ----
      const rx = vw - 16;
      A.text(ctx, `LEVEL ${w.levelIndex + 1}`, rx, 18, 13, "#ffe14a", "right");
      A.text(ctx, U.fmt(w.stats.score), rx, 42, 24, "#ffffff", "right");
      A.glow(ctx, rx - 96, 70, 12, "#3ad0ff", 0.8);
      A.circle(ctx, rx - 96, 70, 6, "#bff4ff", true, 1.5);
      A.text(ctx, `× ${w.stats.orbs}`, rx - 84, 70, 14, "#bff4ff", "left");
      for (let i = 0; i < 3; i++) {
        const got = w.stats.x[i];
        const ix = rx - 50 + i * 18;
        if (got) A.glow(ctx, ix, 96, 14, "#ffd23f", 0.7);
        A.xLogo(ctx, ix, 96, 7, got ? "#ffe14a" : "#4a4a52", got ? "#c4161c" : "#1e1e24");
      }
      A.text(ctx, `${w.stats.x.filter(Boolean).length}/3`, rx - 72, 96, 12, "#ffe14a", "right");
      A.text(ctx, U.time(w.stats.time), rx, 118, 12, "#c8d0dc", "right");

      // ---- Objective and messages ----
      if (w.objectiveTotal) {
        const done = Math.min(w.stats.objectives, w.objectiveTotal);
        const text = `${w.def.objective.label}: ${done}/${w.objectiveTotal}`;
        ctx.font = '700 13px Oxanium, "Trebuchet MS", sans-serif';
        const tw = ctx.measureText(text).width + 24;
        A.box(ctx, vw / 2 - tw / 2, 8, tw, 24, done >= w.objectiveTotal ? "rgba(20,80,40,0.8)" : "rgba(10,20,40,0.8)", true, 6, 2);
        A.text(ctx, text, vw / 2, 20, 13, done >= w.objectiveTotal ? "#7aff9a" : "#ffffff", "center", false, 700);
      }
      if (w.messageT > 0) {
        ctx.globalAlpha = Math.min(1, w.messageT * 3);
        A.text(ctx, w.message, vw / 2, 66, 20, "#ffe14a", "center");
        ctx.globalAlpha = 1;
      }

      // ---- Combo ----
      if (p.hitCombo >= 3) {
        const k = Math.min(1, p.hitComboT);
        ctx.globalAlpha = k;
        const s = 1 + Math.max(0, p.hitComboT - 2) * 2;
        A.text(ctx, `${p.hitCombo}`, vw - 18, 160, 34 * s, "#ffe14a", "right");
        A.text(ctx, "HIT COMBO", vw - 18, 188, 13, "#ffffff", "right");
        ctx.globalAlpha = 1;
      }

      // ---- Boss bar ----
      const b = w.boss;
      if (b && !(b.dead && b.deathT > 2)) {
        const bw = Math.min(560, vw - 140);
        const bx2 = (vw - bw) / 2;
        const by = vh - 46;
        A.box(ctx, bx2 - 10, by - 26, bw + 20, 50, "rgba(20,6,10,0.8)", true, 8, 3);
        A.text(ctx, b.name, bx2, by - 12, 15, "#ff5a3a", "left");
        A.text(ctx, b.title, bx2 + bw, by - 12, 11, "#e0c0c0", "right", false);
        this.meter(ctx, bx2, by, bw, 16, b.hp / b.maxHp, "#e0262c");
        const th = b.def.phases || [0.66, 0.33];
        for (const f of th) {
          ctx.fillStyle = "#ffe14a";
          ctx.fillRect(bx2 + bw * f - 1, by, 2, 16);
        }
        if (b.bubble > 0) A.text(ctx, "SHIELDED", bx2 + bw / 2, by + 8, 11, "#c08aff", "center");
      }

      // ---- Boss intro banner ----
      if (this.banner) {
        const k = this.banner.t;
        const inA = Math.min(1, k * 4);
        const out = k > 2.7 ? Math.max(0, 1 - (k - 2.7) * 2) : 1;
        ctx.globalAlpha = inA * out;
        ctx.save();
        ctx.translate(vw / 2, vh * 0.42);
        ctx.rotate(-0.06);
        ctx.fillStyle = "#c4161c";
        ctx.fillRect(-vw, -46, vw * 2, 92);
        ctx.fillStyle = "#0a0610";
        ctx.fillRect(-vw, -50, vw * 2, 6);
        ctx.fillRect(-vw, 44, vw * 2, 6);
        const slide = (1 - inA) * 300;
        A.text(ctx, this.banner.boss.name, -slide, -10, 40, "#ffe14a", "center");
        A.text(ctx, this.banner.boss.title.toUpperCase(), slide, 26, 16, "#ffffff", "center");
        ctx.restore();
        if (k > 0.6 && this.banner.boss.def.intro) {
          ctx.font = '700 15px Oxanium, "Trebuchet MS", sans-serif';
          const lines = U.wrap(ctx, `"${this.banner.boss.def.intro}"`, vw * 0.7);
          lines.forEach((ln, i) => A.text(ctx, ln, vw / 2, vh * 0.42 + 80 + i * 20, 15, "#ffffff", "center", true, 700));
        }
        if (k > 1.4 && this.banner.boss.def.hint) A.text(ctx, this.banner.boss.def.hint, vw / 2, vh * 0.42 + 130, 13, "#7ad0ff", "center", true, 700);
        ctx.globalAlpha = 1;
      }

      if (XM.Save.data.settings.showFps && XM.app) A.text(ctx, `${XM.app.engine.fps} FPS`, vw / 2, vh - 12, 11, "#7aff7a", "center");
    }
  }

  XM.HUD = HUD;
})(window.XM);
