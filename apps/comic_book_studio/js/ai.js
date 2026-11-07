/* Creative assistant drawer: Story, Character, Background and Panel generators.
 * Two engines, always labelled honestly:
 *   "Built-in"   the offline generators in gen-*.js (always available)
 *   "AI service" an optional proxy you run (server/ai-proxy.mjs) that holds the API key server-side.
 * The browser never sees an API key. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, bus, clear, prefs } = CBS;
  const doc = () => CBS.doc;
  const ui = () => CBS.ui;
  const G = () => CBS.gen;

  let drawer = null, body, tabsEl, engineEl, tab = "story";
  let lastStory = null;
  const results = { character: [], background: [], panel: [] };

  /* ---------- AI service client ---------- */
  const service = {
    get url() { return (prefs.get("aiEndpoint", "") || "").trim().replace(/\/+$/, ""); },
    status: "unknown", // unknown | ok | error | off
    async health() {
      if (!this.url) { this.status = "off"; return false; }
      try {
        const r = await fetchJSON(this.url + "/health", null, 8000);
        this.status = r && r.ok ? "ok" : "error";
      } catch (e) { this.status = "error"; }
      bus.emit("ai:status");
      return this.status === "ok";
    },
    async call(path, payload) {
      if (!this.url) throw new Error("No AI service is set up. Add one in Settings, or use the built-in generator.");
      return fetchJSON(this.url + path, payload, 180000);
    },
  };
  async function fetchJSON(url, payload, timeout) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctl.signal } : { signal: ctl.signal });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `The AI service answered with an error (${r.status}).`);
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("The AI service took too long. Try again.");
      if (e instanceof TypeError) throw new Error("Couldn't reach the AI service. Check the address in Settings.");
      throw e;
    } finally { clearTimeout(t); }
  }
  const useAI = () => prefs.get("aiEngine", "builtin") === "ai" && !!service.url;

  /* ---------- drawer ---------- */
  function close() { if (drawer) { drawer.classList.remove("open"); setTimeout(() => { if (drawer && !drawer.classList.contains("open")) drawer.hidden = true; }, 200); bus.emit("drawer:changed"); } }
  const isOpen = () => drawer && !drawer.hidden && drawer.classList.contains("open");
  function open(t) {
    if (!drawer) build();
    if (CBS.library.isOpen()) CBS.library.close();
    if (t) tab = t;
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add("open"));
    render();
    if (service.url && service.status === "unknown") service.health().then(renderEngine);
    bus.emit("drawer:changed");
  }
  function toggle() { if (isOpen()) close(); else open(); }

  function build() {
    tabsEl = h("div", { class: "seg sm drawer-tabs" });
    engineEl = h("div", { class: "ai-engine" });
    body = h("div", { class: "ai-body" });
    drawer = h("aside", { class: "drawer ai-drawer", hidden: true, "aria-label": "Creative assistant" },
      h("div", { class: "drawer-head" }, h("h3", null, "🪄 Creative Assistant"), h("div", { class: "spacer" }), h("button", { class: "icon-btn", "aria-label": "Close assistant", onclick: close }, "✕")),
      engineEl, tabsEl, body);
    document.getElementById("workspace").append(drawer);
    bus.on("ai:status", renderEngine);
  }

  function renderEngine() {
    if (!engineEl) return;
    clear(engineEl);
    const connected = !!service.url;
    const seg = ui().segmented([
      ["builtin", "⚙️ Built-in", "Works offline. Uses Comic Book Studio's own story tables and art generators."],
      ["ai", "✨ AI service", connected ? "Uses your AI service at " + service.url : "Set up an AI service in Settings first"],
    ], useAI() ? "ai" : "builtin", (v) => {
      if (v === "ai" && !connected) { ui().toast("Add your AI service address in Settings first."); CBS.app.settings("ai"); renderEngine(); return; }
      prefs.set("aiEngine", v);
      if (v === "ai") service.health();
      renderEngine();
    }, { small: true, label: "Generator" });
    const dot = { ok: "🟢 Connected", error: "🔴 Can't reach the service", off: "⚪ Not set up", unknown: "⚪ Not checked" }[connected ? service.status : "off"];
    engineEl.append(seg, h("span", { class: "ai-status" }, useAI() ? dot : "Offline generator: no account or internet needed"));
  }

  function render() {
    renderEngine();
    clear(tabsEl);
    for (const [k, label] of [["story", "📝 Story"], ["character", "🦸 Character"], ["background", "🏙️ Background"], ["panel", "🎬 Panel"]]) {
      tabsEl.append(h("button", { class: "seg-btn" + (tab === k ? " on" : ""), onclick: () => { tab = k; render(); } }, label));
    }
    clear(body);
    if (tab === "story") body.append(storyTab());
    else if (tab === "character") body.append(characterTab());
    else if (tab === "background") body.append(backgroundTab());
    else body.append(panelTab());
  }

  /* ---------- story ---------- */
  function storyTab() {
    const st = prefs.get("aiStory", { idea: "", genre: "superhero", tone: "fun", pages: 4 });
    const save = () => prefs.set("aiStory", st);
    const idea = h("textarea", { class: "input textarea", rows: 3, placeholder: "e.g. A shy kid named Pip discovers her cat can talk, and together they stop a robot from stealing the moon." });
    idea.value = st.idea;
    idea.addEventListener("input", () => { st.idea = idea.value; save(); });
    let section = prefs.get("aiStorySection", "breakdown");
    const out = h("textarea", { class: "input textarea ai-out", rows: 14, readonly: true, "aria-label": "Generated story" });
    const meta = h("div", { class: "hint" });
    const show = () => {
      out.value = lastStory ? G().storyText(lastStory, section) : "";
      meta.textContent = lastStory ? (lastStory.source === "ai" ? "✨ Written by your AI service" : "⚙️ Made by the built-in idea generator. Use it as a starting point and rewrite it in your own words!") : "";
      buildBtn.disabled = !lastStory;
    };
    const gen = async () => {
      btn.disabled = true;
      btn.textContent = "Writing…";
      try {
        if (useAI()) lastStory = await service.call("/story", { idea: st.idea, genre: st.genre, tone: st.tone, pages: st.pages });
        else { await CBS.wait(250); lastStory = G().story({ idea: st.idea, genre: st.genre, tone: st.tone, pages: st.pages, seed: Date.now() }); }
        show();
      } catch (e) { ui().toast(e.message, { kind: "error" }); }
      finally { btn.disabled = false; btn.textContent = lastStory ? "🔄 Regenerate" : "✨ Generate story"; }
    };
    const btn = ui().button(lastStory ? "🔄 Regenerate" : "✨ Generate story", gen, { kind: "primary" });
    const buildBtn = ui().button("Build comic pages", () => buildPages(lastStory), { icon: "📄", tip: "Create pages with panels, captions, speech bubbles and sound effects from this breakdown" });
    const sectionSel = ui().select({ breakdown: "Page-by-page breakdown", concept: "Story concept", outline: "Outline", characters: "Characters", dialogue: "Dialogue", narration: "Narration captions", scenes: "Scene descriptions" }, section, (v) => { section = v; prefs.set("aiStorySection", v); show(); });
    const frag = h("div", { class: "ai-tab" },
      ui().field("Your idea", idea),
      h("div", { class: "frow" },
        ui().field("Genre", ui().select(G().GENRES, st.genre, (v) => { st.genre = v; save(); })),
        ui().field("Tone", ui().select(G().TONES, st.tone, (v) => { st.tone = v; save(); }))),
      ui().slider({ label: "Pages", min: 1, max: 12, value: st.pages, onInput: (v) => { st.pages = v; save(); } }),
      h("div", { class: "btn-row" }, btn),
      ui().field("Show", sectionSel),
      out, meta,
      h("div", { class: "btn-row" },
        buildBtn,
        ui().button("Copy", () => { if (out.value) navigator.clipboard.writeText(out.value).then(() => ui().toast("Copied!", { kind: "ok" }), () => { out.select(); }); }, { icon: "⧉" })));
    show();
    return frag;
  }

  function templateFor(n) { return { 1: "full", 2: "two-h", 3: "three-rows", 4: "four", 5: "mixed5", 6: "six" }[Math.min(6, Math.max(1, n))]; }

  /* Turn a story breakdown into real pages: panels, captions, speech bubbles, SFX and script notes. */
  async function buildPages(story) {
    if (!story || !story.pages || !story.pages.length) return;
    const ok = await ui().confirm(`Add ${story.pages.length} new page${story.pages.length > 1 ? "s" : ""} after this one, with panels, captions, speech bubbles and sound effects from the breakdown? Scene descriptions go on a “Script notes” layer that is never exported.`, { ok: "Build pages", title: "Build comic pages" });
    if (!ok) return;
    const p = doc().project;
    const at = doc().pageIndex + 1;
    const newPages = story.pages.map((sp) => {
      const panelsData = (sp.panels || []).slice(0, 6);
      const page = CBS.actions.newPageFor(p, templateFor(panelsData.length || 1));
      const panels = page.layers.find((l) => l.type === "panel").objects;
      const bubbleLayer = page.layers.find((l) => l.type === "bubble");
      const textLayer = page.layers.find((l) => l.type === "text");
      const notes = CBS.createLayer("text", "Script notes (not exported)");
      notes.noExport = true;
      page.layers.push(notes);
      panelsData.forEach((pd, i) => {
        const pn = panels[i];
        if (!pn) return;
        const b = CBS.render.aabb(pn);
        const pad = 10;
        let y = b.y + pad;
        if (pd.caption) {
          const cap = CBS.createObject("bubble", { text: pd.caption, x: b.x + pad, y, w: Math.min(b.w * 0.75, 260), h: 50 });
          CBS.lettering.applyBubbleType(cap, "narration");
          cap.fontSize = 13;
          CBS.lettering.fitBubble(cap);
          bubbleLayer.objects.push(cap);
          y = cap.y + cap.h + 6;
        }
        (pd.dialogue || []).slice(0, 3).forEach((d, k) => {
          const type = ["speech", "thought", "whisper", "shout"].includes(d.type) ? d.type : "speech";
          const w = Math.min(b.w * 0.55, 210);
          const left = k % 2 === 0;
          const bub = CBS.createObject("bubble", { text: d.text, x: left ? b.x + pad : b.x + b.w - w - pad, y, w, h: 70, name: d.speaker || "" });
          CBS.lettering.applyBubbleType(bub, type);
          bub.fontSize = 14;
          CBS.lettering.fitBubble(bub);
          if (bub.y + bub.h > b.y + b.h - pad) bub.y = Math.max(b.y + pad, b.y + b.h - pad - bub.h);
          bub.tail = { x: (left ? 1 : -1) * bub.w * 0.15, y: bub.h * 0.5 + 34 };
          bubbleLayer.objects.push(bub);
          y = bub.y + bub.h + 8;
        });
        if (pd.sfx) {
          const pre = CBS.lettering.SFX_PRESETS[i % CBS.lettering.SFX_PRESETS.length];
          const sfx = CBS.createObject("sfx", Object.assign({}, pre, { id: undefined, label: undefined, text: pd.sfx, x: b.x + b.w - Math.min(180, b.w * 0.6) - pad, y: b.y + b.h - Math.min(90, b.h * 0.35) - pad, w: Math.min(180, b.w * 0.6), h: Math.min(90, b.h * 0.35), rot: -8 }));
          delete sfx.label;
          textLayer.objects.push(sfx);
        }
        if (pd.scene) {
          const note = CBS.createObject("text", { text: "✏️ " + pd.scene, x: b.x + pad, y: b.y + b.h - 60, w: b.w - pad * 2, font: "Patrick Hand", fontSize: 13, color: "#6d28d9", bg: "#f5f3ffcc", padding: 4 });
          CBS.lettering.fitTextHeight(note);
          note.y = b.y + b.h - note.h - pad;
          notes.objects.push(note);
        }
      });
      return page;
    });
    doc().edit("Build pages from story", () => p.pages.splice(at, 0, ...newPages), "doc");
    doc().setPage(newPages[0].id);
    bus.emit("pages:changed");
    ui().toast(`Added ${newPages.length} pages. Now draw the scenes! Hide the “Script notes” layer whenever you like.`, { kind: "ok", ms: 5000 });
  }

  /* ---------- art results ---------- */
  function resultGrid(kind) {
    const grid = h("div", { class: "ai-results" });
    if (!results[kind].length) { grid.append(h("p", { class: "hint pad" }, "Your creations appear here.")); return grid; }
    for (const r of results[kind]) {
      grid.append(h("div", { class: "ai-result" },
        h("div", { class: "ar-img" + (kind === "character" ? " checker" : "") }, h("img", { src: r.src, alt: r.name })),
        h("small", null, (r.source === "ai" ? "✨ " : "⚙️ ") + r.name),
        h("div", { class: "btn-row" },
          ui().button("Insert", () => insertResult(r, kind), { small: true, kind: "primary", tip: "Add to the page, or into the selected panel" }),
          ui().button("Save", async () => { await CBS.assets.library.add({ src: r.src, w: r.w, h: r.h, name: r.name, category: r.category }); ui().toast("Saved to your library ⭐", { kind: "ok" }); }, { small: true, tip: "Save to your asset library" }))));
    }
    return grid;
  }
  function insertResult(r, kind) {
    const asset = CBS.assets.addToProject({ src: r.src, w: r.w, h: r.h, name: r.name, category: r.category });
    const sel = doc().selected();
    const panel = sel.length === 1 && sel[0].kind === "panel" ? sel[0] : null;
    CBS.assets.placeAsset(asset, { panel, cover: kind !== "character" });
  }
  async function svgToResult(svg, name, category) {
    const src = CBS.gen.svgURL(svg);
    const img = await CBS.loadImage(src);
    return { src, w: img.naturalWidth || 400, h: img.naturalHeight || 400, name, category, source: "ai" };
  }
  function panelAspect() {
    const sel = doc().selected();
    if (sel.length === 1 && sel[0].kind === "panel") { const b = CBS.render.aabb(sel[0]); return b.w / b.h; }
    return 1.5;
  }
  async function runGen(kind, btn, make, count = 1) {
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "Creating…";
    try {
      const fresh = [];
      for (let i = 0; i < count; i++) fresh.push(await make(i));
      results[kind] = fresh.concat(results[kind]).slice(0, 12);
      render();
    } catch (e) { ui().toast(e.message || "Couldn't create that.", { kind: "error" }); btn.disabled = false; btn.textContent = old; }
  }

  /* ---------- character ---------- */
  let charParams = null;
  function characterTab() {
    const prompt = h("textarea", { class: "input textarea", rows: 3, placeholder: "e.g. A brave girl named Zara with a red cape, goggles and lightning powers, flying and smiling" });
    prompt.value = prefs.get("aiCharPrompt", "");
    if (!charParams) charParams = G().parseCharacter(prompt.value, 1);
    const P = charParams;
    const preview = h("div", { class: "char-preview checker" });
    const drawPreview = () => { clear(preview).append(h("img", { src: G().svgURL(G().characterSVG(P)), alt: "Character preview" })); };
    const field = (label, key, options) => ui().field(label, ui().select(options, P[key], (v) => { P[key] = v; drawPreview(); }));
    const colorF = (label, key) => ui().field(label, ui().colorButton(P[key], (c) => { P[key] = c; drawPreview(); }, { label }), { inline: true });
    prompt.addEventListener("change", () => { prefs.set("aiCharPrompt", prompt.value); });
    const apply = () => { prefs.set("aiCharPrompt", prompt.value); charParams = G().parseCharacter(prompt.value, Date.now() % 100000); render(); };
    const gen = h("button", { class: "btn primary" }, useAI() ? "✨ Draw with AI" : "✨ Create character");
    gen.addEventListener("click", () => {
      if (useAI()) runGen("character", gen, async (i) => { const r = await service.call("/art", { kind: "character", prompt: describeCharacter(prompt.value, P), variation: i ? String(i + 1) : "" }); return svgToResult(r.svg, r.title || P.name || "Character", "characters"); });
      else runGen("character", gen, async () => ({ src: G().svgURL(G().characterSVG(P)), w: 420, h: 600, name: P.name || "Character", category: "characters", source: "builtin" }));
    });
    const alt = ui().button("🎲 4 alternate versions", () => {
      if (useAI()) runGen("character", alt, async (i) => { const r = await service.call("/art", { kind: "character", prompt: describeCharacter(prompt.value, P), variation: String(i + 2) }); return svgToResult(r.svg, r.title || "Character", "characters"); }, 2);
      else runGen("character", alt, async (i) => { const v = G().parseCharacter(prompt.value, Date.now() + i * 7919); v.name = P.name; return { src: G().svgURL(G().characterSVG(v)), w: 420, h: 600, name: (P.name || "Character") + " v" + (i + 2), category: "characters", source: "builtin" }; }, 4);
    });
    drawPreview();
    return h("div", { class: "ai-tab" },
      ui().field("Describe your character", prompt),
      h("div", { class: "btn-row" }, ui().button("Read my description", apply, { small: true, tip: "Fill in the options below from your description" })),
      h("div", { class: "char-maker" }, preview,
        h("div", { class: "char-fields" },
          ui().field("Name", (() => { const i = h("input", { class: "input", value: P.name, maxlength: 30 }); i.addEventListener("input", () => { P.name = i.value; drawPreview(); }); return i; })()),
          field("Type", "species", G().SPECIES), field("Pose", "pose", G().POSES), field("Face", "expression", G().EXPRESSIONS),
          field("Power", "power", G().POWERS), field("Chest emblem", "emblem", G().EMBLEMS), field("Hair", "hairStyle", G().HAIR_STYLES), field("Hat", "hat", G().HATS),
          h("div", { class: "frow wrap" }, colorF("Outfit", "suit"), colorF("Trim", "suit2"), colorF("Hair", "hairColor"), colorF("Skin", "skin"), P.cape ? colorF("Cape", "capeColor") : null),
          h("div", { class: "frow wrap" },
            ui().toggle("Cape", P.cape, (v) => { P.cape = v; render(); }), ui().toggle("Mask", P.mask, (v) => { P.mask = v; drawPreview(); }),
            ui().toggle("Glasses", P.glasses, (v) => { P.glasses = v; drawPreview(); }), ui().toggle("Goggles", P.goggles, (v) => { P.goggles = v; drawPreview(); })))),
      useAI() ? h("p", { class: "hint" }, "The AI draws an original character from your description and the options above.") : h("p", { class: "hint" }, "Built-in character maker: mix and match, then add it. Your own drawings are always welcome too!"),
      h("div", { class: "btn-row" }, gen, alt),
      resultGrid("character"));
  }
  function describeCharacter(text, P) {
    return `${text || "An original comic hero"}. Name: ${P.name}. Type: ${P.species}. Pose: ${G().POSES[P.pose]}. Expression: ${G().EXPRESSIONS[P.expression]}. Superpower: ${G().POWERS[P.power]}. Outfit color ${P.suit} with ${P.suit2} trim${P.cape ? `, cape ${P.capeColor}` : ""}${P.mask ? ", domino mask" : ""}${P.goggles ? ", goggles" : ""}${P.glasses ? ", glasses" : ""}${P.hat !== "none" ? ", " + G().HATS[P.hat] : ""}.`;
  }

  /* ---------- background ---------- */
  function backgroundTab() {
    const st = prefs.get("aiBg", { prompt: "", time: "auto", weather: "none" });
    const prompt = h("input", { class: "input", placeholder: "e.g. a futuristic city at sunset", value: st.prompt });
    prompt.addEventListener("input", () => { st.prompt = prompt.value; prefs.set("aiBg", st); });
    const quick = h("div", { class: "chip-row" }, ["Futuristic city", "Outer space", "Alien planet", "Haunted mansion", "Medieval castle", "Superhero headquarters", "Enchanted forest", "Tropical beach", "Underwater reef", "Snowy mountains", "Desert canyon", "Cozy bedroom"].map((q) => h("button", { class: "chip", onclick: () => { prompt.value = q; st.prompt = q; prefs.set("aiBg", st); } }, q)));
    const params = (seedText) => {
      const p = G().parseBackground(seedText);
      if (st.time !== "auto") p.time = st.time;
      if (st.weather !== "none") p.weather = st.weather; else if (st.weather === "none" && !/rain|snow|fog|mist|storm/.test(seedText.toLowerCase())) p.weather = null;
      return p;
    };
    const makeBuiltin = (seed) => {
      const ar = panelAspect();
      const W = 1500, H = Math.round(W / Math.max(0.4, Math.min(3, ar)));
      const c = G().background(params(prompt.value || "city"), seed, W, H);
      return { src: c.toDataURL("image/jpeg", 0.9), w: W, h: H, name: (prompt.value || "Background").slice(0, 30), category: "backgrounds", source: "builtin" };
    };
    const makeAI = async (i) => {
      const ar = panelAspect();
      const W = 1200, H = Math.round(W / Math.max(0.5, Math.min(2.5, ar)));
      const extra = (st.time !== "auto" ? `, ${st.time === "sunset" ? "at sunset" : st.time === "night" ? "at night" : "in daylight"}` : "") + (st.weather !== "none" ? `, ${st.weather}` : "");
      const r = await service.call("/art", { kind: "background", prompt: (prompt.value || "a city street") + extra, width: W, height: H, variation: i ? String(i + 1) : "" });
      return svgToResult(r.svg, r.title || prompt.value || "Background", "backgrounds");
    };
    const gen = h("button", { class: "btn primary" }, useAI() ? "✨ Paint with AI" : "✨ Paint background");
    gen.addEventListener("click", () => runGen("background", gen, useAI() ? makeAI : async () => makeBuiltin(Date.now())));
    const alt = ui().button("🎲 Alternate versions", () => runGen("background", alt, useAI() ? (i) => makeAI(i + 1) : async (i) => makeBuiltin(Date.now() + i * 104729), useAI() ? 2 : 4));
    return h("div", { class: "ai-tab" },
      ui().field("Describe the place", prompt), quick,
      h("div", { class: "frow" },
        ui().field("Time of day", ui().select({ auto: "From description", day: "Day", sunset: "Sunset", night: "Night" }, st.time, (v) => { st.time = v; prefs.set("aiBg", st); })),
        ui().field("Weather", ui().select({ none: "From description", rain: "Rain", snow: "Snow", fog: "Fog" }, st.weather, (v) => { st.weather = v; prefs.set("aiBg", st); }))),
      h("p", { class: "hint" }, "Select a panel first and the background is shaped to fit it."),
      h("div", { class: "btn-row" }, gen, alt),
      resultGrid("background"));
  }

  /* ---------- panel ---------- */
  function panelTab() {
    const prompt = h("textarea", { class: "input textarea", rows: 3, placeholder: "e.g. A hero flying over a haunted castle at night, looking determined" });
    prompt.value = prefs.get("aiPanelPrompt", "");
    prompt.addEventListener("input", () => prefs.set("aiPanelPrompt", prompt.value));
    const make = async (i, seed) => {
      const ar = panelAspect();
      if (useAI()) {
        const W = 1200, H = Math.round(W / Math.max(0.5, Math.min(2.5, ar)));
        const r = await service.call("/art", { kind: "panel", prompt: prompt.value || "a comic hero in action", width: W, height: H, variation: i ? String(i + 1) : "" });
        return svgToResult(r.svg, r.title || "Panel art", "backgrounds");
      }
      const W = 1500, H = Math.round(W / Math.max(0.4, Math.min(3, ar)));
      const c = await G().panel(prompt.value || "a hero in the city", seed, W, H);
      return { src: c.toDataURL("image/jpeg", 0.9), w: W, h: H, name: "Panel: " + (prompt.value || "scene").slice(0, 24), category: "backgrounds", source: "builtin" };
    };
    const gen = h("button", { class: "btn primary" }, useAI() ? "✨ Illustrate with AI" : "✨ Compose panel");
    gen.addEventListener("click", () => runGen("panel", gen, (i) => make(i, Date.now())));
    const alt = ui().button("🎲 Alternate versions", () => runGen("panel", alt, (i) => make(i + 1, Date.now() + i * 7919), useAI() ? 2 : 4));
    const sel = doc().selected();
    const hasPanel = sel.length === 1 && sel[0].kind === "panel";
    return h("div", { class: "ai-tab" },
      ui().field("Describe the panel", prompt),
      h("p", { class: "hint" }, hasPanel ? "✅ A panel is selected: Insert puts the art inside it." : "Tip: select a panel on the page first, then Insert puts the art inside it."),
      useAI() ? null : h("p", { class: "hint" }, "The built-in composer matches a scene to your words and adds a character when you mention one. Use it for rough layouts, then draw over it!"),
      h("div", { class: "btn-row" }, gen, alt),
      resultGrid("panel"));
  }

  bus.on("selection:changed", () => { if (isOpen() && tab === "panel") render(); });

  CBS.ai = { open, close, toggle, isOpen, service, buildPages };
})();
