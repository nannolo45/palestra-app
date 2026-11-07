// Esercizi: the list (by muscle or by place, filtered by type) and the exercise card.
import { state, get, upsert, remove, restore, uid, live, saveSettings } from '../store.js';
import { t, getLang } from '../i18n.js';
import { REGION_KEYS, MUSCLE_KEYS, REGIONS, regionOf, regionName, muscleName, musclesOf, guessedMuscles, muscleFromWord, regionColor, regionOfMuscle } from '../body.js';
import { esc, fmtNum, shortDate, num } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, stepper, bindSteppers, stepVal, segmented, empty, exTag, trainHead } from '../ui/parts.js';
import { hasPicture, frameUrl } from '../pictures.js';
import { pickPicture, machinePhotoBlock, bindPhotoInputs, missingPictures, picturesOn } from './pictures.js';
import { askConfirm, toast, closeOnTapOutside } from '../ui/dialogs.js';
import {
  exercises, places, machines, machineOf, placeOf, whereText, typeLabel, cardioKindLabel, measureLabel, training, increaseSettings, refreshEstimates,
} from '../data.js';
import { CARDIO_KIND_KEYS, EQUIPMENT, measuresFor, defaultTargets, increaseCategory, progressOf, weightMode } from '../model.js';
import { newMachineSheet } from './gym.js';
import { addExerciseToRoutine } from './routines.js';
import { listKit } from '../ui/listkit.js';
import { loadCatalog, catalogReady, searchCatalog, nameIn, exerciseFrom, yoursFor } from '../catalog.js';
import { activeInfo, allDays } from '../plans.js';


function tagLabel(ex) {
  const m = machineOf(ex);
  if (m && m.number) return m.number;
  if (ex.type === 'cardio') return t('cardioShort');
  if (ex.type === 'bodyweight') return t('bodyShort');
  return t(`eqShort_${ex.equipment || 'machine'}`);
}

function exRow(ex, by, compact) {
  const where = by === 'muscle' ? placeOf(ex)?.name : (ex.muscles || []).join(', ');
  const extra = settingsText(ex);
  if (compact) {
    // one line: tag, name, the one fact that tells exercises apart (targets, settings or zone), a mark if it has notes
    const fact = extra || where || '';
    return `<a class="row list-row compact" href="#/exercise/${encodeURIComponent(ex.id)}">
      ${exTag(ex, tagLabel(ex))}
      <span class="row-title one-line">${esc(ex.name)}</span>
      ${fact ? `<span class="row-fact">${esc(fact)}</span>` : ''}
      ${ex.notes ? `<span class="note-mark" title="${esc(t('hasNotes'))}" aria-label="${esc(t('hasNotes'))}">${icon('pencil', 14)}</span>` : ''}
    </a>`;
  }
  // the tag already says the type: the line under the name only shows what it doesn't
  const detail = [where, extra].filter(Boolean).join(' · ');
  return `<a class="row list-row" href="#/exercise/${encodeURIComponent(ex.id)}">
    ${exTag(ex, tagLabel(ex))}
    <span class="row-text"><span class="row-title">${esc(ex.name)}</span>${detail ? `<span class="row-sub">${esc(detail)}</span>` : ''}
    ${ex.notes ? `<span class="row-note">${icon('pencil', 12)}<span>${esc(ex.notes)}</span></span>` : ''}</span>
    ${icon('chevron', 18, 'class="chev"')}
  </a>`;
}

function settingsText(ex) {
  if (ex.type === 'cardio') {
    const ms = measuresFor(ex, machineOf(ex));
    const tg = ex.cardio?.targets || {};
    return ms.filter((m) => tg[m.key] != null).slice(0, 3)
      .map((m) => (m.unit ? `${fmtNum(tg[m.key])} ${m.unit}` : `${measureLabel(m).toLowerCase()} ${fmtNum(tg[m.key])}`)).join(' · ');
  }
  return machineOf(ex)?.settings || '';
}

