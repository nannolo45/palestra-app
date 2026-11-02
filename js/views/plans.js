// Workout: weekly plans (code: plans). The list (one active), a plan's editor with weekdays, and switching the active plan.
import { get, upsert, remove, restore, uid, live } from '../store.js';
import { t } from '../i18n.js';
import { esc, minText, shortDate } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, empty, toggle } from '../ui/parts.js';
import { openSheet, askConfirm, toast, chooseHowToCreate } from '../ui/dialogs.js';
import { routines, routineMinutes, lastDone } from '../data.js';
import {
  plans, activeInfo, isActive, isUpcoming, dateOf, activate, validTime, deactivate, savePlan, planDays, planMinutes, weekNumber, nextMonday, isoDate, weekStart, planToText,
} from '../plans.js';

const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));
export const WEEKDAYS = () => t('weekdayLetters'); // ['L','M','M','G','V','S','D']

function sinceText(p) {
  const a = activeInfo();
  if (a && a.planId === p.id) {
    if (a.upcoming) return t('activeUntil', shortDate(dateOf(a.upcoming.from)));
    return t('activeForWeeks', weekNumber(a.from));
  }
  if (a && a.upcoming && a.upcoming.planId === p.id) return t('activeFrom', shortDate(dateOf(a.upcoming.from)));
  const days = planDays(p);
  const last = Math.max(0, ...days.map((d) => lastDone(d.routineId) || 0));
  return last ? t('lastUsed', shortDate(last)) : t('neverUsed');
}

function weekdaysText(p) {
  const names = t('weekdayShort');
  const ds = planDays(p).map((d) => (Number.isInteger(d.weekday) ? `${names[d.weekday]}${validTime(d.time) ? ` ${d.time}` : ''}` : '')).filter(Boolean);
  return ds.join(' · ');
}

export function plansView() {
  const all = plans();
  const a = activeInfo();
  const active = a && all.find((p) => p.id === a.planId);
  const others = all.filter((p) => p !== active);
  const card = (p, isAct, upcoming = false) => {
    const days = planDays(p).map((d) => get('routines', d.routineId).name).join(' · ');
    const meta = `${t('nDays', planDays(p).length)} · ${minText(planMinutes(p))} ${t('perWeek')}`;
    if (isAct) {
      return `<a class="plan-card active" href="#/plan/${encodeURIComponent(p.id)}">
        <span class="plan-top"><span class="badge-active">${esc(t('activeBadge'))}</span><span>${esc(sinceText(p))}</span></span>
        <span class="plan-name">${esc(p.name)}</span><span class="plan-days">${esc(days)}</span><span class="plan-meta">${esc(meta)}${weekdaysText(p) ? ` · ${esc(weekdaysText(p))}` : ''}</span></a>`;
    }
    return `<div class="card plan-card">
      <a href="#/plan/${encodeURIComponent(p.id)}" class="plan-link"><span class="plan-name small">${esc(p.name)}</span><span class="row-sub">${esc(`${meta} · ${sinceText(p)}`)}</span></a>
      ${upcoming ? `<button type="button" class="btn small" data-activate-now="${esc(p.id)}">${esc(t('activateToday'))}</button>` : `<button type="button" class="btn small" data-activate="${esc(p.id)}">${esc(t('makeActive'))}</button>`}
    </div>`;
  };
  const html = `<header class="page-head">
      <div><h1>${esc(t('plansTitle'))}</h1><p class="sub">${esc(a ? t('activeIs', a.plan.name) : t('noActivePlanShort'))}</p></div>
      <div class="head-actions"><a class="round-btn only-narrow" href="#/settings" aria-label="${esc(t('settings'))}">${icon('gear')}</a></div>
    </header>
    <div class="two-actions"><button type="button" class="btn primary" data-action="new-plan">${icon('plus', 18)}${esc(t('newPlan'))}</button><a class="btn" href="#/import?for=plan">${icon('book', 18)}${esc(t('importShort'))}</a></div>
    <p class="lead">${esc(t('plansIntro'))}</p>
    ${all.length ? `<div class="stack">
      ${active ? card(active, true) : `<div class="card plain-note">${esc(t('noActivePlan'))}</div>`}
      ${a && a.upcoming ? `<h2 class="section-title">${esc(t('upcomingPlan'))}</h2>${card(a.upcoming.plan, false, true)}` : ''}
      ${others.filter((p) => !(a && a.upcoming && a.upcoming.planId === p.id)).length ? `<h2 class="section-title">${esc(t('otherPlans'))}</h2>${others.filter((p) => !(a && a.upcoming && a.upcoming.planId === p.id)).map((p) => card(p, false)).join('')}` : ''}
    </div>` : empty(t('esPlansTitle'), t('esPlansText'))}`;
  return {
    html,
    bind(view) {
      view.querySelectorAll('[data-activate]').forEach((b) => b.addEventListener('click', () => activateSheet(get('plans', b.dataset.activate))));
      view.querySelectorAll('[data-activate-now]').forEach((b) => b.addEventListener('click', () => { activate(get('plans', b.dataset.activateNow), isoDate(Date.now())); rerender(); }));
      view.querySelector('[data-action=new-plan]').addEventListener('click', async () => {
        const how = await chooseHowToCreate({ title: t('newPlan'), emptyLabel: t('startEmpty'), emptyHint: t('startEmptyPlanHint'), importLabel: t('importFromTextOrFile'), importHint: t('importPlanHint') });
        if (how === 'import') { location.hash = '#/import?for=plan'; return; }
        if (how !== 'empty') return;
        const p = upsert('plans', { id: uid(), name: t('newPlanName'), days: [] });
        location.hash = `#/plan/${encodeURIComponent(p.id)}`;
      });
    },
  };
}

