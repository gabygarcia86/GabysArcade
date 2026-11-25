/*
 * Max, the Grinch's loyal (mostly) dog. He turns up every so often with a job in mind.
 *
 * Helpful: distract a Who, dig up hidden presents, fetch loot the Grinch dropped, or do
 * a happy dance that doubles points for a while.
 * Trouble: bark at the wrong moment, crash into the Grinch, or get tangled in lights
 * (rescue him for a bonus, but his jingling draws Whos).
 */
(function (G) {
  "use strict";

  const RUN = 330;

  class Max {
    constructor(game) {
      this.game = game;
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.r = 12;
      this.t = 0;
      this.face = 1;
      this.phase = 0;
      this.speed01 = 0;
      this.state = "away";
      this.stateT = 0;
      this.task = null;
      this.taskData = null;
      this.mood = "happy";
      this.barking = false;
      this.nextT = game.L.id === 1 ? 9 : G.rand(9, 14);
      this.ghostT = 0;
      this.stuckT = 0;
      this.bubble = null;
      this.carried = [];
      this.trailT = 0;
    }

    say(text, time = 1.2) {
      this.bubble = { text, t: time, max: time };
    }

    update(dt) {
      this.t += dt;
      this.stateT += dt;
      if (this.bubble) {
        this.bubble.t -= dt;
        if (this.bubble.t <= 0) this.bubble = null;
      }
      const g = this.game;
      if (!this.active) {
        if (g.state !== "play") return;
        this.nextT -= dt;
        if (this.nextT <= 0) this.appear(this.pickTask());
        return;
      }
      if (this.ghostT > 0) this.ghostT -= dt;
      this.barking = false;
      const p = g.player;

      switch (this.state) {
        case "arrive":
          this.mood = "happy";
          if (this.runTo(p.x - 40 * this.face, p.y + 10, RUN, dt, 50) || this.stateT > 6) this.startTask();
          break;
        case "distract": {
          const w = this.taskData;
          if (!w || w.dead) {
            this.leave();
            break;
          }
          if (this.stateT < 7 && !w.distractT) {
            if (this.runTo(w.x + 26, w.y + 6, RUN, dt, 24)) {
              w.distract(6);
              g.audio.play("maxBark");
              this.say("Arf!", 0.8);
              this.setState("play");
              this.taskData = w;
            }
          } else {
            this.setState("play");
          }
          break;
        }
        case "play": {
          // Rolling around at a Who's feet while they pet him.
          this.mood = "spin";
          this.speed01 = 0;
          const w = this.taskData;
          if (w) this.face = w.x > this.x ? 1 : -1;
          if (this.stateT > 6) this.leave();
          break;
        }
        case "seek": {
          const s = this.taskData;
          if (this.runTo(s.x, s.y, RUN * 0.9, dt, 14) || this.stateT > 6) {
            this.setState("dig");
            g.audio.play("dig");
          }
          break;
        }
        case "dig":
          this.mood = "dig";
          this.speed01 = 0;
          if (Math.random() < dt * 25) {
            g.particles.add({ x: this.x + G.rand(-8, 8), y: this.y - 4, vx: G.rand(-90, 90), vy: G.rand(-160, -60), grav: 400, kind: "dirt", size: 4, life: 0.7, color: "#ffffff" });
          }
          if (this.stateT > 1.6) {
            g.spawnStash(this.x, this.y + 4);
            this.say("Arf! Arf!", 1);
            g.audio.play("maxBark");
            this.leave();
          }
          break;
        case "fetch": {
          const list = this.taskData;
          const it = list.find((i) => !i.collected && !i.carriedBy);
          if (!it) {
            if (this.carried.length) this.setState("return");
            else this.leave();
            break;
          }
          if (this.runTo(it.x, it.y, RUN, dt, 16)) {
            it.carriedBy = this;
            this.carried.push(it);
            g.audio.play("collect", { gap: 0.1 });
          }
          if (this.stateT > 9) this.setState("return");
          break;
        }
        case "return":
          if (this.runTo(p.x, p.y, RUN * 1.1, dt, 34) || this.stateT > 7) {
            g.maxDelivers(this.carried);
            this.carried = [];
            this.say("Arf!", 0.8);
            this.leave();
          }
          break;
        case "dance":
          this.mood = "spin";
          this.speed01 = 0;
          this.x = G.lerp(this.x, p.x - 34, 1 - Math.exp(-6 * dt));
          this.y = G.lerp(this.y, p.y + 12, 1 - Math.exp(-6 * dt));
          if (this.stateT > 1.2) {
            g.setMultiplier(8);
            this.setState("follow");
            this.taskData = 8;
          }
          break;
        case "follow":
          this.mood = "happy";
          this.runTo(p.x - 40 * (p.vx >= 0 ? 1 : -1), p.y + 14, RUN * 1.1, dt, 30);
          if (this.stateT > (this.taskData || 6)) this.leave();
          break;
        case "bark":
          this.mood = "calm";
          this.speed01 = 0;
          this.barking = Math.sin(this.stateT * 12) > 0;
          this.face = p.x > this.x ? 1 : -1;
          if (this.stateT > 0.3 && this.taskData < 3 && this.stateT > 0.3 + this.taskData * 0.55) {
            this.taskData++;
            g.audio.play("maxBark", { gap: 0.1 });
            this.say("ARF! ARF!", 0.5);
            g.alertWhos(p.x, p.y, 430, null);
            if (this.taskData === 1) g.grinchReact("frustrated", "MAX! STOP BARKING!");
          }
          if (this.stateT > 2.2) this.leave();
          break;
        case "charge":
          this.mood = "happy";
          if (this.runTo(p.x, p.y, 430, dt, p.r + this.r) || this.stateT > 3) {
            if (G.dist(this.x, this.y, p.x, p.y) < p.r + this.r + 8) g.maxBump(this);
            this.leave();
          }
          break;
        case "toTangle": {
          const z = this.taskData;
          if (this.runTo(z.x, z.y, RUN * 0.8, dt, 12) || this.stateT > 6) {
            this.setState("tangled");
            g.audio.play("jingleShort");
            g.banner("Max got tangled in lights!", "Go free him for a bonus!", "#ff9f1c");
            g.addMarker(this, "MAX", "#ff9f1c", 9);
          }
          break;
        }
        case "tangled":
          this.mood = "tangled";
          this.speed01 = 0;
          this.face = Math.sin(this.t * 3) > 0 ? 1 : -1;
          this.trailT -= dt;
          if (this.trailT <= 0) {
            this.trailT = 1.6;
            g.audio.play("jingleShort", { gap: 0.5 });
            g.alertWhos(this.x, this.y, 260, null);
            this.say("Jingle! Jingle!", 0.9);
          }
          if (G.dist(this.x, this.y, p.x, p.y) < p.r + this.r + 14 && p.stun <= 0) {
            g.freeMax(this);
            this.setState("follow");
            this.taskData = 5;
          } else if (this.stateT > 9) {
            this.say("Arf!", 0.8);
            this.leave();
          }
          break;
        case "distractAll":
          // From the Max Distraction power-up: running happy circles around the Grinch.
          this.mood = "happy";
          {
            const a = this.stateT * 4;
            this.runTo(p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 40, RUN * 1.4, dt, 4);
            if (Math.random() < dt * 6) g.particles.add({ x: this.x, y: this.y - 30, kind: "heart", size: 5, vy: -40, life: 0.8, color: "#ff5f8f" });
          }
          if (this.stateT > 6) this.leave();
          break;
        case "leave": {
          const l = this.taskData;
          this.runTo(l.x, l.y, RUN, dt, 20);
          if (this.stateT > 4 || (!g.onScreen(this.x, this.y, 60) && this.stateT > 0.8)) {
            this.active = false;
            this.nextT = G.rand(14, 21);
          }
          break;
        }
      }
    }

    setState(s) {
      this.state = s;
      this.stateT = 0;
    }

    pickTask() {
      const L = this.game.L;
      const trouble = Math.random() < L.maxTrouble;
      if (trouble) return G.pick(["bark", "bump", "tangle"]);
      const hasDrops = this.game.loot.items.some((i) => i.dropped && !i.collected);
      if (hasDrops && Math.random() < 0.7) return "retrieve";
      return G.weighted({ distract: 3, find: 3, multiplier: 2.5 });
    }

    // Runs in from just off-screen near the Grinch.
    appear(task, close = false) {
      const g = this.game;
      const p = g.player;
      const w = g.world;
      let sx = p.x;
      let sy = p.y;
      for (let k = 0; k < 16; k++) {
        const a = Math.random() * G.TAU;
        const d = close ? G.rand(150, 220) : G.rand(420, 560);
        const x = G.clamp(p.x + Math.cos(a) * d, 30, w.W - 30);
        const y = G.clamp(p.y + Math.sin(a) * d, 30, w.H - 30);
        if (w.isFreeQuick(x, y, this.r)) {
          sx = x;
          sy = y;
          break;
        }
      }
      this.x = sx;
      this.y = sy;
      this.active = true;
      this.task = task;
      this.carried = [];
      this.bubble = null;
      g.audio.play("maxAppear");
      this.say("Arf!", 1);
      if (task === "distractAll") {
        this.setState("distractAll");
        return;
      }
      this.setState("arrive");
      if (task === "bump") {
        this.startTask();
      }
    }

    startTask() {
      const g = this.game;
      const p = g.player;
      switch (this.task) {
        case "distract": {
          // Prefer a Who who is chasing the Grinch, then the closest one.
          let best = null;
          let bd = 700;
          for (const w of g.whos) {
            if (w.role === "march" || w.distractT > 0 || w.dead) continue;
            const d = G.dist(w.x, w.y, p.x, p.y) - (w.state === "chase" ? 400 : 0);
            if (d < bd) {
              bd = d;
              best = w;
            }
          }
          if (!best) {
            this.task = "multiplier";
            this.startTask();
            return;
          }
          this.taskData = best;
          this.setState("distract");
          g.banner("Max is distracting a Who!", "Good boy!", "#c98a4a");
          break;
        }
        case "find": {
          const w = g.world;
          let spot = null;
          for (let k = 0; k < 30; k++) {
            const a = Math.random() * G.TAU;
            const d = G.rand(220, 420);
            const x = p.x + Math.cos(a) * d;
            const y = p.y + Math.sin(a) * d;
            if (w.isFree(x, y, 26, 6) && w.pathClear(p.x, p.y, x, y, 8)) {
              spot = { x, y };
              break;
            }
          }
          if (!spot) {
            for (let k = 0; k < 30 && !spot; k++) {
              const x = p.x + G.rand(-400, 400);
              const y = p.y + G.rand(-300, 300);
              if (w.isFree(x, y, 26, 6)) spot = { x, y };
            }
          }
          if (!spot) {
            this.task = "multiplier";
            this.startTask();
            return;
          }
          this.taskData = spot;
          this.setState("seek");
          g.banner("Max smells hidden presents!", "Follow him!", "#c98a4a");
          g.addMarker(this, "MAX", "#c98a4a", 4);
          break;
        }
        case "retrieve": {
          const drops = g.loot.items.filter((i) => i.dropped && !i.collected && !i.carriedBy);
          drops.sort((a, b) => G.dist(a.x, a.y, p.x, p.y) - G.dist(b.x, b.y, p.x, p.y));
          if (!drops.length) {
            this.task = "find";
            this.startTask();
            return;
          }
          this.taskData = drops.slice(0, 4);
          this.setState("fetch");
          g.banner("Max is fetching your dropped loot!", "", "#c98a4a");
          break;
        }
        case "multiplier":
          this.setState("dance");
          g.audio.play("party");
          break;
        case "bark":
          this.taskData = 0;
          this.setState("bark");
          break;
        case "bump":
          this.setState("charge");
          g.banner("Uh oh... Max is VERY excited!", "", "#ff4d4d");
          break;
        case "tangle": {
          const w = g.world;
          let z = null;
          let bd = 650;
          for (const l of w.lights) {
            const d = G.dist(l.x + l.w / 2, l.y + l.h / 2, p.x, p.y);
            if (d < bd && d > 120) {
              bd = d;
              z = { x: l.x + l.w / 2, y: l.y + l.h / 2 };
            }
          }
          if (!z) z = { x: this.x, y: this.y };
          this.taskData = z;
          this.setState("toTangle");
          break;
        }
        default:
          this.leave();
      }
    }

    leave() {
      const p = this.game.player;
      const a = Math.atan2(this.y - p.y, this.x - p.x) + G.rand(-0.5, 0.5);
      this.taskData = { x: p.x + Math.cos(a) * 900, y: p.y + Math.sin(a) * 900 };
      this.setState("leave");
      this.mood = "happy";
    }

    // Max ignores walls for a moment if he gets stuck, squeezing through like dogs do.
    runTo(tx, ty, speed, dt, arrive) {
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= arrive) {
        this.speed01 = 0;
        return true;
      }
      const step = Math.min(d, speed * dt);
      const ox = this.x;
      const oy = this.y;
      if (this.ghostT > 0) {
        this.x += (dx / d) * step;
        this.y += (dy / d) * step;
      } else {
        this.game.world.move(this, (dx / d) * step, (dy / d) * step);
      }
      const moved = Math.hypot(this.x - ox, this.y - oy);
      if (moved < step * 0.3) this.stuckT += dt;
      else this.stuckT = 0;
      if (this.stuckT > 0.35) {
        this.stuckT = 0;
        this.ghostT = 0.7;
      }
      if (Math.abs(dx) > 3) this.face = dx > 0 ? 1 : -1;
      this.speed01 = moved / Math.max(dt, 1e-4) / 60;
      this.phase += moved / 4;
      return false;
    }

    draw(ctx) {
      if (!this.active) return;
      ctx.save();
      ctx.translate(this.x, this.y);
      G.Art.dog(ctx, {
        face: this.face,
        t: this.t,
        phase: this.phase,
        speed01: this.speed01,
        look: G.Art.MAX_LOOK,
        barking: this.barking,
        max: true,
        mood: this.mood,
      });
      // Carried loot in his mouth.
      if (this.carried.length) {
        ctx.translate(this.face * 26, -18);
        ctx.scale(0.6, 0.6);
        G.Art.item(ctx, this.carried[0].type, this.carried[0].v, this.t, true);
      }
      ctx.restore();
    }

    drawOverlay(ctx) {
      if (!this.active) return;
      ctx.font = "800 12px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(20,30,50,0.8)";
      ctx.strokeText("MAX", this.x, this.y + 18);
      ctx.fillStyle = "#ffd9a0";
      ctx.fillText("MAX", this.x, this.y + 18);
      if (this.bubble) G.drawBubble(ctx, this.x, this.y - 44, this.bubble.text, "#ffffff", this.bubble.t / this.bubble.max);
    }
  }

  G.Max = Max;
})(window.GH);