export function exercisesView(query = {}) {
  if (query.cat) return catalogView();
  const all = exercises();
  const ps = places();
  const a = activeInfo();
  const inActive = new Set();
  if (a) for (const d of allDays(a.plan)) for (const it of get('routines', d.routineId)?.items || []) inActive.add(it.exerciseId);
  const lang = getLang();
  // v25 grouped by the first muscle word; v26 groups by body region, with the muscles inside
  const saved = (state.settings.lists || {}).ex;
  if (saved && !saved.v26) {
    const f = { ...(saved.f || {}) }; delete f.muscle;
    saveSettings({ lists: { ...state.settings.lists, ex: { ...saved, v26: true, group: saved.group === 'muscle' ? 'region' : saved.group, color: saved.color === 'muscle' ? 'region' : saved.color, f } } }, { quiet: true });
  }
  const regKey = (e) => `r:${regionOf(e)}`;
  const musKey = (e) => `m:${musclesOf(e)[0] || 'none'}`;
  const regName = (k) => regionName(k.slice(2), lang);
  const musName = (k) => (k === 'm:none' ? regionName('unsorted', lang) : muscleName(k.slice(2), lang));
  const regOrder = (ks) => [...REGION_KEYS.map((r) => `r:${r}`), 'r:unsorted'].filter((k) => ks.includes(k));
  const musOrder = (ks) => [...MUSCLE_KEYS.map((m) => `m:${m}`), 'm:none'].filter((k) => ks.includes(k));
  const regColor = (k) => (k === 'r:unsorted' ? '#8A9A99' : regionColor(k.slice(2)));
  const musColor = (k) => (k === 'm:none' ? '#8A9A99' : regionColor(regionOfMuscle(k.slice(2))));
  const zoneKey = (e) => (placeOf(e) ? `z:${placeOf(e).id}` : 'z:none');
  const zoneName = (k) => (k === 'z:none' ? t('noPlace') : get('places', k.slice(2))?.name || '');
  const regs = regOrder([...new Set(all.map(regKey))]);
  const kit = listKit({
    id: 'ex', items: all, searchPh: t('searchExercisePh'), grid: true,
    text: (e) => [e.name, machineOf(e)?.number, machineOf(e)?.name, placeOf(e)?.name, ...musclesOf(e).map((m) => `${muscleName(m, 'it')} ${muscleName(m, 'en')} ${m}`), regionName(regionOf(e), lang)].join(' '),
    noun: (n) => t('nExercisesShort', n),
    groups: {
      region: { label: t('gRegion'), keysOf: (e) => [regKey(e)], name: regName, order: regOrder, defColor: regColor,
        sub: { keyOf: musKey, name: musName, order: musOrder } },
      muscle: { label: t('gMuscle'), keysOf: (e) => [musKey(e)], name: musName, order: musOrder, defColor: musColor },
      zone: { label: t('gZone'), keysOf: (e) => [zoneKey(e)], name: zoneName, order: (ks) => [...ps.map((p) => `z:${p.id}`).filter((k) => ks.includes(k)), ...(ks.includes('z:none') ? ['z:none'] : [])] },
      type: { label: t('gType'), keysOf: (e) => [`t:${e.type}`], name: (k) => t(`type_${k.slice(2)}`), order: (ks) => ['t:weights', 't:bodyweight', 't:cardio'].filter((k) => ks.includes(k)) },
      none: { label: t('gNone'), keysOf: () => ['all'], name: () => '' },
    },
    facets: [
      { key: 'type', label: t('gType'), options: ['weights', 'bodyweight', 'cardio'].map((v) => [v, t(`type_${v}`), `t:${v}`, 'type']), get: (e) => e.type },
      { key: 'region', label: t('gRegion'), options: regs.map((k) => [k, regName(k), k, 'region']), get: regKey },
      { key: 'zone', label: t('gZone'), options: [...ps.map((p) => [`z:${p.id}`, p.name, `z:${p.id}`, 'zone']), ['z:none', t('noPlace'), 'z:none', 'zone']].filter((o) => all.some((e) => zoneKey(e) === o[0])), get: zoneKey },
      ...(a ? [{ key: 'use', label: t('fUse'), options: [['on', t('fInActive')], ['off', t('fNotInActive')]], get: (e) => (inActive.has(e.id) ? 'on' : 'off') }] : []),
    ],
    sorts: [
      { key: 'name', label: t('sName'), cmp: (x, y) => x.name.localeCompare(y.name) },
      { key: 'route', label: t('sRoute'), cmp: (x, y) => (ps.indexOf(placeOf(x)) - ps.indexOf(placeOf(y))) || String(machineOf(x)?.number || '').localeCompare(String(machineOf(y)?.number || ''), undefined, { numeric: true }) || x.name.localeCompare(y.name) },
    ],
    colors: ['region', 'zone', 'type'],
    row: (e, { dense }) => exRow(e, 'muscle', dense),
    def: { group: 'region', sort: 'name', color: 'region', dense: true },
    emptyHtml: empty(t('esExercisesTitle'), t('esExercisesText'), `<a class="btn primary" href="#/exercise/new">${esc(t('newExercise'))}</a>`),
  });
  const html = `${trainHead('exercises')}
    <div class="two-actions" data-top-actions><a class="btn primary" href="#/exercise/new">${icon('plus', 18)}${esc(t('newExercise'))}</a>${picturesOn() ? `<a class="btn only-wide" href="#/pictures">${icon('image', 18)}${esc(t('picTitle'))}</a>` : ''}</div>
    ${exSubTabs('mine', all.length)}
    ${missingPictures().length ? `<a class="card pic-prompt" href="#/pictures">${icon('image', 20)}<span><b>${esc(t('picMatchTitle'))}</b><small>${esc(t('picMatchText', missingPictures().length))}</small></span>${icon('chevron', 18, 'class="chev"')}</a>` : ''}
    ${all.length ? kit.html : empty(t('esExercisesTitle'), t('esExercisesText'), `<a class="btn primary" href="#/exercise/new">${esc(t('newExercise'))}</a>`)}`;
  return { html, bind: kit.bind };
}

