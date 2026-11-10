#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from '../tools/serve.mjs';
import { ROOT, sleep, launchBrowser, newContext, watchErrors } from './e2e-lib.mjs';

const argv = process.argv.slice(2);
const HEADED = argv.includes('--headed');
const FILTER = argv.filter((a) => !a.startsWith('--')).join(' ').toLowerCase();
const SHOTS = path.join(ROOT, 'tests', 'shots-exam');
fs.mkdirSync(SHOTS, { recursive: true });
const T0 = Date.now();

const DESK = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const results = [];
const errors = [];
let current = '(démarrage)';
let activePage = null;
class Fail extends Error {}
const assert = (c, m) => { if (!c) throw new Fail(m); };
async function test(name, fn) {
  if (FILTER && !name.toLowerCase().includes(FILTER)) return;
  current = name;
  const t = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}  (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  } catch (e) {
    results.push({ name, ok: false, e });
    console.log(`  ✗ ${name}\n      ${String(e && e.message || e).split('\n').slice(0, 6).join('\n      ')}`);
    if (!(e instanceof Fail) && e && e.stack) console.log('      ' + e.stack.split('\n').slice(1, 3).join('\n      '));
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(SHOTS, `fail-${name.replace(/[^\w]+/g, '-').slice(0, 50)}.png`) }).catch(() => {});
  }
  current = '(entre deux tests)';
}
const sink = (msg) => errors.push({ test: current, msg });

function examFakes() {
  if (window.__examFakes) return;
  const M = window.__examFakes = { calls: [], audio: { started: 0, stopped: 0, handlers: {} }, delay: 120, aiReady: true };
  const wait = (ms, signal) => new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); const e = new Error('Annulé'); e.name = 'AbortError'; rej(e); }, { once: true });
  });
  const log = (fn, a, extra) => {
    const o = a || {};
    M.calls.push(Object.assign({ fn, kind: o.kind, at: Date.now() },
      'question' in o ? { question: o.question, shorter: !!o.shorter, force: !!o.force, previous: String(o.previous || ''), expose: String(o.expose || ''), turns: (o.turns || []).length, subject: o.subject && o.subject.id } : {}, extra));
  };
  // Fausse IA du direct : sous-titres bilingues (paires EN / FR) envoyés en flux, en 3 morceaux.
  const LIVE = [
    [/long run/i, [
      ['In the long run, I believe tariffs do more harm than good.', 'À long terme, je pense que les droits de douane font plus de mal que de bien.'],
      ['First, importers usually pass the extra cost on to consumers, so households lose purchasing power.', 'D’abord, les importateurs répercutent en général le surcoût sur les consommateurs : les ménages perdent du pouvoir d’achat.'],
      ['Second, firms with global supply chains face higher costs and greater uncertainty, which delays investment.', 'Ensuite, les entreprises aux chaînes d’approvisionnement mondiales subissent plus de coûts et d’incertitude, ce qui retarde l’investissement.'],
      ['For example, after the 2025 US tariffs, several carmakers postponed new factories.', 'Par exemple, après les droits de douane américains de 2025, plusieurs constructeurs ont reporté de nouvelles usines.'],
      ['However, some domestic producers may gain market share in the short term.', 'Cependant, certains producteurs nationaux peuvent gagner des parts de marché à court terme.'],
      ['So overall, I would say the costs outweigh the benefits.', 'Donc, globalement, je dirais que les coûts l’emportent sur les avantages.']
    ]],
    [/europe/i, [['European exporters would be hit too, so the EU could answer with its own tariffs on American goods.', 'Les exportateurs européens seraient touchés aussi : l’UE pourrait répondre par ses propres droits de douane sur les produits américains.']]],
    [/tariff/i, [
      ['I think the new tariffs will raise prices for consumers and disrupt the supply chain of many firms.', 'Je pense que les nouveaux droits de douane vont faire monter les prix et perturber la chaîne d’approvisionnement de nombreuses entreprises.'],
      ['Importers usually pass the extra cost on to shoppers.', 'Les importateurs répercutent généralement le surcoût sur les clients.'],
      ['For example, after the 2025 US tariffs, many retailers raised their prices.', 'Par exemple, après les droits de douane américains de 2025, beaucoup de distributeurs ont augmenté leurs prix.']
    ]],
    [/.*/, [['In my view, the article raises a key question for companies and for consumers.', 'À mon avis, l’article soulève une question clé pour les entreprises et les consommateurs.']]]
  ];
  const Q_FR = {
    'What do you think about the new tariffs?': 'Que pensez-vous des nouveaux droits de douane ?',
    'What will happen in the long run for European and American consumers, in your opinion?': 'Selon vous, que va-t-il se passer à long terme pour les consommateurs européens et américains ?'
  };
  M.qFr = Q_FR;
  const examAI = {
    ready: () => M.aiReady,
    isJuryQuestion: (t) => /\?\s*$/.test(String(t || '').trim()) || /^\s*(what|why|how|could|can|do|tell)\b/i.test(String(t || '')),
    async liveAnswer(a) {
      log('liveAnswer', a);
      try {
        if (!M.aiReady) { await wait(M.delay / 2, a.signal); throw Object.assign(new Error('Pas de clé IA.'), { code: 'NO_KEY' }); }
        if (M.liveError) { await wait(M.delay / 2, a.signal); throw Object.assign(new Error(M.liveError.msg), { code: M.liveError.code }); }
        if (/hear me/i.test(a.question)) { await wait(M.delay, a.signal); return { text: '', keyWords: [], skip: true }; }
        const kw = ['tariffs (droits de douane)', 'supply chain (chaîne d’approvisionnement)'];
        if (a.shorter) {
          // Ancien format (texte seul, sans paires) : l'appli le découpe en phrases.
          const full = 'Tariffs mean higher prices and a weaker supply chain.';
          const words = full.split(' ');
          for (const k of [1, 2, 3]) {
            await wait(M.delay, a.signal);
            if (a.onDelta) a.onDelta(words.slice(0, Math.ceil(words.length * k / 3)).join(' '));
          }
          return { text: full, keyWords: kw, skip: false };
        }
        const pairs = LIVE.find(([re]) => re.test(a.question))[1].map(([en, fr]) => ({ en, fr }));
        for (const k of [1, 2, 3]) {
          await wait(M.delay, a.signal);
          const n = Math.ceil(pairs.length * k / 3);
          const lines = pairs.slice(0, n).map((l, i) => (k < 3 && i === n - 1 ? { en: l.en, fr: '' } : l));
          if (a.onDelta) a.onDelta(lines.map((l) => l.en).join(' '), { lines, qFr: '' });
        }
        return { text: pairs.map((l) => l.en).join(' '), lines: pairs, qFr: '', keyWords: kw, skip: false };
      } catch (e) {
        if (e && e.name === 'AbortError') M.liveAborted = (M.liveAborted || 0) + 1;
        throw e;
      }
    },
    async juryAnswer(a) {
      log('juryAnswer', a); await wait(M.delay, a.signal);
      return { expect: 'Attendu : le but de l’auteur (alerter les lecteurs) et le public visé, avec un exemple du texte.', model: 'A good answer would say that the author wants to warn readers about the risks for banks, and quote one figure from the article.' };
    },
    async liveNotes(a) {
      log('liveNotes', a); await wait(M.delay, a.signal);
      return {
        covered: { intro: true, source: true, tone: true, summary: true, transition: false, problematic: false, plan: false, news: false, conclusion: false },
        errors: [{ said: 'the author explain', better: 'the author explains', rule: '-s à la 3e personne' }, { said: 'since two years', better: 'for two years', rule: 'for + durée' }],
        tips: ['Demandez-lui la date de l’article.', 'Elle n’a pas encore annoncé son plan.'], source: 'ai'
      };
    },
    async juryQuestion(a) {
      log('juryQuestion', a); await wait(M.delay, a.signal);
      const n = M.calls.filter((c) => c.fn === 'juryQuestion').length;
      return { en: `AI question ${n}: could you develop the idea of ${a.kind}?`, fr: `Question IA ${n} : développer (${a.kind}).`, why: 'Vérifier qu’elle sait approfondir.', expect: 'Un exemple concret et une nuance.', source: 'ai' };
    },
    async answerFeedback(a) {
      log('answerFeedback', a); await wait(M.delay, a.signal);
      if (M.keyBad) throw Object.assign(new Error('Clé Gemini refusée : recopiez-la en entier dans Réglages.'), { code: 'KEY' });
      return { score: 7, good: ['Réponse claire et structurée.'], fixes: [{ said: 'I am agree', better: 'I agree', rule: 'agree est un verbe' }], better: 'I agree with the author to some extent. Banks have a strong advantage: trust. However, stablecoins are cheaper and faster.' };
    },
    async evaluate(a) {
      log('evaluate', a); M.lastEvaluate = { interviewOnly: !!a.interviewOnly, kind: a.kind }; await wait(M.delay * 2, a.signal);
      return {
        total: 13.5,
        criteria: [
          { id: 'synthesis', label: 'Synthèse', score: 3, max: 4, comment: 'Idées principales présentes, logique de l’auteur à mieux faire ressortir.' },
          { id: 'structure', label: 'Problématique & structure', score: 2.5, max: 4, comment: 'Plan annoncé mais problématique trop proche de la question.' },
          { id: 'commentary', label: 'Commentaire argumenté & actualité', score: 2.5, max: 4, comment: 'Un exemple d’actualité, à étoffer.' },
          { id: 'interaction', label: 'Entretien & interaction', score: 2, max: 3, comment: 'Réponses pertinentes.' },
          { id: 'language', label: 'Langue (grammaire, vocabulaire)', score: 2, max: 3, comment: 'Quelques -s oubliés.' },
          { id: 'fluency', label: 'Aisance & durée', score: 1.5, max: 2, comment: 'Bon débit.' }
        ],
        strengths: ['Introduction complète (source, date, ton).', 'Bonne interaction avec le jury.'],
        priorities: ['Reformuler la question en vraie problématique.', 'Ajouter un fait d’actualité par axe.', 'Soigner les -s de la 3e personne.'],
        errors: [{ said: 'the author explain', better: 'the author explains', rule: '-s à la 3e personne' }],
        pronunciation: ['written — le w est muet', 'policy — accent sur la 1re syllabe'],
        modelPlan: '## Introduction\nThis article was published in…\n\n## I. Banks still have an edge\n- trust\n- regulation',
        message: 'Bravo Audrey, très bon oral blanc : 13,5/20. Continue !'
      };
    },
    async translate(t, o) { log('translate', null, { text: t, to: o && o.to }); return Q_FR[t] || 'FR: ' + t; },
    async generateSubject() { throw new Error('non utilisé'); },
    async subjectFromText() { return null; }
  };
  const handlers = M.audio.handlers;
  const audio = {
    get running() { return M.audio.started > M.audio.stopped; },
    on(ev, fn) { (handlers[ev] = handlers[ev] || new Set()).add(fn); return () => handlers[ev].delete(fn); },
    async start(preset, opts) {
      if (M.startError) { await wait(30); throw Object.assign(new Error(M.startError.msg), { code: M.startError.code }); }
      M.audio.started++; M.audio.preset = preset; M.audio.opts = opts; setTimeout(() => M.emit('state', { state: 'listening' }), 30); return {}; },
    async stop() { M.audio.stopped = M.audio.started; },
    message: () => '',
    status: () => ({ running: audio.running, channels: [] })
  };
  const RealWS = window.WebSocket;
  window.WebSocket = function (url, p) {
    if (/127\.0\.0\.1:47800/.test(String(url))) throw new Error('Son du PC absent (test)');
    return new RealWS(url, p);
  };
  window.WebSocket.prototype = RealWS.prototype;
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  M.emit = (ev, payload) => { (handlers[ev] || new Set()).forEach((f) => f(payload)); };
  const S = window.AideVisio = window.AideVisio || {};
  Object.defineProperty(S, 'examAI', { configurable: true, enumerable: true, get: () => examAI, set: (v) => { M.realExamAI = v; } });
  Object.defineProperty(S, 'audio', { configurable: true, enumerable: true, get: () => audio, set: (v) => { M.realAudio = v; } });
}

