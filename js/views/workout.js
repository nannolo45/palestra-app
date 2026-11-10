// Start workout mode: the weekly increase, the set, the rest timer, cardio, pause, and the summary.
// Dark, big, screen kept on, works offline. All timing comes from timestamps (see workout.js).
import { state, get, upsert, live, pref, setPref, uid } from '../store.js';
import { routineIn, routineGymId, alternatives, gyms, gymName, gymById, fitItem } from '../gyms.js';
import { t } from '../i18n.js';
import { esc, fmtNum, clock, num, timeOfDay, minText } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { stepper, bindSteppers, stepVal } from '../ui/parts.js';
import { askConfirm, toast, openSheet } from '../ui/dialogs.js';
import { machineOf, placeOf, whereText, measureLabel, training, increaseSettings, refreshEstimates, routineMinutes, bodyPrefs } from '../data.js';
import { increaseProposals, applyIncrease, measuresFor, totalWeight, lastResult, weightMode, BAR_KG, setsOf, setPlan, setsText, suggestWeight, defaultTargets, itemFromRows } from '../model.js';
import * as W from '../workout.js';
import { breakdownBar, setText } from './history.js';
import { syncNow } from '../sync.js';
import { playSound, unlockAudio, alarmOf } from '../sound.js';
import { thumbOf, openViewer } from './pictures.js';

let active = null; // the workout in progress
let summaryId = null; // the session just finished, shown until closed
let summaryDiff = null; // { routineId, rows, pick }: what was done differently from the scheda, for the summary
let pendingStart = null; // { routineId, blockId, proposals }
let unchecked = new Set();
let wakeLock = null;
let peek = null;
let peekMove = null; // the arrow keys, on a computer
let lastOutside = null; // the page to go to with Riduci
window.addEventListener('hashchange', (e) => { const h = new URL(e.newURL).hash; if (h && !/^#\/(workout|start|try)/.test(h)) lastOutside = h; });
document.addEventListener('keydown', (e) => {
  if (!peekMove || !document.querySelector('.w-screen') || e.target.closest?.('input, textarea, select, dialog')) return;
  if (e.key === 'ArrowLeft') peekMove(-1);
  if (e.key === 'ArrowRight') peekMove(1);
}); // the exercise being looked at (its place in the workout), when it isn't the one you're at

export async function initWorkout() {
  active = await W.loadActive();
  return active;
}
export const hasActive = () => Boolean(active && active.phase !== 'done' && !active.trial);
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
  if (active?.trial) { window.dispatchEvent(new CustomEvent('palestra:render')); return; }
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
    pendingStart = { routineId, blockId: query.block || null, props, gym: query.gym || null };
    unchecked = new Set();
  }
  if (pendingStart.ready) return readyView(r);
  const props = pendingStart.props;
  if (!props || (!props.proposals.length && !props.held.length)) {
    if (!pendingStart.starting) {
      pendingStart.starting = true;
      const blockId = pendingStart.blockId;
      setTimeout(() => {
        const cur = get('routines', routineId);
        if (props) upsert('routines', applyIncrease(cur, [], []));
        toReady(blockId);
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
        toReady(pendingStart.blockId);
      });
      view.querySelector('[data-action=skip]').addEventListener('click', () => {
        upsert('routines', applyIncrease(get('routines', routineId), [], []));
        toReady(pendingStart.blockId);
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
  if (s.kind === 'top') return t('heldTop', s.under, s.of, s.goal);
  return '';
}

function begin(routine, blockId) {
  const gym = pendingStart?.gym || routineGymId(routine);
  pendingStart = null;
  summaryId = null;
  const w = { ...W.newWorkout(routineIn(routine, gym), live('exercises'), { blockId, training: training(), sessions: live('sessions') }), gymId: gym };
  commit(w).then(() => { location.replace('#/workout'); });
}

/** After the question about the increase (or straight away): the "Pronto?" screen, or the countdown. */
function toReady(blockId) {
  pendingStart = { ...pendingStart, blockId, ready: true, until: Date.now() + (Number(training().countdown) || 15) * 1000 };
  window.dispatchEvent(new CustomEvent('palestra:render'));
  window.scrollTo(0, 0);
}

/** The whole scheda before the clock starts: length, sets, zones, the first exercise, and every exercise in order. */
function overviewList(r) {
  const items = (r.items || []).map((it) => ({ it, ex: get('exercises', it.exerciseId) })).filter((x) => x.ex);
  let prev = null;
  return items.map(({ it, ex }, i) => {
    const p = placeOf(ex);
    const walk = i > 0 && p && prev && p.id !== prev ? `<div class="ov-walk">${icon('arrowDown', 14)}${esc(p.name)}</div>` : '';
    if (p) prev = p.id;
    return `${walk}<div class="ov-row${i === 0 ? ' first' : ''}"><span class="ov-n">${i + 1}</span><span class="ov-t"><b>${esc(ex.name)}</b><small>${esc(whereText(ex) || '')}</small></span><span class="ov-p">${esc(planShort(it, ex))}</span></div>`;
  }).join('');
}

function planShort(it, ex) {
  if (ex.type === 'cardio') return t('minutesN', fmtNum(Number(it.targets?.duration) || 10));
  return setsText(it, ex.type === 'weights');
}

function readyView(r) {
  const items = (r.items || []).map((it) => ({ it, ex: get('exercises', it.exerciseId) })).filter((x) => x.ex);
  const first = items[0];
  const sets = items.reduce((a, x) => a + (x.ex.type === 'cardio' ? 1 : setsOf(x.it)), 0);
  const zones = new Set(items.map((x) => placeOf(x.ex)?.id).filter(Boolean)).size;
  const countdown = training().start === 'countdown';
  const th = first ? thumbOf(first.ex) : '';
  const firstCard = first ? `<div class="w-card ov-first">${th ? `<img src="${esc(th)}" alt="">` : `<span class="ov-ph">${icon('dumbbell', 26)}</span>`}<div><small>${esc(t(countdown ? 'firstUp' : 'startsWith'))}</small><b>${esc(`${first.ex.name} · ${planShort(first.it, first.ex)}`)}</b><small>${esc(whereText(first.ex) || '')}</small></div></div>` : '';
  const left = Math.max(0, Math.ceil((pendingStart.until - Date.now()) / 1000));
  const html = `<div class="w-screen">
    <header class="w-head"><a class="w-icon" href="#/routine/${encodeURIComponent(r.id)}" aria-label="${esc(t('cancel'))}">${icon('close')}</a>
      <div class="w-head-mid"><span class="w-small">${esc(countdown ? `${r.name} · ${t('nExercises', items.length)} · ${routineMinutes(r)} min` : t('readyQ'))}</span><span class="w-clock">${esc(countdown ? t('startsIn') : r.name)}</span></div><span></span></header>
    <main class="w-main">
      ${countdown ? `<div class="ov-count"><span class="w-bigclock" data-live="countdown">${clock(left)}</span><small>${esc(t('goToFirst'))}</small></div>${firstCard}
        <details class="w-card ov-all"><summary>${esc(t('wholeScheda'))}</summary><div class="ov-list">${overviewList(r)}</div></details>`
    : `<div class="w-grid3"><div class="w-card stat"><b>${routineMinutes(r)} min</b><small>${esc(t('estimated'))}</small></div><div class="w-card stat"><b>${sets}</b><small>${esc(t('setsWord'))}</small></div><div class="w-card stat"><b>${zones}</b><small>${esc(t('zonesWord'))}</small></div></div>
        ${firstCard}<div class="ov-list">${overviewList(r)}</div>`}
    </main>
    <div class="w-foot${countdown ? ' row2' : ''}">${countdown ? `<button type="button" class="btn ghost-dark fill" data-action="more15">+15 s</button><button type="button" class="btn yellow huge" data-action="go">${esc(t('startNow'))}</button>`
    : `<button type="button" class="btn yellow huge" data-action="go">${icon('play', 22)}${esc(t('start'))}</button>`}</div></div>`;
  const go = () => { const cur = get('routines', r.id); if (cur && pendingStart) begin(cur, pendingStart.blockId); };
  return {
    dark: true,
    html,
    bind(view) {
      view.querySelector('[data-action=go]').addEventListener('click', () => { unlockAudio(); go(); });
      view.querySelector('[data-action=more15]')?.addEventListener('click', () => { pendingStart.until += 15000; });
    },
    tick(view) {
      if (!countdown || !pendingStart?.ready) return;
      const l = Math.max(0, Math.ceil((pendingStart.until - Date.now()) / 1000));
      const el = view.querySelector('[data-live=countdown]');
      if (el) el.textContent = clock(l);
      if (l <= 0 && !pendingStart.going) { pendingStart.going = true; go(); }
    },
  };
}

/** #/try/<routineId>: the real workout screens, still: no clock, nothing saved. */
export function tryView(routineId, query = {}) {
  const r = get('routines', routineId);
  if (!r) return { html: `<div class="dark-page"><p>${esc(t('notFound'))}</p></div>`, dark: true };
  if (hasActive() && !active.trial) {
    return { dark: true, html: `<div class="dark-page center"><h1 class="w-title">${esc(t('workoutInProgress'))}</h1><p class="w-text">${esc(t('tryBusy'))}</p><a class="btn yellow big" href="#/workout">${esc(t('resume'))}</a></div>` };
  }
  summaryId = null;
  active = W.newWorkout(routineIn(r, query.gym || routineGymId(r)), live('exercises'), { training: training(), sessions: live('sessions'), trial: true });
  peek = null;
  setTimeout(() => location.replace('#/workout'), 0);
  return { dark: true, html: '<div class="dark-page"></div>' };
}

function exitTrial() {
  const rid = active?.routineId;
  active = null;
  peek = null;
  location.hash = rid ? `#/routine/${encodeURIComponent(rid)}` : '#/routines';
}

// ---- the workout screen ----

export function workoutView() {
  if (summaryId) return summaryView();
  if (!active) return { dark: true, html: `<div class="dark-page center"><p class="w-text">${esc(t('noWorkout'))}</p><a class="btn yellow" href="#/routines">${esc(t('tab_routines'))}</a></div>` };
  if (active.phase === 'done') { if (active.trial) { exitTrial(); return { dark: true, html: '<div class="dark-page"></div>' }; } finish(false); return { dark: true, html: '<div class="dark-page"></div>' }; }
  const trial = Boolean(active.trial);
  const r = state.routines.find((x) => x.id === active.routineId);
  const step = W.current(active);
  const ex = state.exercises.find((e) => e.id === step.exerciseId);
  const exIndexes = [...new Set(active.steps.map((s) => s.itemIndex))];
  const pos = exIndexes.indexOf(step.itemIndex);
  const paused = W.isPaused(active);
  if (peek != null && (peek === pos || peek < 0 || peek >= exIndexes.length || paused)) peek = null;
  const looking = peek != null;
  const head = `${trial ? `<div class="trial-strip"><span>${esc(t('trialStrip'))}</span><button type="button" data-action="exit-trial">${esc(t('exit'))}</button></div>` : ''}<header class="w-head">
      ${trial ? `<button type="button" class="w-icon" data-action="end" aria-label="${esc(t('endWorkout'))}">${icon('close')}</button>` : `<button type="button" class="w-icon" data-action="minimise" aria-label="${esc(t('minimise'))}" title="${esc(t('minimise'))}">${icon('chevronDown', 24)}</button>`}
      <div class="w-head-mid"><span class="w-small">${looking ? esc(t('pvPrefix')) : ''}${esc(t('exNofM', r?.name || '', (looking ? peek : pos) + 1, exIndexes.length))}</span><span class="w-clock" data-live="elapsed">${trial ? '—:—' : clock(W.elapsedSec(active))}</span></div>
      <span class="w-head-r">${trial ? '' : `<button type="button" class="w-icon" data-action="end" aria-label="${esc(t('endWorkout'))}" title="${esc(t('endWorkout'))}">${icon('close', 20)}</button>`}<button type="button" class="w-icon filled" data-action="pause" aria-label="${esc(paused ? t('resume') : t('pauseWorkout'))}">${icon(paused ? 'play' : 'pause', 18)}</button></span>
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
    html: `<div class="w-screen fit${looking ? ' peeking' : ''}">${head}${body}${paused ? '' : edges(exIndexes.length, looking ? peek : pos)}</div>`,
    bind(view) {
      bindSteppers(view, (name, v) => {
        if (name === 'weight') { const h = view.querySelector('[data-wt-hint]'); if (h) h.textContent = weightTexts(ex, v).hint; }
        if (name === 'reps' || name === 'seconds') showExtra(view, step, v);
      });
      bindPeek(view, exIndexes, pos);
      view.querySelectorAll('[data-action=pause]').forEach((b) => b.addEventListener('click', () => commit(paused ? W.resume(active) : W.pause(active))));
      view.querySelector('[data-action=end]').addEventListener('click', () => (active?.trial ? exitTrial() : endEarly()));
      view.querySelector('[data-action=exit-trial]')?.addEventListener('click', exitTrial);
      view.querySelector('[data-action=minimise]')?.addEventListener('click', () => { location.hash = lastOutside || '#/today'; });
      view.querySelector('[data-action=add-set]')?.addEventListener('click', () => commit(W.addSet(active)));
      view.querySelector('[data-action=undo-set]')?.addEventListener('click', () => commit(W.removeAddedSet(active)));
      view.querySelector('[data-action=add-ex]')?.addEventListener('click', pickExtraExercise);
      view.querySelector('[data-action=other]')?.addEventListener('click', () => pickOtherExercise(step, ex));
      view.querySelector('[data-action=use-sug]')?.addEventListener('click', (e) => {
        const box = view.querySelector('[data-stepper=weight] input');
        if (box) { box.value = fmtNum(Number(e.currentTarget.dataset.kg)); box.dispatchEvent(new Event('change')); }
        const h = view.querySelector('[data-wt-hint]'); if (h) h.textContent = weightTexts(ex, Number(e.currentTarget.dataset.kg)).hint;
        e.currentTarget.closest('.sug-chip')?.remove();
      });
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
        commit(W.completeStep(active, values));
      });
      view.querySelector('[data-action=back]')?.addEventListener('click', () => commit(W.back(active)));
      view.querySelector('[data-action=skip-set]')?.addEventListener('click', () => commit(W.skipStep(active)));
      view.querySelector('[data-action=viewer]')?.addEventListener('click', () => openViewer(ex));
      view.querySelectorAll('[data-action=note]').forEach((b) => b.addEventListener('click', () => b.classList.toggle('clamp')));
      view.querySelector('[data-action=add30]')?.addEventListener('click', () => commit(W.addRest(active, 30)));
      view.querySelector('[data-action=end-rest]')?.addEventListener('click', () => commit(W.endRest(active)));
      if (!active.trial) keepAwake();
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
  const planned = active.steps.filter((x) => x.itemIndex === step.itemIndex && !x.extra).length;
  const sug = step.plan.weight === 0 && !active.trial ? suggestWeight(ex, bodyPrefs()) : null;
  const range = step.plan.repsMax ? t('repsGoal', step.plan.repsMin, step.plan.repsMax) : '';
  const lastReps = step.plan.repsMax && prev ? prev.session.sets.filter((x) => x.exerciseId === ex.id).map((x) => x.reps).filter((x) => x != null) : [];
  return `<main class="w-main">
      <div>${step.swappedFrom ? `<span class="w-instead">${icon('swap', 14)}${esc(t('insteadOf', state.exercises.find((e) => e.id === step.swappedFrom)?.name || ''))}</span>` : ''}<h1 class="w-ex">${esc(ex.name)}${step.added != null ? `<span class="w-tag add">${esc(t('tagAdded'))}</span>` : ''}</h1>
        <div class="w-setline"><span>${esc(t('setNofM', step.n, step.of))}</span>${step.extra ? `<span class="w-tag">${esc(t('tagExtra'))}</span>` : ''}<span class="dots" aria-hidden="true">${Array.from({ length: step.of }, (_, i) => `<i class="${i + 1 < step.n ? 'done' : i + 1 === step.n ? 'now' : ''}${i >= planned && step.added == null ? ' extra' : ''}"></i>`).join('')}</span>${step.plan.failure ? `<span class="fail-tag">${esc(t('toFailure'))}</span>` : ''}</div>
        ${!active.trial && step.kind === 'set' && !active.log.some((x) => x.item === step.itemIndex) ? `<button type="button" class="w-other" data-action="other">${icon('swap', 16)}${esc(step.swappedFrom ? t('didAnotherAgain') : t('didAnother'))}</button>` : ''}
        ${step.plan.varied ? `<div class="w-planline">${active.steps.filter((x) => x.itemIndex === step.itemIndex).map((x) => `<span class="${x.n < step.n ? 'done' : x.n === step.n ? 'now' : ''}">${esc(`${x.plan.reps ?? `${x.plan.seconds} s`}${x.plan.weight ? ` × ${fmtNum(x.plan.weight)} kg` : ''}`)}</span>`).join('')}</div>` : ''}</div>
      <div class="w-grid2">
        ${step.plan.seconds != null
    ? `<div class="w-card stepcard">${stepper({ name: 'seconds', value: step.plan.seconds, step: 5, min: 0, label: t('seconds'), big: true })}<span class="w-extra" data-extra></span></div>`
    : `<div class="w-card stepcard">${stepper({ name: 'reps', value: step.plan.reps, step: 1, min: 0, label: t('reps'), big: true })}<span class="w-extra" data-extra></span></div>`}
        ${step.plan.weight != null ? `<div class="w-card stepcard">${stepper({ name: 'weight', value: step.plan.weight, step: ex.equipment === 'dumbbell' ? 1 : 2.5, min: 0, label: weightTexts(ex).label, big: true })}</div>` : ''}
      </div>
      ${step.plan.weight != null && weightMode(ex) !== 'plain' ? `<p class="w-small w-wthint" data-wt-hint>${esc(weightTexts(ex, step.plan.weight).hint)}</p>` : ''}
      ${range ? `<p class="w-small w-goal">${esc(range)}${step.plan.failure ? esc(t('untilFailure')) : ''}${lastReps.length ? ` · ${esc(t('lastTimeReps', lastReps.join(', ')))}` : ''}</p>` : ''}
      ${sug ? `<div class="sug-chip"><span>${esc(t('sugStart'))} <b>${esc(fmtNum(sug))} kg</b><small>${esc(t('sugFrom', bodyPrefs().kg))}</small></span><button type="button" class="btn small yellow" data-action="use-sug" data-kg="${sug}">${esc(t('use'))}</button></div>` : ''}
      ${step.plan.weight === 0 ? `<p class="w-small">${esc(t('weightFirstTime'))}${!bodyPrefs() && !active.trial ? ` <a href="#/settings/body">${esc(t('sugSetBody'))}</a>` : ''}</p>` : ''}
      ${step.extra ? `<p class="w-small">${esc(t('extraSetHint'))}</p>` : step.added != null ? `<p class="w-small">${esc(t('addedExHint'))}</p>` : ''}
      ${machineCard(ex)}
      ${ex.notes ? `<button type="button" class="w-note clamp" aria-label="${esc(t('notes'))}" data-action="note">${icon('pencil', 18)}<p>${esc(ex.notes)}</p></button>` : ''}
      <p class="w-small">${esc([lastSet ? t('setDone', lastSet.n, setText(ex, lastSet)) : '', prevText].filter(Boolean).join(' · '))}</p>
    </main>
    <div class="w-foot">
      <button type="button" class="btn yellow huge done-btn" data-action="done">${icon('check', 30)}${esc(t('doneSet'))}</button>
      <div class="w-minor">${W.canGoBack(active) ? `<button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t(active.phase === 'rest' && W.current(active)?.kind === 'set' ? 'backToSet' : 'prevStep'))}</button>` : ''}<button type="button" class="btn ghost-dark" data-action="skip-set">${esc(t('skipSet'))}</button></div>
    </div>`;
}

/** "+1" next to the reps when you do more than the scheda (less shows too). */
function showExtra(view, step, v) {
  const el = view.querySelector('[data-extra]');
  if (!el || step.plan.repsMax) return;
  const plan = step.plan.seconds != null ? step.plan.seconds : step.plan.reps;
  const d = (Number(v) || 0) - (Number(plan) || 0);
  el.textContent = d > 0 ? t(step.plan.seconds != null ? 'moreSecs' : 'moreReps', d) : d < 0 ? t(step.plan.seconds != null ? 'lessSecs' : 'lessReps', -d) : '';
  el.classList.toggle('up', d > 0);
}

/** + Un esercizio: one of yours, right after; it starts from last time's numbers. */
async function pickExtraExercise() {
  const list = live('exercises').sort((a, b) => String(a.name).localeCompare(b.name));
  const html = `<h2>${esc(t('addExTitle'))}</h2>
    <label class="search">${icon('search', 18)}<span class="sr">${esc(t('searchExercises'))}</span><input id="ax-q" type="search" placeholder="${esc(t('searchExercises'))}" autocomplete="off"></label>
    <div class="pick-list" data-list>${list.map((e) => `<button type="button" class="row pick" data-pick="${esc(e.id)}"><span class="row-text"><span class="row-title">${esc(e.name)}</span><span class="row-sub">${esc(whereText(e) || '')}</span></span></button>`).join('')}</div>
    <p class="muted small">${esc(t('addExHint'))}</p>
    <div class="button-row"><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  const id = await openSheet(html, (form, close) => {
    form.querySelector('#ax-q').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      form.querySelectorAll('[data-pick]').forEach((b) => { b.hidden = q && !b.textContent.toLowerCase().includes(q); });
    });
    form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => close(b.dataset.pick)));
  });
  if (!id || !active) return;
  const ex = get('exercises', id);
  const lastS = [...live('sessions')].filter((x) => x.end && (x.sets || []).some((y) => y.exerciseId === id)).sort((a, b) => b.start - a.start)[0];
  const lastSet = lastS?.sets.find((y) => y.exerciseId === id);
  const plan = ex.type === 'cardio'
    ? { targets: lastSet?.targets || { ...defaultTargets(ex.cardio?.kind || 'treadmill', machineOf(ex)), ...(ex.cardio?.targets || {}) } }
    : { reps: lastSet?.reps ?? (ex.timed ? null : 10), seconds: lastSet?.seconds ?? (ex.timed ? 45 : null), weight: lastSet?.weight ?? suggestWeight(ex, bodyPrefs()) ?? 0, rest: ex.defaultRest };
  commit(W.addExercise(active, ex, plan));
  toast(t('addedEx', ex.name));
}

/** "Ho fatto un altro esercizio": the scheda's alternative first, then the same muscles, then any of yours. */
async function pickOtherExercise(step, ex) {
  const r = state.routines.find((x) => x.id === active.routineId);
  const it = r?.items?.[step.itemIndex] || {};
  const orig = step.swappedFrom ? state.exercises.find((e) => e.id === step.swappedFrom) : ex;
  const gid = active.gymId || routineGymId(r);
  const sugg = [];
  const alt = it.alternative && get('exercises', it.alternative);
  if (alt && alt.id !== ex.id) sugg.push({ ex: alt, why: t('schedaAlternative') });
  for (const a of alternatives(orig, gid, 4)) {
    const n = a.ex ? a.ex.name : a.builtin.name;
    if (sugg.some((x) => (x.ex ? x.ex.name : x.builtin.name) === n) || (a.ex && a.ex.id === ex.id)) continue;
    sugg.push({ ...a, why: t('sameMuscles') });
  }
  const mine = live('exercises').filter((e) => e.type !== 'cardio' && e.id !== ex.id).sort((a, b) => String(a.name).localeCompare(b.name));
  const lastOf = (id) => { const s = [...live('sessions')].filter((x) => x.end && (x.sets || []).some((y) => y.exerciseId === id)).sort((a, b) => b.start - a.start)[0]; return s ? s.sets.filter((y) => y.exerciseId === id) : null; };
  const lastText = (e) => { const l = lastOf(e.id); return l ? t('lastTimeShort', `${l.length} × ${l[0].reps ?? `${l[0].seconds} s`}${l[0].weight ? ` · ${fmtNum(Math.max(...l.map((y) => y.weight || 0)))} kg` : ''}`) : ''; };
  const html = `<h2>${esc(t('whatDidYouDo'))}</h2><p class="muted small">${esc(t('insteadOf', orig?.name || ''))}</p>
    <div class="pick-list">${sugg.slice(0, 4).map((x, i) => { const e = x.ex; const n = e ? e.name : x.builtin.name; return `<button type="button" class="row pick" data-sug="${i}"><span class="row-text"><span class="row-title">${esc(n)}${i === 0 ? ` <span class="badge-mini">${esc(t('suggested'))}</span>` : ''}</span><span class="row-sub">${esc([x.why, e ? lastText(e) : t('newForYou')].filter(Boolean).join(' · '))}</span></span></button>`; }).join('')}</div>
    <label class="search">${icon('search', 18)}<span class="sr">${esc(t('searchExercises'))}</span><input id="ox-q" type="search" placeholder="${esc(t('searchAllYours'))}" autocomplete="off"></label>
    <div class="pick-list" data-list hidden>${mine.map((e) => `<button type="button" class="row pick" data-pick="${esc(e.id)}"><span class="row-text"><span class="row-title">${esc(e.name)}</span><span class="row-sub">${esc(lastText(e) || whereText(e) || '')}</span></span></button>`).join('')}</div>
    <div class="button-row"><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  const got = await openSheet(html, (form, close) => {
    const list = form.querySelector('[data-list]');
    form.querySelector('#ox-q').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      list.hidden = !q;
      list.querySelectorAll('[data-pick]').forEach((b) => { b.hidden = q && !b.textContent.toLowerCase().includes(q); });
    });
    form.querySelectorAll('[data-sug]').forEach((b) => b.addEventListener('click', () => close({ sug: Number(b.dataset.sug) })));
    form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => close({ id: b.dataset.pick })));
  });
  if (!got || !active) return;
  let other = got.id ? get('exercises', got.id) : sugg[got.sug]?.ex;
  if (!other && got.sug != null) {
    const b = sugg[got.sug].builtin;
    other = live('exercises').find((e) => e.name.toLowerCase() === b.name.toLowerCase())
      || upsert('exercises', { id: uid(), name: b.name, type: b.type, ...(b.equipment ? { equipment: b.equipment } : {}), muscles: b.muscles.slice(), defaultRest: training().rest, notes: '', increase: { mode: 'type' } });
  }
  if (!other) return;
  const l = lastOf(other.id);
  const plan = l ? { reps: l[0].reps, seconds: l[0].seconds, weight: Math.max(...l.map((y) => y.weight || 0)) } : { weight: other.type === 'weights' ? suggestWeight(other, bodyPrefs()) ?? 0 : null, ...(other.timed ? { seconds: 45 } : {}) };
  commit(W.swapExercise(active, step.itemIndex, other, plan));
  toast(t('nowDoing', other.name));
}

/** The question after an exercise's last set: another set, or another exercise. */
function moreCard() {
  const s = W.current(active);
  const nx = active.steps[active.idx + 1];
  if (nx && nx.extra && !W.isLogged(active, nx)) return `<p class="w-small center-text">${esc(t('extraAdded'))} <button type="button" class="link-btn" data-action="undo-set">${esc(t('removeIt'))}</button></p>`;
  if (!W.afterLastSet(active)) return '';
  const ex = state.exercises.find((e) => e.id === s.exerciseId);
  return `<div class="w-card more-q"><p>${t('moreQshort', `<b>${esc(ex?.name || '')}</b>`)}</p><button type="button" class="btn yellow small" data-action="add-set">+ ${esc(t('setWord'))}</button><button type="button" class="btn dark-btn small" data-action="add-ex">+ ${esc(t('exWord'))}</button></div>`;
}

/** After the very last set: add something, or finish. */
function endBody() {
  return `<main class="w-main center">
      <span class="eyebrow">${esc(t('lastSetDone'))}</span>
      <h2 class="w-title">${esc(t('allDoneQ'))}</h2>
      ${moreCard()}
    </main>
    <div class="w-foot"><button type="button" class="btn yellow huge" data-action="end-rest">${icon('check', 26)}${esc(active.trial ? t('endTrial') : t('finishWorkout'))}</button>
      ${W.canGoBack(active) ? `<button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t('backToSet'))}</button>` : ''}</div>`;
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
  const sec = active.trial ? 0 : W.phaseSec(active);
  const left = dur * 60 - sec;
  return `<main class="w-main cardio">
      <div><h1 class="w-ex">${esc(ex.name)}</h1><p class="w-sub">${esc([t('minutesN', fmtNum(dur)), whereText(ex)].filter(Boolean).join(' · '))}</p></div>
      <div class="w-card timer-card" role="timer">
        <span class="eyebrow" data-live="cardio-label">${esc(left >= 0 ? t('timeLeft') : t('overTime'))}</span>
        <span class="w-bigclock" data-live="cardio-left">${left >= 0 ? clock(left) : `+${clock(-left)}`}</span>
        <div class="w-bar" aria-hidden="true"><span data-live="cardio-bar" style="width:${Math.min(100, (sec / (dur * 60)) * 100).toFixed(1)}%"></span></div>
      </div>
      <div class="w-grid2">${ms.filter((m) => m.key !== 'duration').map((m) => `<div class="w-card stepcard">${stepper({ name: `t_${m.key}`, value: step.plan.targets[m.key] ?? 0, step: m.step, min: 0, unit: m.unit, label: measureLabel(m), big: true })}</div>`).join('')}</div>
      ${thumbOf(ex) ? machineCard(ex) : ''}
      ${active.trial ? '' : `<label class="w-card w-field"><span>${esc(t('distanceFromDisplay'))} <small>${esc(t('optionalOne'))}</small></span><input name="distance" inputmode="decimal" placeholder="— km" autocomplete="off"></label>`}
      ${ex.notes ? `<button type="button" class="w-note clamp" data-action="note">${icon('pencil', 18)}<p>${esc(ex.notes)}</p></button>` : ''}
    </main>
    <div class="w-foot"><div class="row2"><button type="button" class="btn ghost-dark fill" data-action="pause">${esc(t('pause'))}</button><button type="button" class="btn yellow huge" data-action="done">${esc(t('finishCardio'))}</button></div>
    ${W.canGoBack(active) ? `<div class="w-minor"><button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t('prevStep'))}</button></div>` : ''}</div>`;
}

function restBody() {
  if (active.restKind === 'end') return endBody();
  const trial = Boolean(active.trial);
  const left = trial ? active.restPlanned : W.restLeft(active);
  const nxt = W.current({ ...active, idx: active.idx + 1 }) ;
  const nex = nxt && state.exercises.find((e) => e.id === nxt.exerciseId);
  const after = active.steps.slice(active.idx + 1).find((s) => s.itemIndex !== nxt?.itemIndex);
  const aex = after && state.exercises.find((e) => e.id === after.exerciseId);
  const C = 691.15;
  const frac = left > 0 ? left / active.restPlanned : 0;
  const nextText = nxt && nex ? (nxt.kind === 'cardio' ? nex.name : `${nex.name} · ${t('setNofM', nxt.n, nxt.of)}${nxt.extra ? ` · ${t('tagExtra')}` : nxt.added != null ? ` · ${t('tagAdded')}` : ''}`) : '';
  const nextAmount = nxt && nxt.kind === 'set' ? `${nxt.plan.reps ?? `${nxt.plan.seconds} s`}${nxt.plan.weight ? ` × ${fmtNum(nxt.plan.weight)}` : ''}` : '';
  const sameMachine = nxt && active.restKind === 'set';
  return `<main class="w-main center">
      <span class="eyebrow">${esc(active.restKind === 'between' ? t('restAndMove') : t('rest'))}</span>
      <div class="ring">
        <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true"><circle cx="130" cy="130" r="110" class="ring-bg"/><circle cx="130" cy="130" r="110" class="ring-fg${left <= 0 ? ' over' : ''}" data-live="ring" stroke-dasharray="${(C * frac).toFixed(1)} 700" transform="rotate(-90 130 130)"/></svg>
        <div class="ring-text" role="timer"><span class="w-bigclock" data-live="rest-left">${left >= 0 ? clock(left) : `+${clock(-left)}`}</span><small>${esc(t('ofPlanned', clock(active.restPlanned)))}</small></div>
      </div>
      ${trial ? `<p class="w-text">${esc(t('trialRest'))}</p>` : `<p class="w-text">${esc(t('youRested'))} <b data-live="rested">${clock(W.phaseSec(active))}</b></p>`}
      ${moreCard()}
    </main>
    <div class="w-foot rest-foot">
      ${trial ? `<button type="button" class="btn light big wide" data-action="end-rest">${esc(t('forward'))}</button>`
    : `<div class="w-grid2 wide"><button type="button" class="btn dark-btn big" data-action="add30">+30 s</button><button type="button" class="btn ${left <= 0 ? 'yellow' : 'light'} big" data-action="end-rest" data-live="end-rest">${esc(left <= 0 ? t('restEnd') : t('skip'))}</button></div>`}
      ${nxt && nex ? `<section class="w-card next" aria-label="${esc(t('next'))}">
        <div class="next-row"><div><span class="eyebrow">${esc(t('next'))}</span><b>${esc(nextText)}</b><small>${esc(sameMachine ? t('sameMachine', machineOf(nex)?.number || '') : whereText(nex) || '')}${aex && sameMachine ? ` · ${esc(t('thenEx', aex.name, ''))}` : ''}</small></div>${nextAmount ? `<span class="w-num">${esc(nextAmount)}</span>` : ''}</div>
      </section>` : ''}
      ${W.canGoBack(active) ? `<div class="w-minor"><button type="button" class="btn ghost-dark" data-action="back">${icon('back', 18)}${esc(t(active.phase === 'rest' && W.current(active)?.kind === 'set' ? 'backToSet' : 'prevStep'))}</button></div>` : ''}
    </div>`;
}

function pausedBody() {
  return `<main class="w-main center"><span class="eyebrow">${esc(t('paused'))}</span><p class="w-bigclock" data-live="paused">${clock((Date.now() - active.pausedAt) / 1000)}</p>
    <p class="w-text">${esc(t('pausedText'))}</p></main>
    <div class="w-foot"><button type="button" class="btn yellow huge" data-action="resume">${icon('play', 22)}${esc(t('resume'))}</button></div>`;
}

/** Update the clocks without redrawing the page (so a field being typed in isn't disturbed). */
function liveTick(view) {
  if (!active || summaryId || active.trial) return;
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
    restAlarm(left);
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
      cardioAlarm(left);
    }
  }
}

/** The end of a cardio exercise (v30): the same tick, alarm and second alarm as the end of a rest. */
function cardioAlarm(left) {
  ring(`c${active.idx}/${active.phaseStart}`, left);
}

/** The end of a rest: a tick in the last 3 seconds, the alarm at zero, once more 30 s later if nothing was tapped. */
let alarmed = new Set();
function restAlarm(left) {
  ring(`${active.idx}/${active.restPlanned}/${active.phaseStart}`, left);
}

/** Only on the way through: coming back to the app long after zero doesn't ring everything at once. */
function ring(key, left) {
  const tr = training();
  const kind = alarmOf(tr);
  const s = Math.ceil(left);
  const buzz = () => { if (tr.vibrate && navigator.vibrate) navigator.vibrate([300, 120, 300]); };
  if (tr.tick !== false && s >= 1 && s <= 3 && !alarmed.has(`${key}t${s}`)) { alarmed.add(`${key}t${s}`); playSound('tick', tr.volume); }
  if (left <= 0 && !alarmed.has(`${key}a`)) {
    alarmed.add(`${key}a`);
    if (left > -10) { buzz(); playSound(kind, tr.volume); }
  }
  if (left <= -30 && tr.alarmAgain !== false && !alarmed.has(`${key}b`)) {
    alarmed.add(`${key}b`);
    if (left > -40) { buzz(); playSound(kind, tr.volume); }
  }
  if (alarmed.size > 200) alarmed = new Set([...alarmed].slice(-50));
}

/**
 * Riduci (v27): the workout goes on while you look around the app. A bar above the sections shows it, with the rest
 * counting down; when the rest ends it turns yellow and the alarm sounds, as on the workout screen.
 */
export function miniBar() {
  if (!hasActive() || W.isPaused(active)) return hasActive() ? `<a class="live-bar" href="#/workout" data-live-bar><span class="dot paused"></span><span class="tx"><b>${esc(state.routines.find((x) => x.id === active.routineId)?.name || '')}</b><small>${esc(t('paused'))}</small></span><span class="go">${esc(t('backThere'))}</span></a>` : '';
  const r = state.routines.find((x) => x.id === active.routineId);
  const step = W.current(active);
  const ex = step && state.exercises.find((e) => e.id === step.exerciseId);
  const resting = active.phase === 'rest' && active.restKind !== 'end';
  const left = resting ? W.restLeft(active) : 0;
  const nxt = resting ? W.current({ ...active, idx: active.idx + 1 }) : step;
  const nex = nxt && state.exercises.find((e) => e.id === nxt.exerciseId);
  const what = nex ? (nxt.kind === 'cardio' ? nex.name : `${nex.name} · ${t('setNofM', nxt.n, nxt.of)}`) : '';
  const ding = resting && left <= 0;
  return `<a class="live-bar${ding ? ' ding' : ''}" href="#/workout" data-live-bar>
    <span class="dot"></span>
    <span class="tx"><b data-lb="title">${esc(ding ? t('restOverNext', what) : r?.name || '')}</b><small data-lb="sub">${esc(resting ? (ding ? t('overBy', clock(-left)) : `${t('rest')} · ${what}`) : active.phase === 'rest' ? t('lastSetDone') : what)}</small></span>
    ${resting && !ding ? `<span class="t" data-lb="left">${clock(left)}</span>` : ''}
    <span class="go">${esc(t('backThere'))} ›</span></a>`;
}
export function miniTick() {
  if (!hasActive()) return;
  const bar = document.querySelector('[data-live-bar]');
  if (!bar) return;
  if (active.phase === 'rest' && active.restKind !== 'end' && !W.isPaused(active)) {
    const left = W.restLeft(active);
    restAlarm(left);
    const ding = left <= 0;
    if (ding !== bar.classList.contains('ding') || ding) { const tmp = document.createElement('div'); tmp.innerHTML = miniBar(); bar.replaceWith(tmp.firstElementChild); return; }
    const el = bar.querySelector('[data-lb=left]');
    if (el) el.textContent = clock(left);
  } else if (active.phase !== 'rest' && !W.isPaused(active)) {
    const step = W.current(active);
    if (step?.kind === 'cardio') cardioAlarm((Number(step.plan.targets.duration) || 10) * 60 - W.phaseSec(active));
  }
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
  summaryDiff = null;
  if (session.sets.length) {
    upsert('sessions', session);
    // a routine imported without weights: the first session sets them, set by set
    const r = get('routines', session.routineId);
    if (r) {
      let changed = false;
      const items = (r.items || []).map((it, ix) => {
        const ex = get('exercises', it.exerciseId);
        if (!ex || ex.type !== 'weights' || Array.from({ length: setsOf(it) }, (_, i) => setPlan(it, i + 1).weight).some((w) => w > 0)) return it;
        const done = active.log.filter((x) => x.item === ix && x.exerciseId === it.exerciseId && x.weight > 0);
        if (!done.length) return it;
        changed = true;
        const rows = Array.from({ length: setsOf(it) }, (_, i) => { const p = setPlan(it, i + 1); const d = done.find((x) => x.n === i + 1) || done[done.length - 1]; return { ...(p.seconds != null ? { seconds: p.seconds } : { reps: p.reps }), weight: d.weight }; });
        return itemFromRows(it, rows);
      });
      const next = changed ? upsert('routines', { ...r, items }) : r;
      const rows = diffRows(active, next);
      if (rows.length) summaryDiff = { routineId: r.id, gymId: active.gymId || routineGymId(r), rows, pick: Object.fromEntries(rows.map((x) => [x.ix, x.def])) };
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

// ---- the summary: what was different from the scheda, and saving it there ----

const sameSet = (a, b, range) => Boolean(a && b) && (range || (a.reps ?? null) === (b.reps ?? null)) && (a.seconds ?? null) === (b.seconds ?? null) && (a.weight ?? null) === (b.weight ?? null);

/** Every exercise done differently from the scheda: extra or skipped sets, other reps or kg, exercises added. */
export function diffRows(w, r) {
  const items = r.items || [];
  const groups = new Map();
  for (const st of w.steps) { if (!groups.has(st.itemIndex)) groups.set(st.itemIndex, []); groups.get(st.itemIndex).push(st); }
  const out = [];
  for (const [ix, steps] of groups) {
    const first = steps[0];
    const ex = state.exercises.find((e) => e.id === first.exerciseId);
    if (!ex) continue;
    const added = first.added != null;
    if (!added && (!items[ix] || first.kind === 'cardio')) continue;
    const swapped = steps.find((x) => x.swappedFrom);
    if (!added && swapped && first.kind === 'set') {
      const done = steps.filter((x) => x.exerciseId === swapped.exerciseId).map((st) => { const e = w.log.find((x) => x.item === ix && x.n === st.n && x.exerciseId === st.exerciseId); return e ? { reps: e.reps ?? null, seconds: e.seconds ?? null, weight: ex.type === 'weights' || state.exercises.find((y) => y.id === swapped.exerciseId)?.type === 'weights' ? e.weight ?? 0 : null } : null; });
      if (done.some(Boolean)) out.push({ ix, exerciseId: swapped.exerciseId, swapFrom: items[ix].exerciseId, plan: [], done, def: 'oggi' });
      continue;
    }
    if (!added && items[ix].exerciseId !== first.exerciseId) continue; // a stand-in for this gym: the scheda stays as it is
    const logOf = (st) => w.log.find((x) => x.item === ix && x.n === st.n) || null;
    if (first.kind === 'cardio') {
      const e = logOf(first);
      if (e) out.push({ ix, exerciseId: ex.id, added: first.added, cardio: true, plan: [], done: [{ targets: e.targets }], def: 'fatto' });
      continue;
    }
    const it = items[ix];
    const W8 = ex.type === 'weights';
    const plan = added ? [] : Array.from({ length: setsOf(it) }, (_, i) => { const p = setPlan(it, i + 1); return { reps: p.reps, seconds: p.seconds, weight: W8 ? p.weight : null }; });
    const done = steps.map((st) => { const e = logOf(st); return e ? { reps: e.reps ?? null, seconds: e.seconds ?? null, weight: W8 ? e.weight ?? 0 : null } : null; });
    const range = !added && Boolean(setPlan(it, 1).repsMax);
    if (!added && done.length === plan.length && done.every((d, i) => sameSet(d, plan[i], range))) continue;
    if (!done.some(Boolean)) continue; // nothing of it done: skipped is for today
    const lower = done.some((d, i) => !d || (plan[i] && ((!range && (d.reps ?? d.seconds) < (plan[i].reps ?? plan[i].seconds)) || (d.weight ?? 0) < (plan[i].weight ?? 0))));
    out.push({ ix, exerciseId: ex.id, added: added ? first.added : null, range, plan, done, def: added || !lower ? 'fatto' : 'oggi' });
  }
  return out;
}

function diffOptions(row) {
  if (row.swapFrom) return gyms().length > 1 ? ['oggi', 'gym', 'swap'] : ['oggi', 'swap'];
  if (row.added != null) return ['oggi', 'fatto'];
  const did = row.done.filter(Boolean);
  const o = ['oggi', 'fatto'];
  const allSame = did.every((d) => sameSet(d, did[0], row.range));
  if (!allSame && !row.range) {
    const p0 = row.plan[0];
    const better = (a, b) => ((b.weight ?? 0) > (a.weight ?? 0) || ((b.weight ?? 0) === (a.weight ?? 0) && (b.reps ?? b.seconds) > (a.reps ?? a.seconds)) ? b : a);
    const best = did.reduce(better);
    const planEqual = row.plan.every((p) => sameSet(p, p0));
    if (planEqual && ((best.weight ?? 0) > (p0.weight ?? 0) || (best.reps ?? best.seconds) > (p0.reps ?? p0.seconds))) o.push('best');
    else o.push('last');
  }
  return o;
}

/** The rows the scheda would get for a choice. */
function chosenRows(row, choice) {
  const did = row.done.filter(Boolean);
  const keepReps = (d, i) => (row.range ? { ...d, reps: row.plan[Math.min(i, row.plan.length - 1)].reps } : d);
  if (choice === 'best') { const b = did.reduce((a, c) => ((c.weight ?? 0) > (a.weight ?? 0) || ((c.weight ?? 0) === (a.weight ?? 0) && (c.reps ?? c.seconds) > (a.reps ?? a.seconds)) ? c : a)); return did.map(() => ({ ...b })); }
  if (choice === 'last') { const l = did[did.length - 1]; return did.map(() => ({ ...l })); }
  return did.map(keepReps);
}

const clean = (x) => ({ ...(x.seconds != null ? { seconds: x.seconds } : { reps: x.reps }), ...(x.weight != null ? { weight: x.weight } : {}) });

function diffBecomes(row, choice, r) {
  const ex = state.exercises.find((e) => e.id === row.exerciseId);
  const it = r.items[row.ix];
  if (row.cardio) return choice === 'oggi' ? t('becomesNone') : t('becomesAdded', r.items[row.added] ? state.exercises.find((e) => e.id === r.items[row.added].exerciseId)?.name || '' : '', setText(ex, row.done[0]));
  if (row.added != null) {
    if (choice === 'oggi') return t('becomesNone');
    const after = state.exercises.find((e) => e.id === r.items[row.added]?.exerciseId)?.name || '';
    return t('becomesAdded', after, setsText(itemFromRows({}, chosenRows(row, choice).map(clean)), ex.type === 'weights'));
  }
  if (choice === 'oggi') return t('becomesStays', setsText(it, ex.type === 'weights'));
  return t('becomesNew', setsText(itemFromRows(it, chosenRows(row, choice).map(clean)), ex.type === 'weights'));
}

function chip(cls, txt) { return `<span class="chg ${cls}">${esc(txt)}</span>`; }

function diffCard(row, pick, r) {
  const ex = state.exercises.find((e) => e.id === row.exerciseId);
  if (row.swapFrom) {
    const from = state.exercises.find((e) => e.id === row.swapFrom);
    const did = row.done.filter(Boolean);
    const g = gymName(gymById(summaryDiff?.gymId));
    const what = { oggi: t('swapToday', from?.name || ''), gym: t('swapGym', g, ex?.name || '', from?.name || ''), swap: t('swapScheda', ex?.name || '') };
    return `<div class="w-card diff-card"><h3>${esc(from?.name || '')} <span class="arrow">→</span> ${esc(ex?.name || '')}</h3>
      <p class="w-small">${esc(`${t('nSets', did.length)} · ${did.map((d) => `${d.seconds != null ? `${d.seconds} s` : d.reps}${d.weight ? ` × ${fmtNum(d.weight)}` : ''}`).join(', ')}`)}</p>
      <div class="diff-choose" role="radiogroup">${diffOptions(row).map((k) => `<button type="button" class="${pick === k ? 'on' : ''}" aria-pressed="${pick === k}" data-pick="${row.ix}|${k}">${esc(k === 'oggi' ? t('onlyToday') : k === 'gym' ? t('onlyAt', g) : t('replaceInRoutine'))}</button>`).join('')}</div>
      <p class="w-small">${esc(what[pick] || '')}</p></div>`;
  }
  const n = Math.max(row.plan.length, row.done.length);
  const amt = (x) => (x ? `${x.seconds != null ? `${x.seconds} s` : x.reps}${x.weight != null ? ` × ${fmtNum(x.weight)}` : ''}` : '');
  let rows = '';
  if (row.cardio) rows = `<tr><td class="n">—</td><td class="p">—</td><td class="d"><b>${esc(setText(ex, row.done[0]))}</b>${chip('new', t('chipNew'))}</td></tr>`;
  else {
    for (let i = 0; i < n; i++) {
      const p = row.plan[i]; const d = row.done[i];
      let chips = '';
      if (!p) chips = chip('new', row.added != null ? t('chipNew') : t('tagExtra'));
      else if (d === null || d === undefined) chips = chip('skip', t('chipSkipped'));
      else {
        const pa = p.reps ?? p.seconds; const da = d.reps ?? d.seconds;
        if (!row.range && da !== pa) chips += chip(da > pa ? 'up' : 'dn', t(p.seconds != null ? 'chipSecs' : 'chipReps', `${da > pa ? '+' : '−'}${Math.abs(da - pa)}`));
        if ((d.weight ?? null) !== (p.weight ?? null)) chips += chip((d.weight ?? 0) > (p.weight ?? 0) ? 'up' : 'dn', `${(d.weight ?? 0) > (p.weight ?? 0) ? '+' : '−'}${fmtNum(Math.abs((d.weight ?? 0) - (p.weight ?? 0)))} kg`);
      }
      const same = p && d && sameSet(d, p, row.range);
      rows += `<tr class="${same ? 'same' : ''}${p && !d ? ' skipped' : ''}"><td class="n">${esc(t('setN', i + 1))}</td><td class="p">${esc(p ? amt(p) : '—')}</td><td class="d"><b>${esc(d ? amt(d) : amt(p))}</b>${chips}</td></tr>`;
    }
  }
  const opts = diffOptions(row);
  const did = row.done.filter(Boolean);
  const label = (k) => {
    if (k === 'oggi') return t('onlyToday');
    if (k === 'fatto') return row.added != null ? t('addToScheda') : t('asIDid');
    const x = chosenRows(row, k)[0];
    return t('allLike', amt(x));
  };
  void did;
  return `<div class="w-card diff-card"><h3>${esc(ex?.name || '')}${row.added != null ? `<span class="w-tag add">${esc(t('tagAdded'))}</span>` : ''}</h3>
    <table class="diff-t"><tr><th></th><th>${esc(t('colScheda'))}</th><th>${esc(t('colDone'))}</th></tr>${rows}</table>
    <div class="diff-choose" role="radiogroup">${opts.map((k) => `<button type="button" class="${pick === k ? 'on' : ''}" aria-pressed="${pick === k}" data-pick="${row.ix}|${k}">${esc(label(k))}</button>`).join('')}</div>
    <p class="w-small">${esc(diffBecomes(row, pick, r))}</p></div>`;
}

/** Write the chosen changes into the scheda: changed items in place, added exercises after the one they followed. */
function applyDiff() {
  const d = summaryDiff;
  const r = d && get('routines', d.routineId);
  if (!r) return 0;
  const items = r.items.map((x) => ({ ...x }));
  let n = 0;
  for (const row of d.rows) {
    const k = d.pick[row.ix];
    if (k === 'oggi' || row.added != null) continue;
    if (row.swapFrom) {
      const to = state.exercises.find((e) => e.id === row.exerciseId);
      if (k === 'gym') items[row.ix] = { ...items[row.ix], alt: { ...(items[row.ix].alt || {}), [d.gymId]: row.exerciseId } };
      else items[row.ix] = itemFromRows(fitItem(items[row.ix], state.exercises.find((e) => e.id === row.swapFrom), to), chosenRows(row, 'fatto').map(clean));
      n++;
      continue;
    }
    items[row.ix] = itemFromRows(items[row.ix], chosenRows(row, k).map(clean));
    n++;
  }
  // added exercises: after the item they followed, in the order they were done
  const adds = d.rows.filter((row) => row.added != null && d.pick[row.ix] !== 'oggi');
  const inserts = new Map();
  for (const row of adds) {
    const ex = state.exercises.find((e) => e.id === row.exerciseId);
    const base = { exerciseId: row.exerciseId, ...(ex?.type !== 'cardio' ? { rest: ex?.defaultRest ?? training().rest } : {}) };
    const item = row.cardio ? { exerciseId: row.exerciseId, targets: { ...(row.done[0].targets || {}) } } : itemFromRows(base, chosenRows(row, 'fatto').map(clean));
    if (!inserts.has(row.added)) inserts.set(row.added, []);
    inserts.get(row.added).push(item);
    n++;
  }
  const out = [];
  items.forEach((x, i) => { out.push(x); if (inserts.has(i)) out.push(...inserts.get(i)); });
  upsert('routines', { ...r, items: out });
  refreshEstimates();
  return n;
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
  const diff = summaryDiff && summaryDiff.routineId === s.routineId ? summaryDiff : null;
  const pending = diff ? diff.rows.filter((x) => diff.pick[x.ix] !== 'oggi').length : 0;
  const diffSection = (rr) => (diff && rr ? `<h2 class="eyebrow pad">${esc(t('diffTitle', diff.rows.length))}</h2>
    <div class="w-minor diff-all"><button type="button" class="btn ghost-dark" data-action="all-fatto">${esc(t('allAsIDid'))}</button><button type="button" class="btn ghost-dark" data-action="all-oggi">${esc(t('noneOnlyToday'))}</button></div>
    ${diff.rows.map((x) => diffCard(x, diff.pick[x.ix], rr)).join('')}` : '');
  const html = `<div class="w-screen summary">
    <header class="w-intro"><span class="eyebrow yellow">${esc(t('workoutFinished'))}</span><h1 class="w-title">${esc(r?.name || t('workout'))}</h1>
      <p class="w-text">${esc(`${timeOfDay(s.start)} – ${timeOfDay(s.end)} · ${s.outcome === 'done' ? t('allSets') : t('partial')}`)}</p></header>
    <div class="w-grid2 stats">
      <div class="w-card stat"><span class="eyebrow">${esc(t('time'))}</span><b>${esc(minText(s.minutes))}</b>${est ? `<small>${esc(t('estimatedN', est))}</small>` : ''}</div>
      <div class="w-card stat"><span class="eyebrow">${esc(t('setsWord'))}</span><b>${s.sets.length}</b><small>${esc(t('nExercises', groups.length))}</small></div>
      ${total ? `<div class="w-card stat"><span class="eyebrow">${esc(t('totalWeight'))}</span><b>${esc(fmtNum(total))} kg</b><small>${esc(t('repsTimesKg'))}</small></div>` : ''}
      <div class="w-card stat"><span class="eyebrow">${esc(t('rests'))}</span><b>${esc(clock(restsTaken))}</b><small>${esc(t('restsBreakdown', clock(restsPlanned)))}</small></div>
    </div>
    ${diffSection(r)}
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
    <div class="w-foot">${pending ? `<button type="button" class="btn yellow huge" data-action="save-diff">${esc(t('updateScheda', pending))}</button><button type="button" class="btn ghost-dark" data-action="close">${esc(t('onlyTodayAll'))}</button>`
    : `<button type="button" class="btn light huge" data-action="close">${esc(t('close'))}</button>`}</div>
  </div>`;
  return {
    dark: true,
    html,
    bind(view) {
      view.querySelector('[data-action=close]').addEventListener('click', () => { summaryId = null; summaryDiff = null; location.hash = '#/history'; });
      view.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { const [ix, k] = b.dataset.pick.split('|'); summaryDiff.pick[ix] = k; window.dispatchEvent(new CustomEvent('palestra:render')); }));
      view.querySelectorAll('[data-action=all-fatto],[data-action=all-oggi]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.action === 'all-fatto' ? 'fatto' : 'oggi';
        for (const x of summaryDiff.rows) summaryDiff.pick[x.ix] = k;
        window.dispatchEvent(new CustomEvent('palestra:render'));
      }));
      view.querySelector('[data-action=save-diff]')?.addEventListener('click', () => {
        const n = applyDiff();
        summaryId = null; summaryDiff = null;
        toast(t('schedaUpdated', n));
        location.hash = '#/history';
      });
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
