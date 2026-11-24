/*
 * Collision tests. The saucer is treated as an ellipse (player.rx by player.ry) because a
 * circle would make the wide, flat disc either too forgiving at the rim or unfair on top.
 */
(function (U) {
  "use strict";

  U.Collision = {
    // A circle against the saucer: grow the ellipse by the circle's radius.
    ufoCircle(player, cx, cy, r) {
      const dx = (cx - player.x) / (player.rx + r);
      const dy = (cy - player.y) / (player.ry + r);
      return dx * dx + dy * dy <= 1;
    },

    // A rectangle against the saucer: test the rectangle's closest point to the centre.
    ufoRect(player, x, y, w, h) {
      const px = U.clamp(player.x, x, x + w);
      const py = U.clamp(player.y, y, y + h);
      const dx = (px - player.x) / player.rx;
      const dy = (py - player.y) / player.ry;
      return dx * dx + dy * dy <= 1;
    },

    rects(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    },

    circles(ax, ay, ar, bx, by, br) {
      const dx = ax - bx;
      const dy = ay - by;
      const r = ar + br;
      return dx * dx + dy * dy <= r * r;
    },

    // Does a vertical column (a lightning bolt, an electric arc) touch the saucer?
    ufoColumn(player, x, halfWidth, top, bottom) {
      return U.Collision.ufoRect(player, x - halfWidth, top, halfWidth * 2, bottom - top);
    },
  };
})(window.UFO);
