/*
 * Power-ups float in the sky. Fly into one, or pull it in with the beam, to collect it.
 * Timed ones count down in the HUD; repair kits fix one point of hull.
 */
(function (U) {
  "use strict";

  const D = U.Draw;

  const TYPES = {
    super: { name: "SUPER BEAM", color: "#5cf2c8", dur: 10, desc: "Double beam range and width for 10 seconds." },
    shield: { name: "ENERGY SHIELD", color: "#5fd0ff", dur: 10, desc: "Blocks all damage for 10 seconds." },
    speed: { name: "SPEED BOOST", color: "#ffb02e", dur: 8, desc: "Fly much faster for 8 seconds." },
    repair: { name: "REPAIR KIT", color: "#ff5f6b", dur: 0, desc: "Restores one hull point." },
    double: { name: "DOUBLE POINTS", color: "#ffd23f", dur: 10, desc: "All abduction points doubled for 10 seconds." },
    beacon: { name: "ALIEN BEACON", color: "#c08cff", dur: 10, desc: "Reveals stranded aliens and points the way." },
  };
  const LIFE = 14;

  class PowerUp {
    constructor(type, x, y) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.baseY = y;
      this.vx = U.rand(-20, 20);
      this.t = U.rand(0, 3);
      this.life = LIFE;
      this.dead = false;
      this.pulled = false;
    }
  }

  class PowerUpManager {
    constructor(game) {
      this.game = game;
      this.items = [];
      this.timer = 0;
      this.every = 13;
    }

    reset(every) {
      this.items = [];
      this.every = every;
      this.timer = 7;
    }

    choose() {
      const g = this.game;
      const p = g.player;
      const weights = { super: 1.3, shield: 1.2, speed: 1.1, double: 1.2, repair: 0, beacon: 0 };
      if (p.health < p.maxHealth) weights.repair = p.health === 1 ? 3 : 1.6;
      if (g.rescue.aliens.some((a) => a.state === "hiding" || a.state === "waving") && p.power.beacon <= 0) weights.beacon = 2.2;
      return U.weighted(weights);
    }

    spawn(type) {
      const g = this.game;
      const p = g.player;
      // Somewhere ahead of or near the saucer, inside the world.
      let x = p.x + U.rand(-g.VW * 0.45, g.VW * 0.45);
      if (Math.abs(x - p.x) < 120) x += 240 * (Math.random() < 0.5 ? -1 : 1);
      x = U.clamp(x, 120, U.WORLD_W - 120);
      const y = U.rand(150, 400);
      this.items.push(new PowerUp(type || this.choose(), x, y));
    }

    update(dt) {
      const g = this.game;
      const p = g.player;
      const beam = g.beam;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = this.every * U.rand(0.85, 1.15);
        if (this.items.length < 2) this.spawn();
      }
      for (const it of this.items) {
        it.t += dt;
        it.life -= dt;
        if (it.life <= 0) {
          it.dead = true;
          continue;
        }
        if (beam.active && beam.contains(it.x, it.y, 20)) it.pulled = true;
        if (it.pulled && beam.active) {
          it.x = U.damp(it.x, p.x, 7, dt);
          it.y = U.damp(it.y, p.y + 10, 7, dt);
        } else {
          it.pulled = false;
          it.x = U.clamp(it.x + it.vx * dt, 60, U.WORLD_W - 60);
          it.y = it.baseY + Math.sin(it.t * 2.4) * 10;
        }
        if (p.alive && U.Collision.ufoCircle(p, it.x, it.y, 22)) {
          it.dead = true;
          this.collect(it);
        }
      }
      this.items = this.items.filter((it) => !it.dead);
    }

    collect(it) {
      const g = this.game;
      const p = g.player;
      const def = TYPES[it.type];
      g.particles.sparkle(it.x, it.y, 18, [def.color, "#ffffff"]);
      g.particles.emit({ x: it.x, y: it.y, life: 0.5, size: 30, kind: "ring", color: def.color, grow: 120 });
      if (it.type === "repair") {
        if (p.health < p.maxHealth) {
          p.health++;
          g.hud.banner("HULL REPAIRED! +1", { color: def.color });
          g.texts.add(p.x, p.y - 50, "+1 HULL", { color: def.color, size: 26 });
        } else {
          const pts = g.scoring.addBonus(250);
          g.hud.banner("HULL ALREADY FULL! +250", { color: def.color });
          g.texts.add(p.x, p.y - 50, `+${pts}`, { color: def.color });
        }
        g.audio.play("repair");
        return;
      }
      p.power[it.type] = Math.max(p.power[it.type], def.dur);
      g.hud.banner(`${def.name}!`, { color: def.color, size: 38 });
      g.audio.play("power");
      if (it.type === "beacon") g.hud.banner("FOLLOW THE ARROWS!", { color: def.color, size: 22, time: 1.6 });
    }

    draw(ctx, t) {
      for (const it of this.items) {
        if (it.life < 3 && Math.floor(t * 8) % 2 === 0) continue;
        drawIcon(ctx, it.type, it.x, it.y, 22, t, true);
      }
    }
  }

  // Also used by the HUD and the instructions screen.
  function drawIcon(ctx, type, x, y, r, t, glow) {
    const def = TYPES[type];
    if (glow) {
      const pulse = 1 + Math.sin(t * 5) * 0.12;
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6 * pulse, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      // Orbiting sparkle.
      const a = t * 3;
      D.star(ctx, x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, r * 0.28, "#fff", 0, 4, 0.35, t * 4);
    }
    D.circ(ctx, x, y, r, def.color, 3);
    D.circ(ctx, x - r * 0.3, y - r * 0.35, r * 0.25, "rgba(255,255,255,0.7)", 0);
    const s = r / 22;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    switch (type) {
      case "super":
        D.ell(ctx, 0, -8, 12, 4, "#fff", 2);
        D.poly(ctx, [-6, -6, 6, -6, 12, 12, -12, 12], "rgba(255,255,255,0.85)", 2);
        break;
      case "shield":
        D.poly(ctx, [0, -13, 11, -8, 9, 5, 0, 13, -9, 5, -11, -8], "#fff", 2.5);
        D.poly(ctx, [0, -8, 6, -5, 5, 3, 0, 8], def.color, 0);
        break;
      case "speed":
        D.poly(ctx, [3, -14, -9, 2, -1, 2, -4, 14, 9, -3, 1, -3], "#fff", 2.5);
        break;
      case "repair":
        D.rect(ctx, -4, -13, 8, 26, "#fff", 2.5, 2);
        D.rect(ctx, -13, -4, 26, 8, "#fff", 2.5, 2);
        D.rect(ctx, -3, -12, 6, 24, "#fff", 0);
        break;
      case "double":
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = D.OUT;
        ctx.lineWidth = 4;
        ctx.font = "900 17px Oxanium, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeText("x2", 0, 1);
        ctx.fillText("x2", 0, 1);
        break;
      case "beacon":
        D.line(ctx, 0, 12, 0, -2, "#fff", 4);
        D.circ(ctx, 0, -5, 5, "#fff", 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        for (const rr of [9, 14]) {
          ctx.beginPath();
          ctx.arc(0, -5, rr, -2.4, -0.7);
          ctx.stroke();
        }
        break;
      default:
        break;
    }
    ctx.restore();
  }

  U.POWERUPS = TYPES;
  U.PowerUpManager = PowerUpManager;
  U.drawPowerIcon = drawIcon;
})(window.UFO);
