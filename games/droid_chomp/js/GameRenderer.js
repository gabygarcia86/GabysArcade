/*
 * GameRenderer draws one frame of whatever state the game is in. It only reads game
 * state, and it never changes it.
 */
(function (D) {
  const { TAU } = D;
  const { NORMAL, FRIGHT, FRIGHT_FLASH } = D.Sprites;
  const FLASH_WINDOW = 2.2; // Seconds of warning before a power-up ends.
  const STAR_COUNT = 150;

  class GameRenderer {
    constructor(game) {
      this.game = game;
      this.c = game.ctx;
      this.starSeed = [];
      const rng = D.seeded(4242);
      for (let i = 0; i < STAR_COUNT; i++) this.starSeed.push({ x: rng(), y: rng(), z: rng() });
    }

    render() {
      const { game, c } = this;
      const { view, state, anim } = game;
      c.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

      if (state === "menu") {
        this.drawAttract(game.clock);
      } else if (state === "galaxy") {
        this.drawGalaxy(game.clock, game.stateTime);
      } else {
        this.drawPlayfield();
      }
      anim.drawParticles(c);
      anim.drawPopups(c, Math.max(13, view.tile * 0.74));

      if (anim.flash > 0) {
        c.globalAlpha = Math.min(1, anim.flash);
        c.fillStyle = anim.flashColor;
        c.fillRect(0, 0, view.W, view.H);
        c.globalAlpha = 1;
      }
    }

    /* ---------- Gameplay ---------- */

    drawPlayfield() {
      const { game, c } = this;
      const { view, art, anim, state, stateTime, clock } = game;
      const { W, H, boardX, boardY, boardW, boardH } = view;

      c.drawImage(art.backdropCanvas, 0, 0, W, H);

      c.save();
      if (anim.shake > 0) c.translate((Math.random() - 0.5) * anim.shake, (Math.random() - 0.5) * anim.shake);
      c.translate(boardX, boardY);
      c.save();
      c.beginPath();
      c.rect(0, 0, boardW, boardH);
      c.clip();
      c.drawImage(art.boardCanvas, 0, 0, boardW, boardH);
      art.drawLights(c, clock);
      this.drawItems(clock);

      if (state === "clear" || state === "gameover") {
        this.drawDanceFloor();
      } else {
        this.drawActors();
      }
      c.restore();
      c.restore();

      art.drawAmbient(c, clock, W, H);
      if (state === "ready") this.drawReady(stateTime);
    }

    drawItems(t) {
      const { game, c } = this;
      const { maze, art, view } = game;
      const s = view.tile;
      const frames = art.gearFrames;
      const frame = Math.floor(t * 9) % frames.length;
      const gearSize = frames[0].width / view.dpr;
      const power = art.powerSprite;
      const pulse = 1 + Math.sin(t * 6) * 0.14;
      const powerSize = (power.width / view.dpr) * pulse;
      for (let y = 0; y < maze.rows; y++) {
        for (let x = 0; x < maze.cols; x++) {
          const item = maze.itemAt(x, y);
          if (item === D.Maze.NONE) continue;
          const px = (x + 0.5) * s;
          const py = (y + 0.5) * s;
          if (item === D.Maze.GEAR) {
            c.drawImage(frames[frame], px - gearSize / 2, py - gearSize / 2, gearSize, gearSize);
          } else {
            c.drawImage(power, px - powerSize / 2, py - powerSize / 2, powerSize, powerSize);
          }
        }
      }
    }

    // Draws at both ends of a tunnel while an actor is crossing the edge.
    drawWrapped(x, y, draw) {
      const { game } = this;
      const s = game.view.tile;
      const cols = game.maze.cols;
      draw((x + 0.5) * s, (y + 0.5) * s);
      if (x < 0) draw((x + cols + 0.5) * s, (y + 0.5) * s);
      else if (x > cols - 1) draw((x - cols + 0.5) * s, (y + 0.5) * s);
    }

    drawActors() {
      const { game, c } = this;
      const { player, enemies, sprites, state, stateTime, view, powerLeft } = game;
      const s = view.tile;

      for (const enemy of enemies) {
        const bob = enemy.state === "waiting" ? Math.sin(enemy.bob) * s * 0.14 : 0;
        this.drawWrapped(enemy.x, enemy.y, (px, py) => {
          if (enemy.state === "returning") {
            c.save();
            c.translate(px, py);
            c.scale(s * 0.5, s * 0.5);
            D.Art.eyes(c, game.enemyColor(enemy), D.DX[enemy.facing], D.DY[enemy.facing]);
            c.restore();
            return;
          }
          let variant = NORMAL;
          if (enemy.frightened) {
            const ending = powerLeft < FLASH_WINDOW && Math.floor(powerLeft * 6) % 2 === 0;
            variant = ending ? FRIGHT_FLASH : FRIGHT;
          } else {
            c.fillStyle = game.enemyColor(enemy);
            c.globalAlpha = 0.34;
            c.beginPath();
            c.ellipse(px, py + s * 0.56, s * 0.56, s * 0.17, 0, 0, TAU);
            c.fill();
            c.globalAlpha = 1;
          }
          const wobble = enemy.frightened ? Math.sin(enemy.bob * 2) * s * 0.05 : 0;
          sprites.draw(c, enemy.id, px + wobble, py + bob, enemy.facing, enemy.walk, enemy.dir >= 0, variant);
        });
      }

      if (state === "dying") {
        this.drawDying(stateTime);
        return;
      }
      this.drawWrapped(player.x, player.y, (px, py) => {
        c.fillStyle = "rgba(255,240,170,.36)";
        c.beginPath();
        c.ellipse(px, py + s * 0.56, s * 0.56, s * 0.17, 0, 0, TAU);
        c.fill();
        sprites.draw(c, game.droidId, px, py, player.facing, player.walk, player.moving, NORMAL);
      });
    }

    // The droid shorts out, spins down and collapses.
    drawDying(t) {
      const { game, c } = this;
      const { player, view } = game;
      const s = view.tile;
      const px = (player.x + 0.5) * s;
      const py = (player.y + 0.5) * s;
      const k = D.clamp(t / 1.2, 0, 1);
      c.save();
      c.translate(px, py);
      c.rotate(k * k * TAU * 2);
      c.scale(1 - k * 0.2, 1 - k * 0.9);
      game.sprites.draw(c, game.droidId, 0, 0, player.facing, 0, false, NORMAL);
      c.restore();
    }

    drawReady(t) {
      const { game, c } = this;
      const { view } = game;
      const { boardX, boardY, boardW, boardH } = view;
      const alpha = D.clamp(t * 4, 0, 1);
      c.globalAlpha = alpha;
      c.textAlign = "center";
      c.textBaseline = "middle";
      const size = Math.max(16, boardW * 0.066);
      c.font = `800 ${size}px Oxanium, "Segoe UI", sans-serif`;
      c.lineWidth = 5;
      c.strokeStyle = "rgba(0,0,0,.9)";
      const x = boardX + boardW / 2;
      const door = game.maze.door;
      const y = boardY + (door.y + 4.5) * view.tile;
      const label = game.showLevelName && t < 1 ? `LEVEL ${game.levels.number}` : "READY!";
      c.strokeText(label, x, Math.min(y, boardY + boardH - size));
      c.fillStyle = "#ffe14d";
      c.fillText(label, x, Math.min(y, boardY + boardH - size));
      c.globalAlpha = 1;
    }

    /* ---------- Celebrations ---------- */

    // The whole cast, gathered on a spotlit stage.
    drawDanceFloor() {
      const { game, c } = this;
      const { view, stateTime, dancers, anim, state } = game;
      const { boardW, boardH } = view;
      const t = stateTime;

      c.globalAlpha = D.clamp((t - 0.3) * 2, 0, 0.72);
      c.fillStyle = "#04040c";
      c.fillRect(0, 0, boardW, boardH);
      c.globalAlpha = 1;

      if (state === "clear" && t > 0.4) {
        // Sweeping spotlights
        c.globalCompositeOperation = "lighter";
        const beams = ["#ff4a8a", "#3fc8ff", "#ffe14d", "#7dff8a"];
        for (let i = 0; i < 4; i++) {
          const angle = Math.sin(t * 1.4 + i * 1.6) * 0.5;
          const top = boardW * (0.14 + i * 0.24);
          const foot = top + Math.tan(angle) * boardH * 0.72;
          c.globalAlpha = 0.17;
          c.fillStyle = beams[i];
          c.beginPath();
          c.moveTo(top - 4, 0);
          c.lineTo(top + 4, 0);
          c.lineTo(foot + boardW * 0.14, boardH * 0.86);
          c.lineTo(foot - boardW * 0.14, boardH * 0.86);
          c.fill();
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = "source-over";
      }

      for (const dancer of dancers) {
        const slide = D.ease(D.clamp((t - dancer.delay) / 0.6, 0, 1));
        const x = D.lerp(dancer.fromX, dancer.x, slide);
        const y = D.lerp(dancer.fromY, dancer.y, slide);
        const size = D.lerp(view.tile * 0.8, dancer.size, slide);
        if (dancer.fallen) {
          // Game over: the droid lies on its side while the enemies gloat around it.
          c.save();
          c.translate(x, y + size * 0.4);
          c.rotate(Math.PI / 2 * slide);
          anim.drawPortrait(c, dancer.id, 0, 0, size, 0, false);
          c.restore();
        } else if (slide < 1) {
          anim.drawPortrait(c, dancer.id, x, y, size, t, slide > 0);
        } else {
          anim.drawDancer(c, dancer.id, x, y, size, t + dancer.offset);
        }
      }
    }

    /* ---------- Space scenes ---------- */

    drawStars(t, speed) {
      const { c } = this;
      const { W, H } = this.game.view;
      const cx = W / 2;
      const cy = H / 2;
      const reach = Math.hypot(W, H) * 0.6;
      c.strokeStyle = "#dfe8ff";
      for (const star of this.starSeed) {
        const a = star.x * TAU;
        const d = ((star.z + t * speed) % 1);
        const r = d * d * reach;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const trail = 1 - speed * 0.5 * (d + 0.3);
        c.globalAlpha = Math.min(1, d * 1.8);
        c.lineWidth = 0.6 + d * 1.6;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(cx + Math.cos(a) * r * Math.min(0.995, trail), cy + Math.sin(a) * r * Math.min(0.995, trail));
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    // The menu's animated background: a droid chased across the stars, then the tables turn.
    drawAttract(t) {
      const { game, c } = this;
      const { W, H, tile } = game.view;
      const { anim } = game;
      c.fillStyle = "#04050f";
      c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.7);
      g.addColorStop(0, "#1a2158");
      g.addColorStop(1, "rgba(4,5,15,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      this.drawStars(t, 0.07);

      const size = Math.max(20, Math.min(tile * 1.5, H * 0.06));
      const y = H - size * 1.5;
      const span = W + size * 22;
      const period = 18;
      const phase = ((t + 3) % period) / period;
      const leftward = phase >= 0.5;
      const run = leftward ? (phase - 0.5) * 2 : phase * 2;
      const lead = leftward ? W + size * 18 - run * span : -size * 18 + run * span;
      const dir = leftward ? -1 : 1;

      // First pass: enemies chase the droid. Second pass: frightened enemies flee from it.
      const flee = leftward;
      const droidX = lead - dir * (flee ? size * 7.5 : 0);
      for (let i = 0; i < 4; i++) {
        const x = lead - dir * (flee ? -i * size * 2.5 : (i + 1) * size * 2.5 + size * 2);
        const walk = (t * 2.6 + i * 0.2) % 1;
        c.save();
        c.translate(x, y + Math.sin(t * 7 + i) * size * 0.06);
        if (flee) {
          // Frightened enemies reuse the in-game sprite, scaled up to parade size.
          const k = (size * 2) / game.sprites.size;
          c.scale(k, k);
          game.sprites.draw(c, game.enemyIds[i], 0, 0, leftward ? D.LEFT : D.RIGHT, walk, true, FRIGHT);
        } else {
          c.scale(dir * size, size);
          const p = anim.pose;
          p.t = walk;
          p.moving = true;
          p.lx = 1;
          p.ly = 0;
          p.limb = 0;
          D.Art.draw(c, game.enemyIds[i], p);
        }
        c.restore();
      }
      c.save();
      c.translate(droidX, y + Math.sin(t * 9) * size * 0.05);
      c.scale(dir * size, size);
      const p = anim.pose;
      p.t = (t * 2.6) % 1;
      p.moving = true;
      p.lx = 1;
      p.ly = 0;
      p.limb = 0;
      D.Art.draw(c, game.droidId, p);
      c.restore();

      // A line of gears for the droid to chomp as it passes.
      for (let x = size; x < W; x += size * 1.6) {
        const passed = leftward ? x > droidX : x < droidX;
        if (passed) continue;
        c.save();
        c.translate(x, y + size * 0.1);
        c.rotate(t * 1.5);
        D.Art.gear(c, size * 0.2, "#ffe88a", "#3a3010");
        c.restore();
      }
    }

    // The end-of-galaxy party: hyperspace, a spiral galaxy, and every droid in one ring.
    drawGalaxy(clock, t) {
      const { game, c } = this;
      const { W, H } = game.view;
      const { anim } = game;
      c.fillStyle = "#04030f";
      c.fillRect(0, 0, W, H);
      this.drawStars(clock, 0.28);

      const cx = W / 2;
      const cy = H * 0.5;
      const R = Math.min(W, H) * 0.42;
      c.save();
      c.translate(cx, cy);
      c.rotate(clock * 0.25);
      c.scale(1, 0.62);
      c.globalCompositeOperation = "lighter";
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 80; i++) {
          const k = i / 80;
          const a = k * 6 + (arm * TAU) / 3;
          const r = k * R;
          c.globalAlpha = (1 - k) * 0.3;
          c.fillStyle = ["#7fa0ff", "#ff8ae0", "#ffd98a"][arm];
          c.beginPath();
          c.arc(Math.cos(a) * r, Math.sin(a) * r, 8 * (1 - k) + 1.5, 0, TAU);
          c.fill();
        }
      }
      c.restore();
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";

      const cast = game.galaxyCast;
      const size = Math.max(20, Math.min(W, H) * 0.075);
      const ringX = Math.min(W * 0.44, R * 1.5);
      const ringY = Math.min(H * 0.32, R * 1.05);
      const appear = D.clamp(t / 1.2, 0, 1);
      for (let i = 0; i < cast.length; i++) {
        const a = (i / cast.length) * TAU + clock * 0.3;
        anim.drawDancer(c, cast[i], cx + Math.cos(a) * ringX * appear, cy + Math.sin(a) * ringY * appear, size, clock + i * 0.13);
      }
    }
  }

  D.GameRenderer = GameRenderer;
})(window.DROID);
