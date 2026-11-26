/*
 * The world of a level in play: builds the level, spawns enemies as the camera nears
 * them, runs arenas, checkpoints, hazards, objectives, secrets and the boss fight,
 * keeps score, and draws everything in order.
 */
(function (XM) {
  "use strict";
  const U = XM.U;
  const A = XM.Art;
  const T = XM.T;
  const TL = XM.TILE;
  const LIVES = 3;

  const OBJECTIVE_TEXT = {
    cell: { verb: "Free prisoner", done: "Freed!" },
    console: { verb: "Disable tower", done: "Offline!" },
    student: { verb: "Rescue student", done: "Rescued!" },
    tablet: { verb: "Read tablet", done: "Translated!" },
  };
  const TABLET_LORE = ["\"The engine of change fell from the stars...\"", "\"...and broke into a thousand waking seeds.\"", "\"Whoever binds the seeds binds the future.\""];

  class World {
    constructor(app, levelIndex, charId) {
      this.app = app;
      this.levelIndex = levelIndex;
      this.def = XM.LEVELS[levelIndex];
      this.level = XM.LevelBuilder.build(levelIndex);
      this.theme = this.level.theme;
      const q = XM.Save.data.settings.quality;
      this.bg = XM.BG.build(this.def.theme, q);
      this.tiles = XM.tileSet(this.def.theme);
      XM.Weather.init(this.theme.weather, q);
      this.cam = new XM.Camera();
      this.cam.setBounds(this.level.W * T, this.level.H * T);
      this.combat = new XM.Combat(this);
      this.platforms = this.level.platforms;
      this.enemies = [];
      this.actions = [];
      this.timers = [];
      this.debugRects = [];
      this.pickups = this.level.pickups.map((p) => new XM.Pickup(p.kind, p.x, p.y, { index: p.index }));
      this.pendingSpawns = this.level.spawns.slice().sort((a, b) => a.x - b.x);
      this.gravityScale = this.theme.gravity || 1;
      this.gravityT = 0;
      this.t = 0;
      this.lives = LIVES;
      this.state = "play";
      this.stateT = 0;
      this.checkpoint = null;
      this.boss = null;
      this.bossDef = this.level.boss;
      this.messageT = 0;
      this.message = "";
      this.sealHintT = 0;
      this.playerSlow = 0;
      this.ultT = 0;
      this.ultKills = 0;
      this.bossBanner = 0;
      const save = XM.Save.data.levels[levelIndex];
      this.stats = {
        score: 0,
        kills: 0,
        sentinelKills: 0,
        orbs: 0,
        orbsTotal: this.level.pickups.filter((p) => p.kind === "orb").length + this.countCrateOrbs(),
        x: [false, false, false],
        xBefore: save.x.slice(),
        secrets: 0,
        secretsTotal: this.level.secrets.length,
        damage: 0,
        time: 0,
        maxCombo: 0,
        specials: 0,
        tokens: 0,
        xp: 0,
        bossDamage: 0,
        rare: false,
        objectives: 0,
      };
      this.objectiveTotal = this.level.objectives;
      this.player = new XM.Player(this, charId);
      const sp = this.level.spawn;
      this.player.spawnAt(sp.x, sp.y);
      this.cam.snap(this.player);
      // Boss levels with objectives keep the arena gate shut until they're done.
      if (this.bossDef && this.objectiveTotal) this.setGate(this.bossDef.gate, this.bossDef.rows, true);
      this.potential = this.computePotential();
    }

    countCrateOrbs() {
      let n = 0;
      for (const c of this.level.crates.values()) if (c === "orbs") n += 3;
      return n;
    }

    computePotential() {
      const L = this.level;
      let enemies = 0;
      for (const s of L.spawns) enemies += XM.ENEMY_TYPES[s.type].score;
      for (const a of L.arenas) for (const w of a.waves) for (const t of w) enemies += XM.ENEMY_TYPES[t].score;
      return this.stats.orbsTotal * 100 + enemies + 3000 + L.secrets.length * 750 + 5000 + 3000 + 5000 + (L.boss ? 10000 : 0);
    }

    // ---------- helpers used by abilities and entities ----------
    later(delay, fn) {
      this.timers.push({ t: delay, fn });
    }
    addAction(a) {
      this.actions.push(a);
    }
    spawnEnemy(type, x, y) {
      const e = new XM.Enemy(this, type, x, y);
      this.enemies.push(e);
      const seen = XM.Save.data.seen.enemies;
      if (!e.prop && !seen.includes(type)) seen.push(type);
      return e;
    }
    say(text, time = 2.2) {
      this.message = text;
      this.messageT = time;
    }
    addScore(n, x, y) {
      this.stats.score += n;
      if (x !== undefined && n >= 100) XM.FX.text(x, y, `+${n}`, "#ffe9a0", 12, 0.6, -50);
    }
    slowPlayer(t) {
      this.playerSlow = Math.max(this.playerSlow, t);
    }
    startUltimate() {
      this.ultT = 2.6;
      this.ultKills = 0;
    }
    addIceRamp(x, y) {
      this.platforms.push({ x: x - 34, y: y + 4, w: 68, h: 10, temp: 1.4, ice: true, dx: 0, dy: 0, active: true });
    }
    setGate(col, rows, closed) {
      const L = this.level;
      for (let r = rows[0]; r <= rows[1]; r++) {
        const i = r * L.W + col;
        if (closed) {
          if (L.tiles[i] === TL.EMPTY) L.tiles[i] = TL.GATE;
        } else if (L.tiles[i] === TL.GATE) L.tiles[i] = TL.EMPTY;
      }
    }

    breakTile(tx, ty, code) {
      const L = this.level;
      L.tiles[ty * L.W + tx] = TL.EMPTY;
      const cx = (tx + 0.5) * T;
      const cy = (ty + 0.5) * T;
      XM.FX.burst(cx, cy, { count: 14, colors: code === TL.SEAL ? ["#7ae8ff", "#3a4a6a", "#ffffff"] : ["#a8743a", "#6a4420", "#d8a868"], speed: 260, life: 0.6, type: XM.FX.T.SHARD, grav: 900, size: 4 });
      XM.Audio.sfx("break");
      this.addScore(code === TL.SEAL ? 300 : 50, cx, cy - 10);
      const content = L.crates.get(`${tx},${ty}`);
      if (!content) return;
      const drop = (kind, opts = {}) => this.pickups.push(new XM.Pickup(kind, cx, cy, Object.assign({ dropped: true, vx: U.rand(-80, 80), vy: -260 }, opts)));
      if (typeof content === "object" && content.kind === "xsymbol") {
        this.pickups.push(new XM.Pickup("xsymbol", cx, cy - 10, { index: content.index }));
        XM.FX.text(cx, cy - 30, "AN X SYMBOL!", "#ffe14a", 16, 1.2);
      } else if (content === "orbs") for (let i = 0; i < 3; i++) drop("orb");
      else drop(content);
    }

    collectX(index, x, y) {
      if (this.stats.x[index]) return;
      this.stats.x[index] = true;
      const n = this.stats.x.filter(Boolean).length;
      XM.Audio.sfx("xsymbol");
      XM.FX.flash("#ffe14a", 0.35, 2);
      XM.FX.ring(x, y, 80, "#ffe14a", 0.5, 6);
      XM.FX.burst(x, y, { count: 30, colors: ["#ffe14a", "#ffffff", "#c4161c"], speed: 320, life: 0.8, type: XM.FX.T.STAR, size: 5 });
      XM.FX.text(x, y - 30, `X SYMBOL ${n}/3`, "#ffe14a", 22, 1.6);
      this.app.hud.toast("X Symbol found!", `${n} of 3 in this level${this.stats.xBefore[index] ? " (already collected before)" : ""}`, "x");
    }

    collectRare(x, y) {
      const save = XM.Save.data.levels[this.levelIndex];
      XM.Audio.sfx("unlock");
      XM.FX.burst(x, y, { count: 24, colors: ["#d8a8ff", "#ffffff"], speed: 260, life: 0.7, type: XM.FX.T.STAR });
      if (!save.rare && !this.stats.rare) {
        this.stats.rare = true;
        XM.FX.text(x, y - 30, "RARE UPGRADE CORE! +1 POINT", "#d8a8ff", 16, 1.8);
        this.app.hud.toast("Rare Upgrade Core", "+1 upgrade point when you clear this level", "rare");
      } else XM.FX.text(x, y - 30, "+1,500", "#d8a8ff", 16, 1.2);
    }

    tryInteract(p) {
      const it = this.nearInteractable(p);
      if (!it) return;
      it.done = true;
      it.doneT = 0;
      this.stats.objectives++;
      const info = OBJECTIVE_TEXT[it.kind];
      XM.Audio.sfx("confirm");
      XM.FX.text(it.x, it.y - 80, info.done, "#7aff9a", 18, 1.2);
      this.addScore(1500, it.x, it.y - 60);
      if (it.kind === "cell" || it.kind === "student") {
        XM.FX.smoke(it.x, it.y - 30, 12, it.kind === "cell" ? "#3a2a5a" : "#7fd0ff");
        XM.Audio.sfx("teleport");
      } else if (it.kind === "console") {
        XM.FX.burst(it.x, it.y - 40, { count: 20, color: "#ffcf5a", speed: 260, life: 0.5 });
        XM.Audio.sfx("explosion");
      } else if (it.kind === "tablet") {
        const lore = TABLET_LORE[Math.min(TABLET_LORE.length - 1, this.stats.objectives - 1)];
        this.say(lore, 4);
        XM.Audio.sfx("secret");
      }
      this.objectiveProgress();
    }

    objectiveProgress() {
      if (!this.objectiveTotal) return;
      const done = this.stats.objectives;
      if (done >= this.objectiveTotal) {
        this.say("Objective complete!", 2.5);
        XM.Audio.sfx("unlock");
        if (this.bossDef) {
          this.setGate(this.bossDef.gate, this.bossDef.rows, false);
          this.say("Objective complete! The way forward is open.", 3);
        }
      } else this.say(`${this.def.objective.label}: ${done}/${this.objectiveTotal}`, 2);
    }

    nearInteractable(p) {
      for (const it of this.level.interactables) {
        if (!it.done && Math.abs(it.x - p.cx) < 50 && Math.abs(it.y - (p.y + p.h)) < 70) return it;
      }
      return null;
    }

    onEnemyKilled(e, opts = {}) {
      const s = this.stats;
      if (e.isBoss) return;
      if (e.objective) {
        s.objectives++;
        this.addScore(e.def.score, e.cx, e.y);
        this.objectiveProgress();
        return;
      }
      if (e.prop) {
        this.addScore(e.def.score, e.cx, e.y);
        return;
      }
      s.kills++;
      if (e.sentinel) s.sentinelKills++;
      s.xp += e.def.xp;
      this.addScore(e.def.score, e.cx, e.y);
      if (this.ultT > 0) this.ultKills++;
      // Occasional drops
      const r = Math.random();
      const drop = r < 0.1 ? "health" : r < 0.18 ? "energy" : r < 0.22 ? "ult" : r < 0.5 ? "orb" : null;
      if (drop) {
        const pk = new XM.Pickup(drop, e.cx, e.cy, { dropped: true, vx: U.rand(-60, 60), vy: -240, life: drop === "orb" ? 12 : 20 });
        this.pickups.push(pk);
        if (drop === "orb") this.stats.orbsTotal++;
      }
      if (!XM.Save.data.seen.enemies.includes(e.type)) XM.Save.data.seen.enemies.push(e.type);
    }

    onBossDown(b) {
      XM.Audio.sfx("bossDie");
      XM.FX.flash("#ffffff", 0.8, 1);
      XM.FX.shake(12, 1.2);
      XM.FX.stop(0.25);
      this.stats.bossDefeated = true;
      this.addScore(5000, b.cx, b.y);
      for (const e of this.enemies) if (!e.dead && e.summoned) e.die();
      this.combat.clear();
      this.state = "bossDown";
      this.stateT = 0;
      this.player.invuln = 99;
      XM.Audio.stopMusic();
    }

    onPlayerDown() {
      this.state = "down";
      this.stateT = 0;
      XM.Save.data.stats.deaths++;
      XM.Audio.music("defeat");
    }

    respawn() {
      const p = this.player;
      let x;
      let y;
      if (this.boss && !this.boss.dead) {
        x = this.boss.arena.x0 + 60;
        y = this.boss.arena.floor;
      } else if (this.checkpoint) {
        x = this.checkpoint.x - p.w / 2;
        y = this.checkpoint.y;
      } else {
        x = this.level.spawn.x;
        y = this.level.spawn.y;
      }
      p.spawnAt(x, y);
      p.dead = false;
      p.hp = p.st.maxHp;
      p.energy = p.st.maxEnergy;
      p.invuln = 2.5;
      p.lockT = 0;
      p.actState = "";
      p.hidden = false;
      this.combat.clear();
      // Arena fights restart from the current wave without a softlock.
      this.cam.snap(p);
      this.state = "play";
      XM.FX.ring(p.cx, p.cy, 60, "#ffffff");
      XM.Audio.music(this.boss && !this.boss.dead ? this.bossMusic() : this.theme.music);
    }

    bossMusic() {
      return this.levelIndex >= 18 ? "finalboss" : "boss";
    }

    // ---------- update ----------
    update(dt, input) {
      this.t += dt;
      this.stateT += dt;
      const p = this.player;
      if (this.state === "play" || this.state === "bossDown") this.stats.time += dt;
      this.messageT = Math.max(0, this.messageT - dt);
      this.sealHintT = Math.max(0, this.sealHintT - dt);
      this.playerSlow = Math.max(0, this.playerSlow - dt);
      this.bossBanner = Math.max(0, this.bossBanner - dt);
      if (this.ultT > 0) {
        this.ultT -= dt;
        if (this.ultT <= 0) {
          const s = XM.Save.data.stats;
          s.ultMultiKill = Math.max(s.ultMultiKill, this.ultKills);
        }
      }

      // Gravity shifts in the Nexus Dimension
      if (this.theme.gravityShift) {
        this.gravityT += dt;
        if (this.gravityT > 8) {
          this.gravityT = 0;
          this.gravityScale = this.gravityScale < 1 ? 1 : 0.55;
          XM.FX.flash("#b07aff", 0.3);
          this.say(this.gravityScale < 1 ? "GRAVITY SHIFT: Low gravity!" : "GRAVITY SHIFT: Normal gravity", 1.8);
          XM.Audio.sfx("magnet");
        }
      }

      // Timers and actions
      for (let i = this.timers.length - 1; i >= 0; i--) {
        const tm = this.timers[i];
        tm.t -= dt;
        if (tm.t <= 0) {
          this.timers.splice(i, 1);
          tm.fn();
        }
      }
      XM.Physics.updatePlatforms(this.platforms, dt);
      for (let i = this.platforms.length - 1; i >= 0; i--) {
        const pl = this.platforms[i];
        if (pl.temp !== undefined) {
          pl.temp -= dt;
          if (pl.temp <= 0) this.platforms.splice(i, 1);
        }
      }

      if (this.state === "down") {
        p.update(dt, input);
        if (this.stateT > 1.6) {
          this.lives--;
          if (this.lives > 0) this.respawn();
          else {
            this.state = "gameover";
            this.app.gameOver(this);
          }
        }
      } else if (this.state === "play" || this.state === "bossDown" || this.state === "victory") {
        p.update(dt, input);
      }
      if (p.dead && this.state === "play") this.state = "down";

      // Falling into a pit
      if (!p.dead && p.y > this.level.H * T + 40) {
        p.invuln = 0;
        p.hurt(p.st.maxHp * 0.15, p.cx, { unblockable: true, hazard: true });
        if (!p.dead) {
          p.x = p.safe.x;
          p.y = p.safe.y;
          p.vx = p.vy = 0;
          p.invuln = 1.5;
          XM.FX.ring(p.cx, p.cy, 50, "#ffffff");
        }
      }

      // Spawn enemies as the camera approaches
      const spawnEdge = this.cam.x + XM.VIEW.w + 160;
      while (this.pendingSpawns.length && this.pendingSpawns[0].x < spawnEdge) {
        const s = this.pendingSpawns.shift();
        this.spawnEnemy(s.type, s.x, s.y);
      }

      // Enemies (far-away ones sleep)
      for (const e of this.enemies) {
        if (e.x < this.cam.x - 900 && !e.arena && !e.isBoss) continue;
        if (e.x > this.cam.x + XM.VIEW.w + 600 && !e.arena) continue;
        e.update(dt, this);
      }
      this.enemies = this.enemies.filter((e) => !(e.dead && e.deathT > 0.6 && !e.isBoss));

      this.combat.update(dt);
      for (const pk of this.pickups) pk.update(dt, this);
      this.pickups = this.pickups.filter((pk) => !pk.taken);
      for (let i = this.actions.length - 1; i >= 0; i--) {
        const a = this.actions[i];
        if (!a.update(dt)) this.actions.splice(i, 1);
      }
      this.updateLevelObjects(dt, p);
      this.updateArenas(p);
      this.updateBoss(p);
      XM.FX.update(dt);
      const oldCam = this.cam.x;
      if (!p.dead) this.cam.follow(p, dt);
      XM.Weather.update(dt, this.cam.x - oldCam);
      if (XM.DEBUG) {
        for (const r of this.debugRects) r.t -= dt;
        this.debugRects = this.debugRects.filter((r) => r.t > 0);
      }
    }

    updateLevelObjects(dt, p) {
      const L = this.level;
      // Checkpoints
      for (const c of L.checkpoints) {
        if (!c.active && p.cx > c.x - 10 && !p.dead) {
          for (const o of L.checkpoints) if (o.x < c.x) o.active = true;
          c.active = true;
          this.checkpoint = c;
          XM.Audio.sfx("checkpoint");
          XM.FX.text(c.x, c.y - 90, "CHECKPOINT", "#7aff9a", 18, 1.4);
          p.heal(p.st.maxHp * 0.2);
          XM.Save.write();
        }
      }
      // Secret rooms
      for (const s of L.secrets) {
        if (!s.found && U.overlap(s, p)) {
          s.found = true;
          this.stats.secrets++;
          this.addScore(750, p.cx, p.y - 20);
          XM.Audio.sfx("secret");
          XM.FX.text(p.cx, p.y - 40, "SECRET AREA!", "#d8a8ff", 20, 1.6);
        }
        s.inside = U.overlap(s, p);
      }
      // Laser gates
      for (const lz of L.lasers) {
        const ph = ((this.t + lz.offset) % lz.period) / lz.period;
        lz.state = ph < lz.on ? "on" : ph > 1 - 0.18 ? "warn" : "off";
        if (lz.state === "on" && !p.dead) {
          const r = { x: lz.x - 7, y: lz.y0, w: 14, h: lz.y1 - lz.y0 };
          if (U.overlap(r, p)) p.hurt(Math.max(10, p.st.maxHp * 0.14), lz.x - p.facing * 10, { hazard: true });
        }
      }
      // Falling debris
      for (const d of L.debris) {
        if (p.cx < d.x0 - 300 || p.cx > d.x1 + 300) continue;
        d.timer -= dt;
        if (d.timer <= 0) {
          d.timer = U.rand(0.8, 1.4);
          const x = U.clamp(p.cx + U.rand(-220, 220), d.x0, d.x1);
          const groundY = L.g * T;
          let t = 0;
          this.addAction({
            update: (dt2) => (t += dt2) < 0.7,
            draw: (ctx) => {
              ctx.globalAlpha = 0.25 + 0.3 * (t / 0.7);
              ctx.fillStyle = "#000";
              ctx.beginPath();
              ctx.ellipse(x, groundY - 2, 10 + t * 20, 4, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1;
            },
          });
          this.combat.enemyShoot({ kind: "rock", x, y: this.cam.y - 30, vx: 0, vy: 700, r: 13, dmg: 12 + this.levelIndex * 1.2, life: 2, delay: 0.35, color: "#7a6a58", ghost: true });
        }
      }
      // Objective interact prompt for touch players
      XM.Input.setInteractVisible(!!this.nearInteractable(p));
      // Exit
      const ex = L.exit;
      if (ex && this.state === "play" && !p.dead && Math.abs(p.cx - ex.x) < 40 && p.y + p.h > ex.y - 100) {
        if (this.objectiveTotal && this.stats.objectives < this.objectiveTotal) {
          if (this.messageT <= 0) this.say(`${this.def.objective.label} first! (${this.stats.objectives}/${this.objectiveTotal})`, 2);
        } else this.beginVictory();
      }
      // Locked boss gate hint
      const bd = this.bossDef;
      if (bd && !bd.started && this.objectiveTotal && this.stats.objectives < this.objectiveTotal && p.cx > (bd.gate - 2) * T && this.messageT <= 0) {
        this.say(`${this.def.objective.label} first! (${this.stats.objectives}/${this.objectiveTotal})`, 2);
      }
    }

    updateArenas(p) {
      for (const a of this.level.arenas) {
        if (a.done) continue;
        if (!a.active) {
          if (p.cx > a.trigger && p.cx < a.x1 - 80 && !p.dead) {
            a.active = true;
            a.wave = -1;
            this.setGate(a.gates[0], a.rows, true);
            this.setGate(a.gates[1], a.rows, true);
            this.cam.lock = { x0: a.x0, x1: a.x1 };
            XM.Audio.sfx("alarm");
            this.say("AMBUSH! Defeat every enemy!", 2);
            this.nextWave(a);
          }
          continue;
        }
        const alive = this.enemies.some((e) => e.arena === a && !e.dead);
        if (!alive) {
          if (a.wave + 1 < a.waves.length) this.nextWave(a);
          else {
            a.done = true;
            a.active = false;
            this.setGate(a.gates[0], a.rows, false);
            this.setGate(a.gates[1], a.rows, false);
            this.cam.lock = null;
            XM.Audio.sfx("unlock");
            this.say("Area clear!", 1.6);
            this.addScore(1000, p.cx, p.y - 30);
            this.pickups.push(new XM.Pickup("health", a.reward.x, a.reward.y));
            for (let i = 0; i < 5; i++) {
              this.pickups.push(new XM.Pickup("orb", a.reward.x + (i - 2) * 30, a.reward.y - 40, { dropped: true, vx: (i - 2) * 30, vy: -300 }));
              this.stats.orbsTotal++;
            }
          }
        }
      }
    }

    nextWave(a) {
      a.wave++;
      const wave = a.waves[a.wave];
      wave.forEach((type, i) => {
        this.later(i * 0.25, () => {
          const col = U.randi(a.cols[0], a.cols[1]);
          let x = (col + 0.5) * T;
          if (Math.abs(x - this.player.cx) < 100) x += this.player.cx < x ? 140 : -140;
          x = U.clamp(x, a.x0 + 60, a.x1 - 60);
          const e = this.spawnEnemy(type, x, this.level.g * T);
          e.arena = a;
          e.aggro = true;
          XM.FX.smoke(e.cx, e.cy, 8, "#4a3a6a");
          XM.FX.ring(e.cx, e.cy, 40, "#ff5a5a");
        });
      });
      if (a.wave > 0) this.say(`Wave ${a.wave + 1}!`, 1.2);
    }

    updateBoss(p) {
      const bd = this.bossDef;
      if (!bd) return;
      if (!bd.started) {
        const locked = this.objectiveTotal && this.stats.objectives < this.objectiveTotal;
        if (!locked && p.cx > bd.trigger && !p.dead) {
          bd.started = true;
          this.setGate(bd.gate, bd.rows, true);
          this.cam.lock = { x0: bd.arena.x0 - T, x1: bd.arena.x1 };
          this.boss = new XM.Boss(this, bd.id, bd.arena);
          this.enemies.push(this.boss);
          this.bossBanner = 3.2;
          XM.Audio.music(this.bossMusic());
          XM.Audio.sfx("roar");
          XM.FX.shake(6, 0.5);
          const seen = XM.Save.data.seen.bosses;
          const sid = this.boss.def.statId || this.boss.def.id;
          if (!seen.includes(sid)) seen.push(sid);
          this.app.hud.bossIntro(this.boss);
          // Clear the path of stragglers.
          for (const e of this.enemies) if (!e.isBoss && !e.dead && e.x > bd.arena.x0 - 200) e.die();
        }
        return;
      }
      if (this.state === "bossDown" && this.stateT > 2.6) this.beginVictory();
    }

    beginVictory() {
      if (this.state === "victory") return;
      this.state = "victory";
      this.stateT = 0;
      const p = this.player;
      p.victory = true;
      p.stateT = 0;
      p.invuln = 99;
      p.lockT = 0;
      p.hidden = false;
      XM.Audio.music("victory");
      this.later(2.6, () => this.app.levelComplete(this));
    }

    // Final level score and rewards (the app applies them to the save).
    results() {
      const s = this.stats;
      const par = this.level.par;
      const timeBonus = Math.round(U.clamp((par * 1.6 - s.time) / (par * 0.6), 0, 1) * 5000);
      const healthBonus = Math.round(Math.max(0, 3000 - s.damage * 8));
      const noDamage = s.damage === 0;
      const allX = s.x.every(Boolean);
      const xAllBonus = allX ? 5000 : 0;
      let bossBonus = 0;
      if (this.boss) bossBonus = 4000 + Math.round(6000 * U.clamp(1 - s.bossDamage / (this.player.st.maxHp * 2.5), 0, 1));
      const raw = s.score + timeBonus + healthBonus + xAllBonus + bossBonus + (noDamage ? 5000 : 0);
      const total = Math.min(XM.Leaderboard.LEVEL_CAP, raw);
      const ratio = total / this.potential;
      const stars = 1 + (ratio >= 0.5 ? 1 : 0) + (ratio >= 0.75 ? 1 : 0);
      const save = XM.Save.data.levels[this.levelIndex];
      const first = !save.cleared;
      const xp = Math.round(200 + 40 * (this.levelIndex + 1) + total / 40 + s.xp + (allX ? 500 : 0) + (first ? 300 : 0));
      return { level: this.def, index: this.levelIndex, stats: s, par, timeBonus, healthBonus, xAllBonus, bossBonus, noDamage, total, stars, first, xp, fast: s.time <= par, charId: this.player.id, boss: this.boss ? this.boss.def : null };
    }

    // ---------- draw ----------
    draw(ctx) {
      const cam = this.cam;
      const vw = XM.VIEW.w;
      const vh = XM.VIEW.h;
      XM.BG.draw(ctx, this.bg, cam.x, cam.y, this.t, this.level.H * T);
      ctx.save();
      const ox = Math.round(-cam.x + XM.FX.shakeX);
      const oy = Math.round(-cam.y + XM.FX.shakeY);
      ctx.translate(ox, oy);
      this.drawTiles(ctx, false);
      this.drawObjects(ctx);
      for (const pl of this.platforms) this.drawPlatform(ctx, pl);
      for (const pk of this.pickups) if (cam.visible(pk.x - 20, pk.y - 20, 40, 40)) pk.draw(ctx);
      for (const e of this.enemies) if (!e.isBoss && cam.visible(e.x, e.y, e.w, e.h)) e.draw(ctx, this);
      if (this.boss) this.boss.draw(ctx, this);
      if (!this.player.hidden) this.player.draw(ctx);
      this.combat.draw(ctx);
      for (const a of this.actions) if (a.draw) a.draw(ctx);
      XM.FX.draw(ctx, cam);
      this.drawTiles(ctx, true);
      if (XM.DEBUG) {
        ctx.strokeStyle = "#0f0";
        for (const r of this.debugRects) ctx.strokeRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = "#ff0";
        const p = this.player;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      }
      ctx.restore();
      XM.Weather.draw(ctx);
      for (const a of this.actions) if (a.drawScreen) a.drawScreen(ctx);
      if (this.state === "down") {
        ctx.fillStyle = `rgba(60,0,0,${Math.min(0.5, this.stateT * 0.4)})`;
        ctx.fillRect(0, 0, vw, vh);
      }
    }

    drawTiles(ctx, fakeOnly) {
      const L = this.level;
      const cam = this.cam;
      const x0 = Math.max(0, Math.floor(cam.x / T) - 1);
      const x1 = Math.min(L.W - 1, Math.ceil((cam.x + XM.VIEW.w) / T) + 1);
      const y0 = Math.max(0, Math.floor(cam.y / T) - 1);
      const y1 = Math.min(L.H - 1, Math.ceil((cam.y + XM.VIEW.h) / T) + 1);
      const ts = this.tiles;
      const t = this.t;
      for (let ty = y0; ty <= y1; ty++) {
        const row = ty * L.W;
        for (let tx = x0; tx <= x1; tx++) {
          const code = L.tiles[row + tx];
          if (!code) continue;
          const x = tx * T;
          const y = ty * T;
          if (fakeOnly) {
            if (code !== TL.FAKE) continue;
            const inside = L.secrets.some((s) => s.inside && Math.abs(s.x + s.w - x) < T * 2);
            ctx.globalAlpha = inside ? 0.3 : 1;
            const above = ty > 0 ? L.tiles[row - L.W + tx] : 0;
            ctx.drawImage(XM.Physics.solid(above) || above === TL.FAKE ? ts.body : ts.top, x, y);
            // A faint crack hints at the secret.
            ctx.strokeStyle = "rgba(0,0,0,0.35)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + 8, y + 4);
            ctx.lineTo(x + 16, y + 18);
            ctx.lineTo(x + 12, y + 30);
            ctx.stroke();
            ctx.globalAlpha = 1;
            continue;
          }
          switch (code) {
            case TL.SOLID: {
              const above = ty > 0 ? L.tiles[row - L.W + tx] : TL.SOLID;
              ctx.drawImage(XM.Physics.solid(above) || above === TL.FAKE ? ts.body : ts.top, x, y);
              break;
            }
            case TL.ONEWAY:
              ctx.drawImage(ts.oneway, x, y);
              break;
            case TL.HAZARD:
              ctx.drawImage(ts.hazard, x, y);
              if (this.theme.tile.hazard === "electric" || this.theme.tile.hazard === "nexus") {
                if (Math.random() < 0.05) XM.FX.spawn(XM.FX.T.SPARK, x + Math.random() * T, y + T - 14, (Math.random() - 0.5) * 120, -80, 0.2, 2, this.theme.tile.hazard === "nexus" ? "#ff5aff" : "#7ad0ff");
              }
              break;
            case TL.LADDER:
              ctx.drawImage(ts.ladder, x, y);
              break;
            case TL.CRATE:
              ctx.drawImage(ts.crate, x, y);
              break;
            case TL.SEAL:
              A.glow(ctx, x + T / 2, y + T / 2, 30 + Math.sin(t * 4) * 4, "#7ae8ff", 0.35);
              ctx.drawImage(ts.seal, x, y);
              break;
            case TL.GATE:
              ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 8);
              ctx.drawImage(ts.gate, x, y);
              ctx.globalAlpha = 1;
              break;
          }
        }
      }
    }

    drawPlatform(ctx, pl) {
      if (pl.active === false && !pl.crumble) return;
      const th = this.theme.tile;
      const x = pl.x + (pl.shake || 0);
      const y = pl.y;
      if (pl.ice) {
        ctx.globalAlpha = Math.min(1, pl.temp * 2);
        A.box(ctx, x, y, pl.w, pl.h, "#dff7ff", true, 4, 2);
        ctx.globalAlpha = 1;
        return;
      }
      if (pl.crumble) {
        if (pl.state === 2) ctx.globalAlpha = Math.max(0, 1 - pl.timer);
        A.box(ctx, x, y, pl.w, pl.h, th.top, true, 3, 2);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + pl.w * 0.3, y);
        ctx.lineTo(x + pl.w * 0.4, y + pl.h);
        ctx.moveTo(x + pl.w * 0.7, y);
        ctx.lineTo(x + pl.w * 0.6, y + pl.h);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      A.box(ctx, x, y, pl.w, pl.h + 6, th.body, true, 4, 2);
      ctx.fillStyle = th.top;
      ctx.fillRect(x + 2, y + 2, pl.w - 4, 5);
      A.glow(ctx, x + pl.w / 2, y + pl.h + 8, pl.w * 0.4, th.accent, 0.5);
      ctx.fillStyle = th.accent;
      ctx.fillRect(x + pl.w / 2 - 10, y + pl.h + 2, 20, 3);
    }

    drawObjects(ctx) {
      const L = this.level;
      const cam = this.cam;
      const t = this.t;
      const p = this.player;
      for (const s of L.signs) {
        if (!cam.visible(s.x - 120, s.y - 120, 240, 120)) continue;
        const text = XM.Input.usingTouch ? s.touch : s.keys;
        ctx.font = '700 13px Oxanium, "Trebuchet MS", sans-serif';
        const w = Math.min(300, ctx.measureText(text).width + 24);
        A.limb(ctx, s.x, s.y, s.x, s.y - 50, 4, "#5a4a3a");
        A.box(ctx, s.x - w / 2, s.y - 108, w, 58, "rgba(10,20,40,0.85)", true, 6, 2);
        ctx.strokeStyle = "#5ad0ff";
        ctx.lineWidth = 1;
        ctx.strokeRect(s.x - w / 2 + 4, s.y - 104, w - 8, 50);
        const lines = U.wrap(ctx, text, w - 20);
        lines.slice(0, 3).forEach((ln, i) => A.text(ctx, ln, s.x, s.y - 92 + i * 16 + (lines.length === 1 ? 12 : lines.length === 2 ? 6 : 0), 12, "#e8f6ff", "center", false, 700));
      }
      for (const c of L.checkpoints) {
        if (!cam.visible(c.x - 30, c.y - 100, 60, 100)) continue;
        A.limb(ctx, c.x, c.y, c.x, c.y - 90, 4, "#9aa3b2");
        const wave = Math.sin(t * 6) * (c.active ? 4 : 1);
        A.poly(ctx, [c.x + 2, c.y - 88, c.x + 40, c.y - 80 + wave, c.x + 2, c.y - 64], c.active ? "#ffd23f" : "#6a6e78", true, 2);
        if (c.active) {
          A.xLogo(ctx, c.x + 16, c.y - 77, 7, "#c4161c", "#ffd23f", false);
          A.glow(ctx, c.x, c.y - 90, 18, "#ffd23f", 0.6);
        }
      }
      for (const lz of L.lasers) {
        if (!cam.visible(lz.x - 20, lz.y0 - 40, 40, lz.y1 - lz.y0 + 40)) continue;
        A.box(ctx, lz.x - 12, lz.y0 - 6, 24, 12, "#3a3f4a", true, 3, 2);
        A.box(ctx, lz.x - 12, lz.y1 - 8, 24, 8, "#3a3f4a", true, 2, 2);
        if (lz.state === "on") {
          A.glow(ctx, lz.x, (lz.y0 + lz.y1) / 2, 40, "#ff3a3a", 0.4);
          ctx.fillStyle = "rgba(255,60,60,0.75)";
          ctx.fillRect(lz.x - 6, lz.y0 + 6, 12, lz.y1 - lz.y0 - 14);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(lz.x - 2, lz.y0 + 6, 4, lz.y1 - lz.y0 - 14);
        } else if (lz.state === "warn") {
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 40);
          ctx.fillStyle = "rgba(255,90,90,0.6)";
          ctx.fillRect(lz.x - 1, lz.y0 + 6, 2, lz.y1 - lz.y0 - 14);
          ctx.globalAlpha = 1;
        }
        A.circle(ctx, lz.x, lz.y0, 4, lz.state === "off" ? "#5a2a2a" : "#ff3a3a", true, 1);
      }
      for (const it of L.interactables) {
        if (!cam.visible(it.x - 50, it.y - 120, 100, 120)) continue;
        this.drawInteractable(ctx, it, t);
        if (!it.done && Math.abs(it.x - p.cx) < 50 && Math.abs(it.y - (p.y + p.h)) < 70) {
          const label = XM.Input.usingTouch ? "Tap USE" : `Press ${XM.Input.keyName(XM.Save.data.settings.keys.interact[0])}`;
          A.box(ctx, it.x - 70, it.y - 128, 140, 26, "#1a2a4a", true, 6, 2);
          A.text(ctx, `${label}: ${OBJECTIVE_TEXT[it.kind].verb}`, it.x, it.y - 115, 11, "#ffffff", "center", false);
        }
      }
      const ex = L.exit;
      if (ex && cam.visible(ex.x - 80, ex.y - 160, 160, 160)) {
        A.box(ctx, ex.x - 60, ex.y - 10, 120, 10, "#3a3f4a", true, 3, 2);
        A.glow(ctx, ex.x, ex.y - 60, 70 + Math.sin(t * 3) * 6, "#ffd23f", 0.35);
        ctx.fillStyle = "rgba(255,210,63,0.18)";
        ctx.beginPath();
        ctx.moveTo(ex.x - 50, ex.y - 10);
        ctx.lineTo(ex.x - 20, ex.y - 150);
        ctx.lineTo(ex.x + 20, ex.y - 150);
        ctx.lineTo(ex.x + 50, ex.y - 10);
        ctx.fill();
        ctx.save();
        ctx.translate(ex.x, ex.y - 90);
        ctx.scale(Math.cos(t * 2), 1);
        A.xLogo(ctx, 0, 0, 22);
        ctx.restore();
        A.text(ctx, "EXTRACTION", ex.x, ex.y - 130, 13, "#ffe14a", "center");
      }
    }

    drawInteractable(ctx, it, t) {
      const x = it.x;
      const y = it.y;
      switch (it.kind) {
        case "cell": {
          A.box(ctx, x - 30, y - 80, 60, 80, "#2a2e38", true, 3, 2);
          if (!it.done) {
            ctx.fillStyle = "#4a3a6a";
            ctx.beginPath();
            ctx.arc(x, y - 52, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(x - 8, y - 44, 16, 34);
            A.glow(ctx, x, y - 40, 30, "#7ad0ff", 0.3 + 0.1 * Math.sin(t * 3));
          }
          ctx.strokeStyle = "#9aa3b2";
          ctx.lineWidth = 3;
          const open = it.done ? 1 : 0;
          for (let i = 0; i < 5; i++) {
            const bx = x - 24 + i * 12 - open * 40;
            ctx.beginPath();
            ctx.moveTo(bx, y - 78);
            ctx.lineTo(bx, y - 2);
            ctx.stroke();
          }
          A.circle(ctx, x + 24, y - 40, 4, it.done ? "#3aff7a" : "#ff3a3a", true, 1);
          break;
        }
        case "console":
          A.box(ctx, x - 26, y - 70, 52, 70, "#3a3f4a", true, 4, 2);
          A.box(ctx, x - 20, y - 64, 40, 28, it.done ? "#123a1a" : "#3a0a0a", true, 2, 1.5);
          A.text(ctx, it.done ? "OFF" : "TX", x, y - 50, 12, it.done ? "#3aff7a" : "#ff5a3a", "center", false);
          A.limb(ctx, x, y - 70, x, y - 120, 3, "#9aa3b2");
          if (!it.done) A.glow(ctx, x, y - 122, 14 + Math.sin(t * 8) * 4, "#ff3a3a", 0.9);
          break;
        case "student":
          if (!it.done) {
            A.glow(ctx, x, y - 30, 40, "#7fd0ff", 0.35 + 0.1 * Math.sin(t * 3));
            ctx.fillStyle = "#6a4a8a";
            ctx.beginPath();
            ctx.arc(x, y - 40, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(x - 6, y - 33, 12, 24);
            ctx.strokeStyle = "rgba(127,208,255,0.7)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y - 30, 28, 0, Math.PI * 2);
            ctx.stroke();
          }
          A.poly(ctx, [x - 40, y, x - 30, y - 14, x - 10, y - 8, x + 4, y - 18, x + 30, y - 10, x + 40, y], "#6a5a50", true, 2);
          break;
        case "tablet":
          A.poly(ctx, [x - 26, y, x - 24, y - 70, x, y - 82, x + 24, y - 70, x + 26, y], "#8a7a5a", true, 2);
          ctx.strokeStyle = it.done ? "#ffe07a" : A.rgba("#ffe07a", 0.4 + 0.2 * Math.sin(t * 3));
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x - 14, y - 60 + i * 12);
            ctx.lineTo(x + 14, y - 60 + i * 12);
            ctx.stroke();
          }
          if (it.done) A.glow(ctx, x, y - 40, 50, "#ffe07a", 0.5);
          break;
      }
    }
  }

  XM.World = World;
  XM.OBJECTIVE_TEXT = OBJECTIVE_TEXT;
})(window.XM);
