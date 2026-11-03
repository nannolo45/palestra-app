// Pictures of exercises, from free-exercise-db (public domain): a small index ships with the app
// (lib/exercise-pictures.json) and the pictures load from the project's GitHub address the first time they're shown;
// the service worker keeps them for offline use. An exercise stores its choice as
//   picture: { lib: 'fedb', id, name, n }   (n = how many frames: start and end)   or   picture: { none: true }
// Exercises have Italian (or the person's own) names, so suggestions translate the usual Italian gym words first.

let index = null;
let loading = null;

function useIndex(j) {
  index = { base: j.base, items: j.items.map(([id, name, equipment, category, muscle, n]) => ({ id, name, equipment, category, muscle, n, words: words(name) })) };
  return index;
}
/** For tests: the index as read from the file. */
export const setIndex = (j) => useIndex(j);

/** The index, loaded once. */
export function loadIndex() {
  if (index) return Promise.resolve(index);
  if (!loading) loading = fetch('lib/exercise-pictures.json').then((r) => r.json()).then(useIndex).catch((e) => { loading = null; throw e; });
  return loading;
}
export const indexReady = () => Boolean(index);

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
/** Address of a frame (0 = start, 1 = end). */
export function frameUrl(pic, frame = 0) {
  if (!pic || pic.none || !pic.id) return '';
  return `${BASE}${encodeURIComponent(pic.id).replace(/%2F/g, '/')}/${Math.min(frame, (pic.n || 1) - 1)}.jpg`;
}
export const hasPicture = (ex) => Boolean(ex && ex.picture && ex.picture.id);

// ---- matching ----

// Italian (and common gym-Italian) → the words the library uses. Longest first.
const PHRASES = [
  // English names, nudged to the library's wording
  ['incline treadmill', 'jogging treadmill'], ['tapis roulant in salita', 'jogging treadmill'], ['french press', 'ez bar skullcrusher'], ['bench press', 'barbell bench press medium grip'], ['lat pulldown', 'wide grip lat pulldown'], ['barbell row', 'bent over barbell row'],
  ['lateral raise', 'side lateral raise'], ['skull crusher', 'ez bar skullcrusher'], ['romanian deadlift', 'romanian deadlift'], ['leg curl', 'lying leg curls'], ['hammer curl', 'hammer curls'],
  ['calf raise', 'standing calf raises'], ['cable fly', 'flat bench cable flyes'], ['chest press', 'leverage chest press'],
  ['curl su panca inclinata', 'incline dumbbell curl'], ['curl con bilanciere', 'barbell curl'], ['curl con manubri', 'dumbbell bicep curl'], ['curl a martello', 'hammer curls'],
  ['dip alle parallele', 'dips triceps version'], ['croci ai cavi', 'cable crossover'], ['crunch ai cavi', 'cable crunch'], ['push down ai cavi', 'triceps pushdown'],
  ['panca inclinata con manubri', 'incline dumbbell press'], ['panca inclinata', 'incline bench press'], ['panca declinata', 'decline bench press'], ['panca piana', 'bench press medium grip'], ['panca scott', 'preacher curl'],
  ['stacco rumeno', 'romanian deadlift'], ['stacco da terra', 'deadlift'], ['stacco', 'deadlift'], ['squat con bilanciere', 'barbell squat'], ['affondi in camminata', 'walking lunge'],
  ['alzate laterali', 'side lateral raise'], ['alzate frontali', 'front raise'], ['lento avanti', 'shoulder press'], ['lento dietro', 'behind the neck press'],
  ['lat machine', 'wide grip lat pulldown'], ['pulley basso', 'seated cable rows'], ['pulley', 'seated cable rows'], ['rematore con bilanciere', 'bent over barbell row'], ['rematore', 'row'],
  ['tapis roulant', 'treadmill'], ['ellittica', 'elliptical trainer'], ['cyclette', 'bicycling stationary'], ['bike', 'bicycling stationary'], ['vogatore', 'rowing stationary'], ['stepper', 'stairmaster'], ['rower', 'rowing stationary'], ['rowing machine', 'rowing stationary'], ['cross trainer', 'elliptical trainer'], ['exercise bike', 'bicycling stationary'], ['stationary bike', 'bicycling stationary'],
  ['iperestensioni', 'hyperextensions back extensions'], ['ponte glutei', 'glute bridge'], ['trazioni', 'pullups'], ['piegamenti', 'pushups'], ['polpacci', 'calf raise'],
  ['french press', 'skullcrusher'], ['push down', 'triceps pushdown'], ['pushdown', 'triceps pushdown'], ['croci', 'flyes'], ['affondi', 'lunges'], ['addominali', 'crunch'], ['scrollate', 'shrug'],
  ['panca', 'bench press'], ['spalle', 'shoulder'], ['petto', 'chest'], ['schiena', 'back'], ['gambe', 'leg'], ['tricipiti', 'triceps'], ['bicipiti', 'biceps'], ['spinte', 'press'], ['in salita', 'incline'], ['inclinata', 'incline'], ['manubri', 'dumbbell'], ['manubrio', 'dumbbell'], ['bilanciere', 'barbell'], ['cavi', 'cable'], ['cavo', 'cable'], ['macchina', 'machine'],
];
const EQUIP = { barbell: 'barbell', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine' };
const STOP = new Set(['the', 'a', 'with', 'on', 'to', 'and', 'of', 'con', 'su', 'al', 'ai', 'alla', 'alle', 'di', 'da', 'in']);

function words(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, ' ').trim().split(' ')
    .filter((w) => w && !STOP.has(w)).map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/** The query in the library's words. */
export function translate(name) {
  let s = ` ${String(name).toLowerCase()} `;
  for (const [it, en] of PHRASES) s = s.replace(new RegExp(`(^|\\W)${it}(?=\\W|$)`, 'g'), `$1${en}`);
  return s.trim();
}

/** Score one library entry for a query (already translated) and an exercise (for its type and equipment). */
function score(item, q, ex) {
  let sc = 0;
  const name = item.name.toLowerCase();
  const phrase = q.toLowerCase();
  if (phrase && name.includes(phrase)) sc += 8;
  const qw = words(phrase);
  const hit = qw.filter((w) => item.words.includes(w)).length;
  sc += hit * 3;
  if (!hit) return 0;
  sc -= Math.max(0, item.words.length - hit) * 0.4; // prefer the plain version
  if (ex) {
    const eq = EQUIP[ex.equipment];
    if (ex.type === 'cardio') sc += item.category === 'cardio' ? 5 : -4;
    else if (item.category === 'cardio') sc -= 4;
    if (eq && (item.equipment === eq || (eq === 'machine' && /leverage|machine/i.test(item.name)))) sc += 2;
    if (ex.type === 'bodyweight' && item.equipment === 'body only') sc += 2;
  }
  if (item.category === 'stretching') sc -= 5;
  return sc;
}

/** Up to `limit` suggestions for an exercise, best first. */
export async function suggest(ex, { query = '', limit = 6 } = {}) {
  const ix = await loadIndex();
  const q = translate(query || ex?.name || '');
  return ix.items.map((it) => ({ it, sc: score(it, q, query ? null : ex) }))
    .filter((x) => x.sc > 0).sort((a, b) => b.sc - a.sc || a.it.name.length - b.it.name.length)
    .slice(0, limit).map((x) => x.it);
}

/** What an exercise stores when one is chosen. */
export const toPicture = (it) => ({ lib: 'fedb', id: it.id, name: it.name, n: it.n });
