// The three sorties: what counts as progress, what the pilot is told to do
// next, and when the sortie is done. Each mission keeps its own progress and
// hands the plane a plain-text objective; the plane never knows the rules.
import { MISSIONS } from './config.js';
import { hopIslands, ringCourse } from './world.js';
import { EVENT_ISLAND, EVENT_LANDED, EVENT_RING } from './plane.js';

function distance3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function createRingRun() {
  const rings = ringCourse();
  let next = 0;
  let done = 0;
  return {
    id: MISSIONS.rings.id,
    name: MISSIONS.rings.name,
    target: MISSIONS.rings.target,
    rings,
    nextRing() { return rings[next] ?? null; },
    progress() { return done; },
    objective() {
      return next < rings.length
        ? `Fly through ring ${next + 1} of ${rings.length} — ${done} done`
        : 'All rings flown — sortie complete';
    },
    isComplete() { return done >= rings.length; },
    check(plane) {
      const ring = rings[next];
      if (!ring) return 0;
      if (distance3(plane, ring) < ring.radius) {
        next += 1;
        done += 1;
        return EVENT_RING;
      }
      return 0;
    },
  };
}

function createIslandHop() {
  const islands = hopIslands();
  let next = 0;
  let done = 0;
  return {
    id: MISSIONS.hop.id,
    name: MISSIONS.hop.name,
    target: MISSIONS.hop.target,
    islands,
    nextIsland() { return islands[next] ?? null; },
    progress() { return done; },
    objective() {
      return next < islands.length
        ? `Reach ${islands[next].name} below 400 m — ${done} of ${islands.length} visited`
        : 'All islands visited — sortie complete';
    },
    isComplete() { return done >= islands.length; },
    check(plane) {
      const island = islands[next];
      if (!island) return 0;
      const dx = plane.x - island.x;
      const dz = plane.z - island.z;
      if (Math.sqrt(dx * dx + dz * dz) < island.radius * 0.8 && plane.y < 400) {
        next += 1;
        done += 1;
        return EVENT_ISLAND;
      }
      return 0;
    },
  };
}

function createPrecisionLanding() {
  let flownOut = false;
  return {
    id: MISSIONS.landing.id,
    name: MISSIONS.landing.name,
    target: MISSIONS.landing.target,
    progress() { return flownOut ? 1 : 0; },
    objective() {
      return flownOut
        ? 'On final — land on the runway, slow and straight'
        : 'Take off, climb past 100 m south of the strip, then come back and land';
    },
    isComplete() { return false; },
    check(plane) {
      // Flown out once the plane is 450 m south of the strip, above 100 m.
      const dx = plane.x;
      const dz = plane.z - 100;
      if (!flownOut && Math.sqrt(dx * dx + dz * dz) < 120 && plane.y > 100) flownOut = true;
      return 0;
    },
    // The plane reports the landing itself; the mission scores it.
    onLanded() { return EVENT_LANDED; },
  };
}

/** Build the mission with this id; any other id is the Ring Run. */
export function createMission(id) {
  if (id === MISSIONS.hop.id) return createIslandHop();
  if (id === MISSIONS.landing.id) return createPrecisionLanding();
  return createRingRun();
}
