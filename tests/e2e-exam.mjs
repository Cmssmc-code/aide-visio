#!/usr/bin/env node
// Parcours de bout en bout du souffleur d'entretien d'embauche (faux examAI et faux audio, aucun réseau).
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

// Faux examAI (réponses fixes, flux en 3 morceaux) et faux audio (événements émis par le test).
function examFakes() {
  if (window.__examFakes) return;
  const M = window.__examFakes = { calls: [], audio: { started: 0, stopped: 0, handlers: {} }, delay: 100, aiReady: true, answerError: null };
  const wait = (ms, signal) => new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    if (signal) signal.addEventListener('abort', () => { clearTimeout(t); const e = new Error('Annulé'); e.name = 'AbortError'; rej(e); }, { once: true });
  });
  const LONG = [
    'Je suis contrôleur de gestion depuis dix ans.',
    'J’ai suivi des bailleurs institutionnels en association.',
    'Je produis un reporting mensuel fiable.'
  ];
  const examAI = {
    jobDossierMax: 36000,
    ready: () => M.aiReady,
    isRecruiterQuestion: (t) => /\?\s*$/.test(String(t || '').trim()) || /^\s*(pouvez|pourquoi|parlez|comment|quel)/i.test(String(t || '')),
    async jobAnswer(a) {
      M.calls.push({ fn: 'jobAnswer', question: a.question, shorter: !!a.shorter, force: !!a.force, previous: String(a.previous || ''), dossier: String(a.dossier || ''), turns: (a.turns || []).length });
      if (!M.aiReady) { await wait(30, a.signal); throw Object.assign(new Error('Pas de clé IA.'), { code: 'NO_KEY' }); }
      if (M.answerError) { const er = M.answerError; M.answerError = null; await wait(30, a.signal); throw Object.assign(new Error(er.msg), { code: er.code }); }
      await wait(M.delay / 2, a.signal);
      if (!a.force && /entendez/i.test(a.question)) return { text: '', keyWords: [], skip: true };
      if (a.shorter) {
        const t = 'Dix ans de contrôle de gestion en association.';
        if (a.onDelta) a.onDelta(t, { lines: [{ en: t }] });
        await wait(M.delay, a.signal);
        return { text: t, lines: [{ en: t }], keyWords: ['dix ans'], skip: false };
      }
      for (const k of [1, 2, 3]) {
        await wait(M.delay, a.signal);
        const lines = LONG.slice(0, k).map((en) => ({ en }));
        if (a.onDelta) a.onDelta(lines.map((l) => l.en).join(' '), { lines });
      }
      return { text: LONG.join(' '), lines: LONG.map((en) => ({ en })), keyWords: ['dix ans', 'bailleurs'], skip: false };
    }
  };
  const handlers = M.audio.handlers;
  const audio = {
    get running() { return M.audio.started > M.audio.stopped; },
    on(ev, fn) { (handlers[ev] = handlers[ev] || new Set()).add(fn); return () => handlers[ev].delete(fn); },
    async start(preset, opts) {
      M.audio.started++; M.audio.preset = preset; M.audio.opts = opts;
      setTimeout(() => M.emit('state', { state: 'listening' }), 30);
      return {};
    },
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
  // Pas de fenêtre « image dans l'image » en test : le repli est un pop-up ordinaire.
  try { Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true }); } catch (e) {  }
  const S = window.AideVisio = window.AideVisio || {};
  Object.defineProperty(S, 'examAI', { configurable: true, enumerable: true, get: () => examAI, set: (v) => { M.realExamAI = v; } });
  Object.defineProperty(S, 'audio', { configurable: true, enumerable: true, get: () => audio, set: (v) => { M.realAudio = v; } });
}

const srv = await startServer({ port: 0, dir: 'src', quiet: true });
const BASE = `${srv.url}index.html`;
const browser = await launchBrowser({ headed: HEADED });

async function makePage(viewport) {
  const ctx = await newContext(browser, null, { viewport: viewport || DESK, mobile: !!viewport && viewport.width < 600 });
  await ctx.addInitScript(examFakes);
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  watchErrors(ctx, sink);
  const page = await ctx.newPage();
  activePage = page;
  return { ctx, page };
}

let nav = 0;
async function open(page, hash) {
  await page.goto(`${BASE}?n=${++nav}${hash || '#/'}`);
  await page.waitForFunction(() => window.AideVisio && AideVisio.examStore && document.querySelector('#view .route'), null, { timeout: 15000 });
  await settle(page);
}
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
// Range des séances dans le stockage avant le chargement de l'appli (le contexte de chaque test est neuf).
async function seed(page, sessions, raw) {
  await page.goto(`${BASE}?n=${++nav}#/`);
  await page.evaluate(([s, r]) => localStorage.setItem('aidevisio.exam.v1', r != null ? r : JSON.stringify({ sessions: s, customSubjects: [] })), [sessions, raw == null ? null : raw]);
}
let seq = 0;
function job(o) {
  o = o || {};
  const at = new Date(Date.now() - (o.ageMin || 1) * 60000).toISOString();
  return {
    id: o.id || 'ex-seed' + (++seq), kind: o.kind || 'job', subject: { id: 'poste-x' + seq, title: o.title || 'Contrôleur de gestion — Association Exemple' },
    createdAt: at, updatedAt: at,
    call: { turns: o.turns || [], answers: o.answers || [], startedAt: o.startedAt || null, endedAt: o.endedAt || null },
    job: { text: o.text === undefined ? DOSSIER : o.text }
  };
}
const DOSSIER = 'Poste : Contrôleur de gestion — Association Exemple\nPitch : dix ans de gestion budgétaire en association, suivi de bailleurs institutionnels, reporting mensuel.\nSalaire : renvoyer à la grille de l’association.';

