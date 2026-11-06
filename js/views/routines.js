// Allenamenti: the list of routines, one routine, and its editor (order, sets, automatic increase).
import { state, get, upsert, remove, restore, uid, pref, live } from '../store.js';
import { gyms, gymById, gymName, mainGym, routineGymId, missingIn, exerciseIn, alternatives, fitItem } from '../gyms.js';
import { needOf } from '../body.js';
import { t } from '../i18n.js';
import { esc, fmtNum, restText, minText, shortDate, timeOfDay, weekdayShort } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, stepper, bindSteppers, stepVal, toggle, empty, exTag, segmented, trainHead } from '../ui/parts.js';
import { openSheet, askConfirm, toast, chooseHowToCreate } from '../ui/dialogs.js';
import { isWide } from '../shell.js';
import {
  routines, exercises, routineMinutes, refreshEstimates, lastDone, whereText, placeOf, machineOf, training, measureLabel, typeLabel, places, sessions, bodyPrefs,
} from '../data.js';
import { plannedAhead, measuresFor, defaultTargets, setsText, setsOf, setPlan, itemFromRows, variedSets, suggestWeight } from '../model.js';
import { thumbOf, openViewer } from './pictures.js';
import { activeInfo, planDays, plans, plansWith, savePlan } from '../plans.js';
import { listKit, colorOf } from '../ui/listkit.js';

const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));

function itemPlan(it, ex) {
  if (!ex) return '';
  if (ex.type === 'cardio') {
    const ms = measuresFor(ex, machineOf(ex)).slice(0, 2);
    return ms.map((m) => `${fmtNum(it.targets?.[m.key])}${m.unit ? ` ${m.unit}` : ''}`).join(' · ');
  }
  return `${setsText(it, ex.type === 'weights')}${it.failure ? ` · ${t(it.failure === 'last' ? 'failureLastShort' : 'failureShort')}` : ''}`;
}

export function plannedFor(routineId) {
  return plannedAhead(pref('planned', [])).filter((p) => p.routineId === routineId);
}

function plannedText(p) {
  return `${shortDate(p.at)}, ${timeOfDay(p.at)}`;
}

// ---- the library ----


export function routinesView(query = {}) {
  const all = routines();
  const a = activeInfo();
  const activeIds = new Set(a ? planDays(a.plan).map((d) => d.routineId) : []);
  const ps = plans();
  const wide = isWide();
  const wKey = (r) => { const ws = plansWith(r.id); return ws.length ? ws.map((p) => `w:${p.id}`) : ['w:none']; };
  const wName = (k) => (k === 'w:none' ? t('inNoWorkout') : get('plans', k.slice(2))?.name || '');
  const weekAgo = Date.now() - 7 * 86400000;
  const lastKey = (r) => { const l = lastDone(r.id); return !l ? 'l:never' : l >= weekAgo ? 'l:week' : 'l:before'; };
  const lenKey = (r) => { const m = routineMinutes(r); return m <= 45 ? 's' : m <= 75 ? 'm' : 'l'; };
  const planKeys = [...ps.map((p) => `w:${p.id}`), 'w:none'];
  const sel = wide ? (get('routines', query.sel) ? query.sel : all[0]?.id) : null;
  const kit = listKit({
    id: 'sc', items: all, searchPh: t('searchRoutine'),
    text: (r) => [r.name, ...plansWith(r.id).map((p) => p.name)].join(' '),
    noun: (n) => t('nRoutines', n),
    groups: {
      workout: { label: t('gWorkout'), keysOf: wKey, name: wName, paletteKeys: planKeys, order: (ks) => [...(a ? [`w:${a.planId}`] : []), ...planKeys.filter((k) => !a || k !== `w:${a.planId}`)].filter((k) => ks.includes(k)) },
      last: { label: t('gLast'), keysOf: (r) => [lastKey(r)], name: (k) => t(`gl_${k.slice(2)}`), order: (ks) => ['l:week', 'l:before', 'l:never'].filter((k) => ks.includes(k)) },
      none: { label: t('gNone'), keysOf: () => ['all'], name: () => '' },
    },
    facets: [
      { key: 'workout', label: t('gWorkout'), options: planKeys.filter((k) => all.some((r) => wKey(r).includes(k))).map((k) => [k, wName(k), k, 'workout']), get: wKey },
      { key: 'state', label: t('fState'), options: [...(a ? [['active', t('filterActive')]] : []), ['done', t('fDone')], ['never', t('fNever')]], get: (r) => [activeIds.has(r.id) ? 'active' : '', lastDone(r.id) ? 'done' : 'never'] },
      { key: 'len', label: t('fLength'), options: [['s', t('len_s')], ['m', t('len_m')], ['l', t('len_l')]], get: lenKey },
    ],
    sorts: [
      { key: 'order', label: t('sOrder'), cmp: (x, y) => (x.order ?? 0) - (y.order ?? 0) },
      { key: 'name', label: t('sName'), cmp: (x, y) => x.name.localeCompare(y.name) },
      { key: 'last', label: t('sLast'), cmp: (x, y) => (lastDone(y.id) || 0) - (lastDone(x.id) || 0) },
      { key: 'length', label: t('sLength'), cmp: (x, y) => routineMinutes(x) - routineMinutes(y) },
    ],
    colors: ['workout'],
    row: (r, { dense }) => {
      const last = lastDone(r.id);
      const meta = [t('nExercises', (r.items || []).length), last ? t('lastOn', shortDate(last)) : t('neverDone')].join(' · ');
      const href = wide ? `#/routines?sel=${encodeURIComponent(r.id)}` : `#/routine/${encodeURIComponent(r.id)}`;
      const ws = plansWith(r.id);
      return `<a class="row list-row lib-row${dense ? ' dense' : ''}${r.id === sel ? ' selected' : ''}" href="${href}"${r.id === sel ? ' aria-current="true"' : ''}>
        <span class="min-badge small"><b>${routineMinutes(r)}</b><small>min</small></span>
        <span class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(meta)}</span>
        ${!dense && ws.length ? `<span class="wo-tags">${ws.map((p) => `<span class="wo-tag" style="--c:${colorOf(`w:${p.id}`, planKeys)}">${esc(p.id === a?.planId ? `${t('activeBadge')} · ${p.name}` : p.name)}</span>`).join('')}</span>` : ''}</span>
        ${icon('chevron', 18, 'class="chev"')}</a>`;
    },
    def: { group: 'workout', sort: 'order', color: 'workout', dense: true },
  });
  const head = `${trainHead('routines')}
    <div class="two-actions" data-top-actions><button type="button" class="btn primary" data-action="new-routine">${icon('plus', 18)}${esc(t('newRoutine'))}</button><a class="btn" href="#/import?for=routine">${icon('book', 18)}${esc(t('importShort'))}</a></div>`;
  const listHtml = all.length ? kit.html
    : empty(t('esRoutinesTitle'), exercises().length ? t('esRoutinesText') : t('esRoutinesFirst'),
      exercises().length ? '' : `<div class="button-row"><a class="btn" href="#/gym">${esc(t('setUpGym'))}</a></div>`);
  let pane = '';
  if (wide && all.length) pane = sel ? routineView(sel, { pane: true }).html : `<p class="muted pane-empty">${esc(t('selectRoutine'))}</p>`;
  const html = wide && all.length
    ? `${head}<div class="master-detail"><div class="md-list">${listHtml}</div><section class="md-pane card">${pane}</section></div>`
    : `${head}${listHtml}`;
  return {
    html,
    bind(view) {
      view.querySelectorAll('[data-action=new-routine]').forEach((b) => b.addEventListener('click', newRoutine));
      kit.bind(view);
      bindRoutineActions(view);
    },
  };
}

