// Allenamenti: the list of routines, one routine, and its editor (order, sets, automatic increase).
import { state, get, upsert, remove, restore, uid, pref, live } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum, restText, minText, shortDate, timeOfDay, weekdayShort } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, stepper, bindSteppers, stepVal, toggle, empty, exTag, segmented, gearLink } from '../ui/parts.js';
import { openSheet, askConfirm, toast, chooseHowToCreate } from '../ui/dialogs.js';
import { isWide } from '../shell.js';
import {
  routines, exercises, routineMinutes, refreshEstimates, lastDone, whereText, placeOf, machineOf, training, measureLabel, typeLabel, places, sessions,
} from '../data.js';
import { plannedAhead, measuresFor, defaultTargets } from '../model.js';
import { thumbOf, openViewer } from './pictures.js';
import { activeInfo, planDays, plans, plansWith, savePlan } from '../plans.js';

const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));

function itemPlan(it, ex) {
  if (!ex) return '';
  if (ex.type === 'cardio') {
    const ms = measuresFor(ex, machineOf(ex)).slice(0, 2);
    return ms.map((m) => `${fmtNum(it.targets?.[m.key])}${m.unit ? ` ${m.unit}` : ''}`).join(' · ');
  }
  const amount = it.seconds ? `${it.seconds} s` : `${it.reps ?? '–'}`;
  return `${it.sets ?? 1} × ${amount}${ex.type === 'weights' && it.weight ? ` · ${fmtNum(it.weight)} kg` : ''}`;
}

export function plannedFor(routineId) {
  return plannedAhead(pref('planned', [])).filter((p) => p.routineId === routineId);
}

function plannedText(p) {
  return `${shortDate(p.at)}, ${timeOfDay(p.at)}`;
}

// ---- the library ----

let filter = 'all'; // all | active | none

function workoutsText(r, activeId) {
  const ws = plansWith(r.id);
  if (!ws.length) return `<span class="chip muted">${esc(t('inNoWorkout'))}</span>`;
  return ws.map((p) => `<span class="chip${p.id === activeId ? ' yellow' : ''}">${esc(p.id === activeId ? `${t('inActiveWorkout')} · ${p.name}` : p.name)}</span>`).join('');
}

