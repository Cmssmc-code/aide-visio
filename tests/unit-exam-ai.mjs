import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UTIL = path.join(ROOT, 'src', 'js', 'util.js');
const AI = path.join(ROOT, 'src', 'js', 'ai.js');
const EXAM_AI = path.join(ROOT, 'src', 'js', 'exam-ai.js');

function memStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() };
}

const abortError = () => { const e = new Error('Requête annulée.'); e.name = 'AbortError'; e.code = 'ABORTED'; return e; };

function makeEnv({ key = true, replies = [] } = {}) {
  const env = { calls: [], replies: replies.slice() };
  const ctx = {
    console, setTimeout, clearTimeout, AbortController, TextEncoder, TextDecoder, performance, structuredClone,
    localStorage: memStorage(), navigator: { onLine: true, language: 'fr-FR' }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(UTIL, 'utf8'), ctx, { filename: 'util.js' });
  ctx.AideVisio.store = { settings: () => ({ provider: 'auto', models: {} }) };
  vm.runInContext(fs.readFileSync(AI, 'utf8'), ctx, { filename: 'ai.js' });
  const S = ctx.AideVisio;
  S.ai.hasKey = () => key;
  S.ai.generate = async (opts) => {
    env.calls.push(opts);
    if (opts.signal && opts.signal.aborted) throw abortError();
    let r = env.replies.length ? env.replies.shift() : '';
    if (typeof r === 'function') r = r(opts);
    if (r instanceof Error) throw r;
    const text = typeof r === 'string' ? r : JSON.stringify(r);
    if (opts.stream && typeof opts.onDelta === 'function') {
      for (let i = 1; i <= text.length; i++) {
        await null;
        if (opts.signal && opts.signal.aborted) throw abortError();
        opts.onDelta(text.slice(0, i));
      }
    }
    const out = { text, provider: 'mock', model: 'mock-1', ms: 1 };
    if (opts.json) { const p = S.ai.parseJson(text); out.data = p ? p.data : null; }
    return out;
  };
  vm.runInContext(fs.readFileSync(EXAM_AI, 'utf8'), ctx, { filename: 'exam-ai.js' });
  env.S = S;
  env.x = wrapPlain(S.examAI);
  return env;
}

const plain = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
function wrapPlain(api) {
  const out = {};
  for (const k of Object.keys(api)) {
    const f = api[k];
    out[k] = typeof f === 'function' ? (...a) => { const r = f(...a); return r && typeof r.then === 'function' ? r.then(plain) : (typeof r === 'object' ? plain(r) : r); } : f;
  }
  return out;
}

const DOSSIER = [
  'Poste : Contrôleur de gestion — Association Exemple',
  'Pitch : dix ans de gestion budgétaire en association, suivi de bailleurs institutionnels, reporting mensuel.',
  'Salaire : ne pas donner de chiffre, renvoyer à la grille de l\'association.'
].join('\n');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const split = (env, t) => plain(env.S.examAI._internal.splitJob(t));

// ---------- isRecruiterQuestion ----------
test('isRecruiterQuestion : questions françaises avec « ? »', () => {
  const { x } = makeEnv();
  for (const q of [
    'Pouvez-vous vous présenter ?', 'Pourquoi ce poste ?', 'Quelle est votre plus grande qualité ?',
    'Vous connaissez notre structure ?', 'Et côté audit ?', 'Un exemple ?', 'Combien de bailleurs gériez-vous ?',
    'Bonjour. Vous avez de l’expérience avec les bailleurs ?'
  ]) assert.equal(x.isRecruiterQuestion(q), true, q);
});

test('isRecruiterQuestion : questions françaises sans « ? » (transcription)', () => {
  const { x } = makeEnv();
  for (const q of [
    'Pouvez-vous vous présenter', 'Parlez-moi de votre parcours', 'Pourquoi avez-vous quitté votre dernier poste',
    'Racontez-nous une situation difficile', 'Comment gérez-vous les délais', 'Quelles sont vos prétentions salariales',
    'Est-ce que vous avez des questions', 'Présentez-vous', 'Je voudrais savoir pourquoi vous postulez',
    'Quel est votre niveau de disponibilité', 'Bonjour merci d’être là. Parlez-moi de vous'
  ]) assert.equal(x.isRecruiterQuestion(q), true, q);
});

