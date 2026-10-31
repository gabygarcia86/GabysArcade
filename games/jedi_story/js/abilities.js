/*
 * ForceAbility: the Force Push wave, and the table of upgrades earned level by
 * level. A level's upgrades arrive when the player starts that level.
 */
(function (J) {
  const { overlap } = J.U;

  // Index matches the level that grants the upgrade.
  const UNLOCKS = [
    { ids: ["saber", "jump", "push", "deflect"], name: "Jedi Basics", desc: "Lightsaber, Jump, Force Push and Deflect." },
    { ids: ["combo3"], name: "Improved Combo", desc: "Your attack chain grows to three strikes." },
    { ids: ["doubleJump"], name: "Double Jump", desc: "Press Jump again in midair." },
    { ids: ["pushPlus"], name: "Improved Force Push", desc: "A longer, stronger wave that costs less energy." },
    { ids: ["deflectPlus"], name: "Improved Deflection", desc: "A wider perfect window. Perfect deflections seek their target." },
    { ids: ["aerial"], name: "Aerial Saber Attacks", desc: "Attack in midair to spin and hang in the air. Chain up to three." },
    { ids: ["forcePlus"], name: "Enhanced Force Energy", desc: "A bigger Force meter that refills faster." },
    { ids: ["combo4"], name: "Advanced Combos", desc: "A fourth strike: a whirling finisher that hits all around you." },
    { ids: ["forceMaster"], name: "Force Mastery", desc: "Force Push shatters enemy guards and stuns all it touches." },
    { ids: ["allPowers"], name: "All Powers", desc: "Every ability is yours. Trust the Force." },
  ];

  const abilityList = () => UNLOCKS.flatMap((entry) => entry.ids);

  class ForceAbility {
    constructor(player) {
      this.player = player;
      this.waves = [];
      this.cooldown = 0;
    }

    get stats() {
      const { has } = this.player;
      const plus = has("pushPlus");
      const master = has("forceMaster");
      return {
        cost: master ? 20 : plus ? 25 : 30,
        range: plus ? 300 : 230,
        power: plus ? 640 : 520,
        dmg: master ? 14 : plus ? 10 : 5,
        height: master ? 130 : plus ? 112 : 94,
        stun: master ? 1.2 : 0.7,
        breakGuard: master || plus,
      };
    }

    get ready() { return this.cooldown <= 0 && this.player.energy >= this.stats.cost; }

    cast() {
      const { player } = this;
      const stats = this.stats;
      if (!this.ready) return false;
      player.energy -= stats.cost;
      this.cooldown = 0.55;
      this.waves.push({
        x: player.x + player.facing * 14,
        y: player.y - 34,
        dir: player.facing,
        traveled: 0,
        stats,
        hit: new Set(),
        color: player.saber.fxColor(),
      });
      const { game } = player;
      game.audio.play("push");
      game.camera.shake(4, 0.16);
      game.particles.forceRing(player.x + player.facing * 16, player.y - 34, player.saber.fxPick(), 30);
      return true;
    }

    update(dt) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      const { game } = this.player;
      for (let i = this.waves.length - 1; i >= 0; i--) {
        const wave = this.waves[i];
        const step = 760 * dt;
        wave.x += wave.dir * step;
        wave.traveled += step;
        if (wave.traveled > wave.stats.range) {
          this.waves.splice(i, 1);
          continue;
        }
        const size = wave.stats.height * (0.55 + 0.45 * (wave.traveled / wave.stats.range));
        const box = { x: wave.x - 34, y: wave.y - size / 2, w: 68, h: size };
        this.applyWave(game, wave, box);
      }
    }

    applyWave(game, wave, box) {
      const { stats, dir, hit } = wave;
      for (const enemy of game.enemies) {
        if (enemy.dead || enemy.dormant || hit.has(enemy) || !overlap(box, enemy.box)) continue;
        hit.add(enemy);
        enemy.pushed(dir, stats);
      }
      const { boss } = game;
      if (boss && boss.targetable && !hit.has(boss) && overlap(box, boss.box)) {
        hit.add(boss);
        boss.pushed(dir, stats);
      }
      for (const p of game.projectiles.items) {
        if (!p.alive || p.friendly || hit.has(p)) continue;
        if (box.x < p.x && box.x + box.w > p.x && box.y < p.y && box.y + box.h > p.y) {
          hit.add(p);
          if (p.pushable) {
            p.friendly = true;
            p.vx = dir * 620;
            p.vy = -40;
            p.gravity = 0;
            p.homing = 0;
            p.life = 2;
            p.dmg = 26;
          } else if (p.kind === "bolt" || p.kind === "orb") {
            p.reflect(null, false);
            p.vx = Math.abs(p.vx) * dir;
          }
        }
      }
      game.level.onForceWave(box, dir, stats, hit);
    }

    draw(ctx, t) {
      ctx.globalCompositeOperation = "lighter";
      for (const wave of this.waves) {
        const k = wave.traveled / wave.stats.range;
        const size = wave.stats.height * (0.55 + 0.45 * k);
        const alpha = 1 - k * k;
        const color = this.player.saber.spec.rainbow ? `hsl(${(t * 300 + k * 200) % 360},100%,65%)` : wave.color;
        ctx.strokeStyle = color;
        for (let i = 0; i < 3; i++) {
          const offset = i * 15;
          ctx.globalAlpha = alpha * (0.75 - i * 0.2);
          ctx.lineWidth = 7 - i * 2;
          ctx.beginPath();
          ctx.ellipse(wave.x - wave.dir * offset, wave.y, 15 + 15 * k, size / 2 - i * 3, 0,
            wave.dir > 0 ? -1.25 : Math.PI - 1.25, wave.dir > 0 ? 1.25 : Math.PI + 1.25);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  J.ForceAbility = ForceAbility;
  J.ABILITY_UNLOCKS = UNLOCKS;
  J.allAbilityIds = abilityList;
})(window.JEDI);