async function clickSheetAction(page, label) {
  const b = page.locator('.sheet-layer:not(.out) .sheet-actions button', { hasText: label }).last();
  await b.waitFor({ timeout: 5000 });
  await b.click();
  await page.waitForFunction(() => !document.querySelector('.sheet-layer:not(.out)'), null, { timeout: 5000 }).catch(() => {});
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('aidevisio.exam.v1') || '{"sessions":[]}').sessions);
const sessionNow = (page) => page.evaluate(() => JSON.parse(JSON.stringify(AideVisio.examStore.get(location.hash.split('/')[2]))));
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const emit = (page, ev, payload) => page.evaluate(([e, p]) => window.__examFakes.emit(e, p), [ev, payload]);
const heard = (page, text) => emit(page, 'final', { who: 'them', text });
const callsOf = (page) => page.evaluate(() => window.__examFakes.calls.filter((c) => c.fn === 'jobAnswer'));
const blurFocus = (page) => page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
const tabsOf = (page) => page.$$eval('#tabbar [data-tab]', (as) => as.filter((a) => !a.hidden && getComputedStyle(a).display !== 'none').map((a) => a.dataset.tab));
const ansLines = (page) => page.$$eval('[data-b="live"] [data-b="ans"] .lv-en', (n) => n.map((x) => x.textContent.trim()));
const histCount = (page) => page.$$eval('[data-b="hist"] .ex-chist-item', (n) => n.length);
// Écran d'entretien sans passer par l'accueil : une séance rangée, ouverte directement.
async function openCall(page, s) {
  await seed(page, [s || job({ id: 'ex-call1' })]);
  await open(page, '#/entretien/' + ((s && s.id) || 'ex-call1'));
  await page.waitForSelector('.ex-call [data-b="live"]');
}
const startListen = async (page) => {
  await page.click('[data-b="listen"] [data-act="listen-start"]');
  await page.waitForFunction(() => window.__examFakes.audio.started >= 1 && document.querySelector('[data-b="live"] [data-b="status"][data-k="listen"]'), null, { timeout: 8000 });
};

console.log('Aide Visio — souffleur d’entretien (e2e)\n');

await test('accueil : une carte « Préparer un entretien », 3 onglets', async () => {
  const { ctx, page } = await makePage();
  await open(page, '#/');
  await page.waitForSelector('.ex-home');
  assert(JSON.stringify(await tabsOf(page)) === '["home","historique","settings"]', 'onglets : ' + await tabsOf(page));
  assert(await page.$eval('#tabbar [data-tab="home"]', (a) => a.classList.contains('on')), 'onglet Accueil actif');
  assert((await page.locator('.ex-home .ex-role').count()) === 1, 'une seule carte');
  assert(/Préparer un entretien/.test(await page.textContent('.ex-home .ex-role')), 'libellé de la carte');
  assert(await page.getAttribute('.ex-home .ex-role', 'data-go') === '#/entretien/new', 'la carte mène à #/entretien/new');
  assert(!(await page.$('.ex-resume')) && !(await page.$('.ex-home-last')), 'ni reprise ni liste sans séance');
  assert(!(await page.$('.sheet-layer')), 'aucune fenêtre ouverte au démarrage');
  const home = await page.textContent('.ex-home');
  assert(/Souffleur d’entretien/.test(home) && !/UE 218|anglais|oral blanc|jury|fiches/i.test(home), 'texte : ' + home.slice(0, 160));
  assert((await overflowX(page)) <= 0, 'pas de défilement horizontal');
  await page.click('.ex-home .ex-role');
  await page.waitForFunction(() => location.hash === '#/entretien/new');
  await page.waitForSelector('.lv-steps');
  await ctx.close();
});

await test('accueil : sans clé IA, un message le dit', async () => {
  const { ctx, page } = await makePage();
  await open(page, '#/');
  await page.evaluate(() => { window.__examFakes.aiReady = false; AideVisio.app.refresh(); });
  await page.waitForSelector('.ex-home-note');
  assert(/clé IA/.test(await page.textContent('.ex-home-note')), 'note clé IA');
  await ctx.close();
});

