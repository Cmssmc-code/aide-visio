#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const SRC = path.resolve(ROOT, args.src || 'src');
const OUT = path.resolve(ROOT, args.out || path.join('dist', 'site'));
const BASE = normalizeBase(args.base || basePathFromPackage() || '/aidevisio/');
const STRICT = !!args.strict;

const EXPECTED_JS = ['js/util.js', 'js/store.js', 'js/vault.js', 'js/docs.js', 'js/ai.js', 'js/audio.js', 'js/app.js', 'js/devices.js', 'js/screens.js',
  'js/exam-fiches.js', 'js/exam-subjects.js', 'js/exam-subjects-2.js', 'js/exam-ai.js', 'js/exam.js'];
const EXPECTED_CSS = ['styles.css', 'screens.css', 'exam.css', 'design.css', 'live.css'];
const INLINE_MAX = 100 * 1024;
const PRECACHE_MAX = 1.5 * 1024 * 1024;
const PRECACHE_EXT = new Set(['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.woff2', '.woff', '.wasm']);
const TEXT_EXT = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg', '.txt', '.md', '.xml', '.ps1', '.cmd', '.bat', '.map', '.csv']);
const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.avif': 'image/avif', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const warnings = [];
const warn = (msg) => { warnings.push(msg); console.warn('  ⚠ ' + msg); };
const fail = (msg) => { console.error('\n✗ Build échoué : ' + msg + '\n'); process.exit(1); };
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

console.log(`Aide Visio build  ${rel(SRC)} → ${rel(OUT)}  (base ${BASE})`);

const indexPath = path.join(SRC, 'index.html');
if (!fs.existsSync(indexPath)) fail(`${rel(indexPath)} introuvable.`);
let html = readText(indexPath);
const inlined = new Set();
const referencedJs = [];
const referencedCss = [];

html = html.replace(/<link\b[^>]*>/gi, (tag) => {
  const relAttr = getAttr(tag, 'rel') || '';
  const href = getAttr(tag, 'href');
  if (!href || isExternal(href)) return tag;
  const local = cleanRef(href);
  const file = path.join(SRC, local);
  if (/\bstylesheet\b/i.test(relAttr)) {
    referencedCss.push(local);
    if (!fs.existsSync(file)) { warn(`CSS manquant : ${local} (ignoré)`); return `<!-- ${escComment(local)} manquant au build -->`; }
    inlined.add(local);
    let css = readText(file).replace(/<\/style/gi, '<\\/style');
    css = inlineCssUrls(css, path.dirname(file));
    const media = getAttr(tag, 'media');
    return `<style data-src="${escAttr(local)}"${media ? ` media="${escAttr(media)}"` : ''}>\n${css}\n</style>`;
  }
  if (/(^|\s)(shortcut\s+)?icon(\s|$)/i.test(relAttr) && !/apple-touch-icon/i.test(relAttr)) {
    const data = dataUri(file);
    return data ? setAttr(tag, 'href', data) : tag;
  }
  return tag;
});

