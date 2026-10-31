/*
 * EnemyAI picks the targets. It has one shared director, which swaps the squad between
 * scatter and chase waves and holds what the squad "sees" of the droid, plus one
 * personality per enemy:
 *
 *   Probe Droid   Hunter    heads straight for the droid
 *   Droideka      Predictor aims four tiles ahead of the droid
 *   KX Security   Patroller walks a beat, breaks off for bursts of pursuit
 *   IG Assassin   Wildcard  mixes random turns with pincers set up off the Probe Droid
 *
 * Enemies react to where the droid was at the last sighting, so `tuning.reaction`
 * is a real delay, and it shrinks as the game gets harder.
 */
(function (D) {
  // Scatter, chase, scatter, chase... The final chase lasts for the rest of the life.
  const WAVES = [7, 20, 6, 22, 5, 26, 4];

  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

  class EnemyDirector {
    constructor() {
      this.seen = { x: 0, y: 0, dir: D.LEFT };
      this.reset();
    }

    reset() {
      this.wave = 0;
      this.waveLeft = WAVES[0];
      this.sightingLeft = 0;
      this.field = null;
    }

    get chasing() { return this.wave % 2 === 1; }

    // `paused` is true during a power-up, which stops the wave clock, as in the arcade.
    update(dt, game, paused) {
      const { player, tuning } = game;
      this.sightingLeft -= dt;
      if (this.sightingLeft <= 0) {
        this.sightingLeft = tuning.reaction;
        this.seen.x = player.nearX;
        this.seen.y = player.nearY;
        if (player.dir >= 0) this.seen.dir = player.dir;
        this.field = game.maze.liveFieldTo(this.seen);
      }

      if (paused || this.wave >= WAVES.length) return;
      // Harder runs spend less of their time scattering.
      this.waveLeft -= dt * (this.chasing ? 1 : 1 + tuning.aggression * 1.5);
      if (this.waveLeft > 0) return;
      this.wave++;
      this.waveLeft = this.wave < WAVES.length ? WAVES[this.wave] : Infinity;
      for (const enemy of game.enemies) enemy.reversePending = true;
    }
  }

  const corner = (enemy, cornerX, cornerY) => {
    const { cols, rows } = enemy.maze;
    enemy.targetX = cornerX ? cols - 2 : 1;
    enemy.targetY = cornerY ? rows - 2 : 1;
  };

  const PERSONALITIES = {
    hunter(enemy, game) {
      const { director } = game;
      if (!director.chasing) return corner(enemy, 1, 0);
      enemy.targetX = director.seen.x;
      enemy.targetY = director.seen.y;
    },

    predictor(enemy, game) {
      const { director } = game;
      if (!director.chasing) return corner(enemy, 0, 0);
      enemy.targetX = director.seen.x + D.DX[director.seen.dir] * 4;
      enemy.targetY = director.seen.y + D.DY[director.seen.dir] * 4;
    },

    patroller(enemy, game) {
      const { director } = game;
      const near = dist2(enemy.tx, enemy.ty, director.seen.x, director.seen.y) < 36;
      if (enemy.pursuitLeft > 0 || near) {
        enemy.targetX = director.seen.x;
        enemy.targetY = director.seen.y;
        return;
      }
      if (dist2(enemy.tx, enemy.ty, enemy.targetX, enemy.targetY) < 9) enemy.beat = (enemy.beat + 1) % 4;
      corner(enemy, enemy.beat === 1 || enemy.beat === 2 ? 1 : 0, enemy.beat >= 2 ? 1 : 0);
    },

    wildcard(enemy, game) {
      const { director } = game;
      if (Math.random() < 0.55 - game.tuning.aggression * 0.35) {
        enemy.targetX = Math.floor(Math.random() * enemy.maze.cols);
        enemy.targetY = Math.floor(Math.random() * enemy.maze.rows);
        return;
      }
      if (!director.chasing) return corner(enemy, 0, 1);
      // Mirror the Probe Droid through a point just ahead of the droid to close the trap.
      const pivotX = director.seen.x + D.DX[director.seen.dir] * 2;
      const pivotY = director.seen.y + D.DY[director.seen.dir] * 2;
      const hunter = game.enemies[0];
      enemy.targetX = pivotX * 2 - hunter.tx;
      enemy.targetY = pivotY * 2 - hunter.ty;
    },
  };

  const EnemyAI = {
    EnemyDirector,

    // The turn to take at a tile center. The only exclusion is doubling back.
    chooseDir(enemy, game) {
      const { maze, tuning, director } = game;
      const back = enemy.dir >= 0 ? (enemy.dir + 2) % 4 : -1;

      if (enemy.frightened) {
        const options = [];
        for (let dir = 0; dir < 4; dir++) if (dir !== back && enemy.canGo(dir)) options.push(dir);
        return options.length ? options[Math.floor(Math.random() * options.length)] : back;
      }

      PERSONALITIES[enemy.personality](enemy, game);
      // Aggressive enemies sometimes use the true walking distance rather than the
      // straight-line guess, which is what makes them hard to shake.
      const smart = enemy.personality === "hunter" && director.chasing && director.field
        && Math.random() < tuning.aggression;

      let best = -1;
      let bestScore = Infinity;
      for (let dir = 0; dir < 4; dir++) {
        if (dir === back || !enemy.canGo(dir)) continue;
        const nx = maze.wrapX(enemy.tx + D.DX[dir]);
        const ny = enemy.ty + D.DY[dir];
        const score = smart ? director.field[maze.index(nx, ny)] : dist2(nx, ny, enemy.targetX, enemy.targetY);
        if (score >= 0 && score < bestScore) {
          bestScore = score;
          best = dir;
        }
      }
      return best >= 0 ? best : back;
    },
  };

  D.EnemyAI = EnemyAI;
})(window.DROID);
