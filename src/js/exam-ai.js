(function (S) {
  'use strict';

  const THEMES = {
    1: 'Finance',
    2: 'Accounting & auditing',
    3: 'Governance & CSR',
    4: 'Information systems & new technologies',
    5: 'Management, HR & strategy',
    6: 'Production',
    7: 'Marketing'
  };
  const THEME_HINTS = {
    1: 'banking, venture capital, bonds, stocks, derivatives, international financial markets, financial disclosure, crypto-assets and stablecoins',
    2: 'accounting standards (IFRS), financial statements, intangible assets, management control, internal and external audit, the Big Four, AI in audit',
    3: 'stakeholders, boards of directors, agency theory, trade unions, CSR, ISO 26000, sustainability reporting (CSRD, CSDDD, EU Omnibus)',
    4: 'ERP, big data, cloud computing, artificial intelligence, cybersecurity, big tech, data protection (GDPR), teleworking',
    5: 'management across cultures, recruitment, skills, diversity equity and inclusion, internal communication, company structure, non-profits, growth strategies, coopetition',
    6: 'supply chain, suppliers, logistics, quality and TQM, innovation, environment, tariffs and reshoring',
    7: 'brands, product life cycle, product launch, advertising, viral and influencer marketing, personal data and marketing, social networks'
  };
  const NEWS = [
    'US Supreme Court, 20 February 2026, Learning Resources v. Trump: IEEPA tariffs struck down (6-3); refunds estimated at $142-170 billion; replaced in February 2026 by a temporary 10% global tariff under Section 122 (limited by law to 150 days unless Congress extends it).',
    'Fears of an AI bubble; impact of AI on jobs and on audit; the "Magnificent 7" weight in stock markets.',
    'EU Omnibus I (Directive (EU) 2026/470, in force 18 March 2026): CSRD limited to companies with over 1,000 employees and EUR 450m turnover; CSDDD to over 5,000 employees and EUR 1.5bn — simplification or step back?',
    'GENIUS Act (July 2025) creates a federal framework for stablecoins in the US (full reserve backing once the rules take effect, by early 2027 at the latest); MiCA regulation in the EU (fully applicable since December 2024).'
  ];
  const COVER_KEYS = ['intro', 'source', 'tone', 'summary', 'transition', 'problematic', 'plan', 'news', 'conclusion'];
  const CRITERIA = [
    { id: 'synthesis', label: 'Synthèse du document', max: 4 },
    { id: 'structure', label: 'Problématique et structure', max: 4 },
    { id: 'commentary', label: 'Commentaire argumenté et actualité', max: 4 },
    { id: 'interaction', label: 'Entretien et interaction', max: 3 },
    { id: 'language', label: 'Langue (grammaire, vocabulaire)', max: 3 },
    { id: 'fluency', label: 'Aisance et respect du temps', max: 2 }
  ];
  const KINDS = {
    next: 'a natural next question that moves the interview forward (check understanding first, then broaden)',
    deeper: 'a follow-up that makes the candidate go deeper, justify or nuance a precise point they actually made',
    news: 'a question linking the topic to recent business news or current events (2025-2026) the candidate could mention',
    easier: 'an easier, shorter, very clear question to help a candidate who is struggling (simple words, yes/no then why)',
    opinion: 'a question asking for the candidate\'s personal opinion or experience (allowed in the interview, not in the summary)',
    clarify: 'a question asking the candidate to clarify or rephrase something unclear, vague or possibly wrong they said'
  };

  function err(code, message) {
    const e = new Error(message);
    e.name = 'ExamAIError';
    e.code = code;
    return e;
  }
  function abortErr() {
    const e = new Error('Requête annulée.');
    e.name = 'AbortError';
    e.code = 'ABORTED';
    return e;
  }
  function isAbort(e) { return !!e && (e.name === 'AbortError' || e.code === 'ABORTED'); }
  function checkAbort(signal) { if (signal && signal.aborted) throw abortErr(); }

  function str(v, max) {
    if (v == null) return '';
    if (Array.isArray(v)) v = v.map(x => str(x)).filter(Boolean).join(' ');
    else if (typeof v === 'object') v = v.text || v.en || v.value || '';
    let s = String(v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
    if (max && s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
    return s;
  }
  function list(v, max, itemMax) {
    if (v == null) return [];
    if (typeof v === 'string') v = v.split(/\n+/).map(x => x.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, ''));
    if (!Array.isArray(v)) v = [v];
    const out = v.map(x => str(x, itemMax || 600)).filter(Boolean);
    return max ? out.slice(0, max) : out;
  }
  function num(v, def) {
    if (typeof v === 'number') return isFinite(v) ? v : def;
    const m = String(v == null ? '' : v).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : def;
  }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function half(n) { return Math.round(n * 2) / 2; }
  function bool(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0;
    return /^(true|yes|oui|1|done|ok)$/i.test(String(v == null ? '' : v).trim());
  }
  function pick(o, keys) {
    if (!o || typeof o !== 'object') return undefined;
    for (const k of keys) if (o[k] != null && o[k] !== '') return o[k];
    return undefined;
  }
  function uid() {
    if (S.util && S.util.uid) return S.util.uid();
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }
  function fmtMin(ms) {
    if (!ms || ms < 0) return 'non mesuré';
    const s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s';
  }

  const STOP = new Set('a an the of to in on for and or but is are was were be been do does did can could would should will what why how which who whom whose that this these those it its your you their they there with about as at by from into than then so if not no do does'.split(' '));
  function keyWords(s) {
    return new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/(ies|es|s)$/, '')));
  }
  function similar(a, b) {
    const A = keyWords(a), B = keyWords(b);
    if (!A.size || !B.size) return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
    let inter = 0;
    A.forEach(w => { if (B.has(w)) inter++; });
    const jac = inter / (A.size + B.size - inter);
    return jac >= 0.55 || (inter >= 4 && inter / Math.min(A.size, B.size) >= 0.8);
  }
  function wasAsked(q, asked) {
    return (asked || []).some(a => similar(typeof a === 'string' ? a : (a && a.en) || '', q));
  }

  function clipMiddle(text, head, tail) {
    const s = String(text || '');
    if (s.length <= head + tail + 40) return s;
    return s.slice(0, head) + '\n[…]\n' + s.slice(s.length - tail);
  }

  function transcriptText(t) {
    if (!t) return '';
    if (typeof t === 'string') return t.trim();
    if (Array.isArray(t)) return t.map(x => typeof x === 'string' ? x : (x && x.text) || '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return str(t);
  }
  function interviewText(turns, max) {
    const lines = (Array.isArray(turns) ? turns : []).map(x => {
      if (!x || !x.text) return '';
      return (x.who === 'jury' ? 'JURY: ' : 'CANDIDATE: ') + String(x.text).trim();
    }).filter(Boolean);
    let s = lines.join('\n');
    if (max && s.length > max) s = '[…]\n' + s.slice(s.length - max);
    return s;
  }

  function subjectBrief(sub, opts) {
    const s = sub || {};
    const o = opts || {};
    const parts = [
      'DOCUMENT: "' + str(s.title) + '"' + (s.source ? ' — ' + str(s.source) : '') + (s.date ? ' (' + str(s.date) + ')' : ''),
      'THEME: ' + (THEMES[s.theme] || s.themeTitle || 'business'),
      'EXAM QUESTION: ' + str(s.question)
    ];
    if (o.text !== false && Array.isArray(s.paragraphs)) {
      parts.push('ARTICLE:\n' + clipMiddle(s.paragraphs.join('\n\n'), o.textMax || 6000, 800));
    }
    const c = s.corrige || {};
    if (o.corrige !== false && (c.summary || c.plan)) {
      const plan = (c.plan || []).map((p, i) => (i + 1) + '. ' + str(p && p.title) + (p && p.points && p.points.length ? ' (' + p.points.slice(0, 3).map(x => str(x)).join('; ') + ')' : '')).join('\n');
      parts.push('REFERENCE NOTES (for the examiner only):\n' +
        (c.summary && c.summary.length ? 'Key ideas: ' + c.summary.map(x => str(x)).join(' | ') + '\n' : '') +
        (c.problematic ? 'Possible problem statement: ' + str(c.problematic) + '\n' : '') +
        (plan ? 'Possible outline:\n' + plan : ''));
    }
    return parts.join('\n');
  }

  const EXAMINER = [
    'You are an experienced, benevolent but demanding examiner for the French accounting diploma oral exam in business English (DSCG UE6 / DSGC UE 218, CEFR level B2 expected, bilingualism NOT required).',
    'Exam format: 1 hour of preparation (no dictionary) on an English-language press article and a question; then a 15-minute presentation by the candidate alone; then a 15-minute interview with the jury.',
    'Expected presentation: (1) introduction: source, date, topic, tone of the article; (2) a reformulated summary bringing out the author\'s logic, with no personal opinion; (3) an announced transition; (4) a problem statement derived from the exam question; (5) a commentary in 2-3 announced parts, argued, using current events, knowledge and experience; (6) a conclusion with an opening.',
    'Penalised: missing or rushed summary; presentation under 10 minutes or commentary under 5 minutes; off-topic answer or dodging the question; reading fully written notes (only intro, transitions and conclusion may be written).',
    'Frequent language errors: pronunciation of common words (written, author, journalist, firms, measure, policy), missing final -s and -ed, numbers and dates, negative/interrogative forms, past tenses, reported speech, passive voice, modals, purpose/cause, prepositions, relative pronouns.',
    'Speech is transcribed automatically: never count missing punctuation, capitalisation or obvious speech-recognition artefacts (homophones, cut words) as language errors.',
    'Programme themes: 1 Finance, 2 Accounting & auditing, 3 Governance & CSR, 4 Information systems & new technologies, 5 Management, HR & strategy, 6 Production, 7 Marketing.',
    'Usable recent news (2025-2026): ' + NEWS.join(' ')
  ].join('\n');

  function ready() {
    try { return !!(S.ai && typeof S.ai.hasKey === 'function' && S.ai.hasKey()); } catch (e) { return false; }
  }

  function parseLoose(text) {
    if (S.ai && typeof S.ai.parseJson === 'function') {
      const p = S.ai.parseJson(text);
      return p ? p.data : null;
    }
    const s = String(text || '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
  }

  async function call(opts) {
    checkAbort(opts.signal);
    if (!S.ai || typeof S.ai.generate !== 'function') throw err('NO_AI', 'Le module IA n\'est pas chargé.');
    if (!ready()) throw err('NO_KEY', 'Aucune clé IA : ajoutez une clé Gemini (gratuite) ou OpenAI dans Réglages.');
    let r;
    try {
      r = await S.ai.generate(Object.assign({ stream: false }, opts));
    } catch (e) {
      if (isAbort(e) || (opts.signal && opts.signal.aborted)) throw abortErr();
      if (e && e.message) throw e;
      throw err('AI', 'L\'IA n\'a pas répondu — réessayez.');
    }
    checkAbort(opts.signal);
    if (!r) throw err('EMPTY', 'Réponse vide de l\'IA — réessayez.');
    if (opts.json) {
      let data = r.data;
      if (data == null) data = parseLoose(r.text);
      if (Array.isArray(data) && data.length && typeof data[0] === 'object') data = data[0];
      r.data = data && typeof data === 'object' ? data : null;
    }
    return r;
  }

  async function callJson(opts, validate, label) {
    let lastErr = null;
    for (let i = 0; i < 2; i++) {
      const r = await call(Object.assign({}, opts, { json: true }, i ? { temperature: Math.min(1, (opts.temperature || 0.4) + 0.1) } : null));
      if (r.data) {
        try {
          const out = validate(r.data);
          if (out) return out;
        } catch (e) { lastErr = e; }
      }
    }
    if (lastErr && lastErr.code) throw lastErr;
    throw err('PARSE', (label || 'Réponse') + ' illisible — réessayez.');
  }

  function pair(x) {
    if (!x) return null;
    if (typeof x === 'string') {
      const m = x.split(/\s+[—–-]\s+|\s*[:=]\s+/);
      return m.length >= 2 ? { en: str(m[0], 200), fr: str(m.slice(1).join(' — '), 300) } : { en: str(x, 300), fr: '' };
    }
    const en = str(pick(x, ['en', 'term', 'word', 'english', 'q', 'question']), 400);
    const fr = str(pick(x, ['fr', 'translation', 'french', 'meaning', 'definition']), 400);
    return en ? { en, fr } : null;
  }
  function pairs(v, max) { return (Array.isArray(v) ? v : []).map(pair).filter(Boolean).slice(0, max || 50); }

  function vocabLine(x) {
    if (!x) return '';
    if (typeof x === 'string') return str(x, 160);
    const p = pair(x);
    return p ? (p.fr ? p.en + ' — ' + p.fr : p.en) : '';
  }

  function normPlan(v) {
    const arr = Array.isArray(v) ? v : (typeof v === 'string' ? v.split(/\n(?=\s*(?:[IVX]+|\d)[.)])/) : []);
    return arr.map(p => {
      if (typeof p === 'string') return { title: str(p.split('\n')[0].replace(/^\s*(?:[IVX]+|\d+)[.)]\s*/, ''), 200), points: list(p.split('\n').slice(1), 6, 300) };
      if (!p || typeof p !== 'object') return null;
      return { title: str(pick(p, ['title', 'axis', 'part', 'heading']), 200), points: list(pick(p, ['points', 'ideas', 'arguments', 'items', 'subparts']), 6, 300) };
    }).filter(p => p && p.title).slice(0, 3);
  }

  function normCorrige(c) {
    c = c && typeof c === 'object' ? c : {};
    return {
      topic: str(pick(c, ['topic', 'subject']), 500),
      tone: str(c.tone, 400),
      summary: list(pick(c, ['summary', 'keyIdeas', 'ideas']), 6, 400),
      problematic: str(pick(c, ['problematic', 'problemStatement', 'issue']), 400),
      plan: normPlan(pick(c, ['plan', 'outline'])),
      news: list(pick(c, ['news', 'currentEvents', 'facts']), 6, 400),
      juryQuestions: pairs(pick(c, ['juryQuestions', 'questions']), 10),
      keyVocab: (Array.isArray(pick(c, ['keyVocab', 'vocab', 'vocabulary'])) ? pick(c, ['keyVocab', 'vocab', 'vocabulary']) : []).map(vocabLine).filter(Boolean).slice(0, 12)
    };
  }

  function themeOf(v) {
    let n = Math.round(num(v, 0));
    if (n >= 1 && n <= 7) return n;
    const s = String(v || '').toLowerCase();
    for (const k of Object.keys(THEMES)) if (s && THEMES[k].toLowerCase().indexOf(s.split(/[\s&,]/)[0]) === 0) return Number(k);
    return 0;
  }

  function splitParagraphs(v) {
    let arr = Array.isArray(v) ? v.map(x => str(x)) : String(v || '').split(/\n\s*\n/);
    arr = arr.map(x => str(x).replace(/\s*\n\s*/g, ' ')).filter(Boolean);
    return arr;
  }

  function normSubject(raw, defaults) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const def = defaults || {};
    const theme = themeOf(pick(d, ['theme', 'themeId'])) || themeOf(def.theme) || 0;
    const paragraphs = def.paragraphs || splitParagraphs(pick(d, ['paragraphs', 'text', 'article', 'body']));
    const glossary = pairs(pick(d, ['glossary', 'footnotes', 'notes']), 6);
    return {
      id: def.id || ('ai-' + uid()),
      theme: theme || 5,
      themeTitle: THEMES[theme || 5],
      title: str(pick(d, ['title', 'headline']), 200) || def.title || 'Untitled article',
      source: def.source || str(d.source, 200) || 'Practice text generated by AI',
      date: str(d.date, 40) || def.date || '',
      question: str(pick(d, ['question', 'examQuestion']), 400) || def.question || '',
      paragraphs,
      glossary,
      corrige: normCorrige(d.corrige || d.answerKey || d.key || d),
      ai: true
    };
  }

  const SUBJECT_SCHEMA = '{"theme": 1-7, "title": "headline", "date": "Month YYYY", "question": "exam question", "paragraphs": ["…"], "glossary": [{"en": "word in the text", "fr": "traduction"}], ' +
    '"corrige": {"topic": "1-2 sentences", "tone": "tone + justification", "summary": ["key idea", "…"], "problematic": "…", ' +
    '"plan": [{"title": "axis", "points": ["argument / example", "…"]}], "news": ["usable current fact"], ' +
    '"juryQuestions": [{"en": "question", "fr": "traduction"}], "keyVocab": ["word — mot"]}}';

  const CORRIGE_RULES = [
    'corrige.topic: 1-2 sentences. corrige.tone: one or two adjectives (e.g. critical, alarmist, neutral and informative, optimistic, ironic) with a justification from the text.',
    'corrige.summary: 4-6 key ideas following the author\'s logic, reformulated (no quotes), no opinion.',
    'corrige.problematic: a problem statement derived from the exam question.',
    'corrige.plan: 2 or 3 axes with 2-4 concrete points each (arguments, examples, figures, current events).',
    'corrige.news: 2-4 real current facts (2025-2026) usable in the commentary — only facts you are sure of.',
    'corrige.juryQuestions: 8-10 interview questions, from checking comprehension to widening the debate, each with a French translation.',
    'corrige.keyVocab: 8-12 entries "english word — mot français".'
  ].join('\n');

  async function generateSubject(opts) {
    const o = opts || {};
    let theme = themeOf(o.theme);
    if (!theme) theme = 1 + Math.floor(Math.random() * 7);
    const topic = str(o.topic, 300);
    const system = EXAMINER + '\n\nYou now write ORIGINAL practice exam material. Never copy existing articles or past papers; never claim the text is a real article.';
    const prompt = [
      'Write a practice exam subject for theme ' + theme + ' (' + THEMES[theme] + ': ' + THEME_HINTS[theme] + ').',
      topic ? 'Requested topic: ' + topic : 'Choose a topical 2025-2026 business issue within this theme.',
      'Requirements:',
      '- An original article in the style of the Anglo-Saxon business press (The Economist, Financial Times, WSJ), 5-7 paragraphs, 380-480 words in total, B2-C1 level, rich in theme vocabulary, with plausible figures and one or two quotes attributed to experts or executives described only by their role (e.g. \"a partner at a Paris audit firm\", \"the chief financial officer of a mid-sized retailer\"), never by a personal name. It must present a clear line of reasoning and some tension or debate.',
      '- "date": a month between January 2026 and ' + new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + ' (never a future month).',
      '- "question": one exam question in English inviting a personal, argued commentary (e.g. "To what extent…?", "Should…?", "Is … a threat or an opportunity for…?").',
      '- "glossary": 3-6 difficult words from the text with their French translation (like exam footnotes).',
      CORRIGE_RULES,
      'Answer ONLY with a JSON object: ' + SUBJECT_SCHEMA
    ].join('\n');
    return callJson({ purpose: 'prep', system, prompt, maxTokens: 4500, temperature: 0.8, timeoutMs: 70000, budgetMs: 140000, signal: o.signal }, (d) => {
      const s = normSubject(d, { theme, source: 'Practice text generated by AI' });
      // Le thème choisi par l'utilisatrice prime sur celui proposé par l'IA.
      s.theme = theme;
      s.themeTitle = THEMES[theme];
      if (s.paragraphs.length < 3 || words(s.paragraphs.join(' ')) < 200) return null;
      if (!s.question) s.question = 'To what extent do you agree with the author\'s analysis?';
      if (!s.date) s.date = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      return s;
    }, 'Sujet');
  }

  const LABEL_LINE = /^\s*(?:question|sujet|subject|exam question|consigne)\s*[:：]\s*/i;

  function splitImported(text) {
    const clean = String(text || '').replace(/\r/g, '').replace(/­/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    let blocks = clean.split(/\n\s*\n/);
    if (blocks.length < 3) {
      blocks = clean.split(/(?<=[.!?»”"])\n(?=[A-Z“"‘'(])/);
    }
    const out = [];
    blocks.map(b => b.replace(/-\n(?=[a-z])/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).forEach(b => {
      if (out.length && out[out.length - 1].length > 60 && b.length < 50 && !/[.!?]$/.test(out[out.length - 1])) out[out.length - 1] += ' ' + b;
      else out.push(b);
    });
    return out;
  }

  function detectQuestion(blocks) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      if (LABEL_LINE.test(blocks[i])) return { index: i, text: blocks[i].replace(LABEL_LINE, '').trim() };
    }
    return null;
  }

  async function subjectFromText(text, opts) {
    const o = opts || {};
    const raw = String(text || '').trim();
    if (words(raw) < 60) throw err('TOO_SHORT', 'Texte trop court pour un sujet d\'oral (au moins un article de quelques paragraphes).');
    // La question est cherchée sur tout le texte (souvent à la fin), puis l'article est limité à 16 000 caractères.
    let all = splitImported(raw);
    const q = detectQuestion(all);
    if (q) all = all.filter((_, i) => i !== q.index);
    let n = 0;
    const blocks = all.filter((b, i) => (n += b.length) <= 16000 || i === 0).map((b, i) => (i === 0 ? b.slice(0, 16000) : b));
    const numbered = blocks.map((b, i) => '[' + i + '] ' + b).join('\n\n');
    const system = EXAMINER + '\n\nYou prepare an imported exam subject: you never rewrite the article, you only analyse it.';
    const prompt = [
      'Here is an imported document (pasted or extracted from a PDF), split into numbered blocks:',
      numbered,
      q ? '\nExam question found in the document: ' + q.text : '\nNo exam question was explicitly found: detect it if one is in the blocks, otherwise propose one in the usual style ("To what extent…?").',
      '',
      'Tasks:',
      '- "headerBlocks": indexes of blocks that are NOT article body (headline, source line, date line, byline, footnotes, page numbers, exam instructions, the question).',
      '- "title", "source" (publication name, as written), "date" (as written, or "" if unknown), "question", "questionProposed": true if you had to invent the question.',
      '- "theme": the closest programme theme number 1-7.',
      '- "glossary": 3-6 difficult words of the text with French translation (reuse the document footnotes if any).',
      CORRIGE_RULES,
      'Answer ONLY with a JSON object: {"headerBlocks": [0], "title": "…", "source": "…", "date": "…", "question": "…", "questionProposed": false, "theme": 1, "glossary": [{"en": "", "fr": ""}], "corrige": {…same keys as described…}}'
    ].join('\n');
    return callJson({ purpose: 'prep', system, prompt, maxTokens: 4000, temperature: 0.3, timeoutMs: 70000, budgetMs: 140000, signal: o.signal }, (d) => {
      const header = new Set((Array.isArray(d.headerBlocks) ? d.headerBlocks : []).map(x => Math.round(num(x, -1))));
      const title = str(pick(d, ['title', 'headline']), 200);
      const question = (q && q.text) || str(d.question, 400);
      const tl = title.toLowerCase();
      let paragraphs = blocks.filter((b, i) => !header.has(i) && !(tl && b.toLowerCase() === tl) && !(question && b.trim() === question.trim()));
      if (words(paragraphs.join(' ')) < Math.min(120, words(raw) * 0.4)) paragraphs = blocks.slice();
      const s = normSubject(d, {
        id: 'imp-' + uid(),
        paragraphs,
        title: title || str(blocks[0], 120),
        source: str(d.source, 200) || 'Imported document',
        question: question || 'To what extent do you agree with the author\'s analysis?'
      });
      if (q && q.text) s.question = q.text;
      s.imported = true;
      s.questionProposed = !q && (bool(d.questionProposed) || !str(d.question));
      return s;
    }, 'Analyse du sujet');
  }

  const COVER_PATTERNS = {
    intro: /\b(today i (?:am going|will|'m going)|i(?:'m| am) going to (?:present|talk|deal)|the (?:document|article|text) (?:i|we)|this (?:article|document|text) (?:is|was|deals|comes))/i,
    source: /\b(published|taken from|comes from|extracted from|written by|issued (?:on|in)|financial times|the economist|wall street journal|the guardian|new york times|bloomberg|reuters|forbes|bbc)\b/i,
    tone: /\b(tone|the author (?:seems|is) (?:rather )?(?:critical|neutral|optimistic|pessimistic|ironic|alarmist|objective)|(?:critical|neutral|informative|alarmist|ironic|optimistic|pessimistic|objective) tone)\b/i,
    summary: /\b(to sum up the (?:article|text)|the author (?:first|explains|argues|points out|states|claims|highlights|underlines)|first(?:ly)?,? the (?:author|journalist|article)|according to the (?:author|journalist|article))\b/i,
    transition: /\b(now (?:let(?:'s| us)|i (?:would like|will|am going))|(?:this|which) (?:leads|brings) (?:me|us) to|after (?:summari[sz]ing|this summary)|let(?:'s| us) move on|turning to)\b/i,
    problematic: /\b(problem statement|problematic|the question (?:is|we|i)|we (?:may|can|could|might) (?:wonder|ask ourselves)|to what extent|one may wonder|the issue (?:is|here))\b/i,
    plan: /\b(in (?:a|the) first (?:part|place)|first(?:ly)?,? i will|then,? i will|in (?:a|the) second part|my (?:plan|outline)|i will (?:first|then))\b/i,
    news: /\b(recently|last (?:year|month|week)|in 202[4-6]|nowadays|currently|the supreme court|tariffs?|omnibus|csrd|genius act|mica|stablecoins?|magnificent (?:7|seven)|ai bubble)\b/i,
    conclusion: /\b(to conclude|in conclusion|to sum up|to wrap up|all in all|as a conclusion|to put it in a nutshell|to open (?:up )?the debate|as an opening)\b/i
  };

  function heuristicCovered(transcript) {
    const t = transcriptText(transcript);
    const out = {};
    COVER_KEYS.forEach(k => { out[k] = COVER_PATTERNS[k].test(t); });
    if (words(t) > 150 && !out.intro) out.intro = true;
    return out;
  }

  function normError(x) {
    if (!x || typeof x !== 'object') return null;
    const said = str(pick(x, ['said', 'wrong', 'error', 'original']), 200);
    const better = str(pick(x, ['better', 'right', 'correct', 'correction']), 200);
    if (!said || !better || said.toLowerCase() === better.toLowerCase()) return null;
    return { said, better, rule: str(pick(x, ['rule', 'why', 'explanation', 'tip']), 240) };
  }
  function normErrors(v, max) {
    const seen = new Set();
    return (Array.isArray(v) ? v : []).map(normError).filter(e => {
      if (!e) return false;
      const k = e.said.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, max || 6);
  }

  async function liveNotes(opts) {
    const o = opts || {};
    const full = transcriptText(o.transcript);
    const local = heuristicCovered(full);
    if (!full || words(full) < 8) return { covered: local, errors: [], tips: [], source: 'local' };
    if (!ready()) return { covered: local, errors: [], tips: [], source: 'local' };
    const sub = o.subject || {};
    const tail = full.length > 1200 ? full.slice(full.length - 1200) : full;
    const earlier = full.length > 1200 ? clipMiddle(full.slice(0, full.length - 1200), 2500, 2500) : '';
    // Les 30 fautes les plus récentes : ce sont elles que l'IA risque de relever à nouveau.
    const known = normErrors(o.knownErrors || o.previousErrors, 1000).slice(-30).map(e => e.said);
    const elapsed = Math.max(0, num(o.elapsedMs, 0));
    const system = EXAMINER + '\n\nYou assist the JURY live, silently. Be fast and terse. You never address the candidate and never suggest what they should say.';
    const prompt = [
      subjectBrief(sub, { text: false }),
      'Time elapsed since the start of the presentation: ' + fmtMin(elapsed) + '.',
      earlier ? 'EARLIER PART OF THE PRESENTATION:\n' + earlier : '',
      'LATEST PASSAGE:\n' + tail,
      known.length ? 'Errors already noted (do not repeat): ' + known.join(' | ') : '',
      '',
      'Return ONLY JSON: {"covered": {"intro": bool, "source": bool, "tone": bool, "summary": bool, "transition": bool, "problematic": bool, "plan": bool, "news": bool, "conclusion": bool}, "errors": [{"said": "exact words", "better": "correction", "rule": "règle courte en français"}], "tips": ["conseil très court en français pour le jury"]}',
      '"covered": true only if the candidate has clearly done that step so far (whole presentation). "news" = a current event or real-world example. "errors": max 6 clear grammar/vocabulary errors found in the LATEST PASSAGE only. "tips": 0-2 notes for the jury (e.g. "Synthèse encore absente après 6 min", "Lit ses notes ?", "Hors sujet : ne répond pas à la question").'
    ].filter(Boolean).join('\n');
    const r = await call({ purpose: 'fast', system, prompt, json: true, maxTokens: 700, temperature: 0.1, timeoutMs: 12000, budgetMs: 20000, signal: o.signal });
    const d = r.data;
    if (!d) return { covered: local, errors: [], tips: [], source: 'local' };
    const cov = d.covered && typeof d.covered === 'object' ? d.covered : d;
    const covered = {};
    COVER_KEYS.forEach(k => { covered[k] = cov[k] != null ? bool(cov[k]) : (k === 'news' ? false : local[k]); });
    const knownSet = new Set(known.map(x => x.toLowerCase()));
    const errors = normErrors(d.errors, 6).filter(e => !knownSet.has(e.said.toLowerCase()));
    const tips = list(d.tips, 3, 140);
    return { covered, errors, tips, source: 'ai' };
  }

  const BANK = {
    next: [
      { en: 'Could you remind us of the main idea of the article in one or two sentences?', fr: 'Pouvez-vous nous rappeler l\'idée principale de l\'article en une ou deux phrases ?' },
      { en: 'Who do you think the article is written for, and why?', fr: 'À qui l\'article s\'adresse-t-il selon vous, et pourquoi ?' },
      { en: 'Which stakeholders are the most affected by the situation described in the article?', fr: 'Quelles parties prenantes sont les plus concernées par la situation décrite ?' },
      { en: 'What would be the consequences for a French company?', fr: 'Quelles seraient les conséquences pour une entreprise française ?' }
    ],
    deeper: [
      { en: 'You mentioned an important point earlier. Could you give us a concrete example?', fr: 'Vous avez évoqué un point important. Pouvez-vous donner un exemple concret ?' },
      { en: 'What are the limits of the argument you have just developed?', fr: 'Quelles sont les limites de l\'argument que vous venez de développer ?' }
    ],
    news: [
      { en: 'Can you think of a recent event in the news that illustrates this issue?', fr: 'Voyez-vous un événement récent de l\'actualité qui illustre ce sujet ?' },
      { en: 'Has the situation changed since the article was published, in your opinion?', fr: 'La situation a-t-elle évolué depuis la publication de l\'article, selon vous ?' }
    ],
    easier: [
      { en: 'Did you like this article? Why or why not?', fr: 'Avez-vous aimé cet article ? Pourquoi ?' },
      { en: 'What is the most important figure in the article?', fr: 'Quel est le chiffre le plus important de l\'article ?' }
    ],
    opinion: [
      { en: 'What is your personal opinion on this issue?', fr: 'Quel est votre avis personnel sur cette question ?' },
      { en: 'Have you encountered this kind of situation in your professional experience?', fr: 'Avez-vous rencontré ce type de situation dans votre expérience professionnelle ?' }
    ],
    clarify: [
      { en: 'Could you explain more precisely what you meant?', fr: 'Pouvez-vous préciser ce que vous vouliez dire ?' },
      { en: 'Could you rephrase your problem statement, please?', fr: 'Pouvez-vous reformuler votre problématique, s\'il vous plaît ?' }
    ]
  };

  function fallbackQuestion(sub, asked, kind) {
    const fromSubject = (sub && sub.corrige && Array.isArray(sub.corrige.juryQuestions) ? sub.corrige.juryQuestions : []).map(pair).filter(Boolean);
    const pools = kind === 'next' || !kind ? [fromSubject, BANK.next] : [BANK[kind] || [], fromSubject, BANK.next];
    for (const pool of pools) {
      const q = pool.find(x => !wasAsked(x.en, asked));
      if (q) return { en: q.en, fr: q.fr || '', why: 'Question de secours (banque) — IA indisponible ou réponse invalide.', expect: '', source: 'bank' };
    }
    const all = BANK.next;
    const q = all[(asked || []).length % all.length];
    return { en: q.en, fr: q.fr, why: 'Question de secours (banque).', expect: '', source: 'bank' };
  }

  async function juryQuestion(opts) {
    const o = opts || {};
    const kind = KINDS[o.kind] ? o.kind : 'next';
    const asked = (Array.isArray(o.asked) ? o.asked : []).map(a => typeof a === 'string' ? a : (a && a.en) || '').filter(Boolean);
    if (!ready()) { checkAbort(o.signal); return fallbackQuestion(o.subject, asked, kind); }
    const expose = clipMiddle(transcriptText(o.expose), 3000, 3000);
    const interview = interviewText(o.interview, 4000);
    const system = EXAMINER + '\n\nYou help the JURY lead the 15-minute interview. Questions are spoken, in simple and natural English, one at a time, max 30 words, B2-friendly. Base them on what the candidate ACTUALLY said (quote or refer to it), on the article and on the exam question.';
    const prompt = [
      subjectBrief(o.subject, { textMax: 3500 }),
      'CANDIDATE\'S PRESENTATION (automatic transcript):\n' + (expose || '(not recorded)'),
      interview ? 'INTERVIEW SO FAR:\n' + interview : 'The interview has not started yet.',
      asked.length ? 'QUESTIONS ALREADY ASKED (never repeat or paraphrase them):\n' + asked.map(a => '- ' + a).join('\n') : '',
      '',
      'Write ' + KINDS[kind] + '.',
      'Return ONLY JSON: {"en": "the question in English", "fr": "traduction française", "why": "pour le jury, en français : ce que la question vérifie (1 phrase)", "expect": "en français : ce qu\'une bonne réponse B2 contiendrait (1-2 phrases)"}'
    ].filter(Boolean).join('\n');
    try {
      return await callJson({ purpose: 'answer', system, prompt, maxTokens: 500, temperature: 0.7, timeoutMs: 20000, budgetMs: 40000, signal: o.signal }, (d) => {
        const en = str(pick(d, ['en', 'question', 'q']), 300).replace(/^["“«\s]+|["”»\s]+$/g, '');
        if (en.length < 8 || wasAsked(en, asked)) return null;
        return { en, fr: str(d.fr, 400), why: str(d.why, 300), expect: str(pick(d, ['expect', 'expected', 'goodAnswer']), 500), source: 'ai' };
      }, 'Question');
    } catch (e) {
      if (isAbort(e)) throw e;
      return fallbackQuestion(o.subject, asked, kind);
    }
  }

  async function answerFeedback(opts) {
    const o = opts || {};
    const question = str(o.question && typeof o.question === 'object' ? o.question.en : o.question, 400);
    const answer = transcriptText(o.answer);
    if (!question) throw err('NO_QUESTION', 'Question manquante.');
    if (!answer || words(answer) < 2) {
      return { score: 0, good: [], fixes: [], better: '', empty: true, message: 'Aucune réponse enregistrée.' };
    }
    const system = EXAMINER + '\n\nThe candidate is training alone and has ALREADY answered. Give honest, encouraging and concrete feedback in French, and a short model answer in English.';
    const prompt = [
      subjectBrief(o.subject, { textMax: 2500 }),
      'JURY QUESTION: ' + question,
      'CANDIDATE\'S ANSWER (automatic transcript): ' + clipMiddle(answer, 3000, 1000),
      '',
      'Score the answer out of 10 at B2 level (relevance to the question, development and examples, interaction quality, language). 5 = understandable but short or vague; 7 = relevant, developed, few errors; 9-10 = excellent.',
      'Return ONLY JSON: {"score": 0-10, "good": ["point fort, en français"], "fixes": [{"said": "exact words", "better": "correction", "rule": "règle en français"}], "better": "model B2 answer in English, 3-4 sentences, short and easy to say aloud, reusing the candidate\'s ideas"}'
    ].join('\n');
    return callJson({ purpose: 'answer', system, prompt, maxTokens: 900, temperature: 0.3, timeoutMs: 30000, budgetMs: 60000, signal: o.signal }, (d) => {
      const better = str(pick(d, ['better', 'model', 'modelAnswer']), 1500);
      const good = list(pick(d, ['good', 'strengths']), 4, 300);
      const fixes = normErrors(pick(d, ['fixes', 'errors', 'corrections']), 8);
      if (!better && !good.length && !fixes.length) return null;
      // Sans note, on relance plutôt que d'afficher un 0/10 trompeur.
      const sc = num(pick(d, ['score', 'note', 'mark']), NaN);
      if (!isFinite(sc)) return null;
      return { score: clamp(Math.round(sc), 0, 10), good, fixes, better };
    }, 'Évaluation');
  }

  const MIN = 60000;

  function applyCaps(criteria, ctx) {
    const by = {};
    criteria.forEach(c => { by[c.id] = c; });
    const note = (c, txt) => { c.comment = c.comment ? c.comment + ' ' + txt : txt; };
    const cap = (id, max, txt) => {
      const c = by[id];
      if (c && c.score > max) { c.score = max; note(c, txt); }
    };
    const ex = ctx.exposeMs;
    if (ex > 0 && ex < 5 * MIN) {
      cap('fluency', 0, '(Exposé de ' + fmtMin(ex) + ' : très en dessous des 10 minutes minimum.)');
      cap('commentary', 1.5, '(Commentaire forcément trop court.)');
    } else if (ex > 0 && ex < 10 * MIN) {
      cap('fluency', 0.5, '(Exposé de ' + fmtMin(ex) + ' : moins de 10 minutes, pénalisé.)');
    }
    if (ctx.exposeWords < 120 && !ctx.hasJuryInput && !ctx.interviewOnly) {
      cap('synthesis', 1, '(Exposé quasi vide ou non enregistré.)');
      cap('structure', 1, '');
      cap('commentary', 1, '');
    }
    if (!ctx.hasInterview && by.interaction) {
      const others = criteria.filter(c => c.id !== 'interaction');
      const ratio = others.reduce((a, c) => a + c.score, 0) / others.reduce((a, c) => a + c.max, 0);
      by.interaction.score = half(ratio * by.interaction.max);
      by.interaction.comment = 'Entretien non réalisé : note estimée à partir de l\'exposé.';
      by.interaction.estimated = true;
    }
  }

  // Plan modèle en markdown, même si le modèle le renvoie en objet ou en tableau.
  function planText(mp) {
    const one = (x) => typeof x === 'string' ? x : JSON.stringify(x);
    if (typeof mp === 'string') return mp.trim();
    if (Array.isArray(mp)) return mp.map(x => '- ' + one(x)).join('\n');
    if (mp && typeof mp === 'object') return Object.keys(mp).map(k => '**' + k + '** : ' + one(mp[k])).join('\n\n');
    return '';
  }

  function normEvaluation(d, ctx) {
    const raw = Array.isArray(d.criteria) ? d.criteria : (d.criteria && typeof d.criteria === 'object' ? Object.keys(d.criteria).map(k => Object.assign({ id: k }, typeof d.criteria[k] === 'object' ? d.criteria[k] : { score: d.criteria[k] })) : []);
    if (!raw.length) return null;
    const found = {};
    raw.forEach((c, i) => {
      if (!c || typeof c !== 'object') return;
      const id = String(c.id || '').toLowerCase();
      const label = String(c.label || '').toLowerCase();
      const def = CRITERIA.find(x => x.id === id) ||
        CRITERIA.find(x => label && x.label.toLowerCase().split(/\s+/)[0] === label.split(/\s+/)[0]) ||
        (raw.length === CRITERIA.length ? CRITERIA[i] : null);
      if (def && !found[def.id]) found[def.id] = c;
    });
    if (Object.keys(found).length < 4) return null;
    const criteria = CRITERIA.map(def => {
      const c = found[def.id] || {};
      let score = num(pick(c, ['score', 'note', 'points']), NaN);
      if (!isFinite(score)) score = def.max / 2;
      const max = num(c.max, def.max);
      if (max && max !== def.max && max > 0) score = score * def.max / max;
      return { id: def.id, label: def.label, score: clamp(half(score), 0, def.max), max: def.max, comment: str(pick(c, ['comment', 'feedback', 'justification']), 600) };
    });
    applyCaps(criteria, ctx);
    const total = Math.round(criteria.reduce((a, c) => a + c.score, 0) * 10) / 10;
    return {
      total: clamp(total, 0, 20),
      criteria,
      strengths: list(pick(d, ['strengths', 'good']), 6, 300),
      priorities: list(pick(d, ['priorities', 'improvements']), 3, 300),
      errors: normErrors(pick(d, ['errors', 'fixes']), 15),
      pronunciation: list(d.pronunciation, 10, 200),
      modelPlan: planText(pick(d, ['modelPlan', 'plan'])).slice(0, 8000),
      message: str(pick(d, ['message', 'note']), 1500),
      durations: { prepMs: ctx.prepMs, exposeMs: ctx.exposeMs, interviewMs: ctx.interviewMs }
    };
  }

  async function evaluate(opts) {
    const o = opts || {};
    const dur = o.durations || {};
    const exposeText = transcriptText(o.expose);
    const turns = Array.isArray(o.interview) ? o.interview : (o.interview && Array.isArray(o.interview.turns) ? o.interview.turns : []);
    const ctx = {
      prepMs: Math.max(0, num(dur.prepMs, 0)),
      exposeMs: Math.max(0, num(dur.exposeMs, 0)),
      interviewMs: Math.max(0, num(dur.interviewMs, 0)),
      exposeWords: words(exposeText),
      hasInterview: turns.some(t => t && t.who !== 'jury' && words(t.text) >= 3)
    };
    const checklist = o.checklist && typeof o.checklist === 'object' ? o.checklist : {};
    // Les cases cochées automatiquement viennent du transcript : seules celles du jury comptent.
    const auto = o.checklistAuto && typeof o.checklistAuto === 'object' ? o.checklistAuto : {};
    ctx.hasJuryInput = COVER_KEYS.filter(k => checklist[k] && !auto[k]).length >= 3 || words(o.juryNotes) >= 15;
    ctx.interviewOnly = !!o.interviewOnly || (!ctx.exposeMs && !ctx.exposeWords && ctx.hasInterview);
    const cl = COVER_KEYS.filter(k => k in checklist).map(k => k + ': ' + (checklist[k] ? 'yes' : 'no')).join(', ');
    const notes = str(o.juryNotes, 2000);
    const system = EXAMINER + '\n\nYou now grade a full mock oral, fairly and consistently. Write all comments in French (except "modelPlan", in English).';
    const prompt = [
      subjectBrief(o.subject, { textMax: 4000 }),
      'DURATIONS: preparation ' + fmtMin(ctx.prepMs) + ', presentation ' + fmtMin(ctx.exposeMs) + ' (' + ctx.exposeWords + ' words transcribed; target 15 min, minimum 10), interview ' + fmtMin(ctx.interviewMs) + '.',
      cl ? 'JURY CHECKLIST (live): ' + cl : '',
      notes ? 'JURY NOTES: ' + notes : '',
      'PRESENTATION (automatic transcript):\n' + (clipMiddle(exposeText, 7000, 3000) || '(empty)'),
      'INTERVIEW:\n' + (interviewText(turns, 6000) || '(no interview)'),
      ctx.interviewOnly ? 'NOTE: this was an interview-only training session (no presentation). Grade synthesis, structure and commentary from what the answers show (understanding of the article, ability to structure an answer, arguments and examples), say so briefly in those comments, and do not apply the duration penalties of the presentation.' : '',
      ctx.exposeWords < 120 && ctx.hasJuryInput && !ctx.interviewOnly ? 'NOTE: the automatic transcript is missing or partial. Grade the presentation mainly from the JURY CHECKLIST and JURY NOTES, which reflect what the jury actually heard.' : '',
      '',
      'GRADING GRID (total /20): synthesis /4 (faithful, reformulated, author\'s logic, no opinion); structure /4 (intro with source/date/topic/tone, announced transition, problem statement from the question, announced 2-3 part plan, conclusion with opening); commentary /4 (argued, answers the question, examples, current events, knowledge); interaction /3 (understands questions, develops, nuances, keeps the exchange going); language /3 (grammar, vocabulary, B2 level); fluency /2 (ease, not reading, timing).',
      'CALIBRATION: a well-structured B2 presentation with a real summary, a clear plan, relevant examples and a lively interview, despite some errors, deserves 15-17. An average but complete performance: 10-13. Severe penalties: missing or rushed summary (synthesis ≤ 1), presentation under 10 minutes, commentary shorter than about 5 minutes (judge from its share of the transcript; commentary ≤ 1.5), off-topic or dodging the question (structure and commentary ≤ 1.5 each), reading written notes (fluency 0). Do not penalise speech-recognition artefacts. Use half points.',
      'Return ONLY JSON: {"criteria": [{"id": "synthesis|structure|commentary|interaction|language|fluency", "score": number, "comment": "français, précis, 1-3 phrases"}], "strengths": ["français"], "priorities": ["3 max, concrets, en français"], "errors": [{"said": "exact words", "better": "correction", "rule": "règle en français"}], "pronunciation": ["word — conseil en français"], "modelPlan": "markdown in English: introduction, summary, problem statement, detailed plan (2-3 parts with examples), conclusion with opening", "message": "message chaleureux et motivant en français pour Audrey (4-6 phrases, tutoiement, 2-3 conseils concrets)"}'
    ].filter(Boolean).join('\n');
    return callJson({ purpose: 'prep', system, prompt, maxTokens: 5000, temperature: 0.2, timeoutMs: 90000, budgetMs: 150000, signal: o.signal }, d => normEvaluation(d, ctx), 'Évaluation');
  }

  async function translate(text, opts) {
    const o = opts || {};
    const src = String(text == null ? '' : text).trim();
    if (!src) return '';
    const to = o.to === 'en' ? 'en' : 'fr';
    const system = to === 'fr'
      ? 'Tu es traducteur professionnel anglais → français (presse économique). Traduis fidèlement, dans un français naturel. Réponds uniquement par la traduction, sans guillemets ni commentaire.'
      : 'You are a professional French → English translator (business English, B2-C1, natural spoken style). Reply with the translation only, no quotes, no comment.';
    const r = await call({ purpose: 'fast', system, prompt: src.slice(0, 8000), maxTokens: Math.min(4000, Math.max(200, Math.ceil(src.length / 2))), temperature: 0.1, timeoutMs: 20000, budgetMs: 40000, signal: o.signal });
    let out = String(r.text || '').trim().replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
    if (/^(?:traduction|translation)\s*:/i.test(out)) out = out.replace(/^(?:traduction|translation)\s*:\s*/i, '');
    if (/^["«“]/.test(out) && !/^["«“]/.test(src)) out = out.replace(/^["«“]\s*|\s*["»”]$/g, '');
    if (!out) throw err('EMPTY', 'Traduction vide — réessayez.');
    return out;
  }

  const Q_LEAD = new RegExp('^(?:' + [
    'good (?:morning|afternoon|evening)', 'hello', 'hi', 'welcome(?: back)?',
    'thank you(?: (?:very|so) much)?(?: (?:for (?:your|the|this) (?:presentation|answer|answers|time|attention)|again))?', 'thanks(?: a lot)?',
    '(?:can|could|do|did) (?:you|everyone|everybody) (?:all )?(?:hear|see) (?:me|us|my screen|the screen)(?: (?:well|ok|okay|properly|clearly|now|all right|alright))*',
    "(?:i|we) (?:can(?:'?t|not)? )?(?:hear|see) you(?: (?:well|now|clearly|very well|again))*",
    "(?:i think )?(?:you(?:'?re| are)|i(?:'?m| am)) (?:on mute|muted|frozen|breaking up)", 'am i (?:audible|on mute|muted)',
    "that(?:'?s| is) (?:all|it)(?: for (?:me|now|today|us))?", "time(?:'?s| is) up", "we(?:'?re| are) done",
    'goodbye', 'bye(?: bye)?', 'see you(?: soon)?', 'have a (?:nice|good) day', "you(?:'?re| are) welcome", 'no problem',
    'sorry', 'pardon', 'excuse me', 'i see', 'of course', 'sure', 'exactly', 'indeed', 'interesting',
    'very good', 'good', 'great', 'perfect', 'fine', 'excellent', 'ok(?:ay)?', 'alright', 'all right', 'right',
    'so', 'well', 'now', 'and', 'then', 'please', 'yes', 'yeah', 'um+', 'uh+', 'hmm+', 'mm+', 'erm',
    'go on', 'just', 'however', 'but', 'actually', 'audrey', 'corentin', 'madam', 'sir', 'everyone', 'everybody'
  ].join('|') + ')(?: |$)');
  const Q_FORMAL = new RegExp('^(?:' + [
    'is (?:it|everything|that|this) (?:ok|okay|fine|all right|alright|good|working|better|clear)(?: (?:now|for you))*',
    'is (?:my|the|your) (?:sound|audio|microphone|mic|video|camera|connection|screen|image)(?: (?:ok|okay|fine|good|working|clear|better|all right|alright))?(?: (?:now|for you))*',
    '(?:can|could|do) you (?:all )?(?:hear|see) (?:it|that)(?: (?:well|ok|okay|properly|clearly|now))*',
    'are you (?:ready(?: to (?:start|begin))?|there|still there|with us)', 'how are you(?: (?:today|doing|feeling))?',
    "(?:(?:when(?:ever)?|if) you(?:'?re| are) ready )?(?:you (?:may|can) )?(?:start|begin|go ahead|proceed)(?: (?:now|please|when(?:ever)? you(?:'?re| are) ready))*",
    "(?:let(?:'?s| us)|shall we|can we|we can|we may) (?:start|begin|get started)(?: (?:now|then))?"
  ].join('|') + ')$');
  const Q_ASK = new RegExp('^(?:' + [
    "(?:what|why|how|when|where|who|whom|which|whose)(?:'?s)?",
    "(?:do|does|did|is|are|was|were|have|has|can|could|would|will|should|shall)(?:n'?t)?", 'cannot', "won'?t", '(?:may|might) (?:i|we)',
    'tell (?:us|me)', 'give (?:us|me)', 'talk (?:to (?:us|me) )?about', 'say (?:a bit |a little )?more', "i(?:'?m| am| was| would be|'?d be) (?:wondering|curious|interested)", 'i wonder', 'explain', 'describe', 'summari[sz]e', 'define', 'comment on', 'develop', 'elaborate',
    'expand on', 'justify', 'illustrate', 'clarify', 'rephrase', 'remind (?:us|me)',
    'compare', 'discuss', 'present (?:your|the|us|me)','analy[sz]e', 'assess', 'evaluate', '(?:imagine|suppose) (?:you|that you|for a moment)','name (?:one|a|two|three|some)',
    'take the (?:example|case) of', 'how so', 'what else', 'anything (?:else|to add)', 'any (?:other )?(?:example|idea|comment|thought)s?',
    '(?:the )?(?:next|last|final) question',
    'in your (?:opinion|view|experience)', 'according to you', "let(?:'?s| us) (?:talk|discuss|focus|come back|go back)", 'let me ask',
    "i(?:'?d| would) like (?:you to|to (?:ask|know|hear))", 'i want you to',
    'my (?:next |last |final |first |second |other )?question', '(?:one|a) (?:more|last|final|quick|follow up) question', 'i have (?:a|another|one more|one last) question'
  ].join('|') + ')\\b');
  const Q_NOT = /^(?:which (?:means|is why|explains|shows|leads)|what (?:i|you) (?:mean|want to say|wanted to say)|how (?:can|could|should|do) i (?:say|put it)|how do you say|what (?:i|we) (?:[a-z']+ ){0,3}(?:is|was) (?:that|to) (?=[a-z])|what (?:is|was) (?:[a-z']+ ){1,2}(?:is|was) that (?=[a-z])|(?:could|can|would) you (?:please )?(?:repeat|say (?:it|that) again)(?: (?:the question|that|it|please))*$|(?:do not|don'?t) hesitate|what was the question|(?:can|may|could|shall) i (?:start|begin|continue|go on)|is it (?:ok|okay|alright|all right) if i (?:start|begin|continue|go on))\b/;
  // Question-tag en fin de phrase : « …, isn't it », « don't you think ».
  const Q_TAG = /\b(?:(?:is|are|was|were|do|does|did|can|could|will|would|should|has|have)n'?t (?:it|they|there|that|you|we|he|she)|don'?t you think|wouldn'?t you say|or not)$/;
  const Q_ANY = new RegExp('\\b(?:' + [
    "(?:do|does|did|would|could|can|will|should|don'?t|didn'?t|wouldn'?t|couldn'?t) you (?:think|agree|believe|say|tell|explain|give|describe|elaborate|develop|expand|comment|summari[sz]e|define|mean|know|feel|recommend|suggest|choose|prefer|like|want|remember|clarify|justify|illustrate|consider|expect|imagine|have)",
    '(?:what|why|how|which|where|when|who) (?:do|did|does|would|could|can|will|should|might) you',
    'in your (?:opinion|view)', 'according to you', 'tell (?:us|me)',
    '(?:i|we) wonder (?:how|why|what|if|whether|which|who|where|when)', 'let me ask you', "i(?:'?d| would) like to ask", 'i have (?:a|another|one) (?:last |final )?question'
  ].join('|') + ')\\b');

  function normQ(s) {
    return String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^a-z0-9'\s]+/g, ' ')
      .replace(/(?<![a-z])'|'(?![a-z])/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function stripLead(s) {
    let m;
    while ((m = s.match(Q_LEAD))) s = s.slice(m[0].length);
    return s.trim();
  }

  function isJuryQuestion(text) {
    const raw = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!raw) return false;
    const parts = raw.split(/(?<=[.!?;…？])\s+/)
      .map(p => ({ raw: p, rest: stripLead(normQ(p)) || (/^(?:so|and|then|well)\s*[?？]$/i.test(p) ? 'so' : '') }))
      .filter(p => p.rest && !Q_FORMAL.test(p.rest));
    if (!parts.length) return false;
    // Question rhétorique de l'élève : « Why? Because… ».
    if (parts.some((p, i) => i > 0 && /^because\b(?! of)/.test(p.rest) && words(parts[i - 1].rest) <= 2)) return false;
    if (parts.some(p => /[?？][\s"'”’»)\]]*$/.test(p.raw) && !Q_NOT.test(p.rest.replace(/^what (?:i|you) (?:mean|want to say|wanted to say) is /, '')))) return true;
    if (words(parts.map(p => p.rest).join(' ')) < 3) return false;
    return parts.some(p => !Q_NOT.test(p.rest) && (Q_ASK.test(p.rest) || Q_ANY.test(p.rest) || Q_TAG.test(p.rest)));
  }

  const KW_LINE = /(?:^|\s)[*_#>\s-]*(?:key ?words?|key expressions?|useful expressions?)\s*\**\s*[:：]/i;
  const isSkip = t => /^[—–-]{1,3}$/.test(t) || (/^[—–]/.test(t) && t.length < 120);

  function cleanSpoken(s) {
    let t = String(s || '').replace(/\r/g, '').replace(/^[ \t]*(?:[-•*]|\d+[.)])[ \t]+/gm, '').replace(/[*`]+|__/g, '').trim();
    t = t.replace(/^(?:candidate|answer|suggested answer|model answer|you could say)\s*:\s*/i, '');
    if (/^["“«]/.test(t)) t = t.replace(/^["“«]\s*/, '').replace(/\s*["”»]$/, '');
    return t.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  }

  // Mots-clés « expression (traduction FR) » : la traduction reste entre parenthèses
  // (« supply chain (chaîne d'approvisionnement) »), quel que soit le séparateur
  // employé par le modèle (« — », « = », « : », « → »). Les virgules dans les
  // parenthèses ne coupent pas la liste.
  function kwOne(x) {
    let k = x.replace(/^[\s"“”'‘’.\-–—]+|[\s"“”'‘’.,;]+$/g, '');
    const sep = k.match(/^([^()]+?)\s+(?:[—–=:→]|->)\s+([^()]+)$/);
    if (sep) k = sep[1].trim() + ' (' + sep[2].trim() + ')';
    return k.replace(/\s*\(\s*/, ' (').replace(/\s*\)\s*$/, ')').replace(/\s*\(\)$/, '');
  }
  function kwList(s) {
    const t = String(s || '').replace(/[*`]+|__/g, '').trim();
    if (!t) return [];
    const seen = new Set();
    const out = [];
    t.split(/[;\n•|]/.test(t) ? /\s*[;\n•|]\s*/ : /\s*,\s*(?![^()]*\))/).forEach(x => {
      const k = kwOne(x);
      const low = k.toLowerCase().replace(/\s*\(.*$/, '');
      if (!k || k.length > 120 || /^(?:none|n\/a)$/.test(low) || seen.has(low)) return;
      seen.add(low);
      out.push(k);
    });
    return out.slice(0, 5);
  }

  // Sortie « sous-titres » de l'aide en direct, pensée pour le flux :
  //   Q-FR: traduction de la question du jury
  //   EN: phrase 1        FR: sa traduction
  //   EN: phrase 2        FR: sa traduction …
  //   Keywords: expression (traduction); …
  // Tolère le gras, les puces, « English: / French: », une paire sur une seule ligne,
  // une étiquette encore incomplète en fin de flux, et l'ancien format (texte brut).
  const LV_TAG = /^(?:[-•*>#]+\s*|\d+[.)]\s*)?(q\s*[-_]?\s*fr|question\s*\(?\s*fr\s*\)?|en|english|anglais|fr|french|fran[cç]ais|traduction)\s*[:：]\s*/i;
  const LV_PARTIAL = ['qfr:', 'questionfr:', 'en:', 'english:', 'fr:', 'french:', 'keywords:', 'keyword:'];
  function sentencesOf(t) {
    return String(t || '').split(/(?<=[.!?…])\s+(?=["“«(]?[A-Z0-9])/).map(x => x.trim()).filter(Boolean);
  }
  function splitLive(full) {
    let s = String(full || '').replace(/\r/g, '').replace(/\*\*|__|`+/g, '');
    let kw = '';
    const m = s.match(KW_LINE);
    if (m) {
      kw = s.slice(m.index + m[0].length);
      s = s.slice(0, m.index);
    } else {
      // Étiquette encore incomplète en fin de flux (« Keyw », « E », « FR: ») : masquée.
      const nl = s.lastIndexOf('\n');
      const tail = s.slice(nl + 1).replace(/[\s*_#>•-]/g, '').toLowerCase();
      if (tail && LV_PARTIAL.some(p => p.indexOf(tail) === 0)) s = s.slice(0, Math.max(0, nl));
    }
    // Paire écrite sur une seule ligne : « EN: … FR: … ».
    s = s.replace(/[ \t]+(?=(?:EN|FR|Q-FR)[ \t]*:)/g, '\n');
    let qFr = '';
    let cur = null;
    let field = '';
    const pairs = [];
    const loose = [];
    s.split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) return;
      const t = line.match(LV_TAG);
      if (t) {
        const tag = t[1].toLowerCase().replace(/[\s_()-]/g, '');
        const rest = line.slice(t[0].length).trim();
        if (/^q/.test(tag)) { qFr = rest; field = ''; return; }
        if (/^(?:en|english|anglais)$/.test(tag)) { cur = { en: rest, fr: '' }; pairs.push(cur); field = 'en'; return; }
        if (!cur || cur.fr) { cur = { en: '', fr: '' }; pairs.push(cur); }
        cur.fr = rest; field = 'fr';
        return;
      }
      if (cur && field) cur[field] += ' ' + line;
      else loose.push(line);
    });
    let lines;
    if (pairs.length) {
      lines = pairs.map(p => ({ en: cleanSpoken(p.en), fr: cleanSpoken(p.fr) })).filter(p => p.en);
    } else {
      lines = sentencesOf(cleanSpoken(loose.join('\n'))).map(en => ({ en, fr: '' }));
    }
    const text = pairs.length ? lines.map(l => l.en).join(' ') : cleanSpoken(loose.join('\n'));
    return { text, keyWords: kwList(kw), qFr: cleanSpoken(qFr), lines };
  }

  async function liveAnswer(opts) {
    const o = opts || {};
    const question = str(o.question, 1500);
    if (!question) throw err('NO_QUESTION', 'Aucune question du jury à traiter.');
    // Contexte réduit : la 1re réponse doit arriver en 1 à 2 s pendant l'appel.
    const expose = clipMiddle(transcriptText(o.expose), 1200, 600);
    // La question en cours figure souvent déjà comme dernier tour du jury : pas de doublon.
    const recent = (Array.isArray(o.turns) ? o.turns : []).slice();
    while (recent.length) {
      const last = recent[recent.length - 1];
      const lt = last && last.who === 'jury' ? String(last.text || '').trim() : '';
      if (!lt || !question.includes(lt)) break;
      recent.pop();
    }
    const turns = interviewText(recent.slice(-6), 1200);
    const prev = o.shorter ? str(o.previous, 800) : '';
    const size = o.shorter ? '2 short sentences, 25 words maximum' : '3 short sentences, 45 words maximum';
    const system = [
      'You are the candidate\'s English coach during a TRAINING mock oral for the French accounting diploma (DSCG UE6 / DSGC UE 218, business English, CEFR level B2 expected). The candidate has studied a press article and an exam question, has given a presentation, and is now questioned by the jury.',
      'Write what the candidate can say right now to the jury: spoken English, first person, natural B2 level, ' + size + '. Each sentence 15 words maximum, one idea per sentence.',
      o.shorter
        ? 'Sentence 1 answers the question directly in 12 words maximum, reusing the jury\'s key words (yes/no question: start with "Yes,", "No," or "Partly,"). Sentence 2 gives one short reason or example. No filler such as "That is a good question".'
        : 'Sentence 1 answers the question directly in 12 words maximum, reusing the jury\'s key words (yes/no question: start with "Yes,", "No," or "Partly,"). Sentence 2 gives one reason. Sentence 3 gives one concrete example from the article, from the candidate\'s presentation or from the news below. Simple linking words only (because, for example, so, however). No filler such as "That is a good question".',
      'Use common words a French B2 speaker can pronounce easily: no idioms, no rare words, no long numbers.',
      'Use only facts and figures found in the article, the candidate\'s presentation or the news below; never invent a figure, a name or a date.',
      'Stay consistent with the candidate\'s presentation (same problem statement, same opinion); you may start with "As I said in my presentation," when it helps. If the jury\'s words are a follow-up ("why?", "an example?", "and for firms?"), answer it in the light of the RECENT EXCHANGE.',
      'The candidate reads your answer as bilingual subtitles (English, then French). Use EXACTLY this plain-text format, one item per line, no markdown, no quotes, no preamble:',
      'EN: first sentence to say',
      'FR: its French translation',
      'EN: next sentence to say',
      'FR: its French translation',
      '(one EN line then one FR line for each sentence)',
      'Keywords: expression (traduction française); expression (traduction française); expression (traduction française)',
      'The last line gives the 3 key English expressions of the answer (2-4 words each, the ones that carry the idea), each followed by its short French translation in brackets.',
      'The jury\'s words come from automatic speech recognition: if some words are wrong or missing, answer the most likely intended question.',
      // « Répondre maintenant » (force) : l'élève demande une réponse, pas de saut.
      o.force ? '' : 'If the words are not a question or request from the jury to the candidate (greeting, sound check, thanks, instructions such as "take your time", small talk, or the candidate speaking: a rhetorical question followed by "because", asking the jury to repeat), output exactly "—" and nothing else.',
      'Usable recent news (2025-2026), only if relevant: ' + NEWS.join(' ')
    ].filter(Boolean).join('\n');
    const prompt = [
      subjectBrief(o.subject, { textMax: 1500 }),
      expose ? 'CANDIDATE\'S PRESENTATION (automatic transcript, may contain errors):\n' + expose : '',
      turns ? 'RECENT EXCHANGE (automatic transcript, may contain errors):\n' + turns : '',
      prev ? 'PREVIOUS SUGGESTED ANSWER (keep the same idea, opinion and example, just shorter):\n' + prev : '',
      'JURY\'S WORDS JUST NOW (automatic transcript, may contain errors): ' + question,
      '',
      'Write the candidate\'s answer now (' + size + '), as EN / FR subtitle lines.'
    ].filter(Boolean).join('\n');
    // Flux : onDelta(texte anglais, { lines: [{ en, fr }], qFr }) à chaque nouveau morceau utile.
    let shown = '';
    const onDelta = (full) => {
      if (typeof o.onDelta !== 'function' || (o.signal && o.signal.aborted)) return;
      const p = splitLive(full);
      const t = p.text;
      if ((t && isSkip(t)) || (!t && !p.qFr)) return;
      const out = t.replace(/^[—–]\s*/, '');
      const key = out + '\u0001' + p.qFr + '\u0001' + p.lines.map(l => l.fr).join('\u0002');
      if (key === shown) return;
      shown = key;
      try { o.onDelta(out, { lines: p.lines, qFr: p.qFr }); } catch (e) {  }
    };
    const r = await call({ purpose: 'live', stream: true, onDelta, system, prompt, temperature: o.shorter ? 0.3 : 0.5, maxTokens: 800, timeoutMs: 15000, budgetMs: 30000, signal: o.signal });
    const parts = splitLive(r.text);
    if (parts.text && isSkip(parts.text)) return { text: '', keyWords: [], skip: true };
    const text = parts.text.replace(/^[—–]\s*/, '');
    if (!text) throw err('EMPTY', 'L’IA n’a renvoyé aucun texte : appuyez sur « Réessayer ».');
    return { text, keyWords: parts.keyWords, skip: false, qFr: parts.qFr, lines: parts.lines, partial: !!r.partial };
  }

  async function juryAnswer(opts) {
    const o = opts || {};
    const question = str(o.question, 1500);
    if (!question) throw err('NO_QUESTION', 'Aucune question du jury à traiter.');
    const expose = clipMiddle(transcriptText(o.expose), 2500, 1500);
    const turns = interviewText((Array.isArray(o.turns) ? o.turns : []).slice(-10), 3000);
    const system = EXAMINER + '\n\nYou help the JURY during the interview of a TRAINING mock oral. For the question the jury has just asked, state in French what a good B2 answer must contain, and write a model answer in English, in the first person, as a good B2 candidate would say it (natural spoken style, an argument and a concrete example from the article or recent news). The question comes from automatic speech recognition: if some words are wrong or missing, use the most likely intended question.';
    const prompt = [
      subjectBrief(o.subject, { textMax: 3500 }),
      expose ? 'CANDIDATE\'S PRESENTATION (automatic transcript):\n' + expose : '',
      turns ? 'INTERVIEW SO FAR (automatic transcript):\n' + turns : '',
      'JURY QUESTION: ' + question,
      '',
      'Return ONLY JSON: {"expect": "en français : points clés qu’une bonne réponse B2 doit contenir (1-2 phrases)", "model": "model answer in English, 3-5 sentences, B2"}'
    ].filter(Boolean).join('\n');
    return callJson({ purpose: 'answer', system, prompt, temperature: 0.3, maxTokens: 700, timeoutMs: 20000, budgetMs: 40000, signal: o.signal }, (d) => {
      const model = cleanSpoken(str(pick(d, ['model', 'modelAnswer', 'answer', 'better']), 1500));
      if (model.length < 20) return null;
      return { expect: str(pick(d, ['expect', 'expected', 'keyPoints', 'points']), 600), model };
    }, 'Réponse modèle');
  }

  S.examAI = {
    ready, generateSubject, subjectFromText, liveNotes, juryQuestion, answerFeedback, evaluate, translate,
    isJuryQuestion, liveAnswer, juryAnswer,
    heuristicCovered, normSubject, normEvaluation, CRITERIA, THEMES, COVER_KEYS, KINDS,
    _internal: { splitImported, similar, fallbackQuestion, applyCaps, splitLive }
  };
})(window.AideVisio = window.AideVisio || {});
