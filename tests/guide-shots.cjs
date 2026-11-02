// Screenshots for the guide, from the real app, in both layouts: guide/phone/*.jpg (390×844) and guide/desktop/*.jpg
// (1280×800). The names are the ones js/guide.js asks for. Run: node tests/guide-shots.cjs
// A clean sample gym is seeded in the browser through the app's own modules (no GitHub), on a fixed Wednesday.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const NOW = new Date(2026, 10, 11, 17, 20); // Wednesday 11 November 2026, 17:20
const PLAN_TEXT = fs.readFileSync(path.join(__dirname, 'sample-plan.txt'), 'utf8');

// runs in the page: builds the sample data with the app's modules
async function seed(planText) {
  const store = await import('/js/store.js');
  const { parseImport, runImport } = await import('/js/importer.js');
  const plans = await import('/js/plans.js');
  const { refreshEstimates } = await import('/js/data.js');
  const { upsert, uid, live, saveSettings, setPref } = store;
  await saveSettings({ lang: 'it' });
  setPref('gymName', 'FitLab Centro');
  const zones = ['Ingresso e cardio', 'Sala macchine', 'Pesi liberi', 'Cavi e tappetini'].map((name, i) => upsert('places', { id: uid(), name, order: i }));
  const M = {};
  const mk = (number, name, zone, extra = {}) => { M[name] = upsert('machines', { id: uid(), number, name, placeId: zones[zone].id, settings: '', ...extra }); };
  mk('C1–6', 'Tapis roulant', 0, { kind: 'cardio', cardioKind: 'treadmill' }); mk('C7', 'Bike', 0, { kind: 'cardio', cardioKind: 'bike' });
  mk('C11', 'Ellittica', 0, { kind: 'cardio', cardioKind: 'elliptical' }); mk('C13', 'Vogatore', 0, { kind: 'cardio', cardioKind: 'rower' });
  mk('M5', 'Lat machine', 1, { settings: 'Ginocchia 2' }); mk('M6', 'Pulley basso', 1); mk('M9', 'Chest press', 1, { settings: 'Sedile 4' });
  mk('M14', 'Leg press', 1, { settings: 'Schienale 3' }); mk('M18', 'Leg curl', 1); mk('M21', 'Leg extension', 1); mk('M23', 'Calf raise', 1);
  mk('R1–2', 'Rack e panche', 2); mk('MAN', 'Manubri', 2); mk('CAV', 'Torre cavi', 3);
  const { data } = parseImport(planText);
  const out = runImport(data, { asPlan: true });
  const MUSCLE = [[/panca|chest|croci/i, 'Petto'], [/curl|martello/i, 'Bicipiti'], [/lat|rematore|pulley|face/i, 'Dorsali'], [/french|push down|dip/i, 'Tricipiti'], [/alzate|lento/i, 'Spalle'],
    [/squat|stacco|leg|affondi|calf/i, 'Gambe'], [/crunch|plank/i, 'Addome']];
  const MACH = [[/tapis/i, 'Tapis roulant'], [/bike/i, 'Bike'], [/ellittica/i, 'Ellittica'], [/vogatore/i, 'Vogatore'], [/lat machine/i, 'Lat machine'], [/pulley/i, 'Pulley basso'], [/chest press/i, 'Chest press'],
    [/leg press/i, 'Leg press'], [/leg curl/i, 'Leg curl'], [/leg extension/i, 'Leg extension'], [/calf/i, 'Calf raise'], [/bilanciere|panca piana|squat|stacco|french/i, 'Rack e panche'], [/manubri|martello|alzate|affondi/i, 'Manubri'], [/cavi|face pull|push down/i, 'Torre cavi']];
  const W = { 'Panca piana': 60, 'Panca inclinata con manubri': 22, 'Chest press': 50, 'Croci ai cavi': 15, 'Curl con bilanciere': 30, 'Curl su panca inclinata': 10, 'Curl a martello': 12, 'Crunch ai cavi': 25,
    'Lat machine': 55, 'Rematore con bilanciere': 50, 'Pulley basso': 45, 'Face pull': 17.5, 'Alzate laterali': 8, 'French press': 25, 'Push down ai cavi': 25, 'Squat con bilanciere': 80, 'Stacco rumeno': 60, 'Leg press': 120, 'Leg curl': 35, 'Leg extension': 40, 'Calf raise': 50 };
  for (const ex of live('exercises')) {
    const m = MACH.find(([re]) => re.test(ex.name));
    const mu = MUSCLE.find(([re]) => re.test(ex.name));
    upsert('exercises', { ...ex, ...(m ? { machineId: M[m[1]].id } : {}), muscles: ex.type === 'cardio' ? [] : [mu ? mu[1] : 'Altro'],
      ...(ex.name === 'Lat machine' ? { notes: 'Presa poco più larga delle spalle. Tira al petto, non dietro la nuca.' } : {}) });
  }
  // the weights the plan left to choose: filled in as after a first session
  for (const r of live('routines')) {
    upsert('routines', { ...r, autoIncrease: true, items: r.items.map((it) => { const ex = live('exercises').find((e) => e.id === it.exerciseId); return ex && W[ex.name] != null && !it.weight ? { ...it, weight: W[ex.name] } : it; }) });
  }
  // a time for the days, and the plan active since three weeks ago
  const plan = live('plans')[0];
  plans.savePlan({ ...plan, days: plan.days.map((d, i) => ({ ...d, time: i === 2 ? '10:30' : '18:00' })) });
  plans.activate(live('plans')[0], '2026-10-19');
  // a second workout, kept for later
  const light = upsert('routines', { id: uid(), name: 'Full body leggero', autoIncrease: false, order: 9, items: live('exercises').filter((e) => /Tapis|Leg press|Lat machine|Plank|Alzate/.test(e.name)).map((e) => (e.type === 'cardio' ? { exerciseId: e.id, targets: { duration: 10, speed: 6 } } : { exerciseId: e.id, sets: 3, reps: 12, weight: Math.round((W[e.name] || 10) * 0.7), rest: 60 })) });
  upsert('plans', { id: uid(), name: 'Scarico · due giorni leggeri', days: [{ routineId: light.id, weekday: 1, time: '07:30' }] });
  // sessions: three a week since 19 October, weights going up, the last one on Monday
  const rs = plans.planDays(live('plans').find((p) => p.days.length === 3)).map((d) => live('routines').find((r) => r.id === d.routineId));
  const day = (y, mo, d, h) => new Date(y, mo, d, h, 0).getTime();
  const dates = [[19, 0], [21, 1], [23, 2], [26, 0], [28, 1], [30, 2], [2, 0], [4, 1], [6, 2], [9, 0]];
  dates.forEach(([d, ri], n) => {
    const mo = d >= 19 && n < 6 ? 9 : 10;
    const r = rs[ri];
    const start = day(2026, mo, d, 18);
    const bump = Math.floor(n / 3) * 2.5;
    const sets = [];
    for (const it of r.items) {
      const ex = live('exercises').find((e) => e.id === it.exerciseId);
      if (!ex) continue;
      if (ex.type === 'cardio') { sets.push({ exerciseId: ex.id, targets: { ...(it.targets || {}) }, restTaken: 0 }); continue; }
      for (let k = 0; k < (it.sets || 3); k++) sets.push({ exerciseId: ex.id, reps: (it.reps || 10) - (k === 3 ? 1 : 0), weight: ex.type === 'weights' ? Math.max(0, (it.weight || 0) - 7.5 + bump) : undefined, restTaken: it.rest || 90 });
    }
    const minutes = 84 + (n % 3) * 4;
    upsert('sessions', { id: uid(), routineId: r.id, start, end: start + minutes * 60000, minutes, sets: n === 4 ? sets.slice(0, -4) : sets, outcome: n === 4 ? 'partial' : 'done', breakdown: { work: minutes * 25, rest: minutes * 30, walk: minutes * 5, pause: 0 } });
  });
  refreshEstimates();
  await new Promise((r) => setTimeout(r, 400));
  return out.created.length;
}

