/* Panel layout templates and panel geometry tools (split, slice).
 * A template is a function (area, gutter) -> list of polygons in page coordinates.
 * Polygons that are axis-aligned rectangles become "rect" panels; others become "poly" panels. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { polyBounds } = CBS;

  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

  /* rows: [{h: weight, cols: [weights]}] */
  function grid(rows) {
    return (A, g) => {
      const total = rows.reduce((s, r) => s + r.h, 0);
      const usableH = A.h - g * (rows.length - 1);
      const out = [];
      let y = A.y;
      for (const r of rows) {
        const rh = (usableH * r.h) / total;
        const cols = r.cols || [1];
        const ct = cols.reduce((s, c) => s + c, 0);
        const usableW = A.w - g * (cols.length - 1);
        let x = A.x;
        for (const c of cols) {
          const cw = (usableW * c) / ct;
          out.push(rect(x, y, cw, rh));
          x += cw + g;
        }
        y += rh + g;
      }
      return out;
    };
  }
  /* cols: [{w: weight, rows: [weights]}] */
  function columns(cols) {
    return (A, g) => {
      const total = cols.reduce((s, c) => s + c.w, 0);
      const usableW = A.w - g * (cols.length - 1);
      const out = [];
      let x = A.x;
      for (const c of cols) {
        const cw = (usableW * c.w) / total;
        const rows = c.rows || [1];
        const rt = rows.reduce((s, r) => s + r, 0);
        const usableH = A.h - g * (rows.length - 1);
        let y = A.y;
        for (const r of rows) {
          const rh = (usableH * r) / rt;
          out.push(rect(x, y, cw, rh));
          y += rh + g;
        }
        x += cw + g;
      }
      return out;
    };
  }

  /* Clip polygon to the half-plane on the left of the directed line a->b (Sutherland-Hodgman). */
  function clipHalf(poly, a, b, offset) {
    const nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    const side = (p) => ((p[0] - a[0]) * nx + (p[1] - a[1]) * ny) / len - offset;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return out;
  }
  /* Split a polygon along line a->b, leaving a gap of g. Returns [left, right] (either may be empty). */
  function slicePoly(poly, a, b, g) {
    return [clipHalf(poly, a, b, g / 2), clipHalf(poly, b, a, g / 2)];
  }
  /* Template helper: start with the area and apply successive slices.
   * cuts: [[px, py, x1, y1, x2, y2]]: cut the piece containing point (px, py) along the line
   * (x1, y1) -> (x2, y2). Everything is in fractions of the area. */
  function slices(cuts) {
    return (A, g) => {
      let pieces = [rect(A.x, A.y, A.w, A.h)];
      const P = (fx, fy) => [A.x + fx * A.w, A.y + fy * A.h];
      for (const [px, py, x1, y1, x2, y2] of cuts) {
        const t = P(px, py);
        const idx = pieces.findIndex((pc) => CBS.pointInPoly(t[0], t[1], pc));
        if (idx < 0) continue;
        const [l, r] = slicePoly(pieces[idx], P(x1, y1), P(x2, y2), g);
        pieces.splice(idx, 1, ...[l, r].filter((p) => p.length >= 3));
      }
      return pieces;
    };
  }

  const T = (id, name, cat, fn) => ({ id, name, cat, fn });
  const TEMPLATES = [
    T("full", "One full-page panel", "Basic", grid([{ h: 1, cols: [1] }])),
    T("two-h", "Two horizontal panels", "Basic", grid([{ h: 1 }, { h: 1 }])),
    T("two-v", "Two vertical panels", "Basic", columns([{ w: 1 }, { w: 1 }])),
    T("three-rows", "Three equal panels", "Basic", grid([{ h: 1 }, { h: 1 }, { h: 1 }])),
    T("three-cols", "Three tall panels", "Basic", columns([{ w: 1 }, { w: 1 }, { w: 1 }])),
    T("four", "Four-panel grid", "Grids", grid([{ h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }])),
    T("six", "Six-panel grid", "Grids", grid([{ h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }, { h: 1, cols: [1, 1] }])),
    T("nine", "Nine-panel grid", "Grids", grid([{ h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1, 1] }, { h: 1, cols: [1, 1, 1] }])),
    T("strips4", "Four widescreen strips", "Grids", grid([{ h: 1 }, { h: 1 }, { h: 1 }, { h: 1 }])),
    T("big-top", "Big top, two below", "Asymmetric", grid([{ h: 1.4, cols: [1] }, { h: 1, cols: [1, 1] }])),
    T("big-bottom", "Two on top, big bottom", "Asymmetric", grid([{ h: 1, cols: [1, 1] }, { h: 1.4, cols: [1] }])),
    T("tall-left", "Tall left, stacked right", "Asymmetric", columns([{ w: 1.1, rows: [1] }, { w: 1, rows: [1, 1, 1] }])),
    T("tall-right", "Stacked left, tall right", "Asymmetric", columns([{ w: 1, rows: [1, 1] }, { w: 1.2, rows: [1] }])),
    T("sandwich", "Wide · three · wide", "Asymmetric", grid([{ h: 1, cols: [1] }, { h: 0.9, cols: [1, 1, 1] }, { h: 1, cols: [1] }])),
    T("mixed5", "Classic five-panel page", "Asymmetric", grid([{ h: 1, cols: [1, 1.6] }, { h: 1.1, cols: [1] }, { h: 1, cols: [1.6, 1] }])),
    T("l-shape", "L-shaped spotlight", "Asymmetric", grid([{ h: 1, cols: [2, 1] }, { h: 1, cols: [1, 1, 1] }, { h: 1.2, cols: [1] }])),
    T("diag2", "Diagonal split", "Dynamic", slices([[0.5, 0.5, 0, 0.62, 1, 0.38]])),
    T("diag3", "Three slanted rows", "Dynamic", slices([[0.5, 0.5, 0, 0.36, 1, 0.26], [0.5, 0.85, 0, 0.72, 1, 0.62]])),
    T("zigzag", "Zig-zag four", "Dynamic", slices([[0.5, 0.5, 0, 0.5, 1, 0.5], [0.5, 0.2, 0.42, 0, 0.58, 1], [0.5, 0.8, 0.58, 0, 0.42, 1]])),
    T("x-cross", "Crossed diagonals", "Dynamic", slices([[0.5, 0.5, 0.3, 0, 0.7, 1], [0.12, 0.5, 0, 0.42, 1, 0.58], [0.88, 0.5, 0, 0.58, 1, 0.42]])),
    T("action-burst", "Action: big splash + strip", "Action", slices([[0.5, 0.4, 0, 0.7, 1, 0.78], [0.15, 0.92, 0.33, 0, 0.36, 1], [0.85, 0.92, 0.66, 0, 0.7, 1]])),
    T("action-shards", "Action: shattered", "Action", slices([[0.5, 0.5, 0, 0.3, 1, 0.42], [0.3, 0.1, 0.45, 0, 0.6, 1], [0.5, 0.9, 0, 0.75, 1, 0.66], [0.5, 0.55, 0.38, 0, 0.55, 1]])),
    T("action-slash", "Action: slash", "Action", slices([[0.5, 0.5, 0, 0.18, 1, 0.55], [0.5, 0.95, 0, 0.6, 1, 0.82], [0.3, 0.08, 0.55, 0, 0.45, 1]])),
    T("manga-classic", "Manga: classic page", "Manga", grid([{ h: 1, cols: [1.4, 1] }, { h: 1.3, cols: [1] }, { h: 1, cols: [1, 1, 1.3] }])),
    T("manga-tall", "Manga: tall right column", "Manga", columns([{ w: 1, rows: [1, 1.2, 1] }, { w: 1.1, rows: [1] }])),
    T("manga-slant", "Manga: slanted beats", "Manga", slices([[0.5, 0.5, 0, 0.3, 1, 0.24], [0.5, 0.9, 0, 0.62, 1, 0.68], [0.5, 0.45, 0.52, 0, 0.42, 1], [0.3, 0.1, 0.6, 0, 0.6, 1]])),
    T("manga-vertical", "Manga: vertical strips", "Manga", columns([{ w: 1, rows: [1.3, 1] }, { w: 1, rows: [1] }, { w: 1, rows: [1, 1.3] }])),
  ];

  /* User-saved custom layouts live in preferences (fractions of the page). */
  function customTemplates() {
    return (CBS.prefs.get("customLayouts", []) || []).map((c) => ({
      id: c.id, name: c.name, cat: "Custom", custom: true,
      fn: (A) => c.polys.map((poly) => poly.map(([u, v]) => [A.x + u * A.w, A.y + v * A.h])),
    }));
  }
  function allTemplates() { return TEMPLATES.concat(customTemplates()); }
  function templateById(id) { return allTemplates().find((t) => t.id === id) || null; }

  function isAxisRect(poly) {
    if (poly.length !== 4) return false;
    const xs = new Set(poly.map((p) => Math.round(p[0] * 100))), ys = new Set(poly.map((p) => Math.round(p[1] * 100)));
    return xs.size === 2 && ys.size === 2;
  }

  /* Polygon (page coords) -> panel object */
  function panelFromPoly(poly, style = {}) {
    const b = polyBounds(poly);
    const props = Object.assign({ x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h) }, style);
    if (isAxisRect(poly)) props.shape = "rect";
    else {
      props.shape = "poly";
      props.pts = poly.map(([x, y]) => [(x - b.x) / Math.max(1, b.w), (y - b.y) / Math.max(1, b.h)]);
    }
    return CBS.createObject("panel", props);
  }

  function pageArea(project) {
    const s = project.pageSize;
    const m = project.settings.margin != null ? project.settings.margin : 30;
    return { x: m, y: m, w: s.w - m * 2, h: s.h - m * 2 };
  }

  function buildPanels(templateId, project, style) {
    const t = templateById(templateId) || TEMPLATES[0];
    const polys = t.fn(pageArea(project), project.settings.gutter != null ? project.settings.gutter : 14);
    return polys.filter((p) => p.length >= 3).map((p) => panelFromPoly(p, style));
  }

  /* Replace the panels on a page with a template. Artwork clipped to old panels is re-clipped
   * to the new panel it overlaps most, so applying a new layout keeps the art. */
  function applyTemplate(page, templateId, project) {
    let panelLayer = page.layers.find((l) => l.type === "panel");
    if (!panelLayer) panelLayer = CBS.doc.insertLayer(CBS.createLayer("panel"), page);
    const old = panelLayer.objects.filter((o) => o.kind === "panel");
    const style = old[0] ? { borderWidth: old[0].borderWidth, borderColor: old[0].borderColor, fill: old[0].fill, radius: old[0].radius } : {};
    const panels = buildPanels(templateId, project, style);
    const oldIds = new Set(old.map((o) => o.id));
    panelLayer.objects = panelLayer.objects.filter((o) => o.kind !== "panel").concat(panels);
    for (const layer of page.layers) {
      for (const o of layer.objects) {
        if (o.clip && oldIds.has(o.clip)) {
          const c = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
          const hit = panels.find((p) => CBS.pointInPoly(c.x, c.y, CBS.render.panelPagePoints(p)));
          o.clip = hit ? hit.id : null;
        }
      }
    }
    return panels;
  }

  /* Slice a panel along a line (page coords). Returns the two new panels or null. */
  function slicePanel(panel, a, b, gutter) {
    const poly = CBS.render.panelPagePoints(panel);
    const [l, r] = slicePoly(poly, [a.x, a.y], [b.x, b.y], gutter);
    if (l.length < 3 || r.length < 3) return null;
    const minArea = (p) => { const bb = polyBounds(p); return bb.w > 8 && bb.h > 8; };
    if (!minArea(l) || !minArea(r)) return null;
    const style = { borderWidth: panel.borderWidth, borderColor: panel.borderColor, fill: panel.fill };
    return [panelFromPoly(l, style), panelFromPoly(r, style)];
  }

  /* Save the current page's panels as a custom layout. */
  function saveCustom(name, page, project) {
    const s = project.pageSize;
    const polys = CBS.doc.panels(page).map((p) => CBS.render.panelPagePoints(p).map(([x, y]) => [x / s.w, y / s.h]));
    if (!polys.length) return null;
    const list = CBS.prefs.get("customLayouts", []) || [];
    const entry = { id: CBS.uid("lay"), name: name || "My layout", polys };
    list.push(entry);
    CBS.prefs.set("customLayouts", list);
    return entry;
  }
  function deleteCustom(id) {
    CBS.prefs.set("customLayouts", (CBS.prefs.get("customLayouts", []) || []).filter((c) => c.id !== id));
  }
  /* Custom layouts store fractions of the full page, so they draw without margins. */
  function previewPolys(t, w, h) {
    if (t.custom) return t.fn({ x: 0, y: 0, w, h });
    const m = Math.min(w, h) * 0.05;
    return t.fn({ x: m, y: m, w: w - 2 * m, h: h - 2 * m }, Math.min(w, h) * 0.035);
  }

  /* Small SVG preview for the template pickers. */
  function previewSVG(t, w = 54, h = 80) {
    const polys = previewPolys(t, w, h);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("class", "layout-preview");
    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("width", w); bg.setAttribute("height", h); bg.setAttribute("rx", 2); bg.setAttribute("class", "lp-page");
    svg.append(bg);
    for (const p of polys) {
      const el = document.createElementNS(ns, "polygon");
      el.setAttribute("points", p.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" "));
      el.setAttribute("class", "lp-panel");
      svg.append(el);
    }
    return svg;
  }

  CBS.layouts = {
    TEMPLATES, allTemplates, templateById, buildPanels, applyTemplate, slicePanel, slicePoly, panelFromPoly,
    saveCustom, deleteCustom, previewSVG, pageArea,
  };
})();
