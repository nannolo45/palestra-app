// What Palestra knows about training: exercise types, cardio machines and their measures, estimated lengths,
// and the weekly automatic increase. Pure functions over plain records, so they can be tested in Node.

// ---- cardio measures ----

export const MEASURES = {
  duration: { unit: 'min', step: 1, min: 1 },
  speed: { unit: 'km/h', step: 0.5 },
  incline: { unit: '%', step: 1 },
  level: { unit: '', step: 1 },
  ramp: { unit: '', step: 1 },
  resistance: { unit: '', step: 1 },
  cadence: { unit: 'rpm', step: 5 },
  strokes: { unit: '/min', step: 1 },
  distance: { unit: 'km', step: 0.1 },
  calories: { unit: 'kcal', step: 10 },
  watt: { unit: 'W', step: 5 },
};

// The measures a custom machine can pick (besides duration, which is always there), in this order.
export const PICKABLE = ['speed', 'incline', 'level', 'resistance', 'cadence', 'distance', 'calories', 'watt'];
export const MAX_EXTRA_MEASURES = 3;

export const CARDIO_KINDS = {
  treadmill: { measures: ['duration', 'speed', 'incline'], defaults: { duration: 10, speed: 9, incline: 1 } },
  elliptical: { measures: ['duration', 'level', 'ramp'], defaults: { duration: 15, level: 8, ramp: 5 } },
  bike: { measures: ['duration', 'level', 'cadence'], defaults: { duration: 15, level: 6, cadence: 85 } },
  rower: { measures: ['duration', 'resistance', 'strokes'], defaults: { duration: 10, resistance: 5, strokes: 24 } },
  stepper: { measures: ['duration', 'level'], defaults: { duration: 10, level: 7 } },
  custom: { measures: ['duration'], defaults: { duration: 10 } },
};
export const CARDIO_KIND_KEYS = Object.keys(CARDIO_KINDS);

export const EXERCISE_TYPES = ['weights', 'bodyweight', 'cardio'];
export const EQUIPMENT = ['machine', 'barbell', 'dumbbell', 'cable'];

/** The measures a cardio exercise uses: [{key, label?, unit, step}]. A custom machine brings its own. */
export function measuresFor(ex, machine) {
  const kind = ex?.cardio?.kind || 'treadmill';
  if (kind === 'custom' && machine && Array.isArray(machine.measures)) {
    return [{ key: 'duration', ...MEASURES.duration }, ...machine.measures.map((m) => (typeof m === 'string'
      ? { key: m, ...(MEASURES[m] || { unit: '', step: 1 }) }
      : { key: m.key, label: m.label, unit: m.unit || '', step: Number(m.step) || 1 }))];
  }
  return (CARDIO_KINDS[kind] || CARDIO_KINDS.treadmill).measures.map((k) => ({ key: k, ...MEASURES[k] }));
}

export function defaultTargets(kind, machine) {
  const base = { ...(CARDIO_KINDS[kind] || CARDIO_KINDS.treadmill).defaults };
  if (kind === 'custom' && machine && Array.isArray(machine.measures)) {
    for (const m of machine.measures) { const k = typeof m === 'string' ? m : m.key; if (base[k] == null) base[k] = 0; }
  }
  return base;
}