async function newRoutine() {
  const how = await chooseHowToCreate({ title: t('newRoutine'), emptyLabel: t('startEmpty'), emptyHint: t('startEmptyRoutineHint'), importLabel: t('importFromTextOrFile'), importHint: t('importRoutineHint') });
  if (how === 'import') { location.hash = '#/import?for=routine'; return; }
  if (how !== 'empty') return;
  const r = upsert('routines', { id: uid(), name: t('newRoutineName'), items: [], autoIncrease: false, order: routines().length });
  location.hash = `#/routine/${r.id}/edit?new=1`;
}

// ---- one routine ----

/** What was lifted (or done) last time, shown beside the plan: "ultima 60 kg". */
function lastText(it, ex) {
  const s = sessions().find((x) => x.end && (x.sets || []).some((y) => y.exerciseId === ex.id));
  if (!s) return '';
  const sets = s.sets.filter((y) => y.exerciseId === ex.id);
  if (ex.type === 'cardio') { const m = sets.reduce((a, y) => a + (Number(y.targets?.duration) || 0), 0); return m ? `${fmtNum(m)} min` : ''; }
  if (ex.type === 'weights') { const w = Math.max(0, ...sets.map((y) => Number(y.weight) || 0)); return w ? `${fmtNum(w)} kg` : ''; }
  if (it.seconds) { const sec = Math.max(0, ...sets.map((y) => Number(y.seconds) || 0)); return sec ? `${sec} s` : ''; }
  const reps = Math.max(0, ...sets.map((y) => Number(y.reps) || 0));
  return reps ? `${reps} ${t('repsShort')}` : '';
}