let nav = 0;
async function open(page, hash) {
  await page.goto(`${BASE}?n=${++nav}${hash || '#/'}`);
  await page.waitForFunction(() => window.AideVisio && AideVisio.examStore && document.querySelector('#view .route'), null, { timeout: 15000 });
  await settle(page);
}
async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function shot(page, name, { both = true, full = false } = {}) {
  const vp = page.viewportSize();
  const sizes = both ? [DESK, MOBILE] : [vp];
  for (const s of sizes) {
    if (s.width !== page.viewportSize().width) { await page.setViewportSize(s); await sleep(250); }
    await page.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove())).catch(() => {});
    await sleep(450);
    await page.screenshot({ path: path.join(SHOTS, `${name}-${s.width}.png`), fullPage: full });
  }
  if (page.viewportSize().width !== vp.width) { await page.setViewportSize(vp); await sleep(150); }
}
async function clickSheetAction(page, label) {
  const b = page.locator('.sheet-layer:not(.out) .sheet-actions button', { hasText: label }).last();
  await b.waitFor({ timeout: 5000 });
  await b.click();
  await page.waitForFunction(() => !document.querySelector('.sheet-layer:not(.out)'), null, { timeout: 5000 }).catch(() => {});
}
const session = (page) => page.evaluate(() => {
  const id = location.hash.split('/')[2];
  return JSON.parse(JSON.stringify(AideVisio.examStore.get(id)));
});
const horizontalOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const emit = (page, ev, payload) => page.evaluate(([e, p]) => window.__examFakes.emit(e, p), [ev, payload]);
const callsOf = (page, fn) => page.evaluate((f) => window.__examFakes.calls.filter((c) => c.fn === f), fn);

const ARTICLE = [
  'Trade wars are back on the agenda',
  'Washington has announced a new wave of tariffs on imported steel, cars and electronics, arguing that domestic factories need protection from unfair foreign competition and that jobs will come back home.',
  'Economists warn that consumers will end up paying more, because importers usually pass the extra cost on to shoppers, while companies with global supply chains face higher costs and greater uncertainty.',
  'Europe is preparing its answer: Brussels could target American goods with its own duties, a move that might escalate into a wider trade conflict between long-standing allies.',
  'Question: To what extent will the new tariffs hurt consumers?'
].join('\n\n');
async function importSubject(page) {
  await page.click('[data-act="import"]');
  await page.waitForSelector('.sheet-layer:not(.out) #ex-imp-text');
  await page.fill('#ex-imp-text', ARTICLE);
  await page.locator('.sheet-layer:not(.out) .sheet-actions button', { hasText: 'Analyser' }).click();
  await page.waitForSelector('.sheet-layer:not(.out) .ex-preview');
  await clickSheetAction(page, 'Enregistrer et utiliser');
  await page.waitForFunction(() => /^#\/appel\/ex-/.test(location.hash));
  await page.waitForSelector('.ex-call [data-b="live"]');
}
async function newCall(page) {
  await open(page, '#/appel');
  await page.waitForSelector('.ex-chooser .ex-call-intro');
  await importSubject(page);
  return page.evaluate(() => location.hash.split('/')[2]);
}
const waitOpen = (page) => page.waitForSelector('.ex-call [data-b="live"] :is(.lv-start, .ex-live-head)', { timeout: 10000 });
const liveText = (page, sel) => page.evaluate((s) => { const e = document.querySelector('[data-b="live"] ' + s); return e ? e.textContent.trim() : ''; }, sel);

const srv = await startServer({ port: 0, dir: 'src', quiet: true });
const BASE = `${srv.url}index.html`;
const browser = await launchBrowser({ headed: HEADED });

async function makePage(viewport) {
  const ctx = await newContext(browser, null, { viewport, mobile: viewport.width < 600 });
  await ctx.addInitScript(examFakes);
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  watchErrors(ctx, sink);
  const page = await ctx.newPage();
  activePage = page;
  return { ctx, page };
}

console.log('Aide Visio — oral blanc (e2e)\n');
const { ctx, page } = await makePage(DESK);
let juryId = '';
let subjectId = '';

await test('accueil : deux choix, onglet Historique, sans date d’examen', async () => {
  await open(page, '#/');
  await page.waitForSelector('.ex-home');
  const tabs = await page.$$eval('#tabbar [data-tab]', (as) => as.filter((a) => !a.hidden && getComputedStyle(a).display !== 'none').map((a) => a.dataset.tab));
  assert(JSON.stringify(tabs) === '["home","historique","fiches","settings"]', 'onglets visibles : ' + tabs);
  assert(await page.$eval('#tabbar [data-tab="home"]', (a) => a.classList.contains('on')), 'onglet Oral actif');
  assert((await page.locator('.ex-home .ex-role').count()) === 2, 'deux choix sur l’accueil');
  for (const go of ['#/eleve', '#/appel']) assert(await page.$(`.ex-home .ex-role[data-go="${go}"]`), 'choix ' + go);
  assert(!(await page.$('.ex-home .home-tools')), 'pas de raccourcis en doublon du rail');
  const rail = await page.$eval('#tabbar [data-tab="historique"]', (a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  assert(rail, 'onglet Historique visible sur PC');
  const home = await page.textContent('.ex-home');
  assert(!/J-\d|UE 218|novembre|jeudi/.test(home), 'aucune mention de l’examen : ' + home.slice(0, 120));
  assert(!(await page.$('.sheet-layer')), 'aucune fenêtre ouverte au démarrage');
  await shot(page, '01-accueil', { full: true });
  assert((await horizontalOverflow(page)) <= 0, 'pas de défilement horizontal');
});

await test('lien des clés : clés rangées, lien effacé de l’adresse', async () => {
  const { ctx: kc, page: kp } = await makePage(DESK);
  const d = Buffer.from(JSON.stringify({ geminiKey: 'AIza-test', groqKey: 'gsk_test', bad: 'x' })).toString('base64url');
  await kp.goto(`${BASE}#/cles?d=${d}`);
  await kp.waitForSelector('.st, .sc', { timeout: 10000 });
  assert(/#\/settings$/.test(kp.url()), 'adresse nettoyée : ' + kp.url());
  const keys = await kp.evaluate(() => JSON.parse(localStorage.getItem('aidevisio.keys') || '{}'));
  assert(keys.geminiKey === 'AIza-test' && keys.groqKey === 'gsk_test' && !('bad' in keys), 'clés : ' + JSON.stringify(keys));
  await kc.close();
});

await test('choix du sujet (jury) : filtre thème, aperçu, lancement', async () => {
  await open(page, '#/oral/new');
  await page.waitForSelector('.ex-chooser [data-subject]');
  const n = await page.locator('[data-subject]').count();
  assert(n >= 12, `12 sujets au moins (${n})`);
  await page.click('[data-theme="1"]');
  const n1 = await page.locator('[data-subject]').count();
  assert(n1 >= 1 && n1 < n, 'filtre thème 1');
  await page.click('[data-theme="0"]');
  await shot(page, '02-choix-sujet', { full: true });
  subjectId = await page.getAttribute('[data-subject="stablecoins-genius-act"]', 'data-subject') || await page.getAttribute('[data-subject]', 'data-subject');
  await page.click(`[data-subject="${subjectId}"]`);
  await page.waitForSelector('.sheet-layer .ex-paper');
  await shot(page, '03-apercu-sujet');
  await clickSheetAction(page, 'Faire passer ce sujet');
  await page.waitForFunction(() => /^#\/oral\/ex-/.test(location.hash));
  juryId = await page.evaluate(() => location.hash.split('/')[2]);
  await page.waitForSelector('.ex-console[data-phase="prep"]');
});

await test('console jury · préparation (chrono raccourci, partage du sujet)', async () => {
  await page.click('[data-dur="10"]');
  let s = await session(page);
  assert(s.prep.durMin === 10, 'durée 10 min');
  await page.click('[data-act="prep-start"]');
  await settle(page);
  await page.evaluate(() => { const id = location.hash.split('/')[2]; const s = AideVisio.examStore.get(id); s.prep.startedAt = Date.now() - (9 * 60 + 58) * 1000; AideVisio.examStore.save(s); });
  await page.evaluate(() => AideVisio.app.refresh());
  await page.waitForFunction(() => /00:0[0-2]|-?0:0/.test(document.querySelector('[data-b="clock"]').textContent), null, { timeout: 5000 });
  await page.waitForFunction(() => { const s = AideVisio.examStore.get(location.hash.split('/')[2]); return s && s.alarms && Object.keys(s.alarms).some((k) => /^p0/.test(k)); }, null, { timeout: 8000 });
  const st = await page.getAttribute('.ex-clock', 'data-state');
  assert(st === 'over', 'chrono en dépassement : ' + st);
  const [pop] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-act="share"]')]);
  await pop.waitForSelector('.ex-read .ex-paper', { timeout: 10000 });
  assert(!(await pop.$('.ex-corrige')), 'pas de corrigé dans la fenêtre partagée');
  assert((await pop.$$('.ex-par')).length >= 5, 'paragraphes du sujet');
  await pop.setViewportSize({ width: 980, height: 900 });
  await pop.screenshot({ path: path.join(SHOTS, '05-sujet-partage-980.png') });
  await pop.close();
  await page.evaluate(() => {
    window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };
    AideVisio.ui.copy = async (t) => { window.__copied = t; return true; };
  });
  assert(await page.isHidden('[data-b="teams-bar"]'), 'pas de bandeau Teams en double pendant la préparation (le champ suffit)');
  await page.fill('[data-f="teams"]', 'https://zoom.us/j/123');
  await page.locator('[data-f="teams"]').blur();
  await page.waitForFunction(() => document.querySelector('[data-b="teams"]').classList.contains('is-bad'));
  const TEAMS = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_TEST%40thread.v2/0?context=%7b%7d';
  await page.fill('[data-f="teams"]', 'Rejoindre la réunion : ' + TEAMS);
  await page.locator('[data-f="teams"]').blur();
  await page.waitForFunction(() => document.querySelector('[data-b="teams-bar"] [data-act="teams-join"]'));
  s = await session(page);
  assert(s.teamsLink === TEAMS, 'lien enregistré dans la séance : ' + s.teamsLink);
  assert(await page.evaluate(() => localStorage.getItem('aidevisio.exam.teams')) === TEAMS, 'dernier lien mémorisé');
  await page.click('[data-b="teams"] [data-act="teams-join"]');
  assert((await page.evaluate(() => window.__opened)).includes(TEAMS), 'Rejoindre ouvre le lien');
  await page.click('[data-b="teams-bar"] [data-act="teams-copy"]');
  const copied = await page.evaluate(() => window.__copied || '');
  assert(copied.includes(TEAMS) && /caméra/i.test(copied) && /feuilles blanches/.test(copied) && /partage le sujet/.test(copied), 'message pour Audrey : ' + copied.slice(0, 120));
  await shot(page, '04-jury-preparation', { full: true });
});

await test('console jury · exposé (écoute, transcription, notes IA, fautes)', async () => {
  await page.click('[data-act="to-expose"]');
  await page.waitForSelector('.ex-console[data-phase="expose"]');
  await page.click('[data-act="expose-start"]');
  await page.waitForFunction(() => window.__examFakes.audio.started === 1, null, { timeout: 5000 });
  const preset = await page.evaluate(() => window.__examFakes.audio.preset);
  assert(preset === 'haut-parleur', 'source par défaut micro/haut-parleur (sans programme Son du PC) : ' + preset);
  const lines = [
    'This article was published in the Financial Times in March 2026 and it deals with stablecoins.',
    'The tone of the author is rather critical and slightly worried about the banking sector.',
    'First the author explain that the GENIUS Act gives a legal framework to stablecoins since two years.',
    'Then he shows that banks could lose deposits if customers move their money to digital dollars.'
  ];
  for (const t of lines) {
    await page.evaluate((t) => window.__examFakes.emit('interim', { who: 'them', text: t.slice(0, 20) }), t);
    await page.evaluate((t) => window.__examFakes.emit('final', { who: 'them', text: t }), t);
  }
  await page.waitForFunction((n) => document.querySelectorAll('[data-b="tx"] p:not(.ex-interim)').length >= n, lines.length);
  await page.fill('[data-b="add"] input', 'To what extent should banks fear stablecoins?');
  await page.press('[data-b="add"] input', 'Enter');
  await page.waitForFunction((n) => document.querySelectorAll('[data-b="tx"] p:not(.ex-interim)').length >= n, lines.length + 1);
  await page.click('[data-act="analyze"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="errors"] li').length === 2, null, { timeout: 5000 });
  const on = await page.$$eval('[data-check].on', (b) => b.map((x) => x.dataset.check));
  assert(['intro', 'source', 'tone', 'summary'].every((k) => on.includes(k)), 'grille cochée par l’IA : ' + on);
  await page.click('[data-check="plan"]');
  assert(await page.$eval('[data-check="plan"]', (b) => b.classList.contains('on')), 'cochage manuel');
  await page.fill('[data-f="jury-notes"]', 'Bonne intro. Pense à « since » → « for ».');
  const tips = await page.textContent('[data-b="tips"]');
  assert(/date/.test(tips), 'conseils jury affichés');
  await shot(page, '06-jury-expose', { full: true });
});

await test('rechargement en pleine séance : reprise de l’exposé', async () => {
  await sleep(150);
  await page.reload();
  await page.waitForSelector('.ex-console[data-phase="expose"]', { timeout: 15000 });
  const n = await page.locator('[data-b="tx"] p:not(.ex-interim)').count();
  assert(n >= 5, 'transcription reprise : ' + n);
  const notes = await page.inputValue('[data-f="jury-notes"]');
  assert(/since/.test(notes), 'notes du jury reprises');
  const errs = await page.locator('[data-b="errors"] li').count();
  assert(errs === 2, 'fautes reprises : ' + errs);
  await page.click('.ex-cbar [data-go="#/"]');
  await page.waitForSelector('.ex-resume');
  await shot(page, '07-accueil-reprise');
  await page.click('.ex-resume [data-go]');
  await page.waitForSelector('.ex-console[data-phase="expose"]');
});

await test('console jury · entretien (questions corrigé + IA, lecture, échanges)', async () => {
  await page.click('[data-act="to-interview"]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  assert(/10 minutes/.test(await page.textContent('.sheet-layer:not(.out)')), 'alerte exposé trop court');
  await clickSheetAction(page, 'Passer à l’entretien');
  await page.waitForSelector('.ex-console[data-phase="interview"]');
  await page.waitForSelector('[data-b="q"] .ex-q-en');
  const q1 = await page.textContent('[data-b="q"] .ex-q-en');
  assert(q1.length > 10, 'première question (corrigé)');
  await page.click('[data-act="mark-asked"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="asked"] li:not(.muted)').length === 1);
  await sleep(1700);
  assert((await page.textContent('[data-b="q"] .ex-q-en')) === q1, 'question posée toujours affichée');
  assert(await page.$('[data-b="q"] [data-act="q-next"]'), 'bouton « Question suivante »');
  await page.click('[data-act="listen-start"]');
  await page.waitForFunction(() => window.__examFakes.audio.started >= 1 && document.querySelector('[data-act="listen-stop"]'));
  await page.evaluate(() => window.__examFakes.emit('final', { who: 'them', text: 'I think banks will adapt because they have the trust of customers.' }));
  await page.waitForFunction(() => document.querySelectorAll('[data-b="turns"] .ex-turn-student').length >= 1);
  await page.click('[data-kind="deeper"]');
  await page.waitForFunction(() => /AI question/.test(document.querySelector('[data-b="q"] .ex-q-en') ? document.querySelector('[data-b="q"] .ex-q-en').textContent : ''), null, { timeout: 5000 });
  assert(await page.$('[data-b="q"] .ex-q-more'), 'pourquoi / attendu pour le jury');
  await page.click('[data-act="read-q"]');
  await page.waitForFunction(() => (window.__spoken || []).some((t) => /AI question/.test(t)), null, { timeout: 5000 });
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="asked"] li:not(.muted)').length === 2);
  const asked2 = await page.evaluate(() => AideVisio.examStore.get(location.hash.split('/')[2]).interview.asked[1]);
  assert(asked2.why && asked2.expect, 'pourquoi / attendu gardés dans les questions posées');
  const cur = await page.textContent('[data-b="q"] .ex-q-en');
  await page.keyboard.press('Space');
  await page.waitForFunction((c) => { const e = document.querySelector('[data-b="q"] .ex-q-en'); return e && e.textContent !== c; }, cur, { timeout: 5000 });
  await page.click('[data-kind="opinion"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /non posée/.test(t.textContent)), null, { timeout: 5000 });
  await shot(page, '08-jury-entretien', { full: true });
});

await test('console jury · bilan (évaluation IA, ajustement, terminer)', async () => {
  await page.click('[data-act="to-review"]');
  await clickSheetAction(page, 'Terminer');
  await page.waitForSelector('[data-act="evaluate"]');
  await page.waitForFunction(() => window.__examFakes.audio.stopped >= 1);
  await shot(page, '09-jury-bilan-avant');
  await page.click('.ex-review-pre [data-act="evaluate"]');
  await page.waitForSelector('.ex-score .ex-ring');
  const call = await page.evaluate(() => window.__examFakes.calls.filter((c) => c.fn === 'evaluate').length);
  assert(call === 1, 'evaluate appelé une fois');
  let total = await page.textContent('.ex-score .ex-ring b');
  assert(total.trim() === '13,5', 'note 13,5 : ' + total);
  await shot(page, '10-jury-bilan', { full: true });
  assert((await page.textContent('[data-b="verdict"]')).trim() === 'Assez bien', 'mention française pour 13,5');
  await page.click('.ex-actions-row [data-act="evaluate"]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  await clickSheetAction(page, 'Annuler');
  assert((await page.evaluate(() => window.__examFakes.calls.filter((c) => c.fn === 'evaluate').length)) === 1, 'pas de réévaluation sans confirmation');
  const inp = page.locator('[data-crit="language"] input');
  await inp.fill('3');
  await page.waitForFunction(() => document.querySelector('.ex-score .ex-ring b').textContent.trim() === '14,5');
  await inp.fill('9');
  await page.waitForFunction(() => document.querySelector('.ex-score .ex-ring b').textContent.trim() === '14,5');
  await page.click('[data-act="finish"]');
  await page.waitForFunction(() => location.hash === '#/historique');
  const s = await page.evaluate((id) => AideVisio.examStore.get(id), juryId);
  assert(s.phase === 'done' && Math.abs(s.evaluation.total - 14.5) < 0.01, 'séance terminée et note ajustée enregistrée : ' + (s.evaluation && s.evaluation.total));
});

await test('historique', async () => {
  await page.waitForSelector('.ex-history .ex-hrow');
  assert(await page.$eval('#tabbar [data-tab="historique"]', (a) => a.classList.contains('on')), 'onglet Historique actif');
  assert(!(await page.$('.ex-trend')), 'pas de statistiques avec une seule note');
  const note = await page.textContent('.ex-hrow .ex-hnote');
  assert(/14,5/.test(note), 'note dans l’historique : ' + note);
  await shot(page, '11-historique');
  await page.click(`[data-open="${juryId}"]`);
  await page.waitForSelector('.ex-console .ex-score');
  await page.goBack();
});

await test('vue #/sujet plein écran', async () => {
  await open(page, `#/sujet/${subjectId}`);
  await page.waitForSelector('.ex-read .ex-paper');
  await page.click('[data-z="1"]');
  await shot(page, '12-sujet');
  await open(page, '#/sujet/inexistant');
  await page.waitForSelector('.empty');
});

await test('fiches : chaque onglet, recherche, lecture audio', async () => {
  for (const tab of ['methode', 'phrases', 'themes', 'actu', 'erreurs', 'prononciation', 'jourj']) {
    await open(page, `#/fiches/${tab}`);
    await page.waitForSelector('.ex-fiches .ex-fbody > *');
    assert(await page.$eval('#tabbar [data-tab="fiches"]', (a) => a.classList.contains('on')), 'onglet Fiches actif');
    const empty = await page.$('.ex-fbody .empty');
    assert(!empty, `onglet ${tab} non vide`);
    if (tab === 'themes') await page.click('.ex-theme-card summary');
    const say = page.locator('.ex-fbody [data-say]:visible').first();
    if (await say.count()) {
      const before = await page.evaluate(() => (window.__spoken || []).length);
      await say.click();
      await page.waitForFunction((b) => (window.__spoken || []).length > b, before, { timeout: 5000 });
    }
    if (tab === 'jourj') {
      await page.locator('[data-day]').first().check({ force: true });
      const saved = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('aidevisio.exam.daycheck.v1') || '{}')).length);
      assert(saved === 1, 'case du jour J mémorisée');
    }
    await shot(page, `13-fiches-${tab}`);
  }
  await open(page, '#/fiches/erreurs');
  await page.fill('[data-f="q"]', 'zzzzqqq');
  assert(await page.isVisible('[data-b="nores"]'), 'message aucun résultat');
  await page.fill('[data-f="q"]', 'journalist');
  await page.waitForSelector('[data-b="elsewhere"]:not([hidden])');
  assert(/Prononciation/.test(await page.textContent('[data-b="elsewhere"]')), 'résultat signalé dans l’onglet Prononciation');
  await page.fill('[data-f="q"]', '');
  await page.click('[data-rate="0.8"]');
  const rate = await page.evaluate(() => JSON.parse(localStorage.getItem('aidevisio.exam.prefs')).rate);
  assert(rate === 0.8, 'débit lent mémorisé');
  await page.click('[data-rate="1"]');
});

