// Start workout mode: the weekly increase, the set, the rest timer, cardio, pause, and the summary.
// Dark, big, screen kept on, works offline. All timing comes from timestamps (see workout.js).
import { state, get, upsert, live, pref, setPref } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum, clock, num, timeOfDay, minText } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { stepper, bindSteppers, stepVal } from '../ui/parts.js';
import { askConfirm, toast, openSheet } from '../ui/dialogs.js';
import { machineOf, placeOf, whereText, measureLabel, training, increaseSettings, refreshEstimates, routineMinutes } from '../data.js';
import { increaseProposals, applyIncrease, measuresFor, totalWeight, lastResult, weightMode, BAR_KG } from '../model.js';
import * as W from '../workout.js';
import { breakdownBar, setText } from './history.js';
import { syncNow } from '../sync.js';
import { thumbOf, openViewer } from './pictures.js';

let active = null; // the workout in progress
let summaryId = null; // the session just finished, shown until closed
let pendingStart = null; // { routineId, blockId, proposals }
let unchecked = new Set();
let wakeLock = null;
let vibratedFor = null;
let peek = null;
let peekMove = null; // the arrow keys, on a computer
document.addEventListener('keydown', (e) => {
  if (!peekMove || !document.querySelector('.w-screen') || e.target.closest?.('input, textarea, select, dialog')) return;
  if (e.key === 'ArrowLeft') peekMove(-1);
  if (e.key === 'ArrowRight') peekMove(1);
}); // the exercise being looked at (its place in the workout), when it isn't the one you're at

export async function initWorkout() {
  active = await W.loadActive();
  return active;
}
export const hasActive = () => Boolean(active && active.phase !== 'done');
export const activeWorkout = () => active;

/** Tell Everyday (prefs → live) when the workout starts, pauses, resumes or ends; nothing for sets and rests. */
function publishLive(w) {
  if (w && w.phase === 'done') return; // finish() clears it after the session is up
  const rec = W.liveRecord(w);
  const cur = pref('live', null);
  const same = (a, b) => (a == null && b == null) || (a && b && ['sessionId', 'routineId', 'start', 'pausedAt', 'pausedMs', 'blockId'].every((k) => (a[k] ?? null) === (b[k] ?? null)));
  if (same(rec, cur)) return;
  setPref('live', rec ? { ...rec, at: Date.now() } : null);
}

async function commit(next) {
  active = next;
  peek = null;
  publishLive(active);
  await W.saveActive(active);
  window.dispatchEvent(new CustomEvent('palestra:render'));
}

// ---- starting ----

