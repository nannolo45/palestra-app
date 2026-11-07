// Workout: weekly plans (code: plans). The list (one active), a plan's editor with weekdays, and switching the active plan.
import { get, upsert, remove, restore, uid, live } from '../store.js';
import { t } from '../i18n.js';
import { esc, minText, shortDate } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, empty, trainHead } from '../ui/parts.js';
import { openSheet, askConfirm, toast, chooseHowToCreate } from '../ui/dialogs.js';
import { routines, routineMinutes, lastDone } from '../data.js';
import { isWide } from '../shell.js';
import { gyms, gymById, gymName, routineGymId, missingIn } from '../gyms.js';
import { listKit, colorOf } from '../ui/listkit.js';
import { startDrag } from '../ui/dropdrag.js';
import {
  plans, activeInfo, isActive, isUpcoming, dateOf, activate, validTime, deactivate, savePlan, planDays, allDays, planMode, abWeek, planMinutes, weekNumber, nextMonday, isoDate, weekStart, planToText,
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

export function plansView(query = {}) {
  const all = plans();
  const wide = isWide();
  const sel = wide ? (all.find((p) => p.id === query.sel) || null) : null;
  const href = (p) => (wide ? `#/plans?sel=${encodeURIComponent(p.id)}` : `#/plan/${encodeURIComponent(p.id)}`);
  const a = activeInfo();
  const active = a && all.find((p) => p.id === a.planId);
  const others = all.filter((p) => p !== active);
  const card = (p, isAct, upcoming = false) => {
    const days = planDays(p).map((d) => get('routines', d.routineId).name).join(' · ');
    const meta = `${t('nDays', planDays(p).length)} · ${minText(planMinutes(p))} ${t('perWeek')}`;
    if (isAct) {
      return `<a class="plan-card active${sel && sel.id === p.id ? ' selected' : ''}" href="${href(p)}">
        <span class="plan-top"><span class="badge-active">${esc(t('activeBadge'))}</span><span>${esc(sinceText(p))}</span></span>
        <span class="plan-name">${esc(p.name)}</span><span class="plan-days">${esc(days)}</span><span class="plan-meta">${esc(meta)}${weekdaysText(p) ? ` · ${esc(weekdaysText(p))}` : ''}</span></a>`;
    }
    return `<div class="card plan-card">
      <a href="${href(p)}" class="plan-link"><span class="plan-name small">${esc(p.name)}</span><span class="row-sub">${esc(`${meta} · ${sinceText(p)}`)}</span></a>
      ${upcoming ? `<button type="button" class="btn small" data-activate-now="${esc(p.id)}">${esc(t('activateToday'))}</button>` : `<button type="button" class="btn small" data-activate="${esc(p.id)}">${esc(t('makeActive'))}</button>`}
    </div>`;
  };
  const rest = others.filter((p) => !(a && a.upcoming && a.upcoming.planId === p.id));
  const planKeys = [...all.map((p) => `w:${p.id}`), 'w:none'];
  const lastUsed = (p) => Math.max(0, ...planDays(p).map((d) => lastDone(d.routineId) || 0));
  const kit = listKit({
    id: 'wo', items: rest, searchPh: t('searchWorkout'),
    text: (p) => [p.name, ...planDays(p).map((d) => get('routines', d.routineId)?.name)].join(' '),
    noun: (n) => t('nWorkouts', n),
    groups: {
      use: { label: t('gUse'), keysOf: (p) => [lastUsed(p) ? 'u:used' : 'u:never'], name: (k) => t(k === 'u:used' ? 'gu_used' : 'gu_never'), order: (ks) => ['u:used', 'u:never'].filter((k) => ks.includes(k)) },
      none: { label: t('gNone'), keysOf: () => ['all'], name: () => '' },
    },
    facets: [
      { key: 'use', label: t('gUse'), options: [['used', t('gu_used')], ['never', t('gu_never')]], get: (p) => (lastUsed(p) ? 'used' : 'never') },
      { key: 'days', label: t('fDays'), options: [...new Set(rest.map((p) => planDays(p).length))].sort().map((n) => [String(n), t('nDays', n)]), get: (p) => String(planDays(p).length) },
    ],
    sorts: [
      { key: 'last', label: t('sLastUsed'), cmp: (x, y) => lastUsed(y) - lastUsed(x) },
      { key: 'name', label: t('sName'), cmp: (x, y) => x.name.localeCompare(y.name) },
      { key: 'length', label: t('sWeekly'), cmp: (x, y) => planMinutes(x) - planMinutes(y) },
    ],
    colors: [],
    row: (p, { dense }) => {
      const meta = `${t('nDays', planDays(p).length)} · ${minText(planMinutes(p))} ${t('perWeek')} · ${sinceText(p)}`;
      return `<div class="row list-row plan-row${dense ? ' dense' : ''}${sel && sel.id === p.id ? ' selected' : ''}" style="--c:${colorOf(`w:${p.id}`, planKeys)}">
        <span class="plan-dot" aria-hidden="true"></span>
        <a class="row-text plain" href="${href(p)}"><span class="row-title">${esc(p.name)}</span><span class="row-sub">${esc(meta)}</span>
        ${!dense ? `<span class="row-sub">${esc(planDays(p).map((d) => get('routines', d.routineId)?.name).filter(Boolean).join(' · '))}</span>` : ''}</a>
        <button type="button" class="round-btn small" data-plan-menu="${esc(p.id)}" aria-label="${esc(t('moreActions'))}" aria-haspopup="menu">${icon('dots', 18)}</button></div>`;
    },
    def: { group: 'use', sort: 'last', color: 'none', dense: true },
  });
  const html = `${trainHead('plans')}
    <div class="two-actions" data-top-actions><button type="button" class="btn primary" data-action="new-plan">${icon('plus', 18)}${esc(t('newPlan'))}</button><a class="btn" href="#/import?for=plan">${icon('book', 18)}${esc(t('importShort'))}</a></div>
    <p class="lead only-narrow">${esc(t('plansIntro'))}</p>
    ${wide && all.length ? `<div class="master-detail"><div class="md-list">${all.length ? `<div class="stack">
      ${active ? card(active, true) : `<div class="card plain-note">${esc(t('noActivePlan'))}</div>`}
      ${a && a.upcoming ? `<h2 class="section-title">${esc(t('upcomingPlan'))}</h2>${card(a.upcoming.plan, false, true)}` : ''}
      ${rest.length ? `<h2 class="section-title">${esc(t('otherPlans'))}</h2>${kit.html}` : ''}
    </div>` : empty(t('esPlansTitle'), t('esPlansText'))}</div><section class="md-pane card">${weekPane(sel || active || all[0])}</section></div>` : `${all.length ? `<div class="stack">
      ${active ? card(active, true) : `<div class="card plain-note">${esc(t('noActivePlan'))}</div>`}
      ${a && a.upcoming ? `<h2 class="section-title">${esc(t('upcomingPlan'))}</h2>${card(a.upcoming.plan, false, true)}` : ''}
      ${rest.length ? `<h2 class="section-title">${esc(t('otherPlans'))}</h2>${kit.html}` : ''}
    </div>` : empty(t('esPlansTitle'), t('esPlansText'))}`}`;
  return {
    html,
    bind(view) {
      view.querySelectorAll('[data-activate]').forEach((b) => b.addEventListener('click', () => activateSheet(get('plans', b.dataset.activate))));
      kit.bind(view);
      view.querySelectorAll('[data-plan-menu]').forEach((b) => b.addEventListener('click', () => planMenu(b, b.dataset.planMenu)));
      view.querySelectorAll('[data-pane-m]').forEach((b) => b.addEventListener('click', () => {
        const [k, id] = b.dataset.paneM.split('|');
        if (k === 'activate') activateSheet(get('plans', id));
        if (k === 'duplicate') duplicatePlan(id);
        if (k === 'export') exportPlan(id);
      }));
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

/** On a computer, beside the list: the chosen workout's week, day by day, in its colour, with what's missing. */
function weekPane(p) {
  if (!p) return '';
  const act = isActive(p.id);
  const c = colorOf(`w:${p.id}`, [...plans().map((x) => `w:${x.id}`), 'w:none']);
  const names = t('weekdayShort');
  const days = planDays(p);
  const cell = (d) => {
    const r = get('routines', d.routineId);
    const miss = missingIn(r, routineGymId(r)).length;
    return `<a class="wk-day" href="#/routine/${encodeURIComponent(r.id)}"><strong>${esc(r.name)}</strong><span>${esc([validTime(d.time) ? d.time : '', `${routineMinutes(r)} min`].filter(Boolean).join(' · '))}</span>${miss ? `<span class="warn-line">${icon('alert', 12)}${esc(t('nMissingShort', miss))}</span>` : ''}${gyms().length > 1 ? `<small class="muted">${esc(gymName(gymById(routineGymId(r))))}</small>` : ''}</a>`;
  };
  const mode = planMode(p);
  const free = mode === 'rotation' ? allDays(p) : days.filter((d) => !Number.isInteger(d.weekday));
  return `<div class="wk-pane" style="--c:${c}">
    ${act ? `<span class="badge-active">${esc(t('activeBadge'))}</span>` : ''}
    <h2 class="pane-title">${esc(p.name)}</h2>
    <p class="muted">${esc(`${t('nDays', days.length)} · ${minText(planMinutes(p))} ${t('perWeek')} · ${sinceText(p)}`)}</p>
    <div class="pane-acts">${act ? '' : `<button type="button" class="btn primary small" data-pane-m="activate|${esc(p.id)}">${esc(t('makeActive'))}</button>`}<a class="btn small" href="#/plan/${encodeURIComponent(p.id)}">${icon('pencil', 16)}${esc(t('edit'))}</a><button type="button" class="btn small" data-pane-m="duplicate|${esc(p.id)}">${esc(t('duplicate'))}</button><button type="button" class="btn small" data-pane-m="export|${esc(p.id)}">${esc(t('exportText'))}</button></div>
    ${mode === 'rotation' ? '' : `${mode === 'ab' ? `<h3 class="section-title">${esc(t('weekAB', abWeek(p)))}</h3>` : ''}<div class="wk-grid">${names.map((n, w) => { const ds = days.filter((d) => d.weekday === w); return `<div class="wk-col${ds.length ? ' has' : ''}"><b>${esc(n)}</b>${ds.length ? ds.map(cell).join('') : `<span class="muted small">${esc(t('restDay'))}</span>`}</div>`; }).join('')}</div>`}
    ${free.length ? `<h3 class="section-title">${esc(t(mode === 'rotation' ? 'rotOrder' : 'anyDayTitle'))}</h3><div class="wk-free">${free.map(cell).join('')}</div>` : ''}
  </div>`;
}

function duplicatePlan(id) {
  const cur = get('plans', id);
  const copy = upsert('plans', { ...cur, id: uid(), name: t('copyOf', cur.name), days: cur.days.map((d) => ({ ...d })) });
  location.hash = `#/plan/${encodeURIComponent(copy.id)}`;
}

async function exportPlan(id) {
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
}

async function deletePlan(id, stay = false) {
  const cur = get('plans', id);
  if (!(await askConfirm({ text: t('deletePlanQ', cur.name), ok: t('delete'), danger: true }))) return;
  if (isActive(id)) deactivate();
  const before = remove('plans', id);
  if (!stay) location.hash = '#/plans'; else rerender();
  toast(t('deleted', cur.name), { undo: () => restore('plans', before) });
}

/** The ⋯ of a workout in the list: make active, open, duplicate, export, delete. */
function planMenu(anchor, id) {
  document.querySelectorAll('.kit-menu').forEach((el) => el.remove());
  const m = document.createElement('div');
  m.className = 'kit-menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = [['activate', t('makeActive')], ['open', t('open')], ['duplicate', t('duplicate')], ['export', t('exportText')], ['delete', t('delete')]]
    .map(([k, l]) => `<button type="button" role="menuitem" data-m="${k}" class="${k === 'delete' ? 'danger' : ''}">${esc(l)}</button>`).join('');
  const r = anchor.getBoundingClientRect();
  m.style.top = `${r.bottom + window.scrollY + 4}px`;
  m.style.right = `${Math.max(8, document.documentElement.clientWidth - r.right)}px`;
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener('pointerdown', off, true); };
  const off = (e) => { if (!m.contains(e.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
  m.querySelector('button').focus();
  m.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); anchor.focus(); } });
  m.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
    close();
    const k = b.dataset.m;
    if (k === 'activate') activateSheet(get('plans', id));
    if (k === 'open') location.hash = `#/plan/${encodeURIComponent(id)}`;
    if (k === 'duplicate') duplicatePlan(id);
    if (k === 'export') exportPlan(id);
    if (k === 'delete') deletePlan(id, true);
  }));
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

