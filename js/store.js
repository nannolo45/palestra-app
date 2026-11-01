// Local storage (IndexedDB) and conflict-free merging of collections, as in Ricette and Everyday.
// Every record: {id, updatedAt, deleted?}. Merge = newest updatedAt wins per id.

export const COLLECTIONS = ['places', 'machines', 'exercises', 'routines', 'plans', 'sessions', 'prefs'];
const TOMBSTONE_TTL = 90 * 24 * 3600 * 1000;

const DB_NAME = 'palestra';
const STORE = 'kv';
let dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function db() { return (dbPromise ||= openDb()); }

export async function kvGet(key) {
  const d = await db();
  if (!d) return memory.get(key);
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

// Without IndexedDB (unit tests) values live in memory.
const memory = new Map();

export async function kvSet(key, value) {
  const d = await db();
  if (!d) { memory.set(key, value); return; }
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function kvKeys(prefix = '') {
  const d = await db();
  if (!d) return [...memory.keys()].filter((k) => String(k).startsWith(prefix));
  return new Promise((resolve) => {
    const req = d.transaction(STORE).objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result.filter((k) => String(k).startsWith(prefix)));
    req.onerror = () => resolve([]);
  });
}

export async function kvDel(key) {
  const d = await db();
  if (!d) { memory.delete(key); return; }
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const state = {
  places: [], machines: [], exercises: [], routines: [], plans: [], sessions: [], prefs: [],
  // local to this device, never synced
  settings: { lang: '', owner: '', repo: 'palestra-data', branch: 'main', token: '' },
  meta: { dirty: false, lastSync: null, lastError: null, contractNewer: false },
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(kind) { for (const fn of listeners) fn(kind); }

export async function load() {
  for (const c of COLLECTIONS) state[c] = (await kvGet(c)) || [];
  Object.assign(state.settings, (await kvGet('settings')) || {});
  Object.assign(state.meta, (await kvGet('meta')) || {});
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function live(collection) { return state[collection].filter((x) => !x.deleted); }
export function get(collection, id) { return state[collection].find((x) => x.id === id && !x.deleted); }

let lastStamp = 0;
function stamp() { lastStamp = Math.max(Date.now(), lastStamp + 1); return lastStamp; }

export function upsert(collection, item, { silent = false } = {}) {
  // keep fields this version doesn't know (written by a newer Palestra or by Everyday)
  const old = state[collection].find((x) => x.id === item.id);
  const rec = { ...(old && !old.deleted ? old : {}), ...item, updatedAt: stamp() };
  delete rec.deleted;
  const list = state[collection];
  const i = list.findIndex((x) => x.id === rec.id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  persist(collection, silent);
  return rec;
}

export function remove(collection, id) {
  const list = state[collection];
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const before = list[i];
  list[i] = { id, deleted: true, updatedAt: stamp() };
  persist(collection);
  return before;
}

/** Put back a record removed a moment ago (Undo). */
export function restore(collection, rec) {
  if (!rec) return;
  return upsert(collection, rec);
}

function persist(collection, silent) {
  kvSet(collection, state[collection]);
  state.meta.dirty = true;
  kvSet('meta', state.meta);
  if (!silent) emit(collection);
}

export async function replaceCollection(collection, items) {
  const same = JSON.stringify(items) === JSON.stringify(state[collection]);
  state[collection] = items;
  if (same) return;
  await kvSet(collection, items);
  emit(collection);
}

export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await kvSet('settings', state.settings);
  emit('settings');
}

export async function saveMeta(patch) {
  const before = `${state.meta.dirty}|${state.meta.lastError}`;
  Object.assign(state.meta, patch);
  await kvSet('meta', state.meta);
  emit(before === `${state.meta.dirty}|${state.meta.lastError}` ? 'meta-time' : 'meta');
}

export function mergeLists(a = [], b = []) {
  const map = new Map();
  for (const x of [...a, ...b]) {
    if (!x || !x.id) continue;
    const y = map.get(x.id);
    if (!y || (x.updatedAt || 0) > (y.updatedAt || 0)) map.set(x.id, x);
  }
  return [...map.values()];
}

export function purgeTombstones(list, now = Date.now()) {
  return list.filter((x) => !x.deleted || now - (x.updatedAt || 0) < TOMBSTONE_TTL);
}

export function serialize(list) {
  const sorted = [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify(sorted, null, 1) + '\n';
}

// ---- prefs: synced settings, one record per key ({id, value}) ----

export function pref(key, fallback) {
  const rec = state.prefs.find((p) => p && p.id === key && !p.deleted);
  return rec && rec.value !== undefined ? rec.value : fallback;
}

export function setPref(key, value) {
  return upsert('prefs', { id: key, value });
}

/** Wipe everything on this device (used by tests and "disconnect and clear"). */
export async function resetLocal() {
  for (const c of COLLECTIONS) { state[c] = []; await kvDel(c); }
  for (const k of await kvKeys('gh:')) await kvDel(k);
  await kvDel('active');
  state.meta = { dirty: false, lastSync: null, lastError: null, contractNewer: false };
  await kvSet('meta', state.meta);
  emit('reset');
}
