// Every picture in the user guide, taken from the real app with made-up data, so the whole set can be retaken in
// minutes after any change. Run from tests/:
//   node ../docs/guide/screenshots.mjs it ../guide/it
//   node ../docs/guide/screenshots.mjs en ../guide/en
//   node ../docs/guide/screenshots.mjs it /tmp/desk/it desk      (then build.py turns them into guide/it/desk/*.webp)
// Phone: 390×780 at 2×, PNG. Computer ("desk"): 1440×900 at 1×.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const [LANG = 'it', OUT = `../guide/${LANG}`, ...MODES] = process.argv.slice(2);
const DESK = MODES.includes('desk');
const DARK = MODES.includes('dark'); // only to check the dark theme by eye; the guide uses the light pictures
const out = path.resolve(process.cwd(), OUT);
fs.mkdirSync(out, { recursive: true });

// ---- the app, served as GitHub Pages would ----
const PORT = 8700 + Math.floor(Math.random() * 200);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
const base = `http://127.0.0.1:${PORT}/`;

// ---- a fake GitHub, in memory, so the app shows "synced" ----
const repo = new Map();
let shaN = 0;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, accept, content-type, x-github-api-version', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS' };
async function fakeGithub(route) {
  const req = route.request();
  const reply = (o) => route.fulfill({ ...o, headers: { ...CORS, ...(o.headers || {}) } });
  if (req.method() === 'OPTIONS') return reply({ status: 204 });
  const m = new URL(req.url()).pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.*))?$/);
  if (!m) return reply({ status: 404, body: '{}' });
  const p = m[3];
  if (p == null) return reply({ status: 200, contentType: 'application/json', body: JSON.stringify({ private: true, permissions: { push: true } }) });
  if (req.method() === 'GET') {
    if (repo.has(p)) {
      const f = repo.get(p);
      if ((req.headers().accept || '').includes('raw')) return reply({ status: 200, body: f.text });
      return reply({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: f.sha, size: f.text.length, content: Buffer.from(f.text).toString('base64') }) });
    }
    const kids = [...repo.keys()].filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'));
    if (kids.length) return reply({ status: 200, contentType: 'application/json', body: JSON.stringify(kids.map((k) => ({ type: 'file', path: k, sha: repo.get(k).sha, size: repo.get(k).text.length }))) });
    return reply({ status: 404, body: '{}' });
  }
  const body = JSON.parse(req.postData());
  const sha = `sha${++shaN}`;
  repo.set(p, { text: Buffer.from(body.content, 'base64').toString('utf8'), sha });
  return reply({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha } }) });
}

