/* Beginner tutorial: a spotlight tour of the 7 steps to a first comic. */
(function () {
  "use strict";
  const CBS = window.CBS;
  const { h, clamp, prefs } = CBS;

  const STEPS = [
    { title: "👋 Welcome to Comic Book Studio!", text: "Let's make a comic together. This tour shows the 7 steps. Each step has a “Show me” button that does it for you. You can leave any time." },
    { sel: "#tb-new", title: "1 · Create a new comic", text: "Click New to start a comic. Choose its title, page size (US comic, manga, A4, square…), cover design and how many pages to start with.", show: () => CBS.projects.newComicWizard(), showLabel: "Open the wizard" },
    { sel: '[data-tool="panel"]', title: "2 · Add comic panels", text: "Panels are the boxes your story happens in. Pick a ready-made layout, draw your own with the Panel tool, slice panels diagonally, and drag the gaps between them to resize.", show: () => { CBS.tools.set("panel"); CBS.pagesPanel.layoutPicker(); }, showLabel: "Pick a layout" },
    { sel: '[data-tool="library"]', title: "3 · Add artwork", text: "Draw right on the page with the Draw tool, or import your own pictures (PNG, JPG, WEBP, SVG). The Asset Library has sample characters and backgrounds to start with. Click a panel first and your art goes inside it.", show: () => CBS.library.open({ tab: "samples" }), showLabel: "Open the library" },
    { sel: '[data-tool="bubble"]', title: "4 · Add speech bubbles", text: "Choose the Speech Bubble tool and click the page to type. Try thought, whisper, shout and narration bubbles. Drag the pink dot to point the tail at the character who's talking.", show: () => CBS.tools.set("bubble"), showLabel: "Use the bubble tool" },
    { sel: '[data-tool="sfx"]', title: "5 · Add sound effects", text: "POW! BAM! WHOOSH! The Sound Effect tool stamps big comic lettering. Pick a style, then change its colors, 3D depth, slant and warp.", show: () => CBS.tools.set("sfx"), showLabel: "Use the sound effect tool" },
    { sel: "#pages .pages-bar", title: "6 · Make more pages", text: "Your pages live down here. Add, duplicate, delete and drag pages to reorder them. Click a page to edit it.", show: () => CBS.pagesPanel.addPageDialog(), showLabel: "Add a page" },
    { sel: "#tb-export", title: "7 · Export your comic", text: "When you're done, press Preview to read it like a real comic book, then Export to save a PDF or images to share and print. Your work also saves itself automatically.", show: () => CBS.exporter.open(), showLabel: "Open export" },
    { title: "🎉 You're ready!", text: "Want to see a finished example? Open the sample comic from the Help menu any time. Now go make something amazing!", show: () => CBS.sample.open(), showLabel: "Open the sample comic" },
  ];

  let el = null, i = 0;

  function place() {
    if (!el) return;
    const step = STEPS[i];
    const hole = el.querySelector(".tour-hole");
    const card = el.querySelector(".tour-card");
    const target = step.sel ? document.querySelector(step.sel) : null;
    const visible = target && target.getBoundingClientRect().width > 0;
    if (visible) {
      const r = target.getBoundingClientRect();
      const pad = 6;
      Object.assign(hole.style, { display: "block", left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
      const cr = card.getBoundingClientRect();
      let x = r.right + 16, y = r.top;
      if (x + cr.width > innerWidth - 10) x = r.left - cr.width - 16;
      if (x < 10) { x = clamp(r.left + r.width / 2 - cr.width / 2, 10, innerWidth - cr.width - 10); y = r.bottom + 16; }
      if (y + cr.height > innerHeight - 10) y = Math.max(10, r.top - cr.height - 16);
      card.style.left = x + "px";
      card.style.top = clamp(y, 10, innerHeight - cr.height - 10) + "px";
      card.classList.remove("centered");
    } else {
      hole.style.display = "none";
      card.classList.add("centered");
      card.style.left = card.style.top = "";
    }
  }

  function render() {
    const step = STEPS[i];
    const card = el.querySelector(".tour-card");
    CBS.clear(card).append(
      h("div", { class: "tour-progress" }, STEPS.map((_, k) => h("span", { class: k === i ? "on" : k < i ? "done" : "" }))),
      h("h3", null, step.title),
      h("p", null, step.text),
      h("div", { class: "btn-row" },
        i > 0 ? h("button", { class: "btn", onclick: () => go(-1) }, "◀ Back") : h("button", { class: "btn", onclick: end }, "Skip tour"),
        h("div", { class: "spacer" }),
        step.show ? h("button", { class: "btn", onclick: () => { const fn = step.show; end(); setTimeout(fn, 50); } }, "👉 " + (step.showLabel || "Show me")) : null,
        i < STEPS.length - 1 ? h("button", { class: "btn primary", onclick: () => go(1) }, "Next ▶") : h("button", { class: "btn primary", onclick: end }, "Finish")));
    requestAnimationFrame(place);
  }
  function go(d) { i = clamp(i + d, 0, STEPS.length - 1); render(); }
  function onKey(e) {
    if (!el) return;
    if (e.key === "Escape") { e.stopPropagation(); end(); }
    else if (e.key === "ArrowRight") { e.stopPropagation(); go(1); }
    else if (e.key === "ArrowLeft") { e.stopPropagation(); go(-1); }
  }
  function start(at = 0) {
    end();
    CBS.ui.closeMenu();
    i = at;
    el = h("div", { class: "tour", role: "dialog", "aria-label": "Tutorial" }, h("div", { class: "tour-hole" }), h("div", { class: "tour-card" }));
    document.body.append(el);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    render();
    prefs.set("tourSeen", true);
  }
  function end() {
    if (!el) return;
    el.remove();
    el = null;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", place);
  }

  CBS.tutorial = { start, end, get active() { return !!el; } };
})();