html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (whole, attrs, body) => {
  const src = getAttr(attrs, 'src');
  if (!src) return whole;
  if (isExternal(src)) {
    if (!/^https:\/\/cdn\.jsdelivr\.net\//i.test(src)) warn(`script externe non autorisé par le SPEC : ${src}`);
    return whole;
  }
  const local = cleanRef(src);
  const file = path.join(SRC, local);
  referencedJs.push(local);
  if (!fs.existsSync(file)) { warn(`JS manquant : ${local} (ignoré)`); return `<!-- ${escComment(local)} manquant au build -->`; }
  if (/\b(defer|async)\b/i.test(attrs)) warn(`${local} : attribut defer/async perdu à l'inlining (placer les scripts en fin de <body>)`);
  if (/type\s*=\s*["']?module/i.test(attrs)) warn(`${local} : type="module" interdit par le SPEC (file://)`);
  inlined.add(local);
  let js = readText(file).replace(/<\/script/gi, '<\\/script');
  if (/<!--(?:(?!-->)[\s\S])*?<script[\s/>]/i.test(js)) {
    warn(`${local} : « <!-- … <script » neutralisé en « <!\\x2d- » pour l'inlining`);
    js = js.split('<!--').join('<!\\x2d-');
  }
  try { new vm.Script(js, { filename: local }); } catch (e) { warn(`${local} : erreur de syntaxe JS (${e.message})`); }
  const keep = attrs.replace(/\s(src|defer|async|type)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\s(defer|async)\b/gi, '').trim();
  return `<script data-src="${escAttr(local)}"${keep ? ' ' + keep : ''}>\n${js}\n</script>`;
});

html = html.replace(/<img\b[^>]*>/gi, (tag) => {
  const src = getAttr(tag, 'src');
  if (!src || isExternal(src) || src.startsWith('data:')) return tag;
  const data = dataUri(path.join(SRC, cleanRef(src)));
  return data ? setAttr(tag, 'src', data) : tag;
});

for (const f of EXPECTED_CSS) if (!referencedCss.includes(f)) warn(`index.html ne charge pas ${f}`);
for (const f of EXPECTED_JS) if (!referencedJs.includes(f)) warn(`index.html ne charge pas ${f}`);
const order = referencedJs.filter((f) => EXPECTED_JS.includes(f));
const expectedOrder = EXPECTED_JS.filter((f) => order.includes(f));
if (order.join() !== expectedOrder.join()) warn(`ordre des scripts inattendu : ${order.join(', ')}`);
for (const f of listFiles(path.join(SRC, 'js'))) {
  const r = 'js/' + path.relative(path.join(SRC, 'js'), f).split(path.sep).join('/');
  if (r.endsWith('.js') && !referencedJs.includes(r)) warn(`${r} existe mais n'est pas chargé par index.html`);
}
const leftovers = [...html.matchAll(/<script\b[^>]*\ssrc\s*=\s*["']?([^"'\s>]+)/gi)].map((m) => m[1]).filter((s) => !isExternal(s));
if (leftovers.length) warn(`références locales non inlinées : ${leftovers.join(', ')}`);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const copied = [];
for (const file of listFiles(SRC)) {
  const r = path.relative(SRC, file).split(path.sep).join('/');
  const name = path.basename(r);
  if (r === 'index.html' || r === 'sw.js' || inlined.has(r)) continue;
  if (name.startsWith('.') || /^(thumbs\.db|desktop\.ini)$/i.test(name)) continue;
  const dest = path.join(OUT, r);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  copied.push(r);
}
for (const tool of ['AideVisio.cmd', 'Installer-AideVisio.ps1']) {
  const file = path.join(ROOT, 'tools', tool);
  if (!fs.existsSync(file)) continue;
  fs.mkdirSync(path.join(OUT, 'pc'), { recursive: true });
  fs.copyFileSync(file, path.join(OUT, 'pc', tool));
  copied.push('pc/' + tool);
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const manifestPath = path.join(OUT, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) warn('manifest.webmanifest absent');
else {
  let manifest;
  try { manifest = JSON.parse(readText(manifestPath)); } catch (e) { fail(`manifest.webmanifest invalide : ${e.message}`); }
  const icons = [...(manifest.icons || []), ...(manifest.shortcuts || []).flatMap((s) => s.icons || [])];
  for (const ic of icons) if (!fs.existsSync(path.join(OUT, cleanRef(ic.src)))) warn(`icône du manifest absente : ${ic.src}`);
}

const swSrcPath = path.join(SRC, 'sw.js');
const swSrc = fs.existsSync(swSrcPath) ? readText(swSrcPath) : null;
const hash = crypto.createHash('sha256');
hash.update(html);
if (swSrc) hash.update(swSrc);
for (const r of [...copied].sort()) hash.update(r).update(fs.readFileSync(path.join(OUT, r)));
const VERSION = hash.digest('hex').slice(0, 10);
const BUILT_AT = new Date().toISOString();

const metas = `\n<meta name="aidevisio-single" content="1">\n<meta name="aidevisio-version" content="${VERSION}">\n<meta name="aidevisio-build" content="${BUILT_AT}">`;
html = insertInHead(html, metas);
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.writeFileSync(path.join(OUT, 'aidevisio.html'), html);

const redirect = `\n<script>(function(){try{var b=${JSON.stringify(BASE)},l=location,p=l.pathname,root=p.indexOf(b)===0?b:'/';` +
  `if(p!==root&&p!==root+'index.html'&&p!==root+'aidevisio.html'){l.replace(root+l.search+l.hash);}}catch(e){}})();</script>`;
fs.writeFileSync(path.join(OUT, '404.html'), insertInHead(html, redirect, true));

if (!swSrc) warn('src/sw.js absent : pas de mode hors-ligne');
else {
  const shell = ['./index.html', './aidevisio.html'];
  for (const r of copied) {
    const ext = path.extname(r).toLowerCase();
    if (r.startsWith('pc/') || r === '404.html' || !PRECACHE_EXT.has(ext)) continue;
    if (fs.statSync(path.join(OUT, r)).size > PRECACHE_MAX) continue;
    shell.push('./' + r);
  }
  const vRe = /\/\*@version\*\/[\s\S]*?\/\*@end\*\//;
  const sRe = /\/\*@shell\*\/[\s\S]*?\/\*@end\*\//;
  if (!vRe.test(swSrc) || !sRe.test(swSrc)) fail('marqueurs /*@version*/…/*@end*/ ou /*@shell*/…/*@end*/ absents de src/sw.js');
  const sw = swSrc
    .replace(vRe, () => JSON.stringify(VERSION))
    .replace(sRe, () => JSON.stringify(shell, null, 2));
  fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
  console.log(`  sw.js : version ${VERSION}, ${shell.length} fichiers pré-cachés`);
}

const leaks = [];
const deny = loadDenylist();
const scan = (dir, label) => {
  for (const file of listFiles(dir)) {
    const ext = path.extname(file).toLowerCase();
    const buf = fs.readFileSync(file);
    const text = TEXT_EXT.has(ext) ? buf.toString('utf8') : buf.toString('latin1');
    const where = `${label}/${path.relative(dir, file).split(path.sep).join('/')}`;
    for (const m of text.matchAll(/AIza[0-9A-Za-z_-]{30,}/g)) leaks.push(`${where} : clé Google ${mask(m[0])}`);
    for (const m of text.matchAll(/sk-ant-[0-9A-Za-z_-]*/g)) leaks.push(`${where} : « ${mask(m[0])} » (clé Anthropic ? écrire 'sk-'+'ant-' si c'est un motif légitime)`);
    if (deny.length && TEXT_EXT.has(ext)) {
      const low = text.toLowerCase();
      for (const d of deny) if (low.includes(d.toLowerCase())) leaks.push(`${where} : donnée personnelle de la liste d'exclusion « ${mask(d)} »`);
    }
  }
};
scan(OUT, rel(OUT));
scan(SRC, rel(SRC));
if (leaks.length) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fail(`secret ou donnée personnelle détecté(e), sortie supprimée :\n   - ${leaks.join('\n   - ')}`);
}

const outFiles = listFiles(OUT);
const total = outFiles.reduce((n, f) => n + fs.statSync(f).size, 0);
for (const f of ['index.html', 'aidevisio.html', '404.html', 'sw.js', 'manifest.webmanifest']) {
  const p = path.join(OUT, f);
  if (fs.existsSync(p)) console.log(`  ${f.padEnd(22)} ${(fs.statSync(p).size / 1024).toFixed(1).padStart(8)} Ko`);
}
console.log(`  ${outFiles.length} fichiers, ${(total / 1024).toFixed(0)} Ko au total — version ${VERSION}`);
if (warnings.length) {
  console.warn(`  ${warnings.length} avertissement(s).`);
  if (STRICT) fail('mode --strict : avertissements présents.');
}
console.log('✓ Build terminé');

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') o.strict = true;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      o[k] = v !== undefined ? v : argv[++i];
    }
  }
  return o;
}
function basePathFromPackage() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    return pkg.homepage ? new URL(pkg.homepage).pathname : null;
  } catch { return null; }
}
function normalizeBase(b) {
  let s = String(b).trim();
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.endsWith('/')) s += '/';
  return s;
}
function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
}
function listFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...listFiles(p)); }
    else if (e.isFile()) out.push(p);
  }
  return out;
}
function isExternal(ref) {
  return /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref.trim());
}
function cleanRef(ref) {
  return decodeURIComponent(ref.trim().split(/[?#]/)[0]).replace(/^\.\//, '').replace(/^\//, '');
}
function getAttr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : null;
}
function setAttr(tag, name, value) {
  return tag.replace(new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]+)`, 'i'), (_, pre) => `${pre}"${escAttr(value)}"`);
}
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escComment(s) {
  return String(s).replace(/--/g, '- -');
}
function dataUri(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const ext = path.extname(file).toLowerCase();
  const size = fs.statSync(file).size;
  if (!MIME[ext] || size > INLINE_MAX) return null;
  return `data:${MIME[ext]};base64,${fs.readFileSync(file).toString('base64')}`;
}
function inlineCssUrls(css, dir) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, q, ref) => {
    if (isExternal(ref) || ref.startsWith('data:') || ref.startsWith('#')) return whole;
    const data = dataUri(path.join(dir, cleanRef(ref)));
    if (data) return `url("${data}")`;
    if (path.resolve(dir) !== path.resolve(SRC)) warn(`CSS : url(${ref}) relative à un sous-dossier, chemin cassé après inlining`);
    return whole;
  });
}
function insertInHead(doc, snippet, first = false) {
  if (!first) {
    const charset = doc.match(/<meta\b[^>]*charset[^>]*>/i);
    if (charset) return doc.replace(charset[0], (m) => m + snippet);
  }
  const head = doc.match(/<head\b[^>]*>/i);
  if (head) return doc.replace(head[0], (m) => m + snippet);
  warn('<head> introuvable dans index.html');
  return snippet + doc;
}
function loadDenylist() {
  const file = process.env.AIDE_VISIO_DENYLIST || path.join(os.homedir(), '.aidevisio', 'denylist.txt');
  try {
    return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.length >= 4);
  } catch { return []; }
}
function mask(s) {
  return s.length <= 10 ? s.slice(0, 3) + '…' : s.slice(0, 7) + '…' + s.slice(-2);
}
