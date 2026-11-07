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
export const DEFAULT_TRAINING = { rest: 90, between: 120, vibrate: true, sound: false, alarm: 'bell', volume: 80, tick: true, alarmAgain: true, wake: true, start: 'overview', countdown: 15, pauseDays: 10 };

// ---- one set's plan (v24): sets that differ (item.perSet), rep ranges (item.repsMax), to failure (item.failure) ----

/** How many sets a routine item has. */
export const setsOf = (it) => (Array.isArray(it?.perSet) && it.perSet.length ? it.perSet.length : Math.max(1, Number(it?.sets) || 1));

/** Set n (from 1) of a routine item: { reps, repsMax, seconds, weight, failure }. */
export function setPlan(it, n) {
  const list = Array.isArray(it.perSet) && it.perSet.length ? it.perSet : null;
  const ps = list ? list[Math.min(n, list.length) - 1] : null;
  const secs = ps ? ps.seconds : it.seconds;
  const seconds = secs != null ? Number(secs) : null;
  const reps = seconds != null ? null : Number(ps ? ps.reps : it.reps) || null;
  const w = ps && ps.weight != null ? ps.weight : it.weight;
  return {
    reps, seconds, weight: w == null ? null : Number(w) || 0,
    repsMax: seconds == null && Number(it.repsMax) > (reps || 0) ? Number(it.repsMax) : null,
    failure: it.failure === 'all' || (it.failure === 'last' && n === setsOf(it)),
  };
}

const kgTxt = (x) => String(Math.round(Number(x) * 100) / 100).replace('.', ',');

/**
 * A strength item in short: "3 × 8 · 60 kg", "3 × 8–12 · 45 kg", "8/6/4 × 10/12/14 kg", "3 × 45 s".
 * withKg = false leaves the weight out (bodyweight).
 */
export function setsText(it, withKg = true) {
  const n = setsOf(it);
  const rows = Array.from({ length: n }, (_, i) => setPlan(it, i + 1));
  const sameAmount = rows.every((r) => r.reps === rows[0].reps && r.seconds === rows[0].seconds);
  const sameKg = rows.every((r) => r.weight === rows[0].weight);
  const amount = (r) => (r.seconds != null ? `${r.seconds} s` : `${r.reps ?? '–'}${r.repsMax ? `–${r.repsMax}` : ''}`);
  const kg = withKg && rows.some((r) => r.weight) ? (sameKg ? `${kgTxt(rows[0].weight)} kg` : `${rows.map((r) => kgTxt(r.weight)).join('/')} kg`) : '';
  if (sameAmount) return `${n} × ${amount(rows[0])}${kg ? ` · ${kg}` : ''}`;
  return `${rows.map((r) => (r.seconds != null ? r.seconds : r.reps)).join('/')}${rows[0].seconds != null ? ' s' : ''}${kg ? ` × ${kg}` : ''}`;
}

/** The same item as a line of the import text: "3x8", "8/6/4 x 10/12/14", "3x8-12 45 kg cedimento". */
export function setsImportText(it, withKg = true) {
  const n = setsOf(it);
  const rows = Array.from({ length: n }, (_, i) => setPlan(it, i + 1));
  const kg = (x) => kgTxt(x);
  let out;
  if (variedSets(it) && rows[0].seconds == null) {
    const hasKg = withKg && rows.some((r) => r.weight);
    out = `${rows.map((r) => r.reps).join('/')} x ${hasKg ? rows.map((r) => kg(r.weight || 0)).join('/') : '0'}`;
  } else {
    out = rows[0].seconds != null ? `${n}x${rows[0].seconds}s` : `${n}x${rows[0].reps}${rows[0].repsMax ? `-${rows[0].repsMax}` : ''}`;
    if (withKg && rows[0].weight) out += ` ${kg(rows[0].weight)} kg`;
  }
  if (it.failure === 'all') out += ' cedimento';
  if (it.failure === 'last') out += ' ultima a cedimento';
  return out;
}

/** Do the sets of an item differ from each other? */
export const variedSets = (it) => Array.isArray(it?.perSet) && it.perSet.length > 0;

