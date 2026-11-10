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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.webp': 'image/webp' };
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
  // exercise drawings: served from a local copy of free-exercise-db (git sparse checkout in /tmp/fedb), grey square otherwise
  await ctx.route('https://raw.githubusercontent.com/yuhonas/free-exercise-db/**', (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^\/yuhonas\/free-exercise-db\/main\//, ''));
    const f = path.join(process.env.FEDB || '/tmp/fedb', rel);
    if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(f) });
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#ccc"/></svg>' });
  });
  const page = await ctx.newPage();
  // v30: every tone the app plays, by frequency (1318 = bell, 1500 = tick)
  await page.addInitScript(() => {
    window.__tones = [];
    const st = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__tones.push(Math.round(this.frequency.value)); return st.apply(this, a); };
  });
  const tones = () => page.evaluate(() => { const x = window.__tones; window.__tones = []; return x; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(2026, 9, 27, 18, 0) }); // Tue 27 Oct 2026, 18:00
  const shot = (n, opts = {}) => page.screenshot({ path: path.join(SHOTS, `${n}.png`), ...opts });
  const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); };
  // v27 builders: press, move in steps, let go over the target
  const dragTo = async (from, to) => {
    await page.$eval(to, (el) => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(100);
    const a = await (await page.$(from)).boundingBox(); await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
    const b = await (await page.$(to)).boundingBox();
    await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 3 });
    const b2 = await (await page.$(to)).boundingBox();
    await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(250);
    return b;
  };
  // v26: Filtri opens a panel under the search (not a sheet); its Fine closes it
  const kitSheet = async (fn) => { await page.click('.kit-tools [data-kit-panel]'); await page.waitForSelector('.kit-panel'); await fn(); await page.click('.kit-panel-foot [data-kit-panel]'); await page.waitForTimeout(150); };
  const kitFac = (key, v) => kitSheet(() => page.click(`.kit-panel [data-fac="${key}|${v}"]`));

  console.log('First run');
  await page.goto(base);
  await page.waitForSelector('.page-head h1');
  check((await page.textContent('.page-head h1')) === 'Oggi', 'opens on Oggi, in Italian');
  const tabs = await page.$$eval('nav.tabs a[data-tab]', (as) => as.filter((a) => a.getClientRects().length).map((a) => a.textContent.trim()));
  check(tabs.join('|') === 'Oggi|Allenamento|Palestra|Storico', `four sections (${tabs.join('|')})`);
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
  await page.click('[data-mus=quadriceps]');
  check(await page.$eval('[data-mus=quadriceps]', (b) => b.classList.contains('main')), 'a muscle chosen is the main one');
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
  check(await page.$eval('[data-mus=abs]', (b) => b.classList.contains('guess')), 'Plank: abs recognised from the name');
  await page.click('[data-action=save]');
  // what the weight means, for dumbbells
  await go('#/exercise/new');
  await page.selectOption('[name=equipment]', 'dumbbell');
  await page.waitForSelector('[name=weightAs]');
  check(await page.isChecked('[name=weightAs][value=each]') && await page.isChecked('[name=dumbbells][value="2"]'), 'dumbbells: per dumbbell, two of them, by default');
  await page.click('.seg-opt:has(input[name=weightAs][value=total])');
  check(!(await page.$('[name=dumbbells]')), 'in all: no count');
  await page.selectOption('[name=equipment]', 'barbell');
  check(await page.isChecked('[name=weightAs][value=total]'), 'barbell: with the bar by default');
  await page.selectOption('[name=equipment]', 'machine');
  check(!(await page.$('[name=weightAs]')), 'a machine: plain kg');
  await go('#/exercises');
  await shot('06-exercises', { fullPage: true });
  check((await page.$$('.list-row')).length === 3, 'three exercises listed');
  await kitFac('type', 'cardio');
  check((await page.$$('.list-row')).length === 1 && (await page.$$('.kit-on')).length === 1, 'type filter, shown as a tag');
  await page.click('.kit-on');
  await page.waitForTimeout(100);
  check((await page.$$('.list-row')).length === 3, 'the ✕ takes the filter off');

  console.log('Pictures');
  check(Boolean(await page.$('.pic-prompt')), 'Esercizi offers to match pictures');
  await page.click('.list-row:has-text("Leg press")');
  await page.waitForSelector('[data-action=pick-picture]');
  await page.click('[data-action=pick-picture]');
  await page.waitForSelector('#modal .pic-cand');
  check((await page.textContent('#modal .pic-cand span')).includes('Leg Press'), `first suggestion for Leg press (${await page.textContent('#modal .pic-cand span')})`);
  await page.fill('#pic-q', 'panca');
  await page.waitForTimeout(400);
  check((await page.textContent('#modal .pic-grid')).includes('Bench'), 'the search takes Italian');
  await page.fill('#pic-q', '');
  await page.waitForTimeout(400);
  await page.click('#modal .pic-cand >> nth=0');
  await shot('p1-picker', { fullPage: true });
  await page.click('#modal [value=ok]');
  await page.waitForSelector('.pic-card');
  check((await page.$$('.pic-frames button')).length === 2, 'start and end positions');
  await page.click('.pic-frames [data-frame="1"]');
  check((await page.getAttribute('.pic-frame img', 'src')).endsWith('/1.jpg'), 'the end position shows the second drawing');
  // your own photo of the machine
  const jpg = fs.readdirSync('/tmp/fedb/exercises').map((d) => path.join('/tmp/fedb/exercises', d, '0.jpg')).find((f) => fs.existsSync(f));
  if (jpg) {
    await page.setInputFiles('[data-photo-for]', jpg);
    await page.waitForSelector('.machine-photo img', { timeout: 4000 });
    check((await page.getAttribute('.machine-photo img', 'src')).startsWith('data:image/jpeg'), 'the machine photo is kept, shrunk to a JPEG');
  } else check(false, 'no local picture to use as a photo: run the sparse checkout of free-exercise-db into /tmp/fedb');
  await shot('p2-exercise-picture', { fullPage: true });
  // the rest one after another
  await go('#/pictures');
  await page.waitForSelector('.pic-cand');
  check((await page.textContent('.pic-progress small')).includes('1 di 2'), 'two exercises still without a picture');
  await shot('p3-match');
  await page.click('[data-action=use]');
  await page.waitForSelector('.pic-cand');
  await page.click('[data-action=none]');
  await page.waitForSelector('.lead');
  check((await page.textContent('.lead')).includes('1 esercizi su 2'), `summary (${await page.textContent('.lead')})`);
  await page.click('[data-action=finish]');
  await page.waitForSelector('.list-row');
  check(!(await page.$('.pic-prompt')), 'nothing left to match');

  console.log('Routine');
  await go('#/routines');
  await page.click('.two-actions [data-action=new-routine]');
  await page.click('#modal [data-choice=empty]');
  await page.waitForSelector('#r-name');
  await page.fill('#r-name', 'Gambe');
  await page.press('#r-name', 'Tab');
  // v28: one sheet, several at once, in the order they were ticked
  await page.click('[data-action=add-item]');
  await page.waitForSelector('#modal[open] .ax-row');
  for (const name of ['Leg press', 'Tapis roulant', 'Plank']) await page.click(`#modal .ax-row:has-text("${name}")`);
  check((await page.textContent('#modal [data-ax-ok]')).includes('3'), 'Aggiungi 3');
  await page.click('#modal [data-ax-ok]');
  await page.waitForTimeout(200);
  await page.check('[name=autoIncrease]');
  // edit leg press: 2 sets of 10 at 100 kg, rest 60
  await page.click('[data-edit-item="0"]');
  await page.fill('#modal [name=sets]', '2');
  await page.fill('#modal [name=weight]', '100');
  // v29: the rest between sets is typed (130 = 1:30) or ±30 s, like the circles
  await page.fill('#modal [data-srest]', '130');
  await page.click('#modal [data-sstep="-30"]');
  check(await page.inputValue('#modal [data-srest]') === '1:00', `rest between sets: 1:30 − 30 s (${await page.inputValue('#modal [data-srest]')})`);
  check(Boolean(await page.$('#modal [data-srest-reset]')), 'a way back to the usual rest');
  await shot('v29-set-rest', { fullPage: true });
  await page.click('#modal [value=save]');
  // move the treadmill first with the keyboard on its handle
  await page.waitForTimeout(1000);
  await page.focus('[data-grip="1"]');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  await shot('07-routine-edit', { fullPage: true });
  await go('#/routines');
  await page.click('.lib-row');
  await shot('08-routine', { fullPage: true });
  check((await page.$$('.card-row .thumb')).length === 2, `small pictures in the scheda (${(await page.$$('.card-row .thumb')).length})`);
  const firstEx = await page.textContent('.stack .card-row .row-title');
  check(firstEx === 'Tapis roulant', 'reordered: treadmill first');

  // v27: a workout screen fits the phone: nothing to scroll at 360 × 640, the buttons always on screen at 320 × 568
  const fitsAt = async (label) => {
    const vp = page.viewportSize();
    for (const [w, h, strict] of [[360, 640, true], [320, 568, false], [390, 844, true]]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(120);
      const r = await page.evaluate(() => { const m = document.querySelector('.w-screen.fit .w-main'); const f = document.querySelector('.w-screen.fit .w-foot'); const fb = f ? f.getBoundingClientRect().bottom : 0; return { over: m ? m.scrollHeight - m.clientHeight : -1, foot: f ? Math.round(fb) : -1, page: document.documentElement.scrollHeight - innerHeight }; });
      check(r.over !== -1 && r.page <= 1 && r.foot <= h + 1 && (!strict || r.over <= 1), `${label} fits ${w}×${h} (${JSON.stringify(r)})`);
    }
    await page.setViewportSize(vp); await page.waitForTimeout(80);
  };

  console.log('Workout from an Everyday block');
  await page.evaluate(() => { location.hash = location.hash.replace('#/routine/', '#/start/') + '?block=blk-1'; });
  // Pronto?: the whole scheda first, the clock starts with Inizia
  await page.waitForSelector('[data-action=go]');
  check((await page.textContent('.w-head-mid')).includes('Pronto?') && (await page.$$('.ov-row')).length === 3, 'Pronto?: the scheda in order before starting');
  check((await page.textContent('.ov-first')).includes('Tapis roulant'), 'the first exercise in large');
  await shot('p6-ready', { fullPage: true });
  await page.click('[data-action=go]');
  await page.waitForSelector('.w-ex', { timeout: 4000 }).catch(async () => { await shot('debug-start'); console.log(page.url(), errors); });
  check((await page.textContent('.w-ex')) === 'Tapis roulant', 'starts with cardio');
  const livePref = () => page.evaluate(async () => (await import('/js/store.js')).pref('live', 'unset'));
  const lv = await livePref();
  check(lv && lv.blockId === 'blk-1' && lv.pausedAt === null && lv.pausedMs === 0 && lv.sessionId && lv.at, `live record for Everyday on start (${JSON.stringify(lv)})`);
  await shot('09-cardio');
  await fitsAt('cardio');
  await tones();
  await page.clock.runFor(10 * 60 * 1000);
  { const tn = await tones(); check(tn.filter((f) => f === 1500).length === 3 && tn.includes(1318), `v30: cardio rings at the end, with the 3 ticks (${tn})`); }
  await page.fill('[name=distance]', '1,6');
  await page.click('[data-action=done]');
  await page.waitForSelector('.ring');
  check((await page.textContent('.eyebrow')).includes('spostamento'), 'rest between exercises');
  await page.clock.runFor(30 * 1000);
  await shot('10-rest');
  await fitsAt('rest');
  check((await page.textContent('[data-action=end-rest]')).trim() === 'Salta', 'resting: Salta');
  await tones();
  await page.clock.runFor(4 * 60 * 1000);
  await page.waitForTimeout(100);
  check((await page.textContent('[data-action=end-rest]')).trim() === 'Fine', `time's up: Salta becomes Fine`);
  { const tn = await tones(); check(tn.filter((f) => f === 1318).length >= 2 && tn.filter((f) => f === 1500).length === 3, `v30: the rest rings at zero and again 30 s later (${tn})`); }
  await page.click('[data-action=end-rest]');
  await page.waitForSelector('.w-note');
  check((await page.textContent('.w-note')).includes('metà pedana'), 'note shown during the set');
  await shot('11-set');
  await fitsAt('set with a note');
  check(Boolean(await page.$('.w-card.machine .w-thumb')), 'a small picture next to the machine');
  await page.click('.w-thumb');
  await page.waitForSelector('.viewer');
  check((await page.$$('.viewer-seg button')).length === 2, 'the viewer offers Macchina and Esercizio');
  check((await page.getAttribute('.viewer img', 'src')).startsWith('data:'), 'your photo first');
  await page.click('.viewer-seg button >> nth=1');
  check((await page.getAttribute('.viewer img', 'src')).includes('free-exercise-db'), 'then the drawing');
  await shot('p4-viewer');
  await page.click('.viewer-close');
  check(!(await page.$('.viewer')), 'the viewer closes');
  // Impostazioni → Lingua e aspetto → Immagini off hides the small picture
  await page.evaluate(async () => (await import('/js/store.js')).setPref('pictures', false));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('palestra:render'))); await page.waitForTimeout(150);
  check(!(await page.$('.w-thumb')), 'pictures off: no small picture');
  await page.evaluate(async () => (await import('/js/store.js')).setPref('pictures', true));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('palestra:render'))); await page.waitForTimeout(150);
  check(Boolean(await page.$('.w-thumb')), 'pictures on again');
  await page.clock.runFor(35 * 1000);
  // done too soon: Rifai la serie from the rest
  await page.click('[data-action=done]');
  await page.waitForSelector('.ring');
  check((await page.textContent('[data-action=back]')).includes('Rifai la serie'), 'the rest offers Rifai la serie');
  await page.click('[data-action=back]');
  await page.waitForSelector('.w-note');
  check((await page.textContent('.w-head-mid')).includes('esercizio 2'), 'back on the same set');
  check((await page.textContent('[data-action=back]')).includes('Indietro'), 'a set offers Indietro');
  // Anteprima: the edges show the exercise after and before, the way back is always there
  await page.click('.w-edge.r');
  await page.waitForSelector('.pv-banner');
  check((await page.textContent('.w-ex')) === 'Plank' && (await page.textContent('.pv-banner')).includes('Sei all\'esercizio 2'), 'right edge: Plank in preview, you are at 2');
  check(!(await page.$('[data-action=done]')) && Boolean(await page.$('[data-action=do-now]')), 'no Fatto in preview; Fallo adesso instead');
  check(Boolean(await page.$('.w-progress .view')), 'the progress bar marks what you look at');
  await shot('p5-preview');
  await page.click('[data-action=peek-home]');
  await page.waitForSelector('[data-action=done]');
  await page.click('.w-edge.l');
  await page.waitForSelector('.pv-banner');
  check((await page.textContent('.pv-banner')).includes('Già fatto') && (await page.textContent('.w-ex')) === 'Tapis roulant', 'left edge: the treadmill, already done');
  await page.click('.w-edge.r');
  await page.waitForSelector('[data-action=done]');
  check((await page.textContent('.w-ex')) === 'Leg press', 'and back to the live set');
  await page.click('[data-action=done]');
  await page.clock.runFor(60 * 1000);
  await page.click('[data-action=pause]');
  await page.clock.runFor(120 * 1000);
  await shot('12-paused');
  check((await livePref()).pausedAt > 0, 'live: paused');
  await page.click('[data-action=resume]');
  { const v = await livePref(); check(v.pausedAt === null && Math.abs(v.pausedMs - 120000) < 1000, `live: resumed, pause counted (${v.pausedMs})`); }
  await page.click('[data-action=end-rest]');
  await page.click('[data-action=done]');
  // the last set of the leg press: one more set?
  check(Boolean(await page.waitForSelector('.more-q', { timeout: 3000 }).catch(() => null)), 'after the last set: "Ne fai un\'altra?"');
  await page.click('[data-action=add-set]');
  await page.waitForSelector('[data-action=undo-set]');
  check((await page.textContent('.w-card.next')).includes('Serie 3 di 3 · in più'), 'the extra set comes next');
  await shot('p7-more');
  await page.click('[data-action=end-rest]');
  await page.waitForSelector('.w-setline .w-tag');
  await page.click('[data-stepper=reps] [data-delta="1"]');
  check((await page.textContent('[data-extra]')).includes('una in più'), 'one more rep than the scheda');
  await page.clock.runFor(35 * 1000);
  await page.click('[data-action=done]');
  await page.click('[data-action=end-rest]');
  // plank: 3 sets
  for (let i = 0; i < 3; i++) {
    await page.clock.runFor(45 * 1000);
    await page.click('[data-action=done]');
    if (i < 2) await page.click('[data-action=end-rest]');
  }
  // the very end: add an exercise, then finish
  await page.waitForSelector('.more-q');
  check((await page.textContent('.w-main')).includes('Finito?'), 'after the last set: Finito?');
  await page.click('[data-action=add-ex]');
  await page.click('#modal .pick:has-text("Plank")');
  await page.waitForSelector('.w-card.next');
  check((await page.textContent('.w-card.next')).includes('aggiunto'), 'the added exercise comes next');
  await page.click('[data-action=end-rest]');
  await page.waitForSelector('.w-ex .w-tag.add');
  await page.clock.runFor(45 * 1000);
  await page.click('[data-action=done]');
  await page.waitForSelector('.more-q');
  await page.click('[data-action=end-rest]');
  await page.waitForSelector('.summary');
  check((await page.$$('.diff-card')).length === 2, `the summary lists what was different (${(await page.$$('.diff-card')).length})`);
  const d1 = await page.textContent('.diff-card');
  check(d1.includes('in più') && d1.includes('10/10/11 × 100 kg'), `leg press: the extra set and rep, and what the scheda becomes (${d1.replace(/\s+/g, ' ')})`);
  check((await page.textContent('.diff-card >> nth=1')).includes('Entra nella scheda dopo Plank'), 'the added exercise goes in after Plank');
  await shot('13-summary', { fullPage: true });
  check((await page.textContent('.summary')).includes('tutte le serie'), 'session complete');
  await page.click('[data-action=save-diff]');
  await page.waitForTimeout(200);
  { const r = await page.evaluate(async () => { const { live } = await import('/js/store.js'); return live('routines').find((x) => x.name === 'Gambe'); });
    check(r.items.length === 4 && r.items[1].perSet && r.items[1].perSet.map((x) => x.reps).join('/') === '10/10/11' && r.items[3].sets === 1 && r.items[3].exerciseId === r.items[2].exerciseId, `the scheda updated from the summary (${JSON.stringify(r.items.map((x) => [x.sets, x.reps, x.perSet ? 'perSet' : '']))})`); }
  await page.waitForSelector('.chart');
  await page.clock.runFor(5000);
  await page.waitForTimeout(300);
  await shot('14-history', { fullPage: true });

  console.log('Sync');
  await go('#/settings');
  await page.click('[data-action=sync]');
  await page.waitForTimeout(500);
  const liveRemote = JSON.parse(repo.get('data/prefs.json').text).find((p) => p.id === 'live');
  check(liveRemote && liveRemote.value === null, `after the workout, live is null (${JSON.stringify(liveRemote)})`);
  const sessFile = [...repo.keys()].find((k) => k.startsWith('data/sessions/'));
  check(sessFile === 'data/sessions/2026-10.json', 'session file sharded by month');
  const sess = JSON.parse(repo.get(sessFile).text)[0];
  check(sess.everydayBlockId === 'blk-1' && sess.outcome === 'done', 'session carries the Everyday block and outcome');
  check(sess.breakdown && sess.breakdown.pause === 120, 'pause counted apart');
  const routines = JSON.parse(repo.get('data/routines.json').text);
  check(routines[0].estMinutes > 10, `routine estMinutes written (${routines[0].estMinutes})`);
  const photoFile = [...repo.keys()].find((k) => /photos\/[^/]+\.jpg$/.test(k));
  check(Boolean(photoFile), `the machine photo is uploaded (${photoFile})`);
  const machines = JSON.parse(repo.get('data/machines.json').text);
  check(machines.some((m) => m.photo && photoFile.endsWith(m.photo.file)), 'the machine says where its photo is');

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
  await page.waitForSelector('[data-action=go]');
  await page.click('[data-action=go]');
  await page.waitForSelector('.w-ex');
  await page.click('[data-action=end]');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForTimeout(200);

  console.log('Import a plan from JSON, then one from text, and make it active');
  const plan = fs.readFileSync(path.join(__dirname, 'sample-plan.json'), 'utf8');
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

  console.log('v29: importing the same plan again: update the ones there, or add as new');
  { const count = () => page.evaluate(async () => { const { live } = await import('/js/store.js'); return [live('routines').length, live('plans').length]; });
    const [r0, p0] = await count();
    await go('#/import');
    await page.fill('#imp-text', plan.replace('"sets": 5', '"sets": 6'));
    await page.click('[data-action=read]');
    await page.waitForSelector('.imp-how');
    check((await page.textContent('.imp-how')).includes('Il workout e 3 schede'), `the clash is named (${await page.textContent('.imp-how p')})`);
    check(await page.isChecked('[name=impHow][value=new]'), 'nothing is replaced unless asked');
    check((await page.textContent('.imp-day')).includes('(2)'), 'as new: copies with (2)');
    await page.click('.imp-choice:has([value=update])');
    await page.waitForSelector('.imp-tag.upd');
    check(!(await page.textContent('.imp-day')).includes('(2)'), 'update: same names');
    await shot('v29-import-update', { fullPage: true });
    await page.click('[data-action=do-import]');
    await page.waitForTimeout(300);
    const [r1, p1] = await count();
    check(r1 === r0 && p1 === p0, `update: no new schede or workout (${r0}/${p0} → ${r1}/${p1})`);
  }

  console.log('v24: sets that differ, rep ranges, the trial, Pronto?, the starting weight');
  await go('#/import?for=routine');
  await page.fill('#imp-text', 'SCHEDA: Piramide\nCurl con bilanciere 8/6/4 x 10/12/14\nChest press 3x8-12 cedimento rec 2:00\nSquat 8/6 x 60/70/80');
  await page.click('[data-action=read]');
  await page.waitForSelector('.imp-day');
  const prev24 = await page.textContent('.imp-day');
  check(prev24.includes('8/6/4 × 10/12/14 kg') && prev24.includes('3 × 8–12') && prev24.includes('a cedimento'), `import: sets that differ and a rep range to failure (${prev24.replace(/\s+/g, ' ')})`);
  check(prev24.includes('Ripetizioni e pesi per serie non sono tanti quanti'), 'import: 2 reps and 3 weights flagged');
  await shot('p8-import-sets', { fullPage: true });
  await page.click('[data-action=do-import]');
  await page.waitForTimeout(300);
  const pid = await page.evaluate(async () => { const { live } = await import('/js/store.js'); return live('routines').find((r) => r.name === 'Piramide').id; });
  // the editor: Serie diverse, one more row
  await go(`#/routine/${pid}/edit`);
  await page.click('[data-edit-item="0"]');
  await page.waitForSelector('#modal [name=shape]');
  check(await page.isChecked('#modal [name=shape][value=diff]') && (await page.$$('#modal .set-row-edit')).length === 3, 'editor: Serie diverse with three rows');
  await shot('p9-sets-editor', { fullPage: true });
  await page.click('#modal [data-add-row]');
  await page.waitForSelector('#modal .set-row-edit >> nth=3');
  await page.click('#modal [value=save]');
  await page.waitForTimeout(200);
  { const it = await page.evaluate(async (id) => { const { get } = await import('/js/store.js'); return get('routines', id).items[0]; }, pid);
    check(it.perSet && it.perSet.length === 4 && it.sets === 4, `editor: a fourth set (${JSON.stringify(it)})`); }
  // the trial: the real screens, still, nothing saved
  const nSess = await page.evaluate(async () => (await import('/js/store.js')).live('sessions').length);
  await go(`#/routine/${pid}`);
  await page.click(`a[href="#/try/${pid}"]`);
  await page.waitForSelector('.trial-strip');
  check((await page.textContent('[data-live=elapsed]')).includes('—:—'), 'trial: no clock');
  check((await page.$$('.w-planline span')).length === 4, 'trial: the row of sets that differ');
  await shot('p10-trial');
  await page.click('[data-action=done]');
  await page.waitForSelector('[data-action=end-rest]');
  check((await page.textContent('.w-main')).includes('il recupero non scorre'), 'trial: the rest stands still');
  await page.click('[data-action=end-rest]');
  await page.waitForSelector('[data-stepper=reps]');
  check((await page.inputValue('[data-stepper=reps] input')) === '6' && (await page.inputValue('[data-stepper=weight] input')) === '12', 'set 2 starts from its own numbers, not the set before');
  for (let i = 0; i < 3; i++) { await page.click('[data-action=skip-set]'); await page.waitForTimeout(80); }
  await page.waitForSelector('.fail-tag');
  check((await page.textContent('.w-goal')).includes('Obiettivo 8–12'), 'to failure: the range shown');
  await shot('p11-failure');
  await page.click('[data-action=exit-trial]');
  await page.waitForSelector('.title');
  check((await page.evaluate(async () => (await import('/js/store.js')).live('sessions').length)) === nSess && !(await page.evaluate(async () => (await import('/js/store.js')).kvGet('active'))), 'trial: no session, nothing in progress');
  // your body: a starting weight
  await go('#/settings/body');
  await page.fill('[name=kg]', '75'); await page.dispatchEvent('[name=kg]', 'change');
  await page.fill('[name=cm]', '178'); await page.dispatchEvent('[name=cm]', 'change');
  await page.waitForSelector('.kv-list .kv');
  check((await page.textContent('.kv-list')).includes('Chest press'), 'Il tuo corpo: starting weights listed');
  await shot('p12-body', { fullPage: true });
  // countdown before starting, and the suggestion in the set
  await go('#/settings/training');
  await page.click('.seg-opt:has(input[name=start][value=countdown])');
  await page.waitForTimeout(150);
  await go(`#/start/${pid}`);
  await page.waitForTimeout(300);
  if (await page.$('.inc-row')) await page.click('[data-action=skip]');
  await page.waitForSelector('[data-live=countdown]');
  await shot('p13-countdown');
  { const t0 = await page.evaluate(() => Date.now()); await page.clock.setFixedTime(t0 + 16 * 1000); await page.clock.runFor(1000); }
  await page.waitForSelector('.w-ex');
  check((await page.textContent('.w-ex')).startsWith('Curl con bilanciere'), 'the countdown starts it on its own');
  for (let i = 0; i < 4; i++) { await page.click('[data-action=skip-set]'); await page.waitForTimeout(80); }
  await page.waitForSelector('.sug-chip');
  await page.click('[data-action=use-sug]');
  check(Number((await page.inputValue('[data-stepper=weight] input')).replace(',', '.')) > 0, 'Usa puts the suggested weight in');
  await page.click('[data-action=end]');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForTimeout(300);
  await go('#/settings/training');
  await page.click('.seg-opt:has(input[name=start][value=overview])');
  await page.waitForTimeout(150);

  console.log('Compact exercise list');
  await go('#/exercises');
  await kitSheet(() => page.click('.kit-panel [data-dense="0"]'));
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  await shot('23-exercises-normal');
  await kitSheet(() => page.click('.kit-panel [data-dense="1"]'));
  await page.waitForSelector('.list-row.compact');
  const short = await page.evaluate(() => document.documentElement.scrollHeight);
  // v29: 0.9 (was 0.85) since the import fixture is now tests/sample-plan.json, with more muscle groups (more group headers)
  check(short < tall * 0.9, `compact list is much shorter (${tall} → ${short})`);
  await shot('24-exercises-compact');
  await page.click('[data-kit-all]');
  await page.waitForTimeout(100);
  check((await page.$$('.list-row')).length === 0, 'all groups closed');
  await page.click('.kit-gt');
  await page.waitForTimeout(100);
  await shot('25-exercises-closed');
  check((await page.$$('.kit-group .kit-list')).length === 1, 'one group opened');
  await page.fill('#kit-q-ex', 'panca');
  await page.waitForTimeout(100);
  check((await page.$$('.list-row')).length >= 1, 'search opens closed groups');
  await page.fill('#kit-q-ex', '');
  await page.click('[data-kit-all]');
  await page.waitForTimeout(100);
  // the group tags: a tap shows only that group, a drag reorders them (and the groups)
  await page.click('.kit-tools [data-kit-panel]'); await page.waitForSelector('.kit-panel .kit-tags');
  const tagNames = async () => page.$$eval('.kit-tag', (els) => els.map((e) => e.dataset.tag));
  const tBefore = await tagNames();
  check(tBefore.length >= 3, `group tags (${tBefore.join(', ')})`);
  await page.click(`.kit-tag[data-tag="${tBefore[1]}"]`);
  await page.waitForTimeout(100);
  check((await page.$$('.kit-group')).length === 1 && (await page.$$('.kit-tag.on')).length === 1, 'a tag shows only its group');
  await page.click(`.kit-tag[data-tag="${tBefore[1]}"]`);
  await page.waitForTimeout(100);
  { const a = await page.$(`.kit-tag[data-tag="${tBefore[0]}"]`); const b = await page.$(`.kit-tag[data-tag="${tBefore[2]}"]`);
    const ra = await a.boundingBox(); const rb = await b.boundingBox();
    await page.mouse.move(ra.x + ra.width / 2, ra.y + ra.height / 2); await page.mouse.down();
    await page.mouse.move(ra.x + ra.width / 2 + 10, ra.y + ra.height / 2, { steps: 3 });
    await page.mouse.move(rb.x + rb.width - 4, rb.y + rb.height / 2, { steps: 8 }); await page.mouse.up(); }
  await page.waitForTimeout(200);
  const tAfter = await tagNames();
  check(tAfter.indexOf(tBefore[0]) > tAfter.indexOf(tBefore[2]) || tAfter.indexOf(tBefore[0]) === tAfter.length - 1 || tAfter[0] !== tBefore[0], `drag reorders the tags (${tAfter.join(', ')})`);
  const gOrder = await page.$$eval('.kit-group .kit-gt span:first-child', (els) => els.map((e) => e.textContent));
  const tOrder = await page.$$eval('.kit-tag', (els) => els.map((e) => e.querySelector('.nm').textContent));
  check(gOrder.join('|') === tOrder.join('|'), `the groups follow the tags (${gOrder.join(', ')})`);
  await shot('p14-tags');
  await page.click('.kit-panel-foot [data-kit-panel]'); await page.waitForTimeout(100);
  check(!(await page.$('.kit-tags')), 'with the panel closed, no group tags');

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
  // v27 builder: drag the legs day to Saturday, then give it a time
  check((await page.$$('.wb-tile')).length === 3, 'three scheda tiles on the days');
  await dragTo('.wb-tile[data-tile="2"]', '.wb-row[data-drop="day:0:5"]');
  check((await page.textContent('.wb-row[data-drop="day:0:5"]')).includes('Gambe'), 'dropped on Saturday');
  await page.click('.wb-row[data-drop="day:0:5"] .wb-tile');
  await page.waitForSelector('#modal[open] [name=time]');
  await page.fill('#modal [name=time]', '10:30');
  await page.dispatchEvent('#modal [name=time]', 'change');
  await page.waitForTimeout(200);
  check((await page.textContent('.wb-row[data-drop="day:0:5"] .wb-tm')) === '10:30', 'the time is on the tile');
  // make it active from Monday
  await page.click('.wb-act');
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
  check((await page.$$('.wb-tile')).length === 4, 'the copy joined the other workout');
  await go('#/routines');
  check((await page.$$('.lib-row')).length === nPlans + 1, 'the copy is in the library');
  await kitFac('workout', 'w:none');
  check((await page.$$('.lib-row')).length >= 1, 'filter: schede in no workout');
  await page.click('.kit-on');
  await page.waitForTimeout(100);
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
  const routes = ['#/today', '#/routines', '#/plans', `#/plan/${ids.p}`, '#/import', '#/import?for=routine', '#/exercises', '#/pictures', `#/exercise/${ids.e}`, `#/exercise/${ids.c}`, '#/exercise/new',
    '#/gym', '#/history', `#/session/${ids.s}`, `#/routine/${ids.r}`, `#/routine/${ids.r}/edit`, '#/settings',
    ...['github', 'increase', 'training', 'gym', 'everyday', 'look', 'data', 'data/backup', 'data/device'].map((x) => `#/settings/${x}`)];
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
  await kitSheet(() => page.click('.kit-panel [data-dense="0"]'));
  await overflowAt('detailed exercises');
  await page.click('.kit-tools [data-kit-panel]'); await page.waitForSelector('.kit-panel'); await overflowAt('filter panel'); await page.click('.kit-panel [data-dense="1"]'); await page.click('.kit-panel-foot [data-kit-panel]');
  await go('#/gym');
  await page.click('.zone [data-add-machine]');
  await page.click('#modal .seg-opt:has(input[value=cardio])');
  await overflowAt('new machine sheet');
  await page.keyboard.press('Escape');
  await go(`#/plan/${ids.p}`);
  await page.click('[data-add="0:1"]');
  await overflowAt('add routine sheet');
  await page.keyboard.press('Escape');
  await go(`#/start/${ids.r}`);
  await page.waitForTimeout(300);
  if (await page.$('.inc-row')) { await overflowAt('weekly increase'); await page.click('[data-action=skip]'); }
  await page.waitForSelector('[data-action=go]');
  await overflowAt('Pronto?');
  await page.click('[data-action=go]');
  await page.waitForSelector('.w-main .w-ex');
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
  const nItems = (await page.$$('.blk[data-blk]')).length;
  await page.click('.two-actions a[href*="into="]');
  await page.waitForSelector('#imp-text');
  await page.fill('#imp-text', 'Curl con manubri 3x10 12 kg');
  await page.click('[data-action=read]');
  await page.waitForSelector('[data-action=do-import]');
  check((await page.textContent('[data-action=do-import]')).startsWith('Aggiungi a'), 'import offers to add to the scheda');
  await page.click('[data-action=do-import]');
  await page.waitForSelector('[data-form=routine]');
  check((await page.$$('.blk[data-blk]')).length === nItems + 1, 'exercise added to the scheda');
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
  const gear = await page.evaluate(() => { const r = document.querySelector('#gear').getBoundingClientRect(); return r.right > 1180 && r.top < 64; });
  check(gear, 'settings gear at the top right');
  await go('#/history');
  await page.click('nav.tabs .nav-brand');
  await page.waitForTimeout(200);
  check(page.url().endsWith('#/today') && (await page.textContent('.page-head h1')) === 'Oggi', 'the Palestra logo goes back to Oggi');
  const colsOk = await page.evaluate(() => { const m = document.querySelector('.col-main').getBoundingClientRect(); const s = document.querySelector('.col-side').getBoundingClientRect(); return s.left > m.right - 1 && Math.abs(s.top - m.top) < 4; });
  check(colsOk, 'Oggi in two columns');
  await shot('d1-today');
  await go('#/routines');
  await page.waitForSelector('.md-pane .title');
  check(Boolean(await page.$('.train-tabs .tt-acts [data-action=new-routine]')) && !(await page.$('#view [data-top-actions]')), 'Nuova scheda · Importa moved to the right of Allenamento\'s second bar');
  { const b = await page.$eval('.train-tabs', (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), w: Math.round(r.width) }; });
    check(b.top >= 60 && b.top <= 70, `the second bar sits under the top bar (${JSON.stringify(b)})`); }
  await page.click('.train-tabs [data-action=new-routine]');
  check(Boolean(await page.$('#modal[open] [data-choice]')), 'the moved button still works');
  await page.keyboard.press('Escape');
  check(Boolean(await page.$('.lib-row.selected')), 'Schede: list and detail side by side');
  await page.click('.lib-row:not(.selected)');
  await page.waitForTimeout(150);
  check(page.url().includes('sel='), 'picking a scheda keeps the list');
  await shot('d2-routines');
  await go(`#/routine/${ids.r}/edit`);
  await page.waitForSelector('.ex-lib');
  const n0 = (await page.$$('.blk[data-blk]')).length;
  await page.click('.ex-lib .lib-ex:not(.is-in) [data-lib-add]');
  await page.waitForTimeout(200);
  check((await page.$$('.blk[data-blk]')).length === n0 + 1, 'library panel adds an exercise');
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
  await go('#/settings');
  await page.waitForTimeout(150);
  check(await page.evaluate(() => document.getElementById('gear').classList.contains('active')), 'the gear is filled on Settings');
  check((await page.textContent('#gear-label')) === 'Impostazioni' && await page.isVisible('#gear-label'), 'on a wide screen the gear says Impostazioni');
  check((await page.getAttribute('#gear', 'aria-label')) === 'Impostazioni', 'the gear has a translated label');
  await go('#/today');
  check(!(await page.evaluate(() => document.getElementById('gear').classList.contains('active'))), 'the gear is plain elsewhere');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  check(!(await page.$('#nav-actions [data-action]')) && !(await page.$('.tt-acts [data-action]')), 'top bar actions cleared on the phone');
  console.log('v26: four sections, Allenamento\'s tabs, gyms, a missing machine, Storico');
  await go('#/exercises');
  await go('#/today');
  check((await page.getAttribute('nav.tabs a[data-tab=train]', 'href')) === '#/exercises', 'Allenamento opens on the tab last seen');
  await page.click('nav.tabs a[data-tab=train]'); await page.waitForTimeout(150);
  check((await page.$$('.train-tabs a')).length === 3 && (await page.textContent('.train-tabs a.on')).startsWith('Esercizi'), 'Workout · Schede · Esercizi, with Esercizi on');
  check((await page.textContent('.kit-group .kit-gt span')).length > 0 && !(await page.$('.kit-tags')), 'exercises by body part; the group tags only in the Filtri panel');
  await page.click('.train-tabs a[data-train-tab=routines]'); await page.waitForTimeout(150);
  check((await page.evaluate(() => location.hash)) === '#/routines', 'a tab is a link');
  await go(`#/routine/${ids.r}`);
  check((await page.textContent('.bar .back')).includes('Allenamento › Schede'), 'the way back says where');
  check(!(await page.$('.where-row')), 'one gym: no "Dove"');
  await go('#/gym');
  await page.click('[data-action=add-gym]'); await page.waitForSelector('#modal[open]');
  await page.fill('#modal [name=name]', 'Casa'); await page.click('#modal [value=save]'); await page.waitForTimeout(250);
  check((await page.evaluate(() => location.hash)).includes('v=eq') && (await page.textContent('.gym-tabs a.on')) === 'Casa', 'a new gym opens on its equipment');
  check((await page.$$('.gym-eq [data-eq]:checked')).length === 0, 'a new gym starts with nothing ticked');
  await page.check('.gym-eq [data-eq=dumbbells]'); await page.waitForTimeout(150);
  check((await page.$$('.gym-eq [data-eq]:checked')).length === 1, 'tick what there is');
  await go(`#/routine/${ids.r}`);
  check((await page.$$('.where-row .chip-btn')).length === 2, 'two gyms: "Dove" on the scheda');
  await page.click('.where-row .chip-btn:nth-child(3)'); await page.waitForTimeout(150);
  check(Boolean(await page.$('.warn-box')) && (await page.$$('.card-row.missing')).length >= 1, 'at Casa: a warning and the rows that need something');
  await shot('v26-missing');
  if (await page.$('[data-use]')) {
    const before = (await page.$$('.card-row.missing')).length;
    await page.click('[data-use]'); await page.waitForSelector('#modal[open] [data-how=here]');
    await page.click('#modal [data-how=here]'); await page.waitForTimeout(250);
    check((await page.$$('.card-row.missing')).length === before - 1 && Boolean(await page.$('.standin-tag')), 'Usa → only at Casa: a stand-in, one warning less');
    const alt = await page.evaluate(async (id) => (await import('/js/store.js')).get('routines', id).items.some((it) => it.alt), ids.r);
    check(alt, 'the scheda keeps its exercise, with the stand-in for Casa');
    await page.click('[data-unalt]'); await page.waitForTimeout(200);
    check((await page.$$('.card-row.missing')).length === before, 'back to the original');
  }
  check((await page.getAttribute('.sticky-cta a', 'href')).includes('?gym='), 'Inizia says which gym');
  await page.click('.where-row .chip-btn:nth-child(2)'); await page.waitForTimeout(150);
  check(!(await page.$('.warn-box')), 'at the usual gym, nothing missing');
  await go('#/history');
  check(Boolean(await page.$('.dim-chips')) && Boolean(await page.$('.chart.multi, .muted.small')), 'Storico: what to look at, and the chart');
  await page.click('[data-dim=all]'); await page.waitForTimeout(150);
  await page.click('[data-metric=sets]'); await page.waitForTimeout(150);
  check(Boolean(await page.$('[data-metric=sets].on')), 'by sets');
  await overflowAt('Storico v26');
  await page.click('[data-dim=region]'); await page.waitForTimeout(150);
  await page.click('[data-metric=volume]'); await page.waitForTimeout(150);
  for (const r of ['#/gym', '#/plans', '#/routines', `#/routine/${ids.r}`]) { await go(r); await overflowAt(`v26 ${r}`); }

  console.log('Light, dark or automatic');
  const theme = () => page.evaluate(() => document.documentElement.className);
  const bar = () => page.evaluate(() => [...document.querySelectorAll('meta[name=theme-color]')].map((m) => m.content).join());
  await go('#/settings');
  check((await page.textContent('.set-row[href="#/settings/look"] small')).includes('Automatico'), 'the Lingua e aspetto row says Automatico');
  await go('#/settings/look');
  check(await page.isChecked('[name=theme][value=auto]'), 'Aspetto starts on Automatico');
  check(await page.isChecked('[name=pictures]'), 'Immagini: shown by default');
  await page.click('.toggle-row:has([name=pictures])');
  await go('#/settings');
  check((await page.textContent('.set-row[href="#/settings/look"] small')).includes('immagini nascoste'), 'the row says pictures are hidden');
  await go('#/settings/look');
  await page.click('.toggle-row:has([name=pictures])');
  check((await theme()) === 'light' && (await bar()) === '#ffffff,#ffffff', 'a light device: light theme, white status bar');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(150);
  check((await theme()) === 'dark' && (await bar()) === '#151a1b,#151a1b', 'Automatico follows the device to dark, status bar too');
  await page.click('.theme-seg label:has([value=light])');
  await page.waitForTimeout(150);
  check((await theme()) === 'light', 'Chiaro stays light on a dark device');
  await page.click('.theme-seg label:has([value=dark])');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(150);
  check((await theme()) === 'dark' && (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(21, 26, 27)', 'Scuro stays dark on a light device');
  check((await page.evaluate(() => localStorage.getItem('palestra-theme'))) === 'dark', 'kept on this device under palestra-theme');
  await page.reload();
  check((await theme()) === 'dark', 'the choice is there before the app loads');
  await page.waitForSelector('.title');
  await shot('dark-look');
  await go('#/today'); await page.waitForTimeout(150); await overflowAt('dark: Oggi'); await shot('dark-today');
  // a tapped link must not keep its hover colour on a phone
  const titleColour = await page.evaluate(() => { const a = document.querySelector('.today-hero .hero-title'); return a ? getComputedStyle(a).color : 'none'; });
  check(titleColour === 'rgb(233, 238, 236)' || titleColour === 'none', `today's title is light text, not the accent (${titleColour})`);
  await go('#/settings/look');
  await page.click('.theme-seg label:has([value=auto])');
  await page.waitForTimeout(150);
  await go('#/settings');
  check((await page.$$('.set-sub-h')).length === 3 && (await page.$$('.set-list .set-row')).length >= 10, 'Settings is three groups of rows');
  await go('#/settings/data');
  check((await page.$$('.set-row')).length === 2 && (await page.textContent('.set-back')).includes('Impostazioni'), 'I tuoi dati is a list, with the way back');
  await page.click('.set-row[href="#/settings/data/backup"]');
  await page.waitForTimeout(150);
  check((await page.textContent('.set-back')).includes('I tuoi dati') && Boolean(await page.$('[data-action=download]')), 'Backup has its own page under I tuoi dati');
  for (const r of ['#/today', '#/plans', '#/routines', '#/exercises', '#/gym', '#/history']) {
    await go(r);
    const g = await page.evaluate(() => { const el = document.querySelector('#view .gear'); if (!el) return null; const b = el.getBoundingClientRect(); return { right: Math.round(innerWidth - b.right), top: Math.round(b.top) }; });
    check(g && g.right < 40 && g.top < 60, `${r}: the gear at the top right on the phone (${JSON.stringify(g)})`);
  }
  await go('#/routines');
  check(Boolean(await page.$('#view .two-actions [data-action=new-routine]')), 'on the phone the actions stay in the page');

  console.log('v27: the alarm, Riduci, another exercise, the catalogue, the scheda builder, the workout builder');
  await go('#/settings/training');
  check((await page.$$('[name=alarm]')).length === 4, 'four end-of-rest sounds to choose from');
  await page.click('label:has(> [name=alarm][value=gong])');
  await page.waitForTimeout(200);
  check((await page.evaluate(async () => (await import('/js/store.js')).pref('training', {}).alarm)) === 'gong', 'the chosen sound is saved');
  check(Boolean(await page.$('[name=volume]')) && Boolean(await page.$('[data-action=test-sound]')), 'volume and Prova');
  const wr = await page.evaluate(async () => {
    const { live } = await import('/js/store.js');
    const ex = (id) => live('exercises').find((e) => e.id === id);
    return live('routines').find((r) => r.items?.length > 1 && ex(r.items[0].exerciseId)?.type === 'weights' && ex(r.items[1].exerciseId)?.type === 'weights').id;
  });
  await go(`#/start/${wr}`);
  await page.waitForTimeout(300);
  if (await page.$('.inc-row')) await page.click('[data-action=skip]');
  await page.waitForSelector('[data-action=go]');
  await page.click('[data-action=go]');
  await page.waitForSelector('.w-main .w-ex');
  await page.click('[data-action=minimise]');
  await page.waitForTimeout(250);
  check(!page.url().includes('#/workout') && Boolean(await page.$('[data-live-bar]')), `Riduci: out of the workout, the live bar shows (${page.url().split('#')[1]})`);
  await overflowAt('live bar');
  await page.click('[data-live-bar]');
  await page.waitForSelector('.w-main .w-ex');
  check(page.url().includes('#/workout'), 'Torna goes back into it');
  const exBefore = await page.textContent('.w-ex');
  await page.click('.w-other');
  await page.waitForSelector('#modal[open] [data-sug], #modal[open] [data-pick]');
  await shot('v27-other');
  if (await page.$('#modal [data-sug]')) await page.click('#modal [data-sug="0"]'); else { await page.fill('#ox-q', ''); await page.click('#modal [data-pick]'); }
  await page.waitForTimeout(250);
  check(Boolean(await page.$('.w-instead')) && (await page.textContent('.w-ex')) !== exBefore, 'Ho fatto un altro esercizio: the other one now, marked "invece di"');
  await page.click('[data-action=end]');
  await page.click('#confirm [data-confirm=ok]');
  await page.waitForTimeout(300);

  // the catalogue
  await go('#/exercises?cat=1');
  await page.waitForSelector('.sub-tabs');
  await page.waitForTimeout(800);
  const catRows = (await page.$$('.cat-row')).length;
  check(!(await page.$('[data-cat-box]')) && Boolean(await page.$('[data-cat-panel]')), 'Catalogo: the filters start closed');
  await page.click('[data-cat-panel]'); await page.waitForSelector('[data-cat-box]');
  await page.click('[data-reg=legs]'); await page.waitForTimeout(400);
  await page.click('[data-cat-list] p.muted'); await page.waitForTimeout(300);
  check(!(await page.$('[data-cat-box]')) && Boolean(await page.$('.kit-on[data-un=region]')), 'a tap outside closes Filtri; the filter stays as a tag');
  await page.click('.kit-on[data-un=region]'); await page.waitForTimeout(400);
  check(catRows > 20 || Boolean(await page.textContent('#view').then((x) => x.includes('offline'))), `Catalogo: the common list (${catRows} rows)`);
  if (catRows) {
    const nEx = await page.evaluate(async () => (await import('/js/store.js')).live('exercises').length);
    await page.fill('#cat-q', 'hip thrust');
    await page.waitForTimeout(300);
    const add = await page.$('.cat-row [data-add-cat]');
    if (add) { await add.click(); await page.waitForTimeout(300); check((await page.evaluate(async () => (await import('/js/store.js')).live('exercises').length)) === nEx + 1, '+ Aggiungi makes it yours'); }
    await overflowAt('catalogue');
  }

  // the scheda builder: an alternative by dragging onto "oppure", a rest circle that becomes a superset
  await go(`#/routine/${wr}/edit`);
  await page.waitForSelector('[data-chain]');
  let tries = 0;
  await page.click('[data-rest="0"]');
  await page.waitForSelector('#modal[open] [data-rt]');
  check(!(await page.evaluate(() => { const i = document.querySelector('#modal [data-rt]'); return i.selectionStart !== i.selectionEnd && document.activeElement === i; })), 'the time is not selected on its own');
  await overflowAt('rest sheet');
  await page.fill('#modal [data-rt]', '5');
  await page.click('#modal [data-ok]');
  await page.waitForTimeout(200);
  check((await page.textContent('[data-rest="0"]')).includes('5'), 'typed 5: five minutes');
  await page.click('[data-rest="0"]');
  await page.waitForSelector('#modal[open] [data-rt]');
  while (tries++ < 12 && !(await page.$('#modal .rt-in.ss'))) await page.click('#modal [data-step="-30"]');
  check((await page.inputValue('#modal [data-rt]')) === '⚡', 'down to zero: the superserie sign');
  await page.click('#modal [data-ok]');
  await page.waitForTimeout(200);
  check(Boolean(await page.$('.ch-link.ss')), '⚡ superserie saved');
  // a tap outside a sheet closes it
  await page.click('[data-action=add-item]');
  await page.waitForSelector('#modal[open]');
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);
  check(!(await page.$('#modal[open]')), 'a tap outside the sheet closes it');
  const nBlk = (await page.$$('.blk[data-blk]:not(.alt)')).length;
  await dragTo('.blk-grip[data-grip="1"]', '[data-drop="alt:0"]');
  check((await page.$$('.blk.alt')).length >= 1 && (await page.$$('.blk[data-blk]:not(.alt)')).length === nBlk - 1, 'dragged onto "oppure": the alternative of the first');
  await page.click('[data-unalt="0"]').catch(() => {});
  await page.waitForTimeout(200);
  await overflowAt('scheda builder');

  // the workout builder: alternating weeks and a rotation
  const wp = await page.evaluate(async () => (await import('/js/plans.js')).activeInfo().planId);
  await go(`#/plan/${wp}`);
  await page.waitForSelector('[data-wb]');
  await page.click('[data-mode=ab]');
  await page.waitForTimeout(200);
  await page.click('[data-wv="1"]');
  check(!(await page.$('.wb-chip')), 'on a phone no wall of schede: the days come first');
  await page.click('[data-add="1:3"]');
  await page.waitForSelector('#modal[open] [data-pick]');
  await overflowAt('scheda picker');
  await page.click('#modal [data-pick]');
  await page.waitForTimeout(200);
  check((await page.$$('.wb-row[data-drop="day:1:3"] .wb-tile')).length === 1, 'placed on Thursday of week B');
  await overflowAt('workout builder A · B');
  const apAB = await page.evaluate(async () => (await import('/js/store.js')).pref('activePlan', null));
  check(apAB.mode === 'ab' && /^\d{4}-\d\d-\d\d$/.test(apAB.weekOf), `Everyday's record says A/B and which week (${apAB.mode} ${apAB.weekOf})`);
  await page.click('[data-mode=rotation]');
  await page.waitForTimeout(200);
  check(Boolean(await page.$('.wb-rot')) && (await page.$$('.wb-rot .wb-tile')).length >= 3, 'Rotazione: the schede in a loop');
  await page.click('.wb-rd');
  await page.waitForTimeout(200);
  check((await page.$$('.wb-link:not(.plain)')).length === 1, '+ riposo adds a rest day');
  await page.click('.wb-link:not(.plain) .wb-rd');
  await page.waitForTimeout(200);
  check((await page.textContent('.wb-link:not(.plain) .wb-rd')).includes('2'), 'tapping it again makes it 2 days');
  const apRot = await page.evaluate(async () => (await import('/js/store.js')).pref('activePlan', null));
  check(apRot.mode === 'rotation' && apRot.days.every((d) => d.weekday === null), 'a rotation: Everyday gets the schede with no fixed day');
  await overflowAt('workout builder rotation');
  await go('#/today');
  await page.waitForTimeout(200);
  check((await page.textContent('.today-hero .eyebrow')).includes('prossima') || (await page.textContent('.today-hero .eyebrow')).includes('Prossima'), 'Oggi: «La prossima»');
  await go(`#/plan/${wp}`);
  await page.click('[data-mode=week]');
  await page.waitForTimeout(200);
  check((await page.evaluate(async () => (await import('/js/store.js')).pref('activePlan', null))).mode === undefined, 'back to weekly: a plain record again');

  console.log('English');
  await go('#/settings/look');
  await page.click('.seg-opt:has(input[value=en])');

  console.log('The user guide');
  await go('#/settings');
  await page.click('a[href="guide-en.html"]');
  await page.waitForURL(/guide-en\.html$/);
  check((await page.textContent('h1')) === 'Palestra: user guide', 'Settings → Guide opens the English guide in the same tab');
  check(!(await page.evaluate(() => document.documentElement.classList.contains('desk'))), 'on a phone it opens the phone version');
  const vis = async (sel) => page.$$eval(sel, (xs) => xs.filter((x) => getComputedStyle(x).display !== 'none').length);
  check((await vis('img.ph')) >= 25 && (await vis('img.dk')) === 0, 'phone pictures only');
  check(await page.evaluate(() => [...document.querySelectorAll('img.ph')].every((i) => i.getAttribute('src').endsWith('.webp'))), 'phone pictures are WebP');
  check((await page.evaluate(() => document.documentElement.classList.contains('light'))), 'the guide follows the app: light here');
  await shot('17-guide-en');
  await page.selectOption('#mode', 'desk');
  check(await page.evaluate(() => document.documentElement.classList.contains('desk') && localStorage.getItem('guideMode') === 'desk'), 'Mostra la guida per → Computer switches the pictures and is remembered');
  check((await vis('img.dk')) >= 25 && (await vis('img.ph')) === 0, 'computer pictures only');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  check(await page.evaluate(() => document.documentElement.classList.contains('desk')), 'the choice survives a reload');
  await shot('d8-guide');
  await page.click('main img.dk');
  check(Boolean(await page.$('.zoom')), 'a click enlarges a picture');
  await page.keyboard.press('Escape');
  check(!(await page.$('.zoom')), 'Esc closes it');
  await page.selectOption('#mode', 'phone');
  await page.selectOption('#lang', 'guide-it.html');
  await page.waitForURL(/guide-it\.html$/);
  check((await page.textContent('h1')) === "Palestra: guida per l'utente", 'the Lingua dropdown opens the Italian guide');
  check(!(await page.evaluate(() => document.documentElement.classList.contains('desk'))), 'the phone choice is shared by both languages');
  await page.click('.top a[href="./#/settings"]');
  await page.waitForSelector('.title');
  check(page.url().endsWith('#/settings'), `"Torna all'app" lands on Settings (${page.url()})`);
  await page.setViewportSize({ width: 390, height: 844 });

  check(errors.length === 0, `no errors in the page${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} failed` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
