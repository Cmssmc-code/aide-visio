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

const para = (n) => 'Investors have poured billions into artificial intelligence over the past two years, betting that the technology will transform productivity across every sector of the economy and justify valuations that now look stretched by any historical standard ' + n + '.';
const SUBJECT = {
  id: 's1', theme: 1, themeTitle: 'Finance', title: 'Is the AI boom a bubble?', source: 'Practice text', date: 'October 2026',
  question: 'To what extent should investors worry about an AI bubble?',
  paragraphs: [para(1), para(2), para(3), para(4), para(5)],
  glossary: [{ en: 'stretched', fr: 'tendu' }],
  corrige: {
    summary: ['Huge investment', 'Valuations high'], problematic: 'Is it a bubble?', plan: [{ title: 'Signs of a bubble', points: ['P/E'] }],
    juryQuestions: [{ en: 'What is a speculative bubble?', fr: 'Qu\'est-ce qu\'une bulle spéculative ?' }, { en: 'Which companies are the Magnificent 7?', fr: 'Quelles sont les 7 magnifiques ?' }]
  }
};

const genSubjectReply = {
  theme: '4', title: 'Cloud giants tighten their grip', date: 'September 2026', question: 'Should European firms fear their dependence on US cloud providers?',
  paragraphs: [para('a'), para('b'), para('c'), para('d'), para('e'), para('f')],
  glossary: [{ en: 'grip', fr: 'emprise' }, 'lock-in — dépendance'],
  corrige: {
    topic: 'Cloud dependence', tone: 'Critical', summary: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], problematic: 'p',
    plan: [{ title: 'Risks', points: ['x', 'y'] }, { title: 'Alternatives', ideas: ['z'] }, { title: 'Third' }, { title: 'Fourth' }],
    news: ['n1'], juryQuestions: ['Why? — Pourquoi ?', { question: 'What is lock-in?', fr: 'Qu\'est-ce que le verrouillage ?' }],
    keyVocab: ['cloud — nuage', { en: 'vendor', fr: 'fournisseur' }]
  }
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('ready() suit S.ai.hasKey', () => {
  assert.equal(makeEnv({ key: true }).x.ready(), true);
  assert.equal(makeEnv({ key: false }).x.ready(), false);
});

test('generateSubject : schéma normalisé, purpose prep, json', async () => {
  const env = makeEnv({ replies: ['```json\n' + JSON.stringify(genSubjectReply) + '\n```'] });
  const s = await env.x.generateSubject({ theme: 4, topic: 'cloud sovereignty' });
  assert.equal(env.calls[0].purpose, 'prep');
  assert.equal(env.calls[0].json, true);
  assert.match(env.calls[0].prompt, /cloud sovereignty/);
  assert.match(s.id, /^ai-/);
  assert.equal(s.theme, 4);
  assert.equal(s.themeTitle, 'Information systems & new technologies');
  assert.equal(s.source, 'Practice text generated by AI');
  assert.equal(s.paragraphs.length, 6);
  assert.deepEqual(s.glossary[1], { en: 'lock-in', fr: 'dépendance' });
  assert.equal(s.corrige.summary.length, 6, 'summary plafonné à 6');
  assert.equal(s.corrige.plan.length, 3, 'plan plafonné à 3 axes');
  assert.deepEqual(s.corrige.plan[1].points, ['z']);
  assert.deepEqual(s.corrige.juryQuestions[0], { en: 'Why?', fr: 'Pourquoi ?' });
  assert.equal(s.corrige.juryQuestions[1].en, 'What is lock-in?');
  assert.deepEqual(s.corrige.keyVocab, ['cloud — nuage', 'vendor — fournisseur']);
});

test('generateSubject : sortie illisible → 2e tentative, puis erreur PARSE en français', async () => {
  const env = makeEnv({ replies: ['pas du json', genSubjectReply] });
  const s = await env.x.generateSubject({ theme: null });
  assert.equal(env.calls.length, 2);
  assert.ok(s.theme >= 1 && s.theme <= 7);
  const env2 = makeEnv({ replies: ['nope', { title: 'x', paragraphs: ['trop court'] }] });
  await assert.rejects(env2.x.generateSubject({ theme: 2 }), e => e.code === 'PARSE' && /illisible/.test(e.message));
});

test('sans clé : erreur NO_KEY lisible ; erreurs IA propagées', async () => {
  const env = makeEnv({ key: false });
  await assert.rejects(env.x.generateSubject({ theme: 1 }), e => e.code === 'NO_KEY' && /clé/.test(e.message));
  const err = new Error('Quota Gemini atteint (429).'); err.code = 'QUOTA';
  const env2 = makeEnv({ replies: [err] });
  await assert.rejects(env2.x.evaluate({ subject: SUBJECT, expose: 'x' }), e => e.code === 'QUOTA');
});

