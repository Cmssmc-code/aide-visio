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
      'question' in o ? { question: o.question, shorter: !!o.shorter, expose: String(o.expose || ''), turns: (o.turns || []).length, subject: o.subject && o.subject.id } : {}, extra));
  };
  const LIVE = [
    [/europe/i, 'European exporters would be hit too, so the EU could answer with its own tariffs on American goods.'],
    [/tariff/i, 'I think the new tariffs will raise prices for consumers and disrupt the supply chain of many firms.'],
    [/.*/, 'In my view, the article raises a key question for companies and for consumers.']
  ];
  const examAI = {
    ready: () => M.aiReady,
    isJuryQuestion: (t) => /\?\s*$/.test(String(t || '').trim()) || /^\s*(what|why|how|could|can|do|tell)\b/i.test(String(t || '')),
    async liveAnswer(a) {
      log('liveAnswer', a);
      try {
        if (!M.aiReady) { await wait(M.delay / 2, a.signal); throw Object.assign(new Error('Pas de clé IA.'), { code: 'NO_KEY' }); }
        if (/hear me/i.test(a.question)) { await wait(M.delay, a.signal); return { text: '', keyWords: [], skip: true }; }
        const full = a.shorter ? 'Tariffs mean higher prices and a weaker supply chain.' : LIVE.find(([re]) => re.test(a.question))[1];
        const words = full.split(' ');
        for (const k of [1, 2, 3]) {
          await wait(M.delay, a.signal);
          if (a.onDelta) a.onDelta(words.slice(0, Math.ceil(words.length * k / 3)).join(' '));
        }
        return { text: full, keyWords: ['tariffs', 'supply chain'], skip: false };
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
    async translate(t, o) { log('translate', null, { text: t, to: o && o.to }); return 'FR: ' + t; },
    async generateSubject() { throw new Error('non utilisé'); },
    async subjectFromText() { throw new Error('non utilisé'); }
  };
  const handlers = M.audio.handlers;
  const audio = {
    get running() { return M.audio.started > M.audio.stopped; },
    on(ev, fn) { (handlers[ev] = handlers[ev] || new Set()).add(fn); return () => handlers[ev].delete(fn); },
    async start(preset, opts) { M.audio.started++; M.audio.preset = preset; M.audio.opts = opts; setTimeout(() => M.emit('state', { state: 'listening' }), 30); return {}; },
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

const LOCKED_DATE = 'Wed, 11 Nov 2026 09:00:00 GMT';
const OPEN_DATE = 'Fri, 13 Nov 2026 08:00:00 GMT';
async function serverDate(ctx, date) {
  const probe = { n: 0, date, fail: false };
  await ctx.route(/sw\.js\?now=/, (r) => {
    probe.n++;
    return probe.fail ? r.abort() : r.fulfill({ status: 200, headers: { date: probe.date, 'cache-control': 'no-store' }, body: '' });
  });
  return probe;
}
async function newCall(page) {
  await open(page, '#/appel');
  await page.waitForSelector('.ex-chooser .ex-call-intro');
  await page.locator('.ex-sgrid [data-subject]').first().click();
  await page.waitForSelector('.sheet-layer .ex-paper');
  await clickSheetAction(page, 'Choisir pour l’appel');
  await page.waitForFunction(() => /^#\/appel\/ex-/.test(location.hash));
  await page.waitForSelector('.ex-call [data-b="live"]');
  return page.evaluate(() => location.hash.split('/')[2]);
}
const waitLocked = (page) => page.waitForSelector('[data-b="live"].is-locked .ex-lock', { timeout: 10000 });
const waitOpen = (page) => page.waitForSelector('[data-b="live"]:not(.is-locked) .ex-live-head', { timeout: 10000 });
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

await test('accueil : trois choix, sans date d’examen', async () => {
  await open(page, '#/');
  await page.waitForSelector('.ex-home');
  const tabs = await page.$$eval('#tabbar [data-tab]', (as) => as.filter((a) => !a.hidden && getComputedStyle(a).display !== 'none').map((a) => a.dataset.tab));
  assert(JSON.stringify(tabs) === '["home","fiches","settings"]', 'onglets visibles : ' + tabs);
  assert(await page.$eval('#tabbar [data-tab="home"]', (a) => a.classList.contains('on')), 'onglet Oral actif');
  assert((await page.locator('.ex-home .ex-role').count()) === 3, 'trois choix sur l’accueil');
  for (const go of ['#/eleve', '#/oral/new', '#/historique']) assert(await page.$(`.ex-home .ex-role[data-go="${go}"]`), 'choix ' + go);
  const home = await page.textContent('.ex-home');
  assert(!/J-\d|UE 218|novembre|jeudi/.test(home), 'aucune mention de l’examen : ' + home.slice(0, 120));
  assert(!(await page.$('.sheet-layer')), 'aucune fenêtre ouverte au démarrage');
  await shot(page, '01-accueil', { full: true });
  assert((await horizontalOverflow(page)) <= 0, 'pas de défilement horizontal');
});

await test('choix du sujet (jury) : filtre thème, aperçu, lancement', async () => {
  await page.click('[data-go="#/oral/new"]');
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

await test('élève · tirage au sort et préparation (brouillon, mode strict)', async () => {
  await open(mp, '#/');
  await mp.waitForSelector('.ex-home');
  await shot(mp, '20-mobile-accueil', { both: false, full: true });
  assert((await horizontalOverflow(mp)) <= 0, 'pas de défilement horizontal (mobile)');
  await mp.click('[data-go="#/eleve"]');
  await mp.waitForSelector('.ex-chooser [data-act="draw"]');
  await shot(mp, '21-mobile-eleve-choix', { both: false, full: true });
  await mp.click('[data-act="draw"]');
  await mp.waitForSelector('.sheet-layer .ex-draw-card');
  await shot(mp, '22-mobile-tirage', { both: false });
  await clickSheetAction(mp, 'C’est parti');
  await mp.waitForFunction(() => /^#\/eleve\/ex-/.test(location.hash));
  await mp.waitForSelector('.ex-solo [data-act="prep-start"]');
  assert(!(await mp.$('.ex-solo .ex-paper')), 'texte caché avant le chrono');
  await mp.click('[data-dur="10"]');
  await mp.click('[data-act="prep-start"]');
  await mp.waitForSelector('.ex-solo .ex-paper');
  await mp.fill('[data-note="intro"]', 'This article, published in March 2026, deals with stablecoins.');
  await mp.fill('[data-note="summary"]', 'The author explains that banks are worried because customers could move their deposits to stablecoins very quickly');
  await mp.waitForSelector('[data-nf="summary"].is-long');
  await mp.fill('[data-note="summary"]', 'banks worried • deposits → stablecoins • GENIUS Act');
  await mp.waitForSelector('[data-nf="summary"]:not(.is-long)');
  assert(!(await mp.$('.ex-help')), 'mode strict : pas d’aide-mémoire');
  await mp.locator('[data-f="strict"]').uncheck({ force: true });
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
  await shot(mp, '26-mobile-jury-ia', { both: false, full: true });
  await mp.click('[data-act="qa-next"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  await mp.waitForSelector('[data-act="qa-type"]');
  await mp.click('[data-act="qa-type"]');
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

await test('élève · jury IA direct (sans préparation)', async () => {
  await open(mp, '#/eleve');
  await mp.waitForSelector('.ex-jury-ai [data-act="quick-jury"]');
  assert(await mp.$('.ex-scard.is-hidden-q'), 'titres et questions cachés');
  assert(await mp.$('.ex-scard .pill-ok'), 'badge « Fait le JJ/MM »');
  assert(!(await mp.$('.ex-teams-join')), 'écran IA épuré : pas de champ Teams');
  await shot(mp, '32-mobile-eleve-accueil', { both: false, full: true });
  await mp.click('[data-act="quick-jury"]');
  await mp.waitForSelector('.sheet-layer .ex-draw-card');
  await clickSheetAction(mp, 'Questions du jury');
  await mp.waitForSelector('.ex-solo[data-phase="interview"] [data-act="qa-next"]');
  assert(await mp.$('.ex-solo-subj[open] .ex-paper'), 'sujet affiché pendant le jury IA');
  const spoken0 = await mp.evaluate(() => (window.__spoken || []).length);
  await mp.click('[data-act="qa-next"]');
  await mp.waitForSelector('[data-act="qa-done"]');
  await mp.waitForFunction((n) => (window.__spoken || []).length > n, spoken0);
  assert(!(await mp.$('[data-target]')), 'nombre de questions figé après la 1re question');
  const mic = await mp.$('[data-act="qa-mic"]');
  if (mic) await mic.click();
  await mp.waitForFunction(() => window.__sr.active.size > 0, null, { timeout: 5000 });
  await mp.click('[data-act="qa-repeat"]');
  await mp.waitForFunction(() => window.__sr.active.size > 0, null, { timeout: 5000 });
  await mp.evaluate(() => window.__sr.say('In my opinion the article shows that banks must adapt quickly', { stepMs: 5 }));
  await mp.click('[data-act="qa-done"]');
  await mp.waitForSelector('.ex-fb .ex-ring');
  assert(/banks must adapt/.test(await mp.textContent('.ex-answer p')), 'réponse captée');
  await shot(mp, '33-mobile-jury-ia-direct', { both: false, full: true });
  await mp.click('[data-act="to-review"]').catch(() => {});
  if (!(await mp.$('[data-act="evaluate"]'))) { await mp.click('[data-step="review"]'); await clickSheetAction(mp, 'Passer'); }
  await mp.waitForSelector('.ex-review-pre [data-act="evaluate"]');
  await mp.click('.ex-review-pre [data-act="evaluate"]');
  await mp.waitForSelector('.ex-score .ex-ring');
  const ev = await mp.evaluate(() => window.__examFakes.lastEvaluate);
  assert(ev && ev.interviewOnly === true, 'évaluation « entretien seul »');
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
  const probeA = await serverDate(A.ctx, LOCKED_DATE);

  await test('appel · verrouillé avant le jeudi 12/11 à 14 h (heure du serveur)', async () => {
    await open(ap, '#/');
    await ap.waitForSelector('.ex-home .ex-role-call');
    assert(/dès le jeudi 12 novembre à 14 h/.test(await ap.textContent('.ex-role-call')), 'carte d’accueil : date d’ouverture');
    await newCall(ap);
    await waitLocked(ap);
    const live = await ap.textContent('[data-b="live"]');
    assert(/Disponible à partir du jeudi 12 novembre à 14 h/.test(live) && /prévu jeudi 12 novembre à 10 h/.test(live), 'texte du verrou : ' + live.slice(0, 140));
    assert(probeA.n >= 1, 'heure demandée au serveur');
    const edge = await ap.evaluate(() => [Date.UTC(2026, 10, 12, 12, 59, 59), Date.UTC(2026, 10, 12, 13, 0, 0)].map((t) => AideVisio.examLock.decide(t, 0).open));
    assert(edge[0] === false && edge[1] === true, 'ouverture jeudi 12/11 à 14 h, Paris : ' + JSON.stringify(edge));
    assert(await ap.isDisabled('[data-act="listen-start"]'), '« Écouter l’appel » désactivé');
    assert(/jeudi 12 novembre à 14 h/.test(await ap.textContent('[data-b="listen-status"]')), 'raison affichée dans la carte Écoute');
    assert(!(await ap.$('[data-act="float"], [data-act="shorter"], [data-act="retry"]')), 'ni fenêtre flottante, ni « Plus court », ni « Réessayer »');
    for (const who of ['them', 'mixed', 'me']) await emit(ap, 'final', { who, text: 'What do you think about the new tariffs?' });
    await sleep(500);
    const n = (await callsOf(ap, 'liveAnswer')).length + (await callsOf(ap, 'translate')).length;
    assert(n === 0, 'aucun appel liveAnswer ni translate : ' + n);
    assert((await ap.evaluate(() => window.__examFakes.audio.started)) === 0, 'écoute jamais lancée');
    const s = await session(ap);
    assert(s.kind === 'call' && s.call.answers.length === 0 && s.call.turns.length === 0, 'rien d’enregistré');
    await shot(ap, '40-appel-verrouille', { full: true });
    await ap.click('[data-b="live"] [data-go="#/eleve"]');
    await ap.waitForFunction(() => location.hash === '#/eleve');
  });

  await test('console jury · réponse attendue (IA) : micro du jury après l’ouverture, jamais l’élève', async () => {
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
    await emit(ap, 'final', { who: 'me', text: 'What is the main idea of the article?' });
    await ap.waitForSelector('[data-b="janswer"] .ex-janswer-lock', { timeout: 5000 });
    assert(/à partir du jeudi 12 novembre à 14 h/.test(await ap.textContent('[data-b="janswer"]')), 'raison du verrou côté jury');
    assert((await callsOf(ap, 'juryAnswer')).length === 0, 'aucun appel IA avant l’ouverture');
    probeA.date = OPEN_DATE;
    assert((await ap.evaluate(() => AideVisio.examLock.check({ force: true }))).open === true, 'ouvert selon le serveur');
    await sleep(8100);
    await emit(ap, 'final', { who: 'me', text: 'Why did the author write this article?' });
    await ap.waitForSelector('[data-b="janswer"] .ex-janswer-model', { timeout: 5000 });
    let card = await ap.textContent('[data-b="janswer"]');
    assert(!(await ap.$('[data-b="janswer"] .ex-janswer-lock')), 'raison retirée après l’ouverture');
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
    probeA.date = LOCKED_DATE;
    await ap.evaluate(() => AideVisio.examLock.check({ force: true }));
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
  const B = await makePage(DESK);
  const bp = B.page;
  const probeB = await serverDate(B.ctx, LOCKED_DATE);
  await bp.clock.setSystemTime(new Date('2026-11-14T10:00:00+01:00'));

  await test('appel · horloge du PC au 14/11 mais serveur au 11/11 : toujours verrouillé', async () => {
    await newCall(bp);
    await waitLocked(bp);
    assert((await bp.evaluate(() => new Date().toISOString().slice(0, 10))) === '2026-11-14', 'horloge locale avancée');
    assert(await bp.isDisabled('[data-act="listen-start"]'), 'écoute impossible');
    let st = await bp.evaluate(() => AideVisio.examLock.check());
    assert(st.open === false && st.source === 'server', 'décision du serveur : ' + JSON.stringify(st));
    await emit(bp, 'final', { who: 'them', text: 'What do you think about the new tariffs?' });
    await sleep(400);
    assert((await callsOf(bp, 'liveAnswer')).length + (await callsOf(bp, 'translate')).length === 0, 'aucune aide');
    probeB.fail = true;
    const n0 = probeB.n;
    st = await bp.evaluate(() => AideVisio.examLock.check({ force: true }));
    assert(probeB.n > n0 && st.open === false && st.source === 'server', 'sonde échouée, verrou gardé : ' + JSON.stringify(st));
    probeB.fail = false;
    await bp.evaluate(() => { localStorage.setItem('aidevisio.exam.unlock', '1'); sessionStorage.setItem('unlock', '1'); });
    await bp.goto(bp.url().replace('#', '&unlock=1&debug=1#'));
    await bp.waitForSelector('.ex-call [data-b="live"]', { timeout: 15000 });
    await waitLocked(bp);
    assert(await bp.isDisabled('[data-act="listen-start"]'), 'toujours verrouillé');
  });
  await B.ctx.close();
}

{
  const C = await makePage(DESK);
  const cp = C.page;
  await serverDate(C.ctx, OPEN_DATE);
  const Q1 = 'What do you think about the new tariffs?';
  let floatPop = null;

  await test('appel · ouvert : question du jury, réponse en flux, traduction, mots clés', async () => {
    callId = await newCall(cp);
    await waitOpen(cp);
    assert(/Lancez l’écoute/.test(await cp.textContent('[data-b="live"]')), 'invitation à lancer l’écoute');
    await cp.click('[data-src="pc-interne"]');
    await cp.click('[data-act="listen-start"]');
    await cp.waitForSelector('[data-act="listen-stop"]');
    assert((await cp.evaluate(() => window.__examFakes.audio.preset)) === 'pc-interne', 'son de l’appel sur ce PC');
    await emit(cp, 'interim', { who: 'them', text: 'What do you think' });
    await cp.waitForFunction(() => /What do you think/.test(document.querySelector('[data-b="live"] [data-b="interim"]').textContent));
    await emit(cp, 'final', { who: 'them', text: Q1 });
    await cp.waitForFunction(() => { const e = document.querySelector('[data-b="live"] [data-b="ans"]'); return e && e.classList.contains('is-streaming') && e.textContent.trim().length > 0; }, null, { timeout: 5000 });
    const partial = await liveText(cp, '[data-b="ans"]');
    await cp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 5000 });
    const ans = await liveText(cp, '[data-b="ans"]');
    assert(/raise prices/.test(ans) && ans.length > partial.length, `réponse complète après le flux (« ${partial} » → « ${ans} »)`);
    assert((await liveText(cp, '.ex-live-en')) === Q1, 'question du jury affichée');
    assert((await liveText(cp, '[data-b="fr"]')) === 'FR: ' + Q1, 'traduction française');
    const kw = await cp.$$eval('[data-b="live"] .ex-live-kw .pill', (p) => p.map((x) => x.textContent));
    assert(JSON.stringify(kw) === '["tariffs","supply chain"]', 'mots clés : ' + kw);
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
    await cp.evaluate(() => { window.__examFakes.aiReady = false; });
    await cp.click('[data-b="live"] [data-act="retry"]');
    await cp.waitForSelector('[data-b="live"] .ex-live-err', { timeout: 5000 });
    assert(/Pas de clé IA/.test(await liveText(cp, '.ex-live-err')) && await cp.$('[data-b="live"] .ex-live-err [data-go="#/settings"]'), 'cause précise + Réglages');
    await cp.evaluate(() => { window.__examFakes.aiReady = true; });
    await cp.click('[data-act="end"]');
    await cp.waitForFunction(() => !window.AideVisio.audio.running, null, { timeout: 5000 });
    await cp.waitForFunction(() => !!AideVisio.examStore.get(location.hash.split('/')[2]).call.endedAt);
    assert(await cp.$('[data-act="listen-start"]:not([disabled])'), 'écoute relançable après la fin');
    await cp.evaluate(() => { window.__examFakes.aiReady = false; document.querySelectorAll('.toast').forEach((t) => t.remove()); });
    const started = await cp.evaluate(() => window.__examFakes.audio.started);
    await cp.click('[data-src="visio-casque"]');
    await cp.click('[data-act="listen-start"]');
    await cp.waitForFunction(() => [...document.querySelectorAll('.toast')].some((t) => /clé dans Réglages/.test(t.textContent)), null, { timeout: 5000 });
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
    assert(/Appel d’entraînement/.test(row) && /2 questions/.test(row), 'ligne de l’historique : ' + row.replace(/\s+/g, ' ').slice(0, 160));
    await shot(cp, '43-historique-appel');
    await cp.click(`[data-open="${callId}"]`);
    await cp.waitForFunction((id) => location.hash === '#/appel/' + id, callId);
    await open(cp, '#/');
    await cp.waitForSelector('.ex-home .ex-roles');
    assert((await cp.locator('.ex-roles .ex-role').count()) === 3, 'trois cartes sur l’accueil');
    assert(await cp.$(`.ex-resume [data-go="#/appel/${callId}"]`) && /Appel d’entraînement/.test(await cp.textContent('.ex-resume')), 'carte « Séance en cours » : appel non terminé');
    assert((await horizontalOverflow(cp)) <= 0, 'accueil sans débordement');
    await shot(cp, '44-accueil-trois-cartes', { full: true });
    await open(cp, '#/appel');
    await cp.waitForSelector('.ex-chooser .ex-call-intro');
    assert((await cp.evaluate(() => location.hash)) === '#/appel', 'carte → choix du sujet de l’appel');
  });
  await C.ctx.close();
}

{
  const D = await makePage(MOBILE);
  const dp = D.page;
  const probeD = await serverDate(D.ctx, LOCKED_DATE);

  await test('mobile : écran d’appel verrouillé puis ouvert, sans débordement', async () => {
    await newCall(dp);
    await waitLocked(dp);
    assert((await horizontalOverflow(dp)) <= 0, 'verrou sans débordement');
    await shot(dp, '46-mobile-appel-verrouille', { both: false, full: true });
    probeD.date = OPEN_DATE;
    await dp.reload();
    await dp.waitForSelector('.ex-call [data-b="live"]', { timeout: 15000 });
    await waitOpen(dp);
    assert(!(await dp.$('[data-src="pc-interne"]:visible')), 'pas de « Son du PC » sur téléphone');
    await dp.click('[data-act="listen-start"]');
    await dp.waitForSelector('[data-act="listen-stop"]');
    await emit(dp, 'final', { who: 'mixed', text: 'What do you think about the new tariffs?' });
    await dp.waitForSelector('[data-b="live"] .ex-live-kw .pill', { timeout: 5000 });
    assert((await horizontalOverflow(dp)) <= 0, 'appel ouvert sans débordement');
    const first = await dp.evaluate(() => document.querySelector('[data-b="live"]').getBoundingClientRect().top < document.querySelector('.ex-call-meet').getBoundingClientRect().top);
    assert(first, 'réponse en haut de l’écran, avant la carte Réunion');
    await shot(dp, '47-mobile-appel', { both: false, full: true });
  });
  await D.ctx.close();
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
