// The app's frame: routes, the tab bar, the sync status, and swapping a view's HTML without losing the place
// on the page or the field being typed in (as in Ricette).
import { state } from './store.js';
import { t } from './i18n.js';
import { isConfigured } from './sync.js';

const $ = (sel) => document.querySelector(sel);

/** "#/routine/abc/edit?block=x" → { name:'routine', id:'abc', sub:'edit', query:{block:'x'} } */
export function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'today';
  const [path, qs] = raw.split('?');
  const [name, id, sub] = path.split('/').map((x) => (x ? decodeURIComponent(x) : x));
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  return { name, id, sub, query };
}

export const TAB_OF = {
  today: 'today', plans: 'train', plan: 'train', routines: 'train', routine: 'train', import: 'train', try: 'train',
  exercises: 'train', exercise: 'train', pictures: 'train', gym: 'gym', machine: 'gym', history: 'history', session: 'history', settings: 'settings',
};

/** Allenamento's three tabs (v26), and the one a route belongs to. */
export const TRAIN_TABS = ['plans', 'routines', 'exercises'];
export const TRAIN_OF = { plans: 'plans', plan: 'plans', routines: 'routines', routine: 'routines', import: 'routines', try: 'routines', exercises: 'exercises', exercise: 'exercises', pictures: 'exercises' };
/** Where Allenamento opens: the tab last seen on this device. */
export const trainHref = () => `#/${TRAIN_TABS.includes(state.settings.trainTab) ? state.settings.trainTab : 'plans'}`;

export function renderTabs() {
  for (const a of document.querySelectorAll('nav.tabs a[data-tab]')) a.querySelector('.label').textContent = a.dataset.tab === 'settings' ? t('settings') : t(`tab_${a.dataset.tab}`);
  const brand = document.querySelector('nav.tabs .nav-brand');
  if (brand) { brand.setAttribute('aria-label', `Palestra · ${t('tab_today')}`); brand.title = t('tab_today'); }
  const gear = document.getElementById('gear');
  if (gear) { gear.setAttribute('aria-label', t('settings')); gear.title = t('settings'); document.getElementById('gear-label').textContent = t('settings'); }
  const nav = document.querySelector('nav.tabs');
  if (nav) nav.setAttribute('aria-label', t('mainNav'));
}

export function setActiveTab(routeName) {
  document.getElementById('gear')?.classList.toggle('active', routeName === 'settings');
  document.querySelectorAll('#view .gear').forEach((g) => g.classList.toggle('active', routeName === 'settings'));
  for (const a of document.querySelectorAll('nav.tabs a[data-tab]')) {
    if (a.dataset.tab === 'train') a.setAttribute('href', trainHref());
    const on = a.dataset.tab === (TAB_OF[routeName] || 'today');
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
  const here = location.hash || '#/today';
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

/** The desktop layout (sidebar, two columns, master-detail) from 960px. */
export const isWide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 960px)').matches;

/** The desktop top bar's sync pill (the phone shows it on Oggi). */
export function paintNavSync(syncing) {
  const el = document.getElementById('nav-sync');
  if (!el) return;
  const st = syncStatus(syncing);
  el.className = `nav-sync st-${st}`;
  el.querySelector('.nav-sync-text').textContent = t(`st_${st}`);
}

/**
 * On a wide screen a page's main actions (Nuova scheda · Importa) sit in the top bar, as in Ricette and Everyday.
 * The nodes are moved, not copied, so the listeners the view bound stay on them.
 */
export function placeTopActions(view) {
  const slot = document.getElementById('nav-actions');
  if (!slot) return;
  slot.replaceChildren();
  if (!isWide()) return;
  const src = view.querySelector('[data-top-actions]');
  if (!src) return;
  // inside Allenamento they go at the right end of its second bar
  const there = view.querySelector('.train-tabs .tt-acts') || slot;
  there.append(...src.children);
  src.remove();
}
