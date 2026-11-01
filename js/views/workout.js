// Start workout mode: the weekly increase, the set, the rest timer, cardio, pause, and the summary.
// Dark, big, screen kept on, works offline. All timing comes from timestamps (see workout.js).
import { state, get, upsert, live } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum, clock, num, timeOfDay, minText } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { stepper, bindSteppers, stepVal } from '../ui/parts.js';
import { askConfirm, toast } from '../ui/dialogs.js';
import { machineOf, placeOf, whereText, measureLabel, training, increaseSettings, refreshEstimates, routineMinutes } from '../data.js';
import { increaseProposals, applyIncrease, measuresFor, totalWeight, lastResult } from '../model.js';
import * as W from '../workout.js';
import { breakdownBar, setText } from './history.js';
import { syncNow } from '../sync.js';

let active = null; // the workout in progress
let summaryId = null; // the session just finished, shown until closed
let pendingStart = null; // { routineId, blockId, proposals }
let unchecked = new Set();
let wakeLock = null;
let vibratedFor = null;

export async function initWorkout() {
  active = await W.loadActive();
  return active;
}
export const hasActive = () => Boolean(active && active.phase !== 'done');
export const activeWorkout = () => active;

async function commit(next) {
  active = next;
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
  const head = `<header class="w-head">
      <button type="button" class="w-icon" data-action="end" aria-label="${esc(t('endWorkout'))}">${icon('close')}</button>
      <div class="w-head-mid"><span class="w-small">${esc(t('exNofM', r?.name || '', pos + 1, exIndexes.length))}</span><span class="w-clock" data-live="elapsed">${clock(W.elapsedSec(active))}</span></div>
      <button type="button" class="w-icon filled" data-action="pause" aria-label="${esc(paused ? t('resume') : t('pauseWorkout'))}">${icon(paused ? 'play' : 'pause', 18)}</button>
    </header>
    <div class="w-progress" aria-hidden="true">${exIndexes.map((ix, i) => `<span class="${i < pos ? 'done' : i === pos ? 'now' : ''}"></span>`).join('')}</div>`;
  let body;
  if (paused) body = pausedBody();
  else if (active.phase === 'rest') body = restBody();
  else if (step.kind === 'cardio') body = cardioBody(step, ex);
  else body = setBody(step, ex);
  return {
    dark: true,
    html: `<div class="w-screen">${head}${body}</div>`,
    bind(view) {
      bindSteppers(view);
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
      view.querySelector('[data-action=skip-set]')?.addEventListener('click', () => commit(W.skipStep(active)));
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
        ${step.plan.weight != null ? `<div class="w-card stepcard">${stepper({ name: 'weight', value: step.plan.weight, step: ex.equipment === 'dumbbell' ? 1 : 2.5, min: 0, label: 'kg', big: true })}</div>` : ''}
      </div>
      ${m || p ? `<div class="w-card machine"><span class="w-mnum">${esc(m?.number || '·')}</span><div><b>${esc(p?.name || m?.name || '')}</b><small>${esc(m?.settings || (m && p ? m.name : ''))}</small></div></div>` : ''}
      ${ex.notes ? `<section class="w-note" aria-label="${esc(t('notes'))}">${icon('pencil', 20)}<p>${esc(ex.notes)}</p></section>` : ''}
      <p class="w-small">${esc([lastSet ? t('setDone', lastSet.n, setText(ex, lastSet)) : '', prevText].filter(Boolean).join(' · '))}</p>
    </main>
    <div class="w-foot">
      <button type="button" class="btn yellow huge done-btn" data-action="done">${icon('check', 30)}${esc(t('doneSet'))}</button>
      <button type="button" class="btn ghost-dark" data-action="skip-set">${esc(t('skipSet'))}</button>
    </div>`;
}

function prevSummary(ex, s) {
  const sets = s.sets.filter((x) => x.exerciseId === ex.id);
  if (!sets.length) return '';
  if (ex.type === 'cardio') return setText(ex, sets[0]);
  const reps = sets[0].reps ?? `${sets[0].seconds} s`;
  return ex.type === 'weights' ? `${sets.length} × ${reps} · ${fmtNum(Math.max(...sets.map((x) => x.weight || 0)))} kg` : `${sets.length} × ${reps}`;
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
      <label class="w-card w-field"><span>${esc(t('distanceFromDisplay'))} <small>${esc(t('optionalOne'))}</small></span><input name="distance" inputmode="decimal" placeholder="— km" autocomplete="off"></label>
      ${ex.notes ? `<section class="w-note">${icon('pencil', 20)}<p>${esc(ex.notes)}</p></section>` : ''}
    </main>
    <div class="w-foot row2"><button type="button" class="btn ghost-dark fill" data-action="pause">${esc(t('pause'))}</button><button type="button" class="btn yellow huge" data-action="done">${esc(t('finishCardio'))}</button></div>`;
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
  const nextAmount = nxt && nxt.kind === 'set' ? `${nxt.plan.reps ?? `${nxt.plan.seconds} s`}${nxt.plan.weight != null ? ` × ${fmtNum(nxt.plan.weight)}` : ''}` : '';
  const sameMachine = nxt && active.restKind === 'set';
  return `<main class="w-main center">
      <span class="eyebrow">${esc(active.restKind === 'between' ? t('restAndMove') : t('rest'))}</span>
      <div class="ring">
        <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden="true"><circle cx="130" cy="130" r="110" class="ring-bg"/><circle cx="130" cy="130" r="110" class="ring-fg${left <= 0 ? ' over' : ''}" data-live="ring" stroke-dasharray="${(C * frac).toFixed(1)} 700" transform="rotate(-90 130 130)"/></svg>
        <div class="ring-text" role="timer"><span class="w-bigclock" data-live="rest-left">${left >= 0 ? clock(left) : `+${clock(-left)}`}</span><small>${esc(t('ofPlanned', clock(active.restPlanned)))}</small></div>
      </div>
      <p class="w-text">${esc(t('youRested'))} <b data-live="rested">${clock(W.phaseSec(active))}</b></p>
      <div class="w-grid2 wide"><button type="button" class="btn dark-btn big" data-action="add30">+30 s</button><button type="button" class="btn light big" data-action="end-rest">${esc(t('skip'))}</button></div>
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
  if (session.sets.length) upsert('sessions', session);
  await W.saveActive(null);
  active = null;
  releaseWake();
  summaryId = session.sets.length ? session.id : null;
  refreshEstimates();
  syncNow();
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
  const total = totalWeight(s);
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
