/*
 * Actor is anything that walks the grid. Its place is a tile, a direction and a progress
 * value from 0 to 1 toward the next tile, so a character can never end up inside a wall
 * or drift off a corridor's center line. Turns only happen at progress 0.
 */
(function (D) {
  class Actor {
    constructor() {
      this.maze = null;
      this.tx = 0;
      this.ty = 0;
      this.dir = -1;
      this.t = 0;
      this.facing = D.DOWN;
      this.walk = 0; // Walk cycle phase, 0 to 1.
    }

    place(maze, x, y, facing) {
      this.maze = maze;
      this.tx = x;
      this.ty = y;
      this.dir = -1;
      this.t = 0;
      this.facing = facing;
    }

    // Position in tile units. Past either edge of a tunnel this reads below 0 or above cols - 1.
    get x() { return this.dir < 0 ? this.tx : this.tx + D.DX[this.dir] * this.t; }
    get y() { return this.dir < 0 ? this.ty : this.ty + D.DY[this.dir] * this.t; }

    // Nearest tile, with tunnel wrapping applied.
    get nearX() { return this.maze.wrapX(Math.round(this.x)); }
    get nearY() { return Math.round(this.y); }

    canEnter() { return false; }

    canGo(dir) {
      return this.canEnter(this.tx + D.DX[dir], this.ty + D.DY[dir]);
    }

    // Called on every tile center to pick this.dir. Setting -1 stops the actor.
    onTile() {}

    advance(distance) {
      for (let guard = 0; distance > 1e-6 && guard < 6; guard++) {
        if (this.t === 0) {
          this.onTile();
          if (this.dir < 0) return;
          this.facing = this.dir;
        }
        const remaining = 1 - this.t;
        if (distance < remaining) {
          this.t += distance;
          return;
        }
        distance -= remaining;
        this.tx = this.maze.wrapX(this.tx + D.DX[this.dir]);
        this.ty += D.DY[this.dir];
        this.t = 0;
      }
    }

    // Turns around on the spot, even between two tiles.
    reverse() {
      if (this.dir < 0) return;
      if (this.t > 0) {
        this.tx = this.maze.wrapX(this.tx + D.DX[this.dir]);
        this.ty += D.DY[this.dir];
        this.t = 1 - this.t;
      }
      this.dir = (this.dir + 2) % 4;
      this.facing = this.dir;
    }
  }

  D.Actor = Actor;
})(window.DROID);
