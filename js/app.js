// Palestra: start-up, routing, redrawing, sync triggers and the Update bar.
import './sortable.js';
import { state, load, onChange, COLLECTIONS } from './store.js';
import { t, getLang } from './i18n.js';
import { route, renderTabs, setActiveTab, paint, placeTopActions, paintNavSync } from './shell.js';
import { syncNow, isConfigured, isSyncing } from './sync.js';
import { isDragging } from './sortable.js';
import { routinesView, routineView, routineEditView } from './views/routines.js';
import { todayView } from './views/today.js';
import { exercisesView, exerciseView } from './views/exercises.js';
import { gymView } from './views/gym.js';
import { historyView, sessionView } from './views/history.js';
import { settingsView } from './views/settings.js';
import { plansView, planView } from './views/plans.js';
import { importView } from './views/import.js';
import { initWorkout, startView, workoutView, hasActive, activeWorkout, leaveWorkoutScreens } from './views/workout.js';
import { refreshEstimates } from './data.js';
import { esc } from './ui/format.js';
import { icon } from './ui/icons.js';

const $ = (sel) => document.querySelector(sel);
let current = null; // the view on screen: { html, bind, leave, tick, dark }
let currentKey = '';

function viewFor(r) {
  switch (r.name) {
    case 'today': return todayView();
    case 'routines': return routinesView(r.query);
    case 'routine': return r.sub === 'edit' ? routineEditView(r.id) : routineView(r.id);
    case 'exercises': return exercisesView();
    case 'exercise': return exerciseView(r.id, r.query);
    case 'gym': return gymView();
    case 'history': return historyView(r.query);
    case 'session': return sessionView(r.id);
    case 'settings': return settingsView(r.id);
    case 'plans': return plansView();
    case 'plan': return planView(r.id);
    case 'import': return importView(r.query);
    case 'start': return startView(r.id, r.query);
    case 'workout': return workoutView();
    default: return todayView();
  }
}

function resumeBanner(r) {
  if (!hasActive() || r.name === 'workout' || r.name === 'start') return '';
  const w = activeWorkout();
  const name = state.routines.find((x) => x.id === w.routineId)?.name || '';
  return `<a class="resume-banner" href="#/workout">${icon('play', 16)}<span>${esc(t('workoutInProgressShort', name))}</span><b>${esc(t('resume'))}</b></a>`;
}

export function render() {
  const view = $('#view');
  const r = route();
  const key = `${r.name}/${r.id || ''}/${r.sub || ''}`;
  if (key !== currentKey) {
    current?.leave?.();
    if (r.name !== 'start') leaveWorkoutScreens();
  }
  currentKey = key;
  document.documentElement.lang = getLang();
  current = viewFor(r);
  const dark = Boolean(current.dark);
  document.body.classList.toggle('mode-workout', dark);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#141518' : '#F5F4F0');
  setActiveTab(r.name);
  paint(view, resumeBanner(r) + current.html, (v) => { current.bind?.(v); placeTopActions(v); });
  paintNavSync(isSyncing());
}

// Redraw after data changes, unless the person is in the middle of something.
let pending = false;
function renderIfSafe() {
  const ae = document.activeElement;
  const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT') && $('#view').contains(ae);
  // the workout screen and an exercise card being edited only redraw on their own actions
  const rn = route();
  if (current?.dark || rn.name === 'exercise' || rn.name === 'import' || (rn.name === 'settings' && rn.id && rn.id !== 'everyday')) return;
  if (isDragging() || $('#modal')?.open || typing) { pending = true; return; }
  pending = false;
  render();
}
setInterval(() => { if (pending) renderIfSafe(); }, 800);

// Clocks in workout mode tick without redrawing the page.
setInterval(() => { if (current?.tick) current.tick($('#view')); }, 250);

let syncTimer = null;
function scheduleSync(ms = 4000) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncNow(), ms);
}

// ---- Update bar (as in Ricette) ----

function showUpdateBar(worker) {
  let bar = $('#update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span>${esc(t('updateReady'))}</span><button type="button">${esc(t('update'))}</button>`;
  bar.querySelector('button').onclick = () => { worker.postMessage({ type: 'SKIP_WAITING' }); };
  bar.classList.add('show');
}

async function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let reg;
  try { reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch { return; }
  if (!reg) return;
  const watch = (w) => {
    if (!w) return;
    const ready = () => { if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(w); };
    w.addEventListener('statechange', ready);
    ready();
  };
  if (reg.waiting && navigator.serviceWorker.controller) {
    // a fresh start with no workout running: switch to the new version straight away
    if (!hasActive()) reg.waiting.postMessage({ type: 'SKIP_IF_ALONE' });
    else showUpdateBar(reg.waiting);
  }
  reg.addEventListener('updatefound', () => watch(reg.installing));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
  setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
}

// ---- start ----

async function init() {
  await load();
  await initWorkout();
  renderTabs();
  onChange((kind) => {
    if (kind === 'settings') renderTabs();
    if (COLLECTIONS.includes(kind) || kind === 'meta' || kind === 'settings' || kind === 'reset') {
      if (COLLECTIONS.includes(kind) && kind !== 'prefs') scheduleSync();
      if (kind === 'prefs') scheduleSync();
      renderIfSafe();
    } else if (kind === 'meta-time') renderIfSafe();
  });
  window.addEventListener('palestra:render', () => render());
  // a sheet just closed: show what it changed
  for (const d of ['#modal']) $(d)?.addEventListener('close', () => setTimeout(() => { if (pending) renderIfSafe(); }, 0));
  document.addEventListener('close', (e) => { if (e.target?.id === 'confirm' && pending) setTimeout(renderIfSafe, 0); }, true);
  window.addEventListener('hashchange', render);
  // the desktop layout changes the markup (sidebar, master-detail), so redraw when crossing 960px
  try { matchMedia('(min-width: 960px)').addEventListener('change', () => render()); } catch { /* old browsers */ }
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isConfigured() && !hasActive()) syncNow(); });
  // A workout left running: go back to it.
  if (hasActive() && !location.hash.startsWith('#/workout') && !location.hash.startsWith('#/start')) location.hash = '#/workout';
  render();
  refreshEstimates();
  registerSW();
  if (isConfigured()) syncNow();
}

init();
