/*
 * Maze holds one level's board: the walls, the collectibles and the distance fields that
 * enemies use for navigation. It knows nothing about drawing.
 */
(function (D) {
  const WALL = 0;
  const FLOOR = 1;
  const DOOR = 2;
  const HOUSE = 3;
  const NONE = 0;
  const GEAR = 1;
  const POWER = 2;

  const CELL = { "#": WALL, ".": FLOOR, o: FLOOR, " ": FLOOR, "-": DOOR, G: HOUSE };

  class Maze {
    constructor(level) {
      const rows = level.half.map((half) => half + [...half.slice(0, -1)].reverse().join(""));
      this.rows = rows.length;
      this.cols = rows[0].length;
      this.level = level;
      const size = this.rows * this.cols;
      this.cells = new Uint8Array(size);
      this.items = new Uint8Array(size);
      this.gears = 0;
      this.door = null;

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const ch = rows[y][x];
          const i = this.index(x, y);
          this.cells[i] = CELL[ch];
          if (ch === ".") { this.items[i] = GEAR; this.gears++; }
          if (ch === "o") this.items[i] = POWER;
          if (ch === "-") this.door = { x, y };
        }
      }
      // The droid starts here, so a gear under it would vanish on frame one.
      const start = this.index(level.player[0], level.player[1]);
      if (this.items[start] === GEAR) { this.items[start] = NONE; this.gears--; }

      this.exitTile = { x: this.door.x, y: this.door.y - 1 };
      this.fields = new Map();
      this.queue = new Int16Array(size);
      this.liveField = new Int16Array(size);
    }

    index(x, y) { return y * this.cols + x; }

    wrapX(x) { return x < 0 ? x + this.cols : x >= this.cols ? x - this.cols : x; }

    cell(x, y) {
      if (y < 0 || y >= this.rows) return WALL;
      return this.cells[this.index(this.wrapX(x), y)];
    }

    // The droid and patrolling enemies stay on floor tiles.
    isFloor(x, y) { return this.cell(x, y) === FLOOR; }

    // Enemies leaving or returning to the house may also use the door and its floor.
    isPassable(x, y) { return this.cell(x, y) !== WALL; }

    isHouse(x, y) { return this.cell(x, y) === HOUSE; }

    isWall(x, y) { return this.cell(x, y) === WALL; }

    // Tunnels slow enemies down, which gives the droid a way to shake a pursuer.
    isTunnel(x, y) {
      const edge = x <= 1 || x >= this.cols - 2;
      return edge && (this.isFloor(0, y) || this.isFloor(this.cols - 1, y));
    }

    itemAt(x, y) { return this.items[this.index(x, y)]; }

    // Removes and returns whatever is on the tile.
    take(x, y) {
      const i = this.index(x, y);
      const item = this.items[i];
      if (item === NONE) return NONE;
      this.items[i] = NONE;
      if (item === GEAR) this.gears--;
      return item;
    }

    clearItems() {
      this.items.fill(NONE);
      this.gears = 0;
    }

    fillField(field, target, passHouse) {
      field.fill(-1);
      let head = 0;
      let tail = 0;
      const start = this.index(target.x, target.y);
      field[start] = 0;
      this.queue[tail++] = start;
      while (head < tail) {
        const i = this.queue[head++];
        const x = i % this.cols;
        const y = (i - x) / this.cols;
        for (let dir = 0; dir < 4; dir++) {
          const nx = this.wrapX(x + D.DX[dir]);
          const ny = y + D.DY[dir];
          if (!(passHouse ? this.isPassable(nx, ny) : this.isFloor(nx, ny))) continue;
          const n = this.index(nx, ny);
          if (field[n] >= 0) continue;
          field[n] = field[i] + 1;
          this.queue[tail++] = n;
        }
      }
      return field;
    }

    // Walking distance to a fixed tile, built once and kept for the level.
    fieldTo(target) {
      const key = this.index(target.x, target.y);
      let field = this.fields.get(key);
      if (!field) {
        field = this.fillField(new Int16Array(this.cells.length), target, true);
        this.fields.set(key, field);
      }
      return field;
    }

    // Walking distance to a moving tile. Reuses one buffer, so it's safe to call in play.
    liveFieldTo(target) {
      return this.fillField(this.liveField, target, false);
    }
  }

  Maze.NONE = NONE;
  Maze.GEAR = GEAR;
  Maze.POWER = POWER;
  D.Maze = Maze;
})(window.DROID);