await test('nouveau : dossier collé (titre + texte), enregistré, puis séance créée', async () => {
  const { ctx, page } = await makePage();
  await open(page, '#/entretien/new');
  await page.waitForSelector('.lv-steps');
  assert(await page.locator('[data-act="start"]', { hasText: 'Continuer sans dossier' }).count() === 1, '« Continuer sans dossier » sans dossier');
  assert(!(await page.$('[data-act="clear"]')), 'pas de « Repartir de zéro » sans dossier');
  await page.click('[data-act="dossier"]');
  await page.waitForSelector('.sheet-layer:not(.out) #ex-job-text');
  assert(/sur cet appareil/.test(await page.textContent('.sheet-layer:not(.out) [data-b="state"]')), 'message de confidentialité');
  // Annuler ne change rien.
  await page.fill('#ex-job-title', 'Brouillon');
  await clickSheetAction(page, 'Annuler');
  assert(!(await page.$('[data-act="clear"]')), 'annulé : toujours vide');
  await page.click('[data-act="dossier"]');
  await page.waitForSelector('#ex-job-text');
  await page.fill('#ex-job-title', 'Contrôleur de gestion — Association Exemple');
  await page.fill('#ex-job-text', DOSSIER);
  const st = await page.textContent('.sheet-layer:not(.out) [data-b="state"]');
  assert(/\d+ mots\. Le souffleur répond avec ce dossier/.test(st), 'compteur de mots : ' + st);
  await clickSheetAction(page, 'Enregistrer');
  await page.waitForSelector('[data-act="clear"]');
  const step = await page.textContent('.lv-step.is-main');
  assert(/Contrôleur de gestion — Association Exemple/.test(step) && /mots/.test(step) && !/repris/.test(step), 'dossier affiché : ' + step.slice(0, 160));
  assert(await page.locator('[data-act="start"]', { hasText: 'Ouvrir l’entretien' }).count() === 1, '« Ouvrir l’entretien »');
  assert((await stored(page)).length === 0, 'rien n’est rangé avant d’ouvrir l’entretien');
  await page.click('[data-act="start"]');
  await page.waitForFunction(() => /^#\/entretien\/ex-/.test(location.hash));
  await page.waitForSelector('.ex-call [data-b="live"]');
  const s = await sessionNow(page);
  assert(s.kind === 'job' && s.subject.title === 'Contrôleur de gestion — Association Exemple' && s.job.text === DOSSIER, 'séance rangée : ' + JSON.stringify(s).slice(0, 200));
  assert(s.call.answers.length === 0 && !s.call.startedAt && !s.call.endedAt, 'séance vierge');
  assert(/Association Exemple/.test(await page.textContent('.ex-tb-title small')), 'titre dans la barre');
  await ctx.close();
});

await test('nouveau : dossier de la dernière séance repris, « Repartir de zéro », sans dossier', async () => {
  const { ctx, page } = await makePage();
  await seed(page, [job({ id: 'ex-old', title: 'Chargé de mission — Fondation Test', ageMin: 120 }), job({ id: 'ex-vide', title: 'Sans texte', text: '', ageMin: 5 })]);
  await open(page, '#/entretien/new');
  await page.waitForSelector('.lv-step.is-main b');
  let step = await page.textContent('.lv-step.is-main');
  assert(/Chargé de mission — Fondation Test/.test(step) && /repris du dernier entretien/.test(step), 'repris (la plus récente AVEC texte) : ' + step.slice(0, 200));
  // Modifier le dossier depuis l'écran de départ.
  await page.click('[data-act="dossier"]');
  await page.waitForSelector('#ex-job-text');
  assert((await page.inputValue('#ex-job-title')) === 'Chargé de mission — Fondation Test' && (await page.inputValue('#ex-job-text')) === DOSSIER, 'feuille pré-remplie');
  await page.fill('#ex-job-title', 'Chargé de mission — Fondation Test (v2)');
  await clickSheetAction(page, 'Enregistrer');
  step = await page.textContent('.lv-step.is-main');
  assert(/\(v2\)/.test(step) && !/repris/.test(step), 'modifié : ' + step.slice(0, 120));
  await page.click('[data-act="clear"]');
  await page.waitForSelector('[data-act="start"]');
  assert(!(await page.$('[data-act="clear"]')), '« Repartir de zéro » disparaît');
  assert(await page.locator('[data-act="start"]', { hasText: 'Continuer sans dossier' }).count() === 1, 'retour à « Continuer sans dossier »');
  await page.click('[data-act="start"]');
  await page.waitForFunction(() => /^#\/entretien\/ex-/.test(location.hash));
  const s = await sessionNow(page);
  assert(s.job.text === '' && /^Entretien$/.test(s.subject.title), 'séance sans dossier : ' + JSON.stringify(s.subject) + ' / ' + s.job.text.length);
  assert(await page.locator('details.ex-call-subject[open]').count() === 1, 'sans dossier, le volet Dossier est ouvert');
  assert((await stored(page)).length === 3, '3 séances rangées');
  await ctx.close();
});

await test('entretien : souffleur, salutation sans réponse, question → réponse avec repères', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  assert(await page.locator('[data-b="live"] [data-act="assist"]', { hasText: 'Lancer le souffleur' }).count() === 1, 'bouton « Lancer le souffleur »');
  assert(/1 ?mots|\d+ mots/.test(await page.textContent('.ex-call-subject summary')), 'dossier résumé');
  await startListen(page);
  const au = await page.evaluate(() => window.__examFakes.audio);
  assert(au.preset === 'haut-parleur' && au.opts.lang === 'fr-FR', 'audio : ' + JSON.stringify({ p: au.preset, l: au.opts && au.opts.lang }));
  assert(/Association|Exemple|Contrôleur/.test(au.opts.hint || ''), 'repères d’écriture du dossier transmis : ' + au.opts.hint);
  await heard(page, 'Bonjour, merci d’être là.');
  await sleep(300);
  assert((await callsOf(page)).length === 0, 'une salutation n’appelle pas l’IA');
  assert((await ansLines(page)).length === 0 && (await histCount(page)) === 0, 'pas de réponse affichée');
  await heard(page, 'Pouvez-vous vous présenter ?');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3, null, { timeout: 8000 });
  await page.waitForSelector('[data-b="live"] .lv-kw-i');
  const lines = await ansLines(page);
  assert(lines[0] === 'Je suis contrôleur de gestion depuis dix ans.', 'première phrase : ' + lines[0]);
  const kws = await page.$$eval('[data-b="live"] .lv-kw-i', (n) => n.map((x) => x.textContent.trim()));
  assert(JSON.stringify(kws) === '["dix ans","bailleurs"]', 'repères : ' + kws);
  assert(/Pouvez-vous vous présenter/.test(await page.textContent('[data-b="live"] .lv-q-en')), 'question du recruteur affichée');
  assert(/Réponse prête/.test(await page.textContent('[data-b="live"] [data-b="status-l"]')), 'état « Réponse prête »');
  const calls = await callsOf(page);
  assert(calls.length === 1 && calls[0].question === 'Pouvez-vous vous présenter ?' && calls[0].dossier === DOSSIER && !calls[0].force, 'appel IA : ' + JSON.stringify(calls[0]).slice(0, 200));
  assert((await page.textContent('[data-b="hist-n"]')) === '1' && (await histCount(page)) === 1, 'historique : 1 question');
  assert(/Réponse soufflée/.test(await page.textContent('[data-b="hist"]')), 'réponse dans l’historique');
  // Micro seul : le candidat qui lit la réponse soufflée s'ajoute à la réponse affichée.
  await heard(page, 'Je suis contrôleur de gestion depuis dix ans.');
  await page.waitForSelector('[data-b="hist"] .ex-chist-mine');
  // Le son de la visio est un test de son : l'IA répond « pas de question », rien n'est gardé.
  await heard(page, 'Vous m’entendez ?');
  await page.waitForFunction(() => window.__examFakes.calls.length === 2);
  await sleep(400);
  assert((await histCount(page)) === 1 && (await ansLines(page)).length === 3, 'question « sautée » : rien d’ajouté, réponse précédente gardée');
  // Sauvegarde dans la séance.
  await page.waitForFunction(() => { const s = AideVisio.examStore.get(location.hash.split('/')[2]); return s && s.call.answers.length === 1 && s.call.turns.length >= 3; }, null, { timeout: 5000 });
  const s = await sessionNow(page);
  const a = s.call.answers[0];
  assert(a.question === 'Pouvez-vous vous présenter ?' && a.text.startsWith('Je suis contrôleur') && a.keyWords.length === 2 && /contrôleur de gestion/.test(a.mine), 'réponse rangée : ' + JSON.stringify(a).slice(0, 220));
  assert(s.call.turns.some((t) => t.who === 'jury' && /présenter/.test(t.text)) && s.call.turns.some((t) => t.who === 'mixed' && /Bonjour/.test(t.text)), 'échanges rangés');
  assert(!!s.call.startedAt, 'heure de début');
  assert((await overflowX(page)) <= 0, 'pas de défilement horizontal');
  await page.click('[data-b="live"] [data-act="listen-stop"]');
  await page.waitForFunction(() => window.__examFakes.audio.stopped === window.__examFakes.audio.started);
  await ctx.close();
});