/** #/start/<routineId>?block=<blockId>: ask about the weekly increase if there's one, else go. */
export function startView(routineId, query = {}) {
  const r = get('routines', routineId);
  if (!r) return { html: `<div class="dark-page"><p>${esc(t('notFound'))}</p><a class="btn yellow" href="#/routines">${esc(t('tab_routines'))}</a></div>`, dark: true };
  if (hasActive()) {
    const ar = get('routines', active.routineId);
    return {
      dark: true,
      html: `<div class="dark-page center"><h1 class="w-title">${esc(t('workoutInProgress'))}</h1>
        <p class="w-text">${esc(t('workoutInProgressText', ar?.name || ''))}</p>
        <a class="btn yellow big" href="#/workout">${esc(t('resume'))}</a>
        <button type="button" class="btn ghost-dark" data-action="discard">${esc(t('endItAndStart', r.name))}</button></div>`,
      bind(view) {
        view.querySelector('[data-action=discard]').addEventListener('click', async () => {
          await finish(true);
          summaryId = null;
          window.dispatchEvent(new CustomEvent('palestra:render'));
        });
      },
    };
  }
  const items = (r.items || []).filter((it) => get('exercises', it.exerciseId));
  if (!items.length) {
    return { dark: true, html: `<div class="dark-page center"><p class="w-text">${esc(t('esItemsText'))}</p><a class="btn yellow" href="#/routine/${encodeURIComponent(r.id)}/edit">${esc(t('addExercise'))}</a></div>` };
  }
  if (!pendingStart || pendingStart.routineId !== routineId) {
    const props = increaseProposals(r, live('exercises'), live('sessions'), increaseSettings());
    pendingStart = { routineId, blockId: query.block || null, props };
    unchecked = new Set();
  }
  const props = pendingStart.props;
  if (!props || (!props.proposals.length && !props.held.length)) {
    if (!pendingStart.starting) {
      pendingStart.starting = true;
      const blockId = pendingStart.blockId;
      setTimeout(() => {
        const cur = get('routines', routineId);
        const next = props ? upsert('routines', applyIncrease(cur, [], [])) : cur;
        begin(next, blockId);
      }, 0);
    }
    return { dark: true, html: '<div class="dark-page"></div>' };
  }
  const exName = (id) => get('exercises', id)?.name || '';
  const unitOf = (p) => (p.field === 'weight' ? ' kg' : p.field === 'duration' ? ' min' : ` ${t('repsShort')}`);
  const count = props.proposals.filter((p) => !unchecked.has(p.itemIndex)).length;
  const html = `<div class="w-screen">
    <header class="w-head"><a class="w-icon" href="#/routine/${encodeURIComponent(r.id)}" aria-label="${esc(t('cancel'))}">${icon('close')}</a></header>
    <div class="w-intro"><span class="eyebrow yellow">${esc(t('firstOfWeek'))}</span><h1 class="w-title">${esc(t('goUpQ'))}</h1>
      <p class="w-text">${esc(increaseSettings().when === 'always' ? t('goUpTextAlways') : t('goUpText'))}</p></div>
    <main class="w-main">
      ${props.proposals.length ? `<div class="w-card list">${props.proposals.map((p) => {
    const on = !unchecked.has(p.itemIndex);
    return `<button type="button" class="inc-row${on ? ' on' : ''}" aria-pressed="${on}" data-toggle="${p.itemIndex}">
          <span class="check-box" aria-hidden="true">${on ? icon('check', 18) : ''}</span>
          <span class="inc-name">${esc(exName(p.exerciseId))}</span>
          <span class="inc-from">${esc(fmtNum(p.from))}</span>${icon('arrowRight', 16)}
          <span class="inc-to">${esc(fmtNum(p.to))}${esc(unitOf(p))}</span>
        </button>`;
  }).join('')}</div>` : ''}
      ${props.held.map((h) => `<div class="w-card held"><span class="check-box muted" aria-hidden="true">${icon('minus', 16)}</span><div><b>${esc(t('staysAt', exName(h.exerciseId)))}</b><small>${esc(heldReason(h))}</small></div></div>`).join('')}
      ${props.excluded.length || props.timed.length ? `<p class="w-small">${esc([props.excluded.length ? t('excludedList', props.excluded.map(exName).join(', ')) : '', props.timed.length ? t('timedList', props.timed.map(exName).join(', ')) : ''].filter(Boolean).join(' · '))}</p>` : ''}
    </main>
    <div class="w-foot">
      <button type="button" class="btn yellow huge" data-action="confirm">${esc(count ? t('confirmNAndStart', count) : t('start'))}</button>
      <button type="button" class="btn ghost-dark" data-action="skip">${esc(t('startWithOld'))}</button>
    </div></div>`;
  return {
    dark: true,
    html,
    bind(view) {
      view.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.toggle);
        if (unchecked.has(i)) unchecked.delete(i); else unchecked.add(i);
        window.dispatchEvent(new CustomEvent('palestra:render'));
      }));
      view.querySelector('[data-action=confirm]').addEventListener('click', () => {
        const accepted = props.proposals.map((p) => p.itemIndex).filter((i) => !unchecked.has(i));
        const next = upsert('routines', applyIncrease(get('routines', routineId), props.proposals, accepted));
        refreshEstimates();
        begin(next, pendingStart.blockId);
      });
      view.querySelector('[data-action=skip]').addEventListener('click', () => {
        const next = upsert('routines', applyIncrease(get('routines', routineId), [], []));
        begin(next, pendingStart.blockId);
      });
    },
  };
}

function heldReason(h) {
  const s = h.short;
  if (!s) return '';
  if (s.kind === 'reps') return t('heldReps', s.under, s.of, s.goal);
  if (s.kind === 'sets') return t('heldSets', s.done, s.goal);
  if (s.kind === 'seconds') return t('heldSeconds', s.under, s.of, s.goal);
  if (s.kind === 'minutes') return t('heldMinutes', fmtNum(s.done), fmtNum(s.goal));
  return '';
}

function begin(routine, blockId) {
  pendingStart = null;
  summaryId = null;
  const w = W.newWorkout(routine, live('exercises'), { blockId, training: training() });
  commit(w).then(() => { location.replace('#/workout'); });
}

// ---- the workout screen ----

