const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const WORLD_WIDTH = 2560;
const PLAYER_GROUND_Y = 570;
const CHARACTER_SCALE = 2;
const CHARACTER_HEIGHT = 110 * CHARACTER_SCALE;
const PUNCH_HAND_X = 0.94;
const PUNCH_HAND_Y = 0.37;
const SHOOT_COOLDOWN = 1;
const RAPID_FIRE_INTERVAL = 0.2;
const JOYSTICK_RADIUS = 85 * 1.5;
const JOYSTICK_EDGE_GAP_X = 45;
const JOYSTICK_EDGE_GAP_Y = 35;
const COUNTDOWN_SECONDS = 5;
const ENDING_HOLD_SECONDS = 3;
const PLAYER_DEATH_FRAME_DURATION = 0.12;
const COUNTDOWN_BEEP_DURATION = 0.18;
const RAIN_CHANCE = 0.35;
const SNOW_CHANCE = 0.35;
const SNOW_MAX_FLAKES = 320;
const WEATHER_MIN_INTENSITY = 0.3;
const WEATHER_MAX_INTENSITY = 1;
const RAIN_MAX_DROPS = 360;
const RAIN_SLANT = 0.22;
const WEATHER_SHIFT_MIN = 8;
const WEATHER_SHIFT_MAX = 16;
const SPLASH_DURATION = 0.3;
const THUNDER_DELAY_MIN = 7;
const THUNDER_DELAY_MAX = 18;
const LIGHTNING_BOLT_DURATION = 0.35;
const MAX_ENEMIES = 10;
const ENEMY_SPAWN_RATE = 2;
const ENEMY_EDGE_PEEK = 40;
const FINAL_WAVE_SECONDS = 30;
const FINAL_WAVE_MAX_ENEMIES = 6;
const POWER_UP_SIZE = 84;
const POWER_UP_LIFETIME = 12;
const POWER_UP_BLINK_TIME = 3;
const POWER_UP_FIRST_DELAY = 6;
const POWER_UP_INTERVAL_MIN = 9;
const POWER_UP_INTERVAL_MAX = 13;
const POWER_UP_MAX_ON_STREET = 3;
const POWER_UP_SPACING = 170;
const POWER_UP_RETRY_DELAY = 4;
const POWER_UP_LOW_HEALTH = 40;
const POWER_UP_LIMITS = { health: 8, strength: 8, rapidFire: 5, speed: 5 };
const POWER_UP_GLOW = {
  health: "255, 50, 80",
  strength: "255, 190, 40",
  rapidFire: "60, 190, 255",
  speed: "80, 255, 130",
};
const POWER_UP_EFFECT_DURATION = 0.9;
const HEALTH_POWER_UP_AMOUNT = 25;
const POWER_UP_LABELS = {
  health: `+${HEALTH_POWER_UP_AMOUNT}`,
  strength: "2X DAMAGE",
  rapidFire: "RAPID FIRE",
  speed: "2X SPEED",
};
const BOOST_DURATIONS = { strength: 15, rapidFire: 10, speed: 10 };
const STRENGTH_MULTIPLIER = 2;
const SPEED_MULTIPLIER = 2;
const FEET_MIN_Y = 410;
const FEET_MAX_Y = 750;
const PLAYER_MIN_Y = FEET_MIN_Y - CHARACTER_HEIGHT;
const PLAYER_MAX_Y = FEET_MAX_Y - CHARACTER_HEIGHT;
const ENEMY_DEATH_FRAME_DURATION = 0.12;
const HIT_EFFECT_FRAME_DURATION = 0.07;
const PLAYER_JUMP_LAND_DURATION = 0.1;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const portraitOverlay = document.getElementById("portraitOverlay");
const gameShell = document.getElementById("game-shell");

const ASSET_PATHS = {
  loadingIcons: [
    "assets/loading/load_icon_0.jpg",
    "assets/loading/load_icon_1.jpg",
    "assets/loading/load_icon_2.jpg",
  ],
  rotatePhone: "assets/loading/rotate_phone.jpg",
  startScreen: "assets/start_screen/start_screen.jpg",
  startButton: "assets/start_screen/btn_start.png",
  background_0: "assets/background/background_0.jpg",
  background_1: "assets/background/background_1.jpg",
  gameOverScreen: "assets/game_over/game_over_screen.jpg",
  playAgainButton: "assets/game_over/btn_play_again.png",
  timerBg: "assets/ui/ui_timer_background.png",
  scoreBg: "assets/ui/ui_score_background.png",
  healthBg: "assets/ui/ui_health_bar_background.png",
  healthFill: "assets/ui/ui_health_bar_fill.png",
  pauseBtn: "assets/ui/btn_pause.png",
  playBtn: "assets/ui/btn_play.png",
  restartBtn: "assets/ui/btn_restart.png",
  audioOn: "assets/ui/btn_audio_on.png",
  audioOff: "assets/ui/btn_audio_off.png",
  fullScreenBtn: "assets/ui/btn_full_screen.png",
  joystickBg: "assets/controls/btn_move_background.png",
  joystickThumb: "assets/controls/btn_move_joystick.png",
  actionJump: "assets/controls/btn_action_jump_active.png",
  actionPunch: "assets/controls/btn_action_punch_active.png",
  actionKick: "assets/controls/btn_action_kick_active.png",
  actionShoot: "assets/controls/btn_action_shoot_active.png",
  projectile: "assets/char/shoot/shoot_envelope.png",
  playerStatic: "assets/char/player/player1_static.png",
  playerWin: "assets/char/player/player1_win_000.png",
  playerDeath: [
    "assets/char/player/player1_death_000.png",
    "assets/char/player/player1_death_001.png",
    "assets/char/player/player1_death_002.png",
    "assets/char/player/player1_death_003.png",
    "assets/char/player/player1_death_004.png",
  ],
  playerWalk: [
    "assets/char/player/player1_walk_000.png",
    "assets/char/player/player1_walk_001.png",
    "assets/char/player/player1_walk_002.png",
    "assets/char/player/player1_walk_003.png",
    "assets/char/player/player1_walk_004.png",
    "assets/char/player/player1_walk_005.png",
    "assets/char/player/player1_walk_006.png",
  ],
  playerHit: [
    "assets/char/player/player1_hit_000.png",
    "assets/char/player/player1_hit_001.png",
    "assets/char/player/player1_hit_002.png",
    "assets/char/player/player1_hit_003.png",
    "assets/char/player/player1_hit_004.png",
    "assets/char/player/player1_hit_005.png",
    "assets/char/player/player1_hit_006.png",
  ],
  playerPunch: [
    "assets/char/player/player1_punch_000.png",
    "assets/char/player/player1_punch_001.png",
    "assets/char/player/player1_punch_002.png",
    "assets/char/player/player1_punch_003.png",
    "assets/char/player/player1_punch_004.png",
  ],
  playerKick: [
    "assets/char/player/player1_kick_000.png",
    "assets/char/player/player1_kick_001.png",
    "assets/char/player/player1_kick_002.png",
    "assets/char/player/player1_kick_003.png",
    "assets/char/player/player1_kick_004.png",
  ],
  playerJump: [
    "assets/char/player/player1_jump_000.png",
    "assets/char/player/player1_jump_001.png",
    "assets/char/player/player1_jump_002.png",
    "assets/char/player/player1_jump_003.png",
    "assets/char/player/player1_jump_004.png",
  ],
  enemyStatic: "assets/char/enemy/enemy1_static.png",
  enemyWin: "assets/char/enemy/enemy1_win_000.png",
  enemyWalk: [
    "assets/char/enemy/enemy1_walk_000.png",
    "assets/char/enemy/enemy1_walk_001.png",
    "assets/char/enemy/enemy1_walk_002.png",
    "assets/char/enemy/enemy1_walk_003.png",
    "assets/char/enemy/enemy1_walk_004.png",
    "assets/char/enemy/enemy1_walk_005.png",
    "assets/char/enemy/enemy1_walk_006.png",
  ],
  enemyHit: [
    "assets/char/enemy/enemy1_hit_000.png",
    "assets/char/enemy/enemy1_hit_001.png",
    "assets/char/enemy/enemy1_hit_002.png",
    "assets/char/enemy/enemy1_hit_003.png",
    "assets/char/enemy/enemy1_hit_004.png",
    "assets/char/enemy/enemy1_hit_005.png",
    "assets/char/enemy/enemy1_hit_006.png",
  ],
  enemyPunch: [
    "assets/char/enemy/enemy1_punch_000.png",
    "assets/char/enemy/enemy1_punch_001.png",
    "assets/char/enemy/enemy1_punch_002.png",
    "assets/char/enemy/enemy1_punch_003.png",
    "assets/char/enemy/enemy1_punch_004.png",
  ],
  enemyKick: [
    "assets/char/enemy/enemy1_kick_000.png",
    "assets/char/enemy/enemy1_kick_001.png",
    "assets/char/enemy/enemy1_kick_002.png",
    "assets/char/enemy/enemy1_kick_003.png",
    "assets/char/enemy/enemy1_kick_004.png",
  ],
  enemyDeath: [
    "assets/char/enemy/enemy1_death_000.png",
    "assets/char/enemy/enemy1_death_001.png",
    "assets/char/enemy/enemy1_death_002.png",
    "assets/char/enemy/enemy1_death_003.png",
    "assets/char/enemy/enemy1_death_004.png",
    "assets/char/enemy/enemy1_death_005.png",
  ],
  playerSpeech: [
    "assets/char/speech/speech_0.png",
    "assets/char/speech/speech_1.png",
    "assets/char/speech/speech_2.png",
    "assets/char/speech/speech_3.png",
    "assets/char/speech/speech_4.png",
    "assets/char/speech/speech_5.png",
    "assets/char/speech/speech_6.png",
  ],
  fxHit: [
    "assets/fx/fx_hit/fx_hit_000.png",
    "assets/fx/fx_hit/fx_hit_001.png",
    "assets/fx/fx_hit/fx_hit_002.png",
  ],
  music: "audio/music_base_loop.mp3",
  btnClick: "audio/btn_click.mp3",
  gameStart: "audio/game_start.mp3",
  gameOver: "audio/game_over.mp3",
  playerJumpSfx: "audio/player_jump.mp3",
  playerAttackSfx: "audio/player_punch_kick.mp3",
  playerShootSfx: "audio/player_shoot.mp3",
  enemyDeathSfx: "audio/enemy_death.mp3",
  playerDeathSfx: "audio/player_death.mp3",
  fxHitSfx: "audio/fx_hit.mp3",
};

const BUTTONS = {
  start: { x: 40, y: 450, w: 254, h: 254 },
  playAgain: { x: 40, y: 450, w: 254, h: 254 },
  restart: { x: 960, y: 18, w: 56, h: 56 },
  pause: { x: 1030, y: 18, w: 56, h: 56 },
  mute: { x: 1100, y: 18, w: 56, h: 56 },
  fullscreen: { x: 1170, y: 18, w: 56, h: 56 },
  joystick: {
    x: JOYSTICK_EDGE_GAP_X + JOYSTICK_RADIUS,
    y: GAME_HEIGHT - JOYSTICK_EDGE_GAP_Y - JOYSTICK_RADIUS,
    radius: JOYSTICK_RADIUS,
  },
  jump: { x: 1079, y: 520, w: 162, h: 162 },
  punch: { x: 979, y: 420, w: 132, h: 132 },
  kick: { x: 1108, y: 380, w: 132, h: 132 },
  shoot: { x: 928, y: 550, w: 132, h: 132 },
};

