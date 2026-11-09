import { chromium } from 'playwright-core';
import { findChrome } from '../tools/chrome-path.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function pageFakes() {
  if (window.__fakes) return;
  window.__fakes = true;
  class FakeUtterance { constructor(t) { this.text = t; this.lang = ''; this.voice = null; this.rate = 1; this.pitch = 1; this.onend = null; this.onerror = null; } }
  let speaking = null;
  const synth = {
    speaking: false, pending: false, paused: false,
    getVoices: () => [{ name: 'Voix française de test', lang: 'fr-FR', localService: true, default: true, voiceURI: 'fr-test' }],
    addEventListener() {}, removeEventListener() {}, onvoiceschanged: null,
    speak(u) { speaking = u; (window.__spoken = window.__spoken || []).push(u.text); setTimeout(() => { if (speaking === u) { speaking = null; if (u.onend) u.onend({}); } }, 60); },
    cancel() { const u = speaking; speaking = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); },
    pause() {}, resume() {}
  };
  try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true }); } catch (e) {  }
  window.SpeechSynthesisUtterance = FakeUtterance;

  const ctl = window.__sr = { active: new Set(), starts: 0, lastLang: '', said: [] };
  class FakeRecognition {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1; this._on = false; this._results = []; }
    start() {
      if (this._on) { const e = new Error('already started'); e.name = 'InvalidStateError'; throw e; }
      this._on = true; ctl.starts++; ctl.lastLang = this.lang; ctl.active.add(this);
      setTimeout(() => { if (!this._on) return; if (this.onstart) this.onstart({}); if (this.onaudiostart) this.onaudiostart({}); }, 15);
    }
    stop() { this._end(); }
    abort() { this._end(); }
    _end() {
      if (!this._on) return;
      this._on = false; ctl.active.delete(this);
      setTimeout(() => { if (this.onend) this.onend({}); }, 10);
    }
    _emit(text, final) {
      const r = [{ transcript: text, confidence: 0.9 }];
      r.isFinal = !!final;
      const idx = this._results.length;
      const list = this._results.slice();
      list[idx] = r;
      if (final) this._results.push(r);
      if (this.onresult) this.onresult({ resultIndex: idx, results: list });
    }
  }
  ctl.say = async (text, opts) => {
    opts = opts || {};
    ctl.said.push(text);
    const words = String(text).split(' ');
    const step = opts.stepMs == null ? 60 : opts.stepMs;
    for (let i = 1; i < words.length; i++) {
      ctl.active.forEach((r) => r._emit(words.slice(0, i).join(' '), false));
      await new Promise((res) => setTimeout(res, step));
    }
    ctl.active.forEach((r) => r._emit(text, true));
    return ctl.active.size;
  };
  ctl.error = (code) => ctl.active.forEach((r) => { if (r.onerror) r.onerror({ error: code }); r._end(); });
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition;

  window.__display = { calls: 0, noAudio: false };
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getDisplayMedia = async function (constraints) {
      window.__display.calls++;
      window.__display.last = constraints;
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 36;
      const v = cv.captureStream(5).getVideoTracks();
      if (window.__display.noAudio) return new MediaStream(v);
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      return new MediaStream([...v, ...mic.getAudioTracks()]);
    };
  }
}

export async function launchBrowser({ wav, headed } = {}) {
  const args = [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-features=Translate,MediaRouter',
    '--lang=fr-FR'
  ];
  if (wav) args.push(`--use-file-for-fake-audio-capture=${wav}`);
  return chromium.launch({ executablePath: findChrome(), headless: !headed, args });
}

export async function newContext(browser, mock, o = {}) {
  const context = await browser.newContext({
    viewport: o.viewport || { width: 1440, height: 900 },
    deviceScaleFactor: o.dsf || 1,
    colorScheme: o.dark ? 'dark' : 'light',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    acceptDownloads: true,
    serviceWorkers: 'block',
    permissions: ['microphone', 'clipboard-read', 'clipboard-write'],
    isMobile: !!o.mobile,
    hasTouch: !!o.mobile
  });
  if (mock) await mock.attach(context);
  await context.addInitScript(pageFakes);
  if (o.seed) await context.addInitScript(o.seed.fn, o.seed.arg);
  return context;
}

export function watchErrors(context, sink) {
  const attach = (page) => {
    page.on('pageerror', (e) => sink(`[pageerror] ${e.message}`, page));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const t = msg.text();
      if (/Failed to load resource|net::ERR_|favicon/i.test(t)) return;
      sink(`[console] ${t}`, page);
    });
  };
  context.pages().forEach(attach);
  context.on('page', attach);
}