function rerender() { window.dispatchEvent(new CustomEvent('palestra:render')); }

// ---- the catalogue (v27) ----

const C = { q: '', region: '', eq: '', limit: 60, open: false };
const CAT_EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function exSubTabs(on, n) {
  return `<nav class="sub-tabs" aria-label="${esc(t('tab_exercises'))}"><a href="#/exercises" class="${on === 'mine' ? 'on' : ''}">${esc(t('myExercises'))} <small>${n}</small></a><a href="#/exercises?cat=1" class="${on === 'cat' ? 'on' : ''}" data-cat-tab>${esc(t('catalogue'))}${catalogReady() ? ` <small>${catCount}</small>` : ''}</a></nav>`;
}
let catCount = 0;

const eqName = (k) => (k === 'bodyweight' ? t('type_bodyweight') : t(`eq_${k}`));

function catalogView() {
  const mine = exercises();
  const lang = getLang();
  const nOn = (C.region ? 1 : 0) + (C.eq ? 1 : 0);
  const html = `${trainHead('exercises')}
    <div class="two-actions" data-top-actions><a class="btn primary" href="#/exercise/new">${icon('plus', 18)}${esc(t('newExercise'))}</a></div>
    ${exSubTabs('cat', mine.length)}
    <div class="kit-tools"><label class="search kit-search">${icon('search', 18)}<span class="sr">${esc(t('searchCatalogue'))}</span><input id="cat-q" type="search" placeholder="${esc(t('searchCatalogue'))}" value="${esc(C.q)}" autocomplete="off"></label>
      <button type="button" class="kit-filter${nOn ? ' on' : ''}${C.open ? ' open' : ''}" data-cat-panel aria-expanded="${C.open}">${icon('filter', 16)}${esc(t('filtersBtn'))}${nOn ? ` <b>${nOn}</b>` : ''}</button></div>
    ${C.open ? `<div class="kit-panel card" data-cat-box>
      <div class="kit-sh">${esc(t('gRegion'))}</div><div class="kit-opts">${[...REGION_KEYS].map((r) => `<button type="button" class="kit-opt${C.region === r ? ' on' : ''}" aria-pressed="${C.region === r}" data-reg="${r}"><span class="dot" style="background:${regionColor(r)}"></span>${esc(regionName(r, lang))}</button>`).join('')}</div>
      <div class="kit-sh">${esc(t('equipment'))}</div><div class="kit-opts">${CAT_EQ.map((k) => `<button type="button" class="kit-opt${C.eq === k ? ' on' : ''}" aria-pressed="${C.eq === k}" data-eq="${k}">${esc(eqName(k))}</button>`).join('')}</div>
      <div class="kit-panel-foot"><button type="button" class="btn small" data-cat-panel>${esc(t('done'))}</button>${nOn ? `<button type="button" class="link-btn" data-cat-reset>${esc(t('clearFilters'))}</button>` : ''}</div></div>`
    : (nOn ? `<div class="kit-ons">${C.region ? `<button type="button" class="kit-on" data-un="region"><span class="dot" style="background:${regionColor(C.region)}"></span>${esc(regionName(C.region, lang))}<span class="x" aria-hidden="true">✕</span><span class="sr">${esc(t('removeFilter'))}</span></button>` : ''}${C.eq ? `<button type="button" class="kit-on" data-un="eq">${esc(eqName(C.eq))}<span class="x" aria-hidden="true">✕</span><span class="sr">${esc(t('removeFilter'))}</span></button>` : ''}</div>` : '')}
    <div data-cat-list><p class="muted">${esc(t('catLoading'))}</p></div>`;
  return {
    html,
    bind(view) {
      const box = view.querySelector('[data-cat-list]');
      const draw = async () => {
        let list;
        try { list = await loadCatalog(); } catch { box.innerHTML = `<p class="muted">${esc(t('catOffline'))}</p>`; return; }
        catCount = list.length;
        const tab = view.querySelector('[data-cat-tab]'); if (tab && !tab.querySelector('small')) tab.insertAdjacentHTML('beforeend', ` <small>${list.length}</small>`);
        const mineNow = exercises();
        const found = searchCatalog(list, C.q, { region: C.region, equipment: C.eq });
        box.innerHTML = `<p class="muted small">${esc(t('nFound', found.length))}</p>
          <div class="card list">${found.slice(0, C.limit).map((c) => {
            const yours = yoursFor(c, mineNow);
            const th = picturesOn() ? frameUrl({ id: c.id, n: c.n }, 0) : '';
            return `<div class="row list-row cat-row">
              ${th ? `<span class="thumb"><img src="${esc(th)}" alt="" loading="lazy"></span>` : `<span class="cat-dot" style="background:${regionColor(c.region)}"></span>`}
              <span class="row-text"><span class="row-title">${esc(nameIn(c, lang))}</span><span class="row-sub">${esc([c.muscle ? muscleName(c.muscle, lang) : regionName(c.region, lang), c.type === 'weights' ? t(`eq_${c.equipment}`) : t(`type_${c.type}`)].filter(Boolean).join(' · '))}</span></span>
              ${yours ? `<a class="cat-have" href="#/exercise/${encodeURIComponent(yours.id)}">✓ ${esc(t('yours'))}</a>` : `<button type="button" class="cat-plus" data-add-cat="${esc(c.id)}" aria-label="${esc(t('addX', nameIn(c, lang)))}" title="${esc(t('add'))}">${icon('plus', 18)}</button>`}
            </div>`;
          }).join('')}</div>
          ${found.length > C.limit ? `<button type="button" class="btn wide" data-more>${esc(t('showMore', found.length - C.limit))}</button>` : ''}
          <a class="card new-box" href="#/exercise/new${C.q ? `?name=${encodeURIComponent(C.q)}` : ''}">${icon('plus', 18)}<span>${C.q && !found.length ? t('createNamed', esc(C.q)) : esc(t('notThereCreate'))}</span></a>`;
        box.querySelector('[data-more]')?.addEventListener('click', () => { C.limit += 60; draw(); });
        box.querySelectorAll('[data-add-cat]').forEach((b) => b.addEventListener('click', () => {
          const c = list.find((x) => x.id === b.dataset.addCat);
          const ex = upsert('exercises', { id: uid(), ...exerciseFrom(c, lang, training().rest) });
          toast(t('addedToYours', ex.name));
          draw();
        }));
      };
      const q = view.querySelector('#cat-q');
      q.addEventListener('input', () => { C.q = q.value; C.limit = 60; draw(); });
      const set = (patch) => { Object.assign(C, patch, { limit: 60 }); rerender(); };
      view.querySelectorAll('[data-reg]').forEach((b) => b.addEventListener('click', () => set({ region: C.region === b.dataset.reg ? '' : b.dataset.reg })));
      view.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', () => set({ eq: C.eq === b.dataset.eq ? '' : b.dataset.eq })));
      view.querySelectorAll('[data-cat-panel]').forEach((b) => b.addEventListener('click', () => set({ open: !C.open })));
      if (C.open) closeOnTapOutside(view.querySelector('[data-cat-box]'), '[data-cat-panel]', () => { if (C.open) { C.open = false; rerender(); } });
      view.querySelector('[data-cat-reset]')?.addEventListener('click', () => set({ region: '', eq: '' }));
      view.querySelectorAll('[data-un]').forEach((b) => b.addEventListener('click', () => set({ [b.dataset.un]: '' })));
      draw();
    },
  };
}