const game = {
  state: "loading",
  score: 0,
  timer: 180,
  countdownBeep: null,
  loadingProgress: 0,
  loadingIconPath: null,
  lastFrame: 0,
  cameraX: 0,
  startPulse: 0,
  muted: false,
  enemies: [],
  projectiles: [],
  effects: [],
  powerUps: [],
  powerUpEffects: [],
  powerUpTimer: 0,
  powerUpCounts: { health: 0, strength: 0, rapidFire: 0, speed: 0 },
  player: null,
  spawnTimer: 0,
  overReason: null,
  joystickPointerId: null,
  pointerPositions: new Map(),
  actionPointerIds: new Map(),
  audioUnlocked: false,
  gameOverDelay: 0,
  gameOverTriggered: false,
  endingTimer: 0,
  weather: null,
};

const input = {
  left: false,
  right: false,
  up: false,
  down: false,
  joystickX: 0,
  joystickY: 0,
  actionKeys: new Set(),
};

const assets = { images: {}, sounds: {} };
const powerUpArt = {};
let audioContext = null;
let noiseBuffer = null;
let rainSound = null;
const soundBuffers = {};
let portraitOverlayShown = null;
let windSound = null;

function flattenAssetList() {
  return Object.values(ASSET_PATHS).flatMap((value) =>
    Array.isArray(value) ? value : [value],
  );
}

function isActionHeld(name) {
  return (
    input.actionKeys.has(name) ||
    Array.from(game.actionPointerIds.values()).includes(name)
  );
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

function isMobileDevice() {
  const mobileUserAgent =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return navigator.userAgentData?.mobile ?? mobileUserAgent;
}

function makeImage(src) {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img;
}

function makeSound(src) {
  const sound = new Audio();
  sound.src = src;
  sound.preload = "auto";
  sound.muted = false;
  return sound;
}

function decodeImage(path, img) {
  if (window.createImageBitmap) {
    return createImageBitmap(img)
      .then((bitmap) => {
        assets.images[path] = bitmap;
      })
      .catch(() => {});
  }
  return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
}

function loadSoundBuffers() {
  for (const path of Object.keys(assets.sounds)) {
    if (path === ASSET_PATHS.music) continue;
    fetch(path)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
      .then(
        (data) =>
          new Promise((resolve, reject) => {
            audioContext.decodeAudioData(data, resolve, reject);
          }),
      )
      .then((buffer) => {
        soundBuffers[path] = buffer;
      })
      .catch(() => {});
  }
}

function preloadAssets() {
  game.loadingIconPath =
    ASSET_PATHS.loadingIcons[
      Math.floor(Math.random() * ASSET_PATHS.loadingIcons.length)
    ];
  const paths = [...new Set(flattenAssetList())];
  const total = paths.length;
  let loaded = 0;

  const markDone = () => {
    loaded += 1;
    game.loadingProgress = Math.min(100, (loaded / total) * 100);
    if (loaded >= total) {
      setTimeout(() => {
        if (game.state === "loading") {
          setState("start");
        }
      }, 200);
    }
  };

  paths.forEach((path) => {
    if (path.endsWith(".png") || path.endsWith(".jpg")) {
      const img = makeImage(path);
      assets.images[path] = img;
      img.onload = () => {
        decodeImage(path, img).finally(markDone);
      };
      img.onerror = markDone;
      return;
    }

    const sound = makeSound(path);
    assets.sounds[path] = sound;
    const ready = () => {
      markDone();
      sound.removeEventListener("canplaythrough", ready);
      sound.removeEventListener("error", ready);
    };
    sound.addEventListener("canplaythrough", ready, { once: true });
    sound.addEventListener("error", ready, { once: true });
    sound.load();
  });
}

function setState(nextState) {
  game.state = nextState;
  const music = assets.sounds[ASSET_PATHS.music];

  if (nextState === "start") {
    if (music) {
      music.loop = true;
      music.volume = game.muted ? 0 : 0.8;
      music.muted = game.muted;
      music.currentTime = 0;
      music.play().catch(() => {});
    }
  }

  if (nextState === "paused" && music) {
    music.pause();
  }

  if (nextState === "playing" && music && !game.muted) {
    music.play().catch(() => {});
  }

  if (nextState === "ending" && music) {
    music.pause();
  }

  if (nextState === "gameOverTime" || nextState === "gameOverDead") {
    game.gameOverDelay = 2.5;
    game.gameOverTriggered = true;
    if (music) music.pause();
  }
}

function playSound(path) {
  if (game.muted) return;
  const buffer = soundBuffers[path];
  if (buffer && audioContext) {
    if (audioContext.state === "suspended") audioContext.resume();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
    return;
  }
  const sound = assets.sounds[path];
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

function playCountdownBeep() {
  if (!audioContext || game.muted) return;
  if (audioContext.state === "suspended") audioContext.resume();
  const start = audioContext.currentTime;
  const end = start + COUNTDOWN_BEEP_DURATION;
  const tone = audioContext.createOscillator();
  const volume = audioContext.createGain();
  tone.type = "square";
  tone.frequency.value = 880;
  volume.gain.setValueAtTime(0.15, start);
  volume.gain.exponentialRampToValueAtTime(0.001, end);
  tone.connect(volume);
  volume.connect(audioContext.destination);
  tone.start(start);
  tone.stop(end);
}

function getNoiseBuffer() {
  if (!noiseBuffer) {
    noiseBuffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 2,
      audioContext.sampleRate,
    );
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

function isWeatherAudible(type) {
  return (
    game.weather?.type === type &&
    !game.muted &&
    (game.state === "playing" || game.state === "ending")
  );
}

function getRainVolume() {
  return isWeatherAudible("rain") ? 0.04 + game.weather.intensity * 0.08 : 0;
}

function getWindVolume() {
  if (!isWeatherAudible("snow")) return 0;
  return 0.03 + game.weather.intensity * 0.04 + game.weather.gust * 0.06;
}

function updateNoiseLoop(loop, volume, highpassHz, lowpassHz) {
  if (!loop) {
    if (volume === 0) return null;
    const source = audioContext.createBufferSource();
    source.buffer = getNoiseBuffer();
    source.loop = true;
    const highpass = audioContext.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = highpassHz;
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = lowpassHz;
    const gain = audioContext.createGain();
    gain.gain.value = 0;
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(audioContext.destination);
    source.start();
    loop = { gain, volume: 0 };
  }
  if (Math.abs(loop.volume - volume) > 0.002) {
    loop.gain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.4);
    loop.volume = volume;
  }
  return loop;
}

function updateWeatherSound() {
  if (!audioContext) return;
  rainSound = updateNoiseLoop(rainSound, getRainVolume(), 500, 5000);
  windSound = updateNoiseLoop(windSound, getWindVolume(), 80, 500);
}

function playThunder(delay) {
  if (!audioContext || game.muted) return;
  if (audioContext.state === "suspended") audioContext.resume();
  const start = audioContext.currentTime + delay;
  const duration = randomRange(2.2, 3.8);
  const source = audioContext.createBufferSource();
  source.buffer = getNoiseBuffer();
  source.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900 - delay * 300, start);
  filter.frequency.exponentialRampToValueAtTime(120, start + duration);
  const volume = audioContext.createGain();
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(0.6 - delay * 0.2, start + 0.08);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(volume);
  volume.connect(audioContext.destination);
  source.start(start, Math.random() * 1.5);
  source.stop(start + duration + 0.1);
}

function toggleMute() {
  game.muted = !game.muted;
  Object.values(assets.sounds).forEach((sound) => {
    sound.muted = game.muted;
  });
  const music = assets.sounds[ASSET_PATHS.music];
  if (music) {
    music.volume = game.muted ? 0 : 0.8;
    if (!game.muted && (game.state === "start" || game.state === "playing")) {
      music.play().catch(() => {});
    }
  }
}

function unlockAudio() {
  if (game.audioUnlocked) return;
  game.audioUnlocked = true;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (AudioContextClass) {
    audioContext = new AudioContextClass();
    loadSoundBuffers();
  }
  const music = assets.sounds[ASSET_PATHS.music];
  if (music && (game.state === "start" || game.state === "playing")) {
    music.muted = game.muted;
    music.play().catch(() => {});
  }
}

function resetGameState() {
  game.score = 0;
  game.timer = 180;
  game.countdownBeep = null;
  game.cameraX = 0;
  game.enemies = [];
  game.projectiles = [];
  game.effects = [];
  game.powerUps = [];
  game.powerUpEffects = [];
  game.powerUpTimer = POWER_UP_FIRST_DELAY;
  game.powerUpCounts = { health: 0, strength: 0, rapidFire: 0, speed: 0 };
  game.spawnTimer = 0;
  game.overReason = null;
  game.gameOverDelay = 0;
  game.gameOverTriggered = false;
  game.endingTimer = 0;
  game.player = {
    x: GAME_WIDTH / 2,
    y: PLAYER_MIN_Y + 60,
    width: 66 * CHARACTER_SCALE,
    height: CHARACTER_HEIGHT,
    speed: 240,
    facing: 1,
    health: 100,
    maxHealth: 100,
    jumpTime: 0,
    jumpHeight: 0,
    cooldown: 0,
    attackType: null,
    attackTimer: 0,
    attackDuration: 0,
    attackHitFired: false,
    animation: "static",
    animFrame: 0,
    animTimer: 0,
    hurtFlash: 0,
    speechIndex: null,
    speechTimer: 0,
    boosts: { strength: 0, rapidFire: 0, speed: 0 },
    shootCooldown: 0,
    dead: false,
  };
}

function startNewGame() {
  resetGameState();
  game.weather = createWeather();
  for (let i = 0; i < ENEMY_SPAWN_RATE; i += 1) spawnEnemy(true);
  game.spawnTimer = 9 / ENEMY_SPAWN_RATE;
  setState("playing");
  playSound(ASSET_PATHS.gameStart);
}

function getPlayerFrame() {
  const player = game.player;
  let frames = [ASSET_PATHS.playerStatic];
  if (player.animation === "walk") frames = ASSET_PATHS.playerWalk;
  else if (player.animation === "hit") frames = ASSET_PATHS.playerHit;
  else if (player.animation === "punch") frames = ASSET_PATHS.playerPunch;
  else if (player.animation === "kick") frames = ASSET_PATHS.playerKick;
  else if (player.animation === "jump") frames = ASSET_PATHS.playerJump;
  else if (player.animation === "win") frames = [ASSET_PATHS.playerWin];
  else if (player.animation === "dead") frames = ASSET_PATHS.playerDeath;
  const idx = clamp(Math.floor(player.animFrame), 0, frames.length - 1);
  return assets.images[frames[idx]] || assets.images[ASSET_PATHS.playerStatic];
}

function getEnemyFrame(enemy) {
  let frames = ASSET_PATHS.enemyWalk;
  if (enemy.animation === "hit") frames = ASSET_PATHS.enemyHit;
  else if (enemy.animation === "punch") frames = ASSET_PATHS.enemyPunch;
  else if (enemy.animation === "kick") frames = ASSET_PATHS.enemyKick;
  else if (enemy.animation === "dead") frames = ASSET_PATHS.enemyDeath;
  else if (enemy.animation === "win") frames = [ASSET_PATHS.enemyWin];
  else if (enemy.animation === "static") frames = [ASSET_PATHS.enemyStatic];
  const idx = clamp(Math.floor(enemy.animFrame), 0, frames.length - 1);
  return assets.images[frames[idx]] || assets.images[ASSET_PATHS.enemyStatic];
}

function spawnEnemy(nearPlayer = false) {
  if (game.enemies.length >= MAX_ENEMIES) return;
  const fromLeft = Math.random() < 0.5;
  const enemy = {
    x: fromLeft ? -40 : WORLD_WIDTH + 40,
    y: PLAYER_MIN_Y + Math.random() * (PLAYER_MAX_Y - PLAYER_MIN_Y),
    width: 64 * CHARACTER_SCALE,
    height: CHARACTER_HEIGHT,
    speed: 110,
    health: 10,
    facing: fromLeft ? 1 : -1,
    animation: "walk",
    animFrame: 0,
    animTimer: 0,
    cooldown: 0,
    dead: false,
    deathTimer: 0,
    hurtFlash: 0,
    attackType: null,
    attackTimer: 0,
    attackDuration: 0,
    attackHitFired: false,
  };

  if (game.player) {
    if (nearPlayer) {
      enemy.x = clamp(
        game.player.x + (fromLeft ? -1 : 1) * GAME_WIDTH * 0.4,
        enemy.width / 2,
        WORLD_WIDTH - enemy.width / 2,
      );
      enemy.facing = fromLeft ? 1 : -1;
    } else {
      const playerSide = game.player.x < WORLD_WIDTH / 2 ? 1 : -1;
      const offscreen = 34 * CHARACTER_SCALE;
      enemy.x = playerSide > 0 ? WORLD_WIDTH + offscreen : -offscreen;
      enemy.facing = playerSide > 0 ? -1 : 1;
    }
  }

  game.enemies.push(enemy);
}

function triggerPlayerAction(type) {
  if (
    game.state !== "playing" ||
    game.player.dead ||
    game.player.cooldown > 0 ||
    game.player.animation === "hit"
  )
    return;

  if (type === "jump") {
    if (game.player.jumpTime > 0 || game.player.animation === "jump") return;
    game.player.jumpTime = 0.7;
    game.player.jumpHeight = 0;
    game.player.cooldown = 0.45;
    game.player.animation = "jump";
    game.player.animFrame = 0;
    game.player.animTimer = 0;
    playSound(ASSET_PATHS.playerJumpSfx);
    return;
  }

  if (type === "punch") {
    game.player.attackType = "punch";
    game.player.attackTimer = 0.33;
    game.player.attackDuration = 0.33;
    game.player.attackHitFired = false;
    game.player.cooldown = 0.52;
    game.player.animation = "punch";
    game.player.animFrame = 0;
    game.player.animTimer = 0;
    playSound(ASSET_PATHS.playerAttackSfx);
    return;
  }

  if (type === "kick") {
    game.player.attackType = "kick";
    game.player.attackTimer = 0.42;
    game.player.attackDuration = 0.42;
    game.player.attackHitFired = false;
    game.player.cooldown = 0.62;
    game.player.animation = "kick";
    game.player.animFrame = 0;
    game.player.animTimer = 0;
    playSound(ASSET_PATHS.playerAttackSfx);
    return;
  }

  if (type === "shoot") {
    if (game.player.shootCooldown > 0) return;
    if (game.player.boosts.rapidFire > 0) {
      fireRapidShot();
      return;
    }
    game.player.attackType = "shoot";
    game.player.attackTimer = 0.4;
    game.player.attackDuration = 0.4;
    game.player.attackHitFired = false;
    game.player.cooldown = 0.5;
    game.player.animation = "punch";
    game.player.animFrame = 0;
    game.player.animTimer = 0;
  }
}

function fireRapidShot() {
  const player = game.player;
  spawnProjectile();
  player.shootCooldown = RAPID_FIRE_INTERVAL;
  player.attackType = "shoot";
  player.attackTimer = RAPID_FIRE_INTERVAL;
  player.attackDuration = RAPID_FIRE_INTERVAL;
  player.attackHitFired = true;
  player.animation = "punch";
  player.animFrame = 2;
  player.animTimer = 0;
}

function spawnProjectile() {
  const player = game.player;
  const w = 25 * CHARACTER_SCALE;
  const h = 18 * CHARACTER_SCALE;
  const handX = player.facing > 0 ? PUNCH_HAND_X : 1 - PUNCH_HAND_X;
  player.shootCooldown = SHOOT_COOLDOWN;
  playSound(ASSET_PATHS.playerShootSfx);
  game.projectiles.push({
    x: player.x + player.width * handX - w / 2,
    y: player.y - player.jumpHeight + player.height * PUNCH_HAND_Y - h / 2,
    w,
    h,
    vx: player.facing * 640,
    ttl: 1.5,
    rotation: 0,
    groundY: player.y + player.height,
  });
}

function damagePlayer(amount) {
  if (
    game.player.dead ||
    game.player.jumpTime > 0 ||
    game.player.animation === "jump"
  )
    return;
  game.player.health = clamp(game.player.health - amount, 0, 100);
  game.player.hurtFlash = 0.25;
  game.player.attackType = null;
  game.player.animation = "hit";
  game.player.animFrame = 0;
  game.player.animTimer = 0;
  playSound(ASSET_PATHS.fxHitSfx);
  if (game.player.health <= 0) {
    game.player.dead = true;
    playSound(ASSET_PATHS.playerDeathSfx);
    startEnding("dead");
  }
}

function spawnHitEffect(x, y, groundY = y) {
  game.effects.push({ x, y, groundY, frame: 0, frameTimer: 0 });
  playSound(ASSET_PATHS.fxHitSfx);
}

function handleEnemyAttack(enemy) {
  if (
    enemy.dead ||
    enemy.cooldown > 0 ||
    enemy.attackType ||
    enemy.animation === "hit" ||
    enemy.animation === "dead"
  )
    return;
  const dist = Math.abs(enemy.x - game.player.x);
  if (
    dist < 92 * CHARACTER_SCALE &&
    Math.abs(enemy.y - game.player.y) < 90 * CHARACTER_SCALE
  ) {
    enemy.attackType = Math.random() < 0.6 ? "punch" : "kick";
    enemy.attackTimer = enemy.attackType === "punch" ? 0.46 : 0.56;
    enemy.attackDuration = enemy.attackTimer;
    enemy.attackHitFired = false;
    enemy.cooldown = 1.05;
    enemy.animation = enemy.attackType;
    enemy.animFrame = 0;
    enemy.animTimer = 0;
    playSound(ASSET_PATHS.playerAttackSfx);
  }
}

function resolveEnemyAttack(enemy) {
  if (!enemy.attackType || enemy.dead) return;
  const dist = Math.abs(enemy.x - game.player.x) / CHARACTER_SCALE;
  const laneDistance = Math.abs(enemy.y - game.player.y) / CHARACTER_SCALE;
  if (enemy.attackType === "punch" && dist < 76 && laneDistance < 70) {
    damagePlayer(5);
  } else if (enemy.attackType === "kick" && dist < 95 && laneDistance < 80) {
    damagePlayer(7);
  }
  enemy.attackType = null;
}

function getPlayerDamage(amount) {
  return game.player.boosts.strength > 0 ? amount * STRENGTH_MULTIPLIER : amount;
}

function applyPlayerHit() {
  if (!game.player.attackType || game.player.attackHitFired) return;
  const attack = game.player.attackType;
  game.player.attackHitFired = true;
  if (attack === "shoot") spawnProjectile();
  const range =
    attack === "punch"
      ? 70 * CHARACTER_SCALE
      : attack === "kick"
        ? 90 * CHARACTER_SCALE
        : 220;
  let hitMade = false;

  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const dx = Math.abs(enemy.x - game.player.x);
    const dy = Math.abs(enemy.y - game.player.y);
    if (dx < range && dy < 90 * CHARACTER_SCALE) {
      const damage = attack === "punch" ? 4 : attack === "kick" ? 6 : 0;
      enemy.health -= getPlayerDamage(damage);
      enemy.hurtFlash = 0.2;
      spawnHitEffect(
        enemy.x + enemy.width / 2,
        enemy.y + enemy.height / 2,
        enemy.y + enemy.height,
      );
      if (enemy.health <= 0) {
        enemy.dead = true;
        enemy.deathTimer =
          ASSET_PATHS.enemyDeath.length * ENEMY_DEATH_FRAME_DURATION;
        enemy.animation = "dead";
        enemy.animFrame = 0;
        enemy.animTimer = 0;
        game.score += 1;
        game.player.speechIndex = Math.floor(
          Math.random() * ASSET_PATHS.playerSpeech.length,
        );
        game.player.speechTimer = 3;
        playSound(ASSET_PATHS.enemyDeathSfx);
      } else {
        enemy.animation = "hit";
        enemy.animFrame = 0;
      }
      hitMade = true;
      if (attack !== "shoot") break;
    }
  }

  if (attack !== "shoot" && hitMade) {
    game.player.attackType = null;
    game.player.animation = "static";
  }
}

