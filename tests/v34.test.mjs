// v34: an exercise skipped for today or put off until later, one more set of a finished one, and the rest that
// keeps running when the exercise that comes next is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.indexedDB ??= undefined; // store.js is only imported, not used
const W = await import('../js/workout.js');

const ex = [{ id: 'cu', name: 'Curl', type: 'weights' }, { id: 'cr', name: 'Crunch', type: 'weights' }, { id: 'pl', name: 'Plank', type: 'bodyweight' }, { id: 'ro', name: 'Row', type: 'weights' }];
const routine = { id: 'r', items: [{ exerciseId: 'cu', sets: 2, reps: 10, weight: 12, rest: 60 }, { exerciseId: 'cr', sets: 3, reps: 15, weight: 30 }, { exerciseId: 'pl', sets: 1, seconds: 45 }, { exerciseId: 'ro', sets: 2, reps: 8, weight: 40 }] };
const T0 = 1_000_000;
const sec = (n) => T0 + n * 1000;
const order = (w) => w.steps.map((s) => `${s.exerciseId}${s.n}`).join(' ');
/** Both curl sets done; the rest before the crunches started at 200 s (120 s planned). */
function afterCurls() {
  let w = W.newWorkout(routine, ex, { now: T0 });
  w = W.completeStep(w, {}, sec(60));
  w = W.endRest(w, sec(120));
  return W.completeStep(w, {}, sec(200));
}

test('from the rest, the next exercise is skipped: the rest goes on, with the one after', () => {
  const w = afterCurls();
  assert.equal(w.restKind, 'between');
  const s = W.skipExercise(w, 1, sec(210));
  assert.equal(s.phase, 'rest');
  assert.equal(s.phaseStart, w.phaseStart, 'the same rest, not a new one');
  assert.equal(W.restLeft(s, sec(210)), 110);
  assert.equal(s.steps[s.idx + 1].exerciseId, 'pl');
  assert.equal(order(s), order(w), 'nothing moves: the crunches are left behind');
  assert.deepEqual(W.notDone(s).map((o) => [o.itemIndex, o.left]), [[1, 3], [2, 1], [3, 2]]);
  assert.equal(W.afterLastSet(s), false, 'no "another set?" about a skipped exercise');
  const go = W.endRest(s, sec(330));
  assert.equal(W.current(go).exerciseId, 'pl');
  assert.equal(go.log[1].restTaken, 130, 'the rest is the curls\' rest');
  // back from that rest undoes the skip: the first crunch set
  const b = W.back(s, sec(215));
  assert.equal(`${W.current(b).exerciseId}${W.current(b).n}`, 'cr1');
  assert.equal(b.log.length, 2);
});

test('on its set screen, skipping an exercise picks the rest up again while it has time left', () => {
  let w = afterCurls();
  w = W.endRest(w, sec(230)); // Salta after 30 s of 120
  assert.equal(w.breakdown.walk, 30);
  const s = W.skipExercise(w, 1, sec(240));
  assert.equal(s.phase, 'rest');
  assert.equal(W.restLeft(s, sec(240)), 80, '120 planned, 40 gone since the last curl');
  assert.equal(s.breakdown.walk, 0, 'counted once, when it really ends');
  assert.equal(s.steps[s.idx + 1].exerciseId, 'pl');
  const go = W.endRest(s, sec(320));
  assert.equal(go.breakdown.walk, 120);
  assert.equal(go.log[1].restTaken, 120);
  // the same for one set skipped, and for an exercise put off
  assert.equal(W.skipStep(w, sec(240)).phase, 'rest');
  assert.equal(W.skipStep(w, sec(240)).steps[W.skipStep(w, sec(240)).idx + 1].n, 2);
  assert.equal(W.later(w, 1, 'end', sec(240)).phase, 'rest');
  // once the rest is over there is nothing to wait for: straight to the next exercise
  const late = W.skipExercise(w, 1, sec(400));
  assert.equal(late.phase, 'work');
  assert.equal(W.current(late).exerciseId, 'pl');
  // and not after a set of it was done
  let d = W.completeStep(w, {}, sec(260));
  d = W.endRest(d, sec(270));
  const s2 = W.skipExercise(d, 1, sec(275));
  assert.equal(s2.phase, 'rest', 'the rest after that set, 90 s by default');
  assert.equal(s2.restKind, 'between');
  assert.equal(s2.steps[s2.idx + 1].exerciseId, 'pl');
});

