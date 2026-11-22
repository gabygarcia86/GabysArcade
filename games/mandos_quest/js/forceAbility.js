/* Baby G's Force Push: energy, upgrades and everything a push can affect. */
(function (MQ) {
  const { clamp, glow } = MQ.U;
  const { abs, sign } = Math;

  const MAX_ENERGY = 100;
  const REGEN = 15;
  const COOLDOWN = 0.45;
  const COST = { base: 20, object: 10, heavyObject: 22, large: 18, boss: 28 };
  const BURST_DAMAGE = 45;

  class ForceAbility {
    constructor(world) {
      this.world = world;
      this.energy = MAX_ENERGY;
      this.cooldown = 0;
      this.wave = 0;
      this.waveX = 0;
      this.waveY = 0;
      this.waveFacing = 1;
      this.found = [];
    }

    get power() {
      return this.world.stats.force;
    }

    refill() {
      this.energy = MAX_ENERGY;
    }

    update(dt) {
      this.cooldown -= dt;
      this.wave = Math.max(0, this.wave - dt);
      this.energy = clamp(this.energy + REGEN * dt, 0, MAX_ENERGY);
    }

    inRange(x, top, bottom, halfWidth) {
      const { player } = this.world;
      const { range, burst } = this.power;
      const dx = x - player.x;
      if (abs(dx) - halfWidth > range) return false;
      if (!burst && dx * player.facing + halfWidth < -55) return false;
      const reachY = range * 0.62;
      return bottom > player.y - 45 - reachY && top < player.y - 45 + reachY;
    }

    use() {
      const { world } = this;
      const { player, baby } = world;
      if (!baby.present || baby.caged || !this.power) {
        const reason = !baby.present ? "Baby G is not with you yet"
          : baby.caged ? "Baby G is held captive"
          : "Force Push unlocks after Level 1";
        world.particles.label(player.x, player.y - 108, reason, "#8fdcff", 16);
        world.sfx("forceFail");
        return;
      }
      if (this.cooldown > 0) return;
      this.cooldown = COOLDOWN;

      if (this.energy < COST.base) {
        baby.react("worried", 1.2);
        world.particles.label(baby.x, baby.y - 50, "Too tired", "#8fdcff", 16);
        world.sfx("forceFail");
        return;
      }

      let budget = this.energy - COST.base;
      let exhausted = false;
      const { power } = this;
      const spend = (amount) => {
        if (amount > budget) {
          exhausted = true;
          return false;
        }
        budget -= amount;
        return true;
      };

      // Large targets are paid for once each, however many body parts are in range.
      this.found.length = 0;
      const { targets } = world;
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const owner = t.owner || t;
        if (!owner.push || this.found.includes(owner)) continue;
        if (this.inRange(t.x, t.y - t.h, t.y, t.w / 2)) this.found.push(owner);
      }
      for (let i = 0; i < this.found.length; i++) {
        const owner = this.found[i];
        const cost = owner.isBoss ? COST.boss : owner.large ? COST.large : 0;
        if (cost && !spend(cost)) continue;
        const direction = sign(owner.x - player.x) || player.facing;
        owner.push(direction, power.strength);
        if (power.burst && !owner.dead) owner.hurt(BURST_DAMAGE * world.stats.damage, player.x, 0, "force");
      }

      for (const object of world.level.forceObjects) {
        if (object.used || !this.inRange(object.cx, object.top, object.bottom, object.halfWidth)) continue;
        if (object.heavy && !power.heavy) {
          world.particles.label(object.cx, object.top - 14, "Needs Heavy Object Movement", "#ffc84d", 16);
          continue;
        }
        if (spend(object.heavy ? COST.heavyObject : COST.object)) object.activate();
      }

      this.energy = budget;
      if (exhausted) world.particles.label(player.x, player.y - 112, "Not enough energy for a target that large", "#8fdcff", 16);

      world.projectiles.deflect(player.x + (power.burst ? 0 : player.facing * 70), player.y - 45, power.range * 0.75);

      this.wave = 0.42;
      this.waveX = player.x;
      this.waveY = player.y - 45;
      this.waveFacing = player.facing;
      baby.cast();
      world.camera.shake(power.burst ? 0.35 : 0.18);
      world.sfx("forcePush");
    }

    draw(ctx) {
      if (this.wave <= 0 || !this.power) return;
      const k = 1 - this.wave / 0.42;
      const { range, burst } = this.power;
      const directions = burst ? 2 : 1;
      for (let d = 0; d < directions; d++) {
        const facing = d ? -this.waveFacing : this.waveFacing;
        for (let i = 0; i < 3; i++) {
          const t = k - i * 0.12;
          if (t < 0) continue;
          const x = this.waveX + facing * t * range;
          const middle = facing > 0 ? 0 : Math.PI;
          ctx.beginPath();
          ctx.ellipse(x, this.waveY, 18 + t * 24, 26 + t * 80, 0, middle - 1.35, middle + 1.35);
          ctx.strokeStyle = `rgba(130,215,255,${(1 - k) * (0.85 - i * 0.2)})`;
          ctx.lineWidth = 6 - i * 1.5;
          ctx.stroke();
          if (!i) glow(ctx, x, this.waveY, 60 + t * 50, "#58b8ff", (1 - k) * 0.6);
        }
      }
    }
  }

  MQ.ForceAbility = ForceAbility;
})(window.MQ);
