/*
 * Physics: tile-based collision for bodies (hero, enemies, pickups), one-way ledges,
 * moving platforms and crumbling platforms.
 */
(function (XM) {
  "use strict";
  const T = XM.T;

  const TILE = (XM.TILE = {
    EMPTY: 0,
    SOLID: 1,
    ONEWAY: 2,
    HAZARD: 3,
    LADDER: 4,
    CRATE: 5,
    SEAL: 6, // reinforced: only a Special or Ultimate breaks it
    FAKE: 7, // looks solid, but it is a secret passage
    GATE: 8, // arena barrier while a fight is on
  });

  const solid = (t) => t === 1 || t === 5 || t === 6 || t === 8;

  const Physics = {
    GRAVITY: 2000,
    MAX_FALL: 950,
    solid,

    tile(level, tx, ty) {
      if (tx < 0 || tx >= level.W) return TILE.SOLID;
      if (ty < 0 || ty >= level.H) return TILE.EMPTY;
      return level.tiles[ty * level.W + tx];
    },

    solidAt(level, px, py) {
      return solid(this.tile(level, Math.floor(px / T), Math.floor(py / T)));
    },

    // Moves a body {x,y,w,h,vx,vy} through the level, setting onGround, hitWall and riding.
    move(b, dt, level, platforms, gravityScale = 1) {
      if (!b.noGravity) {
        b.vy += this.GRAVITY * gravityScale * (b.gravity !== undefined ? b.gravity : 1) * dt;
        if (b.vy > (b.maxFall || this.MAX_FALL)) b.vy = b.maxFall || this.MAX_FALL;
      }
      // Carried along by the platform we stood on last step.
      if (b.riding && b.riding.active !== false) {
        b.x += b.riding.dx;
        b.y += b.riding.dy;
      }
      b.riding = null;
      b.hitWall = 0;

      // Horizontal
      b.x += b.vx * dt;
      {
        // Both sides are checked when standing still, so a body is pushed out of walls.
        const top = Math.floor(b.y / T);
        const bot = Math.floor((b.y + b.h - 0.01) / T);
        if (b.vx >= 0) {
          const col = Math.floor((b.x + b.w - 0.01) / T);
          for (let r = top; r <= bot; r++) {
            if (solid(this.tile(level, col, r))) {
              b.x = col * T - b.w;
              if (b.vx > 0) b.vx = 0;
              b.hitWall = 1;
              break;
            }
          }
        }
        if (b.vx <= 0) {
          const col = Math.floor(b.x / T);
          for (let r = top; r <= bot; r++) {
            if (solid(this.tile(level, col, r))) {
              b.x = (col + 1) * T;
              if (b.vx < 0) b.vx = 0;
              b.hitWall = -1;
              break;
            }
          }
        }
      }

      // Vertical
      const prevBottom = b.y + b.h;
      b.y += b.vy * dt;
      b.onGround = false;
      const left = Math.floor((b.x + 1) / T);
      const right = Math.floor((b.x + b.w - 1) / T);
      if (b.vy >= 0) {
        const row = Math.floor((b.y + b.h) / T);
        for (let c = left; c <= right; c++) {
          const t = this.tile(level, c, row);
          const tileTop = row * T;
          if (solid(t) || (t === TILE.ONEWAY && !b.dropping && prevBottom <= tileTop + 1)) {
            b.y = tileTop - b.h;
            b.vy = 0;
            b.onGround = true;
            break;
          }
        }
      } else {
        const row = Math.floor(b.y / T);
        for (let c = left; c <= right; c++) {
          if (solid(this.tile(level, c, row))) {
            b.y = (row + 1) * T;
            b.vy = 0;
            b.bumped = true;
            break;
          }
        }
      }

      // Moving and crumbling platforms: solid from above only.
      if (platforms && b.vy >= 0 && !b.dropping) {
        for (const p of platforms) {
          if (p.active === false) continue;
          if (b.x + b.w <= p.x || b.x >= p.x + p.w) continue;
          const pTopBefore = p.y - p.dy;
          if (prevBottom <= pTopBefore + 2 && b.y + b.h >= p.y - 0.5) {
            b.y = p.y - b.h;
            b.vy = 0;
            b.onGround = true;
            b.riding = p;
            if (p.crumble && p.state === 0) p.state = 1;
            break;
          }
        }
      }
    },

    // True when the body's lower half touches a hazard tile (spikes sit in the lower half).
    hazard(level, b) {
      const left = Math.floor((b.x + 4) / T);
      const right = Math.floor((b.x + b.w - 4) / T);
      const top = Math.floor((b.y + b.h * 0.5) / T);
      const bot = Math.floor((b.y + b.h - 1) / T);
      for (let r = top; r <= bot; r++) {
        for (let c = left; c <= right; c++) {
          if (this.tile(level, c, r) === TILE.HAZARD && b.y + b.h > r * T + T * 0.45) return true;
        }
      }
      return false;
    },

    ladderAt(level, b) {
      const c = Math.floor((b.x + b.w / 2) / T);
      const r1 = Math.floor((b.y + 4) / T);
      const r2 = Math.floor((b.y + b.h - 2) / T);
      for (let r = r1; r <= r2; r++) if (this.tile(level, c, r) === TILE.LADDER) return c;
      return -1;
    },

    ladderBelow(level, b) {
      const c = Math.floor((b.x + b.w / 2) / T);
      const r = Math.floor((b.y + b.h + 2) / T);
      return this.tile(level, c, r) === TILE.LADDER ? c : -1;
    },

    // Platforms move back and forth along their path; crumbling ones fall and come back.
    updatePlatforms(platforms, dt) {
      for (const p of platforms) {
        const ox = p.x;
        const oy = p.y;
        if (p.crumble) {
          if (p.state === 1) {
            p.timer += dt;
            p.shake = Math.sin(p.timer * 60) * 2;
            if (p.timer > 0.55) {
              p.state = 2;
              p.timer = 0;
              p.vy = 0;
            }
          } else if (p.state === 2) {
            p.vy += 1600 * dt;
            p.y += p.vy * dt;
            p.timer += dt;
            p.active = false;
            if (p.timer > 3) {
              p.state = 0;
              p.timer = 0;
              p.y = p.y0;
              p.active = true;
              p.shake = 0;
            }
          }
        } else if (p.path) {
          p.t += (dt * p.speed) / p.len;
          const k = (1 - Math.cos(p.t * Math.PI)) / 2; // eases at both ends
          p.x = p.x0 + (p.x1 - p.x0) * k;
          p.y = p.y0 + (p.y1 - p.y0) * k;
        }
        p.dx = p.x - ox;
        p.dy = p.crumble ? 0 : p.y - oy;
      }
    },
  };

  XM.Physics = Physics;
})(window.XM);
