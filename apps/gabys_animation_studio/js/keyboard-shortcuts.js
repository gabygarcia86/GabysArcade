/* Keyboard shortcuts. They never fire while you're typing in a text box. */
(function () {
  "use strict";
  const GAS = window.GAS;
  const { state } = GAS;

  const TOOL_KEYS = { p: "pencil", b: "brush", e: "eraser", f: "fill", i: "eyedropper", l: "line", u: "shape", s: "select", t: "text", h: "hand" };

  function init() {
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", (e) => { if (e.code === "Space") GAS.keys.spaceHeld = false; });
  }

  function onKey(e) {
    if (GAS.isTyping(e.target)) {
      if (e.key === "Escape") {
        // Escape still closes windows; elsewhere it just leaves the text box.
        if (e.target.closest(".modal") || e.target.closest(".popover")) { if (!GAS.ui.closePopover()) GAS.ui.closeTopModal(); }
        else e.target.blur();
      }
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();

    if (e.key === "Escape") {
      if (GAS.ui.closePopover()) return;
      if (GAS.ui.closeTopModal()) return;
      if (state.playing) { GAS.anim.pause(); return; }
      if (state.float || state.selection) { GAS.selection.deselect(); return; }
      return;
    }

    // While a window is open, only allow Escape (handled above).
    if (GAS.ui.modalOpen || document.body.classList.contains("has-welcome")) return;

    const handled = () => { e.preventDefault(); e.stopPropagation(); };

    if (ctrl) {
      if (k === "z" && !e.shiftKey) { handled(); GAS.history.undo(); return; }
      if (k === "y" || (k === "z" && e.shiftKey)) { handled(); GAS.history.redo(); return; }
      if (k === "s") { handled(); GAS.projects.saveToFile(e.shiftKey); return; }
      if (k === "o") { handled(); GAS.projects.openFile(); return; }
      if (k === "c") { if (GAS.selection.copy()) handled(); return; }
      if (k === "x") { if (GAS.selection.cut()) handled(); return; }
      if (k === "v") { handled(); GAS.selection.paste(); return; }
      if (k === "a") { handled(); GAS.selection.selectAll(); return; }
      if (k === "d") { handled(); GAS.selection.duplicate(); return; }
      if (k === "e") { handled(); GAS.exporter.open(); return; }
      if (k === "=" || k === "+") { handled(); GAS.view.zoomBy(1.25); return; }
      if (k === "-") { handled(); GAS.view.zoomBy(0.8); return; }
      if (k === "0") { handled(); GAS.view.fit(); return; }
      return;
    }
    if (e.altKey) return;

    if (e.code === "Space") {
      handled();
      if (!e.repeat) GAS.anim.toggle();
      return;
    }
    if (state.playing && e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;

    switch (e.key) {
      case "ArrowLeft": handled(); if (state.playing) GAS.anim.pause(); GAS.app.goToFrame(state.cur - 1); return;
      case "ArrowRight": handled(); if (state.playing) GAS.anim.pause(); GAS.app.goToFrame(state.cur + 1); return;
      case "Delete":
      case "Backspace": if (GAS.selection.deleteSelection()) handled(); return;
      case "Enter": if (state.float) { handled(); GAS.selection.commitFloat(); } return;
      case "[": handled(); resize(-1); return;
      case "]": handled(); resize(1); return;
      case "+": case "=": handled(); GAS.view.zoomBy(1.25); return;
      case "-": handled(); GAS.view.zoomBy(0.8); return;
      case "0": handled(); GAS.view.fit(); return;
    }
    if (e.repeat) return;
    if (k === "n") { handled(); GAS.app.addFrame("blank"); return; }
    if (k === "d") { handled(); GAS.app.addFrame("copy"); return; }
    if (k === "o") { handled(); GAS.onion.toggle(); GAS.ui.toast(state.project.onion.enabled ? "Onion skin on 🧅" : "Onion skin off", { quick: true }); return; }
    if (k === "x") { handled(); GAS.colors.swap(); return; }
    if (TOOL_KEYS[k]) { handled(); GAS.tools.set(TOOL_KEYS[k]); return; }
  }

  function resize(dir) {
    const tool = state.tool === "shape" ? "shape" : state.tool;
    const s = state.tools[tool];
    if (!s || s.size == null) return;
    const step = s.size < 10 ? 1 : s.size < 40 ? 3 : 8;
    s.size = Math.max(1, Math.min(tool === "eraser" ? 200 : 100, s.size + dir * step));
    GAS.panels.render();
    GAS.view.queueOverlay();
    GAS.ui.toast("Size " + s.size + " px", { quick: true });
  }

  GAS.keys = { init, spaceHeld: false };
})();
