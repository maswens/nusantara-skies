// Keyboard and mouse input. Held keys steer the aeroplane; one-shot presses
// (start, pause, camera, restart, mission pick) are queued as bit flags and
// taken once by the loop, so a press between two frames is never lost and
// never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_RESTART = 8;
export const ACTION_MISSION_1 = 16;
export const ACTION_MISSION_2 = 32;
export const ACTION_MISSION_3 = 64;

const TURN_LEFT = new Set(['ArrowLeft', 'KeyA']);
const TURN_RIGHT = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_UP = new Set(['KeyW']);
const THROTTLE_DOWN = new Set(['KeyS']);
const PITCH_UP = new Set(['ArrowUp', 'KeyI']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyK']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const CAMERA = new Set(['KeyC']);
const RESTART = new Set(['KeyR']);
const FLAPS = new Set(['KeyF']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0.5;
  let mouseActive = false;
  let lastMouseMove = 0;

  function press(event) {
    if (TURN_LEFT.has(event.code) || TURN_RIGHT.has(event.code)
      || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)
      || PITCH_UP.has(event.code) || PITCH_DOWN.has(event.code)
      || FLAPS.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (CAMERA.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CAMERA;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (event.code === 'Digit1') {
      if (!event.repeat) actions |= ACTION_MISSION_1;
    } else if (event.code === 'Digit2') {
      if (!event.repeat) actions |= ACTION_MISSION_2;
    } else if (event.code === 'Digit3') {
      if (!event.repeat) actions |= ACTION_MISSION_3;
    } else return;
    event.preventDefault();
  }

  function release(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', press);
  window.addEventListener('keyup', release);
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', () => { actions |= ACTION_CONFIRM; });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / Math.max(1, rect.width);
    mouseActive = true;
    lastMouseMove = performance.now();
  });
  canvas.addEventListener('wheel', (event) => {
    // The wheel is the throttle: roll up for power, down to pull back.
    held.add(event.deltaY < 0 ? 'WheelUp' : 'WheelDown');
    window.setTimeout(() => held.delete(event.deltaY < 0 ? 'WheelUp' : 'WheelDown'), 120);
    event.preventDefault();
  }, { passive: false });

  function hasAny(codes) {
    for (const code of codes) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Steering for this frame: turn -1..1, pitch -1..1, throttle -1..1. */
    controls() {
      let turn = 0;
      if (hasAny(TURN_LEFT)) turn -= 1;
      if (hasAny(TURN_RIGHT)) turn += 1;
      // A mouse held off-centre steers gently, and lets go when it is idle.
      if (turn === 0 && mouseActive && performance.now() - lastMouseMove < 2500) {
        turn = Math.max(-1, Math.min(1, (mouseX - 0.5) * 2.4));
      }
      let pitch = 0;
      if (hasAny(PITCH_UP)) pitch += 1;
      if (hasAny(PITCH_DOWN)) pitch -= 1;
      let throttle = 0;
      if (hasAny(THROTTLE_UP) || held.has('WheelUp')) throttle += 1;
      if (hasAny(THROTTLE_DOWN) || held.has('WheelDown')) throttle -= 1;
      return {
        turn: Math.max(-1, Math.min(1, turn)),
        pitchInput: Math.max(-1, Math.min(1, pitch)),
        throttleDelta: Math.max(-1, Math.min(1, throttle)),
        flaps: hasAny(FLAPS),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
