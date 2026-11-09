import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UTIL = path.join(ROOT, 'src', 'js', 'util.js');
const AI = path.join(ROOT, 'src', 'js', 'ai.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const enc = new TextEncoder();

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    clear: () => m.clear(),
    key: i => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; }
  };
}

const UTIL_STUB = `(function(S){ 'use strict';
  const U = S.util = S.util || {};
  U.uid = () => Math.random().toString(36).slice(2, 10);
  U.norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  U.fmtTime = ms => { const s = Math.floor((ms||0)/1000); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); };
  U.emitter = () => { const m = {}; return { on(e,f){ (m[e]=m[e]||[]).push(f); return () => this.off(e,f); }, off(e,f){ m[e]=(m[e]||[]).filter(x=>x!==f); }, emit(e,d){ (m[e]||[]).slice().forEach(f=>f(d)); } }; };
  S.bus = S.bus || U.emitter();
})(window.AideVisio = window.AideVisio || {});`;

let utilMode = 'stub';

function makeEnv(settings = {}) {
  const env = {
    calls: [],
    events: [],
    handler: null,
    settings: Object.assign({ geminiKey: '', claudeKey: '', rememberKeys: true, provider: 'auto', models: { answer: 'auto', fast: 'auto', prep: 'auto' } }, settings)
  };
  const ctx = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    TextDecoder, TextEncoder, ReadableStream, Response, Headers, Blob, FormData, AbortController, AbortSignal,
    URL, URLSearchParams, btoa, atob, structuredClone, performance, DOMException,
    localStorage: memStorage(), sessionStorage: memStorage(),
    navigator: { onLine: true, userAgent: 'node-test', language: 'fr-FR' }
  };
  ctx.fetch = async (url, init = {}) => {
    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch (e) { body = init.body; }
    const call = { url: String(url), method: init.method || 'GET', headers: init.headers || {}, body, signal: init.signal };
    env.calls.push(call);
    if (!env.handler) throw new TypeError('Failed to fetch (pas de handler)');
    return env.handler(call);
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);
  let loaded = false;
  if (fs.existsSync(UTIL)) {
    try {
      vm.runInContext(fs.readFileSync(UTIL, 'utf8'), ctx, { filename: 'util.js' });
      loaded = !!(ctx.AideVisio && ctx.AideVisio.bus && ctx.AideVisio.util);
    } catch (e) { loaded = false; }
  }
  if (!loaded) { delete ctx.AideVisio; vm.runInContext(UTIL_STUB, ctx, { filename: 'util-stub.js' }); }
  utilMode = loaded ? 'util.js' : 'stub';
  ctx.AideVisio.store = { settings: () => env.settings };
  vm.runInContext(fs.readFileSync(AI, 'utf8'), ctx, { filename: 'ai.js' });
  const S = ctx.AideVisio;
  S.bus.on('ai:status', d => env.events.push({ type: 'ai:status', ...d }));
  S.bus.on('ai:keyerror', d => env.events.push({ type: 'ai:keyerror', ...d }));
  S.ai.config.autoDiscover = false;
  env.S = S;
  env.ctx = ctx;
  env.ai = S.ai;
  return env;
}

function bytesResponse(raw, { chunk = 7, delay = 0, failAfter = null, hangAfter = false, status = 200, type = 'text/event-stream' } = {}) {
  const bytes = enc.encode(raw);
  let i = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (delay) await sleep(delay);
      if (i < bytes.length) { controller.enqueue(bytes.slice(i, i + chunk)); i += chunk; return; }
      if (failAfter) { controller.error(failAfter); return; }
      if (hangAfter) { await new Promise(() => {}); }
      controller.close();
    }
  });
  return new Response(stream, { status, headers: { 'content-type': type } });
}

const gEvent = (text, extra = {}) => 'data: ' + JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, ...extra }] }) + '\r\n\r\n';
const geminiSSE = (texts, opts) => bytesResponse(texts.map(t => gEvent(t)).join(''), opts);

function claudeRaw(texts) {
  let s = 'event: message_start\ndata: ' + JSON.stringify({ type: 'message_start', message: { id: 'msg_1', model: 'x', content: [] } }) + '\n\n';
  s += 'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n';
  s += 'event: ping\ndata: {"type": "ping"}\n\n';
  for (const t of texts) s += 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n';
  s += 'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n';
  s += 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n';
  s += 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  return s;
}
const claudeSSE = (texts, opts) => bytesResponse(claudeRaw(texts), opts);

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
const gJson = (text) => json({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });
const cJson = (text) => json({ id: 'msg', type: 'message', role: 'assistant', content: [{ type: 'text', text }], stop_reason: 'end_turn' });
const err = (status, message, extra = {}) => json({ error: { code: status, message, status: 'ERR', ...extra } }, status);

