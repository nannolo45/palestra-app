// Palestra: the gym as a walking route. Zones in order, the machines in each, and the machine sheet
// (also used from an exercise card for a machine that isn't listed yet).
import { state, get, upsert, remove, restore, uid, pref } from '../store.js';
import { t } from '../i18n.js';
import { esc } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { empty, segmented, segTabs, gearLink } from '../ui/parts.js';
import { openSheet, askConfirm, toast } from '../ui/dialogs.js';
import { places, machines } from '../data.js';
import { CARDIO_KIND_KEYS, PICKABLE, MAX_EXTRA_MEASURES, MEASURES, customMeasureKey } from '../model.js';

let sorting = false;

export function gymView() {
  const ps = places();
  const ms = machines();
  const loose = ms.filter((m) => !m.placeId || !get('places', m.placeId));
  const gymName = pref('gymName', '');
  const count = ms.length;
  const zone = (p, i, last) => {
    const inZone = ms.filter((m) => m.placeId === p.id);
    return `<div class="zone" data-sort-key="${esc(p.id)}">
      <div class="zone-rail">
        ${sorting ? `<button type="button" class="drag-handle num-dot big" aria-label="${esc(t('moveItem', p.name))}">${icon('grip', 18)}</button>` : `<span class="num-dot big">${i + 1}</span>`}
        ${last ? '' : '<span class="rail" aria-hidden="true"></span>'}
      </div>
      <div class="zone-body">
        <div class="zone-head"><button type="button" class="zone-name" data-place="${esc(p.id)}">${esc(p.name)}</button><span class="muted small">${esc(t('nStations', inZone.length))}</span></div>
        <div class="chips">
          ${inZone.map((m) => `<button type="button" class="machine-chip" data-machine="${esc(m.id)}"><span class="mnum${m.kind === 'cardio' ? ' cardio' : ''}">${esc(m.number || '·')}</span>${esc(m.name)}</button>`).join('')}
          <button type="button" class="machine-chip add" data-add-machine="${esc(p.id)}" aria-label="${esc(t('addMachineTo', p.name))}">${icon('plus', 16)}</button>
        </div>
      </div>
    </div>`;
  };
  const html = `<header class="page-head">
      <div><h1>${esc(t('tab_exercises'))}</h1><p class="sub">${esc([gymName || t('yourGym'), t('nZones', ps.length), t('nStations', count)].join(' · '))}</p></div>
      <div class="head-actions">${gearLink()}</div>
    </header>
    ${segTabs('gym')}
    ${ps.length ? `<div class="lead-row"><p class="lead">${esc(t('walkOrderHint'))}</p>${ps.length > 1 ? `<button type="button" class="pill-btn${sorting ? ' on' : ''}" data-action="sort" aria-pressed="${sorting}">${icon('sort', 18)}${esc(sorting ? t('done') : t('reorder'))}</button>` : ''}</div>
      <div class="route" data-sortable="places">${ps.map((p, i) => zone(p, i, i === ps.length - 1)).join('')}</div>` : empty(t('esGymTitle'), t('esGymText'))}
    ${loose.length ? `<section class="group"><h2 class="section-title">${esc(t('noPlace'))}</h2><div class="chips">${loose.map((m) => `<button type="button" class="machine-chip" data-machine="${esc(m.id)}"><span class="mnum">${esc(m.number || '·')}</span>${esc(m.name)}</button>`).join('')}</div></section>` : ''}
    <button type="button" class="btn dashed wide" data-action="add-place">${icon('plus', 18)}${esc(t('addZone'))}</button>`;
  return {
    html,
    bind(view) {
      view.querySelector('[data-action=sort]')?.addEventListener('click', () => { sorting = !sorting; rerender(); });
      view.querySelector('[data-sortable=places]')?.addEventListener('sorted', (e) => {
        e.detail.keys.forEach((id, i) => { const p = get('places', id); if (p && p.order !== i) upsert('places', { ...p, order: i }, { silent: true }); });
        rerender();
      });
      view.querySelector('[data-action=add-place]').addEventListener('click', () => placeSheet());
      view.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => placeSheet(get('places', b.dataset.place))));
      view.querySelectorAll('[data-machine]').forEach((b) => b.addEventListener('click', () => newMachineSheet({ machine: get('machines', b.dataset.machine) })));
      view.querySelectorAll('[data-add-machine]').forEach((b) => b.addEventListener('click', () => newMachineSheet({ placeId: b.dataset.addMachine })));
    },
    leave() { sorting = false; },
  };
}

function rerender() { window.dispatchEvent(new CustomEvent('palestra:render')); }

