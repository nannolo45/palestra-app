// Pictures: choosing one for an exercise (a sheet, or one exercise after another), the machine photo, and the
// full-screen viewer used during a workout. See js/pictures.js (the library) and js/photos.js (your own photos).
import { get, upsert, live, pref } from '../store.js';
import { t } from '../i18n.js';
import { esc } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { openSheet, toast } from '../ui/dialogs.js';
import { suggest, frameUrl, toPicture, hasPicture } from '../pictures.js';
import { photoOf, setPhoto, removePhoto, shrink } from '../photos.js';
import { machineOf } from '../data.js';

/** Impostazioni → Lingua e aspetto → Immagini: off hides every drawing, photo and small picture (nothing is deleted). */
export const picturesOn = () => pref('pictures', true) !== false;

const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));

/** The grid of suggestions; the chosen one has a yellow frame. */
function grid(items, sel) {
  if (!items) return `<p class="muted pic-wait">${esc(t('picLoading'))}</p>`;
  if (!items.length) return `<p class="muted pic-wait">${esc(t('picNothing'))}</p>`;
  return `<div class="pic-grid">${items.map((it) => `<button type="button" class="pic-cand${it.id === sel ? ' on' : ''}" data-pic="${esc(it.id)}" aria-pressed="${it.id === sel}">
      <img src="${esc(frameUrl({ id: it.id, n: it.n }, 0))}" alt="" loading="lazy"><span>${esc(it.name)}</span></button>`).join('')}</div>`;
}

/**
 * Choose a picture for an exercise. Resolves to the picture to store ({lib, id, …} or {none: true}), or null if
 * cancelled. The search box takes Italian or English.
 */
export function pickPicture(ex) {
  let items = null; let sel = null; let q = '';
  const html = `<h2>${esc(t('picChoose'))}</h2><p class="muted">${esc(ex.name)}</p>
    <label class="search">${icon('search', 18)}<span class="sr">${esc(t('picSearch'))}</span><input id="pic-q" type="search" placeholder="${esc(t('picSearch'))}" autocomplete="off"></label>
    <div data-grid>${grid(null)}</div>
    <p class="muted small">${esc(t('picCredit'))}</p>
    <div class="button-row"><button class="btn primary" value="ok" disabled>${esc(t('picUse'))}</button><button type="button" class="btn" data-none>${esc(t('picNone'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>`;
  return openSheet(html, (form, close) => {
    const box = form.querySelector('[data-grid]');
    const ok = form.querySelector('[value=ok]');
    const draw = () => {
      box.innerHTML = grid(items, sel);
      ok.disabled = !sel;
      box.querySelectorAll('[data-pic]').forEach((b) => b.addEventListener('click', () => { sel = b.dataset.pic; draw(); }));
    };
    const load = async () => {
      try { items = await suggest(ex, { query: q, limit: q ? 8 : 6 }); } catch { items = []; toast(t('picOffline')); }
      if (ex.picture?.id && !q && !items.some((x) => x.id === ex.picture.id)) items.unshift({ id: ex.picture.id, name: ex.picture.name, n: ex.picture.n });
      sel = sel && items.some((x) => x.id === sel) ? sel : (ex.picture?.id && items.some((x) => x.id === ex.picture.id) ? ex.picture.id : null);
      draw();
    };
    let timer = null;
    form.querySelector('#pic-q').addEventListener('input', (e) => { q = e.target.value.trim(); clearTimeout(timer); timer = setTimeout(load, 250); });
    ok.addEventListener('click', () => { const it = items.find((x) => x.id === sel); if (it) close(toPicture(it)); });
    form.querySelector('[data-none]').addEventListener('click', () => close({ none: true }));
    load();
  });
}

// ---- one exercise after another: Esercizi → Abbina le immagini ----

const run = { ids: null, i: 0, items: null, sel: null, chosen: {} };

