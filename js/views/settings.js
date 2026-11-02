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
import { activeInfo } from '../plans.js';

// Shown at the bottom of Settings. Keep in step with VERSION in sw.js: changing sw.js is what makes phones update.
import { themeChoice, applyTheme } from '../theme.js';

export const APP_VERSION = 'v17';
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

/** The user guide is its own page next to the app (guide-it.html, guide-en.html), opened in the same tab. */
export const guideHref = () => `guide-${getLang() === 'en' ? 'en' : 'it'}.html`;

export function settingsView(sub, sub2) {
  if (sub === 'guide') { location.replace(guideHref()); return { html: '' }; }
  sub = { lang: 'look', backup: 'data' }[sub] || sub; // addresses from before v16
  if (sub && SUB[sub]) return SUB[sub](sub2);
  const inc = increaseSettings();
  const tr = training();
  const planned = plannedAhead(pref('planned', []));
  const lang = LANGS[getLang()];
  const theme = t({ auto: 'themeAuto', light: 'themeLight', dark: 'themeDark' }[themeChoice()]);
  // one list, in groups; every row opens a page about one thing and says how it's set now
  const groups = [
    [t('grpConnections'), [
      ['github', 'link', t('set_github'), isConfigured() ? `${state.settings.owner}/${state.settings.repo}` : t('notConnected')],
      ['everyday', 'calcheck', t('set_everyday'), planned.length ? t('everydayPlannedN', planned.length) : t('everydayHow')],
    ]],
    [t('grpTraining'), [
      ['#/plans', 'calendar', t('plansTitle'), activeInfo() ? t('activeIs', activeInfo().plan.name) : t('noActivePlanShort')],
      ['increase', 'trend', t('set_increase'), `${inc.when === 'always' ? t('whenAlways') : t('whenDone')} · ${t('cat_machine').toLowerCase()} +${fmtNum(inc.steps.machine)} kg`],
      ['training', 'timer', t('set_training'), [t('restBetweenSetsShort', tr.rest), tr.vibrate ? t('vibration') : '', tr.wake ? t('screenOn') : ''].filter(Boolean).join(' · ')],
      ['gym', 'pin', t('set_gym'), [pref('gymName', '') || t('yourGym'), 'kg, km/h'].join(' · ')],
    ]],
    [t('grpApp'), [
      ['look', 'globe', t('set_langLook'), `${lang} · ${theme}`],
      ['#/import', 'arrowDown', t('importShort'), t('importSub')],
      ['data', 'download', t('set_data'), t('dataSub')],
      [guideHref(), 'book', t('set_guide'), t('guideSub')],
    ]],
  ];
  const html = `<header class="bar">${backLink('#/today', t('tab_today'))}</header>
    <h1 class="title">${esc(t('settings'))}</h1>
    ${statusCard()}
    ${groups.map(([h, rows]) => `<div class="set-sub-h">${esc(h)}</div>${setList(rows)}`).join('')}
    <p class="version">Palestra ${VERSION}</p>`;
  return { html, bind: bindStatus };
}

/** Rows that each open a page: icon, title, the current state, chevron. A key is a page here, or a full address. */
function setList(rows) {
  return `<nav class="set-list">${rows.map(([k, ic, title, sub]) => {
    const href = k.startsWith('#') || k.endsWith('.html') ? k : `#/settings/${k}`;
    return `<a class="set-row" href="${href}"><span class="set-ico" aria-hidden="true">${icon(ic)}</span><span class="set-text"><b>${esc(title)}</b><small>${esc(sub)}</small></span><span class="set-chev" aria-hidden="true">${icon('chevron', 18)}</span></a>`;
  }).join('')}</nav>`;
}

function bindStatus(view) {
  view.querySelector('[data-action=sync]')?.addEventListener('click', () => syncNow());
}

/** A settings page: ← the list it came from, then its title with its icon. */
function page(title, body, bind = () => {}, intro = '', { ic = '', back = ['#/settings', t('settings')] } = {}) {
  ic = ic || { [t('set_github')]: 'link', [t('set_increase')]: 'trend', [t('set_training')]: 'timer', [t('set_gym')]: 'pin', [t('set_everyday')]: 'calcheck' }[title] || '';
  return {
    html: `<a class="set-back" href="${back[0]}">← ${esc(back[1])}</a><h1 class="title set-title">${ic ? `<span class="set-ico" aria-hidden="true">${icon(ic)}</span>` : ''}${esc(title)}</h1>${intro ? `<p class="lead">${esc(intro)}</p>` : ''}${body}`,
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

  /** Lingua e aspetto: the language, and Automatico / Chiaro / Scuro (kept on this device only). */
  look() {
    const cur = themeChoice();
    const opts = [['auto', t('themeAuto')], ['light', t('themeLight')], ['dark', t('themeDark')]];
    const body = `<form class="stack form" data-form="look">
      ${segmented({ name: 'lang', value: getLang(), options: Object.entries(LANGS), label: t('set_lang') })}
      <div class="field-head">${esc(t('appearance'))}</div>
      <div class="seg theme-seg" role="radiogroup" aria-label="${esc(t('appearance'))}">${opts.map(([v, l]) => `<label class="${cur === v ? 'on' : ''}"><input type="radio" name="theme" value="${v}" ${cur === v ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
      <p class="muted small">${esc(t('themeHint'))}</p>
      <p class="muted small">${esc(t('workoutAlwaysDark'))}</p>
    </form>`;
    return page(t('set_langLook'), body, (view) => {
      view.querySelectorAll('[name=lang]').forEach((x) => x.addEventListener('change', () => saveSettings({ lang: x.value })));
      view.querySelectorAll('[name=theme]').forEach((x) => x.addEventListener('change', () => {
        applyTheme(x.value);
        view.querySelectorAll('.theme-seg label').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      }));
    }, '', { ic: 'globe' });
  },

  /** I tuoi dati: a list, one page each (the backup; this device). */
  data(sub) {
    if (sub === 'backup') return backupPage();
    if (sub === 'device') return devicePage();
    const body = setList([
      ['data/backup', 'download', t('set_backup'), t('backupSub')],
      ['data/device', 'trash', t('thisDevice'), t('thisDeviceSub')],
    ]);
    return page(t('set_data'), body, () => {}, '', { ic: 'download' });
  },
};

const toData = () => ['#/settings/data', t('set_data')];

function backupPage() {
  const body = `<div class="stack"><p>${esc(t('backupText'))}</p>
      <button type="button" class="btn primary wide" data-action="download">${icon('download', 18)}${esc(t('downloadBackup'))}</button>
      <p class="muted small">${esc(t('backupRepoHint'))}</p></div>`;
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
  }, '', { ic: 'download', back: toData() });
}

function devicePage() {
  const body = `<div class="stack"><p>${esc(isConfigured() ? t('wipeQSynced') : t('wipeQLocal'))}</p>
      <button type="button" class="btn danger-text wide" data-action="wipe">${esc(t('wipeDevice'))}</button></div>`;
  return page(t('thisDevice'), body, (view) => {
    view.querySelector('[data-action=wipe]').addEventListener('click', async () => {
      if (!(await askConfirm({ text: isConfigured() ? t('wipeQSynced') : t('wipeQLocal'), ok: t('wipe'), danger: true }))) return;
      await resetLocal();
      toast(t('wiped'));
      if (isConfigured()) syncNow();
    });
  }, '', { ic: 'trash', back: toData() });
}
