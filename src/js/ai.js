(function (S) {
  'use strict';

  const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta';
  const CLAUDE_API = 'https://api.anthropic.com/v1';
  const GROQ_API = 'https://api.groq.com/openai/v1';
  const OPENAI_API = 'https://api.openai.com/v1';
  const CLAUDE_VERSION = '2023-06-01';
  const CACHE_KEY = 'aidevisio.models.v2';
  const PROVIDERS = ['openai', 'gemini', 'claude', 'groq'];
  const LABEL = { openai: 'OpenAI', gemini: 'Gemini', claude: 'Claude', groq: 'Groq' };

  // Modèles (nov. 2026) : les plus rapides d'abord. La découverte (/models) remplace ces listes
  // par ce que la clé voit réellement ; ces listes ne servent qu'avant la 1re découverte.
  const OPENAI_PREF = ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-5.6-luna', 'gpt-5.4-nano', 'gpt-5.5', 'gpt-5-mini', 'gpt-5-nano'];
  const FALLBACK = {
    openai: ['gpt-6-luna', 'gpt-5.4-mini', 'gpt-5.4-nano'],
    gemini: ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash',
      'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'],
    claude: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5', 'claude-sonnet-4-5'],
    groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'moonshotai/kimi-k2-instruct-0905', 'llama-3.3-70b-versatile']
  };
  const WHISPER = ['whisper-large-v3-turbo', 'whisper-large-v3'];

  const config = {
    firstTokenMs: 9000,
    totalMs: 25000,
    idleMs: 20000,
    budgetMs: 75000,
    breakerMs: 5 * 60 * 1000,
    notFoundMs: 6 * 3600 * 1000,
    discoverTtlMs: 12 * 3600 * 1000,
    discoverTimeoutMs: 8000,
    autoDiscover: true,
    // Aide en direct (réponse proposée pendant l'appel) : délais courts, 2e modèle lancé en parallèle
    // seulement si le 1er n'a encore rien écrit après hedgeMs.
    liveFirstTokenMs: 6000,
    liveIdleMs: 8000,
    hedgeMs: 1300,
    slowMs: 2 * 60 * 1000,
    warmMs: 9000
  };

  const breaker = new Map();
  const noThinking = new Set();
  const noMinimal = new Set();
  const deadKeys = {};
  const lastDiscoverTry = { openai: null, gemini: null, claude: null, groq: null };
  let lastOk = null;
  let discovering = null;

  const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  function emit(evt, data) {
    try { if (S.bus && typeof S.bus.emit === 'function') S.bus.emit(evt, data); } catch (e) {  }
  }

  function settings() {
    try { return (S.store && typeof S.store.settings === 'function' && S.store.settings()) || {}; } catch (e) { return {}; }
  }

  function keyOf(p) {
    const s = settings();
    const k = p === 'openai' ? s.openaiKey : p === 'gemini' ? s.geminiKey : p === 'claude' ? s.claudeKey : p === 'groq' ? s.groqKey : '';
    return typeof k === 'string' ? k.trim() : '';
  }

  function fingerprint(k) {
    if (!k) return '';
    let h = 5381;
    for (let i = 0; i < k.length; i++) h = (((h << 5) + h) + k.charCodeAt(i)) >>> 0;
    return h.toString(36) + '.' + k.length;
  }

  function lsGet(k) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {  }
  }

  function clip(s, max) {
    s = String(s == null ? '' : s);
    return s.length > max ? s.slice(0, Math.max(0, max - 1)).trimEnd() + '…' : s;
  }

  function aiError(code, message, extra) {
    const e = new Error(message);
    e.name = 'AIError';
    e.code = code;
    if (extra) Object.keys(extra).forEach(k => { e[k] = extra[k]; });
    return e;
  }

  function abortError() {
    const e = new Error('Requête annulée.');
    e.name = 'AbortError';
    e.code = 'ABORTED';
    return e;
  }

  function isAbort(e) {
    return !!e && (e.name === 'AbortError' || e.code === 'ABORTED');
  }

  const MSG_NETWORK = 'Pas de connexion Internet : vérifiez le Wi-Fi puis réessayez.';

  // Messages pour l'utilisateur : français simple, sans code HTTP ni jargon, avec l'action à faire.
  // kind (QUOTA) : 'minute' (trop de demandes d'un coup), 'credit' (compte à recharger), sinon limite du jour.
  function frMessage(code, provider, status, detail, kind) {
    const L = LABEL[provider] || 'l\'IA';
    const Lc = L.charAt(0).toUpperCase() + L.slice(1);
    switch (code) {
      case 'KEY': return 'Clé ' + L + ' refusée : recopiez-la en entier dans Réglages.';
      case 'QUOTA': {
        if (kind === 'credit') {
          return 'Crédit ' + L + ' épuisé : rechargez votre compte ' + L + (keyOf('gemini') ? '.' : ' ou ajoutez une clé Gemini (gratuite) dans Réglages.');
        }
        if (kind === 'minute') return 'Trop de demandes envoyées à ' + L + ' : patientez une minute puis réessayez.';
        if (provider === 'gemini') {
          return 'Limite gratuite de Gemini atteinte pour aujourd\'hui. Réessayez demain' + (keyOf('openai') ? '.' : ' ou ajoutez une clé OpenAI.');
        }
        if (provider === 'groq') return 'Limite gratuite de Groq atteinte : réessayez dans quelques minutes.';
        return 'Limite ' + L + ' atteinte : patientez une minute puis réessayez.';
      }
      case 'NOT_FOUND': return 'L\'IA ne répond plus à cette adresse. Mettez à jour l\'appli.';
      case 'SERVER': return Lc + ' est surchargé en ce moment : réessayez dans un instant.';
      case 'BAD_REQUEST': return Lc + ' n\'a pas compris la demande : réessayez. Si cela recommence, mettez à jour l\'appli.';
      case 'TIMEOUT': return Lc + ' met trop de temps à répondre : réessayez.';
      case 'NETWORK': return MSG_NETWORK;
      case 'BLOCKED': return Lc + ' a refusé de répondre à cette demande : reformulez-la.';
      case 'EMPTY': return Lc + ' a renvoyé une réponse vide : réessayez.';
      default: return 'Problème inattendu avec ' + L + ' : réessayez.';
    }
  }

  function parseRetryAfter(j, header) {
    let ms = 0;
    try {
      const det = (j && j.error && Array.isArray(j.error.details)) ? j.error.details : [];
      det.forEach(d => {
        const v = d && (d.retryDelay || d.retry_delay);
        const m = v && String(v).match(/^(\d+(?:\.\d+)?)s$/);
        if (m) ms = Math.max(ms, Math.round(parseFloat(m[1]) * 1000));
      });
    } catch (e) {  }
    if (!ms && header) {
      const h = String(header).trim();
      if (/^\d+(?:\.\d+)?$/.test(h)) ms = Math.round(parseFloat(h) * 1000);
      else { const t = Date.parse(h); if (!isNaN(t)) ms = Math.max(0, t - Date.now()); }
    }
    return ms > 0 ? Math.min(ms, 120000) : 0;
  }

  function httpError(provider, model, status, body, retryHeader) {
    const raw = String(body || '');
    let detail = '';
    let parsed = null;
    try {
      const j = JSON.parse(raw);
      parsed = j;
      detail = (j.error && (j.error.message || j.error.type || j.error.status)) || j.message || '';
    } catch (e) { detail = raw.slice(0, 300); }
    const credit = /insufficient_quota|credit balance|exceeded your current quota|billing_hard_limit|payment required/i.test(raw) || status === 402;
    const keySignal = !credit && /API_KEY_INVALID|API key not valid|API key expired|api[_ -]?key|x-api-key|leaked|has not been used|SERVICE_DISABLED|CONSUMER_INVALID|authentication_error|billing/i.test(raw);
    const keyBad = !credit && (status === 401 || status === 403 || (status === 400 && keySignal));
    let code;
    let kind = '';
    if (keyBad) code = 'KEY';
    else if (status === 429 || credit) {
      code = 'QUOTA';
      if (credit) kind = 'credit';
      else if (/PerMinute|per[ _-]minute|PerSecond|requests per min|tokens per min|\bRPM\b|\bTPM\b|rate_limit/i.test(raw) && !/PerDay|per[ _-]day|\bRPD\b|\bTPD\b/i.test(raw)) kind = 'minute';
    }
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 408 || status >= 500) code = 'SERVER';
    else if (status === 400 || status === 413 || status === 422) code = 'BAD_REQUEST';
    else code = 'HTTP';
    const extra = { status, provider, model, keyStrong: status === 401 || keySignal, detail: String(detail || raw).slice(0, 500) };
    if (code === 'QUOTA') { extra.retryAfterMs = parseRetryAfter(parsed, retryHeader); extra.quotaKind = kind || 'day'; }
    return aiError(code, frMessage(code, provider, status, detail, kind), extra);
  }

  function claudeErrStatus(type) {
    switch (type) {
      case 'overloaded_error': return 529;
      case 'rate_limit_error': return 429;
      case 'authentication_error': return 401;
      case 'permission_error': return 403;
      case 'not_found_error': return 404;
      case 'invalid_request_error': return 400;
      case 'request_too_large': return 413;
      default: return 500;
    }
  }

  function makeAttempt(outer, provider, model, streaming) {
    const ctrl = new AbortController();
    let timer = null;
    let firstPending = false;
    const att = { provider, model, signal: ctrl.signal, reason: null, idleMs: config.idleMs, partial: '', first: 0, streaming: !!streaming };
    const abort = (why) => { if (!att.reason) att.reason = why; try { ctrl.abort(); } catch (e) {  } };
    const onOuter = () => abort('user');
    if (outer) { if (outer.aborted) abort('user'); else outer.addEventListener('abort', onOuter); }
    const set = (ms) => { clearTimeout(timer); timer = setTimeout(() => abort('timeout'), ms); };
    att.arm = (ms, waitFirst) => { firstPending = !!waitFirst; set(ms); };
    att.alive = () => { if (att.streaming && !firstPending && att.first) set(att.idleMs); };
    att.gotFirst = () => { if (firstPending) { firstPending = false; set(att.idleMs); } };
    att.abortErr = () => att.reason === 'timeout'
      ? aiError('TIMEOUT', frMessage('TIMEOUT', provider), { provider, model })
      : abortError();
    att.done = () => { clearTimeout(timer); if (outer) outer.removeEventListener('abort', onOuter); };
    return att;
  }

  function guard(p, att) {
    return new Promise((resolve, reject) => {
      if (att.signal.aborted) { p.then(() => {}, () => {}); reject(att.abortErr()); return; }
      const onAbort = () => reject(att.abortErr());
      att.signal.addEventListener('abort', onAbort);
      p.then(v => { att.signal.removeEventListener('abort', onAbort); resolve(v); },
        e => { att.signal.removeEventListener('abort', onAbort); reject(e); });
    });
  }

  async function doFetch(url, init, att) {
    let res;
    try {
      res = await guard(fetch(url, Object.assign({}, init, { signal: att.signal })), att);
    } catch (e) {
      if (att.reason) throw att.abortErr();
      throw aiError('NETWORK', frMessage('NETWORK', att.provider), { provider: att.provider, model: att.model, detail: String((e && e.message) || e) });
    }
    if (!res.ok) {
      let txt = '';
      try { txt = await guard(res.text(), att); } catch (e) { if (att.reason) throw att.abortErr(); }
      let ra = '';
      try { ra = (res.headers && res.headers.get && res.headers.get('retry-after')) || ''; } catch (e) {  }
      throw httpError(att.provider, att.model, res.status, txt, ra);
    }
    return res;
  }

  async function readText(res, att) {
    try { return await guard(res.text(), att); } catch (e) {
      if (att.reason) throw att.abortErr();
      throw aiError('NETWORK', frMessage('NETWORK', att.provider), { provider: att.provider, model: att.model });
    }
  }

  async function readJSON(res, att) {
    const txt = await readText(res, att);
    try { return JSON.parse(txt); } catch (e) {
      throw aiError('SERVER', frMessage('SERVER', att.provider, 0, 'réponse illisible'), { provider: att.provider, model: att.model });
    }
  }

  async function readSSE(res, att, onData) {
    const body = res.body;
    let data = [];
    const dispatch = () => { if (!data.length) return; const d = data.join('\n'); data = []; onData(d); };
    const line = (ln) => {
      if (ln.endsWith('\r')) ln = ln.slice(0, -1);
      if (ln === '') { dispatch(); return; }
      if (ln.charAt(0) === ':') return;
      if (ln.startsWith('data:')) data.push(ln.charAt(5) === ' ' ? ln.slice(6) : ln.slice(5));
    };
    if (!body || typeof body.getReader !== 'function') {
      (await readText(res, att)).split('\n').forEach(line);
      dispatch();
      return;
    }
    const reader = body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        let r;
        try { r = await guard(reader.read(), att); } catch (e) {
          if (att.reason) throw att.abortErr();
          throw aiError('NETWORK', frMessage('NETWORK', att.provider), { provider: att.provider, model: att.model, detail: String((e && e.message) || e) });
        }
        if (r.done) break;
        att.alive();
        buf += dec.decode(r.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { const ln = buf.slice(0, i); buf = buf.slice(i + 1); line(ln); }
      }
      buf += dec.decode();
      if (buf) buf.split('\n').forEach(line);
      dispatch();
    } catch (e) {
      try { const p = reader.cancel(); if (p && p.catch) p.catch(() => {}); } catch (_) {  }
      throw e;
    }
  }

  function readCache() {
    const c = lsGet(CACHE_KEY);
    return (c && typeof c === 'object') ? c : {};
  }

  const EXCLUDE_GEMINI = /image|tts|embed|live|audio|aqa|learnlm|gemma|vision|robotics|computer-use|veo|imagen|lyria|banana|nano|thinking|research|-exp|exp-|customtools|search|translate/i;

  function geminiInfo(id) {
    id = String(id || '').replace(/^models\//, '');
    if (!/^gemini-/.test(id) || EXCLUDE_GEMINI.test(id)) return null;
    let ver, rest;
    const m = id.match(/^gemini-(\d+(?:\.\d+)?)-(.+)$/);
    if (m) { ver = parseFloat(m[1]); rest = m[2]; } else if (/^gemini-(flash|flash-lite|pro)-latest$/.test(id)) { ver = 2.9; rest = id.slice(7); } else return null;
    if (ver < 2) return null;
    const tier = /lite/.test(rest) ? 'lite' : /flash/.test(rest) ? 'flash' : /pro/.test(rest) ? 'pro' : null;
    if (!tier) return null;
    const preview = /preview/.test(rest);
    const dated = /\d{2}-\d{2,4}|-\d{3}$/.test(rest);
    // Mesuré le 09/11/2026 avec la clé de Corentin : gemini-3.8-flash et les alias -latest ne répondent pas (> 40 s).
    const hangs = /^gemini-3\.8-flash$|-latest$/.test(id);
    return { id, ver, tier, score: ver * 100 - (preview ? 2 : 0) - (dated ? 1 : 0) - (hangs ? 1000 : 0) };
  }

  function claudeInfo(id) {
    id = String(id || '');
    let m = id.match(/^claude-(haiku|sonnet|opus)-(\d+)(?:-(\d))?(?:-(\d{8}))?$/);
    if (m) return { id, family: m[1], ver: +m[2] + (m[3] ? +m[3] / 10 : 0), dated: !!m[4] };
    m = id.match(/^claude-(\d)(?:-(\d))?-(haiku|sonnet|opus)(?:-(\d{8}|latest))?$/);
    if (m) return { id, family: m[3], ver: +m[1] + (m[2] ? +m[2] / 10 : 0), dated: !!m[4] && m[4] !== 'latest' };
    return null;
  }

  // gpt-oss-20b est gardé (≈ 1000 jetons/s, très bon en secours rapide) ; les autres petits modèles sont exclus.
  // (Avant : « 20b » excluait aussi gpt-oss-120b, le meilleur modèle Groq.)
  const EXCLUDE_GROQ = /whisper|guard|tts|playai|orpheus|compound|distil|instant|safeguard|allam|embed|vision|audio|-8b|-1b|-3b|mini|scout/i;
  function groqInfo(id) {
    id = String(id || '');
    if (!id || EXCLUDE_GROQ.test(id)) return null;
    if (/(^|[^0-9])20b/i.test(id) && !/gpt-oss-20b/i.test(id)) return null;
    // Llama 3.3 70B est retiré des offres gratuites de Groq (2026) : en dernier.
    const score = /gpt-oss-120b/.test(id) ? 90 : /gpt-oss-20b/.test(id) ? 87 : /kimi-k/.test(id) ? 84 : /qwen3/.test(id) ? 70 : /llama-4-maverick/.test(id) ? 68 : /llama-3\.3-70b/.test(id) ? 60 : 40;
    return { id, score: score + (/\d{4}$/.test(id) ? 1 : 0) };
  }
  function rankGroq(ids, n) {
    return (ids || []).map(groqInfo).filter(Boolean).sort((a, b) => b.score - a.score).map(i => i.id).slice(0, n || 3);
  }

  function rankOpenai(ids) {
    const have = new Set(ids || []);
    const list = OPENAI_PREF.filter(m => have.has(m));
    return (list.length ? list : FALLBACK.openai).slice(0, 3);
  }

  function bestPerVersion(infos, scoreFn) {
    const by = {};
    infos.forEach(i => {
      const k = (i.tier || i.family) + '@' + i.ver;
      if (!by[k] || scoreFn(i) > scoreFn(by[k])) by[k] = i;
    });
    return Object.keys(by).map(k => by[k]).sort((a, b) => scoreFn(b) - scoreFn(a));
  }

  function rankGemini(ids, purpose) {
    const infos = (ids || []).map(geminiInfo).filter(Boolean);
    const tier = t => bestPerVersion(infos.filter(i => i.tier === t), i => i.score).map(i => i.id);
    const flash = tier('flash');
    const lite = tier('lite');
    const pro = bestPerVersion(infos.filter(i => i.tier === 'pro' && i.ver >= 2.5), i => i.score).map(i => i.id);
    if (purpose === 'fast' || purpose === 'live') return lite.slice(0, 3).concat(flash.slice(0, 3));
    if (purpose === 'prep') return flash.slice(0, 4).concat(pro.slice(0, 1), lite.slice(0, 1));
    return flash.slice(0, 5).concat(lite.slice(0, 2));
  }

  function rankClaude(ids, purpose) {
    const infos = (ids || []).map(claudeInfo).filter(i => i && i.ver >= 3.5 && i.family !== 'opus');
    const fam = f => bestPerVersion(infos.filter(i => i.family === f), i => i.ver * 10 - (i.dated ? 0.5 : 0)).map(i => i.id);
    const haiku = fam('haiku');
    const sonnet = fam('sonnet');
    if (purpose === 'prep') return sonnet.slice(0, 2).concat(haiku.slice(0, 1));
    return haiku.slice(0, 2).concat(sonnet.slice(0, 1));
  }

  function usable(p, ids) {
    if (p === 'groq') return rankGroq(ids, 6);
    if (p === 'openai') return rankOpenai(ids);
    if (p === 'gemini') {
      return (ids || []).map(geminiInfo).filter(Boolean)
        .sort((a, b) => (a.tier === b.tier ? b.score - a.score : ['flash', 'lite', 'pro'].indexOf(a.tier) - ['flash', 'lite', 'pro'].indexOf(b.tier)))
        .map(i => i.id);
    }
    return (ids || []).map(claudeInfo).filter(i => i && i.ver >= 3.5)
      .sort((a, b) => (a.family === b.family ? b.ver - a.ver : ['haiku', 'sonnet', 'opus'].indexOf(a.family) - ['haiku', 'sonnet', 'opus'].indexOf(b.family)))
      .map(i => i.id);
  }

  function modelsFor(p) {
    const c = readCache()[p];
    const k = keyOf(p);
    if (c && Array.isArray(c.ids) && c.ids.length && (!k || c.fp === fingerprint(k))) return c.ids;
    return FALLBACK[p];
  }

  function providerOrder(s, purpose) {
    const pref = (s || settings()).provider;
    if (pref === 'claude') return ['claude', 'openai', 'gemini', 'groq'];
    if (pref === 'groq') return ['groq', 'openai', 'gemini', 'claude'];
    if (pref === 'gemini') return ['gemini', 'openai', 'claude', 'groq'];
    // Pendant l'appel, la vitesse prime. Mesuré le 10/11/2026 (réponse entière) : Groq 0,5 à 1,2 s,
    // Gemini lite 1,5 s, OpenAI 1,5 à 6 s. Quota Groq atteint : refus immédiat, le suivant prend le relais.
    if (purpose === 'live' || purpose === 'fast') return ['groq', 'gemini', 'openai', 'claude'];
    return ['openai', 'gemini', 'claude', 'groq'];
  }

  // 'live' = aide en direct pendant l'appel (réponse proposée) : modèle choisi comme 'answer' dans les réglages.
  function settingPurpose(purpose) {
    return purpose === 'fast' ? 'fast' : purpose === 'prep' ? 'prep' : 'answer';
  }

  function parseModelRef(ref) {
    if (!ref) return null;
    const provOf = (m) => /^claude/.test(m) ? 'claude' : /^gemini|^models\//.test(m) ? 'gemini' : /^(gpt-|o\d|chatgpt)/.test(m) ? 'openai' : 'groq';
    if (typeof ref === 'object' && ref.model) return { provider: ref.provider || provOf(ref.model), model: ref.model };
    const s = String(ref).trim();
    if (!s || s === 'auto') return null;
    const m = s.match(/^(openai|gemini|claude|groq):(.+)$/);
    if (m) return { provider: m[1], model: m[2] };
    return { provider: provOf(s), model: s.replace(/^models\//, '') };
  }

  function rankAll(purpose, keysOnly) {
    const s = settings();
    const provs = providerOrder(s, purpose).filter(p => !keysOnly || keyOf(p));
    let list = [];
    provs.forEach(p => {
      const ids = modelsFor(p);
      (p === 'openai' ? rankOpenai(ids) : p === 'gemini' ? rankGemini(ids, purpose) : p === 'claude' ? rankClaude(ids, purpose) : rankGroq(ids)).forEach(m => list.push({ provider: p, model: m }));
    });
    const pref = parseModelRef(s.models && s.models[settingPurpose(purpose)]);
    if (pref && (!keysOnly || keyOf(pref.provider))) {
      list = [pref].concat(list.filter(c => !(c.provider === pref.provider && c.model === pref.model)));
    }
    return list;
  }

  const bk = c => c.provider + ':' + c.model;

  function order(list) {
    const t = Date.now();
    return list.map((c, i) => {
      let pen = 0;
      const b = breaker.get(bk(c));
      if (b) { if (b.until > t) pen += 1000; else breaker.delete(bk(c)); }
      const dk = deadKeys[c.provider];
      if (dk && dk === fingerprint(keyOf(c.provider))) pen += 2000;
      return { c, s: i + pen };
    }).sort((a, b) => a.s - b.s).map(x => x.c);
  }

  function trip(c, ms, code) {
    breaker.set(bk(c), { until: Date.now() + ms, code });
  }

  function partMime(p) {
    const d = p && (p.inline_data || p.inlineData);
    return d ? String(d.mime_type || d.mimeType || '') : '';
  }

  function claudeMediaOk(mime) {
    return mime === 'application/pdf' || /^image\/(png|jpeg|gif|webp)$/.test(mime);
  }

  function supportsParts(provider, parts) {
    if (provider === 'gemini') return true;
    if (provider === 'groq' || provider === 'openai') return (parts || []).every(p => p && typeof p.text === 'string');
    return (parts || []).every(p => p && (typeof p.text === 'string' || claudeMediaOk(partMime(p))));
  }

  function pick(purpose) {
    const anyKey = PROVIDERS.some(p => keyOf(p));
    return order(rankAll(purpose || 'answer', anyKey));
  }

  function candidates(o) {
    let list = rankAll(o.purpose || 'answer', true);
    if (o.providers) list = list.filter(c => o.providers.indexOf(c.provider) >= 0);
    if (o.parts && o.parts.length) list = list.filter(c => supportsParts(c.provider, o.parts));
    if (o.liteOnly) {
      const pref = parseModelRef(settings().models && settings().models[settingPurpose(o.purpose)]);
      const keep = list.filter(c => /lite/i.test(c.model) || (pref && c.provider === pref.provider && c.model === pref.model));
      list = keep.length ? keep.concat(list.filter(c => keep.indexOf(c) < 0)) : list;
    }
    const forced = parseModelRef(o.model);
    if (forced && keyOf(forced.provider) && (!o.providers || o.providers.indexOf(forced.provider) >= 0)) {
      list = [forced].concat(list.filter(c => !(c.provider === forced.provider && c.model === forced.model)));
    }
    return o.ignoreBreaker ? list : order(list);
  }

  // Réflexion Gemini : 'minimal' (Flash / Flash-Lite) pour l'aide en direct et les tâches rapides,
  // 'low' sinon. Pro n'accepte pas 'minimal'.
  function thinkingFor(model, purpose) {
    const m = String(model || '');
    if (/^gemini-([3-9]|\d{2,})/.test(m)) {
      return { thinkingLevel: (purpose === 'live' || purpose === 'fast') && !/pro/.test(m) ? 'minimal' : 'low' };
    }
    if (/2\.5/.test(m)) return /pro/.test(m) ? { thinkingBudget: 128 } : { thinkingBudget: 0 };
    return null;
  }

  async function listGemini(key) {
    const ids = [];
    let token = '';
    for (let page = 0; page < 4; page++) {
      const att = makeAttempt(null, 'gemini', 'models', false);
      att.arm(config.discoverTimeoutMs, false);
      try {
        const res = await doFetch(GEMINI_API + '/models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''),
          { method: 'GET', headers: { 'x-goog-api-key': key } }, att);
        const j = await readJSON(res, att);
        (j.models || []).forEach(m => {
          const methods = m.supportedGenerationMethods;
          if (!methods || methods.indexOf('generateContent') >= 0) ids.push(String(m.name || '').replace(/^models\//, ''));
        });
        token = j.nextPageToken || '';
      } finally { att.done(); }
      if (!token) break;
    }
    return ids;
  }

  async function listGroq(key) {
    const att = makeAttempt(null, 'groq', 'models', false);
    att.arm(config.discoverTimeoutMs, false);
    try {
      const res = await doFetch(GROQ_API + '/models', { method: 'GET', headers: { Authorization: 'Bearer ' + key } }, att);
      const j = await readJSON(res, att);
      return (j.data || []).filter(m => m && m.id && m.active !== false).map(m => String(m.id));
    } finally { att.done(); }
  }

  async function listOpenai(key) {
    const att = makeAttempt(null, 'openai', 'models', false);
    att.arm(config.discoverTimeoutMs, false);
    try {
      const res = await doFetch(OPENAI_API + '/models', { method: 'GET', headers: { Authorization: 'Bearer ' + key } }, att);
      const j = await readJSON(res, att);
      return (j.data || []).filter(m => m && m.id).map(m => String(m.id));
    } finally { att.done(); }
  }

  async function listClaude(key) {
    const ids = [];
    let after = '';
    for (let page = 0; page < 4; page++) {
      const att = makeAttempt(null, 'claude', 'models', false);
      att.arm(config.discoverTimeoutMs, false);
      try {
        const res = await doFetch(CLAUDE_API + '/models?limit=100' + (after ? '&after_id=' + encodeURIComponent(after) : ''),
          { method: 'GET', headers: claudeHeaders(key, false) }, att);
        const j = await readJSON(res, att);
        (j.data || []).forEach(m => { if (m && m.id) ids.push(String(m.id)); });
        after = j.has_more ? (j.last_id || '') : '';
      } finally { att.done(); }
      if (!after) break;
    }
    return ids;
  }

  function discover(opts) {
    opts = opts || {};
    if (discovering && !opts.force) return discovering;
    const run = (async () => {
      const cache = readCache();
      const out = { openai: [], gemini: [], claude: [], groq: [] };
      for (const p of PROVIDERS) {
        const k = keyOf(p);
        if (!k) continue;
        const fp = fingerprint(k);
        const c = cache[p];
        const fresh = c && c.fp === fp && Array.isArray(c.ids) && c.ids.length && (Date.now() - (c.at || 0) < config.discoverTtlMs);
        if (fresh && !opts.force) { out[p] = c.ids; continue; }
        lastDiscoverTry[p] = { at: Date.now(), fp };
        try {
          const ids = usable(p, p === 'openai' ? await listOpenai(k) : p === 'gemini' ? await listGemini(k) : p === 'claude' ? await listClaude(k) : await listGroq(k));
          if (ids.length) cache[p] = { at: Date.now(), fp, ids };
          out[p] = ids.length ? ids : (c && c.fp === fp && c.ids) || [];
        } catch (e) {
          if (e && e.code === 'KEY') {
            deadKeys[p] = fp;
            emit('ai:keyerror', { provider: p, status: e.status, message: e.message });
          }
          out[p] = (c && c.fp === fp && c.ids) || [];
        }
      }
      lsSet(CACHE_KEY, cache);
      return out;
    })();
    discovering = run;
    run.then(() => { if (discovering === run) discovering = null; }, () => { if (discovering === run) discovering = null; });
    return run;
  }

  function maybeAutoDiscover() {
    if (!config.autoDiscover || discovering) return;
    const cache = readCache();
    const t = Date.now();
    const stale = PROVIDERS.some(p => {
      const k = keyOf(p);
      if (!k) return false;
      const c = cache[p];
      const ok = c && c.fp === fingerprint(k) && (t - (c.at || 0) < config.discoverTtlMs);
      const lt = lastDiscoverTry[p];
      const throttled = lt && lt.fp === fingerprint(k) && t - lt.at <= 10 * 60 * 1000;
      return !ok && !throttled;
    });
    if (stale) discover().catch(() => {});
  }

  function geminiBody(model, o, v) {
    const gc = {};
    if (typeof o.temperature === 'number') gc.temperature = o.temperature;
    let max = v.maxTokens || o.maxTokens || 1024;
    let th = v.thinking ? thinkingFor(model, o.purpose) : null;
    if (th && th.thinkingLevel && v.thinkLevel) th = { thinkingLevel: v.thinkLevel };
    if (th) {
      gc.thinkingConfig = th;
      if (th.thinkingLevel) max += th.thinkingLevel === 'minimal' ? 1024 : 8192; else if (th.thinkingBudget) max += th.thinkingBudget * 2;
    }
    gc.maxOutputTokens = max;
    if (o.json) gc.responseMimeType = 'application/json';
    const contents = [];
    const add = (role, parts) => {
      const last = contents[contents.length - 1];
      if (last && last.role === role) last.parts = last.parts.concat(parts); else contents.push({ role, parts });
    };
    (o.history || []).forEach(h => {
      if (h && h.text) add(h.role === 'model' || h.role === 'assistant' ? 'model' : 'user', [{ text: String(h.text) }]);
    });
    const parts = (o.parts || []).slice();
    if (o.prompt) parts.push({ text: String(o.prompt) });
    if (!parts.length) parts.push({ text: '…' });
    add('user', parts);
    if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(Début de la conversation.)' }] });
    const body = { contents, generationConfig: gc };
    if (o.system) body.systemInstruction = { parts: [{ text: String(o.system) }] };
    return body;
  }

  async function geminiRequest(model, o, v, att) {
    const body = geminiBody(model, o, v);
    const url = GEMINI_API + '/models/' + encodeURIComponent(model) + (o.stream ? ':streamGenerateContent?alt=sse' : ':generateContent');
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keyOf('gemini') },
      body: JSON.stringify(body)
    }, att);
    let full = '';
    let finish = null;
    const take = (j) => {
      if (j.error) throw httpError('gemini', model, Number(j.error.code) || 500, JSON.stringify(j));
      if (j.promptFeedback && j.promptFeedback.blockReason) throw aiError('BLOCKED', frMessage('BLOCKED', 'gemini'), { provider: 'gemini', model });
      const c = j.candidates && j.candidates[0];
      if (!c) return '';
      if (c.finishReason) finish = c.finishReason;
      let t = '';
      ((c.content && c.content.parts) || []).forEach(p => { if (p && typeof p.text === 'string' && !p.thought) t += p.text; });
      return t;
    };
    if (o.stream) {
      await readSSE(res, att, (d) => {
        if (!d || d === '[DONE]') return;
        let j;
        try { j = JSON.parse(d); } catch (e) { return; }
        const t = take(j);
        if (t) { full += t; att.onText(full); }
      });
    } else {
      full = take(await readJSON(res, att));
    }
    if (!full.trim()) {
      if (finish && /SAFETY|BLOCK|PROHIBITED|RECITATION|SPII/.test(finish)) throw aiError('BLOCKED', frMessage('BLOCKED', 'gemini'), { provider: 'gemini', model });
      if (!o.allowEmpty) throw aiError('EMPTY', frMessage('EMPTY', 'gemini'), { provider: 'gemini', model, finish });
    }
    return { text: full, finish };
  }

  function claudeHeaders(key, json) {
    const h = {
      'x-api-key': key,
      'anthropic-version': CLAUDE_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    if (json) h['content-type'] = 'application/json';
    return h;
  }

  function claudeBlock(p) {
    if (!p) return null;
    if (typeof p.text === 'string') return { type: 'text', text: p.text };
    const d = p.inline_data || p.inlineData;
    if (!d) return null;
    const mime = partMime(p);
    const source = { type: 'base64', media_type: mime, data: d.data };
    if (mime === 'application/pdf') return { type: 'document', source };
    if (/^image\//.test(mime)) return { type: 'image', source };
    return null;
  }

  const JSON_ONLY = 'IMPORTANT : réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après et sans balises de code.';

  function claudeBody(model, o, v) {
    let system = o.system ? String(o.system) : '';
    if (o.json) system += (system ? '\n\n' : '') + JSON_ONLY;
    const messages = [];
    const add = (role, blocks) => {
      const last = messages[messages.length - 1];
      if (last && last.role === role) last.content = last.content.concat(blocks); else messages.push({ role, content: blocks });
    };
    (o.history || []).forEach(h => {
      if (h && h.text) add(h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user', [{ type: 'text', text: String(h.text) }]);
    });
    const blocks = [];
    (o.parts || []).forEach(p => { const b = claudeBlock(p); if (b) blocks.push(b); });
    if (o.prompt) blocks.push({ type: 'text', text: String(o.prompt) });
    if (!blocks.length) blocks.push({ type: 'text', text: '…' });
    add('user', blocks);
    if (messages[0].role !== 'user') messages.unshift({ role: 'user', content: [{ type: 'text', text: '(Début de la conversation.)' }] });
    const body = { model, max_tokens: v.maxTokens || o.maxTokens || 1024, messages };
    if (system) body.system = system;
    if (typeof o.temperature === 'number' && !v.noTemperature) body.temperature = Math.max(0, Math.min(1, o.temperature));
    if (o.stream) body.stream = true;
    return body;
  }

  async function claudeRequest(model, o, v, att) {
    const body = claudeBody(model, o, v);
    const res = await doFetch(CLAUDE_API + '/messages', {
      method: 'POST', headers: claudeHeaders(keyOf('claude'), true), body: JSON.stringify(body)
    }, att);
    let full = '';
    let stop = null;
    if (o.stream) {
      await readSSE(res, att, (d) => {
        let j;
        try { j = JSON.parse(d); } catch (e) { return; }
        if (j.type === 'content_block_delta') {
          if (j.delta && j.delta.type === 'text_delta' && j.delta.text) { full += j.delta.text; att.onText(full); }
        } else if (j.type === 'message_delta') {
          if (j.delta && j.delta.stop_reason) stop = j.delta.stop_reason;
        } else if (j.type === 'error') {
          throw httpError('claude', model, claudeErrStatus(j.error && j.error.type), JSON.stringify(j));
        }
      });
    } else {
      const j = await readJSON(res, att);
      if (j.type === 'error') throw httpError('claude', model, claudeErrStatus(j.error && j.error.type), JSON.stringify(j));
      full = (j.content || []).filter(b => b && b.type === 'text').map(b => b.text).join('');
      stop = j.stop_reason || null;
    }
    if (!full.trim()) {
      if (stop === 'refusal') throw aiError('BLOCKED', frMessage('BLOCKED', 'claude'), { provider: 'claude', model });
      if (!o.allowEmpty) throw aiError('EMPTY', frMessage('EMPTY', 'claude'), { provider: 'claude', model, finish: stop });
    }
    return { text: full, finish: stop };
  }

  function groqBody(model, o, v, provider) {
    let system = o.system ? String(o.system) : '';
    if (o.json) system += (system ? '\n\n' : '') + JSON_ONLY;
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    (o.history || []).forEach(h => {
      if (h && h.text) messages.push({ role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user', content: String(h.text) });
    });
    const text = (o.parts || []).filter(p => p && typeof p.text === 'string').map(p => p.text).concat(o.prompt ? [String(o.prompt)] : []).join('\n\n');
    messages.push({ role: 'user', content: text || '…' });
    const openai = provider === 'openai';
    const gpt5 = openai && /^gpt-([5-9]|\d\d)/.test(model);
    const body = { model, messages };
    body[openai ? 'max_completion_tokens' : 'max_tokens'] = v.maxTokens || o.maxTokens || 1024;
    if (gpt5 && !v.noReasoning) body.reasoning_effort = /^gpt-5(-|$)/.test(model) ? 'minimal' : 'none';
    if (typeof o.temperature === 'number' && !v.noTemperature && !gpt5) body.temperature = Math.max(0, Math.min(1, o.temperature));
    if (o.json && !v.noJsonMode) body.response_format = { type: 'json_object' };
    if (/gpt-oss/.test(model) && !v.noReasoning) { body.reasoning_effort = 'low'; body.include_reasoning = false; }
    if (o.stream) body.stream = true;
    return body;
  }

  async function groqRequest(model, o, v, att, provider) {
    provider = provider || 'groq';
    const res = await doFetch((provider === 'openai' ? OPENAI_API : GROQ_API) + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + keyOf(provider) },
      body: JSON.stringify(groqBody(model, o, v, provider))
    }, att);
    let full = '';
    let finish = null;
    if (o.stream) {
      await readSSE(res, att, (d) => {
        if (!d || d === '[DONE]') return;
        let j;
        try { j = JSON.parse(d); } catch (e) { return; }
        if (j.error) throw httpError(provider, model, Number(j.error.code) || 500, JSON.stringify(j));
        const c = j.choices && j.choices[0];
        if (!c) return;
        if (c.finish_reason) finish = c.finish_reason;
        const t = c.delta && typeof c.delta.content === 'string' ? c.delta.content : '';
        if (t) { full += t; att.onText(full); }
      });
    } else {
      const j = await readJSON(res, att);
      const c = j.choices && j.choices[0];
      full = (c && c.message && c.message.content) || '';
      finish = (c && c.finish_reason) || null;
    }
    if (!full.trim() && !o.allowEmpty) throw aiError('EMPTY', frMessage('EMPTY', provider), { provider, model, finish });
    return { text: full, finish };
  }

  const whisperCalls = [];
  function whisperRecent(ms) { const cut = Date.now() - ms; while (whisperCalls.length && whisperCalls[0] < cut) whisperCalls.shift(); return whisperCalls.length; }
  // Clé Groq refusée (401) et pas changée depuis : inutile de renvoyer l'audio à Whisper.
  const groqKeyDead = () => !!deadKeys.groq && deadKeys.groq === fingerprint(keyOf('groq'));
  async function groqWhisper(wavBlob, hint, signal, timeoutMs, lang) {
    let lastErr = null;
    whisperCalls.push(Date.now());
    for (const model of WHISPER) {
      const b = breaker.get('groq:' + model);
      if (b && b.until > Date.now()) continue;
      const att = makeAttempt(signal, 'groq', model, false);
      att.arm(timeoutMs || 12000, false);
      try {
        const fd = new FormData();
        fd.append('file', wavBlob, 'segment.wav');
        fd.append('model', model);
        fd.append('language', lang || 'en');
        fd.append('response_format', 'json');
        fd.append('temperature', '0');
        if (hint) fd.append('prompt', hint.slice(0, 600));
        const t0 = now();
        const res = await doFetch(GROQ_API + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + keyOf('groq') }, body: fd }, att);
        const j = await readJSON(res, att);
        emit('ai:status', { provider: 'groq', model, ok: true, ms: Math.round(now() - t0), purpose: 'fast', error: null });
        if (deadKeys.groq) delete deadKeys.groq;
        return { text: String(j.text || ''), model, provider: 'groq', ms: Math.round(now() - t0) };
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        lastErr = e;
        emit('ai:status', { provider: 'groq', model, ok: false, purpose: 'fast', error: e && e.message, code: e && e.code });
        if (e && e.code === 'KEY') {
          if (e.keyStrong) {
            // Une seule alerte par clé refusée.
            const fp = fingerprint(keyOf('groq'));
            if (deadKeys.groq !== fp) {
              deadKeys.groq = fp;
              emit('ai:keyerror', { provider: 'groq', status: e.status, message: e.message });
            }
          }
          break;
        }
        if (e && (e.code === 'QUOTA' || e.code === 'SERVER' || e.code === 'TIMEOUT')) trip({ provider: 'groq', model }, config.breakerMs, e.code);
      } finally { att.done(); }
    }
    throw lastErr || aiError('ALL_FAILED', 'La transcription est indisponible pour le moment : réessayez dans un instant.');
  }

  async function callOnce(c, o, v) {
    const stream = !!o.stream;
    const att = makeAttempt(o.signal, c.provider, c.model, stream);
    att.idleMs = o.idleMs || config.idleMs;
    att.onText = (full) => {
      if (!att.first) { att.first = now(); att.gotFirst(); }
      att.partial = full;
      if (o.onDelta) { try { o.onDelta(full); } catch (e) {  } }
    };
    if (stream) att.arm(o.firstTokenMs || o.timeoutMs || config.firstTokenMs, true);
    else att.arm(o.timeoutMs || config.totalMs, false);
    try {
      const r = c.provider === 'gemini' ? await geminiRequest(c.model, o, v, att)
        : c.provider === 'groq' || c.provider === 'openai' ? await groqRequest(c.model, o, v, att, c.provider) : await claudeRequest(c.model, o, v, att);
      r.firstAt = att.first || now();
      return r;
    } catch (e) {
      if (att.partial && e && typeof e === 'object') e.partialText = att.partial;
      throw e;
    } finally {
      att.done();
    }
  }

  const TRUNCATED = /^(MAX_TOKENS|max_tokens|length)$/;

  async function tryCandidate(c, o) {
    const v = { thinking: c.provider === 'gemini' && !noThinking.has(c.model), noTemperature: false, maxTokens: 0, thinkLevel: noMinimal.has(c.model) ? 'low' : '' };
    let firstTruncated = null;
    for (let i = 0; i < 5; i++) {
      try {
        const r = await callOnce(c, o, v);
        if (c.provider === 'gemini' && !v.thinking && thinkingFor(c.model)) noThinking.add(c.model);
        // Aide en direct : pas de 2e appel pour une réponse un peu longue, on garde ce qui est écrit.
        if (TRUNCATED.test(String(r.finish || '')) && !v.bigTokens && o.purpose !== 'live') {
          v.bigTokens = true;
          v.maxTokens = Math.max(8192, (o.maxTokens || 1024) * 4);
          emit('ai:status', { provider: c.provider, model: c.model, ok: false, purpose: o.purpose, error: 'réponse tronquée, relance', code: 'TRUNCATED' });
          firstTruncated = r;
          continue;
        }
        if (TRUNCATED.test(String(r.finish || ''))) r.truncated = true;
        return r;
      } catch (e) {
        // Relance ratée : la 1re réponse sert de texte partiel ; generate() bascule et ne la rend qu'en dernier recours.
        if (firstTruncated && !isAbort(e) && !(o.signal && o.signal.aborted)) {
          const ft = String(firstTruncated.text || '');
          if (e && typeof e === 'object' && !(e.partialText && e.partialText.length > ft.length)) e.partialText = ft;
          throw e;
        }
        if (!e || e.code !== 'BAD_REQUEST' || e.partialText) throw e;
        const d = String(e.detail || '');
        if (!v.maxTokens && /max_?(?:output_?)?tokens|maxOutputTokens/i.test(d) && (o.maxTokens || 0) > 8192) { v.maxTokens = 8192; continue; }
        if (c.provider === 'gemini' && v.thinking && !v.thinkLevel && /minimal|thinking/i.test(d)) {
          const th = thinkingFor(c.model, o.purpose);
          if (th && th.thinkingLevel === 'minimal') { v.thinkLevel = 'low'; noMinimal.add(c.model); continue; }
        }
        if (c.provider === 'gemini' && v.thinking && thinkingFor(c.model)) { v.thinking = false; continue; }
        if (c.provider === 'claude' && !v.noTemperature && /temperature/i.test(d)) { v.noTemperature = true; continue; }
        if (c.provider === 'groq' && !v.noReasoning && /gpt-oss/.test(c.model) && /reasoning/i.test(d)) { v.noReasoning = true; continue; }
        if (c.provider === 'openai' && !v.noReasoning && /reasoning/i.test(d)) { v.noReasoning = true; continue; }
        if (c.provider === 'openai' && !v.noTemperature && /temperature/i.test(d)) { v.noTemperature = true; continue; }
        if ((c.provider === 'groq' || c.provider === 'openai') && o.json && !v.noJsonMode && /response_format|json/i.test(d)) { v.noJsonMode = true; continue; }
        throw e;
      }
    }
    throw aiError('BAD_REQUEST', frMessage('BAD_REQUEST', c.provider), { provider: c.provider, model: c.model });
  }

  function noKeyError(o) {
    if (o.providers && o.providers.length === 1 && o.providers[0] === 'gemini') {
      return aiError('NO_KEY', 'Cette fonction demande une clé Gemini (gratuite sur aistudio.google.com/apikey) : ajoutez-la dans Réglages.');
    }
    if (o.parts && o.parts.length && PROVIDERS.some(p => keyOf(p))) {
      return aiError('NO_KEY', 'Pour lire ce fichier, ajoutez une clé Gemini (gratuite) dans Réglages.');
    }
    return aiError('NO_KEY', 'Aucune clé IA : ajoutez une clé Gemini (gratuite) ou OpenAI dans Réglages.');
  }

  // Quand tout a échoué, on ne montre qu'une cause : celle sur laquelle l'utilisateur peut agir.
  const CAUSE_ORDER = ['KEY', 'QUOTA', 'NETWORK', 'NOT_FOUND', 'TIMEOUT', 'SERVER', 'BLOCKED', 'EMPTY', 'BAD_REQUEST'];
  function mainCause(errors) {
    let best = errors[errors.length - 1];
    let rank = 99;
    errors.forEach(e => {
      const r = CAUSE_ORDER.indexOf(e.code);
      if (r >= 0 && r < rank) { rank = r; best = e; }
    });
    return best;
  }

  function allFailed(errors) {
    if (!errors.length) return aiError('ALL_FAILED', 'L\'IA est indisponible pour le moment : réessayez dans un instant.');
    const last = errors[errors.length - 1];
    if (errors.every(e => e.code === 'KEY')) {
      return aiError('KEY', errors[0].message, { errors, provider: errors[0].provider, model: errors[0].model, status: errors[0].status });
    }
    if (errors.every(e => e.code === 'QUOTA')) {
      const ra = errors.reduce((m, e) => Math.max(m, e.retryAfterMs || 0), 0);
      const q = mainCause(errors.filter(e => e.quotaKind !== 'minute').length ? errors.filter(e => e.quotaKind !== 'minute') : errors);
      return aiError('QUOTA', q.message, { errors, provider: q.provider, model: q.model, status: 429, retryAfterMs: ra, reason: 'QUOTA', quotaKind: q.quotaKind });
    }
    const cause = mainCause(errors);
    return aiError('ALL_FAILED', cause.message || 'L\'IA est indisponible pour le moment : réessayez dans un instant.',
      { errors, provider: cause.provider || last.provider, model: cause.model || last.model, reason: cause.code, status: cause.status });
  }

  // Une tentative isolée (son propre AbortController) dont les morceaux de texte ne passent
  // à l'appelant que si elle a « pris la main » (1re à écrire). Sert à la course de l'aide en direct.
  function startAttempt(c, o, gate) {
    const ctrl = new AbortController();
    const onOuter = () => { try { ctrl.abort(); } catch (e) {  } };
    if (o.signal) { if (o.signal.aborted) onOuter(); else o.signal.addEventListener('abort', onOuter); }
    const a = { c, cancelled: false, t0: now() };
    const so = Object.assign({}, o, {
      signal: ctrl.signal,
      onDelta: (full) => {
        if (!gate.owner) { gate.owner = a; gate.claimed(a); }
        if (gate.owner !== a) return;
        if (o.onDelta) { try { o.onDelta(full); } catch (e) {  } }
      }
    });
    a.cancel = () => { a.cancelled = true; try { ctrl.abort(); } catch (e) {  } };
    a.p = tryCandidate(c, so).then(r => ({ a, r }), e => ({ a, e }))
      .then(x => { if (o.signal) o.signal.removeEventListener('abort', onOuter); return x; });
    return a;
  }

  // Course « au premier qui écrit » : lance c ; si rien n'est écrit après hedgeMs, lance backup en parallèle.
  // Le 1er à écrire gagne, l'autre est annulé. Renvoie la liste des issues (gagnant ou échecs).
  async function race(c, backup, o) {
    let onClaim = null;
    const gate = { owner: null, claimed: (a) => { if (onClaim) onClaim(a); } };
    const runs = [startAttempt(c, o, gate)];
    const out = [];
    const pending = new Set([runs[0]]);
    const settle = (x) => { pending.delete(x.a); out.push(x); return x; };
    let hedgeTimer = null;
    const hedge = backup ? new Promise(res => { hedgeTimer = setTimeout(() => res('hedge'), config.hedgeMs); }) : null;
    const claimed = new Promise(res => { onClaim = (a) => res({ claim: a }); });
    let hedged = false;
    try {
      for (;;) {
        const waiters = Array.from(pending).map(a => a.p.then(x => ({ done: x })));
        if (hedge && !hedged && !gate.owner) waiters.push(hedge);
        if (!gate.owner) waiters.push(claimed);
        if (!waiters.length) break;
        const w = await Promise.race(waiters);
        if (w === 'hedge') {
          hedged = true;
          if (!gate.owner && pending.size && !(o.signal && o.signal.aborted)) {
            const b = startAttempt(backup, o, gate);
            runs.push(b);
            pending.add(b);
            emit('ai:status', { provider: c.provider, model: c.model, ok: false, purpose: o.purpose, error: 'lent, 2e modèle lancé en parallèle', code: 'HEDGE' });
          }
          continue;
        }
        if (w.claim) {
          runs.forEach(a => { if (a !== w.claim && pending.has(a)) a.cancel(); });
          continue;
        }
        const x = settle(w.done);
        if (x.r) {
          pending.forEach(a => a.cancel());
          break;
        }
        if (!pending.size) break;
      }
      // Récupère les issues des tentatives annulées (sans attendre un flux muet).
      runs.forEach(a => { if (pending.has(a)) { pending.delete(a); out.push({ a, e: abortError(), loser: true }); } });
    } finally {
      clearTimeout(hedgeTimer);
    }
    out.forEach(x => { if (x.e && x.a.cancelled) x.loser = true; });
    return { outcomes: out, hedged: runs.length > 1 ? runs[1].c : null };
  }

  // Aide en direct détectée sans changer l'appelant : réponse courte en flux avec affichage progressif.
  function isLive(o) {
    if (o.purpose === 'live') return true;
    return o.purpose === 'answer' && !!o.stream && typeof o.onDelta === 'function' && (o.maxTokens || 0) <= 600 && !(o.parts && o.parts.length) && !o.json;
  }

  async function generate(opts) {
    const o = Object.assign({ purpose: 'answer', stream: false, temperature: 0.4, maxTokens: 1024 }, opts || {});
    if (o.signal && o.signal.aborted) throw abortError();
    if (isLive(o)) {
      o.purpose = 'live';
      o.firstTokenMs = Math.min(o.firstTokenMs || o.timeoutMs || config.liveFirstTokenMs, config.liveFirstTokenMs);
      o.idleMs = o.idleMs || config.liveIdleMs;
    }
    const live = o.purpose === 'live' && !!o.stream;
    const list = candidates(o);
    if (!list.length) throw noKeyError(o);
    maybeAutoDiscover();
    const run = { start: now() };
    const errors = [];
    const dead = new Set();
    const done = new Set();
    const netFails = {};
    const forbidden = {};
    const budget = o.budgetMs || config.budgetMs;
    const maxTries = o.maxCandidates || 12;
    let partial = null;
    let tried = 0;
    // Secours pour la course : de préférence un autre fournisseur (pannes et limites indépendantes).
    const backupFor = (c) => {
      if (!live || !(config.hedgeMs > 0)) return null;
      const free = list.filter(x => x !== c && !done.has(bk(x)) && !dead.has(x.provider));
      return free.find(x => x.provider !== c.provider) || free[0] || null;
    };
    const fail = (c, e, a0) => {
      const err = (e && e.code) ? e : aiError('HTTP', frMessage('HTTP', c.provider, 0, String((e && e.message) || e)), { provider: c.provider, model: c.model });
      errors.push(err);
      emit('ai:status', { provider: c.provider, model: c.model, ok: false, ms: Math.round(now() - a0), purpose: o.purpose, error: err.message, code: err.code });
      if (err.partialText && (!partial || err.partialText.length > partial.text.length)) {
        partial = { text: err.partialText, provider: c.provider, model: c.model };
      }
      if (err.code === 'KEY' && !err.keyStrong && !forbidden[c.provider]) {
        forbidden[c.provider] = 1;
        trip(c, config.notFoundMs, 'FORBIDDEN');
        return;
      }
      switch (err.code) {
        case 'KEY':
          dead.add(c.provider);
          deadKeys[c.provider] = fingerprint(keyOf(c.provider));
          emit('ai:keyerror', { provider: c.provider, status: err.status, message: err.message });
          break;
        case 'NETWORK':
          if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
            throw aiError('OFFLINE', MSG_NETWORK, { errors });
          }
          netFails[c.provider] = (netFails[c.provider] || 0) + 1;
          if (netFails[c.provider] >= 2) dead.add(c.provider);
          break;
        case 'QUOTA':
          // Crédit épuisé : tout le fournisseur est en cause. Limite du jour : inutile de réessayer ce modèle avant longtemps.
          if (err.quotaKind === 'credit') { dead.add(c.provider); trip(c, 30 * 60 * 1000, err.code); }
          else trip(c, err.quotaKind === 'day' && c.provider === 'gemini' ? 30 * 60 * 1000 : err.quotaKind === 'minute' ? Math.max(60000, err.retryAfterMs || 0) : config.breakerMs, err.code);
          break;
        case 'SERVER': case 'TIMEOUT':
          trip(c, config.breakerMs, err.code);
          break;
        case 'NOT_FOUND':
          trip(c, config.notFoundMs, err.code);
          break;
        default:
          break;
      }
    };
    for (const c of list) {
      if (dead.has(c.provider) || done.has(bk(c))) continue;
      if (tried >= maxTries) break;
      if (tried > 0 && now() - run.start > budget) break;
      if (o.signal && o.signal.aborted) throw abortError();
      tried++;
      const a0 = now();
      if (live) {
        const backup = backupFor(c);
        done.add(bk(c));
        const res = await race(c, backup, o);
        if (res.hedged) { done.add(bk(res.hedged)); tried++; }
        if (o.signal && o.signal.aborted) throw abortError();
        let win = null;
        res.outcomes.forEach(x => {
          if (x.r) { win = x; return; }
          if (x.loser) {
            // Battu par l'autre fournisseur sans avoir rien écrit : ce fournisseur passe après pendant un moment.
            if (x.a.c === c) {
              const other = res.hedged && res.hedged.provider !== c.provider;
              list.filter(y => other ? y.provider === c.provider : y === c).forEach(y => trip(y, config.slowMs, 'SLOW'));
            }
            return;
          }
          if (isAbort(x.e)) return;
          fail(x.a.c, x.e, x.a.t0);
        });
        if (win) {
          const wc = win.a.c;
          const r = win.r;
          const ms = Math.round(now() - run.start);
          breaker.delete(bk(wc));
          if (deadKeys[wc.provider]) delete deadKeys[wc.provider];
          lastOk = { provider: wc.provider, model: wc.model, at: Date.now(), ms };
          emit('ai:status', { provider: wc.provider, model: wc.model, ok: true, ms: Math.round(now() - win.a.t0), purpose: o.purpose, error: null });
          return {
            text: r.text, provider: wc.provider, model: wc.model, ms,
            firstTokenMs: Math.round((r.firstAt || now()) - run.start),
            finish: r.finish || null, truncated: !!r.truncated
          };
        }
        continue;
      }
      done.add(bk(c));
      try {
        const r = await tryCandidate(c, o);
        const ms = Math.round(now() - run.start);
        breaker.delete(bk(c));
        if (deadKeys[c.provider]) delete deadKeys[c.provider];
        lastOk = { provider: c.provider, model: c.model, at: Date.now(), ms };
        emit('ai:status', { provider: c.provider, model: c.model, ok: true, ms: Math.round(now() - a0), purpose: o.purpose, error: null });
        const out = {
          text: r.text, provider: c.provider, model: c.model, ms,
          firstTokenMs: Math.round((o.stream ? r.firstAt : now()) - run.start),
          finish: r.finish || null, truncated: !!r.truncated
        };
        if (o.json) {
          const parsed = parseJsonLoose(r.text);
          out.data = parsed ? parsed.data : null;
          out.repaired = parsed ? parsed.repaired : false;
        }
        return out;
      } catch (e) {
        if (isAbort(e) || (o.signal && o.signal.aborted)) throw abortError();
        fail(c, e, a0);
      }
    }
    if (partial && partial.text.trim().length >= 40) {
      return {
        text: partial.text, provider: partial.provider, model: partial.model,
        ms: Math.round(now() - run.start), firstTokenMs: null, partial: true, truncated: true, finish: 'PARTIAL'
      };
    }
    throw allFailed(errors);
  }

  function scanJson(src, start) {
    let out = '';
    const stack = [];
    const cuts = [];
    let inStr = false;
    let esc = false;
    const dropTrailingComma = () => {
      let k = out.length - 1;
      while (k >= 0 && /\s/.test(out[k])) k--;
      if (k >= 0 && out[k] === ',') out = out.slice(0, k) + out.slice(k + 1);
    };
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) { esc = false; out += ch; continue; }
        if (ch === '\\') { esc = true; out += ch; continue; }
        if (ch === '"') {
          let j = i + 1;
          while (j < src.length && /\s/.test(src[j])) j++;
          const nx = src[j];
          if (j >= src.length || nx === ',' || nx === '}' || nx === ']' || nx === ':') { inStr = false; out += ch; } else out += '\\"';
          continue;
        }
        if (ch === '\n') { out += '\\n'; continue; }
        if (ch === '\t') { out += '\\t'; continue; }
        if (ch < ' ') continue;
        out += ch;
        continue;
      }
      if (ch === '"') { inStr = true; out += ch; continue; }
      if (ch === '{' || ch === '[') { stack.push(ch); out += ch; continue; }
      if (ch === '}' || ch === ']') {
        dropTrailingComma();
        stack.pop();
        out += ch;
        if (!stack.length) return { text: out, complete: true, cuts };
        cuts.push({ pos: out.length, stack: stack.slice() });
        continue;
      }
      if (ch === ',') { cuts.push({ pos: out.length, stack: stack.slice() }); out += ch; continue; }
      out += ch;
    }
    return { text: out, complete: false, cuts };
  }

  function parseJsonLoose(text) {
    const src = String(text == null ? '' : text);
    let body = src;
    const fence = src.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
    if (fence && /[{[]/.test(fence[1])) body = fence[1];
    const start = body.search(/[{[]/);
    if (start < 0) return null;
    const sc = scanJson(body, start);
    if (sc.complete) {
      try { return { data: JSON.parse(sc.text), repaired: false }; } catch (e) {  }
    }
    for (let k = sc.cuts.length - 1, n = 0; k >= 0 && n < 80; k--, n++) {
      const c = sc.cuts[k];
      let s = sc.text.slice(0, c.pos);
      for (let j = c.stack.length - 1; j >= 0; j--) s += c.stack[j] === '{' ? '}' : ']';
      try { return { data: JSON.parse(s), repaired: true }; } catch (e) {  }
    }
    return null;
  }

  const HALLUCINATIONS = [
    /(?:sous-?titr[^.\n]*?)?(?:la communauté d')?amara\.org\b[^.\n]*\.?/gi,
    /sous-?titr(?:es|age)\s+(?:réalisés?\s+)?(?:par|de)\b[^.\n]*\.?/gi,
    /sous-?titrage\s+(?:st'?\s*\d+|société radio-canada|fr\b)[^.\n]*\.?/gi,
    /merci d'avoir regardé(?: cette vidéo)?\s*[.!]?/gi,
    /n'oubliez pas de (?:vous abonner|liker|mettre un like)[^.!\n]*[.!]?/gi,
    /abonnez-vous(?: à la chaîne)?\s*[.!]?/gi,
    /transcription (?:réalisée|faite) par[^.\n]*\.?/gi,
    /\[(?:musique|music|silence|vide|inaudible|bruits?[^\]]*|rires?|applaudissements|toux|soupirs?|pas de parole|aucune parole)\]/gi,
    /\((?:musique|music|silence|inaudible|bruits?[^)]*|rires?|applaudissements|toux|soupirs?)\)/gi,
    /[♪♫]+/g
  ];
  const NO_SPEECH = /^(?:\[?vide\]?|\.+|…+|-+|—|silence\.?|aucune parole.*|pas de parole.*|il n'y a (?:pas de|aucune) parole.*|\(?(?:aucun|pas de) (?:son|audio|discours).*|no speech.*|\[?inaudible\]?\.?)$/i;

  function collapseRepeats(t) {
    let s = t;
    s = s.replace(/(?<![\p{L}\p{N}])([\p{L}\p{N}'’]+)(?:[\s,]+\1){3,}(?![\p{L}\p{N}])/giu, '$1');
    s = s.replace(/(.{6,80}?)(?:[\s,.;!?…]+\1){2,}/gi, '$1');
    const words = s.split(/\s+/).filter(Boolean);
    if (words.length >= 15) {
      const uniq = new Set(words.map(w => w.toLowerCase())).size;
      if (uniq / words.length < 0.25) return '';
    }
    return s;
  }

  function cleanTranscript(text) {
    let s = String(text || '').replace(/\r/g, '').trim();
    if (!s) return '';
    s = s.replace(/^```[a-z]*\s*|```$/gi, '').trim();
    s = s.replace(/^(?:transcription|texte)\s*:\s*/i, '');
    HALLUCINATIONS.forEach(re => { s = s.replace(re, ' '); });
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(/^["«“]\s*|\s*["»”]$/g, '').trim();
    if (!s || NO_SPEECH.test(s)) return '';
    s = collapseRepeats(s).replace(/\s+/g, ' ').trim();
    if (!/[\p{L}\p{N}]/u.test(s)) return '';
    return s;
  }

  async function blobToBase64(blob) {
    if (typeof blob === 'string') return blob.replace(/^data:[^,]*,/, '');
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < buf.length; i += CH) s += String.fromCharCode.apply(null, buf.subarray(i, i + CH));
    return btoa(s);
  }

  async function transcribe(wavBlob, opts) {
    opts = opts || {};
    const hint = String(opts.hint || opts.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    const lang = String(opts.lang || 'en').slice(0, 2).toLowerCase();
    if (keyOf('groq') && !(groqKeyDead() && keyOf('gemini') && !opts.peek)) {
      try {
        const w = await groqWhisper(wavBlob, hint, opts.signal, opts.timeoutMs, lang);
        return { text: cleanTranscript(w.text), model: w.model, provider: 'groq', ms: w.ms };
      } catch (e) {
        // Un aperçu n'a d'intérêt que rapide : pas de repli Gemini, qui userait son quota.
        if ((e && e.name === 'AbortError') || opts.peek || !keyOf('gemini')) throw e;
      }
    }
    if (opts.peek && !keyOf('groq')) throw noKeyError({ providers: ['gemini'] });
    if (!keyOf('gemini')) throw noKeyError({ providers: ['gemini'] });
    const data = await blobToBase64(wavBlob);
    const mime = (wavBlob && wavBlob.type) || 'audio/wav';
    const prompt = [
      'Transcris mot à mot, en ' + (lang === 'fr' ? 'français' : 'anglais') + ', ce qui est dit dans cet extrait audio (oral d\'anglais des affaires).',
      '- Écris uniquement les paroles prononcées : pas de commentaire, pas d\'horodatage, pas de nom de locuteur, pas de description de sons.',
      '- Ne traduis pas, ne résume pas, ne complète pas les phrases coupées.',
      '- S\'il n\'y a aucune parole intelligible (silence, musique, bruit), réponds exactement : [vide]'
    ].join('\n') + (hint ? '\nNoms propres et termes possibles : ' + hint : '');
    const r = await generate({
      purpose: 'fast', providers: ['gemini'], parts: [{ inline_data: { mime_type: mime, data } }], prompt,
      temperature: 0, maxTokens: 800, stream: false, timeoutMs: opts.timeoutMs || 15000, allowEmpty: true,
      signal: opts.signal, budgetMs: opts.budgetMs || 30000, maxCandidates: 3, liteOnly: true
    });
    return { text: cleanTranscript(r.text), model: r.model, provider: r.provider, ms: r.ms };
  }

  function canPeek() {
    if (!keyOf('groq') || groqKeyDead()) return false;
    if (whisperRecent(60000) >= 12) return false;
    return WHISPER.some(m => { const b = breaker.get('groq:' + m); return !(b && b.until > Date.now()); });
  }

  async function extractFile(blob, mime, opts) {
    opts = opts || {};
    const type = String(mime || (blob && blob.type) || 'application/octet-stream').toLowerCase();
    if (blob && blob.size > 14.5 * 1024 * 1024) {
      throw aiError('TOO_BIG', 'Fichier trop lourd (14 Mo maximum) : copiez-collez plutôt son texte.');
    }
    const data = await blobToBase64(blob);
    const prompt = 'Recopie intégralement tout le texte de ce document, dans l\'ordre, en conservant la structure (titres, listes, paragraphes ; tableaux ligne par ligne avec « | »). N\'ajoute aucun commentaire ni introduction, ne résume pas, ne traduis pas. Si le document ne contient aucun texte lisible, réponds exactement : [vide]';
    const r = await generate({
      purpose: 'answer', parts: [{ inline_data: { mime_type: type, data } }], prompt, temperature: 0,
      maxTokens: 16000, stream: true, firstTokenMs: 45000, idleMs: 30000, budgetMs: 180000, signal: opts.signal, onDelta: opts.onDelta
    });
    let t = String(r.text || '').trim().replace(/^```[a-z]*\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
    if (/^\[?vide\]?\.?$/i.test(t)) t = '';
    return t;
  }

  async function test() {
    const out = [];
    for (const p of providerOrder()) {
      if (!keyOf(p)) continue;
      const t0 = now();
      try {
        const r = await generate({
          purpose: 'answer', providers: [p], prompt: 'Réponds uniquement : OK', maxTokens: 24, temperature: 0,
          stream: false, timeoutMs: 15000, ignoreBreaker: true, allowEmpty: true, budgetMs: 40000, maxCandidates: 3
        });
        out.push({ provider: p, model: r.model, ok: true, ms: r.ms, error: null });
      } catch (e) {
        out.push({ provider: p, model: (e && e.model) || (pick('answer').find(c => c.provider === p) || {}).model || '', ok: false, ms: Math.round(now() - t0), error: (e && e.message) || String(e) });
      }
    }
    return out;
  }

  function hasKey(provider) {
    if (provider) return !!keyOf(provider);
    return PROVIDERS.some(p => keyOf(p));
  }

  function state() {
    const t = Date.now();
    const list = [];
    breaker.forEach((v, k) => { if (v.until > t) { const i = k.indexOf(':'); list.push({ provider: k.slice(0, i), model: k.slice(i + 1), until: v.until, code: v.code }); } });
    return { lastOk, breaker: list, noThinking: Array.from(noThinking), keyErrors: Object.keys(deadKeys) };
  }

  function reset() {
    breaker.clear();
    noThinking.clear();
    noMinimal.clear();
    Object.keys(deadKeys).forEach(k => { delete deadKeys[k]; });
    lastOk = null;
  }

  // Réchauffage : ouvre à l'avance la connexion (DNS + TLS) vers le fournisseur qui répondra,
  // pour gagner 100 à 300 ms sur la 1re réponse. À appeler quand l'aide en direct démarre
  // ou dès que le jury commence à parler. Sans effet hors navigateur ou sans clé.
  const ORIGIN = { openai: 'https://api.openai.com', gemini: 'https://generativelanguage.googleapis.com', claude: 'https://api.anthropic.com', groq: 'https://api.groq.com' };
  const warmedAt = {};
  function warm(purpose, opts) {
    try {
      if (!(opts && opts.connectOnly)) maybeAutoDiscover();
      if (typeof document === 'undefined' || !document.head || !document.createElement) return [];
      const t = Date.now();
      const seen = [];
      pick(purpose || 'live').forEach(c => {
        if (seen.length >= 2 || !keyOf(c.provider) || seen.indexOf(c.provider) >= 0) return;
        seen.push(c.provider);
        const origin = ORIGIN[c.provider];
        if (!origin || t - (warmedAt[origin] || 0) < config.warmMs) return;
        warmedAt[origin] = t;
        const l = document.createElement('link');
        l.rel = 'preconnect';
        l.href = origin;
        l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
        setTimeout(() => { try { l.remove(); } catch (e) {  } }, config.warmMs);
      });
      return seen;
    } catch (e) { return []; }
  }

  S.ai = {
    hasKey, canPeek, discover, pick, generate, transcribe, extractFile, test, warm,
    config, state, reset, parseJson: parseJsonLoose, cleanTranscript, thinkingFor, FALLBACK
  };
  if (typeof document !== 'undefined' && typeof setTimeout === 'function') setTimeout(() => { if (hasKey()) warm('live', { connectOnly: true }); }, 1500);
})(window.AideVisio = window.AideVisio || {});