function updatePlayer(dt) {
  const player = game.player;
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  player.speechTimer = Math.max(0, player.speechTimer - dt);
  if (player.speechTimer === 0) player.speechIndex = null;

  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joystickX;
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.joystickY;
  const len = Math.hypot(dx, dy);

  if (len > 0.2) {
    const nx = dx / Math.max(len, 1);
    const ny = dy / Math.max(len, 1);
    const speed =
      player.speed * (player.boosts.speed > 0 ? SPEED_MULTIPLIER : 1);
    player.x += nx * speed * dt;
    player.y += ny * speed * dt;
    player.x = clamp(player.x, player.width / 2, WORLD_WIDTH - player.width / 2);
    player.y = clamp(player.y, PLAYER_MIN_Y, PLAYER_MAX_Y);
    if (dx !== 0) player.facing = dx > 0 ? 1 : -1;
    if (
      player.animation !== "hit" &&
      player.animation !== "punch" &&
      player.animation !== "kick" &&
      player.animation !== "jump"
    ) {
      player.animation = "walk";
    }
  } else if (
    player.animation !== "hit" &&
    player.animation !== "punch" &&
    player.animation !== "kick" &&
    player.animation !== "jump"
  ) {
    player.animation = "static";
  }

  if (player.jumpTime > 0 && player.animation !== "hit") {
    player.jumpTime = Math.max(0, player.jumpTime - dt);
    const t = 1 - player.jumpTime / 0.7;
    player.jumpHeight = Math.sin(t * Math.PI) * 110;
    if (player.jumpTime <= 0) {
      player.jumpHeight = 0;
      if (player.animation === "jump") {
        player.animFrame = ASSET_PATHS.playerJump.length - 1;
        player.animTimer = 0;
      } else {
        player.animation = "static";
      }
    }
  }

  if (player.attackType && player.animation !== "hit") {
    player.attackTimer -= dt;
    const hitThreshold =
      player.attackDuration > 0 ? player.attackDuration * 0.55 : 0.12;
    if (!player.attackHitFired && player.attackTimer <= hitThreshold) {
      applyPlayerHit();
    }
    if (player.attackTimer <= 0) {
      if (player.attackType) player.attackType = null;
      if (!player.dead) player.animation = "static";
    }
  }

  if (player.boosts.rapidFire > 0 && isActionHeld("shoot")) {
    triggerPlayerAction("shoot");
  }

  if (player.animation === "hit") {
    player.animTimer += dt;
    while (
      player.animTimer >= 0.08 &&
      player.animFrame < ASSET_PATHS.playerHit.length - 1
    ) {
      player.animTimer -= 0.08;
      player.animFrame += 1;
    }
    if (
      player.animFrame === ASSET_PATHS.playerHit.length - 1 &&
      player.animTimer >= 0.08
    ) {
      player.animation = len > 0.2 ? "walk" : "static";
      player.animFrame = 0;
      player.animTimer = 0;
    }
  } else if (player.animation === "walk") {
    player.animTimer += dt;
    if (player.animTimer > 0.08) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % ASSET_PATHS.playerWalk.length;
    }
  } else if (player.animation === "punch") {
    player.animTimer += dt;
    if (player.animTimer > 0.08) {
      player.animTimer = 0;
      player.animFrame =
        (player.animFrame + 1) % ASSET_PATHS.playerPunch.length;
    }
  } else if (player.animation === "kick") {
    player.animTimer += dt;
    if (player.animTimer > 0.08) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % ASSET_PATHS.playerKick.length;
    }
  } else if (player.animation === "jump") {
    player.animTimer += dt;
    if (player.jumpTime <= 0) {
      if (player.animTimer >= PLAYER_JUMP_LAND_DURATION) {
        player.animation = len > 0.2 ? "walk" : "static";
        player.animFrame = 0;
        player.animTimer = 0;
      }
    } else if (
      player.animTimer > 0.08 &&
      player.animFrame < ASSET_PATHS.playerJump.length - 2
    ) {
      player.animTimer = 0;
      player.animFrame += 1;
    }
  } else {
    player.animFrame = 0;
  }
}