await test('réglages : clés, IA, affichage et données', async () => {
  await open(page, '#/settings');
  await page.waitForSelector('[data-key="geminiKey"]', { state: 'attached' });
  assert(await page.$('[data-act="diag"]'), 'accès au diagnostic');
  await shot(page, '14-reglages');
});

await ctx.close();

const M = await makePage(MOBILE);
const mp = M.page;

await test('élève · oral complet au hasard et préparation (brouillon, aide-mémoire)', async () => {
  await open(mp, '#/');
  await mp.waitForSelector('.ex-home');
  await shot(mp, '20-mobile-accueil', { both: false, full: true });
  assert((await horizontalOverflow(mp)) <= 0, 'pas de défilement horizontal (mobile)');
  await mp.click('[data-go="#/eleve"]');
  await mp.waitForSelector('.ex-chooser [data-act="full-random"]');
  await shot(mp, '21-mobile-eleve-choix', { both: false, full: true });
  await mp.click('[data-act="full-random"]');
  await mp.waitForFunction(() => /^#\/eleve\/ex-/.test(location.hash));
  await mp.waitForSelector('.ex-solo [data-act="prep-start"]');
  assert(!(await mp.$('.sheet-layer:not(.out)')), 'pas de fenêtre intermédiaire');
  assert(!(await mp.$('.ex-solo .ex-paper')), 'texte caché avant le chrono');
  const durs = await mp.$$eval('[data-dur]', (bs) => bs.map((x) => x.dataset.dur).join(','));
  assert(durs === '60,30', 'durées 60 et 30 min : ' + durs);
  assert(!(await mp.isChecked('[data-f="help"]')), 'aide-mémoire décoché par défaut');
  await mp.click('[data-dur="30"]');
  await mp.click('[data-act="prep-start"]');
  await mp.waitForSelector('.ex-solo .ex-paper');
  await mp.fill('[data-note="intro"]', 'This article, published in March 2026, deals with stablecoins.');
  await mp.fill('[data-note="summary"]', 'The author explains that banks are worried because customers could move their deposits to stablecoins very quickly');
  await mp.waitForSelector('[data-nf="summary"].is-long');
  await mp.fill('[data-note="summary"]', 'banks worried • deposits → stablecoins • GENIUS Act');
  await mp.waitForSelector('[data-nf="summary"]:not(.is-long)');
  assert(!(await mp.$('.ex-help')), 'aide-mémoire caché par défaut');
  await mp.locator('[data-f="help"]').check({ force: true });
  await mp.waitForSelector('.ex-help');
  await sleep(1400);
  const s = await session(mp);
  assert(/stablecoins/.test(s.prep.notes.intro) && s.prep.strict === false, 'brouillon enregistré');
  await shot(mp, '23-mobile-preparation', { both: false, full: true });
  await mp.setViewportSize(DESK); await sleep(250);
  await mp.screenshot({ path: path.join(SHOTS, '23-solo-preparation-1440.png'), fullPage: true });
  await mp.setViewportSize(MOBILE); await sleep(250);
});

await test('élève · exposé au micro (reconnaissance simulée)', async () => {
  await mp.click('[data-act="to-expose"]');
  await mp.waitForSelector('[data-act="expose-start"]');
  await mp.click('[data-act="expose-start"]');
  await mp.waitForFunction(() => window.__sr.active.size > 0, null, { timeout: 5000 });
  await mp.evaluate(() => window.__sr.say('This article was published in March 2026 and it deals with the rise of stablecoins in the United States', { stepMs: 5 }));
  await mp.evaluate(() => window.__sr.say('The author explain that banks could lose deposits', { stepMs: 5 }));
  assert(!(await mp.$('.ex-tx-edit')), 'transcription non montrée pendant l’exposé');
  await shot(mp, '24-mobile-expose', { both: false });
  await mp.click('[data-act="expose-end"]');
  await mp.waitForSelector('.ex-tx-edit');
  const tx = await mp.inputValue('.ex-tx-edit');
  assert(/stablecoins/.test(tx) && /lose deposits/.test(tx), 'transcription complète : ' + tx);
  await shot(mp, '25-mobile-expose-fin', { both: false, full: true });
});

await test('élève · jury IA (question lue, réponse au micro, correction)', async () => {
  await mp.click('[data-act="to-jury"]');
  await mp.waitForSelector('[data-act="qa-next"]');
  await mp.click('[data-act="qa-next"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  await mp.waitForFunction(() => (window.__spoken || []).length > 0);
  await mp.waitForFunction(() => window.__sr.active.size > 0, null, { timeout: 5000 });
  await mp.evaluate(() => window.__sr.say('I am agree with the author because banks have the trust of customers', { stepMs: 5 }));
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-fb .ex-ring');
  const ans = await mp.textContent('.ex-answer p');
  assert(/agree/.test(ans), 'réponse captée : ' + ans);
  assert(await mp.evaluate(() => document.activeElement && document.activeElement.classList.contains('ex-fb')), 'focus sur la correction');
  assert(!(await mp.$('[data-act="qa-repeat"]')), 'pas de « Répéter » après la réponse');
  assert(/Terminer et voir mon bilan/.test(await mp.textContent('.ex-qa [data-act="to-review"]')), 'bouton « Terminer et voir mon bilan » dès 1 réponse');
  assert(!(await mp.$('.ex-qa[aria-live]')) && await mp.$('[data-b="qa-sr"][aria-live]'), 'annonce courte, pas de zone aria-live sur tout le bloc');
  assert(await mp.$('.ex-step[data-step="prep"].done[aria-label]'), 'étape préparation cochée, avec aria-label');
  await shot(mp, '26-mobile-jury-ia', { both: false, full: true });
  await mp.click('[data-act="qa-next"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  await mp.waitForSelector('[data-act="qa-type"]');
  await mp.click('[data-act="qa-type"]');
  assert(await mp.evaluate(() => document.activeElement && document.activeElement.dataset.f === 'answer'), 'focus dans le champ après « Répondre par écrit »');
  assert(/Réponse écrite/.test(await mp.textContent('.ex-qa .ex-rec')), 'texte « Réponse écrite »');
  await mp.fill('[data-f="answer"]', 'Yes, because regulation makes them safer.');
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-fb');
  const s = await session(mp);
  assert(s.interview.asked.length === 2 && s.interview.asked.every((a) => a.score === 7), 'réponses notées');
  const fbCalls = await mp.evaluate(() => window.__examFakes.calls.filter((c) => c.fn === 'answerFeedback').length);
  assert(fbCalls === 2, 'feedback après chaque réponse');
});

await test('élève · rechargement en plein jury IA puis bilan', async () => {
  await mp.reload();
  await mp.waitForSelector('.ex-solo[data-phase="interview"]');
  assert((await mp.locator('.ex-asked li').count()) === 2, 'questions précédentes reprises');
  await mp.click('[data-step="review"]');
  await clickSheetAction(mp, 'Passer');
  await mp.waitForSelector('[data-act="evaluate"]');
  await mp.click('.ex-review-pre [data-act="evaluate"]');
  await mp.waitForSelector('.ex-score .ex-ring');
  assert(!(await mp.$('[data-act="copy-msg"]')) && /Mot du correcteur/.test(await mp.textContent('.ex-msg')), 'solo : « Mot du correcteur », sans « Copier »');
  await shot(mp, '27-mobile-bilan', { both: false, full: true });
  await mp.click('[data-act="finish"]');
  await mp.waitForFunction(() => location.hash === '#/historique');
  await mp.waitForSelector('.ex-hrow');
  await shot(mp, '28-mobile-historique', { both: false });
});

await test('élève · jury IA direct (sujet au hasard, sans fenêtre)', async () => {
  await open(mp, '#/eleve');
  await mp.waitForSelector('.ex-jury-ai [data-act="quick-jury"]');
  assert(!(await mp.$('.ex-scard.is-hidden-q')) && !(await mp.$('[data-f="hide-subjects"]')), 'titres toujours visibles');
  assert(await mp.$('.ex-scard .ex-scard-title[lang="en"]'), 'titre anglais sur les cartes');
  assert(await mp.$('.ex-scard .pill-ok'), 'badge « Fait le JJ/MM »');
  assert(!(await mp.$('.ex-teams-join')), 'écran IA épuré : pas de champ Teams');
  assert(!(await mp.isVisible('.ex-more [data-act="import"]')), 'Importer replié');
  await shot(mp, '32-mobile-eleve-accueil', { both: false, full: true });
  const spoken0 = await mp.evaluate(() => (window.__spoken || []).length);
  await mp.click('[data-act="quick-jury"]');
  await mp.waitForSelector('.ex-solo[data-phase="interview"] [data-act="qa-done"]');
  assert(!(await mp.$('.sheet-layer:not(.out)')), 'pas de fenêtre intermédiaire');
  await mp.waitForFunction((n) => (window.__spoken || []).length > n, spoken0);
  assert(!(await mp.$('.ex-solo .ex-steps')), 'pas de barre d’étapes en direct');
  assert(!(await mp.$('[data-target]')), 'pas de choix du nombre de questions');
  assert(/1\/6/.test(await mp.textContent('.ex-q-solo .pill')), 'question 1/6');
  assert(await mp.$('.ex-solo-subj[open] .ex-paper'), 'sujet affiché pendant le jury IA');
  const sub0 = (await session(mp)).subjectId;
  await mp.click('[data-act="change-subject"]');
  await mp.waitForFunction((id) => { const s = AideVisio.examStore.get(location.hash.split('/')[2]); return s && s.subjectId !== id && document.querySelector('[data-act="qa-done"]'); }, sub0);
  assert((await session(mp)).interview.turns.length === 1, 'nouvelle question 1 après changement de sujet');
  const mic = await mp.$('[data-act="qa-mic"]');
  if (mic) await mic.click();
  await mp.waitForFunction(() => window.__sr.active.size > 0, null, { timeout: 5000 });
  await mp.click('[data-act="qa-repeat"]');
  await mp.waitForFunction(() => window.__sr.active.size > 0, null, { timeout: 5000 });
  await mp.evaluate(() => window.__sr.say('In my opinion the article shows that banks must adapt quickly', { stepMs: 5 }));
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-fb .ex-ring');
  assert(/banks must adapt/.test(await mp.textContent('.ex-answer p')), 'réponse captée');
  assert(!(await mp.$('[data-act="change-subject"]')), 'plus de « Changer de sujet » après une réponse');
  await shot(mp, '33-mobile-jury-ia-direct', { both: false, full: true });
  // Réponse vide : pas comptée, message clair
  await mp.click('[data-act="qa-next"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  const mic2 = await mp.$('[data-act="qa-mic"]');
  if (mic2) await mic2.click();
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-empty-ans');
  assert(/Je n’ai rien entendu/.test(await mp.textContent('.ex-empty-ans')), 'message « rien entendu »');
  assert((await session(mp)).interview.asked.length === 1, 'réponse vide non comptée');
  assert(await mp.$('[data-act="qa-retry"]'), 'bouton « Réessayer »');
  await mp.click('[data-act="qa-type"]');
  await mp.fill('[data-f="answer"]', 'Banks should cooperate with fintechs.');
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-fb .ex-ring');
  await mp.click('.ex-qa [data-act="to-review"]');
  await mp.waitForSelector('.ex-review-pre [data-act="evaluate"]');
  const durs = await mp.textContent('.ex-review-pre .ex-durs');
  assert(!/Préparation|Exposé|—/.test(durs), 'durées à zéro cachées : ' + durs);
  await mp.click('.ex-review-pre [data-act="evaluate"]');
  await mp.waitForSelector('.ex-score .ex-ring');
  const ev = await mp.evaluate(() => window.__examFakes.lastEvaluate);
  assert(ev && ev.interviewOnly === true, 'évaluation « entretien seul »');
  assert(/Télécharger le bilan/.test(await mp.textContent('[data-act="export"]')), 'bouton « Télécharger le bilan »');
});

await test('élève · clé IA refusée : correction coupée, un seul message', async () => {
  await mp.evaluate(() => { window.__examFakes.keyBad = true; });
  await open(mp, '#/eleve');
  await mp.evaluate(() => { window.__examFakes.keyBad = true; });
  await mp.click('[data-act="quick-jury"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  if (await mp.$('[data-act="qa-type"]')) await mp.click('[data-act="qa-type"]');
  await mp.fill('[data-f="answer"]', 'I think banks will survive.');
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-keybad');
  assert(/Votre clé IA est refusée : la correction est coupée/.test(await mp.textContent('.ex-keybad')), 'message clé refusée');
  assert(await mp.$('.ex-keybad [data-go="#/settings"]'), 'bouton « Corriger la clé »');
  const n1 = (await callsOf(mp, 'answerFeedback')).length;
  await mp.click('[data-act="qa-next"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  if (await mp.$('[data-act="qa-type"]')) await mp.click('[data-act="qa-type"]');
  await mp.fill('[data-f="answer"]', 'Regulation matters.');
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-keybad');
  assert((await callsOf(mp, 'answerFeedback')).length === n1, 'plus d’appel à l’IA après le refus');
  const toasts = await mp.$$eval('.toast', (ts) => ts.filter((t) => /Correction impossible/.test(t.textContent)).length);
  assert(toasts === 0, 'pas de toast « Correction impossible »');
  await mp.evaluate(() => { window.__examFakes.keyBad = false; const p = JSON.parse(localStorage.getItem('aidevisio.exam.prefs') || '{}'); delete p.keyRefused; localStorage.setItem('aidevisio.exam.prefs', JSON.stringify(p)); });
});

await test('élève · sans clé IA : vos réponses, pas de note inventée', async () => {
  await open(mp, '#/eleve');
  await mp.evaluate(() => { window.__examFakes.aiReady = false; });
  await open(mp, '#/eleve');
  await mp.evaluate(() => { window.__examFakes.aiReady = false; });
  await mp.click('[data-act="quick-jury"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  if (await mp.$('[data-act="qa-type"]')) await mp.click('[data-act="qa-type"]');
  await mp.fill('[data-f="answer"]', 'Stablecoins are risky for small savers.');
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-qa [data-act="to-review"]');
  await mp.click('.ex-qa [data-act="to-review"]');
  await mp.waitForSelector('.ex-myanswers');
  assert(!(await mp.$('[data-act="manual"]')), 'pas de « Noter à la main »');
  assert(/Stablecoins are risky/.test(await mp.textContent('.ex-myans')), 'réponse donnée affichée');
  assert(/Ajoutez une clé IA pour obtenir une note sur 20/.test(await mp.textContent('.ex-review-pre')), 'invitation à ajouter une clé');
  await shot(mp, '34-mobile-bilan-sans-cle', { both: false, full: true });
  await mp.evaluate(() => { window.__examFakes.aiReady = true; });
});

await test('mobile : console jury et fiches sans débordement', async () => {
  const LAST = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_LAST%40thread.v2/0';
  await mp.evaluate((l) => localStorage.setItem('aidevisio.exam.teams', l), LAST);
  await open(mp, `#/oral/${'new'}`);
  await mp.waitForSelector('[data-subject]');
  await mp.click('[data-subject]');
  await clickSheetAction(mp, 'Faire passer ce sujet');
  await mp.waitForSelector('.ex-console[data-phase="prep"]');
  assert((await mp.inputValue('[data-f="teams"]')) === LAST, 'séance suivante pré-remplie avec le dernier lien Teams');
  assert((await horizontalOverflow(mp)) <= 0, 'console prep sans débordement');
  await shot(mp, '29-mobile-jury-prep', { both: false, full: true });
  await mp.click('[data-act="to-expose"]');
  await mp.waitForSelector('[data-act="expose-start"]');
  assert(!(await mp.$('[data-src="pc-interne"]:visible')), 'pas de source « Son du PC » sur téléphone');
  assert((await horizontalOverflow(mp)) <= 0, 'console exposé sans débordement');
  await shot(mp, '30-mobile-jury-expose', { both: false, full: true });
  await mp.click('.ex-notes-fab');
  await mp.fill('.sheet-layer [data-f="sheet-notes"]', 'Note prise sur téléphone');
  await clickSheetAction(mp, 'Fermer');
  assert(/téléphone/.test((await session(mp)).expose.juryNotes), 'notes du jury depuis la feuille');
  await mp.click('[data-act="to-interview"]');
  await mp.waitForSelector('[data-b="q"] .ex-q-en');
  assert((await horizontalOverflow(mp)) <= 0, 'console entretien sans débordement');
  await shot(mp, '31-mobile-jury-entretien', { both: false, full: true });
  await open(mp, '#/fiches/phrases');
  await mp.waitForSelector('.ex-fbody > *');
  assert((await horizontalOverflow(mp)) <= 0, 'fiches sans débordement');
  await open(mp, '#/historique');
  const before = await mp.locator('[data-del]').count();
  for (let i = 0; i < 2; i++) {
    await mp.locator('[data-del]').first().click();
    await mp.waitForSelector('.sheet-layer:not(.out)');
    const sheets = await mp.locator('.sheet-layer:not(.out)').count();
    assert(sheets === 1, 'une seule confirmation : ' + sheets);
    await clickSheetAction(mp, 'Supprimer');
    await mp.waitForFunction((n) => document.querySelectorAll('[data-del]').length === n, before - i - 1);
  }
});

await M.ctx.close();

let callId = '';
{
  const A = await makePage(DESK);
  const ap = A.page;

  await test('console jury · réponse attendue (IA) : micro du jury, jamais l’élève', async () => {
    await open(ap, '#/oral/new');
    await ap.waitForSelector('[data-subject]');
    await ap.locator('[data-subject]').first().click();
    await clickSheetAction(ap, 'Faire passer ce sujet');
    await ap.waitForSelector('.ex-console[data-phase="prep"]');
    await ap.click('[data-act="to-expose"]');
    await ap.waitForSelector('.ex-console[data-phase="expose"]');
    await ap.click('[data-act="to-interview"]');
    await ap.waitForSelector('.ex-console[data-phase="interview"], .sheet-layer:not(.out)');
    if (await ap.$('.sheet-layer:not(.out)')) await clickSheetAction(ap, 'Passer à l’entretien');
    await ap.waitForSelector('[data-b="q"] .ex-q-en');
    await ap.click('[data-src="pc-interne"]');
    await ap.click('[data-act="listen-start"]');
    await ap.waitForSelector('[data-act="listen-stop"]');
    assert((await ap.evaluate(() => window.__examFakes.audio.preset)) === 'pc-interne', 'source « Son de l’appel sur ce PC »');
    await emit(ap, 'final', { who: 'me', text: 'Why did the author write this article?' });
    await ap.waitForSelector('[data-b="janswer"] .ex-janswer-model', { timeout: 5000 });
    let card = await ap.textContent('[data-b="janswer"]');
    assert(/Réponse attendue \(IA\)/.test(card) && /Question entendue/.test(card) && /Why did the author write this article\?/.test(card), 'carte : ' + card.replace(/\s+/g, ' ').slice(0, 160));
    assert(/Attendu :/.test(card) && !/Attendu :\s*Attendu/.test(card) && /A good answer would/.test(card), 'attendu + réponse modèle');
    let calls = await callsOf(ap, 'juryAnswer');
    assert(calls.length === 1 && calls[0].question === 'Why did the author write this article?', 'juryAnswer : ' + JSON.stringify(calls));
    await emit(ap, 'final', { who: 'them', text: 'What is your opinion?' });
    await sleep(500);
    assert((await callsOf(ap, 'juryAnswer')).length === 1, 'aucun appel pour la voix de l’élève');
    assert(/Why did the author/.test(await ap.textContent('[data-b="janswer"]')), 'carte inchangée');
    await shot(ap, '45-jury-reponse-attendue', { full: true });
    const q = (await ap.textContent('[data-b="q"] .ex-q-en')).trim();
    await ap.click('[data-b="q"] [data-act="q-model"]');
    await ap.waitForFunction(() => /Question proposée/.test(document.querySelector('[data-b="janswer"]').textContent) && document.querySelector('[data-b="janswer"] .ex-janswer-model'), null, { timeout: 5000 });
    calls = await callsOf(ap, 'juryAnswer');
    assert(calls.length === 2 && calls[1].question === q, 'question proposée envoyée : ' + (calls[1] && calls[1].question));
    await ap.waitForFunction(() => AideVisio.examStore.get(location.hash.split('/')[2]).interview.modelAnswers.length === 2, null, { timeout: 5000 });
    await ap.click('[data-act="listen-stop"]');
    await ap.waitForSelector('[data-act="listen-start"]', { timeout: 5000 });
    await ap.click('[data-src="haut-parleur"]');
    await ap.click('[data-act="listen-start"]');
    await ap.waitForSelector('[data-act="listen-stop"]');
    await emit(ap, 'final', { who: 'mixed', text: 'Why is this article important?' });
    await sleep(500);
    assert((await callsOf(ap, 'juryAnswer')).length === 2, 'rien depuis un micro mêlé');
    assert((await callsOf(ap, 'liveAnswer')).length === 0, 'aucune aide élève depuis la console jury');
    card = await ap.textContent('[data-b="janswer"]');
    assert(/Question proposée/.test(card), 'dernière carte gardée');
    await ap.click('[data-act="menu"]');
    await ap.waitForSelector('.sheet-layer:not(.out) [data-m="export"]');
    const [dl] = await Promise.all([ap.waitForEvent('download'), ap.click('.sheet-layer:not(.out) [data-m="export"]')]);
    const md = fs.readFileSync(await dl.path(), 'utf8');
    assert(md.includes('## Réponses modèles (IA, jury)') && md.includes('**Why did the author write this article?**') && md.includes('  - Attendu : le but de l’auteur') && md.includes('  - Réponse modèle : A good answer would'), 'export jury : ' + md.slice(-400));
  });

  await test('liens Meet : console jury et accueil élève, lien invalide expliqué', async () => {
    const MEET = 'https://meet.google.com/abc-defg-hij';
    await open(ap, '#/oral/new');
    await ap.waitForSelector('[data-subject]');
    await ap.locator('[data-subject]').first().click();
    await clickSheetAction(ap, 'Faire passer ce sujet');
    await ap.waitForSelector('.ex-console[data-phase="prep"]');
    await ap.evaluate(() => {
      window.__opened = []; window.open = (u) => { window.__opened.push(String(u)); return null; };
      AideVisio.ui.copy = async (t) => { window.__copied = t; return true; };
    });
    await ap.fill('[data-f="teams"]', 'Participer à la réunion : ' + MEET);
    await ap.locator('[data-f="teams"]').blur();
    await ap.waitForSelector('[data-b="teams-bar"] [data-act="teams-join"]');
    assert(/Meet/.test(await ap.textContent('[data-b="teams-bar"]')), 'barre : réunion Meet');
    assert((await session(ap)).teamsLink === MEET, 'lien Meet enregistré');
    await ap.click('[data-b="teams"] [data-act="teams-join"]');
    assert((await ap.evaluate(() => window.__opened)).includes(MEET), 'Rejoindre ouvre Meet');
    await ap.click('[data-b="teams-bar"] [data-act="teams-copy"]');
    const copied = await ap.evaluate(() => window.__copied || '');
    assert(copied.includes(MEET) && /Google Meet/.test(copied), 'message pour Audrey : ' + copied.slice(0, 100));
    await ap.fill('[data-f="teams"]', 'https://zoom.us/j/123');
    await ap.locator('[data-f="teams"]').blur();
    await ap.waitForSelector('[data-b="teams"].is-bad');
    assert(/Lien invalide.*Meet/.test(await ap.textContent('[data-b="teams"] [data-b="teams-hint"]')), 'message lien invalide (jury)');
    await open(ap, '#/appel');
    await ap.waitForSelector('.ex-chooser .ex-call-intro');
  });
  await A.ctx.close();
}

{
  const C = await makePage(DESK);
  const cp = C.page;
  const Q1 = 'What do you think about the new tariffs?';
  let floatPop = null;

  await test('appel · ouvert : question du jury, réponse en flux, traduction, mots clés', async () => {
    callId = await newCall(cp);
    await waitOpen(cp);
    assert(/Lancer l’assistant/.test(await cp.textContent('[data-b="live"]')) && await cp.$('[data-b="live"] [data-act="assist"]'), 'bouton « Lancer l’assistant »');
    await cp.click('[data-src="pc-interne"]');
    await cp.click('[data-act="listen-start"]');
    await cp.waitForSelector('[data-act="listen-stop"]');
    assert((await cp.evaluate(() => window.__examFakes.audio.preset)) === 'pc-interne', 'son de l’appel sur ce PC');
    await emit(cp, 'interim', { who: 'them', text: 'What do you think' });
    await cp.waitForFunction(() => /What do you think/.test(document.querySelector('[data-b="live"] [data-b="interim"]').textContent));
    assert(/Le jury parle/.test(await liveText(cp, '.lv-status')) && await cp.$('[data-b="live"].has-interim .lv-interim:visible'), 'état « Le jury parle… » et phrase entendue en direct');
    await emit(cp, 'final', { who: 'them', text: Q1 });
    await cp.waitForFunction(() => { const e = document.querySelector('[data-b="live"] [data-b="ans"]'); return e && e.classList.contains('is-streaming') && e.textContent.trim().length > 0; }, null, { timeout: 5000 });
    const partial = await liveText(cp, '[data-b="ans"]');
    await cp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 5000 });
    const ans = await liveText(cp, '[data-b="ans"]');
    assert(/raise prices/.test(ans) && ans.length > partial.length, `réponse complète après le flux (« ${partial} » → « ${ans} »)`);
    assert((await liveText(cp, '.ex-live-en')) === Q1, 'question du jury affichée');
    assert((await liveText(cp, '[data-b="fr"]')) === 'Que pensez-vous des nouveaux droits de douane ?', 'traduction française de la question');
    const sub = await cp.$$eval('[data-b="live"] [data-b="ans"] .lv-line', (p) => p.map((x) => [x.querySelector('.lv-en').textContent, x.querySelector('.lv-tr').textContent]));
    assert(sub.length === 3 && /raise prices/.test(sub[0][0]) && /faire monter les prix/.test(sub[0][1]) && sub.every(([en, fr]) => en && fr), 'sous-titres : chaque phrase anglaise suivie de sa traduction : ' + JSON.stringify(sub));
    const kw = await cp.$$eval('[data-b="live"] .ex-live-kw .pill', (p) => p.map((x) => [x.querySelector('b').textContent, (x.querySelector('.lv-kw-fr') || {}).textContent]));
    assert(JSON.stringify(kw) === '[["tariffs","droits de douane"],["supply chain","chaîne d’approvisionnement"]]', 'mots clés + traduction : ' + JSON.stringify(kw));
    const la = await callsOf(cp, 'liveAnswer');
    assert(la.length === 1 && la[0].question === Q1 && la[0].shorter === false && la[0].subject, 'liveAnswer : ' + JSON.stringify(la));
    const tr = await callsOf(cp, 'translate');
    assert(tr.length === 1 && tr[0].text === Q1 && tr[0].to === 'fr', 'translate : ' + JSON.stringify(tr));
    await emit(cp, 'final', { who: 'me', text: 'I think tariffs are bad for consumers because prices go up.' });
    await cp.waitForFunction(() => /prices go up/.test((document.querySelector('.ex-chist-item.is-current .ex-chist-mine') || {}).textContent || ''));
    assert((await callsOf(cp, 'liveAnswer')).length === 1, 'la voix de l’élève ne déclenche rien');
    await cp.evaluate(() => Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true }));
    [floatPop] = await Promise.all([C.ctx.waitForEvent('page'), cp.click('[data-b="live"] [data-act="float"]')]);
    await floatPop.waitForSelector('.ex-float [data-b="ans"]', { timeout: 5000 });
    assert(/raise prices/.test(await floatPop.textContent('.ex-float [data-b="ans"]')) && (await floatPop.textContent('.ex-float .ex-live-en')).trim() === Q1, 'réponse dans la fenêtre flottante');
    assert(await cp.$('[data-b="live"] [data-act="float"].on'), 'bouton « Fenêtre flottante » actif');
    assert(/Réponse prête/.test(await liveText(cp, '.lv-status')), 'état « Réponse prête »');
    await shot(cp, '41-appel-reponse', { full: true });
  });

  await test('appel · question qui remplace celle en cours, « Can you hear me? », Plus court, export, sortie', async () => {
    await cp.evaluate(() => { window.__examFakes.delay = 350; });
    const Q2 = 'And how will they affect Europe?';
    await emit(cp, 'final', { who: 'them', text: Q2 });
    await cp.waitForFunction((q) => { const e = document.querySelector('[data-b="live"] .ex-live-en'); return e && e.textContent === q; }, Q2);
    await sleep(150);
    await emit(cp, 'final', { who: 'them', text: 'Could you give an example?' });
    await cp.waitForFunction(() => /Europe\? Could you give an example\?$/.test((document.querySelector('[data-b="live"] .ex-live-en') || {}).textContent || ''));
    await cp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 8000 });
    assert(/European exporters/.test(await liveText(cp, '[data-b="ans"]')), 'réponse à la nouvelle question');
    await floatPop.waitForFunction(() => /European exporters/.test(document.querySelector('[data-b="ans"]').textContent), null, { timeout: 5000 });
    assert((await cp.evaluate(() => window.__examFakes.liveAborted || 0)) >= 1, 'requête précédente annulée');
    let qs = await cp.$$eval('.ex-chist-q', (p) => p.map((x) => x.textContent));
    assert(qs.length === 2 && qs[0] === Q2 + ' Could you give an example?' && qs[1] === Q1, 'historique : ' + JSON.stringify(qs));
    await cp.evaluate(() => { window.__examFakes.delay = 120; });
    const n0 = (await callsOf(cp, 'liveAnswer')).length;
    await emit(cp, 'final', { who: 'them', text: 'Can you hear me?' });
    await cp.waitForFunction((n) => window.__examFakes.calls.filter((c) => c.fn === 'liveAnswer').length > n, n0);
    await cp.waitForFunction(() => !document.querySelector('[data-b="live"] .pill-accent') && /European exporters/.test(document.querySelector('[data-b="live"] [data-b="ans"]').textContent), null, { timeout: 5000 });
    let la = await callsOf(cp, 'liveAnswer');
    assert(la[la.length - 1].question === 'Can you hear me?', 'question seule, pas jointe à la précédente : ' + la[la.length - 1].question);
    qs = await cp.$$eval('.ex-chist-q', (p) => p.map((x) => x.textContent));
    assert(qs.length === 2 && !qs.some((q) => /hear me/.test(q)), 'pas de carte pour « Can you hear me? »');
    assert(!/hear me/.test(await cp.textContent('[data-b="live"]')), 'panneau en direct inchangé');
    await cp.click('[data-b="live"] [data-act="shorter"]');
    await cp.waitForFunction(() => /^Tariffs mean higher prices/.test(document.querySelector('[data-b="live"] [data-b="ans"]').textContent) && !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 5000 });
    la = await callsOf(cp, 'liveAnswer');
    const last = la[la.length - 1];
    assert(last.shorter === true && last.question === Q2 + ' Could you give an example?', 'liveAnswer({ shorter: true }) : ' + JSON.stringify(last));
    assert(/European exporters/.test(last.previous) && !last.force, '« Plus court » envoie la réponse affichée : ' + JSON.stringify(last));
    assert(!(await cp.$('[data-b="live"][aria-live]')) && await cp.$('[data-b="call-sr"][aria-live]'), 'annonce courte, pas de zone aria-live sur toute la scène');
    const [dl] = await Promise.all([cp.waitForEvent('download'), cp.click('[data-act="export"]')]);
    const md = fs.readFileSync(await dl.path(), 'utf8');
    assert(/^# Appel d’entraînement/.test(md) && md.includes('### 1. ' + Q1) && md.includes('Réponse IA : I think the new tariffs will raise prices') && md.includes('Ma réponse : I think tariffs are bad') && md.includes('Tariffs mean higher prices'), 'export : ' + md.slice(0, 300));
    assert(/^appel-entrainement-.*\.md$/.test(dl.suggestedFilename()), 'nom du fichier : ' + dl.suggestedFilename());
    await cp.click('.ex-topbar [data-go="#/"]');
    await cp.waitForSelector('.sheet-layer:not(.out)');
    assert(/Quitter l’appel/.test(await cp.textContent('.sheet-layer:not(.out)')), 'confirmation de sortie');
    await clickSheetAction(cp, 'Quitter');
    await cp.waitForSelector('.ex-home');
    await cp.waitForFunction(() => !window.AideVisio.audio.running, null, { timeout: 5000 });
    for (let i = 0; i < 50 && !floatPop.isClosed(); i++) await sleep(100);
    assert(floatPop.isClosed(), 'fenêtre flottante fermée en quittant l’écran');
    const s = await cp.evaluate((id) => JSON.parse(JSON.stringify(AideVisio.examStore.get(id))), callId);
    assert(s.call.answers.length === 2 && s.call.turns.length === 5, `appel enregistré : ${s.call.answers.length} réponses, ${s.call.turns.length} échanges`);
  });

  await test('appel · micro / haut-parleur : phrase de l’élève notée sans rien déclencher ; sans clé IA, cause précise', async () => {
    await newCall(cp);
    await waitOpen(cp);
    await cp.click('[data-src="haut-parleur"]');
    await cp.click('[data-act="listen-start"]');
    await cp.waitForSelector('[data-act="listen-stop"]');
    assert((await cp.evaluate(() => window.__examFakes.audio.preset)) === 'haut-parleur', 'micro / haut-parleur');
    const n0 = (await callsOf(cp, 'liveAnswer')).length;
    await emit(cp, 'final', { who: 'mixed', text: 'I believe that tariffs protect some local jobs.' });
    await sleep(400);
    assert((await callsOf(cp, 'liveAnswer')).length === n0, 'aucune réponse demandée pour une phrase sans question');
    await cp.waitForFunction(() => AideVisio.examStore.get(location.hash.split('/')[2]).call.turns.length === 1);
    const s = await session(cp);
    assert(s.call.turns[0].who === 'student' && /local jobs/.test(s.call.turns[0].text), 'phrase notée comme celle de l’élève : ' + JSON.stringify(s.call.turns));
    assert(!(await cp.$('.ex-chist-item')) && !(await cp.$('[data-b="live"] .ex-live-q')), 'pas de carte');
    await emit(cp, 'final', { who: 'mixed', text: 'Why do you think so?' });
    await cp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 5000 });
    const la = (await callsOf(cp, 'liveAnswer')).pop();
    assert(la.question === 'Why do you think so?' && /local jobs/.test(la.expose), 'liveAnswer : ' + JSON.stringify(la));
    // « Répondre maintenant » (touche Espace) : demande explicite ; sans question trouvée, cause affichée.
    await emit(cp, 'interim', { who: 'mixed', text: 'Can you hear me' });
    const n1 = (await callsOf(cp, 'liveAnswer')).length;
    await cp.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
    await cp.keyboard.press('Space');
    await cp.waitForFunction((n) => window.__examFakes.calls.filter((c) => c.fn === 'liveAnswer').length > n, n1, { timeout: 5000 });
    const fa = (await callsOf(cp, 'liveAnswer')).pop();
    assert(fa.force === true && fa.question === 'Can you hear me' && fa.previous === '', 'Espace → liveAnswer({ force: true }) : ' + JSON.stringify(fa));
    await cp.waitForFunction(() => /pas trouvé de question/.test((document.querySelector('[data-b="live"] .ex-live-err') || {}).textContent || ''), null, { timeout: 5000 });
    assert(await cp.$('[data-b="live"] .ex-live-err [data-act="retry"]'), 'question introuvable : cause + Réessayer');
    await emit(cp, 'final', { who: 'mixed', text: 'Why do you think so?' });
    await cp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 5000 });
    await cp.evaluate(() => { window.__examFakes.aiReady = false; });
    await cp.click('[data-b="live"] [data-act="retry"]');
    await cp.waitForSelector('[data-b="live"] .ex-live-err', { timeout: 5000 });
    assert(/Pas de clé IA/.test(await liveText(cp, '.ex-live-err')) && await cp.$('[data-b="live"] .ex-live-err [data-go="#/settings"]'), 'cause précise + Réglages');
    await cp.evaluate(() => { window.__examFakes.aiReady = true; });
    await cp.click('[data-act="end"]');
    await cp.waitForFunction(() => !window.AideVisio.audio.running, null, { timeout: 5000 });
    await cp.waitForFunction(() => !!AideVisio.examStore.get(location.hash.split('/')[2]).call.endedAt);
    assert(await cp.$('[data-act="listen-start"]:not([disabled])'), 'écoute relançable après la fin');
    await cp.waitForSelector('[data-b="end"][disabled]', { timeout: 3000 });
    assert(/Appel terminé/.test(await cp.textContent('[data-b="end"]')), 'bouton de fin : « Appel terminé »');
    await cp.evaluate(() => { window.__examFakes.aiReady = false; document.querySelectorAll('.toast').forEach((t) => t.remove()); });
    const started = await cp.evaluate(() => window.__examFakes.audio.started);
    await cp.click('[data-src="visio-casque"]');
    await cp.click('[data-act="listen-start"]');
    await cp.waitForFunction(() => /Pas de clé IA/.test((document.querySelector('[data-b="live"] .ex-live-err') || {}).textContent || ''), null, { timeout: 5000 });
    assert(!(await cp.$('.toast')), 'pas de toast : l’erreur est dans la scène');
    assert((await cp.evaluate(() => window.__examFakes.audio.started)) === started, 'aucune écoute lancée sans clé');
    await cp.evaluate(() => { window.__examFakes.aiReady = true; });
  });

  await test('appel · routes, historique et accueil', async () => {
    await open(cp, '#/oral/' + callId);
    await cp.waitForFunction((id) => location.hash === '#/appel/' + id, callId, { timeout: 5000 });
    await open(cp, '#/eleve/' + callId);
    await cp.waitForFunction((id) => location.hash === '#/appel/' + id, callId, { timeout: 5000 });
    await waitOpen(cp);
    assert((await cp.locator('.ex-chist-item').count()) === 2, 'historique de l’appel repris');
    await open(cp, '#/historique');
    await cp.waitForSelector(`[data-open="${callId}"]`);
    const row = await cp.textContent(`[data-open="${callId}"]`);
    assert(/Sur Teams/.test(row) && /2 questions/.test(row), 'ligne de l’historique : ' + row.replace(/\s+/g, ' ').slice(0, 160));
    await shot(cp, '43-historique-appel');
    await cp.click(`[data-open="${callId}"]`);
    await cp.waitForFunction((id) => location.hash === '#/appel/' + id, callId);
    await open(cp, '#/');
    await cp.waitForSelector('.ex-home .ex-roles');
    assert((await cp.locator('.ex-roles .ex-role').count()) === 2, 'deux cartes sur l’accueil');
    assert(await cp.$(`.ex-resume [data-go="#/appel/${callId}"]`) && /Entraînement sur Teams/.test(await cp.textContent('.ex-resume')), 'carte « Séance en cours » : appel non terminé');
    assert((await horizontalOverflow(cp)) <= 0, 'accueil sans débordement');
    await shot(cp, '44-accueil-deux-cartes', { full: true });
    await open(cp, '#/appel');
    await cp.waitForSelector('.ex-chooser .ex-call-intro');
    assert((await cp.evaluate(() => location.hash)) === '#/appel', 'carte → import du sujet de l’appel');
  });

  await test('appel · commencer sans sujet, lien vide expliqué dans le champ', async () => {
    await open(cp, '#/appel');
    await cp.waitForSelector('.ex-chooser [data-act="start-blank"]');
    await cp.fill('[data-f="teams"]', '');
    await cp.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
    await cp.click('[data-b="teams"] [data-act="teams-join"]');
    await cp.waitForSelector('[data-b="teams"].is-bad [data-f="teams"][aria-invalid="true"]');
    assert(/Collez d’abord le lien/.test(await cp.textContent('[data-b="teams-hint"]')) && !(await cp.$('.toast')), 'lien vide : message dans le champ, sans toast');
    await cp.click('[data-act="start-blank"]');
    await cp.waitForSelector('.ex-call [data-b="live"] .lv-start');
    assert(await cp.$('.ex-call-subject[open] [data-act="import-subject"]'), 'sujet à importer pendant l’appel');
    assert((await session(cp)).subject.paragraphs.length === 0, 'appel créé sans sujet');
  });
  await C.ctx.close();
}

