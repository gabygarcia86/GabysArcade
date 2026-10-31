/*
 * Boss: a framework of "moves" with a telegraph, an active part and a recovery.
 * Bosses guard while idle, so the way in is to read a move, punish the recovery,
 * parry with a timed Deflect, or break the guard with Force Push. Each boss below
 * is a set of moves plus a think() that chooses between them.
 */
(function (J) {
  const { clamp, lerp, approach, rand, pick, overlap } = J.U;
  const { Art, Actor, Lightsaber } = J;

  const DEFS = {
    maul: {
      id: "maul", name: "DARTH MAUL", title: "The Shadow of Vengeance", hp: 540, speed: 170, scale: 1, music: "bossMaul", sting: "maulSting", downPose: "dead",
      saber: ["red", "double"],
      intro: [
        ["maul", "Darth Maul", "At last. The Jedi send their children to die."],
        ["player", null, "I came for answers. I'll leave with them."],
        ["maul", "Darth Maul", "You will leave in pieces."],
      ],
      outro: [
        ["maul", "Darth Maul", "This changes nothing... the dark side gathers on Tatooine... and beyond..."],
        ["mentor", "Master Orin Vael", "Well fought. Follow that clue, and watch your anger. It is the door he wanted you to open."],
      ],
    },
    dooku: {
      id: "dooku", name: "COUNT DOOKU", title: "Master of the Elegant Blade", hp: 640, speed: 120, scale: 1.04, music: "bossDooku", sting: "dookuSting", downPose: "kneel",
      saber: ["red", "single"],
      intro: [
        ["dooku", "Count Dooku", "A Jedi in a Sith temple. How wonderfully rude."],
        ["dooku", "Count Dooku", "Your form is crude, child. Allow me to correct it."],
      ],
      outro: [
        ["dooku", "Count Dooku", "Remarkable. You have more talent than your Order deserves."],
        ["dooku", "Count Dooku", "The Emperor has a research station on Hoth. See what your Order has been too blind to find."],
      ],
    },
    ventress: {
      id: "ventress", name: "ASAJJ VENTRESS", title: "The Nightsister", hp: 720, speed: 230, scale: 1, music: "bossVentress", sting: "ventressHiss", downPose: "kneel",
      saber: ["red", "single"], twin: true,
      intro: [
        ["ventress", "Asajj Ventress", "The informant you want? I already paid him a visit."],
        ["ventress", "Asajj Ventress", "Dance with me, little Jedi. I do so hate to be bored."],
      ],
      outro: [
        ["ventress", "Asajj Ventress", "Clever. Fine, have his data. The weapon is on Endor. It will not save you."],
        ["player", null, "It doesn't have to save me. It only has to stop."],
      ],
    },
    vader: {
      id: "vader", name: "DARTH VADER", title: "The Emperor's Fist", hp: 680, speed: 92, scale: 1.2, music: "bossVader", sting: "vaderBreath", downPose: "kneel", armor: 0.66,
      saber: ["red", "single"],
      intro: [
        ["vader", "Darth Vader", "The Force is strong with you. But you are not a Jedi yet."],
        ["player", null, "The Emperor ends today."],
        ["vader", "Darth Vader", "He has foreseen your arrival. As have I."],
      ],
      outro: [
        ["vader", "Darth Vader", "Impressive. Most impressive."],
        ["vader", "Darth Vader", "You will find him on Exegol, where he has always been. Go. Learn what I learned."],
        ["mentor", "Master Orin Vael", "You stood against the fist of the Empire. There is only the hand that moves it left."],
      ],
    },
    palpatine: {
      id: "palpatine", name: "EMPEROR PALPATINE", title: "The Dark Side Itself", hp: 1300, speed: 0, scale: 1.06, music: "bossPalpatine", sting: "cackle", downPose: "dead",
      saber: null,
      intro: [
        ["palpatine", "Emperor Palpatine", "Welcome, young Jedi. I have been expecting you."],
        ["palpatine", "Emperor Palpatine", "Every step of your journey was mine. Every enemy you struck down only fed your anger."],
        ["player", null, "Then watch where it ends."],
        ["palpatine", "Emperor Palpatine", "Good. Strike me down, and your journey to the dark side will be complete."],
      ],
      outro: [
        ["palpatine", "Emperor Palpatine", "No... NO! Unlimited... power..."],
      ],
    },
  };

  class Boss extends Actor {
    constructor(game, def, x, y, arena) {
      super(x, y, 28, Math.round(62 * def.scale));
      this.game = game;
      this.def = def;
      this.id = def.id;
      this.name = def.name;
      this.arena = arena;
      this.maxHp = Math.round(def.hp * game.difficulty.bossHp);
      this.hp = this.maxHp;
      this.phase = 1;
      this.pace = 1;
      this.state = "intro";
      this.move = null;
      this.stage = null;
      this.stageT = 0;
      this.thinkT = 0.8;
      this.stun = 0;
      this.flash = 0;
      this.animT = 0;
      this.capeSwing = 0;
      this.columns = [];
      this.waves = [];
      this.beam = null;
      this.hidden = false;
      this.armed = true;
      this.guardBreakCd = 0;
      this.hitDone = false;
      this.dropsLeft = [0.7, 0.4, 0.15];
      this.gravity = 1;
      this.lastMove = "";
      this.facing = -1;
      this.dead = false;
      this.saber = def.saber ? new Lightsaber(def.saber[0], def.saber[1]) : null;
      this.saber2 = def.twin ? new Lightsaber("red", "single") : null;
      this.skin = Art.BOSS_SKINS[def.id];
      this.color = def.id === "palpatine" ? "#9fd8ff" : "#ff4a4a";
    }

    get targetable() { return this.state === "fight" && !this.hidden; }
    get player() { return this.game.player; }
    get toPlayer() { return Math.sign(this.player.x - this.x) || 1; }
    get distance() { return Math.abs(this.player.x - this.x); }
    get guarding() { return !this.move && this.stun <= 0 && this.armed; }
    get floor() { return this.arena.floor; }

    begin() { this.state = "fight"; }

    update(dt) {
      const { game } = this;
      this.animT += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.guardBreakCd = Math.max(0, this.guardBreakCd - dt);
      this.capeSwing = lerp(this.capeSwing, clamp(this.vx / 250, -1, 1) * this.facing, 1 - Math.pow(0.01, dt));
      this.updateHazards(dt);

      if (this.state === "intro") {
        this.physics(game.level, dt);
        return;
      }
      if (this.state === "down") {
        this.vx = approach(this.vx, 0, 500 * dt);
        this.physics(game.level, dt);
        return;
      }
      if (this.player.dead) {
        this.endMove();
        this.gloat = true;
        this.vx = approach(this.vx, 0, 900 * dt);
        this.physics(game.level, dt);
        return;
      }
      this.gloat = false;

      if (this.stun > 0) {
        this.stun -= dt;
        if (this.onGround) this.vx = approach(this.vx, 0, 900 * dt);
      } else if (this.move) {
        this.runMove(dt);
      } else {
        this.idle(dt);
      }
      this.tick(dt);
      if (!this.noPhysics) this.physics(game.level, dt, this.gravity);
      this.x = clamp(this.x, this.arena.left + 22, this.arena.right - 22);
    }

    // Per-boss background work, such as Vader's floor hazards.
    tick() {}

    idle(dt) {
      this.facing = this.toPlayer;
      this.thinkT -= dt;
      const keep = this.keepRange || 130;
      if (this.distance > keep) this.vx = approach(this.vx, this.toPlayer * this.def.speed * this.pace, 1200 * dt);
      else this.vx = approach(this.vx, 0, 1200 * dt);
      if (this.thinkT <= 0) this.startMove(this.think());
    }

    startMove(move) {
      this.move = move;
      this.stage = "tele";
      this.stageT = 0;
      this.hitDone = false;
      this.lastMove = move.name;
      if (move.onStart) move.onStart();
      if (move.unblockable) this.game.particles.text(this.x, this.y - this.h - 22, "!", "#ff5a55", 26);
    }

    runMove(dt) {
      const m = this.move;
      this.stageT += dt;
      const duration = (m[this.stage] || 0) / this.pace;
      const k = duration > 0 ? clamp(this.stageT / duration, 0, 1) : 1;
      if (this.stage === "tele") {
        if (!m.commit) this.facing = this.toPlayer;
        this.vx = approach(this.vx, 0, 1400 * dt);
        if (m.onTele) m.onTele(dt, k);
      } else if (this.stage === "act") {
        if (m.onAct) m.onAct(dt, k);
      } else {
        this.vx = approach(this.vx, 0, 1000 * dt);
        if (m.onRec) m.onRec(dt, k);
      }
      if (this.move !== m || this.stageT < duration) return;
      if (m.hold && m.hold(this.stage)) return;
      this.stageT = 0;
      if (this.stage === "tele") {
        this.stage = "act";
        if (m.onActStart) m.onActStart();
      } else if (this.stage === "act") {
        if (m.repeat > 0) {
          m.repeat--;
          this.stage = "tele";
          this.hitDone = false;
          m.tele = m.retele || m.tele;
          return;
        }
        this.stage = "rec";
        if (m.onRecStart) m.onRecStart();
      } else {
        this.endMove();
      }
    }

    endMove() {
      const m = this.move;
      if (!m) return;
      this.move = null;
      this.stage = null;
      this.beam = null;
      this.armed = true;
      this.game.audio.stopLoop("bossBeam");
      this.thinkT = (m.after !== undefined ? m.after : 0.55) / this.pace;
      if (m.onEnd) m.onEnd();
      if (m.next && !this.player.dead) this.startMove(m.next());
    }

    // Hits the player with a strike in front of the boss. Once per strike unless multi.
    strike({ reach = 74, dmg = 12, knock = 240, unblockable = false, up = 0 }) {
      if (this.hitDone) return false;
      const scaled = reach * Math.min(this.def.scale, 1.15);
      const box = { x: this.facing > 0 ? this.x - 8 : this.x - scaled, y: this.y - this.h - 14 - up, w: scaled + 8, h: this.h + 24 + up };
      if (overlap(box, this.player.box) && !this.player.dead) {
        this.hitDone = true;
        const result = this.player.receiveMelee({ dmg, dir: this.facing, unblockable, source: this, knock });
        return result;
      }
      return false;
    }

    // A timed Deflect stops the swing dead and leaves the boss open.
    parried() {
      const m = this.move;
      if (m && m.noParry) return;
      this.endMoveQuietly();
      this.stun = Math.max(this.stun, this.def.id === "vader" ? 0.9 : 1.15);
      this.vx = -this.facing * 180;
      this.game.hitStop(0.08);
      this.game.camera.shake(7, 0.2);
    }

    endMoveQuietly() {
      if (this.move) {
        const m = this.move;
        this.move = null;
        this.stage = null;
        this.beam = null;
        this.game.audio.stopLoop("bossBeam");
        if (m.onCancel) m.onCancel();
      }
      this.thinkT = 0.5 / this.pace;
      this.gravity = 1;
      this.noPhysics = false;
    }

    takeHit({ dmg, dir, source = "saber", finisher = false }) {
      const { game } = this;
      if (!this.targetable) return;
      const front = this.toPlayer === this.facing;
      if (source === "saber" && front && this.guarding && !finisher) {
        this.blocked(dir);
        return;
      }
      if (source === "saber" && this.onHitIntercept && this.onHitIntercept(dir)) return;
      const open = this.stun > 0 ? 1.25 : 1;
      const final = dmg * open * (this.def.armor || 1);
      this.applyDamage(final);
      this.flash = 0.1;
      const color = this.player.saber.fxPick();
      game.particles.sparks(this.x - dir * 6, this.y - this.h * 0.6, color, 12, 260);
      game.particles.hitFlash(this.x - dir * 6, this.y - this.h * 0.6, color);
      game.audio.play("saberHit");
      game.hitStop(finisher ? 0.07 : 0.04);
      game.camera.shake(finisher ? 5 : 3, 0.1);
      if (!this.def.armor && this.stun <= 0 && !this.move) this.vx = dir * 120;
    }

    blocked() {
      const { game } = this;
      const hx = this.x + this.facing * 24;
      game.particles.sparks(hx, this.y - 46, "#ff4a4a", 12, 240);
      game.particles.text(this.x, this.y - this.h - 12, "BLOCKED", "#ffa080", 12);
      game.audio.play("clash", 0.8);
      game.hitStop(0.03);
      this.player.vx = this.facing * 190;
      this.thinkT = Math.min(this.thinkT, 0.18);
    }

    applyDamage(amount) {
      if (this.state !== "fight") return;
      this.hp -= amount;
      const fraction = this.hp / this.maxHp;
      while (this.dropsLeft.length && fraction < this.dropsLeft[0]) {
        this.dropsLeft.shift();
        this.game.spawnPickup("bacta", this.x, this.y - 20);
      }
      if (this.hp <= 0) {
        this.defeat();
        return;
      }
      this.checkPhase(fraction);
    }

    checkPhase() {}

    // After the player loses a life the fight carries on, with both sides back in their corners.
    regroup() {
      this.endMoveQuietly();
      this.armed = true;
      this.hidden = false;
      this.stun = 0;
      this.columns.length = 0;
      this.waves.length = 0;
      this.thinkT = 1.6;
      this.vx = 0;
      this.vy = 0;
      this.noPhysics = false;
      this.x = this.arena.right - 200;
      this.y = this.floor;
      this.facing = -1;
    }

    pushed(dir, stats) {
      const { game } = this;
      if (this.guarding && this.guardBreakCd === 0) {
        this.guardBreakCd = 5;
        this.stun = stats.breakGuard ? 1.5 : 1.1;
        this.vx = dir * 260;
        game.particles.text(this.x, this.y - this.h - 12, "GUARD BROKEN", "#ffe680", 13);
        game.audio.play("clash");
        return;
      }
      this.applyDamage(stats.dmg);
      this.vx = dir * 160;
    }

    stagger(seconds) {
      if (this.move && this.move.noStagger) return;
      if (this.armed && !this.move) return;
      this.stun = Math.max(this.stun, Math.min(seconds, 0.5));
    }

    defeat() {
      this.hp = 0;
      this.state = "down";
      this.dead = true;
      this.endMoveQuietly();
      this.columns.length = 0;
      this.waves.length = 0;
      this.beam = null;
      this.hidden = false;
      this.armed = true;
      this.game.audio.stopLoop("bossBeam");
      this.game.onBossDefeated(this);
    }

    // ---------- Shared attacks ----------

    spawnColumn(x, { tele = 0.8, dur = 0.42, w = 48, dmg = 16, color = this.color, kind = "lightning" } = {}) {
      this.columns.push({ x: clamp(x, this.arena.left + 24, this.arena.right - 24), t: 0, tele: tele / this.pace, dur, w, dmg, color, kind, hit: false, played: false });
    }

    groundWave(x, dir, { speed = 400, dmg = 13, color = "#ff6a50" } = {}) {
      this.waves.push({ x, dir, speed, dmg, color, life: 1.6, hit: false });
    }

    blast(radius, dmg, knock = 380) {
      const { game, player } = this;
      game.particles.forceRing(this.x, this.y - 34, this.color, radius);
      game.audio.play("push");
      game.camera.shake(7, 0.2);
      if (Math.hypot(player.x - this.x, player.y - this.y) < radius) {
        player.receiveMelee({ dmg, dir: this.toPlayer, unblockable: true, knock, source: this });
      }
    }

    fireBeam(dy = 44, length = 620, dmg = 11) {
      this.beam = { dy, length, dmg, t: 0, reflected: false };
      this.game.audio.startLoop("bossBeam", { filter: 3400, q: 2.5, gain: 0.16, tone: 66 });
    }

    updateHazards(dt) {
      const { game, player } = this;
      for (let i = this.columns.length - 1; i >= 0; i--) {
        const c = this.columns[i];
        c.t += dt;
        if (c.t < c.tele) continue;
        if (!c.played) {
          c.played = true;
          game.audio.play(c.kind === "lava" ? "explosion" : "lightning", 0.6);
          game.camera.shake(3, 0.12);
        }
        if (!c.hit && !player.dead) {
          const box = { x: c.x - c.w / 2, y: this.floor - 560, w: c.w, h: 570 };
          if (overlap(box, player.box)) {
            c.hit = true;
            player.takeDamage(c.dmg, Math.sign(player.x - c.x) || 1, { knock: 200 });
          }
        }
        if (c.t > c.tele + c.dur) this.columns.splice(i, 1);
      }
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const w = this.waves[i];
        w.life -= dt;
        w.x += w.dir * w.speed * dt;
        if (Math.random() < 0.7) game.particles.dust(w.x, this.floor, "rgba(255,120,80,.6)", 1);
        if (!w.hit && overlap({ x: w.x - 16, y: this.floor - 34, w: 32, h: 34 }, player.box)) {
          w.hit = true;
          player.takeDamage(w.dmg, w.dir, { knock: 170 });
        }
        if (w.life <= 0 || w.x < this.arena.left || w.x > this.arena.right) this.waves.splice(i, 1);
      }
      if (this.beam) this.updateBeam(dt);
    }

    updateBeam(dt) {
      const { game, player } = this;
      const b = this.beam;
      b.t += dt;
      const y = this.y - b.dy;
      const x0 = this.x + this.facing * 22;
      const x1 = x0 + this.facing * b.length;
      const inX = this.facing > 0 ? player.x > x0 && player.x < x1 : player.x < x0 && player.x > x1;
      if (!inX || player.dead || y < player.y - player.h - 6 || y > player.y + 6) return;
      if (player.deflecting && player.facing === -this.facing) {
        if (player.isPerfect && !b.reflected) {
          b.reflected = true;
          game.audio.play("perfect");
          game.particles.text(player.x, player.y - 82, "REFLECTED", "#ffe680", 15);
          game.stats.perfects++;
          this.applyDamage(30);
          this.flash = 0.2;
          this.endMoveQuietly();
          this.stun = 1.2;
          return;
        }
        player.energy = Math.max(0, player.energy - 16 * dt);
        if (Math.random() < 0.5) game.particles.sparks(player.x + player.facing * 28, y, "#bfe8ff", 2, 200);
      } else {
        player.takeDamage(b.dmg, this.facing, { knock: 210 });
      }
    }

    // ---------- Drawing ----------

    currentPose(t) {
      if (this.state === "down") return Art.pose(this.def.downPose, this.downT === undefined ? t : this.downT);
      if (this.gloat) return Art.pose("victory", clamp(t % 3, 0, 1));
      if (this.stun > 0) return Art.pose("hurt", t);
      if (this.move) {
        const entry = this.move.poses && this.move.poses[this.stage];
        if (entry) {
          if (typeof entry === "function") return entry(this.stageT);
          return Art.pose(entry, t);
        }
      }
      if (Math.abs(this.vx) > 24) return Art.pose(this.def.speed > 150 ? "run" : "walk", t);
      return Art.pose(this.saber ? "ready" : "castUp", t * 0.4);
    }

    draw(ctx, t) {
      if (this.hidden) {
        this.drawHazards(ctx, t);
        return;
      }
      const p = this.currentPose(this.animT);
      const s = this.def.scale;
      const ext = { t, capeSwing: this.capeSwing };
      if (this.saber && this.armed) ext.prop = (c, j, time, pp) => this.saber.draw(c, j.fHx, j.fHy, pp.sab, time);
      if (this.saber2 && this.armed) ext.backProp = (c, j, time, pp) => this.saber2.draw(c, j.bHx, j.bHy, (pp || p).sab + 0.6, time);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * s, s);
      if (this.stage === "tele" && this.move && this.move.unblockable) {
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(255,50,40,.28)";
        ctx.beginPath();
        ctx.arc(0, -36, 42 + Math.sin(t * 22) * 4, 0, J.TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      Art.drawRig(ctx, p, this.skin, ext);
      ctx.restore();
      if (this.flash > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - this.h / 2, 22, this.h * 0.56, 0, 0, J.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      this.drawHazards(ctx, t);
    }

    drawHazards(ctx, t) {
      for (const c of this.columns) {
        const firing = c.t >= c.tele;
        if (!firing) {
          const k = c.t / c.tele;
          ctx.globalAlpha = 0.25 + k * 0.45;
          ctx.fillStyle = c.color;
          ctx.fillRect(c.x - c.w / 2, this.floor - 4, c.w, 4);
          ctx.globalAlpha = 0.1 + k * 0.14;
          ctx.fillRect(c.x - c.w / 2, this.floor - 420, c.w, 420);
          ctx.globalAlpha = 1;
        } else if (c.kind === "lava") {
          const g = ctx.createLinearGradient(0, this.floor - 300, 0, this.floor);
          g.addColorStop(0, "rgba(255,120,30,0)");
          g.addColorStop(0.4, "#ff7a1e");
          g.addColorStop(1, "#ffe9a0");
          ctx.fillStyle = g;
          ctx.fillRect(c.x - c.w / 2, this.floor - 300, c.w, 300);
        } else {
          for (let i = 0; i < 3; i++) Art.lightning(ctx, c.x + rand(-c.w / 3, c.w / 3), this.floor - 560, c.x + rand(-c.w / 3, c.w / 3), this.floor, c.color, 2.4, 14);
        }
      }
      for (const w of this.waves) {
        ctx.fillStyle = w.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(w.x - 18, this.floor);
        ctx.quadraticCurveTo(w.x + w.dir * 10, this.floor - 44, w.x + w.dir * 20, this.floor);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (this.beam) {
        const y = this.y - this.beam.dy;
        const x0 = this.x + this.facing * 22;
        const { player } = this;
        const blocked = player.deflecting && player.facing === -this.facing && Math.abs(y - (player.y - 30)) < 40;
        const reach = blocked ? player.x + player.facing * 26 : x0 + this.facing * this.beam.length;
        Art.lightning(ctx, x0, y, reach, blocked ? player.y - 48 : y, "#9fd8ff", 2.4, 12);
        Art.lightning(ctx, x0, y, reach, blocked ? player.y - 48 : y, "#c8a0ff", 1.8, 16);
      }
    }
  }

  // Shorthands for the poses a move uses.
  const lunge = "lunge";
  const ready = "ready";
  const swingUp = () => Art.pose("slash3", 0.02);
  const swingDown = () => Art.pose("slash3", 0.8);

  // ---------- Darth Maul: relentless pressure with the double blade ----------

  class Maul extends Boss {
    think() {
      const near = this.distance < 200;
      const options = near ? ["spin", "dash", "leap"] : ["dash", "throwSaber", "leap"];
      if (this.phase === 2) options.push("shove", "dash");
      let name = pick(options);
      if (name === this.lastMove) name = pick(options);
      return this[name]();
    }

    checkPhase(fraction) {
      if (this.phase === 1 && fraction < 0.5) {
        this.phase = 2;
        this.pace = 1.25;
        this.game.hud.banner("Darth Maul", "I have waited a long time for this.", 2.4);
        this.game.audio.play("maulSting");
      }
    }

    dash() {
      return { name: "dash", tele: 0.42, act: 0.34, rec: 0.6, commit: false, poses: { tele: swingUp, act: lunge, rec: swingDown },
        onActStart: () => { this.vx = this.facing * 620; this.game.audio.play("swing"); },
        onAct: () => { this.vx = this.facing * 620; this.strike({ reach: 74, dmg: 14 }); },
        next: this.phase === 2 && Math.random() < 0.4 ? () => this.spin() : null };
    }

    spin() {
      let tick = 0;
      return { name: "spin", tele: 0.45, act: 1.25, rec: 0.95, poses: { tele: ready, act: "spin", rec: "hurt" },
        onAct: (dt) => {
          this.vx = approach(this.vx, this.toPlayer * 190 * this.pace, 900 * dt);
          this.facing = this.toPlayer;
          tick -= dt;
          if (tick <= 0) {
            tick = 0.3;
            this.hitDone = false;
            this.game.audio.play("swing", 0.7);
          }
          this.strike({ reach: 66, dmg: 9, knock: 200 });
        } };
    }

    throwSaber() {
      return { name: "throwSaber", tele: 0.5, act: 0.05, rec: 1.9, poses: { tele: () => Art.pose("throw", 0), act: () => Art.pose("throw", 1), rec: () => Art.pose("throw", 1) },
        onActStart: () => {
          this.armed = false;
          this.game.audio.play("swing");
          this.game.projectiles.fire({
            kind: "saber", doubleBlade: true, x: this.x + this.facing * 30, y: this.y - 42, vx: this.facing * 640, vy: 0,
            dmg: 14, r: 22, returns: 1250, owner: this, life: 3.2, pierce: true, deflectable: false,
            onDie: () => { this.armed = true; },
          });
        },
        hold: (stage) => stage === "rec" && !this.armed && this.stageT < 3 };
    }

    leap() {
      let landed = false;
      return { name: "leap", tele: 0.32, act: 2, rec: 0.75, poses: { tele: swingUp, act: () => Art.pose(this.vy < 0 ? "jump" : "airslash", 0.6), rec: swingDown },
        onActStart: () => {
          this.vy = -820;
          this.vx = clamp((this.player.x - this.x) * 1.08, -560, 560);
          this.onGround = false;
          this.ground = null;
        },
        onAct: () => {
          if (this.onGround && this.vy >= 0 && !landed) {
            landed = true;
            this.vx = 0;
            this.groundWave(this.x, 1);
            this.groundWave(this.x, -1);
            this.game.camera.shake(7, 0.2);
            this.game.audio.play("clash");
            this.stageT = 99;
          }
        } };
    }

    shove() {
      return { name: "shove", tele: 0.42, act: 0.1, rec: 0.55, poses: { tele: "cast", act: "cast", rec: ready },
        onActStart: () => this.blast(190, 8) };
    }
  }

  // ---------- Count Dooku: fencing, counters and Force Lightning ----------

  class Dooku extends Boss {
    constructor(...args) {
      super(...args);
      this.keepRange = 180;
    }

    think() {
      const near = this.distance < 230;
      const options = near ? ["thrusts", "riposte", "thrusts"] : ["lightning", "rocks", "thrusts"];
      if (this.phase === 2) options.push("lavaFlare");
      let name = pick(options);
      if (name === this.lastMove) name = pick(options);
      return this[name]();
    }

    checkPhase(fraction) {
      if (this.phase === 1 && fraction < 0.5) {
        this.phase = 2;
        this.pace = 1.18;
        this.game.hud.banner("Count Dooku", "Enough play. The mountain itself will finish you.", 2.6);
        this.game.audio.play("dookuSting");
      }
    }

    thrusts() {
      return { name: "thrusts", tele: 0.38, retele: 0.17, act: 0.17, rec: 0.62, repeat: 2, poses: { tele: ready, act: lunge, rec: ready },
        onActStart: () => {
          this.vx = this.facing * 340;
          this.game.audio.play("swing");
        },
        onAct: () => this.strike({ reach: 84, dmg: 10 }) };
    }

    // A fencing trap: hit him here and he answers instantly. Force Push breaks it.
    riposte() {
      this.riposting = true;
      return { name: "riposte", tele: 0.12, act: 1.5, rec: 0.3, poses: { tele: ready, act: () => Art.pose("deflect", 0), rec: ready },
        onEnd: () => { this.riposting = false; }, onCancel: () => { this.riposting = false; } };
    }

    onHitIntercept() {
      if (!this.riposting) return false;
      this.endMoveQuietly();
      this.game.audio.play("clash");
      this.game.particles.sparks(this.x + this.facing * 24, this.y - 46, "#ff4a4a", 14, 260);
      this.game.particles.text(this.x, this.y - this.h - 12, "COUNTER!", "#ff8a70", 14);
      this.startMove({ name: "counter", tele: 0.14, act: 0.18, rec: 0.75, poses: { tele: ready, act: lunge, rec: swingDown },
        onActStart: () => { this.vx = this.facing * 500; },
        onAct: () => this.strike({ reach: 92, dmg: 16, knock: 300 }) });
      return true;
    }

    pushed(dir, stats) {
      if (this.riposting) {
        this.endMoveQuietly();
        this.stun = 1.6;
        this.vx = dir * 300;
        this.game.particles.text(this.x, this.y - this.h - 12, "STANCE BROKEN", "#ffe680", 13);
        this.game.audio.play("clash");
        return;
      }
      super.pushed(dir, stats);
    }

    lightning() {
      const dy = pick([30, 30, 52]);
      return { name: "lightning", tele: 0.62, act: 1.15, rec: 0.7, noParry: true, poses: { tele: "cast", act: "cast", rec: ready },
        onTele: () => {
          if (Math.random() < 0.5) this.game.particles.sparks(this.x + this.facing * 24, this.y - dy, "#9fd8ff", 1, 120);
        },
        onActStart: () => {
          this.fireBeam(dy, 700, 12);
          this.game.audio.play("lightning");
        } };
    }

    rocks() {
      const positions = [[-50, -110], [0, -130], [50, -110]];
      let thrown = 0;
      return { name: "rocks", tele: 0.68, act: 0.85, rec: 0.75, poses: { tele: "castUp", act: "cast", rec: ready },
        onAct: (dt, k) => {
          if (k >= thrown / 3 && thrown < 3) {
            const [ox, oy] = positions[thrown++];
            const x = this.x + ox;
            const y = this.y + oy;
            const a = Math.atan2(this.player.y - 36 - y, this.player.x - x);
            this.game.projectiles.fire({ kind: "rock", x, y, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, dmg: 13, r: 15, pushable: true, deflectable: false, pierce: true, life: 2.5, owner: this });
            this.game.audio.play("push", 0.4);
          }
        } };
    }

    lavaFlare() {
      return { name: "lavaFlare", tele: 0.5, act: 0.3, rec: 0.6, poses: { tele: "castUp", act: "castUp", rec: ready },
        onActStart: () => {
          [-170, 0, 170].forEach((dx) => this.spawnColumn(this.player.x + dx, { color: "#ff8a2a", kind: "lava", tele: 0.9, dmg: 15, w: 64 }));
          this.game.audio.play("dookuSting");
        } };
    }
  }

  // ---------- Asajj Ventress: fast, airborne, hard to pin down ----------

  class Ventress extends Boss {
    constructor(...args) {
      super(...args);
      this.keepRange = 110;
      this.phantoms = [];
    }

    think() {
      const options = this.distance < 190 ? ["flurry", "flurry", "vanish", "dive"] : ["twinThrow", "dive", "vanish", "flurry"];
      if (this.phase === 2) options.push("phantomRush");
      let name = pick(options);
      if (name === this.lastMove) name = pick(options);
      return this[name]();
    }

    checkPhase(fraction) {
      if (this.phase === 1 && fraction < 0.55) {
        this.phase = 2;
        this.pace = 1.2;
        this.game.hud.banner("Asajj Ventress", "Let's see you fight what you can't catch.", 2.4);
        this.game.audio.play("ventressHiss");
      }
    }

    flurry() {
      return { name: "flurry", tele: 0.28, retele: 0.11, act: 0.13, rec: 0.62, repeat: 3, poses: { tele: swingUp, act: () => Art.pose(this.animT % 0.3 < 0.15 ? "slash1" : "slash2", 0.8), rec: ready },
        onActStart: () => {
          this.vx = this.toPlayer * 300;
          this.facing = this.toPlayer;
          this.game.audio.play("swing");
        },
        onAct: () => this.strike({ reach: 70, dmg: 7, knock: 140 }) };
    }

    twinThrow() {
      let caught = 0;
      const back = () => {
        caught++;
        if (caught === 2) this.armed = true;
      };
      return { name: "twinThrow", tele: 0.45, act: 0.05, rec: 1.7, poses: { tele: () => Art.pose("throw", 0), act: () => Art.pose("throw", 1), rec: () => Art.pose("throw", 1) },
        onActStart: () => {
          this.armed = false;
          this.game.audio.play("swing");
          for (const vy of [-250, 170]) {
            this.game.projectiles.fire({
              kind: "saber", x: this.x + this.facing * 30, y: this.y - 46, vx: this.facing * 600, vy,
              dmg: 11, r: 18, returns: 1200, owner: this, life: 3.2, pierce: true, deflectable: false, onDie: back,
            });
          }
        },
        hold: (stage) => stage === "rec" && !this.armed && this.stageT < 3 };
    }

    // Up to a perch, then a plunge at wherever the player has got to.
    dive() {
      const perches = this.arena.perches;
      const perch = pick(perches);
      let sx = 0;
      let sy = 0;
      return { name: "dive", tele: 0.22, act: 0.5, rec: 0.1, commit: true, poses: { tele: swingUp, act: "jump", rec: "fall" },
        onActStart: () => {
          sx = this.x;
          sy = this.y;
          this.noPhysics = true;
          this.vx = 0;
          this.vy = 0;
          this.ground = null;
        },
        onAct: (dt, k) => {
          const e = J.U.ease.out(k);
          this.x = lerp(sx, perch.x, e);
          this.y = lerp(sy, perch.y, e) - Math.sin(k * Math.PI) * 60;
        },
        next: () => this.plunge() };
    }

    plunge() {
      let sx = 0;
      let sy = 0;
      let tx = 0;
      return { name: "plunge", tele: 0.42, act: 0.34, rec: 0.75, poses: { tele: swingUp, act: () => Art.pose("airslash", 0.7), rec: swingDown },
        onStart: () => { this.noPhysics = true; },
        onActStart: () => {
          sx = this.x;
          sy = this.y;
          tx = this.player.x;
          this.facing = this.toPlayer;
          this.game.audio.play("swing");
        },
        onAct: (dt, k) => {
          this.x = lerp(sx, tx, k);
          this.y = lerp(sy, this.floor, k * k);
          this.strike({ reach: 62, dmg: 13, up: 10 });
        },
        onRecStart: () => {
          this.noPhysics = false;
          this.y = this.floor;
          this.groundWave(this.x, 1, { speed: 340, dmg: 9, color: "#c070ff" });
          this.groundWave(this.x, -1, { speed: 340, dmg: 9, color: "#c070ff" });
          this.game.camera.shake(5, 0.16);
        },
        onCancel: () => { this.y = this.floor; } };
    }

    vanish() {
      let dest = 0;
      return { name: "vanish", tele: 0.28, act: 0.62, rec: 0.08, poses: { tele: "castUp", act: ready, rec: ready },
        onActStart: () => {
          this.hidden = true;
          this.game.particles.smoke(this.x, this.y - 30, 12, "rgba(120,60,170,.65)");
          this.game.audio.play("ventressHiss", 0.7);
          dest = clamp(this.player.x - this.player.facing * 92, this.arena.left + 40, this.arena.right - 40);
        },
        onAct: () => { this.game.particles.smoke(dest, this.floor - 10, 1, "rgba(150,80,200,.55)"); },
        onRecStart: () => {
          this.hidden = false;
          this.x = dest;
          this.y = this.floor;
          this.vx = 0;
          this.facing = this.toPlayer;
        },
        onCancel: () => { this.hidden = false; },
        next: () => ({ name: "backstab", tele: 0.3, act: 0.16, rec: 0.7, poses: { tele: swingUp, act: lunge, rec: swingDown },
          onActStart: () => { this.vx = this.facing * 360; this.game.audio.play("swing"); },
          onAct: () => this.strike({ reach: 74, dmg: 12 }) }) };
    }

    // Two shadow copies rush in from the edges. One saber touch dissolves a copy.
    phantomRush() {
      return { name: "phantomRush", tele: 0.5, act: 0.1, rec: 0.7, poses: { tele: "castUp", act: "castUp", rec: ready },
        onActStart: () => {
          const y = this.floor;
          this.phantoms.push({ x: this.arena.left + 30, y, dir: 1, life: 1.9, t: 0 }, { x: this.arena.right - 30, y, dir: -1, life: 1.9, t: 0 });
          this.game.audio.play("ventressHiss");
        } };
    }

    tick(dt) {
      const { player, game } = this;
      for (let i = this.phantoms.length - 1; i >= 0; i--) {
        const g = this.phantoms[i];
        g.t += dt;
        g.life -= dt;
        if (g.t > 0.45) g.x += g.dir * 470 * dt;
        const box = { x: g.x - 14, y: g.y - 62, w: 28, h: 62 };
        const a = player.attack;
        if (a && a.t >= a.spec.from && overlap(player.attackBox(a.spec), box)) {
          game.particles.smoke(g.x, g.y - 30, 8, "rgba(150,80,200,.6)");
          game.audio.play("saberHit", 0.5);
          this.phantoms.splice(i, 1);
          continue;
        }
        if (overlap(box, player.box) && g.t > 0.45) {
          player.receiveMelee({ dmg: 9, dir: g.dir, knock: 180 });
          this.phantoms.splice(i, 1);
          continue;
        }
        if (g.life <= 0) this.phantoms.splice(i, 1);
      }
    }

    defeat() {
      this.phantoms.length = 0;
      super.defeat();
    }

    draw(ctx, t) {
      for (const g of this.phantoms) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.translate(g.x, g.y);
        ctx.scale(g.dir, 1);
        Art.drawRig(ctx, g.t > 0.45 ? Art.pose("lunge", 0) : Art.pose("ready", t), this.skin, { t,
          prop: (c, j, time, pp) => this.saber.draw(c, j.fHx, j.fHy, pp.sab, time) });
        ctx.restore();
      }
      super.draw(ctx, t);
    }
  }

  // ---------- Darth Vader: slow, heavy, and hard to stagger ----------

  class Vader extends Boss {
    constructor(...args) {
      super(...args);
      this.keepRange = 120;
      this.hazardT = 6;
      this.breathT = 1;
    }

    think() {
      const near = this.distance < 210;
      const options = near ? ["heavy", "chain", "heavy", "choke"] : ["pull", "saberThrow", "choke", "debris"];
      let name = pick(options);
      if (name === this.lastMove) name = pick(options);
      return this[name]();
    }

    checkPhase(fraction) {
      const { game } = this;
      if (this.phase === 1 && fraction < 0.66) {
        this.phase = 2;
        this.pace = 1.1;
        game.flash("#ffffff", 0.4);
        game.hud.banner("Darth Vader", "You have only begun to discover your power. Join me.", 3);
        game.level.alarm = 0.5;
        game.camera.shake(9, 0.5);
      } else if (this.phase === 2 && fraction < 0.33) {
        this.phase = 3;
        this.pace = 1.28;
        game.flash("#ff4030", 0.5);
        game.hud.banner("Darth Vader", "If you will not be turned, you will be destroyed.", 3);
        game.level.alarm = 1;
        game.camera.shake(12, 0.6);
      }
    }

    tick(dt) {
      this.breathT -= dt;
      if (this.breathT <= 0) {
        this.breathT = 4.5;
        this.game.audio.play("vaderBreath", 0.8);
      }
      if (this.phase < 2) return;
      this.hazardT -= dt;
      if (this.hazardT <= 0) {
        this.hazardT = this.phase === 3 ? 5.5 : 7.5;
        // A sweep of power surges along the walkway. Leave a gap to stand in.
        const { left, right } = this.arena;
        const gap = Math.floor(rand(1, 5));
        for (let i = 0; i < 6; i++) {
          if (i === gap) continue;
          this.spawnColumn(left + 80 + (i * (right - left - 160)) / 5, { color: "#6ad0ff", tele: 1.15, dur: 0.4, w: 96, dmg: 14 });
        }
        this.game.audio.play("door");
      }
    }

    pushed(dir) {
      const { game } = this;
      if (this.move && this.move.name === "choke" && this.stage === "tele") {
        this.endMoveQuietly();
        this.stun = 1.1;
        game.particles.text(this.x, this.y - this.h - 12, "INTERRUPTED", "#ffe680", 13);
        game.audio.play("clash");
        return;
      }
      this.vx = dir * 90;
      game.particles.text(this.x, this.y - this.h - 12, "RESISTED", "#ffa080", 12);
    }

    stagger() {} // He doesn't flinch at reflected shots.

    heavy() {
      return { name: "heavy", tele: 0.72, act: 0.2, rec: 0.95, poses: { tele: swingUp, act: () => Art.pose("slash3", 0.7), rec: swingDown },
        onActStart: () => {
          this.vx = this.facing * 300;
          this.game.audio.play("swing");
        },
        onAct: () => this.strike({ reach: 96, dmg: 21, knock: 340 }),
        onRecStart: () => {
          this.game.camera.shake(5, 0.14);
          if (this.phase >= 2) this.groundWave(this.x + this.facing * 60, this.facing, { speed: 470, dmg: 13 });
        } };
    }

    chain() {
      return { name: "chain", tele: 0.42, retele: 0.24, act: 0.18, rec: 0.9, repeat: this.phase >= 3 ? 3 : 2, poses: { tele: swingUp, act: () => Art.pose("slash1", 0.8), rec: ready },
        onActStart: () => {
          this.vx = this.toPlayer * 250;
          this.facing = this.toPlayer;
          this.game.audio.play("swing");
        },
        onAct: () => this.strike({ reach: 88, dmg: 13 }) };
    }

    saberThrow() {
      return { name: "saberThrow", tele: 0.55, act: 0.05, rec: 1.7, poses: { tele: () => Art.pose("throw", 0), act: () => Art.pose("throw", 1), rec: () => Art.pose("throw", 1) },
        onActStart: () => {
          this.armed = false;
          this.game.audio.play("swing");
          this.game.projectiles.fire({
            kind: "saber", x: this.x + this.facing * 36, y: this.y - 46, vx: this.facing * 760, vy: 0,
            dmg: 18, r: 22, returns: 1500, owner: this, life: 3, pierce: true, deflectable: false,
            onDie: () => { this.armed = true; },
          });
        },
        hold: (stage) => stage === "rec" && !this.armed && this.stageT < 3 };
    }

    // Unblockable. Strike him or push him during the wind-up to stop it.
    choke() {
      return { name: "choke", tele: 0.85, act: 0.2, rec: 0.7, unblockable: true, noParry: true, poses: { tele: "cast", act: "cast", rec: "cast" },
        onActStart: () => {
          if (Math.abs(this.player.x - this.x) < 560) this.player.startChoke({ dps: 10, escape: 7, source: this });
        },
        hold: (stage) => stage === "act" && !!this.player.choke };
    }

    onHitIntercept() {
      if (this.move && this.move.name === "choke" && this.stage === "tele") {
        this.endMoveQuietly();
        this.stun = 0.8;
        this.game.particles.text(this.x, this.y - this.h - 12, "INTERRUPTED", "#ffe680", 13);
      }
      return false;
    }

    pull() {
      return { name: "pull", tele: 0.5, act: 0.48, rec: 0, unblockable: true, noParry: true, poses: { tele: "cast", act: "cast" },
        onAct: (dt) => {
          const { player } = this;
          if (this.distance > 76 && !player.choke) {
            player.x += this.toPlayer * -640 * dt;
            player.vx = 0;
            if (Math.random() < 0.5) this.game.particles.spawn(player.x, player.y - 40, this.toPlayer * -220, J.U.rand(-20, 20), 0.3, 2, "#ff6a60", { glow: true, kind: 1 });
          }
        },
        next: () => this.heavy() };
    }

    debris() {
      const { left, right } = this.arena;
      let thrown = 0;
      return { name: "debris", tele: 0.7, act: 1, rec: 0.8, poses: { tele: "castUp", act: "cast", rec: ready },
        onAct: (dt, k) => {
          if (k >= thrown / 3 && thrown < 3) {
            thrown++;
            const fromLeft = thrown % 2 === 1;
            const x = fromLeft ? left + 8 : right - 8;
            const y = this.floor - 80 - rand(0, 120);
            const a = Math.atan2(this.player.y - 36 - y, this.player.x - x);
            this.game.projectiles.fire({ kind: "rock", x, y, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, dmg: 15, r: 18, pushable: true, deflectable: false, pierce: true, life: 2.6, owner: this });
            this.game.audio.play("push", 0.4);
          }
        } };
    }
  }

  // ---------- Emperor Palpatine: three phases and a final clash ----------

  class Palpatine extends Boss {
    constructor(...args) {
      super(...args);
      this.keepRange = 9999;
      this.gravity = 0;
      this.noPhysics = true;
      this.armed = true;
      this.hover = 26;
      this.y = this.floor - this.hover;
      this.spots = this.arena.spots;
      this.summoned = 0;
      this.summonAt = 0.84;
      this.stormT = 8;
      this.clash = null;
      this.hitsTaken = 0;
    }

    get guarding() { return false; }

    regroup() {
      this.releaseClash();
      this.finalReady = false;
      super.regroup();
      this.noPhysics = true;
      this.y = this.floor - this.hover;
    }

    get shielded() {
      return this.game.enemies.some((e) => !e.dead && e.wave === "emperor");
    }

    // He hovers, so the shared reset mustn't hand him back to gravity.
    endMoveQuietly() {
      super.endMoveQuietly();
      this.gravity = 0;
      this.noPhysics = true;
    }

    begin() {
      super.begin();
      this.thinkT = 1.2;
    }

    idle(dt) {
      this.facing = this.toPlayer;
      this.thinkT -= dt;
      this.y = this.floor - this.hover + Math.sin(this.animT * 2) * 5;
      if (this.thinkT <= 0) this.startMove(this.think());
    }

    think() {
      const fraction = this.hp / this.maxHp;
      if (this.phase === 1 && this.summoned === 0 && fraction < this.summonAt) return this.summon(2);
      if (this.phase === 2 && this.summoned === 1 && fraction < 0.5) return this.summon(2);
      const options = {
        1: ["orbs", "strikes", "orbs", "teleport"],
        2: ["sweep", "ring", "teleport", "orbs", "strikes"],
        3: ["clashAttack", "ring", "sweep", "teleport", "strikes"],
      }[this.phase];
      let name = pick(options);
      if (name === this.lastMove) name = pick(options);
      return this[name]();
    }

    checkPhase(fraction) {
      const { game } = this;
      if (this.phase === 1 && fraction < 0.66) {
        this.phase = 2;
        this.pace = 1.15;
        game.flash("#bfe0ff", 0.5);
        game.camera.shake(10, 0.5);
        game.audio.play("cackle");
        game.hud.banner("Emperor Palpatine", "Now, young Jedi, you will die. Unlimited power!", 3);
        game.level.alarm = 0.6;
      } else if (this.phase === 2 && fraction < 0.33) {
        this.phase = 3;
        this.pace = 1.3;
        game.flash("#ffffff", 0.7);
        game.camera.shake(14, 0.7);
        game.audio.play("cackle");
        game.hud.banner("Emperor Palpatine", "I AM all the Sith! Your hate has made you powerful!", 3);
        game.level.alarm = 1;
      }
    }

    tick(dt) {
      if (this.phase < 2 || this.clash) return;
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = this.phase === 3 ? 4.2 : 6.5;
        const n = this.phase === 3 ? 4 : 3;
        for (let i = 0; i < n; i++) this.spawnColumn(this.player.x + (i - (n - 1) / 2) * 120 + rand(-30, 30), { tele: 1, dmg: 14, w: 54 });
      }
    }

    takeHit(hit) {
      if (!this.targetable) return;
      if (this.clash) return;
      if (this.shielded) {
        this.game.particles.text(this.x, this.y - this.h - 12, "SHIELDED", "#9fd8ff", 13);
        this.game.particles.sparks(this.x, this.y - 40, "#9fd8ff", 8, 200);
        this.game.audio.play("deflect");
        return;
      }
      super.takeHit({ ...hit, finisher: true });
      this.hitsTaken++;
      // He doesn't stay in reach for long.
      if (this.hitsTaken >= 4 && !this.move && this.state === "fight") {
        this.hitsTaken = 0;
        this.thinkT = 0;
      }
    }

    pushed(dir, stats) {
      if (this.shielded) {
        this.game.particles.text(this.x, this.y - this.h - 12, "SHIELDED", "#9fd8ff", 13);
        return;
      }
      this.applyDamage(stats.dmg);
      this.game.particles.text(this.x, this.y - this.h - 12, "ABSORBED", "#ffa080", 12);
    }

    // The last hit never lands. It starts the final clash instead.
    applyDamage(amount) {
      if (this.state !== "fight") return;
      if (this.finalReady) return;
      if (this.hp - amount <= 0) {
        this.hp = 1;
        this.finalReady = true;
        this.endMoveQuietly();
        this.noPhysics = true;
        this.startMove(this.clashAttack(true));
        return;
      }
      super.applyDamage(amount);
    }

    summon(count) {
      this.summoned++;
      return { name: "summon", tele: 0.7, act: 0.4, rec: 0.6, poses: { tele: "castUp", act: "castUp", rec: "castUp" },
        onActStart: () => {
          this.game.audio.play("cackle");
          const { left, right } = this.arena;
          for (let i = 0; i < count; i++) {
            const x = i ? left + 150 : right - 150;
            this.game.spawnEnemy("elite", x, this.floor, { wave: "emperor", alwaysActive: true, noDrop: i === 0 });
            this.game.particles.forceRing(x, this.floor - 40, "#ff3a50", 60);
          }
        } };
    }

    orbs() {
      let shots = 0;
      const count = this.phase === 1 ? 3 : 4;
      return { name: "orbs", tele: 0.55, act: 0.95, rec: 1.25, noParry: true, poses: { tele: "cast", act: "cast", rec: "castUp" },
        onAct: (dt, k) => {
          if (k >= shots / count && shots < count) {
            shots++;
            const a = Math.atan2(this.player.y - 40 - (this.y - 44), this.player.x - this.x) + rand(-0.3, 0.3);
            this.game.projectiles.fire({ kind: "orb", x: this.x + this.facing * 24, y: this.y - 46, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, dmg: 13, r: 11, color: "#a96bff", homing: 1.3, life: 4.2, owner: this });
            this.game.audio.play("deflect", 0.6);
          }
        } };
    }

    strikes() {
      let n = 0;
      const total = this.phase === 1 ? 3 : 5;
      return { name: "strikes", tele: 0.4, act: 1.1, rec: 0.9, noParry: true, poses: { tele: "castUp", act: "castUp", rec: "castUp" },
        onAct: (dt, k) => {
          if (k >= n / total && n < total) {
            n++;
            this.spawnColumn(this.player.x + rand(-40, 40) + this.player.vx * 0.45, { tele: 0.75, dmg: 15, w: 56 });
          }
        } };
    }

    teleport() {
      const here = this.x;
      return { name: "teleport", tele: 0.3, act: 0.34, rec: 0.1, noParry: true, poses: { tele: "castUp", act: "castUp", rec: "castUp" },
        onActStart: () => {
          this.hidden = true;
          this.game.particles.smoke(this.x, this.y - 30, 12, "rgba(40,30,60,.8)");
          this.game.audio.play("door", 0.5);
        },
        onRecStart: () => {
          this.hidden = false;
          const choices = this.spots.filter((x) => Math.abs(x - here) > 120);
          this.x = choices.reduce((best, x) => (Math.abs(x - this.player.x) > 170 && Math.random() < 0.6 ? x : best), pick(choices));
          this.game.particles.forceRing(this.x, this.y - 30, "#a96bff", 50);
        },
        onCancel: () => { this.hidden = false; } };
    }

    sweep() {
      const dy = pick([32, 34, 56]);
      return { name: "sweep", tele: 0.7, act: 1.5, rec: 0.95, noParry: true, poses: { tele: "cast", act: "cast", rec: "castUp" },
        onActStart: () => {
          this.fireBeam(dy, 960, 13);
          this.game.audio.play("lightning");
        } };
    }

    ring() {
      return { name: "ring", tele: 0.7, act: 0.1, rec: 1.3, noParry: true, poses: { tele: "castUp", act: "castUp", rec: "castUp" },
        onActStart: () => {
          const n = this.phase === 3 ? 12 : 9;
          const offset = rand(0.4);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * J.TAU + offset;
            this.game.projectiles.fire({ kind: "orb", x: this.x, y: this.y - 40, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, dmg: 12, r: 9, color: "#ff5ad0", life: 3.4, owner: this, pierce: true });
          }
          this.game.audio.play("push");
          this.game.camera.shake(5, 0.2);
        } };
    }

    // Saber against lightning: hammer Attack to drive it back.
    clashAttack(final = false) {
      return { name: "clash", tele: final ? 0.3 : 0.85, act: 1, rec: 0.3, noParry: true, unblockable: !final, noStagger: true, poses: { tele: "cast", act: "cast", rec: "castUp" },
        onActStart: () => {
          const { player, game } = this;
          this.clash = { meter: 0.5, final };
          player.frozen = true;
          player.scriptPose = "deflect";
          player.facing = -this.toPlayer;
          player.vx = 0;
          player.invuln = 99;
          player.deflecting = false;
          game.audio.startLoop("bossBeam", { filter: 3400, q: 2.5, gain: 0.2, tone: 66 });
          game.hud.banner(null, final ? "FINISH IT! HAMMER ATTACK!" : "HAMMER ATTACK TO DRIVE IT BACK!", 2);
        },
        onAct: (dt) => this.updateClash(dt),
        hold: (stage) => stage === "act" && !!this.clash,
        onCancel: () => this.releaseClash() };
    }

    updateClash(dt) {
      const { game, player } = this;
      const c = this.clash;
      if (!c) return;
      if (game.input.pressed("attack") || game.input.pressed("deflect") || game.input.pressed("jump")) {
        c.meter += c.final ? 0.075 : 0.06;
        game.particles.sparks(lerp(this.x, player.x, 1 - c.meter), player.y - 46, player.saber.fxPick(), 5, 260);
        game.audio.play("clash", 0.4);
      }
      c.meter -= (c.final ? 0.15 : 0.17) * dt;
      game.camera.shake(3, 0.1);
      if (c.meter >= 1) {
        this.clashWon(c.final);
      } else if (c.meter <= 0) {
        this.releaseClash();
        player.invuln = 0;
        player.takeDamage(22, this.facing, { knock: 300 });
        if (c.final && !player.dead) this.finalReady = false, this.hp = Math.ceil(this.maxHp * 0.05);
      }
    }

    releaseClash() {
      const { player, game } = this;
      if (!this.clash) return;
      this.clash = null;
      player.frozen = false;
      player.scriptPose = null;
      player.invuln = 1;
      game.audio.stopLoop("bossBeam");
    }

    clashWon(final) {
      const { game } = this;
      this.releaseClash();
      game.flash("#ffffff", 0.45);
      game.audio.play("explosion");
      game.camera.shake(12, 0.4);
      if (final) {
        this.finalReady = false;
        this.defeat();
        return;
      }
      this.endMoveQuietly();
      this.noPhysics = true;
      this.stun = 2.4;
      this.hp = Math.max(this.hp - 150, 2);
      this.flash = 0.3;
      if (this.hp <= 2) this.applyDamage(5);
    }

    draw(ctx, t) {
      if (this.clash && !this.hidden) {
        const { player } = this;
        const c = this.clash;
        const meet = lerp(this.x + this.facing * 26, player.x + player.facing * 28, 1 - c.meter);
        const y = this.y - 44;
        for (let i = 0; i < 3; i++) Art.lightning(ctx, this.x + this.facing * 24, y, meet, player.y - 48, i ? "#9fd8ff" : "#c8a0ff", 2.6, 16);
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(meet, player.y - 48, 2, meet, player.y - 48, 46);
        g.addColorStop(0, "#fff");
        g.addColorStop(1, "rgba(120,180,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(meet, player.y - 48, 46, 0, J.TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      if (this.shielded && !this.hidden) {
        ctx.strokeStyle = "rgba(160,216,255,.7)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y - 40, 46 + Math.sin(t * 6) * 3, 0, J.TAU);
        ctx.stroke();
      }
      super.draw(ctx, t);
    }
  }

  const CLASSES = { maul: Maul, dooku: Dooku, ventress: Ventress, vader: Vader, palpatine: Palpatine };

  J.BOSS_DEFS = DEFS;
  J.createBoss = (game, id, x, y, arena) => new CLASSES[id](game, DEFS[id], x, y, arena);
  J.Boss = Boss;
})(window.JEDI);
