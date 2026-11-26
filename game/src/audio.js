// Procedural sound: everything is synthesised with WebAudio, so the game
// ships no audio files and makes no network request. The engine hum follows
// the throttle, the wind follows the speed, and short tones mark events.
export function createAudio() {
  let context = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
    } catch {
      return false;
    }
    engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 55;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engine.connect(filter).connect(engineGain).connect(context.destination);
    engine.start();

    const length = context.sampleRate;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilterLocal = context.createBiquadFilter();
    windFilterLocal.type = 'bandpass';
    windFilterLocal.frequency.value = 700;
    windFilter = windFilterLocal;
    windGain = context.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(context.destination);
    wind.start();
    return true;
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (!context || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    /** Call from any user gesture: browsers only allow audio after one. */
    unlock() { ensure(); },
    /** Continuous engine and wind, called every frame with the plane state. */
    update(throttle, speed, flying) {
      if (!context || muted) return;
      const target = flying ? 0.05 + throttle * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engine.frequency.setTargetAtTime(48 + throttle * 70 + speed * 0.4, context.currentTime, 0.1);
      windGain.gain.setTargetAtTime(flying ? Math.min(0.12, speed * 0.0011) : 0, context.currentTime, 0.15);
      // Faster air whistles higher: the wind filter follows the speed.
      if (windFilter) windFilter.frequency.setTargetAtTime(500 + speed * 9, context.currentTime, 0.2);
    },
    ring() { tone(880, 0.18, 'sine', 0.22); tone(1318, 0.28, 'sine', 0.18, 0.09); },
    island() { tone(659, 0.2, 'triangle', 0.2); tone(988, 0.3, 'triangle', 0.16, 0.1); },
    landed() { tone(523, 0.25, 'sine', 0.2); tone(659, 0.25, 'sine', 0.2, 0.14); tone(784, 0.5, 'sine', 0.22, 0.28); },
    crash() {
      tone(70, 0.5, 'sine', 0.4);
      tone(46, 0.7, 'sawtooth', 0.25, 0.05);
    },
    stall() { tone(440, 0.12, 'square', 0.08); },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
      return muted;
    },
  };
}
