import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsert, live, get, pref } from '../js/store.js';
import { activate, rotationNext, savePlan } from '../js/plans.js';
import { parseText, runImport, planImport, importClashes } from '../js/importer.js';

const MON = new Date(2026, 10, 2, 9).getTime();
const DAY = 86400000;

test('rotation with the same scheda twice (A B A C): the next one follows the real place in the loop', () => {
  upsert('exercises', { id: 'e1', name: 'Panca piana', type: 'weights', equipment: 'barbell', muscles: [] });
  for (const [id, name] of [['ra', 'A'], ['rb', 'B'], ['rc', 'C']]) upsert('routines', { id, name, items: [{ exerciseId: 'e1', sets: 3, reps: 10, rest: 90 }] });
  const plan = savePlan({ id: 'pdup', name: 'ABAC', mode: 'rotation', days: ['ra', 'rb', 'ra', 'rc'].map((routineId) => ({ routineId, weekday: null })) });
  const done = (id, d) => upsert('sessions', { id: `s-${id}-${d}`, routineId: id, start: MON + d * DAY, end: MON + d * DAY + 3600000, outcome: 'done' });
  assert.equal(rotationNext(plan), 0);
  done('ra', 0);
  assert.equal(rotationNext(plan), 1, 'after the first A: B');
  done('rb', 1);
  assert.equal(rotationNext(plan), 2, 'after B: A again');
  done('ra', 2);
  assert.equal(rotationNext(plan), 3, 'after the second A: C (before v29 this went back to B)');
  done('rc', 3);
  assert.equal(rotationNext(plan), 0);
});

const TXT = `WORKOUT: Forza
SCHEDA: Spinta @ lun
Panca piana 4x6 80 kg rec 3:00

SCHEDA: Tirata @ gio
Rematore 4x8 60 kg rec 2:00
`;

test('import: "Aggiungi come nuovi" makes copies, "Aggiorna" replaces the exercises in place', () => {
  const first = runImport(parseText(TXT).data, { asPlan: true });
  const spinta = get('routines', first.created[0]);
  const before = live('routines').length;
  const plansBefore = live('plans').length;

  // the same names again, different sets
  const v2 = TXT.replace('4x6 80 kg', '5x5 85 kg');
  const { data } = parseText(v2);
  assert.deepEqual(importClashes(data), { routines: 2, plan: true });
  assert.equal(planImport(data).routines[0].finalName, 'Spinta (2)');
  assert.equal(planImport(data, { update: true }).routines[0].updateId, spinta.id);

  const upd = runImport(data, { asPlan: true, update: true });
  assert.equal(live('routines').length, before, 'no new schede');
  assert.equal(live('plans').length, plansBefore, 'no new workout');
  assert.equal(upd.planId, first.planId);
  const after = get('routines', spinta.id);
  assert.equal(after.items[0].sets, 5);
  assert.equal(after.items[0].weight, 85);

  const add = runImport(parseText(v2).data, { asPlan: true });
  assert.equal(live('routines').length, before + 2);
  assert.ok(live('routines').some((r) => r.name === 'Spinta (2)'));
  assert.notEqual(add.planId, first.planId);
});

test('import update of the active workout keeps the record Everyday reads in step', () => {
  const p = live('plans').find((x) => x.name === 'Forza');
  activate(p, '2026-11-02');
  const v3 = TXT.replace('SCHEDA: Tirata @ gio', 'SCHEDA: Tirata @ ven');
  runImport(parseText(v3).data, { asPlan: true, update: true });
  const rec = pref('activePlan', null);
  assert.equal(rec.planId, p.id);
  assert.deepEqual(rec.days.map((d) => d.weekday), [0, 4]);
});

test('docs/piani/4-a-cedimento.txt imports with no problems', async () => {
  const fs = await import('node:fs');
  const txt = fs.readFileSync(new URL('../docs/piani/4-a-cedimento.txt', import.meta.url), 'utf8');
  const { data, issues } = parseText(txt);
  assert.equal(issues.length, 0, JSON.stringify(issues));
  assert.deepEqual(data.routines.map((r) => [r.name, r.items.length]), [['Petto e bicipiti', 11], ['Gambe', 9], ['Schiena e tricipiti', 11]]);
});