/** An item from per-set rows [{reps|seconds, weight}]: equal rows fold back into sets × reps × kg. */
export function itemFromRows(it, rows) {
  const out = { ...it };
  delete out.perSet;
  if (!rows.length) return out;
  const same = rows.every((r) => r.reps === rows[0].reps && r.seconds === rows[0].seconds && r.weight === rows[0].weight);
  out.sets = rows.length;
  if (rows[0].seconds != null) { out.seconds = rows[0].seconds; delete out.reps; } else { out.reps = rows[0].reps; delete out.seconds; }
  if (rows[0].weight != null) out.weight = rows[0].weight;
  if (!same) out.perSet = rows.map((r) => ({ ...(r.seconds != null ? { seconds: r.seconds } : { reps: r.reps }), ...(r.weight != null ? { weight: r.weight } : {}) }));
  return out;
}

// ---- a starting weight from your body (v24): Impostazioni → Il tuo corpo ----

// Working weight for 8–12 reps per kg of body weight, for someone who has trained a few months. Rough and on the
// prudent side. [name pattern, ratio, upper|lower body]. Dumbbells: per dumbbell. Barbell: with the bar.
const STARTS = [
  [/squat/, 0.55, 'low'], [/stacco|deadlift/, 0.55, 'low'], [/leg press|pressa/, 1.1, 'low'], [/hack/, 0.7, 'low'],
  [/leg extension|estension.*gamb/, 0.35, 'low'], [/leg curl/, 0.3, 'low'], [/calf|polpacci/, 0.6, 'low'], [/affondi|lunge/, 0.12, 'low'],
  [/hip thrust|ponte/, 0.6, 'low'], [/abduct|adduct/, 0.4, 'low'],
  [/panca inclinata|incline.*press/, 0.4, 'up'], [/panca|bench/, 0.45, 'up'], [/chest press/, 0.45, 'up'], [/pectoral|pec deck/, 0.35, 'up'],
  [/croci|fly|flye|crossover/, 0.1, 'up'], [/lat machine|pulldown|lat /, 0.5, 'up'], [/pulley|seated.*row|cable row/, 0.45, 'up'],
  [/rematore|row/, 0.4, 'up'], [/military|lento|shoulder press|overhead/, 0.3, 'up'], [/alzate|lateral|raise/, 0.06, 'up'],
  [/face pull/, 0.15, 'up'], [/curl a martello|hammer/, 0.1, 'up'], [/curl/, 0.22, 'up'], [/french|skull/, 0.2, 'up'],
  [/push ?down|pushdown|tricip/, 0.25, 'up'], [/dip/, 0.4, 'up'], [/crunch/, 0.3, 'up'],
];
const LEVEL = { first: 0.7, weeks: 0.85, months: 1, years: 1.25 };

/**
 * A starting weight for an exercise from body weight (kg), height (cm), sex and experience, or null when it doesn't
 * know the exercise or the body isn't set. Height moves it only ±5%: it matters far less than body weight.
 */
export function suggestWeight(ex, body) {
  if (!ex || ex.type !== 'weights' || !body || !(Number(body.kg) > 0)) return null;
  const name = `${ex.name} ${ex.picture?.name || ''}`.toLowerCase();
  const row = STARTS.find(([re]) => re.test(name));
  if (!row) return null;
  let ratio = row[1];
  const db = ex.equipment === 'dumbbell';
  // a dumbbell version of a barbell lift: per dumbbell, a bit less than half
  if (db && ratio > 0.2) ratio *= 0.4;
  const sex = body.sex === 'f' ? (row[2] === 'up' ? 0.6 : 0.75) : 1;
  const h = 1 + Math.max(-0.05, Math.min(0.05, ((Number(body.cm) || 175) - 175) / 300));
  let w = Number(body.kg) * ratio * sex * (LEVEL[body.level] ?? LEVEL.weeks) * h;
  if (ex.equipment === 'barbell' && ex.weightAs === 'side') w = (w - BAR_KG) / 2;
  const step = db ? 1 : 2.5;
  w = Math.max(step, Math.round(w / step) * step);
  if (ex.equipment === 'barbell' && ex.weightAs !== 'side') w = Math.max(BAR_KG, w);
  return w;
}

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
    const joined = it.superset && items[i + 1] && ex.type !== 'cardio';
    const prevJoined = i > 0 && items[i - 1].superset && ex.type !== 'cardio';
    if (ex.type === 'cardio') secs += (Number(it.targets?.duration) || 10) * 60;
    else {
      const sets = setsOf(it);
      let work = 0;
      for (let n = 1; n <= sets; n++) {
        const p = setPlan(it, n);
        work += p.seconds != null ? p.seconds : ((p.repsMax ? (p.reps + p.repsMax) / 2 : p.reps) || 10) * secPerRep(ex.id, sessions);
      }
      // a superserie rests once per round, after its last exercise
      const restOf = prevJoined ? (items.slice(0, i).reverse().find((x, k, arr) => !arr[k + 1] || !arr[k + 1].superset)?.rest ?? it.rest) : it.rest;
      secs += work + (joined ? 0 : (sets - 1) * (restOf ?? training.rest ?? 90));
    }
    if (i < items.length - 1 && !joined) secs += it.restAfter != null && it.restAfter !== '' ? Number(it.restAfter) : between;
  });
  return Math.max(1, Math.ceil(secs / 60));
}

