/*
 * Collisions for the space stages. Ships are ellipses and shots are circles, with
 * no gravity, ground or platforms. It shares nothing with the platforming collision.
 */
(function (MQ) {
  const { hypot, abs } = Math;

  function ellipseHit(target, x, y, r) {
    const dx = (x - target.x) / (target.rx + r);
    const dy = (y - target.y) / (target.ry + r);
    return dx * dx + dy * dy < 1;
  }

  class SpaceCollisionManager {
    constructor(world) {
      this.world = world;
      this.targets = []; // Everything the player can shoot. Refilled every step.
      this.solids = [];
      this.guided = [];
    }

    gather() {
      const { world, targets, solids, guided } = this;
      targets.length = solids.length = guided.length = 0;

      const enemies = world.enemies.items;
      for (let i = 0; i < enemies.length; i++) if (enemies[i].active && enemies[i].hittable) targets.push(enemies[i]);

      const obstacles = world.obstacles.items;
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (!o.active) continue;
        if (o.hittable) targets.push(o);
        else if (o.kind === "block" || o.kind === "arm" || o.kind === "rock") solids.push(o);
      }

      if (world.boss) {
        const { parts } = world.boss;
        for (let i = 0; i < parts.length; i++) if (parts[i].hittable) targets.push(parts[i]);
      }

      const { GUIDED } = MQ.SpaceProjectiles.KIND;
      const shots = world.projectiles.items;
      for (let i = 0; i < shots.length; i++) if (shots[i].active && shots[i].kind === GUIDED) guided.push(shots[i]);
    }

    /* ---------- Queries ---------- */

    nearestTarget(x, y) {
      let best = null;
      let score = Infinity;
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (!t.active || !t.hittable || t.kind === "rock" || t.shielded) continue;
        // Ahead is better than behind.
        const s = hypot(t.x - x, t.y - y) * (t.x < x ? 2 : 1);
        if (s < score) {
          score = s;
          best = t;
        }
      }
      return best;
    }

    groundTarget(x, y) {
      let best = null;
      let nearest = 520;
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (!t.active || !t.surface || t.y < y - 40 || t.x < x - 30) continue;
        const distance = hypot(t.x - x, t.y - y);
        if (distance < nearest) {
          nearest = distance;
          best = t;
        }
      }
      return best;
    }

    // The nearest target ahead of a cruising missile and close to its height.
    laneTarget(x, y) {
      let best = null;
      let nearest = 520;
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (!t.active || !t.hittable || t.kind === "rock" || t.shielded) continue;
        if (t.x < x - 30 || Math.abs(t.y - y) > 90 + (t.ry || 0)) continue;
        const distance = hypot(t.x - x, t.y - y);
        if (distance < nearest) {
          nearest = distance;
          best = t;
        }
      }
      return best;
    }

    floorAt(x, fallback) {
      let floor = fallback;
      for (let i = 0; i < this.solids.length; i++) {
        const o = this.solids[i];
        if (o.kind === "block" && o.y > 360 && x > o.x && x < o.x + o.w) floor = Math.min(floor, o.y);
      }
      return floor;
    }

    laser(x, y, half, damage) {
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (t.x + t.rx < x || abs(t.y - y) > t.ry + half) continue;
        if (t.hurt(damage, "laser", x)) this.world.particles.sparks(Math.max(x, t.x - t.rx * 0.6), y, "#c58cff", 5);
      }
      for (let i = 0; i < this.guided.length; i++) {
        const p = this.guided[i];
        if (p.active && p.x > x && abs(p.y - y) < p.r + half) this.shootDown(p);
      }
    }

    blocked(x, y) {
      for (let i = 0; i < this.solids.length; i++) if (this.solids[i].blocks(x, y)) return true;
      return false;
    }

    /* ---------- Resolution ---------- */

    update() {
      const { world } = this;
      const { PLAYER } = MQ.SpaceProjectiles;
      const shots = world.projectiles.items;
      for (let i = 0; i < shots.length; i++) {
        const p = shots[i];
        if (!p.active) continue;
        if (p.team === PLAYER) this.playerShot(p);
        else this.enemyShot(p);
      }
      if (world.player.invulnerable) return;
      this.enemyBodies();
      if (!world.player.invulnerable) this.hazards();
    }

    playerShot(p) {
      const { BOLT } = MQ.SpaceProjectiles.KIND;
      const { world } = this;
      for (let i = 0; i < this.guided.length; i++) {
        const m = this.guided[i];
        if (!m.active || hypot(m.x - p.x, m.y - p.y) > m.r + p.r + 4) continue;
        this.shootDown(m);
        p.active = false;
        return;
      }
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (!t.active || !ellipseHit(t, p.x, p.y, p.r)) continue;
        if (!t.hurt(p.damage, p.kind === BOLT ? "bolt" : "missile", p.x)) continue;
        p.active = false;
        if (p.blast) this.blast(p, t);
        else world.particles.sparks(p.x, p.y, p.color, 3, 220);
        return;
      }
      // Missiles skim along a surface instead of hitting it.
      if (p.kind !== MQ.SpaceProjectiles.KIND.GROUND && this.blocked(p.x, p.y)) {
        p.active = false;
        world.particles.sparks(p.x, p.y, p.color, 3, 160);
      }
    }

    blast(p, struck) {
      const { world } = this;
      world.particles.explosion(p.x, p.y, 0.4);
      world.sfx("shipPop");
      for (let i = 0; i < this.targets.length; i++) {
        const t = this.targets[i];
        if (t !== struck && t.active && ellipseHit(t, p.x, p.y, p.blast)) t.hurt(p.damage * 0.5, "missile", p.x);
      }
    }

    shootDown(missile) {
      missile.active = false;
      this.world.particles.explosion(missile.x, missile.y, 0.35);
      this.world.sfx("shipPop");
      this.world.addPoints(50);
    }

    enemyShot(p) {
      const { world } = this;
      const { player } = world;
      // A shot passes through a ship that can't be hurt, so it doesn't look like a hit.
      if (!player.invulnerable && ellipseHit(player, p.x, p.y, p.r * 0.7)) {
        p.active = false;
        player.hurt(p.damage);
        return;
      }
      if (this.blocked(p.x, p.y)) {
        p.active = false;
        world.particles.sparks(p.x, p.y, p.color, 3, 120);
      }
    }

    enemyBodies() {
      const { world } = this;
      const { player } = world;
      const enemies = world.enemies.items;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.active) continue;
        const dx = (player.x - e.x) / (player.rx + e.rx * 0.8);
        const dy = (player.y - e.y) / (player.ry + e.ry * 0.8);
        if (dx * dx + dy * dy >= 1) continue;
        player.hurt(e.def.ram);
        if (!e.def.heavy) e.destroy();
        return;
      }
      if (!world.boss) return;
      const damage = world.boss.touch(player.x, player.y, player.rx, player.ry);
      if (damage) player.hurt(damage);
    }

    hazards() {
      const { player, obstacles } = this.world;
      for (let i = 0; i < obstacles.items.length; i++) {
        const o = obstacles.items[i];
        if (!o.active) continue;
        const damage = o.touch(player.x, player.y, player.rx, player.ry);
        if (!damage) continue;
        player.hurt(damage);
        return;
      }
    }
  }

  MQ.SpaceCollisionManager = SpaceCollisionManager;
})(window.MQ);
