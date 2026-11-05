/* Top toolbar (TransportController UI): file, undo/redo, transport, tempo, time signature, master volume, fun menu. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, clamp } = GBL;
  const M = GBL.model;
  const S = M.state;
  const TR = () => GBL.audio.transport;

  const TEMPO_PRESETS = [["Slow", 70], ["Chill", 90], ["Hip Hop", 95], ["Pop", 115], ["Dance", 125], ["Fast", 145]];
  let root, el = {};

  function build(r) {
    root = r;
    const mod = GBL.isMac ? "⌘" : "Ctrl+";
    el.mode = h("div", { class: "seg", role: "group", "aria-label": "Play mode" },
      h("button", { class: "seg-btn", "data-mode": "pattern", tip: "PATTERN: play just the pattern you're editing, on repeat" }, "PAT"),
      h("button", { class: "seg-btn", "data-mode": "song", tip: "SONG: play the whole Playlist arrangement" }, "SONG"));
    el.mode.onclick = (e) => { const b = e.target.closest(".seg-btn"); if (!b) return; setMode(b.dataset.mode); };
    el.play = h("button", { class: "tbtn play", tip: "Play (Space)", "aria-label": "Play" }, "▶");
    el.pause = h("button", { class: "tbtn", tip: "Pause (Space)", "aria-label": "Pause" }, "⏸");
    el.stop = h("button", { class: "tbtn", tip: "Stop and go back to the start", "aria-label": "Stop" }, "⏹");
    el.rec = h("button", { class: "tbtn rec", tip: "Record your voice or keyboard playing", "aria-label": "Record" }, "⏺");
    el.loop = h("button", { class: "tbtn toggle", tip: "Loop: keep repeating", "aria-label": "Loop", "aria-pressed": "true" }, "🔁");
    el.metro = h("button", { class: "tbtn toggle", tip: "Metronome: a click on every beat", "aria-label": "Metronome", "aria-pressed": "false" }, "🥢");
    el.play.onclick = () => { TR().play(); GBL.ui.uiSound("on"); };
    el.pause.onclick = () => TR().pause();
    el.stop.onclick = () => TR().stop();
    el.rec.onclick = (e) => recMenu(e.currentTarget);
    el.loop.onclick = () => { S.project.loop = !S.project.loop; M.changed("loop", false); update(); };
    el.metro.onclick = () => { TR().metronome = !TR().metronome; update(); };

    el.pos = h("div", { class: "pos-display", tip: "Bar : Beat : Step and time", "aria-live": "off" }, h("span", { class: "pos-bbs" }, "1:1:1"), h("span", { class: "pos-time" }, "0:00.0"));

    // tempo
    el.bpm = h("input", { type: "number", class: "bpm-input", min: 40, max: 220, step: 1, "aria-label": "Tempo in BPM" });
    el.bpm.onchange = () => setBpm(+el.bpm.value);
    el.bpm.onkeydown = (e) => { if (e.key === "Enter") el.bpm.blur(); };
    const grip = h("div", { class: "bpm-grip", tip: "Drag up or down to change the tempo", "aria-hidden": "true" }, "BPM");
    grip.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const start = S.project.bpm;
      GBL.drag(e, (dx, dy, ev) => setBpm(Math.round(start - dy / (ev.shiftKey ? 8 : 2)), false), () => M.changed("bpm"));
    });
    const up = h("button", { class: "arrow-btn", tip: "Faster", "aria-label": "Tempo up", onclick: () => setBpm(S.project.bpm + 1) }, "▲");
    const down = h("button", { class: "arrow-btn", tip: "Slower", "aria-label": "Tempo down", onclick: () => setBpm(S.project.bpm - 1) }, "▼");
    const presets = h("button", { class: "icon-btn tiny", tip: "Tempo presets", "aria-label": "Tempo presets" }, "▾");
    presets.onclick = () => GBL.ui.menu(presets, TEMPO_PRESETS.map(([n, b]) => ({ label: n + " – " + b + " BPM", icon: "⏱️", checked: S.project.bpm === b, onClick: () => setBpm(b) })).concat([{ sep: true }, { label: "Tap tempo…", icon: "👆", onClick: tapTempo }]));
    el.tempo = h("div", { class: "tempo" }, grip, el.bpm, h("div", { class: "arrows" }, up, down), presets);

    el.sig = h("select", { class: "sig adv", "aria-label": "Time signature", tip: "Time signature: beats in each bar" },
      [[3, 4], [4, 4], [5, 4], [6, 8], [7, 8]].map(([n, d]) => h("option", { value: n + "/" + d }, n + "/" + d)));
    el.sig.onchange = () => { const [n, d] = el.sig.value.split("/").map(Number); S.project.timeSig = [n, d]; M.changed("timesig"); };

    el.vol = h("input", { type: "range", min: 0, max: 1.25, step: 0.01, class: "master-vol", "aria-label": "Master volume", tip: "Master volume" });
    el.vol.oninput = () => { S.project.mixer.master.vol = +el.vol.value; M.changed("live", false); };
    el.vol.onchange = () => M.changed("mixer-live");
    el.meter = h("canvas", { class: "top-meter", width: 60, height: 8, "aria-hidden": "true" });

    el.undo = h("button", { class: "icon-btn", tip: "Undo (" + mod + "Z)", "aria-label": "Undo", onclick: () => M.history.undo() }, "↶");
    el.redo = h("button", { class: "icon-btn", tip: "Redo (" + mod + "Y)", "aria-label": "Redo", onclick: () => M.history.redo() }, "↷");
    const file = h("button", { class: "btn", tip: "File: new, open, save and import", "aria-haspopup": "menu", "aria-label": "File" }, "📁", h("span", { class: "lbl" }, " File ▾"));
    file.onclick = () => fileMenu(file);
    el.save = h("button", { class: "icon-btn", tip: "Save (" + mod + "S)", "aria-label": "Save", onclick: () => GBL.projects.save() }, "💾");
    const exp = h("button", { class: "btn primary export-btn", tip: "Export your song as WAV, MP3 or MIDI", onclick: () => GBL.exporter.openDialog() }, "⬇", h("span", { class: "lbl" }, " Export"));
    const fun = h("button", { class: "btn fun", tip: "Fun: playgrounds, challenges and generators", "aria-haspopup": "menu", "aria-label": "Fun" }, "🎉", h("span", { class: "lbl" }, " Fun ▾"));
    fun.onclick = () => funMenu(fun);
    const buddy = h("button", { class: "btn buddy", tip: "Beat Buddy: tell it what music you want", "aria-label": "Beat Buddy", onclick: () => GBL.fun.assistant() }, "🤖", h("span", { class: "lbl" }, " Beat Buddy"));
    el.beginner = h("button", { class: "btn toggle-btn", tip: "Beginner Mode: bigger buttons, fewer controls, more help", "aria-label": "Beginner Mode" }, "🐣", h("span", { class: "lbl" }, " Beginner"));
    el.beginner.onclick = () => GBL.settings.set("beginner", !GBL.settings.get("beginner"));
    const help = h("button", { class: "icon-btn", tip: "Help", "aria-label": "Help", "aria-haspopup": "menu" }, "❓");
    help.onclick = () => helpMenu(help);
    el.name = h("button", { class: "song-name", tip: "Click to rename your song" });
    el.name.onclick = () => GBL.ui.prompt("Song name", S.project.name).then((n) => { if (n && n.trim()) { S.project.name = n.trim(); M.changed("name"); update(); } });

    root.append(
      h("a", { class: "brand", href: "../../apps.html", tip: "Back to the Apps page", "aria-label": "Back to the Apps page" }, h("span", { class: "brand-logo" }, "🎛️"), h("span", { class: "brand-text" }, "Gaby's ", h("b", {}, "Beat Lab"))),
      h("div", { class: "tb-group file-group" }, file, el.save, el.undo, el.redo),
      h("div", { class: "tb-group transport" }, el.mode, el.play, el.pause, el.stop, el.rec, el.loop, el.metro),
      el.pos,
      h("div", { class: "tb-group" }, el.tempo, el.sig),
      h("div", { class: "tb-group vol-group adv" }, h("span", { class: "vol-ico", "aria-hidden": "true" }, "🔊"), el.vol, el.meter),
      el.name,
      h("div", { class: "tb-spacer" }),
      h("div", { class: "tb-group right" }, buddy, fun, el.beginner, help, exp));
    bus.on("transport", update);
    bus.on("project:loaded", update);
    bus.on("history", update);
    bus.on("mode", update);
    bus.on("settings", update);
    bus.on("change", (s) => { if (s !== "live") update(); });
    bus.on("frame", frame);
    update();
  }

  function setMode(m) {
    if (S.project.mode === m) return;
    const was = TR().playing;
    if (was) TR().stop();
    S.project.mode = m;
    TR().pos = 0;
    M.changed("mode", false);
    bus.emit("mode");
    if (was) TR().play();
    if (m === "song") GBL.layout.showEditor("playlist");
  }

  function setBpm(v, commit = true) {
    S.project.bpm = clamp(Math.round(v) || 120, 40, 220);
    el.bpm.value = S.project.bpm;
    M.changed(commit ? "bpm" : "live", commit);
  }

  let taps = [];
  function tapTempo() {
    taps = [];
    const btn = h("button", { class: "tap-pad" }, "TAP");
    const out = h("p", { class: "hint" }, "Tap the button along with the beat (4 or more taps).");
    btn.onpointerdown = () => {
      const now = performance.now();
      taps = taps.filter((t) => now - t < 3000);
      taps.push(now);
      if (taps.length >= 3) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        const bpm = Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length));
        out.textContent = bpm + " BPM";
        setBpm(bpm);
      }
    };
    GBL.ui.modal({ title: "Tap tempo", icon: "👆", body: h("div", { class: "tap-wrap" }, btn, out) });
  }

  function recMenu(anchor) {
    const tr = TR();
    GBL.ui.menu(anchor, [
      { label: (tr.recordNotes ? "Stop recording" : "Record") + " notes from the keyboard", icon: "🎹", checked: tr.recordNotes, tip: "Plays the pattern and writes what you play on the keyboard into the Piano Roll",
        onClick: () => {
          tr.recordNotes = !tr.recordNotes;
          if (tr.recordNotes) {
            if (S.project.mode !== "pattern") setMode("pattern");
            tr.metronome = true;
            const ch = M.getChannel(S.selectedChannel);
            if (ch) S.pianoRollChannel = ch.id;
            GBL.layout.showEditor("pianoroll");
            if (!tr.playing) tr.play();
            GBL.ui.toast("🔴 Recording notes for “" + (ch ? ch.name : "") + "”. Play the keyboard!");
          } else GBL.ui.toast("Note recording off");
          update();
        } },
      { label: "Record my voice / microphone…", icon: "🎤", onClick: () => GBL.recorder.open({ withMusic: true }) },
    ]);
  }

  function fileMenu(anchor) {
    const mod = GBL.isMac ? "⌘" : "Ctrl+";
    GBL.projects.list().then((recent) => {
      GBL.ui.menu(anchor, [
        { label: "New song", icon: "📄", onClick: () => GBL.projects.newProject() },
        { label: "Open…", icon: "📂", kbd: mod + "O", onClick: () => GBL.fun.openDialog() },
        { label: "Save", icon: "💾", kbd: mod + "S", onClick: () => GBL.projects.save() },
        { label: "Save As…", icon: "📝", kbd: mod + "⇧S", onClick: () => GBL.projects.saveAs() },
        { label: "Download project file (.beatlab)", icon: "📦", onClick: () => GBL.projects.downloadFile() },
        { sep: true },
        { label: "Import audio…", icon: "🎵", onClick: () => GBL.recorder.importDialog(null) },
        { label: "Export song (WAV / MP3 / MIDI)…", icon: "⬇", onClick: () => GBL.exporter.openDialog() },
        recent.length ? { header: "Recent projects" } : null,
        ...recent.slice(0, 6).map((r) => ({ label: r.name, icon: "🎶", tip: new Date(r.updated).toLocaleString(), onClick: () => GBL.projects.openStored(r.id) })),
      ]);
    });
  }

  function funMenu(anchor) {
    GBL.ui.menu(anchor, [
      { label: "Genre Creator: start a song in any style", icon: "🎸", onClick: () => GBL.fun.genreCreator() },
      { label: "Random Song Generator", icon: "🎲", onClick: () => GBL.fun.randomSong() },
      { label: "Beat Challenges", icon: "🏆", onClick: () => GBL.fun.challenges() },
      { sep: true },
      { label: "Play an Instrument", icon: "🎹", onClick: () => GBL.fun.instrumentPlayground() },
      { label: "Beat Lab Pads", icon: "🥁", onClick: () => GBL.fun.pads() },
      { label: "Soundboard", icon: "🤪", onClick: () => GBL.fun.soundboard() },
      { label: "Music Visualizer", icon: "🌈", onClick: () => GBL.fun.visualizer() },
    ]);
  }

  function helpMenu(anchor) {
    GBL.ui.menu(anchor, [
      { label: "Take the tour", icon: "🧭", onClick: () => GBL.fun.tutorial() },
      { label: "Make your first song (guide)", icon: "🐣", onClick: () => GBL.fun.guide(true) },
      { label: "Keyboard shortcuts", icon: "⌨️", onClick: () => GBL.fun.shortcuts() },
      { label: "Settings", icon: "⚙️", onClick: () => GBL.fun.settingsDialog() },
      { label: "About Beat Lab", icon: "ℹ️", onClick: () => GBL.fun.about() },
    ]);
  }

  function update() {
    if (!root || !S.project) return;
    const p = S.project, tr = TR();
    el.mode.querySelectorAll(".seg-btn").forEach((b) => { const on = b.dataset.mode === p.mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
    el.play.classList.toggle("on", tr.playing);
    el.rec.classList.toggle("on", tr.recordNotes);
    el.loop.classList.toggle("on", !!p.loop);
    el.loop.setAttribute("aria-pressed", String(!!p.loop));
    el.metro.classList.toggle("on", tr.metronome);
    el.metro.setAttribute("aria-pressed", String(tr.metronome));
    if (document.activeElement !== el.bpm) el.bpm.value = p.bpm;
    el.sig.value = p.timeSig.join("/");
    if (![...el.sig.options].some((o) => o.value === el.sig.value)) el.sig.append(h("option", { value: p.timeSig.join("/") }, p.timeSig.join("/")));
    el.sig.value = p.timeSig.join("/");
    el.vol.value = p.mixer.master.vol;
    el.undo.disabled = !M.history.canUndo();
    el.redo.disabled = !M.history.canRedo();
    el.name.textContent = "🎵 " + p.name + (GBL.projects.dirty ? " •" : "");
    el.beginner.classList.toggle("on", !!GBL.settings.get("beginner"));
    el.beginner.setAttribute("aria-pressed", String(!!GBL.settings.get("beginner")));
  }

  let lastTxt = "";
  function frame(pos) {
    const p = S.project;
    const spBar = M.stepsPerBar(p), spBeat = M.stepsPerBeat(p);
    const s = Math.floor(pos);
    const txt = Math.floor(s / spBar) + 1 + ":" + (Math.floor((s % spBar) / spBeat) + 1) + ":" + ((s % spBeat) + 1);
    const time = GBL.fmtTime(pos * (60 / p.bpm / 4));
    const both = txt + time;
    if (both !== lastTxt) { el.pos.firstChild.textContent = txt; el.pos.lastChild.textContent = time; lastTxt = both; }
    const eng = GBL.audio.engine;
    if (eng.graph) {
      const lvl = eng.level(eng.graph.analyser);
      const c = el.meter.getContext("2d");
      c.clearRect(0, 0, 60, 8);
      c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(0, 0, 60, 8);
      c.fillStyle = lvl > 0.95 ? "#ef4444" : lvl > 0.7 ? "#facc15" : "#22c55e";
      c.fillRect(0, 0, Math.min(1, lvl) * 60, 8);
    }
  }

  GBL.toolbar = { build, update, setMode, setBpm, TEMPO_PRESETS };
})();
