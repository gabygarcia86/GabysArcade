/*
 * The endless neighborhood: biomes, ground drawing and row-by-row spawning.
 *
 * Fairness: a "safe lane" wanders up the world, never drifting faster than the
 * player can steer. Nothing that blocks you is ever placed in it, so there is
 * always a way through, however busy things get.
 */
import { CONFIG } from "./config.js";
import { KINDS } from "./obstacles.js";

const W = CONFIG.world;
const S = CONFIG.spawn;
const PLAY_HALF = W.playHalf;
const TILE = 40;
const SCENERY_EDGE = PLAY_HALF + 26;

// How likely each kind is per biome. Higher is more common.
const TABLES = {
  street: [
    [KINDS.car, 22], [KINDS.hydrant, 10], [KINDS.trash, 10], [KINDS.lamp, 8], [KINDS.ped, 13],
    [KINDS.cart, 9], [KINDS.crack, 13], [KINDS.puddle, 9], [KINDS.dog, 7], [KINDS.ramp, 6],
  ],
  park: [
    [KINDS.tree, 26], [KINDS.bush, 14], [KINDS.bench, 12], [KINDS.trash, 5], [KINDS.lamp, 4],
    [KINDS.jogger, 13], [KINDS.dog, 12], [KINDS.pigeon, 11], [KINDS.puddle, 7], [KINDS.ramp, 6],
  ],
  plaza: [
    [KINDS.bench, 14], [KINDS.trash, 10], [KINDS.hydrant, 6], [KINDS.ramp, 14], [KINDS.cart, 10],
    [KINDS.ped, 12], [KINDS.jogger, 8], [KINDS.pigeon, 13], [KINDS.crack, 13], [KINDS.lamp, 6],
  ],
};
const COLLECTIBLES = [
  [KINDS.wheel, 8], [KINDS.soda, 6], [KINDS.energy, 4], [KINDS.helmet, 4], [KINDS.rocket, 2],
];
const STREET_SIDE_ITEMS = new Set([KINDS.hydrant, KINDS.trash, KINDS.lamp]);
const BIOME_ORDER = ["street", "park", "street", "plaza", "park", "plaza"];

// A stable pseudo-random number from an integer, for drawing the same ground
// details in the same places every frame.
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const randomBetween = (low, high) => low + Math.random() * (high - low);

function pickWeighted(table) {
  let total = 0;
  for (const entry of table) total += entry[1];
  let roll = Math.random() * total;
  for (const entry of table) {
    roll -= entry[1];
    if (roll <= 0) return entry[0];
  }
  return table[0][0];
}

export function biomeAt(y) {
  const segment = Math.floor(y / W.segmentLength);
  return BIOME_ORDER[((segment % BIOME_ORDER.length) + BIOME_ORDER.length) % BIOME_ORDER.length];
}

// The center of the winding path through the park.
const parkPathX = (y) => Math.sin(y * 0.0037) * 110 + Math.sin(y * 0.0011) * 50;

export class World {
  constructor(pool) {
    this.pool = pool;
    this.placedX = []; // Reused for each row, so a row doesn't stack things.
    this.reset();
  }

  reset() {
    this.pool.clear();
    this.nextRowY = S.clearStart;
    this.nextDecorY = [-500, -500];
    this.safeX = 0;
    this.spawnObstacles = true;
  }

  update(camera, meters, chasing) {
    const top = camera.topWorld() + 150;
    while (this.nextRowY < top) {
      const gap = this.rowGap(meters);
      if (this.spawnObstacles) this.spawnRow(this.nextRowY, gap, meters, chasing);
      this.nextRowY += gap;
    }
    this.spawnScenery(top);
    this.pool.sweep(camera.bottomWorld() - 140);
  }

  rowGap(meters) {
    const t = Math.min(1, meters / S.gapRampMeters);
    return S.gapStart + (S.gapEnd - S.gapStart) * t;
  }

  /* ---------- Spawning ---------- */

  spawnRow(y, gap, meters, chasing) {
    const drift = gap * S.safeLaneDrift;
    this.safeX = Math.max(-PLAY_HALF + 70, Math.min(PLAY_HALF - 70, this.safeX + randomBetween(-drift, drift)));
    this.placedX.length = 0;

    const difficulty = Math.min(1, meters / 1600);
    let count = 1;
    if (Math.random() < 0.35 + difficulty * 0.45) count++;
    if (Math.random() < difficulty * 0.55) count++;

    const table = TABLES[biomeAt(y)];
    for (let i = 0; i < count; i++) this.place(pickWeighted(table), y);

    // A collectible or chase ramp sits in the safe lane, so reaching it is fair.
    if (Math.random() < S.collectibleChance) {
      this.pool.spawn(pickWeighted(COLLECTIBLES), this.safeX, y);
    } else if (chasing && Math.random() < 0.16) {
      this.pool.spawn(KINDS.ramp, this.safeX, y);
    }

    if (biomeAt(y) === "park" && Math.random() < 0.3) {
      this.pool.spawn(KINDS.flowers, randomBetween(-PLAY_HALF, PLAY_HALF), y + gap / 2);
    }
  }

