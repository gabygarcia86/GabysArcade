/*
 * The main menu's easter eggs: click or tap Mando or Baby G.
 *
 * An antic has a length, cues that each fire once at their time, and a pose that's worked
 * out afresh every frame from how far through it is. Each one ends back at rest.
 */
(function (MQ) {
  const { clamp, lerp, smooth, rand, glow, oval, poly, box, line, text, wrap } = MQ.U;
  const { sin, cos, abs, min, max, round, PI } = Math;
  const TAU = MQ.TAU;
  const INK = MQ.INK;

  const HERO = { x: 260, y: 600, scale: 3.5, middle: -160, rx: 120, ry: 185 };
  const CHILD = { x: 500, y: 452, scale: 2.1, middle: -12, rx: 90, ry: 92 };
  const BEHIND = [195, 462]; // Where the trouble comes out.
  const GAS = "#a6d94c";
  const BLEND = 0.2; // Easing out of an interrupted antic.
  const LOCK = 0.6; // An antic gets this long before a click can replace it.
  const BUBBLE_TIME = 1.9;
  const MAX_BITS = 170;

  // Rises from a to b, stays up, and falls from c to d.
  const during = (t, a, b, c, d) => smooth((t - a) / (b - a)) * (1 - smooth((t - c) / (d - c)));
  const through = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  // A jolt at a that shakes itself out.
  const wobble = (t, a, seconds = 0.6) => (t < a || t > a + seconds ? 0 : sin((t - a) * 34) * (1 - (t - a) / seconds));
  // Up and back down again.
  const arc = (t, a, b) => sin(through(t, a, b) * PI);
  const wholeTurn = (angle) => Math.atan2(sin(angle), cos(angle));

  /* ---------- Props ---------- */

  function discoBall(ctx, t, drop, calm) {
    const y = lerp(-70, 120, drop);
    line(ctx, 340, 0, 340, y, "#8b949e", 3);
    const colors = ["#ff4fd8", "#58d6ff", "#ffd45c", "#7dffb2"];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7 + t * (calm ? 0.2 : 1.1);
      glow(ctx, 340 + cos(a) * 190, 400 + sin(a) * 120, 110, colors[i], 0.4 * drop);
    }
    oval(ctx, 340, y, 42, 42, "#9aa6b4", INK, 3);
    ctx.save();
    ctx.beginPath();
    ctx.arc(340, y, 40, 0, TAU);
    ctx.clip();
    for (let row = -3; row < 3; row++) {
      for (let col = -4; col < 4; col++) {
        const shift = (t * 30) % 28;
        const color = (row * 3 + col + 20) % 5 === 0 ? colors[(col + 4) % 4] : (row + col) & 1 ? "#d5dde6" : "#6d7883";
        box(ctx, 340 + col * 14 + shift, y + row * 14, 11, 11, 2, color);
      }
    }
    ctx.restore();
  }

  function frog(ctx, x, y, kick) {
    for (const side of [-1, 1]) line(ctx, x + side * 10, y + 6, x + side * 24, y + 14 + kick * side * 8, "#3f8f5a", 6);
    oval(ctx, x, y, 19, 14, "#58b873", INK, 2.5);
    for (const side of [-1, 1]) {
      oval(ctx, x + side * 9, y - 12, 7, 7, "#d9f5c8", INK, 2);
      oval(ctx, x + side * 9, y - 12, 3, 3, INK);
    }
    line(ctx, x - 7, y + 3, x + 7, y + 3, INK, 2);
  }

  function banana(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    poly(ctx, [-28, 4, -12, -8, -4, -20, 4, -20, 10, -8, 28, 4, 8, 0, 0, 8, -8, 0], "#ffd93d", INK, 2.5);
    line(ctx, 0, -19, 0, -25, "#6b4a2a", 4);
    ctx.restore();
  }

  function dizzyStars(ctx, x, y, t, opacity) {
    ctx.globalAlpha = opacity;
    for (let i = 0; i < 4; i++) {
      const a = t * 5 + (i * TAU) / 4;
      const sx = x + cos(a) * 62;
      const sy = y + sin(a) * 16;
      poly(ctx, [sx, sy - 11, sx + 4, sy - 3, sx + 12, sy, sx + 4, sy + 3, sx, sy + 11, sx - 4, sy + 3, sx - 12, sy, sx - 4, sy - 3], "#ffd45c", INK, 1.5);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Mando's antics. m is Mando, b is Baby G. ---------- */

  const MANDO = [
    {
      id: "classicFart",
      length: 4.2,
      cues: [
        [0.2, (s) => s.say("mando", "Hang on...", 0.7)],
        [0.95, (s) => {
          s.sfx("fart");
          s.gas(16);
          s.word("PFFFRRRT!", 185, 400, GAS);
          s.shake(5);
        }],
        [1.7, (s) => {
          s.say("mando", "This is the way.");
          s.sfx("babyWorry");
        }],
        [2.2, (s) => s.gas(5, 420, 420, 45)],
      ],
      pose(t, m, b) {
        const squat = during(t, 0.2, 0.8, 1.4, 1.8);
        const push = during(t, 0.85, 0.95, 1.4, 1.6);
        m.crouch = squat * 13;
        m.lean = squat * 0.4;
        m.head = -squat * 0.2;
        m.dx = push * sin(t * 70) * 5;
        m.flow = push;
        const disgust = during(t, 1.4, 1.9, 3.5, 4.1);
        if (disgust > 0.2) b.mood = "worried";
        b.dx = disgust * 55;
        b.dy = -disgust * 35;
        b.rot = disgust * (0.18 + sin(t * 22) * 0.06);
        b.ears = disgust * 0.25;
      },
    },
    {
      id: "squeaker",
      length: 4.3,
      cues: [
        [0.6, (s) => {
          s.sfx("fartSqueak");
          s.gas(5, ...BEHIND, 40);
          s.word("pweeeee?", 180, 420, GAS, 38);
        }],
        [2.0, (s) => {
          s.say("mando", "It was the kid.");
          s.sfx("babyWorry");
        }],
      ],
      pose(t, m, b) {
        const tiptoe = during(t, 0.3, 0.6, 1.1, 1.3);
        m.dy = -tiptoe * 16;
        m.crouch = -tiptoe * 3;
        m.head = -tiptoe * 0.3;
        // Checks whether anyone noticed.
        if ((t > 1.2 && t < 1.5) || (t > 1.65 && t < 1.85)) m.face = -1;
        if (t > 1.9 && t < 3.8) {
          m.weapon = null;
          m.action = "point";
          b.mood = "sad";
          b.rot = sin(t * 9) * 0.08;
        }
      },
    },
    {
      id: "rocketFart",
      length: 5,
      cues: [
        [0.1, (s) => {
          s.sfx("rumble");
          s.say("mando", "Uh-oh.", 0.9);
        }],
        [1.15, (s) => {
          s.sfx("fartBig");
          s.gas(34, 230, 520, 190);
          s.word("BRRRAAAAP!", 270, 400, GAS, 72);
          s.shake(16);
        }],
        [1.4, (s) => s.gas(10, 250, 430, 70)],
        [1.7, (s) => s.sfx("slideDown")],
        [2.9, (s) => {
          s.sfx("bonk");
          s.dust(260, 598);
          s.shake(10);
        }],
        [3.4, (s) => s.say("mando", "Who needs a jetpack?")],
      ],
      pose(t, m, b) {
        if (t < 1.15) {
          const build = through(t, 0, 1.15);
          m.crouch = build * 14;
          m.lean = build * 0.35;
          m.dx = sin(t * 75) * 6 * build;
          if (t > 0.6) b.mood = "worried";
        } else if (t < 2.9) {
          const high = arc(t, 1.15, 2.9);
          m.dy = -high * 520;
          m.rot = smooth(through(t, 1.15, 2.9)) * TAU * 2;
          m.anim = "fall";
          m.action = null;
          m.flow = 1;
          b.mood = "worried";
          b.rot = -high * 0.2;
        } else {
          const squash = during(t, 2.9, 2.97, 3.1, 3.5);
          m.sy = 1 - squash * 0.3;
          m.sx = 1 + squash * 0.25;
          if (t < 4.6) b.mood = "happy";
        }
      },
      front(ctx, t) {
        if (t > 3 && t < 4.6) dizzyStars(ctx, 270, 250, t, during(t, 3, 3.2, 4.2, 4.6));
      },
    },
    {
      id: "tootTune",
      length: 4.4,
      cues: [
        ...[0.3, 0.75, 1.05, 1.35, 1.8, 2.3].map((at, i) => [at, (s) => {
          s.sfx(`fartNote${[1, 2, 2, 3, 2, 4][i]}`);
          s.gas(4, ...BEHIND, 50);
          s.note(170 + i * 22, 400 - i * 12);
        }]),
        [2.9, (s) => {
          s.say("mando", "Thank you. I'll be here all week.");
          s.sfx("babyHappy");
        }],
      ],
      pose(t, m, b) {
        const playing = during(t, 0.15, 0.35, 2.5, 2.8);
        m.crouch = playing * (5 + sin(t * 14) * 5);
        m.lean = playing * (0.2 + sin(t * 7) * 0.12);
        b.rot = playing * sin(t * 7) * 0.22;
        b.dy = -playing * abs(sin(t * 7)) * 18;
        if (t > 0.6 && t < 3.8) b.mood = "happy";
        const bow = during(t, 2.8, 3.1, 3.7, 4.2);
        m.lean += bow * 0.55;
      },
    },
    {
      id: "disco",
      length: 5.2,
      cues: [
        [0.3, (s) => s.sfx("disco")],
        [2.2, (s) => s.sfx("disco")],
        [2.4, (s) => s.say("mando", "Dank farrik, I've got moves.")],
      ],
      pose(t, m, b) {
        if (t < 0.35 || t > 4.7) return;
        const beat = Math.floor(t * 3.6);
        m.weapon = null;
        m.action = null;
        m.hands = beat % 2 ? [20, -26, -12, 22] : [6, 22, 22, 12];
        m.face = beat % 8 < 4 ? 1 : -1;
        m.crouch = abs(sin(t * 11.3)) * 7;
        m.lean = sin(t * 11.3) * 0.2;
        m.flow = abs(sin(t * 5.6));
        b.mood = "happy";
        b.rot = sin(t * 11.3) * 0.28;
        b.dy = -abs(sin(t * 11.3)) * 22;
      },
      back(ctx, t, scene) {
        discoBall(ctx, t, during(t, 0, 0.45, 4.6, 5.2), scene.calm);
      },
    },
    {
      id: "jetpackMishap",
      length: 4.7,
      cues: [
        [0.15, (s) => s.say("mando", "Watch this, kid.", 0.8)],
        [0.8, (s) => {
          s.sfx("jetStart");
          s.dust(230, 595);
        }],
        ...[1.2, 1.5, 1.8, 2.1].map((at) => [at, (s) => s.sfx("jetpack")]),
        [2.4, (s) => {
          s.sfx("jetStop");
          s.word("put... put...", 280, 190, "#d5dde6", 36);
        }],
        [3.0, (s) => {
          s.sfx("bonk");
          s.dust(260, 598);
          s.shake(8);
        }],
        [3.35, (s) => {
          s.say("mando", "I meant to do that.");
          s.sfx("babyHappy");
        }],
      ],
      pose(t, m, b) {
        if (t < 0.8) {
          m.crouch = through(t, 0.2, 0.8) * 10;
        } else if (t < 3) {
          const k = through(t, 0.8, 3);
          m.dx = sin(k * TAU) * 120;
          m.dy = -sin(k * PI) * 250;
          m.rot = smooth(k) * TAU;
          m.anim = "fly";
          m.action = null;
          m.thrust = t < 2.4 ? 1 : 0;
          m.flow = 0.8;
          b.rot = -sin(k * TAU) * 0.15;
        } else {
          m.crouch = (1 - through(t, 3, 3.5)) * 16;
          if (t < 4.3) b.mood = "happy";
        }
      },
    },
    {
      id: "helmetSpin",
      length: 4.1,
      cues: [
        [0.2, (s) => s.say("mando", "Ah... ah...", 0.8)],
        [1.1, (s) => {
          s.sfx("sneeze");
          s.word("CHOO!", 360, 260, "#9fe8ff");
          s.shake(6);
        }],
        [1.35, (s) => s.sfx("spin")],
        [2.7, (s) => s.say("mando", "The helmet stays on.")],
      ],
      pose(t, m, b) {
        const windup = during(t, 0.2, 1.0, 1.06, 1.15);
        const recoil = during(t, 1.08, 1.16, 1.3, 1.7);
        m.lean = -windup * 0.35 + recoil * 0.55;
        m.head = -windup * 0.4 + smooth(through(t, 1.2, 2.5)) * TAU * 3;
        if (t > 1.1 && t < 2.6) b.mood = "worried";
      },
      front(ctx, t) {
        if (t > 2.4 && t < 3.8) dizzyStars(ctx, 270, 240, t, during(t, 2.4, 2.6, 3.4, 3.8));
      },
    },
    {
      id: "bubbleBlaster",
      length: 4.4,
      cues: [
        [0.2, (s) => s.say("mando", "Stand back. This is dangerous.", 0.9)],
        ...[1.2, 1.5, 1.8, 2.1].map((at) => [at, (s) => {
          s.sfx("bubble");
          s.bubbles(4, 395, 405);
        }]),
        [2.7, (s) => {
          s.say("mando", "Who loaded this with soap?");
          s.sfx("babyHappy");
        }],
      ],
      pose(t, m, b) {
        if (t > 0.4 && t < 3.9) {
          m.action = "aim";
          m.k = t > 1.2 && t < 2.3 ? ((t - 1.2) / 0.3) % 1 : 0;
        }
        if (t > 1.5 && t < 3.9) {
          b.mood = "happy";
          b.dy = -during(t, 1.5, 1.9, 3.3, 3.9) * (25 + sin(t * 8) * 10);
        }
      },
    },
    {
      id: "bananaSlip",
      length: 4.4,
      cues: [
        [0.75, (s) => s.sfx("slideUp")],
        [1.5, (s) => {
          s.sfx("bonk");
          s.dust(260, 598);
          s.word("WHUMP!", 280, 420, "#ffd45c");
          s.shake(9);
        }],
        [1.75, (s) => {
          s.sfx("fartSqueak");
          s.gas(6, 280, 570, 60);
        }],
        [2.2, (s) => s.say("mando", "Nobody saw that.")],
        [2.3, (s) => s.sfx("babyHappy")],
      ],
      pose(t, m, b) {
        if (t > 0.2 && t < 0.75) {
          m.anim = "walk";
          m.phase = t * 12;
        } else if (t >= 0.75 && t < 1.5) {
          m.anim = "fall";
          m.action = null;
        }
        const slip = during(t, 0.75, 1.3, 2.8, 3.6);
        m.rot = -slip * 1.5;
        m.dy = -arc(t, 0.75, 1.5) * 110 + slip * 110;
        m.dx = slip * 20;
        if (t > 1.5 && t < 3.9) b.mood = "happy";
      },
      front(ctx, t) {
        if (t > 3) return;
        const flying = through(t, 0.75, 1.7);
        banana(ctx, 300 + flying * 330, 598 - sin(flying * PI) * 230 + max(0, t - 1.7) * 300, flying * 9);
      },
    },
  ];

  /* ---------- Baby G's antics ---------- */

  const BABY = [
    {
      id: "zoomies",
      length: 3.9,
      cues: [
        [0.2, (s) => {
          s.sfx("babyHappy");
          s.word("wheeee!", 480, 300, "#8fdcff", 44);
        }],
        ...[0.5, 1.4, 2.3].map((at) => [at, (s) => s.sfx("slideUp")]),
        [2.9, (s) => s.say("mando", "I'm getting dizzy just watching.")],
      ],
      pose(t, m, b) {
        const lap = smooth(through(t, 0.2, 3.1)) * TAU * 3;
        const wide = during(t, 0.2, 0.6, 2.7, 3.2);
        b.dx = lerp(0, -240 + cos(lap) * 260, wide);
        b.dy = sin(lap) * 90 * wide;
        b.rot = -sin(lap) * 0.4 * wide;
        b.behind = wide > 0.3 && sin(lap) < 0;
        if (t > 0.2 && t < 3.6) b.mood = "happy";
        if (wide > 0.3) m.face = cos(lap) < 0 ? -1 : 1;
      },
    },
    {
      id: "forceLift",
      length: 5,
      cues: [
        [0.2, (s) => s.sfx("forcePush")],
        [1.2, (s) => s.say("mando", "Kid. Put me down.", 1.4, 490)],
        [3.3, (s) => s.sfx("slideDown")],
        [3.8, (s) => {
          s.sfx("bonk");
          s.dust(260, 598);
          s.shake(8);
        }],
        [4.1, (s) => s.sfx("babyHappy")],
      ],
      pose(t, m, b) {
        const held = during(t, 0.3, 1.2, 3.3, 3.8);
        m.dy = -held * 200;
        m.rot = held * PI;
        m.flow = held;
        if (held > 0.05) {
          m.anim = "run";
          m.phase = t * 24; // Legs going nowhere.
          m.action = null;
        }
        if (t < 3.6) b.mood = "force";
        else if (t < 4.7) b.mood = "happy";
        if (t > 0.1 && t < 3.8) b.sx = -1; // Turned toward Mando.
        b.dy = -during(t, 0.2, 0.6, 3.2, 3.8) * 20;
      },
      back(ctx, t) {
        const held = during(t, 0.3, 1.2, 3.1, 3.6);
        glow(ctx, 260, 400 - held * 200, 190, "#7fd4ff", held * 0.6);
      },
    },
    {
      id: "frogSnack",
      length: 4.7,
      cues: [
        [0.4, (s) => s.sfx("ribbit")],
        [1.6, (s) => {
          s.sfx("gulp");
          s.word("GULP!", 500, 330, "#8fdcff", 44);
        }],
        [2.7, (s) => {
          s.sfx("burp");
          s.word("BUUURP!", 470, 320, GAS, 64);
          s.gas(8, 500, 420, 70);
          s.shake(6);
        }],
        [3.1, (s) => s.say("mando", "That was somebody's pet.")],
      ],
      pose(t, m, b) {
        if (t < 1.2) b.mood = "force";
        else if (t < 2.1) b.mood = "happy";
        else if (t < 2.7) b.mood = "worried"; // Here it comes.
        else if (t < 4.2) b.mood = "happy";
        const full = during(t, 1.6, 1.8, 2.6, 2.8);
        b.sx = 1 + full * 0.22 + wobble(t, 2.7) * 0.1;
        b.sy = 1 - full * 0.12 - wobble(t, 2.7) * 0.1;
        m.lean = -during(t, 2.7, 2.9, 3.6, 4.3) * 0.4;
      },
      front(ctx, t) {
        if (t > 1.6) return;
        const k = smooth(through(t, 0.7, 1.6));
        const x = lerp(590, 500, k);
        const y = lerp(530, 420, k) - sin(k * PI) * 130;
        glow(ctx, x, y, 45, "#7fd4ff", during(t, 0.6, 0.8, 1.5, 1.6));
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1 - k * 0.5, 1 - k * 0.5);
        frog(ctx, 0, 0, sin(t * 25));
        ctx.restore();
      },
    },
    {
      id: "hiccups",
      length: 4.1,
      cues: [
        ...[0.4, 1.1, 1.8, 2.5].map((at, i) => [at, (s) => {
          s.sfx("hiccup");
          s.word(i === 3 ? "HIC!!!" : "hic!", i % 2 ? 560 : 440, 340 - i * 12, "#8fdcff", 32 + i * 14);
          s.bubbles(2 + i * 3, 520, 410);
          if (i === 3) s.shake(8);
        }]),
        [3.0, (s) => s.say("mando", "Try holding your breath.")],
      ],
      pose(t, m, b) {
        let jump = 0;
        [0.4, 1.1, 1.8, 2.5].forEach((at, i) => (jump += arc(t, at, at + 0.5) * (25 + i * 35)));
        b.dy = -jump;
        b.rot = sin(t * 18) * min(0.25, jump / 300);
        if (t > 0.4 && t < 3.6) b.mood = jump > 5 ? "worried" : "idle";
      },
    },
    {
      id: "forceSneeze",
      length: 4.3,
      cues: [
        [0.2, (s) => s.say("baby", "ah... ah...", 0.8)],
        [1.1, (s) => {
          s.sfx("sneezeSmall");
          s.sfx("forcePush");
          s.ring(470, 430);
          s.word("CHOO!", 420, 340, "#7fd4ff", 64);
          s.shake(12);
        }],
        [2.7, (s) => s.say("mando", "Bless you.")],
      ],
      pose(t, m, b) {
        const windup = during(t, 0.2, 1.0, 1.05, 1.12);
        b.sy = 1 + windup * 0.15;
        b.dy = -windup * 20 - arc(t, 1.1, 2.6) * 90;
        b.dx = during(t, 1.1, 1.5, 2, 2.8) * 85;
        b.rot = smooth(through(t, 1.1, 2.4)) * TAU * 2;
        if (t > 0.2 && t < 1.1) b.mood = "worried";
        else if (t > 2.6 && t < 3.9) b.mood = "happy";
        const blown = during(t, 1.12, 1.3, 1.6, 2.5);
        m.lean = -blown * 0.5;
        m.dx = -blown * 45;
        m.flow = blown;
        m.head = wobble(t, 1.15, 1.2) * 0.5;
      },
    },
    {
      id: "buttonMasher",
      length: 4.1,
      cues: [
        ...[0.2, 0.4, 0.6, 0.8].map((at, i) => [at, (s) => {
          s.sfx("beep");
          s.word("beep", [420, 570, 470, 600][i], [345, 330, 285, 270][i], "#6ee7ff", 30);
        }]),
        [1.1, (s) => s.sfx("spin")],
        [1.5, (s) => s.say("mando", "Don't touch the buttons!")],
        [3.0, (s) => s.sfx("babyHappy")],
      ],
      pose(t, m, b) {
        const wild = during(t, 1, 1.3, 2.5, 3);
        b.dx = sin(t * 11) * 70 * wild;
        b.dy = cos(t * 8) * 50 * wild;
        b.rot = smooth(through(t, 1, 2.9)) * TAU * 3;
        if (t < 1) b.sx = 1 + abs(sin(t * 16)) * 0.06;
        if (t < 3.8) b.mood = "happy";
        if (t > 1.5 && t < 3) {
          m.weapon = null;
          m.action = "point";
        }
      },
    },
    {
      id: "earFlight",
      length: 5.3,
      cues: [
        ...[0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4].map((at) => [at, (s) => s.sfx("flap")]),
        [0.5, (s) => s.word("flap flap flap", 480, 330, "#a8d88a", 36)],
        [3.7, (s) => s.say("mando", "That's not how ears work.", 1.5)],
      ],
      pose(t, m, b) {
        const up = during(t, 0.3, 1.5, 2.8, 4.2);
        const flapping = during(t, 0.15, 0.35, 3.6, 4.1);
        b.ears = sin(t * 24) * 0.75 * flapping;
        b.dy = -up * (210 + sin(t * 12) * 14);
        b.dx = sin(t * 2.2) * up * 50;
        b.rot = sin(t * 6) * up * 0.15;
        if (t < 4.1) b.mood = "happy";
        m.head = -up * 0.4;
      },
    },
    {
      id: "tinyToot",
      length: 4.3,
      cues: [
        [0.8, (s) => {
          s.sfx("fartTiny");
          s.gas(7, 500, 505, 60);
          s.word("poot.", 520, 350, GAS, 46);
        }],
        [1.3, (s) => s.sfx("babyHappy")],
        [1.8, (s) => s.say("mando", "...I taught you that, didn't I?")],
      ],
      pose(t, m, b) {
        if (t < 0.8) b.mood = "sleep"; // Eyes shut, concentrating very hard.
        else if (t < 3.9) b.mood = "happy";
        b.dx = t < 0.8 ? sin(t * 60) * 3 : 0;
        b.dy = -arc(t, 0.8, 1.5) * 75;
        b.rot = wobble(t, 0.8, 0.9) * 0.15;
        const smell = during(t, 1.2, 1.6, 2.8, 3.6);
        m.lean = -smell * 0.3;
        m.head = smell * sin(t * 12) * 0.15;
      },
    },
    {
      id: "powerNap",
      length: 4.8,
      cues: [
        ...[0.6, 1.7].map((at) => [at, (s) => {
          s.sfx("snore");
          s.word("Z z z", 530, 340, "#b9c8ff", 40);
        }]),
        [2.9, (s) => {
          s.sfx("pop");
          s.bubbles(6, 515, 425);
          s.word("!", 500, 320, "#ffd45c", 80);
        }],
        [3.3, (s) => s.sfx("babyWorry")],
      ],
      pose(t, m, b) {
        if (t < 2.9) {
          const doze = through(t, 0, 0.6);
          b.mood = "sleep";
          b.rot = doze * (0.25 + sin(t * 2.8) * 0.06);
          b.ears = doze * 0.3;
        } else if (t < 4.3) {
          b.mood = "worried";
          b.dy = -arc(t, 2.9, 3.6) * 120;
        }
      },
      front(ctx, t) {
        if (t < 0.5 || t > 2.9) return;
        const r = (6 + abs(sin(t * 2.6)) * 18) * (0.6 + through(t, 0.5, 2.9) * 0.8);
        oval(ctx, 518 + r, 428, r, r, "rgba(170,225,255,0.4)", "#cfefff", 2.5);
      },
    },
  ];

  /* ---------- Running them ---------- */

  const restMando = () => ({
    dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, lean: 0, head: 0, crouch: 0, thrust: 0, flow: 0,
    face: 1, anim: "idle", action: "hold", weapon: "blaster", k: 0, phase: 0, hands: null,
  });
  const restBaby = (mood) => ({ dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, ears: 0, mood, behind: false });

  // Eases the numbers in to from where they were in from.
  function blend(to, from, k) {
    for (const key of ["dx", "dy", "sx", "sy", "lean", "head", "crouch", "flow", "ears", "rot"]) {
      if (!(key in to)) continue;
      const start = key === "rot" || key === "head" ? wholeTurn(from[key]) : from[key];
      const end = key === "rot" || key === "head" ? wholeTurn(to[key]) : to[key];
      to[key] = lerp(start, end, k);
    }
  }

  class MenuAntics {
    /* settings is a function, as resetting progress replaces the save. */
    constructor(look, audio, settings) {
      this.look = look;
      this.audio = audio;
      this.settings = settings;
      this.motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      this.pose = MQ.Anim.createPose();
      this.actor = {};
      this.bags = { mando: [], baby: [] };
      this.played = { mando: null, baby: null };
      this.clock = 0;
      this.stop();
    }

    get calm() {
      return !!this.motion?.matches;
    }

    stop() {
      this.antic = null;
      this.t = 0;
      this.cue = 0;
      this.cues = [];
      this.from = null;
      this.blendTime = 0;
      this.jolt = 0;
      this.bits = [];
      this.words = [];
      this.bubble = null;
      this.mando = restMando();
      this.baby = restBaby("idle");
    }

    /* ---------- Starting one ---------- */

    // The character at this point of the 1280x720 scene, or null.
    hit(x, y) {
      const inside = (home, state) => {
        const dx = x - home.x - state.dx;
        const dy = y - home.y - home.middle - state.dy;
        const across = dx * cos(state.rot) + dy * sin(state.rot);
        const down = -dx * sin(state.rot) + dy * cos(state.rot);
        return (across / home.rx) ** 2 + (down / home.ry) ** 2 <= 1;
      };
      const child = inside(CHILD, this.baby);
      const hero = inside(HERO, this.mando);
      if (child && !(hero && this.baby.behind)) return "baby";
      return hero ? "mando" : null;
    }

    poke(who) {
      if (this.antic && this.t < LOCK) return false;
      this.play(this.choose(who));
      return true;
    }

    // Every antic once, in a new order each round. Mando's first is always the classic.
    choose(who) {
      const list = who === "mando" ? MANDO : BABY;
      const bag = this.bags[who];
      const last = this.played[who];
      if (!bag.length) {
        bag.push(...list);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // The next is taken from the end.
        const end = bag.length - 1;
        const wanted = who === "mando" && !last ? bag.indexOf(MANDO[0]) : bag[end] === last ? 0 : end;
        [bag[wanted], bag[end]] = [bag[end], bag[wanted]];
      }
      this.played[who] = bag.pop();
      return this.played[who];
    }

    play(antic) {
      if (this.antic) {
        this.from = { mando: { ...this.mando }, baby: { ...this.baby } };
        this.blendTime = BLEND;
        this.bubble = null;
        this.words.length = 0;
      }
      this.antic = antic;
      this.t = 0;
      this.cue = 0;
      this.cues = [...antic.cues].sort((a, b) => a[0] - b[0]);
    }

    /* ---------- What cues can do ---------- */

    sfx(name) {
      this.audio.sfx(name);
    }

    shake(amount) {
      if (!this.calm && this.settings().shake) this.jolt = amount;
    }

    // below is the bubble's top, for when the speaker is above it.
    say(who, words, life = BUBBLE_TIME, below = 0) {
      this.bubble = { who, words, life, below, age: 0 };
    }

    word(words, x, y, color, size = 54) {
      this.words.push({ words, x, y, color, size, age: 0, tilt: rand(-0.18, 0.12) });
    }

    emit(kind, x, y, vx, vy, size, life, color) {
      if (this.bits.length >= MAX_BITS) this.bits.shift();
      this.bits.push({ kind, x, y, vx, vy, size, life, full: life, color });
    }

    amount(n) {
      return this.settings().effects === "low" ? Math.ceil(n / 2) : n;
    }

    gas(n, x = BEHIND[0], y = BEHIND[1], speed = 100) {
      for (let i = this.amount(n); i--;) {
        this.emit("puff", x + rand(-8, 8), y + rand(-8, 8), rand(-speed * 1.3, speed * 0.5), rand(-speed * 0.8, speed * 0.1), rand(14, 30), rand(1.2, 2.2), i % 3 ? GAS : "#d4e87a");
      }
    }

    dust(x, y) {
      for (let i = this.amount(12); i--;) this.emit("puff", x + rand(-30, 30), y, rand(-160, 160), rand(-70, -10), rand(10, 20), rand(0.5, 0.9), "#b59c7c");
    }

    bubbles(n, x, y) {
      for (let i = this.amount(n); i--;) this.emit("bubble", x, y, rand(20, 150), rand(-130, 10), rand(9, 22), rand(1, 2), "#cfefff");
    }

    note(x, y) {
      this.emit("note", x, y, rand(-20, 30), -100, 18, 1.6, "#ffd45c");
    }

    ring(x, y) {
      this.emit("ring", x, y, 0, 0, 260, 0.7, "#7fd4ff");
    }

    /* ---------- Each frame ---------- */

    update(time, idleMood) {
      const elapsed = time - this.clock;
      this.clock = time;
      // The scene isn't drawn during a game, so start afresh on coming back.
      if (elapsed < 0 || elapsed > 0.5) this.stop();
      const dt = clamp(elapsed, 0, 0.1);

      if (this.antic) {
        this.t += dt;
        while (this.cue < this.cues.length && this.cues[this.cue][0] <= this.t) this.cues[this.cue++][1](this);
        if (this.t >= this.antic.length) this.antic = null;
      }

      const mando = restMando();
      const baby = restBaby(this.antic ? "idle" : idleMood);
      this.antic?.pose(this.t, mando, baby);
      if (this.calm) {
        for (const state of [mando, baby]) {
          state.dx *= 0.15;
          state.dy *= 0.15;
          state.rot = 0;
        }
        mando.head = clamp(mando.head, -0.4, 0.4);
      }
      if (this.blendTime > 0) {
        this.blendTime = max(0, this.blendTime - dt);
        const k = smooth(1 - this.blendTime / BLEND);
        blend(mando, this.from.mando, k);
        blend(baby, this.from.baby, k);
      }
      this.mando = mando;
      this.baby = baby;

      this.jolt = max(0, this.jolt - dt * 22);
      for (const bit of this.bits) {
        bit.life -= dt;
        bit.x += bit.vx * dt;
        bit.y += bit.vy * dt;
        if (bit.kind === "puff") {
          const drag = max(0, 1 - dt * 1.4);
          bit.vx *= drag;
          bit.vy = bit.vy * drag - 25 * dt;
        }
      }
      this.bits = this.bits.filter((bit) => bit.life > 0);
      for (const word of this.words) word.age += dt;
      this.words = this.words.filter((word) => word.age < 1.3);
      if (this.bubble && (this.bubble.age += dt) > this.bubble.life) this.bubble = null;
    }

    draw(ctx, time, textScale) {
      ctx.save();
      if (this.jolt) ctx.translate(sin(time * 71) * this.jolt, sin(time * 53) * this.jolt * 0.7);
      this.antic?.back?.(ctx, this.t, this);
      if (this.baby.behind) this.drawBaby(ctx, time);
      this.drawMando(ctx, time);
      if (!this.baby.behind) this.drawBaby(ctx, time);
      this.antic?.front?.(ctx, this.t, this);
      this.drawBits(ctx);
      this.drawWords(ctx, textScale);
      if (this.bubble) this.drawBubble(ctx, textScale);
      ctx.restore();
    }

    drawMando(ctx, time) {
      const m = this.mando;
      const { pose, actor } = this;
      MQ.Anim.human(pose, m.anim, time, m.phase, 0.6, m.action, m.k, 0, 0);
      pose.lean += m.lean;
      pose.head += m.head;
      pose.hip += m.crouch;
      if (m.hands) [pose.hfx, pose.hfy, pose.hbx, pose.hby] = m.hands;

      actor.look = this.look();
      actor.pose = pose;
      actor.time = time;
      actor.flow = 0.12 + sin(time) * 0.08 + m.flow * 0.7;
      actor.lift = m.anim === "fall" ? -0.2 : 0;
      actor.jetpack = true;
      actor.thrust = m.thrust;
      actor.weapon = m.weapon;

      ctx.save();
      ctx.translate(HERO.x + m.dx, HERO.y + m.dy);
      if (m.rot) {
        ctx.translate(0, HERO.middle);
        ctx.rotate(m.rot);
        ctx.translate(0, -HERO.middle);
      }
      ctx.scale(HERO.scale * m.sx * m.face, HERO.scale * m.sy);
      MQ.CharacterArt.mando(ctx, actor);
      ctx.restore();
    }

    drawBaby(ctx, time) {
      const b = this.baby;
      ctx.save();
      ctx.translate(CHILD.x + b.dx, CHILD.y + b.dy + sin(time * 2.4) * 7);
      if (b.rot) ctx.rotate(b.rot);
      ctx.scale(CHILD.scale * b.sx, CHILD.scale * b.sy);
      MQ.CharacterArt.baby(ctx, b.mood, time, { pram: true, power: b.mood === "force" ? 0.6 : 0, ears: b.ears });
      ctx.restore();
    }

    drawBits(ctx) {
      for (const { kind, x, y, size, life, full, color } of this.bits) {
        const k = 1 - life / full;
        ctx.globalAlpha = 1 - k;
        if (kind === "puff") {
          ctx.globalAlpha = (1 - k) * 0.55;
          const r = size * (1 + k * 1.8);
          oval(ctx, x, y, r, r * 0.8, color);
          oval(ctx, x - r * 0.5, y + r * 0.2, r * 0.6, r * 0.55, color);
        } else if (kind === "bubble") {
          oval(ctx, x, y, size, size, "rgba(180,230,255,0.2)", color, 2);
          oval(ctx, x - size * 0.35, y - size * 0.35, size * 0.2, size * 0.2, "#ffffff");
        } else if (kind === "note") {
          oval(ctx, x, y, 11, 8, color, INK, 1.5);
          line(ctx, x + 9, y, x + 9, y - 34, color, 4);
          line(ctx, x + 9, y - 34, x + 22, y - 26, color, 4);
        } else {
          oval(ctx, x, y, 20 + k * size, 20 + k * size, null, color, 10 * (1 - k) + 1);
        }
      }
      ctx.globalAlpha = 1;
    }

    drawWords(ctx, textScale) {
      ctx.lineJoin = "round";
      for (const { words, x, y, color, size, age, tilt } of this.words) {
        const fontSize = round(size * min(textScale, 1.25));
        ctx.font = `800 ${fontSize}px ${MQ.FONT}`;
        const half = ctx.measureText(words).width / 2;
        ctx.save();
        ctx.globalAlpha = min(1, (1.3 - age) * 2.5);
        ctx.translate(clamp(x, half + 14, max(half + 14, 636 - half)), y - age * 55);
        ctx.rotate(tilt);
        const pop = 0.6 + smooth(age * 7) * 0.4;
        ctx.scale(pop, pop);
        ctx.lineWidth = 8;
        ctx.strokeStyle = INK;
        ctx.textAlign = "center";
        ctx.strokeText(words, 0, 0);
        text(ctx, words, 0, 0, fontSize, color, "center", 800);
        ctx.restore();
      }
    }

    // Kept in the sky over the pair, left of the menu.
    drawBubble(ctx, textScale) {
      const { who, words, life, below, age } = this.bubble;
      const size = round(26 * textScale);
      const row = round(size * 1.2);
      ctx.font = `700 ${size}px ${MQ.FONT}`;
      const lines = wrap(ctx, words, 540);
      let width = 0;
      for (const value of lines) width = max(width, ctx.measureText(value).width);
      width += 40;
      const height = lines.length * row + 22;
      const anchor = who === "mando" ? 290 : 500;
      const middle = clamp(anchor, width / 2 + 16, 632 - width / 2);
      const bottom = below ? below + height : who === "mando" ? 232 : 340;
      const point = clamp(anchor, middle - width / 2 + 34, middle + width / 2 - 34);

      ctx.save();
      ctx.globalAlpha = min(1, age * 9, (life - age) * 6);
      box(ctx, middle - width / 2, bottom - height, width, height, 16, "#f4f7fb", INK, 3);
      // The tail points at whoever is talking.
      const edge = below || bottom;
      const away = below ? -1 : 1;
      poly(ctx, [point - 14, edge - away * 2, point + 14, edge - away * 2, point - 2, edge + away * 20], "#f4f7fb");
      line(ctx, point - 14, edge, point - 2, edge + away * 20, INK, 3);
      line(ctx, point + 14, edge, point - 2, edge + away * 20, INK, 3);
      lines.forEach((value, i) => text(ctx, value, middle, bottom - height + 9 + row * (i + 0.85), size, INK, "center", 700));
      ctx.restore();
    }
  }

  MenuAntics.LISTS = { mando: MANDO, baby: BABY };
  MQ.MenuAntics = MenuAntics;
})(window.MQ);
