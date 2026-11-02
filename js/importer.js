// Import routines and their exercises from a file ("palestra-import", version 1), e.g. a plan written for you.
// Exercises are matched by name to the ones you already have (and keep your machines); the rest are added.
// Routines are always added as new ones. Nothing is overwritten.
import { state, upsert, uid, live } from './store.js';
import { EXERCISE_TYPES, EQUIPMENT, CARDIO_KIND_KEYS } from './model.js';

const norm = (s) => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/** Read and check a file's text, JSON or plain text. Returns { data, issues? } or { error } (error = a translation key). */
export function parseImport(text) {
  const raw = String(text || '').trim();
  if (!raw) return { error: 'importEmpty' };
  if (!raw.startsWith('{')) return parseText(raw);
  let data;
  try { data = JSON.parse(raw); } catch { return { error: 'importNotJson' }; }
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
  if (!data.plan && data.title && data.routines.length > 1) data.plan = { name: data.title, note: data.note || '' };
  return { data, issues: [] };
}

// ---- plain text ----
// WORKOUT: name           the week's plan (optional; also PLAN:, PIANO:)
// SCHEDA: name            starts a routine (also ROUTINE:, GIORNO:, DAY:, ALLENAMENTO:)
//   Files written before v9 used SCHEDA: for the plan and GIORNO: for the days. When a file has GIORNO:/DAY:
//   lines and no WORKOUT: line, SCHEDA: is still read as the plan's name, so old files import the same.
// Panca piana 4x8 60 kg rec 2:30     sets x reps, weight, rest (rec/rest/recupero: 2:30, 90s, 2 min)
// Plank 3x45s             timed
// Ellittica 15 min livello 6         cardio with targets
// (bilanciere) (manubri) (cavi) (macchina) (corpo libero)   equipment, anywhere in the line
// - text                  a note for the exercise above

const EQ_WORDS = [
  [/\b(bilanciere|barbell|bil)\b/i, 'barbell'], [/\b(manubri|manubrio|dumbbells?|man)\b/i, 'dumbbell'],
  [/\b(cavi|cavo|cables?|pulley|push ?down|face pull|croci ai cavi)\b/i, 'cable'], [/\b(macchina|machine|leg press|lat machine|chest press|leg curl|leg extension)\b/i, 'machine'],
];
const BODY_WORDS = /\b(plank|dip|dips|trazioni|pull ?ups?|chin ?ups?|piegamenti|push ?ups?|crunch|sit ?ups?|leg raise|iperestensioni|hyperextensions?|burpees?|mountain climbers?|corpo libero|bodyweight|affondi a corpo libero|squat a corpo libero)\b/i;
const CARDIO_KIND_WORDS = [
  [/\b(tapis|treadmill|corsa|camminata)\b/i, 'treadmill'], [/\b(ellittica|elliptical|ellittico)\b/i, 'elliptical'],
  [/\b(bike|cyclette|bici|spinning)\b/i, 'bike'], [/\b(vogatore|rower|rowing)\b/i, 'rower'], [/\b(stepper|step)\b/i, 'stepper'],
];

const WEEKDAY_WORDS = [/\b(lun|lunedi|lunedì|mon|monday)\b/i, /\b(mar|martedi|martedì|tue|tuesday)\b/i, /\b(mer|mercoledi|mercoledì|wed|wednesday)\b/i,
  /\b(gio|giovedi|giovedì|thu|thursday)\b/i, /\b(ven|venerdi|venerdì|fri|friday)\b/i, /\b(sab|sabato|sat|saturday)\b/i, /\b(dom|domenica|sun|sunday)\b/i];

