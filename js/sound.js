// The rest alarm (v27): a few sounds made on the spot (no files), a tick in the last seconds, and unlocking the audio
// on the first tap, because phones only let a page make sound that a tap started.
let ac = null;

function ctx() {
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  if (!ac) ac = new C();
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

/** Call from a tap (starting a workout, any tap on its screen): from then on the alarm can sound. */
export function unlockAudio() {
  const c = ctx();
  if (!c) return;
  try { // a silent blip: iOS needs something played from the tap itself
    const o = c.createOscillator(); const g = c.createGain();
    g.gain.value = 0.00001; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.02);
  } catch { /* no audio */ }
}

function tone(c, freq, start, dur, vol, type = 'sine') {
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(c.destination);
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

export const SOUNDS = ['bell', 'beeps', 'gong', 'none'];

/** kind: bell | beeps | gong | tick; volume 0–100. */
export function playSound(kind, volume = 80) {
  if (!kind || kind === 'none') return;
  const c = ctx();
  if (!c) return;
  const v = Math.max(0, Math.min(100, Number(volume) || 0)) / 100 * 0.5;
  if (!v) return;
  try {
    if (kind === 'bell') [0, 0.55].forEach((s) => { tone(c, 1318, s, 1.2, v); tone(c, 2637, s, 0.6, v * 0.35); tone(c, 1976, s, 0.9, v * 0.25); });
    else if (kind === 'beeps') [0, 0.28, 0.56].forEach((s) => tone(c, 1046, s, 0.18, v, 'square'));
    else if (kind === 'gong') { tone(c, 196, 0, 2.6, v); tone(c, 392, 0, 1.8, v * 0.5); tone(c, 587, 0, 1.2, v * 0.25); }
    else if (kind === 'tick') tone(c, 1500, 0, 0.06, v * 0.6, 'triangle');
  } catch { /* no audio */ }
}

/** The sound chosen in the settings (the bell unless changed). */
export const alarmOf = (tr) => (SOUNDS.includes(tr.alarm) ? tr.alarm : 'bell');
