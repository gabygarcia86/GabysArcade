/*
 * Everything outside the canvas: keyboard and touch input, the HUD, menus,
 * dialogs, the leaderboard window and settings buttons.
 */
import { CONFIG } from "./config.js";
import { drawText, textWidth } from "./font.js";
import { NAME_MAX, cleanName, leaderboard, loadName, saveName } from "./leaderboard.js";
import { drawPursuerPortrait } from "./pursuer.js";

const $ = (id) => document.getElementById(id);
const PX_PER_M = CONFIG.world.pxPerMeter;
const DRAG_RANGE = 52; // Screen pixels of drag for full steering.

const pad = (value) => String(value).padStart(5, " ");

export class Input {
  constructor(canvas) {
    this.keys = { left: false, right: false, up: false, down: false };
    this.touchUp = false;
    this.touchDown = false;
    this.dragSteer = 0;
    this.ollieQueued = false;
    this.dragId = null;
    this.dragAnchor = 0;
    this.bindPointer(canvas);
  }

  get steer() {
    const keyboard = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    return keyboard || this.dragSteer;
  }

  get up() {
    return this.keys.up || this.touchUp;
  }

  get down() {
    return this.keys.down || this.touchDown;
  }

  takeOllie() {
    const queued = this.ollieQueued;
    this.ollieQueued = false;
    return queued;
  }

  reset() {
    Object.keys(this.keys).forEach((key) => { this.keys[key] = false; });
    this.touchUp = false;
    this.touchDown = false;
    this.dragSteer = 0;
    this.dragId = null;
    this.ollieQueued = false;
  }

  bindPointer(canvas) {
    canvas.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || this.dragId !== null) return;
      this.dragId = event.pointerId;
      this.dragAnchor = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.dragId) return;
      let offset = event.clientX - this.dragAnchor;
      // Dragging past full lock moves the anchor, so turning back is instant.
      if (Math.abs(offset) > DRAG_RANGE) {
        this.dragAnchor = event.clientX - Math.sign(offset) * DRAG_RANGE;
        offset = Math.sign(offset) * DRAG_RANGE;
      }
      this.dragSteer = offset / DRAG_RANGE;
    });
    const release = (event) => {
      if (event.pointerId !== this.dragId) return;
      this.dragId = null;
      this.dragSteer = 0;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
  }
}

const KEY_MAP = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
};

export class UI {
  constructor(save, audio) {
    this.save = save;
    this.audio = audio;
    this.game = null;
    this.input = null;
    this.touchMode = window.matchMedia("(pointer: coarse)").matches;
    this.hudText = { score: "", dist: "", speed: "", best: "", effects: "", chase: "" };
    this.elements = {
      score: $("hud-score"), dist: $("hud-dist"), speed: $("hud-speed"),
      best: $("hud-best"), effects: $("hud-effects"), chase: $("hud-chase"),
    };
    this.run = null;          // The finished run shown on the game-over window.
    this.submitting = false;
    this.board = "all";
    this.boardReturn = "menu";
    this.boardRequest = 0;    // Lets a slow response from an old tab be ignored.
    $("score-name").maxLength = NAME_MAX;
    this.drawLogo();
    this.drawPortraits();
  }

  attach(game, input) {
    this.game = game;
    this.input = input;
    this.bindKeyboard();
    this.bindButtons();
    this.bindTouchControls();
    this.syncSettings();
    this.showMenu();
  }

  /* ---------- Binding ---------- */