function restSeconds(v) {
  const t = String(v).trim().toLowerCase().replace(',', '.');
  let m = t.match(/^(\d+):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d+(?:\.\d+)?)\s*(min|m|')$/);
  if (m) return Math.round(Number(m[1]) * 60);
  m = t.match(/^(\d+)\s*(s|sec|secondi|seconds|")?$/);
  if (m) return Number(m[1]);
  return null;
}

/** One exercise line → { name, equipment, sets, reps, seconds, weight, rest, duration, targets, leftover } */
export function parseLine(line) {
  let s = ` ${line.trim()} `;
  const out = { targets: {} };
  const take = (re, fn) => { const m = s.match(re); if (m) { fn(m); s = s.replace(m[0], ' '); return true; } return false; };
  // equipment in brackets
  take(/\(([^)]*)\)/, (m) => {
    const w = m[1];
    for (const [re, eq] of EQ_WORDS) if (re.test(w)) { out.equipment = eq; return; }
    if (/corpo libero|bodyweight/i.test(w)) out.body = true;
  });
  take(/\b(rec|recupero|riposo|rest)\.?\s*:?\s*(\d+:\d{2}|\d+(?:[.,]\d+)?\s*(?:min|m|'|s|sec|")?)(?=\s)/i, (m) => { out.rest = restSeconds(m[2]); });
  take(/\s(\d+)\s*[x×]\s*(\d+)\s*(s|sec|secondi|"|'')(?=\s)/i, (m) => { out.sets = Number(m[1]); out.seconds = Number(m[2]); });
  if (out.sets == null) take(/\s(\d+)\s*[x×]\s*(\d+)(?=\s)/i, (m) => { out.sets = Number(m[1]); out.reps = Number(m[2]); });
  take(/\s(\d+(?:[.,]\d+)?)\s*kg(?=\s)/i, (m) => { out.weight = Number(m[1].replace(',', '.')); });
  take(/\s(\d+(?:[.,]\d+)?)\s*km\/h(?=\s)/i, (m) => { out.targets.speed = Number(m[1].replace(',', '.')); });
  take(/\b(pendenza|incline|inclinazione)\s*(\d+(?:[.,]\d+)?)\s*%?(?=\s)/i, (m) => { out.targets.incline = Number(m[2].replace(',', '.')); });
  take(/\b(livello|level|liv)\s*(\d+)(?=\s)/i, (m) => { out.targets.level = Number(m[2]); });
  take(/\b(resistenza|resistance)\s*(\d+)(?=\s)/i, (m) => { out.targets.resistance = Number(m[2]); });
  take(/\b(rampa|ramp)\s*(\d+)(?=\s)/i, (m) => { out.targets.ramp = Number(m[2]); });
  take(/\s(\d+)\s*rpm(?=\s)/i, (m) => { out.targets.cadence = Number(m[1]); });
  if (out.sets == null) take(/\s(\d+(?:[.,]\d+)?)\s*(min|minuti|minutes|')(?=\s)/i, (m) => { out.duration = Number(m[1].replace(',', '.')); });
  // the name is the text before the first number of the line (brackets aside); what's left unread is reported
  const orig = line.replace(/\([^)]*\)/, ' ').replace(/\s+/g, ' ').trim();
  const nm = orig.match(/^(.*?)(?=\s\d|$)/);
  out.name = (nm ? nm[1] : orig).replace(/[·:,\-–]+$/, '').trim();
  let left = s.replace(/\s+/g, ' ').trim();
  if (out.name && left.toLowerCase().startsWith(out.name.toLowerCase())) left = left.slice(out.name.length);
  const rest = left.replace(/[·,;]/g, ' ').trim();
  if (rest) out.leftover = rest;
  return out;
}

function guessType(p, name) {
  if (p.duration != null && p.sets == null) return 'cardio';
  if (p.body || (!p.equipment && BODY_WORDS.test(name))) return 'bodyweight';
  if (p.seconds != null && !p.equipment && p.weight == null) return 'bodyweight';
  return 'weights';
}

function guessEquipment(name) {
  for (const [re, eq] of EQ_WORDS) if (re.test(name)) return eq;
  if (/\b(squat|stacco|deadlift|panca piana|bench press|rematore con bilanciere|military)\b/i.test(name)) return 'barbell';
  if (/\b(curl|alzate|croci|lento|affondi|french press|shoulder press)\b/i.test(name)) return 'dumbbell';
  return 'machine';
}

/** Plain text → the same data a JSON import gives, plus the lines it couldn't read. */
export function parseText(text) {
  const data = { format: 'palestra-import', version: 1, exercises: [], routines: [] };
  const issues = [];
  const exByKey = new Map();
  let routine = null; let lastEx = null; let planName = ''; let planNote = '';
  const lines = String(text).replace(/\r/g, '').split('\n');
  const oldStyle = lines.some((l) => /^\s*(giorno|day)\s*\d*\s*:/i.test(l)) && !lines.some((l) => /^\s*(workout|plan|piano)\s*:/i.test(l));
  const planRe = oldStyle ? /^(scheda|plan|piano)\s*:\s*(.+)$/i : /^(workout|plan|piano)\s*:\s*(.+)$/i;
  const dayRe = oldStyle ? /^(giorno|day|allenamento|routine)\s*\d*\s*:\s*(.+)$/i : /^(scheda|routine|giorno|day|allenamento)\s*\d*\s*:\s*(.+)$/i;
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    let m = line.match(planRe);
    if (m) { planName = m[2].trim(); return; }
    m = line.match(/^(note?|nota)\s*:\s*(.*)$/i);
    if (m && !routine) { planNote = m[2].trim(); return; }
    m = line.match(dayRe);
    if (m) {
      // "SCHEDA: Gambe @ ven 18:00": weekday and time are optional
      const [name, when = ''] = m[2].split('@');
      routine = { name: name.trim(), items: [], autoIncrease: true };
      const wd = WEEKDAY_WORDS.findIndex((re) => re.test(when));
      if (wd >= 0) routine._weekday = wd;
      const tm = when.match(/(\d{1,2})[:.](\d{2})/);
      if (tm && Number(tm[1]) < 24 && Number(tm[2]) < 60) routine._time = `${tm[1].padStart(2, '0')}:${tm[2]}`;
      data.routines.push(routine); lastEx = null; return;
    }
    m = line.match(/^[-–•*]\s*(.+)$/);
    if (m) {
      if (lastEx) lastEx.notes = lastEx.notes ? `${lastEx.notes}\n${m[1].trim()}` : m[1].trim();
      else issues.push({ line: i + 1, text: line, reason: 'noteWithoutExercise' });
      return;
    }
    if (!routine) { routine = { name: planName || 'Scheda', items: [], autoIncrease: true }; data.routines.push(routine); }
    const p = parseLine(line);
    if (!p.name) { issues.push({ line: i + 1, text: line, reason: 'noName' }); return; }
    if (p.sets == null && p.duration == null) { issues.push({ line: i + 1, text: line, reason: 'noSets' }); return; }
    const type = guessType(p, p.name);
    const key = `${norm(p.name)}|${type}`;
    let ex = exByKey.get(key);
    if (!ex) {
      ex = { id: `t${exByKey.size + 1}`, name: p.name.charAt(0).toUpperCase() + p.name.slice(1), type, muscles: [] };
      if (type === 'weights') ex.equipment = p.equipment || guessEquipment(p.name);
      if (type === 'bodyweight' && p.seconds != null) ex.timed = true;
      if (type === 'cardio') {
        const kind = (CARDIO_KIND_WORDS.find(([re]) => re.test(p.name)) || [null, 'custom'])[1];
        ex.cardio = { kind, targets: { duration: p.duration, ...p.targets } };
      }
      exByKey.set(key, ex);
      data.exercises.push(ex);
    }
    lastEx = ex;
    const item = { exerciseId: ex.id };
    if (type === 'cardio') item.targets = { duration: p.duration, ...p.targets };
    else {
      item.sets = p.sets;
      if (p.seconds != null) item.seconds = p.seconds; else item.reps = p.reps;
      if (p.weight != null) item.weight = p.weight;
      if (p.rest != null) item.rest = p.rest;
    }
    item._line = i + 1;
    routine.items.push(item);
    if (p.leftover) issues.push({ line: i + 1, text: line, reason: 'leftover', detail: p.leftover });
  });
  data.routines = data.routines.filter((r) => r.items.length);
  if (!data.routines.length) return { error: 'importNothing', issues };
  if (planName || data.routines.length > 1) data.plan = { name: planName || data.routines.map((r) => r.name).join(' · '), note: planNote };
  return { data, issues };
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
  return { newExercises: added, reused, routines, map, plan: data.plan || null };
}

/** For the preview: is this exercise already yours? */
export function exerciseStatus(data, plan, exId) {
  return plan.map.get(exId) ? 'ok' : 'new';
}

function cleanExercise(e) {
  const out = { id: uid(), name: String(e.name).trim(), type: e.type, muscles: Array.isArray(e.muscles) ? e.muscles.map(String) : [], notes: e.notes ? String(e.notes) : '', increase: { mode: 'type' } };
  if (e.type === 'weights') out.equipment = EQUIPMENT.includes(e.equipment) ? e.equipment : 'machine';
  if (e.type === 'bodyweight' && e.timed) out.timed = true;
  if (e.type === 'cardio') {
    const kind = CARDIO_KIND_KEYS.includes(e.cardio?.kind) ? e.cardio.kind : 'custom';
    out.cardio = { kind, targets: { ...(e.cardio?.targets || {}) } };
  }
  if (e.defaultRest != null) out.defaultRest = Number(e.defaultRest);
  return out;
}

/** Spread n days over the week: 3 → Mon, Wed, Fri. */
export function defaultWeekdays(count) {
  const table = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
  return table[count] || Array.from({ length: count }, () => null);
}

const n = (x) => (x == null || x === '' ? undefined : Number(x));

/** Add everything. Returns the plan with the ids of the new routines (and of the new plan, if one was made). */
export function runImport(data, { asPlan = true } = {}) {
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
    }, { silent: true });
    created.push(rec.id);
  });
  let planId = null;
  if (asPlan && data.plan) {
    const given = data.routines.some((r) => Number.isInteger(r._weekday ?? r.weekday));
    const weekdays = defaultWeekdays(created.length);
    const days = created.map((routineId, i) => {
      const r = data.routines[i];
      const wd = r._weekday ?? r.weekday;
      const time = r._time ?? r.time;
      return { routineId, weekday: Number.isInteger(wd) ? wd : given ? null : weekdays[i], ...(typeof time === 'string' && /^\d{2}:\d{2}$/.test(time) ? { time } : {}) };
    });
    const p = upsert('plans', { id: uid(), name: String(data.plan.name || '').trim() || 'Workout', note: data.plan.note || '', days }, { silent: true });
    planId = p.id;
  }
  return { ...plan, created, planId };
}

export { state };
