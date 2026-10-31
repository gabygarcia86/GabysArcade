/*
 * Player: the Jedi. Movement, the saber combo, Force Push and the Deflect stance
 * all live here, plus everything that can happen to the Jedi in return.
 */
(function (J) {
  const { clamp, lerp, approach } = J.U;
  const { Art, Lightsaber, ForceAbility, Actor, Combat } = J;
  const PHYS = J.PHYS;

  const ATTACKS = [
    { pose: "slash1", dur: 0.27, from: 0.08, to: 0.2, dmg: 10, knock: 130, reach: 72, step: 70 },
    { pose: "slash2", dur: 0.27, from: 0.08, to: 0.2, dmg: 10, knock: 130, reach: 72, step: 70 },
    { pose: "slash3", dur: 0.36, from: 0.1, to: 0.26, dmg: 18, knock: 270, reach: 82, step: 120, finisher: true },
    { pose: "slash4", dur: 0.48, from: 0.08, to: 0.4, dmg: 24, knock: 340, reach: 92, step: 150, around: true, finisher: true },
  ];
  const AIR_SLASH = { pose: "airslash", dur: 0.3, from: 0.05, to: 0.2, dmg: 12, knock: 150, reach: 76, step: 0, low: true };
  const AIR_SPIN = { pose: "airspin", dur: 0.42, from: 0.04, to: 0.38, dmg: 14, knock: 180, reach: 80, step: 0, around: true };

  class Player extends Actor {
    constructor(game, jedi) {
      super(0, 0, 24, 62);
      this.game = game;
      this.jedi = jedi;
      this.skin = Art.jediSkin(jedi);
      this.saber = new Lightsaber(jedi.saber, jedi.saberType);
      this.has = (id) => game.save.hasAbility(id);
      this.force = new ForceAbility(this);
      this.trail = [];
      this.maxHp = 100;
      this.lives = 3;
      this.reset();
    }

    reset() {
      this.hp = this.maxHp;
      this.maxEnergy = this.has("forcePlus") ? 150 : 100;
      this.energy = this.maxEnergy;
      this.vx = 0;
      this.vy = 0;
      this.dead = false;
      this.deadT = 0;
      this.invuln = 0;
      this.hurtT = 0;
      this.animT = 0;
      this.attack = null;
      this.comboIndex = 0;
      this.comboTimer = 0;
      this.attackBuffer = 0;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.jumpsUsed = 0;
      this.jumping = false;
      this.airCount = 0;
      this.pushT = 0;
      this.deflecting = false;
      this.deflectT = 0;
      this.deflectLock = 0;
      this.deflectHit = 0;
      this.capeSwing = 0;
      this.frozen = false;
      this.scriptPose = null;
      this.choke = null;
      this.ground = null;
      this.onGround = false;
      this.safe = null;
      this.safeTimer = 0;
      this.saber.power = 1;
      this.trail.length = 0;
      this.force.waves.length = 0;
      this.force.cooldown = 0;
      this.dropThrough = false;
    }

    get regen() {
      const base = this.has("forcePlus") ? 15 : 10;
      return this.has("forceMaster") ? base * 1.3 : base;
    }

    get perfectWindow() { return this.has("deflectPlus") ? 0.32 : 0.2; }

    get comboLength() {
      if (this.has("combo4")) return 4;
      return this.has("combo3") ? 3 : 2;
    }

    placeAt(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.ground = null;
    }

    update(dt, input) {
      const { game } = this;
      this.animT += dt;
      this.invuln = Math.max(0, this.invuln - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.pushT = Math.max(0, this.pushT - dt);
      this.deflectLock = Math.max(0, this.deflectLock - dt);
      this.deflectHit = Math.max(0, this.deflectHit - dt);
      this.attackBuffer = Math.max(0, this.attackBuffer - dt);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.coyote = Math.max(0, this.coyote - dt);
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0 && !this.attack) this.comboIndex = 0;
      this.force.update(dt);
      this.updateTrail(dt);

      if (this.dead) {
        this.deadT += dt;
        this.vx = approach(this.vx, 0, 500 * dt);
        this.physics(game.level, dt);
        if (this.deadT > 1.7) game.onPlayerDeathFinished();
        return;
      }

      if (this.choke) {
        this.updateChoke(dt, input);
        return;
      }

      if (this.frozen) {
        this.deflecting = false;
        this.attack = null;
        this.vx = approach(this.vx, 0, 1600 * dt);
        this.physics(game.level, dt);
        this.capeSwing = lerp(this.capeSwing, 0, 1 - Math.pow(0.01, dt));
        return;
      }

      this.energy = Math.min(this.maxEnergy, this.energy + this.regen * dt * (this.deflecting ? 0 : 1));

      this.handleDeflect(dt, input);
      this.handleMove(dt, input);
      this.handleJump(dt, input);
      this.handleAttack(dt, input);

      if (input.pressed("push") && !this.deflecting && this.hurtT === 0) {
        if (this.force.cast()) {
          this.pushT = 0.38;
          this.attack = null;
        } else if (this.energy < this.force.stats.cost) {
          game.hud.flashEnergy();
        }
      }

      const wasGround = this.onGround;
      const fallSpeed = this.vy;
      this.dropThrough = input.isDown("down") && input.isDown("jump");
      const floating = this.attack && this.attack.spec === AIR_SPIN;
      this.physics(game.level, dt, floating ? 0.3 : 1);
      if (this.onGround) {
        this.jumpsUsed = 0;
        this.airCount = 0;
        this.jumping = false;
        this.coyote = 0.1;
        if (!wasGround && fallSpeed > 260) {
          game.audio.play("land", clamp(fallSpeed / 800, 0.3, 1));
          game.particles.dust(this.x, this.y, game.level.theme.dust, 5);
        }
        this.trackSafeSpot(dt);
      }

      this.capeSwing = lerp(this.capeSwing, clamp(this.vx / 250, -1, 1) * (this.facing || 1) + (this.onGround ? 0 : clamp(-this.vy / 900, -0.4, 0.4)), 1 - Math.pow(0.002, dt));
      game.audio.setHum(clamp(Math.abs(this.vx) / 250 + (this.attack ? 1 : 0), 0, 1.4));
    }

    // Remembers solid ground to come back to after a fall.
    trackSafeSpot(dt) {
      this.safeTimer -= dt;
      const g = this.ground;
      if (this.safeTimer > 0 || !g || g.mover || g.crumble || g.isBridge) return;
      if (this.x - 40 < g.x || this.x + 40 > g.x + g.w) return;
      this.safe = { x: this.x, y: this.y };
      this.safeTimer = 0.25;
    }

    handleMove(dt, input) {
      let dir = 0;
      if (input.isDown("left")) dir -= 1;
      if (input.isDown("right")) dir += 1;
      const iced = this.ground && this.ground.ice;
      const canSteer = this.hurtT < 0.14 && !(this.attack && this.onGround && !this.attack.spec.around);
      const stance = this.deflecting;
      if (stance) {
        if (dir) this.facing = dir;
        dir = 0;
      }

      if (canSteer) {
        const accel = this.onGround ? (iced ? 520 : 2400) : 1500;
        this.vx = approach(this.vx, dir * PHYS.RUN, accel * dt);
        if (dir && !this.attack) this.facing = dir;
      } else if (this.onGround && this.hurtT === 0) {
        this.vx = approach(this.vx, 0, (iced ? 300 : 1500) * dt);
      }
    }

    handleJump(dt, input) {
      const { game } = this;
      if (input.pressed("jump")) this.jumpBuffer = 0.12;
      if (this.jumpBuffer > 0 && !this.deflecting) {
        const grounded = this.onGround || this.coyote > 0;
        if (grounded && this.jumpsUsed === 0) {
          this.jumpBuffer = 0;
          this.coyote = 0;
          this.vy = -PHYS.JUMP;
          this.ground = null;
          this.onGround = false;
          this.jumpsUsed = 1;
          this.jumping = true;
          this.attack = this.attack && this.attack.spec.around ? this.attack : null;
          game.audio.play("jump");
          game.particles.dust(this.x, this.y, game.level.theme.dust, 4);
        } else if (this.has("doubleJump") && this.jumpsUsed < 2 && !grounded) {
          this.jumpBuffer = 0;
          this.jumpsUsed = 2;
          this.vy = -PHYS.DOUBLE_JUMP;
          this.jumping = true;
          game.audio.play("jump", 1.3);
          game.particles.forceRing(this.x, this.y - 6, this.saber.fxPick(), 20);
        }
      }
      // Letting go early cuts the jump short, so a tap is a small hop.
      if (this.jumping && !input.isDown("jump") && this.vy < -200) {
        this.vy *= 0.5;
        this.jumping = false;
      }
    }

    handleAttack(dt, input) {
      const { game } = this;
      if (input.pressed("attack")) this.attackBuffer = 0.16;

      if (this.attack) {
        const a = this.attack;
        a.t += dt;
        const spec = a.spec;
        if (a.t >= spec.from && a.t <= spec.to) {
          Combat.saberSweep(game, this.attackBox(spec), {
            dmg: spec.dmg, knock: spec.knock, dir: this.facing, source: "saber", finisher: spec.finisher, stun: spec.finisher ? 0.5 : 0.28,
          }, a.struck);
        }
        const canChain = a.t > spec.dur * 0.55;
        if (a.t >= spec.dur) this.attack = null;
        else if (!(canChain && this.attackBuffer > 0)) return;
        else if (!this.onGround && !this.has("aerial")) return;
      }

      if (this.attackBuffer > 0 && !this.deflecting && this.pushT === 0 && this.hurtT === 0) {
        if (this.onGround) {
          if (this.comboIndex >= this.comboLength) this.comboIndex = 0;
          this.startAttack(ATTACKS[this.comboIndex]);
          this.comboIndex++;
          this.comboTimer = 0.42;
        } else if (this.has("aerial")) {
          if (this.airCount < 3) {
            this.airCount++;
            if (this.vy > -80) this.vy = -80;
            this.startAttack(AIR_SPIN);
          }
        } else if (this.airCount < 1) {
          this.airCount++;
          this.startAttack(AIR_SLASH);
        }
      }
    }

    startAttack(spec) {
      const { game } = this;
      this.attackBuffer = 0;
      this.attack = { spec, t: 0, struck: new Set() };
      this.trail.length = 0;
      if (spec.step && this.onGround) this.vx = this.facing * spec.step;
      game.audio.play("swing");
    }

    attackBox(spec) {
      const reach = spec.reach;
      const double = this.saber.type === "double";
      if (spec.around) return { x: this.x - reach, y: this.y - 92, w: reach * 2, h: 112 };
      // A double blade trades a little reach for catching what's behind you.
      const front = double ? reach - 6 : reach;
      const back = double ? 42 : 8;
      const y = spec.low ? this.y - 60 : this.y - 84;
      return {
        x: this.facing > 0 ? this.x - back : this.x - front,
        y,
        w: front + back,
        h: spec.low ? 88 : 92,
      };
    }

    handleDeflect(dt, input) {
      const { game } = this;
      const wants = input.isDown("deflect") && this.deflectLock === 0 && !this.attack && this.hurtT === 0;
      if (wants && !this.deflecting && this.energy > 4) {
        this.deflecting = true;
        this.deflectT = 0;
        game.audio.play("swing", 0.5);
      } else if (this.deflecting && !wants) {
        this.deflecting = false;
        this.deflectLock = 0.1;
      }
      if (this.deflecting) {
        this.deflectT += dt;
        this.energy = Math.max(0, this.energy - 6 * dt);
        if (this.energy <= 0) {
          this.deflecting = false;
          this.deflectLock = 0.6;
        }
      }
    }

    get isPerfect() { return this.deflecting && this.deflectT <= this.perfectWindow; }

    // Returns "deflected", "hit" or "ignored" so the projectile knows what to do next.
    receiveProjectile(p) {
      const { game } = this;
      if (this.invuln > 0 && this.hurtT === 0) return "ignored";
      const fromFront = p.vx * this.facing < 0;
      if (this.deflecting && fromFront && p.deflectable) {
        const perfect = this.isPerfect;
        let target = null;
        if (perfect) target = p.owner && !p.owner.dead ? p.owner : Combat.nearestEnemy(game, this.x, this.y, 700);
        p.reflect(target, perfect);
        p.x = this.x + this.facing * 26;
        this.deflectHit = 0.14;
        const color = this.saber.fxPick();
        game.particles.sparks(p.x, p.y, color, perfect ? 16 : 8, 240);
        game.particles.hitFlash(p.x, p.y, color);
        if (perfect) {
          this.energy = Math.min(this.maxEnergy, this.energy + 12);
          if (this.has("deflectPlus")) p.homing = 10;
          game.audio.play("perfect");
          game.particles.text(this.x, this.y - 82, "PERFECT", "#ffe680", 15);
          game.stats.perfects++;
          if (p.owner && p.owner.stagger) p.owner.stagger(0.5);
        } else {
          this.energy = Math.max(0, this.energy - 5);
          game.audio.play("deflect");
        }
        return "deflected";
      }
      this.takeDamage(p.dmg, Math.sign(p.vx) || 1, { knock: 160 });
      return "hit";
    }

    // A strike from something close. Timing the stance parries it outright.
    receiveMelee({ dmg, dir, unblockable, source, knock = 240 }) {
      const { game } = this;
      if (this.invuln > 0) return "ignored";
      const facingAttacker = this.facing === -dir;
      if (this.deflecting && facingAttacker && !unblockable) {
        const color = this.saber.fxPick();
        const px = this.x + this.facing * 30;
        game.particles.sparks(px, this.y - 50, color, 18, 280);
        game.particles.hitFlash(px, this.y - 50, color);
        this.deflectHit = 0.18;
        game.audio.play("clash");
        game.camera.shake(4, 0.14);
        if (this.isPerfect) {
          game.audio.play("perfect");
          game.particles.text(this.x, this.y - 82, "PARRY", "#ffe680", 15);
          game.stats.perfects++;
          this.energy = Math.min(this.maxEnergy, this.energy + 10);
          if (source && source.parried) source.parried();
          return "parried";
        }
        this.energy = Math.max(0, this.energy - 8);
        this.takeDamage(dmg * 0.25, dir, { knock: 70, quiet: true, noFlinch: true });
        return "blocked";
      }
      this.takeDamage(dmg, dir, { knock });
      return "hit";
    }

    takeDamage(amount, dir = 0, { knock = 180, quiet = false, noFlinch = false, ignoreInvuln = false } = {}) {
      const { game } = this;
      if (this.dead || (this.invuln > 0 && !ignoreInvuln)) return false;
      this.hp -= amount * game.damageScale;
      if (!noFlinch) {
        this.invuln = 0.95;
        this.hurtT = 0.3;
        this.deflecting = false;
        this.attack = null;
        this.vx = dir * knock;
        this.vy = Math.min(this.vy, -170);
        this.onGround = false;
        this.ground = null;
      }
      game.stats.damageTaken += amount;
      game.hud.flashDamage();
      if (!quiet) {
        game.audio.play("hurt");
        game.camera.shake(6, 0.2);
      }
      if (this.hp <= 0) this.die();
      return true;
    }

    die() {
      const { game } = this;
      this.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.deflecting = false;
      this.attack = null;
      this.choke = null;
      game.audio.play("saberOff");
      game.stats.deaths++;
      game.hitStop(0.12);
    }

    // Falling in a pit costs health and puts you back on the last safe ground.
    fellInPit() {
      const { game } = this;
      if (this.dead) return;
      const spot = this.safe || game.level.checkpoint;
      this.hp -= 25 * game.damageScale;
      game.hud.flashDamage();
      game.audio.play("hurt");
      if (this.hp <= 0) {
        this.placeAt(spot.x, spot.y);
        this.die();
        return;
      }
      this.placeAt(spot.x, spot.y);
      this.invuln = 1.5;
      game.camera.snap(this);
      game.particles.forceRing(this.x, this.y - 30, this.saber.fxPick(), 50);
    }

    respawn(point) {
      this.reset();
      this.placeAt(point.x, point.y);
      this.invuln = 2;
      this.game.particles.forceRing(this.x, this.y - 30, this.saber.fxPick(), 60);
      this.game.audio.play("saberOn");
    }

    heal(amount) {
      this.hp = Math.min(this.maxHp, this.hp + amount);
    }

    // ---------- Held by the Force ----------

    startChoke({ dps, escape, source }) {
      if (this.choke || this.dead || this.invuln > 0) return false;
      this.choke = { t: 0, dps, escape, mash: 0, source, startY: this.y };
      this.deflecting = false;
      this.attack = null;
      this.vx = 0;
      this.vy = 0;
      this.game.audio.play("choke");
      return true;
    }

    updateChoke(dt, input) {
      const { game } = this;
      const c = this.choke;
      c.t += dt;
      this.y = lerp(this.y, c.startY - 58, 1 - Math.pow(0.02, dt));
      this.hp -= c.dps * game.damageScale * dt;
      if (Math.random() < dt * 8) game.hud.flashDamage();
      for (const action of ["attack", "jump", "push", "deflect"]) {
        if (input.pressed(action)) {
          c.mash++;
          game.particles.sparks(this.x, this.y - 40, this.saber.fxPick(), 3, 120);
        }
      }
      if (this.hp <= 0) {
        this.die();
        return;
      }
      if (c.mash >= c.escape || c.t > 3.5) this.releaseChoke();
    }

    releaseChoke() {
      const c = this.choke;
      this.choke = null;
      this.invuln = 1;
      this.vy = 40;
      if (c && c.source && c.source.onChokeEnd) c.source.onChokeEnd();
    }

    // ---------- Drawing ----------

    updateTrail(dt) {
      for (const point of this.trail) point.life -= dt;
      while (this.trail.length && this.trail[0].life <= 0) this.trail.shift();
      if (this.attack && !this.dead) {
        const p = this.currentPose(this.animT);
        const j = Art.joints(p);
        const tip = Art.saberTip(p, this.x, this.y, this.facing, this.saber.length);
        this.trail.push({ x0: this.x + j.fHx * this.facing, y0: this.y + j.fHy, x1: tip.x, y1: tip.y, life: 0.14 });
        if (this.trail.length > 12) this.trail.shift();
      }
    }

    currentPose(t) {
      if (this.scriptPose) return Art.pose(this.scriptPose, this.scriptT === undefined ? t : this.scriptT);
      if (this.dead) return Art.pose("dead", this.deadT);
      if (this.choke) return Art.pose("choked", t);
      if (this.attack) return Art.pose(this.attack.spec.pose, this.attack.t / this.attack.spec.dur);
      if (this.hurtT > 0) return Art.pose("hurt", t);
      if (this.deflectHit > 0) return Art.pose("deflectHit", 1 - this.deflectHit / 0.18);
      if (this.deflecting) return Art.pose("deflect", t);
      if (this.pushT > 0) return Art.pose("push", 1 - this.pushT / 0.38);
      if (!this.onGround) return Art.pose(this.vy < 0 ? "jump" : "fall", t);
      if (Math.abs(this.vx) > 26) return Art.pose("run", t);
      return Art.pose("idle", t);
    }

    drawTrail(ctx) {
      const { trail } = this;
      if (trail.length < 2) return;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = this.saber.fxColor();
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1];
        const b = trail[i];
        ctx.globalAlpha = 0.34 * (i / trail.length);
        ctx.beginPath();
        ctx.moveTo(a.x0 * 0.4 + a.x1 * 0.6, a.y0 * 0.4 + a.y1 * 0.6);
        ctx.lineTo(a.x1, a.y1);
        ctx.lineTo(b.x1, b.y1);
        ctx.lineTo(b.x0 * 0.4 + b.x1 * 0.6, b.y0 * 0.4 + b.y1 * 0.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    draw(ctx, t) {
      if (this.invuln > 0 && this.hurtT === 0 && !this.dead && Math.floor(t * 18) % 2 === 0) ctx.globalAlpha = 0.5;
      this.drawTrail(ctx);
      if (this.deflecting) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = this.isPerfect ? 0.34 : 0.13;
        ctx.fillStyle = this.saber.fxColor(t);
        ctx.beginPath();
        ctx.arc(this.x + this.facing * 20, this.y - 46, 42, 0, J.TAU);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
      Art.jedi(ctx, this.skin, this.saber, this.x, this.y, this.facing, this.currentPose(t), t, this.capeSwing);
      ctx.globalAlpha = 1;
      this.force.draw(ctx, t);
      if (this.choke) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#ff3a3a";
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(this.x, this.y - 60, 13 + i * 4 + Math.sin(t * 20) * 2, 0, J.TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  J.Player = Player;
})(window.JEDI);
