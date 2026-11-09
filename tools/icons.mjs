#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome-path.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = path.join(ROOT, 'src', 'icons');
const SVG = fs.readFileSync(path.join(ICONS, 'icon.svg'), 'utf8');

const PNGS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512, fullBleed: true, scale: 0.84 },
  { file: 'apple-touch-icon.png', size: 180, fullBleed: true, scale: 0.96 },
  { file: 'favicon-32.png', size: 32, small: true },
];
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const SMALL_MAX = 32;

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const page = await browser.newPage({ viewport: { width: 256, height: 256 }, deviceScaleFactor: 1 });

async function render({ size, fullBleed = false, scale = 1, small = false, hideGlyph = false }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    '<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>' +
      SVG + '</body></html>'
  );
  await page.evaluate(({ size, fullBleed, scale, small, hideGlyph }) => {
    const svg = document.querySelector('svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    if (small) svg.classList.add('small');
    if (fullBleed) {
      const clip = svg.querySelector('#shape');
      clip.innerHTML = '';
      const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('width', '1024'); r.setAttribute('height', '1024');
      clip.appendChild(r);
      svg.querySelector('#edge')?.remove();
    }
    const glyph = svg.querySelector('#glyph');
    if (scale !== 1) {
      glyph.setAttribute('transform', `translate(512 512) scale(${scale}) translate(-512 -512) ` + (glyph.getAttribute('transform') || ''));
    }
    if (hideGlyph) glyph.style.display = 'none';
  }, { size, fullBleed, scale, small, hideGlyph });
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

async function probe(png, fn, arg) {
  return page.evaluate(async ({ b64, fnSrc, arg }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    // eslint-disable-next-line no-new-func
    return new Function('data', 'w', 'h', 'arg', fnSrc)(data, c.width, c.height, arg);
  }, { b64: png.toString('base64'), fnSrc: fn, arg });
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const problems = [];
const pngs = {};
for (const v of PNGS) {
  const buf = await render(v);
  fs.writeFileSync(path.join(ICONS, v.file), buf);
  pngs[v.file] = buf;
  console.log(`  ${v.file.padEnd(22)} ${v.size}px  ${(buf.length / 1024).toFixed(1)} Ko`);
}
const icoEntries = [];
for (const size of ICO_SIZES) icoEntries.push({ size, png: await render({ size, small: size <= SMALL_MAX }) });
const ico = buildIco(icoEntries);
fs.writeFileSync(path.join(ICONS, 'aidevisio.ico'), ico);
console.log(`  ${'aidevisio.ico'.padEnd(22)} ${ICO_SIZES.join('/')}  ${(ico.length / 1024).toFixed(1)} Ko`);

const alphaAt = `const out=[];for(const [x,y] of arg){const i=(y*w+x)*4;out.push(data[i+3]);}return out;`;
for (const [file, cornersTransparent] of [['icon-512.png', true], ['icon-192.png', true], ['favicon-32.png', true], ['maskable-512.png', false], ['apple-touch-icon.png', false]]) {
  const size = PNGS.find((p) => p.file === file).size;
  const m = size - 1, c = Math.floor(size / 2);
  const [a0, a1, a2, a3, ac] = await probe(pngs[file], alphaAt, [[0, 0], [m, 0], [0, m], [m, m], [c, c]]);
  const cornerOk = cornersTransparent ? [a0, a1, a2, a3].every((a) => a === 0) : [a0, a1, a2, a3].every((a) => a === 255);
  if (!cornerOk || ac !== 255) problems.push(`${file} : coins alpha=${[a0, a1, a2, a3]} centre=${ac}`);
}
{
  const bare = await render({ size: 512, fullBleed: true, scale: 0.84, hideGlyph: true });
  const diff = await page.evaluate(async ({ a, b }) => {
    const load = async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = await load(a), db = await load(b);
    let max = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      if (Math.hypot(x + 0.5 - 256, y + 0.5 - 256) <= 0.4 * 512) continue;
      const i = (y * 512 + x) * 4;
      max = Math.max(max, Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    }
    return max;
  }, { a: pngs['maskable-512.png'].toString('base64'), b: bare.toString('base64') });
  console.log(`  zone de sécurité maskable : écart max hors cercle 80 % = ${diff}/255`);
  if (diff > 12) problems.push(`maskable-512.png : le pictogramme déborde de la zone de sécurité (écart ${diff})`);
}
await browser.close();

if (problems.length) {
  console.error('Icônes : problèmes détectés\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('Icônes OK');
