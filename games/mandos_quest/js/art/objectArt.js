/* Animated world objects: platforms, hazards, switches, pickups and collectibles. */
(function (MQ) {
  const { box, poly, oval, line, glow, metal, shade, alpha, text, rng, clamp } = MQ.U;
  const INK = MQ.INK;
  const { sin, cos, abs, max, min, floor, PI } = Math;

  function rune(ctx, x, y, color, time, size = 12) {
    const pulse = 0.55 + sin(time * 4) * 0.3;
    poly(ctx, [x, y - size, x + size * 0.75, y, x, y + size, x - size * 0.75, y], null, color, 2.5);
    line(ctx, x - size * 0.3, y, x + size * 0.3, y, color, 2.5);
    glow(ctx, x, y, size * 2.6, color, pulse);
  }

  function platform(ctx, p, time) {
    const mat = MQ.MATERIALS[p.mat];
    const { x, y, w } = p;
    if (mat.style === "panel") {
      box(ctx, x, y, w, 18, 4, shade(mat.face, 0.12), INK, 2);
      box(ctx, x + 2, y + 1, w - 4, 4, 1, mat.top);
      for (let i = x + 10; i < x + w - 10; i += 24) box(ctx, i, y + 9, 12, 4, 1, mat.trim);
      for (const px of [x + 20, x + w - 20]) glow(ctx, px, y + 22, 22 + sin(time * 14 + px) * 3, mat.trim, 0.5);
    } else {
      poly(ctx, [x, y, x + w, y, x + w - 8, y + 18, x + w * 0.6, y + 28, x + w * 0.35, y + 24, x + 8, y + 18], mat.face, INK, 2);
      line(ctx, x + 2, y + 2, x + w - 2, y + 2, mat.top, 5);
      glow(ctx, x + w / 2, y + 22, 30, mat.trim, 0.35);
    }
  }

  function falling(ctx, p, time) {
    const mat = MQ.MATERIALS[p.mat];
    const shake = p.state === 1 ? sin(time * 60) * 2.5 : 0;
    const x = p.x + shake;
    const { y, w } = p;
    poly(ctx, [x, y, x + w, y, x + w - 5, y + 15, x + 5, y + 15], shade(mat.face, 0.14), INK, 2);
    line(ctx, x + 2, y + 2, x + w - 2, y + 2, mat.top, 4);
    line(ctx, x + w * 0.3, y + 2, x + w * 0.38, y + 13, INK, 2);
    line(ctx, x + w * 0.68, y + 2, x + w * 0.6, y + 12, INK, 2);
  }

  function crate(ctx, c) {
    const { x, y, w, h } = c;
    const color = c.barrel ? "#8a4038" : "#8a6848";
    box(ctx, x, y, w, h, 3, color, INK, 2);
    box(ctx, x + 5, y + 5, w - 10, h - 10, 2, shade(color, -0.22));
    if (c.barrel) {
      poly(ctx, [x + w / 2, y + 12, x + w - 12, y + h - 12, x + 12, y + h - 12], "#ffd45c", INK, 1.5);
      line(ctx, x + w / 2, y + 22, x + w / 2, y + h - 22, INK, 3);
    } else {
      line(ctx, x + 7, y + 7, x + w - 7, y + h - 7, color, 6);
      line(ctx, x + w - 7, y + 7, x + 7, y + h - 7, color, 6);
      line(ctx, x + 3, y + 3, x + w - 3, y + 3, shade(color, 0.3), 2);
    }
    if (c.hp < c.maxHp) line(ctx, x + w * 0.4, y + 2, x + w * 0.55, y + h * 0.45, INK, 2);
  }

  // A cracked wall that weapons can break.
  function cracked(ctx, w) {
    const mat = MQ.MATERIALS[w.mat];
    box(ctx, w.x, w.y, w.w, w.h, 2, shade(mat.face, 0.1), INK, 2);
    const random = rng(w.seed);
    for (let i = 0; i < Math.ceil(w.h / 22); i++) {
      const y = w.y + random.range(4, w.h - 4);
      const x = w.x + random.range(4, w.w - 4);
      line(ctx, w.x + w.w / 2, y, x, y + random.range(-18, 18), INK, 2);
    }
    if (w.hp < w.maxHp) {
      ctx.fillStyle = `rgba(0,0,0,${0.35 * (1 - w.hp / w.maxHp)})`;
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  // Rubble that only Force Push can clear.
  function rubble(ctx, r, time) {
    const random = rng(r.seed);
    ctx.save();
    ctx.translate(r.x, r.y);
    poly(ctx, [0, r.h, 2, 14, r.w * 0.35, 0, r.w * 0.8, 4, r.w, r.h * 0.3, r.w, r.h], "#4b4440", INK, 2);
    for (let i = 0; i < Math.ceil(r.h / 14); i++) {
      const x = random.range(8, r.w - 8);
      const y = random.range(12, r.h - 8);
      oval(ctx, x, y, random.range(6, 14), random.range(5, 11), random() > 0.5 ? "#6b625b" : "#57504a", INK, 1.2);
    }
    rune(ctx, r.w / 2, r.h / 2, "#6ec8ff", time);
    ctx.restore();
  }

  function boulder(ctx, b, time) {
    const { w, h } = b;
    ctx.save();
    ctx.translate(b.x, b.y);
    poly(ctx, [0, h, 0, 8, 8, 0, w - 8, 0, w, 8, w, h], metal(ctx, "#6e665c", 0, h, 0.25), INK, 2.5);
    poly(ctx, [w * 0.12, h * 0.8, w * 0.2, 12, w * 0.5, 8, w * 0.36, h * 0.5], "rgba(255,255,255,0.07)");
    line(ctx, w * 0.8, h * 0.15, w * 0.7, h * 0.55, "rgba(0,0,0,0.3)", 3);
    if (!b.moved) rune(ctx, w / 2, h / 2, b.heavy ? "#ffc84d" : "#6ec8ff", time, min(18, h * 0.25));
    ctx.restore();
  }

  // An ancient mechanism that Baby G can wake.
  function mechanism(ctx, m, time) {
    const { x, y } = m;
    const on = m.active;
    poly(ctx, [x - 26, y, x - 16, y - 24, x + 16, y - 24, x + 26, y], "#4b5652", INK, 2);
    box(ctx, x - 6, y - 52, 12, 30, 2, "#39423f", INK, 2);
    ctx.save();
    ctx.translate(x, y - 66);
    ctx.rotate(on ? time * 2 : sin(time) * 0.15);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(PI / 2);
      poly(ctx, [12, -5, 25, 0, 12, 5], "#8a7758", INK, 1.5);
    }
    oval(ctx, 0, 0, 16, 16, "#6f6552", INK, 2);
    ctx.restore();
    rune(ctx, x, y - 66, on ? "#6dff9a" : m.heavy ? "#ffc84d" : "#6ec8ff", time, 10);
  }

  function gate(ctx, g, time) {
    const k = g.open;
    if (k >= 1) return;
    const { x, w } = g;
    const height = (g.bottom - g.top) * (1 - k);
    if (g.energy) {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = alpha(g.color, 0.22 + sin(time * 18) * 0.05);
      ctx.fillRect(x, g.top, w, g.bottom - g.top);
      for (let y = g.top + ((time * 70) % 22); y < g.bottom; y += 22) line(ctx, x, y, x + w, y - 4, g.color, 2);
      glow(ctx, x + w / 2, (g.top + g.bottom) / 2, 70, g.color, 0.4);
      ctx.globalAlpha = 1;
    } else {
      box(ctx, x, g.top, w, height, 2, "#4a535e", INK, 2);
      for (let y = g.top + 12; y < g.top + height - 12; y += 28) poly(ctx, [x + 3, y + 10, x + w - 3, y, x + w - 3, y + 7, x + 3, y + 17], g.color);
    }
    box(ctx, x - 6, g.top - 10, w + 12, 12, 2, "#39414a", INK, 2);
  }

  function arenaWall(ctx, x, top, bottom, time) {
    ctx.fillStyle = `rgba(255,70,70,${0.14 + sin(time * 10) * 0.05})`;
    ctx.fillRect(x - 5, top, 10, bottom - top);
    for (let y = top + ((time * 120) % 40); y < bottom; y += 40) line(ctx, x - 5, y, x + 5, y + 14, "rgba(255,120,110,0.7)", 2);
  }

  function bridge(ctx, b, time) {
    const mat = MQ.MATERIALS[b.mat];
    if (!b.active) {
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = alpha(mat.trim, 0.45);
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, 14);
      ctx.setLineDash([]);
      return;
    }
    const k = clamp(b.age / 0.5, 0, 1);
    box(ctx, b.x, b.y, b.w * k, 14, 2, alpha(mat.trim, 0.5), mat.trim, 2);
    for (let i = 8; i < b.w * k - 6; i += 22) line(ctx, b.x + i, b.y + 3, b.x + i + 6, b.y + 11, "#ffffff", 1.5);
    glow(ctx, b.x + (b.w * k) / 2, b.y + 7, 60, mat.trim, 0.3 + sin(time * 5) * 0.1);
  }

  /* ---------- Hazards ---------- */

  const HAZARD = {
    lava(ctx, h, time, left, right) {
      ctx.fillStyle = "#a82c16";
      ctx.fillRect(left, h.y + 4, right - left, h.h - 4);
      ctx.beginPath();
      ctx.moveTo(left, h.y + 18);
      for (let x = left; x <= right; x += 20) ctx.lineTo(x, h.y + 4 + sin(time * 3 + x * 0.04) * 4);
      ctx.lineTo(right, h.y + 4 + sin(time * 3 + right * 0.04) * 4);
      ctx.lineTo(right, h.y + 22);
      ctx.fillStyle = "#ff7a22";
      ctx.fill();
      for (let x = floor(left / 90) * 90; x < right; x += 90) {
        const cx = x + 45;
        if (cx < left || cx > right) continue;
        const k = (time * 0.5 + x * 0.013) % 1;
        glow(ctx, cx, h.y + 10, 70, "#ff7a22", 0.38);
        oval(ctx, cx, h.y + 14 - k * 10, 3 + k * 4, 2 + k * 3, "#ffd45c");
      }
    },
    acid(ctx, h, time, left, right) {
      ctx.fillStyle = "rgba(90,200,70,0.75)";
      ctx.fillRect(left, h.y + 4, right - left, h.h - 4);
      for (let x = left; x < right; x += 24) line(ctx, x, h.y + 5 + sin(time * 2 + x * 0.05) * 3, min(right, x + 14), h.y + 5, "#c8ff8a", 3);
    },
    // Deep water with something living in it.
    water(ctx, h, time, left, right) {
      ctx.fillStyle = "rgba(30,120,145,0.7)";
      ctx.fillRect(left, h.y + 5, right - left, h.h - 5);
      for (let x = left; x < right; x += 30) line(ctx, x, h.y + 6 + sin(time * 2 + x * 0.04) * 3, min(right, x + 18), h.y + 6, "#8ff0f0", 2.5);
    },
    spikes(ctx, h, time, left, right) {
      for (let x = h.x; x < h.x + h.w - 6; x += 20) {
        if (x > right || x + 20 < left) continue;
        poly(ctx, [x, h.y + h.h, x + 10, h.y, x + 20, h.y + h.h], h.color || "#9aa3ab", INK, 1.5);
      }
    },
    sinksand(ctx, h, time, left, right) {
      ctx.fillStyle = "rgba(200,154,94,0.96)";
      ctx.fillRect(left, h.y, right - left, h.h);
      ctx.strokeStyle = "#8a6038";
      ctx.lineWidth = 2;
      for (let x = floor(left / 80) * 80; x < right; x += 80) {
        for (let i = 0; i < 2; i++) {
          const k = (time * 0.4 + i / 2 + x * 0.001) % 1;
          ctx.beginPath();
          ctx.ellipse(x + 40, h.y + 8, (1 - k) * 36 + 2, (1 - k) * 7 + 1, 0, 0, MQ.TAU);
          ctx.stroke();
        }
      }
    },
    electric(ctx, h, time, left, right) {
      box(ctx, h.x, h.y + h.h - 7, h.w, 7, 2, "#30363e", INK, 1);
      if (!h.on) {
        if (h.warn) glow(ctx, h.x + h.w / 2, h.y + h.h - 4, 24, "#7fd4ff", 0.6);
        return;
      }
      ctx.beginPath();
      ctx.moveTo(left, h.y + h.h - 6);
      for (let x = left; x < right; x += 12) ctx.lineTo(x, h.y + (sin(x * 7.3 + floor(time * 20) * 2.1) * 0.5 + 0.5) * h.h);
      ctx.strokeStyle = "#aee8ff";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      glow(ctx, (left + right) / 2, h.y + h.h / 2, max(30, h.h * 1.5), "#58b8ff", 0.4);
    },
    steam(ctx, h, time) {
      const cx = h.x + h.w / 2;
      const bottom = h.y + h.h;
      box(ctx, h.x + 4, bottom - 10, h.w - 8, 10, 2, "#3a3430", INK, 1.5);
      if (!h.on && !h.warn) return;
      const amount = h.on ? 1 : 0.22;
      for (let i = 0; i < 8; i++) {
        const k = (time * 2 + i / 8) % 1;
        ctx.globalAlpha = 1 - k;
        oval(ctx, cx + sin(i * 2.4 + time * 4) * k * 12, bottom - 8 - k * (h.h - 8) * amount, 7 + k * 17, 10 + k * 14, h.fire ? (k < 0.4 ? "#ffd45c" : "#ff6a2a") : "#d9e2e6");
      }
      ctx.globalAlpha = 1;
      if (h.fire) glow(ctx, cx, bottom - 20, 50, "#ff8a3d", amount * 0.7);
    },
    laser(ctx, h, time) {
      const cx = h.x + h.w / 2;
      box(ctx, cx - 11, h.y - 8, 22, 12, 2, "#333941", INK, 1.5);
      box(ctx, cx - 11, h.y + h.h - 6, 22, 12, 2, "#333941", INK, 1.5);
      if (h.on) {
        line(ctx, cx, h.y, cx, h.y + h.h, "rgba(255,60,60,0.4)", 12);
        line(ctx, cx, h.y, cx, h.y + h.h, "#ffd0d0", 3);
        glow(ctx, cx, h.y + h.h / 2, 50, "#ff3a30", 0.4 + sin(time * 30) * 0.1);
      } else if (h.warn) {
        line(ctx, cx, h.y, cx, h.y + h.h, "rgba(255,90,90,0.55)", 1.5);
      }
    },
    rocks(ctx, h, time) {
      const cx = h.x + h.w / 2;
      if (h.warn) {
        for (let i = 0; i < 4; i++) oval(ctx, cx + (i - 1.5) * 12, h.y + ((time * 160 + i * 23) % 50), 2.5, 2.5, "#c9a56c");
        ctx.globalAlpha = 0.35 + sin(time * 18) * 0.2;
        oval(ctx, cx, h.y + h.h - 4, h.w / 2, 7, "#ff5348");
        ctx.globalAlpha = 1;
      }
      if (h.falling) {
        ctx.save();
        ctx.translate(cx, h.rockY);
        ctx.rotate(time * 6);
        poly(ctx, [-20, -6, -8, -19, 14, -16, 21, 4, 8, 18, -14, 14], "#7a6352", INK, 2);
        ctx.restore();
      }
    },
  };

  function wind(ctx, w, time) {
    ctx.strokeStyle = "rgba(220,240,255,0.32)";
    ctx.lineWidth = 2;
    for (let i = 0; i < Math.ceil(w.w / 22); i++) {
      const x = w.x + 10 + i * 22;
      const y = w.y + w.h - ((time * 300 + i * 137) % w.h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 5, y - 18, x, y - 36);
      ctx.stroke();
    }
  }

  /* ---------- Pickups and markers ---------- */

  function puck(ctx, x, y, time, owned = false) {
    const bob = sin(time * 2.6 + x) * 5;
    ctx.save();
    ctx.translate(x, y + bob);
    if (owned) ctx.globalAlpha *= 0.32;
    glow(ctx, 0, 0, 48 + sin(time * 5) * 6, owned ? "#8fa3b8" : "#ff4a3d", 0.75);
    ctx.scale(max(0.22, abs(cos(time * 2))), 1);
    oval(ctx, 0, 0, 17, 17, metal(ctx, "#59616b", -17, 17), INK, 2);
    oval(ctx, 0, 0, 11, 11, "#23272e", "#9aa3ad", 1.5);
    oval(ctx, 0, 0, 5.5, 5.5, owned ? "#8fa3b8" : "#ff4a3d");
    oval(ctx, -1.5, -1.5, 2, 2, "#ffd9cf");
    ctx.restore();
  }

  // A bounty credit chip: a small metal slip with a glowing data strip, turning in place.
  function credit(ctx, x, y, time) {
    ctx.save();
    ctx.translate(x, y + sin(time * 3 + x * 0.05) * 3);
    glow(ctx, 0, 0, 26, "#5fe0ff", 0.55);
    ctx.rotate(-0.35);
    ctx.scale(max(0.25, abs(cos(time * 2.4 + x * 0.01))), 1);
    poly(ctx, [-12, -7, 9, -7, 12, -4, 12, 7, -12, 7], metal(ctx, "#c9d3dd", -7, 7), INK, 1.6);
    box(ctx, -9, -3, 15, 4, 1.5, "#5fe0ff");
    oval(ctx, 7, 3, 2, 2, "#ffd45c");
    ctx.restore();
  }

  function pickup(ctx, p, time) {
    const { x } = p;
    const y = p.y + sin(time * 3 + x) * 3;
    const color = p.kind === "health" ? "#5dff9a" : "#ffd45c";
    glow(ctx, x, y - 14, 34, color, 0.45);
    box(ctx, x - 14, y - 27, 28, 24, 5, p.kind === "health" ? "#e6ece9" : "#4b5560", INK, 2);
    if (p.kind === "health") {
      box(ctx, x - 3, y - 23, 6, 16, 1, "#23b45c");
      box(ctx, x - 8, y - 18, 16, 6, 1, "#23b45c");
    } else {
      for (let i = 0; i < 3; i++) box(ctx, x - 9 + i * 7, y - 22, 4, 14, 2, color);
    }
  }

  function checkpoint(ctx, c, time) {
    const { x, y } = c;
    const color = c.active ? "#6dff9a" : "#ffb347";
    poly(ctx, [x - 16, y, x - 8, y - 14, x + 8, y - 14, x + 16, y], "#3c444e", INK, 2);
    box(ctx, x - 3, y - 70, 6, 58, 2, "#59626c", INK, 1.5);
    oval(ctx, x, y - 76, 8, 8, color, INK, 1.5);
    glow(ctx, x, y - 76, 30 + sin(time * 4) * 5, color, 0.7);
    if (c.active) poly(ctx, [x + 3, y - 66, x + 30 + sin(time * 5) * 3, y - 58, x + 3, y - 48], "#2f7d4f", INK, 1.5);
  }

  // A lock or Core regulator the player has to destroy.
  function node(ctx, n, time) {
    const { x, y } = n;
    if (n.dead) {
      box(ctx, x - 16, y - 18, 32, 18, 3, "#2b2e35", INK, 2);
      glow(ctx, x, y - 18, 18, "#ff7a22", 0.3 + sin(time * 9) * 0.15);
      return;
    }
    if (n.big) {
      box(ctx, x - 40, y - 22, 80, 22, 4, "#2b303a", INK, 2);
      box(ctx, x - 40, y - 132, 80, 14, 4, "#2b303a", INK, 2);
      box(ctx, x - 18, y - 120, 36, 100, 14, alpha(n.color, 0.35), n.color, 2);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x, y - 70, 34, 10, time * (i + 1) * 0.7, 0, MQ.TAU);
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      glow(ctx, x, y - 70, 80, n.color, 0.6);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x - 30, y - 150, 60, 6);
      ctx.fillStyle = n.color;
      ctx.fillRect(x - 30, y - 150, 60 * max(0, n.hp / n.maxHp), 6);
    } else {
      box(ctx, x - 18, y - 70, 36, 70, 5, "#454e58", INK, 2);
      oval(ctx, x, y - 46, 10, 10, n.color, INK, 2);
      glow(ctx, x, y - 46, 34, n.color, 0.5 + sin(time * 8) * 0.25);
    }
  }

  function containment(ctx, c, time) {
    const { x, y } = c;
    box(ctx, x - 64, y - 22, 128, 22, 4, "#333a44", INK, 2);
    box(ctx, x - 64, y - 172, 128, 18, 4, "#333a44", INK, 2);
    box(ctx, x - 8, y - 190, 16, 18, 2, "#282e36", INK, 2);
    if (c.open < 1) {
      ctx.save();
      ctx.translate(x, y - 78 + sin(time * 2) * 4);
      MQ.CharacterArt.baby(ctx, c.open > 0 ? "happy" : "sad", time, { pram: true });
      ctx.restore();
      ctx.globalAlpha = 1 - c.open;
      box(ctx, x - 52, y - 154, 104, 132, 12, "rgba(110,200,255,0.18)", "#8fdcff", 2);
      for (let sy = y - 150 + ((time * 50) % 26); sy < y - 24; sy += 26) line(ctx, x - 50, sy, x + 50, sy, "rgba(143,220,255,0.3)", 2);
      glow(ctx, x, y - 88, 110, "#58b8ff", 0.3);
      ctx.globalAlpha = 1;
    }
  }

  function exit(ctx, e, time, open) {
    const color = open ? "#6dff9a" : "#ff6a5c";
    const { x, y } = e;
    ctx.globalAlpha = 0.16 + sin(time * 4) * 0.05;
    ctx.fillStyle = color;
    ctx.fillRect(x - 40, y - 150, 80, 150);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const ay = y - 70 + sin(time * 4 - i * 0.6) * 4;
      const ax = x - 22 + i * 20;
      line(ctx, ax, ay - 13, ax + 10, ay, color, 4);
      line(ctx, ax + 10, ay, ax, ay + 13, color, 4);
    }
    box(ctx, x - 48, y - 6, 96, 6, 2, color);
    text(ctx, open ? "EXIT" : "OBJECTIVE INCOMPLETE", x, y - 162, 15, color, "center", 800);
  }

  // Covers a secret room until the player steps inside.
  function cover(ctx, c) {
    if (c.alpha <= 0.02) return;
    const mat = MQ.MATERIALS[c.mat];
    ctx.save();
    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = mat.face;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    const random = rng(c.x + c.y);
    const count = Math.ceil((c.w * c.h) / 4200);
    if (mat.style === "panel") {
      // Interior secrets look like more wall paneling.
      for (let x = 0; x < c.w; x += 96) {
        for (let y = 0; y < c.h; y += 96) box(ctx, c.x + x + 3, c.y + y + 3, Math.min(90, c.w - x - 4), Math.min(90, c.h - y - 4), 3, shade(mat.face, random.range(-0.1, 0.06)));
      }
    } else {
      for (let i = 0; i < count; i++) oval(ctx, c.x + random.range(14, c.w - 14), c.y + random.range(10, c.h - 10), random.range(8, 18), random.range(5, 10), shade(mat.face, random() > 0.5 ? 0.08 : -0.12));
    }
    line(ctx, c.x + c.w * 0.4, c.y, c.x + c.w * 0.5, c.y + c.h * 0.4, shade(mat.face, -0.35), 2);
    ctx.restore();
  }

  MQ.ObjectArt = {
    platform, falling, crate, cracked, rubble, boulder, mechanism, gate, arenaWall, bridge,
    HAZARD, wind, puck, credit, pickup, checkpoint, node, containment, exit, cover,
  };
})(window.MQ);
