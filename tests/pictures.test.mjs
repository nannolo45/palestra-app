import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setIndex, suggest, translate, frameUrl } from '../js/pictures.js';

setIndex(JSON.parse(readFileSync('lib/exercise-pictures.json', 'utf8')));

// what a person at the gym would expect to see first (or among the first three)
const CASES = [
  ['Lat machine', { type: 'weights', equipment: 'machine' }, /Lat Pulldown/, 1],
  ['Panca piana', { type: 'weights', equipment: 'barbell' }, /Barbell Bench Press - Medium Grip/, 1],
  ['Leg press', { type: 'weights', equipment: 'machine' }, /^Leg Press$/, 1],
  ['Curl con manubri', { type: 'weights', equipment: 'dumbbell' }, /Dumbbell Bicep Curl/, 1],
  ['Pulley basso', { type: 'weights', equipment: 'machine' }, /Seated Cable Rows/, 1],
  ['Alzate laterali', { type: 'weights', equipment: 'dumbbell' }, /Lateral Raise/, 3],
  ['Squat con bilanciere', { type: 'weights', equipment: 'barbell' }, /Barbell Squat/, 1],
  ['Stacco rumeno', { type: 'weights', equipment: 'barbell' }, /Romanian Deadlift/, 1],
  ['Leg curl', { type: 'weights', equipment: 'machine' }, /Leg Curl/, 3],
  ['Leg extension', { type: 'weights', equipment: 'machine' }, /Leg Extensions/, 1],
  ['Croci ai cavi', { type: 'weights', equipment: 'cable' }, /Cable Crossover/, 1],
  ['Push down ai cavi', { type: 'weights', equipment: 'cable' }, /Triceps Pushdown/, 3],
  ['Face pull', { type: 'weights', equipment: 'cable' }, /Face Pull/, 1],
  ['Plank', { type: 'bodyweight' }, /^Plank$/, 1],
  ['Ellittica', { type: 'cardio' }, /Elliptical/, 1],
  ['Vogatore', { type: 'cardio' }, /Rowing, Stationary/, 1],
  ['Tapis roulant', { type: 'cardio' }, /Treadmill/, 3],
  ['Curl a martello', { type: 'weights', equipment: 'dumbbell' }, /Hammer Curl/, 1],
  ['Rematore con bilanciere', { type: 'weights', equipment: 'barbell' }, /Bent Over Barbell Row/, 1],
  ['Dip alle parallele', { type: 'bodyweight' }, /Dips - Triceps/, 2],
];

test('suggestions find the usual Italian gym names', async () => {
  const misses = [];
  for (const [name, ex, re, within] of CASES) {
    const list = (await suggest({ name, ...ex })).map((x) => x.name);
    if (!list.slice(0, within).some((n) => re.test(n))) misses.push(`${name}: ${list.slice(0, 3).join(' | ')}`);
  }
  assert.deepEqual(misses, []);
});

test('search box takes English too, and frames have an address', async () => {
  assert.ok((await suggest(null, { query: 'hip thrust' }))[0].name.includes('Hip Thrust'));
  assert.equal(translate('Panca inclinata con manubri'), 'incline dumbbell press');
  assert.equal(frameUrl({ id: 'Wide-Grip_Lat_Pulldown', n: 2 }, 1), 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/1.jpg');
});
