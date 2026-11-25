/*
 * Whoville residents and neighborhood dogs.
 *
 * Whos see in a cone (shown on the ground) and need a clear line of sight. Spotting the
 * Grinch fills a suspicion meter: part full, they stop and stare ("?"); full, they chase
 * ("!"). Losing sight of him for a couple of seconds makes them search, then go back to
 * what they were doing. Kids and marching band members don't chase; they shout, which
 * sends nearby grown-ups to look. Dogs don't see far, but they hear and smell: they bark
 * at a Grinch who comes close, and barking brings Whos.
 */
(function (G) {
  "use strict";

  const Art = G.Art;

  class Who {
    constructor(game, o) {
      this.game = game;
      this.kind = o.kind || "adult"; // adult | kid | guard | marcher
      this.role = o.role || "wander"; // wander | patrol | kid | guard | idle | march | party
      this.look = o.look;
      this.x = o.x;
      this.y = o.y;
      this.r = this.kind === "kid" ? 11 : 14;
      this.a = o.angle != null ? o.angle : Math.random() * G.TAU;
      this.dir = G.dirFromAngle(this.a);
      this.state = "base";
      this.stateT = 0;
      this.sus = 0;
      this.seen = false;
      this.mood = "calm";
      this.t = Math.random() * 10;
      this.phase = 0;
      this.speed01 = 0;
      this.route = o.route || null;
      this.routeIdx = 0;
      this.node = o.node != null ? o.node : null;
      this.prevNode = -1;
      this.home = o.home || { x: this.x, y: this.y, angle: this.a };
      this.target = null;
      this.pauseT = 0;
      this.lastX = this.x;
      this.lastY = this.y;
      this.lostT = 0;
      this.stuckT = 0;
      this.detour = null;
      this.cool = 0;
      this.distractT = 0;
      this.dizzyT = 0;
      this.bubble = null;
      this.life = o.life || 0;
      this.dead = false;
      this.offset = G.rand(-24, 24);
      this.glanceT = G.rand(2, 5);
      this.glance = 0;
      const L = game.L;
      this.walkSpeed = L.whoSpeed * (this.kind === "kid" ? 1.55 : 1) * G.rand(0.9, 1.1);
      if (this.role === "march") this.walkSpeed = o.speed || 60;
    }

    say(text, time = 1.4) {
      this.bubble = { text, t: time, max: time };
    }

    setState(s) {
      this.state = s;
      this.stateT = 0;
      this.detour = null;
      this.stuckT = 0;
    }

    // ---------------------------------------------------------------- Senses

    perceive(dt) {
      const g = this.game;
      const p = g.player;
      this.seen = false;
      if (p.hidden || this.cool > 0 || p.stun > 0 || g.state !== "play" || p.escaping) {
        this.sus = Math.max(0, this.sus - 0.5 * dt);
        return;
      }
      const L = g.L;
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      let range = L.vision * p.rangeMult;
      if (this.kind === "kid") range *= 0.8;
      if (this.kind === "guard") range *= 1.1;
      let heard = false;
      if (d < range) {
        const diff = Math.abs(G.angleDiff(this.a, Math.atan2(dy, dx)));
        const cone = L.cone * (this.kind === "kid" ? 1.15 : 1);
        if ((diff < cone || d < 46) && g.world.lineClear(this.x, this.y - 8, p.x, p.y - 8)) this.seen = true;
      }
      if (!this.seen && d < p.noise && g.world.lineClear(this.x, this.y - 8, p.x, p.y - 8)) heard = true;
      if (this.seen) {
        let rate = L.susRate * (1.1 + 2.6 * (1 - d / range)) * p.susMult;
        if (this.state === "investigate" || this.state === "search" || this.state === "suspicious") rate *= 1.6;
        this.sus += rate * dt;
        this.lastX = p.x;
        this.lastY = p.y;
      } else if (heard) {
        this.sus += 1.2 * L.susRate * dt;
        this.lastX = p.x;
        this.lastY = p.y;
      } else {
        this.sus -= (this.state === "suspicious" ? 0.22 : 0.4) * dt;
      }
      this.heard = heard;
      this.sus = G.clamp(this.sus, 0, 1);
    }

    // ---------------------------------------------------------------- Update

    update(dt) {
      this.t += dt;
      this.stateT += dt;
      if (this.bubble) {
        this.bubble.t -= dt;
        if (this.bubble.t <= 0) this.bubble = null;
      }
      if (this.role === "party") {
        this.life -= dt;
        if (this.life <= 0) {
          this.dead = true;
          this.game.particles.puff(this.x, this.y - 20, 8, 9);
          return;
        }
      }
      if (this.dizzyT > 0) {
        this.dizzyT -= dt;
        this.mood = "dizzy";
        this.speed01 = 0;
        this.sus = 0;
        if (this.dizzyT <= 0) this.setState("return");
        return;
      }
      if (this.distractT > 0) {
        this.distractT -= dt;
        this.mood = "happy";
        this.speed01 = 0;
        this.sus = 0;
        const m = this.game.max;
        if (m && m.active) this.faceTo(m.x, m.y, dt, 6);
        if (this.distractT <= 0) this.setState("return");
        return;
      }
      if (this.cool > 0) this.cool -= dt;
      this.perceive(dt);

      switch (this.state) {
        case "base":
          this.mood = this.role === "party" ? "party" : "calm";
          this.base(dt);
          if (this.sus >= 1) this.spot();
          else if (this.sus > 0.35 && this.role !== "march") {
            this.setState("suspicious");
            this.say("?", 1.2);
            if (this.game.onScreen(this.x, this.y)) this.game.audio.play("hmm", { gap: 0.3 });
          }
          break;
        case "suspicious":
          this.mood = "sus";
          this.speed01 = 0;
          this.faceTo(this.lastX, this.lastY, dt, 5);
          if (this.sus >= 1) this.spot();
          else if (this.sus <= 0.02) {
            this.say("Hmm...", 1);
            this.setState("return");
          }
          break;
        case "chase":
          this.mood = "alert";
          this.chase(dt);
          break;
        case "investigate":
          this.mood = "sus";
          if (this.moveTo(this.target.x, this.target.y, this.walkSpeed * 1.5, dt, 24)) this.setState("search");
          if (this.stateT > 8) this.setState("search");
          if (this.sus >= 1) this.spot();
          break;
        case "search":
          this.mood = "sus";
          this.speed01 = 0;
          this.a += Math.sin(this.stateT * 3) * dt * 2.2;
          this.dir = G.dirFromAngle(this.a);
          if (this.sus >= 1) this.spot();
          else if (this.stateT > 2) this.setState("return");
          break;
        case "return":
          this.mood = "calm";
          if (this.sus >= 1) {
            this.spot();
            break;
          }
          if (this.goHome(dt)) this.setState("base");
          break;
        case "gloat":
          this.mood = "calm";
          this.speed01 = 0;
          if (this.stateT > 1.6) {
            this.cool = 4;
            this.setState("return");
          }
          break;
        case "flee": {
          this.mood = "alert";
          const p = this.game.player;
          const ang = Math.atan2(this.y - p.y, this.x - p.x);
          this.moveTo(this.x + Math.cos(ang) * 60, this.y + Math.sin(ang) * 60, this.walkSpeed * 1.3, dt, 2);
          if (this.stateT > 1.6) this.setState("return");
          break;
        }
      }
    }

    spot() {
      const g = this.game;
      const p = g.player;
      this.sus = 0;
      if (this.kind === "kid") {
        this.say("GRINCH!!", 1.6);
        g.audio.play("shout", { pitch: 1.5, gap: 0.2 });
        g.alertWhos(p.x, p.y, 460, this);
        g.onShout(this);
        this.cool = 5;
        this.setState("flee");
        return;
      }
      if (this.role === "march") {
        this.say("HEY! GRINCH!", 1.6);
        g.audio.play("shout", { pitch: 0.9, gap: 0.2 });
        g.alertWhos(p.x, p.y, 420, this);
        g.onShout(this);
        this.cool = 6;
        return;
      }
      this.say("!", 1.2);
      g.audio.play("shout", { pitch: this.kind === "guard" ? 0.8 : 1, gap: 0.25 });
      this.lastX = p.x;
      this.lastY = p.y;
      this.lostT = 0;
      this.setState("chase");
      g.onSpotted(this);
    }

    // Sent to look at a noise (a bark, a shout).
    investigate(x, y) {
      if (this.state === "chase" || this.distractT > 0 || this.dizzyT > 0 || this.role === "march") return;
      if (this.cool > 0) return;
      this.target = { x: x + G.rand(-30, 30), y: y + G.rand(-30, 30) };
      this.setState("investigate");
      this.sus = Math.max(this.sus, 0.3);
      if (!this.bubble) this.say("?", 1);
    }

    distract(time) {
      if (this.role === "march") return;
      const wasChasing = this.state === "chase";
      this.distractT = time;
      this.sus = 0;
      this.setState("base");
      this.say("Aww, a doggy!", 1.6);
      if (wasChasing) this.game.stats.avoided++;
    }

    knockDizzy(time) {
      if (this.state === "chase") this.game.stats.avoided++;
      this.dizzyT = time;
      this.distractT = 0;
      this.sus = 0;
      this.setState("base");
      this.say("Whoa!", 1.2);
    }

    chase(dt) {
      const g = this.game;
      const p = g.player;
      if (this.seen) {
        this.lostT = 0;
        this.lastX = p.x;
        this.lastY = p.y;
      } else {
        this.lostT += dt;
      }
      const speed = g.L.chaseSpeed * (this.kind === "guard" ? 1.05 : 1);
      const tx = this.seen ? p.x : this.lastX;
      const ty = this.seen ? p.y : this.lastY;
      const arrived = this.moveTo(tx, ty, speed, dt, 10);
      if (!p.hidden && p.stun <= 0 && !p.escaping && G.dist(this.x, this.y, p.x, p.y) < this.r + p.r + 4) {
        g.catchPlayer(this);
        return;
      }
      if (this.lostT > 2.4 || (arrived && !this.seen && this.lostT > 0.4) || this.stateT > 14 || p.hidden) {
        g.stats.avoided++;
        this.say("Where'd he go?", 1.4);
        this.setState("search");
      }
    }

    // ---------------------------------------------------------------- Movement

    faceTo(x, y, dt, rate) {
      const want = Math.atan2(y - this.y, x - this.x);
      const d = G.angleDiff(this.a, want);
      this.a += G.clamp(d, -rate * dt, rate * dt);
      this.dir = G.dirFromAngle(this.a);
    }

    // Walks toward a point. Returns true on arrival.
    moveTo(tx, ty, speed, dt, arrive = 8) {
      let gx = tx;
      let gy = ty;
      if (this.detour) {
        this.detour.t -= dt;
        if (this.detour.t <= 0) this.detour = null;
        else {
          gx = this.detour.x;
          gy = this.detour.y;
        }
      }
      const dx = gx - this.x;
      const dy = gy - this.y;
      const d = Math.hypot(dx, dy);
      const finalD = G.dist(this.x, this.y, tx, ty);
      if (finalD < arrive) {
        this.speed01 = 0;
        return true;
      }
      if (d < 1) return false;
      const ox = this.x;
      const oy = this.y;
      const step = Math.min(d, speed * dt);
      this.game.world.move(this, (dx / d) * step, (dy / d) * step);
      const moved = Math.hypot(this.x - ox, this.y - oy);
      this.faceTo(this.x + dx, this.y + dy, dt, 9);
      this.speed01 = moved / Math.max(dt, 1e-4) / 60;
      this.phase += moved / 6;
      if (moved < step * 0.35) this.stuckT += dt;
      else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > 0.6) {
        this.stuckT = 0;
        this.unstick(dx, dy, d);
      }
      return false;
    }

    unstick(dx, dy, d) {
      // Step sideways around whatever is in the way, or pick a new destination.
      if (this.state === "base" && (this.role === "wander" || this.role === "kid" || this.role === "patrol")) {
        this.node = this.game.world.nearestNode(this.x, this.y, this.node);
        this.target = null;
        return;
      }
      const side = Math.random() < 0.5 ? 1 : -1;
      const px = (-dy / d) * side;
      const py = (dx / d) * side;
      this.detour = { x: this.x + px * 90 - (dx / d) * 20, y: this.y + py * 90 - (dy / d) * 20, t: 0.7 };
    }

    goHome(dt) {
      const r = this.role;
      if (r === "guard" || r === "idle" || r === "party") {
        const arrived = this.moveTo(this.home.x, this.home.y, this.walkSpeed * 1.2, dt, 10);
        if (arrived && r !== "party") this.a = this.home.angle != null ? this.home.angle : this.a;
        return arrived;
      }
      if (r === "march") return true;
      // Graph walkers head back to the nearest intersection.
      if (this.node == null || this.stateT < dt * 1.5) this.node = this.game.world.nearestNode(this.x, this.y);
      const n = this.game.world.nodes[this.node];
      return this.moveTo(n.x, n.y, this.walkSpeed, dt, 16);
    }

    base(dt) {
      const w = this.game.world;
      switch (this.role) {
        case "wander":
        case "kid":
        case "patrol": {
          // Kids in a group tag along behind their leader.
          const lead = this.leader;
          if (lead && !lead.dead && lead.state === "base" && lead.dizzyT <= 0 && lead.distractT <= 0) {
            const fx = lead.x - Math.cos(lead.a) * 30 + Math.sin(this.t * 2) * 8;
            const fy = lead.y - Math.sin(lead.a) * 30 + 8;
            if (G.dist(this.x, this.y, fx, fy) > 14) this.moveTo(fx, fy, this.walkSpeed * 1.1, dt, 10);
            else {
              this.speed01 = 0;
              this.faceTo(lead.x + Math.cos(lead.a) * 50, lead.y + Math.sin(lead.a) * 50, dt, 4);
            }
            return;
          }
          if (this.pauseT > 0) {
            this.pauseT -= dt;
            this.speed01 = 0;
            this.a += Math.sin(this.t * 1.7) * dt * 1.4;
            this.dir = G.dirFromAngle(this.a);
            return;
          }
          if (!this.target) this.pickNext();
          const sp = this.walkSpeed * (this.role === "kid" && Math.sin(this.t * 0.9) > 0.6 ? 1.5 : 1);
          if (this.moveTo(this.target.x, this.target.y, sp, dt, 12)) {
            this.target = null;
            const pauseChance = this.role === "kid" ? 0.25 : this.role === "patrol" ? 0.2 : 0.35;
            if (Math.random() < pauseChance) this.pauseT = G.rand(0.8, 2.4);
          }
          break;
        }
        case "guard": {
          this.speed01 = 0;
          if (G.dist(this.x, this.y, this.home.x, this.home.y) > 12) {
            this.moveTo(this.home.x, this.home.y, this.walkSpeed, dt, 10);
            return;
          }
          this.a = this.home.angle + Math.sin(this.t * 0.55 + this.offset) * 1.15;
          this.dir = G.dirFromAngle(this.a);
          break;
        }
        case "idle": {
          this.speed01 = 0;
          if (G.dist(this.x, this.y, this.home.x, this.home.y) > 12) {
            this.moveTo(this.home.x, this.home.y, this.walkSpeed, dt, 10);
            return;
          }
          this.glanceT -= dt;
          if (this.glanceT <= 0) {
            this.glanceT = G.rand(2.5, 6);
            this.glance = Math.random() < 0.4 ? G.rand(-1.4, 1.4) : 0;
          }
          this.a = G.lerp(this.a, this.home.angle + this.glance, 1 - Math.exp(-3 * dt));
          this.dir = G.dirFromAngle(this.a);
          break;
        }
        case "march": {
          const lane = this.home;
          this.x += this.walkSpeed * dt;
          this.y = lane.y;
          // Wrap around exactly like the floats, so the band stays behind its float.
          if (this.x > w.W + 350) this.x -= this.game.hazards.span || w.W + 700;
          this.a = 0;
          this.dir = "right";
          this.speed01 = 1;
          this.phase += this.walkSpeed * dt / 6;
          break;
        }
        case "party": {
          if (!this.target || this.moveTo(this.target.x, this.target.y, this.walkSpeed * 0.8, dt, 8)) {
            this.target = { x: this.home.x + G.rand(-70, 70), y: this.home.y + G.rand(-50, 50) };
          }
          break;
        }
      }
    }

    pickNext() {
      const w = this.game.world;
      if (this.role === "patrol" && this.route) {
        this.routeIdx = (this.routeIdx + 1) % this.route.length;
        this.node = this.route[this.routeIdx];
      } else {
        if (this.node == null) this.node = w.nearestNode(this.x, this.y);
        const cur = w.nodes[this.node];
        let options = cur.n.filter((i) => i !== this.prevNode);
        const safe = options.filter((i) => G.dist(w.nodes[i].x, w.nodes[i].y, w.getaway.x, w.getaway.y) > 120);
        if (safe.length) options = safe;
        if (!options.length) options = cur.n;
        this.prevNode = this.node;
        this.node = options[Math.floor(Math.random() * options.length)];
      }
      const n = w.nodes[this.node];
      this.target = { x: n.x + this.offset * 0.6, y: n.y + this.offset * 0.6 };
    }

    // ---------------------------------------------------------------- Drawing

    drawCone(ctx) {
      if (this.distractT > 0 || this.dizzyT > 0) return;
      const L = this.game.L;
      let range = L.vision * (this.kind === "kid" ? 0.8 : this.kind === "guard" ? 1.1 : 1);
      const cone = L.cone * (this.kind === "kid" ? 1.15 : 1);
      let col = "255, 245, 150";
      let a = 0.2;
      if (this.state === "chase") {
        col = "255, 80, 80";
        a = 0.26;
      } else if (this.state === "suspicious" || this.state === "investigate" || this.state === "search" || this.sus > 0.2) {
        col = "255, 170, 60";
        a = 0.26;
      }
      if (this.cool > 0) a *= 0.4;
      const g = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, range);
      g.addColorStop(0, `rgba(${col}, ${a + 0.1})`);
      g.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, range, this.a - cone, this.a + cone);
      ctx.closePath();
      ctx.fill();
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      Art.who(ctx, {
        dir: this.dir,
        t: this.t,
        phase: this.phase,
        speed01: this.speed01,
        look: this.look,
        kind: this.kind,
        mood: this.mood,
      });
      ctx.restore();
    }

    drawOverlay(ctx) {
      const top = this.y - (this.kind === "kid" ? 66 : 92);
      // Suspicion meter.
      if (this.sus > 0.04 && this.state !== "chase") {
        ctx.fillStyle = "rgba(20,30,50,0.7)";
        G.Art.roundRect(ctx, this.x - 16, top - 4, 32, 7, 3.5);
        ctx.fill();
        ctx.fillStyle = this.sus > 0.7 ? "#ff5a3c" : "#ffd23f";
        G.Art.roundRect(ctx, this.x - 15, top - 3, 30 * this.sus, 5, 2.5);
        ctx.fill();
      }
      if (this.bubble) {
        drawBubble(ctx, this.x, top - 10, this.bubble.text, this.bubble.text === "!" ? "#ff4d4d" : this.bubble.text === "?" ? "#ffb52e" : "#ffffff", this.bubble.t / this.bubble.max);
      }
    }
  }

  function drawBubble(ctx, x, y, text, color, life) {
    const big = text.length <= 2;
    ctx.font = big ? "900 26px Oxanium, sans-serif" : "800 14px Oxanium, sans-serif";
    const w = big ? 30 : ctx.measureText(text).width + 18;
    const h = big ? 32 : 24;
    const pop = life > 0.85 ? G.easeOutBack((1 - life) / 0.15) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.globalAlpha = Math.min(1, life * 4);
    ctx.fillStyle = big ? color : "rgba(255,255,255,0.95)";
    G.Art.roundRect(ctx, -w / 2, -h, w, h, 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,30,50,0.85)";
    ctx.lineWidth = 2;
    G.Art.roundRect(ctx, -w / 2, -h, w, h, 10);
    ctx.stroke();
    ctx.fillStyle = big ? "#ffffff" : "#1d2340";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (big) {
      ctx.lineWidth = 3;
      ctx.strokeText(text, 0, -h / 2 + 1);
    }
    ctx.fillText(text, 0, -h / 2 + 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  G.drawBubble = drawBubble;

  // ---------------------------------------------------------------- Dogs

  class Dog {
    constructor(game, home, look) {
      this.game = game;
      this.home = home;
      this.x = home.x;
      this.y = home.y;
      this.r = 12;
      this.look = look;
      this.state = "roam";
      this.stateT = 0;
      this.target = null;
      this.pauseT = G.rand(0, 2);
      this.t = Math.random() * 10;
      this.face = 1;
      this.phase = 0;
      this.speed01 = 0;
      this.barkCd = 0;
      this.cool = 0;
      this.lostT = 0;
      this.bubble = null;
      this.stuckT = 0;
    }

    update(dt) {
      const g = this.game;
      const p = g.player;
      const w = g.world;
      this.t += dt;
      this.stateT += dt;
      if (this.cool > 0) this.cool -= dt;
      if (this.bubble) {
        this.bubble.t -= dt;
        if (this.bubble.t <= 0) this.bubble = null;
      }
      const d = G.dist(this.x, this.y, p.x, p.y);
      const sense = p.hidden || p.escaping || g.state !== "play" ? 0 : p.sneaking ? 70 : 165;

      if (this.state === "roam") {
        if (this.pauseT > 0) {
          this.pauseT -= dt;
          this.speed01 = 0;
        } else {
          if (!this.target) {
            for (let k = 0; k < 6; k++) {
              const tx = this.home.x + G.rand(-170, 170);
              const ty = this.home.y + G.rand(-170, 170);
              if (w.pathClear(this.x, this.y, tx, ty, this.r)) {
                this.target = { x: tx, y: ty };
                break;
              }
            }
            if (!this.target) this.target = { x: this.home.x, y: this.home.y };
          }
          if (this.walk(this.target.x, this.target.y, 70, dt)) {
            this.target = null;
            this.pauseT = G.rand(0.8, 2.5);
          }
        }
        if (d < sense && this.cool <= 0) {
          this.state = "bark";
          this.stateT = 0;
          this.barkCd = 0;
          this.lostT = 0;
        }
      } else if (this.state === "bark") {
        this.face = p.x >= this.x ? 1 : -1;
        this.barkCd -= dt;
        if (this.barkCd <= 0) {
          this.barkCd = 0.75;
          g.dogBark(this);
          this.bubble = { text: "WOOF!", t: 0.6, max: 0.6 };
        }
        if (G.dist(this.x, this.y, this.home.x, this.home.y) < 300 && d > 30) this.walk(p.x, p.y, 120, dt);
        else this.speed01 = 0;
        if (d < this.r + p.r + 3 && p.stun <= 0 && !p.hidden) {
          g.dogNip(this);
          this.state = "cool";
          this.cool = 6;
          this.stateT = 0;
        }
        if (d > Math.max(sense, 60) * 1.7) this.lostT += dt;
        else this.lostT = 0;
        if (this.lostT > 1.2 || this.stateT > 7) {
          this.state = "cool";
          this.cool = 3;
          this.stateT = 0;
        }
      } else {
        // Trotting home, tail wagging.
        if (this.walk(this.home.x, this.home.y, 85, dt) || this.cool <= 0) {
          this.state = "roam";
          this.target = null;
        }
      }
    }

    walk(tx, ty, speed, dt) {
      const dx = tx - this.x;
      const dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 10) {
        this.speed01 = 0;
        return true;
      }
      const ox = this.x;
      const oy = this.y;
      const step = Math.min(d, speed * dt);
      this.game.world.move(this, (dx / d) * step, (dy / d) * step);
      const moved = Math.hypot(this.x - ox, this.y - oy);
      if (Math.abs(dx) > 4) this.face = dx > 0 ? 1 : -1;
      this.speed01 = moved / Math.max(dt, 1e-4) / 60;
      this.phase += moved / 4;
      if (moved < step * 0.3) this.stuckT += dt;
      else this.stuckT = 0;
      if (this.stuckT > 0.8) {
        this.stuckT = 0;
        this.target = null;
        return true;
      }
      return false;
    }

    drawCone(ctx) {
      // Dogs sense all around them: a faint ring shows how close is too close.
      if (this.state === "bark") {
        ctx.strokeStyle = "rgba(255, 90, 90, 0.5)";
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      }
      ctx.setLineDash([6, 8]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 165, 165 * 0.9, 0, 0, G.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      Art.dog(ctx, {
        face: this.face,
        t: this.t,
        phase: this.phase,
        speed01: this.speed01,
        look: this.look,
        barking: this.state === "bark" && this.barkCd > 0.45,
        mood: this.state === "cool" ? "happy" : "calm",
      });
      ctx.restore();
    }

    drawOverlay(ctx) {
      if (this.bubble) drawBubble(ctx, this.x + this.face * 10, this.y - 44, this.bubble.text, "#ffffff", this.bubble.t / this.bubble.max);
    }
  }

  G.Who = Who;
  G.Dog = Dog;
})(window.GH);