const isGemini = c => c.url.startsWith('https://generativelanguage.googleapis.com/');
const isClaude = c => c.url.startsWith('https://api.anthropic.com/');
const modelOf = c => {
  if (isGemini(c)) { const m = c.url.match(/\/models\/([^:?]+):/); return m ? decodeURIComponent(m[1]) : null; }
  return c.body && c.body.model;
};
const gen = (env) => env.calls.filter(c => (isGemini(c) && /:(stream)?[gG]enerateContent/.test(c.url)) || (isClaude(c) && /\/messages$/.test(c.url)));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('pick : ordre de repli (Gemini puis Claude), réglage fournisseur, sans clé', async () => {
  const env = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  const ai = env.ai;
  const a = ai.pick('answer');
  assert.equal(a[0].provider, 'gemini');
  assert.equal(a[0].model, 'gemini-3.8-flash');
  const gi = a.filter(c => c.provider === 'gemini').map(c => c.model);
  assert.ok(gi.indexOf('gemini-flash-latest') > gi.indexOf('gemini-3-flash-preview'));
  assert.ok(gi.indexOf('gemini-2.5-flash') > gi.indexOf('gemini-flash-latest'));
  assert.ok(gi.indexOf('gemini-flash-lite-latest') > gi.indexOf('gemini-2.5-flash'), 'lite après flash');
  const firstClaude = a.findIndex(c => c.provider === 'claude');
  assert.ok(firstClaude > 0 && a.slice(firstClaude).every(c => c.provider === 'claude'));
  assert.equal(a[firstClaude].model, 'claude-haiku-5-5');
  assert.equal(ai.pick('fast')[0].model, 'gemini-flash-lite-latest');
  const prep = ai.pick('prep');
  assert.equal(prep.find(c => c.provider === 'claude').model, 'claude-sonnet-5-5');
  env.settings.provider = 'claude';
  assert.equal(ai.pick('answer')[0].provider, 'claude');
  env.settings.provider = 'auto';
  env.settings.models.answer = 'gemini-2.5-flash';
  assert.equal(ai.pick('answer')[0].model, 'gemini-2.5-flash');
  const noKey = makeEnv({});
  assert.equal(noKey.ai.hasKey(), false);
  assert.ok(noKey.ai.pick('answer').length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(ai.thinkingFor('gemini-3-flash-preview'))), { thinkingLevel: 'low' });
  assert.deepEqual(JSON.parse(JSON.stringify(ai.thinkingFor('gemini-2.5-flash'))), { thinkingBudget: 0 });
  assert.equal(ai.thinkingFor('gemini-flash-latest'), null);
});

