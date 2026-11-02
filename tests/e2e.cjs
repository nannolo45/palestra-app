// End-to-end test in a real browser: a fake GitHub (in memory) and a controlled clock.
// Run: node tests/e2e.cjs  (needs Playwright with Chromium). Screenshots go to tests/shots/.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// ---- static server ----
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff' };
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

// ---- fake GitHub contents API ----
const repo = new Map(); // path -> { text, sha }
let shaN = 0;
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const unb64 = (s) => Buffer.from(s, 'base64').toString('utf8');
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, accept, content-type, x-github-api-version', 'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS' };
async function fakeGithub(route) {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const real = route.fulfill.bind(route);
  route = { request: () => req, fulfill: (o) => real({ ...o, headers: { ...CORS, ...(o.headers || {}) } }) };
  const url = new URL(req.url());
  const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.*))?$/);
  if (!m) return route.fulfill({ status: 404, body: '{}' });
  if (req.headers().authorization !== 'Bearer test-token') return route.fulfill({ status: 401, body: '{}' });
  const p = m[3];
  if (p == null) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ private: true, permissions: { push: true } }) });
  if (req.method() === 'GET') {
    if (repo.has(p)) {
      const f = repo.get(p);
      if ((req.headers().accept || '').includes('raw')) return route.fulfill({ status: 200, body: f.text });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: f.sha, size: f.text.length, content: b64(f.text) }) });
    }
    const kids = [...repo.keys()].filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/'));
    if (kids.length) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kids.map((k) => ({ type: 'file', path: k, sha: repo.get(k).sha, size: repo.get(k).text.length }))) });
    return route.fulfill({ status: 404, body: '{}' });
  }
  if (req.method() === 'PUT') {
    const body = JSON.parse(req.postData());
    const cur = repo.get(p);
    if ((cur && cur.sha !== body.sha) || (!cur && body.sha)) return route.fulfill({ status: 409, body: '{}' });
    const sha = `sha${++shaN}`;
    repo.set(p, { text: unb64(body.content), sha });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha } }) });
  }
  return route.fulfill({ status: 405, body: '{}' });
}

