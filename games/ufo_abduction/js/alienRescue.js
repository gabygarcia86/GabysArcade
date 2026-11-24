/*
 * The alien family: seven relatives stranded around Earth. They hide on rooftops, towers
 * and in bushes next to their crashed escape pods, and pop up waving when the saucer comes
 * close. Beam them aboard for a bonus. Rescue all seven in one run for the family reunion.
 */
(function (U) {
  "use strict";

  const D = U.Draw;

  const FAMILY = [
    { id: "mom", name: "Alien Mom", points: 1000, quote: "Did you remember your space scarf?" },
    { id: "dad", name: "Alien Dad", points: 1000, quote: "I took a wrong turn at Jupiter!" },
    { id: "baby", name: "Baby Alien", points: 2000, quote: "Goo goo zorp!" },
    { id: "grandma", name: "Alien Grandma", points: 1500, quote: "I knitted you a nebula!" },
    { id: "grandpa", name: "Alien Grandpa", points: 1500, quote: "In my day we walked between planets!" },
    { id: "bestie", name: "Alien Best Friend", points: 750, quote: "Best. Abduction. Ever!" },
    { id: "cousin", name: "Alien Cousin", points: 750, quote: "Can we beam a cow on the way home?" },
  ];
  const BY_ID = {};
  for (const m of FAMILY) BY_ID[m.id] = m;

  const SEE_RANGE = 400;
  const LIFT_TIME = 1.1;

  class StrandedAlien {
    constructor(game, member, perch) {
      this.game = game;
      this.member = member;
      this.perch = perch;
      this.x = perch.x;
      this.baseY = perch.y;
      this.y = perch.y;
      this.state = "hiding";
      this.peek = 0; // 0 hidden, 1 fully visible
      this.t = U.rand(0, 5);
      this.lift = 0;
      this.dead = false;
      this.called = false;
      this.helpT = U.rand(2, 4);
      this.bubble = "";
      this.bubbleT = 0;
      this.blinkT = 2;
      this.goneT = 0;
      this.podSide = perch.ground ? 0 : Math.random() < 0.5 ? -1 : 1;
      this.pose = { t: 0, wave: false, jump: false, happy: false, float: false, blink: false, lx: 0 };
    }

    get height() {
      return 64 * U.Art.FAMILY_STYLE[this.member.id].size;
    }

    update(dt) {
      const g = this.game;
      const p = g.player;
      const beam = g.beam;
      this.t += dt;
      this.bubbleT = Math.max(0, this.bubbleT - dt);
      this.blinkT -= dt;
      if (this.blinkT < -0.12) this.blinkT = U.rand(2, 4);

      if (this.state === "lifting") {
        if (!beam.active) {
          this.state = "falling";
          this.fallV = 0;
          return;
        }
        this.lift = Math.min(1, this.lift + dt / LIFT_TIME);
        this.x = U.damp(this.x, beam.ox, 5, dt);
        this.y = U.lerp(this.baseY, beam.oy + 8, U.easeInOut(this.lift));
        if (this.lift >= 1) {
          this.state = "rescued";
          this.goneT = 0;
          g.onRescue(this);
        }
        return;
      }
      if (this.state === "falling") {
        this.fallV += 1200 * dt;
        this.y += this.fallV * dt;
        this.x = U.damp(this.x, this.perch.x, 3, dt);
        if (this.y >= this.baseY) {
          this.y = this.baseY;
          this.x = this.perch.x;
          this.state = "waving";
          this.say("WHOOPS! TRY AGAIN!");
        }
        return;
      }
      if (this.state === "rescued") {
        this.goneT += dt;
        this.x = U.damp(this.x, beam.ox, 12, dt);
        this.y = U.damp(this.y, beam.oy, 12, dt);
        if (this.goneT > 0.3) this.dead = true;
        return;
      }

      const sees = p.alive && Math.abs(p.x - this.x) < SEE_RANGE;
      const revealed = sees || p.power.beacon > 0;
      this.peek = U.approach(this.peek, revealed ? 1 : 0, dt * 3);
      if (revealed && this.state === "hiding") {
        this.state = "waving";
        if (sees && !this.called) {
          this.called = true;
          this.say(U.pick(["OVER HERE!", "HELP! HELP!", "YOO-HOO!", "DOWN HERE!"]));
          g.audio.play("alien", { pitch: this.member.id === "baby" ? 1.6 : this.member.id.startsWith("grand") ? 0.75 : 1 });
        }
      } else if (!revealed && this.state === "waving") {
        this.state = "hiding";
        this.called = false;
      }

      // Calls for help now and then, so a listening player can find them.
      this.helpT -= dt;
      if (this.helpT <= 0) {
        this.helpT = U.rand(4, 7);
        if (this.state === "waving") this.say(U.pick(["HELP!", "BEAM ME UP!", "OVER HERE!", "ZORP ZORP!"]));
        if (Math.abs(p.x - this.x) < 900) g.audio.play("alien", { pitch: 1.1 });
      }

      if (this.peek > 0.6 && beam.active && beam.contains(this.x, this.y - this.height * 0.5, 14)) {
        this.state = "lifting";
        this.lift = 0;
        this.say("YAY! FAMILY!");
        g.audio.play("alien", { pitch: 1.3 });
      }
    }

    say(text) {
      this.bubble = text;
      this.bubbleT = 1.6;
    }

    draw(ctx, t) {
      const p = this.game.player;
      const x = this.x;
      const ground = this.perch.ground;
      const visible = this.state !== "hiding" || this.peek > 0;
      // Escape pod beside them on a perch.
      if (!ground && this.state !== "rescued") drawPod(ctx, this.perch.x + this.podSide * 30, this.baseY, t);

      if (this.state === "hiding" || (this.state === "waving" && this.peek < 1)) {
        // Hiding: only antenna tips poke up, glinting.
        const sink = (1 - this.peek) * this.height * 0.85;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 60, this.baseY - 200, 120, 200);
        ctx.clip();
        this.drawBody(ctx, x, this.baseY + sink, t);
        ctx.restore();
        if (this.peek < 0.5 && Math.sin(t * 3 + this.x) > 0.6) D.star(ctx, x + 8, this.baseY + sink - this.height - 18, 6, "#fff", 0, 4, 0.3, t * 4);
      } else if (visible) {
        this.drawBody(ctx, x, this.y, t);
      }
      if (ground && this.state !== "lifting" && this.state !== "rescued") U.Scenery.drawBush(ctx, this.perch.x, this.baseY + 4, t);

      // Beacon: a pulsing ring around them.
      if (p.power.beacon > 0 && (this.state === "hiding" || this.state === "waving")) {
        const k = (t * 1.2) % 1;
        ctx.strokeStyle = `rgba(192, 140, 255, ${1 - k})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, this.baseY - 30, 20 + k * 60, 0, U.TAU);
        ctx.stroke();
      }
      if (this.bubbleT > 0 && this.state !== "rescued" && (this.peek > 0.5 || this.state !== "hiding")) {
        D.bubble(ctx, x, this.y - this.height - 30, this.bubble, { size: 15, fill: "#eaffe0", color: "#1d6b3a" });
      }
    }

    drawBody(ctx, x, y, t) {
      const pose = this.pose;
      const p = this.game.player;
      pose.t = t + this.x;
      pose.wave = this.state === "waving";
      pose.jump = this.state === "waving" && Math.abs(p.x - this.x) < 160;
      pose.float = this.state === "lifting" || this.state === "rescued";
      pose.happy = this.state === "lifting";
      pose.blink = this.blinkT < 0;
      pose.lx = U.clamp((p.x - x) / 200, -1, 1);
      let k = 1;
      if (this.state === "rescued") k = Math.max(0.05, 1 - this.goneT / 0.3);
      else if (this.state === "lifting" && this.lift > 0.75) k = 1 - (this.lift - 0.75) * 1.6;
      ctx.save();
      ctx.translate(x, y);
      if (this.state === "lifting") ctx.rotate(Math.sin(t * 6) * 0.2);
      ctx.scale(k, k);
      U.Art.drawAlien(ctx, this.member.id, pose);
      ctx.restore();
    }
  }

  function drawPod(ctx, x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.35);
    D.ell(ctx, 0, -16, 16, 20, "#d6cff7", 3);
    D.circ(ctx, 2, -20, 7, "#9fe7ff", 2.5);
    D.line(ctx, -10, -6, -2, -12, D.OUT, 2);
    D.line(ctx, -2, -12, -6, -18, D.OUT, 2);
    ctx.restore();
    const k = (t * 0.6) % 1;
    ctx.fillStyle = `rgba(120, 110, 130, ${0.5 - k * 0.5})`;
    ctx.beginPath();
    ctx.arc(x + 6 + k * 10, y - 36 - k * 40, 5 + k * 9, 0, U.TAU);
    ctx.fill();
  }

  // ---------------------------------------------------------------- Manager

  class RescueManager {
    constructor(game) {
      this.game = game;
      this.aliens = [];
      this.rescuedRun = new Set();
      this.schedule = [];
      this.endless = false;
      this.nextEndless = 0;
    }

    startRun(endless) {
      this.endless = endless;
      this.rescuedRun = new Set();
      this.aliens = [];
      this.schedule = [];
      this.reunions = 0;
    }

    // Spreads `slots` appearances across a stage.
    startStage(slots, duration) {
      this.aliens = [];
      this.schedule = [];
      if (this.endless) {
        this.nextEndless = 6;
        return;
      }
      for (let i = 0; i < slots; i++) {
        const span = Math.max(10, duration - 26);
        this.schedule.push(4 + (slots === 1 ? span * 0.3 : (span * i) / (slots - 1)));
      }
    }

    endStage() {
      this.aliens = [];
      this.schedule = [];
    }

    pool() {
      const busy = new Set(this.aliens.map((a) => a.member.id));
      return FAMILY.filter((m) => !this.rescuedRun.has(m.id) && !busy.has(m.id));
    }

    spawn() {
      const options = this.pool();
      if (!options.length) return false;
      const scene = this.game.scene;
      const p = this.game.player;
      const used = new Set(this.aliens.map((a) => a.perch));
      // Prefer perches the player isn't next to, so finding them takes some looking.
      let perches = scene.perches.filter((pc) => !used.has(pc) && Math.abs(pc.x - p.x) > 500 && !this.game.blockedPerch(pc));
      if (!perches.length) perches = scene.perches.filter((pc) => !used.has(pc));
      if (!perches.length) return false;
      const member = U.pick(options);
      const perch = U.pick(perches);
      this.aliens.push(new StrandedAlien(this.game, member, perch));
      this.game.hud.banner("AN ALIEN IS STRANDED NEARBY!", { color: "#8dff5a", size: 26, time: 1.8 });
      this.game.audio.play("alien", { pitch: 0.9 });
      return true;
    }

    update(dt, stageTime) {
      if (this.endless) {
        this.nextEndless -= dt;
        if (this.nextEndless <= 0) {
          this.nextEndless = 20;
          if (this.aliens.length < 2) this.spawn();
        }
      } else {
        while (this.schedule.length && stageTime >= this.schedule[0]) {
          this.schedule.shift();
          this.spawn();
        }
      }
      for (const a of this.aliens) a.update(dt);
      this.aliens = this.aliens.filter((a) => !a.dead);
    }

    // Called by the game once an alien is aboard. Returns true when the family is complete.
    markRescued(id) {
      this.rescuedRun.add(id);
      return this.rescuedRun.size === FAMILY.length;
    }

    // Endless mode starts a new round of rescues after each reunion.
    newRound() {
      this.rescuedRun = new Set();
      this.reunions++;
    }

    get count() {
      return this.rescuedRun.size;
    }
  }

  // ---------------------------------------------------------------- Reunion celebration

  class Reunion {
    constructor(game) {
      this.game = game;
      this.t = 0;
      this.duration = 5.2;
      this.fireT = 0;
      this.done = false;
      this.pose = { t: 0, jump: true, happy: true, wave: false, float: false, blink: false, lx: 0 };
    }

    update(dt) {
      this.t += dt;
      this.fireT -= dt;
      const g = this.game;
      if (this.fireT <= 0 && this.t < this.duration - 0.8) {
        this.fireT = 0.22;
        g.particles.firework(U.rand(80, g.VW - 80), U.rand(70, 300), U.pick(["#ff5fb4", "#ffd23f", "#8dff5a", "#5fd0ff", "#c08cff"]), true);
        g.audio.play("firework");
      }
      if (this.t < 0.1) g.particles.burst(g.VW / 2, 300, 60, { speed: 420, speedMin: 120, life: 1.8, size: 7, kind: "confetti", gravity: 260, drag: 0.97, vr: 10, color: ["#ff5fb4", "#8dff5a", "#ffd23f", "#5fd0ff", "#c08cff"], screen: true });
      if (this.t >= this.duration) this.done = true;
    }

    // Drawn in screen space, over the game.
    draw(ctx, VW, t) {
      const k = Math.min(1, this.t / 0.4) * Math.min(1, (this.duration - this.t) / 0.5);
      ctx.fillStyle = `rgba(16, 6, 40, ${0.55 * k})`;
      ctx.fillRect(0, 0, VW, U.VH);
      ctx.globalAlpha = k;

      // Rays.
      ctx.save();
      ctx.translate(VW / 2, 470);
      ctx.rotate(t * 0.3);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(U.TAU / 12);
        ctx.fillStyle = i % 2 ? "rgba(255, 230, 120, 0.12)" : "rgba(141, 255, 90, 0.1)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(900, -90);
        ctx.lineTo(900, 90);
        ctx.fill();
      }
      ctx.restore();

      // The family dancing in a line.
      const scale = VW < 700 ? 1.1 : 1.5;
      const gap = Math.min(110, (VW - 80) / FAMILY.length);
      const startX = VW / 2 - (gap * (FAMILY.length - 1)) / 2;
      FAMILY.forEach((m, i) => {
        const pose = this.pose;
        pose.t = t * 1.1 + i * 0.7;
        pose.lx = Math.sin(t * 2 + i) * 0.6;
        const enter = U.easeOutBack(U.clamp((this.t - i * 0.08) / 0.5, 0, 1));
        const x = startX + i * gap;
        const y = 560 + (1 - enter) * 300;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 6 + i) * 0.12);
        ctx.scale(scale, scale);
        U.Art.drawAlien(ctx, m.id, pose);
        ctx.restore();
      });

      // The saucer hovering over them, its pilot cheering.
      U.Art.drawUFO(ctx, VW / 2, 330 + Math.sin(t * 2) * 8, { t, tilt: Math.sin(t * 3) * 0.08, mood: "happy", cheer: true, look: 0, scale: 1.2 });

      const pop = U.easeOutBack(U.clamp(this.t / 0.6, 0, 1));
      ctx.save();
      ctx.translate(VW / 2, 150);
      ctx.scale(pop, pop);
      ctx.rotate(Math.sin(t * 3) * 0.04);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = VW < 700 ? 46 : 70;
      ctx.font = `800 ${size}px Oxanium, sans-serif`;
      ctx.lineJoin = "round";
      ctx.lineWidth = 12;
      ctx.strokeStyle = D.OUT;
      ctx.strokeText("FAMILY REUNITED!", 0, 0);
      const grad = ctx.createLinearGradient(-300, 0, 300, 0);
      const h = (t * 120) % 360;
      grad.addColorStop(0, `hsl(${h}, 100%, 65%)`);
      grad.addColorStop(0.5, `hsl(${(h + 120) % 360}, 100%, 65%)`);
      grad.addColorStop(1, `hsl(${(h + 240) % 360}, 100%, 65%)`);
      ctx.fillStyle = grad;
      ctx.fillText("FAMILY REUNITED!", 0, 0);
      ctx.font = `800 ${Math.round(size * 0.5)}px Oxanium, sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeText("+10,000 BONUS!", 0, size * 0.95);
      ctx.fillStyle = "#ffd23f";
      ctx.fillText("+10,000 BONUS!", 0, size * 0.95);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  U.FAMILY = FAMILY;
  U.FAMILY_BY_ID = BY_ID;
  U.StrandedAlien = StrandedAlien;
  U.RescueManager = RescueManager;
  U.Reunion = Reunion;
  U.drawPod = drawPod;
})(window.UFO);
