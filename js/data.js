// Lookups and derived values the views share: names, places, estimated lengths, labels.
import { state, live, get, upsert, pref } from './store.js';
import { estMinutes, durationFromHistory, DEFAULT_TRAINING, DEFAULT_INCREASE, CARDIO_KINDS, weightMode, BAR_KG } from './model.js';
import { t } from './i18n.js';
import { fmtNum } from './ui/format.js';

export const training = () => ({ ...DEFAULT_TRAINING, ...(pref('training', {}) || {}) });
export const increaseSettings = () => {
  const v = pref('increase', {}) || {};
  return { ...DEFAULT_INCREASE, ...v, steps: { ...DEFAULT_INCREASE.steps, ...(v.steps || {}) } };
};

export const places = () => live('places').sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.name).localeCompare(b.name));
export const machines = () => live('machines').sort((a, b) => String(a.number || a.name).localeCompare(String(b.number || b.name), undefined, { numeric: true }));
export const exercises = () => live('exercises').sort((a, b) => String(a.name).localeCompare(b.name));
export const routines = () => live('routines').sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.name).localeCompare(b.name));
export const sessions = () => live('sessions').sort((a, b) => (b.start || 0) - (a.start || 0));

export const machineOf = (ex) => (ex && ex.machineId ? get('machines', ex.machineId) : null);
export const placeOf = (ex) => {
  const m = machineOf(ex);
  return get('places', (m && m.placeId) || (ex && ex.placeId)) || null;
};

/** "M14 · Sala pesi, fila 2" */
export function whereText(ex) {
  const m = machineOf(ex);
  const p = placeOf(ex);
  return [m && (m.number || m.name), p && p.name].filter(Boolean).join(' · ');
}

export function typeLabel(ex) {
  if (!ex) return '';
  if (ex.type === 'cardio') return t(`kind_${ex.cardio?.kind || 'treadmill'}`);
  if (ex.type === 'bodyweight') return t('type_bodyweight');
  return t(`eq_${ex.equipment || 'machine'}`);
}

export function cardioKindLabel(kind, machine) {
  if (kind === 'custom') return machine?.name || t('kind_custom');
  return CARDIO_KINDS[kind] ? t(`kind_${kind}`) : kind;
}

export function measureLabel(m) {
  return m.label || t(`m_${m.key}`);
}

/** The estimated length of a routine, computed now. */
/** The scheda's minutes: the estimate from its sets and rests, corrected by how long it really took you (v27). */
export function routineMinutes(r) {
  const ex = state.exercises.filter((e) => !e.deleted); const ss = state.sessions.filter((s) => !s.deleted);
  const base = estMinutes(r, ex, ss, training());
  if (!r || !base) return base;
  return Math.max(1, Math.round(base * durationFromHistory(r.id, ss, ex, training()).ratio));
}
export function minutesExplained(r) {
  const ex = state.exercises.filter((e) => !e.deleted); const ss = state.sessions.filter((s) => !s.deleted);
  const base = estMinutes(r, ex, ss, training());
  const h = durationFromHistory(r.id, ss, ex, training());
  return { base, ...h, minutes: Math.max(1, Math.round(base * h.ratio)) };
}

/** Keep every routine's estMinutes (read by Everyday) in step with the exercises and the logged sessions. */
export function refreshEstimates() {
  for (const r of live('routines')) {
    const m = routineMinutes(r);
    if (m !== r.estMinutes) upsert('routines', { ...r, estMinutes: m }, { silent: true });
  }
}

export function lastDone(routineId) {
  const s = sessions().find((x) => x.routineId === routineId && x.end);
  return s ? s.start : null;
}

/** Impostazioni → Il tuo corpo ({kg, cm, sex, level}), if filled in. */
export function bodyPrefs() {
  const b = pref('body', null);
  return b && Number(b.kg) > 0 ? b : null;
}

// ---- what the weight means, said the same way everywhere (v33) ----

/**
 * For an exercise and a weight: what (the words after "kg": per manubrio, in tutto, per lato…), label ("kg · what")
 * and hint (the sums, empty when there are none). Not weights: no words.
 */
export function weightTexts(ex, w) {
  const n = Number(w) || 0;
  const k = (x) => fmtNum(Math.round(x * 100) / 100);
  let what = ''; let hint = '';
  switch (weightMode(ex)) {
    case 'dbEach': what = t('wWhatEach'); hint = n ? t('wHintEach', k(n), k(n * 2)) : ''; break;
    case 'dbOne': what = t('wWhatOne'); hint = n ? t('wHintOne', k(n)) : ''; break;
    case 'dbTotal': what = t('wWhatTotal'); hint = n ? t('wHintDbTotal', k(n / 2)) : ''; break;
    case 'barTotal': what = t('wWhatBar'); hint = n > BAR_KG ? t('wHintBar', k((n - BAR_KG) / 2)) : ''; break;
    case 'barSide': what = t('wWhatSide'); hint = n ? t('wHintSide', k(n * 2 + BAR_KG)) : ''; break;
    case 'stackSide': what = t('wWhatSide'); hint = n ? t('wHintStackSide', k(n * 2)) : ''; break;
    case 'stackTotal': what = t('wWhatTotal'); break;
    default: break;
  }
  return { what, label: what ? `kg · ${what}` : 'kg', hint };
}

/** The ways an exercise's weight can be read, for the sheet in the workout: [{mode, label, sub, patch}]. */
export function weightAsChoices(ex) {
  if (weightMode(ex) === 'plain') return [];
  if (ex.equipment === 'dumbbell') {
    return [
      { mode: 'dbEach', label: t('wAsEach'), sub: t('wSubEach'), patch: { weightAs: 'each', dumbbells: 2 } },
      { mode: 'dbOne', label: t('wAsOne'), sub: t('wSubOne'), patch: { weightAs: 'each', dumbbells: 1 } },
      { mode: 'dbTotal', label: t('wAsTotal'), sub: t('wSubDbTotal'), patch: { weightAs: 'total' } },
    ];
  }
  if (ex.equipment === 'barbell') {
    return [
      { mode: 'barTotal', label: t('wAsBar'), sub: t('wSubBar'), patch: { weightAs: 'total' } },
      { mode: 'barSide', label: t('wAsSide'), sub: t('wSubBarSide'), patch: { weightAs: 'side' } },
    ];
  }
  return [
    { mode: 'stackTotal', label: t('wAsTotal'), sub: t('wSubStack'), patch: { weightAs: 'total' } },
    { mode: 'stackSide', label: t('wAsSideArm'), sub: t('wSubStackSide'), patch: { weightAs: 'side' } },
  ];
}

/** "52,5 kg" → "52,5 kg per lato": a sets text with what the kg means, for weights. */
export const withWhat = (text, ex) => {
  const w = weightTexts(ex).what;
  return w && / kg/.test(text) ? `${text} ${w}` : text;
};
