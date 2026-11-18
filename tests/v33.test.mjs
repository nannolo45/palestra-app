// v33: every weights exercise says what its kg mean; machines and cables too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightMode, liftedKg, suggestWeight, EQUIPMENT } from '../js/model.js';
import { weightTexts, weightAsChoices, withWhat } from '../js/data.js';
import { state } from '../js/store.js';

state.settings.lang = 'it';

test('no weights exercise is left with a bare "kg"', () => {
  for (const equipment of [...EQUIPMENT, undefined]) {
    for (const weightAs of [undefined, 'total', 'side', 'each']) {
      for (const dumbbells of [undefined, 1, 2]) {
        const ex = { type: 'weights', equipment, weightAs, dumbbells };
        const x = weightTexts(ex, 40);
        assert.ok(x.what, `${JSON.stringify(ex)} says what the kg mean`);
        assert.ok(x.label.startsWith('kg · '), x.label);
        assert.ok(weightAsChoices(ex).some((c) => c.mode === weightMode(ex)), `${JSON.stringify(ex)}: its reading is one of the choices`);
      }
    }
  }
  assert.equal(weightTexts({ type: 'bodyweight' }).label, 'kg');
  assert.deepEqual(weightAsChoices({ type: 'cardio' }), []);
});

test('machines and cables: in all by default, per side / arm when set', () => {
  const press = { type: 'weights', equipment: 'machine', name: 'Chest press' };
  assert.equal(weightMode(press), 'stackTotal');
  assert.equal(weightTexts(press).label, 'kg · in tutto');
  const plates = { ...press, weightAs: 'side' };
  assert.equal(weightMode(plates), 'stackSide');
  assert.equal(weightTexts(plates, 25).label, 'kg · per lato');
  assert.match(weightTexts(plates, 25).hint, /50 kg in tutto/);
  assert.equal(liftedKg(plates, 25), 50);
  assert.equal(liftedKg(press, 25), 25);
  assert.equal(weightMode({ type: 'weights', equipment: 'cable', weightAs: 'side' }), 'stackSide');
  assert.equal(weightMode({ type: 'weights' }), 'stackTotal', 'no equipment counts as a machine');
});

test('the suggested start follows the reading', () => {
  const body = { kg: 80, cm: 180, sex: 'm', level: 'months' };
  const total = suggestWeight({ type: 'weights', equipment: 'machine', name: 'Chest press' }, body);
  const side = suggestWeight({ type: 'weights', equipment: 'machine', name: 'Chest press', weightAs: 'side' }, body);
  assert.ok(Math.abs(side - total / 2) <= 2.5, `per side ≈ half (${total} / ${side})`);
  const each = suggestWeight({ type: 'weights', equipment: 'dumbbell', name: 'Curl' }, body);
  const both = suggestWeight({ type: 'weights', equipment: 'dumbbell', name: 'Curl', weightAs: 'total' }, body);
  assert.ok(Math.abs(both - each * 2) <= 1, `in all ≈ both dumbbells (${each} / ${both})`);
});

test('a sets text with what the kg mean', () => {
  assert.equal(withWhat('3 × 10 · 50 kg', { type: 'weights', equipment: 'machine', weightAs: 'side' }), '3 × 10 · 50 kg per lato');
  assert.equal(withWhat('3 × 12', { type: 'bodyweight' }), '3 × 12');
});
