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

  const PURPOSES = [
    ['answer', 'Jury IA', 'Rapide pendant l’oral'],
    ['fast', 'Petites tâches', 'Tri et nettoyage des textes'],
    ['prep', 'Sujets et notes', 'Qualité avant vitesse']
  ];

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

  function runSettings(el, c) {
    const body = el.querySelector('.sc-body');
    const s = settings();
    const models = Object.assign({ answer: 'auto', fast: 'auto', prep: 'auto' }, s.models || {});
    const seg = (key, value, opts) => `<div class="seg" role="group">${opts.map(([v, l]) =>
      `<button type="button" data-act="seg" data-set="${key}" data-v="${v}" class="${String(value) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const sw = (key, checked, label) => `<label class="switch"><input type="checkbox" data-set="${key}" ${checked ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;
    const scale = Number(s.fontScale) || 1;

    body.innerHTML = `
      ${section('Clé IA', `
        ${keyRow({ id: 'gemini', name: 'Google Gemini', icon: 'sparkles', color: 'blue', badge: '<span class="pill pill-ok">Gratuite · conseillée</span>', url: 'https://aistudio.google.com/apikey', linkLabel: 'Obtenir une clé gratuite', placeholder: 'AIza…', hint: 'Une seule clé suffit pour tout utiliser.' })}
        ${keyRow({ id: 'openai', name: 'OpenAI', icon: 'bolt', color: 'blue', badge: '<span class="pill">Payante · plus rapide</span>', url: 'https://platform.openai.com/api-keys', linkLabel: 'Obtenir une clé', placeholder: 'sk-' + 'proj-…', hint: 'Facultative : réponses plus rapides.' })}
        <div class="list-row">${tile('person', 'gray')}${main('Garder les clés sur cet appareil', 'À décocher sur un ordinateur prêté.')}
          ${sw('rememberKeys', s.rememberKeys !== false, 'Garder les clés sur cet appareil')}</div>`)}

      ${section('Affichage', `
        <div class="list-row st-wrap">${tile('eye', 'blue')}${main('Thème', null)}${seg('theme', s.theme || 'auto', [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']])}</div>
        <div class="list-row st-range st-wrap">${tile('edit', 'blue')}${main('Taille du texte pendant l’appel', null)}
          <span class="st-range-ctl"><input type="range" min="0.8" max="1.6" step="0.05" value="${scale}" data-set="fontScale" aria-label="Taille du texte"><output data-out="fontScale">${Math.round(scale * 100)} %</output></span></div>
        <div class="list-row"><div class="st-preview" style="--st-scale:${scale}"><b>In my view, the article raises a key question for European firms.</b></div></div>`)}

      ${section('Appareil', `
        <button type="button" class="list-row" data-act="diag">${tile('shield', 'green')}${main('Tester le micro et la connexion', 'À faire avant un entraînement.')}${chev()}</button>
        <div class="list-row">${tile('doc', 'gray')}${main('Espace utilisé', 'Calcul…', 'data-usage')}
          <button type="button" class="btn btn-sm btn-ghost" data-act="persist" hidden>${icon('shield')} Protéger</button></div>
        <button type="button" class="list-row st-danger" data-act="wipe">${tile('trash', 'red')}${main('Tout effacer sur cet appareil', 'Séances, sujets, réglages et clés.')}</button>`)}

      <details class="ex-more st-adv"><summary>Réglages avancés</summary>
      ${section('Autres clés (facultatives)', `
        ${keyRow({ id: 'claude', name: 'Anthropic Claude', icon: 'shield', color: 'orange', badge: '<span class="pill">Payante</span>', url: 'https://console.anthropic.com/settings/keys', linkLabel: 'Obtenir une clé', placeholder: 'sk-' + 'ant-…', hint: 'Prend le relais si les autres ne répondent pas.' })}
        ${keyRow({ id: 'groq', name: 'Groq', icon: 'bolt', color: 'violet', badge: '<span class="pill pill-ok">Gratuite</span>', url: 'https://console.groq.com/keys', linkLabel: 'Obtenir une clé gratuite', placeholder: 'gsk_…', hint: 'Transcription très rapide de la voix.' })}`)}

      ${section('Choix de l’IA', `
        <div class="list-row st-wrap">${tile('bolt', 'violet')}${main('Service utilisé', 'Auto : le plus rapide disponible.')}
          ${seg('provider', s.provider || 'auto', [['auto', 'Auto'], ['openai', 'OpenAI'], ['gemini', 'Gemini'], ['claude', 'Claude'], ['groq', 'Groq']])}</div>
        ${PURPOSES.map(([p, label, sub]) => `<div class="list-row st-model st-wrap">${tile(p === 'answer' ? 'sparkles' : p === 'fast' ? 'waveform' : 'doc', p === 'answer' ? 'blue' : p === 'fast' ? 'teal' : 'green')}${main(label, sub, `data-auto="${p}"`)}
          <select data-model="${p}" aria-label="Modèle : ${esc(label)}"><option value="auto">Automatique</option>${models[p] && models[p] !== 'auto' ? `<option value="${esc(models[p])}" selected>${esc(models[p])}</option>` : ''}</select></div>`).join('')}
        <div class="list-row">${tile('refresh', 'gray')}<span class="list-main"><small data-models-status>Liste des modèles : automatique.</small></span>
          <button type="button" class="btn btn-sm btn-ghost" data-act="discover">${icon('refresh')} Actualiser</button></div>`)}
      </details>

      <p class="small muted st-about">${icon('shield')} Vos séances et vos clés restent sur cet appareil. Aucun serveur intermédiaire.</p>`;

    let discovered = { gemini: [], claude: [] };

    function fillModels() {
      const cur = Object.assign({ answer: 'auto', fast: 'auto', prep: 'auto' }, settings().models || {});
      PURPOSES.forEach(([p]) => {
        const sel = body.querySelector(`select[data-model="${p}"]`);
        let autoName = '';
        try { const c0 = S.ai.pick(p)[0]; autoName = c0 ? c0.model : ''; } catch (e) { autoName = ''; }
        const group = (label, list) => (list && list.length ? `<optgroup label="${label}">${list.map((m) => `<option value="${esc(m)}">${esc(m)}</option>`).join('')}</optgroup>` : '');
        const all = (discovered.gemini || []).concat(discovered.claude || []);
        const extra = cur[p] && cur[p] !== 'auto' && all.indexOf(cur[p]) < 0 ? `<option value="${esc(cur[p])}">${esc(cur[p])}</option>` : '';
        sel.innerHTML = `<option value="auto">Automatique${autoName ? ` (${esc(autoName)})` : ''}</option>${extra}${group('Gemini', discovered.gemini)}${group('Claude', discovered.claude)}`;
        sel.value = cur[p] || 'auto';
      });
    }

    async function discover(force) {
      const out = body.querySelector('[data-models-status]');
      if (!hasKey()) { out.textContent = 'Ajoutez une clé pour lister les modèles disponibles.'; fillModels(); return; }
      out.innerHTML = '<span class="spinner"></span> Recherche des modèles…';
      try {
        const r = await S.ai.discover({ force: !!force });
        if (!c.alive) return;
        discovered = { gemini: (r && r.gemini) || [], claude: (r && r.claude) || [] };
        fillModels();
        out.textContent = `${plural(discovered.gemini.length, 'modèle Gemini', 'modèles Gemini')} · ${plural(discovered.claude.length, 'modèle Claude', 'modèles Claude')} disponibles.`;
        if (force) toast('Liste des modèles actualisée.', 'ok');
      } catch (e) {
        if (!c.alive) return;
        fillModels();
        out.textContent = `Liste indisponible (${errText(e)}) : modèles par défaut utilisés.`;
      }
    }

    async function loadUsage() {
      const out = body.querySelector('[data-usage]');
      const btn = body.querySelector('[data-act="persist"]');
      try {
        const u = await S.store.usage();
        if (!c.alive) return;
        out.innerHTML = `${fmtBytes(u.bytes)} · ${u.persistent
          ? '<span class="pill pill-ok">Protégé</span>' : '<span class="pill pill-warn">Non protégé</span>'}`;
        btn.hidden = !!u.persistent || !(navigator.storage && navigator.storage.persist);
      } catch (e) {
        out.textContent = 'Informations de stockage indisponibles.';
      }
    }

    const saveKeyLater = U.debounce((k, v) => saveKey(k, v), 500);
    function saveKey(k, v) {
      const clean = cleanKey(v);
      if ((settings()[k] || '') === clean) return;
      setSettings({ [k]: clean });
      fillModels();
    }

    async function testKey(provider, btn) {
      const input = body.querySelector(`[data-key="${provider}Key"]`);
      const out = body.querySelector(`[data-status="${provider}"]`);
      saveKey(input.dataset.key, input.value);
      if (!cleanKey(input.value)) { out.innerHTML = `<span class="pill pill-warn">${icon('warning')} Aucune clé saisie</span>`; return; }
      btn.disabled = true;
      out.innerHTML = '<span class="spinner"></span> Test en cours…';
      try {
        const res = (await S.ai.test()) || [];
        if (!c.alive) return;
        const mine = res.filter((r) => r && r.provider === provider);
        const ok = mine.find((r) => r.ok);
        if (ok) {
          out.innerHTML = `<span class="pill pill-ok">${icon('check')} Clé valide</span> ${esc(ok.model || '')} · ${fmtMs(ok.ms)}`;
          discover(true);
        } else if (mine.length) {
          out.innerHTML = `<span class="pill pill-err">${icon('xmark')} Échec</span> ${esc(errText(mine[0].error))}`;
        } else {
          out.innerHTML = `<span class="pill pill-warn">${icon('info')} Non testée</span> Vérifiez « Service utilisé » dans les réglages avancés.`;
        }
      } catch (e) {
        out.innerHTML = `<span class="pill pill-err">${icon('xmark')} Échec</span> ${esc(errText(e))}`;
      }
      btn.disabled = false;
    }

    async function wipe() {
      const ok = await S.ui.confirm({
        title: 'Effacer toutes vos données ?',
        text: 'Oraux blancs, sujets importés, réglages et clés enregistrés sur cet appareil seront supprimés définitivement. Exportez d’abord les bilans que vous voulez conserver.',
        okLabel: 'Tout effacer',
        danger: true
      });
      if (!ok) return;
      try {
        if (typeof S.store.clearAll === 'function') await S.store.clearAll();
        setSettings({ openaiKey: '', geminiKey: '', claudeKey: '', groqKey: '' });
        [window.localStorage, window.sessionStorage].forEach((stg) => {
          try { Object.keys(stg).filter((k) => /^aidevisio/i.test(k)).forEach((k) => stg.removeItem(k)); } catch (e) {  }
        });
        toast('Toutes vos données ont été effacées de cet appareil.', 'ok');
        setTimeout(() => { location.hash = '#/'; location.reload(); }, 700);
      } catch (e) {
        toast(`Effacement incomplet : ${errText(e)}`, 'err');
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
        if (b.dataset.set === 'provider') fillModels();
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
      discover: () => discover(true),
      persist: async () => {
        try {
          const ok = await navigator.storage.persist();
          toast(ok ? 'Stockage protégé.' : 'Le navigateur a refusé : installez l’app pour protéger vos données.', ok ? 'ok' : 'warn');
        } catch (e) { toast('Protection du stockage indisponible.', 'warn'); }
        loadUsage();
      },
      diag: () => go('#/diag'),
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
      else if (t.matches('select[data-model]')) {
        const m = Object.assign({ answer: 'auto', fast: 'auto', prep: 'auto' }, settings().models || {});
        m[t.dataset.model] = t.value;
        setSettings({ models: m });
      }
    });

    if (S.bus && S.bus.on) {
      c.add(S.bus.on('settings:changed', () => {
        const cur = settings();
        body.querySelectorAll('[data-key]').forEach((i) => {
          if (document.activeElement !== i && cleanKey(i.value) !== (cur[i.dataset.key] || '')) i.value = cur[i.dataset.key] || '';
        });
      }));
    }

    fillModels();
    loadUsage();
    discover(false);
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

  const STATUS_ICON = { ok: 'check', warn: 'warning', err: 'xmark', info: 'info' };

  function runDiag(el, c) {
    const body = el.querySelector('.sc-body');
    const sup = support();
    const b = browserInfo();
    const rows = [
      { key: 'browser', icon: 'shield', title: 'Navigateur' },
      { key: 'online', icon: 'wifi-off', title: 'Connexion internet' },
      { key: 'mic', icon: 'mic', title: 'Micro' },
      { key: 'speech', icon: 'waveform', title: 'Reconnaissance vocale' },
      { key: 'display', icon: 'video', title: 'Son de l’appel (onglet ou système)' },
      { key: 'openai', icon: 'bolt', title: 'Clé OpenAI (prioritaire)' },
      { key: 'gemini', icon: 'sparkles', title: 'Clé Gemini' },
      { key: 'claude', icon: 'shield', title: 'Clé Claude (secours)' },
      { key: 'storage', icon: 'doc', title: 'Stockage persistant' },
      { key: 'sw', icon: 'download', title: 'Fonctionnement hors-ligne' },
      { key: 'pip', icon: 'pip', title: 'Fenêtre flottante' },
      { key: 'wake', icon: 'eye', title: 'Écran toujours allumé' }
    ].map((r) => Object.assign({ status: 'pending', detail: '', advice: '', action: null, meter: null, indet: false }, r));
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    const busy = { mic: false, display: false, keys: false };

    body.innerHTML = `
      <div class="card glass card-pad dg-summary"></div>
      ${section('Vérifications', rows.map((r) => `<div class="list-row dg-row" data-key="${r.key}"></div>`).join(''), 'dg-list')}
      <p class="small muted dg-foot">${icon('info')} Faites ce diagnostic sur le PC de l’oral, 10 minutes avant l’appel, avec Teams ouvert.</p>`;

    function statusBadge(s) {
      if (s === 'pending') return '<span class="spinner"></span>';
      if (s === 'idle') return '<span class="dg-badge is-idle"></span>';
      return `<span class="dg-badge is-${s}">${icon(STATUS_ICON[s] || 'info')}</span>`;
    }

    function drawRow(r) {
      const node = body.querySelector(`.dg-row[data-key="${r.key}"]`);
      if (!node) return;
      node.className = `list-row dg-row is-${r.status}`;
      node.innerHTML = `
        <div class="dg-ic">${statusBadge(r.status)}</div>
        <div class="dg-main sc-grow">
          <div class="dg-title">${esc(r.title)}</div>
          ${r.detail ? `<div class="dg-detail small">${esc(r.detail)}</div>` : ''}
          ${r.meter != null ? `<div class="meter dg-meter${r.indet ? ' is-indet' : ''}"><i style="--v:${clamp(r.meter, 0, 1).toFixed(3)}"></i></div>` : ''}
          ${r.advice ? `<div class="dg-advice small">${esc(r.advice)}</div>` : ''}
        </div>
        ${r.action ? `<button type="button" class="btn btn-sm ${r.primary ? 'btn-primary' : 'btn-ghost'}" data-act="row" data-key="${r.key}" ${r.status === 'pending' ? 'disabled' : ''}>${esc(r.action)}</button>` : ''}`;
    }

    function set(key, patch) {
      const r = byKey[key];
      Object.assign(r, { detail: '', advice: '', action: null, meter: null, indet: false, primary: false }, patch);
      drawRow(r);
      drawSummary();
    }

    function setMeter(key, v, indet) {
      const r = byKey[key];
      r.meter = v;
      r.indet = !!indet;
      const i = body.querySelector(`.dg-row[data-key="${key}"] .dg-meter`);
      if (i) {
        i.classList.toggle('is-indet', !!indet);
        i.firstElementChild.style.setProperty('--v', clamp(v, 0, 1).toFixed(3));
      }
    }

    function drawSummary() {
      const n = { ok: 0, warn: 0, err: 0, idle: 0, pending: 0, info: 0 };
      rows.forEach((r) => { n[r.status] = (n[r.status] || 0) + 1; });
      let cls = 'is-ok'; let title = 'Tout est prêt pour l’oral'; let ic = 'check';
      if (n.pending) { cls = 'is-pending'; title = 'Vérifications en cours…'; ic = 'clock'; }
      else if (n.err) { cls = 'is-err'; title = `${plural(n.err, 'problème à corriger', 'problèmes à corriger')}`; ic = 'xmark'; }
      else if (n.idle) { cls = 'is-info'; title = 'Testez le micro et le son de l’appel'; ic = 'mic'; }
      else if (n.warn) { cls = 'is-warn'; title = `Prêt, avec ${plural(n.warn, 'point d’attention', 'points d’attention')}`; ic = 'warning'; }
      const box = body.querySelector('.dg-summary');
      box.className = `card glass card-pad dg-summary ${cls}`;
      box.innerHTML = `<div class="dg-sum-ic">${icon(ic)}</div>
        <div class="sc-grow"><div class="h2">${esc(title)}</div>
          <div class="small muted">${plural(n.ok, 'vérification réussie', 'vérifications réussies')}${n.warn ? ` · ${plural(n.warn, 'avertissement', 'avertissements')}` : ''}${n.err ? ` · ${plural(n.err, 'erreur', 'erreurs')}` : ''}</div></div>
        <button type="button" class="btn btn-sm btn-ghost" data-act="rerun">${icon('refresh')} Relancer</button>`;
    }

    function checkBrowser() {
      const label = `${b.name}${b.ver ? ` ${b.ver}` : ''}`;
      if (!window.isSecureContext) {
        return set('browser', { status: 'err', detail: `${label} — page non sécurisée`, advice: 'Ouvrez Aide Visio via son adresse https:// ou en fichier local : sinon le micro est bloqué par le navigateur.' });
      }
      if (b.chromium && !b.mobile) {
        if (b.ver && b.ver < 116) return set('browser', { status: 'warn', detail: `${label} — version ancienne`, advice: 'Mettez à jour le navigateur (Aide → À propos) pour la fenêtre flottante et la capture audio.' });
        return set('browser', { status: 'ok', detail: `${label} sur ordinateur : toutes les fonctions sont disponibles.` });
      }
      if (b.chromium && b.android) {
        return set('browser', { status: 'warn', detail: `${label} sur Android`, advice: 'Sur téléphone, le son de l’appel ne peut pas être capté : choisissez le mode « Haut-parleur ou téléphone à côté ».' });
      }
      return set('browser', { status: 'warn', detail: `${label} : fonctions limitées`, advice: 'Reconnaissance vocale et capture du son de l’appel indisponibles ici. Pour l’oral, ouvrez Aide Visio dans Chrome ou Edge sur ordinateur.' });
    }

    function checkOnline() {
      if (navigator.onLine === false) {
        set('online', { status: 'err', detail: 'Hors ligne', advice: 'L’IA et la reconnaissance vocale de Chrome ont besoin d’internet. Les sujets, les chronos et les fiches restent disponibles.' });
      } else {
        set('online', { status: 'ok', detail: 'Connecté à internet.' });
      }
    }

    function checkSpeech() {
      if (!sup.webSpeech) {
        return set('speech', { status: 'warn', detail: 'Non disponible dans ce navigateur.', advice: 'Utilisez Chrome ou Edge, ou le mode « Micro seul, transcription IA » (clé Gemini).' });
      }
      set('speech', {
        status: navigator.onLine === false ? 'warn' : 'ok',
        detail: `Reconnaissance vocale ${b.name === 'Edge' ? 'd’Edge' : 'de Chrome'} disponible (gratuite).`,
        advice: navigator.onLine === false ? 'Elle a besoin d’internet pour fonctionner.' : ''
      });
    }

    function idleMic() {
      if (!sup.getUserMedia) return set('mic', { status: 'err', detail: 'Accès au micro impossible dans ce navigateur.', advice: 'Utilisez Chrome ou Edge à jour.' });
      set('mic', { status: 'idle', detail: 'Parlez pendant 3 secondes pour vérifier le niveau.', action: 'Tester (3 s)', primary: true });
    }

    function idleDisplay() {
      if (!sup.getDisplayMedia) {
        return set('display', { status: 'warn', detail: 'Capture d’écran indisponible sur cet appareil.', advice: 'Choisissez le mode « Haut-parleur ou téléphone à côté » : un seul micro entend les deux voix.' });
      }
      if (!sup.displayAudio) {
        return set('display', { status: 'warn', detail: 'Ce navigateur ne capte pas le son d’un onglet.', advice: 'Utilisez Chrome ou Edge sur ordinateur, ou le mode « Haut-parleur ».', action: 'Essayer quand même' });
      }
      set('display', {
        status: 'idle',
        detail: 'Meet : choisissez l’onglet et cochez « Partager l’audio de l’onglet ». Teams (appli) : écran entier + « Partager l’audio du système ».',
        action: 'Tester (5 s)',
        primary: true
      });
    }

    async function checkKeys() {
      if (busy.keys) return;
      const s = settings();
      const g = !!cleanKey(s.geminiKey); const cl = !!cleanKey(s.claudeKey); const oa = !!cleanKey(s.openaiKey);
      if (!oa) set('openai', { status: g || cl ? 'info' : 'warn', detail: 'Aucune clé OpenAI.', advice: 'La clé OpenAI donne le jury IA le plus rapide (GPT-5.4 mini).', action: 'Ajouter une clé' });
      if (!g) set('gemini', { status: oa || cl ? 'info' : 'warn', detail: oa ? 'Facultative (OpenAI configurée).' : 'Aucune clé Gemini.', advice: oa ? 'Gemini sert seulement à transcrire le son de l’appel dans les modes sans le programme « Son du PC ».' : 'Sans clé : sujets, chronos, grille et fiches uniquement. La clé est gratuite (aistudio.google.com/apikey).', action: 'Ajouter une clé' });
      if (!cl) set('claude', { status: 'info', detail: 'Facultative.', advice: 'Une clé Claude prend le relais si les autres IA sont saturées ou indisponibles.', action: 'Ajouter' });
      if (!g && !cl && !oa) return;
      const present = [['openai', oa], ['gemini', g], ['claude', cl]];
      if (navigator.onLine === false) {
        present.forEach(([p, ok]) => { if (ok) set(p, { status: 'warn', detail: 'Clé présente, test impossible hors ligne.' }); });
        return;
      }
      busy.keys = true;
      present.forEach(([p, ok]) => { if (ok) set(p, { status: 'pending', detail: 'Test de la clé et de la latence…' }); });
      let res = [];
      let err = null;
      try { res = (await S.ai.test()) || []; } catch (e) { err = e; }
      busy.keys = false;
      if (!c.alive) return;
      present.forEach(([p, present]) => {
        if (!present) return;
        const mine = res.filter((r) => r && r.provider === p);
        const ok = mine.find((r) => r.ok);
        if (ok) {
          const slow = Number(ok.ms) > 4000;
          set(p, {
            status: slow ? 'warn' : 'ok',
            detail: `${ok.model || p} · ${fmtMs(ok.ms)}`,
            advice: slow ? 'Réponse lente : vérifiez la connexion (partage de connexion du téléphone si le wifi est faible).' : '',
            action: 'Retester'
          });
        } else {
          const e = err || (mine[0] && mine[0].error);
          const t = mine.length || err ? errText(e) : 'non testée (réglage « Service utilisé »)';
          let advice = 'Réessayez dans un instant.';
          if (/clé refusée/.test(t)) advice = 'Clé refusée : recopiez-la depuis la page de la clé, sans espace, puis enregistrez.';
          else if (/quota/.test(t)) advice = p === 'gemini' ? 'Quota gratuit atteint : patientez une minute ou ajoutez une clé Claude de secours.' : p === 'openai' ? 'Crédit ou quota insuffisant sur le compte OpenAI.' : 'Crédit ou quota insuffisant sur le compte Anthropic.';
          else if (/réseau/.test(t)) advice = 'Pas de réponse du serveur : vérifiez internet ou un pare-feu d’entreprise (essayez le partage de connexion du téléphone).';
          set(p, { status: mine.length || err ? 'err' : 'warn', detail: t.charAt(0).toUpperCase() + t.slice(1), advice, action: 'Retester' });
        }
      });
    }

    async function checkStorage() {
      try {
        const u = await S.store.usage();
        if (!c.alive) return;
        const info = fmtBytes(u.bytes);
        if (u.backend === 'memory') set('storage', { status: 'err', detail: 'Stockage bloqué : rien ne sera conservé après fermeture.', advice: 'Quittez la navigation privée ou exportez vos bilans avant de fermer l’onglet.' });
        else if (u.persistent) set('storage', { status: 'ok', detail: `Données protégées (${info}).` });
        else {
          set('storage', {
            status: 'warn',
            detail: `Non protégé (${info}).`,
            advice: 'Le navigateur peut effacer les données s’il manque de place. Installez l’app ou exportez vos bilans.',
            action: navigator.storage && navigator.storage.persist ? 'Protéger' : null
          });
        }
      } catch (e) {
        set('storage', { status: 'warn', detail: 'État du stockage inconnu.', advice: 'Exportez vos bilans importants par sécurité.' });
      }
    }

    async function checkSW() {
      if (location.protocol === 'file:') return set('sw', { status: 'ok', detail: 'Fichier local : il s’ouvre sans internet tel quel.' });
      if (!('serviceWorker' in navigator)) return set('sw', { status: 'warn', detail: 'Mode hors-ligne indisponible dans ce navigateur.', advice: 'Gardez une copie du fichier aidevisio.html sur une clé USB.' });
      try {
        const reg = await Promise.race([navigator.serviceWorker.getRegistration(), U.sleep(3000).then(() => null)]);
        if (!c.alive) return;
        if (reg && (reg.active || reg.waiting)) set('sw', { status: 'ok', detail: 'Prêt : l’app s’ouvre même sans internet.' });
        else set('sw', { status: 'warn', detail: 'Pas encore prêt.', advice: 'Rechargez la page une fois connecté pour activer le mode hors-ligne.' });
      } catch (e) {
        set('sw', { status: 'warn', detail: 'État du mode hors-ligne inconnu.' });
      }
    }

    function checkPip() {
      if (sup.docPiP) set('pip', { status: 'ok', detail: 'Fenêtre toujours au-dessus de Teams disponible.' });
      else set('pip', { status: 'warn', detail: 'Indisponible ici : une fenêtre popup sera utilisée.', advice: 'Disponible dans Chrome ou Edge récents sur ordinateur.' });
    }

    function checkWake() {
      if (sup.wakeLock) set('wake', { status: 'ok', detail: 'L’écran restera allumé pendant l’oral.' });
      else set('wake', { status: 'warn', detail: 'Indisponible.', advice: 'Désactivez la mise en veille de l’écran avant l’oral.' });
    }

    function runAuto() {
      checkBrowser();
      checkOnline();
      checkSpeech();
      if (!busy.mic) idleMic();
      if (!busy.display) idleDisplay();
      checkPip();
      checkWake();
      checkStorage();
      checkSW();
      checkKeys();
    }

    async function testMic() {
      if (busy.mic) return;
      busy.mic = true;
      set('mic', { status: 'pending', detail: 'Parlez normalement pendant 3 secondes…', meter: 0.35, indet: true });
      let off = null;
      try {
        if (S.audio && S.audio.on) {
          off = S.audio.on('level', (e) => {
            if (!e || e.who === 'them') return;
            setMeter('mic', clamp(Number(e.rms) || 0, 0, 1), false);
          });
        }
      } catch (e) { off = null; }
      try {
        const r = (await S.audio.testMic(3000)) || {};
        if (!c.alive) return;
        const peak = levelUnit(r.peak);
        if (r.ok) {
          set('mic', { status: 'ok', detail: `Micro fonctionnel${r.label ? ` (${r.label})` : ''} · niveau maximal ${Math.round(peak * 100)} %.`, meter: peak, action: 'Retester' });
        } else if (!r.code || r.code === 'MIC_SILENT') {
          set('mic', {
            status: 'warn',
            detail: 'Le micro répond, mais aucun son n’a été entendu.',
            advice: 'Parlez pendant le test. Vérifiez le micro choisi (icône dans la barre d’adresse) et dans Windows : Paramètres → Son → Entrée.',
            meter: peak,
            action: 'Retester',
            primary: true
          });
        } else {
          set('mic', Object.assign({ action: 'Retester', primary: true }, micFailure(r.code, r.error)));
        }
      } catch (e) {
        if (!c.alive) return;
        set('mic', Object.assign({ action: 'Retester', primary: true }, micFailure((e && (e.code || e.name)) || '', (e && e.message) || '')));
      } finally {
        if (off) { try { off(); } catch (e) {  } }
        busy.mic = false;
      }
    }

    function micFailure(code, message) {
      if (code === 'MIC_DENIED' || code === 'NotAllowedError' || code === 'SecurityError') {
        return { status: 'err', detail: 'Accès au micro refusé.', advice: 'Cliquez sur l’icône à gauche de l’adresse → Micro → Autoriser, puis relancez le test.' };
      }
      if (code === 'MIC_NOT_FOUND' || code === 'NotFoundError' || code === 'OverconstrainedError') {
        return { status: 'err', detail: 'Aucun micro détecté.', advice: 'Branchez un micro ou un casque, puis relancez le test.' };
      }
      if (code === 'MIC_BUSY' || code === 'NotReadableError' || code === 'AbortError') {
        return { status: 'err', detail: 'Micro occupé ou bloqué.', advice: 'Fermez les applications qui l’utilisent (Teams, Zoom…) ou choisissez un autre micro, puis relancez.' };
      }
      if (code === 'AUDIO_SUSPENDED') {
        return { status: 'warn', detail: 'Son en veille.', advice: message || 'Cliquez dans la page puis relancez le test.' };
      }
      return { status: 'err', detail: 'Le test du micro a échoué.', advice: message || 'Rechargez la page puis relancez le test.' };
    }

    let displayCleanup = null;
    c.add(() => { if (displayCleanup) displayCleanup(); });

    async function testDisplay() {
      if (busy.display) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return idleDisplay();
      busy.display = true;
      set('display', { status: 'pending', detail: 'Choisissez l’onglet de la réunion (ou l’écran entier) et cochez le partage audio…' });
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          systemAudio: 'include',
          selfBrowserSurface: 'exclude',
          preferCurrentTab: false,
          surfaceSwitching: 'include'
        });
      } catch (e) {
        busy.display = false;
        if (!c.alive) return;
        const denied = e && (e.name === 'NotAllowedError' || e.name === 'AbortError');
        set('display', {
          status: 'warn',
          detail: denied ? 'Partage annulé.' : `Capture impossible (${errText(e)}).`,
          advice: denied ? 'Relancez le test et validez la fenêtre de partage.' : 'Utilisez Chrome ou Edge à jour sur ordinateur.',
          action: 'Tester (5 s)',
          primary: true
        });
        return;
      }
      const stopAll = () => { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) {  } };
      if (!c.alive) { stopAll(); busy.display = false; return; }
      const vt = stream.getVideoTracks()[0];
      const surface = vt && vt.getSettings ? vt.getSettings().displaySurface : '';
      const at = stream.getAudioTracks()[0];
      if (!at) {
        stopAll();
        busy.display = false;
        set('display', {
          status: 'warn',
          detail: 'Aucun son partagé.',
          advice: surface === 'window'
            ? 'Une fenêtre seule ne partage pas le son : choisissez l’onglet Meet (« Partager l’audio de l’onglet ») ou l’écran entier pour Teams (« Partager l’audio du système »).'
            : 'Cochez « Partager l’audio de l’onglet » (Meet dans Chrome) ou « Partager l’audio du système » (écran entier, Teams appli).',
          action: 'Tester (5 s)',
          primary: true
        });
        return;
      }
      let ac = null; let timer = 0;
      let peak = 0;
      const DURATION = 5000;
      const t0 = Date.now();
      const finish = (interrupted) => {
        clearInterval(timer);
        stopAll();
        try { if (ac) ac.close(); } catch (e) {  }
        displayCleanup = null;
        busy.display = false;
        if (!c.alive) return;
        const where = surface === 'monitor' ? 'du système' : 'de l’onglet';
        if (peak > 0.25) {
          set('display', { status: 'ok', detail: `Son ${where} bien capté · niveau maximal ${Math.round(peak * 100)} %.`, meter: peak, action: 'Retester' });
        } else {
          set('display', {
            status: 'warn',
            detail: interrupted ? 'Partage arrêté avant la fin du test.' : 'Partage audio actif, mais aucun son pendant le test.',
            advice: 'Pendant le test, faites jouer du son dans l’onglet partagé (vidéo, test haut-parleur de Meet/Teams).',
            meter: peak,
            action: 'Retester',
            primary: true
          });
        }
      };
      displayCleanup = () => finish(true);
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        ac = new Ctx();
        if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) {  } }
        const src = ac.createMediaStreamSource(new MediaStream([at]));
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        src.connect(an);
        const buf = new Float32Array(an.fftSize);
        set('display', { status: 'pending', detail: 'Mesure du son… 5 s', meter: 0 });
        at.addEventListener('ended', () => { if (busy.display) finish(true); });
        timer = setInterval(() => {
          an.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const v = levelUnit(Math.sqrt(sum / buf.length));
          peak = Math.max(peak, v);
          setMeter('display', v, false);
          const left = Math.max(0, Math.ceil((DURATION - (Date.now() - t0)) / 1000));
          const det = body.querySelector('.dg-row[data-key="display"] .dg-detail');
          if (det) det.textContent = `Mesure du son… ${left} s`;
          if (Date.now() - t0 >= DURATION) finish(false);
        }, 66);
      } catch (e) {
        clearInterval(timer);
        stopAll();
        displayCleanup = null;
        busy.display = false;
        set('display', { status: 'ok', detail: 'Piste audio partagée détectée (niveau non mesurable ici).', action: 'Retester' });
      }
    }

    onAct(el, {
      back: () => go('#/settings'),
      rerun: () => runAuto(),
      row: (btn) => {
        const k = btn.dataset.key;
        if (k === 'mic') testMic();
        else if (k === 'display') testDisplay();
        else if (k === 'openai' || k === 'gemini' || k === 'claude') {
          if (!cleanKey(settings()[`${k}Key`])) go('#/settings');
          else checkKeys();
        } else if (k === 'storage') {
          (navigator.storage && navigator.storage.persist ? navigator.storage.persist() : Promise.resolve(false))
            .then((ok) => { toast(ok ? 'Stockage protégé.' : 'Le navigateur a refusé : installez l’app pour protéger vos données.', ok ? 'ok' : 'warn'); checkStorage(); })
            .catch(() => checkStorage());
        }
      }
    });

    const onNet = () => { checkOnline(); checkSpeech(); };
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    c.add(() => { window.removeEventListener('online', onNet); window.removeEventListener('offline', onNet); });

    rows.forEach(drawRow);
    runAuto();
  }

  const diagScreen = (() => {
    let ctx = null;
    return {
      leave() { if (ctx) ctx.end(); ctx = null; },
      render(root) {
        if (ctx) ctx.end();
        const c = ctx = lifecycle();
        const el = mount(root, 'dg', `${topbar({ title: 'Diagnostic', sub: 'Avant l’oral' })}<div class="sc-body"></div>`);
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
