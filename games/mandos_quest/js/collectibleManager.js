/* Bounty Pucks, credit chips and supply pickups. */
(function (MQ) {
  const { hypot } = Math;
  const PUCK_RADIUS = 26;

  class CollectibleManager {
    constructor(world, pucks, pickups) {
      this.world = world;
      const owned = world.save.pucks[world.def.id - 1];
      this.pucks = pucks.map((p, index) => ({ x: p.x, y: p.y, index, owned: owned[index], taken: false }));
      this.pickups = pickups.map((p) => ({ x: p.x, y: p.y, kind: p.kind, taken: false, life: Infinity }));
      this.creditTotal = this.pickups.filter((p) => p.kind === "credit").length;
      world.run.credits = 0;
      world.run.creditTotal = this.creditTotal;
    }

    drop(kind, x, y) {
      let item = this.pickups.find((p) => p.taken && p.dropped);
      if (!item) {
        item = { dropped: true };
        this.pickups.push(item);
      }
      Object.assign(item, { x, y, kind, taken: false, life: 14 });
    }

    near(x, y, radius) {
      for (let i = 0; i < this.pucks.length; i++) {
        const p = this.pucks[i];
        if (!p.taken && !p.owned && hypot(p.x - x, p.y - y) < radius) return true;
      }
      return false;
    }

    update(dt) {
      const { player } = this.world;
      if (player.dead) return;
      for (let i = 0; i < this.pucks.length; i++) {
        const p = this.pucks[i];
        if (!p.taken && MQ.nearBody(player, p.x, p.y, PUCK_RADIUS)) this.collectPuck(p);
      }
      for (let i = 0; i < this.pickups.length; i++) {
        const p = this.pickups[i];
        if (p.taken) continue;
        p.life -= dt;
        if (p.life <= 0) p.taken = true;
        else if (p.kind === "credit") {
          if (MQ.nearBody(player, p.x, p.y, 22)) this.collectCredit(p);
        } else if (MQ.nearBody(player, p.x, p.y - 14, 20)) this.collectPickup(p);
      }
    }

    collectPuck(puck) {
      const { world } = this;
      puck.taken = true;
      world.particles.ring(puck.x, puck.y, 120, "#ff8a70", 0.6);
      world.particles.ring(puck.x, puck.y, 60, "#ffd45c", 0.4);
      world.particles.sparks(puck.x, puck.y, "#ffd45c", 26, 420);
      world.particles.flash(puck.x, puck.y, 130, "#ff6a5c", 0.4);
      world.sfx("puck");
      world.baby.react("happy", 2.5);

      if (puck.owned) {
        world.toast("BOUNTY PUCK", "Already in your collection");
        return;
      }
      puck.owned = true;
      const { progression, def } = world;
      const saberUnlocked = progression.collectPuck(def.id, puck.index);
      world.toast("BOUNTY PUCK COLLECTED", `${progression.levelPucks(def.id)} of 3 in this level  ·  ${progression.totalPucks()} of 30 overall`);
      if (saberUnlocked) world.darksaberUnlocked();
    }

    collectCredit(item) {
      const { world } = this;
      item.taken = true;
      world.run.credits++;
      world.addPoints(MQ.DATA.CREDIT_POINTS, item.x, item.y);
      world.particles.sparks(item.x, item.y, "#5fe0ff", 8, 220);
      world.sfx("credit");
    }

    collectPickup(item) {
      const { world } = this;
      const { player } = world;
      if (item.kind === "health") {
        // Leave it there until it's needed.
        if (player.hp >= player.maxHp) return;
        const gained = player.heal(Math.max(30, player.maxHp * 0.3));
        world.particles.label(player.x, player.y - 100, `+${gained}`, "#5dff9a");
      } else {
        player.weapons.refill();
        player.jetpack.refill();
        world.particles.label(player.x, player.y - 100, "SUPPLIES", "#ffd45c");
      }
      item.taken = true;
      world.particles.sparks(item.x, item.y - 14, item.kind === "health" ? "#5dff9a" : "#ffd45c", 12);
      world.sfx("pickup");
    }

    draw(ctx, camera, time) {
      for (let i = 0; i < this.pickups.length; i++) {
        const p = this.pickups[i];
        if (p.taken || !camera.sees(p.x, p.y, 60)) continue;
        if (p.life < 3 && time % 0.3 < 0.12) continue;
        if (p.kind === "credit") MQ.ObjectArt.credit(ctx, p.x, p.y, time);
        else MQ.ObjectArt.pickup(ctx, p, time);
      }
      for (let i = 0; i < this.pucks.length; i++) {
        const p = this.pucks[i];
        if (!p.taken && camera.sees(p.x, p.y, 70)) MQ.ObjectArt.puck(ctx, p.x, p.y, time, p.owned);
      }
    }
  }

  MQ.CollectibleManager = CollectibleManager;
})(window.MQ);