/** Slug for a custom measure name: "Programma" → "c_programma". */
export function customMeasureKey(label) {
  const s = String(label || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `c_${s || 'misura'}`;
}

export function roundStep(x, step = 1) {
  const r = Math.round(x / step) * step;
  return Math.round(r * 100) / 100;
}

// ---- defaults kept in prefs ----

export const DEFAULT_INCREASE = {
  when: 'done', // 'done': only after a complete session; 'always': every week
  steps: { machine: 2.5, barbell: 2.5, dumbbell: 1, cable: 2.5, bodyweight: 1, cardio: 1 },
};
export const DEFAULT_TRAINING = { rest: 90, between: 120, vibrate: true, sound: false, wake: true };

export const INCREASE_STEP = { machine: 2.5, barbell: 2.5, dumbbell: 0.5, cable: 2.5, bodyweight: 1, cardio: 1 };

/** Which increase category an exercise falls in. */
export function increaseCategory(ex) {
  if (!ex) return null;
  if (ex.type === 'cardio') return 'cardio';
  if (ex.type === 'bodyweight') return 'bodyweight';
  return EQUIPMENT.includes(ex.equipment) ? ex.equipment : 'machine';
}

// ---- estimated length ----

const DEFAULT_SEC_PER_REP = 3;

/** Seconds a rep takes for this exercise, learned from logged sets once there are a few. */
export function secPerRep(exerciseId, sessions = []) {
  const samples = [];
  for (const s of [...sessions].filter((x) => !x.deleted).sort((a, b) => (b.start || 0) - (a.start || 0))) {
    for (const set of s.sets || []) {
      if (set.exerciseId === exerciseId && set.reps > 0 && set.dur > 0) samples.push(set.dur / set.reps);
      if (samples.length >= 20) break;
    }
    if (samples.length >= 20) break;
  }
  if (samples.length < 6) return DEFAULT_SEC_PER_REP; // about two sessions' worth
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return Math.min(10, Math.max(1.5, avg));
}

/** Estimated minutes for a routine: every set and its rest, the rest between exercises, cardio durations. */
export function estMinutes(routine, exercises = [], sessions = [], training = DEFAULT_TRAINING) {
  const items = (routine?.items || []).filter((it) => exercises.some((e) => e.id === it.exerciseId && !e.deleted));
  if (!items.length) return 0;
  const between = routine.restBetween ?? training.between ?? 120;
  let secs = 0;
  items.forEach((it, i) => {
    const ex = exercises.find((e) => e.id === it.exerciseId);
    if (ex.type === 'cardio') secs += (Number(it.targets?.duration) || 10) * 60;
    else {
      const sets = Math.max(1, Number(it.sets) || 1);
      const perSet = it.seconds ? Number(it.seconds) : (Number(it.reps) || 10) * secPerRep(ex.id, sessions);
      secs += sets * perSet + (sets - 1) * (it.rest ?? training.rest ?? 90);
    }
    if (i < items.length - 1) secs += between;
  });
  return Math.max(1, Math.ceil(secs / 60));
}

// ---- weeks ----

/** ISO week of a date: "2026-W45". */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ---- automatic increase ----

function lastSessionWith(exerciseId, sessions, before) {
  return [...sessions]
    .filter((s) => !s.deleted && s.end && (before == null || s.start < before) && (s.sets || []).some((x) => x.exerciseId === exerciseId))
    .sort((a, b) => b.start - a.start)[0] || null;
}

/** How the last time went for one routine item: {complete, reason, at} (at = the weight/reps/minutes done). */
export function lastResult(item, ex, sessions, now) {
  const s = lastSessionWith(ex.id, sessions, now);
  if (!s) return null;
  const sets = s.sets.filter((x) => x.exerciseId === ex.id);
  if (ex.type === 'cardio') {
    const done = sets.reduce((a, x) => a + (Number(x.targets?.duration) || 0), 0);
    const goal = Number(item.targets?.duration) || 0;
    return { complete: done >= goal, short: done < goal ? { kind: 'minutes', done, goal } : null, at: done, session: s };
  }
  const wantSets = Number(item.sets) || 1;
  if (item.seconds) {
    const under = sets.filter((x) => (Number(x.seconds) || 0) < item.seconds).length;
    return { complete: sets.length >= wantSets && under === 0, short: under ? { kind: 'seconds', under, of: sets.length, goal: item.seconds } : null, session: s };
  }
  const under = sets.filter((x) => (Number(x.reps) || 0) < (Number(item.reps) || 0)).length;
  const maxW = Math.max(0, ...sets.map((x) => Number(x.weight) || 0));
  const minW = Math.min(...sets.map((x) => Number(x.weight) || 0));
  let short = null;
  if (sets.length < wantSets) short = { kind: 'sets', done: sets.length, goal: wantSets };
  else if (under) short = { kind: 'reps', under, of: sets.length, goal: item.reps };
  return { complete: !short, short, at: ex.type === 'weights' ? minW : null, maxWeight: maxW, session: s };
}

/**
 * What to propose at the start of a session.
 * Returns { proposals:[{itemIndex, exerciseId, field, from, to}], held:[{exerciseId, short}], excluded:[ids], timed:[ids] }
 * or null when there's nothing to ask (switched off, or already asked this week).
 */
export function increaseProposals(routine, exercises, sessions, settings = DEFAULT_INCREASE, now = Date.now()) {
  if (!routine?.autoIncrease) return null;
  if (routine.increaseWeek === isoWeek(new Date(now))) return null;
  const steps = { ...DEFAULT_INCREASE.steps, ...(settings.steps || {}) };
  const out = { proposals: [], held: [], excluded: [], timed: [] };
  (routine.items || []).forEach((item, itemIndex) => {
    const ex = exercises.find((e) => e.id === item.exerciseId && !e.deleted);
    if (!ex) return;
    const inc = ex.increase || { mode: 'type' };
    if (inc.mode === 'off') { out.excluded.push(ex.id); return; }
    if (ex.type === 'bodyweight' && item.seconds) { out.timed.push(ex.id); return; }
    const cat = increaseCategory(ex);
    const step = inc.mode === 'custom' ? Number(inc.step) : Number(steps[cat]);
    if (!step || step <= 0) { out.excluded.push(ex.id); return; }
    const res = lastResult(item, ex, sessions, now);
    if (!res) return; // never done: nothing to go on yet
    if (ex.type === 'weights' && !(Number(item.weight) > 0)) return; // no weight chosen yet: the first session sets it
    if (ex.type === 'weights' && res.at != null && res.at < (Number(item.weight) || 0)) return; // the new weight isn't tried yet
    if (settings.when !== 'always' && !res.complete) { out.held.push({ exerciseId: ex.id, short: res.short }); return; }
    if (ex.type === 'cardio') {
      const from = Number(item.targets?.duration) || 10;
      out.proposals.push({ itemIndex, exerciseId: ex.id, field: 'duration', from, to: roundStep(from + step, 0.5) });
    } else if (ex.type === 'bodyweight') {
      const from = Number(item.reps) || 0;
      out.proposals.push({ itemIndex, exerciseId: ex.id, field: 'reps', from, to: from + Math.round(step) });
    } else {
      const from = Number(item.weight) || 0;
      out.proposals.push({ itemIndex, exerciseId: ex.id, field: 'weight', from, to: roundStep(from + step, 0.25) });
    }
  });
  return out;
}

/** The routine with the accepted proposals applied and this week marked as asked. */
export function applyIncrease(routine, proposals, accepted, now = Date.now()) {
  const items = routine.items.map((it) => ({ ...it, targets: it.targets ? { ...it.targets } : it.targets }));
  for (const p of proposals) {
    if (!accepted.includes(p.itemIndex)) continue;
    const it = items[p.itemIndex];
    if (p.field === 'duration') it.targets = { ...(it.targets || {}), duration: p.to };
    else it[p.field] = p.to;
  }
  return { ...routine, items, increaseWeek: isoWeek(new Date(now)) };
}

// ---- history ----

/** Load per session for one exercise, oldest first: [{start, value, sets}] (kg max for weights, reps, minutes). */
export function progressOf(exercise, sessions) {
  const out = [];
  for (const s of [...sessions].filter((x) => !x.deleted && x.end).sort((a, b) => a.start - b.start)) {
    const sets = (s.sets || []).filter((x) => x.exerciseId === exercise.id);
    if (!sets.length) continue;
    let value;
    if (exercise.type === 'cardio') value = sets.reduce((a, x) => a + (Number(x.targets?.duration) || 0), 0);
    else if (exercise.type === 'bodyweight') value = Math.max(...sets.map((x) => Number(x.reps || x.seconds) || 0));
    else value = Math.max(...sets.map((x) => Number(x.weight) || 0));
    out.push({ start: s.start, value, sets, session: s });
  }
  return out;
}

/** Total weight moved in a session (reps × kg), for the summary. */
export function totalWeight(session) {
  return (session.sets || []).reduce((a, x) => a + (Number(x.reps) || 0) * (Number(x.weight) || 0), 0);
}

/** The next workouts Everyday has planned (prefs record "planned"), soonest first, from now on. */
export function plannedAhead(planned, now = Date.now()) {
  if (!Array.isArray(planned)) return [];
  return planned
    .map((p) => ({ ...p, at: plannedTime(p) }))
    .filter((p) => p.at != null && p.at >= now - 3 * 3600 * 1000)
    .sort((a, b) => a.at - b.at);
}

export function plannedTime(p) {
  if (!p || !p.date) return null;
  const [y, m, d] = String(p.date).split('-').map(Number);
  const [hh, mm] = String(p.start || '00:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime();
}