test('discover : filtre (image, tts, gemma, exp…), classe, met en cache 12 h', async () => {
  const env = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  const gm = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-3.6-flash', 'gemini-3.6-flash-lite', 'gemini-2.5-flash-image', 'gemini-2.5-flash-preview-tts',
    'gemma-3-27b-it', 'gemini-2.0-flash-exp', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-native-audio-latest', 'gemini-flash-latest', 'gemini-1.5-flash'];
  env.handler = (c) => {
    if (isGemini(c) && /\/models\?pageSize=200/.test(c.url)) {
      assert.equal(c.headers['x-goog-api-key'], 'g-key');
      return json({ models: gm.map(n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent', 'countTokens'] }))
        .concat([{ name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }]) });
    }
    if (isClaude(c) && /\/v1\/models\?limit=100/.test(c.url)) {
      assert.equal(c.headers['x-api-key'], 'c-key');
      assert.equal(c.headers['anthropic-version'], '2023-06-01');
      assert.equal(c.headers['anthropic-dangerous-direct-browser-access'], 'true');
      return json({ data: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-1-20250805', 'claude-3-haiku-20240307'].map(id => ({ id, type: 'model' })), has_more: false });
    }
    throw new Error('URL inattendue ' + c.url);
  };
  const d = await env.ai.discover({});
  for (const bad of ['gemini-2.5-flash-image', 'gemini-2.5-flash-preview-tts', 'gemma-3-27b-it', 'gemini-2.0-flash-exp', 'text-embedding-004', 'gemini-2.5-flash-native-audio-latest', 'gemini-1.5-flash']) {
    assert.ok(!d.gemini.includes(bad), bad + ' devrait être exclu');
  }
  assert.ok(d.gemini.includes('gemini-3.6-flash'));
  assert.ok(!d.claude.includes('claude-3-haiku-20240307'));
  const a = env.ai.pick('answer').map(c => c.model);
  assert.deepEqual(Array.from(a.slice(0, 4)), ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-2.5-flash']);
  assert.ok(a.indexOf('gemini-3.6-flash-lite') > a.indexOf('gemini-2.5-flash'));
  assert.ok(!a.includes('gemini-2.5-pro'), 'pas de pro pour answer');
  assert.ok(env.ai.pick('prep').some(c => c.model === 'gemini-2.5-pro'), 'pro possible pour prep');
  assert.equal(env.ai.pick('fast')[0].model, 'gemini-3.6-flash-lite');
  const claude = a.filter(m => m.startsWith('claude'));
  assert.equal(claude[0], 'claude-haiku-4-5-20251001');
  assert.ok(!claude.some(m => m.includes('opus')));
  const n = env.calls.length;
  await env.ai.discover({});
  assert.equal(env.calls.length, n, 'le cache évite un 2e appel');
  await env.ai.discover({ force: true });
  assert.equal(env.calls.length, n + 2);
});

test('generate : streaming SSE Gemini (paquets coupés, UTF-8 coupé, pensées ignorées)', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.handler = (c) => {
    const raw = 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'je réfléchis', thought: true }] } }] }) + '\r\n\r\n' +
      gEvent('**Je pilote ') + gEvent('la clôture') + gEvent(' mensuelle.**\n- **Délais** : J+5', { finishReason: 'STOP' });
    return bytesResponse(raw, { chunk: 5 });
  };
  const deltas = [];
  const r = await env.ai.generate({ purpose: 'answer', system: 'SYS', prompt: 'Q', stream: true, onDelta: t => deltas.push(t) });
  assert.equal(r.text, '**Je pilote la clôture mensuelle.**\n- **Délais** : J+5');
  assert.equal(r.provider, 'gemini');
  assert.equal(r.model, 'gemini-3.8-flash');
  assert.equal(deltas.length, 3);
  assert.equal(deltas[0], '**Je pilote ');
  assert.ok(typeof r.firstTokenMs === 'number' && typeof r.ms === 'number');
  const c = env.calls[0];
  assert.ok(c.url.endsWith('/models/gemini-3.8-flash:streamGenerateContent?alt=sse'));
  assert.equal(c.headers['x-goog-api-key'], 'g-key');
  assert.equal(c.body.systemInstruction.parts[0].text, 'SYS');
  assert.equal(c.body.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.equal(c.body.contents[c.body.contents.length - 1].parts.at(-1).text, 'Q');
  const ok = env.events.filter(e => e.type === 'ai:status');
  assert.equal(ok.length, 1);
  assert.equal(ok[0].ok, true);
});

test('429 → bascule sur le modèle suivant + circuit breaker 5 min', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.handler = (c) => modelOf(c) === 'gemini-3.8-flash' ? err(429, 'Resource exhausted') : geminiSSE(['Réponse B']);
  const r = await env.ai.generate({ prompt: 'Q', stream: true });
  assert.equal(r.model, 'gemini-3.6-flash');
  assert.equal(r.text, 'Réponse B');
  const st = env.events.filter(e => e.type === 'ai:status');
  assert.equal(st[0].ok, false);
  assert.equal(st[0].model, 'gemini-3.8-flash');
  assert.match(st[0].error, /Quota Gemini atteint/);
  assert.equal(st[1].ok, true);
  assert.ok(env.ai.state().breaker.some(b => b.model === 'gemini-3.8-flash'));
  env.calls.length = 0;
  await env.ai.generate({ prompt: 'Q2', stream: true });
  assert.equal(modelOf(gen(env)[0]), 'gemini-3.6-flash', 'le modèle en échec passe en dernier');
  assert.equal(env.ai.pick('answer').at(-1).model, 'gemini-3.8-flash');
});

test('400 dû à thinkingConfig → réessai du même modèle sans, mémorisé', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.handler = (c) => c.body.generationConfig.thinkingConfig
    ? err(400, 'Invalid JSON payload received. Unknown name "thinkingLevel" at generation_config.thinking_config', { status: 'INVALID_ARGUMENT' })
    : gJson('OK sans pensée');
  const r = await env.ai.generate({ prompt: 'Q' });
  assert.equal(r.text, 'OK sans pensée');
  assert.equal(r.model, 'gemini-3.8-flash');
  assert.equal(env.calls.length, 2);
  assert.equal(modelOf(env.calls[1]), 'gemini-3.8-flash');
  assert.equal(env.calls[1].body.generationConfig.thinkingConfig, undefined);
  assert.ok(env.ai.state().noThinking.includes('gemini-3.8-flash'));
  env.calls.length = 0;
  await env.ai.generate({ prompt: 'Q2' });
  assert.equal(env.calls.length, 1, 'plus de thinkingConfig envoyé ensuite');
});