await test('entretien : « plus court », « réessayer », raccourcis clavier (C, R, Espace)', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  await startListen(page);
  await heard(page, 'Parlez-moi de votre parcours');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3 && !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 8000 });
  await page.click('[data-b="live"] [data-act="shorter"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 1 && !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 8000 });
  let calls = await callsOf(page);
  assert(calls.length === 2 && calls[1].shorter && calls[1].question === 'Parlez-moi de votre parcours' && /contrôleur de gestion depuis dix ans/.test(calls[1].previous), 'appel « plus court » : ' + JSON.stringify(calls[1]).slice(0, 220));
  assert((await ansLines(page))[0] === 'Dix ans de contrôle de gestion en association.', 'réponse courte affichée');
  assert((await histCount(page)) === 1, 'même question : pas de doublon dans l’historique');
  // R : nouvelle réponse (version normale) ; C : plus court.
  await blurFocus(page);
  await page.keyboard.press('r');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3 && !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 8000 });
  await page.keyboard.press('c');
  await page.waitForFunction(() => window.__examFakes.calls.length === 4);
  calls = await callsOf(page);
  assert(!calls[2].shorter && calls[3].shorter, 'R = nouvelle réponse, C = plus court : ' + JSON.stringify(calls.map((c) => c.shorter)));
  await page.waitForFunction(() => !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 8000 });
  // Espace : répond à ce que le recruteur est en train de dire (réponse forcée).
  await blurFocus(page);
  await emit(page, 'interim', { who: 'them', text: 'Et côté audit' });
  await page.waitForFunction(() => /Et côté audit/.test(document.querySelector('[data-b="live"] [data-b="interim"]').textContent));
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__examFakes.calls.length === 5, null, { timeout: 5000 });
  calls = await callsOf(page);
  assert(calls[4].question === 'Et côté audit' && calls[4].force === true && !calls[4].shorter, 'Espace : demande forcée : ' + JSON.stringify(calls[4]).slice(0, 200));
  await page.waitForFunction(() => document.querySelectorAll('[data-b="hist"] .ex-chist-item').length === 2, null, { timeout: 8000 });
  // Pas de raccourci pendant la saisie dans un champ.
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-in'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('r');
  await sleep(250);
  assert((await callsOf(page)).length === 5, 'R dans un champ : rien');
  await ctx.close();
});