export function routinesView(query = {}) {
  const all = routines();
  const a = activeInfo();
  const activeIds = new Set(a ? planDays(a.plan).map((d) => d.routineId) : []);
  const list = all.filter((r) => filter === 'all' || (filter === 'active' ? activeIds.has(r.id) : !plansWith(r.id).length));
  const wide = isWide();
  const sel = wide ? (get('routines', query.sel) ? query.sel : list[0]?.id) : null;
  const rows = list.map((r) => {
    const last = lastDone(r.id);
    const meta = [t('nExercises', (r.items || []).length), last ? t('lastOn', shortDate(last)) : t('neverDone')].join(' · ');
    const href = wide ? `#/routines?sel=${encodeURIComponent(r.id)}` : `#/routine/${encodeURIComponent(r.id)}`;
    return `<a class="row card-row lib-row${r.id === sel ? ' selected' : ''}" href="${href}" data-name="${esc(r.name.toLowerCase())}"${r.id === sel ? ' aria-current="true"' : ''}>
      <span class="min-badge"><b>${routineMinutes(r)}</b><small>min</small></span>
      <span class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(meta)}</span><span class="chips small">${workoutsText(r, a?.planId)}</span></span>
      ${icon('chevron', 20, 'class="chev"')}
    </a>`;
  }).join('');
  const filters = [['all', t('filterAll')], ['active', t('filterActive')], ['none', t('filterNone')]];
  const head = `<header class="page-head">
      <div><h1>${esc(t('tab_routines'))}</h1><p class="sub">${esc(t('nRoutines', all.length))}</p></div>
      <div class="head-actions">${gearLink()}</div>
    </header>
    <div class="two-actions" data-top-actions><button type="button" class="btn primary" data-action="new-routine">${icon('plus', 18)}${esc(t('newRoutine'))}</button><a class="btn" href="#/import?for=routine">${icon('book', 18)}${esc(t('importShort'))}</a></div>`;
  const listHtml = all.length ? `<div class="lib-tools">
      <label class="search"><span class="sr">${esc(t('searchRoutine'))}</span>${icon('search', 18)}<input id="lib-q" type="search" placeholder="${esc(t('searchRoutine'))}" autocomplete="off"></label>
      <div class="filter-row">${filters.map(([k, l]) => `<button type="button" class="chip-btn${filter === k ? ' on' : ''}" data-filter="${k}" aria-pressed="${filter === k}">${esc(l)}</button>`).join('')}</div>
    </div>
    <div class="stack tight" data-lib>${rows || `<p class="muted">${esc(t('noMatches'))}</p>`}</div>`
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
      view.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; rerender(); }));
      const q = view.querySelector('#lib-q');
      const applySearch = () => {
        const v = (q?.value || '').trim().toLowerCase();
        view.querySelectorAll('[data-lib] .lib-row').forEach((row) => { row.hidden = Boolean(v) && !row.dataset.name.includes(v); });
      };
      q?.addEventListener('input', applySearch);
      applySearch();
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
  const items = (r.items || []).map((it) => ({ it, ex: get('exercises', it.exerciseId) })).filter((x) => x.ex);
  const sets = items.reduce((a, x) => a + (x.ex.type === 'cardio' ? 1 : Number(x.it.sets) || 1), 0);
  const zones = new Set(items.map((x) => placeOf(x.ex)?.id).filter(Boolean)).size;
  const planned = plannedFor(r.id);
  const last = lastDone(r.id);
  const ws = plansWith(r.id);
  const a = activeInfo();
  let prevPlace = null;
  const list = items.map(({ it, ex }, i) => {
    const p = placeOf(ex);
    const walk = i > 0 && p && prevPlace && p.id !== prevPlace ? `<div class="walk">${icon('arrowDown', 14)}${esc(p.name)}</div>` : '';
    if (p) prevPlace = p.id;
    const lt = lastText(it, ex);
    return `${walk}<div class="row card-row static">
      <span class="num-dot">${i + 1}</span>
      ${thumbOf(ex) ? `<button type="button" class="thumb" data-viewer="${esc(ex.id)}" aria-label="${esc(t('viewPicture'))}"><img src="${esc(thumbOf(ex))}" alt="" loading="lazy"></button>` : ''}
      <span class="row-text"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc(whereText(ex) || typeLabel(ex))}</span>
      ${ex.notes ? `<span class="row-note">${icon('pencil', 12)}<span>${esc(ex.notes)}</span></span>` : ''}</span>
      <span class="row-end"><b>${esc(itemPlan(it, ex))}</b>${ex.type !== 'cardio' ? `<small>${esc(t('restShort', restText(it.rest ?? training().rest)))}</small>` : ''}${lt ? `<small class="last-w">${esc(`${t('lastWeight')} ${lt}`)}</small>` : ''}</span>
    </div>`;
  }).join('');
  const rid = encodeURIComponent(r.id);
  const bar = pane
    ? `<header class="bar pane-bar"><span></span><a class="bar-action" href="#/routine/${rid}/edit">${esc(t('edit'))}</a></header>`
    : `<header class="bar">${backLink('#/routines', t('tab_routines'))}<a class="bar-action" href="#/routine/${rid}/edit">${esc(t('edit'))}</a></header>`;
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
    ${items.length ? `<div class="stack tight">${list}</div>` : empty(t('esItemsTitle'), t('esItemsText'), `<a class="btn primary" href="#/routine/${rid}/edit">${esc(t('addExercise'))}</a>`)}
    <button type="button" class="btn wide" data-action="duplicate-to" data-id="${esc(r.id)}">${icon('copy', 18)}${esc(t('duplicateTo'))}</button>
    ${items.length ? `<div class="${pane ? 'pane-cta' : 'sticky-cta'}"><a class="btn yellow big" href="#/start/${rid}">${icon('play', 18)}${esc(t('start'))}</a></div>` : ''}`;
  return { html, bind: bindRoutineActions };
}

/** Buttons a routine's page has, also when it's shown in the library's side pane. */
function bindRoutineActions(view) {
  view.querySelectorAll('[data-viewer]').forEach((b) => b.addEventListener('click', () => { const ex = get('exercises', b.dataset.viewer); if (ex) openViewer(ex); }));
  view.querySelectorAll('[data-action=duplicate-to]').forEach((b) => b.addEventListener('click', () => duplicateTo(b.dataset.id)));
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

async function editItem(routineId, index) {
  const r = get('routines', routineId);
  const it = r.items[index];
  const ex = get('exercises', it.exerciseId);
  let body;
  if (ex.type === 'cardio') {
    body = measuresFor(ex, machineOf(ex)).map((m) => stepper({ name: `t_${m.key}`, value: it.targets?.[m.key] ?? 0, step: m.step, min: m.min ?? 0, unit: m.unit, label: measureLabel(m) })).join('');
  } else {
    const timed = it.seconds != null;
    body = `${stepper({ name: 'sets', value: it.sets ?? 3, step: 1, min: 1, label: t('sets') })}
      ${ex.type === 'bodyweight' ? segmented({ name: 'mode', value: timed ? 'time' : 'reps', options: [['reps', t('reps')], ['time', t('seconds')]], label: t('measureBy') }) : ''}
      <div data-mode="reps" ${timed ? 'hidden' : ''}>${stepper({ name: 'reps', value: it.reps ?? 10, step: 1, min: 1, label: t('reps') })}</div>
      <div data-mode="time" ${timed ? '' : 'hidden'}>${stepper({ name: 'seconds', value: it.seconds ?? 45, step: 5, min: 5, unit: 's', label: t('seconds') })}</div>
      ${ex.type === 'weights' ? stepper({ name: 'weight', value: it.weight ?? 0, step: ex.equipment === 'dumbbell' ? 1 : 2.5, min: 0, unit: 'kg', label: t('weight') }) : ''}
      ${stepper({ name: 'rest', value: it.rest ?? training().rest, step: 15, min: 0, unit: 's', label: t('rest') })}`;
  }
  const html = `<h2>${esc(ex.name)}</h2><p class="muted">${esc([typeLabel(ex), whereText(ex)].filter(Boolean).join(' · '))}</p>
    <div class="stack">${body}</div>
    <div class="button-row"><button class="btn primary" value="save">${esc(t('save'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>
    <button type="button" class="btn danger-text wide" data-remove>${esc(t('removeFromRoutine'))}</button>`;
  await openSheet(html, (form, close) => {
    bindSteppers(form);
    form.querySelectorAll('[name=mode]').forEach((x) => x.addEventListener('change', () => {
      const mode = form.querySelector('[name=mode]:checked').value;
      form.querySelector('[data-mode=reps]').hidden = mode !== 'reps';
      form.querySelector('[data-mode=time]').hidden = mode !== 'time';
    }));
    form.querySelector('[value=save]').addEventListener('click', () => {
      const cur = get('routines', routineId);
      const items = [...cur.items];
      const next = { ...items[index] };
      if (ex.type === 'cardio') {
        next.targets = {};
        for (const m of measuresFor(ex, machineOf(ex))) next.targets[m.key] = stepVal(form, `t_${m.key}`) ?? 0;
      } else {
        next.sets = stepVal(form, 'sets') ?? 1;
        const mode = form.querySelector('[name=mode]:checked')?.value || 'reps';
        if (mode === 'time') { next.seconds = stepVal(form, 'seconds'); delete next.reps; } else { next.reps = stepVal(form, 'reps'); delete next.seconds; }
        if (ex.type === 'weights') next.weight = stepVal(form, 'weight') ?? 0;
        next.rest = stepVal(form, 'rest') ?? 0;
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
}

export { minText };
