/*
 * Platform and wall collision.
 *
 * Characters are positioned by their feet: x is the center, y is the bottom.
 * Solids are rectangles, positioned by their top-left corner. Slopes are walkable surfaces.
 */
(function (MQ) {
  const { clamp } = MQ.U;
  const CELL = 256;
  const MAX_STEP = 8; // Longest move between two collision checks, so nothing tunnels.
  const SKIN = 0.01;

  class CollisionManager {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.columns = Array.from({ length: Math.ceil(width / CELL) + 1 }, () => []);
      this.dynamic = []; // Moving platforms, falling platforms and pushed objects.
      this.slopes = [];
      this.found = [];
      this.stamp = 0;
    }

    add(solid) {
      solid.active = solid.active ?? true;
      solid.stamp = 0;
      if (solid.dynamic) {
        this.dynamic.push(solid);
      } else {
        const first = clamp(Math.floor(solid.x / CELL), 0, this.columns.length - 1);
        const last = clamp(Math.floor((solid.x + solid.w) / CELL), 0, this.columns.length - 1);
        for (let i = first; i <= last; i++) this.columns[i].push(solid);
      }
      return solid;
    }

    addSlope(x0, y0, x1, y1) {
      this.slopes.push({ x0, y0, x1, y1 });
    }

    // The result array is reused, so read it before the next query.
    query(left, top, right, bottom) {
      const found = this.found;
      found.length = 0;
      const stamp = ++this.stamp;
      const first = clamp(Math.floor(left / CELL), 0, this.columns.length - 1);
      const last = clamp(Math.floor(right / CELL), 0, this.columns.length - 1);
      for (let c = first; c <= last; c++) {
        const column = this.columns[c];
        for (let i = 0; i < column.length; i++) {
          const s = column[i];
          if (s.stamp === stamp || !s.active) continue;
          if (s.x < right && s.x + s.w > left && s.y < bottom && s.y + s.h > top) {
            s.stamp = stamp;
            found.push(s);
          }
        }
      }
      for (let i = 0; i < this.dynamic.length; i++) {
        const s = this.dynamic[i];
        if (s.active && s.x < right && s.x + s.w > left && s.y < bottom && s.y + s.h > top) found.push(s);
      }
      return found;
    }

    slopeAt(x, y, above, below) {
      let best = Infinity;
      for (let i = 0; i < this.slopes.length; i++) {
        const s = this.slopes[i];
        if (x < s.x0 || x > s.x1) continue;
        const surface = s.y0 + ((x - s.x0) / (s.x1 - s.x0)) * (s.y1 - s.y0);
        if (surface >= y - above && surface <= y + below && surface < best) best = surface;
      }
      return best;
    }

    insideSolid(x, y, radius = 0) {
      const found = this.query(x - radius - SKIN, y - radius - SKIN, x + radius + SKIN, y + radius + SKIN);
      for (let i = 0; i < found.length; i++) {
        if (!found[i].oneWay) return found[i];
      }
      for (let i = 0; i < this.slopes.length; i++) {
        const s = this.slopes[i];
        if (x < s.x0 || x >= s.x1) continue;
        if (y > s.y0 + ((x - s.x0) / (s.x1 - s.x0)) * (s.y1 - s.y0)) return s;
      }
      return null;
    }

    free(x, y, w, h) {
      const found = this.query(x - w / 2 + SKIN, y - h + SKIN, x + w / 2 - SKIN, y - SKIN);
      for (let i = 0; i < found.length; i++) {
        if (!found[i].oneWay) return false;
      }
      return true;
    }

    // Top of the first walkable surface at or below y, or Infinity.
    floorBelow(x, y, distance = 2000) {
      let best = this.slopeAt(x, y, 2, distance);
      const found = this.query(x - 1, y - 2, x + 1, y + distance);
      for (let i = 0; i < found.length; i++) {
        if (found[i].y >= y - 2 && found[i].y < best) best = found[i].y;
      }
      return best;
    }

    clearLine(x0, y0, x1, y1) {
      // Finer than the thinnest wall.
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14);
      for (let i = 1; i < steps; i++) {
        if (this.insideSolid(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)) return false;
      }
      return true;
    }

    /*
     * Moves a body by its velocity. Sets grounded, ground, wall and ceiling.
     * options.step is the ledge height it climbs automatically, options.drop ignores one-way platforms.
     */
    move(body, dt, options) {
      const wasGrounded = body.grounded;
      const stepHeight = options?.step ?? 0;
      const drop = options?.drop ?? false;
      body.grounded = false;
      body.ground = null;
      body.wall = 0;
      body.ceiling = false;

      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(body.vx * dt), Math.abs(body.vy * dt)) / MAX_STEP));
      const slice = dt / steps;
      for (let i = 0; i < steps; i++) {
        if (body.vx) this.moveX(body, body.vx * slice, wasGrounded, stepHeight);
        this.moveY(body, body.vy * slice, drop);
      }

      // Stick to slopes when walking downhill.
      if (wasGrounded && !body.grounded && body.vy >= 0) {
        const surface = this.slopeAt(body.x, body.y, 4, Math.abs(body.vx * dt) + 8);
        if (surface < Infinity) {
          body.y = surface;
          body.vy = 0;
          body.grounded = true;
        }
      }

      const half = body.w / 2;
      body.x = clamp(body.x, half, this.width - half);
      if (body.y - body.h < 0) {
        body.y = body.h;
        body.vy = Math.max(0, body.vy);
      }
    }

    moveX(body, distance, wasGrounded, stepHeight) {
      body.x += distance;
      const half = body.w / 2;
      const found = this.query(body.x - half, body.y - body.h + SKIN, body.x + half, body.y - SKIN);

      let target = null;
      let top = Infinity;
      for (let i = 0; i < found.length; i++) {
        const s = found[i];
        if (s.oneWay) continue;
        const left = s.x + s.w / 2 > body.x;
        if (distance > 0 ? left : !left) {
          if (!target || (distance > 0 ? s.x < target.x : s.x + s.w > target.x + target.w)) target = s;
          top = Math.min(top, s.y);
        }
      }
      if (!target) return;

      // Small ledges are stepped over. In the air, feet that just miss a lip still make it.
      const climb = body.y - top;
      const limit = wasGrounded ? stepHeight : body.vy > -120 ? stepHeight * 0.8 : 0;
      if (climb > 0 && climb <= limit && this.free(body.x, top, body.w, body.h)) {
        body.y = top;
        if (body.vy > 0) body.vy = 0;
        return;
      }

      body.x = distance > 0 ? target.x - half : target.x + target.w + half;
      body.wall = distance > 0 ? 1 : -1;
      body.vx = 0;
    }

    moveY(body, distance, drop) {
      const previous = body.y;
      body.y += distance;
      const half = body.w / 2 - SKIN;

      if (distance >= 0) {
        const found = this.query(body.x - half, previous - 1, body.x + half, body.y + 0.5);
        let landing = Infinity;
        let ground = null;
        for (let i = 0; i < found.length; i++) {
          const s = found[i];
          if (s.oneWay && drop) continue;
          const tolerance = s.oneWay ? 4 : 10;
          if (previous <= s.y + tolerance && s.y < landing) {
            landing = s.y;
            ground = s;
          }
        }
        const surface = this.slopeAt(body.x, body.y, distance + 14, 0.5);
        if (surface < landing) {
          landing = surface;
          ground = null;
        }
        if (landing < Infinity) {
          body.y = landing;
          body.vy = 0;
          body.grounded = true;
          body.ground = ground;
        }
        return;
      }

      const found = this.query(body.x - half, body.y - body.h, body.x + half, previous - body.h + 1);
      for (let i = 0; i < found.length; i++) {
        const s = found[i];
        if (s.oneWay || s.y + s.h > previous - body.h + 10) continue;
        // Slide around corners that the head only just clips.
        const clipLeft = body.x + half - s.x;
        const clipRight = s.x + s.w - (body.x - half);
        const nudge = clipLeft < 10 ? -clipLeft - 0.5 : clipRight < 10 ? clipRight + 0.5 : 0;
        if (nudge && this.free(body.x + nudge, body.y, body.w, body.h)) {
          body.x += nudge;
        } else {
          body.y = s.y + s.h + body.h;
          body.vy = 0;
          body.ceiling = true;
        }
        return;
      }
    }

    // Last resort if something solid appears on top of a character.
    unstick(body) {
      if (this.free(body.x, body.y, body.w, body.h)) return;
      for (let distance = 6; distance <= 360; distance += 6) {
        if (this.free(body.x, body.y - distance, body.w, body.h) && body.y - distance - body.h > 0) {
          body.y -= distance;
          return;
        }
        for (const side of [-1, 1]) {
          const x = body.x + distance * side;
          if (x > body.w / 2 && x < this.width - body.w / 2 && this.free(x, body.y, body.w, body.h)) {
            body.x = x;
            return;
          }
        }
      }
    }
  }

  // Rectangle test between a character and an area given by its edges.
  MQ.touches = (body, left, top, right, bottom) =>
    body.x - body.w / 2 < right && body.x + body.w / 2 > left && body.y - body.h < bottom && body.y > top;

  // Circle against a character's box.
  MQ.nearBody = (body, x, y, radius) => {
    const dx = x - clamp(x, body.x - body.w / 2, body.x + body.w / 2);
    const dy = y - clamp(y, body.y - body.h, body.y);
    return dx * dx + dy * dy <= radius * radius;
  };

  MQ.CollisionManager = CollisionManager;
})(window.MQ);