test('signal déjà annulé → AbortError', async () => {
  const env = makeEnv({ replies: [genSubjectReply] });
  const ac = new AbortController(); ac.abort();
  await assert.rejects(env.x.generateSubject({ theme: 1, signal: ac.signal }), e => e.name === 'AbortError');
  await assert.rejects(env.x.juryQuestion({ subject: SUBJECT, signal: ac.signal }), e => e.name === 'AbortError');
  assert.equal(env.calls.length, 0);
});

test('subjectFromText : texte original gardé, en-têtes retirés, question détectée', async () => {
  const text = 'Is the AI boom a bubble?\n\nThe Economist, 12 March 2026\n\n' + [1, 2, 3, 4].map(para).join('\n\n') + '\n\nQuestion: Should investors be worried?';
  const env = makeEnv({ replies: [{ headerBlocks: [0, 1], title: 'Is the AI boom a bubble?', source: 'The Economist', date: '12 March 2026', question: 'ignored', theme: 1, corrige: { summary: ['s1'] } }] });
  const s = await env.x.subjectFromText(text);
  assert.equal(s.paragraphs.length, 4);
  assert.equal(s.paragraphs[0], para(1), 'paragraphe original intact');
  assert.equal(s.question, 'Should investors be worried?');
  assert.equal(s.questionProposed, false);
  assert.equal(s.source, 'The Economist');
  assert.equal(s.theme, 1);
  assert.match(env.calls[0].prompt, /\[2\] Investors/);
});

test('subjectFromText : texte trop court, et garde-fou si l\'IA retire tout', async () => {
  const env = makeEnv();
  await assert.rejects(env.x.subjectFromText('trop court'), e => e.code === 'TOO_SHORT');
  const text = [1, 2, 3].map(para).join('\n\n');
  const env2 = makeEnv({ replies: [{ headerBlocks: [0, 1, 2], title: 'T', question: 'Q proposed?', corrige: {} }] });
  const s = await env2.x.subjectFromText(text);
  assert.equal(s.paragraphs.length, 3);
  assert.equal(s.questionProposed, false);
  const env3 = makeEnv({ replies: [{ headerBlocks: [], title: 'T', question: 'Q proposed?', questionProposed: true, corrige: {} }] });
  assert.equal((await env3.x.subjectFromText(text)).questionProposed, true);
});

test('subjectFromText : PDF sans lignes vides découpé en paragraphes', () => {
  const env = makeEnv();
  const blocks = env.x._internal.splitImported('First paragraph line one\ncontinues here.\nSecond paragraph starts.\nThird one here.');
  assert.ok(blocks.length >= 2);
});

test('liveNotes : purpose fast, sortie courte, fautes connues filtrées', async () => {
  const env = makeEnv({ replies: [{ covered: { intro: true, source: 'yes', tone: false, summary: 1 }, errors: [{ said: 'the author explain', better: 'the author explains', rule: '-s 3e personne' }, { said: 'he go', better: 'he goes', rule: 'x' }, { said: 'same', better: 'same' }], tips: ['Synthèse en cours', 'b', 'c', 'd'] }] });
  const r = await env.x.liveNotes({ subject: SUBJECT, transcript: [{ t: 0, text: 'Today I am going to present an article published in The Economist.' }, { t: 1, text: 'The author explain that he go.' }], elapsedMs: 120000, knownErrors: [{ said: 'he go', better: 'he goes' }] });
  assert.equal(env.calls[0].purpose, 'fast');
  assert.ok(env.calls[0].maxTokens <= 800);
  assert.match(env.calls[0].prompt, /LATEST PASSAGE/);
  assert.equal(r.covered.intro, true);
  assert.equal(r.covered.source, true);
  assert.equal(r.covered.summary, true);
  assert.equal(r.covered.tone, false);
  assert.equal(typeof r.covered.conclusion, 'boolean');
  assert.deepEqual(r.errors.map(e => e.said), ['the author explain']);
  assert.equal(r.tips.length, 3);
});

test('liveNotes : sans clé ou réponse illisible → repérage local', async () => {
  const env = makeEnv({ key: false });
  const r = await env.x.liveNotes({ subject: SUBJECT, transcript: 'This article was published in the Financial Times. To conclude, the AI bubble is a risk.' });
  assert.equal(r.source, 'local');
  assert.equal(r.covered.source, true);
  assert.equal(r.covered.conclusion, true);
  assert.equal(r.covered.transition, false);
  const env2 = makeEnv({ replies: ['???'] });
  const r2 = await env2.x.liveNotes({ subject: SUBJECT, transcript: 'In conclusion this is a long enough transcript for the test.' });
  assert.equal(r2.source, 'local');
});

