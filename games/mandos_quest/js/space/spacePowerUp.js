/* Capsules and repair kits drifting through the field, from a fixed pool. */
(function (MQ) {
  const S = MQ.SPACE;
  const P = S.PICKUPS;
  const { clamp, glow, poly, box, oval } = MQ.U;
  const { sin, cos, hypot, abs } = Math;

  const MAX = 32;
  const CAPSULE = 0;
  const HEALTH = 1;

  class SpacePowerUps {
    constructor(world) {
      this.world = world;
      this.next = 0;
      this.items = Array.from({ length: MAX }, () => ({ active: false, kind: CAPSULE, x: 0, y: 0, baseY: 0, age: 0, life: 0 }));
    }

    drop(kind, x, y) {
      const item = this.items[this.next];
      this.next = (this.next + 1) % MAX;
      item.active = true;
      item.kind = kind;
      item.x = x;
      item.y = item.baseY = clamp(y, 130, 605);
      item.age = 0;
      item.life = P.life;
      // One from off screen gets its full time in view.
      if (x > MQ.VW) item.life += (x - MQ.VW) / P.drift;
    }

    clear() {
      for (let i = 0; i < MAX; i++) this.items[i].active = false;
    }

    update(dt) {
      const { player } = this.world;
      for (let i = 0; i < MAX; i++) {
        const item = this.items[i];
        if (!item.active) continue;
        item.age += dt;
        item.life -= dt;
        // Quick to come on screen, then a slow float.
        item.x -= (item.x > MQ.VW - 120 ? P.drift * 4 : P.drift) * dt;
        item.y = item.baseY + sin(item.age * 3) * 9;
        if (item.life <= 0 || item.x < -30) {
          item.active = false;
          continue;
        }
        if (player.dead) continue;
        const dx = player.x - item.x;
        const dy = player.y - item.y;
        const distance = hypot(dx, dy) || 1;
        if (distance < P.magnet) {
          const pull = 260 * (1 - distance / P.magnet) + 60;
          item.x += (dx / distance) * pull * dt;
          item.baseY += (dy / distance) * pull * dt;
        }
        if (abs(dx) < player.rx + P.reach && abs(dy) < player.ry + P.reach) {
          item.active = false;
          this.world.collect(item.kind, item.x, item.y);
        }
      }
    }

    draw(ctx, time) {
      for (let i = 0; i < MAX; i++) {
        const item = this.items[i];
        if (!item.active) continue;
        if (item.life < P.blink && (time * 7) % 1 < 0.4) continue;
        const { x, y } = item;
        if (item.kind === HEALTH) {
          glow(ctx, x, y, 34, "#5dff9a", 0.6);
          box(ctx, x - 14, y - 14, 28, 28, 6, "#123322", "#5dff9a", 2);
          box(ctx, x - 3, y - 9, 6, 18, 1, "#d8ffe6");
          box(ctx, x - 9, y - 3, 18, 6, 1, "#d8ffe6");
          continue;
        }
        // A forged ingot in a turning ring.
        glow(ctx, x, y, 38, "#ffc84d", 0.65 + sin(time * 9) * 0.2);
        const turn = cos(time * 4 + i);
        oval(ctx, x, y, 19, 5 + abs(turn) * 14, null, "#ffe3a0", 2, turn * 0.5);
        poly(ctx, [x - 12, y + 7, x - 7, y - 7, x + 7, y - 7, x + 12, y + 7], "#ffc84d", "#5a3a08", 2);
        poly(ctx, [x - 5, y - 4, x + 5, y - 4, x + 6, y, x - 6, y], "#fff1c2");
      }
    }
  }

  SpacePowerUps.CAPSULE = CAPSULE;
  SpacePowerUps.HEALTH = HEALTH;
  MQ.SpacePowerUps = SpacePowerUps;
})(window.MQ);
