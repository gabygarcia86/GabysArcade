import * as THREE from 'three';
import {
  ROUND, PHYSICS, LAUNCH, SERVING, SLICE, PLATE, PLATES, BOWLS, TABLE_COMPLETE, GIANT_TURKEY, FLYING_TURKEY,
  CORNUCOPIA, FLOOR,
} from './config.js';
import { PhysicsWorld, Surface, bounceVelocity, enteredBowl, layFlat, segmentDistance } from './physics.js';
import { Plate, Bowl, GiantTurkey, FlyingTurkey, FlightPhase, ServingPlatter } from './props.js';
import { SlicePool } from './slices.js';
import { Effects } from './effects.js';
import { FruitShower } from './fruit.js';
import { AimController, AimVisuals } from './throwing.js';
import { Multipliers } from './multipliers.js';
import { scoreLanding, addScore, formatNumber, resultMessage } from './scoring.js';

export const GameState = Object.freeze({
  MENU: 'MENU',
  READY: 'READY',
  PLAYING: 'PLAYING',
  // The clock or the slices ran out, but slices in the air can still land.
  WIND_DOWN: 'WIND_DOWN',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

export const SliceState = Object.freeze({
  INACTIVE: 'inactive',
  AIMING: 'aiming',
  FLYING: 'flying', // can still score
  LOOSE: 'loose', // can't score; lingers, then fades out
  PLATED: 'plated', // scored and staying on its plate
  SINKING: 'sinking', // scored and sliding into a bowl
});

// Where a fresh slice rests and where throws are launched from.
const REST_POSITION = new THREE.Vector3(SERVING.x, SERVING.restHeight, SERVING.z);
const LAUNCH_POSITION = new THREE.Vector3(SERVING.x, SERVING.launchHeight, SERVING.z);
// Seconds a slice can lie still somewhere that isn't a plate before it counts as a miss.
const STILL_SECONDS = 0.35;
// Seconds a missed slice stays on the table, then how long it takes to shrink away.
const MISS_LINGER_SECONDS = 0.9;
const FADE_SECONDS = 0.3;
const SINK_SECONDS = 0.8;
// Seconds a plate contact is remembered, because a resting slice's contact can flicker.
const PLATE_TOUCH_SECONDS = 0.1;
const STACK_GAP = 0.04;

const BEST_KEY = 'turkeyToss.bestScore.v1';

function loadBest() {
  try {
    const value = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0; // localStorage unavailable: fall back to an in-memory best
  }
}

function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage blocked: the best score lasts for this session only.
  }
}

/** One slice's whole life: on the platter, in the air, then on a plate, in a bowl or missed. */
class Slice {
  constructor(physics) {
    this.physics = physics.createSliceBody();
    this.mesh = null;
    this.state = SliceState.INACTIVE;
    this.restQuaternion = new THREE.Quaternion();
    this.startPosition = new THREE.Vector3();
    this.startQuaternion = new THREE.Quaternion();
    this.targetPosition = new THREE.Vector3();
    this.targetQuaternion = new THREE.Quaternion();
    this.reset();
  }

  reset() {
    this.flightTime = 0;
    this.timer = 0;
    this.fade = 0;
    this.settle = 0; // seconds spent nearly still on a plate
    this.still = 0; // seconds spent nearly still anywhere
    this.plate = null;
    this.touchPlate = null;
    this.touchTime = 0;
    this.bounces = 0;
    this.lastBounce = -1;
    this.thudded = false;
    this.hitCornucopia = false; // each slice can only trigger the shower once
    this.floored = false; // each slice only costs points once
    this.phase = Math.random() * 6.28; // desynchronizes the flop between slices
    this.bowlCenter = null;
  }
}

const _launchHeading = new THREE.Vector3();
const _launchRight = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _angular = new THREE.Vector3();
const _point = new THREE.Vector3();
const _screen = new THREE.Vector3();
const _renderPosition = new THREE.Vector3();
const _renderQuaternion = new THREE.Quaternion();
const _previousQuaternion = new THREE.Quaternion();
const _tiltQuaternion = new THREE.Quaternion();
const _tiltAxis = new THREE.Vector3();

