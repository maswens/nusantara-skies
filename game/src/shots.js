// The screenshot scenes behind ?shot=cover|rings|landing|title. Each one puts
// the real aeroplane and the real mission into a fixed, repeatable pose — the
// same frame every time — and returns the screen to draw over it. No scene
// fakes the view: the renderer paints exactly what a player would see there.
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { createMission } from './missions.js';
import { stillWind } from './weather.js';

function pose(plane, values) {
  Object.assign(plane.state, values);
}

export function stageShot(name, plane, game) {
  game.view = 'chase';
  game.wind = stillWind();
  if (name === 'rings') {
    const mission = createMission('rings');
    game.mission = mission;
    // Fly the first two rings for real, so the HUD shows honest progress.
    pose(plane, { x: 0, y: 120, z: -420, heading: 0, speed: 55 });
    mission.check(plane.state);
    pose(plane, { x: 430, y: 165, z: -330, heading: 90, speed: 58 });
    mission.check(plane.state);
    // On final for ring 3, nearly level with it and 250 m out, so the ring
    // sits dead ahead of the aeroplane instead of floating above it.
    pose(plane, {
      x: 560, y: 200, z: -180, heading: 160, pitch: 0, bank: 0.15,
      speed: 60, throttle: 0.75, fuel: 78, onGround: false, elapsed: 140,
    });
    plane.state.score = 200;
    game.score = 200;
    game.elapsed = 140;
    game.message = 'RING +100 — 2 of 8';
    return { screen: SCREEN_PLAY, best: 350 };
  }
  if (name === 'landing') {
    const mission = createMission('landing');
    game.mission = mission;
    // Mark the out-and-back leg flown, so the objective reads as final approach.
    pose(plane, { x: 0, y: 150, z: 100, heading: 180, speed: 55 });
    mission.check(plane.state);
    // Final approach from the cockpit: the strip ahead through the
    // windshield and the lit gauges below it — the landing flown, not watched.
    // Short final, 90 m out and 40 m above the strip, so the runway fills
    // the windshield above the dashboard; offset 25 m east of the centreline
    // so the strip clears the centre pillar instead of hiding behind it.
    game.view = 'cockpit';
    pose(plane, {
      x: 25, y: 70, z: -580, heading: 180, pitch: -0.06, bank: 0,
      speed: 44, throttle: 0.35, fuel: 61, verticalSpeed: -2.2,
      onGround: false, elapsed: 210,
    });
    plane.state.score = 340;
    game.score = 340;
    game.elapsed = 210;
    game.message = '';
    return { screen: SCREEN_PLAY, best: 350 };
  }
    // Cover and title share the hero pose: on climb-out past the home island,
    // runway ahead, first ring dead ahead, full HUD lit. The plane sits just
    // south of the strip so the runway reads in the same frame as the ring,
    // offset 45 m east so the ring clears the tail fin instead of hiding
    // behind it, and low enough that the ring sits on the horizon above it.
    game.mission = createMission('rings');
  pose(plane, {
    x: 45, y: 100, z: -120, heading: 0, pitch: 0.08, bank: 0.12,
    speed: 55, throttle: 0.7, fuel: 92, verticalSpeed: 3.1,
    onGround: false, elapsed: 12,
  });
  plane.state.score = 0;
  game.score = 0;
  game.elapsed = 12;
  game.message = '';
  if (name === 'title') return { screen: SCREEN_TITLE, best: 350 };
  return { screen: SCREEN_PLAY, best: 350 };
}
