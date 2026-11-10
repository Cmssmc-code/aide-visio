import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(path.join(here, '..', 'src', 'js', 'audio.js'), 'utf8'), { filename: 'audio.js' });
const A = globalThis.AideVisio.audio;
const I = A._internals;

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  ÉCHEC ' + name + '\n        ' + String((e && e.stack) || e).split('\n').slice(0, 4).join('\n        ')); }
}
function section(t) { console.log('\n' + t); }

const SR = 16000;
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const len = sec => Math.round(sec * SR);
function silence(sec) { return { x: new Float32Array(len(sec)), on: [] }; }
function white(sec, rms, r) {
  const n = len(sec), x = new Float32Array(n), a = rms * Math.sqrt(3);
  for (let i = 0; i < n; i++) x[i] = (r() * 2 - 1) * a;
  return { x, on: [] };
}
function lowpassNoise(sec, rms, fc, r) {
  const n = len(sec), x = new Float32Array(n), k = 1 - Math.exp(-2 * Math.PI * fc / SR);
  let y = 0, s2 = 0;
  for (let i = 0; i < n + 2000; i++) { y += k * ((r() * 2 - 1) - y); if (i >= 2000) { x[i - 2000] = y; s2 += y * y; } }
  const g = rms / Math.sqrt(s2 / n);
  for (let i = 0; i < n; i++) x[i] *= g;
  return { x, on: [] };
}
function speech(sec, level, r) {
  const n = len(sec), env = new Float32Array(n);
  let t = 0;
  while (t < n) {
    const syl = 2 + Math.floor(r() * 3);
    for (let k = 0; k < syl && t < n; k++) {
      const d = Math.round((0.15 + r() * 0.13) * SR), amp = 0.6 + r() * 0.4;
      for (let i = 0; i < d && t + i < n; i++) env[t + i] = amp * Math.sin(Math.PI * i / d) ** 2;
      t += d;
    }
    t += Math.round((0.04 + r() * 0.14) * SR);
  }
  const f0 = 110 + r() * 70, K = Math.floor(3800 / f0), ph = Array.from({ length: K + 1 }, () => r() * 6.283);
  const x = new Float32Array(n);
  let phase = 0, s2 = 0, cnt = 0, first = -1, last = -1;
  for (let i = 0; i < n; i++) {
    phase += 2 * Math.PI * f0 * (1 + 0.08 * Math.sin(2 * Math.PI * 0.7 * i / SR)) / SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.sin(k * phase + ph[k]) / k;
    x[i] = s * env[i];
    if (env[i] > 0.05) { s2 += x[i] * x[i]; cnt++; if (first < 0) first = i; last = i; }
  }
  const g = level / Math.sqrt(s2 / Math.max(1, cnt));
  for (let i = 0; i < n; i++) x[i] *= g;
  return { x, on: first < 0 ? [] : [[first, last]] };
}
function concat(...parts) {
  const total = parts.reduce((a, p) => a + p.x.length, 0), x = new Float32Array(total), on = [];
  let o = 0;
  for (const p of parts) { x.set(p.x, o); for (const [a, b] of p.on) on.push([a + o, b + o]); o += p.x.length; }
  return { x, on };
}
function mix(a, b) {
  const x = Float32Array.from(a.x);
  for (let i = 0; i < Math.min(x.length, b.x.length); i++) x[i] += b.x[i];
  return { x, on: a.on.concat(b.on) };
}
const ms = i => i * 1000 / SR;

function runVad(sig, opts = {}, chunker = null) {
  const segments = [], events = [];
  const vad = new I.Vad(Object.assign({
    onSpeech: (active, inf) => events.push({ active, atMs: inf.atMs }),
    onSegment: (samples, inf) => segments.push(Object.assign({ samples }, inf)),
  }, opts));
  if (!chunker) vad.push(sig.x);
  else { let i = 0; while (i < sig.x.length) { const n = chunker(); vad.push(sig.x.subarray(i, i + n)); i += n; } }
  return { vad, segments, events };
}
function rmsOf(x, from = 0, to = x.length) { let s = 0; for (let i = from; i < to; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, to - from)); }

section('VAD');

await test('silence numérique : aucun segment, aucun événement', () => {
  const { segments, events } = runVad(silence(5));
  assert.equal(segments.length, 0);
  assert.equal(events.length, 0);
});

await test('quasi-silence (bruit 0,0005) : aucun segment', () => {
  const { segments, events } = runVad(white(6, 0.0005, rng(1)));
  assert.equal(segments.length, 0);
  assert.equal(events.length, 0);
});

await test('bruit blanc fort constant (0,05) : rejeté (ZCR), aucun segment', () => {
  const { segments } = runVad(white(8, 0.05, rng(2)));
  assert.equal(segments.length, 0);
});

await test('bruit de ventilateur (passe-bas 300 Hz, 0,03) : rejeté (stationnaire), aucun segment', () => {
  const { segments, vad } = runVad(lowpassNoise(8, 0.03, 300, rng(3)));
  assert.equal(segments.length, 0);
  assert.ok(vad.noiseFloor > 0.015, 'plancher recalé sur le bruit : ' + vad.noiseFloor);
});

