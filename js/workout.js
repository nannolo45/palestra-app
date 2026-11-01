// The workout in progress. Everything runs from timestamps, so a locked phone or a reload loses nothing:
// the state is saved after every step and picked up again on start.
import { kvGet, kvSet, kvDel, uid } from './store.js';

/** One step per set (or one per cardio item), in routine order. */
export function buildSteps(routine, exercises) {
  const steps = [];
  (routine.items || []).forEach((it, itemIndex) => {
    const ex = exercises.find((e) => e.id === it.exerciseId && !e.deleted);
    if (!ex) return;
    if (ex.type === 'cardio') {
      steps.push({ itemIndex, exerciseId: ex.id, kind: 'cardio', n: 1, of: 1, plan: { targets: { ...(it.targets || {}) } } });
      return;
    }
    const sets = Math.max(1, Number(it.sets) || 1);
    for (let n = 1; n <= sets; n++) {
      steps.push({
        itemIndex, exerciseId: ex.id, kind: 'set', n, of: sets,
        plan: { reps: it.seconds ? null : Number(it.reps) || null, seconds: it.seconds ? Number(it.seconds) : null, weight: ex.type === 'weights' ? Number(it.weight) || 0 : null, rest: it.rest },
      });
    }
  });
  return steps;
}

/** Milliseconds between two moments, minus the pauses inside them. */
export function activeMs(from, to, pauses = []) {
  let ms = Math.max(0, to - from);
  for (const p of pauses) {
    const a = Math.max(from, p.from);
    const b = Math.min(to, p.to ?? to);
    if (b > a) ms -= b - a;
  }
  return Math.max(0, ms);
}

export function newWorkout(routine, exercises, { blockId = null, training = {}, now = Date.now() } = {}) {
  return {
    id: uid(),
    routineId: routine.id,
    blockId,
    start: now,
    steps: buildSteps(routine, exercises),
    idx: 0,
    phase: 'work',
    phaseStart: now,
    restPlanned: 0,
    restKind: null,
    between: routine.restBetween ?? training.between ?? 120,
    defaultRest: training.rest ?? 90,
    log: [],
    pauses: [],
    pausedAt: null,
    breakdown: { work: 0, rest: 0, walk: 0 },
  };
}

export const current = (w) => w.steps[w.idx] || null;
export const nextStep = (w) => w.steps[w.idx + 1] || null;
export const isPaused = (w) => w.pausedAt != null;

function allPauses(w, now) {
  return w.pausedAt != null ? [...w.pauses, { from: w.pausedAt, to: now }] : w.pauses;
}

/** Seconds since the session started, without pauses. */
export function elapsedSec(w, now = Date.now()) {
  return Math.floor(activeMs(w.start, now, allPauses(w, now)) / 1000);
}

/** Seconds in the current phase, without pauses. */
export function phaseSec(w, now = Date.now()) {
  return Math.floor(activeMs(w.phaseStart, now, allPauses(w, now)) / 1000);
}

/** The set (or cardio) is done: log it and start the rest, or finish after the last step. */
export function completeStep(w, values = {}, now = Date.now()) {
  const step = current(w);
  if (!step || w.phase !== 'work' || isPaused(w)) return w;
  const dur = phaseSec(w, now);
  const entry = { exerciseId: step.exerciseId, n: step.n, dur };
  if (step.kind === 'cardio') {
    entry.targets = { ...step.plan.targets, ...(values.targets || {}) };
    if (values.distance != null && values.distance !== '') entry.distance = Number(values.distance);
  } else {
    if (step.plan.seconds != null) entry.seconds = Number(values.seconds ?? step.plan.seconds);
    else entry.reps = Number(values.reps ?? step.plan.reps);
    if (step.plan.weight != null) entry.weight = Number(values.weight ?? step.plan.weight);
  }
  const log = [...w.log, entry];
  const breakdown = { ...w.breakdown, work: w.breakdown.work + dur };
  // the next sets of the same exercise start from what was just done
  const steps = w.steps.map((s, i) => (i > w.idx && s.exerciseId === step.exerciseId && s.kind === 'set'
    ? { ...s, plan: { ...s.plan, ...(entry.weight != null ? { weight: entry.weight } : {}) } } : s));
  const nxt = w.steps[w.idx + 1];
  if (!nxt) return { ...w, steps, log, breakdown, idx: w.idx + 1, phase: 'done', phaseStart: now };
  const sameExercise = nxt.itemIndex === step.itemIndex;
  const restPlanned = sameExercise ? (step.plan.rest ?? w.defaultRest) : w.between;
  return { ...w, steps, log, breakdown, phase: 'rest', phaseStart: now, restPlanned, restKind: sameExercise ? 'set' : 'between' };
}

/** Rest over (time's up and they tapped, or Salta): note the rest taken and move to the next step. */
export function endRest(w, now = Date.now()) {
  if (w.phase !== 'rest') return w;
  const took = phaseSec(w, now);
  const log = w.log.map((x, i) => (i === w.log.length - 1 ? { ...x, restTaken: took, restPlanned: w.restPlanned } : x));
  const breakdown = { ...w.breakdown, [w.restKind === 'between' ? 'walk' : 'rest']: w.breakdown[w.restKind === 'between' ? 'walk' : 'rest'] + took };
  return { ...w, log, breakdown, idx: w.idx + 1, phase: 'work', phaseStart: now, restPlanned: 0, restKind: null };
}

export function addRest(w, sec = 30) {
  return w.phase === 'rest' ? { ...w, restPlanned: w.restPlanned + sec } : w;
}

/** Skip the current set without logging it. */
export function skipStep(w, now = Date.now()) {
  if (w.phase !== 'work') return w;
  if (!nextStep(w)) return { ...w, idx: w.idx + 1, phase: 'done', phaseStart: now };
  return { ...w, idx: w.idx + 1, phase: 'work', phaseStart: now };
}

export function pause(w, now = Date.now()) {
  return w.pausedAt != null ? w : { ...w, pausedAt: now };
}

export function resume(w, now = Date.now()) {
  if (w.pausedAt == null) return w;
  return { ...w, pauses: [...w.pauses, { from: w.pausedAt, to: now }], pausedAt: null };
}

export function restLeft(w, now = Date.now()) {
  return w.restPlanned - phaseSec(w, now);
}

/** The session record to save (when finished, or ended early). */
export function toSession(w, now = Date.now()) {
  const ww = resume(w, now);
  const pauseSec = Math.round(ww.pauses.reduce((a, p) => a + (p.to - p.from), 0) / 1000);
  const done = ww.steps.length > 0 && ww.log.length >= ww.steps.length;
  return {
    id: ww.id,
    routineId: ww.routineId,
    start: ww.start,
    end: now,
    minutes: Math.max(1, Math.round(activeMs(ww.start, now, ww.pauses) / 60000)),
    sets: ww.log,
    breakdown: { ...ww.breakdown, pause: pauseSec },
    outcome: done ? 'done' : 'partial',
    ...(ww.blockId ? { everydayBlockId: ww.blockId } : {}),
  };
}

// ---- saving the workout in progress on this device ----

export async function loadActive() { return (await kvGet('active')) || null; }
export async function saveActive(w) { if (w) await kvSet('active', w); else await kvDel('active'); }
