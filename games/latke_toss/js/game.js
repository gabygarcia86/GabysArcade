import * as THREE from 'three';
import {
  ROUND, PHYSICS, LAUNCH, LATKE, POT, DIFFICULTIES, MENORAH, DREIDEL, SCORING, GOLDEN, FINAL_FRY, STATS,
} from './config.js';
import { Pot } from './pot.js';
import { LatkePool, setLatkeGolden, latkeBaseColor } from './latke.js';
import { SplashEffects } from './particles.js';
import { GeltShower } from './gelt.js';
import { AimController } from './controls.js';
import { RoundScore } from './scoring.js';
import { leaderboard } from './leaderboard.js';
import {
  LatkeBody, LatkeState, CollisionResult, stepBody, simulateTrajectory, collideWithPot, collideWithTable,
  collideWithDreidel, collideWithMenorah,
} from './physics.js';

export const GameState = Object.freeze({
  MENU: 'MENU',
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

// Where a fresh latke rests (on the plate) and where throws are launched from.
const REST_POSITION = new THREE.Vector3(0, 0.06 + LATKE.thickness * 0.5 + 0.015, 3.2);
const LAUNCH_POSITION = new THREE.Vector3(0, REST_POSITION.y + 0.3, 3.2);
const TRAJECTORY_DOTS = 44;
const TRAJECTORY_SAMPLE_SECONDS = 0.045;
const FRY_SECONDS = 1.5;
const MISS_LINGER_SECONDS = 1.1;
const FADE_SECONDS = 0.3;
const FRIED_COLOR = new THREE.Color(0x8a4f1c);

// ---------- Best-score storage (one entry per difficulty) ----------

const BEST_KEY = 'latkeToss.bestScores.v1';
const DIFFICULTY_KEY = 'latkeToss.difficulty';

class ScoreStore {
  constructor() {
    this.memory = { easy: 0, medium: 0, hard: 0 };
    try {
      const saved = JSON.parse(window.localStorage.getItem(BEST_KEY) || '{}');
      for (const key of Object.keys(this.memory)) {
        const value = Number(saved[key]);
        if (Number.isFinite(value) && value > 0) this.memory[key] = Math.floor(value);
      }
    } catch {
      // localStorage unavailable or corrupted: fall back to in-memory scores.
    }
  }

  get(difficulty) {
    return this.memory[difficulty] || 0;
  }

  all() {
    return { ...this.memory };
  }

  /** Records a score and returns true if it beat the stored best. */
  submit(difficulty, score) {
    if (score <= this.get(difficulty)) return false;
    this.memory[difficulty] = score;
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(this.memory));
    } catch {
      // Storage blocked: the best score lasts for this session only.
    }
    return true;
  }
}

// ---------- Personal-best round stats (one entry per difficulty) ----------

const STATS_KEY = 'latkeToss.bestStats.v1';
const EMPTY_STATS = () => ({ accuracy: 0, streak: 0, clean: 0 });

class StatsStore {
  constructor() {
    this.memory = { easy: EMPTY_STATS(), medium: EMPTY_STATS(), hard: EMPTY_STATS() };
    try {
      const saved = JSON.parse(window.localStorage.getItem(STATS_KEY) || '{}');
      for (const key of Object.keys(this.memory)) {
        for (const stat of Object.keys(this.memory[key])) {
          const value = Number(saved[key] && saved[key][stat]);
          if (Number.isFinite(value) && value > 0) this.memory[key][stat] = value;
        }
      }
    } catch {
      // localStorage unavailable or corrupted: bests last for this session only.
    }
  }

  /**
   * Records a round's stats. Returns the previous bests and which stats set a new record.
   * `accuracy` is null when the round had too few throws to count.
   */
  submit(difficulty, { accuracy, streak, clean }) {
    const best = this.memory[difficulty];
    const previous = { ...best };
    const records = {
      accuracy: accuracy !== null && accuracy > best.accuracy,
      streak: streak > best.streak,
      clean: clean > best.clean,
    };
    if (records.accuracy) best.accuracy = accuracy;
    if (records.streak) best.streak = streak;
    if (records.clean) best.clean = clean;
    if (records.accuracy || records.streak || records.clean) {
      try {
        window.localStorage.setItem(STATS_KEY, JSON.stringify(this.memory));
      } catch {
        // Storage blocked: bests last for this session only.
      }
    }
    return { previous, best: { ...best }, records };
  }
}

function loadDifficulty() {
  try {
    const saved = window.localStorage.getItem(DIFFICULTY_KEY);
    if (saved && DIFFICULTIES[saved]) return saved;
  } catch {
    // ignore
  }
  return 'easy';
}

function saveDifficulty(key) {
  try {
    window.localStorage.setItem(DIFFICULTY_KEY, key);
  } catch {
    // ignore
  }
}

// ---------- Aim visuals: predicted arc and power arrow ----------

