/* Every projectile in the space stages, from one fixed pool. */
(function (MQ) {
  const { clamp, glow, oval, line, poly } = MQ.U;
  const { cos, sin, atan2, hypot, PI } = Math;
  const TAU = MQ.TAU;

  const MAX = 640;
  const PLAYER = 0;
  const ENEMY = 1;

  const KIND = {
    BOLT: 0, // Straight player shot.
    SEEKER: 1, // Homing player rocket.
    GROUND: 2, // Drops to the surface, then runs along it.
    ORB: 3, // Straight enemy shot.
    GUIDED: 4, // Homing enemy missile. Can be shot down.
    BOMB: 5, // Bursts into a ring of orbs.
  };
  const ORB_COLOR = "#ff3d81";
  const BOMB_COLOR = "#ff9b38";
  const SURFACE_LINE = 636;
  const { top: FIELD_TOP, bottom: FIELD_BOTTOM } = MQ.SPACE.FIELD;

  class SpaceProjectiles {
    constructor(world) {
      this.world = world;
      this.next = 0;
      this.items = Array.from({ length: MAX }, () => ({
        active: false, team: PLAYER, kind: 0, x: 0, y: 0, vx: 0, vy: 0, r: 4, damage: 0, color: "#ffffff",
        life: 0, age: 0, blast: 0, turn: 0, speed: 0, running: false, target: null, cruise: Infinity,
      }));
    }

    fire(team, kind, x, y, vx, vy, damage, color, r = 4) {
      const { items } = this;
      for (let i = 0; i < MAX; i++) {
        const p = items[this.next];
        this.next = (this.next + 1) % MAX;
        if (p.active) continue;
        p.active = true;
        p.team = team;
        p.kind = kind;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.speed = hypot(vx, vy);
        p.damage = damage;
        p.color = color;
        p.r = r;
        p.age = 0;
        p.life = 8;
        p.blast = 0;
        p.turn = 0;
        p.running = false;
        p.target = null;
        p.cruise = Infinity;
        return p;
      }
      return null; // The pool is full, so this shot is skipped.
    }

    orb(x, y, angle, speed, damage, color = ORB_COLOR) {
      return this.fire(ENEMY, KIND.ORB, x, y, cos(angle) * speed, sin(angle) * speed, damage, color, 7);
    }

    fan(x, y, angle, count, spread, speed, damage) {
      for (let i = 0; i < count; i++) this.orb(x, y, angle + (i - (count - 1) / 2) * spread, speed, damage);
    }

    // A circle of shots, with room to slip through around gapAngle.
    ring(x, y, count, speed, damage, offset = 0, gapAngle = null, gap = 0.55) {
      for (let i = 0; i < count; i++) {
        const a = offset + (i / count) * TAU;
        if (gapAngle !== null) {
          const away = Math.abs(atan2(sin(a - gapAngle), cos(a - gapAngle)));
          if (away < gap) continue;
        }
        this.orb(x, y, a, speed, damage);
      }
    }

    guided(x, y, angle, speed, damage) {
      const p = this.fire(ENEMY, KIND.GUIDED, x, y, cos(angle) * speed, sin(angle) * speed, damage, "#ff6a3d", 9);
      if (!p) return;
      p.turn = 1.7;
      p.life = 4.6;
    }

    bomb(x, y, angle, speed, damage, fuse = 1.5) {
      const p = this.fire(ENEMY, KIND.BOMB, x, y, cos(angle) * speed, sin(angle) * speed, damage, BOMB_COLOR, 12);
      if (p) p.life = fuse;
    }

    clearEnemy(sparkle = false) {
      for (let i = 0; i < MAX; i++) {
        const p = this.items[i];
        if (!p.active || p.team !== ENEMY) continue;
        p.active = false;
        if (sparkle && i % 3 === 0) this.world.particles.sparks(p.x, p.y, p.color, 3, 120);
      }
    }

    clear() {
      for (let i = 0; i < MAX; i++) this.items[i].active = false;
    }

    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = this.items[i];
        if (!p.active) continue;
        p.age += dt;
        p.life -= dt;
        if (p.kind === KIND.SEEKER) this.seek(p, dt);
        else if (p.kind === KIND.GROUND) this.hug(p, dt);
        else if (p.kind === KIND.GUIDED) this.chase(p, dt);
        else if (p.kind === KIND.BOMB) {
          p.vx *= 1 - dt * 0.5;
          p.vy *= 1 - dt * 0.5;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.life <= 0) {
          p.active = false;
          if (p.kind === KIND.BOMB) this.burst(p);
          else if (p.kind === KIND.GUIDED) this.world.particles.sparks(p.x, p.y, p.color, 6);
          continue;
        }
        if (p.x < -40 || p.x > MQ.VW + 30 || p.y < FIELD_TOP || p.y > FIELD_BOTTOM) p.active = false;
      }
    }

    burst(p) {
      this.world.particles.ring(p.x, p.y, 70, p.color, 0.3);
      this.world.sfx("shipBurst");
      this.ring(p.x, p.y, 8, 190, p.damage, p.age);
    }

    steer(p, tx, ty, amount) {
      const now = atan2(p.vy, p.vx);
      let turn = atan2(ty - p.y, tx - p.x) - now;
      turn = atan2(sin(turn), cos(turn));
      const a = now + clamp(turn, -amount, amount);
      p.vx = cos(a) * p.speed;
      p.vy = sin(a) * p.speed;
    }

    seek(p, dt) {
      if (p.age < 0.12) return;
      if (!p.target?.active || !p.target.hittable) p.target = this.world.collision.nearestTarget(p.x, p.y);
      if (p.target) this.steer(p, p.target.x, p.target.y, 7 * dt);
    }

    /*
     * Missiles drop to their lane (p.cruise) and level off there, or at the surface if it's
     * higher. A missile in the surface lane seeks surface targets; one at a height seeks
     * whatever flies near its lane.
     */
    hug(p, dt) {
      const { collision } = this.world;
      const surfaceLane = p.cruise === Infinity;
      const target = surfaceLane ? collision.groundTarget(p.x, p.y) : collision.laneTarget(p.x, p.y);
      if (target) {
        p.speed = 470;
        this.steer(p, target.x, target.y, 9 * dt);
        return;
      }
      const floor = collision.floorAt(p.x + 14, SURFACE_LINE) - 10;
      const level = Math.min(p.cruise, floor);
      if (p.running && level === p.cruise && p.y > level + 12) {
        // Pulled below its lane by a target that's gone: climb back up.
        p.vx = 470;
        p.vy = -260;
      } else if (p.y >= level) {
        p.y = level;
        p.vx = 470;
        p.vy = 0;
        p.running = true;
      } else if (p.running) {
        p.vy = 260;
      }
    }

    chase(p, dt) {
      const { player } = this.world;
      // It stops turning near the end, so it can be dodged.
      if (p.age < 3 && !player.dead) this.steer(p, player.x, player.y, p.turn * dt);
    }

    draw(ctx, time) {
      for (let i = 0; i < MAX; i++) {
        const p = this.items[i];
        if (!p.active) continue;
        switch (p.kind) {
          case KIND.BOLT: {
            const k = 0.022;
            line(ctx, p.x - p.vx * k, p.y - p.vy * k, p.x, p.y, p.color, p.r * 1.5);
            line(ctx, p.x - p.vx * k * 0.5, p.y - p.vy * k * 0.5, p.x, p.y, "#ffffff", p.r * 0.6);
            break;
          }
          case KIND.ORB:
            oval(ctx, p.x, p.y, p.r, p.r, p.color, "#2a0716", 1.5);
            oval(ctx, p.x, p.y, p.r * 0.45, p.r * 0.45, "#ffffff");
            break;
          case KIND.BOMB: {
            const armed = p.life < 0.5 && (time * 12) % 1 < 0.5;
            oval(ctx, p.x, p.y, p.r, p.r, armed ? "#ffffff" : "#3a3038", p.color, 3);
            oval(ctx, p.x, p.y, 4, 4, p.color);
            glow(ctx, p.x, p.y, 26, p.color, 0.5);
            break;
          }
          default: {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(atan2(p.vy, p.vx) || (p.vx < 0 ? PI : 0));
            glow(ctx, -11, 0, 16, p.color, 0.8);
            poly(ctx, [-10, -4, 6, -4, 13, 0, 6, 4, -10, 4], p.kind === KIND.GUIDED ? "#3b2026" : "#d5dde6", p.color, 1.5);
            ctx.restore();
          }
        }
      }
    }
  }

  SpaceProjectiles.PLAYER = PLAYER;
  SpaceProjectiles.ENEMY = ENEMY;
  SpaceProjectiles.KIND = KIND;
  MQ.SpaceProjectiles = SpaceProjectiles;
})(window.MQ);