export function routineView(id, { pane = false } = {}) {
  const r = get('routines', id);
  if (!r) return { html: empty(t('notFound'), t('notFoundText'), `<a class="btn" href="#/routines">${esc(t('tab_routines'))}</a>`) };
  // where it's done (v26): the scheda's gym, or another one chosen here; the items use their stand-ins there
  const gs = gyms();
  const gid = whereOf[r.id] && gs.some((g) => g.id === whereOf[r.id]) ? whereOf[r.id] : routineGymId(r);
  const gym = gymById(gid);
  const missing = new Map(missingIn(r, gid).map((m) => [m.index, m]));
  const items = (r.items || []).map((it, ix) => {
    const ex = exerciseIn(it, gid); const orig = get('exercises', it.exerciseId);
    return { it: ex && orig && ex.id !== orig.id ? fitItem(it, orig, ex) : it, ix, ex, orig };
  }).filter((x) => x.ex);
  const sets = items.reduce((a, x) => a + (x.ex.type === 'cardio' ? 1 : Number(x.it.sets) || 1), 0);
  const zones = new Set(items.map((x) => placeOf(x.ex)?.id).filter(Boolean)).size;
  const planned = plannedFor(r.id);
  const last = lastDone(r.id);
  const ws = plansWith(r.id);
  const a = activeInfo();
  let prevPlace = null;
  altCache[r.id] = {};
  const list = items.map(({ it, ex, ix, orig }, i) => {
    const p = placeOf(ex);
    const walk = i > 0 && p && prevPlace && p.id !== prevPlace ? `<div class="walk">${icon('arrowDown', 14)}${esc(p.name)}</div>` : '';
    if (p) prevPlace = p.id;
    const lt = lastText(it, ex);
    const miss = missing.get(ix);
    const standIn = orig && orig.id !== ex.id;
    let alts = '';
    if (miss) {
      const as = alternatives(ex, gid);
      altCache[r.id][ix] = as;
      alts = as.length ? `<div class="alts">${as.map((x, j) => { const n = x.ex ? x.ex.name : x.builtin.name; const need = needOf(x.ex || x.builtin); return `<div class="alt"><span><b>${esc(n)}</b><small>${esc(t('sameMuscles'))} · ${esc(t(`eqk_${need}`))}</small></span><button type="button" class="btn small" data-use="${esc(r.id)}|${ix}|${j}" data-gym="${esc(gid)}">${esc(t('use'))}</button></div>`; }).join('')}</div>`
        : `<p class="muted small alts-none">${esc(t('noAlternative'))}</p>`;
    }
    return `${walk}<div class="row card-row static${miss ? ' missing' : ''}">
      <span class="num-dot">${i + 1}</span>
      ${thumbOf(ex) ? `<button type="button" class="thumb" data-viewer="${esc(ex.id)}" aria-label="${esc(t('viewPicture'))}"><img src="${esc(thumbOf(ex))}" alt="" loading="lazy"></button>` : ''}
      <span class="row-text"><span class="row-title">${esc(ex.name)}${standIn ? ` <span class="standin-tag">${esc(t('insteadOf', orig.name))}</span>` : ''}</span><span class="row-sub">${esc(whereText(ex) || typeLabel(ex))}</span>
      ${miss ? `<span class="warn-line">${icon('alert', 13)}${esc(t('needsAt', t(`eqk_${miss.need}`), gymName(gym)))}</span>` : ''}
      ${standIn ? `<button type="button" class="link-btn small" data-unalt="${esc(r.id)}|${ix}|${esc(gid)}">${esc(t('backToOrig', orig.name))}</button>` : ''}
      ${ex.notes ? `<span class="row-note">${icon('pencil', 12)}<span>${esc(ex.notes)}</span></span>` : ''}</span>
      <span class="row-end"><b>${esc(itemPlan(it, ex))}</b>${ex.type !== 'cardio' ? `<small>${esc(t('restShort', restText(it.rest ?? training().rest)))}</small>` : ''}${lt ? `<small class="last-w">${esc(`${t('lastWeight')} ${lt}`)}</small>` : ''}</span>
    </div>${alts}`;
  }).join('');
  const gq = gs.length > 1 ? `?gym=${encodeURIComponent(gid)}` : '';
  const whereRow = gs.length > 1 ? `<div class="where-row" role="group" aria-label="${esc(t('whereLabel'))}"><span>${esc(t('whereLabel'))}</span>${gs.map((g) => `<button type="button" class="chip-btn${g.id === gid ? ' on' : ''}" aria-pressed="${g.id === gid}" data-where="${esc(r.id)}|${esc(g.id)}">${esc(gymName(g))}</button>`).join('')}</div>
    ${missing.size ? `<div class="warn-box">${icon('alert', 18)}<span>${esc(t('missingN', missing.size, gymName(gym)))}</span></div>` : Array.isArray(gym.equipment) ? `<div class="ok-box">${icon('check', 16)}${esc(t('allThere', gymName(gym)))}</div>` : ''}` : '';
  const rid = encodeURIComponent(r.id);
  const bar = pane
    ? `<header class="bar pane-bar"><span></span><a class="bar-action" href="#/routine/${rid}/edit">${esc(t('edit'))}</a></header>`
    : `<header class="bar">${backLink('#/routines', t('crumb', t('tab_routines')))}<a class="bar-action" href="#/routine/${rid}/edit">${esc(t('edit'))}</a></header>`;
  const html = `${bar}
    <h1 class="title">${esc(r.name)}</h1>
    <div class="stats3">
      <div class="stat"><b>${routineMinutes(r)} min</b><span>${esc(t('estimated'))}</span></div>
      <div class="stat"><b>${sets}</b><span>${esc(t('setsWord'))}</span></div>
      <div class="stat"><b>${zones}</b><span>${esc(t('zonesWord'))}</span></div>
    </div>
    <div class="note-panel">${icon('week', 18)}<div>
      <b>${esc(t('usedIn'))}: ${ws.length ? ws.map((p) => esc(p.id === a?.planId ? `${p.name} (${t('activeBadge').toLowerCase()})` : p.name)).join(', ') : esc(t('inNoWorkout'))}</b>
      <span>${esc(t('inEverydaySaved', routineMinutes(r)))} · ${planned.length ? esc(t('plannedOn', planned.slice(0, 3).map(plannedText).join(' · '))) : esc(t('notPlanned'))}${last ? ` · ${esc(t('lastOn', shortDate(last)))}` : ''}</span>
    </div></div>
    ${whereRow}
    ${items.length ? `<div class="stack tight">${list}</div>` : empty(t('esItemsTitle'), t('esItemsText'), `<a class="btn primary" href="#/routine/${rid}/edit">${esc(t('addExercise'))}</a>`)}
    <button type="button" class="btn wide" data-action="duplicate-to" data-id="${esc(r.id)}">${icon('copy', 18)}${esc(t('duplicateTo'))}</button>
    ${items.length ? `<a class="btn wide" href="#/try/${rid}${gq}">${icon('eye', 18)}${esc(t('tryIt'))}</a>` : ''}
    ${items.length ? `<div class="${pane ? 'pane-cta' : 'sticky-cta'}"><a class="btn yellow big" href="#/start/${rid}${gq}">${icon('play', 18)}${esc(t('start'))}</a></div>` : ''}`;
  return { html, bind: bindRoutineActions };
}

