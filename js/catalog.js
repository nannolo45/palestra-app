// The exercise catalogue (v27): free-exercise-db (the same as the pictures, public domain), about 750 exercises
// without the stretches, with Italian names for the usual ones (catalog-it.js). Each one already knows its muscle,
// equipment and pictures; adding it makes it one of yours (exercises[].catalogId).
import { loadIndex } from './pictures.js';
import { IT_NAMES } from './catalog-it.js';
import { regionOfMuscle } from './body.js';

const MUSCLE = { abdominals: 'abs', abductors: 'glutes', neck: 'traps' };
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function typeOf(x) {
  if (x.category === 'cardio') return { type: 'cardio' };
  switch (x.equipment) {
    case 'barbell': case 'e-z curl bar': return { type: 'weights', equipment: 'barbell' };
    case 'dumbbell': case 'kettlebells': return { type: 'weights', equipment: 'dumbbell' };
    case 'cable': return { type: 'weights', equipment: 'cable' };
    case 'machine': return { type: 'weights', equipment: 'machine' };
    default: return { type: 'bodyweight' };
  }
}
function cardioKind(name) {
  const n = fold(name);
  if (/treadmill|running|walking|jogging/.test(n)) return 'treadmill';
  if (/bik|bicycl/.test(n)) return 'bike';
  if (/elliptical/.test(n)) return 'elliptical';
  if (/rowing/.test(n)) return 'rower';
  if (/stair|step mill/.test(n)) return 'stepper';
  return 'custom';
}

let cat = null;
/** The catalogue, loaded once: [{ id, en, it, muscle, region, type, equipment, n, words }]. */
export async function loadCatalog() {
  if (cat) return cat;
  const idx = await loadIndex();
  cat = idx.items.filter((x) => x.category !== 'stretching').map((x) => {
    const muscle = MUSCLE[x.muscle] || x.muscle || null;
    const it = IT_NAMES[x.id] || null;
    return { id: x.id, en: x.name, it, muscle, region: x.category === 'cardio' ? 'cardio' : regionOfMuscle(muscle) || 'unsorted', ...typeOf(x), n: x.n, rank: it ? 0 : 1, words: fold(`${it || ''} ${x.name}`) };
  }).sort((a, b) => a.rank - b.rank || (a.it || a.en).localeCompare(b.it || b.en));
  return cat;
}
export const catalogReady = () => Boolean(cat);
export const nameIn = (c, lang) => (lang === 'it' && c.it ? c.it : c.en);

/** Search in Italian and English; every word has to match somewhere. */
export function searchCatalog(list, q, { region = '', equipment = '' } = {}) {
  const ws = fold(q).split(' ').filter(Boolean);
  return list.filter((c) => (!region || c.region === region) && (!equipment || (equipment === 'bodyweight' ? c.type === 'bodyweight' : c.equipment === equipment))
    && ws.every((w) => c.words.includes(w)));
}

/** The exercise record for a catalogue entry. */
export function exerciseFrom(c, lang, rest = 90) {
  const ex = { name: nameIn(c, lang), type: c.type, muscles: c.type === 'cardio' || !c.muscle ? [] : [c.muscle], notes: '', increase: { mode: 'type' }, catalogId: c.id, picture: { lib: 'fedb', id: c.id, name: c.en, n: c.n || 2 } };
  if (c.type === 'weights') ex.equipment = c.equipment;
  if (c.type === 'cardio') ex.cardio = { kind: cardioKind(c.en), targets: {} };
  if (c.type !== 'cardio') ex.defaultRest = rest;
  return ex;
}

/** Which of your exercises is this entry? (by its link, or by the same name in either language) */
export function yoursFor(c, mine) {
  return mine.find((e) => e.catalogId === c.id) || mine.find((e) => !e.catalogId && (fold(e.name) === fold(c.en) || (c.it && fold(e.name) === fold(c.it))));
}
