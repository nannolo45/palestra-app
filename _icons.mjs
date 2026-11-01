import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const svg = readFileSync('icons/icon.svg', 'utf8');
const b = await chromium.launch();
const p = await b.newPage();
for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
  await p.setViewportSize({ width: size, height: size });
  const s = name.startsWith('apple') ? svg.replace('rx="112"', 'rx="0"') : svg;
  await p.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await p.screenshot({ path: `icons/${name}`, omitBackground: true });
}
await b.close();