/** Confirm making a plan active, from Monday or from today. */
export async function activateSheet(plan) {
  if (!plan) return false;
  if (!planDays(plan).length) { toast(t('planNeedsDays')); return false; }
  const a = activeInfo();
  const now = Date.now();
  const monday = nextMonday(now);
  const isMonday = new Date(now).getDay() === 1;
  const html = `<h2>${esc(t('activateQ', plan.name))}</h2>
    <div class="card">
      ${a ? `<p class="sheet-line">${icon('check', 18)}<span>${esc(t('oldPlanKept', a.plan.name))}</span></p>` : ''}
      <p class="sheet-line">${icon('calendar', 18)}<span>${esc(t('everydayWillPlan', planDays(plan).length))}</span></p>
    </div>
    ${a && !isMonday ? `<span class="field-head">${esc(t('fromWhen'))}</span>
    <label class="option"><input type="radio" name="from" value="monday" checked><span><b>${esc(t('fromMonday', shortDate(monday)))}</b><small>${esc(t('fromMondayHint'))}</small></span></label>
    <label class="option"><input type="radio" name="from" value="today"><span><b>${esc(t('fromToday'))}</b><small>${esc(t('fromTodayHint'))}</small></span></label>` : ''}
    <div class="button-row"><button class="btn primary big" value="ok">${esc(t('makeActive'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  const ok = await openSheet(html, (form, close) => {
    form.querySelector('[value=ok]').addEventListener('click', () => {
      const choice = form.querySelector('[name=from]:checked')?.value || 'today';
      activate(plan, isoDate(choice === 'monday' ? monday : now));
      close(true);
    });
  });
  if (ok) { toast(t('planActivated', plan.name)); rerender(); }
  return ok;
}

// ---- one plan ----

export function planView(id) {
  const p = get('plans', id);
  if (!p) return { html: empty(t('notFound'), t('notFoundText'), `<a class="btn" href="#/plans">${esc(t('plansTitle'))}</a>`) };
  const act = isActive(id) || isUpcoming(id);
  const letters = WEEKDAYS();
  const days = (p.days || []).map((d, i) => ({ d, i, r: get('routines', d.routineId) })).filter((x) => x.r);
  const rows = days.map(({ d, i, r }) => `<div class="card day-row" data-sort-key="${i}">
      <button type="button" class="drag-handle" aria-label="${esc(t('moveItem', r.name))}">${icon('grip', 20)}</button>
      <div class="day-body">
        <a class="day-head" href="#/routine/${encodeURIComponent(r.id)}"><b>${esc(r.name)}</b><span class="muted small">${routineMinutes(r)} min</span></a>
        <div class="weekdays" role="group" aria-label="${esc(t('weekdayFor', r.name))}">
          ${letters.map((l, w) => `<button type="button" class="wd${d.weekday === w ? ' on' : ''}" aria-pressed="${d.weekday === w}" aria-label="${esc(t('weekdayShort')[w])}" data-day="${i}" data-wd="${w}">${esc(l)}</button>`).join('')}
        </div>
        <label class="day-time"><span>${esc(t('timeOptional'))}</span><input type="time" value="${esc(validTime(d.time) ? d.time : '')}" data-time="${i}" aria-label="${esc(t('timeFor', r.name))}">
          ${validTime(d.time) ? `<button type="button" class="link-btn" data-clear-time="${i}">${esc(t('clearTime'))}</button>` : `<small class="muted">${esc(t('noTimeHint'))}</small>`}</label>
      </div>
      <button type="button" class="icon-btn" data-remove-day="${i}" aria-label="${esc(t('removeX', r.name))}">${icon('close', 18)}</button>
    </div>`).join('');
  const html = `<header class="bar">${backLink('#/plans', t('plansTitle'))}<a class="bar-action strong" href="#/plans">${esc(t('done'))}</a></header>
    <form class="stack form" data-form="plan" autocomplete="off">
      <label class="field"><span>${esc(t('name'))}</span><input id="p-name" name="name" value="${esc(p.name)}"></label>
      <div class="card">${toggle({ name: 'active', checked: act, label: t('planActive'), hint: t('planActiveHint') })}</div>
    </form>
    <div class="field-head row-head"><span>${esc(t('daysTitle'))}</span><small class="muted">${esc(t('dragToReorder'))}</small></div>
    <div class="stack tight" data-sortable="days">${rows}</div>
    <div class="two-actions"><button type="button" class="btn dashed" data-action="add-day">${icon('plus', 18)}${esc(t('addRoutineToPlan'))}</button><a class="btn" href="#/import?for=routine&plan=${encodeURIComponent(p.id)}">${icon('book', 18)}${esc(t('importShort'))}</a></div>
    <div class="card kv-list">
      <div class="kv"><span>${esc(t('perWeekLabel'))}</span><b>${esc(`${t('nDays', days.length)} · ${minText(planMinutes(p))}`)}</b></div>
      <div class="kv"><span>${esc(t('autoIncrease'))}</span><b>${esc(t('onNofM', days.filter((x) => x.r.autoIncrease).length, days.length))}</b></div>
    </div>
    <div class="two"><button type="button" class="btn" data-action="duplicate">${esc(t('duplicate'))}</button><button type="button" class="btn" data-action="export">${esc(t('exportTxt'))}</button></div>
    <button type="button" class="btn danger-text wide" data-action="delete">${esc(t('deletePlan'))}</button>`;
  return {
    html,
    bind(view) {
      const form = view.querySelector('[data-form=plan]');
      form.name.addEventListener('change', () => { const cur = get('plans', id); savePlan({ ...cur, name: form.name.value.trim() || cur.name }); });
      form.active.addEventListener('change', async () => {
        if (form.active.checked) { if (!(await activateSheet(get('plans', id)))) form.active.checked = false; } else if (await askConfirm({ text: t('deactivateQ'), ok: t('deactivate') })) { deactivate(); rerender(); } else form.active.checked = true;
      });
      view.querySelectorAll('[data-wd]').forEach((b) => b.addEventListener('click', () => {
        const cur = get('plans', id);
        const daysNext = cur.days.map((d, i) => (i === Number(b.dataset.day) ? { ...d, weekday: d.weekday === Number(b.dataset.wd) ? null : Number(b.dataset.wd) } : d));
        savePlan({ ...cur, days: daysNext });
        rerender();
      }));
      const setTime = (i, time) => {
        const cur = get('plans', id);
        savePlan({ ...cur, days: cur.days.map((d, j) => { if (j !== i) return d; const n = { ...d }; if (validTime(time)) n.time = time; else delete n.time; return n; }) });
        rerender();
      };
      view.querySelectorAll('[data-time]').forEach((inp) => inp.addEventListener('change', () => setTime(Number(inp.dataset.time), inp.value)));
      view.querySelectorAll('[data-clear-time]').forEach((b) => b.addEventListener('click', () => setTime(Number(b.dataset.clearTime), '')));
      view.querySelector('[data-sortable=days]').addEventListener('sorted', (e) => {
        const cur = get('plans', id);
        savePlan({ ...cur, days: e.detail.keys.map((k) => cur.days[Number(k)]) });
        rerender();
      });
      view.querySelectorAll('[data-remove-day]').forEach((b) => b.addEventListener('click', () => {
        const cur = get('plans', id);
        savePlan({ ...cur, days: cur.days.filter((_, i) => i !== Number(b.dataset.removeDay)) });
        rerender();
      }));
      view.querySelector('[data-action=add-day]').addEventListener('click', () => addDay(id));
      view.querySelector('[data-action=duplicate]').addEventListener('click', () => {
        const cur = get('plans', id);
        const copy = upsert('plans', { ...cur, id: uid(), name: t('copyOf', cur.name), days: cur.days.map((d) => ({ ...d })) });
        location.hash = `#/plan/${encodeURIComponent(copy.id)}`;
      });
      view.querySelector('[data-action=export]').addEventListener('click', async () => {
        const cur = get('plans', id);
        const text = planToText(cur);
        const file = new File([text], `${cur.name.replace(/[^\p{L}\p{N} ._-]+/gu, '').trim() || 'workout'}.txt`, { type: 'text/plain' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], title: cur.name }); return; } catch { /* cancelled: fall back to a download */ }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      view.querySelector('[data-action=delete]').addEventListener('click', async () => {
        const cur = get('plans', id);
        if (!(await askConfirm({ text: t('deletePlanQ', cur.name), ok: t('delete'), danger: true }))) return;
        if (isActive(id)) deactivate();
        const before = remove('plans', id);
        location.hash = '#/plans';
        toast(t('deleted', cur.name), { undo: () => restore('plans', before) });
      });
    },
  };
}

