/*
 * Everything between the fights: the opening crawl, each level's title card, the
 * dialogue box and the ending. Cinematics share one small interface: update(dt),
 * draw(ctx), and a done callback. Esc skips, any action key advances.
 */
(function (J) {
  const { clamp, wrapText, roundRect, ease, rand } = J.U;
  const { Art } = J;
  const W = J.VIEW_W;
  const H = J.VIEW_H;

  const PLANETS = {
    temple: { base: "#3a3f5c", bands: ["#ffcf6a", "#8a7ab0", "#22263c"], halo: "rgba(255,190,120,.4)", seed: 3 },
    kashyyyk: { base: "#2f7a4a", bands: ["#1d5a3a", "#6ab06a", "#2a8aa8"], halo: "rgba(120,220,170,.34)", seed: 5 },
    tatooine: { base: "#d8a666", bands: ["#b57f42", "#f0cc92", "#9a6a38"], halo: "rgba(255,210,150,.34)", seed: 7 },
    mustafar: { base: "#3a0e08", bands: ["#ff6a20", "#ffb040", "#1c0806"], halo: "rgba(255,110,40,.42)", seed: 9 },
    hoth: { base: "#d6e8f4", bands: ["#ffffff", "#a8cce2", "#8ab4d0"], halo: "rgba(200,235,255,.4)", seed: 11 },
    narshaddaa: { base: "#2a1a44", bands: ["#ff3ab0", "#3affd8", "#120a26"], halo: "rgba(255,70,180,.34)", seed: 13 },
    endor: { base: "#2f6a4a", bands: ["#1f4a34", "#6a9a5a", "#d8e8f0"], halo: "rgba(150,230,180,.32)", seed: 15 },
    deathstar: { base: "#6a7078", bands: ["#4a5058", "#8a9098", "#3a4048"], halo: "rgba(200,220,240,.26)", seed: 17 },
    exegol: { base: "#141c30", bands: ["#2a4a7a", "#0a0e1a", "#7ac8ff"], halo: "rgba(120,180,255,.3)", seed: 19 },
    throne: { base: "#141c30", bands: ["#7a1a2a", "#0a0e1a", "#ff3a4a"], halo: "rgba(255,70,90,.3)", seed: 21 },
  };

  function wantsAdvance(game) {
    const { input } = game;
    const tapped = game.tapped;
    return input.pressed("confirm") || input.pressed("jump") || input.pressed("attack") || tapped;
  }

  function prompt(ctx, game, t, text) {
    const touch = game.touchActive;
    ctx.globalAlpha = 0.55 + Math.sin(t * 3) * 0.3;
    ctx.fillStyle = "#cfe4ff";
    ctx.font = `600 14px ${J.FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(text || (touch ? "TAP TO CONTINUE" : "PRESS SPACE TO CONTINUE"), W - 28, H - 20);
    ctx.globalAlpha = 1;
  }

  function fadeIn(ctx, t, length = 0.7) {
    if (t >= length) return;
    ctx.fillStyle = `rgba(0,0,0,${1 - t / length})`;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- Opening crawl ----------

  class Crawl {
    constructor(game, onDone) {
      this.game = game;
      this.onDone = onDone;
      this.t = 0;
      this.stars = new J.Starfield();
      this.lines = J.OPENING_CRAWL;
      this.speed = 42;
      this.length = this.lines.length * 66 / this.speed + 8;
      game.audio.playMusic("cinematic");
    }

    update(dt) {
      this.t += dt;
      const { input } = this.game;
      if (input.pressed("pause") || this.t > this.length) return this.onDone();
      if (wantsAdvance(this.game) && this.t > 1) this.t += 3;
      return undefined;
    }

    draw(ctx) {
      this.stars.draw(ctx, this.t);
      const horizon = 96;
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd76a";
      this.lines.forEach((line, i) => {
        if (!line) return;
        // Each line recedes up the screen, shrinking toward the horizon.
        const s = this.t * this.speed - i * 66 - 40;
        if (s < 0) return;
        const depth = 1 / (1 + s * 0.0052);
        const y = horizon + (H + 30 - horizon) * depth;
        const size = 34 * depth;
        if (size < 5) return;
        ctx.globalAlpha = clamp((size - 5) / 7, 0, 1);
        ctx.font = `${i < 2 ? 800 : 600} ${size}px ${J.FONT}`;
        ctx.fillText(line, W / 2, y);
      });
      ctx.globalAlpha = 1;
      prompt(ctx, this.game, this.t, "ESC TO SKIP");
      fadeIn(ctx, this.t, 1.2);
    }
  }

  // ---------- Level title card ----------

  class LevelIntro {
    constructor(game, index, abilityCard, onDone) {
      this.game = game;
      this.index = index;
      this.def = J.LEVELS[index];
      this.ability = abilityCard;
      this.onDone = onDone;
      this.t = 0;
      this.stars = new J.Starfield();
      game.audio.playMusic("cinematic");
    }

    get textLength() { return this.def.intro.length; }

    update(dt) {
      this.t += dt;
      const typed = this.t * 46 >= this.textLength;
      const { input } = this.game;
      if (input.pressed("pause")) return this.onDone();
      if (this.t > 0.4 && wantsAdvance(this.game)) {
        if (!typed) this.t = this.textLength / 46 + 0.01;
        else return this.onDone();
      }
      return undefined;
    }

    draw(ctx) {
      const { def, t } = this;
      this.stars.draw(ctx, t);
      const look = PLANETS[def.theme];
      const rise = ease.out(clamp(t / 1.6, 0, 1));
      J.drawPlanet(ctx, 720, 560 - 250 * rise, 250, look, t);

      // A small ship crossing toward the planet.
      const k = (t * 0.09) % 1;
      const sx = J.U.lerp(980, 700, k);
      const sy = J.U.lerp(40, 280, k);
      const size = J.U.lerp(13, 2.6, k);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(2.45);
      ctx.fillStyle = "#d8dee8";
      ctx.beginPath();
      ctx.moveTo(size * 1.4, 0);
      ctx.lineTo(-size, -size * 0.6);
      ctx.lineTo(-size * 0.7, 0);
      ctx.lineTo(-size, size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#58c8ff";
      ctx.beginPath();
      ctx.arc(-size * 0.8, 0, size * 0.28, 0, J.TAU);
      ctx.fill();
      ctx.restore();

      ctx.textAlign = "left";
      ctx.fillStyle = "#7cc8ff";
      ctx.font = `700 15px ${J.FONT}`;
      ctx.fillText(`LEVEL ${this.index + 1}  ·  ${def.planet.toUpperCase()}`, 48, 112);
      ctx.fillStyle = "#ffd76a";
      ctx.font = `800 38px ${J.FONT}`;
      ctx.fillText(def.name.toUpperCase(), 48, 156);

      ctx.font = `500 17px ${J.FONT}`;
      ctx.fillStyle = "#e6f0ff";
      const typed = def.intro.slice(0, Math.floor(t * 46));
      wrapText(ctx, typed, 480).forEach((line, i) => ctx.fillText(line, 48, 200 + i * 25));

      if (this.ability && t * 46 > this.textLength) {
        const y = 370;
        ctx.globalAlpha = clamp(t * 46 - this.textLength, 0, 20) / 20;
        ctx.fillStyle = "rgba(14,24,50,.9)";
        ctx.strokeStyle = "#ffd76a";
        ctx.lineWidth = 1.5;
        roundRect(ctx, 48, y, 470, 74, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#ffd76a";
        ctx.font = `700 12px ${J.FONT}`;
        ctx.fillText("NEW ABILITY", 64, y + 22);
        ctx.font = `800 18px ${J.FONT}`;
        ctx.fillStyle = "#fff";
        ctx.fillText(this.ability.name, 64, y + 44);
        ctx.font = `500 13px ${J.FONT}`;
        ctx.fillStyle = "#b8c8e0";
        ctx.fillText(this.ability.desc, 64, y + 62);
        ctx.globalAlpha = 1;
      }
      prompt(ctx, this.game, t);
      fadeIn(ctx, t);
    }
  }

  // ---------- Ending ----------

  class Ending {
    constructor(game, onDone) {
      this.game = game;
      this.onDone = onDone;
      this.shots = J.ENDING_SHOTS;
      this.index = 0;
      this.t = 0;
      this.stars = new J.Starfield();
      this.bgExegol = new J.Background("exegol");
      this.bgTemple = new J.Background("temple");
      const { jedi } = game;
      this.skin = Art.jediSkin({ ...jedi, outfit: jedi.outfit === 0 ? 1 : jedi.outfit });
      this.saber = new J.Lightsaber(jedi.saber, jedi.saberType);
      game.audio.playMusic("ending");
    }

    update(dt) {
      this.t += dt;
      const { input } = this.game;
      if (input.pressed("pause")) return this.onDone();
      const typedAll = this.index < this.shots.length && this.t * 40 >= this.shots[this.index].text.length;
      if (this.t > 0.4 && wantsAdvance(this.game)) {
        if (this.index < this.shots.length && !typedAll) {
          this.t = this.shots[this.index].text.length / 40 + 0.01;
        } else {
          this.index++;
          this.t = 0;
          if (this.index > this.shots.length) return this.onDone();
        }
      }
      return undefined;
    }

    draw(ctx) {
      const { t } = this;
      if (this.index >= this.shots.length) {
        this.stars.draw(ctx, t);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd76a";
        ctx.font = `800 52px ${J.FONT}`;
        ctx.fillText("THE END", W / 2, 220);
        ctx.font = `500 18px ${J.FONT}`;
        ctx.fillStyle = "#e6f0ff";
        ctx.fillText(`${this.game.jedi.name} has restored balance to the Force.`, W / 2, 262);
        ctx.fillStyle = "#93a6c6";
        ctx.font = `500 14px ${J.FONT}`;
        ctx.fillText("A fan-made tribute. Thanks for playing.", W / 2, 292);
        prompt(ctx, this.game, t);
        fadeIn(ctx, t);
        return;
      }
      const shot = this.shots[this.index];
      this[shot.scene](ctx, t);
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.fillRect(0, H - 110, W, 110);
      ctx.fillStyle = "#e6f0ff";
      ctx.font = `500 18px ${J.FONT}`;
      ctx.textAlign = "left";
      wrapText(ctx, shot.text.slice(0, Math.floor(t * 40)), W - 100).forEach((line, i) => ctx.fillText(line, 50, H - 72 + i * 26));
      prompt(ctx, this.game, t);
      fadeIn(ctx, t);
    }

    exegolDawn(ctx, t) {
      this.bgExegol.drawLayers(ctx, t * 8, 0, 0, t);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(255,190,120,0)");
      g.addColorStop(1, `rgba(255,190,120,${clamp(t / 6, 0, 0.5)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#0b0d16";
      ctx.fillRect(0, 380, W, 160);
      Art.jedi(ctx, this.skin, this.saber, W / 2, 380, 1, Art.pose("relaxed", t), t, Math.sin(t) * 0.2, 1.3, false);
    }

    fleet(ctx, t) {
      this.stars.draw(ctx, t);
      J.drawPlanet(ctx, 760, 240, 150, PLANETS.endor, t);
      for (let i = 0; i < 7; i++) {
        const x = 90 + i * 118 + Math.sin(i * 4) * 40;
        const y = 150 + (i * 37) % 180 + t * (5 + i);
        const w = 92 - i * 7;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.24 + i * 0.02 + t * 0.02);
        ctx.fillStyle = "#49505c";
        ctx.beginPath();
        ctx.moveTo(w, 0);
        ctx.lineTo(-w * 0.8, -w * 0.3);
        ctx.lineTo(-w * 0.8, w * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    planets(ctx, t) {
      this.stars.draw(ctx, t);
      ["kashyyyk", "tatooine", "temple", "hoth"].forEach((id, i) => {
        J.drawPlanet(ctx, 150 + i * 220, 200 + Math.sin(t * 0.6 + i) * 8, 80, PLANETS[id], t);
      });
    }

    temple(ctx, t) {
      this.bgTemple.drawLayers(ctx, 330, 0, 0, t);
      ctx.fillStyle = "#e2d2a8";
      ctx.fillRect(0, 395, W, 8);
      ctx.fillStyle = "#b8ab92";
      ctx.fillRect(0, 403, W, 137);
      const padawan = Art.jediSkin({ ...this.game.jedi, species: 0, skin: 1, pattern: 1, hair: 1, outfit: 0, palette: 0 });
      [[250, 0.72], [320, 0.78], [650, 0.74], [720, 0.7]].forEach(([x, s], i) => {
        Art.jedi(ctx, i < 2 ? padawan : this.skin, this.saber, x, 395, i < 2 ? 1 : -1, Art.pose("kneel", t + i), t, 0, s, false);
      });
      Art.jedi(ctx, this.skin, this.saber, W / 2, 395, 1, Art.pose("victory", clamp(t * 0.5, 0, 1)), t, Math.sin(t * 1.3) * 0.25, 1.35);
    }
  }

  // ---------- Dialogue box ----------

  function drawDialogue(ctx, game, line, t) {
    const [who, speaker, text] = line;
    const boxH = 104;
    const y = H - boxH - 14;
    ctx.fillStyle = "rgba(6,10,24,.9)";
    ctx.strokeStyle = "rgba(124,200,255,.55)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 26, y, W - 52, boxH, 6);
    ctx.fill();
    ctx.stroke();
    Art.bust(ctx, who, 38, y + 12, 80, t, game.jedi);
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffd76a";
    ctx.font = `700 15px ${J.FONT}`;
    ctx.fillText(speaker || game.jedi.name, 132, y + 28);
    ctx.fillStyle = "#e6f0ff";
    ctx.font = `500 16px ${J.FONT}`;
    wrapText(ctx, text.slice(0, Math.floor(t * 52)), W - 200).forEach((l, i) => ctx.fillText(l, 132, y + 52 + i * 22));
  }

  // A run of dialogue lines shown over the paused action.
  class DialogueScene {
    constructor(game, lines, onDone) {
      this.game = game;
      this.lines = lines;
      this.onDone = onDone;
      this.i = 0;
      this.t = 0;
    }

    update(dt) {
      this.t += dt;
      const line = this.lines[this.i];
      if (this.game.input.pressed("pause")) {
        this.finish();
        return;
      }
      if (this.t > 0.2 && wantsAdvance(this.game)) {
        if (this.t * 52 < line[2].length) {
          this.t = line[2].length / 52 + 0.01;
        } else {
          this.i++;
          this.t = 0;
          if (this.i >= this.lines.length) this.finish();
        }
      }
    }

    finish() {
      const done = this.onDone;
      this.onDone = null;
      this.game.scene = null;
      if (done) done();
    }

    draw(ctx) {
      const line = this.lines[this.i];
      if (line) drawDialogue(ctx, this.game, line, this.t);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#cfe4ff";
      ctx.font = `600 12px ${J.FONT}`;
      ctx.textAlign = "right";
      ctx.fillText("ESC TO SKIP", W - 40, H - 22);
      ctx.globalAlpha = 1;
    }
  }

  // A name card for a boss, slammed on screen over the letterbox.
  function drawBossCard(ctx, name, title, t) {
    const k = clamp(t * 3, 0, 1);
    const fade = clamp(3.4 - t, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(90,0,0,.55)";
    ctx.fillRect(0, 150, W * ease.out(k), 92);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `800 40px ${J.FONT}`;
    ctx.fillText(name, W / 2 + (1 - ease.out(k)) * 200 + rand(-0.6, 0.6), 200);
    ctx.fillStyle = "#ffb0a0";
    ctx.font = `500 16px ${J.FONT}`;
    ctx.fillText(title, W / 2, 226);
    ctx.restore();
  }

  J.Cinematics = { Crawl, LevelIntro, Ending, DialogueScene, drawDialogue, drawBossCard, PLANETS };
})(window.JEDI);
