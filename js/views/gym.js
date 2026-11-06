// Palestra: the gym as a walking route. Zones in order, the machines in each, and the machine sheet
// (also used from an exercise card for a machine that isn't listed yet).
import { state, get, upsert, remove, restore, uid, saveSettings, setPref } from '../store.js';
import { t } from '../i18n.js';
import { esc } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { empty, segmented, gearLink } from '../ui/parts.js';
import { openSheet, askConfirm, toast } from '../ui/dialogs.js';
import { places, machines } from '../data.js';
import { CARDIO_KIND_KEYS, PICKABLE, MAX_EXTRA_MEASURES, MEASURES, customMeasureKey } from '../model.js';
import { gyms, gymById, gymName, mainGym, placeGymId, addGym, updateGym, removeGym } from '../gyms.js';
import { EQUIP, gymHas, needOf } from '../body.js';

let sorting = false;


export function gymView(query = {}) {
  if (query.g && query.g !== state.settings.gymTab) saveSettings({ gymTab: query.g }, { quiet: true });
  const g = gymById(query.g || state.settings.gymTab);
  const isMain = g.id === mainGym().id;
  const ps = places().filter((p) => placeGymId(p) === g.id);
  const ms = machines();
  const loose = isMain ? ms.filter((m) => !m.placeId || !get('places', m.placeId)) : [];
  const count = ms.filter((m) => ps.some((p) => p.id === m.placeId)).length + loose.length;
  const v = query.v === 'eq' ? 'eq' : 'zones';
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
  const zonesHtml = `${ps.length ? `<div class="lead-row"><p class="lead">${esc(t('walkOrderHint'))}</p>${ps.length > 1 ? `<button type="button" class="pill-btn${sorting ? ' on' : ''}" data-action="sort" aria-pressed="${sorting}">${icon('sort', 18)}${esc(sorting ? t('done') : t('reorder'))}</button>` : ''}</div>
      <div class="route" data-sortable="places">${ps.map((p, i) => zone(p, i, i === ps.length - 1)).join('')}</div>` : empty(t('esGymTitle'), t('esGymText'))}
    ${loose.length ? `<section class="group"><h2 class="section-title">${esc(t('noPlace'))}</h2><div class="chips">${loose.map((m) => `<button type="button" class="machine-chip" data-machine="${esc(m.id)}"><span class="mnum">${esc(m.number || '·')}</span>${esc(m.name)}</button>`).join('')}</div></section>` : ''}
    <button type="button" class="btn dashed wide" data-action="add-place">${icon('plus', 18)}${esc(t('addZone'))}</button>`;
  const have = EQUIP.filter((k) => gymHas(g, k)).length;
  const eqHtml = `<section class="card eq-card"><h2 class="card-title">${esc(t('gymEquipment'))}<small class="muted">${esc(t('nOfM', have, EQUIP.length))}</small></h2>
      <p class="muted small">${esc(t('eqHint', gymName(g)))}</p>
      ${EQUIP.map((k) => `<label class="check eq-row"><input type="checkbox" data-eq="${k}" ${gymHas(g, k) ? 'checked' : ''}> ${esc(t(`eqk_${k}`))}</label>`).join('')}
    </section>`;
  const tabs = `<nav class="gym-tabs" aria-label="${esc(t('gymsLabel'))}">${gyms().map((x) => `<a href="#/gym?g=${encodeURIComponent(x.id)}" class="${x.id === g.id ? 'on' : ''}" data-gym-tab="${esc(x.id)}"${x.id === g.id ? ' aria-current="page"' : ''}>${esc(gymName(x))}</a>`).join('')}<button type="button" class="gym-add" data-action="add-gym">${icon('plus', 16)}${esc(t('anotherGym'))}</button></nav>`;
  const html = `<header class="page-head">
      <div><h1>${esc(t('tab_gym'))}</h1><p class="sub">${esc([t('nZones', ps.length), t('nStations', count)].join(' · '))}</p></div>
      <div class="head-actions"><button type="button" class="round-btn" data-action="gym-sheet" aria-label="${esc(t('gymSettings', gymName(g)))}">${icon('pencil', 18)}</button>${gearLink()}</div>
    </header>
    ${tabs}
    <div class="two-actions" data-top-actions><button type="button" class="btn primary" data-action="add-place">${icon('plus', 18)}${esc(t('plusZone'))}</button>${ps.length ? `<button type="button" class="btn" data-add-machine="${esc(ps[0].id)}">${icon('plus', 18)}${esc(t('plusMachine'))}</button>` : ''}</div>
    <div class="seg-tabs only-narrow"><a href="#/gym?g=${encodeURIComponent(g.id)}" class="${v === 'zones' ? 'on' : ''}">${esc(t('zonesAndMachines'))}</a><a href="#/gym?g=${encodeURIComponent(g.id)}&v=eq" class="${v === 'eq' ? 'on' : ''}">${esc(t('gymEquipment'))}</a></div>
    <div class="gym-cols v-${v}"><div class="gym-zones">${zonesHtml}</div><aside class="gym-eq">${eqHtml}</aside></div>`;
  return {
    html,
    bind(view) {
      view.querySelector('[data-action=sort]')?.addEventListener('click', () => { sorting = !sorting; rerender(); });
      view.querySelector('[data-sortable=places]')?.addEventListener('sorted', (e) => {
        e.detail.keys.forEach((id, i) => { const p = get('places', id); if (p && p.order !== i) upsert('places', { ...p, order: i }, { silent: true }); });
        rerender();
      });
      view.querySelectorAll('[data-action=add-place]').forEach((b) => b.addEventListener('click', () => placeSheet(null, g.id)));
      view.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => placeSheet(get('places', b.dataset.place))));
      view.querySelectorAll('[data-machine]').forEach((b) => b.addEventListener('click', () => newMachineSheet({ machine: get('machines', b.dataset.machine) })));
      view.querySelectorAll('[data-add-machine]').forEach((b) => b.addEventListener('click', () => newMachineSheet({ placeId: b.dataset.addMachine })));
      view.querySelectorAll('[data-eq]').forEach((c) => c.addEventListener('change', () => {
        const cur = Array.isArray(g.equipment) ? g.equipment : [...EQUIP];
        const next = c.checked ? [...new Set([...cur, c.dataset.eq])] : cur.filter((k) => k !== c.dataset.eq);
        updateGym(g.id, { equipment: EQUIP.filter((k) => next.includes(k)) });
      }));
      view.querySelector('[data-action=add-gym]').addEventListener('click', () => gymSheet(null));
      view.querySelector('[data-action=gym-sheet]').addEventListener('click', () => gymSheet(g));
    },
    leave() { sorting = false; },
  };
}