  bindKeyboard() {
    const { game, input } = this;
    window.addEventListener("keydown", (event) => {
      this.audio.unlock();
      if (event.target instanceof HTMLInputElement) return; // Typing a name, not playing.
      const mapped = KEY_MAP[event.code];
      const playing = game.state === "play";

      if (this.view === "board") {
        if (event.code === "Escape") this.closeBoard();
      } else if (mapped && playing) {
        input.keys[mapped] = true;
        event.preventDefault();
      } else if (event.code === "Space" && playing) {
        if (!event.repeat) input.ollieQueued = true;
        event.preventDefault();
      } else if ((event.code === "KeyP" || event.code === "Escape") && !event.repeat) {
        if ($("howto").hidden === false) this.closeHowTo();
        else game.togglePause();
      } else if (event.code === "KeyR" && !event.repeat && game.state !== "menu") {
        game.start();
      }
    });
    window.addEventListener("keyup", (event) => {
      const mapped = KEY_MAP[event.code];
      if (mapped) input.keys[mapped] = false;
    });
    window.addEventListener("blur", () => {
      input.reset();
      game.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) game.pause();
    });
  }

  bindButtons() {
    const { game } = this;
    const onClick = (id, action) => {
      $(id).addEventListener("click", () => {
        this.audio.unlock();
        this.audio.click();
        action();
      });
    };
    const start = () => game.start();
    onClick("btn-start", start);
    onClick("btn-howto", () => this.openHowTo());
    onClick("btn-howto-close", () => this.closeHowTo());
    onClick("btn-sound", () => this.toggleSound());
    onClick("btn-music", () => this.toggleMusic());
    onClick("hud-pause", () => game.togglePause());
    onClick("hud-restart", start);
    onClick("hud-sound", () => this.toggleSound());
    onClick("btn-resume", () => game.resume());
    onClick("btn-pause-restart", start);
    onClick("btn-pause-menu", () => game.toMenu());
    onClick("btn-again", start);
    onClick("btn-over-menu", () => game.toMenu());
    onClick("btn-board", () => this.openBoard("all"));
    onClick("btn-over-board", () => this.openBoard(this.run.pursuer));
    onClick("btn-board-close", () => this.closeBoard());

    document.querySelectorAll("[data-board]").forEach((button) => {
      button.addEventListener("click", () => {
        this.audio.click();
        this.loadBoard(button.dataset.board);
      });
    });

    $("score-form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitScore();
    });

    document.querySelectorAll("[data-pursuer]").forEach((button) => {
      button.addEventListener("click", () => {
        this.audio.unlock();
        this.audio.click();
        this.save.pursuer = button.dataset.pursuer;
        this.save.persist();
        this.syncSettings();
      });
    });
  }

  bindTouchControls() {
    const { input } = this;
    const hold = (id, flag) => {
      const button = $(id);
      const set = (down) => (event) => {
        event.preventDefault();
        input[flag] = down;
        button.classList.toggle("held", down);
      };
      button.addEventListener("pointerdown", set(true));
      button.addEventListener("pointerup", set(false));
      button.addEventListener("pointercancel", set(false));
      button.addEventListener("pointerleave", set(false));
    };
    hold("touch-fast", "touchUp");
    hold("touch-slow", "touchDown");

    const ollie = $("touch-ollie");
    ollie.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.audio.unlock();
      input.ollieQueued = true;
      ollie.classList.add("held");
    });
    const letGo = () => ollie.classList.remove("held");
    ollie.addEventListener("pointerup", letGo);
    ollie.addEventListener("pointercancel", letGo);
    ollie.addEventListener("pointerleave", letGo);

    // Show touch buttons as soon as someone touches, even on hybrid laptops.
    window.addEventListener("pointerdown", (event) => {
      this.audio.unlock();
      if (event.pointerType === "touch" && !this.touchMode) {
        this.touchMode = true;
        this.setView(this.view);
      }
    });
  }

  /* ---------- Settings ---------- */

  toggleSound() {
    this.audio.setSound(!this.save.sound);
    this.save.sound = this.audio.settings.sound;
    this.save.persist();
    this.syncSettings();
  }

  toggleMusic() {
    this.audio.setMusic(!this.save.music);
    this.save.music = this.audio.settings.music;
    this.save.persist();
    this.syncSettings();
  }

  syncSettings() {
    const { save } = this;
    $("btn-sound").textContent = `SOUND: ${save.sound ? "ON" : "OFF"}`;
    $("btn-music").textContent = `MUSIC: ${save.music ? "ON" : "OFF"}`;
    $("hud-sound").textContent = save.sound ? "SND" : "MUTE";
    $("hud-sound").setAttribute("aria-pressed", String(!save.sound));
    document.querySelectorAll("[data-pursuer]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.pursuer === save.pursuer));
    });
    $("menu-best").textContent = `HIGH SCORE: ${save.best}  (${save.bestMeters} M)`;
  }

  /* ---------- Views ---------- */

  setView(view) {
    this.view = view;
    const playing = view === "play";
    $("menu").hidden = view !== "menu";
    $("pause").hidden = view !== "pause";
    $("gameover").hidden = view !== "over";
    $("leaderboard").hidden = view !== "board";
    $("howto").hidden = true;
    $("hud").hidden = view === "menu" || view === "over" || view === "board";
    $("touch-controls").hidden = !(playing && this.touchMode);
    $("hud-pause").textContent = view === "pause" ? "PLAY" : "PAUSE";
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  showMenu() {
    this.syncSettings();
    this.setView("menu");
  }

  showPlaying() {
    this.setView("play");
  }

  showPause() {
    this.setView("pause");
  }

  showGameOver(result) {
    $("over-line").textContent = result.line;
    $("over-by").textContent = `Busted by ${result.name}`;
    $("over-score").textContent = result.score;
    $("over-dist").textContent = `${result.meters} M`;
    $("over-best").textContent = result.best;
    $("over-new").hidden = !result.newBest;
    this.run = result;
    $("score-form").hidden = result.score <= 0;
    $("score-name").value = loadName();
    $("score-status").textContent = "";
    this.setView("over");
  }

  /* ---------- Leaderboard ---------- */

  async submitScore() {
    const run = this.run;
    if (this.submitting || !run) return;
    const name = cleanName($("score-name").value);
    const status = $("score-status");
    if (!name) {
      status.textContent = "Enter a name first.";
      $("score-name").focus();
      return;
    }

    this.submitting = true;
    $("score-submit").disabled = true;
    status.textContent = "Sending...";
    saveName(name);

    let sent = true;
    try {
      await leaderboard.submit({ name, score: run.score, meters: run.meters, pursuer: run.pursuer });
    } catch (error) {
      sent = false;
    }
    this.submitting = false;
    $("score-submit").disabled = false;

    // They may have moved on while the score was on its way.
    if (this.run !== run) return;
    if (!sent) {
      status.textContent = "Couldn't send your score. Try again.";
      return;
    }
    $("score-form").hidden = true;
    status.textContent = "Score submitted!";
    if (this.view === "over") this.openBoard(run.pursuer, { name, score: run.score });
  }

  // `own` ({ name, score }) highlights a score that was just submitted.
  openBoard(board, own = null) {
    this.boardReturn = this.view;
    this.setView("board");
    this.loadBoard(board, own);
  }

  closeBoard() {
    this.boardRequest++;
    this.setView(this.boardReturn);
  }

  async loadBoard(board, own = null) {
    this.board = board;
    document.querySelectorAll("[data-board]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.board === board));
    });

    const list = $("board-list");
    const status = $("board-status");
    const request = ++this.boardRequest;
    list.replaceChildren();
    status.textContent = "Loading...";

    let rows = null;
    try {
      rows = await leaderboard.top(board);
    } catch (error) {
      rows = null;
    }
    if (request !== this.boardRequest) return;

    if (!rows) {
      status.textContent = "Leaderboard unavailable. Check your connection and try again.";
      return;
    }
    if (!rows.length) {
      status.textContent = "No scores yet. Be the first!";
      return;
    }

    let ownRow = null;
    rows.forEach((row, index) => {
      const item = this.boardRow(row, index + 1);
      if (own && !ownRow && row.name === own.name && row.score === own.score) ownRow = item;
      list.append(item);
    });
    ownRow?.classList.add("own");
    status.textContent = own && !ownRow ? `Your ${own.score.toLocaleString("en-US")} didn't reach the top 10` : "";
  }

  // Names come from other players, so they only ever go in as plain text.
  boardRow(row, rank) {
    const item = document.createElement("li");
    const cells = [
      ["rank", rank],
      ["name", row.name],
      ["score", row.score.toLocaleString("en-US")],
      ["meters", `${row.meters.toLocaleString("en-US")} M`],
      ["pursuer", row.pursuer === "cop" ? "COP" : "KAREN"],
    ];
    for (const [className, text] of cells) {
      const cell = document.createElement("span");
      cell.className = className;
      cell.textContent = text;
      item.append(cell);
    }
    return item;
  }

  openHowTo() {
    $("menu").hidden = true;
    $("howto").hidden = false;
  }

  closeHowTo() {
    $("howto").hidden = true;
    $("menu").hidden = false;
  }

  /* ---------- HUD ---------- */

  setHud(key, text) {
    if (this.hudText[key] === text) return;
    this.hudText[key] = text;
    this.elements[key].textContent = text;
  }

  updateHud(game) {
    const { player, pursuer } = game;
    this.setHud("score", pad(game.score));
    this.setHud("dist", pad(`${Math.floor(game.meters)}M`));
    this.setHud("speed", pad(Math.round((player.groundSpeed / PX_PER_M) * 3.6)));
    this.setHud("best", pad(Math.max(this.save.best, game.score)));

    const effects = [];
    if (player.helmet) effects.push("HELMET");
    if (player.soda > 0) effects.push(`SODA ${Math.ceil(player.soda)}`);
    if (player.rocket > 0) effects.push(`ROCKET ${Math.ceil(player.rocket)}`);
    if (player.energy > 0) effects.push(`ENERGY ${Math.ceil(player.energy)}`);
    this.setHud("effects", effects.join(" "));

    this.setHud("chase", pursuer.active ? `BEHIND YOU: ${Math.round(game.gapToPursuer() / PX_PER_M)}M` : "");
  }

  /* ---------- Canvas art for the menu ---------- */

  drawLogo() {
    const canvas = $("logo");
    const ctx = canvas.getContext("2d");
    const scale = 6;
    const text = "SK8 FREE";
    canvas.width = textWidth(text, scale) + 8;
    canvas.height = 7 * scale + 8;
    drawText(ctx, text, 4, 4, "#10105a", scale);
    drawText(ctx, text, 2, 2, "#d8282f", scale);
    drawText(ctx, "8", 2 + 12 * scale, 2, "#f2a31f", scale);
  }

  drawPortraits() {
    document.querySelectorAll("[data-portrait]").forEach((canvas) => {
      const ctx = canvas.getContext("2d");
      const type = canvas.dataset.portrait;
      if (type === "random") {
        drawText(ctx, "?", canvas.width / 2 - 10, 18, "#d8282f", 4);
      } else {
        drawPursuerPortrait(ctx, type, canvas.width, canvas.height);
      }
    });
  }
}
