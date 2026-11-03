// Going back a step during a workout: reopen the set just done, or the previous one, with its values kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.indexedDB ??= undefined; // store.js is only imported, not used
const W = await import('../js/workout.js');

const exercises = [{ id: 'sq', name: 'Squat', type: 'weights' }, { id: 'pl', name: 'Plank', type: 'bodyweight' }];
const routine = { id: 'r', items: [{ exerciseId: 'sq', sets: 2, reps: 8, weight: 60, rest: 90 }, { exerciseId: 'pl', sets: 1, seconds: 45 }] };
const T0 = 1_000_000;

test('back during a rest reopens the set with what was entered', () => {
  let w = W.newWorkout(routine, exercises, { now: T0 });
  assert.equal(W.canGoBack(w), false);
  w = W.completeStep(w, { reps: 7, weight: 62.5 }, T0 + 60_000);
  assert.equal(w.phase, 'rest');
  assert.equal(W.canGoBack(w), true);
  const b = W.back(w, T0 + 70_000);
  assert.equal(b.phase, 'work');
  assert.equal(b.idx, 0);
  assert.equal(b.log.length, 0);
  assert.equal(b.breakdown.work, 0);
  assert.deepEqual([b.steps[0].plan.reps, b.steps[0].plan.weight], [7, 62.5]);
});

test('back during a set goes to the previous one; a skipped set comes back as planned', () => {
  let w = W.newWorkout(routine, exercises, { now: T0 });
  w = W.completeStep(w, { reps: 8, weight: 60 }, T0 + 60_000);
  w = W.endRest(w, T0 + 150_000);
  assert.equal(w.idx, 1);
  let b = W.back(w, T0 + 160_000);
  assert.equal(b.idx, 0);
  assert.equal(b.log.length, 0);
  // skip the second squat set, then go back to it
  w = W.skipStep(w, T0 + 160_000);
  assert.equal(w.idx, 2);
  b = W.back(w, T0 + 170_000);
  assert.equal(b.idx, 1);
  assert.equal(b.log.length, 1, 'the first set stays logged');
  assert.equal(b.steps[1].plan.reps, 8);
});

test('no going back while paused', () => {
  let w = W.newWorkout(routine, exercises, { now: T0 });
  w = W.completeStep(w, {}, T0 + 60_000);
  w = W.pause(w, T0 + 61_000);
  assert.equal(W.canGoBack(w), false);
  assert.equal(W.back(w), w);
});

const three = { id: 'r3', items: [{ exerciseId: 'sq', sets: 2, reps: 8, weight: 60 }, { exerciseId: 'pl', sets: 1, seconds: 45 }, { exerciseId: 'cu', sets: 2, reps: 10, weight: 12 }] };
const ex3 = [...exercises, { id: 'cu', name: 'Curl', type: 'weights', equipment: 'dumbbell' }];

test('Fallo adesso during a set: that exercise comes now, the rest keeps its order', () => {
  let w = W.newWorkout(three, ex3, { now: T0 });
  w = W.completeStep(w, {}, T0 + 60_000);
  w = W.endRest(w, T0 + 120_000); // squat set 2 now
  const d = W.doNow(w, 2, T0 + 130_000);
  assert.deepEqual(d.steps.map((s) => `${s.exerciseId}${s.n}`), ['sq1', 'cu1', 'cu2', 'sq2', 'pl1']);
  assert.equal(d.idx, 1);
  assert.equal(W.current(d).exerciseId, 'cu');
});

test('Fallo adesso during a rest: it comes after the rest; a skipped exercise can come back', () => {
  let w = W.newWorkout(three, ex3, { now: T0 });
  w = W.skipStep(w, T0); w = W.skipStep(w, T0); // both squat sets skipped
  w = W.completeStep(w, {}, T0 + 60_000); // plank done, rest before the curls
  const d = W.doNow(w, 0, T0 + 70_000);
  assert.deepEqual(d.steps.map((s) => `${s.exerciseId}${s.n}`), ['pl1', 'sq1', 'sq2', 'cu1', 'cu2']);
  assert.equal(d.phase, 'rest');
  assert.equal(W.current(d).exerciseId, 'pl');
  assert.equal(W.endRest(d, T0 + 200_000).steps[W.endRest(d, T0 + 200_000).idx].exerciseId, 'sq');
});

test('Correggi i numeri changes a logged set', () => {
  let w = W.newWorkout(three, ex3, { now: T0 });
  w = W.completeStep(w, { reps: 8, weight: 60 }, T0 + 60_000);
  const e = W.editLog(w, [{ i: 0, reps: 6, weight: 62.5 }]);
  assert.deepEqual([e.log[0].reps, e.log[0].weight], [6, 62.5]);
});
