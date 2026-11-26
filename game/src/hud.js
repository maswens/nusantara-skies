// The HUD and the screens: every number and bar the pilot flies by, drawn
// as lit instruments rather than flat labels. The same file draws the title,
// pause and end panels, so the renderer only ever paints the 3D world.
import { FIELD, FONT, MISSIONS, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

const PANEL = { width: 640, top: 150, line: 32, bottom: 64 };

function compassLabel(heading) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(heading / 45) % 8];
}

export function createHud(canvas) {
  const context = canvas.getContext('2d');
  const fonts = new Map();

  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function bar(x, y, w, h, fraction, fill, label) {
    context.fillStyle = 'rgba(8, 18, 28, 0.72)';
    roundRect(x, y, w, h, 5);
    context.fill();
    context.fillStyle = fill;
    const inner = Math.max(0, Math.min(1, fraction)) * (w - 4);
    if (inner > 0) {
      roundRect(x + 2, y + 2, inner, h - 4, 4);
      context.fill();
    }
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1;
    roundRect(x, y, w, h, 5);
    context.stroke();
    text(label, x + 8, y + h - 6, 12, PALETTE.text);
  }

  /** One round gauge: a lit face, tick marks, a needle and a digital readout. */
  function gauge(cx, cy, radius, label, value, max, unit, warnBelow) {
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = PALETTE.gaugeFace;
    context.beginPath();
    context.arc(cx, cy, radius - 7, 0, Math.PI * 2);
    context.fill();
    const low = warnBelow !== undefined && value < warnBelow;
    context.fillStyle = low ? PALETTE.warn : '#22303c';
    for (let i = 0; i <= 10; i += 1) {
      const angle = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const inner = radius - 14;
      const outer = radius - 8;
      context.beginPath();
      context.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      context.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      context.lineWidth = i % 5 === 0 ? 2.5 : 1;
      context.strokeStyle = '#22303c';
      context.stroke();
    }
    const angle = Math.PI * 0.75 + (Math.max(0, Math.min(1, value / max))) * Math.PI * 1.5;
    context.beginPath();
    context.moveTo(cx, cy);
    context.lineTo(cx + Math.cos(angle) * (radius - 16), cy + Math.sin(angle) * (radius - 16));
    context.lineWidth = 3;
    context.strokeStyle = low ? PALETTE.warn : PALETTE.planeRed;
    context.stroke();
    context.fillStyle = PALETTE.planeDark;
    context.beginPath();
    context.arc(cx, cy, 4, 0, Math.PI * 2);
    context.fill();
    text(label, cx, cy + radius + 18, 13, PALETTE.text, 'center', 'bold');
    text(`${Math.round(value)} ${unit}`, cx, cy + 5, 15, '#22303c', 'center', 'bold');
  }

  function compassStrip(heading) {
    const cx = FIELD.width / 2;
    const y = 26;
    context.fillStyle = 'rgba(8, 18, 28, 0.72)';
    roundRect(cx - 190, 8, 380, 34, 8);
    context.fill();
    context.save();
    roundRect(cx - 190, 8, 380, 34, 8);
    context.clip();
    for (let d = -60; d <= 60; d += 5) {
      const h = (Math.round(heading) + d + 360) % 360;
      const x = cx + d * 3;
      const major = h % 45 === 0;
      context.strokeStyle = major ? PALETTE.text : PALETTE.muted;
      context.lineWidth = major ? 2 : 1;
      context.beginPath();
      context.moveTo(x, y + 8);
      context.lineTo(x, y + (major ? 16 : 12));
      context.stroke();
      if (major) text(h % 90 === 0 ? compassLabel(h) : String(h), x, y + 30, 11, PALETTE.text, 'center');
    }
    context.restore();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.moveTo(cx, 8);
    context.lineTo(cx - 6, 2);
    context.lineTo(cx + 6, 2);
    context.closePath();
    context.fill();
  }

  function drawHud(state, mission, view) {
    const plane = state.plane;
    // Top-left instrument block: ALT, SPD, HDG in large lit digits.
    context.fillStyle = 'rgba(8, 18, 28, 0.78)';
    roundRect(14, 10, 360, 96, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.stroke();
    text('ALT', 28, 36, 13, PALETTE.muted, 'left', 'bold');
    text(`${Math.round(plane.y)} m`, 28, 66, 30, PALETTE.gaugeLit, 'left', 'bold');
    text('SPD', 148, 36, 13, PALETTE.muted, 'left', 'bold');
    text(`${Math.round(plane.speed * 3.6)} km/h`, 148, 66, 26, PALETTE.gaugeLit, 'left', 'bold');
    text('HDG', 278, 36, 13, PALETTE.muted, 'left', 'bold');
    text(`${String(Math.round(plane.heading)).padStart(3, '0')}°`, 278, 66, 30, PALETTE.gaugeLit, 'left', 'bold');
    text(`V/S ${plane.verticalSpeed >= 0 ? '+' : ''}${plane.verticalSpeed.toFixed(1)} m/s`, 28, 94, 13, PALETTE.muted);
    compassStrip(plane.heading);

    // Top-right: mission, score, timer.
    context.fillStyle = 'rgba(8, 18, 28, 0.78)';
    roundRect(FIELD.width - 314, 10, 300, 96, 10);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.stroke();
    text(mission.name, FIELD.width - 28, 36, 15, PALETTE.gold, 'right', 'bold');
    text(mission.objective(), FIELD.width - 28, 58, 13, PALETTE.text, 'right');
    text(`SCORE ${state.score}   TIME ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`, FIELD.width - 28, 82, 13, PALETTE.muted, 'right');
    text(`BEST ${state.best}`, FIELD.width - 28, 100, 12, PALETTE.muted, 'right');

    // Bottom-left: fuel and throttle bars; bottom-right: damage and view.
    bar(14, FIELD.height - 58, 220, 20, plane.fuel / 100, plane.fuel < 25 ? PALETTE.warn : PALETTE.good, 'FUEL');
    bar(14, FIELD.height - 32, 220, 20, plane.throttle, PALETTE.gold, 'THROTTLE');
    bar(FIELD.width - 234, FIELD.height - 58, 220, 20, 1 - plane.damage / 100, plane.damage > 60 ? PALETTE.warn : PALETTE.good, 'HULL');
    text(view === 'cockpit' ? 'COCKPIT VIEW  [C] chase' : 'CHASE VIEW  [C] cockpit', FIELD.width - 14, FIELD.height - 14, 13, PALETTE.muted, 'right');

    // Warnings, centred and impossible to miss.
    if (plane.onGround && plane.speed < 5 && state.elapsed < 30) {
      text('ON THE STRIP — HOLD W TO SPOOL UP, THEN PULL UP (↑) TO LIFT OFF', FIELD.width / 2, 140, 20, PALETTE.good, 'center', 'bold');
    } else if (plane.stalled && !plane.onGround) {
      text('STALL — NOSE DOWN, ADD POWER', FIELD.width / 2, 140, 26, PALETTE.warn, 'center', 'bold');
    } else if (plane.fuel < 20 && plane.fuel > 0) {
      text('LOW FUEL — FINISH THE SORTIE OR LAND', FIELD.width / 2, 140, 22, PALETTE.warn, 'center', 'bold');
    } else if (plane.fuel === 0) {
      text('FUEL EMPTY — GLIDING', FIELD.width / 2, 140, 22, PALETTE.warn, 'center', 'bold');
    }
    if (state.message) {
      text(state.message, FIELD.width / 2, FIELD.height - 92, 22, PALETTE.good, 'center', 'bold');
    }

    // Cockpit view: a lit dashboard with real gauges under the windshield.
    if (view === 'cockpit') {
      context.fillStyle = PALETTE.panel;
      context.fillRect(0, FIELD.height - 168, FIELD.width, 168);
      context.fillStyle = '#0a0f14';
      context.fillRect(0, FIELD.height - 168, FIELD.width, 6);
      gauge(150, FIELD.height - 84, 62, 'AIRSPEED', plane.speed * 3.6, 360, 'km/h', 90);
      gauge(330, FIELD.height - 84, 62, 'ALTITUDE', plane.y, 600, 'm');
      gauge(510, FIELD.height - 84, 62, 'HEADING', plane.heading, 360, '°');
      gauge(690, FIELD.height - 84, 62, 'FUEL', plane.fuel, 100, '%', 25);
      text('NUSANTARA SKIES — KOKPIT', FIELD.width - 30, FIELD.height - 120, 15, PALETTE.muted, 'right', 'bold');
      text('W/S throttle · ↑/↓ pitch · ←/→ turn · F flaps', FIELD.width - 30, FIELD.height - 96, 13, PALETTE.muted, 'right');
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(10, 18, 28, 0.92)';
    roundRect(x, y, PANEL.width, height, 14);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, FIELD.width / 2, y + 72, 44, PALETTE.text, 'center', 'bold');
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, y + PANEL.top + index * PANEL.line, 19, PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 34, 20, PALETTE.gold, 'center', 'bold');
  }

  return { drawHud, drawPanel, gauge };
}
