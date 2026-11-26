/*
 * Environments: 20 themes, each with a sky, three procedurally painted parallax
 * layers (cached to off-screen canvases), animated sky effects, weather, and a
 * themed tile set for ground, ledges, hazards, ladders and breakables.
 */
(function (XM) {
  "use strict";
  const A = XM.Art;
  const U = XM.U;
  const T = XM.T;
  const LAYER_W = 1600;
  const LAYER_H = 540;

  // sky: [top, bottom]; layers: [painter, color, color2, light] far → near; tile: style + colors
  const THEMES = [
    { key: "nyc", sky: ["#0b1030", "#3a2a5a"], extra: "moon", layers: [["skyline", "#1a1f3e", "#232a50", "#ffd97a"], ["skyline", "#141833", "#1c2244", "#ffe9a0"], ["rooftops", "#0c0f22", "#151a33", "#ff6a5a"]], weather: "none", tile: { style: "brick", top: "#5a5f72", body: "#3a3d4c", line: "#2a2c38", accent: "#8a8fa2", hazard: "electric" }, music: "city", fog: "#3a2a5a" },
    { key: "factory", sky: ["#2a1208", "#8a3a12"], extra: "smog", layers: [["industrial", "#3a1c10", "#4a2614", "#ffb03a"], ["industrial", "#24120a", "#33180c", "#ff7a1a"], ["pipes", "#160a06", "#2a1408", "#ff5a1a"]], weather: "embers", tile: { style: "metal", top: "#7a6a5a", body: "#4a3e34", line: "#2e2620", accent: "#f2c230", hazard: "fire" }, music: "industrial", fog: "#8a3a12" },
    { key: "subway", sky: ["#0a0c10", "#1a1e26"], extra: "none", layers: [["tunnel", "#161a22", "#1e232e", "#f2d07a"], ["pillars", "#10131a", "#1a1e28", "#7aff9a"], ["cables", "#08090c", "#121418", "#ffcf5a"]], weather: "dust", tile: { style: "tile", top: "#6a7a7a", body: "#3a4446", line: "#262e30", accent: "#e0c060", hazard: "electric" }, music: "tense", fog: "#1a1e26" },
    { key: "lab", sky: ["#0a1a22", "#1a3a44"], extra: "none", layers: [["labwall", "#12262e", "#1a323c", "#3affd0"], ["labtubes", "#0e1e24", "#16303a", "#3affd0"], ["cables", "#08141a", "#0e2028", "#3affd0"]], weather: "motes", tile: { style: "metal", top: "#b8c8d0", body: "#6a7a84", line: "#4a5660", accent: "#3affd0", hazard: "acid" }, music: "tense", fog: "#1a3a44" },
    { key: "jungle", sky: ["#3a7a5a", "#c8e0a0"], extra: "sun", layers: [["mountains", "#4a7a5a", "#5a8a6a", "#a0d0a0"], ["trees", "#2a5a32", "#346a3a", "#5a9a4a"], ["foliage", "#163a1c", "#1e4a24", "#7aba5a"]], weather: "spores", tile: { style: "rock", top: "#5a8a3a", body: "#5a4630", line: "#3a2c1c", accent: "#7aba4a", hazard: "thorns" }, music: "mystic", fog: "#7aa070" },
    { key: "mines", sky: ["#0a0614", "#1a0e2a"], extra: "none", layers: [["cave", "#1a1028", "#22163a", "#b08aff"], ["crystals", "#140c20", "#1e1430", "#7affff"], ["stalactites", "#0a0612", "#140c1e", "#d08aff"]], weather: "motes", tile: { style: "rock", top: "#6a5a7a", body: "#3a2e48", line: "#241a30", accent: "#b08aff", hazard: "crystal" }, music: "mystic", fog: "#2a1a3a" },
    { key: "shadows", sky: ["#14101e", "#4a3a4a"], extra: "moon", layers: [["gothic", "#241e2e", "#2e2638", "#ffcf7a"], ["gothic", "#1a1622", "#221c2c", "#ffb04a"], ["rooftops", "#0e0c14", "#16121e", "#ff9a4a"]], weather: "rain", tile: { style: "cobble", top: "#5a5460", body: "#3a3440", line: "#26222c", accent: "#8a8090", hazard: "spikes" }, music: "tense", fog: "#3a3040" },
    { key: "orbital", sky: ["#02030a", "#0a1030"], extra: "earth", layers: [["stars", "#ffffff", "#9fc8ff", "#ffffff"], ["station", "#2a3040", "#3a4258", "#7ab0ff"], ["trusses", "#141820", "#1e2430", "#ff5a5a"]], weather: "none", tile: { style: "metal", top: "#c8ccd8", body: "#5a6070", line: "#3a404c", accent: "#ff7a1a", hazard: "electric" }, music: "cosmic", fog: "#0a1030", gravity: 0.72 },
    { key: "arctic", sky: ["#0a1a3a", "#5a8ab0"], extra: "aurora", layers: [["mountains", "#9ab8d0", "#c8e0f0", "#ffffff"], ["icecliffs", "#6a8aa8", "#8aaccc", "#e8f6ff"], ["icicles", "#3a5a78", "#4a6a8a", "#bff0ff"]], weather: "snow", tile: { style: "ice", top: "#e8f6ff", body: "#8ab8d8", line: "#5a88a8", accent: "#ffffff", hazard: "ice" }, music: "ice", fog: "#8ab0d0", slippery: true },
    { key: "prison", sky: ["#0c0e14", "#2a2e3a"], extra: "searchlights", layers: [["prison", "#1e222c", "#262a36", "#ffe07a"], ["prison", "#161a22", "#1e222c", "#ffcf5a"], ["fence", "#0a0c10", "#14161c", "#ff3a3a"]], weather: "rain", tile: { style: "concrete", top: "#7a7e88", body: "#4a4e58", line: "#34383e", accent: "#f2c230", hazard: "electric" }, music: "tense", fog: "#2a2e3a" },
    { key: "desert", sky: ["#3a6ab0", "#f0c890"], extra: "sun", layers: [["dunes", "#d8a868", "#e0b878", "#fff0c0"], ["mesas", "#b07a4a", "#c08a5a", "#e0b080"], ["outpost", "#5a4a3a", "#6a5a48", "#ff7a1a"]], weather: "dust", tile: { style: "sand", top: "#e0b878", body: "#a87a48", line: "#7a5630", accent: "#f2d098", hazard: "spikes" }, music: "industrial", fog: "#e0b890" },
    { key: "cyber", sky: ["#06040a", "#1a0a1a"], extra: "grid", layers: [["servers", "#140a18", "#1e1024", "#ff3a6a"], ["servers", "#0e0612", "#160a1c", "#3affff"], ["cables", "#06030a", "#0e0612", "#ff3a6a"]], weather: "sparks", tile: { style: "metal", top: "#3a3a4a", body: "#1e1e28", line: "#121218", accent: "#ff3a6a", hazard: "electric" }, music: "industrial", fog: "#1a0a1a" },
    { key: "temple", sky: ["#2a4a3a", "#9ab890"], extra: "sunbeams", layers: [["columns", "#5a6a50", "#6a7a5e", "#e0d090"], ["columns", "#3a4a36", "#46563e", "#e0b840"], ["vines", "#1a2a18", "#24381e", "#7aba5a"]], weather: "motes", tile: { style: "stone", top: "#a89a70", body: "#6a5e44", line: "#4a402c", accent: "#e0b840", hazard: "spikes" }, music: "mystic", fog: "#6a8a6a" },
    { key: "ancient", sky: ["#1a0a08", "#6a2a14"], extra: "lavaglow", layers: [["ziggurat", "#3a1a12", "#4a2418", "#ff7a3a"], ["statues", "#2a120c", "#381a10", "#ffb04a"], ["columns", "#160a06", "#22100a", "#ff5a1a"]], weather: "embers", tile: { style: "stone", top: "#a07a50", body: "#5a3e28", line: "#3a2818", accent: "#e0b840", hazard: "lava" }, music: "mystic", fog: "#6a2a14" },
    { key: "megacity", sky: ["#1a0a0a", "#8a3a2a"], extra: "smog", layers: [["skyline", "#3a1e1a", "#482620", "#ff9a5a"], ["cranes", "#24120e", "#301812", "#ff5a3a"], ["pipes", "#120806", "#1e0e0a", "#ff3a1a"]], weather: "ash", tile: { style: "metal", top: "#6a5a54", body: "#3a302c", line: "#26201c", accent: "#ff5a3a", hazard: "fire" }, music: "industrial", fog: "#6a2a1a" },
    { key: "nexus", sky: ["#14062a", "#5a1a6a"], extra: "vortex", layers: [["floaters", "#3a1a5a", "#4a2a6a", "#ff5aff"], ["floaters", "#24103a", "#30164a", "#5affff"], ["crystals", "#12081e", "#1a0c2a", "#ff5aff"]], weather: "motes", tile: { style: "nexus", top: "#b07aff", body: "#3a1a5a", line: "#24103a", accent: "#ff5aff", hazard: "nexus" }, music: "cosmic", fog: "#3a1a5a", gravityShift: true },
    { key: "mansion", sky: ["#1a0e1e", "#c05a3a"], extra: "fireglow", layers: [["hills", "#3a2a3a", "#4a3444", "#ff9a5a"], ["mansion", "#24182a", "#2e1e34", "#ffd07a"], ["trees", "#120a14", "#1a0e1c", "#ff7a3a"]], weather: "ash", tile: { style: "brick", top: "#6a5a50", body: "#4a3a34", line: "#302420", accent: "#c0a070", hazard: "fire" }, music: "tense", fog: "#6a3a3a" },
    { key: "fortress", sky: ["#1a2a5a", "#c0a0d0"], extra: "clouds", layers: [["clouds", "#d8c8e8", "#e8dcf4", "#ffffff"], ["spires", "#5a2a5a", "#6a3468", "#ff5aff"], ["spires", "#2a1028", "#36163a", "#c08aff"]], weather: "none", tile: { style: "metal", top: "#a08aa8", body: "#5a3a5a", line: "#3a2440", accent: "#c08aff", hazard: "electric" }, music: "cosmic", fog: "#8a6aa0" },
    { key: "core", sky: ["#06020e", "#2a0a3a"], extra: "core", layers: [["energycols", "#1a0a2a", "#2a1240", "#ff5aff"], ["energycols", "#120620", "#1e0a30", "#5affff"], ["cables", "#08020e", "#100618", "#ff5aff"]], weather: "sparks", tile: { style: "nexus", top: "#8a5aff", body: "#2a1048", line: "#1a0830", accent: "#5affff", hazard: "nexus" }, music: "cosmic", fog: "#2a0a3a" },
    { key: "laststand", sky: ["#0a0614", "#5a1a3a"], extra: "storm", layers: [["ruins", "#2a1a2a", "#36223a", "#ff5aff"], ["ruins", "#1a1020", "#24162a", "#ff7a3a"], ["debris", "#0e0812", "#160c1a", "#ff5aff"]], weather: "rain", tile: { style: "nexus", top: "#6a4a7a", body: "#2a1a34", line: "#1a1022", accent: "#ff5aff", hazard: "nexus" }, music: "finalboss", fog: "#3a1a3a" },
  ];

  // ---------- Layer painters (draw into a 1600x540 canvas, bottom-anchored) ----------
  function windows(g, x, y, w, h, light, rng, density = 0.35) {
    for (let wy = y + 8; wy < y + h - 10; wy += 12) {
      for (let wx = x + 6; wx < x + w - 8; wx += 10) {
        if (rng() < density) {
          g.fillStyle = A.rgba(light, 0.5 + rng() * 0.5);
          g.fillRect(wx, wy, 4, 6);
        }
      }
    }
  }

  const PAINT = {
    skyline(g, c, rng, depth) {
      let x = 0;
      while (x < LAYER_W) {
        const w = 40 + rng() * 90;
        const h = 120 + rng() * (depth === 0 ? 260 : 180);
        const y = LAYER_H - h;
        g.fillStyle = rng() < 0.5 ? c[0] : c[1];
        g.fillRect(x, y, w, h);
        if (rng() < 0.3) {
          g.fillRect(x + w * 0.3, y - 20, w * 0.4, 20);
          g.fillRect(x + w * 0.48, y - 50, 3, 30);
        }
        if (rng() < 0.2 && depth > 0) {
          // Water tower
          g.fillRect(x + w * 0.6, y - 26, 16, 18);
          g.fillRect(x + w * 0.6 + 2, y - 8, 2, 8);
          g.fillRect(x + w * 0.6 + 12, y - 8, 2, 8);
          g.beginPath();
          g.moveTo(x + w * 0.6 - 2, y - 26);
          g.lineTo(x + w * 0.6 + 8, y - 34);
          g.lineTo(x + w * 0.6 + 18, y - 26);
          g.fill();
        }
        windows(g, x, y, w, h, c[2], rng, depth === 0 ? 0.25 : 0.35);
        x += w + rng() * 10;
      }
    },
    rooftops(g, c, rng) {
      let x = 0;
      while (x < LAYER_W) {
        const w = 120 + rng() * 160;
        const h = 60 + rng() * 80;
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - h, w, h);
        g.fillStyle = c[1];
        g.fillRect(x, LAYER_H - h, w, 6);
        // Antennas and vents
        for (let i = 0; i < 3; i++) {
          const ax = x + rng() * w;
          g.fillStyle = c[0];
          g.fillRect(ax, LAYER_H - h - 20 - rng() * 30, 2, 50);
        }
        if (rng() < 0.6) {
          g.fillStyle = A.rgba(c[2], 0.9);
          g.beginPath();
          g.arc(x + w * 0.5, LAYER_H - h - 40, 2.5, 0, Math.PI * 2);
          g.fill();
        }
        x += w + 30 + rng() * 60;
      }
    },
    industrial(g, c, rng, depth) {
      let x = 0;
      while (x < LAYER_W) {
        const w = 100 + rng() * 140;
        const h = 90 + rng() * 120;
        g.fillStyle = c[rng() < 0.5 ? 0 : 1];
        g.fillRect(x, LAYER_H - h, w, h);
        // Sawtooth roof
        for (let sx = x; sx < x + w - 20; sx += 24) {
          g.beginPath();
          g.moveTo(sx, LAYER_H - h);
          g.lineTo(sx + 24, LAYER_H - h - 16);
          g.lineTo(sx + 24, LAYER_H - h);
          g.fill();
        }
        if (rng() < 0.7) {
          const sx = x + rng() * w * 0.7;
          const sh = 120 + rng() * 140;
          g.fillRect(sx, LAYER_H - h - sh, 18, sh);
          g.fillStyle = A.rgba(c[2], 0.6);
          g.fillRect(sx, LAYER_H - h - sh + 12, 18, 4);
          g.fillRect(sx, LAYER_H - h - sh + 24, 18, 4);
        }
        windows(g, x, LAYER_H - h, w, h, c[2], rng, 0.12);
        x += w + rng() * 40;
      }
    },
    pipes(g, c, rng) {
      for (let i = 0; i < 6; i++) {
        const y = LAYER_H - 40 - rng() * 220;
        g.fillStyle = c[i % 2];
        g.fillRect(0, y, LAYER_W, 10 + rng() * 10);
      }
      for (let x = 0; x < LAYER_W; x += 120 + rng() * 120) {
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - 300, 14, 300);
        g.fillStyle = A.rgba(c[2], 0.8);
        g.beginPath();
        g.arc(x + 7, LAYER_H - 200, 3, 0, Math.PI * 2);
        g.fill();
      }
    },
    tunnel(g, c) {
      g.fillStyle = c[0];
      g.fillRect(0, 0, LAYER_W, LAYER_H);
      for (let x = 0; x < LAYER_W; x += 200) {
        g.fillStyle = c[1];
        g.beginPath();
        g.moveTo(x + 20, LAYER_H);
        g.lineTo(x + 20, 220);
        g.arc(x + 100, 220, 80, Math.PI, 0);
        g.lineTo(x + 180, LAYER_H);
        g.fill();
        g.fillStyle = A.rgba(c[2], 0.25);
        g.beginPath();
        g.arc(x + 100, 160, 10, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.04)";
      for (let y = 0; y < LAYER_H; y += 16) g.fillRect(0, y, LAYER_W, 1);
    },
    pillars(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 160) {
        g.fillStyle = c[0];
        g.fillRect(x, 0, 36, LAYER_H);
        g.fillStyle = c[1];
        g.fillRect(x + 4, 0, 6, LAYER_H);
        if (rng() < 0.5) {
          g.fillStyle = A.rgba(c[2], 0.7);
          g.fillRect(x + 12, 180, 12, 6);
        }
      }
    },
    cables(g, c, rng) {
      g.strokeStyle = c[0];
      for (let i = 0; i < 9; i++) {
        g.lineWidth = 3 + rng() * 5;
        const y = rng() * 120;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= LAYER_W; x += 200) g.quadraticCurveTo(x + 100, y + 60 + rng() * 60, x + 200, y);
        g.stroke();
      }
      for (let i = 0; i < 12; i++) {
        g.fillStyle = A.rgba(c[2], 0.8);
        g.fillRect(rng() * LAYER_W, rng() * 80, 4, 4);
      }
    },
    labwall(g, c, rng) {
      g.fillStyle = c[0];
      g.fillRect(0, 0, LAYER_W, LAYER_H);
      for (let x = 0; x < LAYER_W; x += 80) {
        g.fillStyle = c[1];
        g.fillRect(x, 0, 2, LAYER_H);
      }
      for (let y = 40; y < LAYER_H; y += 90) {
        g.fillStyle = c[1];
        g.fillRect(0, y, LAYER_W, 2);
      }
      for (let i = 0; i < 14; i++) {
        const x = rng() * LAYER_W;
        const y = 60 + rng() * 260;
        g.fillStyle = "#0a1418";
        g.fillRect(x, y, 70, 40);
        g.fillStyle = A.rgba(c[2], 0.5);
        for (let k = 0; k < 4; k++) g.fillRect(x + 6, y + 6 + k * 8, 20 + rng() * 40, 3);
      }
    },
    labtubes(g, c, rng) {
      for (let x = 30; x < LAYER_W; x += 150 + rng() * 80) {
        const h = 200 + rng() * 120;
        const y = LAYER_H - h;
        g.fillStyle = c[0];
        g.fillRect(x - 6, y - 20, 72, 20);
        g.fillRect(x - 6, LAYER_H - 30, 72, 30);
        const grad = g.createLinearGradient(x, 0, x + 60, 0);
        grad.addColorStop(0, A.rgba(c[2], 0.25));
        grad.addColorStop(0.5, A.rgba(c[2], 0.45));
        grad.addColorStop(1, A.rgba(c[2], 0.2));
        g.fillStyle = grad;
        g.fillRect(x, y, 60, h - 30);
        // Specimen silhouette
        g.fillStyle = A.rgba("#0a1a1e", 0.8);
        g.beginPath();
        g.arc(x + 30, y + 60, 10, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x + 22, y + 70, 16, 50);
        g.fillStyle = "rgba(255,255,255,0.25)";
        for (let k = 0; k < 6; k++) g.fillRect(x + 10 + rng() * 40, y + rng() * h * 0.8, 3, 3);
      }
    },
    mountains(g, c, rng, depth) {
      for (let layer = 0; layer < 2; layer++) {
        g.fillStyle = c[layer];
        g.beginPath();
        g.moveTo(0, LAYER_H);
        let x = 0;
        const base = LAYER_H - 120 - layer * 40;
        while (x <= LAYER_W) {
          g.lineTo(x, base - rng() * (200 - layer * 60));
          x += 60 + rng() * 120;
        }
        g.lineTo(LAYER_W, LAYER_H);
        g.fill();
      }
      if (c[2] === "#ffffff" || depth === 0) {
        g.fillStyle = A.rgba(c[2], 0.25);
        g.fillRect(0, LAYER_H - 40, LAYER_W, 40);
      }
    },
    trees(g, c, rng, depth) {
      for (let x = 0; x < LAYER_W; x += 50 + rng() * 70) {
        const h = 220 + rng() * 200;
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - h, 10 + rng() * 10, h);
        for (let k = 0; k < 4; k++) {
          g.fillStyle = c[k % 2];
          g.beginPath();
          g.arc(x + 8 + (rng() - 0.5) * 60, LAYER_H - h + (rng() - 0.3) * 40, 30 + rng() * 40, 0, Math.PI * 2);
          g.fill();
        }
        if (rng() < 0.5) {
          g.strokeStyle = c[1];
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + 10, LAYER_H - h + 20);
          g.quadraticCurveTo(x + 20, LAYER_H - h + 120, x + 4, LAYER_H - h + 200);
          g.stroke();
        }
      }
      if (depth === 1) {
        g.fillStyle = A.rgba(c[2], 0.15);
        g.fillRect(0, LAYER_H - 60, LAYER_W, 60);
      }
    },
    foliage(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 30 + rng() * 40) {
        g.fillStyle = c[rng() < 0.5 ? 0 : 1];
        const h = 40 + rng() * 80;
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.quadraticCurveTo(x - 30, LAYER_H - h, x + 10, LAYER_H - h - 20);
        g.quadraticCurveTo(x + 20, LAYER_H - h * 0.5, x + 40, LAYER_H);
        g.fill();
      }
      for (let i = 0; i < 18; i++) {
        g.strokeStyle = c[1];
        g.lineWidth = 3;
        const x = rng() * LAYER_W;
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + 20, 60 + rng() * 60, x - 10, 100 + rng() * 140);
        g.stroke();
        g.fillStyle = c[2];
        g.beginPath();
        g.arc(x - 10, 100 + rng() * 140, 4, 0, Math.PI * 2);
        g.fill();
      }
    },
    cave(g, c, rng) {
      g.fillStyle = c[0];
      g.fillRect(0, 0, LAYER_W, LAYER_H);
      g.fillStyle = c[1];
      for (let x = 0; x < LAYER_W; x += 40 + rng() * 60) {
        const h = 60 + rng() * 180;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 20 + rng() * 20, h);
        g.lineTo(x + 50, 0);
        g.fill();
      }
      for (let i = 0; i < 30; i++) {
        g.fillStyle = A.rgba(c[2], 0.2 + rng() * 0.3);
        const x = rng() * LAYER_W;
        const y = rng() * LAYER_H;
        g.beginPath();
        g.moveTo(x, y - 10);
        g.lineTo(x + 4, y);
        g.lineTo(x, y + 10);
        g.lineTo(x - 4, y);
        g.fill();
      }
    },
    crystals(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 60 + rng() * 120) {
        const h = 60 + rng() * 160;
        const base = LAYER_H;
        for (let k = 0; k < 3; k++) {
          const cx = x + k * 14;
          const hh = h * (0.6 + rng() * 0.4);
          g.fillStyle = k === 1 ? A.rgba(c[2], 0.6) : c[k % 2];
          g.beginPath();
          g.moveTo(cx - 10, base);
          g.lineTo(cx - 4, base - hh);
          g.lineTo(cx + 2, base - hh - 14);
          g.lineTo(cx + 10, base);
          g.fill();
        }
      }
    },
    stalactites(g, c, rng) {
      g.fillStyle = c[0];
      for (let x = 0; x < LAYER_W; x += 30 + rng() * 50) {
        const h = 30 + rng() * 110;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 12, h);
        g.lineTo(x + 26, 0);
        g.fill();
      }
      for (let i = 0; i < 10; i++) {
        g.fillStyle = A.rgba(c[2], 0.7);
        g.beginPath();
        g.arc(rng() * LAYER_W, rng() * 100, 2, 0, Math.PI * 2);
        g.fill();
      }
    },
    gothic(g, c, rng, depth) {
      let x = 0;
      while (x < LAYER_W) {
        const w = 50 + rng() * 90;
        const h = 140 + rng() * 180;
        const y = LAYER_H - h;
        g.fillStyle = c[rng() < 0.5 ? 0 : 1];
        g.fillRect(x, y, w, h);
        // Pointed roof or spire
        g.beginPath();
        g.moveTo(x - 4, y);
        g.lineTo(x + w / 2, y - 40 - rng() * (depth === 0 ? 120 : 60));
        g.lineTo(x + w + 4, y);
        g.fill();
        if (rng() < 0.3) {
          g.fillStyle = A.rgba(c[2], 0.5);
          g.beginPath();
          g.arc(x + w / 2, y + 40, 10, 0, Math.PI * 2);
          g.fill();
        }
        windows(g, x, y + 20, w, h - 20, c[2], rng, 0.12);
        x += w + rng() * 20;
      }
    },
    stars(g, c, rng) {
      for (let i = 0; i < 260; i++) {
        g.fillStyle = A.rgba(rng() < 0.8 ? c[0] : c[1], 0.3 + rng() * 0.7);
        const s = rng() < 0.9 ? 1 : 2;
        g.fillRect(rng() * LAYER_W, rng() * LAYER_H, s, s);
      }
    },
    station(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 220 + rng() * 120) {
        const y = 120 + rng() * 200;
        g.fillStyle = c[0];
        g.fillRect(x, y, 140, 50);
        g.beginPath();
        g.arc(x, y + 25, 25, Math.PI / 2, Math.PI * 1.5);
        g.arc(x + 140, y + 25, 25, -Math.PI / 2, Math.PI / 2);
        g.fill();
        g.fillStyle = c[1];
        g.fillRect(x + 10, y + 10, 120, 6);
        windows(g, x, y + 16, 140, 30, c[2], rng, 0.4);
        // Solar panels
        g.fillStyle = "#1a2a5a";
        g.fillRect(x + 40, y - 70, 60, 50);
        g.fillRect(x + 40, y + 70, 60, 50);
        g.strokeStyle = "#3a5aa0";
        g.lineWidth = 1;
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.moveTo(x + 40 + k * 12, y - 70);
          g.lineTo(x + 40 + k * 12, y - 20);
          g.stroke();
        }
        g.fillStyle = c[0];
        g.fillRect(x + 68, y - 20, 4, 20);
        g.fillRect(x + 68, y + 50, 4, 20);
      }
    },
    trusses(g, c, rng) {
      g.strokeStyle = c[0];
      g.lineWidth = 6;
      for (let x = 0; x < LAYER_W; x += 260) {
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x, LAYER_H - 320);
        g.moveTo(x + 40, LAYER_H);
        g.lineTo(x + 40, LAYER_H - 320);
        for (let y = LAYER_H; y > LAYER_H - 320; y -= 40) {
          g.moveTo(x, y);
          g.lineTo(x + 40, y - 40);
        }
        g.stroke();
        g.fillStyle = A.rgba(c[2], 0.9);
        g.beginPath();
        g.arc(x + 20, LAYER_H - 330, 4, 0, Math.PI * 2);
        g.fill();
      }
    },
    icecliffs(g, c, rng) {
      g.fillStyle = c[0];
      g.beginPath();
      g.moveTo(0, LAYER_H);
      let x = 0;
      while (x <= LAYER_W) {
        const top = LAYER_H - 140 - rng() * 160;
        g.lineTo(x, top);
        g.lineTo(x + 20 + rng() * 30, top + 10);
        x += 50 + rng() * 70;
      }
      g.lineTo(LAYER_W, LAYER_H);
      g.fill();
      g.strokeStyle = A.rgba(c[2], 0.5);
      g.lineWidth = 2;
      for (let i = 0; i < 30; i++) {
        const sx = rng() * LAYER_W;
        const sy = LAYER_H - 50 - rng() * 200;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + 10, sy + 40);
        g.stroke();
      }
    },
    icicles(g, c, rng) {
      g.fillStyle = c[1];
      for (let x = 0; x < LAYER_W; x += 16 + rng() * 30) {
        const h = 20 + rng() * 70;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 5, h);
        g.lineTo(x + 11, 0);
        g.fill();
      }
      g.fillStyle = c[0];
      for (let x = 0; x < LAYER_W; x += 120 + rng() * 120) {
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x + 30, LAYER_H - 60 - rng() * 60);
        g.lineTo(x + 70, LAYER_H);
        g.fill();
      }
    },
    prison(g, c, rng, depth) {
      g.fillStyle = c[0];
      g.fillRect(0, LAYER_H - 220, LAYER_W, 220);
      for (let x = 60; x < LAYER_W; x += 340) {
        g.fillStyle = c[1];
        g.fillRect(x, LAYER_H - 360, 50, 360);
        g.fillRect(x - 12, LAYER_H - 380, 74, 24);
        g.fillStyle = A.rgba(c[2], 0.8);
        g.fillRect(x + 12, LAYER_H - 372, 26, 10);
      }
      for (let x = 0; x < LAYER_W; x += 40) {
        g.fillStyle = "#0a0c10";
        g.fillRect(x + 12, LAYER_H - 180, 18, 24);
        g.fillStyle = A.rgba(c[2], depth ? 0.5 : 0.3);
        g.fillRect(x + 14, LAYER_H - 178, 14, 20);
        g.fillStyle = "#0a0c10";
        for (let k = 0; k < 3; k++) g.fillRect(x + 16 + k * 4, LAYER_H - 180, 1.5, 24);
      }
    },
    fence(g, c) {
      g.strokeStyle = c[0];
      g.lineWidth = 3;
      for (let x = 0; x < LAYER_W; x += 120) {
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x, LAYER_H - 160);
        g.stroke();
      }
      g.lineWidth = 1;
      for (let x = -160; x < LAYER_W; x += 14) {
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x + 160, LAYER_H - 150);
        g.moveTo(x + 160, LAYER_H);
        g.lineTo(x, LAYER_H - 150);
        g.stroke();
      }
      g.lineWidth = 2;
      for (let x = 0; x < LAYER_W; x += 10) {
        g.beginPath();
        g.arc(x, LAYER_H - 165, 5, 0, Math.PI * 2);
        g.stroke();
      }
    },
    dunes(g, c, rng) {
      for (let k = 0; k < 2; k++) {
        g.fillStyle = c[k];
        g.beginPath();
        g.moveTo(0, LAYER_H);
        const base = LAYER_H - 100 + k * 40;
        const ph = rng() * 6;
        for (let x = 0; x <= LAYER_W; x += 20) g.lineTo(x, base - Math.sin(x / 160 + ph) * 40 - Math.sin(x / 70 + ph * 2) * 12);
        g.lineTo(LAYER_W, LAYER_H);
        g.fill();
      }
    },
    mesas(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 200 + rng() * 200) {
        const w = 120 + rng() * 160;
        const h = 120 + rng() * 140;
        g.fillStyle = c[0];
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x + 20, LAYER_H - h);
        g.lineTo(x + w - 20, LAYER_H - h);
        g.lineTo(x + w, LAYER_H);
        g.fill();
        g.fillStyle = c[1];
        g.fillRect(x + 20, LAYER_H - h, w - 40, 10);
        g.fillStyle = A.rgba("#000000", 0.12);
        for (let y = LAYER_H - h + 30; y < LAYER_H; y += 26) g.fillRect(x + 10, y, w - 20, 3);
      }
    },
    outpost(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 260 + rng() * 160) {
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - 70, 120, 70);
        g.fillRect(x + 140, LAYER_H - 200, 10, 200);
        g.beginPath();
        g.arc(x + 145, LAYER_H - 210, 26, Math.PI, 0);
        g.fill();
        g.fillStyle = A.rgba(c[2], 0.9);
        g.beginPath();
        g.arc(x + 145, LAYER_H - 220, 3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c[1];
        g.fillRect(x + 10, LAYER_H - 60, 30, 20);
      }
    },
    servers(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 70 + rng() * 40) {
        const h = 200 + rng() * 260;
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - h, 50, h);
        g.fillStyle = c[1];
        for (let y = LAYER_H - h + 10; y < LAYER_H - 10; y += 14) {
          g.fillRect(x + 4, y, 42, 10);
          if (rng() < 0.6) {
            g.fillStyle = A.rgba(c[2], 0.6 + rng() * 0.4);
            g.fillRect(x + 8 + rng() * 30, y + 3, 3, 3);
            g.fillStyle = c[1];
          }
        }
      }
      g.strokeStyle = A.rgba(c[2], 0.4);
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = 40 + rng() * 300;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(LAYER_W, y);
        g.stroke();
      }
    },
    columns(g, c, rng, depth) {
      for (let x = 20; x < LAYER_W; x += 140 + rng() * 60) {
        const h = 240 + rng() * 140;
        const broken = rng() < 0.3;
        const hh = broken ? h * 0.6 : h;
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - hh, 44, hh);
        g.fillStyle = c[1];
        for (let k = 6; k < 44; k += 10) g.fillRect(x + k, LAYER_H - hh, 3, hh);
        g.fillStyle = c[0];
        if (!broken) {
          g.fillRect(x - 8, LAYER_H - h - 16, 60, 16);
          g.fillRect(x - 8, LAYER_H - 16, 60, 16);
        } else {
          g.beginPath();
          g.moveTo(x, LAYER_H - hh);
          g.lineTo(x + 20, LAYER_H - hh - 18);
          g.lineTo(x + 44, LAYER_H - hh);
          g.fill();
        }
        if (rng() < 0.3) {
          g.fillStyle = A.rgba(c[2], 0.6);
          g.beginPath();
          g.arc(x + 22, LAYER_H - hh + 60, 6, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (depth === 0) {
        g.fillStyle = c[1];
        g.fillRect(0, LAYER_H - 420, LAYER_W, 24);
      }
    },
    vines(g, c, rng) {
      for (let i = 0; i < 26; i++) {
        g.strokeStyle = c[i % 2];
        g.lineWidth = 2 + rng() * 3;
        const x = rng() * LAYER_W;
        const len = 80 + rng() * 220;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + 20, len * 0.3, x - 20, len * 0.6, x + 6, len);
        g.stroke();
        for (let k = 0; k < 5; k++) {
          g.fillStyle = c[1];
          g.beginPath();
          g.ellipse(x + (rng() - 0.5) * 20, rng() * len, 6, 3, rng() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (let x = 0; x < LAYER_W; x += 40 + rng() * 40) {
        g.fillStyle = c[0];
        g.beginPath();
        g.arc(x, LAYER_H, 30 + rng() * 30, Math.PI, 0);
        g.fill();
      }
    },
    ziggurat(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 400 + rng() * 200) {
        const w = 300 + rng() * 120;
        for (let k = 0; k < 6; k++) {
          g.fillStyle = c[k % 2];
          const sw = w - k * 44;
          g.fillRect(x + k * 22, LAYER_H - (k + 1) * 50, sw, 50);
        }
        g.fillStyle = A.rgba(c[2], 0.6);
        g.fillRect(x + w / 2 - 10, LAYER_H - 330, 20, 30);
      }
      const grd = g.createLinearGradient(0, LAYER_H - 100, 0, LAYER_H);
      grd.addColorStop(0, A.rgba(c[2], 0));
      grd.addColorStop(1, A.rgba(c[2], 0.45));
      g.fillStyle = grd;
      g.fillRect(0, LAYER_H - 100, LAYER_W, 100);
    },
    statues(g, c, rng) {
      for (let x = 60; x < LAYER_W; x += 380 + rng() * 120) {
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - 120, 120, 120);
        g.fillRect(x + 20, LAYER_H - 300, 80, 180);
        g.beginPath();
        g.arc(x + 60, LAYER_H - 330, 34, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(x + 26, LAYER_H - 350);
        g.lineTo(x + 60, LAYER_H - 420);
        g.lineTo(x + 94, LAYER_H - 350);
        g.fill();
        g.fillStyle = A.rgba(c[2], 0.9);
        g.fillRect(x + 64, LAYER_H - 336, 12, 4);
        g.fillStyle = c[1];
        g.fillRect(x + 30, LAYER_H - 260, 60, 8);
      }
    },
    cranes(g, c, rng) {
      for (let x = 0; x < LAYER_W; x += 300 + rng() * 200) {
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - 380, 14, 380);
        g.fillRect(x - 60, LAYER_H - 380, 260, 10);
        g.fillRect(x + 180, LAYER_H - 370, 2, 120);
        g.fillRect(x + 172, LAYER_H - 250, 18, 14);
        g.strokeStyle = c[0];
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 7, LAYER_H - 420);
        g.lineTo(x - 60, LAYER_H - 380);
        g.moveTo(x + 7, LAYER_H - 420);
        g.lineTo(x + 200, LAYER_H - 380);
        g.stroke();
        g.fillStyle = A.rgba(c[2], 0.9);
        g.beginPath();
        g.arc(x + 7, LAYER_H - 424, 3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = c[1];
        g.fillRect(x + 40, LAYER_H - 180, 120, 180);
        windows(g, x + 40, LAYER_H - 180, 120, 180, c[2], rng, 0.18);
      }
    },
    floaters(g, c, rng) {
      for (let i = 0; i < 9; i++) {
        const x = rng() * LAYER_W;
        const y = 80 + rng() * 300;
        const w = 60 + rng() * 120;
        g.fillStyle = c[i % 2];
        g.beginPath();
        g.moveTo(x - w / 2, y);
        g.lineTo(x + w / 2, y);
        g.lineTo(x + w * 0.2, y + w * 0.6);
        g.lineTo(x - w * 0.1, y + w * 0.45);
        g.fill();
        g.fillStyle = A.rgba(c[2], 0.7);
        g.beginPath();
        g.moveTo(x - 6, y);
        g.lineTo(x, y - 24 - rng() * 20);
        g.lineTo(x + 6, y);
        g.fill();
      }
    },
    hills(g, c, rng) {
      g.fillStyle = c[0];
      g.beginPath();
      g.moveTo(0, LAYER_H);
      for (let x = 0; x <= LAYER_W; x += 40) g.lineTo(x, LAYER_H - 140 - Math.sin(x / 220) * 40 - rng() * 10);
      g.lineTo(LAYER_W, LAYER_H);
      g.fill();
    },
    mansion(g, c, rng) {
      for (let x = 100; x < LAYER_W; x += 800) {
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - 220, 520, 220);
        g.fillRect(x + 200, LAYER_H - 300, 120, 80);
        g.beginPath();
        g.moveTo(x - 10, LAYER_H - 220);
        g.lineTo(x + 60, LAYER_H - 280);
        g.lineTo(x + 460, LAYER_H - 280);
        g.lineTo(x + 530, LAYER_H - 220);
        g.fill();
        g.beginPath();
        g.moveTo(x + 190, LAYER_H - 300);
        g.lineTo(x + 260, LAYER_H - 350);
        g.lineTo(x + 330, LAYER_H - 300);
        g.fill();
        g.fillRect(x + 40, LAYER_H - 320, 16, 50);
        g.fillRect(x + 460, LAYER_H - 320, 16, 50);
        for (let wx = x + 30; wx < x + 500; wx += 40) {
          for (let wy = LAYER_H - 200; wy < LAYER_H - 40; wy += 60) {
            g.fillStyle = rng() < 0.6 ? A.rgba(c[2], 0.75) : "#120a12";
            g.fillRect(wx, wy, 16, 28);
          }
        }
        A.xLogo(g, x + 260, LAYER_H - 260, 14, A.rgba(c[2], 0.8), c[1], false);
      }
    },
    clouds(g, c, rng) {
      for (let i = 0; i < 26; i++) {
        const x = rng() * LAYER_W;
        const y = 200 + rng() * 300;
        g.fillStyle = A.rgba(c[i % 2], 0.5 + rng() * 0.4);
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(x + k * 30, y + Math.sin(k) * 10, 30 + rng() * 30, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
    spires(g, c, rng, depth) {
      for (let x = 0; x < LAYER_W; x += 120 + rng() * 160) {
        const h = 200 + rng() * 260;
        g.fillStyle = c[rng() < 0.5 ? 0 : 1];
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x + 10, LAYER_H - h * 0.7);
        g.lineTo(x + 24, LAYER_H - h);
        g.lineTo(x + 38, LAYER_H - h * 0.7);
        g.lineTo(x + 48, LAYER_H);
        g.fill();
        g.fillRect(x - 30, LAYER_H - h * 0.5, 110, 12);
        g.fillStyle = A.rgba(c[2], 0.8);
        g.beginPath();
        g.arc(x + 24, LAYER_H - h * 0.6, 4, 0, Math.PI * 2);
        g.fill();
      }
      if (depth === 2) {
        g.fillStyle = c[0];
        g.fillRect(0, LAYER_H - 30, LAYER_W, 30);
      }
    },
    energycols(g, c, rng) {
      for (let x = 40; x < LAYER_W; x += 180 + rng() * 80) {
        const h = 300 + rng() * 200;
        g.fillStyle = c[0];
        g.fillRect(x, LAYER_H - h, 40, h);
        const grd = g.createLinearGradient(x, 0, x + 40, 0);
        grd.addColorStop(0, A.rgba(c[2], 0));
        grd.addColorStop(0.5, A.rgba(c[2], 0.6));
        grd.addColorStop(1, A.rgba(c[2], 0));
        g.fillStyle = grd;
        g.fillRect(x + 12, LAYER_H - h, 16, h);
        g.strokeStyle = A.rgba(c[2], 0.5);
        g.lineWidth = 2;
        for (let y = LAYER_H - h + 40; y < LAYER_H; y += 80) {
          g.beginPath();
          g.ellipse(x + 20, y, 34, 8, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
    },
    ruins(g, c, rng) {
      let x = 0;
      while (x < LAYER_W) {
        const w = 60 + rng() * 120;
        const h = 80 + rng() * 220;
        g.fillStyle = c[rng() < 0.5 ? 0 : 1];
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x, LAYER_H - h);
        for (let k = 1; k <= 4; k++) g.lineTo(x + (w * k) / 4, LAYER_H - h + (rng() - 0.3) * 60);
        g.lineTo(x + w, LAYER_H);
        g.fill();
        if (rng() < 0.4) {
          g.fillStyle = A.rgba(c[2], 0.5);
          g.beginPath();
          g.arc(x + w / 2, LAYER_H - h * 0.5, 10 + rng() * 10, 0, Math.PI * 2);
          g.fill();
        }
        x += w + rng() * 40;
      }
    },
    debris(g, c, rng) {
      for (let i = 0; i < 40; i++) {
        g.fillStyle = c[i % 2];
        const x = rng() * LAYER_W;
        const s = 10 + rng() * 40;
        g.save();
        g.translate(x, LAYER_H - rng() * 60);
        g.rotate(rng() * 3);
        g.fillRect(-s / 2, -s / 4, s, s / 2);
        g.restore();
      }
      for (let i = 0; i < 6; i++) {
        g.strokeStyle = c[0];
        g.lineWidth = 6;
        const x = rng() * LAYER_W;
        g.beginPath();
        g.moveTo(x, LAYER_H);
        g.lineTo(x + 40 + rng() * 60, LAYER_H - 160 - rng() * 100);
        g.stroke();
      }
    },
  };

  // ---------- Building & drawing backgrounds ----------
  const cache = new Map();
  const BG = {
    THEMES,
    build(themeIndex, quality = "high") {
      const key = themeIndex + quality;
      if (cache.has(key)) return cache.get(key);
      const th = THEMES[themeIndex];
      const scale = quality === "low" ? 0.5 : quality === "medium" ? 0.75 : 1;
      const layers = th.layers.map((L, i) => {
        if (quality === "low" && i === 0) return null;
        const c = A.canvas(LAYER_W * scale, LAYER_H * scale);
        const g = c.getContext("2d");
        g.scale(scale, scale);
        const rng = U.rng(themeIndex * 97 + i * 13 + 5);
        PAINT[L[0]](g, [L[1], L[2], L[3]], rng, i);
        return { canvas: c, factor: [0.15, 0.35, 0.6][i], yFactor: [0.05, 0.12, 0.25][i] };
      });
      const grad = { top: th.sky[0], bottom: th.sky[1] };
      const out = { theme: th, layers, grad, stars: this.makeStars(themeIndex) };
      cache.set(key, out);
      return out;
    },
    makeStars(i) {
      const rng = U.rng(i * 31 + 7);
      const out = [];
      for (let k = 0; k < 70; k++) out.push({ x: rng(), y: rng() * 0.6, s: rng() < 0.85 ? 1 : 2, p: rng() * 6 });
      return out;
    },

    draw(ctx, bg, camX, camY, t, levelH) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const th = bg.theme;
      const g = ctx.createLinearGradient(0, 0, 0, vh);
      g.addColorStop(0, bg.grad.top);
      g.addColorStop(1, bg.grad.bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, vw, vh);
      this.drawExtra(ctx, bg, th.extra, t, camX);
      const extraY = Math.max(0, (levelH || vh) - vh);
      for (const L of bg.layers) {
        if (!L) continue;
        const cw = LAYER_W;
        const off = -((camX * L.factor) % cw);
        const y = vh - LAYER_H + (extraY - camY) * L.yFactor;
        for (let x = off - (off > 0 ? cw : 0); x < vw; x += cw) ctx.drawImage(L.canvas, x, y, cw, LAYER_H);
      }
      // Haze between the background and the level
      ctx.fillStyle = A.rgba(th.fog, 0.18);
      ctx.fillRect(0, 0, vw, vh);
    },

    drawExtra(ctx, bg, extra, t, camX) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const starsVisible = ["moon", "earth", "aurora", "vortex", "core", "storm", "grid", "searchlights", "none"].includes(extra);
      if (starsVisible) {
        for (const s of bg.stars) {
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.p);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(((s.x * vw * 1.4 - camX * 0.03) % vw + vw) % vw, s.y * vh, s.s, s.s);
        }
        ctx.globalAlpha = 1;
      }
      switch (extra) {
        case "moon":
          A.glow(ctx, vw * 0.78, 90, 110, "#fff6d8", 0.35);
          A.circle(ctx, vw * 0.78, 90, 34, "#fff6d8", false);
          ctx.fillStyle = "rgba(200,190,160,0.5)";
          ctx.beginPath();
          ctx.arc(vw * 0.78 - 10, 84, 7, 0, Math.PI * 2);
          ctx.arc(vw * 0.78 + 12, 100, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "sun":
          A.glow(ctx, vw * 0.2, 80, 160, "#fff6c0", 0.5);
          A.circle(ctx, vw * 0.2, 80, 40, "#fff8e0", false);
          break;
        case "earth": {
          const r = vw * 0.9;
          const cx = vw * 0.5;
          const cy = vh + r * 0.72;
          A.glow(ctx, cx, cy, r * 1.15, "#5ab0ff", 0.5);
          const eg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.6, r * 0.2, cx, cy, r);
          eg.addColorStop(0, "#5ab0ff");
          eg.addColorStop(0.6, "#1a5aa0");
          eg.addColorStop(1, "#0a1a40");
          ctx.fillStyle = eg;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(90,160,80,0.6)";
          ctx.beginPath();
          ctx.ellipse(cx - r * 0.25 + Math.sin(t * 0.02) * 20, cy - r * 0.86, 120, 26, 0.2, 0, Math.PI * 2);
          ctx.ellipse(cx + r * 0.3, cy - r * 0.9, 80, 18, -0.1, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "aurora":
          for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = ["#5affb0", "#5ad0ff", "#b07aff"][i];
            ctx.beginPath();
            ctx.moveTo(0, 60 + i * 30);
            for (let x = 0; x <= vw; x += 40) ctx.lineTo(x, 60 + i * 30 + Math.sin(x / 120 + t * 0.6 + i) * 30);
            for (let x = vw; x >= 0; x -= 40) ctx.lineTo(x, 140 + i * 30 + Math.sin(x / 140 + t * 0.5 + i) * 30);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        case "smog":
          ctx.fillStyle = "rgba(60,30,20,0.25)";
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(((i * 300 - camX * 0.05 + t * 10) % (vw + 300)) - 100, 120 + i * 30, 260, 40, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "searchlights":
          for (let i = 0; i < 2; i++) {
            const a = Math.sin(t * 0.5 + i * 2) * 0.6 - Math.PI / 2;
            const x0 = vw * (0.3 + i * 0.4);
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = "#fff6c0";
            ctx.beginPath();
            ctx.moveTo(x0, vh);
            ctx.lineTo(x0 + Math.cos(a - 0.08) * 900, vh + Math.sin(a - 0.08) * 900);
            ctx.lineTo(x0 + Math.cos(a + 0.08) * 900, vh + Math.sin(a + 0.08) * 900);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        case "grid":
          ctx.strokeStyle = "rgba(255,58,106,0.12)";
          ctx.lineWidth = 1;
          for (let x = -((camX * 0.1) % 60); x < vw; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, vh);
            ctx.stroke();
          }
          for (let y = 0; y < vh; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(vw, y);
            ctx.stroke();
          }
          break;
        case "sunbeams":
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#fff6c0";
          for (let i = 0; i < 4; i++) {
            const x = vw * (0.15 + i * 0.25) + Math.sin(t * 0.3 + i) * 20;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 40, 0);
            ctx.lineTo(x + 160, vh);
            ctx.lineTo(x + 60, vh);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          break;
        case "lavaglow":
        case "fireglow": {
          const lg = ctx.createLinearGradient(0, vh * 0.5, 0, vh);
          lg.addColorStop(0, "rgba(255,90,30,0)");
          lg.addColorStop(1, `rgba(255,90,30,${0.25 + 0.08 * Math.sin(t * 2)})`);
          ctx.fillStyle = lg;
          ctx.fillRect(0, vh * 0.5, vw, vh * 0.5);
          break;
        }
        case "vortex": {
          const cx = vw * 0.65;
          const cy = 150;
          for (let i = 0; i < 6; i++) {
            ctx.strokeStyle = A.rgba(i % 2 ? "#ff5aff" : "#5affff", 0.25);
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(cx, cy, 40 + i * 30, 16 + i * 12, t * 0.3 + i * 0.4, 0, Math.PI * 1.6);
            ctx.stroke();
          }
          A.glow(ctx, cx, cy, 80, "#ffffff", 0.5);
          break;
        }
        case "clouds":
          A.glow(ctx, vw * 0.8, 70, 140, "#fff0d0", 0.45);
          break;
        case "core": {
          const cx = vw * 0.5;
          const cy = 170;
          const pulse = 0.6 + 0.2 * Math.sin(t * 2);
          A.glow(ctx, cx, cy, 200, "#ff5aff", pulse * 0.6);
          A.glow(ctx, cx, cy, 90, "#ffffff", pulse * 0.6);
          ctx.strokeStyle = "rgba(90,255,255,0.35)";
          ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(cx, cy, 110 + i * 26, 30 + i * 8, t * (0.4 + i * 0.2), 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }
        case "storm":
          if (Math.sin(t * 1.7) > 0.985) {
            ctx.fillStyle = "rgba(220,200,255,0.25)";
            ctx.fillRect(0, 0, vw, vh);
          }
          A.glow(ctx, vw * 0.5, 120, 160, "#ff5aff", 0.3 + 0.1 * Math.sin(t * 3));
          break;
      }
    },
  };

  // ---------- Weather (screen space, cheap) ----------
  const Weather = {
    parts: [],
    init(kind, quality) {
      this.kind = kind;
      this.parts = [];
      const n = { rain: 120, snow: 90, embers: 50, sparks: 30, dust: 40, spores: 40, ash: 60, motes: 40, none: 0 }[kind] || 0;
      const count = Math.round(n * (quality === "low" ? 0.35 : quality === "medium" ? 0.65 : 1));
      for (let i = 0; i < count; i++) this.parts.push(this.make(true));
    },
    make(anywhere) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      const k = this.kind;
      const p = { x: Math.random() * vw, y: anywhere ? Math.random() * vh : -10, s: Math.random() };
      if (k === "rain") Object.assign(p, { vx: -120, vy: 900 + Math.random() * 300 });
      else if (k === "snow" || k === "ash") Object.assign(p, { vx: -30 + Math.random() * 20, vy: 40 + Math.random() * 60 });
      else if (k === "embers" || k === "sparks") Object.assign(p, { vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 80, y: anywhere ? Math.random() * vh : vh + 10 });
      else Object.assign(p, { vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20 });
      return p;
    },
    update(dt, camDX) {
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        p.x += p.vx * dt - camDX * 0.6;
        p.y += p.vy * dt;
        if (this.kind === "snow" || this.kind === "motes" || this.kind === "spores") p.x += Math.sin(p.y / 30 + p.s * 6) * 0.4;
        if (p.y > vh + 20 || p.y < -30 || p.x < -40 || p.x > vw + 40) {
          this.parts[i] = this.make(false);
          if (this.kind === "motes" || this.kind === "dust" || this.kind === "spores") this.parts[i].y = Math.random() * vh;
          if (p.x < -40) this.parts[i].x = vw + 20;
          else if (p.x > vw + 40) this.parts[i].x = -20;
        }
      }
    },
    draw(ctx) {
      const k = this.kind;
      for (const p of this.parts) {
        switch (k) {
          case "rain":
            ctx.strokeStyle = "rgba(170,190,230,0.45)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 0.02, p.y + p.vy * 0.02);
            ctx.stroke();
            break;
          case "snow":
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.fillRect(p.x, p.y, 2 + p.s * 2, 2 + p.s * 2);
            break;
          case "ash":
            ctx.fillStyle = "rgba(90,80,80,0.6)";
            ctx.fillRect(p.x, p.y, 2, 2);
            break;
          case "embers":
            ctx.fillStyle = `rgba(255,${120 + Math.floor(p.s * 100)},40,0.8)`;
            ctx.fillRect(p.x, p.y, 2, 2);
            break;
          case "sparks":
            ctx.fillStyle = "rgba(255,90,255,0.7)";
            ctx.fillRect(p.x, p.y, 2, 2);
            break;
          case "dust":
            ctx.fillStyle = "rgba(220,200,160,0.25)";
            ctx.fillRect(p.x, p.y, 2, 2);
            break;
          case "spores":
            ctx.fillStyle = "rgba(220,255,160,0.5)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5 + p.s, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "motes":
            ctx.fillStyle = "rgba(200,240,255,0.45)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1 + p.s * 1.5, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
      }
    },
  };

  // ---------- Tiles ----------
  const tileCache = new Map();
  function tileSet(themeIndex) {
    if (tileCache.has(themeIndex)) return tileCache.get(themeIndex);
    const th = THEMES[themeIndex].tile;
    const make = (fn) => {
      const c = A.canvas(T, T);
      fn(c.getContext("2d"));
      return c;
    };
    const rng = U.rng(themeIndex * 11 + 3);
    const texture = (g, top) => {
      g.fillStyle = th.body;
      g.fillRect(0, 0, T, T);
      g.strokeStyle = th.line;
      g.lineWidth = 2;
      switch (th.style) {
        case "brick":
        case "concrete":
          for (let y = 0; y < T; y += 10) {
            g.beginPath();
            g.moveTo(0, y);
            g.lineTo(T, y);
            g.stroke();
            const off = (y / 10) % 2 ? 10 : 0;
            for (let x = off; x < T; x += th.style === "brick" ? 20 : 40) {
              g.beginPath();
              g.moveTo(x, y);
              g.lineTo(x, y + 10);
              g.stroke();
            }
          }
          break;
        case "metal":
          g.strokeRect(1, 1, T - 2, T - 2);
          g.fillStyle = th.line;
          [4, T - 6].forEach((x) => [4, T - 6].forEach((y) => g.fillRect(x, y, 2, 2)));
          g.fillStyle = "rgba(255,255,255,0.06)";
          g.fillRect(2, 2, T - 4, 6);
          break;
        case "tile":
          for (let y = 0; y < T; y += 13) for (let x = 0; x < T; x += 13) g.strokeRect(x + 1, y + 1, 12, 12);
          break;
        case "rock":
        case "stone":
        case "cobble":
        case "sand":
          for (let i = 0; i < 5; i++) {
            g.fillStyle = A.shade(th.body, (rng() - 0.5) * 0.3);
            g.beginPath();
            g.ellipse(rng() * T, rng() * T, 4 + rng() * 8, 3 + rng() * 5, rng() * 3, 0, Math.PI * 2);
            g.fill();
          }
          if (th.style === "stone") {
            g.strokeRect(1, 1, T - 2, T / 2 - 1);
            g.strokeRect(1, T / 2, T - 2, T / 2 - 1);
          }
          break;
        case "ice":
          g.fillStyle = "rgba(255,255,255,0.25)";
          g.beginPath();
          g.moveTo(0, T);
          g.lineTo(T * 0.6, 0);
          g.lineTo(T, 0);
          g.lineTo(T * 0.3, T);
          g.fill();
          break;
        case "nexus":
          g.strokeStyle = A.rgba(th.accent, 0.35);
          g.beginPath();
          g.moveTo(0, T * 0.3);
          g.lineTo(T * 0.5, T * 0.5);
          g.lineTo(T, T * 0.2);
          g.moveTo(T * 0.5, T * 0.5);
          g.lineTo(T * 0.4, T);
          g.stroke();
          break;
      }
      if (top) {
        g.fillStyle = th.top;
        g.fillRect(0, 0, T, 8);
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(0, 0, T, 2);
        g.fillStyle = "rgba(0,0,0,0.25)";
        g.fillRect(0, 8, T, 2);
        if (th.style === "rock" && th.top === "#5a8a3a") {
          g.fillStyle = "#7aba4a";
          for (let x = 2; x < T; x += 6) g.fillRect(x, 0, 2, 4 + (x % 4));
        }
        if (th.style === "ice") {
          g.fillStyle = "#ffffff";
          for (let x = 4; x < T; x += 12) {
            g.beginPath();
            g.moveTo(x, 8);
            g.lineTo(x + 3, 16);
            g.lineTo(x + 6, 8);
            g.fill();
          }
        }
      }
    };
    const set = {
      top: make((g) => texture(g, true)),
      body: make((g) => texture(g, false)),
      oneway: make((g) => {
        g.fillStyle = th.top;
        g.fillRect(0, 0, T, 10);
        g.fillStyle = th.line;
        g.fillRect(0, 10, T, 3);
        g.fillStyle = "rgba(255,255,255,0.2)";
        g.fillRect(0, 0, T, 2);
        g.fillStyle = th.body;
        g.fillRect(4, 13, 4, 8);
        g.fillRect(T - 8, 13, 4, 8);
        g.strokeStyle = A.OUTLINE;
        g.lineWidth = 1.5;
        g.strokeRect(0.5, 0.5, T - 1, 12);
      }),
      hazard: make((g) => {
        const h = th.hazard;
        if (h === "lava" || h === "acid" || h === "fire") {
          const col = h === "acid" ? "#7aff3a" : "#ff6a1a";
          const grd = g.createLinearGradient(0, T * 0.45, 0, T);
          grd.addColorStop(0, h === "acid" ? "#d8ff7a" : "#ffd23f");
          grd.addColorStop(1, col);
          g.fillStyle = grd;
          g.fillRect(0, T * 0.5, T, T * 0.5);
          g.fillStyle = "rgba(255,255,255,0.5)";
          g.fillRect(4, T * 0.55, 8, 2);
          g.fillRect(24, T * 0.62, 6, 2);
          return;
        }
        if (h === "electric" || h === "nexus") {
          g.fillStyle = "#2a2a34";
          g.fillRect(0, T - 10, T, 10);
          g.strokeStyle = h === "nexus" ? "#ff5aff" : "#7ad0ff";
          g.lineWidth = 2.5;
          g.beginPath();
          g.moveTo(0, T - 14);
          for (let x = 0; x <= T; x += 8) g.lineTo(x, T - 14 - ((x / 8) % 2 ? 12 : 0));
          g.stroke();
          return;
        }
        const col = h === "ice" ? "#e8fbff" : h === "crystal" ? "#c8a8ff" : h === "thorns" ? "#3a5a22" : "#b8bec8";
        for (let x = 0; x < T; x += 10) {
          A.poly(g, [x, T, x + 5, T * 0.45, x + 10, T], col, true, 1.5);
        }
      }),
      ladder: make((g) => {
        g.fillStyle = "#7a5a3a";
        g.fillRect(8, 0, 5, T);
        g.fillRect(T - 13, 0, 5, T);
        for (let y = 5; y < T; y += 12) g.fillRect(8, y, T - 16, 4);
        g.strokeStyle = A.OUTLINE;
        g.lineWidth = 1;
        g.strokeRect(8, 0, 5, T);
        g.strokeRect(T - 13, 0, 5, T);
      }),
      crate: make((g) => {
        A.box(g, 2, 2, T - 4, T - 4, "#a8743a", true, 3, 2);
        g.strokeStyle = "#6a4420";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(6, 6);
        g.lineTo(T - 6, T - 6);
        g.moveTo(T - 6, 6);
        g.lineTo(6, T - 6);
        g.stroke();
        g.strokeStyle = "#6a4420";
        g.lineWidth = 2;
        g.strokeRect(6, 6, T - 12, T - 12);
      }),
      seal: make((g) => {
        A.box(g, 2, 2, T - 4, T - 4, "#3a4a6a", true, 4, 2);
        g.fillStyle = "#26324a";
        g.fillRect(6, 6, T - 12, T - 12);
        A.xLogo(g, T / 2, T / 2, 10, "#7ae8ff", "#16203a");
      }),
      gate: make((g) => {
        g.fillStyle = "rgba(255,60,60,0.25)";
        g.fillRect(0, 0, T, T);
        g.strokeStyle = "#ff5a5a";
        g.lineWidth = 3;
        for (let x = 6; x < T; x += 12) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, T);
          g.stroke();
        }
      }),
    };
    tileCache.set(themeIndex, set);
    return set;
  }

  XM.THEMES = THEMES;
  XM.BG = BG;
  XM.Weather = Weather;
  XM.tileSet = tileSet;
})(window.XM);
