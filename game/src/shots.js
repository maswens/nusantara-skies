// The screenshot scenes behind ?shot=cover|rings|landing|title. Each one puts
// the real aeroplane and the real mission into a fixed, repeatable pose — the
// same frame every time — and returns the screen to draw over it. No scene
// fakes the view: the renderer paints exactly what a player would see there.
import { SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { createMission } from './missions.js';

function pose(plane, values) {
  Object.assign(plane.state, values);
}

export function stageShot(name, plane, game) {
  game.view = 'chase';
  if (name === 'rings') {
    const mission = createMission('rings');
    game.mission = mission;
    // Fly the first two rings for real, so the HUD shows honest progress.
    pose(plane, { x: 0, y: 120, z: -420, heading: 0, speed: 55 });
    mission.check(plane.state);
    pose(plane, { x: 430, y: 165, z: -330, heading: 90, speed: 58 });
    mission.check(plane.state);
    pose(plane, {
      x: 430, y: 165, z: -100, heading: 127, pitch: 0.02, bank: 0.25,
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
    pose(plane, {
      x: 0, y: 110, z: -650, heading: 180, pitch: -0.08, bank: 0,
      speed: 48, throttle: 0.4, fuel: 61, verticalSpeed: -2.5,
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
    // south of the strip so the runway reads in the same frame as the ring.
    game.mission = createMission('rings');
  pose(plane, {
    x: 0, y: 150, z: -120, heading: 0, pitch: 0.08, bank: 0.12,
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