test('juryQuestion : ne répète pas asked, s\'appuie sur l\'exposé, relance si répétition', async () => {
  const env = makeEnv({ replies: [
    { en: 'What is a speculative bubble?', fr: 'x', why: 'w', expect: 'e' },
    { en: 'You said Nvidia is overvalued: what figures support that?', fr: 'Vous avez dit…', why: 'Approfondir', expect: 'Des chiffres' }
  ] });
  const q = await env.x.juryQuestion({ subject: SUBJECT, expose: 'I think Nvidia is overvalued.', interview: [{ who: 'jury', text: 'What is a speculative bubble?' }, { who: 'student', text: 'It is when prices go up.' }], asked: [{ en: 'What is a speculative bubble?' }], kind: 'deeper' });
  assert.equal(env.calls.length, 2);
  assert.match(env.calls[0].prompt, /Nvidia is overvalued/);
  assert.match(env.calls[0].prompt, /never repeat/);
  assert.match(env.calls[0].prompt, /go deeper/);
  assert.equal(q.source, 'ai');
  assert.match(q.en, /Nvidia/);
  assert.equal(q.expect, 'Des chiffres');
});

test('juryQuestion : repli sur la banque (sujet puis génériques) si IA en échec ou sans clé', async () => {
  const e = new Error('Aucun modèle IA n\'a répondu.'); e.code = 'ALL_FAILED';
  const env = makeEnv({ replies: [e] });
  const q = await env.x.juryQuestion({ subject: SUBJECT, asked: ['What is a speculative bubble?'] });
  assert.equal(q.source, 'bank');
  assert.equal(q.en, 'Which companies are the Magnificent 7?');
  const env2 = makeEnv({ key: false });
  const q2 = await env2.x.juryQuestion({ subject: SUBJECT, kind: 'news', asked: [] });
  assert.equal(q2.source, 'bank');
  assert.match(q2.en, /news|changed/);
});

test('answerFeedback : score borné, corrections normalisées', async () => {
  const env = makeEnv({ replies: [{ score: '14/10', good: 'Bonne idée\nBon exemple', fixes: [{ wrong: 'I am agree', right: 'I agree', why: 'agree est un verbe' }], better: 'I agree with the author because…' }] });
  const r = await env.x.answerFeedback({ subject: SUBJECT, question: { en: 'Do you agree?' }, answer: 'I am agree with the author.' });
  assert.equal(r.score, 10);
  assert.deepEqual(r.good, ['Bonne idée', 'Bon exemple']);
  assert.deepEqual(r.fixes, [{ said: 'I am agree', better: 'I agree', rule: 'agree est un verbe' }]);
  assert.match(r.better, /agree/);
  const r2 = await makeEnv().x.answerFeedback({ subject: SUBJECT, question: 'Q?', answer: '' });
  assert.equal(r2.empty, true);
});

const longExpose = Array.from({ length: 40 }, (_, i) => 'The author explains that investment in AI has grown a lot in sentence ' + i + '.').join(' ');
const evalReply = (scores) => ({
  criteria: [
    { id: 'synthesis', score: scores[0], comment: 'Synthèse fidèle.' },
    { id: 'structure', score: scores[1], comment: 'Plan clair.' },
    { id: 'commentary', score: scores[2], comment: 'Bons exemples.' },
    { id: 'interaction', score: scores[3], comment: 'Réactive.' },
    { id: 'language', score: scores[4], comment: 'Quelques fautes.' },
    { id: 'fluency', score: scores[5], comment: 'Fluide.' }
  ],
  strengths: ['Structure'], priorities: ['a', 'b', 'c', 'd'], errors: [{ said: 'peoples', better: 'people', rule: 'indénombrable' }],
  pronunciation: ['written — /ˈrɪtn/'], modelPlan: '# Intro\n- ...', message: 'Bravo Audrey !'
});

test('evaluate : total recalculé, scores bornés, grille fixe', async () => {
  const env = makeEnv({ replies: [evalReply([3.5, 3, 9, 2.5, 2, 1.5])] });
  const r = await env.x.evaluate({
    subject: SUBJECT, expose: [{ t: 0, text: longExpose }], interview: { turns: [{ who: 'jury', text: 'Why?' }, { who: 'student', text: 'Because valuations are very high.' }] },
    durations: { prepMs: 3600000, exposeMs: 14 * 60000, interviewMs: 15 * 60000 }, juryNotes: 'Bien', checklist: { summary: true, plan: true }
  });
  assert.equal(env.calls[0].purpose, 'prep');
  assert.match(env.calls[0].prompt, /15-17/);
  assert.match(env.calls[0].prompt, /summary: yes/);
  assert.deepEqual(r.criteria.map(c => c.id), ['synthesis', 'structure', 'commentary', 'interaction', 'language', 'fluency']);
  assert.equal(r.criteria[2].score, 4, 'commentaire borné à 4');
  assert.equal(r.total, 16.5);
  assert.equal(r.priorities.length, 3);
  assert.equal(r.errors[0].better, 'people');
  assert.equal(r.message, 'Bravo Audrey !');
  assert.match(r.criteria[0].label, /Synthèse/);
});

