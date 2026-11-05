// v24: sets that differ, rep ranges, to failure, suggested weights, in più (one more set or exercise).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../js/model.js');
const W = await import('../js/workout.js');
const { parseText } = await import('../js/importer.js');

test('a set\'s plan: equal sets, sets that differ, a range to failure', () => {
  const eq = { sets: 3, reps: 8, weight: 60 };
  assert.deepEqual(M.setPlan(eq, 2), { reps: 8, seconds: null, weight: 60, repsMax: null, failure: false });
  const pyr = { sets: 3, reps: 8, weight: 10, perSet: [{ reps: 8, weight: 10 }, { reps: 6, weight: 12 }, { reps: 4, weight: 14 }] };
  assert.equal(M.setsOf(pyr), 3);
  assert.deepEqual([M.setPlan(pyr, 3).reps, M.setPlan(pyr, 3).weight], [4, 14]);
  assert.equal(M.setsText(pyr), '8/6/4 × 10/12/14 kg');
  const r = { sets: 3, reps: 8, repsMax: 12, weight: 45, failure: 'last' };
  assert.equal(M.setsText(r), '3 × 8–12 · 45 kg');
  assert.equal(M.setPlan(r, 2).failure, false);
  assert.equal(M.setPlan(r, 3).failure, true);
  assert.equal(M.setsImportText(r), '3x8-12 45 kg ultima a cedimento');
  assert.equal(M.setsImportText(pyr), '8/6/4 x 10/12/14');
});

test('itemFromRows folds equal rows back', () => {
  assert.equal(M.itemFromRows({ exerciseId: 'a' }, [{ reps: 8, weight: 60 }, { reps: 8, weight: 60 }]).perSet, undefined);
  const it = M.itemFromRows({ exerciseId: 'a' }, [{ reps: 10, weight: 100 }, { reps: 10, weight: 100 }, { reps: 11, weight: 100 }]);
  assert.equal(it.sets, 3);
  assert.equal(it.perSet.length, 3);
});

test('import: slashes, ranges, failure', () => {
  const { data, issues } = parseText('SCHEDA: x\nCurl con bilanciere 8/6/4 x 10/12/14\nCurl 3x8 10/12/14 kg\nLeg press 12/10/8 x 100\nChest press 3x8-12 cedimento\nSquat 8/6 x 60/70/80');
  const [a, b, c, d, e] = data.routines[0].items;
  assert.deepEqual(a.perSet.map((x) => [x.reps, x.weight]), [[8, 10], [6, 12], [4, 14]]);
  assert.deepEqual(b.perSet.map((x) => x.weight), [10, 12, 14]);
  assert.deepEqual(c.perSet.map((x) => x.reps), [12, 10, 8]);
  assert.deepEqual([d.reps, d.repsMax, d.failure], [8, 12, 'all']);
  assert.equal(e.perSet.length, 2);
  assert.equal(issues[0].reason, 'perSetMismatch');
});

test('the weekly increase: a pyramid moves as a whole; a range goes up at the top', () => {
  const pyr = { exerciseId: 'c', sets: 3, reps: 8, weight: 10, perSet: [{ reps: 8, weight: 10 }, { reps: 6, weight: 12 }, { reps: 4, weight: 14 }] };
  const up = M.applyIncrease({ items: [pyr] }, [{ itemIndex: 0, field: 'weight', from: 10, to: 12.5 }], [0]);
  assert.deepEqual(up.items[0].perSet.map((x) => x.weight), [12.5, 14.5, 16.5]);
  const ex = { id: 'p', type: 'weights', equipment: 'machine' };
  const item = { exerciseId: 'p', sets: 2, reps: 8, repsMax: 12, weight: 40 };
  const sess = (reps) => [{ id: 's', start: 1, end: 2, sets: reps.map((n) => ({ exerciseId: 'p', reps: n, weight: 40 })) }];
  assert.equal(M.lastResult(item, ex, sess([12, 10]), 10).complete, false);
  assert.equal(M.lastResult(item, ex, sess([12, 12]), 10).complete, true);
  const props = M.increaseProposals({ autoIncrease: true, items: [item] }, [ex], sess([12, 11]), { when: 'complete', steps: {} }, 10);
  assert.equal(props.held[0].short.kind, 'top');
});

test('a starting weight from the body', () => {
  const body = { kg: 75, cm: 178, sex: 'm', level: 'months' };
  assert.equal(M.suggestWeight({ type: 'weights', name: 'Chest press', equipment: 'machine' }, body), 35);
  assert.equal(M.suggestWeight({ type: 'weights', name: 'Panca piana', equipment: 'barbell' }, body), 35);
  assert.equal(M.suggestWeight({ type: 'weights', name: 'Qualcosa di strano', equipment: 'machine' }, body), null);
  assert.equal(M.suggestWeight({ type: 'weights', name: 'Chest press', equipment: 'machine' }, null), null);
});

test('in più: one more set after the last, an exercise, the end', () => {
  const exs = [{ id: 'a', name: 'A', type: 'weights' }, { id: 'b', name: 'B', type: 'weights' }];
  let w = W.newWorkout({ id: 'r', items: [{ exerciseId: 'a', sets: 1, reps: 8, weight: 20 }] }, exs, { now: 0 });
  w = W.completeStep(w, { reps: 9, weight: 20 }, 10_000);
  assert.equal(w.restKind, 'end');
  assert.ok(W.afterLastSet(w));
  w = W.addSet(w);
  assert.deepEqual(w.steps.map((s) => [s.n, s.of, Boolean(s.extra)]), [[1, 2, false], [2, 2, true]]);
  assert.equal(w.steps[1].plan.reps, 9);
  w = W.removeAddedSet(w);
  assert.equal(w.steps.length, 1);
  w = W.addExercise(w, exs[1], { reps: 10, weight: 30 });
  assert.equal(w.steps[1].added, 0);
  w = W.endRest(w, 20_000);
  assert.equal(W.current(w).exerciseId, 'b');
  w = W.completeStep(w, {}, 30_000);
  w = W.endRest(w, 31_000);
  assert.equal(w.phase, 'done');
  assert.equal(W.toSession(w, 31_000).sets.length, 2);
  assert.equal(W.toSession(w, 31_000).sets[0].item, undefined, 'the session doesn\'t carry the item index');
});