await test('souffle grave (passe-bas 100 Hz, 0,02) : aucun segment', () => {
  const { segments } = runVad(lowpassNoise(8, 0.02, 100, rng(33)));
  assert.equal(segments.length, 0);
});

const r5 = rng(5);
const threeUtterances = mix(concat(silence(0.5), speech(2.0, 0.1, r5), silence(1.2), speech(3.0, 0.08, r5), silence(1.5), speech(1.0, 0.12, r5), silence(1.0)), white(10.2, 0.003, rng(6)));

await test('trois phrases séparées : trois segments bien bornés (pré-roll 300 ms, fin + ~200 ms)', () => {
  const { segments, events } = runVad(threeUtterances);
  assert.equal(segments.length, 3, 'segments : ' + segments.map(s => `${s.startMs}-${s.endMs}`).join(', '));
  threeUtterances.on.forEach(([a, b], k) => {
    const s = segments[k], tA = ms(a), tB = ms(b);
    assert.ok(s.startMs >= tA - 420 && s.startMs <= tA - 150, `début ${k} : ${s.startMs} vs parole ${tA.toFixed(0)}`);
    assert.ok(s.endMs >= tB - 100 && s.endMs <= tB + 350, `fin ${k} : ${s.endMs} vs parole ${tB.toFixed(0)}`);
    assert.equal(s.samples.length, Math.round((s.endMs - s.startMs) * SR / 1000));
    assert.equal(s.reason, 'silence');
    assert.equal(s.forced, false);
  });
  assert.deepEqual(events.map(e => e.active), [true, false, true, false, true, false]);
});

await test('segments : contenu audio = signal source (pas de décalage)', () => {
  const { segments } = runVad(threeUtterances);
  const s = segments[1], off = Math.round(s.startMs * SR / 1000);
  let maxDiff = 0;
  for (let i = 0; i < s.samples.length; i++) maxDiff = Math.max(maxDiff, Math.abs(s.samples[i] - threeUtterances.x[off + i]));
  assert.ok(maxDiff < 1e-7, 'écart ' + maxDiff);
});

await test('découpage indépendant de la taille des morceaux (1 à 3000 échantillons)', () => {
  const ref = runVad(threeUtterances).segments;
  const r = rng(77);
  const got = runVad(threeUtterances, {}, () => 1 + Math.floor(r() * 3000)).segments;
  assert.equal(got.length, ref.length);
  got.forEach((s, k) => {
    assert.equal(s.startMs, ref[k].startMs);
    assert.equal(s.endMs, ref[k].endMs);
    assert.deepEqual(Array.from(s.samples.subarray(0, 64)), Array.from(ref[k].samples.subarray(0, 64)));
  });
});

await test('parole longue (35 s) : découpée en segments ≤ 14 s, contigus, sans perte', () => {
  const r = rng(8);
  const sig = mix(concat(silence(0.4), speech(35, 0.1, r), silence(1.2)), white(36.6, 0.003, rng(9)));
  const { segments, events } = runVad(sig);
  assert.equal(segments.length, 3, 'segments : ' + segments.map(s => `${s.startMs}-${s.endMs}`).join(', '));
  for (const s of segments) assert.ok(s.durationMs <= 14000 + 1e-6, 'durée ' + s.durationMs);
  assert.ok(segments[0].forced && segments[1].forced && !segments[2].forced);
  assert.equal(segments[0].reason, 'max');
  for (let k = 1; k < segments.length; k++) assert.equal(segments[k].startMs, segments[k - 1].endMs, 'contigus');
  const [a, b] = sig.on[0];
  assert.ok(segments[0].startMs <= ms(a) - 150);
  assert.ok(segments[2].endMs >= ms(b) - 100);
  assert.deepEqual(events.map(e => e.active), [true, false], 'un seul tour de parole');
});

await test('hangoverMs 600 (voie du jury) : 30 trames, segment clos plus tôt, pause de 0,68 s coupe', () => {
  const r = rng(41);
  const sig = mix(concat(silence(0.5), speech(1.5, 0.1, r), silence(0.68), speech(1.5, 0.1, r), silence(1.5)), white(5.68, 0.003, rng(42)));
  const fast = runVad(sig, { hangoverMs: 600 });
  const slow = runVad(sig);
  assert.equal(fast.vad.hangFrames, 30);
  assert.equal(slow.vad.hangFrames, 38);
  assert.equal(fast.segments.length, 2, 'segments 600 : ' + fast.segments.map(s => `${s.startMs}-${s.endMs}`).join(', '));
  assert.equal(slow.segments.length, 1, 'segments 750 : ' + slow.segments.map(s => `${s.startMs}-${s.endMs}`).join(', '));
  const off = e => e.filter(x => !x.active).pop().atMs;
  assert.ok(off(fast.events) <= off(slow.events) - 140, 'fin de parole annoncée ~150 ms plus tôt');
});

await test('bruit bref (250 ms) : ignoré (parole minimale 450 ms)', () => {
  const r = rng(10);
  const sig = mix(concat(silence(1), speech(0.25, 0.1, r), silence(1.5)), white(2.75, 0.003, rng(11)));
  const { segments, vad } = runVad(sig);
  assert.equal(segments.length, 0);
  assert.ok(vad.stats.discarded >= 1);
});