// ---- one plan: the builder (v27) ----
// Schede are coloured tiles: drag them (or tap one, then tap the day) onto the days of the week, more than one a day;
// two weeks that take turns (A · B); or a rotation with no fixed days, joined by circles of rest days.

let viewWeek = 0; // on a phone, which week of an A/B plan is shown
let justDropped = false; // the click that follows a drop (the same press) is not a tap

const routineKeys = () => routines().map((r) => `r:${r.id}`);
const colorR = (id) => colorOf(`r:${id}`, routineKeys());
const dayKey = (d) => `${Number(d.week) || 0}:${Number.isInteger(d.weekday) ? d.weekday : 9}:${validTime(d.time) ? d.time : '99'}`;

function saveDays(id, days, mode) {
  const cur = get('plans', id);
  const m = mode || planMode(cur);
  const sorted = m === 'rotation' ? days : [...days].sort((a, b) => dayKey(a).localeCompare(dayKey(b)));
  savePlan({ ...cur, mode: m, days: sorted }); // 'week' written out: the store keeps fields it isn't given
  rerender();
}

export function planView(id) {
  const p = get('plans', id);
  if (!p) return { html: empty(t('notFound'), t('notFoundText'), `<a class="btn" href="#/plans">${esc(t('plansTitle'))}</a>`) };
  const act = isActive(id) || isUpcoming(id);
  const mode = planMode(p);
  const wide = isWide();
  const all = (p.days || []).map((d, i) => ({ d, i, r: get('routines', d.routineId) })).filter((x) => x.r);
  const names = t('weekdayShort');
  const thisWeek = mode === 'ab' ? abWeek(p) : 0;
  // v28: a tile is tapped for its menu (time, move, remove); with a mouse it can also be dragged
  const tile = ({ d, i, r }, rot = false) => `<button type="button" class="wb-tile" style="--c:${colorR(r.id)}" data-tile="${i}" aria-haspopup="dialog">
      <b>${esc(r.name)}</b>${rot ? `<small>${routineMinutes(r)} min</small>` : `<span class="wb-tm${validTime(d.time) ? '' : ' none'}">${esc(validTime(d.time) ? d.time : `${routineMinutes(r)}′`)}</span>`}</button>`;
  const cell = (w, wd) => {
    const xs = all.filter(({ d }) => (mode !== 'ab' || (Number(d.week) || 0) === w) && (wd === 'x' ? !Number.isInteger(d.weekday) : d.weekday === wd))
      .sort((x, y) => (validTime(x.d.time) ? x.d.time : '99').localeCompare(validTime(y.d.time) ? y.d.time : '99'));
    return { xs, html: xs.map((x) => tile(x)).join('') };
  };
  const addBtn = (w, wd, n) => `<button type="button" class="wb-add${n ? ' small' : ''}" data-add="${w}:${wd}" aria-label="${esc(t('aSchedaOn', t('dayOn')[wd]))}">${icon('plus', 14)}${n ? '' : `<span>${esc(t('restAddDay'))}</span>`}</button>`;
  // on a computer, the schede beside the board, to drag in
  const pal = wide ? `<div class="wb-pal">
      <div class="wb-chips">${routines().map((r) => `<button type="button" class="wb-chip" data-chip="${esc(r.id)}" style="--c:${colorR(r.id)}"><i></i>${esc(r.name)}<small>${routineMinutes(r)}′</small></button>`).join('')}</div>
      <p class="wb-hint">${esc(t(mode === 'rotation' ? 'wbHintRot' : 'wbHint'))}</p></div>` : '';
  const weeks = mode === 'ab' ? [0, 1] : [0];
  const free = all.filter(({ d }) => !Number.isInteger(d.weekday));
  const mins = (w) => all.filter(({ d }) => mode !== 'ab' || (Number(d.week) || 0) === w).reduce((a, { r }) => a + routineMinutes(r), 0);
  const count = (w) => all.filter(({ d }) => mode !== 'ab' || (Number(d.week) || 0) === w).length;
  let board;
  if (mode === 'rotation') {
    const restSum = all.reduce((a, { d }) => a + (Number(d.restDays) || 0), 0);
    board = `<div class="wb-rot"><span class="ch-end">${esc(t('rotStart'))}</span>
      ${all.map((x, k) => `<div class="ch-drop" data-drop="rot:${k}"></div>${tile(x, true)}
        <div class="wb-link${Number(x.d.restDays) > 0 ? '' : ' plain'}"><button type="button" class="wb-rd" data-rd="${x.i}">${esc(Number(x.d.restDays) > 0 ? t('nRestDays', Number(x.d.restDays)) : t('addRest'))}</button></div>`).join('')}
      <div class="ch-drop" data-drop="rot:${all.length}"></div>
      <button type="button" class="wb-add" data-add="rot">${icon('plus', 14)}<span>${esc(t('addToLoop'))}</span></button>
      <span class="ch-end">↺ ${esc(t('rotAgain'))}</span></div>
      <p class="wb-sum">${esc(t('rotSum', all.length, all.length + restSum))}</p>`;
  } else if (wide) {
    board = `<div class="wb-grid${mode === 'ab' ? ' ab' : ''}"><span></span>${names.map((n) => `<b class="wb-hd">${esc(n)}</b>`).join('')}
      ${weeks.map((w) => `${mode === 'ab' ? `<b class="wb-rl">${esc(t('weekAB', w))}</b>` : '<span></span>'}${names.map((_, wd) => { const c = cell(w, wd); return `<div class="wb-day" data-drop="day:${w}:${wd}">${c.html}${addBtn(w, wd, c.xs.length || 1)}</div>`; }).join('')}`).join('')}</div>`;
  } else {
    const w = mode === 'ab' ? viewWeek : 0;
    const todayWd = (new Date().getDay() + 6) % 7;
    board = `${mode === 'ab' ? `<div class="seg-mini wb-wsel" role="group">${[0, 1].map((k) => `<button type="button" class="${w === k ? 'on' : ''}" aria-pressed="${w === k}" data-wv="${k}">${esc(t('weekAB', k))}${k === thisWeek ? ` <small>(${esc(t('thisOneW'))})</small>` : ''}</button>`).join('')}</div>` : ''}
      <div class="wb-rows">${names.map((n, wd) => { const c = cell(w, wd); return `<div class="wb-row${c.xs.length ? '' : ' empty'}${wd === todayWd && w === thisWeek ? ' today' : ''}" data-drop="day:${w}:${wd}"><b>${esc(n)}</b><div class="wb-its">${c.html}${addBtn(w, wd, c.xs.length)}</div></div>`; }).join('')}</div>`;
  }
  if (mode !== 'rotation') {
    board += `${free.length ? `<h3 class="section-title">${esc(t('anyDayTitle'))}</h3><div class="wb-row free" data-drop="day:${viewWeek}:x"><div class="wb-its">${free.map((x) => tile(x)).join('')}</div></div>` : ''}
      <p class="wb-sum">${weeks.map((w) => `${mode === 'ab' ? `${esc(t('weekAB', w))}: ` : ''}<b>${esc(t('wbWeekSum', count(w), minText(mins(w))))}</b>`).join(' · ')}${mode === 'ab' ? ` · ${esc(t('wbThisWeekIs', thisWeek))}` : ''}</p>`;
  }
  const html = `<header class="bar">${backLink('#/plans', t('crumb', t('tab_plans')))}<a class="bar-action strong" href="#/plans">${esc(t('done'))}</a></header>
    <form class="wb-top" data-form="plan" autocomplete="off">
      <label class="wb-name"><span class="sr">${esc(t('name'))}</span><input id="p-name" name="name" value="${esc(p.name)}" aria-label="${esc(t('name'))}"></label>
      <label class="wb-act" title="${esc(t('planActiveHint'))}"><span>${esc(t('activeShort'))}</span><input type="checkbox" class="switch" name="active" ${act ? 'checked' : ''}></label>
    </form>
    <div class="wb" data-wb>
      <div class="seg-mini wb-mode" role="radiogroup" aria-label="${esc(t('daysTitle'))}">${[['week', 'modeWeek'], ['ab', 'modeAB'], ['rotation', 'modeRot']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${mode === k}" class="${mode === k ? 'on' : ''}" data-mode="${k}">${esc(t(l))}</button>`).join('')}</div>
      ${pal}
      <div class="wb-board">${board}</div>
      <div class="ch-trash" data-drop="trash">${icon('trash', 16)}${esc(t('dragHereToRemove'))}</div>
    </div>
    <div class="card kv-list">
      <div class="kv"><span>${esc(t(mode === 'rotation' ? 'rotOrder' : 'perWeekLabel'))}</span><b>${esc(`${t('nDays', planDays(p).length)} · ${minText(planMinutes(p))}`)}</b></div>
      <div class="kv"><span>${esc(t('autoIncrease'))}</span><b>${esc(t('onNofM', all.filter((x) => x.r.autoIncrease).length, all.length))}</b></div>
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
      bindBuilder(view, id);
      view.querySelector('[data-action=duplicate]').addEventListener('click', () => duplicatePlan(id));
      view.querySelector('[data-action=export]').addEventListener('click', () => exportPlan(id));
      view.querySelector('[data-action=delete]').addEventListener('click', () => deletePlan(id));
    },
  };
}