test('401 Gemini → fournisseur suivant (Claude, SSE) + événement ai:keyerror', async () => {
  const env = makeEnv({ geminiKey: 'bad', claudeKey: 'c-key' });
  env.handler = (c) => isGemini(c) ? err(401, 'Unauthorized') : claudeSSE(['**Je suis ', 'prêt.**']);
  const deltas = [];
  const r = await env.ai.generate({ system: 'SYS', prompt: 'Q', stream: true, onDelta: t => deltas.push(t), temperature: 0.4, maxTokens: 500 });
  assert.equal(r.provider, 'claude');
  assert.equal(r.model, 'claude-haiku-5-5');
  assert.equal(r.text, '**Je suis prêt.**');
  assert.deepEqual(deltas, ['**Je suis ', '**Je suis prêt.**']);
  assert.equal(env.calls.filter(isGemini).length, 1, 'un seul essai Gemini avec une clé refusée');
  const ke = env.events.filter(e => e.type === 'ai:keyerror');
  assert.equal(ke.length, 1);
  assert.equal(ke[0].provider, 'gemini');
  const cc = env.calls.find(isClaude);
  assert.equal(cc.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(cc.headers['x-api-key'], 'c-key');
  assert.equal(cc.headers['anthropic-version'], '2023-06-01');
  assert.equal(cc.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(cc.body.system, 'SYS');
  assert.equal(cc.body.stream, true);
  assert.equal(cc.body.max_tokens, 500);
  assert.equal(cc.body.messages[0].role, 'user');
  env.calls.length = 0;
  await env.ai.generate({ prompt: 'Q2', stream: true });
  assert.ok(isClaude(env.calls[0]), 'la clé refusée passe après l\'autre fournisseur');
});

test('Groq : gros modèles seulement, flux SSE OpenAI, Whisper prioritaire pour la transcription', async () => {
  const isGroq = c => c.url.startsWith('https://api.groq.com/');
  const env = makeEnv({ groqKey: 'gsk-test' });
  const picked = env.ai.pick('answer').filter(c => c.provider === 'groq').map(c => c.model);
  assert.ok(picked.length && picked.every(m => !/instant|8b|whisper|guard/.test(m)), 'aucun petit modèle : ' + picked);
  const chunk = t => 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: t } }] }) + '\n\n';
  env.handler = (c) => {
    if (c.url.endsWith('/audio/transcriptions')) return new Response(JSON.stringify({ text: ' Pourquoi le Recho ? ' }), { status: 200, headers: { 'content-type': 'application/json' } });
    return bytesResponse(chunk('**Je veux ') + chunk('structurer.**') + 'data: [DONE]\n\n');
  };
  const deltas = [];
  const r = await env.ai.generate({ prompt: 'Q', stream: true, onDelta: t => deltas.push(t) });
  assert.equal(r.provider, 'groq');
  assert.equal(r.text, '**Je veux structurer.**');
  assert.deepEqual(deltas, ['**Je veux ', '**Je veux structurer.**']);
  const call = env.calls.find(isGroq);
  assert.equal(call.headers.Authorization || call.headers.authorization, 'Bearer gsk-test');
  const wav = new Blob([new Uint8Array(64)], { type: 'audio/wav' });
  const t = await env.ai.transcribe(wav, { hint: 'Recho' });
  assert.equal(t.provider, 'groq');
  assert.match(t.model, /^whisper/);
  assert.equal(t.text, 'Pourquoi le Recho ?');
});