await test('clic (20 ms) : ne déclenche même pas la détection', () => {
  const sig = concat(silence(1), { x: Float32Array.from({ length: 320 }, (_, i) => Math.sin(i / 3) * 0.5), on: [] }, silence(1));
  const { segments, events } = runVad(sig);
  assert.equal(segments.length, 0);
  assert.equal(events.length, 0);
});

await test('plancher adaptatif : bruit qui monte d\'un coup puis parole → un seul segment, la parole', () => {
  const r = rng(12);
  const fan = lowpassNoise(7.5, 0.02, 250, rng(13));
  const sig = concat(
    white(3, 0.003, rng(14)),
    mix(concat(silence(4), speech(2, 0.12, r), silence(1.5)), fan),
  );
  const { segments, vad } = runVad(sig);
  assert.equal(segments.length, 1, 'segments : ' + segments.map(s => `${s.startMs}-${s.endMs} ${s.reason}`).join(', '));
  const [a, b] = sig.on[0];
  assert.ok(Math.abs(segments[0].startMs - (ms(a) - 300)) < 200, `début ${segments[0].startMs} vs ${ms(a)}`);
  assert.ok(Math.abs(segments[0].endMs - ms(b)) < 400, `fin ${segments[0].endMs} vs ${ms(b)}`);
  assert.ok(vad.stats.steady >= 1, 'bruit stationnaire détecté');
});

await test('parole faible sur bruit de fond modéré (RSB ~ 12 dB) : détectée', () => {
  const r = rng(15);
  const sig = mix(concat(silence(2), speech(2.5, 0.03, r), silence(1.5)), white(6, 0.008, rng(16)));
  const { segments } = runVad(sig);
  assert.equal(segments.length, 1);
});

await test('robustesse : 3 tours de parole détectés pour 5 bruits × 3 niveaux × 4 graines (RSB jusqu’à ~6 dB)', () => {
  const fails = [];
  for (const [kind, lvlN] of [['blanc', 0.001], ['blanc', 0.003], ['blanc', 0.01], ['ventilo', 0.005], ['ventilo', 0.012]]) {
    for (const lvl of [0.03, 0.06, 0.15]) {
      for (let seed = 100; seed < 104; seed++) {
        const r = rng(seed);
        const sp = concat(silence(0.2), speech(1.6, lvl, r), silence(1.0), speech(4, lvl * 0.7, r), silence(1.3), speech(0.9, lvl, r), silence(1.0));
        const sec = sp.x.length / SR;
        const noise = kind === 'blanc' ? white(sec, lvlN, rng(seed + 1000)) : lowpassNoise(sec, lvlN, 250, rng(seed + 1000));
        const { segments, vad } = runVad(mix(sp, noise));
        vad.flush();
        if (segments.length !== 3) fails.push(`${kind} ${lvlN} parole ${lvl} graine ${seed} → ${segments.length}`);
      }
    }
  }
  assert.deepEqual(fails, []);
});

await test('capture lancée en pleine phrase (parole dès t = 0) : segment détecté depuis le début', () => {
  const r = rng(40);
  const sig = mix(concat(speech(2.5, 0.08, r), silence(1.2)), white(3.7, 0.003, rng(41)));
  const { segments } = runVad(sig);
  assert.equal(segments.length, 1);
  assert.ok(segments[0].startMs <= 120, 'début ' + segments[0].startMs);
  assert.ok(segments[0].durationMs >= 2300, 'durée ' + segments[0].durationMs);
});

await test('bourdonnement 50 Hz et cliquetis de clavier : aucun segment', () => {
  const n = len(10), hum = new Float32Array(n), r = rng(42);
  for (let i = 0; i < n; i++) { const t = i / SR; hum[i] = 0.03 * (Math.sin(2 * Math.PI * 50 * t) + 0.5 * Math.sin(2 * Math.PI * 150 * t)); }
  assert.equal(runVad({ x: hum, on: [] }).segments.length, 0, 'bourdonnement');
  const keys = new Float32Array(n);
  for (let t = 0; t < n; t += Math.round((0.08 + r() * 0.25) * SR)) for (let i = 0; i < 160 && t + i < n; i++) keys[t + i] = (r() * 2 - 1) * 0.3 * Math.exp(-i / 30);
  assert.equal(runVad({ x: keys, on: [] }).segments.length, 0, 'clavier');
});

await test('flush() en pleine phrase : segment émis (raison flush)', () => {
  const r = rng(17);
  const sig = mix(concat(silence(0.5), speech(1.5, 0.1, r)), white(2, 0.003, rng(18)));
  const { vad, segments, events } = runVad(sig);
  assert.equal(segments.length, 0);
  assert.equal(vad.active, true);
  vad.flush();
  assert.equal(segments.length, 1);
  assert.equal(segments[0].reason, 'flush');
  assert.equal(events[events.length - 1].active, false);
  assert.equal(vad.active, false);
});

await test('reset() abandonne le segment sans l\'émettre', () => {
  const r = rng(19);
  const { vad, segments, events } = runVad(concat(silence(0.5), speech(1.2, 0.1, r)));
  vad.reset();
  assert.equal(segments.length, 0);
  assert.equal(events[events.length - 1].active, false);
});

