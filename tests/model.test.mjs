import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estMinutes, increaseProposals, applyIncrease, isoWeek, secPerRep, measuresFor, progressOf, plannedAhead,
} from '../js/model.js';
import {
  newWorkout, completeStep, endRest, skipStep, pause, resume, toSession, elapsedSec, restLeft, activeMs,
} from '../js/workout.js';

const EX = [
  { id: 'lp', name: 'Leg press', type: 'weights', equipment: 'machine' },
  { id: 'db', name: 'Curl', type: 'weights', equipment: 'dumbbell' },
  { id: 'pl', name: 'Plank', type: 'bodyweight' },
  { id: 'pu', name: 'Piegamenti', type: 'bodyweight' },
  { id: 'tr', name: 'Tapis roulant', type: 'cardio', cardio: { kind: 'treadmill' } },
  { id: 'off', name: 'Calf', type: 'weights', equipment: 'machine', increase: { mode: 'off' } },
];

const R = {
  id: 'r1', name: 'Gambe', autoIncrease: true, restBetween: 120,
  items: [
    { exerciseId: 'tr', targets: { duration: 10, speed: 9, incline: 1 } },
    { exerciseId: 'lp', sets: 4, reps: 10, weight: 117.5, rest: 90 },
    { exerciseId: 'db', sets: 3, reps: 12, weight: 10, rest: 60 },
    { exerciseId: 'pl', sets: 3, seconds: 45, rest: 30 },
    { exerciseId: 'pu', sets: 3, reps: 12, rest: 60 },
    { exerciseId: 'off', sets: 4, reps: 15, weight: 50, rest: 45 },
  ],
};

const day = (d, h = 18) => new Date(2026, 9, d, h).getTime();

function session(start, sets) {
  return { id: `s${start}`, routineId: 'r1', start, end: start + 3000000, sets };
}

test('estimated minutes: sets, rests, between, cardio', () => {
  const r = { items: [{ exerciseId: 'lp', sets: 4, reps: 10, rest: 90 }, { exerciseId: 'tr', targets: { duration: 10 } }], restBetween: 120 };
  // 4×30 s + 3×90 s + 120 + 600 = 1110 s → 19 min
  assert.equal(estMinutes(r, EX, []), 19);
  assert.equal(estMinutes({ items: [] }, EX, []), 0);
});

test('seconds per rep learns after a few sets', () => {
  const s = session(day(1), Array.from({ length: 6 }, (_, i) => ({ exerciseId: 'lp', n: i + 1, reps: 10, weight: 100, dur: 50 })));
  assert.equal(secPerRep('lp', []), 3);
  assert.equal(secPerRep('lp', [s]), 5);
});

test('increase: proposes per type, holds incomplete, skips excluded and timed', () => {
  const last = session(day(27), [
    { exerciseId: 'tr', n: 1, targets: { duration: 10 } },
    ...[1, 2, 3, 4].map((n) => ({ exerciseId: 'lp', n, reps: 10, weight: 117.5 })),
    ...[1, 2, 3].map((n) => ({ exerciseId: 'db', n, reps: n === 3 ? 9 : 12, weight: 10 })),
    ...[1, 2, 3].map((n) => ({ exerciseId: 'pu', n, reps: 12 })),
  ]);
  const out = increaseProposals(R, EX, [last], undefined, day(29));
  const by = Object.fromEntries(out.proposals.map((p) => [p.exerciseId, p]));
  assert.equal(by.tr.to, 11);
  assert.equal(by.lp.to, 120);
  assert.equal(by.pu.to, 13);
  assert.equal(by.db, undefined);
  assert.deepEqual(out.held.map((h) => h.exerciseId), ['db']);
  assert.equal(out.held[0].short.kind, 'reps');
  assert.deepEqual(out.excluded, ['off']);
  assert.deepEqual(out.timed, ['pl']);

  const always = increaseProposals(R, EX, [last], { when: 'always' }, day(29));
  assert.equal(always.proposals.find((p) => p.exerciseId === 'db').to, 11);

  const applied = applyIncrease(R, out.proposals, [1], day(29));
  assert.equal(applied.items[1].weight, 120);
  assert.equal(applied.items[0].targets.duration, 10);
  assert.equal(applied.increaseWeek, isoWeek(new Date(day(29))));
  assert.equal(increaseProposals(applied, EX, [last], undefined, day(30)), null, 'asked once a week');
  assert.equal(increaseProposals({ ...R, autoIncrease: false }, EX, [last], undefined, day(29)), null);
});