function bindBuilder(view, id) {
  const root = view.querySelector('[data-wb]');
  const cur = () => get('plans', id);
  const days = () => (cur().days || []).map((d) => ({ ...d }));
  const mode = () => planMode(cur());
  const late = () => justDropped;
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
    const to = b.dataset.mode; const from = mode();
    if (to === from) return;
    let ds = days();
    if (from === 'ab' && to !== 'ab') {
      const bs = ds.filter((d) => Number(d.week) === 1);
      if (to === 'week' && bs.length && !(await askConfirm({ text: t('dropBWeek', bs.length), ok: t('modeWeek') }))) return;
      if (to === 'week') ds = ds.filter((d) => Number(d.week) !== 1);
      ds = ds.map(({ week, ...d }) => d);
    }
    if (to === 'ab') ds = ds.map((d) => ({ ...d, week: Number(d.week) || 0 }));
    if (to === 'rotation') ds.sort((a, c) => dayKey(a).localeCompare(dayKey(c)));
    saveDays(id, ds, to);
  }));
  root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { if (!late()) pickScheda(id, b.dataset.add); }));
  root.querySelectorAll('[data-wv]').forEach((b) => b.addEventListener('click', () => { viewWeek = Number(b.dataset.wv); rerender(); }));
  root.querySelectorAll('[data-tile]').forEach((el) => {
    // with a mouse or a pen it can be dragged to another day; a finger scrolls, and moves it from the menu
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') startDrag(e, { kind: 'move', i: Number(el.dataset.tile) }, get('routines', cur().days[Number(el.dataset.tile)]?.routineId)?.name || '', root); });
    el.addEventListener('click', () => { if (!late()) tileMenu(id, Number(el.dataset.tile)); });
  });
  root.querySelectorAll('[data-chip]').forEach((c) => {
    c.addEventListener('pointerdown', (e) => startDrag(e, { kind: 'new', routineId: c.dataset.chip }, get('routines', c.dataset.chip)?.name || '', root));
    c.addEventListener('click', () => { if (!late() && mode() === 'rotation') saveDays(id, [...days(), { routineId: c.dataset.chip, weekday: null }]); });
  });
  root.querySelectorAll('[data-rd]').forEach((b) => b.addEventListener('click', () => {
    const ds = days(); const d = ds[Number(b.dataset.rd)];
    const n = ((Number(d.restDays) || 0) + 1) % 4;
    if (n) d.restDays = n; else delete d.restDays;
    saveDays(id, ds);
  }));
  root.addEventListener('dropped', (e) => {
    justDropped = true; setTimeout(() => { justDropped = false; }, 0);
    const { payload: p, target } = e.detail;
    const [k, a, b] = target.split(':');
    const ds = days();
    if (k === 'trash') { if (p.kind === 'move') saveDays(id, ds.filter((_, i) => i !== p.i)); return; }
    if (k === 'day') {
      const w = Number(a); const wd = b === 'x' ? null : Number(b);
      if (p.kind === 'new') { placeDay(id, p.routineId, w, wd); return; }
      if (p.kind === 'move') { ds[p.i] = { ...ds[p.i], weekday: wd, ...(mode() === 'ab' ? { week: w } : {}) }; saveDays(id, ds); }
      return;
    }
    if (k === 'rot') {
      const at = Number(a);
      if (p.kind === 'new') ds.splice(at, 0, { routineId: p.routineId, weekday: null });
      else if (p.kind === 'move') { const [x] = ds.splice(p.i, 1); ds.splice(at > p.i ? at - 1 : at, 0, x); }
      saveDays(id, ds);
    }
  });
}

