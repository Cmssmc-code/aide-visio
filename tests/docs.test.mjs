import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync, constants as zc } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = join(ROOT, 'tests', 'fixtures');
let failures = 0;
const ok = (name) => console.log('  ✓ ' + name);
const ko = (name, info) => { failures++; console.log('  ✗ ' + name + (info ? '\n      ' + String(info).split('\n').join('\n      ') : '')); };

async function nodePhase() {
  console.log('\n[Node] S.docs internes');
  if (!existsSync(join(FIX, 'fixtures.js'))) await import(pathToFileURL(join(FIX, 'make-fixtures.mjs')).href);
  globalThis.window = globalThis;
  vm.runInThisContext(readFileSync(join(ROOT, 'src', 'js', 'docs.js'), 'utf8'), { filename: 'docs.js' });
  const D = globalThis.AideVisio.docs;
  const I = D._internal;
  const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

  const samples = {
    vide: Buffer.alloc(0),
    court: Buffer.from('Bonjour'),
    texte: Buffer.from('Contrôle de gestion, clôture, reporting. '.repeat(5000)),
    aleatoire: randomBytes(200000),
    mixte: Buffer.concat([randomBytes(5000), Buffer.from('abc'.repeat(30000)), randomBytes(70000)])
  };
  let inflateOk = true;
  for (const [name, buf] of Object.entries(samples)) {
    for (const level of [0, 1, 9]) {
      const comp = deflateRawSync(buf, { level, strategy: level === 1 ? zc.Z_FIXED : zc.Z_DEFAULT_STRATEGY });
      try {
        const js = I.inflateRawJS(new Uint8Array(comp));
        if (!same(js, buf)) throw new Error('contenu différent');
        const nat = await I.inflateRaw(new Uint8Array(comp), buf.length);
        if (!same(nat, buf)) throw new Error('contenu différent (natif)');
      } catch (e) { inflateOk = false; ko(`inflate ${name} niveau ${level}`, e.message); }
    }
  }
  if (inflateOk) ok('inflate JS et natif = zlib (vide, court, texte, aléatoire, mixte ; niveaux 0/1/9)');

  const file = (n) => new File([readFileSync(join(FIX, n))], n);
  const cases = [
    ['sample.docx', 'docx', ['Contrat | CDI', '- Encadrer une équipe de 4 personnes', 'En-tête : Groupe Exemple']],
    ['sample-truncated.docx', 'docx', ['Responsable administratif et financier H/F']],
    ['sample.odt', 'odt', ['Langues | Anglais courant', 'Notes :\nNote de bas de page']],
    ['sample.rtf', 'rtf', ['Réponse : je suis contrôleur de gestion', 'Atout | Rigueur']],
    ['sample.html', 'html', ['Contrôleur de gestion H/F']],
    ['sample-cp1252.txt', 'text', ['cœur de métier’s']],
    ['sample.doc', 'text', ['contrôleur de gestion']]
  ];
  for (const [n, method, needles] of cases) {
    try {
      const r = await D.extract(file(n));
      if (r.method !== method) throw new Error('method ' + r.method);
      for (const s of needles) if (r.text.indexOf(s) < 0) throw new Error('absent : ' + JSON.stringify(s) + '\n' + r.text);
      ok(`${n} → ${method}`);
    } catch (e) { ko(n, e.stack || e); }
  }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!p.startsWith(ROOT + sep) || !existsSync(p) || !statSync(p).isFile()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(p));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function chromePath() {
  const cands = [process.env.CHROME_PATH,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe')];
  return cands.find((p) => p && existsSync(p));
}

async function runPage(browser, url, label) {
  console.log(`\n[Chromium ${label}] ${url}`);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__docsResults && window.__docsResults.done, null, { timeout: 180000 });
  const res = await page.evaluate(() => window.__docsResults);
  for (const r of res.results) {
    if (r.status === 'ok') ok(`${r.name} (${r.ms} ms)`);
    else if (r.status === 'skip') console.log('  ○ ' + r.name + ' — ignoré : ' + r.info);
    else ko(r.name, r.info);
  }
  if (errors.length) ko('erreurs JS de la page', errors.join('\n'));
  console.log(`  → ${res.passed} ok, ${res.failed} échec(s), ${res.skipped} ignoré(s) ; pdf.js : ${res.pdfjs || 'non chargé'}`);
  await page.close();
}

async function browserPhase() {
  let chromium;
  try { ({ chromium } = await import('playwright-core')); }
  catch (e) { ko('playwright-core introuvable (npm i -D playwright-core)'); return; }
  const executablePath = chromePath();
  if (!executablePath) { ko('Chromium introuvable : définissez CHROME_PATH'); return; }
  const browser = await chromium.launch({ executablePath, headless: true });
  const server = await serve();
  try {
    await runPage(browser, `http://127.0.0.1:${server.address().port}/tests/unit-docs.html`, 'http');
    await chromePdfCheck(browser, `http://127.0.0.1:${server.address().port}/tests/unit-docs.html`);
    await runPage(browser, pathToFileURL(join(ROOT, 'tests', 'unit-docs.html')).href, 'file');
  } finally {
    server.close();
    await browser.close();
  }
}

async function chromePdfCheck(browser, url) {
  console.log('\n[Chromium http] PDF généré par Chrome');
  const maker = await browser.newPage();
  await maker.setContent(`<html lang="fr"><body style="font-family:Georgia,serif;font-size:12px;margin:40px">
    <h1 style="font-family:Arial">Camille Exemple — Responsable administratif et financier</h1>
    <div style="display:flex;gap:40px"><div style="width:35%"><h2>Compétences</h2><ul><li>Clôture mensuelle</li><li>Trésorerie &amp; financement</li><li>Excel, SAP, Power BI</li></ul></div>
    <div style="width:65%"><h2>Expérience professionnelle</h2><p><b>2019 – 2023</b> · Contrôleur de gestion, Groupe Officiel<br>Pilotage budgétaire, efficacité financière, reporting.</p></div></div>
    </body></html>`);
  const pdf = await maker.pdf({ format: 'A4' });
  await maker.close();
  const page = await browser.newPage();
  await page.goto(url.replace('unit-docs.html', 'unit-docs.html?noauto'));
  await page.waitForFunction(() => window.AideVisio && window.AideVisio.docs);
  const r = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    try { return await window.AideVisio.docs.extract(new File([bytes], 'cv-chrome.pdf', { type: 'application/pdf' })); }
    catch (e) { return { error: e.code + ' ' + e.message }; }
  }, Buffer.from(pdf).toString('base64'));
  await page.close();
  if (r.error) { ko('PDF Chrome', r.error); return; }
  const needles = ['Responsable administratif et financier', 'Clôture mensuelle', 'Trésorerie & financement', 'Expérience professionnelle',
    'Contrôleur de gestion', 'efficacité financière'];
  const missing = needles.filter((n) => r.text.indexOf(n) < 0);
  if (r.method !== 'pdfjs' || missing.length) ko('PDF Chrome', 'method=' + r.method + ' manquants=' + JSON.stringify(missing) + '\n' + r.text);
  else ok('PDF Chrome : ' + JSON.stringify(r.text.slice(0, 160)) + '…');
}

await nodePhase();
if (!process.argv.includes('--no-browser')) await browserPhase();
console.log(failures ? `\n${failures} échec(s)` : '\nTous les tests S.docs passent.');
process.exit(failures ? 1 : 0);
