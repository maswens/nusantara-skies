// Nusantara Skies: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. Altitudes are metres,
// speeds are metres per second, headings are degrees clockwise from north.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const PLANE = {
  maxSpeed: 95,
  cruiseSpeed: 62,
  stallSpeed: 24,
  minSpeed: 12,
  throttleRate: 0.55,
  turnRate: 0.55,
  maxBank: 1.05,
  pitchRate: 0.5,
  maxPitch: 0.42,
  climbRate: 9,
  sinkRate: 4.5,
  fuelCapacity: 100,
  fuelBurn: 0.55,
  fuelBurnIdle: 0.08,
  startAltitude: 140,
  startSpeed: 55,
};

export const CAMERA = { chaseDistance: 17, chaseHeight: 5.5, focal: 640 };

export const RUNWAY = {
  // Flat strip on the home island's north shore, pointing south: takeoffs
  // climb out over the island valley, and landings come in over the sea.
  x: 0,
  z: -350,
  heading: 180,
  length: 260,
  width: 26,
  elevation: 30,
};

export const ISLANDS = [
  { name: 'Pulau Merak', x: 0, z: 0, radius: 620, peak: 120 },
  { name: 'Pulau Banda', x: 1150, z: -950, radius: 420, peak: 165 },
  { name: 'Pulau Seroja', x: -1050, z: -700, radius: 380, peak: 95 },
  { name: 'Pulau Karang', x: 420, z: 1150, radius: 300, peak: 70 },
  { name: 'Pulau Ombak', x: -1250, z: 950, radius: 260, peak: 55 },
];

export const MISSIONS = {
  rings: { id: 'rings', name: 'Ring Run', target: 8, points: 100 },
  hop: { id: 'hop', name: 'Island Hop', target: 3, points: 150 },
  landing: { id: 'landing', name: 'Precision Landing', target: 1, points: 500 },
};

export const PALETTE = {
  backdrop: '#0a1a2e',
  skyTop: '#2f6fb2',
  skyMid: '#7fb6dd',
  skyLow: '#cfe8f2',
  sun: '#fff3c4',
  seaDeep: '#0b4f6e',
  seaShallow: '#1d8aa5',
  sand: '#e6cf96',
  grass: '#4d9a52',
  grassDark: '#357a3e',
  rock: '#8d8378',
  runway: '#3a3f46',
  runwayLine: '#f5f0dc',
  ringNext: '#ff9f1c',
  ringDone: '#2ec4b6',
  ringFar: '#7fd1c0',
  planeWhite: '#f4f6f8',
  planeRed: '#d7263d',
  planeDark: '#22303c',
  glass: '#9fd8ef',
  panel: '#101820',
  panelEdge: '#2c3e50',
  gaugeFace: '#f2f7f5',
  gaugeLit: '#ffe9a8',
  text: '#eef4f7',
  muted: '#a9bcc9',
  warn: '#ff5d5d',
  good: '#7be0a3',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'nusantara-skies.best';
