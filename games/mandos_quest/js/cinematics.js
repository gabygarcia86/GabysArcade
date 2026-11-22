/*
 * Story cinematics and the animated menu scene. A shot is a scene, a cast of actors
 * and one line of narration. See the intro and outro lists in js/levels.
 */
(function (MQ) {
  const { box, oval, poly, glow, text, wrap, smooth, clamp, alpha, shade } = MQ.U;
  const { sin, cos, min, max, floor } = Math;
  const TAU = MQ.TAU;

  const GROUND_Y = 530;
  const PERSON_SCALE = 2.2;
  const CHARS_PER_SECOND = 48;
  const FADE = 0.45;

  function core(ctx, x, y, scale, t, broken) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (broken) {
      glow(ctx, 0, 0, 90 + min(1, t) * 190, "#b98cff", 0.8);
      for (let i = 0; i < 70; i++) {
        const a = i * 2.39;
        const d = 40 + t * (30 + (i % 9) * 22);
        const px = cos(a) * d;
        const py = sin(a) * d * 0.8;
        if (i % 4) glow(ctx, px, py, 12, "#dcc8ff", max(0, 1 - t * 0.12));
        else poly(ctx, [px - 10, py + 6, px + 4, py - 12, px + 12, py + 8], "#3a2f4e", "#b98cff");
      }
    } else {
      glow(ctx, 0, 0, 190, "#8f5cff", 0.5 + sin(t * 3) * 0.12);
      oval(ctx, 0, 0, 62, 62, "#1a1428", "#b98cff", 3);
      oval(ctx, 0, 0, 30, 30, "#e6d8ff");
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 112 - i * 8, 30 + i * 8, t * (0.5 + i * 0.3) + i, 0, TAU);
        ctx.strokeStyle = i % 2 ? "#8fdcff" : "#d4a93f";
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function starMap(ctx, x, y, scale, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    glow(ctx, 0, 0, 170, "#3f9fd8", 0.4);
    ctx.lineWidth = 2;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, i * 45, i * 24, 0, 0, TAU);
      ctx.strokeStyle = "rgba(143,220,255,0.5)";
      ctx.stroke();
    }
    let px = 0;
    let py = 0;
    for (let i = 0; i < 11; i++) {
      const a = i * 2.2 + t * 0.2;
      const nx = cos(a) * (30 + i * 10);
      const ny = sin(a) * (16 + i * 5);
      if (i) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = "rgba(255,212,92,0.4)";
        ctx.stroke();
      }
      const last = i === 10;
      oval(ctx, nx, ny, last ? 7 : 3.5, last ? 7 : 3.5, last ? "#ff5348" : "#ffe9b0");
      if (last) glow(ctx, nx, ny, 34, "#ff5348", 0.5 + sin(t * 5) * 0.3);
      px = nx;
      py = ny;
    }
    poly(ctx, [-30, 84, 30, 84, 14, 100, -14, 100], "#333b46", "#8fdcff");
    ctx.restore();
  }

  const BOSSES = {
    mudhorn: (t, o) => ({ time: t, gait: 0, head: o.down ? 0.45 : sin(t) * 0.1, dazed: o.down, snort: !o.down }),
    reptavian: (t) => ({ time: t, flying: true, flap: t * 7, active: true, mouth: sin(t * 2) > 0.2, gait: 0 }),
    krayt: (t) => ({ time: t, headX: 130, headY: -210 + sin(t) * 18, head: -0.1, mouth: 0.5 + sin(t * 2) * 0.4, weak: true }),
    mythosaur: (t, o) => ({ time: t, gait: 0, headX: o.bow ? 220 : 190, headY: o.bow ? -60 : -185 + sin(t) * 10, head: o.bow ? 0.45 : 0 }),
    guardian: (t, o) => ({ time: t, gait: 0, open: o.down ? 1 : 0, aim: sin(t) * 0.2, slam: 0, dazed: o.down }),
  };

  const ACTORS = {
    mando(ctx, o, t, owner) {
      const pose = owner.pose;
      MQ.Anim.human(pose, o.anim || "idle", t, t * 9, 0.6, o.action, o.k || 0, 0, 0);
      const actor = owner.mando;
      actor.look = owner.look();
      actor.pose = pose;
      actor.time = t;
      actor.flow = o.anim === "run" || o.anim === "fly" ? 0.8 : 0.12 + sin(t) * 0.08;
      actor.lift = o.anim === "fly" ? -0.2 : 0;
      actor.jetpack = !!o.jetpack;
      actor.thrust = o.anim === "fly" ? 1 : 0;
      actor.weapon = o.weapon || null;
      actor.saber = o.saber;
      MQ.CharacterArt.mando(ctx, actor);
    },
    baby(ctx, o, t) {
      MQ.CharacterArt.baby(ctx, o.mood || "idle", t, { pram: o.pram !== false, power: o.mood === "force" ? 0.6 : 0 });
    },
    gideon(ctx, o, t, owner) {
      MQ.Anim.human(owner.pose, "idle", t, 0, 0, o.action || (o.armed === "saber" ? "guard" : null));
      const actor = owner.gideon;
      actor.pose = owner.pose;
      actor.time = t;
      actor.armed = o.armed || null;
      actor.saber = MQ.DATA.saber("classic");
      MQ.CharacterArt.gideon(ctx, actor);
      if (!o.holo) return;
      ctx.fillStyle = "rgba(120,200,255,0.3)";
      for (let y = -100 + ((t * 20) % 6); y < 0; y += 6) ctx.fillRect(-30, y, 70, 1.5);
      oval(ctx, 0, 2, 34, 6, "rgba(120,200,255,0.5)");
      glow(ctx, 0, -45, 80, "#58b8ff", 0.5);
    },
    enemy(ctx, o, t, owner, index) {
      MQ.Anim.human(owner.pose, "idle", t + index, 0, 0, o.action || "rifle");
      const view = owner.enemy;
      view.art = o.art;
      view.pose = owner.pose;
      view.time = t + index;
      view.phase = t * 3 + index;
      MQ.EnemyArt.draw(ctx, view);
    },
    cell(ctx, o, t) {
      MQ.ObjectArt.containment(ctx, { x: 0, y: 0, open: 0 }, t);
    },
  };

  function drawActor(ctx, o, t, owner) {
    const x = o.x + (o.vx || 0) * t;
    if (o.a === "core") return core(ctx, x, o.y ?? 300, o.scale || 1, t, o.broken);
    if (o.a === "map") return starMap(ctx, x, o.y ?? 300, o.scale || 1, t);
    if (o.a === "planet") {
      glow(ctx, x, o.y, o.r * 1.6, o.color, 0.4);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, o.y, o.r, 0, TAU);
      ctx.fillStyle = o.color;
      ctx.fill();
      ctx.clip();
      for (let i = 0; i < 6; i++) oval(ctx, x, o.y - o.r + i * o.r * 0.38, o.r * 1.2, o.r * 0.09, shade(o.color, i % 2 ? 0.15 : -0.15), null, 0, 0.15);
      oval(ctx, x + o.r * 0.65, o.y + o.r * 0.3, o.r * 1.2, o.r * 1.2, "rgba(0,0,0,0.4)");
      ctx.restore();
      return undefined;
    }

    if (o.a === "ship") {
      ctx.save();
      ctx.translate(x, o.y + (o.thrust === 0 ? 0 : sin(t * 2) * 7));
      const s = o.scale || 1;
      ctx.scale(o.flip ? -s : s, s);
      MQ.VehicleArt.draw(ctx, o.kind, t, o.thrust ?? 1);
      ctx.restore();
      if (o.smoke) {
        for (let i = 0; i < 5; i++) {
          const k = (t * 0.4 + i / 5) % 1;
          oval(ctx, x - 90 + k * 30, o.y - 40 - k * 170, 10 + k * 30, 10 + k * 26, `rgba(40,36,40,${0.5 * (1 - k)})`);
        }
      }
      return undefined;
    }

    if (o.a === "boss") {
      const scale = o.scale || 1;
      ctx.save();
      ctx.translate(x, (o.y ?? GROUND_Y + 10) + (o.kind === "reptavian" ? sin(t * 3 + x) * 14 : 0));
      ctx.scale(o.flip ? -scale : scale, scale);
      if (o.down) ctx.rotate(0.1);
      if (o.shadow) ctx.globalAlpha = 0.5;
      if (o.kind === "krayt") {
        ctx.beginPath();
        ctx.rect(-500, -700, 1100, 704);
        ctx.clip();
      }
      MQ.BossArt[o.kind](ctx, BOSSES[o.kind](t, o));
      ctx.restore();
      return undefined;
    }

    const count = o.n || 1;
    for (let i = 0; i < count; i++) {
      const scale = o.scale || (o.a === "baby" ? 2 : o.a === "cell" ? 2 : PERSON_SCALE);
      let y = o.y ?? GROUND_Y;
      if (o.lift) y -= o.lift + sin(t * 2.5) * 14;
      if (o.a === "baby") y += sin(t * 2.4) * 7;
      ctx.save();
      ctx.translate(x + i * 130, y);
      ctx.scale(o.flip ? -scale : scale, scale);
      if (o.holo) ctx.globalAlpha = 0.72 + sin(t * 30) * 0.08;
      ACTORS[o.a](ctx, o, t, owner, i);
      ctx.restore();
    }
    return undefined;
  }

  class Stage {
    constructor(look) {
      this.look = look;
      this.pose = MQ.Anim.createPose();
      this.mando = {};
      this.gideon = {};
      this.enemy = { art: "trooper", grounded: true };
    }

    draw(ctx, shot, t, time) {
      const pan = t * 9;
      const background = MQ.Backgrounds.get(shot.scene);
      background.draw(ctx, pan * 6, 60, time);

      ctx.save();
      // A slow push in.
      const zoom = 1 + min(t, 14) * 0.004;
      ctx.translate(640, 360);
      ctx.scale(zoom, zoom);
      ctx.translate(-640, -360);
      if (shot.ground) {
        ctx.fillStyle = shot.ground;
        ctx.fillRect(-20, GROUND_Y, 1320, 220);
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(-20, GROUND_Y, 1320, 4);
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        ctx.fillRect(-20, GROUND_Y + 40, 1320, 180);
      }
      for (const actor of shot.cast) drawActor(ctx, actor, t, this);
      ctx.restore();
      background.drawFront(ctx, pan * 6, time);
    }
  }

  class CinematicPlayer {
    constructor(stage, audio, input) {
      this.stage = stage;
      this.audio = audio;
      this.input = input;
      this.shots = [];
      this.done = null;
    }

    play(shots, done, heading = "") {
      this.shots = shots;
      this.done = done;
      this.heading = heading;
      this.index = 0;
      this.time = 0;
      this.shotTime = 0;
    }

    get shot() {
      return this.shots[this.index];
    }

    // Finishes the line first, then moves to the next shot.
    next() {
      if (!this.done) return;
      const { shot } = this;
      const full = (shot.text?.length || 0) / CHARS_PER_SECOND + FADE;
      if (this.shotTime < full) {
        this.shotTime = full;
        return;
      }
      if (shot.title && this.shotTime < 1.5) return;
      this.index++;
      this.shotTime = 0;
      this.audio.sfx("click");
      if (this.index >= this.shots.length) this.finish();
      else if (this.shot.who === "Moff Gideon") this.audio.sfx("transmission");
    }

    skip() {
      if (!this.done) return;
      // The ending always stops on its title card.
      const last = this.shots.length - 1;
      if (this.shots[last].title && this.index < last) {
        this.index = last;
        this.shotTime = 0;
      } else {
        this.finish();
      }
    }

    finish() {
      const { done } = this;
      this.done = null;
      this.index = min(this.index, this.shots.length - 1);
      done();
    }

    update(dt) {
      this.time += dt;
      this.shotTime += dt;
    }

    draw(ctx) {
      if (!this.shots.length) return;
      const { shot, shotTime: t } = this;
      this.stage.draw(ctx, shot, t, this.time);

      const black = max(0, 1 - t / FADE);
      if (black) {
        ctx.fillStyle = `rgba(0,0,0,${black})`;
        ctx.fillRect(0, 0, MQ.VW, MQ.VH);
      }

      if (shot.title) {
        ctx.fillStyle = `rgba(0,0,0,${min(0.35, t * 0.2)})`;
        ctx.fillRect(0, 0, MQ.VW, MQ.VH);
        ctx.globalAlpha = smooth((t - 0.4) / 1.2);
        glow(ctx, 640, 290, 380, "#d4a93f", 0.3);
        text(ctx, shot.title, 640, 310, 94, "#ffd45c", "center", 800);
        ctx.globalAlpha = smooth((t - 1.5) / 1);
        text(ctx, shot.subtitle, 640, 372, 30, "#e6edf5", "center", 600);
        ctx.globalAlpha = 1;
        return;
      }

      ctx.fillStyle = "#020308";
      ctx.fillRect(0, 0, MQ.VW, 56);
      ctx.fillRect(0, 568, MQ.VW, 152);
      if (this.index === 0 && this.heading) text(ctx, this.heading.toUpperCase(), 48, 37, 20, "#ffd45c", "left", 800);
      for (let i = 0; i < this.shots.length; i++) box(ctx, 48 + i * 30, 692, 22, 4, 2, i <= this.index ? "#ffd45c" : "rgba(255,255,255,0.18)");

      const villain = shot.who === "Moff Gideon";
      text(ctx, shot.who.toUpperCase(), 48, 604, 19, villain ? "#ff6a5c" : shot.who === "Narrator" ? "#b8c6d6" : "#8fdcff", "left", 800);
      ctx.font = `600 27px ${MQ.FONT}`;
      const lines = wrap(ctx, shot.text, 1180);
      let visible = floor(max(0, t - FADE) * CHARS_PER_SECOND);
      for (let i = 0; i < lines.length && visible > 0; i++) {
        text(ctx, lines[i].slice(0, visible), 48, 640 + i * 31, 27, "#ffffff", "left", 600);
        visible -= lines[i].length + 1;
      }
    }
  }

  /* The animated scene behind the main menu. */
  class MenuScene {
    constructor(stage) {
      this.stage = stage;
      this.hero = { a: "mando", x: 260, y: 600, scale: 3.5, weapon: "blaster", action: "hold", jetpack: true };
      this.child = { a: "baby", x: 500, y: 452, scale: 2.1, mood: "idle" };
      this.ship = { a: "ship", kind: "gunship", x: 0, y: 130, scale: 0.55 };
    }

    draw(ctx, time, showHeroes) {
      MQ.Backgrounds.get("galaxy").draw(ctx, time * 14, 0, time);
      this.ship.x = ((time * 60) % 1700) - 220;
      drawActor(ctx, this.ship, time, this.stage);

      ctx.beginPath();
      ctx.ellipse(420, 1010, 720, 460, 0, 0, TAU);
      ctx.fillStyle = "#2b1c22";
      ctx.fill();
      ctx.strokeStyle = alpha("#ff9a5c", 0.5);
      ctx.lineWidth = 3;
      ctx.stroke();
      glow(ctx, 420, 560, 260, "#8c3f2b", 0.25);
      poly(ctx, [120, 640, 160, 600, 330, 592, 400, 634, 420, 720, 100, 720], "#3a272c", MQ.INK, 2);
      poly(ctx, [160, 600, 330, 592, 345, 606, 178, 614], "#59393a");
      if (!showHeroes) return;

      this.child.mood = clamp(sin(time * 0.6), 0, 1) > 0.8 ? "happy" : sin(time * 0.37) > 0.93 ? "force" : "idle";
      drawActor(ctx, this.hero, time, this.stage);
      drawActor(ctx, this.child, time, this.stage);
    }
  }

  MQ.Stage = Stage;
  MQ.CinematicPlayer = CinematicPlayer;
  MQ.MenuScene = MenuScene;
})(window.MQ);