await test('mode événements (collect:false) : début/fin de parole sans segment', () => {
  const { segments, events, vad } = runVad(threeUtterances, { collect: false });
  assert.equal(segments.length, 0);
  assert.equal(events.filter(e => e.active).length, 3);
  assert.equal(vad.stats.segments, 3);
});

await test('positionMs suit le flux', () => {
  const v = new I.Vad();
  v.push(new Float32Array(16000 * 2 + 160));
  assert.equal(Math.round(v.positionMs), 2010);
});

section('Encodeur WAV');

await test('en-tête RIFF/WAVE PCM 16 bits mono 16 kHz', () => {
  const n = 1234, u8 = I.encodeWav(new Float32Array(n), 16000);
  const v = new DataView(u8.buffer);
  const tag = o => String.fromCharCode(...u8.subarray(o, o + 4));
  assert.equal(u8.length, 44 + n * 2);
  assert.equal(tag(0), 'RIFF'); assert.equal(v.getUint32(4, true), 36 + n * 2);
  assert.equal(tag(8), 'WAVE'); assert.equal(tag(12), 'fmt ');
  assert.equal(v.getUint32(16, true), 16); assert.equal(v.getUint16(20, true), 1); assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 16000); assert.equal(v.getUint32(28, true), 32000);
  assert.equal(v.getUint16(32, true), 2); assert.equal(v.getUint16(34, true), 16);
  assert.equal(tag(36), 'data'); assert.equal(v.getUint32(40, true), n * 2);
});

await test('conversion float → int16 : bornes, arrondi, écrêtage, NaN', () => {
  const u8 = I.encodeWav(Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -3, NaN, 1e-6]));
  const v = new DataView(u8.buffer), got = [];
  for (let i = 0; i < 9; i++) got.push(v.getInt16(44 + i * 2, true));
  assert.deepEqual(got, [0, 32767, -32768, 16384, -16384, 32767, -32768, 0, 0]);
});

await test('aller-retour encode/decode (erreur < 1 LSB) ; Int16Array accepté ; autre fréquence', () => {
  const x = threeUtterances.x.subarray(16000, 32000);
  const d = I.decodeWav(I.encodeWav(x, 16000));
  assert.equal(d.sampleRate, 16000); assert.equal(d.channels, 1); assert.equal(d.samples.length, x.length);
  let e = 0;
  for (let i = 0; i < x.length; i++) e = Math.max(e, Math.abs(d.samples[i] - x[i]));
  assert.ok(e <= 1 / 32767 + 1e-9, 'erreur ' + e);
  const i16 = Int16Array.from([1, -2, 32767, -32768]);
  const d2 = I.decodeWav(I.encodeWav(i16, 44100));
  assert.equal(d2.sampleRate, 44100);
  assert.deepEqual(Array.from(d2.samples).map(s => Math.round(s < 0 ? s * 32768 : s * 32767)), [1, -2, 32767, -32768]);
});

await test('wavBlob : Blob audio/wav de la bonne taille', async () => {
  const b = I.wavBlob(new Float32Array(800));
  assert.equal(b.type, 'audio/wav');
  assert.equal(b.size, 44 + 1600);
  const head = new Uint8Array(await b.slice(0, 4).arrayBuffer());
  assert.equal(String.fromCharCode(...head), 'RIFF');
});

await test('normalisation : passage faible remonté (gain ≤ 6), silence et passage déjà fort inchangés', () => {
  const quiet = Float32Array.from({ length: 1000 }, (_, i) => 0.2 * Math.sin(i / 5));
  const q = I.normalizePeak(quiet);
  const peak = a => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(Math.abs(peak(q) - 0.89) < 0.01, 'crête ' + peak(q));
  const veryQuiet = quiet.map(v => v / 20);
  assert.ok(Math.abs(peak(I.normalizePeak(veryQuiet)) - 0.06) < 0.002, 'gain plafonné à 6');
  const sil = new Float32Array(100);
  assert.equal(I.normalizePeak(sil), sil);
  const loud = quiet.map(v => v * 4.45);
  assert.equal(I.normalizePeak(loud), loud);
});

section('Rééchantillonneur');

function tone(freq, rate, sec, amp = 0.5) { const n = Math.round(rate * sec); return Float32Array.from({ length: n }, (_, i) => amp * Math.sin(2 * Math.PI * freq * i / rate)); }
function zeroCrossFreq(x, rate, skip = 400) {
  let c = 0;
  for (let i = skip + 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) c++;
  return c / ((x.length - skip - 1) / rate);
}
const dB = (a, b) => 20 * Math.log10(a / b);

await test('48 kHz → 16 kHz : longueur 1/3', () => {
  const out = new I.Resampler(48000, 16000).process(new Float32Array(48000));
  assert.ok(Math.abs(out.length - 16000) <= 1, 'longueur ' + out.length);
});

await test('44,1 kHz → 16 kHz : longueur et fréquence conservées', () => {
  const out = new I.Resampler(44100, 16000).process(tone(1000, 44100, 1));
  assert.ok(Math.abs(out.length - 16000) <= 1, 'longueur ' + out.length);
  assert.ok(Math.abs(zeroCrossFreq(out, 16000) - 1000) < 5);
});

