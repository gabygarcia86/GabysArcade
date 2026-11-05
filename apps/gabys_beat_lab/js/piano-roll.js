/* PianoRollEditor: canvas-based MIDI note editor. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, uid, clamp, fitCanvas, hexToRgba } = GBL;
  const M = GBL.model;
  const S = M.state;
  const T = GBL.theory;

  const KEYW = 64, RULER = 22, VELH = 64;
  const V = { zoomX: 24, rowH: 16, snap: 1, tool: "draw", scale: "none", lastLen: 2, sel: new Set(), cursor: 0, box: null, held: null, progs: {} };

  let root, head, chordBar, scroller, spacer, canvas, velCanvas, ctx, vctx;
  let W = 300, H = 200;
  let needs = true;
  let hover = null;

  const chan = () => M.getChannel(S.pianoRollChannel) || S.project.channels[0];
  const pat = () => M.getPattern();
  const notes = () => { const c = chan(); return c ? M.notesFor(pat(), c.id) : []; };
  const scale = () => T.scaleById(V.scale);
  const helpOn = () => GBL.settings.get("helpMusic");

  function build(el) {
    root = el;
    head = h("div", { class: "editor-tools pr-tools" });
    chordBar = h("div", { class: "chord-bar" });
    canvas = h("canvas", { class: "pr-canvas", tabindex: 0, "aria-label": "Piano roll note grid. Click to add notes." });
    spacer = h("div", { class: "pr-spacer" });
    scroller = h("div", { class: "pr-scroll" }, canvas, spacer);
    velCanvas = h("canvas", { class: "pr-vel adv", "aria-label": "Note velocity lane" });
    const velWrap = h("div", { class: "pr-vel-wrap adv" }, h("div", { class: "pr-vel-label" }, "Velocity"), velCanvas);
    root.append(head, chordBar, scroller, velWrap);
    scroller.addEventListener("scroll", () => (needs = true));
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onHover);
    canvas.addEventListener("pointerleave", () => { hover = null; needs = true; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDbl);
    velCanvas.addEventListener("pointerdown", onVelDown);
    new ResizeObserver(() => { resize(); }).observe(scroller);
    bus.on("project:loaded", () => { V.sel.clear(); renderHead(); scrollToNotes(); needs = true; });
    bus.on("change", (s) => { if (s !== "live" && s !== "pr") renderHead(); needs = true; });
    bus.on("select", () => { V.sel.clear(); renderHead(); scrollToNotes(); needs = true; });
    bus.on("pattern:select", () => { V.sel.clear(); renderHead(); needs = true; });
    bus.on("settings", (k) => { if (k === "helpMusic") { if (helpOn() && V.scale === "none") V.scale = "C-major"; renderHead(); needs = true; } });
    bus.on("frame", () => { if (GBL.audio.transport.playing) needs = true; if (needs && visible()) draw(); });
    renderHead();
    requestAnimationFrame(() => { resize(); scrollToNotes(); });
  }
  const visible = () => root && root.offsetParent !== null;

  function renderHead() {
    if (!S.project) return;
    clear(head);
    const p = S.project;
    const chSel = h("select", { "aria-label": "Channel to edit", tip: "Which instrument's notes you are editing" },
      p.channels.map((c) => h("option", { value: c.id, selected: c.id === (chan() && chan().id) }, (c.kind === "synth" ? "🎹 " : "🥁 ") + c.name)));
    chSel.onchange = () => { S.pianoRollChannel = chSel.value; S.selectedChannel = chSel.value; V.sel.clear(); bus.emit("select"); };
    const tool = (id, icon, tip) => h("button", { class: "tool-btn" + (V.tool === id ? " on" : ""), tip, "aria-pressed": String(V.tool === id), onclick: () => { V.tool = id; renderHead(); } }, icon);
    const snapSel = h("select", { "aria-label": "Snap to grid", tip: "Snap: notes line up to this grid" },
      [[0, "No snap"], [0.25, "1/64"], [0.5, "1/32"], [1, "1/16 (step)"], [2, "1/8"], [4, "1/4 (beat)"], [8, "1/2"], [16, "Bar"]].map(([v, l]) => h("option", { value: v, selected: v === V.snap }, l)));
    snapSel.onchange = () => { V.snap = +snapSel.value; };
    const scaleSel = h("select", { "aria-label": "Scale", tip: "Highlight the notes of a musical scale" }, T.SCALES.map((s) => h("option", { value: s.id, selected: s.id === V.scale }, s.name)));
    scaleSel.onchange = () => { V.scale = scaleSel.value; renderHead(); needs = true; };
    const help = h("button", { class: "btn help-btn" + (helpOn() ? " on" : ""), tip: "Highlights the notes that sound good together and shows chord buttons", "aria-pressed": String(!!helpOn()), onclick: () => GBL.settings.set("helpMusic", !helpOn()) }, "💡 HELP ME MAKE MUSIC");
    head.append(
      h("div", { class: "tool-group" }, chSel),
      h("div", { class: "tool-group" }, tool("draw", "✏️", "Draw: click to add notes, drag to move, drag the right edge to resize. Right-click deletes."), tool("select", "🔲", "Select: drag a box to select notes"), tool("erase", "🧽", "Erase: click or drag over notes to delete")),
      h("div", { class: "tool-group" }, snapSel, scaleSel),
      help,
      h("div", { class: "tool-group" },
        h("button", { class: "btn small", tip: "Write a chord progression in the selected scale", onclick: () => generate("chords") }, "🎹 Chords"),
        h("button", { class: "btn small", tip: "Write a melody that fits the chords", onclick: () => generate("melody") }, "🎶 Melody"),
        h("button", { class: "btn small", tip: "Write a bassline that fits the chords", onclick: () => generate("bass") }, "🎸 Bassline")),
      h("div", { class: "tool-group adv" },
        h("button", { class: "btn small", tip: "Line up notes with the grid (selected notes, or all)", onclick: quantize }, "Quantize"),
        h("button", { class: "btn small", tip: "Duplicate selected notes (Ctrl+D)", onclick: duplicate }, "Duplicate"),
        h("button", { class: "btn small", tip: "Delete selected notes (Delete)", onclick: deleteSel }, "Delete"),
        h("button", { class: "btn small", tip: "Clear all notes for this channel in this pattern", onclick: clearAll }, "Clear")),
      h("div", { class: "tool-group" },
        h("button", { class: "icon-btn", tip: "Zoom out", "aria-label": "Zoom out", onclick: () => zoom(1 / 1.25) }, "➖"),
        h("button", { class: "icon-btn", tip: "Zoom in", "aria-label": "Zoom in", onclick: () => zoom(1.25) }, "➕"),
        h("button", { class: "icon-btn adv", tip: "Taller / shorter keys", "aria-label": "Key height", onclick: () => { V.rowH = V.rowH >= 22 ? 12 : V.rowH + 5; resize(); } }, "↕")));
    renderChordBar();
  }

  function renderChordBar() {
    clear(chordBar);
    chordBar.hidden = !helpOn();
    if (!helpOn()) return;
    const sc = scale().mode ? scale() : T.SCALES[1];
    chordBar.append(h("span", { class: "chord-label" }, "Chords in " + sc.name + ":"));
    for (const c of T.chordSuggestions(sc)) {
      const good = [0, 3, 4, 5].includes(c.degree);
      chordBar.append(h("button", { class: "chord-chip" + (good ? " good" : ""), tip: "Add " + c.name + " at the marker. ⭐ = great choice", onclick: () => insertChord(c.notes) },
        h("b", {}, c.name), h("small", {}, c.roman + (good ? " ⭐" : ""))));
    }
    chordBar.append(h("span", { class: "chord-hint" }, "Click chords one after another to build a progression."));
  }

  function insertChord(chordNotes) {
    const c = chan();
    if (!c) return;
    const len = Math.max(4, V.lastLen >= 4 ? V.lastLen : 8);
    const list = notes();
    const s = V.cursor;
    for (const n of chordNotes) list.push({ id: uid("n"), p: n, s, l: len, v: 0.75 });
    autoExtend(s + len);
    for (const n of chordNotes) GBL.audio.engine.hit(c, n, 0.7, 0.5);
    V.cursor = s + len;
    M.changed("notes");
  }

  function generate(kind) {
    const c = chan();
    if (!c) return;
    const p = S.project, pt = pat();
    const G = GBL.generator;
    let sc = scale();
    if (!sc.mode) { sc = T.scaleById("C-major"); V.scale = sc.id; }
    const spb = M.stepsPerBar(p);
    if (pt.length < spb * 4) { G.extendPattern(pt, spb * 4); GBL.ui.toast("Made the pattern 4 bars long so the music has room"); }
    const key = pt.id + sc.id;
    if (!V.progs[key] || kind === "chords") V.progs[key] = G.progression(sc);
    const prog = V.progs[key];
    const chords = G.chordsFor(p, pt, sc, prog);
    if (kind === "chords") G.makeChords(p, pt, c, sc, { prog, rhythm: GBL.pick(["sustain", "half", "pulse"]) });
    else if (kind === "melody") G.makeMelody(p, pt, c, sc, chords, {});
    else G.makeBass(p, pt, c, sc, chords, { bassStyle: GBL.pick(["follow", "eighths", "offbeat", "funk"]) });
    V.sel.clear();
    M.changed("notes");
    scrollToNotes();
    GBL.ui.toast({ chords: "🎹 Chords", melody: "🎶 Melody", bass: "🎸 Bassline" }[kind] + " written in " + sc.name + ". Press Play!");
  }

  function quantize() {
    const snap = V.snap || 1;
    const list = V.sel.size ? notes().filter((n) => V.sel.has(n.id)) : notes();
    for (const n of list) { n.s = Math.max(0, Math.round(n.s / snap) * snap); n.l = Math.max(snap, Math.round(n.l / snap) * snap); }
    M.changed("notes");
    GBL.ui.toast("Quantized " + list.length + " notes");
  }
  function selected() { return notes().filter((n) => V.sel.has(n.id)); }
  function duplicate() {
    const list = V.sel.size ? selected() : notes().slice();
    if (!list.length) return;
    const lo = Math.min(...list.map((n) => n.s)), hi = Math.max(...list.map((n) => n.s + n.l));
    const spb = M.stepsPerBeat(S.project) * 4;
    const span = Math.ceil((hi - lo) / spb) * spb || spb;
    V.sel.clear();
    const all = notes();
    for (const n of list) { const c = Object.assign({}, n, { id: uid("n"), s: n.s + span }); all.push(c); V.sel.add(c.id); }
    autoExtend(hi + span);
    M.changed("notes");
  }
  function deleteSel() {
    if (!V.sel.size) return;
    const c = chan();
    pat().notes[c.id] = notes().filter((n) => !V.sel.has(n.id));
    V.sel.clear();
    M.changed("notes");
  }
  async function clearAll() {
    const c = chan();
    if (!c || !notes().length) return;
    if (!(await GBL.ui.confirm("Clear notes?", "Remove all of " + c.name + "'s notes in this pattern?", "Clear"))) return;
    pat().notes[c.id] = [];
    V.sel.clear();
    M.changed("notes");
  }
  function copy() {
    const list = V.sel.size ? selected() : [];
    if (!list.length) return false;
    const lo = Math.min(...list.map((n) => n.s));
    S.clipboard.notes = list.map((n) => ({ p: n.p, s: n.s - lo, l: n.l, v: n.v }));
    GBL.ui.toast("Copied " + list.length + " notes");
    return true;
  }
  function paste() {
    if (!S.clipboard.notes) return;
    const all = notes();
    V.sel.clear();
    let end = 0;
    for (const n of S.clipboard.notes) { const c = { id: uid("n"), p: n.p, s: V.cursor + n.s, l: n.l, v: n.v }; all.push(c); V.sel.add(c.id); end = Math.max(end, c.s + c.l); }
    autoExtend(end);
    M.changed("notes");
  }

  function autoExtend(end) {
    const pt = pat();
    if (end > pt.length) {
      const spb = M.stepsPerBar(S.project);
      M.setPatternLength(pt, Math.min(256, Math.ceil(end / spb) * spb));
    }
  }

  function zoom(f, anchorX) {
    const old = V.zoomX;
    V.zoomX = clamp(V.zoomX * f, 6, 80);
    const ax = anchorX == null ? scroller.clientWidth / 2 : anchorX;
    const stepAt = (scroller.scrollLeft + ax - KEYW) / old;
    resize();
    scroller.scrollLeft = stepAt * V.zoomX - ax + KEYW;
  }

  function totalSteps() {
    let end = pat().length;
    for (const n of notes()) end = Math.max(end, n.s + n.l);
    return end + M.stepsPerBar(S.project);
  }

  let wantScroll = true;
  function resize() {
    if (!scroller) return;
    if (wantScroll && visible() && scroller.clientHeight > 0) { wantScroll = false; scrollToNotes(); }
    W = Math.max(100, scroller.clientWidth);
    H = Math.max(80, scroller.clientHeight);
    spacer.style.width = KEYW + totalSteps() * V.zoomX + "px";
    spacer.style.height = RULER + 128 * V.rowH + "px";
    ctx = fitCanvas(canvas, W, H);
    vctx = fitCanvas(velCanvas, W, VELH);
    needs = true;
    if (visible()) draw();
  }

  function scrollToNotes() {
    if (!scroller) return;
    if (!visible() || !scroller.clientHeight) { wantScroll = true; return; }
    const list = notes();
    let mid = 66;
    if (list.length) { const lo = Math.min(...list.map((n) => n.p)), hi = Math.max(...list.map((n) => n.p)); mid = (lo + hi) / 2; }
    else { const c = chan(); if (c && c.kind === "synth") { const inst = GBL.instruments.byId[c.inst]; if (inst && inst.cat === "Bass") mid = 42; } }
    requestAnimationFrame(() => { scroller.scrollTop = (127 - mid) * V.rowH - scroller.clientHeight / 2 + RULER; needs = true; });
  }

  /* ---------- coordinates ---------- */
  const xOf = (step) => KEYW + step * V.zoomX - scroller.scrollLeft;
  const yOf = (pitch) => RULER + (127 - pitch) * V.rowH - scroller.scrollTop;
  const stepAt = (x) => (x - KEYW + scroller.scrollLeft) / V.zoomX;
  const pitchAt = (y) => 127 - Math.floor((y - RULER + scroller.scrollTop) / V.rowH);
  const snapFloor = (s) => (V.snap ? Math.floor(s / V.snap) * V.snap : s);
  const snapRound = (s) => (V.snap ? Math.round(s / V.snap) * V.snap : s);

  function hit(x, y) {
    const s = stepAt(x), pch = pitchAt(y);
    const list = notes();
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      if (n.p === pch && s >= n.s && s < n.s + n.l) {
        const right = xOf(n.s + n.l);
        return { n, edge: right - x < Math.min(8, (n.l * V.zoomX) / 3) ? "right" : null };
      }
    }
    return null;
  }

  /* ---------- drawing ---------- */
  function draw() {
    needs = false;
    if (!ctx || !S.project) return;
    const p = S.project, pt = pat(), c = chan();
    const sc = scale(), help = helpOn();
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const col = (n) => css.getPropertyValue(n).trim();
    const bgW = col("--pr-white"), bgB = col("--pr-black"), line = col("--grid-line"), lineBeat = col("--grid-beat"), lineBar = col("--grid-bar");
    const topP = clamp(pitchAt(RULER), 0, 127), botP = clamp(pitchAt(H), 0, 127);
    // rows
    for (let pi = topP; pi >= botP; pi--) {
      const y = yOf(pi);
      let fill = T.isBlack(pi) ? bgB : bgW;
      ctx.fillStyle = fill;
      ctx.fillRect(KEYW, y, W - KEYW, V.rowH);
      if (sc.mode) {
        if (T.inScale(pi, sc)) {
          ctx.fillStyle = help ? "rgba(74, 222, 128, 0.10)" : "rgba(168, 85, 247, 0.07)";
          ctx.fillRect(KEYW, y, W - KEYW, V.rowH);
          if (((pi - sc.root) % 12 + 12) % 12 === 0) { ctx.fillStyle = help ? "rgba(74, 222, 128, 0.16)" : "rgba(168, 85, 247, 0.12)"; ctx.fillRect(KEYW, y, W - KEYW, V.rowH); }
        } else if (help) { ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(KEYW, y, W - KEYW, V.rowH); }
      }
      if (pi % 12 === 0) { ctx.fillStyle = lineBar; ctx.fillRect(KEYW, y + V.rowH - 1, W - KEYW, 1); }
    }
    // vertical lines
    const s0 = Math.max(0, Math.floor(stepAt(KEYW))), s1 = Math.ceil(stepAt(W));
    const spBeat = M.stepsPerBeat(p), spBar = M.stepsPerBar(p);
    for (let s = s0; s <= s1; s++) {
      const x = Math.round(xOf(s)) + 0.5;
      if (s % spBar === 0) ctx.fillStyle = lineBar;
      else if (s % spBeat === 0) ctx.fillStyle = lineBeat;
      else { if (V.zoomX < 10) continue; ctx.fillStyle = line; }
      ctx.fillRect(x, RULER, 1, H - RULER);
    }
    // beyond pattern end
    const endX = xOf(pt.length);
    if (endX < W) { ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(Math.max(KEYW, endX), RULER, W - Math.max(KEYW, endX), H - RULER); }
    // ghost notes from other channels
    for (const ch of p.channels) {
      if (!c || ch.id === c.id) continue;
      const list = pt.notes[ch.id];
      if (!list) continue;
      ctx.fillStyle = hexToRgba(ch.color, 0.16);
      for (const n of list) {
        const x = xOf(n.s), y = yOf(n.p);
        if (x > W || x + n.l * V.zoomX < KEYW || y > H || y < RULER - V.rowH) continue;
        ctx.fillRect(x + 1, y + 2, n.l * V.zoomX - 2, V.rowH - 4);
      }
    }
    // notes
    if (c) {
      const list = notes();
      ctx.font = "600 10px Fredoka, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      for (const n of list) {
        const x = xOf(n.s), y = yOf(n.p), w = Math.max(3, n.l * V.zoomX - 1);
        if (x > W || x + w < KEYW || y > H || y < RULER - V.rowH) continue;
        const sel = V.sel.has(n.id);
        const outScale = help && sc.mode && !T.inScale(n.p, sc);
        ctx.globalAlpha = 0.55 + 0.45 * (n.v == null ? 0.8 : n.v);
        ctx.fillStyle = outScale ? "#f97316" : c.color;
        roundRect(ctx, x + 0.5, y + 1, w, V.rowH - 2, 3);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (sel) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; roundRect(ctx, x + 0.5, y + 1, w, V.rowH - 2, 3); ctx.stroke(); }
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(x + w - 3, y + 3, 2, V.rowH - 6);
        if (w > 26 && V.rowH >= 12) { ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillText(T.noteName(n.p), x + 4, y + V.rowH / 2); }
      }
    }
    // hover cell
    if (hover && V.tool === "draw" && !V.drag && hover.x > KEYW && hover.y > RULER) {
      const s = snapFloor(stepAt(hover.x)), pi = pitchAt(hover.y);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(xOf(s) + 0.5, yOf(pi) + 0.5, V.lastLen * V.zoomX - 1, V.rowH - 1);
    }
    // selection box
    if (V.box) {
      ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
      ctx.strokeStyle = "rgba(34, 211, 238, 0.9)";
      const x = Math.min(V.box.x0, V.box.x1), y = Math.min(V.box.y0, V.box.y1);
      ctx.fillRect(x, y, Math.abs(V.box.x1 - V.box.x0), Math.abs(V.box.y1 - V.box.y0));
      ctx.strokeRect(x + 0.5, y + 0.5, Math.abs(V.box.x1 - V.box.x0), Math.abs(V.box.y1 - V.box.y0));
    }
    // playhead (pattern mode, or song mode when this pattern is playing)
    const ph = playheadStep();
    if (ph != null) {
      const x = xOf(ph);
      if (x >= KEYW && x <= W) { ctx.fillStyle = col("--playhead"); ctx.fillRect(x - 1, RULER, 2, H - RULER); }
    }
    // ruler
    ctx.fillStyle = col("--panel-2");
    ctx.fillRect(KEYW, 0, W - KEYW, RULER);
    ctx.fillStyle = col("--text-dim");
    ctx.font = "600 11px Fredoka, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    for (let s = Math.floor(s0 / spBar) * spBar; s <= s1; s += spBar) {
      const x = xOf(s);
      if (x < KEYW - 1) continue;
      ctx.fillRect(x, RULER - 8, 1, 8);
      ctx.fillText(String(s / spBar + 1), x + 4, RULER / 2);
    }
    // cursor marker
    const cx = xOf(V.cursor);
    if (cx >= KEYW) { ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(cx - 6, 0); ctx.lineTo(cx + 6, 0); ctx.lineTo(cx, 9); ctx.closePath(); ctx.fill(); }
    // keys
    for (let pi = topP; pi >= botP; pi--) {
      const y = yOf(pi);
      const black = T.isBlack(pi);
      const pressed = V.held && V.held.pitch === pi;
      ctx.fillStyle = pressed ? c ? c.color : "#22d3ee" : black ? "#1f2433" : "#e9edf5";
      ctx.fillRect(0, y, KEYW - (black ? 18 : 0), V.rowH - 0.5);
      if (black) { ctx.fillStyle = "#e9edf5"; ctx.fillRect(KEYW - 18, y, 18, V.rowH - 0.5); ctx.fillStyle = "#c8cfdc"; ctx.fillRect(KEYW - 18, y + V.rowH / 2, 18, 1); }
      if (sc.mode && T.inScale(pi, sc) && help) { ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(KEYW - 8, y + V.rowH / 2, 3, 0, Math.PI * 2); ctx.fill(); }
      if (pi % 12 === 0 && V.rowH >= 10) { ctx.fillStyle = "#334155"; ctx.font = "600 10px Fredoka, system-ui, sans-serif"; ctx.fillText(T.noteName(pi), 4, y + V.rowH / 2); }
    }
    ctx.fillStyle = col("--panel-2");
    ctx.fillRect(0, 0, KEYW, RULER);
    drawVel();
  }

  function drawVel() {
    if (!vctx || !velCanvas.offsetParent) return;
    vctx.clearRect(0, 0, W, VELH);
    vctx.fillStyle = "rgba(0,0,0,0.25)";
    vctx.fillRect(KEYW, 0, W - KEYW, VELH);
    const c = chan();
    if (!c) return;
    for (const n of notes()) {
      const x = xOf(n.s);
      if (x < KEYW - 2 || x > W) continue;
      const v = n.v == null ? 0.8 : n.v;
      const hh = v * (VELH - 8);
      vctx.fillStyle = V.sel.has(n.id) ? "#ffffff" : c.color;
      vctx.fillRect(x, VELH - hh, 3, hh);
      vctx.beginPath(); vctx.arc(x + 1.5, VELH - hh, 3.5, 0, Math.PI * 2); vctx.fill();
    }
  }

  function roundRect(c, x, y, w, hh, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + hh - r);
    c.quadraticCurveTo(x + w, y + hh, x + w - r, y + hh); c.lineTo(x + r, y + hh); c.quadraticCurveTo(x, y + hh, x, y + hh - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function playheadStep() {
    const tr = GBL.audio.transport, p = S.project;
    if (!tr.playing && tr.pos === 0) return null;
    const pos = tr.position();
    if (p.mode === "pattern") return pos % pat().length;
    const c = p.clips.find((c) => c.type === "pattern" && c.ref === p.currentPattern && pos >= c.start && pos < c.start + c.len);
    return c ? (pos - c.start) % pat().length : null;
  }

  /* ---------- interaction ---------- */
  function local(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  let previewVoice = null;
  function preview(pitch, vel = 0.8) {
    stopPreview();
    const c = chan();
    if (!c) return;
    previewVoice = GBL.audio.engine.noteOn(c, pitch, vel);
    V.held = { pitch };
    needs = true;
  }
  function stopPreview() { if (previewVoice) { GBL.audio.engine.noteOff(previewVoice); previewVoice = null; } V.held = null; needs = true; }

  function onHover(e) {
    if (V.drag) return;
    const pt = local(e);
    hover = pt;
    let cur = "default";
    if (pt.x > KEYW && pt.y > RULER) {
      const ht = hit(pt.x, pt.y);
      cur = ht ? (ht.edge ? "ew-resize" : V.tool === "erase" ? "not-allowed" : "move") : V.tool === "draw" ? "crosshair" : V.tool === "erase" ? "not-allowed" : "default";
    } else if (pt.x <= KEYW) cur = "pointer";
    canvas.style.cursor = cur;
    needs = true;
  }

  function onWheel(e) {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); const pt = local(e); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, pt.x); }
    else if (e.shiftKey && !e.deltaX) { e.preventDefault(); scroller.scrollLeft += e.deltaY; }
  }

  function onDbl(e) {
    const pt = local(e);
    if (pt.y < RULER || pt.x < KEYW) return;
    const ht = hit(pt.x, pt.y);
    if (ht && V.tool !== "erase") {
      // double-click a note: select every note with the same pitch
      V.sel.clear();
      for (const n of notes()) if (n.p === ht.n.p) V.sel.add(n.id);
      needs = true;
    }
  }

  function onDown(e) {
    GBL.layout.focus("pianoroll");
    canvas.focus({ preventScroll: true });
    const c = chan();
    if (!c) return;
    const pt = local(e);
    e.preventDefault();
    // ruler: move the marker and the playhead
    if (pt.y < RULER) {
      const s = Math.max(0, snapRound(stepAt(pt.x)));
      V.cursor = s;
      if (S.project.mode === "pattern") GBL.audio.transport.setPos(s);
      needs = true;
      return;
    }
    // keyboard
    if (pt.x < KEYW) {
      preview(pitchAt(pt.y), 0.85);
      GBL.drag(e, (dx, dy, ev) => { const pi = pitchAt(local(ev).y); if (!V.held || V.held.pitch !== pi) preview(pi, 0.85); }, stopPreview);
      return;
    }
    const ht = hit(pt.x, pt.y);
    const right = e.button === 2;
    if (V.tool === "erase" || right) {
      eraseAt(pt);
      GBL.drag(e, (dx, dy, ev) => eraseAt(local(ev)), () => M.changed("notes"));
      return;
    }
    if (ht) {
      if (!V.sel.has(ht.n.id)) { if (!e.shiftKey) V.sel.clear(); V.sel.add(ht.n.id); }
      else if (e.shiftKey) { V.sel.delete(ht.n.id); needs = true; return; }
      if (ht.edge) startResize(e, ht.n);
      else startMove(e, ht.n, pt, e.altKey);
      return;
    }
    // empty space
    if (e.pointerType === "touch" && V.tool === "select") {
      // one-finger scrolling on touch screens with the Select tool
      const sl = scroller.scrollLeft, st = scroller.scrollTop;
      GBL.drag(e, (dx, dy) => { scroller.scrollLeft = sl - dx; scroller.scrollTop = st - dy; });
      return;
    }
    if (V.tool === "select" || e.ctrlKey || e.metaKey) { startBox(e, pt); return; }
    // draw a new note
    let s = Math.max(0, snapFloor(stepAt(pt.x)));
    let pitch = clamp(pitchAt(pt.y), 0, 127);
    if (helpOn() && scale().mode) pitch = T.snapToScale(pitch, scale());
    const n = { id: uid("n"), p: pitch, s, l: V.lastLen, v: 0.8 };
    notes().push(n);
    V.sel.clear();
    V.sel.add(n.id);
    V.cursor = s + n.l;
    preview(pitch);
    resize();
    V.drag = true;
    const startX = pt.x;
    GBL.drag(e, (dx, dy, ev) => {
      const l = local(ev);
      if (Math.abs(l.x - startX) > 4) {
        const end = Math.max(s + (V.snap || 0.25), snapRound(stepAt(l.x)) || s + (V.snap || 0.25));
        n.l = Math.max(V.snap || 0.25, end - s);
        V.lastLen = n.l;
        V.cursor = s + n.l;
      }
      needs = true;
    }, () => { V.drag = false; stopPreview(); autoExtend(n.s + n.l); M.changed("notes"); resize(); });
  }

  function eraseAt(pt) {
    const ht = hit(pt.x, pt.y);
    if (!ht) return;
    const c = chan();
    pat().notes[c.id] = notes().filter((n) => n !== ht.n);
    V.sel.delete(ht.n.id);
    needs = true;
  }

  function startMove(e, anchor, pt, dup) {
    let list = selected();
    if (dup) {
      // Alt+drag: duplicate then move the copies
      const all = notes();
      V.sel.clear();
      list = list.map((n) => { const c = Object.assign({}, n, { id: uid("n") }); all.push(c); V.sel.add(c.id); return c; });
      anchor = list.find((n) => n.p === anchor.p && n.s === anchor.s) || list[0];
    }
    const orig = list.map((n) => ({ n, s: n.s, p: n.p }));
    const s0 = stepAt(pt.x), p0 = pitchAt(pt.y);
    let lastPitch = anchor.p;
    preview(anchor.p, anchor.v);
    V.drag = true;
    GBL.drag(e, (dx, dy, ev) => {
      const l = local(ev);
      let ds = stepAt(l.x) - s0;
      ds = V.snap ? Math.round(ds / V.snap) * V.snap : ds;
      let dp = pitchAt(l.y) - p0;
      const minS = Math.min(...orig.map((o) => o.s));
      if (minS + ds < 0) ds = -minS;
      for (const o of orig) {
        o.n.s = o.s + ds;
        let np = clamp(o.p + dp, 0, 127);
        if (helpOn() && scale().mode && orig.length === 1) np = T.snapToScale(np, scale());
        o.n.p = np;
      }
      if (anchor.p !== lastPitch) { lastPitch = anchor.p; preview(anchor.p, anchor.v); }
      needs = true;
    }, () => {
      V.drag = false;
      stopPreview();
      autoExtend(Math.max(...list.map((n) => n.s + n.l)));
      M.changed("notes");
      resize();
    });
  }

  function startResize(e, anchor) {
    const list = selected();
    const orig = list.map((n) => ({ n, l: n.l }));
    const sx = e.clientX;
    V.drag = true;
    GBL.drag(e, (dx) => {
      let dl = dx / V.zoomX;
      dl = V.snap ? Math.round(dl / V.snap) * V.snap : dl;
      for (const o of orig) o.n.l = Math.max(V.snap || 0.25, o.l + dl);
      V.lastLen = anchor.l;
      needs = true;
    }, () => { V.drag = false; autoExtend(Math.max(...list.map((n) => n.s + n.l))); M.changed("notes"); resize(); });
    void sx;
  }

  function startBox(e, pt) {
    if (!e.shiftKey) V.sel.clear();
    V.box = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    V.drag = true;
    GBL.drag(e, (dx, dy, ev) => {
      const l = local(ev);
      V.box.x1 = l.x; V.box.y1 = l.y;
      const sa = stepAt(Math.min(V.box.x0, V.box.x1)), sb = stepAt(Math.max(V.box.x0, V.box.x1));
      const pa = pitchAt(Math.max(V.box.y0, V.box.y1)), pb = pitchAt(Math.min(V.box.y0, V.box.y1));
      if (!e.shiftKey) V.sel.clear();
      for (const n of notes()) if (n.s + n.l > sa && n.s < sb && n.p >= pa && n.p <= pb) V.sel.add(n.id);
      needs = true;
    }, () => {
      V.drag = false;
      if (V.box && Math.abs(V.box.x1 - V.box.x0) < 3) V.cursor = Math.max(0, snapRound(stepAt(V.box.x0)));
      V.box = null;
      needs = true;
    });
  }

  function onVelDown(e) {
    const r = velCanvas.getBoundingClientRect();
    const setAt = (ev) => {
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      const v = clamp(1 - (y - 4) / (VELH - 8), 0.05, 1);
      const s = stepAt(x);
      let changed = false;
      const list = V.sel.size ? selected() : notes();
      for (const n of list) {
        if (Math.abs(xOf(n.s) - x) < Math.max(6, V.zoomX / 2) || (V.sel.size && list.length && Math.abs(n.s - s) < 0.5)) { n.v = Math.round(v * 100) / 100; changed = true; }
      }
      if (changed) needs = true;
    };
    setAt(e);
    GBL.drag(e, (dx, dy, ev) => setAt(ev), () => M.changed("notes"));
  }

  /* keyboard shortcuts while the piano roll is focused */
  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.key === "Delete" || e.key === "Backspace") { deleteSel(); return true; }
    if (ctrl && e.key.toLowerCase() === "a") { V.sel = new Set(notes().map((n) => n.id)); needs = true; return true; }
    if (ctrl && e.key.toLowerCase() === "c") return copy();
    if (ctrl && e.key.toLowerCase() === "x") { if (copy()) deleteSel(); return true; }
    if (ctrl && e.key.toLowerCase() === "v") { paste(); return true; }
    if (ctrl && e.key.toLowerCase() === "d") { duplicate(); return true; }
    if (V.sel.size && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      const list = selected();
      const d = e.key === "ArrowUp" ? (e.shiftKey ? 12 : 1) : e.key === "ArrowDown" ? (e.shiftKey ? -12 : -1) : 0;
      const ds = e.key === "ArrowRight" ? V.snap || 1 : e.key === "ArrowLeft" ? -(V.snap || 1) : 0;
      for (const n of list) { n.p = clamp(n.p + d, 0, 127); n.s = Math.max(0, n.s + ds); }
      if (d && list.length === 1) GBL.audio.engine.hit(chan(), list[0].p, 0.8, 0.2);
      M.changed("notes");
      return true;
    }
    return false;
  }

  /* record live-played notes (Record notes mode) */
  const recording = new Map();
  function recordOn(pitch, vel) {
    const tr = GBL.audio.transport;
    if (!tr.recordNotes || !tr.playing || S.project.mode !== "pattern") return;
    const pos = tr.position() % pat().length;
    recording.set(pitch, { pitch, vel, s: V.snap ? Math.round(pos / Math.min(V.snap, 1)) * Math.min(V.snap, 1) : pos });
  }
  function recordOff(pitch) {
    const r = recording.get(pitch);
    if (!r) return;
    recording.delete(pitch);
    const tr = GBL.audio.transport;
    const target = M.getChannel(S.selectedChannel) || chan();
    if (!target) return;
    const L = pat().length;
    let end = tr.position() % L;
    let len = end - r.s;
    if (len <= 0) len += L;
    len = Math.max(0.5, Math.round(len * 2) / 2);
    M.notesFor(pat(), target.id).push({ id: uid("n"), p: r.pitch, s: r.s % L, l: Math.min(len, L), v: Math.round(r.vel * 100) / 100 });
    if (S.pianoRollChannel !== target.id) { S.pianoRollChannel = target.id; renderHead(); }
    M.changed("notes");
  }

  GBL.pianoRoll = { build, onKey, resize, recordOn, recordOff, view: V, redraw: () => { needs = true; resize(); } };
})();
