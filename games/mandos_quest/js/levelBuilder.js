/*
 * The vocabulary the level files are written in.
 *
 * x and y are world pixels, with y pointing down. Blocks, ledges, crates and walls are
 * placed by their left edge. Characters, switches and scenery are placed by the middle
 * of their base.
 *
 * For reference: a jump climbs about 150px and crosses about 250px. The jetpack adds
 * roughly 500px of climb once unlocked.
 */
(function (MQ) {
  const DEEP = 500; // How far ground extends below the bottom of the level.

  class LevelBuilder {
    constructor(def) {
      this.width = def.width;
      this.height = def.height;
      this.mat = def.material;
      this.terrain = [];
      this.slopes = [];
      this.rooms = [];
      this.decor = [];
      this.covers = [];
      this.movers = [];
      this.falls = [];
      this.crates = [];
      this.walls = [];
      this.rubble = [];
      this.boulders = [];
      this.mechanisms = [];
      this.gates = [];
      this.bridges = [];
      this.hazards = [];
      this.winds = [];
      this.pucks = [];
      this.pickups = [];
      this.checkpoints = [];
      this.foes = [];
      this.triggers = [];
      this.encounters = [];
      this.nodes = [];
      this.combined = [];
      this.cell = null;
      this.arenaDef = null;
      this.exitDef = null;
    }

    /* ---------- Terrain ---------- */

    material(name) {
      this.mat = name;
    }

    ground(x0, x1, y, mat = this.mat) {
      return this.block(x0, y, x1 - x0, this.height + DEEP - y, mat);
    }

    block(x, y, w, h, mat = this.mat) {
      const solid = { x, y, w, h, mat, terrain: true };
      this.terrain.push(solid);
      return solid;
    }

    // Walkable slopes through a list of [x, y] points. They must meet the neighboring ground.
    hill(points, mat = this.mat) {
      for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        this.slopes.push({ x0, y0, x1, y1, mat, bottom: this.height + DEEP });
      }
    }

    // One-way: jump up through it, press Down to drop through.
    ledge(x, y, w, mat = this.mat) {
      this.terrain.push({ x, y, w, h: 14, mat, oneWay: true, terrain: true });
    }

    move(x, y, w, dx, dy, period = 4, phase = 0, mat = this.mat) {
      this.movers.push({ x, y, w, h: 18, baseX: x, baseY: y, dx, dy, period, phase, mat, oneWay: true, dynamic: true });
    }

    fall(x, y, w, mat = this.mat) {
      this.falls.push({ x, y, w, h: 14, baseY: y, mat, oneWay: true, dynamic: true, state: 0, timer: 0, speed: 0 });
    }

    /* ---------- Objects ---------- */

    crate(x, bottom, options = {}) {
      const size = options.size || 48;
      this.crates.push({ x, y: bottom - size, w: size, h: size, hp: 24, maxHp: 24, drop: options.drop, barrel: options.barrel });
    }

    // A cracked wall that any weapon breaks.
    wall(x, bottom, w, h, options = {}) {
      const hp = options.hp || 50;
      this.walls.push({ x, y: bottom - h, w, h, hp, maxHp: hp, id: options.id, mat: options.mat || this.mat, seed: x + bottom });
    }

    // Only Force Push clears rubble.
    rubbleWall(x, bottom, w, h, id) {
      this.rubble.push({ x, y: bottom - h, w, h, id, seed: x * 3 + bottom });
    }

    // Force Push slides it by [dx, dy]. Heavy ones need Baby G's Level 7 upgrade.
    boulder(x, bottom, w, h, [dx, dy], options = {}) {
      this.boulders.push({ x, y: bottom - h, w, h, fromX: x, fromY: bottom - h, dx, dy, heavy: !!options.heavy, id: options.id, dynamic: true, moved: false, k: 0 });
    }

    mechanism(id, x, y, options = {}) {
      this.mechanisms.push({ id, x, y, heavy: !!options.heavy, active: false });
    }

    /*
     * Opens when every id in need is active. The seal is an invisible extension up to
     * options.seal (the top of the level by default), so gates can't be flown over.
     */
    gate(x, top, bottom, need, options = {}) {
      this.gates.push({
        x, top, bottom, need,
        w: options.w || 24,
        seal: options.seal ?? 0,
        energy: !!options.energy,
        color: options.color || "#e0a43a",
        open: 0,
        opening: false,
      });
    }

    bridge(id, x, y, w, mat = this.mat) {
      this.bridges.push({ id, x, y, w, h: 14, mat, oneWay: true, active: false, age: 0 });
    }

    hazard(kind, x, y, w, h, options = {}) {
      this.hazards.push({ kind, x, y, w, h, period: 0, duty: 0.5, phase: 0, on: true, warn: false, falling: false, rockY: y, ...options });
    }

    wind(x, y, w, h, speed = 420) {
      this.winds.push({ x, y, w, h, speed });
    }

    /* ---------- Scenery ---------- */

    room(kind, x, y, w, h) {
      this.rooms.push({ kind, x, y, w, h });
    }

    secret(x, y, w, h, mat = this.mat) {
      this.covers.push({ x, y, w, h, mat, alpha: 1, found: false });
    }

    deco(type, x, y, options = {}) {
      this.decor.push({ type, x, y, options });
    }

    /* ---------- Pickups and characters ---------- */

    puck(x, y) {
      this.pucks.push({ x, y });
    }

    health(x, y) {
      this.pickups.push({ kind: "health", x, y });
    }

    supplies(x, y) {
      this.pickups.push({ kind: "ammo", x, y });
    }

    checkpoint(x, y) {
      this.checkpoints.push({ x, y, active: false });
    }

    foe(type, x, y, options) {
      this.foes.push({ type, x, y, options });
    }

    /* ---------- Story and objectives ---------- */

    // area is [y0, y1], for levels with more than one floor.
    say(x, who, text, area = [0, this.height]) {
      this.triggers.push({ x, y: area[0], w: 120, h: area[1] - area[0], who, text, done: false });
    }

    /*
     * options: touch (text for touchscreens), area, needs ("jetpack" or "force"),
     * and first (only show before this level has been completed).
     */
    hint(x, text, options = {}) {
      const [y0, y1] = options.area || [0, this.height];
      this.triggers.push({ x, y: y0, w: 120, h: y1 - y0, text, touch: options.touch, needs: options.needs, first: options.first, hint: true, done: false });
    }

    reach(id, x, y, w, h) {
      this.triggers.push({ id, x, y, w, h, done: false });
    }

    // area is { x0, x1, floor, height }. Each wave is a list of [type, x, y].
    encounter(id, area, waves) {
      this.encounters.push({
        id, waves,
        x0: area.x0, x1: area.x1, floor: area.floor, top: area.floor - (area.height || 520),
        state: "waiting", wave: 0, timer: 0, locked: false,
      });
    }

    // Activates id once everything in need is active, in any order.
    combine(id, need) {
      this.combined.push({ id, need });
    }

    node(id, x, y, options = {}) {
      const hp = options.hp || 40;
      const big = !!options.big;
      this.nodes.push({ id, x, y, w: big ? 64 : 40, h: big ? 125 : 70, hp, maxHp: hp, big, color: options.color || "#ff5348", dead: false });
    }

    containment(id, x, y, need) {
      this.cell = { id, x, y, need, open: 0, opening: false };
    }

    arena(boss, x0, x1, floor, scene) {
      this.arenaDef = { boss, x0, x1, floor, scene, started: false, locked: false };
    }

    exit(x, y) {
      this.exitDef = { x, y };
    }
  }

  MQ.LevelBuilder = LevelBuilder;
})(window.MQ);
