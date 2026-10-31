// Checks all ten mazes in js/LevelData.js. Run from anywhere:
//   node games/droid_chomp/tools/check-mazes.mjs
// A maze that passes has no dead ends, no open rooms, every gear reachable and fair starts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const sandbox = { window: {}, console };
vm.createContext(sandbox);
for (const file of ["utils.js", "LevelData.js", "Maze.js"]) {
  vm.runInContext(readFileSync(path.join(here, "../js", file), "utf8"), sandbox);
}
const D = sandbox.window.DROID;
const errors = [];

const fail = (index, message) => errors.push(`Level ${index + 1} ${D.LEVELS[index].name}: ${message}`);

D.LEVELS.forEach((level, index) => {
  const badShape = level.half.length !== 23 || level.half.some((row) => row.length !== 11);
  if (badShape) {
    fail(index, "every maze needs 23 rows of 11 columns");
    return;
  }

  const maze = new D.Maze(level);
  const { cols, rows } = maze;
  const [px, py] = level.player;
  if (!maze.isFloor(px, py)) fail(index, `player start ${px},${py} isn't floor`);

  // Top and bottom are always solid. Tunnels only happen at the sides.
  for (let x = 0; x < cols; x++) {
    if (!maze.isWall(x, 0) || !maze.isWall(x, rows - 1)) fail(index, `gap in the top or bottom wall at column ${x}`);
  }

  const field = maze.fillField(new Int16Array(cols * rows), { x: px, y: py }, false);
  let powers = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = maze.index(x, y);
      if (maze.items[i] === D.Maze.POWER) powers++;
      if (!maze.isFloor(x, y)) continue;
      if (field[i] < 0) fail(index, `tile ${x},${y} can't be reached`);
      let exits = 0;
      for (let dir = 0; dir < 4; dir++) if (maze.isFloor(x + D.DX[dir], y + D.DY[dir])) exits++;
      if (exits < 2) fail(index, `dead end at ${x},${y}`);
      if (x + 1 < cols && y + 1 < rows && maze.isFloor(x + 1, y) && maze.isFloor(x, y + 1) && maze.isFloor(x + 1, y + 1)) {
        fail(index, `open room at ${x},${y}`);
      }
    }
  }
  if (powers !== 4) fail(index, `has ${powers} power-ups, expected 4`);

  // Every enemy must be able to leave the house, and none may start on top of the droid.
  const exit = maze.fieldTo(maze.exitTile);
  if (!maze.isFloor(maze.exitTile.x, maze.exitTile.y)) fail(index, "no floor above the house door");
  level.starts.forEach(([x, y], enemy) => {
    const name = D.ENEMY_IDS[enemy];
    if (maze.isWall(x, y)) fail(index, `${name} starts in a wall at ${x},${y}`);
    if (exit[maze.index(x, y)] < 0) fail(index, `${name} can't reach the door from ${x},${y}`);
    if (maze.isFloor(x, y) && field[maze.index(x, y)] < 7) {
      fail(index, `${name} starts only ${field[maze.index(x, y)]} tiles from the player`);
    }
  });

  // Each level has to be a genuinely different board, not a recolor.
  const starts = JSON.stringify(level.starts);
  D.LEVELS.slice(0, index).forEach((other, j) => {
    const earlier = new D.Maze(other);
    let different = 0;
    for (let i = 0; i < earlier.cells.length; i++) {
      if ((earlier.cells[i] === 0) !== (maze.cells[i] === 0)) different++;
    }
    if (different < 60) fail(index, `only ${different} wall tiles differ from Level ${j + 1}`);
    if (JSON.stringify(other.starts) === starts) fail(index, `same enemy starts as Level ${j + 1}`);
  });

  const tunnels = [];
  for (let y = 0; y < rows; y++) if (maze.isFloor(0, y)) tunnels.push(y);
  console.log(`${String(index + 1).padStart(2)} ${level.name.padEnd(11)} ${maze.gears} gears, door row ${maze.door.y}, tunnels ${tunnels.join(", ") || "none"}`);
});

for (const error of errors) console.log(`ERROR  ${error}`);
console.log(`${errors.length} error(s)`);
process.exit(errors.length ? 1 : 0);