function rerender() { window.dispatchEvent(new CustomEvent('palestra:render')); }

/** A new gym, or a gym's name (and deleting it). */
async function gymSheet(g) {
  const isMain = g && g.id === mainGym().id;
  const html = `<h2>${esc(g ? gymName(g) : t('newGym'))}</h2>
    <label class="field"><span>${esc(t('name'))}</span><input name="name" value="${esc(g ? gymName(g) : '')}" placeholder="${esc(t('gymNamePh'))}" autofocus autocomplete="off"></label>
    ${g ? '' : `<p class="muted small">${esc(t('newGymHint'))}</p>`}
    <div class="button-row"><button class="btn primary" value="save">${esc(g ? t('save') : t('add'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>
    ${g && !isMain ? `<button type="button" class="btn danger-text wide" data-remove>${esc(t('deleteGym'))}</button>` : ''}`;
  await openSheet(html, (form, close) => {
    form.querySelector('[value=save]').addEventListener('click', () => {
      const name = form.name.value.trim();
      if (!name) { form.name.focus(); return; }
      if (g) { updateGym(g.id, { name }); if (isMain) setPref('gymName', name); }
      else { const n = addGym(name); location.hash = `#/gym?g=${encodeURIComponent(n.id)}&v=eq`; }
      close(true);
    });
    form.querySelector('[data-remove]')?.addEventListener('click', async () => {
      close(false);
      if (!(await askConfirm({ text: t('deleteGymQ', gymName(g), gymName(mainGym())), ok: t('delete'), danger: true }))) return;
      const before = gyms();
      removeGym(g.id);
      location.hash = '#/gym';
      toast(t('deleted', gymName(g)), { undo: () => { saveGymsBack(before); } });
    });
  });
}
async function saveGymsBack(list) { (await import('../gyms.js')).saveGyms(list); }

async function placeSheet(place = null, gymId = '') {
  const html = `<h2>${esc(place ? t('editZone') : t('newZone'))}</h2>
    <label class="field"><span>${esc(t('name'))}</span><input name="name" value="${esc(place?.name || '')}" placeholder="${esc(t('zonePh'))}" autofocus autocomplete="off"></label>
    <label class="field"><span>${esc(t('note'))} <small class="muted">${esc(t('optional'))}</small></span><input name="note" value="${esc(place?.note || '')}" autocomplete="off"></label>
    ${gyms().length > 1 ? `<label class="field"><span>${esc(t('whichGym'))}</span><select name="gymId">${gyms().map((x) => `<option value="${esc(x.id)}" ${x.id === (place ? placeGymId(place) : gymId || mainGym().id) ? 'selected' : ''}>${esc(gymName(x))}</option>`).join('')}</select></label>` : ''}
    <div class="button-row"><button class="btn primary" value="save">${esc(t('save'))}</button><button type="button" class="btn ghost" data-close>${esc(t('cancel'))}</button></div>
    ${place ? `<button type="button" class="btn danger-text wide" data-remove>${esc(t('deleteZone'))}</button>` : ''}`;
  await openSheet(html, (form, close) => {
    form.querySelector('[value=save]').addEventListener('click', () => {
      const name = form.name.value.trim();
      if (!name) { form.name.focus(); return; }
      const gid = form.gymId ? form.gymId.value : (place ? place.gymId : gymId);
      upsert('places', { ...(place || { id: uid(), order: places().length }), name, note: form.note.value.trim(), gymId: gid && gid !== mainGym().id ? gid : undefined });
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
      const saved = upsert('machines', rec);
      // the gym it's in now has what this machine is for (equipment fills itself in)
      const p = rec.placeId && get('places', rec.placeId);
      const gg = gymById(p ? placeGymId(p) : mainGym().id);
      const need = needOf({ name: rec.name, type: kind === 'cardio' ? 'cardio' : 'weights', equipment: 'machine' });
      if (Array.isArray(gg.equipment) && !gg.equipment.includes(need)) updateGym(gg.id, { equipment: EQUIP.filter((k) => k === need || gg.equipment.includes(k)) });
      close(saved);
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
