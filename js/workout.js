// The workout in progress. Everything runs from timestamps, so a locked phone or a reload loses nothing:
// the state is saved after every step and picked up again on start.
import { kvGet, kvSet, kvDel, uid } from './store.js';
import { setsOf, setPlan, variedSets } from './model.js';

/**
 * One step per set (or one per cardio item), in routine order. A rep range starts from what was done last time in
 * that set (sessions: the finished ones, newest wins).
 */
export function buildSteps(routine, exercises, sessions = []) {
  const steps = [];
  (routine.items || []).forEach((it, itemIndex) => {
    const ex = exercises.find((e) => e.id === it.exerciseId && !e.deleted);
    if (!ex) return;
    if (ex.type === 'cardio') {
      steps.push({ itemIndex, exerciseId: ex.id, kind: 'cardio', n: 1, of: 1, plan: { targets: { ...(it.targets || {}) } } });
      return;
    }
    const sets = setsOf(it);
    let last = null;
    if (it.repsMax) {
      const s = [...sessions].filter((x) => !x.deleted && x.end && (x.sets || []).some((y) => y.exerciseId === ex.id)).sort((a, b) => b.start - a.start)[0];
      if (s) last = s.sets.filter((y) => y.exerciseId === ex.id);
    }
    for (let n = 1; n <= sets; n++) {
      const sp = setPlan(it, n);
      let reps = sp.reps;
      if (sp.repsMax && last && last[n - 1] && Number(last[n - 1].reps) > 0) reps = Math.min(sp.repsMax, Math.max(1, Number(last[n - 1].reps)));
      steps.push({
        itemIndex, exerciseId: ex.id, kind: 'set', n, of: sets,
        plan: {
          reps, seconds: sp.seconds, weight: ex.type === 'weights' ? sp.weight || 0 : null, rest: it.rest,
          ...(sp.repsMax ? { repsMin: sp.reps, repsMax: sp.repsMax } : {}), ...(sp.failure ? { failure: true } : {}), ...(variedSets(it) ? { varied: true } : {}),
        },
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

export function newWorkout(routine, exercises, { blockId = null, training = {}, now = Date.now(), sessions = [], trial = false } = {}) {
  return {
    id: uid(),
    routineId: routine.id,
    blockId,
    start: now,
    steps: buildSteps(routine, exercises, sessions),
    ...(trial ? { trial: true } : {}),
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
  const entry = { exerciseId: step.exerciseId, n: step.n, dur, item: step.itemIndex };
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
  // (not when the sets differ on purpose: a pyramid keeps its own numbers)
  const steps = w.steps.map((s, i) => (i > w.idx && s.itemIndex === step.itemIndex && s.kind === 'set' && !s.plan.varied
    ? { ...s, plan: { ...s.plan, ...(entry.weight != null ? { weight: entry.weight } : {}) } } : s));
  const nxt = w.steps[w.idx + 1];
  // the last step: a last "rest" where you can add a set or an exercise, or finish
  if (!nxt && step.kind === 'cardio') return { ...w, steps, log, breakdown, idx: w.idx + 1, phase: 'done', phaseStart: now };
  if (!nxt) return { ...w, steps, log, breakdown, phase: 'rest', phaseStart: now, restPlanned: 0, restKind: 'end' };
  const sameExercise = nxt.itemIndex === step.itemIndex;
  const restPlanned = sameExercise ? (step.plan.rest ?? w.defaultRest) : w.between;
  return { ...w, steps, log, breakdown, phase: 'rest', phaseStart: now, restPlanned, restKind: sameExercise ? 'set' : 'between' };
}

/** Rest over (time's up and they tapped, or Salta): note the rest taken and move to the next step. */
export function endRest(w, now = Date.now()) {
  if (w.phase !== 'rest') return w;
  const took = phaseSec(w, now);
  const log = w.log.map((x, i) => (i === w.log.length - 1 ? { ...x, restTaken: took, restPlanned: w.restPlanned } : x));
  if (w.restKind === 'end' && !w.steps[w.idx + 1]) return { ...w, idx: w.idx + 1, phase: 'done', phaseStart: now, restPlanned: 0, restKind: null };
  const bucket = w.restKind === 'between' ? 'walk' : 'rest';
  const breakdown = { ...w.breakdown, [bucket]: w.breakdown[bucket] + (w.restKind === 'end' ? 0 : took) };
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

/**
 * One step back. During a rest: reopen the set just done. During a set: go to the previous one. A set that was
 * logged is taken off the log and its values become the starting point, so it can be done again or corrected.
 */
export function back(w, now = Date.now()) {
  if (isPaused(w) || w.phase === 'done') return w;
  const idx = w.phase === 'rest' ? w.idx : w.idx - 1;
  if (idx < 0) return w;
  const step = w.steps[idx];
  let li = -1;
  for (let i = w.log.length - 1; i >= 0; i--) if (w.log[i].exerciseId === step.exerciseId && w.log[i].n === step.n) { li = i; break; }
  let { steps, log, breakdown } = w;
  if (li >= 0) {
    const e = log[li];
    log = log.filter((_, i) => i !== li);
    breakdown = { ...breakdown, work: Math.max(0, breakdown.work - (e.dur || 0)) };
    const plan = step.kind === 'cardio'
      ? { ...step.plan, targets: { ...step.plan.targets, ...(e.targets || {}) } }
      : { ...step.plan, ...(e.reps != null ? { reps: e.reps } : {}), ...(e.seconds != null ? { seconds: e.seconds } : {}), ...(e.weight != null ? { weight: e.weight } : {}) };
    steps = steps.map((s, i) => (i === idx ? { ...s, plan } : s));
  }
  return { ...w, steps, log, breakdown, idx, phase: 'work', phaseStart: now, restPlanned: 0, restKind: null };
}

// ---- in più (v24): a set or an exercise added during the rest after an exercise's last set ----

/** Is the rest right after the last set of an exercise? (where Palestra asks "Ne fai un'altra?") */
export function afterLastSet(w) {
  if (w.phase !== 'rest' || isPaused(w)) return false;
  const s = current(w); const nx = w.steps[w.idx + 1];
  return Boolean(s && s.kind === 'set' && (!nx || nx.itemIndex !== s.itemIndex));
}

/** One more set of the exercise just done, right after, from its numbers. */
export function addSet(w) {
  if (!afterLastSet(w)) return w;
  const s = current(w);
  const done = [...w.log].reverse().find((x) => x.exerciseId === s.exerciseId && x.n === s.n);
  const of = s.of + 1;
  const plan = { ...s.plan, ...(done ? { reps: done.reps ?? s.plan.reps, seconds: done.seconds ?? s.plan.seconds, weight: done.weight ?? s.plan.weight } : {}) };
  const extra = { ...s, n: s.n + 1, of, plan, extra: true };
  const steps = w.steps.map((x) => (x.itemIndex === s.itemIndex ? { ...x, of } : x));
  steps.splice(w.idx + 1, 0, extra);
  return { ...w, steps, restKind: w.restKind === 'end' ? 'set' : 'set', restPlanned: w.restKind === 'end' ? (s.plan.rest ?? w.defaultRest) : w.restPlanned };
}

/** Undo addSet while still in that rest. */
export function removeAddedSet(w) {
  const nx = w.steps[w.idx + 1];
  if (w.phase !== 'rest' || !nx || !nx.extra || isLogged(w, nx)) return w;
  const s = current(w);
  const of = s.of - 1;
  const steps = w.steps.filter((_, i) => i !== w.idx + 1).map((x) => (x.itemIndex === s.itemIndex ? { ...x, of } : x));
  const after = steps[w.idx + 1];
  return { ...w, steps, restKind: !after ? 'end' : 'between', restPlanned: !after ? 0 : Math.max(w.restPlanned, w.between) };
}

/** An exercise not in the scheda, right after the one just done: one set, from plan ({reps|seconds, weight}). */
export function addExercise(w, ex, plan) {
  if (!afterLastSet(w) || !ex) return w;
  const s = current(w);
  const itemIndex = Math.max(...w.steps.map((x) => x.itemIndex)) + 1;
  const step = ex.type === 'cardio'
    ? { itemIndex, exerciseId: ex.id, kind: 'cardio', n: 1, of: 1, plan: { targets: { ...(plan.targets || {}) } }, added: s.itemIndex }
    : { itemIndex, exerciseId: ex.id, kind: 'set', n: 1, of: 1, plan: { reps: plan.seconds != null ? null : plan.reps ?? 10, seconds: plan.seconds ?? null, weight: ex.type === 'weights' ? plan.weight ?? 0 : null, rest: plan.rest }, added: s.itemIndex };
  const steps = [...w.steps];
  steps.splice(w.idx + 1, 0, step);
  return { ...w, steps, restKind: 'between', restPlanned: Math.max(w.restPlanned, w.between) };
}

/** Is this step in the log already (done, not skipped)? */
export function isLogged(w, s) { return w.log.some((x) => x.exerciseId === s.exerciseId && x.n === s.n); }

/**
 * "Fallo adesso": an exercise further on (or one skipped) comes next. Its steps not yet done move to where you are:
 * now during a set, right after the rest during a rest. The order of everything else stays.
 */
export function doNow(w, itemIndex, now = Date.now()) {
  if (isPaused(w) || w.phase === 'done') return w;
  const at = w.phase === 'rest' ? w.idx + 1 : w.idx;
  const moves = (s, i) => s.itemIndex === itemIndex && (i >= at || !isLogged(w, s));
  const moving = w.steps.filter(moves);
  if (!moving.length) return w;
  const before = w.steps.filter((s, i) => i < at && !moves(s, i));
  const after = w.steps.filter((s, i) => i >= at && !moves(s, i));
  const steps = [...before, ...moving, ...after];
  if (w.phase === 'rest') return { ...w, steps, idx: before.length - 1, restKind: 'between', restPlanned: Math.max(w.restPlanned, w.between) };
  return { ...w, steps, idx: before.length, phaseStart: now };
}

/** "Correggi i numeri": new values for sets already in the log, by their place in the log. */
export function editLog(w, edits) {
  const log = w.log.map((x, i) => {
    const e = edits.find((d) => d.i === i);
    if (!e) return x;
    const y = { ...x };
    for (const k of ['reps', 'seconds', 'weight']) if (e[k] != null && x[k] != null) y[k] = Number(e[k]);
    return y;
  });
  return { ...w, log };
}

export const canGoBack = (w) => !isPaused(w) && (w.phase === 'rest' || (w.phase === 'work' && w.idx > 0));

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
    sets: ww.log.map(({ item, ...x }) => x),
    breakdown: { ...ww.breakdown, pause: pauseSec },
    outcome: done ? 'done' : 'partial',
    ...(ww.blockId ? { everydayBlockId: ww.blockId } : {}),
  };
}

/**
 * The workout in progress as Everyday sees it: prefs → { id: 'live', value }. Only start, pause, resume and the
 * end change it; sets and rests don't. `at` is added when it's written.
 */
export function liveRecord(w) {
  if (!w || w.phase === 'done') return null;
  return {
    sessionId: w.id, routineId: w.routineId, start: w.start, pausedAt: w.pausedAt ?? null,
    pausedMs: w.pauses.reduce((a, p) => a + (p.to - p.from), 0), ...(w.blockId ? { blockId: w.blockId } : {}),
  };
}

// ---- saving the workout in progress on this device ----

export async function loadActive() { return (await kvGet('active')) || null; }
export async function saveActive(w) { if (w) await kvSet('active', w); else await kvDel('active'); }
