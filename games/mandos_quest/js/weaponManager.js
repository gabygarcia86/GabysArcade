/* The player's arsenal: switching, ammunition, aiming and every attack. */
(function (MQ) {
  const { clamp, rand, glow } = MQ.U;
  const { cos, sin, atan2, hypot, abs, min } = Math;
  const D = MQ.DATA;
  const PLAYER = 0;

  const SHOULDER_Y = -66;
  const CONE = { assisted: 0.62, plain: 0.3, point: 1.2 };
  const COMBO_WINDOW = 0.65;
  const BLADE_HITS = [1, 1.1, 1.9];
  const SABER_HITS = [1, 1.05, 1.35, 2.4];
  const SWING_VARIANT = [0, 1, 2, 3];
  const EXECUTE_BELOW = 0.35;
  const MUZZLE_Y = -6; // The barrel's height in the weapon drawings.
  const LAUNCHER = 12; // Wrist launchers fire from just past the hand.
  const scratchArms = {};
  const scratchPose = MQ.Anim.createPose();
  const muzzle = { x: 0, y: 0 };

  class WeaponManager {
    constructor(world, player) {
      this.world = world;
      this.player = player;
      this.cooldown = 0;
      this.attackTime = 0;
      this.attackLength = 1;
      this.variant = 0;
      this.combo = 0;
      this.comboTime = 0;
      this.angle = 0;
      this.aimTime = 0;
      this.heat = 0;
      this.overheated = false;
      this.flaming = false;
      this.hold = 0;
      this.ammo = {};
      this.ammoMax = {};
      this.recharge = {};
      this.refresh();
      this.refill();
      this.current = D.weapon(world.save.weapon);
    }

    refresh() {
      const { progression, stats } = this.world;
      this.list = D.WEAPONS.filter((w) => progression.hasWeapon(w.id));
      for (const w of D.WEAPONS) {
        if (w.ammo) this.ammoMax[w.id] = Math.round(w.ammo * stats.ammo);
      }
    }

    refill() {
      for (const id of Object.keys(this.ammoMax)) {
        this.ammo[id] = this.ammoMax[id];
        this.recharge[id] = 0;
      }
    }

    next() {
      const index = this.list.findIndex((w) => w.id === this.current.id);
      this.select(this.list[(index + 1) % this.list.length].id);
    }

    select(id) {
      const weapon = this.list.find((w) => w.id === id);
      if (!weapon || weapon === this.current) return;
      this.current = weapon;
      this.cooldown = 0.15;
      this.attackTime = 0;
      this.combo = 0;
      this.hold = 0;
      this.aimTime = 0.5;
      this.angle = 0;
      this.world.save.weapon = id;
      this.world.sfx(id === "saber" ? "saberOn" : "weaponSwitch");
      this.world.weaponChanged();
    }

    get charge() {
      return this.current.id === "saber" ? clamp(this.hold / this.current.charge, 0, 1) : 0;
    }

    update(held, pressed, dt) {
      this.cooldown -= dt;
      this.attackTime -= dt;
      this.comboTime -= dt;
      this.aimTime -= dt;
      this.flaming = false;
      if (this.comboTime <= 0) this.combo = 0;

      for (let i = 0; i < this.list.length; i++) {
        const w = this.list[i];
        if (!w.ammo || this.ammo[w.id] >= this.ammoMax[w.id]) continue;
        this.recharge[w.id] += dt;
        if (this.recharge[w.id] >= w.recharge) {
          this.recharge[w.id] = 0;
          this.ammo[w.id]++;
        }
      }

      const weapon = this.current;
      const flameFiring = held && weapon.id === "flame" && !this.overheated;
      if (!flameFiring) {
        this.heat = Math.max(0, this.heat - dt * 1.3);
        if (this.heat < 0.25) this.overheated = false;
      }

      if (this.player.disabled) {
        this.hold = 0;
        return;
      }

      switch (weapon.id) {
        case "saber":
          this.updateSaber(held, pressed, dt);
          break;
        case "blade":
          if ((held || pressed) && this.cooldown <= 0) this.swing(BLADE_HITS);
          break;
        case "flame":
          if (flameFiring) this.burn(dt);
          else if (pressed && this.overheated) this.world.sfx("empty");
          break;
        default:
          if ((held || pressed) && this.cooldown <= 0) this.shoot(pressed);
      }
    }

    updateSaber(held, pressed, dt) {
      if (pressed && this.cooldown <= 0) this.swing(SABER_HITS);
      if (held) {
        const before = this.hold;
        this.hold += dt;
        if (before < this.current.charge && this.hold >= this.current.charge) {
          this.world.particles.ring(this.player.x, this.player.y - 55, 70, D.saber(this.world.save.saberColor).glow);
          this.world.sfx("saberOn");
        }
        return;
      }
      if (this.hold >= this.current.charge) this.releaseCharge();
      this.hold = 0;
    }

    /*
     * The best target in a cone ahead, as an angle relative to the facing.
     * Positive angles point down.
     */
    aim(range, point = 120) {
      const { world, player } = this;
      const cone = world.settings.aimAssist ? CONE.assisted : CONE.plain;
      const ox = player.x + player.facing * 8;
      const oy = player.y + SHOULDER_Y;
      let best = Infinity;
      let angle = 0;
      const { targets } = world;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.hittable) continue;
        const dx = (t.x - ox) * player.facing;
        if (dx < -10) continue;
        const ty = clamp(oy - 2, t.y - t.h + 6, t.y - 6);
        const distance = hypot(dx, ty - oy);
        if (distance > range || !world.camera.sees(t.x, ty, 40)) continue;
        const a = atan2(ty - oy, Math.max(dx, 12));
        if (abs(a) > (distance < point ? CONE.point : cone)) continue;
        const score = distance * (1 + abs(a)) / (t.priority || 1);
        if (score < best && world.col.clearLine(ox, oy, t.x, ty)) {
          best = score;
          angle = a;
        }
      }
      this.angle = angle;
      this.aimTime = 0.45;
      return angle;
    }

    beginAttack(length, variant = 0) {
      this.attackTime = this.attackLength = length;
      this.variant = variant;
    }

    shoot(pressed) {
      const { world, player, current: weapon } = this;
      const { id } = weapon;
      if (weapon.ammo) {
        if (!this.ammo[id]) {
          if (pressed) {
            world.sfx("empty");
            world.particles.label(player.x, player.y - 110, "RECHARGING", "#ffd45c", 15);
          }
          return;
        }
        this.ammo[id]--;
      }

      const { stats, projectiles, particles } = world;
      const f = player.facing;
      const a = this.aim(Math.min(weapon.range, 900));
      const c = cos(a);
      const s = sin(a);
      const ox = player.x + f * 4;
      const oy = player.y + SHOULDER_Y;
      // Shots are fired at the body, on the line of the barrel, then carried to the muzzle.
      const mx = ox + f * s * 6;
      const my = oy - c * 6;

      const damage = weapon.damage * stats.damage;
      const life = weapon.range / weapon.speed;
      const vx = f * c * weapon.speed;
      const vy = s * weapon.speed;

      this.cooldown = id === "blaster" && stats.fastBlaster ? weapon.cooldown * 0.72 : weapon.cooldown;
      this.beginAttack(id === "disruptor" ? 0.3 : 0.16, id === "heavy" || id === "disruptor" ? 1 : 0);
      const tip = this.muzzle(id);
      const fire = (kind, x, y, dx, dy, amount, offset = 0) =>
        projectiles.advance(projectiles.fire(PLAYER, kind, x, y + offset, dx, dy, amount, weapon.color, life), tip.x, tip.y + offset);

      switch (id) {
        case "blaster":
          if (stats.twinBlaster) {
            for (const offset of [-4, 4]) fire("bolt", mx, my, vx, vy, damage * 0.85, offset);
          } else {
            fire("bolt", mx, my, vx, vy, damage);
          }
          break;
        case "pulse":
          fire("bolt", mx, my, vx, vy, damage);
          break;
        case "heavy": {
          const p = fire("bolt", mx, my, vx, vy, damage);
          p.r = 11;
          p.pierce = 2;
          p.knock = 280;
          player.vx -= f * 140;
          world.camera.shake(0.22);
          break;
        }
        case "disruptor": {
          const p = fire("lance", mx, my, vx, vy, damage);
          p.r = 10;
          p.pierce = 6;
          p.knock = 220;
          player.vx -= f * 170;
          world.camera.shake(0.35);
          break;
        }
        case "birds":
          for (let i = 0; i < 4; i++) {
            const spread = a + (i - 1.5) * 0.36;
            fire("bird", mx, my, f * cos(spread) * weapon.speed, sin(spread) * weapon.speed, damage);
          }
          break;
        case "rocket": {
          const p = fire("rocket", mx, my, vx, vy, damage);
          p.blast = weapon.blast;
          p.r = 9;
          break;
        }
      }

      world.sfx(id);
      particles.flash(tip.x, tip.y, id === "heavy" || id === "disruptor" ? 64 : 34, weapon.color);
    }

    /*
     * The world position of the current weapon's muzzle in the pose the player is about to
     * be drawn in, worked out with the same arm and weapon transforms as the drawing.
     */
    muzzle(id) {
      const { player } = this;
      this.pose(scratchArms);
      MQ.Anim.human(scratchPose, player.anim, player.time, player.phase, player.animTime,
        scratchArms.action, scratchArms.k, scratchArms.variant, scratchArms.angle);
      const length = MQ.WeaponArt.muzzle[id] ?? LAUNCHER;
      MQ.Anim.frontHandPoint(scratchPose, length, MUZZLE_Y, muzzle);
      muzzle.x = player.x + player.facing * muzzle.x;
      muzzle.y += player.y;
      return muzzle;
    }

    burn(dt) {
      const { world, player, current: weapon } = this;
      this.flaming = true;
      this.heat += dt;
      if (this.heat >= weapon.heat) {
        this.overheated = true;
        world.sfx("empty");
        world.particles.smoke(player.x + player.facing * 40, player.y - 68, "#777777", 6, 8);
      }
      if (this.cooldown > 0) return;
      this.cooldown = weapon.cooldown;

      const f = player.facing;
      const a = this.aim(weapon.range + 60, 200);
      const c = cos(a);
      const s = sin(a);
      const oy = player.y + SHOULDER_Y;
      const nozzle = this.muzzle("flame");
      // Fast enough to carry to the end of the range against the particles' drag.
      for (let i = 0; i < 5; i++) {
        const speed = rand(1150, 1650);
        world.particles.flame(nozzle.x, nozzle.y, f * cos(a + rand(-0.1, 0.1)) * speed, sin(a + rand(-0.1, 0.1)) * speed, rand(9, 17), 0.55);
      }
      world.sfx("flame");

      // A cone that widens over the first stretch, sampled as a row of circles.
      const damage = weapon.damage * world.stats.damage;
      const stamp = world.step;
      for (let d = 12; d <= weapon.range; d += 24) {
        const x = player.x + f * c * d;
        const y = oy + s * d;
        const blocker = world.col.insideSolid(x, y);
        const { targets } = world;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          const owner = t.owner || t;
          if (!t.hittable || owner.burned === stamp || !MQ.nearBody(t, x, y, 14 + min(d, 225) * 0.16)) continue;
          owner.burned = stamp;
          t.hurt(damage, player.x, 20, "flame");
        }
        if (blocker) {
          blocker.hurt?.(damage, x, 0, "flame");
          break;
        }
      }
    }

    swing(hits) {
      const { world, player, current: weapon } = this;
      const index = this.combo % hits.length;
      const finisher = index === hits.length - 1;
      const saber = weapon.id === "saber";

      this.combo = index + 1;
      this.comboTime = COMBO_WINDOW;
      this.cooldown = weapon.cooldown * (finisher ? 1.8 : 1);
      this.beginAttack(finisher ? 0.3 : 0.2, finisher ? 3 : SWING_VARIANT[index]);
      this.angle = 0;

      const f = player.facing;
      if (!player.dodging) player.vx = f * (finisher && saber ? 520 : abs(player.vx) > 200 ? 330 : 190);

      const reach = weapon.reach * (finisher ? 1.25 : 1);
      const near = player.x - f * 22;
      const far = player.x + f * reach;
      const top = player.y - (finisher ? 138 : 112);
      const bottom = player.y + 10;
      const damage = weapon.damage * hits[index] * world.stats.damage;
      const landed = world.melee(Math.min(near, far), top, Math.max(near, far), bottom, damage, saber ? "saber" : "blade", finisher && saber ? EXECUTE_BELOW : 0);
      if (landed) {
        world.sfx("hit");
        world.camera.shake(finisher ? 0.3 : 0.1);
      }

      if (saber) {
        const color = D.saber(world.save.saberColor).glow;
        world.sfx("saberSwing");
        world.particles.flash(player.x + f * 55, player.y - 60, 80, color);
        if (finisher) {
          const p = world.projectiles.fire(PLAYER, "slash", player.x + f * 60, player.y - 52, f * 820, 0, weapon.damage * world.stats.damage, color, 0.5);
          p.r = 22;
          p.pierce = 6;
          world.particles.ring(player.x + f * 50, player.y - 55, 100, color);
        }
      } else {
        world.sfx("swing");
      }
    }

    releaseCharge() {
      const { world, player, current: weapon } = this;
      const f = player.facing;
      const damage = weapon.damage * world.stats.damage;
      const color = D.saber(world.save.saberColor).glow;
      this.cooldown = 0.4;
      this.beginAttack(0.32, 3);
      this.combo = 0;

      const far = player.x + f * 150;
      world.melee(Math.min(player.x, far), player.y - 140, Math.max(player.x, far), player.y + 10, damage * 2.6, "saber", EXECUTE_BELOW);

      // The wave follows aim assist, so it can reach flying targets.
      const a = this.aim(900);
      const p = world.projectiles.fire(PLAYER, "slash", player.x + f * 60, player.y - 56, f * cos(a) * 900, sin(a) * 900, damage * 2, color, 1.1);
      p.r = 34;
      p.pierce = 8;
      p.knock = 300;
      world.sfx("saberWave");
      world.camera.shake(0.4);
      world.particles.ring(player.x + f * 40, player.y - 56, 150, color, 0.35);
    }

    // Arms for the current pose: [action, progress, variant, angle].
    pose(out) {
      const attacking = this.attackTime > 0;
      const k = attacking ? 1 - this.attackTime / this.attackLength : 0;
      const { id } = this.current;
      out.action = null;
      out.k = k;
      out.variant = this.variant;
      out.angle = this.angle;

      if (id === "blade" || id === "saber") {
        if (attacking) out.action = "swing";
        else if (this.charge > 0.3) {
          out.action = "windup";
          out.k = this.charge;
        } else out.action = "hold";
      } else if (id === "birds" || id === "rocket") {
        if (attacking || this.aimTime > 0) out.action = "launch";
      } else if (id === "pulse" || id === "heavy" || id === "disruptor" || id === "flame") {
        out.action = "rifle";
        if (this.aimTime <= 0) {
          out.angle = 0.18;
          out.variant = 0;
        }
      } else if (attacking || this.aimTime > 0) {
        out.action = "aim";
      }
    }

    drawHeat(ctx) {
      if (this.current.id === "flame" && this.flaming) glow(ctx, this.player.x + this.player.facing * 50, this.player.y - 66, 70, "#ff8a2a", 0.5);
    }
  }

  MQ.WeaponManager = WeaponManager;
})(window.MQ);
