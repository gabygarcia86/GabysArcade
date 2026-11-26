/*
 * Bosses: 10 major villains, plus enhanced forms for later chapters. Each boss is a
 * telegraphed attack state machine (idle → windup → active → recover) with 3 phases
 * that unlock new attacks and speed up, its own art, and a defeat sequence.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const A = XM.Art;
  const T = XM.T;
  const L = U.lerp;

  // ---------- Toolkit ----------
  const K = {
    face(b, p) {
      b.facing = p.cx > b.cx ? 1 : -1;
    },
    walk(b, dir, spd, dt) {
      b.vx = U.approach(b.vx, dir * spd, 1400 * dt);
    },
    stop(b, dt) {
      b.vx = U.approach(b.vx, 0, 1600 * dt);
    },
    floatTo(b, tx, ty, spd, dt) {
      const dx = tx - b.cx;
      const dy = ty - b.cy;
      const d = Math.hypot(dx, dy) || 1;
      const s = Math.min(spd, d * 3);
      b.vx = U.approach(b.vx, (dx / d) * s, 900 * dt);
      b.vy = U.approach(b.vy, (dy / d) * s, 900 * dt);
    },
    hit(w, rect, dmg, b) {
      if (U.overlap(rect, w.player)) return w.player.hurt(dmg, b.cx);
      return false;
    },
    // Fire travelling along the floor; jump over it.
    shockwave(w, b, dir, opts = {}) {
      w.combat.enemyShoot({ kind: "plasma", x: b.cx + dir * (b.w / 2), y: b.floor - 12, vx: dir * (opts.speed || 420), vy: 0, r: opts.r || 13, dmg: b.dmg * (opts.mul || 0.8), life: opts.life || 1.8, color: opts.color || "#ffb03a", ghost: true, pierce: true });
    },
    aimed(w, b, kind, speed, spread, n, opts = {}) {
      const p = w.player;
      const sx = opts.x !== undefined ? opts.x : b.cx + b.facing * b.w * 0.4;
      const sy = opts.y !== undefined ? opts.y : b.y + b.h * 0.35;
      const base = Math.atan2(p.cy - sy, p.cx - sx);
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
        w.combat.enemyShoot(Object.assign({ kind, x: sx, y: sy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 8, dmg: b.dmg * 0.7, life: 2.4, color: opts.color || "#ff5a5a" }, opts.extra || {}));
      }
    },
    ring(w, b, kind, n, speed, opts = {}) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (opts.offset || 0);
        w.combat.enemyShoot(Object.assign({ kind, x: b.cx, y: b.cy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 8, dmg: b.dmg * 0.6, life: 2.6, color: opts.color || "#ff5a5a", ghost: true }, opts.extra || {}));
      }
    },
    // A red warning area that becomes dangerous after delay seconds.
    warn(w, rect, delay, dur, dmg, b, opts = {}) {
      let t = 0;
      let hit = false;
      w.addAction({
        update: (dt) => {
          t += dt;
          if (t >= delay && t < delay + dur && !hit && U.overlap(rect, w.player)) hit = w.player.hurt(dmg, rect.x + rect.w / 2) || hit;
          if (t >= delay && t - dt < delay && opts.onFire) opts.onFire();
          return t < delay + dur;
        },
        draw: (ctx) => {
          if (t < delay) {
            ctx.globalAlpha = 0.18 + 0.22 * Math.abs(Math.sin(t * 14));
            ctx.fillStyle = opts.warnColor || "#ff3030";
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = opts.warnColor || "#ff3030";
            ctx.lineWidth = 2;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
          } else if (opts.draw) opts.draw(ctx, rect, (t - delay) / dur);
          else {
            ctx.globalAlpha = 1 - (t - delay) / dur;
            ctx.fillStyle = opts.color || "#ffb03a";
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.globalAlpha = 1;
          }
        },
      });
    },
    summon(w, b, type, n, max = 4) {
      const alive = w.enemies.filter((e) => !e.dead && e.summoned).length;
      for (let i = 0; i < Math.min(n, max - alive); i++) {
        const x = U.clamp(b.cx + U.rand(-220, 220), b.arena.x0 + 60, b.arena.x1 - 60);
        const e = w.spawnEnemy(type, x, b.floor);
        e.summoned = true;
        e.aggro = true;
        XM.FX.smoke(e.cx, e.cy, 8, "#5a3a7a");
      }
    },
  };

  // ---------- Boss definitions ----------
  // Each: name, title, hp, dmg, w, h, art, flying, music, attacks {wind, rec, start, run}, choose(b,w,p), move(b,w,dt,p)
  const BOSSES = {};

  // ===== APOCALYPSE =====
  function apocalypse(enhanced) {
    return {
      id: "apocalypse",
      name: enhanced ? "APOCALYPSE" : "APOCALYPSE",
      title: enhanced ? "Nexus-Empowered Ancient" : "The Eternal Conqueror",
      hp: enhanced ? 2400 : 950,
      dmg: enhanced ? 24 : 16,
      w: 60,
      h: 122,
      art: "apocalypse",
      enhanced,
      intro: enhanced ? "Fourteen fragments. Fourteen pieces of a god. Kneel, children." : "Only the strong survive. Show me your strength, X-Men!",
      defeat: enhanced ? "This... is not... the end..." : "Impressive. We will meet again, when I am whole.",
      choose(b, w, p) {
        const d = Math.abs(p.cx - b.cx);
        const opts = ["blast"];
        if (d < 260) opts.push("punch", "punch");
        if (b.phase >= 1) opts.push("quake");
        if (enhanced) {
          opts.push("rain");
          if (b.phase >= 1) opts.push("teleport");
          if (b.phase >= 1 && !b.summonedPhase[b.phase]) return "summon";
        }
        return U.pick(opts);
      },
      move(b, w, dt, p) {
        K.face(b, p);
        const d = Math.abs(p.cx - b.cx);
        if (d > 160) K.walk(b, b.facing, 70 + b.phase * 25, dt);
        else K.stop(b, dt);
      },
      attacks: {
        punch: {
          wind: 0.7,
          rec: 0.6,
          run(b, w, dt) {
            b.reach = L(0, 210, Math.min(1, b.stateT / 0.15));
            K.hit(w, { x: b.facing > 0 ? b.cx : b.cx - b.reach - 20, y: b.y + b.h * 0.3, w: b.reach + 20, h: 40 }, b.dmg * 1.2, b);
            if (b.stateT > 0.35) {
              b.reach = 0;
              return true;
            }
          },
          start(b) {
            XM.Audio.sfx("punch");
          },
        },
        blast: {
          wind: 0.6,
          rec: 0.7,
          start(b, w) {
            K.aimed(w, b, "plasma", 380, 0.6, b.phase >= 2 ? 5 : 3, { color: "#7ab0ff" });
            XM.Audio.sfx("blast");
          },
          run: (b) => b.stateT > 0.3,
        },
        quake: {
          wind: 0.8,
          rec: 0.8,
          start(b) {
            b.vy = -650;
            b.onGround = false;
            b.airborne = true;
          },
          run(b, w) {
            if (b.stateT > 0.2 && b.onGround) {
              K.shockwave(w, b, 1, { color: "#7ab0ff" });
              K.shockwave(w, b, -1, { color: "#7ab0ff" });
              XM.FX.shake(8, 0.4);
              XM.Audio.sfx("stomp");
              b.airborne = false;
              return true;
            }
          },
        },
        rain: {
          wind: 0.6,
          rec: 0.8,
          start(b, w) {
            for (let i = 0; i < 6; i++) {
              const x = U.clamp(w.player.cx + U.rand(-300, 300), b.arena.x0 + 20, b.arena.x1 - 60);
              K.warn(w, { x: x - 25, y: b.arena.top, w: 50, h: b.floor - b.arena.top }, 0.9 + i * 0.12, 0.25, b.dmg, b, { color: "#7ab0ff" });
            }
            XM.Audio.sfx("charge");
          },
          run: (b) => b.stateT > 1.3,
        },
        teleport: {
          wind: 0.3,
          rec: 0.4,
          start(b, w) {
            XM.FX.smoke(b.cx, b.cy, 14, "#2a3a8a");
            b.x = U.clamp(w.player.cx - w.player.facing * 180 - b.w / 2, b.arena.x0 + 10, b.arena.x1 - b.w - 10);
            XM.FX.smoke(b.cx, b.cy, 14, "#2a3a8a");
            XM.Audio.sfx("teleport");
          },
          run: (b) => b.stateT > 0.2,
        },
        summon: {
          wind: 0.8,
          rec: 0.5,
          start(b, w) {
            b.summonedPhase[b.phase] = true;
            K.summon(w, b, "apocSoldier", 2);
            XM.Audio.sfx("roar");
          },
          run: (b) => b.stateT > 0.3,
        },
      },
    };
  }
  BOSSES.apocalypse = apocalypse(false);
  BOSSES.apocalypseEnhanced = apocalypse(true);

  // ===== MR. SINISTER =====
  function sinister(nexus) {
    return {
      id: "sinister",
      name: "MR. SINISTER",
      title: nexus ? "Nexus Form" : "The Geneticist",
      hp: nexus ? 2700 : 1100,
      dmg: nexus ? 24 : 15,
      w: 34,
      h: 76,
      art: "sinister",
      flying: nexus,
      nexus,
      intro: nexus ? "I have rewritten myself in Nexus light. You are obsolete." : "Such marvelous specimens. I'll take very good care of your DNA.",
      defeat: nexus ? "Fascinating... I must... take notes..." : "A setback. Merely a setback. I have copies of myself, you know.",
      choose(b, w, p) {
        const opts = ["bolts", "teleport"];
        if (b.phase >= 1) opts.push("clones");
        if (b.phase >= 2 || nexus) opts.push("rings");
        if (nexus) opts.push("sweep", "pull");
        return U.pick(opts);
      },
      move(b, w, dt, p) {
        K.face(b, p);
        if (nexus) K.floatTo(b, p.cx - b.facing * 240 + Math.sin(b.t) * 80, b.floor - 165 + Math.sin(b.t * 1.7) * 40, 200, dt);
        else {
          const d = Math.abs(p.cx - b.cx);
          if (d < 180) K.walk(b, -b.facing, 120, dt);
          else if (d > 360) K.walk(b, b.facing, 120, dt);
          else K.stop(b, dt);
        }
      },
      attacks: {
        bolts: {
          wind: 0.5,
          rec: 0.6,
          start(b) {
            b.shots = b.phase >= 1 ? 7 : 5;
          },
          run(b, w) {
            if (b.shots > 0 && b.stateT > 0.1) {
              b.stateT = 0;
              b.shots--;
              K.aimed(w, b, "laser", 520, 0, 1, { color: "#ff2040", y: b.y + 14 });
              XM.Audio.sfx("laser");
            }
            return b.shots <= 0;
          },
        },
        teleport: {
          wind: 0.4,
          rec: 0.5,
          start(b, w) {
            XM.FX.smoke(b.cx, b.cy, 12, "#5a0a2a");
            const p = w.player;
            b.x = U.clamp(p.cx - p.facing * 70 - b.w / 2, b.arena.x0 + 10, b.arena.x1 - b.w - 10);
            if (!nexus) b.y = b.floor - b.h;
            K.face(b, p);
            XM.FX.smoke(b.cx, b.cy, 12, "#5a0a2a");
            XM.Audio.sfx("teleport");
            b.slashAt = 0.35;
          },
          run(b, w) {
            if (b.stateT > b.slashAt && b.slashAt > 0) {
              b.slashAt = 0;
              K.hit(w, { x: b.facing > 0 ? b.cx : b.cx - 80, y: b.y, w: 80, h: b.h }, b.dmg * 1.1, b);
              XM.Audio.sfx("slash");
              XM.FX.burst(b.cx + b.facing * 40, b.cy, { count: 10, color: "#ff2040", speed: 200 });
            }
            return b.stateT > 0.5;
          },
        },
        clones: {
          wind: 0.6,
          rec: 0.5,
          start(b, w) {
            K.summon(w, b, "clone", nexus ? 3 : 2, nexus ? 4 : 3);
            XM.Audio.sfx("psychic");
          },
          run: (b) => b.stateT > 0.3,
        },
        rings: {
          wind: 0.7,
          rec: 0.8,
          start(b, w) {
            K.ring(w, b, "plasma", nexus ? 14 : 10, 220, { color: "#ff2040", offset: b.t });
            XM.Audio.sfx("blast");
          },
          run(b, w) {
            if (nexus && b.stateT > 0.45 && !b.ring2) {
              b.ring2 = true;
              K.ring(w, b, "plasma", 14, 260, { color: "#ff5aff", offset: b.t + 0.2 });
            }
            if (b.stateT > 0.6) {
              b.ring2 = false;
              return true;
            }
          },
        },
        sweep: {
          wind: 0.9,
          rec: 0.8,
          start(b) {
            b.sweepA = b.facing > 0 ? -0.2 : Math.PI + 0.2;
            XM.Audio.sfx("beam");
          },
          run(b, w, dt) {
            b.sweepA += dt * 1.6 * (b.facing > 0 ? 1 : -1);
            const p = w.player;
            const ang = Math.atan2(p.cy - b.cy, p.cx - b.cx);
            let d = ang - b.sweepA;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) < 0.07) p.hurt(b.dmg * 0.9, b.cx);
            return b.stateT > 1.2;
          },
        },
        pull: {
          wind: 0.5,
          rec: 0.6,
          run(b, w, dt) {
            const p = w.player;
            if (!p.dodgeT) p.x += Math.sign(b.cx - p.cx) * 160 * dt;
            if (Math.random() < 0.5) XM.FX.spawn(XM.FX.T.SPARK, p.cx + U.rand(-80, 80), p.cy + U.rand(-40, 40), Math.sign(b.cx - p.cx) * 300, 0, 0.3, 2, "#ff5aff");
            return b.stateT > 1.4;
          },
        },
      },
    };
  }
  BOSSES.sinister = sinister(false);
  BOSSES.sinisterNexus = sinister(true);

  // ===== SABRETOOTH =====
  BOSSES.sabretooth = {
    id: "sabretooth",
    name: "SABRETOOTH",
    title: "The Hunter in the Wilds",
    hp: 1300,
    dmg: 17,
    w: 40,
    h: 72,
    art: "sabretooth",
    intro: "Been trackin' you since the treeline. Time to finish the hunt.",
    defeat: "This ain't over... I'll heal. I always heal.",
    choose(b, w, p) {
      const d = Math.abs(p.cx - b.cx);
      const opts = ["lunge"];
      if (d < 200) opts.push("combo", "combo");
      if (b.phase >= 1 && b.hp < b.maxHp * 0.8) opts.push("roar");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      const d = Math.abs(p.cx - b.cx);
      if (d > 120) K.walk(b, b.facing, 150 + b.phase * 30, dt);
      else K.stop(b, dt);
    },
    attacks: {
      lunge: {
        wind: 0.45,
        rec: 0.5,
        start(b, w) {
          const dx = w.player.cx - b.cx;
          b.vx = U.clamp(dx * 1.7, -560, 560);
          b.vy = -560;
          b.onGround = false;
          b.lunges = (b.lunges || 0) + 1;
          XM.Audio.sfx("roar");
        },
        run(b, w) {
          K.hit(w, b, b.dmg * 1.2, b);
          if (b.stateT > 0.15 && b.onGround) {
            K.stop(b, 1);
            if (b.phase >= 2 && b.lunges < 2) {
              b.state = "windup";
              b.stateT = 0.15;
              return false;
            }
            b.lunges = 0;
            return true;
          }
        },
      },
      combo: {
        wind: 0.3,
        rec: 0.6,
        start(b) {
          b.hits = 3;
          b.hitT = 0;
        },
        run(b, w, dt) {
          b.hitT -= dt;
          b.vx = b.facing * 160;
          if (b.hitT <= 0 && b.hits > 0) {
            b.hitT = 0.2;
            b.hits--;
            K.hit(w, { x: b.facing > 0 ? b.cx : b.cx - 60, y: b.y, w: 60, h: b.h }, b.dmg * 0.8, b);
            XM.Audio.sfx("slash");
          }
          return b.hits <= 0 && b.hitT <= 0;
        },
      },
      roar: {
        wind: 0.4,
        rec: 0.4,
        start(b, w) {
          XM.Audio.sfx("roar");
          XM.FX.ring(b.cx, b.cy, 160, "#ffcf7a", 0.5, 8);
          XM.FX.shake(5, 0.4);
          const p = w.player;
          if (Math.abs(p.cx - b.cx) < 170) {
            p.vx = Math.sign(p.cx - b.cx) * 520;
            p.vy = -300;
            p.hurt(b.dmg * 0.5, b.cx);
          }
        },
        run(b, w, dt) {
          // Healing factor: recovers health while roaring.
          if (b.hp < b.maxHp * 0.9) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.03 * dt);
          if (Math.random() < 0.3) XM.FX.spawn(XM.FX.T.GLOW, b.cx + U.rand(-20, 20), b.cy + U.rand(-30, 30), 0, -60, 0.4, 8, "#7aff7a");
          return b.stateT > 1.0;
        },
      },
    },
  };

  // ===== JUGGERNAUT =====
  BOSSES.juggernaut = {
    id: "juggernaut",
    name: "JUGGERNAUT",
    title: "The Unstoppable",
    hp: 1700,
    dmg: 20,
    w: 66,
    h: 106,
    art: "juggernaut",
    armor: 0.55,
    intro: "Nothin' stops the Juggernaut! Not crystals, not mutants, not you!",
    defeat: "Ugh... my head's ringin'... this ain't... over...",
    hint: "Dodge his charge so he crashes into a wall, then strike while he's dazed!",
    choose(b, w, p) {
      const opts = ["charge", "charge", "stomp"];
      if (b.phase >= 1) opts.push("rocks");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      if (Math.abs(p.cx - b.cx) > 140) K.walk(b, b.facing, 80, dt);
      else K.stop(b, dt);
    },
    attacks: {
      charge: {
        wind: 0.9,
        rec: 0.3,
        start(b) {
          b.charges = (b.charges || 0) + 1;
          XM.Audio.sfx("roar");
        },
        run(b, w, dt) {
          b.vx = b.facing * (620 + b.phase * 60);
          b.charging = true;
          if (Math.random() < 0.5) XM.FX.burst(b.cx - b.facing * 30, b.floor, { count: 2, color: "#b8a68a", speed: 120, life: 0.4, type: XM.FX.T.DOT, angle: -Math.PI / 2, spread: 1.5, grav: 500 });
          if (U.overlap(b, w.player)) {
            if (w.player.hurt(b.dmg * 1.4, b.cx)) {
              w.player.vx = b.facing * 600;
              w.player.vy = -380;
            }
          }
          const atWall = b.facing > 0 ? b.x + b.w >= b.arena.x1 - 4 : b.x <= b.arena.x0 + 4;
          if (atWall || b.hitWall) {
            b.charging = false;
            b.vx = -b.facing * 120;
            XM.FX.shake(10, 0.5);
            XM.Audio.sfx("explosion");
            XM.FX.burst(b.cx + b.facing * 30, b.cy, { count: 20, color: "#a89070", speed: 300, life: 0.6, type: XM.FX.T.SHARD, grav: 700 });
            if (b.phase >= 2 && b.charges < 2) {
              b.facing = -b.facing;
              b.state = "windup";
              b.stateT = 0.4;
              return false;
            }
            b.charges = 0;
            b.daze = 2.4;
            XM.FX.text(b.cx, b.y - 20, "DAZED! ATTACK!", "#ffe14a", 18, 1.4);
            return true;
          }
          return b.stateT > 3;
        },
      },
      stomp: {
        wind: 0.7,
        rec: 0.7,
        start(b, w) {
          K.shockwave(w, b, 1, { speed: 380 });
          K.shockwave(w, b, -1, { speed: 380 });
          if (b.phase >= 2) {
            K.shockwave(w, b, 1, { speed: 260 });
            K.shockwave(w, b, -1, { speed: 260 });
          }
          XM.FX.shake(8, 0.3);
          XM.Audio.sfx("stomp");
        },
        run: (b) => b.stateT > 0.3,
      },
      rocks: {
        wind: 0.8,
        rec: 0.6,
        start(b, w) {
          const p = w.player;
          for (let i = 0; i < 3; i++) {
            const dx = p.cx - b.cx + (i - 1) * 90;
            w.combat.enemyShoot({ kind: "rock", x: b.cx, y: b.y + 10, vx: dx * 0.9, vy: -520, grav: 900, r: 14, dmg: b.dmg * 0.8, life: 3, color: "#8a6a5a" });
          }
          XM.Audio.sfx("hitHeavy");
        },
        run: (b) => b.stateT > 0.3,
      },
    },
  };

  // ===== MYSTIQUE =====
  BOSSES.mystique = {
    id: "mystique",
    name: "MYSTIQUE",
    title: "The Shapeshifter",
    hp: 1250,
    dmg: 16,
    w: 26,
    h: 62,
    art: "mystique",
    intro: "Did you really think that meeting was real? I've been every face you trusted tonight.",
    defeat: "You'll never know which face I'll wear next time...",
    hint: "Only the real Mystique takes damage. Decoys vanish when hit.",
    choose(b, w, p) {
      const d = Math.abs(p.cx - b.cx);
      const opts = ["pistol"];
      if (d < 260) opts.push("kick", "kick");
      if (b.phase >= 1 && !w.enemies.some((e) => !e.dead && e.decoy)) opts.push("decoys", "decoys");
      if (b.phase >= 1) opts.push("shift");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      const d = Math.abs(p.cx - b.cx);
      if (d > 220) K.walk(b, b.facing, 170, dt);
      else if (d < 110) K.walk(b, -b.facing, 150, dt);
      else K.stop(b, dt);
    },
    attacks: {
      kick: {
        wind: 0.35,
        rec: 0.5,
        start(b) {
          b.vx = b.facing * 520;
          b.vy = -260;
          b.onGround = false;
          XM.Audio.sfx("dodge");
        },
        run(b, w) {
          K.hit(w, b, b.dmg, b);
          return b.stateT > 0.2 && b.onGround;
        },
      },
      pistol: {
        wind: 0.45,
        rec: 0.5,
        start(b) {
          b.shots = b.phase >= 2 ? 4 : 3;
        },
        run(b, w) {
          if (b.shots > 0 && b.stateT > 0.16) {
            b.stateT = 0;
            b.shots--;
            K.aimed(w, b, "bullet", 640, 0, 1, { color: "#ffcf5a", extra: { r: 4 } });
            XM.Audio.sfx("shoot");
          }
          return b.shots <= 0;
        },
      },
      decoys: {
        wind: 0.6,
        rec: 0.4,
        start(b, w) {
          const n = b.phase >= 2 ? 4 : 3;
          b.disguise = U.pick(XM.CHARS.filter((c) => c.id !== "professorx")).id;
          XM.FX.smoke(b.cx, b.cy, 14, "#3a5ad0");
          const spots = [];
          for (let i = 0; i <= n; i++) spots.push(U.lerp(b.arena.x0 + 80, b.arena.x1 - 80, i / n));
          spots.sort(() => Math.random() - 0.5);
          b.x = spots[0] - b.w / 2;
          for (let i = 1; i <= n; i++) {
            const e = w.spawnEnemy("clone", spots[i], b.floor);
            e.decoy = true;
            e.hp = e.maxHp = 1;
            e.summoned = true;
            e.aggro = true;
            e.dmg = b.dmg * 0.6;
            e.disguiseOf = b.disguise;
            XM.FX.smoke(e.cx, e.cy, 8, "#3a5ad0");
          }
          XM.Audio.sfx("teleport");
          XM.FX.text(b.cx, b.y - 30, "Which one is real?", "#ffcf3a", 16, 1.2);
        },
        run: (b) => b.stateT > 0.3,
      },
      shift: {
        wind: 0.3,
        rec: 0.3,
        start(b, w) {
          XM.FX.smoke(b.cx, b.cy, 10, "#3a5ad0");
          b.disguise = b.disguise ? null : U.pick(XM.CHARS.filter((c) => c.id !== "professorx")).id;
          XM.Audio.sfx("teleport");
        },
        run: (b) => b.stateT > 0.2,
      },
    },
  };

  // ===== DARK PHOENIX =====
  BOSSES.darkphoenix = {
    id: "darkphoenix",
    name: "DARK PHOENIX",
    title: "Echo of the Cosmic Fire",
    hp: 1600,
    dmg: 18,
    w: 34,
    h: 66,
    art: "phoenix",
    flying: true,
    intro: "I am fire and life incarnate. This little station is a candle to me.",
    defeat: "The fire... fades... but it is never... truly gone...",
    choose(b) {
      const opts = ["feathers", "dive"];
      if (b.phase >= 1) opts.push("ring");
      if (b.phase >= 2) opts.push("wall");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      K.floatTo(b, p.cx - b.facing * 260 + Math.sin(b.t * 0.7) * 120, b.floor - 170 + Math.sin(b.t * 1.4) * 50, 220, dt);
    },
    attacks: {
      feathers: {
        wind: 0.5,
        rec: 0.6,
        start(b, w) {
          K.aimed(w, b, "feather", 460, 0.8, b.phase >= 1 ? 7 : 5, { color: "#ff7a1a", y: b.cy });
          XM.Audio.sfx("fire");
        },
        run: (b) => b.stateT > 0.3,
      },
      dive: {
        wind: 0.7,
        rec: 0.6,
        start(b, w) {
          const p = w.player;
          const a = Math.atan2(p.cy - b.cy, p.cx - b.cx);
          b.vx = Math.cos(a) * 760;
          b.vy = Math.sin(a) * 760;
          XM.Audio.sfx("fire");
        },
        run(b, w, dt) {
          K.hit(w, b, b.dmg * 1.2, b);
          XM.FX.spawn(XM.FX.T.GLOW, b.cx, b.cy, 0, 0, 0.4, 24, "#ff7a1a");
          if (b.y + b.h > b.floor - 10) b.vy = -Math.abs(b.vy) * 0.6;
          return b.stateT > 0.75;
        },
      },
      ring: {
        wind: 0.7,
        rec: 0.7,
        start(b, w) {
          K.ring(w, b, "feather", 14, 240, { color: "#ff7a1a", offset: b.t });
          XM.FX.ring(b.cx, b.cy, 80, "#ffcf4a", 0.4);
          XM.Audio.sfx("fire");
        },
        run: (b) => b.stateT > 0.4,
      },
      wall: {
        wind: 0.9,
        rec: 1.0,
        start(b, w) {
          // A wall of fire sweeps the arena with one gap to stand in.
          const dir = w.player.cx > b.cx ? 1 : -1;
          const x = dir > 0 ? b.arena.x0 + 10 : b.arena.x1 - 10;
          const gap = U.randi(0, 2);
          for (let i = 0; i < 6; i++) {
            if (i === gap * 2 || i === gap * 2 + 1) continue;
            w.combat.enemyShoot({ kind: "fire", x, y: b.floor - 20 - i * 40, vx: dir * 260, vy: 0, r: 20, dmg: b.dmg, life: 6, pierce: true, ghost: true, color: "#ff7a1a" });
          }
          XM.Audio.sfx("fire");
          XM.FX.text(b.cx, b.y - 20, "FIND THE GAP!", "#ffcf4a", 16, 1);
        },
        run: (b) => b.stateT > 0.6,
      },
    },
  };

  // ===== OMEGA RED =====
  BOSSES.omegared = {
    id: "omegared",
    name: "OMEGA RED",
    title: "The Carbonadium Reaper",
    hp: 1800,
    dmg: 19,
    w: 40,
    h: 82,
    art: "omegared",
    intro: "Your life force will keep me warm in this frozen place, little mutants.",
    defeat: "My coils... my strength... drained...",
    choose(b, w, p) {
      const d = Math.abs(p.cx - b.cx);
      const opts = ["grab"];
      if (d < 300) opts.push("whip", "whip");
      if (b.phase >= 1) opts.push("spores");
      if (b.phase >= 2 && d < 200) opts.push("spin");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      const d = Math.abs(p.cx - b.cx);
      if (d > 220) K.walk(b, b.facing, 110, dt);
      else K.stop(b, dt);
    },
    attacks: {
      whip: {
        wind: 0.55,
        rec: 0.6,
        run(b, w) {
          b.coil = L(0, 280, Math.min(1, b.stateT / 0.15));
          K.hit(w, { x: b.facing > 0 ? b.cx : b.cx - b.coil, y: b.y + b.h * 0.35 - 10, w: b.coil, h: 24 }, b.dmg, b);
          if (b.stateT > 0.4) {
            b.coil = 0;
            return true;
          }
        },
        start() {
          XM.Audio.sfx("slash");
        },
      },
      grab: {
        wind: 0.6,
        rec: 0.7,
        start(b, w) {
          K.aimed(w, b, "metal", 520, 0, 1, { extra: { r: 10, dmg: b.dmg * 0.6, slow: 2 } });
          XM.Audio.sfx("magnet");
        },
        run: (b) => b.stateT > 0.3,
      },
      spores: {
        wind: 0.6,
        rec: 0.6,
        start(b, w) {
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + U.rand(-1.2, 1.2);
            w.combat.enemyShoot({ kind: "spore", x: b.cx, y: b.y + 20, vx: Math.cos(a) * U.rand(60, 160), vy: Math.sin(a) * U.rand(60, 140), r: 12, dmg: b.dmg * 0.5, life: 5, ghost: true, homing: 0.6, color: "#9aff5a" });
          }
          XM.Audio.sfx("fire");
        },
        run: (b) => b.stateT > 0.3,
      },
      spin: {
        wind: 0.7,
        rec: 0.8,
        start() {
          XM.Audio.sfx("slash");
        },
        run(b, w) {
          b.spinA = b.stateT * 14;
          if (Math.hypot(w.player.cx - b.cx, w.player.cy - b.cy) < 150) w.player.hurt(b.dmg, b.cx);
          return b.stateT > 1.0;
        },
      },
    },
  };

  // ===== BLOB =====
  BOSSES.blob = {
    id: "blob",
    name: "BLOB",
    title: "The Immovable Warden",
    hp: 2200,
    dmg: 19,
    w: 92,
    h: 96,
    art: "blob",
    intro: "This prison's got one guard you can't get past. Me! Nothin' moves the Blob!",
    defeat: "Oof... I think I need... a nap...",
    hint: "His belly bounces back basic shots. Hit him from behind or use Specials!",
    reflects(b, proj) {
      return !proj.power && (proj.x - b.cx) * b.facing > 0 && b.state !== "recover";
    },
    choose(b) {
      const opts = ["belly", "slam"];
      if (b.phase >= 1) opts.push("roll");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      if (Math.abs(p.cx - b.cx) > 150) K.walk(b, b.facing, 70, dt);
      else K.stop(b, dt);
    },
    attacks: {
      belly: {
        wind: 0.5,
        rec: 0.6,
        start(b) {
          b.vx = b.facing * 380;
          XM.Audio.sfx("roar");
        },
        run(b, w) {
          if (b.onGround && b.stateT % 0.35 < 0.02) b.vy = -260;
          if (U.overlap(b, w.player) && w.player.hurt(b.dmg, b.cx)) {
            w.player.vx = b.facing * 520;
            w.player.vy = -300;
          }
          return b.stateT > 1.1 || b.hitWall;
        },
      },
      slam: {
        wind: 0.6,
        rec: 0.7,
        start(b, w) {
          b.vy = -820;
          b.vx = U.clamp((w.player.cx - b.cx) * 1.2, -420, 420);
          b.onGround = false;
          b.slams = (b.slams || 0) + 1;
        },
        run(b, w) {
          if (b.stateT > 0.2 && b.onGround) {
            K.shockwave(w, b, 1, { r: 16 });
            K.shockwave(w, b, -1, { r: 16 });
            XM.FX.shake(10, 0.4);
            XM.Audio.sfx("stomp");
            if (b.phase >= 2 && b.slams < 2) {
              b.state = "windup";
              b.stateT = 0.3;
              return false;
            }
            b.slams = 0;
            return true;
          }
        },
      },
      roll: {
        wind: 0.7,
        rec: 0.8,
        run(b, w) {
          b.vx = b.facing * 560;
          b.rolling = true;
          if (U.overlap(b, w.player)) w.player.hurt(b.dmg * 1.2, b.cx);
          const atWall = b.facing > 0 ? b.x + b.w >= b.arena.x1 - 4 : b.x <= b.arena.x0 + 4;
          if (atWall || b.hitWall || b.stateT > 2.5) {
            b.rolling = false;
            XM.FX.shake(6, 0.3);
            return true;
          }
        },
      },
    },
  };

  // ===== LADY DEATHSTRIKE =====
  BOSSES.deathstrike = {
    id: "deathstrike",
    name: "LADY DEATHSTRIKE",
    title: "The Cybernetic Blade",
    hp: 2000,
    dmg: 20,
    w: 28,
    h: 64,
    art: "deathstrike",
    intro: "My blades were forged for one purpose. Tonight, that purpose is you.",
    defeat: "My honor... is not... satisfied...",
    choose(b, w, p) {
      const d = Math.abs(p.cx - b.cx);
      const opts = ["dash"];
      if (d < 120) opts.push("nails", "nails");
      if (b.phase >= 1) opts.push("spine");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      const d = Math.abs(p.cx - b.cx);
      if (d > 90) K.walk(b, b.facing, 200, dt);
      else K.stop(b, dt);
    },
    attacks: {
      dash: {
        wind: 0.5,
        rec: 0.4,
        start(b, w) {
          b.dashes = (b.dashes || 0) + 1;
          b.dashTo = U.clamp(w.player.cx + b.facing * 140, b.arena.x0 + 20, b.arena.x1 - 20);
          XM.Audio.sfx("dodge");
        },
        run(b, w, dt) {
          const dir = Math.sign(b.dashTo - b.cx) || b.facing;
          b.vx = dir * 900;
          b.ghosts.push({ x: b.cx, y: b.y + b.h, f: b.facing, t: 0 });
          K.hit(w, b, b.dmg * 1.1, b);
          if (Math.abs(b.dashTo - b.cx) < 20 || b.stateT > 0.6) {
            b.vx = 0;
            K.face(b, w.player);
            if (b.phase >= 2 && b.dashes < 2) {
              b.state = "windup";
              b.stateT = 0.2;
              return false;
            }
            b.dashes = 0;
            return true;
          }
        },
      },
      nails: {
        wind: 0.3,
        rec: 0.5,
        start(b) {
          b.hits = 3;
          b.hitT = 0;
        },
        run(b, w, dt) {
          b.hitT -= dt;
          if (b.hitT <= 0 && b.hits > 0) {
            b.hitT = 0.16;
            b.hits--;
            K.hit(w, { x: b.facing > 0 ? b.cx : b.cx - 64, y: b.y, w: 64, h: b.h }, b.dmg * 0.75, b);
            XM.Audio.sfx("slash");
          }
          return b.hits <= 0 && b.hitT <= 0;
        },
      },
      spine: {
        wind: 0.4,
        rec: 0.6,
        start(b, w) {
          const p = w.player;
          const n = b.phase >= 2 ? 3 : 2;
          for (let i = 0; i < n; i++) {
            const x = p.cx + (i - (n - 1) / 2) * 90;
            K.warn(w, { x: x - 22, y: b.floor - 70, w: 44, h: 70 }, 0.7 + i * 0.1, 0.3, b.dmg, b, {
              draw: (ctx, r, k) => A.poly(ctx, [r.x + 4, r.y + r.h, r.x + r.w / 2, r.y + r.h * (1 - Math.sin(k * Math.PI)), r.x + r.w - 4, r.y + r.h], "#c9ced8", true, 2),
              onFire: () => XM.Audio.sfx("slash"),
            });
          }
        },
        run: (b) => b.stateT > 0.6,
      },
    },
  };

  // ===== MAGNETO'S ELITE GUARDIAN =====
  BOSSES.guardian = {
    id: "magneto",
    statId: "guardian",
    name: "THE LODESTONE COLOSSUS",
    title: "Magneto's Elite Guardian",
    hp: 3000,
    dmg: 24,
    w: 96,
    h: 150,
    art: "colossusGuard",
    intro: "INTRUDERS DETECTED. MAGNETIC PURGE PROTOCOL ENGAGED.",
    defeat: "SYSTEM... FAILURE... MASTER... FORGIVE...",
    choose(b) {
      const opts = ["cannons", "magfloor"];
      if (b.phase >= 1) opts.push("rockets");
      if (b.phase >= 2) opts.push("sweep");
      return U.pick(opts);
    },
    move(b, w, dt, p) {
      K.face(b, p);
      const target = U.clamp(p.cx, b.arena.x0 + 160, b.arena.x1 - 160);
      if (Math.abs(target - b.cx) > 60) K.walk(b, Math.sign(target - b.cx), 50, dt);
      else K.stop(b, dt);
    },
    attacks: {
      cannons: {
        wind: 0.6,
        rec: 0.6,
        start(b) {
          b.shots = 6;
        },
        run(b, w) {
          if (b.shots > 0 && b.stateT > 0.12) {
            b.stateT = 0;
            b.shots--;
            K.aimed(w, b, "plasma", 460, 0.3, 2, { color: "#c08aff", y: b.y + 50 });
            XM.Audio.sfx("shoot");
          }
          return b.shots <= 0;
        },
      },
      magfloor: {
        wind: 0.4,
        rec: 0.6,
        start(b, w) {
          const span = b.arena.x1 - b.arena.x0;
          const seg = span / 6;
          const safe = U.randi(0, 5);
          for (let i = 0; i < 6; i++) {
            if (i === safe) continue;
            K.warn(w, { x: b.arena.x0 + i * seg + 4, y: b.floor - 26, w: seg - 8, h: 26 }, 1.0, 0.5, b.dmg * 0.8, b, { warnColor: "#c08aff", color: "#c08aff" });
          }
          XM.Audio.sfx("magnet");
          XM.FX.text(b.cx, b.y - 20, "MAGNETIC FLOOR!", "#c08aff", 16, 1);
        },
        run: (b) => b.stateT > 1.2,
      },
      rockets: {
        wind: 0.6,
        rec: 0.8,
        start(b, w) {
          for (let i = 0; i < 7; i++) {
            const x = U.clamp(w.player.cx + U.rand(-320, 320), b.arena.x0 + 20, b.arena.x1 - 20);
            w.combat.enemyShoot({ kind: "laser", x, y: b.arena.top - 40, vx: 0, vy: 420, r: 9, dmg: b.dmg * 0.7, life: 3, delay: 0.5 + i * 0.15, color: "#ff7a1a", explode: 50 });
            K.warn(w, { x: x - 20, y: b.floor - 8, w: 40, h: 8 }, 0.5 + i * 0.15 + 0.5, 0.05, 0, b);
          }
          XM.Audio.sfx("alarm");
        },
        run: (b) => b.stateT > 1,
      },
      sweep: {
        wind: 1.0,
        rec: 0.8,
        start() {
          XM.Audio.sfx("beam");
        },
        run(b, w) {
          const k = Math.min(1, b.stateT / 1.4);
          b.beamX = b.facing > 0 ? L(b.cx, b.arena.x1, k) : L(b.cx, b.arena.x0, k);
          const r = { x: Math.min(b.cx, b.beamX), y: b.floor - 50, w: Math.abs(b.beamX - b.cx), h: 30 };
          K.hit(w, r, b.dmg, b);
          if (b.stateT > 1.4) {
            b.beamX = 0;
            return true;
          }
        },
      },
    },
  };

  // ===== MAGNETO =====
  function magneto(final) {
    return {
      id: "magneto",
      name: "MAGNETO",
      title: final ? "Master of the Mutant Nexus" : "Master of Magnetism",
      hp: final ? 4400 : 2600,
      dmg: final ? 28 : 22,
      w: 32,
      h: 70,
      art: "magneto",
      flying: true,
      final,
      phases: final ? [0.7, 0.4] : [0.66, 0.33],
      intro: final ? "The Nexus sings to me, Charles. A new world is born today, with or without your dream." : "You've come so far, X-Men. Far enough to watch the old world end.",
      defeat: final ? "Perhaps... your dream was... stronger than my fear..." : "Enough! The core will finish what I have begun.",
      choose(b) {
        const opts = ["debris", "debris"];
        if (!b.bubble && b.phase >= 0) opts.push("shield");
        opts.push("pull");
        if (b.phase >= 1) opts.push("girders");
        if (final && b.phase >= 1) opts.push("spikes");
        if (final && b.phase >= 2) opts.push("beam", "orbit");
        return U.pick(opts);
      },
      move(b, w, dt, p) {
        K.face(b, p);
        K.floatTo(b, U.clamp(p.cx - b.facing * 280 + Math.sin(b.t * 0.6) * 100, b.arena.x0 + 60, b.arena.x1 - 60), b.floor - 170 + Math.sin(b.t * 1.2) * 40, 200, dt);
      },
      attacks: {
        debris: {
          wind: 0.5,
          rec: 0.6,
          start(b) {
            b.shots = final ? 6 : 4;
          },
          run(b, w) {
            if (b.shots > 0 && b.stateT > 0.15) {
              b.stateT = 0;
              b.shots--;
              const a = U.rand(0, Math.PI * 2);
              w.combat.enemyShoot({ kind: "metal", x: b.cx + Math.cos(a) * 50, y: b.cy + Math.sin(a) * 50, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 11, dmg: b.dmg * 0.6, life: 3.5, homing: 2.4, ghost: true });
              XM.Audio.sfx("magnet");
            }
            return b.shots <= 0;
          },
        },
        shield: {
          wind: 0.4,
          rec: 0.4,
          start(b) {
            b.bubble = 220 + b.phase * 120 + (final ? 200 : 0);
            XM.Audio.sfx("magnet");
            XM.FX.text(b.cx, b.y - 30, "MAGNETIC SHIELD", "#c08aff", 16, 1.2);
          },
          run: (b) => b.stateT > 0.2,
        },
        pull: {
          wind: 0.5,
          rec: 0.5,
          run(b, w, dt) {
            const p = w.player;
            const pullPhase = b.stateT < 1.0;
            if (!p.dodgeT) p.x += Math.sign(b.cx - p.cx) * (pullPhase ? 200 : 0) * dt;
            if (pullPhase && Math.random() < 0.5) XM.FX.spawn(XM.FX.T.SPARK, p.cx + U.rand(-100, 100), p.cy + U.rand(-40, 40), Math.sign(b.cx - p.cx) * 320, 0, 0.3, 2, "#c08aff");
            if (b.stateT > 1.0 && !b.pushed) {
              b.pushed = true;
              XM.FX.ring(b.cx, b.cy, 220, "#c08aff", 0.5, 10);
              XM.Audio.sfx("magnet");
              if (Math.hypot(p.cx - b.cx, p.cy - b.cy) < 230) {
                p.hurt(b.dmg * 0.8, b.cx);
                p.vx = Math.sign(p.cx - b.cx) * 600;
              }
            }
            if (b.stateT > 1.3) {
              b.pushed = false;
              return true;
            }
          },
        },
        girders: {
          wind: 0.6,
          rec: 0.7,
          start(b, w) {
            const n = final ? 6 : 4;
            for (let i = 0; i < n; i++) {
              const x = U.clamp(w.player.cx + (i - (n - 1) / 2) * 110 + U.rand(-30, 30), b.arena.x0 + 30, b.arena.x1 - 30);
              K.warn(w, { x: x - 26, y: b.arena.top, w: 52, h: b.floor - b.arena.top }, 0.9 + i * 0.08, 0.25, b.dmg, b, {
                warnColor: "#c08aff",
                draw: (ctx, r, k) => {
                  const y = L(r.y, r.y + r.h - 30, Math.min(1, k * 3));
                  A.box(ctx, r.x + 6, y, r.w - 12, 30, "#8a919c", true, 2);
                },
                onFire: () => XM.Audio.sfx("hitHeavy"),
              });
            }
          },
          run: (b) => b.stateT > 1.2,
        },
        spikes: {
          wind: 0.5,
          rec: 0.6,
          start(b, w) {
            for (let i = 0; i < 5; i++) {
              const x = U.clamp(w.player.cx + (i - 2) * 70, b.arena.x0 + 20, b.arena.x1 - 20);
              K.warn(w, { x: x - 18, y: b.floor - 60, w: 36, h: 60 }, 0.6 + Math.abs(i - 2) * 0.12, 0.3, b.dmg, b, {
                warnColor: "#c08aff",
                draw: (ctx, r, k) => A.poly(ctx, [r.x + 2, r.y + r.h, r.x + r.w / 2, r.y + r.h * (1 - Math.sin(k * Math.PI)), r.x + r.w - 2, r.y + r.h], "#9aa3b2", true, 2),
              });
            }
          },
          run: (b) => b.stateT > 0.8,
        },
        beam: {
          wind: 1.0,
          rec: 0.8,
          start(b) {
            b.sweepA = Math.PI / 2 + (b.facing > 0 ? 0.9 : -0.9);
            XM.Audio.sfx("beam");
          },
          run(b, w, dt) {
            b.sweepA += dt * 1.3 * (b.facing > 0 ? -1 : 1);
            const p = w.player;
            const ang = Math.atan2(p.cy - b.cy, p.cx - b.cx);
            let d = ang - b.sweepA;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            if (Math.abs(d) < 0.08) p.hurt(b.dmg * 0.9, b.cx);
            if (b.stateT > 1.4) {
              b.sweepA = undefined;
              return true;
            }
          },
        },
        orbit: {
          wind: 0.6,
          rec: 0.6,
          start(b, w) {
            K.ring(w, b, "metal", 12, 200, { offset: b.t, extra: { r: 10, dmg: b.dmg * 0.6 } });
            XM.Audio.sfx("magnet");
          },
          run: (b) => b.stateT > 0.4,
        },
      },
    };
  }
  BOSSES.magneto = magneto(false);
  BOSSES.magnetoUltimate = magneto(true);

  // ---------- Boss entity ----------
  class Boss {
    constructor(world, id, arena) {
      const d = BOSSES[id];
      this.world = world;
      this.bossId = id;
      this.def = d;
      this.name = d.name;
      this.title = d.title;
      this.w = d.w;
      this.h = d.h;
      this.arena = arena;
      this.floor = arena.floor;
      this.x = arena.x1 - 180 - d.w / 2;
      this.y = d.flying ? this.floor - 220 : this.floor - d.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = -1;
      const scale = 1 + world.levelIndex * 0.02;
      this.maxHp = this.hp = Math.round(d.hp * scale);
      this.dmg = d.dmg * scale;
      this.isBoss = true;
      this.flying = !!d.flying;
      this.noGravity = this.flying;
      this.state = "intro";
      this.stateT = 0;
      this.cd = 1.2;
      this.phase = 0;
      this.t = 0;
      this.flash = 0;
      this.dead = false;
      this.deathT = 0;
      this.daze = 0;
      this.ghosts = [];
      this.summonedPhase = {};
      this.bubble = 0;
      this.reach = 0;
      this.coil = 0;
      this.stun = 0;
      this.freeze = 0;
      this.slow = 0;
      this.confuse = 0;
      this.untargetable = false;
      this.prop = false;
      this.touchCd = 0;
      this.damageDealt = 0;
      if (d.reflects) this.reflects = (proj) => d.reflects(this, proj);
    }

    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h / 2;
    }

    takeDamage(dmg, opts, srcX) {
      if (this.dead || this.state === "intro" || this.state === "phase") return null;
      let blocked = false;
      if (this.bubble > 0) {
        this.bubble -= dmg * (opts.power ? 1.5 : 1);
        this.flash = 0.06;
        XM.FX.ring(this.cx, this.cy, 50, "#c08aff", 0.2, 3);
        if (this.bubble <= 0) {
          this.bubble = 0;
          XM.FX.text(this.cx, this.y - 20, "SHIELD BROKEN!", "#ffe14a", 16, 1);
          XM.Audio.sfx("break");
          this.stun = 0.8;
        }
        return { dealt: Math.round(dmg * 0.15), killed: false, blocked: true };
      }
      if (this.def.armor && this.daze <= 0) {
        dmg *= 1 - this.def.armor;
        blocked = true;
      } else if (this.daze > 0) dmg *= 1.5;
      const dealt = Math.max(1, Math.round(dmg));
      this.hp -= dealt;
      this.flash = 0.1;
      if (opts.stun) this.stun = Math.max(this.stun, Math.min(0.4, opts.stun * 0.25));
      if (opts.freeze) this.stun = Math.max(this.stun, Math.min(0.5, opts.freeze * 0.2));
      if (opts.slow) this.slow = Math.max(this.slow, opts.slow * 0.5);
      const ratio = this.hp / this.maxHp;
      const th = this.def.phases || [0.66, 0.33];
      const target = ratio <= th[1] ? 2 : ratio <= th[0] ? 1 : 0;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        this.deathT = 0;
        this.world.onBossDown(this);
        return { dealt, killed: true, blocked };
      }
      if (target > this.phase) {
        this.phase = target;
        this.state = "phase";
        this.stateT = 0;
        this.vx = 0;
        this.reach = this.coil = 0;
        this.bubble = 0;
        XM.Audio.sfx("roar");
        XM.FX.flash("#ffffff", 0.4);
        XM.FX.shake(8, 0.5);
        XM.FX.text(this.cx, this.y - 30, `PHASE ${this.phase + 1}!`, "#ff5a3a", 22, 1.4);
      }
      return { dealt, killed: false, blocked };
    }

    update(dt, w) {
      this.t += dt;
      this.flash = Math.max(0, this.flash - dt);
      this.touchCd = Math.max(0, this.touchCd - dt);
      for (const g of this.ghosts) g.t += dt;
      this.ghosts = this.ghosts.filter((g) => g.t < 0.25);
      const p = w.player;
      if (this.dead) {
        this.deathT += dt;
        this.vx *= 0.9;
        if (!this.flying) XM.Physics.move(this, dt, w.level, null, w.gravityScale);
        else this.vy = 40;
        if (this.flying) this.y += this.vy * dt;
        if (Math.random() < 0.35 && this.deathT < 2.2) {
          XM.FX.burst(this.cx + U.rand(-this.w / 2, this.w / 2), this.cy + U.rand(-this.h / 2, this.h / 2), { count: 12, colors: ["#ffb03a", "#ffffff", "#ff5a3a"], speed: 260, life: 0.5 });
          XM.Audio.sfx("explosion");
        }
        return;
      }
      if (this.state === "intro") {
        this.stateT += dt;
        if (this.flying) this.vy = Math.sin(this.t * 2) * 20;
        if (this.stateT > 2.2) {
          this.state = "idle";
          this.stateT = 0;
        }
        this.moveBody(dt, w);
        return;
      }
      if (this.state === "phase") {
        this.stateT += dt;
        if (this.stateT > 1.0) {
          this.state = "idle";
          this.stateT = 0;
          this.cd = 0.4;
        }
        this.moveBody(dt, w);
        return;
      }
      if (this.daze > 0) {
        this.daze -= dt;
        this.vx = U.approach(this.vx, 0, 900 * dt);
        this.moveBody(dt, w);
        return;
      }
      if (this.stun > 0) {
        this.stun -= dt;
        this.vx = U.approach(this.vx, 0, 900 * dt);
        if (this.flying) this.vy = U.approach(this.vy, 0, 600 * dt);
        this.moveBody(dt, w);
        return;
      }
      if (p.dead || p.victory) {
        this.vx = U.approach(this.vx, 0, 900 * dt);
        this.moveBody(dt, w);
        return;
      }
      const speed = 1 + this.phase * 0.15 + (this.slow > 0 ? -0.3 : 0);
      this.slow = Math.max(0, this.slow - dt);
      const d = this.def;
      this.stateT += dt * speed;
      if (this.state === "idle") {
        d.move(this, w, dt, p);
        this.cd -= dt * speed;
        if (this.cd <= 0) {
          this.atk = d.choose(this, w, p);
          this.state = "windup";
          this.stateT = 0;
          K.face(this, p);
          if (!this.flying && this.atk !== "charge" && this.atk !== "belly" && this.atk !== "roll" && this.atk !== "dash") this.vx = 0;
        }
      } else if (this.state === "windup") {
        if (!this.flying) K.stop(this, dt);
        else {
          this.vx *= 0.95;
          this.vy *= 0.95;
        }
        const a = d.attacks[this.atk];
        if (this.stateT >= a.wind) {
          this.state = "active";
          this.stateT = 0;
          if (a.start) a.start(this, w, p);
        }
      } else if (this.state === "active") {
        const a = d.attacks[this.atk];
        if (a.run(this, w, dt, p)) {
          this.state = "recover";
          this.stateT = 0;
        }
      } else if (this.state === "recover") {
        if (!this.flying) K.stop(this, dt);
        // Flying bosses swoop low after attacking: the window for close-range heroes.
        else K.floatTo(this, this.cx, this.floor - this.h - 24, 240, dt);
        const a = d.attacks[this.atk];
        if (this.stateT >= (a.rec || 0.6) * (this.flying ? 1.6 : 1)) {
          this.state = "idle";
          this.stateT = 0;
          this.cd = [1.1, 0.85, 0.6][this.phase] * (d.flying ? 0.9 : 1);
        }
      }
      this.moveBody(dt, w);
      if (this.touchCd <= 0 && U.overlap(this, p) && this.state !== "active") {
        if (p.hurt(this.dmg * 0.5, this.cx)) this.touchCd = 0.8;
      }
    }

    moveBody(dt, w) {
      if (this.flying) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.y = U.clamp(this.y, this.arena.top + 10, this.floor - this.h);
      } else XM.Physics.move(this, dt, w.level, null, w.gravityScale);
      if (this.x < this.arena.x0) {
        this.x = this.arena.x0;
        this.hitWall = -1;
      }
      if (this.x + this.w > this.arena.x1) {
        this.x = this.arena.x1 - this.w;
        this.hitWall = 1;
      }
    }

    draw(ctx, w) {
      const fade = this.dead ? Math.max(0, 1 - Math.max(0, this.deathT - 1.8) / 0.8) : 1;
      if (fade <= 0) return;
      ctx.globalAlpha = fade;
      if (!this.flying) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(this.cx, this.floor, this.w * 0.7, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const g of this.ghosts) {
        ctx.globalAlpha = (1 - g.t / 0.25) * 0.4 * fade;
        BOSS_ART[this.def.art](ctx, Object.assign(Object.create(this), { x: g.x - this.w / 2, y: g.y - this.h, ghost: true }), w);
      }
      ctx.globalAlpha = fade;
      if (this.state === "windup") A.glow(ctx, this.cx, this.cy, Math.max(this.w, this.h) * 0.9, "#ff4a3a", 0.25 + 0.2 * Math.sin(this.t * 30));
      BOSS_ART[this.def.art](ctx, this, w);
      if (this.flash > 0) A.glow(ctx, this.cx, this.cy, Math.max(this.w, this.h) * 0.75, "#ffffff", this.flash * 7);
      if (this.bubble > 0) {
        ctx.strokeStyle = "#c08aff";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.6 + 0.2 * Math.sin(this.t * 8);
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, Math.max(this.w, this.h) * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(192,138,255,0.15)";
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (this.daze > 0 || this.stun > 0.2) {
        for (let i = 0; i < 4; i++) {
          const a = this.t * 5 + (i * Math.PI) / 2;
          A.text(ctx, "★", this.cx + Math.cos(a) * 26, this.y - 10 + Math.sin(a) * 6, 12, "#ffe14a", "center", false);
        }
      }
      if (this.state === "intro" || this.state === "phase") A.glow(ctx, this.cx, this.cy, this.h, "#ffffff", 0.15 + 0.1 * Math.sin(this.t * 10));
      ctx.globalAlpha = 1;
    }
  }

  // ---------- Boss art ----------
  function legs(ctx, b, x1, x2, top, w, col, colB) {
    const sw = Math.abs(b.vx) > 10 && b.onGround ? Math.sin(b.t * 7) : 0;
    A.limb(ctx, x1, top, x1 - sw * 8, -4, w, colB);
    A.limb(ctx, x2, top, x2 + sw * 8, -4, w, col);
    return sw;
  }

  const BOSS_ART = {
    apocalypse(ctx, b) {
      const e = b.def.enhanced;
      const s = (b.h / 122) * (b.phase >= 2 ? 1.1 : 1);
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing * s, s);
      const armor = e ? "#1a2a6a" : "#2a3a7a";
      const accent = e ? "#ffd04a" : "#8a3ab0";
      if (e) A.glow(ctx, 0, -70, 90, "#7ab0ff", 0.35);
      legs(ctx, b, -12, 12, -50, 16, armor, A.shade(armor, -0.3));
      A.box(ctx, -26, -14, 24, 14, "#3a3a48", true, 3);
      A.box(ctx, 4, -14, 24, 14, "#3a3a48", true, 3);
      A.limb(ctx, -22, -100, -32, -60, 14, A.shade(armor, -0.3));
      A.poly(ctx, [-26, -50, 26, -50, 32, -104, -30, -104], armor, true, 3);
      A.poly(ctx, [-20, -60, 20, -60, 24, -96, -22, -96], "#5a5a6a", true, 2);
      // Cables
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-24, -98);
      ctx.quadraticCurveTo(-40, -80, -30, -56);
      ctx.moveTo(24, -98);
      ctx.quadraticCurveTo(38, -84, 28, -60);
      ctx.stroke();
      A.circle(ctx, 0, -80, 7, accent, true, 2);
      // Head: grey face with blue lips and a tall crest
      A.ellipse(ctx, 6, -112, 12, 14, 0, "#8a8c96", true, 2.5);
      A.poly(ctx, [-8, -108, -4, -134, 14, -130, 20, -118, 14, -110], armor, true, 2);
      A.poly(ctx, [-4, -130, -14, -150, 4, -134], accent, true, 1.5);
      ctx.fillStyle = "#2a3a8a";
      ctx.fillRect(10, -104, 9, 3);
      A.glow(ctx, 13, -116, 6, "#ff3a3a", 0.9);
      // Punching arm stretches out
      const r = b.reach || 0;
      A.limb(ctx, 20, -96, 34 + r * 0.9, -80, 15, armor);
      A.circle(ctx, 40 + r * 0.9, -80, 11, "#6a6a7a", true, 2.5);
      if (b.state === "windup" && b.atk === "blast") A.glow(ctx, 40, -80, 26, "#7ab0ff", 0.9);
      ctx.restore();
    },

    sinister(ctx, b) {
      const n = b.def.nexus;
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      if (n) A.glow(ctx, 0, -40, 70, "#ff5aff", 0.45 + 0.15 * Math.sin(b.t * 4));
      const fl = Math.sin(b.t * 3) * 4;
      // Cape with ribbon tails
      A.poly(ctx, [-6, -66, -20 + fl, -30, -24 + fl, 0, -6, -10], n ? "#3a0a3a" : "#1a1a22", true, 2);
      ctx.strokeStyle = "#c4161c";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -50);
      ctx.quadraticCurveTo(-28 + fl, -30, -34 + fl, -6);
      ctx.stroke();
      if (!n) legs(ctx, b, -4, 5, -34, 7, "#1a1a22", "#0e0e14");
      else {
        ctx.fillStyle = "#1a1a22";
        A.poly(ctx, [-8, -34, 8, -34, 4, -6, -4, -2], "#1a1a22", true, 2);
      }
      A.poly(ctx, [-10, -34, 10, -34, 12, -62, -11, -62], "#1a1a22", true, 2);
      A.poly(ctx, [-4, -60, 6, -60, 1, -46], "#c4161c", true, 1);
      // Collar spikes
      A.poly(ctx, [-12, -62, -16, -74, -6, -64], "#c4161c", true, 1.5);
      A.poly(ctx, [12, -62, 16, -74, 6, -64], "#c4161c", true, 1.5);
      // Pale face, red diamond
      A.ellipse(ctx, 2, -70, 8, 9, 0, n ? "#f0d8f0" : "#e8e8ee", true, 2);
      A.poly(ctx, [-6, -73, -2, -82, 9, -80, 8, -72], "#1a1a22", true, 1);
      A.poly(ctx, [2, -78, 4, -75, 2, -72, 0, -75], "#ff2040", false);
      A.glow(ctx, 6, -71, 5, "#ff2040", 0.9);
      const cast = b.state === "windup" || b.state === "active";
      A.limb(ctx, 6, -58, cast ? 22 : 10, cast ? -58 : -38, 6, "#1a1a22");
      A.circle(ctx, cast ? 24 : 10, cast ? -58 : -36, 4, "#e8e8ee", true, 1);
      if (cast) A.glow(ctx, 26, -58, 14, "#ff2040", 0.9);
      ctx.restore();
      if (b.sweepA !== undefined && b.state === "active" && b.atk === "sweep") {
        ctx.save();
        ctx.translate(b.cx, b.cy);
        ctx.rotate(b.sweepA);
        ctx.fillStyle = "rgba(255,90,255,0.6)";
        ctx.fillRect(0, -8, 900, 16);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, -3, 900, 6);
        ctx.restore();
      }
    },

    sabretooth(ctx, b) {
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      const crouch = b.state === "windup" ? 8 : 0;
      ctx.translate(0, crouch);
      legs(ctx, b, -6, 8, -36, 10, "#7a4a22", "#4a2a12");
      A.poly(ctx, [-14, -36, 14, -36, 18, -66, -16, -66], "#8a5a2a", true, 2.5);
      // Fur collar and mane
      A.poly(ctx, [-20, -60, -10, -74, 2, -66, 12, -76, 22, -62, 10, -56, -12, -56], "#f2d07a", true, 2);
      A.limb(ctx, -10, -60, -18, -38, 9, "#6a4220");
      A.ellipse(ctx, 6, -78, 10, 10, 0, "#e0b08a", true, 2);
      A.poly(ctx, [-8, -88, 2, -92, 14, -88, 4, -80, -10, -70, -18, -82], "#f2d07a", true, 2);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(9, -81, 4, 2);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(10, -72);
      ctx.lineTo(12, -66);
      ctx.lineTo(14, -72);
      ctx.fill();
      const atk = b.state === "active" ? 1 : 0;
      A.limb(ctx, 10, -62, 22 + atk * 10, -50 - atk * 6, 9, "#8a5a2a");
      for (let i = 0; i < 3; i++) A.limb(ctx, 24 + atk * 10, -52 - atk * 6 + i * 3, 32 + atk * 12, -56 - atk * 6 + i * 4, 1.5, "#f8f0e0", false);
      ctx.restore();
    },

    juggernaut(ctx, b) {
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing * (b.h / 106), b.h / 106);
      const lean = b.charging ? 0.35 : 0;
      legs(ctx, b, -14, 14, -46, 18, "#8a4a1a", "#5a2e10");
      ctx.rotate(lean);
      A.limb(ctx, -24, -86, -34, -54, 16, "#6a3a14");
      A.poly(ctx, [-30, -46, 30, -46, 36, -94, -32, -94], "#a85a22", true, 3);
      ctx.strokeStyle = "#5a2e10";
      ctx.lineWidth = 3;
      ctx.strokeRect(-20, -86, 40, 30);
      A.box(ctx, -28, -52, 56, 8, "#3a3a3a", true, 2);
      // Rounded helmet
      A.circle(ctx, 4, -106, 20, "#9a4a1a", true, 3);
      A.box(ctx, -4, -110, 26, 12, "#3a2a22", true, 3);
      ctx.fillStyle = "#e0b08a";
      ctx.fillRect(4, -108, 14, 7);
      A.glow(ctx, 14, -105, 5, "#ff3a3a", b.charging ? 1 : 0.4);
      A.limb(ctx, 24, -86, 38, -62, 16, "#a85a22");
      A.circle(ctx, 40, -58, 11, "#6a6a72", true, 2.5);
      ctx.restore();
      if (b.daze > 0) A.glow(ctx, b.cx, b.y + 10, 40, "#ffe14a", 0.3);
    },

    mystique(ctx, b, w) {
      if (b.disguise) {
        const base = XM.Outfits.get(b.disguise, 0);
        A.glow(ctx, b.cx, b.cy, 30, "#3a5ad0", 0.2);
        XM.CharArt.draw(ctx, b.disguise, base, { state: b.state === "active" ? "attack" : Math.abs(b.vx) > 20 ? "run" : "idle", t: b.t, phase: b.t * 9, kind: "punch", prog: 0.5, speed: b.vx }, b.cx, b.y + b.h, b.facing, b.h / XM.CHAR[b.disguise].size.h);
        return;
      }
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      const sw = legs(ctx, b, -2, 3, -32, 6, "#3a5ad0", "#2a3a9a");
      A.ellipse(ctx, 6 + sw * 8, -2, 5, 2.5, 0, "#f2f2f2", true, 1);
      A.poly(ctx, [-8, -32, 8, -32, 10, -54, -9, -54], "#f2f2f2", true, 2);
      ctx.fillStyle = "#c4161c";
      ctx.fillRect(-8, -36, 16, 3);
      A.circle(ctx, -2, -40, 3, "#c4161c", false);
      A.circle(ctx, 2, -61, 7.5, "#3a5ad0", true, 2);
      A.poly(ctx, [8, -64, 4, -72, -6, -72, -12, -60, -10, -46, -4, -56], "#d43a1a", true, 2);
      ctx.fillStyle = "#ffcf3a";
      ctx.fillRect(5, -63, 4, 2);
      A.limb(ctx, 4, -50, 16, -46, 5, "#3a5ad0");
      if (b.atk === "pistol" && (b.state === "windup" || b.state === "active")) A.box(ctx, 14, -50, 12, 5, "#2a2a2a", true, 1, 1);
      ctx.restore();
    },

    phoenix(ctx, b) {
      const t = b.t;
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      // Fire wings
      A.glow(ctx, 0, -40, 90, "#ff5a1a", 0.45 + 0.1 * Math.sin(t * 6));
      for (const side of [-1, 1]) {
        ctx.fillStyle = side > 0 ? "rgba(255,120,30,0.75)" : "rgba(255,200,60,0.6)";
        ctx.beginPath();
        ctx.moveTo(0, -48);
        ctx.quadraticCurveTo(side * 50, -90 + Math.sin(t * 5) * 10, side * 70, -40 + Math.sin(t * 5) * 10);
        ctx.quadraticCurveTo(side * 40, -48, 0, -30);
        ctx.fill();
      }
      A.limb(ctx, -2, -30, -6, -4, 6, "#a01a10");
      A.limb(ctx, 3, -30, 6, -4, 6, "#c4261a");
      A.poly(ctx, [-8, -30, 8, -30, 10, -52, -9, -52], "#c4261a", true, 2);
      ctx.fillStyle = "#f2c230";
      ctx.fillRect(-8, -36, 17, 3);
      A.poly(ctx, [-3, -50, 5, -50, 1, -40], "#f2c230", false);
      A.circle(ctx, 2, -59, 7, "#f3c9a8", true, 2);
      // Hair of fire
      for (let i = 0; i < 6; i++) {
        const fx = -8 - i * 3 + Math.sin(t * 9 + i) * 3;
        const fy = -64 - Math.cos(t * 7 + i) * 3;
        A.glow(ctx, fx, fy, 10, i % 2 ? "#ff7a1a" : "#ffcf4a", 0.9);
      }
      A.poly(ctx, [8, -62, 4, -70, -10, -68, -14, -54, -6, -58], "#d4261a", true, 1.5);
      A.glow(ctx, 6, -60, 5, "#ffe07a", 1);
      A.limb(ctx, 4, -50, 18, -56, 5, "#c4261a");
      A.glow(ctx, 20, -56, 12, "#ff7a1a", 0.8);
      ctx.restore();
    },

    omegared(ctx, b) {
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      legs(ctx, b, -5, 6, -38, 9, "#a8141c", "#6a0a10");
      A.poly(ctx, [-12, -38, 12, -38, 15, -70, -13, -70], "#c4161c", true, 2.5);
      ctx.strokeStyle = "#e8e8ee";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -66);
      ctx.lineTo(10, -46);
      ctx.moveTo(10, -66);
      ctx.lineTo(-10, -46);
      ctx.stroke();
      A.ellipse(ctx, 2, -78, 9, 10, 0, "#e8e2ea", true, 2);
      A.poly(ctx, [-8, -84, 0, -90, 11, -86, 6, -80, -6, -76], "#e8e8ee", true, 1.5);
      ctx.fillStyle = "#ff2a2a";
      ctx.fillRect(6, -80, 4, 2);
      // Carbonadium coils
      const coil = b.coil || 0;
      ctx.lineCap = "round";
      const drawCoil = (x0, y0, x1, y1, wave) => {
        ctx.strokeStyle = A.OUTLINE;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + wave, x1, y1);
        ctx.stroke();
        ctx.strokeStyle = "#b8bec8";
        ctx.lineWidth = 3;
        ctx.stroke();
      };
      if (b.spinA !== undefined && b.atk === "spin" && b.state === "active") {
        for (let i = 0; i < 4; i++) {
          const a = b.spinA + (i * Math.PI) / 2;
          drawCoil(8, -58, 8 + Math.cos(a) * 140, -58 + Math.sin(a) * 140, 20);
        }
      } else {
        drawCoil(10, -58, 24 + coil, -54, Math.sin(b.t * 6) * 10);
        drawCoil(-8, -58, -26, -24 + Math.sin(b.t * 4) * 8, 14);
      }
      ctx.restore();
    },

    blob(ctx, b) {
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      if (b.rolling) ctx.rotate(b.t * 12);
      const sq = b.onGround ? 1 : 1.08;
      A.limb(ctx, -16, -26, -18, -4, 16, "#3a3a6a");
      A.limb(ctx, 16, -26, 18, -4, 16, "#4a4a8a");
      A.ellipse(ctx, 0, -52 * sq, 46, 44 * sq, 0, "#f0c6a0", true, 3);
      A.poly(ctx, [-40, -60, 40, -60, 38, -22, -38, -22], "#f2c230", true, 2.5);
      ctx.fillStyle = "#4a4a8a";
      ctx.fillRect(-40, -30, 80, 10);
      A.circle(ctx, 12, -98, 12, "#f0c6a0", true, 2.5);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(16, -100, 3, 3);
      A.poly(ctx, [0, -106, 10, -112, 22, -106, 14, -102], "#d0a070", true, 1);
      A.limb(ctx, 36, -70, 50, -50, 13, "#f0c6a0");
      ctx.restore();
    },

    deathstrike(ctx, b) {
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      // Cyber spine tail
      ctx.strokeStyle = "#9aa3b2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -32);
      ctx.quadraticCurveTo(-26, -20 + Math.sin(b.t * 4) * 6, -30, -46 + Math.sin(b.t * 3) * 6);
      ctx.stroke();
      legs(ctx, b, -2, 3, -32, 6, "#1a1a1a", "#0a0a0a");
      A.poly(ctx, [-8, -32, 8, -32, 10, -54, -9, -54], "#8a1a1a", true, 2);
      A.poly(ctx, [-8, -50, 9, -50, 3, -38], "#1a1a1a", false);
      A.circle(ctx, 2, -61, 7, "#e8c0a0", true, 2);
      A.poly(ctx, [8, -64, 4, -70, -8, -70, -14, -40, -8, -46, -4, -58], "#0e0e10", true, 1.5);
      ctx.fillStyle = "#c4161c";
      ctx.fillRect(4, -63, 5, 1.5);
      const atk = b.state === "active" ? 1 : 0;
      A.limb(ctx, 4, -50, 14 + atk * 6, -44, 5, "#8a1a1a");
      for (let i = 0; i < 5; i++) A.limb(ctx, 16 + atk * 6, -45 + i * 1.6, 34 + atk * 10, -48 + i * 3, 1.3, "#e8eef6", false);
      ctx.restore();
    },

    colossusGuard(ctx, b) {
      const t = b.t;
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      legs(ctx, b, -24, 24, -60, 24, "#7a1a3a", "#4a0a22");
      A.box(ctx, -44, -16, 36, 16, "#3a3a48", true, 3);
      A.box(ctx, 8, -16, 36, 16, "#3a3a48", true, 3);
      A.poly(ctx, [-48, -56, 48, -56, 56, -130, -54, -130], "#8a1a3a", true, 3);
      // Horseshoe-magnet chest emblem
      ctx.strokeStyle = "#c08aff";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(0, -96, 18, Math.PI, 0, false);
      ctx.stroke();
      ctx.fillStyle = "#e8e8ee";
      ctx.fillRect(-23, -96, 10, 12);
      ctx.fillRect(13, -96, 10, 12);
      A.glow(ctx, 0, -96, 30, "#c08aff", 0.5 + 0.3 * Math.sin(t * 5));
      A.box(ctx, -22, -154, 44, 26, "#6a1a3a", true, 4);
      A.box(ctx, -12, -146, 30, 8, "#111", true, 2, 1.5);
      A.glow(ctx, 6, -142, 14, "#ff3a6a", 0.9);
      A.limb(ctx, 46, -120, 64, -80, 18, "#7a1a3a");
      A.box(ctx, 54, -84, 30, 18, "#3a3a48", true, 3);
      if (b.state === "windup") A.glow(ctx, 86, -76, 20, "#c08aff", 0.9);
      ctx.restore();
      if (b.beamX) {
        ctx.fillStyle = "rgba(255,58,106,0.6)";
        ctx.fillRect(Math.min(b.cx, b.beamX), b.floor - 50, Math.abs(b.beamX - b.cx), 30);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.min(b.cx, b.beamX), b.floor - 40, Math.abs(b.beamX - b.cx), 8);
      }
    },

    magneto(ctx, b) {
      const fin = b.def.final;
      const t = b.t;
      ctx.save();
      ctx.translate(b.cx, b.y + b.h);
      ctx.scale(b.facing, 1);
      A.glow(ctx, 0, -36, fin ? 90 : 60, fin ? "#ff5aff" : "#c08aff", 0.35 + 0.15 * Math.sin(t * 4));
      const fl = Math.sin(t * 3) * 5;
      A.poly(ctx, [-6, -60, -24 + fl, -30, -30 + fl, 4, -10 + fl * 0.5, -6, -4, -30], "#6a2a8a", true, 2);
      A.limb(ctx, -2, -32, -6, -4, 6, "#8a1a2a");
      A.limb(ctx, 3, -32, 8, -6, 6, "#a01a2a");
      A.poly(ctx, [-8, -32, 9, -32, 11, -56, -9, -56], "#a01a2a", true, 2);
      ctx.fillStyle = "#6a2a8a";
      ctx.fillRect(-9, -52, 19, 8);
      ctx.fillRect(-8, -36, 17, 3);
      // Helmet with the ridged crest
      A.circle(ctx, 2, -63, 7.5, "#e8c4a8", true, 2);
      A.poly(ctx, [-8, -58, -8, -70, -2, -75, 8, -73, 11, -66, 9, -60, 5, -62, 4, -58], "#a01a2a", true, 2);
      A.poly(ctx, [-4, -72, -6, -80, 0, -74], "#a01a2a", true, 1.2);
      ctx.fillStyle = "#6a2a8a";
      ctx.fillRect(-7, -70, 4, 10);
      const cast = b.state === "windup" || b.state === "active";
      A.limb(ctx, 4, -52, cast ? 20 : 12, cast ? -60 : -36, 5, "#a01a2a");
      A.circle(ctx, cast ? 22 : 12, cast ? -61 : -34, 3.5, "#6a2a8a", true, 1);
      if (cast) A.glow(ctx, 24, -62, 18, "#c08aff", 0.9);
      ctx.restore();
      if (b.sweepA !== undefined && b.atk === "beam" && b.state === "active") {
        ctx.save();
        ctx.translate(b.cx, b.cy);
        ctx.rotate(b.sweepA);
        ctx.fillStyle = "rgba(255,90,255,0.6)";
        ctx.fillRect(0, -10, 1000, 20);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, -3, 1000, 6);
        ctx.restore();
      }
    },
  };

  // Portraits for story panels and the HUD.
  function portrait(ctx, artId, x, y, size) {
    const def = Object.values(BOSSES).find((d) => d.art === artId) || BOSSES.magneto;
    const fake = { cx: 0, cy: 0, x: -def.w / 2, y: -def.h, w: def.w, h: def.h, t: performance.now() / 1000, facing: 1, state: "idle", vx: 0, onGround: true, def, phase: 0, floor: 0 };
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - size / 2, y - size / 2, size, size);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y - size / 2, x, y + size / 2);
    g.addColorStop(0, "#5a1a2a");
    g.addColorStop(1, "#14060a");
    ctx.fillStyle = g;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    const s = (size / Math.max(30, def.h * 0.42)) * 0.9;
    ctx.translate(x, y + def.h * 0.58 * s);
    ctx.scale(s, s);
    Object.defineProperty(fake, "cx", { value: 0 });
    BOSS_ART[artId](ctx, Object.assign(fake, { x: -def.w / 2, y: -def.h }), null);
    ctx.restore();
    ctx.strokeStyle = A.OUTLINE;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - size / 2, y - size / 2, size, size);
  }

  XM.BOSSES = BOSSES;
  XM.Boss = Boss;
  XM.BossArt = BOSS_ART;
  XM.bossPortrait = portrait;
})(window.XM);
