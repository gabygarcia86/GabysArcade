/*
 * AnimationManager holds everything that moves for fun rather than for gameplay: pooled
 * particles and score popups, each droid's idle, and the victory dances.
 *
 * A dance is a function of time that fills in a `move` record. drawDancer applies it on
 * top of the droid's normal art, so adding a dance doesn't touch the drawing code.
 */
(function (D) {
  const { TAU } = D;
  const PARTICLES = 220;
  const POPUPS = 8;
  const CONFETTI = ["#ffd84d", "#ff5a7a", "#55e0ff", "#7dff8a", "#ffffff", "#ff9a3c"];

  const wave = (t, speed) => Math.sin(t * speed * TAU);
  const blink = (t, speed) => (Math.floor(t * speed) % 2 ? 1 : -1);

  // Beats per second of the dance track, so everyone hits the kick drum together.
  const BEAT = 164 / 60;

  const DANCES = {
    // Spins on the spot and wiggles the dome.
    r2d2(t, m) {
      m.spin = Math.cos(t * BEAT * Math.PI * 0.5);
      m.rot = wave(t, BEAT) * 0.14;
      m.dy = -Math.abs(wave(t, BEAT / 2)) * 0.2;
      m.lx = wave(t, BEAT);
    },
    // Awkward, jerky side steps and fussy arms.
    c3po(t, m) {
      m.dx = blink(t, BEAT) * 0.14;
      m.rot = blink(t, BEAT) * 0.09;
      m.limb = blink(t, BEAT * 2);
      m.moving = true;
      m.walk = (t * BEAT) % 1;
    },
    // Rolls around in circles.
    bb8(t, m) {
      const a = t * BEAT * 1.1;
      m.dx = Math.cos(a * Math.PI) * 0.55;
      m.dy = Math.sin(a * Math.PI) * 0.26;
      m.moving = true;
      m.walk = (t * 2.2) % 1;
      m.lx = -Math.sin(a * Math.PI);
    },
    // The robot, performed by an actual robot. Holds each pose for a beat.
    k2so(t, m) {
      const pose = Math.floor(t * BEAT) % 4;
      m.limb = [1, -1, 0.3, -0.3][pose];
      m.rot = [0.1, -0.1, 0, 0][pose];
      m.dy = pose % 2 ? -0.1 : 0;
      m.lx = [1, -1, -1, 1][pose];
    },
    // Total chaos.
    chopper(t, m) {
      m.rot = wave(t, 3.1) * 0.3 + wave(t, 7.3) * 0.12;
      m.dx = wave(t, 2.3) * 0.26;
      m.dy = -Math.abs(wave(t, 2.9)) * 0.36;
      m.limb = wave(t, 6);
      m.spin = wave(t, 0.9) > 0.8 ? -1 : 1;
      m.lx = wave(t, 4);
    },
    // Happy little hops with a head tilt.
    bd1(t, m) {
      const hop = Math.abs(wave(t, BEAT / 2));
      m.dy = -hop * 0.34;
      m.squash = 1 - (1 - hop) * 0.14;
      m.lx = wave(t, BEAT / 4);
      m.limb = wave(t, BEAT);
      m.rot = wave(t, BEAT / 4) * 0.12;
    },
    // Slides side to side while its head spins all the way around.
    ig11(t, m) {
      m.dx = wave(t, BEAT / 4) * 0.2;
      m.lx = (t * 1.6) % 2.5;
      m.limb = wave(t, BEAT / 2);
      m.moving = true;
      m.walk = (t * BEAT / 2) % 1;
    },
    // Waves its arms in the air, on the beat, without enthusiasm.
    b1(t, m) {
      m.limb = wave(t, BEAT);
      m.dy = -Math.abs(wave(t, BEAT)) * 0.08;
      m.rot = wave(t, BEAT / 2) * 0.06;
    },
    // Figure-eight with a tentacle shimmy.
    probe(t, m) {
      m.dx = wave(t, BEAT / 4) * 0.3;
      m.dy = wave(t, BEAT / 2) * 0.16 - 0.12;
      m.walk = (t * 2) % 1;
      m.limb = wave(t, BEAT);
      m.rot = wave(t, BEAT / 2) * 0.16;
    },
    // Spins and bobs on three legs.
    droideka(t, m) {
      m.spin = Math.cos(t * BEAT * Math.PI * 0.5);
      m.dy = wave(t, BEAT) * 0.09;
      m.moving = true;
      m.walk = (t * BEAT) % 1;
      m.limb = wave(t, BEAT);
    },
    // Big heavy stomps.
    kx(t, m) {
      m.rot = wave(t, BEAT / 2) * 0.2;
      m.dx = wave(t, BEAT / 2) * 0.12;
      m.limb = -Math.abs(wave(t, BEAT / 2));
      m.dy = -Math.abs(wave(t, BEAT)) * 0.1;
      m.moving = true;
      m.walk = (t * BEAT / 2) % 1;
    },
    // A smooth, slightly threatening shimmy.
    ig(t, m) {
      m.rot = wave(t, BEAT) * 0.13;
      m.dx = wave(t, BEAT / 2) * 0.16;
      m.limb = wave(t, BEAT);
      m.lx = wave(t, BEAT / 4);
      m.walk = (t * 1.2) % 1;
    },
  };

  const IDLES = {
    r2d2(t, p) { p.lx = wave(t, 0.3); },
    c3po(t, p) { p.limb = wave(t, 0.9) * 0.6; p.lx = wave(t, 0.23); },
    bb8(t, p) { p.lx = wave(t, 0.4); },
    k2so(t, p) { p.limb = wave(t, 0.35) * 0.2; },
    chopper(t, p) { p.lx = blink(t, 1.3) * 0.7; p.limb = wave(t, 2.4) * 0.4; },
    bd1(t, p) { p.lx = wave(t, 0.5); p.limb = wave(t, 1.5); },
    ig11(t, p) { p.lx = (t * 0.5) % 2.5; },
    b1(t, p) { p.limb = wave(t, 0.4) * 0.3; p.lx = blink(t, 0.5) * 0.5; },
    probe(t, p) { p.lx = wave(t, 0.4); p.t = (t * 0.7) % 1; },
    droideka(t, p) { p.t = t % 1; p.limb = wave(t, 0.5); },
    kx(t, p) { p.limb = wave(t, 0.3) * 0.25; },
    ig(t, p) { p.lx = t * 0.5 % 2.5; p.t = (t * 0.4) % 1; },
  };

  class AnimationManager {
    constructor() {
      this.particles = [];
      for (let i = 0; i < PARTICLES; i++) {
        this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff", gravity: 0 });
      }
      this.next = 0;
      this.popups = [];
      for (let i = 0; i < POPUPS; i++) this.popups.push({ x: 0, y: 0, life: 0, text: "", color: "#fff" });
      this.nextPopup = 0;
      this.flash = 0;
      this.flashColor = "#fff";
      this.shake = 0;
      this.pose = { t: 0, moving: false, lx: 0, ly: 0, limb: 0 };
      this.move = { dx: 0, dy: 0, rot: 0, spin: 1, squash: 1, limb: 0, lx: 0, moving: false, walk: 0 };
    }

    clear() {
      for (const p of this.particles) p.life = 0;
      for (const p of this.popups) p.life = 0;
      this.flash = 0;
      this.shake = 0;
    }

    emit(x, y, vx, vy, life, size, color, gravity) {
      const p = this.particles[this.next];
      this.next = (this.next + 1) % PARTICLES;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.max = life;
      p.size = size;
      p.color = color;
      p.gravity = gravity;
    }

    burst(x, y, color, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        const v = speed * (0.3 + Math.random() * 0.8);
        this.emit(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.3 + Math.random() * 0.5, 2 + Math.random() * 2.5, color, 0);
      }
    }

    // Rains from above the given width. Called every few frames during a celebration.
    confetti(x, width, y, count) {
      for (let i = 0; i < count; i++) {
        const color = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
        this.emit(x + Math.random() * width, y, (Math.random() - 0.5) * 50, 40 + Math.random() * 90, 1.6 + Math.random(), 3 + Math.random() * 3, color, 60);
      }
    }

    firework(x, y, scale) {
      const color = CONFETTI[Math.floor(Math.random() * CONFETTI.length)];
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU;
        const v = (scale || 140) * (0.75 + Math.random() * 0.35);
        this.emit(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.8 + Math.random() * 0.5, 2.6, color, 90);
      }
    }

    popup(x, y, text, color) {
      const p = this.popups[this.nextPopup];
      this.nextPopup = (this.nextPopup + 1) % POPUPS;
      p.x = x;
      p.y = y;
      p.text = text;
      p.color = color;
      p.life = 1.1;
    }

    flashScreen(color, amount) {
      this.flash = amount;
      this.flashColor = color;
    }

    update(dt) {
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (const p of this.popups) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.y -= dt * 26;
      }
      this.flash = Math.max(0, this.flash - dt * 1.6);
      this.shake = Math.max(0, this.shake - dt * 18);
    }

    drawParticles(c) {
      for (const p of this.particles) {
        if (p.life <= 0) continue;
        c.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
        c.fillStyle = p.color;
        c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      c.globalAlpha = 1;
    }

    drawPopups(c, fontSize) {
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `800 ${fontSize}px Oxanium, "Segoe UI", sans-serif`;
      c.lineWidth = 3;
      c.strokeStyle = "rgba(0,0,0,.85)";
      for (const p of this.popups) {
        if (p.life <= 0) continue;
        c.globalAlpha = Math.min(1, p.life * 2);
        c.strokeText(p.text, p.x, p.y);
        c.fillStyle = p.color;
        c.fillText(p.text, p.x, p.y);
      }
      c.globalAlpha = 1;
    }

    // Idle or walking droid for portraits. `size` is half its height in pixels.
    drawPortrait(c, id, x, y, size, t, walking) {
      const p = this.pose;
      p.t = walking ? (t * 1.4) % 1 : 0;
      p.moving = !!walking;
      p.lx = walking ? 1 : 0;
      p.ly = 0;
      p.limb = 0;
      if (!walking) IDLES[id](t, p);
      c.save();
      c.translate(x, y + Math.sin(t * 2) * size * 0.015);
      c.scale(size, size);
      D.Art.draw(c, id, p);
      c.restore();
    }

    // One dancer, with its feet near y + size.
    drawDancer(c, id, x, y, size, t) {
      const m = this.move;
      m.dx = 0;
      m.dy = 0;
      m.rot = 0;
      m.spin = 1;
      m.squash = 1;
      m.limb = 0;
      m.lx = 0;
      m.moving = false;
      m.walk = 0;
      DANCES[id](t, m);

      const p = this.pose;
      p.t = m.walk;
      p.moving = m.moving;
      p.lx = m.lx;
      p.ly = 0;
      p.limb = m.limb;

      c.fillStyle = "rgba(0,0,0,.35)";
      c.beginPath();
      c.ellipse(x + m.dx * size, y + size * 0.96, size * (0.72 + m.dy * 0.5), size * 0.13, 0, 0, TAU);
      c.fill();

      c.save();
      c.translate(x + m.dx * size, y + m.dy * size);
      c.rotate(m.rot);
      // A paper-thin droid looks wrong, so a spin never quite reaches edge-on.
      const spin = Math.sign(m.spin || 1) * Math.max(0.34, Math.abs(m.spin));
      c.scale(size * spin, size * m.squash);
      D.Art.draw(c, id, p);
      c.restore();
    }
  }

  D.AnimationManager = AnimationManager;
})(window.DROID);