function advanceEnemyDeath(enemy, dt) {
  enemy.deathTimer -= dt;
  enemy.animTimer += dt;
  while (
    enemy.animTimer >= ENEMY_DEATH_FRAME_DURATION &&
    enemy.animFrame < ASSET_PATHS.enemyDeath.length - 1
  ) {
    enemy.animTimer -= ENEMY_DEATH_FRAME_DURATION;
    enemy.animFrame += 1;
  }
  return enemy.deathTimer <= 0;
}

function updateEnemies(dt) {
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = game.enemies[i];
    if (enemy.dead) {
      if (advanceEnemyDeath(enemy, dt)) game.enemies.splice(i, 1);
      continue;
    }

    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt);

    if (enemy.attackType) {
      enemy.attackTimer -= dt;
      const hitThreshold =
        enemy.attackDuration > 0 ? enemy.attackDuration * 0.55 : 0.16;
      if (!enemy.attackHitFired && enemy.attackTimer <= hitThreshold) {
        resolveEnemyAttack(enemy);
        enemy.attackHitFired = true;
      }
      if (enemy.attackTimer <= 0) {
        enemy.attackType = null;
        enemy.animation = "walk";
      }
    }

    if (enemy.animation === "hit") {
      enemy.animTimer += dt;
      if (enemy.animTimer > 0.08) {
        enemy.animTimer = 0;
        enemy.animFrame = (enemy.animFrame + 1) % ASSET_PATHS.enemyHit.length;
        if (enemy.animFrame >= ASSET_PATHS.enemyHit.length - 1)
          enemy.animation = "walk";
      }
    } else if (enemy.animation === "punch") {
      enemy.animTimer += dt;
      if (enemy.animTimer > 0.08) {
        enemy.animTimer = 0;
        enemy.animFrame = (enemy.animFrame + 1) % ASSET_PATHS.enemyPunch.length;
      }
    } else if (enemy.animation === "kick") {
      enemy.animTimer += dt;
      if (enemy.animTimer > 0.08) {
        enemy.animTimer = 0;
        enemy.animFrame = (enemy.animFrame + 1) % ASSET_PATHS.enemyKick.length;
      }
    } else {
      enemy.animTimer += dt;
      if (enemy.animTimer > 0.08) {
        enemy.animTimer = 0;
        enemy.animFrame = (enemy.animFrame + 1) % ASSET_PATHS.enemyWalk.length;
      }
    }

    if (!enemy.attackType) {
      const dx = game.player.x - enemy.x;
      const dy = game.player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (dx !== 0) enemy.facing = dx > 0 ? 1 : -1;
      if (distance > 55 * CHARACTER_SCALE) {
        enemy.x += (dx / distance) * enemy.speed * dt;
        enemy.y += (dy / distance) * enemy.speed * dt;
        enemy.y = clamp(enemy.y, PLAYER_MIN_Y, PLAYER_MAX_Y);
      }
      handleEnemyAttack(enemy);
    }
  }
}

function updateProjectiles(dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i -= 1) {
    const p = game.projectiles[i];
    p.x += p.vx * dt;
    p.rotation = (p.rotation + Math.PI * 2 * dt) % (Math.PI * 2);
    p.ttl -= dt;
    if (p.ttl <= 0 || p.x < -50 || p.x > WORLD_WIDTH + 50) {
      game.projectiles.splice(i, 1);
      continue;
    }

    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const hitX = Math.abs(p.x - enemy.x) < 30 * CHARACTER_SCALE;
      const hitY = Math.abs(p.y - enemy.y) < 40 * CHARACTER_SCALE;
      if (hitX && hitY) {
        enemy.health -= getPlayerDamage(3.35);
        spawnHitEffect(
          enemy.x + enemy.width / 2,
          enemy.y + enemy.height / 2,
          enemy.y + enemy.height,
        );
        if (enemy.health <= 0) {
          enemy.dead = true;
          enemy.deathTimer =
            ASSET_PATHS.enemyDeath.length * ENEMY_DEATH_FRAME_DURATION;
          enemy.animation = "dead";
          enemy.animFrame = 0;
          enemy.animTimer = 0;
          game.score += 1;
          game.player.speechIndex = Math.floor(
            Math.random() * ASSET_PATHS.playerSpeech.length,
          );
          game.player.speechTimer = 3;
          playSound(ASSET_PATHS.enemyDeathSfx);
        } else {
          enemy.animation = "hit";
          enemy.animFrame = 0;
        }
        game.projectiles.splice(i, 1);
        break;
      }
    }
  }
}

function updateEffects(dt) {
  for (let i = game.effects.length - 1; i >= 0; i -= 1) {
    const effect = game.effects[i];
    effect.frameTimer += dt;
    while (effect.frameTimer >= HIT_EFFECT_FRAME_DURATION) {
      effect.frameTimer -= HIT_EFFECT_FRAME_DURATION;
      effect.frame += 1;
    }
    if (effect.frame >= ASSET_PATHS.fxHit.length) {
      game.effects.splice(i, 1);
    }
  }
}

function isPowerUpAvailable(type) {
  return (
    game.powerUpCounts[type] < POWER_UP_LIMITS[type] &&
    !game.powerUps.some((powerUp) => powerUp.type === type)
  );
}

function choosePowerUpType() {
  const player = game.player;
  const wantsHealth =
    player.health <= player.maxHealth - HEALTH_POWER_UP_AMOUNT &&
    isPowerUpAvailable("health");
  if (wantsHealth && player.health <= 50) return "health";

  const options = Object.keys(player.boosts).filter(
    (type) => player.boosts[type] <= 0 && isPowerUpAvailable(type),
  );
  if (wantsHealth) options.push("health");
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function spawnPowerUp() {
  const type = choosePowerUpType();
  if (!type) return false;

  const taken = [
    ...game.powerUps,
    {
      x: game.player.x + game.player.width / 2,
      y: game.player.y + game.player.height,
    },
  ];
  let spot = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const x = game.cameraX + 360 + Math.random() * 540;
    const y = FEET_MIN_Y + 30 + Math.random() * 220;
    const crowded = taken.some(
      (item) => Math.hypot(item.x - x, item.y - y) < POWER_UP_SPACING,
    );
    if (!crowded) {
      spot = { x, y };
      break;
    }
  }
  if (!spot) return false;

  game.powerUpCounts[type] += 1;
  game.powerUps.push({
    type,
    ...spot,
    age: 0,
    ttl: POWER_UP_LIFETIME,
  });
  return true;
}

function collectPowerUp(powerUp) {
  const player = game.player;
  if (powerUp.type === "health") {
    player.health = clamp(
      player.health + HEALTH_POWER_UP_AMOUNT,
      0,
      player.maxHealth,
    );
  } else {
    player.boosts[powerUp.type] = BOOST_DURATIONS[powerUp.type];
    if (powerUp.type === "rapidFire") player.shootCooldown = 0;
  }
  game.powerUpEffects.push({
    type: powerUp.type,
    x: powerUp.x,
    y: powerUp.y - POWER_UP_SIZE / 2,
    text: POWER_UP_LABELS[powerUp.type],
    age: 0,
  });
  playSound(ASSET_PATHS.btnClick);
}

function updatePowerUps(dt) {
  const player = game.player;
  for (const type of Object.keys(player.boosts)) {
    player.boosts[type] = Math.max(0, player.boosts[type] - dt);
  }

  game.powerUpTimer -= player.health <= POWER_UP_LOW_HEALTH ? dt * 2 : dt;
  if (game.powerUpTimer <= 0) {
    const spawned =
      game.powerUps.length < POWER_UP_MAX_ON_STREET && spawnPowerUp();
    game.powerUpTimer = spawned
      ? POWER_UP_INTERVAL_MIN +
        Math.random() * (POWER_UP_INTERVAL_MAX - POWER_UP_INTERVAL_MIN)
      : POWER_UP_RETRY_DELAY;
  }

  const playerX = player.x + player.width / 2;
  const playerFeetY = player.y + player.height;
  for (let i = game.powerUps.length - 1; i >= 0; i -= 1) {
    const powerUp = game.powerUps[i];
    powerUp.age += dt;
    powerUp.ttl -= dt;
    if (
      Math.abs(powerUp.x - playerX) < 90 &&
      Math.abs(powerUp.y - playerFeetY) < 80
    ) {
      collectPowerUp(powerUp);
      game.powerUps.splice(i, 1);
    } else if (powerUp.ttl <= 0) {
      game.powerUps.splice(i, 1);
    }
  }

  for (let i = game.powerUpEffects.length - 1; i >= 0; i -= 1) {
    const effect = game.powerUpEffects[i];
    effect.age += dt;
    if (effect.age >= POWER_UP_EFFECT_DURATION) {
      game.powerUpEffects.splice(i, 1);
    }
  }
}

function getEnemySpawnInterval() {
  const interval =
    game.timer > 120
      ? 9
      : game.timer > 60
        ? 7
        : game.timer > FINAL_WAVE_SECONDS
          ? 5
          : 7;
  return interval / ENEMY_SPAWN_RATE;
}