/**
 * How long a scheda really takes you (v27): for each of its last complete sessions, the minutes it took against the
 * estimate for what was done that day (the sets really done), so a changed scheda doesn't throw it off. The newest
 * counts 1, the one before 0.7, then 0.49…; with one or two sessions the plain estimate still counts too.
 * Returns { ratio, rows: [{ start, minutes, est, weight }] }; ratio 1 with no sessions.
 */
export function durationFromHistory(routineId, sessions = [], exercises = [], training = DEFAULT_TRAINING, max = 6) {
  const done = sessions.filter((s) => !s.deleted && s.end && s.routineId === routineId && s.outcome !== 'partial' && !s.trial && Number(s.minutes) > 0)
    .sort((a, b) => b.start - a.start).slice(0, max);
  const rows = [];
  for (const s of done) {
    const items = [];
    for (const x of s.sets || []) {
      let it = items[items.length - 1];
      if (!it || it.exerciseId !== x.exerciseId) { it = { exerciseId: x.exerciseId, perSet: [], rests: [] }; items.push(it); }
      if (x.targets) it.targets = { duration: x.targets.duration };
      else it.perSet.push(x.seconds != null ? { seconds: x.seconds } : { reps: x.reps || 10 });
      if (x.restPlanned) it.rests.push(x.restPlanned);
    }
    const r = { items: items.map((it) => (it.targets ? { exerciseId: it.exerciseId, targets: it.targets } : { exerciseId: it.exerciseId, sets: it.perSet.length, perSet: it.perSet, rest: it.rests.length ? Math.round(it.rests.reduce((a, b) => a + b, 0) / it.rests.length) : undefined })) };
    const est = estMinutes(r, exercises, sessions, training);
    if (est > 0) rows.push({ start: s.start, minutes: Number(s.minutes), est });
  }
  if (!rows.length) return { ratio: 1, rows };
  let sw = 0; let sum = 0;
  rows.forEach((x, i) => { x.weight = 0.7 ** i; sw += x.weight; sum += x.weight * (x.minutes / x.est); });
  const k = rows.length >= 3 ? 0 : rows.length === 2 ? 0.5 : 1;
  rows.forEach((x) => { x.weight /= sw; });
  const ratio = Math.min(3, Math.max(0.3, (sum + k) / (sw + k)));
  return { ratio, rows };
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
  const wantSets = setsOf(item);
  if (setPlan(item, 1).seconds != null) {
    const under = sets.filter((x, i) => (Number(x.seconds) || 0) < (setPlan(item, i + 1).seconds || 0)).length;
    return { complete: sets.length >= wantSets && under === 0, short: under ? { kind: 'seconds', under, of: sets.length, goal: setPlan(item, 1).seconds } : null, session: s };
  }
  const under = sets.filter((x, i) => (Number(x.reps) || 0) < (setPlan(item, i + 1).reps || 0)).length;
  const maxW = Math.max(0, ...sets.map((x) => Number(x.weight) || 0));
  const minW = Math.min(...sets.map((x) => Number(x.weight) || 0));
  let short = null;
  if (sets.length < wantSets) short = { kind: 'sets', done: sets.length, goal: wantSets };
  else if (under) short = { kind: 'reps', under, of: sets.length, goal: setPlan(item, 1).reps };
  // a rep range: up when every set reaches the top
  const max = setPlan(item, 1).repsMax;
  let top = null;
  if (max) {
    const below = sets.filter((x) => (Number(x.reps) || 0) < max).length;
    top = sets.length >= wantSets && !below;
    if (!top && !short) short = { kind: 'top', under: below, of: sets.length, goal: max };
  }
  return { complete: max ? top : !short, short, at: ex.type === 'weights' ? minW : null, maxWeight: maxW, top, session: s };
}