export function workoutView() {
  if (summaryId) return summaryView();
  if (!active) return { dark: true, html: `<div class="dark-page center"><p class="w-text">${esc(t('noWorkout'))}</p><a class="btn yellow" href="#/routines">${esc(t('tab_routines'))}</a></div>` };
  if (active.phase === 'done') { finish(false); return { dark: true, html: '<div class="dark-page"></div>' }; }
  const r = state.routines.find((x) => x.id === active.routineId);
  const step = W.current(active);
  const ex = state.exercises.find((e) => e.id === step.exerciseId);
  const exIndexes = [...new Set(active.steps.map((s) => s.itemIndex))];
  const pos = exIndexes.indexOf(step.itemIndex);
  const paused = W.isPaused(active);
  if (peek != null && (peek === pos || peek < 0 || peek >= exIndexes.length || paused)) peek = null;
  const looking = peek != null;
  const head = `<header class="w-head">
      <button type="button" class="w-icon" data-action="end" aria-label="${esc(t('endWorkout'))}">${icon('close')}</button>
      <div class="w-head-mid"><span class="w-small">${looking ? esc(t('pvPrefix')) : ''}${esc(t('exNofM', r?.name || '', (looking ? peek : pos) + 1, exIndexes.length))}</span><span class="w-clock" data-live="elapsed">${clock(W.elapsedSec(active))}</span></div>
      <button type="button" class="w-icon filled" data-action="pause" aria-label="${esc(paused ? t('resume') : t('pauseWorkout'))}">${icon(paused ? 'play' : 'pause', 18)}</button>
    </header>
    <div class="w-progress" aria-hidden="true">${exIndexes.map((ix, i) => `<span class="${i < pos ? 'done' : i === pos ? 'now' : ''}${looking && i === peek ? ' view' : ''}"></span>`).join('')}</div>`;
  let body;
  if (paused) body = pausedBody();
  else if (looking) body = previewBody(exIndexes[peek], pos);
  else if (active.phase === 'rest') body = restBody();
  else if (step.kind === 'cardio') body = cardioBody(step, ex);
  else body = setBody(step, ex);
  return {
    dark: true,
    html: `<div class="w-screen${looking ? ' peeking' : ''}">${head}${body}${paused ? '' : edges(exIndexes.length, looking ? peek : pos)}</div>`,
    bind(view) {
      bindSteppers(view, (name, v) => { if (name === 'weight') { const h = view.querySelector('[data-wt-hint]'); if (h) h.textContent = weightTexts(ex, v).hint; } });
      bindPeek(view, exIndexes, pos);
      view.querySelectorAll('[data-action=pause]').forEach((b) => b.addEventListener('click', () => commit(paused ? W.resume(active) : W.pause(active))));
      view.querySelector('[data-action=end]').addEventListener('click', endEarly);
      view.querySelector('[data-action=resume]')?.addEventListener('click', () => commit(W.resume(active)));
      view.querySelector('[data-action=done]')?.addEventListener('click', () => {
        const values = {};
        if (step.kind === 'cardio') {
          values.targets = {};
          view.querySelectorAll('[data-stepper^="t_"]').forEach((b) => { values.targets[b.dataset.stepper.slice(2)] = num(b.querySelector('input').value) ?? 0; });
          const d = num(view.querySelector('[name=distance]')?.value);
          if (d != null) values.distance = d;
          // the duration actually done, if they stopped early or went on
          const doneMin = Math.round(W.phaseSec(active) / 60);
          if (doneMin > 0) values.targets.duration = doneMin;
        } else {
          if (step.plan.seconds != null) values.seconds = stepVal(view, 'seconds');
          else values.reps = stepVal(view, 'reps');
          if (step.plan.weight != null) values.weight = stepVal(view, 'weight');
        }
        vibratedFor = null;
        commit(W.completeStep(active, values));
      });
      view.querySelector('[data-action=back]')?.addEventListener('click', () => { vibratedFor = null; commit(W.back(active)); });
      view.querySelector('[data-action=skip-set]')?.addEventListener('click', () => commit(W.skipStep(active)));
      view.querySelector('[data-action=viewer]')?.addEventListener('click', () => openViewer(ex));
      view.querySelector('[data-action=add30]')?.addEventListener('click', () => commit(W.addRest(active, 30)));
      view.querySelector('[data-action=end-rest]')?.addEventListener('click', () => commit(W.endRest(active)));
      keepAwake();
    },
    tick: liveTick,
  };
}

function setBody(step, ex) {
  const it = state.routines.find((x) => x.id === active.routineId)?.items?.[step.itemIndex] || {};
  const doneHere = active.log.filter((x) => x.exerciseId === step.exerciseId);
  const lastSet = doneHere[doneHere.length - 1];
  const prev = lastResult(it, ex, live('sessions'), active.start);
  const prevText = prev ? t('lastTimeWas', prevSummary(ex, prev.session)) : '';
  const m = machineOf(ex);
  const p = placeOf(ex);
  return `<main class="w-main">
      <div><h1 class="w-ex">${esc(ex.name)}</h1>
        <div class="w-setline"><span>${esc(t('setNofM', step.n, step.of))}</span><span class="dots" aria-hidden="true">${Array.from({ length: step.of }, (_, i) => `<i class="${i + 1 < step.n ? 'done' : i + 1 === step.n ? 'now' : ''}"></i>`).join('')}</span></div></div>
      <div class="w-grid2">
        ${step.plan.seconds != null
    ? `<div class="w-card stepcard">${stepper({ name: 'seconds', value: step.plan.seconds, step: 5, min: 0, label: t('seconds'), big: true })}</div>`
    : `<div class="w-card stepcard">${stepper({ name: 'reps', value: step.plan.reps, step: 1, min: 0, label: t('reps'), big: true })}</div>`}
        ${step.plan.weight != null ? `<div class="w-card stepcard">${stepper({ name: 'weight', value: step.plan.weight, step: ex.equipment === 'dumbbell' ? 1 : 2.5, min: 0, label: weightTexts(ex).label, big: true })}</div>` : ''}
      </div>
      ${step.plan.weight != null && weightMode(ex) !== 'plain' ? `<p class="w-small w-wthint" data-wt-hint>${esc(weightTexts(ex, step.plan.weight).hint)}</p>` : ''}
      ${step.plan.weight === 0 ? `<p class="w-small">${esc(t('weightFirstTime'))}</p>` : ''}
      ${machineCard(ex)}
      ${ex.notes ? `<section class="w-note" aria-label="${esc(t('notes'))}">${icon('pencil', 20)}<p>${esc(ex.notes)}</p></section>` : ''}
      <p class="w-small">${esc([lastSet ? t('setDone', lastSet.n, setText(ex, lastSet)) : '', prevText].filter(Boolean).join(' · '))}</p>
    </main>
    <div class="w-foot">
      <button type="button" class="btn yellow huge done-btn" data-action="done">${icon('check', 30)}${esc(t('doneSet'))}</button>
      <div class="w-minor">${W.canGoBack(active) ? `<button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t(active.phase === 'rest' && W.current(active)?.kind === 'set' ? 'backToSet' : 'prevStep'))}</button>` : ''}<button type="button" class="btn ghost-dark" data-action="skip-set">${esc(t('skipSet'))}</button></div>
    </div>`;
}

