// Two-way sync of local collections with JSON files in the private GitHub repository (palestra-data),
// the same way Ricette and Everyday do it: one file per collection, merged record by record.
// Sessions are split by month (data/sessions/YYYY-MM.json), like Everyday's blocks.
import {
  state, upsert, mergeLists, purgeTombstones, serialize, replaceCollection, saveMeta, kvGet, kvSet, kvDel, kvKeys,
} from './store.js';

// prefs first: it holds the contract version, which decides whether this app may write.
export const PATHS = {
  prefs: 'data/prefs.json',
  places: 'data/places.json',
  machines: 'data/machines.json',
  exercises: 'data/exercises.json',
  routines: 'data/routines.json',
  plans: 'data/plans.json',
};
const SESSIONS_DIR = 'data/sessions';

// Data contract with Everyday, v1, kept as the prefs record {id: 'contract', value} the way Ricette does.
// A higher number means a newer app wrote the data: this one keeps reading but stops writing until it's updated.
export const CONTRACT = 1;
export function contractInData() {
  const rec = (state.prefs || []).find((p) => p && p.id === 'contract' && !p.deleted);
  return Number(rec?.value) || 0;
}

export function isConfigured() {
  const s = state.settings;
  return Boolean(s.owner && s.repo && s.token);
}

function branch() { return state.settings.branch || 'main'; }

function api(path, init = {}) {
  const s = state.settings;
  const url = `https://api.github.com/repos/${encodeURIComponent(s.owner.trim())}/${encodeURIComponent(s.repo.trim())}${path ? '/' + path : ''}`;
  return fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${s.token.trim()}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
}

class SyncError extends Error {
  constructor(code, status) { super(code); this.code = code; this.status = status; }
}

function fail(res) {
  if (res.status === 401) return new SyncError('auth', 401);
  if (res.status === 403) return new SyncError('forbidden', 403);
  if (res.status === 404) return new SyncError('notfound', 404);
  return new SyncError('http', res.status);
}

function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function getText(path) {
  const ref = encodeURIComponent(branch());
  const res = await api(`contents/${path}?ref=${ref}`);
  if (res.status === 404) return { sha: null, text: null };
  if (!res.ok) throw fail(res);
  const meta = await res.json();
  let text;
  if (meta.content) text = b64decode(meta.content);
  else {
    const raw = await api(`contents/${path}?ref=${ref}`, { headers: { Accept: 'application/vnd.github.raw' } });
    if (!raw.ok) throw fail(raw);
    text = await raw.text();
  }
  return { sha: meta.sha, text, size: meta.size };
}

async function getFile(path) {
  const { sha, text, size } = await getText(path);
  if (text == null) return { sha: null, data: [], size: 0 };
  let data = [];
  try { data = JSON.parse(text); } catch { data = []; }
  return { sha, data: Array.isArray(data) ? data : [], size };
}

