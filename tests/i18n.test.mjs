import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DICTS } from '../js/i18n.js';
import { GUIDE } from '../js/guide.js';

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.js') ? [join(dir, d.name)] : []));
}

test('every text the app asks for exists in Italian and English', () => {
  const keys = new Set();
  for (const f of files('js')) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([A-Za-z_]+)'/g)) keys.add(m[1]);
  }
  // keys built at run time
  const fam = {
    tab_: ['routines', 'exercises', 'gym', 'history'], st_: ['local', 'syncing', 'offline', 'error', 'pending', 'synced'],
    err_: ['auth', 'forbidden', 'notfound', 'http', 'conflict', 'network', 'unknown', 'missing', 'readonly'],
    kind_: ['treadmill', 'elliptical', 'bike', 'rower', 'stepper', 'custom', 'otherMeasures'],
    m_: ['duration', 'speed', 'incline', 'level', 'ramp', 'resistance', 'cadence', 'strokes', 'distance', 'calories', 'watt'],
    cat_: ['machine', 'barbell', 'dumbbell', 'cable', 'bodyweight', 'cardio'], catHint_: ['machine', 'barbell', 'dumbbell', 'cable', 'bodyweight', 'cardio'],
    eq_: ['machine', 'barbell', 'dumbbell', 'cable'], eqShort_: ['machine', 'barbell', 'dumbbell', 'cable'], bd_: ['work', 'rest', 'walk', 'pause'],
    type_: ['weights', 'bodyweight', 'cardio'],
  };
  for (const [p, xs] of Object.entries(fam)) for (const x of xs) keys.add(p + x);
  for (const lang of ['it', 'en']) {
    const missing = [...keys].filter((k) => DICTS[lang][k] === undefined);
    assert.deepEqual(missing, [], `missing in ${lang}`);
  }
  assert.deepEqual(Object.keys(DICTS.it).sort(), Object.keys(DICTS.en).sort(), 'same keys in both languages');
});

test('the guide has the same chapters in both languages', () => {
  assert.equal(GUIDE.it.length, GUIDE.en.length);
});
