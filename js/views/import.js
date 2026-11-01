// Importa: a plan or single routines from plain text (typed, pasted or a .txt file) or a Palestra .json file.
// First a preview (what's already yours, what's new, what couldn't be read), then the import.
import { get, live } from '../store.js';
import { t } from '../i18n.js';
import { esc, fmtNum } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, segmented, toggle } from '../ui/parts.js';
import { toast } from '../ui/dialogs.js';
import { parseImport, planImport, runImport } from '../importer.js';
import { estMinutes } from '../model.js';
import { training, refreshEstimates } from '../data.js';
import { activeInfo, activate, isoDate, nextMonday } from '../plans.js';

// what's on screen, kept across redraws
const st = { src: 'paste', text: '', result: null, error: '', asPlan: true, makeActive: false };

const rerender = () => window.dispatchEvent(new CustomEvent('palestra:render'));

const HELP = [
  ['SCHEDA: Push Pull Legs', 'helpPlan'],
  ['GIORNO: Spinta', 'helpDay'],
  ['Panca piana 4x8', 'helpSets'],
  ['… 60 kg', 'helpWeight'],
  ['… rec 2:30  /  rec 90s', 'helpRest'],
  ['Plank 3x45s', 'helpTimed'],
  ['Ellittica 15 min livello 6', 'helpCardio'],
  ['(bilanciere) (manubri) (cavi) (macchina)', 'helpEquipment'],
  ['- testo', 'helpNote'],
];

function itemText(it, ex) {
  if (ex.type === 'cardio') return [`${fmtNum(it.targets?.duration)} min`, it.targets?.speed != null ? `${fmtNum(it.targets.speed)} km/h` : '', it.targets?.level != null ? `${t('m_level').toLowerCase()} ${it.targets.level}` : ''].filter(Boolean).join(' · ');
  return `${it.sets} × ${it.seconds != null ? `${it.seconds} s` : it.reps}${it.weight ? ` · ${fmtNum(it.weight)} kg` : ''}`;
}

function preview() {
  const { data, issues } = st.result;
  const plan = planImport(data);
  const byLine = new Map(issues.filter((x) => x.line).map((x) => [x.line, x]));
  const exById = new Map(data.exercises.map((e) => [e.id, e]));
  const reusedCount = data.exercises.filter((e) => plan.map.get(e.id)).length;
  const fakeExercises = data.exercises.map((e) => ({ ...e }));
  const title = data.plan?.name || (data.routines.length === 1 ? data.routines[0].name : t('importedRoutines'));
  const sections = data.routines.map((r, i) => {
    const mins = estMinutes({ ...r, items: r.items.map((it) => ({ ...it, rest: it.rest ?? training().rest })) }, fakeExercises, [], training());
    const rows = r.items.map((it) => {
      const ex = exById.get(it.exerciseId);
      const issue = it._line && byLine.get(it._line);
      const status = issue ? 'q' : plan.map.get(ex.id) ? 'ok' : 'new';
      const tag = { ok: t('tagYours'), new: t('tagNew'), q: t('tagCheck') }[status];
      return `<div class="imp-row"><span class="row-text"><span class="row-title">${esc(ex.name)}</span>${issue ? `<span class="imp-issue">${esc(t('notUnderstood', issue.detail || ''))}</span>` : ''}</span>
        <span class="muted small nowrap">${esc(itemText(it, ex))}</span><span class="imp-tag ${status}">${esc(tag)}</span></div>`;
    }).join('');
    return `<section class="card imp-day"><div class="imp-head"><b>${esc(`${i + 1} · ${plan.routines[i].finalName}`)}</b><span class="muted small">${mins} min</span></div>${rows}</section>`;
  }).join('');
  const lost = issues.filter((x) => x.reason !== 'leftover');
  const counts = t('importCounts', data.routines.length, data.exercises.length, reusedCount, data.exercises.length - reusedCount, issues.length);
  const a = activeInfo();
  return `<header class="bar"><button type="button" class="back plain" data-action="back-edit">${icon('back', 20)}<span>${esc(t('importShort'))}</span></button></header>
    <h1 class="title small">${esc(title)}</h1>
    <p class="lead">${esc(counts)}</p>
    <div class="stack">${sections}
      ${lost.length ? `<section class="card warn-card"><b>${esc(t('linesSkipped', lost.length))}</b>${lost.map((x) => `<div class="imp-row"><span class="muted small">${esc(t('lineN', x.line))}</span><code>${esc(x.text)}</code></div>`).join('')}<p class="muted small">${esc(t('linesSkippedHint'))}</p></section>` : ''}
      ${data.plan ? `<div class="card">${toggle({ name: 'asPlan', checked: st.asPlan, label: t('saveAsPlan'), hint: t('saveAsPlanHint', data.routines.length) })}
        ${st.asPlan ? toggle({ name: 'makeActive', checked: st.makeActive, label: t('makeItActive'), hint: a ? t('makeItActiveHint', a.plan.name) : t('makeItActiveHintNone') }) : ''}</div>` : ''}
      <button type="button" class="btn yellow big wide" data-action="do-import">${esc(data.plan && st.asPlan ? t('importPlan') : t('importNRoutines', data.routines.length))}</button>
      ${issues.length ? `<button type="button" class="btn ghost wide" data-action="back-edit">${esc(t('fixText'))}</button>` : ''}
    </div>`;
}