class AimVisuals {
  constructor(scene) {
    this.points = Array.from({ length: TRAJECTORY_DOTS }, () => new THREE.Vector3());
    const dotGeometry = new THREE.SphereGeometry(0.045, 10, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false });
    this.dots = new THREE.InstancedMesh(dotGeometry, dotMaterial, TRAJECTORY_DOTS);
    this.dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dots.frustumCulled = false;
    this.dots.renderOrder = 4;
    const near = new THREE.Color(0xfff3c4);
    const far = new THREE.Color(0xf2a03c);
    const color = new THREE.Color();
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      this.dots.setColorAt(i, color.copy(near).lerp(far, i / TRAJECTORY_DOTS));
    }
    this.dots.count = 0;
    scene.add(this.dots);

    const shape = new THREE.Shape();
    shape.moveTo(-0.07, 0);
    shape.lineTo(0.07, 0);
    shape.lineTo(0.07, -0.75);
    shape.lineTo(0.2, -0.75);
    shape.lineTo(0, -1);
    shape.lineTo(-0.2, -0.75);
    shape.lineTo(-0.07, -0.75);
    shape.closePath();
    const arrowGeometry = new THREE.ShapeGeometry(shape);
    // Shape is drawn in XY with the tip at -Y; lay it flat so the tip points down -Z.
    arrowGeometry.rotateX(Math.PI / 2);
    this.arrow = new THREE.Mesh(arrowGeometry, new THREE.MeshBasicMaterial({
      color: 0xf2c14e, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.arrow.position.set(REST_POSITION.x, 0.08, REST_POSITION.z);
    this.arrow.renderOrder = 3;
    this.arrow.visible = false;
    scene.add(this.arrow);
    this.lowPowerColor = new THREE.Color(0xf2c14e);
    this.highPowerColor = new THREE.Color(0xff5a36);
    this._matrix = new THREE.Matrix4();
    this._scale = new THREE.Vector3();
    this._quaternion = new THREE.Quaternion();
  }

  show(aim, previewFraction) {
    if (!aim.valid) {
      this.hide();
      return;
    }
    const total = simulateTrajectory(
      LAUNCH_POSITION, aim.velocity, this.points, TRAJECTORY_DOTS, TRAJECTORY_SAMPLE_SECONDS, 3,
    );
    const shown = Math.max(1, Math.floor(total * previewFraction));
    for (let i = 0; i < shown; i++) {
      const size = 1 - (i / TRAJECTORY_DOTS) * 0.45;
      this._scale.setScalar(size);
      this._matrix.compose(this.points[i], this._quaternion, this._scale);
      this.dots.setMatrixAt(i, this._matrix);
    }
    this.dots.count = shown;
    this.dots.instanceMatrix.needsUpdate = true;

    this.arrow.visible = true;
    this.arrow.rotation.y = -aim.yaw;
    const length = 0.55 + aim.power * 0.9;
    this.arrow.scale.set(1, 1, length);
    this.arrow.material.color.copy(this.lowPowerColor).lerp(this.highPowerColor, aim.power);
  }

  hide() {
    this.dots.count = 0;
    this.arrow.visible = false;
  }
}

// ---------- Thrown latke wrapper ----------

class ThrownLatke {
  constructor() {
    this.body = new LatkeBody();
    this.mesh = null;
    this.baseScale = new THREE.Vector3(1, 1, 1);
    this.potLocal = new THREE.Vector3(); // pot-local position while frying in the oil
    this.potLocalVelocityY = 0;
    this.restQuaternion = new THREE.Quaternion();
    this.timer = 0; // time spent in the current resolved state
    this.fade = 0; // 0..1 shrink-out progress before returning to the pool
    this.active = false;
    this.scored = false;
    this.golden = false; // the rare bonus latke
    this.lastClank = -1;
    this.hitDreidels = new Set(); // each dreidel rains gelt once per latke
    this.hitMenorah = false; // each latke puts out at most one candle
  }
}

const _launchHeading = new THREE.Vector3();
const _launchRight = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _localHit = new THREE.Vector3();
const _worldHit = new THREE.Vector3();
const _candlePosition = new THREE.Vector3();
const _screen = new THREE.Vector3();
const _yawQuaternion = new THREE.Quaternion();
const _tiltQuaternion = new THREE.Quaternion();
const _tiltAxis = new THREE.Vector3();

export class Game {
  constructor({ gameScene, ui, audio }) {
    this.gameScene = gameScene;
    this.scene = gameScene.scene;
    this.camera = gameScene.camera;
    this.ui = ui;
    this.audio = audio;

    this.pot = new Pot(this.scene);
    this.pool = new LatkePool(this.scene);
    this.effects = new SplashEffects(this.scene);
    this.gelt = new GeltShower(this.scene, this.audio, gameScene.dreidels);
    this.aimVisuals = new AimVisuals(this.scene);
    this.scores = new ScoreStore();
    this.bestStats = new StatsStore();

    this.thrown = Array.from({ length: this.pool.all.length }, () => new ThrownLatke());
    this.current = null; // latke on the plate (state AIMING) or null until the next one spawns

    this.state = GameState.MENU;
    this.pausedFrom = null;
    this.difficultyKey = loadDifficulty();
    this.scoring = new RoundScore(); // score, streak, menorah, dreidel boosts, Final Fry
    this.potTime = 0; // drives pot motion; runs faster during the Final Fry
    this.round = { throws: 0, hits: 0, clean: 0, bestStreak: 0 }; // this round's stats
    this.roundStats = null; // filled in at the buzzer for the game-over screen
    this.latkesSinceGolden = 0;
    this.log = []; // everything that changed the score, for the leaderboard to replay
    this.throwCount = 0;
    this.ticket = null; // the leaderboard's ticket for this round (a promise)
    this.simTime = 0; // fixed-step simulation clock (idle bob, rim-clank spacing)
    this.roundElapsed = 0; // drives the countdown; only advances while PLAYING
    this.accumulator = 0;
    this.readyTimer = 0;
    this.respawnTimer = -1;
    this.gameOverTimer = -1;
    this.menuTime = 0;
    this.lastTickSecond = null;
    this.hasThrown = false;
    this.isAiming = false;
    this.aimLift = 0;
    this.potPrevious = new THREE.Vector3();
    this.potCurrent = new THREE.Vector3();

    this.aimController = new AimController(gameScene.renderer.domElement, this.camera, {
      canStartAim: () => this.state === GameState.PLAYING && !!this.current,
      getLatkePosition: () => (this.current ? this.current.mesh.position : null),
      onAimStart: (aim) => this._onAimStart(aim),
      onAimChange: (aim) => this._onAimChange(aim),
      onThrow: (aim) => this._onThrow(aim),
      onCancel: () => this._onAimCancel(),
      onHover: (over) => this.ui.setGrabCursor(over),
    });

    this.ui.bind({
      onStart: () => this.startRound(),
      onRestart: () => this.restart(),
      onPauseToggle: () => this.togglePause(),
      onMenu: () => this.returnToMenu(),
      onMuteToggle: () => this.ui.setMuted(this.audio.toggleMuted()),
      onDifficulty: (key) => this.selectDifficulty(key),
      onAnyInteraction: () => this.audio.unlock(),
    });
    this._bindClicks();
    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === GameState.PLAYING || this.state === GameState.READY)) this.togglePause();
    });

    this.ui.setMuted(this.audio.muted);
    this.ui.setBestScores(this.scores.all());
    this.selectDifficulty(this.difficultyKey, false);
    this.ui.showScreen('menu');
    this._resetRound();
    // Starts once the first click/tap unlocks audio.
    this.audio.music.playMenu();
  }

  get score() {
    return this.scoring.score;
  }

  get multiplier() {
    return this.scoring.multiplier;
  }

  get streak() {
    return this.scoring.streak;
  }

  get finalFry() {
    return this.scoring.finalFry;
  }

  // UI click sounds for every button.
  _bindClicks() {
    for (const button of document.querySelectorAll('button')) {
      button.addEventListener('click', () => this.audio.play('click'));
    }
  }

  _onKeyDown(event) {
    if (event.key === 'Escape' && this.ui.currentScreen === 'leaderboard') {
      this.ui.closeLeaderboard();
      return;
    }
    if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
      if (this.state === GameState.PLAYING || this.state === GameState.READY || this.state === GameState.PAUSED) {
        event.preventDefault();
        this.togglePause();
      }
    }
  }

  // ---------- State transitions ----------

  selectDifficulty(key, persist = true) {
    if (!DIFFICULTIES[key]) return;
    if (this.state !== GameState.MENU && this.state !== GameState.GAME_OVER) return;
    this.difficultyKey = key;
    this.pot.setDifficulty(key);
    this.ui.setDifficulty(key);
    this.ui.setBest(this.scores.get(key));
    this.menuTime = 0;
    if (persist) saveDifficulty(key);
  }

  startRound() {
    this.audio.unlock();
    this._resetRound();
    // The leaderboard only accepts a round that asked for a ticket when it started.
    this.ticket = leaderboard.startRound(this.difficultyKey);
    this.state = GameState.READY;
    this.readyTimer = ROUND.readySeconds;
    this.ui.showScreen(null);
    this.ui.setHudVisible(true);
    this.ui.setPaused(false);
    this.ui.showHint(!this.hasThrown);
    this.ui.showBanner('Ready?', { duration: 0 });
    this.audio.music.playGameplay();
  }

  restart() {
    if (this.state === GameState.MENU) return;
    this.startRound();
  }

  togglePause() {
    if (this.state === GameState.PAUSED) {
      this.state = this.pausedFrom;
      this.pausedFrom = null;
      this.ui.showScreen(null);
      this.ui.setPaused(false);
      this.audio.music.resume();
      if (this.state === GameState.READY) this.ui.showBanner('Ready?', { duration: 0 });
      return;
    }
    if (this.state !== GameState.PLAYING && this.state !== GameState.READY) return;
    this.aimController.cancel();
    this.pausedFrom = this.state;
    this.state = GameState.PAUSED;
    this.ui.hideBanner();
    this.ui.showScreen('pause');
    this.ui.setPaused(true);
    this.audio.music.pause();
  }

  returnToMenu() {
    this.aimController.cancel();
    this._resetRound();
    this.state = GameState.MENU;
    this.pausedFrom = null;
    this.menuTime = 0;
    this.ui.setHudVisible(false);
    this.ui.showHint(false);
    this.ui.hideBanner();
    this.ui.setBestScores(this.scores.all());
    this.ui.showScreen('menu');
    this.audio.music.playMenu();
  }

  _endRound() {
    // Buzzer: stop input and scoring immediately; in-flight effects keep animating briefly.
    this.state = GameState.GAME_OVER;
    this.aimController.cancel();
    this.aimVisuals.hide();
    this.respawnTimer = -1;
    this.roundElapsed = ROUND.durationSeconds;
    this.ui.setTime(0);
    this.ui.showBanner("Time's up!", { gold: true, duration: 0 });
    this.ui.fadeHint();
    this.isNewBest = this.scores.submit(this.difficultyKey, this.score);
    this._finishRoundStats();
    this.gameOverTimer = ROUND.gameOverDelaySeconds;
    this.audio.play('tick');
  }

  // The last stretch of the round: double points, a faster pot and faster music.
  _startFinalFry() {
    this._updateMultiplier();
    this.ui.setFinalFry(true);
    this.ui.showBanner(`Final Fry! ${FINAL_FRY.multiplier}\u00d7`, { gold: true, duration: 1300 });
    this.audio.play('finalFry');
    this.audio.music.setRate(FINAL_FRY.musicRate);
  }

  _potRate() {
    return this.finalFry ? FINAL_FRY.potSpeed : 1;
  }

  // Freezes this round's stats at the buzzer and checks them against the personal bests.
  _finishRoundStats() {
    const { throws, hits, clean, bestStreak } = this.round;
    const accuracy = throws > 0 ? Math.round((hits / throws) * 100) : 0;
    const counts = throws >= STATS.minThrowsForAccuracy;
    const result = this.bestStats.submit(this.difficultyKey, {
      accuracy: counts ? accuracy : null,
      streak: bestStreak,
      clean,
    });
    this.roundStats = { throws, hits, clean, bestStreak, accuracy, accuracyCounts: counts, ...result };
  }

  _showGameOver() {
    this.ui.hideBanner();
    this.ui.setHudVisible(false);
    this.ui.showHint(false);
    this.ui.setBestScores(this.scores.all());
    this.ui.showGameOver({
      score: this.score,
      difficulty: this.difficultyKey,
      difficultyLabel: DIFFICULTIES[this.difficultyKey].label,
      best: this.scores.get(this.difficultyKey),
      isNewBest: this.isNewBest,
      stats: this.roundStats,
      round: { ticket: this.ticket, events: this.log },
    });
    this.audio.play('gameOver');
    this.audio.music.playMenu();
    if (this.isNewBest) setTimeout(() => this.audio.play('newBest'), 700);
  }

  // Clears everything round-specific: latkes, effects, timers, score and pot phase.
  _resetRound() {
    this.aimController.cancel();
    for (const thrown of this.thrown) this._retire(thrown);
    this.pool.releaseAll();
    this.current = null;
    this.effects.clear();
    this.gelt.clear();
    this.gameScene.resetDreidels();
    this.gameScene.resetCandles();
    this.scoring.reset();
    // A new array each round, because the game-over screen keeps the old one until it's submitted.
    this.log = [];
    this.throwCount = 0;
    this.latkesSinceGolden = 0;
    this.ui.setStreak(0);
    this.potTime = 0;
    this.round = { throws: 0, hits: 0, clean: 0, bestStreak: 0 };
    this.roundStats = null;
    this.ui.setFinalFry(false);
    this.audio.music.setRate(1);
    this._updateMultiplier();
    this.pot.randomizePlacement();
    this.pot.reset();
    this.aimVisuals.hide();
    this.simTime = 0;
    this.roundElapsed = 0;
    this.accumulator = 0;
    this.respawnTimer = -1;
    this.gameOverTimer = -1;
    this.lastTickSecond = null;
    this.isNewBest = false;
    this.isAiming = false;
    this.aimLift = 0;
    this.ui.setScore(0);
    this.ui.resetTime();
    this.ui.setTime(ROUND.durationSeconds);
    this.ui.setBest(this.scores.get(this.difficultyKey));
    this.ui.clearPopups();
    this.pot.positionAt(0, this.potCurrent);
    this.potPrevious.copy(this.potCurrent);
    this._spawnLatke();
  }

  // ---------- Latke lifecycle ----------

  _spawnLatke() {
    let mesh = this.pool.acquire();
    if (!mesh) {
      // Pool exhausted: recycle the oldest resolved latke that is still fading out.
      let oldest = null;
      for (const thrown of this.thrown) {
        if (thrown.active && thrown.body.state !== LatkeState.AIRBORNE && (!oldest || thrown.timer > oldest.timer)) oldest = thrown;
      }
      if (!oldest) return;
      this._retire(oldest);
      mesh = this.pool.acquire();
      if (!mesh) return;
    }
    const thrown = this.thrown.find((candidate) => !candidate.active);
    thrown.active = true;
    thrown.mesh = mesh;
    thrown.baseScale.copy(mesh.scale);
    thrown.timer = 0;
    thrown.fade = 0;
    thrown.scored = false;
    thrown.lastClank = -1;
    thrown.hitDreidels.clear();
    thrown.hitMenorah = false;
    // Now and then (never first in a round) the next latke is a golden bonus latke.
    thrown.golden = this.state === GameState.PLAYING
      && this.latkesSinceGolden >= GOLDEN.minGap
      && Math.random() < GOLDEN.chance;
    this.latkesSinceGolden = thrown.golden ? 0 : this.latkesSinceGolden + 1;
    setLatkeGolden(mesh, thrown.golden);
    if (thrown.golden) {
      this.ui.showBanner('Golden Latke!', { gold: true, duration: 1100 });
      this.audio.play('golden');
    }
    // Random resting yaw shows a different side of the irregular outline each time.
    thrown.restQuaternion.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    thrown.body.reset(REST_POSITION, thrown.restQuaternion);
    thrown.body.state = LatkeState.AIMING;
    mesh.position.copy(REST_POSITION);
    mesh.quaternion.copy(thrown.restQuaternion);
    this.current = thrown;
    this.currentAim = null;
    this.aimLift = 0;
  }

  _retire(thrown) {
    if (!thrown.active) return;
    thrown.active = false;
    thrown.body.state = LatkeState.INACTIVE;
    if (thrown.mesh) {
      thrown.mesh.scale.copy(thrown.baseScale);
      this.pool.release(thrown.mesh);
    }
    thrown.mesh = null;
    if (this.current === thrown) this.current = null;
  }

  _onAimStart(aim) {
    this.isAiming = true;
    this.ui.setAimingCursor(true);
    this._onAimChange(aim);
  }

  _onAimChange(aim) {
    this.aimVisuals.show(aim, DIFFICULTIES[this.difficultyKey].previewFraction);
    this.currentAim = aim;
  }

  _onAimCancel() {
    this.isAiming = false;
    this.ui.setAimingCursor(false);
    this.aimVisuals.hide();
  }

  _onThrow(aim) {
    this.isAiming = false;
    this.ui.setAimingCursor(false);
    this.aimVisuals.hide();
    if (this.state !== GameState.PLAYING || !this.current) return;

    const thrown = this.current;
    const body = thrown.body;
    // Launch from the exact point the preview used, with the same velocity.
    body.reset(LAUNCH_POSITION, thrown.mesh.quaternion);
    body.velocity.copy(aim.velocity);
    body.state = LatkeState.AIRBORNE;
    thrown.throwIndex = this.throwCount;
    this.throwCount += 1;
    this._record('throw', thrown, thrown.golden ? 'golden' : undefined);

    // Dominant tumble around the horizontal axis perpendicular to the heading, plus a
    // random spin around vertical and a little wobble, so each toss flips differently.
    _launchHeading.set(Math.sin(aim.yaw), 0, -Math.cos(aim.yaw));
    _launchRight.crossVectors(_launchHeading, _up);
    const flipDirection = Math.random() < 0.8 ? -1 : 1;
    const flipSpeed = LAUNCH.minFlipSpeed + Math.random() * (LAUNCH.maxFlipSpeed - LAUNCH.minFlipSpeed);
    body.angularVelocity.copy(_launchRight).multiplyScalar(flipDirection * flipSpeed);
    body.angularVelocity.addScaledVector(_up, (Math.random() - 0.5) * 5);
    body.angularVelocity.addScaledVector(_launchHeading, (Math.random() - 0.5) * 2.4);

    // The next latke arrives shortly after launch, without waiting for this one to land.
    this.current = null;
    this.respawnTimer = ROUND.respawnDelaySeconds;
    this.hasThrown = true;
    this.ui.fadeHint();
    this.audio.play('launch');
  }

  _resolve(thrown, state) {
    thrown.body.state = state;
    thrown.timer = 0;
  }

  /** Adds to the round log. See supabase/functions/latke-toss-score/verify.js for the format. */
  _record(type, thrown, detail) {
    const entry = [this.roundElapsed, type, thrown.throwIndex];
    if (detail !== undefined) entry.push(detail);
    this.log.push(entry);
  }

  _registerHit(thrown, localHit) {
    thrown.scored = true;
    this._resolve(thrown, LatkeState.SUCCESS);
    this._startFrying(thrown, localHit);
    const clean = !thrown.body.touchedPot;
    this._record('hit', thrown, clean ? 'clean' : undefined);
    const landed = this.scoring.landLatke({ golden: thrown.golden, clean });
    this._showStreak(landed.newTier);
    this.round.throws += 1;
    this.round.hits += 1;
    if (clean) this.round.clean += 1;
    const { points } = landed;
    this.ui.setScore(this.score, true);

    _worldHit.set(localHit.x, POT.oilHeight, localHit.z).add(this.potCurrent);
    this.effects.splash(_worldHit);
    this.pot.splash(localHit.x, localHit.z);
    this.audio.play('splash');

    _worldHit.y += 0.6;
    const notes = [];
    if (thrown.golden) notes.push('Golden!');
    if (clean) notes.push(`Mazal! +${SCORING.cleanBonus}`);
    if (this.streak >= 2) notes.push(`${this.streak} in a row`);
    // The multiplier this latke scored with, not the menorah bonus its candle may start.
    const style = thrown.golden ? 'golden' : landed.multiplier > 1 ? 'double' : '';
    this._popupAt(_worldHit, `+${points}${notes.length ? `<small>${notes.join(' \u00b7 ')}</small>` : ''}`, style);
    if (thrown.golden) this.effects.sparkleBurst(_worldHit);
    this._lightCandle(landed.menorahLit);
  }

  // A landed latke has extended the streak and may have reached a higher streak tier.
  _showStreak(newTier) {
    this.round.bestStreak = Math.max(this.round.bestStreak, this.streak);
    this.ui.setStreak(this.streak);
    if (newTier) {
      this._updateMultiplier();
      this.ui.showBanner(`${this.streak} in a row! ${this.scoring.streakMultiplier}\u00d7`, { gold: true, duration: 1100 });
      this.audio.play('streak');
    }
  }

  // A miss ends the streak. Returns how long the streak was.
  _breakStreak() {
    const { lost, tierLost } = this.scoring.missLatke();
    this.ui.setStreak(0);
    if (tierLost) this._updateMultiplier();
    return lost;
  }

  // Each landed latke lights one menorah candle; lighting the last one starts the bonus.
  _lightCandle(menorahLit) {
    const lit = this.gameScene.lightNextCandle(_candlePosition);
    if (lit === 0) return;
    this.effects.sparkleBurst(_candlePosition);
    this.audio.play('candle', lit);
    if (menorahLit) {
      this.gameScene.setMiracle(true);
      this._updateMultiplier();
      this.ui.showBanner(`${MENORAH.multiplier}\u00d7 Points!`, { gold: true, duration: 1800 });
      setTimeout(() => this.audio.play('miracle'), 250);
    }
  }

  _startFrying(thrown, localHit) {
    thrown.potLocal.copy(localHit);
    // Velocity relative to the pot, so the latke keeps falling naturally toward the oil.
    thrown.potLocalVelocityY = Math.min(0, thrown.body.velocity.y);
    thrown.body.angularVelocity.multiplyScalar(0.5);
  }

  _registerMiss(thrown, label = true) {
    this._resolve(thrown, LatkeState.MISS);
    if (this.state !== GameState.PLAYING) return;
    this._record('miss', thrown);
    this.round.throws += 1;
    const lost = this._breakStreak();
    if (label) {
      _worldHit.copy(thrown.body.position);
      _worldHit.y += 0.4;
      const note = lost >= 3 ? '<small>Streak lost</small>' : '';
      this._popupAt(_worldHit, `OY!${note}`, 'miss');
    }
  }

  _registerDreidelHit(thrown, dreidel) {
    this.gameScene.knockDreidel(dreidel);
    this.gelt.rain();
    _worldHit.copy(dreidel.position);
    _worldHit.y += dreidel.userData.hitHeight;
    this.effects.sparkleBurst(_worldHit);
    this.audio.play('dreidel');
    _worldHit.y += 0.4;
    if (this.state !== GameState.PLAYING) {
      this._popupAt(_worldHit, 'Gelt!', 'gelt');
      return;
    }
    this._record('dreidel', thrown, this.gameScene.dreidels.indexOf(dreidel));
    this.scoring.hitDreidel(this.roundElapsed);
    this._updateMultiplier();
    this._popupAt(_worldHit, `Gelt!<small>${DREIDEL.bonusMultiplier}\u00d7 for ${DREIDEL.bonusSeconds}s</small>`, 'gelt');
  }

  // Knocking the menorah shakes it and puts out the most recently lit candle.
  _registerMenorahHit(thrown) {
    this.gameScene.knockMenorah();
    this.audio.play('rim');
    if (this.state !== GameState.PLAYING) return;
    this._record('menorah', thrown);
    const { bonusLost } = this.scoring.hitMenorah();
    if (!this.gameScene.extinguishCandle(_candlePosition)) return;
    if (bonusLost) {
      // The bonus needs every candle lit, so losing one ends it until they are all lit again.
      this.gameScene.setMiracle(false);
      this._updateMultiplier();
    }
    _candlePosition.y += 0.3;
    this._popupAt(_candlePosition, 'Candle out!', 'miss');
  }

  // Shows the combined menorah, dreidel, streak and Final Fry multiplier.
  _updateMultiplier() {
    this.ui.setMultiplier(this.multiplier);
  }

  _popupAt(world, html, className) {
    _screen.copy(world).project(this.camera);
    if (_screen.z > 1) return;
    const x = (_screen.x + 1) * 0.5 * this.gameScene.viewportWidth;
    const y = (1 - _screen.y) * 0.5 * this.gameScene.viewportHeight;
    this.ui.popup(x, y, html, className);
  }

  // ---------- Simulation ----------

  /** One fixed physics step of length h. */
  _step(h) {
    if (this.state === GameState.PLAYING) {
      this.roundElapsed += h;
      if (this.scoring.expireBoosts(this.roundElapsed)) this._updateMultiplier();
      if (this.scoring.checkFinalFry(this.roundElapsed)) this._startFinalFry();
      if (this.roundElapsed >= ROUND.durationSeconds) this._endRound();
    }
    // The pot keeps gliding during the brief game-over wind-down; the timer does not.
    this.simTime += h;
    this.potTime += h * this._potRate();
    this.potPrevious.copy(this.potCurrent);
    this.pot.positionAt(this.potTime, this.potCurrent);

    const scoringOpen = this.state === GameState.PLAYING;
    for (const thrown of this.thrown) {
      if (!thrown.active) continue;
      const body = thrown.body;
      switch (body.state) {
        case LatkeState.AIRBORNE:
        case LatkeState.MISS:
          this._stepLoose(thrown, h, scoringOpen);
          break;
        case LatkeState.SUCCESS:
          this._stepFrying(thrown, h);
          break;
        default:
          break;
      }
    }
  }

  _stepLoose(thrown, h, scoringOpen) {
    const body = thrown.body;
    stepBody(body, h);
    if (body.state === LatkeState.MISS) thrown.timer += h;

    const canScore = scoringOpen && body.state === LatkeState.AIRBORNE;
    const potHit = collideWithPot(body, this.potPrevious, this.potCurrent, canScore, _localHit);
    if (potHit === CollisionResult.SUCCESS) {
      this._registerHit(thrown, _localHit);
      return;
    }
    if (potHit === CollisionResult.ENTERED) {
      // Dropped in after the buzzer (or after already missing): sink it without scoring.
      if (body.state === LatkeState.AIRBORNE) this._registerMiss(thrown, false);
      body.state = LatkeState.SUCCESS;
      this._startFrying(thrown, _localHit);
      return;
    }
    if (potHit === CollisionResult.RIM || potHit === CollisionResult.WALL) {
      if (thrown.lastClank < 0 || this.simTime - thrown.lastClank > 0.25) {
        this.audio.play('rim');
        thrown.lastClank = this.simTime;
      }
    }

    for (const dreidel of this.gameScene.dreidels) {
      if (collideWithDreidel(body, dreidel) && !thrown.hitDreidels.has(dreidel)) {
        thrown.hitDreidels.add(dreidel);
        this._registerDreidelHit(thrown, dreidel);
      }
    }
    if (collideWithMenorah(body, this.gameScene.menorah) && !thrown.hitMenorah) {
      thrown.hitMenorah = true;
      this._registerMenorahHit(thrown);
    }

    const tableHit = collideWithTable(body, h);
    if (tableHit === CollisionResult.OUT_OF_BOUNDS) {
      if (body.state === LatkeState.AIRBORNE) this._registerMiss(thrown, false);
      this._retire(thrown);
      return;
    }
    if (tableHit === CollisionResult.TABLE) {
      this.effects.thud(body.position);
      if (body.state === LatkeState.AIRBORNE) {
        this._registerMiss(thrown);
        this.audio.play('miss');
      }
    }
    if (body.state === LatkeState.AIRBORNE && body.flightTime > PHYSICS.maxFlightSeconds) {
      this._registerMiss(thrown, false);
    }

    if (body.touchedTable) {
      // Settle flat onto the table instead of standing on edge.
      this._flatten(body.quaternion, 6 * h);
    }

    if (body.state === LatkeState.MISS && (body.restingTime > 0.35 || thrown.timer > MISS_LINGER_SECONDS)) {
      thrown.fade += h / FADE_SECONDS;
      if (thrown.fade >= 1) this._retire(thrown);
    }
  }

  // Rotates a quaternion toward lying flat (local +Y up) while keeping its heading.
  _flatten(quaternion, amount) {
    _tiltAxis.set(0, 1, 0).applyQuaternion(quaternion);
    if (_tiltAxis.y < 0) _tiltAxis.negate(); // either face down is fine
    _tiltQuaternion.setFromUnitVectors(_tiltAxis, _up);
    _tiltQuaternion.multiply(quaternion);
    quaternion.slerp(_tiltQuaternion, Math.min(1, amount));
  }

  /**
   * Success animation in pot-local space: the latke drops to the oil, settles flat, bobs,
   * darkens as it fries, then sinks below the surface and returns to the pool. Working in
   * pot-local coordinates keeps it inside the pot even when the pot is moving.
   */
  _stepFrying(thrown, h) {
    const body = thrown.body;
    body.previousPosition.copy(body.position);
    body.previousQuaternion.copy(body.quaternion);
    thrown.timer += h;

    const local = thrown.potLocal;
    const floatHeight = POT.oilHeight + LATKE.thickness * 0.25;
    if (local.y > floatHeight) {
      thrown.potLocalVelocityY -= PHYSICS.gravity * h;
      local.y = Math.max(floatHeight, local.y + thrown.potLocalVelocityY * h);
    } else {
      const sink = Math.max(0, thrown.timer - FRY_SECONDS * 0.65) * 0.22;
      local.y = floatHeight + Math.sin(thrown.timer * 9) * 0.008 - sink;
    }
    // Drift toward the center so the latke never clips through the pot wall.
    const maxRadial = POT.openingRadius - LATKE.radius * thrown.baseScale.x - 0.03;
    const radial = Math.hypot(local.x, local.z);
    if (radial > maxRadial) {
      const pull = Math.max(maxRadial / radial, 1 - 10 * h);
      local.x *= pull;
      local.z *= pull;
    }
    body.position.copy(this.potCurrent).add(local);

    body.angularVelocity.multiplyScalar(Math.max(0, 1 - 6 * h));
    body.quaternion.premultiply(_yawQuaternion.setFromAxisAngle(_up, 0.6 * h));
    this._flatten(body.quaternion, 9 * h);

    const material = thrown.mesh.userData.material;
    material.color.copy(latkeBaseColor(thrown.mesh)).lerp(FRIED_COLOR, Math.min(1, thrown.timer / FRY_SECONDS) * 0.5);

    if (thrown.timer > FRY_SECONDS) {
      thrown.fade += h / FADE_SECONDS;
      if (thrown.fade >= 1) this._retire(thrown);
    }
  }

  // ---------- Frame update ----------

  update(dt) {
    switch (this.state) {
      case GameState.PAUSED:
        // Everything gameplay-related is frozen; just keep the current pose on screen.
        return;
      case GameState.MENU:
        this._updateMenu(dt);
        return;
      case GameState.READY:
        this._updateReady(dt);
        return;
      default:
        break;
    }

    // PLAYING or GAME_OVER wind-down: fixed-timestep simulation with an accumulator.
    const h = PHYSICS.fixedTimestep;
    this.accumulator += Math.min(dt, PHYSICS.maxFrameTime);
    while (this.accumulator >= h) {
      this._step(h);
      this.accumulator -= h;
    }
    const alpha = this.accumulator / h;

    if (this.state === GameState.PLAYING) {
      const timeLeft = ROUND.durationSeconds - this.roundElapsed;
      this.ui.setTime(timeLeft);
      const second = Math.ceil(timeLeft);
      if (second <= 5 && second > 0 && second !== this.lastTickSecond) {
        this.lastTickSecond = second;
        this.audio.play('tick');
      }
      if (this.respawnTimer >= 0) {
        // Clamped at 0 so spawning retries each frame if every latke is still airborne.
        this.respawnTimer = Math.max(0, this.respawnTimer - dt);
        if (this.respawnTimer === 0 && !this.current) this._spawnLatke();
        if (this.current) this.respawnTimer = -1;
      }
    } else if (this.state === GameState.GAME_OVER && this.gameOverTimer > 0) {
      this.gameOverTimer -= dt;
      if (this.gameOverTimer <= 0) this._showGameOver();
    }

    // Render the pot between physics steps for smooth motion at any refresh rate.
    this.pot.setTime(this.potTime - h * this._potRate() * (1 - alpha));
    this.pot.update(dt);
    this.effects.update(dt);
    this.gelt.update(dt, this.pot.group.position);
    this._renderLatkes(alpha, dt);
  }

  _updateMenu(dt) {
    // Preview the selected difficulty's pot motion behind the menu.
    this.menuTime += dt;
    this.pot.setTime(this.menuTime);
    this.pot.update(dt);
    this.effects.update(dt);
    this._renderLatkes(1, dt);
  }

  _updateReady(dt) {
    this.readyTimer -= dt;
    this.pot.setTime(0);
    this.pot.update(dt);
    this.effects.update(dt);
    this._renderLatkes(1, dt);
    if (this.readyTimer <= 0) {
      this.state = GameState.PLAYING;
      this.accumulator = 0;
      this.ui.showBanner('Go!', { gold: true, duration: 700 });
      this.audio.play('go');
    }
  }

  _renderLatkes(alpha, dt) {
    for (const thrown of this.thrown) {
      if (!thrown.active || !thrown.mesh) continue;
      const mesh = thrown.mesh;
      const body = thrown.body;
      if (body.state === LatkeState.AIMING) {
        // Waiting on the plate: lift to the launch point while aiming, with a slight
        // wobble and a backward tilt that grows with power.
        const targetLift = this.isAiming && thrown === this.current ? 1 : 0;
        this.aimLift += (targetLift - this.aimLift) * Math.min(1, dt * 14);
        mesh.position.lerpVectors(REST_POSITION, LAUNCH_POSITION, this.aimLift);
        const power = this.isAiming && this.currentAim ? this.currentAim.power : 0;
        const yaw = this.isAiming && this.currentAim ? this.currentAim.yaw : 0;
        _tiltAxis.set(Math.cos(yaw), 0, Math.sin(yaw));
        _tiltQuaternion.setFromAxisAngle(_tiltAxis, 0.35 * power * this.aimLift);
        mesh.quaternion.copy(_tiltQuaternion).multiply(thrown.restQuaternion);
        if (this.state === GameState.PLAYING && !this.isAiming) {
          // Gentle idle bob inviting the player to grab it.
          mesh.position.y += Math.max(0, Math.sin(this.simTime * 4)) * 0.03;
        }
        mesh.scale.copy(thrown.baseScale);
        continue;
      }
      mesh.position.lerpVectors(body.previousPosition, body.position, alpha);
      mesh.quaternion.slerpQuaternions(body.previousQuaternion, body.quaternion, alpha);
      const shrink = 1 - Math.min(1, thrown.fade);
      mesh.scale.copy(thrown.baseScale).multiplyScalar(Math.max(0.001, shrink));
    }
  }
}
