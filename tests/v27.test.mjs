// v27: +30 s after the rest is over, superserie, "ho fatto un altro esercizio", the minutes from your real times.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const W = await import('../js/workout.js');
const M = await import('../js/model.js');

const EX = [
  { id: 'a', name: 'Panca piana', type: 'weights', equipment: 'barbell' },
  { id: 'b', name: 'Croci ai cavi', type: 'weights', equipment: 'cable' },
  { id: 'c', name: 'Curl', type: 'weights', equipment: 'barbell' },
  { id: 'd', name: 'Chest press', type: 'weights', equipment: 'machine' },
];

test('+30 s: added while the rest is going, from zero once it is over', () => {
  const r = { id: 'r', items: [{ exerciseId: 'a', sets: 2, reps: 8, weight: 60, rest: 90 }] };
  let w = W.newWorkout(r, EX, { now: 0 });
  w = W.completeStep(w, {}, 10_000);
  assert.equal(W.restLeft(w, 40_000), 60);
  assert.equal(W.restLeft(W.addRest(w, 30, 40_000), 40_000), 90, 'still going: 60 + 30');
  assert.equal(W.restLeft(w, 112_000), -12);
  assert.equal(W.restLeft(W.addRest(w, 30, 112_000), 112_000), 30, 'over by 12 s: 30 from now, not 18');
});

test('superserie: the sets take turns, one rest per round, then the rest before the next exercise', () => {
  const r = { id: 'r', items: [
    { exerciseId: 'a', sets: 2, reps: 8, weight: 60, rest: 120, superset: true },
    { exerciseId: 'b', sets: 2, reps: 12, weight: 15, rest: 60, restAfter: 45 },
    { exerciseId: 'c', sets: 1, reps: 10, weight: 30, rest: 60 },
  ] };
  const steps = W.buildSteps(r, EX);
  assert.deepEqual(steps.map((s) => `${s.exerciseId}${s.n}`), ['a1', 'b1', 'a2', 'b2', 'c1']);
  let w = W.newWorkout(r, EX, { now: 0, training: { between: 100 } });
  w = W.completeStep(w, {}, 1000);
  assert.equal(w.phase, 'work', 'A1 → B1 with no rest');
  assert.equal(W.current(w).exerciseId, 'b');
  w = W.completeStep(w, {}, 2000);
  assert.equal(w.phase, 'rest');
  assert.equal(w.restPlanned, 120, 'after the round, the first exercise\'s rest');
  assert.equal(w.restKind, 'set');
  assert.equal(W.afterLastSet(w), false, 'not "one more?" in the middle of a superserie');
  w = W.endRest(w, 3000); w = W.completeStep(w, {}, 4000); w = W.completeStep(w, {}, 5000);
  assert.equal(w.restKind, 'between');
  assert.equal(w.restPlanned, 45, 'the circle in the builder: 45 s before the next exercise');
  // the estimate rests once per round
  assert.ok(M.estMinutes(r, EX, [], { rest: 90, between: 100 }) < M.estMinutes({ items: r.items.map(({ superset, ...x }) => x) }, EX, [], { rest: 90, between: 100 }));
});

test('ho fatto un altro esercizio: the sets left go to the other one, the done ones stay', () => {
  const r = { id: 'r', items: [{ exerciseId: 'a', sets: 3, reps: 8, weight: 60, rest: 90 }, { exerciseId: 'c', sets: 1, reps: 10, weight: 30 }] };
  let w = W.newWorkout(r, EX, { now: 0 });
  w = W.swapExercise(w, 0, EX[3], { reps: 12, weight: 50 });
  assert.deepEqual(w.steps.map((s) => s.exerciseId), ['d', 'd', 'd', 'c']);
  assert.equal(w.steps[0].swappedFrom, 'a');
  assert.equal(w.steps[0].plan.weight, 50);
  w = W.completeStep(w, {}, 1000);
  assert.equal(w.log[0].exerciseId, 'd', 'logged on the exercise really done');
});

test('the minutes learn from how long the scheda really took', () => {
  const r = { id: 'r', items: [{ exerciseId: 'a', sets: 3, reps: 10, weight: 60, rest: 90 }, { exerciseId: 'c', sets: 3, reps: 10, weight: 30, rest: 90 }] };
  const tr = { rest: 90, between: 120 };
  const base = M.estMinutes(r, EX, [], tr);
  const set = (ex, n) => ({ exerciseId: ex, n, reps: 10, weight: 50, restPlanned: 90 });
  const sess = (i, minutes) => ({ id: `s${i}`, routineId: 'r', start: 1000 * i, end: 1000 * i + 1, minutes, outcome: 'done', sets: [set('a', 1), set('a', 2), set('a', 3), set('c', 1), set('c', 2), set('c', 3)] });
  assert.equal(M.durationFromHistory('r', [], EX, tr).ratio, 1, 'never done: the estimate');
  const one = M.durationFromHistory('r', [sess(1, base * 2)], EX, tr);
  assert.ok(Math.abs(one.ratio - 1.5) < 0.05, `one time twice as long counts half (${one.ratio})`);
  const many = M.durationFromHistory('r', [1, 2, 3, 4].map((i) => sess(i, Math.round(base * 0.8))), EX, tr);
  assert.ok(many.ratio > 0.75 && many.ratio < 0.85, `always 20% faster (${many.ratio})`);
  assert.equal(many.rows[0].start, 4000, 'newest first');
  assert.ok(many.rows[0].weight > many.rows[1].weight, 'the newest weighs more');
  const partial = M.durationFromHistory('r', [{ ...sess(9, 5), outcome: 'partial' }], EX, tr);
  assert.equal(partial.rows.length, 0, 'partial sessions don\'t count');
});
