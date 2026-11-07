/* Comic Book Studio - project data model and the document controller (CBS.doc).
 *
 * Units: page coordinates are "doc units", 100 per inch. A US comic page is 663 x 1025.
 * Every object has x, y, w, h (unrotated box, top-left) and rot (degrees, around the box center).
 *
 * project = { id, title, author, description, pageSize:{preset,w,h,orientation}, settings, cover, pages[], assets[] }
 * page    = { id, name, isCover, background, layers[] (bottom -> top), guides:{v[],h[]} }
 * layer   = { id, name, type, visible, locked, opacity, group, objects[], rasterId? }
 */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { uid, bus } = CBS;

  const DOC_DPI = 100;
  const RASTER_SCALE = 2; // drawing layers are stored at 200 DPI

  const PAGE_SIZES = {
    us_comic: { name: "Standard US Comic Book", w: 6.625, h: 10.25, note: "6.625 × 10.25 in" },
    manga: { name: "Manga Page", w: 5.04, h: 7.17, note: "128 × 182 mm (B6 tankōbon)" },
    a4: { name: "A4", w: 8.27, h: 11.69, note: "210 × 297 mm" },
    letter: { name: "US Letter", w: 8.5, h: 11, note: "8.5 × 11 in" },
    square: { name: "Square Comic", w: 8, h: 8, note: "8 × 8 in" },
    webtoon: { name: "Webcomic Strip", w: 10, h: 3.4, note: "10 × 3.4 in, a wide strip" },
    custom: { name: "Custom Dimensions", w: 7, h: 10, note: "Your own size" },
  };

  const FONTS = [
    { id: "Comic Neue", label: "Comic Neue · dialogue", group: "Lettering" },
    { id: "Patrick Hand", label: "Patrick Hand · handwritten", group: "Lettering" },
    { id: "Kalam", label: "Kalam · hand-lettered", group: "Lettering" },
    { id: "Special Elite", label: "Special Elite · typewriter", group: "Lettering" },
    { id: "Bangers", label: "Bangers · action", group: "Display" },
    { id: "Luckiest Guy", label: "Luckiest Guy · bold fun", group: "Display" },
    { id: "Bungee", label: "Bungee · blocky", group: "Display" },
    { id: "Permanent Marker", label: "Permanent Marker · marker", group: "Display" },
    { id: "Creepster", label: "Creepster · spooky", group: "Display" },
    { id: "Fredoka", label: "Fredoka · rounded", group: "Display" },
    { id: "Arial", label: "Arial", group: "System" },
    { id: "Georgia", label: "Georgia", group: "System" },
    { id: "Courier New", label: "Courier New", group: "System" },
    { id: "Impact", label: "Impact", group: "System" },
  ];
  const fontStack = (id) => `"${id}", "Comic Neue", "Comic Sans MS", system-ui, sans-serif`;

  const LAYER_TYPES = {
    background: { label: "Background", icon: "🖼️", order: 0, raster: false },
    panel: { label: "Panels", icon: "▦", order: 1, raster: false },
    image: { label: "Artwork", icon: "🏞️", order: 2, raster: false },
    drawing: { label: "Drawing", icon: "✏️", order: 3, raster: true },
    effects: { label: "Effects & Shapes", icon: "✨", order: 4, raster: false },
    bubble: { label: "Speech Bubbles", icon: "💬", order: 5, raster: false },
    text: { label: "Lettering", icon: "🔤", order: 6, raster: false },
  };
  /* Which layer type an object goes to by default. */
  const PREFERRED_LAYER = { panel: "panel", image: "image", bubble: "bubble", text: "text", sfx: "text", shape: "effects" };

  const OBJECT_LABELS = { panel: "Panel", image: "Image", bubble: "Speech Bubble", text: "Text", sfx: "Sound Effect", shape: "Shape" };

  function pageDims(presetKey, orientation, custom) {
    const p = PAGE_SIZES[presetKey] || PAGE_SIZES.us_comic;
    let w = presetKey === "custom" && custom ? custom.w : p.w;
    let h = presetKey === "custom" && custom ? custom.h : p.h;
    w = Math.round(w * DOC_DPI);
    h = Math.round(h * DOC_DPI);
    const landscape = orientation === "landscape";
    if ((landscape && h > w) || (!landscape && w > h)) [w, h] = [h, w];
    return { w, h };
  }

  function createLayer(type, name) {
    const layer = {
      id: uid("ly"),
      name: name || LAYER_TYPES[type].label,
      type,
      visible: true,
      locked: false,
      opacity: 1,
      group: null,
      objects: [],
    };
    if (type === "drawing") layer.rasterId = uid("rs");
    return layer;
  }

  function createPage(opts = {}) {
    const layers = opts.layers || [
      createLayer("background"),
      createLayer("panel"),
      createLayer("image"),
      createLayer("drawing", "Ink & Color"),
      createLayer("bubble"),
      createLayer("text"),
    ];
    return {
      id: uid("pg"),
      name: opts.name || "",
      isCover: !!opts.isCover,
      background: opts.background || "#ffffff",
      layers,
      guides: { v: [], h: [] },
    };
  }

  function createProject(opts = {}) {
    const dims = pageDims(opts.preset || "us_comic", opts.orientation || "portrait", opts.custom);
    const now = Date.now();
    return {
      id: uid("cb"),
      format: "comic-book-studio",
      version: 1,
      title: opts.title || "Untitled Comic",
      author: opts.author || "",
      description: opts.description || "",
      created: now,
      modified: now,
      pageSize: { preset: opts.preset || "us_comic", orientation: opts.orientation || "portrait", w: dims.w, h: dims.h },
      settings: { gutter: 14, margin: 30, includeCover: true },
      cover: {
        title: opts.title || "Untitled Comic", issue: "1", volume: "1", author: opts.author || "", artist: opts.author || "",
        publisher: "Gaby's Arcade Comics", subtitle: "", price: "$3.99", template: "classic",
      },
      pages: [],
      assets: [],
    };
  }

  /* ---------- object factories ---------- */
  const DEFAULTS = {
    panel: { shape: "rect", pts: null, radius: 0, borderWidth: 4, borderColor: "#111111", fill: "#ffffff" },
    image: {
      assetId: null, crop: { l: 0, t: 0, r: 0, b: 0 }, clip: null, effect: "none",
      filters: { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0, invert: 0 },
    },
    bubble: {
      type: "speech", text: "Hello!", font: "Comic Neue", fontSize: 17, bold: true, italic: false, uppercase: true,
      color: "#111111", align: "center", lineHeight: 1.15, letterSpacing: 0, fill: "#ffffff", stroke: "#111111",
      strokeWidth: 2.5, tailOn: true, tail: { x: -40, y: 90 }, tailWidth: 0.28, tailCurve: 0.35, shape: "ellipse",
      tailStyle: "curved", dash: "solid", radius: 18, padding: 10, autoGrow: true,
    },
    text: {
      text: "Your text here", font: "Comic Neue", fontSize: 22, bold: false, italic: false, uppercase: false, color: "#111111",
      align: "left", lineHeight: 1.2, letterSpacing: 0, outlineColor: "#ffffff", outlineWidth: 0, shadow: false,
      shadowColor: "#000000", bg: "", padding: 4,
    },
    sfx: {
      text: "POW!", font: "Bangers", fill: "#ffe14d", fill2: "#ff5a1f", gradient: true, outlineColor: "#111111",
      outlineWidth: 5, shadow: true, shadowColor: "#000000", extrude: 7, extrudeAngle: 135, extrudeColor: "#b3261e",
      distort: "none", distortAmount: 0.5, burst: false, burstColor: "#ffffff", burstStroke: "#111111",
      letterSpacing: 0.02, skew: -8,
    },
    shape: {
      shape: "rect", pts: null, fill: "#ffd43b", fillOn: true, stroke: "#111111", strokeWidth: 3, dash: "solid",
      radius: 0, sides: 5, innerRatio: 0.45,
    },
  };

  function createObject(kind, props = {}) {
    const base = { id: uid("ob"), kind, name: "", x: 0, y: 0, w: 100, h: 100, rot: 0, opacity: 1, flipX: false, flipY: false, locked: false };
    const o = Object.assign(base, CBS.deepClone(DEFAULTS[kind] || {}), CBS.deepClone(props));
    if (!o.id || props.id === undefined) o.id = uid("ob");
    return o;
  }

  function objectLabel(o) {
    if (o.name) return o.name;
    if (o.kind === "bubble" || o.kind === "text" || o.kind === "sfx") {
      const t = (o.text || "").replace(/\s+/g, " ").trim();
      if (t) return (o.kind === "sfx" ? "💥 " : "") + (t.length > 22 ? t.slice(0, 22) + "…" : t);
    }
    if (o.kind === "shape") return (o.shape || "shape").replace(/^./, (c) => c.toUpperCase());
    return OBJECT_LABELS[o.kind] || "Object";
  }

  /* ---------- document controller ---------- */
  const doc = {
    project: null,
    pageId: null,
    activeLayers: {}, // pageId -> layerId
    selection: [],
    dirty: false,

    get page() {
      const p = this.project;
      if (!p) return null;
      return p.pages.find((pg) => pg.id === this.pageId) || p.pages[0] || null;
    },
    get pageIndex() { return this.project ? this.project.pages.indexOf(this.page) : -1; },
    get size() { return this.project ? this.project.pageSize : { w: 663, h: 1025 }; },

    load(project) {
      this.project = project;
      this.activeLayers = {};
      this.selection = [];
      this.pageId = project.pages[0] ? project.pages[0].id : null;
      this.dirty = false;
      bus.emit("doc:loaded", project);
      bus.emit("page:changed");
    },

    setPage(id) {
      if (!this.project || id === this.pageId) return;
      if (!this.project.pages.some((p) => p.id === id)) return;
      this.pageId = id;
      this.selection = [];
      bus.emit("page:changed");
      bus.emit("selection:changed");
    },
    gotoIndex(i) {
      const pages = this.project.pages;
      if (!pages.length) return;
      this.setPage(pages[CBS.clamp(i, 0, pages.length - 1)].id);
    },

    /* Layers */
    layer(id, page = this.page) { return page ? page.layers.find((l) => l.id === id) || null : null; },
    get activeLayer() {
      const page = this.page;
      if (!page) return null;
      let l = this.layer(this.activeLayers[page.id], page);
      if (!l) {
        l = [...page.layers].reverse().find((x) => x.type === "drawing") || page.layers[page.layers.length - 1] || null;
        if (l) this.activeLayers[page.id] = l.id;
      }
      return l;
    },
    setActiveLayer(id) {
      const page = this.page;
      if (!page || !this.layer(id)) return;
      this.activeLayers[page.id] = id;
      bus.emit("layer:active");
    },
    layerOf(objId, page = this.page) {
      if (!page) return null;
      return page.layers.find((l) => l.objects.some((o) => o.id === objId)) || null;
    },
    /* Insert a new layer of `type` at the conventional position (or just above `above`). */
    insertLayer(layer, page = this.page, above = null) {
      let idx;
      if (above) idx = page.layers.indexOf(above) + 1;
      else {
        const ord = LAYER_TYPES[layer.type].order;
        idx = 0;
        page.layers.forEach((l, i) => { if (LAYER_TYPES[l.type].order <= ord) idx = i + 1; });
      }
      page.layers.splice(idx, 0, layer);
      return layer;
    },
    /* Layer that a new object of `kind` should go to. Creates one if needed. */
    targetLayerFor(kind, page = this.page) {
      const want = PREFERRED_LAYER[kind] || "effects";
      const active = page === this.page ? this.activeLayer : null;
      if (active && !active.locked && active.type === want) return active;
      const found = [...page.layers].reverse().find((l) => l.type === want && !l.locked);
      if (found) return found;
      const created = this.insertLayer(createLayer(want), page);
      bus.emit("layers:changed");
      return created;
    },
    drawingLayer(page = this.page) {
      const active = page === this.page ? this.activeLayer : null;
      if (active && active.type === "drawing") return active;
      return [...page.layers].reverse().find((l) => l.type === "drawing" && !l.locked) || null;
    },

    /* Objects */
    find(id, page = this.page) {
      if (!page) return null;
      for (const layer of page.layers) {
        const i = layer.objects.findIndex((o) => o.id === id);
        if (i >= 0) return { obj: layer.objects[i], layer, index: i };
      }
      return null;
    },
    obj(id, page = this.page) { const f = this.find(id, page); return f ? f.obj : null; },
    allObjects(page = this.page) {
      const out = [];
      if (page) for (const layer of page.layers) for (const o of layer.objects) out.push({ obj: o, layer });
      return out;
    },
    panels(page = this.page) { return this.allObjects(page).filter((e) => e.obj.kind === "panel").map((e) => e.obj); },
    selected() { return this.selection.map((id) => this.obj(id)).filter(Boolean); },
    select(ids, opts = {}) {
      ids = (Array.isArray(ids) ? ids : ids ? [ids] : []).filter((id) => this.obj(id));
      if (opts.toggle) {
        const set = new Set(this.selection);
        for (const id of ids) set.has(id) ? set.delete(id) : set.add(id);
        this.selection = [...set];
      } else if (opts.add) this.selection = [...new Set([...this.selection, ...ids])];
      else this.selection = ids;
      if (this.selection.length === 1 && !opts.keepLayer) {
        const l = this.layerOf(this.selection[0]);
        if (l && this.activeLayers[this.page.id] !== l.id) { this.activeLayers[this.page.id] = l.id; bus.emit("layer:active"); }
      }
      bus.emit("selection:changed");
    },
    addObject(obj, layer = null, page = this.page) {
      layer = layer || this.targetLayerFor(obj.kind, page);
      layer.objects.push(obj);
      return obj;
    },
    removeObjects(ids, page = this.page) {
      const set = new Set(ids);
      for (const layer of page.layers) layer.objects = layer.objects.filter((o) => !set.has(o.id));
      // images that were clipped by a removed panel become unclipped
      for (const layer of page.layers) for (const o of layer.objects) if (o.clip && set.has(o.clip)) o.clip = null;
      this.selection = this.selection.filter((id) => !set.has(id));
    },

    /* Mutation helper: wraps fn in an undo step and broadcasts the change. */
    edit(label, fn, scope = "page") {
      CBS.history.begin(scope);
      let r;
      try { r = fn(); } finally { CBS.history.end(label); }
      this.changed(scope === "doc" ? "doc" : "page");
      return r;
    },
    changed(what = "page") {
      if (!this.project) return;
      this.dirty = true;
      this.project.modified = Date.now();
      bus.emit("doc:changed", what);
    },
  };

  Object.assign(CBS, {
    DOC_DPI, RASTER_SCALE, PAGE_SIZES, FONTS, fontStack, LAYER_TYPES, PREFERRED_LAYER, OBJECT_LABELS, DEFAULTS,
    pageDims, createLayer, createPage, createProject, createObject, objectLabel, doc,
  });
})();
