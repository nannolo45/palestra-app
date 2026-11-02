// Oggi: the first page. The active workout, today's scheda, the week so far, the last session and the month.
// With no active workout: the schede to start and a nudge to make one.
import { state, get, pref } from '../store.js';
import { t } from '../i18n.js';
import { esc, minText, shortDate, timeOfDay, weekdayShort, monthName } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { empty } from '../ui/parts.js';
import { toast } from '../ui/dialogs.js';
import { syncStatus } from '../shell.js';
import { isSyncing, syncNow } from '../sync.js';
import { routines, exercises, routineMinutes, sessions, placeOf, lastDone } from '../data.js';
import { plannedAhead } from '../model.js';
import {
  activeInfo, weekStatus, weekNumber, planMinutes, outsidePlan, plans, todayDay, effectiveWeekday, movesThisWeek, moveToTomorrow, undoMove, dateOf,
} from '../plans.js';

const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));

export function syncLine() {
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

const startHref = (routineId, block) => `#/start/${encodeURIComponent(routineId)}${block ? `?block=${encodeURIComponent(block.blockId || '')}` : ''}`;

function dayBadge(x, i, status, planned) {
  const wdNames = t('weekdayShort');
  if (x.done) return `<span class="badge done">${esc(t('doneOn', weekdayShort(x.done.start)))}</span>`;
  const ewd = effectiveWeekday(x.day);
  const moved = movesThisWeek().some((m) => m.routineId === x.routine.id);
  const wd = Number.isInteger(ewd) ? `${wdNames[ewd]}${x.day.time ? ` ${x.day.time}` : ''}` : '';
  const p = planned.find((q) => q.routineId === x.routine.id);
  const when = p ? `${weekdayShort(p.at)} ${timeOfDay(p.at)}` : wd;
  if (moved && !p) return `<span class="badge moved">${esc(t('movedBadge', wd))}</span>`;
  if (i === status.next) return `<span class="badge next">${esc(when ? t('nextOn', when) : t('nextOne'))}</span>`;
  return when ? `<span class="badge muted">${esc(when)}</span>` : '';
}

function lastSessionCard() {
  const s = sessions().find((x) => x.end);
  if (!s) return '';
  const r = get('routines', s.routineId) || state.routines.find((x) => x.id === s.routineId);
  return `<h2 class="section-title">${esc(t('lastSession'))}</h2>
    <a class="row card-row" href="#/session/${encodeURIComponent(s.id)}">
      <span class="date-badge"><small>${esc(weekdayShort(s.start))}</small><b>${new Date(s.start).getDate()}</b></span>
      <span class="row-text"><span class="row-title">${esc(r?.name || t('workout'))}</span><span class="row-sub">${esc(minText(s.minutes || 0))}${s.outcome === 'partial' ? ` · ${esc(t('partial'))}` : ''}</span></span>
      ${icon('chevron', 18, 'class="chev"')}
    </a>`;
}

function monthCard() {
  const now = new Date();
  const ms = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const ss = sessions().filter((s) => s.end && s.start >= ms);
  const min = ss.reduce((a, s) => a + (s.minutes || 0), 0);
  // one square per day of the month, filled when there was a session
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const on = new Set(ss.map((s) => new Date(s.start).getDate()));
  return `<a class="card month-card" href="#/history">
      <span class="row-head"><b>${esc(monthName(now))}</b><span class="muted small">${esc(t('monthStats', ss.length, minText(min)))}</span></span>
      <span class="month-dots" aria-hidden="true">${Array.from({ length: days }, (_, i) => `<i class="${on.has(i + 1) ? 'on' : ''}${i + 1 === now.getDate() ? ' today' : ''}"></i>`).join('')}</span>
    </a>`;
}

function todayHero(a, status, planned) {
  const td = todayDay(a.plan);
  const pick = td || (status.next >= 0 ? { ...status.days[status.next], index: status.next } : null);
  if (!pick) return `<section class="today-hero done-week"><p class="week-done">${icon('check', 18)}${esc(t('weekDone'))}</p></section>`;
  const r = pick.routine;
  const block = planned.find((q) => q.routineId === r.id);
  const first = (r.items || []).map((it) => get('exercises', it.exerciseId)).find(Boolean);
  const firstPlace = first && placeOf(first);
  const when = block ? `${weekdayShort(block.at)} ${timeOfDay(block.at)}` : '';
  const eyebrow = td ? (td.day.time ? t('todayAt', td.day.time) : t('todayRoutine')) : t('nextOn', when || (Number.isInteger(effectiveWeekday(pick.day)) ? t('weekdayShort')[effectiveWeekday(pick.day)] : '')).replace(/ · $/, '');
  const moved = movesThisWeek().some((m) => m.routineId === r.id);
  return `<section class="today-hero" aria-label="${esc(t('today'))}">
      <div class="hero-top"><span class="eyebrow">${esc(eyebrow)}</span>${block ? `<span>${esc(t('inEveryday'))}</span>` : ''}</div>
      <a class="hero-title" href="#/routine/${encodeURIComponent(r.id)}">${esc(r.name)}</a>
      <div class="hero-meta">${esc(t('nExercises', (r.items || []).length))} · ${esc(t('aboutMin', routineMinutes(r)))}${firstPlace ? ` · ${esc(t('startsAt', firstPlace.name))}` : ''}</div>
      <div class="hero-actions">
        <a class="btn yellow big" href="${startHref(r.id, block)}">${icon('play', 18)}${esc(t('start'))}</a>
        ${td ? `<button type="button" class="btn on-dark" data-move="${esc(r.id)}">${esc(t('moveToTomorrow'))}</button>` : ''}
        ${moved ? `<button type="button" class="btn on-dark ghost" data-unmove="${esc(r.id)}">${esc(t('moveUndo'))}</button>` : ''}
      </div>
    </section>`;
}

function withPlan(a) {
  const plan = a.plan;
  const status = weekStatus(plan);
  const planned = plannedAhead(pref('planned', []));
  const letters = t('weekdayLetters');
  const onDays = new Set(plan.days.map((d) => effectiveWeekday(d)).filter(Number.isInteger));
  const rows = status.days.map((x, i) => `<a class="row card-row day-home${x.done ? ' is-done' : ''}" href="#/routine/${encodeURIComponent(x.routine.id)}">
      <span class="day-letter">${esc(String.fromCharCode(65 + i))}</span>
      <span class="row-text"><span class="row-title">${esc(x.routine.name)}</span><span class="row-sub">${esc(`${t('nExercises', (x.routine.items || []).length)} · ${x.minutes} min`)}</span></span>
      ${dayBadge(x, i, status, planned)}
    </a>`).join('');
  const outside = outsidePlan(plan);
  const main = `${todayHero(a, status, planned)}
    <h2 class="section-title">${esc(t('thisWeek'))}</h2>
    <div class="stack tight">${rows}</div>`;
  const side = `<a class="plan-hero light" href="#/plans">
      <span class="plan-top"><span class="badge-active yellow">${esc(t('activeBadgeLong'))}</span><span class="change">${esc(t('change'))}${icon('chevron', 16)}</span></span>
      <span class="plan-hero-name">${esc(plan.name)}</span>
      <span class="plan-hero-meta"><span>${esc(t('weekStatus', weekNumber(a.from), status.doneCount, status.days.length, minText(planMinutes(plan))))}</span>
        <span class="wd-chips" aria-hidden="true">${letters.map((l, w) => `<i class="${onDays.has(w) ? 'on' : ''}">${esc(l)}</i>`).join('')}</span></span>
    </a>
    ${lastSessionCard()}
    <h2 class="section-title">${esc(t('monthBox', ''))}</h2>${monthCard()}
    ${outside.length ? `<h2 class="section-title">${esc(t('outsidePlan'))}</h2><div class="card list">${outside.slice(0, 6).map((r) => `<a class="row list-row" href="#/routine/${encodeURIComponent(r.id)}"><span class="row-text"><span class="row-title">${esc(r.name)}</span></span><span class="muted small">${routineMinutes(r)} min</span>${icon('chevron', 18, 'class="chev"')}</a>`).join('')}</div>` : ''}`;
  return { main, side };
}

function withoutPlan() {
  const list = routines();
  const next = plannedAhead(pref('planned', [])).find((p) => get('routines', p.routineId));
  let hero = '';
  if (next) {
    const r = get('routines', next.routineId);
    hero = `<section class="today-hero">
      <div class="hero-top"><span class="eyebrow">${esc(t('nextFromEveryday'))}</span><span>${esc(`${shortDate(next.at)}, ${timeOfDay(next.at)}`)}</span></div>
      <a class="hero-title" href="#/routine/${encodeURIComponent(r.id)}">${esc(r.name)}</a>
      <div class="hero-meta">${esc(t('nExercises', (r.items || []).length))} · ${esc(t('aboutMin', routineMinutes(r)))}</div>
      <div class="hero-actions"><a class="btn yellow big" href="${startHref(r.id, next)}">${icon('play', 18)}${esc(t('start'))}</a></div>
    </section>`;
  }
  const prompt = `<a class="card plan-prompt" href="#/plans">${icon('calendar', 20)}<span><b>${esc(t('noPlanToday'))}</b><small>${esc(t('noPlanTodayText'))}</small></span>
    <span class="btn small">${esc(plans().length ? t('choosePlan') : t('makePlan'))}</span></a>`;
  const quick = list.length ? `<h2 class="section-title">${esc(t('quickStart'))}</h2><div class="stack tight">${list.map((r) => {
    const last = lastDone(r.id);
    return `<div class="row card-row">
      <a class="row-text" href="#/routine/${encodeURIComponent(r.id)}"><span class="row-title">${esc(r.name)}</span><span class="row-sub">${esc([`${routineMinutes(r)} min`, last ? t('lastOn', shortDate(last)) : t('neverDone')].join(' · '))}</span></a>
      <a class="icon-btn yellow-btn" href="${startHref(r.id)}" aria-label="${esc(t('startX', r.name))}">${icon('play', 18)}</a>
    </div>`;
  }).join('')}</div>`
    : empty(t('esRoutinesTitle'), exercises().length ? t('esRoutinesText') : t('esRoutinesFirst'),
      `<div class="button-row">${exercises().length ? '' : `<a class="btn" href="#/gym">${esc(t('setUpGym'))}</a>`}<a class="btn primary" href="#/routines">${esc(t('tab_routines'))}</a></div>`);
  return { main: `${hero}${prompt}${quick}`, side: `${lastSessionCard()}<h2 class="section-title">${esc(t('monthBox', ''))}</h2>${monthCard()}` };
}

export function todayView() {
  const a = activeInfo();
  const { main, side } = a ? withPlan(a) : withoutPlan();
  const now = Date.now();
  const html = `<header class="page-head">
      <div><h1>${esc(t('today'))}</h1><p class="sub">${esc(new Date(now).toLocaleDateString(document.documentElement.lang || 'it', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>${syncLine()}</div>
      <div class="head-actions"><a class="round-btn only-narrow" href="#/settings" aria-label="${esc(t('settings'))}">${icon('gear')}</a></div>
    </header>
    <div class="cols"><div class="col-main">${main}</div><aside class="col-side">${side}</aside></div>`;
  return {
    html,
    bind(view) {
      view.querySelector('[data-action=sync]')?.addEventListener('click', () => syncNow());
      view.querySelectorAll('[data-move]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.move;
        moveToTomorrow(id);
        toast(t('movedToTomorrow', get('routines', id)?.name || ''), { undo: () => { undoMove(id); rerender(); } });
        rerender();
      }));
      view.querySelectorAll('[data-unmove]').forEach((b) => b.addEventListener('click', () => { undoMove(b.dataset.unmove); rerender(); }));
    },
  };
}

export { dateOf };