await test('bande passante : 1 kHz et 3 kHz à ±0,5 dB, fréquence exacte', () => {
  for (const f of [1000, 3000]) {
    const out = new I.Resampler(48000, 16000).process(tone(f, 48000, 1));
    const g = dB(rmsOf(out, 400), 0.5 / Math.SQRT2);
    assert.ok(Math.abs(g) < 0.5, `${f} Hz : ${g.toFixed(2)} dB`);
    assert.ok(Math.abs(zeroCrossFreq(out, 16000) - f) < 5, `${f} Hz : ${zeroCrossFreq(out, 16000)}`);
  }
});

await test('anti-repliement : 10 kHz ≤ -18 dB, 12 kHz ≤ -25 dB', () => {
  const g10 = dB(rmsOf(new I.Resampler(48000, 16000).process(tone(10000, 48000, 1)), 400), 0.5 / Math.SQRT2);
  const g12 = dB(rmsOf(new I.Resampler(48000, 16000).process(tone(12000, 48000, 1)), 400), 0.5 / Math.SQRT2);
  assert.ok(g10 <= -18, '10 kHz : ' + g10.toFixed(1) + ' dB');
  assert.ok(g12 <= -25, '12 kHz : ' + g12.toFixed(1) + ' dB');
});

await test('traitement par morceaux = traitement d\'un bloc (état conservé)', () => {
  const x = mix({ x: tone(440, 48000, 2), on: [] }, white(6, 0.05, rng(20))).x.subarray(0, 96000);
  const ref = new I.Resampler(48000, 16000).process(x);
  const rs = new I.Resampler(48000, 16000), parts = [], r = rng(21);
  let i = 0, total = 0;
  while (i < x.length) { const n = 1 + Math.floor(r() * 2500); const o = rs.process(x.subarray(i, i + n)); parts.push(o); total += o.length; i += n; }
  assert.equal(total, ref.length);
  const got = new Float32Array(total);
  let o = 0;
  for (const p of parts) { got.set(p, o); o += p.length; }
  let e = 0;
  for (let k = 0; k < total; k++) e = Math.max(e, Math.abs(got[k] - ref[k]));
  assert.ok(e < 1e-6, 'écart ' + e);
});

await test('16 kHz → 16 kHz : identité ; 8 kHz → 16 kHz : longueur ×2, fréquence conservée', () => {
  const x = tone(500, 16000, 0.5);
  assert.deepEqual(Array.from(new I.Resampler(16000, 16000).process(x)), Array.from(x));
  const up = new I.Resampler(8000, 16000).process(tone(500, 8000, 1));
  assert.ok(Math.abs(up.length - 16000) <= 2, 'longueur ' + up.length);
  assert.ok(Math.abs(zeroCrossFreq(up, 16000) - 500) < 5);
});

await test('chaîne complète 48 kHz → VAD : la parole rééchantillonnée est détectée', () => {
  const src = mix(concat(silence(0.5), speech(2, 0.1, rng(22)), silence(1.2)), white(3.7, 0.003, rng(23))).x;
  const up = new I.Resampler(16000, 48000).process(src);
  const rs = new I.Resampler(48000, 16000);
  const segs = [];
  const vad = new I.Vad({ onSegment: (s, inf) => segs.push(inf) });
  for (let i = 0; i < up.length; i += 2048) vad.push(rs.process(up.subarray(i, i + 2048)));
  assert.equal(segs.length, 1);
  assert.ok(segs[0].durationMs > 2000 && segs[0].durationMs < 2800, 'durée ' + segs[0].durationMs);
});

section('File de transcription');

const wait = t => new Promise(r => setTimeout(r, t));

await test('sorties dans l\'ordre, 2 en parallèle au maximum', async () => {
  const delays = [120, 10, 60, 5, 40, 1], out = [];
  const q = new I.TranscriptionQueue({ transcribe: async p => { await wait(delays[p]); return 'texte ' + p; }, onResult: (p, t) => out.push([p, t]) });
  delays.forEach((_, i) => q.push(i));
  assert.equal(await q.drain(3000), true);
  assert.deepEqual(out.map(o => o[0]), [0, 1, 2, 3, 4, 5]);
  assert.equal(out[3][1], 'texte 3');
  assert.equal(q.maxActive, 2);
});

await test('réessais : 2 échecs 503 puis succès → résultat livré (3 essais)', async () => {
  let n = 0;
  const out = [];
  const q = new I.TranscriptionQueue({ retryDelays: [5, 5], transcribe: async () => { n++; if (n < 3) { const e = new Error('503'); e.status = 503; throw e; } return { text: 'ok', model: 'm' }; }, onResult: (p, t) => out.push(t) });
  q.push('a');
  await q.drain(2000);
  assert.equal(n, 3);
  assert.deepEqual(out, ['ok']);
});

await test('échec persistant : onError après 3 essais, les suivants continuent dans l\'ordre', async () => {
  const calls = {}, out = [], errs = [];
  const q = new I.TranscriptionQueue({
    retryDelays: [5, 5],
    transcribe: async p => { calls[p] = (calls[p] || 0) + 1; if (p === 'x') { const e = new Error('500'); e.status = 500; throw e; } return p; },
    onResult: p => out.push(p), onError: p => errs.push(p),
  });
  ['x', 'y', 'z'].forEach(p => q.push(p));
  await q.drain(2000);
  assert.equal(calls.x, 3);
  assert.deepEqual(errs, ['x']);
  assert.deepEqual(out, ['y', 'z']);
});

