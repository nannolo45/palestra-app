// Lookups and derived values the views share: names, places, estimated lengths, labels.
import { state, live, get, upsert, pref } from './store.js';
import { estMinutes, DEFAULT_TRAINING, DEFAULT_INCREASE, CARDIO_KINDS } from './model.js';
import { t } from './i18n.js';

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
export function routineMinutes(r) {
  return estMinutes(r, state.exercises.filter((e) => !e.deleted), state.sessions.filter((s) => !s.deleted), training());
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