// ---- sample data, put in through the app's own modules ----
const T = {
  it: {
    gym: 'FitLab Firenze', zones: ['Ingresso e cardio', 'Sala macchine', 'Pesi liberi', 'Cavi e tappetini'],
    machines: [['C1–6', 'Tapis roulant', 0, 'treadmill'], ['C7', 'Bike', 0, 'bike'], ['C11', 'Ellittica', 0, 'elliptical'], ['C13', 'Vogatore', 0, 'rower'],
      ['M5', 'Lat machine', 1, '', 'Ginocchia 2'], ['M6', 'Pulley basso', 1], ['M9', 'Chest press', 1, '', 'Sedile 4'], ['M14', 'Leg press', 1, '', 'Schienale 3'], ['M18', 'Leg curl', 1],
      ['M21', 'Leg extension', 1], ['M23', 'Calf raise', 1], ['R1–2', 'Rack e panche', 2], ['MAN', 'Manubri', 2], ['CAV', 'Torre cavi', 3]],
    match: [[/tapis/i, 'Tapis roulant'], [/bike/i, 'Bike'], [/ellittica/i, 'Ellittica'], [/vogatore/i, 'Vogatore'], [/lat machine/i, 'Lat machine'], [/pulley/i, 'Pulley basso'], [/chest press/i, 'Chest press'],
      [/leg press/i, 'Leg press'], [/leg curl/i, 'Leg curl'], [/leg extension/i, 'Leg extension'], [/calf/i, 'Calf raise'], [/bilanciere|panca piana|squat|stacco|french/i, 'Rack e panche'], [/manubri|martello|alzate|affondi/i, 'Manubri'], [/cavi|face pull|push down/i, 'Torre cavi']],
    muscles: [[/panca|chest|croci/i, 'Petto'], [/curl|martello/i, 'Bicipiti'], [/lat|rematore|pulley|face/i, 'Dorsali'], [/french|push down|dip/i, 'Tricipiti'], [/alzate/i, 'Spalle'], [/squat|stacco|leg|affondi|calf/i, 'Gambe'], [/crunch|plank/i, 'Addome']],
    weights: { 'Panca piana': 60, 'Panca inclinata con manubri': 22, 'Chest press': 50, 'Croci ai cavi': 15, 'Curl con bilanciere': 30, 'Curl su panca inclinata': 10, 'Curl a martello': 12,
      'Lat machine': 55, 'Rematore con bilanciere': 50, 'Pulley basso': 45, 'Face pull': 17.5, 'Alzate laterali': 8, 'French press': 25, 'Push down ai cavi': 25, 'Squat con bilanciere': 80, 'Stacco rumeno': 60, 'Leg press': 120, 'Affondi con manubri': 14, 'Leg curl': 35, 'Leg extension': 40, 'Calf raise': 50 },
    note: ['Panca piana', 'Scapole indietro e giù, piedi a terra. Sopra i 60 kg chiedi assistenza.'],
    light: ['Full body leggero', 'Scarico · due giorni leggeri'], other: 'Lat machine',
    importText: 'WORKOUT: Upper Lower di Marco\nSCHEDA: Upper @ lun 18:00\nPanca piana 4x8 60 kg rec 2:30\nLat machine 4x10\nAlzate laterali (manubri) 3x15\n- Gomiti appena piegati.\nSCHEDA: Lower @ gio 18:00\nSquat con bilanciere 4x8\nLeg curl 3x12\nAffondi in camminata 3x12\nPlank 3x45s',
  },
  en: {
    gym: 'FitLab Oxford', zones: ['Entrance and cardio', 'Machine room', 'Free weights', 'Cables and mats'],
    machines: [['C1–6', 'Treadmill', 0, 'treadmill'], ['C7', 'Bike', 0, 'bike'], ['C11', 'Elliptical', 0, 'elliptical'], ['C13', 'Rower', 0, 'rower'],
      ['M5', 'Lat pulldown', 1, '', 'Knees 2'], ['M6', 'Seated cable row', 1], ['M9', 'Chest press', 1, '', 'Seat 4'], ['M14', 'Leg press', 1, '', 'Back rest 3'], ['M18', 'Leg curl', 1],
      ['M21', 'Leg extension', 1], ['M23', 'Calf raise', 1], ['R1–2', 'Racks and benches', 2], ['DB', 'Dumbbells', 2], ['CAB', 'Cable tower', 3]],
    match: [[/treadmill/i, 'Treadmill'], [/bike/i, 'Bike'], [/elliptical/i, 'Elliptical'], [/rower/i, 'Rower'], [/lat pulldown/i, 'Lat pulldown'], [/seated cable/i, 'Seated cable row'], [/chest press/i, 'Chest press'],
      [/leg press/i, 'Leg press'], [/leg curl/i, 'Leg curl'], [/leg extension/i, 'Leg extension'], [/calf/i, 'Calf raise'], [/barbell|bench press|squat|deadlift|skull/i, 'Racks and benches'], [/dumbbell|hammer|lateral/i, 'Dumbbells'], [/cable|face pull|pushdown/i, 'Cable tower']],
    muscles: [[/bench|chest|fly/i, 'Chest'], [/curl(?!.*leg)|hammer/i, 'Biceps'], [/lat|row|face/i, 'Back'], [/skull|pushdown|dip/i, 'Triceps'], [/lateral/i, 'Shoulders'], [/squat|deadlift|leg|lunge|calf/i, 'Legs'], [/crunch|plank/i, 'Abs']],
    weights: { 'Bench press': 60, 'Incline dumbbell press': 22, 'Chest press': 50, 'Cable fly': 15, 'Barbell curl': 30, 'Incline dumbbell curl': 10, 'Hammer curl': 12,
      'Lat pulldown': 55, 'Barbell row': 50, 'Seated cable row': 45, 'Face pull': 17.5, 'Lateral raise': 8, 'Skull crusher': 25, 'Cable pushdown': 25, 'Barbell squat': 80, 'Romanian deadlift': 60, 'Leg press': 120, 'Dumbbell lunge': 14, 'Leg curl': 35, 'Leg extension': 40, 'Calf raise': 50 },
    note: ['Bench press', 'Shoulder blades back and down, feet flat. Ask for a spot above 60 kg.'],
    light: ['Light full body', 'Deload · two easy days'], other: 'Lat pulldown',
    importText: 'WORKOUT: Marco\'s upper lower\nROUTINE: Upper @ mon 18:00\nBench press 4x8 60 kg rest 2:30\nLat pulldown 4x10\nLateral raise (dumbbells) 3x15\n- Elbows slightly bent.\nROUTINE: Lower @ thu 18:00\nBarbell squat 4x8\nLeg curl 3x12\nWalking lunge 3x12\nPlank 3x45s',
  },
}[LANG];
const PLAN = fs.readFileSync(path.join(HERE, `sample-${LANG}.txt`), 'utf8');

