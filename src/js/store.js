(function (S) {
  'use strict';

  const U = S.util;
  const G = typeof globalThis !== 'undefined' ? globalThis : window;
  const store = S.store = S.store || {};

  const LS_SETTINGS = 'aidevisio.settings';
  const KEYS_KEY = 'aidevisio.keys';

  const DEFAULT_SETTINGS = {
    openaiKey: '', geminiKey: '', claudeKey: '', groqKey: '', rememberKeys: true, provider: 'auto',
    models: { answer: 'auto', fast: 'auto', prep: 'auto' },
    theme: 'auto', fontScale: 1
  };

  function webStorage(type) {
    let st = null;
    try {
      st = G[type];
      st.setItem('__aidevisio__', '1');
      st.removeItem('__aidevisio__');
    } catch (e) { st = null; }
    const mem = new Map();
    return {
      ok: !!st,
      get(k) {
        try { if (st) return st.getItem(k); } catch (e) {  }
        return mem.has(k) ? mem.get(k) : null;
      },
      setStrict(k, v) {
        if (!st) { mem.set(k, String(v)); return; }
        st.setItem(k, v);
      },
      set(k, v) {
        try { this.setStrict(k, v); return true; } catch (e) { mem.set(k, String(v)); return false; }
      },
      remove(k) {
        mem.delete(k);
        try { if (st) st.removeItem(k); } catch (e) {  }
      },
      keys() {
        const out = new Set(mem.keys());
        try { if (st) for (let i = 0; i < st.length; i++) out.add(st.key(i)); } catch (e) {  }
        return Array.from(out).filter((k) => k != null);
      }
    };
  }
  const LS = webStorage('localStorage');
  const SS = webStorage('sessionStorage');

  function readJSON(storage, key) {
    const raw = storage.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v));
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  function deepMerge(target, src) {
    if (!isObj(src)) return target;
    for (const k of Object.keys(src)) {
      if (UNSAFE_KEYS.has(k) || src[k] === undefined) continue;
      if (isObj(src[k]) && isObj(target[k])) deepMerge(target[k], src[k]);
      else target[k] = isObj(src[k]) ? deepMerge({}, src[k]) : src[k];
    }
    return target;
  }
  function hidden(obj, key, value) {
    Object.defineProperty(obj, key, { value, enumerable: false, configurable: true, writable: true });
    return obj;
  }

  const backend = LS.ok ? 'localstorage' : 'memory';
  Object.defineProperty(store, 'backend', { get: () => backend, enumerable: true, configurable: true });

  let initPromise = null;
  function isChromium() {
    const nav = G.navigator || {};
    return !!nav.userAgentData || /Chrome|Chromium|Edg\//.test(nav.userAgent || '');
  }
  async function requestPersist(force) {
    try {
      const st = G.navigator && G.navigator.storage;
      if (!st || typeof st.persisted !== 'function') return false;
      if (await st.persisted()) return true;
      if (typeof st.persist !== 'function' || (!force && !isChromium())) return false;
      return !!(await st.persist());
    } catch (e) { return false; }
  }
  function setupSync() {
    try {
      G.addEventListener('storage', (e) => {
        if (e.key === LS_SETTINGS || e.key === KEYS_KEY || e.key === null) {
          settingsCache = null;
          emitSettings(['*'], true);
        }
      });
    } catch (e) {  }
  }

  store.init = function () {
    if (!initPromise) {
      initPromise = Promise.resolve().then(() => {
        settingsCache = null;
        store.settings();
        if (backend === 'memory') U.toast('Stockage bloqué par le navigateur : vos oraux et vos réglages ne seront pas conservés après fermeture.', 'warn');
        setupSync();
        requestPersist(false);
      });
    }
    return initPromise;
  };

  store.clearAll = async function () {
    [LS, SS].forEach((st) => st.keys().filter((k) => /^aidevisio/i.test(k)).forEach((k) => st.remove(k)));
    settingsCache = null;
    emitSettings(['*'], false);
  };

  let settingsCache = null;

  const KEY_NAMES = ['openaiKey', 'geminiKey', 'claudeKey', 'groqKey'];
  function readKeys(remember) {
    const sess = readJSON(SS, KEYS_KEY) || {};
    const loc = remember ? readJSON(LS, KEYS_KEY) || {} : {};
    const out = {};
    KEY_NAMES.forEach((k) => { out[k] = str(loc[k] || sess[k]).trim(); });
    return out;
  }
  function writeKeys(keys, remember) {
    const empty = KEY_NAMES.every((k) => !keys[k]);
    const obj = {};
    KEY_NAMES.forEach((k) => { obj[k] = keys[k] || ''; });
    const json = JSON.stringify(obj);
    const [keep, drop] = remember ? [LS, SS] : [SS, LS];
    if (empty) keep.remove(KEYS_KEY); else keep.set(KEYS_KEY, json);
    drop.remove(KEYS_KEY);
  }

  function loadSettings() {
    const stored = readJSON(LS, LS_SETTINGS);
    const s = deepMerge(clone(DEFAULT_SETTINGS), isObj(stored) ? stored : {});
    s.rememberKeys = s.rememberKeys !== false;
    const keys = readKeys(s.rememberKeys);
    KEY_NAMES.forEach((k) => { s[k] = keys[k] || ''; });
    return s;
  }

  function sanitizeSettings(s) {
    KEY_NAMES.forEach((k) => { s[k] = str(s[k]).trim(); });
    s.rememberKeys = s.rememberKeys !== false;
    if (!['auto', 'openai', 'gemini', 'claude', 'groq'].includes(s.provider)) s.provider = 'auto';
    if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = 'auto';
    if (!isObj(s.models)) s.models = clone(DEFAULT_SETTINGS.models);
    for (const k of ['answer', 'fast', 'prep']) if (!s.models[k]) s.models[k] = 'auto';
    s.fontScale = U.clamp(Number(s.fontScale) || 1, 0.6, 2.5);
    return s;
  }

  function emitSettings(changed, remote) {
    const s = store.settings();
    hidden(s, 'changed', changed);
    hidden(s, 'remote', !!remote);
    S.bus.emit('settings:changed', s);
  }

  store.settings = function () {
    if (!settingsCache) settingsCache = sanitizeSettings(loadSettings());
    return clone(settingsCache);
  };

  store.setSettings = function (patch) {
    const cur = settingsCache ? clone(settingsCache) : sanitizeSettings(loadSettings());
    const next = sanitizeSettings(deepMerge(clone(cur), isObj(patch) ? clone(patch) : {}));
    const persisted = clone(next);
    KEY_NAMES.forEach((k) => { delete persisted[k]; });
    if (!LS.set(LS_SETTINGS, JSON.stringify(persisted))) U.toast('Réglages non enregistrés durablement (stockage plein ou bloqué).', 'warn');
    writeKeys(next, next.rememberKeys);
    settingsCache = next;
    const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(cur[k]));
    if (changed.length) emitSettings(changed, false);
    return clone(next);
  };

  store.usage = async function () {
    let bytes = 0, quota = 0;
    try {
      const st = G.navigator && G.navigator.storage;
      if (st && typeof st.estimate === 'function') { const e = await st.estimate(); bytes = e.usage || 0; quota = e.quota || 0; }
    } catch (e) {  }
    if (!bytes) bytes = LS.keys().filter((k) => /^aidevisio/i.test(k)).reduce((n, k) => n + (k.length + str(LS.get(k)).length) * 2, 0);
    const persistent = await requestPersist(true);
    return { bytes, persistent, quota, backend };
  };
})(window.AideVisio = window.AideVisio || {});
