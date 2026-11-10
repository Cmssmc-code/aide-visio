import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = ['util.js', 'store.js'].map((f) => [f, readFileSync(join(root, 'src/js', f), 'utf8')]);

class FakeStorage {
  constructor(quota = 5e6) { this.m = new Map(); this.quota = quota; }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) {
    v = String(v);
    let size = 0;
    for (const [kk, vv] of this.m) if (kk !== k) size += kk.length + vv.length;
    if (size + k.length + v.length > this.quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
    this.m.set(k, v);
  }
  removeItem(k) { this.m.delete(k); }
}

function boot({ local, session, blockStorage } = {}) {
  const sb = { console, setTimeout, clearTimeout, crypto: globalThis.crypto, Blob, File, URL, addEventListener() {} };
  if (blockStorage) {
    Object.defineProperty(sb, 'localStorage', { get() { throw new Error('SecurityError'); } });
    Object.defineProperty(sb, 'sessionStorage', { get() { throw new Error('SecurityError'); } });
  } else {
    sb.localStorage = local || new FakeStorage();
    sb.sessionStorage = session || new FakeStorage();
  }
  sb.window = sb;
  vm.createContext(sb);
  for (const [f, src] of code) vm.runInContext(src, sb, { filename: f });
  return sb;
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, info) {
  if (cond) pass++;
  else { fail++; failures.push(name + (info !== undefined ? '  → ' + info : '')); }
}
{
  const local = new FakeStorage(), session = new FakeStorage();
  const sb = boot({ local, session });
  const S = sb.AideVisio;
  await S.store.init();
  check('backend localStorage sans IndexedDB', S.store.backend === 'localstorage', S.store.backend);

  const def = S.store.settings();
  check('réglages par défaut (SPEC)', JSON.stringify(def) === JSON.stringify({
    openaiKey: '', geminiKey: '', claudeKey: '', groqKey: '', rememberKeys: true, provider: 'auto',
    theme: 'auto', fontScale: 1
  }), JSON.stringify(def));
  def.theme = 'dark';
  check('settings() renvoie une copie', S.store.settings().theme === 'auto');

  let evt = null;
  S.bus.on('settings:changed', (s) => { evt = s; });
  S.store.setSettings({ theme: 'dark', models: { answer: 'gemini-3-flash' } });
  check('setSettings fusion', S.store.settings().theme === 'dark' && S.store.settings().provider === 'auto');
  check('ancien choix de modèles ignoré', !('models' in S.store.settings()));
  check('setSettings persisté', JSON.parse(local.getItem('aidevisio.settings')).theme === 'dark');
  check('événement settings:changed', evt && evt.theme === 'dark' && evt.changed.includes('theme') && !Object.keys(evt).includes('changed'));

  S.store.setSettings({ geminiKey: '  AIzaFAUSSE-CLE-DE-TEST  ' });
  check('clé rognée', S.store.settings().geminiKey === 'AIzaFAUSSE-CLE-DE-TEST');
  check('clé hors des réglages', !local.getItem('aidevisio.settings').includes('AIza'));
  check('clé mémorisée (localStorage)', local.getItem('aidevisio.keys').includes('AIzaFAUSSE') && !session.getItem('aidevisio.keys'));

  S.store.setSettings({ rememberKeys: false });
  check('rememberKeys=false → sessionStorage', !local.getItem('aidevisio.keys') && session.getItem('aidevisio.keys').includes('AIzaFAUSSE'));
  check('clé toujours utilisable', S.store.settings().geminiKey === 'AIzaFAUSSE-CLE-DE-TEST');

  const sb2 = boot({ local, session: new FakeStorage() });
  check('PC emprunté : clé oubliée à la fermeture', sb2.AideVisio.store.settings().geminiKey === '' && sb2.AideVisio.store.settings().theme === 'dark');

  S.store.setSettings({ rememberKeys: true });
  check('rememberKeys=true → retour en localStorage', local.getItem('aidevisio.keys').includes('AIzaFAUSSE') && !session.getItem('aidevisio.keys'));
  S.store.setSettings({ claudeKey: 'sk-ant-FAUSSE' });
  check('clé partielle', S.store.settings().claudeKey === 'sk-ant-FAUSSE' && S.store.settings().geminiKey === 'AIzaFAUSSE-CLE-DE-TEST');
  S.store.setSettings({ fontScale: 99, provider: 'mistral', theme: 'rose' });
  const s3 = S.store.settings();
  check('réglages assainis', s3.fontScale === 2.5 && s3.provider === 'auto' && s3.theme === 'auto', JSON.stringify(s3));
  S.store.setSettings(JSON.parse('{"__proto__":{"polluted":true}}'));
  check('pas de pollution de prototype (réglages)', ({}).polluted === undefined && vm.runInContext("Object.prototype.polluted", sb) === undefined);

  local.setItem('aidevisio.exam.test', '{}');
  const u = await S.store.usage();
  check('usage', u.bytes > 0 && u.persistent === false && u.backend === 'localstorage', JSON.stringify(u));

  await S.store.clearAll();
  check('clearAll', S.store.settings().geminiKey === '' && S.store.settings().theme === 'auto' &&
    [...local.m.keys(), ...session.m.keys()].every((k) => !k.startsWith('aidevisio')));
}

{
  const sb = boot({ blockStorage: true });
  const S = sb.AideVisio;
  let toast = null;
  S.bus.on('toast', (t) => { toast = t; });
  await S.store.init();
  check('stockage bloqué → mémoire', S.store.backend === 'memory');
  check('stockage bloqué → avertissement', toast && toast.kind === 'warn');
  S.store.setSettings({ geminiKey: 'k', theme: 'dark' });
  check('mémoire : réglages', S.store.settings().geminiKey === 'k' && S.store.settings().theme === 'dark');
}

console.log(`store.js : ${pass} réussis, ${fail} échoués`);
if (fail) { for (const f of failures) console.log('  ✗ ' + f); process.exit(1); }
