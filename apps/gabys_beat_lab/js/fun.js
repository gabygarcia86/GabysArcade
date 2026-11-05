/* Fun & learning: Beat Buddy assistant, Genre Creator, random songs, challenges, Instrument Playground,
 * Beat Lab Pads, Soundboard, Visualizer, guided tour, first-song guide and a few dialogs. */
(function () {
  "use strict";
  const GBL = window.GBL;
  const { h, clear, bus, store, clamp, uid } = GBL;
  const M = GBL.model;
  const S = M.state;
  const G = GBL.generator;
  const T = GBL.theory;
  const fun = { activeKeyboard: null };

  /* ---------- Genre Creator / random song ---------- */
  async function startGenre(id) {
    const ok = await GBL.projects.newProject(() => G.genreProject(id));
    if (!ok) return;
    GBL.layout.showEditor("playlist");
    GBL.ui.toast("🎉 Your " + (G.genreById(id) || { name: "new" }).name + " song is ready! Press ▶ Play.");
    GBL.ui.uiSound("success");
  }
  fun.startGenre = startGenre;

  fun.genreCreator = function () {
    const grid = h("div", { class: "genre-grid" });
    let m;
    for (const g of G.GENRES) {
      const b = h("button", { class: "genre-card" }, h("span", { class: "genre-emoji" }, g.emoji), h("b", {}, g.name), h("small", {}, g.bpm + " BPM · " + T.scaleById(g.scale).name));
      b.onclick = () => { m.close(); startGenre(g.id); };
      grid.append(b);
    }
    m = GBL.ui.modal({ title: "Genre Creator", icon: "🎸", wide: true, body: h("div", {}, h("p", { class: "modal-text" }, "Pick a style and Beat Lab builds a starting song: drums, bass, chords, melody, effects and an arrangement. Everything is yours to change."), grid) });
  };
  fun.randomSong = () => startGenre(GBL.pick(G.GENRES).id);

  /* ---------- Beat Buddy ---------- */
  fun.assistant = function () {
    const log = h("div", { class: "chat-log", "aria-live": "polite" });
    const input = h("input", { type: "text", placeholder: "Tell me what to make…", "aria-label": "Message for Beat Buddy", maxlength: 200 });
    const send = h("button", { class: "btn primary" }, "Send");
    const say = (who, text, extra) => { log.append(h("div", { class: "msg " + who }, h("span", { class: "msg-who" }, who === "me" ? "🙂" : "🤖"), h("div", { class: "msg-text" }, text, extra || null))); log.scrollTop = log.scrollHeight; };
    const examples = ["Make me a hip-hop beat", "Create a happy video game melody", "Make a spooky Halloween soundtrack", "Create an electronic dance beat", "Give me a cool bassline", "Make this sound more futuristic", "Help me create a song intro"];
    const chips = h("div", { class: "chips wrap" }, examples.map((t) => h("button", { class: "chip", onclick: () => go(t) }, t)));
    async function go(text) {
      text = (text || input.value).trim();
      if (!text) return;
      input.value = "";
      say("me", text);
      let res;
      try { res = G.assistant(text); } catch (e) { console.error(e); res = "Oops, I got confused. Try asking in a different way!"; }
      if (res && typeof res === "object" && res.newProject) {
        const ok = await GBL.projects.newProject(() => res.newProject);
        if (!ok) { say("bot", "OK, I left your song alone."); return; }
        say("bot", res.message);
        GBL.layout.showEditor("playlist");
        GBL.audio.transport.play();
        return;
      }
      const undo = h("button", { class: "btn small", onclick: () => { M.history.undo(); say("bot", "↶ Undone!"); } }, "↶ Undo that");
      say("bot", res, /Done|Zoom|Faster|Slowed|Added|made/.test(res) ? h("div", { class: "msg-actions" }, undo) : null);
      if (/Done|Zoom|intro/i.test(res)) { if (!GBL.audio.transport.playing) { if (S.project.mode !== "pattern") GBL.toolbar.setMode("pattern"); GBL.audio.transport.play(); } }
    }
    send.onclick = () => go();
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); e.stopPropagation(); });
    say("bot", "Hi! I'm Beat Buddy, your music helper. I run right here in your browser, no internet needed. Tell me what you'd like, and I'll make patterns you can edit.");
    GBL.ui.modal({ title: "Beat Buddy", icon: "🤖", cls: "chat-modal", body: h("div", { class: "chat" }, log, chips, h("div", { class: "chat-input" }, input, send)) });
  };

  /* ---------- Beat Challenges ---------- */
  const drumCh = (p, role) => p.channels.filter((c) => G.roleOfChannel(c) === role);
  const stepsOf = (p, pat, role) => { const out = new Array(pat.length).fill(0); for (const c of drumCh(p, role)) (pat.steps[c.id] || []).forEach((v, i) => { if (v > 0) out[i] = 1; }); return out; };
  const CHALLENGES = [
    { id: "floor", icon: "👟", title: "Four on the Floor", desc: "Put a Kick on every beat of the first bar (steps 1, 5, 9 and 13).", hint: "Click those four squares on the Kick row.",
      check: (p, pat) => { const k = stepsOf(p, pat, "kick"); return [0, 4, 8, 12].every((i) => k[i]); } },
    { id: "backbeat", icon: "👏", title: "Backbeat", desc: "Add a Snare or Clap on beats 2 and 4 (steps 5 and 13).", hint: "Snare or Clap row, steps 5 and 13.",
      check: (p, pat) => { const s = stepsOf(p, pat, "snare"), c = stepsOf(p, pat, "clap"); return (s[4] || c[4]) && (s[12] || c[12]); } },
    { id: "hats", icon: "🎩", title: "Hi-Hat Hero", desc: "Use at least 8 Closed Hi-Hat steps in one pattern.", hint: "Try every other square on the Closed Hi-Hat row.",
      check: (p, pat) => stepsOf(p, pat, "hat").filter(Boolean).length >= 8 },
    { id: "fourbar", icon: "🧱", title: "Four-Bar Beat", desc: "Make a drum beat that lasts four bars: a 64-step pattern with drums in every bar, or drum clips covering 4 bars in the Playlist.", hint: "Set the pattern to 64 steps, or place your beat 4 times in the Playlist.",
      check: (p, pat) => {
        const has = (pt, a, b) => p.channels.some((c) => c.kind === "sample" && (pt.steps[c.id] || []).slice(a, b).some((v) => v > 0));
        if (pat.length >= 64 && [0, 1, 2, 3].every((b) => has(pat, b * 16, b * 16 + 16))) return true;
        let cover = 0;
        for (const c of p.clips) { const pt = p.patterns.find((x) => x.id === c.ref); if (c.type === "pattern" && pt && has(pt, 0, pt.length)) cover += c.len; }
        return cover >= M.stepsPerBar(p) * 4;
      } },
    { id: "melody", icon: "🎶", title: "Melody Maker", desc: "Write a melody of at least 8 notes that all fit one scale.", hint: "Open the Piano Roll, turn on 💡 HELP ME MAKE MUSIC and click green rows.",
      check: (p, pat) => p.channels.some((c) => {
        if (c.kind !== "synth") return false;
        const ns = pat.notes[c.id] || [];
        return ns.length >= 8 && T.SCALES.some((s) => s.mode && ns.every((n) => T.inScale(n.p, s)));
      }) },
    { id: "chords", icon: "🎹", title: "Chord Champ", desc: "Play 4 chords (3 or more notes starting together).", hint: "In the Piano Roll, HELP ME MAKE MUSIC shows chord buttons.",
      check: (p, pat) => p.channels.some((c) => { const by = {}; for (const n of pat.notes[c.id] || []) by[n.s] = (by[n.s] || 0) + 1; return Object.values(by).filter((x) => x >= 3).length >= 4; }) },
    { id: "speed", icon: "⚡", title: "Speed Demon", desc: "Make a beat at 140 BPM or faster with at least 6 drum hits.", hint: "Use the ▲ arrows next to BPM, or pick the Fast preset.",
      check: (p, pat) => p.bpm >= 140 && p.channels.filter((c) => c.kind === "sample").reduce((a, c) => a + (pat.steps[c.id] || []).filter((v) => v > 0).length, 0) >= 6 },
    { id: "fx", icon: "🪄", title: "Effect Wizard", desc: "Add an audio effect in the Mixer.", hint: "Open the Mixer tab and press ＋ Effect.",
      check: (p) => p.mixer.master.fx.length > 0 || p.mixer.inserts.some((i) => i.fx.length) },
    { id: "song", icon: "🏗️", title: "Song Builder", desc: "Arrange at least 3 different patterns into a song 8 bars or longer.", hint: "Make patterns, then paint them into the Playlist (or use 🏗️ Song Templates).",
      check: (p) => new Set(p.clips.filter((c) => c.type === "pattern").map((c) => c.ref)).size >= 3 && M.songLength(p) >= M.stepsPerBar(p) * 8 },
    { id: "voice", icon: "🎤", title: "Voice Star", desc: "Record or import your own sound and put it in the Playlist.", hint: "Press ⏺ Record ▸ Record my voice.",
      check: (p) => p.clips.some((c) => c.type === "audio" && c.ref.startsWith("asset:")) },
  ];
  fun.challenges = function () {
    const done = new Set(store.get("challenges", []));
    const list = h("div", { class: "challenge-list" });
    const stars = h("div", { class: "stars" });
    function render() {
      clear(list);
      stars.textContent = "⭐ " + done.size + " / " + CHALLENGES.length + " stars";
      for (const c of CHALLENGES) {
        const ok = done.has(c.id);
        const res = h("span", { class: "ch-result" });
        const btn = h("button", { class: "btn small" + (ok ? "" : " primary") }, ok ? "Check again" : "Check my song");
        btn.onclick = () => {
          const pass = c.check(S.project, M.getPattern());
          if (pass) { if (!done.has(c.id)) { done.add(c.id); store.set("challenges", [...done]); GBL.ui.confetti(); } GBL.ui.uiSound("success"); render(); }
          else { res.textContent = "Not yet! Hint: " + c.hint; GBL.ui.uiSound("error"); }
        };
        list.append(h("div", { class: "challenge" + (ok ? " done" : "") }, h("span", { class: "ch-icon" }, ok ? "⭐" : c.icon), h("div", { class: "ch-text" }, h("b", {}, c.title), h("p", {}, c.desc), res), btn));
      }
    }
    render();
    GBL.ui.modal({ title: "Beat Challenges", icon: "🏆", wide: true, body: h("div", {}, h("p", { class: "modal-text" }, "Complete a challenge in your song, then press Check. Collect all the stars!"), stars, list) });
  };

  /* ---------- Instrument Playground ---------- */
  fun.instrumentPlayground = function () {
    const tmp = { id: "tmp_play", kind: "synth", inst: "piano", sound: null, vol: 0.85, pan: 0, cutoff: 1, reverb: 0.25, attack: 0.003, release: 0.4, pitch: 0, root: 60, name: "Playground" };
    const applyInst = (inst) => { tmp.kind = "synth"; tmp.inst = inst.id; const pr = inst.presets[0]; tmp.attack = pr.attack; tmp.release = pr.release; tmp.cutoff = pr.cutoff; tmp.reverb = Math.max(0.15, pr.reverb); };
    applyInst(GBL.instruments.byId.piano);
    const octs = window.innerWidth < 700 ? 1 : window.innerWidth < 1100 ? 2 : 3;
    const bubbles = h("div", { class: "bubbles", "aria-hidden": "true" });
    const kb = GBL.keyboardUI.keyboard({ octaves: octs, base: 48, big: true, getChannel: () => tmp, onNote: (m, on) => { if (on) bubble(m); } });
    function bubble(m) {
      const b = h("span", { class: "bubble", style: { left: ((m - kb.base) / (octs * 12 + 1)) * 100 + "%", background: GBL.PALETTE[m % 12] } }, T.noteName(m));
      bubbles.append(b);
      setTimeout(() => b.remove(), 1600);
    }
    const grid = h("div", { class: "inst-grid" });
    const all = GBL.instruments.INSTRUMENTS.concat([{ id: "drums", name: "Drum Kit", icon: "🥁", color: "#ff4f8b" }]);
    const drumMap = ["kick", "rim", "snare", "clap", "hat_closed", "tom_low", "hat_pedal", "tom", "hat_open", "tom_high", "cymbal", "ride", "shaker", "cowbell", "tambourine", "perc", "bongo", "conga_low", "woodblock", "claves", "triangle", "snap", "kick808", "snare_tight", "r_kick"];
    for (const inst of all) {
      const b = h("button", { class: "inst-card" + (inst.id === tmp.inst ? " on" : ""), style: { "--c": inst.color } }, h("span", {}, inst.icon), h("small", {}, inst.name));
      b.onclick = () => {
        grid.querySelectorAll(".inst-card").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        if (inst.id === "drums") { tmp.kind = "drums"; } else applyInst(inst);
        GBL.audio.engine.hit(currentCh(60), 60, 0.8, 0.4);
      };
      grid.append(b);
    }
    // drum kit mode maps keys to drum sounds
    const drumCh = { id: "tmp_play_drum", kind: "sample", sound: "kick", vol: 0.9, pan: 0, cutoff: 1, reverb: 0.1, attack: 0.001, release: 1.5, pitch: 0, root: 60 };
    function currentCh(m) {
      if (tmp.kind !== "drums") return tmp;
      drumCh.sound = drumMap[((m - kb.base) % drumMap.length + drumMap.length) % drumMap.length];
      drumCh.root = m;
      return drumCh;
    }
    const reverb = GBL.ui.knob({ label: "Echo", min: 0, max: 1, value: tmp.reverb, size: 46, color: "var(--blue)", fmt: (v) => Math.round(v * 100) + "%", onInput: (v) => { tmp.reverb = v; drumCh.reverb = v; GBL.audio.engine.graph && GBL.audio.engine.graph.tempChannel(tmp); } });
    const tone = GBL.ui.knob({ label: "Brightness", min: 0, max: 1, value: 1, size: 46, color: "var(--purple)", fmt: (v) => Math.round(v * 100) + "%", onInput: (v) => { tmp.cutoff = v; drumCh.cutoff = v; GBL.audio.engine.graph && GBL.audio.engine.graph.tempChannel(tmp); } });
    const octLbl = h("span", { class: "oct-label" });
    const setOct = (d) => { kb.setBase(clamp(kb.base + d, 24, 84)); octLbl.textContent = "Octave " + (Math.floor(kb.base / 12) - 1); };
    setOct(0);
    // patch the keyboard so drum mode works: wrap getChannel by pitch
    const origOn = kb.on;
    kb.on = (m, v) => { if (tmp.kind === "drums") { GBL.audio.engine.hit(currentCh(m), m, v || 0.85); kb.el.querySelector('[data-m="' + m + '"]')?.classList.add("down"); bubble(m); setTimeout(() => kb.el.querySelector('[data-m="' + m + '"]')?.classList.remove("down"), 150); return; } origOn(m, v); };
    kb.el.addEventListener("pointerdown", (e) => { if (tmp.kind !== "drums") return; const k = e.target.closest(".key"); if (k) { e.stopImmediatePropagation(); kb.on(+k.dataset.m, 0.9); } }, true);
    const body = h("div", { class: "playground" },
      h("div", { class: "pg-top" }, grid, h("div", { class: "pg-ctl" },
        h("div", { class: "oct-ctl" }, h("button", { class: "btn", onclick: () => setOct(-12), "aria-label": "Octave down" }, "◀"), octLbl, h("button", { class: "btn", onclick: () => setOct(12), "aria-label": "Octave up" }, "▶")),
        reverb, tone)),
      h("div", { class: "pg-stage" }, bubbles),
      h("div", { class: "pg-kb" }, kb.el),
      h("p", { class: "hint center" }, "Play with your mouse, fingers or keyboard: Z S X D C V… and Q 2 W 3 E R…  Use [ and ] to change octave."));
    fun.activeKeyboard = {
      kb, shift: (d) => setOct(d),
      onKey: (k, down) => {
        if (tmp.kind === "drums") { const off = GBL.keyboardUI.KEYMAP[k]; if (off == null) return false; if (down) kb.on(kb.base + off, 0.9); return true; }
        return down ? kb.keyOn(k) : kb.keyOff(k);
      },
    };
    GBL.ui.modal({ title: "Play an Instrument", icon: "🎹", full: true, body, onClose: () => { kb.allOff(); fun.activeKeyboard = null; } });
  };

  /* ---------- Beat Lab Pads (with loop recorder) ---------- */
  const PAD_KITS = {
    "Classic Kit": ["kick", "snare", "clap", "hat_closed", "hat_open", "cymbal", "tom_low", "tom", "tom_high", "rim", "ride", "shaker", "cowbell", "tambourine", "snap", "perc"],
    "808 & Bass": ["kick808", "snare_tight", "clap", "hat_closed", "hat_open", "bass_hit", "sub_drop", "bass_pluck", "bass_wobble", "rim", "snap", "shaker", "kick_punch", "r_hat", "ride", "cymbal"],
    "World Percussion": ["perc", "conga_low", "bongo", "shaker", "tambourine", "cowbell", "woodblock", "triangle", "claves", "snap", "rim", "tom_low", "tom_high", "ride", "clap", "kick_soft"],
    "Retro Arcade": ["r_kick", "r_snare", "r_hat", "r_jump", "r_coin", "r_laser", "r_explode", "r_powerup", "r_1up", "r_hit", "r_select", "r_gameover", "square_blip", "coin", "laser", "zap"],
  };
  const PAD_KEYS = ["1", "2", "3", "4", "q", "w", "e", "r", "a", "s", "d", "f", "z", "x", "c", "v"];
  fun.pads = function () {
    let kit = "Classic Kit";
    const LOOP = 32;
    const loop = { events: [], playing: false, rec: false, startTime: 0, nextStep: 0, nextTime: 0, timer: 0 };
    const padGrid = h("div", { class: "pad-grid" });
    const pads = [];
    const chFor = (i) => ({ id: "tmp_pad_" + i, kind: "sample", sound: PAD_KITS[kit][i], vol: 0.9, pan: 0, cutoff: 1, reverb: 0.08, attack: 0.001, release: 1.5, pitch: 0, root: 60 });
    function flashPad(i, delay = 0) { setTimeout(() => { const p = pads[i]; if (!p) return; p.classList.remove("hit"); void p.offsetWidth; p.classList.add("hit"); }, delay); }
    function hitPad(i, vel = 0.9) {
      GBL.audio.engine.hit(chFor(i), null, vel);
      flashPad(i);
      if (loop.playing && loop.rec) {
        const ctx = GBL.audio.engine.ctx, sd = 60 / S.project.bpm / 4;
        const pos = ((ctx.currentTime - loop.startTime) / sd) % LOOP;
        const step = Math.round(pos) % LOOP;
        if (!loop.events.some((e) => e.pad === i && e.step === step)) loop.events.push({ pad: i, step, vel });
      }
    }
    function renderPads() {
      clear(padGrid);
      pads.length = 0;
      PAD_KITS[kit].forEach((ref, i) => {
        const s = GBL.samples.byId[ref];
        const b = h("button", { class: "pad", style: { "--c": GBL.PALETTE[i % GBL.PALETTE.length] }, "aria-label": "Pad " + (i + 1) + ": " + s.name }, h("span", { class: "pad-ico" }, s.icon || "🔊"), h("span", { class: "pad-name" }, s.name), h("kbd", {}, PAD_KEYS[i].toUpperCase()));
        b.addEventListener("pointerdown", (e) => { e.preventDefault(); const r = b.getBoundingClientRect(); hitPad(i, clamp(0.5 + (1 - (e.clientY - r.top) / r.height) * 0.5, 0.4, 1)); });
        pads.push(b);
        padGrid.append(b);
      });
      GBL.samples.renderAll(PAD_KITS[kit]);
    }
    const kitSel = h("select", { "aria-label": "Pad kit" }, Object.keys(PAD_KITS).map((k) => h("option", { value: k }, k)));
    kitSel.onchange = () => { kit = kitSel.value; loop.events = []; renderPads(); };
    const playB = h("button", { class: "btn" }, "▶ Loop");
    const recB = h("button", { class: "btn rec-btn" }, "⏺ Record");
    const clearB = h("button", { class: "btn" }, "🧹 Clear");
    const sendB = h("button", { class: "btn primary" }, "➡ Send to Channel Rack");
    const beatDots = h("div", { class: "loop-dots" }, Array.from({ length: 8 }, () => h("span")));
    function tick() {
      const ctx = GBL.audio.engine.ctx, sd = 60 / S.project.bpm / 4;
      while (loop.nextTime < ctx.currentTime + 0.12) {
        const st = loop.nextStep % LOOP, t = loop.nextTime;
        for (const ev of loop.events) if (ev.step === st) { GBL.audio.engine.graph.playChannelNote(Object.assign(chFor(ev.pad), {}), 60, ev.vel, t, sd); flashPad(ev.pad, (t - ctx.currentTime) * 1000); }
        if (st % 4 === 0) {
          if (loop.rec) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = st % 16 === 0 ? 1760 : 1100; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.06); }
          const dot = Math.floor(st / 4);
          setTimeout(() => { beatDots.querySelectorAll("span").forEach((s, k) => s.classList.toggle("on", k === dot)); }, (t - ctx.currentTime) * 1000);
        }
        loop.nextStep++;
        loop.nextTime += sd;
      }
    }
    function startLoop() {
      const ctx = GBL.audio.engine.ensure();
      if (!ctx) return;
      for (let i = 0; i < 16; i++) GBL.audio.engine.graph.tempChannel(chFor(i));
      loop.playing = true;
      loop.startTime = ctx.currentTime + 0.05;
      loop.nextTime = loop.startTime;
      loop.nextStep = 0;
      loop.timer = setInterval(tick, 25);
      tick();
      playB.textContent = "⏹ Stop";
    }
    function stopLoop() { loop.playing = false; clearInterval(loop.timer); playB.textContent = "▶ Loop"; recB.classList.remove("on"); loop.rec = false; beatDots.querySelectorAll("span").forEach((s) => s.classList.remove("on")); }
    playB.onclick = () => (loop.playing ? stopLoop() : startLoop());
    recB.onclick = () => { loop.rec = !loop.rec; recB.classList.toggle("on", loop.rec); if (loop.rec && !loop.playing) startLoop(); };
    clearB.onclick = () => { loop.events = []; };
    sendB.onclick = () => {
      if (!loop.events.length) { GBL.ui.toast("Record a loop first: press ⏺ Record and play the pads!"); return; }
      const p = S.project;
      const pat = M.addPattern("Pad Loop");
      M.setPatternLength(pat, LOOP);
      const used = [...new Set(loop.events.map((e) => e.pad))];
      for (const i of used) {
        const ref = PAD_KITS[kit][i];
        let ch = p.channels.find((c) => c.kind === "sample" && c.sound === ref);
        if (!ch) { ch = M.newChannel(p, { kind: "sample", sound: ref, name: GBL.samples.byId[ref].name }); p.channels.push(ch); }
        const st = new Array(LOOP).fill(0);
        for (const e of loop.events) if (e.pad === i) st[e.step] = Math.round(e.vel * 100) / 100;
        pat.steps[ch.id] = st;
      }
      M.changed("pattern");
      GBL.ui.toast("🥁 Your loop is now the pattern “" + pat.name + "”");
      dlg.close();
    };
    renderPads();
    const body = h("div", { class: "pads-wrap" },
      h("div", { class: "pads-top" }, kitSel, playB, recB, clearB, beatDots, sendB),
      padGrid,
      h("p", { class: "hint center" }, "Tap the pads or press 1-4, Q-R, A-F, Z-V. Press ⏺ Record to build a 2-bar loop at " + S.project.bpm + " BPM."));
    fun.activeKeyboard = { onKey: (k, down) => { const i = PAD_KEYS.indexOf(k); if (i < 0) return false; if (down) hitPad(i); return true; } };
    const dlg = GBL.ui.modal({ title: "Beat Lab Pads", icon: "🥁", full: true, body, onClose: () => { stopLoop(); fun.activeKeyboard = null; } });
  };

  /* ---------- Soundboard ---------- */
  fun.soundboard = function () {
    const cats = ["Sound Effects", "Vocal Effects", "Retro Sounds", "Ambient Sounds"];
    const body = h("div", { class: "soundboard" });
    const keyList = [];
    for (const cat of cats) {
      body.append(h("h3", {}, cat));
      const grid = h("div", { class: "sb-grid" });
      for (const s of GBL.samples.LIST.filter((x) => x.cat === cat)) {
        const idx = keyList.length;
        const tile = h("button", { class: "sb-tile", style: { "--c": GBL.PALETTE[idx % GBL.PALETTE.length] }, "aria-label": "Play " + s.name }, h("span", { class: "sb-ico" }, s.icon || "🔊"), h("span", {}, s.name), idx < 10 ? h("kbd", {}, String((idx + 1) % 10)) : null);
        const add = h("button", { class: "sb-add", tip: "Add to my song as a channel", "aria-label": "Add " + s.name + " to my song" }, "＋");
        const play = () => { GBL.samples.render(s.id).then((b) => { GBL.audio.engine.previewBuffer(b); }); tile.classList.remove("hit"); void tile.offsetWidth; tile.classList.add("hit"); };
        tile.onclick = play;
        add.onclick = async (e) => { e.stopPropagation(); await GBL.samples.render(s.id); M.addChannel({ kind: "sample", sound: s.id, name: s.name }); GBL.ui.toast("Added " + s.name + " to the Channel Rack"); };
        keyList.push(play);
        grid.append(h("div", { class: "sb-cell" }, tile, add));
      }
      body.append(grid);
    }
    fun.activeKeyboard = { onKey: (k, down) => { if (!/^[0-9]$/.test(k)) return false; if (down) { const i = (+k + 9) % 10; keyList[i] && keyList[i](); } return true; } };
    GBL.ui.modal({ title: "Soundboard", icon: "🤪", full: true, body, onClose: () => { fun.activeKeyboard = null; } });
  };

  /* ---------- Visualizer ---------- */
  fun.visualizer = function () {
    const themes = [["bars", "📊 Bars"], ["circle", "⭕ Circle"], ["wave", "〰️ Wave"], ["stars", "✨ Stars"], ["tunnel", "🌀 Tunnel"]];
    let theme = GBL.settings.get("visualTheme") || "bars";
    const cv = h("canvas", { class: "viz-canvas", "aria-label": "Music visualizer" });
    const btns = h("div", { class: "viz-ctl" });
    const play = h("button", { class: "btn primary" }, GBL.audio.transport.playing ? "⏸ Pause" : "▶ Play");
    play.onclick = () => { GBL.audio.transport.toggle(); play.textContent = GBL.audio.transport.playing ? "⏸ Pause" : "▶ Play"; };
    btns.append(play);
    for (const [id, label] of themes) {
      const b = h("button", { class: "btn" + (id === theme ? " on" : "") }, label);
      b.onclick = () => { theme = id; GBL.settings.set("visualTheme", id); btns.querySelectorAll(".btn").forEach((x) => x.classList.remove("on")); b.classList.add("on"); };
      btns.append(b);
    }
    const body = h("div", { class: "viz" }, cv, btns);
    let raf = 0, t = 0;
    const stars = Array.from({ length: 220 }, () => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() }));
    const dlg = GBL.ui.modal({ title: "Music Visualizer", icon: "🌈", full: true, body, onClose: () => cancelAnimationFrame(raf) });
    void dlg;
    let freq = new Uint8Array(1024), wave = new Uint8Array(2048);
    function frame() {
      raf = requestAnimationFrame(frame);
      const W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      const ctx = GBL.fitCanvas(cv, W, H);
      const an = GBL.audio.engine.graph && GBL.audio.engine.graph.analyser;
      if (an) { if (freq.length !== an.frequencyBinCount) { freq = new Uint8Array(an.frequencyBinCount); wave = new Uint8Array(an.fftSize); } an.getByteFrequencyData(freq); an.getByteTimeDomainData(wave); }
      else { freq.fill(0); wave.fill(128); }
      let bass = 0; for (let i = 0; i < 12; i++) bass += freq[i]; bass /= 12 * 255;
      t += 0.01 + bass * 0.05;
      ctx.fillStyle = theme === "stars" || theme === "tunnel" ? "rgba(8, 6, 24, 0.35)" : "rgba(8, 6, 24, 0.28)";
      ctx.fillRect(0, 0, W, H);
      const hue = (t * 40) % 360;
      if (theme === "bars") {
        const n = 64, bw = W / n;
        for (let i = 0; i < n; i++) {
          const v = freq[Math.floor(Math.pow(i / n, 1.6) * freq.length * 0.7)] / 255;
          const bh = v * H * 0.85 + 2;
          ctx.fillStyle = "hsl(" + ((hue + i * 5) % 360) + ", 90%, " + (45 + v * 25) + "%)";
          ctx.fillRect(i * bw + 2, H - bh, bw - 4, bh);
          ctx.fillRect(i * bw + 2, H - bh - 10, bw - 4, 4);
        }
      } else if (theme === "circle") {
        const cx = W / 2, cy = H / 2, r = Math.min(W, H) * (0.18 + bass * 0.08);
        const n = 120;
        for (let i = 0; i < n; i++) {
          const v = freq[Math.floor((i / n) * freq.length * 0.6)] / 255;
          const a = (i / n) * Math.PI * 2 + t;
          const len = v * Math.min(W, H) * 0.3;
          ctx.strokeStyle = "hsl(" + ((hue + i * 3) % 360) + ", 95%, 60%)";
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len)); ctx.stroke();
        }
        ctx.fillStyle = "hsl(" + hue + ", 90%, " + (50 + bass * 30) + "%)";
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.fill();
      } else if (theme === "wave") {
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = "hsl(" + ((hue + k * 60) % 360) + ", 95%, 60%)";
          ctx.lineWidth = 4 - k;
          ctx.beginPath();
          for (let i = 0; i < wave.length; i += 4) {
            const x = (i / wave.length) * W;
            const y = H / 2 + ((wave[i] - 128) / 128) * H * 0.4 * (1 + k * 0.3) + Math.sin(i / 60 + t * 3 + k) * 10;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      } else if (theme === "stars") {
        const cx = W / 2, cy = H / 2, speed = 0.004 + bass * 0.04;
        for (const s of stars) {
          s.z -= speed;
          if (s.z <= 0.01) { s.z = 1; s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; }
          const x = cx + (s.x / s.z) * W * 0.3, y = cy + (s.y / s.z) * H * 0.3;
          const r = (1 - s.z) * 4 + bass * 3;
          ctx.fillStyle = "hsl(" + ((hue + s.x * 120) % 360) + ", 90%, 70%)";
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        const cx = W / 2, cy = H / 2;
        for (let i = 0; i < 18; i++) {
          const v = freq[i * 6] / 255;
          const r = ((i * 40 + t * 120) % (Math.max(W, H) * 0.8)) * (1 + v * 0.2);
          ctx.strokeStyle = "hsl(" + ((hue + i * 20) % 360) + ", 90%, " + (40 + v * 30) + "%)";
          ctx.lineWidth = 3 + v * 8;
          ctx.beginPath();
          const sides = 6;
          for (let k = 0; k <= sides; k++) { const a = (k / sides) * Math.PI * 2 + t * 0.5 + i * 0.1; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
          ctx.stroke();
        }
      }
      if (!GBL.audio.transport.playing && !an) { ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "600 18px Fredoka, sans-serif"; ctx.textAlign = "center"; ctx.fillText("Press Play to see your music!", W / 2, H / 2); ctx.textAlign = "start"; }
    }
    frame();
  };

  /* ---------- Guided tour ---------- */
  const TOUR = [
    [null, "👋 Welcome to Gaby's Beat Lab!", "This is your music studio. Let's take a quick look around. You can leave the tour any time."],
    [".transport", "▶ Play, Pause and Stop", "PAT plays the pattern you're working on, over and over. SONG plays your whole arrangement from the Playlist."],
    [".tempo", "⏱️ Tempo", "BPM means beats per minute. Bigger numbers are faster! Type a number, press the arrows, drag the BPM label or pick a preset."],
    ["#rack .rack-rows", "🥁 Channel Rack", "Each row is a sound. Click the squares to make a beat: each square is one step, 16 steps make one bar."],
    [".btn.mega", "✨ MAKE ME A BEAT!", "Stuck? Press this and Beat Lab makes a random drum beat for you."],
    ["#inspector", "🎛️ Instrument panel", "Change the sound of the selected channel with presets and knobs, and play it on the keyboard."],
    [".editor-tabs", "🎹 Piano Roll, 🎞️ Playlist, 🎚️ Mixer", "Write melodies in the Piano Roll, arrange your song in the Playlist, and add effects in the Mixer."],
    ["#browser", "📚 Browser", "Hundreds of ways to play: drums, sound effects, instruments and presets. Click to listen, drag into your song."],
    [".buddy", "🤖 Beat Buddy", "Tell Beat Buddy what you want, like “make a spooky soundtrack”, and it writes music you can change."],
    [".export-btn", "⬇ Export", "When you're done, export your song as WAV or MP3 to share it, or MIDI to use in other music apps."],
  ];
  fun.tutorial = function () {
    let i = 0;
    const hole = h("div", { class: "tour-hole" });
    const bubble = h("div", { class: "tour-bubble", role: "dialog", "aria-live": "polite" });
    const wrap = h("div", { class: "tour" }, hole, bubble);
    document.body.append(wrap);
    const end = () => { wrap.remove(); window.removeEventListener("resize", show); document.removeEventListener("keydown", key, true); store.set("toured", true); };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); end(); } if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); next(); } };
    document.addEventListener("keydown", key, true);
    const next = () => { i++; if (i >= TOUR.length) end(); else show(); };
    function show() {
      const [sel, title, text] = TOUR[i];
      const el = sel ? document.querySelector(sel) : null;
      clear(bubble);
      bubble.append(h("h3", {}, title), h("p", {}, text), h("div", { class: "tour-btns" },
        h("span", { class: "tour-count" }, i + 1 + " / " + TOUR.length),
        h("button", { class: "btn", onclick: end }, "Skip"),
        i > 0 ? h("button", { class: "btn", onclick: () => { i--; show(); } }, "Back") : null,
        h("button", { class: "btn primary", onclick: next }, i === TOUR.length - 1 ? "Let's make music! 🎉" : "Next ▶")));
      if (el && el.offsetParent !== null) {
        const r = el.getBoundingClientRect();
        Object.assign(hole.style, { display: "block", left: r.left - 6 + "px", top: r.top - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
        const bw = Math.min(340, window.innerWidth - 24);
        let x = clamp(r.left + r.width / 2 - bw / 2, 12, window.innerWidth - bw - 12);
        let y = r.bottom + 16;
        if (y + 190 > window.innerHeight) y = Math.max(12, r.top - 200);
        Object.assign(bubble.style, { left: x + "px", top: y + "px", width: bw + "px", transform: "none" });
      } else {
        hole.style.display = "none";
        Object.assign(bubble.style, { left: "50%", top: "40%", width: Math.min(380, window.innerWidth - 24) + "px", transform: "translate(-50%, -50%)" });
      }
      bubble.querySelector(".btn.primary").focus();
    }
    window.addEventListener("resize", show);
    show();
  };

  /* ---------- First-song guide (Beginner Mode) ---------- */
  const flags = store.get("guideFlags", {});
  bus.on("transport", (s) => { if (s === "play" && !flags.played) { flags.played = true; store.set("guideFlags", flags); refreshGuide(); } });
  bus.on("exported", () => { flags.exported = true; store.set("guideFlags", flags); refreshGuide(); });
  bus.on("change", (s) => { if (s === "bpm") { flags.tempo = true; store.set("guideFlags", flags); } refreshGuide(); });
  let guideEl = null;
  const GUIDE = [
    ["Make a beat: click squares in the Channel Rack (or press ✨ MAKE ME A BEAT!)", (p, pat) => p.channels.filter((c) => c.kind === "sample").reduce((a, c) => a + (pat.steps[c.id] || []).filter((v) => v > 0).length, 0) >= 4],
    ["Press ▶ Play to hear it", () => flags.played],
    ["Change the tempo (BPM) to make it faster or slower", (p) => flags.tempo || p.bpm !== 120],
    ["Add a melody: open 🎹 Piano Roll and click notes (or press 🎶 Melody)", (p) => p.patterns.some((pt) => p.channels.some((c) => c.kind === "synth" && (pt.notes[c.id] || []).length >= 3))],
    ["Put your pattern in the 🎞️ Playlist, then switch to SONG", (p) => p.clips.length > 0],
    ["⬇ Export your song!", () => flags.exported],
  ];
  function refreshGuide() {
    if (!guideEl || !S.project) return;
    const list = guideEl.querySelector("ol");
    clear(list);
    let n = 0;
    for (const [text, check] of GUIDE) {
      let ok = false;
      try { ok = !!check(S.project, M.getPattern()); } catch (e) { /* */ }
      if (ok) n++;
      list.append(h("li", { class: ok ? "ok" : "" }, h("span", { class: "tick" }, ok ? "✅" : "⬜"), text));
    }
    guideEl.querySelector(".guide-progress").textContent = n + " / " + GUIDE.length;
    if (n === GUIDE.length && !flags.guideDone) { flags.guideDone = true; store.set("guideFlags", flags); GBL.ui.confetti(); GBL.ui.toast("🏆 You made your first song! Amazing!"); }
  }
  fun.guide = function (show) {
    if (show === false) { if (guideEl) guideEl.remove(); guideEl = null; return; }
    if (guideEl) return;
    guideEl = h("aside", { class: "guide", "aria-label": "First song guide" },
      h("div", { class: "guide-head" }, h("b", {}, "🐣 Make your first song"), h("span", { class: "guide-progress" }), h("button", { class: "icon-btn tiny", "aria-label": "Hide guide", tip: "Hide the guide", onclick: () => { fun.guide(false); store.set("guideHidden", true); } }, "✕")),
      h("ol"));
    document.body.append(guideEl);
    store.set("guideHidden", false);
    refreshGuide();
  };
  bus.on("settings", (k, v) => { if (k === "beginner") { if (v && !store.get("guideHidden", false)) fun.guide(true); if (!v) fun.guide(false); } });

  /* ---------- dialogs ---------- */
  fun.openDialog = async function () {
    const list = await GBL.projects.list();
    const box = h("div", { class: "proj-list" });
    let m;
    if (!list.length) box.append(h("p", { class: "hint pad" }, "No saved songs yet. Press 💾 Save to keep your song here."));
    for (const r of list) {
      const del = h("button", { class: "icon-btn tiny", "aria-label": "Delete " + r.name, tip: "Delete" }, "🗑️");
      del.onclick = async (e) => { e.stopPropagation(); if (await GBL.ui.confirm("Delete song?", "Delete “" + r.name + "” from this browser? This can't be undone.", "Delete")) { await GBL.projects.remove(r.id); m.close(); fun.openDialog(); } };
      const row = h("button", { class: "proj-row" }, h("span", { class: "proj-ico" }, "🎶"), h("span", { class: "proj-text" }, h("b", {}, r.name), h("small", {}, new Date(r.updated).toLocaleString() + " · " + r.bpm + " BPM")), del);
      row.onclick = async () => {
        if (GBL.projects.dirty && !(await GBL.ui.confirm("Open another song?", "Your current song has unsaved changes. Open anyway?", "Open"))) return;
        m.close();
        GBL.projects.openStored(r.id);
      };
      box.append(row);
    }
    const fileB = h("button", { class: "btn" }, "📂 Open a .beatlab file…");
    fileB.onclick = () => { m.close(); GBL.projects.pickFile(); };
    m = GBL.ui.modal({ title: "My Projects", icon: "📂", body: h("div", {}, box), actions: [fileB] });
  };

  fun.shortcuts = function () {
    const mod = GBL.isMac ? "⌘" : "Ctrl";
    const rows = [["Space", "Play / Pause"], [mod + " + Z", "Undo"], [mod + " + Y  /  " + mod + " + Shift + Z", "Redo"], [mod + " + S", "Save"], [mod + " + Shift + S", "Save As"], [mod + " + O", "Open"],
      ["Z S X D C V … / Q 2 W 3 E …", "Play notes on the keyboard"], ["[  and  ]", "Keyboard octave down / up"], ["Delete", "Delete selected notes or clips"], [mod + " + A / C / X / V", "Select all, copy, cut, paste"],
      [mod + " + D", "Duplicate selection"], ["Arrow keys", "Move selected notes (Shift = octave)"], ["Alt + drag", "Copy notes while dragging"], [mod + " + mouse wheel", "Zoom the Piano Roll / Playlist"],
      ["Right-click", "Delete a note, change step volume, clip menu"], ["Alt + 1 / 2 / 3 / 4", "Show Playlist / Piano Roll / Mixer / Channel Rack"], ["Esc", "Close a window"]];
    GBL.ui.modal({ title: "Keyboard shortcuts", icon: "⌨️", body: h("table", { class: "shortcuts" }, rows.map(([k, v]) => h("tr", {}, h("td", {}, h("kbd", {}, k)), h("td", {}, v)))) });
  };

  fun.settingsDialog = function () {
    const tog = (key, label, desc) => {
      const cb = h("input", { type: "checkbox", checked: !!GBL.settings.get(key) });
      cb.onchange = () => GBL.settings.set(key, cb.checked);
      return h("label", { class: "check setting" }, cb, h("span", {}, h("b", {}, label), h("small", {}, desc)));
    };
    const reset = h("button", { class: "btn small", onclick: () => { GBL.layout.reset(); GBL.ui.toast("Layout reset"); } }, "Reset panel layout");
    GBL.ui.modal({ title: "Settings", icon: "⚙️", body: h("div", { class: "settings" },
      tog("beginner", "Beginner Mode", "Bigger buttons, fewer controls and a first-song guide."),
      tog("helpMusic", "Help Me Make Music", "Highlights notes and chords that sound good in the Piano Roll."),
      tog("tooltips", "Tooltips", "Show hints when you hover over buttons."),
      tog("uiSounds", "Button sounds", "Little blips when you click things."),
      tog("autosave", "Autosave saved songs", "Keep songs in My Projects up to date automatically (recovery always runs)."),
      reset) });
  };

  fun.about = function () {
    GBL.ui.modal({ title: "About Gaby's Beat Lab", icon: "🎛️", body: h("div", { class: "about" },
      h("p", {}, "A music studio that runs entirely in your browser: no installs, no accounts, no ads."),
      h("p", {}, "Every drum, instrument and sound effect is synthesized in code with the Web Audio API. There are no recorded samples, so everything you make is yours."),
      h("p", {}, "Projects are saved on this device (IndexedDB) and as .beatlab files. Beat Buddy runs offline, built from music-theory rules rather than an online AI."),
      h("p", { class: "hint" }, "MP3 export uses lamejs (LGPL). Font: Fredoka (SIL Open Font License)."),
      h("p", { class: "hint" }, "Audio engine: " + (GBL.audio.engine.supported ? "Web Audio ✔" : "not supported") + " · Offline export: " + (GBL.audio.OAC ? "✔" : "✖") + " · Microphone: " + (GBL.recorder.canRecord ? "✔" : "✖") + " · Storage: " + (GBL.storage.available ? "✔" : "✖"))) });
  };

  fun.welcome = function () {
    const card = (icon, title, text, fn) => { const b = h("button", { class: "welcome-card" }, h("span", { class: "wc-ico" }, icon), h("b", {}, title), h("small", {}, text)); b.onclick = () => { m.close(); fn(); }; return b; };
    const m = GBL.ui.modal({ title: "Let's make music!", icon: "🎛️", wide: true, cls: "welcome", body: h("div", {},
      h("p", { class: "modal-text" }, "Welcome to Gaby's Beat Lab, a real music studio for beginners and pros. What do you want to do?"),
      h("div", { class: "welcome-grid" },
        card("🥁", "Make a beat", "Start with drums, piano and bass ready to go.", () => { GBL.ui.toast("Click the squares, or press ✨ MAKE ME A BEAT!"); }),
        card("🎸", "Pick a genre", "Hip-Hop, EDM, Lo-Fi, Rock, Jazz and more.", () => fun.genreCreator()),
        card("🎲", "Surprise me", "Generate a whole random song.", () => fun.randomSong()),
        card("🐣", "I'm new here", "Turn on Beginner Mode and take the tour.", () => { GBL.settings.set("beginner", true); fun.tutorial(); }),
        card("🎹", "Just play", "Jump into the Instrument Playground.", () => fun.instrumentPlayground()),
        card("📂", "Open a song", "Continue something you saved.", () => fun.openDialog()))) });
  };

  GBL.fun = fun;
})();
