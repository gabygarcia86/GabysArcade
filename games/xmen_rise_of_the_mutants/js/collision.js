/*
 * Collision queries used by combat: shapes against enemies and breakable tiles.
 */
(function (XM) {
  "use strict";
  const T = XM.T;

  const Collide = {
    rectRect: XM.U.overlap,
    circleRect(cx, cy, r, b) {
      const nx = XM.U.clamp(cx, b.x, b.x + b.w);
      const ny = XM.U.clamp(cy, b.y, b.y + b.h);
      const dx = cx - nx;
      const dy = cy - ny;
      return dx * dx + dy * dy <= r * r;
    },
    pointRect(px, py, b) {
      return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
    },
    // Calls fn(tx, ty, code) for each breakable tile under the rectangle.
    breakablesIn(level, rect, fn) {
      const x0 = Math.max(0, Math.floor(rect.x / T));
      const x1 = Math.min(level.W - 1, Math.floor((rect.x + rect.w) / T));
      const y0 = Math.max(0, Math.floor(rect.y / T));
      const y1 = Math.min(level.H - 1, Math.floor((rect.y + rect.h) / T));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const code = level.tiles[ty * level.W + tx];
          if (code === XM.TILE.CRATE || code === XM.TILE.SEAL) fn(tx, ty, code);
        }
      }
    },
    // Distance-sorted enemies inside a circle; used by targeting abilities.
    enemiesNear(enemies, x, y, r) {
      const out = [];
      for (const e of enemies) {
        if (e.dead || e.untargetable) continue;
        const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
        if (d <= r) out.push({ e, d });
      }
      out.sort((a, b) => a.d - b.d);
      return out.map((o) => o.e);
    },
  };

  XM.Collide = Collide;
})(window.XM);
