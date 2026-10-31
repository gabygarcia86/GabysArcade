/*
 * The game itself: states, the update loop, collisions, scoring, the chase
 * and the catch sequence. main.js drives it, and ui.js shows the results.
 */
import { CONFIG, PURSUERS } from "./config.js";
import { hitsEntity } from "./collision.js";
import { drawCenteredText, wrapText } from "./font.js";
import { EntityPool, KINDS, drawEntity, updateEntity } from "./obstacles.js";
import { Particles } from "./particles.js";
import { Player } from "./player.js";
import { Pursuer } from "./pursuer.js";
import { World } from "./world.js";

const C = CONFIG.chase;
const PTS = CONFIG.points;
const PW = CONFIG.powerups;
const PX_PER_M = CONFIG.world.pxPerMeter;
const CAMERA_MARGIN = CONFIG.world.playHalf + 90;
const NEVER_JUMPED = 40; // Solids taller than this are out of reach for a pursuer too.

const NO_INPUT = { steer: 0, up: false, down: false, takeOllie: () => false };
const SILENT = { bark() {}, flap() {} };
const FARTHEST_FIRST = (a, b) => b.y - a.y;

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 320;
    this.height = 480;
    this.anchor = 336; // Screen row the player rolls along.
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.anchor = Math.round(Math.min(height * 0.7, height - 130));
  }

  sx(worldX) {
    return worldX - this.x + this.width / 2;
  }

  sy(worldY) {
    return this.anchor - (worldY - this.y);
  }

  topWorld() {
    return this.y + this.anchor;
  }

  bottomWorld() {
    return this.y - (this.height - this.anchor);
  }

  follow(player, dt) {
    const limit = Math.max(0, CAMERA_MARGIN - this.width / 2);
    const target = Math.max(-limit, Math.min(limit, player.x));
    this.x += (target - this.x) * (1 - Math.exp(-7 * dt));
    this.y = player.y;
  }
}

export class Game {
  constructor(canvas, ui, audio, input, save) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.save = save;

    this.camera = new Camera();
    this.pool = new EntityPool();
    this.world = new World(this.pool);
    this.particles = new Particles();
    this.player = new Player();
    this.pursuer = new Pursuer();

