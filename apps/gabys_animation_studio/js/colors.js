/* Colors: main (line) color and fill color, a big palette, a rainbow picker, HEX input,
 * recently used colors and favorites (kept on this device). */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state, h, clamp } = GAS;

  const PALETTE = [
    "#000000", "#2b2340", "#495057", "#8d99ae", "#ced4da", "#ffffff",
    "#7f1d1d", "#c1121f", "#ef233c", "#ff4d6d", "#ff8fab", "#ffc8dd",
    "#9c4a00", "#f77f00", "#ff9f1c", "#ffbf69", "#ffd23f", "#fff3b0",
    "#2d6a4f", "#38b000", "#70e000", "#9ef01a", "#57cc99", "#c7f9cc",
    "#03045e", "#0077b6", "#00b4d8", "#4cc9f0", "#90e0ef", "#caf0f8",
    "#3c096c", "#7b2cbf", "#9b5de5", "#c77dff", "#f15bb5", "#e0aaff",
    "#6f4518", "#a47148", "#e6b8a2", "#ffd6a5", "#f4a261", "#2a9d8f",
  ];
  const NAMES = { "#000000": "Black", "#ffffff": "White", "#ef233c": "Red", "#ffd23f": "Yellow", "#38b000": "Green", "#0077b6": "Blue", "#9b5de5": "Purple", "#f77f00": "Orange", "#ff8fab": "Pink", "#6f4518": "Brown" };

  let recent = GAS.prefs.get("recentColors", []);
  let favorites = GAS.prefs.get("favoriteColors", ["#ef476f", "#ffd23f", "#06d6a0", "#118ab2"]);
  let target = "primary"; // which swatch the palette changes

  function colorObject() {
    // When a text or effect is selected, picking a color recolors it.
    if (state.tool !== "select" && state.tool !== "text") return null;
    const o = GAS.selection.selectedObject();
    return o && (o.type === "text" || o.type === "effect") ? o : null;
  }

  function setPrimary(hex, opts = {}) {
    hex = GAS.normalizeHex(hex);
    if (!hex) return;
    const o = !opts.noObject && colorObject();
    if (o && target === "primary") {
      GAS.selection.editObject({ color: hex }, "Color");
      if (o.type === "text") state.textDefaults.color = hex;
    } else if (o && target === "secondary" && o.type === "text") {
      GAS.selection.editObject({ outlineColor: hex, outline: true }, "Outline color");
    } else if (o && target === "secondary" && o.type === "effect") {
      GAS.selection.editObject({ color2: hex }, "Color");
    }
    if (target === "secondary" && !opts.forcePrimary) state.secondary = hex;
    else state.primary = hex;
    GAS.bus.emit("color-changed");
  }
  function set(which, hex) {
    hex = GAS.normalizeHex(hex);
    if (!hex) return;
    state[which] = hex;
    GAS.bus.emit("color-changed");
  }
  function swap() {
    [state.primary, state.secondary] = [state.secondary, state.primary];
    GAS.bus.emit("color-changed");
  }
  function addRecent(hex) {
    hex = GAS.normalizeHex(hex);
    if (!hex) return;
    recent = [hex, ...recent.filter((c) => c !== hex)].slice(0, 12);
    GAS.prefs.set("recentColors", recent);
    GAS.bus.emit("recent-colors");
  }
  function toggleFavorite(hex) {
    hex = GAS.normalizeHex(hex);
    if (favorites.includes(hex)) favorites = favorites.filter((c) => c !== hex);
    else favorites = [hex, ...favorites].slice(0, 16);
    GAS.prefs.set("favoriteColors", favorites);
    GAS.bus.emit("recent-colors");
  }

  const current = () => (target === "secondary" ? state.secondary : state.primary);

  /* ---------- panel ---------- */
  function swatchBtn(hex, onPick, extraTip) {
    return h("button", {
      class: "swatch", type: "button", style: { "--c": hex },
      tip: (NAMES[hex] || hex.toUpperCase()) + (extraTip || ""), "aria-label": "Color " + (NAMES[hex] || hex),
      onclick: () => onPick(hex),
    });
  }

  function panel() {
    const I = GAS.icons.svg;
    const mainSw = h("button", { class: "big-swatch main", type: "button", tip: "Main color: lines, pencil, brush and text", onclick: () => { target = "primary"; refresh(); } }, h("span", null, "Main"));
    const fillSw = h("button", { class: "big-swatch fill", type: "button", tip: "Fill color: the inside of shapes (Outline + Fill)", onclick: () => { target = "secondary"; refresh(); } }, h("span", null, "Fill"));
    const swapBtn = h("button", { class: "icon-btn small", type: "button", tip: "Swap the two colors", "aria-label": "Swap colors", onclick: swap }, I("loop"));

    const grid = h("div", { class: "palette-grid" }, PALETTE.map((c) => swatchBtn(c, pick)));
    const recentRow = h("div", { class: "swatch-row" });
    const favRow = h("div", { class: "swatch-row" });
    const favBtn = h("button", { class: "chip-btn", type: "button", tip: "Save this color as a favorite", onclick: () => toggleFavorite(current()) }, I("star"), h("span", null, "Favorite"));

    // Rainbow picker
    const sv = h("canvas", { class: "sv-pad", width: 220, height: 130, "aria-label": "Pick brightness and color strength" });
    const hue = h("canvas", { class: "hue-bar", width: 220, height: 18, "aria-label": "Pick a rainbow color" });
    const svKnob = h("span", { class: "picker-knob" });
    const hueKnob = h("span", { class: "picker-knob hue-knob" });
    const svWrap = h("div", { class: "sv-wrap" }, sv, svKnob);
    const hueWrap = h("div", { class: "hue-wrap" }, hue, hueKnob);
    const hex = h("input", { class: "hex-input", type: "text", maxlength: 7, spellcheck: "false", "aria-label": "Color code", tip: "Type a color code like #ff8800" });
    hex.addEventListener("change", () => { const v = GAS.normalizeHex(hex.value); if (v) { pick(v); } else hex.value = current(); });
    hex.addEventListener("keydown", (e) => { if (e.key === "Enter") hex.blur(); });

    let hsv = { h: 0, s: 1, v: 1 };
    function drawHue() {
      const c = hue.getContext("2d");
      const g = c.createLinearGradient(0, 0, hue.width, 0);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
      c.fillStyle = g;
      c.fillRect(0, 0, hue.width, hue.height);
    }
    function drawSV() {
      const c = sv.getContext("2d");
      const base = GAS.hsvToRgb(hsv.h, 1, 1);
      c.fillStyle = `rgb(${base.r},${base.g},${base.b})`;
      c.fillRect(0, 0, sv.width, sv.height);
      const g1 = c.createLinearGradient(0, 0, sv.width, 0);
      g1.addColorStop(0, "#fff"); g1.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g1; c.fillRect(0, 0, sv.width, sv.height);
      const g2 = c.createLinearGradient(0, 0, 0, sv.height);
      g2.addColorStop(0, "rgba(0,0,0,0)"); g2.addColorStop(1, "#000");
      c.fillStyle = g2; c.fillRect(0, 0, sv.width, sv.height);
    }
    function placeKnobs() {
      svKnob.style.left = hsv.s * 100 + "%";
      svKnob.style.top = (1 - hsv.v) * 100 + "%";
      svKnob.style.background = current();
      hueKnob.style.left = (hsv.h / 360) * 100 + "%";
    }
    function fromHsv(live) {
      const c = GAS.hsvToRgb(hsv.h, hsv.s, hsv.v);
      const v = GAS.rgbToHex(c.r, c.g, c.b);
      skipHsv = true;
      pick(v, live);
      skipHsv = false;
    }
    let skipHsv = false;
    function dragOn(el, fn) {
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        const move = (ev) => { const r = el.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); };
        move(e);
        const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); addRecent(current()); };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
      });
    }
    dragOn(svWrap, (x, y) => { hsv.s = x; hsv.v = 1 - y; fromHsv(true); placeKnobs(); });
    dragOn(hueWrap, (x) => { hsv.h = x * 359.9; drawSV(); fromHsv(true); placeKnobs(); });

    function pick(c, live) {
      setPrimary(c);
      if (!live) addRecent(c);
    }

    const pickerToggle = h("button", { class: "chip-btn", type: "button", tip: "Show the rainbow color picker" }, I("palette"), h("span", null, "Rainbow"));
    const pickerBox = h("div", { class: "picker-box", hidden: !GAS.prefs.get("rainbowOpen", false) }, svWrap, hueWrap);
    pickerToggle.addEventListener("click", () => { pickerBox.hidden = !pickerBox.hidden; GAS.prefs.set("rainbowOpen", !pickerBox.hidden); });

    const el = h("section", { class: "panel-section colors-section" },
      h("div", { class: "section-head" }, h("h3", null, "Colors")),
      h("div", { class: "swatch-pair" }, mainSw, swapBtn, fillSw, hex),
      grid,
      h("div", { class: "color-tools" }, pickerToggle, favBtn),
      pickerBox,
      h("div", { class: "mini-head" }, "Recently used"), recentRow,
      h("div", { class: "mini-head" }, "Favorites"), favRow);

    function refresh() {
      mainSw.style.setProperty("--c", state.primary);
      fillSw.style.setProperty("--c", state.secondary);
      mainSw.classList.toggle("is-active", target === "primary");
      fillSw.classList.toggle("is-active", target === "secondary");
      mainSw.querySelector("span").style.color = GAS.contrastText(state.primary);
      fillSw.querySelector("span").style.color = GAS.contrastText(state.secondary);
      const cur = current();
      if (document.activeElement !== hex) hex.value = cur.toUpperCase();
      grid.querySelectorAll(".swatch").forEach((b) => b.classList.toggle("is-active", b.style.getPropertyValue("--c") === cur));
      if (!skipHsv) {
        const rgb = GAS.hexToRgb(cur);
        const n = GAS.rgbToHsv(rgb.r, rgb.g, rgb.b);
        if (n.s > 0.01 && n.v > 0.01) hsv.h = n.h;
        hsv.s = n.s; hsv.v = n.v;
        drawSV();
      }
      placeKnobs();
      favBtn.classList.toggle("is-active", favorites.includes(cur));
      favBtn.querySelector(".icon").replaceWith(I(favorites.includes(cur) ? "starFill" : "star"));
    }
    function refreshLists() {
      recentRow.innerHTML = "";
      if (!recent.length) recentRow.appendChild(h("span", { class: "empty-note" }, "Colors you use show up here."));
      recent.forEach((c) => recentRow.appendChild(swatchBtn(c, pick)));
      favRow.innerHTML = "";
      favorites.forEach((c) => favRow.appendChild(swatchBtn(c, pick, " (favorite)")));
      if (!favorites.length) favRow.appendChild(h("span", { class: "empty-note" }, "Tap ★ Favorite to keep a color here."));
      refresh();
    }
    drawHue();
    refreshLists();
    GAS.bus.on("color-changed", refresh);
    GAS.bus.on("recent-colors", refreshLists);
    return el;
  }

  GAS.colors = { PALETTE, panel, setPrimary, set, swap, addRecent, toggleFavorite, get target() { return target; } };
})();
