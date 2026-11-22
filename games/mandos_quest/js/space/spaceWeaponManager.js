/* The ship's guns and its upgrade bar. Capsules move the highlight, and activating installs it. */
(function (MQ) {
  const S = MQ.SPACE;
  const { PRIMARY: GUN, SECONDARY: ROCKET, UPGRADES } = S;
  const { cos, sin, min, floor } = Math;

  const CYAN = "#7fe6ff";
  const PLASMA = "#9dffcf";
  const SPREAD_ANGLES = [0.2, 0.38];

  class SpaceWeaponManager {
    constructor(world, player) {
      this.world = world;
      this.player = player;
      this.projectiles = world.projectiles;
      this.ship = world.stats;
      this.levels = {};
      this.installed = []; // In the order they were installed.
      this.cursor = -1;
      this.cooldown = 0;
      this.missileTime = 0;
      this.laserTime = 0;
      this.beam = 0;
      this.rocketWait = 0;
      this.ammo = ROCKET.ammo;
      this.reload = 0;
      this.muzzle = 0;
      for (const upgrade of UPGRADES) this.levels[upgrade.id] = 0;
      this.applyBase();
    }

    // The final ship configuration starts every life armed.
    applyBase() {
      if (!this.ship.vanguard) return;
      this.levels.twin = Math.max(1, this.levels.twin);
      this.levels.missile = Math.max(1, this.levels.missile);
    }

    unlocked(upgrade) {
      return !upgrade.level || this.ship.upgrades.includes(upgrade.id);
    }

    available(index) {
      const upgrade = UPGRADES[index];
      if (!this.unlocked(upgrade)) return false;
      // A shield can always be installed again once it has taken damage.
      if (upgrade.id === "shield") return this.player.energy < this.player.energyMax;
      return this.levels[upgrade.id] < upgrade.max;
    }

    get highlighted() {
      return this.cursor < 0 ? null : UPGRADES[this.cursor];
    }

    // Returns false when there was nothing left to advance to.
    collectCapsule() {
      for (let step = 1; step <= UPGRADES.length; step++) {
        const index = (this.cursor + step) % UPGRADES.length;
        if (!this.available(index)) continue;
        this.cursor = index;
        return true;
      }
      return false;
    }

    activate() {
      const upgrade = this.highlighted;
      if (!upgrade || !this.available(this.cursor)) {
        this.world.sfx("empty");
        return null;
      }
      if (upgrade.id === "shield") this.player.raiseEnergyShield();
      else this.installed.push(upgrade.id);
      this.levels[upgrade.id] = min(upgrade.max, this.levels[upgrade.id] + 1);
      this.cursor = -1;
      return upgrade;
    }

    loseLife(keep) {
      const kept = keep === "all" ? this.installed.length : keep === "half" ? floor(this.installed.length / 2) : 0;
      this.installed.length = kept;
      for (const upgrade of UPGRADES) this.levels[upgrade.id] = 0;
      for (const id of this.installed) this.levels[id]++;
      if (keep !== "all") this.cursor = -1;
      this.beam = 0;
      this.ammo = ROCKET.ammo;
      this.applyBase();
    }

    update(firing, secondary, dt) {
      this.cooldown -= dt;
      this.missileTime -= dt;
      this.laserTime -= dt;
      this.beam -= dt;
      this.rocketWait -= dt;
      this.muzzle -= dt;
      if (this.ammo < ROCKET.ammo) {
        this.reload += dt;
        if (this.reload >= ROCKET.recharge) {
          this.reload = 0;
          this.ammo++;
        }
      }

      if (secondary) this.launchRockets();
      if (!firing) return;
      if (this.cooldown <= 0) this.shoot();
      if (this.levels.missile && this.missileTime <= 0) this.dropMissiles();
      if (this.levels.laser && this.laserTime <= 0) this.fireLaser();
    }

    shoot() {
      const { levels, player } = this;
      const { vanguard } = this.ship;
      const x = player.x + 66;
      const { y } = player;
      const boost = vanguard ? GUN.vanguardDamage : 1;
      const color = vanguard ? PLASMA : CYAN;
      const r = vanguard ? 5 : 4;
      this.cooldown = GUN.cooldown;
      this.muzzle = 0.06;

      if (levels.twin) {
        const damage = GUN.twinDamage * boost;
        this.bolt(x, y - 11, 0, damage, color, r);
        this.bolt(x, y + 11, 0, damage, color, r);
        if (levels.twin > 1) this.bolt(x + 10, y, 0, damage, color, r);
      } else {
        this.bolt(x, y, 0, GUN.damage * boost, color, r);
      }
      for (let i = 0; i < levels.spread; i++) {
        this.bolt(x - 8, y - 8, -SPREAD_ANGLES[i], GUN.spreadDamage * boost, "#ffd45c", 3.5);
        this.bolt(x - 8, y + 8, SPREAD_ANGLES[i], GUN.spreadDamage * boost, "#ffd45c", 3.5);
      }
      if (levels.rear) {
        this.bolt(player.x - 62, y - 8, Math.PI, GUN.rearDamage * boost, "#ff9bd2", 4);
        if (levels.rear > 1) {
          this.bolt(player.x - 62, y + 6, Math.PI - 0.24, GUN.rearDamage * boost, "#ff9bd2", 4);
          this.bolt(player.x - 62, y - 10, Math.PI + 0.24, GUN.rearDamage * boost, "#ff9bd2", 4);
        }
      }
      this.world.sfx("shipBlaster");
    }

    bolt(x, y, angle, damage, color, r) {
      const { PLAYER, KIND } = MQ.SpaceProjectiles;
      this.projectiles.fire(PLAYER, KIND.BOLT, x, y, cos(angle) * GUN.speed, sin(angle) * GUN.speed, damage, color, r);
    }

    dropMissiles() {
      const { PLAYER, KIND } = MQ.SpaceProjectiles;
      this.missileTime = GUN.missileEvery;
      for (let i = 0; i < this.levels.missile; i++) {
        const p = this.projectiles.fire(PLAYER, KIND.GROUND, this.player.x + 6 - i * 34, this.player.y + 22, 170 - i * 70, 340, GUN.missileDamage, "#ff9b4d", 8);
        if (p) p.blast = GUN.missileBlast;
      }
      this.world.sfx("shipMissile");
    }

    fireLaser() {
      const i = this.levels.laser - 1;
      this.laserTime = GUN.laserEvery;
      this.beam = GUN.laserTime;
      this.world.collision.laser(this.player.x + 70, this.player.y, GUN.laserWidth[i], GUN.laserDamage[i]);
      this.world.sfx("shipLaser");
    }

    launchRockets() {
      if (this.rocketWait > 0) return;
      if (!this.ammo) {
        this.world.sfx("empty");
        return;
      }
      const { PLAYER, KIND } = MQ.SpaceProjectiles;
      const count = this.ship.vanguard ? ROCKET.vanguardCount : ROCKET.count;
      this.ammo--;
      this.rocketWait = ROCKET.cooldown;
      for (let i = 0; i < count; i++) {
        const a = (i - (count - 1) / 2) * 0.48;
        const p = this.projectiles.fire(PLAYER, KIND.SEEKER, this.player.x + 20, this.player.y, cos(a) * ROCKET.speed, sin(a) * ROCKET.speed, ROCKET.damage, "#ffd45c", 8);
        if (p) {
          p.life = 2.8;
          p.blast = 34;
        }
      }
      this.world.sfx("shipMissile");
    }
  }

  MQ.SpaceWeaponManager = SpaceWeaponManager;
})(window.MQ);
