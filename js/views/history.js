// Storico: progress per exercise, and every session.
import { state, get, remove, restore, live } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum, shortDate, dayMonth, weekdayShort, timeOfDay, minText, clock, monthName } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, empty, gearLink } from '../ui/parts.js';
import { askConfirm, toast } from '../ui/dialogs.js';
import { sessions, exercises, machineOf } from '../data.js';
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

export function historyView(query = {}) {
  const ss = sessions().filter((s) => s.end);
  const exs = exercises().filter((e) => progressOf(e, ss).length);
  if (query.ex && exs.some((e) => e.id === query.ex)) picked = query.ex;
  if (!picked || !exs.some((e) => e.id === picked)) picked = exs[0]?.id || null;
  const ex = picked && get('exercises', picked);
  const pts = ex ? progressOf(ex, ss).slice(-12) : [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = ss.filter((s) => s.start >= monthStart);
  const monthMin = thisMonth.reduce((a, s) => a + (s.minutes || 0), 0);

  let progress = '';
  if (ex && pts.length) {
    const first = pts[0]; const last = pts[pts.length - 1];
    const diff = last.value - first.value;
    const u = unitOf(ex);
    const rests = last.sets.map((x) => x.restTaken).filter((x) => x > 0);
    const avgRest = rests.length ? rests.reduce((a, b) => a + b, 0) / rests.length : null;
    progress = `<section class="card progress" aria-label="${esc(t('progressPerExercise'))}">
      <div class="progress-head">
        <label class="field compact"><span>${esc(t('exercise'))}</span><select id="h-ex">${exs.map((e) => `<option value="${esc(e.id)}" ${e.id === picked ? 'selected' : ''}>${esc([e.name, machineOf(e)?.number].filter(Boolean).join(' · '))}</option>`).join('')}</select></label>
        <div class="progress-num"><b>${esc(fmtNum(last.value))} ${esc(u)}</b>${pts.length > 1 ? `<small class="${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '+' : ''}${esc(fmtNum(diff))} ${esc(u)} ${esc(t('inNSessions', pts.length))}</small>` : ''}</div>
      </div>
      ${chart(ex, pts)}
      <p class="muted small">${esc(t('lastWas', lastSummary(ex, last)))}${avgRest ? ` ${esc(t('avgRest', clock(avgRest)))}` : ''}</p>
    </section>`;
  }

  const rows = ss.slice(0, 60).map((s) => {
    const r = get('routines', s.routineId) || state.routines.find((x) => x.id === s.routineId);
    const w = totalWeight(s);
    const meta = s.outcome === 'partial'
      ? [minText(s.minutes), t('nOfMSets', s.sets.length, plannedSets(s))].join(' · ')
      : [minText(s.minutes), t('nSets', s.sets.length), w ? `${fmtNum(w)} kg` : ''].filter(Boolean).join(' · ');
    return `<a class="row list-row" href="#/session/${encodeURIComponent(s.id)}">
      <span class="date-badge"><small>${esc(weekdayShort(s.start))}</small><b>${new Date(s.start).getDate()}</b></span>
      <span class="row-text"><span class="row-title">${esc(r?.name || t('workout'))}</span><span class="row-sub">${esc(meta)}</span></span>
      <span class="badge ${s.outcome === 'partial' ? 'partial' : 'done'}">${esc(s.outcome === 'partial' ? t('partial') : t('complete'))}</span>
    </a>`;
  }).join('');

  const html = `<header class="page-head"><div><h1>${esc(t('tab_history'))}</h1>
      <p class="sub">${esc(t('monthSummary', monthName(now), thisMonth.length, minText(monthMin)))}</p></div><div class="head-actions">${gearLink()}</div></header>
    ${ss.length ? `<div class="cols side-first">${progress ? `<aside class="col-side">${progress}</aside>` : ''}<div class="col-main"><h2 class="section-title">${esc(t('sessionsTitle'))}</h2><div class="card list">${rows}</div></div></div>` : empty(t('esHistoryTitle'), t('esHistoryText'))}`;
  return {
    html,
    bind(view) {
      view.querySelector('#h-ex')?.addEventListener('change', (e) => { picked = e.target.value; window.dispatchEvent(new CustomEvent('palestra:render')); });
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
      <ol class="set-list">${g.sets.map((x) => `<li><span>${esc(setText(ex, x))}</span>${x.restTaken ? `<small>${esc(t('restedFor', clock(x.restTaken)))}</small>` : ''}</li>`).join('')}</ol></section>`;
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
