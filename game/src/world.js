// The archipelago: procedural island terrain, the runway, the ring course,
// the clouds and the island labels. Pure maths, no assets: the same world
// every run, so a screenshot scene is repeatable.
import { ISLANDS, RUNWAY } from './config.js';

function hashNoise(x, z) {
  const s = Math.sin(x * 0.021 + z * 0.017) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, z) {
  const xi = Math.floor(x / 90);
  const zi = Math.floor(z / 90);
  const xf = x / 90 - xi;
  const zf = z / 90 - zi;
  const sx = xf * xf * (3 - 2 * xf);
  const sz = zf * zf * (3 - 2 * zf);
  const a = hashNoise(xi, zi);
  const b = hashNoise(xi + 1, zi);
  const c = hashNoise(xi, zi + 1);
  const d = hashNoise(xi + 1, zi + 1);
  return (a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz) * 2 - 1;
}

/** Ground height in metres at world (x, z). Sea level is 0; the runway sits flat. */
export function terrainHeight(x, z) {
  let height = -4;
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < island.radius * 1.6) {
      // Sharper falloff: beyond the beach the sea floor is flat, so the sea
      // reads as sea and a low aeroplane over water is not scraping a hill.
      const fall = Math.exp(-(dist * dist) / (island.radius * island.radius * 0.45));
      if (fall > 0.02) height = Math.max(height, island.peak * fall + smoothNoise(x, z) * 7 * fall);
    }
  }
  // The airfield shelf: a flat apron at the runway's height, running along
  // the runway axis from the sea in the north to the valley in the south.
  // The strip sits on it, takeoffs climb out over it, and a gentle touchdown
  // anywhere on it is a landing (off the strip), not a crash — only the
  // strip itself earns the precision bonus. Beyond its edges the island
  // keeps its own hills, and beyond its north end the sea stays sea.
  if (z > -900 && z < 650) {
    const across = Math.abs(x - RUNWAY.x);
    const blend = Math.min(1, Math.max(0, (across - 60) / 90));
    height = RUNWAY.elevation + (height - RUNWAY.elevation) * blend;
  }
  // The strip itself is dead flat, and only the strip: a circular pad would
  // jut a plateau out over the sea approach, so the flattening follows the
  // rectangle of the runway, with a small margin.
  if (Math.abs(x - RUNWAY.x) <= RUNWAY.width / 2 + 15
    && Math.abs(z - RUNWAY.z) <= RUNWAY.length / 2 + 15) {
    height = RUNWAY.elevation;
  }
  return height;
}

/** True when (x, z) is over the runway strip, within `margin` metres. */
export function overRunway(x, z, margin = 0) {
  const half = RUNWAY.length / 2 + margin;
  const wide = RUNWAY.width / 2 + margin;
  return Math.abs(x - RUNWAY.x) <= wide && Math.abs(z - RUNWAY.z) <= half;
}

/** The eight rings of the Ring Run, strung in a loop around the home island. */
export function ringCourse() {
  const centres = [
    [0, -420], [430, -330], [640, 60], [380, 430],
    [-80, 520], [-520, 330], [-640, -120], [-380, -420],
  ];
  return centres.map(([x, z], index) => ({
    index,
    x,
    z,
    y: 120 + (index % 3) * 45,
    radius: 26,
  }));
}

/** The three islands of the Island Hop, in visiting order. */
export function hopIslands() {
  return [ISLANDS[1], ISLANDS[2], ISLANDS[3]];
}

/** Puffy clouds, fixed positions so the sky reads the same every flight. */
export function cloudField() {
  const clouds = [];
  const spots = [
    [300, 320, -1400, 90], [-500, 300, -1200, 110], [900, 340, -600, 80],
    [-900, 310, -400, 95], [200, 360, 900, 120], [-300, 330, 1200, 85],
    [1100, 300, 400, 100], [-1100, 350, 1000, 90], [0, 380, -1800, 130],
    [700, 320, 1500, 75], [-700, 340, 1600, 105], [1400, 330, -1500, 95],
  ];
  for (const [x, y, z, size] of spots) clouds.push({ x, y, z, size });
  return clouds;
}

/** Island names, for the labels the renderer floats over the terrain. */
export function islandLabels() {
  return ISLANDS.map((island) => ({ name: island.name, x: island.x, z: island.z, y: island.peak + 26 }));
}
