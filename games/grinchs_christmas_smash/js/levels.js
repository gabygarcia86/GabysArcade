/*
 * The 20 levels. Each one is a small build script run against a LevelBuilder, which places
 * objects so they sit exactly on whatever is under them (everything starts asleep, so a
 * structure stays as built until something hits it).
 *
 * The stage is 1920 x 1080 with the ground at y = 1000. The Grinch's hill takes up the left
 * (x < 520), so structures go between x = 700 and 1880, and below y = 200 to stay clear of
 * the HUD.
 *
 * Snowball types in `ammo` that the player hasn't unlocked yet become normal snowballs.
 */
(function (G) {
  "use strict";

  const GY = G.GROUND_Y;
  const create = G.Objects.create;

  // ---------------------------------------------------------------- Light strings

  let lightId = 1;
  const BULBS = ["#ff4b5c", "#ffd23f", "#4be37a", "#5fd0ff", "#ff7ad9", "#ff9f1c"];

  // A string of Christmas lights between two things or fixed points. With a thing at one
  // or both ends it is also a rope that holds them together. Worth 100 points; a snowball
  // through it snaps it and tangles the decorations around it.
  class LightString {
    constructor(o) {
      this.id = lightId++;
      this.a = o.a || null; // Thing or null
      this.b = o.b || null;
      this.pa = o.pa || null; // fixed world point when a is null
      this.pb = o.pb || null;
      this.la = o.la || { x: 0, y: 0 }; // anchor in body-local coordinates
      this.lb = o.lb || { x: 0, y: 0 };
      this.len = o.len;
      this.slack = o.slack == null ? 0 : o.slack;
      this.alive = true;
      this.points = o.points == null ? 100 : o.points;
      this.tangle = !!o.tangle; // made by a tangle: no points, no hit test
      this.rope = null;
      this.phase = Math.random() * 10;
      this.bulbs = BULBS;
      this.bonus = !!o.bonus;
    }

    endA() {
      if (this.a) return this.a.body.toWorld(this.la.x, this.la.y);
      return this.pa;
    }

    endB() {
      if (this.b) return this.b.body.toWorld(this.lb.x, this.lb.y);
      return this.pb;
    }

    // Points along the drooping wire, for drawing and hit tests.
    path(n = 10) {
      const A = this.endA();
      const B = this.endB();
      const d = Math.hypot(B.x - A.x, B.y - A.y);
      const len = this.rope ? this.rope.len : this.len || d;
      const sag = Math.max(6, (len + this.slack - d) * 0.55) + 4;
      const out = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t + Math.sin(Math.PI * t) * Math.min(sag, 90) });
      }
      return out;
    }
  }
  G.LightString = LightString;

  // ---------------------------------------------------------------- Builder

  class LevelBuilder {
    constructor() {
      this.things = [];
      this.statics = []; // { kind: "ledge" | "ramp" | "pole", verts or rect, style }
      this.lights = [];
    }

    // Adds a catalog object with its bottom at (x, y). Returns the Thing.
    add(key, x, y = GY, opts = {}) {
      const t = create(key, x, y, opts);
      this.things.push(t);
      return t;
    }

    // Top edge of a thing (it must still be unrotated).
    top(t) {
      return t.body.y + t.body.top;
    }

    // Stacks catalog objects upwards from y. Returns the top y.
    stack(x, y, keys, opts = {}) {
      let top = y;
      for (const key of keys) {
        const t = this.add(key, x, top, opts);
        top = this.top(t);
      }
      return top;
    }

    // Like stack, but returns the things (bottom first).
    pile(x, y, keys) {
      const out = [];
      let top = y;
      for (const key of keys) {
        const t = this.add(key, x, top);
        out.push(t);
        top = this.top(t);
      }
      return out;
    }

    // A horizontal board from x1 to x2 resting at y. Returns its top y.
    plank(x1, x2, y, thick = 16, mat = "plank") {
      const t = this.add(mat, (x1 + x2) / 2, y, { w: x2 - x1, h: thick });
      return this.top(t);
    }

    // An upright post. Returns its top y.
    post(x, y, h, w = 18, mat = "plank") {
      return this.top(this.add(mat, x, y, { w, h }));
    }

    // Two posts with a board across them. Returns the board's top y.
    shelf(cx, y, width, h, opts = {}) {
      const mat = opts.mat || "plank";
      const pw = opts.postW || 18;
      const inset = opts.inset == null ? 6 : opts.inset;
      const top = this.post(cx - width / 2 + pw / 2 + inset, y, h, pw, mat);
      this.post(cx + width / 2 - pw / 2 - inset, y, h, pw, mat);
      return this.plank(cx - width / 2, cx + width / 2, top, opts.thick || 16, opts.beam || mat);
    }

    // Candy cane pillars with a candy beam on top. Returns the beam's top y.
    candyShelf(cx, y, width, tall = false) {
      const key = tall ? "candyCaneTall" : "candyCane";
      const a = this.add(key, cx - width / 2 + 12, y);
      this.add(key, cx + width / 2 - 12, y);
      return this.plank(cx - width / 2, cx + width / 2, this.top(a), 14, "candyBeam");
    }

    // A fixed platform whose top edge is at y.
    ledge(x, y, w, h = 34, style = "stone") {
      this.statics.push({ kind: "ledge", x, y, w, h, style });
      return y;
    }

    // A fixed platform standing on the ground on a pillar.
    pillarLedge(x, y, w, style = "stone") {
      this.statics.push({ kind: "pillar", x: x + w / 2 - 22, y: y + 30, w: 44, h: GY - y - 30, style });
      return this.ledge(x, y, w, 34, style);
    }

    // A fixed slope from (x1, y1) to (x2, y2), filled down to the ground.
    ramp(x1, y1, x2, y2, style = "snow") {
      const bottom = Math.max(y1, y2) + 30;
      this.statics.push({ kind: "ramp", verts: [[x1, y1], [x2, y2], [x2, bottom], [x1, bottom]], style });
    }

    // Lights between two things (or fixed points). `slack` lets them droop.
    string(a, b, opts = {}) {
      const L = new LightString({
        a: a && a.body ? a : null,
        b: b && b.body ? b : null,
        pa: a && a.body ? null : a,
        pb: b && b.body ? null : b,
        la: opts.la || (a && a.body ? { x: 0, y: a.body.top + 3 } : null),
        lb: opts.lb || (b && b.body ? { x: 0, y: b.body.top + 3 } : null),
        slack: opts.slack == null ? 20 : opts.slack,
      });
      const A = L.endA();
      const B = L.endB();
      L.len = Math.hypot(B.x - A.x, B.y - A.y) + L.slack;
      this.lights.push(L);
      return L;
    }

    // Hangs a catalog object from a fixed point on a light string of length len.
    hang(px, py, key, len, opts = {}) {
      const probe = create(key, 0, 0, opts);
      const half = -probe.body.top;
      const t = this.add(key, px, 0, { ...opts, y: py + len + half });
      const L = new LightString({ a: null, pa: { x: px, y: py }, b: t, lb: { x: 0, y: -half + 2 }, slack: 0 });
      L.len = len - 2;
      L.hanging = true;
      this.lights.push(L);
      return t;
    }

    // A striped pole that lights hang from. It's scenery: snowballs fly past it.
    pole(x, topY, style = "pole") {
      this.statics.push({ kind: "pole", x, y: topY, w: 20, h: GY - topY, style });
      return { x, y: topY + 6 };
    }

    // A fixed bar between two poles; returns nothing, used only for hanging.
    wire(x1, x2, y) {
      this.statics.push({ kind: "wire", x1, x2, y });
    }
  }

  // ---------------------------------------------------------------- Levels

  const L = [];

  // 1
  L.push({
    name: "The Christmas Tree",
    tip: "Drag back from anywhere and let go to fling a snowball. Knock that tree down!",
    sky: "day",
    ammo: ["normal", "normal", "normal", "normal"],
    build(b) {
      b.add("tree", 1360);
      b.stack(1180, GY, ["presentL", "presentS"]);
      b.stack(1540, GY, ["presentM", "ornamentL"]);
      b.add("ornamentS", 1240);
      b.stack(1690, GY, ["presentS", "star"]);
      b.add("presentS", 1460);
    },
  });

  // 2
  L.push({
    name: "Present Tower",
    tip: "Hit a tower low and the whole thing comes crashing down.",
    sky: "day",
    ammo: ["normal", "normal", "mega", "normal"],
    build(b) {
      b.stack(1040, GY, ["presentL", "presentM", "presentM", "presentS", "presentS"]);
      b.stack(1330, GY, ["presentHuge", "presentL", "presentM", "presentM", "presentS", "presentS", "ornamentS"]);
      b.stack(1620, GY, ["presentL", "presentL", "presentM", "presentS", "star"]);
      b.add("presentS", 1180);
      b.add("presentS", 1480);
      b.add("presentM", 1770);
    },
  });

  // 3
  L.push({
    name: "Candy Cane Chaos",
    tip: "Bouncy snowballs ricochet around. Try bouncing one off the ground!",
    sky: "dusk",
    ammo: ["normal", "bouncy", "normal", "bouncy", "normal"],
    build(b) {
      let y = b.candyShelf(1040, GY, 200);
      b.add("wreath", 1040, y);
      y = b.candyShelf(1040, y, 170);
      b.add("stocking", 1036, y);
      b.add("ornamentS", 1040);
      b.add("candyCane", 900);
      b.add("candyCane", 1180);

      let y2 = b.candyShelf(1470, GY, 260, true);
      b.add("ornamentL", 1430, y2);
      b.add("presentS", 1510, y2);
      y2 = b.candyShelf(1470, y2, 220);
      b.add("wreath", 1425, y2);
      b.add("star", 1520, y2);
      b.add("ornamentL", 1470);
      b.add("candyCane", 1700);
      b.add("candyCane", 1740);
      b.add("stocking", 1800);
    },
  });

  // 4
  L.push({
    name: "Snowman Attack",
    tip: "Snowmen fall like dominoes. Knock one into the next for a chain reaction!",
    sky: "day",
    ammo: ["normal", "normal", "mega", "bouncy", "normal"],
    build(b) {
      b.ledge(1240, 860, 260, 34, "snow");
      b.statics.push({ kind: "pillar", x: 1340, y: 894, w: 60, h: GY - 894, style: "snow" });
      b.ledge(1560, 740, 320, 34, "snow");
      b.statics.push({ kind: "pillar", x: 1690, y: 774, w: 60, h: GY - 774, style: "snow" });
      for (let i = 0; i < 5; i++) b.add("snowmanS", 820 + i * 62);
      b.add("snowmanG", 1150);
      for (const x of [1280, 1350, 1420]) b.add("snowmanS", x, 860);
      b.add("snowmanG", 1640, 740);
      b.add("snowmanS", 1760, 740);
      b.add("snowmanS", 1830, 740);
      b.add("presentM", 1560);
      b.add("presentS", 1630);
    },
  });

  // 5
  L.push({
    name: "Ornament Overload",
    tip: "Glass ornaments shatter at the slightest bump. Smash them all!",
    sky: "night",
    ammo: ["normal", "bouncy", "normal", "mega", "normal"],
    build(b) {
      let y = b.shelf(1060, GY, 240, 110);
      b.add("ornamentS", 1010, y);
      b.add("ornamentL", 1060, y);
      b.add("ornamentS", 1110, y);
      for (const x of [995, 1060, 1125]) b.add("ornamentL", x);
      y = b.shelf(1060, y, 200, 90);
      b.add("ornamentS", 1000, y);
      b.add("presentGold", 1060, y);
      b.add("ornamentS", 1120, y);

      let y2 = b.shelf(1500, GY, 300, 120);
      b.add("ornamentS", 1428, y2);
      b.add("ornamentL", 1474, y2);
      b.add("ornamentL", 1527, y2);
      b.add("ornamentS", 1572, y2);
      for (let i = 0; i < 4; i++) b.add("ornamentS", 1410 + i * 60);
      y2 = b.shelf(1500, y2, 240, 100);
      b.add("ornamentS", 1405, y2);
      b.add("ornamentL", 1500, y2);
      b.add("ornamentS", 1595, y2);
      y2 = b.shelf(1500, y2, 160, 80);
      b.add("ornamentGiant", 1500, y2);
      b.add("ornamentL", 1780);
      b.add("ornamentS", 1840);
    },
  });

  // 6
  L.push({
    name: "The Gingerbread Village",
    tip: "Giant gingerbread men crumble into pieces. Explosive snowballs blast everything nearby!",
    sky: "dusk",
    ammo: ["normal", "explosive", "normal", "mega", "normal"],
    build(b) {
      b.add("gingerHouse", 900);
      b.add("gumdrop", 1000);
      b.add("gumdrop", 800);
      b.pillarLedge(1180, 850, 240, "stone");
      b.add("gingerHouse", 1300, 850);
      b.add("gumdrop", 1210, 850);
      b.add("gumdrop", 1390, 850);
      b.add("gingerMan", 1120);
      for (let i = 0; i < 3; i++) b.add("candyCane", 1430 + i * 32);
      b.add("gingerMan", 1570);
      b.add("gingerHouse", 1710);
      b.stack(1840, GY, ["presentM", "presentS"]);
    },
  });

  // 7
  L.push({
    name: "Christmas Light Nightmare",
    tip: "Snowballs snap light strings and tangle everything up. Split snowballs: tap mid-flight!",
    sky: "night",
    ammo: ["normal", "split", "normal", "normal", "bouncy"],
    build(b) {
      b.pole(980, 340);
      b.pole(1820, 340);
      b.wire(980, 1820, 346);
      const hangs = [
        [1080, 220, "ornamentL"],
        [1180, 300, "presentS"],
        [1290, 170, "ornamentL"],
        [1400, 260, "star"],
        [1510, 190, "presentS"],
        [1620, 290, "ornamentL"],
        [1720, 210, "ornamentS"],
      ];
      for (const [x, len, key] of hangs) b.hang(x, 346, key, len);
      // Two towers joined by light strings, with an ornament strung between them.
      const left = b.pile(1150, GY, ["presentL", "presentM", "presentS"]);
      const right = b.pile(1650, GY, ["presentL", "presentM", "presentS"]);
      const mid = b.add("ornamentL", 1400);
      b.string(left[2], right[2], { slack: 90 });
      b.string(left[1], mid, { slack: 30, lb: { x: 0, y: -20 } });
      b.string(mid, right[1], { slack: 30, la: { x: 0, y: -20 } });
      b.add("presentM", 1290);
      b.add("presentM", 1510);
    },
  });

  // 8
  L.push({
    name: "The Giant Present",
    tip: "Explosive presents go BOOM when hit. Find the one hiding in the pile!",
    sky: "day",
    ammo: ["mega", "normal", "explosive", "normal", "mega"],
    build(b) {
      for (const x of [1200, 1322, 1444, 1566]) b.add("presentHuge", x);
      const y1 = GY - 100;
      b.add("presentHuge", 1261, y1);
      b.pile(1383, y1, ["presentBoom", "presentM"]);
      b.add("presentHuge", 1505, y1);
      const y2 = y1 - 100;
      b.add("presentL", 1261, y2);
      b.add("presentL", 1505, y2);
      b.stack(1383, y1 - 98, ["presentL", "presentGold"]);
      b.stack(1000, GY, ["presentL", "presentM"]);
      b.stack(1760, GY, ["presentL", "presentL", "presentS"]);
    },
  });

  // 9
  L.push({
    name: "Bells and Whistles",
    tip: "Bells are heavy. Hit the golden bell to make everything nearby jump!",
    sky: "dusk",
    ammo: ["normal", "mega", "normal", "split", "explosive"],
    build(b) {
      let y = b.shelf(1000, GY, 160, 140);
      b.add("bell", 1000, y);
      y = b.shelf(1000, y, 150, 70);
      b.add("bell", 1000, y);
      // Centre: the golden bell on a ledge, with light things around it.
      b.pillarLedge(1260, 820, 300, "stone");
      b.add("goldenBell", 1410, 820);
      for (const x of [1280, 1310, 1510, 1540]) b.add("candyCane", x, 820);
      b.add("ornamentS", 1345, 820);
      b.add("ornamentS", 1475, 820);
      b.add("ornamentL", 1295, 820 - 84);
      b.add("ornamentL", 1525, 820 - 84);
      let y3 = b.shelf(1720, GY, 200, 160);
      b.add("bell", 1690, y3);
      b.add("bell", 1750, y3);
      y3 = b.shelf(1720, y3, 200, 70);
      b.add("star", 1720, y3);
      b.add("bell", 1720);
      b.add("presentS", 1150);
      b.add("presentS", 1590);
    },
  });

  // 10
  L.push({
    name: "The Mega Christmas Tree",
    tip: "The Mega Tree is heavy. Use mega and explosive snowballs to bring it down for a huge bonus!",
    sky: "night",
    ammo: ["mega", "normal", "explosive", "rainbow", "normal", "mega"],
    build(b) {
      b.add("treeMega", 1420);
      // Scaffolding on the left.
      let y = b.shelf(1080, GY, 200, 150);
      b.add("presentM", 1050, y);
      b.add("ornamentS", 1110, y);
      y = b.shelf(1080, y, 170, 130);
      b.add("star", 1080, y);
      y = b.shelf(1080, y, 140, 110);
      b.add("presentS", 1080, y);
      b.add("presentS", 1040);
      b.add("presentS", 1120);
      // Scaffolding on the right.
      let y2 = b.shelf(1760, GY, 200, 170);
      b.add("presentM", 1720, y2);
      b.add("ornamentL", 1800, y2);
      y2 = b.shelf(1760, y2, 200, 140);
      b.add("wreath", 1760, y2);
      b.add("stocking", 1712);
      b.add("presentS", 1800);
      b.add("presentGold", 1610);
    },
  });

  // 11
  L.push({
    name: "The Ice Palace",
    tip: "Ice is slippery! Knock the blocks and watch everything slide.",
    sky: "aurora",
    ammo: ["normal", "mega", "bouncy", "normal", "explosive"],
    build(b) {
      b.ledge(1060, 900, 760, 30, "ice");
      b.statics.push({ kind: "pillar", x: 1100, y: 930, w: 50, h: 70, style: "ice" });
      b.statics.push({ kind: "pillar", x: 1720, y: 930, w: 50, h: 70, style: "ice" });
      const fy = 900;
      // Left keep.
      let y = b.post(1110, fy, 130, 40, "ice");
      b.post(1250, fy, 130, 40, "ice");
      y = b.plank(1080, 1280, y, 30, "ice");
      b.add("presentM", 1180, fy);
      b.add("snowmanS", 1180, y);
      b.add("ornamentS", 1110, y);
      b.add("ornamentS", 1250, y);
      // Middle bridge.
      let ym = b.post(1330, fy, 200, 36, "ice");
      b.post(1500, fy, 200, 36, "ice");
      ym = b.plank(1300, 1530, ym, 26, "ice");
      b.add("snowmanG", 1415, ym);
      b.stack(1415, fy, ["presentL", "presentM"]);
      // Right keep.
      let y2 = b.post(1590, fy, 150, 40, "ice");
      b.post(1760, fy, 150, 40, "ice");
      y2 = b.plank(1560, 1790, y2, 30, "ice");
      const block = b.add("ice", 1675, y2, { w: 80, h: 40 });
      b.add("presentGold", 1675, b.top(block));
      b.add("wreath", 1675, fy);
      b.add("candyCane", 860);
      b.add("presentS", 930);
    },
  });

  // 12
  L.push({
    name: "The Floating Workshop",
    tip: "Islands float at all heights. Aim high, aim low, and try a rainbow snowball!",
    sky: "aurora",
    ammo: ["normal", "bouncy", "split", "rainbow", "normal", "normal"],
    build(b) {
      b.ledge(820, 560, 200, 40, "cloud");
      b.stack(880, 560, ["presentM", "ornamentS"]);
      b.add("star", 960, 560);
      b.ledge(1110, 780, 240, 40, "cloud");
      b.add("snowmanS", 1150, 780);
      b.stack(1260, 780, ["presentL", "presentS"]);
      b.ledge(1390, 420, 220, 40, "cloud");
      b.add("tree", 1510, 420);
      b.add("ornamentL", 1420, 420);
      b.ledge(1620, 640, 260, 40, "cloud");
      const y = b.shelf(1750, 640, 180, 90);
      b.add("bell", 1750, y);
      b.add("presentS", 1645, 640);
      b.stack(1500, GY, ["presentL", "presentM", "presentS"]);
      b.add("gingerHouse", 1780);
      b.add("presentGold", 1150);
    },
  });

  // 13
  L.push({
    name: "Domino Derby",
    tip: "Topple the first domino and watch the chain reaction roll all the way down!",
    sky: "day",
    ammo: ["normal", "normal", "rainbow", "mega"],
    build(b) {
      for (let i = 0; i < 11; i++) {
        const x = 800 + i * 74;
        const h = 120 + i * 8;
        const top = b.post(x, GY, h, 18, i % 3 === 2 ? "candyBeam" : "plank");
        if (i % 2 === 0) b.add("ornamentS", x, top);
      }
      b.add("treeGiant", 1750);
      const gift = b.add("presentM", 1615);
      b.add("snowmanS", 1615, b.top(gift));
      b.add("presentS", 1890);
    },
  });

  // 14
  L.push({
    name: "Stocking Stuffers' Mantel",
    tip: "The mantel is packed. Sweep it clean!",
    sky: "night",
    ammo: ["normal", "split", "normal", "bouncy", "explosive"],
    build(b) {
      // Fireplace: two brick sides and a mantel shelf.
      b.statics.push({ kind: "pillar", x: 1100, y: 746, w: 70, h: GY - 746, style: "brick" });
      b.statics.push({ kind: "pillar", x: 1650, y: 746, w: 70, h: GY - 746, style: "brick" });
      b.ledge(1060, 720, 700, 26, "mantel");
      const socks = [];
      for (let i = 0; i < 7; i++) socks.push(b.add("stocking", 1110 + i * 85, 720));
      b.add("star", socks[2].x, b.top(socks[2]));
      b.add("wreath", socks[4].x, b.top(socks[4]));
      b.add("ornamentL", socks[6].x, b.top(socks[6]));
      // Presents piled by the hearth.
      b.stack(1260, GY, ["presentL", "presentM", "presentS"]);
      b.stack(1400, GY, ["presentM", "presentS"]);
      b.stack(1530, GY, ["presentL", "presentS"]);
      b.add("candyCane", 1770);
      b.add("candyCane", 1800);
      b.add("presentGold", 1860);
      b.add("presentS", 960);
    },
  });

  // 15
  L.push({
    name: "Giant Ornament Alley",
    tip: "Knock the giant ornaments off the hilltop and let them roll down into everything!",
    sky: "dusk",
    ammo: ["normal", "normal", "split", "mega"],
    build(b) {
      b.ramp(1300, GY, 1700, 660, "snow");
      b.statics.push({ kind: "ledge", x: 1700, y: 660, w: 240, h: GY - 660, style: "snowhill" });
      b.add("ornamentGiant", 1760, 660);
      b.add("ornamentGiant", 1872, 660);
      // Targets in the valley.
      b.stack(1180, GY, ["presentL", "presentM", "presentS"]);
      const y = b.shelf(980, GY, 200, 140);
      b.add("ornamentL", 940, y);
      b.add("ornamentL", 1020, y);
      b.add("snowmanS", 980);
      b.add("tree", 800);
      b.add("presentS", 1250);
    },
  });

  // 16
  L.push({
    name: "The Explosive Workshop",
    tip: "Explosive presents set each other off. One good hit could blow up the lot!",
    sky: "night",
    ammo: ["normal", "normal", "normal", "split"],
    build(b) {
      let y = b.shelf(980, GY, 220, 120);
      b.add("presentBoom", 980, y);
      b.add("presentS", 920);
      b.add("presentBoom", 1035);
      y = b.shelf(980, y, 160, 80);
      b.add("ornamentL", 980, y);
      b.stack(1240, GY, ["presentL", "presentBoom", "presentM", "presentS"]);
      b.stack(1420, GY, ["presentHuge", "presentL", "presentBoom", "presentS"]);
      let y2 = b.shelf(1680, GY, 260, 160);
      b.add("presentBoom", 1620, y2);
      b.add("presentM", 1740, y2);
      b.add("gingerHouse", 1680);
      y2 = b.shelf(1680, y2, 260, 90);
      b.add("star", 1680, y2);
      b.add("presentS", 1860);
    },
  });

  // 17
  L.push({
    name: "Gingerbread Castle",
    tip: "Bring down the castle walls and the gingerbread guards!",
    sky: "dusk",
    ammo: ["mega", "normal", "explosive", "normal", "rainbow"],
    build(b) {
      // Left tower.
      let y = b.post(940, GY, 220, 34, "candyBeam");
      b.post(1060, GY, 220, 34, "candyBeam");
      y = b.plank(910, 1090, y, 24);
      b.add("gingerMan", 1000, y);
      b.add("gumdrop", 1000);
      // Wall.
      let w = b.post(1140, GY, 140, 30);
      b.post(1340, GY, 140, 30);
      w = b.plank(1120, 1360, w, 20);
      b.add("gingerMan", 1240);
      b.add("presentS", 1175, w);
      b.add("star", 1240, w);
      b.add("presentS", 1305, w);
      // Keep.
      let k = b.post(1420, GY, 260, 34, "candyBeam");
      b.post(1640, GY, 260, 34, "candyBeam");
      k = b.plank(1390, 1670, k, 24);
      b.add("gingerHouse", 1530, k);
      b.add("gingerMan", 1480);
      b.add("presentGold", 1580);
      // Right tower.
      let r = b.post(1720, GY, 180, 30);
      b.post(1840, GY, 180, 30);
      r = b.plank(1700, 1860, r, 20);
      b.add("gingerMan", 1780, r);
      b.add("gumdrop", 1780);
    },
  });

  // 18
  L.push({
    name: "Snowman Army on Ice",
    goal: 0.5,
    tip: "A whole snowman army on slippery ice. Ring the golden bell to rattle the ranks!",
    sky: "aurora",
    ammo: ["normal", "mega", "normal", "bouncy", "explosive"],
    build(b) {
      b.ledge(820, 930, 1060, 24, "ice");
      for (let i = 0; i < 6; i++) b.add("snowmanS", 860 + i * 58, 930);
      b.pillarLedge(1220, 760, 260, "ice");
      b.add("goldenBell", 1350, 760);
      b.add("snowmanS", 1260, 760);
      b.add("snowmanS", 1440, 760);
      b.add("snowmanG", 1600, 930);
      for (let i = 0; i < 4; i++) b.add("snowmanS", 1690 + i * 54, 930);
      b.ledge(1640, 600, 220, 30, "ice");
      b.add("snowmanS", 1690, 600);
      b.add("snowmanS", 1760, 600);
      b.add("ornamentL", 1824, 600);
    },
  });

  // 19
  L.push({
    name: "The North Pole Express",
    goal: 0.4,
    tip: "A present train on a high bridge, and a giant ornament dangling over it. Snap its string!",
    sky: "night",
    ammo: ["normal", "split", "normal", "mega", "rainbow"],
    build(b) {
      for (const x of [900, 1360, 1820]) b.statics.push({ kind: "pillar", x, y: 774, w: 40, h: GY - 774, style: "wood" });
      b.ledge(860, 750, 1020, 24, "track");
      const cars = ["presentL", "presentM", "presentM", "presentL", "presentM", "presentS", "presentM", "presentL"];
      let x = 930;
      for (const key of cars) {
        const t = b.add(key, x, 750);
        if (key === "presentL") b.add("presentS", x, b.top(t));
        x += key === "presentL" ? 108 : key === "presentM" ? 86 : 70;
      }
      b.pole(1880, 230);
      b.wire(1520, 1880, 236);
      b.hang(1700, 236, "ornamentGiant", 240);
      b.hang(1560, 236, "ornamentL", 180);
      b.add("tree", 1100);
      b.add("snowmanG", 1600);
      b.stack(1240, GY, ["presentM", "presentS"]);
    },
  });

  // 20
  L.push({
    name: "Total Christmas Meltdown",
    tip: "Everything Christmas, all at once. Show them who stole the holiday spirit!",
    sky: "aurora",
    ammo: ["mega", "explosive", "split", "rainbow", "bouncy", "normal", "mega"],
    build(b) {
      b.add("treeMega", 1560);
      b.add("gingerHouse", 860);
      let y = b.shelf(1050, GY, 200, 160);
      b.add("presentBoom", 1015, y);
      b.add("ornamentL", 1085, y);
      y = b.shelf(1050, y, 190, 100);
      b.add("goldenBell", 1050, y);
      b.add("gingerMan", 1050);
      b.pillarLedge(1260, 700, 160, "ice");
      b.add("snowmanS", 1300, 700);
      b.add("presentGold", 1370, 700);
      b.stack(1230, GY, ["presentL", "presentBoom", "presentM"]);
      b.stack(1800, GY, ["presentHuge", "presentL", "presentM", "snowmanS"]);
      b.pole(1890, 300);
      b.wire(1760, 1890, 306);
      b.hang(1800, 306, "ornamentGiant", 190);
      b.add("candyCane", 1385);
    },
  });

  G.LEVELS = L;
  G.LevelBuilder = LevelBuilder;

  // ---------------------------------------------------------------- Scene

  const { Body } = G.Physics;
  const STATIC_FRICTION = { ice: 0.05, track: 0.5, mantel: 0.6, cloud: 0.7 };

  // The Grinch's snowy hill on the left. Its flat top is at HILL_Y.
  G.HILL_Y = 820;
  G.HILL_VERTS = [
    [-200, G.HILL_Y],
    [360, G.HILL_Y],
    [430, G.HILL_Y + 30],
    [560, GY + 2],
    [-200, GY + 2],
  ];

  // Builds level `index` (0-based): its things, light strings and the fixed bodies (ground,
  // the Grinch's hill, ledges, ramps, pillars and poles).
  G.buildScene = function buildScene(index) {
    const level = L[index];
    const b = new LevelBuilder();
    level.build(b);
    const fixed = [];
    const ground = new Body({ x: G.WORLD_W / 2, y: GY + 200, verts: G.Shapes.box(G.WORLD_W + 2400, 400), isStatic: true, friction: 0.8 });
    ground.kind = "ground";
    fixed.push(ground);
    const hill = new Body({ x: 0, y: 0, verts: G.HILL_VERTS, isStatic: true, friction: 0.8 });
    hill.kind = "hill";
    fixed.push(hill);
    for (const s of b.statics) {
      let body = null;
      const friction = STATIC_FRICTION[s.style] == null ? 0.85 : STATIC_FRICTION[s.style];
      if (s.kind === "ledge" || s.kind === "pillar") {
        body = new Body({ x: s.x + s.w / 2, y: s.y + s.h / 2, verts: G.Shapes.box(s.w, s.h), isStatic: true, friction });
      } else if (s.kind === "ramp") {
        body = new Body({ x: 0, y: 0, verts: s.verts, isStatic: true, friction: 0.9 });
      }
      if (body) {
        body.kind = s.kind;
        fixed.push(body);
      }
    }
    // Rope joints for the light strings that hold something.
    for (const light of b.lights) {
      if (!light.a && !light.b) continue;
      light.rope = new G.Physics.Rope({
        a: light.a ? light.a.body : null,
        b: light.b ? light.b.body : null,
        lax: light.a ? light.la.x : light.pa.x,
        lay: light.a ? light.la.y : light.pa.y,
        lbx: light.b ? light.lb.x : light.pb.x,
        lby: light.b ? light.lb.y : light.pb.y,
        len: light.len,
        breakImpulse: light.hanging && light.b ? Math.max(150, ((light.b.body.mass * G.GRAVITY) / 120) * 7) : 120,
        owner: light,
      });
    }
    return { level, things: b.things, lights: b.lights, statics: b.statics, fixed };
  };

  // When each snowball type becomes available (completing this level unlocks it).
  G.UNLOCKS = { mega: 1, bouncy: 2, explosive: 4, split: 6, rainbow: 9 };
})(window.GS);