// ---- the card ----

// The card being edited, kept between re-renders until it's saved or left.
let draft = null;

function blankExercise() {
  return { id: uid(), name: '', type: 'weights', equipment: 'machine', muscles: [], defaultRest: training().rest, notes: '', increase: { mode: 'type' } };
}

export function exerciseView(id, query = {}) {
  if (!draft || draft.id !== id && !(id === 'new' && draft._new)) {
    const ex = id === 'new' ? { ...blankExercise(), _new: true } : get('exercises', id);
    if (!ex) return { html: empty(t('notFound'), t('notFoundText'), `<a class="btn" href="#/exercises">${esc(t('tab_exercises'))}</a>`) };
    draft = JSON.parse(JSON.stringify(ex));
    // muscles as keys (v26); words from before that don't match a muscle are dropped when saving
    draft.muscles = [...new Set((draft.muscles || []).map(muscleFromWord).filter(Boolean))];
    if (query.type && id === 'new') draft.type = query.type;
    if (query.name && id === 'new') draft.name = String(query.name);
  }
  const ex = draft;
  const isNew = Boolean(ex._new);
  const back = query.then ? `#/routine/${encodeURIComponent(query.then)}/edit` : (isNew ? '#/exercises' : '#/exercises');
  const typeSeg = segmented({ name: 'type', value: ex.type, options: [['weights', t('type_weights')], ['bodyweight', t('type_bodyweight')], ['cardio', t('type_cardio')]], label: t('exerciseType'), cls: `seg-type type-${ex.type}` });

  let specific = '';
  if (ex.type === 'cardio') {
    const kind = ex.cardio?.kind || 'treadmill';
    const kinds = CARDIO_KIND_KEYS.filter((k) => k !== 'custom');
    const customMachines = machines().filter((m) => m.kind === 'cardio' && m.cardioKind === 'custom');
    const sameKind = machines().filter((m) => m.kind === 'cardio' && (m.cardioKind || 'treadmill') === kind && (kind !== 'custom' || m.id === ex.machineId));
    const m = machineOf(ex);
    const ms = measuresFor(ex, m);
    const tg = { ...defaultTargets(kind, m), ...(ex.cardio?.targets || {}) };
    specific = `<section class="block"><h2 class="section-title">${esc(t('machine'))}</h2>
      <div class="chips">
        ${kinds.map((k) => `<button type="button" class="chip-btn${kind === k ? ' on' : ''}" aria-pressed="${kind === k}" data-kind="${k}">${esc(t(`kind_${k}`))}</button>`).join('')}
        ${customMachines.map((cm) => `<button type="button" class="chip-btn${kind === 'custom' && ex.machineId === cm.id ? ' on' : ''}" aria-pressed="${kind === 'custom' && ex.machineId === cm.id}" data-custom="${esc(cm.id)}">${esc(cm.name)}</button>`).join('')}
        <button type="button" class="chip-btn dashed" data-action="new-cardio">+ ${esc(t('otherMachine'))}</button>
      </div>
      ${kind !== 'custom' && sameKind.length ? `<label class="field"><span>${esc(t('whichOnes'))}</span><select name="machineId"><option value="">${esc(t('anyOfThem'))}</option>${sameKind.map((x) => `<option value="${esc(x.id)}" ${x.id === ex.machineId ? 'selected' : ''}>${esc([x.number, x.name].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>` : ''}
      ${m && placeOf(ex) ? `<p class="muted small">${esc(whereText(ex))}</p>` : ''}
      ${m ? machinePhotoBlock(m) : ''}
    </section>
    <section class="block"><h2 class="section-title">${esc(t('target'))}</h2>
      <div class="card stack-rows">${ms.map((mm) => stepper({ name: `t_${mm.key}`, value: tg[mm.key] ?? 0, step: mm.step, min: mm.min ?? 0, unit: mm.unit, label: measureLabel(mm) })).join('')}</div>
      <p class="muted small">${esc(t('targetHint'))}</p>
    </section>`;
  } else {
    const isWeights = ex.type === 'weights';
    const ms = machines().filter((m) => m.kind !== 'cardio');
    const m = machineOf(ex);
    specific = `${isWeights ? `<label class="field"><span>${esc(t('equipment'))}</span><select name="equipment">${EQUIPMENT.map((q) => `<option value="${q}" ${ex.equipment === q ? 'selected' : ''}>${esc(t(`eq_${q}`))}</option>`).join('')}</select></label>` : ''}
      ${isWeights ? weightAsBlock(ex) : ''}
      <section class="card machine-card">
        ${m ? `<span class="extag tag-weights">${esc(m.number || '·')}</span><div class="row-text"><span class="row-title">${esc(placeOf(ex)?.name || m.name)}</span><span class="row-sub">${esc(m.settings || m.name)}</span></div>`
    : `<div class="row-text"><span class="row-title">${esc(t('noMachine'))}</span><span class="row-sub">${esc(placeOf(ex)?.name || t('noPlace'))}</span></div>`}
      </section>
      ${m ? machinePhotoBlock(m) : ''}
      <div class="two">
        <label class="field"><span>${esc(t('machine'))}</span><select name="machineId"><option value="">${esc(t('none'))}</option>${ms.map((x) => `<option value="${esc(x.id)}" ${x.id === ex.machineId ? 'selected' : ''}>${esc([x.number, x.name].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>
        ${!ex.machineId ? `<label class="field"><span>${esc(t('place'))}</span><select name="placeId"><option value="">${esc(t('none'))}</option>${places().map((p) => `<option value="${esc(p.id)}" ${p.id === ex.placeId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
      </div>
      <button type="button" class="btn dashed wide" data-action="new-machine">+ ${esc(t('newMachine'))}</button>
      ${stepper({ name: 'defaultRest', value: ex.defaultRest ?? training().rest, step: 15, min: 0, unit: 's', label: t('defaultRest') })}`;
  }

  const inc = ex.increase || { mode: 'type' };
  const cat = increaseCategory(ex);
  const typeStep = increaseSettings().steps[cat];
  const unit = ex.type === 'cardio' ? 'min' : ex.type === 'bodyweight' ? t('repsShort') : 'kg';
  const prog = !isNew ? progressOf(ex, live('sessions')) : [];
  const lastP = prog[prog.length - 1];

  const html = `<header class="bar">${backLink(back, query.then ? t('back') : t('crumb', t('tab_exercises')))}<button type="button" class="bar-action strong" data-action="save">${esc(t('save'))}</button></header>
    <form class="stack form" data-form="exercise" autocomplete="off">
      <label class="field big"><span class="sr">${esc(t('name'))}</span><input id="ex-name" name="name" value="${esc(ex.name)}" placeholder="${esc(t('exerciseNamePh'))}" ${isNew ? 'autofocus' : ''}></label>
      ${pictureBlock(ex)}
      ${typeSeg}
      ${specific}
      ${ex.type === 'cardio' ? '' : musclePicker(ex)}
      ${ex.type === 'bodyweight' ? `<label class="check"><input type="checkbox" name="timed" ${ex.timed ? 'checked' : ''}> ${esc(t('timedHint'))}</label>` : ''}
      <label class="field"><span>${esc(t('notes'))} <small class="muted">${esc(t('optional'))}</small></span>
        <textarea id="ex-notes" name="notes" rows="3" class="note-area" placeholder="${esc(t('notesPh'))}">${esc(ex.notes || '')}</textarea>
        <small class="muted">${esc(t('notesHint'))}</small></label>
      <section class="card">
        <label class="field inline"><span>${esc(t('autoIncrease'))}</span>
          <select name="incMode">
            <option value="type" ${inc.mode === 'type' ? 'selected' : ''}>${esc(t('incLikeType', t(`cat_${cat}`), typeStep ? `+${fmtNum(typeStep)} ${unit}` : t('incNone')))}</option>
            <option value="custom" ${inc.mode === 'custom' ? 'selected' : ''}>${esc(t('incCustom'))}</option>
            <option value="off" ${inc.mode === 'off' ? 'selected' : ''}>${esc(t('incOff'))}</option>
          </select></label>
        <div data-inc-custom ${inc.mode === 'custom' ? '' : 'hidden'}>${stepper({ name: 'incStep', value: inc.step ?? typeStep ?? 1, step: ex.type === 'weights' ? 0.5 : 1, min: 0, unit, label: t('incStep') })}</div>
        ${lastP ? `<div class="kv"><span>${esc(t('lastTime'))}</span><b>${esc(lastText(ex, lastP))}</b></div><a class="row-link" href="#/history?ex=${encodeURIComponent(ex.id)}">${esc(t('seeProgress'))}${icon('chevron', 16)}</a>` : ''}
      </section>
      ${isNew ? '' : `<button type="button" class="btn danger-text wide" data-action="delete">${esc(t('deleteExercise'))}</button>`}
    </form>`;

  return {
    html,
    bind(view) {
      const form = view.querySelector('[data-form=exercise]');
      const read = () => {
        draft.name = form.name.value;
        draft.notes = form.notes.value;
        if (form.timed) draft.timed = form.timed.checked;
        if (form.equipment) draft.equipment = form.equipment.value;
        if (form.weightAs) draft.weightAs = form.weightAs.value;
        if (form.dumbbells) draft.dumbbells = Number(form.dumbbells.value);
        if (form.machineId) draft.machineId = form.machineId.value || undefined;
        if (form.placeId) draft.placeId = form.placeId.value || undefined;
        if (form.defaultRest) draft.defaultRest = stepVal(form, 'defaultRest');
        const mode = form.incMode.value;
        draft.increase = mode === 'custom' ? { mode, step: stepVal(form, 'incStep') ?? 0 } : { mode };
        if (draft.type === 'cardio') {
          const tg = { ...(draft.cardio?.targets || {}) };
          form.querySelectorAll('[data-stepper^="t_"]').forEach((b) => { tg[b.dataset.stepper.slice(2)] = num(b.querySelector('input').value) ?? 0; });
          draft.cardio = { ...(draft.cardio || {}), targets: tg };
        }
      };
      bindSteppers(form);
      form.querySelectorAll('[name=type]').forEach((x) => x.addEventListener('change', () => {
        read();
        draft.type = x.value;
        if (draft.type === 'cardio' && !draft.cardio) draft.cardio = { kind: 'treadmill', targets: defaultTargets('treadmill') };
        if (draft.type !== 'cardio' && machineOf(draft)?.kind === 'cardio') draft.machineId = undefined;
        if (draft.type === 'cardio' && machineOf(draft)?.kind !== 'cardio') draft.machineId = undefined;
        rerender();
      }));
      form.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
        read();
        draft.cardio = { kind: b.dataset.kind, targets: defaultTargets(b.dataset.kind) };
        draft.machineId = undefined;
        rerender();
      }));
      form.querySelectorAll('[data-custom]').forEach((b) => b.addEventListener('click', () => {
        read();
        const m = get('machines', b.dataset.custom);
        draft.cardio = { kind: 'custom', targets: defaultTargets('custom', m) };
        draft.machineId = m.id;
        rerender();
      }));
      form.machineId?.addEventListener('change', () => { read(); rerender(); });
      form.querySelectorAll('[data-mus]').forEach((b) => b.addEventListener('click', () => {
        read();
        const k = b.dataset.mus;
        const cur = draft.muscles.length ? draft.muscles : [];
        draft.muscles = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
        rerender();
      }));
      form.equipment?.addEventListener('change', () => { read(); delete draft.weightAs; rerender(); });
      form.querySelectorAll('[name=weightAs],[name=dumbbells]').forEach((x) => x.addEventListener('change', () => { read(); rerender(); }));
      form.incMode.addEventListener('change', () => { form.querySelector('[data-inc-custom]').hidden = form.incMode.value !== 'custom'; });
      const newMachine = async (cardio) => {
        read();
        const m = await newMachineSheet({ cardio, placeId: placeOf(draft)?.id });
        if (!m) return;
        draft.machineId = m.id;
        if (cardio) draft.cardio = { kind: m.cardioKind, targets: defaultTargets(m.cardioKind, m) };
        rerender();
      };
      bindPhotoInputs(view);
      view.querySelectorAll('[data-frame]').forEach((b) => b.addEventListener('click', () => { picFrame = Number(b.dataset.frame); rerender(); }));
      view.querySelector('[data-action=pick-picture]')?.addEventListener('click', async () => {
        read();
        const pic = await pickPicture(draft);
        if (!pic) return;
        draft.picture = pic; picFrame = 0;
        // pictures are saved at once for an existing exercise, like the machine photo
        if (!isNew) { const cur = get('exercises', id); if (cur) upsert('exercises', { ...cur, picture: pic }); }
        rerender();
      });
      view.querySelector('[data-action=new-machine]')?.addEventListener('click', () => newMachine(false));
      view.querySelector('[data-action=new-cardio]')?.addEventListener('click', () => newMachine(true));
      view.querySelector('[data-action=save]').addEventListener('click', () => {
        read();
        if (!draft.name.trim()) { form.name.focus(); toast(t('nameNeeded')); return; }
        const rec = { ...draft, name: draft.name.trim() };
        delete rec._new;
        if (rec.type !== 'cardio') delete rec.cardio;
        upsert('exercises', rec);
        refreshEstimates();
        draft = null;
        if (query.then) { addExerciseToRoutine(query.then, rec.id); location.hash = `#/routine/${encodeURIComponent(query.then)}/edit`; } else location.hash = '#/exercises';
        toast(t('saved'));
      });
      view.querySelector('[data-action=delete]')?.addEventListener('click', async () => {
        const used = state.routines.filter((r) => !r.deleted && (r.items || []).some((it) => it.exerciseId === id)).map((r) => r.name);
        if (!(await askConfirm({ text: used.length ? t('deleteExerciseUsed', draft.name, used.join(', ')) : t('deleteExerciseQ', draft.name), ok: t('delete'), danger: true }))) return;
        const before = remove('exercises', id);
        draft = null;
        location.hash = '#/exercises';
        toast(t('deleted', before.name), { undo: () => restore('exercises', before) });
      });
    },
    leave() { draft = null; },
  };
}

function lastText(ex, p) {
  if (ex.type === 'cardio') {
    const s = p.sets[0];
    const ms = measuresFor(ex, machineOf(ex)).slice(1, 2);
    return [`${fmtNum(p.value)} min`, ...ms.map((m) => (s.targets?.[m.key] != null ? `${fmtNum(s.targets[m.key])} ${m.unit}` : '')), s.distance ? `${fmtNum(s.distance)} km` : ''].filter(Boolean).join(' · ') + ` · ${shortDate(p.start)}`;
  }
  const sets = p.sets.length;
  if (ex.type === 'weights') return `${sets} × ${p.sets[0].reps} · ${fmtNum(p.value)} kg · ${shortDate(p.start)}`;
  return `${sets} × ${p.sets[0].reps ?? `${p.sets[0].seconds} s`} · ${shortDate(p.start)}`;
}

export function resetExerciseDraft() { draft = null; }

/**
 * The muscles, as tags under each body region: tap to add or remove; the first one chosen is the main one. With none
 * chosen, the ones recognised from the name are shown (dashed) and used.
 */
function musclePicker(ex) {
  const lang = getLang();
  const chosen = ex.muscles || [];
  const guessed = chosen.length ? [] : guessedMuscles({ ...ex, muscles: [] });
  const hint = chosen.length ? t('musclesChosen', muscleName(chosen[0], lang))
    : guessed.length ? t('musclesGuessed', guessed.map((m) => muscleName(m, lang)).join(', ')) : t('musclesNone');
  return `<div class="field mus-field"><span class="field-label">${esc(t('muscles'))}</span>
    <div class="mus-pick">${REGIONS.filter((r) => r.key !== 'cardio').map((r) => `<div class="mus-reg" style="--c:${r.color}"><span class="mus-rn">${esc(regionName(r.key, lang))}</span>
      ${r.muscles.map((m) => { const i = chosen.indexOf(m); const on = i >= 0; const g = !on && guessed.includes(m); return `<button type="button" class="mus-chip${on ? ' on' : ''}${g ? ' guess' : ''}${i === 0 ? ' main' : ''}" data-mus="${m}" aria-pressed="${on}">${esc(muscleName(m, lang))}</button>`; }).join('')}</div>`).join('')}</div>
    <small class="muted">${esc(hint)}</small></div>`;
}

// ---- the exercise's picture (free-exercise-db), at the top of its page ----

let picFrame = 0;

/** Dumbbells and barbell: what the number in the workout means (per dumbbell or in all; bar included or per side). */
function weightAsBlock(ex) {
  const m = weightMode(ex);
  if (m === 'plain') return '';
  const db = ex.equipment === 'dumbbell';
  const opts = db ? [['each', t('wAsEach')], ['total', t('wAsTotal')]] : [['total', t('wAsBar')], ['side', t('wAsSide')]];
  const val = db ? (m === 'dbTotal' ? 'total' : 'each') : (m === 'barSide' ? 'side' : 'total');
  return `<div class="field"><span class="field-label">${esc(t('weightAs'))}</span>${segmented({ name: 'weightAs', value: val, options: opts, label: t('weightAs') })}</div>
    ${db && m !== 'dbTotal' ? `<div class="field"><span class="field-label">${esc(t('dumbbellsN'))}</span>${segmented({ name: 'dumbbells', value: m === 'dbOne' ? 1 : 2, options: [[1, '1'], [2, '2']], label: t('dumbbellsN') })}</div>` : ''}
    <p class="muted small">${esc(t(db ? 'weightAsHintDb' : 'weightAsHintBar'))}</p>`;
}

function pictureBlock(ex) {
  if (!picturesOn()) return '';
  if (!hasPicture(ex)) {
    return `<button type="button" class="btn dashed wide" data-action="pick-picture">${icon('image', 18)}${esc(ex.picture?.none ? t('picChooseAgain') : t('picChoose'))}</button>`;
  }
  const two = (ex.picture.n || 1) > 1;
  return `<section class="card pic-card">
      <div class="pic-frame"><img src="${esc(frameUrl(ex.picture, picFrame))}" alt="${esc(`${ex.picture.name} · ${picFrame ? t('picEnd') : t('picStart')}`)}">
        ${two ? `<span class="pic-frames" role="group" aria-label="${esc(t('picMovement'))}"><button type="button" data-frame="0" class="${picFrame ? '' : 'on'}" aria-pressed="${!picFrame}">${esc(t('picStart'))}</button><button type="button" data-frame="1" class="${picFrame ? 'on' : ''}" aria-pressed="${Boolean(picFrame)}">${esc(t('picEnd'))}</button></span>` : ''}</div>
      <div class="pic-foot"><small>${esc(`${ex.picture.name} · ${t('picSource')}`)}</small><button type="button" class="btn small" data-action="pick-picture">${esc(t('change'))}</button></div>
    </section>`;
}