  place(kind, y) {
    if (kind === KINDS.pigeon) {
      this.placeFlock(y);
      return;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      const x = this.chooseX(kind, y);
      if (this.isClear(kind, x)) {
        this.placedX.push(x);
        const e = this.pool.spawn(kind, x, y);
        if (kind.mover) this.startMoving(e);
        return;
      }
    }
  }

  chooseX(kind, y) {
    const side = Math.random() < 0.5 ? -1 : 1;
    if (biomeAt(y) === "street") {
      if (kind === KINDS.car) {
        // Parked at the curb, or abandoned mid-road.
        return side * (Math.random() < 0.7 ? W.roadHalf - 26 : randomBetween(20, W.roadHalf - 40));
      }
      if (STREET_SIDE_ITEMS.has(kind)) return side * (W.roadHalf + W.sidewalk / 2 + randomBetween(-8, 8));
    }
    return randomBetween(-PLAY_HALF + 22, PLAY_HALF - 22);
  }

  // Blocking things stay out of the safe lane and clear of the rest of the row.
  isClear(kind, x) {
    const halfWidth = kind.w ? kind.w / 2 : kind.r;
    for (const other of this.placedX) {
      if (Math.abs(other - x) < halfWidth + 40) return false;
    }
    if (!kind.solid || kind.mover) return true;
    const reach = kind.h ? kind.h * S.safeLaneDrift : 0; // Tall things span several lane positions.
    return Math.abs(x - this.safeX) > S.safeLaneWidth + halfWidth + reach;
  }

  startMoving(e) {
    const direction = e.x < this.safeX ? 1 : -1;
    e.vx = direction * e.kind.speed;
  }

