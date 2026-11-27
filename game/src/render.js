// Drawing only: the 3D world projected onto the 2D canvas, the aeroplane
// sprite, and the cockpit frame. The game state in, pixels out; nothing here
// changes the simulation. Terrain is a projected heightfield mesh, so the
// islands, the sea and the runway are genuinely flown over, not painted flat.
import { CAMERA, FIELD, PALETTE, RUNWAY } from './config.js';
import { cloudField, islandLabels, terrainHeight } from './world.js';

const FOCAL = CAMERA.focal;
const DEG = Math.PI / 180;

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function css(rgb) {
  return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
}

function mix(a, b, t) {
  const ca = typeof a === 'string' ? hexToRgb(a) : a;
  const cb = typeof b === 'string' ? hexToRgb(b) : b;
  return [
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ];
}

function scaleRgb(rgb, factor) {
  return [
    Math.max(0, Math.min(255, rgb[0] * factor)),
    Math.max(0, Math.min(255, rgb[1] * factor)),
    Math.max(0, Math.min(255, rgb[2] * factor)),
  ];
}

function hash2(x, z) {
  const s = Math.sin(x * 0.37 + z * 0.53) * 43758.5453;
  return s - Math.floor(s);
}

// Islands far beyond the flown mesh, drawn as hazy silhouettes on the
// horizon so the sea never ends in a hard straight line: the archipelago
// keeps going past the edge of the map.
const FAR_ISLANDS = [
  { x: -1900, z: -2900, peak: 210, width: 1200 },
  { x: 2400, z: -2500, peak: 150, width: 850 },
  { x: -2700, z: 1400, peak: 130, width: 950 },
  { x: 3000, z: 1700, peak: 110, width: 800 },
];