async function placeSheet(place = null) {
  const html = `<h2>${esc(place ? t('editZone') : t('newZone'))}</h2>
    <label class="field"><span>${esc(t('name'))}</span><input name="name" value="${esc(place?.name || '')}" placeholder="${esc(t('zonePh'))}" autofocus autocomplete="off"></label>
    <label class="field"><span>${esc(t('note'))} <small class="muted">${esc(t('optional'))}</small></span><input name="note" value="${esc(place?.note || '')}" autocomplete="off"></label>
    <div class="button-row"><button class="btn primary" value="save">${esc(t('save'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>
    ${place ? `<button type="button" class="btn danger-text wide" data-remove>${esc(t('deleteZone'))}</button>` : ''}`;
  await openSheet(html, (form, close) => {
    form.querySelector('[value=save]').addEventListener('click', () => {
      const name = form.name.value.trim();
      if (!name) { form.name.focus(); return; }
      upsert('places', { ...(place || { id: uid(), order: places().length }), name, note: form.note.value.trim() });
      close(true);
    });
    form.querySelector('[data-remove]')?.addEventListener('click', async () => {
      close(false);
      const inZone = state.machines.filter((m) => !m.deleted && m.placeId === place.id).length;
      if (inZone && !(await askConfirm({ text: t('deleteZoneQ', place.name, inZone), ok: t('delete'), danger: true }))) return;
      const before = remove('places', place.id);
      toast(t('deleted', place.name), { undo: () => restore('places', before) });
    });
  });
}

/**
 * Add or edit a machine. Resolves with the saved machine (or null).
 * cardio: start as a cardio machine; placeId: start in that zone.
 */
