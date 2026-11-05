(() => {
  const canvas = document.getElementById("drawing-canvas");
  const paperWrap = document.querySelector(".paper-wrap");
  const context = canvas.getContext("2d");
  const brushSizeInput = document.getElementById("brush-size");
  const brushSizeValue = document.getElementById("brush-size-value");
  const zoomOutButton = document.getElementById("zoom-out-button");
  const zoomInButton = document.getElementById("zoom-in-button");
  const zoomValue = document.getElementById("zoom-value");
  const undoButton = document.getElementById("undo-button");
  const redoButton = document.getElementById("redo-button");
  const shapeButtons = document.querySelectorAll(".shape-button");
  const shapeStyleButtons = document.querySelectorAll(".shape-style-button");
  const toolButtons = document.querySelectorAll(".tool-button");
  const drawingNotice = document.getElementById("notice");

  const stickerCard = document.querySelector(".sticker-card");
  const stickerTabs = document.getElementById("sticker-tabs");
  const stickerGrid = document.getElementById("sticker-grid");
  const stickerHint = document.getElementById("sticker-hint");
  const stickerModeButtons = document.querySelectorAll("[data-sticker-mode]");
  const stickerSizeInput = document.getElementById("sticker-size");
  const stickerTurnInput = document.getElementById("sticker-turn");
  const stickerFadeInput = document.getElementById("sticker-fade");
  const stickerFlipButton = document.getElementById("sticker-flip");
  const stickerWiggleButton = document.getElementById("sticker-wiggle");
  const stickerMixButton = document.getElementById("sticker-mix");
  const stickerActions = document.getElementById("sticker-actions");
  const stickerPreview = document.getElementById("sticker-preview");

  const STICKER_SETS = [
    {
      name: "Faces",
      icon: "😀",
      stickers: ["😀", "😂", "🥰", "😎", "🤩", "🥳", "😜", "🤪", "😇", "🤠",
        "😴", "😱", "👻", "🤖", "👽", "🙈"],
    },
    {
      name: "Animals",
      icon: "🐶",
      stickers: ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐷",
        "🐸", "🐵", "🐧", "🐔", "🦄", "🐝", "🦋", "🐢", "🐙", "🐬", "🐳",
        "🦖", "🐞", "🦕"],
    },
    {
      name: "Nature",
      icon: "🌸",
      stickers: ["☀️", "🌈", "⭐", "🌙", "☁️", "⚡", "❄️", "🔥", "💧", "🌸",
        "🌻", "🌷", "🌳", "🌴", "🌵", "🍄", "🍀", "🍁", "🌊", "⛰️"],
    },
    {
      name: "Food",
      icon: "🍕",
      stickers: ["🍎", "🍌", "🍓", "🍉", "🍒", "🍇", "🥕", "🍕", "🍔", "🌭",
        "🍟", "🍩", "🍪", "🎂", "🧁", "🍦", "🍭", "🍫", "🥨", "🧃"],
    },
    {
      name: "Fun",
      icon: "🚀",
      stickers: ["🚀", "🚗", "🚂", "✈️", "🚁", "⛵", "🏠", "🏰", "🎈", "🎁",
        "🎨", "⚽", "🏀", "🎸", "🥁", "👑", "💎", "🪄", "🎉", "🧸"],
    },
    {
      name: "Sparkles",
      icon: "✨",
      stickers: ["✨", "🌟", "💫", "❤️", "🧡", "💛", "💚", "💙", "💜", "💖",
        "💕", "🎀", "🫧", "🔮", "🌀", "💥"],
    },
  ];

  const STICKER_HINTS = {
    stamp: "Tap your picture to stamp a sticker!",
    trail: "Drag across your picture to make a sticker trail!",
    move: "Tap a sticker on your picture to pick it up, then drag it!",
    moveSelected: "Drag it around, or change it with the sliders below.",
  };

  const minZoom = 0.5;
  const maxZoom = 2;
  const zoomStep = 0.25;
  const maxHistory = 100;
  let color = "#27324b";
  let brushSize = Number(brushSizeInput.value);
  let zoom = 1;
  let activeTool = "pencil";
  let activeShape = "";
  let shapeStyle = "stroke";
  let drawing = false;
  let panning = false;
  let panX = 0;
  let panY = 0;
  let panStart = null;
  let currentStroke = null;
  let currentShape = null;
  let items = [];
  let history = [];
  let future = [];
  let editBase = null;
  let editChanged = false;
  let noticeTimer;

  let stickerSet = 0;
  let activeSticker = "⭐";
  let stickerMode = "stamp";
  let selectedIndex = -1;
  let stickerDrag = null;
  let trail = null;
  const stickerSettings = {
    size: Number(stickerSizeInput.value),
    rotation: Number(stickerTurnInput.value),
    opacity: Number(stickerFadeInput.value) / 100,
    flip: false,
    wiggle: false,
    mix: false,
  };

  /* ---------- history: every change saves the previous list of items ---------- */
  function updateHistoryButtons() {
    undoButton.disabled = history.length === 0;
    redoButton.disabled = future.length === 0;
  }

  function commit(nextItems) {
    history.push(items);
    if (history.length > maxHistory) history.shift();
    items = nextItems;
    future = [];
    redraw();
    updateHistoryButtons();
  }

  // Starts a change that happens over time (dragging, sliders) and counts as one undo step.
  function beginEdit() {
    if (editBase) return;
    editBase = items;
    editChanged = false;
    items = items.slice();
  }

  function endEdit() {
    if (!editBase) return;
    if (editChanged) {
      history.push(editBase);
      if (history.length > maxHistory) history.shift();
      future = [];
    } else {
      items = editBase;
    }
    editBase = null;
    editChanged = false;
    redraw();
    updateHistoryButtons();
  }

  function patchItem(index, patch) {
    beginEdit();
    items[index] = { ...items[index], ...patch };
    editChanged = true;
  }

  function updateZoom() {
    clampPan();
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomValue.textContent = `${Math.round(zoom * 100)}%`;
    zoomOutButton.disabled = zoom <= minZoom;
    zoomInButton.disabled = zoom >= maxZoom;
  }

  function clampPan() {
    const maxX = Math.max(0, (canvas.clientWidth * zoom - paperWrap.clientWidth) / 2);
    const maxY = Math.max(0, (canvas.clientHeight * zoom - paperWrap.clientHeight) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function fillArea(item) {
    const width = canvas.width;
    const height = canvas.height;
    const seedX = Math.min(width - 1, Math.floor(item.x * width));
    const seedY = Math.min(height - 1, Math.floor(item.y * height));
    const image = context.getImageData(0, 0, width, height);
    const source = new Uint8ClampedArray(image.data);
    const visited = new Uint8Array(width * height);
    const seedIndex = (seedY * width + seedX) * 4;
    const targetRed = source[seedIndex];
    const targetGreen = source[seedIndex + 1];
    const targetBlue = source[seedIndex + 2];
    const fillRed = parseInt(item.color.slice(1, 3), 16);
    const fillGreen = parseInt(item.color.slice(3, 5), 16);
    const fillBlue = parseInt(item.color.slice(5, 7), 16);
    const tolerance = 150;
    const stack = [seedY * width + seedX];

    function matches(x, y) {
      const pixel = y * width + x;
      if (visited[pixel]) return false;
      const index = pixel * 4;
      return (
        Math.abs(source[index] - targetRed) <= tolerance &&
        Math.abs(source[index + 1] - targetGreen) <= tolerance &&
        Math.abs(source[index + 2] - targetBlue) <= tolerance
      );
    }

    while (stack.length > 0) {
      const point = stack.pop();
      const x = point % width;
      const y = Math.floor(point / width);
      if (!matches(x, y)) continue;

      let left = x;
      while (left > 0 && matches(left - 1, y)) left -= 1;

      let scanAbove = false;
      let scanBelow = false;
      for (let scanX = left; scanX < width && matches(scanX, y); scanX += 1) {
        const pixel = y * width + scanX;
        const index = pixel * 4;
        visited[pixel] = 1;
        image.data[index] = fillRed;
        image.data[index + 1] = fillGreen;
        image.data[index + 2] = fillBlue;

        if (y > 0) {
          if (matches(scanX, y - 1)) {
            if (!scanAbove) stack.push((y - 1) * width + scanX);
            scanAbove = true;
          } else {
            scanAbove = false;
          }
        }
        if (y < height - 1) {
          if (matches(scanX, y + 1)) {
            if (!scanBelow) stack.push((y + 1) * width + scanX);
            scanBelow = true;
          } else {
            scanBelow = false;
          }
        }
      }
    }

    context.putImageData(image, 0, 0);
  }

  function drawShape(item) {
    const startX = item.start.x * canvas.width;
    const startY = item.start.y * canvas.height;
    const endX = item.end.x * canvas.width;
    const endY = item.end.y * canvas.height;
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    const pixelRatio = canvas.width / canvas.clientWidth;

    context.save();
    context.lineWidth = item.size * pixelRatio;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = item.color;
    context.fillStyle = item.color;
    context.beginPath();

    if (item.shape === "square") {
      const side = Math.min(width, height);
      context.rect(
        startX <= endX ? left : left + width - side,
        startY <= endY ? top : top + height - side,
        side,
        side,
      );
    } else if (item.shape === "rectangle") {
      context.rect(left, top, width, height);
    } else if (item.shape === "circle") {
      const diameter = Math.min(width, height);
      context.ellipse(
        (startX + endX) / 2,
        (startY + endY) / 2,
        diameter / 2,
        diameter / 2,
        0,
        0,
        Math.PI * 2,
      );
    } else if (item.shape === "line") {
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
    } else {
      const sides = item.shape === "triangle" ? 3
        : item.shape === "star" ? 10
        : item.shape === "hexagon" ? 6
        : 8;
      const centerX = (startX + endX) / 2;
      const centerY = (startY + endY) / 2;
      const radiusX = width / 2;
      const radiusY = height / 2;

      for (let index = 0; index < sides; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
        const radius = item.shape === "star" && index % 2 === 1 ? 0.42 : 1;
        const x = centerX + Math.cos(angle) * radiusX * radius;
        const y = centerY + Math.sin(angle) * radiusY * radius;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
    }

    if (item.shape !== "line" && item.style === "fill") context.fill();
    else context.stroke();
    context.restore();
  }

  function showNotice(message) {
    drawingNotice.textContent = message;
    drawingNotice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      drawingNotice.hidden = true;
    }, 2500);
  }

  function cssScale() {
    return canvas.width / canvas.clientWidth;
  }

  function drawSticker(item) {
    context.save();
    context.globalAlpha = item.opacity ?? 1;
    context.translate(item.x * canvas.width, item.y * canvas.height);
    context.rotate(((item.rotation || 0) * Math.PI) / 180);
    if (item.flip) context.scale(-1, 1);
    context.font = `${item.size * cssScale()}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(item.emoji, 0, 0);
    context.restore();
  }

  function drawSelection(item) {
    const scale = cssScale();
    const half = item.size * 0.62 * scale;
    context.save();
    context.translate(item.x * canvas.width, item.y * canvas.height);
    context.rotate(((item.rotation || 0) * Math.PI) / 180);
    context.lineWidth = 2.5 * scale;
    context.strokeStyle = "#7b5cf0";
    context.setLineDash([7 * scale, 5 * scale]);
    context.beginPath();
    context.roundRect(-half, -half, half * 2, half * 2, 10 * scale);
    context.stroke();
    context.restore();
  }

  function drawItem(item) {
    if (item.type === "shape") {
      drawShape(item);
      return;
    }

    if (item.type === "sticker") {
      drawSticker(item);
      return;
    }

    if (item.type === "fill") {
      fillArea(item);
      return;
    }

    if (item.points.length === 0) return;

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = item.size * cssScale();
    context.strokeStyle = item.tool === "eraser" ? "#ffffff" : item.color;
    context.beginPath();
    context.moveTo(
      item.points[0].x * canvas.width,
      item.points[0].y * canvas.height,
    );

    if (item.points.length === 1) {
      context.lineTo(
        item.points[0].x * canvas.width,
        item.points[0].y * canvas.height,
      );
    } else {
      for (const point of item.points.slice(1)) {
        context.lineTo(point.x * canvas.width, point.y * canvas.height);
      }
    }
    context.stroke();
    context.restore();
  }

  function redraw(showSelection = true) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const item of items) drawItem(item);
    if (currentStroke) drawItem(currentStroke);
    if (currentShape) drawItem(currentShape);
    const selected = items[selectedIndex];
    if (showSelection && selected && selected.type === "sticker") {
      drawSelection(selected);
    }
  }

  function resizeCanvas() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const pixelRatio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    redraw();
    updateZoom();
  }

  function getPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  /* ---------- stickers ---------- */
  function randomBetween(low, high) {
    return low + Math.random() * (high - low);
  }

  function makeSticker(point) {
    const set = STICKER_SETS[stickerSet].stickers;
    const wiggle = stickerSettings.wiggle;
    return {
      type: "sticker",
      emoji: stickerSettings.mix
        ? set[Math.floor(Math.random() * set.length)]
        : activeSticker,
      x: point.x,
      y: point.y,
      size: Math.round(stickerSettings.size * (wiggle ? randomBetween(0.75, 1.25) : 1)),
      rotation: stickerSettings.rotation + (wiggle ? randomBetween(-25, 25) : 0),
      opacity: stickerSettings.opacity,
      flip: stickerSettings.flip,
    };
  }

  // Finds the top-most sticker under a point on the paper.
  function hitSticker(point) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      if (item.type !== "sticker") continue;
      const dx = (point.x - item.x) * width;
      const dy = (point.y - item.y) * height;
      if (Math.hypot(dx, dy) <= Math.max(18, item.size * 0.62)) return index;
    }
    return -1;
  }

  function selectSticker(index) {
    selectedIndex = index;
    const item = items[index];
    if (item && item.type === "sticker") {
      stickerSizeInput.value = item.size;
      stickerTurnInput.value = Math.round(item.rotation || 0);
      stickerFadeInput.value = Math.round((item.opacity ?? 1) * 100);
    } else {
      selectedIndex = -1;
      stickerSizeInput.value = stickerSettings.size;
      stickerTurnInput.value = stickerSettings.rotation;
      stickerFadeInput.value = Math.round(stickerSettings.opacity * 100);
    }
    updateStickerControls();
    redraw();
  }

  function selectedSticker() {
    const item = items[selectedIndex];
    return item && item.type === "sticker" ? item : null;
  }

  function updateSliderLabel(input) {
    const output = document.querySelector(`[data-value-for="${input.id}"]`);
    const unit = input.id === "sticker-turn" ? "°" : input.id === "sticker-fade" ? "%" : "";
    if (output) output.textContent = `${input.value}${unit}`;
    const range = Number(input.max) - Number(input.min);
    input.style.setProperty("--p", `${((input.value - input.min) / range) * 100}%`);
  }

  function updateStickerControls() {
    const selected = selectedSticker();
    const editing = stickerMode === "move";
    const flip = editing && selected ? selected.flip : stickerSettings.flip;

    stickerCard.classList.toggle("is-active", activeTool === "sticker");
    stickerCard.dataset.mode = stickerMode;
    stickerHint.textContent = editing && selected
      ? STICKER_HINTS.moveSelected
      : STICKER_HINTS[stickerMode];

    stickerModeButtons.forEach((button) => {
      const on = activeTool === "sticker" && button.dataset.stickerMode === stickerMode;
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-pressed", String(on));
    });

    stickerGrid.querySelectorAll(".sticker-button").forEach((button) => {
      const on = activeTool === "sticker" && !editing &&
        !stickerSettings.mix && button.dataset.sticker === activeSticker;
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-pressed", String(on));
    });

    stickerFlipButton.setAttribute("aria-pressed", String(Boolean(flip)));
    stickerWiggleButton.setAttribute("aria-pressed", String(stickerSettings.wiggle));
    stickerMixButton.setAttribute("aria-pressed", String(stickerSettings.mix));
    stickerActions.hidden = !(editing && selected);

    // In Move mode with nothing picked up, the sliders have nothing to change.
    const slidersOff = editing && !selected;
    [stickerSizeInput, stickerTurnInput, stickerFadeInput, stickerFlipButton]
      .forEach((control) => { control.disabled = slidersOff; });

    [stickerSizeInput, stickerTurnInput, stickerFadeInput].forEach(updateSliderLabel);

    const shown = editing && selected ? selected : {
      emoji: stickerSettings.mix ? "🎲" : activeSticker,
      size: stickerSettings.size,
      rotation: stickerSettings.rotation,
      opacity: stickerSettings.opacity,
      flip: stickerSettings.flip,
    };
    stickerPreview.textContent = slidersOff ? "👆" : shown.emoji;
    stickerPreview.style.opacity = slidersOff ? 0.5 : shown.opacity ?? 1;
    stickerPreview.style.fontSize = `${Math.min(64, Math.max(18, shown.size * 0.6))}px`;
    stickerPreview.style.transform = slidersOff ? "none"
      : `rotate(${shown.rotation || 0}deg) scaleX(${shown.flip ? -1 : 1})`;
  }

  function renderStickerTabs() {
    stickerTabs.replaceChildren(...STICKER_SETS.map((set, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "sticker-tab";
      tab.textContent = set.icon;
      tab.title = set.name;
      tab.setAttribute("aria-label", `${set.name} stickers`);
      tab.setAttribute("aria-pressed", String(index === stickerSet));
      tab.addEventListener("click", () => {
        stickerSet = index;
        renderStickerTabs();
        renderStickerGrid();
      });
      return tab;
    }));
  }

  function renderStickerGrid() {
    stickerGrid.replaceChildren(...STICKER_SETS[stickerSet].stickers.map((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sticker-button";
      button.dataset.sticker = emoji;
      button.textContent = emoji;
      button.setAttribute("aria-label", `${emoji} sticker`);
      button.addEventListener("click", () => {
        activeSticker = emoji;
        stickerSettings.mix = false;
        if (stickerMode === "move") stickerMode = "stamp";
        setTool("sticker");
      });
      return button;
    }));
    updateStickerControls();
  }

  /* ---------- picking tools ---------- */
  function setTool(tool) {
    if (editBase) endEdit();
    activeTool = tool;
    if (tool !== "shape") activeShape = "";
    // Leaving the sticker tool puts it back to stamping so the sticker grid shows again.
    if (tool !== "sticker") stickerMode = "stamp";
    if (tool !== "sticker" || stickerMode !== "move") selectedIndex = -1;

    canvas.classList.toggle("is-fill-mode", tool === "fill");
    canvas.classList.toggle("is-hand-mode", tool === "hand");
    canvas.classList.toggle("is-sticker-mode", tool === "sticker" && stickerMode !== "move");
    canvas.classList.toggle("is-move-mode", tool === "sticker" && stickerMode === "move");
    canvas.classList.remove("is-panning");

    toolButtons.forEach((button) => {
      const on = button.dataset.tool === tool;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    });
    shapeButtons.forEach((button) => {
      const on = tool === "shape" && button.dataset.shape === activeShape;
      button.classList.toggle("is-selected", on);
      button.setAttribute("aria-pressed", String(on));
    });
    selectSticker(selectedIndex);
  }

  /* ---------- drawing on the paper ---------- */
  function addFill(point) {
    commit([...items, { type: "fill", x: point.x, y: point.y, color }]);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);

    if (activeTool === "hand") {
      panning = true;
      panStart = { x: event.clientX - panX, y: event.clientY - panY };
      canvas.classList.add("is-panning");
      return;
    }

    const point = getPoint(event);

    if (activeTool === "sticker") {
      if (stickerMode === "move") {
        const hit = hitSticker(point);
        selectSticker(hit);
        if (hit >= 0) {
          stickerDrag = {
            offsetX: point.x - items[hit].x,
            offsetY: point.y - items[hit].y,
          };
          canvas.classList.add("is-panning");
        }
        return;
      }
      if (stickerMode === "trail") {
        beginEdit();
        items.push(makeSticker(point));
        editChanged = true;
        trail = { last: point };
        redraw();
        return;
      }
      commit([...items, makeSticker(point)]);
      return;
    }

    if (activeTool === "shape") {
      drawing = true;
      currentShape = {
        type: "shape",
        shape: activeShape,
        style: shapeStyle,
        color,
        size: brushSize,
        start: point,
        end: point,
      };
      redraw();
      return;
    }

    if (activeTool === "fill") {
      addFill(point);
      return;
    }

    drawing = true;
    currentStroke = {
      type: "stroke",
      tool: activeTool,
      color,
      size: brushSize,
      points: [point],
    };
    redraw();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (panning && panStart) {
      panX = event.clientX - panStart.x;
      panY = event.clientY - panStart.y;
      clampPan();
      updateZoom();
      return;
    }
    if (stickerDrag && selectedIndex >= 0) {
      const point = getPoint(event);
      patchItem(selectedIndex, {
        x: Math.max(0, Math.min(1, point.x - stickerDrag.offsetX)),
        y: Math.max(0, Math.min(1, point.y - stickerDrag.offsetY)),
      });
      redraw();
      return;
    }
    if (trail) {
      const point = getPoint(event);
      const distance = Math.hypot(
        (point.x - trail.last.x) * canvas.clientWidth,
        (point.y - trail.last.y) * canvas.clientHeight,
      );
      if (distance >= Math.max(10, stickerSettings.size * 0.75)) {
        items.push(makeSticker(point));
        trail.last = point;
        redraw();
      }
      return;
    }
    if (drawing && currentShape) {
      currentShape.end = getPoint(event);
      redraw();
      return;
    }
    if (!drawing || !currentStroke) return;
    currentStroke.points.push(getPoint(event));
    redraw();
  });

  function finishPointer() {
    if (panning) {
      panning = false;
      panStart = null;
      canvas.classList.remove("is-panning");
    }
    if (stickerDrag) {
      stickerDrag = null;
      canvas.classList.remove("is-panning");
      endEdit();
      return;
    }
    if (trail) {
      trail = null;
      endEdit();
      return;
    }
    if (drawing && currentShape) {
      const shape = currentShape;
      currentShape = null;
      drawing = false;
      commit([...items, shape]);
      return;
    }
    if (!drawing || !currentStroke) return;
    const stroke = currentStroke;
    currentStroke = null;
    drawing = false;
    commit([...items, stroke]);
  }

  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("lostpointercapture", finishPointer);

  zoomOutButton.addEventListener("click", () => {
    zoom = Math.max(minZoom, zoom - zoomStep);
    updateZoom();
  });

  zoomInButton.addEventListener("click", () => {
    zoom = Math.min(maxZoom, zoom + zoomStep);
    updateZoom();
  });

  toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  shapeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeShape = button.dataset.shape;
      if (activeShape === "line") shapeStyle = "stroke";
      shapeStyleButtons.forEach((styleButton) => {
        const selected = styleButton.dataset.shapeStyle === shapeStyle;
        styleButton.classList.toggle("is-selected", selected);
        styleButton.setAttribute("aria-pressed", String(selected));
      });
      setTool("shape");
    });
  });

  shapeStyleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (activeShape === "line" && button.dataset.shapeStyle === "fill") return;
      shapeStyle = button.dataset.shapeStyle;
      shapeStyleButtons.forEach((styleButton) => {
        const selected = styleButton === button;
        styleButton.classList.toggle("is-selected", selected);
        styleButton.setAttribute("aria-pressed", String(selected));
      });
    });
  });

  function setColor(nextColor) {
    color = nextColor;
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      const selected = swatch.dataset.color === color;
      swatch.classList.toggle("is-selected", selected);
      swatch.setAttribute("aria-pressed", String(selected));
    });
  }

  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => setColor(swatch.dataset.color));
  });

  document.getElementById("custom-color").addEventListener("input", (event) => {
    setColor(event.target.value);
    document.querySelectorAll(".color-swatch").forEach((swatch) => {
      swatch.classList.remove("is-selected");
      swatch.setAttribute("aria-pressed", "false");
    });
  });

  brushSizeInput.addEventListener("input", () => {
    brushSize = Number(brushSizeInput.value);
    brushSizeValue.textContent = brushSize;
  });

  /* ---------- sticker controls ---------- */
  stickerModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stickerMode = button.dataset.stickerMode;
      selectedIndex = -1;
      setTool("sticker");
    });
  });

  // Sliders change the picked-up sticker in Move mode, otherwise the next stickers.
  function bindStickerSlider(input, key, toValue) {
    input.addEventListener("input", () => {
      const value = toValue(Number(input.value));
      if (stickerMode === "move" && selectedSticker()) {
        patchItem(selectedIndex, { [key]: value });
        redraw();
      } else {
        stickerSettings[key] = value;
      }
      updateStickerControls();
    });
    input.addEventListener("change", endEdit);
  }

  bindStickerSlider(stickerSizeInput, "size", (value) => value);
  bindStickerSlider(stickerTurnInput, "rotation", (value) => value);
  bindStickerSlider(stickerFadeInput, "opacity", (value) => value / 100);

  stickerFlipButton.addEventListener("click", () => {
    const selected = stickerMode === "move" && selectedSticker();
    if (selected) {
      commit(items.map((item, index) =>
        index === selectedIndex ? { ...item, flip: !item.flip } : item));
    } else {
      stickerSettings.flip = !stickerSettings.flip;
    }
    updateStickerControls();
  });

  stickerWiggleButton.addEventListener("click", () => {
    stickerSettings.wiggle = !stickerSettings.wiggle;
    updateStickerControls();
  });

  stickerMixButton.addEventListener("click", () => {
    stickerSettings.mix = !stickerSettings.mix;
    if (stickerMode === "move") stickerMode = "stamp";
    setTool("sticker");
  });

  function deleteSelectedSticker() {
    if (!selectedSticker()) return;
    const index = selectedIndex;
    selectedIndex = -1;
    commit(items.filter((_, itemIndex) => itemIndex !== index));
    selectSticker(-1);
  }

  document.getElementById("sticker-copy").addEventListener("click", () => {
    const item = selectedSticker();
    if (!item) return;
    const copy = {
      ...item,
      x: Math.min(1, item.x + 0.03),
      y: Math.min(1, item.y + 0.03),
    };
    commit([...items, copy]);
    selectSticker(items.length - 1);
  });

  document.getElementById("sticker-front").addEventListener("click", () => {
    const item = selectedSticker();
    if (!item || selectedIndex === items.length - 1) return;
    const index = selectedIndex;
    commit([...items.filter((_, itemIndex) => itemIndex !== index), item]);
    selectSticker(items.length - 1);
  });

  document.getElementById("sticker-delete").addEventListener("click",
    deleteSelectedSticker);

  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input, textarea")) return;
    if ((event.key === "Delete" || event.key === "Backspace") && selectedSticker()) {
      event.preventDefault();
      deleteSelectedSticker();
    } else if (event.key === "Escape" && selectedSticker()) {
      selectSticker(-1);
    }
  });

  /* ---------- undo, redo, start over and save ---------- */
  undoButton.addEventListener("click", () => {
    endEdit();
    if (history.length === 0) return;
    future.push(items);
    items = history.pop();
    selectSticker(-1);
    updateHistoryButtons();
  });

  redoButton.addEventListener("click", () => {
    endEdit();
    if (future.length === 0) return;
    history.push(items);
    items = future.pop();
    selectSticker(-1);
    updateHistoryButtons();
  });

  document.getElementById("clear-button").addEventListener("click", () => {
    if (items.length === 0) {
      showNotice("Your paper is already empty. Start drawing!");
      return;
    }
    if (
      !window.confirm(
        "Start a fresh picture? You can undo this if you change your mind.",
      )
    ) {
      return;
    }
    selectedIndex = -1;
    commit([]);
    selectSticker(-1);
  });

  document.getElementById("save-button").addEventListener("click", () => {
    // Leave the dotted "picked up" box out of the saved picture.
    redraw(false);
    canvas.toBlob((blob) => {
      if (!blob) {
        showNotice("Sorry, we couldn't save this picture. Please try again.");
        return;
      }
      const imageUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = imageUrl;
      download.download = "my-doodle.png";
      download.click();
      URL.revokeObjectURL(imageUrl);
      showNotice("Your picture is ready to save!");
    }, "image/png");
    redraw();
  });

  renderStickerTabs();
  renderStickerGrid();
  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();
  updateZoom();
  updateHistoryButtons();
})();
