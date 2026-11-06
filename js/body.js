// The body (v26): seven regions with their muscles, recognising an exercise's muscles from its name (Italian,
// English and German words are turned into an English movement first, then the movement gives the muscles), what
// an exercise needs to be done (equipment), and alternatives for the same muscles. Keys are English; the names are
// shown in the app's language. Pure: no store, so it can be tested on its own.

export const REGIONS = [
  { key: 'chest', color: '#F07A4F', muscles: ['chest'] },
  { key: 'back', color: '#4A90D9', muscles: ['lats', 'middle back', 'traps', 'lower back'] },
  { key: 'shoulders', color: '#9575CD', muscles: ['shoulders', 'rear delts'] },
  { key: 'arms', color: '#E06C9F', muscles: ['biceps', 'triceps', 'forearms'] },
  { key: 'legs', color: '#5BAF61', muscles: ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors'] },
  { key: 'core', color: '#2BB3A8', muscles: ['abs', 'obliques'] },
  { key: 'cardio', color: '#E8B400', muscles: ['cardio'] },
];
export const REGION_KEYS = REGIONS.map((r) => r.key);
export const MUSCLE_KEYS = REGIONS.flatMap((r) => r.muscles);
export const regionOfMuscle = (m) => REGIONS.find((r) => r.muscles.includes(m))?.key || null;
export const regionColor = (k) => REGIONS.find((r) => r.key === k)?.color || '#8A9A99';

// [it, en, de] — German is recognised when typed, and kept here for a German version of the app
const NAMES = {
  r_chest: ['Petto', 'Chest', 'Brust'], r_back: ['Schiena', 'Back', 'Rücken'], r_shoulders: ['Spalle', 'Shoulders', 'Schultern'],
  r_arms: ['Braccia', 'Arms', 'Arme'], r_legs: ['Gambe', 'Legs', 'Beine'], r_core: ['Core', 'Core', 'Rumpf'], r_cardio: ['Cardio', 'Cardio', 'Cardio'],
  r_unsorted: ['Da sistemare', 'To sort out', 'Zu ordnen'],
  chest: ['Petto', 'Chest', 'Brust'], lats: ['Dorsali', 'Lats', 'Latissimus'], 'middle back': ['Schiena alta', 'Upper back', 'Oberer Rücken'],
  traps: ['Trapezi', 'Traps', 'Trapez'], 'lower back': ['Lombari', 'Lower back', 'Unterer Rücken'], shoulders: ['Deltoidi', 'Delts', 'Deltamuskel'],
  'rear delts': ['Deltoidi posteriori', 'Rear delts', 'Hintere Schulter'], biceps: ['Bicipiti', 'Biceps', 'Bizeps'], triceps: ['Tricipiti', 'Triceps', 'Trizeps'],
  forearms: ['Avambracci', 'Forearms', 'Unterarme'], quadriceps: ['Quadricipiti', 'Quads', 'Quadrizeps'], hamstrings: ['Femorali', 'Hamstrings', 'Beinbeuger'],
  glutes: ['Glutei', 'Glutes', 'Gesäß'], calves: ['Polpacci', 'Calves', 'Waden'], adductors: ['Adduttori', 'Adductors', 'Adduktoren'],
  abs: ['Addominali', 'Abs', 'Bauch'], obliques: ['Obliqui', 'Obliques', 'Schräge Bauchmuskeln'], cardio: ['Cardio', 'Cardio', 'Cardio'],
};
const LI = { it: 0, en: 1, de: 2 };
export const muscleName = (k, lang = 'it') => (NAMES[k] ? NAMES[k][LI[lang] ?? 0] : k);
export const regionName = (k, lang = 'it') => (NAMES[`r_${k}`] ? NAMES[`r_${k}`][LI[lang] ?? 0] : k);

const fold = (s) => ` ${String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Words of a muscle as people type them (the old free-text field, an import, free-exercise-db) → the muscle's key.
const MUSCLE_WORDS = [
  [/ (pett|pector|pecs? |chest|brust)/, 'chest'], [/ (dorsal|lat |lats|latissim|ruckenbreite)/, 'lats'], [/ (schiena alta|middle back|upper back|romboid|rhomboid|oberer rucken)/, 'middle back'],
  [/ (trapez|traps)/, 'traps'], [/ (lombar|lower back|erector|unterer rucken|lendenwirbel)/, 'lower back'], [/ (deltoidi posteriori|rear delt|hintere schulter)/, 'rear delts'],
  [/ (spall|deltoid|delts?|shoulder|schulter)/, 'shoulders'], [/ (bicip|biceps|bizeps)/, 'biceps'], [/ (tricip|triceps|trizeps)/, 'triceps'], [/ (avambracc|forearm|unterarm)/, 'forearms'],
  [/ (quadricip|quadricep|quads?|quadrizeps|cosce|oberschenkel vorn)/, 'quadriceps'], [/ (femoral|hamstring|ischiocrural|beinbeuger)/, 'hamstrings'], [/ (glute|glutei|gluteo|gesass|po )/, 'glutes'],
  [/ (polpacc|calf|calves|waden)/, 'calves'], [/ (addutt|adductor|adduktor)/, 'adductors'], [/ (obliqu|schrage)/, 'obliques'],
  [/ (addom|addome|abdominal|abs |bauch|core )/, 'abs'], [/ (cardio|ausdauer)/, 'cardio'], [/ (schiena|back|rucken)/, 'lats'], [/ (gambe|legs?|beine)/, 'quadriceps'], [/ (bracci|arms?|arme)/, 'biceps'],
];
export function muscleFromWord(w) {
  if (MUSCLE_KEYS.includes(w)) return w;
  const n = fold(w);
  for (const [re, k] of MUSCLE_WORDS) if (re.test(n)) return k;
  return null;
}

// Words of a name → an English movement. First match wins, so the more specific ones come first.
const WORDS = [
  [/ (curl a martello|hammer)/, 'hammer curl'], [/ (leg curl|beinbeuger|curl (alle |per le )?gambe)/, 'leg curl'], [/ (polso|wrist)/, 'wrist curl'], [/ (curl|bizeps)/, 'curl'],
  [/ (panca|bench|bankdruck|banco|distension)/, 'bench press'], [/ (pectoral|pec deck|butterfly)/, 'pec deck'], [/ (croci|fly |flys |flyes|fliegende|flies)/, 'fly'],
  [/ (chest press|brustpresse|spinte? (al|sul) petto)/, 'chest press'], [/ (piegament|push ?ups?|liegestutz|flessioni)/, 'push up'],
  [/ (rematore|rudern|row )/, 'row'], [/ (trazion|pull ?ups?|chin ?ups?|klimmzug)/, 'pull up'], [/ (lat ?machine|latzug|lat pull|pulldown|pull down|lat )/, 'lat pulldown'],
  [/ (pulley|cable row|seated row)/, 'cable row'], [/ (stacco rumeno|romanian|rdl |stiff leg)/, 'romanian deadlift'], [/ (stacc|deadlift|kreuzheben)/, 'deadlift'],
  [/ (iperestension|hyperextension|back extension|ruckenstrecker|superman)/, 'hyperextension'], [/ (scrollat|shrug)/, 'shrug'],
  [/ (alzate posteriori|reverse fly|rear delt|face pull)/, 'face pull'], [/ (alzate laterali|alzate|lateral raise|seitheben|front raise)/, 'lateral raise'],
  [/ (military|lento |shoulder press|overhead press|schulterdruck|arnold|spinte? (con )?manubri sopra)/, 'overhead press'],
  [/ (incline|decline|dumbbell press|db press|press con manubri|distensioni)/, 'bench press'],
  [/ (french|skull|estensioni (sopra la testa|tricipiti|overhead)|overhead extension|triceps extension|kickback)/, 'triceps extension'],
  [/ (push ?down|pushdown|trizepsdruck|tricipiti ai cavi|cavo alto tricipiti)/, 'pushdown'], [/ (dips? |parallele)/, 'dip'],
  [/ (leg press|beinpresse|pressa)/, 'leg press'], [/ (leg extension|beinstrecker|estensioni (delle |per le )?gambe)/, 'leg extension'],
  [/ (affond|lunges?|ausfallschritt|split squat|bulgar)/, 'lunge'], [/ (squat|kniebeuge|hack)/, 'squat'], [/ (hip thrust|ponte|glute bridge|bridge)/, 'hip thrust'],
  [/ (calf|polpacc|wadenheben|calf raise)/, 'calf raise'], [/ (adduttor|adductor|adduktor)/, 'adductor'], [/ (abduttor|abductor|abduktor)/, 'abductor'], [/ (step ?up)/, 'step up'],
  [/ (plank|tenuta)/, 'plank'], [/ (crunch|sit ?ups?|addominali)/, 'crunch'], [/ (leg raise|sollevamento gambe|beinheben|knee raise)/, 'leg raise'],
  [/ (russian twist|torsion|obliqu|side bend)/, 'russian twist'], [/ (mountain climber|scalatore)/, 'mountain climber'], [/ (burpee)/, 'burpee'],
  [/ (tapis|treadmill|laufband|corsa|run |running|camminata)/, 'treadmill'], [/ (bike|cyclette|spinning|fahrrad|ergometer|bici)/, 'bike'],
  [/ (ellittica|elliptical|crosstrainer|cross trainer)/, 'elliptical'], [/ (vogatore|rower|rowing|rudergerat|remoergometro)/, 'rower'], [/ (jumping jack|salti)/, 'jumping jack'],
  [/ (stepper|stair|scale|treppen)/, 'stair'], [/ (corda|rope jump|skipping|springseil)/, 'jumping jack'],
];
// movement → muscles, primary first
const MOVES = {
  'bench press': ['chest', 'triceps'], 'chest press': ['chest', 'triceps'], 'push up': ['chest', 'triceps'], 'pec deck': ['chest'], fly: ['chest'],
  row: ['middle back', 'lats'], 'cable row': ['middle back', 'lats'], 'pull up': ['lats', 'biceps'], 'lat pulldown': ['lats', 'biceps'],
  deadlift: ['lower back', 'hamstrings', 'glutes'], 'romanian deadlift': ['hamstrings', 'glutes'], hyperextension: ['lower back'], shrug: ['traps'],
  'lateral raise': ['shoulders'], 'overhead press': ['shoulders', 'triceps'], 'face pull': ['rear delts'],
  curl: ['biceps'], 'hammer curl': ['biceps', 'forearms'], 'wrist curl': ['forearms'], 'triceps extension': ['triceps'], pushdown: ['triceps'], dip: ['triceps', 'chest'],
  'leg press': ['quadriceps', 'glutes'], 'leg extension': ['quadriceps'], squat: ['quadriceps', 'glutes'], lunge: ['quadriceps', 'glutes'], 'hip thrust': ['glutes', 'hamstrings'],
  'leg curl': ['hamstrings'], 'calf raise': ['calves'], adductor: ['adductors'], abductor: ['glutes'], 'step up': ['quadriceps', 'glutes'],
  plank: ['abs'], crunch: ['abs'], 'leg raise': ['abs'], 'russian twist': ['obliques'], 'mountain climber': ['abs'], burpee: ['cardio'],
  treadmill: ['cardio'], bike: ['cardio'], elliptical: ['cardio'], rower: ['cardio'], 'jumping jack': ['cardio'], stair: ['cardio'],
};
export const MOVEMENTS = Object.keys(MOVES);

/** "Chest press" → { en: 'chest press', muscles: ['chest', 'triceps'] }, or null. */
export function classify(name) {
  const n = fold(name);
  for (const [re, en] of WORDS) if (re.test(n)) return { en, muscles: MOVES[en] };
  return null;
}

/**
 * An exercise's muscles, primary first: the ones chosen (keys, or words from before v26), else recognised from the
 * name; cardio is cardio. [] when nothing fits (the exercise goes to "Da sistemare").
 */
export function musclesOf(ex) {
  if (!ex) return [];
  if (ex.type === 'cardio') return ['cardio'];
  const chosen = [];
  for (const w of ex.muscles || []) { const k = muscleFromWord(w); if (k && !chosen.includes(k)) chosen.push(k); }
  if (chosen.length) return chosen;
  return classify(ex.name)?.muscles?.slice() || [];
}
/** Recognised (not chosen) from the name: shown as a hint on the exercise card. */
export const guessedMuscles = (ex) => ((ex?.muscles || []).some((w) => muscleFromWord(w)) ? [] : musclesOf(ex));
export const regionOf = (ex) => regionOfMuscle(musclesOf(ex)[0]) || 'unsorted';

// ---- equipment ----

export const EQUIP = ['barbell', 'rack', 'bench', 'dumbbells', 'cables', 'legpress', 'machines', 'bars', 'cardio', 'mats'];

/** What an exercise needs: one of EQUIP, or 'none'. */
export function needOf(ex) {
  if (!ex) return 'none';
  if (ex.type === 'cardio') return 'cardio';
  const en = classify(ex.name)?.en;
  if (ex.type === 'bodyweight') return en === 'pull up' || en === 'dip' ? 'bars' : 'none';
  switch (ex.equipment) {
    case 'barbell': return en === 'squat' ? 'rack' : 'barbell';
    case 'dumbbell': return 'dumbbells';
    case 'cable': return 'cables';
    default: return en === 'leg press' ? 'legpress' : 'machines';
  }
}

/** Does a gym have what an exercise needs? equipment undefined = everything (the gym before v26). */
export function gymHas(gym, need) {
  if (need === 'none' || !gym || !Array.isArray(gym.equipment)) return true;
  return gym.equipment.includes(need);
}

// Alternatives that need little: offered when nothing in the person's own exercises fits.
// [it, en, type, equipment, muscles]
export const BUILTIN = [
  ['Squat a corpo libero', 'Bodyweight squat', 'bodyweight', null, ['quadriceps', 'glutes']],
  ['Squat con manubri (goblet)', 'Goblet squat', 'weights', 'dumbbell', ['quadriceps', 'glutes']],
  ['Affondi con manubri', 'Dumbbell lunges', 'weights', 'dumbbell', ['quadriceps', 'glutes']],
  ['Affondi a corpo libero', 'Bodyweight lunges', 'bodyweight', null, ['quadriceps', 'glutes']],
  ['Stacco rumeno con manubri', 'Dumbbell Romanian deadlift', 'weights', 'dumbbell', ['hamstrings', 'glutes']],
  ['Ponte glutei a una gamba', 'Single-leg glute bridge', 'bodyweight', null, ['glutes', 'hamstrings']],
  ['Calf raise su un gradino', 'Calf raise on a step', 'bodyweight', null, ['calves']],
  ['Calf raise con manubri', 'Dumbbell calf raise', 'weights', 'dumbbell', ['calves']],
  ['Piegamenti', 'Push-ups', 'bodyweight', null, ['chest', 'triceps']],
  ['Distensioni con manubri', 'Dumbbell press', 'weights', 'dumbbell', ['chest', 'triceps']],
  ['Croci con manubri', 'Dumbbell fly', 'weights', 'dumbbell', ['chest']],
  ['Rematore con manubrio', 'One-arm dumbbell row', 'weights', 'dumbbell', ['middle back', 'lats']],
  ['Trazioni', 'Pull-ups', 'bodyweight', null, ['lats', 'biceps']],
  ['Superman', 'Superman', 'bodyweight', null, ['lower back']],
  ['Lento con manubri', 'Dumbbell shoulder press', 'weights', 'dumbbell', ['shoulders', 'triceps']],
  ['Alzate laterali con manubri', 'Dumbbell lateral raise', 'weights', 'dumbbell', ['shoulders']],
  ['Piegamenti a V (pike)', 'Pike push-ups', 'bodyweight', null, ['shoulders', 'triceps']],
  ['Alzate posteriori con manubri', 'Dumbbell rear delt fly', 'weights', 'dumbbell', ['rear delts']],
  ['Curl con manubri', 'Dumbbell curl', 'weights', 'dumbbell', ['biceps']],
  ['Curl a martello', 'Hammer curl', 'weights', 'dumbbell', ['biceps', 'forearms']],
  ['Estensioni tricipiti con manubrio', 'Dumbbell overhead triceps extension', 'weights', 'dumbbell', ['triceps']],
  ['Dip su una sedia', 'Bench dips', 'bodyweight', null, ['triceps', 'chest']],
  ['Plank', 'Plank', 'bodyweight', null, ['abs']],
  ['Crunch', 'Crunch', 'bodyweight', null, ['abs']],
  ['Russian twist', 'Russian twist', 'bodyweight', null, ['obliques']],
  ['Jumping jack', 'Jumping jacks', 'bodyweight', null, ['cardio']],
  ['Corsa sul posto', 'Running in place', 'bodyweight', null, ['cardio']],
];

/**
 * Up to `max` alternatives for an exercise that a gym can't do: same primary muscle (else same region), something the
 * gym has. The person's own exercises first ({ ex }), then the ones above ({ builtin: {name, type, equipment, muscles} }).
 */
export function alternativesFor(ex, gym, library = [], lang = 'it', max = 2) {
  const mine = musclesOf(ex);
  const prim = mine[0];
  if (!prim) return [];
  const reg = regionOfMuscle(prim);
  const out = [];
  const seen = new Set([fold(ex.name)]);
  const score = (ms) => (ms[0] === prim ? 2 : ms.includes(prim) ? 1 : regionOfMuscle(ms[0]) === reg ? 0.5 : 0);
  const own = library.filter((x) => x.id !== ex.id && !x.deleted && (ex.type === 'cardio') === (x.type === 'cardio'))
    .map((x) => ({ x, s: score(musclesOf(x)) })).filter((o) => o.s > 0 && gymHas(gym, needOf(o.x))).sort((a, b) => b.s - a.s);
  for (const { x } of own) { if (out.length >= max) break; if (seen.has(fold(x.name))) continue; seen.add(fold(x.name)); out.push({ ex: x }); }
  const bi = BUILTIN.map(([it, en, type, equipment, muscles]) => ({ name: lang === 'en' ? en : it, type, equipment, muscles }))
    .map((b) => ({ b, s: score(b.muscles) })).filter((o) => o.s > 0 && gymHas(gym, needOf({ ...o.b, name: o.b.name })))
    .sort((a, b) => b.s - a.s);
  for (const { b } of bi) { if (out.length >= max) break; if (seen.has(fold(b.name))) continue; seen.add(fold(b.name)); out.push({ builtin: b }); }
  return out;
}