await test('quota (429) passager : la concurrence revient à sa valeur après la pause', async () => {
  let n = 0;
  const out = [];
  const q = new I.TranscriptionQueue({ transcribe: async p => { n++; if (n === 1) { const e = new Error('429'); e.status = 429; throw e; } return p; }, onResult: p => out.push(p) });
  q.push(1);
  while (q.concurrency !== 1) await wait(5);
  q.pausedUntil = 0;
  q._pump();
  await q.drain(2000);
  assert.deepEqual(out, [1]);
  assert.equal(q.concurrency, 2);
});

await test('clé refusée (401) : pas de réessai', async () => {
  let n = 0;
  const errs = [];
  const q = new I.TranscriptionQueue({ retryDelays: [5, 5], transcribe: async () => { n++; const e = new Error('401'); e.status = 401; throw e; }, onError: (p, e) => errs.push(e.status) });
  q.push(1);
  await q.drain(1000);
  assert.equal(n, 1);
  assert.deepEqual(errs, [401]);
});

await test('délai dépassé : réponse jamais reçue → erreur TIMEOUT, signal d\'annulation déclenché', async () => {
  let aborted = false;
  const errs = [];
  const q = new I.TranscriptionQueue({ retries: 0, timeoutMs: 60, transcribe: (p, signal) => { signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); }, onError: (p, e) => errs.push(e.code) });
  q.push(1);
  await q.drain(1000);
  assert.deepEqual(errs, ['TIMEOUT']);
  assert.equal(aborted, true);
});

await test('tête bloquée > holTimeout : les suivants sont livrés sans attendre', async () => {
  const out = [];
  const q = new I.TranscriptionQueue({ holTimeoutMs: 100, transcribe: async p => { await wait(p === 0 ? 400 : 10); return p; }, onResult: p => out.push(p) });
  [0, 1, 2].forEach(p => q.push(p));
  await q.drain(2000);
  assert.deepEqual(out, [1, 2, 0]);
});

await test('attente du réseau : la tentative attend waitOnline', async () => {
  let online = false, n = 0;
  const out = [];
  const q = new I.TranscriptionQueue({ waitOnline: async () => { while (!online) await wait(10); }, transcribe: async () => { n++; return 'ok'; }, onResult: (p, t) => out.push(t) });
  q.push(1);
  await wait(60);
  assert.equal(n, 0);
  online = true;
  await q.drain(1000);
  assert.deepEqual(out, ['ok']);
});

await test('abort() vide la file et résout drain()', async () => {
  const out = [];
  const q = new I.TranscriptionQueue({ transcribe: async () => { await wait(200); return 'x'; }, onResult: (p, t) => out.push(t) });
  q.push(1); q.push(2); q.push(3);
  const d = q.drain(5000);
  await wait(20);
  q.abort();
  assert.equal(await d, true);
  await wait(250);
  assert.deepEqual(out, []);
  assert.equal(q.pending, 0);
});

section('Anti-doublon, niveaux, configuration');

await test('écho du jury capté par le micro → doublon', () => {
  assert.equal(I.isEcho({ text: 'pouvez-vous vous présenter en quelques mots', t: 1500 }, { text: 'Bonjour, pouvez-vous vous présenter en quelques mots ?', t: 1000, durMs: 3000 }), true);
  assert.equal(I.isEcho({ text: 'Parlez-moi de votre expérience chez Airbus', t: 2000 }, { text: 'parlez moi de votre expérience chez Airbus', t: 1800, durMs: 2500 }), true);
});

await test('vraie réponse de l’étudiant → pas un doublon ; même texte 40 s plus tard → pas un doublon', () => {
  assert.equal(I.isEcho({ text: "J'ai travaillé cinq ans en contrôle de gestion dans l'aéronautique", t: 9000 }, { text: 'Parlez-moi de votre parcours', t: 1000, durMs: 2000 }), false);
  assert.equal(I.isEcho({ text: 'pouvez-vous vous présenter', t: 45000 }, { text: 'pouvez-vous vous présenter', t: 1000, durMs: 2000 }), false);
});

await test('haut-parleurs : passage du micro dit pendant la parole du jury → recouvrement', () => {
  const spans = [{ from: 1000, to: 4000 }, { from: 9000, to: null }];
  assert.ok(I.spanOverlap(1500, 3500, spans) >= 0.99);
  assert.equal(I.spanOverlap(5000, 8000, spans), 0);
  assert.ok(Math.abs(I.spanOverlap(3000, 5000, spans) - 0.5) < 1e-9);
  assert.ok(I.spanOverlap(9500, 11000, spans, 12000) >= 0.99);
});

