// Shared UI pieces: a confirmation box, a toast that can offer "Undo", and a sheet for small forms.
import { t } from '../i18n.js';
import { esc } from './format.js';

let box = null;
function confirmBox() {
  if (box && box.isConnected) return box;
  box = document.createElement('dialog');
  box.id = 'confirm';
  box.className = 'sheet confirm';
  document.body.appendChild(box);
  return box;
}

/** Ask a yes/no question. Resolves true when the person confirms. */
export function askConfirm({ text, title = '', ok = t('confirmYes'), danger = false } = {}) {
  const el = confirmBox();
  el.innerHTML = `<form method="dialog">
    ${title ? `<h2>${esc(title)}</h2>` : ''}
    <p>${esc(text)}</p>
    <div class="button-row">
      <button class="btn ${danger ? 'danger' : 'primary'}" value="ok" data-confirm="ok">${esc(ok)}</button>
      <button class="btn ghost" value="cancel">${esc(t('cancel'))}</button>
    </div></form>`;
  return new Promise((resolve) => {
    el.returnValue = '';
    el.addEventListener('close', () => resolve(el.returnValue === 'ok'), { once: true });
    if (el.open) el.close();
    el.showModal();
    el.querySelector('[data-confirm=ok]').focus();
  });
}

/** A short message at the bottom; with undo, a button that runs it once. */
export function toast(msg, { undo = null, ms } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toast.timer);
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" class="toast-undo">${esc(t('undo'))}</button>` : ''}`;
  if (undo) {
    el.querySelector('.toast-undo').onclick = () => {
      clearTimeout(toast.timer);
      el.classList.remove('show');
      undo();
    };
  }
  el.classList.add('show');
  toast.timer = setTimeout(() => el.classList.remove('show'), ms || (undo ? 6000 : 2600));
}

/**
 * Open the shared sheet (#modal) with a form. bind(form, close) wires it up; the promise resolves when it closes.
 * The form's submit is prevented: call close() yourself after saving.
 */
export function openSheet(html, bind = () => {}) {
  const el = document.getElementById('modal');
  el.innerHTML = `<form class="sheet-form" novalidate>${html}</form>`;
  const form = el.querySelector('form');
  return new Promise((resolve) => {
    const close = (value) => { if (el.open) el.close(); resolve(value); };
    form.addEventListener('submit', (e) => e.preventDefault());
    form.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(null)));
    el.addEventListener('cancel', () => resolve(null), { once: true });
    if (el.open) el.close();
    el.showModal();
    bind(form, close);
    const first = form.querySelector('[autofocus]');
    if (first) first.focus();
  });
}
