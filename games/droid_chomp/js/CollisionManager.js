/*
 * CollisionManager answers the two questions that end a step: what's the droid standing
 * on, and is an enemy touching it. Walls need no check here, because Actor never leaves
 * the grid.
 */
(function (D) {
  // Centers closer than this count as a touch, in tiles.
  const TOUCH = 0.62;

  class CollisionManager {
    // Distance between two actors, the short way around a tunnel.
    distance(a, b, cols) {
      let dx = Math.abs(a.x - b.x);
      if (dx > cols / 2) dx = cols - dx;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Returns the first enemy touching the player, or null.
    enemyTouching(player, enemies, cols) {
      for (const enemy of enemies) {
        if (enemy.solid && this.distance(player, enemy, cols) < TOUCH) return enemy;
      }
      return null;
    }

    // Removes and returns the item at the droid's nearest tile.
    collect(player, maze) {
      return maze.take(player.nearX, player.nearY);
    }
  }

  D.CollisionManager = CollisionManager;
})(window.DROID);