async function seed({ T, PLAN, lang }) {
  const store = await import('/js/store.js');
  const { parseImport, runImport } = await import('/js/importer.js');
  const plans = await import('/js/plans.js');
  const { refreshEstimates } = await import('/js/data.js');
  const { upsert, uid, live, saveSettings, setPref } = store;
  const re = (x) => new RegExp(x.source, x.flags);
  await saveSettings({ lang, owner: 'tommaso', repo: 'palestra-data', branch: 'main', token: 'github_pat_fake' });
  setPref('gymName', T.gym);
  const zones = T.zones.map((name, i) => upsert('places', { id: uid(), name, order: i }));
  const M = {};
  for (const [number, name, zone, cardio, settings] of T.machines) {
    M[name] = upsert('machines', { id: uid(), number, name, placeId: zones[zone].id, settings: settings || '', kind: cardio ? 'cardio' : 'weights', ...(cardio ? { cardioKind: cardio } : {}) });
  }
  runImport(parseImport(PLAN).data, { asPlan: true });
  for (const ex of live('exercises')) {
    const m = T.match.find(([r]) => re(r).test(ex.name));
    const mu = T.muscles.find(([r]) => re(r).test(ex.name));
    upsert('exercises', { ...ex, ...(m ? { machineId: M[m[1]].id } : {}), muscles: ex.type === 'cardio' ? [] : [mu ? mu[1] : ''].filter(Boolean),
      ...(ex.name === T.note[0] ? { notes: T.note[1] } : {}) });
  }
  for (const r of live('routines')) {
    upsert('routines', { ...r, autoIncrease: true, items: r.items.map((it) => { const ex = live('exercises').find((e) => e.id === it.exerciseId); return ex && T.weights[ex.name] != null && !it.weight ? { ...it, weight: T.weights[ex.name] } : it; }) });
  }
  const main = live('plans')[0];
  plans.activate(main, '2026-10-05');
  const light = upsert('routines', { id: uid(), name: T.light[0], autoIncrease: false, order: 9,
    items: live('exercises').filter((e) => /tapis|treadmill|leg press|lat |plank|alzate|lateral/i.test(e.name)).slice(0, 5).map((e) => (e.type === 'cardio' ? { exerciseId: e.id, targets: { duration: 10, speed: 6 } } : { exerciseId: e.id, sets: 3, reps: 12, weight: Math.round((T.weights[e.name] || 10) * 0.7), rest: 60 })) });
  upsert('plans', { id: uid(), name: T.light[1], days: [{ routineId: light.id, weekday: 1, time: '07:30' }, { routineId: light.id, weekday: 4, time: '07:30' }] });
  // four weeks of sessions, Monday, Wednesday and Saturday, the weights going up a step a week
  const rs = plans.planDays(main).map((d) => live('routines').find((r) => r.id === d.routineId));
  const at = (mo, d, h, mi = 0) => new Date(2026, mo, d, h, mi).getTime();
  const days = [[9, 5, 0, 18], [9, 7, 1, 18], [9, 10, 2, 10], [9, 12, 0, 18], [9, 14, 1, 18], [9, 17, 2, 10], [9, 19, 0, 18], [9, 21, 1, 18], [9, 24, 2, 10], [9, 26, 0, 18], [9, 28, 1, 18], [9, 31, 2, 10]];
  days.forEach(([mo, d, ri, h], n) => {
    const r = rs[ri];
    const start = at(mo, d, h, 4);
    const week = Math.floor(n / 3);
    const sets = [];
    for (const it of r.items) {
      const ex = live('exercises').find((e) => e.id === it.exerciseId);
      if (!ex) continue;
      if (ex.type === 'cardio') { sets.push({ exerciseId: ex.id, targets: { ...(it.targets || {}) }, restTaken: 0 }); continue; }
      for (let k = 0; k < (it.sets || 3); k++) {
        sets.push({ exerciseId: ex.id, ...(it.seconds ? { seconds: it.seconds } : { reps: it.reps || 10 }), ...(ex.type === 'weights' ? { weight: Math.max(0, (it.weight || 0) - 7.5 + week * 2.5) } : {}), restTaken: (it.rest || 90) + (k % 2 ? 12 : -6) });
      }
    }
    const partial = n === 7;
    const minutes = 86 + ((n * 7) % 9);
    upsert('sessions', { id: uid(), routineId: r.id, start, end: start + minutes * 60000, minutes, sets: partial ? sets.slice(0, -6) : sets, outcome: partial ? 'partial' : 'done',
      breakdown: { work: minutes * 22, rest: minutes * 31, walk: minutes * 5, pause: 0 } });
  });
  // what Everyday planned: today at 18:00, Wednesday, Saturday
  setPref('planned', [{ blockId: 'blk-mon', routineId: rs[0].id, date: '2026-11-02', start: '18:00' }, { blockId: 'blk-wed', routineId: rs[1].id, date: '2026-11-04', start: '18:00' }, { blockId: 'blk-sat', routineId: rs[2].id, date: '2026-11-07', start: '10:30' }]);
  refreshEstimates();
  await new Promise((r) => setTimeout(r, 300));
  const { syncNow } = await import('/js/sync.js');
  await syncNow();
}