/** Machine number, zone and settings, with a small picture (your photo, or the exercise's) that opens full screen. */
function machineCard(ex) {
  const m = machineOf(ex);
  const p = placeOf(ex);
  const th = thumbOf(ex);
  if (!m && !p && !th) return '';
  return `<div class="w-card machine">${m || p ? `<span class="w-mnum">${esc(m?.number || '·')}</span><div><b>${esc(p?.name || m?.name || '')}</b><small>${esc(m?.settings || (m && p ? m.name : ''))}</small></div>` : '<div></div>'}
    ${th ? `<button type="button" class="w-thumb" data-action="viewer" aria-label="${esc(t('viewPicture'))}"><img src="${esc(th)}" alt=""></button>` : ''}</div>`;
}

function prevSummary(ex, s) {
  const sets = s.sets.filter((x) => x.exerciseId === ex.id);
  if (!sets.length) return '';
  if (ex.type === 'cardio') return setText(ex, sets[0]);
  const reps = sets[0].reps ?? `${sets[0].seconds} s`;
  return ex.type === 'weights' ? `${sets.length} × ${reps} · ${fmtNum(Math.max(...sets.map((x) => x.weight || 0)))} kg` : `${sets.length} × ${reps}`;
}

/** What the kg means for this exercise: the stepper's label and a line that does the sums (empty for plain kg). */
function weightTexts(ex, w) {
  const n = Number(w) || 0;
  const k = (x) => fmtNum(Math.round(x * 100) / 100);
  switch (weightMode(ex)) {
    case 'dbEach': return { label: t('wKgEach'), hint: n ? t('wHintEach', k(n), k(n * 2)) : '' };
    case 'dbOne': return { label: t('wKgOne'), hint: n ? t('wHintOne', k(n)) : '' };
    case 'dbTotal': return { label: t('wKgTotal'), hint: n ? t('wHintDbTotal', k(n / 2)) : '' };
    case 'barTotal': return { label: t('wKgBar'), hint: n > BAR_KG ? t('wHintBar', k((n - BAR_KG) / 2)) : '' };
    case 'barSide': return { label: t('wKgSide'), hint: n ? t('wHintSide', k(n * 2 + BAR_KG)) : '' };
    default: return { label: 'kg', hint: '' };
  }
}

// ---- looking at the exercises before and after (Anteprima) ----

/** The strips at the left and right edges: tap (or swipe, or the arrow keys) for the exercise before or after. */
function edges(n, at) {
  return `<button type="button" class="w-edge l" data-peek="-1" aria-label="${esc(t('peekPrev'))}" ${at <= 0 ? 'hidden' : ''}>${icon('back', 22)}</button>
    <button type="button" class="w-edge r" data-peek="1" aria-label="${esc(t('peekNext'))}" ${at >= n - 1 ? 'hidden' : ''}>${icon('chevron', 22)}</button>`;
}

function bindPeek(view, exIndexes, pos) {
  const move = (d) => {
    const from = peek ?? pos;
    const to = Math.max(0, Math.min(exIndexes.length - 1, from + d));
    if (to === from || W.isPaused(active)) return;
    peek = to === pos ? null : to;
    window.dispatchEvent(new CustomEvent('palestra:render'));
  };
  view.querySelectorAll('[data-peek]').forEach((b) => b.addEventListener('click', () => move(Number(b.dataset.peek))));
  const screen = view.querySelector('.w-screen');
  let sx = null; let sy = null;
  screen.addEventListener('pointerdown', (e) => { if (e.target.closest('input')) return; sx = e.clientX; sy = e.clientY; });
  screen.addEventListener('pointerup', (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx; const dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  });
  peekMove = move;
  view.querySelector('[data-action=peek-home]')?.addEventListener('click', () => { peek = null; window.dispatchEvent(new CustomEvent('palestra:render')); });
  view.querySelector('[data-action=do-now]')?.addEventListener('click', () => {
    const ix = exIndexes[peek];
    const ex = state.exercises.find((e) => e.id === active.steps.find((s) => s.itemIndex === ix)?.exerciseId);
    vibratedFor = null;
    commit(W.doNow(active, ix));
    if (ex) toast(t('nowDone', ex.name));
  });
  view.querySelector('[data-action=fix]')?.addEventListener('click', () => fixSets(exIndexes[peek]));
}

