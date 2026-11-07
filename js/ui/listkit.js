// The same list tools for Esercizi, Schede and Workout (v25, v26): a search box and one "Filtri" button that opens a
// panel under it (the group tags — one tap shows only that group, hold and drag to reorder them — grouping, sorting,
// filters, colours, rows); with the panel closed only the filters that are on show, as tags with a ✕. Groups close,
// have a colour, and can have sub-groups (a body region and its muscles). Settings are kept per list on this device.
import { state, saveSettings } from '../store.js';
import { t } from '../i18n.js';
import { esc } from './format.js';
import { icon } from './icons.js';
import { closeOnTapOutside } from './dialogs.js';

export const PALETTE = ['#E8B400', '#2BB3A8', '#F07A4F', '#9575CD', '#5BAF61', '#4A90D9', '#E06C9F', '#B59F6A', '#8A9A99', '#D9534F'];

const queries = {}; // the search text, per list (not kept)
const panels = {}; // whether the Filtri panel is open, per list (not kept)
const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));

function load(id, def) {
  const s = (state.settings.lists || {})[id] || {};
  return {
    ...s, // keep what this version doesn't use
    group: s.group || def.group, sort: s.sort || def.sort, color: s.color ?? def.color, dense: s.dense ?? def.dense ?? true,
    f: s.f || {}, closed: s.closed || {}, order: s.order || {}, only: s.only || {},
  };
}
function save(id, st) {
  saveSettings({ lists: { ...(state.settings.lists || {}), [id]: st } });
}

/** A group key's colour: chosen, or one from the palette by its place among its dimension's keys. */
export function colorOf(key, siblings = [], def = null) {
  const chosen = (state.settings.listColors || {})[key];
  if (chosen) return chosen;
  if (def) return def;
  if (key.endsWith(':none')) return '#8A9A99';
  const i = Math.max(0, siblings.indexOf(key));
  return PALETTE[i % (PALETTE.length - 2)];
}
function setColor(key, c) { saveSettings({ listColors: { ...(state.settings.listColors || {}), [key]: c } }); }

const asList = (v) => (Array.isArray(v) ? v : [v]);

/**
 * cfg = {
 *   id, items, text(x) (what the search looks in), noun(n),
 *   groups: { key: { label, keysOf(x) → [groupKey] (namespaced, e.g. "m:Petto"), name(groupKey), order?(keys) → keys } },
 *   facets: [{ key, label, options: [[value, label, groupKey?]], get(x) → value or [values] }],
 *   sorts: [{ key, label, cmp }],  colors: [group keys that can colour the rows],
 *   row(x, { dense }) → html, def: { group, sort, color, dense }, emptyHtml, top (html above the tools)
 * }
 * Returns { html, bind(view) }.
 */
