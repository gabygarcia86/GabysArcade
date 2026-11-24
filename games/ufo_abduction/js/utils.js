/*
 * Shared constants and small helpers. Everything in the game hangs off window.UFO.
 *
 * World space: the view is always 720 units tall. Its width follows the screen's shape
 * (see main.js), and the camera scrolls sideways across a world 3840 units wide.
 * The sky is above HORIZON. People and animals walk with their feet between FEET_MIN
 * (far back) and FEET_MAX (front).
 */
window.UFO = window.UFO || {};

(function (U) {
  "use strict";

  U.VH = 720;
  U.WORLD_W = 3840;
  U.HORIZON = 480;
  U.PROP_BASE = 548;
  U.FEET_MIN = 562;
  U.FEET_MAX = 690;
  U.UFO_MIN_Y = 84;
  U.UFO_MAX_Y = 455;
  U.TAU = Math.PI * 2;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (list) => list[Math.floor(Math.random() * list.length)];
  U.chance = (p) => Math.random() < p;
  U.sign = (v) => (v < 0 ? -1 : 1);

  U.approach = (value, target, delta) =>
    value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);

  // Frame-rate independent smoothing: moves `rate` of the way per second, roughly.
  U.damp = (value, target, rate, dt) => target + (value - target) * Math.exp(-rate * dt);

  U.weighted = (weights) => {
    let total = 0;
    for (const key in weights) total += Math.max(0, weights[key]);
    if (total <= 0) return null;
    let roll = Math.random() * total;
    for (const key in weights) {
      roll -= Math.max(0, weights[key]);
      if (roll <= 0) return key;
    }
    return Object.keys(weights)[0];
  };

  U.easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  U.easeInCubic = (t) => t * t * t;
  U.easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  U.easeOutBack = (t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  };

  // Things further back are drawn a little smaller.
  U.depthScale = (feetY) => 0.84 + U.clamp((feetY - U.FEET_MIN) / (U.FEET_MAX - U.FEET_MIN), 0, 1) * 0.26;

  U.formatScore = (n) => Math.round(n).toLocaleString("en-US");

  U.formatTime = (seconds) => {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  U.formatDuration = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // Deterministic random numbers, so each environment's scenery looks the same every visit.
  U.seeded = (seed) => {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  };

  U.escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Solves a lob from (x0, y0) that lands on (x1, y1) after `time` seconds under `gravity`.
  U.lob = (x0, y0, x1, y1, time, gravity) => ({
    vx: (x1 - x0) / time,
    vy: (y1 - y0 - 0.5 * gravity * time * time) / time,
  });
})(window.UFO);
