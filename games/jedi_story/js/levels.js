/*
 * Level holds a built world and runs its moving parts. LevelBuilder lays one out
 * from chunks such as run(), pits() and tower(), keeping a cursor at the end of the
 * floor so far. Chunk sizes stay inside what a jump can reach. See level-data.js.
 *
 * Jump reach: one jump clears a 150px gap or a 100px rise. A double jump clears
 * 240px or 170px.
 */
(function (J) {
  const { clamp, overlap, lerp } = J.U;

  const DEPTH = 2200; // Ground columns run far below anything the camera will show.
  const PIT_DROP = 150; // How far below the floor a pit becomes fatal.
  const BUCKET = 256;

  class Level {
    constructor(def, index) {
      this.def = def;
      this.index = index;
      this.seed = index * 37 + 11;
      this.theme = J.THEMES[def.theme];
      this.solids = [];
      this.movers = [];
      this.crumbles = [];
      this.crates = [];
      this.doors = [];
      this.barriers = [];
      this.bridges = [];
      this.switches = [];
      this.breakables = [];
      this.checkpoints = [];
      this.pickups = [];
      this.hazards = [];
      this.pits = [];
      this.tips = [];
      this.triggers = [];
      this.covers = [];
      this.rooms = [];
      this.spawns = [];
      this.floors = [];
      this.exit = null;
      this.arena = null;
      this.checkpoint = { x: 120, y: 0 };
      this.buckets = new Map();
      this.dynamic = [];
      this.queryStamp = 0;
      this.nearBuffer = [];
      this.alarm = 0;
      this.width = 0;
      this.totalHolocrons = 0;
      this.totalCrystals = 0;
    }

    index_(solid) {
      if (solid.mover || solid.isBridge || solid.kind === "crate" || solid.kind === "crumble") {
        this.dynamic.push(solid);
        return;
      }
      const a = Math.floor(solid.x / BUCKET);
      const b = Math.floor((solid.x + solid.w) / BUCKET);
      for (let i = a; i <= b; i++) {
        if (!this.buckets.has(i)) this.buckets.set(i, []);
        this.buckets.get(i).push(solid);
      }
    }

    // All solids overlapping an x range. The result is a shared array: use it at once.
    near(x0, x1) {
      const out = this.nearBuffer;
      out.length = 0;
      const stamp = ++this.queryStamp;
      const a = Math.floor(x0 / BUCKET);
      const b = Math.floor(x1 / BUCKET);
      for (let i = a; i <= b; i++) {
        const list = this.buckets.get(i);
        if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const s = list[k];
          if (s.stamp !== stamp) {
            s.stamp = stamp;
            out.push(s);
          }
        }
      }
      for (let k = 0; k < this.dynamic.length; k++) {
        const s = this.dynamic[k];
        if (s.x < x1 && s.x + s.w > x0) out.push(s);
      }
      return out;
    }

    pointSolid(x, y) {
      const list = this.near(x - 1, x + 1);
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (s.active && !s.oneway && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
      }
      return false;
    }

    lineBlocked(x0, y0, x1, y1) {
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const k = i / steps;
        if (this.pointSolid(lerp(x0, x1, k), lerp(y0, y1, k))) return true;
      }
      return false;
    }

    // The surface under x near height y, or null if there's a drop there.
    groundBelow(x, y) {
      const list = this.near(x - 1, x + 1);
      let best = null;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s.active || x < s.x || x > s.x + s.w) continue;
        if (s.y >= y - 8 && s.y <= y + 44 && (!best || s.y < best.y)) best = s;
      }
      return best;
    }

    inKillZone(actor) {
      for (let i = 0; i < this.pits.length; i++) {
        const p = this.pits[i];
        if (actor.x > p.x && actor.x < p.x + p.w && actor.y >= p.y) return true;
      }
      return actor.y > this.bottom + 300;
    }

    // Lowest y the camera may show at a world x.
    floorAt(x) {
      const i = clamp(Math.floor(x / 64), 0, this.floorSamples.length - 1);
      return this.floorSamples[i];
    }

    finish() {
      // Smooth the camera floor so it glides over steps instead of snapping.
      const n = Math.ceil(this.width / 64) + 1;
      const raw = new Array(n).fill(null);
      for (const f of this.floors) {
        const a = Math.max(0, Math.floor(f.x0 / 64));
        const b = Math.min(n - 1, Math.ceil(f.x1 / 64));
        for (let i = a; i <= b; i++) raw[i] = raw[i] === null ? f.y : Math.max(raw[i], f.y);
      }
      let last = raw.find((v) => v !== null) || 0;
      for (let i = 0; i < n; i++) {
        if (raw[i] === null) raw[i] = last;
        last = raw[i];
      }
      this.floorSamples = raw.map((_, i) => {
        let sum = 0;
        let count = 0;
        for (let k = -7; k <= 7; k++) {
          const v = raw[clamp(i + k, 0, n - 1)];
          sum += v;
          count++;
        }
        return Math.max(sum / count, raw[i]);
      });
      this.solids.forEach((s) => this.index_(s));
      const ys = this.solids.filter((s) => s.kind === "ground").map((s) => s.y);
      this.top = Math.min(...ys, 0) - 700;
      this.bottom = Math.max(...ys, 0) + PIT_DROP + 60;
      this.baseY = ys[0] || 0;
      this.renderer = new J.LevelRenderer(this);
    }

    update(dt, game) {
      const { player } = game;
      this.t = (this.t || 0) + dt;

      for (const m of this.movers) {
        const oldX = m.x;
        const oldY = m.y;
        m.phase += dt * m.speed;
        const k = (Math.sin(m.phase) + 1) / 2;
        m.x = lerp(m.x0, m.x1, k);
        m.y = lerp(m.y0, m.y1, k);
        m.dx = m.x - oldX;
        m.dy = m.y - oldY;
      }

      for (const c of this.crumbles) {
        if (!c.active) {
          c.respawn -= dt;
          if (c.respawn <= 0) {
            c.active = true;
            c.shake = 0;
            c.fuse = 0;
          }
        } else if (c.fuse > 0) {
          c.fuse -= dt;
          c.shake = c.fuse;
          if (c.fuse <= 0) {
            c.active = false;
            c.respawn = 2.4;
            game.particles.dust(c.x + c.w / 2, c.y + 8, this.theme.dust, 10);
          }
        }
      }

      this.updateCrates(dt, game);

      for (const d of this.doors) {
        if (d.open && d.progress < 1) {
          d.progress = Math.min(1, d.progress + dt * 1.4);
          d.h = d.fullH * (1 - d.progress);
          if (d.progress >= 1) d.active = false;
        }
      }
      for (const b of this.bridges) {
        if (b.extending && b.w < b.fullW) b.w = Math.min(b.fullW, b.w + 520 * dt);
      }
      for (const cover of this.covers) {
        if (cover.reveal) cover.alpha = Math.max(0, cover.alpha - dt * 3);
      }

      this.updateHazards(dt, game);

      const pbox = player.box;
      for (const p of this.pickups) {
        if (p.taken) continue;
        if (overlap(pbox, { x: p.x - 6, y: p.y - 6, w: p.w + 12, h: p.h + 12 })) {
          p.taken = true;
          game.collect(p);
        }
      }

      for (const c of this.checkpoints) {
        if (!c.reached && overlap(pbox, c)) {
          c.reached = true;
          this.checkpoint = { x: c.x + c.w / 2, y: c.y + c.h };
          game.onCheckpoint(c);
        }
      }

      for (const tip of this.tips) {
        if (!tip.shown && player.x > tip.x) {
          tip.shown = true;
          game.hud.tip(game.tipText(tip));
        }
      }

      for (const trigger of this.triggers) {
        if (!trigger.fired && player.x > trigger.x) {
          trigger.fired = true;
          game.fireTrigger(trigger);
        }
      }

      if (this.exit && this.exit.open && overlap(pbox, this.exit)) game.onExitReached();
      if (!player.dead && this.inKillZone(player)) player.fellInPit();
    }

    updateCrates(dt, game) {
      for (const c of this.crates) {
        if (!c.moving && c.settled) continue;
        c.vy = Math.min(c.vy + J.PHYS.GRAVITY * dt, 900);
        const list = this.near(c.x - 4, c.x + c.w + 4);
        let nx = c.x + c.vx * dt;
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (s === c || !s.active || s.oneway) continue;
          if (nx + c.w > s.x && nx < s.x + s.w && c.y + c.h > s.y + 2 && c.y < s.y + s.h) {
            nx = c.vx > 0 ? s.x - c.w : s.x + s.w;
            c.vx = 0;
          }
        }
        c.x = nx;
        let ny = c.y + c.vy * dt;
        let grounded = false;
        for (let i = 0; i < list.length; i++) {
          const s = list[i];
          if (s === c || !s.active) continue;
          if (c.x + c.w > s.x && c.x < s.x + s.w && ny + c.h >= s.y && c.y + c.h <= s.y + 8) {
            ny = s.y - c.h;
            c.vy = 0;
            grounded = true;
          }
        }
        c.y = ny;
        if (grounded) c.vx = J.U.approach(c.vx, 0, 500 * dt);
        c.moving = Math.abs(c.vx) > 1 || !grounded;
        c.settled = !c.moving;
        if (Math.abs(c.vx) > 120) {
          for (const enemy of game.enemies) {
            if (!enemy.dead && !enemy.dormant && overlap(c, enemy.box)) {
              enemy.takeHit({ dmg: 40, dir: Math.sign(c.vx), knock: 320, source: "crate", stun: 0.6 });
            }
          }
        }
        if (this.inKillZone({ x: c.x + c.w / 2, y: c.y + c.h })) {
          // A crate lost in a pit comes back, so a puzzle can't be left unsolvable.
          c.x = c.homeX;
          c.y = c.homeY;
          c.vx = 0;
          c.vy = 0;
          game.particles.forceRing(c.x + c.w / 2, c.y + c.h / 2, this.theme.accent, 40);
        }
      }
    }

    updateHazards(dt, game) {
      const { player } = game;
      const t = this.t;
      for (const h of this.hazards) {
        switch (h.type) {
          case "laser":
          case "arc":
          case "vent": {
            const cycle = (t + h.offset) % h.period;
            const was = h.on;
            h.on = cycle < h.onTime;
            h.warn = !h.on && cycle > h.period - 0.45;
            if (h.on && !was && h.type === "vent" && Math.abs(player.x - h.x) < 500) game.audio.play("push", 0.2);
            if (h.on && h.rect && overlap(h.rect, player.box)) {
              player.takeDamage(h.dmg, Math.sign(player.x - (h.rect.x + h.rect.w / 2)) || -player.facing, { knock: 240 });
            }
            break;
          }
          case "crusher": {
            const cycle = (t + h.offset) % h.period;
            const hold = h.period - 1.2;
            let k;
            if (cycle < hold) k = 0;
            else if (cycle < hold + 0.16) k = (cycle - hold) / 0.16;
            else if (cycle < hold + 0.46) k = 1;
            else k = 1 - (cycle - hold - 0.46) / 0.74;
            const wasDown = h.k >= 1;
            h.k = k;
            h.drop = h.travel * k;
            const bottom = h.top + h.drop;
            if (k >= 1 && !wasDown && Math.abs(player.x - h.x) < 460) {
              game.audio.play("clash", 0.4);
              game.camera.shake(3, 0.1);
            }
            if (k > 0.2 && overlap({ x: h.x + 4, y: bottom - 34, w: h.w - 8, h: 34 }, player.box)) {
              player.takeDamage(h.dmg, player.x < h.x + h.w / 2 ? -1 : 1, { knock: 300 });
            }
            break;
          }
          case "spike":
            if (overlap({ x: h.x + 2, y: h.y - h.height + 6, w: h.w - 4, h: h.height - 6 }, player.box)) {
              player.takeDamage(h.dmg, player.facing * -1, { knock: 220 });
            }
            break;
          case "faller": {
            if (h.gone) {
              h.wait -= dt;
              if (h.wait <= 0) {
                h.gone = false;
                h.falling = false;
                h.cy = h.homeY;
                h.vy = 0;
              }
              break;
            }
            if (!h.falling && Math.abs(player.x - h.x) < 86 && player.y > h.homeY) h.falling = true;
            if (h.falling) {
              h.vy += 1500 * dt;
              h.cy += h.vy * dt;
              if (overlap({ x: h.x - h.w / 2, y: h.cy, w: h.w, h: h.height }, player.box)) {
                player.takeDamage(h.dmg, Math.sign(player.x - h.x) || 1, { knock: 200 });
                h.gone = true;
                h.wait = 3;
              } else if (h.cy + h.height > h.floor) {
                game.particles.dust(h.x, h.floor, this.theme.dust, 9);
                game.audio.play("land", 0.6);
                h.gone = true;
                h.wait = 3;
              }
            }
            break;
          }
          default:
        }
      }
    }

    onForceWave(box, dir, stats, hit) {
      const { game } = this;
      for (const s of this.switches) {
        if (!s.on && !hit.has(s) && overlap(box, s)) {
          hit.add(s);
          s.on = true;
          game.audio.play("switch");
          game.particles.forceRing(s.x + s.w / 2, s.y + s.h / 2, this.theme.accent, 34);
          if (s.onFire) s.onFire();
        }
      }
      for (const b of this.breakables) {
        if (!b.broken && !hit.has(b) && overlap(box, b)) {
          hit.add(b);
          b.smash(game);
        }
      }
      for (const c of this.crates) {
        if (!hit.has(c) && overlap(box, c)) {
          hit.add(c);
          c.vx = dir * stats.power * 0.9;
          c.vy = -70;
          c.moving = true;
          c.settled = false;
          game.audio.play("land");
        }
      }
    }

    drawBack(ctx, cam, t) { this.renderer.drawBack(ctx, cam, t); }
    drawFront(ctx, cam) { this.renderer.drawFront(ctx, cam); }
  }

  // ---------- Building ----------

  class LevelBuilder {
    constructor(level, game) {
      this.level = level;
      this.game = game;
      this.x = 0;
      this.y = 0;
      this.chunkId = 0;
    }

    solid(s) {
      const out = { active: true, oneway: false, kind: "ground", ...s };
      if (this.level.theme.ice && (out.kind === "ground" || out.kind === "float")) out.ice = true;
      this.level.solids.push(out);
      return out;
    }

    floorMark(x0, x1, y) { this.level.floors.push({ x0, x1, y: y + 176 }); }

    // ---------- Primitive chunks ----------

    ground(len) {
      this.solid({ x: this.x, y: this.y, w: len, h: DEPTH });
      this.floorMark(this.x, this.x + len, this.y);
      this.x += len;
      this.level.width = Math.max(this.level.width, this.x);
      return this;
    }

    gap(w) {
      this.level.pits.push({ x: this.x, y: this.y + PIT_DROP, w });
      this.floorMark(this.x, this.x + w, this.y);
      this.x += w;
      return this;
    }

    start() {
      this.ground(460);
      this.level.spawn = { x: 110, y: this.y };
      this.level.checkpoint = { x: 110, y: this.y };
      return this;
    }

    // ---------- Things placed relative to the cursor (dx from the cursor, floor at y) ----------

    enemy(type, x, y, opts = {}) {
      this.level.spawns.push({ type, x, y, opts });
      return this;
    }

    // Enemies spread along the last len pixels of floor.
    place(types, len, y = this.y) {
      const list = Array.isArray(types) ? types : [types];
      const x0 = this.x - len;
      list.forEach((type, i) => {
        const x = x0 + ((i + 1) * len) / (list.length + 1);
        const spread = Math.min(110, len / (list.length + 1) - 10);
        this.enemy(type, x, y, { left: x - spread, right: x + spread });
      });
      return this;
    }

    pickup(kind, x, y) {
      const size = kind === "holocron" ? 26 : 18;
      this.level.pickups.push({ kind, x: x - size / 2, y: y - size / 2, w: size, h: size, taken: false });
      if (kind === "holocron") this.level.totalHolocrons++;
      if (kind === "crystal") this.level.totalCrystals++;
      return this;
    }

    crystals(n, dx = -300, dy = -46, spacing = 42, arc = 0) {
      for (let i = 0; i < n; i++) {
        const k = n > 1 ? i / (n - 1) : 0.5;
        this.pickup("crystal", this.x + dx + i * spacing, this.y + dy - Math.sin(k * Math.PI) * arc);
      }
      return this;
    }

    checkpoint() {
      this.ground(160);
      this.level.checkpoints.push({ x: this.x - 96, y: this.y - 110, w: 40, h: 110, reached: false });
      return this;
    }

    tip(text, keyName) {
      this.level.tips.push({ x: this.x - 40, text, keyName, shown: false });
      return this;
    }

    // ---------- Traversal chunks ----------

    run(len, enemies, opts = {}) {
      this.ground(len);
      if (enemies) this.place(enemies, len - 60);
      if (opts.crystals) this.crystals(opts.crystals, -len + 80, -48, Math.min(44, (len - 120) / opts.crystals));
      return this;
    }

    pits(gaps, island = 170, enemies = null) {
      gaps.forEach((w, i) => {
        this.gap(w);
        this.ground(island);
        this.pickup("crystal", this.x - island - w / 2, this.y - 100);
        if (enemies && enemies[i]) this.place(enemies[i], island - 40);
      });
      return this;
    }

    stairs(n, rise = 70, tread = 130) {
      for (let i = 0; i < n; i++) {
        this.y -= rise;
        this.ground(tread);
      }
      return this;
    }

    down(n, drop = 90, tread = 150) {
      for (let i = 0; i < n; i++) {
        this.y += drop;
        this.ground(tread);
      }
      return this;
    }

    // Floating platforms across one wide pit. dy entries are heights above the floor.
    floats(heights, { gap = 118, w = 120 } = {}) {
      const startX = this.x;
      const startY = this.y;
      const total = heights.length * (w + gap) + gap;
      this.gap(total);
      heights.forEach((height, i) => {
        const px = startX + gap + i * (w + gap);
        this.solid({ x: px, y: startY - height, w, h: 18, oneway: true, kind: "float" });
        this.pickup("crystal", px + w / 2, startY - height - 40);
      });
      return this;
    }

    movers(n, { axis = "x", span = 170, speed = 1.3, w = 120, height = 0 } = {}) {
      const startX = this.x;
      const startY = this.y;
      const cell = axis === "x" ? span + w + 56 : w + 118;
      this.gap(n * cell + (axis === "x" ? 0 : 118));
      for (let i = 0; i < n; i++) {
        const x0 = startX + (axis === "x" ? 40 : 118) + i * cell;
        const y0 = startY - height;
        const s = this.solid({
          x: x0, y: y0, w, h: 18, oneway: true, kind: "mover", mover: true,
          x0, y0, x1: axis === "x" ? x0 + span : x0, y1: axis === "x" ? y0 : y0 - span,
          phase: i * 1.6, speed, dx: 0, dy: 0,
        });
        this.level.movers.push(s);
      }
      return this;
    }

    crumble(n, { gap = 100, w = 110, height = 0 } = {}) {
      const startX = this.x;
      const startY = this.y;
      this.gap(n * (w + gap) + gap);
      for (let i = 0; i < n; i++) {
        const s = this.solid({ x: startX + gap + i * (w + gap), y: startY - height, w, h: 26, kind: "crumble", crumble: true, fuse: 0, shake: 0, respawn: 0 });
        s.onStand = () => { if (s.fuse <= 0) s.fuse = 0.55; };
        this.level.crumbles.push(s);
      }
      return this;
    }

    // A shaft to climb: zig-zag platforms up to the top of a tall wall.
    tower(rise, { width = 520, step = 88, enemies = null } = {}) {
      const startX = this.x;
      const startY = this.y;
      this.ground(width);
      const rows = Math.ceil(rise / step);
      for (let i = 1; i < rows; i++) {
        const k = i % 2 ? 0.62 : 0.2;
        const px = startX + (width - 150) * k + 30;
        this.solid({ x: px, y: startY - i * step, w: 150, h: 18, oneway: true, kind: "float" });
        if (i % 2 === 0) this.pickup("crystal", px + 75, startY - i * step - 42);
        if (enemies && enemies[i]) this.enemy(enemies[i], px + 75, startY - i * step, { left: px + 10, right: px + 140 });
      }
      // The last row steps onto the wall top.
      this.solid({ x: startX + width - 140, y: startY - rows * step + 8, w: 140, h: 18, oneway: true, kind: "float" });
      this.y = startY - rise;
      this.level.floors.push({ x0: startX, x1: startX + width, y: startY + 176 });
      this.ground(150);
      return this;
    }

    // A rising platform up a wall.
    lift(rise, { speed = 0.9, w = 130 } = {}) {
      const x0 = this.x;
      const y0 = this.y;
      this.ground(w + 60);
      const s = this.solid({
        x: x0 + 40, y: y0, w, h: 18, oneway: true, kind: "mover", mover: true,
        x0: x0 + 40, y0: y0 + 2, x1: x0 + 40, y1: y0 - rise, phase: 0, speed, dx: 0, dy: 0,
      });
      this.level.movers.push(s);
      this.y = y0 - rise;
      return this;
    }

    // ---------- Hazards ----------

    hazard(h) {
      const out = { on: false, warn: false, offset: 0, ...h };
      out.bounds = out.bounds || { x: out.x - 60, y: out.y - 460, w: (out.w || 0) + 120, h: 500 };
      this.level.hazards.push(out);
      return out;
    }

    lasers(n, { spacing = 150, height = 230, period = 2.4, onTime = 1.2, dmg = 15, top = null } = {}) {
      const len = (n + 1) * spacing;
      this.ground(len);
      for (let i = 0; i < n; i++) {
        const x = this.x - len + (i + 1) * spacing;
        const topY = top !== null ? top : this.y - height;
        this.hazard({ type: "laser", x, y: this.y, top: topY, period, onTime, offset: i * 0.5, dmg, rect: { x: x - 4, y: topY, w: 8, h: this.y - topY } });
      }
      return this;
    }

    arcs(n, { spacing = 210, height = 34, w = 110, period = 2.2, onTime = 1.2, dmg = 14 } = {}) {
      const len = (n + 1) * spacing;
      this.ground(len);
      for (let i = 0; i < n; i++) {
        const x = this.x - len + (i + 1) * spacing - w / 2;
        const yy = this.y - height;
        this.hazard({ type: "arc", x, y: this.y, w, height, period, onTime, offset: i * 0.6, dmg, rect: { x, y: yy - 8, w, h: 16 } });
      }
      return this;
    }

    vents(n, { spacing = 200, height = 190, w = 40, period = 2.6, onTime = 1, dmg = 16, jet = "#fff" } = {}) {
      const len = (n + 1) * spacing;
      this.ground(len);
      for (let i = 0; i < n; i++) {
        const x = this.x - len + (i + 1) * spacing;
        this.hazard({ type: "vent", x, y: this.y, w, height, period, onTime, offset: i * 0.7, dmg, jet, rect: { x: x - w / 2, y: this.y - height, w, h: height } });
      }
      return this;
    }

    crushers(n, { spacing = 230, w = 100, period = 3, dmg = 28, travel = 200 } = {}) {
      const len = (n + 1) * spacing;
      this.ground(len);
      const ceiling = this.y - travel - 70;
      this.solid({ x: this.x - len, y: ceiling - 300, w: len, h: 300, kind: "wall" });
      for (let i = 0; i < n; i++) {
        const x = this.x - len + (i + 1) * spacing - w / 2;
        this.hazard({ type: "crusher", x, y: this.y, w, anchor: ceiling, top: ceiling + 34, travel: travel + 36, drop: 0, k: 0, period, offset: i * 0.8, dmg,
          bounds: { x: x - 10, y: ceiling, w: w + 20, h: travel + 100 } });
      }
      return this;
    }

    spikes(w, dx = 0, dmg = 15) {
      const x = this.x + dx;
      this.hazard({ type: "spike", x, y: this.y, w, height: 22, dmg, bounds: { x, y: this.y - 30, w, h: 34 } });
      return this;
    }

    // Spike beds on a floor: each must be jumped.
    spikeRun(beds, { w = 90, spacing = 240 } = {}) {
      const len = (beds + 1) * spacing;
      this.ground(len);
      for (let i = 0; i < beds; i++) {
        const x = this.x - len + (i + 1) * spacing - w / 2;
        this.hazard({ type: "spike", x, y: this.y, w, height: 22, dmg: 15, bounds: { x, y: this.y - 30, w, h: 34 } });
      }
      return this;
    }

    fallers(n, { spacing = 170, height = 300, w = 30, len = 58, dmg = 16 } = {}) {
      const total = (n + 1) * spacing;
      this.ground(total);
      for (let i = 0; i < n; i++) {
        const x = this.x - total + (i + 1) * spacing;
        const homeY = this.y - height;
        this.hazard({ type: "faller", x, y: this.y, w, height: len, homeY, cy: homeY, vy: 0, floor: this.y, falling: false, gone: false, wait: 0, dmg,
          bounds: { x: x - 30, y: homeY - 10, w: 60, h: height + 20 } });
      }
      return this;
    }

    // ---------- Combat rooms ----------

    // Force walls drop at both ends until every wave is beaten.
    arena(len, waves, { platforms = [] } = {}) {
      const startX = this.x;
      this.ground(len);
      const y = this.y;
      const wallH = 520;
      const left = this.solid({ x: startX - 12, y: y - wallH, w: 12, h: wallH, kind: "barrier", active: false });
      const right = this.solid({ x: this.x - 12, y: y - wallH, w: 12, h: wallH, kind: "barrier", active: false });
      this.level.barriers.push(left, right);
      for (const [dx, height, w] of platforms) {
        this.solid({ x: startX + dx, y: y - height, w, h: 18, oneway: true, kind: "float" });
      }
      this.level.triggers.push({ x: startX + 90, type: "arena", walls: [left, right], waves, spawnLeft: startX + 60, spawnRight: this.x - 60, y, fired: false });
      return this;
    }

    // ---------- Puzzles ----------

    // A sealed door, opened by pushing a switch somewhere before it.
    door({ high = 0 } = {}) {
      this.ground(300);
      const y = this.y;
      const door = this.solid({ x: this.x - 40, y: y - 420, w: 34, h: 420, kind: "door", progress: 0, open: false, fullH: 420 });
      this.solid({ x: this.x - 46, y: y - 1100, w: 46, h: 680, kind: "wall" });
      this.level.doors.push(door);
      const sw = { x: this.x - 200, y: y - 66 - high, w: 34, h: 52, on: false,
        onFire: () => {
          door.open = true;
          this.game.audio.play("door");
        } };
      if (high) this.solid({ x: sw.x - 50, y: y - high, w: 136, h: 18, oneway: true, kind: "float" });
      this.level.switches.push(sw);
      return this;
    }

    // A chasm too wide to jump until a Force switch runs a bridge out.
    bridge(width = 340) {
      this.ground(140);
      const y = this.y;
      const b = this.solid({ x: this.x, y, w: 0, h: 20, kind: "bridge", isBridge: true, fullW: width, extending: false });
      this.level.bridges.push(b);
      this.level.switches.push({ x: this.x - 74, y: y - 66, w: 34, h: 52, on: false,
        onFire: () => {
          b.extending = true;
          this.game.audio.play("door");
        } });
      this.gap(width);
      return this;
    }

    // A wall too high to jump. A crate pushed against it makes the step.
    crateWall(rise = 150) {
      this.ground(420);
      const y = this.y;
      const size = 62;
      const crate = this.solid({ x: this.x - 330, y: y - size, w: size, h: size, kind: "crate", vx: 0, vy: 0, moving: false, settled: true, homeX: this.x - 330, homeY: y - size });
      this.level.crates.push(crate);
      this.y -= rise;
      return this;
    }

    // ---------- Secrets, each with a holocron ----------

    // A cracked wall hides a low room. The way forward runs over its roof.
    secretRoom(len = 360) {
      const x0 = this.x;
      const y = this.y;
      this.ground(len + 150);
      const top = y - 100;
      this.solid({ x: x0 + 60, y: top, w: len, h: 24, kind: "ground" });
      this.solid({ x: x0 + 60 + len - 18, y: top, w: 18, h: 100, kind: "wall" });
      const crack = this.solid({ x: x0 + 60, y: top + 24, w: 22, h: 76, kind: "wall" });
      crack.kind = "cracked";
      const cover = { x: x0 + 82, y: top + 24, w: len - 100, h: 76, alpha: 1, reveal: false };
      this.level.covers.push(cover);
      this.level.rooms.push({ x: x0 + 60, y: top + 24, w: len, h: 76 });
      const wall = {
        x: crack.x - 6, y: crack.y, w: crack.w + 12, h: crack.h, broken: false, saberable: false,
        smash: (game) => {
          crack.active = false;
          wall.broken = true;
          cover.reveal = true;
          game.audio.play("explosion", 0.5);
          game.particles.dust(crack.x, crack.y + 30, this.level.theme.dust, 22);
          game.particles.text(crack.x + 10, crack.y - 8, "SECRET", "#ffd76a", 15);
        },
      };
      this.level.breakables.push(wall);
      this.pickup("holocron", x0 + 60 + len - 56, y - 40);
      for (let i = 0; i < 4; i++) this.pickup("crystal", x0 + 120 + i * 40, y - 40);
      return this;
    }

    // Reachable only by trusting a drop: a hidden ledge just under the rim of a pit.
    secretLedge(pit = 200) {
      const x0 = this.x;
      const y = this.y;
      this.gap(pit);
      this.solid({ x: x0 + 8, y: y + 92, w: 92, h: 16, oneway: true, kind: "float" });
      this.pickup("holocron", x0 + 54, y + 66);
      this.pickup("crystal", x0 + 30, y + 30);
      this.pickup("crystal", x0 + 62, y - 6);
      return this;
    }

    // Two steps up, above the camera's usual view: a relay ledge, then the prize.
    secretHigh(height = 210, dx = -120) {
      const x = this.x + dx;
      this.solid({ x: x - 60, y: this.y - height / 2, w: 120, h: 18, oneway: true, kind: "float" });
      this.solid({ x: x + 110, y: this.y - height, w: 120, h: 18, oneway: true, kind: "float" });
      this.pickup("crystal", x, this.y - height / 2 - 40);
      this.pickup("holocron", x + 170, this.y - height - 34);
      return this;
    }

    // ---------- Ending ----------

    exit() {
      this.ground(420);
      this.level.exit = { x: this.x - 170, y: this.y - 150, w: 70, h: 150, open: true };
      return this;
    }

    // A sealed fight in a fixed-size room, with the camera locked to it.
    bossArena(id, opts = {}) {
      const width = opts.width || J.VIEW_W;
      this.ground(180);
      const left = this.x;
      this.ground(width);
      const right = this.x;
      const y = this.y;
      const wallH = 1000;
      const entry = this.solid({ x: left - 14, y: y - wallH, w: 14, h: wallH, kind: "barrier", active: false });
      this.solid({ x: right, y: y - wallH, w: 60, h: wallH, kind: "wall" });
      this.level.barriers.push(entry);
      this.x = right + 60;
      this.ground(60);
      for (const [dx, height, w] of opts.platforms || []) {
        this.solid({ x: left + dx, y: y - height, w, h: 18, oneway: true, kind: "float" });
      }
      const arena = { left, right, floor: y, perches: (opts.perches || [[160, 210], [800, 210]]).map(([dx, h]) => ({ x: left + dx, y: y - h })),
        spots: (opts.spots || [170, 480, 790]).map((dx) => left + dx) };
      this.level.triggers.push({ x: left + 130, type: "boss", boss: id, arena, wall: entry, fired: false });
      this.level.arena = arena;
      return this;
    }
  }

  class LevelManager {
    constructor(game) {
      this.game = game;
      this.defs = J.LEVELS;
    }

    get count() { return this.defs.length; }

    build(index) {
      const def = this.defs[index];
      const level = new Level(def, index);
      const builder = new LevelBuilder(level, this.game);
      def.build(builder);
      level.game = this.game;
      level.finish();
      return level;
    }
  }

  J.Level = Level;
  J.LevelBuilder = LevelBuilder;
  J.LevelManager = LevelManager;
})(window.JEDI);