test('isRecruiterQuestion : salutations, tests de son, remerciements = pas une question', () => {
  const { x } = makeEnv();
  for (const q of [
    '', '   ', null, undefined, 'Bonjour', 'Bonjour, merci', 'Merci beaucoup.', 'D’accord', 'Très bien',
    'Vous m’entendez ?', 'Vous me voyez bien ?', 'Est-ce que vous m’entendez ?', 'Oui', 'Non.', 'C’est noté',
    'Alors nous sommes une association de vingt personnes.', 'Voilà. Très bien. Parfait.'
  ]) assert.equal(x.isRecruiterQuestion(q), false, String(q));
});

test('isRecruiterQuestion : une question après une salutation reste une question', () => {
  const { x } = makeEnv();
  assert.equal(x.isRecruiterQuestion('Bonjour. Vous m’entendez ? Alors, pourquoi ce poste ?'), true);
  assert.equal(x.isRecruiterQuestion('Merci. Parlez-moi de vous'), true);
});

test('isRecruiterQuestion : interrogatif au milieu d’une phrase affirmative = pas une question', () => {
  const { x } = makeEnv();
  for (const q of [
    'Je vais vous expliquer comment va se dérouler l’entretien', 'C’est pourquoi le poste est ouvert', 'Nous avons un commentaire sur votre CV',
    'Voici combien de personnes travaillent ici', 'Je ne sais pas est-ce que cela vous convient'
  ]) assert.equal(x.isRecruiterQuestion(q), false, q);
  for (const q of ['Et comment gérez-vous les délais', 'Alors pourquoi ce poste', 'D’accord, combien de bailleurs', 'Mais est-ce que vous avez géré un audit']) assert.equal(x.isRecruiterQuestion(q), true, q);
});

test('isRecruiterQuestion : interrogatif en fin de phrase et formes sans « ? »', () => {
  const { x } = makeEnv();
  for (const q of [
    'Vous êtes disponible quand', 'Vous venez d’où', 'À quoi ressemble votre quotidien', 'Lesquels avez-vous utilisés', 'Depuis quand travaillez-vous là-dessus',
    'Dans quels logiciels travaillez-vous', 'Avec qui travailliez-vous', 'Voilà pour le poste. Je vous écoute', 'Parlez-moi de vous', 'Parlez moi de vous.', 'Présentez-vous'
  ]) assert.equal(x.isRecruiterQuestion(q), true, q);
});

test('isRecruiterQuestion : tests de son avec préfixe = pas une question', () => {
  const { x } = makeEnv();
  for (const q of ['Dites, vous m’entendez', 'Vous m’entendez là', 'Allô, vous m’entendez ?', 'Bonjour, vous me voyez bien', 'Vous m’entendez bien']) assert.equal(x.isRecruiterQuestion(q), false, q);
});

// ---------- splitJob ----------
test('splitJob : une phrase par ligne et ligne « Repères »', () => {
  const env = makeEnv();
  const p = split(env, 'Je suis contrôleur de gestion depuis dix ans.\nJ’ai suivi des bailleurs institutionnels.\nRepères: dix ans; bailleurs; reporting');
  assert.deepEqual(p.lines.map(l => l.en), ['Je suis contrôleur de gestion depuis dix ans.', 'J’ai suivi des bailleurs institutionnels.']);
  assert.ok(p.lines.every(l => l.fr === ''));
  assert.equal(p.text, 'Je suis contrôleur de gestion depuis dix ans. J’ai suivi des bailleurs institutionnels.');
  assert.deepEqual(p.keyWords, ['dix ans', 'bailleurs', 'reporting']);
});

test('splitJob : plusieurs phrases sur une même ligne = une ligne par phrase', () => {
  const p = split(makeEnv(), 'Oui, bien sûr. Je le fais chaque mois ! Et vous ?');
  assert.deepEqual(p.lines.map(l => l.en), ['Oui, bien sûr.', 'Je le fais chaque mois !', 'Et vous ?']);
});

test('splitJob : flux partiel avec étiquette incomplète masquée', () => {
  const env = makeEnv();
  for (const tail of ['R', 'Rep', 'Repè', 'Repères', 'Repères:', '- **Repères', '**Repères**']) {
    const p = split(env, 'Première phrase.\n' + tail);
    assert.equal(p.text, 'Première phrase.', 'fin « ' + tail + ' »');
    assert.deepEqual(p.keyWords, []);
  }
  // Une vraie ligne qui commence par autre chose n'est pas retirée.
  assert.equal(split(env, 'Première phrase.\nRetour sur le budget').text, 'Première phrase. Retour sur le budget');
  // Repères en cours de flux : les repères déjà écrits sont lus.
  assert.deepEqual(split(env, 'Phrase.\nRepères: a; b').keyWords, ['a', 'b']);
});

