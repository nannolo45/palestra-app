// Allenamenti: the list of routines, one routine, and its editor (order, sets, automatic increase).
import { state, get, upsert, remove, restore, uid, pref } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum, restText, minText, shortDate, timeOfDay, weekdayShort } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, stepper, bindSteppers, stepVal, toggle, empty, exTag, segmented } from '../ui/parts.js';
import { openSheet, askConfirm, toast } from '../ui/dialogs.js';
import { syncStatus } from '../shell.js';
import { isSyncing, syncNow } from '../sync.js';
import {
  routines, exercises, routineMinutes, refreshEstimates, lastDone, whereText, placeOf, machineOf, training, measureLabel, typeLabel, places,
} from '../data.js';
import { plannedAhead, measuresFor, defaultTargets } from '../model.js';
import { activeInfo, weekStatus, weekNumber, planMinutes, outsidePlan, plans } from '../plans.js';

function syncLine() {
  const st = syncStatus(isSyncing());
  const when = state.meta.lastSync ? ` · ${agoText(state.meta.lastSync)}` : '';
  return `<button type="button" class="sync-line st-${st}" data-action="sync"><span class="dot" aria-hidden="true"></span>${esc(t(`st_${st}`))}${st === 'synced' ? esc(when) : ''}</button>`;
}

function agoText(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return t('agoNow');
  if (min < 60) return t('agoMin', min);
  if (min < 24 * 60) return t('agoH', Math.round(min / 60));
  return shortDate(ts);
}

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

// ---- list ----

function dayBadge(x, i, status, planned) {
  const wdNames = t('weekdayShort');
  if (x.done) return `<span class="badge done">${esc(t('doneOn', weekdayShort(x.done.start)))}</span>`;
  const wd = Number.isInteger(x.day.weekday) ? wdNames[x.day.weekday] : '';
  const p = planned.find((q) => q.routineId === x.routine.id);
  const when = p ? weekdayShort(p.at) : wd;
  if (i === status.next) return `<span class="badge next">${esc(when ? t('nextOn', when) : t('nextOne'))}</span>`;
  return when ? `<span class="badge muted">${esc(when)}</span>` : '';
}

function activePlanHome(a) {
  const plan = a.plan;
  const status = weekStatus(plan);
  const planned = plannedAhead(pref('planned', []));
  const letters = t('weekdayLetters');
  const onDays = new Set(plan.days.map((d) => d.weekday).filter(Number.isInteger));
  const rows = status.days.map((x, i) => `<a class="row card-row day-home${x.done ? ' is-done' : ''}" href="#/routine/${encodeURIComponent(x.routine.id)}">
      <span class="day-letter">${esc(String.fromCharCode(65 + i))}</span>
      <span class="row-text"><span class="row-title">${esc(x.routine.name)}</span><span class="row-sub">${esc(`${t('nExercises', (x.routine.items || []).length)} · ${x.minutes} min`)}</span></span>
      ${dayBadge(x, i, status, planned)}
    </a>`).join('');
  const next = status.days[status.next];
  const block = next && planned.find((q) => q.routineId === next.routine.id);
  const outside = outsidePlan(plan);
  return `<a class="plan-hero" href="#/plans">
      <span class="plan-top"><span class="badge-active yellow">${esc(t('activeBadgeLong'))}</span><span class="change">${esc(t('change'))}${icon('down', 16)}</span></span>
      <span class="plan-hero-name">${esc(plan.name)}</span>
      <span class="plan-hero-meta"><span>${esc(t('weekStatus', weekNumber(a.from), status.doneCount, status.days.length, minText(planMinutes(plan))))}</span>
        <span class="wd-chips" aria-hidden="true">${letters.map((l, w) => `<i class="${onDays.has(w) ? 'on' : ''}">${esc(l)}</i>`).join('')}</span></span>
    </a>
    <h2 class="section-title">${esc(t('thisWeek'))}</h2>
    <div class="stack tight">${rows}</div>
    ${next ? `<a class="btn yellow big wide" href="#/start/${encodeURIComponent(next.routine.id)}${block ? `?block=${encodeURIComponent(block.blockId || '')}` : ''}">${icon('play', 18)}${esc(t('startX', next.routine.name))}</a>`
    : `<p class="week-done">${icon('check', 18)}${esc(t('weekDone'))}</p>`}
    ${outside.length ? `<h2 class="section-title">${esc(t('outsidePlan'))}</h2><div class="card list">${outside.map((r) => `<a class="row list-row" href="#/routine/${encodeURIComponent(r.id)}"><span class="row-text"><span class="row-title">${esc(r.name)}</span></span><span class="muted small">${routineMinutes(r)} min</span>${icon('chevron', 18, 'class="chev"')}</a>`).join('')}</div>` : ''}
    <button type="button" class="btn dashed wide" data-action="new-routine">${icon('plus', 18)}${esc(t('newRoutine'))}</button>`;
}