export function listKit(cfg) {
  const st = load(cfg.id, cfg.def);
  if (!cfg.groups[st.group]) st.group = cfg.def.group;
  const q = (queries[cfg.id] || '').trim().toLowerCase();
  const G = cfg.groups[st.group];
  const only = new Set(st.only[st.group] || []);

  // every group key of the current grouping, in the chosen order (from all items, so the tags don't jump)
  const allKeys = [];
  for (const x of cfg.items) for (const k of G.keysOf(x)) if (!allKeys.includes(k)) allKeys.push(k);
  const natural = G.order ? G.order(allKeys) : allKeys;
  const saved = (st.order[st.group] || []).filter((k) => natural.includes(k));
  const keys = [...saved, ...natural.filter((k) => !saved.includes(k))];
  const dimKeys = (gk) => {
    const g = cfg.groups[gk];
    if (g.paletteKeys) return g.paletteKeys;
    const ks = [];
    for (const x of cfg.items) for (const k of g.keysOf(x)) if (!ks.includes(k)) ks.push(k);
    return g.order ? g.order(ks) : ks;
  };
  const siblingsCache = {};
  const colorKeyOf = (x) => {
    if (!st.color || st.color === 'none' || !cfg.groups[st.color]) return null;
    const k = cfg.groups[st.color].keysOf(x)[0];
    siblingsCache[st.color] = siblingsCache[st.color] || dimKeys(st.color);
    return colorOf(k, siblingsCache[st.color], cfg.groups[st.color].defColor?.(k));
  };
  const gColor = (k) => colorOf(k, G.paletteKeys || natural, G.defColor?.(k));
  const dotOf = (gk, dim) => colorOf(gk, dimKeys(dim), cfg.groups[dim]?.defColor?.(gk));

  // filtering
  let xs = cfg.items;
  if (q) xs = xs.filter((x) => cfg.text(x).toLowerCase().includes(q));
  for (const f of cfg.facets) {
    const sel = st.f[f.key];
    if (!sel || !sel.length) continue;
    xs = xs.filter((x) => asList(f.get(x)).some((v) => sel.includes(v)));
  }
  if (only.size) xs = xs.filter((x) => G.keysOf(x).some((k) => only.has(k)));
  const sorter = cfg.sorts.find((s) => s.key === st.sort) || cfg.sorts[0];
  xs = [...xs].sort(sorter.cmp);
  const groups = keys.map((k) => ({ k, items: xs.filter((x) => G.keysOf(x).includes(k)) })).filter((g) => g.items.length);
  const closed = new Set(st.closed[st.group] || []);
  const isClosed = (k) => !q && closed.has(k);
  const grouped = st.group !== 'none';

  // the tags of the filters that are on
  const onTags = [];
  for (const f of cfg.facets) for (const v of st.f[f.key] || []) {
    const o = f.options.find((x) => x[0] === v);
    onTags.push(`<button type="button" class="kit-on" data-unf="${esc(f.key)}|${esc(v)}">${o?.[2] ? `<span class="dot" style="background:${dotOf(o[2], o[3] || st.group)}"></span>` : ''}${esc(o ? o[1] : v)}<span class="x" aria-hidden="true">✕</span><span class="sr">${esc(t('removeFilter'))}</span></button>`);
  }
  for (const k of only) onTags.push(`<button type="button" class="kit-on" data-unonly="${esc(k)}"><span class="dot" style="background:${gColor(k)}"></span>${esc(G.name(k))}<span class="x" aria-hidden="true">✕</span><span class="sr">${esc(t('removeFilter'))}</span></button>`);
  const nOn = Object.values(st.f).reduce((a, v) => a + (v?.length || 0), 0) + only.size;
  const open = Boolean(panels[cfg.id]);
  const rows = (items) => items.map((x) => { const c = colorKeyOf(x); return `<div class="kit-item${c ? ' barred' : ''}"${c ? ` style="--bar:${c}"` : ''}>${cfg.row(x, { dense: st.dense })}</div>`; }).join('');
  // a group's rows, with its sub-groups (muscles inside a region) when it has more than one
  const groupRows = (items) => {
    if (!G.sub) return rows(items);
    const ks = [];
    for (const x of items) { const k = G.sub.keyOf(x); if (!ks.includes(k)) ks.push(k); }
    if (ks.length < 2) return rows(items);
    const ordered = G.sub.order ? G.sub.order(ks) : ks;
    return ordered.map((k) => { const xs2 = items.filter((x) => G.sub.keyOf(x) === k); return `<div class="kit-sub">${esc(G.sub.name(k))}<small>${xs2.length}</small></div>${rows(xs2)}`; }).join('');
  };

  function panelHtml() {
    const opt = (on, attr, label, dot) => `<button type="button" class="kit-opt${on ? ' on' : ''}" aria-pressed="${on}" ${attr}>${dot ? `<span class="dot" style="background:${dot}"></span>` : ''}${esc(label)}</button>`;
    const countOf = (f, v) => cfg.items.filter((x) => asList(f.get(x)).includes(v)).length;
    const tags = grouped && keys.length > 1 ? `<div class="kit-sh">${esc(t('groupTagsHint', G.label.toLowerCase()))}</div><div class="kit-tags" role="group" aria-label="${esc(t('groupTags'))}">${keys.map((k) => {
      const n = cfg.items.filter((x) => G.keysOf(x).includes(k)).length;
      const on = only.has(k);
      return `<button type="button" class="kit-tag${on ? ' on' : ''}" data-tag="${esc(k)}" aria-pressed="${on}" style="--c:${gColor(k)}" title="${esc(G.name(k))}"><span class="dot"></span><span class="nm">${esc(G.name(k))}</span><small>${n}</small></button>`;
    }).join('')}</div>` : '';
    return `<div class="kit-panel card" id="kit-panel-${esc(cfg.id)}">${tags}
      <div class="kit-sh">${esc(t('groupBy'))}</div><div class="kit-opts">${Object.entries(cfg.groups).map(([k, g]) => opt(st.group === k, `data-grp="${k}"`, g.label)).join('')}</div>
      <div class="kit-sh">${esc(t('sortBy'))}</div><div class="kit-opts">${cfg.sorts.map((x) => opt(st.sort === x.key, `data-srt="${x.key}"`, x.label)).join('')}</div>
      ${cfg.facets.map((f) => `<div class="kit-sh">${esc(f.label)}</div><div class="kit-opts">${f.options.map(([v, l, gk, dim]) => `<button type="button" class="kit-opt${(st.f[f.key] || []).includes(v) ? ' on' : ''}" aria-pressed="${(st.f[f.key] || []).includes(v)}" data-fac="${esc(f.key)}|${esc(v)}">${gk ? `<span class="dot" style="background:${dotOf(gk, dim || st.group)}"></span>` : ''}${esc(l)} <small>${countOf(f, v)}</small></button>`).join('')}</div>`).join('')}
      ${cfg.colors.length ? `<div class="kit-sh">${esc(t('colorsBy'))}</div><div class="kit-opts">${cfg.colors.map((k) => opt(st.color === k, `data-col="${k}"`, cfg.groups[k].label)).join('')}${opt(!st.color || st.color === 'none', 'data-col="none"', t('noColors'))}</div>` : ''}
      <div class="kit-sh">${esc(t('rowsLabel'))}</div><div class="kit-opts">${opt(st.dense, 'data-dense="1"', t('rowsCompact'))}${opt(!st.dense, 'data-dense="0"', t('rowsDetailed'))}</div>
      <div class="kit-panel-foot"><button type="button" class="btn small" data-kit-panel>${esc(t('done'))}</button>${nOn ? `<button type="button" class="link-btn" data-kit-reset>${esc(t('clearFilters'))}</button>` : ''}</div>
    </div>`;
  }

  const html = `${cfg.top || ''}<div class="kit" data-kit="${esc(cfg.id)}">
    <div class="kit-tools"><label class="search kit-search">${icon('search', 18)}<span class="sr">${esc(t('search'))}</span><input id="kit-q-${esc(cfg.id)}" type="search" placeholder="${esc(cfg.searchPh || t('search'))}" value="${esc(queries[cfg.id] || '')}" autocomplete="off"></label>
      <button type="button" class="kit-filter${nOn ? ' on' : ''}${open ? ' open' : ''}" data-kit-panel aria-expanded="${open}" aria-controls="kit-panel-${esc(cfg.id)}">${icon('filter', 16)}${esc(t('filtersBtn'))}${nOn ? ` <b>${nOn}</b>` : ''}</button></div>
    ${open ? panelHtml() : (onTags.length ? `<div class="kit-ons">${onTags.join('')}</div>` : '')}
    <div class="kit-meta"><span>${esc(cfg.noun(xs.length))}${grouped ? ` · ${esc(t('groupedBy', G.label.toLowerCase()))}` : ''}</span>
      ${grouped && groups.length > 1 && !q ? `<button type="button" class="link-btn" data-kit-all>${esc(groups.every((g) => isClosed(g.k)) ? t('openAll') : t('closeAll'))}</button>` : ''}</div>
    ${!xs.length ? (cfg.items.length ? `<div class="kit-empty"><p class="muted">${esc(t('noMatches'))}</p>${nOn || only.size || q ? `<button type="button" class="btn small" data-kit-clear>${esc(t('clearFilters'))}</button>` : ''}</div>` : cfg.emptyHtml || '')
    : !grouped ? `<div class="card list kit-list">${rows(xs)}</div>`
      : `<div class="kit-groups${cfg.grid ? ' groups' : ''}">${groups.map((g) => {
        const c = isClosed(g.k);
        return `<section class="kit-group">
        <h2 class="kit-gh"><button type="button" class="kit-sw" data-kit-color="${esc(g.k)}" style="background:${gColor(g.k)}" aria-label="${esc(t('groupColor', G.name(g.k)))}"></button>
          <button type="button" class="kit-gt" data-kit-group="${esc(g.k)}" aria-expanded="${!c}"><span>${esc(G.name(g.k))}</span><span class="count">${g.items.length}</span>${icon(c ? 'chevron' : 'down', 16, 'class="chev"')}</button></h2>
        ${c ? '' : `<div class="card list kit-list">${groupRows(g.items)}</div>`}</section>`;
      }).join('')}</div>`}
  </div>`;

  function bind(view) {
    const root = view.querySelector(`[data-kit="${cfg.id}"]`);
    if (!root) return;
    const commit = () => { save(cfg.id, st); rerender(); };
    root.querySelector(`#kit-q-${cfg.id}`).addEventListener('input', (e) => { queries[cfg.id] = e.target.value; rerender(); });
    root.querySelectorAll('[data-unf]').forEach((b) => b.addEventListener('click', () => {
      const [k, v] = b.dataset.unf.split('|');
      st.f[k] = (st.f[k] || []).filter((x) => x !== v);
      commit();
    }));
    root.querySelector('[data-kit-clear]')?.addEventListener('click', () => { st.f = {}; st.only = {}; queries[cfg.id] = ''; commit(); });
    root.querySelectorAll('[data-kit-group]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.kitGroup;
      const set = new Set(st.closed[st.group] || []);
      if (set.has(k)) set.delete(k); else set.add(k);
      st.closed = { ...st.closed, [st.group]: [...set] };
      commit();
    }));
    root.querySelector('[data-kit-all]')?.addEventListener('click', () => {
      const all = groups.every((g) => isClosed(g.k));
      st.closed = { ...st.closed, [st.group]: all ? [] : groups.map((g) => g.k) };
      commit();
    });
    root.querySelectorAll('[data-kit-color]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); pickColor(b, b.dataset.kitColor); }));
    root.querySelectorAll('[data-kit-panel]').forEach((b) => b.addEventListener('click', () => { panels[cfg.id] = !panels[cfg.id]; rerender(); }));
    if (panels[cfg.id]) closeOnTapOutside(root.querySelector(`#kit-panel-${cfg.id}`), '[data-kit-panel]', () => { if (panels[cfg.id]) { panels[cfg.id] = false; rerender(); } });
    root.querySelectorAll('[data-unonly]').forEach((b) => b.addEventListener('click', () => {
      st.only = { ...st.only, [st.group]: (st.only[st.group] || []).filter((x) => x !== b.dataset.unonly) };
      commit();
    }));
    root.querySelectorAll('[data-grp]').forEach((b) => b.addEventListener('click', () => { st.group = b.dataset.grp; commit(); }));
    root.querySelectorAll('[data-srt]').forEach((b) => b.addEventListener('click', () => { st.sort = b.dataset.srt; commit(); }));
    root.querySelectorAll('[data-col]').forEach((b) => b.addEventListener('click', () => { st.color = b.dataset.col; commit(); }));
    root.querySelectorAll('[data-dense]').forEach((b) => b.addEventListener('click', () => { st.dense = b.dataset.dense === '1'; commit(); }));
    root.querySelectorAll('[data-fac]').forEach((b) => b.addEventListener('click', () => {
      const [k, v] = b.dataset.fac.split('|');
      const cur = st.f[k] || [];
      st.f = { ...st.f, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
      commit();
    }));
    root.querySelector('[data-kit-reset]')?.addEventListener('click', () => { st.f = {}; st.only = {}; queries[cfg.id] = ''; commit(); });
    bindTags(root.querySelector('.kit-tags'), (k) => {
      const s = new Set(st.only[st.group] || []);
      if (s.has(k)) s.delete(k); else s.add(k);
      st.only = { ...st.only, [st.group]: [...s] };
      commit();
    }, (order) => { st.order = { ...st.order, [st.group]: order }; commit(); });
  }
  return { html, bind };
}

