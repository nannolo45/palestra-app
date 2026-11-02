// Light, dark or automatic: the same as Everyday and Ricette (see the handover "user guides and the settings gear").
// The choice stays on this device, in localStorage under "palestra-theme"; index.html applies it before the first paint
// and the guide pages read the same key. The page carries a class on <html>: "light" or "dark".
export const THEMES = ['auto', 'light', 'dark'];
const KEY = 'palestra-theme';
const MQ = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
let choice = 'auto';
try {
  choice = localStorage.getItem(KEY) || localStorage.getItem('palestraTheme') || 'auto'; // v14–v15 used "palestraTheme"
  localStorage.removeItem('palestraTheme');
} catch { /* no storage */ }
let workout = false;

export const themeChoice = () => (THEMES.includes(choice) ? choice : 'auto');
export const systemDark = () => Boolean(MQ?.matches);
export const isDark = () => (themeChoice() === 'auto' ? systemDark() : themeChoice() === 'dark');

/** The colour of the phone's status bar: the page's own bar (white in light, the page in dark; dark while training). */
function barColour(dark) { return workout || dark ? '#151a1b' : '#ffffff'; }

export function applyTheme(c = themeChoice()) {
  choice = THEMES.includes(c) ? c : 'auto';
  try { localStorage.setItem(KEY, choice); } catch { /* no storage */ }
  const dark = isDark();
  const root = document.documentElement;
  root.classList.toggle('dark', dark); root.classList.toggle('light', !dark);
  // every theme-color tag (index.html has one per system scheme, so a phone that reads them only at launch still matches)
  document.querySelectorAll('meta[name=theme-color]').forEach((m) => m.setAttribute('content', barColour(dark)));
}

/** The workout screen is always dark, whatever the theme. */
export function setWorkoutMode(on) { if (on !== workout) { workout = on; applyTheme(); } }

MQ?.addEventListener?.('change', () => { if (themeChoice() === 'auto') applyTheme('auto'); });
