import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLine, parseText, parseImport, defaultWeekdays } from '../js/importer.js';

test('one line', () => {
  assert.deepEqual(
    (({ name, equipment, sets, reps, weight, rest }) => ({ name, equipment, sets, reps, weight, rest }))(parseLine('Panca piana (bilanciere) 4x8 60 kg rec 2:30')),
    { name: 'Panca piana', equipment: 'barbell', sets: 4, reps: 8, weight: 60, rest: 150 },
  );
  const p = parseLine('Plank 3x45s rec 0:45');
  assert.equal(p.seconds, 45); assert.equal(p.rest, 45);
  const c = parseLine('Tapis roulant 10 min 9,5 km/h pendenza 2%');
  assert.equal(c.duration, 10); assert.deepEqual(c.targets, { speed: 9.5, incline: 2 });
  assert.equal(parseLine('Curl 4x10 rest 90s').rest, 90);
  assert.equal(parseLine('Curl con bilanciere 4x10 60kg rc 1:30').leftover, 'rc 1:30');
});

test('a whole plan in text', () => {
  const txt = readFileSync(new URL('./sample-plan.txt', import.meta.url), 'utf8');
  const { data, issues } = parseText(txt);
  assert.deepEqual(issues, []);
  assert.equal(data.plan.name, 'Petto e bicipiti · Schiena e tricipiti · Gambe');
  assert.deepEqual(data.routines.map((r) => r.name), ['Petto e bicipiti', 'Schiena e tricipiti', 'Gambe']);
  assert.deepEqual(data.routines.map((r) => r.items.length), [10, 10, 10]);
  const byName = Object.fromEntries(data.exercises.map((e) => [e.name, e]));
  assert.equal(byName['Panca piana'].equipment, 'barbell');
  assert.equal(byName['Croci ai cavi'].equipment, 'cable');
  assert.equal(byName['Dip alle parallele'].type, 'bodyweight');
  assert.equal(byName.Plank.timed, true);
  assert.equal(byName.Ellittica.type, 'cardio');
  assert.equal(byName.Ellittica.cardio.kind, 'elliptical');
  assert.equal(byName['Tapis roulant in salita'].cardio.kind, 'treadmill');
  assert.match(byName['Panca piana'].notes, /Scapole/);
  // the same exercise on two days is one exercise
  assert.equal(data.exercises.filter((e) => e.name === 'Bike').length, 1);
  assert.equal(parseImport(txt).data.routines.length, 3);
});

test('problems are reported, not fatal', () => {
  const { data, issues } = parseText('GIORNO: A\nPanca 3x10 rc 1:30\nqualcosa senza numeri\n- nota\n');
  assert.equal(data.routines[0].items.length, 1);
  assert.deepEqual(issues.map((x) => x.reason), ['leftover', 'noSets']);
  assert.equal(parseText('niente').error, 'importNothing');
  assert.deepEqual(defaultWeekdays(3), [0, 2, 4]);
});

test('weekday and time on a day line', () => {
  const { data } = parseText('SCHEDA: X\nGIORNO: Gambe @ ven 18:30\nSquat 4x8\nGIORNO: Petto @ 7.15\nPanca 3x10\nGIORNO: Schiena\nRematore 3x10\n');
  assert.deepEqual(data.routines.map((r) => [r.name, r._weekday, r._time]), [['Gambe', 4, '18:30'], ['Petto', undefined, '07:15'], ['Schiena', undefined, undefined]]);
});