export function routinesView() {
  const a = activeInfo();
  if (a) {
    return {
      html: `<header class="page-head">
        <div><h1>${esc(t('tab_routines'))}</h1>${syncLine()}</div>
        <div class="head-actions">
          <a class="round-btn" href="#/settings" aria-label="${esc(t('settings'))}">${icon('gear')}</a>
          <a class="pill-btn" href="#/plans">${esc(t('plansTitle'))}</a>
        </div></header>${activePlanHome(a)}`,
      bind(view) {
        view.querySelectorAll('[data-action=new-routine]').forEach((b) => b.addEventListener('click', newRoutine));
        view.querySelector('[data-action=sync]')?.addEventListener('click', () => syncNow());
      },
    };
  }
  const list = routines();
  const next = plannedAhead(pref('planned', [])).find((p) => get('routines', p.routineId));
  let hero = '';
  if (next) {
    const r = get('routines', next.routineId);
    const first = (r.items || []).map((it) => get('exercises', it.exerciseId)).find(Boolean);
    const firstPlace = first && placeOf(first);
    hero = `<section class="hero" aria-label="${esc(t('nextFromEveryday'))}">
      <div class="hero-top"><span class="eyebrow">${esc(t('nextFromEveryday'))}</span><span>${esc(plannedText(next))}</span></div>
      <div class="hero-title">${esc(r.name)}</div>
      <div class="hero-meta">${esc(t('nExercises', (r.items || []).length))} · ${esc(t('aboutMin', routineMinutes(r)))}${firstPlace ? ` · ${esc(t('startsAt', firstPlace.name))}` : ''}</div>
      <a class="btn yellow big" href="#/start/${encodeURIComponent(r.id)}?block=${encodeURIComponent(next.blockId || '')}">${icon('play', 18)}${esc(t('start'))}</a>
    </section>`;
  }
  const rows = list.map((r) => {
    const last = lastDone(r.id);
    const meta = [t('nExercises', (r.items || []).length), last ? t('lastOn', shortDate(last)) : t('neverDone')].join(' · ');
    return `<a class="row card-row" href="#/routine/${encodeURIComponent(r.id)}">
      <span class="min-badge"><b>${routineMinutes(r)}</b><small>min</small></span>
      <span class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(meta)}</span></span>
      ${icon('chevron', 20, 'class="chev"')}
    </a>`;
  }).join('');
  const html = `<header class="page-head">
      <div><h1>${esc(t('tab_routines'))}</h1>${syncLine()}</div>
      <div class="head-actions">
        <a class="round-btn" href="#/settings" aria-label="${esc(t('settings'))}">${icon('gear')}</a>
        <a class="pill-btn" href="#/plans">${esc(t('plansTitle'))}</a>
        <button type="button" class="round-btn" data-action="new-routine" aria-label="${esc(t('newRoutine'))}">${icon('plus')}</button>
      </div>
    </header>
    ${hero}
    ${list.length ? `<a class="card plan-prompt" href="#/plans">${icon('calendar', 20)}<span><b>${esc(plans().length ? t('choosePlan') : t('makePlan'))}</b><small>${esc(t('planPromptText'))}</small></span>${icon('chevron', 18, 'class="chev"')}</a>` : ''}
    ${list.length ? `<h2 class="section-title">${esc(t('yourRoutines'))}</h2><div class="stack">${rows}</div>`
    : empty(t('esRoutinesTitle'), exercises().length ? t('esRoutinesText') : t('esRoutinesFirst'),
      `<div class="button-row">${exercises().length ? '' : `<a class="btn" href="#/gym">${esc(t('setUpGym'))}</a>`}<button type="button" class="btn primary" data-action="new-routine">${esc(t('newRoutine'))}</button></div>`)}`;
  return {
    html,
    bind(view) {
      view.querySelectorAll('[data-action=new-routine]').forEach((b) => b.addEventListener('click', newRoutine));
      view.querySelector('[data-action=sync]')?.addEventListener('click', () => syncNow());
    },
  };
}

