// v32: after an exercise, what to do next time (more weight, more reps / seconds / minutes, or the same).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextOptions, nextItem, applyNext, increaseProposals, setPlan, DEFAULT_INCREASE } from '../js/model.js';
import { newWorkout, completeStep, justFinished, setNext, endRest } from '../js/workout.js';

const bench = { id: 'b', name: 'Panca', type: 'weights', equipment: 'barbell' };
const db = { id: 'd', name: 'Curl', type: 'weights', equipment: 'dumbbell' };
const plank = { id: 'p', name: 'Plank', type: 'bodyweight' };
const pushup = { id: 'u', name: 'Piegamenti', type: 'bodyweight' };
const bike = { id: 'k', name: 'Cyclette', type: 'cardio' };
const exercises = [bench, db, plank, pushup, bike];

test('the choices: weights get kg and reps, timed sets seconds, cardio minutes; same is last', () => {
  const keys = (it, ex) => nextOptions(it, ex).map((o) => `${o.key}:${o.field || ''}:${o.by ?? ''}`);
  assert.deepEqual(keys({ exerciseId: 'b', sets: 3, reps: 10, weight: 50 }, bench), ['weight:weight:2.5', 'more:reps:1', 'same::']);
  assert.deepEqual(keys({ exerciseId: 'd', sets: 3, reps: 10, weight: 12 }, db), ['weight:weight:1', 'more:reps:1', 'same::']);
  assert.deepEqual(keys({ exerciseId: 'p', sets: 3, seconds: 45 }, plank), ['more:seconds:5', 'same::']);
  assert.deepEqual(keys({ exerciseId: 'u', sets: 3, reps: 12 }, pushup), ['more:reps:1', 'same::']);
  assert.deepEqual(keys({ exerciseId: 'k', targets: { duration: 10 } }, bike), ['more:duration:1', 'same::']);
  // the exercise's own step wins
  assert.equal(nextOptions({ sets: 3, reps: 10, weight: 50 }, { ...bench, increase: { mode: 'custom', step: 5 } })[0].to, 55);
  // the steps from Impostazioni
  assert.equal(nextOptions({ sets: 3, reps: 10, weight: 50 }, bench, { ...DEFAULT_INCREASE, steps: { barbell: 2 } })[0].to, 52);
});

test('the item next time: a pyramid moves as a whole, a rep range too, cardio minutes', () => {
  const pyr = { exerciseId: 'b', sets: 3, reps: 8, weight: 40, perSet: [{ reps: 8, weight: 40 }, { reps: 6, weight: 45 }, { reps: 4, weight: 50 }] };
  const up = nextItem(pyr, bench, 'weight');
  assert.deepEqual(up.perSet.map((x) => x.weight), [42.5, 47.5, 52.5]);
  const more = nextItem(pyr, bench, 'more');
  assert.deepEqual(more.perSet.map((x) => x.reps), [9, 7, 5]);
  const range = nextItem({ exerciseId: 'b', sets: 3, reps: 8, repsMax: 12, weight: 40 }, bench, 'more');
  assert.equal(range.reps, 9); assert.equal(range.repsMax, 13);
  assert.equal(nextItem({ exerciseId: 'p', sets: 3, seconds: 45 }, plank, 'more').seconds, 50);
  assert.equal(nextItem({ exerciseId: 'k', targets: { duration: 10, level: 6 } }, bike, 'more').targets.duration, 11);
  assert.equal(nextItem({ exerciseId: 'k', targets: { duration: 10, level: 6 } }, bike, 'more').targets.level, 6);
  const same = { exerciseId: 'b', sets: 3, reps: 10, weight: 50 };
  assert.deepEqual(nextItem(same, bench, 'same'), same);
});

test('applyNext changes only the chosen items and marks them, so the weekly increase skips them once', () => {
  const r = { id: 'r', name: 'A', autoIncrease: true, items: [{ exerciseId: 'b', sets: 3, reps: 10, weight: 50 }, { exerciseId: 'u', sets: 3, reps: 12 }, { exerciseId: 'd', sets: 3, reps: 10, weight: 12 }] };
  const t0 = new Date(2026, 10, 9, 18).getTime();
  const n = applyNext(r, exercises, { 0: 'weight', 1: 'same' }, DEFAULT_INCREASE, t0);
  assert.equal(setPlan(n.items[0], 1).weight, 52.5);
  assert.equal(n.items[0].pickedAt, t0);
  assert.equal(n.items[1].reps, 12); assert.equal(n.items[1].pickedAt, t0);
  assert.equal(n.items[2].weight, 12); assert.equal(n.items[2].pickedAt, undefined);
  // the session where they answered, complete
  const sets = (id, reps, w, k = 3) => Array.from({ length: k }, (_, i) => ({ exerciseId: id, n: i + 1, reps, ...(w != null ? { weight: w } : {}) }));
  const s1 = { id: 's1', routineId: 'r', start: t0, end: t0 + 3600000, sets: [...sets('b', 10, 50), ...sets('u', 12), ...sets('d', 10, 12)] };
  const nextWeek = t0 + 7 * 86400000;
  const props = increaseProposals(n, exercises, [s1], DEFAULT_INCREASE, nextWeek);
  assert.deepEqual(props.proposals.map((p) => p.exerciseId), ['d'], 'the answered ones are left alone');
  // once done again, the weekly increase is back for them
  const s2 = { id: 's2', routineId: 'r', start: nextWeek - 86400000, end: nextWeek - 86400000 + 3600000, sets: [...sets('b', 10, 52.5), ...sets('u', 12), ...sets('d', 10, 13)] };
  const later = increaseProposals({ ...n, increaseWeek: null }, exercises, [s1, s2], DEFAULT_INCREASE, nextWeek + 7 * 86400000);
  assert.ok(later.proposals.some((p) => p.exerciseId === 'b'));
  assert.ok(later.proposals.some((p) => p.exerciseId === 'u'));
});

test('the workout asks after the last set of an exercise, after a superserie round, and after cardio', () => {
  const r = { id: 'r', name: 'A', items: [
    { exerciseId: 'k', targets: { duration: 5 } },
    { exerciseId: 'b', sets: 2, reps: 10, weight: 50, rest: 60 },
    { exerciseId: 'd', sets: 2, reps: 10, weight: 12, rest: 60, superset: true },
    { exerciseId: 'u', sets: 2, reps: 12, rest: 60 },
  ] };
  let w = newWorkout(r, exercises, { now: 0 });
  assert.deepEqual(justFinished(w), [], 'not during a set');
  w = completeStep(w, {}, 1000); // cardio
  assert.deepEqual(justFinished(w), [0]);
  w = endRest(w, 2000);
  w = completeStep(w, {}, 3000); // bench 1
  assert.deepEqual(justFinished(w), [], 'not between sets');
  w = endRest(w, 4000);
  w = completeStep(w, {}, 5000); // bench 2
  assert.deepEqual(justFinished(w), [1]);
  w = setNext(w, 1, 'weight');
  assert.deepEqual(w.next, { 1: 'weight' });
  w = setNext(w, 1, null);
  assert.deepEqual(w.next, {});
  w = endRest(w, 6000);
  // superserie: curl 1, push-up 1, rest, curl 2, push-up 2
  w = completeStep(w, {}, 7000);
  w = completeStep(w, {}, 8000);
  assert.deepEqual(justFinished(w), []);
  w = endRest(w, 9000);
  w = completeStep(w, {}, 10000);
  w = completeStep(w, {}, 11000);
  assert.deepEqual(justFinished(w), [2, 3], 'both exercises of the superserie');
  assert.equal(w.restKind, 'end');
});
