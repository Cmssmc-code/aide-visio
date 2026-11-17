(function (S) {
  'use strict';

  const UI = () => S.ui || {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = (s) => (S.util && S.util.md ? S.util.md(String(s == null ? '' : s)) : esc(s).replace(/\n/g, '<br>'));
  const icon = (n, cls) => (UI().icon ? UI().icon(n, cls) : '');
  const uid = () => (S.util && S.util.uid ? S.util.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const pad2 = (n) => String(n).padStart(2, '0');
  const nowIso = () => new Date().toISOString();
  const errMsg = (e) => (e && (e.userMessage || e.message)) || String(e || 'Erreur inconnue');
  const isAbort = (e) => !!e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
  const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x) => (x == null ? '' : String(x));

  function fmtDur(ms) {
    if (!ms || ms < 0) return '—';
    const t = Math.round(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return m ? (s ? `${m} min ${pad2(s)}` : `${m} min`) : `${s} s`;
  }
  function fmtDate(iso, withTime) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const o = { weekday: 'short', day: 'numeric', month: 'short' };
    if (withTime) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return d.toLocaleDateString('fr-FR', o);
  }

  function toast(msg, kind, opts) { if (UI().toast) return UI().toast(msg, kind, opts); console.log('[examen]', msg); return null; }
  function h(html) {
    if (UI().h) return UI().h(html);
    const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content.firstElementChild;
  }
  function sheet(o) { return UI().sheet ? UI().sheet(o) : null; }
  function confirmSheet(o) { return UI().confirm ? UI().confirm(o) : Promise.resolve(true); }
  function go(hash) { if (S.app && S.app.go) S.app.go(hash); else location.hash = hash; }
  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    if (UI().download) UI().download(blob, filename);
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); }
    toast('Fichier « ' + filename + ' » téléchargé.', 'ok');
  }
  const aiReady = () => { try { return !!(S.examAI && S.examAI.ready && S.examAI.ready()); } catch (e) { return false; } };
  const aiHas = (fn) => !!(S.examAI && typeof S.examAI[fn] === 'function');
  const PREFS_KEY = 'aidevisio.exam.prefs';
  function prefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function setPrefs(patch) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.assign(prefs(), patch))); } catch (e) {  } }
  const isMobileDevice = () => { try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches); } catch (e) { return false; } };

  const NO_TITLE = 'Entretien';
  function normSubject(x) {
    const s = Object.assign({}, x && typeof x === 'object' ? x : {});
    s.id = str(s.id) || 'poste-' + uid();
    s.title = str(s.title).trim().slice(0, 120) || NO_TITLE;
    return s;
  }

  const KEY = 'aidevisio.exam.v1';
  const MAX_SESSIONS = 40;
  let cache = null;
  function load() {
    if (cache) return cache;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = {};
    if (!Array.isArray(d.sessions)) d.sessions = [];
    cache = d;
    return d;
  }
  window.addEventListener('storage', (e) => { if (e.key === KEY) cache = null; });
  const stamp = (s) => String(s.updatedAt || s.createdAt || '');
  function trimForQuota(d, level) {
    const old = d.sessions.slice().sort((a, b) => stamp(a).localeCompare(stamp(b)));
    if (level === 0) {
      old.slice(0, Math.max(1, Math.floor(old.length / 2))).forEach((s) => {
        if (s.call) { s.call.turns = arr(s.call.turns).slice(-60); s.call.answers = arr(s.call.answers).slice(-30); }
      });
      return true;
    }
    // D'abord les séances d'une ancienne version (autre type, invisibles), puis la plus ancienne séance d'entretien.
    const victim = old.find((s) => !isJob(s)) || old[0];
    if (!victim || d.sessions.length <= 1) return false;
    d.sessions = d.sessions.filter((s) => s !== victim);
    return true;
  }
  let quotaToastAt = 0;
  function persist(d) {
    const before = d.sessions.length;
    for (let level = 0; level < 12; level++) {
      try {
        localStorage.setItem(KEY, JSON.stringify(d));
        const lost = before - d.sessions.length;
        if (lost > 0) toast(`Stockage presque plein : ${lost} ancienne${lost > 1 ? 's' : ''} séance${lost > 1 ? 's' : ''} supprimée${lost > 1 ? 's' : ''} pour faire de la place. Exportez les entretiens importants (.md).`, 'warn', { duration: 9000 });
        return true;
      } catch (e) {
        if (!/quota/i.test(e.name + ' ' + e.message) || !trimForQuota(d, level)) break;
      }
    }
    if (Date.now() - quotaToastAt > 60000) {
      quotaToastAt = Date.now();
      toast('Stockage plein : la séance n’a pas pu être enregistrée. Supprimez d’anciennes séances (Historique).', 'err');
    }
    return false;
  }
  // Les séances d'une ancienne version (autre type) restent en mémoire mais ne sont plus affichées.
  const isJob = (s) => !!s && s.kind === 'job';
  const store = {
    list() { return load().sessions.filter(isJob).sort((a, b) => stamp(b).localeCompare(stamp(a))); },
    get(id) { return load().sessions.find((s) => isJob(s) && s.id === id) || null; },
    save(s) {
      const d = load();
      s.updatedAt = nowIso();
      const i = d.sessions.findIndex((x) => x.id === s.id);
      if (i >= 0) d.sessions[i] = s; else d.sessions.push(s);
      if (d.sessions.length > MAX_SESSIONS) {
        const sorted = d.sessions.slice().sort((a, b) => stamp(a).localeCompare(stamp(b)));
        const drop = new Set(sorted.filter((x) => x.id !== s.id).slice(0, d.sessions.length - MAX_SESSIONS).map((x) => x.id));
        d.sessions = d.sessions.filter((x) => !drop.has(x.id));
      }
      persist(d);
      return s;
    },
    remove(id) { const d = load(); d.sessions = d.sessions.filter((s) => s.id !== id); persist(d); }
  };
  S.examStore = store;

  const DOSSIER_KEEP = 80000;
  function newSession(title, text) {
    return {
      id: 'ex-' + uid(), kind: 'job', subject: normSubject({ title }), createdAt: nowIso(), updatedAt: nowIso(),
      call: { turns: [], answers: [], startedAt: null, endedAt: null },
      job: { text: str(text).slice(0, DOSSIER_KEEP) }
    };
  }
  function fixSession(s) {
    s.subject = normSubject(s.subject);
    s.call = Object.assign({ startedAt: null, endedAt: null }, s.call || {});
    s.call.turns = arr(s.call.turns);
    s.call.answers = arr(s.call.answers).filter((a) => a && a.id);
    s.job = { text: str(s.job && s.job.text) };
    return s;
  }
  const sessionHash = (s) => '#/entretien/' + s.id;
  function callCountLabel(s) {
    const n = arr(s.call && s.call.answers).filter((a) => !a.skipped).length;
    return n ? `${n} question${n > 1 ? 's' : ''}` : s.call && s.call.endedAt ? 'Terminé' : s.call && s.call.startedAt ? 'En cours' : 'Prêt';
  }
  const isOpen = (s) => !!(s.call && s.call.startedAt && !s.call.endedAt);

  // Repères donnés à la transcription : intitulé du poste, puis noms propres et sigles du dossier
  // (les plus fréquents d'abord), pour qu'ils soient bien écrits.
  const HINT_MAX = 250; // le paramètre prompt de Whisper est limité à 224 jetons
  const TITLE_STOP = new Set(['de', 'des', 'du', 'les', 'la', 'le', 'pour', 'chez', 'et', 'en', 'au', 'aux', 'sur', 'un', 'une']);
  const HINT_STOP = new Set('toujours jamais depuis pendant puisque lorsque plusieurs chaque quelques quelque comment pourquoi réponse réponses question questions exemple exemples entretien dossier préparation savoir pouvoir devoir mettre prendre donner parler mention mentionner situation action résultat ensuite encore également notamment vraiment plutôt surtout autres aucune aucun toutes premier première dernier dernière années semaine semaines'.split(' '));
  function jobHint(s) {
    const seen = new Set(), out = [];
    let len = 0;
    const add = (w) => {
      const k = w.toLowerCase();
      if (seen.has(k) || len + w.length + 2 > HINT_MAX) return;
      seen.add(k); out.push(w); len += w.length + 2;
    };
    const title = str(s.subject && s.subject.title);
    if (title !== NO_TITLE) title.split(/[^0-9A-Za-zÀ-ÿ&'’-]+/).filter((w) => w.length > 2 && !TITLE_STOP.has(w.toLowerCase())).forEach(add);
    const text = str(s.job && s.job.text);
    const lower = new Set(text.match(/(?<![0-9A-Za-zÀ-ÿ])[a-zà-ÿ][a-zà-ÿ'’-]{2,}/g) || []);
    // Les mots du métier les plus répétés (« bailleurs », « audits ») : sans eux, la transcription, nourrie de noms propres, entend des noms (« Bayers », « Audis »).
    const common = new Map();
    for (const w of text.toLowerCase().match(/(?<![0-9a-zà-ÿ'’])[a-zà-ÿ]{6,}(?![a-zà-ÿ'’])/g) || []) if (!HINT_STOP.has(w)) common.set(w, (common.get(w) || 0) + 1);
    Array.from(common.entries()).filter((e) => e[1] >= 4).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach((e) => add(e[0]));
    const count = new Map();
    // Un mot à majuscule en début de phrase ou de ligne (« Responsable », « Objectifs ») ne prouve rien : seuls ses autres emplois comptent. Les sigles comptent toujours.
    const START = /(?:^|[.!?…]\s+|\n\s*(?:[-–—*•·#>]|\d+[.)])?\s*)$/;
    for (const m of text.matchAll(/(?<![0-9A-Za-zÀ-ÿ])[A-ZÀ-Ý][0-9A-Za-zÀ-ÿ&-]{1,}/g)) {
      const w = m[0], acro = w === w.toUpperCase();
      if (w.length < 3 && !acro) continue;
      if (lower.has(w.toLowerCase())) continue;
      if (!acro && START.test(text.slice(0, m.index))) continue;
      count.set(w, (count.get(w) || 0) + 1);
    }
    Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 60).forEach((e) => add(e[0]));
    return out.join(', ');
  }

  let wake = null, wantWake = false, wakePending = false;
  async function keepAwake(on) {
    wantWake = !!on;
    try {
      if (on && !wake && !wakePending && navigator.wakeLock) {
        wakePending = true;
        let w = null;
        try { w = await navigator.wakeLock.request('screen'); } finally { wakePending = false; }
        if (!wantWake) { try { await w.release(); } catch (e) {  } return; }
        wake = w;
        w.addEventListener('release', () => { if (wake === w) wake = null; });
      } else if (!on && wake) { const w = wake; wake = null; await w.release(); }
    } catch (e) { wake = null; }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && CUR && CUR.wantsWake) keepAwake(true); });

  let CUR = null;
  function setCurrent(c) { CUR = c; }
  async function leaveCurrent() {
    const c = CUR; CUR = null;
    document.body.classList.remove('ex-focus');
    if (c && c.leave) { try { await c.leave(); } catch (e) { console.warn('[examen] leave', e); } }
    keepAwake(false);
  }
  document.addEventListener('keydown', (e) => {
    if (!CUR || !CUR.key || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (document.querySelector('.sheet-layer:not(.out)')) return;
    CUR.key(e);
  });

  function topbar(o) {
    return `<header class="topbar ex-topbar">
      <button type="button" class="icon-btn" data-go="${esc(o.back || '#/')}" aria-label="Retour" title="Retour">${icon('chevron-left')}</button>
      <div class="topbar-title ex-tb-title"><span>${esc(o.title)}</span>${o.sub ? `<small class="muted">${esc(o.sub)}</small>` : ''}</div>
      <div class="topbar-actions">${o.actions || ''}</div>
    </header>`;
  }

  function probePcProgram() {
    return new Promise((resolve) => {
      let ws = null, done = false;
      const end = (v) => { if (done) return; done = true; clearTimeout(t); try { if (ws) ws.close(); } catch (e) {  } resolve(v); };
      const t = setTimeout(() => end('off'), 2500);
      try { ws = new WebSocket('ws://127.0.0.1:47800/transcription'); } catch (e) { end('off'); return; }
      ws.onmessage = (e) => {
        let m = null; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m && (m.type === 'ready' || (m.type === 'info' && (m.code === 'MODEL_LOADING' || m.code === 'MODEL_FAILED')))) end('ok');
      };
      ws.onopen = () => setTimeout(() => end('ok'), 1200);
      ws.onerror = () => end('off');
      ws.onclose = () => end('off');
    });
  }

  const SPLIT_SRC = ['pc-interne', 'visio-casque'];
  const NO_KEY_TAB = 'L’onglet de l’appel est transcrit par l’IA : ajoutez une clé dans Réglages, ou choisissez « Micro / haut-parleur ».';
  function createListen(C, o) {
    o = o || {};
    const mobile = isMobileDevice();
    const prefKey = o.prefKey || 'listenPreset';
    const saved = str(prefs()[prefKey]);
    const A = { on: false, starting: false, cancelled: false, error: '', errorCode: '', mobile, preset: mobile && SPLIT_SRC.includes(saved) ? 'haut-parleur' : saved, state: 'off', interim: '', offs: [], pc: mobile ? 'off' : 'unknown' };
    const split = () => SPLIT_SRC.includes(A.preset);
    const roleOf = o.roleOf ? (who) => o.roleOf(who, split()) : (who) => (split() && who === 'me' ? 'jury' : 'student');
    const interimRoles = o.interimRoles || ['student'];
    function unsub() { A.offs.splice(0).forEach((f) => { try { f(); } catch (e) {  } }); }
    async function start(preset) {
      if (!S.audio || !S.audio.start) { toast('Module audio indisponible' + (o.call ? '.' : ' : utilisez les notes manuelles.'), 'err'); return; }
      if (A.on || A.starting) return;
      // Source jamais choisie : « Son du PC » est recherché de nouveau (il démarre parfois après la page), et le
      // choix automatique n'est pas enregistré : un repli sur le micro ne devient pas le réglage permanent.
      const chosen = preset || str(prefs()[prefKey]);
      if (!chosen && !A.mobile && A.pc !== 'ok') {
        A.starting = true; A.cancelled = false; A.state = 'starting'; C.paintListen();
        A.pc = await probePcProgram();
        A.starting = false;
        if (A.cancelled || !C.alive) { A.cancelled = false; A.state = 'off'; if (C.alive) C.paintListen(); return; }
      }
      A.preset = chosen || (A.pc === 'ok' ? 'pc-interne' : 'haut-parleur');
      if (A.mobile && SPLIT_SRC.includes(A.preset)) A.preset = 'haut-parleur';
      if (chosen) setPrefs({ [prefKey]: A.preset });
      A.error = ''; A.errorCode = '';
      if (A.preset === 'visio-casque' && !aiReady()) {
        A.state = 'error'; A.error = NO_KEY_TAB; A.errorCode = 'NO_KEY'; C.paintListen();
        toast(NO_KEY_TAB, 'warn', { duration: 9000, action: { label: 'Réglages', onClick: () => go('#/settings') } });
        return;
      }
      A.starting = true; A.cancelled = false; A.state = 'starting'; C.paintListen();
      unsub();
      const speaking = () => Date.now() < (C.speakingUntil || 0);
      A.offs.push(S.audio.on('final', (ev) => { if (ev && ev.text && !speaking()) C.onHeard(roleOf(ev.who), str(ev.text).trim(), ev); }));
      A.offs.push(S.audio.on('interim', (ev) => { if (ev && interimRoles.includes(roleOf(ev.who)) && !speaking()) { A.interim = ev.text === '…' ? '' : str(ev.text); C.paintInterim(); } }));
      A.offs.push(S.audio.on('speech', (ev) => { if (ev && interimRoles.includes(roleOf(ev.who))) { A.juryTalk = !!ev.active; if (C.paintInterim) C.paintInterim(); } }));
      A.offs.push(S.audio.on('state', (ev) => {
        if (!ev) return;
        if (ev.state === 'error') {
          A.state = 'error';
          A.error = (S.audio.message && S.audio.message(ev.code)) || ev.error || 'Écoute interrompue.'; A.errorCode = str(ev.code);
          if (!A.starting) toast((S.audio.message && S.audio.message(ev.code)) || ev.error || 'Écoute interrompue.', 'err', { duration: 9000 });
        } else if (ev.state === 'listening') A.state = 'listening';
        C.paintListen();
      }));
      A.offs.push(S.audio.on('ended', (ev) => {
        const msg = (ev && ev.reason === 'display-ended' && S.audio.message && S.audio.message('DISPLAY_ENDED')) ||
          (ev && ev.reason === 'track-ended' ? 'Le micro s’est coupé (débranché ou pris par une autre application).' : 'Le son s’est coupé : plus rien n’est capté.');
        if (!o.call) toast(msg, 'warn', { duration: 9000 });
        stop({ drainMs: 0 }).then(() => { A.state = 'error'; A.error = msg; A.errorCode = 'ENDED'; if (C.alive) C.paintListen(); });
      }));
      try {
        const startOpts = { lang: 'fr-FR', hint: o.hint ? str(o.hint()).slice(0, 400) : '' };
        // Micro choisi dans Réglages (devices.js) : id revalidé (il change parfois après un effacement des cookies).
        if (S.devices && typeof S.devices.resolve === 'function') { try { startOpts.micDeviceId = await S.devices.resolve('mic'); } catch (e) {  } }
        await S.audio.start(A.preset, startOpts);
        if (A.cancelled || !C.alive) {
          unsub();
          try { await S.audio.stop({ drainMs: 0 }); } catch (e) {  }
          A.on = false; A.state = 'off';
          return;
        }
        A.on = true;
        // Une erreur survenue pendant le démarrage n'est pas écrasée : on montre le toast retenu.
        if (A.state === 'error') toast(A.error, 'err', { duration: 9000 });
        else { A.state = 'listening'; if (!o.call) toast(split() ? 'Écoute du son de l’appel lancée.' : 'Écoute du micro lancée.', 'ok'); }
        C.wantsWake = true; keepAwake(true);
      } catch (e) {
        unsub();
        A.on = false; A.state = A.cancelled ? 'off' : 'error';
        if (!A.cancelled && C.alive) {
          const msg = (e && e.code && S.audio.message && S.audio.message(e.code)) || errMsg(e);
          A.error = msg; A.errorCode = str(e && e.code);
          if (!o.call) toast(msg + ' La console reste utilisable (notes manuelles).', 'err', { duration: 9000 });
        }
      } finally { A.starting = false; if (C.alive) C.paintListen(); }
    }
    async function stop(opt) {
      const drainMs = opt && opt.drainMs != null ? opt.drainMs : 1500;
      if (A.starting) A.cancelled = true;
      const was = A.on;
      A.on = false; A.state = 'off'; A.interim = '';
      if (o.onStop) o.onStop();
      if (C.paintListen && C.alive) C.paintListen();
      if (was && S.audio && S.audio.stop) { try { await S.audio.stop({ drainMs }); } catch (e) {  } }
      unsub();
      A.interim = '';
      if (C.paintListen && C.alive) C.paintListen();
    }
    async function probe() {
      if (A.pc !== 'unknown' || A.mobile) return;
      A.pc = 'pending';
      A.pc = await probePcProgram();
      if (A.pc === 'ok' && !prefs()[prefKey]) A.preset = 'pc-interne';
      if (C.paintListen) C.paintListen();
    }
    return { A, start, stop, probe, split };
  }

  function listenHTML(A, o) {
    o = o || {};
    const pcSub = 'Teams, Meet, Zoom… · programme « Son du PC »' + (A.pc === 'ok' ? ' détecté' : A.pc === 'pending' ? ' : recherche…' : ' requis');
    const sources = [
      { id: 'pc-interne', ic: 'speaker', label: 'Son de la visio sur ce PC', sub: pcSub, rec: A.pc === 'ok' },
      { id: 'visio-casque', ic: 'globe', label: 'Onglet de la visio dans Chrome', sub: 'Partagez l’onglet de la visio avec le son · clé IA requise' },
      { id: 'haut-parleur', ic: 'mic', label: 'Micro / haut-parleur', sub: 'Le micro capte le son de la visio (voix mêlées)' }
    ].filter((x) => !(A.mobile && SPLIT_SRC.includes(x.id)));
    const sel = A.preset || (A.pc === 'ok' ? 'pc-interne' : 'haut-parleur');
    const primary = A.on ? 'btn-danger' : o.quiet ? '' : 'btn-primary';
    const onErr = A.on && A.state === 'error';
    const stLabel = A.starting ? 'Démarrage…' : onErr ? (A.error || 'Écoute arrêtée.') : A.on ? (o.onLabel || 'J’écoute') : A.state === 'error' ? (A.error || 'Écoute arrêtée.') : 'Écoute arrêtée';
    return `<div class="ex-listen ${A.on ? 'on' : ''}">
<div class="ex-src"${sources.length < 2 ? ' hidden' : ''} role="radiogroup" aria-label="Source du son">${sources.map((x) => `<button type="button" class="ex-src-opt${sel === x.id ? ' on' : ''}" role="radio" aria-checked="${sel === x.id}" data-src="${x.id}"${A.on || A.starting ? ' disabled' : ''}>
        <span class="ex-src-ic">${icon(x.ic)}</span><span class="ex-src-t"><b>${esc(x.label)}${x.rec ? ' <span class="pill pill-xs pill-ok">Recommandé</span>' : ''}</b><small>${esc(x.sub)}</small></span></button>`).join('')}</div>
      <div class="ex-listen-bar">
        <span class="ex-live-dot ${onErr ? 'err' : A.on ? 'on' : A.state === 'error' ? 'err' : ''}" aria-hidden="true"></span><span class="grow small" role="status" data-b="listen-status">${esc(stLabel)}</span>
        <button type="button" class="btn btn-sm ${primary}" data-act="${A.on ? 'listen-stop' : 'listen-start'}"${A.starting ? ' disabled' : ''}>${icon(A.on ? 'stop' : 'mic')}<span>${A.on ? 'Arrêter l’écoute' : esc(o.startLabel || 'Écouter')}</span></button>
      </div>
    </div>`;
  }

  function exportCallMd(s) {
    const c = s.call || {};
    const L = [`# Entretien — ${s.subject.title} · ${fmtDate(s.createdAt, true)}`, ''];
    if (c.startedAt) L.push(`- Durée : ${fmtDur((c.endedAt || Date.now()) - c.startedAt)}`);
    const list = arr(c.answers).filter((a) => !a.skipped && a.question);
    L.push('', '## Questions du recruteur et réponses', '');
    if (!list.length) L.push('Aucune question enregistrée.');
    list.forEach((a, i) => {
      L.push(`### ${i + 1}. ${a.question}`, '');
      if (a.text) L.push(`- Réponse soufflée : ${a.text}`);
      if (arr(a.keyWords).length) L.push(`- Repères : ${a.keyWords.join(', ')}`);
      if (a.error && !a.text) L.push(`- Réponse soufflée : non obtenue (${a.error})`);
      if (a.mine) L.push(`- Ma réponse : ${a.mine}`);
      L.push('');
    });
    if (arr(c.turns).length) L.push('## Échanges', '', ...c.turns.map((t) => `- **${t.who === 'jury' ? 'Recruteur' : t.who === 'student' ? 'Moi' : 'Entendu'}** : ${t.text}`));
    return L.join('\n') + '\n';
  }

  // Dossier d'un entretien : intitulé du poste + texte (fiche de préparation, CV, lettre, offre).
  function dossierSheet(cur, onDone) {
    cur = cur || {};
    const max = (S.examAI && S.examAI.jobDossierMax) || 36000;
    const body = h(`<div class="stack ex-import">
      <div class="field"><label for="ex-job-title">Poste et employeur</label>
        <input id="ex-job-title" class="input" type="text" data-f="title" maxlength="120" autocomplete="off" value="${esc(cur.title && cur.title !== NO_TITLE ? cur.title : '')}" placeholder="Intitulé du poste — employeur"></div>
      <button type="button" class="ex-dz" data-act="pick">${icon('upload')}<b>Déposez vos documents</b><span>Fiche de préparation, CV, lettre, offre · PDF, Word, image ou texte · plusieurs fichiers possibles</span></button>
      <div class="field"><label for="ex-job-text">Dossier lu par le souffleur</label>
        <textarea id="ex-job-text" rows="10" data-f="text" placeholder="Collez ici votre fiche de préparation, votre CV, l’offre… Mettez le plus important en premier."></textarea></div>
      <p class="small muted" data-b="state" role="status"></p>
    </div>`);
    const ta = $('[data-f="text"]', body);
    ta.value = str(cur.text);
    let busy = false;
    const setState = (t, spin) => { $('[data-b="state"]', body).innerHTML = (spin ? '<span class="spinner spinner-xs"></span> ' : '') + esc(t); };
    function count() {
      const t = ta.value.trim();
      if (!t) setState('Le dossier reste sur cet appareil. Il est envoyé à votre IA seulement pendant l’entretien, pour préparer les réponses.');
      else if (t.length > max) setState(`${words(t).toLocaleString('fr-FR')} mots : trop long. Le souffleur ne lit que le début (environ ${Math.round(max / t.length * 100)} %). Gardez l’essentiel et mettez la fiche de préparation en premier.`);
      else setState(`${words(t).toLocaleString('fr-FR')} mots. Le souffleur répond avec ce dossier.`);
    }
    ta.addEventListener('input', count);
    count();
    async function takeFiles(files) {
      files = Array.from(files || []);
      if (!files.length || busy) return;
      if (!S.docs || !S.docs.extract) { toast('Lecture de fichiers indisponible : collez le texte.', 'err'); return; }
      busy = true;
      const failed = [];
      for (const file of files) {
        setState(`Lecture de « ${file.name} »…`, true);
        try {
          const r = await S.docs.extract(file, file.name);
          // Long PDF : « text » ne contient que la première partie, on prend toutes les pages.
          const t = (r && Array.isArray(r.pages) && r.pages.length ? S.docs.clean(r.pages.join('\n\n')) : str(r && r.text)).trim();
          if (!t) { failed.push(`« ${file.name} » : aucun texte lisible`); continue; }
          ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + '## ' + file.name.replace(/\.[a-z0-9]+$/i, '') + '\n' + t;
          if (r && r.warning) toast(r.warning, 'warn');
        } catch (e) { failed.push(`« ${file.name} » : ${errMsg(e)}`); }
      }
      busy = false;
      count();
      if (failed.length) toast('Fichier non lu — ' + failed.join(' ; '), 'err', { duration: 9000 });
    }
    $('[data-act="pick"]', body).addEventListener('click', async () => {
      takeFiles(UI().pickFiles ? await UI().pickFiles({ accept: (S.docs && S.docs.accept) || '', multiple: true }) : []);
    });
    const dz = $('.ex-dz', body);
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); takeFiles(e.dataTransfer && e.dataTransfer.files); });
    sheet({
      title: 'Dossier de l’entretien', body, wide: true,
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        {
          label: 'Enregistrer', kind: 'primary', icon: 'check', close: false,
          onClick: (ctx) => {
            if (busy) { toast('Lecture d’un fichier en cours : attendez la fin.', 'info'); return false; }
            const text = ta.value.trim();
            if (text.length > DOSSIER_KEEP) toast(`Dossier très long : seuls les ${DOSSIER_KEEP.toLocaleString('fr-FR')} premiers caractères sont gardés.`, 'warn');
            ctx.close('action');
            onDone({ title: $('[data-f="title"]', body).value.trim().slice(0, 120) || NO_TITLE, text: text.slice(0, DOSSIER_KEEP) });
            return false;
          }
        }
      ]
    });
  }

  const rowHTML = (s) => `<div class="list-row ex-hrow">
      <button type="button" class="ex-hopen" data-open="${esc(s.id)}">
        <span class="tile tile-teal">${icon('video')}</span>
        <span class="list-main"><b>${esc(s.subject.title)}</b><small>${esc(fmtDate(s.createdAt, true))} · ${words(s.job.text) ? words(s.job.text).toLocaleString('fr-FR') + ' mots de dossier' : 'sans dossier'}</small></span>
        <span class="pill pill-xs">${callCountLabel(s)}</span>
      </button>
      <button type="button" class="icon-btn icon-btn-sm" data-del="${esc(s.id)}" aria-label="Supprimer cet entretien" title="Supprimer">${icon('trash')}</button>
    </div>`;
  function listClicks(root, again) {
    root.addEventListener('click', async (e) => {
      const o = e.target.closest('[data-open]');
      if (o) { const s = store.get(o.dataset.open); if (s) go(sessionHash(s)); return; }
      const d = e.target.closest('[data-del]');
      if (d && await confirmSheet({ title: 'Supprimer cet entretien ?', text: 'Le dossier, les questions et les réponses de cette séance seront effacés.', okLabel: 'Supprimer', danger: true })) {
        store.remove(d.dataset.del);
        toast('Entretien supprimé.', 'ok');
        if (S.app && S.app.refresh) S.app.refresh(); else again(root);
      }
    });
  }

  function renderHome(root) {
    const list = store.list().map(fixSession);
    const open = list.find((s) => isOpen(s) && Date.now() - Date.parse(stamp(s)) < 86400e3);
    root.innerHTML = `<div class="screen ex ex-home">
      <header class="home-head">
        <div class="brand">
          <div class="app-icon" aria-hidden="true">${icon('video')}</div>
          <div class="brand-text"><h1 class="h1">Aide Visio</h1><p class="home-sub">Souffleur d’entretien d’embauche</p></div>
        </div>
      </header>

      ${open ? `<section class="card ex-resume">
        <span class="tile tile-orange">${icon('clock')}</span>
        <div class="grow"><b>Entretien en cours</b><small class="muted">${esc(open.subject.title)}</small></div>
        <button type="button" class="btn btn-primary btn-sm" data-go="${esc(sessionHash(open))}">${icon('play')}<span>Reprendre</span></button>
      </section>` : ''}

      <nav class="ex-roles" aria-label="Commencer">
        <button type="button" class="card ex-role ex-role-jury is-primary" data-go="#/entretien/new">
          <span class="ex-role-ic">${icon('video')}</span>
          <span class="ex-role-text"><b>Préparer un entretien</b><span>Chargez votre dossier (fiche, CV, lettre, offre). Pendant la visio, le souffleur écoute le recruteur et affiche une réponse à dire.</span></span>
          ${icon('chevron-right', 'chev')}
        </button>
      </nav>
      ${aiReady() ? '' : `<p class="ex-home-note">${icon('info', 'ico-inline')}<span>Le souffleur a besoin d’une clé IA pour proposer des réponses.</span><button type="button" class="btn btn-quiet btn-sm" data-go="#/settings">Ajouter une clé</button></p>`}
      ${list.length ? `<section class="ex-home-last"><h2 class="h3">Derniers entretiens</h2><div class="list ex-hlist">${list.slice(0, 3).map(rowHTML).join('')}</div></section>` : ''}
    </div>`;
    listClicks(root, renderHome);
    setCurrent({});
  }

  function renderJobStart(root) {
    // Le dossier du dernier entretien est repris : le même sert souvent à plusieurs séances.
    const last = store.list().map(fixSession).find((s) => s.job.text);
    const d = last ? { title: last.subject.title, text: last.job.text, from: true } : { title: NO_TITLE, text: '' };
    let starting = false;
    const start = () => {
      if (starting) return;
      starting = true;
      const s = newSession(d.title, d.text);
      store.save(s);
      go(sessionHash(s));
    };
    function paint() {
      const n = words(d.text);
      root.innerHTML = `<div class="screen ex ex-chooser lv-start-screen">
        ${topbar({ title: 'Préparer un entretien', back: '#/' })}
        <ol class="lv-steps">
          <li class="card card-pad lv-step is-main">
            <span class="lv-step-n" aria-hidden="true">1</span>
            <div class="lv-step-b"><h2 class="h3">Votre dossier</h2>
              ${n ? `<p><b>${esc(d.title)}</b> · ${n.toLocaleString('fr-FR')} mots${d.from ? ' <span class="muted">(repris du dernier entretien)</span>' : ''}</p>` : '<p class="muted">Fiche de préparation, CV, lettre de motivation, offre : le souffleur s’en sert pour répondre comme vous.</p>'}
              <div class="row">
                <button type="button" class="btn ${n ? '' : 'btn-primary btn-lg'}" data-act="dossier">${icon('import')}<span>${n ? 'Modifier le dossier' : 'Importer le dossier'}</span></button>
                ${n ? `<button type="button" class="btn btn-quiet" data-act="clear">${icon('trash')}<span>Repartir de zéro</span></button>` : ''}
              </div>
            </div>
          </li>
          <li class="card card-pad lv-step">
            <span class="lv-step-n" aria-hidden="true">2</span>
            <div class="lv-step-b"><h2 class="h3">Ouvrir l’entretien</h2>
              <p class="muted">${isMobileDevice() ? 'Sur l’écran suivant, « Lancer le souffleur » démarre l’écoute et affiche la réponse en grand. Posez le téléphone juste sous la caméra.' : 'Sur l’écran suivant, « Lancer le souffleur » démarre l’écoute et ouvre une petite fenêtre à placer juste sous la caméra.'}</p>
              <button type="button" class="btn ${n ? 'btn-primary btn-lg' : 'btn-quiet btn-sm'}" data-act="start">${icon('play')}<span>${n ? 'Ouvrir l’entretien' : 'Continuer sans dossier'}</span></button>
            </div>
          </li>
        </ol>
      </div>`;
    }
    paint();
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'dossier') dossierSheet(d, (r) => { d.title = r.title; d.text = r.text; d.from = false; paint(); });
      else if (b.dataset.act === 'clear') { d.title = NO_TITLE; d.text = ''; d.from = false; paint(); }
      else if (b.dataset.act === 'start') start();
    });
    setCurrent({});
  }

  function renderHistory(root) {
    const list = store.list().map(fixSession);
    root.innerHTML = `<div class="screen ex ex-history">
      ${topbar({ title: 'Historique', sub: list.length ? `${list.length} entretien${list.length > 1 ? 's' : ''}` : '', back: '#/' })}
      ${list.length ? `<div class="list ex-hlist">${list.map(rowHTML).join('')}</div>` : `<div class="empty card"><div class="empty-ic">${icon('clock')}</div><h2 class="h3">Aucun entretien pour l’instant.</h2><div class="row center"><button type="button" class="btn btn-primary" data-go="#/entretien/new">${icon('video')}<span>Préparer un entretien</span></button></div></div>`}
    </div>`;
    listClicks(root, renderHistory);
    setCurrent({});
  }

  const NO_KEY_LIVE = 'Pas de clé IA : ajoutez-en une dans Réglages.';
  const OLD_AI = 'Aide Visio vient d’être mis à jour : rechargez la page pour l’aide en direct.';
  const JOIN_MS = 8000;

  function copyStylesTo(doc) {
    $$('style, link[rel="stylesheet"]').forEach((n) => {
      let css = '';
      if (n.tagName === 'LINK') { try { css = Array.from(n.sheet.cssRules).map((r) => r.cssText).join('\n'); } catch (e) { css = ''; } }
      else css = n.textContent;
      if (css) { const st = doc.createElement('style'); st.textContent = css; doc.head.appendChild(st); }
      else if (n.href) { const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = n.href; doc.head.appendChild(l); }
    });
  }

  function renderCall(root, s) {
    const C = { root, s, alive: true, saveT: 0 };
    C.saveNow = () => { clearTimeout(C.saveT); C.saveT = 0; store.save(s); };
    C.saveSoon = () => { clearTimeout(C.saveT); C.saveT = setTimeout(C.saveNow, 1200); };
    const call = s.call;
    const R = { ctrl: null, req: null, item: null, busy: false, partial: '', lines: [], float: null, jury: [], err: '', errKind: '', warn: '', born: 0, mode: '', raf: 0, lastErr: '', lastK: '', ending: false, floatPending: false };
    const L = createListen(C, {
      call: true, prefKey: 'jobListenPreset', hint: () => jobHint(s),
      roleOf: (who, split) => (split ? (who === 'me' ? 'student' : 'jury') : 'mixed'),
      interimRoles: ['jury', 'mixed'],
      // La fenêtre flottante reste ouverte si le son coupe : elle affiche l'erreur et « Relancer ».
      onStop: () => { C.wantsWake = false; keepAwake(false); if (C.alive) paintLive(); }
    });
    const desk = !isMobileDevice();
    const canFull = () => desk && !!document.fullscreenEnabled;
    // PC ≥ 1100 px : aides en grand à gauche, colonne qui défile à droite (voir live.css).
    const WIDE_MQ = '(min-width: 1100px) and (min-height: 600px)';
    const wide = () => desk && !!(window.matchMedia && window.matchMedia(WIDE_MQ).matches);
    const isFull = () => !!document.fullscreenElement && document.fullscreenElement === $('[data-b="live"]', root);
    const isQ = (t) => { try { return aiHas('isRecruiterQuestion') ? !!S.examAI.isRecruiterQuestion(t) : /\?\s*$/.test(t); } catch (e) { return false; } };
    const shown = () => R.item || call.answers[call.answers.length - 1] || null;
    document.body.classList.add('ex-focus');
    function subjectCard() {
      const n = words(s.job.text);
      return `<details class="card card-pad ex-details ex-call-subject"${n ? '' : ' open'}><summary><b>Dossier</b><span class="small muted"> · ${n ? n.toLocaleString('fr-FR') + ' mots' : 'vide'}</span></summary>
        ${n ? `<p class="small muted">Le souffleur répond avec ce dossier (fiche, CV, lettre, offre).</p><pre class="ex-job-text">${esc(s.job.text.slice(0, 1500))}${s.job.text.length > 1500 ? '…' : ''}</pre>` : '<p class="small muted">Sans dossier, les réponses restent générales.</p>'}
        <button type="button" class="btn btn-sm" data-act="import-subject">${icon('import')}<span>${n ? 'Modifier le dossier' : 'Importer le dossier'}</span></button>
      </details>`;
    }
    const endBtn = (done) => `<button type="button" class="btn" data-act="end" data-b="end"${done ? ' disabled' : ''}>${icon('stop')}<span>${done ? 'Entretien terminé' : 'Terminer l’entretien'}</span></button>`;

    root.innerHTML = `<div class="screen ex ex-call">
      ${topbar({ title: 'Entretien', sub: s.subject.title, back: '#/' })}
      <span class="sr-only" data-b="call-sr" aria-live="polite"></span>
      <div class="lv-body">
        <section class="card ex-live lv-stage" data-b="live" data-theme="dark"></section>
        <aside class="lv-side" aria-label="Son, dossier et historique">
          <section class="card card-pad ex-call-listen" data-b="listen-card">
            <div class="card-head"><h2 class="h3">Son de la visio</h2></div>
            <div data-b="listen"></div>
          </section>
          ${subjectCard()}
          <section class="card card-pad ex-call-hist">
            <div class="card-head"><h2 class="h3">Questions et réponses</h2><span class="spacer"></span><span class="badge" data-b="hist-n">0</span></div>
            <div data-b="hist"></div>
            <div class="ex-actions-row">
              <button type="button" class="btn" data-act="export">${icon('download')}<span>Exporter (.md)</span></button>
              ${endBtn(!!call.endedAt)}
            </div>
          </section>
        </aside>
      </div>
    </div>`;
    C.say = (t) => {
      const el = $('[data-b="call-sr"]', root);
      if (!el) return;
      el.textContent = '';
      setTimeout(() => { if (C.alive) el.textContent = t; }, 60);
    };

    const NO_KEY_START = 'Pas de clé IA : le souffleur ne peut pas proposer de réponse. Ajoutez une clé dans Réglages.';
    // Erreur précise + bouton d'action adapté à la cause.
    const KEY_CODES = ['NO_KEY', 'KEY', 'KEY_ERROR'];
    function listenKind(code) {
      code = str(code);
      if (KEY_CODES.includes(code)) return 'key';
      if (/^MIC_/.test(code)) return 'mic';
      if (/^PC_AUDIO/.test(code)) return 'pc';
      if (code === 'ENDED') return 'lost';
      return 'listen';
    }
    function errHTML(msg, kind, float) {
      const b = (act, ic, label, primary) => `<button type="button" class="btn btn-sm${primary ? ' btn-primary' : ''}" data-act="${act}">${icon(ic)}<span>${label}</span></button>`;
      const btns = [];
      if (kind === 'key') btns.push(float ? b('settings', 'gear', 'Réglages') : `<button type="button" class="btn btn-sm btn-primary" data-go="#/settings">${icon('gear')}<span>Réglages</span></button>`);
      else if (kind === 'old') btns.push(b('reload', 'refresh', 'Recharger la page', true));
      else if (kind === 'mic') { btns.push(b('assist', 'refresh', 'Réessayer', true)); if (!float) btns.push(b('pick-src', 'speaker', 'Changer de source')); }
      else if (kind === 'pc') { btns.push(b('use-mic', 'mic', 'Utiliser le micro', true)); btns.push(b('assist', 'refresh', 'Réessayer')); }
      else if (kind === 'lost') btns.push(b('assist', 'mic', 'Relancer le souffleur', true));
      else if (kind === 'listen') btns.push(b('assist', 'refresh', 'Réessayer'));
      else if (kind === 'answer') btns.push(b('retry', 'refresh', 'Réessayer'));
      // role="alert" seulement pour une erreur nouvelle : un repaint ne la réannonce pas.
      const role = msg !== R.lastErr ? 'alert' : 'group';
      R.errNow = msg;
      return `<div class="ex-live-err lv-err" role="${role}">${icon('warning', 'ico-inline')}<span>${esc(msg)}</span>${btns.length ? `<span class="lv-err-btns">${btns.join('')}</span>` : ''}</div>`;
    }
    function warnHTML() {
      return R.warn && L.A.on ? `<p class="lv-warn" role="status">${icon('warning', 'ico-inline')}<span>${esc(R.warn)}</span></p>` : '';
    }
    // ---- Sous-titres : question du recruteur, réponse phrase par phrase, mots-clés ----
    function statusInfo(busy, a) {
      if (L.A.starting) return ['Démarrage…', 'start'];
      if (!L.A.on) return ['Souffleur arrêté', 'off'];
      if (L.A.interim) return L.A.juryTalk === false ? ['Question reçue…', 'busy'] : ['Le recruteur parle…', 'talk'];
      if (busy) return ['Réponse en cours…', 'busy'];
      if (a && a.text && !a.error) return ['Réponse prête', 'ready'];
      return ['J’écoute…', 'listen'];
    }
    function statusHTML(busy, a) {
      const [label, k] = statusInfo(busy, a);
      return `<span class="lv-status${L.A.on ? ' on' : ''}" data-k="${k}" data-b="status"><span class="ex-live-dot${L.A.on ? ' on' : ''}" aria-hidden="true"></span><b data-b="status-l">${label}</b></span>`;
    }
    const kwHTML = (k) => `<span class="pill lv-kw-i"><b>${esc(k)}</b></span>`;
    const sentencesOf = (t) => str(t).split(/(?<=[.!?…])\s+(?=["“«(]?[A-ZÀ-Ý0-9])/).map((x) => x.trim()).filter(Boolean);
    // Phrases à afficher : celles de l'IA ; sinon (ancienne IA) la réponse découpée en phrases.
    function linesFor(a, busy) {
      const l = arr(busy ? R.lines : a.lines).filter((x) => x && str(x.en).trim());
      if (l.length) return l;
      return sentencesOf(busy ? R.partial : a.text).map((en) => ({ en }));
    }
    const lineHTML = (l, isNew) => `<p class="lv-line${isNew ? ' is-new' : ''}"><span class="lv-en">${esc(l.en)}</span></p>`;
    // Outils de la réponse (discrets) et de la vue (fenêtre flottante, plein écran, arrêt).
    const askNowBtn = (short) => `<button type="button" class="btn btn-sm lv-ghost" data-act="ask-now" title="Répondre à ce que le recruteur vient de dire (touche Espace)" aria-label="Répondre maintenant" aria-keyshortcuts="Space">${icon('sparkles')}<span>${short ? 'Répondre' : 'Répondre maintenant'}</span></button>`;
    function answerTools(busy, float) {
      const t = (act, ic, label, busyLabel, title, key) => {
        const on = busy && R.mode === act;
        return `<button type="button" class="btn btn-sm lv-ghost${on ? ' on' : ''}" data-act="${act}" title="${title}" aria-label="${label}" aria-keyshortcuts="${key}"${on ? ' aria-disabled="true"' : ''}>${icon(ic)}<span>${on ? busyLabel : label}</span></button>`;
      };
      return `<div class="ex-live-actions lv-tools lv-atools">
        ${float && L.A.on ? askNowBtn(true) : ''}
        ${t('shorter', 'text-size', 'Plus court', 'Plus court…', 'Réponse plus courte (touche C)', 'C')}
        ${t('retry', 'refresh', 'Réessayer', 'Nouvelle réponse…', 'Nouvelle réponse (touche R)', 'R')}
      </div>`;
    }
    function viewTools() {
      if (!L.A.on) return '';
      const t = [askNowBtn()];
      if (desk) t.push(`<button type="button" class="btn btn-sm lv-ghost${R.float ? ' on' : ''}" data-act="float" aria-pressed="${!!R.float}" aria-keyshortcuts="P" title="Garder la réponse au premier plan, au-dessus de la visio (touche P)"${R.floatPending ? ' aria-disabled="true"' : ''}>${icon('pip')}<span>${R.floatPending ? 'Ouverture…' : 'Fenêtre flottante'}</span></button>`);
      if (canFull()) t.push(`<button type="button" class="btn btn-sm lv-ghost${isFull() ? ' on' : ''}" data-act="full" aria-pressed="${isFull()}" aria-keyshortcuts="F" title="Réponse en plein écran (touche F, Échap pour sortir)">${icon('eye')}<span>${isFull() ? 'Quitter le plein écran' : 'Plein écran'}</span></button>`);
      t.push(`<button type="button" class="btn btn-sm lv-ghost" data-act="listen-stop" title="Arrêter l’écoute">${icon('stop')}<span>Arrêter</span></button>`);
      return `<div class="ex-live-actions lv-tools lv-vtools">${t.join('')}</div>`;
    }
    // Fenêtre flottante : seule la fin de la phrase entendue tient sur une ligne.
    const tailOf = (t, n) => (t.length > n ? '…' + t.slice(-n).replace(/^\S*\s+/, '') : t);
    // Bloc « Recruteur » : question entendue. Pendant que le recruteur parle,
    // la phrase entendue s'y affiche en direct à la place de la question précédente.
    function juryHTML(a, float) {
      return `<div class="${a ? 'ex-live-q lv-q' : 'lv-q lv-q-live'}">
        <span class="lv-q-tag" aria-hidden="true">Recruteur</span>
        <div class="lv-q-body">
          ${a ? `<p class="lv-q-en ex-live-en">${esc(a.question)}</p>` : ''}
          <p class="lv-interim ex-live-interim" data-b="interim">${esc(float ? tailOf(L.A.interim, 72) : L.A.interim)}</p>
        </div>
      </div>`;
    }
    function liveHTML(float) {
      const a = shown();
      const busy = R.busy && R.item === a;
      const lErr = !L.A.on && !L.A.starting && L.A.state === 'error' && !!L.A.error;
      const errBox = () => (R.err ? errHTML(R.err, R.errKind, float) : lErr ? errHTML(L.A.error, listenKind(L.A.errorCode), float) : '');
      if (!aiHas('jobAnswer')) return `<div class="lv-empty">${errHTML(OLD_AI, 'old', float)}</div>`;
      if (!L.A.on && !L.A.starting && !a) {
        // Sans clé IA, la cause est visible avant le clic ; le bouton reste actif.
        const noKey = !aiReady();
        const e = R.err || lErr ? errBox() : noKey ? errHTML(NO_KEY_START, 'key', float) : '';
        return `<div class="lv-start">
          <span class="lv-start-ic" aria-hidden="true">${icon('waveform')}</span>
          <h2 class="lv-start-t">Réponses en direct</h2>
          <p class="lv-start-p">Le souffleur écoute le recruteur et vous propose une réponse à dire, <b>tirée de votre dossier</b>.</p>
          <button type="button" class="btn${noKey ? '' : ' btn-primary'} btn-lg lv-go" data-act="assist">${icon('mic')}<span>Lancer le souffleur</span></button>
          ${e}
          <p class="lv-tip">${icon('video', 'ico-inline')}<span>${desk ? 'Placez la fenêtre flottante juste sous la caméra.' : 'Posez le téléphone juste sous la caméra.'}</span></p>
        </div>`;
      }
      const relaunch = !L.A.on && !L.A.starting && !float ? `<button type="button" class="btn btn-primary btn-sm" data-act="assist">${icon('mic')}<span>Relancer le souffleur</span></button>` : '';
      const head = `<div class="ex-live-head lv-head">${statusHTML(busy, a)}<span class="spacer"></span>${float ? '' : viewTools()}${relaunch}</div>${warnHTML()}`;
      if (!a) {
        // Fenêtre flottante : l'état reste en bas, comme quand une réponse est affichée.
        return `${float ? warnHTML() : head}
          ${juryHTML(null, float)}
          <div class="lv-empty">
            <p class="ex-live-empty lv-wait">${float ? 'La réponse s’affichera ici.' : 'La réponse s’affichera ici dès la question du recruteur.'}</p>
            ${float || R.float ? `<p class="lv-tip">${icon('video', 'ico-inline')}<span>${float ? 'Glissez cette fenêtre juste sous la caméra.' : 'Fenêtre flottante ouverte : placez-la juste sous la caméra.'}</span></p>` : ''}
          </div>
          ${float ? `<div class="lv-foot">${statusHTML(busy, a)}${L.A.on ? `<div class="ex-live-actions lv-tools lv-atools">${askNowBtn(true)}</div>` : ''}</div>` : ''}${errBox()}`;
      }
      const lines = linesFor(a, busy);
      // Fenêtre flottante : pas de ligne d'en-tête, l'état passe dans le pied (plus de place pour les sous-titres).
      const top = float ? warnHTML() : head;
      const st = float ? statusHTML(busy, a) : '';
      const kw = !busy && arr(a.keyWords).length ? `<div class="ex-live-kw lv-kw" aria-label="Mots-clés">${a.keyWords.map(kwHTML).join('')}</div>` : '<span class="lv-kw-gap"></span>';
      const ek = a.errKey || a.error === NO_KEY_LIVE ? 'key' : 'answer';
      return `${top}
        ${juryHTML(a, float)}
        <div class="ex-live-a lv-a" data-b="ans-wrap">
          <div class="ex-live-ans lv-ans${busy ? ' is-streaming' : ''}" data-b="ans" aria-label="Réponse proposée">${lines.map((l) => lineHTML(l)).join('')}</div>
        </div>
        ${!busy && a.error ? errHTML(a.error, ek, float) : ''}
        <div class="lv-foot${!busy && arr(a.keyWords).length ? ' has-kw' : ''}">${st}${kw}${a.error && !a.text ? '' : answerTools(busy, float)}</div>
        ${!busy && a.error && ek === 'key' && R.errKind === 'key' ? '' : errBox()}`;
    }
    // Page cachée (visio au premier plan) : seule la fenêtre flottante est repeinte.
    const views = () => { const main = $('[data-b="live"]', root); const fl = R.float ? [R.float.box] : []; return (document.hidden && fl.length ? fl : [main].concat(fl)).filter(Boolean); };
    // Taille des sous-titres : la plus grande qui tient en entier ; en dessous du minimum, défilement doux.
    function fitAns(box) {
      const el = box && $('[data-b="ans"]', box);
      const wrap = el && el.parentElement;
      if (!el || !wrap) return;
      const inFloat = box === (R.float && R.float.box);
      const full = !inFloat && box.matches && box.matches(':fullscreen');
      if (!(inFloat || full || wide())) { el.style.fontSize = ''; wrap.classList.remove('is-scroll'); delete box.dataset.fitPx; return; }
      const w = wrap.clientWidth || 600;
      const min = inFloat ? 22 : full ? 32 : 24;
      const cap = Math.max(min, Math.min(inFloat ? 30 : full ? 56 : 34, w / (full ? 15 : 17)));
      const id = (shown() || {}).id || '';
      let hi = cap;
      // Même réponse : la taille ne remonte pas pendant le flux (pas de saut) ; elle est recalculée à la fin.
      const last = parseFloat(box.dataset.fitPx);
      const same = box.dataset.fitFor === id;
      if (R.busy && same && last) hi = Math.max(min, Math.min(cap, last));
      box.dataset.fitFor = id;
      const fits = () => wrap.scrollHeight <= wrap.clientHeight + 1;
      const keep = () => { box.dataset.fitPx = parseFloat(el.style.fontSize) || ''; };
      // Pendant le flux : deux relectures de mise en page au plus.
      if (R.busy && same && last) {
        el.style.fontSize = hi + 'px';
        if (!fits()) {
          const next = Math.max(min, Math.floor(hi * 0.92));
          el.style.fontSize = next + 'px';
          wrap.classList.toggle('is-scroll', next === min && !fits());
        } else wrap.classList.remove('is-scroll');
        keep();
        return;
      }
      let lo = min;
      el.style.fontSize = hi + 'px';
      if (fits()) { wrap.classList.remove('is-scroll'); keep(); return; }
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        el.style.fontSize = mid + 'px';
        if (fits()) lo = mid; else hi = mid;
      }
      el.style.fontSize = Math.floor(lo) + 'px';
      wrap.classList.toggle('is-scroll', !fits());
      keep();
    }
    // Focus clavier gardé sur le même bouton après une réécriture.
    const keepFocus = (v) => { const a = v.ownerDocument.activeElement; return a && v.contains(a) && a.dataset && a.dataset.act ? a.dataset.act : ''; };
    const backFocus = (v, act) => { if (!act) return; const b = v.querySelector('[data-act="' + act + '"]'); if (b) b.focus({ preventScroll: true }); };
    function paintLive() {
      if (!C.alive) return;
      R.errNow = '';
      const box = $('[data-b="live"]', root);
      const paint = (v, float) => {
        const f = keepFocus(v);
        v.classList.toggle('is-on', L.A.on);
        v.classList.toggle('has-interim', !!(L.A.on && L.A.interim));
        v.innerHTML = liveHTML(float);
        fitAns(v);
        backFocus(v, f);
      };
      paint(box, false);
      if (R.float) paint(R.float.box, true);
      R.lastErr = R.errNow;
      // Annonce courte au lecteur d'écran quand l'état change (pas toute la scène).
      const a = shown();
      const [label, k] = statusInfo(R.busy && R.item === a, a);
      if (k !== R.lastK) {
        if (k === 'ready') C.say('Réponse prête');
        else if ((k === 'off' && R.lastK) || (k === 'listen' && R.lastK === 'start')) C.say(label);
        R.lastK = k;
      }
    }
    // Flux : phrases mises à jour sur place, les nouvelles apparaissent en fondu (pas de clignotement).
    function syncLines(el, lines) {
      lines.forEach((l, i) => {
        const p = el.children[i];
        if (!p) { el.insertAdjacentHTML('beforeend', lineHTML(l, true)); return; }
        const en = p.firstElementChild;
        if (en.textContent !== l.en) en.textContent = l.en;
      });
      while (el.children.length > lines.length) el.lastElementChild.remove();
    }
    function paintAnswer() {
      const a = R.item;
      if (!a || !R.busy || shown() !== a) return;
      const lines = linesFor(a, true);
      views().forEach((v) => {
        const el = $('[data-b="ans"]', v);
        if (!el) return;
        el.classList.add('is-streaming');
        syncLines(el, lines);
        fitAns(v);
      });
    }
    // Flux : une peinture par image (celle de la fenêtre flottante si elle est ouverte).
    function paintSoon() {
      if (R.raf) return;
      const w = R.rafWin = R.float && R.float.win && R.float.win.requestAnimationFrame ? R.float.win : (!document.hidden ? window : null);
      const run = () => { R.raf = 0; paintAnswer(); };
      R.raf = w ? w.requestAnimationFrame(run) : setTimeout(run, 33);
    }
    function dropRaf() {
      if (!R.raf) return;
      try { if (R.rafWin) R.rafWin.cancelAnimationFrame(R.raf); else clearTimeout(R.raf); } catch (e) {  }
      R.raf = 0; R.rafWin = null;
    }
    C.paintInterim = () => {
      if (L.A.interim) warmAI();
      const a = shown();
      const [label, k] = statusInfo(R.busy && R.item === a, a);
      views().forEach((v) => {
        const talk = !!(L.A.on && L.A.interim);
        const was = v.classList.contains('has-interim');
        v.classList.toggle('has-interim', talk);
        const el = $('[data-b="interim"]', v); if (el) el.textContent = R.float && v === R.float.box ? tailOf(L.A.interim, 72) : L.A.interim;
        const st = $('[data-b="status"]', v), sl = $('[data-b="status-l"]', v);
        if (st) st.dataset.k = k;
        if (sl && sl.textContent !== label) sl.textContent = label;
        if (was !== talk) fitAns(v);
      });
    };
    // Connexion à l'IA ouverte d'avance (DNS + TLS) : au lancement et dès que le recruteur parle.
    let warmedAt = 0;
    function warmAI() {
      const t = Date.now();
      if (t - warmedAt < 8000) return;
      warmedAt = t;
      try { if (S.ai && S.ai.warm) S.ai.warm('live'); } catch (e) {  }
    }
    C.paintListen = () => {
      const b = $('[data-b="listen"]', root);
      if (b) b.innerHTML = listenHTML(L.A, { startLabel: 'Lancer le souffleur', onLabel: 'J’écoute la visio', quiet: true });
      paintLive();
    };
    function paintHist() {
      if (!C.alive) return;
      const box = $('[data-b="hist"]', root);
      const list = call.answers;
      $('[data-b="hist-n"]', root).textContent = list.length;
      const cur = shown();
      box.innerHTML = list.length ? `<ol class="ex-chist">${list.slice().reverse().map((a) => `<li class="ex-chist-item${a === cur ? ' is-current' : ''}" data-id="${esc(a.id)}">
          <p class="ex-chist-q">${esc(a.question)}</p>
          ${a.text ? `<p class="ex-chist-a"><span class="ex-chist-l">Réponse soufflée</span><span>${esc(a.text)}</span></p>` : a.error ? `<p class="ex-chist-err">${esc(a.error)}</p>` : R.busy && R.item === a ? '<p class="small muted">Réponse en cours…</p>' : ''}
          ${a.mine ? `<p class="ex-chist-mine"><span class="ex-chist-l">Ce que j’ai dit</span><span>${esc(a.mine)}</span></p>` : ''}
        </li>`).join('')}</ol>`
        : '<p class="small muted">Les questions du recruteur, les réponses soufflées et ce que vous avez dit s’affichent ici.</p>';
    }

    // Forme comparable : minuscules, apostrophes droites, ponctuation et espaces réduits.
    const nz = (x) => str(x).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9à-ÿ']+/g, ' ').trim();
    // Le candidat lit la réponse soufflée à voix haute : la majorité des mots de 4 lettres ou plus de sa phrase
    // (deux sur trois au moins) figurent dans la réponse affichée ou la précédente (micro seul : tout arrive en « mixed »).
    function readsAnswer(text) {
      const words = nz(text).split(' ').filter((w) => w.length >= 4);
      if (words.length < 3) return false;
      const src = new Set(nz(call.answers.slice(-2).map((x) => str(x.text)).concat(R.partial).join(' ')).split(' '));
      return words.filter((w) => src.has(w)).length * 3 >= words.length * 2;
    }

    async function ask(question, o) {
      o = o || {};
      const prev = R.item;
      if (R.ctrl) R.ctrl.abort();
      let item = o.item;
      if (!item) {
        if (o.replace) call.answers = call.answers.filter((x) => x !== o.replace);
        if (prev && R.busy) {
          if (nz(question).includes(nz(prev.question))) call.answers = call.answers.filter((x) => x !== prev);
          else if (!prev.text) prev.error = 'Interrompue par la question suivante.';
        }
        item = { id: 'a-' + uid(), question, text: '', lines: [], keyWords: [], mine: '', at: nowIso(), skipped: false, error: '' };
        call.answers.push(item);
        if (call.answers.length > 60) call.answers.splice(0, call.answers.length - 60);
      }
      const born = Date.now();
      const req = {};
      const ctrl = new AbortController();
      const prevText = str(item.text);
      if (o.force) item.forced = true;
      const force = !!item.forced;
      dropRaf();
      views().forEach((v) => { delete v.dataset.fitPx; });
      Object.assign(R, { req, ctrl, item, busy: true, partial: '', lines: [], born, raf: 0, mode: o.shorter ? 'shorter' : o.item ? 'retry' : 'auto' });
      item.error = ''; item.errNet = false;
      if (!o.item) { R.autoItem = item; R.autoAt = born; }
      const drop = () => { call.answers = call.answers.filter((x) => x !== item); if (R.item === item) R.item = null; };
      try {
        if (!aiHas('jobAnswer')) throw new Error(OLD_AI);
        // Requête lancée d'abord, peinture ensuite : le réseau n'attend pas le rendu.
        const pr = S.examAI.jobAnswer({
          dossier: s.job.text, question, shorter: !!o.shorter, signal: ctrl.signal,
          force, previous: o.shorter ? prevText : '',
          turns: call.turns.slice(-16).map((t) => ({ who: t.who, text: t.text })),
          onDelta: (t, info) => {
            if (R.req !== req || !C.alive) return;
            R.partial = str(t);
            R.lines = arr(info && info.lines);
            paintSoon();
          }
        });
        paintLive(); setTimeout(paintHist, 0);
        const r = await pr;
        if (R.req !== req || !C.alive) return;
        if (r && r.skip) {
          ctrl.abort();
          R.jury = R.jury.filter((x) => x.at > born);
          if (force) { item.error = 'L’IA n’a pas trouvé de question dans « ' + question.slice(0, 80) + ' ».'; return; }
          drop();
          return;
        }
        const text = str(r && r.text).trim();
        if (!text) throw new Error('L’IA n’a renvoyé aucun texte : appuyez sur « Réessayer ».');
        item.text = text;
        if (r.partial) R.warn = 'Réponse incomplète : la connexion à l’IA a coupé. Appuyez sur « Réessayer ».';
        item.lines = arr(r.lines).filter((l) => l && str(l.en).trim()).map((l) => ({ en: str(l.en).trim() })).slice(0, 12);
        item.keyWords = arr(r.keyWords).map(str).map((k) => k.trim()).filter(Boolean).slice(0, 8);
      } catch (e) {
        if (R.req !== req || !C.alive || isAbort(e)) return;
        const keyBad = !!(e && KEY_CODES.includes(e.code));
        item.error = e && e.code === 'NO_KEY' ? NO_KEY_LIVE : keyBad ? (errMsg(e) || 'Clé IA refusée : corrigez-la dans Réglages.') : errMsg(e);
        item.errKey = keyBad;
        item.errNet = !!(e && /^(NETWORK|OFFLINE|TIMEOUT)$/.test(e.code));
      } finally {
        // Question traitée (réponse ou échec) : elle n'est plus collée à la suivante.
        if (R.req === req) { R.jury = R.jury.filter((x) => x.at > born); dropRaf(); Object.assign(R, { busy: false, ctrl: null, partial: '', lines: [], mode: '' }); if (C.alive) { paintLive(); paintHist(); } }
        C.saveSoon();
      }
    }

    // Recolle deux morceaux d'une même phrase : si la suite commence en minuscule, le « ? » ou le « . »
    // posé par la pause au milieu est retiré (« What do you think? about… » → « What do you think about… »).
    // Suite en majuscule après un morceau sans ponctuation finale : un point est ajouté (« …is stable. Could you… »).
    const glue = (a, b) => (/^[a-zà-ÿ]/.test(b) ? a.replace(/[.?!…]+\s*$/, '') : /[A-Za-zÀ-ÿ0-9]\s*$/.test(a) && /^[A-ZÀ-Ý]/.test(b) ? a.trim() + '.' : a) + ' ' + b;
    const NOT_CONT = /^(?:ok(?:ay)?|d'accord|très bien|bien|parfait|super|merci|oui|non|voilà|alors|bon|entendu|je vois|intéressant|pardon|prenez votre temps|allez-y|je vous écoute|quand vous voulez|je vous en prie|volontiers)(?![a-zà-ÿ])/i;
    C.onHeard = (role, text, ev) => {
      if (!text || !C.alive) return;
      L.A.interim = '';
      C.paintInterim();
      const now = Date.now();
      if (!call.startedAt) call.startedAt = now;
      // Micro seul : le candidat qui lit la réponse soufflée n'est pas une question.
      // Une tournure interrogative n'est jamais une lecture : le recruteur reprend souvent les mots de la réponse.
      const reads = role === 'mixed' && !isQ(text.replace(/\?[\s"'»)]*$/, '')) && readsAnswer(text);
      const q = !reads && isQ(text);
      const jury = role === 'jury' || (role === 'mixed' && q);
      call.turns.push({ who: jury ? 'jury' : role === 'mixed' ? 'mixed' : 'student', text, t: now - call.startedAt });
      if (call.turns.length > 400) call.turns.splice(0, call.turns.length - 400);
      // Une alerte sur une source (son du PC non capté…) ne s'efface que si cette source se fait entendre.
      if (R.warn && (!R.warnWho || R.warnWho === str(ev && ev.who))) { R.warn = ''; R.warnWho = ''; paintLive(); }
      if (jury) {
        warmAI();
        R.jury = R.jury.filter((x) => now - x.at < JOIN_MS).concat({ text, at: now });
        const joined = R.jury.map((x) => x.text).reduce(glue);
        // Question coupée par une pause du recruteur : la suite relance la réponse avec la question entière,
        // même si l'IA a commencé à écrire (dans les 6 s, tant que le candidat n'a pas répondu).
        const base = R.autoItem;
        const cont = !q && role === 'jury' && base && !base.forced && !base.mine && call.answers.includes(base) && now - R.autoAt < 6000 && !NOT_CONT.test(text.trim().replace(/[’‘]/g, "'"));
        // « Répondre maintenant » puis phrase finale : la demande reste forcée.
        if (q) ask(joined, { force: !!(R.busy && R.item && R.item.forced && now - R.born < JOIN_MS) });
        else if (cont) ask(glue(base.question, text), { replace: base });
      } else {
        const a = shown();
        // En « mixed », une phrase qui n'est pas une lecture de la réponse peut venir du recruteur : elle n'est pas rangée comme parole du candidat.
        if (a && (role !== 'mixed' || reads)) { a.mine = (a.mine ? a.mine + ' ' : '') + text; paintHist(); }
      }
      C.saveSoon();
    };

    async function startListen() {
      if (L.A.on || L.A.starting) return;
      call.endedAt = null;
      R.warn = '';
      const eb = $('[data-b="end"]', root);
      if (eb) eb.outerHTML = endBtn(false);
      await L.start();
      if (!C.alive) return;
      if (L.A.on && !call.startedAt) call.startedAt = Date.now();
      C.saveSoon();
      paintLive();
    }
    function assist(o) {
      if (L.A.on || L.A.starting) return;
      R.err = ''; R.errKind = '';
      if (!aiHas('jobAnswer')) { R.err = OLD_AI; R.errKind = 'old'; paintLive(); return; }
      if (!aiReady()) { R.err = NO_KEY_START; R.errKind = 'key'; paintLive(); return; }
      warmAI();
      startListen();
      if ((!o || o.float !== false) && desk && !R.float && (L.A.starting || L.A.on)) openFloat();
    }
    async function endCall() {
      if (R.ending) return;
      R.ending = true;
      try {
        closeFloat();
        if (L.A.on || L.A.starting) await L.stop({ drainMs: 0 });
        if (R.busy && R.item && !R.item.text && !R.item.error) R.item.error = 'Réponse interrompue (fin de l’entretien).';
        if (R.ctrl) R.ctrl.abort();
        Object.assign(R, { req: null, ctrl: null, busy: false, partial: '', mode: '' });
        call.endedAt = Date.now();
        C.saveNow();
        paintLive(); paintHist();
        const b = $('[data-b="end"]', root);
        if (b) b.outerHTML = endBtn(true);
      } finally { R.ending = false; }
    }

    // 760 × 420 : sur l'écran 1536 × 830, la fenêtre tient sous la caméra (moitié de la largeur,
    // moitié de la hauteur) et laisse voir le recruteur ; une réponse de 90 mots y reste lisible à 60-70 cm.
    const FLOAT_W = 760, FLOAT_H = 420;
    function toggleFloat() {
      if (R.floatPending) return;
      if (R.float) { closeFloat(); paintLive(); return; }
      if (!L.A.on) { toast('Lancez d’abord le souffleur : la fenêtre flottante suit l’entretien en direct.', 'info'); return; }
      openFloat();
    }
    function openFloat() {
      if (R.floatPending) return;
      R.floatPending = true;
      const done = () => { R.floatPending = false; };
      const pip = window.documentPictureInPicture;
      let req = null;
      if (pip && typeof pip.requestWindow === 'function') { try { req = pip.requestWindow({ width: FLOAT_W, height: FLOAT_H }); } catch (e) { req = null; } }
      if (req) { paintLive(); req.then((w) => { done(); setupFloat(w); }, () => { done(); floatPopup(); }); }
      else { done(); floatPopup(); }
    }
    function floatPopup() {
      let w = null;
      // Pop-up de secours : placée d'office en haut au centre de l'écran, juste sous la caméra.
      const sc = window.screen || {};
      const left = Math.max(0, Math.round((sc.availLeft || 0) + ((sc.availWidth || FLOAT_W) - FLOAT_W) / 2));
      const top = Math.max(0, Math.round(sc.availTop || 0));
      try { w = window.open('', 'aidevisio-appel', `popup=yes,width=${FLOAT_W},height=${FLOAT_H + 40},left=${left},top=${top}`); } catch (e) { w = null; }
      if (!w) { toast(/AideVisioAndroid/.test(navigator.userAgent) ? 'Fenêtre flottante indisponible dans l’appli Android : utilisez Chrome ou Edge sur un PC.' : 'Fenêtre flottante bloquée : autorisez les fenêtres pop-up pour ce site, ou utilisez Chrome ou Edge récent.', 'warn', { duration: 9000 }); return; }
      try {
        w.document.open();
        w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aide Visio</title></head><body></body></html>');
        w.document.close();
      } catch (e) {  }
      setupFloat(w);
    }
    function setupFloat(w) {
      if (!C.alive || !(L.A.on || L.A.starting)) { try { w.close(); } catch (e) {  } return; }
      const doc = w.document;
      try { doc.title = 'Aide Visio'; } catch (e) {  }
      copyStylesTo(doc);
      doc.documentElement.lang = 'fr';
      // Sous-titres : toujours sur fond sombre, quel que soit le thème de l'appli.
      doc.documentElement.dataset.theme = 'dark';
      const scale = document.documentElement.style.getPropertyValue('--font-scale');
      if (scale) doc.documentElement.style.setProperty('--font-scale', scale);
      doc.body.className = 'pip-body ex-float-body lv-float-body';
      doc.body.innerHTML = '<div class="ex-float lv-float"><section class="ex-live lv-stage lv-fit" data-b="float" data-theme="dark"></section></div>';
      R.float = { win: w, box: doc.querySelector('[data-b="float"]') };
      doc.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) onAct(b.dataset.act); });
      // Mêmes raccourcis que la page (Échap et F n'ont pas de sens dans la fenêtre).
      doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' || (e.key || '').toLowerCase() === 'f') return; callKey(e); });
      let t = 0;
      w.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { if (R.float && R.float.win === w) { delete R.float.box.dataset.fitPx; fitAns(R.float.box); } }, 60); });
      const gone = () => { if (R.float && R.float.win === w) { dropRaf(); R.float = null; if (C.alive) paintLive(); } };
      w.addEventListener('pagehide', gone);
      w.addEventListener('unload', gone);
      paintLive();
    }
    function closeFloat() {
      const f = R.float;
      if (!f) return;
      dropRaf();
      R.float = null;
      try { f.win.close(); } catch (e) {  }
    }
    function toggleFull() {
      const box = $('[data-b="live"]', root);
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
      if (!box || !box.requestFullscreen) { toast('Plein écran indisponible dans ce navigateur.', 'warn'); return; }
      box.requestFullscreen().catch(() => toast('Plein écran indisponible dans ce navigateur.', 'warn'));
    }
    const onFs = () => { if (!C.alive) return; const b = $('[data-b="live"]', root); if (b) delete b.dataset.fitPx; paintLive(); };
    document.addEventListener('fullscreenchange', onFs);
    // Échap sort du plein écran (Chrome le fait déjà ; filet si le focus est dans un champ).
    const onKey = (e) => { if (e.key === 'Escape' && isFull()) document.exitFullscreen().catch(() => {}); };
    document.addEventListener('keydown', onKey);
    let fitT = 0;
    const onResize = () => { clearTimeout(fitT); fitT = setTimeout(() => { if (!C.alive) return; const b = $('[data-b="live"]', root); if (b) { delete b.dataset.fitPx; fitAns(b); } }, 80); };
    window.addEventListener('resize', onResize);
    // Retour sur la page : rattrape ce qui n'a pas été peint pendant qu'elle était cachée.
    const onVis = () => { if (!document.hidden && C.alive) paintLive(); };
    document.addEventListener('visibilitychange', onVis);
    // Retour du réseau : relance la dernière réponse perdue par la coupure.
    const onOnline = () => { if (!C.alive || R.busy || !L.A.on || call.endedAt) return; const a = shown(); if (a && a.error && a.errNet && !a.text) ask(a.question, { item: a }); };
    window.addEventListener('online', onOnline);
    function askNow() {
      // Repli : jamais une parole du candidat ; en « mixed », la dernière phrase qui n'est pas une lecture de la réponse.
      const lastHeard = call.turns.slice().reverse().find((x) => x.who === 'jury' || (x.who === 'mixed' && !readsAnswer(x.text)));
      const t = (L.A.interim || '').trim() || (R.jury.length ? R.jury.map((x) => x.text).reduce(glue) : str(lastHeard && lastHeard.text));
      if (!t) return;
      // Déjà traité : la question est la dernière, ou sa fin (question recollée A + B).
      const done = (q) => { const a = nz(q), b = nz(t); return !!b && (a === b || a.endsWith(' ' + b)); };
      if (R.busy && R.item && done(R.item.question)) return;
      const last = call.answers[call.answers.length - 1];
      if (!L.A.interim && !R.jury.length && last && last.text && done(last.question)) return;
      L.A.interim = '';
      ask(t, { force: true });
    }
    // Raccourcis : Espace répond, C plus court, R nouvelle réponse, F plein écran, P fenêtre flottante.
    function callKey(e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const k = (e.key || '').toLowerCase();
      if (k === ' ' && e.target.closest && e.target.closest('button, [role=radio], summary, a')) return;
      const act = k === ' ' ? 'ask-now' : k === 'c' ? 'shorter' : k === 'r' ? 'retry' : k === 'f' ? 'full' : k === 'p' ? 'float' : '';
      if (!act) return;
      if (act === 'ask-now' && !L.A.on) return;
      if ((act === 'full' && !canFull()) || (act === 'float' && !desk)) return;
      if ((act === 'shorter' || act === 'retry') && !shown()) return;
      e.preventDefault();
      onAct(act);
    }
    // Son de l'appel : coupures et reprises (Son du PC, micro coupé, onglet muet…) affichées dans les aides.
    const WARN_OFF = /_BACK$|_RESUMED$|^ONLINE$/;
    const offInfo = S.audio && S.audio.on ? S.audio.on('info', (ev) => {
      if (!ev || !C.alive || !L.A.on) return;
      const code = str(ev.code);
      const msg = str(ev.message) || (S.audio.message && S.audio.message(code)) || '';
      if (WARN_OFF.test(code)) { if (R.warn) { R.warn = ''; R.warnWho = ''; paintLive(); } return; }
      if (!/^warn/.test(str(ev.kind)) || !msg) return;
      R.warn = msg; R.warnWho = str(ev.who);
      paintLive();
    }) : null;

    function onAct(act) {
      if (act === 'assist') assist();
      else if (act === 'listen-start') assist({ float: false });
      else if (act === 'listen-stop') { closeFloat(); L.stop(); }
      else if (act === 'ask-now') askNow();
      else if (act === 'shorter' || act === 'retry') {
        const a = shown();
        if (!a) return;
        if (R.busy && R.item === a && R.mode === act) return;
        ask(a.question, { item: a, shorter: act === 'shorter' });
      }
      else if (act === 'float') toggleFloat();
      else if (act === 'full') toggleFull();
      else if (act === 'reload') location.reload();
      else if (act === 'import-subject') dossierSheet({ title: s.subject.title, text: s.job.text }, (d) => {
        s.subject.title = d.title; s.job.text = d.text; C.saveNow();
        const el = $('.ex-call-subject', root);
        if (el) el.outerHTML = subjectCard();
        const sub = $('.ex-topbar .ex-tb-title small', root);
        if (sub) sub.textContent = s.subject.title;
      });
      else if (act === 'settings') go('#/settings');
      else if (act === 'use-mic') { L.A.preset = 'haut-parleur'; setPrefs({ jobListenPreset: L.A.preset }); C.paintListen(); assist(); }
      else if (act === 'pick-src') {
        const card = $('[data-b="listen-card"]', root);
        if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); const o = $('.ex-src-opt.on, .ex-src-opt', card); if (o) o.focus({ preventScroll: true }); }
      }
      else if (act === 'export') downloadText(exportCallMd(s), `entretien-${s.createdAt.slice(0, 10)}.md`);
      else if (act === 'end') endCall();
    }
    root.addEventListener('click', (e) => {
      const src = e.target.closest('[data-src]');
      if (src && !src.disabled) { L.A.preset = src.dataset.src; setPrefs({ jobListenPreset: L.A.preset }); C.paintListen(); return; }
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) onAct(b.dataset.act);
    });

    C.paintListen();
    paintHist();
    L.probe();
    setCurrent({
      get wantsWake() { return L.A.on || L.A.starting; },
      key: callKey,
      flush() { C.saveNow(); },
      busy() { return L.A.on || L.A.starting; },
      async canLeave() {
        if (!L.A.on && !L.A.starting) return true;
        return confirmSheet({ title: 'Quitter l’entretien ?', text: 'Le souffleur écoute encore : il sera arrêté. Questions et réponses restent enregistrées.', okLabel: 'Quitter', cancelLabel: 'Rester' });
      },
      leave() {
        C.alive = false;
        document.removeEventListener('fullscreenchange', onFs);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('resize', onResize);
        window.removeEventListener('online', onOnline);
        clearTimeout(fitT);
        if (offInfo) { try { offInfo(); } catch (e) {  } }
        if (isFull()) document.exitFullscreen().catch(() => {});
        if (R.busy && R.item && !R.item.text && !R.item.error) R.item.error = 'Réponse interrompue (fin de l’entretien).';
        if (R.ctrl) R.ctrl.abort();
        dropRaf();
        closeFloat();
        C.saveNow();
        return L.stop({ drainMs: 0 });
      }
    });
  }

  function def(render) {
    return {
      async render(root, params) {
        await leaveCurrent();
        root.classList.add('ex-route');
        return render(root, params || {});
      },
      canLeave(target) { return CUR && CUR.canLeave ? CUR.canLeave(target) : true; },
      leave() { return leaveCurrent(); }
    };
  }
  function notFoundHTML() {
    return `<div class="screen"><div class="empty empty-page card"><div class="empty-ic">${icon('info')}</div><h1 class="h2">Séance introuvable</h1><p class="muted">Elle a peut-être été supprimée.</p><div class="row center"><button type="button" class="btn btn-primary" data-go="#/">${icon('home')}<span>Accueil</span></button></div></div></div>`;
  }
  const jobDef = def((root, p) => {
    if (!p.id || p.id === 'new') return renderJobStart(root);
    const s = store.get(p.id);
    if (!s) { root.innerHTML = notFoundHTML(); setCurrent({}); return; }
    renderCall(root, fixSession(s));
  });

  S.exam = Object.assign(S.exam || {}, {
    defs: { entretien: jobDef, historique: def(renderHistory) }
  });

  function registerAll() {
    if (!S.app || !S.app.register) return false;
    S.app.register('', def(renderHome));
    Object.keys(S.exam.defs).forEach((k) => S.app.register(k, S.exam.defs[k]));
    return true;
  }
  if (!registerAll()) document.addEventListener('DOMContentLoaded', registerAll, { once: true });

  const flushCurrent = () => { try { if (CUR && CUR.flush) CUR.flush(); } catch (e) {  } };
  window.addEventListener('pagehide', flushCurrent);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCurrent(); });

  window.addEventListener('beforeunload', (e) => {
    let busy = false;
    try { busy = !!(CUR && CUR.busy && CUR.busy()); } catch (er) { busy = false; }
    if (busy) { flushCurrent(); e.preventDefault(); e.returnValue = ''; }
  });
})(window.AideVisio = window.AideVisio || {});
