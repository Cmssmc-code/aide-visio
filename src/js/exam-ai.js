(function (S) {
  'use strict';

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
  function words(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).length; }

  function ready() {
    try { return !!(S.ai && typeof S.ai.hasKey === 'function' && S.ai.hasKey()); } catch (e) { return false; }
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
    return r;
  }

  const isSkip = t => /^[—–-]{1,3}\.?$/.test(t);

  // ---- Entretien d'embauche (en français) : question du recruteur, réponse soufflée tirée du dossier ----
  const FR_Q = new RegExp('(?:^|[^a-zà-ÿ])(?:' + [
    'quel(?:le)?s? (?:est|sont|serai|a été|type|genre|rôle|poste|outil|logiciel|bailleur|expérience|difficulté|qualité|défaut|salaire|rémunération|prétention|disponibilité|délai|niveau)',
    '(?:pouvez|pourriez|voulez|souhaitez|savez|avez|êtes|seriez|auriez|connaissez|pensez|voyez|maîtrisez|parlez|comptez|accepteriez|utilisez|travaillez|gérez|envisagez|imaginez|cherchez|attendez)[- ]vous',
    '(?:parlez|dites|racontez|expliquez|décrivez|donnez|citez|présentez|précisez|détaillez)[- ](?:moi|nous)', 'présentez[- ]vous',
    'vous (?:pouvez|pourriez|voulez) (?:me|nous|m\'|vous présenter|développer|préciser|expliquer|détailler|commencer)',
    'je vous (?:laisse|propose de|invite à) (?:vous présenter|commencer|la parole)', '(?:j\'aimerais|je voudrais|j\'aurais voulu|je souhaiterais) (?:savoir|comprendre|que vous|vous entendre|connaître)',
    'qu\'en pensez[- ]vous', 'que (?:savez|pensez|faites|feriez|diriez|pouvez|cherchez|attendez|retenez)[- ]vous', '(?:des|d\'autres|une) questions?(?: pour (?:nous|moi))?\\s*$',
    // Verbe + « -vous » : presque toujours une question (« où habitez-vous »), sauf les politesses à l'impératif.
    '(?!asseyez|installez|mettez|détendez|rassurez|servez)[a-zà-ÿ]+ez-vous', 'vous (?:connaissez|maîtrisez|avez géré|avez déjà|avez l\'habitude)', 'c\'est quoi', 'ça fait combien',
    'vos (?:prétentions|disponibilités|attentes|motivations|points? (?:forts?|faibles?))', 'votre (?:disponibilité|préavis|motivation|parcours|niveau d\'anglais)'
  ].join('|') + ')', 'i');
  // Interrogatifs reconnus seulement en début de phrase, ou après une courte conjonction / interjection.
  const FR_PRE = '^(?:(?:et|mais|donc|alors|d\'accord|ok|bon|bien|très bien|parfait|merci|dites|écoutez)[\\s,]+)*';
  const FR_START = new RegExp(FR_PRE + '(?:qu\'est[- ]ce (?:que|qui|qu\')|est[- ]ce qu|(?:pourquoi|comment(?! dire)|combien|à quoi|lesquel(?:le)?s|depuis (?:quand|combien)|dans quel(?:le)?s?|avec qui|pour qui)(?![a-zà-ÿ]))', 'i');
  // Interrogatif en fin de phrase : « vous êtes disponible quand », « vous venez d'où ».
  const FR_END = /^(?:et |mais )?(?:vous|on)\b.*\b(?:quand|où|quoi|combien|qui)[\s.!…]*$/i;
  const FR_LISTEN = /(?:^|[,.!;]\s*)(?:alors |bon |bien )?je vous écoute[\s.!…]*$/i;
  const FR_NOT = /^(?:(?:allô|allo|dites|bonjour|bonsoir|alors|donc|et|ok|bon|euh|oui)[\s,!]+)*(?:bonjour|bonsoir|merci|d'accord|très bien|parfait|super|entendu|oui|non|voilà|(?:est-ce que )?vous (?:m'entendez|me voyez|me recevez)(?: bien| toujours| correctement| clairement| là| maintenant)*|ça marche|c'est noté)[\s,.!?]*$/i;

  function isRecruiterQuestion(text) {
    const raw = String(text == null ? '' : text).replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim();
    if (!raw) return false;
    const parts = raw.split(/(?<=[.!?;…])\s+/).map(p => p.trim()).filter(p => p && !FR_NOT.test(p));
    if (!parts.length) return false;
    if (parts.some(p => /\?[\s"'»)\]]*$/.test(p) && words(p) >= 2)) return true;
    // Relance d'un ou deux mots : seulement un interrogatif seul (« Pourquoi ») ou un verbe + « -vous » (« Êtes-vous mobile »).
    const bare = parts.join(' ').replace(/[\s.!…]+$/, '');
    if (words(bare) < 3 && !/^(?:pourquoi|comment|combien|(?:où |quand |que |qui )?[a-zà-ÿ]+(?:ez|tes)[- ]vous(?: [a-zà-ÿ]+)?)$/i.test(bare)) return false;
    // L'interrogatif de début de phrase compte aussi après une virgule (« Très bien, et côté audit, comment ça se passe »).
    return parts.some(p => FR_Q.test(p) || FR_END.test(p) || FR_LISTEN.test(p) || p.split(/,\s+/).some(x => FR_START.test(x)));
  }

  const JOB_KW = /(?:^|\n)[*_#>\s-]*(?:rep[èe]res?|points?[- ]cl[ée]s?|mots?[- ]cl[ée]s?|à retenir)\s*\**\s*(?:[:：]|[-–](?=\s))/i;
  const JOB_PARTIAL = ['repères:', 'reperes:', 'repère:', 'repere:'];
  function cleanSaid(s) {
    let t = String(s || '').replace(/^[ \t]*(?:[-•*–—]|\d+[.)])[ \t]+(?=\S)/, '').replace(/[*`]+|__/g, '').trim();
    t = t.replace(/^(?:r[ée]ponse(?: propos[ée]e)?|candidat|vous pouvez dire|à dire)\s*:\s*/i, '');
    if (/^["“«]/.test(t)) t = t.replace(/^["“«]\s*/, '').replace(/\s*["”»]$/, '');
    return t.replace(/[ \t]{2,}/g, ' ').trim();
  }
  // Sortie du souffleur : une phrase par ligne, puis « Repères: a; b; c ». Dans chaque ligne, « en » est le
  // texte à dire (nom de clé hérité de l'affichage en sous-titres) ; « fr » reste vide.
  function splitJob(full) {
    let s = String(full || '').replace(/\r/g, '');
    let kw = '';
    const m = s.match(JOB_KW);
    if (m) {
      kw = s.slice(m.index + m[0].length).split('\n')[0];
      s = s.slice(0, m.index);
    } else {
      const nl = s.lastIndexOf('\n');
      const tail = s.slice(nl + 1).replace(/[\s*_#>•–—-]/g, '').toLowerCase();
      if (nl >= 0 && tail && JOB_PARTIAL.some(p => p.indexOf(tail) === 0)) s = s.slice(0, nl);
    }
    const lines = [];
    s.split('\n').map(cleanSaid).filter(Boolean).forEach((l) => {
      // Plusieurs phrases sur une même ligne : une ligne d'affichage par phrase (pas après « M. », « Dr. », « env. »…).
      l.split(/(?<!\b(?:M|MM|Mme|Mmes|Mlle|Dr|Pr|St|Ste|env|etc|cf|av|vs)\.)(?<=[.!?…])\s+(?=["“«(]?[A-ZÀ-Ý0-9])/).map(x => x.trim()).filter(Boolean).forEach(en => lines.push({ en, fr: '' }));
    });
    const seen = new Set();
    const keyWords = kw.replace(/[*`]+|__/g, '').split(kw.includes(';') ? /\s*[;•|]\s*/ : /\s*[,•|]\s*/).map(x => x.replace(/^[\s"“«'.\-–—]+|[\s"”»'.,;]+$/g, '')).filter((k) => {
      const low = k.toLowerCase();
      if (!k || k.length > 60 || seen.has(low)) return false;
      seen.add(low);
      return true;
    }).slice(0, 4);
    return { text: lines.map(l => l.en).join(' '), lines, keyWords };
  }

  // Tours : who 'jury' (recruteur), 'student' (candidat) ou 'mixed' (micro seul : voix non attribuée).
  function jobTurns(turns, max) {
    const label = who => (who === 'jury' ? 'RECRUTEUR : ' : who === 'mixed' ? 'VOIX NON IDENTIFIÉE : ' : 'CANDIDAT : ');
    let s = (Array.isArray(turns) ? turns : []).map(x => (x && x.text ? label(x.who) + String(x.text).trim() : '')).filter(Boolean).join('\n');
    if (max && s.length > max) s = '[…]\n' + s.slice(s.length - max);
    return s;
  }

  const JOB_DOSSIER_MAX = 30000;
  // Coupe au dernier saut de ligne avant la limite : jamais au milieu d'une phrase.
  function cutDossier(d) {
    if (d.length <= JOB_DOSSIER_MAX) return d;
    const head = d.slice(0, JOB_DOSSIER_MAX);
    const i = head.lastIndexOf('\n');
    return (i > 0 ? head.slice(0, i) : head).trimEnd();
  }
  // Forme comparable : minuscules, ponctuation et espaces réduits.
  const normTxt = t => ' ' + String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
  async function jobAnswer(opts) {
    const o = opts || {};
    // Question trop longue : on garde la FIN (la vraie question arrive après un long propos).
    let question = str(o.question);
    if (question.length > 1500) question = '… ' + question.slice(-1498).trimStart();
    if (!question) throw err('NO_QUESTION', 'Aucune question du recruteur à traiter.');
    const dossier = cutDossier(String(o.dossier || '').replace(/\r/g, '').trim());
    const recent = (Array.isArray(o.turns) ? o.turns : []).slice();
    const nq = normTxt(question);
    while (recent.length) {
      const last = recent[recent.length - 1];
      const lt = last && last.who === 'jury' ? normTxt(last.text) : '';
      if (lt.trim() === '' || !nq.includes(lt)) break;
      recent.pop();
    }
    const turns = jobTurns(recent.slice(-10), 2400);
    const prev = o.shorter ? str(o.previous, 1000) : '';
    const size = o.shorter ? '2 phrases, 35 mots au plus' : '3 à 4 phrases, 75 mots au plus';
    // Message système identique d'un appel à l'autre (cache de préfixe) : la taille et la consigne de saut sont dans le prompt.
    const system = [
      'Tu es le souffleur d\'un candidat pendant un entretien d\'embauche en visioconférence. Le candidat lit ta réponse sur son écran, en sous-titres, pendant qu\'il parle au recruteur.',
      'Écris ce que le candidat peut dire maintenant : français oral et naturel, première personne, vouvoiement, dans la taille demandée à la fin du message. Phrases courtes (20 mots au plus), une idée par phrase, faciles à lire d\'un coup d\'œil.',
      'Phrase 1 : la réponse directe à la question. Ensuite : une preuve concrète tirée du DOSSIER (expérience, structure, bailleur, outil, résultat). Aucune formule creuse (« c\'est une excellente question »), aucune liste à puces, aucun titre.',
      'Si le DOSSIER contient une réponse préparée à cette question (pitch, questions probables, réponses types), reprends-la fidèlement : mêmes faits, mêmes arguments, raccourcie pour tenir dans la taille demandée. Pour « présentez-vous », donne le pitch en version courte.',
      'N\'utilise que les faits du DOSSIER et de l\'ÉCHANGE. N\'invente jamais un chiffre, une date, un nom, un diplôme, un outil, une langue parlée ni une durée d\'expérience. Si le DOSSIER ne permet pas de répondre, propose une réponse honnête et prudente (« je ne l\'ai pas encore pratiqué, mais… ») qui s\'appuie sur l\'expérience la plus proche.',
      'Respecte strictement les consignes et les points de vigilance du DOSSIER : ce qu\'il ne faut pas dire, ce qui reste à décider. Sur le salaire, la disponibilité ou tout point marqué comme sensible, donne la formulation prudente prévue par le DOSSIER, sans engager le candidat au-delà. Si le DOSSIER dit qu\'un point n\'est pas tranché (« à décider », « à trancher », plusieurs options), ne choisis jamais à la place du candidat : écris une réponse d\'attente honnête qui ne ferme aucune option, et mets les options dans les Repères. Ne révèle jamais ce que le DOSSIER demande de taire. N\'attribue jamais à un employeur une mission, un bailleur ou un résultat que le DOSSIER rattache à un autre employeur.',
      'Si le recruteur demande au candidat s\'il a des questions, propose 2 ou 3 questions à poser prévues dans le DOSSIER et pas encore traitées dans l\'ÉCHANGE.',
      'Reste cohérent avec ce que le candidat a déjà dit dans l\'ÉCHANGE. Si les paroles du recruteur sont une relance (« pourquoi ? », « un exemple ? », « et côté audit ? »), réponds à la lumière de l\'ÉCHANGE.',
      'Format exact, en texte brut, sans markdown, sans guillemets, sans préambule : une phrase par ligne. Puis une dernière ligne « Repères: a; b; c » avec 3 repères très courts à ne pas oublier (chiffres, noms, mots-clés de la réponse).',
      'Les paroles du recruteur viennent d\'une transcription automatique : si des mots sont faux ou manquent (noms propres, sigles), réponds à la question la plus probable.'
    ].join('\n');
    const skipRule = o.force ? '' : 'Si ces paroles ne sont pas une question ou une demande adressée au candidat (salutation, test du son, remerciement, présentation du poste ou de la structure sans question, transition, ou le candidat qui parle), écris exactement « — » et rien d\'autre.';
    const prompt = [
      dossier ? 'DOSSIER DU CANDIDAT (fiche de préparation, CV, lettre, offre) :\n' + dossier : 'DOSSIER DU CANDIDAT : aucun document importé. Reste général et prudent, sans inventer de parcours.',
      turns ? 'ÉCHANGE RÉCENT (transcription automatique, peut contenir des erreurs) :\n' + turns : '',
      turns.includes('VOIX NON IDENTIFIÉE') ? 'Les lignes « VOIX NON IDENTIFIÉE » viennent d\'un micro seul : ne présume pas qui a dit un fait absent du DOSSIER.' : '',
      prev ? 'RÉPONSE PROPOSÉE JUSTE AVANT (garde la même idée et le même exemple, en plus court) :\n' + prev : '',
      'PAROLES DU RECRUTEUR À L\'INSTANT (transcription automatique) : ' + question,
      '',
      'Écris maintenant la réponse du candidat (' + size + '), une phrase par ligne, puis la ligne « Repères: ».',
      skipRule
    ].filter(Boolean).join('\n');
    let shown = '';
    const onDelta = (full) => {
      if (typeof o.onDelta !== 'function' || (o.signal && o.signal.aborted)) return;
      const p = splitJob(full);
      if (!p.text || isSkip(p.text)) return;
      if (p.text === shown) return;
      shown = p.text;
      try { o.onDelta(p.text, { lines: p.lines, qFr: '' }); } catch (e) {  }
    };
    const r = await call({ purpose: 'live', stream: true, onDelta, system, prompt, temperature: o.shorter ? 0.3 : 0.4, maxTokens: 700, timeoutMs: 15000, budgetMs: 30000, signal: o.signal });
    const parts = splitJob(r.text);
    if (parts.text && isSkip(parts.text)) return { text: '', keyWords: [], skip: true };
    if (!parts.text) throw err('EMPTY', 'L’IA n’a renvoyé aucun texte : appuyez sur « Réessayer ».');
    return { text: parts.text, keyWords: parts.keyWords, skip: false, qFr: '', lines: parts.lines, partial: !!r.partial };
  }

  S.examAI = {
    ready, isRecruiterQuestion, jobAnswer, jobDossierMax: JOB_DOSSIER_MAX,
    _internal: { splitJob }
  };
})(window.AideVisio = window.AideVisio || {});
