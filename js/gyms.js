// Gyms (v26): more than one place to train ("Palestra centro", "Casa"…), each with its zones, machines and the
// equipment it has. Kept in the synced prefs as {id: 'gyms', value: [{id, name, equipment?}]}; a zone says which gym
// it's in (places[].gymId, none = the first gym). A scheda says where it's done (routines[].gymId, none = the first),
// and an item can have a stand-in for one gym (items[].alt = {gymId: exerciseId}).
import { pref, setPref, get, live, uid } from './store.js';
import { t, getLang } from './i18n.js';
import { needOf, gymHas, alternativesFor } from './body.js';

export function gyms() {
  const v = pref('gyms', null);
  return Array.isArray(v) && v.length ? v : [{ id: 'main', name: '' }];
}
export const mainGym = () => gyms()[0];
export const gymById = (id) => gyms().find((g) => g.id === id) || mainGym();
export const gymName = (g) => (g && g.name) || (g === mainGym() ? pref('gymName', '') : '') || t('yourGym');
export function saveGyms(list) { setPref('gyms', list); }
export function addGym(name) {
  const g = { id: uid(), name, equipment: [] };
  saveGyms([...gyms(), g]);
  return g;
}
export function updateGym(id, patch) { saveGyms(gyms().map((g) => (g.id === id ? { ...g, ...patch } : g))); }
export function removeGym(id) { saveGyms(gyms().filter((g) => g.id !== id)); }

export const placeGymId = (p) => (p && p.gymId && gyms().some((g) => g.id === p.gymId) ? p.gymId : mainGym().id);
export const routineGymId = (r) => (r && r.gymId && gyms().some((g) => g.id === r.gymId) ? r.gymId : mainGym().id);

/** The exercise used for an item in a gym: its stand-in there, if it has one. */
export function exerciseIn(it, gymId) {
  const alt = it && it.alt && it.alt[gymId];
  return (alt && get('exercises', alt)) || get('exercises', it.exerciseId);
}

/** The routine as it's done in a gym: items with a stand-in there use it. */
export function routineIn(r, gymId) {
  if (!r) return r;
  return { ...r, items: (r.items || []).map((it) => {
    const alt = it.alt && it.alt[gymId] && get('exercises', it.alt[gymId]);
    return alt ? { ...fitItem(it, get('exercises', it.exerciseId), alt), standIn: it.exerciseId } : it;
  }) };
}

/** An item moved to another exercise: cardio minutes become one timed set, and the other way round. */
export function fitItem(it, from, to) {
  const wasCardio = from && from.type === 'cardio';
  if (wasCardio && to.type !== 'cardio') return { exerciseId: to.id, sets: 1, seconds: Math.round((Number(it.targets?.duration) || 10) * 60), rest: it.rest };
  if (!wasCardio && to.type === 'cardio') return { exerciseId: to.id, targets: { duration: 10 } };
  const out = { ...it, exerciseId: to.id };
  if (to.type !== 'weights') { delete out.weight; if (out.perSet) out.perSet = out.perSet.map(({ weight, ...p }) => p); }
  return out;
}

/** The items a gym can't do: [{ index, ex, need }]. */
export function missingIn(r, gymId) {
  const g = gymById(gymId);
  if (!r || !Array.isArray(g.equipment)) return [];
  const out = [];
  (r.items || []).forEach((it, index) => {
    const ex = exerciseIn(it, gymId);
    if (!ex) return;
    const need = needOf(ex);
    if (!gymHas(g, need)) out.push({ index, ex, need });
  });
  return out;
}

export function alternatives(ex, gymId, max = 2) {
  return alternativesFor(ex, gymById(gymId), live('exercises'), getLang(), max);
}
