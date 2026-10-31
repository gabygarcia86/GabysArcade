/*
 * Player is the chosen droid. Every droid plays the same, so nothing here depends on
 * which one was picked. A direction press is buffered, and the droid takes the turn at
 * the first tile where that turn is possible.
 */
(function (D) {
  // How long a tap keeps waiting for an opening before it's forgotten, in seconds.
  const BUFFER_TIME = 0.5;

  class Player extends D.Actor {
    constructor() {
      super();
      this.wanted = -1;
      this.bufferLeft = 0;
      this.speed = 0;
      this.moving = false;
    }

    place(maze, x, y) {
      super.place(maze, x, y, D.LEFT);
      this.wanted = -1;
      this.bufferLeft = 0;
      this.moving = false;
    }

    canEnter(x, y) { return this.maze.isFloor(x, y); }

    press(dir) {
      this.wanted = dir;
      this.bufferLeft = BUFFER_TIME;
    }

    onTile() {
      if (this.wanted >= 0 && this.canGo(this.wanted)) {
        this.dir = this.wanted;
      } else if (this.dir >= 0 && !this.canGo(this.dir)) {
        this.dir = -1;
      }
    }

    update(dt) {
      if (this.bufferLeft > 0) {
        this.bufferLeft -= dt;
        if (this.bufferLeft <= 0) this.wanted = -1;
      }
      // A U-turn doesn't have to wait for the next tile center.
      if (this.dir >= 0 && this.wanted === (this.dir + 2) % 4 && this.t > 0) this.reverse();

      this.advance(this.speed * dt);
      this.moving = this.dir >= 0;
      if (this.moving) this.walk = (this.walk + dt * 2.6) % 1;
    }
  }

  D.Player = Player;
})(window.DROID);