function groundColour(height, x, z, distance, slope) {
  let base;
  if (height <= 0.5) base = PALETTE.seaDeep;
  else if (height <= 2.5) base = PALETTE.seaShallow;
  else if (height <= 5) base = PALETTE.sand;
  else if (height <= 70) base = hash2(Math.floor(x / 40), Math.floor(z / 40)) > 0.5 ? PALETTE.grass : PALETTE.grassDark;
  else base = PALETTE.rock;
  // One quad, one tone: a hash of the quad's ground position varies the
  // colour a little, so a hillside reads as ground and not as flat paint,
  // and a slope catches less light than flat ground does.
  const jitter = 0.9 + hash2(Math.floor(x / 40), Math.floor(z / 40)) * 0.2;
  const slopeShade = Math.max(0.76, 1 - slope * 0.012);
  let colour = scaleRgb(hexToRgb(base), jitter * slopeShade);
  // Sun glints on the sea: a few quads catch the light and sparkle.
  if (height <= 2.5 && hash2(Math.floor(x / 26), Math.floor(z / 26)) > 0.88) {
    colour = mix(colour, '#bfe6f2', 0.45);
  }
  const fog = Math.min(0.72, distance / 1400);
  return css(mix(colour, PALETTE.skyLow, fog));
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const clouds = cloudField();
  const labels = islandLabels();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  function project(camera, point) {
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const dz = point.z - camera.z;
    const cz = dx * camera.fx + dy * camera.fy + dz * camera.fz;
    if (cz < 2) return null;
    const cx = dx * camera.rx + dy * camera.ry + dz * camera.rz;
    const cy = dx * camera.ux + dy * camera.uy + dz * camera.uz;
    return {
      x: FIELD.width / 2 + (cx / cz) * FOCAL,
      y: FIELD.height / 2 - (cy / cz) * FOCAL,
      depth: cz,
    };
  }

  function cameraFor(plane) {
    const heading = plane.heading * DEG;
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    const dist = CAMERA.chaseDistance;
    const height = CAMERA.chaseHeight;
    return {
      x: plane.x - fx * dist,
      y: plane.y + height,
      z: plane.z - fz * dist,
      fx, fy: 0, fz,
      rx: Math.cos(heading), ry: 0, rz: Math.sin(heading),
      ux: 0, uy: 1, uz: 0,
    };
  }

  function drawSky(plane) {
    const horizonY = FIELD.height / 2 - plane.pitch * 420 + plane.bank * 30;
    const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.45, PALETTE.skyMid);
    sky.addColorStop(0.62, PALETTE.skyLow);
    sky.addColorStop(0.63, PALETTE.seaDeep);
    sky.addColorStop(1, '#083049');
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Sun, fixed in the north-east sky, kept below the top HUD panels.
    const sunX = FIELD.width * 0.78;
    const sunY = Math.max(130, horizonY - 190);
    const glow = context.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 243, 196, 0.45)');
    glow.addColorStop(1, 'rgba(255, 243, 196, 0)');
    context.fillStyle = glow;
    context.fillRect(sunX - 140, sunY - 140, 280, 280);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(sunX, sunY, 26, 0, Math.PI * 2);
    context.fill();
    return horizonY;
  }

  function drawFarIslands(camera) {
    for (const island of FAR_ISLANDS) {
      const left = project(camera, { x: island.x - island.width / 2, y: 0, z: island.z });
      const right = project(camera, { x: island.x + island.width / 2, y: 0, z: island.z });
      const peak = project(camera, { x: island.x, y: island.peak, z: island.z });
      const midLeft = project(camera, { x: island.x - island.width / 4, y: island.peak * 0.45, z: island.z });
      const midRight = project(camera, { x: island.x + island.width / 4, y: island.peak * 0.4, z: island.z });
      if (!left || !right || !peak || !midLeft || !midRight) continue;
      context.fillStyle = 'rgba(93, 138, 168, 0.55)';
      context.beginPath();
      context.moveTo(left.x, left.y);
      context.lineTo(midLeft.x, midLeft.y);
      context.lineTo(peak.x, peak.y);
      context.lineTo(midRight.x, midRight.y);
      context.lineTo(right.x, right.y);
      context.closePath();
      context.fill();
    }
  }

  function drawTerrain(camera, plane) {
    const heading = plane.heading * DEG;
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    const rx = Math.cos(heading);
    const rz = Math.sin(heading);
    // A finer mesh than the eye needs up close, stretching far out: small
    // quads near the aeroplane so hills read as hills, long ones at the
    // horizon where the fog has already done the work.
    const rows = [24, 40, 60, 84, 112, 144, 182, 226, 278, 340, 415, 505, 610, 735, 885, 1060, 1270, 1520];
    const cols = [-1, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
    const grid = [];
    for (let r = 0; r < rows.length; r += 1) {
      const row = [];
      const dist = rows[r];
      const spread = dist * 0.95 + 70;
      for (let c = 0; c < cols.length; c += 1) {
        const lat = cols[c] * spread;
        const wx = plane.x + fx * dist + rx * lat;
        const wz = plane.z + fz * dist + rz * lat;
        const wy = terrainHeight(wx, wz);
        row.push({ point: project(camera, { x: wx, y: wy, z: wz }), height: wy, x: wx, z: wz, dist });
      }
      grid.push(row);
    }
    for (let r = rows.length - 2; r >= 0; r -= 1) {
      for (let c = 0; c < cols.length - 1; c += 1) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const d = grid[r + 1][c + 1];
        const e = grid[r + 1][c];
        if (!a.point || !b.point || !d.point || !e.point) continue;
        const avgHeight = (a.height + b.height + d.height + e.height) / 4;
        const slope = Math.max(a.height, b.height, d.height, e.height)
          - Math.min(a.height, b.height, d.height, e.height);
        context.fillStyle = groundColour(avgHeight, a.x, a.z, a.dist, slope);
        context.beginPath();
        context.moveTo(a.point.x, a.point.y);
        context.lineTo(b.point.x, b.point.y);
        context.lineTo(d.point.x, d.point.y);
        context.lineTo(e.point.x, e.point.y);
        context.closePath();
        context.fill();
      }
    }
  }

  function drawRunway(camera, wind) {
    const half = RUNWAY.length / 2;
    const wide = RUNWAY.width / 2;
    const y = RUNWAY.elevation + 0.6;
    const corners = [
      { x: RUNWAY.x - wide, y, z: RUNWAY.z - half },
      { x: RUNWAY.x + wide, y, z: RUNWAY.z - half },
      { x: RUNWAY.x + wide, y, z: RUNWAY.z + half },
      { x: RUNWAY.x - wide, y, z: RUNWAY.z + half },
    ].map((p) => project(camera, p));
    if (corners.some((p) => !p)) return;
    context.fillStyle = PALETTE.runway;
    context.beginPath();
    context.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach((p) => context.lineTo(p.x, p.y));
    context.closePath();
    context.fill();
    context.strokeStyle = PALETTE.runwayLine;
    context.lineWidth = 2;
    context.stroke();
    // Centreline dashes down the strip.
    for (let d = -half + 18; d < half - 10; d += 34) {
      const p1 = project(camera, { x: RUNWAY.x, y: y + 0.2, z: RUNWAY.z + d });
      const p2 = project(camera, { x: RUNWAY.x, y: y + 0.2, z: RUNWAY.z + d + 18 });
      if (!p1 || !p2) continue;
      context.strokeStyle = PALETTE.runwayLine;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.stroke();
    }
    // Threshold bars at the near end.
    const t1 = project(camera, { x: RUNWAY.x - wide + 3, y: y + 0.2, z: RUNWAY.z + half - 8 });
    const t2 = project(camera, { x: RUNWAY.x + wide - 3, y: y + 0.2, z: RUNWAY.z + half - 8 });
    if (t1 && t2) {
      context.strokeStyle = PALETTE.runwayLine;
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(t1.x, t1.y);
      context.lineTo(t2.x, t2.y);
      context.stroke();
    }
    // Windsock beside the strip: the one thing on the airfield that shows
    // the wind the pilot is about to land in, streaming downwind.
    if (wind) {
      const base = { x: RUNWAY.x + 42, y: RUNWAY.elevation, z: RUNWAY.z + 90 };
      const foot = project(camera, base);
      const top = project(camera, { x: base.x, y: base.y + 14, z: base.z });
      const tip = project(camera, { x: base.x + wind.x * 1.6, y: base.y + 13, z: base.z + wind.z * 1.6 });
      if (foot && top && tip) {
        context.strokeStyle = '#e8e8e8';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(foot.x, foot.y);
        context.lineTo(top.x, top.y);
        context.stroke();
        context.strokeStyle = '#ff7f1c';
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(top.x, top.y);
        context.lineTo(tip.x, tip.y);
        context.stroke();
        context.fillStyle = '#ff7f1c';
        context.beginPath();
        context.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawRing(camera, ring, next, passed, time, plane) {
    const points = [];
    // The ring faces the pilot: its plane is vertical, spanning across the
    // line from the ring to the aeroplane, so it reads as a gate to fly through.
    let nx = plane.x - ring.x;
    let nz = plane.z - ring.z;
    const nl = Math.sqrt(nx * nx + nz * nz) || 1;
    nx /= nl;
    nz /= nl;
    const across = { x: -nz, z: nx };
    for (let i = 0; i <= 28; i += 1) {
      const a = (i / 28) * Math.PI * 2;
      const px = ring.x + Math.cos(a) * ring.radius * across.x;
      const py = ring.y + Math.sin(a) * ring.radius;
      const pz = ring.z + Math.cos(a) * ring.radius * across.z;
      const projected = project(camera, { x: px, y: py, z: pz });
      if (projected) points.push(projected);
    }
    if (points.length < 4) return;
    const colour = passed ? PALETTE.ringDone : next ? PALETTE.ringNext : PALETTE.ringFar;
    context.save();
    context.globalAlpha = passed ? 0.35 : next ? 0.95 : 0.6;
    context.strokeStyle = colour;
    context.lineWidth = next ? 7 + Math.sin(time * 5) * 2 : 5;
    context.shadowColor = colour;
    context.shadowBlur = next ? 18 : 6;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => context.lineTo(p.x, p.y));
    context.closePath();
    context.stroke();
    context.restore();
    if (next) {
      const centre = project(camera, ring);
      if (centre) {
        context.fillStyle = PALETTE.ringNext;
        context.font = 'bold 20px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillText(`RING ${ring.index + 1}`, centre.x, centre.y - ring.radius * 0.4 - 14);
      }
    }
  }

  function drawClouds(camera) {
    for (const cloud of clouds) {
      const p = project(camera, cloud);
      if (!p) continue;
      const scale = Math.max(0.12, 420 / p.depth);
      context.fillStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.ellipse(p.x, p.y, cloud.size * scale, cloud.size * scale * 0.38, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.ellipse(p.x - cloud.size * scale * 0.5, p.y + 6, cloud.size * scale * 0.6, cloud.size * scale * 0.28, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.ellipse(p.x + cloud.size * scale * 0.5, p.y + 6, cloud.size * scale * 0.6, cloud.size * scale * 0.28, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLabels(camera) {
    context.font = 'bold 15px system-ui, sans-serif';
    context.textAlign = 'center';
    for (const label of labels) {
      const p = project(camera, label);
      if (!p || p.depth > 2200) continue;
      context.fillStyle = 'rgba(8,18,28,0.55)';
      context.fillText(label.name, p.x + 1, p.y + 1);
      context.fillStyle = '#ffffff';
      context.fillText(label.name, p.x, p.y);
    }
  }

  function drawPlane(plane, time) {
    const cx = FIELD.width / 2;
    const cy = FIELD.height * 0.62;
    context.save();
    context.translate(cx, cy);
    context.rotate(plane.bank * 0.9);
    context.scale(1.15, 1.15);
    // Far wing (darker), then fuselage, then near wing.
    context.fillStyle = '#b01e2e';
    context.beginPath();
    context.moveTo(-14, -6);
    context.lineTo(-150, -34);
    context.lineTo(-158, -18);
    context.lineTo(-14, 6);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeRed;
    context.beginPath();
    context.moveTo(14, -6);
    context.lineTo(150, -34);
    context.lineTo(158, -18);
    context.lineTo(14, 6);
    context.closePath();
    context.fill();
    // Tail fin with the Merak sun emblem.
    context.fillStyle = PALETTE.planeRed;
    context.beginPath();
    context.moveTo(-52, -8);
    context.lineTo(-78, -52);
    context.lineTo(-58, -52);
    context.lineTo(-34, -10);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.arc(-58, -34, 7, 0, Math.PI * 2);
    context.fill();
    // Fuselage: a built body, white with a red cheatline and windows.
    const body = context.createLinearGradient(0, -22, 0, 22);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.55, PALETTE.planeWhite);
    body.addColorStop(1, '#c8d2d8');
    context.fillStyle = body;
    context.beginPath();
    context.moveTo(72, 0);
    context.quadraticCurveTo(40, -20, -10, -18);
    context.quadraticCurveTo(-58, -16, -66, -4);
    context.quadraticCurveTo(-58, 14, -10, 18);
    context.quadraticCurveTo(40, 20, 72, 0);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.planeRed;
    context.fillRect(-56, -2, 118, 5);
    // Cockpit glass and cabin windows.
    context.fillStyle = PALETTE.glass;
    context.beginPath();
    context.moveTo(52, -12);
    context.quadraticCurveTo(30, -18, 12, -15);
    context.lineTo(14, -4);
    context.lineTo(50, -2);
    context.closePath();
    context.fill();
    context.fillStyle = '#22303c';
    for (let i = 0; i < 4; i += 1) {
      context.beginPath();
      context.arc(-2 - i * 13, -6, 3.4, 0, Math.PI * 2);
      context.fill();
    }
    // Spinning propeller: a translucent disc and a bright spinner.
    context.fillStyle = 'rgba(200, 220, 235, 0.35)';
    context.beginPath();
    context.ellipse(74, 0, 7, 46, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.planeDark;
    context.beginPath();
    context.arc(74, 0, 6, 0, Math.PI * 2);
    context.fill();
    // Navigation lights: red left, green right, blinking with time.
    if (Math.floor(time * 2) % 2 === 0) {
      context.fillStyle = '#ff4040';
      context.beginPath();
      context.arc(-150, -26, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#37e08a';
      context.beginPath();
      context.arc(150, -26, 4, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawCockpitFrame() {
    context.fillStyle = '#0b1118';
    // Windshield pillars and roof rail.
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(150, 0);
    context.lineTo(210, FIELD.height - 168);
    context.lineTo(0, FIELD.height - 168);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(FIELD.width, 0);
    context.lineTo(FIELD.width - 150, 0);
    context.lineTo(FIELD.width - 210, FIELD.height - 168);
    context.lineTo(FIELD.width, FIELD.height - 168);
    context.closePath();
    context.fill();
    context.fillRect(0, 0, FIELD.width, 26);
    // Centre pillar.
    context.fillRect(FIELD.width / 2 - 8, 0, 16, FIELD.height - 168);
    // Glare shield above the dashboard.
    context.fillStyle = '#131c26';
    context.fillRect(0, FIELD.height - 190, FIELD.width, 24);
  }

  function drawReticle(plane) {
    const x = FIELD.width / 2 + plane.bank * 90;
    const y = FIELD.height / 2 - plane.pitch * 260;
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x, y, 14, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(x - 22, y);
    context.lineTo(x - 8, y);
    context.moveTo(x + 8, y);
    context.lineTo(x + 22, y);
    context.moveTo(x, y - 22);
    context.lineTo(x, y - 8);
    context.moveTo(x, y + 8);
    context.lineTo(x, y + 22);
    context.stroke();
  }

  /** Paint one frame of the world (no HUD, no panels — hud.js owns those). */
  function drawWorld(game, time) {
    const plane = game.plane;
    const camera = cameraFor(plane);
    drawSky(plane);
    drawFarIslands(camera);
    drawClouds(camera);
    drawTerrain(camera, plane);
    drawRunway(camera, game.wind);
    if (game.mission && game.mission.rings) {
      const next = game.mission.nextRing();
      game.mission.rings.forEach((ring) => {
        drawRing(camera, ring, next === ring, ring.index < (next ? next.index : 8), time, plane);
      });
    }
    drawLabels(camera);
    if (game.view === 'cockpit') drawCockpitFrame();
    else drawPlane(plane, time);
    drawReticle(plane);
  }

  resize();
  window.addEventListener('resize', resize);
  return { drawWorld };
}