export function importView() {
  if (st.result) {
    return {
      html: preview(),
      bind(view) {
        view.querySelectorAll('[data-action=back-edit]').forEach((b) => b.addEventListener('click', () => { st.result = null; st.src = 'paste'; rerender(); }));
        view.querySelector('[name=asPlan]')?.addEventListener('change', (e) => { st.asPlan = e.target.checked; rerender(); });
        view.querySelector('[name=makeActive]')?.addEventListener('change', (e) => { st.makeActive = e.target.checked; });
        view.querySelector('[data-action=do-import]').addEventListener('click', () => {
          const { data } = st.result;
          for (const r of data.routines) for (const it of r.items) delete it._line;
          const out = runImport(data, { asPlan: st.asPlan });
          refreshEstimates();
          if (out.planId && st.makeActive) {
            const plan = get('plans', out.planId);
            activate(plan, isoDate(activeInfo() && new Date().getDay() !== 1 ? nextMonday() : Date.now()));
          }
          toast(out.planId ? t('importedPlan', get('plans', out.planId).name) : t('importDone', out.routines.length));
          const dest = out.planId ? `#/plan/${encodeURIComponent(out.planId)}` : '#/routines';
          Object.assign(st, { text: '', result: null, error: '', makeActive: false, asPlan: true });
          location.hash = dest;
        });
      },
    };
  }
  const html = `<header class="bar">${backLink('#/routines', t('tab_routines'))}</header>
    <h1 class="title">${esc(t('importShort'))}</h1>
    <p class="lead">${esc(t('importLead'))}</p>
    <div class="stack form">
      ${segmented({ name: 'src', value: st.src, options: [['paste', t('pasteText')], ['file', t('fromFile')]], label: t('importFrom') })}
      ${st.src === 'paste' ? `<label class="field"><span class="sr">${esc(t('planText'))}</span><textarea id="imp-text" class="mono" rows="14" placeholder="${esc(t('importPlaceholder'))}">${esc(st.text)}</textarea></label>`
    : `<label class="drop">${icon('book', 32)}<b>${esc(t('importPickFile'))}</b><span class="muted small">${esc(t('importFileHint'))}</span><span class="btn">${esc(t('browse'))}</span><input type="file" accept=".txt,.json,text/plain,application/json" data-file class="sr"></label>`}
      ${st.error ? `<p class="warn" role="alert">${esc(st.error)}</p>` : ''}
      <details class="card help"><summary>${esc(t('howToWrite'))}${icon('down', 18, 'class="chev"')}</summary>
        <div class="help-rows">${HELP.map(([code, key]) => `<div><code>${esc(code)}</code><span>${esc(t(key))}</span></div>`).join('')}</div></details>
      ${st.src === 'paste' ? `<button type="button" class="btn primary big wide" data-action="read">${esc(t('readText'))}</button>` : ''}
    </div>`;
  return {
    html,
    bind(view) {
      view.querySelectorAll('[name=src]').forEach((x) => x.addEventListener('change', () => { st.text = view.querySelector('#imp-text')?.value ?? st.text; st.src = x.value; st.error = ''; rerender(); }));
      const read = (text) => {
        st.text = text;
        const res = parseImport(text);
        if (res.error) { st.error = t(res.error, res.detail || ''); st.result = null; } else { st.error = ''; st.result = res; st.asPlan = true; st.makeActive = !activeInfo(); }
        rerender();
      };
      view.querySelector('[data-action=read]')?.addEventListener('click', () => read(view.querySelector('#imp-text').value));
      view.querySelector('#imp-text')?.addEventListener('input', (e) => { st.text = e.target.value; });
      view.querySelector('[data-file]')?.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const text = await f.text();
        st.src = 'paste';
        read(text);
      });
    },
    leave() { if (!st.result) st.error = ''; },
  };
}

export function importReset() { Object.assign(st, { text: '', result: null, error: '' }); }
export { live };
