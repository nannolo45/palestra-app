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
  check((await page.textContent('.page-head h1')) === 'Allenamenti', 'opens on Allenamenti, in Italian');
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
  await page.click('.page-head [data-action=new-routine]');
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
  await go('#/routines');
  await page.waitForSelector('.hero');
  check((await page.textContent('.hero')).includes('Gambe'), 'next workout from Everyday shown');
  await shot('15-routines-next');
  await page.click('.hero .btn');
  await page.waitForSelector('.inc-row');
  await shot('16-increase', { fullPage: true });
  const incText = await page.textContent('.w-card.list');
  check(incText.includes('100') && incText.includes('102,5'), 'leg press 100 → 102,5 proposed');
  await page.click('[data-action=confirm]');
  await page.waitForSelector('.w-ex');
  await page.click('[data-action=end]');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForTimeout(200);

  console.log('Import a plan');
  const plan = fs.readFileSync('/home/claude/palestra-scheda-3-giorni.json', 'utf8');
  await go('#/settings/backup');
  await page.fill('#import-text', plan);
  await page.click('[data-action=import-text]');
  await page.waitForSelector('#confirm[open]');
  const msg = await page.textContent('#confirm p');
  check(msg.includes('A · Spinta') && msg.includes('Leg press') && msg.includes('Plank'), 'import preview reuses existing exercises');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForSelector('.page-head');
  await page.waitForTimeout(200);
  const names = await page.$$eval('.card-row .row-title', (els) => els.map((e) => e.textContent));
  check(['A · Spinta', 'B · Tirata', 'C · Gambe'].every((n) => names.includes(n)), 'three routines imported');
  const mins = await page.$$eval('.card-row .min-badge b', (els) => els.map((e) => Number(e.textContent)));
  check(mins.filter((m) => m >= 85 && m <= 120).length >= 3, `imported routines last 85–120 min (${mins.join(', ')})`);
  await shot('18-imported');
  await page.click('.card-row:has-text("C · Gambe")');
  await shot('19-imported-routine', { fullPage: true });

  console.log('A newer app raised the contract');
  const pr = JSON.parse(repo.get('data/prefs.json').text).map((p) => (p.id === 'contract' ? { ...p, value: 2, updatedAt: Date.now() + 2e9 } : p));
  repo.set('data/prefs.json', { text: JSON.stringify(pr), sha: `sha${++shaN}` });
  const routinesSha = repo.get('data/routines.json').sha;
  await go('#/routines');
  await page.click('.page-head [data-action=new-routine]');
  await page.waitForSelector('#r-name');
  await go('#/settings');
  await page.click('[data-action=sync]');
  await page.waitForTimeout(500);
  check(repo.get('data/routines.json').sha === routinesSha, 'stops writing when the contract is newer');
  check(Boolean(await page.$('.warn')), 'says to update the app');

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