function fakeSession(themState) {
  const s = new I.Session({ them: 'display', me: 'mic' }, {});
  const q = { busy: false, quotaWaitMs: 0 };
  const them = { role: 'them', who: 'them', ended: false, engineKind: 'cloud', state: themState || 'listening',
    speaking: false, lastSpeechEnd: 0, engine: { queue: q } };
  const me = { role: 'me', who: 'me', ended: false, engineKind: 'webspeech' };
  s.channels = [them, me];
  const out = [];
  const offF = A.on('final', (e) => out.push(e));
  return { s, them, me, q, out, offF };
}
await test('haut-parleurs + quota : la voix du jury captée par le micro reste attribuée au jury, sans doublon', () => {
  const { s, them, me, q, out, offF } = fakeSession('restarting');
  q.quotaWaitMs = 30000;
  s.t0 = Date.now() - 5000;
  s.themSpans = [{ from: 1000, to: null }];
  s.final(me, 'Pouvez-vous me parler de votre expérience en contrôle de gestion ?', 1500, { source: 'webspeech' });
  assert.equal(out.length, 1);
  assert.equal(out[0].who, 'them');
  assert.equal(out[0].via, 'mic');
  them.state = 'listening'; q.quotaWaitMs = 0;
  s.final(them, 'Pouvez-vous me parler de votre expérience en contrôle de gestion ?', 1400, { source: 'cloud', durMs: 3000 });
  assert.equal(out.length, 1);
  offF();
});
await test('haut-parleurs, transcription saine : écho du micro écarté, vraie réponse de l’étudiant gardée', () => {
  const { s, them, me, out, offF } = fakeSession('listening');
  s.t0 = Date.now() - 20000;
  s.themSpans = [{ from: 1000, to: 4000 }];
  s.final(them, 'Quelles sont vos prétentions salariales ?', 1000, { source: 'cloud', durMs: 3000 });
  s.final(me, 'quelles sont vos prétentions salariales', 1200, { source: 'webspeech' });
  s.final(me, "Autour de quarante-cinq mille euros brut annuel, ouvert à la discussion", 15000, { source: 'webspeech' });
  assert.deepEqual(out.map(e => e.who), ['them', 'me']);
  offF();
});

await test('niveau perceptif 0..1 (échelle dB -60 → 0)', () => {
  assert.equal(I.levelToUnit(0), 0);
  assert.equal(I.levelToUnit(1), 1);
  assert.equal(I.levelToUnit(0.0005), 0);
  assert.ok(Math.abs(I.levelToUnit(0.1) - 2 / 3) < 1e-9);
});

await test('presets du SPEC + configuration personnalisée', () => {
  assert.deepEqual(A.presets.map(p => p.id), ['visio-casque', 'pc-interne', 'haut-parleur', 'visio-hp', 'micro-cloud']);
  const c1 = I.resolveConfig('visio-casque');
  assert.deepEqual([c1.them, c1.themEngine, c1.me, c1.meEngine, c1.mixed, c1.needsKey], ['display', 'cloud', 'mic', 'webspeech', false, true]);
  const cp = I.resolveConfig('pc-interne');
  assert.deepEqual([cp.them, cp.themEngine, cp.me, cp.meEngine, cp.mixed, cp.needsKey, cp.local], ['pc', 'local', 'mic', 'local', false, false, true]);
  const cm = I.resolveConfig({ them: 'pc', themEngine: 'local', me: 'mic', meEngine: 'webspeech', mixed: true });
  assert.deepEqual([cm.themEngine, cm.meEngine, cm.mixed, cm.local], ['local', 'local', false, true], 'moteur local : les deux voix passent par le programme');
  const c2 = I.resolveConfig({ them: 'mic', themEngine: 'cloud' });
  assert.deepEqual([c2.them, c2.themEngine, c2.me, c2.needsKey, c2.id], ['mic', 'cloud', null, true, 'custom']);
  const c3 = I.resolveConfig('micro-cloud');
  assert.deepEqual([c3.me, c3.meEngine, c3.mixed, c3.needsKey], ['mic', 'cloud', true, true]);
  for (const bad of ['inconnu', {}, { them: 'radio' }, { me: 'mic', meEngine: 'morse' }, null]) {
    assert.throws(() => I.resolveConfig(bad), e => e.code === 'BAD_CONFIG');
  }
});

await test('support() et start() hors navigateur : objet complet, erreurs codées en français', async () => {
  const sup = A.support();
  for (const k of ['getUserMedia', 'getDisplayMedia', 'displayAudio', 'webSpeech', 'audioWorklet', 'wakeLock', 'docPiP']) assert.equal(typeof sup[k], 'boolean', k);
  const states = [];
  const off = A.on('state', e => states.push(e));
  await assert.rejects(A.start('haut-parleur'), e => e.code === 'NO_WEBSPEECH' && /reconnaissance vocale/.test(e.message));
  globalThis.AideVisio.ai = { hasKey: () => false, transcribe: async () => ({ text: '' }) };
  await assert.rejects(A.start({ them: 'mic', themEngine: 'cloud' }), e => e.code === 'NO_KEY');
  globalThis.AideVisio.ai.hasKey = () => true;
  await assert.rejects(A.start({ them: 'mic', themEngine: 'cloud' }), e => e.code === 'NO_MEDIA' || e.code === 'INSECURE');
  off();
  assert.ok(states.some(s => s.state === 'error' && s.code === 'NO_WEBSPEECH' && s.who === 'mixed'));
  assert.equal(A.running, false);
  assert.equal(A.who, null);
});

