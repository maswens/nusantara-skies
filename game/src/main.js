// Boot and the one loop: input is read every frame, the aeroplane advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between five screens: title, play, paused, over and done.
//
// ?shot=cover|rings|landing|title stages that scene instead of running the
// loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createPlane, EVENT_CRASHED, EVENT_FUEL_EMPTY, EVENT_ISLAND, EVENT_LANDED, EVENT_RING } from './plane.js';
import { createMission } from './missions.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MISSION_1, ACTION_MISSION_2, ACTION_MISSION_3, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer } from './render.js';
import { createHud, SCREEN_DONE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud(canvas);
const audio = createAudio();
const plane = createPlane();

const game = {
  plane: plane.state,
  mission: createMission('rings'),
  view: 'chase',
  score: 0,
  elapsed: 0,
  best: 0,
  message: '',
};

let messageTimer = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score lasts this visit only.
  }
}

function flash(message, seconds = 2.5) {
  game.message = message;
  messageTimer = seconds;
}

function runShot(name) {
  const scene = stageShot(name, plane, game);
  game.best = scene.best;
  let painted = 0;
  function paint() {
    renderer.drawWorld(game, performance.now() / 1000);
    hud.drawHud(game, game.mission, game.view);
    if (scene.screen === SCREEN_TITLE) {
      hud.drawPanel('NUSANTARA SKIES', [
        'Fly the archipelago: rings, island hops and one perfect landing.',
        'W/S throttle · Arrow keys pitch and turn',
        'Mouse steers · C camera · F flaps',
        '1 Ring Run   2 Island Hop   3 Precision Landing',
      ], 'Press Space or click to fly — pick a mission with 1, 2 or 3');
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let selectedMission = 'rings';
  game.best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stallBeepTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    plane.reset();
    game.mission = createMission(selectedMission);
    game.score = 0;
    game.elapsed = 0;
    game.message = '';
    messageTimer = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Flying ${game.mission.name}. Throttle with W and S.`);
    flash(`${game.mission.name} — ${game.mission.objective()}`, 4);
  }

  function finishSortie(title, lines, prompt) {
    screen = SCREEN_DONE;
    if (game.score > game.best) {
      game.best = game.score;
      saveBest(game.best);
    }
    announce(`${title}. Score ${game.score}. Best ${game.best}.`);
    game.endCard = { title, lines, prompt };
  }

  function endGameCrashed() {
    screen = SCREEN_OVER;
    if (game.score > game.best) {
      game.best = game.score;
      saveBest(game.best);
    }
    announce(`Crashed. Score ${game.score}. Best ${game.best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CAMERA) {
      game.view = game.view === 'cockpit' ? 'chase' : 'cockpit';
    }
    if (actions & ACTION_MISSION_1) selectedMission = 'rings';
    if (actions & ACTION_MISSION_2) selectedMission = 'hop';
    if (actions & ACTION_MISSION_3) selectedMission = 'landing';
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_DONE)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const controls = input.controls();
    const events = plane.step(controls, game.mission);
    game.score = plane.state.score;
    game.elapsed = plane.state.elapsed;
    audio.update(plane.state.throttle, plane.state.speed, !plane.state.onGround || plane.state.speed > 5);
    if (messageTimer > 0) {
      messageTimer -= STEP;
      if (messageTimer <= 0) game.message = '';
    }
    if (events & EVENT_RING) {
      audio.ring();
      flash(`RING +100 — ${game.mission.progress()} of ${game.mission.target}`);
    }
    if (events & EVENT_ISLAND) {
      audio.island();
      flash(`ISLAND REACHED +150 — ${game.mission.progress()} of ${game.mission.target}`);
    }
    if (events & EVENT_FUEL_EMPTY) flash('FUEL EMPTY — GLIDING', 4);
    if (plane.state.stalled) {
      stallBeepTimer -= STEP;
      if (stallBeepTimer <= 0) {
        audio.stall();
        stallBeepTimer = 0.8;
      }
    }
    if (events & EVENT_LANDED) {
      audio.landed();
      // A bush landing on the shelf ends the sortie with a small bonus but
      // never earns the precision prize: the strip is the mission.
      if (plane.state.landedOffStrip) {
        game.score += 50;
        plane.state.score = game.score;
        if (game.score > game.best) {
          game.best = game.score;
          saveBest(game.best);
        }
        finishSortie('LANDED OFF THE STRIP', [
          'Down safe on the airfield shelf — but not on the runway. +50 points.',
          `${game.mission.name}: ${game.mission.progress()} of ${game.mission.target} done.`,
          `Score ${game.score} · Best ${game.best}`,
        ], 'Press Space to fly again');
        return;
      }
      const landingBonus = game.mission.id === 'landing'
        ? 500 + Math.round(plane.state.fuel)
        : 50;
      game.score += landingBonus;
      plane.state.score = game.score;
      // Bank the best score before the end card is built, so it reads true.
      if (game.score > game.best) {
        game.best = game.score;
        saveBest(game.best);
      }
      if (game.mission.id === 'landing') {
        finishSortie('PERFECT LANDING', [
          `Precision Landing complete — +${landingBonus} points.`,
          `Fuel left ${Math.round(plane.state.fuel)}% · Time ${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}`,
          `Score ${game.score} · Best ${game.best}`,
        ], 'Press Space to fly again');
      } else {
        finishSortie('LANDED SAFELY', [
          `You put her down on the strip — +${landingBonus} points.`,
          `${game.mission.name}: ${game.mission.progress()} of ${game.mission.target} done.`,
          `Score ${game.score} · Best ${game.best}`,
        ], 'Press Space to fly again');
      }
      return;
    }
    if (events & EVENT_CRASHED) {
      audio.crash();
      endGameCrashed();
      return;
    }
    if (game.mission.isComplete()) {
      audio.landed();
      const bonus = Math.round(plane.state.fuel) * 2;
      game.score += bonus;
      if (game.score > game.best) {
        game.best = game.score;
        saveBest(game.best);
      }
      finishSortie('SORTIE COMPLETE', [
        `${game.mission.name} complete — fuel bonus +${bonus}.`,
        `Time ${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')} · Fuel left ${Math.round(plane.state.fuel)}%`,
        `Score ${game.score} · Best ${game.best}`,
      ], 'Press Space to fly again');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(game, now / 1000);
    if (screen === SCREEN_TITLE) {
      hud.drawPanel('NUSANTARA SKIES', [
        'Fly the archipelago: rings, island hops and one perfect landing.',
        'W/S throttle · Arrow keys pitch and turn',
        'Mouse steers · C camera · F flaps',
        `1 Ring Run   2 Island Hop   3 Precision Landing — now: ${game.mission.name}`,
        `Best score ${game.best}`,
      ], 'Press Space or click to fly — pick a mission with 1, 2 or 3');
    } else {
      hud.drawHud(game, game.mission, game.view);
      if (screen === SCREEN_PAUSED) {
        hud.drawPanel('Paused', ['The islands will wait for you.'], 'Press P to resume');
      } else if (screen === SCREEN_OVER) {
        hud.drawPanel('CRASHED', [
          'The aeroplane is bent. The islands are still there.',
          `Score ${game.score} · Best ${game.best}`,
        ], 'Press Space or R to fly again');
      } else if (screen === SCREEN_DONE && game.endCard) {
        hud.drawPanel(game.endCard.title, game.endCard.lines, game.endCard.prompt);
      }
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nusantara Skies. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
