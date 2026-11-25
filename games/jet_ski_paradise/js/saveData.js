// Player progress in localStorage. One JSON blob for the save, plus one key per course
// for time-trial ghosts (they are larger and change rarely).
import { SKIS, DEFAULT_RIDER, ACHIEVEMENTS, UPGRADE_MAX } from './data.js';

const KEY = 'jetSkiParadise.save.v1';
const GHOST_KEY = 'jetSkiParadise.ghost.';

function defaults() {
  const custom = {};
  const upgrades = {};
  for (const ski of SKIS) {
    custom[ski.id] = { ...ski.colors, number: 7 };
    upgrades[ski.id] = { engine: 0, steering: 0, accel: 0, stability: 0, boost: 0 };
  }
  return {
    version: 1,
    coins: 500,
    totalCoins: 0,
    skis: { owned: ['paradise100'], selected: 'paradise100', custom, upgrades },
    rider: { ...DEFAULT_RIDER },
    ownedItems: [],
    unlockedCourses: ['paradise', 'coral', 'sunset'],
    cups: {}, // id -> { best: place, trophy: 'gold'|'silver'|'bronze', run: {...} }
    records: {}, // env -> { bestLap, bestRace, bestTT, medal }
    stunt: { highScore: 0, endlessBest: 0, challenges: [] },
    achievements: {},
    collect: { shells: [], places: [] },
    stats: { races: 0, wins: 0, podiums: 0, tricks: 0, bestCombo: 0, bestAir: 0, distance: 0, crashes: 0, playSeconds: 0 },
    settings: {
      quality: 'auto', music: 0.6, sfx: 0.8, fullscreen: true, tilt: false, autoThrottle: false,
      shake: true, fps: false, camera: 'near', keys: null, lastName: '',
    },
    last: { mode: 'quick', env: 'paradise', laps: 3, difficulty: 'medium', weather: 'default' },
  };
}

// Deep-merge saved data onto defaults so new fields appear after updates.
function merge(base, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;
  for (const key of Object.keys(saved)) {
    const b = base[key];
    const s = saved[key];
    if (b && typeof b === 'object' && !Array.isArray(b) && s && typeof s === 'object' && !Array.isArray(s)) {
      base[key] = merge(b, s);
    } else if (s !== undefined) {
      base[key] = s;
    }
  }
  return base;
}

export class SaveData {
  constructor() {
    this.data = defaults();
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = merge(defaults(), JSON.parse(raw));
    } catch (error) {
      this.data = defaults();
    }
    // Repair anything a hand-edited or older save might be missing.
    const d = this.data;
    if (!Array.isArray(d.skis.owned) || !d.skis.owned.length) d.skis.owned = ['paradise100'];
    if (!d.skis.owned.includes(d.skis.selected)) d.skis.selected = d.skis.owned[0];
    d.coins = Math.max(0, Math.floor(Number(d.coins) || 0));
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (error) {
      // Storage full or blocked: progress lasts until the tab closes.
    }
    for (const fn of this.listeners) fn(this.data);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaults();
    this.data.settings = settings;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(GHOST_KEY)) localStorage.removeItem(k);
      }
    } catch (error) { /* ignore */ }
    this.save();
  }

  get settings() { return this.data.settings; }
  get coins() { return this.data.coins; }

  addCoins(amount) {
    const n = Math.max(0, Math.round(amount));
    this.data.coins += n;
    this.data.totalCoins += n;
    return n;
  }

  spend(amount) {
    if (this.data.coins < amount) return false;
    this.data.coins -= amount;
    this.save();
    return true;
  }

  owns(itemKey) {
    return this.data.ownedItems.includes(itemKey);
  }

  ownItem(itemKey) {
    if (!this.owns(itemKey)) this.data.ownedItems.push(itemKey);
  }

  ownsSki(id) { return this.data.skis.owned.includes(id); }

  upgradeLevels(id) {
    return this.data.skis.upgrades[id] || { engine: 0, steering: 0, accel: 0, stability: 0, boost: 0 };
  }

  anyMaxUpgrade() {
    return Object.values(this.data.skis.upgrades).some((u) => Object.values(u).some((v) => v >= UPGRADE_MAX));
  }

  record(env) {
    if (!this.data.records[env]) this.data.records[env] = { bestLap: 0, bestRace: 0, bestTT: 0, medal: '' };
    return this.data.records[env];
  }

  // Returns the achievement definition if newly unlocked (coins are added), else null.
  unlock(id) {
    if (this.data.achievements[id]) return null;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return null;
    this.data.achievements[id] = Date.now();
    this.addCoins(def.reward);
    return def;
  }

  loadGhost(env) {
    try {
      const raw = localStorage.getItem(GHOST_KEY + env);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  saveGhost(env, ghost) {
    try {
      localStorage.setItem(GHOST_KEY + env, JSON.stringify(ghost));
    } catch (error) { /* too big or blocked: no ghost next time */ }
  }
}
