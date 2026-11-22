/*
 * Jetpack: hold Jump while airborne to fly. Fuel drains in flight and refills on the ground.
 * A fresh press in the air fires at once. Holding after a jump fires as the jump tops out,
 * which keeps tap-versus-hold jump heights intact.
 */
(function (MQ) {
  const { approach, rand, clamp } = MQ.U;
  const THRUST = 4300;
  const IGNITE_BELOW = -150; // Upward speed at which a held jump turns into flight.

  class Jetpack {
    constructor(world, upgrade) {
      this.world = world;
      this.on = false;
      this.thrust = 0;
      this.exhaust = 0;
      this.setUpgrade(upgrade);
    }

    setUpgrade(upgrade) {
      this.upgrade = upgrade;
      this.fuel = upgrade ? upgrade.fuel : 0;
    }

    get fraction() {
      return this.upgrade ? this.fuel / this.upgrade.fuel : 0;
    }

    refill() {
      if (this.upgrade) this.fuel = this.upgrade.fuel;
    }

    drain(amount) {
      this.fuel = Math.max(0, this.fuel - amount);
    }

    update(player, held, freshPress, dt) {
      const { upgrade, world } = this;
      if (!upgrade) return;

      if (player.grounded) {
        this.fuel = clamp(this.fuel + upgrade.fuel * upgrade.refill * dt, 0, upgrade.fuel);
      }

      const ready = this.on || freshPress || player.vy > IGNITE_BELOW;
      const active = held && !player.grounded && this.fuel > 0 && ready && !player.locked;

      if (active !== this.on) {
        this.on = active;
        world.sfx(active ? "jetStart" : "jetStop");
        const x = player.x - player.facing * 20;
        if (active) world.particles.flash(x, player.y - 34, 70, "#ff9a30", 0.2);
        else world.particles.smoke(x, player.y - 34, "#8a8480", 3, 6);
      }

      this.thrust = approach(this.thrust, active ? 1 : 0, dt * 9);
      if (!active) return;

      this.fuel = Math.max(0, this.fuel - dt);
      // The extra speed cancels this frame's gravity.
      player.vy = approach(player.vy, -upgrade.speed, (THRUST + MQ.DATA.PHYSICS.gravity) * dt);

      this.exhaust -= dt;
      if (this.exhaust <= 0) {
        this.exhaust = 0.025;
        const x = player.x - player.facing * 22;
        world.particles.flame(x + rand(-3, 3), player.y - 30, rand(-30, 30) - player.vx * 0.1, rand(160, 280), rand(6, 10), 0.28);
        if (Math.random() < 0.4) world.particles.smoke(x, player.y - 10, "#7a7470", 1, 5);
        world.sfx("jetpack");
      }
    }
  }

  MQ.Jetpack = Jetpack;
})(window.MQ);
