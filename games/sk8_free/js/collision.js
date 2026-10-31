/*
 * Lightweight 2D collision helpers. Hitboxes are centered on the object:
 * circles use { x, y, r } and rectangles use { x, y, w, h }.
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function circleVsCircle(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const radius = ar + br;
  return dx * dx + dy * dy <= radius * radius;
}

export function circleVsRect(cx, cy, r, rx, ry, rw, rh) {
  const dx = cx - clamp(cx, rx - rw / 2, rx + rw / 2);
  const dy = cy - clamp(cy, ry - rh / 2, ry + rh / 2);
  return dx * dx + dy * dy <= r * r;
}

// Tests the player's circle against an entity's hitbox, whichever shape it is.
export function hitsEntity(px, py, pr, entity) {
  const { kind } = entity;
  return kind.w
    ? circleVsRect(px, py, pr, entity.x, entity.y, kind.w, kind.h)
    : circleVsCircle(px, py, pr, entity.x, entity.y, kind.r);
}
