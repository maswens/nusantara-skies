// The aeroplane: its state and one fixed step of flight. No drawing and no
// browser in here: step() takes the pilot's inputs and the terrain, and returns
// what happened as bit flags so the caller can react without this file knowing
// about screens or sound.
import { PLANE, RUNWAY, STEP } from './config.js';
import { overRunway, terrainHeight } from './world.js';

export const EVENT_RING = 1;
export const EVENT_ISLAND = 2;
export const EVENT_LANDED = 4;
export const EVENT_CRASHED = 8;
export const EVENT_STALL = 16;
export const EVENT_FUEL_EMPTY = 32;

const DEG = Math.PI / 180;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function angleDiff(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function createPlane() {
  const state = {
    x: RUNWAY.x,
    y: RUNWAY.elevation + 2,
    z: RUNWAY.z - RUNWAY.length / 2 + 20,
    heading: RUNWAY.heading,
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    onGround: true,
    stalled: false,
    crashed: false,
    landed: false,
    landedOffStrip: false,
    elapsed: 0,
    score: 0,
  };

  function reset() {
    state.x = RUNWAY.x;
    state.y = RUNWAY.elevation + 2;
    state.z = RUNWAY.z - RUNWAY.length / 2 + 20;
    state.heading = RUNWAY.heading;
    state.pitch = 0;
    state.bank = 0;
    state.speed = 0;
    state.throttle = 0;
    state.fuel = PLANE.fuelCapacity;
    state.damage = 0;
    state.verticalSpeed = 0;
    state.onGround = true;
    state.stalled = false;
    state.crashed = false;
    state.landed = false;
    state.landedOffStrip = false;
    state.elapsed = 0;
    state.score = 0;
  }

  /**
   * One fixed step. `input` holds throttleDelta (-1..1), turn (-1..1, left to
   * right), pitchInput (-1..1, down to up) and flaps (true while held).
   * `mission` is the active mission object, or null for free flight. `wind`
   * is the wind at the aeroplane, or null for dead calm: moving air pushes
   * the aeroplane sideways while it flies, so a crosswind on final has to
   * be flown out or the sortie drifts off the strip.
   */
  function step(input, mission, wind) {
    let events = 0;
    if (state.crashed || state.landed) return events;
    state.elapsed += STEP;

    // Throttle: fuel is the budget every sortie is flown against.
    if (state.fuel > 0) {
      state.throttle = clamp(state.throttle + input.throttleDelta * PLANE.throttleRate * STEP, 0, 1);
      state.fuel = Math.max(0, state.fuel - (PLANE.fuelBurnIdle + state.throttle * PLANE.fuelBurn) * STEP);
      if (state.fuel === 0) events |= EVENT_FUEL_EMPTY;
    } else {
      state.throttle = Math.max(0, state.throttle - STEP);
    }

    // Speed chases the throttle, and climbing bleeds it off.
    const targetSpeed = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    const climbPenalty = Math.max(0, state.pitch) * 26;
    const approach = state.speed < targetSpeed - climbPenalty ? 6 : 4.5;
    state.speed += clamp(targetSpeed - climbPenalty - state.speed, -approach * STEP, approach * STEP);

    // Bank and turn: a turn only bites when there is airflow over the wings.
    const speedFactor = clamp(state.speed / PLANE.cruiseSpeed, 0.15, 1.2);
    const wantedBank = input.turn * PLANE.maxBank * (0.4 + 0.6 * speedFactor);
    state.bank += clamp(wantedBank - state.bank, -1.6 * STEP, 1.6 * STEP);
    state.heading = (state.heading + state.bank * PLANE.turnRate * speedFactor * 57.3 * STEP + 360) % 360;

    // Pitch: pull up to climb, push down to dive; a slow wing stalls.
    state.stalled = state.speed < PLANE.stallSpeed && !state.onGround;
    const wantedPitch = state.stalled
      ? -0.1
      : clamp(input.pitchInput * PLANE.maxPitch, -PLANE.maxPitch, PLANE.maxPitch);
    state.pitch += clamp(wantedPitch - state.pitch, -PLANE.pitchRate * STEP, PLANE.pitchRate * STEP);

    // Flaps trade speed for lift on approach.
    const flapLift = input.flaps ? 0.04 : 0;
    const lift = Math.sin(state.pitch + flapLift) * PLANE.climbRate * (state.speed / PLANE.cruiseSpeed);
    const sink = state.speed < PLANE.stallSpeed ? PLANE.sinkRate * (1 - state.speed / PLANE.stallSpeed) : 0;
    // Pitch authority is strong: a pushed nose genuinely descends, so a
    // landing is flown, not waited for — and a flare before touchdown matters.
    state.verticalSpeed = state.onGround ? 0 : lift * 3.5 - sink - 0.8;
    // Ground effect: close to the ground with the nose level or up, the sink
    // softens, so a flare turns a descent into a touchdown instead of a crash.
    if (!state.onGround && state.pitch > -0.1) {
      const clearance = state.y - terrainHeight(state.x, state.z);
      if (clearance < 8) state.verticalSpeed = Math.max(state.verticalSpeed, -1.8);
    }
    state.y += state.verticalSpeed * STEP;

    // Move over the ground along the heading.
    const headingRad = state.heading * DEG;
    const forward = state.onGround ? Math.max(state.speed, 0) : state.speed;
    state.x += Math.sin(headingRad) * forward * STEP;
    state.z -= Math.cos(headingRad) * forward * STEP;

    // Wind drift: the wheels hold the aeroplane on the ground, but in the
    // air the breeze carries it sideways, a little every step.
    if (!state.onGround && wind) {
      state.x += wind.x * STEP;
      state.z += wind.z * STEP;
    }

    // Takeoff: enough speed and a pulled nose lifts off the strip. While the
    // wheels are down the aeroplane sits on the ground under it, runway or not.
    if (state.onGround) {
      if (state.speed > 34 && state.pitch > 0.08) {
        state.onGround = false;
        state.y = terrainHeight(state.x, state.z) + 3;
      } else {
        state.y = terrainHeight(state.x, state.z) + 2;
        state.verticalSpeed = 0;
      }
    }

    // Ground and terrain contact: a gentle runway touchdown lands, anything
    // else at speed is a crash, and a hillside always is.
    const ground = terrainHeight(state.x, state.z);
    if (!state.onGround && state.y <= ground + 2) {
      const aligned = Math.abs(angleDiff(state.heading, RUNWAY.heading)) < 22;
      const gentle = state.verticalSpeed > -4 && state.speed < 50;
      // A gentle touchdown on the flat airfield shelf is a landing even off
      // the strip — a bush landing, not a crash. Only the strip earns precision.
      const onShelf = Math.abs(ground - RUNWAY.elevation) < 1.5;
      if (overRunway(state.x, state.z) && aligned && gentle) {
        state.landed = true;
        state.onGround = true;
        state.y = RUNWAY.elevation + 2;
        events |= EVENT_LANDED;
      } else if (gentle && onShelf) {
        state.landed = true;
        state.landedOffStrip = true;
        state.onGround = true;
        state.y = ground + 2;
        events |= EVENT_LANDED;
      } else {
        state.crashed = true;
        state.damage = 100;
        state.y = ground + 2;
        events |= EVENT_CRASHED;
      }
    }

    // Hard landings away from the strip still hurt: a rough touchdown bends metal.
    if (state.onGround && !state.landed && !state.crashed && state.speed > 40 && !overRunway(state.x, state.z)) {
      state.damage = Math.min(100, state.damage + 30 * STEP);
    }

    // Mission progress is checked here, where the position is fresh.
    if (mission) {
      const gained = mission.check(state);
      if (gained & EVENT_RING) state.score += 100;
      if (gained & EVENT_ISLAND) state.score += 150;
      events |= gained;
    }
    return events;
  }

  return { state, reset, step };
}
