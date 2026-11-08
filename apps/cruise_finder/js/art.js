/* Original illustrations drawn as inline SVG: destination scenes and stylized ship profiles.
 * No photographs, logos or trademarks. Output is app-generated markup only (never user text). */
(function () {
  "use strict";
  const CF = window.CF;
  let gid = 0;

  const SCENES = {
    tropical: { sky: ["#6cc7ef", "#dff5ff"], sea: ["#18b5c6", "#0a6d99"], sun: "#fff6c9" },
    island: { sky: ["#5ec2f0", "#e4f7ff"], sea: ["#22c3c9", "#0b7aa0"], sun: "#fff3b8" },
    alaska: { sky: ["#a9c7e3", "#eef4fa"], sea: ["#2f6d80", "#173f52"], sun: "#ffffff" },
    mediterranean: { sky: ["#ffc98f", "#fff1dc"], sea: ["#2d77c2", "#173f7a"], sun: "#fff0c4" },
    northern: { sky: ["#b8c9de", "#e8eef6"], sea: ["#2a5b76", "#132f44"], sun: "#ffffff" },
    asia: { sky: ["#ffb48a", "#ffe5cf"], sea: ["#2c6ea3", "#163e66"], sun: "#ffe7b0" },
    pacific: { sky: ["#58b9ec", "#dcf3ff"], sea: ["#139fc1", "#06557f"], sun: "#fff6c9" },
    ocean: { sky: ["#7fb6e6", "#e6f1fb"], sea: ["#2a6fb0", "#123c6e"], sun: "#ffffff" },
    canal: { sky: ["#8fcdea", "#e9f7fc"], sea: ["#2d8a8f", "#145257"], sun: "#fff6c9" },
    hero: { sky: ["#1b2a6b", "#f59e6b"], sea: ["#1b3f7a", "#0b1f3f"], sun: "#ffd29a" },
    night: { sky: ["#0b1530", "#2a3f78"], sea: ["#0f2a52", "#071631"], sun: "#f4f1d0" },
  };

  function landscape(kind, W, H, horizon) {
    const y = horizon;
    switch (kind) {
      case "tropical": case "island": case "pacific":
        return `<path d="M${W * 0.02} ${y} q${W * 0.1} -${H * 0.07} ${W * 0.24} 0 z" fill="#f2dfb0"/>
          <path d="M${W * 0.06} ${y} q${W * 0.06} -${H * 0.05} ${W * 0.16} 0 z" fill="#4caf6e"/>
          ${palm(W * 0.1, y - H * 0.02, H * 0.2)}${palm(W * 0.17, y - H * 0.015, H * 0.15)}
          ${kind === "island" ? `<circle cx="${W * 0.86}" cy="${H * 0.18}" r="${H * 0.045}" fill="#ff7a59"/><path d="M${W * 0.86} ${H * 0.225} L${W * 0.86} ${y - 2}" stroke="#7a5a3a" stroke-width="1" stroke-dasharray="3 3"/>
          <path d="M${W * 0.78} ${y} q${W * 0.08} -${H * 0.06} ${W * 0.2} 0 z" fill="#f2dfb0"/>` : ""}`;
      case "alaska":
        return `<path d="M0 ${y} L${W * 0.12} ${y - H * 0.3} L${W * 0.22} ${y - H * 0.18} L${W * 0.33} ${y - H * 0.38} L${W * 0.48} ${y - H * 0.12} L${W * 0.6} ${y - H * 0.28} L${W * 0.74} ${y - H * 0.08} L${W * 0.86} ${y - H * 0.33} L${W} ${y - H * 0.15} L${W} ${y} Z" fill="#5d7a8c"/>
          <path d="M${W * 0.33} ${y - H * 0.38} L${W * 0.29} ${y - H * 0.3} L${W * 0.33} ${y - H * 0.31} L${W * 0.37} ${y - H * 0.28} Z M${W * 0.12} ${y - H * 0.3} L${W * 0.09} ${y - H * 0.24} L${W * 0.15} ${y - H * 0.25} Z M${W * 0.86} ${y - H * 0.33} L${W * 0.82} ${y - H * 0.25} L${W * 0.86} ${y - H * 0.27} L${W * 0.9} ${y - H * 0.25} Z" fill="#ffffff"/>
          <path d="M${W * 0.5} ${y} L${W * 0.55} ${y - H * 0.06} L${W * 0.66} ${y - H * 0.07} L${W * 0.7} ${y} Z" fill="#dff1fb"/>`;
      case "mediterranean":
        return `<path d="M${W * 0.55} ${y} Q${W * 0.75} ${y - H * 0.28} ${W} ${y - H * 0.22} L${W} ${y} Z" fill="#c9a77a"/>
          ${[0.66, 0.72, 0.78, 0.84, 0.9, 0.95, 0.75, 0.82, 0.88].map((x, i) => `<rect x="${W * x}" y="${y - H * (0.07 + (i > 5 ? 0.08 : 0.02 * (i % 3)))}" width="${W * 0.035}" height="${H * 0.04}" fill="#fff"/>`).join("")}
          <circle cx="${W * 0.8}" cy="${y - H * 0.16}" r="${H * 0.018}" fill="#2a5db0"/>`;
      case "northern":
        return `<path d="M0 ${y} L0 ${y - H * 0.34} Q${W * 0.15} ${y - H * 0.4} ${W * 0.28} ${y - H * 0.12} L${W * 0.3} ${y} Z" fill="#3f5d4e"/>
          <path d="M${W} ${y} L${W} ${y - H * 0.3} Q${W * 0.85} ${y - H * 0.36} ${W * 0.72} ${y - H * 0.1} L${W * 0.7} ${y} Z" fill="#4c6b59"/>
          <path d="M${W * 0.08} ${y - H * 0.3} l2 ${H * 0.22}" stroke="#e8f4ff" stroke-width="2" opacity=".8"/>`;
      case "asia":
        return [0.62, 0.66, 0.7, 0.75, 0.79, 0.84, 0.88, 0.93].map((x, i) => `<rect x="${W * x}" y="${y - H * (0.08 + ((i * 37) % 17) / 100)}" width="${W * 0.035}" height="${H * (0.08 + ((i * 37) % 17) / 100)}" fill="#3d4f74" opacity=".75"/>`).join("");
      case "canal":
        return `<path d="M0 ${y} Q${W * 0.2} ${y - H * 0.2} ${W * 0.4} ${y - H * 0.06} L${W * 0.42} ${y} Z" fill="#3e8a54"/>
          <path d="M${W} ${y} Q${W * 0.8} ${y - H * 0.22} ${W * 0.6} ${y - H * 0.05} L${W * 0.58} ${y} Z" fill="#4a9a5f"/>`;
      case "hero": case "night":
        return `<path d="M${W * 0.7} ${y} q${W * 0.08} -${H * 0.05} ${W * 0.18} 0 z" fill="#1d2b55" opacity=".7"/>${palm(W * 0.78, y - H * 0.01, H * 0.16, "#1d2b55")}`;
      default:
        return "";
    }
  }

  function palm(x, y, h, color) {
    const trunk = color || "#7a5a3a", leaf = color || "#2f9e5b";
    return `<path d="M${x} ${y} q${h * 0.08} -${h * 0.5} ${h * 0.02} -${h}" stroke="${trunk}" stroke-width="${h * 0.06}" fill="none" stroke-linecap="round"/>
      <g transform="translate(${x + h * 0.02} ${y - h})" fill="${leaf}">
        <path d="M0 0 q-${h * 0.35} -${h * 0.12} -${h * 0.5} ${h * 0.12} q${h * 0.2} -${h * 0.05} ${h * 0.5} -${h * 0.12}"/>
        <path d="M0 0 q${h * 0.35} -${h * 0.12} ${h * 0.5} ${h * 0.12} q-${h * 0.2} -${h * 0.05} -${h * 0.5} -${h * 0.12}"/>
        <path d="M0 0 q-${h * 0.2} -${h * 0.3} -${h * 0.05} -${h * 0.35} q0 ${h * 0.15} ${h * 0.05} ${h * 0.35}"/>
        <path d="M0 0 q${h * 0.25} -${h * 0.28} ${h * 0.4} -${h * 0.12} q-${h * 0.2} 0 -${h * 0.4} ${h * 0.12}"/>
      </g>`;
  }

  const DECKS = { icon: 9, oasis: 8, quantumUltra: 7, quantum: 7, freedom: 6, voyager: 6, radiance: 5, vision: 4 };

  // Stylized side profile, bow to the right. (x, y) = stern at the waterline; W = length in px.
  function shipShape(shipId, x, y, W) {
    const ship = CF.data.ship(shipId);
    const cls = ship ? ship.cls : "voyager";
    const hue = ship ? ship.hue : 210;
    const accent = `hsl(${hue} 70% 48%)`;
    const n = DECKS[cls] || 6;
    const hh = W * 0.075, dh = W * 0.024;
    let s = `<g class="ship">`;
    s += `<ellipse cx="${x + W * 0.5}" cy="${y + 2}" rx="${W * 0.52}" ry="${W * 0.012}" fill="#000" opacity=".12"/>`;
    // hull
    s += `<path d="M${x} ${y - hh} L${x + W * 0.94} ${y - hh} L${x + W} ${y - hh * 1.2} L${x + W * 0.91} ${y} L${x + W * 0.03} ${y} Z" fill="#ffffff"/>`;
    s += `<path d="M${x + W * 0.012} ${y - hh * 0.38} L${x + W * 0.935} ${y - hh * 0.38} L${x + W * 0.91} ${y} L${x + W * 0.03} ${y} Z" fill="#0b1f3f"/>`;
    s += `<path d="M${x + W * 0.02} ${y - hh * 0.5} L${x + W * 0.94} ${y - hh * 0.5}" stroke="${accent}" stroke-width="${hh * 0.09}"/>`;
    s += `<path d="M${x + W * 0.06} ${y - hh * 0.72} L${x + W * 0.88} ${y - hh * 0.72}" stroke="#7d8fa8" stroke-width="${hh * 0.07}" stroke-dasharray="${hh * 0.06} ${hh * 0.12}"/>`;
    // superstructure
    const top = y - hh - n * dh;
    for (let i = 0; i < n; i++) {
      const x1 = x + W * (0.04 + i * 0.008), x2 = x + W * (0.86 - i * (cls === "icon" ? 0.018 : 0.026));
      const yy = y - hh - (i + 1) * dh;
      if (cls === "oasis" && i >= 2) {
        const gap1 = x + W * 0.36, gap2 = x + W * 0.48;
        s += `<rect x="${x1}" y="${yy}" width="${gap1 - x1}" height="${dh + 0.5}" fill="${i % 2 ? "#eef2f7" : "#fff"}"/><rect x="${gap2}" y="${yy}" width="${x2 - gap2}" height="${dh + 0.5}" fill="${i % 2 ? "#eef2f7" : "#fff"}"/>`;
      } else {
        s += `<rect x="${x1}" y="${yy}" width="${x2 - x1}" height="${dh + 0.5}" fill="${i % 2 ? "#eef2f7" : "#fff"}"/>`;
      }
      s += `<path d="M${x1 + W * 0.01} ${yy + dh * 0.55} L${x2 - W * 0.01} ${yy + dh * 0.55}" stroke="#5f7da6" stroke-width="${dh * 0.32}" stroke-dasharray="${dh * 0.25} ${dh * 0.2}" opacity=".75"/>`;
    }
    // bridge windows at the front of the top decks
    const bx = x + W * (0.86 - (n - 1) * (cls === "icon" ? 0.018 : 0.026));
    s += `<rect x="${bx - W * 0.05}" y="${top + dh * 0.2}" width="${W * 0.05}" height="${dh * 0.6}" fill="#24395e"/>`;
    // class features
    if (cls === "icon") {
      s += `<path d="M${bx - W * 0.16} ${top} q${W * 0.07} -${dh * 3.4} ${W * 0.14} 0 z" fill="#bfe9ff" stroke="#7cc3e8" stroke-width="1"/>`;
      s += slides(x + W * 0.08, top, W, dh);
    } else if (cls === "oasis") {
      s += slides(x + W * 0.07, top, W, dh);
    } else if (cls === "quantum" || cls === "quantumUltra") {
      s += `<path d="M${x + W * 0.7} ${top} l${W * 0.05} -${dh * 2.6}" stroke="#7d8fa8" stroke-width="${dh * 0.25}"/><rect x="${x + W * 0.735}" y="${top - dh * 3.3}" width="${W * 0.035}" height="${dh * 0.9}" rx="${dh * 0.4}" fill="#bfe9ff" stroke="#7cc3e8"/>`;
      s += `<rect x="${bx - W * 0.1}" y="${top - dh * 0.8}" width="${W * 0.08}" height="${dh * 0.8}" rx="${dh * 0.3}" fill="#bfe9ff"/>`;
    } else if (cls === "radiance" || cls === "vision") {
      s += `<rect x="${x + W * 0.3}" y="${top + dh}" width="${W * 0.3}" height="${dh * (n - 2)}" fill="#a9dcf5" opacity=".75"/>`;
    }
    // funnel
    const fx = x + W * (cls === "icon" || cls === "oasis" ? 0.58 : 0.42);
    s += `<path d="M${fx} ${top} l${W * 0.012} -${dh * 2.4} l${W * 0.05} 0 l${W * 0.01} ${dh * 2.4} z" fill="#0b1f3f"/><path d="M${fx + W * 0.008} ${top - dh * 1.5} l${W * 0.064} 0" stroke="${accent}" stroke-width="${dh * 0.5}"/>`;
    if (cls === "freedom" || cls === "voyager") s += `<ellipse cx="${fx + W * 0.04}" cy="${top - dh * 0.6}" rx="${W * 0.06}" ry="${dh * 0.55}" fill="none" stroke="#bfe9ff" stroke-width="${dh * 0.45}"/>`;
    s += `</g>`;
    return s;
  }
  function slides(x, top, W, dh) {
    const c = ["#ff6b5b", "#ffc23d", "#20c7b3"];
    return c.map((col, i) => `<path d="M${x + W * (0.03 + i * 0.03)} ${top - dh * (1.8 + i * 0.5)} q${W * 0.06} ${dh * 1.2} ${W * 0.01} ${dh * 1.4} q-${W * 0.05} ${dh * 0.3} ${W * 0.02} ${dh * 0.4}" fill="none" stroke="${col}" stroke-width="${dh * 0.35}" stroke-linecap="round"/>`).join("");
  }

  // Full card or hero image: scene + optional ship. Returns an SVG string.
  function scene(kind, opts = {}) {
    const W = opts.w || 640, H = opts.h || 360;
    const k = SCENES[kind] ? kind : "ocean";
    const p = SCENES[k];
    const id = "g" + ++gid;
    const horizon = H * (opts.horizon || 0.62);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${opts.label ? CF.esc(opts.label) : "Illustration"}" class="art">`;
    s += `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient>
      <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sea[0]}"/><stop offset="1" stop-color="${p.sea[1]}"/></linearGradient></defs>`;
    s += `<rect width="${W}" height="${H}" fill="url(#${id}s)"/>`;
    const sunX = opts.sunX ?? W * 0.22, sunY = kind === "hero" ? horizon - H * 0.06 : H * 0.22;
    s += `<circle cx="${sunX}" cy="${sunY}" r="${H * (kind === "hero" ? 0.13 : 0.07)}" fill="${p.sun}" opacity="${kind === "hero" ? 0.95 : 0.85}"/>`;
    if (kind !== "hero" && kind !== "night") s += cloud(W * 0.62, H * 0.16, H * 0.05) + cloud(W * 0.35, H * 0.3, H * 0.035);
    if (kind === "night") s += Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 97) % W}" cy="${(i * 53) % (horizon * 0.8)}" r="${(i % 3) * 0.5 + 0.6}" fill="#fff" opacity=".7"/>`).join("");
    s += landscape(kind, W, H, horizon);
    s += `<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#${id}w)"/>`;
    for (let i = 0; i < 7; i++) s += `<path d="M${(i * 131) % W} ${horizon + 10 + i * ((H - horizon) / 8)} l${W * 0.08} 0" stroke="#fff" stroke-opacity=".18" stroke-width="2" stroke-linecap="round"/>`;
    if (kind === "hero") s += `<path d="M${sunX - H * 0.12} ${horizon + 8} L${sunX + H * 0.12} ${horizon + 8} M${sunX - H * 0.08} ${horizon + 20} L${sunX + H * 0.08} ${horizon + 20} M${sunX - H * 0.05} ${horizon + 32} L${sunX + H * 0.05} ${horizon + 32}" stroke="${p.sun}" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
    if (opts.ship) {
      const sw = W * (opts.shipScale || 0.62);
      const sx = opts.shipX ?? (W - sw) / 2 + W * 0.08;
      s += shipShape(opts.ship, sx, horizon + H * 0.06, sw);
    }
    s += `</svg>`;
    return s;
  }
  function cloud(x, y, r) {
    return `<g fill="#fff" opacity=".85"><circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x + r * 1.1}" cy="${y - r * 0.4}" r="${r * 1.2}"/><circle cx="${x + r * 2.3}" cy="${y}" r="${r * 0.9}"/><rect x="${x}" y="${y}" width="${r * 2.4}" height="${r * 0.8}" rx="${r * 0.4}"/></g>`;
  }

  const sceneFor = (s) => CF.data.dest(s.dest[0])?.scene || "ocean";
  const portScene = (port) => ({ glacier: "alaska", private: "island", beach: "tropical", nature: port.country === "Norway" ? "northern" : "canal", scenic: port.id === "PAN" ? "canal" : port.country === "Norway" ? "northern" : "alaska", city: ["Spain", "Italy", "France", "Greece", "Montenegro"].includes(port.country) ? "mediterranean" : ["Singapore", "Malaysia", "Thailand"].includes(port.country) ? "asia" : ["Sweden", "Finland", "Estonia", "Germany", "Denmark", "UK", "Norway"].includes(port.country) ? "northern" : "ocean" }[port.type] || "ocean");

  CF.art = {
    scene,
    sailing: (s, opts = {}) => scene(sceneFor(s), { ship: s.shipId, label: `${CF.data.ship(s.shipId).name} illustration`, ...opts }),
    ship: (shipId, opts = {}) => scene(opts.kind || "ocean", { ship: shipId, label: `${CF.data.ship(shipId).name} illustration`, shipScale: 0.74, ...opts }),
    port: (port, opts = {}) => scene(portScene(port), { label: `${port.name} illustration`, ...opts }),
    dest: (destId, opts = {}) => scene(CF.data.dest(destId)?.scene || "ocean", { label: `${CF.data.dest(destId)?.name} illustration`, ...opts }),
  };
})();
