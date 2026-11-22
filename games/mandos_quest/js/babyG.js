/* Baby G: follows the Mandalorian, reacts to the world and casts Force Push. */
(function (MQ) {
  const { damp, rand, clamp, oval, line, glow, box } = MQ.U;
  const { sin, hypot } = Math;
  const TELEPORT_DISTANCE = 750;
  const WORRY_RADIUS = 250;

  class BabyG {
    constructor(world, present) {
      this.world = world;
      this.present = present;
      this.caged = false;
      this.x = 0;
      this.y = 0;
      this.tilt = 0;
      this.facing = 1;
      this.time = 0;
      this.mood = "idle";
      this.moodTime = 0;
      this.casting = 0;
      this.scanTime = 0;
      this.idleTime = rand(6, 12);
      this.snap();
    }

    snap() {
      const { player } = this.world;
      this.x = player.x - player.facing * 60;
      this.y = player.y - 84;
    }

    join(x, y) {
      this.present = true;
      this.x = x;
      this.y = y;
      this.react("happy", 3);
    }

    cage(x, y) {
      this.caged = true;
      this.x = x;
      this.y = y;
      this.tilt = 0;
    }

    release() {
      if (!this.caged) return;
      this.caged = false;
      this.react("happy", 3);
      this.world.particles.ring(this.x, this.y, 110, "#8fdcff", 0.5);
      this.world.particles.sparks(this.x, this.y, "#8fdcff", 24);
    }

    react(mood, seconds) {
      if (!this.present) return;
      if (mood === "worried" && this.mood === "victory") return;
      if (this.mood !== mood) {
        if (mood === "happy" || mood === "victory") this.world.sfx("babyHappy");
        else if (mood === "worried") this.world.sfx("babyWorry");
      }
      this.mood = mood;
      this.moodTime = seconds;
    }

    cast() {
      this.casting = 0.6;
      this.facing = this.world.player.facing;
      this.world.particles.flash(this.x + this.facing * 24, this.y - 14, 70, "#7fd4ff", 0.3);
    }

    update(dt) {
      if (!this.present) return;
      const { world } = this;
      const { player } = world;
      this.time += dt;
      this.casting -= dt;
      this.moodTime -= dt;
      if (this.moodTime <= 0) this.mood = this.caged ? "sad" : "idle";
      if (this.caged) return;

      const casting = this.casting > 0;
      const offset = casting ? 34 : -62;
      const height = player.dead ? 46 : 84;
      const tx = player.x + player.facing * offset;
      const ty = player.y - height + sin(this.time * 2.4) * 6 - (casting ? 18 : 0);
      if (hypot(tx - this.x, ty - this.y) > TELEPORT_DISTANCE) this.snap();

      const oldX = this.x;
      this.x = damp(this.x, tx, casting ? 12 : 4.5, dt);
      this.y = damp(this.y, ty, casting ? 12 : 5, dt);
      const speed = (this.x - oldX) / dt;
      this.tilt = damp(this.tilt, clamp(speed / 1300, -0.22, 0.22), 6, dt);
      if (!casting) this.facing = player.x >= this.x ? 1 : -1;

      this.scanTime -= dt;
      if (this.scanTime <= 0) {
        this.scanTime = 0.5;
        this.lookAround();
      }
    }

    lookAround() {
      const { world } = this;
      const { player } = world;
      if (player.dead) {
        this.react("sad", 1);
        return;
      }
      if (this.mood !== "idle" && this.mood !== "worried") return;

      let danger = player.hp < player.maxHp * 0.25 || world.level.hazardNear(player.x, player.y, 70);
      for (let i = 0; i < world.enemies.length && !danger; i++) {
        const e = world.enemies[i];
        danger = e.aggro && !e.dead && hypot(e.x - player.x, e.y - player.y) < WORRY_RADIUS;
      }
      if (danger) {
        this.react("worried", 0.9);
      } else if (world.collectibles.near(player.x, player.y, 280) || world.level.forceNear(player.x, player.y, 180)) {
        this.react("happy", 1.4);
      } else {
        this.idleTime -= 0.5;
        if (this.idleTime <= 0) {
          this.idleTime = rand(8, 16);
          this.react("happy", 1.2);
        }
      }
    }

    draw(ctx) {
      if (!this.present) return;
      const casting = this.casting > 0;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.tilt);
      ctx.scale(this.facing * 0.82, 0.82);
      MQ.CharacterArt.baby(ctx, casting ? "force" : this.mood, this.time, { power: casting ? this.casting : 0 });
      ctx.restore();

      if (this.caged) {
        for (let i = -2; i <= 2; i++) line(ctx, this.x + i * 16, this.y - 48, this.x + i * 16, this.y + 34, "rgba(255,90,90,0.65)", 2.5);
        box(ctx, this.x - 42, this.y - 56, 84, 10, 3, "#39303f", MQ.INK);
        box(ctx, this.x - 42, this.y + 30, 84, 10, 3, "#39303f", MQ.INK);
        glow(ctx, this.x, this.y - 8, 70, "#ff5a5a", 0.3);
      } else if (!casting && this.mood === "worried") {
        const bx = this.x + this.facing * 4;
        const by = this.y - 56 + sin(this.time * 9) * 2;
        line(ctx, bx, by - 10, bx, by, "#ffd45c", 3.5);
        oval(ctx, bx, by + 7, 2.2, 2.2, "#ffd45c");
      }
    }
  }

  MQ.BabyG = BabyG;
})(window.MQ);