section('Moteur local « Son du PC » (programme simulé)');
{
  const sockets = [];
  class FakeWS {
    constructor(url) {
      this.url = url; this.readyState = 0; this.sent = [];
      sockets.push(this);
      setTimeout(() => {
        if (FakeWS.refuse) { this.readyState = 3; if (this.onclose) this.onclose({ code: 1006 }); return; }
        this.readyState = 1;
        if (this.onopen) this.onopen();
        this.recv({ type: 'ready', model: 'base', devices: { them: 'Haut-parleur (boucle)', me: 'Micro intégré' } });
      }, 5);
    }
    send(s) {
      const m = JSON.parse(s);
      this.sent.push(m);
      if (m.type === 'stop') setTimeout(() => { this.recv({ type: 'final', who: 'them', text: 'Dernière question ?', t0: Date.now() - 900, t1: Date.now() - 100, ms: 300 }); this.recv({ type: 'drained' }); }, 20);
    }
    recv(m) { if (this.onmessage) this.onmessage({ data: JSON.stringify(m) }); }
    close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  }
  const realWS = globalThis.WebSocket;
  globalThis.WebSocket = FakeWS;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  await test('pc-interne : démarre sans micro ni clé, phrases attribuées, écho ignoré, vidange en fin d\'oral', async () => {
    const ev = [];
    const offs = ['final', 'interim', 'state', 'speech'].map(n => A.on(n, e => ev.push([n, e])));
    await A.start('pc-interne', { hint: 'Fondation Giacometti' });
    const ws = sockets[sockets.length - 1];
    assert.equal(ws.url, 'ws://127.0.0.1:47800/transcription');
    const start = ws.sent.find(m => m.type === 'start');
    assert.ok(start && start.lang && start.hint === 'Fondation Giacometti', 'start envoyé avec langue et contexte');
    const st = A.status();
    assert.deepEqual(st.channels.map(c => [c.who, c.engine, c.state]), [['them', 'local', 'listening'], ['me', 'local', 'listening']], JSON.stringify(st.channels.map(c => [c.who, c.engine, c.state])));
    const t = Date.now();
    ws.recv({ type: 'speech', who: 'them', active: true, t });
    ws.recv({ type: 'interim', who: 'them', text: 'Pourquoi la culture' });
    ws.recv({ type: 'speech', who: 'them', active: false, t: t + 2000 });
    ws.recv({ type: 'final', who: 'them', text: 'Pourquoi la culture, vous qui venez de l\'humanitaire ?', t0: t, t1: t + 2000, ms: 600 });
    ws.recv({ type: 'final', who: 'me', text: 'pourquoi la culture vous qui venez de l\'humanitaire', t0: t + 100, t1: t + 2000, ms: 500 });
    await wait(1700);
    ws.recv({ type: 'final', who: 'me', text: 'J\'ai toujours travaillé pour l\'intérêt général.', t0: t + 6000, t1: t + 8000, ms: 500 });
    await wait(50);
    await A.stop(1500);
    offs.forEach(f => f && f());
    const finals = ev.filter(([n]) => n === 'final').map(([, e]) => [e.who, e.text, e.source]);
    assert.deepEqual(finals.map(f => f[0] + ':' + f[1].split(',')[0].split('.')[0]), [
      'them:Pourquoi la culture', 'me:J\'ai toujours travaillé pour l\'intérêt général', 'them:Dernière question ?'], JSON.stringify(finals));
    assert.ok(finals.every(f => f[2] === 'local'));
    assert.ok(ev.some(([n, e]) => n === 'interim' && e.who === 'them' && e.text === 'Pourquoi la culture'), 'texte en direct transmis');
    assert.ok(!ev.some(([n, e]) => n === 'interim' && e.who === 'me' && e.text === '…'), 'pas de « … » pour le micro');
    assert.ok(ws.sent.some(m => m.type === 'stop'), 'vidange demandée à l\'arrêt');
  });

  await test('pc-interne : programme absent → PC_AUDIO_OFF en français, rien ne reste ouvert', async () => {
    FakeWS.refuse = true;
    await assert.rejects(() => A.start('pc-interne'), e => e.code === 'PC_AUDIO_OFF' && /Son du PC/.test(e.message));
    FakeWS.refuse = false;
    assert.equal(A.running, false);
  });

  await test('pc-interne : connexion perdue en plein oral → reconnexion et reprise', async () => {
    const infos = [];
    const off = A.on('info', e => infos.push(e.code));
    await A.start('pc-interne');
    const n0 = sockets.length;
    sockets[n0 - 1].close();
    await wait(2300);
    assert.ok(sockets.length > n0, 'nouvelle connexion tentée');
    await wait(50);
    assert.ok(infos.includes('PC_AUDIO_LOST') && infos.includes('PC_AUDIO_BACK'), infos.join(','));
    assert.ok(sockets[sockets.length - 1].sent.some(m => m.type === 'start'), 'start renvoyé après reconnexion');
    await A.stop(0);
    off && off();
  });
  globalThis.WebSocket = realWS;
}

console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
process.exit(failed ? 1 : 0);
