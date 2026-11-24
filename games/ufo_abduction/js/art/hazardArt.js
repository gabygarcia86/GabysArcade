/*
 * Hazards and projectiles. Everything dangerous gets angry eyebrows and a pulsing red ring
 * on the ground, so it never looks like something you'd want to beam up.
 */
(function (U) {
  "use strict";

  const D = U.Draw;
  const OUT = D.OUT;
  const Art = (U.Art = U.Art || {});

  function dangerRing(ctx, x, y, rx, t) {
    const a = 0.25 + Math.sin(t * 6) * 0.12;
    ctx.fillStyle = `rgba(255, 40, 60, ${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 60, 80, ${a + 0.25})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function wheel(ctx, x, y, r, t, spin, hub = "#ffd23f") {
    D.circ(ctx, x, y, r, "#2a2433", 3);
    D.circ(ctx, x, y, r * 0.45, hub, 2.5);
    const a = spin;
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const aa = a + (i / 3) * U.TAU;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(aa) * r * 0.45, y + Math.sin(aa) * r * 0.45);
    }
    ctx.stroke();
  }

  function angryEyes(ctx, x, y, gap, r, lx, t) {
    D.eye(ctx, x - gap / 2, y, r, lx, 0.2, "angry", t, 1);
    D.eye(ctx, x + gap / 2, y, r, lx, 0.2, "angry", t, -1);
  }

  // A jagged bolt from (x1, y1) to (x2, y2). The seed keeps it from flickering too fast.
  function bolt(ctx, x1, y1, x2, y2, seed, width = 4) {
    const rnd = U.seeded(seed);
    const steps = 9;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const jitter = i === 0 || i === steps ? 0 : (rnd() - 0.5) * 34;
      pts.push(U.lerp(x1, x2, k) + jitter, U.lerp(y1, y2, k));
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const [w, c] of [[width + 10, "rgba(255, 240, 120, 0.35)"], [width + 3, "#fff36b"], [Math.max(1.5, width - 1.5), "#ffffff"]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.stroke();
    }
  }

  const H = (Art.hazards = {
    bull(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 52, t);
      D.shadow(ctx, h.x, h.groundY, 40 * (1 - Math.min(0.6, h.lift / 300)));
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(h.facing, 1);
      if (h.lift > 0) ctx.rotate(-0.25);
      U.Art.drawQuad(ctx, "bull", { t, phase: h.phase, moving: h.moving, panic: h.charging, snort: h.snort > 0, lx: 0.5, ly: -0.6 });
      ctx.restore();
    },

    tractor(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 70, t);
      D.shadow(ctx, h.x, h.groundY, 60);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing, 1);
      const shake = Math.sin(t * 30) * 1;
      ctx.translate(0, shake);
      // Exhaust.
      D.rect(ctx, 12, -88, 7, 26, "#555", 2.5, 2);
      // Body and cab.
      D.rect(ctx, -52, -62, 70, 36, "#e8463c", 3, 6);
      D.rect(ctx, 10, -54, 46, 26, "#e8463c", 3, 6);
      D.rect(ctx, -46, -98, 40, 40, "#e8463c", 3, 6);
      D.rect(ctx, -40, -92, 28, 22, "#bfefff", 2.5, 4);
      // Grumpy driver.
      D.circ(ctx, -26, -78, 8, "#f2c29b", 2);
      D.line(ctx, -31, -82, -23, -80, OUT, 2);
      // Grille face.
      D.rect(ctx, 46, -52, 12, 22, "#ffd23f", 2.5, 3);
      angryEyes(ctx, 32, -44, 12, 4, 0.6, t);
      wheel(ctx, -32, -22, 24, t, h.spin, "#ffd23f");
      wheel(ctx, 40, -14, 14, t, h.spin * 1.6, "#ffd23f");
      ctx.restore();
    },

    fence(ctx, h, t) {
      const x0 = h.x - h.w / 2;
      const base = h.groundY;
      if (h.zapping || h.charging) dangerRing(ctx, h.x, base, h.w * 0.6, t);
      if (h.variant === "power") {
        // City power cables between two transformer poles.
        for (const px of [x0 + 10, x0 + h.w - 10]) {
          D.rect(ctx, px - 6, base - 118, 12, 118, "#6b7083", 3, 2);
          D.rect(ctx, px - 20, base - 120, 40, 8, "#4b5063", 2.5, 2);
          D.rect(ctx, px - 16, base - 70, 32, 30, "#9aa3b8", 3, 4);
          D.poly(ctx, [px - 4, base - 64, px + 4, base - 64, px - 1, base - 55, px + 5, base - 55, px - 5, base - 44, px - 1, base - 53, px - 7, base - 53], "#ffd23f", 1.5);
        }
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 3;
        for (const dy of [-116, -100]) {
          ctx.beginPath();
          ctx.moveTo(x0 + 10, base + dy);
          ctx.quadraticCurveTo(h.x, base + dy + 22, x0 + h.w - 10, base + dy);
          ctx.stroke();
        }
      } else {
        const posts = 4;
        for (let i = 0; i < posts; i++) {
          const px = x0 + (i / (posts - 1)) * h.w;
          D.rect(ctx, px - 5, base - 62, 10, 62, "#9a6a3a", 2.5, 2);
          D.circ(ctx, px, base - 50, 3, "#fff", 1.5);
          D.circ(ctx, px, base - 28, 3, "#fff", 1.5);
        }
        ctx.strokeStyle = h.zapping ? "#fff36b" : "#ffd23f";
        ctx.lineWidth = 2.5;
        for (const dy of [-50, -28]) {
          ctx.beginPath();
          ctx.moveTo(x0, base + dy);
          ctx.lineTo(x0 + h.w, base + dy);
          ctx.stroke();
        }
        // Warning sign.
        D.rect(ctx, h.x - 13, base - 46, 26, 20, "#ffd23f", 2.5, 3);
        D.poly(ctx, [h.x + 2, base - 43, h.x - 5, base - 35, h.x, base - 35, h.x - 3, base - 29, h.x + 5, base - 38, h.x, base - 38], OUT, 0);
      }
      if (h.charging) {
        // Sparks crawl along the wires before the big zap.
        for (let i = 0; i < 5; i++) {
          const sx = x0 + ((t * 300 + i * 61) % h.w);
          const sy = base - (h.variant === "power" ? 106 : 40) + Math.sin(t * 40 + i) * 8;
          D.star(ctx, sx, sy, 6, "#fff36b", 0, 4, 0.35, t * 10 + i);
        }
      }
      if (h.zapping) {
        const seed = Math.floor(t * 18);
        const n = h.variant === "power" ? 3 : 4;
        for (let i = 0; i < n; i++) {
          const bx = x0 + (i / (n - 1)) * h.w;
          bolt(ctx, bx, base - (h.variant === "power" ? 118 : 60), bx + Math.sin(seed + i) * 20, h.zapTop, seed * 7 + i, 4);
        }
      }
    },

    helicopter(ctx, h, t) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(h.facing, 1);
      ctx.rotate(h.tilt * h.facing);
      // Tail.
      D.rect(ctx, -86, -10, 54, 10, "#2c3e78", 3, 4);
      const tr = t * 40;
      D.ell(ctx, -86, -6, 3 + Math.abs(Math.sin(tr)) * 12, 3, "rgba(220,220,240,0.7)", 2);
      // Skids.
      D.line(ctx, -26, 28, 30, 28, OUT, 4);
      D.line(ctx, -14, 18, -18, 28, OUT, 3);
      D.line(ctx, 16, 18, 20, 28, OUT, 3);
      // Body.
      D.ell(ctx, 0, 0, 44, 22, "#ffffff", 3);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, 42.5, 20.5, 0, 0, U.TAU);
      ctx.clip();
      D.rect(ctx, -46, 4, 92, 22, "#2c3e78", 0);
      ctx.restore();
      ctx.fillStyle = "#fff";
      ctx.font = "800 11px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("POLICE", -6, 15);
      // Cockpit and pilot.
      ctx.beginPath();
      ctx.ellipse(22, -4, 18, 14, 0, -Math.PI * 0.5, Math.PI * 0.4);
      ctx.lineTo(18, -4);
      ctx.closePath();
      ctx.fillStyle = "#bfefff";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      D.circ(ctx, 26, -4, 6, "#f0c7a4", 2);
      D.rect(ctx, 24, -8, 10, 4, "#111", 0, 1);
      // Siren lights.
      const on = Math.floor(t * 8) % 2 === 0;
      D.rect(ctx, -10, -27, 9, 6, on ? "#ff3b3b" : "#7a1d1d", 2, 2);
      D.rect(ctx, 1, -27, 9, 6, on ? "#2d5bff" : "#ff3b3b", 2, 2);
      if (on) {
        ctx.fillStyle = "rgba(255,60,60,0.25)";
        ctx.beginPath();
        ctx.arc(-6, -24, 16, 0, U.TAU);
        ctx.fill();
      }
      // Rotor.
      D.line(ctx, 0, -22, 0, -32, OUT, 4);
      const blade = Math.sin(t * 50);
      ctx.fillStyle = "rgba(230,230,250,0.55)";
      ctx.beginPath();
      ctx.ellipse(0, -33, 70, 4, 0, 0, U.TAU);
      ctx.fill();
      D.line(ctx, -70 * blade, -33, 70 * blade, -33, OUT, 3.5);
      ctx.restore();
    },

    cloud(ctx, h, t) {
      ctx.save();
      ctx.translate(h.x, h.y);
      const flash = h.charging && Math.floor(t * 16) % 2 === 0;
      const body = flash ? "#9b98c9" : "#5b587e";
      const puffs = [[-60, 6, 30], [-30, -12, 38], [10, -18, 42], [50, -4, 34], [70, 12, 24], [-20, 16, 30], [30, 16, 30]];
      for (const [x, y, r] of puffs) D.circ(ctx, x, y + Math.sin(t * 2 + x) * 2, r + 2, OUT, 0);
      for (const [x, y, r] of puffs) D.circ(ctx, x, y + Math.sin(t * 2 + x) * 2, r, body, 0);
      D.ell(ctx, 0, 20, 82, 16, shadeHex(body), 0);
      angryEyes(ctx, 4, -6, 30, 7, 0, t);
      D.mouth(ctx, 4, 14, 18, "frown");
      if (h.charging) {
        for (let i = 0; i < 3; i++) D.star(ctx, -50 + i * 50 + Math.sin(t * 20 + i) * 6, 34, 7, "#fff36b", 1.5, 4, 0.3, t * 8);
      }
      ctx.restore();
      if (h.striking) bolt(ctx, h.x, h.y + 30, h.x + Math.sin(t * 50) * 14, h.boltBottom, Math.floor(t * 20), 7);
    },

    rocket(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 66, t);
      D.shadow(ctx, h.x, h.groundY, 56);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing, 1);
      D.rect(ctx, -58, -48, 82, 28, "#6f8a3c", 3, 4);
      D.rect(ctx, 22, -60, 36, 40, "#7f9a4c", 3, 6);
      D.rect(ctx, 30, -54, 20, 14, "#bfefff", 2.5, 3);
      D.circ(ctx, 40, -47, 5, "#d8a47c", 1.8);
      D.line(ctx, 37, -50, 43, -48, OUT, 2);
      // Launcher tube aimed at the saucer.
      ctx.save();
      ctx.translate(-22, -50);
      const aim = h.aim;
      ctx.rotate(-aim);
      D.rect(ctx, -6, -12, 58, 24, "#556b2f", 3, 5);
      D.rect(ctx, 44, -14, 12, 28, "#3d4f20", 3, 3);
      D.star(ctx, 16, 0, 6, "#ffd23f", 1.5);
      ctx.restore();
      D.circ(ctx, -22, -50, 10, "#3d4f20", 3);
      wheel(ctx, -40, -18, 14, t, h.spin, "#bbb");
      wheel(ctx, 8, -18, 14, t, h.spin, "#bbb");
      wheel(ctx, 40, -18, 14, t, h.spin, "#bbb");
      ctx.restore();
    },

    giantFarmer(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 70, t);
      D.shadow(ctx, h.x, h.groundY, 55);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing * 2.3, 2.3);
      U.Art.drawHuman(ctx, "giantFarmer", { t, phase: h.phase, moving: h.moving, angry: true, throwing: h.throwT > 0, lx: 0.6, ly: -0.8 });
      ctx.restore();
      if (h.shout > 0) D.bubble(ctx, h.x, h.groundY - 230, h.shoutText, { size: 16, color: "#c4352b" });
    },

    eagle(ctx, h, t) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(h.facing, 1);
      ctx.rotate(h.tilt);
      const pel = h.variant === "pelican";
      const body = pel ? "#f4f4f4" : "#7a4a22";
      const flap = Math.sin(t * (h.diving ? 4 : 13));
      // Back wing.
      ctx.save();
      ctx.rotate(-0.4 - flap * 0.7);
      D.ell(ctx, -6, -18, 12, 30, pel ? "#d9d9d9" : "#5a3416", 3, -0.2);
      ctx.restore();
      D.poly(ctx, [-26, -2, -46, -12, -44, 10], pel ? "#d9d9d9" : "#f4f4f4", 2.5);
      D.ell(ctx, 0, 0, 30, 14, body, 3);
      // Talons.
      D.line(ctx, -4, 12, -2, 22, "#ffb02e", 3);
      D.line(ctx, 6, 12, 8, 22, "#ffb02e", 3);
      // Head.
      D.circ(ctx, 28, -8, 12, pel ? "#ffffff" : "#ffffff", 3);
      if (pel) {
        D.poly(ctx, [36, -10, 70, -2, 36, 2], "#ffb02e", 2.5);
        D.ell(ctx, 48, 6, 13, 7, "#ff9a3d", 2.5);
      } else {
        D.poly(ctx, [37, -12, 52, -6, 44, 4, 37, -2], "#ffd23f", 2.5);
      }
      D.eye(ctx, 30, -11, 4, 1, 0.3, "angry", t, 1);
      // Front wing.
      ctx.save();
      ctx.rotate(0.2 + flap * 0.8);
      D.ell(ctx, -2, -20, 13, 34, pel ? "#ffffff" : "#8a5a2b", 3, -0.3);
      ctx.restore();
      ctx.restore();
      if (h.telegraph > 0) D.warning(ctx, h.x, h.y - 46, t, 0.9);
    },

    tank(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 76, t);
      D.shadow(ctx, h.x, h.groundY, 66);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing, 1);
      // Treads.
      D.rect(ctx, -66, -30, 132, 28, "#3a3a3a", 3, 14);
      for (let i = 0; i < 6; i++) wheel(ctx, -52 + i * 21, -16, 9, t, h.spin, "#777");
      // Hull.
      D.poly(ctx, [-62, -30, 62, -30, 52, -54, -56, -54], "#5d7a3a", 3);
      D.star(ctx, -24, -42, 8, "#ffd23f", 2);
      // Barrel.
      ctx.save();
      ctx.translate(8, -64);
      const aim = h.aim;
      ctx.rotate(-aim - h.recoil * 0.1);
      D.rect(ctx, 0 - h.recoil * 8, -6, 62, 12, "#4c6430", 3, 3);
      D.rect(ctx, 54 - h.recoil * 8, -9, 12, 18, "#3d4f20", 3, 3);
      ctx.restore();
      // Turret with an angry face.
      ctx.beginPath();
      ctx.ellipse(4, -56, 34, 22, 0, Math.PI, U.TAU);
      ctx.closePath();
      ctx.fillStyle = "#6f8a3c";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      angryEyes(ctx, 10, -66, 16, 4.6, 0.7, t);
      ctx.restore();
    },

    policeCar(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 66, t);
      D.shadow(ctx, h.x, h.groundY, 58);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing, 1);
      D.rect(ctx, -60, -42, 120, 28, "#ffffff", 3, 10);
      D.rect(ctx, -30, -42, 50, 28, "#1d2233", 0);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 3;
      D.roundRectPath(ctx, -60, -42, 120, 28, 10);
      ctx.stroke();
      D.poly(ctx, [-30, -42, -20, -64, 22, -64, 34, -42], "#ffffff", 3);
      D.poly(ctx, [-22, -44, -15, -60, 0, -60, 0, -44], "#bfefff", 2);
      D.poly(ctx, [4, -44, 4, -60, 19, -60, 28, -44], "#bfefff", 2);
      ctx.fillStyle = "#fff";
      ctx.font = "800 10px Oxanium, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("POLICE", -5, -24);
      const on = Math.floor(t * 8) % 2 === 0;
      D.rect(ctx, -14, -72, 13, 8, on ? "#ff3b3b" : "#2d5bff", 2, 2);
      D.rect(ctx, 0, -72, 13, 8, on ? "#2d5bff" : "#ff3b3b", 2, 2);
      ctx.fillStyle = on ? "rgba(255,60,60,0.25)" : "rgba(60,90,255,0.25)";
      ctx.beginPath();
      ctx.arc(on ? -8 : 6, -70, 20, 0, U.TAU);
      ctx.fill();
      // Angry headlights.
      D.circ(ctx, 54, -30, 5, "#fff36b", 2);
      D.line(ctx, 48, -38, 60, -35, OUT, 3);
      wheel(ctx, -36, -12, 12, t, h.spin, "#bbb");
      wheel(ctx, 36, -12, 12, t, h.spin, "#bbb");
      ctx.restore();
    },

    resident(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 34, t);
      D.shadow(ctx, h.x, h.groundY, 22);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing * 1.05, 1.05);
      U.Art.drawHuman(ctx, "resident", { t, phase: h.phase, moving: h.moving, angry: true, throwing: h.throwT > 0, lx: 0.5, ly: -0.8 });
      ctx.restore();
      // Steam out of their ears.
      const k = (t * 1.5) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.7 - k * 0.7})`;
      ctx.beginPath();
      ctx.arc(h.x - 14, h.groundY - 86 - k * 20, 4 + k * 5, 0, U.TAU);
      ctx.arc(h.x + 14, h.groundY - 86 - k * 20, 4 + k * 5, 0, U.TAU);
      ctx.fill();
      if (h.shout > 0) D.bubble(ctx, h.x, h.groundY - 100, h.shoutText, { size: 15, color: "#c4352b" });
    },

    jeep(ctx, h, t) {
      dangerRing(ctx, h.x, h.groundY, 64, t);
      D.shadow(ctx, h.x, h.groundY, 56);
      ctx.save();
      ctx.translate(h.x, h.groundY);
      ctx.scale(h.facing, 1);
      // Soldier in the back with a foam-dart launcher.
      ctx.save();
      ctx.translate(-16, -30);
      ctx.scale(0.8, 0.8);
      U.Art.drawHuman(ctx, "soldier", { t, phase: 0, moving: false, angry: true, lx: 0.6, ly: -0.8 });
      ctx.restore();
      ctx.save();
      ctx.translate(-10, -70);
      const aim = h.aim;
      ctx.rotate(-aim);
      D.rect(ctx, -4, -5, 36, 10, "#ff8a1f", 2.5, 3);
      D.rect(ctx, 28, -6, 8, 12, "#2d5bff", 2.5, 2);
      ctx.restore();
      D.rect(ctx, -58, -44, 112, 26, "#6f8a3c", 3, 6);
      D.poly(ctx, [24, -44, 34, -66, 38, -66, 30, -44], "#bfefff", 2.5);
      D.rect(ctx, -66, -46, 12, 22, "#3d4f20", 3, 5);
      D.star(ctx, 0, -31, 7, "#fff", 1.5);
      wheel(ctx, -34, -14, 14, t, h.spin, "#bbb");
      wheel(ctx, 34, -14, 14, t, h.spin, "#bbb");
      ctx.restore();
    },

    dustDevil(ctx, h, t) {
      const height = h.height;
      const layers = 16;
      for (let i = 0; i < layers; i++) {
        const k = i / (layers - 1);
        const y = h.groundY - k * height;
        const w = 18 + k * k * 70 + Math.sin(t * 7 + i) * 6;
        const sway = Math.sin(t * 3 + k * 4) * 14 * k;
        ctx.fillStyle = `rgba(214, 170, 110, ${0.55 - k * 0.25})`;
        ctx.beginPath();
        ctx.ellipse(h.x + sway, y, w, 9 + k * 6, 0, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = `rgba(150, 105, 60, ${0.6 - k * 0.3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(h.x + sway, y, w * 0.8, 6 + k * 4, 0, t * 6 + i, t * 6 + i + 2.2);
        ctx.stroke();
      }
      // Debris spinning around it.
      for (let i = 0; i < 6; i++) {
        const a = t * 5 + i * 1.1;
        const k = ((i * 0.17 + t * 0.3) % 1);
        const r = 20 + k * 70;
        ctx.fillStyle = i % 2 ? "#8a5a2b" : "#c9a36b";
        ctx.fillRect(h.x + Math.cos(a) * r - 3, h.groundY - k * height + Math.sin(a) * 6 - 3, 6, 6);
      }
      angryEyes(ctx, h.x + Math.sin(t * 3 + 2) * 10, h.groundY - height * 0.62, 22, 6, 0, t);
    },

    monkey(ctx, h, t) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(h.facing, 1);
      const bounce = Math.abs(Math.sin(t * (h.throwT > 0 ? 12 : 3))) * 3;
      ctx.translate(0, -bounce);
      // Tail.
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(-18, -6, 10, Math.PI * 0.3, Math.PI * 1.6);
      ctx.stroke();
      ctx.strokeStyle = "#8a5a2b";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      D.ell(ctx, 0, -14, 14, 15, "#8a5a2b", 3);
      D.ell(ctx, 2, -11, 8, 10, "#e8c49a", 0);
      // Arms: one raised to throw.
      const throwA = h.throwT > 0 ? -2.6 : -0.6 + Math.sin(t * 4) * 0.2;
      D.limb(ctx, 8, -20, 8 + Math.sin(-throwA) * 16, -20 + Math.cos(throwA) * 16, 5, "#8a5a2b", 2.5);
      D.limb(ctx, -8, -20, -14, -4, 5, "#8a5a2b", 2.5);
      // Head.
      D.circ(ctx, -9, -38, 6, "#e8c49a", 2.5);
      D.circ(ctx, 13, -38, 6, "#e8c49a", 2.5);
      D.circ(ctx, 2, -38, 13, "#8a5a2b", 3);
      D.ell(ctx, 4, -35, 9, 8, "#e8c49a", 0);
      angryEyes(ctx, 4, -40, 9, 3.4, 0.6, t);
      D.mouth(ctx, 5, -31, 6, h.throwT > 0 ? "open" : "frown", t);
      ctx.restore();
      if (h.shout > 0) D.bubble(ctx, h.x, h.y - 58, h.shoutText, { size: 14, color: "#7a4a22" });
    },
  });

  function shadeHex(c) {
    return c === "#9b98c9" ? "#7c79a8" : "#48456a";
  }

  // ---------------------------------------------------------------- Projectiles

  Art.drawProjectile = function (ctx, p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    switch (p.kind) {
      case "stun": {
        const r = p.r + Math.sin(t * 30) * 2;
        ctx.fillStyle = "rgba(120, 220, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(0, 0, r + 8, 0, U.TAU);
        ctx.fill();
        D.circ(ctx, 0, 0, r, "#bff4ff", 2.5);
        ctx.strokeStyle = "#2d8bff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = t * 20 + i;
          ctx.lineTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
        }
        ctx.stroke();
        break;
      }
      case "net": {
        ctx.rotate(t * 4);
        D.circ(ctx, 0, 0, p.r, "rgba(255,255,255,0.15)", 2.5);
        ctx.strokeStyle = "#e8e8f0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(i * 6, -p.r);
          ctx.lineTo(i * 6, p.r);
          ctx.moveTo(-p.r, i * 6);
          ctx.lineTo(p.r, i * 6);
        }
        ctx.stroke();
        D.circ(ctx, 0, 0, p.r, null, 2.5);
        break;
      }
      case "shell":
        D.circ(ctx, 0, 0, p.r, "#2a2433", 2.5);
        D.circ(ctx, -p.r * 0.3, -p.r * 0.3, p.r * 0.3, "#777", 0);
        break;
      case "rocket": {
        ctx.rotate(Math.atan2(p.vy, p.vx));
        const f = 8 + Math.sin(t * 40) * 4;
        D.poly(ctx, [-16, -5, -16 - f - 6, 0, -16, 5], "#ffb02e", 0);
        D.poly(ctx, [-16, -3, -16 - f, 0, -16, 3], "#fff36b", 0);
        D.rect(ctx, -16, -6, 26, 12, "#e8463c", 2.5, 4);
        D.poly(ctx, [10, -6, 20, 0, 10, 6], "#ffffff", 2.5);
        D.poly(ctx, [-16, -6, -10, -6, -16, -13], "#ffd23f", 2);
        D.poly(ctx, [-16, 6, -10, 6, -16, 13], "#ffd23f", 2);
        break;
      }
      case "tomato":
        ctx.rotate(t * 8);
        D.circ(ctx, 0, 0, p.r, "#ff3b3b", 2.5);
        D.star(ctx, 0, -p.r * 0.6, 5, "#3fbf4f", 1.5, 5, 0.4);
        break;
      case "boot":
        ctx.rotate(t * 10);
        D.poly(ctx, [-7, -12, 4, -12, 4, 2, 13, 4, 13, 10, -7, 10], "#6b3b1f", 2.5);
        break;
      case "hay":
        ctx.rotate(t * 5);
        D.rect(ctx, -14, -10, 28, 20, "#f2d06b", 2.5, 4);
        D.line(ctx, -14, -3, 14, -3, "#c9a336", 2);
        D.line(ctx, -14, 4, 14, 4, "#c9a336", 2);
        break;
      case "gnome":
        ctx.rotate(t * 7);
        D.ell(ctx, 0, 4, 8, 9, "#2d5bff", 2.5);
        D.circ(ctx, 0, -4, 6, "#f2c29b", 2);
        D.poly(ctx, [-7, -6, 7, -6, 0, -22], "#ff3b3b", 2.5);
        D.poly(ctx, [-6, -1, 6, -1, 0, 9], "#fff", 1.5);
        break;
      case "dart":
        ctx.rotate(Math.atan2(p.vy, p.vx));
        D.rect(ctx, -10, -3.5, 16, 7, "#ff8a1f", 2, 3);
        D.ell(ctx, 7, 0, 4.5, 4, "#2d5bff", 2);
        break;
      case "coconut":
        ctx.rotate(t * 9);
        D.circ(ctx, 0, 0, p.r, "#7a4a22", 2.5);
        D.circ(ctx, -3, -3, 1.8, OUT, 0);
        D.circ(ctx, 3, -3, 1.8, OUT, 0);
        D.circ(ctx, 0, 2, 1.8, OUT, 0);
        break;
      case "sand":
        ctx.fillStyle = "rgba(200, 160, 100, 0.8)";
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, U.TAU);
        ctx.fill();
        break;
      default:
        D.circ(ctx, 0, 0, p.r, "#fff", 2);
    }
    ctx.restore();
  };

  Art.dangerRing = dangerRing;
  Art.bolt = bolt;
})(window.UFO);
