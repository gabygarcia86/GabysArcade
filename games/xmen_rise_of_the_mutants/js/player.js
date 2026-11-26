/*
 * The hero in play: movement (run, jump, double jump, glide, levitate, ladders, dodge),
 * health, X-Energy and Ultimate meters, combos, and wiring input to abilities.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const T = XM.T;

  class Player {
    constructor(world, charId) {
      this.world = world;
      this.id = charId;
      this.ch = XM.CHAR[charId];
      this.look = XM.Outfits.current(charId);
      this.st = XM.Progress.stats(charId);
      this.w = this.ch.size.w;
      this.h = this.ch.size.h;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.hp = this.st.maxHp;
      this.energy = this.st.maxEnergy;
      this.ult = U.clamp(this.st.fx.ultStart, 0, 100);
      this.ultWasReady = this.ult >= 100;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.djUsed = false;
      this.fuel = 1.1;
      this.climbing = false;
      this.dodgeT = 0;
      this.dodgeCd = 0;
      this.invuln = 0;
      this.hurtT = 0;
      this.lockT = 0;
      this.lockDur = 0;
      this.actState = "";
      this.actKind = "";
      this.combo = 0;
      this.comboWindow = 0;
      this.hitCombo = 0;
      this.hitComboT = 0;
      this.attackBuffer = 0;
      this.phase = 0;
      this.stateT = 0;
      this.animState = "idle";
      this.dead = false;
      this.victory = false;
      this.secondWindUsed = false;
      this.damageTaken = 0;
      this.dropT = 0;
      this.power = 0;
      this.flip = 0;
      this.stepT = 0;
      this.safe = { x: 0, y: 0 };
      this.untouchable = 0; // set by abilities like Berserker Rush
      this.noControl = 0;
    }

    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h * 0.45;
    }
    get gravityScale() {
      return this.world.gravityScale;
    }
    jumpVelocity() {
      return Math.sqrt(2 * XM.Physics.GRAVITY * this.gravityScale * this.st.jump * T);
    }

    spawnAt(x, y) {
      this.x = x;
      this.y = y - this.h;
      this.vx = this.vy = 0;
      this.safe = { x: this.x, y: this.y };
    }

    // Starts an attack/ability animation that blocks other actions for dur seconds.
    act(state, kind, dur) {
      this.actState = state;
      this.actKind = kind;
      this.lockT = this.lockDur = dur;
    }

    update(dt, input) {
      const w = this.world;
      const st = this.st;
      this.stateT += dt;
      if (this.dead) {
        this.vx *= 0.9;
        XM.Physics.move(this, dt, w.level, w.platforms, this.gravityScale);
        return;
      }
      if (this.victory) {
        this.vx = U.approach(this.vx, 0, 2000 * dt);
        XM.Physics.move(this, dt, w.level, w.platforms, this.gravityScale);
        return;
      }

      // Timers
      this.invuln = Math.max(0, this.invuln - dt);
      this.untouchable = Math.max(0, this.untouchable - dt);
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.dodgeCd = Math.max(0, this.dodgeCd - dt);
      this.comboWindow = Math.max(0, this.comboWindow - dt);
      this.attackBuffer = Math.max(0, this.attackBuffer - dt);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.dropT = Math.max(0, this.dropT - dt);
      this.noControl = Math.max(0, this.noControl - dt);
      this.power = Math.max(0, this.power - dt * 2);
      if (this.lockT > 0) {
        this.lockT -= dt;
        if (this.lockT <= 0) this.actState = "";
      }
      if (this.hitComboT > 0) {
        this.hitComboT -= dt;
        if (this.hitComboT <= 0) this.hitCombo = 0;
      }

      // Meters
      this.energy = Math.min(st.maxEnergy, this.energy + st.regen * dt);
      if (st.fx.regen > 0 && this.hp < st.maxHp) this.hp = Math.min(st.maxHp, this.hp + st.fx.regen * dt);
      if (this.ult >= 100 && !this.ultWasReady) {
        this.ultWasReady = true;
        XM.Audio.sfx("ultReady");
        XM.FX.text(this.cx, this.y - 20, "ULTIMATE READY!", "#ffd84a", 18, 1.4);
      }

      const ctrl = this.noControl <= 0;
      const axis = ctrl ? input.axis : 0;
      if (input.pressed("jump")) this.jumpBuffer = 0.12;
      if (ctrl && input.pressed("attack")) this.attackBuffer = 0.16;

      // ----- Dodge -----
      if (this.dodgeT > 0) {
        this.dodgeT -= dt;
        this.vy = Math.min(this.vy, 120);
        XM.Physics.move(this, dt, w.level, w.platforms, this.gravityScale * 0.4);
        if (Math.random() < 0.6) XM.FX.spawn(XM.FX.T.GLOW, this.cx, this.cy + 6, 0, 0, 0.25, 14, this.look.pal.glow || this.ch.color);
        this.afterMove(dt);
        return;
      }
      if (ctrl && input.pressed("dodge") && this.dodgeCd <= 0 && this.lockT <= 0) {
        this.startDodge(axis);
        return;
      }

      // ----- Ladders -----
      const ladderCol = XM.Physics.ladderAt(w.level, this);
      if (!this.climbing && ladderCol >= 0 && (input.held("up") || (input.held("down") && !this.onGround)) && this.lockT <= 0 && this.ch.move !== "levitate") {
        this.climbing = true;
      }
      if (!this.climbing && this.onGround && input.held("down") && XM.Physics.ladderBelow(w.level, this) >= 0 && this.ch.move !== "levitate") {
        this.climbing = true;
        this.y += 6;
      }
      if (this.climbing) {
        const col = XM.Physics.ladderAt(w.level, this);
        if (col < 0) {
          this.climbing = false;
          if (input.held("up")) this.vy = -480; // pop up onto the ledge at the top
        } else {
          this.x = U.lerp(this.x, col * T + T / 2 - this.w / 2, Math.min(1, dt * 14));
          const dir = (input.held("down") ? 1 : 0) - (input.held("up") ? 1 : 0);
          this.vy = dir * 170;
          this.vx = 0;
          this.phase += Math.abs(this.vy) * dt * 0.06;
          this.noGravity = true;
          this.dropping = true;
          XM.Physics.move(this, dt, w.level, null, 0);
          this.noGravity = false;
          this.dropping = false;
          if (this.jumpBuffer > 0) {
            this.climbing = false;
            this.jumpBuffer = 0;
            this.vy = -this.jumpVelocity() * 0.8;
            this.vx = axis * st.spd;
          }
          if (this.onGround && dir > 0) this.climbing = false;
          this.afterMove(dt);
          return;
        }
      }

      // ----- Horizontal movement -----
      const slippery = w.theme.slippery && this.onGround;
      const attacking = this.lockT > 0;
      const maxSpd = st.spd * (attacking ? (this.onGround ? 0.25 : 0.75) : 1) * (w.playerSlow > 0 ? 0.6 : 1);
      const target = axis * maxSpd;
      const accel = this.onGround ? (slippery ? 700 : axis ? 2400 : 2800) : 1500;
      this.vx = U.approach(this.vx, target, accel * dt);
      if (axis && !attacking) this.facing = axis > 0 ? 1 : -1;

      // ----- Jumping / gliding / levitating -----
      if (this.onGround) {
        this.coyote = 0.1;
        this.djUsed = false;
        this.flip = 0;
        if (this.ch.move === "levitate") this.fuel = Math.min(1.1, this.fuel + dt * 1.6);
      } else this.coyote = Math.max(0, this.coyote - dt);

      this.dropping = this.dropT > 0;
      if (this.ch.move === "levitate") {
        // Professor X never jumps: his chair lifts him while Jump is held.
        if (this.jumpBuffer > 0 && this.onGround && input.held("down")) {
          this.dropT = 0.25;
          this.jumpBuffer = 0;
        }
        this.maxFall = undefined;
        if (input.held("jump") && ctrl) {
          if (this.fuel > 0) {
            this.vy = U.approach(this.vy, -240, 2600 * dt);
            this.fuel -= dt;
            if (Math.random() < 0.5) XM.FX.spawn(XM.FX.T.GLOW, this.cx, this.y + this.h, 0, 60, 0.3, 10, this.look.pal.glow);
          } else this.maxFall = 90;
        }
      } else {
        if (this.jumpBuffer > 0 && ctrl) {
          if (this.onGround && input.held("down") && this.standingOnOneWay()) {
            this.dropT = 0.25;
            this.jumpBuffer = 0;
          } else if (this.onGround || this.coyote > 0) {
            this.jump(1);
          } else if (this.ch.dj && !this.djUsed && !attacking) {
            this.djUsed = true;
            this.jump(0.9);
            this.doubleJumpFx();
          }
        }
        if (!input.held("jump") && this.vy < -200 && !this.onGround && this.stateT > 0.05) this.vy *= 0.6; // short hop
        this.maxFall = undefined;
        if (this.ch.move === "glide" && !this.onGround && input.held("jump") && this.vy > 0 && this.djUsed) this.maxFall = 110;
      }
      if (this.flip > 0) this.flip += dt * 2.2;

      const wasGround = this.onGround;
      const vyBefore = this.vy;
      XM.Physics.move(this, dt, w.level, w.platforms, this.gravityScale);
      if (this.onGround && !wasGround && vyBefore > 380) {
        XM.Audio.sfx("land");
        XM.FX.burst(this.cx, this.y + this.h, { count: 6, color: "#cfc6b8", speed: 90, life: 0.3, type: XM.FX.T.DOT, angle: -Math.PI / 2, spread: 2.6, grav: 300 });
      }

      // ----- Combat -----
      if (ctrl && this.lockT <= 0) {
        if (this.attackBuffer > 0) {
          this.attackBuffer = 0;
          if (this.comboWindow <= 0) this.combo = 0;
          const ab = XM.Abilities[this.id];
          ab.basic(this, w, this.combo, input.held("up"));
          this.comboWindow = this.lockDur + 0.32;
          this.combo = (this.combo + 1) % 3;
          this.stateT = 0;
        } else if (input.pressed("special")) {
          if (this.energy >= st.cost) {
            this.energy -= st.cost;
            XM.Abilities[this.id].special(this, w, input.held("up"));
            this.stateT = 0;
            w.stats.specials++;
          } else {
            XM.Audio.sfx("denied");
            XM.FX.text(this.cx, this.y - 10, "Not enough X-Energy", "#8fd0ff", 13, 0.8);
          }
        } else if (input.pressed("ultimate")) {
          if (this.ult >= 100) {
            this.ult = 0;
            this.ultWasReady = false;
            this.invuln = Math.max(this.invuln, 1.2);
            XM.Audio.sfx("ultimate");
            XM.FX.flash("#ffffff", 0.55, 2);
            w.startUltimate(this);
            XM.Abilities[this.id].ultimate(this, w);
            this.stateT = 0;
          } else {
            XM.Audio.sfx("denied");
            XM.FX.text(this.cx, this.y - 10, `Ultimate ${Math.floor(this.ult)}%`, "#ffd84a", 13, 0.8);
          }
        }
      }
      if (ctrl && input.pressed("interact")) w.tryInteract(this);

      this.afterMove(dt);
    }

    standingOnOneWay() {
      const lv = this.world.level;
      const row = Math.floor((this.y + this.h + 2) / T);
      const c1 = Math.floor((this.x + 2) / T);
      const c2 = Math.floor((this.x + this.w - 2) / T);
      for (let c = c1; c <= c2; c++) if (XM.Physics.tile(lv, c, row) === XM.TILE.ONEWAY) return true;
      return !!this.riding;
    }

    jump(mult) {
      this.vy = -this.jumpVelocity() * mult;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      this.riding = null;
      this.stateT = 0;
      XM.Audio.sfx("jump");
    }

    doubleJumpFx() {
      const x = this.cx;
      const y = this.y + this.h;
      const id = this.id;
      if (id === "nightcrawler") {
        XM.FX.smoke(x, y - 20, 8, "#3a2a5a");
        XM.Audio.sfx("teleport");
      } else if (id === "iceman") {
        XM.FX.burst(x, y, { count: 10, color: "#bff0ff", speed: 140, type: XM.FX.T.SHARD, life: 0.5, grav: 400 });
        this.world.addIceRamp(x, y);
        XM.Audio.sfx("ice");
      } else if (id === "storm") {
        XM.FX.ring(x, y, 30, "#e8f6ff");
        XM.Audio.sfx("wind");
      } else if (id === "jean") {
        XM.FX.ring(x, y, 26, "#7dffb0");
        XM.Audio.sfx("psychic");
      } else {
        this.flip = 0.01;
        XM.FX.ring(x, y, 20, "#ffffff", 0.25, 3);
      }
    }

    startDodge(axis) {
      const dir = axis ? Math.sign(axis) : this.facing;
      this.facing = dir;
      this.dodgeCd = this.st.dodgeCd;
      this.invuln = Math.max(this.invuln, 0.3 + this.st.fx.dodgeIframes);
      this.climbing = false;
      XM.Audio.sfx("dodge");
      if (this.id === "nightcrawler") {
        // Teleport dodge: blink straight through to a free spot.
        XM.FX.smoke(this.cx, this.cy, 8, "#3a2a5a");
        let dist = 150;
        while (dist > 0) {
          const nx = this.x + dir * dist;
          if (!this.blocked(nx, this.y)) {
            this.x = nx;
            break;
          }
          dist -= 10;
        }
        XM.FX.smoke(this.cx, this.cy, 8, "#3a2a5a");
        XM.Audio.sfx("teleport");
        this.dodgeT = 0.08;
        this.vx = dir * 120;
        return;
      }
      this.dodgeT = 0.28;
      this.vx = dir * (this.id === "professorx" ? 420 : 540);
      if (this.vy > 0) this.vy = 0;
    }

    blocked(x, y) {
      const lv = this.world.level;
      for (let yy = y + 2; yy < y + this.h; yy += T / 2) {
        if (XM.Physics.solidAt(lv, x + 1, yy) || XM.Physics.solidAt(lv, x + this.w - 1, yy)) return true;
      }
      return XM.Physics.solidAt(lv, x + 1, y + this.h - 1) || XM.Physics.solidAt(lv, x + this.w - 1, y + this.h - 1);
    }

    afterMove(dt) {
      const w = this.world;
      if (this.onGround && !this.riding && !XM.Physics.hazard(w.level, this)) {
        // Remember solid footing to return to after a fall.
        const under = XM.Physics.tile(w.level, Math.floor(this.cx / T), Math.floor((this.y + this.h + 2) / T));
        if (XM.Physics.solid(under) && under !== XM.TILE.CRATE) this.safe = { x: this.x, y: this.y };
      }
      if (XM.Physics.hazard(w.level, this)) {
        this.hurt(Math.max(10, this.st.maxHp * 0.12), this.cx - this.facing, { hazard: true });
        if (!this.dead) this.vy = -520;
      }
      this.phase += Math.abs(this.vx) * dt * 0.05;
      if (this.onGround && Math.abs(this.vx) > 150) {
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = 0.28;
          XM.Audio.sfx("step");
        }
      }
      this.animState = this.computeAnim();
    }

    computeAnim() {
      if (this.dead) return "ko";
      if (this.victory) return "victory";
      if (this.lockT > 0 && this.actState) return this.actState;
      if (this.hurtT > 0) return "hurt";
      if (this.dodgeT > 0) return "dodge";
      if (this.climbing) return "climb";
      if (!this.onGround) {
        if (this.maxFall && this.vy > 0) return "glide";
        return this.vy < 0 ? "jump" : "fall";
      }
      const s = Math.abs(this.vx);
      if (s > 190) return "run";
      if (s > 20) return "walk";
      return "idle";
    }

    // Called by combat when a hit lands, to build the combo counter and meters.
    onHit(dmg, kill) {
      this.hitCombo++;
      this.hitComboT = 2.2;
      const w = this.world;
      w.stats.maxCombo = Math.max(w.stats.maxCombo, this.hitCombo);
      this.energy = Math.min(this.st.maxEnergy, this.energy + 1.5 + this.st.fx.energyOnHit);
      this.ult = Math.min(100, this.ult + 0.6 * this.st.ultGain);
      if (this.st.fx.lifesteal) this.hp = Math.min(this.st.maxHp, this.hp + dmg * this.st.fx.lifesteal);
      if (kill) this.ult = Math.min(100, this.ult + (4 + this.st.fx.ultOnKill) * this.st.ultGain);
    }

    // Damage multiplier for crits and long combos.
    damageMult() {
      const fx = this.st.fx;
      let m = 1 + Math.min(1, this.hitCombo / 30) * fx.comboDmg;
      let crit = false;
      if (fx.crit && Math.random() < fx.crit) {
        m *= 1.5;
        crit = true;
      }
      return { m, crit };
    }

    hurt(dmg, fromX, opts = {}) {
      if (this.dead || this.victory) return false;
      if ((this.invuln > 0 || this.untouchable > 0) && !opts.unblockable) return false;
      const final = Math.max(1, Math.round(dmg * (1 - this.st.def)));
      this.hp -= final;
      this.damageTaken += final;
      this.world.stats.damage += final;
      if (this.world.boss && !this.world.boss.dead) this.world.stats.bossDamage += final;
      this.invuln = opts.hazard ? 0.9 : 1.0;
      this.hurtT = 0.3;
      this.lockT = 0;
      this.actState = "";
      this.climbing = false;
      this.hitCombo = 0;
      const dir = this.cx >= fromX ? 1 : -1;
      if (!this.st.fx.knockImmune || opts.hazard) {
        this.vx = dir * 240;
        this.vy = Math.min(this.vy, -260);
      }
      XM.Audio.sfx("hurt");
      XM.FX.text(this.cx, this.y - 6, `-${final}`, "#ff5a5a", 16);
      XM.FX.burst(this.cx, this.cy, { count: 8, color: "#ff6a5a", speed: 160, life: 0.35 });
      XM.FX.shake(4, 0.2);
      if (this.hp <= 0) {
        if (this.st.fx.secondWind && !this.secondWindUsed) {
          this.secondWindUsed = true;
          this.hp = Math.round(this.st.maxHp * this.st.fx.secondWind);
          this.invuln = 2;
          XM.FX.flash("#ffffff", 0.6);
          XM.FX.text(this.cx, this.y - 30, this.ch.passives[5].name.toUpperCase() + "!", "#ffd84a", 20, 1.6);
          XM.Audio.sfx("heal");
        } else {
          this.hp = 0;
          this.dead = true;
          this.stateT = 0;
          XM.Audio.sfx("enemyDie");
          this.world.onPlayerDown();
        }
      }
      return true;
    }

    heal(amount) {
      this.hp = Math.min(this.st.maxHp, this.hp + amount);
    }

    draw(ctx) {
      const blink = (this.invuln > 0 && this.dodgeT <= 0 && !this.dead && Math.floor(this.invuln * 14) % 2 === 0) ? 0.45 : 1;
      if (this.onGround && !this.dead) {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + this.h, this.w * 0.7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const an = {
        state: this.animState,
        t: this.stateT,
        phase: this.phase,
        kind: this.actKind,
        prog: this.lockDur > 0 ? 1 - this.lockT / this.lockDur : 0,
        combo: (this.combo + 2) % 3,
        power: this.power,
        speed: this.vx,
        vy: this.vy,
        air: !this.onGround,
        flip: this.flip,
      };
      if (an.state === "dodge") an.prog = 1 - this.dodgeT / 0.28;
      if (this.id === "professorx" && an.state === "dodge") {
        XM.Art.glow(ctx, this.cx, this.cy, 46, this.look.pal.glow, 0.6);
      }
      XM.CharArt.draw(ctx, this.id, this.look, an, this.cx, this.y + this.h, this.facing, 1, blink);
    }
  }

  XM.Player = Player;
})(window.XM);
