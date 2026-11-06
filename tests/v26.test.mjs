// v26: the body (regions, muscles from the name via English), equipment and alternatives, Storico's lines and pauses.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../js/body.js');
const S = await import('../js/stats.js');

test('muscles from the name, in Italian, English and German', () => {
  const m = (name) => B.classify(name)?.muscles?.[0] || null;
  assert.equal(m('Chest press'), 'chest');
  assert.equal(m('Croci ai cavi'), 'chest');
  assert.equal(m('Lat machine'), 'lats');
  assert.equal(m('Pulley basso'), 'middle back');
  assert.equal(m('Push down ai cavi'), 'triceps');
  assert.equal(m('Leg curl'), 'hamstrings');
  assert.equal(m('Curl con bilanciere'), 'biceps');
  assert.equal(m('Leg extension'), 'quadriceps');
  assert.equal(m('Calf raise'), 'calves');
  assert.equal(m('Beinpresse'), 'quadriceps');
  assert.equal(m('Bankdrücken'), 'chest');
  assert.equal(m('Seitheben'), 'shoulders');
  assert.equal(m('Iperestensioni'), 'lower back');
  assert.equal(m('Something odd'), null);
});

test('chosen muscles win over the name; old words are understood; regions', () => {
  assert.deepEqual(B.musclesOf({ name: 'Chest press', muscles: ['Tricipiti'] }), ['triceps']);
  assert.deepEqual(B.musclesOf({ name: 'Squat', muscles: ['Quadricipiti', 'Glutei'] }), ['quadriceps', 'glutes']);
  assert.deepEqual(B.musclesOf({ name: 'Leg press', muscles: [] }), ['quadriceps', 'glutes']);
  assert.deepEqual(B.musclesOf({ name: 'Tapis roulant', type: 'cardio' }), ['cardio']);
  assert.equal(B.regionOf({ name: 'Polpacci alla macchina' }), 'legs');
  assert.equal(B.regionOf({ name: 'Calf raise' }), 'legs');
  assert.equal(B.regionOf({ name: 'Mystery' }), 'unsorted');
  assert.equal(B.muscleName('hamstrings', 'it'), 'Femorali');
  assert.equal(B.muscleName('hamstrings', 'de'), 'Beinbeuger');
  assert.equal(B.regionName('legs', 'en'), 'Legs');
});

test('what an exercise needs, what a gym has, and alternatives for the same muscles', () => {
  assert.equal(B.needOf({ name: 'Leg press', type: 'weights', equipment: 'machine' }), 'legpress');
  assert.equal(B.needOf({ name: 'Squat con bilanciere', type: 'weights', equipment: 'barbell' }), 'rack');
  assert.equal(B.needOf({ name: 'Curl', type: 'weights', equipment: 'dumbbell' }), 'dumbbells');
  assert.equal(B.needOf({ name: 'Trazioni', type: 'bodyweight' }), 'bars');
  assert.equal(B.needOf({ name: 'Plank', type: 'bodyweight' }), 'none');
  assert.equal(B.gymHas({ name: 'old' }, 'legpress'), true, 'a gym from before v26 has everything');
  const home = { equipment: ['dumbbells', 'mats'] };
  assert.equal(B.gymHas(home, 'legpress'), false);
  const legPress = { id: 'a', name: 'Leg press', type: 'weights', equipment: 'machine' };
  const lib = [legPress, { id: 'b', name: 'Affondi con manubri', type: 'weights', equipment: 'dumbbell' }, { id: 'c', name: 'Squat con bilanciere', type: 'weights', equipment: 'barbell' }];
  const alts = B.alternativesFor(legPress, home, lib, 'it');
  assert.equal(alts.length, 2);
  assert.equal(alts[0].ex.id, 'b', 'the person\'s own exercise first');
  assert.ok(alts[1].builtin && B.musclesOf(alts[1].builtin)[0] === 'quadriceps');
  assert.ok(!alts.some((a) => a.ex && a.ex.id === 'c'), 'not one that needs a rack');
});

const day = (s) => new Date(`${s}T18:00:00`).getTime();
const sess = (d, sets, routineId = 'r1') => ({ id: d, routineId, start: day(d), end: day(d) + 3600e3, sets });
const exs = [
  { id: 'bp', name: 'Panca piana', type: 'weights', equipment: 'barbell' },
  { id: 'lp', name: 'Leg press', type: 'weights', equipment: 'machine' },
];