    this.state = "menu"; // menu, play, paused, caught or over
    this.textScale = 1;
    this.resetRun();
  }

  resetRun() {
    this.score = 0;
    this.scoredTenths = 0;
    this.playTime = 0;
    this.chaseStage = "none"; // none, warning or on
    this.chaseAt = C.triggerSeconds + (Math.random() * 2 - 1) * C.triggerJitter;
    this.warningTime = 0;
    this.bannerTime = 0;
    this.hintTime = 0;
    this.shake = 0;
    this.catchTime = 0;
    this.catchStage = 0;
    this.catchLine = "";
    this.flash = 0;
  }

  get meters() {
    return Math.max(0, this.player.y / PX_PER_M);
  }

  resize(width, height, cssScale) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
    this.camera.resize(width, height);
    this.textScale = cssScale < 1.5 ? 2 : 1;
  }

  /* ---------- State changes ---------- */

  start() {
    const choice = this.save.pursuer;
    const type = choice === "random" ? (Math.random() < 0.5 ? "cop" : "karen") : choice;
    this.resetRun();
    this.player.reset();
    this.pursuer.reset(type);
    this.particles.clear();
    this.world.reset();
    this.camera.x = 0;
    this.camera.y = 0;
    this.state = "play";
    this.hintTime = 3.5;
    this.input.reset();
    this.audio.setTension(0);
    this.ui.showPlaying();
    this.ui.updateHud(this);
  }

  // Back to the menu, with the neighborhood rolling by behind it.
  toMenu() {
    this.state = "menu";
    this.resetRun();
    this.player.reset();
    this.pursuer.reset("cop");
    this.particles.clear();
    this.world.reset();
    this.camera.x = 0;
    this.camera.y = 0;
    this.audio.setRolling(0);
    this.audio.setTension(0);
    this.ui.showMenu();
  }

  pause() {
    if (this.state !== "play") return;
    this.state = "paused";
    this.audio.setRolling(0);
    this.ui.showPause();
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "play";
    this.input.reset();
    this.ui.showPlaying();
  }

  togglePause() {
    if (this.state === "play") this.pause();
    else if (this.state === "paused") this.resume();
  }

  /* ---------- Update ---------- */

  update(dt) {
    if (this.state === "menu") this.updateAttract(dt);
    else if (this.state === "play") this.updatePlay(dt);
    else if (this.state === "caught") this.updateCaught(dt);
    else if (this.state === "over") this.updateAfterMath(dt);
  }

  updateAttract(dt) {
    this.camera.y += 110 * dt;
    this.player.y = this.camera.y;
    this.world.update(this.camera, 500, false);
    for (const e of this.pool.active) updateEntity(e, dt, this.player, SILENT);
  }

  updatePlay(dt) {
    const { player, camera, audio } = this;
    this.playTime += dt;
    this.hintTime = Math.max(0, this.hintTime - dt);
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);

    const event = player.update(dt, this.input);
    if (event === "ollie") audio.ollie();
    if (event === "land") {
      audio.land();
      this.particles.dust(player.x, player.y, 4);
    }
    if (player.rocket > 0 && !player.airborne) this.particles.flame(player.x, player.y - 12);

    camera.follow(player, dt);
    this.world.update(camera, this.meters, this.chaseStage === "on");
    for (const e of this.pool.active) updateEntity(e, dt, player, audio);
    this.particles.update(dt);
    this.checkCollisions();
    this.addDistanceScore();
    this.updateChase(dt);

    audio.setRolling(player.controllable && !player.airborne ? player.groundSpeed : 0);
    this.ui.updateHud(this);
  }

  addDistanceScore() {
    const tenths = Math.floor(this.meters / 10);
    if (tenths > this.scoredTenths) {
      this.score += (tenths - this.scoredTenths) * PTS.perTenMeters;
      this.scoredTenths = tenths;
    }
  }

  award(points, x, y, label) {
    this.score += points;
    if (label) this.particles.float(x, y + 22, label, "#ffe45c");
  }

  /* ---------- Collisions ---------- */

  checkCollisions() {
    const { player } = this;
    const { x, y, radius } = player;

    for (const e of this.pool.active) {
      const { kind } = e;
      if (e.remove || kind.decor) continue;

      if (Math.abs(e.y - y) < 60) {
        const touching = hitsEntity(x, y, radius, e);
        if (touching) {
          if (kind.collectible) this.collect(e);
          else if (kind.flat) this.touchGround(e);
          else if (kind.solid && !e.handled && !e.knocked) this.touchObstacle(e);
        }
      }

      // Rolled past it without a scratch.
      if (kind.solid && !e.handled && e.y < y - 40) {
        e.handled = true;
        if (Math.abs(e.x - x) < 130) this.score += PTS.avoid;
      }
    }
  }

  collect(e) {
    const { player, particles, audio } = this;
    e.remove = true;
    audio.pickup();
    particles.sparkle(e.x, e.y);
    const pick = {
      soda: ["SODA RUSH!", () => { player.soda = PW.sodaTime; }],
      wheel: ["GOLD WHEEL!", null],
      helmet: ["HELMET!", () => { player.helmet = true; }],
      rocket: ["ROCKET SHOES!", () => { player.rocket = PW.rocketTime; }],
      energy: ["ENERGY DRINK!", () => { player.energy = PW.energyTime; }],
    }[e.kind.id];
    if (pick[1]) pick[1]();
    const points = e.kind === KINDS.wheel ? PTS.goldWheel : PTS.collect;
    this.award(points, e.x, e.y, `${pick[0]} +${points}`);
  }

  touchGround(e) {
    const { player, particles, audio } = this;
    if (player.airborne || !player.controllable || e.handled) return;
    e.handled = true;
    if (e.kind === KINDS.puddle) {
      player.slipOnPuddle();
      particles.splash(player.x, player.y);
      audio.splash();
      particles.float(player.x, player.y + 22, "SPLASH!", "#c6e3fa");
    } else if (e.kind === KINDS.crack) {
      player.hitCrack();
      particles.dust(player.x, player.y, 5);
      audio.thud();
      this.shake = 0.12;
    } else if (e.kind === KINDS.ramp) {
      player.launchFromRamp();
      audio.ramp();
      this.award(PTS.jump, player.x, player.y, `BIG AIR! +${PTS.jump}`);
    }
  }

  touchObstacle(e) {
    const { player, particles, audio } = this;
    if (player.z >= e.kind.height) {
      e.handled = true;
      const points = e.kind.person ? PTS.jumpPedestrian : PTS.jump;
      this.award(points, e.x, e.y, `+${points}`);
      return;
    }
    if (player.airborne && player.vz > 0 && player.z > e.kind.height * 0.6) return; // Rising past it.
    if (!player.controllable || player.invulnerable > 0) return;

    e.handled = true;
    this.shake = 0.3;
    particles.dust(player.x, player.y);
    if (e.kind.mover) {
      e.knocked = true;
      e.vx = player.vx * 0.5;
    }
    if (player.helmet) {
      player.helmet = false;
      player.invulnerable = CONFIG.player.invulnerableTime;
      particles.debris(player.x, player.y, "#7fd0ff");
      particles.float(player.x, player.y + 22, "HELMET SAVED YOU!", "#ffe45c");
      audio.shield();
      return;
    }
    particles.debris(e.x, e.y, e.kind.debris);
    audio.crash();
    if (e.kind === KINDS.dog) audio.bark();
    player.wipeout();
  }

  /* ---------- The chase ---------- */

  updateChase(dt) {
    const { pursuer, audio, player } = this;

    if (this.chaseStage === "none") {
      if (this.playTime >= this.chaseAt || this.meters >= C.triggerMeters) {
        this.chaseStage = "warning";
        this.warningTime = C.warningDelay;
        this.bannerTime = 3.4;
        audio.warning();
      }
      return;
    }

    if (this.chaseStage === "warning") {
      this.warningTime -= dt;
      if (this.warningTime <= 0) {
        this.chaseStage = "on";
        pursuer.spawn(player, this.camera);
        this.voice();
      }
      return;
    }

    if (pursuer.update(dt, player, this.camera)) this.voice();
    audio.setTension(pursuer.intensity);
    this.plowThroughObstacles();
    if (pursuer.catches(player)) this.startCatch();
  }

  voice() {
    if (this.pursuer.type === "cop") this.audio.whistle();
    else this.audio.yell();
  }

  // Small things get flattened, and big things get hurdled. Nothing slows them down.
  plowThroughObstacles() {
    const { pursuer, particles, audio } = this;
    for (const e of this.pool.active) {
      const { kind } = e;
      if (!kind.solid || e.knocked || e.remove) continue;
      if (Math.abs(e.y - pursuer.y) > 50 || !hitsEntity(pursuer.x, pursuer.y, 12, e)) continue;
      if (kind.height > NEVER_JUMPED || kind === KINDS.car) {
        if (pursuer.hop === 0) pursuer.hop = 0.3;
      } else if (kind.mover) {
        e.knocked = true;
        e.handled = true;
      } else {
        e.remove = true;
        particles.debris(e.x, e.y, kind.debris);
        audio.thud();
      }
    }
  }

  gapToPursuer() {
    return Math.max(0, this.player.y - this.pursuer.y);
  }

  /* ---------- The catch ---------- */

  startCatch() {
    const { player, pursuer, particles, audio } = this;
    this.state = "caught";
    this.catchTime = 0;
    this.catchStage = 0;
    this.shake = 0.45;
    this.bannerTime = 0;
    pursuer.mode = "approach";
    player.invulnerable = 0;
    player.helmet = false;
    player.tumble();
    particles.dust(player.x, player.y, 18);
    audio.setRolling(0);
    audio.crash();
    this.voice();
    const lines = PURSUERS[pursuer.type].gameOver;
    this.catchLine = lines[Math.floor(Math.random() * lines.length)];
  }

  updateCaught(dt) {
    const { player, pursuer, camera } = this;
    this.catchTime += dt;
    this.shake = Math.max(0, this.shake - dt);

    player.update(dt, NO_INPUT);
    camera.follow(player, dt);
    this.world.update(camera, this.meters, false);
    for (const e of this.pool.active) updateEntity(e, dt, player, SILENT);
    this.particles.update(dt);
    pursuer.update(dt, player, camera);
    if (this.catchTime > 0.45) pursuer.stepToStandOver(dt, player);

    if (this.catchStage === 0 && this.catchTime > 1.4) {
      this.catchStage = 1;
      this.audio.gameOver();
      pursuer.say(this.catchLine);
      pursuer.bubbleTime = Infinity;
    }
    if (this.catchTime > 2.9) this.finish();
  }

  // The camera holds on the scene behind the game-over window.
  updateAfterMath(dt) {
    const { player, pursuer, camera } = this;
    player.update(dt, NO_INPUT);
    camera.follow(player, dt);
    this.particles.update(dt);
    pursuer.update(dt, player, camera);
    pursuer.stepToStandOver(dt, player);
    for (const e of this.pool.active) updateEntity(e, dt, player, SILENT);
  }

  finish() {
    this.state = "over";
    this.pursuer.bubbleTime = 0; // The window takes over the punchline.
    const newBest = this.score > this.save.best;
    if (newBest) this.save.best = this.score;
    this.save.bestMeters = Math.max(this.save.bestMeters, Math.floor(this.meters));
    this.save.persist();
    this.audio.setTension(0);
    this.ui.showGameOver({
      line: this.catchLine,
      name: PURSUERS[this.pursuer.type].name,
      pursuer: this.pursuer.type,
      score: this.score,
      meters: Math.floor(this.meters),
      best: this.save.best,
      newBest,
    });
  }

  /* ---------- Drawing ---------- */

  draw() {
    const { ctx, camera } = this;
    const { width, height } = camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const shaking = this.shake > 0 && this.state !== "paused";
    if (shaking) {
      ctx.translate(Math.round((Math.random() - 0.5) * 6), Math.round((Math.random() - 0.5) * 6));
    }

    this.world.drawGround(ctx, camera, width, height);
    this.drawEntities();
    this.particles.draw(ctx, camera);
    if (this.pursuer.active) this.pursuer.drawBubble(ctx, camera, width, this.textScale);
    this.particles.drawFloaters(ctx, camera, this.textScale);
    this.drawOverlays();
  }

  drawEntities() {
    const { ctx, camera, player, pursuer } = this;
    const active = this.pool.active;
    const showPlayer = this.state !== "menu";
    active.sort(FARTHEST_FIRST);

    for (const e of active) {
      if (e.kind.flat && this.onScreen(e)) drawEntity(ctx, e, camera);
    }

    // Painter's order: farthest up the screen first, so nearer things overlap.
    let playerDrawn = !showPlayer;
    let pursuerDrawn = !pursuer.active;
    for (const e of active) {
      if (e.kind.flat) continue;
      if (!playerDrawn && e.y < player.y) { player.draw(ctx, camera); playerDrawn = true; }
      if (!pursuerDrawn && e.y < pursuer.y) { pursuer.draw(ctx, camera); pursuerDrawn = true; }
      if (this.onScreen(e)) drawEntity(ctx, e, camera);
    }
    if (!playerDrawn) player.draw(ctx, camera);
    if (!pursuerDrawn) pursuer.draw(ctx, camera);
  }

  onScreen(e) {
    const x = this.camera.sx(e.x);
    return x > -140 && x < this.camera.width + 140;
  }

  drawOverlays() {
    const { ctx, camera } = this;
    const { width, height } = camera;
    const scale = this.textScale;

    // Red edges pulse as the pursuer closes in.
    if (this.state === "play" && this.chaseStage === "on") {
      const danger = 1 - Math.min(1, this.gapToPursuer() / 110);
      if (danger > 0 && Math.floor(this.playTime * 7) % 2 === 0) {
        ctx.fillStyle = `rgba(216,40,47,${0.2 + danger * 0.35})`;
        ctx.fillRect(0, 0, width, 6);
        ctx.fillRect(0, height - 6, width, 6);
        ctx.fillRect(0, 0, 6, height);
        ctx.fillRect(width - 6, 0, 6, height);
      }
    }

    if (this.bannerTime > 0) this.drawBanner();

    if (this.hintTime > 0 && this.state === "play") {
      const text = this.ui.touchMode ? "DRAG TO STEER" : "ARROWS STEER - SPACE OLLIES";
      const y = camera.anchor + 34;
      drawCenteredText(ctx, text, width / 2 + 1, y + 1, "#1a1a1a", scale);
      drawCenteredText(ctx, text, width / 2, y, "#ffffff", scale);
    }
  }

  drawBanner() {
    const { ctx, camera } = this;
    const { width, height } = camera;
    const scale = width < 460 ? 2 : 3;
    const lines = wrapText("UH OH... YOU'RE IN TROUBLE!", Math.floor((width - 24) / (6 * scale)));
    const lineHeight = 10 * scale;
    const boxHeight = lines.length * lineHeight + 18;
    const top = Math.round(height * 0.2);
    const color = Math.floor(this.bannerTime * 8) % 2 === 0 ? "#ffe45c" : "#ff5a50";

    ctx.fillStyle = "rgba(16,16,24,0.84)";
    ctx.fillRect(0, top, width, boxHeight);
    ctx.fillStyle = color;
    ctx.fillRect(0, top, width, 2);
    ctx.fillRect(0, top + boxHeight - 2, width, 2);
    lines.forEach((line, i) => {
      drawCenteredText(ctx, line, width / 2, top + 10 + i * lineHeight, color, scale);
    });
  }
}