await test('entretien : erreur de clé, panne puis « Réessayer », fin sans clé', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  await startListen(page);
  await page.evaluate(() => { window.__examFakes.answerError = { code: 'KEY', msg: 'Clé Gemini refusée : recopiez-la en entier dans Réglages.' }; });
  await heard(page, 'Pourquoi ce poste ?');
  await page.waitForSelector('[data-b="live"] .lv-err');
  assert(/Clé Gemini refusée/.test(await page.textContent('[data-b="live"] .lv-err')), 'cause de l’erreur affichée');
  assert(await page.$('[data-b="live"] .lv-err [data-go="#/settings"]'), 'bouton Réglages');
  assert(!(await ansLines(page)).length, 'pas de texte de réponse');
  // Panne passagère : « Réessayer » relance la même question et obtient la réponse.
  await page.evaluate(() => { window.__examFakes.answerError = { code: 'NETWORK', msg: 'Réseau coupé.' }; });
  await heard(page, 'Comment gérez-vous les délais ?');
  await page.waitForSelector('[data-b="live"] .lv-err [data-act="retry"]');
  assert(/Réseau coupé/.test(await page.textContent('[data-b="live"] .lv-err')), 'erreur réseau');
  await page.click('[data-b="live"] .lv-err [data-act="retry"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3 && !document.querySelector('[data-b="live"] .lv-err'), null, { timeout: 8000 });
  const calls = await callsOf(page);
  assert(calls.length === 3 && calls[2].question === 'Comment gérez-vous les délais ?', 'même question relancée : ' + JSON.stringify(calls.map((c) => c.question)));
  await page.click('[data-b="live"] [data-act="listen-stop"]');
  await ctx.close();
  // Sans clé : l'erreur est visible tout de suite et l'écoute ne démarre pas.
  const { ctx: c2, page: p2 } = await makePage();
  await openCall(p2);
  await p2.evaluate(() => { window.__examFakes.aiReady = false; AideVisio.app.refresh(); });
  await p2.waitForSelector('[data-b="live"] .lv-start .lv-err');
  await p2.click('[data-b="live"] [data-act="assist"]');
  await p2.waitForSelector('[data-b="live"] .lv-err [data-go="#/settings"]');
  assert(/Pas de clé IA/.test(await p2.textContent('[data-b="live"] .lv-err')), 'message sans clé');
  assert((await p2.evaluate(() => window.__examFakes.audio.started)) === 0, 'l’écoute ne démarre pas sans clé');
  await c2.close();
});

await test('entretien : « Lancer le souffleur » ouvre la fenêtre flottante, qui suit les réponses', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), page.click('[data-b="live"] [data-act="assist"]')]);
  await pop.waitForSelector('.lv-float', { timeout: 8000 });
  await page.waitForFunction(() => window.__examFakes.audio.started === 1);
  assert(/La réponse s’affichera ici/.test(await pop.textContent('.lv-float')), 'fenêtre en attente');
  await heard(page, 'Pourquoi ce poste ?');
  await pop.waitForFunction(() => document.querySelectorAll('.lv-float [data-b="ans"] .lv-en').length === 3, null, { timeout: 8000 });
  assert(await pop.$('.lv-float .lv-kw-i') && await pop.$('.lv-float [data-act="shorter"]'), 'repères et « Plus court » dans la fenêtre');
  await pop.click('.lv-float [data-act="shorter"]');
  await pop.waitForFunction(() => document.querySelectorAll('.lv-float [data-b="ans"] .lv-en').length === 1, null, { timeout: 8000 });
  assert((await callsOf(page)).some((c) => c.shorter), 'plus court demandé depuis la fenêtre');
  await page.click('[data-b="live"] [data-act="listen-stop"]');
  for (let i = 0; i < 30 && !pop.isClosed(); i++) await sleep(100);
  assert(pop.isClosed(), 'arrêt : fenêtre fermée');
  assert(await page.evaluate(() => !AideVisio.audio.running), 'écoute libérée');
  await ctx.close();
});

const answered = (page, n) => page.waitForFunction((k) => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3 && !document.querySelector('[data-b="live"] .is-streaming') && window.__examFakes.calls.length === k, n, { timeout: 8000 });

await test('micro seul : le candidat qui lit la réponse n’est pas pris pour une question', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  await startListen(page);
  await heard(page, 'Pouvez-vous vous présenter ?');
  await answered(page, 1);
  // Lecture à voix haute, même terminée par « ? » : ni appel IA, ni réponse remplacée.
  await heard(page, 'Je suis contrôleur de gestion depuis dix ans, vous voyez ?');
  await page.waitForSelector('[data-b="hist"] .ex-chist-mine');
  await sleep(400);
  assert((await callsOf(page)).length === 1 && (await histCount(page)) === 1, 'lecture : pas de nouvel appel IA');
  assert((await ansLines(page))[0] === 'Je suis contrôleur de gestion depuis dix ans.', 'réponse affichée gardée');
  // Espace : jamais la lecture du candidat ; la question est déjà traitée, rien n'est refait.
  await blurFocus(page);
  await page.keyboard.press('Space');
  await sleep(400);
  assert((await callsOf(page)).length === 1, 'Espace : pas de nouvel appel : ' + JSON.stringify(await callsOf(page)));
  // Phrase non interrogative d'une voix non identifiée : rangée « mixed », pas comme parole du candidat.
  await heard(page, 'Très bien, nous allons passer à la suite.');
  await sleep(200);
  const s = await sessionNow(page);
  assert(s.call.turns.filter((x) => x.who === 'mixed').length === 2 && !s.call.turns.some((x) => x.who === 'student'), 'tours : ' + JSON.stringify(s.call.turns.map((x) => x.who)));
  assert(!/Très bien/.test(s.call.answers[0].mine) && /contrôleur/.test(s.call.answers[0].mine), 'mine : ' + s.call.answers[0].mine);
  // Vraie question du recruteur qui reprend les mots de la réponse : elle déclenche bien une réponse.
  await heard(page, 'Pouvez-vous détailler ces dix ans de contrôleur de gestion ?');
  await page.waitForFunction(() => window.__examFakes.calls.length === 2, null, { timeout: 8000 });
  await ctx.close();
});