/** Buttons a routine's page has, also when it's shown in the library's side pane. */
function bindRoutineActions(view) {
  view.querySelectorAll('[data-where]').forEach((b) => b.addEventListener('click', () => { const [rid, g] = b.dataset.where.split('|'); whereOf[rid] = g; window.dispatchEvent(new CustomEvent('palestra:render')); }));
  view.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => { const [rid, ix, j] = b.dataset.use.split('|'); useAlternative(rid, Number(ix), altCache[rid]?.[ix]?.[Number(j)], b.dataset.gym); }));
  view.querySelectorAll('[data-unalt]').forEach((b) => b.addEventListener('click', () => {
    const [rid, ix, g] = b.dataset.unalt.split('|');
    const cur = get('routines', rid);
    const items = cur.items.map((it, i) => { if (i !== Number(ix) || !it.alt) return it; const alt = { ...it.alt }; delete alt[g]; return { ...it, alt: Object.keys(alt).length ? alt : undefined }; });
    upsert('routines', { ...cur, items });
  }));
  view.querySelectorAll('[data-viewer]').forEach((b) => b.addEventListener('click', () => { const ex = get('exercises', b.dataset.viewer); if (ex) openViewer(ex); }));
  view.querySelectorAll('[data-action=duplicate-to]').forEach((b) => b.addEventListener('click', () => duplicateTo(b.dataset.id)));
}

// ---- a gym without what an exercise needs (v26) ----

const whereOf = {}; // routineId → the gym chosen on its page (not kept)
const altCache = {}; // routineId → { itemIndex: alternatives shown }

/** "Usa": only at that gym (the scheda stays as it is) or in the scheda for good. A suggestion becomes an exercise. */
async function useAlternative(rid, ix, alt, gid) {
  const r = get('routines', rid);
  if (!r || !alt) return;
  const g = gymById(gid);
  const name = alt.ex ? alt.ex.name : alt.builtin.name;
  const html = `<h2>${esc(t('useQ', name))}</h2>
    <button type="button" class="option-btn" data-how="here"><b>${esc(t('onlyAt', gymName(g)))}</b><small>${esc(t('onlyAtHint', get('exercises', r.items[ix].exerciseId)?.name || ''))}</small></button>
    <button type="button" class="option-btn" data-how="swap"><b>${esc(t('replaceInRoutine'))}</b><small>${esc(t('replaceHint'))}</small></button>
    <button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button>`;
  const how = await openSheet(html, (form, close) => form.querySelectorAll('[data-how]').forEach((b) => b.addEventListener('click', () => close(b.dataset.how))));
  if (how !== 'here' && how !== 'swap') return;
  let ex = alt.ex;
  if (!ex) {
    const b = alt.builtin;
    ex = live('exercises').find((e) => e.name.toLowerCase() === b.name.toLowerCase())
      || upsert('exercises', { id: uid(), name: b.name, type: b.type, ...(b.equipment ? { equipment: b.equipment } : {}), ...(b.muscles[0] === 'cardio' || b.muscles[0] === 'abs' && /plank/i.test(b.name) ? { timed: true } : {}), muscles: b.muscles[0] === 'cardio' ? [] : b.muscles.slice(), defaultRest: training().rest, notes: '', increase: { mode: 'type' } });
  }
  const cur = get('routines', rid);
  const items = cur.items.map((it, i) => {
    if (i !== ix) return it;
    if (how === 'here') return { ...it, alt: { ...(it.alt || {}), [gid]: ex.id } };
    return { ...fitItem(it, get('exercises', it.exerciseId), ex), ...(it.alt ? { alt: it.alt } : {}) };
  });
  upsert('routines', { ...cur, items });
  refreshEstimates();
  toast(how === 'here' ? t('usedHere', ex.name, gymName(g)) : t('replacedWith', ex.name));
}

