/*
 * Enemy is one evil droid. It's a small state machine:
 *
 *   waiting  sits in the house until its release timer ends
 *   leaving  walks out through the door
 *   active   patrols and chases under EnemyAI
 *   returning  defeated: races back to its start tile as a pair of eyes
 *
 * `frightened` is a flag on top of those states, set while a power-up runs.
 */
(function (D) {
  const PERSONALITY = { probe: "hunter", droideka: "predictor", kx: "patroller", ig: "wildcard" };

  class Enemy extends D.Actor {
    constructor(id) {
      super();
      this.id = id;
      this.personality = PERSONALITY[id];
      this.game = null;
      this.state = "waiting";
      this.frightened = false;
      this.reversePending = false;
      this.releaseLeft = 0;
      this.pursuitLeft = 0;
      this.pursuitWait = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.beat = 0;
      this.startX = 0;
      this.startY = 0;
      this.homeField = null;
      this.bob = Math.random() * D.TAU;
    }

    reset(game, x, y, releaseDelay) {
      this.game = game;
      this.place(game.maze, x, y, D.UP);
      this.startX = x;
      this.startY = y;
      this.homeField = game.maze.fieldTo({ x, y });
      this.frightened = false;
      this.reversePending = false;
      this.beat = 0;
      this.pursuitLeft = 0;
      this.pursuitWait = 4 + Math.random() * 4;
      this.state = game.maze.isHouse(x, y) ? "waiting" : "active";
      this.releaseLeft = releaseDelay;
    }

    canEnter(x, y) {
      if (this.state === "active") return this.maze.isFloor(x, y);
      return this.maze.isPassable(x, y);
    }

    // True when a touch from the droid counts for anything.
    get solid() { return this.state === "active" || this.state === "leaving"; }

    setFrightened(on) {
      if (this.state === "returning") return;
      if (on && !this.frightened && this.state === "active") this.reversePending = true;
      this.frightened = on;
    }

    defeat() {
      this.frightened = false;
      this.reversePending = false;
      this.state = "returning";
    }

    // Steps along a prebuilt distance field, toward 0.
    followField(field) {
      const maze = this.maze;
      let best = -1;
      let bestScore = Infinity;
      for (let dir = 0; dir < 4; dir++) {
        if (!this.canGo(dir)) continue;
        const score = field[maze.index(maze.wrapX(this.tx + D.DX[dir]), this.ty + D.DY[dir])];
        if (score >= 0 && score < bestScore) {
          bestScore = score;
          best = dir;
        }
      }
      return best;
    }

    onTile() {
      const maze = this.maze;
      if (this.state === "returning") {
        if (this.tx === this.startX && this.ty === this.startY) {
          this.dir = -1;
          this.state = maze.isHouse(this.tx, this.ty) ? "waiting" : "active";
          this.releaseLeft = 1.2;
          this.facing = D.UP;
          return;
        }
        this.dir = this.followField(this.homeField);
        return;
      }
      if (this.state === "leaving") {
        if (this.tx === maze.exitTile.x && this.ty === maze.exitTile.y) {
          this.state = "active";
          this.dir = -1;
        } else {
          this.dir = this.followField(maze.fieldTo(maze.exitTile));
          return;
        }
      }
      if (this.state === "active") this.dir = D.EnemyAI.chooseDir(this, this.game);
    }

    update(dt) {
      const { maze, tuning } = this.game;
      this.bob += dt * 6;

      if (this.state === "waiting") {
        this.releaseLeft -= dt;
        if (this.releaseLeft <= 0) this.state = "leaving";
        return;
      }

      if (this.reversePending) {
        this.reversePending = false;
        if (this.state === "active" && this.t > 0) this.reverse();
      }

      if (this.personality === "patroller") {
        if (this.pursuitLeft > 0) {
          this.pursuitLeft -= dt;
        } else {
          this.pursuitWait -= dt;
          if (this.pursuitWait <= 0) {
            this.pursuitLeft = 3 + tuning.aggression * 5;
            this.pursuitWait = 9 - tuning.aggression * 5;
          }
        }
      }

      let speed = tuning.enemySpeed;
      if (this.state === "returning") speed = tuning.enemySpeed * 2.2;
      else if (this.frightened) speed = tuning.frightSpeed;
      else if (maze.isTunnel(this.nearX, this.nearY)) speed *= 0.6;
      else if (this.state === "leaving") speed *= 0.7;

      this.advance(speed * dt);
      if (this.dir >= 0) this.walk = (this.walk + dt * 2.4) % 1;
    }
  }

  D.Enemy = Enemy;
})(window.DROID);