async function putFile(path, text, sha) {
  const body = { message: `palestra: update ${path}`, content: b64encode(text), branch: branch() };
  if (sha) body.sha = sha;
  const res = await api(`contents/${path}`, {
    method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 409 || res.status === 422) return null; // someone else wrote first
  if (!res.ok) throw fail(res);
  let out = {};
  try { out = await res.json(); } catch { /* no body */ }
  return out?.content?.sha || 'unknown';
}

const CACHE_PREFIX = 'gh:';
function cacheKey(path) {
  const s = state.settings;
  return `${CACHE_PREFIX}${String(s.owner || '').trim().toLowerCase()}/${String(s.repo || '').trim().toLowerCase()}@${branch()}:${path}`;
}
export async function clearFileCache() {
  for (const k of await kvKeys(CACHE_PREFIX)) await kvDel(k);
}

async function listDir(dir) {
  const res = await api(`contents/${dir}?ref=${encodeURIComponent(branch())}`);
  if (res.status === 404) return { listed: true, files: new Map() };
  if (!res.ok) throw fail(res);
  const list = await res.json();
  const files = new Map();
  if (Array.isArray(list)) for (const f of list) if (f && f.type === 'file') files.set(f.path, { sha: f.sha, size: f.size });
  return { listed: true, files };
}

/** Month key of a session: the month it started in, local time. */
export function monthOf(session) {
  const d = new Date(session.start || session.updatedAt || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Merge one file with the local records that belong in it. Returns the merged list.
async function syncFile(path, local, listing, readOnly) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let remote = null;
    if (attempt === 0 && listing) {
      const info = listing.files.get(path);
      if (!info) remote = { sha: null, data: [] };
      else {
        const cached = await kvGet(cacheKey(path));
        if (cached && cached.sha === info.sha) {
          try { remote = { sha: info.sha, data: JSON.parse(cached.text), cached: true }; } catch { remote = null; }
        }
      }
    }
    if (!remote) remote = await getFile(path);
    const merged = purgeTombstones(mergeLists(remote.data, local));
    const text = serialize(merged);
    const remoteText = serialize(remote.data);
    if (text !== remoteText && !readOnly && merged.length) {
      const sha = await putFile(path, text, remote.sha);
      if (!sha) continue;
      await kvSet(cacheKey(path), { sha, text });
    } else if (!remote.cached && remote.sha) {
      await kvSet(cacheKey(path), { sha: remote.sha, text: remoteText });
    }
    return merged;
  }
  throw new SyncError('conflict');
}

let running = null;
let again = false;

export function syncNow() {
  if (!isConfigured()) return Promise.resolve({ skipped: true });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ offline: true });
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do {
        again = false;
        let dataListing = null;
        try { dataListing = await listDir('data'); } catch (e) { if (e.code === 'auth' || e.code === 'forbidden') throw e; }
        let newer = contractInData() > CONTRACT;
        for (const [c, path] of Object.entries(PATHS)) {
          const merged = await syncFile(path, state[c], dataListing, newer);
          await replaceCollection(c, mergeLists(merged, state[c]));
          if (c === 'prefs') {
            newer = contractInData() > CONTRACT; // the prefs just arrived: check again
            if (!newer && contractInData() < CONTRACT) { upsert('prefs', { id: 'contract', value: CONTRACT }, { silent: true }); again = true; }
          }
        }
        // sessions, one file per month
        let sessListing = null;
        try { sessListing = await listDir(SESSIONS_DIR); } catch (e) { if (e.code === 'auth' || e.code === 'forbidden') throw e; }
        const months = new Set(state.sessions.map(monthOf));
        if (sessListing) for (const p of sessListing.files.keys()) { const m = p.match(/(\d{4}-\d{2})\.json$/); if (m) months.add(m[1]); }
        let all = [];
        for (const m of [...months].sort()) {
          const local = state.sessions.filter((s) => monthOf(s) === m);
          all = all.concat(await syncFile(`${SESSIONS_DIR}/${m}.json`, local, sessListing, newer));
        }
        await replaceCollection('sessions', mergeLists(all, state.sessions));
        await saveMeta({ dirty: again, lastSync: Date.now(), lastError: null, contractNewer: newer });
      } while (again);
      return { ok: true };
    } catch (e) {
      const code = e instanceof SyncError ? e.code : (e instanceof TypeError ? 'network' : 'unknown');
      await saveMeta({ lastError: code });
      return { error: code };
    } finally {
      running = null;
    }
  })();
  return running;
}

export function isSyncing() { return Boolean(running); }

export async function testConnection() {
  if (!isConfigured()) return { error: 'missing' };
  try {
    const res = await api('');
    if (!res.ok) return { error: fail(res).code };
    const repo = await res.json();
    if (!repo.permissions?.push) return { error: 'readonly' };
    return { ok: true, private: repo.private };
  } catch {
    return { error: 'network' };
  }
}
