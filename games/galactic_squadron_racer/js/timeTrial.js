/**
 * Time Trial records, saved per track in localStorage: best lap, best
 * three-lap total, the ship used, and the ghost of the best lap (positions
 * every 1/30 s, replayed as a translucent ship on later attempts).
 */
import { storage } from './storage.js';

const KEY = 'records';

function load() {
  const r = storage.get(KEY, {});
  return r && typeof r === 'object' ? r : {};
}

export function getRecord(trackId) {
  return load()[trackId] || null;
}

export function getAllRecords() {
  return load();
}

/** Ghost data for a track, if a record exists. */
export function getGhost(trackId) {
  const rec = getRecord(trackId);
  const g = rec?.ghost;
  if (!g || !Array.isArray(g.frames) || g.frames.length < 30) return null;
  return g;
}

/** Saves a finished run. Returns which records were beaten. */
export function saveRun(trackId, run) {
  const all = load();
  const prev = all[trackId] || {};
  const out = { newLap: false, newTotal: false, prevLap: prev.bestLap, prevTotal: prev.bestTotal };
  const rec = { ...prev };
  if (Number.isFinite(run.bestLap) && !(run.bestLap >= (prev.bestLap ?? Infinity))) {
    rec.bestLap = run.bestLap;
    rec.lapShip = run.shipId;
    out.newLap = true;
    if (run.ghost) rec.ghost = run.ghost;
  }
  if (Number.isFinite(run.total) && !(run.total >= (prev.bestTotal ?? Infinity))) {
    rec.bestTotal = run.total;
    rec.totalShip = run.shipId;
    out.newTotal = true;
  }
  if (out.newLap || out.newTotal) {
    all[trackId] = rec;
    if (!storage.set(KEY, all) && rec.ghost) {
      // storage full: keep the times, drop the ghost
      delete rec.ghost;
      storage.set(KEY, all);
    }
  }
  return out;
}

export function clearRecords() {
  storage.remove(KEY);
}
