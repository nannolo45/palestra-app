// Drag onto targets (v27, the builders): press on something with a payload, move, let go over an element with
// data-drop="…". Works with mouse, finger and pen (pointer events). A press without moving is a tap.
// The root gets "dropped" ({ payload, target }) or "tapped" (payload) events.
let drag = null;

export const isDropDragging = () => Boolean(drag && drag.moved);

export function startDrag(e, payload, label, root) {
  if (e.button != null && e.button !== 0) return;
  drag = { payload, root, label, hot: null, moved: false, x: e.clientX, y: e.clientY, id: e.pointerId, ghost: null };
}

function move(e) {
  if (!drag || (drag.id != null && e.pointerId !== drag.id)) return;
  if (!drag.moved) {
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 8) return;
    drag.moved = true;
    drag.root.classList.add('dragging');
    drag.ghost = Object.assign(document.createElement('div'), { className: 'drag-ghost', textContent: drag.label });
    document.body.appendChild(drag.ghost);
    document.body.classList.add('no-select');
  }
  e.preventDefault();
  drag.ghost.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
  drag.ghost.style.display = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  drag.ghost.style.display = '';
  const t = el && el.closest('[data-drop]');
  const hot = t && drag.root.contains(t) ? t : null;
  if (hot !== drag.hot) { drag.hot?.classList.remove('hot'); hot?.classList.add('hot'); drag.hot = hot; }
  // near the top or bottom of the screen: scroll
  if (e.clientY < 70) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 90) window.scrollBy(0, 12);
}

function up() {
  if (!drag) return;
  const d = drag; drag = null;
  d.ghost?.remove(); d.root.classList.remove('dragging'); d.hot?.classList.remove('hot');
  document.body.classList.remove('no-select');
  if (d.moved && d.hot) d.root.dispatchEvent(new CustomEvent('dropped', { detail: { payload: d.payload, target: d.hot.dataset.drop } }));
  else if (!d.moved) d.root.dispatchEvent(new CustomEvent('tapped', { detail: d.payload }));
}

window.addEventListener('pointermove', move, { passive: false });
window.addEventListener('pointerup', up);
window.addEventListener('pointercancel', () => { if (drag) { drag.ghost?.remove(); drag.root.classList.remove('dragging'); drag.hot?.classList.remove('hot'); document.body.classList.remove('no-select'); drag = null; } });