test('splitJob : markdown, puces, numéros, guillemets et préfixes retirés', () => {
  const env = makeEnv();
  const p = split(env, '- **Je connais** bien ce poste.\n2. Je gère le budget.\n• « Je suis disponible en janvier. »\nRéponse proposée : "Merci de votre question."\nRepères: **Janvier**; "Poste"; janvier');
  assert.deepEqual(p.lines.map(l => l.en), ['Je connais bien ce poste.', 'Je gère le budget.', 'Je suis disponible en janvier.', 'Merci de votre question.']);
  assert.deepEqual(p.keyWords, ['Janvier', 'Poste'], 'repères nettoyés, sans doublon');
});

test('splitJob : repères limités à 4, longs ignorés ; vide', () => {
  const env = makeEnv();
  const long = 'x'.repeat(70);
  assert.deepEqual(split(env, 'Ok.\nRepères: a; b; c; d; e; f').keyWords, ['a', 'b', 'c', 'd']);
  assert.deepEqual(split(env, 'Ok.\nRepères: ' + long + '; court').keyWords, ['court']);
  assert.deepEqual(split(env, ''), { text: '', lines: [], keyWords: [] });
  assert.equal(split(env, '—').text, '—');
});

test('splitJob : pas de coupure après une abréviation ; repères avec virgule ou tiret', () => {
  const env = makeEnv();
  assert.deepEqual(split(env, 'J’ai travaillé avec M. Dupont et Mme. Martin. Puis env. 5 ans chez Exemple. Voir cf. Annexe.').lines.map(l => l.en),
    ['J’ai travaillé avec M. Dupont et Mme. Martin.', 'Puis env. 5 ans chez Exemple.', 'Voir cf. Annexe.']);
  assert.deepEqual(split(env, 'Ok.\nRepères: dix ans, bailleurs, audit').keyWords, ['dix ans', 'bailleurs', 'audit']);
  assert.deepEqual(split(env, 'Ok.\nRepères: a, b; c').keyWords, ['a, b', 'c'], 'avec « ; », la virgule ne sépare pas');
  const d = split(env, 'Ok.\nRepères - dix ans; audit');
  assert.deepEqual(d.keyWords, ['dix ans', 'audit']);
  assert.equal(d.text, 'Ok.');
  assert.equal(split(env, 'Ok.\nRepères –').text, 'Ok.');
});

test('splitJob : puces « – » et « — » retirées, « — » seul conservé', () => {
  const env = makeEnv();
  assert.deepEqual(split(env, '– Première idée.\n— Deuxième idée.').lines.map(l => l.en), ['Première idée.', 'Deuxième idée.']);
  assert.equal(split(env, '— ').text, '—');
});

// ---------- jobAnswer ----------
const ANSWER = 'Je suis contrôleur de gestion depuis dix ans.\nJ’ai suivi des bailleurs institutionnels.\nRepères: dix ans; bailleurs';

test('jobAnswer : prompt avec dossier, question, échange récent', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  const turns = [{ who: 'jury', text: 'Bonjour, merci d’être là.' }, { who: 'student', text: 'Bonjour.' }, { who: 'jury', text: 'Pouvez-vous vous présenter ?' }];
  const r = await env.x.jobAnswer({ dossier: DOSSIER, question: 'Pouvez-vous vous présenter ?', turns });
  assert.equal(r.skip, false);
  assert.equal(r.text, 'Je suis contrôleur de gestion depuis dix ans. J’ai suivi des bailleurs institutionnels.');
  assert.deepEqual(r.keyWords, ['dix ans', 'bailleurs']);
  assert.equal(r.lines.length, 2);
  assert.equal(env.calls.length, 1);
  const c = env.calls[0];
  assert.equal(c.purpose, 'live');
  assert.equal(c.stream, true);
  assert.ok(c.prompt.includes('Contrôleur de gestion — Association Exemple'), 'dossier dans le prompt');
  assert.ok(c.prompt.includes('PAROLES DU RECRUTEUR À L\'INSTANT (transcription automatique) : Pouvez-vous vous présenter ?'));
  assert.ok(c.prompt.includes('RECRUTEUR : Bonjour, merci d’être là.') && c.prompt.includes('CANDIDAT : Bonjour.'));
  assert.equal((c.prompt.match(/Pouvez-vous vous présenter \?/g) || []).length, 1, 'la question en cours n’est pas répétée dans l’échange');
  assert.ok(/3 à 4 phrases, 75 mots/.test(c.prompt) && !/75 mots/.test(c.system), 'taille dans le prompt, pas dans le système');
  assert.ok(/écris exactement « — »/.test(c.prompt) && !/écris exactement « — »/.test(c.system), 'consigne de saut dans le prompt');
  assert.ok(!/anglais/i.test(c.system), 'plus de consigne anglais');
});