function keepEnemyOnScreen() {
  const viewLeft = game.cameraX;
  const viewRight = viewLeft + GAME_WIDTH;
  const alive = game.enemies.filter((enemy) => !enemy.dead);
  const onScreen = alive.some(
    (enemy) => enemy.x + enemy.width > viewLeft && enemy.x < viewRight,
  );
  if (onScreen) return;

  let closest = null;
  for (const enemy of alive) {
    if (
      !closest ||
      Math.abs(enemy.x - game.player.x) < Math.abs(closest.x - game.player.x)
    ) {
      closest = enemy;
    }
  }
  if (!closest) {
    spawnEnemy();
    closest = game.enemies[game.enemies.length - 1];
    if (!closest || closest.dead) return;
  }

  const fromLeft = closest.x < viewLeft;
  closest.x = fromLeft
    ? viewLeft - closest.width + ENEMY_EDGE_PEEK
    : viewRight - ENEMY_EDGE_PEEK;
  closest.facing = fromLeft ? 1 : -1;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function createRaindrop(y) {
  return {
    x: randomRange(-250, GAME_WIDTH),
    y,
    length: randomRange(16, 30),
    speed: randomRange(950, 1350),
  };
}

function createSnowflake(y) {
  const size = randomRange(1.5, 4.5);
  return {
    x: randomRange(-200, GAME_WIDTH),
    y,
    size,
    speed: 35 + size * 22,
    sway: randomRange(0, Math.PI * 2),
    swaySpeed: randomRange(0.8, 2),
  };
}

function createWeather() {
  const roll = Math.random();
  if (roll >= RAIN_CHANCE + SNOW_CHANCE) return null;
  const type = roll < RAIN_CHANCE ? "rain" : "snow";
  const intensity = randomRange(WEATHER_MIN_INTENSITY, WEATHER_MAX_INTENSITY);
  const weather = {
    type,
    intensity,
    target: intensity,
    shiftTimer: randomRange(WEATHER_SHIFT_MIN, WEATHER_SHIFT_MAX),
    lastCameraX: game.cameraX,
  };

  if (type === "rain") {
    weather.drops = [];
    for (let i = 0; i < RAIN_MAX_DROPS; i += 1) {
      weather.drops.push(createRaindrop(Math.random() * GAME_HEIGHT));
    }
    weather.splashes = [];
    weather.splashTimer = 0;
    weather.flashAge = -1;
    weather.bolt = null;
    weather.thunderTimer = randomRange(3, 8);
  } else {
    weather.flakes = [];
    for (let i = 0; i < SNOW_MAX_FLAKES; i += 1) {
      weather.flakes.push(createSnowflake(Math.random() * GAME_HEIGHT));
    }
    weather.gust = 0;
    weather.gustTarget = 0;
    weather.gustTimer = randomRange(3, 7);
  }
  return weather;
}

function getActiveRaindrops(weather) {
  return Math.round(RAIN_MAX_DROPS * weather.intensity);
}

function getActiveSnowflakes(weather) {
  return Math.round(SNOW_MAX_FLAKES * weather.intensity);
}

function createBolt() {
  const branches = [];
  let x = randomRange(150, GAME_WIDTH - 150);
  let y = -10;
  const main = [{ x, y }];
  const bottom = randomRange(180, 300);
  while (y < bottom) {
    x += randomRange(-28, 28);
    y += randomRange(18, 34);
    main.push({ x, y });
    if (branches.length === 0 && y > 70 && Math.random() < 0.3) {
      const side = Math.random() < 0.5 ? -1 : 1;
      branches.push([
        { x, y },
        { x: x + side * randomRange(25, 45), y: y + randomRange(25, 40) },
        { x: x + side * randomRange(50, 80), y: y + randomRange(55, 80) },
      ]);
    }
  }
  return { paths: [main, ...branches], age: 0 };
}

function strikeLightning(weather) {
  weather.flashAge = 0;
  weather.bolt = Math.random() < 0.7 ? createBolt() : null;
  playThunder(randomRange(0.25, 1.6));
}

function updateWeather(dt) {
  const weather = game.weather;
  if (!weather) return;

  weather.shiftTimer -= dt;
  if (weather.shiftTimer <= 0) {
    weather.target = randomRange(WEATHER_MIN_INTENSITY, WEATHER_MAX_INTENSITY);
    weather.shiftTimer = randomRange(WEATHER_SHIFT_MIN, WEATHER_SHIFT_MAX);
  }
  weather.intensity += (weather.target - weather.intensity) * Math.min(1, dt * 0.4);

  const cameraShift = game.cameraX - weather.lastCameraX;
  weather.lastCameraX = game.cameraX;
  if (weather.type === "rain") updateRain(weather, dt, cameraShift);
  else updateSnow(weather, dt, cameraShift);
}

function updateSnow(weather, dt, cameraShift) {
  weather.gustTimer -= dt;
  if (weather.gustTimer <= 0) {
    weather.gustTarget =
      Math.random() < 0.35 ? randomRange(0.6, 1) : randomRange(0, 0.25);
    weather.gustTimer = randomRange(3, 8);
  }
  weather.gust += (weather.gustTarget - weather.gust) * Math.min(1, dt * 0.8);

  const wind = 15 + weather.gust * 110;
  const active = getActiveSnowflakes(weather);
  for (let i = 0; i < active; i += 1) {
    const flake = weather.flakes[i];
    const depth = flake.size / 3;
    flake.sway += flake.swaySpeed * dt;
    flake.y += flake.speed * dt;
    flake.x +=
      (wind * depth + Math.sin(flake.sway) * 20) * dt - cameraShift * depth;
    if (
      flake.y - flake.size > GAME_HEIGHT ||
      flake.x < -250 ||
      flake.x > GAME_WIDTH + 250
    ) {
      Object.assign(flake, createSnowflake(randomRange(-40, 0)));
    }
  }
}

function updateRain(weather, dt, cameraShift) {
  const active = getActiveRaindrops(weather);
  for (let i = 0; i < active; i += 1) {
    const drop = weather.drops[i];
    drop.y += drop.speed * dt;
    drop.x += drop.speed * RAIN_SLANT * dt - cameraShift;
    if (
      drop.y - drop.length > GAME_HEIGHT ||
      drop.x < -300 ||
      drop.x > GAME_WIDTH + 300
    ) {
      Object.assign(drop, createRaindrop(randomRange(-120, 0)));
    }
  }

  weather.splashTimer -= dt;
  while (weather.splashTimer <= 0) {
    weather.splashes.push({
      x: Math.random() * GAME_WIDTH,
      y: randomRange(FEET_MIN_Y + 20, GAME_HEIGHT - 5),
      age: 0,
    });
    weather.splashTimer += 1 / (45 * weather.intensity);
  }
  for (let i = weather.splashes.length - 1; i >= 0; i -= 1) {
    const splash = weather.splashes[i];
    splash.age += dt;
    splash.x -= cameraShift;
    if (splash.age >= SPLASH_DURATION) weather.splashes.splice(i, 1);
  }

  if (weather.flashAge >= 0) weather.flashAge += dt;
  if (weather.bolt) {
    weather.bolt.age += dt;
    if (weather.bolt.age >= LIGHTNING_BOLT_DURATION) weather.bolt = null;
  }
  weather.thunderTimer -= dt * (0.5 + weather.intensity);
  if (weather.thunderTimer <= 0) {
    strikeLightning(weather);
    weather.thunderTimer = randomRange(THUNDER_DELAY_MIN, THUNDER_DELAY_MAX);
  }
}

function startEnding(reason) {
  const player = game.player;
  game.overReason = reason;
  game.endingTimer = ENDING_HOLD_SECONDS;
  player.attackType = null;
  player.jumpTime = 0;
  player.jumpHeight = 0;
  player.animation = reason === "dead" ? "dead" : "win";
  player.animFrame = 0;
  player.animTimer = 0;
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    enemy.attackType = null;
    enemy.animation = reason === "dead" ? "win" : "static";
    enemy.animFrame = 0;
  }
  setState("ending");
}

function updateEnding(dt) {
  const player = game.player;
  game.endingTimer -= dt;
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  if (player.animation === "dead") {
    player.animTimer += dt;
    while (
      player.animTimer >= PLAYER_DEATH_FRAME_DURATION &&
      player.animFrame < ASSET_PATHS.playerDeath.length - 1
    ) {
      player.animTimer -= PLAYER_DEATH_FRAME_DURATION;
      player.animFrame += 1;
    }
  }

  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = game.enemies[i];
    if (enemy.dead && advanceEnemyDeath(enemy, dt)) game.enemies.splice(i, 1);
  }

  for (let i = game.projectiles.length - 1; i >= 0; i -= 1) {
    const p = game.projectiles[i];
    p.x += p.vx * dt;
    p.rotation = (p.rotation + Math.PI * 2 * dt) % (Math.PI * 2);
    p.ttl -= dt;
    if (p.ttl <= 0) game.projectiles.splice(i, 1);
  }

  updateEffects(dt);
  updateWeather(dt);
  for (let i = game.powerUpEffects.length - 1; i >= 0; i -= 1) {
    game.powerUpEffects[i].age += dt;
    if (game.powerUpEffects[i].age >= POWER_UP_EFFECT_DURATION) {
      game.powerUpEffects.splice(i, 1);
    }
  }

  if (game.endingTimer <= 0) {
    setState(game.overReason === "dead" ? "gameOverDead" : "gameOverTime");
  }
}

function update(dt) {
  if (game.state === "ending") {
    updateEnding(dt);
    return;
  }

  if (game.state === "gameOverTime" || game.state === "gameOverDead") {
    game.gameOverDelay = Math.max(0, game.gameOverDelay - dt);
    return;
  }

  if (game.state !== "playing") return;

  game.timer = Math.max(0, game.timer - dt);
  if (game.timer <= 0) {
    startEnding("time");
    playSound(ASSET_PATHS.gameOver);
    return;
  }

  const secondsLeft = Math.ceil(game.timer);
  if (secondsLeft <= COUNTDOWN_SECONDS && secondsLeft !== game.countdownBeep) {
    game.countdownBeep = secondsLeft;
    playCountdownBeep();
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEffects(dt);
  updatePowerUps(dt);
  updateWeather(dt);

  const enemyLimit =
    game.timer <= FINAL_WAVE_SECONDS ? FINAL_WAVE_MAX_ENEMIES : MAX_ENEMIES;
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && game.enemies.length < enemyLimit) {
    spawnEnemy();
    game.spawnTimer = getEnemySpawnInterval();
  }

  game.cameraX = clamp(
    game.player.x - GAME_WIDTH / 2,
    0,
    WORLD_WIDTH - GAME_WIDTH,
  );

  keepEnemyOnScreen();
}

function drawLoadingScreen() {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const icon = assets.images[game.loadingIconPath];
  if (icon) {
    ctx.drawImage(icon, GAME_WIDTH / 2 - 110, 150, 220, 220);
  }

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 32px Arial";
  ctx.fillText("Loading…", GAME_WIDTH / 2, 430);

  const barX = GAME_WIDTH / 2 - 220;
  const barY = 470;
  const barW = 440;
  const barH = 18;
  ctx.fillStyle = "#222";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#f8d24a";
  ctx.fillRect(barX, barY, barW * (game.loadingProgress / 100), barH);
}