export class Game {
  constructor({ gameScene, ui, audio }) {
    this.gameScene = gameScene;
    this.scene = gameScene.scene;
    this.camera = gameScene.camera;
    this.ui = ui;
    this.audio = audio;

    this.physics = new PhysicsWorld();
    this.plates = PLATES.map((def) => new Plate(this.scene, def));
    for (const plate of this.plates) this.physics.addPlate(plate);
    this.bowls = Object.entries(BOWLS).map(([kind, def]) => new Bowl(this.scene, kind, def));
    for (const bowl of this.bowls) this.physics.addBowl(bowl);
    this.giantTurkey = new GiantTurkey(this.scene);
    this.physics.addGiantTurkey(this.giantTurkey.colliders);
    for (const [x, y, z, radius] of gameScene.decorColliders) this.physics.addDecorSphere(x, y, z, radius);
    for (const box of gameScene.decorBoxes) this.physics.addDecorBox(...box);
    this.physics.addCornucopia(gameScene.cornucopiaColliders);
    this.flyingTurkey = new FlyingTurkey(this.scene);

    this.pool = new SlicePool(this.scene);
    this.serving = new ServingPlatter(this.scene, this.pool);
    this.slices = this.pool.all.map(() => new Slice(this.physics));
    this.effects = new Effects(this.scene);
    this.fruit = new FruitShower(this.scene, this.audio, this._fruitObstacles(gameScene));
    this.aimVisuals = new AimVisuals(this.scene, LAUNCH_POSITION, REST_POSITION);
    this.multipliers = new Multipliers();

    this.state = GameState.MENU;
    this.pausedFrom = null;
    this.current = null; // slice on the platter, or null until the next one spawns
    this.best = loadBest();
    this.simTime = 0;
    this.elapsed = 0;
    this.accumulator = 0;
    this.hasThrown = false;
    this.isAiming = false;
    this.aimLift = 0;
    this.currentAim = null;

    this.aimController = new AimController(gameScene.renderer.domElement, this.camera, {
      canStartAim: () => this.state === GameState.PLAYING && !!this.current,
      getSlicePosition: () => (this.current ? this.current.mesh.position : null),
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
      onSfxVolume: (value) => this.audio.setSfxVolume(value),
      onMusicVolume: (value) => this.audio.setMusicVolume(value),
      onAnyInteraction: () => this.audio.unlock(),
    });
    this._bindClicks();
    window.addEventListener('keydown', (event) => this._onKeyDown(event));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this._isRunning()) this.togglePause();
    });

    this.ui.setMuted(this.audio.muted);
    this.ui.setVolumes(this.audio.sfxVolume, this.audio.musicVolume);
    this.ui.setBest(this.best);
    this.ui.showScreen('menu');
    this._resetRound();
    // Starts once the first click/tap unlocks audio.
    this.audio.music.playMenu();
  }

  // Everything falling fruit should bounce off, as [x, y, z, radius] spheres.
  _fruitObstacles(gameScene) {
    return [
      ...gameScene.decorColliders,
      ...gameScene.cornucopiaColliders,
      ...this.giantTurkey.colliders.map(([x, y, z, radius]) => [x + GIANT_TURKEY.x, y, z + GIANT_TURKEY.z, radius]),
      ...this.bowls.map((bowl) => [bowl.x, 0.1, bowl.z, bowl.outerRadius]),
    ];
  }

  // UI click sounds for every button.
  _bindClicks() {
    for (const button of document.querySelectorAll('button')) {
      button.addEventListener('click', () => this.audio.play('click'));
    }
  }

  _isRunning() {
    return this.state === GameState.PLAYING || this.state === GameState.READY || this.state === GameState.WIND_DOWN;
  }

  _onKeyDown(event) {
    if (event.key === 'Escape' && this.ui.closeSubScreen()) return;
    if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') {
      if (event.target instanceof HTMLInputElement && event.target.type === 'text') return;
      if (this._isRunning() || this.state === GameState.PAUSED) {
        event.preventDefault();
        this.togglePause();
      }
    }
  }

  // ---------- State transitions ----------

  startRound() {
    this.audio.unlock();
    this._resetRound();
    this.state = GameState.READY;
    this.readyTimer = ROUND.readySeconds;
    this.pausedFrom = null;
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
    if (!this._isRunning()) return;
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
    this.ui.setHudVisible(false);
    this.ui.showHint(false);
    this.ui.hideBanner();
    this.ui.setBest(this.best);
    this.ui.showScreen('menu');
    this.audio.music.playMenu();
  }

  // The buzzer: no more throws, but slices already in the air still get to land.
  _endRound(reason) {
    this.state = GameState.WIND_DOWN;
    this.endReason = reason;
    this.windDownTimer = ROUND.windDownSeconds;
    this.aimController.cancel();
    this.aimVisuals.hide();
    this.respawnTimer = -1;
    this.ui.setTime(Math.max(0, ROUND.durationSeconds - this.roundElapsed));
    this.ui.showBanner(reason === 'time' ? "Time's Up!" : 'Out of Turkey!', { gold: true, duration: 1300 });
    this.ui.fadeHint();
    this.audio.play('tick');
  }

  _showGameOver() {
    this.state = GameState.GAME_OVER;
    // Anything still moving can no longer change the score shown on the results.
    for (const slice of this.slices) {
      if (slice.state === SliceState.FLYING) this._miss(slice, false);
    }
    const isNewBest = this.score > this.best;
    if (isNewBest) {
      this.best = this.score;
      saveBest(this.best);
    }
    this.ui.hideBanner();
    this.ui.setHudVisible(false);
    this.ui.showHint(false);
    this.ui.showGameOver({
      title: this.endReason === 'time' ? "Time's Up!" : 'Out of Turkey!',
      score: this.score,
      best: this.best,
      isNewBest,
      message: resultMessage(this.score),
      highestMultiplier: this.stats.highestMultiplier,
      plates: this._occupiedPlates(),
      cranberryHits: this.multipliers.cranberryHits,
      gravyHits: this.multipliers.gravyHits,
      cornucopiaHits: this.multipliers.cornucopiaHits,
      bounces: this.stats.bounces,
      floorDrops: this.stats.floorDrops,
      flyingHit: this.flyingTurkey.phase === FlightPhase.HIT,
    });
    this.audio.play('gameOver');
    this.audio.music.playMenu();
    if (isNewBest) setTimeout(() => this.audio.play('multiplier'), 900);
  }

  // Clears everything round-specific: slices, effects, timers, score and bonuses.
  _resetRound() {
    this.aimController.cancel();
    for (const slice of this.slices) this._retire(slice);
    this.current = null;
    this.effects.clear();
    this.fruit.clear();
    this.gameScene.resetCornucopia();
    this.aimVisuals.hide();
    for (const plate of this.plates) plate.reset();
    for (const bowl of this.bowls) bowl.reset();
    this.giantTurkey.reset();
    this.flyingTurkey.reset();
    this.multipliers.reset();

    this.score = 0;
    this.slicesLeft = ROUND.slices;
    this.stats = { bounces: 0, floorDrops: 0, highestMultiplier: 1 };
    this.simTime = 0;
    this.roundElapsed = 0;
    this.accumulator = 0;
    this.readyTimer = 0;
    this.respawnTimer = -1;
    this.windDownTimer = 0;
    this.lastTickSecond = null;
    this.endReason = 'time';
    this.isAiming = false;
    this.aimLift = 0;
    this.flyAt = FLYING_TURKEY.earliestSeconds
      + Math.random() * (FLYING_TURKEY.latestSeconds - FLYING_TURKEY.earliestSeconds);

    this.ui.clearPopups();
    this.ui.setScore(0);
    this.ui.setSlices(this.slicesLeft);
    this.ui.resetTime();
    this.ui.setTime(ROUND.durationSeconds);
    this.ui.setPlates(0);
    this.ui.setCalculation(null);
    this._refreshMultipliers();
    this.ui.setFlyingStatus(this.flyingTurkey.phase);
    this.serving.setCount(this.slicesLeft);
    this._spawnSlice();
  }

  // ---------- Slice lifecycle ----------

  _occupiedPlates() {
    return this.plates.reduce((count, plate) => count + (plate.occupied ? 1 : 0), 0);
  }

  _acquireMesh() {
    const mesh = this.pool.acquire();
    if (mesh) return mesh;
    // Pool exhausted: recycle the slice that has been fading or lying around longest.
    let oldest = null;
    for (const slice of this.slices) {
      if (slice.state === SliceState.LOOSE && (!oldest || slice.timer > oldest.timer)) oldest = slice;
    }
    if (!oldest) return null;
    this._retire(oldest);
    return this.pool.acquire();
  }

  _spawnSlice() {
    if (this.slicesLeft <= 0) return;
    const mesh = this._acquireMesh();
    const slice = this.slices.find((candidate) => candidate.state === SliceState.INACTIVE);
    if (!mesh) return;
    slice.reset();
    slice.mesh = mesh;
    slice.state = SliceState.AIMING;
    // Random resting yaw shows a different side of the irregular outline each time.
    slice.restQuaternion.setFromAxisAngle(_up, Math.random() * Math.PI * 2);
    mesh.position.copy(REST_POSITION);
    mesh.quaternion.copy(slice.restQuaternion);
    this.current = slice;
    this.currentAim = null;
    this.aimLift = 0;
  }

  _retire(slice) {
    if (slice.state === SliceState.INACTIVE) return;
    this.physics.remove(slice.physics);
    slice.state = SliceState.INACTIVE;
    if (slice.mesh) this.pool.release(slice.mesh);
    slice.mesh = null;
    if (this.current === slice) this.current = null;
  }

  _onAimStart(aim) {
    this.isAiming = true;
    this.ui.setAimingCursor(true);
    this.audio.play('pickup');
    this._onAimChange(aim);
  }

  _onAimChange(aim) {
    this.aimVisuals.show(aim);
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

    const slice = this.current;
    // Dominant tumble around the horizontal axis perpendicular to the heading, plus a
    // random spin around vertical and a little wobble, so each toss flips differently.
    _launchHeading.set(Math.sin(aim.yaw), 0, -Math.cos(aim.yaw));
    _launchRight.crossVectors(_launchHeading, _up);
    const flipDirection = Math.random() < 0.8 ? -1 : 1;
    const flipSpeed = LAUNCH.minFlipSpeed + Math.random() * (LAUNCH.maxFlipSpeed - LAUNCH.minFlipSpeed);
    _angular.copy(_launchRight).multiplyScalar(flipDirection * flipSpeed);
    _angular.addScaledVector(_up, (Math.random() - 0.5) * 5);
    _angular.addScaledVector(_launchHeading, (Math.random() - 0.5) * 2.4);

    // Launch from the exact point the preview used, with the same velocity.
    this.physics.launch(slice.physics, LAUNCH_POSITION, slice.mesh.quaternion, aim.velocity, _angular);
    slice.state = SliceState.FLYING;

    this.slicesLeft -= 1;
    this.ui.setSlices(this.slicesLeft);
    this.serving.setCount(this.slicesLeft);
    // The next slice arrives shortly after launch, without waiting for this one to land.
    this.current = null;
    this.respawnTimer = this.slicesLeft > 0 ? ROUND.respawnDelaySeconds : -1;
    this.hasThrown = true;
    this.ui.fadeHint();
    this.audio.play('toss');
  }

  _miss(slice, label) {
    slice.state = SliceState.LOOSE;
    slice.timer = 0;
    if (label && this.state === GameState.PLAYING) {
      _point.set(slice.physics.position.x, slice.physics.position.y + 0.4, slice.physics.position.z);
      this._popupAt(_point, 'Oops!', 'miss');
    }
  }

  // ---------- Scoring events ----------

  _refreshMultipliers() {
    const { multipliers, stats } = this;
    stats.highestMultiplier = Math.max(stats.highestMultiplier, multipliers.total);
    this.ui.setMultipliers({
      total: multipliers.total,
      table: multipliers.tableFactor,
    });
    this._refreshBoostChips();
  }

  _refreshBoostChips() {
    const { multipliers, roundElapsed } = this;
    for (const kind of ['cranberry', 'gravy', 'cornucopia']) {
      this.ui.setBoost(kind, multipliers.factor(kind), multipliers.secondsLeft(kind, roundElapsed));
    }
  }

  _landOnPlate(slice, plate) {
    this.physics.remove(slice.physics);
    slice.state = SliceState.PLATED;
    slice.plate = plate;
    slice.timer = 0;

    // Ease from wherever it stopped to lying flat, inside the plate's well.
    const { position, quaternion } = slice.physics;
    slice.startPosition.set(position.x, position.y, position.z);
    slice.startQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    layFlat(quaternion, 1);
    slice.targetQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    const dx = position.x - plate.x;
    const dz = position.z - plate.z;
    const reach = Math.hypot(dx, dz);
    const keep = Math.min(1, (PLATE.radius * 0.42) / Math.max(reach, 1e-4));
    slice.targetPosition.set(plate.x + dx * keep, 0, plate.z + dz * keep);

    const wasEmpty = !plate.occupied;
    if (plate.slices.length >= PLATE.maxStack) this._retire(plate.slices.shift());
    plate.slices.push(slice);
    plate.slices.forEach((held, i) => {
      held.targetPosition.y = PLATE.surfaceY + SLICE.thickness / 2 + i * STACK_GAP;
    });
    plate.land();

    const bounced = slice.bounces > 0;
    const result = scoreLanding(plate.points, this.multipliers, { bounced });
    this.score = addScore(this.score, result.points);
    this.stats.highestMultiplier = Math.max(this.stats.highestMultiplier, result.multiplier);
    this.ui.setScore(this.score, true);
    this.ui.setCalculation(result.calculation);

    _point.set(plate.x, 0.55, plate.z);
    this.effects.sparkleBurst(_point, 10);
    this._popupAt(
      _point,
      `+${formatNumber(result.points)}${result.calculation ? `<small>${result.calculation}</small>` : ''}`,
      bounced ? 'bounce' : (result.multiplier > 1 ? 'big' : ''),
    );
    this.audio.play('plate', plate.points);
    if (result.multiplier > 1) this.audio.play('score');

    if (bounced) {
      this.ui.showBanner(`TURKEY BOUNCE! ${GIANT_TURKEY.bounceMultiplier}X!`, { gold: true, duration: 1500 });
      this.audio.play('multiplier');
    }

    if (wasEmpty) {
      const occupied = this._occupiedPlates();
      this.ui.setPlates(occupied);
      if (occupied === this.plates.length) this._completeTable();
    }
  }

  // The landing that fills the last plate scores before the bonus starts.
  _completeTable() {
    if (!this.multipliers.completeTable()) return;
    this._refreshMultipliers();
    this.ui.showBanner(`TABLE COMPLETE! ${TABLE_COMPLETE.multiplier}X MULTIPLIER!`, { gold: true, duration: 2600 });
    this.audio.play('tableComplete');
    for (const plate of this.plates) {
      _point.set(plate.x, 0.2, plate.z);
      this.effects.confettiBurst(_point);
    }
  }

  _enterBowl(slice, bowl) {
    this.physics.remove(slice.physics);
    slice.state = SliceState.SINKING;
    slice.timer = 0;
    slice.bowlCenter = bowl;
    const { position, quaternion } = slice.physics;
    slice.startPosition.set(position.x, position.y, position.z);
    slice.targetPosition.set(
      position.x + (bowl.x - position.x) * 0.4, bowl.fillHeight, position.z + (bowl.z - position.z) * 0.4,
    );
    slice.startQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    layFlat(quaternion, 1);
    slice.targetQuaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);

    this.multipliers.addBowlHit(bowl.kind, this.roundElapsed);
    this._refreshMultipliers();
    bowl.splash();
    _point.set(bowl.x, bowl.fillHeight + 0.1, bowl.z);
    this.effects.splash(_point, bowl.kind);
    this.audio.play(bowl.kind);
    this.audio.play('multiplier');
    const { multiplier, seconds } = bowl;
    const name = bowl.kind === 'cranberry' ? 'CRANBERRY' : 'GRAVY';
    this.ui.showBanner(`${name} BONUS! ${multiplier}X FOR ${seconds} SECONDS!`, { gold: true, duration: 1500 });
    _point.y = 1;
    this._popupAt(_point, `${multiplier}X<small>${seconds} seconds</small>`, `sauce-${bowl.kind}`);
  }

  _bounce(slice) {
    const cfg = GIANT_TURKEY;
    if (slice.bounces >= cfg.maxBounces) return;
    if (slice.lastBounce >= 0 && this.simTime - slice.lastBounce < cfg.bounceCooldownSeconds) return;
    slice.bounces += 1;
    slice.lastBounce = this.simTime;
    slice.flightTime = 0;
    this.stats.bounces += 1;

    const { velocity, angularVelocity, position } = slice.physics;
    const launch = bounceVelocity(position, velocity, this.plates);
    velocity.set(launch.x, launch.y, launch.z);
    const spin = cfg.spinSpeed;
    angularVelocity.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, spin * 0.8);

    this.giantTurkey.bounce();
    _point.set(position.x, position.y + 0.3, position.z);
    this.effects.sparkleBurst(_point, 12);
    this._popupAt(_point, 'BOING!', 'boing');
    this.audio.play('bounce');
  }

  _hitCornucopia(slice) {
    slice.hitCornucopia = true;
    this.multipliers.addCornucopiaHit(this.roundElapsed);
    this._refreshMultipliers();
    this.gameScene.knockCornucopia();
    this.fruit.rain();
    const { multiplier, seconds } = CORNUCOPIA;
    this.ui.showBanner(`CORNUCOPIA! ${multiplier}X FOR ${seconds} SECONDS!`, { gold: true, duration: 1800 });
    const { position } = slice.physics;
    _point.set(position.x, position.y + 0.5, position.z);
    this.effects.sparkleBurst(_point, 18);
    this._popupAt(_point, `${multiplier}X<small>${seconds} seconds</small>`, 'cornucopia');
    this.audio.play('cornucopia');
    this.audio.play('multiplier');
  }

  // A flat penalty, so it doesn't grow with the multipliers.
  _hitFloor(slice) {
    slice.floored = true;
    const { position } = slice.physics;
    this.audio.play('floor');
    if (this.state === GameState.PLAYING || this.state === GameState.WIND_DOWN) {
      this.stats.floorDrops += 1;
      this.score = addScore(this.score, -FLOOR.penalty);
      this.ui.setScore(this.score, true);
      this.ui.flashPenalty();
      _point.set(position.x, position.y + 0.4, position.z);
      this._popupAt(_point, `-${FLOOR.penalty}<small>On the floor!</small>`, 'penalty');
    }
    if (slice.state === SliceState.FLYING) this._miss(slice, false);
  }

  _hitFlyingTurkey(slice) {
    const turkey = this.flyingTurkey;
    turkey.markHit();
    this.ui.setFlyingStatus(turkey.phase);
    this.score = addScore(this.score, FLYING_TURKEY.bonusPoints);
    this.ui.setScore(this.score, true);
    this.effects.feathersBurst(turkey.position);
    this.ui.showBanner(`FLYING TURKEY HIT! +${FLYING_TURKEY.bonusPoints}!`, { gold: true, duration: 1800 });
    this._popupAt(turkey.position, `+${FLYING_TURKEY.bonusPoints}`, 'big');
    this.audio.play('flyingHit');

    // The slice is spent: it falls away and can't score again.
    const { velocity } = slice.physics;
    velocity.set(velocity.x * 0.3, Math.min(velocity.y, 0) - 1, velocity.z * 0.3);
    this._miss(slice, false);
  }

  _popupAt(world, html, className) {
    _screen.copy(world).project(this.camera);
    if (_screen.z > 1) return;
    const { viewportWidth: width, viewportHeight: height } = this.gameScene;
    // Kept on screen, because floor hits can happen outside the view on a portrait phone.
    const x = THREE.MathUtils.clamp((_screen.x + 1) * 0.5 * width, 70, width - 70);
    const y = THREE.MathUtils.clamp((1 - _screen.y) * 0.5 * height, 90, height - 40);
    this.ui.popup(x, y, html, className);
  }

  // ---------- Simulation ----------

  /** One fixed physics step of length h. */
  _step(h) {
    if (this.state === GameState.PLAYING) {
      this.roundElapsed += h;
      this._updateFlightSchedule();
      if (this.multipliers.expireBoosts(this.roundElapsed)) this._refreshMultipliers();
      if (this.roundElapsed >= ROUND.durationSeconds) this._endRound('time');
    }
    this.simTime += h;
    this.physics.step(h);

    let flying = 0;
    for (const slice of this.slices) {
      switch (slice.state) {
        case SliceState.FLYING:
          this._stepFlying(slice, h);
          if (slice.state === SliceState.FLYING) flying += 1;
          break;
        case SliceState.LOOSE:
          this._stepLoose(slice, h);
          break;
        case SliceState.PLATED:
          slice.timer += h;
          break;
        case SliceState.SINKING:
          slice.timer += h;
          if (slice.timer >= SINK_SECONDS) this._retire(slice);
          break;
        default:
          break;
      }
    }

    if (this.state === GameState.PLAYING && this.slicesLeft === 0 && !this.current && flying === 0) {
      this._endRound('slices');
    }
    if (this.state === GameState.WIND_DOWN && flying === 0 && this.windDownTimer > 0) {
      // Nothing left in the air, so there's no reason to keep the player waiting.
      this.windDownTimer = Math.min(this.windDownTimer, 0.5);
    }
  }

  _updateFlightSchedule() {
    const turkey = this.flyingTurkey;
    if (turkey.phase === FlightPhase.WAITING && this.roundElapsed >= this.flyAt - FLYING_TURKEY.warningSeconds) {
      turkey.phase = FlightPhase.INCOMING;
      this.ui.setFlyingStatus(turkey.phase);
      this.audio.play('gobble');
    } else if (turkey.phase === FlightPhase.INCOMING && this.roundElapsed >= this.flyAt) {
      turkey.takeOff(Math.random() < 0.5 ? 1 : -1, this.gameScene.flyingTurkeySpan());
      this.ui.setFlyingStatus(turkey.phase);
      this.audio.play('gobble');
    }
  }

  _stepFlying(slice, h) {
    const body = slice.physics;
    slice.flightTime += h;
    const { position } = body;
    const b = PHYSICS.bounds;
    if (position.y < b.minY || position.x < b.minX || position.x > b.maxX || position.z < b.minZ || position.z > b.maxZ) {
      this._retire(slice);
      return;
    }

    if (this.flyingTurkey.hittable
      && segmentDistance(body.previousPosition, position, this.flyingTurkey.position) <= FLYING_TURKEY.hitRadius) {
      this._hitFlyingTurkey(slice);
      return;
    }
    for (const bowl of this.bowls) {
      if (enteredBowl(body.previousPosition, position, bowl)) {
        this._enterBowl(slice, bowl);
        return;
      }
    }
    if (body.contacts & Surface.TURKEY) this._bounce(slice);
    if ((body.contacts & Surface.CORNUCOPIA) && !slice.hitCornucopia) this._hitCornucopia(slice);
    if ((body.contacts & Surface.FLOOR) && !slice.floored) {
      this._hitFloor(slice);
      return;
    }

    const speed = body.velocity.length();
    if (body.plate) {
      slice.touchPlate = body.plate;
      slice.touchTime = PLATE_TOUCH_SECONDS;
    } else {
      slice.touchTime -= h;
    }
    const plate = slice.touchTime > 0 ? slice.touchPlate : null;
    const onPlate = plate
      && Math.hypot(position.x - plate.x, position.z - plate.z) <= PLATE.radius * PLATE.scoringFraction;
    slice.settle = onPlate && speed < PLATE.settleSpeed ? slice.settle + h : 0;
    if (slice.settle >= PLATE.settleSeconds) {
      this._landOnPlate(slice, plate);
      return;
    }

    if ((body.contacts & (Surface.TABLE | Surface.DECOR)) && !slice.thudded) {
      slice.thudded = true;
      this.effects.thud(position);
      this.audio.play('thud');
    }
    slice.still = speed < PLATE.settleSpeed ? slice.still + h : 0;
    if (slice.still >= STILL_SECONDS || slice.flightTime > PHYSICS.maxFlightSeconds) {
      // A slice that already earned a shower hasn't really missed.
      this._miss(slice, !slice.hitCornucopia);
    }
  }

  _stepLoose(slice, h) {
    slice.timer += h;
    if (slice.physics.position.y < PHYSICS.bounds.minY) {
      this._retire(slice);
      return;
    }
    // A spent slice can still reach the floor, such as one knocked down by the flying turkey.
    if ((slice.physics.contacts & Surface.FLOOR) && !slice.floored) this._hitFloor(slice);
    if (slice.timer > MISS_LINGER_SECONDS) {
      slice.fade += h / FADE_SECONDS;
      if (slice.fade >= 1) this._retire(slice);
    }
  }

  // ---------- Frame update ----------

  update(dt, elapsed) {
    this.elapsed = elapsed;
    if (this.state === GameState.PAUSED) {
      // Everything gameplay-related is frozen; just keep the current pose on screen.
      return;
    }
    if (this.state === GameState.READY) this._updateReady(dt);

    let alpha = 1;
    if (this.state !== GameState.MENU && this.state !== GameState.READY) {
      // PLAYING, WIND_DOWN or GAME_OVER: fixed-timestep simulation with an accumulator.
      const h = PHYSICS.fixedTimestep;
      this.accumulator += Math.min(dt, PHYSICS.maxFrameTime);
      while (this.accumulator >= h) {
        this._step(h);
        this.accumulator -= h;
      }
      alpha = this.accumulator / h;
      this.flyingTurkey.update(dt, elapsed);
      if (this.flyingTurkey.phase !== this.ui.flyingPhase) this.ui.setFlyingStatus(this.flyingTurkey.phase);
    }

    if (this.state === GameState.PLAYING) this._updateClock(dt);
    if (this.state === GameState.WIND_DOWN) {
      this.windDownTimer -= dt;
      if (this.windDownTimer <= 0) this._showGameOver();
    }

    const { tableComplete } = this.multipliers;
    for (const plate of this.plates) plate.update(dt, elapsed, tableComplete);
    for (const bowl of this.bowls) bowl.update(dt);
    this.giantTurkey.update(dt, elapsed);
    this.gameScene.update(dt, elapsed);
    this.effects.update(dt);
    this.fruit.update(dt);
    this._renderSlices(alpha, dt);
  }

  _updateClock(dt) {
    const timeLeft = ROUND.durationSeconds - this.roundElapsed;
    this.ui.setTime(timeLeft);
    this._refreshBoostChips();
    const second = Math.ceil(timeLeft);
    if (second <= 5 && second > 0 && second !== this.lastTickSecond) {
      this.lastTickSecond = second;
      this.audio.play('tick');
    }
    if (this.respawnTimer >= 0) {
      // Clamped at 0 so spawning retries each frame if no mesh is free yet.
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      if (this.respawnTimer === 0 && !this.current) this._spawnSlice();
      if (this.current) this.respawnTimer = -1;
    }
  }

  _updateReady(dt) {
    this.readyTimer -= dt;
    if (this.readyTimer <= 0) {
      this.state = GameState.PLAYING;
      this.accumulator = 0;
      this.ui.showBanner('Go!', { gold: true, duration: 700 });
      this.audio.play('go');
    }
  }

  _renderSlices(alpha, dt) {
    for (const slice of this.slices) {
      if (!slice.mesh) continue;
      const { mesh, physics } = slice;
      switch (slice.state) {
        case SliceState.AIMING:
          this._renderAiming(slice, dt);
          break;
        case SliceState.PLATED: {
          const t = Math.min(1, slice.timer / 0.18);
          mesh.position.lerpVectors(slice.startPosition, slice.targetPosition, t);
          mesh.quaternion.slerpQuaternions(slice.startQuaternion, slice.targetQuaternion, t);
          // Finishes draped over the plate's slight curve, with a little jiggle.
          mesh.morphTargetInfluences[0] = 0.28 + 0.25 * Math.exp(-slice.timer * 5) * Math.cos(slice.timer * 26);
          break;
        }
        case SliceState.SINKING: {
          const t = Math.min(1, slice.timer / 0.2);
          mesh.position.lerpVectors(slice.startPosition, slice.targetPosition, t);
          mesh.position.y -= Math.max(0, slice.timer - 0.3) * 0.2;
          mesh.quaternion.slerpQuaternions(slice.startQuaternion, slice.targetQuaternion, t);
          mesh.scale.setScalar(Math.max(0.001, 1 - slice.timer / SINK_SECONDS));
          break;
        }
        default: {
          const { previousPosition: p, position: c, previousQuaternion: q, quaternion: r } = physics;
          mesh.position.set(p.x + (c.x - p.x) * alpha, p.y + (c.y - p.y) * alpha, p.z + (c.z - p.z) * alpha);
          _previousQuaternion.set(q.x, q.y, q.z, q.w);
          _renderQuaternion.set(r.x, r.y, r.z, r.w);
          mesh.quaternion.slerpQuaternions(_previousQuaternion, _renderQuaternion, alpha);
          // A slice in the air flops with its tumble, then relaxes once it hits something.
          mesh.morphTargetInfluences[0] = physics.grounded
            ? 0.2
            : 0.75 * Math.sin(this.simTime * 11 + slice.phase);
          mesh.scale.setScalar(Math.max(0.001, 1 - Math.min(1, slice.fade)));
          break;
        }
      }
    }
  }

  // Waiting on the platter: lifts to the launch point while aiming, with a slight wobble
  // and a backward tilt that grows with power.
  _renderAiming(slice, dt) {
    const { mesh } = slice;
    const aiming = this.isAiming && slice === this.current;
    this.aimLift += ((aiming ? 1 : 0) - this.aimLift) * Math.min(1, dt * 14);
    _renderPosition.lerpVectors(REST_POSITION, LAUNCH_POSITION, this.aimLift);
    const power = aiming && this.currentAim ? this.currentAim.power : 0;
    const yaw = aiming && this.currentAim ? this.currentAim.yaw : 0;
    _tiltAxis.set(Math.cos(yaw), 0, Math.sin(yaw));
    _tiltQuaternion.setFromAxisAngle(_tiltAxis, 0.35 * power * this.aimLift);
    mesh.quaternion.copy(_tiltQuaternion).multiply(slice.restQuaternion);
    if (this.state === GameState.PLAYING && !this.isAiming) {
      // Gentle idle bob inviting the player to grab it.
      _renderPosition.y += Math.max(0, Math.sin(this.elapsed * 4)) * 0.03;
    }
    mesh.position.copy(_renderPosition);
    mesh.morphTargetInfluences[0] = 0.25 + power * 0.5 * this.aimLift;
  }
}
