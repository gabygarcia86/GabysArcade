/*
 * People, animals and the alien family. Every drawer works in local space with the feet at
 * (0, 0), facing right. The caller flips the canvas for characters facing left.
 *
 * The pose object `o` carries: t (seconds), phase (walk cycle), moving, panic, float,
 * dizzy, blink, lx/ly (where the eyes look), angry, happy, wave.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const OUT = D.OUT;
  const Art = (U.Art = U.Art || {});

  function moodOf(o) {
    if (o.dizzy) return "dizzy";
    if (o.float || o.panic) return "panic";
    if (o.angry) return "angry";
    if (o.happy) return "happy";
    return "normal";
  }

  function mouthOf(o) {
    if (o.float || o.panic) return "open";
    if (o.angry) return "frown";
    if (o.dizzy) return "wavy";
    if (o.happy) return "grin";
    return "smile";
  }

  // ---------------------------------------------------------------- People

  const HUMANS = {
    farmer: { skin: "#f2c29b", shirt: "#e8463c", pants: "#3a6fd8", shoes: "#5b3a24", hair: "#7a4a22", style: "short", hat: "straw", extras: ["overalls", "beard"] },
    human: { skin: "#e8b48c", shirt: "#3fbf8f", pants: "#2f3f7a", shoes: "#222", hair: "#2b1d14", style: "short", hat: null, extras: [] },
    mail: { skin: "#c98d63", shirt: "#7fb4ff", pants: "#24407a", shoes: "#222", hair: "#1b120d", style: "short", hat: "cap", hatColor: "#24407a", extras: ["bag"] },
    guard: { skin: "#f0c7a4", shirt: "#2c3e78", pants: "#1d2a52", shoes: "#111", hair: "#5a3820", style: "short", hat: "guard", extras: ["badge", "sunglasses"] },
    cowboy: { skin: "#e3a77d", shirt: "#c9572f", pants: "#2e4a8a", shoes: "#6b3b1f", hair: "#3b2414", style: "short", hat: "cowboy", extras: ["vestBrown", "mustache", "bandana"] },
    tourist: { skin: "#ffd2b0", shirt: "#ff8ac2", pants: "#f2e3b3", shoes: "#fff", hair: "#e8c04a", style: "pony", hat: "sun", extras: ["flowers", "camera"] },
    office: { skin: "#d9a07a", shirt: "#ffffff", pants: "#333a4f", shoes: "#111", hair: "#2a1a10", style: "short", hat: null, extras: ["tie", "suit", "briefcase"] },
    construction: { skin: "#bf835c", shirt: "#3f7fd6", pants: "#3a4766", shoes: "#5b3a24", hair: "#1b120d", style: "short", hat: "hard", extras: ["vest", "mustache"] },
    pedestrian: { skin: "#f0bf94", shirt: "#a56bff", pants: "#334", shoes: "#e33", hair: "#c2452d", style: "curly", hat: null, extras: ["phone"] },
    beachgoer: { skin: "#f5c49a", shirt: "#f5c49a", pants: "#ff5f5f", shoes: "#f5c49a", hair: "#7a4a22", style: "long", hat: null, extras: ["sunglasses", "swim", "towel"] },
    surfer: { skin: "#d4935f", shirt: "#d4935f", pants: "#2fb6c9", shoes: "#d4935f", hair: "#f4d35e", style: "spiky", hat: null, extras: ["surfboard", "swim"] },
    islander: { skin: "#a8673f", shirt: "#ffb03b", pants: "#3e8f5a", shoes: "#a8673f", hair: "#140c08", style: "curly", hat: null, extras: ["lei", "flowers", "flowerHair"] },
    // Hazards that are people. They're drawn redder and angrier so they never look friendly.
    resident: { skin: "#ff9a8a", shirt: "#ff7fc8", pants: "#7a5bd6", shoes: "#ffe0f0", hair: "#d3d3d3", style: "short", hat: "curlers", extras: ["robe"], angry: true },
    giantFarmer: { skin: "#ff9b84", shirt: "#c4352b", pants: "#2c56b8", shoes: "#4a2c18", hair: "#5a3416", style: "short", hat: "straw", extras: ["overalls", "beard"], angry: true, build: 1.25 },
    soldier: { skin: "#d8a47c", shirt: "#5d7a3a", pants: "#4c6430", shoes: "#2b2b1f", hair: "#2b1d14", style: "short", hat: "helmet", extras: [], angry: true },
  };

  function leg(ctx, x, y, a, len, pants, shoe, swim, skin) {
    const fx = x + Math.sin(a) * len;
    const fy = y + Math.cos(a) * len;
    if (swim) {
      D.limb(ctx, x, y, fx, fy, 7, skin);
    } else {
      D.limb(ctx, x, y, fx, fy, 8, pants);
    }
    D.ell(ctx, fx + 3, fy - 1, 6.5, 3.8, shoe, 2.5);
  }

  function arm(ctx, x, y, a, len, sleeve, skin) {
    const ex = x + Math.sin(a) * len;
    const ey = y + Math.cos(a) * len;
    D.limb(ctx, x, y, ex, ey, 6.5, sleeve);
    D.circ(ctx, ex, ey, 4.2, skin, 2.2);
    return [ex, ey];
  }

  function human(ctx, p, o) {
    const t = o.t;
    const mv = o.moving ? 1 : 0;
    const run = o.panic ? 1.35 : 1;
    const w = p.build || 1;
    const swim = p.extras.includes("swim");
    const bob = mv ? -Math.abs(Math.sin(o.phase)) * 3 * run : 0;
    ctx.save();
    ctx.translate(0, bob);

    let a1 = Math.sin(o.phase) * 0.6 * mv * run;
    let a2 = -a1;
    if (o.float) {
      a1 = Math.sin(t * 13) * 0.6;
      a2 = Math.sin(t * 13 + 2.2) * 0.6;
    }

    if (p.extras.includes("surfboard")) {
      ctx.save();
      ctx.translate(-6, -46);
      ctx.rotate(-0.25);
      D.ell(ctx, 0, 0, 9, 40, "#ffe36b", 3);
      D.line(ctx, 0, -36, 0, 36, "#ff5f5f", 3);
      ctx.restore();
    }

    // Legs.
    const hipY = -26;
    leg(ctx, -4 * w, hipY, a2, 26, shade(p.pants, -0.15), p.shoes, swim, shade(p.skin, -0.1));
    leg(ctx, 4 * w, hipY, a1, 26, p.pants, p.shoes, swim, p.skin);

    // Arms behind the body.
    let back;
    let front;
    if (o.panic || (o.angry && o.throwing)) {
      const wig = Math.sin(t * 22) * 0.35;
      back = -(Math.PI * 0.86 + wig);
      front = Math.PI * 0.86 - wig;
      if (o.throwing) front = Math.PI * 0.95;
    } else if (o.float) {
      back = -(Math.PI * 0.62 + Math.sin(t * 12) * 0.6);
      front = Math.PI * 0.62 + Math.sin(t * 12 + 1.3) * 0.6;
    } else {
      back = a1 * 0.8;
      front = a2 * 0.8;
    }
    const sleeve = p.extras.includes("suit") ? "#333a4f" : p.extras.includes("robe") ? p.shirt : swim ? p.skin : p.shirt;
    arm(ctx, -9 * w, -50, back, 22, shade(sleeve, -0.12), p.skin);

    // Torso.
    if (swim) {
      D.rect(ctx, -11 * w, -57, 22 * w, 33, p.skin, 3, 9);
      D.rect(ctx, -11 * w, -32, 22 * w, 10, p.pants, 3, 4);
    } else if (p.extras.includes("robe")) {
      D.rect(ctx, -12 * w, -57, 24 * w, 40, p.shirt, 3, 9);
      D.line(ctx, -2, -54, 4, -22, shade(p.shirt, -0.2), 3);
      D.line(ctx, -12 * w, -36, 12 * w, -36, "#fff", 3);
    } else {
      D.rect(ctx, -11 * w, -57, 22 * w, 33, p.shirt, 3, 9);
    }
    torsoExtras(ctx, p, w, t);

    // Head.
    const hy = -70;
    if (p.style === "long" || p.style === "pony") {
      D.rect(ctx, -15, hy - 10, 26, 26, p.hair, 3, 10);
    }
    D.circ(ctx, 0, hy, 14, p.skin, 3);
    hair(ctx, p, hy);
    const mood = p.angry || o.angry ? (o.panic ? "panic" : "angry") : moodOf(o);
    D.eyes(ctx, 4, hy - 2, 9, 3.6, o.lx || 0.6, o.ly || 0, mood, t, o.blink);
    if (p.extras.includes("sunglasses") && !o.panic && !o.float) {
      D.rect(ctx, -2, hy - 6, 13, 7, "#111", 2, 3);
      D.line(ctx, -4, hy - 4, 12, hy - 4, "#111", 2);
    }
    D.circ(ctx, 12, hy + 1, 2.8, shade(p.skin, -0.12), 1.6);
    if (p.extras.includes("beard")) {
      ctx.beginPath();
      ctx.arc(2, hy + 3, 13, 0.1, Math.PI - 0.6);
      ctx.fillStyle = p.hair;
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (p.extras.includes("mustache")) {
      D.ell(ctx, 7, hy + 5, 6, 2.6, p.hair, 1.6);
    }
    const mouth = p.angry || o.angry ? (o.panic ? "open" : "frown") : mouthOf(o);
    D.mouth(ctx, 6, hy + 8, 7, mouth, t);
    hat(ctx, p, hy);
    if (p.extras.includes("flowerHair")) flower(ctx, -10, hy - 8, 5, "#ff5fb4");

    // Front arm, with whatever the person carries.
    const [hx, hy2] = arm(ctx, 9 * w, -50, front, 22, sleeve, p.skin);
    if (p.extras.includes("briefcase") && !o.panic && !o.float) {
      D.rect(ctx, hx - 8, hy2 + 2, 16, 12, "#6b3b1f", 2.5, 2);
    } else if (p.extras.includes("phone") && !o.panic && !o.float) {
      D.rect(ctx, hx - 3, hy2 - 10, 7, 11, "#222", 2, 2);
    }
    if (o.panic && !o.float && mv) D.sweat(ctx, -14, hy - 12, 4, t);
    ctx.restore();
  }

  function torsoExtras(ctx, p, w, t) {
    const ex = p.extras;
    if (ex.includes("overalls")) {
      D.rect(ctx, -9 * w, -44, 18 * w, 21, p.pants, 2.5, 4);
      D.line(ctx, -7 * w, -56, -6 * w, -44, p.pants, 3.5);
      D.line(ctx, 7 * w, -56, 6 * w, -44, p.pants, 3.5);
      D.circ(ctx, -6 * w, -44, 2, "#ffd23f", 1);
      D.circ(ctx, 6 * w, -44, 2, "#ffd23f", 1);
    }
    if (ex.includes("suit")) {
      D.poly(ctx, [-11 * w, -55, -2, -55, -11 * w, -30], "#333a4f", 2);
      D.poly(ctx, [11 * w, -55, 2, -55, 11 * w, -30], "#333a4f", 2);
    }
    if (ex.includes("tie")) D.poly(ctx, [0, -56, 3, -50, 0, -36, -3, -50], "#e8463c", 1.8);
    if (ex.includes("vest")) {
      D.rect(ctx, -11 * w, -55, 22 * w, 26, "#ff8a1f", 2.5, 6);
      D.line(ctx, -10 * w, -44, 10 * w, -44, "#fff36b", 4);
    }
    if (ex.includes("vestBrown")) {
      D.poly(ctx, [-11 * w, -55, -3, -55, -4, -27, -11 * w, -27], "#7a4a22", 2);
      D.poly(ctx, [11 * w, -55, 3, -55, 4, -27, 11 * w, -27], "#7a4a22", 2);
    }
    if (ex.includes("bandana")) D.poly(ctx, [-9, -57, 9, -57, 0, -48], "#e8463c", 2);
    if (ex.includes("badge")) D.star(ctx, 5, -48, 4.5, "#ffd23f", 1.5);
    if (ex.includes("flowers")) {
      for (const [fx, fy] of [[-5, -50], [5, -40], [-4, -33], [6, -53]]) flower(ctx, fx * w, fy, 2.8, "#fff");
    }
    if (ex.includes("lei")) {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.15 + (i / 6) * 0.7);
        flower(ctx, Math.cos(a) * 10, -57 + Math.sin(a) * 8, 3, i % 2 ? "#ff5fb4" : "#ffd23f");
      }
    }
    if (ex.includes("bag")) {
      D.line(ctx, -9, -56, 9, -32, "#6b3b1f", 3);
      D.rect(ctx, 4, -36, 13, 11, "#a0612f", 2.5, 3);
      D.rect(ctx, 6, -35, 7, 3, "#fff", 0);
    }
    if (ex.includes("camera")) {
      D.line(ctx, -8, -56, 0, -44, OUT, 2);
      D.line(ctx, 8, -56, 0, -44, OUT, 2);
      D.rect(ctx, -6, -46, 12, 8, "#333", 2, 2);
      D.circ(ctx, 0, -42, 2.6, "#7fd8ff", 1.2);
    }
    if (ex.includes("towel")) D.rect(ctx, -12 * w, -58, 6, 22, "#5fd0ff", 2, 2);
  }

  function hair(ctx, p, hy) {
    const c = p.hair;
    switch (p.style) {
      case "short":
      case "long":
      case "pony":
        ctx.beginPath();
        ctx.arc(0, hy, 14.5, Math.PI * 0.98, Math.PI * 2.05);
        ctx.quadraticCurveTo(6, hy - 6, -6, hy - 4);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        if (p.style === "pony") D.ell(ctx, -16, hy + 2, 5, 10, c, 2.5, 0.4);
        break;
      case "spiky":
        D.poly(ctx, [-14, hy - 4, -12, hy - 20, -6, hy - 12, 0, hy - 24, 5, hy - 12, 12, hy - 20, 14, hy - 4], c, 2.5);
        break;
      case "curly":
        for (const [x, y] of [[-10, -8], [-3, -13], [5, -12], [11, -6], [-13, 0]]) D.circ(ctx, x, hy + y, 6, c, 2);
        break;
      default:
        break;
    }
  }

  function hat(ctx, p, hy) {
    const c = p.hatColor;
    switch (p.hat) {
      case "straw":
        D.ell(ctx, 0, hy - 10, 23, 5, "#f2d06b", 2.5);
        D.rect(ctx, -11, hy - 24, 22, 15, "#f2d06b", 2.5, 5);
        D.rect(ctx, -11, hy - 14, 22, 4, "#e8463c", 0);
        break;
      case "cap":
        ctx.beginPath();
        ctx.arc(0, hy - 4, 14.5, Math.PI, U.TAU);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.ell(ctx, 14, hy - 5, 10, 3, c, 2.5);
        break;
      case "cowboy":
        D.ell(ctx, 0, hy - 11, 25, 5.5, "#8a5a2b", 2.5);
        D.poly(ctx, [-11, hy - 11, -10, hy - 27, -3, hy - 23, 3, hy - 27, 10, hy - 27, 11, hy - 11], "#8a5a2b", 2.5);
        D.rect(ctx, -11, hy - 16, 22, 3.5, "#3b2414", 0);
        break;
      case "hard":
        ctx.beginPath();
        ctx.arc(0, hy - 5, 15, Math.PI, U.TAU);
        ctx.closePath();
        ctx.fillStyle = "#ffd23f";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        D.ell(ctx, 2, hy - 5, 19, 3.5, "#ffd23f", 2.5);
        D.line(ctx, 0, hy - 19, 0, hy - 7, "#e0a800", 3);
        break;
      case "guard":
      case "helmet": {
        const color = p.hat === "guard" ? "#1d2a52" : "#4c6430";
        if (p.hat === "guard") {
          D.rect(ctx, -12, hy - 26, 24, 15, color, 2.5, 4);
          D.ell(ctx, 10, hy - 11, 9, 3, "#111", 2);
          D.star(ctx, 0, hy - 19, 4, "#ffd23f", 1.2);
        } else {
          ctx.beginPath();
          ctx.arc(0, hy - 3, 16, Math.PI, U.TAU);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = OUT;
          ctx.stroke();
          D.ell(ctx, 0, hy - 3, 18, 3, color, 2.5);
        }
        break;
      }
      case "sun":
        D.ell(ctx, 0, hy - 10, 27, 6, "#ffb6d9", 2.5);
        ctx.beginPath();
        ctx.arc(0, hy - 11, 12, Math.PI, U.TAU);
        ctx.fillStyle = "#ffb6d9";
        ctx.fill();
        ctx.stroke();
        flower(ctx, 8, hy - 15, 4, "#ffd23f");
        break;
      case "curlers":
        for (let i = 0; i < 4; i++) D.rect(ctx, -12 + i * 7, hy - 19 + (i % 2) * 2, 6, 9, ["#7fd8ff", "#ffd23f", "#ff8ac2", "#8dff5a"][i], 1.8, 2);
        break;
      default:
        break;
    }
  }

  function flower(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * U.TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.55, 0, U.TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#ffcf3f";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, U.TAU);
    ctx.fill();
  }

  // ---------------------------------------------------------------- Four-legged animals

  const QUADS = {
    cow: { w: 74, h: 38, leg: 22, body: "#ffffff", legColor: "#ffffff", hoof: "#3b2a2a", spots: "#2b2230", tail: "tuft", head: "cow", udder: true },
    bull: { w: 82, h: 42, leg: 22, body: "#4a2a22", legColor: "#4a2a22", hoof: "#1a1010", tail: "tuft", head: "bull", angry: true },
    pig: { w: 58, h: 34, leg: 13, body: "#ffadc8", legColor: "#ffadc8", hoof: "#c76a8a", tail: "curl", head: "pig", legW: 8 },
    horse: { w: 78, h: 34, leg: 34, body: "#b8743d", legColor: "#b8743d", hoof: "#3b2414", tail: "flow", head: "horse", mane: "#3b2414", legW: 7 },
    sheep: { w: 58, h: 36, leg: 18, body: "#ffffff", legColor: "#3b3346", hoof: "#1d1433", tail: "stub", head: "sheep", wool: true, legW: 5.5 },
    goat: { w: 56, h: 30, leg: 22, body: "#f1e6d2", legColor: "#f1e6d2", hoof: "#3b2a2a", tail: "stub", head: "goat", legW: 5.5 },
    dog: { w: 50, h: 24, leg: 18, body: "#d9a05b", legColor: "#d9a05b", hoof: "#d9a05b", tail: "wag", head: "dog", legW: 6.5, belly: "#f6dcb4" },
    cat: { w: 42, h: 20, leg: 15, body: "#ff9f43", legColor: "#ff9f43", hoof: "#ff9f43", tail: "up", head: "cat", legW: 5.5, stripes: "#d9701f" },
  };

  function quad(ctx, p, o) {
    const t = o.t;
    const mv = o.moving ? 1 : 0;
    const gallop = o.panic ? 1.4 : 1;
    const bw = p.w / 2;
    const bh = p.h / 2;
    const L = p.leg;
    const bob = mv ? -Math.abs(Math.sin(o.phase)) * 2.5 * gallop : Math.sin(t * 2) * 0.6;
    const by = -L - bh + bob;
    const legW = p.legW || 7;
    const xs = [-bw * 0.6, -bw * 0.36, bw * 0.4, bw * 0.64];
    const off = [0, Math.PI, Math.PI, 0];

    const drawLeg = (i, color) => {
      let a = Math.sin(o.phase + off[i]) * 0.5 * mv * gallop;
      if (o.float) a = Math.sin(t * 15 + i * 1.7) * 0.6;
      const x0 = xs[i];
      const y0 = by + bh * 0.4;
      const len = -y0 + bob;
      const fx = x0 + Math.sin(a) * len;
      const fy = y0 + Math.cos(a) * len;
      D.limb(ctx, x0, y0, fx, fy, legW, color);
      D.ell(ctx, fx + 1, fy - 1.5, legW * 0.62, 3, p.hoof, 2);
    };

    drawLeg(1, shade(p.legColor, -0.18));
    drawLeg(3, shade(p.legColor, -0.18));
    tail(ctx, p, -bw, by - bh * 0.3, t, o);

    if (p.wool) {
      for (const [x, y, r] of [[-bw * 0.6, 0, 0.55], [-bw * 0.2, -bh * 0.35, 0.6], [bw * 0.25, -bh * 0.3, 0.6], [bw * 0.55, 0.05, 0.52], [0, bh * 0.25, 0.65], [-bw * 0.35, bh * 0.3, 0.5], [bw * 0.3, bh * 0.3, 0.5]]) {
        D.circ(ctx, x, by + y, bh * r * 1.15, p.body, 3);
      }
      for (const [x, y, r] of [[-bw * 0.6, 0, 0.5], [-bw * 0.2, -bh * 0.35, 0.55], [bw * 0.25, -bh * 0.3, 0.55], [bw * 0.55, 0.05, 0.47], [0, bh * 0.25, 0.6]]) {
        D.circ(ctx, x, by + y, bh * r * 1.1, p.body, 0);
      }
    } else {
      D.ell(ctx, 0, by, bw, bh, p.body, 3);
      if (p.spots) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(0, by, bw - 1.5, bh - 1.5, 0, 0, U.TAU);
        ctx.clip();
        D.ell(ctx, -bw * 0.35, by - bh * 0.35, bw * 0.3, bh * 0.45, p.spots, 0);
        D.ell(ctx, bw * 0.3, by + bh * 0.2, bw * 0.22, bh * 0.35, p.spots, 0);
        D.ell(ctx, -bw * 0.7, by + bh * 0.5, bw * 0.2, bh * 0.3, p.spots, 0);
        ctx.restore();
      }
      if (p.stripes) {
        for (let i = -1; i <= 1; i++) D.line(ctx, i * bw * 0.35, by - bh * 0.9, i * bw * 0.35 - 3, by - bh * 0.2, p.stripes, 3.5);
      }
      if (p.belly) D.ell(ctx, bw * 0.1, by + bh * 0.45, bw * 0.55, bh * 0.38, p.belly, 0);
      if (p.udder) D.ell(ctx, -bw * 0.15, by + bh * 0.95, 8, 5, "#ffadc8", 2);
    }

    drawLeg(0, p.legColor);
    drawLeg(2, p.legColor);
    HEADS[p.head](ctx, p, bw * 0.92, by - bh * 0.55, o, bw, bh, by);
  }

  function tail(ctx, p, x, y, t, o) {
    switch (p.tail) {
      case "tuft": {
        const sw = Math.sin(t * 3) * 5;
        D.limb3(ctx, x + 2, y, x - 10, y + 4, x - 8 + sw, y + 22, 3, p.body === "#ffffff" ? "#ffffff" : p.body, 2);
        D.ell(ctx, x - 8 + sw, y + 25, 4, 5, p.spots || "#1a1010", 2);
        break;
      }
      case "curl":
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x - 5, y - 2, 5, 0, Math.PI * 1.6);
        ctx.stroke();
        ctx.strokeStyle = p.body;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        break;
      case "flow": {
        const sw = Math.sin(t * 4) * 4 + (o.moving ? -6 : 0);
        D.limb3(ctx, x + 4, y - 2, x - 18, y + sw, x - 12, y + 26, 8, p.mane, 2.5);
        break;
      }
      case "wag": {
        const wag = Math.sin(t * (o.moving ? 18 : 10)) * 0.6;
        D.limb(ctx, x + 3, y, x - 10 + Math.sin(wag) * 3, y - 14 + Math.cos(wag) * 2, 4, p.body, 2);
        break;
      }
      case "up": {
        const sw = Math.sin(t * 2.5) * 5;
        D.limb3(ctx, x + 3, y + 2, x - 16, y - 4, x - 10 + sw, y - 26, 4.5, p.body, 2);
        break;
      }
      default:
        D.circ(ctx, x + 1, y - 2, 4.5, p.body, 2.5);
    }
  }

  const HEADS = {
    cow(ctx, p, hx, hy, o) {
      const t = o.t;
      D.ell(ctx, hx - 9, hy - 9, 6, 3.5, "#d9a07a", 2, -0.4);
      D.poly(ctx, [hx - 5, hy - 11, hx - 3, hy - 21, hx + 1, hy - 12], "#fff2c9", 2);
      D.poly(ctx, [hx + 6, hy - 12, hx + 9, hy - 21, hx + 11, hy - 11], "#fff2c9", 2);
      D.ell(ctx, hx + 3, hy, 15, 13, "#fff", 3);
      D.ell(ctx, hx - 4, hy - 5, 5, 4, "#2b2230", 0);
      D.ell(ctx, hx + 11, hy + 7, 10, 7, "#ffadc8", 2.5);
      D.circ(ctx, hx + 8, hy + 6, 1.6, OUT, 0);
      D.circ(ctx, hx + 14, hy + 6, 1.6, OUT, 0);
      D.eyes(ctx, hx + 4, hy - 4, 9, 3.6, o.lx || 0.5, o.ly || 0, moodOf(o), t, o.blink);
      if (o.float || o.panic) D.ell(ctx, hx + 11, hy + 11, 4, 2.5 + Math.abs(Math.sin(t * 8)) * 2, "#5a1730", 1.5);
    },
    bull(ctx, p, hx, hy, o) {
      const t = o.t;
      // Big curved horns and a nose ring, so bulls never look like cows.
      D.limb3(ctx, hx - 6, hy - 9, hx - 20, hy - 14, hx - 16, hy - 28, 5, "#fff2c9", 2);
      D.limb3(ctx, hx + 8, hy - 10, hx + 22, hy - 16, hx + 20, hy - 30, 5, "#fff2c9", 2);
      D.ell(ctx, hx + 3, hy, 16, 14, "#4a2a22", 3);
      D.ell(ctx, hx + 12, hy + 7, 10, 7, "#8a4a3a", 2.5);
      D.circ(ctx, hx + 9, hy + 6, 1.8, OUT, 0);
      D.circ(ctx, hx + 15, hy + 6, 1.8, OUT, 0);
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx + 12, hy + 13, 4, 0, U.TAU);
      ctx.stroke();
      ctx.fillStyle = "#ff3b3b";
      ctx.beginPath();
      ctx.arc(hx + 1, hy - 4, 3.6, 0, U.TAU);
      ctx.arc(hx + 9, hy - 4, 3.6, 0, U.TAU);
      ctx.fill();
      D.line(ctx, hx - 4, hy - 11, hx + 4, hy - 6, OUT, 3);
      D.line(ctx, hx + 14, hy - 11, hx + 6, hy - 6, OUT, 3);
      if (o.snort) {
        const k = (t * 3) % 1;
        ctx.fillStyle = `rgba(255,255,255,${0.8 - k * 0.8})`;
        ctx.beginPath();
        ctx.arc(hx + 22 + k * 12, hy + 8 - k * 6, 4 + k * 6, 0, U.TAU);
        ctx.fill();
      }
    },
    pig(ctx, p, hx, hy, o) {
      const t = o.t;
      hy += 8;
      D.poly(ctx, [hx - 9, hy - 9, hx - 12, hy - 22, hx - 1, hy - 13], "#ff8fb3", 2.5);
      D.circ(ctx, hx + 2, hy, 15, p.body, 3);
      D.poly(ctx, [hx + 3, hy - 12, hx + 6, hy - 24, hx + 12, hy - 11], "#ff8fb3", 2.5);
      D.ell(ctx, hx + 15, hy + 3, 6, 7, "#ff8fb3", 2.5);
      D.circ(ctx, hx + 14, hy + 1, 1.5, OUT, 0);
      D.circ(ctx, hx + 15.5, hy + 5, 1.5, OUT, 0);
      D.eyes(ctx, hx + 3, hy - 4, 9, 3.2, o.lx || 0.5, o.ly || 0, moodOf(o), t, o.blink);
      D.mouth(ctx, hx + 6, hy + 8, 6, mouthOf(o), t);
    },
    horse(ctx, p, hx, hy, o, bw, bh, by) {
      const t = o.t;
      const nx = bw * 0.75;
      const nTopY = by - bh - 26;
      // Neck and mane.
      D.limb(ctx, nx - 6, by - bh * 0.2, nx + 6, nTopY, 18, p.body);
      D.limb3(ctx, nx - 12, by - bh * 0.5, nx - 10, nTopY + 6, nx - 2, nTopY - 6, 7, p.mane, 2);
      const headX = nx + 12;
      const headY = nTopY + 2;
      D.poly(ctx, [headX - 8, headY - 10, headX - 6, headY - 22, headX - 1, headY - 11], p.body, 2.5);
      D.ell(ctx, headX + 6, headY + 2, 19, 10, p.body, 3, 0.55);
      D.ell(ctx, headX + 15, headY + 11, 8, 6.5, "#e8b48c", 2.5, 0.55);
      D.circ(ctx, headX + 17, headY + 10, 1.6, OUT, 0);
      D.eye(ctx, headX + 2, headY - 3, 3.8, o.lx || 0.5, o.ly || 0, o.blink ? "closed" : moodOf(o), t);
      if (o.float || o.panic) D.ell(ctx, headX + 13, headY + 17, 4, 2.5, "#5a1730", 1.5);
    },
    sheep(ctx, p, hx, hy, o) {
      const t = o.t;
      D.ell(ctx, hx - 8, hy + 1, 6, 3, "#3b3346", 2, 0.5);
      D.ell(ctx, hx + 4, hy + 2, 11, 13, "#3b3346", 3);
      D.circ(ctx, hx + 1, hy - 11, 7, "#fff", 2.5);
      D.circ(ctx, hx + 8, hy - 9, 6, "#fff", 2.5);
      D.eyes(ctx, hx + 5, hy, 8, 3.4, o.lx || 0.5, o.ly || 0, moodOf(o), t, o.blink);
      if (o.float || o.panic) D.ell(ctx, hx + 7, hy + 10, 3, 2.5, "#5a1730", 1.5);
    },
    goat(ctx, p, hx, hy, o) {
      const t = o.t;
      D.limb3(ctx, hx - 2, hy - 9, hx - 12, hy - 22, hx - 18, hy - 16, 4, "#a08a6a", 2);
      D.ell(ctx, hx - 9, hy - 1, 6, 3, p.body, 2, 0.3);
      D.ell(ctx, hx + 4, hy, 12, 11, p.body, 3);
      D.poly(ctx, [hx + 6, hy + 9, hx + 12, hy + 9, hx + 8, hy + 20], "#d9c9a8", 2);
      D.eyes(ctx, hx + 5, hy - 3, 8, 3.4, o.lx || 0.5, o.ly || 0, moodOf(o), t, o.blink);
      D.mouth(ctx, hx + 8, hy + 5, 5, mouthOf(o), t);
    },
    dog(ctx, p, hx, hy, o) {
      const t = o.t;
      hy -= 2;
      D.circ(ctx, hx + 2, hy, 13, p.body, 3);
      D.ell(ctx, hx + 13, hy + 4, 9, 7, p.belly, 2.5);
      D.circ(ctx, hx + 20, hy + 1, 3.2, OUT, 0);
      const flop = Math.sin(t * (o.moving ? 14 : 4)) * 0.3;
      D.ell(ctx, hx - 7, hy + 3, 5, 10, "#8a5a2b", 2.5, 0.3 + flop);
      D.eyes(ctx, hx + 6, hy - 4, 8, 3.4, o.lx || 0.5, o.ly || 0, moodOf(o), t, o.blink);
      if (o.moving && !o.float) D.ell(ctx, hx + 13, hy + 13, 3, 5, "#ff6b8a", 1.6);
      if (o.float || o.panic) D.ell(ctx, hx + 13, hy + 10, 3.5, 3, "#5a1730", 1.5);
    },
    cat(ctx, p, hx, hy, o) {
      const t = o.t;
      hy -= 4;
      D.poly(ctx, [hx - 9, hy - 5, hx - 8, hy - 19, hx - 1, hy - 10], p.body, 2.5);
      D.poly(ctx, [hx + 4, hy - 10, hx + 10, hy - 19, hx + 12, hy - 4], p.body, 2.5);
      D.circ(ctx, hx + 2, hy, 12, p.body, 3);
      D.eyes(ctx, hx + 4, hy - 2, 9, 3.4, o.lx || 0.5, o.ly || 0, moodOf(o), t, o.blink);
      D.circ(ctx, hx + 9, hy + 4, 2, "#ff8ac2", 1);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.2;
      for (const dy of [-1, 2]) D.line(ctx, hx + 12, hy + 4 + dy, hx + 22, hy + 2 + dy * 2, OUT, 1.2);
      if (o.float || o.panic) D.ell(ctx, hx + 7, hy + 8, 2.5, 2, "#5a1730", 1.2);
    },
  };

  // ---------------------------------------------------------------- Birds and crabs

  const BIRDS = {
    chicken: { body: "#ffffff", wing: "#f2eee6", head: "#ffffff", beak: "#ffb02e", legs: "#ffb02e", comb: true, tail: "#ffffff" },
    duck: { body: "#f2efe6", wing: "#b88a5a", head: "#2f9a5f", beak: "#ffb02e", legs: "#ff9f2e", bill: true, tail: "#7a6650", ring: true },
    seagull: { body: "#ffffff", wing: "#a9b3c4", head: "#ffffff", beak: "#ffd23f", legs: "#ffb39a", beakDot: true, tail: "#4a4f5c" },
  };

  function bird(ctx, p, o) {
    const t = o.t;
    const mv = o.moving ? 1 : 0;
    const hop = mv ? -Math.abs(Math.sin(o.phase * 1.5)) * 3 : 0;
    // Legs.
    let a1 = Math.sin(o.phase) * 0.5 * mv;
    if (o.float) a1 = Math.sin(t * 16) * 0.6;
    const hipY = -11 + hop;
    D.line(ctx, -3, hipY, -3 + Math.sin(a1) * 11, hipY + Math.cos(a1) * 11, p.legs, 3);
    D.line(ctx, 4, hipY, 4 - Math.sin(a1) * 11, hipY + Math.cos(a1) * 11, p.legs, 3);
    ctx.save();
    ctx.translate(0, hop);
    // Tail feathers.
    D.poly(ctx, [-12, -22, -22, -32, -19, -18], p.tail, 2.5);
    // Body.
    D.ell(ctx, 0, -20, 15, 12, p.body, 3);
    // Wing, flapping when scared or floating.
    const flap = o.float || o.panic ? Math.sin(t * 30) * 0.9 : Math.sin(t * 2) * 0.05;
    ctx.save();
    ctx.translate(-2, -22);
    ctx.rotate(-0.2 - flap);
    D.ell(ctx, -4, 0, 10, 6, p.wing, 2.5);
    ctx.restore();
    // Head.
    const hx = 11;
    const hy = -33;
    if (p.comb) {
      D.circ(ctx, hx - 3, hy - 8, 3.5, "#ff3b3b", 2);
      D.circ(ctx, hx + 2, hy - 9, 3.5, "#ff3b3b", 2);
      D.circ(ctx, hx + 6, hy - 6, 3, "#ff3b3b", 2);
    }
    D.circ(ctx, hx, hy, 8.5, p.head, 2.5);
    if (p.ring) D.line(ctx, hx - 7, hy + 7, hx + 5, hy + 8, "#fff", 2.5);
    if (p.bill) {
      D.ell(ctx, hx + 11, hy + 2, 7, 3.2, p.beak, 2);
    } else {
      const open = o.float || o.panic ? 3 + Math.abs(Math.sin(t * 20)) * 2 : 0;
      D.poly(ctx, [hx + 6, hy - 2, hx + 15, hy + 1 - open * 0.3, hx + 6, hy + 2], p.beak, 2);
      if (open) D.poly(ctx, [hx + 6, hy + 2, hx + 13, hy + 3 + open, hx + 6, hy + 4], p.beak, 2);
      if (p.beakDot) D.circ(ctx, hx + 12, hy + 1, 1.4, "#ff3b3b", 0);
    }
    if (p.comb) D.ell(ctx, hx + 6, hy + 6, 2.5, 3.5, "#ff3b3b", 1.5);
    D.eye(ctx, hx + 2, hy - 2, 3, o.lx || 0.5, o.ly || 0, o.blink ? "closed" : moodOf(o), t);
    ctx.restore();
  }

  function crab(ctx, o) {
    const t = o.t;
    const mv = o.moving ? 1 : 0;
    const by = -14;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(o.phase * 2 + i * 1.3) * 0.4 * mv + (o.float ? Math.sin(t * 18 + i) * 0.6 : 0);
        const x0 = side * (6 + i * 4);
        D.limb3(ctx, x0, by + 4, x0 + side * 10, by - 2 + a * 6, x0 + side * 13, 0, 2.5, "#e8463c", 1.5);
      }
    }
    // Claws, snapping.
    const snap = Math.abs(Math.sin(t * (o.panic || o.float ? 14 : 4)));
    for (let side = -1; side <= 1; side += 2) {
      const cx = side * 22;
      const cy = by - 12 - (o.panic || o.float ? 8 : 0);
      D.limb(ctx, side * 12, by - 2, cx, cy + 4, 4, "#e8463c", 2);
      D.ell(ctx, cx, cy, 7, 5, "#ff5f4a", 2.5, side * 0.4);
      D.poly(ctx, [cx + side * 2, cy - 2, cx + side * 9, cy - 6 - snap * 4, cx + side * 6, cy + 1], "#ff5f4a", 2);
    }
    D.ell(ctx, 0, by, 17, 11, "#ff5f4a", 3);
    D.line(ctx, -5, by - 9, -6, by - 20, OUT, 2.5);
    D.line(ctx, 5, by - 9, 6, by - 20, OUT, 2.5);
    D.eye(ctx, -6, by - 22, 3.6, o.lx || 0, o.ly || 0, moodOf(o), t);
    D.eye(ctx, 6, by - 22, 3.6, o.lx || 0, o.ly || 0, moodOf(o), t);
    D.mouth(ctx, 0, by + 3, 6, mouthOf(o), t);
  }

  // ---------------------------------------------------------------- Alien family

  const FAMILY_STYLE = {
    mom: { skin: "#86f08a", outfit: "#ff6fb5", size: 1, extras: ["bow", "lashes", "necklace", "dress"] },
    dad: { skin: "#5fd39a", outfit: "#5f8cff", size: 1.06, extras: ["mustache", "bowtie"] },
    baby: { skin: "#c2ff7a", outfit: "#ffffff", size: 0.68, extras: ["pacifier", "curl", "diaper"] },
    grandma: { skin: "#a3ead0", outfit: "#a77bff", size: 0.95, extras: ["glasses", "bun", "lashes", "dress"] },
    grandpa: { skin: "#7ccaa0", outfit: "#b0783f", size: 0.95, extras: ["glasses", "brows", "cane", "whiskers"] },
    bestie: { skin: "#56dcf0", outfit: "#ff8a1f", size: 1, extras: ["cap", "threeEyes"] },
    cousin: { skin: "#c597ff", outfit: "#ffd23f", size: 0.92, extras: ["oneEye", "spots", "scarf"] },
  };

  function alien(ctx, id, o) {
    const s = FAMILY_STYLE[id];
    const t = o.t;
    const ex = s.extras;
    ctx.save();
    ctx.scale(s.size, s.size);
    const jump = o.jump ? -Math.abs(Math.sin(t * 7)) * 12 : 0;
    ctx.translate(0, jump);

    // Legs.
    const kick = o.float ? Math.sin(t * 14) * 0.5 : o.jump ? 0.3 : 0;
    D.limb(ctx, -5, -14, -7 - kick * 6, 0, 5, s.skin, 2.5);
    D.limb(ctx, 5, -14, 7 + kick * 6, 0, 5, s.skin, 2.5);
    D.ell(ctx, -8 - kick * 6, 0, 5, 3, "#3b2a5a", 2);
    D.ell(ctx, 8 + kick * 6, 0, 5, 3, "#3b2a5a", 2);

    if (ex.includes("cane")) {
      D.line(ctx, 18, -26, 20, 0, "#7a4a22", 3.5);
      ctx.strokeStyle = "#7a4a22";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(14, -26, 5, Math.PI, U.TAU);
      ctx.stroke();
    }

    // Arms: waving, cheering or flailing happily.
    const wave = Math.sin(t * 12) * 0.5;
    let la = 0.5;
    let ra = -0.5;
    if (o.float || o.jump || o.happy) {
      la = Math.PI * 0.85 + wave * 0.5;
      ra = -(Math.PI * 0.85) - wave * 0.5;
    } else if (o.wave) {
      ra = -(Math.PI * 0.75) + wave;
    }
    const sx = 10;
    const sy = -26;
    D.limb(ctx, -sx, sy, -sx + Math.sin(-la) * 14, sy + Math.cos(la) * 14, 4, s.skin, 2.5);
    D.limb(ctx, sx, sy, sx + Math.sin(-ra) * 14, sy + Math.cos(ra) * 14, 4, s.skin, 2.5);

    // Body and outfit.
    if (ex.includes("dress")) {
      D.poly(ctx, [-8, -32, 8, -32, 14, -11, -14, -11], s.outfit, 3);
    } else if (ex.includes("diaper")) {
      D.ell(ctx, 0, -22, 11, 11, s.skin, 3);
      D.rect(ctx, -10, -20, 20, 9, "#fff", 2.5, 4);
    } else {
      D.ell(ctx, 0, -22, 11, 12, s.outfit, 3);
    }
    if (ex.includes("bowtie")) {
      D.poly(ctx, [-6, -35, 0, -32, -6, -29], "#ff3b3b", 2);
      D.poly(ctx, [6, -35, 0, -32, 6, -29], "#ff3b3b", 2);
    }
    if (ex.includes("necklace")) for (let i = 0; i < 5; i++) D.circ(ctx, -6 + i * 3, -31 + Math.abs(i - 2) * -1, 1.8, "#fff", 1);
    if (ex.includes("scarf")) {
      D.rect(ctx, -10, -36, 20, 6, s.outfit, 2.5, 3);
      D.rect(ctx, 4, -33, 5, 12, s.outfit, 2.5, 2);
    }

    // Head.
    const hy = -48;
    // Antennae.
    const sway = Math.sin(t * 5) * 3;
    const ants = ex.includes("threeEyes") ? [-7, 0, 7] : [-7, 7];
    for (const ax of ants) {
      const tipX = ax * 1.4 + sway;
      D.line(ctx, ax, hy - 12, tipX, hy - 26, OUT, 2.2);
      const glow = 0.6 + Math.sin(t * 6 + ax) * 0.4;
      ctx.fillStyle = `rgba(255, 240, 120, ${glow * 0.5})`;
      ctx.beginPath();
      ctx.arc(tipX, hy - 27, 7, 0, U.TAU);
      ctx.fill();
      D.circ(ctx, tipX, hy - 27, 3.6, "#ffe36b", 2);
    }
    if (ex.includes("curl")) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(2, hy - 18, 4, Math.PI * 0.8, Math.PI * 2.4);
      ctx.stroke();
    }
    if (ex.includes("bun")) D.circ(ctx, -2, hy - 16, 7, "#f4f0ff", 2.5);
    D.ell(ctx, 0, hy, 18, 15, s.skin, 3);
    if (ex.includes("spots")) {
      D.circ(ctx, -10, hy - 6, 2.6, shade(s.skin, -0.2), 0);
      D.circ(ctx, 11, hy - 3, 2.2, shade(s.skin, -0.2), 0);
      D.circ(ctx, -12, hy + 4, 1.8, shade(s.skin, -0.2), 0);
    }
    if (ex.includes("cap")) {
      ctx.beginPath();
      ctx.arc(0, hy - 4, 17, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
      ctx.fillStyle = "#ff3b6b";
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      D.ell(ctx, -15, hy - 7, 9, 3, "#ff3b6b", 2.5);
    }
    if (ex.includes("bow")) {
      D.poly(ctx, [0, hy - 14, -10, hy - 21, -10, hy - 8], "#ff6fb5", 2);
      D.poly(ctx, [0, hy - 14, 10, hy - 21, 10, hy - 8], "#ff6fb5", 2);
      D.circ(ctx, 0, hy - 14, 3, "#ff3b9a", 1.5);
    }

    // Eyes: big glossy alien eyes, or one or three.
    const look = U.clamp(o.lx || 0, -1, 1) * 1.5;
    const happy = o.happy || o.float;
    const drawAlienEye = (x, y, rx, ry, rot) => {
      if (happy) {
        D.eye(ctx, x, y + 1, rx, 0, 0, "happy");
        return;
      }
      if (o.blink) {
        D.line(ctx, x - rx, y, x + rx, y, OUT, 2.5);
        return;
      }
      ctx.fillStyle = OUT;
      ctx.beginPath();
      ctx.ellipse(x + look, y, rx, ry, rot, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + look - rx * 0.3, y - ry * 0.35, rx * 0.35, 0, U.TAU);
      ctx.fill();
    };
    if (ex.includes("oneEye")) {
      D.circ(ctx, 0, hy - 2, 9, "#fff", 2.5);
      if (happy) D.eye(ctx, 0, hy - 1, 7, 0, 0, "happy");
      else if (o.blink) D.line(ctx, -7, hy - 2, 7, hy - 2, OUT, 2.5);
      else {
        D.circ(ctx, look * 2, hy - 2, 5, "#7a3bd6", 0);
        D.circ(ctx, look * 2, hy - 2, 2.6, OUT, 0);
        D.circ(ctx, look * 2 - 2, hy - 4, 1.4, "#fff", 0);
      }
    } else if (ex.includes("threeEyes")) {
      drawAlienEye(-8, hy - 1, 4, 5.4, -0.3);
      drawAlienEye(8, hy - 1, 4, 5.4, 0.3);
      drawAlienEye(0, hy - 8, 3.4, 4.2, 0);
    } else {
      drawAlienEye(-7, hy - 1, 5, 6.8, -0.35);
      drawAlienEye(7, hy - 1, 5, 6.8, 0.35);
    }
    if (ex.includes("lashes") && !happy && !o.blink) {
      D.line(ctx, -12, hy - 7, -14, hy - 10, OUT, 1.8);
      D.line(ctx, 12, hy - 7, 14, hy - 10, OUT, 1.8);
    }
    if (ex.includes("glasses")) {
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-7, hy - 1, 7, 0, U.TAU);
      ctx.moveTo(14, hy - 1);
      ctx.arc(7, hy - 1, 7, 0, U.TAU);
      ctx.moveTo(-1, hy - 2);
      ctx.lineTo(1, hy - 2);
      ctx.stroke();
    }
    if (ex.includes("brows")) {
      D.ell(ctx, -8, hy - 10, 6, 2.6, "#f4f0ff", 1.5, 0.2);
      D.ell(ctx, 8, hy - 10, 6, 2.6, "#f4f0ff", 1.5, -0.2);
    }
    if (ex.includes("whiskers")) D.ell(ctx, 0, hy + 7, 7, 2.4, "#f4f0ff", 1.5);
    if (ex.includes("mustache")) {
      D.ell(ctx, -4, hy + 7, 5, 2.6, "#3b2414", 1.5, 0.2);
      D.ell(ctx, 4, hy + 7, 5, 2.6, "#3b2414", 1.5, -0.2);
    }
    if (ex.includes("pacifier")) {
      D.circ(ctx, 0, hy + 9, 4.5, "#7fd8ff", 2);
      D.circ(ctx, 0, hy + 9, 1.6, "#fff", 0);
    } else if (!ex.includes("mustache") && !ex.includes("whiskers")) {
      D.mouth(ctx, 0, hy + 9, 6, o.float ? "open" : happy ? "grin" : "smile", t);
    } else if (o.float || happy) {
      D.mouth(ctx, 0, hy + 11, 5, "open", t);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Helpers

  const shadeCache = new Map();
  function shade(hex, amount) {
    const key = hex + amount;
    let v = shadeCache.get(key);
    if (v) return v;
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map((ch) => ch + ch).join("");
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    const f = amount < 0 ? 0 : 255;
    const k = Math.abs(amount);
    r = Math.round(r + (f - r) * k);
    g = Math.round(g + (f - g) * k);
    b = Math.round(b + (f - b) * k);
    v = `rgb(${r},${g},${b})`;
    shadeCache.set(key, v);
    return v;
  }

  // ---------------------------------------------------------------- Public

  Art.shade = shade;
  Art.HUMANS = HUMANS;
  Art.QUADS = QUADS;
  Art.FAMILY_STYLE = FAMILY_STYLE;
  Art.drawHuman = (ctx, key, o) => human(ctx, HUMANS[key], o);
  Art.drawQuad = (ctx, key, o) => quad(ctx, QUADS[key], o);
  Art.drawAlien = alien;

  // One entry point for every abductable character.
  Art.drawCharacter = function (ctx, art, o) {
    if (HUMANS[art]) human(ctx, HUMANS[art], o);
    else if (QUADS[art]) quad(ctx, QUADS[art], o);
    else if (BIRDS[art]) bird(ctx, BIRDS[art], o);
    else if (art === "crab") crab(ctx, o);
  };
})(window.UFO);
