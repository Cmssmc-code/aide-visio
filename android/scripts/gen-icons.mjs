#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const SVG_PATH = path.join(ROOT, 'src', 'icons', 'icon.svg');

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const LEGACY_DP = 48;
const LEGACY_SCALE = 0.92;
const ADAPTIVE_DP = 108;
const SPLASH_DP = 160;

const FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <rect id="squircle" width="1024" height="1024" rx="230"/>
    <path id="bubble" d="M380 250H644A180 180 0 0 1 824 430V510A180 180 0 0 1 644 690H430C350 690 292 768 226 806C256 762 200 640 200 510V430A180 180 0 0 1 380 250Z"/>
    <clipPath id="shape"><use href="#squircle"/></clipPath>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6B4DFF"/><stop offset=".5" stop-color="#3F5BFF"/><stop offset="1" stop-color="#0A8DFF"/>
    </linearGradient>
    <radialGradient id="glow-tl" cx="230" cy="150" r="640" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".36"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="250" x2="0" y2="806" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".58"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/>
    </linearGradient>
  </defs>
  <g id="background" clip-path="url(#shape)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#glow-tl)"/>
  </g>
  <g id="glyph" transform="translate(0 -16)">
    <use href="#bubble" fill="url(#glass)"/>
    <g class="bars" stroke="#fff" stroke-linecap="round" stroke-width="50">
      <path d="M348 425V515M430 375V565M512 340V600M594 385V555M676 420V520"/>
    </g>
  </g>
