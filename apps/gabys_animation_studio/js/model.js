/* Data model: project -> frames -> layers + objects.
 *
 * project = {
 *   id, name, width, height, fps, loop, speed,
 *   bgFill:  background fill used by every frame (see render.js for the types)
 *   bgLayer: shared, paintable background layer
 *   frames:  [frame]
 *   onion:   onion skin settings
 *   assets:  { images: {id: {dataURL, img}}, audio: {id: {name, dataURL}} }
 * }
 * frame = {
 *   id, hold (how many beats the frame stays on screen),
 *   draw:    the drawing layer
 *   bgLayer: null, or this frame's own background painting
 *   bgFill:  null, or this frame's own background fill
 *   objects: stickers, images, text and effects (plain data)
 *   sound:   null or {ref: "builtin:pop" | "asset:<id>", volume: 0..1}
 *   rev:     bumps whenever anything in the frame changes (thumbnails/autosave)
 * }
 * layer = { canvas, v (version), empty } */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { makeCanvas, ctxOf, uid } = GAS;

  const Layer = {
    create(w, h) {
      return { canvas: makeCanvas(w, h, true), v: 0, empty: true };
    },
    copy(layer) {
      const l = Layer.create(layer.canvas.width, layer.canvas.height);
      if (!layer.empty) ctxOf(l.canvas).drawImage(layer.canvas, 0, 0);
      l.empty = layer.empty;
      return l;
    },
    ctx: (layer) => ctxOf(layer.canvas),
    touch(layer) {
      layer.v++;
      layer.empty = false;
    },
    clear(layer) {
      ctxOf(layer.canvas).clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.v++;
      layer.empty = true;
    },
  };

  const DEFAULT_ONION = { enabled: false, prev: 1, next: 1, opacity: 0.35, tint: true };

  function newFrame(project) {
    return {
      id: uid("f"),
      hold: 1,
      draw: Layer.create(project.width, project.height),
      bgLayer: null,
      bgFill: null,
      objects: [],
      sound: null,
      rev: 0,
    };
  }

  function cloneObjects(objs) {
    return objs.map((o) => ({ ...o, id: uid("o") }));
  }

  function cloneFrame(project, frame) {
    return {
      id: uid("f"),
      hold: frame.hold,
      draw: Layer.copy(frame.draw),
      bgLayer: frame.bgLayer ? Layer.copy(frame.bgLayer) : null,
      bgFill: frame.bgFill ? { ...frame.bgFill } : null,
      objects: cloneObjects(frame.objects),
      sound: frame.sound ? { ...frame.sound } : null,
      rev: 0,
    };
  }

  function newProject(opts = {}) {
    const width = opts.width || 640;
    const height = opts.height || 480;
    const p = {
      id: uid("p"),
      name: opts.name || "My Animation",
      width,
      height,
      fps: opts.fps || 8,
      loop: true,
      speed: 1,
      bgFill: opts.bgFill || { type: "color", color: "#ffffff" },
      bgLayer: Layer.create(width, height),
      frames: [],
      onion: { ...DEFAULT_ONION, ...(opts.onion || {}) },
      assets: { images: {}, audio: {} },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const count = opts.frames || 1;
    for (let i = 0; i < count; i++) p.frames.push(newFrame(p));
    return p;
  }

  const frameBgFill = (project, frame) => (frame && frame.bgFill) || project.bgFill;
  const frameBgLayer = (project, frame) => (frame && frame.bgLayer) || project.bgLayer;

  /* Rough memory estimate in bytes, for "your project is getting big" warnings. */
  function estimateBytes(project) {
    const px = project.width * project.height * 4;
    let layers = 1;
    for (const f of project.frames) layers += 1 + (f.bgLayer ? 1 : 0);
    return layers * px;
  }

  /* ---------- object factories ---------- */
  function baseObject(type, props) {
    return {
      id: uid("o"),
      type,
      x: 0, y: 0, w: 100, h: 100,
      rot: 0, flipX: false, flipY: false, opacity: 1,
      ...props,
    };
  }

  /* ---------- editor state (not saved in projects, except via project fields) ---------- */
  const state = {
    project: null,
    cur: 0,
    tool: "pencil",
    lastDrawTool: "pencil",
    activeLayer: "draw", // "draw" | "bg"
    primary: "#1d1a3a",
    secondary: "#ffd23f",
    zoom: 1,
    panX: 0,
    panY: 0,
    playing: false,
    selection: null, // {kind: "object", id} | {kind: "float"}
    float: null, // floating pixel selection, see selection.js
    tools: {
      pencil: { size: 6, opacity: 1, smoothing: 0.35 },
      brush: { size: 20, opacity: 1, hardness: 0.4, smoothing: 0.5, style: "soft" },
      eraser: { size: 28, opacity: 1, hardness: 0.9 },
      line: { size: 6, opacity: 1 },
      shape: { size: 6, opacity: 1, kind: "rect", fillMode: "outline", sides: 6 },
      fill: { tolerance: 32, opacity: 1, antialias: true },
    },
    textDefaults: {
      font: "Fredoka", size: 48, color: "#1d1a3a", bold: true, italic: false, align: "center",
      outline: true, outlineColor: "#ffffff", outlineWidth: 6, shadow: false,
    },
  };

  const curFrame = () => (state.project ? state.project.frames[state.cur] : null);
  const findFrame = (id) => (state.project ? state.project.frames.find((f) => f.id === id) : null);
  const frameIndex = (id) => (state.project ? state.project.frames.findIndex((f) => f.id === id) : -1);

  /* Call after anything in a frame changes. */
  function touchFrame(frame) {
    if (!frame) return;
    frame.rev++;
    GAS.bus.emit("frame-changed", frame);
    GAS.bus.emit("dirty");
  }

  Object.assign(GAS, {
    Layer, state, curFrame, findFrame, frameIndex, touchFrame,
    model: { newProject, newFrame, cloneFrame, cloneObjects, frameBgFill, frameBgLayer, estimateBytes, baseObject, DEFAULT_ONION },
  });
})();
