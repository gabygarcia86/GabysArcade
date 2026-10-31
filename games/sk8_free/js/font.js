/*
 * A tiny 5x7 bitmap font, so text on the low-resolution canvas stays crisp.
 * Each glyph is seven rows, and each row is a 5-bit number.
 */
const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  "!": [4, 4, 4, 4, 4, 0, 4], "?": [14, 17, 1, 2, 4, 0, 4],
  ".": [0, 0, 0, 0, 0, 12, 12], ",": [0, 0, 0, 0, 12, 4, 8],
  "'": [4, 4, 8, 0, 0, 0, 0], "+": [0, 4, 4, 31, 4, 4, 0],
  "-": [0, 0, 0, 31, 0, 0, 0], ":": [0, 12, 12, 0, 12, 12, 0],
  "/": [1, 1, 2, 4, 8, 16, 16], " ": [0, 0, 0, 0, 0, 0, 0],
};

const ADVANCE = 6;

export const textWidth = (text, scale = 1) => (text.length * ADVANCE - 1) * scale;

export function drawText(ctx, text, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let penX = Math.round(x);
  const top = Math.round(y);
  for (let i = 0; i < text.length; i++) {
    const glyph = GLYPHS[text[i]] ?? GLYPHS["?"];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      if (!bits) continue;
      for (let col = 0; col < 5; col++) {
        if (bits & (16 >> col)) ctx.fillRect(penX + col * scale, top + row * scale, scale, scale);
      }
    }
    penX += ADVANCE * scale;
  }
}

export function drawCenteredText(ctx, text, x, y, color, scale = 1) {
  drawText(ctx, text, x - textWidth(text, scale) / 2, y, color, scale);
}

// Splits text into lines of at most maxChars, breaking between words.
export function wrapText(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + word.length + 1 > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
