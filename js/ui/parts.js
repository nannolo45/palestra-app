// Markup pieces used on several screens: page headers, steppers, toggles, segmented controls, empty states.
import { esc, fmtNum, num } from './format.js';
import { icon } from './icons.js';
import { t } from '../i18n.js';

export function backLink(href, label) {
  return `<a class="back" href="${esc(href)}">${icon('back', 20)}<span>${esc(label)}</span></a>`;
}

/** A − value + control. name = the field name; the value lives in a hidden input. */
export function stepper({ name, value, step = 1, min = 0, unit = '', label = '', big = false, id = '' }) {
  const v = value == null || value === '' ? '' : value;
  return `<div class="stepper${big ? ' big' : ''}" data-stepper="${esc(name)}" data-step="${step}" data-min="${min}">
    ${label ? `<span class="stepper-label" id="${esc(id || `lbl-${name}`)}">${esc(label)}</span>` : ''}
    <div class="stepper-row">
      <button type="button" class="step-btn" data-delta="-1" aria-label="${esc(t('less', label || name))}">−</button>
      <input class="stepper-value" ${id ? `id="${esc(id)}"` : ''} name="${esc(name)}" inputmode="decimal" value="${esc(v === '' ? '' : fmtNum(v))}" aria-label="${esc(label || name)}" autocomplete="off">
      ${unit ? `<span class="stepper-unit">${esc(unit)}</span>` : ''}
      <button type="button" class="step-btn" data-delta="1" aria-label="${esc(t('more', label || name))}">+</button>
    </div>
  </div>`;
}

/** Wire every stepper inside root. onChange(name, value) after each change. */
export function bindSteppers(root, onChange = () => {}) {
  root.querySelectorAll('[data-stepper]').forEach((box) => {
    const input = box.querySelector('input');
    const step = Number(box.dataset.step) || 1;
    const min = Number(box.dataset.min) || 0;
    box.querySelectorAll('[data-delta]').forEach((b) => b.addEventListener('click', () => {
      const cur = num(input.value) ?? 0;
      let next = Math.round((cur + step * Number(b.dataset.delta)) / step) * step;
      next = Math.max(min, Math.round(next * 100) / 100);
      input.value = fmtNum(next);
      onChange(box.dataset.stepper, next);
    }));
    input.addEventListener('change', () => {
      const v = num(input.value);
      if (v != null) input.value = fmtNum(Math.max(min, v));
      onChange(box.dataset.stepper, v == null ? null : Math.max(min, v));
    });
  });
}

/** Read a stepper's value as a number (or null). */
export const stepVal = (form, name) => num(form.querySelector(`[name="${name}"]`)?.value);

export function toggle({ name, checked, label, hint = '' }) {
  return `<label class="toggle-row">
    <span class="toggle-text"><span class="toggle-label">${esc(label)}</span>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</span>
    <input type="checkbox" class="switch" name="${esc(name)}" ${checked ? 'checked' : ''}>
  </label>`;
}

/** Segmented control: options [[value, label]]. Uses radio inputs so it works in forms. */
export function segmented({ name, value, options, label, cls = '' }) {
  return `<div class="seg ${cls}" role="radiogroup" aria-label="${esc(label)}">
    ${options.map(([v, l]) => `<label class="seg-opt"><input type="radio" name="${esc(name)}" value="${esc(v)}" ${String(v) === String(value) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
  </div>`;
}

export function empty(title, text, action = '') {
  return `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p>${action}</div>`;
}

/** The tag in front of an exercise: dark with the machine number for weights, yellow for cardio, dashed for bodyweight. */
export function exTag(ex, label) {
  const cls = ex.type === 'cardio' ? 'tag-cardio' : ex.type === 'bodyweight' ? 'tag-body' : 'tag-weights';
  return `<span class="extag ${cls}">${esc(label || '')}</span>`;
}

/** Turn **bold** into <strong> in already-escaped text. */
export const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

/** Esercizi | Palestra: the two halves of the Esercizi tab. */
export function segTabs(which) {
  const tab = (key, href, label) => `<a href="${href}" class="${which === key ? 'on' : ''}"${which === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`;
  return `<nav class="seg-tabs" aria-label="${esc(t('tab_exercises'))}">${tab('exercises', '#/exercises', t('exercisesTab'))}${tab('gym', '#/gym', t('gymTab'))}</nav>`;
}

/** The settings gear, the same in Ricette, Palestra and Everyday (see the handover). On the phone it sits at the
 *  right end of each tab page's header; on a computer the top bar has its own (#gear in index.html). */
export const COG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.27 4.80 L10.72 2.49 L13.28 2.49 L13.73 4.80 L15.87 5.69 L17.82 4.37 L19.63 6.18 L18.31 8.13 L19.20 10.27 L21.51 10.72 L21.51 13.28 L19.20 13.73 L18.31 15.87 L19.63 17.82 L17.82 19.63 L15.87 18.31 L13.73 19.20 L13.28 21.51 L10.72 21.51 L10.27 19.20 L8.13 18.31 L6.18 19.63 L4.37 17.82 L5.69 15.87 L4.80 13.73 L2.49 13.28 L2.49 10.72 L4.80 10.27 L5.69 8.13 L4.37 6.18 L6.18 4.37 L8.13 5.69 Z"/><circle cx="12" cy="12" r="3.1"/></svg>';
export function gearLink() {
  return `<a class="gear only-narrow" href="#/settings" aria-label="${esc(t('settings'))}" title="${esc(t('settings'))}">${COG}</a>`;
}
