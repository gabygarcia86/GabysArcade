/* Shows menu screens, routes their buttons and animates their preview canvases. */
(function (MQ) {
  const ROOT_SCREENS = new Set(["main", "pause", "complete", "levelUp", "gameOver", "finalScore"]);
  const PREVIEW_DPR_MAX = 2;
  const CONFIRM_DELAY_MS = 500;

  class UIManager {
    constructor(root, app) {
      this.root = root;
      this.app = app;
      this.stack = [];
      this.previews = [];
      this.pose = MQ.Anim.createPose();
      this.previewActor = {};
      this.turn = 1;
      this.dragX = null;
      this.boardRequest = 0;

      root.addEventListener("click", (event) => this.click(event));
      root.addEventListener("input", (event) => this.input(event));
      root.addEventListener("change", (event) => this.change(event));
      root.addEventListener("submit", (event) => this.submit(event));
      root.addEventListener("keydown", (event) => this.navigate(event));
      root.addEventListener("pointerover", (event) => {
        if (event.pointerType !== "mouse") return;
        const control = event.target.closest("button:not([disabled])");
        if (control && !control.contains(event.relatedTarget)) app.audio.sfx("hover");
      });
      root.addEventListener("pointerdown", (event) => {
        if (!event.target.matches?.('[data-preview="look"]')) return;
        this.dragX = event.clientX;
        event.target.setPointerCapture(event.pointerId);
      });
      root.addEventListener("pointermove", (event) => {
        if (this.dragX === null) return;
        const distance = event.clientX - this.dragX;
        if (Math.abs(distance) < 24) return;
        this.turn = Math.sign(distance);
        this.dragX = event.clientX;
      });
      root.addEventListener("pointerup", () => (this.dragX = null));
      root.addEventListener("pointercancel", () => (this.dragX = null));
    }

    get current() {
      return this.stack[this.stack.length - 1];
    }

    get visible() {
      return this.stack.length > 0;
    }

    // Replaces everything on screen.
    show(name, data = {}) {
      this.stack.length = 0;
      this.open(name, data);
    }

    open(name, data = {}) {
      const entry = { name, data, openedAt: performance.now() };
      if (name === "map") entry.data.selected ??= this.app.progression.nextLevel();
      if (name === "customize") entry.data.tab ??= "sets";
      this.stack.push(entry);
      this.render(true);
      if (name === "leaderboard") this.loadBoard();
    }

    hide() {
      this.stack.length = 0;
      this.previews.length = 0;
      this.root.replaceChildren();
      this.root.hidden = true;
      document.activeElement?.blur?.();
    }

    back() {
      if (this.stack.length < 2) return false;
      this.stack.pop();
      this.render(true);
      return true;
    }

    escape() {
      if (!this.current) return;
      if (!ROOT_SCREENS.has(this.current.name) && this.stack.length > 1) this.back();
    }

    render(focusFirst = false) {
      const { current, root } = this;
      if (!current) return;

      // Re-rendering keeps the focus and each scroll position.
      const active = root.contains(document.activeElement) ? document.activeElement : null;
      const focusKey = active?.dataset?.actionUi ? { ...active.dataset } : null;
      const scrolls = new Map();
      root.querySelectorAll("[data-scroll]").forEach((el) => scrolls.set(el.dataset.scroll, [el.scrollLeft, el.scrollTop]));

      root.hidden = false;
      root.dataset.screen = current.name;
      root.innerHTML = MQ.Screens[current.name](this.app, current.data);
      this.setupPreviews();

      if (!focusFirst) {
        root.querySelectorAll("[data-scroll]").forEach((el) => {
          const position = scrolls.get(el.dataset.scroll);
          if (position) [el.scrollLeft, el.scrollTop] = position;
        });
        if (!focusKey) return;
        const match = [...root.querySelectorAll("[data-action-ui]")].find((el) =>
          el.dataset.actionUi === focusKey.actionUi && el.dataset.id === focusKey.id &&
          el.dataset.slot === focusKey.slot && el.dataset.field === focusKey.field);
        match?.focus({ preventScroll: true });
        return;
      }
      const first = root.querySelector("button.primary:not([disabled]), button:not([disabled])");
      first?.focus({ preventScroll: true });
    }

    setupPreviews() {
      const dpr = Math.min(window.devicePixelRatio || 1, PREVIEW_DPR_MAX);
      this.previews = [...this.root.querySelectorAll("canvas[data-preview]")].map((canvas) => {
        const width = canvas.width;
        const height = canvas.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        return { canvas, ctx: canvas.getContext("2d"), width, height, dpr, kind: canvas.dataset.preview, id: canvas.dataset.id };
      });
    }

    draw(time) {
      const { save, customization, progression } = this.app;
      for (const p of this.previews) {
        const { ctx, width, height } = p;
        ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const saber = MQ.DATA.saber(save.saberColor);

        if (p.kind === "weapon") {
          MQ.WeaponArt.showcase(ctx, p.id, width, height, saber, time);
        } else if (p.kind === "saber") {
          ctx.save();
          ctx.translate(30, height / 2);
          ctx.scale(2.7, 2.7);
          if (!save.darksaber) ctx.globalAlpha = 0.3;
          MQ.WeaponArt.saber(ctx, saber, time, 0.3);
          ctx.restore();
        } else {
          ctx.save();
          const weapon = progression.hasWeapon(save.weapon) ? save.weapon : "blaster";
          const blade = weapon === "saber";
          const scale = blade ? 2.8 : 3.55; // Leave room for the whole Darksaber.
          ctx.translate(width / 2 - (blade ? 60 * this.turn : 0), height - 22);
          MQ.U.oval(ctx, 0, 0, 34 * scale, 5 * scale, "rgba(90,200,255,0.12)", "rgba(143,220,255,0.5)", 2);
          ctx.scale(scale * this.turn, scale);
          MQ.Anim.human(this.pose, "idle", time, 0, 0, weapon === "saber" || weapon === "blade" ? "hold" : null);
          const actor = this.previewActor;
          actor.look = customization.look;
          actor.pose = this.pose;
          actor.time = time;
          actor.flow = 0.15 + Math.sin(time) * 0.1;
          actor.jetpack = true;
          actor.weapon = weapon;
          actor.saber = saber;
          MQ.CharacterArt.mando(ctx, actor);
          ctx.restore();
        }
      }
    }

    click(event) {
      const control = event.target.closest("[data-action-ui]");
      if (!control || control.disabled) return;
      const { actionUi: action, id, slot, field } = control.dataset;
      const { app } = this;
      app.audio.sfx("click");

      switch (action) {
        case "back":
          this.back();
          break;
        case "open":
          this.open(id);
          break;
        case "selectLevel":
          this.current.data.selected = Number(id);
          this.render();
          if (window.innerWidth <= 760) this.root.querySelector(".level-card")?.scrollIntoView({ block: "end" });
          break;
        case "tab":
          this.current.data.tab = id;
          this.render();
          break;
        case "set":
          app.customization.applySet(id);
          this.render();
          break;
        case "style":
          app.customization.setStyle(this.current.data.tab, id);
          this.render();
          break;
        case "paint":
          app.customization.setPaint(id);
          this.render();
          break;
        case "color":
          app.customization.setColor(slot, id, field);
          this.render();
          break;
        case "equip":
          app.equip(id);
          this.render();
          break;
        case "saber":
          app.setSaberColor(id);
          this.render();
          break;
        case "reloadBoard":
          this.loadBoard();
          break;
        case "confirm":
          // The second tap of a double tap can land on this button as the dialog appears.
          if (performance.now() - this.current.openedAt < CONFIRM_DELAY_MS) break;
          this.current.data.run();
          break;
        default:
          app.action(action, id, this.current.data);
      }
    }

    input(event) {
      const { target } = event;
      const { app } = this;
      if (target.dataset.volume) {
        app.changeSetting(target.dataset.volume, Number(target.value) / 100);
      } else if (target.dataset.colorSlot) {
        // No re-render here, or the open color picker would close.
        app.customization.setColor(target.dataset.colorSlot, target.value, target.dataset.field);
      }
    }

    change(event) {
      const { target } = event;
      if (target.dataset.setting) {
        this.app.changeSetting(target.dataset.setting, target.type === "checkbox" ? target.checked : target.value);
      } else if (target.dataset.volume) {
        this.app.audio.sfx("pickup");
      }
    }

    async submit(event) {
      const form = event.target.closest("[data-score-form]");
      if (!form) return;
      event.preventDefault();

      const { app } = this;
      const entry = this.current;
      const fromGameOver = entry.name === "gameOver";
      const score = fromGameOver ? entry.data.entry : app.save.pendingScore;
      const status = form.querySelector(".form-status");
      const input = form.querySelector("input");
      const submit = form.querySelector('[type="submit"]');
      const name = MQ.Leaderboard.cleanName(input.value);
      if (!name) {
        status.textContent = "Enter a name first.";
        input.focus();
        return;
      }
      if (!score || entry.sending) return;

      entry.sending = true;
      submit.disabled = true;
      status.textContent = "Sending…";
      try {
        await MQ.Leaderboard.submit({ name, ...score });
        MQ.Leaderboard.saveName(name);
        if (!fromGameOver) app.clearPendingScore(score);
        entry.data.submitted = true;
        app.audio.sfx("unlock");
        // Only move on if the player hasn't already left this screen.
        if (this.current !== entry) return;
        if (entry.name === "leaderboard") {
          entry.data.mine = { name, score: score.score };
          this.render();
          this.loadBoard();
        } else {
          this.render();
          this.open("leaderboard", { mine: { name, score: score.score } });
        }
      } catch (error) {
        status.textContent = MQ.Leaderboard.explain(error);
        submit.disabled = false;
      } finally {
        entry.sending = false;
      }
    }

    async loadBoard() {
      const entry = this.current;
      if (entry?.name !== "leaderboard") return;
      const request = ++this.boardRequest;
      entry.data.board = { state: "loading" };
      this.paintBoard(entry);
      try {
        const rows = await MQ.Leaderboard.top(10);
        if (request !== this.boardRequest) return;
        entry.data.board = { state: "ready", rows, mine: entry.data.mine };
      } catch (error) {
        if (request !== this.boardRequest) return;
        entry.data.board = { state: "error", message: MQ.Leaderboard.explain(error) };
      }
      this.paintBoard(entry);
    }

    // Updates only the table, so a half-typed name isn't lost.
    paintBoard(entry) {
      if (this.current !== entry) return;
      const container = this.root.querySelector("[data-board]");
      if (container) container.innerHTML = MQ.boardBody(entry.data.board);
    }

    // Arrow keys move between controls.
    navigate(event) {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
      if (!step || event.target.matches("input, select")) return;
      const controls = [...this.root.querySelectorAll("button:not([disabled]), input:not([disabled]), select, a[href]")]
        .filter((el) => el.offsetParent !== null);
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement);
      controls[(index + step + controls.length) % controls.length].focus();
      event.preventDefault();
    }
  }

  MQ.UIManager = UIManager;
})(window.MQ);