/** "Duplica in un altro workout": a copy of the scheda, added to a workout it isn't in yet (or to a new one). */
async function duplicateTo(routineId) {
  const r = get('routines', routineId);
  if (!r) return;
  const targets = plans().filter((p) => !(p.days || []).some((d) => d.routineId === routineId));
  const html = `<h2>${esc(t('duplicateToTitle', r.name))}</h2>
    ${targets.length ? `<div class="pick-list">${targets.map((p) => `<button type="button" class="row pick" data-pick="${esc(p.id)}"><span class="row-text"><span class="row-title">${esc(p.name)}</span><span class="row-sub">${esc(t('nRoutines', planDays(p).length))}</span></span></button>`).join('')}</div>` : ''}
    <button type="button" class="option-btn" data-new><b>${esc(t('newWorkoutWith'))}</b></button>
    <button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button>`;
  await openSheet(html, (form, close) => {
    const copy = () => upsert('routines', { ...r, id: uid(), name: t('copyOf', r.name), items: (r.items || []).map((it) => ({ ...it, targets: it.targets ? { ...it.targets } : undefined })), order: live('routines').length });
    form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const c = copy();
      const p = get('plans', b.dataset.pick);
      savePlan({ ...p, days: [...(p.days || []), { routineId: c.id, weekday: null }] });
      close(true);
      refreshEstimates();
      toast(t('duplicateDone', r.name, p.name));
      location.hash = `#/plan/${encodeURIComponent(p.id)}`;
    }));
    form.querySelector('[data-new]').addEventListener('click', () => {
      const c = copy();
      const p = upsert('plans', { id: uid(), name: t('newPlanName'), days: [{ routineId: c.id, weekday: null }] });
      close(true);
      refreshEstimates();
      location.hash = `#/plan/${encodeURIComponent(p.id)}`;
    });
  });
}

// ---- editor ----

