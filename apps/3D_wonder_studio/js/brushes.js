// The sculpting brushes. Each one looks at the vertices under a dab and proposes a move for
// them. Moves are collected by SculptMesh.accAdd so mirrored dabs that overlap blend smoothly
// instead of doubling up along the symmetry plane.

const CURVE_SIZE = 256;

function curve(fn) {
  const table = new Float32Array(CURVE_SIZE + 1);
  for (let i = 0; i <= CURVE_SIZE; i++) table[i] = fn(i / CURVE_SIZE);
  return table;
}

export const FALLOFFS = {
  soft: { label: "Soft", table: curve((t) => (1 - t * t) ** 3) },
  smooth: { label: "Smooth", table: curve((t) => 0.5 + 0.5 * Math.cos(Math.PI * t)) },
  sharp: { label: "Sharp", table: curve((t) => (1 - t) ** 2.4) },
  flat: { label: "Flat", table: curve((t) => (t < 0.7 ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (t - 0.7) / 0.3))) },
};

const average = [0, 0, 0];

/** Weighted surface direction and center under a dab, so bumpy areas push one clean way. */
function measureArea(mesh, count, table, dab) {
  const { pos, nor, qList, qDist } = mesh;
  let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0, total = 0;
  for (let i = 0; i < count; i++) {
    const v = qList[i];
    const w = table[qDist[i] * CURVE_SIZE | 0];
    const vx = nor[v * 3], vy = nor[v * 3 + 1], vz = nor[v * 3 + 2];
    if (vx * dab.nx + vy * dab.ny + vz * dab.nz < 0.05) continue;
    nx += vx * w;
    ny += vy * w;
    nz += vz * w;
    cx += pos[v * 3] * w;
    cy += pos[v * 3 + 1] * w;
    cz += pos[v * 3 + 2] * w;
    total += w;
  }
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (!total || !len) {
    dab.ax = dab.nx; dab.ay = dab.ny; dab.az = dab.nz;
    dab.px = dab.x; dab.py = dab.y; dab.pz = dab.z;
    return;
  }
  dab.ax = nx / len;
  dab.ay = ny / len;
  dab.az = nz / len;
  dab.px = cx / total;
  dab.py = cy / total;
  dab.pz = cz / total;
}

/** Fades vertices that face away from the brush, so thin parts aren't sculpted from behind. */
function facing(mesh, v, dab) {
  if (!dab.frontOnly) return 1;
  const { nor } = mesh;
  const d = nor[v * 3] * dab.nx + nor[v * 3 + 1] * dab.ny + nor[v * 3 + 2] * dab.nz;
  if (d >= 0.15) return 1;
  if (d <= -0.15) return 0;
  return (d + 0.15) / 0.3;
}

