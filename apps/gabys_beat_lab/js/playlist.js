/* PlaylistManager view: arrange patterns and audio clips into a song. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, uid, clamp, fitCanvas, hexToRgba } = GBL;
  const M = GBL.model;
  const S = M.state;

  const RULER = 26;
  const V = { zoomX: 5, trackH: 52, snap: "bar", tool: "paint", brush: null, sel: new Set(), box: null, clipboard: null };
  let root, head, scroller, spacer, canvas, ctx, headers, headersInner;
  let W = 300, H = 200, needs = true;

  const peaksCache = new WeakMap();
  function peaks(buf) {
    let p = peaksCache.get(buf);
    if (p) return p;
    const N = 4096, d = buf.getChannelData(0), per = Math.max(1, Math.floor(d.length / N));
    p = new Float32Array(N);
    for (let i = 0; i < N; i++) { let m = 0; const o = i * per; for (let j = 0; j < per; j += 4) { const v = Math.abs(d[o + j] || 0); if (v > m) m = v; } p[i] = m; }
    peaksCache.set(buf, p);
    return p;
  }

  function build(el) {
    root = el;
    head = h("div", { class: "editor-tools pl-tools" });
    canvas = h("canvas", { class: "pl-canvas", tabindex: 0, "aria-label": "Playlist arrangement. Click to place the selected pattern." });
    spacer = h("div", { class: "pr-spacer" });
    scroller = h("div", { class: "pl-scroll" }, canvas, spacer);
    headersInner = h("div", { class: "pl-headers-inner" });
    headers = h("div", { class: "pl-headers" }, h("div", { class: "pl-corner" }, "Tracks"), headersInner);
    root.append(head, h("div", { class: "pl-body" }, headers, scroller));
    scroller.addEventListener("scroll", () => { headersInner.style.transform = "translateY(" + -scroller.scrollTop + "px)"; needs = true; });
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onHover);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, local(e).x); } }, { passive: false });
    setupDrop();
    new ResizeObserver(resize).observe(scroller);
    bus.on("project:loaded", () => { V.sel.clear(); V.brush = null; renderAll(); });
    bus.on("change", (s) => { if (s !== "live" && s !== "steps") renderAll(); else needs = true; });
    bus.on("pattern:select", () => { V.brush = S.project.currentPattern; renderHead(); });
    bus.on("frame", () => { if (GBL.audio.transport.playing) needs = true; if (needs && root.offsetParent) draw(); });
    renderAll();
  }

  function renderAll() { renderHead(); renderHeaders(); resize(); }

  function brushPattern() {
    const p = S.project;
    if (!p.patterns.find((x) => x.id === V.brush)) V.brush = p.currentPattern;
    return M.getPattern(V.brush);
  }

  function renderHead() {
    if (!S.project) return;
    clear(head);
    const p = S.project;
    const bp = brushPattern();
    const brush = h("select", { "aria-label": "Pattern to place", tip: "Pick a pattern, then click in the Playlist to place it" },
      p.patterns.map((pt) => h("option", { value: pt.id, selected: pt.id === bp.id }, "🎨 " + pt.name)));
    brush.onchange = () => { V.brush = brush.value; p.currentPattern = brush.value; bus.emit("pattern:select"); M.changed("pattern-select", false); };
    const tool = (id, icon, tip) => h("button", { class: "tool-btn" + (V.tool === id ? " on" : ""), tip, "aria-pressed": String(V.tool === id), onclick: () => { V.tool = id; renderHead(); } }, icon);
    const snap = h("select", { "aria-label": "Snap", tip: "What clips snap to when you move them" }, [["bar", "Snap: Bar"], ["beat", "Snap: Beat"], ["step", "Snap: Step"], ["none", "No snap"]].map(([v, l]) => h("option", { value: v, selected: V.snap === v }, l)));
    snap.onchange = () => (V.snap = snap.value);
    head.append(
      h("div", { class: "tool-group" }, brush),
      h("div", { class: "tool-group" }, tool("paint", "🖌️", "Paint: click empty space to place the pattern. Drag clips to move them, drag the right edge to make them longer."), tool("select", "🔲", "Select: drag a box to select several clips"), tool("erase", "🧽", "Erase: click clips to remove them")),
      h("div", { class: "tool-group adv" }, snap),
      h("button", { class: "btn small", tip: "Arrange your song using a ready-made structure", onclick: (e) => templateMenu(e.currentTarget) }, "🏗️ Song Templates ▾"),
      h("button", { class: "btn small adv", tip: "Add a new track (lane)", onclick: (e) => addTrackMenu(e.currentTarget) }, "➕ Track"),
      h("button", { class: "btn small adv", tip: "Add a section marker (Intro, Verse, Chorus…) at the playhead", onclick: addMarker }, "🚩 Marker"),
      h("div", { class: "tool-group" },
        h("button", { class: "icon-btn", tip: "Zoom out", "aria-label": "Zoom out", onclick: () => zoom(1 / 1.25) }, "➖"),
        h("button", { class: "icon-btn", tip: "Zoom in", "aria-label": "Zoom in", onclick: () => zoom(1.25) }, "➕")),
      h("span", { class: "hint" }, p.mode === "song" ? "🎵 Song mode: Play plays this arrangement" : "Tip: switch the toolbar to SONG to play this arrangement"));
  }

  function templateMenu(anchor) {
    GBL.ui.menu(anchor, [{ header: "Uses the current pattern: " + M.getPattern().name }].concat(GBL.generator.STRUCTURES.map((s) => ({
      label: s.name, icon: "🏗️",
      onClick: async () => {
        if (S.project.clips.length && !(await GBL.ui.confirm("Use a song template?", "This replaces what's on the Drums track with " + s.name + ", built from your current pattern and some automatic variations.", "Build it"))) return;
        GBL.generator.applyStructure(S.project, s.id);
        M.changed("arrangement");
        bus.emit("mode");
        GBL.ui.toast("🏗️ Song arranged! Press Play to hear it.");
      },
    }))));
  }

  function addTrackMenu(anchor) {
    GBL.ui.menu(anchor, M.TRACK_TYPES.map((t) => ({ label: t.type, icon: t.icon, onClick: () => { S.project.tracks.push({ id: uid("trk"), name: t.type, type: t.type, color: t.color, mute: false, solo: false, insert: null }); M.changed("tracks"); } })));
  }

  async function addMarker() {
    const name = await GBL.ui.prompt("Marker name", "Chorus");
    if (!name) return;
    const spb = M.stepsPerBar(S.project);
    S.project.markers.push({ id: uid("mk"), start: Math.floor(GBL.audio.transport.position() / spb) * spb, name: name.trim() });
    M.changed("markers");
  }

  function renderHeaders() {
    clear(headersInner);
    const p = S.project;
    for (const t of p.tracks) {
      const tt = M.TRACK_TYPES.find((x) => x.type === t.type) || M.TRACK_TYPES[2];
      const m = h("button", { class: "mini-btn" + (t.mute ? " on mute" : ""), tip: "Mute track", "aria-pressed": String(!!t.mute), "aria-label": "Mute " + t.name, onclick: () => { t.mute = !t.mute; M.changed("tracks"); } }, "M");
      const s = h("button", { class: "mini-btn" + (t.solo ? " on" : ""), tip: "Solo track", "aria-pressed": String(!!t.solo), "aria-label": "Solo " + t.name, onclick: () => { t.solo = !t.solo; M.changed("tracks"); } }, "S");
      const name = h("button", { class: "trk-name", tip: "Track options", onclick: (e) => trackMenu(e.currentTarget, t) }, h("span", {}, tt.icon), h("span", { class: "trk-label" }, t.name));
      headersInner.append(h("div", { class: "trk-head", style: { "--c": t.color, height: V.trackH + "px" } }, name, h("div", { class: "trk-btns" }, m, s)));
    }
  }

  function trackMenu(anchor, t) {
    const p = S.project;
    GBL.ui.menu(anchor, [
      { label: "Rename…", icon: "✏️", onClick: () => GBL.ui.prompt("Rename track", t.name).then((n) => { if (n && n.trim()) { t.name = n.trim(); M.changed("tracks"); } }) },
      { header: "Track type" },
      ...M.TRACK_TYPES.map((x) => ({ label: x.type, icon: x.icon, checked: t.type === x.type, onClick: () => { t.type = x.type; t.color = x.color; M.changed("tracks"); } })),
      { sep: true },
      { label: "Audio goes to: " + (t.insert ? (M.getInsert(t.insert) || {}).name || "Master" : "Master"), icon: "🎚️", onClick: () => routeMenu(anchor, t) },
      { label: "Delete track", icon: "🗑️", disabled: p.tracks.length <= 1, onClick: async () => {
        if (p.clips.some((c) => c.track === t.id) && !(await GBL.ui.confirm("Delete track?", "Delete “" + t.name + "” and its clips?", "Delete"))) return;
        p.tracks = p.tracks.filter((x) => x !== t);
        p.clips = p.clips.filter((c) => c.track !== t.id);
        M.changed("tracks");
      } },
    ]);
  }
  function routeMenu(anchor, t) {
    const p = S.project;
    GBL.ui.menu(anchor, [{ label: "Master", checked: !t.insert, onClick: () => { t.insert = null; M.changed("tracks"); } },
      { label: "New mixer insert for this track", icon: "➕", onClick: () => { const ins = M.addInsert(t.name, t.color); t.insert = ins.id; M.changed("tracks"); } }]
      .concat(p.mixer.inserts.map((i) => ({ label: i.name, checked: t.insert === i.id, onClick: () => { t.insert = i.id; M.changed("tracks"); } }))));
  }

  /* ---------- geometry ---------- */
  const xOf = (s) => s * V.zoomX - scroller.scrollLeft;
  const stepAt = (x) => (x + scroller.scrollLeft) / V.zoomX;
  const yOfTrack = (i) => RULER + i * V.trackH - scroller.scrollTop;
  const trackAt = (y) => Math.floor((y - RULER + scroller.scrollTop) / V.trackH);
  function snapUnit() {
    const p = S.project;
    return V.snap === "bar" ? M.stepsPerBar(p) : V.snap === "beat" ? M.stepsPerBeat(p) : V.snap === "step" ? 1 : 0;
  }
  const snapF = (s) => { const u = snapUnit(); return u ? Math.floor(s / u) * u : s; };
  const snapR = (s) => { const u = snapUnit(); return u ? Math.round(s / u) * u : s; };

  function totalSteps() { return M.songLength() + M.stepsPerBar(S.project) * 16; }

  function resize() {
    if (!scroller) return;
    W = Math.max(100, scroller.clientWidth);
    H = Math.max(60, scroller.clientHeight);
    spacer.style.width = totalSteps() * V.zoomX + "px";
    spacer.style.height = RULER + S.project.tracks.length * V.trackH + 40 + "px";
    ctx = fitCanvas(canvas, W, H);
    needs = true;
    if (root.offsetParent) draw();
  }
  function zoom(f, ax) {
    const old = V.zoomX;
    V.zoomX = clamp(V.zoomX * f, 1.2, 40);
    ax = ax == null ? W / 2 : ax;
    const st = (scroller.scrollLeft + ax) / old;
    resize();
    scroller.scrollLeft = st * V.zoomX - ax;
  }

  function clipRect(c) {
    const ti = S.project.tracks.findIndex((t) => t.id === c.track);
    return { x: xOf(c.start), y: yOfTrack(ti) + 2, w: c.len * V.zoomX, h: V.trackH - 4, ti };
  }
  function hitClip(x, y) {
    const list = S.project.clips;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i], r = clipRect(c);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        const edge = x > r.x + r.w - 8 ? "right" : c.type === "audio" && x < r.x + 8 ? "left" : null;
        return { c, edge };
      }
    }
    return null;
  }

  function clipName(c) {
    if (c.type === "audio") return "🔊 " + GBL.audio.refName(c.ref);
    const pt = S.project.patterns.find((x) => x.id === c.ref);
    return pt ? pt.name : "?";
  }
  function clipColor(c) {
    if (c.type === "audio") { const t = M.getTrack(c.track); return t ? t.color : "#f472b6"; }
    const pt = S.project.patterns.find((x) => x.id === c.ref);
    return pt ? pt.color : "#888";
  }

  /* ---------- draw ---------- */
  function draw() {
    needs = false;
    if (!ctx || !S.project) return;
    const p = S.project;
    const css = getComputedStyle(document.documentElement);
    const col = (n) => css.getPropertyValue(n).trim();
    ctx.clearRect(0, 0, W, H);
    const spBar = M.stepsPerBar(p), spBeat = M.stepsPerBeat(p);
    // lanes
    p.tracks.forEach((t, i) => {
      const y = yOfTrack(i);
      if (y > H || y + V.trackH < RULER) return;
      ctx.fillStyle = i % 2 ? col("--lane-a") : col("--lane-b");
      ctx.fillRect(0, y, W, V.trackH);
      if (!M.trackAudible(t, p)) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(0, y, W, V.trackH); }
    });
    // grid
    const s0 = Math.floor(stepAt(0)), s1 = Math.ceil(stepAt(W));
    for (let s = Math.floor(s0 / spBeat) * spBeat; s <= s1; s += spBeat) {
      const x = Math.round(xOf(s)) + 0.5;
      if (s % spBar === 0) ctx.fillStyle = col("--grid-bar");
      else { if (V.zoomX * spBeat < 8) continue; ctx.fillStyle = col("--grid-line"); }
      ctx.fillRect(x, RULER, 1, H - RULER);
    }
    // song end
    const end = xOf(M.songLength());
    ctx.fillStyle = "rgba(250, 204, 21, 0.5)";
    if (end > 0 && end < W) ctx.fillRect(end, RULER, 2, H - RULER);
    // clips
    ctx.textBaseline = "top";
    for (const c of p.clips) {
      const r = clipRect(c);
      if (r.ti < 0 || r.x > W || r.x + r.w < 0 || r.y > H || r.y + r.h < RULER) continue;
      const color = clipColor(c);
      const sel = V.sel.has(c.id);
      ctx.fillStyle = hexToRgba(color, 0.32);
      rr(r.x + 0.5, r.y, r.w - 1, r.h, 5); ctx.fill();
      ctx.fillStyle = hexToRgba(color, 0.9);
      ctx.save(); rr(r.x + 0.5, r.y, r.w - 1, r.h, 5); ctx.clip();
      ctx.fillRect(r.x, r.y, r.w, 15);
      ctx.fillStyle = "rgba(10,10,20,0.85)";
      ctx.font = "700 11px Fredoka, system-ui, sans-serif";
      ctx.fillText(clipName(c), r.x + 5, r.y + 2);
      drawClipBody(c, r, color);
      ctx.restore();
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeStyle = sel ? "#ffffff" : hexToRgba(color, 1);
      rr(r.x + 0.5, r.y, r.w - 1, r.h, 5); ctx.stroke();
    }
    // selection box
    if (V.box) {
      ctx.fillStyle = "rgba(34, 211, 238, 0.15)"; ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
      const x = Math.min(V.box.x0, V.box.x1), y = Math.min(V.box.y0, V.box.y1), w = Math.abs(V.box.x1 - V.box.x0), hh = Math.abs(V.box.y1 - V.box.y0);
      ctx.fillRect(x, y, w, hh); ctx.strokeRect(x + 0.5, y + 0.5, w, hh);
    }
    // ruler
    ctx.fillStyle = col("--panel-2");
    ctx.fillRect(0, 0, W, RULER);
    ctx.fillStyle = col("--text-dim");
    ctx.font = "600 11px Fredoka, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const every = V.zoomX * spBar < 26 ? 4 : V.zoomX * spBar < 50 ? 2 : 1;
    for (let s = Math.floor(s0 / spBar) * spBar; s <= s1; s += spBar) {
      const bar = s / spBar;
      const x = xOf(s);
      ctx.fillRect(x, RULER - 7, 1, 7);
      if (bar % every === 0) ctx.fillText(String(bar + 1), x + 3, 9);
    }
    // markers
    for (const mk of p.markers) {
      const x = xOf(mk.start);
      if (x < -100 || x > W) continue;
      ctx.font = "700 10px Fredoka, system-ui, sans-serif";
      const tw = ctx.measureText(mk.name).width + 10;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(x, 13, tw, 13);
      ctx.fillStyle = "#1a1a2e";
      ctx.fillText(mk.name, x + 5, 19.5);
    }
    // playhead
    if (p.mode === "song" || GBL.audio.transport.pos > 0) {
      const pos = p.mode === "song" ? GBL.audio.transport.position() : null;
      if (pos != null) {
        const x = xOf(pos);
        if (x >= 0 && x <= W) {
          ctx.fillStyle = col("--playhead");
          ctx.fillRect(x - 1, 0, 2, H);
          ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.lineTo(x + 6, 0); ctx.lineTo(x, 8); ctx.closePath(); ctx.fill();
        }
        // follow the playhead while playing
        if (GBL.audio.transport.playing && (x > W - 40 || x < 0) && !V.dragging) scroller.scrollLeft = Math.max(0, pos * V.zoomX - 60);
      }
    }
  }

  function drawClipBody(c, r, color) {
    const top = r.y + 16, hh = r.h - 18;
    if (hh < 6) return;
    if (c.type === "audio") {
      const buf = GBL.audio.resolveBuffer(c.ref);
      if (!buf) { ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillText("missing audio", r.x + 5, top + 4); return; }
      const pk = peaks(buf);
      const sd = 60 / S.project.bpm / 4;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const mid = top + hh / 2;
      const x0 = Math.max(r.x, 0), x1 = Math.min(r.x + r.w, W);
      for (let x = x0; x < x1; x += 1) {
        const sec = (c.offset || 0) + ((x - r.x) / V.zoomX) * sd;
        if (sec >= buf.duration) break;
        const v = pk[Math.floor((sec / buf.duration) * pk.length)] * (c.gain == null ? 1 : c.gain);
        const a = Math.min(1, v) * hh / 2;
        ctx.fillRect(x, mid - a, 1, a * 2 || 1);
      }
      return;
    }
    const pt = S.project.patterns.find((x) => x.id === c.ref);
    if (!pt) return;
    const L = pt.length;
    // collect note range
    let lo = 127, hi = 0, any = false;
    for (const list of Object.values(pt.notes)) for (const n of list) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); any = true; }
    const range = Math.max(8, hi - lo + 1);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (let rep = 0; rep * L < c.len; rep++) {
      const bx = r.x + rep * L * V.zoomX;
      if (bx > W) break;
      if (rep > 0) { ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(bx, top, 1, hh); ctx.fillStyle = "rgba(255,255,255,0.8)"; }
      if (bx + L * V.zoomX < 0) continue;
      if (any) {
        for (const list of Object.values(pt.notes)) for (const n of list) {
          if (rep * L + n.s >= c.len) continue;
          const x = bx + n.s * V.zoomX, w = Math.max(1, Math.min(n.l, c.len - rep * L - n.s) * V.zoomX - 1);
          const y = top + hh - ((n.p - lo + 0.5) / range) * hh;
          ctx.fillRect(x, y - 1, w, 2);
        }
      }
      // drum steps as dots on the lower part
      const rows = Object.entries(pt.steps).filter(([, a]) => a.some((v) => v > 0));
      if (rows.length && !any) {
        const rh = hh / Math.max(rows.length, 1);
        rows.forEach(([, a], ri) => {
          for (let i = 0; i < a.length; i++) if (a[i] > 0 && rep * L + i < c.len) ctx.fillRect(bx + i * V.zoomX, top + ri * rh, Math.max(1, V.zoomX - 1), Math.max(1, rh - 1));
        });
      }
    }
  }
  function rr(x, y, w, hh, r) {
    r = Math.min(r, w / 2, hh / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + hh, r); ctx.arcTo(x + w, y + hh, x, y + hh, r); ctx.arcTo(x, y + hh, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ---------- interaction ---------- */
  function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  function onHover(e) {
    if (V.dragging) return;
    const pt = local(e);
    let cur = "default";
    if (pt.y < RULER) cur = "pointer";
    else {
      const ht = hitClip(pt.x, pt.y);
      cur = ht ? (ht.edge ? "ew-resize" : V.tool === "erase" ? "not-allowed" : "grab") : V.tool === "paint" ? "copy" : "default";
    }
    canvas.style.cursor = cur;
  }

  function setSongMode() {
    if (S.project.mode !== "song") { S.project.mode = "song"; bus.emit("mode"); M.changed("mode", false); }
  }

  function onDown(e) {
    GBL.layout.focus("playlist");
    canvas.focus({ preventScroll: true });
    e.preventDefault();
    const pt = local(e);
    const p = S.project;
    if (pt.y < RULER) {
      // markers
      const mk = p.markers.find((m) => { const x = xOf(m.start); return pt.y > 12 && pt.x >= x && pt.x <= x + 60; });
      if (mk && e.button === 2) { markerMenu(e, mk); return; }
      setSongMode();
      const seek = (x) => GBL.audio.transport.setPos(Math.max(0, snapF(stepAt(x))));
      seek(pt.x);
      GBL.drag(e, (dx, dy, ev) => seek(local(ev).x));
      return;
    }
    const ht = hitClip(pt.x, pt.y);
    if (e.button === 2) { if (ht) clipMenu(e, ht.c); return; }
    if (V.tool === "erase") {
      const del = (q) => { const x = hitClip(q.x, q.y); if (x) { p.clips = p.clips.filter((c) => c !== x.c); needs = true; } };
      del(pt);
      GBL.drag(e, (dx, dy, ev) => del(local(ev)), () => M.changed("clips"));
      return;
    }
    if (ht) {
      if (!V.sel.has(ht.c.id)) { if (!e.shiftKey) V.sel.clear(); V.sel.add(ht.c.id); }
      if (ht.edge === "right") return startResize(e, ht.c);
      if (ht.edge === "left") return startTrim(e, ht.c);
      return startMove(e, pt, e.ctrlKey || e.metaKey || e.altKey);
    }
    if (V.tool === "select" || e.shiftKey) {
      if (e.pointerType === "touch") { const sl = scroller.scrollLeft, st = scroller.scrollTop; GBL.drag(e, (dx, dy) => { scroller.scrollLeft = sl - dx; scroller.scrollTop = st - dy; }); return; }
      return startBox(e, pt);
    }
    // paint a new clip
    const ti = trackAt(pt.y);
    if (ti < 0 || ti >= p.tracks.length) return;
    const pat = brushPattern();
    const start = Math.max(0, snapF(stepAt(pt.x)));
    const c = { id: uid("clip"), track: p.tracks[ti].id, type: "pattern", ref: pat.id, start, len: pat.length };
    p.clips.push(c);
    V.sel.clear();
    V.sel.add(c.id);
    setSongMode();
    needs = true;
    startMove(e, pt, false, true);
  }

  function startMove(e, pt, dup, fresh) {
    const p = S.project;
    let list = p.clips.filter((c) => V.sel.has(c.id));
    if (dup) {
      V.sel.clear();
      list = list.map((c) => { const n = Object.assign({}, c, { id: uid("clip") }); p.clips.push(n); V.sel.add(n.id); return n; });
    }
    const orig = list.map((c) => ({ c, start: c.start, ti: p.tracks.findIndex((t) => t.id === c.track) }));
    const s0 = stepAt(pt.x), t0 = trackAt(pt.y);
    let moved = false;
    V.dragging = true;
    GBL.drag(e, (dx, dy, ev) => {
      const l = local(ev);
      let ds = stepAt(l.x) - s0;
      const u = snapUnit();
      ds = u ? Math.round(ds / u) * u : ds;
      const minStart = Math.min(...orig.map((o) => o.start));
      if (minStart + ds < 0) ds = -minStart;
      let dt = trackAt(l.y) - t0;
      const minT = Math.min(...orig.map((o) => o.ti)), maxT = Math.max(...orig.map((o) => o.ti));
      dt = clamp(dt, -minT, p.tracks.length - 1 - maxT);
      for (const o of orig) { o.c.start = o.start + ds; o.c.track = p.tracks[o.ti + dt].id; }
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      needs = true;
    }, () => { V.dragging = false; if (moved || dup || fresh) M.changed("clips"); resize(); });
  }

  function startResize(e, clip) {
    const list = S.project.clips.filter((c) => V.sel.has(c.id));
    const orig = list.map((c) => ({ c, len: c.len }));
    V.dragging = true;
    GBL.drag(e, (dx) => {
      let dl = dx / V.zoomX;
      const u = snapUnit() || 0;
      dl = u ? Math.round(dl / u) * u : dl;
      for (const o of orig) {
        let len = Math.max(1, o.len + dl);
        if (o.c.type === "audio") {
          const buf = GBL.audio.resolveBuffer(o.c.ref);
          if (buf) len = Math.min(len, Math.ceil((buf.duration - (o.c.offset || 0)) / (60 / S.project.bpm / 4)));
        }
        o.c.len = len;
      }
      needs = true;
    }, () => { V.dragging = false; M.changed("clips"); resize(); });
    void clip;
  }

  function startTrim(e, clip) {
    const sd = 60 / S.project.bpm / 4;
    const o = { start: clip.start, len: clip.len, off: clip.offset || 0 };
    V.dragging = true;
    GBL.drag(e, (dx) => {
      let ds = dx / V.zoomX;
      const u = snapUnit() === M.stepsPerBar(S.project) ? 1 : snapUnit();
      ds = u ? Math.round(ds / u) * u : ds;
      ds = clamp(ds, -o.off / sd, o.len - 1);
      ds = Math.max(ds, -o.start);
      clip.start = o.start + ds;
      clip.len = o.len - ds;
      clip.offset = Math.max(0, o.off + ds * sd);
      needs = true;
    }, () => { V.dragging = false; M.changed("clips"); });
  }

  function startBox(e, pt) {
    if (!e.shiftKey) V.sel.clear();
    V.box = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    GBL.drag(e, (dx, dy, ev) => {
      const l = local(ev);
      V.box.x1 = l.x; V.box.y1 = l.y;
      const x0 = Math.min(V.box.x0, V.box.x1), x1 = Math.max(V.box.x0, V.box.x1), y0 = Math.min(V.box.y0, V.box.y1), y1 = Math.max(V.box.y0, V.box.y1);
      V.sel.clear();
      for (const c of S.project.clips) { const r = clipRect(c); if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) V.sel.add(c.id); }
      needs = true;
    }, () => { V.box = null; needs = true; });
  }

  function onDbl(e) {
    const pt = local(e);
    if (pt.y < RULER) { addMarkerAt(Math.max(0, snapF(stepAt(pt.x)))); return; }
    const ht = hitClip(pt.x, pt.y);
    if (ht && ht.c.type === "pattern") openPattern(ht.c.ref);
  }
  async function addMarkerAt(start) {
    const name = await GBL.ui.prompt("Add a section marker", "Verse");
    if (!name) return;
    S.project.markers.push({ id: uid("mk"), start, name: name.trim() });
    M.changed("markers");
  }
  function markerMenu(e, mk) {
    GBL.ui.menu({ x: e.clientX, y: e.clientY }, [
      { label: "Rename marker…", icon: "✏️", onClick: () => GBL.ui.prompt("Rename marker", mk.name).then((n) => { if (n) { mk.name = n.trim(); M.changed("markers"); } }) },
      { label: "Delete marker", icon: "🗑️", onClick: () => { S.project.markers = S.project.markers.filter((m) => m !== mk); M.changed("markers"); } },
    ]);
  }

  function openPattern(id) {
    S.project.currentPattern = id;
    V.brush = id;
    bus.emit("pattern:select");
    M.changed("pattern-select", false);
    GBL.layout.reveal("rack");
    GBL.ui.toast("Editing “" + M.getPattern(id).name + "” in the Channel Rack");
  }

  function clipMenu(e, c) {
    const p = S.project;
    const items = [];
    if (c.type === "pattern") {
      items.push({ label: "Edit this pattern", icon: "✏️", onClick: () => openPattern(c.ref) });
      items.push({ label: "Make unique (copy the pattern)", icon: "🧬", onClick: () => { const np = M.addPattern(null, c.ref); c.ref = np.id; M.changed("clips"); } });
    } else {
      items.push({ label: "Clip volume: " + Math.round((c.gain == null ? 1 : c.gain) * 100) + "%", icon: "🔉", onClick: async () => {
        const v = await GBL.ui.prompt("Clip volume (0–200%)", String(Math.round((c.gain == null ? 1 : c.gain) * 100)));
        if (v != null && !isNaN(+v)) { c.gain = clamp(+v / 100, 0, 2); M.changed("clips"); }
      } });
      items.push({ label: "Use as a Channel Rack sound", icon: "🥁", onClick: () => M.addChannel({ kind: "sample", sound: c.ref, name: GBL.audio.refName(c.ref) }) });
    }
    items.push({ label: "Duplicate after", icon: "⧉", onClick: () => { p.clips.push(Object.assign({}, c, { id: uid("clip"), start: c.start + c.len })); M.changed("clips"); } });
    items.push({ label: "Delete", icon: "🗑️", onClick: () => { p.clips = p.clips.filter((x) => x !== c); V.sel.delete(c.id); M.changed("clips"); } });
    GBL.ui.menu({ x: e.clientX, y: e.clientY }, items);
  }

  function onKey(e) {
    const p = S.project;
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === "Delete" || e.key === "Backspace") { if (!V.sel.size) return false; p.clips = p.clips.filter((c) => !V.sel.has(c.id)); V.sel.clear(); M.changed("clips"); return true; }
    if (ctrl && e.key.toLowerCase() === "a") { V.sel = new Set(p.clips.map((c) => c.id)); needs = true; return true; }
    if (ctrl && e.key.toLowerCase() === "c") { V.clipboard = p.clips.filter((c) => V.sel.has(c.id)).map((c) => Object.assign({}, c)); if (V.clipboard.length) GBL.ui.toast("Copied " + V.clipboard.length + " clip(s)"); return true; }
    if (ctrl && e.key.toLowerCase() === "v") {
      if (!V.clipboard || !V.clipboard.length) return true;
      const lo = Math.min(...V.clipboard.map((c) => c.start));
      const at = snapF(GBL.audio.transport.position());
      V.sel.clear();
      for (const c of V.clipboard) { const n = Object.assign({}, c, { id: uid("clip"), start: at + c.start - lo }); p.clips.push(n); V.sel.add(n.id); }
      M.changed("clips");
      return true;
    }
    if (ctrl && e.key.toLowerCase() === "d") {
      const list = p.clips.filter((c) => V.sel.has(c.id));
      if (!list.length) return true;
      const lo = Math.min(...list.map((c) => c.start)), hi = Math.max(...list.map((c) => c.start + c.len));
      V.sel.clear();
      for (const c of list) { const n = Object.assign({}, c, { id: uid("clip"), start: c.start + (hi - lo) }); p.clips.push(n); V.sel.add(n.id); }
      M.changed("clips");
      return true;
    }
    return false;
  }

  /* drops: samples, recordings and audio files become audio clips */
  function setupDrop() {
    scroller.addEventListener("dragover", (e) => { if (e.dataTransfer.types.includes("application/x-gbl") || e.dataTransfer.types.includes("Files")) { e.preventDefault(); scroller.classList.add("drop"); } });
    scroller.addEventListener("dragleave", () => scroller.classList.remove("drop"));
    scroller.addEventListener("drop", async (e) => {
      e.preventDefault();
      scroller.classList.remove("drop");
      const pt = local(e);
      const p = S.project;
      const ti = clamp(trackAt(pt.y), 0, p.tracks.length - 1);
      const start = Math.max(0, snapF(stepAt(pt.x)));
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        const ids = await GBL.recorder.importFiles(e.dataTransfer.files, null);
        let s = start;
        for (const id of ids) { addAudioClip("asset:" + id, p.tracks[ti].id, s); s += clipLenFor("asset:" + id); }
        return;
      }
      let d = null;
      try { d = JSON.parse(e.dataTransfer.getData("application/x-gbl")); } catch (er) { /* */ }
      if (!d) return;
      if (d.kind === "sample") { await GBL.samples.render(d.ref); addAudioClip(d.ref, p.tracks[ti].id, start); }
      if (d.kind === "pattern") { p.clips.push({ id: uid("clip"), track: p.tracks[ti].id, type: "pattern", ref: d.id, start, len: M.getPattern(d.id).length }); setSongMode(); M.changed("clips"); }
    });
  }
  function clipLenFor(ref) {
    const buf = GBL.audio.resolveBuffer(ref);
    const sd = 60 / S.project.bpm / 4;
    return buf ? Math.max(1, Math.ceil(buf.duration / sd)) : 16;
  }
  function addAudioClip(ref, trackId, start) {
    const c = { id: uid("clip"), track: trackId, type: "audio", ref, start, len: clipLenFor(ref), offset: 0, gain: 1 };
    S.project.clips.push(c);
    setSongMode();
    M.changed("clips");
    return c;
  }

  GBL.playlist = { build, onKey, addAudioClip, clipLenFor, resize, view: V, redraw: () => { needs = true; } };
})();
