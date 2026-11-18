// v34, v35: Rimanda (an exercise put off stays where it is until it's started), one more set of a finished one, the
// rest that keeps running when the exercise that comes next is put off, and the last screen that asks about them.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.indexedDB ??= undefined; // store.js is only imported, not used
const W = await import('../js/workout.js');

const ex = [{ id: 'cu', name: 'Curl', type: 'weights' }, { id: 'cr', name: 'Crunch', type: 'weights' }, { id: 'pl', name: 'Plank', type: 'bodyweight' }, { id: 'ro', name: 'Row', type: 'weights' }, { id: 'tr', name: 'Tapis roulant', type: 'cardio' }];
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

test('Rimanda from the rest: the rest goes on with the exercise after, the questions about the one just done stay', () => {
  const w = afterCurls();
  assert.equal(w.restKind, 'between');
  const s = W.postpone(w, 1, sec(210));
  assert.equal(s.phase, 'rest');
  assert.equal(s.phaseStart, w.phaseStart, 'the same rest, not a new one');
  assert.equal(W.restLeft(s, sec(210)), 110);
  assert.equal(s.steps[s.idx + 1].exerciseId, 'pl');
  assert.equal(order(s), order(w), 'nothing moves: the crunches stay where they were');
  assert.deepEqual(W.postponed(s), [1]);
  assert.deepEqual(W.notDone(s).map((o) => [o.itemIndex, o.left]), [[1, 3], [2, 1], [3, 2]]);
  assert.equal(W.restedFrom(s).step.exerciseId, 'cu');
  assert.equal(W.afterLastSet(s), true, 'the rest still follows the curls');
  assert.deepEqual(W.justFinished(s), [0]);
  // one more curl set from there comes before the plank
  const a = W.addSet(s);
  assert.deepEqual([a.steps[a.idx + 1].exerciseId, a.steps[a.idx + 1].n, a.steps[a.idx + 1].extra], ['cu', 3, true]);
  assert.equal(order(W.removeAddedSet(a)), order(w));
  const go = W.endRest(s, sec(330));
  assert.equal(W.current(go).exerciseId, 'pl');
  assert.equal(go.log[1].restTaken, 130, 'the rest is the curls\' rest');
  assert.deepEqual(W.postponed(go), [1]);
  // back, from that rest or from the plank, goes to the first crunch set
  for (const b of [W.back(s, sec(215)), W.back(go, sec(335))]) {
    assert.equal(`${W.current(b).exerciseId}${W.current(b).n}`, 'cr1');
    assert.equal(b.log.length, 2);
    assert.deepEqual(W.postponed(b), []);
  }
});

test('Rimanda on its own screen picks the rest up again while it has time left', () => {
  let w = afterCurls();
  w = W.endRest(w, sec(230)); // Salta after 30 s of 120
  assert.equal(w.breakdown.walk, 30);
  const s = W.postpone(w, 1, sec(240));
  assert.equal(s.phase, 'rest');
  assert.equal(W.restLeft(s, sec(240)), 80, '120 planned, 40 gone since the last curl');
  assert.equal(s.breakdown.walk, 0, 'counted once, when it really ends');
  assert.equal(s.steps[s.idx + 1].exerciseId, 'pl');
  const go = W.endRest(s, sec(320));
  assert.equal(go.breakdown.walk, 120);
  assert.equal(go.log[1].restTaken, 120);
  // once the rest is over there is nothing to wait for: straight to the next exercise
  const late = W.postpone(w, 1, sec(400));
  assert.equal(late.phase, 'work');
  assert.equal(W.current(late).exerciseId, 'pl');
  assert.deepEqual(W.postponed(late), [1]);
  // after one set of it: the sets left are put off, and the rest becomes the one between exercises
  let d = W.completeStep(w, {}, sec(260));
  d = W.endRest(d, sec(270));
  const s2 = W.postpone(d, 1, sec(275));
  assert.deepEqual([s2.phase, s2.restKind, s2.restPlanned], ['rest', 'between', 120]);
  assert.equal(s2.steps[s2.idx + 1].exerciseId, 'pl');
  assert.equal(W.afterLastSet(s2), false, 'the crunches aren\'t finished: no questions about them');
  assert.deepEqual(W.justFinished(s2), []);
  assert.deepEqual(W.notDone(s2)[0], { itemIndex: 1, left: 2, of: 3 });
});