export function routineEditView(id) {
  const r = get('routines', id);
  if (!r) return { html: empty(t('notFound'), t('notFoundText')) };
  const rows = (r.items || []).map((it, i) => {
    const ex = get('exercises', it.exerciseId);
    if (!ex) return '';
    const inc = !r.autoIncrease ? '' : (ex.increase?.mode === 'off' ? `<span class="chip muted">${esc(t('excluded'))}</span>`
      : (ex.type === 'bodyweight' && it.seconds) ? `<span class="chip muted">${esc(t('timed'))}</span>` : '');
    return `<div class="row card-row edit-row" data-sort-key="${i}">
      <button type="button" class="drag-handle" aria-label="${esc(t('moveItem', ex.name))}">${icon('grip', 20)}</button>
      <button type="button" class="row-text plain" data-edit-item="${i}">
        <span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc(itemPlan(it, ex))}${ex.type !== 'cardio' ? ` · ${esc(t('restShort', restText(it.rest ?? training().rest)))}` : ''}</span>
      </button>${inc}
    </div>`;
  }).join('');
  const html = `<header class="bar">${backLink(`#/routine/${encodeURIComponent(r.id)}`, r.name)}<a class="bar-action strong" href="#/routine/${encodeURIComponent(r.id)}">${esc(t('done'))}</a></header>
    <h1 class="title small">${esc(t('editRoutine'))}</h1>
    <form class="stack form" data-form="routine">
      <label class="field"><span>${esc(t('name'))}</span><input id="r-name" name="name" value="${esc(r.name)}" autocomplete="off"></label>
      ${gyms().length > 1 ? `<label class="field"><span>${esc(t('routineGym'))}</span><select name="gymId">${gyms().map((g) => `<option value="${esc(g.id)}" ${g.id === routineGymId(r) ? 'selected' : ''}>${esc(gymName(g))}</option>`).join('')}</select></label>` : ''}
      <div class="card">${toggle({ name: 'autoIncrease', checked: r.autoIncrease, label: t('autoIncrease'), hint: t('autoIncreaseHint') })}
        ${r.autoIncrease ? `<p class="card-foot">${esc(t('autoIncreaseHow'))} <a href="#/settings/increase">${esc(t('changeSteps'))}</a></p>` : ''}</div>
      <div class="field"><span>${esc(t('orderTitle'))} <small class="muted">${esc(t('dragToMove'))}</small></span></div>
    </form>
    <div class="stack tight" data-sortable="items">${rows}</div>
    ${(r.items || []).length > 2 ? `<button type="button" class="btn wide" data-action="by-route">${icon('pin', 18)}${esc(t('sortByRoute'))}</button>` : ''}
    <div class="two-actions"><button type="button" class="btn dashed" data-action="add-item">${icon('plus', 18)}${esc(t('addExercise'))}</button><a class="btn" href="#/import?for=routine&into=${encodeURIComponent(r.id)}">${icon('book', 18)}${esc(t('importShort'))}</a></div>
    <button type="button" class="btn danger-text wide" data-action="delete">${esc(t('deleteRoutine'))}</button>`;
  const wide = isWide();
  const page = wide ? `<div class="editor-cols"><div class="col-main">${html}</div><aside class="col-side card ex-lib">${libraryPanel(r)}</aside></div>` : html;
  return {
    html: page,
    bind(view) {
      bindLibrary(view, id);
      const form = view.querySelector('[data-form=routine]');
      form.name.addEventListener('change', () => { const cur = get('routines', id); upsert('routines', { ...cur, name: form.name.value.trim() || cur.name }); });
      form.gymId?.addEventListener('change', () => { const cur = get('routines', id); upsert('routines', { ...cur, gymId: form.gymId.value === mainGym().id ? undefined : form.gymId.value }); delete whereOf[id]; });
      form.autoIncrease.addEventListener('change', () => { const cur = get('routines', id); upsert('routines', { ...cur, autoIncrease: form.autoIncrease.checked }); });
      view.querySelector('[data-sortable=items]').addEventListener('sorted', (e) => {
        const cur = get('routines', id);
        const items = e.detail.keys.map((k) => cur.items[Number(k)]);
        upsert('routines', { ...cur, items });
        refreshEstimates();
      });
      view.querySelectorAll('[data-edit-item]').forEach((b) => b.addEventListener('click', () => editItem(id, Number(b.dataset.editItem))));
      view.querySelector('[data-action=add-item]').addEventListener('click', () => addItem(id));
      view.querySelector('[data-action=by-route]')?.addEventListener('click', () => {
        const cur = get('routines', id);
        const order = new Map(places().map((p, i) => [p.id, i]));
        const rank = (it) => { const ex = get('exercises', it.exerciseId); const p = ex && placeOf(ex); return p ? order.get(p.id) : 1e6; };
        // cardio warm-ups stay first; the rest follow the walking route, keeping their order within a zone
        const items = (cur.items || []).map((it, i) => ({ it, i })).sort((a, b) => {
          const ca = get('exercises', a.it.exerciseId)?.type === 'cardio' && a.i === 0 ? -1 : 0;
          const cb = get('exercises', b.it.exerciseId)?.type === 'cardio' && b.i === 0 ? -1 : 0;
          return ca - cb || rank(a.it) - rank(b.it) || a.i - b.i;
        }).map((x) => x.it);
        upsert('routines', { ...cur, items });
        toast(t('sortedByRoute'));
      });
      view.querySelector('[data-action=delete]').addEventListener('click', async () => {
        const cur = get('routines', id);
        if (!(await askConfirm({ text: t('deleteRoutineQ', cur.name), ok: t('delete'), danger: true }))) return;
        const before = remove('routines', id);
        location.hash = '#/routines';
        toast(t('deleted', cur.name), { undo: () => restore('routines', before) });
      });
    },
  };
}

// ---- desktop: the exercise library beside the editor ----

let libQuery = '';

function libraryPanel(r) {
  const inR = new Set((r.items || []).map((it) => it.exerciseId));
  const rows = exercises().map((ex) => `<div class="row lib-ex${inR.has(ex.id) ? ' is-in' : ''}" data-name="${esc(ex.name.toLowerCase())}">
      <span class="swatch sw-${esc(ex.type)}" aria-hidden="true"></span><span class="row-text"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc([typeLabel(ex), whereText(ex)].filter(Boolean).join(' · '))}</span></span>
      <button type="button" class="icon-btn" data-lib-add="${esc(ex.id)}" aria-label="${esc(t('addToRoutine', ex.name))}">${icon(inR.has(ex.id) ? 'check' : 'plus', 18)}</button>
    </div>`).join('');
  return `<h2 class="section-title">${esc(t('exerciseLibrary'))}</h2>
    <label class="search"><span class="sr">${esc(t('searchShort'))}</span>${icon('search', 18)}<input id="lib-ex-q" type="search" value="${esc(libQuery)}" placeholder="${esc(t('searchShort'))}" autocomplete="off"></label>
    <div class="lib-ex-list">${rows || `<p class="muted">${esc(t('noExercisesYet'))}</p>`}</div>
    <a class="btn wide" href="#/exercise/new?then=${encodeURIComponent(r.id)}">${icon('plus', 18)}${esc(t('newExercise'))}</a>`;
}

function bindLibrary(view, routineId) {
  const q = view.querySelector('#lib-ex-q');
  if (!q) return;
  const apply = () => {
    libQuery = q.value;
    const v = q.value.trim().toLowerCase();
    view.querySelectorAll('.lib-ex').forEach((row) => { row.hidden = Boolean(v) && !row.dataset.name.includes(v); });
  };
  q.addEventListener('input', apply);
  apply();
  view.querySelectorAll('[data-lib-add]').forEach((b) => b.addEventListener('click', () => {
    addExerciseToRoutine(routineId, b.dataset.libAdd);
    toast(t('added', get('exercises', b.dataset.libAdd)?.name || ''));
  }));
}

/** Default plan for an exercise added to a routine: what was used last time it was in any routine. */
function defaultItem(ex) {
  for (const r of routines()) {
    const it = (r.items || []).find((x) => x.exerciseId === ex.id);
    if (it) return { ...it, targets: it.targets ? { ...it.targets } : undefined };
  }
  if (ex.type === 'cardio') return { exerciseId: ex.id, targets: { ...defaultTargets(ex.cardio?.kind || 'treadmill', machineOf(ex)), ...(ex.cardio?.targets || {}) } };
  if (ex.type === 'bodyweight') return { exerciseId: ex.id, sets: 3, ...(ex.timed ? { seconds: 45 } : { reps: 12 }), rest: ex.defaultRest ?? 60 };
  return { exerciseId: ex.id, sets: 3, reps: 10, weight: 20, rest: ex.defaultRest ?? training().rest };
}

async function addItem(routineId) {
  const list = exercises();
  const html = `<h2>${esc(t('addExercise'))}</h2>
    ${list.length ? `<div class="pick-list">${list.map((ex) => `<button type="button" class="row pick" data-pick="${esc(ex.id)}">
      ${exTag(ex, machineOf(ex)?.number || (ex.type === 'cardio' ? '' : ''))}<span class="row-text"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc([typeLabel(ex), whereText(ex)].filter(Boolean).join(' · '))}</span></span>
    </button>`).join('')}</div>` : `<p>${esc(t('noExercisesYet'))}</p>`}
    <div class="button-row"><a class="btn" href="#/exercise/new?then=${encodeURIComponent(routineId)}" data-close>${esc(t('newExercise'))}</a><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  await openSheet(html, (form, close) => {
    form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const ex = get('exercises', b.dataset.pick);
      const r = get('routines', routineId);
      upsert('routines', { ...r, items: [...(r.items || []), defaultItem(ex)] });
      refreshEstimates();
      close(true);
    }));
  });
}

