// Esercizi: the list (by muscle or by place, filtered by type) and the exercise card.
import { state, get, upsert, remove, restore, uid, live, saveSettings } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum, shortDate, num } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, stepper, bindSteppers, stepVal, segmented, empty, exTag, segTabs } from '../ui/parts.js';
import { askConfirm, toast } from '../ui/dialogs.js';
import {
  exercises, places, machines, machineOf, placeOf, whereText, typeLabel, cardioKindLabel, measureLabel, training, increaseSettings, refreshEstimates,
} from '../data.js';
import { CARDIO_KIND_KEYS, EQUIPMENT, measuresFor, defaultTargets, increaseCategory, progressOf } from '../model.js';
import { newMachineSheet } from './gym.js';
import { addExerciseToRoutine } from './routines.js';

const listState = { by: 'muscle', type: 'all', q: '' };

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

export function exercisesView() {
  const compact = Boolean(state.settings.exCompact);
  const collapsed = new Set(state.settings.exCollapsed || []);
  const q = listState.q.trim().toLowerCase();
  let list = exercises().filter((e) => listState.type === 'all' || e.type === listState.type);
  if (q) list = list.filter((e) => [e.name, machineOf(e)?.number, machineOf(e)?.name, ...(e.muscles || [])].some((x) => String(x || '').toLowerCase().includes(q)));
  let groups = [];
  if (listState.by === 'muscle') {
    const keyOf = (e) => (e.type === 'cardio' ? t('cardio') : (e.muscles && e.muscles[0]) || t('other'));
    const keys = [...new Set(list.map(keyOf))].sort((a, b) => (a === t('cardio') ? -1 : b === t('cardio') ? 1 : a === t('other') ? 1 : b === t('other') ? -1 : a.localeCompare(b)));
    groups = keys.map((k) => ({ title: k, rows: list.filter((e) => keyOf(e) === k) }));
  } else {
    const ps = places();
    groups = ps.map((p) => ({ title: p.name, rows: list.filter((e) => placeOf(e)?.id === p.id) }));
    groups.push({ title: t('noPlace'), rows: list.filter((e) => !placeOf(e)) });
  }
  groups = groups.filter((g) => g.rows.length);
  const key = (g) => `${listState.by}:${g.title}`;
  // while searching, every group is open
  const isClosed = (g) => !q && collapsed.has(key(g));
  const allClosed = groups.length && groups.every(isClosed);
  const filters = [['all', t('all')], ['weights', t('type_weights')], ['bodyweight', t('type_bodyweight')], ['cardio', t('type_cardio')]];
  const html = `<header class="page-head tight">
      <h1>${esc(t('tab_exercises'))}</h1>
      <div class="head-actions">
        <button type="button" class="round-btn${compact ? ' on' : ''}" data-action="density" aria-pressed="${compact}" aria-label="${esc(t('compactView'))}" title="${esc(t('compactView'))}">${icon('rowsCompact')}</button>
        <a class="round-btn" href="#/exercise/new" aria-label="${esc(t('newExercise'))}">${icon('plus')}</a>
      </div>
    </header>
    ${segTabs('exercises')}
    <label class="search">${icon('search', 18)}<span class="sr">${esc(t('searchExercise'))}</span><input id="ex-q" type="search" placeholder="${esc(t('searchExercisePh'))}" value="${esc(listState.q)}"></label>
    <div class="filter-row" role="group" aria-label="${esc(t('filterType'))}">
      <button type="button" class="chip-btn by" data-action="by" aria-label="${esc(t('groupBy'))}">${icon('sort', 16)}${esc(listState.by === 'muscle' ? t('byMuscle') : t('byPlace'))}</button>
      <span class="divider" aria-hidden="true"></span>
      ${filters.map(([v, l]) => `<button type="button" class="chip-btn${listState.type === v ? ' on' : ''}" aria-pressed="${listState.type === v}" data-type="${v}">${v !== 'all' ? `<span class="swatch sw-${v}" aria-hidden="true"></span>` : ''}${esc(l)}</button>`).join('')}
    </div>
    ${groups.length > 1 && !q ? `<div class="list-tools"><span class="muted small">${esc(t('nExercisesShort', list.length))}</span><button type="button" class="link-btn" data-action="toggle-all">${esc(allClosed ? t('openAll') : t('closeAll'))}</button></div>` : ''}
    ${groups.length ? `<div class="groups">${groups.map((g) => {
    const closed = isClosed(g);
    return `<section class="group${compact ? ' compact' : ''}">
        <h2 class="group-head"><button type="button" data-group="${esc(key(g))}" aria-expanded="${!closed}">
          <span>${esc(g.title)}</span><span class="count">${g.rows.length}</span>${icon(closed ? 'chevron' : 'down', 16, 'class="chev"')}
        </button></h2>
        ${closed ? '' : `<div class="card list">${g.rows.map((e) => exRow(e, listState.by, compact)).join('')}</div>`}
      </section>`;
  }).join('')}</div>`
    : empty(exercises().length ? t('esNoMatch') : t('esExercisesTitle'), exercises().length ? t('esNoMatchText') : t('esExercisesText'),
      `<a class="btn primary" href="#/exercise/new">${esc(t('newExercise'))}</a>`)}`;
  return {
    html,
    bind(view) {
      view.querySelector('#ex-q').addEventListener('input', (e) => { listState.q = e.target.value; rerender(); });
      view.querySelector('[data-action=by]').addEventListener('click', () => { listState.by = listState.by === 'muscle' ? 'place' : 'muscle'; rerender(); });
      view.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { listState.type = b.dataset.type; rerender(); }));
      view.querySelector('[data-action=density]').addEventListener('click', () => saveSettings({ exCompact: !compact }).then(rerender));
      view.querySelectorAll('[data-group]').forEach((b) => b.addEventListener('click', () => {
        const k = b.dataset.group;
        if (collapsed.has(k)) collapsed.delete(k); else collapsed.add(k);
        saveSettings({ exCollapsed: [...collapsed] }).then(rerender);
      }));
      view.querySelector('[data-action=toggle-all]')?.addEventListener('click', () => {
        const others = [...collapsed].filter((k) => !k.startsWith(`${listState.by}:`));
        saveSettings({ exCollapsed: allClosed ? others : [...others, ...groups.map(key)] }).then(rerender);
      });
    },
  };
}

