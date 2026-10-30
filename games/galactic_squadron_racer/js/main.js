/** Entry point: loads settings, wires the modules together and starts the loop. */
import { DEFAULT_SETTINGS, DIFFICULTIES } from './config.js';
import { storage } from './storage.js';
import { ROSTER } from './shipRoster.js';
import { TRACKS } from './tracks.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';

function loadSettings() {
  const saved = storage.get('settings', {}) || {};
  const s = { ...DEFAULT_SETTINGS };
  for (const k in DEFAULT_SETTINGS) {
    if (typeof saved[k] === typeof DEFAULT_SETTINGS[k]) s[k] = saved[k];
  }
  for (const k of ['master', 'music', 'sfx']) s[k] = Math.min(1, Math.max(0, s[k]));
  s.steering = Math.min(1.4, Math.max(0.6, s.steering));
  if (!DIFFICULTIES.includes(s.difficulty)) s.difficulty = DEFAULT_SETTINGS.difficulty;
  if (!['both', 'wasd', 'arrows'].includes(s.keyboard)) s.keyboard = DEFAULT_SETTINGS.keyboard;
  if (!['stick', 'buttons'].includes(s.touchSteer)) s.touchSteer = DEFAULT_SETTINGS.touchSteer;
  if (!ROSTER.some((ship) => ship.id === s.ship)) s.ship = DEFAULT_SETTINGS.ship;
  if (!TRACKS.some((t) => t.id === s.track)) s.track = DEFAULT_SETTINGS.track;
  return s;
}

const params = new URLSearchParams(location.search);
const settings = loadSettings();
const audio = new AudioEngine(settings);
const ui = new UI(settings, audio);
const input = new Input();
const game = new Game({ canvas: ui.canvas, ui, input, audio, settings, params });

ui.bind(game);
input.attach(game, ui);
if (matchMedia('(pointer: coarse)').matches) ui.setTouchMode(true);

// Browsers only allow audio after a user gesture.
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
window.addEventListener('keydown', unlockAudio, { capture: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.onHidden();
    audio.suspend();
  } else {
    audio.resume();
    game.lastTs = 0;
  }
});

game.start();

// Testing aids: ?track=desert&mode=quick|timetrial&autostart&autopilot jumps straight into a race.
if (params.has('track')) {
  settings.track = params.get('track');
  game.flow = { mode: params.get('mode') || 'quick' };
  if (params.has('ship')) settings.ship = params.get('ship');
  game.startRace();
}
if (params.has('debug')) window.gsr = game;