export const missingPictures = () => (picturesOn() ? live('exercises') : []).filter((e) => !e.picture).sort((a, b) => String(a.name).localeCompare(b.name));

export function picturesView() {
  if (!run.ids) Object.assign(run, { ids: missingPictures().map((e) => e.id), i: 0, items: null, sel: null, chosen: {} });
  const n = run.ids.length;
  if (run.i >= n) {
    const rows = run.ids.map((id) => ({ ex: get('exercises', id), pic: run.chosen[id] })).filter((x) => x.ex);
    const got = rows.filter((x) => x.pic && x.pic.id).length;
    return {
      html: `<a class="set-back" href="#/exercises">← ${esc(t('tab_exercises'))}</a><h1 class="title">${esc(n ? t('picDoneTitle') : t('picAllSet'))}</h1>
        <p class="lead">${esc(n ? t('picDoneText', got, n) : t('picAllSetText'))}</p>
        ${rows.length ? `<div class="card list">${rows.map(({ ex, pic }) => `<a class="row list-row" href="#/exercise/${encodeURIComponent(ex.id)}"><span class="thumb">${pic && pic.id ? `<img src="${esc(frameUrl(pic))}" alt="">` : ''}</span><span class="row-text"><span class="row-title">${esc(ex.name)}</span><span class="row-sub">${esc(pic && pic.id ? pic.name : t('picNoneShort'))}</span></span></a>`).join('')}</div>` : ''}
        <a class="btn primary wide" href="#/exercises" data-action="finish">${esc(t('done'))}</a>`,
      bind(view) { view.querySelector('[data-action=finish]').addEventListener('click', () => { run.ids = null; }); },
      leave() { run.ids = null; },
    };
  }
  const ex = get('exercises', run.ids[run.i]);
  if (!ex) { run.i += 1; return picturesView(); }
  const m = machineOf(ex);
  if (!run.items) {
    suggest(ex).then((items) => { run.items = items; run.sel = items[0]?.id || null; rerender(); }).catch(() => { run.items = []; toast(t('picOffline')); rerender(); });
  }
  const html = `<a class="set-back" href="#/exercises">← ${esc(t('tab_exercises'))}</a>
    <h1 class="title small">${esc(t('picTitle'))}</h1>
    <div class="pic-progress"><span><i style="width:${Math.round((run.i / n) * 100)}%"></i></span><small>${esc(t('nOfM', run.i + 1, n))}</small></div>
    <div class="card pic-ex"><span class="eyebrow">${esc(t('exercise'))}</span><b>${esc(ex.name)}</b><small>${esc([m?.number, m?.name].filter(Boolean).join(' · ') || t('noMachine'))}</small></div>
    <h2 class="section-title">${esc(t('picWhich'))}</h2>
    ${grid(run.items, run.sel)}
    <p class="muted small">${esc(t('picCredit'))}</p>
    <div class="two-actions"><button type="button" class="btn" data-action="none">${esc(t('picNone'))}</button><button type="button" class="btn yellow" data-action="use" ${run.sel ? '' : 'disabled'}>${esc(t('picUse'))}</button></div>`;
  return {
    html,
    bind(view) {
      view.querySelectorAll('[data-pic]').forEach((b) => b.addEventListener('click', () => { run.sel = b.dataset.pic; rerender(); }));
      const next = (pic) => {
        const cur = get('exercises', ex.id);
        upsert('exercises', { ...cur, picture: pic });
        run.chosen[ex.id] = pic;
        Object.assign(run, { i: run.i + 1, items: null, sel: null });
        rerender();
      };
      view.querySelector('[data-action=use]').addEventListener('click', () => { const it = run.items?.find((x) => x.id === run.sel); if (it) next(toPicture(it)); });
      view.querySelector('[data-action=none]').addEventListener('click', () => next({ none: true }));
    },
    leave() { /* keep the place: coming back continues */ },
  };
}

