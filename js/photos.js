// Your own photo of each machine. Taken with the phone's camera, made smaller (longest side 1000 px, JPEG ~100 KB),
// kept on this device and, when GitHub is connected, as a file in palestra-data (photos/<machine id>.jpg) so the
// other devices get it too. The machine record carries only { photo: { file, at } }.
import { state, get, upsert, kvGet, kvSet, kvDel, kvKeys } from './store.js';

const KEY = 'photo:';
const QUEUE = 'photoQueue'; // machine ids whose photo still has to go up (or be removed: "-<id>")
const mem = new Map(); // id → data URL, for drawing without waiting

export async function loadPhotos() {
  for (const k of await kvKeys(KEY)) {
    const v = await kvGet(k);
    if (v && v.url) mem.set(k.slice(KEY.length), v);
  }
}

/** The photo of a machine, as an address an <img> can show, or ''. */
export function photoOf(machine) {
  if (!machine || !machine.photo) return '';
  const v = mem.get(machine.id);
  return v ? v.url : '';
}
export const hasPhoto = (machine) => Boolean(photoOf(machine));

/** A picked or taken image file → a smaller JPEG data URL. */
export async function shrink(file, max = 1000, quality = 0.78) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

async function queue(entry) {
  const q = ((await kvGet(QUEUE)) || []).filter((x) => x.replace(/^-/, '') !== entry.replace(/^-/, ''));
  await kvSet(QUEUE, [...q, entry]);
}

/** Save a new photo for a machine (from shrink()). */
export async function setPhoto(machineId, dataUrl) {
  const at = Date.now();
  const v = { url: dataUrl, at };
  mem.set(machineId, v);
  await kvSet(KEY + machineId, v);
  await queue(machineId);
  const m = get('machines', machineId);
  if (m) upsert('machines', { ...m, photo: { file: `photos/${machineId}.jpg`, at } });
}

export async function removePhoto(machineId) {
  mem.delete(machineId);
  await kvDel(KEY + machineId);
  await queue(`-${machineId}`);
  const m = get('machines', machineId);
  if (m) { const n = { ...m }; delete n.photo; upsert('machines', n); }
}

// ---- with GitHub (called by sync.js, with its own request helpers) ----

const toBase64 = (dataUrl) => dataUrl.slice(dataUrl.indexOf(',') + 1);

/**
 * Send the waiting photos up, then fetch the ones this device doesn't have yet.
 * io = { list(dir) → Map(path → {sha}), put(path, base64, sha), del(path, sha), raw(path) → Blob }
 */
export async function syncPhotos(io, readOnly) {
  let listing = await io.list('photos');
  if (!readOnly) {
    const q = (await kvGet(QUEUE)) || [];
    const left = [];
    for (const entry of q) {
      const id = entry.replace(/^-/, '');
      const path = `photos/${id}.jpg`;
      try {
        if (entry.startsWith('-')) { if (listing.has(path)) await io.del(path, listing.get(path).sha); }
        else { const v = mem.get(id); if (v) await io.put(path, toBase64(v.url), listing.get(path)?.sha); }
      } catch (e) { left.push(entry); if (e.code === 'auth' || e.code === 'forbidden') throw e; }
    }
    await kvSet(QUEUE, left);
    if (q.length) listing = await io.list('photos');
  }
  for (const m of state.machines) {
    if (m.deleted || !m.photo || !m.photo.file) continue;
    const have = mem.get(m.id);
    if (have && have.at >= (m.photo.at || 0)) continue;
    if (!listing.has(m.photo.file)) continue;
    const blob = await io.raw(m.photo.file);
    const url = await new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    const v = { url, at: m.photo.at || Date.now() };
    mem.set(m.id, v);
    await kvSet(KEY + m.id, v);
  }
}