  placeFlock(y) {
    const x = randomBetween(-PLAY_HALF + 50, PLAY_HALF - 50);
    const birds = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < birds; i++) {
      this.pool.spawn(KINDS.pigeon, x + randomBetween(-30, 30), y + randomBetween(-22, 22));
    }
  }

  spawnScenery(top) {
    for (let index = 0; index < 2; index++) {
      const side = index === 0 ? -1 : 1;
      while (this.nextDecorY[index] < top) {
        const y = this.nextDecorY[index];
        const biome = biomeAt(y);
        const big = biome === "park" ? (Math.random() < 0.35 ? KINDS.house : KINDS.pine)
          : biome === "plaza" ? KINDS.shop : KINDS.house;
        const isBuilding = big !== KINDS.pine;
        const x = side * (SCENERY_EDGE + (isBuilding ? 72 : randomBetween(14, 110)));
        this.pool.spawn(big, x, y);
        if (Math.random() < 0.45) {
          const extra = Math.random() < 0.5 ? KINDS.flamingo : KINDS.mailbox;
          this.pool.spawn(extra, side * (SCENERY_EDGE + randomBetween(6, 14)), y - 26);
        }
        this.pool.spawn(KINDS.pine, side * (SCENERY_EDGE + randomBetween(170, 240)), y + randomBetween(-30, 30));
        this.nextDecorY[index] += isBuilding ? randomBetween(150, 215) : randomBetween(70, 130);
      }
    }
  }

  /* ---------- Drawing ---------- */

  drawGround(ctx, camera, width, height) {
    ctx.fillStyle = "#58b847";
    ctx.fillRect(0, 0, width, height);

    const first = Math.floor(camera.bottomWorld() / TILE) - 1;
    const last = Math.ceil(camera.topWorld() / TILE) + 1;
    for (let tile = first; tile <= last; tile++) {
      const y = tile * TILE;
      const screenTop = Math.round(camera.sy(y + TILE));
      const rowHeight = Math.round(camera.sy(y)) - screenTop;
      const biome = biomeAt(y);
      if (biome === "street") this.drawStreetRow(ctx, camera, tile, screenTop, rowHeight);
      else if (biome === "plaza") this.drawPlazaRow(ctx, camera, screenTop, rowHeight, tile);
      else this.drawParkRow(ctx, camera, y, screenTop, rowHeight);
      this.drawGrassDetails(ctx, camera, tile, screenTop, width, biome);
      this.drawFenceRow(ctx, camera, tile, screenTop, rowHeight);
    }
  }

  drawStreetRow(ctx, camera, tile, top, height) {
    const roadLeft = Math.round(camera.sx(-W.roadHalf));
    const roadRight = Math.round(camera.sx(W.roadHalf));
    const walk = W.sidewalk;

    ctx.fillStyle = "#b8b8b2";
    ctx.fillRect(roadLeft - walk, top, walk, height);
    ctx.fillRect(roadRight, top, walk, height);
    ctx.fillStyle = "#8e8e8a";
    ctx.fillRect(roadLeft - walk, top, walk, 1);
    ctx.fillRect(roadRight, top, walk, 1);
    ctx.fillStyle = "#e4e4de";
    ctx.fillRect(roadLeft - 3, top, 3, height);
    ctx.fillRect(roadRight, top, 3, height);

    ctx.fillStyle = "#6c6e74";
    ctx.fillRect(roadLeft, top, roadRight - roadLeft, height);
    // Asphalt speckle.
    ctx.fillStyle = "#62646a";
    for (let i = 0; i < 6; i++) {
      const speckX = roadLeft + hash(tile * 7 + i) * (roadRight - roadLeft);
      ctx.fillRect(Math.round(speckX), top + Math.round(hash(tile * 3 + i) * height), 3, 2);
    }
    if (((tile % 2) + 2) % 2 === 0) {
      ctx.fillStyle = "#f2d24b";
      ctx.fillRect(Math.round(camera.sx(0)) - 2, top + 8, 4, 22);
    }
  }

  drawPlazaRow(ctx, camera, top, height, tile) {
    const left = Math.round(camera.sx(-PLAY_HALF));
    const right = Math.round(camera.sx(PLAY_HALF));
    ctx.fillStyle = "#c2baa8";
    ctx.fillRect(left, top, right - left, height);
    ctx.fillStyle = "#b0a896";
    ctx.fillRect(left, top, right - left, 1);
    const offset = ((tile % 2) + 2) % 2 === 0 ? 0 : TILE / 2;
    for (let x = -PLAY_HALF + offset; x < PLAY_HALF; x += TILE) {
      ctx.fillRect(Math.round(camera.sx(x)), top, 1, height);
    }
    const accent = hash(tile) * 15 | 0;
    ctx.fillStyle = "#b5ad9a";
    ctx.fillRect(Math.round(camera.sx(-PLAY_HALF + accent * TILE + offset)) + 1, top + 1, TILE - 1, height - 1);
  }

  drawParkRow(ctx, camera, y, top, height) {
    const center = camera.sx(parkPathX(y + TILE / 2));
    const left = Math.round(center - 62);
    ctx.fillStyle = "#d3bf8e";
    ctx.fillRect(left - 4, top, 132, height + 1);
    ctx.fillStyle = "#b8b8b2";
    ctx.fillRect(left, top, 124, height + 1);
    ctx.fillStyle = "#a3a39d";
    ctx.fillRect(left, top, 124, 1);
  }

  drawGrassDetails(ctx, camera, tile, top, width, biome) {
    for (let i = 0; i < 18; i++) {
      const seed = tile * 31 + i * 17;
      const worldX = hash(seed) * 1400 - 700;
      const inBand = Math.abs(worldX) < PLAY_HALF;
      if (inBand && biome === "plaza") continue;
      if (inBand && biome === "street" && Math.abs(worldX) < W.roadHalf + W.sidewalk + 3) continue;
      if (inBand && biome === "park" && Math.abs(worldX - parkPathX(tile * TILE + TILE / 2)) < 70) continue;
      const x = Math.round(camera.sx(worldX));
      if (x < -4 || x > width + 4) continue;
      const y = top + Math.round(hash(seed + 5) * 36);
      ctx.fillStyle = i % 3 ? "#46a03a" : "#74cc5c";
      ctx.fillRect(x, y, 1, 3);
      ctx.fillRect(x + 2, y + 1, 1, 2);
      ctx.fillRect(x - 2, y + 1, 1, 2);
    }
  }

  // White picket fences mark the edge of the playable area.
  drawFenceRow(ctx, camera, tile, top, height) {
    for (const edge of [-PLAY_HALF - 14, PLAY_HALF + 11]) {
      const x = Math.round(camera.sx(edge));
      ctx.fillStyle = "#20202a";
      ctx.fillRect(x - 1, top, 5, height);
      ctx.fillStyle = "#f4f4ee";
      ctx.fillRect(x, top, 3, height);
      ctx.fillStyle = "#c8c8c0";
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 3, top + i * 10 + 2, 9, 3);
    }
  }
}