/** An exercise you're not at: dimmed, read-only, with the way back. */
function previewBody(ix, pos) {
  const steps = active.steps.filter((s) => s.itemIndex === ix);
  const ex = state.exercises.find((e) => e.id === steps[0]?.exerciseId);
  if (!ex) return '';
  const logged = active.log.map((x, i) => ({ ...x, i })).filter((x) => steps.some((s) => s.exerciseId === x.exerciseId && s.n === x.n));
  const firstAt = active.steps.findIndex((s) => s.itemIndex === ix);
  const behind = firstAt < active.idx || (firstAt === active.idx && active.phase === 'rest');
  const left = steps.filter((s) => !W.isLogged(active, s)).length;
  const p = steps[0].plan;
  const plan = steps[0].kind === 'cardio'
    ? [t('minutesN', fmtNum(Number(p.targets.duration) || 10))].join('')
    : `${steps.length} × ${p.seconds != null ? `${p.seconds} s` : p.reps}${p.weight ? ` · ${fmtNum(p.weight)} kg` : ''}`;
  const status = logged.length && !left ? t('pvDone') : logged.length ? t('pvPart', logged.length, steps.length) : behind ? t('pvSkipped') : t('pvAhead');
  const rows = logged.map((x) => `<div><span>${esc(steps[0].kind === 'cardio' ? t('pvDone') : t('setN', x.n))}</span><b>${esc(setText(ex, x))} <span class="ok">✓</span></b></div>`).join('');
  const wt = p.weight ? weightTexts(ex, p.weight).hint : '';
  return `<main class="w-main pv">
      <div class="pv-banner"><span>${esc(status)}</span><span>${esc(t('pvYouAre', pos + 1))}</span></div>
      <div class="pv-dim"><h1 class="w-ex">${esc(ex.name)}</h1>
        <p class="w-sub">${esc(whereText(ex) || '')}</p></div>
      ${rows ? `<div class="w-card pv-sets pv-dim">${rows}</div>` : ''}
      ${left ? `<div class="w-card pv-plan pv-dim"><span class="eyebrow">${esc(t('pvToDo'))}</span><b>${esc(left < steps.length ? `${t('pvLeft', left)} · ${plan}` : plan)}</b>${wt ? `<small>${esc(wt)}</small>` : ''}</div>` : ''}
      <div class="pv-dim">${machineCard(ex)}</div>
      ${ex.notes ? `<section class="w-note pv-dim">${icon('pencil', 20)}<p>${esc(ex.notes)}</p></section>` : ''}
    </main>
    <div class="w-foot">
      <button type="button" class="btn big pv-home" data-action="peek-home">${icon('back', 22)}${esc(t('pvBack', pos + 1))}</button>
      ${left ? `<button type="button" class="btn ghost-dark" data-action="do-now">${esc(t('pvNow'))}</button>` : ''}
      ${logged.length && steps[0].kind !== 'cardio' ? `<button type="button" class="btn ghost-dark" data-action="fix">${esc(t('pvFix'))}</button>` : ''}
    </div>`;
}

