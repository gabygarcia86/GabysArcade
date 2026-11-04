/* Cartoon frame effects. Each one is an editable object that draws itself with code, so it can be
 * moved, resized, rotated and recolored on any frame. A seed keeps random parts stable. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const OUT = "#2b2340";

  const LIST = [
    { kind: "sparkles", label: "Sparkles", w: 160, h: 140, color: "#ffd23f" },
    { kind: "stars", label: "Stars", w: 170, h: 130, color: "#ffd23f" },
    { kind: "speedlines", label: "Speed lines", w: 180, h: 110, color: "#2b2340" },
    { kind: "trail", label: "Motion trail", w: 200, h: 90, color: "#4cc9f0" },
    { kind: "smoke", label: "Smoke puff", w: 150, h: 120, color: "#e9ecef" },
    { kind: "impact", label: "Impact!", w: 190, h: 150, color: "#ffd23f", color2: "#ef476f", text: "POW!" },
    { kind: "burst", label: "Action lines", w: 260, h: 200, color: "#2b2340" },
    { kind: "hearts", label: "Hearts", w: 140, h: 140, color: "#ef476f" },
    { kind: "dizzy", label: "Dizzy", w: 150, h: 70, color: "#ffd23f" },
    { kind: "zzz", label: "Sleepy Zzz", w: 110, h: 120, color: "#4361ee" },
  ];
  const IMPACT_WORDS = ["POW!", "BAM!", "ZAP!", "BOOM!", "WOW!", "BONK!", "SPLAT!", "YAY!"];

  function star(ctx, x, y, r1, r2, n, rot = -Math.PI / 2) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function heart(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.9, y - s * 1.3, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.9, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
    ctx.closePath();
  }
  function sparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
  }

  function draw(ctx, o) {
    const w = o.w, h = o.h, R = GAS.rng(o.seed || 1);
    const s = Math.min(w, h);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    switch (o.kind) {
      case "sparkles": {
        for (let i = 0; i < 7; i++) {
          const x = (R() - 0.5) * w * 0.8, y = (R() - 0.5) * h * 0.8, r = s * (0.08 + R() * 0.14);
          sparkle(ctx, x, y, r);
          ctx.fillStyle = o.color;
          ctx.fill();
          ctx.lineWidth = Math.max(1, s * 0.015);
          ctx.strokeStyle = OUT;
          ctx.stroke();
          sparkle(ctx, x, y, r * 0.4);
          ctx.fillStyle = "#fff";
          ctx.fill();
        }
        break;
      }
      case "stars": {
        for (let i = 0; i < 6; i++) {
          const x = (R() - 0.5) * w * 0.8, y = (R() - 0.5) * h * 0.75, r = s * (0.08 + R() * 0.12);
          star(ctx, x, y, r, r * 0.45, 5, -Math.PI / 2 + (R() - 0.5));
          ctx.fillStyle = o.color;
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, s * 0.02);
          ctx.strokeStyle = OUT;
          ctx.stroke();
        }
        break;
      }
      case "speedlines": {
        const n = 6;
        ctx.strokeStyle = o.color;
        for (let i = 0; i < n; i++) {
          const y = -h / 2 + (h * (i + 0.5)) / n + (R() - 0.5) * h * 0.06;
          const len = w * (0.4 + R() * 0.6);
          const x1 = w / 2 - R() * w * 0.12;
          ctx.lineWidth = Math.max(2, h * (0.03 + R() * 0.035));
          ctx.beginPath();
          ctx.moveTo(x1 - len, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }
        break;
      }
      case "trail": {
        for (let i = 0; i < 4; i++) {
          const t = i / 4;
          const x0 = -w / 2 + t * w * 0.18, x1 = w / 2 - t * w * 0.05;
          const thick = h * (0.42 - t * 0.08);
          const y = (i - 1.5) * h * 0.05;
          ctx.globalAlpha = 0.18 + 0.2 * (1 - t);
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.quadraticCurveTo((x0 + x1) / 2, y - thick, x1, y - thick * 0.15);
          ctx.quadraticCurveTo(x1 + thick * 0.4, y, x1, y + thick * 0.15);
          ctx.quadraticCurveTo((x0 + x1) / 2, y + thick, x0, y);
          ctx.fillStyle = o.color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "smoke": {
        const puffs = [];
        for (let i = 0; i < 7; i++) {
          puffs.push({ x: (R() - 0.5) * w * 0.55, y: (R() - 0.3) * h * 0.4, r: s * (0.18 + R() * 0.14) });
        }
        ctx.lineWidth = Math.max(2, s * 0.03);
        ctx.strokeStyle = OUT;
        for (const p of puffs) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = o.color;
        for (const p of puffs) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        for (const p of puffs.slice(0, 3)) { ctx.beginPath(); ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.3, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case "impact": {
        ctx.save();
        ctx.scale(w / 2, h / 2);
        const pts = 12;
        ctx.beginPath();
        for (let i = 0; i < pts * 2; i++) {
          const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 0.62 + R() * 0.08 : 0.92 + R() * 0.08;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = o.color;
        ctx.fill();
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = OUT;
        ctx.stroke();
        star(ctx, 0, 0, 0.7, 0.48, 12, -Math.PI / 2 + 0.2);
        ctx.fillStyle = o.color2 || "#ef476f";
        ctx.fill();
        ctx.restore();
        const word = o.text || "POW!";
        const fs = Math.min(h * 0.32, (w * 0.95) / Math.max(3, word.length * 0.62));
        ctx.font = `bold ${fs}px "Bangers", Impact, "Arial Black", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = fs * 0.16;
        ctx.strokeStyle = OUT;
        ctx.strokeText(word, 0, fs * 0.04);
        ctx.fillStyle = "#fff";
        ctx.fillText(word, 0, fs * 0.04);
        break;
      }
      case "burst": {
        ctx.fillStyle = o.color;
        const n = 26;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + R() * 0.12;
          const inner = 0.55 + R() * 0.2, outer = 1.05;
          const spread = 0.025 + R() * 0.02;
          ctx.beginPath();
          ctx.moveTo((Math.cos(a) * inner * w) / 2, (Math.sin(a) * inner * h) / 2);
          ctx.lineTo((Math.cos(a - spread) * outer * w) / 2, (Math.sin(a - spread) * outer * h) / 2);
          ctx.lineTo((Math.cos(a + spread) * outer * w) / 2, (Math.sin(a + spread) * outer * h) / 2);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case "hearts": {
        for (let i = 0; i < 5; i++) {
          const x = (R() - 0.5) * w * 0.7, y = (R() - 0.5) * h * 0.7, r = s * (0.09 + R() * 0.1);
          heart(ctx, x, y, r);
          ctx.fillStyle = o.color;
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, s * 0.018);
          ctx.strokeStyle = OUT;
          ctx.stroke();
        }
        break;
      }
      case "dizzy": {
        ctx.lineWidth = Math.max(2, h * 0.04);
        ctx.strokeStyle = OUT;
        ctx.setLineDash([h * 0.1, h * 0.08]);
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.42, h * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.6;
          star(ctx, Math.cos(a) * w * 0.42, Math.sin(a) * h * 0.3, h * 0.22, h * 0.1, 5);
          ctx.fillStyle = o.color;
          ctx.fill();
          ctx.lineWidth = Math.max(1.5, h * 0.03);
          ctx.stroke();
        }
        break;
      }
      case "zzz": {
        ctx.fillStyle = o.color;
        ctx.strokeStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const sizes = [0.42, 0.3, 0.2];
        sizes.forEach((f, i) => {
          const fs = h * f;
          ctx.font = `bold ${fs}px "Fredoka", "Arial Black", sans-serif`;
          ctx.lineWidth = fs * 0.15;
          const x = -w * 0.22 + i * w * 0.24, y = h * 0.22 - i * h * 0.3;
          ctx.strokeText("Z", x, y);
          ctx.fillText("Z", x, y);
        });
        break;
      }
    }
  }

  function create(kind, x, y) {
    const def = LIST.find((e) => e.kind === kind) || LIST[0];
    return GAS.model.baseObject("effect", {
      kind: def.kind, x, y, w: def.w, h: def.h, color: def.color, color2: def.color2, text: def.text,
      seed: Math.floor(Math.random() * 1e9),
    });
  }

  GAS.effects = { LIST, IMPACT_WORDS, draw, create };
})();
