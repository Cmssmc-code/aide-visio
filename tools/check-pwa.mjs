#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChrome } from './chrome-path.mjs';
import { startServer } from './serve.mjs';

process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const dirArg = argv.includes('--dir') ? argv[argv.indexOf('--dir') + 1] : path.join('dist', 'site');
const SRC_DIR = path.resolve(ROOT, dirArg);
const HEADED = argv.includes('--headed');

if (!fs.existsSync(path.join(SRC_DIR, 'index.html'))) {
  console.error(`${SRC_DIR}\\index.html introuvable — lancez d'abord « npm run build ».`);
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
};

// Chrome cherché avant la copie temporaire : un échec ici ne laisse rien sur le disque.
let chromePath;
try {
  chromePath = findChrome();
} catch (e) {
  console.error(`  ✗ Chrome introuvable — ${e.message}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aidevisio-pwa-'));
let server, url, browser;
try {
  fs.cpSync(SRC_DIR, tmp, { recursive: true });
  ({ server, url } = await startServer({ port: 0, dir: tmp, quiet: true }));
  browser = await chromium.launch({
    executablePath: chromePath,
    headless: !HEADED,
    args: ['--host-resolver-rules=MAP generativelanguage.googleapis.com 127.0.0.1:9, MAP api.anthropic.com 127.0.0.1:9, MAP cdn.jsdelivr.net 127.0.0.1:9'],
  });
} catch (e) {
  server?.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(`  ✗ Lancement impossible — ${e.message}`);
  process.exit(1);
}
const ORIGIN = url.replace(/\/$/, '');

const context = await browser.newContext({ serviceWorkers: 'allow' });
let apiHits = 0;
await context.route(/generativelanguage\.googleapis\.com|api\.anthropic\.com/, (route) => {
  apiHits++;
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"mock":true}' });
});
await context.route(/cdn\.jsdelivr\.net/, (route) => route.fulfill({
  status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: '/* mock */',
}));

const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

try {
  console.log(`Vérification PWA sur ${url} (copie de ${path.relative(ROOT, SRC_DIR) || SRC_DIR})`);
  await page.goto(url, { waitUntil: 'load' });
  const meta = await page.evaluate(() => document.querySelector('meta[name="aidevisio-version"]')?.content || 'dev');

  const examState = await page.evaluate(async () => {
    const S = window.AideVisio || {};
    const tabs = [...document.querySelectorAll('#tabbar [data-tab]')].filter((a) => !a.hidden).map((a) => a.dataset.tab);
    let shortcuts = [];
    try { shortcuts = ((await (await fetch('manifest.webmanifest')).json()).shortcuts || []).map((s) => s.url); } catch (e) {  }
    return {
      modules: ['examFiches', 'examSubjects', 'examAI', 'exam', 'examStore'].filter((k) => !S[k]),
      subjects: Array.isArray(S.examSubjects) ? S.examSubjects.length : 0,
      tabs, shortcuts
    };
  });
  check('modules de l’oral chargés', !examState.modules.length, examState.modules.length ? 'manquants : ' + examState.modules.join(', ') : `${examState.subjects} sujets`);
  check('onglets Accueil / Historique / Fiches / Réglages', examState.tabs.join() === 'home,historique,fiches,settings', examState.tabs.join(', '));
  check('raccourcis du manifeste : oral blanc et fiches', examState.shortcuts.some((u) => /#\/oral\/new$/.test(u)) && examState.shortcuts.some((u) => /#\/fiches$/.test(u)), examState.shortcuts.join(', '));

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { error: 'no serviceWorker' };
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => { navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }); setTimeout(r, 5000); });
    }
    return { scope: reg.scope, active: !!reg.active, controlled: !!navigator.serviceWorker.controller };
  });
  check('service worker installé et actif', swState.active, swState.scope || swState.error);
  check('page contrôlée par le service worker (clients.claim)', swState.controlled);

  const cache = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shellKey = keys.find((k) => k.startsWith('aidevisio-shell-'));
    const entries = shellKey ? (await (await caches.open(shellKey)).keys()).map((r) => new URL(r.url).pathname) : [];
    return { keys, shellKey, entries };
  });
  check('cache versionné = version du build', cache.shellKey === 'aidevisio-shell-' + meta, cache.shellKey);
  for (const f of ['/index.html', '/aidevisio.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png']) {
    if (meta === 'dev' && f === '/aidevisio.html') continue;
    check(`pré-cache contient ${f}`, cache.entries.includes(f));
  }

  const version = await page.evaluate(() => new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => resolve(e.data);
    navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
    setTimeout(() => resolve(null), 3000);
  }));
  check('message GET_VERSION', !!version && version.ready && version.version === meta, version && `v${version.version}, ${version.entries} entrées`);

  const net = await page.evaluate(async () => {
    const out = {};
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': 'TEST' } });
      out.gemini = r.status;
    } catch (e) { out.gemini = 'err ' + e.message; }
    try {
      const r = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': 'TEST', 'anthropic-version': '2023-06-01' } });
      out.claude = r.status;
    } catch (e) { out.claude = 'err ' + e.message; }
    try { out.pdfjs = (await fetch('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs')).status; } catch (e) { out.pdfjs = 'err'; }
    try { out.other = (await fetch('https://cdn.jsdelivr.net/npm/left-pad@1.3.0/index.js')).status; } catch (e) { out.other = 'err'; }
    await new Promise((r) => setTimeout(r, 400));
    const all = [];
    for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) all.push(k + ' ' + req.url);
    out.all = all;
    return out;
  });
  check('requêtes IA simulées (mock, rien ne sort)', apiHits >= 2, `Gemini ${net.gemini}, Claude ${net.claude}`);
  check('API IA jamais en cache', !net.all.some((u) => /googleapis|anthropic/.test(u)));
  check('pdf.js (jsDelivr versionné) mis en cache', net.all.some((u) => u.startsWith('aidevisio-pdfjs ') && /pdfjs-dist@/.test(u)));
  check('autres fichiers jsDelivr non mis en cache', !net.all.some((u) => /left-pad/.test(u)));

  await context.setOffline(true);
  const resp = await page.reload({ waitUntil: 'load' });
  const offline = await page.evaluate(() => ({ title: document.title, text: (document.body?.innerText || '').trim().length, html: document.documentElement.outerHTML.length }));
  check('rechargement hors-ligne : page affichée', !!resp && resp.ok() && offline.html > 500 && /aide ?visio/i.test(offline.title), `titre « ${offline.title} », ${offline.html} octets`);
  check('rechargement hors-ligne servi par le service worker', !!resp && resp.fromServiceWorker());
  if (meta !== 'dev') {
    const r2 = await page.goto(url + 'aidevisio.html', { waitUntil: 'load' });
    check('hors-ligne : aidevisio.html', !!r2 && r2.ok() && /aide ?visio/i.test(await page.title()));
  }
  const r3 = await page.goto(url + 'page/inexistante', { waitUntil: 'load' }).catch(() => null);
  check('hors-ligne : chemin inconnu → coquille', !!r3 && r3.ok() && /aide ?visio/i.test(await page.title()));
  const r4 = await page.goto(url + '?source=pwa#/diag', { waitUntil: 'load' }).catch(() => null);
  check('hors-ligne : start_url avec paramètres', !!r4 && r4.ok());
  await context.setOffline(false);
  await page.goto(url, { waitUntil: 'load' });

  const swFile = path.join(tmp, 'sw.js');
  const swText = fs.readFileSync(swFile, 'utf8');
  const nextVersion = 'test' + Date.now().toString(36);
  const replaced = swText.replace(/const VERSION = (?:"[^"]*"|\/\*@version\*\/'[^']*'\/\*@end\*\/);/, `const VERSION = "${nextVersion}";`);
  if (replaced === swText) check('mise à jour : VERSION trouvée dans sw.js', false);
  else {
    fs.writeFileSync(swFile, replaced);
    // Trouvée à l'ouverture, sur l'accueil : la page l'applique seule et se recharge.
    const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 20000 }).then(() => true, () => false);
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update())).catch(() => {});
    const reloaded = await nav;
    check('mise à jour à l’ouverture : appliquée seule, page rechargée', reloaded);
    const upd = await page.evaluate(async (expected) => {
      let keys = [];
      for (let i = 0; i < 50; i++) {
        keys = await caches.keys();
        if (keys.filter((k) => k.startsWith('aidevisio-shell-')).length === 1) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const reg = await navigator.serviceWorker.getRegistration();
      return { keys, hasNew: keys.includes('aidevisio-shell-' + expected), waiting: !!(reg && reg.waiting) };
    }, nextVersion);
    check('mise à jour : plus rien en attente', !upd.waiting);
    check('mise à jour : nouveau cache créé, ancien supprimé', !!upd.hasNew && upd.keys.filter((k) => k.startsWith('aidevisio-shell-')).length === 1, (upd.keys || []).join(', '));
  }
  if (pageErrors.length) console.log('  (erreurs JS de la page : ' + pageErrors.slice(0, 3).join(' | ') + ')');
} catch (err) {
  check('exécution du scénario', false, err.message);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n✗ ${failed.length} échec(s) sur ${results.length} vérifications` : `\n✓ ${results.length} vérifications PWA réussies`);
process.exit(failed.length ? 1 : 0);
