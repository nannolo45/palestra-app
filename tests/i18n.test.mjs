import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DICTS } from '../js/i18n.js';
import { GUIDE, shotNames } from '../js/guide.js';
import { existsSync } from 'node:fs';

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

test('the version shown in Settings matches the offline cache version', () => {
  const sw = readFileSync('sw.js', 'utf8').match(/const VERSION = 'palestra-(v\d+)'/)[1];
  const app = readFileSync('js/views/settings.js', 'utf8').match(/APP_VERSION = '(v\d+)'/)[1];
  assert.equal(sw, app);
  assert.match(readFileSync('CHANGELOG.md', 'utf8'), new RegExp(`\\| ${app} \\|`));
});

test('every screenshot the guide shows exists, for the phone and the desktop', () => {
  for (const device of ['phone', 'desktop']) {
    const names = shotNames(device);
    assert.ok(names.length > 8);
    for (const n of names) assert.ok(existsSync(`guide/${device}/${n}.jpg`), `guide/${device}/${n}.jpg (run node tests/guide-shots.cjs)`);
  }
});