test('jobAnswer : sans dossier, le prompt le dit', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  await env.x.jobAnswer({ dossier: '', question: 'Pourquoi ce poste ?' });
  assert.ok(/aucun document importé/.test(env.calls[0].prompt));
  assert.ok(!/DOSSIER DU CANDIDAT \(fiche/.test(env.calls[0].prompt));
});

test('jobAnswer : dossier tronqué à jobDossierMax', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  const max = env.x.jobDossierMax;
  assert.equal(typeof max, 'number');
  assert.ok(max > 1000);
  await env.x.jobAnswer({ dossier: 'A'.repeat(max) + 'FIN_PERDUE', question: 'Pourquoi ?' });
  const p = env.calls[0].prompt;
  assert.ok(p.includes('A'.repeat(max)));
  assert.ok(!p.includes('FIN_PERDUE'));
});

test('jobAnswer : une vraie réponse courte qui commence par « — » n’est pas un saut', async () => {
  const env = makeEnv({ replies: ['— Oui, bien sûr.\nRepères: oui', '—.', '–––'] });
  const r = await env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ce poste ?' });
  assert.equal(r.skip, false);
  assert.equal(r.text, 'Oui, bien sûr.');
  assert.equal((await env.x.jobAnswer({ dossier: DOSSIER, question: 'Bonjour' })).skip, true);
  assert.equal((await env.x.jobAnswer({ dossier: DOSSIER, question: 'Bonjour' })).skip, true);
});

test('jobAnswer : dossier coupé au dernier saut de ligne', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  const max = env.x.jobDossierMax;
  assert.equal(max, 30000);
  const ligne = 'Une phrase complète du dossier.';
  const dossier = (ligne + '\n').repeat(Math.ceil(max / (ligne.length + 1)) + 20);
  await env.x.jobAnswer({ dossier, question: 'Pourquoi ?' });
  const p = env.calls[0].prompt;
  const body = p.slice(p.indexOf('\n') + 1, p.indexOf('\nPAROLES'));
  assert.ok(body.length <= max);
  assert.ok(body.endsWith(ligne), 'finit sur une ligne entière');
  assert.ok(body.length > max - 100);
});

test('jobAnswer : question longue, on garde la fin', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'DEBUT ' + 'blabla '.repeat(400) + 'Pourquoi ce poste ?' });
  const p = env.calls[0].prompt;
  assert.ok(p.includes(': … ') && p.endsWith('Écris maintenant') === false);
  assert.ok(p.includes('Pourquoi ce poste ?'));
  assert.ok(!p.includes('DEBUT'));
});

test('jobAnswer : tours « mixed » étiquetés, phrase de prudence seulement s’il y en a', async () => {
  const env = makeEnv({ replies: [ANSWER, ANSWER] });
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?', turns: [{ who: 'mixed', text: 'Je parle de Lyon.' }, { who: 'student', text: 'Oui.' }] });
  assert.ok(env.calls[0].prompt.includes('VOIX NON IDENTIFIÉE : Je parle de Lyon.'));
  assert.ok(/ne présume pas qui a dit/.test(env.calls[0].prompt));
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?', turns: [{ who: 'student', text: 'Oui.' }] });
  assert.ok(!/NON IDENTIFIÉE/.test(env.calls[1].prompt));
});

test('jobAnswer : dernier tour du recruteur déjà dans la question malgré la ponctuation', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  const turns = [{ who: 'student', text: 'Bonjour.' }, { who: 'jury', text: 'Pouvez vous vous présenter' }];
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Bonjour, pouvez-vous vous présenter ?', turns });
  const p = env.calls[0].prompt;
  assert.ok(!p.includes('RECRUTEUR : Pouvez vous vous présenter'), 'tour retiré de l’échange');
  assert.ok(p.includes('CANDIDAT : Bonjour.'));
});

test('jobAnswer : « — » → skip, et la consigne de saut disparaît avec force', async () => {
  const env = makeEnv({ replies: ['—', '—'] });
  const r = await env.x.jobAnswer({ dossier: DOSSIER, question: 'Bonjour à tous.' });
  assert.deepEqual(r, { text: '', keyWords: [], skip: true });
  const r2 = await env.x.jobAnswer({ dossier: DOSSIER, question: 'Bonjour à tous.', force: true });
  assert.equal(r2.skip, true, 'le modèle peut quand même répondre « — » : l’appelant décide');
  assert.ok(!/écris exactement « — »/.test(env.calls[1].prompt), 'force : plus de consigne de saut');
  assert.ok(/écris exactement « — »/.test(env.calls[0].prompt));
  assert.equal(env.calls[0].system, env.calls[1].system, 'système identique avec ou sans force');
});

