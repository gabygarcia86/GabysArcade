// Everything on screen around the viewport: toolbars, panels, the bottom dock and dialogs.
import { BRUSHES, FALLOFFS } from "./brushes.js";
import { FORMATS, downloadModel } from "./exporter.js";
import { SHAPES } from "./geometry.js";
import { icon } from "./icons.js";
import { PRESETS } from "./materials.js";
import { FUN_PARTS, TEMPLATES } from "./templates.js";
import { CHALLENGES, TUTORIALS } from "./tutorials.js";

const TOOL_GROUPS = [
  { title: "Move", tools: [
    { id: "select", label: "Move", icon: "move", color: "#45b7ff", tip: "Pick things, then move, turn or resize them." },
  ] },
  { title: "Sculpt", tools: [
    { id: "draw", label: "Add Clay", icon: "draw", color: "#7ed957", tip: "Draw: push clay out of the surface. Hold Ctrl to dig instead." },
    { id: "remove", label: "Remove", icon: "remove", color: "#ff7a59", tip: "Sculpt: press clay in to make dents and holes." },
    { id: "inflate", label: "Inflate", icon: "inflate", color: "#ffc53d", tip: "Blow up the surface like a balloon." },
    { id: "strips", label: "Strips", icon: "strips", color: "#c98bff", tip: "Clay Strips: lay flat strips of new clay." },
  ] },
  { title: "Tidy", tools: [
    { id: "smooth", label: "Smooth", icon: "smooth", color: "#5be0d0", tip: "Rub away bumps. Hold Shift with any brush to smooth." },
    { id: "flatten", label: "Flatten", icon: "flatten", color: "#6d9dff", tip: "Press the surface flat." },
    { id: "scrape", label: "Scrape", icon: "scrape", color: "#ff9d5c", tip: "Shave off the high spots, a little at a time." },
  ] },
  { title: "Details", tools: [
    { id: "grab", label: "Grab", icon: "grab", color: "#ff6fb1", tip: "Grab the clay and pull it somewhere new." },
    { id: "pinch", label: "Pinch", icon: "pinch", color: "#a4e23c", tip: "Squeeze clay together to make sharp edges." },
    { id: "crease", label: "Crease", icon: "crease", color: "#ff5d6c", tip: "Carve grooves and thin lines." },
  ] },
  { title: "Color", tools: [
    { id: "paint", label: "Paint", icon: "paint", color: "#ff5da8", tip: "Paint right onto your model." },
    { id: "erase", label: "Erase", icon: "erase", color: "#b6bfd6", tip: "Erase paint to get the clay color back." },
  ] },
];

const PALETTE = [
  "#ff4d5e", "#ff7a2f", "#ffb02e", "#ffe14d", "#a4e23c", "#3fcf6f", "#14b8a6", "#45b7ff",
  "#2d6cff", "#7a5cff", "#b14dff", "#ff5da8", "#ffc9a3", "#b77a45", "#6d4a2b", "#ffffff",
  "#c9d4e4", "#8a94a8", "#4a5268", "#15131f",
];

const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "html") el.innerHTML = value;
    else if (key === "tip") el.dataset.tip = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && key !== "list") el[key] = value;
    else el.setAttribute(key, value === true ? "" : value);
  }
  el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return el;
};

export class UI {
  constructor(app) {
    this.app = app;
    this.dock = "shapes";
    this.pending = new Set();
    this.dialogs = [];
    this._buildTop();
    this._buildTools();
    this._buildDock();
    this._buildHud();
    this._tooltip();
    this._wire();
    this.refreshAll();
  }

  _wire() {
    const { app } = this;
    const later = (key) => () => this._schedule(key);
    app.on("tool", later("tools"));
    app.on("tool", later("props"));
    app.on("selection", later("props"));
    app.on("selection", later("list"));
    app.on("objects", later("list"));
    app.on("objects", later("empty"));
    app.on("symmetry", later("symmetry"));
    app.on("gizmo", later("props"));
    app.on("transform", later("transform"));
    app.on("stats", later("stats"));
    app.on("history", (message) => {
      this._schedule("history");
      if (message) this.toast(message);
    });
    app.on("project", later("project"));
    app.on("camera", later("dock"));
    app.on("placing", (label) => this._showPlacing(label));
    app.on("autosave-failed", () => this.toast("Autosave couldn't run. Use Save to keep a copy.", "warn"));
  }

