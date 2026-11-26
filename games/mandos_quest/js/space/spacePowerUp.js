/* Capsules, repair kits and credit chips drifting through the field, from fixed pools. */
(function (MQ) {
  const S = MQ.SPACE;
  const P = S.PICKUPS;
  const { clamp, glow, poly, box, oval } = MQ.U;
  const { sin, cos, hypot, abs } = Math;

  const MAX = 32;
  const MAX_CREDITS = 48;
  const CAPSULE = 0;
  const HEALTH = 1;

  // Credit formations: [dx, dy] offsets from the formation's leading point.
  const FORMATIONS = [
    [[0, 0], [46, 0], [92, 0], [138, 0], [184, 0], [230, 0]],
    [[0, 0], [46, -34], [92, -60], [138, -70], [184, -60], [230, -34], [276, 0]],
    [[0, 0], [46, 30], [92, 60], [138, 30], [184, 0], [230, -30], [276, -60], [322, -30]],
    [[0, -60], [46, -30], [92, 0], [138, -30], [184, -60]],
    [[0, -40], [0, 0], [0, 40], [60, -40], [60, 0], [60, 40]],
  ];

  class SpacePowerUps {
    constructor(world) {
      this.world = world;
      this.next = 0;
      this.items = Array.from({ length: MAX }, () => ({ active: false, kind: CAPSULE, x: 0, y: 0, baseY: 0, age: 0, life: 0 }));
      this.credits = Array.from({ length: MAX_CREDITS }, () => ({ active: false, x: 0, y: 0 }));
      this.nextCredit = 0;
    }

    // Sends a formation of credit chips in from the right edge, led at height y.
    creditFormation(index, y) {
      const shape = FORMATIONS[index % FORMATIONS.length];
      for (const [dx, dy] of shape) {
        const chip = this.credits[this.nextCredit];
        this.nextCredit = (this.nextCredit + 1) % MAX_CREDITS;
        chip.active = true;
        chip.x = MQ.VW + 40 + dx;
        chip.y = clamp(y + dy, 120, 610);
      }
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
      for (let i = 0; i < MAX_CREDITS; i++) this.credits[i].active = false;
    }

    updateCredits(dt) {
      const C = S.CREDITS;
      const { player } = this.world;
      for (let i = 0; i < MAX_CREDITS; i++) {
        const chip = this.credits[i];
        if (!chip.active) continue;
        chip.x -= C.speed * dt;
        if (chip.x < -30) {
          chip.active = false;
          continue;
        }
        if (player.dead) continue;
        const dx = player.x - chip.x;
        const dy = player.y - chip.y;
        const distance = hypot(dx, dy) || 1;
        if (distance < C.magnet) {
          const pull = 320 * (1 - distance / C.magnet) + 80;
          chip.x += (dx / distance) * pull * dt;
          chip.y += (dy / distance) * pull * dt;
        }
        if (abs(dx) < player.rx + C.reach && abs(dy) < player.ry + C.reach) {
          chip.active = false;
          this.world.collectCredit(chip.x, chip.y);
        }
      }
    }

    update(dt) {
      this.updateCredits(dt);
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
      for (let i = 0; i < MAX_CREDITS; i++) {
        const chip = this.credits[i];
        if (chip.active) MQ.ObjectArt.credit(ctx, chip.x, chip.y, time);
      }
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
