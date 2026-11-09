(function (S) {
  'use strict';

  const U = S.util;

  const icon = (n) => (S.ui && S.ui.icon ? S.ui.icon(n) : '');
  const esc = (s) => U.esc(s == null ? '' : String(s));
  const h = (html) => S.ui.h(String(html).trim());
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const levelUnit = (x) => { x = Number(x) || 0; return x > 0 ? clamp((20 * Math.log10(x) + 60) / 60, 0, 1) : 0; };
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function toast(msg, kind) {
    if (S.ui && S.ui.toast) S.ui.toast(msg, kind || 'info');
    else if (U.toast) U.toast(msg, kind || 'info');
  }

  function settings() {
    try { return S.store.settings() || {}; } catch (e) { return {}; }
  }

  function setSettings(patch) {
    try { S.store.setSettings(patch); } catch (e) { toast(`Réglage non enregistré : ${errText(e)}`, 'err'); }
  }

  function hasKey() {
    try { return !!(S.ai && S.ai.hasKey && S.ai.hasKey()); } catch (e) { return false; }
  }

  function go(hash) {
    if (S.app && S.app.go) S.app.go(hash);
    else location.hash = hash;
  }

  function lifecycle() {
    const fns = [];
    return {
      alive: true,
      add(fn) { if (typeof fn === 'function') fns.push(fn); return fn; },
      end() {
        this.alive = false;
        fns.splice(0).reverse().forEach((fn) => { try { fn(); } catch (e) {  } });
      }
    };
  }

  function mount(root, cls, html) {
    const el = h(`<section class="screen sc ${cls}">${html}</section>`);
    root.innerHTML = '';
    root.appendChild(el);
    try { window.scrollTo(0, 0); } catch (e) {  }
    return el;
  }

  function topbar(o) {
    return `<header class="topbar glass sc-topbar">
      <button type="button" class="icon-btn" data-act="back" aria-label="Retour" title="Retour">${icon('chevron-left')}</button>
      <div class="topbar-title sc-title"><span class="sc-title-main">${esc(o.title)}</span><span class="small muted sc-sub">${esc(o.sub || '')}</span></div>
      <div class="topbar-actions sc-actions">${o.actions || ''}</div>
    </header>`;
  }

  function section(title, rows, cls) {
    return `<section class="card card-pad sc-section${cls ? ` ${cls}` : ''}">
      ${title ? `<div class="card-head"><h2 class="h3">${esc(title)}</h2></div>` : ''}
      <div class="list">${rows}</div></section>`;
  }
  const tile = (name, color) => `<span class="tile tile-${color}">${icon(name)}</span>`;
  const chev = () => (S.ui && S.ui.icon ? S.ui.icon('chevron-right', 'chev') : '');
  const main = (title, sub, attrs) => `<span class="list-main"><b>${title}</b>${sub != null ? `<small${attrs ? ` ${attrs}` : ''}>${sub}</small>` : ''}</span>`;

  function onAct(el, handlers) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !el.contains(b) || b.disabled) return;
      const fn = handlers[b.dataset.act] || (b.dataset.act === 'home' ? () => go('#/') : null);
      if (!fn) return;
      e.preventDefault();
      fn(b, e);
    });
  }

  function errText(e) {
    if (!e) return 'erreur inconnue';
    const obj = typeof e === 'object';
    const code = obj ? String(e.code || '') : '';
    const status = obj ? Number(e.status) || 0 : 0;
    const name = obj ? String(e.name || '') : '';
    const msg = String((obj ? (e.message || e.error) : e) || '');
    if (code === 'KEY' || status === 401 || status === 403 || /refusée|\b40[13]\b|api.?key|invalid.*key|unauthori/i.test(msg)) return 'clé refusée';
    if (code === 'QUOTA' || status === 429 || /quota|\b429\b|rate.?limit|resource.?exhausted/i.test(msg)) return 'quota atteint, réessayez dans un instant';
    if (code === 'OFFLINE' || code === 'NETWORK' || /failed to fetch|networkerror|network error|réseau|connexion internet/i.test(msg)) return 'réseau indisponible';
    if (code === 'TIMEOUT' || name === 'AbortError' || name === 'TimeoutError' || /timeout|timed out|assez vite|délai/i.test(msg)) return 'délai dépassé';
    if (code === 'NO_KEY' || /aucune clé/i.test(msg)) return 'aucune clé IA';
    return (msg.replace(/[.\s]+$/, '') || 'erreur inconnue').slice(0, 180);
  }

  function fmtNum(n, dec) {
    return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: dec == null ? 1 : dec, minimumFractionDigits: 0 });
  }
  function fmtMs(ms) {
    ms = Math.round(Number(ms) || 0);
    return ms < 1000 ? `${ms} ms` : `${fmtNum(ms / 1000, 1)} s`;
  }
  function fmtBytes(b) {
    b = Number(b) || 0;
    if (b < 1024) return `${b} o`;
    if (b < 1048576) return `${fmtNum(b / 1024, 0)} Ko`;
    return `${fmtNum(b / 1048576, 1)} Mo`;
  }
  function support() {
    let sup = null;
    try { sup = S.audio && S.audio.support ? S.audio.support() : null; } catch (e) { sup = null; }
    const md2 = navigator.mediaDevices || {};
    return Object.assign({
      getUserMedia: !!md2.getUserMedia,
      getDisplayMedia: !!md2.getDisplayMedia,
      displayAudio: !!md2.getDisplayMedia && /Chrome|Edg\//.test(navigator.userAgent) && !/Android|Mobile/i.test(navigator.userAgent),
      webSpeech: !!SR(),
      audioWorklet: !!(window.AudioWorkletNode),
      wakeLock: 'wakeLock' in navigator,
      docPiP: 'documentPictureInPicture' in window
    }, sup || {});
  }

  function browserInfo() {
    const ua = navigator.userAgent || '';
    const uad = navigator.userAgentData;
    let m; let name = 'Navigateur'; let ver = 0;
    if ((m = ua.match(/Edg(?:A|iOS)?\/(\d+)/))) { name = 'Edge'; ver = +m[1]; }
    else if ((m = ua.match(/(?:OPR|Opera)\/(\d+)/))) { name = 'Opera'; ver = +m[1]; }
    else if ((m = ua.match(/(?:Firefox|FxiOS)\/(\d+)/))) { name = 'Firefox'; ver = +m[1]; }
    else if ((m = ua.match(/(?:Chrome|CriOS)\/(\d+)/))) { name = 'Chrome'; ver = +m[1]; }
    else if ((m = ua.match(/Version\/(\d+).*Safari/))) { name = 'Safari'; ver = +m[1]; }
    const android = /Android/i.test(ua);
    const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const mobile = uad && typeof uad.mobile === 'boolean' ? uad.mobile : (android || ios || /Mobile/i.test(ua));
    const chromium = /Chrome\/|Edg\//.test(ua) && !ios && !/Firefox/.test(ua);
    return { name, ver, android, ios, mobile, chromium };
  }

  function keyRow(p) {
    const k = p.id + 'Key';
    const v = settings()[k] || '';
    return `<div class="list-row st-key">
      <div class="st-key-head"><div class="st-key-name">${tile(p.icon, p.color)}<b>${p.name}</b>${p.badge}</div>
        <a class="small st-link" href="${p.url}" target="_blank" rel="noopener noreferrer">${p.linkLabel}</a></div>
      <div class="st-key-field">
        <input type="text" class="secret-input" name="sf-${k}" data-1p-ignore data-lpignore="true" data-form-type="other" data-key="${k}" value="${esc(v)}" placeholder="${p.placeholder}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Clé ${p.name}">
        <button type="button" class="icon-btn" data-act="eye" aria-label="Afficher la clé" title="Afficher la clé">${icon('eye')}</button>
        <button type="button" class="btn btn-sm btn-ghost" data-act="test" data-provider="${p.id}">Tester</button>
      </div>
      <div class="small muted st-key-status" data-status="${p.id}" aria-live="polite">${esc(p.hint)}</div>
    </div>`;
  }

  function cleanKey(v) {
    return String(v || '').replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
  }

  // ---------- Données (export / import / effacement) ----------

  const LS_LIMIT = 5 * 1024 * 1024;
  const NO_EXPORT = /^aidevisio\.(keys|models)$/i;

  function lsKeys() {
    const out = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /^aidevisio/i.test(k)) out.push(k); } } catch (e) {  }
    return out;
  }
  function lsJSON(k) {
    try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hasLists = (v) => isObj(v) && (Array.isArray(v.sessions) || Array.isArray(v.customSubjects));

  function dataStats() {
    let chars = 0; let sessions = 0; let subjects = 0;
    lsKeys().forEach((k) => {
      const raw = localStorage.getItem(k) || '';
      chars += k.length + raw.length;
      const v = /^aidevisio\.exam/i.test(k) ? lsJSON(k) : null;
      if (hasLists(v)) {
        sessions += (v.sessions || []).length;
        subjects += (v.customSubjects || []).length;
      }
    });
    return { chars, sessions, subjects, pct: Math.min(100, (chars / LS_LIMIT) * 100) };
  }

  function exportData() {
    const data = {};
    lsKeys().filter((k) => !NO_EXPORT.test(k)).forEach((k) => {
      const raw = localStorage.getItem(k);
      let v = raw;
      try { v = JSON.parse(raw); } catch (e) { v = raw; }
      data[k] = v;
    });
    const st = dataStats();
    const file = { app: 'aidevisio', type: 'sauvegarde', version: 1, exportedAt: new Date().toISOString(), sessions: st.sessions, data };
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const name = `aidevisio-seances-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
    if (S.ui && S.ui.download) S.ui.download(blob, name);
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); }
    return { name, sessions: st.sessions };
  }

  const stampOf = (x) => String((x && (x.updatedAt || x.createdAt)) || '');
  function mergeById(cur, inc) {
    const map = new Map();
    (cur || []).forEach((x) => { if (x && x.id) map.set(x.id, x); });
    let added = 0;
    (inc || []).forEach((x) => {
      if (!x || !x.id) return;
      const old = map.get(x.id);
      if (!old) { map.set(x.id, x); added++; } else if (stampOf(x) > stampOf(old)) map.set(x.id, x);
    });
    return { list: Array.from(map.values()), added };
  }

  // Fusionne une sauvegarde : rien de ce qui est déjà sur le PC n’est supprimé.
  function importData(file) {
    let data = null;
    if (isObj(file) && file.app === 'aidevisio' && isObj(file.data)) data = file.data;
    else if (hasLists(file)) data = { 'aidevisio.exam.v1': file };
    if (!data) throw new Error('Ce fichier n’est pas une sauvegarde Aide Visio.');
    let added = 0; let subjects = 0;
    const writes = [];
    Object.keys(data).forEach((k) => {
      if (!/^aidevisio\./i.test(k) || NO_EXPORT.test(k) || /^aidevisio\.(__proto__|constructor|prototype)$/.test(k)) return;
      const v = data[k];
      if (hasLists(v)) {
        const cur = lsJSON(k);
        const base = isObj(cur) ? cur : {};
        const s = mergeById(base.sessions, v.sessions);
        const cs = mergeById(base.customSubjects, v.customSubjects);
        added += s.added; subjects += cs.added;
        writes.push([k, JSON.stringify(Object.assign({}, v, base, { sessions: s.list, customSubjects: cs.list }))]);
      } else if (/^aidevisio\.settings$/i.test(k) && isObj(v)) {
        const cur = lsJSON(k);
        writes.push([k, JSON.stringify(Object.assign({}, v, isObj(cur) ? cur : {}))]);
      } else if (localStorage.getItem(k) == null) {
        writes.push([k, typeof v === 'string' ? v : JSON.stringify(v)]);
      }
    });
    const backup = writes.map(([k]) => [k, localStorage.getItem(k)]);
    try {
      writes.forEach(([k, v]) => localStorage.setItem(k, v));
    } catch (e) {
      backup.forEach(([k, v]) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (er) {  } });
      throw new Error(/quota/i.test(e.name + e.message) ? 'Plus assez de place : effacez d’anciennes séances puis réessayez.' : 'Écriture impossible dans le navigateur.');
    }
    return { added, subjects };
  }

  function runSettings(el, c) {
    const body = el.querySelector('.sc-body');
    const s = settings();
    const sw = (key, checked, label) => `<label class="switch"><input type="checkbox" data-set="${key}" ${checked ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;
    const seg = (key, value, opts) => `<div class="seg" role="group">${opts.map(([v, l]) =>
      `<button type="button" data-act="seg" data-set="${key}" data-v="${v}" class="${String(value) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const scale = Number(s.fontScale) || 1;

    // Choix des modèles : toujours automatique.
    const m = s.models || {};
    if (['answer', 'fast', 'prep'].some((p) => m[p] && m[p] !== 'auto')) setSettings({ models: { answer: 'auto', fast: 'auto', prep: 'auto' } });

    body.innerHTML = `
      ${section('Clé IA', `
        ${(s.geminiKey || s.openaiKey || s.groqKey) ? '' : `<div class="list-row st-key st-unlock">
          <div class="st-key-head"><div class="st-key-name">${tile('lock', 'blue')}<b>Code des clés</b></div></div>
          <div class="st-key-field">
            <input type="text" data-f="vault-code" placeholder="Votre code (ex. mot-mot-mot-mot-12)" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Code des clés">
            <button type="button" class="btn btn-sm btn-primary" data-act="unlock">Débloquer</button>
          </div>
          <div class="small muted st-key-status" data-status="vault" aria-live="polite">Entrez votre code une fois : les clés s’installent sur cet appareil.</div>
        </div>`}
        ${keyRow({ id: 'gemini', name: 'Google Gemini', icon: 'sparkles', color: 'blue', badge: '<span class="pill pill-ok">Gratuite</span>', url: 'https://aistudio.google.com/apikey', linkLabel: 'Obtenir ma clé gratuite', placeholder: 'Collez votre clé ici (AIza…)', hint: 'Une seule clé suffit pour tout utiliser.' })}`)}

      ${section('Micro, son et caméra', `
        <button type="button" class="list-row st-big" data-act="diag">${tile('mic', 'green')}${main('Vérifier mon PC', 'Micro, haut-parleur, caméra, voix anglaise, clé IA et internet.', 'data-devsum')}${chev()}</button>`)}

      ${section('Affichage', `
        <div class="list-row st-wrap">${tile('eye', 'blue')}${main('Thème', null)}${seg('theme', s.theme || 'auto', [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']])}</div>
        <div class="list-row st-range st-wrap">${tile('edit', 'blue')}${main('Taille du texte pendant l’appel', null)}
          <span class="st-range-ctl"><input type="range" min="0.8" max="1.6" step="0.05" value="${scale}" data-set="fontScale" aria-label="Taille du texte"><output data-out="fontScale">${Math.round(scale * 100)} %</output></span></div>
        <div class="list-row"><div class="st-preview" style="--st-scale:${scale}"><b>In my view, the article raises a key question for European firms.</b></div></div>`)}

      ${section('Mes données', `
        <div class="list-row">${tile('doc', 'gray')}${main('Sur ce PC', 'Calcul…', 'data-space')}
          <button type="button" class="btn btn-sm btn-ghost" data-act="persist" hidden>${icon('shield')} Protéger</button></div>
        <div class="st-data">
          <button type="button" class="btn" data-act="export">${icon('export')}<span>Exporter mes séances</span></button>
          <button type="button" class="btn" data-act="import">${icon('import')}<span>Importer</span></button>
          <button type="button" class="btn st-danger-btn" data-act="wipe">${icon('trash')}<span>Tout effacer</span></button>
        </div>
        <p class="small muted st-data-note">L’export crée un fichier à garder (clé USB, mail). L’import ajoute ses séances sans rien supprimer. Vos clés ne sont jamais exportées.</p>`)}

      <details class="ex-more st-adv"><summary>Réglages avancés</summary>
      ${section('Autres clés (facultatives)', `
        ${keyRow({ id: 'openai', name: 'OpenAI', icon: 'bolt', color: 'blue', badge: '<span class="pill">Payante</span>', url: 'https://platform.openai.com/api-keys', linkLabel: 'Obtenir une clé', placeholder: 'sk-' + 'proj-…', hint: 'Réponses un peu plus rapides.' })}
        ${keyRow({ id: 'claude', name: 'Anthropic Claude', icon: 'shield', color: 'orange', badge: '<span class="pill">Payante</span>', url: 'https://console.anthropic.com/settings/keys', linkLabel: 'Obtenir une clé', placeholder: 'sk-' + 'ant-…', hint: 'Prend le relais si les autres ne répondent pas.' })}
        ${keyRow({ id: 'groq', name: 'Groq', icon: 'bolt', color: 'violet', badge: '<span class="pill pill-ok">Gratuite</span>', url: 'https://console.groq.com/keys', linkLabel: 'Obtenir une clé gratuite', placeholder: 'gsk_…', hint: 'Transcription très rapide de la voix.' })}`)}
      ${section('', `
        <div class="list-row st-wrap">${tile('bolt', 'violet')}${main('IA utilisée en premier', 'Auto : la plus rapide qui marche.')}
          ${seg('provider', s.provider || 'auto', [['auto', 'Auto'], ['openai', 'OpenAI'], ['gemini', 'Gemini'], ['claude', 'Claude'], ['groq', 'Groq']])}</div>
        <div class="list-row">${tile('person', 'gray')}${main('Garder les clés sur ce PC', 'À décocher sur un ordinateur prêté.')}
          ${sw('rememberKeys', s.rememberKeys !== false, 'Garder les clés sur ce PC')}</div>`)}
      </details>

      <p class="small muted st-about">${icon('shield')} Vos séances et vos clés restent sur ce PC. Aucun serveur intermédiaire.</p>`;

    async function loadUsage() {
      const out = body.querySelector('[data-space]');
      const btn = body.querySelector('[data-act="persist"]');
      const st = dataStats();
      const parts = [
        plural(st.sessions, 'séance', 'séances'),
        st.subjects ? plural(st.subjects, 'sujet importé', 'sujets importés') : '',
        `${fmtBytes(st.chars)} utilisés (${st.pct < 1 ? 'moins de 1' : Math.round(st.pct)} % de la place)`
      ].filter(Boolean);
      out.textContent = parts.join(' · ');
      try {
        const u = await S.store.usage();
        if (!c.alive) return;
        if (u.backend === 'memory') {
          out.innerHTML = `${esc(parts.join(' · '))} <span class="pill pill-err">Rien n’est gardé</span>`;
          return;
        }
        out.innerHTML = `${esc(parts.join(' · '))} ${u.persistent ? '<span class="pill pill-ok">Protégé</span>' : '<span class="pill pill-warn">Non protégé</span>'}`;
        btn.hidden = !!u.persistent || !(navigator.storage && navigator.storage.persist);
      } catch (e) {  }
      if (st.pct > 80) out.insertAdjacentHTML('beforeend', ' <span class="pill pill-warn">Presque plein : exportez puis effacez</span>');
    }

    async function loadDevices() {
      const out = body.querySelector('[data-devsum]');
      const D = S.devices;
      if (!D || !out) return;
      const s2 = settings();
      const bits = [];
      if (s2.micLabel) bits.push(`Micro : ${s2.micLabel}`);
      if (s2.speakerLabel) bits.push(`Sortie : ${s2.speakerLabel}`);
      try { const v = await D.voice(); if (v && s2.voiceURI) bits.push(`Voix : ${D.niceVoiceName(v).split(' · ')[0]}`); } catch (e) {  }
      if (!c.alive) return;
      if (bits.length) out.textContent = bits.join(' · ');
    }

    const saveKeyLater = U.debounce((k, v) => saveKey(k, v), 500);
    function saveKey(k, v) {
      const clean = cleanKey(v);
      if ((settings()[k] || '') === clean) return;
      setSettings({ [k]: clean });
    }

    async function testKey(provider, btn) {
      const input = body.querySelector(`[data-key="${provider}Key"]`);
      const out = body.querySelector(`[data-status="${provider}"]`);
      saveKey(input.dataset.key, input.value);
      if (!cleanKey(input.value)) { out.innerHTML = `<span class="pill pill-warn">${icon('warning')} Aucune clé saisie</span> Collez la clé copiée sur la page « Obtenir ma clé ».`; return; }
      btn.disabled = true;
      out.innerHTML = '<span class="spinner"></span> Test en cours…';
      try {
        const res = (await S.ai.test()) || [];
        if (!c.alive) return;
        const mine = res.filter((r) => r && r.provider === provider);
        const ok = mine.find((r) => r.ok);
        if (ok) {
          out.innerHTML = `<span class="pill pill-ok">${icon('check')} Clé valide</span> Réponse en ${fmtMs(ok.ms)}.`;
        } else if (mine.length) {
          out.innerHTML = `<span class="pill pill-err">${icon('xmark')} Échec</span> ${esc(keyAdvice(errText(mine[0].error), provider))}`;
        } else {
          out.innerHTML = `<span class="pill pill-warn">${icon('info')} Non testée</span> Ouvrez « Réglages avancés » et choisissez « Auto ».`;
        }
      } catch (e) {
        out.innerHTML = `<span class="pill pill-err">${icon('xmark')} Échec</span> ${esc(keyAdvice(errText(e), provider))}`;
      }
      btn.disabled = false;
    }

    async function wipe() {
      const ok = await S.ui.confirm({
        title: 'Tout effacer sur ce PC ?',
        text: 'Vos séances, les sujets importés, vos réglages et vos clés seront supprimés définitivement. Pensez à « Exporter mes séances » avant.',
        okLabel: 'Tout effacer',
        danger: true
      });
      if (!ok) return;
      try {
        if (typeof S.store.clearAll === 'function') await S.store.clearAll();
        [window.localStorage, window.sessionStorage].forEach((stg) => {
          try { Object.keys(stg).filter((k) => /^aidevisio/i.test(k)).forEach((k) => stg.removeItem(k)); } catch (e) {  }
        });
        toast('Tout a été effacé de ce PC.', 'ok');
        setTimeout(() => { location.hash = '#/'; location.reload(); }, 700);
      } catch (e) {
        toast(`Effacement incomplet : ${errText(e)}`, 'err');
      }
    }

    async function doImport() {
      const files = S.ui && S.ui.pickFiles ? await S.ui.pickFiles({ accept: '.json,application/json' }) : [];
      const f = files && files[0];
      if (!f) return;
      try {
        const txt = await f.text();
        let parsed = null;
        try { parsed = JSON.parse(txt); } catch (e) { throw new Error('Fichier illisible : choisissez le fichier .json créé par « Exporter mes séances ».'); }
        const r = importData(parsed);
        toast(r.added || r.subjects
          ? `Import réussi : ${plural(r.added, 'séance ajoutée', 'séances ajoutées')}${r.subjects ? `, ${plural(r.subjects, 'sujet', 'sujets')}` : ''}.`
          : 'Import terminé : ces séances étaient déjà sur ce PC.', 'ok');
        setTimeout(() => location.reload(), 900);
      } catch (e) {
        toast(e && e.message ? e.message : 'Import impossible.', 'err');
      }
    }

    function rangeLabel(input) {
      const k = input.dataset.set;
      const out = body.querySelector(`[data-out="${k}"]`);
      const v = Number(input.value);
      if (k === 'fontScale') {
        out.textContent = `${Math.round(v * 100)} %`;
        const pv = body.querySelector('.st-preview');
        if (pv) pv.style.setProperty('--st-scale', v);
      }
    }
    const saveRange = U.debounce((k, v) => setSettings({ [k]: v }), 150);

    onAct(el, {
      back: () => go('#/'),
      seg: (b) => {
        setSettings({ [b.dataset.set]: b.dataset.v });
        b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      },
      eye: (b) => {
        const input = b.parentElement.querySelector('input');
        const show = input.classList.contains('secret-input');
        input.classList.toggle('secret-input', !show);
        b.innerHTML = icon(show ? 'eye-slash' : 'eye');
        b.setAttribute('aria-label', show ? 'Masquer la clé' : 'Afficher la clé');
        b.title = b.getAttribute('aria-label');
      },
      test: (b) => testKey(b.dataset.provider, b),
      persist: async () => {
        try {
          const ok = await navigator.storage.persist();
          toast(ok ? 'Données protégées.' : 'Chrome a refusé : installez l’app (icône dans la barre d’adresse) pour protéger vos données.', ok ? 'ok' : 'warn');
        } catch (e) { toast('Protection indisponible.', 'warn'); }
        loadUsage();
      },
      export: () => {
        try {
          const r = exportData();
          toast(`Fichier « ${r.name} » enregistré (${plural(r.sessions, 'séance', 'séances')}).`, 'ok');
        } catch (e) { toast('Export impossible.', 'err'); }
      },
      import: () => doImport(),
      diag: () => go('#/diag'),
      unlock: async () => {
        const inp = el.querySelector('[data-f="vault-code"]');
        const st = el.querySelector('[data-status="vault"]');
        const code = inp ? inp.value.trim() : '';
        if (!code) { if (st) st.textContent = 'Entrez le code.'; if (inp) inp.focus(); return; }
        if (st) st.textContent = 'Déverrouillage…';
        try {
          await S.app.unlockVault(code);
          toast('Clés IA installées sur cet appareil.', 'ok');
          S.app.refresh();
        } catch (e) {
          if (st) st.textContent = e.code === 'BAD_CODE' ? 'Code incorrect : vérifiez-le et réessayez.' : (e.message || 'Déverrouillage impossible.');
        }
      },
      wipe: () => wipe()
    });

    el.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-key]')) saveKeyLater(t.dataset.key, t.value);
      else if (t.matches('input[type="range"][data-set]')) { rangeLabel(t); saveRange(t.dataset.set, Number(t.value)); }
    });
    el.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-key]')) { saveKey(t.dataset.key, t.value); t.value = cleanKey(t.value); }
      else if (t.matches('input[type="checkbox"][data-set]')) setSettings({ [t.dataset.set]: t.checked });
    });

    if (S.bus && S.bus.on) {
      c.add(S.bus.on('settings:changed', () => {
        const cur = settings();
        body.querySelectorAll('[data-key]').forEach((i) => {
          if (document.activeElement !== i && cleanKey(i.value) !== (cur[i.dataset.key] || '')) i.value = cur[i.dataset.key] || '';
        });
      }));
    }

    loadUsage();
    loadDevices();
  }

  function keyAdvice(t, provider) {
    if (/clé refusée/.test(t)) return 'Clé refusée : recopiez-la en entier depuis la page de la clé, sans espace.';
    if (/quota/.test(t)) return provider === 'gemini' ? 'Trop de demandes pour la clé gratuite : attendez une minute puis réessayez.' : 'Crédit insuffisant sur ce compte.';
    if (/réseau/.test(t)) return 'Pas de réponse : vérifiez internet (ou coupez le VPN), puis réessayez.';
    if (/délai/.test(t)) return 'Réponse trop lente : vérifiez internet puis réessayez.';
    if (/aucune clé/.test(t)) return 'Aucune clé enregistrée.';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  const settingsScreen = (() => {
    let ctx = null;
    return {
      leave() { if (ctx) ctx.end(); ctx = null; },
      render(root) {
        if (ctx) ctx.end();
        const c = ctx = lifecycle();
        const el = mount(root, 'st', `${topbar({ title: 'Réglages' })}<div class="sc-body"></div>`);
        runSettings(el, c);
      }
    };
  })();

  const STATUS_ICON = { ok: 'check', warn: 'warning', err: 'xmark', info: 'info', ask: 'info' };

  const DIAG_ROWS = [
    { key: 'mic', icon: 'mic', color: 'green', title: 'Micro', test: 'Tester le micro' },
    { key: 'speaker', icon: 'speaker', color: 'blue', title: 'Haut-parleur', test: 'Écouter un son' },
    { key: 'camera', icon: 'video', color: 'teal', title: 'Caméra', test: 'Voir l’aperçu' },
    { key: 'speech', icon: 'waveform', color: 'violet', title: 'Reconnaissance vocale (anglais)', test: 'Dire « hello »' },
    { key: 'voice', icon: 'chat', color: 'orange', title: 'Voix anglaise', test: 'Écouter la voix' },
    { key: 'key', icon: 'key', color: 'blue', title: 'Clé IA', test: 'Tester la clé' },
    { key: 'online', icon: 'globe', color: 'gray', title: 'Connexion internet', test: 'Tester' },
    { key: 'call', icon: 'video', color: 'gray', title: 'Son de l’appel Teams (facultatif)', test: 'Tester (5 s)', optional: true }
  ];

  function runDiag(el, c) {
    const body = el.querySelector('.sc-body');
    const D = S.devices;
    const sup = support();
    const b = browserInfo();
    const rows = DIAG_ROWS.map((r) => Object.assign({ status: 'idle', detail: '', advice: '', actions: null, meter: null, select: null }, r));
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    const busy = {};
    const lists = { mic: [], speaker: [], camera: [], voice: [] };
    const asks = {};
    let running = false;
    let ranOnce = false;
    let camStream = null; let camTimer = 0;
    let displayCleanup = null;

    body.innerHTML = `
      <div class="card card-pad dg-summary"></div>
      ${section('', rows.map((r) => `<div class="list-row dg-row" data-key="${r.key}"><div class="dg-ic"></div><div class="dg-main sc-grow"><div class="dg-dyn"></div>${r.key === 'camera' ? '<div class="dg-media" hidden><video muted playsinline autoplay></video></div>' : ''}</div></div>`).join(''), 'dg-list')}
      <p class="small muted dg-foot">${icon('info')} À faire sur le PC de l’oral, quelques minutes avant l’appel. Micro et caméra sont libérés dès la fin de chaque test.</p>`;

    // ---------- Dessin ----------

    function badge(s) {
      if (s === 'pending') return '<span class="spinner"></span>';
      if (s === 'idle') return '<span class="dg-badge is-idle"></span>';
      return `<span class="dg-badge is-${s}">${icon(STATUS_ICON[s] || 'info')}</span>`;
    }

    function selectHtml(r) {
      const sel = r.select;
      if (!sel || !sel.options || sel.options.length < 2) return '';
      return `<label class="dg-pick"><span class="small muted">${esc(sel.label)}</span>
        <select data-pick="${r.key}" aria-label="${esc(sel.label)}">${sel.options.map((o) => `<option value="${esc(o.id)}"${o.id === sel.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
    }

    function drawRow(r) {
      const node = body.querySelector(`.dg-row[data-key="${r.key}"]`);
      if (!node) return;
      node.className = `list-row dg-row is-${r.status}`;
      node.querySelector('.dg-ic').innerHTML = badge(r.status);
      const acts = r.actions || (r.status === 'pending' ? [] : [{ op: 'test', label: r.status === 'idle' ? r.test : 'Refaire', primary: false }]);
      node.querySelector('.dg-dyn').innerHTML = `
        <div class="dg-title">${icon(r.icon)}<span>${esc(r.title)}</span></div>
        ${r.detail ? `<div class="dg-detail">${esc(r.detail)}</div>` : ''}
        ${r.meter != null ? `<div class="meter dg-meter"><i style="--v:${clamp(r.meter, 0, 1).toFixed(3)}"></i></div>` : ''}
        ${r.advice ? `<div class="dg-advice small">${esc(r.advice)}</div>` : ''}
        ${acts.length || (r.select && r.select.options.length > 1) ? `<div class="dg-ctl">
          ${acts.map((a) => `<button type="button" class="btn ${a.primary ? 'btn-primary' : ''}" data-act="row" data-key="${r.key}" data-op="${a.op}" ${running && a.op === 'test' ? 'disabled' : ''}>${esc(a.label)}</button>`).join('')}
          ${selectHtml(r)}</div>` : ''}`;
    }

    function set(key, patch) {
      const r = byKey[key];
      Object.assign(r, { detail: '', advice: '', actions: null, meter: null }, patch);
      drawRow(r);
      drawSummary();
    }

    function setMeter(key, v, text) {
      const node = body.querySelector(`.dg-row[data-key="${key}"]`);
      if (!node) return;
      const i = node.querySelector('.dg-meter > i');
      if (i) i.style.setProperty('--v', clamp(v, 0, 1).toFixed(3));
      if (text != null) { const d = node.querySelector('.dg-detail'); if (d) d.textContent = text; }
    }

    function detail(key, text) {
      const d = body.querySelector(`.dg-row[data-key="${key}"] .dg-detail`);
      if (d) d.textContent = text;
    }

    function focusRow(key) {
      const node = body.querySelector(`.dg-row[data-key="${key}"]`);
      try { if (node && node.scrollIntoView) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {  }
    }

    function browserProblem() {
      if (!window.isSecureContext) return 'Page non sécurisée : ouvrez Aide Visio par son adresse https://.';
      if (!b.chromium || b.mobile) return `Vous utilisez ${b.name} : pour l’oral, ouvrez Aide Visio dans Google Chrome sur le PC.`;
      if (b.ver && b.ver < 116) return 'Chrome est ancien : mettez-le à jour (menu ⋮ → Aide → À propos de Google Chrome).';
      return '';
    }

    function drawSummary() {
      const main = rows.filter((r) => !r.optional || r.status !== 'idle');
      const n = { ok: 0, warn: 0, err: 0, idle: 0, pending: 0, ask: 0, info: 0 };
      main.forEach((r) => { n[r.status] = (n[r.status] || 0) + 1; });
      const done = n.ok + n.warn + n.err + n.ask + n.info;
      let cls = 'is-info'; let title = 'Vérifiez votre PC avant l’oral'; let ic = 'shield';
      let sub = 'Un clic, environ une minute. Gardez Teams fermé pendant le test de la caméra.';
      if (running || n.pending) { cls = 'is-pending'; title = 'Vérification en cours…'; ic = 'clock'; sub = 'Suivez les consignes affichées sur chaque ligne.'; }
      else if (n.err) { cls = 'is-err'; title = plural(n.err, 'problème à corriger', 'problèmes à corriger'); ic = 'xmark'; sub = 'Lisez la consigne sous la ligne en rouge, puis cliquez sur « Refaire ».'; }
      else if (n.ask) { cls = 'is-warn'; title = 'Une réponse est attendue'; ic = 'info'; sub = 'Dites si vous avez bien entendu le son.'; }
      else if (done && !n.idle) {
        if (n.warn) { cls = 'is-warn'; title = `Prêt, avec ${plural(n.warn, 'point à surveiller', 'points à surveiller')}`; ic = 'warning'; sub = 'Lisez les conseils sous les lignes en orange.'; }
        else { cls = 'is-ok'; title = 'Tout est prêt pour l’oral'; ic = 'check'; sub = `${plural(n.ok, 'vérification réussie', 'vérifications réussies')}.`; }
      } else if (done && ranOnce) { sub = `${plural(n.ok, 'vérification réussie', 'vérifications réussies')} · ${plural(n.idle, 'reste', 'restent')} à faire.`; }
      const warnB = browserProblem();
      const box = body.querySelector('.dg-summary');
      box.className = `card card-pad dg-summary ${cls}`;
      box.innerHTML = `<div class="dg-sum-ic">${icon(ic)}</div>
        <div class="sc-grow"><div class="h2">${esc(title)}</div><div class="small muted">${esc(sub)}</div>
          ${warnB ? `<div class="dg-advice small">${esc(warnB)}</div>` : ''}</div>
        <button type="button" class="btn btn-primary btn-lg dg-all" data-act="all" ${running ? 'disabled' : ''}>${running ? '<span class="spinner"></span> En cours…' : `${icon(ranOnce ? 'refresh' : 'check')} ${ranOnce ? 'Tout revérifier' : 'Tout vérifier'}`}</button>`;
    }

    // ---------- Listes d'appareils ----------

    async function refreshLists() {
      if (!D) return;
      const [mic, speaker, camera] = await Promise.all([D.list('mic'), D.list('speaker'), D.list('camera')]);
      if (!c.alive) return;
      lists.mic = D.hasLabels(mic) ? mic : [];
      lists.speaker = D.hasLabels(speaker) && D.canChooseSpeaker() ? speaker : [];
      lists.camera = D.hasLabels(camera) ? camera : [];
      const mk = (kind, label) => {
        const real = lists[kind].filter((o) => !o.isDefault);
        const cur = D.chosen(kind);
        const value = lists[kind].some((o) => o.id === cur) ? cur : '';
        byKey[kind].select = real.length > 1 ? { label, options: lists[kind], value } : null;
        drawRow(byKey[kind]);
      };
      mk('mic', 'Micro utilisé');
      mk('speaker', 'Sortie du son');
      mk('camera', 'Caméra utilisée');
    }

    async function refreshVoices() {
      if (!D) return;
      const vs = await D.voices();
      if (!c.alive) return;
      lists.voice = vs;
      if (vs.length > 1) {
        const cur = await D.voice();
        byKey.voice.select = { label: 'Voix', options: vs.map((v) => ({ id: v.voiceURI, label: D.niceVoiceName(v) })), value: cur ? cur.voiceURI : '' };
      } else byKey.voice.select = null;
      drawRow(byKey.voice);
    }

    // ---------- Questions « Avez-vous entendu ? » ----------

    function ask(key, question, onNo) {
      set(key, {
        status: 'ask',
        detail: question,
        select: byKey[key].select,
        actions: [{ op: 'yes', label: 'Oui, j’ai entendu', primary: true }, { op: 'no', label: 'Non' }, { op: 'test', label: 'Réécouter' }]
      });
      return new Promise((res) => {
        const t = setTimeout(() => { delete asks[key]; res(null); }, 45000);
        asks[key] = (v) => { clearTimeout(t); delete asks[key]; if (v === 'no' && onNo) onNo(); res(v); };
      });
    }
    function answer(key, v) { if (asks[key]) asks[key](v); }

    // ---------- Tests ----------

    async function permissionGate(kind, key) {
      const st = await D.permission(kind);
      if (st !== 'denied') return true;
      const x = D.explain({ name: 'NotAllowedError' }, kind);
      set(key, { status: 'err', detail: x.title, advice: x.advice });
      return false;
    }

    async function testMic() {
      if (busy.mic || !D) return;
      busy.mic = true;
      focusRow('mic');
      try {
        if (!sup.getUserMedia) { set('mic', { status: 'err', detail: 'Micro inaccessible dans ce navigateur.', advice: 'Ouvrez Aide Visio dans Google Chrome à jour.' }); return; }
        if (!(await permissionGate('mic', 'mic'))) return;
        set('mic', { status: 'pending', detail: 'Parlez normalement pendant 3 secondes… (Chrome peut demander l’autorisation : cliquez sur « Autoriser »)', meter: 0 });
        const r = await D.testMic({ ms: 3000, alive: () => c.alive, onLevel: (v, left) => setMeter('mic', v, `Parlez normalement… ${Math.ceil(left / 1000)} s`) });
        if (!c.alive) return;
        await refreshLists();
        const name = r.label ? ` (${r.label})` : '';
        if (r.error) {
          const x = D.explain(r.error, 'mic');
          set('mic', { status: 'err', detail: x.title, advice: x.advice, select: byKey.mic.select });
        } else if (r.ok) {
          set('mic', { status: 'ok', detail: `Le micro vous entend bien${name}.`, meter: r.peak, select: byKey.mic.select });
        } else if (r.peak < 0.08) {
          set('mic', { status: 'err', detail: `Aucun son reçu${name}.`, meter: r.peak, select: byKey.mic.select, advice: 'Vérifiez la touche « micro coupé » du clavier, puis Paramètres Windows → Système → Son → Entrée : choisissez « Onboard MIC » et montez le volume d’entrée. Si plusieurs micros sont proposés ci-dessous, essayez-en un autre.' });
        } else {
          set('mic', { status: 'warn', detail: `On vous entend faiblement${name}.`, meter: r.peak, select: byKey.mic.select, advice: 'Parlez plus près du PC, ou montez le volume d’entrée : Paramètres Windows → Système → Son → Onboard MIC.' });
        }
      } catch (e) {
        if (c.alive) { const x = D.explain(e, 'mic'); set('mic', { status: 'err', detail: x.title, advice: x.advice }); }
      } finally { busy.mic = false; }
    }

    async function testSpeaker() {
      if (busy.speaker || !D) return null;
      busy.speaker = true;
      focusRow('speaker');
      try {
        set('speaker', { status: 'pending', detail: 'Écoutez : un petit carillon sonne deux fois…', select: byKey.speaker.select });
        try { await D.playTestSound(); } catch (e) {
          if (!c.alive) return null;
          const gone = e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError');
          set('speaker', {
            status: 'err',
            detail: gone ? 'La sortie choisie n’est plus disponible.' : e && e.name === 'NotAllowedError' ? 'Chrome a bloqué le son.' : 'Le son n’a pas pu être joué.',
            advice: gone ? 'Choisissez « Par défaut de Windows » dans la liste, puis réessayez.' : 'Cliquez une fois dans la page, puis sur « Refaire ».',
            select: byKey.speaker.select
          });
          return null;
        }
        if (!c.alive) return null;
        busy.speaker = false;
        const v = await ask('speaker', 'Avez-vous entendu le carillon ?', () => set('speaker', {
          status: 'err',
          detail: 'Pas de son.',
          select: byKey.speaker.select,
          advice: `Montez le volume avec les touches du clavier et vérifiez que le son n’est pas coupé. Cliquez sur l’icône du haut-parleur dans la barre des tâches et choisissez « Onboard Speaker »${byKey.speaker.select ? ', ou choisissez une autre sortie ci-dessous' : ''}.`
        }));
        if (v === 'yes') set('speaker', { status: 'ok', detail: `Le son sort bien${outName()}.`, select: byKey.speaker.select });
        return v;
      } finally { busy.speaker = false; }
    }
    function outName() {
      const o = lists.speaker.find((x) => x.id === (D ? D.chosen('speaker') : ''));
      return o && !o.isDefault ? ` (${o.label})` : '';
    }

    function stopCamera() {
      clearInterval(camTimer); camTimer = 0;
      if (camStream) { D.stop(camStream); camStream = null; }
      const box = body.querySelector('.dg-media');
      if (box) { const v = box.querySelector('video'); try { v.srcObject = null; } catch (e) {  } box.hidden = true; }
    }
    c.add(stopCamera);

    function frameBrightness(video) {
      try {
        const cv = document.createElement('canvas');
        cv.width = 32; cv.height = 18;
        const g = cv.getContext('2d', { willReadFrequently: true });
        g.drawImage(video, 0, 0, 32, 18);
        const d = g.getImageData(0, 0, 32, 18).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        return sum / (d.length / 4);
      } catch (e) { return -1; }
    }

    async function testCamera() {
      if (busy.camera || !D) return;
      busy.camera = true;
      focusRow('camera');
      stopCamera();
      try {
        if (!sup.getUserMedia) { set('camera', { status: 'err', detail: 'Caméra inaccessible dans ce navigateur.', advice: 'Ouvrez Aide Visio dans Google Chrome à jour.' }); return; }
        if (!(await permissionGate('camera', 'camera'))) return;
        set('camera', { status: 'pending', detail: 'Ouverture de la caméra… (cliquez sur « Autoriser » si Chrome le demande)', select: byKey.camera.select });
        let stream;
        try { stream = await D.openCamera(); } catch (e) {
          if (!c.alive) return;
          await refreshLists();
          const x = D.explain(e, 'camera');
          set('camera', { status: 'err', detail: x.title, advice: x.advice, select: byKey.camera.select });
          return;
        }
        if (!c.alive) { D.stop(stream); return; }
        camStream = stream;
        const box = body.querySelector('.dg-media');
        const video = box.querySelector('video');
        video.srcObject = stream;
        box.hidden = false;
        await Promise.race([new Promise((r) => video.addEventListener('loadeddata', r, { once: true })), U.sleep(4000)]);
        try { await video.play(); } catch (e) {  }
        await U.sleep(700);
        if (!c.alive || camStream !== stream) return;
        await refreshLists();
        const tr = stream.getVideoTracks()[0];
        const label = D.cleanLabel(tr && tr.label);
        const w = video.videoWidth; const h2 = video.videoHeight;
        const light = frameBrightness(video);
        let SECS = running ? 5 : 10;
        const base = !w
          ? { status: 'err', detail: 'La caméra s’ouvre mais n’envoie pas d’image.', advice: 'Fermez Teams et les autres applis qui filment, puis « Refaire ».' }
          : light >= 0 && light < 12
            ? { status: 'warn', detail: `Image noire${label ? ` (${label})` : ''}.`, advice: 'La caméra est peut-être masquée (cache, touche de confidentialité du clavier) ou la pièce est trop sombre.' }
            : { status: 'ok', detail: `La caméra fonctionne${label ? ` (${label})` : ''} · ${w}×${h2}.` };
        const show = () => set('camera', Object.assign({}, base, {
          select: byKey.camera.select,
          actions: [{ op: 'stopcam', label: `Fermer l’aperçu (${SECS} s)` }],
          advice: base.advice || 'Vérifiez le cadrage : visage centré, bien éclairé.'
        }));
        show();
        camTimer = setInterval(() => {
          SECS--;
          if (SECS <= 0 || !c.alive) { stopCamera(); if (c.alive) set('camera', Object.assign({}, base, { select: byKey.camera.select })); return; }
          const btn = body.querySelector('.dg-row[data-key="camera"] [data-op="stopcam"]');
          if (btn) btn.textContent = `Fermer l’aperçu (${SECS} s)`;
        }, 1000);
        await new Promise((r) => { const t = setInterval(() => { if (!camTimer) { clearInterval(t); r(); } }, 200); });
      } finally { busy.camera = false; }
    }

    async function testSpeech() {
      if (busy.speech || !D) return;
      busy.speech = true;
      focusRow('speech');
      try {
        if (!sup.webSpeech) { const x = D.explainSpeech('unsupported'); set('speech', { status: 'err', detail: x.title, advice: x.advice }); return; }
        if (navigator.onLine === false) { const x = D.explainSpeech('network'); set('speech', { status: 'err', detail: x.title, advice: x.advice }); return; }
        set('speech', { status: 'pending', detail: 'Dites « hello » maintenant, en anglais…' });
        const r = await D.listenOnce({ lang: 'en-US', timeoutMs: 8000, onText: (t) => detail('speech', `Entendu : « ${t} »…`) });
        if (!c.alive) return;
        const micAdvice = D.chosen('mic') ? 'La reconnaissance vocale de Chrome écoute toujours le micro par défaut de Windows (pas celui choisi plus haut).' : '';
        if (r.ok) {
          const good = /\b(hello|hallo|hullo|hi|hey|hello there)\b/i.test(r.text);
          set('speech', { status: 'ok', detail: `Entendu : « ${r.text} »${good ? '' : ' (essayez « hello » pour comparer)'}.` });
        } else {
          const x = D.explainSpeech(r.code);
          set('speech', { status: r.code === 'no-speech' ? 'warn' : 'err', detail: x.title, advice: [x.advice, micAdvice].filter(Boolean).join(' ') });
        }
      } finally { busy.speech = false; }
    }

    async function testVoice() {
      if (busy.voice || !D) return null;
      busy.voice = true;
      focusRow('voice');
      try {
        if (!D.canSpeak()) { set('voice', { status: 'err', detail: 'Lecture à voix haute indisponible.', advice: 'Ouvrez Aide Visio dans Google Chrome à jour.' }); return null; }
        await refreshVoices();
        const v = await D.voice();
        if (!c.alive) return null;
        if (!v) {
          set('voice', { status: 'err', detail: 'Aucune voix anglaise sur ce PC.', advice: 'Paramètres Windows → Heure et langue → Voix → « Ajouter des voix » → Anglais (Royaume-Uni). Puis fermez et rouvrez Chrome.' });
          return null;
        }
        if (v.localService === false && navigator.onLine === false) {
          set('voice', { status: 'warn', detail: 'Cette voix a besoin d’internet.', advice: 'Choisissez une voix « Microsoft » dans la liste : elle marche sans internet.', select: byKey.voice.select });
          return null;
        }
        set('voice', { status: 'pending', detail: `Écoutez : ${D.niceVoiceName(v)}…`, select: byKey.voice.select });
        let err = '';
        const ok = await D.speak('Hello! I am your English examiner. Can you hear me clearly?', { voice: v, onEnd: (o2, e) => { err = e || ''; } });
        if (!c.alive) return null;
        busy.voice = false;
        if (!ok) {
          set('voice', { status: 'err', detail: 'La voix ne s’est pas lancée.', advice: err === 'network' ? 'Cette voix a besoin d’internet : choisissez une voix « Microsoft ».' : 'Choisissez une autre voix dans la liste, puis « Refaire ».', select: byKey.voice.select });
          return null;
        }
        const r = await ask('voice', 'Avez-vous entendu la phrase en anglais ?', () => set('voice', {
          status: 'err',
          detail: 'Voix non entendue.',
          select: byKey.voice.select,
          advice: 'La voix sort toujours sur la sortie par défaut de Windows : choisissez « Onboard Speaker » dans l’icône du haut-parleur de la barre des tâches et montez le volume. Ou essayez une autre voix.'
        }));
        if (r === 'yes') set('voice', { status: 'ok', detail: `Voix prête : ${D.niceVoiceName(v)}.`, select: byKey.voice.select });
        return r;
      } finally { busy.voice = false; }
    }

    async function testKey() {
      if (busy.key) return;
      const s = settings();
      const any = ['geminiKey', 'openaiKey', 'claudeKey', 'groqKey'].some((k) => cleanKey(s[k]));
      if (!any) {
        set('key', { status: 'warn', detail: 'Pas encore de clé.', advice: 'Sans clé, le jury IA ne répond pas (le reste marche). La clé Gemini est gratuite : Réglages → Clé IA.', actions: [{ op: 'settings', label: 'Ajouter ma clé', primary: true }] });
        return;
      }
      if (navigator.onLine === false) { set('key', { status: 'warn', detail: 'Clé enregistrée, test impossible sans internet.' }); return; }
      busy.key = true;
      set('key', { status: 'pending', detail: 'Test de la clé…' });
      try {
        let res = []; let err = null;
        try { res = (await S.ai.test()) || []; } catch (e) { err = e; }
        if (!c.alive) return;
        const ok = res.filter((r) => r && r.ok).sort((a, b2) => a.ms - b2.ms)[0];
        if (ok) {
          const slow = Number(ok.ms) > 4000;
          set('key', { status: slow ? 'warn' : 'ok', detail: `Clé valide · réponse en ${fmtMs(ok.ms)}.`, advice: slow ? 'Réponse lente : rapprochez-vous de la box wifi ou utilisez le partage de connexion du téléphone.' : '' });
        } else {
          const first = res.find((r) => r && r.provider === 'gemini') || res[0];
          const t = errText(err || (first && first.error));
          set('key', { status: 'err', detail: 'La clé ne marche pas.', advice: keyAdvice(t, first ? first.provider : 'gemini'), actions: [{ op: 'test', label: 'Refaire' }, { op: 'settings', label: 'Voir ma clé' }] });
        }
      } finally { busy.key = false; }
    }

    async function testOnline() {
      if (busy.online) return;
      if (navigator.onLine === false) { set('online', { status: 'err', detail: 'Pas d’internet.', advice: 'Connectez le wifi. Sans internet : pas d’IA ni de reconnaissance vocale (les sujets et les fiches restent disponibles).' }); return; }
      busy.online = true;
      set('online', { status: 'pending', detail: 'Test de la connexion…' });
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const to = setTimeout(() => { if (ctrl) ctrl.abort(); }, 6000);
      const t0 = performance.now();
      try {
        await fetch(`https://www.gstatic.com/generate_204?t=${Date.now()}`, { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
        const ms = performance.now() - t0;
        if (!c.alive) return;
        set('online', ms > 1500
          ? { status: 'warn', detail: `Connecté, mais lent (${fmtMs(ms)}).`, advice: 'Rapprochez-vous de la box ou utilisez le partage de connexion du téléphone.' }
          : { status: 'ok', detail: `Connecté · ${fmtMs(ms)}.` });
      } catch (e) {
        if (c.alive) set('online', { status: 'err', detail: 'Internet ne répond pas.', advice: 'Vérifiez le wifi. Un VPN ou un pare-feu d’entreprise peut aussi bloquer : essayez le partage de connexion du téléphone.' });
      } finally { clearTimeout(to); busy.online = false; }
    }

    async function testCall() {
      if (busy.call) return;
      if (!sup.getDisplayMedia || !sup.displayAudio) { set('call', { status: 'warn', detail: 'Capture du son de l’appel indisponible ici.', advice: 'Utilisez Google Chrome sur le PC.' }); return; }
      busy.call = true;
      focusRow('call');
      set('call', { status: 'pending', detail: 'Teams (appli) : choisissez « Écran entier » et cochez « Partager l’audio du système ». Meet : choisissez l’onglet et « Partager l’audio de l’onglet ».' });
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          systemAudio: 'include', selfBrowserSurface: 'exclude', preferCurrentTab: false, surfaceSwitching: 'include'
        });
      } catch (e) {
        busy.call = false;
        if (!c.alive) return;
        const denied = e && (e.name === 'NotAllowedError' || e.name === 'AbortError');
        set('call', { status: 'warn', detail: denied ? 'Partage annulé.' : `Capture impossible (${errText(e)}).`, advice: denied ? 'Refaites le test et validez la fenêtre de partage.' : 'Mettez Chrome à jour.' });
        return;
      }
      const stopAll = () => D.stop(stream);
      if (!c.alive) { stopAll(); busy.call = false; return; }
      const vt = stream.getVideoTracks()[0];
      const surface = vt && vt.getSettings ? vt.getSettings().displaySurface : '';
      const at = stream.getAudioTracks()[0];
      if (!at) {
        stopAll(); busy.call = false;
        set('call', { status: 'warn', detail: 'Aucun son partagé.', advice: surface === 'window' ? 'Une fenêtre seule ne partage pas le son : choisissez « Écran entier » et cochez « Partager l’audio du système ».' : 'Cochez « Partager l’audio du système » (ou « de l’onglet ») avant de valider.' });
        return;
      }
      let ac = null; let timer = 0; let peak = 0;
      const DURATION = 5000; const t0 = Date.now();
      const finish = (interrupted) => {
        clearInterval(timer); stopAll();
        try { if (ac) ac.close(); } catch (e) {  }
        displayCleanup = null; busy.call = false;
        if (!c.alive) return;
        if (peak > 0.25) set('call', { status: 'ok', detail: `Son de l’appel bien capté · ${Math.round(peak * 100)} %.`, meter: peak });
        else set('call', { status: 'warn', detail: interrupted ? 'Partage arrêté avant la fin.' : 'Partage actif, mais aucun son pendant le test.', advice: 'Pendant le test, faites jouer un son (test haut-parleur de Teams, vidéo).', meter: peak });
      };
      displayCleanup = () => finish(true);
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ac = new Ctx();
        if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) {  } }
        const an = ac.createAnalyser(); an.fftSize = 1024;
        ac.createMediaStreamSource(new MediaStream([at])).connect(an);
        const buf = new Float32Array(an.fftSize);
        set('call', { status: 'pending', detail: 'Mesure du son… 5 s', meter: 0 });
        at.addEventListener('ended', () => { if (busy.call) finish(true); });
        timer = setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const v = levelUnit(Math.sqrt(sum / buf.length));
          peak = Math.max(peak, v);
          setMeter('call', v, `Mesure du son… ${Math.max(0, Math.ceil((DURATION - (Date.now() - t0)) / 1000))} s`);
          if (Date.now() - t0 >= DURATION) finish(false);
        }, 66);
      } catch (e) {
        clearInterval(timer); stopAll(); displayCleanup = null; busy.call = false;
        set('call', { status: 'ok', detail: 'Son partagé détecté (niveau non mesurable).' });
      }
    }
    c.add(() => { if (displayCleanup) displayCleanup(); });

    const TESTS = { mic: testMic, speaker: testSpeaker, camera: testCamera, speech: testSpeech, voice: testVoice, key: testKey, online: testOnline, call: testCall };

    async function runAll() {
      if (running) return;
      running = true;
      ranOnce = true;
      rows.forEach((r) => { if (!r.optional && r.status !== 'pending') set(r.key, { status: 'idle', select: r.select }); });
      drawSummary();
      try {
        await testOnline();
        const keyP = testKey();
        for (const k of ['mic', 'speaker', 'camera', 'speech', 'voice']) {
          if (!c.alive) return;
          await TESTS[k]();
        }
        await keyP;
      } finally {
        running = false;
        if (c.alive) { rows.forEach(drawRow); drawSummary(); }
      }
    }

    onAct(el, {
      back: () => go('#/settings'),
      all: () => runAll(),
      row: (btn) => {
        const k = btn.dataset.key; const op = btn.dataset.op;
        if (op === 'yes' || op === 'no') answer(k, op);
        else if (op === 'stopcam') { stopCamera(); set('camera', { status: byKey.camera.status, detail: byKey.camera.detail, select: byKey.camera.select }); }
        else if (op === 'settings') go('#/settings');
        else if (op === 'test') { answer(k, null); if (TESTS[k]) TESTS[k](); }
      }
    });

    el.addEventListener('change', (e) => {
      const t = e.target;
      if (!t.matches('select[data-pick]') || !D) return;
      const k = t.dataset.pick;
      const opt = t.options[t.selectedIndex];
      const label = opt ? opt.textContent : '';
      if (k === 'voice') {
        const v = lists.voice.find((x) => x.voiceURI === t.value);
        D.choose('voice', t.value, v ? v.name : label);
      } else D.choose(k, t.value, label);
      if (byKey[k].select) byKey[k].select.value = t.value;
      if (running) return;
      answer(k, null);
      if (k === 'camera') stopCamera();
      if (TESTS[k]) TESTS[k]();
    });

    const onDev = () => { if (c.alive) refreshLists(); };
    try { if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) { navigator.mediaDevices.addEventListener('devicechange', onDev); c.add(() => navigator.mediaDevices.removeEventListener('devicechange', onDev)); } } catch (e) {  }
    const onNet = () => { if (!running && byKey.online.status !== 'idle') testOnline(); };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    c.add(() => { window.removeEventListener('online', onNet); window.removeEventListener('offline', onNet); });
    c.add(() => { Object.keys(asks).forEach((k) => answer(k, null)); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {  } });

    rows.forEach(drawRow);
    drawSummary();
    if (!D) set('mic', { status: 'err', detail: 'Module des appareils absent.', advice: 'Rechargez la page (Ctrl + Maj + R).' });
    refreshLists();
    refreshVoices();
    // État connu sans rien ouvrir : permission refusée, pas de clé, hors ligne.
    if (D) {
      D.permission('mic').then((st) => { if (c.alive && st === 'denied' && byKey.mic.status === 'idle') permissionGate('mic', 'mic'); });
      D.permission('camera').then((st) => { if (c.alive && st === 'denied' && byKey.camera.status === 'idle') permissionGate('camera', 'camera'); });
    }
    if (navigator.onLine === false) testOnline();
    if (!hasKey()) testKey();
  }

  const diagScreen = (() => {
    let ctx = null;
    return {
      leave() { if (ctx) ctx.end(); ctx = null; },
      render(root) {
        if (ctx) ctx.end();
        const c = ctx = lifecycle();
        const el = mount(root, 'dg', `${topbar({ title: 'Vérifier mon PC', sub: 'Micro, son, caméra, IA' })}<div class="sc-body"></div>`);
        runDiag(el, c);
      }
    };
  })();

  function register(name, def) {
    if (S.app && typeof S.app.register === 'function') S.app.register(name, def);
    else document.addEventListener('DOMContentLoaded', () => { if (S.app && S.app.register) S.app.register(name, def); }, { once: true });
  }

  register('settings', settingsScreen);
  register('diag', diagScreen);
})(window.AideVisio = window.AideVisio || {});