// ---- the machine photo ----

/** A file input that takes a photo; on a phone it opens the camera. */
export function photoInput(machineId, label, cls = 'btn dashed wide') {
  return `<label class="${cls} photo-take">${icon('camera', 18)}${esc(label)}<input type="file" accept="image/*" capture="environment" data-photo-for="${esc(machineId)}" class="sr"></label>`;
}

export function bindPhotoInputs(root) {
  root.querySelectorAll('[data-photo-for]').forEach((inp) => inp.addEventListener('change', async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      await setPhoto(inp.dataset.photoFor, await shrink(f));
      toast(t('photoSaved'));
    } catch { toast(t('photoFailed')); }
    rerender();
  }));
  root.querySelectorAll('[data-photo-remove]').forEach((b) => b.addEventListener('click', async () => { await removePhoto(b.dataset.photoRemove); rerender(); }));
}

/** The machine's photo with Rifai / Togli, or the button to take one. */
export function machinePhotoBlock(m) {
  if (!m || !picturesOn()) return '';
  const url = photoOf(m);
  if (!url) return photoInput(m.id, t('photoTake'));
  return `<figure class="machine-photo"><img src="${esc(url)}" alt="${esc(t('photoOf', m.number || m.name))}"><figcaption>${esc(t('photoYours'))}</figcaption></figure>
    <div class="photo-actions">${photoInput(m.id, t('photoRetake'), 'btn small')}<button type="button" class="btn small ghost" data-photo-remove="${esc(m.id)}">${esc(t('photoRemove'))}</button></div>`;
}

// ---- a small picture that opens full screen (during a workout, in a scheda) ----

/** What to show small for an exercise: the machine photo if there is one, otherwise the exercise's picture. */
export function thumbOf(ex) {
  if (!picturesOn()) return '';
  const m = machineOf(ex);
  return photoOf(m) || (hasPicture(ex) ? frameUrl(ex.picture, 0) : '');
}

export function openViewer(ex) {
  const m = machineOf(ex);
  const photo = photoOf(m);
  const pic = hasPicture(ex);
  const views = [...(photo ? [['photo', t('viewMachine')]] : []), ...(pic ? [['pic', t('viewExercise')]] : [])];
  if (!views.length) return;
  let cur = views[0][0]; let frame = 0;
  const el = document.createElement('div');
  el.className = 'viewer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', ex.name);
  const draw = () => {
    const src = cur === 'photo' ? photo : frameUrl(ex.picture, frame);
    el.innerHTML = `<div class="viewer-top">${views.length > 1 ? `<span class="viewer-seg">${views.map(([k, l]) => `<button type="button" data-v="${k}" class="${k === cur ? 'on' : ''}">${esc(l)}</button>`).join('')}</span>` : '<span></span>'}<button type="button" class="viewer-close" aria-label="${esc(t('close'))}">${icon('close', 24)}</button></div>
      <img src="${esc(src)}" alt="${esc(cur === 'photo' ? t('photoOf', m.number || m.name) : ex.picture.name)}" class="${cur === 'pic' ? 'light' : ''}">
      <p class="viewer-cap">${esc(cur === 'photo' ? [m.number, m.name].filter(Boolean).join(' · ') : `${ex.picture.name} · ${frame ? t('picEnd') : t('picStart')} · ${t('picTapFlip')}`)}</p>`;
    el.querySelector('.viewer-close').onclick = () => el.remove();
    el.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { cur = b.dataset.v; frame = 0; draw(); }; });
    el.querySelector('img').onclick = () => { if (cur === 'pic' && (ex.picture.n || 1) > 1) { frame = 1 - frame; draw(); } };
  };
  draw();
  document.body.appendChild(el);
  const esc2 = (e) => { if (e.key === 'Escape') { el.remove(); document.removeEventListener('keydown', esc2); } };
  document.addEventListener('keydown', esc2);
}