/** The lightest weight a routine item plans (all sets alike unless they differ). */
export function minPlannedWeight(item) {
  return Math.min(...Array.from({ length: setsOf(item) }, (_, i) => setPlan(item, i + 1).weight || 0));
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
    if (ex.type === 'bodyweight' && setPlan(item, 1).seconds != null) { out.timed.push(ex.id); return; }
    const cat = increaseCategory(ex);
    const step = inc.mode === 'custom' ? Number(inc.step) : Number(steps[cat]);
    if (!step || step <= 0) { out.excluded.push(ex.id); return; }
    const res = lastResult(item, ex, sessions, now);
    if (!res) return; // never done: nothing to go on yet
    if (ex.type === 'weights' && !(minPlannedWeight(item) > 0)) return; // no weight chosen yet: the first session sets it
    if (ex.type === 'weights' && res.at != null && res.at < minPlannedWeight(item)) return; // the new weight isn't tried yet
    if (settings.when !== 'always' && !res.complete) { out.held.push({ exerciseId: ex.id, short: res.short }); return; }
    if (ex.type === 'cardio') {
      const from = Number(item.targets?.duration) || 10;
      out.proposals.push({ itemIndex, exerciseId: ex.id, field: 'duration', from, to: roundStep(from + step, 0.5) });
    } else if (ex.type === 'bodyweight') {
      const from = setPlan(item, 1).reps || 0;
      out.proposals.push({ itemIndex, exerciseId: ex.id, field: 'reps', from, to: from + Math.round(step) });
    } else {
      const from = setPlan(item, 1).weight || 0;
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
    if (p.field === 'duration') { it.targets = { ...(it.targets || {}), duration: p.to }; continue; }
    const d = p.to - p.from;
    // every set goes up by the same step, so a pyramid stays a pyramid; a rep range moves as a whole
    if (variedSets(it)) it.perSet = it.perSet.map((x) => ({ ...x, [p.field]: roundStep((Number(x[p.field]) || 0) + d, 0.25) }));
    if (p.field === 'reps' && it.repsMax) it.repsMax = Number(it.repsMax) + d;
    it[p.field] = roundStep((Number(it[p.field]) || 0) + d, 0.25);
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
// ---- what the weight means (v23): exercise.weightAs and exercise.dumbbells ----
export const BAR_KG = 20;

/**
 * How an exercise's weight is read. Dumbbells: per dumbbell (the default; 1 or 2 of them) or in all. Barbell: in all,
 * bar included (the default), or plates per side. Anything else: plain kg.
 */
export function weightMode(ex) {
  if (!ex) return 'plain';
  if (ex.equipment === 'dumbbell') return ex.weightAs === 'total' ? 'dbTotal' : Number(ex.dumbbells) === 1 ? 'dbOne' : 'dbEach';
  if (ex.equipment === 'barbell') return ex.weightAs === 'side' ? 'barSide' : 'barTotal';
  return 'plain';
}

/** The kilos actually lifted for one rep at weight w, for the totals. */
export function liftedKg(ex, w) {
  const n = Number(w) || 0;
  const m = weightMode(ex);
  if (m === 'dbEach') return n * 2;
  if (m === 'barSide') return n > 0 ? n * 2 + BAR_KG : 0;
  return n;
}

export function totalWeight(session, exercises = []) {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return (session.sets || []).reduce((a, x) => a + (Number(x.reps) || 0) * liftedKg(byId.get(x.exerciseId), x.weight), 0);
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
