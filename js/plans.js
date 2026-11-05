// Weekly plans (schede): a named set of routines, each on a weekday. One plan is active: it's the one the
// Allenamenti tab shows and the one Everyday plans from (prefs record "activePlan", see the README).
import { state, get, live, pref, setPref, upsert } from './store.js';
import { routineMinutes } from './data.js';
import { machineOf } from './data.js';
import { measuresFor, setsImportText } from './model.js';

const DAY = 86400000;

/** "18:00" → true. A day's time is optional. */
export const validTime = (x) => typeof x === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(x);

/** Monday 00:00 (local) of the week containing ts. */
export function weekStart(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** "YYYY-MM-DD" of a timestamp, local time. */
export function isoDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateOf(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d).getTime() : null;
}

export const plans = () => live('plans').sort((a, b) => String(a.name).localeCompare(b.name));

/**
 * The plan in force now. A plan made active "from Monday" keeps the previous one in force until then:
 * { planId, plan, from, upcoming: { planId, plan, from } | null }.
 */
export function activeInfo(now = Date.now()) {
  const v = pref('activePlan', null);
  if (!v || !v.planId) return null;
  const plan = get('plans', v.planId);
  const today = isoDate(now);
  if (v.from && v.from > today && v.previous && v.previous.planId) {
    const prev = get('plans', v.previous.planId);
    if (prev) return { ...v.previous, plan: prev, upcoming: plan ? { planId: v.planId, plan, from: v.from } : null };
  }
  return plan ? { planId: v.planId, from: v.from, plan, upcoming: null } : null;
}

/** Active now, or set to become active. */
export const isActive = (planId) => { const a = activeInfo(); return a?.planId === planId; };
export const isUpcoming = (planId) => activeInfo()?.upcoming?.planId === planId;

/** The days of a plan whose routine still exists. */
export function planDays(plan) {
  return (plan?.days || []).filter((d) => get('routines', d.routineId));
}

/** What Everyday reads: the active plan, its days and weekdays (0 = Monday … 6 = Sunday, or null = any day). */
function activeRecord(plan, from) {
  return {
    planId: plan.id,
    name: plan.name,
    from,
    days: planDays(plan).map((d) => ({
      routineId: d.routineId,
      weekday: Number.isInteger(d.weekday) ? d.weekday : null,
      ...(validTime(d.time) ? { time: d.time } : {}),
    })),
  };
}

/** Make a plan the active one, from a date ("YYYY-MM-DD"). */
export function activate(plan, from) {
  const cur = activeInfo();
  const rec = activeRecord(plan, from);
  // until "from", the plan in force stays the one before (Everyday plans those days with it)
  if (cur && cur.planId !== plan.id && from > isoDate(Date.now())) {
    rec.previous = activeRecord(cur.plan, cur.from);
  }
  setPref('activePlan', rec);
}

export function deactivate() { setPref('activePlan', null); }

/** After a plan changes: keep the activePlan record (which Everyday reads) in step. */
export function savePlan(plan) {
  const rec = upsert('plans', plan);
  const a = pref('activePlan', null);
  if (a && (a.planId === rec.id || a.previous?.planId === rec.id)) {
    const next = a.planId === rec.id ? { ...activeRecord(rec, a.from), ...(a.previous ? { previous: a.previous } : {}) } : { ...a, previous: activeRecord(rec, a.previous.from) };
    if (JSON.stringify(next) !== JSON.stringify(a)) setPref('activePlan', next);
  }
  return rec;
}

/** The next Monday after ts (or ts's Monday if it's already Monday at 00:00). */
export function nextMonday(ts = Date.now()) {
  const ws = weekStart(ts);
  return ws + 7 * DAY;
}

/** Week number of the plan since it became active (1 = the first week). */
export function weekNumber(from, now = Date.now()) {
  const f = dateOf(from);
  if (f == null) return 1;
  return Math.max(1, Math.floor((weekStart(now) - weekStart(f)) / (7 * DAY)) + 1);
}

/**
 * This week for a plan: [{ day, routine, minutes, done: session|null }] plus the index of the next one to do.
 * A day counts as done when a session of its routine ended this week.
 */
export function weekStatus(plan, now = Date.now()) {
  const ws = weekStart(now);
  const sess = live('sessions').filter((s) => s.end && s.start >= ws && s.start < ws + 7 * DAY);
  const used = new Set();
  const days = planDays(plan).map((d) => {
    const done = sess.filter((s) => s.routineId === d.routineId && !used.has(s.id)).sort((a, b) => a.start - b.start)[0] || null;
    if (done) used.add(done.id);
    const routine = get('routines', d.routineId);
    return { day: d, routine, minutes: routineMinutes(routine), done };
  });
  const next = days.findIndex((d) => !d.done);
  return { days, next, doneCount: days.filter((d) => d.done).length };
}

export function planMinutes(plan) {
  return planDays(plan).reduce((a, d) => a + routineMinutes(get('routines', d.routineId)), 0);
}