  _schedule(key) {
    this.pending.add(key);
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      const keys = [...this.pending];
      this.pending.clear();
      for (const k of keys) this._refresh(k);
    });
  }

  _refresh(key) {
    if (key === "tools") this._markTool();
    else if (key === "props") this._renderProps();
    else if (key === "list") this._renderList();
    else if (key === "symmetry") this._markSymmetry();
    else if (key === "transform") this._syncTransform();
    else if (key === "stats") this._renderStats();
    else if (key === "history") this._markHistory();
    else if (key === "project") this._renderProject();
    else if (key === "dock") this._renderDock();
    else if (key === "empty") this._markEmpty();
  }

  refreshAll() {
    for (const key of ["tools", "props", "list", "stats", "history", "project", "dock", "empty"]) this._refresh(key);
  }

  // ---- Top bar -------------------------------------------------------------------------

  _buildTop() {
    const { app } = this;
    const button = (id, label, iconName, tip, run, cls = "") =>
      h("button", { class: `top-btn ${cls}`, type: "button", id, tip, "aria-label": label, onclick: run, html: `${icon(iconName, 20)}<span>${label}</span>` });

    this.nameInput = h("input", {
      class: "project-name", id: "project-name", type: "text", maxLength: 60, "aria-label": "Project name", spellcheck: false,
      onchange: (e) => app.project.setName(e.target.value),
      onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); },
    });
    this.saveState = h("span", { class: "save-state", role: "status" });
    this.undoBtn = button("btn-undo", "Undo", "undo", "Undo your last step (Ctrl+Z)", () => app.history.undo(), "is-key");
    this.redoBtn = button("btn-redo", "Redo", "redo", "Bring it back (Ctrl+Y)", () => app.history.redo(), "is-key");

    const more = h("div", { class: "top-more", id: "top-more" },
      button("btn-new", "New", "sparkle", "Start a new creation", () => this.showStarter()),
      button("btn-open", "Open", "open", "Open a saved creation", () => this.showProjects()),
      button("btn-save", "Save", "save", "Save a project file (Ctrl+S)", () => this.saveProject()),
      button("btn-export", "Export", "export", "Export a 3D model file", () => this.showExport()),
      button("btn-shot", "Picture", "camera", "Save a picture of your scene", () => app.screenshot()),
      button("btn-settings", "Settings", "settings", "Change how the studio looks and runs", () => this.showSettings()),
      button("btn-help", "Help", "help", "Tutorials, challenges and controls", () => this.showHelp()),
    );
    const menu = h("button", {
      class: "top-btn top-menu", type: "button", "aria-label": "More actions", "aria-expanded": "false",
      html: icon("menu", 22),
      onclick: (e) => {
        const open = more.classList.toggle("is-open");
        e.currentTarget.setAttribute("aria-expanded", String(open));
      },
    });
    more.addEventListener("click", () => more.classList.remove("is-open"));

    document.getElementById("topbar").append(
      h("a", { class: "brand", href: "../../index.html", tip: "Back to Gaby's Arcade", "aria-label": "Back to Gaby's Arcade" },
        h("img", { src: "icon/icon-128.png", alt: "", width: 40, height: 40 }),
        h("span", { class: "brand-text" }, "3D Wonder Studio")),
      h("div", { class: "project-box" }, this.nameInput, this.saveState),
      h("div", { class: "top-history" }, this.undoBtn, this.redoBtn),
      more,
      menu,
    );
  }

  _renderProject() {
    const { project } = this.app;
    if (document.activeElement !== this.nameInput) this.nameInput.value = project.name;
    this.saveState.textContent = project.dirty ? "Saving soon" : "Saved here";
    this.saveState.classList.toggle("is-dirty", project.dirty);
    document.title = "3D Wonder Studio";
  }

  _markHistory() {
    const { history } = this.app;
    this.undoBtn.disabled = !history.canUndo;
    this.redoBtn.disabled = !history.canRedo;
  }

  // ---- Left tools ----------------------------------------------------------------------

  _buildTools() {
    const root = document.getElementById("tools");
    this.toolButtons = {};
    for (const group of TOOL_GROUPS) {
      const row = h("div", { class: "tool-row" });
      for (const tool of group.tools) {
        const btn = h("button", {
          class: "tool", type: "button", tip: tool.tip, "aria-label": tool.label, style: `--tool:${tool.color}`,
          onclick: () => this.app.setTool(tool.id),
        }, h("span", { class: "tool-icon", html: icon(tool.icon, 24) }), h("span", { class: "tool-label" }, tool.label));
        btn.dataset.tool = tool.id;
        this.toolButtons[tool.id] = btn;
        row.append(btn);
      }
      root.append(h("section", { class: "tool-group" }, h("h2", {}, group.title), row));
    }
  }

  _markTool() {
    for (const [id, btn] of Object.entries(this.toolButtons)) {
      btn.classList.toggle("is-active", id === this.app.tool);
      btn.setAttribute("aria-pressed", String(id === this.app.tool));
    }
  }

  // ---- Right panel ---------------------------------------------------------------------

  _section(title, ...children) {
    return h("section", { class: "panel-section" }, h("h2", {}, title), ...children);
  }

  _slider({ label, min, max, step, value, unit = "", scale = 1, onInput, onChange, tip, id }) {
    const out = h("output", {}, `${Math.round(value * scale)}${unit}`);
    const input = h("input", {
      type: "range", min, max, step, value, id, "aria-label": label,
      oninput: (e) => {
        out.textContent = `${Math.round(e.target.value * scale)}${unit}`;
        onInput?.(Number(e.target.value));
      },
      onchange: (e) => onChange?.(Number(e.target.value)),
    });
    return h("label", { class: "slider", tip }, h("span", { class: "slider-top" }, h("span", {}, label), out), input);
  }

  _toggle(label, checked, onChange, tip) {
    return h("label", { class: "switch", tip },
      h("input", { type: "checkbox", checked, onchange: (e) => onChange(e.target.checked) }),
      h("span", { class: "switch-track" }), h("span", {}, label));
  }

  _chips(options, current, pick) {
    return h("div", { class: "chips" }, options.map(([id, label]) =>
      h("button", { class: `chip ${id === current ? "is-active" : ""}`, type: "button", onclick: () => pick(id) }, label)));
  }

  _renderProps() {
    const { app } = this;
    const root = document.getElementById("props-body");
    const scrollTop = root.scrollTop;
    const sections = [];
    const painting = app.tool === "paint" || app.tool === "erase";
    if (painting) sections.push(this._paintSection());
    else if (app.tool !== "select") sections.push(this._brushSection());
    if (app.tool !== "select") sections.push(this._symmetrySection());
    if (app.tool === "select") sections.push(this._moveModeSection());
    if (app.objects.focus) sections.push(this._objectSection(app.objects.focus));
    else if (app.tool === "select") sections.push(this._section("Nothing picked", h("p", { class: "muted" }, "Tap an object to pick it, or add a shape from the bottom bar.")));
    root.replaceChildren(...sections);
    root.scrollTop = scrollTop;
  }

  _brushSection() {
    const { app } = this;
    const b = app.brush;
    const info = BRUSHES[app.tool];
    return this._section(`${info.label} brush`,
      this._slider({
        label: "Size", id: "brush-size", min: 0.03, max: 1, step: 0.005, value: b.radius, scale: 100,
        onInput: (v) => { app.setBrushRadius(v); },
      }),
      this._slider({
        label: "Strength", id: "brush-strength", min: 0.05, max: 1, step: 0.01, value: b.strength, scale: 100, unit: "%",
        onInput: (v) => { app.brush.strength = v; this._syncQuick(); },
      }),
      h("div", { class: "field" }, h("span", { class: "field-label" }, "Edge"),
        this._chips(Object.entries(FALLOFFS).map(([id, f]) => [id, f.label]), b.falloff, (id) => {
          app.brush.falloff = id;
          app.saveBrush();
          this._renderProps();
        })),
      this._toggle("Add detail as I sculpt", b.autoDetail, (on) => { b.autoDetail = on; app.saveBrush(); },
        "Adds tiny triangles under the brush so fine details stay smooth."),
      this._toggle("Only touch the front", b.frontOnly, (on) => { b.frontOnly = on; app.saveBrush(); },
        "Stops the brush from reaching through thin parts."),
      this._toggle("Use pen pressure", b.pressure, (on) => { b.pressure = on; app.saveBrush(); },
        "Press harder with a stylus for a stronger brush."),
    );
  }

  _paintSection() {
    const { app } = this;
    const p = app.paint;
    const erasing = app.tool === "erase";
    return this._section(erasing ? "Eraser" : "Paint brush",
      !erasing && h("label", { class: "color-field" },
        h("span", {}, "Paint color"),
        h("input", { type: "color", id: "paint-color", value: p.color, "aria-label": "Paint color", oninput: (e) => { app.paint.color = e.target.value; this._renderDock(); } })),
      this._slider({
        label: "Size", id: "paint-size", min: 0.01, max: 0.8, step: 0.005, value: p.radius, scale: 100,
        onInput: (v) => { app.setBrushRadius(v); },
      }),
      this._slider({
        label: "Opacity", id: "paint-opacity", min: 0.05, max: 1, step: 0.01, value: p.opacity, scale: 100, unit: "%",
        onInput: (v) => { app.paint.opacity = v; },
      }),
      this._slider({
        label: "Hard edge", id: "paint-hard", min: 0, max: 0.95, step: 0.01, value: p.hardness, scale: 100, unit: "%",
        onInput: (v) => { app.paint.hardness = v; },
      }),
    );
  }

  _symmetrySection() {
    const { app } = this;
    const s = app.symmetry;
    this.symButtons = {};
    const axis = (key) => {
      const btn = h("button", {
        class: `axis axis-${key}`, type: "button", tip: `Mirror across the ${key.toUpperCase()} axis`, "aria-label": `Mirror ${key.toUpperCase()}`,
        onclick: () => s.setAxis(key, !(s.axes[key] && s.enabled)),
      }, key.toUpperCase());
      this.symButtons[key] = btn;
      return btn;
    };
    this.symSwitch = h("input", { type: "checkbox", id: "symmetry-on", checked: s.enabled, onchange: (e) => s.setEnabled(e.target.checked) });
    const section = this._section("Mirror",
      h("label", { class: "switch", tip: "Sculpt or paint on both sides at once." }, this.symSwitch, h("span", { class: "switch-track" }), h("span", {}, "Symmetry")),
      h("div", { class: "axis-row" }, axis("x"), axis("y"), axis("z")),
    );
    queueMicrotask(() => this._markSymmetry());
    return section;
  }

  _markSymmetry() {
    const s = this.app.symmetry;
    if (!this.symButtons || !this.symSwitch) return;
    this.symSwitch.checked = s.enabled;
    for (const [key, btn] of Object.entries(this.symButtons)) {
      btn.classList.toggle("is-active", s.enabled && s.axes[key]);
      btn.setAttribute("aria-pressed", String(s.enabled && s.axes[key]));
    }
  }

  _moveModeSection() {
    const { app } = this;
    const { gizmo } = app.objects;
    return this._section("Handles",
      this._chips([["translate", "Move"], ["rotate", "Turn"], ["scale", "Resize"]], gizmo.mode, (mode) => app.objects.setGizmoMode(mode)));
  }

  _objectSection(object) {
    const { app } = this;
    const objects = app.objects;
    const many = objects.selected.size > 1;
    const targets = [...objects.selected];
    const p = object.props;
    const color = h("input", {
      type: "color", id: "object-color", value: p.color, "aria-label": "Object color",
      oninput: (e) => targets.forEach((o) => objects.applyProps(o, { ...o.props, color: e.target.value })),
      onchange: (e) => objects.setProps(targets, { color: e.target.value }, "Color"),
    });
    const action = (label, iconName, tip, run, disabled, id) =>
      h("button", { class: "act", type: "button", tip, disabled, onclick: run, id, html: `${icon(iconName, 18)}<span>${label}</span>` });

    const isPhysical = !PRESETS[p.preset].toon;
    const parts = [
      many
        ? h("p", { class: "muted" }, `${objects.selected.size} objects picked`)
        : h("label", { class: "field" }, h("span", { class: "field-label" }, "Name"),
          h("input", {
            class: "text", type: "text", value: object.name, maxLength: 40, id: "object-name",
            onchange: (e) => objects.rename(object, e.target.value.trim()),
            onkeydown: (e) => { if (e.key === "Enter") e.target.blur(); },
          })),
      h("label", { class: "color-field" }, h("span", {}, "Clay color"), color),
      h("div", { class: "field" }, h("span", { class: "field-label" }, "Material"),
        h("div", { class: "material-pills" }, Object.entries(PRESETS).map(([id, preset]) =>
          h("button", {
            class: `material-pill ${id === p.preset ? "is-active" : ""}`, type: "button", tip: preset.label, "aria-label": preset.label,
            style: `--swatch:${preset.swatch}`, onclick: () => this.applyPreset(id),
          })))),
      isPhysical && this._slider({
        label: "Roughness", id: "object-rough", min: 0, max: 1, step: 0.01, value: p.roughness, scale: 100, unit: "%",
        onInput: (v) => targets.forEach((o) => objects.applyProps(o, { ...o.props, roughness: v })),
        onChange: (v) => objects.setProps(targets, { roughness: v }, "Roughness"),
      }),
      isPhysical && this._slider({
        label: "Metallic", id: "object-metal", min: 0, max: 1, step: 0.01, value: p.metalness, scale: 100, unit: "%",
        onInput: (v) => targets.forEach((o) => objects.applyProps(o, { ...o.props, metalness: v })),
        onChange: (v) => objects.setProps(targets, { metalness: v }, "Metallic"),
      }),
    ];
    if (!many) parts.push(this._transformFields(object));
    parts.push(h("div", { class: "act-grid" },
      action("Copy", "copy", "Make a copy (Ctrl+D)", () => objects.duplicate(), false, "act-duplicate"),
      action("Delete", "trash", "Delete what's picked", () => this.confirmDelete(), false, "act-delete"),
      action("Group", "group", "Stick the picked objects together", () => objects.group(), objects.selected.size < 2, "act-group"),
      action("Ungroup", "ungroup", "Separate a group", () => objects.ungroup(), !targets.some((o) => o.group), "act-ungroup"),
      action("Combine", "combine", "Melt the picked objects into one", () => objects.combine(), objects.selected.size < 2, "act-combine"),
      action("Add Detail", "detail", "Split every triangle so you can sculpt finer", () => {
        if (!objects.subdivideFocus()) this.toast("This shape already has as much detail as it can hold.", "warn");
      }, many, "act-subdivide"),
      action("Smooth All", "smooth", "Soften the whole object", () => objects.smoothFocus(), many, "act-smooth"),
    ));
    return this._section(many ? "Picked objects" : "Object", ...parts);
  }

  _transformFields(object) {
    const { app } = this;
    const m = object.mesh;
    this.transformInputs = {};
    const row = (kind, label, read, write, step) => {
      const axes = ["x", "y", "z"].map((axis) => {
        const input = h("input", {
          class: "number", type: "number", step, "aria-label": `${label} ${axis}`, value: format(read(axis)),
          onfocus: () => { this.transformBefore = app.objects.snapshotSelection(); },
          oninput: (e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v)) return;
            write(axis, v);
            m.updateMatrixWorld();
            app.objects.afterMove();
          },
          onchange: () => {
            app.objects.recordTransforms(this.transformBefore ?? app.objects.snapshotSelection(), label);
            this.transformBefore = app.objects.snapshotSelection();
          },
        });
        this.transformInputs[`${kind}.${axis}`] = { input, read: () => read(axis) };
        return h("label", { class: `num-field num-${axis}` }, h("span", {}, axis.toUpperCase()), input);
      });
      return h("div", { class: "num-row" }, h("span", { class: "num-title" }, label), h("div", { class: "num-group" }, axes));
    };
    const DEG = 180 / Math.PI;
    return h("details", { class: "transform-box" },
      h("summary", {}, "Exact numbers"),
      row("pos", "Move", (a) => m.position[a], (a, v) => { m.position[a] = v; }, 0.05),
      row("rot", "Turn", (a) => m.rotation[a] * DEG, (a, v) => { m.rotation[a] = v / DEG; }, 5),
      row("scale", "Size", (a) => m.scale[a], (a, v) => { m.scale[a] = v; }, 0.05),
    );
  }

  _syncTransform() {
    if (!this.transformInputs) return;
    for (const { input, read } of Object.values(this.transformInputs)) {
      if (document.activeElement !== input) input.value = format(read());
    }
  }

  applyPreset(id) {
    const { app } = this;
    const targets = [...app.objects.selected];
    if (!targets.length) {
      this.toast("Pick an object first, then choose its material.");
      return;
    }
    const preset = PRESETS[id];
    app.objects.setProps(targets, { preset: id, roughness: preset.roughness, metalness: preset.metalness }, preset.label);
  }

  /** Colors the picked objects and also loads the color onto the paint brush. */
  applyColor(hex) {
    const { app } = this;
    app.paint.color = hex;
    const painting = app.tool === "paint" || app.tool === "erase";
    const targets = [...app.objects.selected];
    if (!painting && targets.length) app.objects.setProps(targets, { color: hex }, "Color");
    if (!painting && !targets.length) this.toast("Paint brush color set. Pick an object to color all of it.");
    this._renderDock();
    if (painting) this._renderProps();
  }

  // ---- Object list ---------------------------------------------------------------------

  _renderList() {
    const { app } = this;
    const root = document.getElementById("object-list");
    const { list, selected } = app.objects;
    document.getElementById("object-count").textContent = list.length;
    root.replaceChildren(...list.map((o) =>
      h("li", { class: `list-item ${selected.has(o) ? "is-active" : ""}` },
        h("button", {
          class: "list-name", type: "button", onclick: (e) => app.objects.selectClick(o, e.shiftKey || e.ctrlKey),
        }, h("span", { class: "list-dot", style: `background:${o.props.color}` }), h("span", { class: "list-text" }, o.name), o.group && h("span", { class: "list-tag" }, "group")),
        h("button", {
          class: "list-eye", type: "button", tip: o.mesh.visible ? "Hide" : "Show", "aria-label": `${o.mesh.visible ? "Hide" : "Show"} ${o.name}`,
          html: icon(o.mesh.visible ? "eye" : "eyeOff", 16),
          onclick: () => app.objects.setVisible(o, !o.mesh.visible),
        }))));
  }

  // ---- Bottom dock ---------------------------------------------------------------------

  _buildDock() {
    const tabs = [["shapes", "Shapes", "shapes"], ["parts", "Fun Parts", "smile"], ["colors", "Colors", "palette"], ["materials", "Materials", "material"], ["views", "Views", "view"]];
    this.dockTabs = {};
    const nav = h("div", { class: "dock-tabs", role: "tablist" }, tabs.map(([id, label, iconName]) => {
      const btn = h("button", {
        class: "dock-tab", type: "button", role: "tab", onclick: () => this.setDock(id), html: `${icon(iconName, 18)}<span>${label}</span>`,
      });
      btn.dataset.dock = id;
      this.dockTabs[id] = btn;
      return btn;
    }));
    this.dockBody = h("div", { class: "dock-body", id: "dock-body" });
    this.statsBox = h("div", { class: "stats", id: "stats", "aria-label": "Model statistics" });
    document.getElementById("dock").append(nav, this.dockBody, this.statsBox);
  }

  setDock(id) {
    this.dock = id;
    this._renderDock();
  }

  _renderDock() {
    for (const [id, btn] of Object.entries(this.dockTabs)) {
      btn.classList.toggle("is-active", id === this.dock);
      btn.setAttribute("aria-selected", String(id === this.dock));
    }
    const body = this[`_dock_${this.dock}`]();
    this.dockBody.replaceChildren(...body);
  }

  _dock_shapes() {
    return Object.entries(SHAPES).map(([id, shape]) =>
      this._thumb(`assets/thumbs/shape-${id}.png`, shape.label, () => this.app.addShape(id), `shape-${id}`));
  }

  _dock_parts() {
    return Object.entries(FUN_PARTS).map(([id, part]) =>
      this._thumb(`assets/thumbs/part-${id}.png`, part.label, () => this.app.beginPlacing(id), `part-${id}`));
  }

  _thumb(src, label, run, id) {
    return h("button", { class: "thumb", type: "button", onclick: run, id, tip: `Add ${label}` },
      h("img", { src, alt: "", width: 48, height: 48, draggable: false }), h("span", {}, label));
  }

  _dock_colors() {
    const { app } = this;
    const swatches = PALETTE.map((hex) =>
      h("button", {
        class: `swatch ${hex === app.paint.color ? "is-active" : ""}`, type: "button", style: `--swatch:${hex}`, "aria-label": `Color ${hex}`,
        onclick: () => this.applyColor(hex),
      }));
    const custom = h("label", { class: "swatch-custom", tip: "Mix your own color" },
      h("input", { type: "color", value: app.paint.color, "aria-label": "Custom color", onchange: (e) => this.applyColor(e.target.value) }));
    return [...swatches, custom];
  }

  _dock_materials() {
    return Object.entries(PRESETS).map(([id, preset]) =>
      h("button", { class: `material-card material-${id}`, type: "button", style: `--swatch:${preset.swatch}`, id: `material-${id}`, onclick: () => this.applyPreset(id) },
        h("span", { class: "material-ball" }), h("span", {}, preset.label)));
  }

  _dock_views() {
    const { app } = this;
    const view = (id, label) => h("button", { class: "view-btn", type: "button", id: `view-${id}`, onclick: () => app.rig.setView(id) }, label);
    const iconBtn = (id, label, name, run, on) => h("button", {
      class: `view-btn with-icon ${on ? "is-active" : ""}`, type: "button", id, onclick: run, "aria-pressed": on === undefined ? null : String(on),
      html: `${icon(name, 18)}<span>${label}</span>`,
    });
    return [
      view("front", "Front"), view("back", "Back"), view("left", "Left"), view("right", "Right"), view("top", "Top"), view("bottom", "Bottom"),
      iconBtn("view-reset", "Reset", "reset", () => app.frameAll()),
      iconBtn("view-frame", "Zoom to it", "frame", () => app.frameSelection()),
      iconBtn("view-ortho", app.rig.isOrtho ? "Flat view" : "Depth view", "cube", () => { app.rig.setOrthographic(!app.rig.isOrtho); this._renderDock(); }),
      iconBtn("view-grid", "Grid", "grid", () => { app.setGrid(!app.view.grid); this._renderDock(); }, app.view.grid),
      iconBtn("view-wire", "Wireframe", "wire", () => { app.setWireframe(!app.view.wireframe); this._renderDock(); }, app.view.wireframe),
    ];
  }

  _renderStats() {
    const s = this.app.objects.stats();
    const n = (value) => (value >= 1000 ? `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k` : String(value));
    this.statsBox.replaceChildren(
      h("span", {}, h("b", {}, s.objects), " objects"),
      h("span", {}, h("b", {}, n(s.vertices)), " points"),
      h("span", {}, h("b", {}, n(s.triangles)), " triangles"),
    );
  }

  // ---- Viewport overlays ---------------------------------------------------------------

  _buildHud() {
    const { app } = this;
    this.placingBar = document.getElementById("placing-bar");
    this.emptyHint = document.getElementById("empty-hint");
    document.getElementById("props-toggle").addEventListener("click", () => {
      document.getElementById("props").classList.toggle("is-open");
    });
    document.getElementById("props-close").addEventListener("click", () => {
      document.getElementById("props").classList.remove("is-open");
    });
    const quick = document.getElementById("quick-size");
    quick.addEventListener("input", () => app.setBrushRadius(Number(quick.value), true));
    const strength = document.getElementById("quick-strength");
    strength.addEventListener("input", () => {
      app.brush.strength = Number(strength.value);
      const panel = document.getElementById("brush-strength");
      if (panel) panel.value = strength.value;
    });
    app.on("tool", () => this._syncQuick());
  }

  _syncQuick() {
    const { app } = this;
    const painting = app.tool === "paint" || app.tool === "erase";
    const quick = document.getElementById("quick-size");
    quick.max = painting ? 0.8 : 1;
    quick.value = painting ? app.paint.radius : app.brush.radius;
    document.getElementById("quick-strength").value = app.brush.strength;
    document.getElementById("quick").classList.toggle("is-hidden", app.tool === "select");
  }

  _showPlacing(label) {
    this.placingBar.classList.toggle("is-hidden", !label);
    if (label) {
      this.placingBar.replaceChildren(
        h("span", {}, `Tap your model to place the ${label}`),
        h("button", { class: "mini", type: "button", onclick: () => this.app.interaction.stopPlacing() }, "Cancel"));
    }
  }

  _markEmpty() {
    this.emptyHint.classList.toggle("is-hidden", this.app.objects.list.length > 0);
  }

  // ---- Tooltips and toasts -------------------------------------------------------------

  _tooltip() {
    const tip = document.getElementById("tooltip");
    let current = null;
    const hide = () => {
      tip.classList.remove("is-visible");
      current = null;
    };
    document.addEventListener("pointerover", (e) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target.closest?.("[data-tip]");
      if (target === current) return;
      if (!target) {
        hide();
        return;
      }
      current = target;
      tip.textContent = target.dataset.tip;
      tip.classList.add("is-visible");
      const rect = target.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const roomRight = rect.right + box.width + 16 < window.innerWidth;
      const below = rect.top < 90;
      if (below) {
        tip.style.left = `${Math.max(8, Math.min(window.innerWidth - box.width - 8, rect.left + rect.width / 2 - box.width / 2))}px`;
        tip.style.top = `${rect.bottom + 8}px`;
      } else if (rect.left < 200 && roomRight) {
        tip.style.left = `${rect.right + 10}px`;
        tip.style.top = `${rect.top + rect.height / 2 - box.height / 2}px`;
      } else {
        tip.style.left = `${Math.max(8, Math.min(window.innerWidth - box.width - 8, rect.left + rect.width / 2 - box.width / 2))}px`;
        tip.style.top = `${rect.top - box.height - 8}px`;
      }
    });
    document.addEventListener("pointerdown", hide);
  }

  toast(message, kind = "info") {
    const root = document.getElementById("toasts");
    const el = h("div", { class: `toast toast-${kind}`, role: "status" }, message);
    root.append(el);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => {
      el.classList.add("is-leaving");
      setTimeout(() => el.remove(), 280);
    }, 2400);
  }

  // ---- Dialogs -------------------------------------------------------------------------

  dialog({ title, body, wide = false, actions = [], onClose, closable = true }) {
    const root = document.getElementById("modals");
    const previous = document.activeElement;
    const close = (result) => {
      overlay.remove();
      window.removeEventListener("keydown", onKey, true);
      this.dialogs = this.dialogs.filter((d) => d !== entry);
      previous?.focus?.({ preventScroll: true });
      onClose?.(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape" && closable && this.dialogs[this.dialogs.length - 1] === entry) {
        e.stopPropagation();
        close();
      }
    };
    const card = h("div", { class: `dialog ${wide ? "is-wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
      h("header", { class: "dialog-head" }, h("h2", {}, title),
        closable && h("button", { class: "icon-btn", type: "button", "aria-label": "Close", html: icon("close", 20), onclick: () => close() })),
      h("div", { class: "dialog-body" }, body),
      actions.length ? h("footer", { class: "dialog-foot" }, actions.map((a) =>
        h("button", {
          class: `btn ${a.kind ?? ""}`, type: "button", id: a.id,
          onclick: async () => {
            const keep = await a.run?.(close);
            if (keep !== true) close(a.value);
          },
        }, a.label))) : null);
    const overlay = h("div", {
      class: "overlay",
      onpointerdown: (e) => { if (e.target === overlay && closable) close(); },
    }, card);
    root.append(overlay);
    const entry = { overlay, close };
    this.dialogs.push(entry);
    window.addEventListener("keydown", onKey, true);
    (card.querySelector(".dialog-foot .btn.primary") ?? card.querySelector("button"))?.focus({ preventScroll: true });
    return close;
  }

  confirm({ title, message, ok = "Yes", cancel = "Cancel", danger = false }) {
    return new Promise((resolve) => {
      this.dialog({
        title,
        body: h("p", { class: "dialog-text" }, message),
        onClose: (value) => resolve(Boolean(value)),
        actions: [
          { label: cancel, value: false },
          { label: ok, value: true, kind: danger ? "danger" : "primary", id: "confirm-ok" },
        ],
      });
    });
  }

  async confirmDelete() {
    const { app } = this;
    const count = app.objects.selected.size;
    if (!count) return;
    const ok = await this.confirm({
      title: count > 1 ? `Delete ${count} objects?` : `Delete ${app.objects.focus.name}?`,
      message: "You can bring it back with Undo.",
      ok: "Delete",
      danger: true,
    });
    if (ok) app.objects.deleteSelected();
  }

  /** Checks with the user before replacing the scene. Resolves true to carry on. */
  guardUnsaved() {
    const { app } = this;
    const { project } = app;
    if (!project.unsavedToFile || !app.objects.list.length) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.dialog({
        title: "Keep your creation?",
        body: h("p", { class: "dialog-text" }, `"${project.name}" hasn't been saved as a file yet. If you go on, the latest version stays in My Projects in this browser.`),
        onClose: (value) => resolve(Boolean(value)),
        actions: [
          { label: "Go back", value: false },
          { label: "Save file first", id: "guard-save", value: true, run: () => project.saveToFile() },
          { label: "Go on without a file", id: "guard-discard", value: true, kind: "primary", run: () => project.autosave() },
        ],
      });
    });
  }

  showStarter({ first = false } = {}) {
    const { app } = this;
    const pick = async (run) => {
      closeDialog();
      if (await this.guardUnsaved()) run();
    };
    const card = (id, label, hint, run, src) =>
      h("button", { class: "starter", type: "button", id: `starter-${id}`, onclick: () => pick(run) },
        src ? h("img", { src, alt: "", width: 112, height: 112, draggable: false }) : h("span", { class: "starter-blank", html: icon("plus", 40) }),
        h("strong", {}, label), h("span", {}, hint));
    const body = h("div", {},
      first && h("p", { class: "dialog-lead" }, "Pick something to start with, then push, pull and paint it into anything you like."),
      h("div", { class: "starter-grid" },
        Object.entries(TEMPLATES).map(([id, t]) => card(id, t.label, t.hint, () => app.loadTemplate(id), `assets/thumbs/template-${id}.png`)),
        card("blank", "Blank Canvas", "Build it all yourself", () => app.loadBlank())),
      first && h("div", { class: "starter-links" },
        h("button", { class: "btn ghost", type: "button", onclick: () => { closeDialog(); this.showTutorials(); } }, "Show me how"),
        h("button", { class: "btn ghost", type: "button", onclick: () => { closeDialog(); this.showChallenges(); } }, "Try a challenge"),
        h("button", { class: "btn ghost", type: "button", onclick: () => { closeDialog(); this.showProjects(); } }, "My Projects")));
    const closeDialog = this.dialog({ title: first ? "Welcome to 3D Wonder Studio!" : "What do you want to make?", body, wide: true });
  }

  async showProjects() {
    const { app } = this;
    const { project } = app;
    const grid = h("div", { class: "project-grid" });
    const fileInput = h("input", {
      type: "file", accept: ".json,application/json", class: "is-hidden", id: "open-file",
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        closeDialog();
        if (!(await this.guardUnsaved())) return;
        try {
          await project.openFile(file);
          this.toast(`Opened ${project.name}`);
        } catch (error) {
          console.error(error);
          this.toast("That file couldn't be opened.", "warn");
        }
      },
    });
    const refresh = async () => {
      let items = [];
      try {
        items = await project.listProjects();
      } catch {
        grid.replaceChildren(h("p", { class: "muted" }, "This browser isn't letting the studio keep projects. You can still save and open files."));
        return;
      }
      if (!items.length) {
        grid.replaceChildren(h("p", { class: "muted" }, "Nothing here yet. Your creations appear here on their own as you work."));
        return;
      }
      grid.replaceChildren(...items.map((item) => {
        const nameBox = h("input", {
          class: "text", value: item.name, maxLength: 60, "aria-label": "Project name",
          onchange: async (e) => {
            await project.renameProject(item.id, e.target.value.trim() || item.name);
            refresh();
          },
        });
        return h("article", { class: `project-card ${item.id === project.id ? "is-current" : ""}` },
          h("button", {
            class: "project-thumb", type: "button", "aria-label": `Open ${item.name}`,
            onclick: async () => {
              closeDialog();
              if (item.id === project.id) return;
              if (!(await this.guardUnsaved())) return;
              try {
                await project.openFromBrowser(item.id);
                this.toast(`Opened ${item.name}`);
              } catch {
                this.toast("That project couldn't be opened.", "warn");
              }
            },
          }, item.thumb ? h("img", { src: item.thumb, alt: "" }) : h("span", { html: icon("cube", 32) })),
          nameBox,
          h("p", { class: "project-date" }, new Date(item.updated).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })),
          h("div", { class: "project-actions" },
            h("button", {
              class: "icon-btn", type: "button", tip: "Make a copy", "aria-label": "Duplicate project", html: icon("copy", 18),
              onclick: async () => {
                await project.duplicateProject(item.id);
                refresh();
              },
            }),
            item.id !== project.id && h("button", {
              class: "icon-btn", type: "button", tip: "Delete project", "aria-label": "Delete project", html: icon("trash", 18),
              onclick: async () => {
                if (await this.confirm({ title: `Delete ${item.name}?`, message: "This can't be undone.", ok: "Delete", danger: true })) {
                  await project.deleteProject(item.id);
                  refresh();
                }
              },
            })));
      }));
    };
    const closeDialog = this.dialog({
      title: "My Projects",
      wide: true,
      body: h("div", {}, grid, fileInput),
      actions: [
        { label: "Open a file", id: "open-file-btn", run: () => { fileInput.click(); return true; } },
        { label: "Save a copy here", id: "save-browser", kind: "primary", run: async () => { await project.saveToBrowser(); refresh(); return true; } },
      ],
    });
    refresh();
  }

  async saveProject() {
    const { project } = this.app;
    try {
      await project.saveToFile();
      this.toast("Saved! Look in your downloads.");
    } catch (error) {
      console.error(error);
      this.toast("Saving didn't work. Please try again.", "warn");
    }
  }

  showExport() {
    const { app } = this;
    if (!app.objects.list.length) {
      this.toast("Add something first, then you can export it.");
      return;
    }
    let format = "glb";
    const hasSelection = app.objects.selected.size > 0;
    let scope = hasSelection ? "selected" : "all";
    let high = false;
    const formats = h("div", { class: "format-grid" });
    const drawFormats = () => formats.replaceChildren(...Object.entries(FORMATS).map(([id, f]) =>
      h("button", { class: `format ${id === format ? "is-active" : ""}`, type: "button", id: `format-${id}`, onclick: () => { format = id; drawFormats(); } },
        h("strong", {}, f.label), h("span", {}, f.note))));
    drawFormats();
    const scopeRow = h("div", { class: "field" }, h("span", { class: "field-label" }, "What to export"));
    const drawScope = () => scopeRow.replaceChildren(scopeRow.firstChild, this._chips(
      hasSelection ? [["selected", `Picked objects (${app.objects.selected.size})`], ["all", "Whole scene"]] : [["all", "Whole scene"]],
      scope, (id) => { scope = id; drawScope(); }));
    drawScope();
    this.dialog({
      title: "Export your model",
      body: h("div", { class: "dialog-stack" }, formats, scopeRow,
        this._toggle("Extra smooth (bigger file)", high, (on) => { high = on; }, "Splits every triangle once more, then softens the result.")),
      actions: [
        { label: "Cancel" },
        {
          label: "Export", id: "export-go", kind: "primary",
          run: async () => {
            const objects = scope === "selected" ? [...app.objects.selected] : app.objects.list.filter((o) => o.mesh.visible);
            try {
              const blob = await downloadModel(objects, format, app.project.name, { highQuality: high });
              this.toast(`${FORMATS[format].label} file ready: ${(blob.size / 1048576).toFixed(1)} MB`);
              app.emit("exported");
            } catch (error) {
              console.error(error);
              this.toast("Export didn't work. Please try again.", "warn");
            }
          },
        },
      ],
    });
  }

  showSettings() {
    const { app } = this;
    const s = app.settings;
    const bgRow = h("label", { class: "color-field" }, h("span", {}, "Workspace color"),
      h("input", { type: "color", value: s.background, id: "setting-bg", oninput: (e) => app.setBackground(e.target.value) }));
    const redrawChips = (slot, options, read, write) => {
      const draw = () => slot.replaceChildren(this._chips(options, read(), (id) => { write(id); draw(); }));
      draw();
      return slot;
    };
    this.dialog({
      title: "Settings",
      body: h("div", { class: "dialog-stack" },
        h("div", { class: "field" }, h("span", { class: "field-label" }, "Theme"),
          redrawChips(h("div"), [["dark", "Dark"], ["light", "Light"]], () => s.theme, (id) => app.setTheme(id))),
        bgRow,
        h("div", { class: "field" }, h("span", { class: "field-label" }, "Sculpting quality"),
          redrawChips(h("div", { id: "setting-quality" }), Object.entries(app.qualities).map(([id, q]) => [id, q.label]), () => s.quality, (id) => app.setQuality(id)),
          h("p", { class: "muted" }, "Low-poly is best for tablets and older computers. New shapes and paint use this setting.")),
        h("div", { class: "field" }, h("span", { class: "field-label" }, "Fine detail"),
          redrawChips(h("div"), [[0.65, "Chunky"], [1, "Normal"], [1.6, "Tiny"]].map(([v, label]) => [v, label]), () => app.brush.detail, (v) => { app.brush.detail = v; app.saveBrush(); })),
        this._toggle("Show the floor grid", app.view.grid, (on) => { app.setGrid(on); this._renderDock(); }),
        this._toggle("Show wireframe", app.view.wireframe, (on) => { app.setWireframe(on); this._renderDock(); }),
      ),
      actions: [{ label: "Done", kind: "primary" }],
    });
  }

  showHelp() {
    const close = this.dialog({
      title: "Help",
      body: h("div", { class: "dialog-stack" },
        h("div", { class: "help-actions" },
          h("button", { class: "btn primary", type: "button", id: "help-tutorials", onclick: () => { close(); this.showTutorials(); } }, "Tutorials"),
          h("button", { class: "btn primary", type: "button", id: "help-challenges", onclick: () => { close(); this.showChallenges(); } }, "Creative challenges")),
        h("table", { class: "keys" }, h("tbody", {}, [
          ["Turn the view", "Drag empty space, or Alt + drag"],
          ["Slide the view", "Middle or right mouse, or two fingers"],
          ["Zoom", "Mouse wheel, or pinch"],
          ["Undo / Redo", "Ctrl+Z / Ctrl+Y"],
          ["Bigger / smaller brush", "] / ["],
          ["Smooth with any brush", "Hold Shift"],
          ["Flip a brush", "Hold Ctrl"],
          ["Move / Turn / Resize", "W / E / R"],
          ["Copy / Delete", "Ctrl+D / Delete"],
          ["Pick everything", "Ctrl+A"],
          ["Zoom to what's picked", "F"],
        ].map(([action, keys]) => h("tr", {}, h("td", {}, action), h("td", {}, keys)))))),
      actions: [{ label: "Done" }],
    });
  }

  showTutorials() {
    const close = this.dialog({
      title: "Tutorials",
      wide: true,
      body: h("div", { class: "lesson-grid" }, TUTORIALS.map((lesson, i) =>
        h("button", {
          class: "lesson", type: "button", id: `lesson-${i}`,
          onclick: () => { close(); this.app.tutor.start(i); },
        }, h("span", { class: "lesson-number" }, i + 1), h("strong", {}, lesson.title), h("span", {}, lesson.blurb)))),
    });
  }

  showChallenges() {
    const { app } = this;
    const done = app.tutor.completed();
    const close = this.dialog({
      title: "Creative challenges",
      wide: true,
      body: h("div", { class: "lesson-grid" }, CHALLENGES.map((challenge) =>
        h("button", {
          class: `lesson ${done.has(challenge.id) ? "is-done" : ""}`, type: "button", id: `challenge-${challenge.id}`,
          onclick: () => { close(); app.tutor.startChallenge(challenge); },
        }, h("span", { class: "lesson-number", html: icon(done.has(challenge.id) ? "star" : "trophy", 20) }), h("strong", {}, challenge.title), h("span", {}, challenge.blurb)))),
    });
  }
}

function format(value) {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export { h };