{
  const D = await makePage(MOBILE);
  const dp = D.page;

  await test('mobile : assistant en un geste, sans débordement', async () => {
    await newCall(dp);
    await waitOpen(dp);
    assert((await horizontalOverflow(dp)) <= 0, 'écran de départ sans débordement');
    await shot(dp, '46-mobile-appel-depart', { both: false, full: true });
    assert(!(await dp.$('[data-src="pc-interne"]:visible')), 'pas de « Son du PC » sur téléphone');
    await dp.click('[data-b="live"] [data-act="assist"]');
    await dp.waitForSelector('[data-b="live"] .lv-status.on');
    assert(D.ctx.pages().length === 1, 'pas de fenêtre flottante sur téléphone');
    await emit(dp, 'final', { who: 'mixed', text: 'What do you think about the new tariffs?' });
    await dp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 5000 });
    assert((await horizontalOverflow(dp)) <= 0, 'appel ouvert sans débordement');
    const first = await dp.evaluate(() => document.querySelector('[data-b="live"]').getBoundingClientRect().top < document.querySelector('.ex-call-meet').getBoundingClientRect().top);
    assert(first, 'réponse en haut de l’écran, avant la carte Réunion');
    await shot(dp, '47-mobile-appel', { both: false, full: true });
  });
  await D.ctx.close();
}