/** Correggi i numeri: the sets of an exercise already in the log, with − and +. */
async function fixSets(ix) {
  const steps = active.steps.filter((s) => s.itemIndex === ix);
  const ex = state.exercises.find((e) => e.id === steps[0]?.exerciseId);
  const logged = active.log.map((x, i) => ({ ...x, i })).filter((x) => steps.some((s) => s.exerciseId === x.exerciseId && s.n === x.n));
  if (!ex || !logged.length) return;
  const html = `<h2>${esc(t('pvFix'))}</h2><p class="muted">${esc(ex.name)}</p>
    ${logged.map((x) => `<div class="fix-row"><b>${esc(t('setN', x.n))}</b><div class="two">
      ${x.seconds != null ? stepper({ name: `s${x.i}`, value: x.seconds, step: 5, label: t('seconds') }) : stepper({ name: `r${x.i}`, value: x.reps, step: 1, label: t('reps') })}
      ${x.weight != null ? stepper({ name: `w${x.i}`, value: x.weight, step: ex.equipment === 'dumbbell' ? 1 : 2.5, label: weightTexts(ex).label }) : ''}</div></div>`).join('')}
    <div class="button-row"><button class="btn primary" value="ok">${esc(t('save'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  const edits = await openSheet(html, (form, close) => {
    bindSteppers(form);
    form.querySelector('[value=ok]').addEventListener('click', () => close(logged.map((x) => ({
      i: x.i, reps: x.reps != null ? stepVal(form, `r${x.i}`) : null, seconds: x.seconds != null ? stepVal(form, `s${x.i}`) : null, weight: x.weight != null ? stepVal(form, `w${x.i}`) : null,
    }))));
  });
  if (!edits) return;
  const keep = peek;
  await commit(W.editLog(active, edits));
  peek = keep;
  window.dispatchEvent(new CustomEvent('palestra:render'));
  toast(t('fixSaved'));
}

function cardioBody(step, ex) {
  const ms = measuresFor(ex, machineOf(ex));
  const dur = Number(step.plan.targets.duration) || 10;
  const sec = W.phaseSec(active);
  const left = dur * 60 - sec;
  return `<main class="w-main">
      <div><h1 class="w-ex">${esc(ex.name)}</h1><p class="w-sub">${esc([t('minutesN', fmtNum(dur)), whereText(ex)].filter(Boolean).join(' · '))}</p></div>
      <div class="w-card timer-card" role="timer">
        <span class="eyebrow" data-live="cardio-label">${esc(left >= 0 ? t('timeLeft') : t('overTime'))}</span>
        <span class="w-bigclock" data-live="cardio-left">${left >= 0 ? clock(left) : `+${clock(-left)}`}</span>
        <div class="w-bar" aria-hidden="true"><span data-live="cardio-bar" style="width:${Math.min(100, (sec / (dur * 60)) * 100).toFixed(1)}%"></span></div>
      </div>
      <div class="w-grid2">${ms.filter((m) => m.key !== 'duration').map((m) => `<div class="w-card stepcard">${stepper({ name: `t_${m.key}`, value: step.plan.targets[m.key] ?? 0, step: m.step, min: 0, unit: m.unit, label: measureLabel(m), big: true })}</div>`).join('')}</div>
      ${thumbOf(ex) ? machineCard(ex) : ''}
      <label class="w-card w-field"><span>${esc(t('distanceFromDisplay'))} <small>${esc(t('optionalOne'))}</small></span><input name="distance" inputmode="decimal" placeholder="— km" autocomplete="off"></label>
      ${ex.notes ? `<section class="w-note">${icon('pencil', 20)}<p>${esc(ex.notes)}</p></section>` : ''}
    </main>
    <div class="w-foot row2"><button type="button" class="btn ghost-dark fill" data-action="pause">${esc(t('pause'))}</button><button type="button" class="btn yellow huge" data-action="done">${esc(t('finishCardio'))}</button></div>
    ${W.canGoBack(active) ? `<div class="w-minor">${W.canGoBack(active) ? `<button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t(active.phase === 'rest' && W.current(active)?.kind === 'set' ? 'backToSet' : 'prevStep'))}</button>` : ''}</div>` : ''}`;
}

function restBody() {
  const left = W.restLeft(active);
  const nxt = W.current({ ...active, idx: active.idx + 1 }) ;
  const nex = nxt && state.exercises.find((e) => e.id === nxt.exerciseId);
  const after = active.steps.slice(active.idx + 1).find((s) => s.itemIndex !== nxt?.itemIndex);
  const aex = after && state.exercises.find((e) => e.id === after.exerciseId);
  const C = 691.15;
  const frac = left > 0 ? left / active.restPlanned : 0;
  const nextText = nxt && nex ? (nxt.kind === 'cardio' ? nex.name : `${nex.name} · ${t('setNofM', nxt.n, nxt.of)}`) : '';
  const nextAmount = nxt && nxt.kind === 'set' ? `${nxt.plan.reps ?? `${nxt.plan.seconds} s`}${nxt.plan.weight ? ` × ${fmtNum(nxt.plan.weight)}` : ''}` : '';
  const sameMachine = nxt && active.restKind === 'set';
  return `<main class="w-main center">
      <span class="eyebrow">${esc(active.restKind === 'between' ? t('restAndMove') : t('rest'))}</span>
      <div class="ring">
        <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true"><circle cx="130" cy="130" r="110" class="ring-bg"/><circle cx="130" cy="130" r="110" class="ring-fg${left <= 0 ? ' over' : ''}" data-live="ring" stroke-dasharray="${(C * frac).toFixed(1)} 700" transform="rotate(-90 130 130)"/></svg>
        <div class="ring-text" role="timer"><span class="w-bigclock" data-live="rest-left">${left >= 0 ? clock(left) : `+${clock(-left)}`}</span><small>${esc(t('ofPlanned', clock(active.restPlanned)))}</small></div>
      </div>
      <p class="w-text">${esc(t('youRested'))} <b data-live="rested">${clock(W.phaseSec(active))}</b></p>
      <div class="w-grid2 wide"><button type="button" class="btn dark-btn big" data-action="add30">+30 s</button><button type="button" class="btn ${left <= 0 ? 'yellow' : 'light'} big" data-action="end-rest" data-live="end-rest">${esc(left <= 0 ? t('restEnd') : t('skip'))}</button></div>
      ${W.canGoBack(active) ? `<button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t(active.phase === 'rest' && W.current(active)?.kind === 'set' ? 'backToSet' : 'prevStep'))}</button>` : ''}
    </main>
    ${nxt && nex ? `<section class="w-card next" aria-label="${esc(t('next'))}">
      <span class="eyebrow">${esc(t('next'))}</span>
      <div class="next-row"><div><b>${esc(nextText)}</b><small>${esc(sameMachine ? t('sameMachine', machineOf(nex)?.number || '') : whereText(nex) || '')}</small></div>${nextAmount ? `<span class="w-num">${esc(nextAmount)}</span>` : ''}</div>
      ${aex && sameMachine ? `<div class="next-after">${icon('arrowRight', 16)}${esc(t('thenEx', aex.name, whereText(aex)))}</div>` : ''}
    </section>` : ''}`;
}

function pausedBody() {
  return `<main class="w-main center"><span class="eyebrow">${esc(t('paused'))}</span><p class="w-bigclock" data-live="paused">${clock((Date.now() - active.pausedAt) / 1000)}</p>
    <p class="w-text">${esc(t('pausedText'))}</p></main>
    <div class="w-foot"><button type="button" class="btn yellow huge" data-action="resume">${icon('play', 22)}${esc(t('resume'))}</button></div>`;
}

/** Update the clocks without redrawing the page (so a field being typed in isn't disturbed). */
function liveTick(view) {
  if (!active || summaryId) return;
  const set = (k, v) => { const el = view.querySelector(`[data-live="${k}"]`); if (el && el.textContent !== v) el.textContent = v; };
  set('elapsed', clock(W.elapsedSec(active)));
  if (W.isPaused(active)) { set('paused', clock((Date.now() - active.pausedAt) / 1000)); return; }
  if (active.phase === 'rest') {
    const left = W.restLeft(active);
    set('rest-left', left >= 0 ? clock(left) : `+${clock(-left)}`);
    set('rested', clock(W.phaseSec(active)));
    const ring = view.querySelector('[data-live=ring]');
    if (ring) {
      ring.setAttribute('stroke-dasharray', `${(691.15 * (left > 0 ? left / active.restPlanned : 0)).toFixed(1)} 700`);
      ring.classList.toggle('over', left <= 0);
    }
    // time's up: Salta becomes Fine (yellow)
    const endBtn = view.querySelector('[data-live=end-rest]');
    if (endBtn && left <= 0 && !endBtn.classList.contains('yellow')) {
      endBtn.classList.replace('light', 'yellow');
      endBtn.textContent = t('restEnd');
    }
    if (left <= 0 && vibratedFor !== `${active.idx}`) {
      vibratedFor = `${active.idx}`;
      if (training().vibrate && navigator.vibrate) navigator.vibrate([300, 120, 300]);
      if (training().sound) beep();
    }
  } else {
    const step = W.current(active);
    if (step && step.kind === 'cardio') {
      const dur = (Number(step.plan.targets.duration) || 10) * 60;
      const sec = W.phaseSec(active);
      const left = dur - sec;
      set('cardio-left', left >= 0 ? clock(left) : `+${clock(-left)}`);
      set('cardio-label', left >= 0 ? t('timeLeft') : t('overTime'));
      const bar = view.querySelector('[data-live=cardio-bar]');
      if (bar) bar.style.width = `${Math.min(100, (sec / dur) * 100).toFixed(1)}%`;
      if (left <= 0 && vibratedFor !== `c${active.idx}`) {
        vibratedFor = `c${active.idx}`;
        if (training().vibrate && navigator.vibrate) navigator.vibrate([300, 120, 300]);
      }
    }
  }
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch { /* no audio */ }
}

async function keepAwake() {
  if (!training().wake || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}

export function releaseWake() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

async function endEarly() {
  if (!active) return;
  if (!active.log.length) {
    if (!(await askConfirm({ text: t('endNothingQ'), ok: t('endWorkout'), danger: true }))) return;
    await W.saveActive(null);
    const rid = active.routineId;
    active = null;
    publishLive(null);
    releaseWake();
    location.hash = `#/routine/${encodeURIComponent(rid)}`;
    return;
  }
  if (!(await askConfirm({ text: t('endEarlyQ'), ok: t('endWorkout') }))) return;
  await finish(true);
}

