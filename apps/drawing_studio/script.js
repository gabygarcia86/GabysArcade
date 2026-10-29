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
  const drawingNotice = document.getElementById("notice");

  const minZoom = 0.5;
  const maxZoom = 2;
  const zoomStep = 0.25;
  let color = "#27324b";
  let brushSize = Number(brushSizeInput.value);
  let zoom = 1;
  let activeTool = "pencil";
  let activeSticker = "";
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
  let redoItems = [];
  let noticeTimer;

  function updateHistoryButtons() {
    undoButton.disabled = items.length === 0;
    redoButton.disabled = redoItems.length === 0;
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

  function drawItem(item) {
    if (item.type === "shape") {
      drawShape(item);
      return;
    }

    if (item.type === "sticker") {
      context.save();
      const pixelRatio = canvas.width / canvas.clientWidth;
      context.font = `${item.size * pixelRatio}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        item.emoji,
        item.x * canvas.width,
        item.y * canvas.height,
      );
      context.restore();
      return;
    }

    if (item.type === "fill") {
      fillArea(item);
      return;
    }

    if (item.points.length === 0) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = item.size * (canvas.width / width);
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

  function redraw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const item of items) drawItem(item);
    if (currentStroke) drawItem(currentStroke);
    if (currentShape) drawItem(currentShape);
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

  function addSticker(point) {
    items.push({
      type: "sticker",
      emoji: activeSticker,
      x: point.x,
      y: point.y,
      size: Math.max(34, brushSize * 4),
    });
    redoItems = [];
    redraw();
    updateHistoryButtons();
  }

  function addFill(point) {
    items.push({
      type: "fill",
      x: point.x,
      y: point.y,
      color,
    });
    redoItems = [];
    redraw();
    updateHistoryButtons();
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

    if (activeSticker) {
      addSticker(point);
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
    if (drawing && currentShape) {
      currentShape.end = getPoint(event);
      redraw();
      return;
    }
    if (!drawing || !currentStroke) return;
    currentStroke.points.push(getPoint(event));
    redraw();
  });

  function finishStroke() {
    if (drawing && currentShape) {
      items.push(currentShape);
      currentShape = null;
      drawing = false;
      redoItems = [];
      redraw();
      updateHistoryButtons();
      return;
    }
    if (!drawing || !currentStroke) return;
    items.push(currentStroke);
    currentStroke = null;
    drawing = false;
    redoItems = [];
    redraw();
    updateHistoryButtons();
  }

  canvas.addEventListener("pointerup", finishStroke);
  canvas.addEventListener("pointercancel", finishStroke);
  canvas.addEventListener("lostpointercapture", finishStroke);

  function finishPan() {
    panning = false;
    panStart = null;
    canvas.classList.remove("is-panning");
  }

  canvas.addEventListener("pointerup", finishPan);
  canvas.addEventListener("pointercancel", finishPan);
  canvas.addEventListener("lostpointercapture", finishPan);

  zoomOutButton.addEventListener("click", () => {
    zoom = Math.max(minZoom, zoom - zoomStep);
    updateZoom();
  });

  zoomInButton.addEventListener("click", () => {
    zoom = Math.min(maxZoom, zoom + zoomStep);
    updateZoom();
  });

  document.querySelectorAll(".tool-button").forEach((button) => {
    button.addEventListener("click", () => {
      activeTool = button.dataset.tool;
      activeSticker = "";
      activeShape = "";
      canvas.classList.remove("is-sticker-mode");
      canvas.classList.remove("is-hand-mode", "is-panning");
      canvas.classList.toggle("is-fill-mode", activeTool === "fill");
      canvas.classList.toggle("is-hand-mode", activeTool === "hand");
      document.querySelectorAll(".tool-button").forEach((toolButton) => {
        const selected = toolButton === button;
        toolButton.classList.toggle("is-active", selected);
        toolButton.setAttribute("aria-pressed", String(selected));
      });
      document.querySelectorAll(".sticker-button").forEach((stickerButton) => {
        const selected = stickerButton.dataset.sticker === "none";
        stickerButton.classList.toggle("is-selected", selected);
        stickerButton.setAttribute("aria-pressed", String(selected));
      });
      shapeButtons.forEach((shapeButton) => {
        shapeButton.classList.remove("is-selected");
        shapeButton.setAttribute("aria-pressed", "false");
      });
    });
  });

  shapeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeShape = button.dataset.shape;
      activeTool = "shape";
      activeSticker = "";
      if (activeShape === "line") shapeStyle = "stroke";
      canvas.classList.remove("is-sticker-mode", "is-fill-mode", "is-hand-mode", "is-panning");
      shapeButtons.forEach((shapeButton) => {
        const selected = shapeButton === button;
        shapeButton.classList.toggle("is-selected", selected);
        shapeButton.setAttribute("aria-pressed", String(selected));
      });
      shapeStyleButtons.forEach((styleButton) => {
        const selected = styleButton.dataset.shapeStyle === shapeStyle;
        styleButton.classList.toggle("is-selected", selected);
        styleButton.setAttribute("aria-pressed", String(selected));
      });
      document.querySelectorAll(".tool-button").forEach((toolButton) => {
        toolButton.classList.remove("is-active");
        toolButton.setAttribute("aria-pressed", "false");
      });
      document.querySelectorAll(".sticker-button").forEach((stickerButton) => {
        const selected = stickerButton.dataset.sticker === "none";
        stickerButton.classList.toggle("is-selected", selected);
        stickerButton.setAttribute("aria-pressed", String(selected));
      });
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

  document.querySelectorAll(".sticker-button").forEach((button) => {
    button.addEventListener("click", () => {
      activeSticker =
        button.dataset.sticker === "none" ? "" : button.dataset.sticker;
      document.querySelectorAll(".sticker-button").forEach((stickerButton) => {
        const selected = stickerButton === button;
        stickerButton.classList.toggle("is-selected", selected);
        stickerButton.setAttribute("aria-pressed", String(selected));
      });
      if (activeSticker) {
        activeTool = "pencil";
        activeShape = "";
        canvas.classList.remove("is-fill-mode", "is-hand-mode", "is-panning");
        document.querySelectorAll(".tool-button").forEach((toolButton) => {
          const selected = toolButton.dataset.tool === activeTool;
          toolButton.classList.toggle("is-active", selected);
          toolButton.setAttribute("aria-pressed", String(selected));
        });
        shapeButtons.forEach((shapeButton) => {
          shapeButton.classList.remove("is-selected");
          shapeButton.setAttribute("aria-pressed", "false");
        });
      }
      canvas.classList.toggle("is-sticker-mode", Boolean(activeSticker));
    });
  });

  undoButton.addEventListener("click", () => {
    if (items.length === 0) return;
    redoItems.push(items.pop());
    redraw();
    updateHistoryButtons();
  });

  redoButton.addEventListener("click", () => {
    if (redoItems.length === 0) return;
    items.push(redoItems.pop());
    redraw();
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
    redoItems = items.slice().reverse();
    items = [];
    redraw();
    updateHistoryButtons();
  });

  document.getElementById("save-button").addEventListener("click", () => {
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
  });

  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();
  updateZoom();
  updateHistoryButtons();
})();
