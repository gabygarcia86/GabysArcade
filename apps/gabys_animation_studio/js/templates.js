/* Starter animations. Each template draws its frames with code into a normal project, so
 * everything stays editable: drawings on the drawing layer, scenery on the background layer,
 * plus stickers, effects, text and sounds as separate objects. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { Layer, ctxOf, model } = GAS;
  const OUT = "#2b2340";
  const TAU = Math.PI * 2;
  const W = 480, H = 360;

  /* ---------- drawing helpers ---------- */
  function shape(ctx, fill, lw = 4) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
  }
  function circle(ctx, x, y, r, fill, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); shape(ctx, fill, lw); }
  function ellipse(ctx, x, y, rx, ry, fill, lw, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); shape(ctx, fill, lw); }
  function line(ctx, pts, lw = 6, color = OUT) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }
  function starPts(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }
  function eye(ctx, x, y, r, lookX = 0, lookY = 0) {
    circle(ctx, x, y, r, "#fff", 3);
    circle(ctx, x + lookX * r * 0.4, y + lookY * r * 0.4, r * 0.5, OUT, 0);
    circle(ctx, x + lookX * r * 0.4 + r * 0.18, y + lookY * r * 0.4 - r * 0.18, r * 0.16, "#fff", 0);
  }

  function setup(p, n) {
    p.frames = [];
    for (let i = 0; i < n; i++) p.frames.push(model.newFrame(p));
    return p.frames;
  }
  function draw(frame, fn) {
    const ctx = ctxOf(frame.draw.canvas);
    ctx.save();
    fn(ctx);
    ctx.restore();
    Layer.touch(frame.draw);
  }
  function drawBg(p, fn) {
    const ctx = ctxOf(p.bgLayer.canvas);
    ctx.save();
    fn(ctx);
    ctx.restore();
    Layer.touch(p.bgLayer);
  }
  const sticker = (key, x, y, size, extra) => model.baseObject("sticker", { key, x, y, w: size, h: size, ...extra });
  const effect = (kind, x, y, extra) => Object.assign(GAS.effects.create(kind, x, y), { seed: 7 }, extra || {});
  const text = (t, x, y, extra) => {
    const o = model.baseObject("text", { ...GAS.state.textDefaults, text: t, x, y, ...extra });
    GAS.render.fitText(o);
    return o;
  };
  const sound = (id, volume = 1) => ({ ref: "builtin:" + id, volume });

  function ground(ctx, y, color = "#7bd389", edge = "#57b26a") {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, W, H - y);
    line(ctx, [[0, y], [W, y]], 4, edge);
  }
  function cloud(ctx, x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 18 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + 22 * s, y - 14 * s, 20 * s, Math.PI, Math.PI * 1.9);
    ctx.arc(x + 48 * s, y - 6 * s, 18 * s, Math.PI * 1.3, Math.PI * 0.5);
    ctx.closePath();
    shape(ctx, "#fff", 3);
  }

  /* ---------- the templates ---------- */
  const LIST = [
    {
      id: "ball", title: "Bouncing Ball", desc: "A squishy ball that bounces up and down.", fps: 12,
      build(p) {
        p.bgFill = { type: "gradient", color: "#9bd7ff", color2: "#eaf8ff", angle: 180 };
        drawBg(p, (c) => { ground(c, 300); cloud(c, 60, 70, 1); cloud(c, 330, 110, 0.8); });
        const fr = setup(p, 12);
        fr.forEach((f, i) => {
          const t = i / 12;
          const hgt = 210 * 4 * t * (1 - t);
          let sx = 1, sy = 1;
          if (i === 0) { sx = 1.35; sy = 0.68; }
          else if (i === 1 || i === 11) { sx = 0.86; sy = 1.18; }
          const r = 36;
          const cy = 300 - hgt - r * sy;
          draw(f, (c) => {
            ellipse(c, 240, 304, 44 * (1 - hgt / 420), 7 * (1 - hgt / 420), "rgba(0,0,0,0.18)", 0);
            ellipse(c, 240, cy, r * sx, r * sy, "#ef476f", 4);
            ellipse(c, 228, cy - 12 * sy, 10 * sx, 7 * sy, "rgba(255,255,255,0.75)", 0, -0.5);
          });
        });
        fr[0].sound = sound("boing", 0.8);
      },
    },
    {
      id: "smiley", title: "Smiley Face", desc: "A happy face that grins, winks and bounces.", fps: 6,
      build(p) {
        p.bgFill = { type: "gradient", color: "#ffd6ff", color2: "#c8b6ff", angle: 135, radial: true };
        const fr = setup(p, 8);
        fr.forEach((f, i) => {
          const s = 1 + 0.06 * Math.sin((i / 8) * TAU);
          const grin = 0.5 + 0.5 * Math.sin((i / 8) * TAU);
          const wink = i === 4 || i === 5;
          draw(f, (c) => {
            c.translate(240, 180);
            c.scale(s, s);
            circle(c, 0, 0, 110, "#ffd23f", 6);
            ellipse(c, -60, 40, 18, 11, "rgba(255,120,150,0.5)", 0);
            ellipse(c, 60, 40, 18, 11, "rgba(255,120,150,0.5)", 0);
            ellipse(c, -38, -28, 13, 20, OUT, 0);
            if (wink) line(c, [[24, -28], [38, -36], [52, -28]], 7);
            else ellipse(c, 38, -28, 13, 20, OUT, 0);
            c.beginPath();
            c.moveTo(-58, 28);
            c.quadraticCurveTo(0, 28 + 40 + grin * 40, 58, 28);
            if (grin > 0.6) { c.closePath(); shape(c, "#ff6b9a", 6); }
            else { c.lineWidth = 7; c.strokeStyle = OUT; c.lineCap = "round"; c.stroke(); }
          });
        });
        fr[4].sound = sound("pop", 0.7);
      },
    },
    {
      id: "walk", title: "Walking Stick Figure", desc: "A stick figure strolling across the screen.", fps: 10,
      build(p) {
        p.bgFill = { type: "color", color: "#fffdf2" };
        drawBg(p, (c) => ground(c, 300, "#f1e3c6", "#c9a66b"));
        const fr = setup(p, 16);
        fr.forEach((f, i) => {
          const ph = (i / 8) * TAU;
          const x = 50 + i * 24;
          const bob = -Math.abs(Math.sin(ph)) * 5;
          const hip = [x, 222 + bob], neck = [x, 160 + bob];
          const leg = (a, knee) => {
            const k = [hip[0] + Math.sin(a) * 40, hip[1] + Math.cos(a) * 40];
            const foot = [k[0] + Math.sin(a - knee) * 38, k[1] + Math.cos(a - knee) * 38];
            return [hip, k, foot];
          };
          const arm = (a) => {
            const sh = [neck[0], neck[1] + 10];
            const el = [sh[0] + Math.sin(a) * 30, sh[1] + Math.cos(a) * 30];
            return [sh, el, [el[0] + Math.sin(a + 0.5) * 26, el[1] + Math.cos(a + 0.5) * 26]];
          };
          const swing = Math.sin(ph) * 0.55;
          const kneeA = Math.max(0, Math.sin(ph + Math.PI / 2)) * 0.7, kneeB = Math.max(0, Math.sin(ph - Math.PI / 2)) * 0.7;
          draw(f, (c) => {
            line(c, arm(-swing * 0.9), 7, "#8d99ae");
            line(c, leg(-swing, kneeB), 8, "#8d99ae");
            line(c, [neck, hip], 8);
            line(c, leg(swing, kneeA), 8);
            line(c, arm(swing * 0.9), 7);
            circle(c, neck[0], neck[1] - 26, 24, "#fff", 6);
            circle(c, neck[0] + 9, neck[1] - 30, 3.5, OUT, 0);
            line(c, [[neck[0] + 4, neck[1] - 18], [neck[0] + 14, neck[1] - 20]], 3);
          });
        });
        fr[0].sound = sound("footsteps", 0.6);
        fr[8].sound = sound("footsteps", 0.6);
      },
    },
    {
      id: "wave", title: "Waving Character", desc: "A friendly blob says hi with a big wave.", fps: 8,
      build(p) {
        p.bgFill = { type: "gradient", color: "#caffbf", color2: "#9bf6ff", angle: 160 };
        const fr = setup(p, 6);
        const angles = [-0.2, 0.25, 0.65, 0.25, -0.2, -0.55];
        fr.forEach((f, i) => {
          draw(f, (c) => {
            // body
            c.beginPath();
            c.moveTo(170, 320); c.bezierCurveTo(150, 180, 190, 120, 240, 120); c.bezierCurveTo(290, 120, 330, 180, 310, 320); c.closePath();
            shape(c, "#9b5de5", 5);
            // left arm resting
            line(c, [[180, 220], [148, 270], [160, 292]], 14, OUT);
            line(c, [[180, 220], [148, 270], [160, 292]], 8, "#b388eb");
            // waving arm
            const a = angles[i];
            const sh = [300, 205];
            const el = [sh[0] + 46, sh[1] - 34];
            const hand = [el[0] + Math.sin(a) * 52, el[1] - Math.cos(a) * 52];
            line(c, [sh, el, hand], 14, OUT);
            line(c, [sh, el, hand], 8, "#b388eb");
            circle(c, hand[0], hand[1], 14, "#b388eb", 4);
            eye(c, 218, 180, 16, 0.3, -0.1);
            eye(c, 262, 180, 16, 0.3, -0.1);
            c.beginPath(); c.moveTo(214, 222); c.quadraticCurveTo(240, 252, 266, 222); c.closePath(); shape(c, "#ff6b9a", 4);
            if (i >= 1 && i <= 3) line(c, [[hand[0] + 24, hand[1] - 18], [hand[0] + 34, hand[1] - 24]], 4, "#ffffff");
          });
          f.objects.push(sticker("effects/speech", 130, 80, 140), text("Hi!", 128, 70, { size: 46, font: "Bangers", color: "#ef476f", outline: false }));
        });
        fr[0].sound = sound("tweet", 0.6);
      },
    },
    {
      id: "rocket", title: "Flying Rocket", desc: "Blast off into space past the stars!", fps: 12,
      build(p) {
        p.bgFill = { type: "gradient", color: "#0b0b2b", color2: "#3a1c71", angle: 180 };
        drawBg(p, (c) => {
          const R = GAS.rng(4);
          for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.4 + R() * 0.6})`; c.beginPath(); c.arc(R() * W, R() * H, R() * 1.8 + 0.4, 0, TAU); c.fill(); }
          circle(c, 400, 280, 50, "#f77f00", 4);
          c.beginPath(); c.ellipse(400, 285, 82, 16, -0.2, 0, TAU); c.lineWidth = 6; c.strokeStyle = "#ffd23f"; c.stroke();
        });
        const fr = setup(p, 12);
        fr.forEach((f, i) => {
          const t = i / 11;
          const x = 90 + t * 300, y = 290 - t * 250;
          draw(f, (c) => {
            for (let k = 1; k <= 4; k++) {
              const tt = Math.max(0, t - k * 0.06);
              circle(c, 90 + tt * 300 - 30, 290 - tt * 250 + 34, 10 + k * 3, `rgba(233,236,239,${0.9 - k * 0.18})`, 0);
            }
            c.translate(x, y);
            c.rotate(0.85);
            const flame = i % 2 ? 46 : 34;
            c.beginPath(); c.moveTo(-14, 40); c.quadraticCurveTo(0, 40 + flame * 1.4, 14, 40); c.closePath(); shape(c, "#ffb703", 3);
            c.beginPath(); c.moveTo(-7, 40); c.quadraticCurveTo(0, 40 + flame * 0.8, 7, 40); c.closePath(); shape(c, "#fff3b0", 0);
            c.beginPath(); c.moveTo(-20, 10); c.lineTo(-38, 40); c.lineTo(-18, 36); c.closePath(); shape(c, "#ef476f", 4);
            c.beginPath(); c.moveTo(20, 10); c.lineTo(38, 40); c.lineTo(18, 36); c.closePath(); shape(c, "#ef476f", 4);
            c.beginPath(); c.moveTo(0, -56); c.bezierCurveTo(26, -36, 26, 10, 20, 40); c.lineTo(-20, 40); c.bezierCurveTo(-26, 10, -26, -36, 0, -56); c.closePath(); shape(c, "#f1f1f8", 4);
            circle(c, 0, -14, 10, "#4cc9f0", 4);
          });
        });
        fr[0].sound = sound("whoosh", 0.9);
      },
    },
    {
      id: "frog", title: "Jumping Frog", desc: "A frog crouches, leaps and lands with a splash.", fps: 10,
      build(p) {
        p.bgFill = { type: "gradient", color: "#c7f9cc", color2: "#80ed99", angle: 180 };
        drawBg(p, (c) => {
          c.fillStyle = "#48cae4"; c.fillRect(0, 280, W, 80); line(c, [[0, 280], [W, 280]], 4, "#0096c7");
          ellipse(c, 110, 290, 70, 14, "#38b000", 4); ellipse(c, 370, 290, 70, 14, "#38b000", 4);
          for (const x of [20, 210, 450]) line(c, [[x, 280], [x - 6, 200]], 5, "#2d6a4f");
        });
        const fr = setup(p, 10);
        fr.forEach((f, i) => {
          let x = 110, y = 268, sq = 1, airborne = false;
          if (i === 0) sq = 1; else if (i === 1) sq = 0.75;
          else if (i >= 2 && i <= 7) { const t = (i - 1) / 7; x = 110 + t * 300; y = 268 - 180 * 4 * t * (1 - t); airborne = true; sq = 1.1; }
          else if (i === 8) { x = 370; sq = 0.72; } else { x = 370; sq = 1; }
          draw(f, (c) => {
            c.translate(x, y);
            if (airborne) {
              line(c, [[-20, 0], [-46, 30], [-62, 44]], 9, OUT); line(c, [[-20, 0], [-46, 30], [-62, 44]], 5, "#55a630");
              line(c, [[20, 0], [46, 30], [62, 44]], 9, OUT); line(c, [[20, 0], [46, 30], [62, 44]], 5, "#55a630");
            } else {
              ellipse(c, -30, -4, 18, 10 * sq, "#55a630", 4); ellipse(c, 30, -4, 18, 10 * sq, "#55a630", 4);
            }
            c.scale(1 / Math.sqrt(sq), sq);
            ellipse(c, 0, -26, 42, 30, "#70e000", 5);
            circle(c, -20, -54, 13, "#70e000", 4); circle(c, 20, -54, 13, "#70e000", 4);
            eye(c, -20, -55, 8, 0.4, 0); eye(c, 20, -55, 8, 0.4, 0);
            c.beginPath(); c.moveTo(-18, -24); c.quadraticCurveTo(0, airborne ? -6 : -14, 18, -24); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
          });
          if (i === 8) f.objects.push(effect("smoke", 370, 268, { w: 140, h: 80, color: "#caf0f8" }));
        });
        fr[2].sound = sound("jump", 0.8);
        fr[8].sound = sound("splat", 0.6);
      },
    },
    {
      id: "eyes", title: "Blinking Eyes", desc: "Big googly eyes that look around and blink.", fps: 8,
      build(p) {
        p.bgFill = { type: "gradient", color: "#ffafcc", color2: "#ffc8dd", angle: 180 };
        const fr = setup(p, 10);
        const looks = [[-1, 0], [-1, 0], [-1, -0.3], [0, 0], [1, 0], [1, 0.3], [0, 0], [0, 0], [0, 0], [0, 0]];
        const open = [1, 1, 1, 1, 1, 1, 0.45, 0, 0.45, 1];
        fr.forEach((f, i) => {
          draw(f, (c) => {
            for (const ex of [160, 320]) {
              const o = open[i];
              ellipse(c, ex, 180, 70, 80, "#fff", 6);
              if (o > 0) {
                c.save();
                c.beginPath(); c.ellipse(ex, 180, 70, 80 * o, 0, 0, TAU); c.clip();
                circle(c, ex + looks[i][0] * 28, 180 + looks[i][1] * 30, 32, "#3a86ff", 0);
                circle(c, ex + looks[i][0] * 28, 180 + looks[i][1] * 30, 18, OUT, 0);
                circle(c, ex + looks[i][0] * 28 + 9, 180 + looks[i][1] * 30 - 9, 7, "#fff", 0);
                c.restore();
              }
              if (o < 1) {
                // eyelid
                c.save();
                c.beginPath(); c.ellipse(ex, 180, 70, 80, 0, 0, TAU); c.clip();
                c.fillStyle = "#ffd6a5";
                c.fillRect(ex - 72, 180 - 82, 144, 82 * (1 - o) * 2 - 2 + (o === 0 ? 4 : 0));
                c.restore();
                if (o === 0) line(c, [[ex - 66, 180], [ex + 66, 180]], 6);
                else line(c, [[ex - 70, 180 - 80 + 160 * (1 - o)], [ex + 70, 180 - 80 + 160 * (1 - o)]], 5);
              }
              ellipse(c, ex, 180, 70, 80, null, 6);
              line(c, [[ex - 50, 80 - (i === 3 ? 10 : 0)], [ex + 50, 72 - (i === 3 ? 10 : 0)]], 10);
            }
          });
        });
        fr[7].sound = sound("pop", 0.4);
      },
    },
    {
      id: "boom", title: "Exploding Star", desc: "A star swells up… and goes KA-BOOM!", fps: 10,
      build(p) {
        p.bgFill = { type: "gradient", color: "#10002b", color2: "#3c096c", angle: 180, radial: true };
        drawBg(p, (c) => {
          const R = GAS.rng(9);
          for (let i = 0; i < 50; i++) { c.fillStyle = "#fff"; c.globalAlpha = 0.3 + R() * 0.7; c.beginPath(); c.arc(R() * W, R() * H, R() * 1.6 + 0.3, 0, TAU); c.fill(); }
        });
        const fr = setup(p, 11);
        fr.forEach((f, i) => {
          draw(f, (c) => {
            if (i <= 4) {
              const s = [0.3, 0.5, 0.75, 1, 1.15][i];
              const wob = i === 4 ? 0.12 : 0;
              starPts(c, 240, 180, 90 * s, 40 * s, 5, -Math.PI / 2 + wob);
              shape(c, "#ffd23f", 5);
              circle(c, 222, 172, 6 * s, OUT, 0); circle(c, 258, 172, 6 * s, OUT, 0);
              if (i >= 3) { ellipse(c, 240, 196, 10 * s, 12 * s, OUT, 0); }
              else { c.beginPath(); c.arc(240, 190, 14 * s, 0.1, Math.PI - 0.1); c.lineWidth = 4; c.strokeStyle = OUT; c.stroke(); }
            } else {
              const t = (i - 4) / 6;
              const R = GAS.rng(21);
              for (let k = 0; k < 16; k++) {
                const a = (k / 16) * TAU + R() * 0.3, d = 30 + t * (180 + R() * 80);
                const r = (16 + R() * 12) * (1 - t * 0.7);
                c.globalAlpha = 1 - t * 0.8;
                starPts(c, 240 + Math.cos(a) * d, 180 + Math.sin(a) * d, r, r * 0.45, 5, a);
                shape(c, ["#ffd23f", "#ef476f", "#4cc9f0", "#06d6a0"][k % 4], 3);
              }
              c.globalAlpha = 1;
            }
          });
        });
        fr[5].objects.push(effect("impact", 240, 180, { text: "BOOM!", w: 260, h: 200 }));
        fr[6].objects.push(effect("impact", 240, 180, { text: "BOOM!", w: 300, h: 230, rot: 0.08 }));
        fr[7].objects.push(effect("sparkles", 240, 180, { w: 320, h: 260 }));
        fr[5].sound = sound("boom", 0.9);
        fr[0].sound = sound("slide", 0.5);
      },
    },
    {
      id: "flower", title: "Growing Flower", desc: "A seed sprouts and blooms in the sunshine.", fps: 8,
      build(p) {
        p.bgFill = { type: "gradient", color: "#a2d2ff", color2: "#fdffb6", angle: 180 };
        drawBg(p, (c) => {
          c.fillStyle = "#8d5524"; c.fillRect(0, 300, W, 60);
          line(c, [[0, 300], [W, 300]], 4, "#5e3a14");
          for (let x = 8; x < W; x += 18) line(c, [[x, 302], [x + 4, 290]], 3, "#38b000");
        });
        const fr = setup(p, 14);
        fr.forEach((f, i) => {
          const grow = Math.min(1, i / 8);
          const stemH = 170 * grow;
          const top = [240, 300 - stemH];
          draw(f, (c) => {
            if (i === 0) { ellipse(c, 240, 296, 10, 7, "#6f4518", 3); return; }
            c.beginPath(); c.moveTo(240, 300); c.quadraticCurveTo(225, 300 - stemH / 2, top[0], top[1]);
            c.lineWidth = 12; c.strokeStyle = OUT; c.lineCap = "round"; c.stroke(); c.lineWidth = 7; c.strokeStyle = "#38b000"; c.stroke();
            if (i >= 4) {
              const ls = Math.min(1, (i - 3) / 3);
              ellipse(c, 210, 300 - stemH * 0.35, 26 * ls, 11 * ls, "#70e000", 4, -0.5);
              ellipse(c, 266, 300 - stemH * 0.55, 26 * ls, 11 * ls, "#70e000", 4, 0.5);
            }
            if (i >= 8) {
              const bloom = Math.min(1, (i - 7) / 4);
              const petals = 8;
              for (let k = 0; k < petals; k++) {
                const a = (k / petals) * TAU + 0.2;
                ellipse(c, top[0] + Math.cos(a) * 30 * bloom, top[1] + Math.sin(a) * 30 * bloom, 22 * bloom + 6, 13 * bloom + 5, k % 2 ? "#ff8fab" : "#ffb3c6", 4, a);
              }
              circle(c, top[0], top[1], 20, "#ffd23f", 4);
              if (bloom >= 1) { circle(c, top[0] - 7, top[1] - 3, 3, OUT, 0); circle(c, top[0] + 7, top[1] - 3, 3, OUT, 0); c.beginPath(); c.arc(top[0], top[1] + 3, 7, 0.2, Math.PI - 0.2); c.lineWidth = 3; c.stroke(); }
            } else if (i >= 6) {
              ellipse(c, top[0], top[1] - 8, 12, 18, "#ff8fab", 4);
            }
          });
          f.objects.push(sticker("nature/sun", 400, 70, 110, { rot: i * 0.08 }));
          if (i >= 12) f.objects.push(effect("sparkles", 240, 110, { w: 200, h: 150 }));
        });
        fr[11].sound = sound("twinkle", 0.8);
      },
    },
    {
      id: "car", title: "Moving Car", desc: "Vroom! A little car zooms down the road.", fps: 12,
      build(p) {
        p.bgFill = { type: "gradient", color: "#8ecae6", color2: "#e0fbfc", angle: 180 };
        drawBg(p, (c) => {
          c.fillStyle = "#70e000"; c.fillRect(0, 220, W, 50);
          c.fillStyle = "#495057"; c.fillRect(0, 262, W, 98);
          line(c, [[0, 262], [W, 262]], 4);
          for (let x = 10; x < W; x += 70) { c.fillStyle = "#ffd23f"; c.fillRect(x, 308, 40, 8); }
          for (const [x, s] of [[60, 1], [300, 0.7]]) cloud(c, x, 70 + s * 20, s);
          for (const x of [40, 180, 420]) { c.fillStyle = "#8d5524"; c.fillRect(x - 6, 180, 12, 44); circle(c, x, 172, 30, "#38b000", 4); }
        });
        const fr = setup(p, 12);
        fr.forEach((f, i) => {
          const x = -40 + i * 50, bounce = i % 2 ? -2 : 0;
          draw(f, (c) => {
            c.translate(x, 280 + bounce);
            c.beginPath();
            c.moveTo(-70, 10); c.lineTo(-70, -12); c.quadraticCurveTo(-66, -24, -46, -24); c.lineTo(-30, -52); c.lineTo(28, -52); c.lineTo(48, -24); c.quadraticCurveTo(72, -22, 72, -4); c.lineTo(72, 10); c.closePath();
            shape(c, "#ef476f", 4);
            c.beginPath(); c.moveTo(-24, -46); c.lineTo(-4, -46); c.lineTo(-4, -26); c.lineTo(-38, -26); c.closePath(); shape(c, "#a0e7e5", 3);
            c.beginPath(); c.moveTo(4, -46); c.lineTo(24, -46); c.lineTo(38, -26); c.lineTo(4, -26); c.closePath(); shape(c, "#a0e7e5", 3);
            circle(c, 66, -8, 5, "#ffd23f", 3);
            for (const wx of [-40, 42]) {
              circle(c, wx, 12, 17, OUT, 0);
              circle(c, wx, 12, 8, "#dee2e6", 0);
              const a = i * 1.1;
              line(c, [[wx + Math.cos(a) * 7, 12 + Math.sin(a) * 7], [wx - Math.cos(a) * 7, 12 - Math.sin(a) * 7]], 3);
            }
          });
          f.objects.push(effect("speedlines", x - 120, 262 + bounce, { w: 120, h: 70 }));
        });
        fr[0].sound = sound("honk", 0.7);
      },
    },
  ];

  function build(id) {
    const t = LIST.find((x) => x.id === id);
    if (!t) return null;
    const p = model.newProject({ width: W, height: H, name: t.title, fps: t.fps, frames: 0 });
    p.onion.enabled = true;
    t.build(p);
    return p;
  }

  /* Small animated previews for the template picker. */
  const previewCache = new Map();
  async function preview(id, w = 192) {
    if (previewCache.has(id)) return previewCache.get(id);
    const p = build(id);
    await GAS.render.whenReady(p);
    const hh = Math.round((w * p.height) / p.width);
    const frames = p.frames.map((f) => {
      const c = GAS.makeCanvas(w, hh);
      GAS.render.renderFrame(ctxOf(c), p, f, { scale: w / p.width });
      return { canvas: c, ms: GAS.anim.frameMs(p, f, p.fps, 1) };
    });
    previewCache.set(id, frames);
    return frames;
  }

  GAS.templates = { LIST, build, preview };
})();