/** The colours to choose from, under the little square of a group. */
function pickColor(anchor, key) {
  document.querySelectorAll('.kit-pal').forEach((el) => el.remove());
  const pal = document.createElement('div');
  pal.className = 'kit-pal';
  pal.setAttribute('role', 'dialog');
  pal.innerHTML = PALETTE.map((c) => `<button type="button" style="background:${c}" data-c="${c}" aria-label="${c}"></button>`).join('');
  const r = anchor.getBoundingClientRect();
  pal.style.top = `${r.bottom + window.scrollY + 6}px`;
  pal.style.left = `${Math.max(8, Math.min(r.left + window.scrollX, window.innerWidth - 190))}px`;
  document.body.appendChild(pal);
  const off = (e) => { if (!pal.contains(e.target)) { pal.remove(); document.removeEventListener('pointerdown', off, true); } };
  setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
  pal.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { pal.remove(); document.removeEventListener('pointerdown', off, true); setColor(key, b.dataset.c); rerender(); }));
}

/**
 * The group tags: a tap shows only that group (more than one can be on); hold (or drag with a mouse) and move to
 * reorder them. The order is the order of the groups in the list too. Arrow keys move the focused tag.
 */
function bindTags(box, onTap, onOrder) {
  if (!box) return;
  const tags = () => [...box.querySelectorAll('[data-tag]')];
  const order = () => tags().map((x) => x.dataset.tag);
  let d = null;
  const start = (tag, e) => {
    d = { tag, id: e.pointerId, moved: false, sx: e.clientX, sy: e.clientY, before: order(), timer: null, armed: e.pointerType === 'mouse' };
    if (!d.armed) d.timer = setTimeout(() => { if (d) { d.armed = true; tag.classList.add('lifting'); if (navigator.vibrate) navigator.vibrate(15); } }, 280);
  };
  box.addEventListener('pointerdown', (e) => {
    const tag = e.target.closest('[data-tag]');
    if (!tag || e.button > 0) return;
    start(tag, e);
  });
  box.addEventListener('pointermove', (e) => {
    if (!d || e.pointerId !== d.id) return;
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (!d.armed) { if (dist > 10) { clearTimeout(d.timer); d = null; } return; } // a scroll, not a hold
    if (!d.moved && dist < 6) return;
    if (!d.moved) { d.moved = true; d.tag.classList.add('dragging'); box.classList.add('sorting'); try { d.tag.setPointerCapture(d.id); } catch { /* fine */ } }
    e.preventDefault();
    d.tag.style.transform = `translate(${e.clientX - d.sx}px, ${e.clientY - d.sy}px)`;
    const over = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el !== d.tag && el.dataset && el.dataset.tag != null && box.contains(el));
    if (over) {
      const r = over.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      const before = d.tag.getBoundingClientRect();
      box.insertBefore(d.tag, after ? over.nextSibling : over);
      const now = d.tag.getBoundingClientRect();
      d.sx += now.left - before.left; d.sy += now.top - before.top;
      d.tag.style.transform = `translate(${e.clientX - d.sx}px, ${e.clientY - d.sy}px)`;
    }
  }, { passive: false });
  const finish = (e, cancel) => {
    if (!d || (e && e.pointerId !== d.id)) return;
    clearTimeout(d.timer);
    const { tag, moved, before } = d;
    d = null;
    tag.classList.remove('dragging', 'lifting');
    tag.style.transform = '';
    box.classList.remove('sorting');
    if (moved && !cancel) { const now = order(); if (now.join('|') !== before.join('|')) onOrder(now); return; }
    if (!moved && !cancel) onTap(tag.dataset.tag);
  };
  box.addEventListener('pointerup', (e) => finish(e, false));
  box.addEventListener('pointercancel', (e) => finish(e, true));
  box.addEventListener('contextmenu', (e) => { if (e.target.closest('[data-tag]')) e.preventDefault(); });
  // a tap from the keyboard, and moving with the arrow keys
  box.addEventListener('click', (e) => { if (e.detail === 0) { const tag = e.target.closest('[data-tag]'); if (tag) onTap(tag.dataset.tag); } });
  box.addEventListener('keydown', (e) => {
    const tag = e.target.closest('[data-tag]');
    if (!tag || !['ArrowLeft', 'ArrowRight'].includes(e.key) || !e.altKey) return;
    e.preventDefault();
    const list = order(); const i = list.indexOf(tag.dataset.tag); const j = i + (e.key === 'ArrowLeft' ? -1 : 1);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onOrder(list);
  });
}