/** Save the session and show the summary. */
async function finish(early) {
  if (!active) return;
  if (active.phase === 'rest') active = W.endRest(active);
  const session = W.toSession(active);
  if (early) session.outcome = active.log.length >= active.steps.length ? 'done' : 'partial';
  if (session.sets.length) {
    upsert('sessions', session);
    // a routine imported without weights: the first session sets them
    const r = get('routines', session.routineId);
    if (r) {
      let changed = false;
      const items = (r.items || []).map((it) => {
        const ex = get('exercises', it.exerciseId);
        if (!ex || ex.type !== 'weights' || Number(it.weight) > 0) return it;
        const used = Math.max(0, ...session.sets.filter((x) => x.exerciseId === ex.id).map((x) => Number(x.weight) || 0));
        if (!used) return it;
        changed = true;
        return { ...it, weight: used };
      });
      if (changed) upsert('routines', { ...r, items });
    }
  }
  await W.saveActive(null);
  active = null;
  releaseWake();
  summaryId = session.sets.length ? session.id : null;
  refreshEstimates();
  // the session goes up first, then live → null, so Everyday never sees neither
  if (session.sets.length) syncNow().finally(() => publishLive(null)); else publishLive(null);
  if (!summaryId) location.hash = '#/routines';
  else window.dispatchEvent(new CustomEvent('palestra:render'));
}

