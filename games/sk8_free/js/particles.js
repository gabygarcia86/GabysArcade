/*
 * Fixed pools of particles and floating score text. Dead slots get reused, and
 * when a pool is full the newest effect is simply skipped.
 */
import { drawCenteredText } from "./font.js";

const MAX_PARTICLES = 160;
const MAX_FLOATERS = 14;

export class Particles {
  constructor() {
    this.particles = Array.from({ length: MAX_PARTICLES }, () => ({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, gravity: 0, life: 0, maxLife: 1, size: 2, color: "#fff",
    }));
    this.floaters = Array.from({ length: MAX_FLOATERS }, () => ({
      alive: false, x: 0, y: 0, life: 0, text: "", color: "#fff",
    }));
  }

  clear() {
    for (const p of this.particles) p.alive = false;
    for (const f of this.floaters) f.alive = false;
  }

  spawn(x, y, z, vx, vy, vz, gravity, life, size, color) {
    const p = this.particles.find((candidate) => !candidate.alive);
    if (!p) return;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.gravity = gravity;
    p.life = p.maxLife = life;
    p.size = size;
    p.color = color;
  }

  dust(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 12 + Math.random() * 42;
      const color = i % 3 === 0 ? "#e8e0c8" : i % 3 === 1 ? "#c9bd9e" : "#a89a7c";
      this.spawn(x, y, 1, Math.cos(angle) * speed, Math.sin(angle) * speed, 12 + Math.random() * 24, 30,
        0.35 + Math.random() * 0.35, 2 + (Math.random() * 3 | 0), color);
    }
  }

  splash(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 45;
      this.spawn(x, y, 1, Math.cos(angle) * speed, Math.sin(angle) * speed, 50 + Math.random() * 45, 240,
        0.45, 2, i % 2 ? "#7fb6e6" : "#c6e3fa");
    }
  }

  debris(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 70;
      this.spawn(x, y, 4, Math.cos(angle) * speed, Math.sin(angle) * speed, 70 + Math.random() * 90, 300,
        0.55, 3, color);
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.spawn(x, y, 8, Math.cos(angle) * 46, Math.sin(angle) * 46, 12, 0, 0.32, 2, i % 2 ? "#ffe45c" : "#ffffff");
    }
  }

  // A rocket-shoe flame, left behind in the world so it trails the player.
  flame(x, y) {
    this.spawn(x, y, 1, (Math.random() - 0.5) * 24, -30, 0, 0, 0.25 + Math.random() * 0.15,
      2 + (Math.random() * 2 | 0), Math.random() < 0.5 ? "#ff8a1f" : "#ffd84a");
  }

  float(x, y, text, color = "#ffffff") {
    const f = this.floaters.find((candidate) => !candidate.alive);
    if (!f) return;
    f.alive = true;
    f.x = x; f.y = y;
    f.life = 0.9;
    f.text = text;
    f.color = color;
  }

  update(dt) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vz -= p.gravity * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
    }
    for (const f of this.floaters) {
      if (!f.alive) continue;
      f.life -= dt;
      f.y += 34 * dt;
      if (f.life <= 0) f.alive = false;
    }
  }

  draw(ctx, camera) {
    for (const p of this.particles) {
      if (!p.alive) continue;
      const size = p.life / p.maxLife < 0.4 ? Math.max(1, p.size - 1) : p.size;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(camera.sx(p.x)), Math.round(camera.sy(p.y) - p.z), size, size);
    }
  }

  drawFloaters(ctx, camera, textScale) {
    for (const f of this.floaters) {
      if (!f.alive) continue;
      const x = camera.sx(f.x);
      const y = camera.sy(f.y);
      drawCenteredText(ctx, f.text, x + 1, y + 1, "#1a1a1a", textScale);
      drawCenteredText(ctx, f.text, x, y, f.color, textScale);
    }
  }
}