await test('question coupée par une pause : une seule question, Espace ne refait pas la fin', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  await startListen(page);
  await heard(page, 'Pouvez-vous nous parler de votre parcours?');
  await heard(page, 'en association ?');
  await page.waitForFunction(() => window.__examFakes.calls.length === 2, null, { timeout: 5000 });
  await answered(page, 2);
  const calls = await callsOf(page);
  assert(calls[1].question === 'Pouvez-vous nous parler de votre parcours en association ?', 'question recollée : ' + calls[1].question);
  assert((await histCount(page)) === 1, 'historique : une seule entrée, ' + await histCount(page));
  assert(!/Interrompue/.test(await page.textContent('[data-b="hist"]')), 'pas d’erreur « Interrompue »');
  await blurFocus(page);
  await page.keyboard.press('Space');
  await sleep(400);
  assert((await callsOf(page)).length === 2 && (await histCount(page)) === 1, 'Espace : pas de 2e réponse pour la fin');
  // Suites de politesse (apostrophe typographique, « je vous écoute ») : la réponse affichée n'est pas refaite.
  await heard(page, 'Je vous écoute');
  await heard(page, 'd’accord');
  await sleep(400);
  assert((await callsOf(page)).length === 2, 'politesses : pas de nouvel appel');
  await ctx.close();
});