test('jobAnswer : shorter → 2 phrases, réponse précédente rappelée', async () => {
  const env = makeEnv({ replies: [ANSWER, ANSWER] });
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Présentez-vous', shorter: true, previous: 'Ma réponse longue précédente.' });
  let c = env.calls[0];
  assert.ok(/2 phrases, 35 mots/.test(c.prompt));
  assert.ok(c.prompt.includes('RÉPONSE PROPOSÉE JUSTE AVANT') && c.prompt.includes('Ma réponse longue précédente.'));
  assert.ok(c.temperature < 0.4);
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Présentez-vous', previous: 'Ignorée.' });
  const c2 = env.calls[1];
  assert.ok(!c2.prompt.includes('Ignorée.'), 'previous ignoré sans shorter');
  assert.equal(c.system, c2.system, 'système identique, shorter ou non');
});

test('jobAnswer : onDelta reçoit le texte progressif et les lignes', async () => {
  const env = makeEnv({ replies: [ANSWER] });
  const seen = [];
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?', onDelta: (t, info) => seen.push({ t, lines: info.lines.length }) });
  assert.ok(seen.length >= 3, 'plusieurs morceaux : ' + seen.length);
  assert.ok(seen.every((s, i) => i === 0 || s.t !== seen[i - 1].t), 'pas deux fois le même texte');
  assert.ok(seen.every(s => !/Repères/i.test(s.t)), 'les repères ne fuient pas dans le texte affiché');
  assert.equal(seen[seen.length - 1].lines, 2);
});

test('jobAnswer : onDelta muet pour « — » et qui plante sans casser', async () => {
  const env = makeEnv({ replies: ['—', ANSWER] });
  let n = 0;
  await env.x.jobAnswer({ dossier: DOSSIER, question: 'Bonjour', onDelta: () => { n++; } });
  assert.equal(n, 0);
  const r = await env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?', onDelta: () => { throw new Error('boum'); } });
  assert.equal(r.skip, false);
});

test('jobAnswer : erreurs NO_QUESTION, NO_KEY, EMPTY', async () => {
  const env = makeEnv({ replies: ['   ', 'Repères: a; b'] });
  await assert.rejects(env.x.jobAnswer({ dossier: DOSSIER, question: '  ' }), e => e.code === 'NO_QUESTION');
  await assert.rejects(env.x.jobAnswer({ dossier: DOSSIER }), e => e.code === 'NO_QUESTION');
  assert.equal(env.calls.length, 0);
  await assert.rejects(env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?' }), e => e.code === 'EMPTY');
  await assert.rejects(env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?' }), e => e.code === 'EMPTY');
  const nokey = makeEnv({ key: false });
  await assert.rejects(nokey.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?' }), e => e.code === 'NO_KEY' && /clé/i.test(e.message));
  assert.equal(nokey.calls.length, 0);
});

test('jobAnswer : erreur du fournisseur transmise', async () => {
  const bad = Object.assign(new Error('Clé Gemini refusée.'), { code: 'KEY' });
  const env = makeEnv({ replies: [bad] });
  await assert.rejects(env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?' }), e => e.code === 'KEY');
});

test('jobAnswer : abandon par signal', async () => {
  const env = makeEnv({ replies: [ANSWER, ANSWER] });
  const pre = new AbortController();
  pre.abort();
  await assert.rejects(env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?', signal: pre.signal }), e => e.name === 'AbortError');
  assert.equal(env.calls.length, 0, 'aucun appel si déjà annulé');
  const ctl = new AbortController();
  let deltas = 0;
  const pr = env.x.jobAnswer({ dossier: DOSSIER, question: 'Pourquoi ?', signal: ctl.signal, onDelta: () => { deltas++; if (deltas === 3) ctl.abort(); } });
  await assert.rejects(pr, e => e.name === 'AbortError' && e.code === 'ABORTED');
  assert.equal(deltas, 3, 'plus de morceaux après l’abandon');
});

const PER_TEST_MS = 10000;
let pass = 0;
let fail = 0;
for (const t of tests) {
  try {
    await Promise.race([t.fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), PER_TEST_MS).unref())]);
    console.log('  ✓ ' + t.name);
    pass++;
  } catch (e) {
    console.log('  ✗ ' + t.name + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n      '));
    fail++;
  }
}
console.log('\nS.examAI : ' + pass + ' réussi(s), ' + fail + ' échoué(s)');
process.exit(fail ? 1 : 0);