function rerender() { window.dispatchEvent(new CustomEvent('palestra:render')); }

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
    if (query.type && id === 'new') draft.type = query.type;
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
      <section class="card machine-card">
        ${m ? `<span class="extag tag-weights">${esc(m.number || '·')}</span><div class="row-text"><span class="row-title">${esc(placeOf(ex)?.name || m.name)}</span><span class="row-sub">${esc(m.settings || m.name)}</span></div>`
    : `<div class="row-text"><span class="row-title">${esc(t('noMachine'))}</span><span class="row-sub">${esc(placeOf(ex)?.name || t('noPlace'))}</span></div>`}
      </section>
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

  const html = `<header class="bar">${backLink(back, query.then ? t('back') : t('tab_exercises'))}<button type="button" class="bar-action strong" data-action="save">${esc(t('save'))}</button></header>
    <form class="stack form" data-form="exercise" autocomplete="off">
      <label class="field big"><span class="sr">${esc(t('name'))}</span><input id="ex-name" name="name" value="${esc(ex.name)}" placeholder="${esc(t('exerciseNamePh'))}" ${isNew ? 'autofocus' : ''}></label>
      ${typeSeg}
      ${specific}
      <label class="field"><span>${esc(t('muscles'))}</span><input id="ex-muscles" name="muscles" value="${esc((ex.muscles || []).join(', '))}" placeholder="${esc(t('musclesPh'))}"></label>
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
        draft.muscles = form.muscles.value.split(',').map((s) => s.trim()).filter(Boolean);
        draft.notes = form.notes.value;
        if (form.timed) draft.timed = form.timed.checked;
        if (form.equipment) draft.equipment = form.equipment.value;
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
      form.incMode.addEventListener('change', () => { form.querySelector('[data-inc-custom]').hidden = form.incMode.value !== 'custom'; });
      const newMachine = async (cardio) => {
        read();
        const m = await newMachineSheet({ cardio, placeId: placeOf(draft)?.id });
        if (!m) return;
        draft.machineId = m.id;
        if (cardio) draft.cardio = { kind: m.cardioKind, targets: defaultTargets(m.cardioKind, m) };
        rerender();
      };
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