await test('nouveau : un double clic sur « Ouvrir l’entretien » ne crée qu’une séance', async () => {
  const { ctx, page } = await makePage();
  await open(page, '#/entretien/new');
  await page.waitForSelector('.lv-steps');
  await page.dblclick('[data-act="start"]');
  await page.waitForFunction(() => /^#\/entretien\/ex-/.test(location.hash));
  await page.waitForSelector('.ex-call [data-b="live"]');
  assert((await stored(page)).length === 1, 'séances : ' + (await stored(page)).length);
  await ctx.close();
});

await test('entretien : terminer, état enregistré, export .md', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  await startListen(page);
  await heard(page, 'Pouvez-vous vous présenter ?');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3 && !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 8000 });
  await heard(page, 'J’ai suivi des bailleurs institutionnels en association.');
  await page.waitForSelector('[data-b="hist"] .ex-chist-mine');
  await heard(page, 'Très bien, merci pour ces précisions.');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('[data-act="export"]')]);
  assert(/^entretien-\d{4}-\d{2}-\d{2}\.md$/.test(dl.suggestedFilename()), 'nom du fichier : ' + dl.suggestedFilename());
  const md = fs.readFileSync(await dl.path(), 'utf8');
  assert(/^# Entretien — Contrôleur de gestion — Association Exemple/.test(md), 'titre : ' + md.slice(0, 80));
  assert(/### 1\. Pouvez-vous vous présenter \?/.test(md) && /Réponse soufflée : Je suis contrôleur de gestion/.test(md) && /Repères : dix ans, bailleurs/.test(md) && /Ma réponse : J’ai suivi des bailleurs/.test(md), 'contenu : ' + md);
  assert(/## Échanges/.test(md) && /\*\*Recruteur\*\* : Pouvez-vous/.test(md) && /\*\*Entendu\*\* : J’ai suivi des bailleurs/.test(md) && /\*\*Entendu\*\* : Très bien/.test(md) && !/\*\*Moi\*\*/.test(md) && !/Ma réponse : Très bien/.test(md), 'échanges dans l’export (voix non identifiée : « Entendu »)');
  await page.click('[data-b="end"]');
  await page.waitForFunction(() => /Entretien terminé/.test(document.querySelector('[data-b="end"]').textContent) && document.querySelector('[data-b="end"]').disabled);
  assert(await page.evaluate(() => !AideVisio.audio.running), 'écoute arrêtée');
  assert((await sessionNow(page)).call.endedAt > 0, 'fin enregistrée');
  await page.waitForSelector('[data-b="live"] [data-act="assist"]');
  await ctx.close();
});

await test('entretien : dossier modifiable pendant l’entretien', async () => {
  const { ctx, page } = await makePage();
  await openCall(page, job({ id: 'ex-call2', text: '' }));
  assert(await page.$('details.ex-call-subject[open]'), 'dossier vide : volet ouvert');
  await page.click('[data-act="import-subject"]');
  await page.waitForSelector('#ex-job-text');
  await page.fill('#ex-job-title', 'Responsable administratif — Association Exemple');
  await page.fill('#ex-job-text', DOSSIER);
  await clickSheetAction(page, 'Enregistrer');
  await page.waitForFunction(() => /Responsable administratif/.test(document.querySelector('.ex-tb-title small').textContent));
  const s = await sessionNow(page);
  assert(s.job.text === DOSSIER && /Responsable administratif/.test(s.subject.title), 'dossier rangé');
  await startListen(page);
  await heard(page, 'Pourquoi ce poste ?');
  await page.waitForFunction(() => window.__examFakes.calls.length === 1);
  assert((await callsOf(page))[0].dossier === DOSSIER, 'le nouveau dossier est envoyé à l’IA');
  await page.click('[data-b="live"] [data-act="listen-stop"]');
  await ctx.close();
});

await test('entretien : quitter pendant l’écoute demande confirmation', async () => {
  const { ctx, page } = await makePage();
  await openCall(page);
  await startListen(page);
  await heard(page, 'Pourquoi ce poste ?');
  await page.waitForFunction(() => document.querySelectorAll('[data-b="live"] [data-b="ans"] .lv-en').length === 3 && !document.querySelector('[data-b="live"] .is-streaming'), null, { timeout: 8000 });
  await page.click('.ex-topbar [data-go]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  assert(/Quitter l’entretien/.test(await page.textContent('.sheet-layer:not(.out)')), 'confirmation');
  await clickSheetAction(page, 'Rester');
  assert(/^#\/entretien\/ex-call1$/.test(await page.evaluate(() => location.hash)) && await page.evaluate(() => AideVisio.audio.running), 'resté, écoute active');
  await page.click('.ex-topbar [data-go]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  await clickSheetAction(page, 'Quitter');
  await page.waitForSelector('.ex-home');
  assert(await page.evaluate(() => !AideVisio.audio.running), 'écoute arrêtée en quittant');
  const a = (await stored(page))[0].call.answers;
  assert(a.length === 1 && /Pourquoi/.test(a[0].question), 'question gardée');
  assert(await page.$('.ex-resume'), 'l’accueil propose de reprendre (entretien non terminé)');
  await ctx.close();
});

await test('reprise : séance commencée, rechargée, reprise depuis l’accueil', async () => {
  const { ctx, page } = await makePage();
  const ans = [{ id: 'a-1', question: 'Pourquoi ce poste ?', text: 'Parce que mon parcours correspond.', lines: [{ en: 'Parce que mon parcours correspond.' }], keyWords: ['parcours'], mine: 'Parce que…', at: new Date().toISOString(), skipped: false, error: '' }];
  await seed(page, [job({ id: 'ex-run', startedAt: Date.now() - 600000, answers: ans, turns: [{ who: 'jury', text: 'Pourquoi ce poste ?', t: 1000 }] })]);
  await open(page, '#/');
  await page.waitForSelector('.ex-resume');
  assert(/Association Exemple/.test(await page.textContent('.ex-resume')), 'carte de reprise');
  await page.click('.ex-resume [data-go]');
  await page.waitForSelector('.ex-call [data-b="hist"] .ex-chist-item');
  assert(/Parce que mon parcours/.test(await page.textContent('[data-b="live"]')), 'dernière réponse affichée');
  assert((await page.textContent('[data-b="hist-n"]')) === '1' && /Parce que…/.test(await page.textContent('[data-b="hist"] .ex-chist-mine')), 'historique repris');
  await page.reload();
  await page.waitForSelector('.ex-call [data-b="hist"] .ex-chist-item');
  assert(await page.locator('[data-b="live"] [data-act="assist"]', { hasText: 'Relancer le souffleur' }).count() === 1, 'écoute à relancer à la main');
  await ctx.close();
});

await test('historique : lignes, ouverture, suppression, anciennes séances ignorées', async () => {
  const { ctx, page } = await makePage();
  await seed(page, [
    job({ id: 'ex-h1', title: 'Contrôleur de gestion — Association Exemple', ageMin: 10 }),
    job({ id: 'ex-h2', title: 'Assistant comptable — Société Exemple', text: '', ageMin: 20, endedAt: Date.now() }),
    job({ id: 'ex-solo', kind: 'solo', title: 'Ancien oral d’anglais', ageMin: 1 }),
    Object.assign(job({ id: 'ex-jury', kind: 'jury', title: 'Ancien oral jury' }), { phase: 'expose' })
  ]);
  await open(page, '#/historique');
  await page.waitForSelector('.ex-history');
  assert(await page.$eval('#tabbar [data-tab="historique"]', (a) => a.classList.contains('on')), 'onglet Historique actif');
  const rows = await page.$$eval('.ex-hrow', (n) => n.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  assert(rows.length === 2, 'deux lignes (anciens types masqués) : ' + JSON.stringify(rows));
  assert(/Contrôleur de gestion/.test(rows[0]) && /mots de dossier/.test(rows[0]) && /En cours/.test(rows[0]), 'ligne 1 : ' + rows[0]);
  assert(/Assistant comptable/.test(rows[1]) && /sans dossier/.test(rows[1]) && /Terminé/.test(rows[1]), 'ligne 2 : ' + rows[1]);
  assert(!/anglais|jury/i.test(await page.textContent('.ex-history')), 'rien des anciennes séances');
  assert(/2 entretiens/.test(await page.textContent('.ex-tb-title small')), 'compteur');
  // Ouverture d'une ligne.
  await page.click('[data-open="ex-h2"]');
  await page.waitForFunction(() => location.hash === '#/entretien/ex-h2');
  await page.waitForSelector('.ex-call [data-b="live"]');
  await page.click('.ex-topbar [data-go]');
  await open(page, '#/historique');
  // Suppression : annuler garde la ligne, confirmer la retire.
  await page.click('[data-del="ex-h1"]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  assert(/Supprimer cet entretien/.test(await page.textContent('.sheet-layer:not(.out)')), 'confirmation');
  await clickSheetAction(page, 'Annuler');
  assert((await page.locator('.ex-hrow').count()) === 2, 'annulé : 2 lignes');
  await page.click('[data-del="ex-h1"]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  await clickSheetAction(page, 'Supprimer');
  await page.waitForFunction(() => document.querySelectorAll('.ex-hrow').length === 1);
  assert(!(await page.$('[data-open="ex-h1"]')), 'ligne supprimée');
  const kept = (await stored(page)).map((s) => s.id).sort();
  assert(JSON.stringify(kept) === '["ex-h2","ex-jury","ex-solo"]', 'seule la séance visée est effacée : ' + kept);
  await page.click('[data-del="ex-h2"]');
  await page.waitForSelector('.sheet-layer:not(.out)');
  await clickSheetAction(page, 'Supprimer');
  await page.waitForSelector('.ex-history .empty');
  assert(/Aucun entretien/.test(await page.textContent('.ex-history .empty')) && await page.$('.ex-history .empty [data-go="#/entretien/new"]'), 'état vide avec lien');
  await ctx.close();
});

await test('séance introuvable ou d’un autre type : message, pas de plantage', async () => {
  const { ctx, page } = await makePage();
  await seed(page, [job({ id: 'ex-solo', kind: 'solo', title: 'Ancien oral' }), job({ id: 'ex-ok' })]);
  for (const id of ['inconnue', 'ex-solo']) {
    await open(page, '#/entretien/' + id);
    await page.waitForSelector('.route .empty-page');
    assert(/Séance introuvable/.test(await page.textContent('.route')), 'message pour ' + id);
    assert(!(await page.$('.ex-call')), 'pas d’écran d’entretien pour ' + id);
    assert(!(await page.evaluate(() => document.body.classList.contains('ex-focus'))), 'mode focus non activé');
  }
  await page.click('.route .empty-page [data-go]');
  await page.waitForSelector('.ex-home');
  assert(!/Ancien oral/.test(await page.textContent('.ex-home')), 'l’ancienne séance n’apparaît pas à l’accueil');
  await ctx.close();
});

await test('stockage ancien ou abîmé : accueil, historique et départ ne plantent pas', async () => {
  const { ctx, page } = await makePage();
  const before = errors.length;
  for (const raw of ['{pas du json', 'null', '{"sessions":"x"}', JSON.stringify({ sessions: [{ id: 'z1', kind: 'jury', phase: 'done' }, { id: 'z2', kind: 'solo' }, { id: 'z3' }, null].filter(Boolean), customSubjects: [{ id: 'old' }] })]) {
    await seed(page, null, raw);
    for (const h of ['#/', '#/historique', '#/entretien/new']) {
      await open(page, h);
      assert(await page.$('.route .screen'), `${h} s’affiche avec ${raw.slice(0, 20)}`);
    }
    assert(!(await page.$('.ex-hrow')), 'aucune ligne pour les anciens types');
  }
  // Séance « job » incomplète (champs manquants) : réparée à l'ouverture.
  await seed(page, [{ id: 'ex-bad', kind: 'job', createdAt: new Date().toISOString() }]);
  await open(page, '#/historique');
  assert(await page.locator('.ex-hrow').count() === 1, 'séance incomplète listée');
  await open(page, '#/entretien/ex-bad');
  await page.waitForSelector('.ex-call [data-b="live"]');
  assert(errors.length === before, 'aucune erreur JS : ' + JSON.stringify(errors.slice(before)));
  await ctx.close();
});

await test('anciennes adresses : page introuvable, pas de plantage, retour à l’accueil', async () => {
  const { ctx, page } = await makePage();
  const before = errors.length;
  for (const h of ['#/fiches', '#/eleve', '#/oral/new', '#/oral/ex-123', '#/appel', '#/appel/ex-abc', '#/fiche/x']) {
    await open(page, h);
    await page.waitForSelector('.route .empty-page');
    assert(/Page introuvable/.test(await page.textContent('.route')), 'message pour ' + h);
    assert(JSON.stringify(await tabsOf(page)) === '["home","historique","settings"]', 'onglets intacts pour ' + h);
  }
  await page.click('.route .empty-page [data-go="#/"]');
  await page.waitForSelector('.ex-home');
  assert(errors.length === before, 'aucune erreur JS : ' + JSON.stringify(errors.slice(before)));
  await ctx.close();
});

await test('téléphone : accueil, départ, entretien et historique tiennent dans l’écran', async () => {
  const { ctx, page } = await makePage(MOBILE);
  await seed(page, [job({ id: 'ex-m1', answers: [{ id: 'a-1', question: 'Pourquoi ce poste ?', text: 'Parce que mon parcours correspond.', lines: [{ en: 'Parce que mon parcours correspond.' }], keyWords: ['parcours'], at: new Date().toISOString() }] })]);
  for (const h of ['#/', '#/entretien/new', '#/entretien/ex-m1', '#/historique']) {
    await open(page, h);
    await sleep(200);
    assert((await overflowX(page)) <= 0, `pas de défilement horizontal sur ${h} : ${await overflowX(page)} px`);
  }
  await open(page, '#/entretien/ex-m1');
  assert(!(await page.$('[data-b="live"] [data-act="float"]')), 'pas de fenêtre flottante sur téléphone');
  await ctx.close();
});

await browser.close();
srv.server.close();

const failed = results.filter((r) => !r.ok);
const errs = errors.filter((e) => !/Failed to load resource|net::ERR/.test(e.msg));
if (errs.length) {
  console.log(`\n  Erreurs JavaScript (${errs.length}) :`);
  errs.slice(0, 15).forEach((e) => console.log(`    [${e.test}] ${e.msg.slice(0, 300)}`));
}
console.log(`\n${results.length - failed.length} réussi(s), ${failed.length} échec(s), ${errs.length} erreur(s) JS — ${((Date.now() - T0) / 1000).toFixed(0)} s.`);
process.exit(failed.length || errs.length ? 1 : 0);
