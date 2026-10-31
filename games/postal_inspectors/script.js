const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const WORLD_WIDTH = 2560;
const PLAYER_GROUND_Y = 570;
const PLAYER_MIN_Y = 300;
const PLAYER_MAX_Y = 640;
const ENEMY_DEATH_FRAME_DURATION = 0.12;
const HIT_EFFECT_FRAME_DURATION = 0.07;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
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
  pause: { x: 1030, y: 18, w: 56, h: 56 },
  mute: { x: 1100, y: 18, w: 56, h: 56 },
  fullscreen: { x: 1170, y: 18, w: 56, h: 56 },
  joystick: { x: 130, y: 600, radius: 85 },
  jump: { x: 1079, y: 520, w: 162, h: 162 },
  punch: { x: 979, y: 420, w: 132, h: 132 },
  kick: { x: 1108, y: 380, w: 132, h: 132 },
  shoot: { x: 928, y: 550, w: 132, h: 132 },
};

const game = {
  state: "loading",
  score: 0,
  timer: 180,
  loadingProgress: 0,
  loadingIconPath: null,
  lastFrame: 0,
  cameraX: 0,
  startPulse: 0,
  muted: false,
  enemies: [],
  projectiles: [],
  effects: [],
  player: null,
  spawnTimer: 0,
  overReason: null,
  joystickPointerId: null,
  pointerPositions: new Map(),
  actionPointerIds: new Map(),
  audioUnlocked: false,
  gameOverDelay: 0,
  gameOverTriggered: false,
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

function flattenAssetList() {
  return Object.values(ASSET_PATHS).flatMap((value) =>
    Array.isArray(value) ? value : [value],
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
      img.onload = markDone;
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

  if (nextState === "gameOverTime" || nextState === "gameOverDead") {
    game.gameOverDelay = 2.5;
    game.gameOverTriggered = true;
    if (music) music.pause();
  }
}

function playSound(path) {
  const sound = assets.sounds[path];
  if (!sound || game.muted) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
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
  const music = assets.sounds[ASSET_PATHS.music];
  if (music && (game.state === "start" || game.state === "playing")) {
    music.muted = game.muted;
    music.play().catch(() => {});
  }
}

function resetGameState() {
  game.score = 0;
  game.timer = 180;
  game.cameraX = 0;
  game.enemies = [];
  game.projectiles = [];
  game.effects = [];
  game.spawnTimer = 0;
  game.overReason = null;
  game.gameOverDelay = 0;
  game.gameOverTriggered = false;
  game.player = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    width: 66,
    height: 110,
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
    dead: false,
  };
}

function startNewGame() {
  resetGameState();
  spawnEnemy(true);
  game.spawnTimer = 9;
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
  const idx = clamp(Math.floor(player.animFrame), 0, frames.length - 1);
  return assets.images[frames[idx]] || assets.images[ASSET_PATHS.playerStatic];
}

function getEnemyFrame(enemy) {
  let frames = ASSET_PATHS.enemyWalk;
  if (enemy.animation === "hit") frames = ASSET_PATHS.enemyHit;
  else if (enemy.animation === "punch") frames = ASSET_PATHS.enemyPunch;
  else if (enemy.animation === "kick") frames = ASSET_PATHS.enemyKick;
  else if (enemy.animation === "dead") frames = ASSET_PATHS.enemyDeath;
  const idx = clamp(Math.floor(enemy.animFrame), 0, frames.length - 1);
  return assets.images[frames[idx]] || assets.images[ASSET_PATHS.enemyStatic];
}

function spawnEnemy(nearPlayer = false) {
  if (game.enemies.length >= 5) return;
  const fromLeft = Math.random() < 0.5;
  const enemy = {
    x: fromLeft ? -40 : WORLD_WIDTH + 40,
    y: PLAYER_MIN_Y + Math.random() * (PLAYER_MAX_Y - PLAYER_MIN_Y),
    width: 64,
    height: 110,
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
      enemy.x = playerSide > 0 ? WORLD_WIDTH + 34 : -34;
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
    game.player.attackType = "shoot";
    game.player.attackTimer = 0.22;
    game.player.attackDuration = 0.22;
    game.player.attackHitFired = false;
    game.player.cooldown = 0.5;
    game.player.animation = "punch";
    game.player.animFrame = 0;
    game.player.animTimer = 0;
    playSound(ASSET_PATHS.playerShootSfx);
    game.projectiles.push({
      x: game.player.x + (game.player.facing > 0 ? 34 : -5),
      y: game.player.y + 28,
      w: 25,
      h: 18,
      vx: game.player.facing * 640,
      ttl: 1.5,
      rotation: 0,
    });
  }
}

function damagePlayer(amount) {
  if (game.player.dead) return;
  game.player.health = clamp(game.player.health - amount, 0, 100);
  game.player.hurtFlash = 0.25;
  game.player.attackType = null;
  game.player.jumpTime = 0;
  game.player.jumpHeight = 0;
  game.player.animation = "hit";
  game.player.animFrame = 0;
  game.player.animTimer = 0;
  playSound(ASSET_PATHS.fxHitSfx);
  if (game.player.health <= 0) {
    game.player.dead = true;
    game.overReason = "dead";
    playSound(ASSET_PATHS.playerDeathSfx);
    setState("gameOverDead");
  }
}

function spawnHitEffect(x, y) {
  game.effects.push({ x, y, frame: 0, frameTimer: 0 });
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
  if (dist < 92 && Math.abs(enemy.y - game.player.y) < 90) {
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
  const dist = Math.abs(enemy.x - game.player.x);
  const laneDistance = Math.abs(enemy.y - game.player.y);
  if (enemy.attackType === "punch" && dist < 76 && laneDistance < 70) {
    damagePlayer(4);
  } else if (enemy.attackType === "kick" && dist < 95 && laneDistance < 80) {
    damagePlayer(6);
  }
  enemy.attackType = null;
}

function applyPlayerHit() {
  if (!game.player.attackType || game.player.attackHitFired) return;
  const attack = game.player.attackType;
  game.player.attackHitFired = true;
  const range = attack === "punch" ? 70 : attack === "kick" ? 90 : 220;
  let hitMade = false;

  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    const dx = Math.abs(enemy.x - game.player.x);
    const dy = Math.abs(enemy.y - game.player.y);
    if (dx < range && dy < 90) {
      const damage = attack === "punch" ? 4 : attack === "kick" ? 6 : 0;
      enemy.health -= damage;
      enemy.hurtFlash = 0.2;
      spawnHitEffect(enemy.x, enemy.y + enemy.height / 2);
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
  } else if (attack === "shoot") {
    game.player.attackType = null;
  }
}

function updatePlayer(dt) {
  const player = game.player;
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  player.speechTimer = Math.max(0, player.speechTimer - dt);
  if (player.speechTimer === 0) player.speechIndex = null;

  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joystickX;
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.joystickY;
  const len = Math.hypot(dx, dy);

  if (len > 0.2) {
    const nx = dx / Math.max(len, 1);
    const ny = dy / Math.max(len, 1);
    player.x += nx * player.speed * dt;
    player.y += ny * player.speed * dt;
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
      player.animation = "static";
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
    if (player.animTimer > 0.08) {
      player.animTimer = 0;
      player.animFrame = (player.animFrame + 1) % ASSET_PATHS.playerJump.length;
    }
  } else {
    player.animFrame = 0;
  }
}

function updateEnemies(dt) {
  for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = game.enemies[i];
    if (enemy.dead) {
      enemy.deathTimer -= dt;
      enemy.animTimer += dt;
      while (
        enemy.animTimer >= ENEMY_DEATH_FRAME_DURATION &&
        enemy.animFrame < ASSET_PATHS.enemyDeath.length - 1
      ) {
        enemy.animTimer -= ENEMY_DEATH_FRAME_DURATION;
        enemy.animFrame += 1;
      }
      if (enemy.deathTimer <= 0) {
        game.enemies.splice(i, 1);
      }
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
      if (distance > 55) {
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
      const hitX = Math.abs(p.x - enemy.x) < 30;
      const hitY = Math.abs(p.y - enemy.y) < 40;
      if (hitX && hitY) {
        enemy.health -= 3.35;
        spawnHitEffect(enemy.x, enemy.y + enemy.height / 2);
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

function update(dt) {
  if (game.state === "gameOverTime" || game.state === "gameOverDead") {
    game.gameOverDelay = Math.max(0, game.gameOverDelay - dt);
    return;
  }

  if (game.state !== "playing") return;

  game.timer = Math.max(0, game.timer - dt);
  if (game.timer <= 0) {
    game.overReason = "time";
    if (!game.gameOverTriggered) {
      setState("gameOverTime");
      playSound(ASSET_PATHS.gameOver);
    }
    return;
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  updateEffects(dt);

  const interval = game.timer > 120 ? 9 : game.timer > 60 ? 7 : 5;
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0 && game.enemies.length < 5) {
    spawnEnemy();
    game.spawnTimer = interval;
  }

  game.cameraX = clamp(
    game.player.x - GAME_WIDTH / 2,
    0,
    WORLD_WIDTH - GAME_WIDTH,
  );
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

function drawWorld() {
  for (const enemy of game.enemies) {
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

  for (const effect of game.effects) {
    const framePath = ASSET_PATHS.fxHit[effect.frame];
    const img = assets.images[framePath];
    if (img) {
      const width = img.width;
      const height = img.height;
      ctx.drawImage(
        img,
        effect.x - game.cameraX - width / 2,
        effect.y - height / 2,
        width,
        height,
      );
    }
  }

  for (const projectile of game.projectiles) {
    const img = assets.images[ASSET_PATHS.projectile];
    if (img) {
      const screenX = projectile.x - game.cameraX;
      ctx.save();
      ctx.translate(
        screenX + projectile.w / 2,
        projectile.y + projectile.h / 2,
      );
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
  }

  const playerImg = getPlayerFrame();
  const px = game.player.x - game.cameraX;
  const py = game.player.y - game.player.jumpHeight;
  ctx.save();
  ctx.translate(px + game.player.width / 2, py + game.player.height / 2);
  ctx.scale(game.player.facing, 1);
  ctx.translate(-game.player.width / 2, -game.player.height / 2);
  if (game.player.hurtFlash > 0) ctx.globalAlpha = 0.6;
  ctx.drawImage(playerImg, 0, 0, game.player.width, game.player.height);
  ctx.restore();

  if (game.player.speechIndex !== null && game.player.speechTimer > 0) {
    const speechPath = ASSET_PATHS.playerSpeech[game.player.speechIndex];
    const speechImg = assets.images[speechPath];
    if (speechImg) {
      ctx.drawImage(
        speechImg,
        px + (game.player.width - speechImg.width) / 2 + 32,
        py - speechImg.height + 20,
      );
    }
  }
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
    const pressed =
      input.actionKeys.has(name) ||
      Array.from(game.actionPointerIds.values()).includes(name);
    const scale = pressed ? 0.9 : 1;
    const drawWidth = rect.w * scale;
    const drawHeight = rect.h * scale;
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;
    ctx.drawImage(
      img,
      centerX - drawWidth / 2,
      centerY - drawHeight / 2,
      drawWidth,
      drawHeight,
    );
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

function drawGameplay() {
  drawBackgroundLayer();
  drawWorld();
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

function render() {
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  if (isPortrait()) {
    const img = assets.images[ASSET_PATHS.rotatePhone];
    if (img) {
      ctx.drawImage(img, GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2 - 150, 300, 300);
    }
    portraitOverlay.style.display = "flex";
    return;
  }

  portraitOverlay.style.display = "none";

  if (game.state === "loading") drawLoadingScreen();
  else if (game.state === "start") drawStartScreen();
  else if (game.state === "playing" || game.state === "paused") drawGameplay();
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
  const dt = Math.min((time - game.lastFrame) / 1000, 0.033);
  game.lastFrame = time;

  if (game.state === "start") {
    game.startPulse += dt;
  }

  update(dt);
  render();
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
