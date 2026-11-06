// Storico: progress per exercise, and every session.
import { state, get, remove, restore, live, pref, setPref, saveSettings } from '../store.js';
import { t, getLang } from '../i18n.js';
import { esc, fmtNum, shortDate, dayMonth, weekdayShort, timeOfDay, minText, clock, monthName } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, empty, gearLink } from '../ui/parts.js';
import { askConfirm, toast } from '../ui/dialogs.js';
import { sessions, exercises, machineOf, routines, training } from '../data.js';
import { weekly, pausesOf, changeOf, DAY, weekStartOf } from '../stats.js';
import { REGION_KEYS, regionName, regionColor } from '../body.js';
import { colorOf } from '../ui/listkit.js';
import { progressOf, totalWeight, measuresFor } from '../model.js';

let picked = null;

function unitOf(ex) { return ex.type === 'cardio' ? 'min' : ex.type === 'bodyweight' ? t('repsShort') : 'kg'; }

function chart(ex, points) {
  const W = 326; const H = 150; const L = 30; const R = 312; const T = 16; const B = 116;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals); let hi = Math.max(...vals);
  if (hi === lo) { lo -= 5; hi += 5; }
  const pad = (hi - lo) * 0.15; lo = Math.max(0, lo - pad); hi += pad;
  const x = (i) => (points.length === 1 ? (L + R) / 2 : L + (i * (R - L)) / (points.length - 1));
  const y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15].map((v) => Math.round(v * 2) / 2);
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const first = points[0]; const last = points[points.length - 1]; const mid = points[Math.floor((points.length - 1) / 2)];
  const label = t('chartLabel', ex.name, points.length, dayMonth(first.start), dayMonth(last.start), fmtNum(first.value), fmtNum(last.value), unitOf(ex));
  return `<svg class="chart" role="img" aria-label="${esc(label)}" width="100%" viewBox="0 0 ${W} ${H}">
    <g class="grid">${ticks.map((v) => `<line x1="${L}" y1="${y(v).toFixed(1)}" x2="${R}" y2="${y(v).toFixed(1)}"/><text x="0" y="${(y(v) + 4).toFixed(1)}">${esc(fmtNum(v, 1))}</text>`).join('')}</g>
    <g class="xlabels"><text x="${L}" y="${H - 8}">${esc(dayMonth(first.start))}</text>${points.length > 2 ? `<text x="${x(Math.floor((points.length - 1) / 2)).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(dayMonth(mid.start))}</text>` : ''}${points.length > 1 ? `<text x="${R}" y="${H - 8}" text-anchor="end">${esc(dayMonth(last.start))}</text>` : ''}</g>
    <polyline class="line" points="${pts}"/>
    ${points.map((p, i) => `<circle class="${i === points.length - 1 ? 'last' : 'pt'}" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${i === points.length - 1 ? 5 : 3.5}"/>`).join('')}
  </svg>`;
}

// ---- v26: everything, per body region, per workout, one scheda; pauses; where you improved ----

const DIMS = ['all', 'region', 'workout', 'routine', 'exercise'];
const METRICS = ['volume', 'sets', 'max'];
const RANGES = [[9, 'r2m'], [13, 'r3m'], [26, 'r6m'], [0, 'rAll']];
const hs = () => ({ dim: 'region', metric: 'volume', range: 13, off: [], routine: null, ...(state.settings.hist || {}) });
const setHs = (patch) => { saveSettings({ hist: { ...hs(), ...patch } }, { quiet: true }); window.dispatchEvent(new CustomEvent('palestra:render')); };

function lineMeta(dim, key) {
  const lang = getLang();
  if (dim === 'all') return { name: t('everything'), color: '#E8B400' };
  if (dim === 'region') return { name: regionName(key, lang), color: key === 'unsorted' ? '#8A9A99' : regionColor(key) };
  if (dim === 'workout') {
    if (key === 'none') return { name: t('outsideWorkouts'), color: '#8A9A99' };
    const keys = [...live('plans').map((p) => `w:${p.id}`), 'w:none'];
    return { name: get('plans', key)?.name || '—', color: colorOf(`w:${key}`, keys) };
  }
  if (dim === 'routine') return { name: get('routines', key)?.name || '—', color: '#E8B400' };
  return { name: get('exercises', key)?.name || '—', color: '#E8B400' };
}

/** The weekly lines, the grey bands of the pauses, a dashed line across each pause. */
function linesChart(data, lines, pz, from, metric, dim) {
  const W = 340; const H = 196; const L = 32; const R = 334; const T = 10; const B = 170;
  const weeks = data.weeks.slice(from);
  if (!weeks.length) return '';
  const vals = lines.flatMap((l) => l.values.slice(from)).filter((v) => v != null);
  if (!vals.length) return `<p class="muted small">${esc(t('noDataYet'))}</p>`;
  let hi = Math.max(...vals); let lo = metric === 'max' || dim === 'exercise' ? Math.min(...vals) : 0;
  if (hi === lo) { hi += 5; lo = Math.max(0, lo - 5); }
  hi += (hi - lo) * 0.08;
  const n = Math.max(1, weeks.length - 1);
  const x = (i) => L + ((i) / n) * (R - L);
  const xt = (ts) => x((ts - weeks[0]) / (7 * DAY));
  const y = (v) => B - ((v - lo) / (hi - lo)) * (B - T);
  const fmt = (v) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${fmtNum(Math.round(v / 100) / 10)}k` : fmtNum(Math.round(v)));
  let svg = '';
  for (const p of pz) {
    if (p.to < weeks[0]) continue;
    const xa = Math.max(L, xt(p.from)); const xb = Math.min(R, xt(p.to + DAY));
    if (xb - xa < 2) continue;
    svg += `<rect class="pause-band" x="${xa.toFixed(1)}" y="${T}" width="${(xb - xa).toFixed(1)}" height="${B - T}"/><text class="pause-label" x="${((xa + xb) / 2).toFixed(1)}" y="${T + 12}" text-anchor="middle">${esc(p.reason || t('pause'))}</text><text class="pause-label small" x="${((xa + xb) / 2).toFixed(1)}" y="${T + 24}" text-anchor="middle">${esc(t('nDaysShort', p.days))}</text>`;
  }
  for (let k = 0; k <= 3; k++) { const v = lo + ((hi - lo) * k) / 3; svg += `<line class="gl" x1="${L}" x2="${R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="yl" x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(fmt(v))}</text>`; }
  let lastM = -1;
  weeks.forEach((w, i) => { const m = new Date(w + 3 * DAY).getMonth(); if (m !== lastM) { lastM = m; if (x(i) < R - 20) svg += `<text class="xl" x="${x(i).toFixed(1)}" y="${H - 8}">${esc(new Date(w + 3 * DAY).toLocaleDateString(document.documentElement.lang || 'it', { month: 'short' }))}</text>`; } });
  for (const l of lines) {
    const vs = l.values.slice(from);
    let d = ''; let pen = false;
    vs.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    // across a gap, a dashed line, so the dip reads as a pause
    let bridges = ''; let prev = null;
    vs.forEach((v, i) => { if (v == null) return; if (prev && i - prev.i > 1) bridges += `M${x(prev.i).toFixed(1)},${y(prev.v).toFixed(1)} L${x(i).toFixed(1)},${y(v).toFixed(1)} `; prev = { i, v }; });
    svg += `${bridges ? `<path class="bridge" d="${bridges}" stroke="${l.color}"/>` : ''}<path class="ln" d="${d}" stroke="${l.color}" stroke-width="${lines.length > 1 ? 2 : 2.6}"/>`;
    vs.forEach((v, i) => { if (v != null && (vs[i - 1] == null) && (vs[i + 1] == null)) svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${l.color}"/>`; });
  }
  const label = t('chartLines', lines.map((l) => l.name).join(', '));
  return `<svg class="chart multi" role="img" aria-label="${esc(label)}" viewBox="0 0 ${W} ${H}" width="100%">${svg}</svg>`;
}

export function historyView(query = {}) {
  const ss = sessions().filter((s) => s.end);
  const now = Date.now();
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const thisMonth = ss.filter((s) => s.start >= monthStart);
  const monthMin = thisMonth.reduce((a, s) => a + (s.minutes || 0), 0);
  const H = hs();
  if (query.ex) { H.dim = 'exercise'; }
  const exs = exercises().filter((e) => progressOf(e, ss).length);
  if (query.ex && exs.some((e) => e.id === query.ex)) picked = query.ex;
  if (!picked || !exs.some((e) => e.id === picked)) picked = exs[0]?.id || null;
  const ex = picked && get('exercises', picked);
  const rts = routines().filter((r) => ss.some((s) => s.routineId === r.id));
  const routineId = rts.some((r) => r.id === H.routine) ? H.routine : rts[0]?.id || null;

  const reasons = pref('pauses', {}) || {};
  const pz = pausesOf(ss, Number(training().pauseDays) || 10, now).map((p) => ({ ...p, reason: reasons[p.key] ? t(`why_${reasons[p.key]}`) : '' }));

  let chartCard = '';
  if (H.dim === 'exercise') {
    const pts = ex ? progressOf(ex, ss).slice(-12) : [];
    if (ex && pts.length) {
      const first = pts[0]; const last = pts[pts.length - 1];
      const diff = last.value - first.value;
      const u = unitOf(ex);
      const rests = last.sets.map((x) => x.restTaken).filter((x) => x > 0);
      const avgRest = rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length : null;
      chartCard = `<div class="progress-head">
          <label class="field compact"><span>${esc(t('exercise'))}</span><select id="h-ex">${exs.map((e) => `<option value="${esc(e.id)}" ${e.id === picked ? 'selected' : ''}>${esc([e.name, machineOf(e)?.number].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>
          <div class="progress-num"><b>${esc(fmtNum(last.value))} ${esc(u)}</b>${pts.length > 1 ? `<small class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${esc(fmtNum(diff))} ${esc(u)} ${esc(t('inNSessions', pts.length))}</small>` : ''}</div>
        </div>
        ${chart(ex, pts)}
        <p class="muted small">${esc(t('lastWas', lastSummary(ex, last)))}${avgRest ? ` ${esc(t('avgRest', clock(avgRest)))}` : ''}</p>`;
    }
  } else if (ss.length) {
    const data = weekly(ss, state.exercises, { dim: H.dim, metric: H.metric, plans: live('plans'), routineId, now });
    // the week that's still going would look like a drop: the chart stops at the last full week
    if (data.weeks.length > 2 && data.weeks[data.weeks.length - 1] === weekStartOf(now)) {
      data.weeks = data.weeks.slice(0, -1); data.trained = data.trained.slice(0, -1);
      data.lines = data.lines.map((l) => ({ ...l, values: l.values.slice(0, -1) }));
    }
    const from = H.range ? Math.max(0, data.weeks.length - H.range) : 0;
    const all = data.lines.map((l) => ({ ...l, ...lineMeta(H.dim, l.key) }))
      .filter((l) => l.values.slice(from).some((v) => v))
      .sort((p, q) => (H.dim === 'region' ? [...REGION_KEYS, 'unsorted'].indexOf(p.key) - [...REGION_KEYS, 'unsorted'].indexOf(q.key) : 0));
    const off = new Set(H.off || []);
    const shown = all.filter((l) => !off.has(l.key));
    const tot = weekly(ss, state.exercises, { dim: H.dim === 'routine' ? 'routine' : 'all', metric: H.metric, routineId, now });
    const ch = tot.lines[0] ? changeOf(tot.lines[0].values, tot.trained, { now, weeks: tot.weeks }) : null;
    const inRange = ss.filter((s) => !H.range || s.start >= data.weeks[from]);
    const pzIn = pz.filter((p) => !H.range || p.to >= data.weeks[from]);
    chartCard = `${H.dim === 'routine' ? `<label class="field compact"><span>${esc(t('routineWord'))}</span><select id="h-routine">${rts.map((r) => `<option value="${esc(r.id)}" ${r.id === routineId ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>` : ''}
      <div class="kpis"><div><b>${inRange.length}</b><small>${esc(t('sessionsWord'))}</small></div><div><b>${pzIn.length}</b><small>${esc(t('pausesWord'))}</small></div><div><b class="${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${ch == null ? '—' : `${ch > 0 ? '+' : ''}${ch}%`}</b><small>${esc(t('last4'))}</small></div></div>
      ${linesChart(data, shown, pz, from, H.metric, H.dim)}
      ${all.length > 1 ? `<div class="legend" role="group" aria-label="${esc(t('legend'))}">${all.map((l) => `<button type="button" class="lg${off.has(l.key) ? ' off' : ''}" aria-pressed="${!off.has(l.key)}" data-lg="${esc(l.key)}"><i style="background:${l.color}"></i>${esc(l.name)}</button>`).join('')}</div>` : ''}
      <div class="seg-mini" role="group" aria-label="${esc(t('rangeLabel'))}">${RANGES.map(([n, k]) => `<button type="button" class="${H.range === n ? 'on' : ''}" aria-pressed="${H.range === n}" data-range="${n}">${esc(t(k))}</button>`).join('')}</div>
      <p class="muted small">${esc(t(`metricHint_${H.metric}`))}</p>`;
  }

  // where you improved: per body region, the last 4 weeks with training against the 4 before
  let improved = '';
  if (ss.length) {
    const vol = weekly(ss, state.exercises, { dim: 'region', metric: 'volume', now });
    const sets = weekly(ss, state.exercises, { dim: 'region', metric: 'sets', now });
    const rows = vol.lines.filter((l) => l.key !== 'unsorted' && l.key !== 'cardio').map((l) => {
      const c = changeOf(l.values, vol.trained, { now, weeks: vol.weeks });
      const sl = sets.lines.find((z) => z.key === l.key);
      const cs = sl ? changeOf(sl.values, sets.trained, { now, weeks: sets.weeks }) : null;
      return { key: l.key, c, why: c == null ? '' : c > 3 ? (cs > 3 ? t('whyMoreSets') : t('whyMoreKg')) : c < -3 ? (cs < -3 ? t('whyFewerSets') : t('whyLessKg')) : t('whySteady') };
    }).filter((r) => r.c != null).sort((p, q) => q.c - p.c);
    if (rows.length) {
      improved = `<section class="card imp-card"><h2 class="card-title">${esc(t('whereImproved'))}</h2><p class="muted small">${esc(t('whereImprovedHint'))}</p>
        ${rows.map((r) => `<div class="imp-row"><i style="background:${regionColor(r.key)}"></i><span>${esc(regionName(r.key, getLang()))}<small>${esc(r.why)}</small></span><b class="${r.c > 3 ? 'up' : r.c < -3 ? 'down' : ''}">${r.c > 0 ? '▲ +' : r.c < 0 ? '▼ ' : ''}${r.c}%</b></div>`).join('')}</section>`;
    }
  }

  const pauseCard = pz.length ? `<section class="card pause-card"><h2 class="card-title">${esc(t('pausesTitle'))}</h2><p class="muted small">${esc(t('pausesHint', Number(training().pauseDays) || 10))}</p>
    ${[...pz].reverse().slice(0, 8).map((p) => `<div class="pause-row"><span><b>${esc(p.ongoing ? t('pauseNow', p.days) : t('pauseDays', p.days))}</b><small>${esc(`${dayMonth(p.from)} – ${p.ongoing ? t('today').toLowerCase() : dayMonth(p.to)}`)}</small></span>
      <select data-why="${esc(p.key)}" aria-label="${esc(t('whyLabel'))}">${['', 'holiday', 'ill', 'injury', 'work', 'other'].map((o) => `<option value="${o}" ${(reasons[p.key] || '') === o ? 'selected' : ''}>${esc(o ? t(`why_${o}`) : t('whyQ'))}</option>`).join('')}</select></div>`).join('')}</section>` : '';

  const rows = ss.slice(0, 60).map((s) => {
    const r = get('routines', s.routineId) || state.routines.find((x) => x.id === s.routineId);
    const w = totalWeight(s, state.exercises);
    const meta = s.outcome === 'partial'
      ? [minText(s.minutes), t('nOfMSets', s.sets.length, plannedSets(s))].join(' · ')
      : [minText(s.minutes), t('nSets', s.sets.length), w ? `${fmtNum(w)} kg` : ''].filter(Boolean).join(' · ');
    return `<a class="row list-row" href="#/session/${encodeURIComponent(s.id)}">
      <span class="date-badge"><small>${esc(weekdayShort(s.start))}</small><b>${new Date(s.start).getDate()}</b></span>
      <span class="row-text"><span class="row-title">${esc(r?.name || t('workout'))}</span><span class="row-sub">${esc(meta)}</span></span>
      <span class="badge ${s.outcome === 'partial' ? 'partial' : 'done'}">${esc(s.outcome === 'partial' ? t('partial') : t('complete'))}</span>
    </a>`;
  }).join('');

  const chips = `<div class="dim-chips" role="group" aria-label="${esc(t('lookAt'))}">${DIMS.map((d) => `<button type="button" class="chip-btn${H.dim === d ? ' on' : ''}" aria-pressed="${H.dim === d}" data-dim="${d}">${esc(t(`dim_${d}`))}</button>`).join('')}</div>
    ${H.dim !== 'exercise' ? `<div class="seg-mini" role="group" aria-label="${esc(t('metricLabel'))}">${METRICS.map((m) => `<button type="button" class="${H.metric === m ? 'on' : ''}" aria-pressed="${H.metric === m}" data-metric="${m}">${esc(t(`metric_${m}`))}</button>`).join('')}</div>` : ''}`;
  const html = `<header class="page-head"><div><h1>${esc(t('tab_history'))}</h1>
      <p class="sub">${esc(t('monthSummary', monthName(now), thisMonth.length, minText(monthMin)))}</p></div><div class="head-actions">${gearLink()}</div></header>
    ${ss.length ? `<div class="cols side-first hist-cols"><aside class="col-side"><section class="card progress" aria-label="${esc(t('progressTitle'))}">${chips}${chartCard}</section>${improved}${pauseCard}</aside>
      <div class="col-main"><h2 class="section-title">${esc(t('sessionsTitle'))}</h2><div class="card list">${rows}</div></div></div>` : empty(t('esHistoryTitle'), t('esHistoryText'))}`;
  return {
    html,
    bind(view) {
      view.querySelector('#h-ex')?.addEventListener('change', (e) => { picked = e.target.value; window.dispatchEvent(new CustomEvent('palestra:render')); });
      view.querySelector('#h-routine')?.addEventListener('change', (e) => setHs({ routine: e.target.value }));
      view.querySelectorAll('[data-dim]').forEach((b) => b.addEventListener('click', () => { if (location.hash.includes('ex=')) history.replaceState(null, '', '#/history'); setHs({ dim: b.dataset.dim, off: [] }); }));
      view.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => setHs({ metric: b.dataset.metric })));
      view.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => setHs({ range: Number(b.dataset.range) })));
      view.querySelectorAll('[data-lg]').forEach((b) => b.addEventListener('click', () => { const o = new Set(hs().off || []); if (o.has(b.dataset.lg)) o.delete(b.dataset.lg); else o.add(b.dataset.lg); setHs({ off: [...o] }); }));
      view.querySelectorAll('[data-why]').forEach((sel) => sel.addEventListener('change', () => { const cur = { ...(pref('pauses', {}) || {}) }; if (sel.value) cur[sel.dataset.why] = sel.value; else delete cur[sel.dataset.why]; setPref('pauses', cur); }));
    },
  };
}

function plannedSets(s) {
  const r = state.routines.find((x) => x.id === s.routineId);
  if (!r) return s.sets.length;
  return (r.items || []).reduce((a, it) => { const ex = get('exercises', it.exerciseId); return a + (!ex ? 0 : ex.type === 'cardio' ? 1 : Number(it.sets) || 1); }, 0);
}

function lastSummary(ex, p) {
  if (ex.type === 'cardio') return `${fmtNum(p.value)} min${p.sets[0]?.distance ? ` · ${fmtNum(p.sets[0].distance)} km` : ''}`;
  const reps = p.sets.map((x) => x.reps ?? `${x.seconds} s`);
  const same = reps.every((r) => r === reps[0]);
  const body = same ? `${p.sets.length} × ${reps[0]}` : reps.join(', ');
  return ex.type === 'weights' ? `${body} · ${fmtNum(p.value)} kg` : body;
}

export function sessionView(id) {
  const s = get('sessions', id);
  if (!s) return { html: empty(t('notFound'), t('notFoundText'), `<a class="btn" href="#/history">${esc(t('tab_history'))}</a>`) };
  const r = state.routines.find((x) => x.id === s.routineId);
  const groups = [];
  for (const set of s.sets || []) {
    let g = groups[groups.length - 1];
    if (!g || g.exerciseId !== set.exerciseId) { g = { exerciseId: set.exerciseId, sets: [] }; groups.push(g); }
    g.sets.push(set);
  }
  const b = s.breakdown || {};
  const html = `<header class="bar">${backLink('#/history', t('tab_history'))}</header>
    <h1 class="title">${esc(r?.name || t('workout'))}</h1>
    <p class="sub">${esc(`${shortDate(s.start)} · ${timeOfDay(s.start)}–${timeOfDay(s.end)} · ${minText(s.minutes)}`)}${s.everydayBlockId ? ` · ${esc(t('fromEveryday'))}` : ''}</p>
    ${b.work != null ? breakdownBar(b, false) : ''}
    ${groups.map((g) => {
    const ex = state.exercises.find((e) => e.id === g.exerciseId);
    return `<section class="card"><h2 class="card-title">${esc(ex?.name || '—')}</h2>
      <ol class="sets-done">${g.sets.map((x) => `<li><span>${esc(setText(ex, x))}</span>${x.restTaken ? `<small>${esc(t('restedFor', clock(x.restTaken)))}</small>` : ''}</li>`).join('')}</ol></section>`;
  }).join('')}
    <button type="button" class="btn danger-text wide" data-action="delete">${esc(t('deleteSession'))}</button>`;
  return {
    html,
    bind(view) {
      view.querySelector('[data-action=delete]').addEventListener('click', async () => {
        if (!(await askConfirm({ text: t('deleteSessionQ'), ok: t('delete'), danger: true }))) return;
        const before = remove('sessions', id);
        location.hash = '#/history';
        toast(t('deletedSession'), { undo: () => restore('sessions', before) });
      });
    },
  };
}

export function setText(ex, x) {
  if (!ex) return '';
  if (ex.type === 'cardio') {
    const ms = measuresFor(ex, machineOf(ex));
    return [...ms.map((m) => (x.targets?.[m.key] != null ? `${fmtNum(x.targets[m.key])}${m.unit ? ` ${m.unit}` : ''}` : '')).filter(Boolean), x.distance ? `${fmtNum(x.distance)} km` : ''].filter(Boolean).join(' · ');
  }
  const amount = x.seconds != null ? `${x.seconds} s` : `${x.reps} ${t('repsShort')}`;
  return x.weight != null ? `${amount} × ${fmtNum(x.weight)} kg` : amount;
}

/** Where the minutes went: work, rests, walking between machines, pauses. dark = workout screen colours. */
export function breakdownBar(b, dark = true) {
  const parts = [['work', b.work || 0], ['rest', b.rest || 0], ['walk', b.walk || 0], ['pause', b.pause || 0]];
  const total = parts.reduce((a, p) => a + p[1], 0) || 1;
  const mins = (s) => Math.round(s / 60);
  return `<section class="breakdown ${dark ? 'dark' : 'card'}" aria-labelledby="bd-title">
    <h2 id="bd-title" class="eyebrow">${esc(t('whereMinutesWent', mins(total)))}</h2>
    <div class="bd-bar" role="img" aria-label="${esc(parts.map(([k, v]) => `${t(`bd_${k}`)} ${mins(v)} min`).join(', '))}">
      ${parts.filter(([, v]) => v > 0).map(([k, v]) => `<span class="bd-${k}" style="width:${((v / total) * 100).toFixed(1)}%"></span>`).join('')}
    </div>
    <div class="bd-legend">${parts.map(([k, v]) => `<span><i class="bd-${k}" aria-hidden="true"></i>${esc(t(`bd_${k}`))}<b>${mins(v)} min</b></span>`).join('')}</div>
  </section>`;
}

export { icon, live };
