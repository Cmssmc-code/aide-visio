import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { console, setTimeout, clearTimeout, crypto: globalThis.crypto, Blob, URL };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'src/js/util.js'), 'utf8'), sandbox, { filename: 'util.js' });
const S = sandbox.AideVisio;
const U = S.util;

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, info) {
  if (cond) pass++;
  else { fail++; failures.push(name + (info !== undefined ? '  → ' + info : '')); }
}

check('esc', U.esc(`<a href="x" onclick='y'>&</a>`) === '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
check('esc null', U.esc(null) === '' && U.esc(undefined) === '' && U.esc(0) === '0');

const xss = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '[clic](javascript:alert(1))',
  '[clic](https://ok.fr" onmouseover="alert(1))',
  '[<b>x</b>](https://ok.fr/?a=1&b="2")',
  'https://ok.fr/"><script>alert(1)</script>',
  '**<svg onload=alert(1)>**',
  '`<iframe src=javascript:alert(1)>`',
  '# <img src=x onerror=alert(1)>',
  '- <a href="javascript:alert(1)">x</a>',
  '> <style>body{display:none}</style>',
  '```\n<script>alert(1)</script>\n```',
  'texte \u0001' + '0\u0002 injection de marqueur',
  '[x](data:text/html;base64,PHNjcmlwdD4=)',
  '<<script>script>alert(1)<</script>/script>'
];
const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'hr', 'blockquote', 'a']);
const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'start', 'class']);
function unsafe(html) {
  for (const tag of html.match(/<[^>]*>/g) || []) {
    const m = /^<\/?([a-z0-9]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*>$/i.exec(tag);
    if (!m) return 'balise malformée ' + tag;
    if (!ALLOWED_TAGS.has(m[1].toLowerCase())) return 'balise interdite ' + m[1];
    for (const [, name, val] of m[2].matchAll(/([a-z-]+)="([^"]*)"/gi)) {
      if (!ALLOWED_ATTRS.has(name.toLowerCase())) return 'attribut interdit ' + name;
      if (name === 'href' && !/^https?:\/\//i.test(val)) return 'href interdit ' + val;
    }
  }
  if (/</.test(html.replace(/<\/?[a-z0-9]+(?:\s+[a-z-]+="[^"<>]*")*\s*>/gi, ''))) return '< brut';
  return '';
}
for (const s of xss) {
  const html = U.md(s);
  const why = unsafe(html);
  check('md XSS : ' + JSON.stringify(s), !why, why + ' | ' + html);
}
check('md lien autorisé', U.md('[Studio](https://aistudio.google.com/apikey)') ===
  '<p><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">Studio</a></p>');
check('md URL nue + ponctuation', U.md('Voir https://exemple.fr/a_b.').includes('href="https://exemple.fr/a_b"') && U.md('Voir https://exemple.fr/a_b.').endsWith('</a>.</p>'));
check('md attribut cassé', !/"\s+onmouseover/.test(U.md('[x](https://ok.fr" onmouseover="alert(1))')));

const answer = '**We would launch in three markets.**\n- **Budget** : 2 M€ sur 4 filiales\n- **Outils** : SAP, Excel *avancé*\n\n⚠️ chiffre à vérifier';
const html = U.md(answer);
check('md gras', html.startsWith('<p><strong>We would launch in three markets.</strong></p>'), html);
check('md liste', html.includes('<ul><li><strong>Budget</strong> : 2 M€ sur 4 filiales</li><li><strong>Outils</strong> : SAP, Excel <em>avancé</em></li></ul>'), html);
check('md avertissement', html.includes('<p class="warn">⚠️ chiffre à vérifier</p>'), html);
check('md titres', U.md('# A\n## B\n### C') === '<h1>A</h1><h2>B</h2><h3>C</h3>');
check('md liste numérotée', U.md('1. un\n2. deux\n\n3. trois') === '<ol><li>un</li><li>deux</li><li>trois</li></ol>', U.md('1. un\n2. deux\n\n3. trois'));
check('md ol start', U.md('3. trois\n4. quatre').startsWith('<ol start="3">'));
check('md sous-liste', U.md('- a\n  - a1\n- b') === '<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>', U.md('- a\n  - a1\n- b'));
check('md sauts de ligne', U.md('ligne 1\nligne 2\n\nligne 3') === '<p>ligne 1<br>ligne 2</p><p>ligne 3</p>');
check('md code', U.md('utiliser `a*b*c`') === '<p>utiliser <code>a*b*c</code></p>');
check('md snake_case intact', U.md('mon_fichier_test et 5 * 3 * 2') === '<p>mon_fichier_test et 5 * 3 * 2</p>', U.md('mon_fichier_test et 5 * 3 * 2'));
check('md vide', U.md('') === '' && U.md(null) === '');
check('md bloc code', U.md('```js\nlet a = "<b>";\n```') === '<pre><code>let a = &quot;&lt;b&gt;&quot;;</code></pre>');

check('norm', U.norm("  Qu'est-ce QUI vous MOTIVE, Hélène ? Œuvre…  ") === 'qu est ce qui vous motive helene oeuvre');
check('tokens', JSON.stringify(U.tokens("Pouvez-vous me parler de votre expérience chez Danone ?")) === '["parler","experience","danone"]', JSON.stringify(U.tokens("Pouvez-vous me parler de votre expérience chez Danone ?")));
check('tokens nombres', U.tokens('dans cinq ans').includes('5'));
check('similarity identique', U.similarity('Introduce yourself', 'introduce yourself !') === 1);
check('similarity vide', U.similarity('', 'abc') === 0 && U.similarity(null, undefined) === 0);
check('similarity symétrique', U.similarity('Vos qualités', 'Quelles sont vos principales qualités ?') === U.similarity('Quelles sont vos principales qualités ?', 'Vos qualités'));

check('fmtTime', U.fmtTime(0) === '00:00' && U.fmtTime(61500) === '01:01' && U.fmtTime(3725000) === '62:05' && U.fmtTime(-5) === '00:00' && U.fmtTime(NaN) === '00:00');
const ids = new Set(Array.from({ length: 2000 }, () => U.uid()));
check('uid uniques et courts', ids.size === 2000 && [...ids].every((x) => /^[a-z0-9]{8,16}$/.test(x)), [...ids][0]);
check('fmtBytes', U.fmtBytes(512) === '512 octets' && U.fmtBytes(1536) === '1,5 Ko');
check('slug', U.slug('Société Générale / RAF') === 'societe-generale-raf');

const em = U.emitter();
let got = [];
const off = em.on('x', (d) => got.push(d));
em.on('x', () => { throw new Error('écouteur défaillant (attendu)'); });
em.on('x', (d) => got.push('b' + d));
const origErr = console.error; console.error = () => {};
em.emit('x', 1); off(); em.emit('x', 2);
console.error = origErr;
check('emitter', JSON.stringify(got) === '[1,"b1","b2"]', JSON.stringify(got));
check('S.bus', typeof S.bus.on === 'function' && typeof S.bus.emit === 'function');
let toastGot = null;
S.bus.on('toast', (t) => { toastGot = t; });
U.toast('Bonjour', 'ok');
check('toast via bus', toastGot && toastGot.msg === 'Bonjour' && toastGot.kind === 'ok');

let calls = 0;
const deb = U.debounce((v) => { calls += v; }, 30);
deb(1); deb(2); deb(3);
await new Promise((r) => setTimeout(r, 80));
check('debounce', calls === 3, calls);
deb(5); deb.flush();
check('debounce.flush', calls === 8, calls);
const t0 = Date.now(); await U.sleep(40);
check('sleep', Date.now() - t0 >= 35);

console.log(`util.js : ${pass} réussis, ${fail} échoués`);
if (fail) { for (const f of failures) console.log('  ✗ ' + f); process.exit(1); }
