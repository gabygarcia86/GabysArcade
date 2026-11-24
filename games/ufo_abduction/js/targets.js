/*
 * Humans and animals that can be abducted. Each type has points, a behaviour, a lift time
 * (how long the beam takes to pull it up) and its own sound and lines.
 *
 * Behaviours:
 *   slow    plods about; only sometimes notices the saucer        (cow)
 *   runs    wanders, with sudden sprints                           (pig)
 *   flee    runs away when the saucer comes low and close          (people)
 *   erratic darts about, changing direction often                  (dog, cat, crab)
 *   fast    quick little dashes                                    (chicken, seagull)
 *   gallop  walks, and may gallop off at high speed when scared    (horse)
 *   wander  ambles, barely panics                                  (sheep, tourists)
 *   jumpy   hops about unpredictably                               (goat)
 *   flock   follows a leader in a little group                     (duck)
 *   run     always on the move, crossing the map                   (mail carrier)
 *   avoid   flees and sidesteps the beam                           (security guard)
 */
(function (U) {
  "use strict";

  const TYPES = {
    cow: { name: "Cow", points: 100, art: "cow", behavior: "slow", walk: 26, run: 70, h: 64, w: 76, lift: 1.6, sound: "moo", says: ["MOO!", "MOOO?!", "UDDERLY RUDE!"] },
    pig: { name: "Pig", points: 75, art: "pig", behavior: "runs", walk: 38, run: 160, h: 50, w: 64, lift: 1.3, sound: "squeal", says: ["OINK!", "SQUEEE!", "NOT THE BACON!"] },
    farmer: { name: "Farmer", points: 150, art: "farmer", behavior: "flee", walk: 42, run: 160, h: 96, w: 30, lift: 1.4, sound: "human", pitch: 0.85, says: ["HEY!", "MY CROPS!", "NOT AGAIN!"] },
    dog: { name: "Dog", points: 100, art: "dog", behavior: "erratic", walk: 80, run: 190, h: 46, w: 54, lift: 1.1, sound: "bark", says: ["WOOF!", "ARF ARF!", "BAD UFO!"] },
    chicken: { name: "Chicken", points: 50, art: "chicken", behavior: "fast", walk: 110, run: 220, h: 44, w: 34, lift: 0.9, sound: "cluck", says: ["BAWK!", "BUK-BUK!", "FLAP FLAP!"], scale: 1.15 },
    horse: { name: "Horse", points: 125, art: "horse", behavior: "gallop", walk: 48, run: 250, h: 100, w: 86, lift: 1.7, sound: "neigh", says: ["NEIGH!", "WHINNY!", "HAY, STOP!"] },
    human: { name: "Human", points: 200, art: "human", behavior: "flee", walk: 46, run: 175, h: 96, w: 30, lift: 1.4, sound: "human", pitch: 1, says: ["AAAH!", "PUT ME DOWN!", "WHEEE?!"] },
    sheep: { name: "Sheep", points: 75, art: "sheep", behavior: "wander", walk: 30, run: 85, h: 58, w: 60, lift: 1.2, sound: "baa", says: ["BAA!", "BAAAH?!", "EWE WHAT?!"] },
    goat: { name: "Goat", points: 100, art: "goat", behavior: "jumpy", walk: 60, run: 150, h: 64, w: 58, lift: 1.2, sound: "baa", says: ["MEHHH!", "BLEAT!", "NO KIDDING!"] },
    duck: { name: "Duck", points: 50, art: "duck", behavior: "flock", walk: 50, run: 115, h: 44, w: 34, lift: 0.9, sound: "quack", says: ["QUACK!", "QUACK QUACK!", "WADDLE!"], scale: 1.15 },
    mail: { name: "Mail Carrier", points: 175, art: "mail", behavior: "run", walk: 88, run: 190, h: 96, w: 30, lift: 1.4, sound: "human", pitch: 1.1, says: ["MY MAIL!", "RETURN TO SENDER!", "SPECIAL DELIVERY?!"] },
    guard: { name: "Security Guard", points: 200, art: "guard", behavior: "avoid", walk: 52, run: 200, h: 98, w: 30, lift: 1.5, sound: "human", pitch: 0.8, says: ["HALT!", "NOT ON MY WATCH!", "CODE GREEN!"] },
    cat: { name: "Cat", points: 100, art: "cat", behavior: "erratic", walk: 64, run: 200, h: 40, w: 46, lift: 1.0, sound: "meow", says: ["MEOW?!", "HISSS!", "NOT COOL!"] },
    cowboy: { name: "Cowboy", points: 175, art: "cowboy", behavior: "flee", walk: 46, run: 170, h: 104, w: 30, lift: 1.4, sound: "human", pitch: 0.8, says: ["YEEHAW?!", "WHOA NELLY!", "DARN ALIENS!"] },
    tourist: { name: "Tourist", points: 150, art: "tourist", behavior: "wander", walk: 34, run: 140, h: 100, w: 30, lift: 1.4, sound: "human", pitch: 1.3, says: ["SAY CHEESE!", "FIVE STARS!", "BEST TRIP EVER!"], photo: true },
    office: { name: "Office Worker", points: 150, art: "office", behavior: "flee", walk: 56, run: 170, h: 96, w: 30, lift: 1.4, sound: "human", pitch: 1, says: ["MY MEETING!", "MY COFFEE!", "OUT OF OFFICE!"] },
    construction: { name: "Construction Worker", points: 175, art: "construction", behavior: "flee", walk: 44, run: 160, h: 98, w: 32, lift: 1.5, sound: "human", pitch: 0.75, says: ["HARD HAT AREA!", "HEY!", "ON BREAK!"] },
    pedestrian: { name: "Pedestrian", points: 125, art: "pedestrian", behavior: "wander", walk: 44, run: 160, h: 96, w: 30, lift: 1.3, sound: "human", pitch: 1.2, says: ["WAIT, WHAT?", "LOL WHAT?", "BRB!"], distracted: true },
    beachgoer: { name: "Beachgoer", points: 125, art: "beachgoer", behavior: "wander", walk: 34, run: 150, h: 96, w: 30, lift: 1.3, sound: "human", pitch: 1.25, says: ["MY TAN!", "RUDE!", "SUNBURN!"] },
    surfer: { name: "Surfer", points: 175, art: "surfer", behavior: "flee", walk: 50, run: 180, h: 96, w: 34, lift: 1.4, sound: "human", pitch: 1.05, says: ["GNARLY!", "TUBULAR!", "COWABUNGA?!"] },
    seagull: { name: "Seagull", points: 75, art: "seagull", behavior: "fast", walk: 100, run: 230, h: 44, w: 34, lift: 0.9, sound: "squawk", says: ["MINE!", "SQUAWK!", "MINE MINE!"], scale: 1.15 },
    crab: { name: "Crab", points: 100, art: "crab", behavior: "erratic", walk: 60, run: 170, h: 40, w: 48, lift: 1.0, sound: "clack", says: ["PINCH!", "SNIP SNIP!", "SHELL NO!"] },
    islander: { name: "Islander", points: 150, art: "islander", behavior: "flee", walk: 44, run: 165, h: 96, w: 30, lift: 1.4, sound: "human", pitch: 0.95, says: ["ALOHA?!", "NOT TODAY!", "MAHALO, NO!"] },
  };

  const PANIC_RANGE = 250;

  class Target {
    constructor(game, key, x, y) {
      this.game = game;
      this.key = key;
      this.type = TYPES[key];
      this.x = x;
      this.groundY = y;
      this.goalY = y;
      this.y = y;
      this.z = 0;
      this.zv = 0;
      this.vx = 0;
      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.goalX = x;
      this.state = "roam";
      this.stateT = 0;
      this.decide = U.rand(0.3, 2);
      this.sprint = 0;
      this.phase = U.rand(0, U.TAU);
      this.t = U.rand(0, 10);
      this.lift = 0;
      this.fallV = 0;
      this.bubble = "";
      this.bubbleT = 0;
      this.sayT = 0;
      this.blinkT = U.rand(1, 4);
      this.blink = 0;
      this.dead = false;
      this.leader = null;
      this.offX = 0;
      this.offY = 0;
      this.panicT = 0;
      this.dodgeCD = 0;
      this.photoCD = U.rand(1, 3);
      this.appear = 0;
      this.goneT = 0;
      this.pose = { t: 0, phase: 0, moving: false, panic: false, float: false, dizzy: false, blink: false, lx: 0, ly: 0 };
    }

    get scale() {
      return U.depthScale(this.groundY) * (this.type.scale || 1);
    }

    get capturable() {
      return this.state === "roam" || this.state === "panic" || this.state === "dizzy";
    }

    say(text, time = 1.1) {
      this.bubble = text;
      this.bubbleT = time;
    }

    update(dt, game) {
      this.t += dt;
      this.appear = Math.min(1, this.appear + dt * 3);
      this.bubbleT = Math.max(0, this.bubbleT - dt);
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blink = 0.12;
        this.blinkT = U.rand(2, 5);
      }
      this.blink = Math.max(0, this.blink - dt);
      const beam = game.beam;

      switch (this.state) {
        case "lifting":
          this.updateLift(dt, game);
          return;
        case "abducted":
          this.goneT += dt;
          this.x = U.damp(this.x, beam.ox, 12, dt);
          this.y = U.damp(this.y, beam.oy, 12, dt);
          if (this.goneT > 0.28) this.dead = true;
          return;
        case "falling":
          this.fallV += 1500 * dt;
          this.y += this.fallV * dt;
          if (this.y >= this.groundY) {
            this.y = this.groundY;
            if (this.fallV > 260) {
              this.fallV = -this.fallV * 0.32;
              game.particles.smoke(this.x, this.groundY, 4, "rgba(200, 180, 140, 0.7)");
            } else {
              this.state = "dizzy";
              this.stateT = 1.1;
              this.fallV = 0;
            }
          }
          return;
        case "dizzy":
          this.stateT -= dt;
          if (this.stateT <= 0) this.startPanic(2.5);
          break;
        default:
          this.think(dt, game);
      }

      if (this.capturable && beam.active) {
        const bodyY = this.y - this.type.h * 0.5 * this.scale;
        if (beam.contains(this.x, bodyY, this.type.w * 0.25 * this.scale)) this.startLift(game);
      }
    }

    startPanic(time) {
      if (this.state !== "panic") {
        this.say(this.type.behavior === "slow" ? "?!" : "!", 0.7);
        if (Math.random() < 0.35) this.game.audio.play(this.type.sound, { pitch: this.type.pitch });
      }
      this.state = "panic";
      this.panicT = time;
    }

    think(dt, game) {
      const p = game.player;
      const b = this.type.behavior;
      const speedMul = game.diff.targetSpeed;
      const dx = this.x - p.x;
      const near = p.alive && Math.abs(dx) < PANIC_RANGE && p.y > 230;
      this.dodgeCD = Math.max(0, this.dodgeCD - dt);
      this.photoCD = Math.max(0, this.photoCD - dt);

      if (this.state === "roam" && near) {
        let notice = dt * 3;
        if (b === "slow" || b === "wander") notice = dt * 0.9;
        if (this.type.distracted) notice = dt * 0.4;
        if (Math.random() < notice) {
          if (this.type.photo && this.photoCD <= 0 && Math.random() < 0.5) {
            this.photoCD = 4;
            this.say("SAY CHEESE!", 1);
            game.particles.burst(this.x + this.facing * 10, this.y - 50 * this.scale, 10, { speed: 120, life: 0.25, size: 8, color: "#ffffff" });
          } else {
            this.startPanic(U.rand(1.6, 2.8));
          }
        }
      }

      let speed = 0;
      if (this.state === "panic") {
        this.panicT -= dt;
        if (!near) this.panicT -= dt;
        if (this.panicT <= 0) {
          this.state = "roam";
          this.decide = U.rand(0.5, 1.5);
        }
        let dir = Math.sign(dx) || this.facing;
        speed = this.type.run;
        if (b === "slow" || b === "wander") speed = this.type.run * 0.8;
        if (b === "erratic" || b === "fast") {
          this.decide -= dt;
          if (this.decide <= 0) {
            this.decide = U.rand(0.25, 0.7);
            this.goalY = U.rand(U.FEET_MIN, U.FEET_MAX);
            this.jitterDir = Math.random() < 0.25 ? -dir : dir;
          }
          dir = this.jitterDir || dir;
        }
        if (b === "gallop" && !this.galloping) {
          this.galloping = Math.random() < 0.6;
          if (!this.galloping) speed = this.type.walk * 1.6;
        }
        if (b === "avoid" && game.beam.active && Math.abs(dx) < 110 && this.dodgeCD <= 0) {
          // Sidestep: a quick dash plus a change of depth.
          this.dodgeCD = 1.8;
          this.sprint = 0.5;
          this.goalY = this.groundY < (U.FEET_MIN + U.FEET_MAX) / 2 ? U.FEET_MAX - 10 : U.FEET_MIN + 10;
          this.say("NOPE!", 0.7);
        }
        if (this.sprint > 0) speed *= 1.6;
        this.vx = dir * speed * speedMul;
      } else {
        this.galloping = false;
        this.decide -= dt;
        if (this.leader && !this.leader.dead && this.leader.capturable && b === "flock") {
          this.goalX = this.leader.x + this.offX;
          this.goalY = U.clamp(this.leader.groundY + this.offY, U.FEET_MIN, U.FEET_MAX);
          if (this.leader.state === "panic") this.startPanic(1.5);
        } else if (this.decide <= 0) {
          this.chooseGoal(b);
        }
        const gap = this.goalX - this.x;
        if (Math.abs(gap) > 6) {
          speed = this.type.walk;
          if (this.sprint > 0) speed = this.type.run;
          if (b === "flock" && Math.abs(gap) > 40) speed *= 1.5;
          this.vx = Math.sign(gap) * speed * speedMul;
        } else {
          this.vx = 0;
        }
      }
      this.sprint = Math.max(0, this.sprint - dt);

      // Goats hop.
      if (b === "jumpy" && this.z <= 0 && Math.abs(this.vx) > 5 && Math.random() < dt * 2.5) this.zv = U.rand(220, 320);
      if (this.zv !== 0 || this.z > 0) {
        this.zv -= 1100 * dt;
        this.z += this.zv * dt;
        if (this.z <= 0) {
          this.z = 0;
          this.zv = 0;
        }
      }

      this.x += this.vx * dt;
      if (this.x < 30) {
        this.x = 30;
        this.vx = Math.abs(this.vx);
        this.goalX = this.x + 200;
        this.jitterDir = 1;
      } else if (this.x > U.WORLD_W - 30) {
        this.x = U.WORLD_W - 30;
        this.vx = -Math.abs(this.vx);
        this.goalX = this.x - 200;
        this.jitterDir = -1;
      }
      this.groundY = U.approach(this.groundY, this.goalY, (this.state === "panic" ? 60 : 22) * dt);
      this.y = this.groundY - this.z;
      if (Math.abs(this.vx) > 2) this.facing = Math.sign(this.vx);
      this.phase += dt * (6 + Math.abs(this.vx) * 0.07);
    }

    chooseGoal(b) {
      const rest = { slow: 0.45, wander: 0.35, runs: 0.3, flee: 0.3, jumpy: 0.2, erratic: 0.15, fast: 0.2, gallop: 0.35, flock: 0.3, run: 0.05, avoid: 0.3 }[b] || 0.3;
      if (Math.random() < rest) {
        this.goalX = this.x;
        this.decide = U.rand(1, 2.5);
        return;
      }
      let reach = 260;
      if (b === "erratic" || b === "fast") reach = 160;
      if (b === "run") reach = 700;
      this.goalX = U.clamp(this.x + U.rand(-reach, reach), 40, U.WORLD_W - 40);
      this.goalY = U.rand(U.FEET_MIN, U.FEET_MAX);
      this.decide = U.rand(1.2, 3.5);
      if ((b === "runs" || b === "fast") && Math.random() < 0.3) this.sprint = U.rand(0.6, 1.4);
    }

    startLift(game) {
      this.state = "lifting";
      this.lift = 0;
      this.z = 0;
      this.liftFrom = this.groundY;
      this.sayT = 0;
      this.say(U.pick(this.type.says), 1.2);
      game.audio.play(this.type.sound, { pitch: this.type.pitch });
    }

    updateLift(dt, game) {
      const beam = game.beam;
      if (!beam.active) {
        this.drop(game);
        return;
      }
      this.lift = Math.min(1, this.lift + dt / this.type.lift);
      this.x = U.damp(this.x, beam.ox, 4.5, dt);
      const e = U.easeInOut(this.lift);
      this.y = U.lerp(this.liftFrom, beam.oy + 8, e);
      const bodyY = this.y - this.type.h * 0.5 * this.scale;
      // Fly away too fast and it slips out of the side of the beam.
      if (Math.abs(this.x - beam.ox) > beam.halfWidthAt(bodyY) + 34 || bodyY > beam.oy + beam.length + 30) {
        this.drop(game);
        return;
      }
      this.sayT -= dt;
      if (this.sayT <= 0) {
        this.sayT = 0.9;
        if (this.lift > 0.2) this.say(U.pick(this.type.says), 0.8);
      }
      if (this.lift >= 1) {
        this.state = "abducted";
        this.goneT = 0;
        game.onAbduct(this);
      }
    }

    drop(game) {
      this.state = "falling";
      this.fallV = 0;
      this.groundY = this.liftFrom;
      this.goalY = this.groundY;
      this.say(this.lift > 0.5 ? "OOF!" : "PHEW!", 0.9);
      game.audio.play("drop");
    }

    draw(ctx, t) {
      const s = this.scale;
      const p = this.game.player;
      const lifted = this.state === "lifting" || this.state === "abducted" || this.state === "falling";
      const height = this.groundY - this.y;
      U.Draw.shadow(ctx, this.x, this.groundY, (this.type.w * 0.42) * s * Math.max(0.3, 1 - height / 400), 0.22);

      let k = s * (0.6 + 0.4 * U.easeOutBack(this.appear));
      if (this.state === "abducted") k *= Math.max(0.05, 1 - this.goneT / 0.28);
      else if (this.state === "lifting" && this.lift > 0.75) k *= 1 - (this.lift - 0.75) * 1.6;

      const pose = this.pose;
      pose.t = this.t;
      pose.phase = this.phase;
      pose.moving = Math.abs(this.vx) > 3 && !lifted;
      pose.panic = this.state === "panic";
      pose.float = this.state === "lifting" || this.state === "abducted" || (this.state === "falling" && this.fallV < 0);
      pose.dizzy = this.state === "dizzy";
      pose.blink = this.blink > 0;
      const toUfo = p.x - this.x;
      pose.lx = U.clamp((toUfo / 200) * this.facing, -1, 1);
      pose.ly = -0.6;

      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.state === "lifting") ctx.rotate(Math.sin(this.t * 5) * 0.22);
      if (this.state === "falling") ctx.rotate(Math.sin(this.t * 12) * 0.3);
      ctx.scale(this.facing * k, k);
      U.Art.drawCharacter(ctx, this.type.art, pose);
      ctx.restore();

      if (this.state === "dizzy") U.Draw.dizzyStars(ctx, this.x, this.y - this.type.h * s - 4, 16, t);
      if (this.bubbleT > 0 && this.state !== "abducted") {
        U.Draw.bubble(ctx, this.x + 6, this.y - this.type.h * k - 4, this.bubble, { size: 15 });
      }
    }
  }

  U.TARGET_TYPES = TYPES;
  U.Target = Target;
})(window.UFO);
