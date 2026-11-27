// The wind: one slow breeze over the whole archipelago, so every sortie is
// flown in moving air. It is a steady north-westerly with a slow swell and a
// local eddy over each island, so the same place at the same time always has
// the same wind, a screenshot scene is repeatable, and a landing is never
// flown in dead calm: the pilot crabs into it on final, or drifts off the
// strip. Pure maths, no state to save.

const BASE_FROM = 335;
const BASE_SPEED = 6.5;

/** Wind at a place and time: speed in m/s, the direction it blows from, and its x/z push. */
export function windAt(x, z, time) {
  const swell = Math.sin(time * 0.05 + x * 0.001 + z * 0.0013) * 1.6;
  const eddy = Math.sin(x * 0.004 - z * 0.003 + time * 0.11) * 0.9;
  const speed = Math.max(2, BASE_SPEED + swell + eddy);
  const from = BASE_FROM + Math.sin(time * 0.03 + z * 0.0009) * 14;
  const to = (from + 180) * (Math.PI / 180);
  return {
    speed,
    from,
    x: Math.sin(to) * speed,
    z: -Math.cos(to) * speed,
    label: compassPoint(from),
  };
}

function compassPoint(degrees) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}

/** A fixed wind for a staged screenshot scene: the same breeze every time. */
export function stillWind() {
  return windAt(0, -350, 210);
}
