// The theme: Automatico (follows the device), Chiaro or Scuro. A setting of this device, like the language.
// index.html applies the saved choice before the first paint (localStorage "palestraTheme"), so there is no flash;
// this module keeps it in step afterwards and when the device switches between light and dark.
import { state, saveSettings } from './store.js';

const KEY = 'palestraTheme';
const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export const themeChoice = () => (['auto', 'light', 'dark'].includes(state.settings.theme) ? state.settings.theme : 'auto');
export const systemDark = () => Boolean(mq && mq.matches);
export const isDarkTheme = () => (themeChoice() === 'auto' ? systemDark() : themeChoice() === 'dark');

export function applyTheme(workout = document.body.classList.contains('mode-workout')) {
  const dark = isDarkTheme();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', workout || dark ? '#141518' : '#F5F4F0');
  try { localStorage.setItem(KEY, themeChoice()); } catch { /* private mode */ }
}

export async function setTheme(choice) {
  await saveSettings({ theme: choice });
  applyTheme();
}

export function watchSystemTheme() {
  mq?.addEventListener?.('change', () => { if (themeChoice() === 'auto') applyTheme(); });
}