test('evaluate : exposé < 10 min pénalisé, entretien absent estimé', async () => {
  const env = makeEnv({ replies: [evalReply([4, 4, 4, 3, 3, 2])] });
  const r = await env.x.evaluate({ subject: SUBJECT, expose: longExpose, interview: [], durations: { exposeMs: 8 * 60000 } });
  const by = Object.fromEntries(r.criteria.map(c => [c.id, c]));
  assert.equal(by.fluency.score, 0.5);
  assert.match(by.fluency.comment, /10 minutes/);
  assert.equal(by.interaction.estimated, true);
  assert.ok(r.total <= 19);
  const env2 = makeEnv({ replies: [evalReply([4, 4, 4, 3, 3, 2])] });
  const r2 = await env2.x.evaluate({ subject: SUBJECT, expose: longExpose, interview: [{ who: 'student', text: 'I think so, yes indeed.' }], durations: { exposeMs: 3 * 60000 } });
  const by2 = Object.fromEntries(r2.criteria.map(c => [c.id, c]));
  assert.equal(by2.fluency.score, 0);
  assert.equal(by2.commentary.score, 1.5);
});

test('evaluate : critères en objet / barème différent ramené, réponse invalide → PARSE', async () => {
  const env = makeEnv({ replies: [{ criteria: { synthesis: { score: 8, max: 8 }, structure: 2, commentary: 2, interaction: 2, language: 2, fluency: 1 } }] });
  const r = await env.x.evaluate({ subject: SUBJECT, expose: longExpose, interview: [{ who: 'student', text: 'Yes I think it is right.' }], durations: { exposeMs: 15 * 60000 } });
  assert.equal(r.criteria[0].score, 4);
  assert.equal(r.total, 13);
  const env2 = makeEnv({ replies: [{ foo: 1 }, 'rien'] });
  await assert.rejects(env2.x.evaluate({ subject: SUBJECT, expose: longExpose }), e => e.code === 'PARSE');
});

test('evaluate : cases cochées par l\'IA ne lèvent pas le plafond « exposé quasi vide » ; modelPlan structuré', async () => {
  const checklist = { intro: true, source: true, tone: true };
  const base = { subject: SUBJECT, expose: 'Today I am going to present an article.', interview: [], durations: { exposeMs: 12 * 60000 }, checklist };
  const env = makeEnv({ replies: [evalReply([4, 4, 4, 3, 3, 2])] });
  const r = await env.x.evaluate(Object.assign({ checklistAuto: { intro: true, source: true, tone: true } }, base));
  assert.equal(r.criteria.find(c => c.id === 'synthesis').score, 1);
  const env2 = makeEnv({ replies: [evalReply([4, 4, 4, 3, 3, 2])] });
  const r2 = await env2.x.evaluate(base);
  assert.equal(r2.criteria.find(c => c.id === 'synthesis').score, 4);
  const reply = Object.assign(evalReply([4, 4, 4, 3, 3, 2]), { modelPlan: { introduction: 'Hook', parts: ['I', 'II'] } });
  const r3 = await makeEnv({ replies: [reply] }).x.evaluate(base);
  assert.equal(r3.modelPlan, '**introduction** : Hook\n\n**parts** : ["I","II"]');
});

test('answerFeedback : score absent → 2e tentative', async () => {
  const env = makeEnv({ replies: [{ good: ['Bonne idée'], better: 'I agree.' }, { score: 7, good: ['Bonne idée'], better: 'I agree.' }] });
  const r = await env.x.answerFeedback({ subject: SUBJECT, question: 'Do you agree?', answer: 'Yes I agree with it.' });
  assert.equal(env.calls.length, 2);
  assert.equal(r.score, 7);
});

test('generateSubject : le thème demandé prime sur celui de l\'IA', async () => {
  const s = await makeEnv({ replies: [genSubjectReply] }).x.generateSubject({ theme: 2 });
  assert.equal(s.theme, 2);
});

test('subjectFromText : question trouvée au-delà de 16 000 caractères', async () => {
  const many = Array.from({ length: 80 }, (_, i) => para(i)).join('\n\n');
  const text = many + '\n\nQuestion: Should investors be worried?';
  assert.ok(text.length > 16000);
  const env = makeEnv({ replies: [{ headerBlocks: [], title: 'T', question: 'other?', corrige: {} }] });
  const s = await env.x.subjectFromText(text);
  assert.equal(s.question, 'Should investors be worried?');
  assert.equal(s.questionProposed, false);
});

