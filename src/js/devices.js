(function (S) {
  'use strict';

  // Appareils du PC : micro, haut-parleur, caméra, voix anglaise.
  // Les choix sont gardés dans les réglages (aidevisio.settings) :
  //   micDeviceId / micLabel, speakerDeviceId / speakerLabel,
  //   cameraDeviceId / cameraLabel, voiceURI / voiceName.
  // '' = appareil par défaut de Windows.

  const nav = navigator;
  const md = () => nav.mediaDevices || null;
  const KIND = { mic: 'audioinput', speaker: 'audiooutput', camera: 'videoinput' };
  const ID = { mic: 'micDeviceId', speaker: 'speakerDeviceId', camera: 'cameraDeviceId', voice: 'voiceURI' };
  const LABEL = { mic: 'micLabel', speaker: 'speakerLabel', camera: 'cameraLabel', voice: 'voiceName' };
  const FALLBACK = { mic: 'Micro', speaker: 'Haut-parleur', camera: 'Caméra' };

  function settings() {
    try { return (S.store && S.store.settings && S.store.settings()) || {}; } catch (e) { return {}; }
  }
  function save(patch) {
    try { if (S.store && S.store.setSettings) S.store.setSettings(patch); } catch (e) {  }
  }
  const str = (v) => (v == null ? '' : String(v));
  const cleanLabel = (l) => str(l).replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').replace(/^(Par défaut|Default)\s*-\s*/i, '').trim();

  // ---------- Liste et choix des appareils ----------

  async function list(kind) {
    const m = md();
    if (!m || typeof m.enumerateDevices !== 'function') return [];
    let all = [];
    try { all = await m.enumerateDevices(); } catch (e) { return []; }
    const k = KIND[kind];
    const items = all.filter((d) => d.kind === k && d.deviceId !== 'communications');
    const def = items.find((d) => d.deviceId === 'default');
    const out = [];
    const seen = new Set();
    if (def) {
      out.push({ id: '', label: def.label ? `Par défaut de Windows (${cleanLabel(def.label)})` : 'Par défaut de Windows', isDefault: true, raw: def.label });
      seen.add('');
    }
    items.forEach((d, i) => {
      if (d.deviceId === 'default' || seen.has(d.deviceId)) return;
      seen.add(d.deviceId);
      out.push({ id: d.deviceId, label: cleanLabel(d.label) || `${FALLBACK[kind]} ${i + 1}`, isDefault: false, raw: d.label });
    });
    if (!def && out.length) out.unshift({ id: '', label: 'Par défaut de Windows', isDefault: true, raw: '' });
    return out;
  }

  const hasLabels = (items) => items.some((d) => !d.isDefault && d.raw);

  function chosen(kind) {
    return str(settings()[ID[kind]]);
  }

  // Id réellement utilisable : l'id mémorisé s'il existe encore, sinon
  // l'appareil de même nom (les id changent parfois après un effacement
  // des cookies), sinon '' (défaut de Windows).
  async function resolve(kind) {
    const s = settings();
    const id = str(s[ID[kind]]);
    if (!id) return '';
    const items = await list(kind);
    if (!hasLabels(items)) return id;
    if (items.some((d) => d.id === id)) return id;
    const lbl = str(s[LABEL[kind]]);
    const same = lbl && items.find((d) => !d.isDefault && d.label === lbl);
    if (same) { save({ [ID[kind]]: same.id }); return same.id; }
    return '';
  }

  function choose(kind, id, label) {
    save({ [ID[kind]]: str(id), [LABEL[kind]]: str(id ? cleanLabel(label) : '') });
  }

  // ---------- Ouverture des flux ----------

  const canChooseSpeaker = () => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  async function openMic(extra) {
    const m = md();
    if (!m || !m.getUserMedia) throw Object.assign(new Error('Micro indisponible'), { name: window.isSecureContext === false ? 'SecurityError' : 'NotSupportedError' });
    const id = await resolve('mic');
    const audio = Object.assign({ echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: { ideal: 1 } }, extra || {});
    if (id) audio.deviceId = { exact: id };
    try {
      return await m.getUserMedia({ audio, video: false });
    } catch (e) {
      if (id && e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
        delete audio.deviceId;
        return m.getUserMedia({ audio, video: false });
      }
      throw e;
    }
  }

  async function openCamera(extra) {
    const m = md();
    if (!m || !m.getUserMedia) throw Object.assign(new Error('Caméra indisponible'), { name: window.isSecureContext === false ? 'SecurityError' : 'NotSupportedError' });
    const id = await resolve('camera');
    const video = Object.assign({ width: { ideal: 1280 }, height: { ideal: 720 } }, extra || {});
    if (id) video.deviceId = { exact: id };
    try {
      return await m.getUserMedia({ video, audio: false });
    } catch (e) {
      if (id && e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
        delete video.deviceId;
        return m.getUserMedia({ video, audio: false });
      }
      throw e;
    }
  }

  function stop(stream) {
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) {  }
  }

  async function permission(kind) {
    const name = kind === 'camera' ? 'camera' : 'microphone';
    try {
      if (!nav.permissions || !nav.permissions.query) return 'unknown';
      const r = await nav.permissions.query({ name });
      return r.state || 'unknown';
    } catch (e) { return 'unknown'; }
  }

  // ---------- Son de test ----------

  let chimeUrl = '';
  function chime() {
    if (chimeUrl) return chimeUrl;
    const rate = 22050;
    const notes = [[659.25, 0, 0.28], [880, 0.24, 0.55]];
    const len = Math.round(rate * 0.85);
    const pcm = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      let v = 0;
      notes.forEach(([f, a, d]) => {
        if (t < a || t > a + d) return;
        const x = t - a;
        const env = Math.min(1, x / 0.012) * Math.exp(-x * 5.5);
        v += Math.sin(2 * Math.PI * f * x) * env + 0.25 * Math.sin(4 * Math.PI * f * x) * env;
      });
      pcm[i] = Math.max(-1, Math.min(1, v * 0.45)) * 32767;
    }
    const buf = new ArrayBuffer(44 + pcm.byteLength);
    const dv = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.byteLength, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    w(36, 'data'); dv.setUint32(40, pcm.byteLength, true);
    new Int16Array(buf, 44).set(pcm);
    chimeUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
    return chimeUrl;
  }

  // Joue deux fois un petit carillon sur la sortie choisie.
  async function playTestSound() {
    const a = new Audio(chime());
    a.volume = 1;
    const id = await resolve('speaker');
    if (id && typeof a.setSinkId === 'function') await a.setSinkId(id);
    for (let i = 0; i < 2; i++) {
      a.currentTime = 0;
      await a.play();
      await new Promise((r) => { const done = () => { a.removeEventListener('ended', done); r(); }; a.addEventListener('ended', done); setTimeout(done, 1500); });
    }
    return { sink: id };
  }

  // ---------- Voix anglaise ----------

  let voicesP = null;
  function allVoices() {
    if (voicesP) return voicesP;
    voicesP = new Promise((res) => {
      const sy = window.speechSynthesis;
      if (!sy) { res([]); return; }
      const v = sy.getVoices();
      if (v && v.length) { res(v); return; }
      let done = false;
      const fin = () => { if (done) return; done = true; res(sy.getVoices() || []); };
      try { sy.addEventListener('voiceschanged', fin, { once: true }); } catch (e) { sy.onvoiceschanged = fin; }
      setTimeout(fin, 2000);
    }).then((v) => { if (!v.length) voicesP = null; return v; });
    return voicesP;
  }
  try { if (window.speechSynthesis) window.speechSynthesis.addEventListener('voiceschanged', () => { voicesP = null; }); } catch (e) {  }

  function voiceScore(v) {
    const n = str(v.name);
    const l = str(v.lang).replace('_', '-');
    let s = /^en-GB/i.test(l) ? 0 : /^en-US/i.test(l) ? 0.5 : 3;
    if (/natural|neural/i.test(n)) s -= 2;
    else if (/^Google/i.test(n)) s -= 1.5;
    else if (/online/i.test(n)) s -= 1;
    if (/Hazel|Zira|David|George|Susan|Mark/i.test(n) && !/natural|online/i.test(n)) s += 0.3;
    return s;
  }

  function niceVoiceName(v) {
    const n = str(v.name)
      .replace(/^Microsoft\s+/i, '')
      .replace(/\s*-\s*English\s*\((United States|United Kingdom|Great Britain)\)/i, '')
      .replace(/\s*Online\s*\(Natural\)/i, ' (naturelle)');
    const l = str(v.lang).replace('_', '-');
    const accent = /^en-GB/i.test(l) ? 'britannique' : /^en-US/i.test(l) ? 'américaine' : l;
    return `${n} · ${accent}${v.localService === false ? ' · en ligne' : ''}`;
  }

  async function voices() {
    const all = (await allVoices()).filter((v) => /^en[-_]/i.test(v.lang || ''));
    const main = all.filter((v) => /^en[-_](GB|US)/i.test(v.lang));
    return (main.length ? main : all).slice().sort((a, b) => voiceScore(a) - voiceScore(b));
  }

  // Voix choisie (ou la meilleure disponible si aucun choix / voix disparue).
  async function voice() {
    const vs = await voices();
    if (!vs.length) return null;
    const s = settings();
    return vs.find((v) => v.voiceURI === s.voiceURI) || vs.find((v) => s.voiceName && v.name === s.voiceName) || vs[0];
  }

  const canSpeak = () => !!(window.speechSynthesis && window.SpeechSynthesisUtterance);

  // Lit un texte anglais avec la voix choisie. Résout true si la lecture est allée au bout.
  async function speak(text, o) {
    o = o || {};
    if (!text || !canSpeak()) return false;
    const v = o.voice || await voice();
    const sy = window.speechSynthesis;
    try { sy.cancel(); } catch (e) {  }
    return new Promise((resolveP) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = v ? v.lang : 'en-GB';
      if (v) u.voice = v;
      u.rate = o.rate || 1;
      let done = false;
      // Chrome coupe les voix « Google » en ligne après ~15 s : petit relais pause/reprise.
      const keep = v && v.localService === false ? setInterval(() => { try { if (sy.speaking && !sy.paused) { sy.pause(); sy.resume(); } } catch (e) {  } }, 10000) : 0;
      const fin = (ok, err) => { if (done) return; done = true; clearTimeout(g); clearInterval(keep); if (o.onEnd) o.onEnd(ok, err); resolveP(ok); };
      const g = setTimeout(() => fin(true), 6000 + text.length * 120 / u.rate);
      u.onstart = () => { if (o.onStart) o.onStart(); };
      u.onend = () => fin(true);
      u.onerror = (e) => fin(false, e && e.error);
      try { sy.speak(u); } catch (e) { fin(false, 'speak'); }
    });
  }

  // ---------- Messages d'erreur en français simple ----------

  function explain(err, kind) {
    const e = err || {};
    const name = str(e.name || e.code || e.error || e);
    const msg = str(e.message);
    const what = kind === 'camera' ? 'la caméra' : kind === 'speaker' ? 'le haut-parleur' : 'le micro';
    const What = what.charAt(0).toUpperCase() + what.slice(1);
    const winPath = kind === 'camera' ? 'Caméra' : 'Microphone';
    if (/NotAllowed|MIC_DENIED|PermissionDenied/i.test(name)) {
      if (/system/i.test(msg)) {
        return { title: `Windows bloque ${what}.`, advice: `Ouvrez Paramètres Windows → Confidentialité et sécurité → ${winPath} : activez « Accès ${kind === 'camera' ? 'à la caméra' : 'au microphone'} » et « Autoriser les applications de bureau ». Puis relancez la vérification.` };
      }
      return { title: `Chrome n’a pas le droit d’utiliser ${what}.`, advice: `Cliquez sur l’icône à gauche de l’adresse (réglages du site) → ${kind === 'camera' ? 'Caméra' : 'Micro'} → Autoriser. Rechargez la page, puis relancez la vérification.` };
    }
    if (/NotReadable|TrackStart|MIC_BUSY|AbortError/i.test(name)) {
      if (kind === 'camera') return { title: 'La caméra est déjà utilisée par une autre application.', advice: 'Teams (ou Zoom, l’appli Caméra…) garde la caméra. Coupez la caméra dans Teams ou fermez-le, puis relancez. Vérifiez aussi que la caméra n’est pas masquée ou coupée par une touche du clavier.' };
      return { title: 'Le micro est bloqué.', advice: 'Une autre application le garde peut-être (Teams, Zoom, enregistreur). Fermez-la, vérifiez que la touche « micro coupé » du clavier n’est pas activée, puis relancez.' };
    }
    if (/NotFound|DevicesNotFound|MIC_NOT_FOUND/i.test(name)) {
      return { title: `Aucun${kind === 'camera' ? 'e caméra trouvée' : kind === 'speaker' ? ' haut-parleur trouvé' : ' micro trouvé'}.`, advice: `Vérifiez dans Paramètres Windows → Système → ${kind === 'camera' ? 'Bluetooth et appareils → Caméras' : 'Son'} que ${what} est activé${kind === 'camera' ? 'e' : ''}.` };
    }
    if (/Overconstrained/i.test(name)) {
      return { title: `${What} choisi${kind === 'camera' ? 'e' : ''} n’est plus branché${kind === 'camera' ? 'e' : ''}.`, advice: 'Choisissez « Par défaut de Windows » dans la liste.' };
    }
    if (/Security|INSECURE/i.test(name)) {
      return { title: 'Page non sécurisée.', advice: 'Ouvrez Aide Visio par son adresse https:// (ou l’app installée).' };
    }
    if (/NotSupported|NO_MEDIA/i.test(name)) {
      return { title: `${What} n’est pas accessible dans ce navigateur.`, advice: 'Utilisez Google Chrome à jour.' };
    }
    return { title: `${What} ne répond pas.`, advice: `Rechargez la page puis relancez la vérification.${msg ? ` (${msg.slice(0, 120)})` : ''}` };
  }

  function explainSpeech(code) {
    switch (str(code)) {
      case 'not-allowed':
      case 'service-not-allowed':
        return { title: 'Chrome n’a pas le droit d’utiliser le micro pour la dictée.', advice: 'Icône à gauche de l’adresse → Micro → Autoriser, puis relancez.' };
      case 'no-speech':
        return { title: 'Rien entendu.', advice: 'Dites « hello » bien fort, près du PC, juste après avoir cliqué.' };
      case 'audio-capture':
        return { title: 'La dictée ne trouve pas le micro.', advice: 'La dictée de Chrome utilise le micro par défaut de Windows : Paramètres Windows → Système → Son → Entrée → choisissez votre micro.' };
      case 'network':
        return { title: 'Le service de dictée de Google ne répond pas.', advice: 'La dictée a besoin d’internet. Vérifiez le wifi, ou coupez le VPN / pare-feu, puis relancez.' };
      case 'language-not-supported':
        return { title: 'Anglais non disponible pour la dictée.', advice: 'Mettez Chrome à jour, puis relancez.' };
      case 'unsupported':
        return { title: 'Dictée indisponible dans ce navigateur.', advice: 'Utilisez Google Chrome à jour.' };
      default:
        return { title: 'La dictée n’a pas fonctionné.', advice: 'Relancez le test. Si cela recommence, rechargez la page.' };
    }
  }

  // Écoute un mot anglais avec la dictée de Chrome. Résout { ok, text, code }.
  function listenOnce(o) {
    o = o || {};
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return Promise.resolve({ ok: false, text: '', code: 'unsupported' });
    return new Promise((res) => {
      const r = new Ctor();
      r.lang = o.lang || 'en-US';
      r.continuous = false;
      r.interimResults = true;
      r.maxAlternatives = 3;
      let text = ''; let code = ''; let done = false;
      const fin = () => {
        if (done) return; done = true; clearTimeout(t);
        try { r.abort(); } catch (e) {  }
        const tx = text.trim(); const ok = !!tx && (!code || code === 'no-speech');
        res({ ok, text: tx, code: ok ? '' : (code || 'no-speech') });
      };
      const t = setTimeout(fin, o.timeoutMs || 8000);
      // Annulation par AbortSignal (écran quitté) : libère le micro tout de suite.
      if (o.signal) { if (o.signal.aborted) { fin(); return; } o.signal.addEventListener('abort', fin, { once: true }); }
      r.onresult = (e) => {
        let all = '';
        for (let i = 0; i < e.results.length; i++) all += e.results[i][0] ? e.results[i][0].transcript : '';
        text = all;
        if (o.onText) o.onText(all.trim());
        if (e.results[e.results.length - 1].isFinal) fin();
      };
      r.onerror = (e) => { code = (e && e.error) || 'error'; if (code !== 'no-speech' || !text) fin(); };
      r.onend = () => fin();
      try { r.start(); } catch (e) { code = 'error'; fin(); }
    });
  }

  // Niveau du micro en direct : ouvre le micro choisi, appelle onLevel(0..1)
  // pendant ms millisecondes, puis libère tout. Résout { ok, peak, label, error }.
  async function testMic(o) {
    o = o || {};
    const ms = o.ms || 3000;
    let stream = null; let ctx = null;
    const res = { ok: false, peak: 0, label: '', error: null };
    try {
      stream = await openMic({ echoCancellation: false, noiseSuppression: false, autoGainControl: true });
    } catch (e) { res.error = e; return res; }
    const tr = stream.getAudioTracks()[0];
    res.label = cleanLabel(tr && tr.label);
    try {
      if (tr && tr.muted) res.muted = true;
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) {  } }
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      const t0 = performance.now();
      while (performance.now() - t0 < ms) {
        if (o.alive && !o.alive()) break;
        await new Promise((r) => setTimeout(r, 50));
        an.getFloatTimeDomainData(buf);
        let s2 = 0;
        for (let i = 0; i < buf.length; i++) s2 += buf[i] * buf[i];
        const rms = Math.sqrt(s2 / buf.length);
        const v = rms > 0 ? Math.min(1, Math.max(0, (20 * Math.log10(rms) + 60) / 60)) : 0;
        res.peak = Math.max(res.peak, v);
        if (o.onLevel) o.onLevel(v, Math.max(0, ms - (performance.now() - t0)));
      }
    } catch (e) { res.error = e; }
    finally {
      stop(stream);
      if (ctx) { try { await ctx.close(); } catch (e) {  } }
    }
    res.ok = !res.error && res.peak >= 0.3;
    return res;
  }

  S.devices = {
    list, hasLabels, chosen, resolve, choose, permission,
    openMic, openCamera, stop, canChooseSpeaker,
    playTestSound, testMic, listenOnce,
    voices, voice, speak, canSpeak, niceVoiceName,
    explain, explainSpeech, cleanLabel
  };
})(window.AideVisio = window.AideVisio || {});
