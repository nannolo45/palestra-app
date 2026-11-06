// Storico (v26): weekly lines for everything, per body region, per workout or for one scheda; pauses (long gaps with
// no training); and where you improved (the last 4 weeks you trained against the 4 before, pauses left out). Pure.
import { liftedKg } from './model.js';
import { musclesOf, regionOfMuscle } from './body.js';

export const DAY = 24 * 3600 * 1000;

export function weekStartOf(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
const dayOf = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const done = (sessions) => sessions.filter((s) => s && !s.deleted && s.end && !s.trial).sort((a, b) => a.start - b.start);
export const isoDay = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/**
 * Gaps of at least minDays days without training: [{ key, from, to, days, ongoing }], oldest first.
 * from = the first day without training, to = the last one; key = from's date, used to keep the reason.
 */
export function pausesOf(sessions, minDays = 10, now = Date.now()) {
  const days = [...new Set(done(sessions).map((s) => dayOf(s.start)))].sort((a, b) => a - b);
  const out = [];
  const gap = (a, b, ongoing) => {
    const n = Math.round((b - a) / DAY) - 1;
    if (n >= minDays) out.push({ key: isoDay(a + DAY), from: a + DAY, to: b - DAY, days: n, ongoing });
  };
  for (let i = 1; i < days.length; i++) gap(days[i - 1], days[i], false);
  if (days.length) gap(days[days.length - 1], dayOf(now) + DAY, true);
  return out;
}

/**
 * Weekly values: { weeks: [weekStart…], trained: [bool…], lines: [{ key, values: [number|null…] }] }.
 * dim: 'all' | 'region' | 'workout' | 'routine' | 'exercise'; metric: 'volume' (kg lifted) | 'sets' | 'max'.
 * For a region, the main muscle's region counts in full and the others half. 'max' over many exercises is an index:
 * each exercise's heaviest weight that week against its first one (100 = where it started).
 */
export function weekly(sessions, exercises, { dim = 'all', metric = 'volume', plans = [], routineId = null, exerciseId = null, now = Date.now() } = {}) {
  const ss = done(sessions).filter((s) => (dim !== 'routine' || s.routineId === routineId));
  const first = done(sessions)[0];
  if (!first) return { weeks: [], trained: [], lines: [] };
  const w0 = weekStartOf(first.start);
  const wN = weekStartOf(now);
  const weeks = [];
  for (let w = w0; w <= wN; w = weekStartOf(w + 8 * DAY)) weeks.push(w);
  const idx = (ts) => { const w = weekStartOf(ts); let i = weeks.indexOf(w); if (i < 0) i = weeks.findIndex((x) => x > w) - 1; return i; };
  const trained = weeks.map(() => false);
  for (const s of done(sessions)) trained[idx(s.start)] = true;
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const planOf = (rid) => plans.filter((p) => !p.deleted && (p.days || []).some((d) => d.routineId === rid)).map((p) => p.id);
  const sums = new Map(); // key → values
  const maxes = new Map(); // key → Map(exerciseId → [max per week])
  const add = (key, i, v) => { if (!sums.has(key)) sums.set(key, weeks.map(() => 0)); sums.get(key)[i] += v; };
  const addMax = (key, exId, i, kg) => {
    if (!maxes.has(key)) maxes.set(key, new Map());
    const m = maxes.get(key);
    if (!m.has(exId)) m.set(exId, weeks.map(() => null));
    const a = m.get(exId); a[i] = Math.max(a[i] ?? 0, kg);
  };
  for (const s of ss) {
    const i = idx(s.start);
    for (const x of s.sets || []) {
      if (dim === 'exercise' && x.exerciseId !== exerciseId) continue;
      const ex = byId.get(x.exerciseId);
      let keys;
      if (dim === 'region') {
        const regs = [];
        for (const m of musclesOf(ex)) { const r = regionOfMuscle(m); if (r && !regs.includes(r)) regs.push(r); }
        keys = regs.length ? regs.map((r, j) => [r, j ? 0.5 : 1]) : [['unsorted', 1]];
      } else if (dim === 'workout') keys = (planOf(s.routineId).length ? planOf(s.routineId) : ['none']).map((k) => [k, 1]);
      else keys = [[dim === 'routine' ? routineId : dim === 'exercise' ? exerciseId : 'all', 1]];
      const kg = ex && ex.type === 'weights' ? liftedKg(ex, x.weight) : 0;
      for (const [k, f] of keys) {
        if (metric === 'sets') add(k, i, f);
        else if (metric === 'volume') add(k, i, f * (Number(x.reps) || 0) * kg);
        else if (f === 1 && kg > 0) addMax(k, x.exerciseId, i, kg);
      }
    }
  }
  let lines;
  if (metric === 'max') {
    lines = [...maxes.entries()].map(([key, m]) => {
      if (dim === 'exercise') return { key, values: [...m.values()][0] };
      const values = weeks.map((_, i) => {
        const r = [];
        for (const a of m.values()) { const base = a.find((v) => v != null); if (a[i] != null && base) r.push((a[i] / base) * 100); }
        return r.length ? Math.round(r.reduce((p, c) => p + c, 0) / r.length) : null;
      });
      return { key, values };
    });
  } else {
    lines = [...sums.entries()].map(([key, v]) => ({ key, values: v.map((x, i) => (trained[i] ? Math.round(x * 10) / 10 : null)) }));
  }
  return { weeks, trained, lines };
}

/**
 * The change, in %, of the last 4 weeks with training against the 4 weeks with training before them (the week
 * that's still going is left out). null when there isn't enough to compare.
 */
export function changeOf(values, trained, { now = Date.now(), weeks = [] } = {}) {
  const cur = weekStartOf(now);
  const vs = values.map((v, i) => ({ v, i })).filter(({ v, i }) => trained[i] && v != null && weeks[i] !== cur);
  const a = vs.slice(-4); const b = vs.slice(-8, -4);
  if (a.length < 2 || b.length < 2) return null;
  const avg = (z) => z.reduce((p, c) => p + c.v, 0) / z.length;
  const B = avg(b);
  if (!B) return null;
  return Math.round((avg(a) / B - 1) * 100);
}