test('liveNotes : les fautes connues transmises sont les plus récentes', async () => {
  const known = Array.from({ length: 40 }, (_, i) => ({ said: 'err' + i, better: 'fix' + i }));
  const env = makeEnv({ replies: [{ covered: {}, errors: [], tips: [] }] });
  await env.x.liveNotes({ subject: SUBJECT, transcript: 'The author explain that he go to the market every day.', knownErrors: known });
  assert.match(env.calls[0].prompt, /err39/);
  assert.doesNotMatch(env.calls[0].prompt, /err0 /);
});

test('translate : texte nettoyé, sens fr/en', async () => {
  const env = makeEnv({ replies: ['Traduction : « Les investisseurs ont versé des milliards. »', 'Investors poured billions.'] });
  assert.equal(await env.x.translate('Investors poured billions.', { to: 'fr' }), 'Les investisseurs ont versé des milliards.');
  assert.match(env.calls[0].system, /anglais → français/);
  assert.equal(await env.x.translate('Les investisseurs…', { to: 'en' }), 'Investors poured billions.');
  assert.match(env.calls[1].system, /French → English/);
  assert.equal(await env.x.translate('  '), '');
});

test('isJuryQuestion : questions et demandes du jury reconnues', () => {
  const { x } = makeEnv();
  [
    'So, what do you think about tariffs?',
    'Tell us more about the author\'s point of view',
    'Could you elaborate on that',
    'In your opinion, is it a good thing',
    'Why?',
    'And the risks for European firms?',
    'What is the main idea of the article',
    'okay so now could you develop your second argument',
    'Explain why investors are worried about AI',
    'Give us a concrete example please',
    'According to you, who benefits from these tariffs',
    'Let’s talk about the second part of your plan',
    'Do you think the AI boom is a bubble',
    'Would you say the tone of the article is critical',
    'Have you ever worked with an ERP system',
    'Is it OK for companies to relocate their production',
    'Do you see it as a threat or an opportunity',
    'Thank you for your presentation. Now, which companies are the most exposed',
    'Can you hear me? What do you think about stablecoins?',
    'Good morning Audrey. Talk about your professional experience',
    '   wHAT   would   YOU   do   in   their   place   ',
    'thank you for your presentation now let\'s move on what do you think about the omnibus directive'
  ].forEach(t => assert.equal(x.isJuryQuestion(t), true, 'question attendue : ' + JSON.stringify(t)));
});

test('isJuryQuestion : vide, trop court, formules et vérifications de son exclues', () => {
  const { x } = makeEnv();
  [
    '', '   ', null, undefined,
    'Why',
    'OK',
    'Explain please',
    'Thank you very much',
    '  tHaNk   YoU  ',
    'Can you hear me?',
    'do you hear me',
    'Can you see my screen?',
    'Can you see it?',
    'Good morning!',
    'Good morning Audrey, can you hear me well?',
    'Is everything OK for you?',
    'Are you ready?',
    'You may start.',
    'you may begin when you are ready',
    'When you’re ready, you can start.',
    'Let’s start',
    'That’s all, thank you.',
    'Thank you. Can you hear me?',
    'The author explains that AI valuations are stretched.',
    'I think the author is right because valuations are very high.',
    'which means that European firms will suffer'
  ].forEach(t => assert.equal(x.isJuryQuestion(t), false, 'pas une question : ' + JSON.stringify(t)));
});

const LIVE_REPLY = 'I think tariffs mostly hurt consumers. First, firms pass the extra cost on to their prices. For example, after the 2025 US tariffs, many retailers raised their prices.\nKeywords: to pass on costs; trade war; supply chain';
const LIVE_TEXT = 'I think tariffs mostly hurt consumers. First, firms pass the extra cost on to their prices. For example, after the 2025 US tariffs, many retailers raised their prices.';
const TURNS = Array.from({ length: 12 }, (_, i) => ({ who: i % 2 ? 'student' : 'jury', text: 'marker-' + i + '-end' }));