test('OpenAI : prioritaire en auto, gpt-5.4-mini sans raisonnement, Claude en secours sur 429', async () => {
  const isOpenai = c => c.url.startsWith('https://api.openai.com/');
  const env = makeEnv({ openaiKey: 'sk-proj-test', claudeKey: 'c-key' });
  const picked = env.ai.pick('answer');
  assert.equal(picked[0].provider, 'openai', 'OpenAI en tête : ' + JSON.stringify(picked[0]));
  assert.equal(picked[0].model, 'gpt-5.4-mini');
  const chunk = t => 'data: ' + JSON.stringify({ choices: [{ index: 0, delta: { content: t } }] }) + '\n\n';
  env.handler = () => bytesResponse(chunk('**Je veux ') + chunk('rejoindre BDO.**') + 'data: [DONE]\n\n');
  const deltas = [];
  const r = await env.ai.generate({ prompt: 'Q', system: 'S', stream: true, temperature: 0.4, maxTokens: 700, onDelta: t => deltas.push(t) });
  assert.equal(r.provider, 'openai');
  assert.equal(r.model, 'gpt-5.4-mini');
  assert.equal(r.text, '**Je veux rejoindre BDO.**');
  const call = env.calls.find(isOpenai);
  assert.ok(call.url.endsWith('/v1/chat/completions'));
  assert.equal(call.headers.Authorization || call.headers.authorization, 'Bearer sk-proj-test');
  assert.equal(call.body.reasoning_effort, 'none');
  assert.equal(call.body.max_completion_tokens, 700);
  assert.ok(!('max_tokens' in call.body) && !('temperature' in call.body), 'paramètres refusés par GPT-5 absents');
  assert.equal(call.body.messages[0].role, 'system');
  const env2 = makeEnv({ openaiKey: 'sk-proj-test', claudeKey: 'c-key' });
  env2.handler = (c) => isOpenai(c)
    ? new Response(JSON.stringify({ error: { message: 'You exceeded your current quota', type: 'insufficient_quota' } }), { status: 429, headers: { 'content-type': 'application/json' } })
    : claudeSSE(['**Secours.**']);
  const r2 = await env2.ai.generate({ prompt: 'Q', stream: true });
  assert.equal(r2.provider, 'claude');
  assert.equal(r2.text, '**Secours.**');
});

test('réponse tronquée (MAX_TOKENS) → relance avec un budget plus grand, texte complet', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  let n = 0;
  env.handler = () => {
    n++;
    if (n === 1) return bytesResponse(gEvent('**Je suis gestionnaire financier ') + gEvent('et ancien responsable : deux parcours qui', { finishReason: 'MAX_TOKENS' }));
    return bytesResponse(gEvent('**Je suis gestionnaire financier et ancien responsable de restaurant.**\n') + gEvent('- **Budget** : révision annuelle.', { finishReason: 'STOP' }));
  };
  const deltas = [];
  const r = await env.ai.generate({ prompt: 'Q', stream: true, maxTokens: 900, onDelta: t => deltas.push(t) });
  assert.equal(r.text, '**Je suis gestionnaire financier et ancien responsable de restaurant.**\n- **Budget** : révision annuelle.');
  assert.equal(r.truncated, false);
  assert.equal(env.calls.length, 2, 'une relance');
  const max1 = env.calls[0].body.generationConfig.maxOutputTokens, max2 = env.calls[1].body.generationConfig.maxOutputTokens;
  assert.ok(max1 >= 900 + 8192, 'marge de réflexion large (' + max1 + ')');
  assert.ok(max2 > max1, 'budget agrandi à la relance (' + max1 + ' → ' + max2 + ')');
  assert.ok(env.events.some(e => e.type === 'ai:status' && e.code === 'TRUNCATED'));
  const env2 = makeEnv({ geminiKey: 'g-key' });
  env2.handler = () => bytesResponse(gEvent('**Début coupé', { finishReason: 'MAX_TOKENS' }));
  const r2 = await env2.ai.generate({ prompt: 'Q', stream: true });
  assert.equal(r2.truncated, true);
  assert.equal(env2.calls.length, 2);
});

test('400 API_KEY_INVALID (Gemini) traité comme une clé refusée', async () => {
  const env = makeEnv({ geminiKey: 'bad', claudeKey: 'c-key' });
  env.handler = (c) => isGemini(c)
    ? err(400, 'API key not valid. Please pass a valid API key.', { status: 'INVALID_ARGUMENT', details: [{ reason: 'API_KEY_INVALID' }] })
    : cJson('OK Claude');
  const r = await env.ai.generate({ prompt: 'Q' });
  assert.equal(r.provider, 'claude');
  assert.equal(env.events.filter(e => e.type === 'ai:keyerror').length, 1);
  assert.equal(env.calls.filter(isGemini).length, 1, 'pas de réessai « sans thinking » sur une clé invalide');
});

test('timeout du premier token (flux muet qui ignore l\'annulation) → modèle suivant', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.ai.config.firstTokenMs = 150;
  env.handler = (c) => modelOf(c) === 'gemini-3.8-flash' ? bytesResponse('', { hangAfter: true }) : geminiSSE(['Vite']);
  const t0 = Date.now();
  const r = await env.ai.generate({ prompt: 'Q', stream: true });
  const dt = Date.now() - t0;
  assert.equal(r.text, 'Vite');
  assert.equal(r.model, 'gemini-3.6-flash');
  assert.ok(dt < 1500, 'bascule rapide (' + dt + ' ms)');
  const st = env.events.find(e => e.type === 'ai:status' && !e.ok);
  assert.equal(st.code, 'TIMEOUT');
});

