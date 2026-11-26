/*
 * Collectibles: Mutant Energy Orbs, the three hidden X symbols per level, health,
 * X-Energy and Ultimate pickups, bonus tokens and rare upgrade items.
 */
(function (XM) {
  "use strict";
  const A = XM.Art;
  const U = XM.U;

  const KINDS = {
    orb: { r: 9, score: 100 },
    xsymbol: { r: 18, score: 1000 },
    health: { r: 12, score: 50 },
    energy: { r: 12, score: 50 },
    ult: { r: 12, score: 50 },
    token: { r: 12, score: 500 },
    rare: { r: 13, score: 1500 },
  };

  class Pickup {
    constructor(kind, x, y, opts = {}) {
      this.kind = kind;
      this.x = x;
      this.y = y;
      this.r = KINDS[kind].r;
      this.t = Math.random() * 6;
      this.taken = false;
      this.vx = opts.vx || 0;
      this.vy = opts.vy || 0;
      this.dropped = !!opts.dropped; // from crates and enemies: falls and settles
      this.index = opts.index;
      this.magnet = false;
      this.life = opts.life || 0;
    }

    update(dt, w) {
      this.t += dt;
      const p = w.player;
      if (this.dropped) {
        this.vy += 1200 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.97;
        if (XM.Physics.solidAt(w.level, this.x, this.y + this.r) || XM.Physics.tile(w.level, Math.floor(this.x / XM.T), Math.floor((this.y + this.r) / XM.T)) === XM.TILE.ONEWAY) {
          this.y = Math.floor((this.y + this.r) / XM.T) * XM.T - this.r;
          this.vy = 0;
          this.vx = 0;
          this.dropped = false;
        }
        if (this.y > w.level.H * XM.T) this.taken = true;
      }
      if (this.life) {
        this.life -= dt;
        if (this.life <= 0) this.taken = true;
      }
      if (p.dead) return;
      const dx = p.cx - this.x;
      const dy = p.cy - this.y;
      const d = Math.hypot(dx, dy);
      const magnet = this.kind === "orb" ? 50 + p.st.fx.orbMagnet : 0;
      if (magnet && d < magnet) this.magnet = true;
      if (this.magnet) {
        const s = 600 * dt;
        this.x += (dx / (d || 1)) * Math.min(s, d);
        this.y += (dy / (d || 1)) * Math.min(s, d);
      }
      if (Math.abs(dx) < p.w / 2 + this.r && Math.abs(p.y + p.h / 2 - this.y) < p.h / 2 + this.r) this.collect(w, p);
    }

    collect(w, p) {
      if (this.taken) return;
      this.taken = true;
      const k = this.kind;
      const st = w.stats;
      w.addScore(KINDS[k].score, this.x, this.y - 10);
      switch (k) {
        case "orb":
          st.orbs++;
          p.ult = Math.min(100, p.ult + 3 * p.st.ultGain);
          p.energy = Math.min(p.st.maxEnergy, p.energy + 2);
          XM.Audio.sfx("orb");
          XM.FX.burst(this.x, this.y, { count: 6, color: "#7ae8ff", speed: 120, life: 0.3, type: XM.FX.T.STAR, size: 3 });
          break;
        case "xsymbol":
          w.collectX(this.index, this.x, this.y);
          break;
        case "health":
          p.heal(p.st.maxHp * 0.35);
          XM.Audio.sfx("heal");
          XM.FX.text(this.x, this.y - 20, "+HEALTH", "#7aff7a", 15);
          XM.FX.burst(this.x, this.y, { count: 10, color: "#7aff7a", speed: 140, life: 0.5, type: XM.FX.T.STAR });
          break;
        case "energy":
          p.energy = Math.min(p.st.maxEnergy, p.energy + p.st.maxEnergy * 0.6);
          XM.Audio.sfx("pickup");
          XM.FX.text(this.x, this.y - 20, "+X-ENERGY", "#5ad0ff", 15);
          break;
        case "ult":
          p.ult = Math.min(100, p.ult + 30 * p.st.ultGain);
          XM.Audio.sfx("pickup");
          XM.FX.text(this.x, this.y - 20, "+ULTIMATE", "#ffd84a", 15);
          break;
        case "token":
          st.tokens++;
          XM.Audio.sfx("pickup");
          XM.FX.text(this.x, this.y - 20, "BONUS +500", "#e8eef6", 15);
          break;
        case "rare":
          w.collectRare(this.x, this.y);
          break;
      }
    }

    draw(ctx) {
      const t = this.t;
      const bob = this.dropped ? 0 : Math.sin(t * 3) * 3;
      const x = this.x;
      const y = this.y + bob;
      switch (this.kind) {
        case "orb": {
          A.glow(ctx, x, y, 20 + Math.sin(t * 5) * 3, "#3ad0ff", 0.75);
          A.circle(ctx, x, y, 7, "#bff4ff", true, 1.5);
          ctx.strokeStyle = "#3a9aff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 4, t * 4, t * 4 + 3.6);
          ctx.stroke();
          A.circle(ctx, x - 2, y - 2, 1.6, "#ffffff", false);
          break;
        }
        case "xsymbol": {
          const sx = Math.cos(t * 2.2);
          A.glow(ctx, x, y, 44 + Math.sin(t * 4) * 6, "#ffd23f", 0.75);
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(Math.max(0.15, Math.abs(sx)), 1);
          A.xLogo(ctx, 0, 0, 17, "#ffe14a", sx > 0 ? "#c4161c" : "#8a0f14");
          ctx.restore();
          if (Math.random() < 0.25) XM.FX.spawn(XM.FX.T.STAR, x + U.rand(-24, 24), y + U.rand(-24, 24), 0, -20, 0.6, 4, "#fff6c0");
          break;
        }
        case "health":
          A.glow(ctx, x, y, 22, "#ff5a5a", 0.5);
          A.box(ctx, x - 11, y - 11, 22, 22, "#ffffff", true, 5);
          ctx.fillStyle = "#e0262c";
          ctx.fillRect(x - 3, y - 8, 6, 16);
          ctx.fillRect(x - 8, y - 3, 16, 6);
          break;
        case "energy":
          A.glow(ctx, x, y, 22, "#5ad0ff", 0.5);
          A.box(ctx, x - 11, y - 11, 22, 22, "#12304a", true, 5);
          A.poly(ctx, [x + 2, y - 9, x - 5, y + 1, x, y + 1, x - 2, y + 9, x + 6, y - 2, x + 1, y - 2], "#7ae8ff", false);
          break;
        case "ult":
          A.glow(ctx, x, y, 24, "#ffd84a", 0.6);
          A.burst(ctx, x, y, 12, 5, "#ffd84a", t);
          A.text(ctx, "U", x, y + 1, 10, "#7a4a00", "center", false);
          break;
        case "token":
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(Math.max(0.2, Math.abs(Math.cos(t * 3))), 1);
          A.circle(ctx, 0, 0, 11, "#d8dee8", true, 2);
          A.circle(ctx, 0, 0, 7, "#b8c0cc", false);
          A.text(ctx, "X", 0, 1, 10, "#4a5260", "center", false);
          ctx.restore();
          break;
        case "rare":
          A.glow(ctx, x, y, 30 + Math.sin(t * 6) * 4, "#c07aff", 0.8);
          A.poly(ctx, [x, y - 14, x + 10, y - 3, x + 6, y + 12, x - 6, y + 12, x - 10, y - 3], "#d8a8ff", true, 2);
          A.poly(ctx, [x, y - 14, x + 4, y - 3, x, y + 12, x - 4, y - 3], "#f0e0ff", false);
          break;
      }
    }
  }

  XM.Pickup = Pickup;
  XM.PICKUP_KINDS = KINDS;
})(window.XM);