let now = new Date('2026-11-02T08:30:00+01:00').getTime(); // Monday 2 November 2026, 08:30 in Florence

(async () => {
  await new Promise((r) => setTimeout(r, 700)); // the server starting
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: DESK ? { width: 1440, height: 900 } : { width: 390, height: 780 }, deviceScaleFactor: DESK ? 1 : 2,
    locale: LANG === 'it' ? 'it-IT' : 'en-GB', timezoneId: 'Europe/Rome', serviceWorkers: 'block', colorScheme: DARK ? 'dark' : 'light',
  });
  await ctx.route('https://api.github.com/**', fakeGithub);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(now);
  await page.goto(base);
  await page.waitForSelector('.page-head');
  await page.evaluate(seed, { T: { ...T, match: T.match.map(([r, n]) => [{ source: r.source, flags: r.flags }, n]), muscles: T.muscles.map(([r, n]) => [{ source: r.source, flags: r.flags }, n]) }, PLAN, lang: LANG });
  await page.reload();
  await page.waitForSelector('.page-head');
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: '#toast{display:none!important} #update-bar{display:none!important} *{caret-color:transparent!important}' });

  const made = [];
  const go = async (hash, wait = 400) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(wait); };
  const shot = async (name) => {
    await page.waitForTimeout(250);
    const file = path.join(out, `${name}.png`);
    await page.screenshot({ path: file });
    made.push(name);
  };
  const ids = await page.evaluate(async ([other, note]) => {
    const { live } = await import('/js/store.js');
    const plans = await import('/js/plans.js');
    const main = plans.activeInfo().plan;
    const days = plans.planDays(main);
    return { plan: main.id, mon: days[0].routineId, wed: days[1].routineId, sat: days[2].routineId,
      ex: live('exercises').find((e) => e.name === other).id, bench: live('exercises').find((e) => e.name === note).id, cardio: live('exercises').find((e) => e.type === 'cardio').id,
      lightPlan: live('plans').find((p) => p.id !== main.id).id };
  }, [T.other, T.note[0]]);

  // Oggi
  await go('#/today'); await shot('01-today');
  await page.click('[data-move]'); await page.waitForTimeout(300); await shot('02-moved');
  await page.click('[data-unmove]'); await page.waitForTimeout(300);
  // Settings
  await page.evaluate(async () => (await import('/js/sync.js')).syncNow()); await page.waitForTimeout(500);
  await go('#/settings'); await shot('03-settings');
  await go('#/settings/github'); await shot('04-github');
  // Gym and exercises
  await go('#/gym'); await shot('05-gym');
  await page.click('.zone [data-add-machine]'); await page.waitForSelector('#modal[open]'); await shot('06-new-machine');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await go('#/exercises'); await shot('07-exercises');
  await go(`#/exercise/${ids.ex}`); await shot('08-exercise');
  await go(`#/exercise/${ids.cardio}`); await shot('09-exercise-cardio');
  // Schede
  await go(DESK ? `#/routines?sel=${ids.wed}` : '#/routines'); await shot('10-routines');
  await go(`#/routine/${ids.wed}`); await shot('11-routine');
  await go(`#/routine/${ids.wed}/edit`); await shot('12-routine-edit');
  await page.click('[data-action=add-item]'); await page.waitForSelector('#modal[open]'); await shot('13-add-exercise');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // Workout
  await go('#/plans'); await shot('14-plans');
  await go(`#/plan/${ids.plan}`); await shot('15-plan');
  await go('#/plans');
  await page.click(`[data-activate="${ids.lightPlan}"]`); await page.waitForSelector('#modal[open]'); await shot('16-activate');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // Importing
  await go('#/import?for=plan'); await page.fill('#imp-text', T.importText); await page.click('details.help summary'); await shot('17-import');
  await page.click('[data-action=read]'); await page.waitForSelector('.imp-day'); await shot('18-import-preview');
  // Everyday and the increase settings
  await go('#/settings/everyday'); await shot('26-everyday');
  await go('#/settings/increase'); await shot('27-increase-settings');
  // The workout: today's scheda, from the start button on Oggi, at 18:04
  now = new Date('2026-11-02T18:04:00+01:00').getTime();
  await page.clock.setFixedTime(now);
  await go('#/today');
  await page.click('.today-hero .btn.yellow');
  await page.waitForSelector('.inc-row'); await shot('19-increase');
  await page.click('[data-action=confirm]');
  await page.waitForSelector('.w-main'); await page.waitForTimeout(300);
  const tick = async (sec) => { now += sec * 1000; await page.clock.setFixedTime(now); await page.waitForTimeout(260); };
  await tick(4 * 60 + 12); await shot('22-cardio');
  let restShot = false; let setShot = false;
  for (let i = 0; i < 80 && !(await page.$('.summary')); i++) {
    if (await page.$('[data-action=end-rest]')) {
      await tick(75);
      if (!restShot && (await page.$('.ring')) && setShot) { await shot('21-rest'); restShot = true; }
      await page.click('[data-action=end-rest]');
    } else {
      await tick(40);
      if (!setShot && (await page.$('.w-note'))) { await shot('20-set'); setShot = true; }
      await (await page.$('[data-action=done]')).click();
    }
    await page.waitForTimeout(120);
  }
  await page.waitForSelector('.summary'); await tick(1); await shot('23-summary');
  await page.click('[data-action=close]'); await page.waitForTimeout(400);
  await page.evaluate(async () => (await import('/js/sync.js')).syncNow()); await page.waitForTimeout(500);
  await go(`#/history?ex=${ids.bench}`); await shot('24-history');
  const sid = await page.evaluate(async () => (await import('/js/data.js')).sessions()[0].id);
  await go(`#/session/${sid}`); await shot('25-session');

  await browser.close();
  server.kill();
  console.log(`${LANG}${DESK ? ' desk' : ''}: ${made.length} pictures in ${out}${errors.length ? `\nerrors: ${errors.join(' | ')}` : ''}`);
  if (errors.length) process.exit(1);
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });
