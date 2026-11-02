// Impostazioni: a status card, then one row per section, each opening its own page (as in Ricette).
import { state, saveSettings, setPref, pref, live, kvGet, COLLECTIONS, resetLocal } from '../store.js';
import { t, LANGS, getLang } from '../i18n.js';
import { esc, fmtNum, dateTime } from '../ui/format.js';
import { icon } from '../ui/icons.js';
import { backLink, stepper, bindSteppers, stepVal, toggle, segmented, bold } from '../ui/parts.js';
import { askConfirm, toast } from '../ui/dialogs.js';
import { syncStatus } from '../shell.js';
import { syncNow, isSyncing, isConfigured, testConnection, clearFileCache, CONTRACT } from '../sync.js';
import { training, increaseSettings, refreshEstimates } from '../data.js';
import { INCREASE_STEP, plannedAhead } from '../model.js';
import { GUIDE } from '../guide.js';
import { activeInfo } from '../plans.js';

// Shown at the bottom of Settings. Keep in step with VERSION in sw.js: changing sw.js is what makes phones update.
export const APP_VERSION = 'v9';
const VERSION = APP_VERSION;

function statusCard() {
  const st = syncStatus(isSyncing());
  const s = state.settings;
  const where = isConfigured() ? `${s.owner}/${s.repo}` : t('notConnected');
  const when = state.meta.lastSync ? dateTime(state.meta.lastSync) : t('neverSynced');
  const err = state.meta.lastError && state.meta.lastError !== 'network' ? ` · ${t(`err_${state.meta.lastError}`)}` : '';
  return `<section class="card status-card st-${st}" aria-label="${esc(t('syncStatus'))}">
    <span class="dot" aria-hidden="true"></span>
    <div class="row-text"><span class="row-title">${esc(t(`st_${st}`))}</span><span class="row-sub">${esc(`${where} · ${when}${err}`)}</span></div>
    ${isConfigured() ? `<button type="button" class="btn small" data-action="sync">${esc(t('sync'))}</button>` : `<a class="btn small primary" href="#/settings/github">${esc(t('connect'))}</a>`}
  </section>
  ${state.meta.contractNewer ? `<p class="warn">${esc(t('contractNewer'))}</p>` : ''}`;
}

export function settingsView(sub) {
  if (sub && SUB[sub]) return SUB[sub]();
  const inc = increaseSettings();
  const tr = training();
  const planned = plannedAhead(pref('planned', []));
  const rows = [
    ['github', 'link', t('set_github'), isConfigured() ? `${state.settings.owner}/${state.settings.repo}` : t('notConnected')],
    ['plans', 'calendar', t('plansTitle'), activeInfo() ? t('activeIs', activeInfo().plan.name) : t('noActivePlanShort')],
    ['increase', 'trend', t('set_increase'), `${inc.when === 'always' ? t('whenAlways') : t('whenDone')} · ${t('cat_machine').toLowerCase()} +${fmtNum(inc.steps.machine)} kg`],
    ['training', 'timer', t('set_training'), [t('restBetweenSetsShort', tr.rest), tr.vibrate ? t('vibration') : '', tr.wake ? t('screenOn') : ''].filter(Boolean).join(' · ')],
    ['gym', 'pin', t('set_gym'), [pref('gymName', '') || t('yourGym'), 'kg, km/h'].join(' · ')],
    ['everyday', 'calcheck', t('set_everyday'), planned.length ? t('everydayPlannedN', planned.length) : t('everydayHow')],
    ['lang', 'globe', t('set_lang'), LANGS[getLang()]],
    ['import', 'arrowDown', t('importShort'), t('importSub')],
    ['backup', 'download', t('set_backup'), t('backupSub')],
    ['guide', 'book', t('set_guide'), t('guideSub')],
  ];
  const html = `<header class="bar">${backLink('#/today', t('tab_today'))}</header>
    <h1 class="title">${esc(t('settings'))}</h1>
    ${statusCard()}
    <nav class="card list settings-list" aria-label="${esc(t('settings'))}">
      ${rows.map(([k, ic, title, sub2]) => `<a class="row list-row" href="${k === 'plans' ? '#/plans' : k === 'import' ? '#/import' : `#/settings/${k}`}">
        <span class="icon-tile" aria-hidden="true">${icon(ic)}</span>
        <span class="row-text"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub2)}</span></span>${icon('chevron', 18, 'class="chev"')}</a>`).join('')}
    </nav>
    <p class="version">Palestra ${VERSION}</p>`;
  return { html, bind: bindStatus };
}

function bindStatus(view) {
  view.querySelector('[data-action=sync]')?.addEventListener('click', () => syncNow());
}

function page(title, body, bind = () => {}, intro = '') {
  return {
    html: `<header class="bar">${backLink('#/settings', t('settings'))}</header><h1 class="title">${esc(title)}</h1>${intro ? `<p class="lead">${esc(intro)}</p>` : ''}${body}`,
    bind,
  };
}