test('liveAnswer : prompt (sujet, question d’examen, mots du jury), flux sans ligne Keywords, mots-clés', async () => {
  const env = makeEnv({ replies: [LIVE_REPLY] });
  const deltas = [];
  const r = await env.x.liveAnswer({ subject: SUBJECT, question: 'so what do you think about tariffs', expose: 'Today I am going to present an article about the AI bubble.', turns: TURNS, onDelta: t => deltas.push(t) });
  const c = env.calls[0];
  assert.equal(env.calls.length, 1);
  assert.equal(c.purpose, 'live');
  assert.equal(c.stream, true);
  assert.equal(c.temperature, 0.5);
  assert.equal(c.maxTokens, 800);
  assert.equal(c.timeoutMs, 15000);
  assert.equal(c.budgetMs, 30000);
  assert.match(c.prompt, /Is the AI boom a bubble\?/, 'titre du sujet');
  assert.match(c.prompt, /To what extent should investors worry about an AI bubble\?/, 'question d’examen');
  assert.match(c.prompt, /so what do you think about tariffs/, 'mots du jury');
  assert.match(c.prompt, /present an article about the AI bubble/, 'exposé');
  assert.match(c.prompt, /marker-6-end/);
  assert.match(c.prompt, /marker-11-end/);
  assert.doesNotMatch(c.prompt, /marker-[0-5]-end/, '6 derniers échanges seulement (contexte réduit)');
  assert.match(c.system, /Keywords: expression \(traduction française\)/, 'mots-clés avec traduction');
  assert.match(c.system, /TRAINING/);
  assert.match(c.system, /75 words/);
  assert.match(c.system, /exactly "—"/);
  assert.match(c.system, /Keywords:/);
  assert.equal(r.skip, false);
  assert.equal(r.text, LIVE_TEXT);
  assert.deepEqual(r.keyWords, ['to pass on costs', 'trade war', 'supply chain']);
  assert.ok(deltas.length > 20, 'réponse affichée au fil de l’eau');
  assert.ok(deltas.every(d => d && LIVE_TEXT.startsWith(d)), 'chaque morceau est un début de la réponse, sans « Keywords »');
  assert.equal(deltas[deltas.length - 1], LIVE_TEXT);
});

test('liveAnswer : réponse nettoyée (préambule, gras, guillemets) et mots-clés tolérants', async () => {
  const env = makeEnv({ replies: ['**Answer:** "I agree with the author to some extent."\n**Key words:** stretched valuations, to some extent, bubble'] });
  const r = await env.x.liveAnswer({ subject: SUBJECT, question: 'Do you agree with the author?' });
  assert.equal(r.text, 'I agree with the author to some extent.');
  assert.deepEqual(r.keyWords, ['stretched valuations', 'to some extent', 'bubble']);
  const split = plain(env.x._internal.splitLive('Firms will suffer.\nKeyw'));
  assert.deepEqual(split, { text: 'Firms will suffer.', keyWords: [], qFr: '', lines: [{ en: 'Firms will suffer.', fr: '' }] }, 'ligne « Keywords » en cours masquée');
  const fr = plain(env.x._internal.splitLive('Firms will suffer.\nKeywords: supply chain (chaîne d’approvisionnement); to pass on — répercuter; trade war = guerre commerciale; tariffs (droits de douane, taxes)'));
  assert.deepEqual(fr.keyWords, ['supply chain (chaîne d’approvisionnement)', 'to pass on (répercuter)', 'trade war (guerre commerciale)', 'tariffs (droits de douane, taxes)'], 'traduction FR de chaque mot-clé');
  const comma = plain(env.x._internal.splitLive('Yes.\nKeywords: tariffs (droits de douane, taxes), bubble (bulle)'));
  assert.deepEqual(comma.keyWords, ['tariffs (droits de douane, taxes)', 'bubble (bulle)'], 'virgules entre parenthèses conservées');
});

test('liveAnswer : « — » (pas une question) → skip, rien d’affiché', async () => {
  const env = makeEnv({ replies: ['—', ' – ', '-', '— (the jury is only greeting the candidate)'] });
  for (let i = 0; i < 4; i++) {
    const deltas = [];
    const r = await env.x.liveAnswer({ subject: SUBJECT, question: 'Good morning, can you hear me?', onDelta: t => deltas.push(t) });
    assert.deepEqual(r, { text: '', keyWords: [], skip: true });
    assert.equal(deltas.length, 0, 'aucun affichage pour un tiret');
  }
});

test('liveAnswer : « Plus court » change la consigne', async () => {
  const env = makeEnv({ replies: [LIVE_REPLY, 'Tariffs hurt consumers. Prices go up.'] });
  await env.x.liveAnswer({ subject: SUBJECT, question: 'What about tariffs?' });
  const r = await env.x.liveAnswer({ subject: SUBJECT, question: 'What about tariffs?', shorter: true });
  assert.match(env.calls[0].system, /75 words/);
  assert.doesNotMatch(env.calls[0].system, /40 words/);
  assert.match(env.calls[1].system, /2 short sentences, 40 words maximum/);
  assert.doesNotMatch(env.calls[1].system, /75 words/);
  assert.match(env.calls[1].prompt, /40 words maximum/);
  assert.equal(r.text, 'Tariffs hurt consumers. Prices go up.');
});

const BI_REPLY = [
  'Q-FR: Que pensez-vous des droits de douane ?',
  'EN: I think tariffs mostly hurt consumers.',
  'FR: Je pense que les droits de douane nuisent surtout aux consommateurs.',
  'EN: First, firms pass the extra cost on to their prices.',
  'FR: D’abord, les entreprises répercutent le surcoût sur leurs prix.',
  'Keywords: to pass on (répercuter); consumers (consommateurs)'
].join('\n');
const BI_TEXT = 'I think tariffs mostly hurt consumers. First, firms pass the extra cost on to their prices.';

