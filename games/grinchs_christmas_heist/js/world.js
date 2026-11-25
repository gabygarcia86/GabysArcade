/*
 * Builds a level's map from its settings: a grid of roads with themed blocks between
 * them (houses, tree groves, market stalls, factory floors, the mansion, the giant tree).
 * The layout is seeded by the level number, so each level looks the same every time,
 * while the loot on it is placed fresh each heist.
 *
 * Also owns collision (circles against rectangles and circles), line of sight, the road
 * graph that Whos walk along, and the pre-rendered ground layer.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const CELL = 160;
  const RW = 130;

  class World {
    constructor(level) {
      this.L = level;
      this.rnd = G.rng(level.id * 7919 + 17);
      this.solids = [];
      this.props = [];
      this.spots = [];
      this.ice = [];
      this.lights = [];
      this.belts = [];
      this.presses = [];
      this.cartDefs = [];
      this.guardPosts = [];
      this.idleSpots = [];
      this.spectatorSpots = [];
      this.dogHomes = [];
      this.trees = [];
      this.paths = []; // garden paths and door walks drawn on the ground
      this.dynamic = []; // moving solids (carts, floats, fallen trees), refreshed by the game
      this.build();
      this.buildGrid();
    }

    // ---------------------------------------------------------------- Layout

    build() {
      const L = this.L;
      const rnd = this.rnd;
      const BW = L.blockW || 520;
      const BH = L.blockH || 430;
      this.BW = BW;
      this.BH = BH;
      const cols = L.cols;
      const rows = L.rows;
      this.paradeRow = L.parade ? Math.floor(rows / 2) : -1;

      this.roadX = [];
      this.roadW = [];
      this.blockX = [];
      let x = 0;
      for (let i = 0; i <= cols; i++) {
        this.roadX.push(x);
        this.roadW.push(RW);
        x += RW;
        if (i < cols) {
          this.blockX.push(x);
          x += BW;
        }
      }
      this.W = x;
      this.roadY = [];
      this.roadH = [];
      this.blockY = [];
      let y = 0;
      for (let j = 0; j <= rows; j++) {
        const h = j === this.paradeRow ? 200 : RW;
        this.roadY.push(y);
        this.roadH.push(h);
        y += h;
        if (j < rows) {
          this.blockY.push(y);
          y += BH;
        }
      }
      this.H = y;

      // Roads and the graph of intersections.
      this.roads = [];
      for (let i = 0; i <= cols; i++) this.roads.push({ x: this.roadX[i], y: 0, w: RW, h: this.H, v: true });
      for (let j = 0; j <= rows; j++) this.roads.push({ x: 0, y: this.roadY[j], w: this.W, h: this.roadH[j], v: false, parade: j === this.paradeRow });
      this.nodes = [];
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          this.nodes.push({ x: this.roadX[i] + RW / 2, y: this.roadY[j] + this.roadH[j] / 2, i, j, n: [] });
        }
      }
      const idx = (i, j) => j * (cols + 1) + i;
      this.nodeAt = (i, j) => this.nodes[idx(i, j)];
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const n = this.nodes[idx(i, j)];
          if (i < cols && j !== this.paradeRow) {
            n.n.push(idx(i + 1, j));
            this.nodes[idx(i + 1, j)].n.push(idx(i, j));
          }
          if (j < rows) {
            n.n.push(idx(i, j + 1));
            this.nodes[idx(i, j + 1)].n.push(idx(i, j));
          }
        }
      }

      // Getaway and start.
      const corner = L.corner;
      const gi = corner === "tl" || corner === "bl" ? 0 : cols;
      const gj = corner === "tl" || corner === "tr" ? 0 : rows;
      const gn = this.nodeAt(gi, gj);
      this.getaway = { x: gn.x, y: gn.y, kind: L.getaway };
      if (L.startAtGetaway) {
        this.start = { x: gn.x + (gi === 0 ? 1 : -1) * 20, y: gn.y + (gj === 0 ? 1 : -1) * 70 };
      } else {
        const sn = this.nodeAt(cols - gi, rows - gj);
        this.start = { x: sn.x, y: sn.y };
      }

      // Blocks.
      this.blocks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const b = { x: this.blockX[c], y: this.blockY[r], w: BW, h: BH, c, r, kind: L.fill(c, r) };
          this.blocks.push(b);
          this.fillBlock(b);
        }
      }

      this.addRoadside();
      this.addHazards();
      this.addRoadSpots();
      if (L.parade) this.addParade();
      // Dogs live at random intersections away from the start.
      for (const n of this.nodes) {
        if (G.dist(n.x, n.y, this.start.x, this.start.y) > 500) this.dogHomes.push({ x: n.x, y: n.y });
      }
      G.shuffle(this.dogHomes, rnd);
    }

    pal() {
      return this.L.pal;
    }

    addRect(x, y, w, h, sight, prop) {
      const s = { shape: "rect", x, y, w, h, sight };
      this.solids.push(s);
      if (prop) {
        prop.solid = s;
        this.props.push(prop);
      }
      return s;
    }

    addCircle(x, y, r, sight, prop) {
      const s = { shape: "circle", x, y, r, sight };
      this.solids.push(s);
      if (prop) {
        prop.solid = s;
        this.props.push(prop);
      }
      return s;
    }

    // Is there room for a circle of radius r here?
    isFree(x, y, r, margin = 6) {
      if (x < r || y < r || x > this.W - r || y > this.H - r) return false;
      const rr = r + margin;
      for (const s of this.solids) {
        if (s.off) continue;
        if (s.shape === "rect") {
          if (G.circleHitsRect(x, y, rr, s)) return false;
        } else if (G.dist(x, y, s.x, s.y) < rr + s.r) return false;
      }
      for (const p of this.presses) if (G.circleHitsRect(x, y, r, p.zone)) return false;
      return true;
    }

    nearGetaway(x, y, d = 170) {
      return G.dist(x, y, this.getaway.x, this.getaway.y) < d || G.dist(x, y, this.start.x, this.start.y) < d * 0.8;
    }

    addSpot(x, y, hidden = false, bonus = null, belt = null) {
      this.spots.push({ x, y, hidden, bonus, belt });
    }

    // ---------------------------------------------------------------- Block fillers

    fillBlock(b) {
      switch (b.kind) {
        case "houses":
          this.fillHouses(b, false);
          break;
        case "fancy":
          this.fillHouses(b, true);
          break;
        case "grove":
          this.fillGrove(b);
          break;
        case "park":
          this.fillPark(b);
          break;
        case "market":
          this.fillMarket(b);
          break;
        case "plaza":
          this.fillPlaza(b, 1.6);
          break;
        case "factory":
          this.fillFactory(b);
          break;
        case "garden":
          this.fillGarden(b);
          break;
        case "mansion":
          this.fillMansion(b);
          break;
        case "mansionB":
          this.fillCourtyard(b);
          break;
        case "bigtree":
          this.fillPlaza(b, 2.6);
          break;
        default:
          this.fillHouses(b, false);
      }
    }

    makeHouse(x, y, w, d, fancy) {
      const rnd = this.rnd;
      const P = this.pal();
      const h = {
        x,
        y,
        w,
        h: d,
        wallH: fancy ? rnd.int(60, 66) : rnd.int(52, 60),
        lift: fancy ? rnd.int(32, 40) : rnd.int(24, 32),
        wall: rnd.pick(P.houseWalls),
        roof: rnd.pick(P.roofs),
        door: rnd.pick(P.doors),
        trim: rnd.pick(P.trims),
        chimney: rnd.chance(0.65),
        tower: fancy && rnd.chance(0.55),
        skew: rnd.range(-9, 9),
        seed: rnd.int(0, 99),
      };
      const top = h.y - h.lift - (h.tower ? 120 : 40);
      this.addRect(x, y, w, d, true, {
        kind: "house",
        sortY: y + d,
        draw: (ctx, t) => Art.house(ctx, h, t),
        fade: { x: x - 16, y: top, w: w + 32, h: y + d - top },
        bounds: { x: x - 16, y: top - 40, w: w + 32, h: y + d - top + 60 },
      });
      // Hidden loot behind the house, and a spot on the porch.
      this.addSpot(x + rnd.range(24, w - 24), y - 15, true);
      if (w > 170 && rnd.chance(0.6)) this.addSpot(x + rnd.range(24, w - 24), y - 15, true);
      this.addSpot(x + w / 2 + rnd.pick([-1, 1]) * rnd.range(30, 50), y + d + 20);
      this.paths.push({ x: x + w / 2 - 11, y: y + d, w: 22, h: 26 });
      return h;
    }

    addPine(x, y, size, decorated, lights, hideSpot) {
      const rnd = this.rnd;
      const tr = { x, y, size, decorated, lights, seed: rnd.int(0, 50) };
      const rec = { x, y, size, solid: null, tr, hiddenProp: false };
      rec.solid = this.addCircle(x, y, 15 * size, true, {
        kind: "pine",
        tree: rec,
        sortY: y,
        draw: (ctx, t) => Art.pine(ctx, tr, t),
        fade: { x: x - 36 * size, y: y - 125 * size, w: 72 * size, h: 125 * size },
        bounds: { x: x - 45 * size, y: y - 140 * size, w: 90 * size, h: 150 * size },
      });
      this.trees.push(rec);
      if (hideSpot) this.addSpot(x + rnd.range(-12, 12), y - 26 * size, true);
      return tr;
    }

    addSnowman(x, y) {
      const o = { x, y, seed: this.rnd.int(0, 9), scarf: this.rnd.pick(["#e0303a", "#2f6fe0", "#27a35a", "#9b4dff"]) };
      this.addCircle(x, y, 20, false, {
        kind: "snowman",
        sortY: y,
        draw: (ctx, t) => Art.snowman(ctx, o, t),
        bounds: { x: x - 32, y: y - 90, w: 64, h: 100 },
      });
    }

    addLamp(x, y) {
      const o = { x, y };
      this.addCircle(x, y, 6, false, {
        kind: "lamp",
        sortY: y,
        draw: (ctx, t) => Art.lamp(ctx, o, t),
        bounds: { x: x - 70, y: y - 160, w: 140, h: 170 },
      });
    }

    addLightsPatch(x, y, w = 74, h = 44) {
      this.lights.push({ x: x - w / 2, y: y - h / 2, w, h, seed: this.rnd.int(0, 99) });
    }

    fillHouses(b, fancy) {
      const rnd = this.rnd;
      const rowsDef = [b.y + (fancy ? 70 : 64), b.y + b.h - 26];
      let bandTop = 0;
      let bandBottom = 0;
      for (let ri = 0; ri < 2; ri++) {
        const d = fancy ? 118 : rnd.int(100, 110);
        const y = ri === 0 ? rowsDef[0] : rowsDef[1] - d;
        if (ri === 0) bandTop = y + d;
        else bandBottom = y;
        const two = b.w >= 480 && rnd.chance(fancy ? 0.55 : 0.8);
        const n = two ? 2 : 1;
        const margin = 22;
        const ws = [];
        for (let k = 0; k < n; k++) ws.push(two ? rnd.int(fancy ? 175 : 150, fancy ? 195 : 185) : rnd.int(fancy ? 230 : 190, fancy ? 280 : 240));
        const total = ws.reduce((a, c) => a + c, 0);
        const free = b.w - total - margin * 2;
        let gapMid = two ? G.clamp(rnd.range(90, free - 10), 90, Math.max(90, free)) : 0;
        let left = b.x + margin + rnd.range(0, Math.max(0, free - gapMid));
        for (let k = 0; k < n; k++) {
          this.makeHouse(left, y, ws[k], d, fancy);
          if (k === 0 && two) {
            // Something in the gap between the two houses.
            const gx = left + ws[k] + gapMid / 2;
            const gy = y + d * 0.55;
            const roll = rnd();
            if (roll < 0.35) this.addSnowman(gx, gy);
            else if (roll < 0.7) this.addPine(gx, y + d - 6, 0.75, rnd.chance(0.4), false, true);
            else this.addSpot(gx, gy);
          }
          left += ws[k] + gapMid;
        }
      }
      // The back-yard band between the two rows.
      const bandH = bandBottom - bandTop;
      if (bandH > 70) {
        const trees = rnd.int(0, 2);
        for (let k = 0; k < trees; k++) {
          const tx = b.x + rnd.range(40, b.w - 40);
          const ty = bandBottom - 10;
          if (this.isFree(tx, ty, 16, 8)) this.addPine(tx, ty, 0.7, rnd.chance(0.5), rnd.chance(0.3), true);
        }
        for (let k = 0; k < 3; k++) {
          const sx = b.x + rnd.range(30, b.w - 30);
          const sy = bandTop + rnd.range(25, bandH - 25);
          if (this.isFree(sx, sy, 14, 4)) this.addSpot(sx, sy);
        }
        if (rnd.chance(0.35)) this.addLightsPatch(b.x + rnd.range(60, b.w - 60), bandTop + bandH / 2);
      }
      // Front corner fence pieces.
      if (rnd.chance(0.5)) {
        const fx = b.x + 8;
        const fy = b.y + b.h - 10;
        const f = { x: fx, y: fy, w: 60, h: 6 };
        this.addRect(fx, fy - 4, 60, 8, false, { kind: "fence", sortY: fy + 4, draw: (ctx) => Art.fence(ctx, f), bounds: { x: fx, y: fy - 30, w: 64, h: 40 } });
      }
    }

    fillGrove(b) {
      const rnd = this.rnd;
      const cols = 3;
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = b.x + (c + 0.5) * (b.w / cols) + rnd.range(-30, 30);
          const y = b.y + (r + 0.5) * (b.h / rows) + 40 + rnd.range(-15, 15);
          if (rnd.chance(0.12)) {
            this.addSnowman(x, y - 20);
            continue;
          }
          this.addPine(x, y, rnd.range(0.85, 1.1), true, rnd.chance(0.55), rnd.chance(0.7));
        }
      }
      for (let k = 0; k < 4; k++) {
        const x = b.x + rnd.range(40, b.w - 40);
        const y = b.y + rnd.range(40, b.h - 40);
        if (this.isFree(x, y, 14, 6)) this.addSpot(x, y);
      }
      if (rnd.chance(0.7)) this.addLightsPatch(b.x + rnd.range(80, b.w - 80), b.y + rnd.range(80, b.h - 80));
    }

    fillPark(b) {
      const rnd = this.rnd;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2 + 20;
      const f = { x: cx, y: cy, r: 42 };
      this.addCircle(cx, cy - 10, 44, false, {
        kind: "fountain",
        sortY: cy,
        draw: (ctx, t) => Art.fountain(ctx, f, t),
        bounds: { x: cx - 60, y: cy - 80, w: 120, h: 100 },
      });
      this.addSpot(cx, cy + 50, false, "bonus");
      this.paths.push({ x: b.x + 20, y: cy - 14, w: b.w - 40, h: 28, round: true });
      this.paths.push({ x: cx - 14, y: b.y + 20, w: 28, h: b.h - 40, round: true });
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        this.addPine(cx + dx * (b.w / 2 - 70), cy + dy * (b.h / 2 - 80), rnd.range(0.85, 1.05), rnd.chance(0.5), false, true);
      }
      for (const dx of [-1, 1]) {
        const bx = cx + dx * 110 - 28;
        const by = cy + 80;
        const o = { x: bx, y: by, w: 56 };
        this.addRect(bx, by - 8, 56, 10, false, { kind: "bench", sortY: by + 2, draw: (ctx) => Art.bench(ctx, o), bounds: { x: bx, y: by - 40, w: 60, h: 46 } });
        this.idleSpots.push({ x: bx + 28, y: by - 22, face: "down" });
      }
      this.addSnowman(cx - 140, cy - 70);
      this.addLamp(cx + 70, cy - 70);
      this.addLamp(cx - 70, cy + 120);
      for (let k = 0; k < 4; k++) {
        const x = b.x + rnd.range(40, b.w - 40);
        const y = b.y + rnd.range(40, b.h - 40);
        if (this.isFree(x, y, 14, 6)) this.addSpot(x, y);
      }
    }

    fillMarket(b) {
      const rnd = this.rnd;
      const rowsY = [b.y + 80, b.y + 80 + (b.h - 130) / 2, b.y + b.h - 50];
      const colors = ["#e0303a", "#27a35a", "#2f6fe0", "#9b4dff", "#ff9f1c"];
      for (const ry of rowsY) {
        const n = rnd.int(2, 3);
        const w = n === 3 ? rnd.int(118, 128) : rnd.int(150, 170);
        const gap = (b.w - n * w) / (n + 1);
        for (let k = 0; k < n; k++) {
          const x = b.x + gap * (k + 1) + w * k + rnd.range(-10, 10);
          const h = 46;
          const y = ry - h;
          const o = { x, y, w, h, color: rnd.pick(colors), goods: rnd.int(0, 9) };
          this.addRect(x, y, w, h, true, {
            kind: "stall",
            sortY: y + h,
            draw: (ctx, t) => Art.stall(ctx, o, t),
            fade: { x: x - 10, y: y - 56, w: w + 20, h: h + 56 },
            bounds: { x: x - 14, y: y - 60, w: w + 28, h: h + 70 },
          });
          this.addSpot(x + rnd.range(15, w - 15), y - 13, true);
          this.addSpot(x + w / 2 + rnd.range(-30, 30), y + h + 22);
          this.idleSpots.push({ x: x + w / 2 + rnd.range(-20, 20), y: y + h + 30, face: "up" });
        }
      }
      if (rnd.chance(0.5)) this.addLightsPatch(b.x + rnd.range(70, b.w - 70), rowsY[0] + 30);
    }

    fillPlaza(b, size) {
      const rnd = this.rnd;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2 + (size > 2 ? 70 : 40);
      const o = { x: cx, y: cy, size };
      this.addCircle(cx, cy, 18 * size, true, {
        kind: "bigtree",
        sortY: cy,
        draw: (ctx, t) => Art.bigTree(ctx, o, t),
        fade: { x: cx - 40 * size, y: cy - 130 * size, w: 80 * size, h: 130 * size },
        bounds: { x: cx - 50 * size, y: cy - 150 * size, w: 100 * size, h: 160 * size },
      });
      this.trees.push({ x: cx, y: cy, size, big: true });
      // Valuable loot in a ring around the tree.
      const ringN = size > 2 ? 7 : 4;
      for (let k = 0; k < ringN; k++) {
        const a = (k / ringN) * G.TAU + 0.3;
        const rr = 36 * size + 34;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.75;
        this.addSpot(x, y, false, "bonus");
      }
      // Benches and lamps around.
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        this.addLamp(cx + dx * (b.w / 2 - 40), cy + dy * (b.h / 2 - 70) - 30);
      }
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * G.TAU;
        this.idleSpots.push({ x: cx + Math.cos(a) * (36 * size + 90), y: cy + Math.sin(a) * (36 * size + 70) * 0.8, face: "tree", tx: cx, ty: cy });
      }
      for (const dx of [-1, 1]) {
        const bx = cx + dx * (b.w / 2 - 80) - 28;
        const by = b.y + b.h - 30;
        const ob = { x: bx, y: by, w: 56 };
        this.addRect(bx, by - 8, 56, 10, false, { kind: "bench", sortY: by + 2, draw: (ctx) => Art.bench(ctx, ob), bounds: { x: bx, y: by - 40, w: 60, h: 46 } });
      }
      this.paths.push({ x: cx - 46 * size - 20, y: cy - 30 * size, w: 92 * size + 40, h: 60 * size, round: true });
      if (rnd.chance(0.5)) this.addSnowman(b.x + 60, b.y + 80);
    }

    fillFactory(b) {
      const rnd = this.rnd;
      // Walls on two sides, each with a doorway.
      const T = 18;
      const door = 130;
      const dX = b.x + rnd.range(80, b.w - 80 - door);
      const wall = (x, y, w, h) => {
        if (w < 4 || h < 4) return;
        const o = { x, y, w, h };
        this.addRect(x, y, w, h, true, { kind: "wall", sortY: y + h, draw: (ctx) => Art.wall(ctx, o), fade: { x, y: y - 44, w, h: h + 44 }, bounds: { x, y: y - 50, w, h: h + 56 } });
      };
      wall(b.x, b.y + 10, dX - b.x, T);
      wall(dX + door, b.y + 10, b.x + b.w - dX - door, T);
      const dY = b.y + rnd.range(110, b.h - 110 - door);
      wall(b.x + 10, b.y + 10 + T, T, dY - b.y - 10 - T);
      wall(b.x + 10, dY + door, T, b.y + b.h - 10 - dY - door);

      // Conveyor belt across the middle.
      const beltY = b.y + b.h * 0.52 - 23;
      const belt = { x: b.x + 50, y: beltY, w: b.w - 80, h: 46, dir: rnd.chance(0.5) ? 1 : -1, speed: 95 };
      this.belts.push(belt);
      for (let k = 0; k < 3; k++) this.addSpot(belt.x + 30 + k * ((belt.w - 60) / 2), beltY + 23, false, null, belt);

      // Wrapping machines along the top, each slamming a press onto the floor below.
      const nm = rnd.int(1, 2);
      for (let k = 0; k < nm; k++) {
        const mw = 92;
        const mx = b.x + 70 + k * (b.w - 140 - mw) + rnd.range(-10, 10);
        const my = b.y + 70;
        const o = { x: mx, y: my, w: mw, h: 36 };
        this.addRect(mx, my, mw, 36, true, {
          kind: "machine",
          sortY: my + 36,
          draw: (ctx, t) => Art.machine(ctx, o, t),
          fade: { x: mx, y: my - 56, w: mw, h: 92 },
          bounds: { x: mx - 4, y: my - 60, w: mw + 8, h: 100 },
        });
        this.presses.push({ zone: { x: mx + 11, y: my + 36, w: 70, h: 58 }, period: 2.6, offset: rnd.range(0, 2.6) });
        this.addSpot(mx + mw / 2, my - 14, true);
      }
      // Stacks of finished gifts.
      const ns = rnd.int(2, 3);
      for (let k = 0; k < ns; k++) {
        const sw = rnd.int(64, 100);
        const sx = b.x + 50 + k * ((b.w - 100) / ns) + rnd.range(0, 30);
        const sy = b.y + b.h - 80;
        if (!this.isFree(sx + sw / 2, sy + 20, 30, 0)) continue;
        const o = { x: sx, y: sy, w: sw, h: 40, seed: rnd.int(0, 9) };
        this.addRect(sx, sy, sw, 40, true, {
          kind: "stack",
          sortY: sy + 40,
          draw: (ctx) => Art.giftStack(ctx, o),
          fade: { x: sx, y: sy - 50, w: sw, h: 90 },
          bounds: { x: sx, y: sy - 60, w: sw, h: 104 },
        });
        this.addSpot(sx + sw / 2, sy - 12, true);
        this.addSpot(sx + sw / 2, sy + 62);
      }
    }

    fillGarden(b) {
      const rnd = this.rnd;
      const hedges = [
        [b.x + 40, b.y + 90, rnd.int(150, 220)],
        [b.x + b.w - 260, b.y + 200, rnd.int(150, 220)],
        [b.x + 60, b.y + b.h - 110, rnd.int(150, 220)],
      ];
      for (const [x, y, w] of hedges) {
        const o = { x, y, w, h: 28 };
        this.addRect(x, y, w, 28, true, {
          kind: "hedge",
          sortY: y + 28,
          draw: (ctx) => Art.hedge(ctx, o),
          fade: { x, y: y - 26, w, h: 54 },
          bounds: { x, y: y - 30, w, h: 66 },
        });
        this.addSpot(x + rnd.range(20, w - 20), y - 14, true);
      }
      const sx = b.x + b.w - 90;
      const sy = b.y + b.h - 70;
      const st = { x: sx, y: sy };
      this.addRect(sx - 24, sy - 22, 48, 22, true, { kind: "statue", sortY: sy, draw: (ctx, t) => Art.statue(ctx, st, t), bounds: { x: sx - 45, y: sy - 110, w: 90, h: 120 } });
      this.addSpot(sx, sy + 26, false, "bonus");
      this.addPine(b.x + 70, b.y + b.h / 2 + 30, 0.9, rnd.chance(0.5), true, true);
      if (rnd.chance(0.6)) this.addSnowman(b.x + b.w / 2, b.y + b.h / 2 + 20);
      this.addLamp(b.x + b.w / 2 + 80, b.y + 50);
      this.paths.push({ x: b.x + 20, y: b.y + b.h / 2 - 12, w: b.w - 40, h: 24, round: true });
      for (let k = 0; k < 3; k++) {
        const x = b.x + rnd.range(40, b.w - 40);
        const y = b.y + rnd.range(40, b.h - 40);
        if (this.isFree(x, y, 14, 6)) this.addSpot(x, y);
      }
    }

    fillMansion(b) {
      const mw = b.w - 70;
      const md = 180;
      const mx = b.x + 35;
      const my = b.y + b.h - 40 - md;
      const m = { x: mx, y: my, w: mw, h: md };
      const top = my - 190;
      this.addRect(mx, my, mw, md, true, {
        kind: "mansion",
        sortY: my + md,
        draw: (ctx, t) => Art.mansion(ctx, m, t),
        fade: { x: mx - 20, y: top, w: mw + 40, h: my + md - top },
        bounds: { x: mx - 30, y: top - 20, w: mw + 60, h: my + md - top + 40 },
      });
      // Treasures hidden behind the mansion, and more out front.
      for (let k = 0; k < 4; k++) this.addSpot(mx + 40 + k * ((mw - 80) / 3), my - 16, true, "gold");
      for (let k = 0; k < 3; k++) this.addSpot(mx + 60 + k * ((mw - 120) / 2), my + md + 26, false, k === 1 ? "gold" : null);
      // Guards at the front door and the back corners.
      this.guardPosts.push({ x: mx + mw / 2 + 70, y: my + md + 30, angle: Math.PI / 2 });
      this.guardPosts.push({ x: mx - 2, y: my - 40, angle: -Math.PI / 4 });
      this.guardPosts.push({ x: mx + mw + 2, y: my - 40, angle: (-3 * Math.PI) / 4 });
      // Back garden hedges.
      const o = { x: b.x + 60, y: b.y + 60, w: 160, h: 26 };
      this.addRect(o.x, o.y, o.w, o.h, true, { kind: "hedge", sortY: o.y + o.h, draw: (ctx) => Art.hedge(ctx, o), fade: { x: o.x, y: o.y - 26, w: o.w, h: 52 }, bounds: { x: o.x, y: o.y - 30, w: o.w, h: 64 } });
      this.addSpot(o.x + 80, o.y - 14, true, "gold");
      this.paths.push({ x: mx + mw / 2 - 30, y: my + md, w: 60, h: 40 });
    }

    fillCourtyard(b) {
      const rnd = this.rnd;
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2 + 20;
      const f = { x: cx, y: cy, r: 46 };
      this.addCircle(cx, cy - 10, 48, false, {
        kind: "fountain",
        sortY: cy,
        draw: (ctx, t) => Art.fountain(ctx, f, t),
        bounds: { x: cx - 66, y: cy - 84, w: 132, h: 104 },
      });
      this.addSpot(cx, cy + 56, false, "gold");
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const sx = cx + dx * (b.w / 2 - 70);
        const sy = cy + dy * (b.h / 2 - 80);
        const st = { x: sx, y: sy };
        this.addRect(sx - 24, sy - 22, 48, 22, true, { kind: "statue", sortY: sy, draw: (ctx, t) => Art.statue(ctx, st, t), bounds: { x: sx - 45, y: sy - 110, w: 90, h: 120 } });
        this.addSpot(sx, sy - 34, true, dy < 0 ? "gold" : null);
      }
      this.guardPosts.push({ x: cx, y: cy - 90, angle: Math.PI / 2 });
      this.paths.push({ x: b.x + 20, y: cy - 16, w: b.w - 40, h: 32, round: true });
      this.paths.push({ x: cx - 16, y: b.y + 20, w: 32, h: b.h - 40, round: true });
      this.addLamp(cx - 120, cy + 120);
      this.addLamp(cx + 120, cy + 120);
      if (rnd.chance(0.5)) this.addSnowman(cx + 130, cy - 40);
    }

    // ---------------------------------------------------------------- Roads, hazards, parade

    addRoadside() {
      if (this.L.pal.indoor) return;
      const rnd = this.rnd;
      // Lamps on block corners.
      for (const b of this.blocks) {
        if (b.kind === "factory") continue;
        for (const [x, y] of [
          [b.x - 10, b.y - 10],
          [b.x + b.w + 10, b.y + b.h + 10],
        ]) {
          if (rnd.chance(0.6) && !this.nearGetaway(x, y, 140) && this.isFree(x, y, 6, 4)) this.addLamp(x, y);
        }
      }
    }

    // A random point on a road, away from intersections.
    roadPoint(margin = 30) {
      const rnd = this.rnd;
      for (let k = 0; k < 40; k++) {
        const r = rnd.pick(this.roads);
        if (r.parade) continue;
        let x;
        let y;
        if (r.v) {
          x = r.x + rnd.range(margin, r.w - margin);
          const j = rnd.int(0, this.blockY.length - 1);
          y = this.blockY[j] + rnd.range(60, this.BH - 60);
        } else {
          y = r.y + rnd.range(margin, r.h - margin);
          const i = rnd.int(0, this.blockX.length - 1);
          x = this.blockX[i] + rnd.range(60, this.BW - 60);
        }
        if (!this.nearGetaway(x, y)) return { x, y, road: r };
      }
      return null;
    }

    addHazards() {
      const H = this.L.hazards;
      const rnd = this.rnd;
      for (let k = 0; k < (H.ice || 0); k++) {
        const p = this.roadPoint(0);
        if (!p) continue;
        const long = rnd.range(150, 260);
        const across = RW - rnd.range(10, 40);
        const rect = p.road.v ? { x: p.road.x + (RW - across) / 2, y: p.y - long / 2, w: across, h: long } : { x: p.x - long / 2, y: p.road.y + (p.road.h - across) / 2, w: long, h: across };
        rect.seed = rnd.int(0, 99);
        this.ice.push(rect);
      }
      for (let k = 0; k < (H.lights || 0); k++) {
        for (let tries = 0; tries < 20; tries++) {
          const x = rnd.range(80, this.W - 80);
          const y = rnd.range(80, this.H - 80);
          if (!this.nearGetaway(x, y, 200) && this.isFree(x, y, 40, 4)) {
            this.addLightsPatch(x, y);
            break;
          }
        }
      }
      for (let k = 0; k < (H.snowmen || 0); k++) {
        const p = this.roadPoint(40);
        if (!p) continue;
        const off = rnd.pick([-1, 1]) * rnd.range(20, 34);
        const x = p.road.v ? p.road.x + RW / 2 + off : p.x;
        const y = p.road.v ? p.y : p.road.y + p.road.h / 2 + off;
        if (this.isFree(x, y, 22, 10)) this.addSnowman(x, y);
      }
      // Market carts roll back and forth along a road between two intersections.
      for (let k = 0; k < (H.carts || 0); k++) {
        const n = rnd.pick(this.nodes);
        const nb = n.n.map((i) => this.nodes[i]);
        if (!nb.length) continue;
        const m = rnd.pick(nb);
        if (this.nearGetaway(n.x, n.y, 200) || this.nearGetaway(m.x, m.y, 200)) continue;
        const horiz = Math.abs(m.y - n.y) < 1;
        const off = rnd.pick([-1, 1]) * 28;
        this.cartDefs.push({
          ax: n.x + (horiz ? 0 : off),
          ay: n.y + (horiz ? off : 0),
          bx: m.x + (horiz ? 0 : off),
          by: m.y + (horiz ? off : 0),
          speed: rnd.range(70, 95),
          seed: rnd.int(0, 9),
        });
      }
    }

    addRoadSpots() {
      const n = Math.round(this.blocks.length * 1.6);
      for (let k = 0; k < n; k++) {
        const p = this.roadPoint(24);
        if (p && this.isFree(p.x, p.y, 14, 6)) this.addSpot(p.x, p.y);
      }
    }

    addParade() {
      const j = this.paradeRow;
      const ry = this.roadY[j];
      const rh = this.roadH[j];
      this.parade = { y: ry, h: rh, laneY: ry + rh / 2 };
      // Spectators line both sides, facing the parade.
      const want = this.L.crowd.spectators || 0;
      for (let k = 0; k < want; k++) {
        const north = k % 2 === 0;
        const x = 160 + (k / want) * (this.W - 320) + this.rnd.range(-30, 30);
        const y = north ? ry + 18 : ry + rh - 18;
        this.spectatorSpots.push({ x, y, face: north ? "down" : "up" });
      }
    }

    // ---------------------------------------------------------------- Collision

    buildGrid() {
      this.gw = Math.ceil(this.W / CELL);
      this.gh = Math.ceil(this.H / CELL);
      this.grid = new Array(this.gw * this.gh);
      for (let i = 0; i < this.grid.length; i++) this.grid[i] = [];
      this.solids.forEach((s, i) => {
        const x0 = s.shape === "rect" ? s.x : s.x - s.r;
        const y0 = s.shape === "rect" ? s.y : s.y - s.r;
        const x1 = s.shape === "rect" ? s.x + s.w : s.x + s.r;
        const y1 = s.shape === "rect" ? s.y + s.h : s.y + s.r;
        for (let gy = Math.max(0, Math.floor(y0 / CELL)); gy <= Math.min(this.gh - 1, Math.floor(y1 / CELL)); gy++) {
          for (let gx = Math.max(0, Math.floor(x0 / CELL)); gx <= Math.min(this.gw - 1, Math.floor(x1 / CELL)); gx++) {
            this.grid[gy * this.gw + gx].push(i);
          }
        }
      });
      this.stamp = new Uint32Array(this.solids.length);
      this.stampN = 0;
    }

    // Calls fn(solid) once for every static solid near the box.
    near(x0, y0, x1, y1, fn) {
      this.stampN++;
      const gx0 = Math.max(0, Math.floor(x0 / CELL));
      const gy0 = Math.max(0, Math.floor(y0 / CELL));
      const gx1 = Math.min(this.gw - 1, Math.floor(x1 / CELL));
      const gy1 = Math.min(this.gh - 1, Math.floor(y1 / CELL));
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const cell = this.grid[gy * this.gw + gx];
          for (let k = 0; k < cell.length; k++) {
            const i = cell[k];
            if (this.stamp[i] === this.stampN) continue;
            this.stamp[i] = this.stampN;
            const s = this.solids[i];
            if (s.off) continue;
            if (fn(s) === true) return true;
          }
        }
      }
      return false;
    }

    // Moves a circle entity, sliding along anything solid. Returns true if it bumped something.
    move(e, dx, dy) {
      e.x += dx;
      e.y += dy;
      let hit = false;
      for (let pass = 0; pass < 2; pass++) {
        this.near(e.x - e.r - 2, e.y - e.r - 2, e.x + e.r + 2, e.y + e.r + 2, (s) => {
          if (s.shape === "rect" ? G.pushOutRect(e, s) : G.pushOutCircle(e, s)) hit = true;
        });
        for (const d of this.dynamic) {
          if (G.pushOutRect(e, d)) hit = true;
        }
      }
      const minX = e.r;
      const minY = e.r;
      const maxX = this.W - e.r;
      const maxY = this.H - e.r;
      if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) hit = true;
      e.x = G.clamp(e.x, minX, maxX);
      e.y = G.clamp(e.y, minY, maxY);
      return hit;
    }

    // Can someone at (x1, y1) see (x2, y2)?
    lineClear(x1, y1, x2, y2) {
      const blocked = this.near(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), (s) => {
        if (!s.sight) return false;
        if (s.shape === "rect") return G.segHitsRect(x1, y1, x2, y2, s);
        return G.segHitsCircle(x1, y1, x2, y2, s.x, s.y, s.r);
      });
      if (blocked) return false;
      for (const d of this.dynamic) {
        if (d.sight && G.segHitsRect(x1, y1, x2, y2, d)) return false;
      }
      return true;
    }

    pathClear(x1, y1, x2, y2, r) {
      // A rough check that a straight walk is open: samples along the line.
      const len = G.dist(x1, y1, x2, y2);
      const steps = Math.max(1, Math.ceil(len / 24));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        const x = x1 + (x2 - x1) * k;
        const y = y1 + (y2 - y1) * k;
        if (!this.isFreeQuick(x, y, r)) return false;
      }
      return true;
    }

    isFreeQuick(x, y, r) {
      if (x < r || y < r || x > this.W - r || y > this.H - r) return false;
      return !this.near(x - r, y - r, x + r, y + r, (s) =>
        s.shape === "rect" ? G.circleHitsRect(x, y, r, s) : G.dist(x, y, s.x, s.y) < r + s.r,
      );
    }

    zoneAt(list, x, y) {
      for (const z of list) if (G.pointInRect(x, y, z)) return z;
      return null;
    }

    nearestNode(x, y, exclude) {
      let best = null;
      let bd = Infinity;
      this.nodes.forEach((n, i) => {
        if (i === exclude) return;
        const d = G.dist(x, y, n.x, n.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      return best;
    }

    // ---------------------------------------------------------------- Ground layer

    renderGround() {
      const c = document.createElement("canvas");
      c.width = Math.ceil(this.W);
      c.height = Math.ceil(this.H);
      const ctx = c.getContext("2d");
      const P = this.pal();
      const rnd = G.rng(this.L.id * 31 + 5);

      ctx.fillStyle = P.snow;
      ctx.fillRect(0, 0, c.width, c.height);

      if (P.indoor) {
        // Factory floor tiles.
        for (let y = 0; y < this.H; y += 64) {
          for (let x = 0; x < this.W; x += 64) {
            if (((x + y) / 64) % 2 === 0) {
              ctx.fillStyle = P.snow2;
              ctx.fillRect(x, y, 64, 64);
            }
          }
        }
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        for (let x = 0; x < this.W; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.H);
          ctx.stroke();
        }
        for (let y = 0; y < this.H; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(this.W, y);
          ctx.stroke();
        }
      } else {
        // Soft drifts and sparkles in the snow.
        for (let i = 0; i < (this.W * this.H) / 9000; i++) {
          ctx.fillStyle = rnd() < 0.5 ? P.snow2 : "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.ellipse(rnd() * this.W, rnd() * this.H, rnd.range(10, 50), rnd.range(4, 14), 0, 0, G.TAU);
          ctx.fill();
        }
      }

      // Garden paths and door walks.
      ctx.fillStyle = P.indoor ? "rgba(0,0,0,0.05)" : P.walk;
      for (const p of this.paths) {
        Art.roundRect(ctx, p.x, p.y, p.w, p.h, p.round ? Math.min(p.w, p.h) / 2 : 4);
        ctx.fill();
      }

      // Roads.
      for (const r of this.roads) {
        ctx.fillStyle = P.road;
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      for (const r of this.roads) {
        // Texture: cobbles or speckled asphalt.
        if (P.cobble) {
          ctx.fillStyle = P.road2;
          for (let y = r.y + 6; y < r.y + r.h; y += 14) {
            for (let x = r.x + ((y / 14) % 2) * 9 + 4; x < r.x + r.w; x += 18) {
              ctx.beginPath();
              ctx.ellipse(x, y, 7, 5, 0, 0, G.TAU);
              ctx.fill();
            }
          }
        } else {
          ctx.fillStyle = P.road2;
          const n = (r.w * r.h) / 500;
          for (let i = 0; i < n; i++) ctx.fillRect(r.x + rnd() * r.w, r.y + rnd() * r.h, 2, 2);
        }
      }
      // Sidewalk edges and snowy kerbs.
      if (!P.indoor) {
        for (const r of this.roads) {
          ctx.fillStyle = P.walk;
          if (r.v) {
            ctx.fillRect(r.x, r.y, 12, r.h);
            ctx.fillRect(r.x + r.w - 12, r.y, 12, r.h);
          } else {
            ctx.fillRect(r.x, r.y, r.w, 12);
            ctx.fillRect(r.x, r.y + r.h - 12, r.w, 12);
          }
        }
        // Snow piled along the kerbs.
        ctx.fillStyle = "#ffffff";
        for (const b of this.blocks) {
          for (let x = b.x; x < b.x + b.w; x += 16) {
            ctx.beginPath();
            ctx.ellipse(x + 8, b.y, 10, 5, 0, 0, G.TAU);
            ctx.ellipse(x + 8, b.y + b.h, 10, 5, 0, 0, G.TAU);
            ctx.fill();
          }
          for (let y = b.y; y < b.y + b.h; y += 16) {
            ctx.beginPath();
            ctx.ellipse(b.x, y + 8, 5, 10, 0, 0, G.TAU);
            ctx.ellipse(b.x + b.w, y + 8, 5, 10, 0, 0, G.TAU);
            ctx.fill();
          }
        }
      } else {
        // Yellow safety lines along factory lanes.
        ctx.fillStyle = P.walk;
        for (const r of this.roads) {
          if (r.v) {
            ctx.fillRect(r.x + 8, r.y, 4, r.h);
            ctx.fillRect(r.x + r.w - 12, r.y, 4, r.h);
          } else {
            ctx.fillRect(r.x, r.y + 8, r.w, 4);
            ctx.fillRect(r.x, r.y + r.h - 12, r.w, 4);
          }
        }
      }
      // Clear the intersections again so lines don't cross them.
      for (const n of this.nodes) {
        const h = this.roadH[n.j];
        ctx.fillStyle = P.road;
        ctx.fillRect(n.x - RW / 2 + 12, n.y - h / 2 + 12, RW - 24, h - 24);
      }
      // Centre dashes and crosswalks.
      if (P.line) {
        ctx.fillStyle = P.line;
        for (const r of this.roads) {
          if (r.parade) continue;
          if (r.v) {
            for (let y = 0; y < this.H; y += 40) {
              if (this.nodes.some((n) => Math.abs(n.y - y) < 80 && Math.abs(n.x - (r.x + RW / 2)) < 2)) continue;
              ctx.fillRect(r.x + RW / 2 - 2, y, 4, 20);
            }
          } else {
            for (let x = 0; x < this.W; x += 40) {
              if (this.nodes.some((n) => Math.abs(n.x - x) < 80 && Math.abs(n.y - (r.y + r.h / 2)) < 2)) continue;
              ctx.fillRect(x, r.y + r.h / 2 - 2, 20, 4);
            }
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (const n of this.nodes) {
          const h = this.roadH[n.j];
          for (let k = -3; k <= 3; k++) {
            ctx.fillRect(n.x + k * 15 - 4, n.y + h / 2 + 2, 8, 22);
            ctx.fillRect(n.x + RW / 2 + 2, n.y + k * 15 - 4, 22, 8);
          }
        }
      }
      // Parade route: a red carpet with gold edges.
      if (this.parade) {
        const p = this.parade;
        ctx.fillStyle = "#c22a3a";
        ctx.fillRect(0, p.laneY - 52, this.W, 104);
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(0, p.laneY - 56, this.W, 5);
        ctx.fillRect(0, p.laneY + 51, this.W, 5);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        for (let x = 0; x < this.W; x += 60) {
          ctx.beginPath();
          ctx.moveTo(x, p.laneY - 51);
          ctx.lineTo(x + 30, p.laneY - 51);
          ctx.lineTo(x, p.laneY + 51);
          ctx.closePath();
          ctx.fill();
        }
      }
      // Conveyor belts.
      for (const b of this.belts) {
        ctx.fillStyle = "#3a3a48";
        Art.roundRect(ctx, b.x - 8, b.y - 6, b.w + 16, b.h + 12, 10);
        ctx.fill();
        ctx.fillStyle = "#565668";
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = "#8a8aa0";
        for (const ex of [b.x - 4, b.x + b.w + 4]) {
          ctx.beginPath();
          ctx.ellipse(ex, b.y + b.h / 2, 7, b.h / 2 + 2, 0, 0, G.TAU);
          ctx.fill();
        }
      }
      // Ice patches.
      for (const r of this.ice) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
        g.addColorStop(0, "rgba(170, 230, 255, 0.95)");
        g.addColorStop(0.5, "rgba(210, 245, 255, 0.95)");
        g.addColorStop(1, "rgba(150, 215, 250, 0.95)");
        ctx.fillStyle = g;
        Art.roundRect(ctx, r.x, r.y, r.w, r.h, 24);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const sx = r.x + 14 + rnd() * (r.w - 40);
          const sy = r.y + 14 + rnd() * (r.h - 28);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 18, sy - 6);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(90, 160, 210, 0.5)";
        Art.roundRect(ctx, r.x, r.y, r.w, r.h, 24);
        ctx.stroke();
      }
      return c;
    }
  }

  G.World = World;
})(window.GH);
