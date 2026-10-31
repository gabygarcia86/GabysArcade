/*
 * DroidArt draws all twelve droids, the gear and the Rebel insignia in code. Every droid
 * is a function that paints inside a box from -1 to 1 around the origin. It receives a
 * pose:
 *
 *   t       walk cycle, 0 to 1
 *   moving  whether the walk cycle applies
 *   lx, ly  where the droid is looking, -1 to 1
 *   limb    arm swing for idles and dances, -1 to 1
 *
 * Sprites bakes those drawings into small canvases, so the game only pays for each
 * frame once. The menus and the dance floor draw the vector version directly.
 */
(function (D) {
  const { TAU } = D;

  D.DROIDS = [
    { id: "r2d2", name: "R2-D2", line: "Plucky astromech. Says a lot, in beeps." },
    { id: "c3po", name: "C-3PO", line: "Fluent in six million forms of worrying." },
    { id: "bb8", name: "BB-8", line: "Rolls first, thinks later." },
    { id: "k2so", name: "K-2SO", line: "Reprogrammed, tall, and brutally honest." },
    { id: "chopper", name: "Chopper", line: "Cranky, loyal and a little bit shocking." },
    { id: "bd1", name: "BD-1", line: "Tiny explorer with very big eyes." },
    { id: "ig11", name: "IG-11", line: "Reprogrammed to nurse and protect." },
    { id: "b1", name: "B1 Battle Droid", line: "Switched sides. Roger, roger.", locked: true },
  ];

  D.ENEMIES = [
    { id: "probe", name: "Imperial Probe Droid", color: "#ff5050", role: "Hunts you directly" },
    { id: "droideka", name: "Droideka", color: "#ff9ad0", role: "Cuts you off" },
    { id: "kx", name: "KX Security Droid", color: "#55e0ff", role: "Patrols, then pounces" },
    { id: "ig", name: "IG Assassin Droid", color: "#ffb347", role: "Completely unpredictable" },
  ];

  const box = (c, x, y, w, h, r, fill) => {
    c.fillStyle = fill;
    c.beginPath();
    if (r > 0) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
    c.fill();
  };

  const dot = (c, x, y, r, fill) => {
    c.fillStyle = fill;
    c.beginPath();
    c.arc(x, y, r, 0, TAU);
    c.fill();
  };

  const limbLine = (c, x1, y1, x2, y2, width, color) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  };

  // A two-part leg or arm with a visible joint.
  const bent = (c, x1, y1, x2, y2, x3, y3, width, color) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.lineTo(x3, y3);
    c.stroke();
  };

  const walkSwing = (p) => (p.moving ? Math.sin(p.t * TAU) : 0);

  const ART = {
    r2d2(c, p) {
      const rock = walkSwing(p) * 0.08;
      c.rotate(rock);
      // Legs and feet
      box(c, -0.86, -0.12, 0.24, 0.92, 0.06, "#b4bfcc");
      box(c, 0.62, -0.12, 0.24, 0.92, 0.06, "#b4bfcc");
      box(c, -0.95, 0.68, 0.42, 0.26, 0.07, "#76859a");
      box(c, 0.53, 0.68, 0.42, 0.26, 0.07, "#76859a");
      dot(c, -0.74, -0.02, 0.13, "#2a5fd8");
      dot(c, 0.74, -0.02, 0.13, "#2a5fd8");
      // Body
      box(c, -0.62, -0.22, 1.24, 1.08, 0.12, "#f1f4f8");
      box(c, 0.32, -0.22, 0.3, 1.08, 0.12, "#d3dbe5");
      box(c, -0.46, -0.04, 0.3, 0.36, 0.04, "#2a5fd8");
      box(c, -0.06, -0.04, 0.38, 0.14, 0.03, "#2a5fd8");
      box(c, -0.06, 0.16, 0.38, 0.14, 0.03, "#2a5fd8");
      box(c, -0.3, 0.46, 0.6, 0.26, 0.04, "#2a5fd8");
      box(c, -0.2, 0.52, 0.4, 0.05, 0, "#cfe0ff");
      box(c, -0.2, 0.62, 0.4, 0.05, 0, "#cfe0ff");
      // Dome, which swivels to look around
      c.fillStyle = "#c9d3df";
      c.beginPath();
      c.arc(0, -0.22, 0.66, Math.PI, 0);
      c.closePath();
      c.fill();
      c.save();
      c.beginPath();
      c.arc(0, -0.22, 0.66, Math.PI, 0);
      c.closePath();
      c.clip();
      const turn = p.lx * 0.3;
      box(c, -0.66, -0.34, 1.32, 0.12, 0, "#2a5fd8");
      box(c, -0.5 + turn, -0.72, 0.26, 0.22, 0.02, "#2a5fd8");
      box(c, 0.22 + turn, -0.72, 0.26, 0.22, 0.02, "#2a5fd8");
      c.restore();
      dot(c, turn, -0.56 + p.ly * 0.06, 0.17, "#141821");
      dot(c, turn - 0.05, -0.6 + p.ly * 0.06, 0.05, "#9fc4ff");
      dot(c, turn + 0.3, -0.44, 0.05, "#ff3b3b");
    },

    c3po(c, p) {
      const swing = walkSwing(p);
      const gold = "#e8b83a";
      const shade = "#a97a14";
      const light = "#ffe58c";
      // Legs
      bent(c, -0.2, 0.28, -0.22 - swing * 0.1, 0.56, -0.24 - swing * 0.22, 0.86, 0.22, shade);
      bent(c, 0.2, 0.28, 0.22 + swing * 0.1, 0.56, 0.24 + swing * 0.22, 0.86, 0.22, gold);
      box(c, -0.42 - swing * 0.22, 0.8, 0.36, 0.17, 0.05, shade);
      box(c, 0.06 + swing * 0.22, 0.8, 0.36, 0.17, 0.05, gold);
      // Arms, held stiffly and fussing in the air
      const arm = p.limb * 0.34 + swing * 0.2;
      bent(c, -0.46, -0.22, -0.62, 0.08, -0.6 - arm, 0.36 - Math.abs(arm) * 0.5, 0.17, shade);
      bent(c, 0.46, -0.22, 0.62, 0.08, 0.6 + arm, 0.36 - Math.abs(arm) * 0.5, 0.17, gold);
      // Torso
      box(c, -0.47, -0.34, 0.94, 0.42, 0.14, gold);
      box(c, -0.3, 0.04, 0.6, 0.38, 0.09, shade);
      box(c, -0.14, 0.04, 0.28, 0.32, 0.03, "#70320f");
      limbLine(c, -0.06, 0.08, 0.08, 0.3, 0.035, "#e23c3c");
      limbLine(c, 0.06, 0.08, -0.06, 0.3, 0.035, "#39b6d9");
      box(c, -0.2, -0.26, 0.4, 0.2, 0.05, light);
      dot(c, 0, -0.16, 0.05, "#c9301e");
      // Head
      const hx = p.lx * 0.08;
      dot(c, hx, -0.65, 0.33, gold);
      box(c, hx - 0.33, -0.66, 0.66, 0.1, 0.03, shade);
      c.fillStyle = light;
      c.beginPath();
      c.arc(hx - 0.1, -0.78, 0.13, 0, TAU);
      c.fill();
      dot(c, hx - 0.13 + p.lx * 0.05, -0.64, 0.085, "#fff7c0");
      dot(c, hx + 0.13 + p.lx * 0.05, -0.64, 0.085, "#fff7c0");
      dot(c, hx - 0.13 + p.lx * 0.05, -0.64, 0.04, "#d67d00");
      dot(c, hx + 0.13 + p.lx * 0.05, -0.64, 0.04, "#d67d00");
      box(c, hx - 0.1, -0.46, 0.2, 0.05, 0.02, shade);
    },

    bb8(c, p) {
      const roll = p.t;
      const cy = 0.22;
      const r = 0.74;
      dot(c, 0, cy, r, "#f4f4ef");
      // Panels slide across the ball so it reads as rolling.
      c.save();
      c.beginPath();
      c.arc(0, cy, r, 0, TAU);
      c.clip();
      const side = p.ly !== 0 ? 0 : p.lx >= 0 ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const phase = ((roll * side + i / 3) % 1 + 1) % 1;
        const px = side === 0 ? (i - 1) * 0.72 : (phase - 0.5) * 2.2;
        const py = side === 0 ? cy + ((roll * (p.ly > 0 ? 1 : -1) + i / 3 + 1) % 1 - 0.5) * 1.8 : cy + (i % 2 ? 0.34 : -0.2);
        const squash = side === 0 ? 1 : Math.max(0.25, 1 - Math.abs(px) * 0.6);
        c.save();
        c.translate(px, py);
        c.scale(squash, 1);
        dot(c, 0, 0, 0.32, "#ec7a1c");
        dot(c, 0, 0, 0.2, "#f4f4ef");
        dot(c, 0, 0, 0.1, "#9aa3ad");
        c.restore();
      }
      c.restore();
      c.strokeStyle = "rgba(90,90,90,.35)";
      c.lineWidth = 0.04;
      c.beginPath();
      c.arc(0, cy, r, 0, TAU);
      c.stroke();
      // Head stays on top and leans into the roll.
      const hx = p.lx * 0.26;
      limbLine(c, hx + 0.1, -0.86, hx + 0.1, -0.56, 0.035, "#8a929c");
      limbLine(c, hx - 0.08, -0.74, hx - 0.08, -0.56, 0.03, "#8a929c");
      c.fillStyle = "#f4f4ef";
      c.beginPath();
      c.arc(hx, -0.34, 0.38, Math.PI, 0);
      c.closePath();
      c.fill();
      box(c, hx - 0.38, -0.36, 0.76, 0.08, 0.02, "#ec7a1c");
      box(c, hx - 0.38, -0.44, 0.76, 0.05, 0, "#9aa3ad");
      dot(c, hx + p.lx * 0.08, -0.55, 0.12, "#14161b");
      dot(c, hx + p.lx * 0.08 - 0.03, -0.58, 0.035, "#c8d6ff");
      dot(c, hx + 0.2, -0.48, 0.04, "#ff4a2a");
    },

    k2so(c, p) {
      const swing = walkSwing(p);
      const body = "#343a46";
      const edge = "#596274";
      const dark = "#1f232b";
      // Long legs
      bent(c, -0.14, 0.2, -0.2 - swing * 0.14, 0.52, -0.2 - swing * 0.3, 0.9, 0.13, dark);
      bent(c, 0.14, 0.2, 0.2 + swing * 0.14, 0.52, 0.2 + swing * 0.3, 0.9, 0.13, body);
      // Very long arms
      const arm = p.limb * 0.42;
      bent(c, -0.46, -0.42, -0.68, 0.0 - arm * 0.5, -0.7 - swing * 0.2 - arm, 0.5 - Math.abs(arm), 0.11, dark);
      bent(c, 0.46, -0.42, 0.68, 0.0 - arm * 0.5, 0.7 + swing * 0.2 + arm, 0.5 - Math.abs(arm), 0.11, body);
      // Torso narrows to the waist.
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-0.5, -0.52);
      c.lineTo(0.5, -0.52);
      c.lineTo(0.2, 0.26);
      c.lineTo(-0.2, 0.26);
      c.closePath();
      c.fill();
      box(c, -0.3, -0.42, 0.6, 0.12, 0.03, edge);
      limbLine(c, 0, -0.26, 0, 0.14, 0.04, edge);
      dot(c, -0.2, -0.16, 0.05, "#ffc14d");
      // Small head with two pale eyes
      const hx = p.lx * 0.08;
      box(c, hx - 0.24, -0.86, 0.48, 0.32, 0.11, body);
      box(c, hx - 0.24, -0.86, 0.48, 0.1, 0.05, edge);
      dot(c, hx - 0.09 + p.lx * 0.04, -0.71, 0.065, "#f0f6ff");
      dot(c, hx + 0.09 + p.lx * 0.04, -0.71, 0.065, "#f0f6ff");
    },

    chopper(c, p) {
      const shake = p.moving ? Math.sin(p.t * TAU * 2) * 0.03 : 0;
      const swing = walkSwing(p);
      c.translate(shake, 0);
      c.rotate(swing * 0.05);
      // Spindly legs
      bent(c, -0.4, 0.42, -0.62, 0.62, -0.6, 0.86, 0.1, "#60646c");
      bent(c, 0.4, 0.42, 0.62, 0.62, 0.6, 0.86, 0.1, "#60646c");
      box(c, -0.75, 0.8, 0.3, 0.14, 0.05, "#40444b");
      box(c, 0.45, 0.8, 0.3, 0.14, 0.05, "#40444b");
      // Body
      box(c, -0.56, -0.26, 1.12, 0.86, 0.14, "#e5e2d7");
      box(c, -0.56, -0.26, 0.3, 0.86, 0.1, "#e8772a");
      box(c, 0.22, 0.12, 0.34, 0.48, 0.05, "#e8772a");
      box(c, -0.14, 0.02, 0.28, 0.42, 0.04, "#6c7078");
      limbLine(c, -0.08, 0.1, 0.08, 0.1, 0.03, "#cfd3d9");
      limbLine(c, -0.08, 0.22, 0.08, 0.22, 0.03, "#cfd3d9");
      limbLine(c, -0.08, 0.34, 0.08, 0.34, 0.03, "#cfd3d9");
      // Grabby little arms
      const arm = p.limb * 0.3;
      bent(c, 0.56, -0.02, 0.84, -0.12 + arm, 0.92, -0.36 + arm, 0.06, "#60646c");
      bent(c, -0.56, -0.02, -0.84, -0.12 - arm, -0.92, -0.36 - arm, 0.06, "#60646c");
      // Flat-topped dome and one big lens
      c.fillStyle = "#e5e2d7";
      c.beginPath();
      c.moveTo(-0.5, -0.24);
      c.quadraticCurveTo(-0.46, -0.76, -0.2, -0.78);
      c.lineTo(0.2, -0.78);
      c.quadraticCurveTo(0.46, -0.76, 0.5, -0.24);
      c.closePath();
      c.fill();
      box(c, -0.5, -0.36, 1, 0.09, 0, "#e8772a");
      const turn = p.lx * 0.24;
      dot(c, turn, -0.54, 0.16, "#191c22");
      dot(c, turn, -0.54, 0.07, "#67d7ff");
      limbLine(c, 0.16, -0.78, 0.26, -0.96, 0.035, "#60646c");
      dot(c, 0.26, -0.96, 0.05, "#ff4a2a");
    },

    bd1(c, p) {
      const swing = walkSwing(p);
      const hop = p.moving ? Math.abs(Math.sin(p.t * TAU)) * 0.08 : 0;
      c.translate(0, -hop);
      // Bird-like legs
      bent(c, -0.2, 0.3, -0.42 - swing * 0.12, 0.56, -0.26 - swing * 0.26, 0.9, 0.1, "#3c3f46");
      bent(c, 0.2, 0.3, 0.42 + swing * 0.12, 0.56, 0.26 + swing * 0.26, 0.9, 0.1, "#3c3f46");
      box(c, -0.42 - swing * 0.26, 0.84, 0.32, 0.12, 0.04, "#c44f2a");
      box(c, 0.1 + swing * 0.26, 0.84, 0.32, 0.12, 0.04, "#c44f2a");
      // Body and neck
      box(c, -0.36, 0.0, 0.72, 0.46, 0.17, "#ecebe5");
      box(c, -0.36, 0.2, 0.72, 0.1, 0, "#c44f2a");
      limbLine(c, 0, 0.02, p.lx * 0.1, -0.2, 0.1, "#3c3f46");
      // Wide head on a stalk, with the big round eyes up front
      const hx = p.lx * 0.14;
      const hy = -0.5 + p.limb * 0.05;
      box(c, hx - 0.62, hy - 0.26, 1.24, 0.54, 0.18, "#ecebe5");
      box(c, hx - 0.62, hy + 0.12, 1.24, 0.16, 0.08, "#c44f2a");
      for (const side of [-1, 1]) {
        const ex = hx + side * 0.3;
        dot(c, ex, hy, 0.22, "#2b2e35");
        dot(c, ex + p.lx * 0.05, hy + p.ly * 0.04, 0.15, "#3fb4ff");
        dot(c, ex + p.lx * 0.05 - 0.05, hy + p.ly * 0.04 - 0.05, 0.05, "#ffffff");
      }
      limbLine(c, hx - 0.46, hy - 0.26, hx - 0.52, hy - 0.42, 0.04, "#3c3f46");
    },

    ig11(c, p) {
      const swing = walkSwing(p);
      const metal = "#92959b";
      const dark = "#54575e";
      bent(c, -0.14, 0.14, -0.22 - swing * 0.14, 0.5, -0.22 - swing * 0.3, 0.88, 0.1, dark);
      bent(c, 0.14, 0.14, 0.22 + swing * 0.14, 0.5, 0.22 + swing * 0.3, 0.88, 0.1, metal);
      box(c, -0.36 - swing * 0.3, 0.84, 0.3, 0.1, 0.03, dark);
      box(c, 0.06 + swing * 0.3, 0.84, 0.3, 0.1, 0.03, metal);
      const arm = p.limb * 0.4;
      bent(c, -0.3, -0.26, -0.56, 0.02 - arm, -0.5 - swing * 0.16, 0.36 - arm * 1.4, 0.09, dark);
      bent(c, 0.3, -0.26, 0.56, 0.02 - arm, 0.5 + swing * 0.16, 0.36 - arm * 1.4, 0.09, metal);
      // Thin, ribbed torso
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(-0.34, -0.34);
      c.lineTo(0.34, -0.34);
      c.lineTo(0.17, 0.22);
      c.lineTo(-0.17, 0.22);
      c.closePath();
      c.fill();
      for (let i = 0; i < 4; i++) box(c, -0.22 + i * 0.015, -0.26 + i * 0.1, 0.44 - i * 0.03, 0.05, 0.01, metal);
      // Cylinder head with a sensor ring that spins
      limbLine(c, 0, -0.34, 0, -0.5, 0.1, dark);
      box(c, -0.26, -0.98, 0.52, 0.52, 0.09, metal);
      box(c, -0.26, -0.98, 0.14, 0.52, 0.06, "#b4b7bd");
      box(c, -0.26, -0.82, 0.52, 0.17, 0, "#23262c");
      for (let i = 0; i < 3; i++) {
        const sx = Math.sin((p.lx * 0.4 + i * 0.33) * TAU) * 0.2;
        dot(c, sx, -0.735, 0.05, "#58e4ff");
      }
      box(c, -0.26, -0.98, 0.52, 0.06, 0.03, dark);
    },

    b1(c, p) {
      const swing = walkSwing(p);
      const tan = "#d9bd83";
      const shade = "#a4834c";
      bent(c, -0.14, 0.18, -0.2 - swing * 0.14, 0.52, -0.2 - swing * 0.28, 0.88, 0.1, shade);
      bent(c, 0.14, 0.18, 0.2 + swing * 0.14, 0.52, 0.2 + swing * 0.28, 0.88, 0.1, tan);
      box(c, -0.34 - swing * 0.28, 0.84, 0.28, 0.1, 0.03, shade);
      box(c, 0.08 + swing * 0.28, 0.84, 0.28, 0.1, 0.03, tan);
      // Backpack behind the narrow chest
      box(c, -0.3, -0.34, 0.6, 0.44, 0.05, "#7d6638");
      const arm = p.limb * 0.5;
      bent(c, -0.3, -0.26, -0.56, -0.02 - arm, -0.62 - swing * 0.15, 0.32 - arm * 1.6, 0.085, shade);
      bent(c, 0.3, -0.26, 0.56, -0.02 + arm, 0.62 + swing * 0.15, 0.32 + arm * 1.6, 0.085, tan);
      c.fillStyle = tan;
      c.beginPath();
      c.moveTo(-0.28, -0.32);
      c.lineTo(0.28, -0.32);
      c.lineTo(0.13, 0.2);
      c.lineTo(-0.13, 0.2);
      c.closePath();
      c.fill();
      box(c, -0.08, -0.26, 0.16, 0.34, 0.02, shade);
      // Long, flat, unmistakable face
      const hx = p.lx * 0.1;
      limbLine(c, 0, -0.32, hx, -0.48, 0.07, shade);
      c.fillStyle = tan;
      c.beginPath();
      c.moveTo(hx - 0.16, -0.5);
      c.lineTo(hx + 0.16, -0.5);
      c.lineTo(hx + 0.08, -0.94);
      c.quadraticCurveTo(hx, -1.02, hx - 0.08, -0.94);
      c.closePath();
      c.fill();
      dot(c, hx - 0.05, -0.62, 0.04, "#2a2115");
      dot(c, hx + 0.05, -0.62, 0.04, "#2a2115");
      box(c, hx - 0.03, -0.9, 0.06, 0.2, 0.02, shade);
    },

    probe(c, p) {
      const wave = p.t * TAU;
      const cy = -0.3;
      // Dangling arms
      for (let i = 0; i < 5; i++) {
        const baseX = -0.4 + i * 0.2;
        const sway = Math.sin(wave + i * 1.4) * 0.14 + p.limb * 0.18 * (i - 2);
        c.strokeStyle = i % 2 ? "#4a4d57" : "#2d2f37";
        c.lineWidth = 0.075;
        c.lineCap = "round";
        c.beginPath();
        c.moveTo(baseX * 0.8, cy + 0.34);
        c.quadraticCurveTo(baseX + sway, 0.3, baseX * 1.25 - sway, 0.5 + (i % 3) * 0.17);
        c.stroke();
        dot(c, baseX * 1.25 - sway, 0.5 + (i % 3) * 0.17, 0.055, "#6a6e7a");
      }
      // Head
      dot(c, 0, cy, 0.62, "#25272e");
      c.fillStyle = "#3a3d48";
      c.beginPath();
      c.arc(0, cy, 0.62, Math.PI, 0);
      c.fill();
      box(c, -0.62, cy - 0.04, 1.24, 0.1, 0.02, "#17181d");
      // Antennae and a lens cluster
      limbLine(c, -0.28, cy - 0.54, -0.42, cy - 0.76, 0.045, "#6a6e7a");
      limbLine(c, 0.28, cy - 0.54, 0.46, cy - 0.7, 0.045, "#6a6e7a");
      const turn = p.lx * 0.2;
      dot(c, turn, cy + 0.22, 0.17, "#120405");
      dot(c, turn, cy + 0.22, 0.11, "#ff3030");
      dot(c, turn - 0.03, cy + 0.19, 0.035, "#ffd0d0");
      dot(c, turn - 0.32, cy + 0.15, 0.08, "#ff5a3c");
      dot(c, turn + 0.32, cy + 0.15, 0.08, "#ff5a3c");
      dot(c, turn - 0.18, cy - 0.2, 0.06, "#ff8a5c");
      dot(c, turn + 0.18, cy - 0.2, 0.06, "#ff8a5c");
    },

    droideka(c, p) {
      const bronze = "#b9753d";
      const dark = "#6f4220";
      const light = "#e0a769";
      const step = p.moving ? Math.sin(p.t * TAU) : 0;
      // Three spread legs, stepping in turn
      bent(c, -0.2, 0.08, -0.72, 0.2 - step * 0.1, -0.84, 0.88 - Math.max(0, step) * 0.16, 0.13, dark);
      bent(c, 0.2, 0.08, 0.72, 0.2 + step * 0.1, 0.84, 0.88 - Math.max(0, -step) * 0.16, 0.13, bronze);
      bent(c, 0, 0.16, step * 0.1, 0.5, 0, 0.92, 0.13, bronze);
      // Curled torso
      c.fillStyle = bronze;
      c.beginPath();
      c.ellipse(0, 0, 0.42, 0.4, 0, 0, TAU);
      c.fill();
      box(c, -0.26, -0.1, 0.52, 0.09, 0.03, dark);
      box(c, -0.2, 0.08, 0.4, 0.07, 0.03, dark);
      // Twin blasters
      const aim = p.limb * 0.14;
      box(c, -0.92, -0.32 + aim, 0.56, 0.12, 0.03, "#3b2a1c");
      box(c, 0.36, -0.32 - aim, 0.56, 0.12, 0.03, "#3b2a1c");
      limbLine(c, -0.36, -0.26 + aim, -0.2, -0.1, 0.11, dark);
      limbLine(c, 0.36, -0.26 - aim, 0.2, -0.1, 0.11, dark);
      // Head on a curved neck
      const hx = p.lx * 0.14;
      limbLine(c, 0, -0.3, hx, -0.52, 0.13, dark);
      c.fillStyle = light;
      c.beginPath();
      c.ellipse(hx, -0.64, 0.36, 0.22, 0, 0, TAU);
      c.fill();
      dot(c, hx - 0.13, -0.66, 0.075, "#ff3b2f");
      dot(c, hx + 0.13, -0.66, 0.075, "#ff3b2f");
      dot(c, hx, -0.56, 0.035, "#4a1a0a");
      // Deflector shield shimmer
      c.strokeStyle = "rgba(120,190,255,.5)";
      c.lineWidth = 0.05;
      c.beginPath();
      c.arc(0, 0, 0.98, -2.4 + p.t * TAU, -1.0 + p.t * TAU);
      c.stroke();
    },

    kx(c, p) {
      const swing = walkSwing(p);
      const body = "#1c2028";
      const edge = "#3d4656";
      bent(c, -0.2, 0.2, -0.28 - swing * 0.14, 0.52, -0.3 - swing * 0.3, 0.92, 0.17, "#12151b");
      bent(c, 0.2, 0.2, 0.28 + swing * 0.14, 0.52, 0.3 + swing * 0.3, 0.92, 0.17, body);
      const arm = p.limb * 0.44;
      bent(c, -0.6, -0.42, -0.84, 0.0 - arm * 0.5, -0.82 - swing * 0.2, 0.52 - Math.abs(arm), 0.15, "#12151b");
      bent(c, 0.6, -0.42, 0.84, 0.0 - arm * 0.5, 0.82 + swing * 0.2, 0.52 - Math.abs(arm), 0.15, body);
      // Broad shoulders, with the Imperial cog on the chest
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(-0.68, -0.54);
      c.lineTo(0.68, -0.54);
      c.lineTo(0.28, 0.28);
      c.lineTo(-0.28, 0.28);
      c.closePath();
      c.fill();
      box(c, -0.5, -0.5, 1, 0.1, 0.03, edge);
      c.strokeStyle = "#d8dee8";
      c.lineWidth = 0.05;
      c.beginPath();
      c.arc(0, -0.16, 0.17, 0, TAU);
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6;
        limbLine(c, Math.cos(a) * 0.04, -0.16 + Math.sin(a) * 0.04, Math.cos(a) * 0.17, -0.16 + Math.sin(a) * 0.17, 0.03, "#d8dee8");
      }
      // Head
      const hx = p.lx * 0.07;
      box(c, hx - 0.26, -0.92, 0.52, 0.34, 0.1, body);
      box(c, hx - 0.26, -0.92, 0.52, 0.1, 0.05, edge);
      dot(c, hx - 0.1 + p.lx * 0.04, -0.76, 0.075, "#e8f4ff");
      dot(c, hx + 0.1 + p.lx * 0.04, -0.76, 0.075, "#e8f4ff");
    },

    ig(c, p) {
      const swing = walkSwing(p);
      const metal = "#6e4a3a";
      const dark = "#3e2a24";
      const rust = "#a26a48";
      bent(c, -0.13, 0.14, -0.22 - swing * 0.14, 0.5, -0.2 - swing * 0.3, 0.9, 0.1, dark);
      bent(c, 0.13, 0.14, 0.22 + swing * 0.14, 0.5, 0.2 + swing * 0.3, 0.9, 0.1, metal);
      // Torso with crossed bandoliers
      c.fillStyle = dark;
      c.beginPath();
      c.moveTo(-0.3, -0.36);
      c.lineTo(0.3, -0.36);
      c.lineTo(0.15, 0.2);
      c.lineTo(-0.15, 0.2);
      c.closePath();
      c.fill();
      limbLine(c, -0.26, -0.3, 0.14, 0.14, 0.09, "#c4923a");
      limbLine(c, 0.26, -0.3, -0.14, 0.14, 0.09, "#c4923a");
      // One arm with a blaster rifle, always ready
      const arm = p.limb * 0.34;
      bent(c, -0.3, -0.28, -0.56, 0.04 - arm, -0.5 - swing * 0.16, 0.36 - arm, 0.085, dark);
      bent(c, 0.3, -0.28, 0.58, -0.08, 0.76, -0.22 + arm, 0.085, metal);
      box(c, 0.62, -0.32 + arm, 0.38, 0.09, 0.02, "#22242b");
      box(c, 0.56, -0.4 + arm, 0.2, 0.09, 0.02, "#22242b");
      // Tall cylinder head with the red sensor band
      limbLine(c, 0, -0.36, 0, -0.5, 0.1, dark);
      box(c, -0.2, -1.0, 0.4, 0.54, 0.05, metal);
      box(c, -0.2, -1.0, 0.11, 0.54, 0.04, rust);
      box(c, -0.28, -0.84, 0.56, 0.16, 0.02, "#17181d");
      for (let i = 0; i < 3; i++) {
        const sx = Math.sin((p.lx * 0.4 + i * 0.33 + p.t) * TAU) * 0.22;
        dot(c, sx, -0.76, 0.05, "#ff3b2f");
      }
      box(c, -0.24, -1.02, 0.48, 0.06, 0.03, dark);
    },
  };

  const FRONT = { t: 0, moving: false, lx: 0, ly: 0, limb: 0 };

  const Art = {
    draw(c, id, pose) {
      ART[id](c, pose || FRONT);
    },

    // The defeated enemy's eyes, on their way home.
    eyes(c, color, lx, ly) {
      c.fillStyle = "rgba(10,12,20,.55)";
      c.beginPath();
      c.ellipse(0, 0, 0.74, 0.44, 0, 0, TAU);
      c.fill();
      for (const side of [-1, 1]) {
        dot(c, side * 0.36, 0, 0.3, "#f6f8ff");
        dot(c, side * 0.36 + lx * 0.13, ly * 0.13, 0.16, color);
      }
    },

    // Wide-eyed panic, painted over a frightened sprite.
    scaredFace(c, color) {
      for (const side of [-1, 1]) dot(c, side * 0.28, -0.3, 0.17, color);
      c.strokeStyle = color;
      c.lineWidth = 0.09;
      c.lineJoin = "round";
      c.beginPath();
      for (let i = 0; i <= 6; i++) c.lineTo(-0.42 + i * 0.14, 0.14 + (i % 2 ? -0.09 : 0.09));
      c.stroke();
    },

    // Small glowing gear. `r` is the outer radius in pixels.
    gear(c, r, fill, hole) {
      const teeth = 8;
      c.fillStyle = fill;
      c.beginPath();
      for (let i = 0; i < teeth * 4; i++) {
        const a = (i / (teeth * 4)) * TAU - TAU / (teeth * 8);
        const outer = i % 4 < 2;
        const rad = outer ? r : r * 0.74;
        c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      c.closePath();
      c.fill();
      c.fillStyle = hole;
      c.beginPath();
      c.arc(0, 0, r * 0.3, 0, TAU);
      c.fill();
    },

    // The Alliance starbird, built from one spike and two sweeping wings.
    insignia(c, r, fill) {
      c.save();
      c.scale(r, r);
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(0, -1);
      c.quadraticCurveTo(0.09, -0.45, 0.11, -0.1);
      c.lineTo(0.06, 0.62);
      c.lineTo(0, 0.82);
      c.lineTo(-0.06, 0.62);
      c.lineTo(-0.11, -0.1);
      c.quadraticCurveTo(-0.09, -0.45, 0, -1);
      c.fill();
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(side * 0.2, -0.86);
        c.quadraticCurveTo(side * 0.5, -0.82, side * 0.74, -0.6);
        c.quadraticCurveTo(side * 1.06, -0.26, side * 0.96, 0.22);
        c.quadraticCurveTo(side * 0.82, 0.8, side * 0.2, 0.98);
        c.lineTo(side * 0.13, 0.72);
        c.quadraticCurveTo(side * 0.5, 0.56, side * 0.6, 0.1);
        c.quadraticCurveTo(side * 0.42, 0.32, side * 0.22, 0.26);
        c.quadraticCurveTo(side * 0.3, -0.2, side * 0.2, -0.86);
        c.fill();
      }
      c.restore();
    },
  };

  /*
   * Baked in-game sprites, keyed by droid, facing, walk frame and variant. They're built
   * the first time they're needed and thrown away when the board is resized.
   */
  const FRAMES = 8;
  const NORMAL = 0;
  const FRIGHT = 1;
  const FRIGHT_FLASH = 2;
  const LOOK_X = [0, 1, 0, -1];
  const LOOK_Y = [-1, 0, 1, 0];

  class Sprites {
    constructor() {
      this.cache = new Map();
      this.size = 0;
      this.scale = 1;
      this.pose = { t: 0, moving: false, lx: 0, ly: 0, limb: 0 };
    }

    // `size` is the sprite's drawn height in CSS pixels.
    resize(size, dpr) {
      this.size = size;
      this.scale = dpr;
      this.cache.clear();
    }

    get(id, facing, frame, moving, variant) {
      const key = (D.SPRITE_INDEX[id] << 8) | (facing << 6) | (frame << 3) | (moving ? 4 : 0) | variant;
      let sprite = this.cache.get(key);
      if (!sprite) {
        sprite = this.bake(id, facing, frame, moving, variant);
        this.cache.set(key, sprite);
      }
      return sprite;
    }

    bake(id, facing, frame, moving, variant) {
      const px = Math.ceil(this.size * this.scale * 1.16);
      const canvas = document.createElement("canvas");
      canvas.width = px;
      canvas.height = px;
      const c = canvas.getContext("2d");
      c.translate(px / 2, px / 2);
      c.scale(px / 2.3, px / 2.3);
      const pose = this.pose;
      pose.t = frame / FRAMES;
      pose.moving = moving;
      pose.lx = LOOK_X[facing];
      pose.ly = LOOK_Y[facing];
      Art.draw(c, id, pose);
      if (variant !== NORMAL) {
        c.globalCompositeOperation = "source-atop";
        c.fillStyle = variant === FRIGHT ? "rgba(36,58,214,.86)" : "rgba(240,244,255,.9)";
        c.fillRect(-1.2, -1.2, 2.4, 2.4);
        c.globalCompositeOperation = "source-over";
        Art.scaredFace(c, variant === FRIGHT ? "#f4f6ff" : "#d0263a");
      }
      return canvas;
    }

    draw(ctx, id, x, y, facing, walk, moving, variant) {
      const sprite = this.get(id, facing, Math.floor(walk * FRAMES) % FRAMES, moving, variant);
      const drawn = this.size * 1.16;
      ctx.drawImage(sprite, x - drawn / 2, y - drawn / 2, drawn, drawn);
    }
  }

  D.SPRITE_INDEX = {};
  [...D.DROIDS, ...D.ENEMIES].forEach((droid, i) => { D.SPRITE_INDEX[droid.id] = i; });
  Sprites.NORMAL = NORMAL;
  Sprites.FRIGHT = FRIGHT;
  Sprites.FRIGHT_FLASH = FRIGHT_FLASH;

  D.Art = Art;
  D.Sprites = Sprites;
})(window.DROID);