async function addDay(planId) {
  const p = get('plans', planId);
  const inPlan = new Set((p.days || []).map((d) => d.routineId));
  const list = routines().filter((r) => !inPlan.has(r.id));
  const html = `<h2>${esc(t('addRoutineToPlan'))}</h2>
    ${list.length ? `<div class="pick-list">${list.map((r) => `<button type="button" class="row pick" data-pick="${esc(r.id)}"><span class="min-badge"><b>${routineMinutes(r)}</b><small>min</small></span><span class="row-text"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc(t('nExercises', (r.items || []).length))}</span></span></button>`).join('')}</div>` : `<p>${esc(t('allRoutinesInPlan'))}</p>`}
    <div class="button-row"><button type="button" class="btn" data-new>${esc(t('newRoutine'))}</button><a class="btn" href="#/import?for=routine&plan=${encodeURIComponent(planId)}" data-close>${esc(t('importShort'))}</a><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  await openSheet(html, (form, close) => {
    form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => {
      const cur = get('plans', planId);
      savePlan({ ...cur, days: [...(cur.days || []), { routineId: b.dataset.pick, weekday: null }] });
      close(true);
      rerender();
    }));
    form.querySelector('[data-new]').addEventListener('click', () => {
      const r = upsert('routines', { id: uid(), name: t('newRoutineName'), items: [], autoIncrease: false, order: live('routines').length });
      const cur = get('plans', planId);
      savePlan({ ...cur, days: [...(cur.days || []), { routineId: r.id, weekday: null }] });
      close(true);
      location.hash = `#/routine/${encodeURIComponent(r.id)}/edit`;
    });
  });
}