/** Routines that aren't in the given plan. */
export function outsidePlan(plan) {
  const inPlan = new Set(planDays(plan).map((d) => d.routineId));
  return live('routines').filter((r) => !inPlan.has(r.id));
}

const WD_TXT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const restText = (s) => (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s / 60}:00`);
const EQ_TXT = { barbell: 'bilanciere', dumbbell: 'manubri', cable: 'cavi', machine: 'macchina' };

/** The plan as text, in the import format (so it can be shared and imported again). */
export function planToText(plan) {
  const lines = [`WORKOUT: ${plan.name}`];
  if (plan.note) lines.push(`Note: ${plan.note}`);
  for (const d of planDays(plan)) {
    const r = get('routines', d.routineId);
    const wd = Number.isInteger(d.weekday) ? ` @ ${WD_TXT[d.weekday]}` : '';
    const tm = validTime(d.time) ? `${wd ? '' : ' @'} ${d.time}` : '';
    lines.push('', `SCHEDA: ${r.name}${wd}${tm}`);
    for (const it of r.items || []) {
      const ex = get('exercises', it.exerciseId);
      if (!ex) continue;
      let line = ex.name;
      if (ex.type === 'cardio') {
        const ms = measuresFor(ex, machineOf(ex));
        line += ` ${it.targets?.duration ?? 10} min`;
        for (const m of ms) if (m.key !== 'duration' && it.targets?.[m.key] != null && MEASURE_TXT[m.key]) line += ` ${MEASURE_TXT[m.key](it.targets[m.key])}`;
      } else {
        if (ex.type === 'weights' && ex.equipment) line += ` (${EQ_TXT[ex.equipment]})`;
        line += ` ${setsImportText(it, ex.type === 'weights')}`;
        if (it.rest != null) line += ` rec ${restText(it.rest)}`;
      }
      lines.push(line);
      if (ex.notes) for (const n of String(ex.notes).split('\n')) if (n.trim()) lines.push(`- ${n.trim()}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

const MEASURE_TXT = {
  speed: (v) => `${String(v).replace('.', ',')} km/h`,
  incline: (v) => `pendenza ${v}%`,
  level: (v) => `livello ${v}`,
  resistance: (v) => `resistenza ${v}`,
  cadence: (v) => `${v} rpm`,
};

export { state };

// ---- moves: "Sposta a domani" ----
// prefs "moves": [{ routineId, from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', at: ms }], in the order they were made; only this
// week's are kept. Everyday applies them in order on each sync (it moves the block still on `from` to `to`), and the
// moved block comes back through "planned". Palestra uses them for the day it shows. A move is never rewritten once it
// may have been synced: moving again adds an entry, and "Rimetti oggi" adds the reverse one. Only a move that hasn't
// left this device yet is simply taken back.

export function movesThisWeek(now = Date.now()) {
  const ws = isoDate(weekStart(now));
  return (pref('moves', []) || []).filter((m) => m && m.from >= ws);
}

const movesOf = (routineId, now) => movesThisWeek(now).filter((m) => m.routineId === routineId);

/** The weekday (0 = Monday) a plan day falls on this week, after any move. */
export function effectiveWeekday(day, now = Date.now()) {
  const m = movesOf(day.routineId, now).pop();
  if (m) return (new Date(dateOf(m.to)).getDay() + 6) % 7;
  return Number.isInteger(day.weekday) ? day.weekday : null;
}

/** Moved this week, and not back where it started. */
export function isMoved(routineId, now = Date.now()) {
  const ms = movesOf(routineId, now);
  return ms.length > 0 && ms[ms.length - 1].to !== ms[0].from;
}

export function moveToTomorrow(routineId, now = Date.now()) {
  const from = isoDate(now);
  const to = isoDate(dateOf(from) + DAY + 3600000); // +1h guards against a DST day of 23 hours
  setPref('moves', [...movesThisWeek(now), { routineId, from, to, at: now }]);
  return to;
}

/** "Rimetti oggi": take back the last move if it hasn't been synced, otherwise add the move back. */
export function undoMove(routineId, now = Date.now()) {
  const all = movesThisWeek(now);
  const last = all.filter((m) => m.routineId === routineId).pop();
  if (!last) return;
  const synced = (state.meta.lastSync || 0) > (last.at || 0);
  if (!synced) setPref('moves', all.filter((m) => m !== last));
  else setPref('moves', [...all, { routineId, from: last.to, to: last.from, at: now }]);
}

/**
 * Today's routine in the active plan: one not done this week whose weekday (after moves) is today; else null.
 */
export function todayDay(plan, now = Date.now()) {
  const status = weekStatus(plan, now);
  const wd = (new Date(now).getDay() + 6) % 7;
  const i = status.days.findIndex((x) => !x.done && effectiveWeekday(x.day, now) === wd);
  return i >= 0 ? { ...status.days[i], index: i } : null;
}

/** The workouts a routine is in. */
export function plansWith(routineId) {
  return plans().filter((p) => (p.days || []).some((d) => d.routineId === routineId));
}