const SUB = {
  github() {
    const s = state.settings;
    const body = `<form class="stack form" data-form="gh" autocomplete="off">
      <label class="field"><span>${esc(t('ghUser'))}</span><input id="gh-owner" name="owner" value="${esc(s.owner)}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>${esc(t('ghRepo'))}</span><input id="gh-repo" name="repo" value="${esc(s.repo || 'palestra-data')}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>${esc(t('ghBranch'))}</span><input id="gh-branch" name="branch" value="${esc(s.branch || 'main')}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span>${esc(t('ghToken'))}</span><input id="gh-token" name="token" type="password" value="" placeholder="${esc(s.token ? t('tokenKeep', `…${s.token.slice(-4)}`) : 'github_pat_…')}" autocapitalize="off" spellcheck="false">
        <small class="muted">${esc(t('ghTokenHint'))}</small></label>
      <div class="button-row"><button class="btn primary" type="submit">${esc(t('saveAndSync'))}</button><button type="button" class="btn" data-action="test">${esc(t('testConnection'))}</button></div>
      <p class="muted" data-result role="status"></p>
      ${isConfigured() ? `<button type="button" class="btn danger-text wide" data-action="disconnect">${esc(t('disconnect'))}</button>` : ''}
    </form>`;
    return page(t('set_github'), body, (view) => {
      const form = view.querySelector('[data-form=gh]');
      const out = view.querySelector('[data-result]');
      const save = async () => {
        const patch = { owner: form.owner.value.trim(), repo: form.repo.value.trim() || 'palestra-data', branch: form.branch.value.trim() || 'main' };
        if (form.token.value.trim()) patch.token = form.token.value.trim();
        const changed = patch.owner !== s.owner || patch.repo !== s.repo || patch.branch !== s.branch;
        await saveSettings(patch);
        if (changed) await clearFileCache();
      };
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await save();
        out.textContent = t('syncing');
        const res = await syncNow();
        out.textContent = res.ok ? t('syncOk') : res.error ? t(`err_${res.error}`) : res.offline ? t('st_offline') : '';
      });
      view.querySelector('[data-action=test]').addEventListener('click', async () => {
        await save();
        out.textContent = t('testing');
        const res = await testConnection();
        out.textContent = res.ok ? (res.private ? t('testOkPrivate') : t('testOkPublic')) : t(`err_${res.error}`);
      });
      view.querySelector('[data-action=disconnect]')?.addEventListener('click', async () => {
        if (!(await askConfirm({ text: t('disconnectQ'), ok: t('disconnect'), danger: true }))) return;
        await saveSettings({ token: '' });
        toast(t('disconnected'));
      });
    });
  },

  increase() {
    const inc = increaseSettings();
    const cats = ['machine', 'barbell', 'dumbbell', 'cable', 'bodyweight', 'cardio'];
    const unit = (c) => (c === 'bodyweight' ? t('repsShort') : c === 'cardio' ? 'min' : 'kg');
    const body = `<form class="stack form" data-form="inc">
      <h2 class="section-title">${esc(t('when'))}</h2>
      <div class="card">${segmented({ name: 'when', value: inc.when, options: [['done', t('whenDone')], ['always', t('whenAlways')]], label: t('when') })}
        <p class="card-foot">${esc(inc.when === 'always' ? t('whenAlwaysText') : t('whenDoneText'))}</p></div>
      <h2 class="section-title">${esc(t('howMuchPerType'))}</h2>
      <div class="card stack-rows">${cats.map((c) => stepper({ name: c, value: inc.steps[c], step: INCREASE_STEP[c], min: 0, unit: unit(c), label: `${t(`cat_${c}`)} · ${t(`catHint_${c}`)}` })).join('')}</div>
      <p class="muted small">${esc(t('stepsHint'))}</p>
    </form>`;
    return page(t('set_increase'), body, (view) => {
      const form = view.querySelector('[data-form=inc]');
      const save = () => {
        const steps = {};
        for (const c of cats) steps[c] = stepVal(form, c) ?? 0;
        setPref('increase', { when: form.querySelector('[name=when]:checked').value, steps });
      };
      bindSteppers(form, save);
      form.querySelectorAll('[name=when]').forEach((x) => x.addEventListener('change', save));
    }, t('increaseIntro'));
  },

  training() {
    const tr = training();
    const body = `<form class="stack form" data-form="tr">
      <div class="card stack-rows">
        ${stepper({ name: 'rest', value: tr.rest, step: 15, min: 0, unit: 's', label: t('restBetweenSets') })}
        ${stepper({ name: 'between', value: tr.between, step: 15, min: 0, unit: 's', label: t('restBetweenExercises') })}
      </div>
      <div class="card">${toggle({ name: 'vibrate', checked: tr.vibrate, label: t('vibrateAtEnd') })}${toggle({ name: 'sound', checked: tr.sound, label: t('soundAtEnd') })}${toggle({ name: 'wake', checked: tr.wake, label: t('keepScreenOn'), hint: t('keepScreenOnHint') })}</div>
      <p class="muted small">${esc(t('trainingHint'))}</p>
    </form>`;
    return page(t('set_training'), body, (view) => {
      const form = view.querySelector('[data-form=tr]');
      const save = () => { setPref('training', { rest: stepVal(form, 'rest') ?? 90, between: stepVal(form, 'between') ?? 120, vibrate: form.vibrate.checked, sound: form.sound.checked, wake: form.wake.checked }); refreshEstimates(); };
      bindSteppers(form, save);
      form.querySelectorAll('input[type=checkbox]').forEach((x) => x.addEventListener('change', save));
    });
  },

  gym() {
    const body = `<form class="stack form" data-form="gym">
      <label class="field"><span>${esc(t('gymName'))}</span><input id="gym-name" name="gymName" value="${esc(pref('gymName', ''))}" placeholder="${esc(t('gymNamePh'))}" autocomplete="off"></label>
      <div class="card kv-list"><div class="kv"><span>${esc(t('units'))}</span><b>kg · km/h</b></div></div>
      <a class="btn wide" href="#/gym">${icon('pin', 18)}${esc(t('zonesAndMachines'))}</a>
    </form>`;
    return page(t('set_gym'), body, (view) => {
      const form = view.querySelector('[data-form=gym]');
      form.gymName.addEventListener('change', () => setPref('gymName', form.gymName.value.trim()));
    });
  },

  everyday() {
    const planned = plannedAhead(pref('planned', []));
    const body = `<div class="card kv-list">
        <div class="kv"><span>${esc(t('contract'))}</span><b>v${CONTRACT}</b></div>
        <div class="kv"><span>${esc(t('plansTitle'))}</span><b>${esc(activeInfo() ? activeInfo().plan.name : t('noActivePlanShort'))}</b></div>
        <div class="kv"><span>${esc(t('plannedByEveryday'))}</span><b>${planned.length ? esc(t('everydayPlannedN', planned.length)) : esc(t('nothingYet'))}</b></div>
        <div class="kv"><span>${esc(t('routinesShared'))}</span><b>${live('routines').length}</b></div>
      </div>
      <section class="prose">${t('everydayExplain').map((p) => `<p>${bold(p)}</p>`).join('')}</section>`;
    return page(t('set_everyday'), body, () => {}, t('everydayIntro'));
  },

  lang() {
    const body = `<form class="stack form" data-form="lang">${segmented({ name: 'lang', value: getLang(), options: Object.entries(LANGS), label: t('set_lang') })}</form>`;
    return page(t('set_lang'), body, (view) => {
      view.querySelectorAll('[name=lang]').forEach((x) => x.addEventListener('change', () => saveSettings({ lang: x.value })));
    });
  },

  backup() {
    const body = `<div class="stack"><p>${esc(t('backupText'))}</p>
      <button type="button" class="btn primary wide" data-action="download">${icon('download', 18)}${esc(t('downloadBackup'))}</button>
      <p class="muted small">${esc(t('backupRepoHint'))}</p>
      <h2 class="section-title">${esc(t('thisDevice'))}</h2>
      <button type="button" class="btn danger-text wide" data-action="wipe">${esc(t('wipeDevice'))}</button></div>`;
    return page(t('set_backup'), body, (view) => {
      view.querySelector('[data-action=download]').addEventListener('click', async () => {
        const data = { app: 'palestra', version: VERSION, contract: CONTRACT, exportedAt: new Date().toISOString() };
        for (const c of COLLECTIONS) data[c] = state[c];
        data.active = await kvGet('active');
        const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `palestra-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      });
      view.querySelector('[data-action=wipe]').addEventListener('click', async () => {
        if (!(await askConfirm({ text: isConfigured() ? t('wipeQSynced') : t('wipeQLocal'), ok: t('wipe'), danger: true }))) return;
        await resetLocal();
        toast(t('wiped'));
        if (isConfigured()) syncNow();
      });
    });
  },

  guide() {
    const chapters = GUIDE[getLang()] || GUIDE.it;
    const body = `<div class="stack tight guide">${chapters.map(([title, intro, steps], i) => `<details class="card guide-ch" ${i === 0 ? 'open' : ''}>
        <summary><span class="num-dot ink">${i + 1}</span><span class="row-title">${esc(title)}</span>${icon('down', 18, 'class="chev"')}</summary>
        <div class="guide-body"><p>${bold(intro)}</p>${steps && steps.length ? `<ol>${steps.map((s) => `<li>${bold(s)}</li>`).join('')}</ol>` : ''}</div>
      </details>`).join('')}</div>`;
    return page(t('set_guide'), body, () => {}, t('guideIntro'));
  },
};