test('pauses: 10 days or more without training', () => {
  const ss = [sess('2026-09-01', []), sess('2026-09-03', []), sess('2026-09-20', []), sess('2026-09-22', [])];
  const p = S.pausesOf(ss, 10, day('2026-09-25'));
  assert.equal(p.length, 1);
  assert.equal(p[0].days, 16);
  assert.equal(p[0].key, '2026-09-04');
  const ongoing = S.pausesOf(ss, 10, day('2026-10-15'));
  assert.equal(ongoing.length, 2);
  assert.equal(ongoing[1].ongoing, true);
});

test('weekly lines per region, the max index, and the change over the last 4 training weeks', () => {
  const ss = [];
  const weeksOn = ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'];
  weeksOn.forEach((d, i) => ss.push(sess(d, [
    { exerciseId: 'bp', reps: 10, weight: 50 + i * 2.5 },
    { exerciseId: 'lp', reps: 10, weight: 100 },
  ])));
  const now = day('2026-10-20');
  const r = S.weekly(ss, exs, { dim: 'region', metric: 'volume', now });
  const chest = r.lines.find((l) => l.key === 'chest');
  const legs = r.lines.find((l) => l.key === 'legs');
  const arms = r.lines.find((l) => l.key === 'arms');
  assert.equal(chest.values[0], 500 + 0.5 * 0, 'chest in full; leg press adds nothing to chest');
  assert.equal(arms.values[0], 250, 'triceps (bench press, second muscle) count half');
  assert.equal(legs.values[0], 1000);
  assert.equal(r.trained.filter(Boolean).length, 8);
  assert.equal(chest.values[5], null, 'a week of the pause has no value');
  const ch = S.changeOf(chest.values, r.trained, { now, weeks: r.weeks });
  assert.ok(ch > 10 && ch < 25, `chest went up (${ch}%)`);
  assert.equal(S.changeOf(legs.values, r.trained, { now, weeks: r.weeks }), 0);
  const mx = S.weekly(ss, exs, { dim: 'all', metric: 'max', now });
  assert.equal(mx.lines[0].values[0], 100);
  const sets = S.weekly(ss, exs, { dim: 'all', metric: 'sets', now });
  assert.equal(sets.lines[0].values[0], 2);
});

test('a scheda in another gym: what\'s missing, and a stand-in that fits (cardio minutes become a timed set)', async () => {
  const st = await import('../js/store.js');
  const G = await import('../js/gyms.js');
  const W = await import('../js/workout.js');
  st.upsert('exercises', { id: 'tr', name: 'Tapis roulant', type: 'cardio', cardio: { kind: 'treadmill' } });
  st.upsert('exercises', { id: 'lp', name: 'Leg press', type: 'weights', equipment: 'machine' });
  st.upsert('exercises', { id: 'jj', name: 'Jumping jack', type: 'bodyweight', timed: true });
  st.upsert('exercises', { id: 'gs', name: 'Squat con manubri (goblet)', type: 'weights', equipment: 'dumbbell' });
  const casa = G.addGym('Casa');
  G.updateGym(casa.id, { equipment: ['dumbbells'] });
  const r = { id: 'r', name: 'Gambe', items: [{ exerciseId: 'tr', targets: { duration: 8 } }, { exerciseId: 'lp', sets: 3, reps: 12, weight: 120 }] };
  assert.equal(G.missingIn(r, G.mainGym().id).length, 0, 'the usual gym has everything');
  assert.deepEqual(G.missingIn(r, casa.id).map((m) => m.need), ['cardio', 'legpress']);
  const withAlt = { ...r, items: [{ ...r.items[0], alt: { [casa.id]: 'jj' } }, { ...r.items[1], alt: { [casa.id]: 'gs' } }] };
  assert.equal(G.missingIn(withAlt, casa.id).length, 0, 'stand-ins cover it');
  const there = G.routineIn(withAlt, casa.id);
  assert.deepEqual([there.items[0].exerciseId, there.items[0].sets, there.items[0].seconds], ['jj', 1, 480]);
  assert.deepEqual([there.items[1].exerciseId, there.items[1].weight], ['gs', 120]);
  const steps = W.buildSteps(there, st.live('exercises'));
  assert.equal(steps.length, 4);
  assert.equal(G.routineIn(withAlt, G.mainGym().id).items[1].exerciseId, 'lp', 'at the usual gym, the scheda as it is');
});