test('timeout : fetch qui ne répond jamais (non-stream) → bascule', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.ai.config.totalMs = 120;
  env.handler = (c) => modelOf(c) === 'gemini-3.8-flash' ? new Promise(() => {}) : gJson('Rattrapé');
  const r = await env.ai.generate({ prompt: 'Q' });
  assert.equal(r.text, 'Rattrapé');
  assert.ok(env.ai.state().breaker.some(b => b.model === 'gemini-3.8-flash' && b.code === 'TIMEOUT'));
});

test('annulation utilisateur (AbortSignal chaîné) → AbortError, aucune bascule', async () => {
  const env = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  env.handler = () => bytesResponse(gEvent('Début…'), { hangAfter: true });
  const ctrl = new AbortController();
  const p = env.ai.generate({ prompt: 'Q', stream: true, signal: ctrl.signal, onDelta: () => ctrl.abort() });
  await assert.rejects(p, e => e.name === 'AbortError');
  assert.equal(env.calls.length, 1);
  const pre = new AbortController();
  pre.abort();
  await assert.rejects(env.ai.generate({ prompt: 'Q', signal: pre.signal }), e => e.name === 'AbortError');
  assert.equal(env.calls.length, 1);
});

test('coupure réseau en plein flux → bascule, texte complet du modèle suivant', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.handler = (c) => modelOf(c) === 'gemini-3.8-flash'
    ? bytesResponse(gEvent('Début coupé'), { failAfter: new TypeError('network error') })
    : geminiSSE(['Réponse ', 'complète']);
  const deltas = [];
  const r = await env.ai.generate({ prompt: 'Q', stream: true, onDelta: t => deltas.push(t) });
  assert.equal(r.text, 'Réponse complète');
  assert.equal(deltas[0], 'Début coupé');
  assert.equal(deltas.at(-1), 'Réponse complète');
});

test('tous les modèles en 503 → erreur ALL_FAILED en français ; réseau coupé → OFFLINE', async () => {
  const env = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  env.handler = () => err(503, 'The model is overloaded.');
  await assert.rejects(env.ai.generate({ prompt: 'Q' }), e => e.code === 'ALL_FAILED' && /surchargé/.test(e.message) && e.errors.length > 3);
  const off = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  off.ctx.navigator.onLine = false;
  off.handler = () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(off.ai.generate({ prompt: 'Q' }), e => e.code === 'OFFLINE');
  assert.equal(off.calls.length, 1);
  const net = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  net.handler = (c) => { if (isGemini(c)) throw new TypeError('Failed to fetch'); return cJson('Via Claude'); };
  const r = await net.ai.generate({ prompt: 'Q' });
  assert.equal(r.provider, 'claude');
  assert.equal(net.calls.filter(isGemini).length, 2, 'Gemini abandonné après 2 échecs réseau');
});

test('JSON : Gemini responseMimeType ; Claude consigne stricte + extraction', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.handler = () => gJson('{"score": 7}');
  const r = await env.ai.generate({ prompt: 'Q', json: true });
  assert.equal(env.calls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(r.data.score, 7);
  const cl = makeEnv({ claudeKey: 'c-key' });
  cl.handler = () => cJson('Voici le résultat :\n```json\n{"score": 8, "feedback": "ok",}\n```\nBonne chance.');
  const r2 = await cl.ai.generate({ system: 'S', prompt: 'Q', json: true });
  assert.equal(r2.data.score, 8);
  assert.match(cl.calls[0].body.system, /UNIQUEMENT avec un objet JSON/);
  assert.equal(cl.calls[0].body.stream, undefined);
});

test('parseJson : virgules finales, sauts de ligne bruts, guillemets non échappés, JSON tronqué', async () => {
  const { ai } = makeEnv({});
  assert.deepEqual(JSON.parse(JSON.stringify(ai.parseJson('{"a":[1,2,],}').data)), { a: [1, 2] });
  assert.equal(ai.parseJson('{"a":"ligne 1\nligne 2"}').data.a, 'ligne 1\nligne 2');
  assert.equal(ai.parseJson('{"a":"il a dit "oui" hier","b":1}').data.a, 'il a dit "oui" hier');
  const t = ai.parseJson('{"pitch":"p","questions":[{"q":"Q1","a":"A1"},{"q":"Q2","a":"A2"},{"q":"Q3","a":"tronq');
  assert.equal(t.repaired, true);
  assert.equal(t.data.questions.length, 3, 'le 3e objet est coupé après "q"');
  assert.equal(t.data.questions[2].a, undefined);
  assert.equal(t.data.pitch, 'p');
  const t2 = ai.parseJson('{"pitch":"p","questions":[{"q":"Q1","a":"A1"},{"q":"Q2","a":"A2');
  assert.equal(t2.data.questions.length, 2);
  assert.equal(t2.data.questions[1].a, undefined, 'la réponse coupée est retirée, normalizePrep écartera la question');
  assert.equal(ai.parseJson('pas de json'), null);
});

