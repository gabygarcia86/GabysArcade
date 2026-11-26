/*
 * Touch control size and placement, and the editor for them (Options > Arrange touch
 * controls). Every element with data-layout can be dragged. Its offset from its usual
 * place is saved as a share of the screen's width and height, so it survives rotation.
 */
(function (MQ) {
  const SIZES = { normal: 1, large: 1.2, huge: 1.4 };
  const SIZE_NAMES = [["normal", "Normal"], ["large", "Large"], ["huge", "Extra large"]];
  const EDGE = 4; // CSS pixels kept between a control and the screen edge.

  // A control's box, including buttons that stick out of it (Drop, beside the arrows).
  function rectOf(element) {
    const r = element.getBoundingClientRect();
    let { left, top, right, bottom } = r;
    for (const child of element.querySelectorAll(".touch-btn")) {
      const c = child.getBoundingClientRect();
      left = Math.min(left, c.left);
      top = Math.min(top, c.top);
      right = Math.max(right, c.right);
      bottom = Math.max(bottom, c.bottom);
    }
    return { left, top, right, bottom };
  }

  class TouchLayout {
    /* settings() returns the saved settings; save(key, value) stores one. */
    constructor(app, containers, settings, save) {
      this.app = app;
      this.containers = containers; // { ground, space }
      this.settings = settings;
      this.save = save;
      this.kind = null; // "ground" or "space" while the editor is open
      this.drag = null;
      this.onClose = null;
      this.buildEditor();
      for (const container of Object.values(containers)) this.bindDrag(container);
    }

    get layout() {
      return this.settings().touchLayout;
    }

    /* ---------- Applying the layout ---------- */

    apply() {
      const scale = SIZES[this.settings().touchSize] || 1;
      const width = this.app.clientWidth;
      const height = this.app.clientHeight;
      for (const container of Object.values(this.containers)) {
        container.style.setProperty("--touch-scale", scale);
        if (container.hidden) continue;
        for (const element of container.querySelectorAll("[data-layout]")) {
          const [fx, fy] = this.layout[element.dataset.layout] || [0, 0];
          this.place(element, fx * width, fy * height);
        }
      }
    }

    // Offsets an element from its usual place, keeping it on screen.
    place(element, x, y) {
      element.style.left = "0px";
      element.style.top = "0px";
      const home = rectOf(element);
      const bounds = this.app.getBoundingClientRect();
      const fitX = Math.min(Math.max(x, bounds.left + EDGE - home.left), bounds.right - EDGE - home.right);
      const fitY = Math.min(Math.max(y, bounds.top + EDGE - home.top), bounds.bottom - EDGE - home.bottom);
      element.style.left = `${Math.round(fitX)}px`;
      element.style.top = `${Math.round(fitY)}px`;
      return [fitX, fitY];
    }

    /* ---------- The editor ---------- */

    buildEditor() {
      const editor = (this.editor = document.createElement("div"));
      editor.id = "touch-editor";
      editor.hidden = true;
      editor.innerHTML = `
        <div class="touch-editor-bar" role="dialog" aria-label="Arrange touch controls">
          <p class="touch-editor-title">Drag the controls to move them</p>
          <div class="touch-editor-row" role="group" aria-label="Size">
            ${SIZE_NAMES.map(([id, name]) => `<button type="button" class="btn small" data-size="${id}">${name}</button>`).join("")}
          </div>
          <div class="touch-editor-row">
            <button type="button" class="btn small" data-editor="switch"></button>
            <button type="button" class="btn small" data-editor="reset">Reset</button>
            <button type="button" class="btn small primary" data-editor="done">Done</button>
          </div>
        </div>`;
      // The dimmed backdrop sits under the controls, and the bar above them.
      this.backdrop = document.createElement("div");
      this.backdrop.id = "touch-editor-backdrop";
      this.backdrop.hidden = true;
      this.app.append(this.backdrop, editor);

      editor.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.size) {
          this.save("touchSize", button.dataset.size);
          this.refresh();
        } else if (button.dataset.editor === "switch") {
          this.show(this.kind === "ground" ? "space" : "ground");
        } else if (button.dataset.editor === "reset") {
          const layout = { ...this.layout };
          for (const element of this.containers[this.kind].querySelectorAll("[data-layout]")) delete layout[element.dataset.layout];
          this.save("touchLayout", layout);
          this.refresh();
        } else if (button.dataset.editor === "done") {
          this.close();
        }
      });
      window.addEventListener("keydown", (event) => {
        if (this.kind && event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.close();
        }
      }, true);
    }

    open(onClose) {
      this.onClose = onClose;
      this.show("ground");
    }

    show(kind) {
      if (this.kind) this.containers[this.kind].classList.remove("is-editing");
      this.kind = kind;
      this.editor.hidden = false;
      this.backdrop.hidden = false;
      const container = this.containers[kind];
      container.classList.add("is-editing");
      container.querySelectorAll(".is-down, .is-over, .is-behind").forEach((el) => el.classList.remove("is-down", "is-over", "is-behind"));
      this.refresh();
    }

    close() {
      if (!this.kind) return;
      this.containers[this.kind].classList.remove("is-editing");
      this.kind = null;
      this.drag = null;
      this.editor.hidden = true;
      this.backdrop.hidden = true;
      this.app.dispatchEvent(new Event("touchlayoutchange"));
      this.onClose?.();
    }

    // Re-syncs which controls show, then the buttons in the bar.
    refresh() {
      this.app.dispatchEvent(new Event("touchlayoutchange"));
      const size = this.settings().touchSize;
      for (const button of this.editor.querySelectorAll("[data-size]")) {
        button.classList.toggle("primary", button.dataset.size === size);
        button.setAttribute("aria-pressed", button.dataset.size === size);
      }
      this.editor.querySelector('[data-editor="switch"]').textContent = this.kind === "ground" ? "Space controls" : "Ground controls";
      this.placeBar();
    }

    // Puts the bar at the top, middle or bottom, wherever it covers the fewest controls.
    placeBar() {
      if (!this.kind) return;
      const controls = [...this.containers[this.kind].querySelectorAll("[data-layout]")].map(rectOf);
      let best = null;
      for (const spot of ["top", "middle", "bottom"]) {
        this.editor.dataset.spot = spot;
        const bar = this.editor.firstElementChild.getBoundingClientRect();
        let covered = 0;
        for (const r of controls) {
          const w = Math.min(bar.right, r.right) - Math.max(bar.left, r.left);
          const h = Math.min(bar.bottom, r.bottom) - Math.max(bar.top, r.top);
          if (w > 0 && h > 0) covered += w * h;
        }
        if (!best || covered < best.covered) best = { spot, covered };
        if (!covered) break;
      }
      this.editor.dataset.spot = best.spot;
    }

    bindDrag(container) {
      // Capture, so the game's own touch handling never sees a drag in the editor.
      container.addEventListener("pointerdown", (event) => {
        if (!container.classList.contains("is-editing")) return;
        event.preventDefault();
        event.stopPropagation();
        const element = event.target.closest("[data-layout]");
        if (!element || this.drag) return;
        this.drag = {
          element,
          pointer: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: parseFloat(element.style.left) || 0,
          top: parseFloat(element.style.top) || 0,
        };
        element.classList.add("is-dragging");
        try {
          container.setPointerCapture(event.pointerId);
        } catch (error) {
          // The pointer was already released.
        }
      }, true);

      container.addEventListener("pointermove", (event) => {
        const { drag } = this;
        if (!drag || event.pointerId !== drag.pointer) return;
        event.stopPropagation();
        drag.at = this.place(drag.element, drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
      }, true);

      const end = (event) => {
        const { drag } = this;
        if (!drag || event.pointerId !== drag.pointer) return;
        event.stopPropagation();
        this.drag = null;
        drag.element.classList.remove("is-dragging");
        if (!drag.at) return;
        const [x, y] = drag.at;
        const layout = { ...this.layout, [drag.element.dataset.layout]: [x / this.app.clientWidth, y / this.app.clientHeight] };
        this.save("touchLayout", layout);
        this.refresh();
      };
      container.addEventListener("pointerup", end, true);
      container.addEventListener("pointercancel", end, true);
    }
  }

  TouchLayout.SIZES = SIZES;
  TouchLayout.SIZE_NAMES = SIZE_NAMES;
  MQ.TouchLayout = TouchLayout;
})(window.MQ);