</svg>`;

function findChrome() {
  const env = process.env.AIDE_VISIO_CHROME;
  if (env && fs.existsSync(env)) return env;
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const candidates = [];
  for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(local, 'ms-playwright'),
    path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean)) {
    let dirs = [];
    try { dirs = fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)); } catch { continue; }
    dirs.sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
    for (const d of dirs) {
      candidates.push(path.join(base, d, 'chrome-win64', 'chrome.exe'), path.join(base, d, 'chrome-win', 'chrome.exe'),
        path.join(base, d, 'chrome-linux64', 'chrome'), path.join(base, d, 'chrome-linux', 'chrome'));
    }
  }
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  candidates.push(
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    '/usr/bin/chromium', '/usr/bin/google-chrome');
  const hit = candidates.find((c) => fs.existsSync(c));
  if (!hit) throw new Error('Chromium introuvable (définir AIDE_VISIO_CHROME ou installer Chrome / Playwright).');
  return hit;
}

const svgSource = fs.existsSync(SVG_PATH) ? fs.readFileSync(SVG_PATH, 'utf8') : FALLBACK_SVG;
if (!fs.existsSync(SVG_PATH)) console.warn('[icons] src/icons/icon.svg absent : icône de secours intégrée utilisée.');

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });

async function render(variant, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent('<!doctype html><html><head><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>'
    + svgSource + '</body></html>');
  await page.evaluate(({ variant, size, legacyScale }) => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.querySelector('svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.classList.remove('small');
    const bg = svg.querySelector('#background');
    const glyph = svg.querySelector('#glyph');
    const edge = svg.querySelector('#edge');
    const clip = svg.querySelector('#shape');
    const fullBleed = () => {
      if (clip) { clip.innerHTML = ''; const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', '-1024'); r.setAttribute('y', '-1024'); r.setAttribute('width', '3072'); r.setAttribute('height', '3072'); clip.appendChild(r); }
      edge?.remove();
      bg?.querySelectorAll('rect').forEach((r) => { r.setAttribute('x', '-1024'); r.setAttribute('y', '-1024'); r.setAttribute('width', '3072'); r.setAttribute('height', '3072'); });
      const lg = svg.querySelector('#bg');
      if (lg && lg.getAttribute('gradientUnits') !== 'userSpaceOnUse') {
        const n = (a, d) => parseFloat(lg.getAttribute(a) ?? d) * 1024;
        lg.setAttribute('x1', n('x1', 0)); lg.setAttribute('y1', n('y1', 0));
        lg.setAttribute('x2', n('x2', 1)); lg.setAttribute('y2', n('y2', 0));
        lg.setAttribute('gradientUnits', 'userSpaceOnUse');
      }
    };
    const adaptiveViewBox = '-256 -256 1536 1536';

    if (variant === 'legacy' || variant === 'splash') {
      const s = variant === 'legacy' ? legacyScale : 1;
      const pad = (1024 / s - 1024) / 2;
      svg.setAttribute('viewBox', `${-pad} ${-pad} ${1024 + 2 * pad} ${1024 + 2 * pad}`);
    } else if (variant === 'round') {
      fullBleed();
      const pad = (1024 / legacyScale - 1024) / 2;
      svg.setAttribute('viewBox', `${-pad} ${-pad} ${1024 + 2 * pad} ${1024 + 2 * pad}`);
      svg.style.clipPath = `circle(${(legacyScale * 50).toFixed(3)}% at 50% 50%)`;
    } else if (variant === 'background') {
      fullBleed();
      glyph?.remove();
      svg.setAttribute('viewBox', adaptiveViewBox);
    } else if (variant === 'foreground') {
      bg?.remove();
      svg.setAttribute('viewBox', adaptiveViewBox);
    } else if (variant === 'monochrome') {
      const bubble = svg.querySelector('#bubble');
      const bars = svg.querySelector('.bars path');
      const bubbleD = bubble?.getAttribute('d')
        || 'M380 250H644A180 180 0 0 1 824 430V510A180 180 0 0 1 644 690H430C350 690 292 768 226 806C256 762 200 640 200 510V430A180 180 0 0 1 380 250Z';
      const barsD = bars?.getAttribute('d') || 'M348 425V515M430 375V565M512 340V600M594 385V555M676 420V520';
      const transform = glyph?.getAttribute('transform') || 'translate(0 -16)';
      svg.innerHTML = `<defs><mask id="mono" maskUnits="userSpaceOnUse" x="-256" y="-256" width="1536" height="1536">
          <path d="${bubbleD}" fill="#fff"/>
          <path d="${barsD}" stroke="#000" stroke-width="50" stroke-linecap="round"/></mask></defs>
        <g transform="${transform}"><rect x="-256" y="-256" width="1536" height="1536" fill="#fff" mask="url(#mono)"/></g>`;
      svg.setAttribute('viewBox', adaptiveViewBox);
    }
  }, { variant, size, legacyScale: LEGACY_SCALE });
  return page.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

async function probe(png, points) {
  return page.evaluate(async ({ b64, points }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return points.map(([x, y]) => Array.from(g.getImageData(Math.min(img.width - 1, Math.floor(x * img.width)), Math.min(img.height - 1, Math.floor(y * img.height)), 1, 1).data));
  }, { b64: png.toString('base64'), points });
}

function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG invalide');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

const jobs = [];
for (const [density, f] of Object.entries(DENSITIES)) {
  jobs.push({ dir: `mipmap-${density}`, file: 'ic_launcher.png', variant: 'legacy', size: Math.round(LEGACY_DP * f) });
  jobs.push({ dir: `mipmap-${density}`, file: 'ic_launcher_round.png', variant: 'round', size: Math.round(LEGACY_DP * f) });
  jobs.push({ dir: `mipmap-${density}`, file: 'ic_launcher_background.png', variant: 'background', size: Math.round(ADAPTIVE_DP * f) });
  jobs.push({ dir: `mipmap-${density}`, file: 'ic_launcher_foreground.png', variant: 'foreground', size: Math.round(ADAPTIVE_DP * f) });
  jobs.push({ dir: `mipmap-${density}`, file: 'ic_launcher_monochrome.png', variant: 'monochrome', size: Math.round(ADAPTIVE_DP * f) });
  jobs.push({ dir: `drawable-${density}`, file: 'splash.png', variant: 'splash', size: Math.round(SPLASH_DP * f) });
}

const problems = [];
try {
  for (const job of jobs) {
    const png = await render(job.variant, job.size);
    const [w, h] = pngSize(png);
    if (w !== job.size || h !== job.size) problems.push(`${job.dir}/${job.file}: ${w}x${h} au lieu de ${job.size}`);
    const [corner, center, bubble] = await probe(png, [[0.01, 0.01], [0.5, 0.5], [0.362, 0.5]]);
    const alpha = (p) => p[3];
    const expect = {
      legacy: () => alpha(corner) === 0 && alpha(center) > 200,
      splash: () => alpha(corner) === 0 && alpha(center) > 200,
      round: () => alpha(corner) === 0 && alpha(center) > 200,
      background: () => alpha(corner) === 255 && alpha(center) === 255,
      foreground: () => alpha(corner) === 0 && alpha(center) > 200,
      monochrome: () => alpha(corner) === 0 && alpha(bubble) > 200,
    }[job.variant];
    if (!expect()) problems.push(`${job.dir}/${job.file}: contrôle de pixels échoué (coin ${corner}, centre ${center}, bulle ${bubble})`);
    fs.mkdirSync(path.join(RES, job.dir), { recursive: true });
    fs.writeFileSync(path.join(RES, job.dir, job.file), png);
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.error('[icons] Problèmes :\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`[icons] ${jobs.length} images écrites dans ${path.relative(ROOT, RES)}`);