function summaryView() {
  const s = get('sessions', summaryId);
  if (!s) { summaryId = null; return { dark: true, html: '<div class="dark-page"></div>' }; }
  const r = state.routines.find((x) => x.id === s.routineId);
  const est = r ? routineMinutes(r) : null;
  const restsTaken = s.sets.reduce((a, x) => a + (x.restTaken || 0), 0);
  const restsPlanned = s.sets.reduce((a, x) => a + (x.restPlanned || 0), 0);
  const groups = [];
  for (const set of s.sets) {
    let g = groups[groups.length - 1];
    if (!g || g.exerciseId !== set.exerciseId) { g = { exerciseId: set.exerciseId, sets: [] }; groups.push(g); }
    g.sets.push(set);
  }
  const best = new Set(groups.filter((g) => isNewBest(g, s)).map((g) => g.exerciseId));
  const total = totalWeight(s, state.exercises);
  const html = `<div class="w-screen summary">
    <header class="w-intro"><span class="eyebrow yellow">${esc(t('workoutFinished'))}</span><h1 class="w-title">${esc(r?.name || t('workout'))}</h1>
      <p class="w-text">${esc(`${timeOfDay(s.start)} – ${timeOfDay(s.end)} · ${s.outcome === 'done' ? t('allSets') : t('partial')}`)}</p></header>
    <div class="w-grid2 stats">
      <div class="w-card stat"><span class="eyebrow">${esc(t('time'))}</span><b>${esc(minText(s.minutes))}</b>${est ? `<small>${esc(t('estimatedN', est))}</small>` : ''}</div>
      <div class="w-card stat"><span class="eyebrow">${esc(t('setsWord'))}</span><b>${s.sets.length}</b><small>${esc(t('nExercises', groups.length))}</small></div>
      ${total ? `<div class="w-card stat"><span class="eyebrow">${esc(t('totalWeight'))}</span><b>${esc(fmtNum(total))} kg</b><small>${esc(t('repsTimesKg'))}</small></div>` : ''}
      <div class="w-card stat"><span class="eyebrow">${esc(t('rests'))}</span><b>${esc(clock(restsTaken))}</b><small>${esc(t('restsBreakdown', clock(restsPlanned)))}</small></div>
    </div>
    ${breakdownBar(s.breakdown || {}, true)}
    <h2 class="eyebrow pad">${esc(t('perExercise'))}</h2>
    <div class="w-card list">${groups.map((g) => {
    const ex = state.exercises.find((e) => e.id === g.exerciseId);
    const reps = g.sets.map((x) => x.reps ?? (x.seconds != null ? `${x.seconds} s` : '')).filter((x) => x !== '');
    const sameReps = reps.every((x) => x === reps[0]);
    const txt = ex?.type === 'cardio' ? setText(ex, g.sets[0]) : `${g.sets.length} × ${sameReps ? reps[0] : reps.join('/')}${ex?.type === 'weights' ? ` · ${fmtNum(Math.max(...g.sets.map((x) => x.weight || 0)))}` : ''}`;
    return `<div class="sum-row"><span>${esc(ex?.name || '')}</span>${best.has(g.exerciseId) ? `<span class="badge best">${esc(t('newBest'))}</span>` : ''}<b>${esc(txt)}</b></div>`;
  }).join('')}</div>
    <p class="w-small with-icon">${icon('cloud', 16)}${esc(s.everydayBlockId ? t('savedEveryday') : t('savedLocal'))}</p>
    <div class="w-foot"><button type="button" class="btn light huge" data-action="close">${esc(t('close'))}</button></div>
  </div>`;
  return {
    dark: true,
    html,
    bind(view) {
      view.querySelector('[data-action=close]').addEventListener('click', () => { summaryId = null; location.hash = '#/history'; });
    },
  };
}

function isNewBest(g, s) {
  const ex = state.exercises.find((e) => e.id === g.exerciseId);
  if (!ex || ex.type !== 'weights') return false;
  const now = Math.max(...g.sets.map((x) => x.weight || 0));
  const before = live('sessions').filter((x) => x.id !== s.id && x.start < s.start)
    .flatMap((x) => (x.sets || []).filter((y) => y.exerciseId === ex.id).map((y) => y.weight || 0));
  return before.length > 0 && now > Math.max(...before);
}

export function leaveWorkoutScreens() { pendingStart = null; }