export async function newMachineSheet({ machine = null, cardio = false, placeId = '' } = {}) {
  const m = machine ? JSON.parse(JSON.stringify(machine)) : { id: uid(), name: '', number: '', placeId: placeId || '', kind: cardio ? 'cardio' : 'weights', cardioKind: cardio ? 'custom' : undefined, measures: cardio ? [] : undefined, settings: '' };
  const zoneDefault = m.placeId || (m.kind === 'cardio' ? places().find((p) => /cardio/i.test(p.name))?.id : '') || '';
  let sel = new Set((m.measures || []).map((x) => (typeof x === 'string' ? x : x.key)));
  let custom = (m.measures || []).filter((x) => typeof x !== 'string');
  const render = (form) => {
    const isCardio = form.querySelector('[name=kind]:checked').value === 'cardio';
    const ck = form.cardioKind ? form.cardioKind.value : m.cardioKind;
    form.querySelector('[data-weights]').hidden = isCardio;
    form.querySelector('[data-cardio]').hidden = !isCardio;
    form.querySelector('[data-measures]').hidden = !isCardio || ck !== 'custom';
    const count = sel.size + custom.length;
    form.querySelector('[data-count]').textContent = t('nOfMax', count, MAX_EXTRA_MEASURES);
    form.querySelectorAll('[data-measure]').forEach((b) => {
      const on = sel.has(b.dataset.measure);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = !on && count >= MAX_EXTRA_MEASURES;
    });
    form.querySelector('[data-custom-list]').innerHTML = custom.map((c, i) => `<span class="chip-btn on">${esc(c.label)}${c.unit ? ` (${esc(c.unit)})` : ''}<button type="button" class="x" data-uncustom="${i}" aria-label="${esc(t('removeX', c.label))}">×</button></span>`).join('');
    form.querySelectorAll('[data-uncustom]').forEach((b) => b.addEventListener('click', () => { custom.splice(Number(b.dataset.uncustom), 1); render(form); }));
    form.querySelector('[data-add-custom]').disabled = count >= MAX_EXTRA_MEASURES;
    const name = form.name.value.trim() || t('newMachine');
    const num = form.number.value.trim();
    const what = !isCardio ? (form.settings.value.trim() || t('noSettings'))
      : ck === 'custom' ? [t('m_duration'), ...[...sel].map((k) => t(`m_${k}`)), ...custom.map((c) => c.label)].join(', ')
        : t(`kind_${ck}`);
    form.querySelector('[data-preview]').innerHTML = `<span class="extag ${isCardio ? 'tag-cardio' : 'tag-weights'}">${esc(num || '·')}</span><div><b>${esc(name)}</b><small>${esc(what)}</small></div>`;
  };
  const html = `<h2>${esc(machine ? t('editMachine') : t('newMachine'))}</h2>
    <div class="two wide-first">
      <label class="field"><span>${esc(t('name'))}</span><input name="name" value="${esc(m.name)}" placeholder="${esc(t('machineNamePh'))}" autofocus autocomplete="off"></label>
      <label class="field"><span>${esc(t('number'))}</span><input name="number" value="${esc(m.number || '')}" placeholder="M14" autocomplete="off"></label>
    </div>
    <label class="field"><span>${esc(t('zone'))}</span><select name="placeId"><option value="">${esc(t('none'))}</option>${places().map((p) => `<option value="${esc(p.id)}" ${p.id === zoneDefault ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    ${segmented({ name: 'kind', value: m.kind || 'weights', options: [['weights', t('type_weights')], ['cardio', t('type_cardio')]], label: t('machineType'), cls: 'seg-type' })}
    <div data-weights><label class="field"><span>${esc(t('settingsOfMachine'))}</span><input name="settings" value="${esc(m.settings || '')}" placeholder="${esc(t('settingsPh'))}" autocomplete="off"></label></div>
    <div data-cardio>
      <label class="field"><span>${esc(t('cardioKind'))}</span><select name="cardioKind">${CARDIO_KIND_KEYS.map((k) => `<option value="${k}" ${(m.cardioKind || 'custom') === k ? 'selected' : ''}>${esc(t(k === 'custom' ? 'kind_otherMeasures' : `kind_${k}`))}</option>`).join('')}</select></label>
      <section data-measures class="stack">
        <div class="field-head"><span>${esc(t('whatItMeasures'))}</span><small class="muted" data-count></small></div>
        <div class="chips"><span class="chip-btn on locked">${icon('lock', 14)}${esc(t('m_duration'))}</span>
          ${PICKABLE.map((k) => `<button type="button" class="chip-btn" data-measure="${k}">${esc(t(`m_${k}`))}</button>`).join('')}
          <span data-custom-list></span>
        </div>
        <div class="card dashed-card stack">
          <b>${esc(t('customMeasure'))}</b>
          <div class="two wide-first">
            <label class="field"><span>${esc(t('name'))}</span><input name="cmLabel" placeholder="${esc(t('customMeasurePh'))}" autocomplete="off"></label>
            <label class="field"><span>${esc(t('unit'))}</span><input name="cmUnit" placeholder="W" autocomplete="off"></label>
          </div>
          <button type="button" class="btn small" data-add-custom>${esc(t('addMeasure'))}</button>
        </div>
      </section>
    </div>
    <div class="preview card dark" data-preview></div>
    <div class="button-row"><button class="btn primary" value="save">${esc(machine ? t('save') : t('add'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>
    ${machine ? `<button type="button" class="btn danger-text wide" data-remove>${esc(t('deleteMachine'))}</button>` : ''}`;
  return openSheet(html, (form, close) => {
    render(form);
    form.addEventListener('input', () => render(form));
    form.addEventListener('change', () => render(form));
    form.querySelectorAll('[data-measure]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.measure;
      if (sel.has(k)) sel.delete(k); else if (sel.size + custom.length < MAX_EXTRA_MEASURES) sel.add(k);
      render(form);
    }));
    form.querySelector('[data-add-custom]').addEventListener('click', () => {
      const label = form.cmLabel.value.trim();
      if (!label) { form.cmLabel.focus(); return; }
      if (sel.size + custom.length >= MAX_EXTRA_MEASURES) return;
      custom.push({ key: customMeasureKey(label), label, unit: form.cmUnit.value.trim(), step: 1 });
      form.cmLabel.value = ''; form.cmUnit.value = '';
      render(form);
    });
    form.querySelector('[value=save]').addEventListener('click', () => {
      const name = form.name.value.trim();
      if (!name) { form.name.focus(); toast(t('nameNeeded')); return; }
      const kind = form.querySelector('[name=kind]:checked').value;
      const rec = { ...m, name, number: form.number.value.trim(), placeId: form.placeId.value || undefined, kind };
      if (kind === 'cardio') {
        rec.cardioKind = form.cardioKind.value;
        rec.measures = rec.cardioKind === 'custom' ? [...PICKABLE.filter((k) => sel.has(k)), ...custom] : undefined;
        delete rec.settings;
      } else {
        rec.settings = form.settings.value.trim();
        delete rec.cardioKind; delete rec.measures;
      }
      close(upsert('machines', rec));
    });
    form.querySelector('[data-remove]')?.addEventListener('click', async () => {
      close(null);
      const used = state.exercises.filter((e) => !e.deleted && e.machineId === machine.id).map((e) => e.name);
      if (!(await askConfirm({ text: used.length ? t('deleteMachineUsed', machine.name, used.join(', ')) : t('deleteMachineQ', machine.name), ok: t('delete'), danger: true }))) return;
      const before = remove('machines', machine.id);
      toast(t('deleted', machine.name), { undo: () => restore('machines', before) });
    });
  });
}

export { MEASURES };
