/*
 * Every destructible Christmas object: its shape, material, points and toughness, plus the
 * Thing class that pairs a physics body with its game state (health, face, flashes).
 *
 * Shapes are written in "design" coordinates with the origin at the bottom centre and up
 * being negative y, so the art code and the physics agree on where everything is.
 *
 * Toughness (hp) is measured as a speed change in px/s: every bump takes away whatever the
 * bump changed the object's speed by, above a small allowance. Light, fragile things break
 * when anything hits them; heavy things mostly break by falling or toppling over.
 */
(function (G) {
  "use strict";

  const { Body } = G.Physics;

  // ---------------------------------------------------------------- Materials

  G.MATERIALS = {
    wood: { density: 0.0011, friction: 0.7, restitution: 0.08, sound: "wood", burst: "wood" },
    ice: { density: 0.0009, friction: 0.04, restitution: 0.05, sound: "ice", burst: "ice" },
    glass: { density: 0.0007, friction: 0.35, restitution: 0.32, sound: "glass", burst: "glass" },
    present: { density: 0.001, friction: 0.6, restitution: 0.2, sound: "paper", burst: "confetti" },
    candy: { density: 0.0007, friction: 0.5, restitution: 0.3, sound: "candy", burst: "candy" },
    metal: { density: 0.0032, friction: 0.5, restitution: 0.15, sound: "bell", burst: "gold" },
    snow: { density: 0.0009, friction: 0.85, restitution: 0.02, sound: "snow", burst: "snow" },
    tree: { density: 0.0008, friction: 0.8, restitution: 0.04, sound: "tree", burst: "needles" },
    ginger: { density: 0.001, friction: 0.7, restitution: 0.05, sound: "crunch", burst: "crumbs" },
    cloth: { density: 0.0006, friction: 0.85, restitution: 0.06, sound: "cloth", burst: "cloth" },
    gold: { density: 0.0011, friction: 0.6, restitution: 0.2, sound: "paper", burst: "goldConfetti" },
  };

  // ---------------------------------------------------------------- Shape helpers

  const box = (w, h) => [
    [-w / 2, -h],
    [w / 2, -h],
    [w / 2, 0],
    [-w / 2, 0],
  ];

  // Convex hull (monotone chain) of a point list.
  function hull(points) {
    const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }

  function circlePts(cx, cy, r, n = 8) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return out;
  }

  // Snowman: three stacked snowballs. Returns the hull and the ball layout for the art.
  function snowmanShape(s) {
    const r1 = 26 * s;
    const r2 = 19 * s;
    const r3 = 14 * s;
    const c1 = -r1;
    const c2 = c1 - r1 - r2 + 8 * s;
    const c3 = c2 - r2 - r3 + 6 * s;
    const pts = [[-r1 * 0.62, 0], [r1 * 0.62, 0], ...circlePts(0, c1, r1, 10), ...circlePts(0, c2, r2, 8), ...circlePts(0, c3, r3, 8)];
    return { verts: hull(pts), balls: [[c1, r1], [c2, r2], [c3, r3]] };
  }

  function treeShape(w, h) {
    const tk = h * 0.09;
    const tw = w * 0.34;
    return [
      [0, -h],
      [w / 2, -tk],
      [tw / 2, 0],
      [-tw / 2, 0],
      [-w / 2, -tk],
    ];
  }

  const smallMan = snowmanShape(1);
  const bigMan = snowmanShape(1.95);

  // ---------------------------------------------------------------- Catalog
  // kind: what the art code draws. topple: counts as smashed once knocked over.

  const D = {
    ornamentS: { name: "Small Ornament", points: 50, mat: "glass", radius: 16, hp: 200, kind: "ornament" },
    ornamentL: { name: "Large Ornament", points: 100, mat: "glass", radius: 26, hp: 280, kind: "ornament" },
    ornamentGiant: {
      name: "Giant Ornament",
      points: 400,
      mat: "glass",
      radius: 56,
      hp: 1500,
      kind: "ornament",
      density: 0.0011,
      restitution: 0.25,
      angularDamping: 0.02,
      face: true,
      special: "roller",
    },
    stocking: {
      name: "Christmas Stocking",
      points: 75,
      mat: "cloth",
      verts: hull([[-15, -58], [15, -58], [15, -20], [24, -12], [20, 0], [-6, 0], [-16, -10]]),
      hp: 480,
      kind: "stocking",
    },
    candyCane: { name: "Candy Cane", points: 50, mat: "candy", verts: box(20, 84), hp: 430, kind: "candyCane" },
    candyCaneTall: { name: "Candy Cane", points: 50, mat: "candy", verts: box(22, 130), hp: 480, kind: "candyCane" },
    wreath: { name: "Christmas Wreath", points: 100, mat: "cloth", radius: 32, hp: 480, kind: "wreath", density: 0.0008 },
    bell: {
      name: "Christmas Bell",
      points: 150,
      mat: "metal",
      verts: [[-15, -54], [15, -54], [28, -6], [26, 0], [-26, 0], [-28, -6]],
      hp: 900,
      kind: "bell",
    },
    goldenBell: {
      name: "Golden Bell",
      points: 300,
      mat: "metal",
      verts: [[-20, -76], [20, -76], [38, -8], [35, 0], [-35, 0], [-38, -8]],
      hp: 1500,
      kind: "goldenBell",
      special: "ring",
    },
    star: { name: "Christmas Star", points: 200, mat: "gold", verts: null, hp: 330, kind: "star" },
    presentS: { name: "Small Present", points: 100, mat: "present", verts: box(40, 36), hp: 600, kind: "present" },
    presentM: { name: "Medium Present", points: 150, mat: "present", verts: box(56, 50), hp: 800, kind: "present" },
    presentL: { name: "Large Present", points: 250, mat: "present", verts: box(82, 72), hp: 1050, kind: "present" },
    presentHuge: { name: "Large Present", points: 250, mat: "present", verts: box(118, 100), hp: 1300, kind: "present" },
    presentGold: { name: "Golden Present", points: 500, mat: "gold", verts: box(48, 44), hp: 420, kind: "goldPresent", golden: true },
    presentBoom: { name: "Explosive Present", points: 150, mat: "present", verts: box(52, 48), hp: 140, kind: "boomPresent", special: "explode" },
    snowmanS: { name: "Small Snowman", points: 100, mat: "snow", verts: smallMan.verts, balls: smallMan.balls, scale: 1, hp: 600, kind: "snowman", topple: 1.0, face: true },
    snowmanG: { name: "Giant Snowman", points: 300, mat: "snow", verts: bigMan.verts, balls: bigMan.balls, scale: 1.95, hp: 1000, kind: "snowman", topple: 0.95, face: true },
    tree: { name: "Christmas Tree", points: 500, mat: "tree", verts: treeShape(124, 210), w: 124, h: 210, hp: 1000, kind: "tree", topple: 0.95 },
    treeGiant: { name: "Giant Christmas Tree", points: 1000, mat: "tree", verts: treeShape(190, 350), w: 190, h: 350, hp: 1400, kind: "tree", topple: 0.9 },
    treeMega: {
      name: "Mega Christmas Tree",
      points: 1000,
      bonus: 2500,
      mat: "tree",
      verts: treeShape(300, 560),
      w: 300,
      h: 560,
      hp: 2800,
      kind: "tree",
      topple: 0.8,
      density: 0.0013,
      mega: true,
    },
    gingerHouse: {
      name: "Gingerbread House",
      points: 750,
      mat: "ginger",
      verts: [[-66, 0], [66, 0], [66, -74], [0, -128], [-66, -74]],
      hp: 1150,
      kind: "gingerHouse",
    },
    gingerMan: {
      name: "Giant Gingerbread Man",
      points: 300,
      mat: "ginger",
      verts: hull([...circlePts(0, -92, 24, 8), [-40, -62], [40, -62], [-30, 0], [30, 0], [-34, -30], [34, -30]]),
      hp: 650,
      kind: "gingerMan",
      special: "split",
      face: true,
      topple: 1.1,
    },
    gingerBit: { name: "Gingerbread Piece", points: 50, mat: "ginger", radius: 15, hp: 220, kind: "gingerBit" },
    gumdrop: { name: "Gumdrop", points: 50, mat: "candy", verts: hull([[-16, 0], [16, 0], [14, -14], [8, -22], [0, -25], [-8, -22], [-14, -14]]), hp: 300, kind: "gumdrop" },
    // Building pieces. They score a little and count towards the destruction percentage.
    plank: { name: "Wooden Plank", points: 25, mat: "wood", hp: 900, kind: "plank", sized: true },
    ice: { name: "Ice Block", points: 30, mat: "ice", hp: 620, kind: "ice", sized: true },
    candyBeam: { name: "Candy Beam", points: 25, mat: "candy", hp: 700, kind: "candyBeam", sized: true },
  };

  // Star: a pentagon for physics, drawn as a five-pointed star.
  {
    const r = 30;
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const bottom = Math.max(...pts.map((p) => p[1]));
    D.star.verts = pts.map((p) => [p[0], p[1] - bottom]);
    D.star.r = r;
    D.star.lift = bottom;
  }

  for (const key in D) D[key].key = key;
  G.DEFS = D;

  // ---------------------------------------------------------------- Thing

  const COLORS = ["#e0303a", "#2f7de1", "#ffd23f", "#9b4dff", "#2fbf71", "#ff7ad9", "#ff8a1f", "#28c8d8"];
  const RIBBONS = ["#ffd23f", "#ffffff", "#e0303a", "#2fbf71", "#5fd0ff", "#ff7ad9"];
  let thingId = 1;

  class Thing {
    constructor(def, body, opts = {}) {
      this.id = thingId++;
      this.def = def;
      this.body = body;
      body.owner = this;
      this.hp = def.hp * (opts.hpScale || 1);
      this.maxHp = this.hp;
      this.alive = true;
      this.points = def.points;
      this.bonus = !!opts.bonus; // dropped in by an event; not counted in the destruction %
      this.color = opts.color || COLORS[(this.id * 5) % COLORS.length];
      this.ribbon = opts.ribbon || RIBBONS[(this.id * 3) % RIBBONS.length];
      this.flash = 0;
      this.shake = 0;
      this.mood = "calm"; // calm | worried | dizzy
      this.moodT = 0;
      this.toppleT = 0;
      this.ringCD = 0;
      this.hitBySnowball = false;
      this.w = opts.w || def.w || 0;
      this.h = opts.h || def.h || 0;
      this.seed = Math.random() * 1000;
      this.wobble = 0; // set by the tree-collapse event
    }

    get x() {
      return this.body.x;
    }

    get y() {
      return this.body.y;
    }

    // Ratio of health left (1 = untouched).
    get health() {
      return Math.max(0, this.hp / this.maxHp);
    }
  }

  // Builds the body for a catalog entry, placed so its bottom sits at (x, yBottom).
  // Sized pieces (planks, ice, candy beams) take opts.w and opts.h.
  function create(key, x, yBottom, opts = {}) {
    const def = D[key];
    if (!def) throw new Error(`Unknown object ${key}`);
    const mat = G.MATERIALS[def.mat];
    const common = {
      x,
      y: 0,
      angle: opts.angle || 0,
      density: def.density || mat.density,
      friction: def.friction == null ? mat.friction : def.friction,
      restitution: def.restitution == null ? mat.restitution : def.restitution,
      angularDamping: def.angularDamping == null ? (def.radius ? 3.5 : 0.15) : def.angularDamping,
      sleeping: opts.awake ? false : true,
    };
    let body;
    if (def.sized) {
      body = new Body({ ...common, verts: box(opts.w, opts.h) });
    } else if (def.radius) {
      body = new Body({ ...common, radius: def.radius });
    } else {
      body = new Body({ ...common, verts: def.verts });
    }
    // Sit the body exactly on the surface (only when unrotated; rotated pieces pass y).
    if (opts.y != null) body.y = opts.y;
    else body.y = yBottom - body.bottom;
    body.updateGeometry();
    return new Thing(def, body, opts);
  }

  G.Objects = { create, Thing, hull, box, COLORS };
})(window.GS);
