// Small text helpers shared by the views: HTML escaping, numbers with the right decimal mark, times and dates.
import { getLang } from '../i18n.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** "117,5" → 117.5; '' → null */
export const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** 117.5 → "117,5" in Italian, "117.5" in English; whole numbers without decimals. */
export function fmtNum(x, maxDecimals = 2) {
  if (x == null || x === '' || !Number.isFinite(Number(x))) return '';
  return Number(x).toLocaleString(getLang() === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits: maxDecimals, useGrouping: Math.abs(x) >= 10000 });
}

/** Seconds → "1:05" (or "1:02:05"). */
export function clock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/** Seconds → "90 s", "2 min", "1 min 30 s" */
export function restText(sec) {
  const s = Math.round(Number(sec) || 0);
  if (s < 60) return `${s} s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** Minutes → "52 min", "1 h 20 min" */
export function minText(min) {
  const m = Math.round(Number(min) || 0);
  if (m < 60) return `${m} min`;
  return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`;
}

const loc = () => (getLang() === 'it' ? 'it-IT' : 'en-GB');

/** "mar 27 ott" / "Tue 27 Oct" */
export function shortDate(ts) {
  return new Date(ts).toLocaleDateString(loc(), { weekday: 'short', day: 'numeric', month: 'short' }).replace(/,/g, '');
}

export function dayMonth(ts) {
  return new Date(ts).toLocaleDateString(loc(), { day: 'numeric', month: 'short' });
}

export function weekdayShort(ts) {
  return new Date(ts).toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '');
}

export function timeOfDay(ts) {
  return new Date(ts).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
}

export function monthName(ts) {
  const s = new Date(ts).toLocaleDateString(loc(), { month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dateTime(ts) {
  return new Date(ts).toLocaleString(loc(), { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
