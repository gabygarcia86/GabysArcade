/*
 * The Grinch (an original drawing: green fur, yellow eyes, Santa hat, red coat and huge
 * gloves), his Snow-Slinger launcher, the snowballs, Max the dog and speech bubbles.
 *
 * The Grinch is drawn from a simple skeleton (hips, shoulders, two-bone arms and legs), so
 * each animation is just a pose function of time.
 */
(function (G) {
  "use strict";

  const Art = G.Art;
  const TAU = Math.PI * 2;
  const FUR = "#5cb531";
  const FUR_DARK = "#3c8a1e";
  const FUR_LIGHT = "#86d455";
  const COAT = "#d42a33";
  const COAT_DARK = "#9c1820";

  // Two-bone reach: returns the elbow/knee point for a limb from (ax, ay) to (bx, by).
  function joint(ax, ay, bx, by, l1, l2, bendSign) {
    let dx = bx - ax;
    let dy = by - ay;
    let d = Math.hypot(dx, dy);
    const max = l1 + l2 - 0.01;
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
      bx = ax + dx;
      by = ay + dy;
      d = max;
    }
    d = Math.max(d, 1);
    const a = Math.acos(G.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const base = Math.atan2(dy, dx);
    const ang = base + a * bendSign;
    return { jx: ax + Math.cos(ang) * l1, jy: ay + Math.sin(ang) * l1, bx, by };
  }

  function limb(ctx, ax, ay, jx, jy, bx, by, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(jx, jy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    // Fur tufts at the joint.
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) Art.circle(ctx, jx + (i - 1) * 3, jy + (i % 2) * 2, w * 0.55);
  }

  function glove(ctx, x, y, r, open, fist) {
    Art.circle(ctx, x, y, r, "#ffffff");
    ctx.strokeStyle = "#c9d6e6";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    if (open) {
      for (let i = -1; i <= 1; i++) Art.ellipse(ctx, x + i * r * 0.55, y - r * 0.95, r * 0.28, r * 0.5, "#ffffff");
      Art.ellipse(ctx, x + r * 0.95, y - r * 0.2, r * 0.45, r * 0.25, "#ffffff");
    } else if (fist) {
      ctx.strokeStyle = "#c9d6e6";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(x + i * r * 0.45, y - r * 0.5, r * 0.25, Math.PI, 0);
        ctx.stroke();
      }
    }
    // Red cuff.
    Art.ellipse(ctx, x - r * 0.1, y + r * 0.85, r * 0.85, r * 0.35, COAT);
  }

  // ---------------------------------------------------------------- Face

  function face(ctx, expr, time) {
    // Head-local coordinates: (0, 0) is the centre of the head, facing right.
    const blink = (expr === "sly" || expr === "grin") && time % 3.4 < 0.12;
    ctx.lineCap = "round";
    // Eyes.
    const eyes = [
      [6, -6, 7.5],
      [24, -7, 6.5],
    ];
    for (let i = 0; i < 2; i++) {
      const [ex, ey, er] = eyes[i];
      if (expr === "strain" || expr === "gross" || expr === "sneeze") {
        // Squeezed shut: > <
        const d = i === 0 ? 1 : -1;
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex - er * 0.8 * d, ey - er * 0.6);
        ctx.lineTo(ex + er * 0.6 * d, ey);
        ctx.lineTo(ex - er * 0.8 * d, ey + er * 0.6);
        ctx.stroke();
        continue;
      }
      if (expr === "laugh" || expr === "joy" || expr === "tongue" || expr === "relief" || expr === "sing") {
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex, ey + 2, er * 0.75, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        continue;
      }
      if (expr === "dizzy") {
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let a = 0; a < TAU * 1.6; a += 0.3) {
          const rr = a * 0.75;
          const px = ex + Math.cos(a + time * 8) * rr;
          const py = ey + Math.sin(a + time * 8) * rr;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        continue;
      }
      const big = expr === "shock" ? 1.4 : expr === "puff" ? 1.25 : 1;
      const squint = expr === "squint" && i === 0;
      Art.ellipse(ctx, ex, ey, er * big, er * 0.82 * big, "#fff36b");
      ctx.strokeStyle = "#2c5a12";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (blink || squint) {
        ctx.fillStyle = FUR;
        ctx.fillRect(ex - er - 1, ey - er - 1, er * 2 + 2, er + 2);
        ctx.strokeStyle = "#1d2a12";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - er, ey + (squint ? 0 : 1));
        ctx.lineTo(ex + er, ey + (squint ? 0 : 1));
        ctx.stroke();
        if (blink) continue;
        if (squint) continue;
      }
      const pr = expr === "shock" ? er * 0.3 : er * 0.42;
      const look = expr === "shifty" ? Math.sin(time * 6) * er * 0.5 : expr === "sad" ? 2 : expr === "mad" ? 0 : 1.5;
      Art.circle(ctx, ex + look, ey + (expr === "sad" ? 2 : 0.5), pr, "#c0182c");
      Art.circle(ctx, ex + look, ey + (expr === "sad" ? 2 : 0.5), pr * 0.5, "#1d1010");
      if (expr === "sad" || expr === "sly" || expr === "shifty") {
        // Heavy lids.
        ctx.fillStyle = FUR;
        ctx.fillRect(ex - er - 1, ey - er - 1, er * 2 + 2, er * (expr === "sad" ? 0.9 : 0.7));
      }
    }
    // Brows.
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (expr === "mad" || expr === "squint" || expr === "strain" || expr === "gross") {
      ctx.moveTo(-1, -17);
      ctx.lineTo(13, -11);
      ctx.moveTo(18, -11);
      ctx.lineTo(31, -18);
    } else if (expr === "shock" || expr === "puff" || expr === "sneeze" || expr === "sing") {
      ctx.moveTo(-1, -22);
      ctx.lineTo(12, -24);
      ctx.moveTo(18, -24);
      ctx.lineTo(31, -22);
    } else if (expr === "sad") {
      ctx.moveTo(-1, -12);
      ctx.lineTo(12, -17);
      ctx.moveTo(19, -17);
      ctx.lineTo(31, -11);
    } else if (expr !== "joy" && expr !== "laugh" && expr !== "tongue" && expr !== "relief") {
      ctx.moveTo(-2, -14);
      ctx.lineTo(12, -17);
      ctx.moveTo(18, -19);
      ctx.lineTo(31, -12);
    }
    ctx.stroke();
    // Nose.
    Art.ellipse(ctx, 33, 1, 4.5, 3, FUR_DARK);
    // Mouth.
    ctx.strokeStyle = "#1d2a12";
    ctx.lineWidth = 2.5;
    if (expr === "laugh" || expr === "joy") {
      ctx.fillStyle = "#3a1010";
      ctx.beginPath();
      ctx.moveTo(-2, 8);
      ctx.quadraticCurveTo(14, 30, 34, 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ff7a8a";
      Art.ellipse(ctx, 16, 18, 7, 4);
      ctx.fill();
      ctx.fillStyle = "#fffbe0";
      ctx.fillRect(2, 8, 28, 3);
    } else if (expr === "tongue") {
      // Blowing a raspberry.
      ctx.fillStyle = "#3a1010";
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(15, 24, 32, 7);
      ctx.closePath();
      ctx.fill();
      const wag = Math.sin(time * 22) * 1.5;
      Art.ellipse(ctx, 17 + wag, 19, 7, 10, "#ff6b8a");
      ctx.strokeStyle = "#c23a5a";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(17 + wag, 14);
      ctx.lineTo(17 + wag, 24);
      ctx.stroke();
    } else if (expr === "puff") {
      // Cheeks full of air.
      Art.circle(ctx, -8, 9, 10, FUR_LIGHT);
      Art.circle(ctx, 33, 11, 9, FUR_LIGHT);
      Art.ellipse(ctx, 16, 14, 4, 3, "#3a1010");
    } else if (expr === "sing") {
      // Belting it out.
      Art.ellipse(ctx, 17, 15, 8, 11, "#3a1010");
      Art.ellipse(ctx, 17, 21, 5, 4, "#ff7a8a");
    } else if (expr === "shock" || expr === "sneeze") {
      Art.ellipse(ctx, 18, 14, 6, 8, "#3a1010");
    } else if (expr === "mad" || expr === "strain") {
      ctx.fillStyle = "#fffbe0";
      Art.roundRect(ctx, 4, 8, 26, 9, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        ctx.moveTo(4 + i * 5.2, 8);
        ctx.lineTo(4 + i * 5.2, 17);
      }
      ctx.stroke();
    } else if (expr === "sad") {
      ctx.beginPath();
      ctx.moveTo(4, 17);
      ctx.quadraticCurveTo(17, 7, 30, 16);
      ctx.stroke();
    } else if (expr === "dizzy" || expr === "gross") {
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) ctx.lineTo(4 + i * 3.4, 13 + Math.sin(i * 1.6 + time * 10) * 2);
      ctx.stroke();
    } else {
      // The sly grin: wide and curling up at the cheek.
      ctx.beginPath();
      ctx.moveTo(-4, 6);
      ctx.quadraticCurveTo(14, 20, 34, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(34, 4);
      ctx.lineTo(38, -1);
      ctx.stroke();
      if (expr === "squint") {
        ctx.fillStyle = "#ff6b8a";
        Art.ellipse(ctx, 22, 15, 4, 5, "#ff6b8a");
      }
    }
  }

  // ---------------------------------------------------------------- Silly bits

  // The title-screen bits played when the Grinch is clicked. Each one adjusts the default
  // pose `p` at `at` seconds in. The timed sounds, farts and speech for each live in
  // G.SILLY (player.js). Extra pose fields: sx/sy scale him about his feet (a negative sx
  // turns him round), dx slides him sideways, spin turns him about his middle, hatRot
  // spins the hat.
  const seg = (at, a, b) => G.clamp((at - a) / (b - a), 0, 1);
  const bump = (k) => Math.sin(k * Math.PI);
  const ARMS_UP = (p) => {
    p.back = { x: -44, y: -212 };
    p.front = { x: 50, y: -218 };
    p.backOpen = true;
    p.frontOpen = true;
  };
  const LAUGH = (p, at) => {
    p.shake = Math.sin(at * 40) * 2;
    p.lean = -0.18 + Math.sin(at * 10) * 0.05;
    p.headTilt = -0.25;
    p.back = { x: 0, y: -84 };
    p.front = { x: 22, y: -80 };
    p.expr = "laugh";
    p.hipY = -86 + Math.abs(Math.sin(at * 10)) * 4;
  };

  const SILLY = {
    // Fart-powered rocket jump.
    rocket(p, at) {
      if (at < 0.5) {
        const k = seg(at, 0, 0.5);
        p.hipY = -86 + k * 18;
        p.sy = 1 - k * 0.1;
        p.sx = 1 + k * 0.06;
        p.lean = 0.12;
        p.expr = "strain";
        p.fist = true;
        p.back = { x: -4, y: -96 };
        p.front = { x: 24, y: -92 };
        p.shake = Math.sin(at * 60) * k * 2;
      } else if (at < 1.9) {
        const up = seg(at, 0.5, 1.3);
        const down = seg(at, 1.3, 1.9);
        p.jump = at < 1.3 ? -280 * (1 - (1 - up) * (1 - up)) : -280 * (1 - down * down);
        p.expr = at < 0.9 ? "shock" : "joy";
        ARMS_UP(p);
        const kick = Math.sin(at * 24);
        p.footL = { x: -12 + kick * 6, y: -14 };
        p.footR = { x: 14 - kick * 6, y: -8 };
        p.hatPop = 10 + Math.sin(at * 20) * 4;
        p.lean = Math.sin(at * 9) * 0.08;
      } else {
        const s = bump(seg(at, 1.9, 2.25));
        p.sy = 1 - s * 0.2;
        p.sx = 1 + s * 0.14;
        p.expr = at < 2.25 ? "shock" : "grin";
        p.back = { x: -36, y: -120 };
        p.front = { x: 48, y: -124 };
        p.backOpen = true;
        p.frontOpen = true;
      }
    },

    // Lifts a leg, lets one go, then wafts it at Christmas.
    waft(p, at) {
      p.back = { x: -30, y: -90 };
      p.front = { x: 40, y: -100 };
      if (at < 0.35) {
        const k = seg(at, 0, 0.3);
        p.footL = { x: -10 - k * 14, y: -k * 26 };
        p.lean = -0.12 * k;
        p.expr = "sly";
      } else if (at < 1.0) {
        p.footL = { x: -24, y: -26 };
        p.lean = -0.12;
        p.headTilt = -0.15;
        p.expr = "relief";
      } else if (at < 2.2) {
        const w = Math.sin(at * 16);
        p.expr = "grin";
        p.lean = 0.1;
        p.back = { x: -14, y: -66 };
        p.front = { x: 64 + w * 16, y: -140 + w * 10 };
        p.frontOpen = true;
        p.footR = { x: 18, y: 0 };
      } else {
        LAUGH(p, at);
      }
    },

    // Turns round, bends over and toots a tune.
    trumpet(p, at) {
      if (at < 0.25) p.sx = Math.cos(seg(at, 0, 0.25) * Math.PI);
      else if (at < 2.9) p.sx = -1;
      else p.sx = -Math.cos(seg(at, 2.9, 3.2) * Math.PI);
      let hit = 0;
      for (const t of [0.5, 0.8, 1.1, 1.25, 1.4, 1.9, 2.4]) if (at > t) hit = Math.max(hit, Math.exp(-(at - t) * 14));
      const bend = seg(at, 0.1, 0.4) * (1 - seg(at, 2.8, 3.1));
      p.lean = bend * 0.55 + hit * 0.12;
      p.hipY = -86 + bend * 6 - hit * 6;
      p.headTilt = -bend * 0.5;
      p.back = { x: G.lerp(-20, 6, bend), y: G.lerp(-78, -50, bend) };
      p.front = { x: G.lerp(34, 26, bend), y: G.lerp(-72, -48, bend) };
      p.footL = { x: -16, y: 0 };
      p.footR = { x: 20, y: 0 };
      p.expr = at > 2.4 && at < 2.7 ? "shock" : "tongue";
      if (at > 2.4) p.hatPop = bump(seg(at, 2.4, 2.8)) * 26;
    },

    // A fart that spins him like a top.
    spin(p, at, time) {
      if (at < 0.3) {
        p.expr = "strain";
        p.sy = 1 - seg(at, 0, 0.3) * 0.08;
        p.fist = true;
      } else if (at < 2.0) {
        const k = seg(at, 0.3, 2.0);
        p.spin = G.easeOutCubic(k) * Math.PI * 8;
        p.jump = -bump(k) * 60;
        p.expr = "shock";
        p.back = { x: -60, y: -140 };
        p.front = { x: 66, y: -140 };
        p.backOpen = true;
        p.frontOpen = true;
        p.footL = { x: -6, y: 0 };
        p.footR = { x: 8, y: 0 };
      } else {
        const k = seg(at, 2.0, 2.8);
        p.expr = "dizzy";
        p.stars = true;
        p.lean = Math.sin(time * 8) * 0.2 * (1 - k * 0.5);
        p.headTilt = Math.sin(time * 8 + 1) * 0.2;
        p.back = { x: -20, y: -60 };
        p.front = { x: 30, y: -56 };
      }
    },

    // Strains so hard his hat blasts off.
    hatpop(p, at) {
      if (at < 0.6) {
        const k = seg(at, 0, 0.6);
        p.expr = "strain";
        p.fist = true;
        p.hipY = -86 + k * 10;
        p.sy = 1 - k * 0.08;
        p.shake = Math.sin(at * 70) * (1 + k * 2);
        p.steam = k > 0.4;
        p.back = { x: -4, y: -100 };
        p.front = { x: 26, y: -96 };
        return;
      }
      const k = seg(at, 0.6, 2.0);
      p.hatPop = 4 * k * (1 - k) * 380;
      p.hatRot = k * Math.PI * 6;
      if (at < 2.0) {
        p.expr = "shock";
        p.jump = -bump(seg(at, 0.6, 0.9)) * 20;
        p.back = { x: -30, y: -200 };
        p.front = { x: 40, y: -210 };
        p.backOpen = true;
        p.frontOpen = true;
      } else {
        p.expr = "grin";
        p.sy = 1 - bump(seg(at, 2.0, 2.2)) * 0.1;
        p.back = { x: -10, y: -214 };
        p.front = { x: 30, y: -220 };
      }
    },

    // A sneaky one, a shifty look round, then blames someone else.
    blame(p, at, time) {
      if (at < 0.3) {
        p.expr = "sly";
      } else if (at < 0.8) {
        p.expr = "shock";
        p.jump = -bump(seg(at, 0.3, 0.5)) * 12;
        p.back = { x: -26, y: -60 };
        p.front = { x: 30, y: -58 };
      } else if (at < 1.6) {
        p.expr = "shifty";
        p.headTilt = Math.sin(time * 6) * 0.12;
        p.back = { x: -20, y: -70 };
        p.front = { x: 28, y: -70 };
      } else {
        const k = seg(at, 1.6, 1.8);
        p.expr = "grin";
        p.lean = -0.08;
        p.front = { x: G.lerp(30, 110, k), y: G.lerp(-70, -160, k) };
        p.back = { x: -14, y: -66 };
        p.fist = true;
        p.footR.x = 24;
        if (at > 2.4) p.shake = Math.sin(at * 40) * 1.5;
      }
    },

    // Drums his belly, then a ba-dum-pfft.
    drum(p, at) {
      if (at < 1.75) {
        const s = Math.sin((at * Math.PI) / 0.18);
        p.back = { x: 12, y: -110 - Math.max(0, s) * 28 };
        p.front = { x: 34, y: -104 - Math.max(0, -s) * 28 };
        p.fist = true;
        p.expr = "joy";
        p.hipY = -86 + Math.abs(s) * 3;
        p.headTilt = s * 0.08;
      } else if (at < 1.9) {
        p.lean = -0.1;
        p.expr = "sly";
        p.back = { x: -30, y: -150 };
        p.front = { x: 40, y: -154 };
      } else {
        p.footL = { x: -24, y: -30 * bump(seg(at, 1.9, 2.4)) };
        p.back = { x: -60, y: -160 };
        p.front = { x: 70, y: -166 };
        p.backOpen = true;
        p.frontOpen = true;
        p.expr = "tongue";
        p.lean = -0.1;
      }
    },

    // Smells his own fart and faints.
    faint(p, at, time) {
      if (at < 0.3) {
        p.expr = "sly";
      } else if (at < 0.9) {
        p.expr = at < 0.5 ? "relief" : "shock";
        p.lean = 0.15;
        p.headTilt = -0.1 + Math.sin(at * 30) * 0.04;
      } else if (at < 1.8) {
        p.expr = "gross";
        p.front = { x: 44, y: -172 };
        p.back = { x: -40 + Math.sin(at * 24) * 14, y: -200 + Math.cos(at * 24) * 10 };
        p.backOpen = true;
        p.sweat = true;
        p.shake = Math.sin(at * 30);
      } else {
        const k = seg(at, 1.8, 2.1);
        const up = seg(at, 2.95, 3.4);
        p.fall = -1.45 * G.easeOutBack(k) * (1 - up);
        p.expr = "dizzy";
        p.stars = at > 1.9 && at < 3.1;
        p.back = { x: -10, y: -84 };
        p.front = { x: 18, y: -80 };
        if (up === 0) {
          const twitch = Math.sin(time * 30) * 3;
          p.footL = { x: -10, y: -30 + twitch };
          p.footR = { x: 14, y: -36 - twitch };
        }
      }
    },

    // Puffs up like a balloon and zips around letting it out.
    balloon(p, at) {
      if (at < 1.2) {
        const k = seg(at, 0, 1.2);
        p.sx = p.sy = 1 + k * 0.35;
        p.jump = -k * k * 40;
        p.expr = "puff";
        p.back = { x: -56, y: -118 };
        p.front = { x: 64, y: -118 };
        p.backOpen = true;
        p.frontOpen = true;
        p.shake = Math.sin(at * 50) * k * 2;
      } else if (at < 2.4) {
        const k = seg(at, 1.2, 2.4);
        p.sx = p.sy = 1 + 0.35 * (1 - k);
        p.dx = Math.sin(k * Math.PI * 3) * 90;
        p.jump = -40 - bump(k) * 170;
        p.spin = k * Math.PI * 6;
        p.expr = "shock";
        const f = Math.sin(at * 30);
        p.back = { x: -50, y: -150 + f * 30 };
        p.front = { x: 60, y: -150 - f * 30 };
        p.backOpen = true;
        p.frontOpen = true;
      } else {
        const k = seg(at, 2.4, 2.6);
        p.jump = -40 * (1 - k * k);
        const s = bump(seg(at, 2.6, 2.85));
        p.sy = 1 - s * 0.2;
        p.sx = 1 + s * 0.12;
        p.expr = at < 2.6 ? "shock" : "dizzy";
        p.stars = at > 2.6;
        p.back = { x: -24, y: -60 };
        p.front = { x: 30, y: -58 };
      }
    },

    // Moonwalks backwards, tooting with every step.
    moonwalk(p, at) {
      if (at < 2.4) {
        p.dx = -seg(at, 0.2, 2.4) * 90;
        const step = Math.sin((at * Math.PI) / 0.3);
        p.footL = { x: -10 + step * 12, y: step > 0 ? -step * 6 : 0 };
        p.footR = { x: 14 - step * 12, y: step < 0 ? step * 6 : 0 };
        p.lean = -0.08;
        p.front = { x: 52, y: -222 };
        p.back = { x: -14, y: -66 };
        p.fist = true;
        p.headTilt = Math.sin(at * 10) * 0.08;
        p.expr = "tongue";
      } else {
        const k = seg(at, 2.7, 3.2);
        p.sx = Math.cos(seg(at, 2.4, 2.7) * Math.PI * 2);
        p.dx = -90 * (1 - G.easeOutCubic(k));
        p.expr = "joy";
        p.back = { x: -50, y: -170 };
        p.front = { x: 60, y: -176 };
        p.backOpen = true;
        p.frontOpen = true;
        p.footL = { x: -14, y: at > 2.7 ? -bump(k) * 24 : 0 };
      }
    },

    // ---- The ones that aren't about farts.

    // Ah... ah... ACHOO! Blown backwards by his own sneeze.
    sneeze(p, at, time) {
      if (at < 1.3) {
        const k = seg(at, 0, 1.3);
        let hitch = 0;
        for (const t of [0.15, 0.6, 1.0]) if (at > t) hitch = Math.max(hitch, bump(seg(at, t, t + 0.25)));
        p.headTilt = -k * 0.45 - hitch * 0.12;
        p.lean = -k * 0.18;
        p.expr = k < 0.3 ? "shock" : "sneeze";
        p.back = { x: -30, y: -96 };
        p.front = { x: G.lerp(34, 48, k), y: G.lerp(-72, -150, k) };
        p.frontOpen = true;
      } else if (at < 1.7) {
        const k = seg(at, 1.3, 1.45);
        p.headTilt = G.lerp(-0.45, 0.45, k);
        p.lean = G.lerp(-0.18, 0.3, k);
        p.dx = -30 * seg(at, 1.3, 1.5);
        p.expr = "sneeze";
        p.hatPop = bump(seg(at, 1.3, 1.8)) * 70;
        p.hatRot = -seg(at, 1.3, 1.8) * Math.PI * 2;
        p.back = { x: -60, y: -150 };
        p.front = { x: -10, y: -160 };
        p.backOpen = true;
        p.frontOpen = true;
      } else {
        p.dx = -30 * (1 - seg(at, 2.4, 2.9));
        p.expr = "relief";
        p.headTilt = 0.1;
        p.front = { x: 46, y: -168 + Math.sin(time * 20) * 6 };
        p.back = { x: -20, y: -80 };
      }
    },

    // Juggles three snowballs... until one lands on his head.
    juggle(p, at) {
      const L = { x: -6, y: -104 };
      const R = { x: 48, y: -104 };
      const T = 0.9;
      const along = (u) => {
        u = ((u % 1) + 1) % 1;
        if (u < 0.72) {
          const k = u / 0.72;
          return { x: G.lerp(R.x, L.x, k), y: R.y - 4 * k * (1 - k) * 130 };
        }
        const k = (u - 0.72) / 0.28;
        return { x: G.lerp(L.x, R.x, k), y: L.y + bump(k) * 10 };
      };
      p.back = { x: L.x, y: L.y + 8 };
      p.front = { x: R.x, y: R.y + 8 };
      if (at < 2.0) {
        p.balls = [0, 1, 2].map((i) => along(at / T + i / 3));
        const w = Math.sin((at / T) * Math.PI * 2) * 6;
        p.back.y += w;
        p.front.y -= w;
        p.headTilt = -0.2 + Math.sin(at * 7) * 0.06;
        p.expr = at < 1.0 ? "grin" : "tongue";
        return;
      }
      p.balls = [
        { x: L.x, y: L.y - 10 },
        { x: R.x, y: R.y - 10 },
      ];
      if (at < 2.5) {
        const k = seg(at, 2.0, 2.5);
        p.balls.push({ x: G.lerp(R.x, 10, k), y: G.lerp(-110, -238, k) - 4 * k * (1 - k) * 330 });
        p.headTilt = -0.3;
        p.expr = k > 0.6 ? "shock" : "grin";
      } else {
        const k = seg(at, 2.5, 3.0);
        p.balls.push({ x: G.lerp(10, 140, k), y: G.lerp(-238, -12, k) - 4 * k * (1 - k) * 90 });
        p.expr = "dizzy";
        p.stars = true;
        p.sy = 1 - bump(seg(at, 2.5, 2.65)) * 0.12;
      }
    },

    // Slips on the ice, lands flat, and pretends it was on purpose.
    slip(p, at, time) {
      if (at < 0.3) {
        const k = seg(at, 0, 0.3);
        p.dx = k * 20;
        p.footR = { x: 14 + k * 14, y: -bump(k) * 10 };
      } else if (at < 0.8) {
        const k = seg(at, 0.3, 0.8);
        p.dx = 20;
        p.jump = -bump(k) * 50;
        p.fall = -1.5 * G.easeOutCubic(k);
        p.footL = { x: 20 + k * 10, y: -30 * k };
        p.footR = { x: 34 + k * 10, y: -40 * k };
        const a = at * 20;
        p.back = { x: -20 + Math.cos(a) * 40, y: -150 + Math.sin(a) * 40 };
        p.front = { x: 30 - Math.cos(a) * 40, y: -150 - Math.sin(a) * 40 };
        p.backOpen = true;
        p.frontOpen = true;
        p.expr = "shock";
        p.hatPop = k * 20;
      } else if (at < 1.9) {
        p.dx = 20;
        p.fall = -1.5;
        p.sy = 1 - bump(seg(at, 0.8, 0.95)) * 0.1;
        p.expr = "dizzy";
        p.stars = true;
        const twitch = Math.sin(time * 26) * 3;
        p.footL = { x: -10, y: -30 + twitch };
        p.footR = { x: 14, y: -36 - twitch };
        p.back = { x: -10, y: -84 };
        p.front = { x: 18, y: -80 };
      } else if (at < 2.4) {
        p.dx = 20;
        p.fall = -1.5 * (1 - G.easeOutCubic(seg(at, 1.9, 2.4)));
        p.expr = "sad";
      } else {
        p.dx = 20 * (1 - seg(at, 2.6, 3.2));
        p.back = { x: 10 + Math.sin(time * 25) * 10, y: -96 };
        p.front = { x: 34, y: -64 };
        p.expr = "sly";
        p.headTilt = -0.1;
      }
    },

    // Chicken dance. Ends up laying an egg.
    chicken(p, at) {
      if (at < 2.2) {
        const f = Math.sin(at * 22);
        p.back = { x: -6, y: -128 + f * 8 };
        p.front = { x: 24, y: -126 - f * 8 };
        p.fist = true;
        const peck = Math.max(0, Math.sin(at * 9));
        p.headTilt = peck * 0.35;
        p.dx = peck * 6;
        const step = Math.sin(at * 6);
        p.footL = { x: -10, y: step > 0 ? -step * 22 : 0 };
        p.footR = { x: 14, y: step < 0 ? step * 22 : 0 };
        p.lean = 0.12;
        p.expr = "shock";
      } else if (at < 2.8) {
        const k = seg(at, 2.2, 2.5);
        p.hipY = -86 + k * 22;
        p.sy = 1 - k * 0.08;
        p.expr = at < 2.55 ? "strain" : "shock";
        const f = Math.sin(at * 10);
        p.back = { x: -6, y: -128 + f * 6 };
        p.front = { x: 24, y: -126 - f * 6 };
        p.fist = true;
        p.egg = at > 2.55;
      } else {
        p.egg = true;
        p.expr = "shock";
        p.jump = -bump(seg(at, 2.8, 3.1)) * 30;
        p.back = { x: -46, y: -150 };
        p.front = { x: 52, y: -152 };
        p.backOpen = true;
        p.frontOpen = true;
      }
    },

    // Hiccups, holds his breath, then one giant hiccup.
    hiccup(p, at) {
      p.back = { x: -20, y: -90 };
      p.front = { x: 28, y: -100 };
      if (at < 1.85) {
        let h = 0;
        for (const t of [0.3, 0.9, 1.5]) if (at > t && at < t + 0.35) h = bump(seg(at, t, t + 0.35));
        p.jump = -h * 22;
        p.hatPop = h * 14;
        p.sy = 1 + h * 0.05;
        p.expr = h > 0.1 ? "shock" : "sly";
        if (at > 0.6) p.front = { x: 46, y: -160 };
      } else if (at < 2.6) {
        const k = seg(at, 1.85, 2.6);
        p.expr = "puff";
        p.sx = p.sy = 1 + k * 0.08;
        p.shake = Math.sin(at * 50) * k * 2;
        p.front = { x: 46, y: -160 };
        p.back = { x: -10, y: -140 };
      } else {
        const k = seg(at, 2.6, 3.1);
        p.jump = -bump(k) * 90;
        p.hatPop = bump(k) * 40;
        p.expr = "shock";
        ARMS_UP(p);
      }
    },

    // Shows off his muscles, then throws his back out.
    flex(p, at, time) {
      if (at < 1.0) {
        const k = seg(at, 0, 0.25);
        p.back = { x: G.lerp(-20, -50, k), y: G.lerp(-78, -196, k) };
        p.front = { x: G.lerp(34, 70, k), y: G.lerp(-72, -200, k) };
        p.fist = true;
        p.flex = k;
        p.sx = 1 + k * 0.06;
        p.expr = at > 0.3 ? "strain" : "grin";
        if (at > 0.3) p.shake = Math.sin(time * 50) * 0.8;
      } else if (at < 1.8) {
        p.front = { x: 70, y: -200 };
        p.back = { x: -14, y: -66 };
        p.fist = true;
        p.flex = 1;
        p.sx = 1.06;
        p.headTilt = 0.25;
        p.expr = "relief";
      } else if (at < 2.0) {
        p.back = { x: 6, y: -96 };
        p.front = { x: 30, y: -94 };
        p.fist = true;
        p.flex = 1;
        p.lean = 0.15;
        p.sx = 1.1;
        p.expr = "strain";
        p.shake = Math.sin(time * 50) * 1.5;
      } else {
        const k = seg(at, 2.0, 2.15);
        p.lean = 0.55 * k;
        p.hipY = -80;
        p.back = { x: -40, y: -120 };
        p.front = { x: 40, y: -40 };
        p.expr = at < 2.4 ? "shock" : "sad";
        p.sweat = true;
        p.shake = Math.sin(time * 40);
      }
    },

    // Pirouettes, leaps, wobbles, and takes a bow.
    ballet(p, at) {
      p.footL = { x: -6, y: -6 };
      p.footR = { x: 10, y: -6 };
      p.expr = "relief";
      if (at < 1.6) {
        p.back = { x: -14, y: -226 };
        p.front = { x: 30, y: -230 };
        p.backOpen = true;
        p.frontOpen = true;
        p.sx = Math.cos(G.easeOutCubic(seg(at, 0.3, 1.6)) * Math.PI * 6);
        p.footL = { x: -30, y: -40 };
        p.jump = -6;
      } else if (at < 1.9) {
        p.hipY = -74;
        p.footL = { x: -14, y: 0 };
        p.footR = { x: 16, y: 0 };
        p.back = { x: -50, y: -150 };
        p.front = { x: 60, y: -150 };
        p.backOpen = true;
        p.frontOpen = true;
      } else if (at < 2.5) {
        const k = seg(at, 1.9, 2.5);
        p.dx = k * 70;
        p.jump = -bump(k) * 90;
        p.footL = { x: -56, y: -40 };
        p.footR = { x: 62, y: -36 };
        p.back = { x: -60, y: -200 };
        p.front = { x: 70, y: -200 };
        p.backOpen = true;
        p.frontOpen = true;
        p.lean = 0.1;
        p.expr = "joy";
      } else if (at < 2.9) {
        const k = seg(at, 2.5, 2.9);
        p.dx = 70;
        p.lean = Math.sin(at * 25) * 0.15 * (1 - k);
        p.footR = { x: 14, y: 0 };
        p.footL = { x: -30, y: -30 };
        const a = at * 18;
        p.back = { x: -40 + Math.cos(a) * 20, y: -160 + Math.sin(a) * 20 };
        p.front = { x: 50 - Math.cos(a) * 20, y: -160 - Math.sin(a) * 20 };
        p.backOpen = true;
        p.frontOpen = true;
        p.expr = "shock";
      } else {
        p.dx = 70 * (1 - seg(at, 2.9, 3.6));
        p.lean = 0.45 * bump(seg(at, 2.9, 3.6));
        p.back = { x: -50, y: -110 };
        p.front = { x: 60, y: -60 };
        p.frontOpen = true;
      }
    },

    // Sings a carol, very badly, until his voice cracks.
    sing(p, at, time) {
      if (at < 2.4) {
        p.front = { x: 14, y: -130 };
        p.frontOpen = true;
        p.back = { x: -60 + Math.sin(at * 2) * 6, y: -176 };
        p.backOpen = true;
        p.headTilt = -0.3 + Math.sin(at * 3) * 0.05;
        p.lean = -0.12;
        p.hipY = -86 + Math.sin(at * 4) * 2;
        p.shake = Math.sin(time * 40) * 0.8;
        p.expr = "sing";
      } else if (at < 2.9) {
        p.expr = "shock";
        p.front = { x: 28, y: -160 };
        p.jump = -bump(seg(at, 2.4, 2.6)) * 10;
        p.hatPop = bump(seg(at, 2.4, 2.7)) * 12;
      } else {
        p.lean = 0.2 * bump(seg(at, 2.9, 3.3));
        p.front = { x: 46, y: -165 };
        p.fist = true;
        p.expr = "sad";
      }
    },

    // Fleas! Scratches his head, his back, then thumps his leg like a dog.
    itch(p, at, time) {
      const j = Math.sin(time * 45);
      if (at < 1.0) {
        p.front = { x: 24 + j * 6, y: -226 };
        p.back = { x: -20, y: -80 };
        p.headTilt = 0.15;
        p.shake = j * 0.8;
        p.expr = "squint";
      } else if (at < 1.9) {
        p.back = { x: -36 + j * 6, y: -130 + j * 6 };
        p.front = { x: -10, y: -60 };
        p.lean = -0.15 + j * 0.02;
        p.dx = Math.sin(at * 20) * 4;
        p.expr = "gross";
      } else if (at < 2.7) {
        p.footR = { x: 20, y: -Math.max(0, Math.sin(at * 40)) * 30 };
        p.back = { x: 20, y: -110 + j * 8 };
        p.headTilt = -0.2;
        p.expr = "tongue";
      } else {
        p.expr = "relief";
        p.lean = -0.05;
      }
    },

    // Karate chops, a kick, a spin kick, and a wobbly crane pose.
    karate(p, at, time) {
      p.fist = true;
      p.footL = { x: -30, y: 0 };
      p.footR = { x: 30, y: 0 };
      p.hipY = -78;
      p.expr = "mad";
      p.back = { x: -10, y: -120 };
      p.front = { x: 40, y: -130 };
      if (at >= 0.3 && at < 0.8) {
        const k = seg(at, 0.3, 0.42);
        p.front = { x: G.lerp(40, 96, k), y: G.lerp(-170, -110, k) };
        p.frontOpen = true;
        p.fist = false;
        p.lean = 0.15 * k;
      } else if (at >= 0.8 && at < 1.3) {
        const k = seg(at, 0.8, 0.95);
        p.footR = { x: G.lerp(30, 86, k), y: G.lerp(0, -110, k) };
        p.lean = -0.3 * k;
        p.back = { x: -50, y: -150 };
      } else if (at >= 1.3 && at < 1.7) {
        const k = seg(at, 1.3, 1.42);
        p.back = { x: G.lerp(-10, 90, k), y: G.lerp(-120, -150, k) };
        p.backOpen = true;
        p.fist = false;
        p.lean = 0.1 * k;
      } else if (at >= 1.7 && at < 2.4) {
        const k = seg(at, 1.7, 2.4);
        p.sx = Math.cos(k * Math.PI * 2);
        p.jump = -bump(k) * 70;
        p.footR = { x: 80, y: -90 };
        p.footL = { x: -10, y: -20 };
      } else if (at >= 2.4) {
        p.footL = { x: -4, y: -56 };
        p.footR = { x: 14, y: 0 };
        p.hipY = -86;
        p.back = { x: -56, y: -210 };
        p.front = { x: 66, y: -214 };
        p.backOpen = true;
        p.frontOpen = true;
        p.fist = false;
        p.lean = Math.sin(time * 7) * 0.12;
        p.expr = "squint";
      }
    },
  };
  G.SILLY_ANIMS = Object.keys(SILLY);

  // ---------------------------------------------------------------- Pose

  // Returns the pose for animation `anim` at `at` seconds in, plus the idle clock.
  function pose(g, time) {
    const at = g.at;
    const p = {
      hipY: -86 + Math.sin(time * 2.2) * 1.5,
      lean: 0.04,
      headTilt: 0,
      jump: 0,
      fall: 0,
      expr: "sly",
      back: { x: -20, y: -78 },
      front: { x: 34, y: -72 },
      footL: { x: -10, y: 0 },
      footR: { x: 14, y: 0 },
      backOpen: false,
      frontOpen: false,
      fist: false,
      hatPop: 0,
      shake: 0,
      steam: false,
      sweat: false,
      stars: false,
      sx: 1,
      sy: 1,
      dx: 0,
      spin: 0,
      hatRot: 0,
    };
    if (SILLY[g.anim]) {
      SILLY[g.anim](p, at, time);
      return p;
    }
    // Rubbing hands sneakily now and then.
    if (g.anim === "idle") {
      const cycle = time % 7;
      if (cycle > 4.6 && cycle < 6.2) {
        const r = Math.sin(time * 18) * 4;
        p.back = { x: 18 + r, y: -112 };
        p.front = { x: 30 - r, y: -110 };
        p.expr = "grin";
      }
      p.footR.x = 14 + (time % 3 < 0.25 ? 3 : 0);
    } else if (g.anim === "load") {
      const k = Math.min(1, at / 0.6);
      const dip = Math.sin(k * Math.PI);
      p.hipY = -86 + dip * 22;
      p.lean = 0.04 + dip * 0.5;
      p.front = { x: G.lerp(40, g.pouchLX, k * k), y: G.lerp(-12, g.pouchLY, k * k) };
      p.back = { x: G.lerp(30, -10, k), y: G.lerp(-20, -80, k) };
      p.expr = "grin";
    } else if (g.anim === "aim") {
      p.lean = -0.1 - g.power * 0.12;
      p.hipY = -84 + g.power * 6;
      p.front = { x: g.pouchLX - 4, y: g.pouchLY + 2 };
      p.back = { x: g.pouchLX - 14, y: g.pouchLY + 8 };
      p.expr = g.power > 0.75 ? "mad" : "squint";
      p.footR.x = 22;
      p.footL.x = -18;
    } else if (g.anim === "throw") {
      const k = Math.min(1, at / 0.35);
      p.lean = 0.25 * Math.sin(k * Math.PI * 0.8);
      p.front = { x: 70, y: -130 + k * 30 };
      p.back = { x: -40, y: -100 };
      p.frontOpen = true;
      p.expr = "grin";
      p.footR.x = 26;
    } else if (g.anim === "celebrate") {
      p.jump = -Math.abs(Math.sin(at * 7)) * 34;
      p.back = { x: -40, y: -214 + Math.sin(at * 14) * 6 };
      p.front = { x: 46, y: -218 + Math.cos(at * 14) * 6 };
      p.backOpen = true;
      p.frontOpen = true;
      p.expr = "joy";
      p.hatPop = Math.abs(Math.sin(at * 7)) * 8;
      p.footL = { x: -14, y: p.jump < -10 ? -10 : 0 };
    } else if (g.anim === "laugh") {
      p.shake = Math.sin(at * 40) * 2;
      p.lean = -0.18 + Math.sin(at * 10) * 0.05;
      p.headTilt = -0.25;
      p.back = { x: 0, y: -84 };
      p.front = { x: 22, y: -80 };
      p.expr = "laugh";
      p.hipY = -86 + Math.abs(Math.sin(at * 10)) * 4;
    } else if (g.anim === "frustrated") {
      const stomp = Math.sin(at * 16);
      p.footL = { x: -10, y: stomp > 0 ? -stomp * 16 : 0 };
      p.footR = { x: 14, y: stomp < 0 ? stomp * 16 : 0 };
      p.back = { x: -24, y: -214 + Math.sin(at * 30) * 8 };
      p.front = { x: 30, y: -212 + Math.cos(at * 30) * 8 };
      p.fist = true;
      p.expr = "mad";
      p.steam = true;
      p.shake = Math.sin(at * 50) * 1.5;
    } else if (g.anim === "surprised") {
      const k = Math.min(1, at / 0.25);
      p.jump = -Math.sin(Math.min(1, at / 0.5) * Math.PI) * 26;
      p.back = { x: -46, y: -150 };
      p.front = { x: 52, y: -152 };
      p.backOpen = true;
      p.frontOpen = true;
      p.expr = "shock";
      p.hatPop = 18 * k * (1 - Math.min(1, Math.max(0, at - 0.6) / 0.4));
      p.lean = -0.15;
    } else if (g.anim === "disappointed") {
      p.lean = 0.3;
      p.hipY = -80;
      p.headTilt = 0.35;
      p.back = { x: -6, y: -34 };
      p.front = { x: 14, y: -30 };
      p.expr = "sad";
      p.sweat = true;
    } else if (g.anim === "dance") {
      const s = Math.sin(at * 10);
      p.lean = s * 0.15;
      p.hipY = -86 + Math.abs(Math.cos(at * 10)) * 6;
      p.footL = { x: -14 + s * 4, y: s > 0.3 ? -14 : 0 };
      p.footR = { x: 16 + s * 4, y: s < -0.3 ? -14 : 0 };
      p.back = { x: -40 + s * 10, y: -170 + s * 30 };
      p.front = { x: 46 + s * 10, y: -170 - s * 30 };
      p.backOpen = true;
      p.frontOpen = true;
      p.expr = "joy";
      p.headTilt = s * 0.15;
    } else if (g.anim === "hold") {
      // Title screen: hugging a giant snowball, bouncing it a little.
      const b = Math.sin(time * 3) * 4;
      p.back = { x: 30, y: -118 + b };
      p.front = { x: 88, y: -112 + b };
      p.lean = 0.05;
      p.expr = time % 5 > 3.6 ? "laugh" : "grin";
      p.holdY = -118 + b;
    } else if (g.anim === "fallback") {
      const k = at < 0.35 ? at / 0.35 : at < 1.7 ? 1 : Math.max(0, 1 - (at - 1.7) / 0.5);
      p.fall = -1.45 * G.easeOutBack(Math.min(1, k));
      p.expr = at < 1.7 ? "laugh" : "dizzy";
      p.stars = at > 0.35 && at < 2.1;
      const kick = Math.sin(at * 22);
      p.footL = { x: -10 + kick * 8, y: at > 0.35 && at < 1.7 ? -30 - kick * 14 : 0 };
      p.footR = { x: 14 - kick * 8, y: at > 0.35 && at < 1.7 ? -36 + kick * 14 : 0 };
      p.back = { x: -10, y: -84 };
      p.front = { x: 18, y: -80 };
    }
    return p;
  }

  // ---------------------------------------------------------------- Grinch

  // g: { x, y, anim, at, power, pouch: {x, y} } with (x, y) the point between the feet.
  Art.drawGrinch = (ctx, g, time) => {
    // Hands aim at the pouch, given relative to the feet.
    const S = g.scale || 1.22;
    g.pouchLX = g.pouch ? (g.pouch.x - g.x) / S : 60;
    g.pouchLY = g.pouch ? (g.pouch.y - g.y) / S : -110;
    const p = pose(g, time);
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(S, S);
    // On the title screen his giant snowball waits on the ground while he's being silly.
    if (g.rest === "hold" && SILLY[g.anim]) Art.drawSnowball(ctx, 104, -40, 40, "normal", 0, time, true, 1);
    if (p.egg) {
      Art.ellipse(ctx, -62, -14, 11, 14, "#fffaf0");
      Art.ellipse(ctx, -65, -19, 3, 5, "rgba(255,255,255,0.9)");
      ctx.strokeStyle = "#d8cbb0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-62, -14, 11, 14, 0, 0, TAU);
      ctx.stroke();
    }
    if (p.sx !== 1 || p.sy !== 1) ctx.scale(p.sx, p.sy);
    ctx.translate(p.shake + p.dx, p.jump);
    if (p.fall) ctx.rotate(p.fall);
    // Shadow.
    ctx.save();
    ctx.rotate(-p.fall);
    Art.ellipse(ctx, 0, 2 - p.jump, 46, 7, "rgba(40, 60, 100, 0.25)");
    ctx.restore();
    if (p.spin) {
      ctx.translate(0, -110);
      ctx.rotate(p.spin);
      ctx.translate(0, 110);
    }

    const hipY = p.hipY;
    const hip = { x: 0, y: hipY };
    // Torso leans around the hips.
    const lean = p.lean;
    const sh = { x: Math.sin(lean) * 52, y: hipY - Math.cos(lean) * 52 };
    const neck = { x: Math.sin(lean) * 66, y: hipY - Math.cos(lean) * 66 };

    // Back leg and arm.
    const legW = 10;
    const kL = joint(hip.x - 6, hip.y, p.footL.x, p.footL.y - 6, 46, 44, -1);
    limb(ctx, hip.x - 6, hip.y, kL.jx, kL.jy, kL.bx, kL.by, legW, FUR_DARK);
    Art.ellipse(ctx, kL.bx + 6, kL.by + 4, 15, 6, FUR_DARK);
    const aB = joint(sh.x - 8, sh.y, p.back.x, p.back.y, 44, 44, 1);
    limb(ctx, sh.x - 8, sh.y, aB.jx, aB.jy, aB.bx, aB.by, 9, FUR_DARK);
    if (p.flex) bicep(ctx, sh.x - 8, sh.y, aB, p.flex, FUR_DARK);
    glove(ctx, aB.bx, aB.by, 12, p.backOpen, p.fist);

    // Body: furry belly, red coat with white trim and a belt.
    ctx.save();
    ctx.translate(hip.x, hip.y);
    ctx.rotate(lean);
    Art.fluff(ctx, 0, -26, 30, 40, 14, 0.08, FUR);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(-30, -52);
    ctx.quadraticCurveTo(-38, -10, -32, 14);
    ctx.lineTo(30, 14);
    ctx.quadraticCurveTo(40, -10, 26, -52);
    ctx.quadraticCurveTo(0, -64, -30, -52);
    ctx.closePath();
    ctx.fill();
    // Open front showing the furry belly.
    Art.fluff(ctx, 12, -18, 13, 26, 9, 0.12, FUR_LIGHT);
    ctx.fillStyle = "#1d1d26";
    ctx.fillRect(-32, -6, 64, 9);
    ctx.fillStyle = "#ffd23f";
    Art.roundRect(ctx, 6, -8, 14, 13, 2);
    ctx.fill();
    ctx.fillStyle = "#1d1d26";
    ctx.fillRect(10, -4, 6, 5);
    // White fur trim.
    for (let i = 0; i < 8; i++) Art.circle(ctx, -30 + i * 8.6, 14, 6, "#ffffff");
    for (let i = 0; i < 5; i++) Art.circle(ctx, -24 + i * 12, -54 + Math.abs(i - 2) * 1.5, 6, "#ffffff");
    ctx.restore();

    // Front leg.
    const kR = joint(hip.x + 8, hip.y, p.footR.x, p.footR.y - 6, 46, 44, -1);
    limb(ctx, hip.x + 8, hip.y, kR.jx, kR.jy, kR.bx, kR.by, legW, FUR);
    Art.ellipse(ctx, kR.bx + 7, kR.by + 4, 16, 6.5, FUR);
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(kR.bx + 14 + i * 2, kR.by + 1);
      ctx.lineTo(kR.bx + 22 + i * 2, kR.by + 3);
      ctx.stroke();
    }

    // Head.
    ctx.save();
    ctx.translate(neck.x + 4, neck.y - 26);
    ctx.rotate(lean * 0.6 + p.headTilt);
    // Neck fur.
    Art.fluff(ctx, -4, 22, 15, 12, 8, 0.15, FUR);
    // Head shape: tall pear with a pointy chin, fur tufts on the cheeks.
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.bezierCurveTo(-26, -34, 34, -40, 34, -10);
    ctx.bezierCurveTo(48, 6, 34, 26, 16, 26);
    ctx.bezierCurveTo(0, 26, -20, 20, -22, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = FUR_DARK;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const [tx, ty, a] of [[-22, 6, 2.6], [-18, 16, 2.2], [40, 8, -0.4]]) {
      ctx.fillStyle = FUR;
      ctx.beginPath();
      ctx.moveTo(tx, ty - 5);
      ctx.lineTo(tx + Math.cos(a) * 12, ty + Math.sin(a) * 12);
      ctx.lineTo(tx, ty + 5);
      ctx.closePath();
      ctx.fill();
    }
    face(ctx, p.expr, time);
    // Santa hat flopping back, with a pompom.
    ctx.save();
    ctx.translate(0, -p.hatPop);
    if (p.hatRot) {
      ctx.translate(-12, -44);
      ctx.rotate(p.hatRot);
      ctx.translate(12, 44);
    }
    const flop = Math.sin(time * 3) * 0.08 + (p.jump ? 0.25 : 0);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(-24, -24);
    ctx.quadraticCurveTo(0, -78, -36 + flop * 30, -64);
    ctx.quadraticCurveTo(-54 + flop * 40, -50, -60 + flop * 30, -30);
    ctx.lineTo(-52 + flop * 30, -26);
    ctx.quadraticCurveTo(-36, -50, -6, -48);
    ctx.quadraticCurveTo(26, -50, 34, -26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COAT_DARK;
    ctx.beginPath();
    ctx.moveTo(-36 + flop * 30, -64);
    ctx.quadraticCurveTo(-54 + flop * 40, -50, -60 + flop * 30, -30);
    ctx.lineTo(-52 + flop * 30, -26);
    ctx.quadraticCurveTo(-44, -48, -36 + flop * 30, -64);
    ctx.fill();
    Art.fluff(ctx, -62 + flop * 30, -26, 10, 10, 8, 0.2, "#ffffff");
    Art.roundRect(ctx, -30, -34, 68, 14, 7);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    for (let i = 0; i < 6; i++) Art.circle(ctx, -26 + i * 12, -27 + (i % 2), 6, "#ffffff");
    ctx.restore();
    if (p.steam) {
      for (let i = 0; i < 2; i++) {
        const k = (time * 2 + i * 0.5) % 1;
        Art.fluff(ctx, -26 - k * 14, -10 - k * 40, 6 + k * 8, 5 + k * 6, 6, 0.2, `rgba(255,255,255,${0.8 - k * 0.8})`);
      }
    }
    if (p.sweat) {
      const k = (time * 0.8) % 1;
      ctx.fillStyle = "#7fd0ff";
      ctx.beginPath();
      ctx.moveTo(-14, -12 + k * 20);
      ctx.quadraticCurveTo(-20, -2 + k * 20, -14, 0 + k * 20);
      ctx.quadraticCurveTo(-8, -2 + k * 20, -14, -12 + k * 20);
      ctx.fill();
    }
    if (p.stars) {
      for (let i = 0; i < 3; i++) {
        const a = time * 5 + (i * TAU) / 3;
        ctx.fillStyle = "#ffd23f";
        Art.starPath(ctx, Math.cos(a) * 30, -46 + Math.sin(a) * 9, 7);
        ctx.fill();
      }
    }
    ctx.restore();

    if (p.holdY) Art.drawSnowball(ctx, 62, p.holdY, 40, "normal", 0, time, true, 1);

    // Front arm on top.
    const aF = joint(sh.x + 10, sh.y + 2, p.front.x, p.front.y, 44, 44, 1);
    limb(ctx, sh.x + 10, sh.y + 2, aF.jx, aF.jy, aF.bx, aF.by, 9.5, FUR);
    if (p.flex) bicep(ctx, sh.x + 10, sh.y + 2, aF, p.flex, FUR);
    glove(ctx, aF.bx, aF.by, 13, p.frontOpen, p.fist);
    if (p.balls) for (const b of p.balls) Art.drawSnowball(ctx, b.x, b.y, 13, "normal", 0, time, false, 1);
    ctx.restore();
  };

  // A bulging muscle on the upper arm, between shoulder (sx, sy) and elbow.
  function bicep(ctx, sx, sy, a, k, color) {
    const mx = G.lerp(sx, a.jx, 0.55);
    const my = G.lerp(sy, a.jy, 0.55) - 4;
    Art.circle(ctx, mx, my, 4 + k * 8, color);
    Art.circle(ctx, mx - 2, my - 3, 1 + k * 2.5, "rgba(255,255,255,0.35)");
  }

  // Where a part of the Grinch is in the world right now, and which way it points (dx, dy).
  // part: "butt" (for fart clouds) or "nose" (for sneezes). Mirrors drawGrinch's transforms.
  Art.grinchPoint = (g, time, part) => {
    const S = g.scale || 1.22;
    g.pouchLX = g.pouchLX || 60;
    g.pouchLY = g.pouchLY || -110;
    const p = pose(g, time);
    const c = Math.cos(p.lean);
    const s = Math.sin(p.lean);
    let x;
    let y;
    let dirX;
    let dirY;
    if (part === "nose") {
      const hr = p.lean * 0.6 + p.headTilt;
      const hc = Math.cos(hr);
      const hs = Math.sin(hr);
      x = s * 66 + 4 + 36 * hc - hs;
      y = p.hipY - c * 66 - 26 + 36 * hs + hc;
      dirX = hc;
      dirY = hs;
    } else {
      x = -34 * c + 6 * s;
      y = p.hipY - 34 * s - 6 * c;
      dirX = -c;
      dirY = -s;
    }
    const rot = (a, cx, cy) => {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rx = x - cx;
      const ry = y - cy;
      x = cx + rx * ca - ry * sa;
      y = cy + rx * sa + ry * ca;
      const ddx = dirX * ca - dirY * sa;
      dirY = dirX * sa + dirY * ca;
      dirX = ddx;
    };
    if (p.spin) rot(p.spin, 0, -110);
    if (p.fall) rot(p.fall, 0, 0);
    x = (x + p.shake + p.dx) * p.sx;
    y = (y + p.jump) * p.sy;
    return { x: g.x + x * S, y: g.y + y * S, dx: dirX * Math.sign(p.sx || 1), dy: dirY };
  };

  // ---------------------------------------------------------------- Launcher

  G.LAUNCH = { x: 340, y: 690, tipBack: { x: 322, y: 676 }, tipFront: { x: 360, y: 672 } };

  Art.drawLauncherBack = (ctx, pouch) => {
    const L = G.LAUNCH;
    // Back prong and band.
    ctx.strokeStyle = "#5a3416";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(340, 760);
    ctx.quadraticCurveTo(326, 720, L.tipBack.x, L.tipBack.y);
    ctx.stroke();
    band(ctx, L.tipBack, pouch, "#2a6e2f");
  };

  Art.drawLauncherFront = (ctx, pouch, hasBall) => {
    const L = G.LAUNCH;
    band(ctx, L.tipFront, pouch, "#3c9a3f");
    // Pouch: a stolen stocking.
    if (hasBall || pouch) {
      ctx.fillStyle = "#c4161c";
      Art.roundRect(ctx, pouch.x - 12, pouch.y - 9, 20, 18, 6);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(pouch.x - 12, pouch.y - 9, 5, 18);
    }
    // Trunk and front prong.
    ctx.strokeStyle = "#7a4a22";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(340, G.HILL_Y + 6);
    ctx.lineTo(340, 750);
    ctx.quadraticCurveTo(356, 718, L.tipFront.x, L.tipFront.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(336, G.HILL_Y);
    ctx.lineTo(336, 752);
    ctx.stroke();
    // Snow on top of the prongs and a wooden sign.
    Art.ellipse(ctx, L.tipFront.x, L.tipFront.y - 6, 10, 5, "#ffffff");
    Art.ellipse(ctx, L.tipBack.x, L.tipBack.y - 6, 9, 4, "#f0f6fc");
    ctx.save();
    ctx.translate(340, 786);
    ctx.rotate(0.05);
    Art.roundRect(ctx, -34, -11, 68, 22, 4);
    ctx.fillStyle = "#a8692f";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 10px Oxanium, 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SNOW-SLINGER", 0, 0);
    ctx.restore();
  };

  function band(ctx, tip, pouch, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(pouch.x, pouch.y);
    ctx.stroke();
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------------------------------------------------------------- Snowballs

  const RAINBOW = ["#ff4b5c", "#ff9f1c", "#ffd23f", "#4be37a", "#3fb7ff", "#9b4dff"];
  G.SNOWBALL_COLORS = {
    normal: "#ffffff",
    mega: "#bfe8ff",
    bouncy: "#ff7ad9",
    explosive: "#ff4b5c",
    split: "#9fe6ff",
    rainbow: "#ffd23f",
  };

  // A snowball with a determined little face.
  Art.drawSnowball = (ctx, x, y, r, type, spin, time, faceOn = true, vx = 1) => {
    ctx.save();
    ctx.translate(x, y);
    if (type === "rainbow") {
      ctx.save();
      ctx.rotate(spin);
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, (i / 6) * TAU, ((i + 1) / 6) * TAU);
        ctx.closePath();
        ctx.fillStyle = RAINBOW[i];
        ctx.fill();
      }
      ctx.restore();
      const hg = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 1, 0, 0, r);
      hg.addColorStop(0, "rgba(255,255,255,0.8)");
      hg.addColorStop(0.5, "rgba(255,255,255,0.15)");
      hg.addColorStop(1, "rgba(255,255,255,0)");
      Art.circle(ctx, 0, 0, r, hg);
    } else {
      const base = { normal: ["#ffffff", "#b5d3ef"], mega: ["#eef9ff", "#7fc2f0"], bouncy: ["#ffd1f1", "#e04fb4"], explosive: ["#ffd0d0", "#d61f2c"], split: ["#f2fcff", "#6fc8e8"] }[type] || ["#fff", "#b5d3ef"];
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
      g.addColorStop(0, base[0]);
      g.addColorStop(1, base[1]);
      Art.circle(ctx, 0, 0, r, g);
      ctx.save();
      ctx.rotate(spin);
      if (type === "bouncy") {
        ctx.strokeStyle = "#5fd0ff";
        ctx.lineWidth = r * 0.22;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, Math.PI - 0.6, Math.PI + 0.6);
        ctx.stroke();
      } else if (type === "explosive") {
        ctx.fillStyle = "#1d1d1d";
        ctx.fillRect(-r, -r * 0.14, r * 2, r * 0.28);
        ctx.fillStyle = "#ffd23f";
        for (let i = -3; i <= 3; i++) ctx.fillRect(i * r * 0.3 - r * 0.07, -r * 0.14, r * 0.14, r * 0.28);
      } else if (type === "split") {
        ctx.strokeStyle = "rgba(40, 120, 170, 0.7)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos((i * TAU) / 3) * r, Math.sin((i * TAU) / 3) * r);
          ctx.stroke();
        }
      } else if (type === "mega") {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
          ctx.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
          ctx.stroke();
        }
      } else {
        // Lumpy snow texture.
        Art.circle(ctx, r * 0.35, r * 0.3, r * 0.14, "rgba(160, 195, 230, 0.5)");
        Art.circle(ctx, -r * 0.3, r * 0.45, r * 0.1, "rgba(160, 195, 230, 0.5)");
      }
      ctx.restore();
    }
    if (type === "explosive") {
      const f = (Math.sin(time * 40) + 1) / 2;
      Art.circle(ctx, 0, -r - 3, 3 + f * 3, "#ffb030");
      Art.sparkle(ctx, 0, -r - 3, 5 + f * 3, "#fff6a0");
    }
    if (faceOn) {
      // Angry little eyebrows and eyes, always upright, looking the way it flies.
      const d = vx >= 0 ? 1 : -1;
      const s = r / 20;
      ctx.fillStyle = "#1d1d26";
      Art.circle(ctx, d * 3 * s, -3 * s, 2.6 * s, "#1d1d26");
      Art.circle(ctx, d * 11 * s, -3 * s, 2.4 * s, "#1d1d26");
      ctx.strokeStyle = "#1d1d26";
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.moveTo(d * -1 * s, -10 * s);
      ctx.lineTo(d * 6 * s, -7 * s);
      ctx.moveTo(d * 8 * s, -7 * s);
      ctx.lineTo(d * 15 * s, -10 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d * 3 * s, 6 * s);
      ctx.quadraticCurveTo(d * 8 * s, 3 * s, d * 13 * s, 6 * s);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- Max

  // Max the dog with his antler headband. dir: 1 running right, -1 left.
  Art.drawMax = (ctx, x, y, time, dir, state) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    const run = state === "run" || state === "bump";
    const ph = time * (run ? 18 : 4);
    const bob = run ? Math.abs(Math.sin(ph)) * -5 : 0;
    Art.ellipse(ctx, 0, 2, 34, 6, "rgba(40,60,100,0.25)");
    ctx.translate(0, bob);
    const fur = "#8a5a33";
    const dark = "#5e3a1e";
    // Legs.
    ctx.strokeStyle = dark;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    for (const [lx, o] of [[-18, 0], [-10, Math.PI], [14, Math.PI * 0.5], [22, Math.PI * 1.5]]) {
      const sw = run ? Math.sin(ph + o) * 10 : 0;
      ctx.beginPath();
      ctx.moveTo(lx, -22);
      ctx.lineTo(lx + sw, -2);
      ctx.stroke();
    }
    // Tail.
    ctx.strokeStyle = fur;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-28, -32);
    ctx.quadraticCurveTo(-40, -48 + Math.sin(time * 20) * 6, -44, -56 + Math.sin(time * 20) * 8);
    ctx.stroke();
    // Body.
    Art.fluff(ctx, 0, -32, 32, 15, 14, 0.12, fur);
    // Head.
    Art.fluff(ctx, 34, -50, 17, 15, 10, 0.12, fur);
    Art.ellipse(ctx, 48, -44, 10, 7, "#a87448");
    Art.circle(ctx, 57, -46, 4, "#1d1d1d");
    Art.circle(ctx, 38, -55, 3.4, "#1d1d1d");
    Art.circle(ctx, 39, -56, 1.2, "#ffffff");
    // Ear.
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(26, -50, 6, 13, 0.5 + Math.sin(ph) * 0.2, 0, TAU);
    ctx.fill();
    // Tongue when running.
    if (run) Art.ellipse(ctx, 52, -36, 4, 6, "#ff7a8a");
    // Antler headband with red string.
    ctx.strokeStyle = "#c98a4b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(34, -62);
    ctx.lineTo(36, -84);
    ctx.moveTo(35, -74);
    ctx.lineTo(44, -82);
    ctx.moveTo(36, -82);
    ctx.lineTo(30, -90);
    ctx.stroke();
    ctx.strokeStyle = "#e0303a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(34, -64);
    ctx.quadraticCurveTo(40, -54, 46, -50);
    ctx.stroke();
    // Collar.
    ctx.strokeStyle = "#e0303a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(28, -42, 9, 0.4, 2.2);
    ctx.stroke();
    Art.circle(ctx, 26, -33, 3, "#ffd23f");
    ctx.restore();
  };

  // ---------------------------------------------------------------- Speech bubble

  // A rounded bubble whose tail points at (tx, ty). Text is drawn in world units.
  Art.bubble = (ctx, x, y, text, alpha, tx, ty) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "800 22px Oxanium, 'Trebuchet MS', sans-serif";
    const words = text.split(" ");
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > 300 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34;
    const h = lines.length * 26 + 22;
    const bx = x;
    const by = y - h;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1d2a4a";
    ctx.lineWidth = 3.5;
    Art.roundRect(ctx, bx, by, w, h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + 26, by + h - 2);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 52, by + h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx + 26, by + h);
    ctx.lineTo(tx, ty);
    ctx.lineTo(bx + 52, by + h);
    ctx.stroke();
    ctx.fillStyle = "#1d2a4a";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((l, i) => ctx.fillText(l, bx + 17, by + 12 + i * 26));
    ctx.restore();
  };
})(window.GS);
