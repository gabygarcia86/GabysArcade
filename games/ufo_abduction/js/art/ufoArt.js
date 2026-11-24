/*
 * The flying saucer, its pilot and its shield. Drawn around (0, 0) = the middle of the disc.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const Art = (U.Art = U.Art || {});
  let hullGradient = null;
  let hullCtx = null;

  function hull(ctx) {
    // Gradients belong to a context, so make one per canvas and reuse it.
    if (hullCtx !== ctx) {
      hullCtx = ctx;
      hullGradient = ctx.createLinearGradient(0, -18, 0, 16);
      hullGradient.addColorStop(0, "#ffffff");
      hullGradient.addColorStop(0.45, "#d6cff7");
      hullGradient.addColorStop(1, "#8f82d8");
    }
    return hullGradient;
  }

  // o: { t, tilt, flash, mood, look, beam, scale, cheer, alpha }
  Art.drawUFO = function (ctx, x, y, o) {
    const t = o.t || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.rotate(o.tilt || 0);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;

    // Engine glow under the saucer.
    const pulse = 0.75 + Math.sin(t * 9) * 0.25;
    ctx.fillStyle = o.beam ? "rgba(120, 255, 220, 0.55)" : `rgba(120, 220, 255, ${0.35 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(0, 16, 38 * pulse, 10, 0, 0, U.TAU);
    ctx.fill();

    // Lower hull.
    D.ell(ctx, 0, 8, 44, 14, "#6a4fd8", 3);
    D.ell(ctx, 0, 15, 20, 6, o.beam ? "#bfffee" : "#9fe7ff", 2.5);

    // Pilot behind the glass.
    drawPilot(ctx, o, t);

    // Glass dome.
    ctx.beginPath();
    ctx.ellipse(0, -8, 31, 29, 0, Math.PI, U.TAU);
    ctx.closePath();
    ctx.fillStyle = "rgba(150, 235, 255, 0.38)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = D.OUT;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, -8, 23, Math.PI * 1.2, Math.PI * 1.42);
    ctx.stroke();

    // Antenna light.
    D.line(ctx, 0, -37, 0, -46, D.OUT, 3);
    const blink = Math.sin(t * 6) > 0;
    D.circ(ctx, 0, -48, 4.5, blink ? "#ff5fb4" : "#ffd1ea", 2.5);

    // Main disc.
    D.ell(ctx, 0, 0, 66, 17, hull(ctx), 3);
    // Pink rim band.
    ctx.strokeStyle = "#ff5fb4";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 2, 60, 11, 0, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    // Shine.
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -2, 50, 10, 0, Math.PI * 1.15, Math.PI * 1.45);
    ctx.stroke();

    // Chasing rim lights.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.13 + (i / 6) * 0.74);
      const lx = Math.cos(a) * 54;
      const ly = 3 + Math.sin(a) * 9;
      const phase = (i - t * (o.beam ? 14 : 6)) % 7;
      const lit = ((phase + 7) % 7) < 2;
      const hue = (i * 52 + t * 90) % 360;
      ctx.fillStyle = lit ? `hsl(${hue}, 100%, 70%)` : `hsl(${hue}, 60%, 40%)`;
      ctx.strokeStyle = D.OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly, 4.4, 0, U.TAU);
      ctx.fill();
      ctx.stroke();
      if (lit) {
        ctx.fillStyle = `hsla(${hue}, 100%, 70%, 0.35)`;
        ctx.beginPath();
        ctx.arc(lx, ly, 9, 0, U.TAU);
        ctx.fill();
      }
    }

    if (o.flash) {
      // A red wash over the hull, drawn as shapes so the scenery behind isn't tinted.
      ctx.fillStyle = "rgba(255, 70, 70, 0.6)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 66, 17, 0, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 8, 44, 14, 0, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, -8, 31, 29, 0, Math.PI, U.TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  function drawPilot(ctx, o, t) {
    const look = U.clamp(o.look || 0, -1, 1);
    const bob = Math.sin(t * 3) * 1.2;
    const hx = look * 6;
    const hy = -16 + bob;
    const mood = o.mood || "normal";
    // Body.
    D.ell(ctx, hx * 0.6, -1, 13, 9, "#6ee86e", 2.5);
    // Arms: up when cheering, on the controls when beaming.
    if (o.cheer) {
      const w = Math.sin(t * 20) * 0.4;
      D.limb(ctx, hx - 9, -4, hx - 17, -22 + w * 6, 3.5, "#6ee86e", 2);
      D.limb(ctx, hx + 9, -4, hx + 17, -22 - w * 6, 3.5, "#6ee86e", 2);
    }
    // Antennae.
    const sway = Math.sin(t * 4) * 3;
    D.line(ctx, hx - 5, hy - 10, hx - 9 + sway, hy - 21, D.OUT, 2);
    D.line(ctx, hx + 5, hy - 10, hx + 9 + sway, hy - 21, D.OUT, 2);
    D.circ(ctx, hx - 9 + sway, hy - 22, 3, "#ffe36b", 1.8);
    D.circ(ctx, hx + 9 + sway, hy - 22, 3, "#ffe36b", 1.8);
    // Head.
    D.ell(ctx, hx, hy, 14, 12.5, "#8dff5a", 2.5);
    // Big alien eyes.
    const blink = (t % 3.7) < 0.12;
    const ex = hx + look * 3;
    if (mood === "happy" || o.cheer) {
      D.eye(ctx, ex - 5.5, hy - 1, 4.5, 0, 0, "happy");
      D.eye(ctx, ex + 5.5, hy - 1, 4.5, 0, 0, "happy");
    } else if (mood === "dizzy") {
      D.eye(ctx, ex - 5.5, hy - 1, 4.5, 0, 0, "dizzy", t);
      D.eye(ctx, ex + 5.5, hy - 1, 4.5, 0, 0, "dizzy", t);
    } else if (blink) {
      D.line(ctx, ex - 9, hy - 1, ex - 2, hy - 1, D.OUT, 2.5);
      D.line(ctx, ex + 2, hy - 1, ex + 9, hy - 1, D.OUT, 2.5);
    } else {
      ctx.fillStyle = D.OUT;
      ctx.beginPath();
      ctx.ellipse(ex - 5.5, hy - 1, 4.2, 5.6, -0.35, 0, U.TAU);
      ctx.ellipse(ex + 5.5, hy - 1, 4.2, 5.6, 0.35, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex - 6.5 + look, hy - 3, 1.6, 0, U.TAU);
      ctx.arc(ex + 4.5 + look, hy - 3, 1.6, 0, U.TAU);
      ctx.fill();
    }
    if (mood === "worried") {
      D.mouth(ctx, hx + look * 2, hy + 7, 6, "wavy");
      D.sweat(ctx, hx + 13, hy - 8, 3.5, t);
    } else if (mood === "happy" || o.cheer) {
      D.mouth(ctx, hx + look * 2, hy + 6, 7, "grin");
    } else {
      D.mouth(ctx, hx + look * 2, hy + 6, 5, "smile");
    }
  }

  Art.drawPilot = drawPilot;

  // A shimmering bubble. `left` is the seconds remaining, so it flickers before it ends.
  Art.drawShield = function (ctx, x, y, t, left) {
    if (left < 2 && Math.floor(t * 10) % 2 === 0) return;
    const r = 84 + Math.sin(t * 6) * 3;
    const g = ctx.createRadialGradient(x, y - 6, r * 0.55, x, y - 6, r);
    g.addColorStop(0, "rgba(120, 240, 255, 0)");
    g.addColorStop(0.8, "rgba(120, 240, 255, 0.18)");
    g.addColorStop(1, "rgba(180, 255, 255, 0.55)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 6, r, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(200, 255, 255, ${0.6 + Math.sin(t * 9) * 0.3})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y - 6, r - 10, Math.PI * 1.15 + t, Math.PI * 1.35 + t);
    ctx.stroke();
  };
})(window.UFO);
