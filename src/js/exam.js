(function (S) {
  'use strict';

  const UI = () => S.ui || {};
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const md = (s) => (S.util && S.util.md ? S.util.md(String(s == null ? '' : s)) : esc(s).replace(/\n/g, '<br>'));
  const icon = (n, cls) => (UI().icon ? UI().icon(n, cls) : '');
  const uid = () => (S.util && S.util.uid ? S.util.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pad2 = (n) => String(n).padStart(2, '0');
  const nowIso = () => new Date().toISOString();
  const errMsg = (e) => (e && (e.userMessage || e.message)) || String(e || 'Erreur inconnue');
  const isAbort = (e) => !!e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')));
  const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const fmtNum = (n) => String(round1(n)).replace('.', ',');
  const arr = (x) => (Array.isArray(x) ? x : []);
  const str = (x) => (x == null ? '' : String(x));
  const NB = ' ';

  function fmtClock(ms) {
    const neg = ms < 0;
    const s = Math.floor(Math.abs(ms || 0) / 1000);
    return (neg ? '+' : '') + pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }
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
  async function copyText(text, label) {
    let ok = false;
    if (UI().copy) ok = await UI().copy(text);
    else { try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { ok = false; } }
    toast(ok ? `${label || 'Texte'} copié.` : 'Copie impossible : sélectionnez le texte à la main.', ok ? 'ok' : 'err');
    return ok;
  }
  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    if (UI().download) UI().download(blob, filename);
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); }
    toast('Fichier « ' + filename + ' » téléchargé.', 'ok');
  }
  function settings() { try { return (S.store && S.store.settings && S.store.settings()) || {}; } catch (e) { return {}; } }

  const aiReady = () => { try { return !!(S.examAI && S.examAI.ready && S.examAI.ready()); } catch (e) { return false; } };
  const aiHas = (fn) => !!(S.examAI && typeof S.examAI[fn] === 'function');
  // Clé refusée par le fournisseur : on retient une empreinte des clés (jamais les clés) pour ne plus appeler l'IA tant qu'elles n'ont pas changé.
  function keySig() {
    const st = settings();
    const t = ['openaiKey', 'geminiKey', 'claudeKey', 'groqKey'].map((k) => str(st[k])).join('|');
    let hsh = 5381;
    for (let i = 0; i < t.length; i++) hsh = ((hsh * 33) ^ t.charCodeAt(i)) >>> 0;
    return hsh.toString(36);
  }
  const keyRefused = () => { const r = prefs().keyRefused; return !!r && r === keySig(); };
  const markKeyRefused = () => setPrefs({ keyRefused: keySig() });
  const aiOn = () => aiReady() && !keyRefused();
  function noAI(what) {
    toast(`${what || 'Cette fonction'} demande une clé IA (Réglages). Le reste marche sans.`, 'warn', { duration: 7000, action: { label: 'Réglages', onClick: () => go('#/settings') } });
  }

  const PREFS_KEY = 'aidevisio.exam.prefs';
  function prefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function setPrefs(patch) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(Object.assign(prefs(), patch))); } catch (e) {  } }
  const isMobileDevice = () => { try { return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches); } catch (e) { return false; } };

  const TEAMS_KEY = 'aidevisio.exam.teams';
  const LINK_BAD = 'Lien invalide : collez un lien Teams (teams.microsoft.com, teams.live.com, aka.ms) ou Meet (meet.google.com).';
  const LINK_HINT = 'Collez le lien reçu : Teams (teams.microsoft.com, teams.live.com, aka.ms) ou Meet (meet.google.com).';
  function teamsClean(v) {
    let t = str(v).trim();
    const m = t.match(/https:\/\/[^\s<>"']+/i);
    if (m) t = m[0];
    return t.replace(/[.,;)\]]+$/, '');
  }
  const isMeet = (t) => /^https:\/\/(meet\.google\.com\/[a-z0-9-]+\/?(\?[^\s#]*)?|g\.co\/meet\/[a-z0-9-]+\/?)$/i.test(t);
  function teamsValid(v) {
    const t = teamsClean(v);
    return /^https:\/\/([a-z0-9-]+\.)*(teams\.microsoft\.com|teams\.live\.com|teams\.cloud\.microsoft|aka\.ms)(\/|$)/i.test(t) || isMeet(t) ? t : '';
  }
  const meetingApp = (v) => (isMeet(teamsClean(v)) ? 'Meet' : 'Teams');
  function lastTeams() { try { return localStorage.getItem(TEAMS_KEY) || ''; } catch (e) { return ''; } }
  function rememberTeams(link) { try { if (link) localStorage.setItem(TEAMS_KEY, link); } catch (e) {  } }
  function openTeams(link) {
    const t = teamsValid(link);
    if (!t) { toast(LINK_BAD, 'warn', { duration: 7000 }); return false; }
    window.open(t, '_blank', 'noopener');
    return true;
  }
  function teamsMessage(link, dateText) {
    return [
      'Bonjour Audrey,',
      '',
      `Voici le lien ${meetingApp(link) === 'Meet' ? 'Google Meet' : 'Teams'} de notre oral blanc d’anglais (UE 218)${dateText ? ' ' + dateText : ''} :`,
      link,
      '',
      'Consignes, comme le jour J :',
      '- caméra allumée et micro testé avant de commencer ;',
      '- des feuilles blanches et un stylo, rien d’autre ;',
      '- aucun document, dictionnaire ni traducteur ;',
      '- la préparation (1 h) commence quand je partage le sujet à l’écran ;',
      '- ensuite : 15 min d’exposé, puis 15 min d’entretien.',
      '',
      'À tout à l’heure !'
    ].join('\n');
  }
  function teamsFieldHTML(link, o) {
    o = o || {};
    const v = link || '';
    return `<div class="ex-teams${v && teamsValid(v) ? ' is-set' : ''}" data-b="teams">
      <label class="label" for="${o.id || 'ex-teams-link'}">${icon('video', 'ico-inline')} ${esc(o.label || 'Lien de la réunion (Teams ou Meet)')}</label>
      <div class="ex-teams-row">
        <input id="${o.id || 'ex-teams-link'}" class="input" type="url" inputmode="url" autocomplete="off" spellcheck="false" data-f="teams" value="${esc(v)}" placeholder="https://teams.microsoft.com/… ou https://meet.google.com/…" aria-describedby="${o.id || 'ex-teams-link'}-hint">
        <button type="button" class="btn${o.primary ? ' btn-primary' : ''}" data-act="teams-join">${icon('video')}<span>${esc(o.joinLabel || 'Rejoindre')}</span></button>
        ${o.copy ? `<button type="button" class="btn" data-act="teams-copy">${icon('copy')}<span>Copier pour Audrey</span></button>` : ''}
      </div>
      <small class="muted" id="${o.id || 'ex-teams-link'}-hint" data-b="teams-hint">${esc(o.hint || LINK_HINT)}</small>
    </div>`;
  }

  const THEMES = [
    { id: 1, title: 'Finance', fr: 'Finance' },
    { id: 2, title: 'Accounting & auditing', fr: 'Comptabilité et audit' },
    { id: 3, title: 'Governance & CSR', fr: 'Gouvernance et RSE' },
    { id: 4, title: 'Information systems & new technologies', fr: 'SI et nouvelles technologies' },
    { id: 5, title: 'Management, HR & strategy', fr: 'Management, RH et stratégie' },
    { id: 6, title: 'Production', fr: 'Production' },
    { id: 7, title: 'Marketing', fr: 'Marketing' }
  ];
  const THEME_HUE = { 1: 214, 2: 262, 3: 150, 4: 192, 5: 28, 6: 336, 7: 296 };
  const fiches = () => (S.examFiches && typeof S.examFiches === 'object' ? S.examFiches : {});
  function themeOf(id) {
    const n = Number(id);
    const base = THEMES.find((t) => t.id === n);
    const f = arr(fiches().themes).find((t) => Number(t.id) === n);
    return base || f ? Object.assign({ id: n }, base || {}, f ? { title: f.title || (base && base.title), fr: f.fr || (base && base.fr) } : {}) : null;
  }
  const themeChip = (id, cls) => {
    const t = themeOf(id);
    if (!t) return '';
    return `<span class="ex-theme ${cls || ''}" style="--hue:${THEME_HUE[t.id] || 214}" title="${esc(t.fr || t.title)}"><b>${t.id}</b><span class="ex-theme-l">${esc(t.fr || t.title)}</span></span>`;
  };

  function examInfo() {
    const e = fiches().exam || {};
    return {
      format: arr(e.format).length ? e.format : [
        { label: 'Préparation', minutes: 60, detail: 'Sans dictionnaire ni autre document que le sujet.' },
        { label: 'Exposé', minutes: 15, detail: 'Introduction, synthèse, problématique, commentaire, conclusion.' },
        { label: 'Entretien', minutes: 15, detail: 'Questions du jury : comprendre, préciser, ouvrir.' }
      ]
    };
  }

  function normSubject(x) {
    if (!x || typeof x !== 'object') return null;
    const s = Object.assign({}, x);
    s.id = str(s.id) || 'sujet-' + uid();
    s.theme = Number(s.theme) || null;
    s.themeTitle = s.themeTitle || ((themeOf(s.theme) || {}).title || '');
    s.title = str(s.title).trim() || 'Untitled article';
    s.paragraphs = arr(s.paragraphs).map(str).map((p) => p.trim()).filter(Boolean);
    if (!s.paragraphs.length && s.text) s.paragraphs = str(s.text).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    s.glossary = arr(s.glossary).filter((g) => g && g.en);
    s.question = str(s.question).trim();
    s.source = str(s.source);
    s.date = str(s.date);
    s.corrige = s.corrige && typeof s.corrige === 'object' ? s.corrige : {};
    return s;
  }
  const subjectWords = (s) => words(arr(s && s.paragraphs).join(' '));

  function subjectPlain(s) {
    const out = [s.title, [s.source, s.date].filter(Boolean).join(' — '), ''];
    arr(s.paragraphs).forEach((p, i) => out.push(`[${i + 1}] ${p}`, ''));
    if (arr(s.glossary).length) {
      out.push('Notes:');
      s.glossary.forEach((g, i) => out.push(`(${i + 1}) ${g.en}: ${g.fr || ''}`));
      out.push('');
    }
    out.push('QUESTION: ' + (s.question || '—'));
    return out.join('\n');
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
    if (!Array.isArray(d.customSubjects)) d.customSubjects = [];
    cache = d;
    return d;
  }
  window.addEventListener('storage', (e) => { if (e.key === KEY) cache = null; });
  const stamp = (s) => String(s.updatedAt || s.createdAt || '');
  function trimForQuota(d, level) {
    const old = d.sessions.slice().sort((a, b) => stamp(a).localeCompare(stamp(b)));
    if (level === 0) {
      old.slice(0, Math.max(1, Math.floor(old.length / 2))).forEach((s) => {
        if (s.expose) s.expose.transcript = arr(s.expose.transcript).slice(-40);
        if (s.interview) s.interview.turns = arr(s.interview.turns).slice(-30);
        if (s.call) { s.call.turns = arr(s.call.turns).slice(-60); s.call.answers = arr(s.call.answers).slice(-30); }
      });
      return true;
    }
    const victim = old.find((s) => s.phase === 'done') || old[0];
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
        if (lost > 0) toast(`Stockage presque plein : ${lost} ancienne${lost > 1 ? 's' : ''} séance${lost > 1 ? 's' : ''} supprimée${lost > 1 ? 's' : ''} pour faire de la place. Exportez vos bilans importants (.md).`, 'warn', { duration: 9000 });
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
  const store = {
    list() { return load().sessions.slice().sort((a, b) => stamp(b).localeCompare(stamp(a))); },
    get(id) { return load().sessions.find((s) => s.id === id) || null; },
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
    remove(id) { const d = load(); d.sessions = d.sessions.filter((s) => s.id !== id); persist(d); },
    subjects() {
      const seen = new Set();
      const out = [];
      arr(S.examSubjects).concat(load().customSubjects).forEach((x) => {
        const s = normSubject(x);
        if (!s || seen.has(s.id) || !s.paragraphs.length) return;
        seen.add(s.id);
        out.push(s);
      });
      return out;
    },
    getSubject(id) {
      const s = store.subjects().find((x) => x.id === id);
      if (s) return s;
      const sess = load().sessions.find((x) => x.subject && x.subject.id === id);
      return sess ? normSubject(sess.subject) : null;
    },
    isCustom(id) { return load().customSubjects.some((s) => s && s.id === id); },
    addSubject(subject) {
      const s = normSubject(subject);
      if (!s) throw new Error('Sujet invalide.');
      s.custom = true;
      s.addedAt = s.addedAt || nowIso();
      const d = load();
      d.customSubjects = d.customSubjects.filter((x) => x && x.id !== s.id);
      d.customSubjects.unshift(s);
      persist(d);
      return s;
    },
    removeSubject(id) { const d = load(); d.customSubjects = d.customSubjects.filter((x) => x && x.id !== id); persist(d); }
  };
  S.examStore = store;

  function newSession(kind, subject) {
    const s = normSubject(subject);
    return {
      id: 'ex-' + uid(), kind, subjectId: s.id, subject: s, createdAt: nowIso(), updatedAt: nowIso(),
      phase: 'prep',
      teamsLink: kind === 'jury' ? teamsValid(lastTeams()) : kind === 'call' ? teamsValid(prefs().studentTeams || '') : '',
      prep: { startedAt: null, endedAt: null, durMin: 60, notes: kind === 'solo' ? {} : '', strict: true },
      expose: { startedAt: null, endedAt: null, transcript: [], checklist: {}, checklistAuto: {}, errors: [], juryNotes: '', tips: [] },
      interview: { startedAt: null, endedAt: null, turns: [], asked: [], skipped: [], current: null, target: 6, modelAnswers: [] },
      call: kind === 'call' ? { turns: [], answers: [], startedAt: null, endedAt: null } : undefined,
      evaluation: null,
      alarms: {}
    };
  }
  function fixSession(s) {
    s.subject = normSubject(s.subject) || normSubject({ id: s.subjectId, title: 'Sujet', paragraphs: ['—'] });
    s.prep = Object.assign({ startedAt: null, endedAt: null, durMin: 60, notes: s.kind === 'solo' ? {} : '', strict: true }, s.prep || {});
    s.expose = Object.assign({ startedAt: null, endedAt: null, transcript: [], checklist: {}, checklistAuto: {}, errors: [], juryNotes: '', tips: [] }, s.expose || {});
    s.interview = Object.assign({ startedAt: null, endedAt: null, turns: [], asked: [], skipped: [], current: null, target: 6 }, s.interview || {});
    s.interview.modelAnswers = arr(s.interview.modelAnswers);
    if (s.kind === 'call') {
      s.call = Object.assign({ startedAt: null, endedAt: null }, s.call || {});
      s.call.turns = arr(s.call.turns);
      s.call.answers = arr(s.call.answers).filter((a) => a && a.id);
    }
    s.alarms = s.alarms || {};
    s.teamsLink = str(s.teamsLink);
    if (!['prep', 'expose', 'interview', 'review', 'done'].includes(s.phase)) s.phase = 'prep';
    return s;
  }
  const KIND_HASH = { jury: '#/oral/', solo: '#/eleve/', call: '#/appel/' };
  const sessionHash = (s) => (KIND_HASH[s.kind] || '#/eleve/') + s.id;
  const kindLabel = (s) => (s.kind === 'jury' ? 'Jury' : s.kind === 'call' ? 'Sur Teams' : 'Avec l’IA');
  function callCountLabel(s) {
    const n = arr(s.call && s.call.answers).filter((a) => !a.skipped).length;
    return n ? `${n} question${n > 1 ? 's' : ''}` : s.call && s.call.endedAt ? 'Terminé' : 'En cours';
  }
  const exposeText = (s) => arr(s.expose.transcript).map((x) => x.text).join(' ').trim();
  function durations(s) {
    const d = (a, b) => (a ? Math.max(0, (b || Date.now()) - a) : 0);
    return {
      prepMs: d(s.prep.startedAt, s.prep.endedAt || s.expose.startedAt),
      exposeMs: d(s.expose.startedAt, s.expose.endedAt || (s.phase !== 'expose' ? s.interview.startedAt : null)),
      interviewMs: d(s.interview.startedAt, s.interview.endedAt)
    };
  }

  const tickFns = new Set();
  let tickTimer = 0;
  function onTick(fn) {
    tickFns.add(fn);
    if (!tickTimer) tickTimer = setInterval(() => tickFns.forEach((f) => { try { f(); } catch (e) { console.warn('[examen] tick', e); } }), 1000);
    return () => { tickFns.delete(fn); if (!tickFns.size && tickTimer) { clearInterval(tickTimer); tickTimer = 0; } };
  }
  let chimeCtx = null;
  function chime(kind) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        chimeCtx = chimeCtx || new AC();
        const ctx = chimeCtx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const notes = kind === 'end' ? [784, 659, 523] : [880, 698];
        notes.forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          const t = ctx.currentTime + 0.02 + i * 0.3;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
          o.connect(g); g.connect(ctx.destination);
          o.start(t); o.stop(t + 0.75);
        });
      }
    } catch (e) {  }
    try { if (navigator.vibrate) navigator.vibrate(kind === 'end' ? [180, 90, 180, 90, 180] : [120, 80, 120]); } catch (e) {  }
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

  let voicesP = null;
  function loadVoices() {
    if (voicesP) return voicesP;
    voicesP = new Promise((resolve) => {
      const sy = window.speechSynthesis;
      if (!sy) { resolve([]); return; }
      const v = sy.getVoices();
      if (v && v.length) { resolve(v); return; }
      let done = false;
      const fin = () => { if (done) return; done = true; resolve(sy.getVoices() || []); };
      try { sy.addEventListener('voiceschanged', fin, { once: true }); } catch (e) { sy.onvoiceschanged = fin; }
      setTimeout(fin, 1500);
    }).then((v) => { if (!v.length) voicesP = null; return v; });
    return voicesP;
  }
  async function enVoice() {
    if (S.devices && S.devices.voice) { try { const v = await S.devices.voice(); if (v) return v; } catch (e) {  } }
    const vs = (await loadVoices()).filter((v) => /^en/i.test(v.lang || ''));
    const rank = (v) => (/en[-_]GB/i.test(v.lang) ? 0 : /en[-_](IE|AU)/i.test(v.lang) ? 2 : 4) + (/natural|neural|online/i.test(v.name) ? 0 : /google/i.test(v.name) ? 0.5 : 1);
    return vs.sort((a, b) => rank(a) - rank(b))[0] || null;
  }
  const canSpeak = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  async function speakEn(text, o) {
    o = o || {};
    if (!text) return false;
    if (!canSpeak()) { toast('Lecture à voix haute indisponible sur ce navigateur.', 'warn'); return false; }
    const v = await enVoice();
    const sy = window.speechSynthesis;
    try { sy.cancel(); } catch (e) {  }
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = v ? v.lang : 'en-GB';
      if (v) u.voice = v;
      u.rate = o.rate || Number(prefs().rate) || 1;
      let done = false;
      const fin = (ok) => { if (!done) { done = true; clearTimeout(g); resolve(ok); } };
      const g = setTimeout(() => fin(true), 5000 + text.length * 110 / u.rate);
      u.onend = () => fin(true);
      u.onerror = () => fin(false);
      try { sy.speak(u); } catch (e) { fin(false); }
    });
  }
  function stopSpeak() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {  } }
  const sayBtn = (text, cls) => (text ? `<button type="button" class="icon-btn icon-btn-sm ex-say ${cls || ''}" data-say="${esc(text)}" aria-label="Écouter : ${esc(str(text).slice(0, 80))}" title="Écouter (voix anglaise)">${icon('speaker')}</button>` : '');
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-say]');
    if (!b) return;
    e.preventDefault();
    speakEn(b.dataset.say, { rate: b.dataset.rate ? Number(b.dataset.rate) : undefined });
  });

  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  function createRecognizer(o) {
    const Ctor = SR();
    if (!Ctor) return null;
    let rec = null, active = false, timer = 0, backoff = 250, finals = '', lastInterim = '';
    const join = (a, b) => [a, b].map((x) => str(x).trim()).filter(Boolean).join(' ');
    function schedule() { clearTimeout(timer); timer = setTimeout(spawn, backoff); backoff = Math.min(backoff * 2, 4000); }
    function spawn() {
      if (!active) return;
      const r = new Ctor();
      const t0 = Date.now();
      rec = r;
      r.lang = o.lang || 'en-GB';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        if (rec !== r) return;
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const tx = res && res[0] ? res[0].transcript : '';
          if (res.isFinal) finals = join(finals, tx); else interim += tx;
        }
        backoff = 250;
        lastInterim = interim.trim();
        o.onText(finals, lastInterim);
      };
      r.onerror = (e) => {
        if (rec !== r) return;
        const code = e && e.error;
        if (/not-allowed|service-not-allowed|audio-capture|language-not-supported/.test(code || '')) {
          active = false; clearTimeout(timer);
          if (o.onFatal) o.onFatal(code);
        }
      };
      r.onend = () => { if (rec !== r || !active) return; if (Date.now() - t0 > 3000) backoff = 250; schedule(); };
      try { r.start(); } catch (err) { if (active) schedule(); }
    }
    return {
      start(initial) { active = true; finals = str(initial).trim(); lastInterim = ''; backoff = 250; spawn(); },
      stop() {
        active = false; clearTimeout(timer); const r = rec; rec = null;
        if (r) { try { r.stop(); } catch (e) {  } }
        // Le final envoyé à l'arrêt est ignoré : on garde l'interim en cours.
        if (lastInterim) finals = join(finals, lastInterim);
        lastInterim = '';
        return finals;
      },
      text() { return finals; }
    };
  }

  const CHECKS = [
    ['intro', 'Introduction'], ['source', 'Source & date'], ['tone', 'Ton'], ['summary', 'Synthèse'],
    ['transition', 'Transition'], ['problematic', 'Problématique'], ['plan', 'Plan annoncé'], ['news', 'Actualité'], ['conclusion', 'Conclusion']
  ];
  const CRITERIA = [
    { id: 'synthesis', label: 'Synthèse', max: 4 },
    { id: 'structure', label: 'Problématique & structure', max: 4 },
    { id: 'commentary', label: 'Commentaire argumenté & actualité', max: 4 },
    { id: 'interaction', label: 'Entretien & interaction', max: 3 },
    { id: 'language', label: 'Langue (grammaire, vocabulaire)', max: 3 },
    { id: 'fluency', label: 'Aisance & durée', max: 2 }
  ];
  const ZONES = [
    { id: 'intro', label: 'Intro', from: 0, to: 1.5 },
    { id: 'summary', label: 'Synthèse', from: 1.5, to: 5.5 },
    { id: 'transition', label: 'Problématique', from: 5.5, to: 6.5 },
    { id: 'comment', label: 'Commentaire', from: 6.5, to: 13.5 },
    { id: 'conclusion', label: 'Conclusion', from: 13.5, to: 15 }
  ];
  const DURATIONS = [60, 45, 30, 20, 10];
  const SOLO_DURATIONS = [60, 30];
  const NOTE_FIELDS = [
    { id: 'intro', label: 'Introduction', hint: 'Source, date, thème, ton (rédigé)', written: true },
    { id: 'summary', label: 'Synthèse', hint: 'Idées clés de l’auteur, en mots-clés' },
    { id: 'transition', label: 'Transition', hint: 'Phrase de transition (rédigée)', written: true },
    { id: 'problematic', label: 'Problématique', hint: 'Tirée de la question' },
    { id: 'axis1', label: 'Axe 1', hint: 'Idée + arguments + exemple' },
    { id: 'axis2', label: 'Axe 2', hint: 'Idée + arguments + exemple' },
    { id: 'axis3', label: 'Axe 3 (facultatif)', hint: 'Nuance, limite, ouverture' },
    { id: 'conclusion', label: 'Conclusion', hint: 'Réponse + ouverture (rédigée)', written: true }
  ];
  const GENERIC = {
    next: [
      { en: 'Could you briefly sum up the main idea of the article in your own words?', fr: 'Pouvez-vous résumer l’idée principale avec vos mots ?' },
      { en: 'What is the author’s point of view, in your opinion?', fr: 'Quel est le point de vue de l’auteur selon vous ?' },
      { en: 'Which argument of the article did you find the most convincing, and why?', fr: 'Quel argument vous a semblé le plus convaincant, et pourquoi ?' },
      { en: 'Who are the main stakeholders affected by this issue?', fr: 'Quelles sont les principales parties prenantes concernées ?' },
      { en: 'How does this issue affect companies in France?', fr: 'Comment ce sujet touche-t-il les entreprises en France ?' }
    ],
    deeper: [
      { en: 'Could you develop that point a little further?', fr: 'Pouvez-vous développer ce point ?' },
      { en: 'Can you give us a concrete example to illustrate that?', fr: 'Pouvez-vous donner un exemple concret ?' },
      { en: 'Why do you think that is the case?', fr: 'Pourquoi, selon vous ?' }
    ],
    news: [
      { en: 'Can you think of a recent event in the news that illustrates this issue?', fr: 'Voyez-vous un fait d’actualité récent qui illustre ce sujet ?' },
      { en: 'Has anything changed on this topic over the past year?', fr: 'Qu’est-ce qui a changé sur ce sujet depuis un an ?' }
    ],
    easier: [
      { en: 'In a few words, what is the article about?', fr: 'En quelques mots, de quoi parle l’article ?' },
      { en: 'Where and when was this article published?', fr: 'Où et quand cet article a-t-il été publié ?' },
      { en: 'What does the last paragraph say?', fr: 'Que dit le dernier paragraphe ?' }
    ],
    opinion: [
      { en: 'What is your personal opinion on this issue?', fr: 'Quel est votre avis personnel ?' },
      { en: 'Do you agree with the author? Why or why not?', fr: 'Êtes-vous d’accord avec l’auteur ? Pourquoi ?' },
      { en: 'If you were the CFO of a company, what would you do?', fr: 'Si vous étiez DAF, que feriez-vous ?' }
    ],
    clarify: [
      { en: 'Could you rephrase your problem statement, please?', fr: 'Pouvez-vous reformuler votre problématique ?' },
      { en: 'Could you remind us of your plan?', fr: 'Pouvez-vous rappeler votre plan ?' },
      { en: 'What exactly do you mean by that?', fr: 'Que voulez-vous dire exactement ?' }
    ]
  };
  const KIND_LABEL = { next: 'Suivante', deeper: 'Approfondir', news: 'Actualité', easier: 'Plus simple', opinion: 'Son avis', clarify: 'Faire préciser' };

  let CUR = null;
  function setCurrent(c) { CUR = c; }
  async function leaveCurrent() {
    const c = CUR; CUR = null;
    document.body.classList.remove('ex-focus');
    if (c && c.leave) { try { await c.leave(); } catch (e) { console.warn('[examen] leave', e); } }
    stopSpeak();
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

  function stepper(steps, active, reached, did) {
    return `<ol class="ex-steps" aria-label="Étapes">${steps.map((st, i) => {
      const state = st.id === active ? 'on' : i <= reached && (!did || did(st.id)) ? 'done' : '';
      const say = state === 'on' ? 'en cours' : state === 'done' ? 'faite' : i > reached + 1 ? 'pas encore disponible' : 'à venir';
      return `<li><button type="button" class="ex-step ${state}" data-step="${st.id}" aria-label="Étape ${i + 1} : ${esc(st.label)}, ${say}"${st.id === active ? ' aria-current="step"' : ''}${i > reached + 1 ? ' disabled' : ''}>
        <span class="ex-step-n">${state === 'done' && st.id !== active ? icon('check') : i + 1}</span><span class="ex-step-l">${esc(st.label)}</span></button></li>`;
    }).join('')}</ol>`;
  }

  function subjectHTML(s, o) {
    o = o || {};
    return `<article class="ex-paper${o.big ? ' is-big' : ''}" lang="en">
      <h2 class="ex-paper-title">${esc(s.title)}</h2>
      <p class="ex-paper-src">${esc([s.source, s.date].filter(Boolean).join(' — '))}</p>
      ${arr(s.paragraphs).map((p, i) => `<p class="ex-par"><span class="ex-par-n" aria-label="Paragraphe ${i + 1}">${i + 1}</span><span>${esc(p)}</span></p>`).join('')}
      ${arr(s.glossary).length ? `<div class="ex-gloss" lang="fr"><b>Notes</b>${s.glossary.map((g, i) => `<span><sup>${i + 1}</sup> <i lang="en">${esc(g.en)}</i> : ${esc(g.fr || '')}</span>`).join('')}</div>` : ''}
      <div class="ex-question"><span class="ex-question-l">Question</span><p>${esc(s.question || 'No question provided.')}</p></div>
    </article>`;
  }

  function corrigeHTML(s, open) {
    const c = s.corrige || {};
    const has = c.topic || arr(c.summary).length || c.problematic;
    if (!has) return `<p class="small muted">Pas de corrigé pour ce sujet${aiReady() ? '' : ' (il est généré par l’IA à l’import, avec une clé)'}.</p>`;
    const li = (xs) => `<ul>${arr(xs).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return `<div class="ex-corrige" lang="en">
      ${c.topic ? `<div class="ex-cg"><b lang="fr">Thème</b><p>${esc(c.topic)}</p></div>` : ''}
      ${c.tone ? `<div class="ex-cg"><b lang="fr">Ton</b><p>${esc(c.tone)}</p></div>` : ''}
      ${arr(c.summary).length ? `<div class="ex-cg"><b lang="fr">Idées clés (synthèse)</b>${li(c.summary)}</div>` : ''}
      ${c.problematic ? `<div class="ex-cg"><b lang="fr">Problématique</b><p>${esc(c.problematic)}</p></div>` : ''}
      ${arr(c.plan).length ? `<div class="ex-cg"><b lang="fr">Plan</b><ol class="ex-plan">${c.plan.map((a) => `<li><b>${esc(a.title)}</b>${li(a.points)}</li>`).join('')}</ol></div>` : ''}
      ${arr(c.news).length ? `<div class="ex-cg"><b lang="fr">Actualité utilisable</b>${li(c.news)}</div>` : ''}
      ${arr(c.keyVocab).length ? `<div class="ex-cg"><b lang="fr">Vocabulaire clé</b><div class="ex-vocab-chips">${c.keyVocab.map((v) => `<span class="pill">${esc(v)}</span>`).join('')}</div></div>` : ''}
      ${open && arr(c.juryQuestions).length ? `<div class="ex-cg"><b lang="fr">Questions du jury prêtes</b><ol class="ex-jq">${c.juryQuestions.map((q) => `<li><span>${esc(q.en)}</span><small lang="fr">${esc(q.fr || '')}</small></li>`).join('')}</ol></div>` : ''}
    </div>`;
  }

  function doneMap() {
    const m = {};
    store.list().forEach((x) => { if (x.subjectId && (x.expose.startedAt || x.interview.startedAt || x.evaluation) && !m[x.subjectId]) m[x.subjectId] = x; });
    return m;
  }
  function subjectCard(s, o) {
    o = o || {};
    const custom = store.isCustom(s.id);
    const did = o.done && o.done[s.id];
    const when = did ? new Date(did.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '';
    return `<button type="button" class="card ex-scard" data-subject="${esc(s.id)}" style="--hue:${THEME_HUE[s.theme] || 214}">
      <div class="ex-scard-top">${themeChip(s.theme)}${custom ? `<span class="pill pill-xs pill-accent">${/^ai-/.test(s.id) ? 'IA' : 'Importé'}</span>` : ''}${did ? `<span class="pill pill-xs pill-ok" title="${did.kind === 'jury' ? 'Oral blanc avec jury' : 'Entraînement solo'}">${icon('check')}Fait le ${esc(when)}</span>` : ''}</div>
      <b class="ex-scard-title" lang="en">${esc(s.title)}</b><span class="ex-scard-q" lang="en">${esc(s.question)}</span>
      <span class="ex-scard-meta">${icon('doc')}${subjectWords(s)} mots · ${s.paragraphs.length} §${s.date ? ' · ' + esc(s.date) : ''}</span>
    </button>`;
  }

  function ring(total, max, big) {
    const p = clamp((Number(total) || 0) / max, 0, 1);
    const kind = p >= 0.6 ? 'ok' : p >= 0.45 ? 'warn' : 'err';
    return `<div class="ex-ring is-${kind}${big ? ' is-big' : ''}" style="--p:${p.toFixed(3)}" role="img" aria-label="Note ${fmtNum(total)} sur ${max}"><b>${fmtNum(total)}</b><span>/${max}</span></div>`;
  }

  function sparkSVG(values, w, hgt) {
    w = w || 240; hgt = hgt || 56;
    if (values.length < 2) return '';
    const max = 20, pad = 6;
    const pts = values.map((v, i) => [pad + (i * (w - 2 * pad)) / (values.length - 1), hgt - pad - (clamp(v, 0, max) / max) * (hgt - 2 * pad)]);
    const d = pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' ');
    const y10 = (hgt - pad - (10 / max) * (hgt - 2 * pad)).toFixed(1);
    return `<svg class="ex-spark" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" role="img" aria-label="Évolution des notes : ${values.map(fmtNum).join(', ')}">
      <line x1="0" x2="${w}" y1="${y10}" y2="${y10}" class="ex-spark-mid"/>
      <polyline points="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.2" fill="currentColor"/>`).join('')}
    </svg>`;
  }
  const byCreated = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  const scored = () => store.list().filter((s) => s.evaluation && isFinite(Number(s.evaluation.total))).sort(byCreated);

  function localSubjectFromText(text) {
    const lines = str(text).replace(/\r/g, '').split('\n').map((l) => l.trim());
    const blocks = str(text).replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    const qLine = lines.find((l) => /\?\s*$/.test(l) && /(to what extent|how|why|what|do you|should|can|is it|discuss)/i.test(l));
    const title = (lines.find((l) => l && l.length < 140 && !/\?\s*$/.test(l)) || 'Imported article').replace(/^title\s*:\s*/i, '');
    const paragraphs = blocks.filter((b) => b !== title && b !== qLine && b.length > 60);
    return normSubject({
      id: 'imp-' + uid(), theme: null, title, source: 'Imported text', date: '',
      question: qLine ? qLine.replace(/^(question|subject)\s*:\s*/i, '') : '',
      paragraphs: paragraphs.length ? paragraphs : blocks, glossary: [], corrige: {}
    });
  }

  function previewHTML(s) {
    return `<div class="ex-preview card">
      <div class="row">${themeChip(s.theme)}<span class="pill pill-xs">${subjectWords(s)} mots · ${s.paragraphs.length} §</span>${s.corrige && s.corrige.topic ? '<span class="pill pill-xs pill-ok">Corrigé prêt</span>' : '<span class="pill pill-xs pill-warn">Sans corrigé</span>'}</div>
      <div class="field"><label>Titre</label><input data-f="title" value="${esc(s.title)}" lang="en"></div>
      <div class="field"><label>Question de l’examen</label><textarea data-f="question" rows="2" lang="en" placeholder="To what extent…?">${esc(s.question)}</textarea></div>
      <details class="ex-details"><summary>Voir le texte (${s.paragraphs.length} paragraphes)</summary>${subjectHTML(s)}</details>
    </div>`;
  }
  function readPreview(el, s) {
    const t = $('[data-f="title"]', el), q = $('[data-f="question"]', el);
    if (t && t.value.trim()) s.title = t.value.trim();
    if (q) s.question = q.value.trim();
    return s;
  }

  function importSubjectSheet(onDone) {
    const st = { file: null, subject: null, ctrl: null };
    const body = h(`<div class="stack ex-import">
      <button type="button" class="ex-dz" data-act="pick">${icon('upload')}<b>Déposez l’article</b><span>PDF, Word, image ou texte · ou cliquez pour choisir</span></button>
      <div class="field"><label for="ex-imp-text">… ou collez le texte de l’article et la question</label>
        <textarea id="ex-imp-text" rows="7" data-f="text" lang="en" placeholder="Headline&#10;&#10;Paragraph 1…&#10;&#10;Question: To what extent…?"></textarea></div>
      <p class="small muted" data-b="state">${aiReady() ? 'L’IA détecte le titre, la source, la question et prépare un corrigé pour le jury.' : 'Sans clé IA : le texte est découpé en paragraphes, sans corrigé. Vérifiez la question.'}</p>
      <div data-b="preview"></div>
    </div>`);
    const setState = (t, busy) => { $('[data-b="state"]', body).innerHTML = (busy ? '<span class="spinner spinner-xs"></span> ' : '') + esc(t); };
    // Nouveau texte : l'aperçu analysé ne correspond plus.
    function reset() {
      if (!st.subject) return;
      st.subject = null;
      $('[data-b="preview"]', body).innerHTML = '';
      const sp = st.btn && st.btn.querySelector('span'); if (sp) sp.textContent = 'Analyser';
      setState('Texte modifié : cliquez sur « Analyser ».');
    }
    $('[data-f="text"]', body).addEventListener('input', reset);
    async function takeFile(f) {
      if (!f) return;
      st.file = f;
      if (!S.docs || !S.docs.extract) { toast('Lecture de fichiers indisponible : collez le texte.', 'err'); return; }
      setState(`Lecture de « ${f.name} »…`, true);
      try {
        const r = await S.docs.extract(f, f.name);
        $('[data-f="text"]', body).value = str(r && r.text).trim();
        reset();
        setState(`« ${f.name} » lu (${words(r.text)} mots). Cliquez sur « Analyser ».`);
        if (r && r.warning) toast(r.warning, 'warn');
      } catch (e) { setState(errMsg(e)); toast(errMsg(e), 'err'); }
    }
    $('[data-act="pick"]', body).addEventListener('click', async () => {
      const files = UI().pickFiles ? await UI().pickFiles({ accept: (S.docs && S.docs.accept) || '' }) : [];
      takeFile(files[0]);
    });
    const dz = $('.ex-dz', body);
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); takeFile(e.dataTransfer && e.dataTransfer.files[0]); });
    sheet({
      title: 'Importer un sujet', body, wide: true,
      onClose: () => { if (st.ctrl) st.ctrl.abort(); },
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        {
          label: 'Analyser', kind: 'primary', icon: 'sparkles', close: false,
          onClick: async (ctx) => {
            if (st.subject) {
              const s = store.addSubject(readPreview(body, st.subject));
              toast('Sujet enregistré.', 'ok');
              ctx.close('action');
              onDone(s);
              return false;
            }
            const text = $('[data-f="text"]', body).value.trim();
            if (words(text) < 60) { toast('Texte trop court : collez l’article complet (au moins quelques paragraphes).', 'warn'); return false; }
            let s = null;
            if (aiReady() && aiHas('subjectFromText')) {
              setState('Analyse par l’IA (titre, question, corrigé)…', true);
              st.ctrl = new AbortController();
              try { s = normSubject(await S.examAI.subjectFromText(text, { signal: st.ctrl.signal })); } catch (e) {
                if (isAbort(e)) return false;
                toast('IA indisponible : ' + errMsg(e) + ' — découpage simple utilisé.', 'warn');
              }
            }
            s = s || localSubjectFromText(text);
            st.subject = s;
            $('[data-b="preview"]', body).innerHTML = previewHTML(s);
            setState('Vérifiez le titre et la question, puis enregistrez.');
            st.btn = ctx.button;
            const sp = ctx.button.querySelector('span'); if (sp) sp.textContent = 'Enregistrer et utiliser';
            return false;
          }
        }
      ]
    });
  }

  function generateSubjectSheet(onDone) {
    if (!aiReady() || !aiHas('generateSubject')) { noAI('Générer un sujet'); return; }
    const st = { theme: null, subject: null, ctrl: null };
    const body = h(`<div class="stack ex-gen">
      <div class="field"><span class="label">Thème du programme</span>
        <div class="ex-chips" role="radiogroup" aria-label="Thème">${[{ id: '', fr: 'Au hasard' }].concat(THEMES).map((t) => `<button type="button" class="chip${t.id === '' ? ' on' : ''}" role="radio" aria-checked="${t.id === ''}" data-theme="${t.id}">${t.id ? `<b>${t.id}</b> ` : ''}${esc(t.fr)}</button>`).join('')}</div></div>
      <div class="field"><label for="ex-gen-topic">Sujet précis (facultatif)</label><input id="ex-gen-topic" data-f="topic" placeholder="ex. stablecoins, Omnibus CSRD, IA et audit, droits de douane…"></div>
      <p class="small muted" data-b="state">Article original de niveau presse économique, avec question, notes et corrigé pour le jury.</p>
      <div data-b="preview"></div>
    </div>`);
    $$('[data-theme]', body).forEach((b) => b.addEventListener('click', () => {
      st.theme = b.dataset.theme ? Number(b.dataset.theme) : null;
      $$('[data-theme]', body).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    }));
    sheet({
      title: 'Générer un sujet d’actualité', body, wide: true,
      onClose: () => { if (st.ctrl) st.ctrl.abort(); },
      actions: [
        { label: 'Annuler', kind: 'ghost' },
        {
          label: 'Générer', kind: 'primary', icon: 'sparkles', close: false,
          onClick: async (ctx) => {
            if (st.subject) {
              const s = store.addSubject(readPreview(body, st.subject));
              ctx.close('action'); toast('Sujet enregistré.', 'ok'); onDone(s); return false;
            }
            const stEl = $('[data-b="state"]', body);
            stEl.innerHTML = '<span class="spinner spinner-xs"></span> Rédaction de l’article et du corrigé (20 à 40 s)…';
            st.ctrl = new AbortController();
            try {
              const s = normSubject(await S.examAI.generateSubject({ theme: st.theme, topic: $('[data-f="topic"]', body).value.trim(), signal: st.ctrl.signal }));
              if (!s || !s.paragraphs.length) throw new Error('Réponse de l’IA incomplète, réessayez.');
              st.subject = s;
              $('[data-b="preview"]', body).innerHTML = previewHTML(s);
              stEl.textContent = 'Relisez puis enregistrez.';
              const sp = ctx.button.querySelector('span'); if (sp) sp.textContent = 'Enregistrer et utiliser';
            } catch (e) {
              if (isAbort(e)) return false;
              stEl.textContent = errMsg(e);
              toast(errMsg(e), 'err');
            }
            return false;
          }
        }
      ]
    });
  }

  function previewSubjectSheet(s, mode, start, startFull) {
    const custom = store.isCustom(s.id);
    const solo = mode === 'solo';
    const body = h(`<div class="stack">
      <div class="row">${themeChip(s.theme)}<span class="pill pill-xs">${subjectWords(s)} mots</span></div>
      ${solo ? `<div class="ex-question"><span class="ex-question-l">Question</span><p lang="en">${esc(s.question)}</p></div><p class="small muted">« Oral complet » : comme à l’examen, 1 h de préparation, l’exposé, puis les questions du jury. « Questions seulement » : le jury IA vous interroge tout de suite, l’article reste affiché.</p>` : subjectHTML(s)}
      ${mode === 'jury' ? `<details class="ex-details"><summary>Corrigé indicatif (jury)</summary>${corrigeHTML(s, true)}</details>` : ''}
    </div>`);
    const actions = [];
    if (custom) actions.push({ label: 'Supprimer', kind: 'danger', icon: 'trash', onClick: async () => { if (await confirmSheet({ title: 'Supprimer ce sujet ?', text: s.title, okLabel: 'Supprimer', danger: true })) { store.removeSubject(s.id); toast('Sujet supprimé.', 'ok'); S.app.refresh && S.app.refresh(); } } });
    if (solo) {
      actions.push({ label: 'Questions seulement', kind: 'ghost', icon: 'chat', onClick: () => start(s) });
      actions.push({ label: 'Oral complet (1 h de préparation)', kind: 'primary', icon: 'play', onClick: () => startFull(s) });
    } else actions.push({ label: mode === 'call' ? 'Choisir pour l’appel' : 'Faire passer ce sujet', kind: 'primary', icon: 'play', onClick: () => start(s) });
    sheet({ title: s.title, body, wide: true, actions });
  }

  function drawSheet(list, mode, start) {
    if (!list.length) { toast('Aucun sujet disponible.', 'warn'); return; }
    const recent = new Set(store.list().slice(0, 6).map((x) => x.subjectId));
    let pool = list.filter((s) => !recent.has(s.id));
    if (!pool.length) pool = list;
    let pick = null;
    const body = h('<div class="ex-draw" aria-live="polite"></div>');
    function draw() {
      pick = pool[Math.floor(Math.random() * pool.length)];
      body.innerHTML = `<div class="ex-draw-card card" style="--hue:${THEME_HUE[pick.theme] || 214}">
        <div class="ex-draw-env">${icon('doc')}</div>
        ${themeChip(pick.theme)}
        <p class="ex-draw-q" lang="en">${esc(pick.question)}</p>
        <p class="small muted">Comme le jour J : texte de presse anglo-saxonne + une question. ${mode === 'jury' ? 'Partagez-le dans Teams ou Meet au lancement de la préparation.' : mode === 'call' ? 'Il reste affiché pendant l’appel.' : 'Le chrono d’1 h démarre quand vous êtes prête.'}</p>
      </div>`;
      body.firstElementChild.classList.add('pop');
    }
    draw();
    sheet({
      title: 'Tirage au sort', body,
      actions: [
        { label: 'Tirer un autre sujet', kind: 'ghost', icon: 'refresh', close: false, onClick: () => { draw(); return false; } },
        { label: 'C’est parti', kind: 'primary', icon: 'play', onClick: () => start(pick) }
      ]
    });
  }

  function renderHome(root) {
    const list = store.list();
    const open = list.find((s) => (s.kind === 'call' ? s.call && s.call.startedAt && !s.call.endedAt : s.phase !== 'done' && !s.evaluation && (s.prep.startedAt || s.expose.startedAt || s.interview.startedAt)) && Date.now() - Date.parse(stamp(s)) < 4 * 86400e3);
    const openLabel = (s) => (s.kind === 'solo' ? 'Entraînement avec l’IA' : s.kind === 'call' ? 'Entraînement sur Teams' : 'Oral avec jury');
    root.innerHTML = `<div class="screen ex ex-home">
      <header class="home-head">
        <div class="brand">
          <div class="app-icon" aria-hidden="true">${icon('graduation')}</div>
          <div class="brand-text"><h1 class="h1">Aide Visio</h1><p class="home-sub">Entraînement à l’oral d’anglais des affaires</p></div>
        </div>
      </header>

      ${open ? `<section class="card ex-resume">
        <span class="tile tile-orange">${icon('clock')}</span>
        <div class="grow"><b>Séance en cours</b><small class="muted">${esc(openLabel(open))} · ${esc(open.subject.title)} · ${esc(phaseLabel(open))}</small></div>
        <button type="button" class="btn btn-primary btn-sm" data-go="${esc(sessionHash(open))}">${icon('play')}<span>Reprendre</span></button>
      </section>` : ''}

      <nav class="ex-roles" aria-label="Choisir un entraînement">
        <button type="button" class="card ex-role ex-role-solo is-primary" data-go="#/eleve">
          <span class="ex-role-ic">${icon('sparkles')}</span>
          <span class="ex-role-text"><b>Entraînement avec l’IA</b><span>Un jury IA vous interroge à l’oral en anglais et corrige chaque réponse.</span></span>
          ${icon('chevron-right', 'chev')}
        </button>
        <button type="button" class="card ex-role ex-role-jury" data-go="#/appel">
          <span class="ex-role-ic">${icon('video')}</span>
          <span class="ex-role-text"><b>Entraînement sur Teams</b><span>Avec un jury en visio : importez le sujet reçu, l’assistant vous souffle une réponse en anglais.</span></span>
          ${icon('chevron-right', 'chev')}
        </button>
      </nav>
      ${aiReady() ? '' : `<p class="ex-home-note">${icon('info', 'ico-inline')}<span>Sans clé IA, le jury IA pose les questions mais ne corrige pas.</span><button type="button" class="btn btn-quiet btn-sm" data-go="#/settings">Ajouter une clé</button></p>`}
    </div>`;
    setCurrent({});
  }
  function phaseLabel(s) {
    if (s.kind === 'call') return s.call && s.call.endedAt ? 'terminé' : s.call && s.call.startedAt ? 'en cours' : 'pas commencé';
    return ({ prep: 'préparation', expose: 'exposé', interview: s.kind === 'solo' ? 'jury IA' : 'entretien', review: 'bilan', done: 'terminée' })[s.phase] || '';
  }

  function pickRandom(list, avoid) {
    const recent = new Set(store.list().slice(0, 6).map((x) => x.subjectId));
    let pool = list.filter((s) => !recent.has(s.id) && s.id !== avoid);
    if (!pool.length) pool = list.filter((s) => s.id !== avoid);
    if (!pool.length) pool = list;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  let AUTO_ASK = '';
  function startSolo(subj, direct) {
    const s = newSession('solo', subj);
    if (direct) {
      s.quick = true;
      s.phase = 'interview';
      s.maxPhase = phaseIndex('interview');
      AUTO_ASK = s.id;
    }
    store.save(s);
    go(sessionHash(s));
  }

  function renderChooser(root, mode) {
    const st = { theme: Number(prefs().chooserTheme) || 0 };
    const start = (subj) => {
      const s = newSession(mode, subj);
      store.save(s);
      go(sessionHash(s));
    };
    const solo = mode === 'solo';
    const aiOk = aiReady();
    const needKey = aiOk ? '' : '<span class="pill pill-xs pill-warn ex-needkey">Clé IA requise</span>';
    const toolBtns = `<button type="button" class="btn btn-quiet" data-act="import">${icon('import')}<span>Importer un sujet</span></button>
        <button type="button" class="btn btn-quiet${aiOk ? '' : ' is-needkey'}" data-act="gen"${aiOk ? '' : ' aria-disabled="true" title="Demande une clé IA (Réglages)"'}>${icon('globe')}<span>Générer avec l’IA</span>${needKey}</button>`;
    root.innerHTML = `<div class="screen ex ex-chooser${solo ? ' ex-solo-chooser' : ''}">
      ${topbar({ title: solo ? 'Entraînement avec l’IA' : 'Entraînement sur Teams', sub: solo ? '' : 'Jury humain · choisir le sujet', back: '#/' })}
      ${solo ? `<section class="card card-pad ex-jury-ai">
        <div class="ex-jury-ai-main">
          <span class="ex-role-ic">${icon('sparkles')}</span>
          <div><h1 class="h2">Oral blanc</h1>
          <p class="muted">Comme à l’examen : 1 h de préparation, votre exposé, puis les questions du jury IA, en anglais.${aiOk && !keyRefused() ? '' : ' Sans clé IA, les réponses ne sont pas corrigées.'}</p></div>
        </div>
        <div class="ex-actions-row">
          <button type="button" class="btn btn-primary btn-lg" data-act="full-random">${icon('play')}<span>Commencer l’oral (sujet au hasard)</span></button>
          <button type="button" class="btn btn-quiet" data-act="quick-jury">${icon('chat')}<span>Questions du jury seulement</span></button>
        </div>
      </section>
      <div class="section-head ex-pick-head"><h2 class="h2">Choisir le sujet</h2></div>` : `<div class="ex-actions-row ex-pick-row">
        <button type="button" class="btn btn-primary btn-lg" data-act="draw">${icon('sparkles')}<span>Tirer un sujet au hasard</span></button>
        ${toolBtns}
      </div>`}
      <div class="ex-chips ex-theme-filter" role="tablist" aria-label="Filtrer par thème" data-b="chips"></div>
      <div class="ex-sgrid" data-b="grid"></div>
      ${solo ? `<details class="ex-more"><summary>Importer ou générer un sujet</summary><div class="ex-actions-row ex-pick-row">${toolBtns}</div></details>` : ''}
    </div>`;
    const filtered = () => store.subjects().filter((s) => !st.theme || s.theme === st.theme);
    function paint() {
      const all = store.subjects();
      const counts = {};
      all.forEach((s) => { counts[s.theme] = (counts[s.theme] || 0) + 1; });
      $('[data-b="chips"]', root).innerHTML = [{ id: 0, fr: 'Tous' }].concat(THEMES).map((t) =>
        `<button type="button" class="chip${st.theme === t.id ? ' on' : ''}" role="tab" aria-selected="${st.theme === t.id}" data-theme="${t.id}">${t.id ? `<b>${t.id}</b>` : ''}${esc(t.fr)}<span class="ex-chip-n">${t.id ? counts[t.id] || 0 : all.length}</span></button>`).join('');
      const list = all.filter((s) => !st.theme || s.theme === st.theme)
        .sort((a, b) => (store.isCustom(b.id) - store.isCustom(a.id)) || ((a.theme || 9) - (b.theme || 9)));
      const done = doneMap();
      $('[data-b="grid"]', root).innerHTML = list.length ? list.map((x) => subjectCard(x, { done })).join('')
        : `<div class="empty card"><div class="empty-ic">${icon('doc')}</div><h2 class="h3">Aucun sujet${st.theme ? ' pour ce thème' : ''}</h2><p class="muted">Importez un article ou générez-en un avec l’IA.</p></div>`;
    }
    paint();
    const startDirect = (subj) => startSolo(subj, true);
    root.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-theme]');
      if (chip && root.contains(chip)) { st.theme = Number(chip.dataset.theme) || 0; setPrefs({ chooserTheme: st.theme }); paint(); return; }
      const card = e.target.closest('[data-subject]');
      if (card) { const s = store.getSubject(card.dataset.subject); if (s) previewSubjectSheet(s, mode, solo ? startDirect : start, start); return; }
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'draw') drawSheet(filtered(), mode, start);
      else if (act === 'import') importSubjectSheet(start);
      else if (act === 'gen') generateSubjectSheet(start);
      else if (act === 'quick-jury' || act === 'full-random') {
        const pick = pickRandom(filtered().length ? filtered() : store.subjects());
        if (!pick) { toast('Aucun sujet disponible.', 'warn'); return; }
        startSolo(pick, act === 'quick-jury');
      }
    });
    setCurrent({});
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
      A.preset = preset || A.preset || (A.pc === 'ok' ? 'pc-interne' : 'haut-parleur');
      if (A.mobile && SPLIT_SRC.includes(A.preset)) A.preset = 'haut-parleur';
      setPrefs({ [prefKey]: A.preset });
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
        const hint = [C.s.subject.title].concat(arr(C.s.subject.corrige.keyVocab).map((v) => str(v).split('—')[0].trim())).join(', ').slice(0, 400);
        const startOpts = { lang: 'en-GB', hint };
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
    const pcSub = 'Teams ou Meet · programme « Son du PC »' + (A.pc === 'ok' ? ' détecté' : A.pc === 'pending' ? ' : recherche…' : ' requis');
    const sources = [
      { id: 'pc-interne', ic: 'speaker', label: 'Son de l’appel sur ce PC', sub: pcSub, rec: A.pc === 'ok' },
      { id: 'visio-casque', ic: 'globe', label: 'Onglet de l’appel dans Chrome', sub: 'Partagez l’onglet Meet ou Teams avec le son · clé IA requise' },
      { id: 'haut-parleur', ic: 'mic', label: 'Micro / haut-parleur', sub: 'Le micro capte le son de l’appel (voix mêlées)' }
    ].filter((x) => !(A.mobile && SPLIT_SRC.includes(x.id)));
    const sel = A.preset || (A.pc === 'ok' ? 'pc-interne' : 'haut-parleur');
    const primary = A.on ? 'btn-danger' : o.quiet ? '' : 'btn-primary';
    const blocked = !A.on && o.blocked;
    const onErr = A.on && A.state === 'error';
    const stLabel = blocked ? o.blocked : A.starting ? 'Démarrage…' : onErr ? (A.error || 'Écoute arrêtée.') : A.on ? (o.onLabel || 'J’écoute l’élève (en-GB)') : A.state === 'error' ? (A.error || 'Écoute arrêtée.') : 'Écoute arrêtée';
    return `<div class="ex-listen ${A.on ? 'on' : ''}">
<div class="ex-src"${sources.length < 2 ? ' hidden' : ''} role="radiogroup" aria-label="Source du son">${sources.map((x) => `<button type="button" class="ex-src-opt${sel === x.id ? ' on' : ''}" role="radio" aria-checked="${sel === x.id}" data-src="${x.id}"${A.on || A.starting ? ' disabled' : ''}>
        <span class="ex-src-ic">${icon(x.ic)}</span><span class="ex-src-t"><b>${esc(x.label)}${x.rec ? ' <span class="pill pill-xs pill-ok">Recommandé</span>' : ''}</b><small>${esc(x.sub)}</small></span></button>`).join('')}</div>
      <div class="ex-listen-bar">
        <span class="ex-live-dot ${onErr ? 'err' : A.on ? 'on' : A.state === 'error' ? 'err' : ''}" aria-hidden="true"></span><span class="grow small" role="status" data-b="listen-status">${esc(stLabel)}</span>
        <button type="button" class="btn btn-sm ${blocked ? '' : primary}" data-act="${A.on ? 'listen-stop' : 'listen-start'}"${A.starting || blocked ? ' disabled' : ''}>${icon(A.on ? 'stop' : 'mic')}<span>${A.on ? 'Arrêter l’écoute' : esc(o.startLabel || 'Écouter l’élève')}</span></button>
      </div>
    </div>`;
  }

  function normEval(e) {
    e = e && typeof e === 'object' ? e : {};
    const src = arr(e.criteria);
    // Deux passes : id/libellé d'abord, puis repli par position sur les entrées encore libres.
    const used = new Set();
    const picked = CRITERIA.map((c) => {
      const f = src.find((x) => x && !used.has(x) && x.id === c.id) || src.find((x) => x && !used.has(x) && norm(x.label) === norm(c.label));
      if (f) used.add(f);
      return f;
    });
    const criteria = CRITERIA.map((c, i) => {
      let f = picked[i];
      if (!f) {
        f = src[i] && !used.has(src[i]) ? src[i] : src.find((x) => x && !used.has(x));
        if (f) used.add(f);
      }
      f = f || {};
      const sc = Number(String(f.score == null ? '' : f.score).replace(',', '.'));
      return { id: c.id, label: c.label, max: c.max, score: isFinite(sc) ? clamp(round1(sc), 0, c.max) : 0, comment: str(f.comment) };
    });
    return {
      total: round1(criteria.reduce((a, c) => a + c.score, 0)),
      criteria,
      strengths: arr(e.strengths).map(str).filter(Boolean),
      priorities: arr(e.priorities).map(str).filter(Boolean).slice(0, 3),
      errors: arr(e.errors).filter((x) => x && (x.said || x.better)),
      pronunciation: arr(e.pronunciation).map(str).filter(Boolean),
      modelPlan: str(e.modelPlan),
      message: str(e.message),
      manual: !!e.manual,
      at: e.at || nowIso()
    };
  }
  const verdict = (t) => (t >= 16 ? 'Très bien' : t >= 14 ? 'Bien' : t >= 12 ? 'Assez bien' : t >= 10 ? 'Admis, à consolider' : t >= 8 ? 'Juste, à retravailler' : 'Insuffisant pour l’instant');

  function durationWarnings(s) {
    const d = durations(s);
    const w = [];
    if (s.expose.startedAt && d.exposeMs < 10 * 60000) w.push(`Exposé de ${fmtDur(d.exposeMs)} : moins de 10 minutes est pénalisé.`);
    if (s.expose.startedAt && d.exposeMs > 16 * 60000) w.push(`Exposé de ${fmtDur(d.exposeMs)} : au-delà de 15 minutes, le jury coupe.`);
    if (s.kind === 'jury' && !s.expose.checklist.summary) w.push('Synthèse non cochée : une synthèse oubliée ou bâclée est pénalisée.');
    return w;
  }

  function exportCallMd(s) {
    const c = s.call || {};
    const L = [`# Appel d’entraînement — UE 218 · ${fmtDate(s.createdAt, true)}`, ''];
    L.push(`- Sujet : ${s.subject.title}${s.subject.theme ? ` (thème ${s.subject.theme})` : ''}`);
    L.push(`- Question : ${s.subject.question}`);
    if (teamsValid(s.teamsLink)) L.push(`- Réunion ${meetingApp(s.teamsLink)} : ${s.teamsLink}`);
    if (c.startedAt) L.push(`- Durée : ${fmtDur((c.endedAt || Date.now()) - c.startedAt)}`);
    const list = arr(c.answers).filter((a) => !a.skipped && a.question);
    L.push('', '## Questions du jury et réponses', '');
    if (!list.length) L.push('Aucune question enregistrée.');
    list.forEach((a, i) => {
      L.push(`### ${i + 1}. ${a.question}`, '');
      if (a.fr) L.push(`- Traduction : ${a.fr}`);
      if (a.text) L.push(`- Réponse IA : ${a.text}`);
      if (arr(a.keyWords).length) L.push(`- Mots clés : ${a.keyWords.join(', ')}`);
      if (a.error && !a.text) L.push(`- Réponse IA : non obtenue (${a.error})`);
      if (a.mine) L.push(`- Ma réponse : ${a.mine}`);
      L.push('');
    });
    if (arr(c.turns).length) L.push('## Échanges', '', ...c.turns.map((t) => `- **${t.who === 'jury' ? 'Jury' : 'Moi'}** : ${t.text}`));
    return L.join('\n') + '\n';
  }

  function exportMd(s) {
    if (s.kind === 'call') return exportCallMd(s);
    const e = s.evaluation ? normEval(s.evaluation) : null;
    const d = durations(s);
    const L = [];
    L.push(`# Oral blanc — UE 218 · ${fmtDate(s.createdAt, true)}`, '');
    L.push(`- Rôle : ${s.kind === 'jury' ? `Jury (${teamsValid(s.teamsLink) ? meetingApp(s.teamsLink) : 'à distance'})` : 'Entraînement avec l’IA'}`);
    L.push(`- Sujet : ${s.subject.title}${s.subject.theme ? ` (thème ${s.subject.theme})` : ''}`);
    L.push(`- Question : ${s.subject.question}`);
    const durs = [['préparation', d.prepMs], ['exposé', d.exposeMs], [s.kind === 'solo' ? 'questions du jury' : 'entretien', d.interviewMs]].filter((x) => x[1] > 0);
    if (durs.length) L.push(`- Durées : ${durs.map((x) => `${x[0]} ${fmtDur(x[1])}`).join(' · ')}`);
    L.push('');
    if (e) {
      L.push(`## Note : ${fmtNum(e.total)}/20`, '');
      e.criteria.forEach((c) => L.push(`- ${c.label} : ${fmtNum(c.score)}/${c.max}${c.comment ? ` — ${c.comment}` : ''}`));
      if (e.strengths.length) L.push('', '## Points forts', '', ...e.strengths.map((x) => `- ${x}`));
      if (e.priorities.length) L.push('', '## Priorités', '', ...e.priorities.map((x, i) => `${i + 1}. ${x}`));
      if (e.errors.length) L.push('', '## Fautes', '', ...e.errors.map((x) => `- « ${x.said} » → « ${x.better} »${x.rule ? ` (${x.rule})` : ''}`));
      if (e.pronunciation.length) L.push('', '## Prononciation', '', ...e.pronunciation.map((x) => `- ${x}`));
      if (e.modelPlan) L.push('', '## Plan modèle', '', e.modelPlan);
      if (e.message) L.push('', '## Message pour Audrey', '', e.message);
    }
    if (s.kind === 'jury' || s.expose.startedAt) {
      const cl = CHECKS.map(([k, l]) => `${s.expose.checklist[k] ? '[x]' : '[ ]'} ${l}`).join(' · ');
      L.push('', '## Grille de l’exposé', '', cl);
    }
    if (s.expose.juryNotes) L.push('', '## Notes du jury', '', s.expose.juryNotes);
    if (arr(s.expose.errors).length && !e) L.push('', '## Fautes relevées', '', ...s.expose.errors.map((x) => `- « ${x.said} » → « ${x.better} »`));
    const tx = exposeText(s);
    if (tx) L.push('', '## Transcription de l’exposé', '', tx);
    if (arr(s.interview.turns).length) L.push('', '## Entretien', '', ...s.interview.turns.map((t) => `- **${t.who === 'jury' ? 'Jury' : 'Élève'}** : ${t.text}`));
    const ma = arr(s.interview.modelAnswers);
    if (ma.length) {
      L.push('', '## Réponses modèles (IA, jury)', '');
      ma.forEach((x) => L.push(`- **${x.question}**`, `  - Attendu : ${str(x.expect).replace(/^\s*attendu\s*:\s*/i, '')}`, `  - Réponse modèle : ${x.model}`));
    }
    return L.join('\n') + '\n';
  }

  function renderReview(box, C) {
    const s = C.s;
    const d = durations(s);
    const e = s.evaluation ? normEval(s.evaluation) : null;
    const warns = durationWarnings(s);
    const checks = CHECKS.filter(([k]) => s.expose.checklist[k]).length;
    const solo = s.kind === 'solo';
    const durRow = `<div class="ex-durs">
      ${d.prepMs > 0 ? `<span><small>Préparation</small><b>${fmtDur(d.prepMs)}</b></span>` : ''}
      ${d.exposeMs > 0 ? `<span class="${s.expose.startedAt && d.exposeMs < 600000 ? 'is-bad' : ''}"><small>Exposé</small><b>${fmtDur(d.exposeMs)}</b></span>` : ''}
      ${d.interviewMs > 0 ? `<span><small>${solo ? 'Questions du jury' : 'Entretien'}</small><b>${fmtDur(d.interviewMs)}</b></span>` : ''}
      ${s.kind === 'jury' ? `<span><small>Grille</small><b>${checks}/${CHECKS.length}</b></span>` : ''}
    </div>`;
    if (!e && solo) {
      const direct = !s.expose.startedAt && !exposeText(s);
      const asked = arr(s.interview.asked);
      const nb = asked.length;
      const keyBlock = keyRefused()
        ? `<p class="ex-keybad">${icon('warning', 'ico-inline')}<span>Votre clé IA est refusée : la correction est coupée.</span></p><div class="row"><button type="button" class="btn btn-primary" data-go="#/settings">${icon('gear')}<span>Corriger la clé</span></button></div>`
        : `<p class="muted">Ajoutez une clé IA pour obtenir une note sur 20.</p><div class="row"><button type="button" class="btn btn-primary" data-go="#/settings">${icon('gear')}<span>Ajouter une clé IA</span></button></div>`;
      const jq = arr(s.subject.corrige && s.subject.corrige.juryQuestions);
      box.innerHTML = aiOn()
        ? `<section class="card card-pad ex-review-pre">
          <h2 class="h2">Votre bilan</h2>
          ${durRow}
          ${warns.length ? `<ul class="ex-warns">${warns.map((w) => `<li>${icon('warning')}${esc(w)}</li>`).join('')}</ul>` : ''}
          <p class="muted">${direct ? `L’IA note vos ${nb > 1 ? nb + ' réponses' : 'réponses'} sur 20 et relève vos fautes.` : 'L’IA note votre oral sur 20 (exposé et réponses) et relève vos fautes.'}</p>
          <div class="row"><button type="button" class="btn btn-primary btn-lg" data-act="evaluate">${icon('sparkles')}<span>Obtenir ma note</span></button></div>
          <div data-b="eval-state" class="small muted" aria-live="polite"></div>
        </section>`
        : `<section class="card card-pad ex-review-pre">
          <h2 class="h2">Votre bilan</h2>
          ${durRow}
          ${keyBlock}
        </section>
        <section class="card card-pad ex-myanswers">
          <h3 class="h3">Vos réponses</h3>
          ${nb ? `<ol class="ex-myans">${asked.map((a) => {
            const src = jq.find((x) => x && x.en === a.en);
            const fr = a.fr || (src && src.fr) || '';
            return `<li><p class="ex-myans-q" lang="en"><b>${esc(a.en)}</b></p>${fr ? `<p class="small muted">${esc(fr)}</p>` : ''}<p class="ex-myans-a"><small>Votre réponse</small><span lang="en">${esc(a.answer || '—')}</span></p></li>`;
          }).join('')}</ol>` : '<p class="muted">Aucune réponse pour l’instant.</p>'}
          <details class="ex-details"><summary>Pistes de réponse (corrigé)</summary>${corrigeHTML(s.subject, false)}</details>
        </section>
        <div class="ex-actions-row">
          <button type="button" class="btn btn-primary btn-lg" data-act="finish">${icon('check')}<span>${s.phase === 'done' ? 'Enregistré' : 'Terminer'}</span></button>
          <button type="button" class="btn btn-lg" data-act="export">${icon('download')}<span>Télécharger le bilan</span></button>
        </div>`;
      return;
    }
    if (!e) {
      box.innerHTML = `<section class="card card-pad ex-review-pre">
        <h2 class="h2">Bilan de l’oral</h2>
        ${durRow}
        ${warns.length ? `<ul class="ex-warns">${warns.map((w) => `<li>${icon('warning')}${esc(w)}</li>`).join('')}</ul>` : ''}
        <p class="muted">${aiReady() ? 'L’IA note l’oral sur 20 avec les critères de l’épreuve (synthèse, problématique, commentaire, entretien, langue, aisance), relève les fautes et rédige un plan modèle. Vous pourrez ajuster chaque note.' : 'Sans clé IA, notez à la main avec la grille de l’épreuve.'}</p>
        <div class="row">
          <button type="button" class="btn btn-primary btn-lg" data-act="evaluate"${aiReady() ? '' : ' disabled'}>${icon('sparkles')}<span>Évaluer avec l’IA</span></button>
          <button type="button" class="btn btn-lg" data-act="manual">${icon('edit')}<span>Noter à la main</span></button>
        </div>
        <div data-b="eval-state" class="small muted" aria-live="polite"></div>
      </section>`;
      return;
    }
    box.innerHTML = `<section class="card card-pad ex-score" tabindex="-1">
        ${ring(e.total, 20, true)}
        <div class="ex-score-main">
          <span class="eyebrow">${icon('star')}${e.manual ? 'Note du jury' : 'Évaluation'}</span>
          <h2 class="h2" data-b="verdict">${esc(verdict(e.total))}</h2>
          ${durRow}
        </div>
      </section>
      ${warns.length ? `<ul class="ex-warns card card-pad">${warns.map((w) => `<li>${icon('warning')}${esc(w)}</li>`).join('')}</ul>` : ''}
      <section class="card card-pad">
        <div class="card-head"><h3 class="h3">Critères</h3><span class="spacer"></span><span class="small muted">Ajustez les notes : le total se recalcule</span></div>
        <div class="ex-crits">${e.criteria.map((c) => `<div class="ex-crit" data-crit="${c.id}">
          <div class="ex-crit-head"><b>${esc(c.label)}</b><label class="ex-crit-in"><input type="number" inputmode="decimal" min="0" max="${c.max}" step="0.5" value="${c.score}" aria-label="${esc(c.label)} sur ${c.max}"><span>/${c.max}</span></label></div>
          <div class="ex-bar"><i style="--p:${(c.score / c.max).toFixed(3)}"></i></div>
          ${c.comment ? `<p class="small muted">${esc(c.comment)}</p>` : ''}
        </div>`).join('')}</div>
      </section>
      ${e.strengths.length || e.priorities.length ? `<div class="ex-two">
        <section class="card card-pad"><h3 class="h3">${icon('check', 'ico-inline')} Points forts</h3><ul class="ex-list">${e.strengths.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ul></section>
        <section class="card card-pad ex-prio"><h3 class="h3">${icon('target', 'ico-inline')} 3 priorités</h3><ol class="ex-list">${e.priorities.map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">—</li>'}</ol></section>
      </div>` : ''}
      ${e.errors.length ? `<section class="card card-pad"><h3 class="h3">Fautes de langue</h3>
        <div class="ex-errs" role="table"><div class="ex-err ex-err-h" role="row"><span role="columnheader">Dit</span><span role="columnheader">Mieux</span><span role="columnheader">Règle</span></div>
        ${e.errors.map((x) => `<div class="ex-err" role="row"><span role="cell" class="ex-said" lang="en">${esc(x.said)}</span><span role="cell" class="ex-better" lang="en">${esc(x.better)}</span><span role="cell" class="small muted">${esc(x.rule || '')}</span></div>`).join('')}</div></section>` : ''}
      ${e.pronunciation.length ? `<section class="card card-pad"><h3 class="h3">Prononciation</h3><ul class="ex-pron-list">${e.pronunciation.map((p) => { const w = p.split(/\s+[—–-]\s+/)[0]; return `<li>${sayBtn(w)}<span><b lang="en">${esc(w)}</b>${p.length > w.length ? ' — ' + esc(p.slice(w.length).replace(/^\s*[—–-]\s*/, '')) : ''}</span></li>`; }).join('')}</ul></section>` : ''}
      ${e.modelPlan ? `<details class="card card-pad ex-details"><summary><b>Plan modèle</b> <span class="small muted">(en anglais)</span></summary><div class="md" lang="en">${md(e.modelPlan)}</div></details>` : ''}
      <section class="card card-pad ex-msg">
        ${s.kind === 'solo'
          ? `<div class="card-head"><h3 class="h3">Mot du correcteur</h3></div>
        <p class="ex-msg-solo">${esc(e.message || defaultMessage(e))}</p>`
          : `<div class="card-head"><h3 class="h3">Message pour Audrey</h3><span class="spacer"></span><button type="button" class="btn btn-sm" data-act="copy-msg">${icon('copy')}<span>Copier</span></button></div>
        <textarea class="input" rows="5" data-f="message" aria-label="Message pour Audrey">${esc(e.message || defaultMessage(e))}</textarea>`}
      </section>
      <div class="ex-actions-row">
        <button type="button" class="btn btn-primary btn-lg" data-act="finish">${icon('check')}<span>${s.phase === 'done' ? 'Enregistré' : 'Terminer'}</span></button>
        <button type="button" class="btn btn-lg" data-act="export">${icon('download')}<span>Télécharger le bilan</span></button>
        <button type="button" class="btn btn-lg" data-act="evaluate"${aiOn() ? '' : ' disabled'}>${icon('refresh')}<span>Réévaluer avec l’IA</span></button>
      </div>`;
    $$('.ex-crit input', box).forEach((inp) => inp.addEventListener('input', () => {
      const ev = normEval(s.evaluation);
      const id = inp.closest('[data-crit]').dataset.crit;
      const c = ev.criteria.find((x) => x.id === id);
      const v = Number(String(inp.value).replace(',', '.'));
      if (c && isFinite(v)) c.score = clamp(round1(v), 0, c.max);
      ev.total = round1(ev.criteria.reduce((a, x) => a + x.score, 0));
      s.evaluation = Object.assign({}, s.evaluation, { criteria: ev.criteria, total: ev.total });
      const bar = $('i', inp.closest('[data-crit]'));
      if (bar && c) bar.style.setProperty('--p', (c.score / c.max).toFixed(3));
      const r = $('.ex-ring', box);
      if (r) r.outerHTML = ring(ev.total, 20, true);
      const vd = $('[data-b="verdict"]', box); if (vd) vd.textContent = verdict(ev.total);
      C.saveSoon();
    }));
    const msg = $('[data-f="message"]', box);
    if (msg) msg.addEventListener('input', () => { s.evaluation.message = msg.value; C.saveSoon(); });
  }
  function defaultMessage(e) {
    return `Bravo Audrey pour cet oral blanc ! Note indicative : ${fmtNum(e.total)}/20.${e.priorities.length ? ' À travailler en priorité : ' + e.priorities.join(' ; ') + '.' : ''} Tu progresses, continue comme ça !`;
  }

  async function runEvaluate(C, box) {
    const s = C.s;
    if (!aiReady() || !aiHas('evaluate')) { noAI('L’évaluation automatique'); return; }
    if (C.evalCtrl) C.evalCtrl.abort();
    const ctrl = C.evalCtrl = new AbortController();
    const stEl = $('[data-b="eval-state"]', box);
    const btns = $$('[data-act="evaluate"]', box);
    btns.forEach((b) => { b.disabled = true; b.classList.add('busy'); });
    if (stEl) stEl.innerHTML = '<span class="spinner spinner-xs"></span> L’IA évalue l’oral (20 à 40 s)…';
    else toast('Réévaluation en cours…', 'info');
    try {
      const r = await S.examAI.evaluate({
        subject: s.subject, expose: exposeText(s), interview: arr(s.interview.turns).map((t) => ({ who: t.who, text: t.text })),
        durations: durations(s), juryNotes: s.expose.juryNotes || '', checklist: Object.assign({}, s.expose.checklist), checklistAuto: Object.assign({}, s.expose.checklistAuto),
        interviewOnly: s.kind === 'solo' && !s.expose.startedAt && !exposeText(s), kind: s.kind, signal: ctrl.signal
      });
      if (!C.alive) return;
      if (s.evaluation) s.evaluationPrev = s.evaluation;
      s.evaluation = normEval(r);
      C.saveNow();
      if (s.phase === 'review' || s.phase === 'done') {
        C.paint();
        const sc = $('.ex-score', C.root); if (sc) sc.focus({ preventScroll: true });
      } else {
        toast(`Évaluation prête (${fmtNum(s.evaluation.total)}/20) : elle s’affichera à l’étape Bilan.`, 'ok', { duration: 7000 });
      }
    } catch (e) {
      if (isAbort(e) || !C.alive) return;
      if (e && e.code === 'KEY') { markKeyRefused(); if (s.kind === 'solo') { C.paint(); return; } }
      if (stEl) stEl.textContent = errMsg(e);
      else toast('Évaluation impossible : ' + errMsg(e), 'err');
      btns.forEach((b) => { b.disabled = false; b.classList.remove('busy'); });
    }
  }

  function reviewClicks(C, box, act) {
    const s = C.s;
    if (act === 'evaluate') {
      if (!s.evaluation) { runEvaluate(C, box); return true; }
      confirmSheet({ title: 'Réévaluer avec l’IA ?', text: 'La note actuelle, vos ajustements et le message seront remplacés par une nouvelle évaluation.', okLabel: 'Réévaluer' })
        .then((ok) => { if (ok && C.alive) runEvaluate(C, box); });
      return true;
    }
    if (act === 'manual') {
      if (C.evalCtrl) { C.evalCtrl.abort(); C.evalCtrl = null; }
      s.evaluation = normEval({ manual: true, criteria: CRITERIA.map((c) => ({ id: c.id, score: Math.round(c.max * 0.5 * 2) / 2 })), errors: s.expose.errors });
      C.saveNow(); C.paint(); toast('Grille prête : ajustez chaque critère.', 'ok'); return true;
    }
    if (act === 'copy-msg') { const t = $('[data-f="message"]', box); copyText(t ? t.value : '', 'Message'); return true; }
    if (act === 'export') { downloadText(exportMd(s), `oral-blanc-${s.createdAt.slice(0, 10)}-${norm(s.subject.title).split(' ').slice(0, 4).join('-')}.md`); return true; }
    if (act === 'finish') { s.phase = 'done'; C.saveNow(); toast('Séance enregistrée dans l’historique.', 'ok'); go('#/historique'); return true; }
    return false;
  }

  const JURY_STEPS = [{ id: 'prep', label: 'Préparation' }, { id: 'expose', label: 'Exposé' }, { id: 'interview', label: 'Entretien' }, { id: 'review', label: 'Bilan' }];
  const SOLO_STEPS = [{ id: 'prep', label: 'Préparation' }, { id: 'expose', label: 'Exposé' }, { id: 'interview', label: 'Jury IA' }, { id: 'review', label: 'Bilan' }];
  const phaseIndex = (p) => ({ prep: 0, expose: 1, interview: 2, review: 3, done: 3 })[p] || 0;

  function baseController(root, s) {
    const C = { root, s, alive: true, saveT: 0, reached: phaseIndex(s.phase) };
    C.saveNow = () => { clearTimeout(C.saveT); C.saveT = 0; if (C.deleted) return; store.save(s); };
    C.saveSoon = () => { clearTimeout(C.saveT); C.saveT = setTimeout(C.saveNow, 1200); };
    C.setPhase = (p) => {
      const n = Date.now();
      // En reculant, le chrono de l'étape quittée s'arrête aussi (il pourra reprendre via stepTo).
      if (phaseIndex(p) < phaseIndex(s.phase) && ['prep', 'expose', 'interview'].includes(s.phase)) {
        const q = s[s.phase];
        if (q && q.startedAt && !q.endedAt) q.endedAt = n;
      }
      if (p !== 'prep' && s.prep.startedAt && !s.prep.endedAt) s.prep.endedAt = n;
      if ((p === 'interview' || p === 'review') && s.expose.startedAt && !s.expose.endedAt) s.expose.endedAt = n;
      if (p === 'review' && s.interview.startedAt && !s.interview.endedAt) s.interview.endedAt = n;
      s.phase = p;
      C.reached = Math.max(C.reached, phaseIndex(p));
      s.maxPhase = Math.max(s.maxPhase || 0, C.reached);
      C.saveNow();
      C.paint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    C.reached = Math.max(C.reached, s.maxPhase || 0);
    C.stepTo = async (step, o) => {
      o = o || {};
      if (step === s.phase || (step === 'review' && s.phase === 'done')) return false;
      const from = phaseIndex(s.phase), to = phaseIndex(step);
      const label = ((o.steps || []).find((x) => x.id === step) || {}).label || step;
      if (to > from) {
        const ok = await confirmSheet({ title: `Passer à « ${label} » ?`, text: 'Le chrono de l’étape en cours sera arrêté.', okLabel: 'Passer', cancelLabel: 'Rester' });
        if (!ok || !C.alive) return false;
      }
      if (o.before) await o.before(step);
      if (!C.alive) return false;
      C.setPhase(step);
      if (o.resume) await C.offerResume(step, label);
      return true;
    };
    // Étape revisitée dont le chrono a été arrêté : proposer de le relancer.
    C.offerResume = async (step, label) => {
      const ph = s[step];
      if (!(step === 'expose' || step === 'interview') || !ph || !ph.startedAt || !ph.endedAt) return;
      const ok = await confirmSheet({ title: 'Reprendre le chrono ?', text: `Le chrono de « ${label} » était arrêté à ${fmtClock(ph.endedAt - ph.startedAt)}. Il peut repartir de là.`, okLabel: 'Reprendre le chrono', cancelLabel: 'Laisser arrêté' });
      if (ok && C.alive && s.phase === step && ph.endedAt) { ph.startedAt += Date.now() - ph.endedAt; ph.endedAt = null; C.saveNow(); C.paint(); }
    };
    C.checkGap = async () => {
      const cur = s.phase === 'prep' ? s.prep : (s.phase === 'expose' || s.phase === 'interview') ? s[s.phase] : null;
      const seen = Number(s.lastSeenAt) || 0;
      const gap = seen ? Date.now() - seen : 0;
      if (!cur || !cur.startedAt || cur.endedAt || gap < 2 * 60000) { s.lastSeenAt = Date.now(); return; }
      // Pas d'alarmes pendant ce choix : le temps écoulé va changer.
      C.gapPending = true;
      let ok;
      try {
        ok = await confirmSheet({ title: 'Séance interrompue', text: `La séance s’est arrêtée il y a ${fmtDur(gap)}, pendant l’étape « ${phaseLabel(s)} » (${fmtClock(seen - cur.startedAt)} écoulées). Reprendre le chrono là où il s’était arrêté ?`, okLabel: 'Reprendre le chrono', cancelLabel: 'Clore l’étape' });
      } finally { C.gapPending = false; }
      if (!C.alive) return;
      if (ok) cur.startedAt += Date.now() - seen;
      else cur.endedAt = seen;
      s.lastSeenAt = Date.now();
      C.saveNow(); C.paint();
    };
    C.seen = () => {
      const n = Date.now();
      s.lastSeenAt = n;
      if (!C.seenSavedAt) C.seenSavedAt = n;
      if (n - C.seenSavedAt > 30000) { C.seenSavedAt = n; if (!C.saveT) C.saveSoon(); }
    };
    return C;
  }

  function clockOf(s, solo) {
    const n = Date.now();
    if (s.phase === 'prep') {
      const total = (Number(s.prep.durMin) || 60) * 60000;
      if (!s.prep.startedAt) return { txt: fmtClock(total), label: 'Préparation · non démarrée', state: 'idle', p: 0 };
      const left = total - ((s.prep.endedAt || n) - s.prep.startedAt);
      return { txt: fmtClock(left), label: left > 0 ? 'Préparation restante' : 'Préparation terminée', state: left <= 0 ? 'over' : left <= 5 * 60000 ? 'warn' : 'run', p: clamp(1 - left / total, 0, 1), left };
    }
    if (s.phase === 'expose' || s.phase === 'interview') {
      const ph = s[s.phase];
      if (!ph.startedAt) return { txt: '00:00', label: (s.phase === 'expose' ? 'Exposé' : (solo ? 'Jury IA' : 'Entretien')) + ' · non démarré · 15 min', state: 'idle', p: 0 };
      const el = (ph.endedAt || n) - ph.startedAt;
      const st = el >= 15 * 60000 ? 'over' : s.phase === 'expose' ? (el >= 10 * 60000 ? 'ok' : 'run') : el >= 13 * 60000 ? 'warn' : 'run';
      return { txt: fmtClock(el), label: s.phase === 'expose' ? (el < 10 * 60000 ? `Exposé · minimum 10:00` : 'Exposé · objectif 15:00') : (solo ? 'Jury IA' : 'Entretien') + ' · 15:00', state: st, p: clamp(el / (15 * 60000), 0, 1), el };
    }
    const d = durations(s);
    return { txt: fmtClock(d.prepMs + d.exposeMs + d.interviewMs).replace('+', ''), label: 'Durée totale', state: 'done', p: 1 };
  }

  function checkAlarms(C, solo) {
    const s = C.s, al = s.alarms, n = Date.now();
    const fire = (key, kind, msg) => { if (al[key]) return; al[key] = n; chime(kind); toast(msg, kind === 'end' ? 'warn' : 'info', { duration: 8000 }); C.saveSoon(); };
    if (s.phase === 'prep' && s.prep.startedAt && !s.prep.endedAt) {
      const left = (Number(s.prep.durMin) || 60) * 60000 - (n - s.prep.startedAt);
      const dur = Number(s.prep.durMin) || 60;
      if (dur > 10 && left <= 10 * 60000 && left > 5 * 60000) fire('p10-' + dur, 'soft', 'Plus que 10 minutes de préparation.');
      if (dur > 5 && left <= 5 * 60000 && left > 0) fire('p5-' + dur, 'soft', 'Plus que 5 minutes : rédigez intro, transition et conclusion.');
      if (left <= 0) fire('p0-' + dur, 'end', 'Fin de la préparation : place à l’exposé.');
    }
    if (s.phase === 'expose' && s.expose.startedAt && !s.expose.endedAt) {
      const el = n - s.expose.startedAt;
      if (el >= 10 * 60000) fire('e10', 'soft', '10 minutes : durée minimale de l’exposé atteinte.');
      if (el >= 14 * 60000) fire('e14', 'soft', 'Encore 1 minute d’exposé.');
      if (el >= 15 * 60000) fire('e15', 'end', solo ? '15 minutes : concluez.' : '15 minutes : l’exposé est terminé, passez à l’entretien.');
    }
    if (s.phase === 'interview' && s.interview.startedAt && !s.interview.endedAt) {
      const el = n - s.interview.startedAt;
      if (el >= 14 * 60000) fire('i14', 'soft', 'Encore 1 minute d’entretien.');
      if (el >= 15 * 60000) fire('i15', 'end', 'Fin des 15 minutes d’entretien.');
    }
  }

  function clockHTML(c) {
    return `<div class="ex-clock" data-state="${c.state}" role="timer" aria-live="off"><b data-b="clock">${esc(c.txt)}</b><small data-b="clock-l">${esc(c.label)}</small></div>`;
  }
  function paintClock(C, solo) {
    const c = clockOf(C.s, solo);
    const box = $('.ex-clock', C.root);
    if (!box) return c;
    box.dataset.state = c.state;
    const b = $('[data-b="clock"]', box), l = $('[data-b="clock-l"]', box);
    if (b.textContent !== c.txt) b.textContent = c.txt;
    if (l.textContent !== c.label) l.textContent = c.label;
    const sr = $('[data-b="clock-sr"]', C.root);
    if (sr && /:00$/.test(c.txt) && sr.textContent !== c.txt) sr.textContent = `${c.label} : ${c.txt}`;
    const tr = $('.ex-track', C.root);
    if (tr) tr.style.setProperty('--p', c.p.toFixed(4));
    const pr = $('.ex-prep-bar', C.root);
    if (pr) pr.style.setProperty('--p', c.p.toFixed(4));
    const zone = $('[data-b="zone"]', C.root);
    if (zone && c.el != null) {
      const m = c.el / 60000;
      const z = ZONES.find((x) => m >= x.from && m < x.to);
      zone.textContent = z ? `Repère : ${z.label.toLowerCase()} (${fmtClock(z.from * 60000)}–${fmtClock(z.to * 60000)})` : 'Au-delà de 15 minutes';
    }
    return c;
  }

  function trackHTML() {
    return `<div class="ex-track" style="--p:0" aria-hidden="true">
      <div class="ex-zones">${ZONES.map((z) => `<span style="--w:${((z.to - z.from) / 15 * 100).toFixed(2)}%" class="z-${z.id}">${esc(z.label)}</span>`).join('')}</div>
      <div class="ex-rail"><i class="ex-fill"></i><span class="ex-min" style="left:${(10 / 15 * 100).toFixed(2)}%"><small>10 min</small></span></div>
    </div>`;
  }

  function renderJury(root, s) {
    const C = baseController(root, s);
    const L = createListen(C);
    C.L = L;
    C.notes = { busy: false, lastAt: Date.now(), newChars: 0, ctrl: null };
    C.q = { busy: false, ctrl: null };
    C.ja = { busy: false, ctrl: null, req: null, item: null, error: '', noKey: false, question: '', src: '', prev: null };
    C.wantsWake = true;
    document.body.classList.add('ex-focus');
    keepAwake(true);

    root.innerHTML = `<div class="screen ex ex-console" data-phase="${s.phase}">
      <header class="topbar ex-cbar">
        <button type="button" class="icon-btn" data-go="#/" aria-label="Accueil" title="Accueil">${icon('chevron-left')}</button>
        <div class="ex-cbar-title"><b lang="en">${esc(s.subject.title)}</b><small>${themeChip(s.subject.theme, 'ex-theme-sm')}<span class="hide-mobile"> Jury · oral blanc</span></small></div>
        <div data-b="steps" class="ex-cbar-steps"></div>
        <div data-b="clock-box"></div>
        <button type="button" class="icon-btn" data-act="menu" aria-label="Plus d’actions" title="Plus d’actions">${icon('ellipsis')}</button>
      </header>
      <span class="sr-only" data-b="clock-sr" aria-live="polite"></span>
      <div class="ex-teams-bar" data-b="teams-bar"></div>
      <div class="ex-cols">
        <div class="ex-main" data-b="main"></div>
        <aside class="ex-side" data-b="side"></aside>
      </div>
      <button type="button" class="btn btn-primary ex-notes-fab" data-act="notes-sheet" aria-label="Notes du jury">${icon('edit')}<span>Notes</span></button>
    </div>`;

    C.paint = () => {
      if (!C.alive) return;
      $('.ex-console', root).dataset.phase = s.phase;
      $('[data-b="steps"]', root).innerHTML = stepper(JURY_STEPS, s.phase === 'done' ? 'review' : s.phase, C.reached);
      $('[data-b="clock-box"]', root).innerHTML = clockHTML(clockOf(s));
      const main = $('[data-b="main"]', root);
      if (s.phase === 'prep') main.innerHTML = prepJuryHTML(s);
      else if (s.phase === 'expose') main.innerHTML = exposeJuryHTML(s, L.A);
      else if (s.phase === 'interview') main.innerHTML = interviewJuryHTML(s, L.A);
      else renderReview(main, C);
      paintSide();
      paintTeamsBar();
      paintClock(C);
      if (s.phase === 'expose') { paintTranscript(); paintChecks(); paintErrors(); }
      if (s.phase === 'interview') { paintQuestion(); paintJuryAnswer(); paintTurns(); paintAsked(); }
      if ((s.phase === 'expose' || s.phase === 'interview') && L.A.pc === 'unknown') L.probe();
      if (s.phase === 'interview' && !s.interview.current && !C.q.busy) nextQuestion('next', true);
    };

    function paintSide() {
      const side = $('[data-b="side"]', root);
      const openCorr = s.phase === 'prep';
      side.innerHTML = `
        ${s.phase !== 'review' && s.phase !== 'done' ? `<section class="card card-pad ex-notes">
          <div class="card-head"><h3 class="h3">Notes du jury</h3><span class="spacer"></span><span class="kbd" title="Raccourci">N</span></div>
          <textarea class="input" rows="${s.phase === 'prep' ? 4 : 6}" data-f="jury-notes" placeholder="Remarques, fautes entendues, questions à poser…" aria-label="Notes du jury">${esc(s.expose.juryNotes)}</textarea>
        </section>` : ''}
        <details class="card card-pad ex-details ex-side-corr"${openCorr ? ' open' : ''}><summary><b>Corrigé indicatif</b><span class="small muted"> · pour le jury, ne pas partager</span></summary>${corrigeHTML(s.subject, s.phase === 'prep')}</details>
        <details class="card card-pad ex-details"${s.phase === 'expose' ? '' : ''}><summary><b>Texte du sujet</b></summary>${subjectHTML(s.subject)}</details>`;
      const ta = $('[data-f="jury-notes"]', side);
      if (ta) ta.addEventListener('input', () => { s.expose.juryNotes = ta.value; C.saveSoon(); });
      const fab = $('.ex-notes-fab', root);
      if (fab) fab.hidden = s.phase === 'review' || s.phase === 'done';
    }

    function paintTeamsBar() {
      const bar = $('[data-b="teams-bar"]', root);
      if (!bar) return;
      const link = teamsValid(s.teamsLink);
      if (s.phase === 'done' || (!link && (s.phase === 'review' || (s.phase === 'prep' && $('[data-f="teams"]', root))))) { bar.innerHTML = ''; bar.hidden = true; return; }
      bar.hidden = false;
      bar.innerHTML = link
        ? `<span class="ex-teams-ic">${icon('video')}</span><span class="grow small"><b>Réunion ${meetingApp(link)}</b> <span class="muted ex-teams-url">${esc(link.replace(/^https:\/\//, '').slice(0, 60))}${link.length > 68 ? '…' : ''}</span></span>
          <button type="button" class="btn btn-sm" data-act="teams-join">${icon('video')}<span>Rejoindre</span></button>
          <button type="button" class="btn btn-sm" data-act="teams-copy">${icon('copy')}<span class="hide-mobile">Copier pour Audrey</span><span class="show-mobile">Copier</span></button>`
        : `<span class="ex-teams-ic is-off">${icon('video')}</span><span class="grow small"><b>Pas de lien de réunion</b> <span class="muted">· collez le lien Teams ou Meet pour le rejoindre et l’envoyer à Audrey</span></span>
          <button type="button" class="btn btn-sm" data-act="teams-edit">${icon('plus')}<span>Ajouter le lien</span></button>`;
    }
    function setTeams(value, quiet) {
      const v = str(value).trim();
      const link = teamsValid(v);
      const hint = $('[data-b="teams-hint"]', root);
      const box = $('[data-b="teams"]', root);
      if (!v) { s.teamsLink = ''; C.saveSoon(); if (hint) hint.textContent = LINK_HINT; if (box) box.classList.remove('is-set', 'is-bad'); paintTeamsBar(); return ''; }
      if (!link) {
        if (hint) hint.textContent = LINK_BAD;
        if (box) { box.classList.add('is-bad'); box.classList.remove('is-set'); }
        return '';
      }
      const changed = link !== s.teamsLink;
      s.teamsLink = link; rememberTeams(link); C.saveSoon();
      if (hint) hint.textContent = 'Lien enregistré pour cette séance (et proposé pour la suivante).';
      if (box) { box.classList.add('is-set'); box.classList.remove('is-bad'); }
      paintTeamsBar();
      if (changed && !quiet) toast(`Lien ${meetingApp(link)} enregistré.`, 'ok');
      return link;
    }
    function teamsCopy() {
      const link = teamsValid(s.teamsLink);
      if (!link) { toast('Collez d’abord le lien de la réunion (Teams ou Meet).', 'warn'); teamsEdit(); return; }
      copyText(teamsMessage(link), 'Message pour Audrey (lien + consignes)');
    }
    function teamsEdit() {
      const f = $('[data-f="teams"]', root);
      if (f) { f.focus(); f.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
      const body = h(`<div class="stack">${teamsFieldHTML(s.teamsLink, { id: 'ex-teams-sheet', copy: false })}</div>`);
      const inp = $('input', body);
      sheet({
        title: 'Lien de la réunion (Teams ou Meet)', body,
        actions: [{ label: 'Annuler', kind: 'ghost' }, {
          label: 'Enregistrer', kind: 'primary', icon: 'check', close: false,
          onClick: (ctx) => { if (!inp.value.trim() || setTeams(inp.value)) { if (!inp.value.trim()) setTeams(''); ctx.close('action'); } else toast(LINK_BAD, 'warn', { duration: 7000 }); return false; }
        }]
      });
      $('[data-act="teams-join"]', body).addEventListener('click', (e) => { e.stopPropagation(); if (setTeams(inp.value, true)) openTeams(s.teamsLink); else openTeams(inp.value); });
      setTimeout(() => { try { inp.focus(); } catch (e) {  } }, 80);
    }
    function notesSheet() {
      const body = h(`<div class="stack"><textarea class="input" rows="10" data-f="sheet-notes" aria-label="Notes du jury" placeholder="Remarques, fautes entendues, questions à poser…">${esc(s.expose.juryNotes)}</textarea><p class="small muted">Enregistrées automatiquement.</p></div>`);
      const ta = $('textarea', body);
      ta.addEventListener('input', () => { s.expose.juryNotes = ta.value; C.saveSoon(); const side = $('[data-f="jury-notes"]', root); if (side) side.value = ta.value; });
      sheet({ title: 'Notes du jury', body, actions: [{ label: 'Fermer', kind: 'primary' }] });
      setTimeout(() => { try { ta.focus(); } catch (e) {  } }, 80);
    }

    function prepJuryHTML() {
      const dur = Number(s.prep.durMin) || 60;
      const started = !!s.prep.startedAt;
      return `<section class="card card-pad ex-phase">
        <div class="ex-phase-head"><span class="tile tile-blue">${icon('clock')}</span><div><h2 class="h2">Préparation</h2><p class="muted small">1 h sans dictionnaire, avec le sujet seul. Partagez le sujet dans l’appel (Teams ou Meet), puis lancez le chrono.</p></div></div>
        <div class="ex-prep-bar" style="--p:0" aria-hidden="true"><i></i></div>
        ${teamsFieldHTML(s.teamsLink, { copy: true, hint: s.teamsLink ? (teamsValid(s.teamsLink) ? 'Dernier lien utilisé, pré-rempli : vérifiez qu’il s’agit bien de la réunion du jour.' : 'Lien invalide.') : undefined })}
        <div class="field"><span class="label">Durée</span>
          <div class="seg" role="radiogroup" aria-label="Durée de préparation">${DURATIONS.map((m) => `<button type="button" role="radio" aria-checked="${m === dur}" class="${m === dur ? 'on' : ''}" data-dur="${m}">${m} min</button>`).join('')}</div></div>
        <div class="ex-actions-row">
          <button type="button" class="btn btn-lg" data-act="share">${icon('pip')}<span>Partager le sujet dans l’appel</span></button>
          <button type="button" class="btn btn-lg" data-act="copy-subject">${icon('copy')}<span>Copier le sujet</span></button>
        </div>
        <div class="ex-actions-row">
          ${started ? `<button type="button" class="btn btn-ghost" data-act="prep-restart">${icon('refresh')}<span>Recommencer le chrono</span></button>` : `<button type="button" class="btn btn-primary btn-xl" data-act="prep-start">${icon('play')}<span>Lancer la préparation</span></button>`}
          <button type="button" class="btn ${started ? 'btn-primary btn-xl' : 'btn-ghost'}" data-act="to-expose">${icon('chevron-right')}<span>Passer à l’exposé</span></button>
        </div>
        <div class="ex-tip">${icon('lightbulb')}<span>Pendant la préparation : coupez votre micro dans l’appel, vérifiez que vous entendez bien l’élève, relisez le corrigé et choisissez 3 ou 4 questions. Alarme douce à 10 min, 5 min et à la fin.</span></div>
      </section>`;
    }

    function exposeJuryHTML(st, A) {
      const started = !!s.expose.startedAt;
      return `<section class="card card-pad ex-phase">
        <div class="ex-phase-head"><span class="tile tile-violet">${icon('chat')}</span><div><h2 class="h2">Exposé · 15 min</h2><p class="muted small" data-b="zone">Intro (source, date, thème, ton) · synthèse · problématique · commentaire · conclusion</p></div></div>
        ${trackHTML()}
        ${started ? '' : `<button type="button" class="btn btn-primary btn-xl ex-wide" data-act="expose-start">${icon('play')}<span>Démarrer l’exposé</span></button><p class="small muted ex-center">« Démarrer l’exposé » lance aussi l’écoute de l’élève.</p>`}
        <div data-b="listen">${listenHTML(A, { quiet: !started })}</div>
      </section>
      <section class="card card-pad">
        <div class="card-head"><h3 class="h3">Grille de l’exposé</h3><span class="spacer"></span>${aiReady() ? `<button type="button" class="btn btn-sm btn-quiet" data-act="analyze">${icon('sparkles')}<span>Analyser maintenant</span></button>` : '<span class="small muted">À cocher à la main</span>'}</div>
        <div class="ex-checks" data-b="checks"></div>
        <div data-b="tips"></div>
      </section>
      <section class="card card-pad ex-tx-card">
        <div class="card-head"><h3 class="h3">Ce que dit l’élève</h3><span class="spacer"></span><span class="small muted" data-b="wc"></span></div>
        <div class="ex-tx" data-b="tx" lang="en"></div>
        <form class="ex-add" data-b="add"><input class="input" placeholder="Ajouter une phrase entendue (si l’écoute ne marche pas)" aria-label="Ajouter une phrase entendue" lang="en"><button type="submit" class="btn btn-sm">${icon('plus')}<span>Ajouter</span></button></form>
      </section>
      <section class="card card-pad">
        <div class="card-head"><h3 class="h3">Fautes relevées</h3><span class="spacer"></span><span class="badge" data-b="err-n">0</span></div>
        <div data-b="errors"></div>
      </section>
      <div class="ex-actions-row ex-next-row"><button type="button" class="btn btn-primary btn-lg" data-act="to-interview">${icon('chevron-right')}<span>Passer à l’entretien</span></button></div>`;
    }

    function interviewJuryHTML(st, A) {
      const started = !!s.interview.startedAt;
      return `<section class="card card-pad ex-phase ex-qphase">
        <div class="ex-phase-head"><span class="tile tile-green">${icon('person2')}</span><div><h2 class="h2">Entretien · 15 min</h2><p class="muted small">Vérifier la compréhension, faire préciser, nuancer, ouvrir. L’interaction compte.</p></div>
          ${started ? '' : `<button type="button" class="btn" data-act="interview-start" title="Le chrono démarre aussi à la première question posée">${icon('play')}<span>Démarrer le chrono</span></button>`}</div>
        <div class="ex-qbox" data-b="q" aria-live="polite"></div>
        <div data-b="janswer" aria-live="polite"></div>
        <div class="ex-kinds" role="group" aria-label="Autre question, par type">
          <span class="small muted ex-kinds-l">Autre question :</span>
          ${Object.keys(KIND_LABEL).map((k) => `<button type="button" class="btn btn-sm" data-kind="${k}">${k === 'next' ? icon('refresh') : ''}<span>${KIND_LABEL[k]}</span></button>`).join('')}
        </div>
      </section>
      <section class="card card-pad">
        <div class="card-head"><h3 class="h3">Échanges</h3></div>
        <div data-b="listen">${listenHTML(A, { quiet: true })}</div>
        <div class="ex-turns" data-b="turns"></div>
        <form class="ex-add" data-b="add"><input class="input" placeholder="Ajouter une réponse entendue" aria-label="Ajouter une réponse entendue" lang="en"><button type="submit" class="btn btn-sm">${icon('plus')}<span>Ajouter</span></button></form>
      </section>
      <section class="card card-pad"><div class="card-head"><h3 class="h3">Questions posées</h3><span class="spacer"></span><span class="badge" data-b="asked-n">0</span></div><ol class="ex-asked" data-b="asked"></ol></section>
      <div class="ex-actions-row ex-next-row"><button type="button" class="btn btn-primary btn-lg" data-act="to-review">${icon('star')}<span>Terminer et passer au bilan</span></button></div>`;
    }

    C.paintListen = () => { const b = $('[data-b="listen"]', root); if (b) b.innerHTML = listenHTML(L.A, { quiet: s.phase !== 'expose' || !s.expose.startedAt }); };
    C.stopListen = (o) => {
      if (!L.A.on && !L.A.starting) return Promise.resolve();
      C.drainPhase = s.phase;
      return L.stop(o).finally(() => { C.drainPhase = null; });
    };
    C.paintInterim = () => {
      const tx = $('[data-b="tx"]', root) || $('[data-b="turns"]', root);
      if (!tx) return;
      let it = $('.ex-interim', tx);
      if (!L.A.interim) { if (it) it.remove(); return; }
      if (!it) { it = document.createElement('p'); it.className = 'ex-interim'; tx.appendChild(it); }
      it.textContent = L.A.interim;
      tx.scrollTop = tx.scrollHeight;
    };

    function paintTranscript() {
      const tx = $('[data-b="tx"]', root);
      if (!tx) return;
      const list = arr(s.expose.transcript);
      const near = tx.scrollHeight - tx.scrollTop - tx.clientHeight < 80;
      tx.innerHTML = list.length ? list.slice(-80).map((x) => `<p><time>${fmtClock(x.t)}</time>${esc(x.text)}</p>`).join('')
        : `<p class="ex-empty-tx">${L.A.on ? 'En attente de la voix de l’élève…' : 'Lancez l’écoute pour transcrire l’exposé, ou notez à la main.'}</p>`;
      if (near) tx.scrollTop = tx.scrollHeight;
      const wc = $('[data-b="wc"]', root);
      if (wc) wc.textContent = list.length ? `${words(exposeText(s))} mots` : '';
      C.paintInterim();
    }
    function paintChecks() {
      const box = $('[data-b="checks"]', root);
      if (!box) return;
      box.innerHTML = CHECKS.map(([k, l]) => {
        const on = !!s.expose.checklist[k];
        return `<button type="button" class="ex-check${on ? ' on' : ''}" data-check="${k}" aria-pressed="${on}"><span class="ex-check-ic">${icon(on ? 'check' : 'plus')}</span><span>${esc(l)}</span>${on && s.expose.checklistAuto[k] ? '<small>IA</small>' : ''}</button>`;
      }).join('');
      const tips = $('[data-b="tips"]', root);
      if (tips) {
        const t = arr(s.expose.tips);
        tips.innerHTML = (C.notes.busy ? `<p class="small muted ex-analyzing"><span class="spinner spinner-xs"></span> Analyse en cours…</p>` : '')
          + (t.length ? `<ul class="ex-tips">${t.map((x) => `<li>${icon('lightbulb')}<span>${esc(x)}</span></li>`).join('')}</ul>` : '');
      }
    }
    function paintErrors() {
      const box = $('[data-b="errors"]', root);
      if (!box) return;
      const list = arr(s.expose.errors);
      $('[data-b="err-n"]', root).textContent = list.length;
      box.innerHTML = list.length ? `<ul class="ex-errlist">${list.slice().reverse().map((x, i) => `<li><span class="ex-said" lang="en">${esc(x.said)}</span><span class="ex-arrow">→</span><span class="ex-better" lang="en">${esc(x.better)}</span>${x.rule ? `<small>${esc(x.rule)}</small>` : ''}<button type="button" class="icon-btn icon-btn-sm" data-del-err="${list.length - 1 - i}" aria-label="Retirer cette faute">${icon('xmark')}</button></li>`).join('')}</ul>`
        : `<p class="small muted">${aiReady() ? 'Les fautes de langue apparaissent ici pendant l’exposé (analyse toutes les ~35 s de parole).' : 'Notez les fautes dans « Notes du jury ».'}</p>`;
    }

    C.onHeard = (role, text, ev) => {
      if (!text) return;
      L.A.interim = '';
      const phase = (s.phase === 'expose' || s.phase === 'interview') ? s.phase : C.drainPhase;
      if (phase === 'expose') {
        if (role !== 'student') return;
        if (!s.expose.startedAt) { s.expose.startedAt = Date.now(); toast('Chrono de l’exposé lancé à la première phrase.', 'info'); paintClock(C); const b = $('[data-act="expose-start"]', root); if (b) b.remove(); }
        s.expose.transcript.push({ t: Date.now() - s.expose.startedAt, text });
        C.notes.newChars += text.length;
        paintTranscript();
      } else if (phase === 'interview') {
        s.interview.turns.push({ who: role, text, t: s.interview.startedAt ? Date.now() - s.interview.startedAt : 0 });
        paintTurns();
        if (role === 'jury' && ev && ev.who === 'me' && L.split() && phase === s.phase) juryHeard(text);
      } else return;
      C.saveSoon();
    };

    async function runLiveNotes(force) {
      if (C.notes.busy || !aiReady() || !aiHas('liveNotes')) { if (force && !aiReady()) noAI('L’analyse en direct'); return; }
      const text = exposeText(s);
      if (words(text) < 15) { if (force) toast('Pas encore assez de texte à analyser.', 'info'); return; }
      C.notes.busy = true; C.notes.lastAt = Date.now(); C.notes.newChars = 0;
      paintChecks();
      const ctrl = C.notes.ctrl = new AbortController();
      try {
        const r = await S.examAI.liveNotes({ subject: s.subject, transcript: text, elapsedMs: s.expose.startedAt ? Date.now() - s.expose.startedAt : 0, knownErrors: arr(s.expose.errors), signal: ctrl.signal });
        if (!C.alive || !r) return;
        const cov = r.covered || {};
        if (r.source !== 'local') CHECKS.forEach(([k]) => { if (cov[k] === true && !s.expose.checklist[k]) { s.expose.checklist[k] = true; s.expose.checklistAuto[k] = true; } });
        const seen = new Set(arr(s.expose.errors).map((x) => norm(x.said)));
        arr(r.errors).slice(0, 6).forEach((x) => { if (x && x.said && !seen.has(norm(x.said))) { seen.add(norm(x.said)); s.expose.errors.push({ said: str(x.said), better: str(x.better), rule: str(x.rule) }); } });
        if (arr(r.tips).length) s.expose.tips = r.tips.map(str).slice(0, 3);
        C.saveSoon();
      } catch (e) {
        if (!isAbort(e) && force) toast('Analyse impossible : ' + errMsg(e), 'err');
      } finally {
        C.notes.busy = false;
        if (C.alive && s.phase === 'expose') { paintChecks(); paintErrors(); }
      }
    }

    function paintQuestion() {
      const box = $('[data-b="q"]', root);
      if (!box) return;
      const q = s.interview.current;
      if (C.q.busy) { box.innerHTML = `<div class="ex-q-loading"><span class="spinner"></span><span>Je prépare une question…</span></div>`; return; }
      if (!q) { box.innerHTML = `<p class="muted">Choisissez un type de question ci-dessous.</p>`; return; }
      const asked = arr(s.interview.asked).some((a) => a.en === q.en);
      box.innerHTML = `<div class="ex-q-top"><span class="pill pill-xs ${q.src === 'ai' ? 'pill-accent' : ''}">${esc(KIND_LABEL[q.kind] || 'Question')}${q.src === 'ai' ? ' · IA' : q.src === 'prep' ? ' · corrigé' : ''}</span>${asked ? `<span class="pill pill-xs pill-ok">${icon('check')}Posée</span>` : ''}</div>
        <p class="ex-q-en" lang="en">${esc(q.en)}</p>
        ${q.fr ? `<p class="ex-q-fr">${esc(q.fr)}</p>` : ''}
        ${q.why || q.expect ? `<details class="ex-details ex-q-more"><summary>Pourquoi cette question · réponse attendue</summary>${q.why ? `<p><b>Pourquoi :</b> ${esc(q.why)}</p>` : ''}${q.expect ? `<p><b>Attendu :</b> ${esc(q.expect)}</p>` : ''}</details>` : ''}
        <div class="row ex-q-actions">
          ${asked
            ? `<button type="button" class="btn btn-primary" data-act="q-next">${icon('chevron-right')}<span>Question suivante</span><span class="kbd">Espace</span></button>`
            : `<button type="button" class="btn btn-primary" data-act="mark-asked">${icon('check')}<span>Marquer comme posée</span><span class="kbd">Espace</span></button>`}
          <button type="button" class="btn" data-act="read-q">${icon('speaker')}<span>Lire à voix haute</span><span class="kbd">L</span></button>
          <button type="button" class="btn" data-act="q-model">${icon('sparkles')}<span>Réponse modèle</span></button>
        </div>`;
    }

    function juryHeard(text) {
      const now = Date.now();
      const prev = C.ja.prev;
      C.ja.prev = { text, at: now };
      let isQ = false;
      try { isQ = aiHas('isJuryQuestion') ? !!S.examAI.isJuryQuestion(text) : /\?\s*$/.test(text); } catch (e) { isQ = false; }
      if (!isQ || !aiReady()) return;
      askModel(prev && now - prev.at < 8000 ? prev.text + ' ' + text : text, 'heard');
    }
    async function askModel(question, src) {
      if (C.ja.ctrl) C.ja.ctrl.abort();
      const req = {};
      Object.assign(C.ja, { req, ctrl: null, busy: false, item: null, error: '', noKey: false, question, src });
      if (!aiHas('juryAnswer')) { C.ja.error = 'Réponse modèle indisponible : rechargez la page (Aide Visio vient d’être mis à jour).'; paintJuryAnswer(); return; }
      if (!aiReady()) { C.ja.error = 'Pas de clé IA : ajoutez-en une dans Réglages.'; C.ja.noKey = true; paintJuryAnswer(); return; }
      const ctrl = C.ja.ctrl = new AbortController();
      C.ja.busy = true;
      paintJuryAnswer();
      try {
        const r = await S.examAI.juryAnswer({ subject: s.subject, question, expose: exposeText(s), turns: arr(s.interview.turns).slice(-12).map((t) => ({ who: t.who, text: t.text })), signal: ctrl.signal });
        if (C.ja.req !== req || !C.alive) return;
        const item = { question, expect: str(r && r.expect).trim(), model: str(r && r.model).trim(), at: nowIso() };
        if (!item.expect && !item.model) throw new Error('Réponse vide de l’IA — réessayez.');
        s.interview.modelAnswers = arr(s.interview.modelAnswers).concat(item).slice(-40);
        C.ja.item = item;
        C.saveSoon();
      } catch (e) {
        if (C.ja.req !== req || isAbort(e)) return;
        C.ja.noKey = !!(e && e.code === 'NO_KEY');
        C.ja.error = C.ja.noKey ? 'Pas de clé IA : ajoutez-en une dans Réglages.' : errMsg(e);
      } finally {
        if (C.ja.req === req) { C.ja.busy = false; C.ja.ctrl = null; if (C.alive) paintJuryAnswer(); }
      }
    }
    function paintJuryAnswer() {
      const box = $('[data-b="janswer"]', root);
      if (!box) return;
      const j = C.ja;
      if (!j.question) { box.innerHTML = ''; return; }
      const expect = j.item ? j.item.expect.replace(/^\s*attendu\s*:\s*/i, '') : '';
      box.innerHTML = `<section class="ex-janswer${j.error ? ' is-err' : ''}" aria-busy="${j.busy}">
        <div class="ex-janswer-head">${icon('sparkles')}<b>Réponse attendue (IA)</b><span class="pill pill-xs">Pour le jury</span></div>
        <p class="ex-janswer-q"><span class="muted">${j.src === 'heard' ? 'Question entendue' : 'Question proposée'} :</span> <span lang="en">${esc(j.question)}</span></p>
        ${j.busy ? '<div class="ex-q-loading"><span class="spinner"></span><span>Je prépare la réponse attendue…</span></div>' : ''}
        ${j.error ? `<p class="ex-janswer-err">${esc(j.error)}</p><div class="row">${j.noKey ? `<button type="button" class="btn btn-sm" data-go="#/settings">${icon('gear')}<span>Réglages</span></button>` : ''}<button type="button" class="btn btn-sm" data-act="ja-retry">${icon('refresh')}<span>Réessayer</span></button></div>` : ''}
        ${j.item && expect ? `<p class="ex-janswer-exp"><b>Attendu :</b> ${esc(expect)}</p>` : ''}
        ${j.item && j.item.model ? `<p class="ex-janswer-model"><b>Réponse modèle :</b> <span lang="en">${esc(j.item.model)}</span></p>` : ''}
      </section>`;
    }
    function readQuestion() {
      const q = s.interview.current;
      if (!q) return;
      C.speakingUntil = Date.now() + 2500 + q.en.length * 90;
      speakEn(q.en).then(() => { C.speakingUntil = Date.now() + 1000; });
    }
    function paintTurns() {
      const box = $('[data-b="turns"]', root);
      if (!box) return;
      const t = arr(s.interview.turns);
      box.innerHTML = t.length ? t.slice(-60).map((x) => `<p class="ex-turn ex-turn-${x.who === 'jury' ? 'jury' : 'student'}"><b>${x.who === 'jury' ? 'Jury' : 'Élève'}</b><span lang="en">${esc(x.text)}</span></p>`).join('')
        : `<p class="ex-empty-tx">Les questions posées et les réponses de l’élève s’affichent ici.</p>`;
      box.scrollTop = box.scrollHeight;
      C.paintInterim();
    }
    function paintAsked() {
      const box = $('[data-b="asked"]', root);
      if (!box) return;
      const a = arr(s.interview.asked);
      $('[data-b="asked-n"]', root).textContent = a.length;
      box.innerHTML = a.length ? a.map((x) => `<li><span lang="en">${esc(x.en)}</span>${x.fr ? `<small>${esc(x.fr)}</small>` : ''}${x.why || x.expect ? `<details class="ex-details ex-q-more"><summary>Pourquoi · réponse attendue</summary>${x.why ? `<p><b>Pourquoi :</b> ${esc(x.why)}</p>` : ''}${x.expect ? `<p><b>Attendu :</b> ${esc(x.expect)}</p>` : ''}</details>` : ''}</li>`).join('') : '<li class="muted small">Aucune pour l’instant.</li>';
    }
    function fallbackQuestion(kind) {
      const used = new Set(arr(s.interview.asked).map((x) => x.en).concat(arr(s.interview.skipped)));
      if (kind === 'news') {
        const q = GENERIC.news.find((x) => !used.has(x.en));
        const facts = arr(s.subject.corrige.news);
        if (q) return Object.assign({ kind, src: 'generic', why: 'Vérifier que l’élève relie le sujet à l’actualité.', expect: facts.length ? 'Par exemple : ' + facts.slice(0, 2).join(' / ') : '' }, q);
      }
      const bank = GENERIC[kind] || GENERIC.next;
      const q = bank.find((x) => !used.has(x.en)) || bank[Math.floor(Math.random() * bank.length)];
      return Object.assign({ kind, src: 'generic' }, q);
    }
    async function nextQuestion(kind, silent) {
      if (C.q.busy) return;
      const cur = s.interview.current;
      if (cur && !arr(s.interview.asked).some((a) => a.en === cur.en)) {
        s.interview.skipped = arr(s.interview.skipped).concat(cur.en).slice(-40);
        if (!silent) toast('Question passée (non posée).', 'info', { duration: 2500 });
      }
      let q = null;
      if (kind === 'next') {
        const used = new Set(arr(s.interview.asked).map((x) => x.en).concat(arr(s.interview.skipped)));
        const p = arr(s.subject.corrige.juryQuestions).find((x) => x && x.en && !used.has(x.en));
        if (p) q = { en: p.en, fr: p.fr, why: p.why, expect: p.expect, kind, src: 'prep' };
      }
      if (!q && aiReady() && aiHas('juryQuestion')) {
        C.q.busy = true; paintQuestion();
        if (C.q.ctrl) C.q.ctrl.abort();
        const ctrl = C.q.ctrl = new AbortController();
        try {
          const r = await S.examAI.juryQuestion({
            subject: s.subject, expose: exposeText(s), interview: arr(s.interview.turns).map((t) => ({ who: t.who, text: t.text })),
            asked: arr(s.interview.asked).map((x) => x.en), kind, signal: ctrl.signal
          });
          if (r && r.en) {
            const bank = r.source === 'bank';
            q = { en: str(r.en), fr: str(r.fr), why: bank ? '' : str(r.why), expect: str(r.expect), kind, src: bank ? 'generic' : 'ai' };
            if (bank && !silent) toast('Question IA indisponible : question de secours.', 'warn');
          }
        } catch (e) {
          if (isAbort(e)) { C.q.busy = false; return; }
          if (!silent) toast('Question IA indisponible : ' + errMsg(e) + ' — question de secours.', 'warn');
        } finally { C.q.busy = false; }
      }
      if (!C.alive) return;
      s.interview.current = q || fallbackQuestion(kind);
      C.saveSoon();
      paintQuestion();
    }
    function markAsked() {
      const q = s.interview.current;
      if (!q || arr(s.interview.asked).some((a) => a.en === q.en)) return;
      if (!s.interview.startedAt) { s.interview.startedAt = Date.now(); const b = $('[data-act="interview-start"]', root); if (b) b.remove(); paintClock(C); }
      s.interview.asked.push({ en: q.en, fr: q.fr || '', why: q.why || '', expect: q.expect || '', t: Date.now() - s.interview.startedAt });
      if (!L.split() || !L.A.on) s.interview.turns.push({ who: 'jury', text: q.en, t: Date.now() - s.interview.startedAt });
      C.saveSoon();
      paintQuestion(); paintAsked(); paintTurns();
      toast('Question marquée comme posée.', 'ok', { duration: 2000 });
    }

    function menuSheet() {
      const body = h(`<div class="list">
        <button type="button" class="list-row" data-m="share"><span class="tile tile-blue">${icon('pip')}</span><span class="list-main"><b>Ouvrir le sujet à partager</b><small>Fenêtre propre, sans corrigé</small></span></button>
        <button type="button" class="list-row" data-m="copy"><span class="tile tile-teal">${icon('copy')}</span><span class="list-main"><b>Copier le sujet</b><small>Texte brut pour le chat de l’appel</small></span></button>
        <button type="button" class="list-row" data-m="export"><span class="tile tile-green">${icon('download')}</span><span class="list-main"><b>Exporter la séance (.md)</b></span></button>
        <button type="button" class="list-row" data-m="teams"><span class="tile tile-blue">${icon('video')}</span><span class="list-main"><b>Lien de la réunion (Teams ou Meet)</b><small>${teamsValid(s.teamsLink) ? 'Modifier le lien' : 'Ajouter le lien'}</small></span></button>
        <button type="button" class="list-row" data-m="keys"><span class="tile tile-gray">${icon('keyboard')}</span><span class="list-main"><b>Raccourcis clavier</b><small>Espace : posée, puis suivante · N : notes · L : lire</small></span></button>
        <button type="button" class="list-row" data-m="delete"><span class="tile tile-red">${icon('trash')}</span><span class="list-main"><b>Supprimer la séance</b></span></button>
      </div>`);
      const sh = sheet({ title: 'Séance', body });
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = b.dataset.m;
        if (sh) sh.close('action');
        if (m === 'share') shareSubject(s.subject);
        else if (m === 'copy') copyText(subjectPlain(s.subject), 'Sujet');
        else if (m === 'export') downloadText(exportMd(s), `oral-blanc-${s.createdAt.slice(0, 10)}.md`);
        else if (m === 'teams') teamsEdit();
        else if (m === 'keys') sheet({ title: 'Raccourcis clavier', body: `<div class="ex-keys"><p><span class="kbd">Espace</span> entretien : marquer la question comme posée, puis passer à la suivante</p><p><span class="kbd">N</span> aller aux notes du jury</p><p><span class="kbd">L</span> lire la question à voix haute</p></div>`, actions: [{ label: 'OK', kind: 'primary' }] });
        else if (m === 'delete' && await confirmSheet({ title: 'Supprimer cette séance ?', text: 'La transcription, les notes et le bilan seront effacés.', okLabel: 'Supprimer', danger: true })) {
          // Marquée supprimée avant l'arrêt : un résultat tardif ne doit plus réenregistrer la séance.
          C.deleted = true; C.alive = false;
          await L.stop({ drainMs: 0 });
          clearTimeout(C.saveT); C.saveT = 0;
          store.remove(s.id); toast('Séance supprimée.', 'ok'); go('#/');
        }
      });
    }

    root.addEventListener('click', (e) => {
      const st = e.target.closest('[data-step]');
      if (st && !st.disabled) {
        C.stepTo(st.dataset.step, {
          steps: JURY_STEPS, resume: true,
          before: (to) => { if (to === 'prep' || to === 'review') C.stopListen(); }
        });
        return;
      }
      const dur = e.target.closest('[data-dur]');
      if (dur) {
        s.prep.durMin = Number(dur.dataset.dur);
        C.saveNow(); C.paint(); toast(`Préparation : ${s.prep.durMin} minutes.`, 'info'); return;
      }
      const ck = e.target.closest('[data-check]');
      if (ck) { const k = ck.dataset.check; s.expose.checklist[k] = !s.expose.checklist[k]; delete s.expose.checklistAuto[k]; C.saveSoon(); paintChecks(); return; }
      const de = e.target.closest('[data-del-err]');
      if (de) { s.expose.errors.splice(Number(de.dataset.delErr), 1); C.saveSoon(); paintErrors(); return; }
      const src = e.target.closest('[data-src]');
      if (src && !src.disabled) { L.A.preset = src.dataset.src; setPrefs({ listenPreset: L.A.preset }); C.paintListen(); return; }
      const kd = e.target.closest('[data-kind]');
      if (kd) { nextQuestion(kd.dataset.kind); return; }
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (reviewClicks(C, $('[data-b="main"]', root), act)) return;
      if (act === 'menu') menuSheet();
      else if (act === 'notes-sheet') notesSheet();
      else if (act === 'teams-join') {
        const f = $('[data-f="teams"]', root);
        if (f && f.value.trim() && f.value.trim() !== s.teamsLink) setTeams(f.value, true);
        if (teamsValid(s.teamsLink)) openTeams(s.teamsLink); else if (f && f.value.trim()) openTeams(f.value); else { toast('Collez d’abord le lien de la réunion (Teams ou Meet).', 'warn'); teamsEdit(); }
      }
      else if (act === 'teams-copy') {
        const f = $('[data-f="teams"]', root);
        if (f && f.value.trim() && f.value.trim() !== s.teamsLink) setTeams(f.value, true);
        teamsCopy();
      }
      else if (act === 'teams-edit') teamsEdit();
      else if (act === 'share') shareSubject(s.subject);
      else if (act === 'copy-subject') copyText(subjectPlain(s.subject), 'Sujet');
      else if (act === 'prep-start') { s.prep.startedAt = Date.now(); s.prep.endedAt = null; C.saveNow(); C.paint(); chime('soft'); toast(`Préparation lancée : ${s.prep.durMin} minutes.`, 'ok'); }
      else if (act === 'prep-restart') {
        confirmSheet({ title: 'Recommencer le chrono ?', text: 'Le temps de préparation repart de zéro.', okLabel: 'Recommencer' }).then((ok) => {
          if (!ok) return;
          s.prep.startedAt = Date.now(); s.prep.endedAt = null;
          Object.keys(s.alarms).filter((k) => /^p/.test(k)).forEach((k) => delete s.alarms[k]);
          C.saveNow(); C.paint(); toast('Chrono relancé.', 'ok');
        });
      }
      else if (act === 'to-expose') { C.setPhase('expose'); C.offerResume('expose', 'Exposé'); }
      else if (act === 'expose-start') {
        s.expose.startedAt = Date.now(); s.expose.endedAt = null; C.saveNow(); b.remove(); paintClock(C); toast('Exposé lancé : 15 minutes.', 'ok');
        if (!L.A.on) L.start();
      }
      else if (act === 'listen-start') L.start();
      else if (act === 'listen-stop') L.stop().then(() => toast('Écoute arrêtée.', 'info'));
      else if (act === 'analyze') runLiveNotes(true);
      else if (act === 'to-interview') {
        const ms = durations(s).exposeMs;
        const short = s.expose.startedAt && ms < 10 * 60000;
        (short ? confirmSheet({ title: 'Exposé trop court', text: `L’exposé n’a duré que ${fmtDur(ms)} (minimum 10 minutes, sinon c’est pénalisé). Passer quand même à l’entretien ?`, okLabel: 'Passer à l’entretien', cancelLabel: 'Continuer l’exposé' }) : Promise.resolve(true))
          .then((ok) => { if (ok && C.alive) { C.setPhase('interview'); C.offerResume('interview', 'Entretien'); } });
      }
      else if (act === 'interview-start') { s.interview.startedAt = Date.now(); C.saveNow(); b.remove(); paintClock(C); toast('Entretien lancé : 15 minutes.', 'ok'); }
      else if (act === 'mark-asked') markAsked();
      else if (act === 'q-next') nextQuestion('next', true);
      else if (act === 'read-q') readQuestion();
      else if (act === 'q-model') { if (s.interview.current) askModel(s.interview.current.en, 'suggested'); }
      else if (act === 'ja-retry') { if (C.ja.question) askModel(C.ja.question, C.ja.src); }
      else if (act === 'to-review') {
        const ms = durations(s).interviewMs;
        const short = s.interview.startedAt && ms < 15 * 60000;
        (short ? confirmSheet({ title: 'Terminer l’entretien ?', text: `L’entretien n’a duré que ${fmtDur(ms)} (prévu : 15 minutes). Terminer quand même et passer au bilan ?`, okLabel: 'Terminer', cancelLabel: 'Continuer' }) : Promise.resolve(true))
          .then((ok) => { if (!ok || !C.alive) return; C.stopListen(); C.setPhase('review'); });
      }
    });
    root.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-b="add"]');
      if (!f) return;
      e.preventDefault();
      const inp = $('input', f);
      const t = inp.value.trim();
      if (!t) return;
      inp.value = '';
      C.onHeard('student', t);
      toast('Ajouté.', 'ok');
    });
    root.addEventListener('input', (e) => { const f = e.target.closest && e.target.closest('[data-f="teams"]'); if (f && teamsValid(f.value)) setTeams(f.value, true); });
    root.addEventListener('change', (e) => {
      const f = e.target.closest && e.target.closest('[data-f="teams"]');
      if (!f) return;
      const ok = setTeams(f.value, true);
      if (ok && f.value !== ok) f.value = ok;
      if (ok && ok !== C.teamsAnnounced) { C.teamsAnnounced = ok; toast(`Lien ${meetingApp(ok)} enregistré : « Rejoindre » ou « Copier pour Audrey ».`, 'ok'); }
    });

    const offTick = onTick(() => {
      if (!C.alive) return;
      C.seen();
      paintClock(C);
      if (!C.gapPending) checkAlarms(C);
      if (s.phase === 'expose' && !C.notes.busy && C.notes.newChars >= 80 && Date.now() - C.notes.lastAt >= 35000 && aiReady()) runLiveNotes(false);
    });

    C.paint();
    C.checkGap();
    setCurrent({
      wantsWake: true,
      flush() { if (C.deleted) return; s.lastSeenAt = Date.now(); C.saveNow(); },
      busy() { return L.A.on || L.A.starting || ['prep', 'expose', 'interview'].some((p) => s.phase === p && s[p].startedAt && !s[p].endedAt); },
      key(e) {
        if (e.key === ' ' && s.phase === 'interview') {
          e.preventDefault();
          const q = s.interview.current;
          if (q && !arr(s.interview.asked).some((a) => a.en === q.en)) markAsked(); else nextQuestion('next', true);
        }
        else if (e.key === 'n' || e.key === 'N') {
          const t = $('[data-f="jury-notes"]', root);
          e.preventDefault();
          if (t && t.offsetParent && window.matchMedia('(min-width: 760px)').matches) { t.focus(); t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else if (s.phase !== 'review' && s.phase !== 'done') notesSheet();
        }
        else if ((e.key === 'l' || e.key === 'L') && s.interview.current && s.phase === 'interview') { e.preventDefault(); readQuestion(); }
      },
      async canLeave() {
        if (!L.A.on && !L.A.starting) return true;
        return confirmSheet({ title: 'Quitter la console ?', text: 'L’écoute de l’élève est active : elle sera arrêtée. La séance reste enregistrée et peut être reprise.', okLabel: 'Quitter', cancelLabel: 'Rester' });
      },
      leave() {
        C.alive = false;
        offTick();
        if (C.notes.ctrl) C.notes.ctrl.abort();
        if (C.q.ctrl) C.q.ctrl.abort();
        if (C.ja.ctrl) C.ja.ctrl.abort();
        if (C.evalCtrl) C.evalCtrl.abort();
        if (!C.deleted) { s.lastSeenAt = Date.now(); C.saveNow(); }
        L.stop({ drainMs: 0 });
      }
    });
  }

  function shareSubject(subject) {
    // Appli Android : pas de seconde fenêtre possible, on copie le sujet à la place.
    if (/AideVisioAndroid/.test(navigator.userAgent)) { copyText(subjectPlain(subject), 'Sujet'); return; }
    const url = location.href.split('#')[0] + '#/sujet/' + encodeURIComponent(subject.id);
    const w = window.open(url, 'aidevisio-sujet', 'popup=yes,width=980,height=900');
    if (w) { try { w.focus(); } catch (e) {  } toast('Sujet ouvert : dans Teams ou Meet, « Partager » puis choisissez cette fenêtre.', 'ok', { duration: 7000 }); }
    else toast('Fenêtre bloquée par le navigateur : autorisez les fenêtres pop-up, ou utilisez « Copier le sujet ».', 'warn', { duration: 8000 });
  }

  function renderSujet(root, params) {
    const s = store.getSubject(params.id);
    const prevTheme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'light';
    document.body.classList.add('ex-reading');
    let zoom = clamp(Number(prefs().readZoom) || 1.15, 0.8, 2);
    if (!s) {
      root.innerHTML = `<div class="screen"><div class="empty empty-page card"><div class="empty-ic">${icon('doc')}</div><h1 class="h2">Sujet introuvable</h1><p class="muted">Ce sujet n’existe pas sur cet appareil.</p></div></div>`;
    } else {
      root.innerHTML = `<div class="ex-read" style="--zoom:${zoom}">
        <div class="ex-read-tools" role="toolbar" aria-label="Affichage">
          <button type="button" class="icon-btn icon-btn-sm" data-z="-1" aria-label="Réduire le texte" title="Réduire">A−</button>
          <button type="button" class="icon-btn icon-btn-sm" data-z="1" aria-label="Agrandir le texte" title="Agrandir">A+</button>
          <button type="button" class="icon-btn icon-btn-sm" data-act="fs" aria-label="Plein écran" title="Plein écran">${icon('pip')}</button>
        </div>
        ${subjectHTML(s, { big: true })}
      </div>`;
      document.title = s.title + ' — Oral blanc';
      root.addEventListener('click', (e) => {
        const z = e.target.closest('[data-z]');
        if (z) {
          zoom = clamp(round1(zoom + Number(z.dataset.z) * 0.1), 0.8, 2);
          $('.ex-read', root).style.setProperty('--zoom', zoom);
          setPrefs({ readZoom: zoom });
          return;
        }
        if (e.target.closest('[data-act="fs"]')) {
          try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (er) { toast('Plein écran indisponible.', 'warn'); }
        }
      });
    }
    setCurrent({
      leave() {
        document.body.classList.remove('ex-reading');
        document.documentElement.dataset.theme = prevTheme || 'light';
        document.title = 'Aide Visio';
      }
    });
  }

  function renderSolo(root, s) {
    const C = baseController(root, s);
    C.rec = null; C.listening = false; C.interim = ''; C.ctrl = null;
    C.qa = { state: 'idle', q: null, answer: '', fb: null, busy: false, showText: !!prefs().showQText };
    C.wantsWake = true;
    document.body.classList.add('ex-focus');
    keepAwake(true);
    if (s.kind !== 'solo') s.kind = 'solo';
    if (!s.prep.notes || typeof s.prep.notes !== 'object') s.prep.notes = { intro: str(s.prep.notes) };

    root.innerHTML = `<div class="screen ex ex-console ex-solo" data-phase="${s.phase}">
      <header class="topbar ex-cbar">
        <button type="button" class="icon-btn" data-go="#/eleve" aria-label="Retour" title="Retour">${icon('chevron-left')}</button>
        <div class="ex-cbar-title"><b>Entraînement</b><small data-b="theme">${themeChip(s.subject.theme, 'ex-theme-sm')}</small></div>
        <div data-b="steps" class="ex-cbar-steps"></div>
        <div data-b="clock-box"></div>
      </header>
      <span class="sr-only" data-b="clock-sr" aria-live="polite"></span>
      <span class="sr-only" data-b="qa-sr" aria-live="polite"></span>
      <div data-b="main" class="ex-solo-main"></div>
    </div>`;
    C.say = (t) => {
      const el = $('[data-b="qa-sr"]', root);
      if (!el) return;
      el.textContent = '';
      setTimeout(() => { if (C.alive) el.textContent = t; }, 60);
    };
    const didStep = (id) => (id === 'prep' ? !!s.prep.startedAt : id === 'expose' ? !!s.expose.startedAt : id === 'interview' ? !!s.interview.startedAt || arr(s.interview.asked).length > 0 : !!s.evaluation || s.phase === 'done');

    C.paint = () => {
      if (!C.alive) return;
      $('.ex-console', root).dataset.phase = s.phase;
      $('[data-b="steps"]', root).innerHTML = s.quick ? '' : stepper(SOLO_STEPS, s.phase === 'done' ? 'review' : s.phase, C.reached, didStep);
      $('[data-b="theme"]', root).innerHTML = themeChip(s.subject.theme, 'ex-theme-sm');
      $('[data-b="clock-box"]', root).innerHTML = clockHTML(clockOf(s, true));
      const main = $('[data-b="main"]', root);
      if (s.phase === 'prep') { main.innerHTML = soloPrepHTML(); bindNotes(); }
      else if (s.phase === 'expose') main.innerHTML = soloExposeHTML();
      else if (s.phase === 'interview') main.innerHTML = soloJuryHTML();
      else renderReview(main, C);
      paintClock(C, true);
      if (s.phase === 'interview') paintQA();
    };

    const notesLong = (id, v) => {
      const f = NOTE_FIELDS.find((x) => x.id === id);
      if (!f || f.written) return false;
      return str(v).split(/\n|[•;]/).some((line) => words(line) >= 14);
    };
    function soloPrepHTML() {
      const dur = Number(s.prep.durMin) || 60;
      const started = !!s.prep.startedAt;
      const strict = s.prep.strict !== false;
      const notes = s.prep.notes;
      return `<div class="ex-solo-prep${strict ? ' is-strict' : ''}">
        <section class="card card-pad ex-phase">
          <div class="ex-phase-head"><span class="tile tile-blue">${icon('clock')}</span><div><h2 class="h2">Préparation</h2><p class="muted small">Sans dictionnaire. Rédigez seulement l’intro, la transition et la conclusion ; le reste en mots-clés.</p></div></div>
          <div class="ex-prep-bar" style="--p:0" aria-hidden="true"><i></i></div>
          <div class="row ex-prep-ctl">
            <div class="seg" role="radiogroup" aria-label="Durée">${SOLO_DURATIONS.map((m) => `<button type="button" role="radio" aria-checked="${m === dur}" class="${m === dur ? 'on' : ''}" data-dur="${m}">${m} min</button>`).join('')}</div>
            <label class="row ex-strict"><span class="switch switch-sm"><input type="checkbox" data-f="help"${strict ? '' : ' checked'}><span></span></span><span class="small">Afficher l’aide-mémoire</span></label>
          </div>
          ${started ? '' : `<button type="button" class="btn btn-primary btn-xl ex-wide" data-act="prep-start">${icon('play')}<span>Découvrir le sujet et lancer le chrono</span></button>`}
        </section>
        ${started ? `<div class="ex-solo-grid">
          <section class="card card-pad ex-solo-subject">${subjectHTML(s.subject)}</section>
          <section class="card card-pad ex-draft">
            <div class="card-head"><h3 class="h3">Brouillon</h3><span class="spacer"></span><span class="small muted">Enregistré automatiquement</span></div>
            ${NOTE_FIELDS.map((f) => `<div class="field ex-draft-f${notesLong(f.id, notes[f.id]) ? ' is-long' : ''}" data-nf="${f.id}">
              <label for="ex-n-${f.id}">${esc(f.label)} <small class="muted">· ${esc(f.hint)}</small></label>
              <textarea id="ex-n-${f.id}" class="input" rows="${f.id.startsWith('axis') || f.id === 'summary' ? 3 : 2}" data-note="${f.id}" lang="en" spellcheck="false">${esc(notes[f.id] || '')}</textarea>
              <small class="ex-long-msg">${icon('warning', 'ico-inline')} Phrases longues : passez en mots-clés (lire ses notes est pénalisé).</small>
            </div>`).join('')}
            <button type="button" class="btn btn-primary btn-lg ex-wide" data-act="to-expose">${icon('mic')}<span>Je suis prête : exposé</span></button>
          </section>
          ${strict ? '' : `<aside class="card card-pad ex-help">${helpHTML()}</aside>`}
        </div>` : ''}
      </div>`;
    }
    function helpHTML() {
      const f = fiches();
      const steps = arr(f.method).filter((m) => m && m.title);
      const ph = arr(f.phrases).slice(0, 6);
      return `<h3 class="h3">Aide-mémoire</h3>
        ${steps.map((m) => `<details class="ex-details"><summary>${esc(m.title)}${m.minutes ? ` · ${m.minutes}${NB}min` : ''}</summary>${m.goal ? `<p class="small">${esc(m.goal)}</p>` : ''}<ul class="ex-list small">${arr(m.tips).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>${arr(m.phrases).length ? `<ul class="ex-phr">${m.phrases.map((p) => `<li lang="en">${esc(p)}</li>`).join('')}</ul>` : ''}</details>`).join('') || '<p class="small muted">Fiches indisponibles.</p>'}
        ${ph.map((g) => `<details class="ex-details"><summary>${esc(g.title)}</summary><ul class="ex-phr">${arr(g.items).map((i) => `<li lang="en">${esc(i.en)}</li>`).join('')}</ul></details>`).join('')}`;
    }
    function bindNotes() {
      $$('[data-note]', root).forEach((ta) => ta.addEventListener('input', () => {
        s.prep.notes[ta.dataset.note] = ta.value;
        ta.closest('.ex-draft-f').classList.toggle('is-long', notesLong(ta.dataset.note, ta.value));
        C.saveSoon();
      }));
      const sw = $('[data-f="help"]', root);
      if (sw) sw.addEventListener('change', () => { s.prep.strict = !sw.checked; C.saveNow(); C.paint(); });
    }

    function notesRecap() {
      const n = s.prep.notes || {};
      const filled = NOTE_FIELDS.filter((f) => str(n[f.id]).trim());
      return filled.length ? `<div class="ex-notes-view" lang="en">${filled.map((f) => `<div><b lang="fr">${esc(f.label)}</b><p>${esc(n[f.id])}</p></div>`).join('')}</div>` : '<p class="small muted">Brouillon vide.</p>';
    }
    function soloExposeHTML() {
      const started = !!s.expose.startedAt, ended = !!s.expose.endedAt;
      if (ended) {
        return `<section class="card card-pad ex-phase">
          <div class="ex-phase-head"><span class="tile tile-violet">${icon('doc')}</span><div><h2 class="h2">Votre exposé (${fmtDur(durations(s).exposeMs)})</h2><p class="muted small">Relisez la transcription et corrigez ce que la reconnaissance a mal compris (pas vos fautes !).</p></div></div>
          ${durations(s).exposeMs < 600000 ? `<ul class="ex-warns"><li>${icon('warning')}Moins de 10 minutes : le jour J, c’est pénalisé.</li></ul>` : ''}
          <textarea class="input ex-tx-edit" rows="12" data-f="tx" lang="en" spellcheck="false" aria-label="Transcription de l’exposé">${esc(exposeText(s))}</textarea>
          <div class="ex-actions-row"><button type="button" class="btn btn-primary btn-lg" data-act="to-jury">${icon('person2')}<span>Passer au jury IA</span></button>
          <button type="button" class="btn btn-ghost" data-act="expose-redo">${icon('refresh')}<span>Recommencer l’exposé</span></button></div>
        </section>`;
      }
      return `<section class="card card-pad ex-phase">
        <div class="ex-phase-head"><span class="tile tile-violet">${icon('mic')}</span><div><h2 class="h2">Exposé · 15 min</h2><p class="muted small" data-b="zone">Parlez face à l’écran comme devant le jury. La transcription s’affiche seulement à la fin.</p></div></div>
        ${trackHTML()}
        ${started ? `<div class="ex-rec"><span class="ex-live-dot ${C.listening ? 'on' : ''}" aria-hidden="true"></span><b data-b="rec-state">${C.listening ? 'J’écoute…' : SR() ? 'Micro en pause' : 'Micro indisponible : exposé chronométré seulement'}</b><span class="small muted" data-b="rec-wc"></span></div>
          <div class="ex-actions-row">
            ${C.listening ? `<button type="button" class="btn" data-act="mic-pause">${icon('pause')}<span>Pause micro</span></button>` : SR() ? `<button type="button" class="btn" data-act="mic-resume">${icon('mic')}<span>Reprendre le micro</span></button>` : ''}
            <button type="button" class="btn btn-primary btn-lg" data-act="expose-end">${icon('stop')}<span>Terminer l’exposé</span></button>
          </div>`
        : `<button type="button" class="btn btn-primary btn-xl ex-wide" data-act="expose-start">${icon('mic')}<span>Commencer l’exposé</span></button>
          ${SR() ? '<p class="small muted">Chrome ou Edge demandera l’accès au micro. Reconnaissance en anglais britannique.</p>' : '<p class="small muted">Reconnaissance vocale indisponible ici (utilisez Chrome ou Edge) : le chrono marche, vous pourrez taper un résumé.</p>'}`}
      </section>
      <details class="card card-pad ex-details"${started ? ' open' : ''}><summary><b>Mes notes</b></summary>${notesRecap()}</details>
      <details class="card card-pad ex-details ex-solo-subj"${s.quick && !started ? ' open' : ''}><summary><b>Le sujet</b> <span class="small muted">· article et question</span></summary>${subjectHTML(s.subject)}</details>`;
    }

    function startRec(initial, onText) {
      stopRec();
      const r = createRecognizer({
        lang: 'en-GB',
        onText,
        onFatal: (code) => {
          C.listening = false;
          toast(code === 'not-allowed' || code === 'service-not-allowed' ? 'Accès au micro refusé : autorisez-le (cadenas de la barre d’adresse).' : 'Micro indisponible (' + code + ').', 'err', { duration: 8000 });
          if (C.alive) C.paint();
        }
      });
      if (!r) { toast('Reconnaissance vocale indisponible : utilisez Chrome ou Edge.', 'warn'); return false; }
      C.rec = r; C.listening = true;
      r.start(initial || '');
      return true;
    }
    function stopRec() { const r = C.rec; C.rec = null; C.listening = false; return r ? r.stop() : ''; }
    function exposeOnText(finals) {
      s.expose.transcript = finals ? [{ t: Date.now() - s.expose.startedAt, text: finals }] : [];
      const wc = $('[data-b="rec-wc"]', root); if (wc) wc.textContent = finals ? `· ${words(finals)} mots captés` : '';
      // Pas de report sans fin pendant que l'élève parle : le minuteur armé sauvera le dernier texte.
      if (!C.saveT) C.saveSoon();
    }

    function keyBadHTML() {
      return `<div class="ex-keybad" role="note"><p>${icon('warning', 'ico-inline')}<span>Votre clé IA est refusée : la correction est coupée.</span></p><button type="button" class="btn btn-sm" data-go="#/settings">${icon('gear')}<span>Corriger la clé</span></button></div>`;
    }
    function soloJuryHTML() {
      const done = arr(s.interview.asked).length;
      const canChange = s.quick && !done;
      return `<section class="card card-pad ex-phase">
        <div class="ex-phase-head"><span class="tile tile-green">${icon('person2')}</span><div class="grow"><h2 class="h2">Questions du jury</h2><p class="muted small">Écoutez la question, répondez à voix haute, puis « J’ai fini ».</p></div>
          ${canChange ? `<button type="button" class="btn btn-quiet btn-sm" data-act="change-subject">${icon('refresh')}<span>Changer de sujet</span></button>` : ''}</div>
        <div class="ex-qa" data-b="qa"></div>
      </section>
      <details class="card card-pad ex-details ex-solo-subj"${s.expose.startedAt || done ? '' : ' open'}><summary><b>Le sujet</b> <span class="small muted">· relire l’article et la question</span></summary>${subjectHTML(s.subject)}</details>
      ${done ? `<details class="card card-pad ex-details"><summary><b>Questions précédentes (${done})</b></summary><ol class="ex-asked">${s.interview.asked.map((a) => `<li><span lang="en">${esc(a.en)}</span>${a.score != null ? `<small>${fmtNum(a.score)}/10</small>` : ''}</li>`).join('')}</ol></details>` : ''}`;
    }
    function paintQA() {
      const box = $('[data-b="qa"]', root);
      if (!box) return;
      const qa = C.qa;
      const target = Number(s.interview.target) || 6;
      const done = arr(s.interview.asked).length;
      const finishBtn = done && done < target ? `<button type="button" class="btn btn-ghost" data-act="to-review">${icon('star')}<span>Terminer et voir mon bilan</span></button>` : '';
      const noKeyNote = aiOn() ? '' : keyRefused() ? keyBadHTML() : '<p class="small muted">Sans clé IA : pas de correction.</p>';
      if (qa.busy) { box.innerHTML = `<div class="ex-q-loading"><span class="spinner"></span><span>${esc(qa.busyText || 'Un instant…')}</span></div>`; return; }
      if (qa.state === 'idle') {
        box.innerHTML = done >= target
          ? `<div class="ex-qa-end"><h3 class="h3">C’est terminé</h3><p class="muted">${done} questions. Place au bilan.</p><button type="button" class="btn btn-primary btn-lg" data-act="to-review">${icon('star')}<span>Voir mon bilan</span></button></div>`
          : `<div class="ex-actions-row"><button type="button" class="btn btn-primary btn-xl" data-act="qa-next">${icon('play')}<span>${done ? 'Question suivante' : 'Commencer'}</span></button>${finishBtn}</div>${noKeyNote}`;
        return;
      }
      const q = qa.q || {};
      const asking = qa.state === 'answer';
      const qHTML = `<div class="ex-q-solo">
        <div class="row"><span class="pill pill-xs">Question ${done + (asking ? 1 : 0)}/${target}</span><span class="spacer"></span>
          ${asking ? `<button type="button" class="btn btn-sm" data-act="qa-repeat">${icon('refresh')}<span>Répéter la question</span></button>
          <button type="button" class="btn btn-sm" data-act="qa-slow">${icon('speaker')}<span>Plus lentement</span></button>` : ''}</div>
        ${qa.showText || !asking ? `<p class="ex-q-en" lang="en">${esc(q.en)}</p>` : `<button type="button" class="btn btn-quiet btn-sm" data-act="qa-show">${icon('eye')}<span>Afficher le texte de la question</span></button>`}
      </div>`;
      if (asking && qa.empty) {
        box.innerHTML = `${qHTML}
          <div class="ex-empty-ans" role="alert"><p>${icon('mic', 'ico-inline')}<b>Je n’ai rien entendu. Vérifiez le micro puis réessayez.</b></p></div>
          <div class="ex-actions-row">${SR() ? `<button type="button" class="btn btn-primary btn-lg" data-act="qa-retry">${icon('mic')}<span>Réessayer</span></button>` : ''}
          <button type="button" class="btn${SR() ? ' btn-ghost' : ' btn-primary btn-lg'}" data-act="qa-type">${icon('keyboard')}<span>Répondre par écrit</span></button></div>`;
        return;
      }
      if (asking) {
        box.innerHTML = `${qHTML}
          <div class="ex-rec"><span class="ex-live-dot ${C.listening ? 'on' : ''}" aria-hidden="true"></span><b>${C.listening ? 'À vous : j’écoute votre réponse…' : SR() ? 'Réponse écrite (vous pouvez repasser au micro)' : 'Réponse écrite'}</b></div>
          ${C.listening ? '' : `<textarea class="input" rows="4" data-f="answer" lang="en" placeholder="Your answer…" aria-label="Votre réponse">${esc(qa.answer)}</textarea>`}
          <div class="ex-actions-row"><button type="button" class="btn btn-primary btn-lg" data-act="qa-done">${icon('check')}<span>J’ai fini</span></button>
          ${C.listening ? `<button type="button" class="btn btn-ghost" data-act="qa-type">${icon('keyboard')}<span>Répondre par écrit</span></button>` : SR() ? `<button type="button" class="btn btn-ghost" data-act="qa-mic">${icon('mic')}<span>Répondre au micro</span></button>` : ''}
          ${finishBtn}</div>`;
        return;
      }
      const fb = qa.fb;
      box.innerHTML = `${qHTML}
        <div class="ex-answer"><b>Votre réponse</b><p lang="en">${esc(qa.answer || '—')}</p></div>
        ${fb ? `<div class="ex-fb" tabindex="-1">
          <div class="ex-fb-head">${ring(fb.score, 10)}<div><b>${esc(fb.score >= 8 ? 'Très bonne réponse' : fb.score >= 6 ? 'Bonne base' : fb.score >= 4 ? 'À étoffer' : 'À retravailler')}</b>${arr(fb.good).length ? `<ul class="ex-list small">${fb.good.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}</div></div>
          ${arr(fb.fixes).length ? `<ul class="ex-errlist">${fb.fixes.map((x) => `<li><span class="ex-said" lang="en">${esc(x.said)}</span><span class="ex-arrow">→</span><span class="ex-better" lang="en">${esc(x.better)}</span>${x.rule ? `<small>${esc(x.rule)}</small>` : ''}</li>`).join('')}</ul>` : ''}
          ${fb.better ? `<div class="ex-model"><div class="row"><b>Réponse modèle</b><span class="spacer"></span>${sayBtn(fb.better)}</div><p lang="en">${esc(fb.better)}</p></div>` : ''}
        </div>` : keyRefused() ? keyBadHTML() : `<p class="small muted">${aiReady() ? 'Correction indisponible pour cette réponse.' : 'Sans clé IA : pas de correction.'}</p>`}
        <div class="ex-actions-row">${done >= target ? `<button type="button" class="btn btn-primary btn-lg" data-act="to-review">${icon('star')}<span>Voir mon bilan</span></button>` : `<button type="button" class="btn btn-primary btn-lg" data-act="qa-next">${icon('chevron-right')}<span>Question suivante</span></button>${finishBtn}`}</div>`;
    }
    function changeSubject() {
      if (arr(s.interview.asked).length) return;
      if (C.ctrl) C.ctrl.abort();
      stopSpeak();
      stopRec();
      const pick = pickRandom(store.subjects(), s.subjectId);
      if (!pick) return;
      s.subject = normSubject(pick);
      s.subjectId = s.subject.id;
      s.interview.turns = []; s.interview.startedAt = null; s.alarms = {};
      Object.assign(C.qa, { state: 'idle', q: null, answer: '', fb: null, busy: false, empty: false });
      C.saveNow();
      C.paint();
      C.say('Nouveau sujet : ' + s.subject.title);
      qaNext();
    }
    async function qaNext() {
      const qa = C.qa;
      if (qa.busy) return;
      const used = new Set(arr(s.interview.asked).map((x) => x.en));
      const turns = arr(s.interview.turns);
      const last = turns[turns.length - 1];
      if (last && last.who === 'jury' && !used.has(last.text)) {
        const src = arr(s.subject.corrige.juryQuestions).find((x) => x && x.en === last.text);
        return askQuestion({ en: last.text, fr: src ? src.fr : '' }, true);
      }
      let q = null;
      const p = arr(s.subject.corrige.juryQuestions).filter((x) => x && x.en && !used.has(x.en));
      const useAI = aiOn() && aiHas('juryQuestion') && (!p.length || (used.size >= 2 && used.size % 2 === 0));
      if (!useAI && p.length) q = { en: p[0].en, fr: p[0].fr };
      if (!q && useAI) {
        qa.busy = true; qa.busyText = 'Le jury prépare sa question…'; paintQA();
        const ctrl = C.ctrl = new AbortController();
        try {
          const kinds = ['next', 'deeper', 'news', 'opinion', 'clarify'];
          const r = await S.examAI.juryQuestion({ subject: s.subject, expose: exposeText(s), interview: arr(s.interview.turns).map((t) => ({ who: t.who, text: t.text })), asked: [...used], kind: kinds[used.size % kinds.length], signal: ctrl.signal });
          if (r && r.en) q = { en: str(r.en), fr: str(r.fr) };
        } catch (e) { if (isAbort(e)) { qa.busy = false; return; } if (e && e.code === 'KEY') markKeyRefused(); }
        finally { qa.busy = false; }
      }
      if (!C.alive || s.phase !== 'interview') return;
      if (!q && p.length) q = { en: p[0].en, fr: p[0].fr };
      if (!q) { const g = GENERIC.next.concat(GENERIC.opinion, GENERIC.news, GENERIC.deeper).find((x) => !used.has(x.en)); q = g || GENERIC.deeper[0]; }
      return askQuestion(q, false);
    }
    async function askQuestion(q, again) {
      const qa = C.qa;
      qa.q = q; qa.answer = ''; qa.fb = null; qa.state = 'answer'; qa.empty = false;
      if (!s.interview.startedAt) s.interview.startedAt = Date.now();
      if (!again) s.interview.turns.push({ who: 'jury', text: q.en, t: Date.now() - s.interview.startedAt });
      C.saveSoon();
      paintQA();
      C.say(`Question ${arr(s.interview.asked).length + 1}`);
      C.qaResumeMic = false;
      await speakQuestion(q, {});
    }
    async function speakQuestion(q, o) {
      const qa = C.qa;
      // Jeton : une lecture interrompue par une nouvelle (Répéter, Plus lentement) ne relance pas le micro.
      const tok = (C.qaSpeakSeq = (C.qaSpeakSeq || 0) + 1);
      const wasListening = C.listening;
      const kept = wasListening ? (stopRec() || qa.answer) : qa.answer;
      qa.answer = kept;
      C.qaResumeMic = C.qaResumeMic || wasListening;
      if (wasListening) paintQA();
      await speakEn(q.en, o);
      if (tok !== C.qaSpeakSeq) return;
      const resume = C.qaResumeMic;
      C.qaResumeMic = false;
      if (!C.alive || s.phase !== 'interview' || qa.state !== 'answer' || qa.q !== q || qa.busy) return;
      if (SR() && (resume || (!prefs().typeAnswers && !str(qa.answer)))) { startRec(qa.answer, (finals) => { qa.answer = finals; }); paintQA(); }
    }
    async function qaDone() {
      const qa = C.qa;
      if (C.listening) qa.answer = stopRec() || qa.answer;
      const ta = $('[data-f="answer"]', root);
      if (ta) qa.answer = ta.value.trim() || qa.answer;
      qa.answer = str(qa.answer).trim();
      if (!qa.answer) { qa.empty = true; paintQA(); C.say('Je n’ai rien entendu.'); return; }
      qa.empty = false;
      s.interview.turns.push({ who: 'student', text: qa.answer || '(no answer)', t: Date.now() - (s.interview.startedAt || Date.now()) });
      const entry = { en: qa.q.en, fr: qa.q.fr || '', answer: qa.answer };
      s.interview.asked.push(entry);
      qa.state = 'feedback'; qa.fb = null;
      C.saveNow();
      if (aiOn() && aiHas('answerFeedback')) {
        qa.busy = true; qa.busyText = 'Correction de votre réponse…'; paintQA();
        const ctrl = C.ctrl = new AbortController();
        try {
          const r = await S.examAI.answerFeedback({ subject: s.subject, question: qa.q.en, answer: qa.answer, signal: ctrl.signal });
          if (r) {
            const sc = Number(r.score);
            qa.fb = { score: isFinite(sc) ? clamp(round1(sc), 0, 10) : 0, good: arr(r.good).map(str), fixes: arr(r.fixes).filter((x) => x && x.said), better: str(r.better) };
            entry.score = qa.fb.score; entry.feedback = qa.fb;
            C.saveNow();
          }
        } catch (e) { if (!isAbort(e) && e && e.code === 'KEY') markKeyRefused(); }
        finally { qa.busy = false; }
      }
      if (!C.alive) return;
      C.paint();
      const fbEl = $('.ex-fb', root);
      if (fbEl) { fbEl.focus({ preventScroll: true }); C.say(`Correction prête : ${fmtNum(qa.fb.score)} sur 10.`); }
      else C.say('Réponse enregistrée.');
    }

    root.addEventListener('click', (e) => {
      const st = e.target.closest('[data-step]');
      if (st && !st.disabled) {
        C.stepTo(st.dataset.step, {
          steps: SOLO_STEPS, resume: true,
          before: () => {
            if (C.ctrl) C.ctrl.abort();
            stopSpeak();
            const t = stopRec();
            if (t && s.phase === 'expose' && s.expose.startedAt && !s.expose.endedAt) exposeOnText(t);
            C.qa.state = 'idle'; C.qa.busy = false;
          }
        });
        return;
      }
      const dur = e.target.closest('[data-dur]');
      if (dur) { s.prep.durMin = Number(dur.dataset.dur); C.saveNow(); C.paint(); return; }
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const act = b.dataset.act;
      if (reviewClicks(C, $('[data-b="main"]', root), act)) return;
      if (act === 'prep-start') { s.prep.startedAt = Date.now(); C.saveNow(); C.paint(); chime('soft'); }
      else if (act === 'to-expose') { C.setPhase('expose'); C.offerResume('expose', 'Exposé'); }
      else if (act === 'expose-start') {
        s.expose.startedAt = Date.now(); s.expose.endedAt = null; s.expose.transcript = [];
        if (SR()) startRec('', exposeOnText);
        C.saveNow(); C.paint();
      }
      else if (act === 'mic-pause') { const t = stopRec(); if (t) exposeOnText(t); C.paint(); }
      else if (act === 'mic-resume') { startRec(exposeText(s), exposeOnText); C.paint(); }
      else if (act === 'expose-end') {
        const t = stopRec(); if (t) exposeOnText(t);
        s.expose.endedAt = Date.now(); C.saveNow(); C.paint(); chime('soft');
      }
      else if (act === 'expose-redo') {
        confirmSheet({ title: 'Recommencer l’exposé ?', text: 'La transcription actuelle sera effacée.', okLabel: 'Recommencer', danger: true }).then((ok) => {
          if (!ok) return;
          s.expose.startedAt = null; s.expose.endedAt = null; s.expose.transcript = [];
          ['e10', 'e14', 'e15'].forEach((k) => delete s.alarms[k]);
          C.saveNow(); C.paint();
        });
      }
      else if (act === 'to-jury') {
        const ta = $('[data-f="tx"]', root);
        if (ta) s.expose.transcript = ta.value.trim() ? [{ t: 0, text: ta.value.trim() }] : [];
        C.setPhase('interview');
        C.offerResume('interview', 'Jury IA');
      }
      else if (act === 'qa-next') qaNext();
      else if (act === 'qa-done') qaDone();
      else if (act === 'qa-repeat') { if (C.qa.q) speakQuestion(C.qa.q, {}); }
      else if (act === 'qa-slow') { if (C.qa.q) speakQuestion(C.qa.q, { rate: 0.78 }); }
      else if (act === 'qa-show') { C.qa.showText = true; setPrefs({ showQText: true }); paintQA(); }
      else if (act === 'qa-type') {
        C.qa.answer = stopRec() || C.qa.answer; C.qa.empty = false; setPrefs({ typeAnswers: true }); paintQA();
        const ta = $('[data-f="answer"]', root); if (ta) ta.focus();
      }
      else if (act === 'qa-retry') { C.qa.empty = false; C.qa.answer = ''; startRec('', (f) => { C.qa.answer = f; }); paintQA(); }
      else if (act === 'change-subject') changeSubject();
      else if (act === 'qa-mic') { setPrefs({ typeAnswers: false }); const ta = $('[data-f="answer"]', root); startRec(ta ? ta.value : '', (f) => { C.qa.answer = f; }); paintQA(); }
      else if (act === 'to-review') { if (C.ctrl) C.ctrl.abort(); stopSpeak(); stopRec(); C.qa.state = 'idle'; C.setPhase('review'); }
    });
    // Réponse tapée : gardée dans qa.answer pour survivre aux repeints.
    root.addEventListener('input', (e) => { if (e.target.matches && e.target.matches('[data-f="answer"]')) C.qa.answer = e.target.value; });

    const offTick = onTick(() => {
      if (!C.alive) return;
      C.seen();
      paintClock(C, true);
      if (!C.gapPending) checkAlarms(C, true);
    });
    C.paint();
    C.checkGap();
    if (AUTO_ASK === s.id) { AUTO_ASK = ''; if (s.phase === 'interview' && !arr(s.interview.turns).length) qaNext(); }
    setCurrent({
      wantsWake: true,
      flush() { s.lastSeenAt = Date.now(); C.saveNow(); },
      busy() { return C.listening || (s.phase === 'expose' && !!s.expose.startedAt && !s.expose.endedAt) || (s.phase === 'prep' && !!s.prep.startedAt && !s.prep.endedAt); },
      async canLeave() {
        if (!C.listening) return true;
        return confirmSheet({ title: 'Quitter l’entraînement ?', text: 'Le micro est actif : il sera coupé. La séance reste enregistrée.', okLabel: 'Quitter', cancelLabel: 'Rester' });
      },
      leave() {
        C.alive = false;
        offTick();
        const t = stopRec();
        if (t && s.phase === 'expose' && !s.expose.endedAt) exposeOnText(t);
        if (C.ctrl) C.ctrl.abort();
        if (C.evalCtrl) C.evalCtrl.abort();
        s.lastSeenAt = Date.now();
        C.saveNow();
      }
    });
  }

  const FICHE_TABS = [
    { id: 'methode', label: 'Méthode' }, { id: 'phrases', label: 'Phrases' }, { id: 'themes', label: 'Thèmes' },
    { id: 'actu', label: 'Actualité' }, { id: 'erreurs', label: 'Erreurs' }, { id: 'prononciation', label: 'Prononciation' }, { id: 'jourj', label: 'Jour J' }
  ];
  const DAY_KEY = 'aidevisio.exam.daycheck.v1';
  const dayChecks = () => { try { return JSON.parse(localStorage.getItem(DAY_KEY) || '{}') || {}; } catch (e) { return {}; } };

  const sv = (...xs) => esc(norm(xs.map((x) => (typeof x === 'string' ? x : '')).join(' ')));
  const pairRow = (it) => `<li class="ex-pair" data-search="${sv(it.en, it.fr)}">${sayBtn(it.en)}<span class="ex-pair-t"><b lang="en">${esc(it.en)}</b>${it.fr ? `<small>${esc(it.fr)}</small>` : ''}</span></li>`;

  function ficheBody(tab) {
    const f = fiches();
    const none = (what) => `<div class="empty card"><div class="empty-ic">${icon('info')}</div><p class="muted">${esc(what)} indisponible pour l’instant.</p></div>`;
    if (tab === 'methode') {
      const info = examInfo();
      const steps = arr(f.method);
      return `<section class="card card-pad ex-timeline" data-search="${sv('format epreuve preparation expose entretien')}"><h2 class="h3">L’épreuve</h2>
          <div class="ex-format ex-format-lg">${info.format.map((x) => `<span><b>${esc(x.minutes)}${NB}min</b>${esc(x.label)}<small>${esc(x.detail || '')}</small></span>`).join('<i aria-hidden="true"></i>')}</div></section>
        ${steps.length ? steps.map((m, i) => `<section class="card card-pad ex-fcard" data-search="${sv(m.title, m.goal, arr(m.tips).join(' '), arr(m.phrases).join(' '))}">
          <div class="ex-fcard-head"><span class="step-n">${i + 1}</span><h3 class="h3">${esc(m.title)}</h3>${m.minutes ? `<span class="pill pill-xs">${esc(m.minutes)}${NB}min</span>` : ''}</div>
          ${m.goal ? `<p class="ex-goal">${esc(m.goal)}</p>` : ''}
          ${arr(m.tips).length ? `<ul class="ex-list">${m.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${arr(m.phrases).length ? `<ul class="ex-pairs">${m.phrases.map((p) => pairRow({ en: p })).join('')}</ul>` : ''}
        </section>`).join('') : none('La méthode')}`;
    }
    if (tab === 'phrases') {
      const groups = arr(f.phrases);
      return (groups.length ? groups.map((g) => `<section class="card card-pad ex-fgroup"><h3 class="h3">${esc(g.title)}</h3><ul class="ex-pairs">${arr(g.items).map(pairRow).join('')}</ul></section>`).join('') : none('La banque de phrases'))
        + (arr(f.tones).length ? `<section class="card card-pad ex-fgroup"><h3 class="h3">Le ton du document</h3><ul class="ex-pairs ex-pairs-grid">${f.tones.map(pairRow).join('')}</ul></section>` : '')
        + arr(f.linking).map((g) => `<section class="card card-pad ex-fgroup"><h3 class="h3">Mots de liaison · ${esc(g.group)}</h3><ul class="ex-pairs ex-pairs-grid">${arr(g.items).map(pairRow).join('')}</ul></section>`).join('');
    }
    if (tab === 'themes') {
      const th = arr(f.themes);
      if (!th.length) return none('Le vocabulaire des thèmes');
      return th.map((t) => `<details class="card card-pad ex-fgroup ex-theme-card" style="--hue:${THEME_HUE[t.id] || 214}" data-search-group data-search-head="${sv(t.id, t.fr, t.title)}">
        <summary><span class="ex-theme"><b>${esc(t.id)}</b>${esc(t.fr || '')}</span><span class="h3" lang="en">${esc(t.title)}</span><span class="small muted">${arr(t.vocab).length} mots</span></summary>
        <ul class="ex-pairs ex-pairs-grid">${arr(t.vocab).map(pairRow).join('')}</ul>
        ${arr(t.facts).length ? `<h4 class="ex-sub">Notions</h4><ul class="ex-list" lang="en">${t.facts.map((x) => `<li data-search="${sv(x)}">${esc(x)}</li>`).join('')}</ul>` : ''}
        ${arr(t.debates).length ? `<h4 class="ex-sub">Débats possibles</h4><ul class="ex-pairs">${t.debates.map((x) => pairRow({ en: x })).join('')}</ul>` : ''}
      </details>`).join('');
    }
    if (tab === 'actu') {
      const n = arr(f.news);
      if (!n.length) return none('L’actualité');
      return `<div class="ex-ngrid">${n.map((x) => `<section class="card card-pad ex-news" data-search="${sv(x.title, x.summary, x.en)}">
        <div class="row">${arr(x.themes).map((t) => themeChip(t, 'ex-theme-sm')).join('')}<span class="spacer"></span><span class="small muted">${esc(x.date || '')}</span></div>
        <h3 class="h3">${esc(x.title)}</h3><p class="small">${esc(x.summary || '')}</p>
        ${x.en ? `<div class="ex-say-line">${sayBtn(x.en)}<span lang="en">${esc(x.en)}</span></div>` : ''}
      </section>`).join('')}</div>`;
    }
    if (tab === 'erreurs') {
      const er = arr(f.errors);
      if (!er.length) return none('La fiche des erreurs');
      return `<div class="ex-ngrid">${er.map((x) => `<section class="card card-pad ex-errcard" data-search="${sv(x.title, x.wrong, x.right, x.tip)}">
        <h3 class="h3">${esc(x.title)}</h3>
        <p class="ex-wrong" lang="en">${icon('xmark', 'ico-inline')} ${esc(x.wrong)}</p>
        <p class="ex-right" lang="en">${icon('check', 'ico-inline')} ${esc(x.right)} ${sayBtn(x.right)}</p>
        ${x.tip ? `<p class="small muted">${esc(x.tip)}</p>` : ''}
      </section>`).join('')}</div>`;
    }
    if (tab === 'prononciation') {
      const p = arr(f.pronunciation);
      if (!p.length) return none('La fiche de prononciation');
      return `<p class="small muted ex-lead">Touchez ${icon('speaker', 'ico-inline')} pour écouter (voix anglaise), puis répétez à voix haute.</p>
        <div class="ex-pgrid">${p.map((x) => `<div class="card ex-pron" data-search="${sv(x.word, x.tip)}">${sayBtn(x.word)}<div><b lang="en">${esc(x.word)}</b><span class="ex-ipa">${esc(x.ipa || '')}</span><small>${esc(x.tip || '')}</small></div></div>`).join('')}</div>`;
    }
    if (tab === 'jourj') {
      const done = dayChecks();
      const groups = arr(f.checklist).length ? f.checklist : [
        { when: 'La veille', items: ['Imprimer la convocation', 'Préparer la pièce d’identité', 'Tester Teams (son, caméra, micro)'] },
        { when: 'Le matin', items: ['Ouvrir le mail avec le lien', 'Prévoir la demi-journée', 'Eau, papier, stylos'] },
        { when: 'Pendant l’oral', items: ['Annoncer le plan', 'Regarder la caméra', 'Faire répéter si besoin'] }
      ];
      return `${groups.map((g) => `<section class="card card-pad ex-fgroup"><h3 class="h3">${esc(g.when)}</h3><ul class="ex-daylist">${arr(g.items).map((it) => { const k = g.when + '|' + it; return `<li data-search="${sv(it)}"><label class="ex-daycheck"><input type="checkbox" data-day="${esc(k)}"${done[k] ? ' checked' : ''}><span class="ex-box">${icon('check')}</span><span>${esc(it)}</span></label></li>`; }).join('')}</ul></section>`).join('')}
        <div class="row center"><button type="button" class="btn btn-ghost btn-sm" data-act="day-reset">${icon('refresh')}<span>Tout décocher</span></button></div>`;
    }
    return none('Cet onglet');
  }

  function renderFiches(root, params) {
    let tab = FICHE_TABS.some((t) => t.id === params.id) ? params.id : 'methode';
    root.innerHTML = `<div class="screen ex ex-fiches">
      <header class="ex-fhead">
        <div class="row"><button type="button" class="icon-btn hide-mobile" data-go="#/" aria-label="Accueil">${icon('chevron-left')}</button><h1 class="h1">Fiches</h1><span class="spacer"></span>
          <div class="ex-rate"><span class="small muted">Voix</span><div class="seg" role="radiogroup" aria-label="Vitesse de la voix">${[[1, 'Normal'], [0.8, 'Lent']].map(([v, l]) => `<button type="button" role="radio" data-rate="${v}" class="${(Number(prefs().rate) || 1) === v ? 'on' : ''}" aria-checked="${(Number(prefs().rate) || 1) === v}">${l}</button>`).join('')}</div></div></div>
        <div class="ex-ftabs" role="tablist" aria-label="Fiches">${FICHE_TABS.map((t) => `<a href="#/fiches/${t.id}" role="tab" class="${t.id === tab ? 'on' : ''}" aria-selected="${t.id === tab}">${esc(t.label)}</a>`).join('')}</div>
        <label class="search search-lg"><span>${icon('search')}</span><input type="search" placeholder="Rechercher (mot, expression, règle…)" aria-label="Rechercher dans les fiches" data-f="q" value="${esc(prefs().ficheQuery || '')}"></label>
      </header>
      <div class="ex-fbody" data-b="body"></div>
      <p class="ex-nores muted center" data-b="nores" hidden>Aucun résultat dans cet onglet.</p>
      <p class="ex-elsewhere small center" data-b="elsewhere" hidden></p>
    </div>`;
    const offTabs = {};
    const hitsIn = (id, q) => {
      if (!offTabs[id]) {
        const d = document.createElement('div'); d.innerHTML = ficheBody(id);
        const key = (el) => el.dataset.search || el.dataset.searchHead || '';
        // Chaque entrée garde les textes de ses ancêtres : on ne compte que la correspondance la plus externe.
        offTabs[id] = $$('[data-search], [data-search-head]', d).map((el) => {
          const anc = [];
          for (let p = el.parentElement && el.parentElement.closest('[data-search], [data-search-head]'); p; p = p.parentElement && p.parentElement.closest('[data-search], [data-search-head]')) anc.push(key(p));
          return { s: key(el), anc };
        });
      }
      return offTabs[id].filter((x) => x.s.includes(q) && !x.anc.some((a) => a.includes(q))).length;
    };
    const body = $('[data-b="body"]', root);
    body.innerHTML = ficheBody(tab);
    const onTab = $('.ex-ftabs a.on', root);
    if (onTab) requestAnimationFrame(() => { try { onTab.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (e) {  } });
    const input = $('[data-f="q"]', root);
    function filter() {
      const q = norm(input.value);
      setPrefs({ ficheQuery: input.value });
      let any = false;
      $$('[data-search]', body).forEach((el) => {
        const hit = !q || el.dataset.search.includes(q);
        el.hidden = !hit;
        if (hit) any = true;
      });
      $$('.ex-fgroup, details.ex-fgroup', body).forEach((g) => {
        const items = $$('[data-search]', g);
        // Nom du thème trouvé : toute la carte reste visible.
        if (q && g.dataset.searchHead && g.dataset.searchHead.includes(q)) {
          items.forEach((x) => { x.hidden = false; });
          g.hidden = false; any = true;
          if (g.tagName === 'DETAILS') g.open = true;
          return;
        }
        if (!items.length) return;
        const vis = items.some((x) => !x.hidden);
        g.hidden = !vis;
        if (g.tagName === 'DETAILS' && q && vis) g.open = true;
      });
      $('[data-b="nores"]', root).hidden = any || !q;
      const el = $('[data-b="elsewhere"]', root);
      const other = q.length >= 2 ? FICHE_TABS.filter((t) => t.id !== tab).map((t) => ({ t, n: hitsIn(t.id, q) })).filter((x) => x.n) : [];
      el.hidden = !other.length;
      el.innerHTML = other.length ? `${any ? 'Aussi dans' : 'Trouvé dans'} : ${other.map((x) => `<a href="#/fiches/${x.t.id}">${esc(x.t.label)} (${x.n})</a>`).join(' · ')}` : '';
    }
    input.addEventListener('input', filter);
    filter();
    root.addEventListener('click', (e) => {
      const r = e.target.closest('[data-rate]');
      if (r) {
        setPrefs({ rate: Number(r.dataset.rate) });
        $$('[data-rate]', root).forEach((x) => { const on = x === r; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
        toast(r.dataset.rate === '1' ? 'Lecture au débit normal.' : 'Lecture plus lente.', 'info');
        return;
      }
      if (e.target.closest('[data-act="day-reset"]')) {
        try { localStorage.removeItem(DAY_KEY); } catch (er) {  }
        $$('[data-day]', root).forEach((x) => { x.checked = false; });
        toast('Checklist remise à zéro.', 'ok');
      }
    });
    root.addEventListener('change', (e) => {
      const c = e.target.closest('[data-day]');
      if (!c) return;
      const d = dayChecks();
      if (c.checked) d[c.dataset.day] = true; else delete d[c.dataset.day];
      try { localStorage.setItem(DAY_KEY, JSON.stringify(d)); } catch (er) {  }
      const total = $$('[data-day]', root).length, n = $$('[data-day]:checked', root).length;
      if (c.checked) toast(n === total ? 'Tout est prêt. Bonne chance !' : `${n}/${total} cochés.`, n === total ? 'ok' : 'info');
    });
    setCurrent({});
  }

  function renderHistory(root) {
    const list = store.list().sort((a, b) => byCreated(b, a));
    const sc = scored();
    const vals = sc.slice(-12).map((s) => Number(s.evaluation.total));
    const avg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    const best = vals.length ? Math.max(...vals) : null;
    root.innerHTML = `<div class="screen ex ex-history">
      ${topbar({ title: 'Historique', sub: list.length ? `${list.length} séance${list.length > 1 ? 's' : ''}` : '', back: '#/' })}
      ${vals.length >= 2 ? `<section class="card card-pad ex-trend">
        <div class="ex-trend-stats"><span><small>Dernière</small><b>${fmtNum(vals[vals.length - 1])}<i>/20</i></b></span><span><small>Moyenne</small><b>${fmtNum(avg)}<i>/20</i></b></span><span><small>Meilleure</small><b>${fmtNum(best)}<i>/20</i></b></span></div>
        <div class="ex-trend-chart">${sparkSVG(vals, 320, 80)}</div>
      </section>` : ''}
      ${list.length ? `<div class="list ex-hlist">${list.map((s) => {
        const e = s.evaluation;
        return `<div class="list-row ex-hrow">
          <button type="button" class="ex-hopen" data-open="${esc(s.id)}">
            <span class="tile ${s.kind === 'jury' ? 'tile-blue' : s.kind === 'call' ? 'tile-teal' : 'tile-violet'}">${icon(s.kind === 'jury' ? 'person2' : s.kind === 'call' ? 'video' : 'graduation')}</span>
            <span class="list-main"><b lang="en">${esc(s.subject.title)}</b><small>${esc(fmtDate(s.createdAt, true))} · ${esc(kindLabel(s))} · ${e ? 'bilan' : esc(phaseLabel(s))}</small></span>
            ${e ? `<span class="ex-hnote ${e.total >= 12 ? 'ok' : e.total >= 10 ? 'warn' : 'err'}">${fmtNum(e.total)}<small>/20</small></span>` : s.kind === 'call' ? `<span class="pill pill-xs">${callCountLabel(s)}</span>` : '<span class="pill pill-xs">En cours</span>'}
          </button>
          <button type="button" class="icon-btn icon-btn-sm" data-del="${esc(s.id)}" aria-label="Supprimer cette séance" title="Supprimer">${icon('trash')}</button>
        </div>`;
      }).join('')}</div>` : `<div class="empty card"><div class="empty-ic">${icon('clock')}</div><h2 class="h3">Aucune séance pour l’instant.</h2><div class="row center"><button type="button" class="btn btn-primary" data-go="#/eleve">${icon('sparkles')}<span>Entraînement avec l’IA</span></button><button type="button" class="btn" data-go="#/appel">${icon('video')}<span>Entraînement sur Teams</span></button></div></div>`}
    </div>`;
    root.addEventListener('click', async (e) => {
      const o = e.target.closest('[data-open]');
      if (o) { const s = store.get(o.dataset.open); if (s) go(sessionHash(s)); return; }
      const d = e.target.closest('[data-del]');
      if (d && await confirmSheet({ title: 'Supprimer cette séance ?', text: 'La transcription, les notes et le bilan seront effacés.', okLabel: 'Supprimer', danger: true })) {
        store.remove(d.dataset.del);
        toast('Séance supprimée.', 'ok');
        if (S.app && S.app.refresh) S.app.refresh(); else renderHistory(root);
      }
    });
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

  // Lien vide : l'erreur s'affiche dans le champ, pas dans un toast.
  function linkEmpty(root, f) {
    const box = $('[data-b="teams"]', root), hint = $('[data-b="teams-hint"]', root);
    if (box) box.classList.add('is-bad');
    if (hint) hint.textContent = 'Collez d’abord le lien Teams ou Meet reçu par mail ou par message.';
    if (f) { f.setAttribute('aria-invalid', 'true'); f.focus(); }
  }
  function linkEnter(e) {
    if (e.key !== 'Enter' || !e.target.matches || !e.target.matches('[data-f="teams"]')) return;
    e.preventDefault();
    const b = $('[data-act="teams-join"]', e.currentTarget);
    if (b) b.click();
  }

  function renderTeamsStart(root) {
    const link = teamsValid(prefs().studentTeams || '');
    const start = (subj) => {
      const s = newSession('call', subj);
      store.save(s);
      go(sessionHash(s));
    };
    root.innerHTML = `<div class="screen ex ex-chooser lv-start-screen">
      ${topbar({ title: 'Entraînement sur Teams', sub: 'Avec un jury en visio', back: '#/' })}
      <p class="ex-call-intro muted">Le jury vous envoie le sujet pendant l’appel : importez-le, puis lancez l’assistant.</p>
      <ol class="lv-steps">
        <li class="card card-pad lv-step">
          <span class="lv-step-n" aria-hidden="true">1</span>
          <div class="lv-step-b"><h2 class="h3">Rejoindre l’appel</h2>
            ${teamsFieldHTML(link, { id: 'ex-call-link', joinLabel: 'Rejoindre', label: 'Lien Teams (ou Meet)', hint: link ? 'Lien enregistré : « Rejoindre » ouvre la réunion.' : 'Collez le lien reçu par mail ou par message.' })}
          </div>
        </li>
        <li class="card card-pad lv-step is-main">
          <span class="lv-step-n" aria-hidden="true">2</span>
          <div class="lv-step-b"><h2 class="h3">Importer le sujet</h2>
            <p class="muted">Collez le texte, ou ajoutez le fichier ou une photo du sujet envoyé par le jury.</p>
            <button type="button" class="btn btn-primary btn-lg" data-act="import">${icon('import')}<span>Importer le sujet</span></button>
          </div>
        </li>
        <li class="card card-pad lv-step">
          <span class="lv-step-n" aria-hidden="true">3</span>
          <div class="lv-step-b"><h2 class="h3">Lancer l’assistant</h2>
            <p class="muted">${isMobileDevice() ? 'Après l’import, « Lancer l’assistant » démarre l’écoute et affiche la réponse en grand. Posez le téléphone juste sous la caméra.' : 'Après l’import, « Lancer l’assistant » démarre l’écoute et ouvre une fenêtre à placer juste sous la caméra.'}</p>
            <button type="button" class="btn btn-quiet btn-sm" data-act="start-blank">${icon('mic')}<span>Commencer sans sujet</span></button>
          </div>
        </li>
      </ol>
      <p class="lv-jury"><button type="button" class="btn btn-quiet btn-sm" data-go="#/oral/new">${icon('person2')}<span>Je suis le jury</span></button></p>
    </div>`;
    function setHint(v) {
      const l = teamsValid(v);
      const box = $('[data-b="teams"]', root), hint = $('[data-b="teams-hint"]', root);
      if (box) { box.classList.toggle('is-bad', !l && !!str(v).trim()); box.classList.toggle('is-set', !!l); }
      const f = $('[data-f="teams"]', root);
      if (f && (l || !str(v).trim())) f.removeAttribute('aria-invalid');
      if (l) setPrefs({ studentTeams: l });
      if (hint) hint.textContent = l ? `Lien ${meetingApp(l)} enregistré : « Rejoindre » ouvre la réunion.` : str(v).trim() ? LINK_BAD : 'Collez le lien reçu par mail ou par message.';
      return l;
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'import') importSubjectSheet(start);
      else if (b.dataset.act === 'start-blank') start({ title: 'Sujet à venir', paragraphs: [], question: '' });
      else if (b.dataset.act === 'teams-join') {
        const f = $('[data-f="teams"]', root);
        const v = f ? f.value.trim() : '';
        if (!v) { linkEmpty(root, f); return; }
        const l = setHint(v);
        if (l && f) f.value = l;
        openTeams(v);
      }
    });
    root.addEventListener('change', (e) => {
      const f = e.target.closest && e.target.closest('[data-f="teams"]');
      if (!f) return;
      const l = setHint(f.value);
      if (l) f.value = l;
    });
    root.addEventListener('keydown', linkEnter);
    setCurrent({});
  }

  function renderCall(root, s) {
    const C = baseController(root, s);
    const call = s.call;
    const R = { ctrl: null, req: null, item: null, busy: false, partial: '', lines: [], float: null, jury: [], err: '', errKind: '', warn: '', born: 0, mode: '', raf: 0, lastErr: '', lastK: '', ending: false, floatPending: false };
    const L = createListen(C, {
      call: true, prefKey: 'callListenPreset',
      roleOf: (who, split) => (split ? (who === 'me' ? 'student' : 'jury') : 'mixed'),
      interimRoles: ['jury', 'mixed'],
      // La fenêtre flottante reste ouverte si le son coupe : elle affiche l'erreur et « Relancer ».
      onStop: () => { C.wantsWake = false; keepAwake(false); if (C.alive) paintLive(); }
    });
    C.L = L;
    const desk = !isMobileDevice();
    const canFull = () => desk && !!document.fullscreenEnabled;
    // PC ≥ 1100 px : aides en grand à gauche, colonne qui défile à droite (voir live.css).
    const WIDE_MQ = '(min-width: 1100px) and (min-height: 600px)';
    const wide = () => desk && !!(window.matchMedia && window.matchMedia(WIDE_MQ).matches);
    const isFull = () => !!document.fullscreenElement && document.fullscreenElement === $('[data-b="live"]', root);
    const isQ = (t) => { try { return aiHas('isJuryQuestion') ? !!S.examAI.isJuryQuestion(t) : /\?\s*$/.test(t); } catch (e) { return false; } };
    const shown = () => R.item || call.answers[call.answers.length - 1] || null;
    document.body.classList.add('ex-focus');
    function subjectCard() {
      const has = s.subject.paragraphs.length > 0;
      return `<details class="card card-pad ex-details ex-call-subject"${has ? '' : ' open'}><summary><b>Sujet</b><span class="small muted" lang="en"> · ${esc(s.subject.title)}</span></summary>
        ${has ? subjectHTML(s.subject) : ''}
        <button type="button" class="btn btn-sm" data-act="import-subject">${icon('import')}<span>${has ? 'Changer de sujet' : 'Importer le sujet'}</span></button>
      </details>`;
    }
    const endBtn = (done) => `<button type="button" class="btn" data-act="end" data-b="end"${done ? ' disabled' : ''}>${icon('stop')}<span>${done ? 'Appel terminé' : 'Terminer l’appel'}</span></button>`;

    root.innerHTML = `<div class="screen ex ex-call">
      ${topbar({ title: 'Entraînement sur Teams', sub: s.subject.title, back: '#/' })}
      <span class="sr-only" data-b="call-sr" aria-live="polite"></span>
      <div class="lv-body">
        <section class="card ex-live lv-stage" data-b="live" data-theme="dark"></section>
        <aside class="lv-side" aria-label="Appel, son, sujet et historique">
          <section class="card card-pad ex-call-meet">
            <div class="card-head"><h2 class="h3">Rejoindre l’appel</h2></div>
            ${teamsFieldHTML(s.teamsLink, { id: 'ex-call-link', joinLabel: 'Rejoindre', label: 'Lien Teams (ou Meet)', hint: s.teamsLink ? 'Lien enregistré pour cet appel.' : undefined })}
          </section>
          <section class="card card-pad ex-call-listen" data-b="listen-card">
            <div class="card-head"><h2 class="h3">Son de l’appel</h2></div>
            <div data-b="listen"></div>
          </section>
          ${subjectCard()}
          <section class="card card-pad ex-call-hist">
            <div class="card-head"><h2 class="h3">Historique de l’appel</h2><span class="spacer"></span><span class="badge" data-b="hist-n">0</span></div>
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

    const NO_KEY_START = 'Pas de clé IA : l’assistant ne peut pas proposer de réponse. Ajoutez une clé dans Réglages.';
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
      else if (kind === 'lost') btns.push(b('assist', 'mic', 'Relancer l’assistant', true));
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
    // ---- Sous-titres bilingues : question du jury, réponse phrase par phrase (EN puis FR), mots-clés ----
    function statusInfo(busy, a) {
      if (L.A.starting) return ['Démarrage…', 'start'];
      if (!L.A.on) return ['Assistant arrêté', 'off'];
      if (L.A.interim) return L.A.juryTalk === false ? ['Question reçue…', 'busy'] : ['Le jury parle…', 'talk'];
      if (busy) return ['Réponse en cours…', 'busy'];
      if (a && a.text && !a.error) return ['Réponse prête', 'ready'];
      return ['J’écoute…', 'listen'];
    }
    function statusHTML(busy, a) {
      const [label, k] = statusInfo(busy, a);
      return `<span class="lv-status${L.A.on ? ' on' : ''}" data-k="${k}" data-b="status"><span class="ex-live-dot${L.A.on ? ' on' : ''}" aria-hidden="true"></span><b data-b="status-l">${label}</b></span>`;
    }
    // Mot-clé « expression (traduction) » → expression anglaise · traduction française.
    function kwHTML(k) {
      const m = str(k).match(/^(.+?)\s*\(([^()]+)\)\s*$/);
      return m ? `<span class="pill lv-kw-i"><b lang="en">${esc(m[1])}</b><span class="lv-kw-fr" lang="fr">${esc(m[2])}</span></span>` : `<span class="pill lv-kw-i"><b lang="en">${esc(k)}</b></span>`;
    }
    const sentencesOf = (t) => str(t).split(/(?<=[.!?…])\s+(?=["“«(]?[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
    // Phrases à afficher : paires EN / FR de l'IA ; sinon (ancienne IA) la réponse découpée en phrases.
    function linesFor(a, busy) {
      const l = arr(busy ? R.lines : a.lines).filter((x) => x && str(x.en).trim());
      if (l.length) return l;
      return sentencesOf(busy ? R.partial : a.text).map((en) => ({ en, fr: '' }));
    }
    const lineHTML = (l, isNew) => `<p class="lv-line${isNew ? ' is-new' : ''}"><span class="lv-en" lang="en">${esc(l.en)}</span><span class="lv-tr" lang="fr">${esc(str(l.fr))}</span></p>`;
    // Outils de la réponse (discrets) et de la vue (fenêtre flottante, plein écran, arrêt).
    const askNowBtn = (short) => `<button type="button" class="btn btn-sm lv-ghost" data-act="ask-now" title="Répondre à ce que le jury vient de dire (touche Espace)" aria-label="Répondre maintenant" aria-keyshortcuts="Space">${icon('sparkles')}<span>${short ? 'Répondre' : 'Répondre maintenant'}</span></button>`;
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
      if (desk) t.push(`<button type="button" class="btn btn-sm lv-ghost${R.float ? ' on' : ''}" data-act="float" aria-pressed="${!!R.float}" aria-keyshortcuts="P" title="Garder la réponse au premier plan, au-dessus de Teams (touche P)"${R.floatPending ? ' aria-disabled="true"' : ''}>${icon('pip')}<span>${R.floatPending ? 'Ouverture…' : 'Fenêtre flottante'}</span></button>`);
      if (canFull()) t.push(`<button type="button" class="btn btn-sm lv-ghost${isFull() ? ' on' : ''}" data-act="full" aria-pressed="${isFull()}" aria-keyshortcuts="F" title="Réponse en plein écran (touche F, Échap pour sortir)">${icon('eye')}<span>${isFull() ? 'Quitter le plein écran' : 'Plein écran'}</span></button>`);
      t.push(`<button type="button" class="btn btn-sm lv-ghost" data-act="listen-stop" title="Arrêter l’écoute">${icon('stop')}<span>Arrêter</span></button>`);
      return `<div class="ex-live-actions lv-tools lv-vtools">${t.join('')}</div>`;
    }
    // Fenêtre flottante : seule la fin de la phrase entendue tient sur une ligne.
    const tailOf = (t, n) => (t.length > n ? '…' + t.slice(-n).replace(/^\S*\s+/, '') : t);
    // Bloc « Jury » : question entendue (EN) + traduction (FR). Pendant que le jury parle,
    // la phrase entendue s'y affiche en direct à la place de la question précédente.
    function juryHTML(a, float) {
      const fr = a ? str(a.fr) : '';
      return `<div class="${a ? 'ex-live-q lv-q' : 'lv-q lv-q-live'}">
        <span class="lv-q-tag" aria-hidden="true">Jury</span>
        <div class="lv-q-body">
          ${a ? `<p class="lv-q-en ex-live-en" lang="en">${esc(a.question)}</p>
          <p class="lv-q-fr" lang="fr"${fr ? '' : ' hidden'}><span class="ex-live-fr" data-b="fr">${esc(fr)}</span></p>` : ''}
          <p class="lv-interim ex-live-interim" data-b="interim" lang="en">${esc(float ? tailOf(L.A.interim, 72) : L.A.interim)}</p>
        </div>
      </div>`;
    }
    function liveHTML(float) {
      const a = shown();
      const busy = R.busy && R.item === a;
      const lErr = !L.A.on && !L.A.starting && L.A.state === 'error' && !!L.A.error;
      const errBox = () => (R.err ? errHTML(R.err, R.errKind, float) : lErr ? errHTML(L.A.error, listenKind(L.A.errorCode), float) : '');
      if (!aiHas('liveAnswer')) return `<div class="lv-empty">${errHTML(OLD_AI, 'old', float)}</div>`;
      if (!L.A.on && !L.A.starting && !a) {
        // Sans clé IA, la cause est visible avant le clic ; le bouton reste actif.
        const noKey = !aiReady();
        const e = R.err || lErr ? errBox() : noKey ? errHTML(NO_KEY_START, 'key', float) : '';
        return `<div class="lv-start">
          <span class="lv-start-ic" aria-hidden="true">${icon('waveform')}</span>
          <h2 class="lv-start-t">Réponses en direct</h2>
          <p class="lv-start-p">L’assistant écoute le jury et vous propose une réponse à dire, <b lang="en">en anglais</b>, avec le français dessous.</p>
          <button type="button" class="btn${noKey ? '' : ' btn-primary'} btn-lg lv-go" data-act="assist">${icon('mic')}<span>Lancer l’assistant</span></button>
          ${e}
          <p class="lv-tip">${icon('video', 'ico-inline')}<span>${desk ? 'Placez la fenêtre flottante juste sous la caméra.' : 'Posez le téléphone juste sous la caméra.'}</span></p>
        </div>`;
      }
      const relaunch = !L.A.on && !L.A.starting && !float ? `<button type="button" class="btn btn-primary btn-sm" data-act="assist">${icon('mic')}<span>Relancer l’assistant</span></button>` : '';
      const head = `<div class="ex-live-head lv-head">${statusHTML(busy, a)}<span class="spacer"></span>${float ? '' : viewTools()}${relaunch}</div>${warnHTML()}`;
      if (!a) {
        // Fenêtre flottante : l'état reste en bas, comme quand une réponse est affichée.
        return `${float ? warnHTML() : head}
          ${juryHTML(null, float)}
          <div class="lv-empty">
            <p class="ex-live-empty lv-wait">${float ? 'La réponse s’affichera ici.' : 'La réponse s’affichera ici dès la question du jury.'}</p>
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
    // Page cachée (Teams au premier plan) : seule la fenêtre flottante est repeinte.
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
        if (k === 'ready') C.say('Réponse prête : ' + str(((a && arr(a.lines)[0]) || {}).en || (a && a.text) || ''));
        else if ((k === 'off' && R.lastK) || (k === 'listen' && R.lastK === 'start')) C.say(label);
        R.lastK = k;
      }
    }
    // Flux : phrases mises à jour sur place, les nouvelles apparaissent en fondu (pas de clignotement).
    function syncLines(el, lines) {
      lines.forEach((l, i) => {
        const p = el.children[i];
        if (!p) { el.insertAdjacentHTML('beforeend', lineHTML(l, true)); return; }
        const en = p.firstElementChild, tr = p.lastElementChild;
        if (en.textContent !== l.en) en.textContent = l.en;
        if (tr.textContent !== str(l.fr)) tr.textContent = str(l.fr);
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
    function paintQFr(item) {
      if (shown() !== item) return;
      views().forEach((v) => {
        const el = $('[data-b="fr"]', v);
        if (el) { el.textContent = item.fr; if (el.parentElement) el.parentElement.hidden = !item.fr; fitAns(v); }
      });
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
    // Connexion à l'IA ouverte d'avance (DNS + TLS) : au lancement et dès que le jury parle.
    let warmedAt = 0;
    function warmAI() {
      const t = Date.now();
      if (t - warmedAt < 8000) return;
      warmedAt = t;
      try { if (S.ai && S.ai.warm) S.ai.warm('live'); } catch (e) {  }
    }
    C.paintListen = () => {
      const b = $('[data-b="listen"]', root);
      if (b) b.innerHTML = listenHTML(L.A, { startLabel: 'Lancer l’assistant', onLabel: 'J’écoute l’appel', quiet: true });
      paintLive();
    };
    function paintHist() {
      if (!C.alive) return;
      const box = $('[data-b="hist"]', root);
      const list = call.answers;
      $('[data-b="hist-n"]', root).textContent = list.length;
      const cur = shown();
      box.innerHTML = list.length ? `<ol class="ex-chist">${list.slice().reverse().map((a) => `<li class="ex-chist-item${a === cur ? ' is-current' : ''}" data-id="${esc(a.id)}">
          <p class="ex-chist-q" lang="en">${esc(a.question)}</p>
          ${a.fr ? `<p class="ex-chist-fr">${esc(a.fr)}</p>` : ''}
          ${a.text ? `<p class="ex-chist-a"><span class="ex-chist-l">Réponse IA</span><span lang="en">${esc(a.text)}</span></p>` : a.error ? `<p class="ex-chist-err">${esc(a.error)}</p>` : R.busy && R.item === a ? '<p class="small muted">Réponse en cours…</p>' : ''}
          ${a.mine ? `<p class="ex-chist-mine"><span class="ex-chist-l">Ce que j’ai dit</span><span lang="en">${esc(a.mine)}</span></p>` : ''}
        </li>`).join('')}</ol>`
        : '<p class="small muted">Les questions du jury, les réponses IA et ce que vous avez dit s’affichent ici.</p>';
    }

    function callExpose() {
      const out = [];
      for (const t of call.turns) { if (t.who === 'jury') break; out.push(t.text); }
      return out.join(' ').slice(-6000);
    }
    async function ask(question, o) {
      o = o || {};
      const prev = R.item;
      if (R.ctrl) R.ctrl.abort();
      let item = o.item;
      if (!item) {
        if (prev && R.busy) {
          if (question.includes(prev.question)) call.answers = call.answers.filter((x) => x !== prev);
          else if (!prev.text) prev.error = 'Interrompue par la question suivante.';
        }
        item = { id: 'a-' + uid(), question, fr: '', text: '', lines: [], keyWords: [], mine: '', at: nowIso(), skipped: false, error: '' };
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
      const drop = () => { call.answers = call.answers.filter((x) => x !== item); if (R.item === item) R.item = null; };
      try {
        if (!aiHas('liveAnswer')) throw new Error(OLD_AI);
        if (!item.fr && aiHas('translate')) {
          S.examAI.translate(question, { to: 'fr', signal: ctrl.signal }).then((fr) => {
            fr = str(fr).trim();
            if (!fr || !C.alive || !call.answers.includes(item)) return;
            if (item.fr) return;
            item.fr = fr; C.saveSoon();
            paintQFr(item);
            paintHist();
          }).catch(() => {  });
        }
        // Requête lancée d'abord, peinture ensuite : le réseau n'attend pas le rendu.
        const pr = S.examAI.liveAnswer({
          subject: s.subject, question, expose: callExpose(), shorter: !!o.shorter, signal: ctrl.signal,
          force, previous: o.shorter ? prevText : '',
          turns: call.turns.slice(-16).map((t) => ({ who: t.who, text: t.text })),
          onDelta: (t, info) => {
            if (R.req !== req || !C.alive) return;
            R.partial = str(t);
            R.lines = arr(info && info.lines);
            const qFr = str(info && info.qFr).trim();
            if (qFr && !item.fr) { item.fr = qFr; paintQFr(item); }
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
        item.lines = arr(r.lines).filter((l) => l && str(l.en).trim()).map((l) => ({ en: str(l.en).trim(), fr: str(l.fr).trim() })).slice(0, 12);
        if (!item.fr && str(r.qFr).trim()) item.fr = str(r.qFr).trim();
        item.keyWords = arr(r.keyWords).map(str).map((k) => k.trim()).filter(Boolean).slice(0, 8);
        R.jury = R.jury.filter((x) => x.at > born);
      } catch (e) {
        if (R.req !== req || !C.alive || isAbort(e)) return;
        const keyBad = !!(e && KEY_CODES.includes(e.code));
        item.error = e && e.code === 'NO_KEY' ? NO_KEY_LIVE : keyBad ? (errMsg(e) || 'Clé IA refusée : corrigez-la dans Réglages.') : errMsg(e);
        item.errKey = keyBad;
        item.errNet = !!(e && /^(NETWORK|OFFLINE|TIMEOUT)$/.test(e.code));
      } finally {
        if (R.req === req) { dropRaf(); Object.assign(R, { busy: false, ctrl: null, partial: '', lines: [], mode: '' }); if (C.alive) { paintLive(); paintHist(); } }
        C.saveSoon();
      }
    }

    C.onHeard = (role, text) => {
      if (!text || !C.alive) return;
      L.A.interim = '';
      C.paintInterim();
      const now = Date.now();
      if (!call.startedAt) call.startedAt = now;
      const q = isQ(text);
      const jury = role === 'jury' || (role === 'mixed' && q);
      call.turns.push({ who: jury ? 'jury' : 'student', text, t: now - call.startedAt });
      if (call.turns.length > 400) call.turns.splice(0, call.turns.length - 400);
      if (R.warn) { R.warn = ''; paintLive(); }
      if (jury) {
        warmAI();
        R.jury = R.jury.filter((x) => now - x.at < JOIN_MS).concat({ text, at: now });
        // Suite d'une question coupée par une pause du jury : relance avec la phrase entière tant que rien n'est affiché.
        const joined = R.jury.map((x) => x.text).join(' ');
        const cont = !q && role === 'jury' && R.busy && R.mode === 'auto' && R.item && joined.includes(R.item.question) && !R.lines.length && !R.partial && now - R.born < 4000;
        if (q || cont) ask(joined);
      } else {
        const a = shown();
        if (a) { a.mine = (a.mine ? a.mine + ' ' : '') + text; paintHist(); }
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
      if (!aiHas('liveAnswer')) { R.err = OLD_AI; R.errKind = 'old'; paintLive(); return; }
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
        if (R.busy && R.item && !R.item.text && !R.item.error) R.item.error = 'Réponse interrompue (fin de l’appel).';
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
    // moitié de la hauteur) et laisse voir le jury ; une réponse de 90 mots y reste lisible à 60-70 cm.
    const FLOAT_W = 760, FLOAT_H = 420;
    function toggleFloat() {
      if (R.floatPending) return;
      if (R.float) { closeFloat(); paintLive(); return; }
      if (!L.A.on) { toast('Lancez d’abord l’assistant : la fenêtre flottante suit l’appel en direct.', 'info'); return; }
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
        w.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aide Visio · appel</title></head><body></body></html>');
        w.document.close();
      } catch (e) {  }
      setupFloat(w);
    }
    function setupFloat(w) {
      if (!C.alive || !(L.A.on || L.A.starting)) { try { w.close(); } catch (e) {  } return; }
      const doc = w.document;
      try { doc.title = 'Aide Visio · appel'; } catch (e) {  }
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
      const t = (L.A.interim || '').trim() || (R.jury.length ? R.jury.map((x) => x.text).join(' ') : str((call.turns.slice().reverse().find((x) => x.who === 'jury') || call.turns[call.turns.length - 1] || {}).text));
      if (!t) return;
      if (R.busy && R.item && R.item.question === t) return;
      const last = call.answers[call.answers.length - 1];
      if (!L.A.interim && !R.jury.length && last && last.question === t && last.text) return;
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
      if (WARN_OFF.test(code)) { if (R.warn) { R.warn = ''; paintLive(); } return; }
      if (!/^warn/.test(str(ev.kind)) || !msg) return;
      R.warn = msg;
      paintLive();
    }) : null;

    function setLink(value) {
      const v = str(value).trim();
      const link = teamsValid(v);
      const box = $('[data-b="teams"]', root), hint = $('[data-b="teams-hint"]', root), f = $('[data-f="teams"]', root);
      if (box) { box.classList.toggle('is-set', !!link); box.classList.toggle('is-bad', !link && !!v); }
      if (f && (link || !v)) f.removeAttribute('aria-invalid');
      if (hint) hint.textContent = link ? `Lien ${meetingApp(link)} enregistré pour cet appel.` : v ? LINK_BAD : LINK_HINT;
      if (link && link !== s.teamsLink) { s.teamsLink = link; setPrefs({ studentTeams: link }); C.saveSoon(); }
      return link;
    }

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
      else if (act === 'import-subject') importSubjectSheet((subj) => {
        s.subject = normSubject(subj); s.subjectId = s.subject.id; C.saveNow();
        const d = $('.ex-call-subject', root);
        if (d) d.outerHTML = subjectCard();
        const sub = $('.ex-topbar .ex-tb-title small', root);
        if (sub) sub.textContent = s.subject.title;
      });
      else if (act === 'settings') go('#/settings');
      else if (act === 'use-mic') { L.A.preset = 'haut-parleur'; setPrefs({ callListenPreset: L.A.preset }); C.paintListen(); assist(); }
      else if (act === 'pick-src') {
        const card = $('[data-b="listen-card"]', root);
        if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); const o = $('.ex-src-opt.on, .ex-src-opt', card); if (o) o.focus({ preventScroll: true }); }
      }
      else if (act === 'export') downloadText(exportMd(s), `appel-entrainement-${s.createdAt.slice(0, 10)}.md`);
      else if (act === 'end') endCall();
      else if (act === 'teams-join') {
        const f = $('[data-f="teams"]', root);
        const v = f ? f.value.trim() : '';
        if (!v) { linkEmpty(root, f); return; }
        const link = setLink(v);
        if (link && f) f.value = link;
        openTeams(v);
      }
    }
    root.addEventListener('click', (e) => {
      const src = e.target.closest('[data-src]');
      if (src && !src.disabled) { L.A.preset = src.dataset.src; setPrefs({ callListenPreset: L.A.preset }); C.paintListen(); return; }
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) onAct(b.dataset.act);
    });
    root.addEventListener('input', (e) => { const f = e.target.closest && e.target.closest('[data-f="teams"]'); if (f && teamsValid(f.value)) setLink(f.value); });
    root.addEventListener('change', (e) => {
      const f = e.target.closest && e.target.closest('[data-f="teams"]');
      if (!f) return;
      const link = setLink(f.value);
      if (link && f.value !== link) f.value = link;
    });
    root.addEventListener('keydown', linkEnter);

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
        return confirmSheet({ title: 'Quitter l’appel ?', text: 'L’assistant écoute encore : il sera arrêté. Questions et réponses restent enregistrées.', okLabel: 'Quitter', cancelLabel: 'Rester' });
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
        if (R.busy && R.item && !R.item.text && !R.item.error) R.item.error = 'Réponse interrompue (fin de l’appel).';
        if (R.ctrl) R.ctrl.abort();
        dropRaf();
        closeFloat();
        C.saveNow();
        L.stop({ drainMs: 0 });
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
  const homeDef = def(renderHome);
  const oralDef = def((root, p) => {
    if (!p.id || p.id === 'new') return renderChooser(root, 'jury');
    const s = store.get(p.id);
    if (!s) { root.innerHTML = notFoundHTML(); setCurrent({}); return; }
    fixSession(s);
    if (s.kind !== 'jury') { go(sessionHash(s)); return; }
    renderJury(root, s);
  });
  const eleveDef = def((root, p) => {
    if (!p.id || p.id === 'new') return renderChooser(root, 'solo');
    const s = store.get(p.id);
    if (!s) { root.innerHTML = notFoundHTML(); setCurrent({}); return; }
    fixSession(s);
    if (s.kind === 'call') { go(sessionHash(s)); return; }
    renderSolo(root, s);
  });
  const callDef = def((root, p) => {
    if (!p.id || p.id === 'new') return renderTeamsStart(root);
    const s = store.get(p.id);
    if (!s) { root.innerHTML = notFoundHTML(); setCurrent({}); return; }
    fixSession(s);
    if (s.kind !== 'call') { go(sessionHash(s)); return; }
    renderCall(root, s);
  });
  function notFoundHTML() {
    return `<div class="screen"><div class="empty empty-page card"><div class="empty-ic">${icon('info')}</div><h1 class="h2">Séance introuvable</h1><p class="muted">Elle a peut-être été supprimée.</p><div class="row center"><button type="button" class="btn btn-primary" data-go="#/">${icon('home')}<span>Accueil</span></button></div></div></div>`;
  }

  S.exam = Object.assign(S.exam || {}, {
    homeDef, store, speakEn, normSubject, newSession, exportMd,
    defs: { oral: oralDef, sujet: def(renderSujet), eleve: eleveDef, appel: callDef, fiches: def(renderFiches), historique: def(renderHistory) }
  });

  function registerAll() {
    if (!S.app || !S.app.register) return false;
    S.app.register('', homeDef);
    Object.keys(S.exam.defs).forEach((k) => S.app.register(k, S.exam.defs[k]));
    return true;
  }
  if (!registerAll()) document.addEventListener('DOMContentLoaded', registerAll, { once: true });

  const flushCurrent = () => { try { if (CUR && CUR.flush) CUR.flush(); } catch (e) {  } };
  window.addEventListener('pagehide', flushCurrent);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushCurrent(); });

  window.addEventListener('beforeunload', (e) => {
    let busy = false;
    try { busy = !!(CUR && (CUR.busy ? CUR.busy() : (S.audio && S.audio.running && CUR.canLeave))); } catch (er) { busy = false; }
    if (busy) { flushCurrent(); e.preventDefault(); e.returnValue = ''; }
  });
})(window.AideVisio = window.AideVisio || {});
