/* Built-in art generators (work offline, no AI service needed):
 *   CBS.gen.background(prompt|params, seed, w, h) -> canvas   procedural scene painter
 *   CBS.gen.characterSVG(params) -> svg string                 parametric character maker
 *   CBS.gen.parseCharacter(prompt) / parseBackground(prompt)   keyword -> params
 *   CBS.gen.panel(prompt, seed, w, h) -> Promise<canvas>       background + character composite */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { rng, clamp, shade, makeCanvas } = CBS;
  const G = (CBS.gen = CBS.gen || {});

  /* ---------- shared painting helpers ---------- */
  function grad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  const SKIES = {
    day: ["#5fb4ff", "#9fd6ff", "#e3f5ff"],
    sunset: ["#2a1858", "#a43f7a", "#ff7b54", "#ffd36e"],
    night: ["#050822", "#0d1745", "#22306e"],
  };
  function sky(ctx, w, h, time, R, horizon = 0.75) {
    ctx.fillStyle = grad(ctx, 0, h * horizon, SKIES[time] || SKIES.day);
    ctx.fillRect(0, 0, w, h);
    if (time === "night") stars(ctx, w, h * horizon, R, 160);
    if (time === "night") moon(ctx, w * (0.15 + R() * 0.7), h * 0.16, Math.min(w, h) * 0.07);
    else if (time === "sunset") sun(ctx, w * (0.3 + R() * 0.4), h * horizon * 0.82, Math.min(w, h) * 0.11, "#ffe6a1");
    else sun(ctx, w * (0.7 + R() * 0.2), h * 0.15, Math.min(w, h) * 0.07, "#fff6c4");
  }
  function stars(ctx, w, h, R, n) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.65})`;
      const s = R() < 0.92 ? 1 + R() * 1.4 : 2.5 + R() * 1.5;
      ctx.beginPath();
      ctx.arc(R() * w, R() * h, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function sun(ctx, x, y, r, c) {
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3);
    g.addColorStop(0, "rgba(255,240,180,0.85)");
    g.addColorStop(1, "rgba(255,240,180,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  function moon(ctx, x, y, r) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2);
    g.addColorStop(0, "rgba(220,230,255,0.45)");
    g.addColorStop(1, "rgba(220,230,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    ctx.fillStyle = "#f4f1dc";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(180,175,150,0.45)";
    [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.35, 0.12]].forEach(([dx, dy, k]) => {
      ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, r * k, 0, Math.PI * 2); ctx.fill();
    });
  }
  function cloud(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    [[0, 0, 1], [0.8, 0.15, 0.75], [-0.8, 0.2, 0.7], [0.35, -0.45, 0.8], [-0.35, -0.3, 0.65]].forEach(([dx, dy, k]) => {
      ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * k, 0, Math.PI * 2); ctx.fill();
    });
  }
  function clouds(ctx, w, h, R, time, n = 5) {
    const c = time === "night" ? "rgba(140,150,200,0.25)" : time === "sunset" ? "rgba(255,190,170,0.75)" : "rgba(255,255,255,0.92)";
    for (let i = 0; i < n; i++) cloud(ctx, R() * w, h * (0.08 + R() * 0.3), Math.min(w, h) * (0.04 + R() * 0.05), c);
  }
  function hills(ctx, w, h, y, amp, color, R, bumps = 3) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    const ph = R() * 10;
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x / w * Math.PI * bumps + ph) * amp + Math.sin(x / w * Math.PI * bumps * 2.7 + ph) * amp * 0.3);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  function weather(ctx, w, h, kind, R) {
    if (kind === "rain") {
      ctx.strokeStyle = "rgba(200,220,255,0.45)";
      ctx.lineWidth = Math.max(1, w / 600);
      for (let i = 0; i < 260; i++) {
        const x = R() * w, y = R() * h, l = h * (0.03 + R() * 0.03);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.25, y + l); ctx.stroke();
      }
    } else if (kind === "snow") {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      for (let i = 0; i < 220; i++) { ctx.beginPath(); ctx.arc(R() * w, R() * h, 1 + R() * 3 * (w / 1200), 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === "fog") {
      const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
      g.addColorStop(0, "rgba(220,225,240,0)");
      g.addColorStop(1, "rgba(220,225,240,0.6)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  /* ---------- scene painters ---------- */
  const SCENES = {};

  SCENES.city = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time, R, 0.8);
    if (o.time !== "night") clouds(ctx, w, h, R, o.time, 4);
    const layers = o.time === "night"
      ? ["#1b2350", "#141a3d", "#0c1029"]
      : o.time === "sunset" ? ["#8c5a8f", "#5e3b6e", "#3a2550"] : ["#9db6d6", "#6f8db5", "#4a6690"];
    const neon = o.futuristic ? ["#22d3ee", "#f472b6", "#a855f7", "#facc15"] : null;
    layers.forEach((col, li) => {
      const base = h * (0.62 + li * 0.11);
      let x = -R() * 40;
      while (x < w) {
        const bw = w * (0.05 + R() * 0.07) * (1 + li * 0.25);
        const bh = h * (0.18 + R() * 0.35) * (1 - li * 0.18) + (o.futuristic ? h * 0.12 * R() : 0);
        ctx.fillStyle = col;
        const top = base - bh;
        if (o.futuristic && R() < 0.4) {
          ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x, top + bw * 0.4); ctx.lineTo(x + bw / 2, top); ctx.lineTo(x + bw, top + bw * 0.4); ctx.lineTo(x + bw, base); ctx.fill();
        } else ctx.fillRect(x, top, bw, bh + h);
        if (R() < 0.3) ctx.fillRect(x + bw * 0.45, top - h * 0.04, Math.max(2, bw * 0.06), h * 0.04);
        // windows
        const lit = o.time === "night" ? 0.5 : 0.1;
        const ww = bw / 7, wh = ww * 1.3;
        for (let wy = top + wh; wy < base - wh; wy += wh * 2) {
          for (let wx = x + ww; wx < x + bw - ww; wx += ww * 2) {
            if (R() < (li === 2 ? lit + 0.15 : lit)) {
              ctx.fillStyle = neon && R() < 0.3 ? CBS.pick(neon, R) : o.time === "night" ? "#ffd86b" : "rgba(255,255,255,0.5)";
            } else ctx.fillStyle = shade(col, -0.25);
            ctx.fillRect(wx, wy, ww, wh);
          }
        }
        x += bw + w * 0.004;
      }
    });
    // street
    ctx.fillStyle = o.time === "night" ? "#0a0c1a" : "#3b3f4c";
    ctx.fillRect(0, h * 0.93, w, h * 0.07);
    ctx.fillStyle = "#f5d76e";
    for (let x = 0; x < w; x += w * 0.08) ctx.fillRect(x, h * 0.962, w * 0.04, h * 0.008);
    if (o.futuristic) {
      for (let i = 0; i < 4; i++) {
        const cx = R() * w, cy = h * (0.2 + R() * 0.35), s = w * 0.03;
        ctx.fillStyle = "#cbd5e1";
        ctx.beginPath(); ctx.ellipse(cx, cy, s, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = CBS.pick(neon, R);
        ctx.fillRect(cx - s * 2.2, cy - 1, s * 1.3, 2);
      }
    }
  };

  SCENES.space = (ctx, w, h, R) => {
    ctx.fillStyle = grad(ctx, 0, h, ["#02010a", "#0b0630", "#140a3a"]);
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const x = R() * w, y = R() * h, r = Math.min(w, h) * (0.2 + R() * 0.3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const c = CBS.pick(["168,85,247", "236,72,153", "34,211,238", "59,130,246"], R);
      g.addColorStop(0, `rgba(${c},0.35)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    stars(ctx, w, h, R, 420);
    // planet with rings
    const px = w * (0.62 + R() * 0.2), py = h * (0.55 + R() * 0.2), pr = Math.min(w, h) * 0.24;
    const pc = CBS.pick([["#f59e0b", "#b45309"], ["#60a5fa", "#1e3a8a"], ["#f472b6", "#831843"], ["#34d399", "#065f46"]], R);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.strokeStyle = "rgba(255,230,200,0.55)";
    ctx.lineWidth = pr * 0.08;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, Math.PI, Math.PI * 2); ctx.stroke();
    const pg = ctx.createRadialGradient(-pr * 0.4, -pr * 0.4, pr * 0.1, 0, 0, pr);
    pg.addColorStop(0, shade(pc[0], 0.35)); pg.addColorStop(0.6, pc[0]); pg.addColorStop(1, pc[1]);
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = pc[1];
    for (let i = -3; i <= 3; i++) ctx.fillRect(-pr, i * pr * 0.22, pr * 2, pr * 0.07);
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, 0, Math.PI); ctx.stroke();
    ctx.restore();
    // small moon
    const mx = w * (0.12 + R() * 0.25), my = h * (0.2 + R() * 0.25), mr = Math.min(w, h) * 0.06;
    const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 1, mx, my, mr);
    mg.addColorStop(0, "#f1f5f9"); mg.addColorStop(1, "#64748b");
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
  };

  SCENES.alien = (ctx, w, h, R, o) => {
    const night = o.time === "night";
    ctx.fillStyle = grad(ctx, 0, h * 0.75, night ? ["#12052b", "#3b0f5c", "#7a1f6b"] : ["#3cc7a4", "#a6f0c6", "#f9e79f"]);
    ctx.fillRect(0, 0, w, h);
    if (night) stars(ctx, w, h * 0.6, R, 140);
    [[0.25, 0.18, 0.09, "#ffb3d9"], [0.75, 0.12, 0.05, "#c4b5fd"]].forEach(([x, y, r, c]) => sun(ctx, w * x, h * y, Math.min(w, h) * r, c));
    hills(ctx, w, h, h * 0.62, h * 0.05, night ? "#4c1d6b" : "#7c3aed", R, 2);
    hills(ctx, w, h, h * 0.74, h * 0.04, night ? "#2e1045" : "#c026d3", R, 3);
    ctx.fillStyle = night ? "#1d0b2e" : "#86198f";
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
    for (let i = 0; i < 9; i++) {
      // bulb plants
      const x = R() * w, base = h * (0.8 + R() * 0.12), ph = h * (0.08 + R() * 0.16);
      ctx.strokeStyle = night ? "#22d3ee" : "#065f46";
      ctx.lineWidth = Math.max(2, w * 0.006);
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + (R() - 0.5) * 40, base - ph * 0.6, x, base - ph); ctx.stroke();
      ctx.fillStyle = CBS.pick(["#facc15", "#22d3ee", "#f472b6", "#a3e635"], R);
      ctx.beginPath(); ctx.arc(x, base - ph, w * (0.01 + R() * 0.012), 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath(); ctx.ellipse(R() * w, h * (0.9 + R() * 0.08), w * (0.03 + R() * 0.04), h * 0.012, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  SCENES.haunted = (ctx, w, h, R) => {
    ctx.fillStyle = grad(ctx, 0, h, ["#0b0618", "#2a1145", "#4b1d5c"]);
    ctx.fillRect(0, 0, w, h);
    stars(ctx, w, h * 0.5, R, 70);
    moon(ctx, w * 0.75, h * 0.2, Math.min(w, h) * 0.1);
    hills(ctx, w, h, h * 0.72, h * 0.06, "#150a24", R, 1.5);
    // mansion
    const mx = w * 0.32, mw = w * 0.36, mt = h * 0.38, mb = h * 0.78;
    ctx.fillStyle = "#0d0716";
    ctx.fillRect(mx, mt, mw, mb - mt);
    ctx.beginPath(); ctx.moveTo(mx - mw * 0.05, mt); ctx.lineTo(mx + mw / 2, mt - h * 0.12); ctx.lineTo(mx + mw * 1.05, mt); ctx.fill();
    [[mx - mw * 0.12, mw * 0.18, 0.18], [mx + mw * 0.94, mw * 0.18, 0.24]].forEach(([tx, tw, k]) => {
      ctx.fillRect(tx, mt - h * k * 0.6, tw, mb - mt + h * k * 0.6);
      ctx.beginPath(); ctx.moveTo(tx - tw * 0.15, mt - h * k * 0.6); ctx.lineTo(tx + tw / 2, mt - h * k * 1.25); ctx.lineTo(tx + tw * 1.15, mt - h * k * 0.6); ctx.fill();
    });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      ctx.fillStyle = R() < 0.45 ? "#ffcf5a" : "#1f1530";
      const wx = mx + mw * (0.08 + c * 0.18), wy = mt + (mb - mt) * (0.12 + r * 0.28);
      ctx.fillRect(wx, wy, mw * 0.09, (mb - mt) * 0.15);
    }
    // dead trees
    const tree = (x, s) => {
      ctx.strokeStyle = "#07040d";
      ctx.lineCap = "round";
      const branch = (x1, y1, ang, len, wdt, depth) => {
        if (depth <= 0) return;
        const x2 = x1 + Math.cos(ang) * len, y2 = y1 + Math.sin(ang) * len;
        ctx.lineWidth = wdt;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        branch(x2, y2, ang - 0.4 - R() * 0.3, len * 0.72, wdt * 0.65, depth - 1);
        branch(x2, y2, ang + 0.35 + R() * 0.3, len * 0.68, wdt * 0.65, depth - 1);
      };
      branch(x, h, -Math.PI / 2, h * 0.2 * s, w * 0.012 * s, 6);
    };
    tree(w * 0.1, 1.2); tree(w * 0.92, 1);
    // bats
    ctx.fillStyle = "#050208";
    for (let i = 0; i < 6; i++) {
      const bx = w * (0.4 + R() * 0.5), by = h * (0.1 + R() * 0.25), s = w * 0.015;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - s, by - s, bx - s * 2, by); ctx.quadraticCurveTo(bx - s, by - s * 0.2, bx, by + s * 0.4);
      ctx.quadraticCurveTo(bx + s, by - s * 0.2, bx + s * 2, by); ctx.quadraticCurveTo(bx + s, by - s, bx, by); ctx.fill();
    }
    weather(ctx, w, h, "fog", R);
  };

  SCENES.castle = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time, R, 0.75);
    clouds(ctx, w, h, R, o.time, 4);
    hills(ctx, w, h, h * 0.66, h * 0.05, o.time === "night" ? "#1d3b2a" : "#5fa35a", R, 2);
    const stone = o.time === "night" ? "#3a3f5a" : "#a8a29e", dark = shade(stone, -0.3);
    const cx = w * 0.5, base = h * 0.72, cw = w * 0.42, ch = h * 0.24;
    ctx.fillStyle = stone;
    ctx.fillRect(cx - cw / 2, base - ch, cw, ch);
    const merlons = (x, y, ww) => { for (let i = 0; i < ww; i += w * 0.025) ctx.fillRect(x + i, y - h * 0.025, w * 0.014, h * 0.025); };
    merlons(cx - cw / 2, base - ch, cw);
    [[-0.5, 0.085, 1.5], [0.5 - 0.085 / 0.42 * 0.42, 0.085, 1.5], [-0.07, 0.11, 1.9]].forEach(([fx, tw, k], i) => {
      const tx = i === 1 ? cx + cw / 2 - w * tw : i === 0 ? cx - cw / 2 : cx - w * tw / 2;
      const th = ch * k;
      ctx.fillStyle = i === 2 ? shade(stone, 0.08) : stone;
      ctx.fillRect(tx, base - th, w * tw, th);
      ctx.fillStyle = i === 2 ? "#7c2d12" : "#b91c1c";
      ctx.beginPath(); ctx.moveTo(tx - w * 0.008, base - th); ctx.lineTo(tx + w * tw / 2, base - th - h * 0.12); ctx.lineTo(tx + w * tw + w * 0.008, base - th); ctx.fill();
      ctx.strokeStyle = "#3f3f46"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(tx + w * tw / 2, base - th - h * 0.12); ctx.lineTo(tx + w * tw / 2, base - th - h * 0.17); ctx.stroke();
      ctx.fillStyle = CBS.pick(["#facc15", "#3b82f6", "#ef4444"], R);
      ctx.fillRect(tx + w * tw / 2, base - th - h * 0.17, w * 0.025, h * 0.02);
      ctx.fillStyle = o.time === "night" ? "#fde68a" : "#1c1917";
      ctx.fillRect(tx + w * tw * 0.4, base - th * 0.7, w * tw * 0.2, h * 0.035);
    });
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(cx - w * 0.04, base); ctx.lineTo(cx - w * 0.04, base - h * 0.08); ctx.arc(cx, base - h * 0.08, w * 0.04, Math.PI, 0); ctx.lineTo(cx + w * 0.04, base); ctx.fill();
    hills(ctx, w, h, h * 0.82, h * 0.03, o.time === "night" ? "#14301f" : "#3f8a3c", R, 3);
  };

  SCENES.hq = (ctx, w, h, R) => {
    ctx.fillStyle = grad(ctx, 0, h, ["#0b1530", "#11214a", "#0a1228"]);
    ctx.fillRect(0, 0, w, h);
    // floor grid in perspective
    const hy = h * 0.68;
    ctx.fillStyle = "#081022";
    ctx.fillRect(0, hy, w, h - hy);
    ctx.strokeStyle = "rgba(34,211,238,0.35)";
    ctx.lineWidth = 1.5;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.02, hy); ctx.lineTo(w / 2 + i * w * 0.2, h); ctx.stroke(); }
    for (let k = 1; k < 8; k++) { const y = hy + (h - hy) * Math.pow(k / 8, 1.8); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // big screens
    const screens = [[0.06, 0.12, 0.26, 0.3], [0.37, 0.06, 0.26, 0.36], [0.68, 0.12, 0.26, 0.3]];
    screens.forEach(([x, y, sw, sh], i) => {
      const X = x * w, Y = y * h, W = sw * w, H = sh * h;
      ctx.fillStyle = "#1e293b"; ctx.fillRect(X - 6, Y - 6, W + 12, H + 12);
      ctx.fillStyle = grad(ctx, Y, Y + H, ["#0e3a5c", "#082136"]); ctx.fillRect(X, Y, W, H);
      ctx.strokeStyle = ["#22d3ee", "#4ade80", "#f472b6"][i];
      ctx.lineWidth = 3;
      if (i === 1) {
        ctx.beginPath(); ctx.arc(X + W / 2, Y + H / 2, H * 0.32, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(X + W / 2, Y + H * 0.1); ctx.lineTo(X + W / 2, Y + H * 0.9); ctx.moveTo(X + W * 0.25, Y + H / 2); ctx.lineTo(X + W * 0.75, Y + H / 2); ctx.stroke();
        ctx.fillStyle = "#f87171"; ctx.beginPath(); ctx.arc(X + W * (0.4 + R() * 0.2), Y + H * (0.35 + R() * 0.2), 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) { const px = X + (W * k) / 12, py = Y + H * (0.25 + R() * 0.55); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        for (let k = 0; k < 4; k++) ctx.fillRect(X + W * 0.08, Y + H * (0.08 + k * 0.05), W * (0.2 + R() * 0.3), H * 0.02);
      }
    });
    // console desk
    ctx.fillStyle = "#1f2a44";
    ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.62); ctx.lineTo(w * 0.85, h * 0.62); ctx.lineTo(w * 0.92, h * 0.78); ctx.lineTo(w * 0.08, h * 0.78); ctx.fill();
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = CBS.pick(["#22d3ee", "#f87171", "#facc15", "#4ade80"], R);
      ctx.fillRect(w * (0.16 + R() * 0.68), h * (0.64 + R() * 0.1), w * 0.008, h * 0.008);
    }
  };

  SCENES.forest = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time, R, 0.7);
    const night = o.time === "night";
    const cols = night ? ["#1a2d3d", "#122230", "#0a1520"] : o.time === "sunset" ? ["#7a5a7a", "#4f3b5e", "#2c2238"] : ["#7fb98a", "#4f8f61", "#2f6b45"];
    cols.forEach((col, li) => {
      const base = h * (0.62 + li * 0.13);
      ctx.fillStyle = col;
      ctx.fillRect(0, base, w, h);
      let x = -20;
      while (x < w + 20) {
        const tw = w * (0.04 + R() * 0.04) * (1 + li * 0.4), th = h * (0.2 + R() * 0.2) * (1 + li * 0.25);
        ctx.beginPath(); ctx.moveTo(x, base + 4); ctx.lineTo(x + tw / 2, base - th); ctx.lineTo(x + tw, base + 4); ctx.fill();
        x += tw * (0.55 + R() * 0.4);
      }
    });
    if (!night) {
      ctx.fillStyle = "rgba(255,250,200,0.08)";
      for (let i = 0; i < 4; i++) { const x = w * (0.2 + R() * 0.6); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.05, 0); ctx.lineTo(x + w * 0.25, h); ctx.lineTo(x + w * 0.1, h); ctx.fill(); }
    } else {
      for (let i = 0; i < 30; i++) { ctx.fillStyle = "rgba(250,240,120,0.85)"; ctx.beginPath(); ctx.arc(R() * w, h * (0.5 + R() * 0.45), 2 + R() * 2, 0, Math.PI * 2); ctx.fill(); }
    }
  };

  SCENES.ocean = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time, R, 0.55);
    clouds(ctx, w, h, R, o.time, 4);
    const sea = o.time === "night" ? ["#0b1f45", "#06112a"] : o.time === "sunset" ? ["#5b3a7a", "#1e3a6b"] : ["#1fa2d6", "#0b5f94"];
    ctx.fillStyle = grad(ctx, h * 0.55, h * 0.8, sea);
    ctx.fillRect(0, h * 0.55, w, h * 0.3);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const x = R() * w, y = h * (0.58 + R() * 0.2), l = w * (0.02 + R() * 0.04); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 4, x + l, y); ctx.stroke(); }
    ctx.fillStyle = o.time === "night" ? "#6b5b3e" : "#f2d49b";
    ctx.beginPath(); ctx.moveTo(0, h * 0.8); ctx.quadraticCurveTo(w * 0.5, h * 0.74, w, h * 0.82); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    // palm
    const px = w * 0.82, py = h * 0.86;
    ctx.strokeStyle = "#7c4a1d"; ctx.lineWidth = w * 0.016; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px - w * 0.03, py - h * 0.25, px - w * 0.06, py - h * 0.42); ctx.stroke();
    ctx.fillStyle = o.time === "night" ? "#14532d" : "#16a34a";
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + (i / 5) * Math.PI + (R() - 0.5) * 0.3;
      ctx.save(); ctx.translate(px - w * 0.06, py - h * 0.42); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(w * 0.07, 0, w * 0.075, h * 0.018, 0.25, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  };

  SCENES.desert = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time === "day" ? "sunset" : o.time, R, 0.7);
    hills(ctx, w, h, h * 0.66, h * 0.05, "#d08a4a", R, 1.5);
    hills(ctx, w, h, h * 0.76, h * 0.06, "#e9a95c", R, 2.2);
    hills(ctx, w, h, h * 0.88, h * 0.04, "#f6c27a", R, 2.8);
    const cactus = (x, base, s) => {
      ctx.fillStyle = "#2f7d4a";
      const tw = w * 0.025 * s, th = h * 0.22 * s;
      ctx.fillRect(x - tw / 2, base - th, tw, th);
      ctx.beginPath(); ctx.arc(x, base - th, tw / 2, Math.PI, 0); ctx.fill();
      ctx.fillRect(x - tw * 1.6, base - th * 0.6, tw * 0.8, th * 0.12);
      ctx.fillRect(x - tw * 1.6, base - th * 0.85, tw * 0.7, th * 0.3);
      ctx.fillRect(x + tw * 0.5, base - th * 0.45, tw * 0.9, th * 0.12);
      ctx.fillRect(x + tw * 0.75, base - th * 0.72, tw * 0.7, th * 0.32);
    };
    cactus(w * 0.18, h * 0.9, 1.1); cactus(w * 0.76, h * 0.86, 0.7);
  };

  SCENES.mountains = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time, R, 0.7);
    clouds(ctx, w, h, R, o.time, 3);
    const night = o.time === "night";
    [[0.55, "#6b7fb0", 0.35], [0.66, "#4a5d8f", 0.3]].forEach(([base, col, amp]) => {
      ctx.fillStyle = night ? shade(col, -0.5) : col;
      ctx.beginPath(); ctx.moveTo(0, h);
      let x = 0;
      while (x <= w) {
        const pw = w * (0.12 + R() * 0.12), ph = h * amp * (0.6 + R() * 0.5);
        ctx.lineTo(x + pw / 2, h * base - ph * 0.5);
        // snow cap
        x += pw;
        ctx.lineTo(x, h * base + ph * 0.1);
      }
      ctx.lineTo(w, h); ctx.fill();
    });
    // snow caps on front ridge
    ctx.fillStyle = night ? "#c7d2fe" : "#f8fafc";
    for (let i = 0; i < 5; i++) {
      const x = w * (0.1 + i * 0.2 + (R() - 0.5) * 0.05), y = h * (0.3 + R() * 0.1);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - w * 0.035, y + h * 0.07); ctx.lineTo(x + w * 0.035, y + h * 0.07); ctx.fill();
    }
    ctx.fillStyle = night ? "#0f2a3a" : "#3b8bb5";
    ctx.fillRect(0, h * 0.8, w, h * 0.2);
    ctx.fillStyle = night ? "#123524" : "#3f8a3c";
    hills(ctx, w, h, h * 0.86, h * 0.02, night ? "#123524" : "#3f8a3c", R, 4);
  };

  SCENES.underwater = (ctx, w, h, R) => {
    ctx.fillStyle = grad(ctx, 0, h, ["#28a7d8", "#0b5f94", "#062a4a"]);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 6; i++) { const x = R() * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.06, 0); ctx.lineTo(x + w * 0.18, h); ctx.lineTo(x + w * 0.08, h); ctx.fill(); }
    ctx.fillStyle = "#d9b36c";
    ctx.beginPath(); ctx.moveTo(0, h * 0.86); ctx.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.88); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    for (let i = 0; i < 10; i++) {
      const x = R() * w, base = h * 0.9, ph = h * (0.15 + R() * 0.25);
      ctx.strokeStyle = CBS.pick(["#16a34a", "#15803d", "#65a30d"], R);
      ctx.lineWidth = w * 0.008; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, base);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(k + R()) * w * 0.012, base - (ph * k) / 6);
      ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const fx = R() * w, fy = h * (0.2 + R() * 0.5), s = w * (0.02 + R() * 0.02);
      ctx.fillStyle = CBS.pick(["#f97316", "#facc15", "#f472b6", "#a78bfa"], R);
      ctx.beginPath(); ctx.ellipse(fx, fy, s, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(fx - s * 0.8, fy); ctx.lineTo(fx - s * 1.6, fy - s * 0.6); ctx.lineTo(fx - s * 1.6, fy + s * 0.6); ctx.fill();
      ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(fx + s * 0.5, fy - s * 0.1, s * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 25; i++) { ctx.beginPath(); ctx.arc(R() * w, R() * h * 0.8, 2 + R() * 6, 0, Math.PI * 2); ctx.stroke(); }
  };

  SCENES.room = (ctx, w, h, R, o) => {
    const wall = CBS.pick(["#f6d7b0", "#cfe8ff", "#e9d5ff", "#d9f99d"], R);
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = shade(wall, -0.08);
    for (let x = 0; x < w; x += w * 0.06) ctx.fillRect(x, 0, w * 0.03, h * 0.72);
    ctx.fillStyle = "#a0673a";
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 2;
    for (let y = h * 0.76; y < h; y += h * 0.05) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // window
    const wx = w * 0.58, wy = h * 0.12, ww = w * 0.3, wh = h * 0.36;
    ctx.save();
    ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
    ctx.translate(wx, wy);
    sky(ctx, ww, wh, o.time, R, 1);
    ctx.restore();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = w * 0.01;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
    // shelf with books
    ctx.fillStyle = "#7c4a1d";
    ctx.fillRect(w * 0.08, h * 0.3, w * 0.3, h * 0.02);
    let bx = w * 0.09;
    while (bx < w * 0.36) {
      const bw = w * (0.012 + R() * 0.012), bh = h * (0.08 + R() * 0.05);
      ctx.fillStyle = CBS.pick(["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"], R);
      ctx.fillRect(bx, h * 0.3 - bh, bw, bh);
      bx += bw + 2;
    }
    if (o.time === "night") { ctx.fillStyle = "rgba(10,15,50,0.35)"; ctx.fillRect(0, 0, w, h); }
  };

  SCENES.sky = (ctx, w, h, R, o) => {
    sky(ctx, w, h, o.time, R, 1);
    clouds(ctx, w, h, R, o.time, 9);
    for (let i = 0; i < 6; i++) cloud(ctx, R() * w, h * (0.55 + R() * 0.4), Math.min(w, h) * (0.06 + R() * 0.06), o.time === "night" ? "rgba(120,130,190,0.3)" : "rgba(255,255,255,0.95)");
  };

  const SCENE_INFO = {
    city: "City", space: "Outer space", alien: "Alien planet", haunted: "Haunted mansion", castle: "Medieval castle",
    hq: "Superhero HQ", forest: "Forest", ocean: "Beach & ocean", desert: "Desert", mountains: "Mountains",
    underwater: "Underwater", room: "Indoor room", sky: "Sky & clouds",
  };
  const SCENE_WORDS = [
    ["haunted", /haunt|ghost|spooky|creepy|mansion|graveyard|halloween|vampire/],
    ["space", /outer space|\bspace\b|galaxy|stars|nebula|orbit|spaceship|asteroid/],
    ["alien", /alien|planet|martian|extraterrestrial/],
    ["castle", /castle|medieval|kingdom|knight|dragon|palace|fortress/],
    ["hq", /headquarter|\bhq\b|lab|laboratory|base|control room|computer|hideout|lair/],
    ["underwater", /underwater|reef|coral|deep sea|submarine/],
    ["ocean", /beach|ocean|\bsea\b|island|coast|pirate/],
    ["desert", /desert|sand|dune|cactus|western|canyon/],
    ["mountains", /mountain|peak|snowy|alps|cliff|valley/],
    ["forest", /forest|woods|jungle|trees|camp|park/],
    ["room", /room|bedroom|classroom|kitchen|house|home|school|office|indoor/],
    ["city", /city|town|street|futuristic|metropolis|downtown|rooftop|skyline|urban/],
    ["sky", /\bsky\b|clouds|flying|air/],
  ];

  function parseBackground(prompt) {
    const t = String(prompt || "").toLowerCase();
    let kind = "city";
    for (const [k, re] of SCENE_WORDS) if (re.test(t)) { kind = k; break; }
    let time = /night|dark|moon|midnight|evening sky/.test(t) ? "night" : /sunset|dusk|evening|dawn|sunrise|twilight/.test(t) ? "sunset" : "day";
    if (kind === "haunted" && time === "day" && !/day|morning|noon/.test(t)) time = "night";
    const weatherKind = /rain|storm/.test(t) ? "rain" : /snow|winter|blizzard/.test(t) ? "snow" : /fog|mist/.test(t) ? "fog" : null;
    const futuristic = /futur|neon|cyber|sci-?fi|robot|2[1-9]\d\d/.test(t);
    return { kind, time, weather: weatherKind, futuristic };
  }

  function background(params, seed = 1, w = 1200, h = 800) {
    const p = typeof params === "string" ? parseBackground(params) : Object.assign({ kind: "city", time: "day" }, params);
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    const R = rng(String(seed) + p.kind + p.time);
    (SCENES[p.kind] || SCENES.city)(ctx, w, h, R, p);
    if (p.weather) weather(ctx, w, h, p.weather, R);
    return c;
  }

  /* ---------- character maker (SVG) ---------- */
  const COLORS = {
    red: "#e63946", blue: "#2563eb", green: "#16a34a", yellow: "#facc15", purple: "#8b5cf6", pink: "#ec4899", orange: "#f97316",
    black: "#1f2937", white: "#f8fafc", gold: "#f5b301", silver: "#cbd5e1", teal: "#14b8a6", brown: "#8b5a2b", gray: "#6b7280", grey: "#6b7280", cyan: "#22d3ee",
  };
  const SKIN = ["#f9d4b4", "#f1c27d", "#e0a96d", "#c68642", "#8d5524", "#5c3a21"];
  const HAIR = { black: "#1f1a17", brown: "#5b3a1e", blonde: "#f2c94c", red: "#b5361b", ginger: "#c45a1c", white: "#eeeeee", gray: "#9ca3af", blue: "#2563eb", pink: "#ec4899", purple: "#7c3aed", green: "#16a34a" };
  const SPECIES = { human: "Human", robot: "Robot", cat: "Cat", alien: "Alien", monster: "Monster" };
  const HAIR_STYLES = { short: "Short", spiky: "Spiky", long: "Long", ponytail: "Ponytail", curly: "Curly", bun: "Bun", bald: "None" };
  const EXPRESSIONS = { happy: "Happy", laughing: "Laughing", determined: "Determined", angry: "Angry", surprised: "Surprised", sad: "Sad", scared: "Scared" };
  const POSES = { hero: "Hero stance", wave: "Waving", punch: "Punching", fly: "Flying", run: "Running", stand: "Standing" };
  const POWERS = { none: "None", fire: "Fire", ice: "Ice", lightning: "Lightning", magic: "Magic", energy: "Energy", strength: "Super strength" };
  const EMBLEMS = { star: "Star", bolt: "Lightning bolt", heart: "Heart", letter: "Initial", flame: "Flame", snowflake: "Snowflake", none: "None" };
  const HATS = { none: "None", cap: "Cap", wizard: "Wizard hat", crown: "Crown", helmet: "Helmet" };

  function defaultCharacter(seed = 1) {
    const R = rng(seed);
    return {
      name: "Hero", species: "human", skin: CBS.pick(SKIN, R), hairStyle: CBS.pick(["short", "spiky", "long", "ponytail", "curly", "bun"], R),
      hairColor: CBS.pick(Object.values(HAIR).slice(0, 6), R), suit: CBS.pick(Object.values(COLORS).slice(0, 8), R), suit2: CBS.pick(["#facc15", "#1f2937", "#f8fafc", "#e63946", "#2563eb"], R),
      cape: R() < 0.6, capeColor: CBS.pick(["#e63946", "#2563eb", "#7c3aed", "#facc15", "#111827"], R), mask: R() < 0.4, emblem: CBS.pick(["star", "bolt", "heart", "letter"], R),
      expression: "happy", pose: "hero", power: "none", glasses: false, goggles: false, hat: "none",
    };
  }

  function parseCharacter(prompt, seed = 1) {
    const t = " " + String(prompt || "").toLowerCase() + " ";
    const c = defaultCharacter(seed);
    const m = t.match(/(?:named|called)\s+([a-z][a-z'-]+)/);
    if (m) c.name = m[1][0].toUpperCase() + m[1].slice(1);
    if (/robot|android|cyborg|mech/.test(t)) c.species = "robot";
    else if (/\bcat\b|kitty|kitten|feline/.test(t)) c.species = "cat";
    else if (/alien|martian|extraterrestrial/.test(t)) c.species = "alien";
    else if (/monster|beast|creature|ogre|troll/.test(t)) c.species = "monster";
    // "red cape", "blue suit", "green hair"
    const colorRe = /(red|blue|green|yellow|purple|pink|orange|black|white|gold|silver|teal|brown|gray|grey|cyan|blonde|ginger)\s+(cape|suit|costume|outfit|armor|hair|mask|boots|belt)/g;
    let cm;
    const consumed = new Set();
    while ((cm = colorRe.exec(t))) {
      const [, col, what] = cm;
      consumed.add(what);
      if (what === "hair") c.hairColor = HAIR[col] || COLORS[col] || c.hairColor;
      else if (what === "cape") { c.cape = true; c.capeColor = COLORS[col] || c.capeColor; }
      else if (what === "mask") { c.mask = true; c.suit2 = COLORS[col] || c.suit2; }
      else if (what === "boots" || what === "belt") c.suit2 = COLORS[col] || c.suit2;
      else c.suit = COLORS[col] || c.suit;
    }
    if (!consumed.has("suit") && !consumed.has("costume") && !consumed.has("outfit")) {
      const any = t.match(/\b(red|blue|green|yellow|purple|pink|orange|black|white|gold|silver|teal|cyan)\b/);
      if (any) c.suit = COLORS[any[1]];
    }
    if (/blonde/.test(t)) c.hairColor = HAIR.blonde;
    if (/no cape|without a cape/.test(t)) c.cape = false; else if (/cape|cloak/.test(t)) c.cape = true;
    if (/mask/.test(t)) c.mask = true;
    if (/goggle/.test(t)) c.goggles = true;
    if (/glasses|spectacles/.test(t)) c.glasses = true;
    if (/crown|king|queen|prince|princess/.test(t)) c.hat = "crown";
    else if (/wizard|witch|sorcer|mage/.test(t)) { c.hat = "wizard"; c.power = "magic"; }
    else if (/\bcap\b|baseball/.test(t)) c.hat = "cap";
    else if (/helmet|astronaut|knight/.test(t)) c.hat = "helmet";
    for (const s of ["spiky", "long", "ponytail", "curly", "bun", "bald", "short"]) if (t.includes(s)) c.hairStyle = s;
    if (/angry|mad|furious|grumpy|villain|evil/.test(t)) c.expression = "angry";
    else if (/surprise|shock|amazed|wow/.test(t)) c.expression = "surprised";
    else if (/\bsad\b|crying|upset/.test(t)) c.expression = "sad";
    else if (/scared|afraid|nervous|frightened/.test(t)) c.expression = "scared";
    else if (/laugh|giggl/.test(t)) c.expression = "laughing";
    else if (/determined|serious|brave|focused|heroic/.test(t)) c.expression = "determined";
    else if (/happy|smil|cheer|friendly/.test(t)) c.expression = "happy";
    if (/fly|flying|soar/.test(t)) c.pose = "fly";
    else if (/punch|fight|attack|kick/.test(t)) c.pose = "punch";
    else if (/run|running|speed|fast|dash/.test(t)) c.pose = "run";
    else if (/wav|hello|greet/.test(t)) c.pose = "wave";
    else if (/stand|standing/.test(t)) c.pose = "stand";
    if (/fire|flame|lava|heat/.test(t)) { c.power = "fire"; c.emblem = "flame"; }
    else if (/\bice\b|frost|freeze|snow|cold/.test(t)) { c.power = "ice"; c.emblem = "snowflake"; }
    else if (/lightning|electric|thunder|shock|zap/.test(t)) { c.power = "lightning"; c.emblem = "bolt"; }
    else if (/magic|spell|enchant/.test(t)) c.power = "magic";
    else if (/energy|laser|plasma|cosmic/.test(t)) c.power = "energy";
    else if (/strong|strength|mighty|muscle/.test(t)) c.power = "strength";
    if (/speed|fast/.test(t) && c.emblem !== "bolt") c.emblem = "bolt";
    if (/heart|love|kind/.test(t)) c.emblem = "heart";
    const skinM = t.match(/\b(pale|light|tan|brown|dark)\s+skin/);
    if (skinM) c.skin = { pale: SKIN[0], light: SKIN[1], tan: SKIN[2], brown: SKIN[4], dark: SKIN[5] }[skinM[1]];
    return c;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

  function characterSVG(p) {
    p = Object.assign(defaultCharacter(1), p || {});
    const ol = 'stroke="#1a1a1a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
    const sp = p.species;
    const skin = sp === "robot" ? "#c9d3df" : sp === "alien" ? "#7ddc6a" : sp === "monster" ? "#8b5cf6" : sp === "cat" ? p.skin === SKIN[0] ? "#f59e0b" : p.skin : p.skin;
    const suit = p.suit, suit2 = p.suit2;
    const pose = p.pose;
    // limb angles (degrees, 0 = straight down, positive = toward the character's left/our right)
    const A = {
      stand: { la: 12, ra: -12, ll: 4, rl: -4 },
      hero: { la: 38, ra: -38, ll: 9, rl: -9, bent: true },
      wave: { la: 14, ra: -150, ll: 4, rl: -4 },
      punch: { la: 25, ra: -90, ll: 14, rl: -6, bigFist: true },
      fly: { la: 168, ra: -170, ll: 8, rl: -2 },
      run: { la: -40, ra: 45, ll: 30, rl: -32 },
    }[pose] || { la: 12, ra: -12, ll: 4, rl: -4 };
    const tilt = pose === "fly" ? -18 : pose === "run" ? -8 : 0;
    const parts = [];

    // power aura
    const auraCol = { fire: "#ff7a1a", ice: "#7dd3fc", lightning: "#facc15", magic: "#f472b6", energy: "#4ade80", strength: "#f87171" }[p.power];
    if (auraCol) {
      parts.push(`<defs><radialGradient id="aura"><stop offset="0" stop-color="${auraCol}" stop-opacity="0.55"/><stop offset="1" stop-color="${auraCol}" stop-opacity="0"/></radialGradient></defs>`);
      parts.push(`<ellipse cx="200" cy="300" rx="195" ry="275" fill="url(#aura)"/>`);
      const R = rng(p.power + p.name);
      for (let i = 0; i < 14; i++) {
        const a = R() * Math.PI * 2, d = 150 + R() * 70;
        const x = 200 + Math.cos(a) * d * 0.85, y = 300 + Math.sin(a) * d * 1.2, s = 8 + R() * 12;
        if (p.power === "fire") parts.push(`<path d="M${x} ${y - s * 1.6} Q${x + s} ${y} ${x} ${y + s * 0.6} Q${x - s} ${y} ${x} ${y - s * 1.6}Z" fill="#ffb02e" stroke="#e8590c" stroke-width="2"/>`);
        else if (p.power === "ice") parts.push(`<path d="M${x} ${y - s} L${x + s * 0.6} ${y} L${x} ${y + s} L${x - s * 0.6} ${y}Z" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>`);
        else if (p.power === "lightning") parts.push(`<path d="M${x - s * 0.3} ${y - s} L${x + s * 0.5} ${y - s * 0.1} L${x} ${y} L${x + s * 0.4} ${y + s} L${x - s * 0.5} ${y + s * 0.05} L${x} ${y}Z" fill="#fde047" stroke="#a16207" stroke-width="2"/>`);
        else if (p.power === "magic") parts.push(`<path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28}Z" fill="#fbcfe8" stroke="#be185d" stroke-width="2"/>`);
        else parts.push(`<circle cx="${x}" cy="${y}" r="${s * 0.45}" fill="${auraCol}" opacity="0.8"/>`);
      }
    }
    if (pose === "fly" || pose === "run") {
      for (let i = 0; i < 5; i++) parts.push(`<path d="M${pose === "fly" ? 330 + i * 6 : 40} ${180 + i * 60} l${pose === "fly" ? 60 : -60} ${pose === "fly" ? 30 : 0}" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round" opacity="0.5"/>`);
    }
    parts.push(`<g transform="rotate(${tilt} 200 330)">`);

    // cape (behind)
    if (p.cape) {
      const flow = pose === "fly" ? "M150 225 Q120 340 60 470 Q170 440 210 500 Q250 430 330 450 Q290 330 250 225Z"
        : pose === "run" ? "M150 225 Q90 320 40 430 Q140 420 200 470 Q230 380 250 225Z"
          : "M150 225 Q120 360 110 500 Q200 520 290 500 Q280 360 250 225Z";
      parts.push(`<path d="${flow}" fill="${p.capeColor}" ${ol}/>`);
    }
    if (sp === "cat") parts.push(`<path d="M240 360 Q320 380 330 300 Q335 270 315 265" fill="none" stroke="#1a1a1a" stroke-width="22" stroke-linecap="round"/><path d="M240 360 Q320 380 330 300 Q335 270 315 265" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>`);
    // long hair back
    if (sp === "human" && (p.hairStyle === "long")) parts.push(`<path d="M128 150 Q120 260 150 285 L250 285 Q280 260 272 150Z" fill="${p.hairColor}" ${ol}/>`);

    // legs
    const leg = (hx, ang, boot) => `<g transform="rotate(${ang} ${hx} 360)"><rect x="${hx - 21}" y="350" width="42" height="120" rx="16" fill="${sp === "robot" ? "#94a3b8" : suit}" ${ol}/><path d="M${hx - 24} 455 h48 v34 q0 12 -12 12 h-44 q-10 0 -8 -10 l4 -10 h12Z" fill="${boot}" ${ol}/></g>`;
    parts.push(leg(178, A.ll, sp === "robot" ? "#64748b" : suit2));
    parts.push(leg(222, A.rl, sp === "robot" ? "#64748b" : suit2));

    // torso
    if (sp === "robot") {
      parts.push(`<rect x="140" y="215" width="120" height="150" rx="18" fill="#cbd5e1" ${ol}/><rect x="162" y="245" width="76" height="56" rx="8" fill="#1e293b" stroke="#1a1a1a" stroke-width="4"/>`);
      parts.push(`<circle cx="182" cy="273" r="9" fill="${suit}"/><circle cx="218" cy="273" r="9" fill="#4ade80"/><rect x="160" y="318" width="80" height="12" rx="6" fill="${suit}"/>`);
    } else if (sp === "monster") {
      parts.push(`<path d="M135 225 Q120 300 140 370 L260 370 Q280 300 265 225 Q200 200 135 225Z" fill="${skin}" ${ol}/><path d="M165 300 q35 30 70 0" fill="none" stroke="#1a1a1a" stroke-width="4" opacity="0.4"/>`);
      parts.push(`<rect x="140" y="335" width="120" height="34" rx="10" fill="${suit}" ${ol}/>`);
    } else {
      parts.push(`<path d="M145 225 Q200 205 255 225 L262 360 Q200 375 138 360Z" fill="${suit}" ${ol}/>`);
      parts.push(`<rect x="140" y="335" width="120" height="22" rx="8" fill="${suit2}" ${ol}/><rect x="188" y="333" width="24" height="26" rx="5" fill="#facc15" stroke="#1a1a1a" stroke-width="4"/>`);
    }
    // emblem
    const ey = 275;
    const emblem = {
      star: `<path d="M200 ${ey - 28} l8 18 20 2 -15 13 5 20 -18 -11 -18 11 5 -20 -15 -13 20 -2Z" fill="${suit2}" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round"/>`,
      bolt: `<path d="M206 ${ey - 32} L182 ${ey + 4} L200 ${ey + 4} L192 ${ey + 32} L220 ${ey - 6} L202 ${ey - 6}Z" fill="${suit2}" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round"/>`,
      heart: `<path d="M200 ${ey + 24} C170 ${ey + 2} 176 ${ey - 26} 200 ${ey - 10} C224 ${ey - 26} 230 ${ey + 2} 200 ${ey + 24}Z" fill="${suit2}" stroke="#1a1a1a" stroke-width="4"/>`,
      flame: `<path d="M200 ${ey - 32} Q226 ${ey - 4} 214 ${ey + 22} Q200 ${ey + 34} 186 ${ey + 22} Q174 ${ey - 2} 196 ${ey - 12} Q194 ${ey - 22} 200 ${ey - 32}Z" fill="#ffb02e" stroke="#1a1a1a" stroke-width="4"/>`,
      snowflake: `<g stroke="${suit2}" stroke-width="6" stroke-linecap="round"><path d="M200 ${ey - 26} V${ey + 26} M178 ${ey - 13} L222 ${ey + 13} M178 ${ey + 13} L222 ${ey - 13}"/></g>`,
      letter: `<circle cx="200" cy="${ey}" r="28" fill="${suit2}" stroke="#1a1a1a" stroke-width="4"/><text x="200" y="${ey + 12}" text-anchor="middle" font-family="Bangers, Impact, sans-serif" font-size="36" fill="${suit}" stroke="#1a1a1a" stroke-width="1.5">${esc((p.name || "H")[0].toUpperCase())}</text>`,
      none: "",
    }[p.emblem] || "";
    if (sp !== "robot" && sp !== "monster") parts.push(emblem);

    // arms
    const handCol = sp === "robot" ? "#64748b" : sp === "human" ? (p.mask || p.cape ? suit2 : skin) : skin;
    const arm = (sx, ang, big) => {
      const len = 100;
      const fist = big ? 26 : 19;
      return `<g transform="rotate(${ang} ${sx} 238)"><rect x="${sx - 17}" y="228" width="34" height="${len}" rx="16" fill="${sp === "robot" ? "#94a3b8" : sp === "monster" ? skin : suit}" ${ol}/><circle cx="${sx}" cy="${238 + len}" r="${fist}" fill="${handCol}" ${ol}/></g>`;
    };
    parts.push(arm(150, A.la, false));
    parts.push(arm(250, A.ra, A.bigFist));
    if (pose === "punch") parts.push(`<g stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"><path d="M372 220 l22 -10 M378 240 l26 0 M372 260 l22 10"/></g>`);

    // neck + head
    parts.push(`<rect x="183" y="198" width="34" height="30" fill="${skin}" ${ol}/>`);
    const hx = 200, hy = 135;
    if (sp === "robot") {
      parts.push(`<line x1="200" y1="60" x2="200" y2="30" stroke="#1a1a1a" stroke-width="5"/><circle cx="200" cy="26" r="11" fill="${suit}" ${ol}/>`);
      parts.push(`<rect x="128" y="60" width="144" height="140" rx="26" fill="#dbe3ec" ${ol}/><rect x="146" y="92" width="108" height="56" rx="14" fill="#0f172a" stroke="#1a1a1a" stroke-width="4"/>`);
      parts.push(`<rect x="152" y="160" width="96" height="22" rx="6" fill="#94a3b8" stroke="#1a1a1a" stroke-width="3"/>`);
      for (let i = 0; i < 5; i++) parts.push(`<line x1="${166 + i * 17}" y1="162" x2="${166 + i * 17}" y2="180" stroke="#1a1a1a" stroke-width="3"/>`);
      parts.push(`<circle cx="124" cy="130" r="12" fill="${suit}" ${ol}/><circle cx="276" cy="130" r="12" fill="${suit}" ${ol}/>`);
    } else if (sp === "cat") {
      parts.push(`<path d="M138 95 L132 30 L185 68Z M262 95 L268 30 L215 68Z" fill="${skin}" ${ol}/><path d="M145 82 L142 48 L170 70Z M255 82 L258 48 L230 70Z" fill="#f9a8d4"/>`);
      parts.push(`<ellipse cx="${hx}" cy="${hy}" rx="78" ry="70" fill="${skin}" ${ol}/>`);
    } else if (sp === "alien") {
      parts.push(`<path d="M165 72 Q150 30 140 22 M235 72 Q250 30 260 22" stroke="#1a1a1a" stroke-width="5" fill="none"/><circle cx="140" cy="22" r="10" fill="#f472b6" ${ol}/><circle cx="260" cy="22" r="10" fill="#f472b6" ${ol}/>`);
      parts.push(`<path d="M200 50 C275 50 290 120 265 165 C245 205 155 205 135 165 C110 120 125 50 200 50Z" fill="${skin}" ${ol}/>`);
    } else if (sp === "monster") {
      parts.push(`<path d="M140 80 Q120 40 132 18 Q150 50 168 66Z M260 80 Q280 40 268 18 Q250 50 232 66Z" fill="#fef3c7" ${ol}/>`);
      parts.push(`<path d="M200 58 C268 58 285 110 278 150 C270 200 130 200 122 150 C115 110 132 58 200 58Z" fill="${skin}" ${ol}/>`);
    } else {
      parts.push(`<circle cx="128" cy="${hy + 6}" r="13" fill="${skin}" ${ol}/><circle cx="272" cy="${hy + 6}" r="13" fill="${skin}" ${ol}/>`);
      parts.push(`<ellipse cx="${hx}" cy="${hy}" rx="72" ry="74" fill="${skin}" ${ol}/>`);
    }

    // face
    const ex = p.expression;
    const eyeY = sp === "alien" ? 128 : sp === "robot" ? 120 : 138;
    const eyeDX = sp === "alien" ? 34 : 27;
    if (sp === "robot") {
      const glow = ex === "angry" ? "#f87171" : "#22d3ee";
      if (ex === "happy" || ex === "laughing") parts.push(`<path d="M160 126 q13 -16 26 0 M214 126 q13 -16 26 0" stroke="${glow}" stroke-width="7" fill="none" stroke-linecap="round"/>`);
      else if (ex === "angry") parts.push(`<path d="M160 112 l26 10 M240 112 l-26 10" stroke="${glow}" stroke-width="7" stroke-linecap="round"/><rect x="160" y="124" width="26" height="8" fill="${glow}"/><rect x="214" y="124" width="26" height="8" fill="${glow}"/>`);
      else parts.push(`<circle cx="173" cy="120" r="${ex === "surprised" ? 13 : 9}" fill="${glow}"/><circle cx="227" cy="120" r="${ex === "surprised" ? 13 : 9}" fill="${glow}"/>`);
    } else if (sp === "alien") {
      parts.push(`<ellipse cx="${hx - eyeDX}" cy="${eyeY}" rx="22" ry="${ex === "surprised" ? 30 : 26}" fill="#111827" transform="rotate(-18 ${hx - eyeDX} ${eyeY})"/><ellipse cx="${hx + eyeDX}" cy="${eyeY}" rx="22" ry="${ex === "surprised" ? 30 : 26}" fill="#111827" transform="rotate(18 ${hx + eyeDX} ${eyeY})"/>`);
      parts.push(`<circle cx="${hx - eyeDX + 6}" cy="${eyeY - 10}" r="6" fill="#fff"/><circle cx="${hx + eyeDX + 6}" cy="${eyeY - 10}" r="6" fill="#fff"/>`);
    } else if (sp === "monster") {
      parts.push(`<circle cx="200" cy="118" r="30" fill="#fff" ${ol}/><circle cx="${ex === "angry" ? 204 : 200}" cy="${ex === "sad" ? 126 : 120}" r="13" fill="#111"/><circle cx="196" cy="114" r="4" fill="#fff"/>`);
      if (ex === "angry") parts.push(`<path d="M166 88 L232 100" stroke="#1a1a1a" stroke-width="7" stroke-linecap="round"/>`);
    } else {
      // eyes
      if (ex === "laughing") parts.push(`<path d="M${hx - eyeDX - 12} ${eyeY + 4} q12 -16 24 0 M${hx + eyeDX - 12} ${eyeY + 4} q12 -16 24 0" stroke="#1a1a1a" stroke-width="5" fill="none" stroke-linecap="round"/>`);
      else {
        const er = ex === "surprised" || ex === "scared" ? 15 : 12, pr = ex === "angry" ? 6 : ex === "surprised" ? 6 : 8;
        const catEye = sp === "cat";
        parts.push(`<ellipse cx="${hx - eyeDX}" cy="${eyeY}" rx="${er}" ry="${er * 1.15}" fill="#fff" stroke="#1a1a1a" stroke-width="4"/><ellipse cx="${hx + eyeDX}" cy="${eyeY}" rx="${er}" ry="${er * 1.15}" fill="#fff" stroke="#1a1a1a" stroke-width="4"/>`);
        parts.push(catEye
          ? `<ellipse cx="${hx - eyeDX}" cy="${eyeY + 2}" rx="4" ry="${pr + 3}" fill="#111"/><ellipse cx="${hx + eyeDX}" cy="${eyeY + 2}" rx="4" ry="${pr + 3}" fill="#111"/>`
          : `<circle cx="${hx - eyeDX + 2}" cy="${eyeY + 2}" r="${pr}" fill="#111"/><circle cx="${hx + eyeDX + 2}" cy="${eyeY + 2}" r="${pr}" fill="#111"/><circle cx="${hx - eyeDX + 5}" cy="${eyeY - 2}" r="2.5" fill="#fff"/><circle cx="${hx + eyeDX + 5}" cy="${eyeY - 2}" r="2.5" fill="#fff"/>`);
      }
      // brows
      const brow = {
        angry: `M${hx - eyeDX - 16} ${eyeY - 24} L${hx - eyeDX + 14} ${eyeY - 14} M${hx + eyeDX + 16} ${eyeY - 24} L${hx + eyeDX - 14} ${eyeY - 14}`,
        sad: `M${hx - eyeDX - 14} ${eyeY - 16} L${hx - eyeDX + 14} ${eyeY - 25} M${hx + eyeDX + 14} ${eyeY - 16} L${hx + eyeDX - 14} ${eyeY - 25}`,
        scared: `M${hx - eyeDX - 14} ${eyeY - 20} L${hx - eyeDX + 14} ${eyeY - 28} M${hx + eyeDX + 14} ${eyeY - 20} L${hx + eyeDX - 14} ${eyeY - 28}`,
        surprised: `M${hx - eyeDX - 14} ${eyeY - 30} q14 -8 28 0 M${hx + eyeDX - 14} ${eyeY - 30} q14 -8 28 0`,
        determined: `M${hx - eyeDX - 15} ${eyeY - 22} L${hx - eyeDX + 14} ${eyeY - 17} M${hx + eyeDX + 15} ${eyeY - 22} L${hx + eyeDX - 14} ${eyeY - 17}`,
      }[ex] || `M${hx - eyeDX - 14} ${eyeY - 22} q14 -8 28 0 M${hx + eyeDX - 14} ${eyeY - 22} q14 -8 28 0`;
      parts.push(`<path d="${brow}" stroke="${sp === "cat" ? "#1a1a1a" : p.hairColor === "#eeeeee" ? "#666" : "#1a1a1a"}" stroke-width="6" fill="none" stroke-linecap="round"/>`);
      if (sp === "cat") parts.push(`<path d="M192 160 h16 l-8 9Z" fill="#f472b6" stroke="#1a1a1a" stroke-width="3"/><path d="M150 165 h-40 M150 175 h-38 M250 165 h40 M250 175 h38" stroke="#1a1a1a" stroke-width="3"/>`);
    }
    // mouth
    if (sp !== "robot") {
      const my = sp === "alien" ? 170 : sp === "monster" ? 162 : 178;
      const mouth = {
        happy: `<path d="M178 ${my} q22 22 44 0" stroke="#1a1a1a" stroke-width="5" fill="none" stroke-linecap="round"/>`,
        laughing: `<path d="M172 ${my - 4} q28 40 56 0Z" fill="#7f1d1d" stroke="#1a1a1a" stroke-width="5" stroke-linejoin="round"/><path d="M182 ${my + 10} q18 10 36 0" fill="#f87171"/>`,
        determined: `<path d="M182 ${my + 4} q18 6 36 -4" stroke="#1a1a1a" stroke-width="5" fill="none" stroke-linecap="round"/>`,
        angry: `<path d="M178 ${my + 10} q22 -16 44 0" stroke="#1a1a1a" stroke-width="5" fill="none" stroke-linecap="round"/>`,
        surprised: `<ellipse cx="200" cy="${my + 6}" rx="11" ry="14" fill="#7f1d1d" stroke="#1a1a1a" stroke-width="5"/>`,
        sad: `<path d="M180 ${my + 10} q20 -14 40 0" stroke="#1a1a1a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M${hx - eyeDX + 8} ${eyeY + 18} q-6 12 0 16 q6 -4 0 -16Z" fill="#7dd3fc" stroke="#0369a1" stroke-width="2"/>`,
        scared: `<path d="M176 ${my + 6} l8 -6 8 6 8 -6 8 6 8 -6 8 6" stroke="#1a1a1a" stroke-width="4" fill="none" stroke-linejoin="round"/><path d="M262 104 q-8 14 0 20 q8 -6 0 -20Z" fill="#7dd3fc" stroke="#0369a1" stroke-width="2"/>`,
      }[ex] || "";
      if (sp === "monster") parts.push(`<path d="M160 ${my - 4} Q200 ${my + (ex === "angry" ? 26 : 40)} 240 ${my - 4}Z" fill="#3b0764" ${ol}/><path d="M172 ${my} l7 12 7 -10 M214 ${my} l7 12 7 -12" fill="#fff" stroke="#1a1a1a" stroke-width="2"/>`);
      else parts.push(mouth);
      if (sp === "human" && (ex === "happy" || ex === "laughing")) parts.push(`<circle cx="152" cy="168" r="10" fill="#f9a8d4" opacity="0.6"/><circle cx="248" cy="168" r="10" fill="#f9a8d4" opacity="0.6"/>`);
    }

    // hair (front)
    if (sp === "human") {
      const hc = p.hairColor;
      const hairPaths = {
        short: `<path d="M128 130 Q125 62 200 58 Q275 62 272 130 Q255 96 225 92 Q200 108 170 94 Q140 100 128 130Z" fill="${hc}" ${ol}/>`,
        spiky: `<path d="M126 128 L118 82 L148 92 L146 48 L178 76 L196 34 L214 74 L248 46 L250 90 L282 80 L272 128 Q245 92 200 98 Q155 92 126 128Z" fill="${hc}" ${ol}/>`,
        long: `<path d="M126 150 Q118 60 200 56 Q282 60 274 150 Q262 100 236 90 Q200 112 160 92 Q134 106 126 150Z" fill="${hc}" ${ol}/>`,
        ponytail: `<path d="M268 92 Q330 100 318 200 Q300 160 282 140Z" fill="${hc}" ${ol}/><path d="M128 128 Q126 62 200 58 Q274 62 272 128 Q250 92 200 96 Q150 92 128 128Z" fill="${hc}" ${ol}/>`,
        curly: [[-50, 82], [-25, 66], [5, 60], [35, 66], [58, 84], [-64, 108], [68, 108]].map(([dx, dy]) => `<circle cx="${200 + dx}" cy="${dy}" r="24" fill="${hc}" ${ol}/>`).join(""),
        bun: `<circle cx="200" cy="44" r="26" fill="${hc}" ${ol}/><path d="M128 128 Q126 62 200 58 Q274 62 272 128 Q250 92 200 96 Q150 92 128 128Z" fill="${hc}" ${ol}/>`,
        bald: "",
      };
      parts.push(hairPaths[p.hairStyle] || hairPaths.short);
    }
    // mask, glasses, goggles, hats
    if (p.mask && sp !== "robot") parts.push(`<path d="M${hx - 66} ${eyeY - 8} Q${hx} ${eyeY - 30} ${hx + 66} ${eyeY - 8} L${hx + 60} ${eyeY + 18} Q${hx} ${eyeY + 6} ${hx - 60} ${eyeY + 18}Z" fill="${suit2 === "#f8fafc" ? "#1f2937" : suit2}" ${ol}/><ellipse cx="${hx - eyeDX}" cy="${eyeY}" rx="12" ry="10" fill="#fff"/><ellipse cx="${hx + eyeDX}" cy="${eyeY}" rx="12" ry="10" fill="#fff"/><circle cx="${hx - eyeDX + 2}" cy="${eyeY + 1}" r="6" fill="#111"/><circle cx="${hx + eyeDX + 2}" cy="${eyeY + 1}" r="6" fill="#111"/>`);
    if (p.glasses) parts.push(`<g fill="rgba(200,230,255,0.35)" stroke="#1a1a1a" stroke-width="5"><circle cx="${hx - eyeDX}" cy="${eyeY}" r="19"/><circle cx="${hx + eyeDX}" cy="${eyeY}" r="19"/></g><path d="M${hx - 8} ${eyeY} h16" stroke="#1a1a1a" stroke-width="5"/>`);
    if (p.goggles) parts.push(`<rect x="126" y="78" width="148" height="16" rx="6" fill="#374151" stroke="#1a1a1a" stroke-width="4"/><circle cx="170" cy="86" r="20" fill="#7dd3fc" stroke="#1a1a1a" stroke-width="5"/><circle cx="230" cy="86" r="20" fill="#7dd3fc" stroke="#1a1a1a" stroke-width="5"/><circle cx="164" cy="80" r="6" fill="#fff"/><circle cx="224" cy="80" r="6" fill="#fff"/>`);
    if (p.hat === "cap") parts.push(`<path d="M130 100 Q132 48 200 46 Q268 48 270 100Z" fill="${suit}" ${ol}/><path d="M200 96 Q260 92 300 104 Q262 112 200 106Z" fill="${shade(suit, -0.25)}" ${ol}/>`);
    else if (p.hat === "wizard") parts.push(`<path d="M120 100 L200 -20 L280 100Z" fill="${suit}" ${ol}/><ellipse cx="200" cy="100" rx="96" ry="16" fill="${shade(suit, -0.2)}" ${ol}/><path d="M200 30 l6 12 13 2 -10 9 3 13 -12 -7 -12 7 3 -13 -10 -9 13 -2Z" fill="#facc15"/>`);
    else if (p.hat === "crown") parts.push(`<path d="M146 78 L150 30 L174 56 L200 22 L226 56 L250 30 L254 78Z" fill="#facc15" ${ol}/><circle cx="200" cy="58" r="7" fill="#e63946"/>`);
    else if (p.hat === "helmet") parts.push(`<path d="M124 132 Q120 50 200 46 Q280 50 276 132 L262 132 Q258 74 200 70 Q142 74 138 132Z" fill="${suit}" ${ol}/><rect x="190" y="40" width="20" height="40" rx="6" fill="${suit2}" ${ol}/>`);

    parts.push(`</g>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -40 420 600" width="420" height="600">${parts.join("")}</svg>`;
  }

  const svgURL = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

  async function characterCanvas(params, scale = 1) {
    const img = await CBS.loadImage(svgURL(characterSVG(params)));
    const c = makeCanvas(420 * scale, 600 * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  /* Compose a panel: a background matching the prompt with a character in front when one is mentioned. */
  async function panel(prompt, seed = 1, w = 1200, h = 800) {
    const bg = background(parseBackground(prompt), seed, w, h);
    const t = String(prompt || "").toLowerCase();
    const wantsChar = /hero|girl|boy|kid|man|woman|robot|cat|alien|monster|villain|character|person|she|he |they|wizard|knight|princess|king|queen|named|called/.test(t);
    if (wantsChar) {
      const p = parseCharacter(prompt, seed);
      const cc = await characterCanvas(p, 1);
      const ctx = bg.getContext("2d");
      const ch = h * 0.82, cw = (ch * cc.width) / cc.height;
      const R = rng(seed + "pos");
      const x = p.pose === "fly" ? w * (0.2 + R() * 0.35) : w * (0.15 + R() * 0.5);
      const y = p.pose === "fly" ? h * 0.05 : h - ch * 0.98;
      ctx.drawImage(cc, x, y, cw, ch);
    }
    return bg;
  }

  Object.assign(G, {
    SCENE_INFO, SPECIES, HAIR_STYLES, EXPRESSIONS, POSES, POWERS, EMBLEMS, HATS, SKIN, HAIR, COLORS,
    background, parseBackground, parseCharacter, defaultCharacter, characterSVG, characterCanvas, svgURL, panel,
  });
})();