test('increase waits until the new weight has been tried', () => {
  const last = session(day(27), [1, 2, 3, 4].map((n) => ({ exerciseId: 'lp', n, reps: 10, weight: 115 })));
  const out = increaseProposals(R, EX, [last], undefined, day(29));
  assert.equal(out.proposals.find((p) => p.exerciseId === 'lp'), undefined);
});

test('custom machine measures', () => {
  const m = { id: 'm', measures: ['watt', { key: 'c_programma', label: 'Programma', unit: '' }] };
  const ms = measuresFor({ cardio: { kind: 'custom' } }, m).map((x) => x.key);
  assert.deepEqual(ms, ['duration', 'watt', 'c_programma']);
  assert.deepEqual(measuresFor({ cardio: { kind: 'bike' } }).map((x) => x.key), ['duration', 'level', 'cadence']);
});

test('workout: sets, rests, between, pause, session', () => {
  const r = { id: 'r1', restBetween: 120, items: [{ exerciseId: 'lp', sets: 2, reps: 10, weight: 100, rest: 90 }, { exerciseId: 'tr', targets: { duration: 10 } }] };
  const t0 = day(5);
  let w = newWorkout(r, EX, { now: t0, blockId: 'b1' });
  assert.equal(w.steps.length, 3);
  w = completeStep(w, { reps: 10, weight: 102.5 }, t0 + 30000);
  assert.equal(w.phase, 'rest');
  assert.equal(w.restPlanned, 90);
  assert.equal(w.steps[1].plan.weight, 102.5, 'next set starts from the weight just used');
  assert.equal(restLeft(w, t0 + 60000), 60);
  w = endRest(w, t0 + 130000);
  assert.equal(w.log[0].restTaken, 100);
  w = pause(w, t0 + 140000);
  w = resume(w, t0 + 200000);
  w = completeStep(w, {}, t0 + 230000);
  assert.equal(w.log[1].dur, 40, 'pause not counted in the set');
  assert.equal(w.restKind, 'between');
  assert.equal(w.restPlanned, 120);
  w = endRest(w, t0 + 350000);
  w = completeStep(w, { targets: { speed: 10 }, distance: '1,6'.replace(',', '.') }, t0 + 950000);
  assert.equal(w.phase, 'done');
  const s = toSession(w, t0 + 960000);
  assert.equal(s.outcome, 'done');
  assert.equal(s.everydayBlockId, 'b1');
  assert.equal(s.breakdown.pause, 60);
  assert.equal(s.breakdown.walk, 120);
  assert.equal(s.sets[2].targets.speed, 10);
  assert.equal(s.sets[2].distance, 1.6);
  assert.equal(s.minutes, 15);
  assert.equal(elapsedSec(w, t0 + 960000), 900);
});

test('workout ended early is partial; skipped sets are not logged', () => {
  const r = { id: 'r1', items: [{ exerciseId: 'lp', sets: 3, reps: 10, weight: 100, rest: 90 }] };
  let w = newWorkout(r, EX, { now: 0 });
  w = skipStep(w, 1000);
  assert.equal(w.idx, 1);
  assert.equal(toSession(w, 60000).outcome, 'partial');
  assert.equal(activeMs(0, 100, [{ from: 10, to: 30 }, { from: 90, to: 200 }]), 70);
});

test('progress and planned', () => {
  const ss = [session(day(1), [{ exerciseId: 'lp', reps: 10, weight: 100 }]), session(day(8), [{ exerciseId: 'lp', reps: 10, weight: 105 }])];
  assert.deepEqual(progressOf(EX[0], ss).map((p) => p.value), [100, 105]);
  const plan = plannedAhead([{ blockId: 'a', routineId: 'r1', date: '2026-11-05', start: '18:00' }, { blockId: 'b', routineId: 'r1', date: '2026-10-01', start: '18:00' }], new Date(2026, 10, 1).getTime());
  assert.deepEqual(plan.map((p) => p.blockId), ['a']);
});
