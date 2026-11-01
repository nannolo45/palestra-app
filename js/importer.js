// Import routines and their exercises from a file ("palestra-import", version 1), e.g. a plan written for you.
// Exercises are matched by name to the ones you already have (and keep your machines); the rest are added.
// Routines are always added as new ones. Nothing is overwritten.
import { state, upsert, uid, live } from './store.js';
import { EXERCISE_TYPES, EQUIPMENT, CARDIO_KIND_KEYS } from './model.js';

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** Read and check a file's text. Returns { data } or { error } (error = a translation key). */
export function parseImport(text) {
  let data;
  try { data = JSON.parse(String(text || '').trim()); } catch { return { error: 'importNotJson' }; }
  if (!data || data.format !== 'palestra-import') return { error: 'importWrongFormat' };
  if (Number(data.version) > 1) return { error: 'importTooNew' };
  if (!Array.isArray(data.routines) || !Array.isArray(data.exercises)) return { error: 'importWrongFormat' };
  for (const e of data.exercises) {
    if (!e || !e.id || !e.name || !EXERCISE_TYPES.includes(e.type)) return { error: 'importBadExercise', detail: e && e.name };
  }
  const ids = new Set(data.exercises.map((e) => e.id));
  for (const r of data.routines) {
    if (!r || !r.name || !Array.isArray(r.items)) return { error: 'importWrongFormat' };
    for (const it of r.items) if (!ids.has(it.exerciseId)) return { error: 'importMissingExercise', detail: r.name };
  }
  return { data };
}

/** What an import would do: { newExercises:[names], reused:[names], routines:[{name, finalName, items}] } */
export function planImport(data) {
  const mine = live('exercises');
  const reused = []; const added = [];
  const map = new Map();
  for (const e of data.exercises) {
    const same = mine.find((m) => norm(m.name) === norm(e.name) && m.type === e.type);
    if (same) { map.set(e.id, same.id); reused.push(same.name); } else { map.set(e.id, null); added.push(e.name); }
  }
  const names = new Set(live('routines').map((r) => norm(r.name)));
  const routines = data.routines.map((r) => {
    let finalName = r.name; let n = 2;
    while (names.has(norm(finalName))) finalName = `${r.name} (${n++})`;
    names.add(norm(finalName));
    return { name: r.name, finalName, items: r.items.length };
  });
  return { newExercises: added, reused, routines, map };
}

function cleanExercise(e) {
  const out = { id: uid(), name: String(e.name).trim(), type: e.type, muscles: Array.isArray(e.muscles) ? e.muscles.map(String) : [], notes: e.notes ? String(e.notes) : '', increase: { mode: 'type' } };
  if (e.type === 'weights') out.equipment = EQUIPMENT.includes(e.equipment) ? e.equipment : 'machine';
  if (e.type === 'bodyweight' && e.timed) out.timed = true;
  if (e.type === 'cardio') {
    const kind = CARDIO_KIND_KEYS.includes(e.cardio?.kind) && e.cardio.kind !== 'custom' ? e.cardio.kind : 'treadmill';
    out.cardio = { kind, targets: { ...(e.cardio?.targets || {}) } };
  }
  if (e.defaultRest != null) out.defaultRest = Number(e.defaultRest);
  return out;
}

const n = (x) => (x == null || x === '' ? undefined : Number(x));

/** Add everything. Returns the plan with the ids of the new routines. */
export function runImport(data) {
  const plan = planImport(data);
  for (const e of data.exercises) {
    if (plan.map.get(e.id)) continue;
    const rec = upsert('exercises', cleanExercise(e), { silent: true });
    plan.map.set(e.id, rec.id);
  }
  let order = live('routines').length;
  const created = [];
  data.routines.forEach((r, i) => {
    const items = r.items.map((it) => {
      const out = { exerciseId: plan.map.get(it.exerciseId) };
      if (it.targets) out.targets = { ...it.targets };
      else {
        out.sets = n(it.sets) ?? 3;
        if (it.seconds != null) out.seconds = n(it.seconds); else out.reps = n(it.reps) ?? 10;
        if (it.weight != null) out.weight = n(it.weight);
        out.rest = n(it.rest) ?? 90;
      }
      return out;
    });
    const rec = upsert('routines', {
      id: uid(), name: plan.routines[i].finalName, items, autoIncrease: Boolean(r.autoIncrease),
      ...(r.restBetween != null ? { restBetween: n(r.restBetween) } : {}), order: order++,
    }, { silent: i < data.routines.length - 1 });
    created.push(rec.id);
  });
  return { ...plan, created };
}

export { state };