function placeDay(planId, routineId, w, wd) {
  const cur = get('plans', planId);
  const ds = (cur.days || []).map((d) => ({ ...d }));
  if (planMode(cur) === 'rotation') { ds.push({ routineId, weekday: null }); saveDays(planId, ds); return; }
  const prev = [...ds].reverse().find((d) => d.routineId === routineId && validTime(d.time));
  ds.push({ routineId, weekday: Number.isInteger(wd) ? wd : null, ...(planMode(cur) === 'ab' ? { week: w } : {}), ...(prev ? { time: prev.time } : {}) });
  saveDays(planId, ds);
}

/** v28: the + of a day (or of the loop): the schede, this workout's first, then by workout, with a search. */
async function pickScheda(planId, target) {
  const p = get('plans', planId);
  const [w, wd] = target === 'rot' ? [0, null] : target.split(':').map(Number);
  const where = target === 'rot' ? t('inTheLoop') : `${t('dayOn')[wd]}${planMode(p) === 'ab' ? ` (${t('weekLetter', w)})` : ''}`;
  const inThis = [...new Set((p.days || []).map((d) => d.routineId))].map((rid) => get('routines', rid)).filter(Boolean);
  const seen = new Set(inThis.map((r) => r.id));
  const groups = [[t('inThisWorkout'), inThis]];
  for (const o of plans().filter((x) => x.id !== planId)) {
    const rs = [...new Set((o.days || []).map((d) => d.routineId))].map((rid) => get('routines', rid)).filter((r) => r && !seen.has(r.id));
    rs.forEach((r) => seen.add(r.id));
    if (rs.length) groups.push([o.name, rs]);
  }
  groups.push([t('otherSchede'), routines().filter((r) => !seen.has(r.id))]);
  const body = (q) => {
    const gs = groups.map(([g, rs]) => [g, rs.filter((r) => !q || r.name.toLowerCase().includes(q))]).filter(([, rs]) => rs.length);
    return gs.map(([g, rs]) => `<div class="ax-gh static">${esc(g)} <small>${rs.length}</small></div><div class="ax-list">${rs.map((r) => `<button type="button" class="ax-row" data-pick="${esc(r.id)}" style="--c:${colorR(r.id)}"><span class="dot"></span><span class="tx"><b>${esc(r.name)}</b></span><span class="mn">${routineMinutes(r)} min</span></button>`).join('')}</div>`).join('')
      || `<p class="muted">${esc(t('noSchedaNamed'))}</p>`;
  };
  const html = `<h2>${esc(t('aSchedaOn', where))}</h2>
    <label class="search">${icon('search', 18)}<span class="sr">${esc(t('searchScheda'))}</span><input id="ps-q" type="search" placeholder="${esc(t('searchScheda'))}" autocomplete="off"></label>
    <div class="ax-body" data-ps-body>${body('')}</div>
    <div class="button-row"><button type="button" class="btn" data-new>${icon('plus', 16)}${esc(t('newScheda2'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  const out = await openSheet(html, (form, close) => {
    form.querySelector('#ps-q').addEventListener('input', (e) => { form.querySelector('[data-ps-body]').innerHTML = body(e.target.value.trim().toLowerCase()); });
    form.addEventListener('click', (e) => {
      const r = e.target.closest('[data-pick]'); if (r) { close({ id: r.dataset.pick }); return; }
      if (e.target.closest('[data-new]')) close({ fresh: true });
    });
  });
  if (!out) return;
  let rid = out.id;
  if (out.fresh) rid = upsert('routines', { id: uid(), name: t('newRoutineName'), items: [], autoIncrease: false, order: live('routines').length }).id;
  placeDay(planId, rid, w, wd);
  if (out.fresh) location.hash = `#/routine/${encodeURIComponent(rid)}/edit`;
}