async function newRoutine() {
  const r = upsert('routines', { id: uid(), name: t('newRoutineName'), items: [], autoIncrease: false, order: routines().length });
  location.hash = `#/routine/${r.id}/edit?new=1`;
}

// ---- one routine ----

export function routineView(id) {
  const r = get('routines', id);
  if (!r) return { html: empty(t('notFound'), t('notFoundText'), `<a class="btn" href="#/routines">${esc(t('tab_routines'))}</a>`) };
  const items = (r.items || []).map((it) => ({ it, ex: get('exercises', it.exerciseId) })).filter((x) => x.ex);
  const sets = items.reduce((a, x) => a + (x.ex.type === 'cardio' ? 1 : Number(x.it.sets) || 1), 0);
  const zones = new Set(items.map((x) => placeOf(x.ex)?.id).filter(Boolean)).size;
  const planned = plannedFor(r.id);
  const last = lastDone(r.id);
  let prevPlace = null;
  const list = items.map(({ it, ex }, i) => {
    const p = placeOf(ex);
    const walk = i > 0 && p && prevPlace && p.id !== prevPlace ? `<div class="walk">${icon('arrowDown', 14)}${esc(p.name)}</div>` : '';
    if (p) prevPlace = p.id;
    return `${walk}<div class="row card-row static">
      <span class="num-dot">${i + 1}</span>
      <span class="row-text"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc(whereText(ex) || typeLabel(ex))}</span>
      ${ex.notes ? `<span class="row-note">${icon('pencil', 12)}<span>${esc(ex.notes)}</span></span>` : ''}</span>
      <span class="row-end"><b>${esc(itemPlan(it, ex))}</b>${ex.type !== 'cardio' ? `<small>${esc(t('restShort', restText(it.rest ?? training().rest)))}</small>` : ''}</span>
    </div>`;
  }).join('');
  const html = `<header class="bar">${backLink('#/routines', t('tab_routines'))}<a class="bar-action" href="#/routine/${encodeURIComponent(r.id)}/edit">${esc(t('edit'))}</a></header>
    <h1 class="title">${esc(r.name)}</h1>
    <div class="stats3">
      <div class="stat"><b>${routineMinutes(r)} min</b><span>${esc(t('estimated'))}</span></div>
      <div class="stat"><b>${sets}</b><span>${esc(t('setsWord'))}</span></div>
      <div class="stat"><b>${zones}</b><span>${esc(t('zonesWord'))}</span></div>
    </div>
    <div class="note-panel">${icon('calendar', 18)}<div>
      <b>${esc(t('inEverydaySaved', routineMinutes(r)))}</b>
      <span>${planned.length ? esc(t('plannedOn', planned.slice(0, 3).map(plannedText).join(' · '))) : esc(t('notPlanned'))}${last ? ` · ${esc(t('lastOn', shortDate(last)))}` : ''}</span>
    </div></div>
    ${items.length ? `<div class="stack tight">${list}</div>` : empty(t('esItemsTitle'), t('esItemsText'), `<a class="btn primary" href="#/routine/${encodeURIComponent(r.id)}/edit">${esc(t('addExercise'))}</a>`)}
    ${items.length ? `<div class="sticky-cta"><a class="btn yellow big" href="#/start/${encodeURIComponent(r.id)}">${icon('play', 18)}${esc(t('start'))}</a></div>` : ''}`;
  return { html };
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
    <button type="button" class="btn dashed wide" data-action="add-item">${icon('plus', 18)}${esc(t('addExercise'))}</button>
    <button type="button" class="btn danger-text wide" data-action="delete">${esc(t('deleteRoutine'))}</button>`;
  return {
    html,
    bind(view) {
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