{
  const E = await makePage({ width: 1536, height: 830 });
  const ep = E.page;
  const TEAMS = 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_test%40thread.v2/0';
  const Q = 'What do you think about the new tariffs?';

  await test('Teams élève : accueil → lien → import du sujet → assistant (fenêtre flottante)', async () => {
    await open(ep, '#/');
    await ep.click('.ex-home .ex-role[data-go="#/appel"]');
    await ep.waitForSelector('.lv-start-screen .lv-steps');
    const txt = await ep.textContent('.lv-start-screen');
    assert(/Importer le sujet/.test(txt) && /Rejoindre l’appel/.test(txt), 'étapes : ' + txt.replace(/\s+/g, ' ').slice(0, 160));
    assert(!(await ep.$('[data-act="draw"], [data-act="gen"], [data-subject]')), 'ni tirage au sort, ni sujet généré, ni liste de sujets');
    assert(await ep.$('.lv-start-screen [data-go="#/oral/new"]'), 'lien « Je suis le jury »');
    await ep.evaluate(() => { window.__opened = []; window.open = ((o) => function (u, n, f) { if (u) { window.__opened.push(String(u)); return null; } return o.call(window, u, n, f); })(window.open); });
    await ep.fill('[data-f="teams"]', 'Rejoindre : ' + TEAMS);
    await ep.locator('[data-f="teams"]').blur();
    await ep.waitForSelector('[data-b="teams"].is-set');
    await ep.click('[data-b="teams"] [data-act="teams-join"]');
    assert((await ep.evaluate(() => window.__opened)).includes(TEAMS), 'Rejoindre ouvre Teams');
    await shot(ep, '50-teams-depart', { both: false, full: true });
    await importSubject(ep);
    const s = await session(ep);
    assert(s.kind === 'call' && s.teamsLink === TEAMS, 'appel créé avec le lien Teams : ' + s.teamsLink);
    assert(/tariffs hurt consumers/.test(s.subject.question) && /Trade wars/.test(s.subject.title), 'sujet importé : ' + s.subject.title + ' / ' + s.subject.question);
    assert((await ep.inputValue('.ex-call [data-f="teams"]')) === TEAMS, 'lien repris sur l’écran d’appel');
    await ep.waitForSelector('[data-b="live"] .lv-start [data-act="assist"]');
    const tip = await ep.textContent('[data-b="live"] .lv-tip');
    assert(/juste sous la caméra/.test(tip), 'conseil de placement : ' + tip);
    const lay = await ep.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      const go = r('[data-b="live"] .lv-go'), live = r('[data-b="live"]'), side = r('.ex-call .lv-side');
      const sideEl = document.querySelector('.ex-call .lv-side');
      const titles = [...sideEl.querySelectorAll(':scope > .card')].map((c) => (c.querySelector('h2, summary b') || {}).textContent);
      return { scroll: document.scrollingElement.scrollHeight - innerHeight, goIn: go.top >= 0 && go.bottom <= innerHeight, leftRight: live.right <= side.left, sideScroll: getComputedStyle(sideEl).overflowY, bottom: Math.max(live.bottom, side.bottom) <= innerHeight + 1, titles };
    });
    assert(lay.scroll <= 1 && lay.goIn && lay.leftRight && lay.bottom && lay.sideScroll === 'auto', '1536×830 : tout visible sans défiler, aides à gauche, colonne à droite : ' + JSON.stringify(lay));
    assert(JSON.stringify(lay.titles) === '["Rejoindre l’appel","Son de l’appel","Sujet","Historique de l’appel"]', 'colonne de droite : ' + JSON.stringify(lay.titles));
    for (const scheme of ['light', 'dark']) {
      await ep.emulateMedia({ colorScheme: scheme });
      await sleep(150);
      await shot(ep, `51-teams-assistant-depart-${scheme}`, { both: false });
    }
    await ep.emulateMedia({ colorScheme: 'light' });
    await ep.evaluate(() => { window.__examFakes.aiReady = false; });
    await ep.click('[data-b="live"] [data-act="assist"]');
    await ep.waitForSelector('[data-b="live"] .ex-live-err');
    assert(/Pas de clé IA/.test(await ep.textContent('[data-b="live"] .ex-live-err')) && await ep.$('[data-b="live"] .ex-live-err [data-go="#/settings"]'), 'sans clé : cause + Réglages');
    assert((await ep.evaluate(() => window.__examFakes.audio.started)) === 0, 'aucune écoute sans clé');
    assert(E.ctx.pages().length === 1, 'aucune fenêtre ouverte sans clé');
    await ep.evaluate(() => {
      window.__examFakes.aiReady = true; Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true });
      window.__warm = [];
      const ai = AideVisio.ai, w0 = ai.warm;
      ai.warm = (p, o) => { window.__warm.push(p); return w0 ? w0(p, o) : []; };
    });
    const [pop] = await Promise.all([E.ctx.waitForEvent('page'), ep.click('[data-b="live"] [data-act="assist"]')]);
    await ep.waitForSelector('[data-b="live"] .lv-status.on');
    assert(/J’écoute/.test(await ep.textContent('[data-b="live"] .lv-status')), 'état « J’écoute… »');
    assert((await ep.evaluate(() => window.__examFakes.audio.started)) === 1, 'écoute lancée en un geste');
    assert((await ep.evaluate(() => window.__warm)).includes('live'), 'connexion IA réchauffée au lancement');
    await pop.waitForSelector('.lv-float .lv-stage .lv-status.on', { timeout: 5000 });
    await emit(ep, 'final', { who: 'mixed', text: Q });
    await pop.waitForSelector('.lv-float .ex-live-kw .pill', { timeout: 5000 });
    assert(/raise prices/.test(await pop.textContent('.lv-float [data-b="ans"]')), 'réponse dans la fenêtre flottante');
    assert((await pop.textContent('.lv-float .ex-live-en')).trim() === Q, 'question dans la fenêtre flottante');
    const sizes = await pop.evaluate(() => {
      const px = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
      return { ans: px('[data-b="ans"]'), q: px('.ex-live-en'), fr: px('.lv-q-fr'), tr: px('.lv-tr') };
    });
    assert(sizes.ans >= 1.6 * sizes.q && sizes.ans > sizes.fr && sizes.ans > 1.4 * sizes.tr, 'réponse anglaise nettement plus grande : ' + JSON.stringify(sizes));
    assert(sizes.q >= 15 && sizes.fr >= 14 && sizes.tr >= 14, 'question et traductions lisibles à 60-70 cm : ' + JSON.stringify(sizes));
    assert((await ep.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) <= 1, '1536×830 : réponse affichée sans défilement');
    assert(await pop.evaluate(() => { const a = document.querySelector('.lv-a'); return a.scrollHeight <= a.clientHeight + 1; }), 'réponse entière visible dans la fenêtre');
    assert(await pop.evaluate(() => [...document.styleSheets].some((x) => { try { return [...x.cssRules].some((r) => /lv-fit/.test(r.cssText)); } catch (e) { return false; } })), 'live.css copié dans la fenêtre flottante');
    for (const scheme of ['light', 'dark']) {
      await pop.setViewportSize({ width: 760, height: 420 });
      await pop.evaluate((t) => { document.documentElement.dataset.theme = t; window.dispatchEvent(new Event('resize')); }, scheme);
      await sleep(250);
      await pop.screenshot({ path: path.join(SHOTS, `52-teams-flottante-${scheme}.png`) });
      await ep.emulateMedia({ colorScheme: scheme });
      await sleep(150);
      await shot(ep, `53-teams-assistant-reponse-${scheme}`, { both: false });
    }
    await ep.emulateMedia({ colorScheme: 'light' });
    assert(await ep.$('[data-b="live"] [data-act="float"].on') && await ep.$('[data-b="live"] [data-act="full"]'), 'boutons Fenêtre flottante (actif) et Plein écran');
    assert((await horizontalOverflow(ep)) <= 0, 'pas de débordement');
    await ep.click('[data-b="live"] [data-act="full"]');
    await ep.waitForFunction(() => document.fullscreenElement && document.fullscreenElement.matches('[data-b="live"]'), null, { timeout: 5000 });
    await ep.waitForSelector('[data-b="live"] [data-act="full"].on');
    const fs = await ep.evaluate(() => ({ px: parseFloat(getComputedStyle(document.querySelector('[data-b="live"] [data-b="ans"]')).fontSize), fits: (() => { const a = document.querySelector('[data-b="live"] .lv-a'); return a.scrollHeight <= a.clientHeight + 1; })() }));
    assert(fs.px >= 40 && fs.fits, 'plein écran : réponse en très gros et entière : ' + JSON.stringify(fs));
    await sleep(200);
    await ep.screenshot({ path: path.join(SHOTS, '55-teams-plein-ecran.png') });
    await ep.click('[data-b="live"] [data-act="full"]');
    await ep.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
    await ep.click('[data-b="live"] [data-act="listen-stop"]');
    for (let i = 0; i < 50 && !pop.isClosed(); i++) await sleep(100);
    assert(pop.isClosed(), 'fenêtre flottante fermée à l’arrêt');
    await ep.waitForSelector('[data-b="live"] [data-act="assist"]');
    assert(/raise prices/.test(await ep.textContent('[data-b="live"] [data-b="ans"]')), 'dernière réponse gardée après l’arrêt');
    await ep.setViewportSize(MOBILE);
    await ep.click('.ex-topbar [data-go="#/"]');
    await ep.waitForSelector('.ex-home');
    await open(ep, '#/appel');
    await ep.waitForSelector('.lv-start-screen');
    for (const scheme of ['light', 'dark']) {
      await ep.emulateMedia({ colorScheme: scheme });
      await sleep(150);
      await shot(ep, `54-teams-depart-mobile-${scheme}`, { both: false, full: true });
    }
    assert((await horizontalOverflow(ep)) <= 0, 'départ mobile sans débordement');
    await ep.click('.lv-start-screen [data-go="#/oral/new"]');
    await ep.waitForFunction(() => location.hash === '#/oral/new');
    await ep.waitForSelector('.ex-chooser [data-subject]');
  });

  await test('Teams élève : longue réponse ajustée, mots-clés traduits, coupures et erreurs expliquées', async () => {
    await ep.setViewportSize({ width: 1536, height: 830 });
    await ep.emulateMedia({ colorScheme: 'light' });
    await newCall(ep);
    await waitOpen(ep);
    const err = (p) => p.evaluate(() => { const l = [...document.querySelectorAll('[data-b="live"] .ex-live-err, [data-b="float"] .ex-live-err')]; return l.length ? { text: l.map((e) => e.textContent.trim()).join(' | '), acts: l.flatMap((e) => [...e.querySelectorAll('[data-act], [data-go]')].map((b) => b.dataset.act || b.dataset.go)) } : null; });
    // Micro refusé : cause précise, Réessayer et Changer de source.
    await ep.click('[data-src="haut-parleur"]');
    await ep.evaluate(() => { window.__examFakes.startError = { code: 'MIC_DENIED', msg: 'Accès au micro refusé. Cliquez sur le cadenas à gauche de l’adresse, autorisez le micro, puis réessayez.' }; Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true }); });
    await ep.click('[data-b="live"] [data-act="assist"]');
    await ep.waitForSelector('[data-b="live"] .ex-live-err');
    let e = await err(ep);
    assert(/micro refusé/.test(e.text) && e.acts.includes('assist') && e.acts.includes('pick-src'), 'micro refusé : ' + JSON.stringify(e));
    // La fenêtre flottante reste ouverte et montre la même erreur, avec « Réessayer ».
    for (let i = 0; i < 30 && E.ctx.pages().length < 2; i++) await sleep(100);
    const pop = E.ctx.pages()[1];
    assert(pop, 'fenêtre flottante ouverte au lancement');
    await pop.waitForSelector('.lv-float .lv-err [data-act="assist"]', { timeout: 5000 });
    // Micro occupé : même chose, message différent.
    await ep.evaluate(() => { window.__examFakes.startError = { code: 'MIC_BUSY', msg: 'Le micro est indisponible (utilisé par une autre application ?).' }; });
    await ep.click('[data-b="live"] .ex-live-err [data-act="assist"]');
    await ep.waitForFunction(() => /utilisé par une autre application/.test((document.querySelector('[data-b="live"] .ex-live-err') || {}).textContent || ''));
    await ep.click('[data-b="live"] .ex-live-err [data-act="pick-src"]');
    // Son du PC absent : proposer le micro.
    await ep.click('[data-src="pc-interne"]');
    await ep.evaluate(() => { window.__examFakes.startError = { code: 'PC_AUDIO_OFF', msg: '« Son du PC » n’est pas lancé.' }; });
    await ep.click('[data-b="live"] [data-act="assist"]');
    await ep.waitForFunction(() => /Son du PC/.test((document.querySelector('[data-b="live"] .ex-live-err') || {}).textContent || ''));
    e = await err(ep);
    assert(e.acts.includes('use-mic'), 'Son du PC absent → « Utiliser le micro » : ' + JSON.stringify(e));
    await ep.evaluate(() => { window.__examFakes.startError = null; window.__examFakes.delay = 60; });
    await ep.click('[data-b="live"] .ex-live-err [data-act="use-mic"]');
    await ep.waitForSelector('[data-b="live"] .lv-status.on');
    assert(E.ctx.pages().length === 2, 'une seule fenêtre flottante');
    assert((await ep.evaluate(() => window.__examFakes.audio.preset)) === 'haut-parleur', 'bascule sur le micro');
    await pop.setViewportSize({ width: 760, height: 420 });
    await pop.waitForSelector('.lv-float .lv-status.on');
    assert(/J’écoute/.test(await pop.textContent('.lv-float .lv-status')) && /sous la caméra/.test(await pop.textContent('.lv-float')), 'fenêtre : « J’écoute… » et conseil de placement');
    // Le jury parle : phrase entendue en direct, état clair.
    await emit(ep, 'interim', { who: 'mixed', text: 'What will happen in the long run for European' });
    await pop.waitForSelector('.lv-float .lv-stage.has-interim .lv-interim');
    assert(/Le jury parle/.test(await pop.textContent('.lv-float .lv-status')), 'fenêtre : « Le jury parle… »');
    await sleep(150);
    await pop.screenshot({ path: path.join(SHOTS, '59-teams-flottante-jury-parle.png') });
    // Longue réponse : affichée en flux, puis ajustée sans coupure dans la page et dans la fenêtre.
    await ep.evaluate(() => { window.__examFakes.delay = 700; });
    await emit(ep, 'final', { who: 'mixed', text: 'What will happen in the long run for European and American consumers, in your opinion?' });
    await pop.waitForFunction(() => document.querySelectorAll('.lv-float .lv-ans.is-streaming .lv-line').length >= 4, null, { timeout: 5000 });
    assert(/Réponse en cours/.test(await pop.textContent('.lv-float .lv-status')), 'fenêtre : « Réponse en cours… »');
    await sleep(350);
    await pop.screenshot({ path: path.join(SHOTS, '60-teams-flottante-flux.png') });
    await ep.evaluate(() => { window.__examFakes.delay = 60; });
    await pop.waitForSelector('.lv-float .ex-live-kw .pill', { timeout: 5000 });
    await sleep(200);
    const fit = async (p, sel) => p.evaluate((s) => { const a = document.querySelector(s + ' .lv-a'); const t = document.querySelector(s + ' [data-b="ans"]'); return { fits: a.scrollHeight <= a.clientHeight + 1, scroll: a.classList.contains('is-scroll') && getComputedStyle(a).overflowY === 'auto', px: parseFloat(getComputedStyle(t).fontSize), lines: t.querySelectorAll('.lv-line').length, kw: [...document.querySelectorAll(s + ' .lv-kw-fr')].map((x) => x.textContent) }; }, sel);
    const fp = await fit(pop, '.lv-float'), pg = await fit(ep, '[data-b="live"]');
    // 6 phrases + traductions (plus long que la consigne) : taille mini lisible, puis défilement doux, rien de coupé.
    assert(fp.lines === 6 && fp.px >= 22 && (fp.fits || fp.scroll), 'fenêtre 760×420 : longue réponse lisible, entière ou défilante : ' + JSON.stringify(fp));
    assert(pg.lines === 6 && pg.px >= 24 && (pg.fits || pg.scroll), 'page : longue réponse lisible, entière ou défilante : ' + JSON.stringify(pg));
    assert(fp.kw.length === 2 && fp.kw[0] === 'droits de douane', 'traduction des mots-clés dans la fenêtre : ' + JSON.stringify(fp.kw));
    const btns = await pop.evaluate(() => ['shorter', 'retry'].map((a) => { const b = document.querySelector(`.lv-float [data-act="${a}"]`); if (!b) return null; const r = b.getBoundingClientRect(); return r.width >= 34 && r.height >= 30 && r.bottom <= innerHeight && r.right <= innerWidth && !!b.getAttribute('aria-label'); }));
    assert(btns.every(Boolean), 'Plus court / Réessayer visibles et cliquables dans la fenêtre : ' + JSON.stringify(btns));
    await pop.screenshot({ path: path.join(SHOTS, '56-teams-flottante-longue.png') });
    await shot(ep, '57-teams-reponse-longue', { both: false });
    // Perte de son passagère : avertissement, puis retour.
    await emit(ep, 'info', { who: 'them', code: 'MIC_MUTED', kind: 'warn', message: 'Le micro semble coupé (touche de sourdine ou réglage de Windows).' });
    await pop.waitForSelector('.lv-float .lv-warn');
    assert(/micro semble coupé/.test(await ep.textContent('[data-b="live"] .lv-warn')), 'avertissement dans la page');
    await pop.screenshot({ path: path.join(SHOTS, '58-teams-flottante-alerte.png') });
    await emit(ep, 'info', { who: 'them', code: 'MIC_BACK', kind: 'info', message: 'Micro reconnecté.' });
    await ep.waitForFunction(() => !document.querySelector('[data-b="live"] .lv-warn'));
    // Clé refusée : cause + Réglages, dans la page et la fenêtre.
    await ep.evaluate(() => { window.__examFakes.liveError = { code: 'KEY', msg: 'Clé Gemini refusée : recopiez-la en entier dans Réglages.' }; });
    await pop.click('.lv-float [data-act="retry"]');
    await pop.waitForSelector('.lv-float .ex-live-err [data-act="settings"]', { timeout: 5000 });
    e = await err(ep);
    assert(/Clé Gemini refusée/.test(e.text) && e.acts.includes('#/settings'), 'clé refusée : ' + JSON.stringify(e));
    await ep.evaluate(() => { window.__examFakes.liveError = null; });
    // Son coupé pour de bon : l’assistant s’arrête, libère tout et propose de relancer.
    await emit(ep, 'ended', { who: 'mixed', reason: 'track-ended', kind: 'audio' });
    await ep.waitForSelector('[data-b="live"] .ex-live-err [data-act="assist"]', { timeout: 5000 });
    e = await err(ep);
    assert(/micro s’est coupé/.test(e.text), 'son coupé expliqué : ' + JSON.stringify(e));
    assert(await ep.evaluate(() => !window.__examFakes.audio.running && !AideVisio.audio.running), 'flux libérés');
    await pop.waitForSelector('.lv-float .lv-err [data-act="assist"]', { timeout: 5000 });
    assert(!pop.isClosed() && /micro s’est coupé/.test(await pop.evaluate(() => [...document.querySelectorAll('.lv-float .lv-err')].map((x) => x.textContent).join(' | '))), 'fenêtre flottante gardée : cause + « Relancer »');
    // Relance depuis la fenêtre : pas de seconde fenêtre. Puis plein écran : Échap pour sortir.
    await ep.evaluate(() => { window.__examFakes.delay = 120; });
    await pop.click('.lv-float .lv-err [data-act="assist"]');
    await ep.waitForSelector('[data-b="live"] [data-act="full"]');
    assert(E.ctx.pages().length === 2, 'relance sans seconde fenêtre');
    const pop2 = pop;
    await ep.click('[data-b="live"] [data-act="full"]');
    await ep.waitForFunction(() => document.fullscreenElement, null, { timeout: 5000 });
    assert(/Échap/.test(await ep.getAttribute('[data-b="live"] [data-act="full"]', 'title')), 'rappel « Échap » dans l’info-bulle du plein écran');
    await ep.keyboard.press('Escape');
    await ep.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
    await ep.click('[data-b="live"] [data-act="listen-stop"]');
    for (let i = 0; i < 30 && !pop2.isClosed(); i++) await sleep(100);
    assert(pop2.isClosed() && !(await ep.evaluate(() => AideVisio.audio.running)), 'arrêt : fenêtre fermée, écoute libérée');
  });
  await E.ctx.close();
}

await browser.close();
srv.server.close();

const failed = results.filter((r) => !r.ok);
const errs = errors.filter((e) => !/Failed to load resource|net::ERR/.test(e.msg));
if (errs.length) {
  console.log(`\n  Erreurs JavaScript (${errs.length}) :`);
  errs.slice(0, 15).forEach((e) => console.log(`    [${e.test}] ${e.msg.slice(0, 300)}`));
}
console.log(`\n${results.length - failed.length} réussi(s), ${failed.length} échec(s), ${errs.length} erreur(s) JS — ${((Date.now() - T0) / 1000).toFixed(0)} s. Captures : tests/shots-exam/`);
process.exit(failed.length || errs.length ? 1 : 0);
