(() => {
  const canvas = document.getElementById("game-canvas");
  const context = canvas.getContext("2d");
  const stage = document.getElementById("game");
  const startScreen = document.getElementById("start-screen");
  const pauseScreen = document.getElementById("pause-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const leaderboardScreen = document.getElementById("leaderboard-screen");
  const gameHud = document.getElementById("game-hud");
  const touchControl = document.getElementById("touch-control");
  const swingButton = document.getElementById("swing-button");
  const distanceValue = document.getElementById("distance-value");
  const starValue = document.getElementById("star-value");
  const toast = document.getElementById("game-toast");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const gravity = 0.55;
  const heroRadius = 15;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let lastFrame = 0;
  let state = "ready";
  let worldSeed = 1;
  let random = Math.random;
  let buildings = [];
  let anchors = [];
  let stars = [];
  let enemies = [];
  let player;
  let cameraX = 0;
  let distance = 0;
  let timeRemaining = 60;
  let collectedStars = 0;
  let attachedAnchor = null;
  let ropeLength = 0;
  let swingHeld = false;
  let toastTimer;
  let poopTimer = null;
  let poopStopTimer = null;
  let soundEnabled = true;
  let audioContext = null;
  let lastHudDistance = -1;
  let lastHudStars = -1;
  let lastHudTime = -1;
  let timeOfDay = "day";
  const poopLayer = document.getElementById("poop-layer");
  const board = window.SkylineLeaderboard;
  let pendingRun = null;
  let overRun = 0;
  let submitting = false;
  let boardRequest = 0;
  let boardReturn = startScreen;

  function seededRandom() {
    worldSeed = (worldSeed * 1664525 + 1013904223) >>> 0;
    return worldSeed / 4294967296;
  }

  function addBuilding(x, buildingWidth, top) {
    const building = { x, width: buildingWidth, top };
    buildings.push(building);
    anchors.push({
      x: x + buildingWidth * (0.63 + random() * 0.17),
      y: Math.max(34, top - 65 - random() * 55),
    });
    addPortraitSwingPoints(building);
    for (let index = 0; index < 5; index += 1) {
      stars.push({
        x: x + buildingWidth * (0.08 + random() * 0.84),
        y: height * (0.12 + random() * 0.76),
        collected: false,
        phase: random() * Math.PI * 2,
      });
    }
    const enemyX = Math.max(
      x + buildingWidth * (0.12 + random() * 0.76),
      player.x + heroRadius + 90,
    );
    enemies.push({
      x: enemyX,
      y: height * (0.14 + random() * 0.72),
      phase: random() * Math.PI * 2,
    });
  }

  function isMobilePortrait() {
    return height > width && isTouchDevice();
  }

  function addPortraitSwingPoints(building) {
    if (!isMobilePortrait() || building.hasPortraitSwingPoints) return;

    for (const position of [0.25]) {
      anchors.push({
        x: building.x + building.width * position,
        y: Math.max(34, building.top - 65 - random() * 55),
      });
    }
    building.hasPortraitSwingPoints = true;
  }

  function extendWorld() {
    if (buildings.length === 0) {
      addBuilding(-150, 480, height * 0.57);
    }
    while (
      buildings[buildings.length - 1].x +
        buildings[buildings.length - 1].width <
      player.x + width * 3
    ) {
      const previous = buildings[buildings.length - 1];
      const gap = 100 + random() * 85;
      const buildingWidth = 205 + random() * 150;
      const top = height * (0.42 + random() * 0.13);
      addBuilding(previous.x + previous.width + gap, buildingWidth, top);
    }
  }

  function resetRun() {
    clearPoopStorm();
    timeOfDay = Math.random() < 0.5 ? "day" : "night";
    worldSeed = 24681357 + Math.floor(Math.random() * 1000000);
    random = seededRandom;
    buildings = [];
    anchors = [];
    stars = [];
    enemies = [];
    attachedAnchor = null;
    ropeLength = 0;
    swingHeld = false;
    cameraX = 0;
    distance = 0;
    timeRemaining = 60;
    collectedStars = 0;
    player = {
      x: 48,
      y: height * 0.57 - heroRadius,
      vx: 4.8,
      vy: 0,
      grounded: true,
      rotation: 0,
    };
    extendWorld();
    state = "playing";
    startScreen.hidden = true;
    pauseScreen.hidden = true;
    gameoverScreen.hidden = true;
    leaderboardScreen.hidden = true;
    gameHud.hidden = false;
    touchControl.hidden = !isTouchDevice();
    swingButton.classList.remove("is-held");
    lastHudDistance = -1;
    lastHudStars = -1;
    lastHudTime = -1;
    updateHud();
    playTone(560, 0.1);
  }

  function isTouchDevice() {
    return window.matchMedia("(pointer: coarse)").matches || width <= 700;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1500);
  }

  function updateHud() {
    const shownDistance = Math.floor(distance / 10);
    if (shownDistance !== lastHudDistance) {
      distanceValue.textContent = shownDistance;
      lastHudDistance = shownDistance;
    }
    if (collectedStars !== lastHudStars) {
      starValue.textContent = collectedStars;
      lastHudStars = collectedStars;
    }
    const shownTime = Math.ceil(timeRemaining);
    if (shownTime !== lastHudTime) {
      document.getElementById("time-value").textContent = shownTime;
      lastHudTime = shownTime;
    }
  }

  function playTone(frequency, duration = 0.12) {
    if (!soundEnabled) return;
    if (!audioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        showToast("Sound is not available in this browser.");
        soundEnabled = false;
        return;
      }
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.12,
      audioContext.currentTime + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      audioContext.currentTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  }

  function resizeCanvas() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const oldHeight = height;
    width = rect.width;
    height = rect.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (oldHeight && player && state !== "ready") {
      const scale = height / oldHeight;
      player.y *= scale;
      player.vy *= scale;
      buildings.forEach((building) => {
        building.top *= scale;
      });
      anchors.forEach((anchor) => {
        anchor.y *= scale;
      });
      stars.forEach((star) => {
        star.y *= scale;
      });
      if (attachedAnchor) ropeLength *= scale;
    } else if (state === "ready") {
      const boardOpen = !leaderboardScreen.hidden;
      resetRun();
      state = "ready";
      startScreen.hidden = boardOpen;
      leaderboardScreen.hidden = !boardOpen;
      gameHud.hidden = true;
      touchControl.hidden = true;
    }
    if (isMobilePortrait()) buildings.forEach(addPortraitSwingPoints);
  }

  function attachWeb() {
    if (state !== "playing" || attachedAnchor) return;
    const nextAnchor = anchors
      .filter((anchor) => anchor.x > player.x + 18)
      .map((anchor) => ({
        anchor,
        distance: Math.hypot(anchor.x - player.x, anchor.y - player.y),
      }))
      .filter((candidate) => candidate.distance < Math.min(550, width * 0.9))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nextAnchor) {
      showToast("Your flying!!!");
      return;
    }

    attachedAnchor = nextAnchor.anchor;
    ropeLength = Math.max(82, nextAnchor.distance);
    if (player.grounded) player.vy = -3.4;
    player.grounded = false;
    player.vx += 0.45;
    playTone(410, 0.09);
  }

  function releaseWeb() {
    if (!swingHeld && !attachedAnchor) return;
    swingHeld = false;
    attachedAnchor = null;
    swingButton.classList.remove("is-held");
  }

  function beginSwing() {
    if (state !== "playing") return;
    swingHeld = true;
    swingButton.classList.add("is-held");
    if (!attachedAnchor) attachWeb();
  }

  function endSwing() {
    if (attachedAnchor) {
      playTone(300, 0.07);
      player.vy = Math.min(player.vy, -13);
    }
    releaseWeb();
  }

  function setPaused(paused) {
    if (paused && state === "playing") {
      state = "paused";
      swingHeld = false;
      swingButton.classList.remove("is-held");
      attachedAnchor = null;
      pauseScreen.hidden = false;
      touchControl.hidden = true;
    } else if (!paused && state === "paused") {
      state = "playing";
      pauseScreen.hidden = true;
      touchControl.hidden = !isTouchDevice();
    }
  }

  function finishRun(message = "What a ride!") {
    if (state !== "playing") return;
    state = "over";
    swingHeld = false;
    attachedAnchor = null;
    touchControl.hidden = true;
    document.getElementById("gameover-title").textContent = message;
    document.getElementById("final-distance").textContent = Math.floor(
      distance / 10,
    );
    document.getElementById("final-stars").textContent = collectedStars;
    const finalDistance = Math.floor(distance / 10);
    pendingRun =
      finalDistance > 0
        ? { distance: finalDistance, stars: collectedStars }
        : null;
    overRun += 1;
    document.getElementById("score-form").hidden = !pendingRun;
    document.getElementById("score-name").value = board.loadName();
    setScoreMessage("");
    gameoverScreen.hidden = false;
    startPoopStorm();
    playTone(240, 0.22);
  }

  function setScoreMessage(text, isError = false) {
    const message = document.getElementById("score-message");
    message.textContent = text;
    message.hidden = !text;
    message.classList.toggle("is-error", isError);
  }

  async function submitScore() {
    if (submitting || !pendingRun) return;
    const input = document.getElementById("score-name");
    const name = board.cleanName(input.value);
    if (!name) {
      setScoreMessage("Enter a name first", true);
      input.focus();
      return;
    }

    const run = pendingRun;
    const runId = overRun;
    const button = document.querySelector("#score-form button");
    const label = button.textContent;
    submitting = true;
    button.disabled = true;
    button.textContent = "Sending…";
    setScoreMessage("");
    board.saveName(name);

    let sent = true;
    try {
      await board.submit(name, run.distance, run.stars);
    } catch {
      sent = false;
    }

    submitting = false;
    button.disabled = false;
    button.textContent = label;
    if (runId !== overRun) return;

    if (!sent) {
      setScoreMessage("Score not sent. Check your connection and try again.", true);
      return;
    }
    pendingRun = null;
    document.getElementById("score-form").hidden = true;
    setScoreMessage("Score submitted!");
    if (state === "over" && !gameoverScreen.hidden) {
      openLeaderboard(gameoverScreen, { name, ...run });
    }
  }

  // `own` ({ name, distance, stars }) highlights a score just submitted.
  async function openLeaderboard(returnTo, own = null) {
    boardReturn = returnTo;
    returnTo.hidden = true;
    leaderboardScreen.hidden = false;
    document.getElementById("board-back-button").focus({ preventScroll: true });
    const list = document.getElementById("board-list");
    const status = document.getElementById("board-status");
    const request = ++boardRequest;
    list.replaceChildren();
    status.textContent = "Loading…";

    let rows = null;
    try {
      rows = await board.top();
    } catch {
      rows = null;
    }
    if (request !== boardRequest) return;

    if (!rows) {
      status.textContent =
        "Leaderboard unavailable. Check your connection and try again.";
      return;
    }
    if (!rows.length) {
      status.textContent = "No scores yet. Be the first!";
      return;
    }

    let ownRow = null;
    for (const row of rows) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      const result = document.createElement("b");
      const starCount = document.createElement("small");
      name.textContent = row.name;
      result.textContent = `${row.distance.toLocaleString()} m`;
      starCount.textContent = `★ ${row.stars.toLocaleString()}`;
      item.append(name, result, starCount);
      const isOwn =
        own &&
        row.name === own.name &&
        row.distance === own.distance &&
        row.stars === own.stars;
      if (isOwn && !ownRow) ownRow = item;
      list.append(item);
    }

    if (ownRow) ownRow.classList.add("is-own");
    status.textContent =
      own && !ownRow
        ? `Your ${own.distance.toLocaleString()} m didn't reach the top 10`
        : "";
  }

  function closeLeaderboard() {
    leaderboardScreen.hidden = true;
    boardReturn.hidden = false;
  }

  function spawnPoopParticle() {
    const poop = document.createElement("span");
    poop.className = "poop-particle";
    poop.textContent = "💩";
    poop.style.left = `${Math.random() * 96}%`;
    poop.style.setProperty(
      "--poop-size",
      `${(Math.random() * 1.7 + 1.5).toFixed(2)}rem`,
    );
    poop.style.setProperty(
      "--poop-duration",
      `${(Math.random() * 3 + 4.3).toFixed(2)}s`,
    );
    poop.style.setProperty(
      "--poop-drift",
      `${Math.floor(Math.random() * 181) - 90}px`,
    );

    poopLayer.appendChild(poop);
    poop.addEventListener("animationend", (event) => {
      if (event.animationName === "poopFall") poop.remove();
    });
    setTimeout(() => poop.remove(), 10000);
  }

  function startPoopStorm() {
    clearPoopStorm();
    spawnPoopParticle();
    poopTimer = setInterval(spawnPoopParticle, 260);
    poopStopTimer = setTimeout(() => {
      if (poopTimer !== null) {
        clearInterval(poopTimer);
        poopTimer = null;
      }
      poopStopTimer = null;
    }, 10000);
  }

  function clearPoopStorm() {
    if (poopTimer !== null) {
      clearInterval(poopTimer);
      poopTimer = null;
    }
    if (poopStopTimer !== null) {
      clearTimeout(poopStopTimer);
      poopStopTimer = null;
    }
    poopLayer.replaceChildren();
  }

  function update(delta) {
    if (state !== "playing" || !player) return;
    timeRemaining = Math.max(0, timeRemaining - delta / 1000);
    updateHud();
    if (timeRemaining === 0) {
      finishRun();
      return;
    }
    const step = Math.min(delta / 16.667, 2.3);
    extendWorld();

    if (attachedAnchor && swingHeld) {
      player.vy += gravity * step;
      player.vx *= Math.pow(0.999, step);
      player.vy *= Math.pow(0.999, step);
      player.x += player.vx * step;
      player.y += player.vy * step;

      const dx = player.x - attachedAnchor.x;
      const dy = player.y - attachedAnchor.y;
      const currentLength = Math.hypot(dx, dy) || 1;
      if (currentLength > ropeLength) {
        const nx = dx / currentLength;
        const ny = dy / currentLength;
        player.x = attachedAnchor.x + nx * ropeLength;
        player.y = attachedAnchor.y + ny * ropeLength;
        const radialSpeed = player.vx * nx + player.vy * ny;
        if (radialSpeed > 0) {
          player.vx -= radialSpeed * nx;
          player.vy -= radialSpeed * ny;
        }
      }
    } else {
      player.vy += gravity * step;
      player.vx += (5.2 - player.vx) * 0.018 * step;
      player.vx = Math.max(2.4, Math.min(player.vx, 9.2));
      player.x += player.vx * step;
      player.y += player.vy * step;
    }

    if (attachedAnchor) {
      player.rotation = Math.atan2(player.vy, player.vx) * 0.55;
    } else {
      player.rotation +=
        (Math.max(-0.34, Math.min(0.34, player.vx * 0.015)) - player.rotation) *
        0.05 *
        step;
    }

    if (player.vy >= 0) {
      const roof = buildings.find(
        (building) =>
          player.x + heroRadius > building.x &&
          player.x - heroRadius < building.x + building.width &&
          player.y - heroRadius < building.top &&
          player.y + heroRadius >= building.top,
      );
      if (roof) {
        player.y = roof.top - heroRadius;
        player.vy = 0;
        player.grounded = true;
        if (attachedAnchor) {
          attachedAnchor = null;
          swingHeld = false;
          swingButton.classList.remove("is-held");
        }
      } else {
        player.grounded = false;
      }
    }

    for (const star of stars) {
      if (star.collected) continue;
      if (Math.hypot(player.x - star.x, player.y - star.y) < 40) {
        star.collected = true;
        collectedStars += 1;
        playTone(790 + (collectedStars % 4) * 100, 0.16);
        updateHud();
      }
    }

    for (const enemy of enemies) {
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 29) {
        finishRun("The Green Goblin Got You!");
        return;
      }
    }

    distance = Math.max(distance, player.x - 48);
    cameraX = Math.max(0, player.x - width * 0.29);
    const worldStart = player.x - width * 2;
    buildings = buildings.filter(
      (building) => building.x + building.width > worldStart,
    );
    anchors = anchors.filter((anchor) => anchor.x > worldStart);
    stars = stars.filter((star) => star.x > worldStart);
    enemies = enemies.filter((enemy) => enemy.x > worldStart);
    updateHud();

    if (player.y > height + 115) finishRun("OUCH you hit the floor!");
  }

  function roundedRect(x, y, rectWidth, rectHeight, radius) {
    context.beginPath();
    context.roundRect(x, y, rectWidth, rectHeight, radius);
  }

  function drawCloud(x, y, scale) {
    context.beginPath();
    context.ellipse(
      x,
      y + 9 * scale,
      33 * scale,
      12 * scale,
      0,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      x - 18 * scale,
      y + 3 * scale,
      15 * scale,
      14 * scale,
      0,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      x + 2 * scale,
      y - 4 * scale,
      19 * scale,
      19 * scale,
      0,
      0,
      Math.PI * 2,
    );
    context.ellipse(
      x + 22 * scale,
      y + 3 * scale,
      17 * scale,
      13 * scale,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  function drawBackground(time) {
    const sky = context.createLinearGradient(0, 0, 0, height);
    if (timeOfDay === "night") {
      sky.addColorStop(0, "#101a3c");
      sky.addColorStop(0.62, "#27345f");
      sky.addColorStop(1, "#526080");
    } else {
      sky.addColorStop(0, "#72c5f2");
      sky.addColorStop(0.6, "#a7e2ee");
      sky.addColorStop(1, "#f8d9c4");
    }
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    const drift = (time * 0.009) % (width + 130);
    if (timeOfDay === "night") {
      const moonX = width * 0.76 - ((cameraX * 0.035) % width);
      context.fillStyle = "rgba(229, 239, 255, .86)";
      context.beginPath();
      context.arc((moonX + width) % width, height * 0.23, 31, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(186, 205, 240, .58)";
      context.beginPath();
      context.arc((moonX + width) % width - 10, height * 0.22, 5, 0, Math.PI * 2);
      context.arc((moonX + width) % width + 11, height * 0.25, 4, 0, Math.PI * 2);
      context.fill();
      for (let index = 0; index < 28; index += 1) {
        const starX = ((index * 137.5 - cameraX * 0.025) % width + width) % width;
        const starY = height * (0.05 + ((index * 47) % 42) / 100);
        const starSize = index % 5 === 0 ? 2 : 1.2;
        context.fillStyle = `rgba(255, 255, 255, ${0.45 + (index % 4) * 0.12})`;
        context.fillRect(starX, starY, starSize, starSize);
      }
    } else {
      const sunX = width * 0.76 - ((cameraX * 0.035) % width);
      context.fillStyle = "rgba(255, 236, 151, .72)";
      context.beginPath();
      context.arc((sunX + width) % width, height * 0.23, 43, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "rgba(255, 255, 255, .66)";
      drawCloud(width - drift + 35, height * 0.22, 0.85);
      drawCloud(
        ((width * 0.42 + drift * 0.48) % (width + 90)) - 35,
        height * 0.34,
        0.62,
      );
      drawCloud(
        ((width * 0.78 + drift * 0.32) % (width + 120)) - 40,
        height * 0.14,
        0.54,
      );
    }

    drawDistantCity();
  }

  function drawDistantCity() {
    const parallax = cameraX * 0.2;
    const blockWidth = 76;
    const firstIndex = Math.floor(parallax / blockWidth) - 1;
    for (
      let index = firstIndex;
      Math.round(index * blockWidth - parallax) < width + blockWidth;
      index += 1
    ) {
      const x = Math.round(index * blockWidth - parallax);
      const buildingHeight = 64 + Math.abs((index * 47) % 125);
      const top = height * 0.69 - buildingHeight;
      context.fillStyle =
        timeOfDay === "night"
          ? index % 2
            ? "rgba(24, 34, 68, .78)"
            : "rgba(31, 43, 79, .76)"
          : index % 2
            ? "rgba(91, 123, 177, .25)"
            : "rgba(85, 117, 170, .2)";
      context.fillRect(x, top, blockWidth - 5, height - top);
      context.fillStyle =
        timeOfDay === "night"
          ? "rgba(255, 224, 145, .72)"
          : "rgba(255, 239, 189, .42)";
      for (let wx = x + 12; wx < x + blockWidth - 12; wx += 20) {
        for (let wy = top + 16; wy < height - 8; wy += 25) {
          context.fillRect(wx, wy, 7, 9);
        }
      }
    }
  }

  function drawBuildings(time) {
    for (const building of buildings) {
      const x = building.x - cameraX;
      if (x > width + 20 || x + building.width < -30) continue;
      const buildingHeight = height - building.top + 200;
      const palette =
        timeOfDay === "night"
          ? ["#111a38", "#172044", "#141d3d", "#1c254b"]
          : ["#263467", "#303872", "#29335f", "#354078"];
      const shade = Math.abs(Math.floor(building.x / 17)) % palette.length;
      const gradient = context.createLinearGradient(x, building.top, x, height);
      gradient.addColorStop(0, palette[shade]);
      gradient.addColorStop(1, timeOfDay === "night" ? "#0b132b" : "#182448");
      context.fillStyle = gradient;
      context.fillRect(x, building.top, building.width, buildingHeight);

      context.fillStyle =
        timeOfDay === "night"
          ? "rgba(191, 209, 255, .16)"
          : "rgba(255, 255, 255, .12)";
      context.fillRect(x, building.top, building.width, 5);
      context.fillStyle =
        timeOfDay === "night"
          ? "rgba(133, 194, 255, .8)"
          : "rgba(133, 217, 255, .58)";
      for (
        let windowOffset = 15;
        windowOffset < building.width - 12;
        windowOffset += 29
      ) {
        const wx = x + windowOffset;
        const worldX = building.x + windowOffset;
        for (let wy = building.top + 24; wy < height; wy += 34) {
          const lit = Math.sin(worldX * 0.17 + wy * 0.08) > -0.25;
          if (lit) {
            context.fillRect(wx, wy, 11, 14);
            context.fillStyle =
              timeOfDay === "night"
                ? "rgba(210, 231, 255, .4)"
                : "rgba(210, 242, 255, .2)";
            context.fillRect(wx + 2, wy + 2, 2, 10);
            context.fillStyle =
              timeOfDay === "night"
                ? "rgba(133, 194, 255, .8)"
                : "rgba(133, 217, 255, .58)";
          }
        }
      }
      context.fillStyle =
        timeOfDay === "night"
          ? "rgba(255, 218, 125, .72)"
          : "rgba(255, 220, 117, .5)";
      context.fillRect(
        x + 11,
        building.top + 7,
        Math.min(building.width - 22, 26),
        3,
      );
    }

    for (const star of stars) {
      if (star.collected) continue;
      const x = star.x - cameraX;
      if (x < -40 || x > width + 40) continue;
      const bob = reducedMotion.matches
        ? 0
        : Math.sin(time * 0.004 + star.phase) * 4;
      const y = star.y + bob;
      context.fillStyle = "rgba(255, 220, 90, .2)";
      context.beginPath();
      context.arc(x, y, 19, 0, Math.PI * 2);
      context.fill();
      drawStar(x, y, 10, "#ffda5b");
    }
  }

  function drawStar(x, y, radius, fill) {
    context.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + (point * Math.PI) / 5;
      const pointRadius = point % 2 === 0 ? radius : radius * 0.45;
      const px = x + Math.cos(angle) * pointRadius;
      const py = y + Math.sin(angle) * pointRadius;
      if (point === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    context.fillStyle = fill;
    context.shadowColor = "rgba(255, 205, 69, .8)";
    context.shadowBlur = 10;
    context.fill();
    context.shadowBlur = 0;
  }

  function drawAnchor(anchor, time) {
    const x = anchor.x - cameraX;
    if (x < -25 || x > width + 25) return;
    const pulse = reducedMotion.matches
      ? 1
      : 1 + Math.sin(time * 0.006 + anchor.x) * 0.12;
    context.fillStyle = "rgba(255, 65, 86, .2)";
    context.beginPath();
    context.arc(x, anchor.y, 17 * pulse, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(x, anchor.y);
    context.strokeStyle = "#a71938";
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    for (const side of [-1, 1]) {
      for (const leg of [-1, 0, 1, 2]) {
        const startY = -7 + leg * 4.5;
        const kneeY = startY + (leg < 1 ? -4 : 4);
        context.moveTo(side * 4, startY);
        context.lineTo(side * 9, kneeY);
        context.lineTo(side * 13, kneeY + (leg < 1 ? -2 : 2));
      }
    }
    context.stroke();
    context.fillStyle = "#f04455";
    context.beginPath();
    context.ellipse(0, 1, 5.4, 7.5, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, -6, 3.7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff4ee";
    context.beginPath();
    context.ellipse(-1.5, -6.5, 1, 1.5, -0.25, 0, Math.PI * 2);
    context.ellipse(1.5, -6.5, 1, 1.5, 0.25, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawGoblin(enemy, time) {
    const x = enemy.x - cameraX;
    if (x < -35 || x > width + 35) return;
    const bob = reducedMotion.matches
      ? 0
      : Math.sin(time * 0.004 + enemy.phase) * 2;
    context.save();
    context.translate(x, enemy.y + bob);
    context.lineCap = "round";
    context.lineJoin = "round";

    context.strokeStyle = "#245b27";
    context.lineWidth = 6;
    context.beginPath();
    context.moveTo(-5, 9);
    context.lineTo(-9, 19);
    context.lineTo(-13, 21);
    context.moveTo(5, 9);
    context.lineTo(9, 19);
    context.lineTo(13, 21);
    context.moveTo(-8, -1);
    context.lineTo(-15, 5);
    context.moveTo(8, -1);
    context.lineTo(15, 5);
    context.stroke();

    context.fillStyle = "#3f9b45";
    context.beginPath();
    context.ellipse(0, 4, 10, 14, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#55bd50";
    context.beginPath();
    context.moveTo(-7, -16);
    context.lineTo(-20, -21);
    context.lineTo(-11, -10);
    context.closePath();
    context.moveTo(7, -16);
    context.lineTo(20, -21);
    context.lineTo(11, -10);
    context.closePath();
    context.fill();
    context.beginPath();
    context.ellipse(0, -13, 11, 10, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fff0a3";
    context.beginPath();
    context.ellipse(-4, -14, 2.7, 3.2, -0.12, 0, Math.PI * 2);
    context.ellipse(4, -14, 2.7, 3.2, 0.12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#252c22";
    context.beginPath();
    context.arc(-4, -14, 1.2, 0, Math.PI * 2);
    context.arc(4, -14, 1.2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#244b25";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-4, -7);
    context.lineTo(4, -7);
    context.stroke();
    context.restore();
  }

  function drawHero() {
    if (!player) return;
    const x = player.x - cameraX;
    const y = player.y;
    context.save();
    context.translate(x, y);
    context.rotate(player.rotation);

    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#17356d";
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(-4, 8);
    context.lineTo(-10, 18);
    context.lineTo(-17, 21);
    context.moveTo(4, 8);
    context.lineTo(10, 18);
    context.lineTo(17, 20);
    context.moveTo(-7, -1);
    context.lineTo(-15, 5);
    context.moveTo(7, -1);
    context.lineTo(15, -8);
    context.stroke();

    context.strokeStyle = "#1767c3";
    context.lineWidth = 4.5;
    context.beginPath();
    context.moveTo(-4, 8);
    context.lineTo(-10, 18);
    context.moveTo(4, 8);
    context.lineTo(10, 18);
    context.moveTo(-7, -1);
    context.lineTo(-15, 5);
    context.moveTo(7, -1);
    context.lineTo(15, -8);
    context.stroke();

    context.fillStyle = "#1767c3";
    roundedRect(-10, -8, 20, 22, 7);
    context.fill();
    context.fillStyle = "#d93446";
    context.beginPath();
    context.moveTo(-8, -5);
    context.lineTo(0, 1);
    context.lineTo(8, -5);
    context.lineTo(6, 6);
    context.lineTo(0, 11);
    context.lineTo(-6, 6);
    context.closePath();
    context.fill();

    context.strokeStyle = "#101522";
    context.lineWidth = 1.5;
    context.beginPath();
    for (const side of [-1, 1]) {
      for (const row of [-1, 0, 1, 2]) {
        const startY = row * 1.8;
        const kneeY = startY + (row < 1 ? -2.5 : 2.5);
        context.moveTo(side * 1.5, startY);
        context.lineTo(side * 3.5, kneeY);
        context.lineTo(side * 5, kneeY + (row < 1 ? -1 : 1));
      }
    }
    context.stroke();
    context.fillStyle = "#101522";
    context.beginPath();
    context.ellipse(0, 1, 2, 4.5, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, -3.5, 1.5, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#d93446";
    context.beginPath();
    context.ellipse(0, -15, 10, 11, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f4fbff";
    context.beginPath();
    context.ellipse(-4, -15, 3.1, 2.1, -0.32, 0, Math.PI * 2);
    context.ellipse(4, -15, 3.1, 2.1, 0.32, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#a8d8ff";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(-4, -15, 3.1, 2.1, -0.32, 0, Math.PI * 2);
    context.ellipse(4, -15, 3.1, 2.1, 0.32, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = "#d93446";
    context.beginPath();
    context.arc(0, -24, 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawWeb() {
    if (!attachedAnchor || !player) return;
    const anchorX = attachedAnchor.x - cameraX;
    const playerX = player.x - cameraX;
    context.save();
    context.strokeStyle = "rgba(255, 255, 255, .94)";
    context.lineWidth = 2.5;
    context.shadowColor = "rgba(91, 106, 223, .65)";
    context.shadowBlur = 6;
    context.beginPath();
    context.moveTo(anchorX, attachedAnchor.y);
    context.lineTo(playerX, player.y - 3);
    context.stroke();
    context.restore();
  }

  function draw(time) {
    if (!width || !height) return;
    drawBackground(time);
    drawBuildings(time);
    for (const enemy of enemies) drawGoblin(enemy, time);
    for (const anchor of anchors) drawAnchor(anchor, time);
    drawWeb();
    drawHero();
  }

  function frame(time) {
    const delta = lastFrame ? time - lastFrame : 16.667;
    lastFrame = time;
    update(delta);
    draw(time);
    window.requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (state !== "playing") return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    beginSwing();
  });
  canvas.addEventListener("pointerup", endSwing);
  canvas.addEventListener("pointercancel", endSwing);
  canvas.addEventListener("lostpointercapture", endSwing);

  swingButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    swingButton.setPointerCapture(event.pointerId);
    beginSwing();
  });
  swingButton.addEventListener("pointerup", (event) => {
    event.stopPropagation();
    endSwing();
  });
  swingButton.addEventListener("pointercancel", endSwing);
  swingButton.addEventListener("lostpointercapture", endSwing);
  swingButton.addEventListener("contextmenu", (event) =>
    event.preventDefault(),
  );

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && state === "playing") {
      event.preventDefault();
      if (!event.repeat) beginSwing();
    } else if (event.code === "Escape" && state === "playing") {
      setPaused(true);
    } else if (event.code === "Escape" && !leaderboardScreen.hidden) {
      closeLeaderboard();
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") endSwing();
  });

  document.getElementById("start-button").addEventListener("click", resetRun);
  document
    .getElementById("start-board-button")
    .addEventListener("click", () => openLeaderboard(startScreen));
  document
    .getElementById("over-board-button")
    .addEventListener("click", () => openLeaderboard(gameoverScreen));
  document
    .getElementById("board-back-button")
    .addEventListener("click", closeLeaderboard);
  document.getElementById("score-name").maxLength = board.NAME_MAX;
  document.getElementById("score-form").addEventListener("submit", (event) => {
    event.preventDefault();
    submitScore();
  });
  document
    .getElementById("play-again-button")
    .addEventListener("click", resetRun);
  document
    .getElementById("pause-button")
    .addEventListener("click", () => setPaused(true));
  document
    .getElementById("resume-button")
    .addEventListener("click", () => setPaused(false));

  document.getElementById("sound-button").addEventListener("click", (event) => {
    soundEnabled = !soundEnabled;
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", String(soundEnabled));
    button.setAttribute("aria-label", soundEnabled ? "Sound on" : "Sound off");
    button.title = soundEnabled ? "Sound on" : "Sound off";
    if (soundEnabled) playTone(660, 0.1);
  });

  document
    .getElementById("fullscreen-button")
    .addEventListener("click", (event) => {
      const button = event.currentTarget;
      if (document.fullscreenElement) {
        document
          .exitFullscreen()
          .catch(() => showToast("Could not exit full screen."));
      } else if (stage.requestFullscreen) {
        stage
          .requestFullscreen()
          .catch(() => showToast("Full screen is not available."));
      } else {
        showToast("Full screen is not available in this browser.");
      }
      document.addEventListener(
        "fullscreenchange",
        () => {
          const isFullscreen = document.fullscreenElement === stage;
          button.setAttribute(
            "aria-label",
            isFullscreen ? "Exit full screen" : "Enter full screen",
          );
          button.title = isFullscreen
            ? "Exit full screen"
            : "Enter full screen";
        },
        { once: true },
      );
    });

  new ResizeObserver(resizeCanvas).observe(stage);
  resizeCanvas();
  window.requestAnimationFrame(frame);
})();