test('liveAnswer : sous-titres bilingues (Q-FR, paires EN / FR, mots-clés) en flux', async () => {
  const env = makeEnv({ replies: [BI_REPLY] });
  const deltas = [];
  const r = await env.x.liveAnswer({ subject: SUBJECT, question: 'what about tariffs', onDelta: (t, info) => deltas.push({ t, info: plain(info) }) });
  const c = env.calls[0];
  assert.match(c.system, /Q-FR: /);
  assert.match(c.system, /EN: first sentence/);
  assert.match(c.system, /FR: its French translation/);
  assert.match(c.system, /no Q-FR line/);
  assert.equal(r.skip, false);
  assert.equal(r.text, BI_TEXT);
  assert.equal(r.qFr, 'Que pensez-vous des droits de douane ?');
  assert.deepEqual(plain(r.lines), [
    { en: 'I think tariffs mostly hurt consumers.', fr: 'Je pense que les droits de douane nuisent surtout aux consommateurs.' },
    { en: 'First, firms pass the extra cost on to their prices.', fr: 'D’abord, les entreprises répercutent le surcoût sur leurs prix.' }
  ]);
  assert.deepEqual(plain(r.keyWords), ['to pass on (répercuter)', 'consumers (consommateurs)']);
  // Flux : la traduction de la question arrive d'abord, puis les phrases ; jamais d'étiquette visible.
  assert.equal(deltas[0].t, '');
  assert.ok(deltas[0].info.qFr.length > 0, 'traduction de la question avant la réponse');
  assert.ok(deltas.every(d => !/(?:^|\s)(?:EN|FR|Q-FR|Keywords)\s*:/.test(d.t + ' ' + d.info.lines.map(l => l.en + ' ' + l.fr).join(' '))), 'aucune étiquette affichée');
  assert.ok(deltas.every(d => BI_TEXT.startsWith(d.t)), 'texte anglais toujours un début de la réponse');
  assert.ok(deltas.some(d => d.info.lines.length === 2 && d.info.lines[1].fr === ''), 'phrase anglaise affichée avant sa traduction');
  const last = deltas[deltas.length - 1];
  assert.equal(last.t, BI_TEXT);
  assert.equal(last.info.lines[1].fr, 'D’abord, les entreprises répercutent le surcoût sur leurs prix.');
});

test('splitLive : format tolérant (gras, puces, English/French, paire sur une ligne, étiquette coupée)', () => {
  const s = (t) => plain(env0.x._internal.splitLive(t));
  const env0 = makeEnv();
  assert.deepEqual(s('**EN:** Yes, I agree.\n**FR:** Oui, je suis d’accord.').lines, [{ en: 'Yes, I agree.', fr: 'Oui, je suis d’accord.' }]);
  assert.deepEqual(s('- English: Prices go up.\n- French: Les prix montent.').lines, [{ en: 'Prices go up.', fr: 'Les prix montent.' }]);
  assert.deepEqual(s('EN: Prices go up. FR: Les prix montent.').lines, [{ en: 'Prices go up.', fr: 'Les prix montent.' }]);
  assert.deepEqual(s('EN: Prices go up\nbecause of tariffs.\nFR: Les prix montent').lines, [{ en: 'Prices go up because of tariffs.', fr: 'Les prix montent' }], 'suite de ligne rattachée');
  for (const cut of ['Q-FR: Bonjour\nEN: Yes.\nF', 'Q-FR: Bonjour\nEN: Yes.\nFR:', 'Q-FR: Bonjour\nEN: Yes.\nKeyw']) {
    const r = s(cut);
    assert.equal(r.text, 'Yes.', 'étiquette coupée masquée : ' + JSON.stringify(cut));
    assert.deepEqual(r.lines, [{ en: 'Yes.', fr: '' }]);
  }
  assert.deepEqual(s('Q').lines, [], 'début de « Q-FR » masqué');
  assert.equal(s('Q-FR: Pouvez-vous m’entendre ?\n—').text, '—', 'tiret après Q-FR → saut');
  const legacy = s('I agree. Prices will rise. For example, U.S. firms pay more.');
  assert.deepEqual(legacy.lines.map(l => l.en), ['I agree.', 'Prices will rise.', 'For example, U.S. firms pay more.'], 'ancien format : découpé en phrases');
  assert.ok(legacy.lines.every(l => l.fr === ''));
});

test('liveAnswer : « — » après Q-FR → skip', async () => {
  const env = makeEnv({ replies: ['Q-FR: Vous m’entendez ?\n—'] });
  const r = await env.x.liveAnswer({ subject: SUBJECT, question: 'Can you hear me?' });
  assert.deepEqual(plain(r), { text: '', keyWords: [], skip: true });
});

