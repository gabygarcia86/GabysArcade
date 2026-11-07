/* The sample comic: "Zara Zoom and the Runaway Robot" (a cover and three pages).
 * Built from the generators so it shows panels, art, every bubble type, SFX and a drawing layer. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const SAMPLE_ID = "cb_sample_zara";
  const doc = () => CBS.doc;

  async function build() {
    const p = CBS.createProject({ title: "Zara Zoom and the Runaway Robot", author: "Gaby's Arcade", preset: "us_comic", description: "A sample comic to explore. Click anything to see how it was made!" });
    p.id = SAMPLE_ID;
    p.sample = true;
    p.settings.margin = 30;
    p.settings.gutter = 14;
    Object.assign(p.cover, { title: "ZARA ZOOM", subtitle: "The Runaway Robot!", issue: "1", volume: "1", author: "Gaby's Arcade", artist: "Gaby's Arcade", publisher: "Gaby's Arcade Comics", price: "FREE!", template: "classic" });
    CBS.raster.reset();
    CBS.assets.resetCache();
    doc().project = p;
    const G = CBS.gen;

    const asset = (src, w, h, name, category) => {
      const a = { id: CBS.uid("as"), name, category, src, w, h };
      p.assets.push(a);
      return a;
    };
    const svgAsset = (params, name) => asset(G.svgURL(G.characterSVG(params)), 420, 600, name, "characters");
    const bgAsset = (params, name, seed = 3) => { const c = G.background(params, seed, 1500, 1000); return asset(c.toDataURL("image/jpeg", 0.88), 1500, 1000, name, "backgrounds"); };

    const ZARA = { name: "Zara", species: "human", skin: "#e0a96d", hairStyle: "ponytail", hairColor: "#1f1a17", suit: "#7c3aed", suit2: "#facc15", cape: true, capeColor: "#e63946", mask: true, emblem: "bolt", glasses: false, goggles: false, hat: "none", power: "none" };
    const BOLT = { name: "Bolt", species: "robot", suit: "#f97316", suit2: "#2563eb", cape: false, hat: "none", power: "none", emblem: "none", mask: false };
    const art = {
      zaraHero: svgAsset({ ...ZARA, pose: "hero", expression: "determined" }, "Zara (hero pose)"),
      zaraSurprised: svgAsset({ ...ZARA, pose: "stand", expression: "surprised" }, "Zara (surprised)"),
      zaraFly: svgAsset({ ...ZARA, pose: "fly", expression: "determined", power: "lightning" }, "Zara (flying)"),
      zaraHappy: svgAsset({ ...ZARA, pose: "wave", expression: "laughing" }, "Zara (waving)"),
      boltRun: svgAsset({ ...BOLT, pose: "run", expression: "happy" }, "Bolt (running)"),
      boltSad: svgAsset({ ...BOLT, pose: "stand", expression: "sad" }, "Bolt (sad)"),
      boltHappy: svgAsset({ ...BOLT, pose: "wave", expression: "happy" }, "Bolt (waving)"),
      city: bgAsset({ kind: "city", time: "day" }, "Neon Harbor (day)"),
      future: bgAsset({ kind: "city", time: "sunset", futuristic: true }, "Neon Harbor (sunset)", 9),
      night: bgAsset({ kind: "city", time: "night" }, "Neon Harbor (night)", 4),
      hq: bgAsset({ kind: "hq" }, "Zoom HQ"),
    };

    /* helpers working on a page */
    const panelsOf = (page) => page.layers.find((l) => l.type === "panel").objects;
    const layerOf = (page, type) => page.layers.find((l) => l.type === type);
    function fill(page, panel, a) {
      const k = Math.max(panel.w / a.w, panel.h / a.h);
      layerOf(page, "image").objects.push(CBS.createObject("image", { assetId: a.id, clip: panel.id, w: a.w * k, h: a.h * k, x: panel.x + panel.w / 2 - (a.w * k) / 2, y: panel.y + panel.h / 2 - (a.h * k) / 2, name: a.name }));
    }
    function figure(page, panel, a, fx, scale = 0.85, flip = false, fy = 1) {
      const hh = panel.h * scale, w = (hh * a.w) / a.h;
      layerOf(page, "image").objects.push(CBS.createObject("image", { assetId: a.id, clip: panel.id, w, h: hh, x: panel.x + panel.w * fx - w / 2, y: panel.y + panel.h * fy - hh + 4, flipX: flip, name: a.name }));
    }
    function bubble(page, panel, text, type, fx, fy, fw, tail) {
      const b = CBS.createObject("bubble", { text, x: panel.x + panel.w * fx, y: panel.y + panel.h * fy, w: panel.w * fw, h: 60 });
      CBS.lettering.applyBubbleType(b, type);
      b.fontSize = type === "shout" ? 20 : 14;
      CBS.lettering.fitBubble(b);
      if (tail) { b.tailOn = true; b.tail = { x: panel.x + panel.w * tail[0] - (b.x + b.w / 2), y: panel.y + panel.h * tail[1] - (b.y + b.h / 2) }; }
      layerOf(page, "bubble").objects.push(b);
      return b;
    }
    function sfx(page, panel, word, preset, fx, fy, fw, fh, rot) {
      const pr = Object.assign({}, CBS.lettering.SFX_PRESETS.find((s) => s.id === preset));
      delete pr.id; delete pr.label;
      layerOf(page, "text").objects.push(CBS.createObject("sfx", Object.assign(pr, { text: word, x: panel.x + panel.w * fx, y: panel.y + panel.h * fy, w: panel.w * fw, h: panel.h * fh, rot })));
    }

    // cover
    const cover = CBS.cover.createCoverPage(p, "classic");
    const artPanel = CBS.cover.artPanelOf(cover);
    fill(cover, artPanel, art.future);
    const ci = layerOf(cover, "image").objects;
    const hero = CBS.createObject("image", { assetId: art.zaraFly.id, clip: artPanel.id, coverArt: true, w: artPanel.h * 0.7 * 0.7, h: artPanel.h * 0.7, name: "Cover art" });
    hero.x = artPanel.x + artPanel.w * 0.42 - hero.w / 2; hero.y = artPanel.y + artPanel.h * 0.06;
    ci.push(hero);
    const robo = CBS.createObject("image", { assetId: art.boltRun.id, clip: artPanel.id, w: artPanel.h * 0.36 * 0.7, h: artPanel.h * 0.36, name: "Bolt" });
    robo.x = artPanel.x + artPanel.w * 0.78 - robo.w / 2; robo.y = artPanel.y + artPanel.h - robo.h - 4;
    ci.push(robo);
    p.pages.push(cover);

    // page 1
    const p1 = CBS.actions.newPageFor(p, "big-top");
    p1.name = "Morning";
    const [a1, b1, c1] = panelsOf(p1);
    fill(p1, a1, art.city);
    figure(p1, a1, art.zaraHero, 0.3, 0.8);
    bubble(p1, a1, "Neon Harbor. Another quiet morning…", "narration", 0.03, 0.04, 0.45);
    bubble(p1, a1, "Ahh, sunshine! Nothing exciting ever happens here.", "speech", 0.5, 0.12, 0.42, [0.36, 0.42]);
    fill(p1, b1, art.future);
    figure(p1, b1, art.boltRun, 0.55, 0.82);
    sfx(p1, b1, "WHOOSH!", "whoosh", 0.03, 0.06, 0.6, 0.28, -8);
    bubble(p1, b1, "Wheee! I'm FREE!", "electronic", 0.05, 0.55, 0.42, [0.5, 0.55]);
    fill(p1, c1, art.city);
    figure(p1, c1, art.zaraSurprised, 0.62, 0.86);
    bubble(p1, c1, "Was that… a robot?", "thought", 0.05, 0.08, 0.5, [0.55, 0.3]);
    p.pages.push(p1);

    // page 2: diagonal action layout
    const p2 = CBS.actions.newPageFor(p, "diag3");
    p2.name = "The chase";
    const [x1, x2, x3] = panelsOf(p2).sort((a, b) => a.y - b.y);
    fill(p2, x1, art.night);
    figure(p2, x1, art.boltRun, 0.75, 0.85, false);
    bubble(p2, x1, "Beep boop! Can't catch me!", "electronic", 0.04, 0.1, 0.36, [0.68, 0.45]);
    fill(p2, x2, art.future);
    figure(p2, x2, art.zaraFly, 0.32, 1.05, false, 1.02);
    sfx(p2, x2, "ZOOM!", "electric", 0.55, 0.2, 0.4, 0.35, -10);
    bubble(p2, x2, "STOP RIGHT THERE!", "shout", 0.56, 0.6, 0.4, [0.4, 0.5]);
    fill(p2, x3, art.night);
    figure(p2, x3, art.boltSad, 0.3, 0.85);
    figure(p2, x3, art.zaraHero, 0.72, 0.85, true);
    bubble(p2, x3, "Please don't send me back… the lab is SO boring.", "whisper", 0.04, 0.06, 0.42, [0.3, 0.35]);
    bubble(p2, x3, "Hmm. Maybe you just need a friend.", "speech", 0.54, 0.06, 0.42, [0.72, 0.32]);
    p.pages.push(p2);

    // page 3: happy ending + a drawing layer
    const p3 = CBS.actions.newPageFor(p, "four");
    p3.name = "New friends";
    const [d1, d2, d3, d4] = panelsOf(p3);
    fill(p3, d1, art.hq);
    figure(p3, d1, art.boltHappy, 0.5, 0.85);
    bubble(p3, d1, "Welcome to Zoom HQ, Bolt!", "radio", 0.04, 0.05, 0.6, [0.2, 0.9]);
    fill(p3, d2, art.hq);
    figure(p3, d2, art.zaraHappy, 0.5, 0.85);
    bubble(p3, d2, "You can be my official sidekick!", "speech", 0.06, 0.05, 0.6, [0.5, 0.4]);
    fill(p3, d3, art.future);
    figure(p3, d3, art.zaraFly, 0.3, 0.75, false, 0.85);
    figure(p3, d3, art.boltRun, 0.75, 0.55, true);
    sfx(p3, d3, "KAPOW!", "burst", 0.45, 0.04, 0.5, 0.42, 8);
    d4.fill = "#ffe14d";
    bubble(p3, d4, "And so, Neon Harbor got TWO new heroes…", "narration", 0.08, 0.1, 0.84);
    layerOf(p3, "text").objects.push(CBS.createObject("sfx", Object.assign({}, CBS.lettering.SFX_PRESETS[0], { id: undefined, label: undefined, text: "THE END", x: d4.x + d4.w * 0.08, y: d4.y + d4.h * 0.45, w: d4.w * 0.84, h: d4.h * 0.38, rot: -4, distort: "arcUp", distortAmount: 0.3 })));
    // hand-drawn sparkles on the drawing layer
    const drawLayer = layerOf(p3, "drawing");
    const r = CBS.raster.get(drawLayer.rasterId);
    const g = r.ctx, RS = CBS.RASTER_SCALE;
    g.save();
    g.scale(RS, RS);
    g.strokeStyle = "#111";
    g.lineCap = "round";
    const star = (x, y, s, c) => {
      g.fillStyle = c; g.lineWidth = 2.5;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? s * 0.42 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
    };
    star(d4.x + d4.w * 0.15, d4.y + d4.h * 0.86, 16, "#ff4fa3");
    star(d4.x + d4.w * 0.86, d4.y + d4.h * 0.4, 13, "#22d3ee");
    star(d4.x + d4.w * 0.9, d4.y + d4.h * 0.88, 10, "#fff");
    g.lineWidth = 3;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(d3.x + 12, d3.y + d3.h * (0.55 + k * 0.07)); g.lineTo(d3.x + d3.w * 0.18, d3.y + d3.h * (0.55 + k * 0.07)); g.stroke(); }
    g.restore();
    r.blank = false;
    p.pages.push(p3);

    // Fit the cover bindings now that fonts are ready, then hand the project to the app.
    CBS.cover.syncBindings(cover, p.cover);
    const data = CBS.projects.serialize(p);
    await CBS.projects.load(data);
    doc().setPage(p.pages[1].id);
    await CBS.projects.save({ quiet: true });
  }

  async function open(o = {}) {
    if (doc().project && doc().dirty) await CBS.projects.save({ quiet: true });
    const busy = CBS.ui.busy("Opening the sample comic…");
    try {
      const existing = !o.fresh && (await CBS.storage.get("projects", SAMPLE_ID).catch(() => null));
      if (existing) { busy.done(); await CBS.projects.open(SAMPLE_ID); }
      else { await build(); busy.done(); }
      CBS.ui.toast("This is the sample comic. Click anything to see how it's made. Your changes are saved, and Help › Reset sample comic starts it fresh.", { kind: "ok", ms: 6000 });
    } catch (e) {
      console.error(e);
      busy.done();
      CBS.ui.toast("Couldn't build the sample comic: " + e.message, { kind: "error" });
    }
  }

  CBS.sample = { open, build, SAMPLE_ID };
})();