/** Runs `move(v, weight, x, y, z)` for each vertex under the dab that the brush may touch. */
function eachVertex(mesh, count, table, dab, move) {
  const { pos, qList, qDist } = mesh;
  for (let i = 0; i < count; i++) {
    const v = qList[i];
    const w = table[qDist[i] * CURVE_SIZE | 0] * facing(mesh, v, dab);
    if (w > 0.0005) move(v, w, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
  }
}

/** Blends a vertex toward its neighbours. Keeps pushed clay from turning spiky. */
function settle(mesh, v, x, y, z, amount, offset) {
  if (mesh.neighbourAverage(v, average)) {
    offset[0] = (average[0] - x) * amount;
    offset[1] = (average[1] - y) * amount;
    offset[2] = (average[2] - z) * amount;
  } else {
    offset[0] = offset[1] = offset[2] = 0;
  }
}

const offset = [0, 0, 0];

function push(mesh, count, table, dab, sign) {
  measureArea(mesh, count, table, dab);
  const amount = sign * dab.r * dab.s * 0.1;
  const rest = 0.18 * dab.s;
  eachVertex(mesh, count, table, dab, (v, w, x, y, z) => {
    settle(mesh, v, x, y, z, rest * w, offset);
    mesh.accAdd(v, dab.ax * amount * w + offset[0], dab.ay * amount * w + offset[1], dab.az * amount * w + offset[2], w);
  });
}

function planeMove(mesh, count, table, dab, rule) {
  measureArea(mesh, count, table, dab);
  eachVertex(mesh, count, table, dab, (v, w, x, y, z) => {
    const d = (x - dab.px) * dab.ax + (y - dab.py) * dab.ay + (z - dab.pz) * dab.az;
    const k = rule(d, w);
    if (k) mesh.accAdd(v, dab.ax * k, dab.ay * k, dab.az * k, w);
  });
}

export const BRUSHES = {
  draw: {
    label: "Add Clay", detail: true,
    apply: (mesh, count, table, dab) => push(mesh, count, table, dab, dab.invert ? -1 : 1),
  },
  remove: {
    label: "Remove Clay", detail: true,
    apply: (mesh, count, table, dab) => push(mesh, count, table, dab, dab.invert ? 1 : -1),
  },
  smooth: {
    label: "Smooth", detail: false,
    apply(mesh, count, table, dab) {
      const amount = Math.min(0.95, dab.s * 1.5);
      eachVertex(mesh, count, table, { ...dab, frontOnly: false }, (v, w, x, y, z) => {
        settle(mesh, v, x, y, z, amount * w, offset);
        mesh.accAdd(v, offset[0], offset[1], offset[2], w);
      });
    },
  },
  inflate: {
    label: "Inflate", detail: true,
    apply(mesh, count, table, dab) {
      const { nor } = mesh;
      const amount = (dab.invert ? -1 : 1) * dab.r * dab.s * 0.09;
      const rest = 0.12 * dab.s;
      eachVertex(mesh, count, table, dab, (v, w, x, y, z) => {
        settle(mesh, v, x, y, z, rest * w, offset);
        const k = amount * w;
        mesh.accAdd(v, nor[v * 3] * k + offset[0], nor[v * 3 + 1] * k + offset[1], nor[v * 3 + 2] * k + offset[2], w);
      });
    },
  },
  pinch: {
    label: "Pinch", detail: true,
    apply(mesh, count, table, dab) {
      const amount = (dab.invert ? -1 : 1) * dab.s * 0.28;
      eachVertex(mesh, count, table, dab, (v, w, x, y, z) => {
        let dx = dab.x - x, dy = dab.y - y, dz = dab.z - z;
        const along = dx * dab.nx + dy * dab.ny + dz * dab.nz;
        dx -= dab.nx * along;
        dy -= dab.ny * along;
        dz -= dab.nz * along;
        const k = amount * w;
        mesh.accAdd(v, dx * k, dy * k, dz * k, w);
      });
    },
  },
  flatten: {
    label: "Flatten", detail: false,
    apply: (mesh, count, table, dab) => planeMove(mesh, count, table, dab, (d, w) => -d * w * Math.min(1, dab.s)),
  },
  grab: { label: "Grab", detail: false, drags: true },
  crease: {
    label: "Crease", detail: true,
    apply(mesh, count, table, dab) {
      measureArea(mesh, count, table, dab);
      const depth = (dab.invert ? 1 : -1) * dab.r * dab.s * 0.085;
      const pull = dab.s * 0.3;
      eachVertex(mesh, count, table, dab, (v, w, x, y, z) => {
        // Pulling toward the stroke line, not the dab center, keeps a groove sharp along it.
        let dx = dab.x - x, dy = dab.y - y, dz = dab.z - z;
        const along = dx * dab.tx + dy * dab.ty + dz * dab.tz;
        dx -= dab.tx * along;
        dy -= dab.ty * along;
        dz -= dab.tz * along;
        const k = pull * w;
        const sink = depth * w * w;
        mesh.accAdd(v, dab.ax * sink + dx * k, dab.ay * sink + dy * k, dab.az * sink + dz * k, w);
      });
    },
  },
  strips: {
    label: "Clay Strips", detail: true, square: true,
    apply(mesh, count, table, dab) {
      measureArea(mesh, count, table, dab);
      // The side axis of the strip, so each dab lays a flat rectangle across the stroke.
      const sx = dab.ay * dab.tz - dab.az * dab.ty;
      const sy = dab.az * dab.tx - dab.ax * dab.tz;
      const sz = dab.ax * dab.ty - dab.ay * dab.tx;
      const rise = dab.r * (0.1 + dab.s * 0.14) * (dab.invert ? -1 : 1);
      const px = dab.px + dab.ax * rise, py = dab.py + dab.ay * rise, pz = dab.pz + dab.az * rise;
      const { pos, qList, qDist } = mesh;
      const side = dab.r * 0.74;
      for (let i = 0; i < count; i++) {
        const v = qList[i];
        const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
        const wide = Math.abs((x - dab.x) * sx + (y - dab.y) * sy + (z - dab.z) * sz) / side;
        const long = Math.abs((x - dab.x) * dab.tx + (y - dab.y) * dab.ty + (z - dab.z) * dab.tz) / side;
        const box = Math.max(wide, long);
        if (box >= 1) continue;
        const w = table[box * CURVE_SIZE | 0] * facing(mesh, v, dab) * (1 - qDist[i] ** 8);
        if (w <= 0.0005) continue;
        const d = (x - px) * dab.ax + (y - py) * dab.ay + (z - pz) * dab.az;
        const below = dab.invert ? d > 0 : d < 0;
        if (!below) continue;
        const k = -d * w * Math.min(1, 0.25 + dab.s);
        mesh.accAdd(v, dab.ax * k, dab.ay * k, dab.az * k, w);
      }
    },
  },
  scrape: {
    label: "Scrape", detail: false,
    apply(mesh, count, table, dab) {
      const peel = dab.r * dab.s * 0.02;
      const dir = dab.invert ? -1 : 1;
      planeMove(mesh, count, table, dab, (d, w) => {
        const above = d * dir + peel;
        return above > 0 ? -dir * above * w * Math.min(1, 0.25 + dab.s) : 0;
      });
    },
  },
};

/** Remembers the vertices a Grab stroke holds, one set for each mirrored copy. */
export function captureGrab(mesh, x, y, z, r, table, dab) {
  const count = mesh.queryVerts(x, y, z, r);
  const list = new Int32Array(count);
  const weight = new Float32Array(count);
  const start = new Float32Array(count * 3);
  const { pos, qList, qDist } = mesh;
  for (let i = 0; i < count; i++) {
    const v = qList[i];
    list[i] = v;
    weight[i] = table[qDist[i] * CURVE_SIZE | 0] * facing(mesh, v, dab);
    start[i * 3] = pos[v * 3];
    start[i * 3 + 1] = pos[v * 3 + 1];
    start[i * 3 + 2] = pos[v * 3 + 2];
  }
  return { list, weight, start };
}

/** Moves a grabbed set so each vertex sits at its start plus the drag, scaled by its weight. */
export function applyGrab(mesh, held, dx, dy, dz) {
  const { pos } = mesh;
  const { list, weight, start } = held;
  for (let i = 0; i < list.length; i++) {
    const w = weight[i];
    if (w <= 0.0005) continue;
    const v = list[i];
    mesh.accAdd(
      v,
      start[i * 3] + dx * w - pos[v * 3],
      start[i * 3 + 1] + dy * w - pos[v * 3 + 1],
      start[i * 3 + 2] + dz * w - pos[v * 3 + 2],
      w,
    );
  }
}