test('liveAnswer : sans clé → NO_KEY ; réponse vide → EMPTY ; question absente', async () => {
  const env = makeEnv({ key: false });
  await assert.rejects(env.x.liveAnswer({ subject: SUBJECT, question: 'Why?' }), e => e.code === 'NO_KEY' && /clé/.test(e.message));
  assert.equal(env.calls.length, 0);
  const env2 = makeEnv({ replies: ['', 'Keywords: a; b'] });
  await assert.rejects(env2.x.liveAnswer({ subject: SUBJECT, question: 'Why?' }), e => e.code === 'EMPTY' && e.message === 'Réponse vide de l’IA — réessayez.');
  await assert.rejects(env2.x.liveAnswer({ subject: SUBJECT, question: 'Why?' }), e => e.code === 'EMPTY');
  await assert.rejects(env2.x.liveAnswer({ subject: SUBJECT, question: '  ' }), e => e.code === 'NO_QUESTION' && /question/.test(e.message));
  assert.equal(env2.calls.length, 2);
});

test('liveAnswer : annulation avant l’appel et pendant le flux', async () => {
  const env = makeEnv({ replies: [LIVE_REPLY] });
  const ac = new AbortController(); ac.abort();
  await assert.rejects(env.x.liveAnswer({ subject: SUBJECT, question: 'Why?', signal: ac.signal }), e => e.name === 'AbortError');
  assert.equal(env.calls.length, 0);
  const env2 = makeEnv({ replies: [LIVE_REPLY] });
  const ac2 = new AbortController();
  const deltas = [];
  await assert.rejects(env2.x.liveAnswer({ subject: SUBJECT, question: 'Why?', signal: ac2.signal, onDelta: t => { deltas.push(t); ac2.abort(); } }), e => e.name === 'AbortError' && e.code === 'ABORTED');
  assert.equal(deltas.length, 1, 'plus rien d’affiché après l’annulation');
});

const JURY_REPLY = { expect: 'Définir les droits de douane, donner un effet sur les prix et un exemple de 2025-2026.', model: 'I believe tariffs are a double-edged sword. They protect some domestic producers, but consumers end up paying more, as we saw with the 2025 US tariffs.' };

test('juryAnswer : JSON valide, purpose answer, côté jury ', async () => {
  const env = makeEnv({ replies: [JURY_REPLY] });
  const r = await env.x.juryAnswer({ subject: SUBJECT, question: 'What do you think about tariffs?', expose: 'I think Nvidia is overvalued.', turns: TURNS });
  const c = env.calls[0];
  assert.equal(c.purpose, 'answer');
  assert.equal(c.json, true);
  assert.equal(c.temperature, 0.3);
  assert.equal(c.maxTokens, 700);
  assert.equal(c.timeoutMs, 20000);
  assert.equal(c.budgetMs, 40000);
  assert.match(c.system, /examiner/);
  assert.match(c.system, /JURY/);
  assert.match(c.prompt, /JURY QUESTION: What do you think about tariffs\?/);
  assert.match(c.prompt, /Is the AI boom a bubble\?/);
  assert.match(c.prompt, /Nvidia is overvalued/);
  assert.doesNotMatch(c.prompt, /marker-[01]-end/);
  assert.match(c.prompt, /"expect"/);
  assert.deepEqual(r, JURY_REPLY);
  const env2 = makeEnv({ replies: [{ expect: 'Points clés.', model: 'I think the author is right, because valuations are stretched.' }] });
  const r2 = await env2.x.juryAnswer({ subject: SUBJECT, question: { en: 'Is the author right?', fr: 'L’auteur a-t-il raison ?' } });
  assert.match(env2.calls[0].prompt, /JURY QUESTION: Is the author right\?/, 'question IA (objet) acceptée');
  assert.match(r2.model, /valuations/);
});

test('juryAnswer : 2e tentative après JSON illisible, puis PARSE ; sans clé → NO_KEY', async () => {
  const env = makeEnv({ replies: ['pas du json', JURY_REPLY] });
  const r = await env.x.juryAnswer({ subject: SUBJECT, question: 'Why?' });
  assert.equal(env.calls.length, 2);
  assert.equal(r.model, JURY_REPLY.model);
  const env2 = makeEnv({ replies: ['nope', { expect: 'x', model: 'Too short.' }] });
  await assert.rejects(env2.x.juryAnswer({ subject: SUBJECT, question: 'Why?' }), e => e.code === 'PARSE' && /illisible/.test(e.message));
  assert.equal(env2.calls.length, 2);
  const env3 = makeEnv({ key: false });
  await assert.rejects(env3.x.juryAnswer({ subject: SUBJECT, question: 'Why?' }), e => e.code === 'NO_KEY');
  assert.equal(env3.calls.length, 0);
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
