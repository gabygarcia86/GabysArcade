/*
 * Hero abilities: Basic (3-hit combo), Special (costs X-Energy) and Ultimate (needs a
 * full Ultimate meter) for all 12 X-Men. Each uses the combat helpers in combat.js;
 * timed effects run as world actions so they animate over several frames.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const A = XM.Art;

  // ---------- Helpers ----------
  const front = (p, reach, h, yOff = 0.48) => ({ x: p.facing > 0 ? p.cx : p.cx - reach, y: p.y + p.h * yOff - h / 2, w: reach, h });
  const dmgB = (p, combo) => p.st.atk * (combo === 2 ? 1.45 : 1);
  const dmgS = (p, f) => p.st.atk * p.st.sp * f;
  const dmgU = (p, f) => p.st.atk * p.st.ult * f;
  const hand = (p, up) => ({ x: p.cx + p.facing * 18, y: p.y + p.h * (up ? 0.22 : 0.36) });
  const aim = (p, up, speed) => (up ? { vx: p.facing * speed * 0.72, vy: -speed * 0.72 } : { vx: p.facing * speed, vy: 0 });
  const targets = (w) => w.combat.onScreen().filter((e) => !e.prop || e.objective);

  // The nearest enemy in front of a level shot from (sx, sy) that the shot would pass
  // over (it sits lower than the shot), within `range`. Null if the nearest enemy in
  // front is already in the shot's path, or nothing is low enough.
  function lowTarget(w, p, sx, sy, r, range) {
    let best = null;
    let bd = Infinity;
    for (const e of w.enemies) {
      if (e.dead) continue;
      const d = (e.x + e.w / 2 - sx) * p.facing;
      if (d < -e.w / 2 || d > range) continue;
      if (e.y + e.h < sy - r || e.y > sy + 160) continue; // above the shot, or far below
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best || best.y <= sy + r) return null; // level shot already hits it
    return best;
  }

  // Velocity for a basic shot from (sx, sy). Like aim(), but a level shot that would fly
  // over a short enemy on the ground (drones, creatures, turrets...) angles down at it.
  function aimLow(w, p, up, speed, sx, sy, r, range) {
    if (up) return aim(p, true, speed);
    const e = lowTarget(w, p, sx, sy, r, range);
    if (!e) return aim(p, false, speed);
    const dx = Math.max(12, Math.abs(e.x + e.w / 2 - sx));
    const ang = Math.min(1.0, Math.atan2(e.y + e.h / 2 - sy, dx));
    return { vx: p.facing * speed * Math.cos(ang), vy: speed * Math.sin(ang) };
  }

  function slashFx(w, p, color, big = 1, flip = false) {
    let t = 0;
    const x = p.cx;
    const y = p.y + p.h * 0.45;
    const dir = p.facing;
    w.addAction({
      update: (dt) => (t += dt) < 0.14,
      draw: (ctx) => {
        const k = t / 0.14;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, flip ? -1 : 1);
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = color;
        ctx.lineWidth = 6 * big * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(6, 0, 30 * big, -1.2 + k * 0.4, 1.0 + k * 0.4);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(6, 0, 30 * big, -0.9 + k * 0.4, 0.8 + k * 0.4);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      },
    });
  }

  function lightning(w, x, yTop, yBot, color = "#e6f6ff") {
    let t = 0;
    const pts = [];
    let cx = x;
    for (let y = yTop; y < yBot; y += 24) {
      pts.push(cx, y);
      cx = x + U.rand(-22, 22);
    }
    pts.push(x, yBot);
    w.addAction({
      update: (dt) => (t += dt) < 0.3,
      draw: (ctx) => {
        const a = 1 - t / 0.3;
        ctx.globalAlpha = a;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#7fbfff";
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        A.glow(ctx, x, yBot, 60, "#bfe6ff", a);
      },
    });
  }

  function groundY(w, x, y) {
    const lv = w.level;
    const T = XM.T;
    for (let yy = Math.max(0, y); yy < lv.H * T; yy += 8) if (XM.Physics.solidAt(lv, x, yy) || XM.Physics.tile(lv, Math.floor(x / T), Math.floor(yy / T)) === XM.TILE.ONEWAY) return yy;
    return y + 60;
  }

  // A wave travelling along the ground that hits each enemy once.
  function groundWave(w, p, x, dir, opts) {
    const hit = new Set();
    let t = 0;
    let pos = x;
    const gy = groundY(w, x, p.y + p.h - 4);
    const spikes = [];
    w.addAction({
      update: (dt) => {
        t += dt;
        if (t < opts.range / opts.speed) {
          const old = pos;
          pos += dir * opts.speed * dt;
          if (Math.abs(pos - (spikes.length ? spikes[spikes.length - 1].x : x - dir * 30)) > 22) spikes.push({ x: pos, t });
          const rect = { x: Math.min(old, pos) - 10, y: gy - opts.h, w: Math.abs(pos - old) + 20, h: opts.h };
          for (const e of w.enemies) {
            if (e.dead || hit.has(e) || !U.overlap(rect, e)) continue;
            hit.add(e);
            w.combat.hitEnemy(e, opts.dmg, { kb: opts.kb || 150, freeze: opts.freeze, stun: opts.stun, power: true, color: opts.color, launch: opts.launch }, old);
          }
          w.combat.breakTiles(rect, true);
        }
        return t < opts.range / opts.speed + 0.6;
      },
      draw: (ctx) => {
        for (const s of spikes) {
          const age = t - s.t;
          const k = Math.min(1, age / 0.08);
          const fade = Math.max(0, 1 - Math.max(0, age - 0.35) / 0.3);
          if (fade <= 0) continue;
          ctx.globalAlpha = fade;
          if (opts.style === "ice") {
            A.poly(ctx, [s.x - 9, gy, s.x - 2, gy - 34 * k, s.x + 3, gy - 18 * k, s.x + 8, gy - 26 * k, s.x + 11, gy], "#dff7ff", true, 1.5);
          } else {
            A.poly(ctx, [s.x - 12, gy, s.x - 4, gy - 16 * k, s.x + 4, gy - 22 * k, s.x + 12, gy], opts.color || "#b09070", true, 1.5);
            if (age < 0.1) XM.FX.burst(s.x, gy, { count: 2, color: "#cdb89a", speed: 160, life: 0.4, type: XM.FX.T.DOT, angle: -Math.PI / 2, spread: 1.4, grav: 600 });
          }
        }
        ctx.globalAlpha = 1;
      },
    });
  }

  function expandingRing(w, x, y, maxR, dur, color, onHit, width = 8) {
    const hit = new Set();
    let t = 0;
    w.addAction({
      update: (dt) => {
        t += dt;
        const r = (t / dur) * maxR;
        for (const e of w.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d = Math.hypot(e.x + e.w / 2 - x, e.y + e.h / 2 - y);
          if (d <= r + 20) {
            hit.add(e);
            onHit(e);
          }
        }
        return t < dur;
      },
      draw: (ctx) => {
        const k = t / dur;
        const r = k * maxR;
        ctx.globalAlpha = 1 - k * 0.8;
        ctx.strokeStyle = color;
        ctx.lineWidth = width * (1 - k) + 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      },
    });
  }

  // Teleport the hero beside a target if the spot is free.
  function blinkTo(w, p, e) {
    const side = p.cx < e.x + e.w / 2 ? 1 : -1; // land on the far side
    const nx = side > 0 ? e.x + e.w + 4 : e.x - p.w - 4;
    const ny = Math.min(p.y, e.y + e.h - p.h);
    if (!p.blocked(nx, ny)) {
      XM.FX.smoke(p.cx, p.cy, 6, "#3a2a5a");
      p.x = nx;
      p.y = ny;
      p.facing = -side;
      XM.FX.smoke(p.cx, p.cy, 6, "#3a2a5a");
      XM.Audio.sfx("teleport");
      return true;
    }
    p.facing = side;
    return false;
  }

  const Abilities = {
    // ===================== CYCLOPS =====================
    cyclops: {
      // Optic Blast: no punches. Each hit fires a small optic blast from his visor; the
      // third hit of a combo fires a medium one. Hold up to aim diagonally.
      basic(p, w, c, up) {
        const big = c === 2;
        p.act("attack", up ? "aimUp" : "visor", 0.26);
        if (big) p.power = 0.6;
        w.later(0.07, () => {
          const speed = big ? 980 : 1050;
          const life = big ? 0.5 : 0.4;
          const r = big ? 10 : 5;
          const sx = p.cx + p.facing * 8;
          const sy = p.y + p.h * 0.2;
          // Leaves at eye level, so it angles down at short enemies on the ground.
          const v = aimLow(w, p, up, speed, sx, sy, r, speed * life);
          w.combat.shoot({
            kind: "optic",
            x: sx,
            y: sy,
            ...v,
            r,
            dmg: dmgB(p, c) * (big ? 1.1 : 0.9),
            life,
            color: "#ff3b3b",
            kb: big ? 260 : 120,
          });
          XM.Audio.sfx("blast");
          if (big) XM.FX.shake(2, 0.12);
        });
      },
      special(p, w) {
        p.act("special", "visor", 0.5);
        p.power = 1;
        XM.Audio.sfx("beam");
        w.later(0.1, () => {
          w.combat.beam({ follow: p, len: 430, h: 46, dur: 0.36, tick: 0.07, dmg: dmgS(p, 1.0) * 0.26, kb: 240, color: "#ff3030", offY: -0.8 });
          XM.FX.shake(3, 0.3);
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "visor", 1.75);
        p.power = 1;
        w.later(0.25, () => {
          w.combat.beam({ follow: p, len: XM.VIEW.w + 200, h: 110, dur: 1.4, tick: 0.08, dmg: dmgU(p, 3.2) / 17, kb: 140, color: "#ff2020", core: "#fff6f0", offY: -0.8 });
          XM.Audio.sfx("beam");
          XM.FX.shake(7, 1.4);
          XM.FX.flash("#ff2a2a", 0.3, 1.5);
        });
        w.later(0.7, () => XM.Audio.sfx("beam"));
        w.later(1.1, () => XM.Audio.sfx("beam"));
      },
    },

    // ===================== WOLVERINE =====================
    wolverine: {
      basic(p, w, c) {
        p.act("attack", "slash", 0.2);
        XM.Audio.sfx("slash");
        slashFx(w, p, "#e8eef6", c === 2 ? 1.3 : 1, c === 1);
        w.later(0.05, () => w.combat.melee(front(p, 44, 48), dmgB(p, c), { kb: c === 2 ? 240 : 90, dir: p.facing, color: "#dfe4ea" }));
      },
      special(p, w) {
        p.act("special", "slash", 0.45);
        p.untouchable = 0.5;
        p.noControl = 0.42;
        p.vx = p.facing * 720;
        XM.Audio.sfx("roar");
        let t = 0;
        let tick = 0;
        w.addAction({
          update: (dt) => {
            t += dt;
            tick -= dt;
            p.vx = p.facing * 720;
            if (tick <= 0) {
              tick = 0.08;
              w.combat.melee({ x: p.x - 14, y: p.y, w: p.w + 28, h: p.h }, dmgS(p, 0.42), { kb: 260, dir: p.facing, color: "#ffe27a", hitstop: 0, power: true });
              slashFx(w, p, "#ffe27a", 1.1, Math.random() < 0.5);
            }
            XM.FX.spawn(XM.FX.T.GLOW, p.cx - p.facing * 10, p.cy, 0, 0, 0.25, 18, "#ffcf3a");
            return t < 0.42;
          },
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "slash", 1.8);
        p.untouchable = 1.9;
        XM.Audio.sfx("roar");
        const list = targets(w);
        let i = 0;
        let t = 0;
        let tick = 0.1;
        const ghosts = [];
        w.addAction({
          update: (dt) => {
            t += dt;
            tick -= dt;
            if (tick <= 0 && i < 14) {
              tick = 0.11;
              const live = list.filter((e) => !e.dead);
              if (live.length) {
                const e = live[i % live.length];
                const gx = e.x + e.w / 2 + (i % 2 ? 26 : -26);
                ghosts.push({ x: gx, y: e.y + e.h, f: i % 2 ? -1 : 1, t: 0 });
                w.combat.hitEnemy(e, dmgU(p, 0.42), { kb: 60, power: true, color: "#ffe27a", hitstop: 0 }, gx);
                XM.FX.burst(e.x + e.w / 2, e.y + e.h / 2, { count: 8, color: "#ffffff", speed: 300, life: 0.25 });
              } else {
                w.combat.melee(front(p, 70, 60), dmgU(p, 0.42), { kb: 80, power: true });
                slashFx(w, p, "#ffe27a", 1.5, i % 2 === 1);
              }
              XM.Audio.sfx("slash");
              i++;
            }
            for (const g of ghosts) g.t += dt;
            return t < 1.75;
          },
          draw: (ctx) => {
            for (const g of ghosts) {
              const a = Math.max(0, 1 - g.t / 0.35);
              if (a <= 0) continue;
              XM.CharArt.draw(ctx, "wolverine", p.look, { state: "attack", kind: "slash", prog: 0.5, combo: 2, t: g.t }, g.x, g.y, g.f, 1, a * 0.8);
              ctx.globalAlpha = a;
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(g.x - 20, g.y - 60);
              ctx.lineTo(g.x + 20, g.y - 10);
              ctx.moveTo(g.x + 20, g.y - 60);
              ctx.lineTo(g.x - 20, g.y - 10);
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          },
        });
      },
    },

    // ===================== STORM =====================
    storm: {
      basic(p, w, c, up) {
        p.act("attack", up ? "aimUp" : "blast", 0.24);
        XM.Audio.sfx("wind");
        const h = hand(p, up);
        w.later(0.05, () => w.combat.shoot({ kind: "wind", x: h.x, y: h.y, ...aim(p, up, 620), r: 13, dmg: dmgB(p, c), life: 0.6, kb: c === 2 ? 380 : 260, pierce: c === 2, color: "#e6f6ff" }));
      },
      special(p, w) {
        p.act("special", "rise", 0.5);
        p.power = 1;
        w.later(0.15, () => {
          const ahead = w.enemies.filter((e) => !e.dead && !e.prop && (e.x + e.w / 2 - p.cx) * p.facing > -20 && Math.abs(e.x - p.x) < 560 && w.cam.visible(e.x, e.y, e.w, e.h, 0));
          ahead.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
          const e = ahead[0];
          const x = e ? e.x + e.w / 2 : p.cx + p.facing * 240;
          const y = e ? e.y + e.h / 2 : groundY(w, x, p.y);
          lightning(w, x, w.cam.y - 20, y + 10);
          w.combat.aoe(x, y, 75, dmgS(p, 1.7), { kb: 160, stun: 0.8, power: true, color: "#bfe6ff" });
          XM.Audio.sfx("lightning");
          XM.FX.flash("#e6f6ff", 0.25);
          XM.FX.shake(4, 0.25);
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "rise", 2.3);
        p.power = 1;
        let t = 0;
        let tick = 0.35;
        let strikes = 0;
        XM.Audio.sfx("wind");
        w.addAction({
          screen: true,
          update: (dt) => {
            t += dt;
            tick -= dt;
            if (tick <= 0 && strikes < 13) {
              tick = 0.14;
              strikes++;
              const list = targets(w);
              const e = list.length ? list[strikes % list.length] : null;
              const x = e ? e.x + e.w / 2 : w.cam.x + U.rand(60, XM.VIEW.w - 60);
              const y = e ? e.y + e.h / 2 : groundY(w, x, w.cam.y + 100);
              lightning(w, x, w.cam.y - 20, y + 10);
              w.combat.aoe(x, y, 80, dmgU(p, 0.6), { kb: 120, stun: 0.6, power: true, color: "#bfe6ff", hitstop: 0 });
              XM.Audio.sfx("lightning");
              XM.FX.shake(6, 0.2);
              if (strikes % 3 === 0) XM.FX.flash("#e6f6ff", 0.25);
            }
            for (let i = 0; i < 4; i++) XM.FX.spawn(XM.FX.T.SPARK, w.cam.x + Math.random() * XM.VIEW.w, w.cam.y - 10, -60, 900, 0.7, 1.2, "#9fc8ff");
            return t < 2.3;
          },
          drawScreen: (ctx) => {
            const k = Math.min(1, t * 3) * Math.min(1, (2.3 - t) * 3);
            ctx.fillStyle = `rgba(10,16,40,${0.45 * k})`;
            ctx.fillRect(0, 0, XM.VIEW.w, XM.VIEW.h);
          },
        });
      },
    },

    // ===================== JEAN GREY =====================
    jean: {
      basic(p, w, c, up) {
        p.act("attack", up ? "aimUp" : "blast", 0.24);
        XM.Audio.sfx("psychic");
        w.later(0.05, () => {
          // Recomputed when it fires; angles down at short enemies on the ground.
          const h = hand(p, up);
          const r = c === 2 ? 10 : 7;
          const v = aimLow(w, p, up, 720, h.x, h.y, r, 720 * 0.7);
          w.combat.shoot({ kind: "psy", x: h.x, y: h.y, ...v, r, dmg: dmgB(p, c), life: 0.7, color: "#ff6ad5", kb: 160, trail: 0.4 });
        });
      },
      special(p, w) {
        p.act("special", "wave", 0.45);
        p.power = 1;
        XM.Audio.sfx("psychic");
        const hit = new Set();
        let t = 0;
        const x0 = p.cx;
        const y0 = p.cy;
        const dir = p.facing;
        w.addAction({
          update: (dt) => {
            t += dt;
            const x = x0 + dir * t * 620;
            const hgt = 60 + t * 120;
            const rect = { x: dir > 0 ? x - 30 : x, y: y0 - hgt / 2, w: 30, h: hgt };
            for (const e of w.enemies) {
              if (e.dead || hit.has(e) || !U.overlap(rect, e)) continue;
              hit.add(e);
              w.combat.hitEnemy(e, dmgS(p, 1.3), { kb: 220, stun: 1.2, launch: 360, power: true, color: "#7dffb0" }, x - dir * 40);
            }
            w.combat.breakTiles(rect, true);
            return t < 0.6;
          },
          draw: (ctx) => {
            const x = x0 + dir * t * 620;
            const hgt = 60 + t * 120;
            ctx.globalAlpha = 1 - t / 0.6;
            ctx.strokeStyle = "#7dffb0";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.ellipse(x, y0, 14, hgt / 2, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, dir > 0 ? Math.PI / 2 : Math.PI * 1.5);
            ctx.stroke();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = 1;
          },
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "rise", 1.5);
        p.power = 1;
        XM.Audio.sfx("charge");
        w.later(0.45, () => {
          const x = p.cx;
          const y = p.cy;
          w.combat.aoe(x, y, 380, dmgU(p, 3.0), { kb: 420, power: true, color: "#ff8a3d", launch: 300 });
          XM.Audio.sfx("explosion");
          XM.Audio.sfx("fire");
          XM.FX.flash("#ff9a3d", 0.6, 1.5);
          XM.FX.shake(10, 0.6);
          XM.FX.ring(x, y, 380, "#ffcf4a", 0.6, 10);
          XM.FX.burst(x, y, { count: 60, colors: ["#ff5a1a", "#ffcf4a", "#ffffff"], speed: 600, life: 0.9, size: 4 });
          let t = 0;
          w.addAction({
            update: (dt) => (t += dt) < 1.0,
            draw: (ctx) => {
              const k = t / 1.0;
              const s = 60 + k * 260;
              ctx.save();
              ctx.translate(x, y - 20);
              ctx.globalAlpha = 1 - k;
              A.glow(ctx, 0, 0, s * 1.2, "#ff7a1a", 0.8);
              ctx.fillStyle = "#ffcf4a";
              ctx.strokeStyle = "#ff5a1a";
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(0, -s * 0.15);
              ctx.quadraticCurveTo(-s * 0.9, -s * 0.9, -s * 1.1, s * 0.1);
              ctx.quadraticCurveTo(-s * 0.4, -s * 0.05, 0, s * 0.8);
              ctx.quadraticCurveTo(s * 0.4, -s * 0.05, s * 1.1, s * 0.1);
              ctx.quadraticCurveTo(s * 0.9, -s * 0.9, 0, -s * 0.15);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
              ctx.globalAlpha = 1;
            },
          });
        });
      },
    },

    // ===================== BEAST =====================
    beast: {
      basic(p, w, c) {
        p.act("attack", c === 2 ? "heavy" : "slash", 0.3);
        XM.Audio.sfx(c === 2 ? "punch" : "slash");
        slashFx(w, p, "#9fb8ff", 1.3, c === 1);
        w.later(0.1, () => w.combat.melee(front(p, 52, 52), dmgB(p, c) * 1.05, { kb: c === 2 ? 320 : 180, dir: p.facing, heavy: c === 2, color: "#9fb8ff" }));
      },
      special(p, w) {
        p.act("special", "heavy", 0.75);
        p.vy = -720;
        p.vx = p.facing * 380;
        p.noControl = 0.6;
        p.onGround = false;
        XM.Audio.sfx("jump");
        let t = 0;
        w.addAction({
          update: (dt) => {
            t += dt;
            if (t > 0.12 && (p.onGround || t > 1.0)) {
              const x = p.cx;
              const y = p.y + p.h;
              w.combat.aoe(x, y - 20, 135, dmgS(p, 1.6), { kb: 320, stun: 0.7, power: true, launch: 300, color: "#9fb8ff" });
              XM.FX.ring(x, y - 6, 135, "#cfdcff", 0.4, 6);
              XM.FX.burst(x, y, { count: 18, color: "#cdb89a", speed: 260, life: 0.5, type: XM.FX.T.DOT, angle: -Math.PI / 2, spread: 2.4, grav: 700 });
              XM.FX.shake(7, 0.3);
              XM.Audio.sfx("stomp");
              p.lockT = Math.min(p.lockT, 0.15);
              return false;
            }
            return true;
          },
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "slam", 1.6);
        p.power = 1;
        XM.Audio.sfx("roar");
        [0.35, 0.8, 1.25].forEach((d, i) =>
          w.later(d, () => {
            const x = p.cx;
            groundWave(w, p, x, 1, { range: 620, speed: 1100, h: 90, dmg: dmgU(p, 0.95), kb: 260, stun: 0.8, launch: 320 });
            groundWave(w, p, x, -1, { range: 620, speed: 1100, h: 90, dmg: dmgU(p, 0.95), kb: 260, stun: 0.8, launch: 320 });
            XM.FX.shake(9, 0.35);
            XM.Audio.sfx("stomp");
            XM.FX.ring(x, p.y + p.h, 90 + i * 30, "#cfdcff", 0.4, 8);
          }),
        );
      },
    },

    // ===================== GAMBIT =====================
    gambit: {
      basic(p, w, c, up) {
        p.act("attack", up ? "aimUp" : "throw", 0.22);
        XM.Audio.sfx("card");
        const h = hand(p, up);
        w.later(0.06, () => w.combat.shoot({ kind: "card", x: h.x, y: h.y, ...aim(p, up, 820), r: 6, dmg: dmgB(p, c) * 0.75, life: 0.7, explode: c === 2 ? 46 : 30, color: "#ff4fb3" }));
      },
      special(p, w, up) {
        p.act("special", "throw", 0.4);
        XM.Audio.sfx("card");
        const h = hand(p, up);
        w.later(0.08, () => {
          for (let i = -2; i <= 2; i++) {
            const a = (up ? -0.6 : 0) + i * 0.17;
            w.combat.shoot({ kind: "card", x: h.x, y: h.y, vx: Math.cos(a) * 760 * p.facing, vy: Math.sin(a) * 760, r: 6, dmg: dmgS(p, 0.6), life: 0.8, explode: 42, color: "#ff4fb3", power: true });
          }
          XM.Audio.sfx("card");
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "throw", 1.6);
        p.power = 1;
        const cam = w.cam;
        const list = targets(w);
        for (let i = 0; i < 26; i++) {
          const tgt = list.length ? list[i % list.length] : null;
          const x = tgt ? tgt.x + tgt.w / 2 + U.rand(-80, 80) : cam.x + Math.random() * XM.VIEW.w;
          w.combat.shoot({ kind: "card", x, y: cam.y - 20, vx: U.rand(-60, 60), vy: 520, r: 7, dmg: dmgU(p, 0.34), life: 2.2, explode: 52, color: "#ff4fb3", power: true, ghost: true, homing: 7, delay: 0.25 + i * 0.045, target: tgt });
        }
        for (let i = 0; i < 6; i++) w.later(0.25 + i * 0.2, () => XM.Audio.sfx("card"));
        XM.FX.flash("#ff4fb3", 0.25, 2);
      },
    },

    // ===================== NIGHTCRAWLER =====================
    nightcrawler: {
      // Sword Strike: blink beside the nearest foe and slash with his sword (a 3-hit
      // combo of alternating cuts; the blade itself is drawn in characterArt.js).
      basic(p, w, c) {
        p.act("attack", "slash", 0.24);
        const e = w.combat.nearest(p.cx, p.cy, 170);
        if (e && Math.abs(e.y + e.h - (p.y + p.h)) < 90 && !e.prop) blinkTo(w, p, e);
        XM.Audio.sfx("slash");
        slashFx(w, p, "#e4e8ff", c === 2 ? 1.25 : 1.1, c === 1);
        w.later(0.05, () => w.combat.melee(front(p, 54, 54), dmgB(p, c) * 1.05, { kb: 150, dir: p.facing, color: "#b09aff" }));
      },
      special(p, w) {
        p.act("special", "slash", 0.62);
        p.untouchable = 0.7;
        let n = 0;
        const hitSet = [];
        const strike = () => {
          const list = w.combat.onScreen().filter((e) => !e.prop && Math.hypot(e.x - p.x, e.y - p.y) < 320);
          list.sort((a, b) => hitSet.filter((x) => x === a).length - hitSet.filter((x) => x === b).length || Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
          const e = list[0];
          if (e) {
            blinkTo(w, p, e);
            hitSet.push(e);
            w.combat.hitEnemy(e, dmgS(p, 0.55), { kb: 120, stun: 0.3, power: true, color: "#b09aff" }, p.cx);
          } else w.combat.melee(front(p, 50, 50), dmgS(p, 0.55), { kb: 120, power: true });
          slashFx(w, p, "#b09aff", 1.2, n % 2 === 1);
          XM.Audio.sfx("slash");
          n++;
          if (n < 4) w.later(0.14, strike);
        };
        strike();
      },
      ultimate(p, w) {
        p.act("ultimate", "slash", 1.9);
        p.untouchable = 2.0;
        p.hidden = true;
        XM.FX.smoke(p.cx, p.cy, 14, "#3a2a5a");
        XM.Audio.sfx("teleport");
        const list = targets(w);
        let i = 0;
        const total = Math.max(9, list.length * 3);
        const step = Math.min(0.12, 1.5 / total);
        const go = () => {
          const live = list.filter((e) => !e.dead);
          if (live.length) {
            const e = live[i % live.length];
            const x = e.x + e.w / 2;
            const y = e.y + e.h / 2;
            XM.FX.smoke(x + U.rand(-20, 20), y, 5, "#3a2a5a");
            w.combat.hitEnemy(e, dmgU(p, 0.36), { kb: 60, power: true, color: "#b09aff", hitstop: 0 }, x - 20);
            if (i % 2) XM.Audio.sfx("teleport");
            else XM.Audio.sfx("slash");
          }
          i++;
          if (i < total) w.later(step, go);
          else
            w.later(0.15, () => {
              p.hidden = false;
              XM.FX.smoke(p.cx, p.cy, 14, "#3a2a5a");
              XM.Audio.sfx("teleport");
            });
        };
        w.later(0.2, go);
      },
    },

    // ===================== COLOSSUS =====================
    colossus: {
      basic(p, w, c) {
        p.act("attack", "punch", 0.34);
        XM.Audio.sfx("punch");
        w.later(0.12, () => {
          const n = w.combat.melee(front(p, 46, 40), dmgB(p, c) * 1.05, { kb: c === 2 ? 420 : 280, dir: p.facing, heavy: true, color: "#e8eef6" });
          if (n) XM.FX.shake(c === 2 ? 4 : 2, 0.12);
        });
      },
      special(p, w) {
        p.act("special", "slam", 0.62);
        w.later(0.3, () => {
          const x = p.cx + p.facing * 20;
          const y = p.y + p.h;
          w.combat.aoe(x, y - 20, 150, dmgS(p, 1.45), { kb: 340, stun: 1.0, power: true, launch: 320, color: "#e8eef6" });
          XM.FX.ring(x, y - 4, 150, "#e8eef6", 0.4, 7);
          XM.FX.burst(x, y, { count: 20, color: "#b8a68a", speed: 300, life: 0.6, type: XM.FX.T.DOT, angle: -Math.PI / 2, spread: 2.2, grav: 800 });
          XM.FX.shake(8, 0.3);
          XM.Audio.sfx("stomp");
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "slam", 1.7);
        p.power = 1;
        XM.Audio.sfx("roar");
        w.later(0.35, () => XM.FX.shake(12, 1.3));
        for (let i = 0; i < 5; i++) {
          w.later(0.35 + i * 0.26, () => {
            XM.Audio.sfx("stomp");
            for (const e of targets(w)) {
              const grounded = e.onGround || !e.flying;
              w.combat.hitEnemy(e, dmgU(p, grounded ? 0.7 : 0.35), { kb: 80, stun: 0.6, power: true, launch: grounded ? 260 : 0, color: "#b8a68a", hitstop: 0 }, e.x - 10);
              XM.FX.burst(e.x + e.w / 2, e.y + e.h, { count: 6, color: "#a89070", speed: 260, life: 0.5, type: XM.FX.T.SHARD, angle: -Math.PI / 2, spread: 1.2, grav: 900 });
            }
            for (let k = 0; k < 6; k++) {
              const x = w.cam.x + Math.random() * XM.VIEW.w;
              XM.FX.burst(x, groundY(w, x, w.cam.y + 200), { count: 4, color: "#8a7a68", speed: 300, life: 0.6, type: XM.FX.T.SHARD, angle: -Math.PI / 2, spread: 0.8, grav: 900 });
            }
          });
        }
      },
    },

    // ===================== ICEMAN =====================
    iceman: {
      basic(p, w, c, up) {
        p.act("attack", up ? "aimUp" : "blast", 0.22);
        XM.Audio.sfx("ice");
        const h = hand(p, up);
        w.later(0.05, () => {
          w.combat.shoot({ kind: "ice", x: h.x, y: h.y, ...aim(p, up, 780), r: 6, dmg: dmgB(p, c), life: 0.65, slow: 1.5, color: "#bff0ff", kb: 110 });
          if (c === 2) {
            const v = aim(p, up, 780);
            w.combat.shoot({ kind: "ice", x: h.x, y: h.y - 8, vx: v.vx, vy: v.vy - 90, r: 6, dmg: dmgB(p, c) * 0.6, life: 0.65, slow: 1.5, color: "#bff0ff" });
            w.combat.shoot({ kind: "ice", x: h.x, y: h.y + 8, vx: v.vx, vy: v.vy + 90, r: 6, dmg: dmgB(p, c) * 0.6, life: 0.65, slow: 1.5, color: "#bff0ff" });
          }
        });
      },
      special(p, w) {
        p.act("special", "wave", 0.45);
        XM.Audio.sfx("ice");
        w.later(0.1, () => groundWave(w, p, p.cx + p.facing * 20, p.facing, { range: 480, speed: 900, h: 70, dmg: dmgS(p, 1.25), freeze: 1.6, style: "ice", color: "#bff0ff" }));
      },
      ultimate(p, w) {
        p.act("ultimate", "rise", 1.4);
        p.power = 1;
        XM.Audio.sfx("charge");
        w.later(0.4, () => {
          for (const e of targets(w)) {
            w.combat.hitEnemy(e, dmgU(p, 2.3), { kb: 0, freeze: 3.5, power: true, color: "#bff0ff", hitstop: 0 }, e.x);
            XM.FX.burst(e.x + e.w / 2, e.y + e.h / 2, { count: 10, color: "#dff7ff", speed: 260, life: 0.6, type: XM.FX.T.SHARD });
          }
          XM.FX.flash("#bff0ff", 0.65, 1.2);
          XM.FX.shake(6, 0.4);
          XM.Audio.sfx("ice");
          XM.Audio.sfx("explosion");
          for (let i = 0; i < 40; i++) XM.FX.spawn(XM.FX.T.STAR, w.cam.x + Math.random() * XM.VIEW.w, w.cam.y + Math.random() * XM.VIEW.h, 0, 40, 1.2, 5, "#ffffff");
        });
      },
    },

    // ===================== PSYLOCKE =====================
    psylocke: {
      basic(p, w, c) {
        p.act("attack", "slash", 0.2);
        XM.Audio.sfx("slash");
        slashFx(w, p, "#ff4fe0", c === 2 ? 1.4 : 1.1, c === 1);
        w.later(0.04, () => w.combat.melee(front(p, 50, 46), dmgB(p, c), { kb: c === 2 ? 220 : 80, dir: p.facing, stun: c === 2 ? 0.3 : 0, color: "#ff4fe0" }));
      },
      special(p, w, up) {
        p.act("special", "throw", 0.35);
        XM.Audio.sfx("psychic");
        const h = hand(p, up);
        w.later(0.08, () => w.combat.shoot({ kind: "psyknife", x: h.x, y: h.y, ...aim(p, up, 950), r: 9, dmg: dmgS(p, 1.45), life: 0.9, pierce: true, stun: 0.5, power: true, color: "#ff4fe0" }));
      },
      ultimate(p, w) {
        p.act("ultimate", "spin", 1.6);
        p.power = 1;
        XM.Audio.sfx("psychic");
        let t = 0;
        let tick = 0;
        w.addAction({
          update: (dt) => {
            t += dt;
            tick -= dt;
            const r = 40 + Math.min(1, t / 0.8) * 340;
            if (tick <= 0) {
              tick = 0.12;
              w.combat.aoe(p.cx, p.cy, r, dmgU(p, 0.3), { kb: 40, power: true, color: "#ff4fe0", hitstop: 0 });
              XM.Audio.sfx("slash");
            }
            return t < 1.55;
          },
          draw: (ctx) => {
            const r = 40 + Math.min(1, t / 0.8) * 340;
            ctx.globalAlpha = 0.25;
            ctx.strokeStyle = "#ff4fe0";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.cx, p.cy, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            for (let i = 0; i < 10; i++) {
              const a = t * 7 + (i / 10) * Math.PI * 2;
              const rr = r * (0.4 + (i % 3) * 0.3);
              const x = p.cx + Math.cos(a) * rr;
              const y = p.cy + Math.sin(a) * rr * 0.75;
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate(a + Math.PI / 2);
              A.glow(ctx, 0, 0, 22, "#ff4fe0", 0.8);
              A.poly(ctx, [0, -16, 5, 0, 0, 16, -5, 0], "#ffd9fb", true, 1.5);
              ctx.restore();
            }
          },
        });
      },
    },

    // ===================== JUBILEE =====================
    jubilee: {
      basic(p, w, c, up) {
        p.act("attack", up ? "aimUp" : "blast", 0.22);
        XM.Audio.sfx("firework");
        const h = hand(p, up);
        const col = ["#ff5ad9", "#ffe14a", "#5ad9ff"][c];
        w.later(0.05, () => w.combat.shoot({ kind: "firework", x: h.x, y: h.y, ...aim(p, up, 600), r: 7, dmg: dmgB(p, c) * 0.7, life: 0.55, explode: c === 2 ? 54 : 34, color: col }));
      },
      special(p, w) {
        p.act("special", "wave", 0.42);
        w.later(0.12, () => {
          const x = p.cx + p.facing * 70;
          const y = p.cy;
          w.combat.aoe(x, y, 115, dmgS(p, 1.55), { kb: 320, power: true, launch: 220, color: "#ff5ad9" });
          XM.FX.burst(x, y, { count: 40, colors: ["#ff5ad9", "#ffe14a", "#5ad9ff", "#ffffff"], speed: 380, life: 0.6, type: XM.FX.T.STAR, size: 5 });
          XM.FX.ring(x, y, 115, "#ffe14a", 0.4, 8);
          XM.FX.shake(4, 0.2);
          XM.Audio.sfx("firework");
          XM.Audio.sfx("explosion");
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "rise", 1.8);
        p.power = 1;
        const list = targets(w);
        const cols = ["#ff5ad9", "#ffe14a", "#5ad9ff", "#7dff7a", "#ff8a3d"];
        for (let i = 0; i < 12; i++) {
          w.later(0.2 + i * 0.09, () => {
            XM.Audio.sfx("firework");
            const e = list.length ? list[i % list.length] : null;
            const tx = e && !e.dead ? e.x + e.w / 2 : w.cam.x + U.rand(80, XM.VIEW.w - 80);
            const ty = e && !e.dead ? e.y + e.h / 2 : w.cam.y + U.rand(80, 260);
            const col = cols[i % cols.length];
            let t = 0;
            const sx = p.cx;
            const sy = p.y;
            w.addAction({
              update: (dt) => {
                t += dt;
                if (t >= 0.45) {
                  w.combat.aoe(tx, ty, 95, dmgU(p, 0.85), { kb: 160, power: true, color: col, hitstop: 0 });
                  XM.FX.burst(tx, ty, { count: 34, colors: [col, "#ffffff"], speed: 360, life: 0.8, type: XM.FX.T.STAR, size: 5, grav: 120 });
                  XM.FX.ring(tx, ty, 95, col, 0.4, 6);
                  XM.Audio.sfx("explosion");
                  return false;
                }
                return true;
              },
              draw: (ctx) => {
                const k = t / 0.45;
                const x = U.lerp(sx, tx, k);
                const y = U.lerp(sy, ty, k) - Math.sin(k * Math.PI) * 120;
                A.glow(ctx, x, y, 14, col, 1);
                XM.FX.spawn(XM.FX.T.STAR, x, y, 0, 30, 0.3, 3, col);
              },
            });
          });
        }
        XM.FX.flash("#ffe14a", 0.2);
      },
    },

    // ===================== PROFESSOR X =====================
    professorx: {
      basic(p, w, c, up) {
        p.act("attack", "temple", 0.28);
        XM.Audio.sfx("psychic");
        const h = hand(p, up);
        w.later(0.08, () => w.combat.shoot({ kind: "xbolt", x: h.x, y: h.y, ...aim(p, up, 560), r: c === 2 ? 9 : 7, dmg: dmgB(p, c), life: 1.1, homing: 5, color: "#7fd0ff", kb: 120 }));
      },
      special(p, w) {
        p.act("special", "temple", 0.5);
        p.power = 1;
        XM.Audio.sfx("psychic");
        expandingRing(w, p.cx, p.cy, 330, 0.5, "#7fd0ff", (e) => {
          w.combat.hitEnemy(e, dmgS(p, 0.95), { kb: 60, stun: 0.4, confuse: 3.2, power: true, color: "#7fd0ff" }, p.cx);
        });
      },
      ultimate(p, w) {
        p.act("ultimate", "temple", 1.7);
        p.power = 1;
        XM.Audio.sfx("charge");
        const list = targets(w);
        let t = 0;
        w.addAction({
          update: (dt) => (t += dt) < 1.4,
          draw: (ctx) => {
            const k = Math.min(1, t / 0.4);
            ctx.globalAlpha = (1 - Math.max(0, t - 1.0) / 0.4) * 0.8;
            ctx.strokeStyle = "#9fe8ff";
            ctx.lineWidth = 2;
            for (const e of list) {
              const ex = e.x + e.w / 2;
              const ey = e.y + e.h / 3;
              ctx.beginPath();
              ctx.moveTo(p.cx, p.y + 10);
              ctx.lineTo(U.lerp(p.cx, ex, k), U.lerp(p.y + 10, ey, k));
              ctx.stroke();
              if (k >= 1) A.glow(ctx, ex, ey, 30, "#7fd0ff", 0.7);
            }
            ctx.globalAlpha = 1;
            A.glow(ctx, p.cx, p.y + 10, 70 + Math.sin(t * 20) * 8, "#7fd0ff", 0.7);
          },
        });
        w.later(0.45, () => {
          for (const e of list) w.combat.hitEnemy(e, dmgU(p, 2.6), { kb: 0, stun: 4, power: true, color: "#7fd0ff", hitstop: 0 }, e.x);
          XM.FX.flash("#bfe9ff", 0.5, 1.5);
          XM.FX.shake(6, 0.5);
          XM.Audio.sfx("psychic");
          expandingRing(w, p.cx, p.cy, XM.VIEW.w, 0.6, "#7fd0ff", () => {}, 12);
        });
      },
    },
  };

  XM.Abilities = Abilities;
})(window.XM);