let failures = 0;
function check(cond, msg) { if (cond) console.log(`  ok  ${msg}`); else { failures++; console.log(`  FAIL ${msg}`); } }

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', serviceWorkers: 'block' });
  await ctx.route('https://api.github.com/**', fakeGithub);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(2026, 9, 27, 18, 0) }); // Tue 27 Oct 2026, 18:00
  const shot = (n, opts = {}) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), ...opts });
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); };

  console.log('First run');
  await page.goto(base);
  await page.waitForSelector('.page-head h1');
  check((await page.textContent('.page-head h1')) === 'Oggi', 'opens on Oggi, in Italian');
  const tabs = await page.$$eval('nav.tabs a[data-tab]', (as) => as.filter((a) => a.getClientRects().length).map((a) => a.textContent.trim()));
  check(tabs.join('|') === 'Oggi|Workout|Schede|Esercizi|Storico', `five tabs (${tabs.join('|')})`);
  await shot('01-empty');

  console.log('Connect GitHub');
  await go('#/settings');
  await shot('02-settings');
  await go('#/settings/github');
  await page.fill('#gh-owner', 'nannolo45');
  await page.fill('#gh-token', 'test-token');
  await page.click('button[type=submit]');
  await page.waitForFunction(() => document.querySelector('[data-result]')?.textContent.includes('Sincronizzato'), null, { timeout: 5000 }).catch(async () => console.log('result:', await page.textContent('[data-result]'), errors));
  await page.waitForTimeout(300);
  check(!repo.has('data/contract.json') && JSON.parse(repo.get('data/prefs.json').text).some((p) => p.id === 'contract' && p.value === 1), 'contract version 1 kept in prefs, as in Ricette');

  console.log('Gym: zones and machines');
  await go('#/gym');
  for (const z of ['Ingresso e cardio', 'Sala pesi, fila 2', 'Zona tappetini']) {
    await page.click('[data-action=add-place]');
    await page.fill('#modal [name=name]', z);
    await page.click('#modal [value=save]');
    await page.waitForTimeout(100);
  }
  check((await page.$$('.zone')).length === 3, 'three zones');
  // a weights machine
  await page.click('.zone:nth-child(2) [data-add-machine]');
  await page.fill('#modal [name=name]', 'Leg press');
  await page.fill('#modal [name=number]', 'M14');
  await page.fill('#modal [name=settings]', 'Sedile 5 · schienale 3');
  await page.click('#modal [value=save]');
  // a cardio machine that isn't in the list: custom measures
  await page.click('.zone:nth-child(1) [data-add-machine]');
  await page.fill('#modal [name=name]', 'Air bike');
  await page.fill('#modal [name=number]', 'C15');
  await page.click('#modal .seg-opt:has(input[value=cardio])');
  await page.click('#modal [data-measure=watt]');
  await page.click('#modal [data-measure=calories]');
  await page.fill('#modal [name=cmLabel]', 'Programma');
  await page.click('#modal [data-add-custom]');
  check(await page.isDisabled('#modal [data-measure=speed]'), 'at most three extra measures');
  await shot('03-new-machine', { fullPage: true });
  await page.click('#modal [value=save]');
  await page.click('.zone:nth-child(1) [data-add-machine]');
  await page.fill('#modal [name=name]', 'Tapis roulant');
  await page.fill('#modal [name=number]', 'C1–6');
  await page.click('#modal .seg-opt:has(input[value=cardio])');
  await page.selectOption('#modal [name=cardioKind]', 'treadmill');
  await page.click('#modal [value=save]');
  await shot('04-gym');
  check((await page.$$('.machine-chip:not(.add)')).length === 3, 'three machines');

  console.log('Exercises');
  await go('#/exercise/new');
  await page.fill('#ex-name', 'Leg press');
  await page.selectOption('[name=machineId]', { label: 'M14 · Leg press' });
  await page.fill('#ex-muscles', 'Gambe');
  await page.fill('#ex-notes', 'Piedi a metà pedana, non bloccare le ginocchia');
  await page.click('[data-action=save]');
  await go('#/exercise/new');
  await page.fill('#ex-name', 'Tapis roulant');
  await page.click('.seg-opt:has(input[value=cardio])');
  await page.waitForSelector('[data-kind=treadmill]');
  await page.selectOption('[name=machineId]', { index: 1 });
  await page.fill('#ex-notes', 'Ritmo da poter parlare');
  await shot('05-cardio-card', { fullPage: true });
  await page.click('[data-action=save]');
  await go('#/exercise/new');
  await page.fill('#ex-name', 'Plank');
  await page.click('.seg-opt:has(input[value=bodyweight])');
  await page.fill('#ex-muscles', 'Core');
  await page.click('[data-action=save]');
  await go('#/exercises');
  await shot('06-exercises', { fullPage: true });
  check((await page.$$('.list-row')).length === 3, 'three exercises listed');
  await page.click('[data-type=cardio]');
  check((await page.$$('.list-row')).length === 1, 'type filter');
  await page.click('[data-type=all]');

  console.log('Routine');
  await go('#/routines');
  await page.click('.two-actions [data-action=new-routine]');
  await page.click('#modal [data-choice=empty]');
  await page.waitForSelector('#r-name');
  await page.fill('#r-name', 'Gambe');
  await page.press('#r-name', 'Tab');
  for (const name of ['Leg press', 'Tapis roulant', 'Plank']) {
    await page.click('[data-action=add-item]');
    await page.click(`#modal .pick:has-text("${name}")`);
  }
  await page.check('[name=autoIncrease]');
  // edit leg press: 2 sets of 10 at 100 kg, rest 60
  await page.click('[data-edit-item="0"]');
  await page.fill('#modal [name=sets]', '2');
  await page.fill('#modal [name=weight]', '100');
  await page.fill('#modal [name=rest]', '60');
  await page.click('#modal [value=save]');
  // move the treadmill first with the keyboard on its handle
  await page.waitForTimeout(1000);
  await page.focus('[data-sort-key="1"] .drag-handle');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await shot('07-routine-edit', { fullPage: true });
  await go('#/routines');
  await page.click('.card-row');
  await shot('08-routine', { fullPage: true });
  const firstEx = await page.textContent('.stack .card-row .row-title');
  check(firstEx === 'Tapis roulant', 'reordered: treadmill first');

  console.log('Workout from an Everyday block');
  await page.evaluate(() => { location.hash = location.hash.replace('#/routine/', '#/start/') + '?block=blk-1'; });
  await page.waitForSelector('.w-ex', { timeout: 4000 }).catch(async () => { await shot('debug-start'); console.log(page.url(), errors); });
  check((await page.textContent('.w-ex')) === 'Tapis roulant', 'starts with cardio');
  await shot('09-cardio');
  await page.clock.runFor(10 * 60 * 1000);
  await page.fill('[name=distance]', '1,6');
  await page.click('[data-action=done]');
  await page.waitForSelector('.ring');
  check((await page.textContent('.eyebrow')).includes('spostamento'), 'rest between exercises');
  await page.clock.runFor(30 * 1000);
  await shot('10-rest');
  await page.click('[data-action=end-rest]');
  await page.waitForSelector('.w-note');
  check((await page.textContent('.w-note')).includes('metà pedana'), 'note shown during the set');
  await shot('11-set');
  await page.clock.runFor(35 * 1000);
  await page.click('[data-action=done]');
  await page.clock.runFor(60 * 1000);
  await page.click('[data-action=pause]');
  await page.clock.runFor(120 * 1000);
  await shot('12-paused');
  await page.click('[data-action=resume]');
  await page.click('[data-action=end-rest]');
  await page.click('[data-action=done]');
  await page.click('[data-action=end-rest]');
  // plank: 3 sets
  for (let i = 0; i < 3; i++) {
    await page.clock.runFor(45 * 1000);
    await page.click('[data-action=done]');
    if (i < 2) await page.click('[data-action=end-rest]');
  }
  await page.waitForSelector('.summary');
  await shot('13-summary', { fullPage: true });
  check((await page.textContent('.summary')).includes('tutte le serie'), 'session complete');
  await page.click('[data-action=close]');
  await page.waitForSelector('.chart');
  await page.clock.runFor(5000);
  await page.waitForTimeout(300);
  await shot('14-history', { fullPage: true });

  console.log('Sync');
  await go('#/settings');
  await page.click('[data-action=sync]');
  await page.waitForTimeout(500);
  const sessFile = [...repo.keys()].find((k) => k.startsWith('data/sessions/'));
  check(sessFile === 'data/sessions/2026-10.json', 'session file sharded by month');
  const sess = JSON.parse(repo.get(sessFile).text)[0];
  check(sess.everydayBlockId === 'blk-1' && sess.outcome === 'done', 'session carries the Everyday block and outcome');
  check(sess.breakdown && sess.breakdown.pause === 120, 'pause counted apart');
  const routines = JSON.parse(repo.get('data/routines.json').text);
  check(routines[0].estMinutes > 10, `routine estMinutes written (${routines[0].estMinutes})`);

  console.log('Everyday plans the next one, a week later the increase is proposed');
  // Everyday writes the planned workouts into prefs
  const prefs = JSON.parse(repo.get('data/prefs.json')?.text || '[]').filter((p) => p.id !== 'planned');
  prefs.push({ id: 'planned', value: [{ blockId: 'blk-2', routineId: routines[0].id, date: '2026-11-05', start: '18:00' }], updatedAt: Date.now() + 1e9 });
  repo.set('data/prefs.json', { text: JSON.stringify(prefs), sha: `sha${++shaN}` });
  await page.clock.setFixedTime(new Date(2026, 10, 3, 18, 0));
  await page.click('[data-action=sync]');
  await page.waitForTimeout(500);
  await go('#/today');
  await page.waitForSelector('.today-hero');
  check((await page.textContent('.today-hero')).includes('Gambe'), 'next workout from Everyday shown');
  await shot('15-today-next');
  const gid = await page.evaluate(() => document.querySelector('.today-hero .hero-title').getAttribute('href').split('/').pop());
  await go(`#/routine/${gid}`);
  const lw = await page.$$eval('.last-w', (els) => els.map((e) => e.textContent).join(' | '));
  check(lw.includes('ultima 100 kg'), `last weight shown on the scheda (${lw})`);
  await go('#/today');
  await page.click('.today-hero .btn.yellow');
  await page.waitForSelector('.inc-row');
  await shot('16-increase', { fullPage: true });
  const incText = await page.textContent('.w-card.list');
  check(incText.includes('100') && incText.includes('102,5'), 'leg press 100 → 102,5 proposed');
  await page.click('[data-action=confirm]');
  await page.waitForSelector('.w-ex');
  await page.click('[data-action=end]');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForTimeout(200);

  console.log('Import a plan from JSON, then one from text, and make it active');
  const plan = fs.readFileSync('/home/claude/palestra-scheda-3-giorni.json', 'utf8');
  await go('#/import');
  await page.fill('#imp-text', plan);
  await page.click('[data-action=read]');
  await page.waitForSelector('.imp-day');
  check((await page.$$('.imp-day')).length === 3, 'JSON preview shows three days');
  check((await page.textContent('.lead')).includes('già tuoi'), 'preview counts exercises already yours');
  await page.click('[data-action=do-import]');
  await page.waitForSelector('[data-form=plan]');
  check((await page.inputValue('#p-name')).includes('Spinta'), 'JSON plan saved as a plan');
  check(await page.isChecked('[name=active]'), 'first plan made active');
  await go('#/today');
  await page.waitForSelector('.plan-hero');
  await shot('18-today-plan', { fullPage: true });
  const days = await page.$$eval('.day-home .row-title', (els) => els.map((e) => e.textContent));
  check(days.join('|') === 'A · Spinta|B · Tirata|C · Gambe', 'home shows the active plan\'s days');
  const mins = await page.$$eval('.day-home .row-sub', (els) => els.map((e) => Number(e.textContent.match(/(\d+) min/)[1])));
  check(mins.every((m) => m >= 85 && m <= 120), `days last 85–120 min (${mins.join(', ')})`);

  console.log('Compact exercise list');
  await go('#/exercises');
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  await shot('23-exercises-normal');
  await page.click('[data-action=density]');
  await page.waitForSelector('.list-row.compact');
  const short = await page.evaluate(() => document.documentElement.scrollHeight);
  check(short < tall * 0.85, `compact list is much shorter (${tall} → ${short})`);
  await shot('24-exercises-compact');
  await page.click('[data-action=toggle-all]');
  await page.waitForTimeout(100);
  check((await page.$$('.list-row')).length === 0, 'all groups closed');
  await page.click('.group-head button');
  await page.waitForTimeout(100);
  await shot('25-exercises-closed');
  check((await page.$$('.group .card.list')).length === 1, 'one group opened');
  await page.fill('#ex-q', 'panca');
  await page.waitForTimeout(100);
  check((await page.$$('.list-row')).length >= 1, 'search opens closed groups');
  await page.fill('#ex-q', '');
  await page.click('[data-action=toggle-all]');
  await page.click('[data-action=density]');

  const txt = fs.readFileSync(path.join(__dirname, 'sample-plan.txt'), 'utf8').replace('Curl con bilanciere 4x10 rec 1:30', 'Curl con bilanciere 4x10 rc 1:30');
  await go('#/import');
  await page.fill('#imp-text', txt);
  await page.click('[data-action=read]');
  await page.waitForSelector('.imp-day');
  await shot('19-import-preview', { fullPage: true });
  check((await page.$$('.imp-tag.q')).length === 1, 'the unreadable bit is flagged');
  check((await page.$$('.imp-tag.ok')).length >= 5, 'existing exercises recognised');
  await page.click('[data-action=do-import]');
  await page.waitForSelector('[data-form=plan]');
  await shot('20-plan-editor', { fullPage: true });
  check(!(await page.isChecked('[name=active]')), 'second plan not active yet');
  // move the legs day to Saturday
  await page.click('.day-row:nth-child(3) .wd[data-wd="5"]');
  await page.waitForTimeout(150);
  await page.fill('.day-row:nth-child(3) [data-time]', '10:30');
  await page.dispatchEvent('.day-row:nth-child(3) [data-time]', 'change');
  await page.waitForTimeout(150);
  // make it active from Monday
  await page.click('.toggle-row:has([name=active])');
  await page.waitForSelector('#modal[open] .option');
  await shot('21-activate', { fullPage: true });
  await page.click('#modal [value=ok]');
  await page.waitForTimeout(200);
  await go('#/plans');
  await page.waitForSelector('.plan-card.active');
  check((await page.textContent('.plan-card.active .plan-name')).includes('Spinta'), 'this week stays on the old plan');
  check((await page.textContent('.stack')).includes('Dalla prossima settimana'), 'the new plan is shown as coming next week');
  await shot('22-plans');
  await go('#/settings');
  await page.click('[data-action=sync]');
  await page.waitForTimeout(600);
  const ap = JSON.parse(repo.get('data/prefs.json').text).find((p) => p.id === 'activePlan').value;
  check(ap.days.length === 3 && ap.days[2].weekday === 5 && ap.days[0].weekday === 0, 'activePlan in prefs has days and weekdays');
  check(ap.days[2].time === '10:30' && !('time' in ap.days[0]), 'optional time only where set');
  check(ap.from === '2026-11-09', `active from next Monday (${ap.from})`);
  check(ap.previous && ap.previous.days.length === 3, 'the plan in force until then is in the record too');
  await page.clock.setFixedTime(new Date(2026, 10, 9, 9, 0));
  await go('#/today');
  await page.waitForSelector('.plan-hero');
  check((await page.textContent('.plan-hero-name')).includes('Petto e bicipiti'), 'on Monday the new plan is in force');
  check((await page.textContent('.today-hero .hero-title')) === 'Petto e bicipiti', 'today\'s scheda is Monday\'s');
  await page.click('[data-move]');
  await page.waitForTimeout(150);
  const moves = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('palestra'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('kv').objectStore('kv').get('prefs'); q.onsuccess = () => r((q.result || []).find((p) => p.id === 'moves')?.value); });
  });
  check(moves && moves[0].from === '2026-11-09' && moves[0].to === '2026-11-10', `moved to tomorrow in prefs (${JSON.stringify(moves)})`);
  check((await page.textContent('.day-home')).includes('Spostata'), 'the week shows it moved');
  await shot('19-moved');
  await page.click('[data-unmove]');
  await page.waitForTimeout(150);
  check(Boolean(await page.$('[data-move]')), 'back to today');

  console.log('Duplicate a scheda into another workout');
  await go('#/routines');
  const nPlans = (await page.$$('.lib-row')).length;
  await page.click('.lib-row');
  await page.click('[data-action=duplicate-to]');
  await page.waitForSelector('#modal[open] .pick');
  await page.click('#modal .pick');
  await page.waitForSelector('[data-form=plan]');
  check((await page.$$('.day-row')).length === 4, 'the copy joined the other workout');
  await go('#/routines');
  check((await page.$$('.lib-row')).length === nPlans + 1, 'the copy is in the library');
  await page.click('[data-filter=none]');
  await page.waitForTimeout(100);
  check((await page.$$('.lib-row')).length >= 1, 'filter: schede in no workout');
  await page.click('[data-filter=all]');
  check(repo.has('data/plans.json') && JSON.parse(repo.get('data/plans.json').text).length === 2, 'plans synced');

  console.log('New routine by importing text');
  await go('#/routines');
  await page.click('[data-action=new-routine]');
  await page.click('#modal [data-choice=import]');
  await page.waitForSelector('#imp-text');
  check((await page.textContent('.title')) === 'Importa una scheda', 'import opened for a routine');
  await page.fill('#imp-text', 'Panca piana 4x8 rec 2:30\nCroci ai cavi 3x12\nPlank 3x45s');
  await page.click('[data-action=read]');
  await page.waitForSelector('.imp-day');
  check(!(await page.$('[name=asPlan]')), 'a single routine is not offered as a plan');
  await page.click('[data-action=do-import]');
  await page.waitForSelector('.page-head');
  check((await page.textContent('#view')).includes('Scheda'), 'routine imported');
  await go('#/plans');
  await page.click('[data-action=new-plan]');
  await page.click('#modal [data-choice=import]');
  await page.waitForSelector('#imp-text');
  check((await page.textContent('.title')) === 'Importa un workout', 'import opened for a plan');

  console.log('A newer app raised the contract');
  const pr = JSON.parse(repo.get('data/prefs.json').text).map((p) => (p.id === 'contract' ? { ...p, value: 2, updatedAt: Date.now() + 2e9 } : p));
  repo.set('data/prefs.json', { text: JSON.stringify(pr), sha: `sha${++shaN}` });
  const routinesSha = repo.get('data/routines.json').sha;
  await go('#/routines');
  await page.click('[data-action=new-routine]');
  await page.click('#modal [data-choice=empty]');
  await page.waitForSelector('#r-name');
  await go('#/settings');
  await page.click('[data-action=sync]');
  await page.waitForTimeout(500);
  check(repo.get('data/routines.json').sha === routinesSha, 'stops writing when the contract is newer');
  check(Boolean(await page.$('.warn')), 'says to update the app');


  console.log('Nothing scrolls sideways on a narrow phone');
  const overflowAt = async (label) => {
    const bad = await page.evaluate(() => {
      const W = window.innerWidth;
      const out = [];
      if (document.scrollingElement.scrollWidth > W + 1) out.push(`page ${document.scrollingElement.scrollWidth}px`);
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('.sr') || el.closest('nav.tabs') || !el.getClientRects().length) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed') continue;
        const scrollsX = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
        const r = el.getBoundingClientRect();
        const sticksOut = r.right > W + 1 && !el.closest('[style*="transform"]');
        if (scrollsX || sticksOut) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').join('.')} ${scrollsX ? 'scrolls' : `ends at ${Math.round(r.right)}px`}`);
      }
      return [...new Set(out)].slice(0, 6);
    });
    check(bad.length === 0, `${label}: nothing wider than the screen${bad.length ? ` (${bad.join('; ')})` : ''}`);
  };
  await page.setViewportSize({ width: 320, height: 700 });
  const planId = await page.evaluate(() => location.hash);
  const ids = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('palestra'); q.onsuccess = () => r(q.result); });
    const get = (k) => new Promise((r) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result || []); });
    const live = (xs) => xs.filter((x) => !x.deleted);
    return { r: live(await get('routines'))[0].id, p: live(await get('plans'))[0].id, e: live(await get('exercises')).find((x) => x.type === 'weights').id,
      c: live(await get('exercises')).find((x) => x.type === 'cardio').id, s: live(await get('sessions'))[0].id };
  });
  const routes = ['#/today', '#/routines', '#/plans', `#/plan/${ids.p}`, '#/import', '#/import?for=routine', '#/exercises', `#/exercise/${ids.e}`, `#/exercise/${ids.c}`, '#/exercise/new',
    '#/gym', '#/history', `#/session/${ids.s}`, `#/routine/${ids.r}`, `#/routine/${ids.r}/edit`, '#/settings',
    ...['github', 'increase', 'training', 'gym', 'everyday', 'lang', 'backup', 'guide'].map((x) => `#/settings/${x}`)];
  for (const r of routes) { await go(r); await page.waitForTimeout(120); await overflowAt(r); if (['#/exercises', '#/settings/increase', '#/routines'].includes(r)) await shot(`narrow-${r.replace(/\W+/g, '-')}`); }
  await go('#/import');
  await page.fill('#imp-text', `SCHEDA: Una scheda con un nome molto molto lungo per vedere se va a capo\nGIORNO: Un allenamento dal nome lunghissimo che non finisce mai\nPanca piana con bilanciere e fermo al petto 4x8 60 kg rec 2:30\nUnaparolalunghissimasenzaspazichenonfiniscemaieancoraeancora 3x10`);
  await overflowAt('import text with long lines');
  await page.click('details.help summary');
  await overflowAt('import help');
  await page.click('[data-action=read]');
  await page.waitForSelector('.imp-day');
  await overflowAt('import preview');
  await go('#/exercises');
  await page.click('[data-action=density]');
  await overflowAt('compact exercises');
  await page.click('[data-action=density]');
  await go('#/gym');
  await page.click('.zone [data-add-machine]');
  await page.click('#modal .seg-opt:has(input[value=cardio])');
  await overflowAt('new machine sheet');
  await page.keyboard.press('Escape');
  await go(`#/plan/${ids.p}`);
  await page.click('[data-action=add-day]');
  await overflowAt('add routine sheet');
  await page.keyboard.press('Escape');
  await go(`#/start/${ids.r}`);
  await page.waitForTimeout(300);
  if (await page.$('.inc-row')) { await overflowAt('weekly increase'); await page.click('[data-action=skip]'); }
  await page.waitForSelector('.w-main');
  await overflowAt('workout: first step');
  await shot('narrow-workout');
  await page.clock.runFor(500); // let the page's frames run before clicking below the fold
  await (await page.$('[data-action=done]')).click();
  await page.waitForSelector('.ring');
  await overflowAt('workout: rest');
  await page.click('[data-action=end-rest]');
  await page.waitForTimeout(100);
  await overflowAt('workout: next step');
  await page.click('[data-action=end]');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForSelector('.summary');
  await overflowAt('workout: summary');
  await page.click('[data-action=close]');
  console.log('Import into a scheda being edited');
  const before = await page.evaluate(async (rid) => {
    const db = await new Promise((r) => { const q = indexedDB.open('palestra'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('kv').objectStore('kv').get('routines'); q.onsuccess = () => r(q.result.filter((x) => !x.deleted).length); });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await go(`#/routine/${ids.r}/edit`);
  const nItems = (await page.$$('.edit-row')).length;
  await page.click('.two-actions a[href*="into="]');
  await page.waitForSelector('#imp-text');
  await page.fill('#imp-text', 'Curl con manubri 3x10 12 kg');
  await page.click('[data-action=read]');
  await page.waitForSelector('[data-action=do-import]');
  check((await page.textContent('[data-action=do-import]')).startsWith('Aggiungi a'), 'import offers to add to the scheda');
  await page.click('[data-action=do-import]');
  await page.waitForSelector('[data-form=routine]');
  check((await page.$$('.edit-row')).length === nItems + 1, 'exercise added to the scheda');
  const after = await page.evaluate(async () => {
    const db = await new Promise((r) => { const q = indexedDB.open('palestra'); q.onsuccess = () => r(q.result); });
    return new Promise((r) => { const q = db.transaction('kv').objectStore('kv').get('routines'); q.onsuccess = () => r(q.result.filter((x) => !x.deleted).length); });
  });
  check(after === before, 'no extra scheda left behind');

  console.log('Desktop');
  await page.setViewportSize({ width: 1280, height: 820 });
  await go('#/today');
  await page.waitForTimeout(200);
  const nav = await page.evaluate(() => { const r = document.querySelector('nav.tabs').getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width }; });
  check(nav.top === 0 && nav.h < 80 && nav.w === 1280, `tabs in a top bar, as in Ricette and Everyday (${JSON.stringify(nav)})`);
  const gear = await page.evaluate(() => { const r = document.querySelector('nav.tabs .nav-gear').getBoundingClientRect(); return r.right > 1180 && r.top < 64; });
  check(gear, 'settings gear at the top right');
  const colsOk = await page.evaluate(() => { const m = document.querySelector('.col-main').getBoundingClientRect(); const s = document.querySelector('.col-side').getBoundingClientRect(); return s.left > m.right - 1 && Math.abs(s.top - m.top) < 4; });
  check(colsOk, 'Oggi in two columns');
  await shot('d1-today');
  await go('#/routines');
  await page.waitForSelector('.md-pane .title');
  check(Boolean(await page.$('#nav-actions [data-action=new-routine]')) && !(await page.$('#view [data-top-actions]')), 'Nuova scheda · Importa moved to the top bar');
  await page.click('#nav-actions [data-action=new-routine]');
  check(Boolean(await page.$('#modal[open] [data-choice]')), 'the moved button still works');
  await page.keyboard.press('Escape');
  check(Boolean(await page.$('.lib-row.selected')), 'Schede: list and detail side by side');
  await page.click('.lib-row:not(.selected)');
  await page.waitForTimeout(150);
  check(page.url().includes('sel='), 'picking a scheda keeps the list');
  await shot('d2-routines');
  await go(`#/routine/${ids.r}/edit`);
  await page.waitForSelector('.ex-lib');
  const n0 = (await page.$$('.edit-row')).length;
  await page.click('.ex-lib .lib-ex:not(.is-in) [data-lib-add]');
  await page.waitForTimeout(200);
  check((await page.$$('.edit-row')).length === n0 + 1, 'library panel adds an exercise');
  await shot('d3-editor');
  await go('#/exercises');
  await page.waitForTimeout(150);
  const gcols = await page.evaluate(() => getComputedStyle(document.querySelector('.groups')).gridTemplateColumns.split(' ').length);
  check(gcols >= 2, `exercise groups in a grid (${gcols})`);
  await shot('d4-exercises');
  await go('#/history');
  await shot('d5-history');
  await go('#/plans');
  await shot('d6-plans');
  for (const r of ['#/today', '#/routines', '#/plans', `#/plan/${ids.p}`, '#/exercises', '#/gym', '#/history', `#/routine/${ids.r}/edit`, '#/settings']) { await go(r); await page.waitForTimeout(100); await overflowAt(`desktop ${r}`); }
  await go('#/settings/guide');
  await page.waitForTimeout(150);
  const dsrc = await page.$$eval('.guide-shot img', (xs) => xs.map((x) => x.getAttribute('src')));
  check(dsrc.length > 10 && dsrc.every((x) => x.startsWith('guide/desktop/')), `guide on a computer shows desktop screenshots (${dsrc.length})`);
  await shot('d7-guide');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  check(!(await page.$('#nav-actions [data-action]')), 'top bar actions cleared on the phone');
  const psrc = await page.$$eval('.guide-shot img', (xs) => xs.map((x) => x.getAttribute('src')));
  check(psrc.length > 10 && psrc.every((x) => x.startsWith('guide/phone/')), `guide on a phone shows phone screenshots (${psrc.length})`);
  await go('#/routines');
  check(Boolean(await page.$('#view .two-actions [data-action=new-routine]')), 'on the phone the actions stay in the page');

  console.log('English');
  await go('#/settings/lang');
  await page.click('.seg-opt:has(input[value=en])');
  await go('#/settings/guide');
  await shot('17-guide-en', { fullPage: true });
  check((await page.textContent('.title')) === 'Guide', 'guide in English');

  check(errors.length === 0, `no errors in the page${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