test('transcribe : WAV inline, Gemini uniquement (fast), filtre d\'hallucinations', async () => {
  const env = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  const replies = ['Sous-titres réalisés par la communauté d\'Amara.org', '[vide]', 'Could you introduce yourself? Merci d\'avoir regardé cette vidéo.', 'oui oui oui oui oui oui d\'accord'];
  env.handler = () => gJson(replies.shift());
  const wav = new Blob([new Uint8Array([82, 73, 70, 70, 1, 2, 3, 250, 251])], { type: 'audio/wav' });
  const a = await env.ai.transcribe(wav, { hint: 'DGEC, Mme Martin' });
  assert.equal(a.text, '');
  const c = env.calls[0];
  assert.ok(isGemini(c));
  assert.equal(modelOf(c), 'gemini-flash-lite-latest');
  const part = c.body.contents[0].parts[0].inline_data;
  assert.equal(part.mime_type, 'audio/wav');
  assert.equal(part.data, Buffer.from([82, 73, 70, 70, 1, 2, 3, 250, 251]).toString('base64'));
  assert.match(c.body.contents[0].parts[1].text, /DGEC, Mme Martin/);
  assert.equal(c.body.generationConfig.temperature, 0);
  assert.equal((await env.ai.transcribe(wav, {})).text, '');
  assert.equal((await env.ai.transcribe(wav, {})).text, 'Could you introduce yourself?');
  assert.equal((await env.ai.transcribe(wav, {})).text, 'oui d\'accord');
  const cOnly = makeEnv({ claudeKey: 'c-key' });
  await assert.rejects(cOnly.ai.transcribe(wav, {}), e => e.code === 'NO_KEY');
  assert.equal(cOnly.calls.length, 0);
  const ai = env.ai;
  assert.equal(ai.cleanTranscript('(musique) ♪♪'), '');
  assert.equal(ai.cleanTranscript('Il n\'y a pas de parole dans cet extrait.'), '');
  assert.equal(ai.cleanTranscript('Merci. Merci. Merci. Merci.'), 'Merci.');
  assert.equal(ai.cleanTranscript('[musique] What about your marketing plan?'), 'What about your marketing plan?');
  assert.equal(ai.cleanTranscript('Sous-titrage ST\' 501'), '');
  assert.equal(ai.cleanTranscript('Merci de votre attention, à bientôt.'), 'Merci de votre attention, à bientôt.');
  assert.equal(ai.cleanTranscript('non non non, pas du tout'), 'non non non, pas du tout');
  assert.equal(ai.cleanTranscript('très très bien, budget opérationnel de programme'), 'très très bien, budget opérationnel de programme');
  const loop = 'Je travaille sur le budget. '.repeat(12) + 'Et vous ?';
  assert.equal(ai.cleanTranscript(loop), 'Je travaille sur le budget. Et vous ?');
});

test('extractFile : PDF inline → repli Claude (bloc document) si Gemini en panne ; test()', async () => {
  const env = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  env.handler = (c) => isGemini(c) ? err(503, 'overloaded') : claudeSSE(['Fiche de poste\n', '- Missions']);
  const pdf = new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });
  const t = await env.ai.extractFile(pdf, 'application/pdf');
  assert.equal(t, 'Fiche de poste\n- Missions');
  const cc = env.calls.find(isClaude);
  assert.equal(cc.body.messages[0].content[0].type, 'document');
  assert.equal(cc.body.messages[0].content[0].source.media_type, 'application/pdf');
  const g = env.calls.find(isGemini);
  assert.equal(g.body.contents[0].parts[0].inline_data.mime_type, 'application/pdf');
  const docx = new Blob([new Uint8Array([1, 2])], { type: 'application/msword' });
  const onlyClaude = makeEnv({ claudeKey: 'c-key' });
  await assert.rejects(onlyClaude.ai.extractFile(docx, 'application/msword'), e => e.code === 'NO_KEY');
  const t2 = makeEnv({ geminiKey: 'g-key', claudeKey: 'bad' });
  t2.handler = (c) => isGemini(c) ? gJson('OK') : err(401, 'invalid x-api-key');
  const res = await t2.ai.test();
  assert.equal(res.length, 2);
  assert.equal(res[0].provider, 'gemini');
  assert.equal(res[0].ok, true);
  assert.equal(res[1].provider, 'claude');
  assert.equal(res[1].ok, false);
  assert.match(res[1].error, /Clé Claude refusée/);
});

