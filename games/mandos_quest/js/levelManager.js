/* Builds a level and runs everything in it: platforms, switches, hazards and triggers. */
(function (MQ) {
  const { approach, clamp, smooth, lerp, rand } = MQ.U;
  const { abs, sin, max, min, PI } = Math;
  const Art = MQ.ObjectArt;

  const DEADLY = new Set(["lava", "acid", "water"]);
  const PERIODIC = { electric: 0.5, steam: 0.6, laser: 0.55 };
  const HAZARD_DAMAGE = { spikes: 14, electric: 14, steam: 13, laser: 16, rocks: 16 };
  const CRUMBLE_DELAY = 0.55;
  const REFORM_DELAY = 2.8;
  const ROCK_FALL = 0.5;
  const WAVE_DELAY = 0.8;

  class LevelManager {
    constructor(world, def) {
      this.world = world;
      this.def = def;
      const b = (this.data = new MQ.LevelBuilder(def));
      def.build(b);

      this.width = def.width;
      this.height = def.height;
      this.active = new Set();
      this.forceObjects = [];
      this.objective = 0;
      this.col = new MQ.CollisionManager(def.width, def.height);
      this.walls = [];
      this.build();
      this.renderer = new MQ.TerrainRenderer(b);
    }

    build() {
      const { data, col } = this;

      for (const solid of data.terrain) {
        col.add(solid);
        // No surface trim where another block sits flush on top.
        solid.covered = !solid.oneWay && data.terrain.some((o) =>
          !o.oneWay && o !== solid && o.y + o.h === solid.y && o.x <= solid.x && o.x + o.w >= solid.x + solid.w);
        // No shaded edge where a slope carries on at the same height.
        solid.joinLeft = data.slopes.some((s) => s.x1 === solid.x && s.y1 === solid.y);
        solid.joinRight = data.slopes.some((s) => s.x0 === solid.x + solid.w && s.y0 === solid.y);
      }
      for (const s of data.slopes) col.addSlope(s.x0, s.y0, s.x1, s.y1);
      for (const p of data.movers) col.add(p);
      for (const p of data.falls) col.add(p);

      for (const crate of data.crates) {
        col.add(crate);
        crate.hurt = (amount) => this.damageObject(crate, amount);
      }
      for (const wall of data.walls) {
        col.add(wall);
        wall.hurt = (amount) => this.damageObject(wall, amount);
      }
      for (const r of data.rubble) {
        col.add(r);
        this.addForceObject(r.x + r.w / 2, r.y, r.y + r.h, r.w / 2, false, () => this.clearRubble(r));
      }
      for (const b of data.boulders) {
        col.add(b);
        this.addForceObject(b.x + b.w / 2, b.y, b.y + b.h, b.w / 2, b.heavy, () => this.moveBoulder(b));
      }
      for (const m of data.mechanisms) {
        this.addForceObject(m.x, m.y - 90, m.y, 26, m.heavy, () => this.wakeMechanism(m));
      }
      for (const gate of data.gates) {
        gate.solid = col.add({ x: gate.x, y: gate.seal, w: gate.w, h: gate.bottom - gate.seal });
      }
      for (const bridge of data.bridges) {
        bridge.active = false;
        col.add(bridge);
      }

      this.targets = data.nodes.map((node) => {
        const target = { x: node.x, y: node.y, w: node.w, h: node.h, node, priority: 1.4, claimed: -1, burned: -1, hittable: true };
        target.hurt = (amount) => this.damageNode(target, amount);
        return target;
      });

      for (const encounter of data.encounters) encounter.walls = this.makeWalls(encounter, encounter.top - 400);
      if (data.arenaDef) data.arenaDef.walls = this.makeWalls(data.arenaDef, 0);
    }

    makeWalls(area, top) {
      const bottom = area.floor;
      return [area.x0 - 20, area.x1].map((x) => this.col.add({ x, y: top, w: 20, h: bottom - top, active: false }));
    }

    addForceObject(cx, top, bottom, halfWidth, heavy, run) {
      const object = { cx, top, bottom, halfWidth, heavy, used: false };
      object.activate = () => {
        object.used = true;
        run();
      };
      this.forceObjects.push(object);
    }

    /* ---------- Queries ---------- */

    hazardAt(x, y) {
      const list = this.data.hazards;
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        if (h.kind === "rocks") continue;
        if (x >= h.x && x <= h.x + h.w && y >= h.y - 6 && y <= h.y + h.h + 6) return true;
      }
      return false;
    }

    hazardNear(x, y, radius) {
      const list = this.data.hazards;
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        if (x + radius > h.x && x - radius < h.x + h.w && y + radius > h.y && y - radius < h.y + h.h) return true;
      }
      return false;
    }

    deadlyAt(x, y) {
      const list = this.data.hazards;
      for (let i = 0; i < list.length; i++) {
        const h = list[i];
        if (DEADLY.has(h.kind) && x >= h.x && x <= h.x + h.w && y >= h.y + 6 && y <= h.y + h.h) return true;
      }
      return false;
    }

    forceNear(x, y, radius) {
      if (!this.world.stats.force) return false;
      for (let i = 0; i < this.forceObjects.length; i++) {
        const o = this.forceObjects[i];
        if (!o.used && abs(o.cx - x) < radius && abs((o.top + o.bottom) / 2 - y) < radius) return true;
      }
      return false;
    }

    allActive(ids) {
      for (let i = 0; i < ids.length; i++) {
        if (!this.active.has(ids[i])) return false;
      }
      return true;
    }

    get objectiveText() {
      return this.def.objectives[this.objective]?.text || "Mission accomplished";
    }

    get exitOpen() {
      // The last objective is always the exit or the boss.
      return this.objective >= this.def.objectives.length - 1;
    }

    /* ---------- Events ---------- */

    activate(id) {
      if (!id || this.active.has(id)) return;
      this.active.add(id);
      for (const bridge of this.data.bridges) {
        if (bridge.id === id) bridge.active = true;
      }

      for (const { id: group, need } of this.data.combined) {
        if (this.allActive(need)) this.activate(group);
      }

      const { objectives } = this.def;
      const before = this.objective;
      while (this.objective < objectives.length) {
        const { done } = objectives[this.objective];
        if (!done || !this.active.has(done)) break;
        this.objective++;
      }
      if (this.objective !== before && this.objective < objectives.length) {
        this.world.toast("NEW OBJECTIVE", this.objectiveText);
      }
    }

    damageObject(object, amount) {
      if (!object.active) return false;
      object.hp -= amount;
      if (object.hp > 0) {
        this.world.particles.chunks(object.x + object.w / 2, object.y + object.h / 2, "#6b5a4a", 3, 160);
        return true;
      }
      this.breakObject(object);
      return true;
    }

    breakObject(object) {
      const { world } = this;
      object.active = false;
      const x = object.x + object.w / 2;
      const y = object.y + object.h / 2;
      world.particles.chunks(x, y, object.barrel ? "#8a4038" : "#7a6450", 14);
      world.particles.dust(x, object.y + object.h, "#9a8a7a", 8);
      world.sfx("crumble");
      if (object.drop) world.collectibles.drop(object.drop, x, object.y + object.h);
      this.activate(object.id);
      if (object.barrel) world.blast(x, y, 140, 55 * world.stats.damage, 0);
    }

    clearRubble(r) {
      const { world } = this;
      r.active = false;
      world.particles.chunks(r.x + r.w / 2, r.y + r.h / 2, "#57504a", 20, 400);
      world.particles.ring(r.x + r.w / 2, r.y + r.h / 2, 100, "#6ec8ff");
      world.sfx("crumble");
      this.activate(r.id);
    }

    moveBoulder(b) {
      b.moved = true;
      this.world.sfx("crumble");
      this.world.camera.shake(0.3);
    }

    wakeMechanism(m) {
      m.active = true;
      this.world.sfx("mechanism");
      this.world.particles.ring(m.x, m.y - 66, 110, "#6dff9a");
      this.activate(m.id);
    }

    damageNode(target, amount) {
      const { node } = target;
      if (node.dead) return false;
      node.hp -= amount;
      if (node.hp > 0) return true;
      node.dead = true;
      target.hittable = false;
      const { world } = this;
      world.particles.explosion(node.x, node.y - node.h / 2, node.big ? 1.3 : 0.5);
      world.sfx("explosion");
      world.camera.shake(node.big ? 0.6 : 0.25);
      world.addPoints(node.big ? 750 : 150, node.x, node.y - node.h);
      this.activate(node.id);
      return true;
    }

    // Used by bosses that trash the arena.
    smash(x, y, radius) {
      for (const crate of this.data.crates) {
        if (!crate.active) continue;
        if (abs(crate.x + crate.w / 2 - x) < radius && abs(crate.y + crate.h / 2 - y) < radius) this.breakObject(crate);
      }
    }

    collapse(x0, x1, count) {
      const standing = this.data.falls.filter((p) => p.state === 0 && p.x >= x0 && p.x <= x1);
      for (let i = 0; i < count && standing.length; i++) {
        const [p] = standing.splice(Math.floor(rand(0, standing.length)), 1);
        p.state = 1;
        p.timer = CRUMBLE_DELAY;
      }
    }

    lock(area, locked) {
      area.locked = locked;
      for (const wall of area.walls) wall.active = locked;
    }

    // Encounters still in progress start over when the player respawns.
    resetEncounters() {
      for (const e of this.data.encounters) {
        if (e.state !== "fighting") continue;
        for (const foe of this.world.enemies) {
          if (foe.group !== e) continue;
          foe.dead = true;
          foe.remove = true;
        }
        e.state = "waiting";
        e.wave = 0;
        this.lock(e, false);
      }
    }

    /* ---------- Simulation ---------- */

    // Platforms move before characters, carrying whoever is standing on them.
    updatePlatforms(dt, time) {
      const { data, world } = this;
      const { player, enemies } = world;

      for (let i = 0; i < data.movers.length; i++) {
        const p = data.movers[i];
        const k = (1 - Math.cos(((time + p.phase) / p.period) * PI * 2)) / 2;
        this.shift(p, p.baseX + p.dx * k, p.baseY + p.dy * k, player, enemies);
      }

      for (let i = 0; i < data.falls.length; i++) {
        const p = data.falls[i];
        if (p.state === 0) {
          if (player.grounded && player.ground === p) {
            p.state = 1;
            p.timer = CRUMBLE_DELAY;
            world.sfx("crumble");
          }
        } else if (p.state === 1) {
          p.timer -= dt;
          if (p.timer <= 0) {
            p.state = 2;
            p.speed = 0;
            p.active = false;
            world.particles.chunks(p.x + p.w / 2, p.y + 10, "#6b5a4a", 7, 120);
          }
        } else {
          p.speed += 1500 * dt;
          p.y += p.speed * dt;
          p.timer -= dt;
          if (p.timer < -REFORM_DELAY) {
            p.state = 0;
            p.y = p.baseY;
            p.active = true;
          }
        }
      }

      for (let i = 0; i < data.boulders.length; i++) {
        const b = data.boulders[i];
        if (!b.moved || b.k >= 1) continue;
        b.k = min(1, b.k + dt / 0.9);
        // Slide across first, then drop.
        const across = b.dy ? smooth(b.k / 0.6) : smooth(b.k);
        const down = b.dy ? clamp((b.k - 0.45) / 0.55, 0, 1) ** 2 : 0;
        this.shift(b, b.fromX + b.dx * across, b.fromY + b.dy * down, player, enemies);
        if (b.k === 1) {
          world.particles.dust(b.x + b.w / 2, b.y + b.h, "#8a7a6a", 14, 200);
          world.sfx("land");
          this.activate(b.id);
        }
      }
    }

    shift(solid, x, y, player, enemies) {
      const dx = x - solid.x;
      solid.x = x;
      solid.y = y;
      if (player.grounded && player.ground === solid) {
        player.y = y;
        if (this.col.free(player.x + dx, y, player.w, player.h)) player.x += dx;
      }
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.grounded && e.ground === solid) {
          e.x += dx;
          e.y = y;
        }
      }
    }

    update(dt, time) {
      const { data, world } = this;
      const { player } = world;

      for (let i = 0; i < data.gates.length; i++) {
        const gate = data.gates[i];
        if (!gate.opening && this.allActive(gate.need)) {
          gate.opening = true;
          world.sfx("door");
        }
        if (!gate.opening || gate.open >= 1) continue;
        gate.open = min(1, gate.open + dt * 1.6);
        if (gate.open > 0.8) gate.solid.active = false;
      }
      for (let i = 0; i < data.bridges.length; i++) {
        if (data.bridges[i].active) data.bridges[i].age += dt;
      }

      this.updateHazards(dt, time);
      this.updateCell(dt);
      for (let i = 0; i < data.covers.length; i++) {
        const c = data.covers[i];
        const inside = MQ.touches(player, c.x, c.y, c.x + c.w, c.y + c.h);
        c.alpha = approach(c.alpha, inside ? 0 : c.found ? 0.35 : 1, dt * 4);
        if (inside && !c.found) {
          c.found = true;
          world.toast("SECRET AREA", "Search it carefully");
        }
      }
      if (player.dead || world.frozen) return;

      this.updateCheckpoints();
      this.updateTriggers();
      for (let i = 0; i < data.encounters.length; i++) this.updateEncounter(data.encounters[i], dt);

      const arena = data.arenaDef;
      if (arena && !arena.started && this.exitOpen && player.grounded &&
        player.x > arena.x0 + 120 && player.x < arena.x1 - 120 && player.y > arena.floor - 320 && player.y <= arena.floor + 4) {
        arena.started = true;
        this.lock(arena, true);
        world.startBoss(arena);
      }

      const exit = data.exitDef;
      if (exit && this.exitOpen && MQ.touches(player, exit.x - 34, exit.y - 150, exit.x + 34, exit.y + 2)) world.finish();
    }

    updateHazards(dt, time) {
      const { hazards, winds } = this.data;
      const { world } = this;
      const { player } = world;
      let sinking = false;

      for (let i = 0; i < hazards.length; i++) {
        const h = hazards[i];
        const right = h.x + h.w;
        const bottom = h.y + h.h;

        if (h.period && PERIODIC[h.kind]) {
          const t = (time + h.phase) % h.period;
          const onFor = h.period * h.duty;
          h.on = t < onFor;
          h.warn = !h.on && t > h.period - PERIODIC[h.kind];
        } else if (h.kind === "rocks") {
          const period = h.period || 2.8;
          const t = (time + h.phase) % period;
          h.falling = t < ROCK_FALL;
          h.warn = t > period - 0.9;
          h.rockY = lerp(h.y, bottom, (t / ROCK_FALL) ** 2);
        }
        if (player.dead || world.frozen || player.x + 60 < h.x || player.x - 60 > right) continue;

        if (DEADLY.has(h.kind)) {
          if (MQ.touches(player, h.x + 4, h.y + 10, right - 4, bottom)) world.fellIntoHazard(h.kind);
        } else if (h.kind === "sinksand") {
          if (!MQ.touches(player, h.x, h.y + 2, right, bottom)) continue;
          if (player.y > bottom - 8) world.fellIntoHazard(h.kind);
          else sinking = true;
        } else if (h.kind === "rocks") {
          if (!h.falling || player.invulnerable) continue;
          const cx = h.x + h.w / 2;
          if (MQ.touches(player, cx - 18, h.rockY - 18, cx + 18, h.rockY + 18)) world.hurtPlayer(HAZARD_DAMAGE.rocks, cx);
        } else if (h.on) {
          const inset = h.kind === "laser" ? max(0, h.w / 2 - 6) : 4;
          if (MQ.touches(player, h.x + inset, h.y + (h.kind === "spikes" ? 6 : 0), right - inset, bottom)) {
            if (world.hurtPlayer(HAZARD_DAMAGE[h.kind], h.x + h.w / 2, 260) && h.kind === "spikes") player.vy = -520;
          }
        }
      }
      player.sinking = sinking;

      for (let i = 0; i < winds.length; i++) {
        const w = winds[i];
        if (player.dead || !MQ.touches(player, w.x, w.y, w.x + w.w, w.y + w.h)) continue;
        player.vy = approach(player.vy, -w.speed, 4200 * dt);
        player.jumping = false;
      }
    }

    updateCell(dt) {
      const { cell } = this.data;
      if (!cell || cell.open >= 1) return;
      if (!cell.opening) {
        if (!this.allActive(cell.need)) return;
        cell.opening = true;
        this.world.sfx("door");
      }
      cell.open = min(1, cell.open + dt * 0.8);
      if (cell.open === 1) {
        this.world.rescueBaby(cell);
        this.activate(cell.id);
      }
    }

    updateCheckpoints() {
      const { player } = this.world;
      const list = this.data.checkpoints;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.active || !MQ.touches(player, c.x - 40, c.y - 120, c.x + 40, c.y + 4)) continue;
        c.active = true;
        this.world.setCheckpoint(c.x, c.y, true);
      }
    }

    updateTriggers() {
      const { world } = this;
      const list = this.data.triggers;
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (t.done || !MQ.touches(world.player, t.x, t.y, t.x + t.w, t.y + t.h)) continue;
        t.done = true;
        if (t.id) this.activate(t.id);
        else if (t.who) world.say(t.who, t.text);
        else if (t.hint) world.showHint(t);
      }
    }

    updateEncounter(e, dt) {
      if (e.state === "cleared") return;
      const { world } = this;
      const { player } = world;

      if (e.state === "waiting") {
        if (!player.grounded || player.x < e.x0 + 60 || player.x > e.x1 - 60 || player.y < e.top || player.y > e.floor + 4) return;
        e.state = "fighting";
        e.wave = 0;
        e.timer = WAVE_DELAY;
        this.lock(e, true);
        world.banner("AMBUSH");
        return;
      }

      if (e.timer > 0) {
        e.timer -= dt;
        if (e.timer <= 0) {
          for (const [type, x, y] of e.waves[e.wave]) world.spawn(type, x, y, { aggro: true, group: e });
        }
        return;
      }
      for (let i = 0; i < world.enemies.length; i++) {
        if (world.enemies[i].group === e && !world.enemies[i].dead) return;
      }
      if (++e.wave < e.waves.length) {
        e.timer = WAVE_DELAY;
        return;
      }
      e.state = "cleared";
      this.lock(e, false);
      world.banner("AREA SECURED");
      world.sfx("checkpoint");
      this.activate(e.id);
    }

    /* ---------- Drawing ---------- */

    drawBack(ctx, camera, time) {
      this.renderer.draw(ctx, camera);
      const { data } = this;
      const left = camera.x - 60;
      const right = camera.x + camera.viewW + 60;
      const top = camera.y - 60;
      const bottom = camera.y + camera.viewH + 60;
      const visible = (x, y, w, h) => x < right && x + w > left && y < bottom && y + h > top;

      for (const w of data.winds) if (visible(w.x, w.y, w.w, w.h)) Art.wind(ctx, w, time);
      for (const b of data.bridges) if (visible(b.x, b.y, b.w, 30)) Art.bridge(ctx, b, time);
      for (const p of data.movers) if (visible(p.x, p.y, p.w, 30)) Art.platform(ctx, p, time);
      for (const p of data.falls) if (visible(p.x, p.y, p.w, 24)) Art.falling(ctx, p, time);
      for (const c of data.crates) if (c.active && visible(c.x, c.y, c.w, c.h)) Art.crate(ctx, c);
      for (const w of data.walls) if (w.active && visible(w.x, w.y, w.w, w.h)) Art.cracked(ctx, w);
      for (const r of data.rubble) if (r.active && visible(r.x, r.y, r.w, r.h)) Art.rubble(ctx, r, time);
      for (const b of data.boulders) if (visible(b.x, b.y, b.w, b.h)) Art.boulder(ctx, b, time);
      for (const m of data.mechanisms) if (visible(m.x - 40, m.y - 100, 80, 100)) Art.mechanism(ctx, m, time);
      for (const n of data.nodes) if (visible(n.x - 60, n.y - 160, 120, 160)) Art.node(ctx, n, time);
      for (const c of data.checkpoints) if (visible(c.x - 20, c.y - 90, 60, 90)) Art.checkpoint(ctx, c, time);

      const { cell, exitDef } = data;
      if (cell && visible(cell.x - 70, cell.y - 200, 140, 200)) {
        Art.containment(ctx, cell, time);
      }
      if (exitDef && visible(exitDef.x - 120, exitDef.y - 180, 240, 180)) Art.exit(ctx, exitDef, time, this.exitOpen);
    }

    drawFront(ctx, camera, time) {
      const { data } = this;
      const left = camera.x - 40;
      const right = camera.x + camera.viewW + 40;
      const top = camera.y - 60;
      const bottom = camera.y + camera.viewH + 60;
      const visible = (x, y, w, h) => x < right && x + w > left && y < bottom && y + h > top;

      for (const h of data.hazards) {
        if (visible(h.x, h.y - 20, h.w, h.h + 20)) Art.HAZARD[h.kind](ctx, h, time, max(h.x, left), min(h.x + h.w, right));
      }
      for (const g of data.gates) if (visible(g.x - 6, g.top - 12, g.w + 12, g.bottom - g.top + 12)) Art.gate(ctx, g, time);
      for (const e of data.encounters) {
        if (!e.locked) continue;
        for (const x of [e.x0 - 5, e.x1 + 5]) Art.arenaWall(ctx, x, max(top, e.top), e.floor, time + sin(x));
      }
      const arena = data.arenaDef;
      if (arena?.locked) {
        for (const x of [arena.x0 - 5, arena.x1 + 5]) Art.arenaWall(ctx, x, max(0, top), arena.floor, time);
      }
      for (const c of data.covers) if (visible(c.x, c.y, c.w, c.h)) Art.cover(ctx, c);
    }

    dispose() {
      this.renderer.dispose();
    }
  }

  MQ.LevelManager = LevelManager;
})(window.MQ);