/** v28: a placed scheda: its time, another day, remove it (in a rotation: earlier, later, remove). */
async function tileMenu(planId, i) {
  const p = get('plans', planId);
  const d = p.days[i];
  const r = get('routines', d?.routineId);
  if (!r) return;
  const mode = planMode(p);
  const names = t('weekdayLong');
  const chip = (attr, on, label) => `<button type="button" class="kit-opt${on ? ' on' : ''}" aria-pressed="${on}" ${attr}>${esc(label)}</button>`;
  const used = [...new Set(p.days.map((x) => x.time).filter(validTime))];
  const times = [...new Set([...used, '07:30', '12:30', '18:00', '19:30'])].sort();
  const html = mode === 'rotation'
    ? `<h2>${esc(r.name)}</h2><div class="ax-list">
      <button type="button" class="ax-row" data-m="up"><span class="tx"><b>↑ ${esc(t('earlier'))}</b></span></button><button type="button" class="ax-row" data-m="down"><span class="tx"><b>↓ ${esc(t('later'))}</b></span></button>
      <a class="ax-row" href="#/routine/${encodeURIComponent(r.id)}" data-close><span class="tx"><b>${esc(t('open'))}</b></span></a>
      <button type="button" class="ax-row danger" data-m="rm"><span class="tx"><b>${esc(t('removeFromLoop'))}</b></span></button></div>
      <div class="button-row"><button type="button" class="btn ghost" data-close>${esc(t('close'))}</button></div>`
    : `<h2>${esc(r.name)}</h2><p class="muted">${esc([Number.isInteger(d.weekday) ? names[d.weekday] : t('anyDayTitle'), mode === 'ab' ? t('weekAB', Number(d.week) || 0) : '', validTime(d.time) ? d.time : ''].filter(Boolean).join(' · '))}</p>
      <div class="kit-sh">${esc(t('wbTime'))}</div><div class="kit-opts">${times.map((x) => chip(`data-t="${x}"`, d.time === x, x)).join('')}${chip('data-t=""', !validTime(d.time), t('noTime'))}</div>
      <label class="wb-other-time"><span>${esc(t('otherTime'))}</span><input type="time" name="time" value="${esc(validTime(d.time) ? d.time : '')}"></label>
      <div class="kit-sh">${esc(t('moveTo'))}</div><div class="kit-opts">${t('weekdayShort').map((n, k) => chip(`data-d="${k}"`, d.weekday === k, n)).join('')}</div>
      ${mode === 'ab' ? `<div class="kit-opts">${[0, 1].map((k) => chip(`data-w="${k}"`, (Number(d.week) || 0) === k, t('weekAB', k))).join('')}</div>` : ''}
      <div class="ax-list" style="margin-top:14px"><a class="ax-row" href="#/routine/${encodeURIComponent(r.id)}" data-close><span class="tx"><b>${esc(t('open'))}</b></span></a><button type="button" class="ax-row danger" data-m="rm"><span class="tx"><b>${esc(t('removeFromDay', Number.isInteger(d.weekday) ? t('weekdayShort')[d.weekday] : t('anyDayTitle')))}</b></span></button></div>
      <div class="button-row"><button type="button" class="btn ghost" data-close>${esc(t('close'))}</button></div>`;
  const out = await openSheet(html, (form, close) => {
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-t], [data-d], [data-w], [data-m]');
      if (!b) return;
      close({ t: b.dataset.t, d: b.dataset.d, w: b.dataset.w, m: b.dataset.m });
    });
    form.time?.addEventListener('change', () => { if (validTime(form.time.value)) close({ t: form.time.value }); });
  });
  if (!out) return;
  const before = get('plans', planId);
  const ds = before.days.map((x) => ({ ...x }));
  const x = ds[i];
  if (out.m === 'rm') { ds.splice(i, 1); saveDays(planId, ds); toast(t('removedX', r.name), { undo: () => { savePlan(before); rerender(); } }); return; }
  if (out.m === 'up' || out.m === 'down') { const j = out.m === 'up' ? i - 1 : i + 1; if (j < 0 || j >= ds.length) return; [ds[i], ds[j]] = [ds[j], ds[i]]; saveDays(planId, ds); return; }
  if (out.t != null) { if (validTime(out.t)) x.time = out.t; else delete x.time; }
  if (out.d != null) x.weekday = Number(out.d);
  if (out.w != null) { x.week = Number(out.w); viewWeek = x.week; }
  saveDays(planId, ds);
}