function drawStartScreen() {
  const bg = assets.images[ASSET_PATHS.startScreen];
  if (bg) {
    ctx.drawImage(bg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  const scale = 1 + Math.sin(game.startPulse * 3) * 0.08;
  const btn = assets.images[ASSET_PATHS.startButton];
  if (btn && btn.width && btn.height) {
    const drawWidth = btn.width * scale;
    const drawHeight = btn.height * scale;
    const centerX = BUTTONS.start.x + BUTTONS.start.w / 2;
    const centerY = BUTTONS.start.y + BUTTONS.start.h / 2;
    ctx.drawImage(
      btn,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
  }
}

function createArtCanvas(size) {
  const artCanvas = document.createElement("canvas");
  artCanvas.width = size;
  artCanvas.height = size;
  const art = artCanvas.getContext("2d");
  art.translate(size / 2, size / 2);
  return { artCanvas, art };
}

function paintHealthIcon(art) {
  const heart = new Path2D();
  heart.moveTo(0, 66);
  heart.bezierCurveTo(-92, 6, -74, -62, -30, -62);
  heart.bezierCurveTo(-12, -62, 0, -48, 0, -36);
  heart.bezierCurveTo(0, -48, 12, -62, 30, -62);
  heart.bezierCurveTo(74, -62, 92, 6, 0, 66);

  const fill = art.createRadialGradient(-20, -30, 6, 0, 0, 90);
  fill.addColorStop(0, "#ff9a9a");
  fill.addColorStop(0.45, "#e8152f");
  fill.addColorStop(1, "#6e0012");
  art.lineJoin = "round";
  art.lineWidth = 8;
  art.strokeStyle = "#1c0406";
  art.fillStyle = fill;
  art.fill(heart);
  art.stroke(heart);

  art.fillStyle = "#1c0406";
  art.fillRect(-14, -35, 28, 72);
  art.fillRect(-36, -13, 72, 28);
  art.fillStyle = "#fff";
  art.fillRect(-9, -30, 18, 62);
  art.fillRect(-31, -8, 62, 18);

  art.fillStyle = "rgba(255, 255, 255, 0.55)";
  art.beginPath();
  art.ellipse(-38, -38, 15, 9, -0.7, 0, Math.PI * 2);
  art.fill();
}

function paintStrengthIcon(art) {
  const spikes = 12;
  const burst = new Path2D();
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? 80 : 52;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    burst.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  burst.closePath();

  const fill = art.createRadialGradient(0, -8, 8, 0, 0, 84);
  fill.addColorStop(0, "#fff6b0");
  fill.addColorStop(0.5, "#ffc21a");
  fill.addColorStop(1, "#d65a00");
  art.lineJoin = "round";
  art.lineWidth = 8;
  art.strokeStyle = "#1c0e02";
  art.fillStyle = fill;
  art.fill(burst);
  art.stroke(burst);

  art.font = "italic 900 66px Arial, sans-serif";
  art.textAlign = "center";
  art.textBaseline = "middle";
  art.lineWidth = 11;
  art.strokeText("2X", -2, 3);
  art.fillStyle = "#fff";
  art.fillText("2X", -2, 3);
}

function paintEnvelope(art, x, y) {
  art.save();
  art.translate(x, y);
  art.rotate(-0.16);
  art.lineJoin = "round";
  art.lineWidth = 5;
  art.strokeStyle = "#04121f";
  art.fillStyle = "#f4fbff";
  art.fillRect(-32, -21, 64, 42);
  art.strokeRect(-32, -21, 64, 42);
  art.beginPath();
  art.moveTo(-32, -21);
  art.lineTo(0, 5);
  art.lineTo(32, -21);
  art.stroke();
  art.restore();
}

function paintRapidFireIcon(art) {
  const hexagon = new Path2D();
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    hexagon.lineTo(Math.cos(angle) * 80, Math.sin(angle) * 80);
  }
  hexagon.closePath();

  const fill = art.createRadialGradient(-16, -24, 6, 0, 0, 88);
  fill.addColorStop(0, "#9fe4ff");
  fill.addColorStop(0.5, "#1590e6");
  fill.addColorStop(1, "#06316e");
  art.lineJoin = "round";
  art.lineWidth = 8;
  art.strokeStyle = "#04121f";
  art.fillStyle = fill;
  art.fill(hexagon);
  art.stroke(hexagon);

  art.lineWidth = 6;
  art.lineCap = "round";
  art.strokeStyle = "rgba(255, 255, 255, 0.8)";
  for (const lineY of [-44, 44]) {
    art.beginPath();
    art.moveTo(-52, lineY + 8);
    art.lineTo(-22, lineY);
    art.stroke();
  }

  paintEnvelope(art, -26, 22);
  paintEnvelope(art, 2, 2);
  paintEnvelope(art, 28, -20);
}

function paintSpeedIcon(art) {
  const bolt = new Path2D();
  bolt.moveTo(6, -84);
  bolt.lineTo(-68, 14);
  bolt.lineTo(-16, 14);
  bolt.lineTo(-38, 84);
  bolt.lineTo(70, -22);
  bolt.lineTo(18, -22);
  bolt.lineTo(56, -84);
  bolt.closePath();

  const fill = art.createLinearGradient(0, -84, 0, 84);
  fill.addColorStop(0, "#d8ffd0");
  fill.addColorStop(0.5, "#35e06a");
  fill.addColorStop(1, "#057a36");
  art.lineJoin = "round";
  art.lineWidth = 8;
  art.strokeStyle = "#031a0c";
  art.fillStyle = fill;
  art.fill(bolt);
  art.stroke(bolt);

  art.lineCap = "round";
  art.lineWidth = 6;
  art.strokeStyle = "rgba(255, 255, 255, 0.85)";
  art.beginPath();
  art.moveTo(14, -68);
  art.lineTo(-36, 0);
  art.stroke();
}

function createPowerUpArt(type) {
  const { artCanvas: icon, art } = createArtCanvas(POWER_UP_SIZE * 2);
  const painters = {
    health: paintHealthIcon,
    strength: paintStrengthIcon,
    rapidFire: paintRapidFireIcon,
    speed: paintSpeedIcon,
  };
  painters[type](art);

  const glowSize = POWER_UP_SIZE * 4;
  const { artCanvas: glow, art: glowArt } = createArtCanvas(glowSize);
  const fade = glowArt.createRadialGradient(0, 0, 0, 0, 0, glowSize / 2);
  fade.addColorStop(0, `rgba(${POWER_UP_GLOW[type]}, 1)`);
  fade.addColorStop(0.45, `rgba(${POWER_UP_GLOW[type]}, 0.5)`);
  fade.addColorStop(1, `rgba(${POWER_UP_GLOW[type]}, 0)`);
  glowArt.fillStyle = fade;
  glowArt.fillRect(-glowSize / 2, -glowSize / 2, glowSize, glowSize);

  const { artCanvas: rays, art: raysArt } = createArtCanvas(glowSize);
  raysArt.fillStyle = fade;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    raysArt.beginPath();
    raysArt.moveTo(0, 0);
    raysArt.lineTo(
      Math.cos(angle - 0.13) * glowSize,
      Math.sin(angle - 0.13) * glowSize,
    );
    raysArt.lineTo(
      Math.cos(angle + 0.13) * glowSize,
      Math.sin(angle + 0.13) * glowSize,
    );
    raysArt.closePath();
    raysArt.fill();
  }

  const { artCanvas: halo, art: haloArt } = createArtCanvas(glowSize);
  haloArt.shadowColor = `rgb(${POWER_UP_GLOW[type]})`;
  haloArt.shadowBlur = 44;
  for (let i = 0; i < 3; i += 1) {
    haloArt.drawImage(icon, -POWER_UP_SIZE, -POWER_UP_SIZE);
  }

  return { icon, glow, rays, halo };
}

function getPowerUpArt(type) {
  if (!powerUpArt[type]) powerUpArt[type] = createPowerUpArt(type);
  return powerUpArt[type];
}

function drawPowerUp(powerUp) {
  const art = getPowerUpArt(powerUp.type);
  const blinking = powerUp.ttl < POWER_UP_BLINK_TIME;
  if (blinking && Math.floor(powerUp.ttl * 6) % 2 === 0) return;

  const screenX = powerUp.x - game.cameraX;
  const groundY = powerUp.y;
  const iconY = groundY - POWER_UP_SIZE * 0.8 + Math.sin(powerUp.age * 3) * 7;
  const grow = clamp(powerUp.age / 0.25, 0, 1);
  const pulse = 0.85 + Math.sin(powerUp.age * 5) * 0.15;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(screenX, groundY, 40 * grow, 12 * grow, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(screenX, iconY);
  ctx.scale(grow, grow);
  ctx.globalCompositeOperation = "lighter";
  ctx.save();
  ctx.rotate(powerUp.age * 0.8);
  ctx.globalAlpha = 0.8 * pulse;
  const raySize = POWER_UP_SIZE * 3.6;
  ctx.drawImage(art.rays, -raySize / 2, -raySize / 2, raySize, raySize);
  ctx.restore();
  ctx.globalAlpha = pulse;
  const glowSize = POWER_UP_SIZE * 3 * pulse;
  ctx.drawImage(art.glow, -glowSize / 2, -glowSize / 2, glowSize, glowSize);
  ctx.drawImage(art.halo, -POWER_UP_SIZE, -POWER_UP_SIZE, POWER_UP_SIZE * 2, POWER_UP_SIZE * 2);

  ctx.fillStyle = "#fff";
  for (let i = 0; i < 4; i += 1) {
    const angle = powerUp.age * 1.6 + (i * Math.PI) / 2;
    const orbit = POWER_UP_SIZE * 0.62;
    const sparkle = 2.5 + Math.sin(powerUp.age * 7 + i * 2) * 1.5;
    ctx.beginPath();
    ctx.arc(
      Math.cos(angle) * orbit,
      Math.sin(angle) * orbit * 0.7,
      sparkle,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.drawImage(art.icon, -POWER_UP_SIZE / 2, -POWER_UP_SIZE / 2, POWER_UP_SIZE, POWER_UP_SIZE);
  ctx.restore();
}

function drawPowerUpEffect(effect) {
  const progress = effect.age / POWER_UP_EFFECT_DURATION;
  const screenX = effect.x - game.cameraX;

  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgb(${POWER_UP_GLOW[effect.type]})`;
  ctx.lineWidth = 10 * (1 - progress) + 1;
  ctx.beginPath();
  ctx.arc(screenX, effect.y, 40 + progress * 130, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalCompositeOperation = "source-over";
  ctx.font = "italic 900 40px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  const textY = effect.y - 40 - progress * 70;
  ctx.lineWidth = 18;
  ctx.strokeStyle = `rgba(${POWER_UP_GLOW[effect.type]}, 0.45)`;
  ctx.strokeText(effect.text, screenX, textY);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#1c0406";
  ctx.fillStyle = "#fff";
  ctx.strokeText(effect.text, screenX, textY);
  ctx.fillText(effect.text, screenX, textY);
  ctx.restore();
}

function drawBoostTimers(healthX) {
  const barX = healthX + 50;
  const barW = 196;
  const barH = 12;
  let rowY = 76;
  for (const [type, timeLeft] of Object.entries(game.player.boosts)) {
    if (timeLeft <= 0) continue;
    const barY = rowY + 12;
    ctx.drawImage(getPowerUpArt(type).icon, healthX + 8, rowY, 36, 36);
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
    ctx.fillStyle = `rgb(${POWER_UP_GLOW[type]})`;
    ctx.fillRect(barX, barY, barW * (timeLeft / BOOST_DURATIONS[type]), barH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${Math.ceil(timeLeft)}s`, barX + barW + 10, barY + 12);
    rowY += 38;
  }
}

function drawEnemy(enemy) {
  const img = getEnemyFrame(enemy);
  const drawX = enemy.x - game.cameraX;
  const drawY = enemy.y;
  ctx.save();
  ctx.translate(drawX + enemy.width / 2, drawY + enemy.height / 2);
  ctx.scale(enemy.facing, 1);
  ctx.translate(-enemy.width / 2, -enemy.height / 2);
  if (enemy.hurtFlash > 0) ctx.globalAlpha = 0.7;
  ctx.drawImage(img, 0, 0, enemy.width, enemy.height);
  ctx.restore();
}

function drawHitEffect(effect) {
  const framePath = ASSET_PATHS.fxHit[effect.frame];
  const img = assets.images[framePath];
  if (!img) return;
  ctx.drawImage(
    img,
    effect.x - game.cameraX - img.width / 2,
    effect.y - img.height / 2,
    img.width,
    img.height,
  );
}

function drawProjectile(projectile) {
  const img = assets.images[ASSET_PATHS.projectile];
  if (!img) return;
  const screenX = projectile.x - game.cameraX;
  ctx.save();
  ctx.translate(screenX + projectile.w / 2, projectile.y + projectile.h / 2);
  ctx.rotate(projectile.rotation);
  ctx.drawImage(
    img,
    -projectile.w / 2,
    -projectile.h / 2,
    projectile.w,
    projectile.h,
  );
  ctx.restore();
}

function drawPlayer() {
  const player = game.player;
  const px = player.x - game.cameraX;
  const py = player.y - player.jumpHeight;
  ctx.save();
  ctx.translate(px + player.width / 2, py + player.height / 2);
  ctx.scale(player.facing, 1);
  ctx.translate(-player.width / 2, -player.height / 2);
  if (player.hurtFlash > 0) ctx.globalAlpha = 0.6;
  ctx.drawImage(getPlayerFrame(), 0, 0, player.width, player.height);
  ctx.restore();
}

function drawSpeechBubble() {
  const player = game.player;
  if (player.speechIndex === null || player.speechTimer <= 0) return;
  const speechImg = assets.images[ASSET_PATHS.playerSpeech[player.speechIndex]];
  if (!speechImg) return;
  const px = player.x - game.cameraX;
  const py = player.y - player.jumpHeight;
  const speechWidth = speechImg.width * CHARACTER_SCALE;
  const speechHeight = speechImg.height * CHARACTER_SCALE;
  ctx.drawImage(
    speechImg,
    px + (player.width - speechWidth) / 2 + 32 * CHARACTER_SCALE,
    Math.max(0, py - speechHeight + 20 * CHARACTER_SCALE),
    speechWidth,
    speechHeight,
  );
}

function getWorldLayers() {
  const player = game.player;
  return [
    ...game.powerUps.map((powerUp) => ({
      depth: powerUp.y,
      draw: () => drawPowerUp(powerUp),
    })),
    ...game.enemies.map((enemy) => ({
      depth: enemy.y + enemy.height,
      draw: () => drawEnemy(enemy),
    })),
    ...game.effects.map((effect) => ({
      depth: (effect.groundY ?? effect.y) + 1,
      draw: () => drawHitEffect(effect),
    })),
    ...game.projectiles.map((projectile) => ({
      depth: (projectile.groundY ?? projectile.y + projectile.h) + 0.5,
      draw: () => drawProjectile(projectile),
    })),
    { depth: player.y + player.height, draw: drawPlayer },
  ].sort((a, b) => a.depth - b.depth);
}

function drawWorld() {
  for (const layer of getWorldLayers()) layer.draw();
  for (const effect of game.powerUpEffects) drawPowerUpEffect(effect);
  drawSpeechBubble();
}

function drawHUD() {
  const timerBg = assets.images[ASSET_PATHS.timerBg];
  const timerX = 45;
  const timerY = 20;
  if (timerBg) ctx.drawImage(timerBg, timerX, timerY);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 22px Arial";
  ctx.fillText("TIME", timerX + 49, 105);
  ctx.font = "bold 30px Arial";
  ctx.fillText(String(Math.ceil(game.timer)), timerX + 49, timerY + 39);

  const scoreBg = assets.images[ASSET_PATHS.scoreBg];
  const scoreX = 145;
  const scoreY = 20;
  if (scoreBg) ctx.drawImage(scoreBg, scoreX, scoreY);
  ctx.font = "bold 22px Arial";
  ctx.fillText("SCORE", scoreX + 49, 105);
  ctx.font = "bold 30px Arial";
  ctx.fillText(String(game.score), scoreX + 49, scoreY + 39);

  const healthBg = assets.images[ASSET_PATHS.healthBg];
  const healthX = 486;
  const healthY = 20;
  if (healthBg) ctx.drawImage(healthBg, healthX, healthY);
  const healthFill = assets.images[ASSET_PATHS.healthFill];
  if (healthFill) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(
      healthX + 11,
      healthY + 11,
      286 * (game.player.health / game.player.maxHealth),
      36,
    );
    ctx.clip();
    ctx.drawImage(healthFill, healthX + 11, healthY + 11);
    ctx.restore();
  }

  drawBoostTimers(healthX);

  const restartIcon = assets.images[ASSET_PATHS.restartBtn];
  if (restartIcon)
    ctx.drawImage(
      restartIcon,
      BUTTONS.restart.x,
      BUTTONS.restart.y,
      BUTTONS.restart.w,
      BUTTONS.restart.h,
    );

  const pauseIcon =
    game.state === "paused"
      ? assets.images[ASSET_PATHS.playBtn]
      : assets.images[ASSET_PATHS.pauseBtn];
  if (pauseIcon)
    ctx.drawImage(
      pauseIcon,
      BUTTONS.pause.x,
      BUTTONS.pause.y,
      BUTTONS.pause.w,
      BUTTONS.pause.h,
    );

  const muteIcon = game.muted
    ? assets.images[ASSET_PATHS.audioOff]
    : assets.images[ASSET_PATHS.audioOn];
  if (muteIcon)
    ctx.drawImage(
      muteIcon,
      BUTTONS.mute.x,
      BUTTONS.mute.y,
      BUTTONS.mute.w,
      BUTTONS.mute.h,
    );

  const fullIcon = assets.images[ASSET_PATHS.fullScreenBtn];
  if (fullIcon)
    ctx.drawImage(
      fullIcon,
      BUTTONS.fullscreen.x,
      BUTTONS.fullscreen.y,
      BUTTONS.fullscreen.w,
      BUTTONS.fullscreen.h,
    );

  const joyBg = assets.images[ASSET_PATHS.joystickBg];
  if (joyBg) {
    const { x, y, radius } = BUTTONS.joystick;
    ctx.drawImage(joyBg, x - radius, y - radius, radius * 2, radius * 2);
  }
  const thumb = assets.images[ASSET_PATHS.joystickThumb];
  if (thumb) {
    const { x, y, radius } = BUTTONS.joystick;
    const dx = input.joystickX * radius;
    const dy = input.joystickY * radius;
    ctx.drawImage(
      thumb,
      x - radius * 0.45 + dx,
      y - radius * 0.45 + dy,
      radius * 0.9,
      radius * 0.9,
    );
  }

  const actions = [
    { name: "jump", src: ASSET_PATHS.actionJump, rect: BUTTONS.jump },
    { name: "punch", src: ASSET_PATHS.actionPunch, rect: BUTTONS.punch },
    { name: "kick", src: ASSET_PATHS.actionKick, rect: BUTTONS.kick },
    { name: "shoot", src: ASSET_PATHS.actionShoot, rect: BUTTONS.shoot },
  ];
  actions.forEach(({ name, src, rect }) => {
    const img = assets.images[src];
    if (!img) return;
    const scale = isActionHeld(name) ? 0.9 : 1;
    const drawWidth = rect.w * scale;
    const drawHeight = rect.h * scale;
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    const coolingDown =
      name === "shoot" &&
      game.player.shootCooldown > 0 &&
      game.player.boosts.rapidFire <= 0;
    ctx.globalAlpha = coolingDown ? 0.35 : 1;
    ctx.drawImage(
      img,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
    ctx.globalAlpha = 1;
  });

  if (game.state === "paused") {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 54px Arial";
    ctx.fillText("PAUSED", GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
}

function drawBackgroundLayer() {
  const bg0 =
    assets.images[ASSET_PATHS.background_0] ||
    assets.images[ASSET_PATHS.background];
  const bg1 =
    assets.images[ASSET_PATHS.background_1] ||
    assets.images[ASSET_PATHS.background];

  if (!bg0 && !bg1) return;

  const parallaxX = -game.cameraX;
  const bg0Width = bg0 ? bg0.width || GAME_WIDTH : GAME_WIDTH;
  const bg0Height = bg0 ? bg0.height || GAME_HEIGHT : GAME_HEIGHT;
  const bg1Width = bg1 ? bg1.width || GAME_WIDTH : GAME_WIDTH;
  const bg1Height = bg1 ? bg1.height || GAME_HEIGHT : GAME_HEIGHT;
  const baseY = (GAME_HEIGHT - bg0Height) / 2;

  ctx.imageSmoothingEnabled = true;

  if (bg0) {
    ctx.drawImage(bg0, parallaxX, baseY, bg0Width, bg0Height);
  }

  if (bg1) {
    ctx.drawImage(
      bg1,
      parallaxX + bg0Width,
      (GAME_HEIGHT - bg1Height) / 2,
      bg1Width,
      bg1Height,
    );
  }
}

function getFlashAlpha(age) {
  if (age < 0) return 0;
  if (age < 0.08) return 0.55;
  if (age < 0.14) return 0.1;
  if (age < 0.24) return 0.4;
  return Math.max(0, 0.4 * (1 - (age - 0.24) / 0.5));
}

function drawWeatherBackdrop() {
  const weather = game.weather;
  if (!weather) return;
  ctx.save();
  if (weather.type === "snow") {
    ctx.fillStyle = `rgba(170, 190, 220, ${0.06 + weather.intensity * 0.08})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const dusting = ctx.createLinearGradient(0, FEET_MIN_Y - 30, 0, GAME_HEIGHT);
    dusting.addColorStop(0, "rgba(240, 246, 255, 0)");
    dusting.addColorStop(
      1,
      `rgba(240, 246, 255, ${0.18 + weather.intensity * 0.17})`,
    );
    ctx.fillStyle = dusting;
    ctx.fillRect(0, FEET_MIN_Y - 30, GAME_WIDTH, GAME_HEIGHT);
    ctx.restore();
    return;
  }
  ctx.fillStyle = `rgba(8, 14, 32, ${0.18 + weather.intensity * 0.17})`;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.lineWidth = 1.5;
  for (const splash of weather.splashes) {
    const progress = splash.age / SPLASH_DURATION;
    const radius = 2 + progress * 9;
    ctx.strokeStyle = `rgba(200, 215, 240, ${0.5 * (1 - progress)})`;
    ctx.beginPath();
    ctx.ellipse(splash.x, splash.y, radius, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnow(weather) {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.beginPath();
  const active = getActiveSnowflakes(weather);
  for (let i = 0; i < active; i += 1) {
    const flake = weather.flakes[i];
    ctx.moveTo(flake.x + flake.size, flake.y);
    ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function drawWeather() {
  const weather = game.weather;
  if (!weather) return;
  if (weather.type === "snow") {
    drawSnow(weather);
    return;
  }
  ctx.save();
  ctx.strokeStyle = `rgba(190, 210, 235, ${0.28 + weather.intensity * 0.17})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const active = getActiveRaindrops(weather);
  for (let i = 0; i < active; i += 1) {
    const drop = weather.drops[i];
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - drop.length * RAIN_SLANT, drop.y - drop.length);
  }
  ctx.stroke();

  if (weather.bolt) {
    const fade = 1 - weather.bolt.age / LIGHTNING_BOLT_DURATION;
    ctx.globalCompositeOperation = "lighter";
    ctx.lineJoin = "round";
    for (const [width, color] of [
      [12, `rgba(140, 170, 255, ${0.35 * fade})`],
      [3, `rgba(255, 255, 255, ${fade})`],
    ]) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      for (const path of weather.bolt.paths) {
        ctx.beginPath();
        path.forEach((point, i) =>
          i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
        );
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  }

  const flash = getFlashAlpha(weather.flashAge);
  if (flash > 0) {
    ctx.fillStyle = `rgba(225, 232, 255, ${flash})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  ctx.restore();
}

function drawGameplay() {
  drawBackgroundLayer();
  drawWeatherBackdrop();
  drawWorld();
  drawWeather();
  drawHUD();
}

function drawGameOver() {
  const bg = assets.images[ASSET_PATHS.gameOverScreen];
  if (bg) ctx.drawImage(bg, 0, 0, GAME_WIDTH, GAME_HEIGHT);

  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.font = "bold 38px Arial";
  if (game.overReason === "time") {
    ctx.fillText("Time Over!", GAME_WIDTH / 2, 550);
  } else {
    ctx.fillText("You Died. Mail Stolen.", GAME_WIDTH / 2, 550);
  }
  ctx.font = "bold 30px Arial";
  ctx.fillText(`${game.score} Thieves Defeat!`, GAME_WIDTH / 2, 600);

  const replay = assets.images[ASSET_PATHS.playAgainButton];
  if (replay && replay.width && replay.height) {
    const pulse = 1 + Math.sin(performance.now() / 500) * 0.12;
    const drawWidth = replay.width * pulse;
    const drawHeight = replay.height * pulse;
    const centerX = BUTTONS.playAgain.x + BUTTONS.playAgain.w / 2;
    const centerY = BUTTONS.playAgain.y + BUTTONS.playAgain.h / 2;
    ctx.drawImage(
      replay,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
  }
}

function showPortraitOverlay(shown) {
  if (shown === portraitOverlayShown) return;
  portraitOverlayShown = shown;
  portraitOverlay.style.display = shown ? "flex" : "none";
}

function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (isPortrait()) {
    const img = assets.images[ASSET_PATHS.rotatePhone];
    if (img) {
      ctx.drawImage(img, GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 150, 300, 300);
    }
    showPortraitOverlay(true);
    return;
  }

  showPortraitOverlay(false);

  if (game.state === "loading") drawLoadingScreen();
  else if (game.state === "start") drawStartScreen();
  else if (
    game.state === "playing" ||
    game.state === "paused" ||
    game.state === "ending"
  ) {
    drawGameplay();
  }
  else drawGameOver();
}

function rectContains(x, y, rect) {
  return (
    x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
  );
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = GAME_WIDTH / rect.width;
  const scaleY = GAME_HEIGHT / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.webkitCurrentFullScreenElement ||
    null
  );
}

function toggleFullscreen() {
  if (getFullscreenElement()) {
    const exitFullscreen =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.webkitCancelFullScreen;
    if (exitFullscreen) {
      const result = exitFullscreen.call(document);
      if (result && typeof result.catch === "function") {
        result.catch((error) =>
          console.warn("Unable to exit fullscreen mode:", error),
        );
      }
    } else {
      console.warn("This browser cannot exit fullscreen mode.");
    }
    return;
  }

  const requestFullscreen =
    gameShell.requestFullscreen ||
    gameShell.webkitRequestFullscreen ||
    gameShell.webkitRequestFullScreen;

  if (!requestFullscreen) {
    gameShell.classList.toggle("is-fullscreen");
    resizeCanvas();
    return;
  }

  try {
    const result = requestFullscreen.call(gameShell);
    if (result && typeof result.catch === "function") {
      result.catch((error) => {
        console.warn(
          "Native fullscreen is unavailable; using the fullscreen layout instead:",
          error,
        );
        gameShell.classList.add("is-fullscreen");
        resizeCanvas();
      });
    }
  } catch (error) {
    console.warn(
      "Native fullscreen is unavailable; using the fullscreen layout instead:",
      error,
    );
    gameShell.classList.add("is-fullscreen");
    resizeCanvas();
  }
}

function handlePointerDown(event) {
  event.preventDefault();
  const point = pointerToCanvas(event);
  game.pointerPositions.set(event.pointerId, point);
  unlockAudio();

  if (isPortrait()) return;
  if (game.state === "loading") return;

  if (game.state === "start" && rectContains(point.x, point.y, BUTTONS.start)) {
    if (isMobileDevice()) toggleFullscreen();
    startNewGame();
    return;
  }

  if (
    (game.state === "gameOverTime" || game.state === "gameOverDead") &&
    rectContains(point.x, point.y, BUTTONS.playAgain)
  ) {
    startNewGame();
    return;
  }

  const joy = BUTTONS.joystick;
  const dist = Math.hypot(point.x - joy.x, point.y - joy.y);
  if (dist <= joy.radius + 10) {
    game.joystickPointerId = event.pointerId;
  }

  if (game.state === "playing" || game.state === "paused") {
    if (rectContains(point.x, point.y, BUTTONS.restart)) {
      playSound(ASSET_PATHS.btnClick);
      startNewGame();
      return;
    }

    if (rectContains(point.x, point.y, BUTTONS.pause)) {
      if (game.state === "paused") setState("playing");
      else setState("paused");
      playSound(ASSET_PATHS.btnClick);
      return;
    }

    if (rectContains(point.x, point.y, BUTTONS.mute)) {
      toggleMute();
      playSound(ASSET_PATHS.btnClick);
      return;
    }

    if (rectContains(point.x, point.y, BUTTONS.fullscreen)) {
      if (gameShell.classList.contains("is-fullscreen")) {
        gameShell.classList.remove("is-fullscreen");
        resizeCanvas();
      } else {
        toggleFullscreen();
      }
      playSound(ASSET_PATHS.btnClick);
      return;
    }

    if (game.state === "playing") {
      const actions = [
        ["jump", BUTTONS.jump],
        ["punch", BUTTONS.punch],
        ["kick", BUTTONS.kick],
        ["shoot", BUTTONS.shoot],
      ];
      for (const [action, rect] of actions) {
        if (rectContains(point.x, point.y, rect)) {
          game.actionPointerIds.set(event.pointerId, action);
          triggerPlayerAction(action);
          return;
        }
      }
    }
  }
}

function handlePointerMove(event) {
  if (!game.pointerPositions.has(event.pointerId)) return;
  const point = pointerToCanvas(event);
  game.pointerPositions.set(event.pointerId, point);
  if (event.pointerId !== game.joystickPointerId) return;

  const { x, y, radius } = BUTTONS.joystick;
  const dx = clamp(point.x - x, -radius, radius);
  const dy = clamp(point.y - y, -radius, radius);
  const len = Math.hypot(dx, dy);
  const scale = len > radius ? radius / len : 1;
  input.joystickX = (dx * scale) / radius;
  input.joystickY = (dy * scale) / radius;
}

function handlePointerUp(event) {
  game.pointerPositions.delete(event.pointerId);
  game.actionPointerIds.delete(event.pointerId);
  if (event.pointerId === game.joystickPointerId) {
    input.joystickX = 0;
    input.joystickY = 0;
    game.joystickPointerId = null;
  }
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (
    [
      "arrowleft",
      "arrowright",
      "arrowup",
      "arrowdown",
      " ",
      "1",
      "2",
      "3",
      "4",
      "a",
      "d",
      "w",
      "s",
    ].includes(key) ||
    event.key.startsWith("Arrow")
  ) {
    event.preventDefault();
  }

  if (event.key === "ArrowLeft" || key === "a") input.left = true;
  if (event.key === "ArrowRight" || key === "d") input.right = true;
  if (event.key === "ArrowUp" || key === "w") input.up = true;
  if (event.key === "ArrowDown" || key === "s") input.down = true;
  const actionByKey = { 1: "jump", 2: "punch", 3: "kick", 4: "shoot" };
  const action = actionByKey[key];
  if (action && !input.actionKeys.has(action)) {
    input.actionKeys.add(action);
    triggerPlayerAction(action);
  }
  if (key === "m") toggleMute();
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  const actionByKey = { 1: "jump", 2: "punch", 3: "kick", 4: "shoot" };
  const action = actionByKey[key];
  if (action) input.actionKeys.delete(action);
  if (event.key === "ArrowLeft" || key === "a") input.left = false;
  if (event.key === "ArrowRight" || key === "d") input.right = false;
  if (event.key === "ArrowUp" || key === "w") input.up = false;
  if (event.key === "ArrowDown" || key === "s") input.down = false;
}

function resizeCanvas() {
  const ratio = Math.min(
    window.innerWidth / GAME_WIDTH,
    window.innerHeight / GAME_HEIGHT,
  );
  const width = Math.round(GAME_WIDTH * ratio);
  const height = Math.round(GAME_HEIGHT * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function animationLoop(time) {
  if (!game.lastFrame) game.lastFrame = time;
  const dt = Math.min((time - game.lastFrame) / 1000, 0.05);
  game.lastFrame = time;

  if (game.state === "start") {
    game.startPulse += dt;
  }

  update(dt);
  render();
  updateWeatherSound();
  requestAnimationFrame(animationLoop);
}

function boot() {
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  resizeCanvas();
  resetGameState();
  preloadAssets();
  requestAnimationFrame(animationLoop);

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  document.addEventListener("fullscreenchange", resizeCanvas);
  document.addEventListener("webkitfullscreenchange", resizeCanvas);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  canvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  canvas.addEventListener("pointerup", handlePointerUp, { passive: false });
  canvas.addEventListener("pointercancel", handlePointerUp, { passive: false });
  canvas.addEventListener("click", unlockAudio);
  canvas.style.touchAction = "none";
  document.body.addEventListener(
    "touchmove",
    (event) => event.preventDefault(),
    { passive: false },
  );
  document.addEventListener("gesturestart", (event) => event.preventDefault(), {
    passive: false,
  });
  document.addEventListener(
    "gesturechange",
    (event) => event.preventDefault(),
    { passive: false },
  );
  document.addEventListener("gestureend", (event) => event.preventDefault(), {
    passive: false,
  });
}

boot();
