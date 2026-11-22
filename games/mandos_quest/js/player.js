/* The Mandalorian: movement, health and animation. */
(function (MQ) {
  const { clamp, approach, damp, glow, oval } = MQ.U;
  const { abs, sign, max } = Math;
  const P = MQ.DATA.PHYSICS;

  const WIDTH = 32;
  const HEIGHT = 82;
  const STEP_HEIGHT = 24;
  const STRIDE = 0.034;
  const DODGE_SAFE = 0.38;
  const HIT_SAFE = 0.95;
  const DROP_TIME = 0.22;

  class Player {
    constructor(world, x, y) {
      this.world = world;
      this.w = WIDTH;
      this.h = HEIGHT;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.grounded = false;
      this.ground = null;
      this.wall = 0;
      this.hp = world.stats.maxHp;
      this.safeX = x;
      this.safeY = y;
      this.time = 0;
      this.animTime = 0;
      this.anim = "idle";
      this.phase = 0;
      this.moveOptions = { step: STEP_HEIGHT, drop: false };
      this.arms = { action: null, k: 0, variant: 0, angle: 0 };
      this.actor = {
        look: world.look, pose: MQ.Anim.createPose(), time: 0, flow: 0, lift: 0,
        jetpack: false, thrust: 0, weapon: "blaster", saber: null, power: 0,
      };
      this.resetTimers();
      this.jetpack = new MQ.Jetpack(world, world.stats.jetpack);
      this.weapons = new MQ.WeaponManager(world, this);
    }

    resetTimers() {
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumping = false;
      this.dropTime = 0;
      this.dodgeTime = 0;
      this.dodgeWait = 0;
      this.safeTime = 0;
      this.hurtTime = 0;
      this.landTime = 0;
      this.slowTime = 0;
      this.disruptTime = 0;
      this.deadTime = 0;
      this.victory = false;
      this.dead = false;
      this.sinking = false;
    }

    get maxHp() {
      return this.world.stats.maxHp;
    }

    get dodging() {
      return this.dodgeTime > 0;
    }

    get invulnerable() {
      return this.safeTime > 0 || this.dead || this.victory || this.world.frozen;
    }

    get locked() {
      return this.dead || this.victory || this.hurtTime > 0 || this.world.frozen;
    }

    get disabled() {
      return this.locked || this.dodgeTime > 0 || this.disruptTime > 0;
    }

    update(input, dt) {
      this.time += dt;
      this.coyote -= dt;
      this.jumpBuffer -= dt;
      this.dropTime -= dt;
      this.dodgeTime -= dt;
      this.dodgeWait -= dt;
      this.safeTime -= dt;
      this.hurtTime -= dt;
      this.landTime -= dt;
      this.slowTime -= dt;
      this.disruptTime -= dt;
      if (this.dead) this.deadTime += dt;

      // Queued presses are always consumed, so none fire late when control returns.
      const jumpPressed = input.take("jump");
      const attackPressed = input.take("attack");
      const forcePressed = input.take("force");
      const switchPressed = input.take("switch");
      const dodgePressed = input.take("dodge");
      const tapDodge = input.takeTapDodge();
      const downPressed = input.take("down");
      const { locked } = this;
      const axis = locked ? 0 : input.axis();
      const jumpHeld = !locked && input.held.jump;

      if (!locked) {
        if (switchPressed) this.weapons.next();
        if (forcePressed) this.world.force.use();
        if ((dodgePressed || tapDodge) && this.dodgeWait <= 0 && !this.sinking) this.dodge(tapDodge || axis || this.facing);
        if (jumpPressed) this.jumpBuffer = P.jumpBuffer;
        if (downPressed && this.grounded && this.ground?.oneWay) this.dropTime = DROP_TIME;
      }

      this.steer(axis, dt);

      let jumped = false;
      if (!locked && this.jumpBuffer > 0 && (this.grounded || this.coyote > 0 || this.sinking) && this.dropTime <= 0) {
        this.jump();
        jumped = true;
      }
      if (this.jumping && !jumpHeld && this.vy < 0) {
        if (!this.jetpack.on) this.vy *= P.jumpCut;
        this.jumping = false;
      }

      this.jetpack.update(this, jumpHeld, jumpPressed && !jumped && this.coyote <= 0, dt);
      this.weapons.update(!locked && input.held.attack, !locked && attackPressed, dt);

      const gravity = this.sinking ? P.gravity * 0.3 : P.gravity;
      this.vy = Math.min(this.vy + gravity * dt, this.sinking ? 55 : P.maxFall);

      const wasGrounded = this.grounded;
      const fallSpeed = this.vy;
      this.moveOptions.drop = this.dropTime > 0;
      this.world.col.move(this, dt, this.moveOptions);
      this.world.col.unstick(this);

      if (this.grounded) {
        this.coyote = P.coyote;
        this.jumping = false;
        if (!wasGrounded && fallSpeed > 260) this.land(fallSpeed);
      }
      this.animate(dt);
    }

    steer(axis, dt) {
      if (this.dodging) {
        this.vx = this.dodgeDirection * P.dodgeSpeed;
        return;
      }
      if (axis) this.facing = axis;
      const slow = this.sinking ? 0.4 : this.slowTime > 0 ? 0.55 : 1;
      const top = P.run * slow * (this.jetpack.on ? 1.15 : 1);
      const target = axis * top;
      let rate;
      if (!axis) rate = this.grounded ? P.groundFriction : P.airFriction;
      else rate = this.grounded ? P.groundAccel : P.airAccel;
      if (this.hurtTime > 0) rate = 500;
      this.vx = approach(this.vx, target, rate * dt);
    }

    jump() {
      this.vy = this.sinking ? -P.jump * 0.7 : -P.jump;
      this.grounded = false;
      this.ground = null;
      this.jumping = true;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.dodgeTime = 0;
      this.world.sfx("jump");
      this.world.particles.dust(this.x, this.y, this.world.dustColor, 4);
    }

    land(speed) {
      this.landTime = speed > 700 ? 0.16 : 0.07;
      this.world.sfx("land");
      this.world.particles.dust(this.x, this.y, this.world.dustColor, speed > 700 ? 10 : 4, speed > 700 ? 170 : 90);
      if (speed > 950) this.world.camera.shake(0.2);
    }

    dodge(direction) {
      this.dodgeDirection = direction;
      this.facing = direction;
      this.dodgeTime = P.dodgeTime;
      this.dodgeWait = P.dodgeCooldown;
      this.safeTime = max(this.safeTime, DODGE_SAFE);
      if (!this.grounded) this.vy = Math.min(this.vy, 0);
      this.world.sfx("dodge");
      this.world.particles.dust(this.x, this.y, this.world.dustColor, 7);
    }

    // Returns false when the hit doesn't connect.
    hurt(amount, fromX, knock = 220) {
      if (this.invulnerable) return false;
      const { world } = this;
      const damage = Math.max(1, Math.round(amount * world.stats.armor * world.difficulty.hurt));
      this.hp = max(0, this.hp - damage);
      this.safeTime = HIT_SAFE;
      if (knock) {
        this.hurtTime = 0.2;
        this.vx = (sign(this.x - fromX) || -this.facing) * knock;
        this.vy = Math.min(this.vy, -240);
        this.jumping = false;
      }
      world.particles.sparks(this.x, this.y - 50, "#ff8a70", 10);
      world.particles.label(this.x, this.y - 104, `-${damage}`, "#ff8a70");
      world.camera.shake(0.36);
      world.sfx("hurt");
      world.baby.react("worried", 1.6);
      if (!this.hp) {
        this.dead = true;
        this.jetpack.on = false;
        this.jetpack.thrust = 0;
        world.playerDied();
      }
      return true;
    }

    heal(amount) {
      const gained = Math.round(Math.min(amount, this.maxHp - this.hp));
      this.hp += gained;
      return gained;
    }

    disrupt() {
      this.disruptTime = 1.1;
      this.jetpack.drain(0.5);
      this.world.particles.label(this.x, this.y - 120, "WEAPONS JAMMED", "#66d9ff", 15);
    }

    slow() {
      this.slowTime = 1.6;
    }

    // Returns to solid ground after a fall.
    recover(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.grounded = false;
      this.ground = null;
      this.jumping = false;
      this.dodgeTime = 0;
      this.sinking = false;
      this.jetpack.refill();
      this.world.col.unstick(this);
    }

    respawn(x, y) {
      this.resetTimers();
      this.recover(x, y);
      this.safeX = x;
      this.safeY = y;
      this.hp = this.maxHp;
      this.safeTime = 1.5;
      this.weapons.refill();
    }

    animate(dt) {
      let anim;
      if (this.dead) anim = "dead";
      else if (this.victory && this.grounded) anim = "victory";
      else if (this.dodging) anim = "dodge";
      else if (this.hurtTime > 0) anim = "hurt";
      else if (this.jetpack.on) anim = "fly";
      else if (!this.grounded) anim = this.vy < 0 ? "jump" : "fall";
      else if (abs(this.vx) > 210) anim = "run";
      else if (abs(this.vx) > 20) anim = "walk";
      else if (this.landTime > 0) anim = "land";
      else anim = "idle";

      if (anim !== this.anim) {
        this.anim = anim;
        this.animTime = 0;
      }
      this.animTime += dt;

      const previous = this.phase;
      if (this.grounded) {
        this.phase += abs(this.vx) * STRIDE * (anim === "walk" ? 1.5 : 1) * dt;
        const stepped = Math.floor(previous / Math.PI) !== Math.floor(this.phase / Math.PI);
        if (stepped && anim === "run") this.world.particles.dust(this.x - this.facing * 10, this.y, this.world.dustColor, 1, 40);
      }

      const { actor } = this;
      actor.time = this.time;
      actor.flow = damp(actor.flow, clamp((this.vx * this.facing) / P.run, -0.25, 1), 7, dt);
      actor.lift = damp(actor.lift, clamp(this.vy / 600, -0.3, 1), 6, dt);
    }

    draw(ctx) {
      const { world, actor, arms, weapons } = this;
      actor.look = world.look;
      actor.jetpack = !!world.stats.jetpack;
      actor.thrust = this.jetpack.thrust;
      actor.weapon = weapons.current.id;
      actor.saber = MQ.DATA.saber(world.save.saberColor);
      actor.power = weapons.charge;

      const busy = this.dead || this.victory || this.dodging || this.hurtTime > 0;
      if (busy) arms.action = null;
      else weapons.pose(arms);
      MQ.Anim.human(actor.pose, this.anim, this.time, this.phase, this.animTime, arms.action, arms.k, arms.variant, arms.angle);

      if (this.grounded) oval(ctx, this.x, this.y + 1, 25, 5, "rgba(0,0,0,0.25)");
      weapons.drawHeat(ctx);

      // Blink while invulnerable after a hit.
      const blink = !this.dead && !this.dodging && this.safeTime > 0 && this.time % 0.16 < 0.06;
      if (blink) ctx.globalAlpha = 0.4;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing, 1);
      MQ.CharacterArt.mando(ctx, actor);
      ctx.restore();
      ctx.globalAlpha = 1;

      if (this.disruptTime > 0) glow(ctx, this.x, this.y - 45, 60, "#66d9ff", 0.5 + Math.sin(this.time * 40) * 0.2);
    }
  }

  MQ.Player = Player;
})(window.MQ);