const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

(async () => {
  const { shotNames } = await import(path.join(ROOT, 'js/guide.js'));
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];
  for (const [device, opts] of Object.entries(DEVICES)) {
    const want = new Set(shotNames(device));
    const dir = path.join(ROOT, 'guide', device);
    fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ ...opts, locale: 'it-IT', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${device}: ${e.message}`));
    await page.clock.setFixedTime(NOW);
    await page.goto(base);
    await page.waitForSelector('.page-head');
    await page.evaluate(seed, PLAN_TEXT);
    await page.reload();
    await page.waitForSelector('.page-head');
    await page.addStyleTag({ content: '#toast{display:none!important} .update-bar{display:none!important}' });
    const go = async (hash, wait = 350) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(wait); };
    const made = new Set();
    const shot = async (name) => {
      if (!want.has(name)) return;
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(dir, `${name}.jpg`), type: 'jpeg', quality: device === 'phone' ? 68 : 74 });
      made.add(name);
    };
    const ids = await page.evaluate(async () => {
      const { live } = await import('/js/store.js');
      const r = live('routines');
      return { routine: r.find((x) => x.name === 'Schiena e tricipiti').id, plan: live('plans').find((p) => p.days.length === 3).id, ex: live('exercises').find((e) => e.name === 'Lat machine').id };
    });
    await go('#/today'); await shot('today');
    if (want.has('today-moved')) { await page.click('[data-move]'); await page.waitForTimeout(300); await shot('today-moved'); await page.click('[data-unmove]'); await page.waitForTimeout(200); }
    await go('#/plans'); await shot('plans');
    await go(`#/plan/${ids.plan}`); await shot('plan');
    await go(device === 'desktop' ? `#/routines?sel=${ids.routine}` : '#/routines'); await shot('routines');
    await go(`#/routine/${ids.routine}`); await shot('routine');
    await go(`#/routine/${ids.routine}/edit`); await shot('routine-edit');
    await go('#/exercises'); await shot('exercises');
    await go(`#/exercise/${ids.ex}`); await shot('exercise');
    await go('#/gym'); await shot('gym');
    await go('#/history'); await shot('history');
    await go('#/settings'); await shot('settings');
    await go('#/settings/increase'); await shot('increase');
    await go('#/import?for=plan');
    await page.fill('#imp-text', 'WORKOUT: Upper Lower\nSCHEDA: Upper @ lun 18:00\nPanca piana 4x8 60 kg rec 2:30\nLat machine 4x10\nAlzate laterali 3x15\nSCHEDA: Lower @ gio 18:00\nSquat con bilanciere 4x8\nLeg curl 3x12\nAffondi in camminata 3x12\nPlank 3x45s');
    await page.click('[data-action=read]'); await page.waitForSelector('.imp-day'); await shot('import');
    await go(`#/start/${ids.routine}`, 800);
    if (await page.$('.inc-row')) await page.click('[data-action=skip]');
    await page.waitForSelector('.w-main');
    // past the cardio warm-up, to a set with weight
    if (await page.$('[name=distance]')) { await page.click('[data-action=done]'); await page.waitForTimeout(300); if (await page.$('[data-action=end-rest]')) await page.click('[data-action=end-rest]'); }
    await page.waitForTimeout(300); await shot('workout');
    await page.click('[data-action=done]'); await page.waitForSelector('.ring'); await page.waitForTimeout(200); await shot('rest');
    const missing = [...want].filter((n) => !made.has(n));
    console.log(`${device}: ${made.size} screenshots${missing.length ? `, MISSING ${missing.join(', ')}` : ''}`);
    if (missing.length) errors.push(`${device} missing ${missing}`);
    await ctx.close();
  }
  await browser.close();
  srv.close();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
