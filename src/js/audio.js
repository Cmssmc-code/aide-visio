(function (S) {
  'use strict';

  const G = typeof window !== 'undefined' ? window : globalThis;
  const hasDoc = typeof document !== 'undefined' && typeof document.addEventListener === 'function';
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const now = () => Date.now();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const TARGET_RATE = 16000;

  const MSG = {
    NO_DISPLAY_AUDIO: "Le partage ne contient pas de son. Recommencez et cochez « Partager l'audio de l'onglet » (Meet dans Chrome) ou « Partager l'audio du système » (Teams en application : choisissez « Écran entier »).",
    DISPLAY_CANCELLED: "Partage annulé. Choisissez l'onglet de la visio (ou l'écran entier pour Teams) et cochez le partage de l'audio.",
    DISPLAY_UNSUPPORTED: "Ce navigateur ne sait pas capter le son d'un onglet. Utilisez Chrome ou Edge sur PC, ou choisissez « Micro / haut-parleur ».",
    DISPLAY_NEEDS_GESTURE: "Le partage d'onglet doit partir d'un clic : appuyez de nouveau sur le bouton qui lance l'écoute.",
    DISPLAY_ENDED: "Le partage de l'onglet a été arrêté : la voix du jury n'est plus captée.",
    PC_SILENT: "Aucun son de l'appel capté depuis 2 minutes. Vérifiez que Teams ou Meet sort sur les haut-parleurs par défaut de Windows.",
    DISPLAY_SILENT: "Aucun son ne vient de l'onglet partagé depuis une minute. Vérifiez l'onglet choisi et la case de partage de l'audio.",
    MIC_DENIED: "Accès au micro refusé. Cliquez sur le cadenas à gauche de l'adresse, autorisez le micro, puis réessayez.",
    MIC_NOT_FOUND: "Aucun micro détecté. Branchez un micro ou un casque, puis réessayez.",
    MIC_BUSY: "Le micro est indisponible (utilisé par une autre application ?). Fermez-la ou choisissez un autre micro.",
    MIC_LOST: "Micro déconnecté : reconnexion en cours…",
    MIC_BACK: "Micro reconnecté.",
    MIC_MUTED: "Le micro semble coupé (touche de sourdine ou réglage de Windows).",
    DISPLAY_MUTED: "Le son de l'onglet partagé est interrompu.",
    NO_MEDIA: "Ce navigateur ne permet pas d'accéder au micro.",
    INSECURE: "Le micro n'est accessible qu'en HTTPS. Ouvrez la version en ligne de Aide Visio.",
    NO_WEBSPEECH: "La reconnaissance vocale n'est pas disponible dans ce navigateur. Utilisez Chrome ou Edge, ou choisissez « Son de l’appel sur ce PC ».",
    NO_KEY: "Ce choix de son a besoin d'une clé IA (Réglages). Sans clé, choisissez « Micro / haut-parleur ».",
    KEY_ERROR: "Clé IA refusée par la transcription : corrigez-la dans Réglages. Les passages en attente seront transcrits ensuite.",
    NOT_ALLOWED: "Reconnaissance vocale refusée : autorisez le micro pour ce site.",
    SERVICE_NOT_ALLOWED: "Le service de reconnaissance vocale est bloqué sur ce poste. Choisissez « Son de l’appel sur ce PC ».",
    LANGUAGE: "Langue non prise en charge par la reconnaissance vocale.",
    NETWORK: "Reconnaissance vocale : réseau instable, nouvel essai…",
    AUDIO_CAPTURE: "Le micro ne répond pas, nouvel essai…",
    WATCHDOG: "Reconnaissance vocale figée : redémarrage automatique.",
    LOCAL_SPEECH: "Réseau indisponible : reconnaissance vocale passée en mode local.",
    TRANSCRIBE_FAILED: "La transcription IA échoue (réseau ou service). Nouvel essai automatique.",
    SEGMENT_RETRY: "Un passage n'a pas pu être transcrit : nouvel essai dans quelques secondes.",
    SEGMENT_LOST: "Une phrase du jury n'a pas pu être transcrite (deux essais ratés) : demandez-lui de la répéter.",
    QUOTA_WAIT: "Quota de la transcription IA atteint : transcription en attente (reprise dans {s} s, aucun passage perdu).",
    OFFLINE: "Hors ligne : les passages du jury seront transcrits au retour du réseau.",
    ONLINE: "Réseau rétabli.",
    AUDIO_ENGINE: "Impossible de démarrer le moteur audio de ce navigateur.",
    AUDIO_SUSPENDED: "Son en veille : cliquez n'importe où dans la page pour réactiver l'écoute.",
    AUDIO_RESUMED: "Écoute réactivée.",
    DEVICE_CHANGE: "Les périphériques audio ont changé.",
    WEBSPEECH_TRACK: "Reconnaissance vocale sur une source autre que le micro : nécessite un Chrome récent.",
    WEBSPEECH_TRACK_OFF: "Reconnaissance vocale : retour au micro par défaut de Chrome.",
    PC_AUDIO_OFF: "« Son du PC » n'est pas lancé : double-cliquez sur « Son du PC Aide Visio » (ou choisissez un autre mode).",
    PC_AUDIO_LOST: "« Son du PC » s'est arrêté : reconnexion…",
    PC_AUDIO_BACK: "« Son du PC » reconnecté.",
    PC_SOUND_BACK: "Le son de l'appel est de nouveau capté.",
    BAD_CONFIG: "Configuration audio invalide.",
    ABORTED: "Démarrage annulé.",
  };

  function audioError(code, cause) {
    const e = new Error(MSG[code] || code);
    e.code = code;
    if (cause) { e.cause = cause; e.detail = (cause && (cause.name || cause.message)) || String(cause); }
    return e;
  }

  function createEmitter() {
    const map = new Map();
    const off = (evt, fn) => { const set = map.get(evt); if (set) set.delete(fn); };
    return {
      on(evt, fn) {
        if (typeof fn !== 'function') return () => {};
        if (!map.has(evt)) map.set(evt, new Set());
        map.get(evt).add(fn);
        return () => off(evt, fn);
      },
      off,
      emit(evt, data) {
        const set = map.get(evt);
        if (!set) return;
        for (const fn of Array.from(set)) {
          try { fn(data); } catch (e) { console.error('[Aide Visio audio] écouteur', evt, e); }
        }
      },
    };
  }
  const events = createEmitter();
  function emit(evt, data) { events.emit(evt, data); }
  function info(who, code, kind) {
    emit('info', { who: who || null, code, kind: kind || 'info', message: MSG[code] || code });
  }

  const STOP = new Set(('le la les l un une des de du d et a au aux en dans sur pour par avec ce cet cette ces qui que qu ' +
    'quoi est sont etre je j tu il elle on nous vous ils elles me m te t se s ne n pas plus mon ma mes ton ta tes son sa ' +
    'ses notre votre nos vos leur leurs y c ca ou mais donc alors').split(' '));
  function normText(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function toks(s) {
    if (S.util && typeof S.util.tokens === 'function') { try { return S.util.tokens(s); } catch (e) {  } }
    return normText(s).split(' ').filter(w => w.length > 1 && !STOP.has(w));
  }
  function simText(a, b) {
    if (S.util && typeof S.util.similarity === 'function') { try { return S.util.similarity(a, b); } catch (e) {  } }
    const A = new Set(toks(a)), B = new Set(toks(b));
    if (!A.size || !B.size) { const na = normText(a); return na && na === normText(b) ? 1 : 0; }
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    return inter / (A.size + B.size - inter);
  }
  function containment(a, b) {
    const ta = toks(a);
    if (ta.length < 3) return 0;
    const tb = new Set(toks(b));
    let hit = 0;
    for (const w of ta) if (tb.has(w)) hit++;
    return hit / ta.length;
  }
  function isEcho(me, them) {
    const na = normText(me.text), nb = normText(them.text);
    if (!na || !nb) return false;
    const dt = me.t - them.t, dur = them.durMs || 0;
    const near = Math.abs(dt) <= 12000 + dur;
    const overlap = dt >= -1500 && dt <= dur + 1500;
    if (!near) return false;
    if (na === nb || (na.length >= 12 && nb.includes(na))) return true;
    if (simText(me.text, them.text) > 0.6) return true;
    return overlap && containment(me.text, them.text) >= 0.75;
  }

  function spanOverlap(from, to, spans, nowT) {
    const end = Math.max(to, from + 300);
    let hit = 0;
    for (const s of spans || []) {
      const a = Math.max(from, s.from), b = Math.min(end, s.to == null ? (nowT == null ? end : nowT) : s.to);
      if (b > a) hit += b - a;
    }
    return Math.min(1, hit / (end - from));
  }

  function levelToUnit(rms) {
    if (!(rms > 0)) return 0;
    const v = (20 * Math.log10(rms) + 60) / 60;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  function normalizePeak(samples, target = 0.89, maxGain = 6) {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > peak) peak = a; }
    if (peak < 1e-4) return samples;
    const gain = Math.min(maxGain, target / peak);
    if (gain > 0.98 && gain < 1.05) return samples;
    const out = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
    return out;
  }

  function encodeWav(samples, sampleRate = TARGET_RATE) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    if (samples instanceof Int16Array) {
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, samples[i], true);
    } else {
      for (let i = 0; i < n; i++) {
        let s = +samples[i];
        if (!(s === s)) s = 0;
        s = s > 1 ? 1 : s < -1 ? -1 : s;
        v.setInt16(44 + i * 2, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
      }
    }
    return new Uint8Array(buf);
  }

  function decodeWav(bytes) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const tag = o => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('WAV invalide');
    let o = 12, fmt = null, data = null;
    while (o + 8 <= u8.length) {
      const id = tag(o), size = v.getUint32(o + 4, true);
      if (id === 'fmt ') fmt = { format: v.getUint16(o + 8, true), channels: v.getUint16(o + 10, true), sampleRate: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true) };
      else if (id === 'data') data = { start: o + 8, size };
      o += 8 + size + (size & 1);
    }
    if (!fmt || !data || fmt.format !== 1 || fmt.bits !== 16) throw new Error('WAV non pris en charge');
    const count = Math.floor(data.size / 2 / fmt.channels);
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = v.getInt16(data.start + i * 2 * fmt.channels, true);
      samples[i] = x < 0 ? x / 32768 : x / 32767;
    }
    return { sampleRate: fmt.sampleRate, channels: fmt.channels, bits: fmt.bits, samples };
  }

  function wavBlob(samples, sampleRate = TARGET_RATE) {
    return new Blob([encodeWav(samples, sampleRate)], { type: 'audio/wav' });
  }

  function biquadLowpass(fs, fc, q) {
    const w0 = 2 * Math.PI * fc / fs, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
    return { b0: (1 - cos) / 2 / a0, b1: (1 - cos) / a0, b2: (1 - cos) / 2 / a0, a1: -2 * cos / a0, a2: (1 - alpha) / a0, z1: 0, z2: 0 };
  }

  class Resampler {
    constructor(inRate, outRate = TARGET_RATE) {
      this.inRate = inRate; this.outRate = outRate; this.step = inRate / outRate;
      this.filters = [];
      if (inRate > outRate * 1.0001) {
        const fc = Math.min(0.42 * outRate, 0.45 * inRate);
        for (const q of [0.51764, 0.70711, 1.93185]) this.filters.push(biquadLowpass(inRate, fc, q));
      }
      this.reset();
    }
    reset() { this.pos = 0; this.prev = 0; for (const f of this.filters) { f.z1 = 0; f.z2 = 0; } }
    process(input) {
      const len = input.length;
      if (!len) return new Float32Array(0);
      if (this.inRate === this.outRate) return Float32Array.from(input);
      const x = Float32Array.from(input);
      for (const f of this.filters) {
        let z1 = f.z1, z2 = f.z2;
        const b0 = f.b0, b1 = f.b1, b2 = f.b2, a1 = f.a1, a2 = f.a2;
        for (let i = 0; i < len; i++) {
          const xi = x[i], y = b0 * xi + z1;
          z1 = b1 * xi - a1 * y + z2;
          z2 = b2 * xi - a2 * y;
          x[i] = y;
        }
        f.z1 = z1; f.z2 = z2;
      }
      const step = this.step;
      let pos = this.pos;
      const max = Math.max(0, Math.ceil((len - 1 - pos) / step) + 1);
      const out = new Float32Array(max);
      let k = 0;
      while (pos < len - 1 && k < max) {
        const i = Math.floor(pos), f = pos - i;
        const a = i < 0 ? this.prev : x[i], b = x[i + 1];
        out[k++] = a + (b - a) * f;
        pos += step;
      }
      this.pos = pos - len;
      this.prev = x[len - 1];
      return k === max ? out : out.slice(0, k);
    }
  }

  class Vad {
    constructor(o = {}) {
      this.rate = o.sampleRate || TARGET_RATE;
      this.frameLen = Math.max(1, Math.round(this.rate * (o.frameMs || 20) / 1000));
      this.frameMs = this.frameLen * 1000 / this.rate;
      const fr = ms => Math.max(1, Math.round(ms / this.frameMs));
      this.startFrames = o.startFrames || 3;
      this.hangFrames = fr(o.hangoverMs != null ? o.hangoverMs : 750);
      this.maxFrames = fr(o.maxSegmentMs != null ? o.maxSegmentMs : 14000);
      this.minSpanFrames = fr(o.minSpeechMs != null ? o.minSpeechMs : 450);
      this.minVoiced = Math.max(this.startFrames, Math.round(this.minSpanFrames * 0.4));
      this.preFrames = Math.round((o.preRollMs != null ? o.preRollMs : 300) / this.frameMs);
      this.tailFrames = Math.round((o.tailMs != null ? o.tailMs : 200) / this.frameMs);
      this.steadyFrames = fr(o.steadyMs || 1500);
      this.steadyDb = o.steadyDb != null ? o.steadyDb : 2;
      this.splitSearch = fr(o.splitSearchMs || 1500);
      this.minStart = o.minStart != null ? o.minStart : 0.006;
      this.minKeep = o.minKeep != null ? o.minKeep : 0.004;
      this.startRatio = o.startRatio || 2.8;
      this.keepRatio = o.keepRatio || 2;
      this.maxZcr = o.maxZcr != null ? o.maxZcr : 0.35;
      this.initialFloor = o.initialFloor != null ? o.initialFloor : 0.002;
      this.collect = o.collect !== false;
      this.onSpeech = o.onSpeech || null;
      this.onSegment = o.onSegment || null;
      this.floor = this.initialFloor;
      this.calibFrames = fr(o.calibrationMs != null ? o.calibrationMs : 300);
      this.calib = this.calibFrames;
      this.minWin = fr(1000);
      this.buf = new Float32Array(this.frameLen);
      this.bufN = 0;
      this.frameIdx = 0;
      this.stats = { starts: 0, segments: 0, discarded: 0, steady: 0, splits: 0 };
      this.ring = []; this.run = 0; this.seg = null;
    }
    get active() { return !!this.seg; }
    get noiseFloor() { return this.floor; }
    get positionMs() { return (this.frameIdx * this.frameLen + this.bufN) * 1000 / this.rate; }

    push(samples) {
      const n = samples.length;
      let i = 0;
      while (i < n) {
        const take = Math.min(this.frameLen - this.bufN, n - i);
        for (let k = 0; k < take; k++) this.buf[this.bufN + k] = samples[i + k];
        this.bufN += take; i += take;
        if (this.bufN === this.frameLen) {
          const f = this.buf;
          this.buf = new Float32Array(this.frameLen);
          this.bufN = 0;
          this._frame(f);
        }
      }
    }
    flush() {
      if (this.seg) {
        const seg = this.seg;
        this.seg = null;
        this._emitFrames(seg.frames, 'flush', false);
        this._speech(false);
      }
      this.ring = []; this.run = 0; this.bufN = 0;
    }
    reset(keepFloor = true) {
      const was = !!this.seg;
      this.seg = null; this.ring = []; this.run = 0; this.bufN = 0;
      if (!keepFloor) { this.floor = this.initialFloor; this.calib = this.calibFrames; }
      if (was) this._speech(false);
    }

    _speech(active) {
      if (this.onSpeech) this.onSpeech(active, { atMs: this.positionMs });
    }
    _updateFloor(r) {
      const x = Math.max(r, 1e-5);
      if (this.calib > 0) {
        this.calibMin = this.calib === this.calibFrames ? x : Math.min(this.calibMin, x);
        this.calib--;
        this.floor = Math.max(0.0003, this.calibMin);
        return;
      }
      else if (x < this.floor) this.floor += (x - this.floor) * 0.2;
      else this.floor += (Math.min(x, this.floor * 4) - this.floor) * 0.005;
      if (this.floor < 0.0003) this.floor = 0.0003;
    }
    _frame(f) {
      const n = f.length;
      let sum = 0, zc = 0, prev = f[0];
      for (let i = 0; i < n; i++) {
        const s = f[i];
        sum += s * s;
        if ((s >= 0) !== (prev >= 0)) zc++;
        prev = s;
      }
      const rms = Math.sqrt(sum / n), zcr = zc / n;
      const startThr = Math.max(this.minStart, this.floor * this.startRatio);
      const keepThr = Math.max(this.minKeep, this.floor * this.keepRatio);
      const frame = { idx: this.frameIdx++, rms, db: 20 * Math.log10(rms + 1e-9), v: rms > keepThr, data: this.collect ? f : null };

      if (!this.seg) {
        this.ring.push(frame);
        if (this.ring.length > this.preFrames + this.startFrames) this.ring.shift();
        if (rms > startThr && zcr < this.maxZcr && this.calib <= 0) this.run++;
        else this.run = 0;
        if (this.run >= this.startFrames) { this._open(); return; }
        if (this.run === 0) this._updateFloor(rms);
        return;
      }
      const seg = this.seg;
      seg.frames.push(frame);
      if (frame.v) seg.silence = 0; else seg.silence++;
      if (seg.silence >= this.hangFrames) { this._close(); return; }
      if (seg.frames.length >= this.minWin && seg.frames.length % 10 === 0) {
        let mn = Infinity;
        for (let k = seg.frames.length - this.minWin; k < seg.frames.length; k++) if (seg.frames[k].rms < mn) mn = seg.frames[k].rms;
        if (mn > this.floor * 1.4) this.floor += (mn - this.floor) * 0.5;
      }
      if (seg.frames.length >= this.steadyFrames && seg.frames.length - seg.checkedAt >= 10) {
        seg.checkedAt = seg.frames.length;
        if (this._steady()) return;
      }
      if (seg.frames.length >= this.maxFrames) this._split();
    }
    _open() {
      const ring = this.ring;
      const firstVoiced = ring.length - this.run;
      const from = Math.max(0, firstVoiced - this.preFrames);
      for (let k = firstVoiced; k < ring.length; k++) ring[k].v = true;
      this.seg = { frames: ring.slice(from), silence: 0, checkedAt: 0 };
      this.ring = []; this.run = 0;
      this.stats.starts++;
      this._speech(true);
    }
    _close() {
      const seg = this.seg;
      this.seg = null;
      this._emitFrames(seg.frames, 'silence', false);
      this._speech(false);
    }
    _split() {
      const fr = this.seg.frames, len = fr.length;
      let cut = len - 1, best = Infinity;
      for (let k = len - 1; k >= Math.max(1, len - this.splitSearch); k--) {
        if (fr[k].rms < best) { best = fr[k].rms; cut = k; }
      }
      const rest = fr.slice(cut + 1);
      let silence = 0;
      for (let k = rest.length - 1; k >= 0 && !rest[k].v; k--) silence++;
      this.stats.splits++;
      this._emitFrames(fr.slice(0, cut + 1), 'max', true);
      this.seg = { frames: rest, silence, checkedAt: 0 };
    }
    _steady() {
      const fr = this.seg.frames, N = this.steadyFrames, w = fr.slice(fr.length - N);
      let m = 0;
      for (const x of w) m += x.db;
      m /= N;
      let va = 0;
      for (const x of w) va += (x.db - m) * (x.db - m);
      if (Math.sqrt(va / N) >= this.steadyDb) return false;
      let mr = 0;
      for (const x of w) mr += x.rms;
      mr /= N;
      this.stats.steady++;
      this.seg = null; this.ring = []; this.run = 0;
      this._emitFrames(fr.slice(0, fr.length - N), 'steady', false);
      this.floor = Math.max(this.floor, mr);
      this._speech(false);
      return true;
    }
    peek() {
      if (!this.seg || !this.collect) return null;
      const fr = this.seg.frames;
      const out = new Float32Array(fr.length * this.frameLen);
      for (let k = 0; k < fr.length; k++) if (fr[k].data) out.set(fr[k].data, k * this.frameLen);
      return { samples: out, durationMs: fr.length * this.frameMs, id: this.stats.starts };
    }
    _emitFrames(frames, reason, forced) {
      let first = -1, last = -1, voiced = 0;
      for (let k = 0; k < frames.length; k++) {
        if (frames[k].v) { if (first < 0) first = k; last = k; voiced++; }
      }
      if (first < 0) { this.stats.discarded++; return; }
      const span = last - first + 1;
      if (!forced && (span < this.minSpanFrames || voiced < this.minVoiced)) { this.stats.discarded++; return; }
      const end = forced ? frames.length : Math.min(frames.length, last + 1 + this.tailFrames);
      const use = frames.slice(0, end);
      this.stats.segments++;
      if (!this.collect || !this.onSegment) return;
      const out = new Float32Array(use.length * this.frameLen);
      for (let k = 0; k < use.length; k++) out.set(use[k].data, k * this.frameLen);
      const startMs = use[0].idx * this.frameMs, endMs = (use[use.length - 1].idx + 1) * this.frameMs;
      this.onSegment(out, { startMs, endMs, durationMs: endMs - startMs, speechMs: span * this.frameMs, voicedMs: voiced * this.frameMs, reason, forced: !!forced });
    }
  }

  function httpStatus(e) { return e && (e.status || e.httpStatus || (e.response && e.response.status)) || 0; }
  function isAuthError(e) {
    const st = httpStatus(e);
    if (st === 401 || st === 403) return true;
    const c = String((e && e.code) || '');
    return /^(NO_KEY|KEY|KEY_ERROR|AUTH|UNAUTHORIZED|FORBIDDEN|PERMISSION_DENIED)$/i.test(c);
  }
  function isQuota(e) {
    return !!e && (e.code === 'QUOTA' || httpStatus(e) === 429);
  }
  function isRetryable(e) {
    if (!e) return true;
    if (isAuthError(e)) return false;
    const st = httpStatus(e);
    if (st === 400 || st === 404 || st === 413 || st === 422) return false;
    return true;
  }

  class TranscriptionQueue {
    constructor(o) {
      this.run = o.transcribe;
      this.concurrency = o.concurrency || 2;
      this.baseConcurrency = this.concurrency;
      this.retries = o.retries != null ? o.retries : 2;
      this.retryDelays = o.retryDelays || [800, 2000];
      this.timeoutMs = o.timeoutMs || 30000;
      this.holTimeoutMs = o.holTimeoutMs != null ? o.holTimeoutMs : 15000;
      this.onResult = o.onResult || (() => {});
      this.onError = o.onError || (() => {});
      this.onChange = o.onChange || null;
      this.waitOnline = o.waitOnline || null;
      this.onQuota = o.onQuota || null;
      this.quotaPauseMs = o.quotaPauseMs || 30000;
      this.pausedUntil = 0; this.pauseTimer = null; this.quotaHits = 0;
      this.seq = 0; this.next = 0;
      this.items = new Map(); this.waiting = [];
      this.active = 0; this.maxActive = 0;
      this.aborted = false; this.ctrls = new Set(); this.drains = []; this.holTimer = null;
    }
    get pending() { return this.items.size; }
    get busy() { return this.items.size > 0; }
    push(payload) {
      if (this.aborted) return -1;
      const it = { seq: this.seq++, payload, state: 'queued', addedAt: now() };
      this.items.set(it.seq, it);
      this.waiting.push(it);
      this._pump();
      this._changed();
      return it.seq;
    }
    drain(timeoutMs = 10000) {
      if (!this.items.size) return Promise.resolve(true);
      return new Promise(resolve => {
        const d = { resolve, timer: setTimeout(() => { this.drains = this.drains.filter(x => x !== d); resolve(false); }, timeoutMs) };
        this.drains.push(d);
      });
    }
    abort() {
      this.aborted = true;
      for (const c of this.ctrls) { try { c.abort(); } catch (e) {  } }
      this.ctrls.clear();
      this.waiting = [];
      this.items.clear();
      clearTimeout(this.holTimer);
      clearTimeout(this.pauseTimer);
      this._changed();
    }
    get quotaWaitMs() { return Math.max(0, this.pausedUntil - now()); }
    _pump() {
      if (this.aborted) return;
      const wait = this.pausedUntil - now();
      if (wait > 0) {
        clearTimeout(this.pauseTimer);
        this.pauseTimer = setTimeout(() => this._pump(), wait + 20);
        return;
      }
      while (!this.aborted && this.active < this.concurrency && this.waiting.length) this._work(this.waiting.shift());
    }
    _quota(it, err) {
      this.quotaHits++;
      this.concurrency = 1;
      const hinted = Number(err && err.retryAfterMs) || 0;
      const ms = Math.min(60000, Math.max(hinted ? Math.max(hinted, 3000) : this.quotaPauseMs, 3000));
      this.pausedUntil = Math.max(this.pausedUntil, now() + ms);
      it.state = 'queued';
      this.waiting.push(it);
      this.waiting.sort((a, b) => a.seq - b.seq);
      if (this.onQuota) { try { this.onQuota(ms, it.payload); } catch (e) {  } }
    }
    async _work(it) {
      this.active++;
      if (this.active > this.maxActive) this.maxActive = this.active;
      it.state = 'running';
      let text = null, err = null, quota = false;
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        if (this.aborted) { err = audioError('ABORTED'); break; }
        if (this.waitOnline) { try { await this.waitOnline(); } catch (e) {  } }
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        if (ctrl) this.ctrls.add(ctrl);
        let timer = null;
        try {
          text = await Promise.race([
            Promise.resolve().then(() => this.run(it.payload, ctrl ? ctrl.signal : undefined)),
            new Promise((_, rej) => { timer = setTimeout(() => { if (ctrl) ctrl.abort(); const e = new Error('Délai dépassé'); e.code = 'TIMEOUT'; rej(e); }, this.timeoutMs); }),
          ]);
          err = null;
          break;
        } catch (e) {
          err = e || new Error('Erreur');
          if (!this.aborted && isQuota(err)) { quota = true; break; }
          if (this.aborted || !isRetryable(err)) break;
        } finally {
          clearTimeout(timer);
          if (ctrl) this.ctrls.delete(ctrl);
        }
        it.attempts = attempt + 1;
        if (attempt < this.retries) await sleep(this.retryDelays[Math.min(attempt, this.retryDelays.length - 1)]);
      }
      this.active--;
      if (this.aborted) return;
      if (quota) { this._quota(it, err); this._pump(); this._changed(); return; }
      if (!err && this.quotaHits && this.pausedUntil < now()) { this.quotaHits = 0; this.concurrency = this.baseConcurrency; }
      it.state = 'done'; it.text = text; it.error = err;
      this._flush();
      this._pump();
      this._changed();
    }
    _deliver(it) {
      it.emitted = true;
      try {
        if (it.error) this.onError(it.payload, it.error);
        else this.onResult(it.payload, typeof it.text === 'string' ? it.text : (it.text && it.text.text) || '');
      } catch (e) { console.error('[Aide Visio audio] file', e); }
    }
    _flush() {
      while (this.items.has(this.next)) {
        const it = this.items.get(this.next);
        if (it.state !== 'done') break;
        if (!it.emitted) this._deliver(it);
        this.items.delete(this.next);
        this.next++;
      }
      clearTimeout(this.holTimer);
      const head = this.items.get(this.next);
      if (!head) return;
      let later = false;
      for (const it of this.items.values()) if (it.state === 'done' && !it.emitted) { later = true; break; }
      if (!later) return;
      const age = now() - head.addedAt;
      if (age >= this.holTimeoutMs) {
        for (const it of Array.from(this.items.values()).sort((a, b) => a.seq - b.seq)) if (it.state === 'done' && !it.emitted) this._deliver(it);
      } else {
        this.holTimer = setTimeout(() => this._flush(), this.holTimeoutMs - age + 5);
      }
    }
    _changed() {
      if (!this.items.size && this.drains.length) {
        const ds = this.drains; this.drains = [];
        for (const d of ds) { clearTimeout(d.timer); d.resolve(true); }
      }
      if (this.onChange) { try { this.onChange(); } catch (e) {  } }
    }
  }

  const WORKLET_SRC = `
class AideVisioTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.chunk = o.chunk || 2048;
    this.buf = new Float32Array(this.chunk);
    this.n = 0;
    this.levelEvery = Math.max(128, Math.round(sampleRate / (o.levelHz || 15)));
    this.lc = 0; this.sum = 0; this.cnt = 0; this.peak = 0;
    this.alive = true;
    this.port.onmessage = (e) => { if (e.data && e.data.type === 'close') this.alive = false; };
  }
  process(inputs) {
    if (!this.alive) return false;
    const input = inputs[0];
    const nc = input ? input.length : 0;
    const len = nc ? input[0].length : 128;
    for (let i = 0; i < len; i++) {
      let s = 0;
      if (nc === 1) s = input[0][i];
      else if (nc > 1) { for (let c = 0; c < nc; c++) s += input[c][i]; s /= nc; }
      this.sum += s * s;
      const a = s < 0 ? -s : s;
      if (a > this.peak) this.peak = a;
      if (nc) {
        this.buf[this.n++] = s;
        if (this.n === this.chunk) {
          this.port.postMessage({ type: 'pcm', data: this.buf }, [this.buf.buffer]);
          this.buf = new Float32Array(this.chunk);
          this.n = 0;
        }
      }
    }
    this.cnt += len; this.lc += len;
    if (this.lc >= this.levelEvery) {
      this.port.postMessage({ type: 'level', rms: Math.sqrt(this.sum / Math.max(1, this.cnt)), peak: this.peak });
      this.lc = 0; this.sum = 0; this.cnt = 0; this.peak = 0;
    }
    return true;
  }
}
registerProcessor('aidevisio-tap', AideVisioTap);
`;

  function withTimeout(p, ms) {
    let t;
    return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); })]).finally(() => clearTimeout(t));
  }

  async function loadTapModule(ctx) {
    if (!ctx.audioWorklet || typeof G.AudioWorkletNode !== 'function') return typeof ctx.createScriptProcessor === 'function' ? 'script' : 'none';
    const urls = [];
    let blobUrl = null;
    try { blobUrl = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' })); urls.push(blobUrl); } catch (e) {  }
    urls.push('data:text/javascript;charset=utf-8,' + encodeURIComponent(WORKLET_SRC));
    try {
      for (const u of urls) {
        try { await withTimeout(ctx.audioWorklet.addModule(u), 5000); return 'worklet'; } catch (e) {  }
      }
    } finally {
      if (blobUrl) setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {  } }, 1000);
    }
    return typeof ctx.createScriptProcessor === 'function' ? 'script' : 'none';
  }

  function createTap(sess, stream, h) {
    const ctx = sess.ctx;
    const src = ctx.createMediaStreamSource(stream);
    let node;
    if (sess.tapMode === 'worklet') {
      node = new G.AudioWorkletNode(ctx, 'aidevisio-tap', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
        processorOptions: { chunk: 2048, levelHz: 15 },
      });
      node.port.onmessage = e => {
        const d = e.data;
        if (!d) return;
        if (d.type === 'pcm') h.pcm(d.data);
        else if (d.type === 'level') h.level(d.rms, d.peak);
      };
      node.onprocessorerror = () => { if (h.error) h.error(); };
    } else {
      node = ctx.createScriptProcessor(1024, 2, 1);
      const every = ctx.sampleRate / 15;
      let acc = 0, sum = 0, cnt = 0, peak = 0;
      node.onaudioprocess = ev => {
        const ib = ev.inputBuffer, n = ib.length, nc = ib.numberOfChannels;
        const mono = new Float32Array(n);
        for (let c = 0; c < nc; c++) { const d = ib.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i]; }
        if (nc > 1) for (let i = 0; i < n; i++) mono[i] /= nc;
        for (let i = 0; i < n; i++) { const s = mono[i]; sum += s * s; const a = s < 0 ? -s : s; if (a > peak) peak = a; }
        cnt += n; acc += n;
        h.pcm(mono);
        if (acc + n / 2 >= every) { h.level(Math.sqrt(sum / Math.max(1, cnt)), peak); acc = 0; sum = 0; cnt = 0; peak = 0; }
      };
    }
    src.connect(node);
    node.connect(sess.sink);
    return {
      close() {
        try { src.disconnect(); } catch (e) {  }
        try { node.disconnect(); } catch (e) {  }
        if (node.port) { try { node.port.postMessage({ type: 'close' }); } catch (e) {  } node.port.onmessage = null; }
        node.onaudioprocess = null;
      },
    };
  }

  function support() {
    const md = nav.mediaDevices;
    const ua = String(nav.userAgent || '');
    const uad = nav.userAgentData;
    const brands = uad && Array.isArray(uad.brands) ? uad.brands.map(b => b.brand).join(' ') : '';
    const mobile = uad && typeof uad.mobile === 'boolean' ? uad.mobile : /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const edge = /Edg\//.test(ua) || /Microsoft Edge/.test(brands);
    const chromium = /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/.test(brands) || /(Chrome|CriOS|Edg)\//.test(ua);
    const firefox = /Firefox\//.test(ua);
    const safari = !chromium && /Safari\//.test(ua) && !firefox;
    const platform = String((uad && uad.platform) || nav.platform || '');
    const windows = /Win/i.test(platform) || /Windows/.test(ua);
    const cros = /CrOS/.test(ua) || /Chrome OS/i.test(platform);
    const gdm = !!(md && typeof md.getDisplayMedia === 'function');
    const AC = G.AudioContext || G.webkitAudioContext;
    return {
      getUserMedia: !!(md && typeof md.getUserMedia === 'function'),
      getDisplayMedia: gdm,
      displayAudio: gdm && chromium && !mobile,
      systemAudio: gdm && chromium && !mobile && (windows || cros),
      webSpeech: !!(G.SpeechRecognition || G.webkitSpeechRecognition),
      audioWorklet: typeof G.AudioWorkletNode === 'function' && !!(AC && AC.prototype && 'audioWorklet' in AC.prototype),
      wakeLock: !!(nav.wakeLock && typeof nav.wakeLock.request === 'function'),
      docPiP: 'documentPictureInPicture' in G,
      secure: G.isSecureContext !== false,
      mobile: !!mobile,
      browser: edge ? 'edge' : chromium ? 'chrome' : firefox ? 'firefox' : safari ? 'safari' : 'other',
    };
  }

  const PRESETS = Object.freeze([
    Object.freeze({ id: 'visio-casque', label: 'Visio sur ce PC (Meet / Teams)', them: 'display', themEngine: 'cloud', me: 'mic', meEngine: 'webspeech', needsKey: true }),
    Object.freeze({ id: 'pc-interne', label: 'Appel ou visio sur ce PC (son interne)', them: 'pc', themEngine: 'local', me: 'mic', meEngine: 'local', needsKey: false }),
    Object.freeze({ id: 'haut-parleur', label: 'Haut-parleur ou téléphone à côté', them: null, me: 'mic', meEngine: 'webspeech', mixed: true, needsKey: false }),
    Object.freeze({ id: 'visio-hp', label: 'Visio sur ce PC, son sur haut-parleurs', them: null, me: 'mic', meEngine: 'webspeech', mixed: true, needsKey: false, meTrack: true }),
    Object.freeze({ id: 'micro-cloud', label: 'Micro seul, transcription IA (bruit, accents)', them: null, me: 'mic', meEngine: 'cloud', mixed: true, needsKey: true }),
  ]);

  function normSource(v) {
    if (v == null || v === false || v === '') return null;
    if (typeof v === 'object' && typeof v.getAudioTracks === 'function') return v;
    const k = String(v).toLowerCase();
    if (['display', 'tab', 'screen', 'system', 'onglet'].includes(k)) return 'display';
    if (['mic', 'micro', 'microphone'].includes(k)) return 'mic';
    if (['pc', 'son-pc', 'local', 'wasapi'].includes(k)) return 'pc';
    throw audioError('BAD_CONFIG');
  }
  function normEngine(v, dflt) {
    if (!v) return dflt;
    const k = String(v).toLowerCase();
    if (k === 'cloud' || k === 'ai' || k === 'gemini') return 'cloud';
    if (k === 'webspeech' || k === 'speech' || k === 'chrome') return 'webspeech';
    if (k === 'local' || k === 'python' || k === 'son-pc' || k === 'whisper') return 'local';
    throw audioError('BAD_CONFIG');
  }
  function resolveConfig(x) {
    let p = x;
    if (typeof x === 'string') {
      p = PRESETS.find(q => q.id === x);
      if (!p) throw audioError('BAD_CONFIG');
    }
    if (!p || typeof p !== 'object') throw audioError('BAD_CONFIG');
    const cfg = {
      id: p.id || 'custom',
      label: p.label || 'Configuration personnalisée',
      them: normSource(p.them),
      themEngine: normEngine(p.themEngine, 'cloud'),
      me: normSource(p.me),
      meEngine: normEngine(p.meEngine, 'webspeech'),
      mixed: !!p.mixed,
      meTrack: !!p.meTrack,
    };
    if (!cfg.them && !cfg.me) throw audioError('BAD_CONFIG');
    cfg.local = (cfg.them && cfg.themEngine === 'local') || (cfg.me && cfg.meEngine === 'local');
    if (cfg.local) { if (cfg.them) cfg.themEngine = 'local'; if (cfg.me) cfg.meEngine = 'local'; cfg.mixed = false; }
    cfg.needsKey = !!((cfg.them && cfg.themEngine === 'cloud') || (cfg.me && cfg.meEngine === 'cloud'));
    return cfg;
  }

  function getSettings() {
    try { return (S.store && typeof S.store.settings === 'function' && S.store.settings()) || {}; } catch (e) { return {}; }
  }

  function mapMicError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'MIC_DENIED';
    if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'MIC_NOT_FOUND';
    return 'MIC_BUSY';
  }
  function micConstraints(o = {}) {
    const a = {
      echoCancellation: o.echoCancellation !== false,
      noiseSuppression: o.noiseSuppression !== false,
      autoGainControl: o.autoGainControl !== false,
      channelCount: { ideal: 1 },
    };
    if (o.deviceId) a.deviceId = { ideal: o.deviceId };
    return a;
  }
  function mediaUnavailableCode() {
    return G.isSecureContext === false ? 'INSECURE' : 'NO_MEDIA';
  }
  async function getMic(o) {
    const md = nav.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') throw audioError(mediaUnavailableCode());
    try {
      return await md.getUserMedia({ audio: micConstraints(o), video: false });
    } catch (e) {
      if (e && e.name === 'OverconstrainedError' && o && o.deviceId) return getMic(Object.assign({}, o, { deviceId: null }));
      throw audioError(mapMicError(e), e);
    }
  }
  function displayConstraints(full) {
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (!full) return { video: true, audio };
    return {
      video: true,
      audio: Object.assign({ suppressLocalAudioPlayback: false }, audio),
      systemAudio: 'include',
      windowAudio: 'system',
      selfBrowserSurface: 'exclude',
      preferCurrentTab: false,
      surfaceSwitching: 'include',
    };
  }
  async function getDisplay(o = {}) {
    const md = nav.mediaDevices;
    if (!md || typeof md.getDisplayMedia !== 'function') throw audioError(G.isSecureContext === false ? 'INSECURE' : 'DISPLAY_UNSUPPORTED');
    const opts = displayConstraints(true);
    if (o.controller) opts.controller = o.controller;
    let stream;
    try {
      stream = await md.getDisplayMedia(opts);
    } catch (e) {
      const n = e && e.name;
      if (n === 'TypeError') {
        try { stream = await md.getDisplayMedia(displayConstraints(false)); } catch (e2) { throw audioError(mapDisplayError(e2), e2); }
      } else throw audioError(mapDisplayError(e), e);
    }
    if (!stream.getAudioTracks().length) {
      stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {  } });
      throw audioError('NO_DISPLAY_AUDIO');
    }
    return stream;
  }
  function mapDisplayError(e) {
    const n = e && e.name;
    if (n === 'NotAllowedError' || n === 'AbortError') return 'DISPLAY_CANCELLED';
    if (n === 'InvalidStateError') return 'DISPLAY_NEEDS_GESTURE';
    return 'DISPLAY_UNSUPPORTED';
  }
  const LOCAL_URL = 'ws://127.0.0.1:47800/transcription';
  class LocalLink {
    constructor(s, url) {
      this.s = s; this.url = url || LOCAL_URL;
      this.ws = null; this.closed = false; this.lost = false; this.retry = null;
      this.ready = false; this.model = ''; this.devices = {};
      this.drainWait = null;
    }
    open(timeoutMs = 4000) {
      return new Promise((resolve, reject) => {
        let settled = false, loading = false, loadTimer = null;
        this.opening = true;
        const done = (err) => {
          if (settled) return;
          settled = true; this.opening = false; clearTimeout(timer); clearTimeout(loadTimer);
          if (err) { this.closed = true; try { if (this.ws) this.ws.close(); } catch (e) {  } reject(err); } else resolve();
        };
        const timer = setTimeout(() => done(audioError('PC_AUDIO_OFF', new Error(loading ? 'modèle trop long à charger' : 'aucune réponse'))), timeoutMs);
        this.connect((m) => {
          if (m.type === 'info' && m.code === 'MODEL_LOADING' && !loading) { loading = true; clearTimeout(timer); loadTimer = setTimeout(() => done(audioError('PC_AUDIO_OFF', new Error('modèle trop long à charger'))), 60000); }
          if (m.type === 'info' && m.code === 'MODEL_FAILED') { const e = audioError('PC_AUDIO_OFF', new Error(String(m.message || 'modèle de transcription impossible à charger'))); if (m.message) e.message = String(m.message); done(e); }
          if (m.type === 'ready') done(null);
        }, () => done(audioError('PC_AUDIO_OFF', new Error('connexion refusée'))));
      });
    }
    connect(onFirst, onFail) {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { if (onFail) onFail(e); else this.schedule(); return; }
      this.ws = ws;
      let opened = false;
      ws.onopen = () => {
        opened = true;
        const st = getSettings();
        this.send({ type: 'start', lang: this.s.lang, hint: this.s.hint || '', keys: { groq: st.groqKey || '', openai: st.openaiKey || '' } });
      };
      ws.onmessage = (e) => {
        let m = null;
        try { m = JSON.parse(e.data); } catch (x) { return; }
        if (!m || !m.type) return;
        if (onFirst) onFirst(m);
        this.onMessage(m);
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        if (this.closed) return;
        // Tant que open() attend 'ready', toute fermeture est un échec du démarrage.
        if (onFail && (!opened || this.opening)) { onFail(new Error('fermé')); return; }
        if (!this.lost) { this.lost = true; this.ready = false; info('them', 'PC_AUDIO_LOST', 'warn'); }
        this.schedule();
      };
    }
    schedule() {
      if (this.closed) return;
      clearTimeout(this.retry);
      this.retry = setTimeout(() => this.connect(null, null), 2000);
    }
    send(m) { try { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); } catch (e) {  } }
    onMessage(m) {
      const s = this.s;
      const ch = m.who ? s.channel(m.who === 'them' ? 'them' : 'me') : null;
      switch (m.type) {
        case 'ready':
          this.ready = true; this.model = m.model || ''; this.devices = m.devices || {};
          for (const c of s.channels) {
            const dev = this.devices[c.role === 'them' ? 'them' : 'me'];
            if (dev) c.label = dev;
            if (!c.ended) c.setState(s.paused ? 'paused' : 'listening');
          }
          if (s.paused) this.send({ type: 'pause' });
          if (this.lost) { this.lost = false; info('them', 'PC_AUDIO_BACK', 'info'); }
          break;
        case 'level':
          if (ch && !ch.ended) { const r = +m.rms || 0; ch.onLevel(r, r); }
          break;
        case 'speech':
          if (ch && !ch.ended && !s.paused) ch.onSpeech(!!m.active);
          break;
        case 'interim':
          if (ch && !ch.ended && !s.paused && m.text) { ch.interimShown = true; emit('interim', { who: ch.who, text: String(m.text) }); }
          break;
        case 'config':
          this.stt = m.stt || '';
          if (m.devices) for (const c of s.channels) { const dev = m.devices[c.role]; if (dev) c.label = dev; }
          break;
        case 'final': {
          if (!ch || !m.text) break;
          if (ch.interimShown) { ch.interimShown = false; emit('interim', { who: ch.who, text: '' }); }
          const t0 = +m.t0 || now(), t1 = +m.t1 || t0;
          s.final(ch, String(m.text), t0 - s.t0, { source: 'local', durMs: Math.max(0, t1 - t0), latencyMs: +m.ms || 0 });
          break;
        }
        case 'idle':
          for (const c of s.channels) if (c.interimShown && !c.speaking) { c.interimShown = false; emit('interim', { who: c.who, text: '' }); }
          break;
        case 'drained':
          if (this.drainWait) { const f = this.drainWait; this.drainWait = null; f(); }
          break;
        case 'info':
          emit('info', { who: m.who || null, code: m.code || 'LOCAL', kind: 'warn', message: String(m.message || m.code || '') });
          break;
        default:
          break;
      }
    }
    async drain(drainMs) {
      if (!this.ws || this.ws.readyState !== 1 || !(drainMs > 0)) return;
      await withTimeout(new Promise((resolve) => { this.drainWait = resolve; this.send({ type: 'stop' }); }), drainMs).catch(() => {});
    }
    close() {
      this.closed = true;
      clearTimeout(this.retry);
      try { if (this.ws) this.ws.close(); } catch (e) {  }
      this.ws = null;
    }
  }
  class LocalEngine {
    constructor(ch, link) { this.ch = ch; this.link = link; }
    start() { this.ch.lastSoundAt = now(); if (this.link.ready) this.ch.setState(this.ch.s.paused ? 'paused' : 'listening'); }
    pause() { this.link.send({ type: 'pause' }); this.ch.setState('paused'); }
    resume() { this.link.send({ type: 'resume' }); this.ch.setState(this.link.ready ? 'listening' : 'restarting'); }
    stop() {  }
    idleInterim() {  }
  }

  function stopStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {  } });
  }

  class WebSpeechEngine {
    constructor(ch, o = {}) {
      this.ch = ch;
      this.track = o.track || null;
      this.trackOptional = !!o.trackOptional;
      this.anyResult = false; this.speechAtSpawn = 0;
      this.rec = null;
      this.want = false; this.paused = false; this.fatal = false;
      this.backoff = 250; this.restartAt = 0; this.restartTimer = null;
      this.lastEvt = 0; this.spawnAt = 0; this.started = false;
      this.interim = ''; this.utterStart = 0; this.doneIdx = 0;
      this.lastFinal = ''; this.lastFinalAt = 0;
      this.netErrors = 0; this.local = false; this.autoLocal = false;
      this.lastError = ''; this.waitVisible = false; this.restarts = 0;
    }
    start() { this.want = true; this.paused = false; this.fatal = false; this.spawn(); }
    spawn() {
      clearTimeout(this.restartTimer);
      this.restartTimer = null; this.restartAt = 0;
      const s = this.ch.s;
      if (!this.want || this.paused || this.fatal || s.stopped || this.rec) return;
      const SR = G.SpeechRecognition || G.webkitSpeechRecognition;
      if (!SR) { this.fail('NO_WEBSPEECH'); return; }
      let rec;
      try { rec = new SR(); } catch (e) { this.fail('NO_WEBSPEECH'); return; }
      rec.lang = s.lang;
      rec.continuous = true;
      rec.interimResults = true;
      try { rec.maxAlternatives = 1; } catch (e) {  }
      if (this.local) { try { rec.processLocally = true; } catch (e) {  } }
      this.rec = rec; this.started = false; this.doneIdx = 0; this.lastError = '';
      this.spawnAt = now(); this.lastEvt = now(); this.restarts++;
      this.speechAtSpawn = this.ch.speechMs();
      rec.onstart = () => { if (this.rec !== rec) return; this.started = true; this.lastEvt = now(); if (!this.paused) this.ch.setState('listening'); };
      rec.onaudiostart = () => { if (this.rec !== rec) return; this.started = true; this.lastEvt = now(); if (!this.paused) this.ch.setState('listening'); };
      rec.onresult = e => { if (this.rec !== rec) return; this.lastEvt = now(); this.netErrors = 0; this.anyResult = true; this.onResult(e); };
      rec.onerror = e => { if (this.rec !== rec) return; this.onError(e && e.error); };
      rec.onend = () => { if (this.rec !== rec) return; this.rec = null; this.promote(); this.afterEnd(); };
      try {
        if (this.track) rec.start(this.track); else rec.start();
      } catch (e) {
        this.rec = null;
        this.lastError = 'start-failed';
        if (this.track && e && e.name === 'TypeError') {
          if (this.trackOptional) { this.dropTrack(); this.schedule(50); return; }
          this.fail('WEBSPEECH_TRACK');
          return;
        }
        this.afterEnd();
      }
    }
    onResult(e) {
      const res = e.results;
      if (!res) return;
      let interim = '';
      const from = e.resultIndex || 0;
      if (from < this.doneIdx) this.doneIdx = from;
      for (let i = from; i < res.length; i++) {
        const r = res[i];
        const txt = (r && r[0] && r[0].transcript) || '';
        if (r.isFinal) {
          if (i >= this.doneIdx) { this.doneIdx = i + 1; this.emitFinal(txt); }
        } else if (i >= this.doneIdx) interim += txt;
      }
      interim = interim.replace(/\s+/g, ' ').trim();
      if (interim && !this.utterStart) this.utterStart = now();
      if (interim !== this.interim) {
        this.interim = interim;
        emit('interim', { who: this.ch.who, text: interim });
      }
    }
    emitFinal(raw) {
      let text = String(raw || '').replace(/\s+/g, ' ').trim();
      const t = now();
      if (text && this.ch.s.mobile && this.lastFinal && t - this.lastFinalAt < 4000) {
        const a = normText(this.lastFinal), b = normText(text);
        if (a === b || a.endsWith(b)) text = '';
        else if (b.startsWith(a) && text.toLowerCase().startsWith(this.lastFinal.toLowerCase())) text = text.slice(this.lastFinal.length).trim();
      }
      const start = this.utterStart || t;
      this.utterStart = 0;
      if (this.interim) { this.interim = ''; emit('interim', { who: this.ch.who, text: '' }); }
      if (!text) return;
      this.lastFinal = String(raw).trim(); this.lastFinalAt = t;
      this.ch.s.final(this.ch, text, start - this.ch.s.t0, { source: 'webspeech' });
    }
    promote() {
      if (this.interim) { const txt = this.interim; this.emitFinal(txt); }
    }
    dropTrack() {
      if (!this.track) return;
      this.track = null;
      info(this.ch.who, 'WEBSPEECH_TRACK_OFF', 'info');
    }
    onError(code) {
      this.lastError = code || 'unknown';
      const who = this.ch.who;
      if (this.track && this.trackOptional && !this.anyResult && code && code !== 'no-speech' && code !== 'aborted' && code !== 'network') this.dropTrack();
      switch (code) {
        case 'no-speech':
        case 'aborted':
          break;
        case 'network':
          this.netErrors++;
          if (this.netErrors === 1) info(who, 'NETWORK', 'warn');
          if (this.netErrors >= 3) this.tryLocal();
          break;
        case 'audio-capture':
          info(who, 'AUDIO_CAPTURE', 'warn');
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          if (hasDoc && document.visibilityState === 'hidden' && this.started) { this.waitVisible = true; break; }
          this.fail(code === 'not-allowed' ? 'NOT_ALLOWED' : 'SERVICE_NOT_ALLOWED');
          break;
        case 'language-not-supported':
          this.fail('LANGUAGE');
          break;
        default:
          break;
      }
    }
    afterEnd() {
      if (this.fatal || !this.want || this.ch.s.stopped) return;
      if (this.paused) { this.ch.setState('paused'); return; }
      if (this.waitVisible) { this.ch.setState('restarting'); return; }
      const lived = now() - this.spawnAt, err = this.lastError;
      let delay;
      if (!err || err === 'no-speech' || err === 'aborted') {
        delay = lived < 1000 ? this.bump() : (this.backoff = 250);
      } else {
        delay = lived > 5000 && err !== 'network' && err !== 'audio-capture' ? (this.backoff = 250) : this.bump();
        const code = err === 'network' ? 'NETWORK' : err === 'audio-capture' ? 'AUDIO_CAPTURE' : undefined;
        this.ch.setState('restarting', { code });
      }
      this.schedule(delay);
    }
    bump() { const d = this.backoff; this.backoff = Math.min(4000, this.backoff * 2); return d; }
    schedule(delay) {
      clearTimeout(this.restartTimer);
      this.restartAt = now() + delay;
      this.restartTimer = setTimeout(() => this.spawn(), delay);
    }
    restartNow(code) {
      if (!this.want || this.fatal) return;
      this.promote();
      const rec = this.rec;
      this.rec = null;
      if (rec) { try { rec.abort(); } catch (e) {  } }
      this.backoff = 250;
      if (this.paused) return;
      if (code) this.ch.setState('restarting', { code });
      this.schedule(250);
    }
    async tryLocal() {
      if (this.local) return;
      const SR = G.SpeechRecognition || G.webkitSpeechRecognition;
      const lang = this.ch.s.lang;
      try {
        let ok = false;
        if (SR && typeof SR.available === 'function') ok = (await SR.available({ langs: [lang], processLocally: true })) === 'available';
        else if (SR && typeof SR.availableOnDevice === 'function') { const r = await SR.availableOnDevice(lang); ok = r === 'available' || r === true; }
        if (ok && !this.local) { this.local = true; this.autoLocal = true; info(this.ch.who, 'LOCAL_SPEECH', 'info'); }
      } catch (e) {  }
    }
    onOnline() {
      if (this.autoLocal) { this.autoLocal = false; this.local = false; this.restartNow(); return; }
      this.netErrors = 0;
      if (this.restartAt) { this.backoff = 250; this.spawn(); }
    }
    onVisible() {
      if (this.waitVisible) { this.waitVisible = false; this.backoff = 250; this.schedule(100); return; }
      this.tick();
    }
    tick() {
      if (!this.want || this.paused || this.fatal || this.ch.s.stopped) return;
      const t = now();
      if (this.restartAt) { if (t >= this.restartAt + 100) this.spawn(); return; }
      if (this.rec) {
        if (this.track && this.trackOptional && !this.anyResult && this.ch.speechMs() - this.speechAtSpawn > 4000) {
          this.dropTrack(); this.restartNow(); return;
        }
        if (this.ch.state === 'listening' && t - this.lastEvt > 20000) { info(this.ch.who, 'WATCHDOG', 'info'); this.restartNow(); return; }
        if (!this.started && t - this.spawnAt > 8000) this.restartNow();
      } else if (!this.waitVisible) this.spawn();
    }
    pause() {
      if (this.fatal) return;
      this.paused = true;
      clearTimeout(this.restartTimer); this.restartTimer = null; this.restartAt = 0;
      const rec = this.rec;
      if (rec) { try { rec.stop(); } catch (e) {  } }
      this.ch.setState('paused');
    }
    resume() {
      if (this.fatal) return;
      this.paused = false; this.backoff = 250;
      if (!this.rec) { this.ch.setState('starting'); this.spawn(); }
      else this.ch.setState('listening');
    }
    stop() {
      this.want = false;
      clearTimeout(this.restartTimer); this.restartTimer = null; this.restartAt = 0;
      const rec = this.rec;
      if (!rec) { this.promote(); return; }
      try { rec.stop(); } catch (e) {  }
      setTimeout(() => {
        if (this.rec === rec) { this.rec = null; try { rec.abort(); } catch (e) {  } this.promote(); }
      }, 1500);
    }
    fail(code) {
      this.fatal = true; this.want = false;
      clearTimeout(this.restartTimer); this.restartTimer = null; this.restartAt = 0;
      const rec = this.rec;
      this.rec = null;
      if (rec) { try { rec.abort(); } catch (e) {  } }
      this.ch.setState('error', { code });
    }
  }

  class CloudEngine {
    constructor(ch) {
      this.ch = ch;
      this.fails = 0; this.keyBroken = false; this.parked = [];
      this.queue = new TranscriptionQueue({
        concurrency: 2, retries: 2, retryDelays: [800, 2000], timeoutMs: 30000, holTimeoutMs: 15000,
        transcribe: (p, signal) => this.transcribe(p, signal),
        onResult: (p, text) => this.onText(p, text),
        onError: (p, e) => this.onFail(p, e),
        onChange: () => { this.ch.s.checkHeld(); this.idleInterim(); },
        waitOnline: () => this.ch.s.waitOnline(),
        onQuota: (ms) => this.onQuota(ms),
      });
      this.quotaWarnedAt = 0;
    }
    onQuota(ms) {
      if (now() - this.quotaWarnedAt > 45000) {
        this.quotaWarnedAt = now();
        emit('info', { who: this.ch.who, code: 'QUOTA_WAIT', kind: 'warning', message: MSG.QUOTA_WAIT.replace('{s}', String(Math.ceil(ms / 1000))) });
      }
      this.ch.setState('restarting', { code: 'QUOTA_WAIT' });
    }
    start() {
      this.ch.setState(this.ch.s.ctxRunning() ? 'listening' : 'starting');
      clearInterval(this.peekTimer);
      this.peekTimer = setInterval(() => this.peekTick(), 1400);
    }
    async peekTick() {
      const ch = this.ch, s = ch.s;
      if (this.peeking || s.stopped || s.paused || !ch.vad || !S.ai || !S.ai.canPeek || !S.ai.canPeek()) return;
      const pk = ch.vad.peek();
      if (!pk || pk.durationMs < 1600 || pk.durationMs > 20000) return;
      if (this.peekDone && this.peekDone.id === pk.id && (this.peekDone.n >= 2 || pk.durationMs - this.peekDone.ms < 3000)) return;
      this.peeking = true;
      try {
        const r = await S.ai.transcribe(wavBlob(normalizePeak(pk.samples), TARGET_RATE), { hint: s.hint || '', lang: s.lang, peek: true, timeoutMs: 5000 });
        const text = String((r && r.text) || '').replace(/\s+/g, ' ').trim();
        this.peekDone = { id: pk.id, ms: pk.durationMs, n: (this.peekDone && this.peekDone.id === pk.id ? this.peekDone.n : 0) + 1 };
        const still = ch.vad.peek();
        if (text && still && still.id === pk.id && !s.stopped) { ch.interimShown = true; emit('interim', { who: ch.who, text, peek: true }); }
      } catch (e) {  } finally { this.peeking = false; }
    }
    segment(samples, segInfo) {
      const ch = this.ch, s = ch.s;
      const lagMs = ch.vad ? ch.vad.positionMs - segInfo.startMs : 0;
      const p = {
        t: Math.max(0, Math.round(now() - s.t0 - lagMs)),
        durMs: Math.round(segInfo.durationMs),
        blob: wavBlob(normalizePeak(samples), TARGET_RATE),
      };
      if (this.keyBroken) { this.park(p); return; }
      this.queue.push(p);
    }
    park(p) { this.parked.push(p); if (this.parked.length > 40) this.parked.shift(); }
    async transcribe(p, signal) {
      if (!S.ai || typeof S.ai.transcribe !== 'function') throw audioError('NO_KEY');
      const hint = this.ch.s.hint || '';
      const r = await S.ai.transcribe(p.blob, { prompt: hint, hint, lang: this.ch.s.lang, signal });
      return typeof r === 'string' ? r : (r && r.text) || '';
    }
    onText(p, text) {
      this.fails = 0;
      if (!this.ch.recovering && this.ch.stream && (this.ch.state === 'error' || (this.ch.state === 'restarting' && !this.queue.quotaWaitMs))) this.ch.setState(this.ch.s.paused ? 'paused' : 'listening');
      const clean = String(text || '').replace(/\s+/g, ' ').trim();
      if (clean) this.ch.s.final(this.ch, clean, p.t, { source: 'cloud', durMs: p.durMs });
      this.idleInterim();
    }
    onFail(p, e) {
      const s = this.ch.s;
      if (e && e.code === 'ABORTED') return;
      if (isAuthError(e)) {
        this.park(p);
        if (!this.keyBroken) { this.keyBroken = true; this.keyCode = e.code === 'NO_KEY' ? 'NO_KEY' : 'KEY_ERROR'; this.ch.setState('error', { code: this.keyCode }); }
        return;
      }
      this.fails++;
      if (!p.lateRetry && !s.stopped) {
        p.lateRetry = true;
        info(this.ch.who, 'SEGMENT_RETRY', 'info');
        setTimeout(() => { if (!this.queue.aborted) this.queue.push(p); }, 8000);
      } else info(this.ch.who, 'SEGMENT_LOST', 'warn');
      if (this.fails >= 3 && this.ch.state !== 'error') this.ch.setState('error', { code: 'TRANSCRIBE_FAILED' });
      this.idleInterim();
    }
    unpark() {
      if (!this.keyBroken) return;
      this.keyBroken = false;
      const ps = this.parked;
      this.parked = [];
      ps.sort((a, b) => a.t - b.t).forEach(p => this.queue.push(p));
      this.ch.setState(this.ch.s.paused ? 'paused' : 'listening');
    }
    idleInterim() {
      if (!this.queue.busy && !this.ch.speaking && this.ch.interimShown) {
        this.ch.interimShown = false;
        emit('interim', { who: this.ch.who, text: '' });
      }
    }
    tick() {  }
    pause() { if (this.ch.vad) this.ch.vad.flush(); this.ch.setState('paused'); }
    resume() {
      if (this.ch.vad) this.ch.vad.reset(true);
      // Ne pas masquer une erreur de clé ou une perte de micro encore en cours.
      if (this.keyBroken) { this.ch.setState('error', { code: this.keyCode || 'KEY_ERROR' }); return; }
      if (this.ch.recovering) { this.ch.setState('restarting', { code: 'MIC_LOST' }); return; }
      if (!this.ch.stream) { this.ch.setState('error', { code: 'MIC_NOT_FOUND' }); return; }
      this.ch.setState(this.ch.s.ctxRunning() ? 'listening' : 'starting');
    }
    stop() { clearInterval(this.peekTimer); if (this.ch.vad) this.ch.vad.flush(); }
  }

  class Channel {
    constructor(s, role, who, source, engineKind) {
      this.s = s; this.role = role; this.who = who; this.source = source; this.engineKind = engineKind;
      this.state = null; this.code = null; this.error = null;
      this.stream = null; this.tap = null; this.resampler = null; this.vad = null; this.engine = null;
      this.level = 0; this.label = ''; this.surface = '';
      this.ended = false; this.speaking = false; this.lastSpeechEnd = 0; this.interimShown = false;
      this.lastSoundAt = 0; this.silentWarned = false; this.recovering = false; this.micOpts = null;
      this.speechDone = 0; this.speechFrom = 0;
      this.trackOff = [];
    }
    setState(state, extra = {}) {
      const code = extra.code || null;
      if (this.state === state && this.code === code) return;
      this.state = state; this.code = code; this.error = code ? (MSG[code] || code) : null;
      const ev = { who: this.who, state };
      if (code) { ev.code = code; ev.error = this.error; }
      emit('state', ev);
    }
    attachStream(stream) {
      this.detachStream(false);
      this.stream = stream;
      const tracks = stream.getAudioTracks();
      const at = tracks[0];
      this.label = (at && at.label) || this.label;
      const vt = stream.getVideoTracks()[0];
      if (vt) {
        try { this.surface = (vt.getSettings && vt.getSettings().displaySurface) || ''; } catch (e) {  }
        try { const p = vt.applyConstraints({ frameRate: { max: 1 } }); if (p && p.catch) p.catch(() => {}); } catch (e) {  }
      }
      for (const t of stream.getTracks()) {
        const onEnded = () => this.onTrackEnded(t);
        const onMute = () => { if (t.kind === 'audio' && !this.s.stopped) info(this.who, this.source === 'mic' ? 'MIC_MUTED' : 'DISPLAY_MUTED', 'warn'); };
        t.addEventListener('ended', onEnded);
        t.addEventListener('mute', onMute);
        this.trackOff.push(() => { t.removeEventListener('ended', onEnded); t.removeEventListener('mute', onMute); });
      }
      this.lastSoundAt = now();
      const s = this.s;
      if (s.ctx && s.tapMode !== 'none' && at) {
        if (!this.resampler) this.resampler = new Resampler(s.ctx.sampleRate, TARGET_RATE);
        if (!this.vad) {
          this.vad = new Vad({
            collect: this.engineKind === 'cloud',
            // Fin de phrase après 600 ms de silence (avant : 750 ms côté candidat), pour transcrire plus vite.
            hangoverMs: 600,
            onSpeech: active => this.onSpeech(active),
            onSegment: (samples, segInfo) => { if (this.engine && this.engine.segment) this.engine.segment(samples, segInfo); },
          });
        }
        try {
          this.tap = createTap(s, stream, { pcm: f => this.onPcm(f), level: (r, p) => this.onLevel(r, p), error: () => info(this.who, 'AUDIO_ENGINE', 'warn') });
        } catch (e) {
          this.tap = null;
          if (this.engineKind === 'cloud') throw audioError('AUDIO_ENGINE', e);
        }
      }
    }
    detachStream(stopTracks = true) {
      this.trackOff.forEach(f => f());
      this.trackOff = [];
      if (this.tap) { this.tap.close(); this.tap = null; }
      if (stopTracks && this.stream && this.stream !== this.s.cfg.them && this.stream !== this.s.cfg.me) stopStream(this.stream);
      this.stream = null;
    }
    onPcm(f) {
      if (this.s.paused || this.ended || this.s.stopped) return;
      this.vad.push(this.resampler.process(f));
    }
    onLevel(rms, peak) {
      const v = levelToUnit(rms);
      this.level = v > this.level ? v : this.level * 0.7 + v * 0.3;
      if (peak > 0.002) {
        this.lastSoundAt = now();
        this.everSound = true;
        if (this.silentWarned && this.engineKind === 'local') { this.silentWarned = false; info(this.who, 'PC_SOUND_BACK', 'info'); }
      }
      emit('level', { who: this.who, rms: this.level, raw: rms, peak });
      this.s.tick();
    }
    speechMs() { return this.speechDone + (this.speaking ? now() - this.speechFrom : 0); }
    onSpeech(active) {
      if (active && !this.speaking) this.speechFrom = now();
      if (!active && this.speaking) this.speechDone += now() - this.speechFrom;
      this.speaking = active;
      if (!active) this.lastSpeechEnd = now();
      if (this.role === 'them') this.s.noteThemSpeech(active);
      emit('speech', { who: this.who, active });
      if (this.engineKind === 'cloud' || (this.engineKind === 'local' && this.role === 'them')) {
        if (active && !this.interimShown) { this.interimShown = true; emit('interim', { who: this.who, text: '…' }); }
        else if (!active && this.engine) this.engine.idleInterim();
        // Bruit sans phrase (toux, bip) : ni texte ni fin ne suivent. Le « … » est retiré, vos phrases ne sont plus retenues.
        if (!active && this.engineKind === 'local') {
          clearTimeout(this.idleT);
          this.idleT = setTimeout(() => {
            if (this.speaking || !this.interimShown || this.ended || this.s.stopped) return;
            this.interimShown = false; emit('interim', { who: this.who, text: '' }); this.s.checkHeld();
          }, 4000);
        }
      }
      this.s.checkHeld();
    }
    onTrackEnded(track) {
      if (this.ended || this.s.stopped) return;
      if (this.source === 'mic') { this.recoverMic(); return; }
      this.ended = true;
      if (this.vad) this.vad.flush();
      if (this.engine) this.engine.stop();
      this.detachStream(true);
      this.level = 0;
      emit('level', { who: this.who, rms: 0, raw: 0, peak: 0 });
      this.setState('stopped');
      emit('ended', { who: this.who, reason: this.source === 'display' ? 'display-ended' : 'track-ended', kind: track && track.kind });
      if (this.source === 'display') info(this.who, 'DISPLAY_ENDED', 'warn');
    }
    async recoverMic() {
      if (this.recovering || this.ended || this.s.stopped) return;
      this.recovering = true;
      info(this.who, 'MIC_LOST', 'warn');
      if (this.engineKind === 'cloud') { if (this.vad) this.vad.flush(); this.setState('restarting', { code: 'MIC_LOST' }); }
      this.detachStream(true);
      for (let i = 0; i < 20 && !this.s.stopped && !this.ended; i++) {
        await sleep(i === 0 ? 300 : 1500);
        if (this.s.stopped) break;
        let st = null;
        try {
          st = await getMic(Object.assign({}, this.micOpts, { deviceId: null }));
          if (this.s.stopped) { stopStream(st); break; }
          this.attachStream(st);
          if (this.vad) this.vad.reset(false);
          if (this.engine && this.engine.track && this.engine.trackOptional) this.engine.track = st.getAudioTracks()[0] || null;
          info(this.who, 'MIC_BACK', 'info');
          if (this.engineKind === 'cloud') this.setState(this.s.paused ? 'paused' : 'listening');
          else if (this.engine) this.engine.restartNow();
          this.recovering = false;
          return;
        } catch (e) {
          // attachStream a pu échouer après avoir pris le flux : le fermer avant l'essai suivant.
          if (this.stream === st && st) this.detachStream(true); else if (st) stopStream(st);
          if (e && e.code === 'MIC_DENIED') break;
        }
      }
      this.recovering = false;
      if (!this.s.stopped && this.engineKind === 'cloud') this.setState('error', { code: 'MIC_NOT_FOUND' });
    }
    trackDeviceId() {
      const t = this.stream && this.stream.getAudioTracks()[0];
      try { return (t && t.getSettings && t.getSettings().deviceId) || ''; } catch (e) { return ''; }
    }
  }

  let current = null;
  const draining = new Set();

  class Session {
    constructor(cfg, o) {
      this.id = (S.util && typeof S.util.uid === 'function') ? S.util.uid() : Math.random().toString(36).slice(2, 10);
      this.cfg = cfg;
      this.lang = o.lang || 'fr-FR';
      this.hint = o.hint || '';
      this.micDeviceId = o.micDeviceId || '';
      this.mobile = support().mobile;
      this.t0 = now();
      this.paused = false; this.stopped = false; this.draining = false;
      this.ctx = null; this.sink = null; this.tapMode = 'none';
      this.channels = [];
      this.cleanups = [];
      this.recentThem = []; this.heldMe = []; this.themSpans = [];
      this.unlockArmed = false; this.offlineWarned = false; this.lastTick = 0;
      this.defaultMicLabel = '';
    }
    channel(role) { return this.channels.find(c => c.role === role) || null; }
    ctxRunning() { return !this.ctx || this.ctx.state === 'running'; }

    async initAudio(required) {
      const AC = G.AudioContext || G.webkitAudioContext;
      if (!AC) { if (required) throw audioError('AUDIO_ENGINE'); return; }
      let ctx = null;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) {
        try { ctx = new AC(); } catch (e2) { if (required) throw audioError('AUDIO_ENGINE', e2); return; }
      }
      this.ctx = ctx;
      this.sink = ctx.createGain();
      this.sink.gain.value = 0;
      this.sink.connect(ctx.destination);
      ctx.onstatechange = () => this.onCtxState();
      await this.ensureRunning();
      this.tapMode = await loadTapModule(ctx);
      if (this.tapMode === 'none' && required) throw audioError('AUDIO_ENGINE');
    }
    async ensureRunning() {
      const ctx = this.ctx;
      if (!ctx || ctx.state === 'closed') return false;
      if (ctx.state !== 'running') { try { await withTimeout(ctx.resume(), 800); } catch (e) {  } }
      if (ctx.state !== 'running') { this.armUnlock(); return false; }
      return true;
    }
    armUnlock() {
      if (this.unlockArmed || !hasDoc || this.stopped) return;
      this.unlockArmed = true;
      info(null, 'AUDIO_SUSPENDED', 'warn');
      const evs = ['pointerdown', 'keydown', 'touchend'];
      const remove = () => { this.unlockArmed = false; evs.forEach(e => document.removeEventListener(e, fn, true)); };
      const fn = () => {
        if (!this.ctx || this.stopped) { remove(); return; }
        this.ctx.resume().then(() => {
          if (this.ctx && this.ctx.state === 'running') { remove(); info(null, 'AUDIO_RESUMED', 'info'); }
        }).catch(() => {});
      };
      evs.forEach(e => document.addEventListener(e, fn, true));
      this.cleanups.push(remove);
    }
    onCtxState() {
      const ctx = this.ctx;
      if (!ctx || this.stopped) return;
      if (ctx.state === 'running') {
        for (const ch of this.channels) if (ch.engineKind === 'cloud' && ch.state === 'starting' && !this.paused) ch.setState('listening');
        return;
      }
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') this.ensureRunning();
    }

    async open(opts) {
      const cfg = this.cfg, sup = support();
      const needSpeech = (cfg.them && cfg.themEngine === 'webspeech') || (cfg.me && cfg.meEngine === 'webspeech');
      const needCloud = cfg.needsKey;
      if (needSpeech && !sup.webSpeech) throw audioError('NO_WEBSPEECH');
      if (needCloud) {
        if (!S.ai || typeof S.ai.transcribe !== 'function') throw audioError('NO_KEY');
        if (typeof S.ai.hasKey === 'function' && !S.ai.hasKey()) throw audioError('NO_KEY');
      }
      if (cfg.local) {
        const link = new LocalLink(this);
        await link.open(4000);
        this.link = link;
        this.cleanups.push(() => link.close());
        try {
          this.checkAlive();
          if (cfg.them) this.addChannel('them', 'them', cfg.them, 'local', null, {});
          if (cfg.me) this.addChannel('me', 'me', cfg.me, 'local', null, {});
          for (const ch of this.channels) { const dev = link.devices[ch.role]; if (dev) ch.label = dev; }
          this.attachGlobal();
          for (const ch of this.channels) ch.engine.start();
        } catch (e) { link.close(); throw e; }
        return;
      }
      const usesDevices = cfg.them === 'display' || cfg.them === 'mic' || cfg.me === 'mic';
      if (usesDevices && !nav.mediaDevices) throw audioError(mediaUnavailableCode());

      let themStream = null, meStream = null;
      const acquired = [];
      try {
        if (cfg.them === 'display') {
          themStream = await getDisplay({ controller: opts.captureController });
          acquired.push(themStream);
        } else if (cfg.them === 'pc') {
          // « Son du PC » ne passe que par la transcription locale (branche LocalLink ci-dessus).
          throw audioError('BAD_CONFIG');
        }
        this.checkAlive();
        const mixedProcessing = { echoCancellation: false, noiseSuppression: true, autoGainControl: true, deviceId: this.micDeviceId };
        const meProcessing = { echoCancellation: !cfg.mixed, noiseSuppression: true, autoGainControl: true, deviceId: this.micDeviceId };
        if (cfg.them === 'mic') { themStream = await getMic(mixedProcessing); acquired.push(themStream); }
        else if (cfg.them && typeof cfg.them === 'object') themStream = cfg.them;
        this.checkAlive();
        if (cfg.me === 'mic') {
          const o = cfg.meEngine === 'cloud' ? (cfg.mixed ? mixedProcessing : meProcessing) : meProcessing;
          try { meStream = await getMic(o); acquired.push(meStream); } catch (e) {
            if (cfg.meEngine === 'cloud' || e.code === 'MIC_DENIED' || e.code === 'MIC_NOT_FOUND' || e.code === 'INSECURE') throw e;
            info(cfg.mixed ? 'mixed' : 'me', 'MIC_BUSY', 'warn');
          }
        } else if (cfg.me && typeof cfg.me === 'object') meStream = cfg.me;
        this.checkAlive();
        if (needCloud) await this.initAudio(true);
        else {
          try { await this.initAudio(false); } catch (e) {
            if (this.ctx) { try { this.ctx.close(); } catch (e2) {  } }
            this.ctx = null; this.tapMode = 'none';
          }
        }
        this.checkAlive();
        if (cfg.them) this.addChannel('them', 'them', cfg.them, cfg.themEngine, themStream, { mixedProcessing });
        if (cfg.me) this.addChannel('me', cfg.mixed ? 'mixed' : 'me', cfg.me, cfg.meEngine, meStream, { mixedProcessing, meProcessing });
        this.attachGlobal();
        for (const ch of this.channels) ch.engine.start();
      } catch (e) {
        acquired.forEach(stopStream);
        throw e;
      }
    }
    checkAlive() { if (this.stopped) throw audioError('ABORTED'); }
    addChannel(role, who, source, engineKind, stream, o) {
      const src = typeof source === 'object' ? 'stream' : source;
      const ch = new Channel(this, role, who, src, engineKind);
      ch.micOpts = src === 'mic' ? (role === 'them' || (who === 'mixed' && engineKind === 'cloud') ? o.mixedProcessing : o.meProcessing) : null;
      this.channels.push(ch);
      ch.setState('starting');
      if (stream) ch.attachStream(stream);
      if (engineKind === 'local') {
        ch.engine = new LocalEngine(ch, this.link);
      } else if (engineKind === 'cloud') {
        ch.engine = new CloudEngine(ch);
      } else {
        const at = stream ? stream.getAudioTracks()[0] : null;
        const useMicTrack = src === 'mic' && role === 'me' && this.cfg.meTrack && at;
        const track = (src !== 'mic' && at) || (useMicTrack ? at : null);
        if (track && src !== 'mic') info(who, 'WEBSPEECH_TRACK', 'info');
        ch.engine = new WebSpeechEngine(ch, { track, trackOptional: !!useMicTrack });
      }
      return ch;
    }
    attachGlobal() {
      const on = (target, evt, fn, opt) => {
        if (!target || typeof target.addEventListener !== 'function') return;
        target.addEventListener(evt, fn, opt);
        this.cleanups.push(() => target.removeEventListener(evt, fn, opt));
      };
      if (hasDoc) on(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') this.onVisible(); });
      on(G, 'pageshow', () => this.onVisible());
      on(G, 'online', () => this.onOnline());
      on(G, 'offline', () => this.onOffline());
      const md = nav.mediaDevices;
      if (md) {
        this.snapshotDefaultMic();
        on(md, 'devicechange', () => this.onDeviceChange());
      }
      const timer = setInterval(() => this.tick(true), 1000);
      this.cleanups.push(() => clearInterval(timer));
      if (S.bus && typeof S.bus.on === 'function') {
        const off = S.bus.on('settings:changed', () => this.onSettings());
        if (typeof off === 'function') this.cleanups.push(off);
      }
    }
    async snapshotDefaultMic() {
      try {
        const list = await nav.mediaDevices.enumerateDevices();
        const d = list.find(x => x.kind === 'audioinput' && x.deviceId === 'default') || list.find(x => x.kind === 'audioinput');
        this.defaultMicLabel = d ? d.label + '|' + d.groupId : '';
      } catch (e) {  }
    }
    async onDeviceChange() {
      if (this.stopped) return;
      info(null, 'DEVICE_CHANGE', 'info');
      let list = [];
      try { list = await nav.mediaDevices.enumerateDevices(); } catch (e) { return; }
      const ids = new Set(list.filter(x => x.kind === 'audioinput').map(x => x.deviceId));
      for (const ch of this.channels) {
        if (ch.source !== 'mic' || ch.ended) continue;
        const t = ch.stream && ch.stream.getAudioTracks()[0];
        const id = ch.trackDeviceId();
        if (!t || t.readyState === 'ended' || (id && id !== 'default' && !ids.has(id))) ch.recoverMic();
      }
      const d = list.find(x => x.kind === 'audioinput' && x.deviceId === 'default') || list.find(x => x.kind === 'audioinput');
      const sig = d ? d.label + '|' + d.groupId : '';
      if (this.defaultMicLabel && sig && sig !== this.defaultMicLabel) {
        for (const ch of this.channels) if (ch.engineKind === 'webspeech' && ch.source === 'mic') setTimeout(() => ch.engine.restartNow(), 600);
      }
      this.defaultMicLabel = sig || this.defaultMicLabel;
    }
    onVisible() {
      if (this.stopped) return;
      this.ensureRunning();
      for (const ch of this.channels) if (ch.engineKind === 'webspeech' && ch.engine) ch.engine.onVisible();
      this.tick(true);
    }
    onOnline() {
      if (this.stopped) return;
      if (this.offlineWarned) { this.offlineWarned = false; info(null, 'ONLINE', 'info'); }
      for (const ch of this.channels) if (ch.engineKind === 'webspeech' && ch.engine) ch.engine.onOnline();
    }
    onOffline() {
      if (this.stopped || this.offlineWarned) return;
      if (this.channels.some(c => c.engineKind === 'cloud')) { this.offlineWarned = true; info(null, 'OFFLINE', 'warn'); }
    }
    onSettings() {
      for (const ch of this.channels) if (ch.engineKind === 'cloud' && ch.engine) ch.engine.unpark();
    }
    waitOnline() {
      if (nav.onLine !== false) return Promise.resolve();
      this.onOffline();
      return new Promise(resolve => {
        const done = () => { clearTimeout(t); G.removeEventListener && G.removeEventListener('online', done); resolve(); };
        const t = setTimeout(done, 30000);
        if (G.addEventListener) G.addEventListener('online', done);
      });
    }
    tick(force) {
      const t = now();
      if (!force && t - this.lastTick < 250) return;
      this.lastTick = t;
      if (this.stopped) return;
      for (const ch of this.channels) {
        if (ch.engine && ch.engine.tick) ch.engine.tick();
        if (ch.source === 'display' && ch.tap && !ch.ended && !ch.silentWarned && !this.paused && t - ch.lastSoundAt > 60000) {
          ch.silentWarned = true;
          info(ch.who, 'DISPLAY_SILENT', 'warn');
        }
        // Son du PC : rien entendu depuis le début (Teams sort sur un autre périphérique que celui de Windows).
        if (ch.engineKind === 'local' && ch.role === 'them' && !ch.ended && !ch.everSound && !ch.silentWarned && !this.paused && ch.lastSoundAt && t - ch.lastSoundAt > 120000) {
          ch.silentWarned = true;
          info(ch.who, 'PC_SILENT', 'warn');
        }
      }
      this.checkHeld();
    }

    final(ch, text, t, extra) {
      if (this.stopped && !this.draining) return;
      const item = Object.assign({ who: ch.who, text, t: Math.max(0, Math.round(t)) }, extra || {});
      if (ch.role === 'them') {
        const dup = this.recentThem.some(r => r.viaMic && isEcho(item, r));
        this.recentThem.push({ text, t: item.t, durMs: item.durMs || 0, at: now() });
        const cut = now() - 60000;
        this.recentThem = this.recentThem.filter(r => r.at > cut);
        if (!dup) emit('final', item);
        this.checkHeld();
        return;
      }
      if (ch.who === 'me' && this.channel('them')) {
        if (this.isEchoOfThem(item)) return;
        // Bornes réelles de la phrase (pas l'heure de réception du texte) : une réponse courte suivie du
        // correspondant n'est pas comptée comme dite en même temps que lui.
        const end = item.durMs > 0 ? item.t + item.durMs : now() - this.t0;
        const ov = spanOverlap(item.t, end, this.themSpans, now() - this.t0);
        if (ov >= 0.6 && this.themStalled()) return this.emitViaMic(item);
        if (this.themBusy() || ov >= 0.6) { this.heldMe.push({ item, at: now(), ov }); return; }
      }
      emit('final', item);
    }
    emitViaMic(item) {
      const it = Object.assign({}, item, { who: 'them', via: 'mic' });
      this.recentThem.push({ text: it.text, t: it.t, durMs: Math.max(0, now() - this.t0 - it.t), at: now(), viaMic: true });
      emit('final', it);
    }
    noteThemSpeech(active) {
      const t = now() - this.t0, last = this.themSpans[this.themSpans.length - 1];
      if (active) { if (!last || last.to != null) this.themSpans.push({ from: t, to: null }); }
      else if (last && last.to == null) last.to = t;
      if (this.themSpans.length > 200) this.themSpans.splice(0, this.themSpans.length - 200);
    }
    themStalled() {
      const th = this.channel('them');
      if (!th || th.ended) return false;
      if (th.state === 'error' || th.state === 'restarting') return true;
      const q = th.engine && th.engine.queue;
      return !!(q && q.quotaWaitMs > 0);
    }
    isEchoOfThem(item) {
      for (const r of this.recentThem) if (isEcho(item, r)) return true;
      return false;
    }
    themBusy() {
      const th = this.channel('them');
      if (!th || th.ended) return false;
      if (th.engineKind === 'local') return th.speaking || th.interimShown || now() - th.lastSpeechEnd < 1500;
      if (th.engineKind !== 'cloud') return th.speaking;
      return th.speaking || !!(th.engine && th.engine.queue && th.engine.queue.busy) || now() - th.lastSpeechEnd < 1200;
    }
    checkHeld(force) {
      if (!this.heldMe.length) return;
      const busy = force ? false : this.themBusy();
      const t = now();
      while (this.heldMe.length) {
        const h = this.heldMe[0];
        if (busy && t - h.at < 8000) break;
        this.heldMe.shift();
        if (this.isEchoOfThem(h.item)) continue;
        if (h.ov >= 0.6 && this.themStalled()) this.emitViaMic(h.item);
        else emit('final', h.item);
      }
    }

    pause() {
      if (this.paused || this.stopped) return;
      this.paused = true;
      for (const ch of this.channels) {
        if (ch.ended) continue;
        if (ch.vad && ch.engineKind !== 'cloud') ch.vad.reset(true);
        ch.engine.pause();
        emit('interim', { who: ch.who, text: '' });
        ch.interimShown = false;
      }
    }
    resume() {
      if (!this.paused || this.stopped) return;
      this.paused = false;
      this.ensureRunning();
      for (const ch of this.channels) {
        if (ch.ended) continue;
        if (ch.vad) ch.vad.reset(true);
        ch.engine.resume();
      }
    }
    async stop(drainMs) {
      if (this.stopped) return;
      this.stopped = true;
      this.draining = true;
      draining.add(this);
      for (const ch of this.channels) {
        try { if (ch.vad && !ch.ended) ch.vad.flush(); } catch (e) {  }
        try { if (ch.engine) ch.engine.stop(); } catch (e) {  }
        ch.detachStream(true);
        ch.ended = true;
      }
      if (this.link) await this.link.drain(drainMs > 0 ? Math.min(6000, drainMs + 3000) : 0);
      this.cleanups.forEach(f => { try { f(); } catch (e) {  } });
      this.cleanups = [];
      if (this.ctx) { const c = this.ctx; this.ctx = null; try { await withTimeout(c.close(), 1500); } catch (e) {  } }
      // Les événements n'ont pas d'id de session : se taire si une autre session a pris la main.
      const superseded = () => !!current && current !== this;
      for (const ch of this.channels) {
        ch.level = 0;
        if (superseded()) continue;
        ch.setState('stopped');
        emit('level', { who: ch.who, rms: 0, raw: 0, peak: 0 });
      }
      const queues = this.channels.filter(c => c.engineKind === 'cloud' && c.engine).map(c => c.engine.queue);
      if (drainMs > 0 && queues.length) await Promise.all(queues.map(q => q.drain(drainMs)));
      if (drainMs > 0 && this.channels.some(c => c.engineKind === 'webspeech')) await sleep(Math.min(700, drainMs));
      queues.forEach(q => q.abort());
      this.checkHeld(true);
      if (!superseded()) for (const ch of this.channels) if (ch.interimShown || ch.engineKind === 'webspeech') emit('interim', { who: ch.who, text: '' });
      this.draining = false;
      draining.delete(this);
    }
    abortDrain() {
      this.channels.forEach(c => { if (c.engineKind === 'cloud' && c.engine) c.engine.queue.abort(); });
      this.heldMe = [];
      if (this.link && this.link.drainWait) { const f = this.link.drainWait; this.link.drainWait = null; f(); }
      this.draining = false;
      draining.delete(this);
    }
    status() {
      return {
        running: !this.stopped, id: this.id, preset: this.cfg.id, label: this.cfg.label, startedAt: this.t0, elapsedMs: now() - this.t0,
        paused: this.paused, audio: this.ctx ? this.ctx.state : 'none', tap: this.tapMode, sampleRate: this.ctx ? this.ctx.sampleRate : 0,
        channels: this.channels.map(c => ({
          who: c.who, role: c.role, source: c.source, engine: c.engineKind, state: c.state, code: c.code, error: c.error,
          label: c.label, surface: c.surface, level: c.level, speaking: c.speaking, ended: c.ended,
          pending: c.engineKind === 'cloud' && c.engine ? c.engine.queue.pending : 0,
          noiseFloor: c.vad ? c.vad.noiseFloor : null,
          vad: c.vad ? Object.assign({}, c.vad.stats) : null,
          local: c.engineKind === 'webspeech' && c.engine ? c.engine.local : false,
        })),
      };
    }
  }

  async function start(presetIdOrConfig, opts = {}) {
    const cfg = resolveConfig(presetIdOrConfig);
    if (current) await stop({ drainMs: 0 });
    for (const d of Array.from(draining)) d.abortDrain();
    const st = getSettings();
    const s = new Session(cfg, {
      lang: opts.lang || 'en-GB',
      hint: opts.hint || '',
      micDeviceId: opts.micDeviceId || st.micDeviceId || '',
    });
    current = s;
    try {
      await s.open(opts);
    } catch (e) {
      const err = e && e.code ? e : audioError('AUDIO_ENGINE', e);
      if (current === s) current = null;
      if (!s.stopped) {
        await s.stop(0);
        const failed = failedWhos(cfg, err.code);
        for (const w of [cfg.them ? 'them' : null, cfg.me ? (cfg.mixed ? 'mixed' : 'me') : null]) {
          if (!w) continue;
          if (failed.has(w)) emit('state', { who: w, state: 'error', code: err.code, error: err.message });
          else emit('state', { who: w, state: 'stopped' });
        }
      }
      throw err;
    }
  }

  function failedWhos(cfg, code) {
    const them = cfg.them ? 'them' : null, me = cfg.me ? (cfg.mixed ? 'mixed' : 'me') : null;
    const out = new Set();
    const add = (w, cond) => { if (w && cond) out.add(w); };
    if (/DISPLAY/.test(code)) add(them, cfg.them === 'display');
    else if (/^PC_AUDIO/.test(code)) { add(them, !!cfg.local); add(me, !!cfg.local); }
    else if (/^MIC_/.test(code)) { add(them, cfg.them === 'mic'); add(me, cfg.me === 'mic'); }
    else if (code === 'NO_KEY') { add(them, cfg.themEngine === 'cloud'); add(me, cfg.meEngine === 'cloud'); }
    else if (code === 'NO_WEBSPEECH') { add(them, cfg.themEngine === 'webspeech'); add(me, cfg.meEngine === 'webspeech'); }
    if (!out.size) { add(them, true); add(me, true); }
    return out;
  }

  async function stop(o = {}) {
    const s = current;
    if (!s) return;
    current = null;
    await s.stop(o.drainMs != null ? o.drainMs : 10000);
  }

  function pause() { if (current) current.pause(); }
  function resume() { if (current) current.resume(); }

  const api = {
    presets: PRESETS,
    support,
    start,
    stop,
    pause,
    resume,
    on: (evt, fn) => events.on(evt, fn),
    status() { return current ? current.status() : { running: false, channels: [] }; },
    message(code) { return MSG[code] || ''; },
    _internals: {
      Vad, Resampler, TranscriptionQueue, encodeWav, decodeWav, wavBlob, normalizePeak, levelToUnit,
      Session, isEcho, spanOverlap, resolveConfig,
    },
  };
  Object.defineProperties(api, {
    who: { enumerable: true, get() { const c = current && current.channel('me'); return c ? c.who : null; } },
    running: { enumerable: true, get() { return !!current; } },
  });
  S.audio = api;
})(window.AideVisio = window.AideVisio || {});