export function addExerciseToRoutine(routineId, exId) {
  const r = get('routines', routineId);
  const ex = get('exercises', exId);
  if (!r || !ex) return;
  upsert('routines', { ...r, items: [...(r.items || []), defaultItem(ex)] });
  refreshEstimates();
}

/** The draft of an item being edited, so switching "Serie uguali / diverse" can redraw the sheet. */
function itemDraft(it) {
  const rows = Array.from({ length: setsOf(it) }, (_, i) => { const p = setPlan(it, i + 1); return { reps: p.reps ?? 10, weight: p.weight ?? 0 }; });
  return {
    shape: variedSets(it) ? 'diff' : 'same', rows, sets: setsOf(it), mode: it.seconds != null ? 'time' : 'reps',
    reps: it.reps ?? 10, seconds: it.seconds ?? 45, range: Number(it.repsMax) > 0, repsMax: Number(it.repsMax) || (Number(it.reps) || 10) + 4,
    weight: it.weight ?? 0, rest: it.rest ?? training().rest, failure: it.failure || 'none',
  };
}

async function editItem(routineId, index, draft = null) {
  const r = get('routines', routineId);
  const it = r.items[index];
  const ex = get('exercises', it.exerciseId);
  const d = draft || itemDraft(it);
  const W = ex.type === 'weights';
  const kgStep = ex.equipment === 'dumbbell' ? 1 : 2.5;
  const sug = W ? suggestWeight(ex, bodyPrefs()) : null;
  let body;
  if (ex.type === 'cardio') {
    body = measuresFor(ex, machineOf(ex)).map((m) => stepper({ name: `t_${m.key}`, value: it.targets?.[m.key] ?? 0, step: m.step, min: m.min ?? 0, unit: m.unit, label: measureLabel(m) })).join('');
  } else {
    const timed = d.mode === 'time';
    const shape = timed ? 'same' : d.shape;
    body = `${!timed ? segmented({ name: 'shape', value: shape, options: [['same', t('setsSame')], ['diff', t('setsDiff')]], label: t('setsShape') }) : ''}
      ${ex.type === 'bodyweight' && shape === 'same' ? segmented({ name: 'mode', value: timed ? 'time' : 'reps', options: [['reps', t('reps')], ['time', t('seconds')]], label: t('measureBy') }) : ''}
      ${shape === 'same' ? `${stepper({ name: 'sets', value: d.sets, step: 1, min: 1, label: t('sets') })}
        ${timed ? stepper({ name: 'seconds', value: d.seconds, step: 5, min: 5, unit: 's', label: t('seconds') })
    : `${stepper({ name: 'reps', value: d.reps, step: 1, min: 1, label: d.range ? t('repsFrom') : t('reps') })}
          ${toggle({ name: 'range', checked: d.range, label: t('repRange'), hint: t('repRangeHint') })}
          <div data-range ${d.range ? '' : 'hidden'}>${stepper({ name: 'repsMax', value: d.repsMax, step: 1, min: 1, label: t('repsTo') })}</div>`}
        ${W ? stepper({ name: 'weight', value: d.weight, step: kgStep, min: 0, unit: 'kg', label: t('weight') }) : ''}`
    : `<div class="set-rows">${d.rows.map((row, i) => `<div class="set-row-edit"><b>${esc(t('setN', i + 1))}</b>
          ${stepper({ name: `r${i}`, value: row.reps, step: 1, min: 1, label: t('reps') })}
          ${W ? stepper({ name: `w${i}`, value: row.weight, step: kgStep, min: 0, unit: 'kg', label: t('weight') }) : ''}
          ${d.rows.length > 1 ? `<button type="button" class="btn small ghost" data-del-row="${i}">${esc(t('removeSet'))}</button>` : ''}</div>`).join('')}</div>
        <button type="button" class="btn dashed wide" data-add-row>+ ${esc(t('addSetRow'))}</button>
        <p class="muted small">${esc(t('setsDiffHint'))}</p>`}
      ${W && sug ? `<p class="muted small sug-line">${esc(t('sugFor', fmtNum(sug)))}</p>` : ''}
      ${!timed ? `<label class="field"><span>${esc(t('failure'))}</span><select name="failure">${['none', 'all', 'last'].map((v) => `<option value="${v}" ${d.failure === v ? 'selected' : ''}>${esc(t(`failure_${v}`))}</option>`).join('')}</select></label>` : ''}
      ${stepper({ name: 'rest', value: d.rest, step: 15, min: 0, unit: 's', label: t('rest') })}`;
  }
  const html = `<h2>${esc(ex.name)}</h2><p class="muted">${esc([typeLabel(ex), whereText(ex)].filter(Boolean).join(' · '))}</p>
    <div class="stack">${body}</div>
    <div class="button-row"><button class="btn primary" value="save">${esc(t('save'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>
    <button type="button" class="btn danger-text wide" data-remove>${esc(t('removeFromRoutine'))}</button>`;
  let again = null;
  await openSheet(html, (form, close) => {
    bindSteppers(form);
    // read what's on screen into the draft
    const read = () => {
      if (ex.type === 'cardio') return;
      d.mode = form.querySelector('[name=mode]:checked')?.value || d.mode;
      if (form.querySelector('[name=sets]')) d.sets = stepVal(form, 'sets') ?? d.sets;
      if (form.querySelector('[name=reps]')) d.reps = stepVal(form, 'reps') ?? d.reps;
      if (form.querySelector('[name=seconds]')) d.seconds = stepVal(form, 'seconds') ?? d.seconds;
      if (form.querySelector('[name=repsMax]')) d.repsMax = stepVal(form, 'repsMax') ?? d.repsMax;
      if (form.querySelector('[name=range]')) d.range = form.querySelector('[name=range]').checked;
      if (form.querySelector('[name=weight]')) d.weight = stepVal(form, 'weight') ?? d.weight;
      if (form.querySelector('[name=failure]')) d.failure = form.failure.value;
      d.rest = stepVal(form, 'rest') ?? d.rest;
      d.rows = d.rows.map((row, i) => ({ reps: form.querySelector(`[name=r${i}]`) ? stepVal(form, `r${i}`) ?? row.reps : row.reps, weight: form.querySelector(`[name=w${i}]`) ? stepVal(form, `w${i}`) ?? row.weight : row.weight }));
    };
    const redraw = () => { read(); again = d; close(null); };
    form.querySelectorAll('[name=shape]').forEach((x) => x.addEventListener('change', () => {
      read();
      d.shape = x.value;
      // the rows start from the equal sets, and back
      if (d.shape === 'diff' && !variedSets(it) && (!draft || d.rows.length !== d.sets)) d.rows = Array.from({ length: d.sets }, () => ({ reps: d.reps, weight: d.weight }));
      if (d.shape === 'same') { d.sets = d.rows.length; d.reps = d.rows[0].reps; d.weight = d.rows[0].weight; }
      again = d; close(null);
    }));
    form.querySelectorAll('[name=mode]').forEach((x) => x.addEventListener('change', redraw));
    form.querySelector('[name=range]')?.addEventListener('change', () => { form.querySelector('[data-range]').hidden = !form.querySelector('[name=range]').checked; });
    form.querySelector('[data-add-row]')?.addEventListener('click', () => { read(); const l = d.rows[d.rows.length - 1]; d.rows.push({ ...l }); again = d; close(null); });
    form.querySelectorAll('[data-del-row]').forEach((b) => b.addEventListener('click', () => { read(); d.rows.splice(Number(b.dataset.delRow), 1); again = d; close(null); }));
    form.querySelector('[value=save]').addEventListener('click', () => {
      read();
      const cur = get('routines', routineId);
      const items = [...cur.items];
      let next = { ...items[index] };
      if (ex.type === 'cardio') {
        next.targets = {};
        for (const m of measuresFor(ex, machineOf(ex))) next.targets[m.key] = stepVal(form, `t_${m.key}`) ?? 0;
      } else {
        delete next.repsMax; delete next.failure;
        if (d.mode === 'time') {
          next = itemFromRows(next, Array.from({ length: d.sets }, () => ({ seconds: d.seconds, ...(W ? { weight: d.weight } : {}) })));
        } else if (d.shape === 'diff') {
          next = itemFromRows(next, d.rows.map((row) => ({ reps: row.reps, ...(W ? { weight: row.weight } : {}) })));
        } else {
          next = itemFromRows(next, Array.from({ length: d.sets }, () => ({ reps: d.reps, ...(W ? { weight: d.weight } : {}) })));
          if (d.range && d.repsMax > d.reps) next.repsMax = d.repsMax;
        }
        if (d.mode !== 'time' && d.failure !== 'none') next.failure = d.failure;
        next.rest = d.rest ?? 0;
      }
      items[index] = next;
      upsert('routines', { ...cur, items });
      refreshEstimates();
      close(true);
    });
    form.querySelector('[data-remove]').addEventListener('click', () => {
      const cur = get('routines', routineId);
      const items = cur.items.filter((_, i) => i !== index);
      upsert('routines', { ...cur, items });
      refreshEstimates();
      close(true);
    });
  });
  if (again) return editItem(routineId, index, again);
  return null;
}

export { minText };