test('Claude : 400 sur temperature → réessai sans ; 529 overloaded en plein flux → modèle suivant', async () => {
  const env = makeEnv({ claudeKey: 'c-key' });
  env.handler = (c) => c.body.temperature != null
    ? json({ type: 'error', error: { type: 'invalid_request_error', message: 'temperature is not supported for this model' } }, 400)
    : cJson('Sans température');
  const r = await env.ai.generate({ prompt: 'Q', temperature: 0.4 });
  assert.equal(r.text, 'Sans température');
  assert.equal(env.calls.length, 2);
  const e2 = makeEnv({ claudeKey: 'c-key' });
  e2.handler = (c) => c.body.model === 'claude-haiku-5-5'
    ? bytesResponse('event: message_start\ndata: {"type":"message_start","message":{}}\n\nevent: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n')
    : claudeSSE(['Relais']);
  const r2 = await e2.ai.generate({ prompt: 'Q', stream: true });
  assert.equal(r2.text, 'Relais');
  assert.equal(r2.model, 'claude-haiku-4-5');
});

test('403 propre à un modèle → modèle suivant sans ai:keyerror ; 2e 403 → clé en cause', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.handler = (c) => modelOf(c) === 'gemini-3.8-flash' ? err(403, 'Permission denied on resource project for model', { status: 'PERMISSION_DENIED' }) : gJson('OK');
  const r = await env.ai.generate({ prompt: 'Q' });
  assert.equal(r.model, 'gemini-3.6-flash');
  assert.equal(env.events.filter(e => e.type === 'ai:keyerror').length, 0);
  const e2 = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  e2.handler = (c) => isGemini(c) ? err(403, 'Forbidden', { status: 'PERMISSION_DENIED' }) : cJson('Claude');
  const r2 = await e2.ai.generate({ prompt: 'Q' });
  assert.equal(r2.provider, 'claude');
  assert.equal(e2.calls.filter(isGemini).length, 2);
  assert.equal(e2.events.filter(e => e.type === 'ai:keyerror').length, 1);
  const e3 = makeEnv({ geminiKey: 'g-key', claudeKey: 'c-key' });
  e3.handler = (c) => isGemini(c) ? err(403, 'Your API key was reported as leaked. Please use another API key.') : cJson('Claude');
  await e3.ai.generate({ prompt: 'Q' });
  assert.equal(e3.calls.filter(isGemini).length, 1, 'clé signalée : abandon immédiat de Gemini');
});

test('maxOutputTokens trop grand → réessai à 8192', async () => {
  const e2 = makeEnv({ geminiKey: 'g-key' });
  e2.handler = (c) => c.body.generationConfig.maxOutputTokens > 9300
    ? err(400, 'The value of max_output_tokens is out of range: must be <= 8192', { status: 'INVALID_ARGUMENT' })
    : gJson('OK');
  e2.settings.models.answer = 'gemini-2.0-flash';
  const r2 = await e2.ai.generate({ prompt: 'Q', maxTokens: 12000 });
  assert.equal(r2.text, 'OK');
  assert.equal(e2.calls.at(-1).body.generationConfig.maxOutputTokens, 8192);
});

test('découverte automatique en arrière-plan au 1er appel (non bloquante)', async () => {
  const env = makeEnv({ geminiKey: 'g-key' });
  env.ai.config.autoDiscover = true;
  env.handler = (c) => {
    if (/\/models\?pageSize/.test(c.url)) return json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    return gJson('OK');
  };
  await env.ai.generate({ prompt: 'Q' });
  await sleep(30);
  assert.ok(env.calls.some(c => /\/models\?pageSize/.test(c.url)));
  assert.equal(env.ai.pick('answer')[0].model, 'gemini-2.5-flash');
  const cache = JSON.parse(env.ctx.localStorage.getItem('aidevisio.models.v2'));
  assert.deepEqual(cache.gemini.ids, ['gemini-2.5-flash']);
  assert.ok(!JSON.stringify(cache).includes('g-key'), 'la clé n\'est jamais stockée dans le cache');
});

const PER_TEST_MS = 10000;
let pass = 0;
let fail = 0;
for (const t of tests) {
  try {
    await Promise.race([t.fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('délai dépassé (' + PER_TEST_MS + ' ms)')), PER_TEST_MS).unref())]);
    console.log('  ✓ ' + t.name);
    pass++;
  } catch (e) {
    console.log('  ✗ ' + t.name + '\n      ' + String((e && e.stack) || e).split('\n').slice(0, 6).join('\n      '));
    fail++;
  }
}
console.log('\nS.util : ' + utilMode + ' — ' + pass + ' réussi(s), ' + fail + ' échoué(s)');
process.exit(fail ? 1 : 0);