test('put off: after the next exercise, or at the end', () => {
  const w = afterCurls();
  assert.deepEqual(W.comingAfter(w, 1), [2, 3]);
  const n = W.later(w, 1, 'next', sec(210));
  assert.equal(order(n), 'cu1 cu2 pl1 cr1 cr2 cr3 ro1 ro2');
  assert.equal(n.phase, 'rest');
  assert.equal(n.idx, w.idx);
  assert.equal(n.phaseStart, w.phaseStart);
  const e = W.later(w, 1, 'end', sec(210));
  assert.equal(order(e), 'cu1 cu2 pl1 ro1 ro2 cr1 cr2 cr3');
  assert.ok(e.steps.slice(-3).every((s) => s.later));
  // during a set: the sets not done move, the one done stays
  let x = W.endRest(w, sec(330));
  x = W.completeStep(x, {}, sec(380));
  x = W.endRest(x, sec(480)); // crunch set 2, its rest (90 s) over
  const m = W.later(x, 1, 'next', sec(600));
  assert.equal(order(m), 'cu1 cu2 cr1 pl1 cr2 cr3 ro1 ro2');
  assert.equal(m.phase, 'work');
  assert.equal(W.current(m).exerciseId, 'pl');
  // sooner, the rest becomes the longer one between exercises (120 s since the crunch set): 10 s to go
  const soon = W.later(x, 1, 'next', sec(490));
  assert.deepEqual([soon.phase, soon.restKind, W.restLeft(soon, sec(490))], ['rest', 'between', 10]);
  // the last exercise has nowhere to go
  let l = W.later(w, 1, 'end', sec(210));
  l = W.skipExercise(l, 2, sec(211));
  l = W.skipExercise(l, 3, sec(212));
  assert.equal(l.steps[l.idx + 1].exerciseId, 'cr');
  assert.equal(W.later(l, 1, 'next', sec(213)), l);
});

test('put off during its own rest: it isn\'t finished, so no questions about it', () => {
  let w = W.newWorkout(routine, ex, { now: T0 });
  w = W.completeStep(w, {}, sec(60)); // curl 1, rest of 60 s before curl 2
  const n = W.later(w, 0, 'next', sec(70));
  assert.equal(order(n), 'cu1 cr1 cr2 cr3 cu2 pl1 ro1 ro2');
  assert.equal(n.restKind, 'between');
  assert.equal(n.restPlanned, 120);
  assert.equal(W.afterLastSet(n), false);
  assert.deepEqual(W.justFinished(n), []);
  assert.equal(W.addSet(n), n);
});

test('skipping the last exercise leads to the end screen, where it can come back', () => {
  let w = afterCurls();
  w = W.skipExercise(w, 1, sec(210));
  w = W.skipExercise(w, 2, sec(211));
  w = W.skipExercise(w, 3, sec(212));
  assert.equal(w.phase, 'rest');
  assert.equal(w.restKind, 'end');
  assert.deepEqual(W.notDone(w).map((o) => o.itemIndex), [1, 2, 3]);
  const d = W.doNow(w, 2, sec(220));
  assert.equal(d.restKind, 'between');
  assert.equal(d.steps[d.idx + 1].exerciseId, 'pl');
  assert.equal(W.endRest(w, sec(230)).phase, 'done');
  // set by set, from a set screen, too
  let s = W.newWorkout({ id: 'one', items: [routine.items[0]] }, ex, { now: T0 });
  s = W.completeStep(s, {}, sec(60));
  s = W.endRest(s, sec(200));
  s = W.skipStep(s, sec(210));
  assert.equal(s.phase, 'rest');
  assert.equal(s.restKind, 'end');
  assert.equal(W.toSession(W.endRest(s, sec(220)), sec(220)).sets.length, 1);
});

test('one more set of an exercise already finished', () => {
  let w = afterCurls();
  w = W.endRest(w, sec(330));
  w = W.completeStep(w, { reps: 15, weight: 30 }, sec(380)); // crunch 1, resting
  assert.equal(W.oneMore(w, 1), w, 'not of one still going');
  const m = W.oneMore(w, 0, sec(390));
  assert.equal(order(m), 'cu1 cu2 cr1 cu3 cr2 cr3 pl1 ro1 ro2');
  assert.equal(m.phase, 'rest');
  assert.equal(m.restKind, 'between');
  const st = m.steps[m.idx + 1];
  assert.deepEqual([st.n, st.of, st.extra, st.plan.reps, st.plan.weight], [3, 3, true, 10, 12]);
  assert.ok(m.steps.filter((s) => s.itemIndex === 0).every((s) => s.of === 3));
  // taken back while still in that rest
  const u = W.removeAddedSet(m);
  assert.equal(order(u), order(w));
  assert.ok(u.steps.filter((s) => s.itemIndex === 0).every((s) => s.of === 2));
  assert.ok(u.steps.filter((s) => s.itemIndex === 1).every((s) => s.of === 3));
  // during a set it comes now
  const x = W.oneMore(W.endRest(w, sec(480)), 0, sec(490));
  assert.equal(x.phase, 'work');
  assert.equal(`${W.current(x).exerciseId}${W.current(x).n}`, 'cu3');
  const done = W.completeStep(x, { reps: 9 }, sec(520));
  assert.equal(done.log[done.log.length - 1].reps, 9);
  assert.equal(done.steps[done.idx + 1].exerciseId, 'cr');
});