test('put off during its own rest: it isn\'t finished, so no questions about it', () => {
  let w = W.newWorkout(routine, ex, { now: T0 });
  w = W.completeStep(w, {}, sec(60)); // curl 1, rest of 60 s before curl 2
  const n = W.postpone(w, 0, sec(70));
  assert.equal(order(n), order(w));
  assert.equal(n.steps[n.idx + 1].exerciseId, 'cr');
  assert.deepEqual([n.restKind, n.restPlanned], ['between', 120]);
  assert.equal(W.afterLastSet(n), false);
  assert.deepEqual(W.justFinished(n), []);
  assert.equal(W.addSet(n), n);
});

test('started again: Fallo adesso on an exercise put off', () => {
  let w = W.postpone(afterCurls(), 1, sec(210));
  w = W.endRest(w, sec(330)); // on the plank
  const d = W.doNow(w, 1, sec(340));
  assert.equal(order(d), 'cu1 cu2 cr1 cr2 cr3 pl1 ro1 ro2');
  assert.equal(`${W.current(d).exerciseId}${W.current(d).n}`, 'cr1');
  assert.deepEqual(W.postponed(d), []);
  // during a rest it comes after the rest
  const r = W.completeStep(w, {}, sec(380)); // plank done, resting before the rows
  const d2 = W.doNow(r, 1, sec(390));
  assert.equal(order(d2), 'cu1 cu2 pl1 cr1 cr2 cr3 ro1 ro2');
  assert.equal(d2.phase, 'rest');
  assert.equal(d2.steps[d2.idx + 1].exerciseId, 'cr');
});

test('the end asks about what was put off, also after putting off the last exercise or a cardio at the end', () => {
  let w = afterCurls();
  w = W.postpone(w, 1, sec(210));
  w = W.postpone(w, 2, sec(211));
  w = W.postpone(w, 3, sec(212));
  assert.deepEqual([w.phase, w.restKind], ['rest', 'end']);
  assert.deepEqual(W.notDone(w).map((o) => o.itemIndex), [1, 2, 3]);
  assert.deepEqual(W.postponed(w), [1, 2, 3]);
  const d = W.doNow(w, 2, sec(220));
  assert.equal(d.restKind, 'between');
  assert.equal(d.steps[d.idx + 1].exerciseId, 'pl');
  assert.equal(W.endRest(w, sec(230)).phase, 'done', 'Saltali e termina');
  // set by set, from a set screen, too
  let s = W.newWorkout({ id: 'one', items: [routine.items[0]] }, ex, { now: T0 });
  s = W.completeStep(s, {}, sec(60));
  s = W.endRest(s, sec(200));
  s = W.skipStep(s, sec(210));
  assert.deepEqual([s.phase, s.restKind], ['rest', 'end']);
  assert.equal(W.toSession(W.endRest(s, sec(220)), sec(220)).sets.length, 1);
  // a cardio at the end finishes the workout on its own, unless something is still waiting
  const withCardio = { id: 'c', items: [routine.items[0], { exerciseId: 'tr', targets: { duration: 10 } }] };
  let c = W.newWorkout(withCardio, ex, { now: T0 });
  c = W.postpone(c, 0, sec(10));
  assert.equal(W.current(c).kind, 'cardio');
  c = W.completeStep(c, {}, sec(600));
  assert.deepEqual([c.phase, c.restKind], ['rest', 'end']);
  assert.deepEqual(W.notDone(c).map((o) => o.itemIndex), [0]);
  let c2 = W.newWorkout(withCardio, ex, { now: T0 });
  c2 = W.endRest(W.completeStep(c2, {}, sec(60)), sec(120));
  c2 = W.endRest(W.completeStep(c2, {}, sec(180)), sec(300));
  assert.equal(W.completeStep(c2, {}, sec(900)).phase, 'done');
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
