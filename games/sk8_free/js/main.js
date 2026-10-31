/*
 * Starts everything and runs the frame loop. The canvas keeps a low internal
 * resolution and CSS scales it up, which is where the chunky pixels come from.
 */
import { AudioEngine } from "./audio.js";
import { CONFIG } from "./config.js";
import { Game } from "./game.js";
import { Input, UI } from "./ui.js";

const STORAGE_KEY = "sk8Free.v1";
const MAX_STEP = 1 / 20; // A long hitch shouldn't teleport anyone through a car.

function loadSave() {
  const defaults = { best: 0, bestMeters: 0, sound: true, music: false, pursuer: "random" };
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch (error) {
    // Blocked or corrupt storage just means starting fresh.
  }
  const save = { ...defaults, ...stored };
  save.persist = () => {
    try {
      const { persist, ...data } = save;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Scores still count this session, they just won't be remembered.
    }
  };
  return save;
}

const canvas = document.getElementById("game");
const save = loadSave();
const audio = new AudioEngine(save);
const ui = new UI(save, audio);
const input = new Input(canvas);
export const game = new Game(canvas, ui, audio, input, save);
ui.attach(game, input);

function resize() {
  const { minWidth, minHeight, maxWidth } = CONFIG.view;
  const viewWidth = window.innerWidth;
  const viewHeight = window.innerHeight;
  const scale = Math.min(viewWidth / minWidth, viewHeight / minHeight);
  const width = Math.min(maxWidth, Math.ceil(viewWidth / scale));
  const height = Math.ceil(viewHeight / scale);
  game.resize(width, height, scale);
  canvas.style.width = `${Math.round(width * scale)}px`;
  canvas.style.height = `${Math.round(height * scale)}px`;
}

window.addEventListener("resize", resize);
resize();

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(MAX_STEP, (now - lastTime) / 1000);
  lastTime = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
