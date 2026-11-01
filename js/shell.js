// The app's frame: routes, the tab bar, the sync status, and swapping a view's HTML without losing the place
// on the page or the field being typed in (as in Ricette).
import { state } from './store.js';
import { t } from './i18n.js';
import { isConfigured } from './sync.js';

const $ = (sel) => document.querySelector(sel);

/** "#/routine/abc/edit?block=x" → { name:'routine', id:'abc', sub:'edit', query:{block:'x'} } */
export function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'routines';
  const [path, qs] = raw.split('?');
  const [name, id, sub] = path.split('/').map((x) => (x ? decodeURIComponent(x) : x));
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name, id, sub, query };
}

export const TAB_OF = {
  routines: 'routines', routine: 'routines', exercises: 'exercises', exercise: 'exercises',
  gym: 'gym', machine: 'gym', history: 'history', session: 'history', plans: 'routines', plan: 'routines', import: 'routines',
};

export function renderTabs() {
  for (const a of document.querySelectorAll('nav.tabs a')) a.querySelector('.label').textContent = t(`tab_${a.dataset.tab}`);
}

export function setActiveTab(routeName) {
  for (const a of document.querySelectorAll('nav.tabs a')) {
    const on = a.dataset.tab === TAB_OF[routeName];
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }
}

export function syncStatus(syncing) {
  if (!isConfigured()) return 'local';
  if (syncing) return 'syncing';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  if (state.meta.lastError === 'network') return 'offline';
  if (state.meta.lastError) return 'error';
  if (state.meta.dirty) return 'pending';
  return 'synced';
}

let lastRendered = '';

export function paint(view, html, after = () => {}) {
  const here = location.hash || '#/routines';
  const keepY = here === lastRendered ? window.scrollY : null;
  lastRendered = here;
  const active = document.activeElement;
  const focusId = active && active.id;
  const typed = focusId && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') ? active.value : null;
  let sel = null;
  try { sel = focusId && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null; } catch { sel = null; }
  view.innerHTML = html;
  after(view);
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el && view.contains(el)) {
      if (typed != null) el.value = typed;
      el.focus({ preventScroll: true });
      if (sel) try { el.setSelectionRange(...sel); } catch { /* not a text field */ }
    }
  }
  if (keepY != null && Math.abs(window.scrollY - keepY) > 1) window.scrollTo(0, keepY);
  else if (keepY == null) window.scrollTo(0, 0);
}

export function go(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
