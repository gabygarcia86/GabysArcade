/*
 * Main menu easter eggs: click or tap any X-Man in the lineup and they do something
 * silly. Each hero has 10 antics, played in a shuffled order so every one gets seen.
 * Some antics prank a teammate, who reacts (zapped, frozen, flipped upside down...).
 *
 * An antic is { dur, run(a) }. run() is called every frame with a helper object `a`:
 *   a.t            seconds since the antic started
 *   a.pose(fn)     adjust the hero's skeleton pose: fn(p) changes p.armF, p.legB, p.lean...
 *   a.body         whole-body transform: dx, dy, rot, pivot, sx, sy, alpha
 *   a.state/kind   base animation ("idle", "run", "attack"...), a.power, a.speed for glow/cloth
 *   a.back(fn) / a.front(fn)   draw props behind or in front of the hero
 *   a.once(t, fn) / a.every(period, from, to, fn) / a.sfx(t, name)
 *   a.say(text, from, to, slot?) / a.think(...)   comic speech and thought bubbles
 *   a.near(...preferIds) / a.react(slot, kind, at, dur, text)   prank a teammate
 */
(function (XM) {
  "use strict";
  const A = XM.Art;
  const U = XM.U;
  const { sin, cos, abs, PI, min, max } = Math;
  const IDS = ["professorx", "storm", "cyclops", "wolverine", "jean", "gambit"];
  const SCALE = 1.7;
  const GAS = "#8fd14f";

  const clamp = U.clamp;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const smooth = (x) => x * x * (3 - 2 * x);
  const bell = (t, a, b) => (t < a || t > b ? 0 : sin(seg(t, a, b) * PI));
  // Rises over a..b, holds, falls over c..d.
  const hold = (t, a, b, c, d) => smooth(seg(t, a, b)) * (1 - smooth(seg(t, c, d)));
  const wob = (t, a, len = 0.6, f = 30) => (t < a || t > a + len ? 0 : sin((t - a) * f) * (1 - (t - a) / len));
  const within = (t, a, b) => t >= a && t <= b;

  // ---------- Pose helpers (angles: 0 = down, PI/2 = forward, PI = up) ----------
  const P = {
    dance(p, t, speed = 8) {
      const s = sin(t * speed);
      p.armF = [2.5 + 0.5 * s, 0.4];
      p.armB = [2.5 - 0.5 * s, 0.4];
      p.legF = [0.25 + 0.25 * s, 0.4 + 0.3 * max(0, s)];
      p.legB = [-0.25 + 0.25 * s, 0.4 + 0.3 * max(0, -s)];
      p.bob = -abs(s) * 4;
      p.lean = 0.12 * s;
    },
    armsUp(p) {
      p.armF = [2.95, 0.15];
      p.armB = [2.75, 0.2];
    },
    noseHold(p) {
      p.armF = [1.95, 2.55];
      p.lean = -0.15;
      p.headTilt = -0.15;
    },
    shield(p) {
      p.armF = [2.3, 1.95];
      p.armB = [1.2, 0.4];
      p.lean = -0.2;
    },
    ears(p) {
      p.armF = [2.2, 2.3];
      p.armB = [2.1, 2.4];
      p.lean = -0.05;
    },
    hips(p) {
      p.armF = [0.55, -1.6];
      p.armB = [-0.55, 1.6];
    },
    crossed(p) {
      p.armF = [1.0, 1.9];
      p.armB = [1.15, 1.8];
    },
    point(p) {
      p.armF = [1.6, 0.05];
    },
    sleep(p, t) {
      p.headTilt = 0.55;
      p.lean = 0.06;
      p.armF = [0.05, 0.1];
      p.armB = [-0.05, 0.1];
      p.bob = sin(t * 1.6) * 1.5;
    },
    mouth(p) {
      p.armF = [2.05, 2.55];
    },
    temple(p) {
      p.armF = [2.0, 2.6];
      p.armB = [1.3, 0.2];
    },
    flail(p, t) {
      p.armF = [2.4 + sin(t * 30) * 0.8, 0.4];
      p.armB = [2.2 + cos(t * 27) * 0.8, 0.4];
      p.legF = [0.4 + sin(t * 25) * 0.4, 0.6];
      p.legB = [-0.3 + cos(t * 22) * 0.4, 0.6];
    },
    guitar(p, t) {
      p.armF = [1.0, 1.55 + 0.45 * sin(t * 22)];
      p.armB = [1.65, 0.25];
      p.legF = [0.5, 0.35];
      p.legB = [-0.5, 0.25];
      p.lean = -0.08;
    },
  };

  // ---------- Prop helpers (screen coordinates) ----------
  function cloud(ctx, x, y, s, col = "#d8dde8") {
    ctx.fillStyle = col;
    ctx.strokeStyle = A.OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - 18 * s, y, 14 * s, 0, PI * 2);
    ctx.arc(x, y - 8 * s, 18 * s, 0, PI * 2);
    ctx.arc(x + 18 * s, y, 14 * s, 0, PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.fillRect(x - 18 * s, y - 2 * s, 36 * s, 14 * s);
  }
  function bolt(ctx, x0, y0, x1, y1, col = "#e6f6ff", width = 4) {
    const pts = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push(U.lerp(x0, x1, k) + (i && i < n ? U.rand(-16, 16) : 0), U.lerp(y0, y1, k));
    }
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#7fbfff";
    ctx.lineWidth = width * 2.4;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = width;
    ctx.stroke();
    A.glow(ctx, x1, y1, 50, "#bfe6ff", 0.8);
  }
  function card(ctx, x, y, rot, glow = true, s = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    if (glow) A.glow(ctx, 0, 0, 14, "#ff4fb3", 0.8);
    A.box(ctx, -5, -7, 10, 14, "#fff5fb", true, 1.5, 1.2);
    ctx.fillStyle = "#c4161c";
    ctx.fillRect(-1.5, -2.5, 3, 5);
    ctx.restore();
  }
  function beam(ctx, x0, y0, ang, len, w, col = "#ff3030") {
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = col;
    ctx.fillRect(0, -w, len, w * 2);
    ctx.globalAlpha = 1;
    ctx.fillRect(0, -w * 0.5, len, w);
    ctx.fillStyle = "#fff4f0";
    ctx.fillRect(0, -w * 0.18, len, w * 0.36);
    ctx.restore();
    A.glow(ctx, x0, y0, w * 4, col, 0.9);
  }
  function chicken(ctx, x, y, flap) {
    A.ellipse(ctx, x, y, 14, 11, 0, "#fafafa", true, 2);
    A.circle(ctx, x + 11, y - 10, 6, "#fafafa", true, 2);
    A.poly(ctx, [x + 15, y - 11, x + 22, y - 9, x + 15, y - 7], "#f2c230", true, 1);
    A.poly(ctx, [x + 9, y - 16, x + 12, y - 21, x + 14, y - 15], "#e0262c", false);
    ctx.fillStyle = "#111";
    ctx.fillRect(x + 12, y - 12, 2, 2);
    A.poly(ctx, [x - 4, y - 2, x - 18, y - 10 - flap * 10, x - 10, y + 4], "#e8e8e8", true, 1.5);
  }
  function grawlix(ctx, x, y, size = 16) {
    A.burst(ctx, x, y, size * 1.6, 10, "#ffe14a", 0);
    A.text(ctx, "#@%&!", x, y + 1, size * 0.7, "#c4161c", "center", false);
  }
  function zzz(a, x, y, from = 0, to = 99, period = 0.55) {
    a.every(period, from, to, () => XM.FX.text(x + U.rand(-6, 6), y, "Z", "#bfe6ff", 16 + Math.random() * 8, 1.4, -45));
  }
  function notes(a, x, y, from, to, period = 0.3, sound = true) {
    a.every(period, from, to, () => {
      XM.FX.text(x + U.rand(-24, 24), y, U.pick(["♪", "♫", "♬"]), U.pick(["#ffe14a", "#ff7ad9", "#7ae8ff"]), 20, 1.2, -60);
      if (sound) XM.Audio.sfx("note");
    });
  }
  function gas(a, x, y, from, to, period = 0.07) {
    a.every(period, from, to, () => XM.FX.smoke(x, y, 2, GAS));
  }

  // ======================================================================
  // The antics
  // ======================================================================
  const ANTICS = {
    // ===================== PROFESSOR X =====================
    professorx: [
      {
        name: "Chair Donuts",
        dur: 3.6,
        run(a) {
          const t = a.t;
          const k = smooth(seg(t, 0.3, 2.6));
          a.body.rot = k * PI * 4;
          a.body.pivot = 30;
          a.body.dx = sin(t * 3) * 22 * bell(t, 0.3, 2.6);
          a.every(0.1, 0.3, 2.6, () => XM.FX.smoke(a.S.x + a.body.dx, a.S.y - 4, 1, "#b8b0a0"));
          a.sfx(0.3, "scratch");
          a.sfx(1.3, "scratch");
          a.say("Wheeeeee!", 0.5, 2.4);
          a.say("Ahem. Very dignified.", 2.7, 3.6);
        },
      },
      {
        name: "Rocket Chair",
        dur: 3.8,
        run(a) {
          const t = a.t;
          a.body.dx = wob(t, 0, 0.6, 50) * 3;
          a.body.dy = -smooth(seg(t, 0.6, 1.3)) * 700 + smooth(seg(t, 2.3, 2.7)) * 700;
          a.power = within(t, 0.2, 1.3) || within(t, 2.3, 2.7) ? 1 : 0;
          a.back((ctx) => {
            if (!within(t, 0.1, 1.4) && !within(t, 2.3, 2.7)) return;
            const y = a.S.y + a.body.dy;
            A.glow(ctx, a.S.x, y + 6, 34 + sin(t * 60) * 6, "#ff8a3a", 0.95);
            A.glow(ctx, a.S.x, y + 22, 22, "#ffe07a", 0.9);
          });
          a.every(0.04, 0.6, 1.3, () => XM.FX.smoke(a.S.x, a.S.y + a.body.dy + 10, 1, "#9a9090"));
          a.sfx(0.1, "charge");
          a.sfx(0.6, "zip");
          a.sfx(1.9, "slideDown");
          a.once(2.7, () => {
            XM.Audio.sfx("stomp");
            XM.FX.shake(6, 0.3);
            XM.FX.smoke(a.S.x, a.S.y, 10, "#b8b0a0");
          });
          a.say("I can explain.", 2.9, 3.8);
        },
      },
      {
        name: "Mind Reader",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.pose((p) => P.temple(p));
          a.power = bell(t, 0.2, 3.2);
          a.sfx(0.2, "psychic");
          if (!a.mem.thought) a.mem.thought = U.pick(["...is that a cheeseburger?", "I hope nobody heard that.", "Did I leave the oven on?", "Must... not... dance...", "I'm the favorite. Obviously.", "What if cats had powers?"]);
          if (n) {
            a.front((ctx) => {
              if (!within(t, 0.3, 3.2)) return;
              const h1 = a.head(a.S);
              const h2 = a.head(n);
              for (let i = 0; i < 3; i++) {
                const k = (t * 1.5 + i / 3) % 1;
                A.glow(ctx, U.lerp(h1.x, h2.x, k), U.lerp(h1.y, h2.y, k) - sin(k * PI) * 30, 12, "#7fd0ff", 0.8);
              }
            });
            a.think(a.mem.thought, 0.9, 3.2, n);
          }
          a.say("Fascinating.", 3.0, 3.8);
        },
      },
      {
        name: "Chair Trouble",
        dur: 3.6,
        run(a) {
          const t = a.t;
          a.sfx(0.4, "fart", { len: 1.0 });
          gas(a, a.S.x - a.S.facing * 18, a.S.y - 14, 0.4, 1.3);
          a.body.dy = within(t, 0.4, 1.3) ? sin(t * 70) * 2 : 0;
          a.body.flip = within(t, 1.5, 1.9) || within(t, 2.3, 2.6);
          a.pose((p) => {
            p.armF = [0.4, 0.6];
            p.armB = [-0.2, 0.4];
          });
          const n = a.near();
          if (n) a.react(n, "stinky", 1.0, 2.6, "Charles!!");
          a.say("That was the chair.", 2.0, 3.6);
        },
      },
      {
        name: "Telekinetic Puppet",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.pose((p) => {
            p.armF = [1.6 + sin(t * 10) * 0.3, 0.2];
            p.armB = [1.5 - sin(t * 10) * 0.3, 0.2];
          });
          a.power = bell(t, 0.2, 3.4);
          a.sfx(0.3, "psychic");
          if (n) a.react(n, "puppet", 0.4, 3.0);
          notes(a, n ? n.x : a.S.x, (n || a.S).y - 150, 0.7, 3.0, 0.28);
          a.say("Dance, my student. Dance!", 0.6, 2.6);
        },
      },
      {
        name: "Polished Dome",
        dur: 3.4,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.sfx(0.3, "ding");
          a.front((ctx) => {
            const h = a.head(a.S);
            if (within(t, 0.3, 0.9)) A.burst(ctx, h.x - 4, h.y - 12, 14 * bell(t, 0.3, 0.9), 4, "#ffffff", t * 6);
            if (n && within(t, 0.7, 2.4)) {
              const nh = a.head(n);
              ctx.globalAlpha = 0.35 * hold(t, 0.7, 0.9, 2.1, 2.4);
              ctx.fillStyle = "#fffbe0";
              ctx.beginPath();
              ctx.moveTo(h.x, h.y - 10);
              ctx.lineTo(nh.x, nh.y - 40);
              ctx.lineTo(nh.x, nh.y + 30);
              ctx.fill();
              ctx.globalAlpha = 1;
              A.glow(ctx, h.x, h.y - 10, 30, "#ffffff", 0.9);
            }
          });
          if (n) a.react(n, "blinded", 0.75, 1.8, "My eyes!");
          a.say("Freshly polished.", 2.3, 3.4);
        },
      },
      {
        name: "Disco Chair",
        dur: 4.2,
        run(a) {
          const t = a.t;
          a.body.dy = -abs(sin(t * 8)) * 12 * hold(t, 0.2, 0.4, 3.6, 3.9);
          a.body.rot = sin(t * 4) * 0.12 * hold(t, 0.2, 0.4, 3.6, 3.9);
          a.body.pivot = 20;
          a.pose((p) => {
            const s = sin(t * 8);
            p.armF = [2.4 + s * 0.6, 0.3];
            p.armB = [2.4 - s * 0.6, 0.3];
          });
          a.back((ctx) => {
            if (!within(t, 0.2, 3.9)) return;
            const cols = ["#ff4fd8", "#58d6ff", "#ffd45c", "#7dffb2"];
            A.glow(ctx, a.S.x, a.S.y - 6 + a.body.dy, 40, cols[Math.floor(t * 6) % 4], 0.8);
            A.glow(ctx, a.S.x, a.S.y - 50 + a.body.dy, 70, cols[(Math.floor(t * 6) + 2) % 4], 0.3);
          });
          notes(a, a.S.x, a.S.y - 140, 0.3, 3.6, 0.25);
          a.say("Cerebro has a dance mode.", 2.6, 4.2);
        },
      },
      {
        name: "Sick Wheelie",
        dur: 3.4,
        run(a) {
          const t = a.t;
          const tilt = hold(t, 0.2, 0.6, 1.0, 1.2);
          const flip = smooth(seg(t, 1.2, 1.8));
          a.body.pivot = 18;
          a.body.rot = -a.S.facing * (0.5 * tilt + flip * PI * 2);
          a.body.dy = -bell(t, 1.1, 1.9) * 60;
          a.sfx(0.2, "squeak");
          a.sfx(1.2, "zip");
          a.once(1.9, () => {
            XM.Audio.sfx("land");
            XM.FX.smoke(a.S.x, a.S.y, 6, "#b8b0a0");
          });
          a.pose((p) => {
            if (t > 1.9) P.armsUp(p);
          });
          a.say("Still got it.", 2.1, 3.4);
        },
      },
      {
        name: "Meditation Nap",
        dur: 4.4,
        run(a) {
          const t = a.t;
          const sleepy = hold(t, 0.2, 0.8, 3.0, 3.05);
          a.pose((p) => {
            p.lean = -0.5 * sleepy;
            p.armF = [0.2, 0.3];
            p.armB = [-0.1, 0.2];
            p.lift = -6 * sleepy;
          });
          zzz(a, a.S.x - 10, a.S.y - 120, 0.6, 3.0);
          a.sfx(0.7, "snore");
          a.sfx(1.9, "snore");
          a.body.dy = -bell(t, 3.0, 3.3) * 28;
          a.once(3.0, () => XM.FX.text(a.S.x, a.S.y - 140, "!", "#ff5a3a", 30, 0.8));
          a.sfx(3.0, "boing");
          a.say("I was meditating!", 3.2, 4.4);
        },
      },
      {
        name: "Cerebro Update",
        dur: 4.0,
        run(a) {
          const t = a.t;
          a.look = { pal: a.baseLook.pal, flags: Object.assign({}, a.baseLook.flags, { helmet: t > 0.2 && t < 3.6 }) };
          a.body.dx = within(t, 0.6, 2.4) ? U.rand(-2, 2) : 0;
          a.power = within(t, 0.6, 2.4) ? 0.5 + 0.5 * sin(t * 40) : 0;
          a.every(0.1, 0.6, 2.4, () => {
            const h = a.head(a.S);
            XM.FX.burst(h.x, h.y - 10, { count: 3, color: "#7fd0ff", speed: 160, life: 0.25 });
          });
          a.sfx(0.6, "charge");
          a.sfx(1.0, "laser");
          a.say("BANANA.", 1.0, 1.6);
          a.say("...PANCAKES.", 1.7, 2.3);
          a.say("Sorry. Cerebro was updating.", 2.6, 4.0);
        },
      },
    ],

    // ===================== STORM =====================
    storm: [
      {
        name: "Personal Rain Cloud",
        dur: 4.2,
        run(a) {
          const t = a.t;
          const h = a.head(a.S);
          const cy = h.y - 50;
          const up = hold(t, 0.2, 0.6, 2.8, 2.9);
          a.pose((p) => P.crossed(p));
          a.back((ctx) => {
            if (up <= 0) return;
            ctx.globalAlpha = up;
            cloud(ctx, h.x, cy, 1, "#8a90a0");
            ctx.globalAlpha = 1;
          });
          a.every(0.025, 0.6, 2.8, () => XM.FX.spawn(XM.FX.T.SPARK, h.x + U.rand(-30, 30), cy + 12, 0, 420, 0.35, 1.5, "#7ab8ff"));
          a.say("Not again.", 1.0, 2.4);
          a.sfx(2.8, "lightning");
          a.front((ctx) => {
            if (within(t, 2.8, 3.05)) bolt(ctx, h.x + 30, h.y - 10, h.x, cy, "#ffffff", 3);
          });
          a.once(2.8, () => {
            XM.FX.flash("#ffffff", 0.3);
            XM.FX.smoke(h.x, cy, 8, "#6a6e78");
          });
          a.pose((p) => {
            if (within(t, 2.6, 3.1)) p.armF = [2.6, 0.3];
          });
          a.say("Better.", 3.2, 4.2);
        },
      },
      {
        name: "Static Shock",
        dur: 3.6,
        run(a) {
          const t = a.t;
          const n = a.near();
          if (n) a.faceTo(n);
          a.pose((p) => {
            if (t < 1.1) P.armsUp(p);
            else {
              p.armF = [-0.4, 0.3];
              p.armB = [-0.5, 0.3];
            }
          });
          a.power = bell(t, 0.1, 1.0);
          if (n) {
            a.front((ctx) => {
              if (within(t, 0.8, 1.05)) {
                const nh = a.head(n);
                bolt(ctx, nh.x + 10, -20, nh.x, nh.y);
              }
            });
            a.react(n, "zapped", 0.8, 2.4, "...ow.");
          }
          a.sfx(0.8, "lightning");
          a.once(0.8, () => XM.FX.flash("#e6f6ff", 0.35));
          notes(a, a.S.x, a.S.y - 130, 1.3, 3.4, 0.45);
          a.say("Static electricity!", 1.5, 3.0);
        },
      },
      {
        name: "Runway Wind",
        dur: 3.6,
        run(a) {
          const t = a.t;
          a.speed = 500 * hold(t, 0.1, 0.4, 2.8, 3.2);
          a.vy = -400 * hold(t, 0.1, 0.4, 2.8, 3.2);
          a.pose((p) => {
            p.armF = [2.6, 2.3];
            p.armB = [-0.6, 1.8];
            p.lean = -0.1;
            p.legF = [0.3, 0.1];
            p.legB = [-0.1, 0.1];
          });
          a.body.flip = t > 1.6;
          a.back((ctx) => {
            if (!within(t, 0.1, 3.0)) return;
            ctx.strokeStyle = "rgba(235,248,255,0.5)";
            ctx.lineWidth = 2;
            for (let i = 0; i < 6; i++) {
              const y = a.S.y - 20 - i * 18;
              const x = a.S.x + 120 - ((t * 500 + i * 70) % 240);
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x - 40, y);
              ctx.stroke();
            }
          });
          a.sfx(0.2, "wind");
          a.sfx(1.4, "wind");
          a.say("Fierce.", 1.8, 3.2);
        },
      },
      {
        name: "Mini Tornado",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const spin = within(t, 0.3, 2.2);
          a.body.sx = spin ? cos(t * 26) : 1;
          a.body.dy = -bell(t, 0.3, 2.3) * 36;
          a.speed = spin ? 400 : 0;
          a.back((ctx) => {
            if (!spin) return;
            ctx.strokeStyle = "rgba(220,230,245,0.55)";
            ctx.lineWidth = 3;
            for (let i = 0; i < 5; i++) {
              const r = 18 + i * 9;
              ctx.beginPath();
              ctx.ellipse(a.S.x, a.S.y - 10 - i * 26 + a.body.dy, r, 6, 0, t * 12 + i, t * 12 + i + 4);
              ctx.stroke();
            }
          });
          a.every(0.35, 0.3, 2.2, () => XM.Audio.sfx("wind"));
          if (t > 2.3) {
            a.body.rot = sin(t * 6) * 0.15;
            a.stars(a.S);
          }
          a.say("Whoa... the room is spinning.", 2.4, 3.8);
        },
      },
      {
        name: "Breaking Wind",
        dur: 3.8,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            p.armF = [1.6, 0.1];
            p.armB = [1.3, 0.3];
            p.lean = 0.1;
          });
          a.power = bell(t, 0.2, 0.9);
          a.sfx(0.8, "fart", { len: 1.2 });
          a.sfx(0.9, "wind");
          a.back((ctx) => {
            if (!within(t, 0.8, 2.0)) return;
            ctx.strokeStyle = A.rgba(GAS, 0.6);
            ctx.lineWidth = 3;
            for (let i = 0; i < 8; i++) {
              const y = a.S.y - 10 - i * 14;
              const x = a.S.x + a.S.facing * ((t - 0.8) * 600 - i * 30);
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x - a.S.facing * 50, y + sin(t * 10 + i) * 4);
              ctx.stroke();
            }
          });
          gas(a, a.S.x + a.S.facing * 30, a.S.y - 60, 0.8, 1.8, 0.1);
          for (const o of a.others()) a.react(o, "blown", 0.9, 1.4);
          const n = a.near();
          if (n) a.react(n, "stinky", 2.3, 1.5, "Was that... wind?");
          a.say("That was... the weather.", 2.0, 3.8);
        },
      },
      {
        name: "Weather Report",
        dur: 4.4,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            const s = Math.floor(t / 0.8) % 2;
            p.armF = s ? [1.9, 0.1] : [1.5, 0.2];
            p.armB = [-0.4, 1.4];
          });
          const h = a.head(a.S);
          const icons = ["sun", "cloud", "snow", "bolt"];
          a.front((ctx) => {
            icons.forEach((ic, i) => {
              const at = 0.4 + i * 0.7;
              const s = smooth(seg(t, at, at + 0.2)) * (1 - seg(t, 3.9, 4.3));
              if (s <= 0) return;
              const x = h.x + a.S.facing * (40 + i * 34);
              const y = h.y - 40 + sin(t * 3 + i) * 4;
              ctx.save();
              ctx.translate(x, y);
              ctx.scale(s, s);
              if (ic === "sun") {
                A.glow(ctx, 0, 0, 22, "#ffe14a", 0.7);
                A.circle(ctx, 0, 0, 10, "#ffd23f", true, 2);
              } else if (ic === "cloud") cloud(ctx, 0, 4, 0.55);
              else if (ic === "snow") A.text(ctx, "❄", 0, 0, 24, "#e8fbff", "center");
              else A.poly(ctx, [2, -14, -8, 2, 0, 2, -3, 14, 8, -3, 0, -3], "#ffe14a", true, 2);
              ctx.restore();
            });
          });
          [0.4, 1.1, 1.8, 2.5].forEach((tt) => a.sfx(tt, "pop"));
          a.sfx(2.6, "tada");
          a.say("Today's forecast...", 0.3, 1.8);
          a.say("100% chance of AWESOME.", 2.6, 4.4);
        },
      },
      {
        name: "Snow Day",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.pose((p) => {
            if (t < 1.0) P.armsUp(p);
            else {
              p.bob = -abs(sin(t * 12)) * 3;
              p.armF = [1.9, 2.3];
            }
          });
          if (n) {
            a.every(0.03, 0.1, 1.1, () => XM.FX.spawn(XM.FX.T.DOT, n.x + U.rand(-40, 40), n.y - 170, U.rand(-20, 20), 160, 1.0, 4, "#ffffff"));
            a.react(n, "frozen", 1.0, 2.6, "brrrrr...");
          }
          a.sfx(1.0, "ice");
          a.say("Chill out!", 1.3, 2.8);
        },
      },
      {
        name: "Rainbow Magic",
        dur: 3.8,
        run(a) {
          const t = a.t;
          a.pose((p) => P.armsUp(p));
          a.power = bell(t, 0.2, 1.4);
          const grow = smooth(seg(t, 0.4, 1.4)) * (1 - seg(t, 3.2, 3.8));
          a.back((ctx) => {
            if (grow <= 0) return;
            const cx = a.S.x + a.S.facing * 120;
            const cy = a.S.y;
            const cols = ["#ff4a4a", "#ff9a3a", "#ffe14a", "#5ad06a", "#3a9aff", "#8a5aff"];
            ctx.globalAlpha = 0.75 * (1 - seg(t, 3.2, 3.8));
            cols.forEach((c, i) => {
              ctx.strokeStyle = c;
              ctx.lineWidth = 7;
              ctx.beginPath();
              const r = 150 - i * 7;
              ctx.arc(cx, cy, r, PI, PI + PI * grow);
              ctx.stroke();
            });
            ctx.globalAlpha = 1;
          });
          a.sfx(1.2, "tada");
          a.say("Ta-da! Weather magic.", 1.6, 3.2);
        },
      },
      {
        name: "Thunder Guitar",
        dur: 4.2,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            P.guitar(p, t);
            if (within(t, 2.8, 3.3)) {
              p.lift = 26 * bell(t, 2.8, 3.3);
              p.grounded = false;
              p.legF = [1.0, 1.4];
              p.legB = [-0.4, 1.2];
            }
          });
          a.mem.strikes = a.mem.strikes || [];
          [0.6, 1.2, 1.8, 2.4, 3.1].forEach((tt, i) =>
            a.once(tt, () => {
              XM.Audio.sfx("lightning");
              XM.FX.flash("#ffffff", i === 4 ? 0.5 : 0.25);
              XM.FX.shake(i === 4 ? 8 : 3, 0.2);
              a.mem.strikes.push({ x: a.S.x + U.rand(-260, 120), t: tt });
            }),
          );
          a.front((ctx) => {
            for (const s of a.mem.strikes) if (t - s.t < 0.18) bolt(ctx, s.x, -10, s.x + U.rand(-20, 20), a.S.y);
          });
          a.say("ROCK AND ROLL!", 3.1, 4.2);
        },
      },
      {
        name: "Cloud Nap",
        dur: 4.4,
        run(a) {
          const t = a.t;
          const up = hold(t, 0.2, 1.0, 3.4, 3.9);
          a.body.dy = -70 * up;
          a.body.pivot = 32;
          a.body.rot = -a.S.facing * 1.45 * up;
          a.body.dx = sin(t * 1.2) * 20 * up;
          a.speed = 120 * up;
          a.pose((p) => {
            p.armF = [2.9, 2.2];
            p.armB = [2.7, 2.4];
            p.legF = [0.1, 0.3];
            p.legB = [-0.1, 0.4];
          });
          a.back((ctx) => {
            if (up > 0.05) {
              ctx.globalAlpha = up;
              cloud(ctx, a.S.x + a.body.dx, a.S.y + a.body.dy + 30, 1.4, "#f0f4fa");
              ctx.globalAlpha = 1;
            }
          });
          zzz(a, a.S.x, a.S.y - 160, 1.0, 3.4);
          a.sfx(1.2, "snore");
          a.sfx(2.4, "snore");
          a.say("Five more minutes...", 2.0, 3.4);
        },
      },
    ],

    // ===================== CYCLOPS =====================
    cyclops: [
      {
        name: "Optic Sneeze",
        dur: 3.4,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            if (t < 1.0) {
              p.headTilt = -0.4 * seg(t, 0, 0.9);
              p.lean = -0.18 * seg(t, 0, 0.9);
            } else if (t < 1.4) {
              p.headTilt = 0.35;
              p.lean = 0.3;
            } else P.mouth(p);
          });
          a.say("Ah... ahh...", 0.1, 0.95);
          a.sfx(0.4, "sneeze");
          a.once(1.0, () => {
            XM.FX.flash("#ff3030", 0.4);
            XM.FX.shake(7, 0.3);
            XM.FX.text(a.S.x, a.S.y - 150, "CHOO!", "#ff5a3a", 30, 0.9);
            XM.Audio.sfx("beam");
          });
          a.front((ctx) => {
            if (!within(t, 1.0, 1.35)) return;
            const h = a.head(a.S);
            beam(ctx, h.x, h.y, a.S.facing > 0 ? -0.9 : PI + 0.9, 700, 14);
          });
          a.once(1.2, () => XM.FX.smoke(a.S.x + a.S.facing * 300, 40, 10, "#6a5a5a"));
          const n = a.near();
          if (n) a.react(n, "scared", 1.0, 1.4);
          a.say("...Bless me.", 1.7, 3.4);
        },
      },
      {
        name: "Laser Pointer",
        dur: 4.2,
        run(a) {
          const t = a.t;
          const target = a.find("wolverine") || a.near();
          const dot = () => a.S.x + a.S.facing * 60 + sin(a.t * 2.3) * 150 + sin(a.t * 5.1) * 40;
          a.pose((p) => (p.headTilt = 0.25));
          a.front((ctx) => {
            if (!within(t, 0.3, 3.6)) return;
            const h = a.head(a.S);
            const x = dot();
            ctx.strokeStyle = "rgba(255,40,40,0.25)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(h.x, h.y);
            ctx.lineTo(x, a.S.y);
            ctx.stroke();
            A.glow(ctx, x, a.S.y - 2, 12, "#ff2020", 1);
            A.circle(ctx, x, a.S.y - 2, 3, "#ffffff", false);
          });
          if (target) a.react(target, "chase", 0.5, 3.0, target.id === "wolverine" ? "I hate you, Summers." : "Not funny!", { dot });
          a.say("Heh. Here, kitty kitty.", 0.5, 2.2);
        },
      },
      {
        name: "Movie Night",
        dur: 4.0,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            p.armF = t > 2.4 ? [2.05, 2.5 + sin(t * 14) * 0.15] : [1.2, 1.3];
            p.headTilt = within(t, 0.8, 1.4) ? 0.45 : 0;
          });
          a.front((ctx) => {
            const bx = a.S.x + a.S.facing * 26;
            const by = a.S.y - 50;
            A.poly(ctx, [bx - 11, by - 14, bx + 11, by - 14, bx + 8, by + 14, bx - 8, by + 14], "#ffffff", true, 2);
            ctx.fillStyle = "#e0262c";
            for (let i = -1; i <= 1; i++) ctx.fillRect(bx + i * 7 - 1.5, by - 13, 3, 26);
            if (t > 1.0) for (let i = 0; i < 5; i++) A.circle(ctx, bx - 8 + i * 4, by - 16 - (i % 2) * 3, 3.5, "#fff6d0", true, 1);
            if (within(t, 0.8, 1.4)) {
              const h = a.head(a.S);
              beam(ctx, h.x, h.y, Math.atan2(by - h.y, bx - h.x), Math.hypot(bx - h.x, by - h.y), 4);
            }
          });
          a.sfx(0.8, "blast");
          a.every(0.09, 1.0, 2.2, () => {
            XM.Audio.sfx("pop");
            XM.FX.burst(a.S.x + a.S.facing * 26, a.S.y - 66, { count: 2, colors: ["#fff6d0", "#ffe07a"], speed: 220, life: 0.8, type: XM.FX.T.DOT, grav: 600, size: 6, angle: -PI / 2, spread: 2 });
          });
          a.every(0.3, 2.5, 3.6, () => XM.Audio.sfx("step"));
          a.say("Movie night!", 2.4, 4.0);
        },
      },
      {
        name: "Inspiring Speech",
        dur: 4.6,
        run(a) {
          const t = a.t;
          const box = smooth(seg(t, 0.1, 0.4));
          a.body.dy = -26 * box;
          a.back((ctx) => {
            if (box <= 0) return;
            A.box(ctx, a.S.x - 34, a.S.y - 26 * box, 68, 26 * box, "#a8743a", true, 3, 2);
            A.text(ctx, "SOAP", a.S.x, a.S.y - 13 * box, 9, "#6a4420", "center", false);
          });
          a.pose((p) => {
            const s = Math.floor(t / 0.7) % 2;
            p.armF = s ? [3.0, 0.1] : [1.7, 1.4];
            p.armB = [0.4, 0.6];
            if (t > 3.6) {
              p.armF = [0.3, 0.4];
              p.headTilt = -0.2;
            }
          });
          for (const o of a.others()) a.react(o, "asleep", 1.4, 3.2);
          a.say("X-Men! Today we stand for...", 0.4, 2.2);
          a.say("...hope! Unity! TEAMWORK!", 2.2, 3.5);
          a.say("...guys?", 3.7, 4.6);
          a.sfx(3.7, "squeak");
        },
      },
      {
        name: "Dad Dance",
        dur: 4.2,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            const s = sin(t * 7) > 0 ? 1 : -1;
            p.armF = [1.57, 1.57 * s];
            p.armB = [1.57, -1.2 * s];
            p.legF = [0.2 * s, 0.3];
            p.legB = [-0.2 * s, 0.3];
            p.lean = 0;
            p.headTilt = 0.15 * s;
          });
          a.body.dx = Math.round(sin(t * 3.5) * 3) * 6 * hold(t, 0.2, 0.4, 3.8, 4.1);
          notes(a, a.S.x, a.S.y - 140, 0.2, 3.6, 0.28);
          a.say("I've still got the moves!", 0.5, 2.2);
          const n = a.near();
          if (n) a.react(n, "cringe", 2.2, 2.0, "Please stop.");
        },
      },
      {
        name: "Visor Malfunction",
        dur: 3.8,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            p.armF = [2.2, 2.4];
            p.armB = [2.0, 2.5];
            p.lean = within(t, 0.5, 2.5) ? sin(t * 9) * 0.2 : 0;
          });
          const shots = [0.6, 1.0, 1.5, 1.9, 2.3];
          a.mem.angles = a.mem.angles || shots.map(() => U.rand(-PI, 0));
          shots.forEach((tt) => a.sfx(tt, "beam"));
          a.front((ctx) => {
            shots.forEach((tt, i) => {
              if (within(t, tt, tt + 0.2)) {
                const h = a.head(a.S);
                beam(ctx, h.x, h.y, a.mem.angles[i], 800, 7);
              }
            });
          });
          shots.forEach((tt, i) => a.once(tt + 0.1, () => XM.FX.shake(3, 0.15)));
          a.say("Stupid... ruby... quartz!", 0.9, 2.4);
          a.say("It's fine. Everything's fine.", 2.6, 3.8);
        },
      },
      {
        name: "Optic Toast",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const char = seg(t, 0.9, 1.4);
          a.pose((p) => {
            p.armF = t > 1.7 && t < 2.3 ? [2.05, 2.5] : [1.3, 1.0];
            p.headTilt = within(t, 0.8, 1.4) ? 0.35 : 0;
          });
          a.front((ctx) => {
            const hx = a.S.x + a.S.facing * (t > 1.7 && t < 2.3 ? 10 : 30);
            const hy = a.S.y - (t > 1.7 && t < 2.3 ? 92 : 58);
            const col = A.mix("#e8c07a", "#2a1a10", char);
            A.box(ctx, hx - 10, hy - 11, 20, 20, col, true, 5, 2);
            if (within(t, 0.8, 1.4)) {
              const h = a.head(a.S);
              beam(ctx, h.x, h.y, Math.atan2(hy - h.y, hx - h.x), Math.hypot(hx - h.x, hy - h.y), 5);
            }
          });
          a.sfx(0.8, "beam");
          a.every(0.12, 1.2, 3.6, () => XM.FX.smoke(a.S.x + a.S.facing * 28, a.S.y - 66, 1, "#5a5a5a"));
          a.sfx(1.9, "break");
          a.say("Perfectly toasted.", 2.3, 4.0);
        },
      },
      {
        name: "Selfie Time",
        dur: 3.8,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            p.armF = [2.35, 0.7];
            p.lean = -0.1;
            p.headTilt = -0.1 + sin(t * 2) * 0.05;
            p.armB = [-0.55, 1.6];
          });
          const melt = seg(t, 2.4, 2.8);
          a.front((ctx) => {
            const x = a.S.x + a.S.facing * 30;
            const y = a.S.y - 118;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, 1 + melt * 0.6);
            A.box(ctx, -7, -12, 14, 22, A.mix("#2a2a32", "#5a2a1a", melt), true, 3, 2);
            ctx.restore();
            const hd = a.head(a.S);
            if (within(t, 2.3, 2.6)) beam(ctx, hd.x, hd.y, Math.atan2(y - hd.y, x - hd.x), Math.hypot(x - hd.x, y - hd.y), 3);
          });
          [1.0, 1.6, 2.2].forEach((tt) => {
            a.sfx(tt, "pop");
            a.once(tt, () => XM.FX.flash("#ffffff", 0.35, 4));
          });
          a.every(0.1, 2.5, 3.6, () => XM.FX.smoke(a.S.x + a.S.facing * 30, a.S.y - 120, 1, "#5a5a5a"));
          a.say("Say 'X-Men'!", 0.2, 1.6);
          a.say("Every. Single. Time.", 2.7, 3.8);
        },
      },
      {
        name: "Who's the Leader",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const n = a.find("wolverine") || a.near();
          if (n) a.faceTo(n);
          a.pose((p) => {
            if (t < 1.8) P.point(p);
            else P.hips(p);
          });
          a.say("Remember: I'm the leader.", 0.2, 1.7);
          if (n) a.react(n, "unimpressed", 1.7, 1.5, n.id === "wolverine" ? "Sure thing, bub." : "Uh huh.");
          a.say("...I'm the leader.", 3.2, 4.0);
        },
      },
      {
        name: "Party Visor",
        dur: 4.4,
        run(a) {
          const t = a.t;
          a.pose((p) => P.dance(p, t, 9));
          a.front((ctx) => {
            if (!within(t, 0.3, 3.8)) return;
            const h = a.head(a.S);
            const cols = ["#ff3030", "#ff3ad0", "#3a9aff", "#3aff7a"];
            for (let i = 0; i < 4; i++) {
              ctx.globalAlpha = 0.5;
              beam(ctx, h.x, h.y, -PI / 2 + sin(t * 2 + i * 1.6) * 1.3, 600, 3, cols[i]);
            }
            ctx.globalAlpha = 1;
          });
          for (const o of a.others()) a.react(o, "danceAlong", 0.8, 2.9);
          notes(a, a.S.x, a.S.y - 150, 0.3, 3.8, 0.22);
          a.say("Party mode: ACTIVATED.", 0.4, 1.9);
        },
      },
    ],

    // ===================== WOLVERINE =====================
    wolverine: [
      {
        name: "Back Scratcher",
        dur: 3.6,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            if (t > 0.3 && t < 2.8) {
              p.armF = [2.7, 2.5 + sin(t * 28) * 0.35];
              p.armB = [-1.0, 2.2 + sin(t * 30) * 0.3];
              p.headTilt = -0.3;
              p.lean = -0.1;
            }
          });
          a.body.sx = 1 + (within(t, 0.4, 2.6) ? sin(t * 30) * 0.02 : 0);
          a.sfx(0.3, "slash");
          a.every(0.2, 0.5, 2.6, () => {
            const h = a.head(a.S);
            XM.FX.burst(h.x - a.S.facing * 12, h.y + 30, { count: 2, color: "#fff3c4", speed: 120, life: 0.2 });
          });
          a.say("Ahhhh... that's the spot.", 1.2, 3.0);
        },
      },
      {
        name: "Root Beer Burp",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const drinking = within(t, 0.6, 1.9);
          a.pose((p) => {
            p.armF = drinking ? [2.4, 2.2] : [1.3, 1.2];
            p.headTilt = drinking ? -0.35 : 0;
            if (within(t, 2.1, 2.5)) {
              p.lean = 0.25;
              p.headTilt = 0.2;
            }
          });
          a.front((ctx) => {
            if (t > 3.6) return;
            const x = a.S.x + a.S.facing * (drinking ? 14 : 26);
            const y = a.S.y - (drinking ? 100 : 60);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(drinking ? -a.S.facing * 0.9 : 0);
            A.box(ctx, -10, -16, 20, 30, "#7a4a1a", true, 3, 2);
            ctx.fillStyle = "#f8f0e0";
            ctx.fillRect(-10, -18, 20, 6);
            A.text(ctx, "RB", 0, 0, 9, "#f2c230", "center", false);
            ctx.restore();
          });
          a.every(0.32, 0.7, 1.8, () => XM.Audio.sfx("squeak"));
          a.sfx(2.1, "burp");
          a.once(2.1, () => {
            XM.FX.shake(5, 0.4);
            XM.FX.text(a.S.x + a.S.facing * 30, a.S.y - 140, "BUUURRRP", "#ffe14a", 26, 1.2);
          });
          for (const o of a.others()) a.react(o, "blown", 2.1, 0.9);
          a.say("...'Scuse me.", 2.9, 4.0);
        },
      },
      {
        name: "Claw-Dogs",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const eaten = [1.1, 1.7, 2.3].filter((tt) => t > tt).length;
          a.pose((p) => {
            p.armF = [1.5, 0.3];
            if (within(t, 1.0, 1.25) || within(t, 1.6, 1.85) || within(t, 2.2, 2.45)) p.armF = [2.1, 2.3];
          });
          a.front((ctx) => {
            const h = a.hand(a.S);
            const ang = a.S.facing > 0 ? -0.05 : PI + 0.05;
            for (let i = eaten; i < 3; i++) {
              const x = h.x + cos(ang) * 10 + a.S.facing * 0;
              const y = h.y - 4 + i * 4 - 6;
              ctx.save();
              ctx.translate(x + a.S.facing * 12, y);
              A.box(ctx, -12, -4, 24, 8, "#d8a868", true, 4, 1.5);
              A.box(ctx, -10, -2.5, 20, 5, "#c4462a", false, 2);
              ctx.restore();
            }
          });
          [1.1, 1.7, 2.3].forEach((tt) => a.sfx(tt, "punch"));
          a.sfx(0.3, "slash");
          a.say("Healing factor needs fuel.", 2.6, 4.0);
        },
      },
      {
        name: "Wasn't Me",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const n = a.find("gambit", "cyclops") || a.near();
          a.sfx(0.4, "fart", { len: 1.1 });
          gas(a, a.S.x - a.S.facing * 14, a.S.y - 34, 0.4, 1.4);
          if (n && t > 1.4) a.faceTo(n);
          a.pose((p) => {
            if (t > 1.4) P.point(p);
            else P.crossed(p);
          });
          if (n) a.react(n, "stinky", 0.9, 2.9, "It was DEFINITELY him.");
          a.say("Wasn't me, bub.", 1.5, 2.8);
        },
      },
      {
        name: "Berserker Tantrum",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const mad = within(t, 0.2, 2.3);
          a.body.dy = mad ? -abs(sin(t * 12)) * 16 : 0;
          a.pose((p) => {
            if (mad) P.flail(p, t);
            else if (within(t, 2.4, 3.0)) P.armsUp(p);
          });
          a.power = mad ? 0.6 : 0;
          a.every(0.26, 0.2, 2.3, () => XM.Audio.sfx("stomp"));
          a.every(0.12, 0.3, 2.3, () => {
            const h = a.head(a.S);
            XM.FX.smoke(h.x + U.rand(-10, 10), h.y - 16, 1, "#f0f0f0");
          });
          a.front((ctx) => {
            if (within(t, 0.4, 2.2)) {
              const h = a.head(a.S);
              grawlix(ctx, h.x, h.y - 60 + sin(t * 20) * 3);
            }
          });
          a.say("...I'm good.", 2.6, 3.8);
        },
      },
      {
        name: "That Darn Fly",
        dur: 4.4,
        run(a) {
          const t = a.t;
          const h = a.head(a.S);
          const landed = t > 3.0;
          const fx = landed ? h.x + a.S.facing * 10 : h.x + sin(t * 7) * 40 + cos(t * 11) * 14;
          const fy = landed ? h.y + 2 : h.y - 20 + sin(t * 9) * 26;
          a.pose((p) => {
            if (within(t, 0.8, 2.9)) {
              const c = Math.floor(t * 5) % 3;
              p.armF = [[2.7, 0.2], [0.6, 0.3], [2.0, 1.3]][c];
              p.armB = [[0.7, 1.2], [2.6, 0.2], [1.5, 1.4]][c];
              p.lean = sin(t * 10) * 0.2;
            } else if (landed) {
              p.headTilt = 0.2;
              P.crossed(p);
            }
          });
          a.every(0.2, 0.8, 2.9, () => XM.Audio.sfx("slash"));
          a.front((ctx) => {
            ctx.fillStyle = "#111";
            ctx.beginPath();
            ctx.arc(fx, fy, 2.5, 0, PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(220,230,255,0.8)";
            const wing = landed ? 2 : 4 + sin(t * 80) * 2;
            ctx.beginPath();
            ctx.ellipse(fx - 2, fy - 3, 2, wing, -0.4, 0, PI * 2);
            ctx.ellipse(fx + 2, fy - 3, 2, wing, 0.4, 0, PI * 2);
            ctx.fill();
          });
          a.every(0.6, 0, 3.0, () => XM.FX.text(fx + 10, fy - 6, "bzz", "#888", 10, 0.5, -20));
          a.say("Get back here!", 0.9, 2.4);
          a.say("...Fine. You win.", 3.2, 4.4);
        },
      },
      {
        name: "Stubbed Toe",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const hop = within(t, 0.5, 2.1);
          a.body.dx = a.S.facing * 14 * smooth(seg(t, 0, 0.45));
          a.body.dy = hop ? -abs(sin(t * 11)) * 18 : 0;
          a.state = t < 0.45 ? "walk" : "idle";
          a.phase = t * 9;
          a.pose((p) => {
            if (hop) {
              p.legF = [1.0, 1.9];
              p.armF = [0.7, 0.6];
              p.armB = [2.2, 0.6];
              p.lean = 0.2;
            }
          });
          a.sfx(0.5, "punch");
          a.every(0.29, 0.5, 2.1, () => XM.Audio.sfx("land"));
          a.say("OW OW OW OW!", 0.6, 1.9);
          a.once(2.1, () => {
            XM.Audio.sfx("heal");
            XM.FX.burst(a.S.x + a.body.dx, a.S.y - 10, { count: 14, color: "#7aff7a", speed: 140, life: 0.6, type: XM.FX.T.STAR });
          });
          a.say("...Never mind.", 2.4, 3.8);
        },
      },
      {
        name: "Tea Time",
        dur: 4.2,
        run(a) {
          const t = a.t;
          const sip = within(t, 0.9, 1.6) || within(t, 2.0, 2.5);
          a.pose((p) => {
            p.armF = sip ? [2.1, 2.4] : [1.3, 1.3];
            p.armB = [1.0, 1.4];
            p.headTilt = sip ? -0.15 : 0;
          });
          const broken = t > 2.9;
          a.front((ctx) => {
            const x = a.S.x + a.S.facing * (sip ? 12 : 22);
            const y = a.S.y - (sip ? 94 : 64);
            if (!broken) {
              A.box(ctx, x - 6, y - 5, 12, 9, "#f4f0ff", true, 2, 1.5);
              ctx.strokeStyle = A.OUTLINE;
              ctx.beginPath();
              ctx.arc(x + a.S.facing * 7, y - 1, 3, 0, PI * 2);
              ctx.stroke();
              // One dainty claw, pinky up.
              ctx.strokeStyle = "#dfe4ea";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x - a.S.facing * 4, y + 4);
              ctx.lineTo(x - a.S.facing * 4, y - 12);
              ctx.stroke();
            }
          });
          a.once(2.9, () => {
            XM.Audio.sfx("break");
            XM.FX.burst(a.S.x + a.S.facing * 22, a.S.y - 64, { count: 10, color: "#f4f0ff", speed: 160, life: 0.5, type: XM.FX.T.SHARD, grav: 600 });
          });
          a.say("Very civilized.", 1.0, 2.6);
          a.say("...Dang it.", 3.1, 4.2);
        },
      },
      {
        name: "Secret Ballet",
        dur: 4.2,
        run(a) {
          const t = a.t;
          const spin = within(t, 0.5, 2.2);
          a.body.sx = spin ? cos((t - 0.5) * 14) : 1;
          a.pose((p) => {
            p.lift = 6;
            p.grounded = false;
            if (t < 2.4) {
              p.armF = [2.9, 0.9];
              p.armB = [2.8, 1.0];
              p.legF = [0.05, 0.1];
              p.legB = [0.0, 0.1];
            } else if (t < 3.2) {
              p.lean = 0.55;
              p.legB = [-1.5, 0];
              p.legF = [0.0, 0];
              p.armF = [1.6, 0];
              p.armB = [-1.6, 0];
            }
          });
          a.body.flip = t > 3.2;
          a.every(0.5, 0.3, 3.0, () => XM.Audio.sfx("ding"));
          a.say("You didn't see nothin'.", 3.2, 4.2);
        },
      },
      {
        name: "Earthquake Snore",
        dur: 4.4,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            if (t < 3.5) P.sleep(p, t);
          });
          [0.5, 1.6, 2.7].forEach((tt) => {
            a.sfx(tt, "snore");
            a.once(tt, () => {
              XM.FX.shake(5, 0.6);
              XM.FX.text(a.S.x, a.S.y - 140, "ZZZRRRKK", "#bfe6ff", 22, 1.2);
            });
          });
          for (const o of a.others()) {
            a.react(o, "blown", 0.5, 0.6);
            a.react(o, "blown", 1.6, 0.6);
          }
          a.once(3.5, () => XM.FX.text(a.S.x, a.S.y - 150, "!", "#ff5a3a", 28, 0.7));
          a.say("Who's snorin'?", 3.6, 4.4);
        },
      },
    ],

    // ===================== JEAN GREY =====================
    jean: [
      {
        name: "Telekinetic Juggling",
        dur: 4.2,
        run(a) {
          const t = a.t;
          const h = a.head(a.S);
          const drop = t > 2.6;
          a.pose((p) => {
            const s = sin(t * 9);
            p.armF = [2.0 + s * 0.4, 0.4];
            p.armB = [2.0 - s * 0.4, 0.4];
            if (t > 2.9) {
              p.headTilt = 0.3;
              p.armF = [2.6, 2.4];
            }
          });
          a.power = t < 2.6 ? 0.5 : 0;
          a.front((ctx) => {
            const items = ["apple", "duck", "mug"];
            items.forEach((it, i) => {
              let ang = t * 5 + (i * PI * 2) / 3;
              let x = h.x + a.S.facing * 20 + cos(ang) * 26;
              let y = h.y - 40 + sin(ang) * 30;
              if (it === "duck" && drop) {
                const k = seg(t, 2.6, 2.95);
                x = U.lerp(x, h.x, k);
                y = U.lerp(h.y - 70, h.y - 12, k * k);
                if (t > 2.95) y = h.y - 12 + (t - 2.95) * 40;
                if (t > 3.6) return;
              }
              A.glow(ctx, x, y, 14, "#ff6ad5", t < 2.6 ? 0.5 : 0);
              if (it === "apple") {
                A.circle(ctx, x, y, 7, "#e0262c", true, 1.5);
                A.limb(ctx, x, y - 7, x + 2, y - 11, 2, "#5a3a1a", false);
              } else if (it === "duck") {
                A.ellipse(ctx, x, y, 8, 6, 0, "#ffd23f", true, 1.5);
                A.circle(ctx, x + 5, y - 6, 4, "#ffd23f", true, 1.5);
                A.poly(ctx, [x + 8, y - 6, x + 12, y - 5, x + 8, y - 4], "#ff8a1a", false);
              } else {
                A.box(ctx, x - 6, y - 6, 12, 12, "#f4f4ff", true, 2, 1.5);
                A.text(ctx, "X", x, y, 7, "#c4161c", "center", false);
              }
            });
          });
          a.sfx(0.2, "psychic");
          a.sfx(2.95, "squeak");
          a.sfx(3.0, "boing");
          if (t > 3.0) a.stars(a.S);
          a.say("I meant to do that.", 3.2, 4.2);
        },
      },
      {
        name: "Upside Down",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.pose((p) => {
            P.temple(p);
            p.bob = -abs(sin(t * 12)) * 2 * seg(t, 1.0, 1.2);
          });
          a.power = bell(t, 0.2, 3.4);
          a.sfx(0.3, "psychic");
          if (n) a.react(n, "flip", 0.4, 3.0, "JEAN!");
          a.say("Hold still, I'm reorganizing you.", 0.8, 2.6);
        },
      },
      {
        name: "Stop Hitting Yourself",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.pose((p) => {
            if (t < 2.4) P.temple(p);
            else p.bob = -abs(sin(t * 14)) * 3;
          });
          a.power = bell(t, 0.2, 2.6);
          if (n) a.react(n, "slap", 0.4, 2.8, "Why do I keep doing that?!");
          a.say("Stop hitting yourself!", 0.6, 2.2);
          a.say("Hee hee!", 2.6, 3.6);
        },
      },
      {
        name: "Phoenix S'mores",
        dur: 4.4,
        run(a) {
          const t = a.t;
          const onFire = within(t, 1.6, 2.6);
          const charred = t > 2.6;
          a.pose((p) => {
            p.armF = onFire ? [1.6 + sin(t * 30) * 0.5, 0.2] : t > 3.2 && t < 3.6 ? [2.05, 2.5] : [1.4, 0.4];
            p.armB = onFire ? [2.4 + sin(t * 26) * 0.4, 0.3] : [1.2, 1.2];
          });
          a.front((ctx) => {
            if (t > 3.6) return;
            const h = a.hand(a.S);
            const sx = h.x + a.S.facing * 34;
            const sy = h.y - 18;
            A.limb(ctx, h.x, h.y, sx, sy, 2, "#8a5a2a");
            A.box(ctx, sx - 6, sy - 6, 12, 11, charred ? "#2a1a10" : "#fff8ee", true, 4, 1.5);
            if (within(t, 0.4, 1.6)) A.glow(ctx, sx, sy + 14, 16, "#ff8a3d", 0.9);
            if (onFire) {
              A.glow(ctx, sx, sy - 8, 24 + sin(t * 30) * 4, "#ff7a1a", 1);
              A.glow(ctx, sx, sy - 6, 12, "#ffe07a", 1);
            }
          });
          a.sfx(0.4, "fire");
          a.sfx(1.6, "fire");
          a.once(2.6, () => {
            XM.Audio.sfx("dodge");
            XM.FX.smoke(a.S.x + a.S.facing * 50, a.S.y - 70, 6, "#6a6a6a");
          });
          a.say("Toasty...", 0.5, 1.5);
          a.say("NO NO NO NO!", 1.7, 2.6);
          a.say("...Crispy.", 3.3, 4.4);
        },
      },
      {
        name: "Hair on Fire",
        dur: 3.6,
        run(a) {
          const t = a.t;
          const burning = within(t, 0.3, 2.0);
          a.pose((p) => {
            if (within(t, 0.5, 2.0)) {
              p.armF = [2.8, 2.6 + sin(t * 30) * 0.3];
              p.armB = [2.7, 2.5 + cos(t * 28) * 0.3];
            }
          });
          a.body.dx = within(t, 0.5, 2.0) ? sin(t * 14) * 8 : 0;
          a.front((ctx) => {
            if (!burning) return;
            const h = a.head(a.S);
            for (let i = 0; i < 5; i++) A.glow(ctx, h.x - a.S.facing * (6 + i * 5) + sin(t * 20 + i) * 3, h.y - 6 - cos(t * 17 + i) * 6, 14, i % 2 ? "#ff7a1a" : "#ffcf4a", 0.95);
          });
          a.sfx(0.3, "fire");
          a.once(2.0, () => {
            XM.Audio.sfx("dodge");
            const h = a.head(a.S);
            XM.FX.smoke(h.x, h.y, 10, "#7a7a7a");
          });
          a.every(0.15, 2.0, 3.4, () => {
            const h = a.head(a.S);
            XM.FX.smoke(h.x - a.S.facing * 8, h.y - 8, 1, "#9a9a9a");
          });
          a.say("Not now, Phoenix!", 0.6, 2.0);
          a.say("...Nobody saw that.", 2.3, 3.6);
        },
      },
      {
        name: "Psychic Karaoke",
        dur: 4.4,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            const s = sin(t * 4);
            p.armF = [2.2 + s * 0.3, 0.3];
            p.armB = [1.8 - s * 0.3, 0.3];
            p.headTilt = -0.2 + s * 0.1;
            if (t > 3.3) {
              p.lean = 0.5 * bell(t, 3.3, 4.0);
              p.armF = [0.4, 0.2];
            }
          });
          a.front((ctx) => {
            if (t > 3.3) return;
            const h = a.head(a.S);
            const x = h.x + a.S.facing * 18;
            const y = h.y + 10 + sin(t * 3) * 2;
            A.glow(ctx, x, y, 12, "#ff6ad5", 0.6);
            A.limb(ctx, x, y, x + a.S.facing * 4, y + 16, 3, "#2a2a32");
            A.circle(ctx, x, y, 5, "#9aa3b2", true, 1.5);
          });
          notes(a, a.S.x, a.S.y - 150, 0.4, 3.2, 0.15);
          for (const o of a.others()) a.react(o, "ears", 0.6, 2.8);
          a.say("♪ La la LAAAAAA ♪", 0.5, 3.0);
          a.say("Thank you, thank you.", 3.4, 4.4);
        },
      },
      {
        name: "Floating Yoga",
        dur: 4.2,
        run(a) {
          const t = a.t;
          const up = hold(t, 0.2, 0.7, 2.9, 3.0);
          const tip = smooth(seg(t, 2.1, 2.9));
          a.body.dy = -40 * up;
          a.body.pivot = 20;
          a.body.rot = a.S.facing * 1.3 * tip * (t < 3.0 ? 1 : 1 - seg(t, 3.0, 3.3));
          a.pose((p) => {
            p.grounded = false;
            p.legF = [1.5, 2.6];
            p.legB = [1.3, 2.6];
            p.armF = [0.9, 0.3];
            p.armB = [0.8, 0.3];
            p.lift = -16;
            if (t > 3.0) {
              p.grounded = true;
              p.lift = 0;
            }
          });
          a.power = up * 0.4;
          a.every(0.6, 0.5, 2.1, () => XM.FX.text(a.S.x, a.S.y - 130, "Ommm", "#ffe9a0", 14, 1.2, -30));
          a.sfx(3.0, "land");
          a.say("Inner peace...", 0.6, 2.0);
          a.say("Ow. Inner peace is hard.", 3.2, 4.2);
        },
      },
      {
        name: "Pillow Fight",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const n = a.near();
          a.pose((p) => {
            p.armF = [1.7, 0.2 + sin(t * 12) * 0.3];
            p.bob = t > 2.2 ? -abs(sin(t * 14)) * 3 : 0;
          });
          a.power = bell(t, 0.2, 2.2);
          if (n) {
            const hits = [0.8, 1.3, 1.8];
            a.front((ctx) => {
              const nh = a.head(n);
              const h = a.head(a.S);
              hits.forEach((tt) => {
                const k = seg(t, tt - 0.4, tt);
                if (k <= 0 || k >= 1) return;
                const x = U.lerp(h.x, nh.x, k);
                const y = U.lerp(h.y - 30, nh.y, k) - sin(k * PI) * 40;
                A.glow(ctx, x, y, 22, "#ff6ad5", 0.4);
                A.box(ctx, x - 14, y - 9, 28, 18, "#f8f4ff", true, 7, 2);
              });
            });
            hits.forEach((tt) => {
              a.react(n, "bonk", tt, 0.4);
              a.once(tt, () => {
                const nh = a.head(n);
                XM.Audio.sfx("boing");
                XM.FX.burst(nh.x, nh.y, { count: 12, color: "#ffffff", speed: 160, life: 0.9, type: XM.FX.T.SHARD, grav: 120, size: 3 });
              });
            });
            a.react(n, "unimpressed", 2.3, 1.7, "Oh, it is ON.");
          }
          a.say("Pillow fight!", 0.3, 1.6);
        },
      },
      {
        name: "Psychic Hiccups",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const hics = [0.4, 1.0, 1.5, 2.0, 2.6];
          let jolt = 0;
          hics.forEach((tt, i) => {
            jolt += bell(t, tt, tt + 0.15) * (i === 4 ? 0 : 14);
            a.sfx(tt, "squeak");
            a.once(tt, () => {
              const h = a.head(a.S);
              XM.FX.ring(h.x, h.y, 30 + i * 8, "#ff6ad5", 0.35, 4);
              XM.FX.text(h.x + 30, h.y - 20, "*hic*", "#ff9ad9", 14, 0.8);
            });
          });
          a.body.dy = -jolt - 70 * hold(t, 2.6, 2.8, 2.9, 3.4);
          a.power = t > 2.6 && t < 3.4 ? 0.6 : 0;
          a.say("Hic! ...It's not funny! *hic*", 3.0, 4.0);
        },
      },
      {
        name: "Phoenix Pose...?",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const charge = seg(t, 0.2, 1.6);
          a.pose((p) => {
            if (t < 1.7) {
              P.armsUp(p);
              p.lift = 10 * charge;
              p.grounded = false;
            } else {
              p.armF = [0.3, 0.3];
              p.armB = [-0.2, 0.3];
              p.headTilt = 0.25;
            }
          });
          a.power = t < 1.7 ? charge : 0;
          a.back((ctx) => {
            if (t > 1.7) return;
            const h = a.head(a.S);
            A.glow(ctx, h.x, h.y + 20, 40 + charge * 90, "#ff7a1a", 0.35 + charge * 0.4);
          });
          a.sfx(0.2, "charge");
          a.once(1.7, () => {
            XM.Audio.sfx("pop");
            const h = a.head(a.S);
            XM.FX.smoke(h.x, h.y - 20, 3, "#6a6a6a");
            XM.FX.spawn(XM.FX.T.GLOW, h.x, h.y - 30, a.S.facing * 160, -90, 1.2, 8, "#ff7a1a");
          });
          a.sfx(2.0, "rimshot");
          a.say("...It works on missions.", 2.3, 4.0);
        },
      },
    ],

    // ===================== GAMBIT =====================
    gambit: [
      {
        name: "Card Up the Rear",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const n = a.find("wolverine", "cyclops") || a.near();
          if (n) a.faceTo(n);
          a.state = within(t, 0.2, 0.6) ? "attack" : "idle";
          a.kind = "throw";
          a.prog = seg(t, 0.2, 0.6);
          if (n) {
            a.front((ctx) => {
              if (!within(t, 0.4, 1.0)) return;
              const k = seg(t, 0.4, 1.0);
              const h = a.hand(a.S);
              const tx = n.x - n.facing * 10;
              const ty = n.y - 40;
              card(ctx, U.lerp(h.x, tx, k), U.lerp(h.y, ty, k) - sin(k * PI) * 40, t * 20);
            });
            a.once(1.0, () => {
              XM.Audio.sfx("blast");
              XM.FX.burst(n.x - n.facing * 10, n.y - 40, { count: 14, colors: ["#ff4fb3", "#ffffff"], speed: 200, life: 0.4 });
            });
            a.react(n, "scared", 1.0, 2.2, "YEOWCH!");
          }
          a.sfx(0.4, "card");
          a.pose((p) => {
            if (t > 1.5) {
              p.armF = [0.9, -1.2];
              p.armB = [-0.9, 1.2];
              p.headTilt = -0.1;
            }
          });
          a.say("Card slipped, mon ami.", 1.6, 3.4);
        },
      },
      {
        name: "Fancy Shuffle",
        dur: 4.2,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            p.armF = [1.4, 0.5];
            p.armB = [1.4, 0.2];
            if (t > 2.4) P.armsUp(p);
          });
          a.front((ctx) => {
            if (t > 2.4) return;
            const x0 = a.S.x + a.S.facing * 14;
            const x1 = a.S.x + a.S.facing * 40;
            const y = a.S.y - 66;
            for (let i = 0; i < 10; i++) {
              const k = (t * 2.2 + i / 10) % 1;
              card(ctx, U.lerp(x0, x1, k), y - sin(k * PI) * 34, k * 6, false, 0.8);
            }
          });
          a.every(0.15, 0.2, 2.4, () => XM.Audio.sfx("card"));
          a.sfx(2.4, "scratch");
          a.once(2.4, () => XM.FX.burst(a.S.x + a.S.facing * 26, a.S.y - 90, { count: 40, colors: ["#fff5fb", "#c4161c", "#1a1a1a"], speed: 320, life: 1.4, type: XM.FX.T.SHARD, grav: 500, size: 5 }));
          a.say("Watch dis.", 0.2, 1.6);
          a.say("...52 card pickup, anyone?", 2.8, 4.2);
        },
      },
      {
        name: "House of Cards",
        dur: 4.6,
        run(a) {
          const t = a.t;
          const sooty = t > 2.6;
          a.filter = sooty ? "brightness(0.45)" : "";
          a.pose((p) => {
            if (t < 1.9) {
              p.armF = [0.9, 0.6 + sin(t * 8) * 0.2];
              p.lean = 0.25;
            }
          });
          a.front((ctx) => {
            if (t > 2.6) return;
            const bx = a.S.x + a.S.facing * 46;
            const by = a.S.y;
            const rows = [0.3, 0.9, 1.5].filter((tt) => t > tt).length;
            const charged = t > 2.0;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < 3 - r; c++) {
                const x = bx + (c - (2 - r) / 2) * 14;
                const y = by - 12 - r * 22;
                ctx.save();
                ctx.translate(x, y);
                if (charged) A.glow(ctx, 0, 0, 14, "#ff4fb3", 0.4 + 0.3 * sin(t * 20));
                A.poly(ctx, [-7, 11, 0, -11, 7, 11], "#fff5fb", true, 1.5);
                ctx.restore();
              }
            }
          });
          [0.3, 0.9, 1.5].forEach((tt) => a.sfx(tt, "card"));
          a.sfx(2.0, "charge");
          a.once(2.6, () => {
            XM.Audio.sfx("explosion");
            XM.FX.shake(8, 0.4);
            XM.FX.burst(a.S.x + a.S.facing * 46, a.S.y - 30, { count: 30, colors: ["#ff4fb3", "#ffd23f", "#ffffff"], speed: 340, life: 0.6 });
            XM.FX.smoke(a.S.x + a.S.facing * 30, a.S.y - 50, 10, "#3a3a3a");
          });
          a.say("Steady... steady...", 0.4, 1.9);
          a.say("Note to self: don't charge de house.", 3.0, 4.6);
        },
      },
      {
        name: "Staff Twirl",
        dur: 3.8,
        run(a) {
          const t = a.t;
          const twirl = within(t, 0.3, 2.0);
          a.look = { pal: a.baseLook.pal, flags: Object.assign({}, a.baseLook.flags, { staff: !twirl && t < 2.0 }) };
          a.pose((p) => {
            p.armF = twirl ? [1.6, 0.3] : t > 2.0 && t < 2.3 ? [2.6, 2.3] : p.armF;
          });
          a.front((ctx) => {
            if (!twirl && !within(t, 2.0, 2.25)) return;
            const h = a.hand(a.S);
            const ang = twirl ? t * 22 : -PI / 2;
            const L = 46;
            A.limb(ctx, h.x - cos(ang) * L / 2, h.y - sin(ang) * L / 2, h.x + cos(ang) * L / 2, h.y + sin(ang) * L / 2, 3, "#9aa0ab");
            if (twirl) {
              ctx.strokeStyle = "rgba(255,255,255,0.3)";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(h.x, h.y, L / 2, 0, PI * 2);
              ctx.stroke();
            }
          });
          a.every(0.3, 0.3, 2.0, () => XM.Audio.sfx("dodge"));
          a.sfx(2.05, "punch");
          a.sfx(2.15, "boing");
          if (t > 2.1) {
            a.stars(a.S);
            a.body.rot = sin(t * 6) * 0.12;
          }
          a.say("Ow. Dat happens.", 2.4, 3.8);
        },
      },
      {
        name: "A Rose for You",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const n = a.find("storm", "jean") || a.near();
          if (n) a.faceTo(n);
          const wilt = seg(t, 2.0, 2.6);
          a.pose((p) => {
            p.armF = [1.7 - wilt * 0.9, 0.2];
            p.lean = 0.15 - wilt * 0.3;
            p.headTilt = wilt * 0.35;
          });
          a.front((ctx) => {
            const h = a.hand(a.S);
            const x = h.x + a.S.facing * 6;
            const y = h.y;
            const ang = -PI / 2 + a.S.facing * wilt * 1.6;
            const tx = x + cos(ang) * 16;
            const ty = y + sin(ang) * 16;
            A.limb(ctx, x, y, tx, ty, 2, "#3a8a3a", false);
            A.circle(ctx, tx, ty, 5, wilt > 0.5 ? "#7a2a3a" : "#e0262c", true, 1.5);
          });
          a.once(0.6, () => {
            const h = a.head(a.S);
            XM.FX.spawn(XM.FX.T.STAR, h.x + a.S.facing * 8, h.y - 4, 0, -20, 0.6, 7, "#ffffff");
          });
          a.say("Bonjour, chère.", 0.4, 1.8);
          if (n) a.react(n, "unimpressed", 1.8, 1.8, n.id === "storm" || n.id === "jean" ? "Nice try, Remy." : "...Why me?");
          a.sfx(2.1, "slideDown");
        },
      },
      {
        name: "Kinetic Tap Dance",
        dur: 4.0,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            const s = sin(t * 14);
            p.legF = [0.3 + s * 0.4, 0.3 + max(0, s) * 0.8];
            p.legB = [-0.3 - s * 0.4, 0.3 + max(0, -s) * 0.8];
            p.armF = [2.6 + sin(t * 30) * 0.08, 0];
            p.armB = [2.4 + cos(t * 30) * 0.08, 0];
            p.bob = -abs(s) * 3;
            if (t > 3.0) {
              p.armF = [2.2, 0];
              p.armB = [2.0, 0];
            }
          });
          a.every(0.11, 0.2, 3.0, () => {
            XM.Audio.sfx("pop");
            XM.FX.burst(a.S.x + U.rand(-12, 12), a.S.y - 2, { count: 3, colors: ["#ff4fb3", "#ffffff"], speed: 120, life: 0.3, angle: -PI / 2, spread: 1.6 });
          });
          a.sfx(3.0, "tada");
          a.say("Kinetic tap!", 3.0, 4.0);
        },
      },
      {
        name: "Magic Trick",
        dur: 4.2,
        run(a) {
          const t = a.t;
          a.pose((p) => {
            if (t < 1.1) p.armF = [-0.3, 1.0];
            else if (t < 3.0) p.armF = [2.6, 0.2];
          });
          a.front((ctx) => {
            if (t < 1.1) return;
            const h = a.hand(a.S);
            const flyK = seg(t, 3.0, 4.0);
            const x = U.lerp(h.x, h.x - a.S.facing * 220, flyK);
            const y = U.lerp(h.y - 14, h.y - 260, flyK);
            chicken(ctx, x, y, sin(t * (t > 3 ? 40 : 18)));
          });
          a.sfx(1.1, "tada");
          a.sfx(1.4, "honk");
          a.sfx(3.0, "honk");
          a.every(0.08, 3.0, 4.0, () => {
            const h = a.hand(a.S);
            const k = seg(a.t, 3.0, 4.0);
            XM.FX.spawn(XM.FX.T.SHARD, U.lerp(h.x, h.x - a.S.facing * 220, k), U.lerp(h.y - 14, h.y - 260, k), U.rand(-60, 60), U.rand(20, 80), 0.8, 3, "#ffffff");
          });
          a.say("Ta-da! A rabbit!", 0.3, 1.2);
          a.say("...Dat is not de rabbit.", 1.6, 3.0);
        },
      },
      {
        name: "Snake Eyes",
        dur: 3.8,
        run(a) {
          const t = a.t;
          a.state = within(t, 0.2, 0.5) ? "attack" : "idle";
          a.kind = "throw";
          a.prog = seg(t, 0.2, 0.5);
          a.pose((p) => {
            if (t > 1.3) {
              P.crossed(p);
              p.headTilt = 0.25;
            }
          });
          a.front((ctx) => {
            if (t < 0.4 || t > 2.0) return;
            const k = smooth(seg(t, 0.4, 1.2));
            for (let i = 0; i < 2; i++) {
              const x = a.S.x + a.S.facing * (30 + k * 60 + i * 20);
              const y = a.S.y - 7 - abs(sin(k * PI * 3)) * 20 * (1 - k);
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate((1 - k) * 8 * (i ? 1 : -1));
              if (t > 1.7) A.glow(ctx, 0, 0, 14, "#ff4fb3", 0.6 + 0.3 * sin(t * 40));
              A.box(ctx, -7, -7, 14, 14, "#fafafa", true, 2, 1.5);
              ctx.fillStyle = "#c4161c";
              ctx.beginPath();
              ctx.arc(0, 0, 2.2, 0, PI * 2);
              ctx.fill();
              ctx.restore();
            }
          });
          a.every(0.2, 0.5, 1.2, () => XM.Audio.sfx("step"));
          a.once(2.0, () => {
            XM.Audio.sfx("pop");
            XM.FX.burst(a.S.x + a.S.facing * 100, a.S.y - 8, { count: 14, colors: ["#ff4fb3", "#ffffff"], speed: 180, life: 0.4 });
          });
          a.say("Snake eyes. Typical.", 2.3, 3.8);
        },
      },
      {
        name: "Cajun Two-Step",
        dur: 4.2,
        run(a) {
          const t = a.t;
          a.body.dx = sin(t * 4.5) * 22 * hold(t, 0.2, 0.4, 3.8, 4.1);
          a.pose((p) => {
            const s = sin(t * 9);
            p.legF = [0.35 * s, 0.3];
            p.legB = [-0.35 * s, 0.3];
            p.armF = [1.8 + 0.3 * s, 1.4];
            p.armB = [1.6 - 0.3 * s, 1.5];
            p.bob = -abs(s) * 3;
          });
          notes(a, a.S.x, a.S.y - 150, 0.3, 3.8, 0.24);
          for (const o of a.others()) a.react(o, "danceAlong", 1.0, 2.8);
          a.say("Laissez les bons temps rouler!", 0.5, 2.4);
        },
      },
      {
        name: "Dramatic Coat",
        dur: 4.0,
        run(a) {
          const t = a.t;
          const windy = t < 1.8;
          a.speed = windy ? 520 : 0;
          a.vy = windy ? -350 : 0;
          a.pose((p) => {
            if (windy) {
              p.armF = [2.5, 0.05];
              p.lean = -0.05;
              p.legF = [0.4, 0.15];
              p.legB = [-0.4, 0.1];
            } else {
              p.armF = [0.3, 0.3];
              p.armB = [-0.3, 0.3];
            }
          });
          a.sfx(0.1, "wind");
          a.sfx(1.8, "splat");
          a.front((ctx) => {
            if (t < 1.6) {
              if (t > 1.2) {
                const k = seg(t, 1.2, 1.8);
                const h = a.head(a.S);
                A.ellipse(ctx, U.lerp(h.x + 200 * -a.S.facing, h.x, k), U.lerp(h.y - 60, h.y, k), 9, 6, t * 8, "#5aba4a", true, 1.5);
              }
              return;
            }
            const h = a.head(a.S);
            A.ellipse(ctx, h.x + a.S.facing * 3, h.y, 11, 8, 0.3, "#5aba4a", true, 1.5);
            ctx.strokeStyle = "#2a6a2a";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(h.x - 6, h.y - 3);
            ctx.lineTo(h.x + 9, h.y + 3);
            ctx.stroke();
          });
          a.say("De wind is with Gambit!", 0.2, 1.5);
          a.say("...Dis is still a good look.", 2.2, 4.0);
        },
      },
    ],
  };

  // ======================================================================
  // Reactions: what a teammate does when they get pranked.
  // ======================================================================
  const REACT = {
    zapped(a) {
      const t = a.t;
      a.filter = "brightness(0.35)";
      a.pose((p) => {
        p.armF = [1.4, 0.1];
        p.armB = [-1.3, 0.1];
        p.legF = [0.4, 0.1];
        p.legB = [-0.4, 0.1];
      });
      a.body.dx = t < 0.5 ? U.rand(-3, 3) : 0;
      a.every(0.2, 0, a.dur, () => {
        const h = a.head(a.S);
        XM.FX.smoke(h.x, h.y - 10, 1, "#4a4a4a");
      });
      a.front((ctx) => {
        const h = a.head(a.S);
        ctx.strokeStyle = "#2a2a2a";
        ctx.lineWidth = 2;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(h.x + i * 4, h.y - 12);
          ctx.lineTo(h.x + i * 6 + U.rand(-2, 2), h.y - 26 - abs(i) * -1);
          ctx.stroke();
        }
      });
    },
    frozen(a) {
      a.pose((p) => {
        P.crossed(p);
        p.headTilt = 0.1;
      });
      a.body.dx = a.t > a.dur - 0.6 ? sin(a.t * 60) * 2 : 0;
      a.front((ctx) => {
        const top = a.S.y - (a.S.hh + 8) * a.S.sc;
        ctx.fillStyle = "rgba(190,240,255,0.45)";
        A.roundRect(ctx, a.S.x - 26 * a.S.sc / 1.7 - 6, top, 52 * a.S.sc / 1.7 + 12, a.S.y - top + 2, 8);
        ctx.fill();
        ctx.strokeStyle = "#e8fbff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.moveTo(a.S.x - 20, top + 10);
        ctx.lineTo(a.S.x - 8, top + 40);
        ctx.stroke();
      });
    },
    stinky(a) {
      a.pose((p) => P.noseHold(p));
      a.body.dx = -a.S.facing * 6 * seg(a.t, 0, 0.3);
      a.front((ctx) => {
        const h = a.head(a.S);
        ctx.strokeStyle = A.rgba(GAS, 0.8);
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          for (let y = 0; y < 26; y += 3) ctx.lineTo(h.x - 14 + i * 14 + sin(y / 4 + a.t * 8) * 3, h.y - 16 - y);
          ctx.stroke();
        }
      });
    },
    puppet(a) {
      const t = a.t;
      const up = hold(t, 0, 0.4, a.dur - 0.4, a.dur - 0.1);
      a.body.dy = -55 * up;
      a.body.rot = sin(t * 5) * 0.2 * up;
      a.body.pivot = 30;
      a.power = up * 0.5;
      a.pose((p) => P.dance(p, t, 12));
      a.back((ctx) => A.glow(ctx, a.S.x, a.S.y - 60 + a.body.dy, 70, "#7fd0ff", 0.4 * up));
      a.sfx(a.dur - 0.1, "boing");
    },
    flip(a) {
      const t = a.t;
      const up = hold(t, 0, 0.5, a.dur - 0.4, a.dur - 0.1);
      a.body.dy = -60 * up;
      a.body.pivot = 32;
      a.body.rot = PI * smooth(seg(t, 0, 0.5)) * (1 - smooth(seg(t, a.dur - 0.5, a.dur - 0.2)));
      a.body.dx = sin(t * 2) * 6 * up;
      a.power = up * 0.5;
      a.pose((p) => P.flail(p, t * 0.5));
      a.back((ctx) => A.glow(ctx, a.S.x, a.S.y - 60 + a.body.dy, 70, "#ff6ad5", 0.35 * up));
      a.sfx(a.dur - 0.1, "boing");
    },
    scared(a) {
      const t = a.t;
      a.body.dy = -bell(t, 0, 0.6) * 50;
      a.pose((p) => {
        p.armF = [2.0, 0.5];
        p.armB = [-0.6, 2.2];
        if (t < 0.6) {
          p.grounded = false;
          p.legF = [0.8, 1.4];
        }
      });
      a.sfx(0, "slide");
    },
    blinded(a) {
      a.pose((p) => P.shield(p));
      a.body.dx = sin(a.t * 5) * 6;
    },
    asleep(a) {
      a.pose((p) => P.sleep(p, a.t));
      zzz(a, a.S.x, a.S.y - a.S.hh * a.S.sc - 10, 0.2, a.dur, 0.8);
    },
    blown(a) {
      const k = hold(a.t, 0, 0.15, a.dur - 0.3, a.dur);
      a.body.dx = -a.S.facing * 10 * k;
      a.speed = 400 * k;
      a.pose((p) => {
        p.lean = -0.35 * k;
        p.armF = [1.2, 0.2];
        p.armB = [2.4, 0.2];
      });
    },
    cringe(a) {
      a.pose((p) => {
        p.armF = [2.3, 2.1];
        p.lean = -0.1;
        p.headTilt = 0.3;
      });
    },
    chase(a) {
      const target = a.data.dot ? a.data.dot() : a.S.x;
      const x = a.S.x + a.body.dx;
      if (!a.mem.dx) a.mem.dx = 0;
      const want = clamp(target - a.S.x, -200, 200);
      a.mem.dx = U.approach(a.mem.dx, want, 4.5);
      const back = seg(a.t, a.dur - 0.6, a.dur);
      a.body.dx = a.mem.dx * (1 - back);
      a.facing = target > x ? 1 : -1;
      a.state = a.t < a.dur - 0.6 ? "run" : "idle";
      a.phase = a.t * 14;
      a.speed = 260;
    },
    unimpressed(a) {
      a.pose((p) => {
        P.crossed(p);
        p.headTilt = 0.15;
      });
    },
    danceAlong(a) {
      a.pose((p) => P.dance(p, a.t + a.S.i, 8));
    },
    slap(a) {
      const t = a.t;
      const ph = (t % 0.5) / 0.5;
      a.pose((p) => {
        p.armF = [1.4 + ph * 0.9, 1.6 + ph * 0.6];
        p.headTilt = ph > 0.8 ? -0.3 : 0;
      });
      a.every(0.5, 0.4, a.dur, () => {
        XM.Audio.sfx("punch");
        const h = a.head(a.S);
        XM.FX.burst(h.x, h.y, { count: 4, color: "#ffffff", speed: 120, life: 0.2 });
      });
    },
    ears(a) {
      a.pose((p) => P.ears(p));
      a.body.dx = sin(a.t * 18) * 1.5;
    },
    bonk(a) {
      a.body.rot = -a.S.facing * 0.25 * bell(a.t, 0, a.dur);
      a.body.pivot = 0;
      a.pose((p) => (p.headTilt = -0.4 * bell(a.t, 0, a.dur)));
    },
  };

  // ======================================================================
  class MenuAntics {
    constructor() {
      this.active = {};
      this.reactions = {};
      this.order = {};
      this.t = 0;
      this.clicked = false;
      this.slotsCache = [];
    }

    slots(showAll) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      return IDS.map((id, i) => {
        const ch = XM.CHAR[id];
        const hh = id === "professorx" ? 62 : ch.body.legs + ch.body.torso + ch.body.head * 2 + 2;
        return { id, i, ch, x: vw * 0.56 + i * Math.min(80, vw * 0.07), y: vh - 40 - (i % 2) * 18, sc: SCALE, facing: -1, hh, visible: showAll || XM.Save.char(id).unlocked };
      });
    }

    hit(x, y) {
      let best = null;
      let bd = 1e9;
      for (const s of this.slotsCache) {
        if (!s.visible) continue;
        const half = (s.id === "professorx" ? 22 : 16) * s.sc;
        if (abs(x - s.x) > half || y < s.y - (s.hh + 12) * s.sc || y > s.y + 8) continue;
        const d = abs(x - s.x);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    }

    trigger(slot) {
      const cur = this.active[slot.id];
      if (cur && cur.t < 0.6) return;
      let ord = this.order[slot.id];
      if (!ord || !ord.length) {
        ord = ANTICS[slot.id].map((_, i) => i).sort(() => Math.random() - 0.5);
        if (this.lastIdx && this.lastIdx[slot.id] === ord[ord.length - 1]) ord.unshift(ord.pop());
        this.order[slot.id] = ord;
      }
      const idx = ord.pop();
      this.lastIdx = this.lastIdx || {};
      this.lastIdx[slot.id] = idx;
      this.active[slot.id] = { def: ANTICS[slot.id][idx], t: 0, fired: new Set(), mem: {} };
      delete this.reactions[slot.id];
      this.clicked = true;
      XM.Audio.sfx("ui");
    }

    // Called from an antic: a teammate starts a reaction (unless busy with their own antic).
    setReaction(id, kind, dur, text, data) {
      if (this.active[id]) return;
      this.reactions[id] = { kind, t: 0, dur, text, data: data || {}, fired: new Set(), mem: {} };
    }

    update(dt) {
      this.t += dt;
      for (const id of Object.keys(this.active)) {
        const a = this.active[id];
        a.t += dt;
        if (a.t >= a.def.dur) delete this.active[id];
      }
      for (const id of Object.keys(this.reactions)) {
        const r = this.reactions[id];
        r.t += dt;
        if (r.t >= r.dur) delete this.reactions[id];
      }
    }

    reset() {
      this.active = {};
      this.reactions = {};
    }

    // Builds the helper object an antic or reaction uses for one frame.
    helper(inst, S, slots, bubbles, ctx) {
      const self = this;
      let key = 0;
      const a = {
        t: inst.t,
        dur: inst.def ? inst.def.dur : inst.dur,
        S,
        id: S.id,
        mem: inst.mem,
        data: inst.data || {},
        state: "idle",
        kind: null,
        prog: 0,
        phase: 0,
        power: 0,
        speed: 0,
        vy: 0,
        facing: S.facing,
        body: { dx: 0, dy: 0, rot: 0, pivot: 0, sx: 1, sy: 1, alpha: 1, flip: false },
        filter: "",
        look: null,
        baseLook: XM.Outfits.current(S.id),
        poseFn: null,
        backs: [],
        fronts: [],
        ctx,
        pose(fn) {
          const prev = a.poseFn;
          a.poseFn = prev ? (p, an) => (prev(p, an), fn(p, an)) : fn;
        },
        back(fn) {
          a.backs.push(fn);
        },
        front(fn) {
          a.fronts.push(fn);
        },
        once(time, fn) {
          const k = "o" + key++;
          if (a.t >= time && !inst.fired.has(k)) {
            inst.fired.add(k);
            fn();
          }
        },
        every(period, from, to, fn) {
          const k = "e" + key++;
          if (a.t < from || a.t > to) return;
          const n = Math.floor((a.t - from) / period);
          const last = inst.mem[k] === undefined ? -1 : inst.mem[k];
          if (n > last) {
            inst.mem[k] = n;
            fn();
          }
        },
        sfx(time, name, opts) {
          a.once(time, () => XM.Audio.sfx(name, opts));
        },
        say(text, from, to, who) {
          if (within(a.t, from, to)) bubbles.push({ S: who || S, text, think: false, body: who ? null : a.body });
        },
        think(text, from, to, who) {
          if (within(a.t, from, to)) bubbles.push({ S: who || S, text, think: true });
        },
        others() {
          return slots.filter((s) => s.visible && s.id !== S.id);
        },
        find(...ids) {
          for (const id of ids) {
            const s = slots.find((o) => o.id === id && o.visible && o.id !== S.id);
            if (s) return s;
          }
          return null;
        },
        near() {
          let best = null;
          for (const s of a.others()) if (!best || abs(s.x - S.x) < abs(best.x - S.x)) best = s;
          return best;
        },
        faceTo(o) {
          a.facing = o.x > S.x ? 1 : -1;
        },
        react(o, kind, at, dur, text, data) {
          a.once(at, () => self.setReaction(o.id, kind, dur, text, data));
        },
        head(o) {
          const isMe = o === S;
          const dx = isMe ? a.body.dx : 0;
          const dy = isMe ? a.body.dy : 0;
          const f = isMe ? a.facing : o.facing;
          const r = o.id === "professorx" ? 9 : o.ch.body.head;
          return { x: o.x + dx + f * 3 * o.sc, y: o.y + dy - (o.hh - r) * o.sc };
        },
        hand(o) {
          const isMe = o === S;
          const dx = isMe ? a.body.dx : 0;
          const dy = isMe ? a.body.dy : 0;
          const f = isMe ? a.facing : o.facing;
          if (o.id === "professorx") return { x: o.x + dx + f * 16 * o.sc, y: o.y + dy - 40 * o.sc };
          return { x: o.x + dx + f * 18 * o.sc, y: o.y + dy - (o.ch.body.legs + o.ch.body.torso * 0.6) * o.sc };
        },
        stars(o) {
          a.front((c) => {
            const h = a.head(o);
            for (let i = 0; i < 3; i++) {
              const ang = self.t * 6 + (i * PI * 2) / 3;
              A.text(c, "★", h.x + cos(ang) * 18, h.y - 22 + sin(ang) * 5, 13, "#ffe14a", "center", false);
            }
          });
        },
      };
      return a;
    }

    draw(ctx, showAll) {
      const slots = this.slots(showAll);
      this.slotsCache = slots;
      const bubbles = [];
      for (const S of slots) {
        if (!S.visible) continue;
        const look = XM.Outfits.current(S.id);
        const act = this.active[S.id];
        const re = !act && this.reactions[S.id];
        let a = null;
        if (act) {
          a = this.helper(act, S, slots, bubbles, ctx);
          act.def.run(a);
        } else if (re) {
          a = this.helper(re, S, slots, bubbles, ctx);
          REACT[re.kind](a);
          if (re.text && re.t > re.dur * 0.35) bubbles.push({ S, text: re.text, think: false, body: a.body });
        }
        if (!a) {
          XM.CharArt.draw(ctx, S.id, look, { state: "idle", t: this.t + S.i, hd: true }, S.x, S.y, S.facing, S.sc);
          continue;
        }
        for (const fn of a.backs) fn(ctx);
        const b = a.body;
        ctx.save();
        if (a.filter) ctx.filter = a.filter;
        const piv = b.pivot * S.sc;
        ctx.translate(S.x + b.dx, S.y + b.dy - piv);
        ctx.rotate(b.rot);
        ctx.scale(b.sx, b.sy);
        ctx.translate(0, piv);
        const facing = a.facing * (b.flip ? -1 : 1);
        const an = { state: a.state, t: a.state === "idle" ? this.t + S.i : a.t, phase: a.phase, kind: a.kind, prog: a.prog, power: a.power, speed: a.speed, vy: a.vy, hd: true, pose: a.poseFn };
        XM.CharArt.draw(ctx, S.id, a.look || look, an, 0, 0, facing, S.sc, b.alpha);
        ctx.restore();
        for (const fn of a.fronts) fn(ctx);
      }
      for (const bb of bubbles) this.bubble(ctx, bb);
      if (!this.clicked) {
        const vis = slots.filter((s) => s.visible);
        if (vis.length) {
          const cx = (vis[0].x + vis[vis.length - 1].x) / 2;
          ctx.globalAlpha = 0.55 + 0.35 * sin(this.t * 3);
          A.text(ctx, XM.Input.usingTouch ? "Psst... tap the X-Men!" : "Psst... click the X-Men!", cx, XM.VIEW.h - 10, 13, "#ffe14a", "center");
          ctx.globalAlpha = 1;
        }
      }
    }

    bubble(ctx, b) {
      const S = b.S;
      const dx = b.body ? b.body.dx : 0;
      const dy = b.body ? Math.max(-200, b.body.dy) : 0;
      const hx = S.x + dx;
      const hy = S.y + dy - S.hh * S.sc - 14;
      ctx.font = '700 14px Oxanium, "Trebuchet MS", sans-serif';
      const lines = U.wrap(ctx, b.text, 170);
      const w = Math.min(190, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 22);
      const h = lines.length * 18 + 12;
      const bx = clamp(hx - w / 2, 8, XM.VIEW.w - w - 8);
      const by = Math.max(8, hy - h - 12);
      if (b.think) {
        A.circle(ctx, hx + 4, by + h + 6, 5, "#ffffff", true, 2);
        A.circle(ctx, hx - 2, by + h + 14, 3, "#ffffff", true, 1.5);
        A.box(ctx, bx, by, w, h, "#ffffff", true, h / 2, 2.5);
      } else {
        A.box(ctx, bx, by, w, h, "#ffffff", true, 8, 2.5);
        const tx = clamp(hx, bx + 12, bx + w - 12);
        A.poly(ctx, [tx - 7, by + h - 1, tx + 7, by + h - 1, tx + 2, by + h + 11], "#ffffff", false);
        ctx.strokeStyle = A.OUTLINE;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(tx - 7, by + h);
        ctx.lineTo(tx + 2, by + h + 11);
        ctx.lineTo(tx + 7, by + h);
        ctx.stroke();
      }
      lines.forEach((ln, i) => A.text(ctx, ln, bx + w / 2, by + 15 + i * 18, 14, "#140d1f", "center", false, 700));
    }
  }

  XM.MenuAntics = MenuAntics;
  XM.MENU_ANTICS = ANTICS;
})(window.XM);
