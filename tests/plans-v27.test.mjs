import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pref, upsert, live } from '../js/store.js';
import { activate, planDays, abWeek, savePlan, refreshActiveWeek, rotationNext, todayDay, planToText } from '../js/plans.js';
import { parseText, runImport } from '../js/importer.js';

const MON = new Date(2026, 10, 2, 9).getTime();
const WEEK = 7 * 86400000;

test('A · B weeks: this week\'s days, counted from activation; Everyday gets them and a new week rewrites them', () => {
  upsert('exercises', { id: 'e1', name: 'Panca piana', type: 'weights', equipment: 'barbell', muscles: [] });
  for (const [id, name] of [['a1', 'Petto'], ['a2', 'Gambe'], ['a3', 'Full']]) upsert('routines', { id, name, items: [{ exerciseId: 'e1', sets: 3, reps: 10, rest: 90 }] });
  const plan = upsert('plans', { id: 'pab', name: 'Alterne', mode: 'ab', days: [{ routineId: 'a1', weekday: 0, week: 0 }, { routineId: 'a2', weekday: 3, week: 0 }, { routineId: 'a3', weekday: 1, week: 1 }] });
  activate(plan, '2026-11-02');
  assert.equal(abWeek(plan, MON), 0);
  assert.equal(abWeek(plan, MON + WEEK), 1);
  assert.deepEqual(planDays(plan, MON).map((d) => d.routineId), ['a1', 'a2']);
  assert.deepEqual(planDays(plan, MON + WEEK).map((d) => d.routineId), ['a3']);
  const rec = pref('activePlan', null);
  assert.equal(rec.mode, 'ab');
  refreshActiveWeek(MON + WEEK);
  const next = pref('activePlan', null);
  assert.equal(next.weekOf, '2026-11-09');
  assert.deepEqual(next.days, [{ routineId: 'a3', weekday: 1 }]);
  assert.equal(next.from, '2026-11-02');
});

test('rotation: no fixed days, the next after the last one done, rest days after it', () => {
  const plan = savePlan({ id: 'prot', name: 'Giro', mode: 'rotation', days: [{ routineId: 'a1', weekday: 0, restDays: 1 }, { routineId: 'a2', weekday: 2 }, { routineId: 'a3', weekday: null }] });
  activate(plan, '2026-11-02');
  assert.ok(pref('activePlan', null).days.every((d) => d.weekday === null));
  assert.equal(rotationNext(plan), 0);
  upsert('sessions', { id: 's1', routineId: 'a1', start: MON, end: MON + 3600000, outcome: 'done' });
  assert.equal(rotationNext(plan), 1);
  const td = todayDay(plan, MON + 86400000);
  assert.equal(td.routine.id, 'a2');
  assert.ok(td.tooSoon, 'one rest day after Petto: Tuesday is too soon');
  assert.ok(!todayDay(plan, MON + 2 * 86400000).tooSoon);
});

test('export and import keep the shape: A · B, a scheda on two days, rest days', () => {
  const plan = upsert('plans', { id: 'px', name: 'Forma', mode: 'ab', days: [{ routineId: 'a1', weekday: 0, week: 0, time: '18:00' }, { routineId: 'a1', weekday: 2, week: 1 }, { routineId: 'a2', weekday: 4, week: 1 }] });
  const txt = planToText(plan);
  assert.match(txt, /Modo: settimane alterne/);
  assert.match(txt, /SCHEDA: Petto @ A lun 18:00/);
  assert.match(txt, /SCHEDA: Petto @ B mer/);
  const { data, error } = parseText(txt);
  assert.ok(!error, error);
  assert.equal(data.routines.length, 2, 'Petto once, with a second day');
  assert.equal(data.plan.mode, 'ab');
  const n = live('plans').length;
  const res = runImport(data, { asPlan: true });
  const made = live('plans').find((p) => p.id === res.planId);
  assert.equal(live('plans').length, n + 1);
  assert.equal(made.mode, 'ab');
  assert.deepEqual(made.days.map((d) => [d.weekday, d.week, d.time ?? null]), [[0, 0, '18:00'], [2, 1, null], [4, 1, null]]);
  assert.equal(made.days[0].routineId, made.days[1].routineId);
});
