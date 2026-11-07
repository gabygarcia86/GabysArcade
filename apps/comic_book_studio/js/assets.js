/* Assets: images used by a comic.
 *   project.assets[]   { id, name, category, src (data URL), w, h, libId? }   saved inside the comic
 *   library            the user's personal library (IndexedDB), reusable across every comic
 *   samples            built-in starter art (generated characters/backgrounds + SVG props) */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { uid, bus } = CBS;

  const CATEGORIES = {
    characters: "Characters", backgrounds: "Backgrounds", environments: "Environments", props: "Props",
    vehicles: "Vehicles", effects: "Effects", misc: "Miscellaneous",
  };
  const MAX_DIM = 4096;

  /* ---------- image cache ---------- */
  const cache = new Map(); // assetId -> { img, state }
  function image(id) {
    if (!id) return null;
    const entry = cache.get(id);
    if (entry) return entry.state === "ok" ? entry.img : null;
    const a = find(id);
    if (!a) return null;
    const e = { img: null, state: "loading" };
    cache.set(id, e);
    CBS.loadImage(a.src).then((img) => { e.img = img; e.state = "ok"; bus.emit("render"); bus.emit("assets:loaded", id); })
      .catch(() => { e.state = "error"; });
    return null;
  }
  async function ensureLoaded(pages) {
    const ids = new Set();
    for (const pg of pages) for (const l of pg.layers) for (const o of l.objects) if (o.kind === "image" && o.assetId) ids.add(o.assetId);
    await Promise.all([...ids].map(async (id) => {
      const e = cache.get(id);
      if (e && e.state === "ok") return;
      const a = find(id);
      if (!a) return;
      try { const img = await CBS.loadImage(a.src); cache.set(id, { img, state: "ok" }); } catch (err) { /* skip broken image */ }
    }));
  }
  function find(id) { const p = CBS.doc.project; return p ? p.assets.find((a) => a.id === id) || null : null; }
  function resetCache() { cache.clear(); }

  /* ---------- importing ---------- */
  async function svgSize(text) {
    const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
    const wm = text.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)(px)?["']/i), hm = text.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)(px)?["']/i);
    if (wm && hm) return { w: parseFloat(wm[1]), h: parseFloat(hm[1]) };
    if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
    return { w: 512, h: 512 };
  }
  /* Read an image file into { src, w, h, name }. Big raster images are scaled down to 4096px. */
  async function prepareFile(file) {
    const name = (file.name || "Image").replace(/\.[a-z0-9]+$/i, "");
    const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name || "");
    if (isSvg) {
      let text = await CBS.readFile(file, "text");
      const { w, h } = await svgSize(text);
      if (!/<svg[^>]*\swidth=/i.test(text)) text = text.replace(/<svg/i, `<svg width="${w}" height="${h}"`);
      const src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
      await CBS.loadImage(src); // validate
      return { src, w, h, name };
    }
    if (!/^image\/(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.type) && !/\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name || "")) {
      throw new Error(`"${file.name}" isn't a supported image (PNG, JPG, WEBP or SVG).`);
    }
    let src = await CBS.readFile(file);
    const img = await CBS.loadImage(src);
    let w = img.naturalWidth, h = img.naturalHeight;
    if (Math.max(w, h) > MAX_DIM) {
      const k = MAX_DIM / Math.max(w, h);
      const c = CBS.makeCanvas(w * k, h * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const keepAlpha = /png|webp|gif/i.test(file.type);
      src = c.toDataURL(keepAlpha ? "image/png" : "image/jpeg", 0.92);
      w = c.width; h = c.height;
    }
    return { src, w, h, name };
  }

  function addToProject(entry) {
    const p = CBS.doc.project;
    const dup = p.assets.find((a) => (entry.libId && a.libId === entry.libId) || a.src === entry.src);
    if (dup) return dup;
    const a = { id: uid("as"), name: entry.name || "Image", category: entry.category || "misc", src: entry.src, w: entry.w, h: entry.h };
    if (entry.libId) a.libId = entry.libId;
    p.assets.push(a);
    CBS.doc.changed("assets");
    bus.emit("assets:changed");
    return a;
  }

  /* Import image files: adds them to the comic and to the personal library. */
  async function importFiles(files, category = "misc") {
    const out = [];
    for (const f of files) {
      try {
        const prep = await prepareFile(f);
        const libEntry = await library.add({ ...prep, category });
        out.push(addToProject({ ...prep, category, libId: libEntry ? libEntry.id : undefined }));
      } catch (e) {
        CBS.ui.toast(e.message || "Could not import " + f.name, { kind: "error" });
      }
    }
    return out;
  }

  /* ---------- personal library (IndexedDB) ---------- */
  const library = {
    async list() {
      try { return (await CBS.storage.all("library")).sort((a, b) => (b.added || 0) - (a.added || 0)); } catch (e) { return []; }
    },
    async add(entry) {
      try {
        const all = await CBS.storage.all("library");
        const dup = all.find((a) => a.src === entry.src);
        if (dup) return dup;
        const item = { id: uid("lib"), name: entry.name || "Image", category: entry.category || "misc", src: entry.src, w: entry.w, h: entry.h, added: Date.now() };
        await CBS.storage.put("library", item);
        bus.emit("library:changed");
        return item;
      } catch (e) { return null; }
    },
    async update(id, patch) {
      const item = await CBS.storage.get("library", id);
      if (!item) return;
      Object.assign(item, patch);
      await CBS.storage.put("library", item);
      bus.emit("library:changed");
    },
    async remove(id) { await CBS.storage.del("library", id); bus.emit("library:changed"); },
  };

  /* ---------- sample art ---------- */
  const O = 'stroke="#1a1a1a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
  const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${vb.split(" ")[2]}" height="${vb.split(" ")[3]}">${body}</svg>`;
  const SVG_SAMPLES = [
    // props
    ["chest", "Treasure chest", "props", svg("0 0 240 190", `<rect x="20" y="80" width="200" height="95" rx="8" fill="#a0612b" ${O}/><path d="M20 85 Q20 20 120 20 Q220 20 220 85Z" fill="#c07a3a" ${O}/><rect x="20" y="78" width="200" height="16" fill="#f5b301" ${O}/><rect x="104" y="70" width="32" height="44" rx="6" fill="#f5b301" ${O}/><circle cx="120" cy="92" r="6" fill="#1a1a1a"/><path d="M60 22 V178 M180 22 V178" stroke="#7a4518" stroke-width="10" opacity="0.5"/><path d="M50 60 l8 -14 8 14 -8 14Z M180 46 l6 -10 6 10 -6 10Z" fill="#fff8b0"/>`)],
    ["wand", "Magic wand", "props", svg("0 0 220 220", `<path d="M40 190 L140 90" stroke="#1a1a1a" stroke-width="18" stroke-linecap="round"/><path d="M40 190 L140 90" stroke="#5b2a86" stroke-width="10" stroke-linecap="round"/><path d="M155 20 l12 26 28 3 -21 19 6 28 -25 -15 -25 15 6 -28 -21 -19 28 -3Z" fill="#facc15" ${O}/><circle cx="70" cy="60" r="6" fill="#f472b6"/><circle cx="196" cy="128" r="5" fill="#22d3ee"/><circle cx="110" cy="40" r="4" fill="#facc15"/>`)],
    ["sword", "Hero sword", "props", svg("0 0 120 300", `<path d="M60 10 L80 40 L80 200 L40 200 L40 40Z" fill="#e2e8f0" ${O}/><path d="M60 22 V196" stroke="#94a3b8" stroke-width="5"/><rect x="14" y="196" width="92" height="20" rx="8" fill="#f5b301" ${O}/><rect x="48" y="214" width="24" height="56" rx="8" fill="#7c2d12" ${O}/><circle cx="60" cy="282" r="14" fill="#f5b301" ${O}/>`)],
    ["gem", "Magic gem", "props", svg("0 0 200 180", `<path d="M50 20 H150 L190 70 L100 170 L10 70Z" fill="#22d3ee" ${O}/><path d="M10 70 H190 M50 20 L75 70 L100 170 L125 70 L150 20 M75 70 L100 20 L125 70" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round"/><path d="M60 32 l12 0 -8 20Z" fill="#fff" opacity="0.8"/>`)],
    ["pizza", "Pizza slice", "props", svg("0 0 220 220", `<path d="M20 30 Q110 0 200 30 L110 205Z" fill="#fcd34d" ${O}/><path d="M20 30 Q110 0 200 30 L195 44 Q110 16 25 44Z" fill="#d97706" ${O}/><circle cx="90" cy="70" r="15" fill="#dc2626" ${O}/><circle cx="135" cy="62" r="12" fill="#dc2626" ${O}/><circle cx="112" cy="120" r="13" fill="#dc2626" ${O}/><circle cx="80" cy="102" r="5" fill="#15803d"/><circle cx="140" cy="98" r="5" fill="#15803d"/>`)],
    ["phone", "Hero communicator", "props", svg("0 0 140 240", `<rect x="15" y="10" width="110" height="220" rx="18" fill="#1f2937" ${O}/><rect x="27" y="36" width="86" height="150" rx="6" fill="#22d3ee"/><path d="M45 120 l18 -36 10 22 12 -14 14 28" fill="none" stroke="#0e3a5c" stroke-width="6" stroke-linejoin="round"/><circle cx="70" cy="206" r="10" fill="#475569"/>`)],
    ["book", "Spell book", "props", svg("0 0 240 200", `<path d="M20 30 Q70 10 120 30 Q170 10 220 30 V180 Q170 160 120 180 Q70 160 20 180Z" fill="#7c3aed" ${O}/><path d="M120 30 V180" stroke="#1a1a1a" stroke-width="5"/><path d="M34 46 Q75 30 110 46 V160 Q75 145 34 160Z M130 46 Q165 30 206 46 V160 Q165 145 130 160Z" fill="#f5f0e1"/><path d="M60 80 l12 -20 12 20 -12 20Z" fill="#facc15" ${O}/><path d="M150 70 h40 M150 90 h36 M150 110 h40 M150 130 h28" stroke="#9ca3af" stroke-width="5" stroke-linecap="round"/>`)],
    ["key", "Golden key", "props", svg("0 0 260 120", `<circle cx="60" cy="60" r="44" fill="#f5b301" ${O}/><circle cx="60" cy="60" r="18" fill="#fff8e1" ${O}/><path d="M100 50 H240 V70 H220 V95 H200 V70 H180 V88 H160 V70 H100Z" fill="#f5b301" ${O}/>`)],
    // vehicles
    ["rocket", "Rocket", "vehicles", svg("0 0 200 320", `<path d="M100 10 Q160 70 150 200 L50 200 Q40 70 100 10Z" fill="#f1f5f9" ${O}/><path d="M50 150 L15 230 L55 210Z M150 150 L185 230 L145 210Z" fill="#e63946" ${O}/><circle cx="100" cy="110" r="26" fill="#22d3ee" ${O}/><path d="M74 60 Q100 35 126 60Z" fill="#e63946" ${O}/><path d="M65 205 Q100 320 135 205Z" fill="#fb923c" ${O}/><path d="M82 205 Q100 270 118 205Z" fill="#fde047"/>`)],
    ["car", "Cartoon car", "vehicles", svg("0 0 320 170", `<path d="M20 110 Q20 80 50 78 L90 76 L120 36 Q130 26 150 26 L220 26 Q236 26 246 40 L270 76 Q300 80 302 110 L302 128 L20 128Z" fill="#e63946" ${O}/><path d="M130 40 H170 V76 H105Z M184 40 H226 L250 76 H184Z" fill="#bae6fd" ${O}/><circle cx="80" cy="130" r="28" fill="#1f2937" ${O}/><circle cx="80" cy="130" r="10" fill="#cbd5e1"/><circle cx="244" cy="130" r="28" fill="#1f2937" ${O}/><circle cx="244" cy="130" r="10" fill="#cbd5e1"/><rect x="286" y="92" width="16" height="12" fill="#fde047" ${O}/>`)],
    ["ufo", "Flying saucer", "vehicles", svg("0 0 300 200", `<path d="M95 80 Q150 10 205 80Z" fill="#a5f3fc" ${O}/><ellipse cx="150" cy="95" rx="140" ry="36" fill="#cbd5e1" ${O}/><ellipse cx="150" cy="85" rx="70" ry="12" fill="#94a3b8"/><circle cx="60" cy="100" r="9" fill="#facc15" ${O}/><circle cx="110" cy="112" r="9" fill="#f472b6" ${O}/><circle cx="190" cy="112" r="9" fill="#4ade80" ${O}/><circle cx="240" cy="100" r="9" fill="#facc15" ${O}/><path d="M110 130 L80 196 L220 196 L190 130Z" fill="#fef08a" opacity="0.5"/>`)],
    ["balloon", "Hot-air balloon", "vehicles", svg("0 0 220 300", `<path d="M110 10 C200 10 210 110 150 180 L70 180 C10 110 20 10 110 10Z" fill="#f97316" ${O}/><path d="M110 10 C150 40 150 140 130 180 M110 10 C70 40 70 140 90 180" fill="none" stroke="#1a1a1a" stroke-width="4"/><path d="M80 180 L85 230 M140 180 L135 230" stroke="#1a1a1a" stroke-width="4"/><rect x="78" y="228" width="64" height="48" rx="6" fill="#a0612b" ${O}/>`)],
    // effects
    ["explosion", "Explosion", "effects", svg("0 0 300 300", `<path d="M150 10 L180 90 L270 50 L215 125 L295 165 L205 180 L240 270 L160 210 L120 290 L110 205 L20 240 L80 165 L5 120 L95 105 L60 25 L130 85Z" fill="#fde047" ${O}/><path d="M150 60 L168 115 L225 95 L190 140 L240 165 L180 172 L200 225 L155 190 L130 240 L125 185 L70 205 L105 160 L60 135 L115 125 L95 80 L138 110Z" fill="#fb923c"/><circle cx="150" cy="155" r="30" fill="#ef4444"/>`)],
    ["smoke", "Smoke puff", "effects", svg("0 0 280 180", `<g fill="#e5e7eb" ${O}><circle cx="70" cy="110" r="50"/><circle cx="140" cy="80" r="62"/><circle cx="210" cy="110" r="50"/><circle cx="110" cy="130" r="40"/><circle cx="175" cy="135" r="40"/></g><g fill="#e5e7eb"><circle cx="70" cy="110" r="45"/><circle cx="140" cy="80" r="57"/><circle cx="210" cy="110" r="45"/><circle cx="110" cy="130" r="35"/><circle cx="175" cy="135" r="35"/></g><path d="M100 70 q20 -20 40 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/>`)],
    ["sparkles", "Sparkles", "effects", svg("0 0 240 240", `<path d="M120 10 Q128 100 220 112 Q128 124 120 220 Q112 124 20 112 Q112 100 120 10Z" fill="#fde047" ${O}/><path d="M50 30 Q54 60 80 64 Q54 68 50 98 Q46 68 20 64 Q46 60 50 30Z" fill="#fff" ${O}/><path d="M190 160 Q193 182 214 186 Q193 190 190 212 Q187 190 166 186 Q187 182 190 160Z" fill="#a5f3fc" ${O}/>`)],
    ["bolt", "Lightning bolt", "effects", svg("0 0 160 300", `<path d="M100 5 L20 170 L75 170 L45 295 L145 115 L90 115 L130 5Z" fill="#facc15" ${O}/><path d="M98 25 L48 150" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`)],
    ["hearts", "Hearts", "effects", svg("0 0 260 200", `<path d="M90 180 C10 120 20 40 90 70 C160 40 170 120 90 180Z" fill="#f43f5e" ${O}/><path d="M200 110 C160 80 165 40 200 55 C235 40 240 80 200 110Z" fill="#fb7185" ${O}/><path d="M60 80 q10 -14 22 -6" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/>`)],
    ["impact", "Impact star", "effects", svg("0 0 260 260", `<path d="M130 0 L150 95 L250 60 L170 125 L260 170 L160 160 L190 260 L130 180 L70 260 L100 160 L0 170 L90 125 L10 60 L110 95Z" fill="#fff" ${O}/><path d="M130 60 L142 112 L195 95 L155 130 L200 160 L148 152 L160 205 L130 165 L100 205 L112 152 L60 160 L105 130 L65 95 L118 112Z" fill="#ef4444"/>`)],
    ["splat", "Splat", "effects", svg("0 0 260 220", `<path d="M130 30 C160 20 170 60 200 50 C240 40 240 90 215 105 C250 120 235 170 200 160 C190 200 150 210 135 180 C110 215 60 200 70 165 C20 170 15 120 50 110 C20 80 50 40 85 60 C90 30 115 20 130 30Z" fill="#a3e635" ${O}/><circle cx="235" cy="45" r="10" fill="#a3e635" ${O}/><circle cx="30" cy="190" r="12" fill="#a3e635" ${O}/><circle cx="110" cy="100" r="16" fill="#d9f99d"/>`)],
    ["marks", "Surprise marks !?", "effects", svg("0 0 200 200", `<path d="M50 20 L90 20 L80 130 L60 130Z" fill="#ef4444" ${O}/><circle cx="70" cy="165" r="16" fill="#ef4444" ${O}/><path d="M120 60 Q120 20 155 20 Q190 20 190 55 Q190 80 160 95 L158 125 L138 125 L136 85 Q165 75 165 55 Q165 42 155 42 Q145 42 144 60Z" fill="#3b82f6" ${O}/><circle cx="148" cy="160" r="15" fill="#3b82f6" ${O}/>`)],
    // environments
    ["pine", "Pine tree", "environments", svg("0 0 180 300", `<rect x="76" y="230" width="28" height="60" fill="#7c4a1d" ${O}/><path d="M90 10 L150 110 L120 110 L165 180 L130 180 L175 240 L5 240 L50 180 L15 180 L60 110 L30 110Z" fill="#16a34a" ${O}/><path d="M90 40 L60 100 M100 130 L70 180" stroke="#15803d" stroke-width="6" stroke-linecap="round"/>`)],
    ["tree", "Round tree", "environments", svg("0 0 240 300", `<path d="M100 300 L108 180 Q90 160 70 165 M140 300 L132 180 Q150 160 172 168" fill="#7c4a1d" ${O}/><rect x="100" y="170" width="40" height="125" fill="#7c4a1d" ${O}/><g fill="#22c55e" ${O}><circle cx="120" cy="80" r="65"/><circle cx="60" cy="130" r="50"/><circle cx="180" cy="130" r="50"/></g><g fill="#22c55e"><circle cx="120" cy="80" r="60"/><circle cx="60" cy="130" r="45"/><circle cx="180" cy="130" r="45"/><circle cx="120" cy="140" r="50"/></g><circle cx="90" cy="60" r="14" fill="#86efac"/>`)],
    ["house", "House", "environments", svg("0 0 260 240", `<path d="M20 110 L130 20 L240 110Z" fill="#dc2626" ${O}/><rect x="40" y="105" width="180" height="125" fill="#fde68a" ${O}/><rect x="108" y="150" width="44" height="80" rx="4" fill="#7c4a1d" ${O}/><rect x="58" y="130" width="36" height="36" fill="#bae6fd" ${O}/><rect x="166" y="130" width="36" height="36" fill="#bae6fd" ${O}/><rect x="180" y="35" width="24" height="50" fill="#9ca3af" ${O}/>`)],
    ["skyscraper", "Skyscraper", "environments", svg("0 0 140 340", `<rect x="20" y="40" width="100" height="295" fill="#64748b" ${O}/><rect x="45" y="10" width="50" height="34" fill="#475569" ${O}/><path d="M70 10 V-20" stroke="#1a1a1a" stroke-width="4"/>${Array.from({ length: 12 }, (_, r) => [0, 1, 2].map((c) => `<rect x="${32 + c * 28}" y="${56 + r * 23}" width="18" height="14" fill="${(r * 3 + c) % 4 === 0 ? "#fde047" : "#bae6fd"}"/>`).join("")).join("")}`)],
    ["cloud", "Cloud", "environments", svg("0 0 280 160", `<g fill="#fff" ${O}><circle cx="80" cy="95" r="45"/><circle cx="140" cy="70" r="55"/><circle cx="205" cy="95" r="45"/></g><g fill="#fff"><circle cx="80" cy="95" r="40"/><circle cx="140" cy="70" r="50"/><circle cx="205" cy="95" r="40"/><rect x="80" y="95" width="125" height="40"/></g><path d="M40 135 H245" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"/>`)],
    ["rock", "Boulder", "environments", svg("0 0 240 160", `<path d="M20 150 L35 80 L80 30 L150 20 L205 60 L225 150Z" fill="#9ca3af" ${O}/><path d="M80 30 L100 80 L150 20 M100 80 L35 80 M100 80 L160 100 L205 60 M160 100 L170 150" fill="none" stroke="#6b7280" stroke-width="4"/>`)],
    ["lamp", "Street lamp", "environments", svg("0 0 140 340", `<rect x="60" y="80" width="18" height="250" fill="#334155" ${O}/><rect x="40" y="318" width="60" height="16" rx="4" fill="#334155" ${O}/><path d="M35 80 L105 80 L90 30 L50 30Z" fill="#475569" ${O}/><rect x="52" y="44" width="36" height="30" fill="#fde047"/><circle cx="70" cy="60" r="60" fill="#fde047" opacity="0.18"/>`)],
    ["wall", "Brick wall", "environments", svg("0 0 300 160", `<rect x="5" y="5" width="290" height="150" fill="#b45309" ${O}/>${Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => `<rect x="${5 + c * 50 + (r % 2 ? -25 : 0)}" y="${5 + r * 30}" width="50" height="30" fill="none" stroke="#7c2d12" stroke-width="4"/>`).join("")).join("")}`)],
  ];
  const CHAR_SAMPLES = [
    ["hero-girl", "Hero (cape & mask)", { name: "Zara", species: "human", skin: "#e0a96d", hairStyle: "ponytail", hairColor: "#1f1a17", suit: "#7c3aed", suit2: "#facc15", cape: true, capeColor: "#e63946", mask: true, emblem: "bolt", expression: "determined", pose: "hero" }],
    ["hero-boy", "Hero (flying)", { name: "Kai", species: "human", skin: "#f9d4b4", hairStyle: "spiky", hairColor: "#f2c94c", suit: "#2563eb", suit2: "#e63946", cape: true, capeColor: "#e63946", mask: false, emblem: "star", expression: "happy", pose: "fly" }],
    ["kid", "Kid (waving)", { name: "Milo", species: "human", skin: "#8d5524", hairStyle: "curly", hairColor: "#1f1a17", suit: "#16a34a", suit2: "#f8fafc", cape: false, mask: false, emblem: "none", expression: "laughing", pose: "wave", hat: "cap" }],
    ["robot", "Robot buddy", { name: "Bolt", species: "robot", suit: "#f97316", suit2: "#2563eb", cape: false, expression: "happy", pose: "wave" }],
    ["cat", "Super cat", { name: "Mittens", species: "cat", skin: "#f59e0b", suit: "#e63946", suit2: "#facc15", cape: true, capeColor: "#2563eb", mask: true, emblem: "heart", expression: "determined", pose: "punch" }],
    ["alien", "Friendly alien", { name: "Zib", species: "alien", suit: "#8b5cf6", suit2: "#22d3ee", cape: false, emblem: "star", expression: "surprised", pose: "stand" }],
    ["villain", "Villain", { name: "Dread", species: "human", skin: "#c9d3df", hairStyle: "bald", hairColor: "#1f1a17", suit: "#1f2937", suit2: "#16a34a", cape: true, capeColor: "#4c1d95", mask: true, emblem: "letter", expression: "angry", pose: "hero", power: "magic" }],
    ["monster", "Silly monster", { name: "Grub", species: "monster", suit: "#16a34a", suit2: "#facc15", cape: false, expression: "angry", pose: "punch" }],
    ["wizard", "Young wizard", { name: "Lyra", species: "human", skin: "#f1c27d", hairStyle: "long", hairColor: "#b5361b", suit: "#2563eb", suit2: "#facc15", cape: true, capeColor: "#1e3a8a", hat: "wizard", emblem: "star", expression: "happy", pose: "wave", power: "magic" }],
  ];
  const BG_SAMPLES = [
    ["bg-city", "City (day)", { kind: "city", time: "day" }], ["bg-city-night", "City (night)", { kind: "city", time: "night" }],
    ["bg-future", "Futuristic city", { kind: "city", time: "sunset", futuristic: true }], ["bg-space", "Outer space", { kind: "space", time: "night" }],
    ["bg-alien", "Alien planet", { kind: "alien", time: "day" }], ["bg-haunted", "Haunted mansion", { kind: "haunted", time: "night" }],
    ["bg-castle", "Medieval castle", { kind: "castle", time: "day" }], ["bg-hq", "Superhero HQ", { kind: "hq" }],
    ["bg-forest", "Forest", { kind: "forest", time: "day" }], ["bg-beach", "Beach", { kind: "ocean", time: "sunset" }],
    ["bg-desert", "Desert", { kind: "desert", time: "day" }], ["bg-mountains", "Snowy mountains", { kind: "mountains", time: "day", weather: "snow" }],
    ["bg-underwater", "Underwater", { kind: "underwater" }], ["bg-room", "Bedroom", { kind: "room", time: "day" }],
  ];

  const sampleList = [
    ...CHAR_SAMPLES.map(([id, name, params]) => ({ id: "sample:" + id, name, category: "characters", kind: "char", params })),
    ...BG_SAMPLES.map(([id, name, params]) => ({ id: "sample:" + id, name, category: "backgrounds", kind: "bg", params })),
    ...SVG_SAMPLES.map(([id, name, category, text]) => ({ id: "sample:" + id, name, category, kind: "svg", text })),
  ];
  const sampleSrc = new Map();
  async function sampleData(s) {
    if (sampleSrc.has(s.id)) return sampleSrc.get(s.id);
    let out;
    if (s.kind === "svg") {
      const vb = s.text.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);
      out = { src: CBS.gen.svgURL(s.text), w: vb ? +vb[1] : 300, h: vb ? +vb[2] : 300 };
    } else if (s.kind === "char") {
      out = { src: CBS.gen.svgURL(CBS.gen.characterSVG(s.params)), w: 420, h: 600 };
    } else {
      const c = CBS.gen.background(s.params, 7, 1500, 1000);
      out = { src: c.toDataURL("image/jpeg", 0.9), w: 1500, h: 1000 };
    }
    sampleSrc.set(s.id, out);
    return out;
  }
  async function addSample(sampleId) {
    const s = sampleList.find((x) => x.id === sampleId);
    if (!s) return null;
    const d = await sampleData(s);
    return addToProject({ ...d, name: s.name, category: s.category, libId: s.id });
  }

  /* ---------- placing images on the page ---------- */
  /* Fit an asset into the target panel (or a sensible page area) and add it as an image object. */
  function placeAsset(asset, opts = {}) {
    const doc = CBS.doc;
    const page = doc.page;
    const size = doc.size;
    let panel = opts.panel || null;
    if (!panel && opts.at) {
      const hit = CBS.editor ? CBS.editor.panelAt(opts.at.x, opts.at.y) : null;
      if (hit) panel = hit;
    }
    let w, h, x, y;
    const ar = (asset.w || 1) / (asset.h || 1);
    if (panel) {
      const bb = CBS.render.aabb(panel);
      const cover = asset.category === "backgrounds" || opts.cover;
      const k = cover ? Math.max(bb.w / (asset.w || 1), bb.h / (asset.h || 1)) : Math.min(bb.w / (asset.w || 1), bb.h / (asset.h || 1)) * 0.85;
      w = (asset.w || 100) * k; h = (asset.h || 100) * k;
      x = bb.x + bb.w / 2 - w / 2;
      y = cover ? bb.y + bb.h / 2 - h / 2 : bb.y + bb.h - h - (panel.borderWidth || 0);
    } else {
      const maxW = size.w * (asset.category === "backgrounds" ? 1 : 0.45), maxH = size.h * (asset.category === "backgrounds" ? 1 : 0.45);
      const k = Math.min(maxW / (asset.w || 1), maxH / (asset.h || 1), asset.category === "backgrounds" ? 99 : 1.5);
      w = (asset.w || 100) * k; h = w / ar;
      const c = opts.at || { x: size.w / 2, y: size.h / 2 };
      x = c.x - w / 2; y = c.y - h / 2;
    }
    const layer = asset.category === "backgrounds" && !panel
      ? page.layers.find((l) => l.type === "background" && !l.locked) || doc.targetLayerFor("image")
      : doc.targetLayerFor("image");
    const obj = CBS.createObject("image", { assetId: asset.id, x, y, w, h, name: asset.name, clip: panel ? panel.id : null });
    doc.edit("Add image", () => doc.addObject(obj, layer));
    doc.select(obj.id);
    return obj;
  }

  CBS.assets = {
    CATEGORIES, image, ensureLoaded, find, resetCache, prepareFile, addToProject, importFiles, library,
    samples: sampleList, sampleData, addSample, placeAsset,
  };
})();
