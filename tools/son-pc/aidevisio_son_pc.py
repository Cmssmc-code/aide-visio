"""Aide Visio — « Son du PC » : écoute et transcription locales, en dehors de Chrome.

Pour un appel décroché sur le PC (Lien avec Windows / Phone Link), Teams, Meet, Zoom… ce programme fait
tout le travail audio sur le PC, avec ses propres composants :

* deux sources captées séparément : le son joué par Windows (boucle WASAPI = voix du correspondant) et le
  micro par défaut (votre voix) ; chacune suit seule les changements de périphérique (casque, Bluetooth) ;
* découpage en phrases par le détecteur de parole Silero (fourni avec faster-whisper) ;
* transcription locale par Whisper (faster-whisper, modèle « base » ou « small » selon la vitesse du PC) :
  aucun service en ligne, aucune clé, aucune limite de Chrome ;
* attribution certaine : une phrase venue du son du PC est « Jury », une phrase du micro est « Moi » ;
  sans casque, une phrase du micro prononcée pendant que le son du PC parle (écho des haut-parleurs) est
  ignorée.

Aide Visio (mode « Appel ou visio sur ce PC (son interne) ») s'y connecte en WebSocket :

* ``ws://127.0.0.1:47800/transcription`` — messages JSON. Page → programme : ``{"type": "start", "lang",
  "hint"}``, ``{"type": "pause"}``, ``{"type": "resume"}``, ``{"type": "stop"}``. Programme → page :
  ``ready`` {model, devices}, ``level`` {who, rms}, ``speech`` {who, active, t}, ``final`` {who, text, t0, t1,
  ms}, ``info`` {code, message}, ``drained``. Les temps ``t`` sont en ms depuis l'époque Unix.
* ``ws://127.0.0.1:47800/son`` — son du PC brut (en-tête JSON {rate}, puis PCM 16 bits mono), pour les
  configurations où la page transcrit elle-même.

Seules les origines autorisées (site Aide Visio, localhost) peuvent se connecter : une autre page web ne peut
ni écouter le PC ni lire les transcriptions.

Dépendances : pip install pyaudiowpatch numpy websockets faster-whisper psutil
Lancement : pythonw aidevisio_son_pc.py   (Installer-Son-du-PC.ps1 le lance à chaque ouverture de session)
Réglages (variables d'environnement) : AIDE_VISIO_MODELE = auto | base | small | tiny (auto par défaut),
AIDE_VISIO_SON_PC_PORT (47800).
Journal : %LOCALAPPDATA%\\Aide Visio\\son-pc.log
"""
import asyncio
import heapq
import itertools
import json
import logging
import os
import queue
import re
import sys
import threading
import time
from collections import deque
from pathlib import Path

import numpy as np
import pyaudiowpatch as pa
import websockets

PORT = int(os.environ.get("AIDE_VISIO_SON_PC_PORT", "47800"))
MODEL_PREF = os.environ.get("AIDE_VISIO_MODELE", "auto").strip().lower()
ORIGINS = ("https://cmssmc-code.github.io", "http://localhost", "http://127.0.0.1")
FRAME_MS = 20
SR = 16000
VAD_FRAME = 512

LOG_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Aide Visio"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(filename=LOG_DIR / "son-pc.log", level=logging.INFO, encoding="utf-8",
                    format="%(asctime)s %(levelname)s %(threadName)s %(message)s")
log = logging.getLogger("son-pc")


def now_ms():
    return time.time() * 1000.0


def origin_ok(origin):
    if not origin:
        return False
    return any(origin == o or origin.startswith(o + ":") for o in ORIGINS)


HANDS_FREE = re.compile(r"hands-?free|mains[ -]libres|\bHFP\b|\bAG Audio\b", re.I)


def pick_device(p, kind):
    """(nom affiché, info du périphérique à ouvrir) pour 'pc' (boucle de sortie) ou 'mic' (entrée)."""
    wasapi = p.get_host_api_info_by_type(pa.paWASAPI)
    devs = [p.get_device_info_by_index(i) for i in range(p.get_device_count())]
    devs = [d for d in devs if d["hostApi"] == wasapi["index"]]
    if kind == "pc":
        outs = [d for d in devs if d["maxOutputChannels"] > 0 and not d.get("isLoopbackDevice")]
        default = p.get_device_info_by_index(wasapi["defaultOutputDevice"])
        spk = default if not HANDS_FREE.search(default["name"]) else next(
            (d for d in outs if not HANDS_FREE.search(d["name"])), default)
        loops = list(p.get_loopback_device_info_generator())
        dev = next((d for d in loops if spk["name"] in d["name"]), None) or p.get_default_wasapi_loopback()
        return spk["name"], dev
    ins = [d for d in devs if d["maxInputChannels"] > 0 and not d.get("isLoopbackDevice")]
    default = p.get_device_info_by_index(wasapi["defaultInputDevice"])
    dev = default if not HANDS_FREE.search(default["name"]) else next(
        (d for d in ins if not HANDS_FREE.search(d["name"])), default)
    return dev["name"], dev


def default_device_name(kind):
    """Nom du périphérique que la capture 'kind' devrait utiliser maintenant (liste relue à chaque appel)."""
    p = pa.PyAudio()
    try:
        return pick_device(p, kind)[0]
    finally:
        p.terminate()


class Capture:
    """Capture WASAPI partagée d'une source : 'pc' (boucle de la sortie par défaut) ou 'mic' (entrée par défaut).

    ``sink(samples_int16_mono, rate)`` est appelé depuis le fil PortAudio. Si le périphérique par défaut change
    (casque branché, Bluetooth mains libres activé par Lien avec Windows…) ou si le flux meurt, la capture est
    rouverte seule. Le débit transmis est celui du périphérique courant : le consommateur rééchantillonne.
    """

    def __init__(self, kind, sink):
        self.kind, self.sink = kind, sink
        self.lock = threading.Lock()
        self.pa = None
        self.stream = None
        self.name = ""
        self.device = ""
        self.rate = 0
        self.channels = 1
        self.stop_evt = threading.Event()
        self._open()
        threading.Thread(target=self._watch, name=f"suivi-{kind}", daemon=True).start()

    def _open(self):
        with self.lock:
            # close() pose stop_evt avant de prendre le verrou : aucune réouverture après la fermeture.
            if self.stop_evt.is_set():
                return
            self._close_stream()
            try:
                self.pa = pa.PyAudio()
                self.name, dev = pick_device(self.pa, self.kind)
                self.device = dev["name"]
                self.channels = max(1, min(2, int(dev["maxInputChannels"])))
                self.rate = int(dev["defaultSampleRate"])
                self.stream = self.pa.open(format=pa.paInt16, channels=self.channels, rate=self.rate, input=True,
                                           input_device_index=dev["index"],
                                           frames_per_buffer=self.rate * FRAME_MS // 1000, stream_callback=self._cb)
            except Exception:
                self._close_stream()
                raise
            log.info("capture %s : %s · %d Hz · %d canal(aux)", self.kind, self.device, self.rate, self.channels)

    def _watch(self):
        while not self.stop_evt.wait(1.5):
            try:
                name = default_device_name(self.kind)
                if self.stop_evt.is_set():
                    break
                dead = self.stream is None or not self.stream.is_active()
                if name != self.name or dead:
                    log.info("%s : %r → %r%s", self.kind, self.name, name, " (flux arrêté)" if dead else "")
                    self._open()
            except Exception:
                log.exception("suivi du périphérique %s", self.kind)

    def _cb(self, data, frames, info, status):
        a = np.frombuffer(data, dtype=np.int16)
        if self.channels > 1:
            a = a.reshape(-1, self.channels).mean(axis=1).astype(np.int16)
        try:
            self.sink(a, self.rate)
        except Exception:
            log.exception("traitement du son %s", self.kind)
        return (None, pa.paContinue)

    def _close_stream(self):
        if self.stream is not None:
            try:
                self.stream.stop_stream()
                self.stream.close()
            except Exception:
                pass
            self.stream = None
        if self.pa is not None:
            try:
                self.pa.terminate()
            except Exception:
                pass
            self.pa = None

    def close(self):
        self.stop_evt.set()
        with self.lock:
            self._close_stream()


def to_16k(a, rate):
    """int16 mono au débit du périphérique → float32 à 16 kHz (moyenne par blocs si le rapport est entier)."""
    x = a.astype(np.float32) / 32768.0
    if rate == SR or not x.size:
        return x
    if rate % SR == 0:
        f = rate // SR
        n = x.size - x.size % f
        return x[:n].reshape(-1, f).mean(axis=1)
    n = max(1, int(round(x.size * SR / rate)))
    return np.interp(np.linspace(0, x.size - 1, n), np.arange(x.size), x).astype(np.float32)


class StreamVad:
    """Silero VAD (fichier onnx de faster-whisper) image par image, avec mémoire d'état entre les appels."""

    def __init__(self):
        import onnxruntime
        from faster_whisper.utils import get_assets_path
        opts = onnxruntime.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        opts.log_severity_level = 4
        self.session = onnxruntime.InferenceSession(os.path.join(get_assets_path(), "silero_vad_v6.onnx"),
                                                    providers=["CPUExecutionProvider"], sess_options=opts)
        self.reset()

    def reset(self):
        self.h = np.zeros((1, 1, 128), dtype=np.float32)
        self.c = np.zeros((1, 1, 128), dtype=np.float32)
        self.ctx = np.zeros(64, dtype=np.float32)

    def prob(self, frame):
        x = np.concatenate([self.ctx, frame]).astype(np.float32)[None, :]
        out, self.h, self.c = self.session.run(None, {"input": x, "h": self.h, "c": self.c})
        self.ctx = frame[-64:].copy()
        return float(np.asarray(out).reshape(-1)[0])


class Segmenter:
    """Découpe une source en phrases : début si la parole est probable, fin après un silence suffisant."""

    def __init__(self, who, on_speech, on_segment, hang_ms):
        self.who = who
        self.on_speech, self.on_segment = on_speech, on_segment
        self.hang_ms = hang_ms
        self.vad = StreamVad()
        self.buf = np.zeros(0, dtype=np.float32)
        self.pre = deque(maxlen=10)
        self.cur = None
        self.t0 = 0.0
        self.last_voice = 0.0
        self.run = 0
        self.voiced = deque()
        self.quiet = False
        self.finalized = False
        self.rms_acc, self.rms_n = 0.0, 0

    def push(self, x, t_end):
        """x : float32 16 kHz ; t_end : instant (ms) de la dernière image."""
        self.buf = np.concatenate([self.buf, x])
        n = self.buf.size // VAD_FRAME
        if not n:
            return
        frames = self.buf[:n * VAD_FRAME].reshape(n, VAD_FRAME)
        self.buf = self.buf[n * VAD_FRAME:]
        for i, f in enumerate(frames):
            t = t_end - (n - 1 - i) * 32.0
            self.rms_acc += float(np.sqrt(np.mean(f * f)))
            self.rms_n += 1
            p = self.vad.prob(f)
            if p >= 0.5:
                self.voiced.append(t)
            while self.voiced and self.voiced[0] < t - 60000:
                self.voiced.popleft()
            if self.cur is None:
                self.pre.append(f)
                self.run = self.run + 1 if p >= 0.5 else 0
                if self.run >= 3:
                    self.cur = list(self.pre)
                    self.t0 = t - 32.0 * len(self.cur)
                    self.last_voice = t
                    self.pre.clear()
                    self.on_speech(self.who, True, self.t0)
            else:
                self.cur.append(f)
                if p >= 0.35:
                    self.last_voice = t
                if p >= 0.5 and self.quiet:
                    self.quiet = False
                    if self.finalized:
                        self.finalized = False
                        self.cur = self.cur[-10:]
                        self.t0 = t - 32.0 * len(self.cur)
                    self.on_speech(self.who, True, t)
                if len(self.cur) * 32 >= 15000:
                    self.close(t, keep_going=True)
                elif t - self.last_voice >= self.hang_ms:
                    self.close(t)

    def idle(self, t):
        """Aucun son reçu (la boucle WASAPI se tait quand rien ne joue) : termine la phrase en cours."""
        if self.cur is not None and t - self.last_voice >= self.hang_ms:
            self.close(t)

    def close(self, t, keep_going=False):
        audio = np.concatenate(self.cur) if self.cur else np.zeros(0, dtype=np.float32)
        t0, t1 = self.t0, min(t, self.last_voice + 200)
        if keep_going:
            self.cur, self.t0 = [], t
        else:
            self.cur = None
            self.run = 0
            if not self.quiet:
                self.on_speech(self.who, False, t)
            self.quiet = False
            self.finalized = False
        if audio.size >= SR * 0.3:
            self.on_segment(self.who, audio, t0, t1)

    def voiced_ms(self, t0, t1):
        return 32.0 * sum(1 for v in self.voiced if t0 <= v <= t1)

    def take_rms(self):
        r = self.rms_acc / self.rms_n if self.rms_n else 0.0
        self.rms_acc, self.rms_n = 0.0, 0
        return r


HALLUCINATIONS = re.compile(
    r"sous-titr|merci d'avoir regard|abonnez-vous|amara\.org|radio-canada|^\W*(merci|musique|applaudissements)\W*$",
    re.I)


def on_mains():
    """Vrai si le PC est sur secteur (ou sans batterie)."""
    try:
        import ctypes

        class SPS(ctypes.Structure):
            _fields_ = [("ACLineStatus", ctypes.c_byte), ("BatteryFlag", ctypes.c_byte),
                        ("BatteryLifePercent", ctypes.c_byte), ("SystemStatusFlag", ctypes.c_byte),
                        ("BatteryLifeTime", ctypes.c_ulong), ("BatteryFullLifeTime", ctypes.c_ulong)]
        s = SPS()
        ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(s))
        return s.ACLineStatus != 0
    except Exception:
        return True


def wav_bytes(audio):
    """float32 16 kHz → fichier WAV 16 bits mono en mémoire (pour les API de transcription)."""
    import io
    import wave
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes()
    b = io.BytesIO()
    with wave.open(b, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)
    return b.getvalue()


CLOUD = (
    ("groq", "https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3-turbo"),
    ("openai", "https://api.openai.com/v1/audio/transcriptions", "gpt-4o-mini-transcribe"),
)
CLOUD_TIMEOUT = 3.0


def cloud_transcribe(url, model, key, audio, lang, prompt):
    import urllib.request
    import uuid
    boundary = uuid.uuid4().hex
    fields = {"model": model, "language": lang, "response_format": "json", "temperature": "0"}
    if prompt:
        fields["prompt"] = prompt
    body = b""
    for k, v in fields.items():
        body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode("utf-8")
    body += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"phrase.wav\"\r\n"
             "Content-Type: audio/wav\r\n\r\n").encode("utf-8") + wav_bytes(audio) + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=CLOUD_TIMEOUT) as r:
        return str(json.loads(r.read().decode("utf-8")).get("text", "")).strip()


class Transcriber:
    """Fil unique de transcription, file prioritaire : phrases du jury, puis les vôtres, puis le texte en direct.

    Phrase finie : API en ligne la plus rapide si une clé est fournie (Groq, sinon OpenAI), sinon Whisper local.
    Whisper local « auto » : « base ». Avec AIDE_VISIO_MODELE=small, « base » est aussi chargé et sert pendant
    5 min dès que « small » transcrit en plus de 0,6 × la durée de la phrase.
    Texte en direct (phrase en cours du jury) : toujours en local, jamais devant une phrase finie.
    """

    def __init__(self, emit):
        self.emit = emit
        self.q = []
        self.seq = itertools.count()
        self.cv = threading.Condition()
        self.models = {}
        self.failed = None
        self.slow_until = 0.0
        self.lang = "fr"
        self.hint = ""
        self.keys = {}
        self.cloud_off_until = {}
        self.busy = False
        self.interim_pending = False
        self.on_interim = None
        self.live_model = None
        self.live_job = None
        self.live_cv = threading.Condition()
        threading.Thread(target=self._load, name="modeles", daemon=True).start()
        threading.Thread(target=self._run, name="whisper", daemon=True).start()
        threading.Thread(target=self._run_live, name="whisper-direct", daemon=True).start()

    def _model(self, name, threads=None):
        from faster_whisper import WhisperModel
        t = time.time()
        cpus = os.cpu_count() or 4
        m = WhisperModel(name, device="cpu", compute_type="int8",
                         cpu_threads=threads or max(2, min(8, cpus - 4)))
        log.info("modèle %s chargé en %.1f s", name, time.time() - t)
        return m

    def _load(self):
        first = MODEL_PREF if MODEL_PREF in ("base", "small", "tiny", "medium") else "base"
        try:
            m = self._model(first)
            t = time.time()
            noise = (np.random.default_rng(0).standard_normal(SR * 2) * 0.01).astype(np.float32)
            list(m.transcribe(noise, language=self.lang, beam_size=1, without_timestamps=True)[0])
            log.info("modèle %s préchauffé en %.1f s", first, time.time() - t)
            self.models[first] = m
        except Exception:
            log.exception("chargement du modèle %s", first)
            self.failed = f"Modèle Whisper « {first} » introuvable."
            self.emit({"type": "info", "code": "MODEL_FAILED", "message": self.failed})
            return
        if first == "small":
            # Repli quand « small » est trop lent sur ce PC.
            try:
                self.models["base"] = self._model("base")
            except Exception:
                log.exception("modèle de repli base (on s'en passe)")
        if (os.cpu_count() or 4) < 16:
            return
        try:
            live = self._model("base", threads=4)
            list(live.transcribe(np.zeros(SR, dtype=np.float32), language=self.lang, beam_size=1, without_timestamps=True)[0])
            self.live_model = live
        except Exception:
            log.exception("moteur du texte en direct (on s'en passe)")

    def _run_live(self):
        while True:
            with self.live_cv:
                while self.live_job is None or self.live_model is None:
                    self.live_cv.wait(0.5)
                who, audio, t0 = self.live_job
                self.live_job = None
            try:
                start = time.time()
                segs, _ = self.live_model.transcribe(
                    audio, language=self.lang, beam_size=1, vad_filter=False, without_timestamps=True,
                    condition_on_previous_text=False, initial_prompt=self.hint or None, temperature=0.0)
                text = " ".join(s.text.strip() for s in segs if s.text.strip() and not HALLUCINATIONS.search(s.text)).strip()
                if self.on_interim:
                    self.on_interim(who, t0, -1, text, round((time.time() - start) * 1000), "base·direct")
            except Exception:
                log.exception("texte en direct")

    def ready(self):
        return bool(self.models)

    def current(self):
        if MODEL_PREF == "small" and time.time() < self.slow_until and "base" in self.models:
            return "base"
        for k in (MODEL_PREF, "base", "small", "tiny", "medium"):
            if k in self.models:
                return k
        return None

    def add(self, who, audio, t0, t1):
        with self.cv:
            heapq.heappush(self.q, (0 if who == "them" else 1, next(self.seq), "final", who, audio, t0, t1))
            self.cv.notify()

    def add_interim(self, who, audio, t0, early=False):
        """Texte en direct de la phrase en cours (une demande à la fois, jamais devant une phrase finie).

        ``early`` : le correspondant vient de se taire ; cette transcription servira sans doute de phrase finale
        (moteur : ``on_interim``), elle passe donc avant vos phrases et n'est jamais abandonnée.
        """
        if not early:
            if self.live_model is not None:
                with self.live_cv:
                    self.live_job = (who, audio, t0)
                    self.live_cv.notify()
                return True
            with self.cv:
                if not self.models or self.interim_pending or self.q or self.busy:
                    return False
        with self.cv:
            if not self.models or (self.interim_pending and not early):
                return False
            self.interim_pending = True
            n = audio.size
            heapq.heappush(self.q, (0.5 if early else 2, next(self.seq), "early" if early else "interim", who, audio, t0, n))
            self.cv.notify()
            return True

    def pending(self, early=False):
        """Phrases finales en file ou en cours (``early`` : compte aussi les transcriptions anticipées)."""
        kinds = ("final", "early") if early else ("final",)
        with self.cv:
            return sum(1 for j in self.q if j[2] in kinds) + (1 if self.busy else 0)

    def clear(self):
        with self.cv:
            self.q.clear()
            self.interim_pending = False

    def _run(self):
        while True:
            with self.cv:
                while not self.q or not self.models:
                    self.cv.wait(0.5)
                _, _, kind, who, audio, t0, t1 = heapq.heappop(self.q)
                if kind in ("interim", "early"):
                    self.interim_pending = False
                    if kind == "interim" and self.q:
                        continue
                self.busy = True
            try:
                if kind in ("interim", "early"):
                    start = time.time()
                    text, name = self._cloud(audio) if kind == "early" else (None, None)
                    if name is None:
                        text, name = self._local(audio, fast=kind == "interim")
                    if self.on_interim:
                        self.on_interim(who, t0, t1, text, round((time.time() - start) * 1000), name)
                    elif text:
                        self.emit({"type": "interim", "who": who, "text": text, "t0": round(t0)})
                else:
                    self._final(who, audio, t0, t1)
            except Exception:
                log.exception("transcription")
            finally:
                self.busy = False
                if not self.pending():
                    self.emit({"type": "idle"})

    def _local(self, audio, fast=False):
        name = "base" if fast and "base" in self.models else self.current()
        segs, _ = self.models[name].transcribe(
            audio, language=self.lang, beam_size=1, vad_filter=False, without_timestamps=True,
            condition_on_previous_text=False, initial_prompt=self.hint or None,
            no_speech_threshold=0.6, log_prob_threshold=-1.0, compression_ratio_threshold=2.4, temperature=0.0)
        parts = []
        for s in segs:
            txt = s.text.strip()
            if not txt or (s.no_speech_prob > 0.6 and s.avg_logprob < -0.8) or HALLUCINATIONS.search(txt):
                continue
            parts.append(txt)
        return " ".join(parts).strip(), name

    def _cloud(self, audio):
        for prov, url, model in CLOUD:
            key = self.keys.get(prov)
            if not key or time.time() < self.cloud_off_until.get(prov, 0):
                continue
            t = time.time()
            try:
                text = cloud_transcribe(url, model, key, audio, self.lang, self.hint)
                if HALLUCINATIONS.search(text):
                    text = ""
                return text, prov
            except Exception as e:
                code = getattr(e, "code", None)
                self.cloud_off_until[prov] = time.time() + (3600 if code in (401, 403) else 60 if code == 429 else 20)
                log.warning("%s en échec en %.1f s (%s) : Whisper local", prov, time.time() - t, code or e)
                self.emit({"type": "info", "code": "CLOUD_FALLBACK",
                           "message": f"Transcription {prov} indisponible ({code or 'réseau'}) : transcription locale."})
        return None, None

    def _final(self, who, audio, t0, t1):
        start = time.time()
        text, name = self._cloud(audio)
        if name is None:
            text, name = self._local(audio)
        took = time.time() - start
        dur = audio.size / SR
        if name == "small" and took > 0.6 * max(dur, 1.5):
            self.slow_until = time.time() + 300
            log.info("small trop lent (%.1f s pour %.1f s) : base pendant 5 min", took, dur)
        log.info("%s %.1f s → %.2f s [%s] %r", who, dur, took, name, text[:120])
        if text:
            self.emit({"type": "final", "who": who, "text": text, "t0": round(t0), "t1": round(t1),
                       "ms": round(took * 1000), "model": name})


class Engine:
    """Les deux sources, leurs détecteurs de parole, la transcription et l'anti-écho, pour tous les clients."""

    ECHO_RATIO = 0.6

    def __init__(self, broadcast):
        self.broadcast = broadcast
        self.paused = True
        self.frames = queue.Queue(maxsize=2000)
        self.tr = Transcriber(self.emit)
        self.tr.on_interim = self._on_interim
        self.early_lock = threading.Lock()
        self.early_mark = None
        self.early_inflight = None
        self.ready = None
        self.early_sent = set()
        self.waiting = {}
        self.seg = {"them": Segmenter("them", self.on_speech, self.on_segment, 700),
                    "me": Segmenter("me", self.on_speech, self.on_segment, 800)}
        self.caps = {}
        self.last_in = {"them": 0.0, "me": 0.0}
        self.stop_evt = threading.Event()
        self.flush_evt = threading.Event()
        self.discard_evt = threading.Event()
        self.caps_lock = threading.Lock()
        threading.Thread(target=self._loop, name="moteur", daemon=True).start()

    def open_captures(self):
        """Ouvre le son du PC et le micro (s'ils ne le sont pas déjà)."""
        with self.caps_lock:
            for who, kind in (("them", "pc"), ("me", "mic")):
                if who in self.caps:
                    continue
                try:
                    self.caps[who] = Capture(kind, lambda a, r, w=who: self._in(w, a, r))
                except Exception as e:
                    log.exception("capture %s impossible", kind)
                    self.emit({"type": "info", "code": "CAPTURE_FAILED", "who": who,
                               "message": f"Capture {'du son du PC' if kind == 'pc' else 'du micro'} impossible : {e}"})

    def close_captures(self):
        """Libère le micro et la boucle du son du PC (plus aucun oral) : rien n'est écouté hors oral."""
        with self.caps_lock:
            for c in self.caps.values():
                c.close()
            self.caps.clear()
            for s in self.seg.values():
                s.cur, s.run = None, 0
                s.vad.reset()
        log.info("captures fermées (aucun oral en cours)")

    def devices(self):
        """Périphériques utilisés (ou qui le seraient), sans ouvrir de capture."""
        out = {w: c.device for w, c in self.caps.items()}
        for who, kind in (("them", "pc"), ("me", "mic")):
            if who not in out:
                try:
                    p = pa.PyAudio()
                    try:
                        out[who] = pick_device(p, kind)[1]["name"]
                    finally:
                        p.terminate()
                except Exception:
                    out[who] = ""
        return out

    def emit(self, msg):
        self.broadcast(msg)

    def _in(self, who, a, rate):
        try:
            self.frames.put_nowait((who, a, rate, now_ms()))
        except queue.Full:
            pass

    def _loop(self):
        last_level = 0.0
        last_interim = 0.0
        was_paused = self.paused
        flush = getattr(self, "flush_evt", None)
        discard_evt = getattr(self, "discard_evt", None)
        while not self.stop_evt.is_set():
            try:
                who, a, rate, t = self.frames.get(timeout=0.1)
                self.last_in[who] = t
                if not self.paused:
                    self.seg[who].push(to_16k(a, rate), t)
            except queue.Empty:
                pass
            except Exception:
                log.exception("moteur")
            t = now_ms()
            # Pause ou « stop » : la phrase en cours est terminée ici, dans le fil moteur (pas de course avec push).
            paused = self.paused
            # Dernier client parti : la phrase en cours est jetée, rien n'est transcrit après la séance.
            discard = discard_evt is not None and discard_evt.is_set()
            cut = discard or (paused and not was_paused) or (flush is not None and flush.is_set())
            was_paused = paused
            if cut:
                for s in self.seg.values():
                    try:
                        if discard:
                            s.cur, s.run = None, 0
                        elif s.cur is not None:
                            s.close(t)
                        s.vad.reset()
                        s.buf = np.zeros(0, dtype=np.float32)
                    except Exception:
                        log.exception("fin de phrase forcée")
                if discard:
                    discard_evt.clear()
                    with self.early_lock:
                        self.waiting.clear()
                        self.ready = None
                        self.early_inflight = None
                    self.tr.clear()
                if flush is not None:
                    flush.clear()
            for who, s in self.seg.items():
                if t - self.last_in[who] > 150:
                    s.idle(t)
            th = self.seg["them"]
            if not self.paused and th.cur:
                mark = (th.t0, th.last_voice)
                if t - th.last_voice >= 250 and self.early_mark != mark and len(th.cur) <= 470:
                    if self.tr.add_interim("them", np.concatenate(th.cur), th.t0, early=True):
                        self.early_mark = mark
                        self.early_inflight = (th.t0, len(th.cur) * VAD_FRAME, th.last_voice)
                        if not th.quiet:
                            th.quiet = True
                            self.on_speech("them", False, t)
                elif len(th.cur) * 32 >= 800 and t - last_interim >= 800 and t - th.last_voice < 250:
                    if self.tr.add_interim("them", np.concatenate(th.cur[-470:]), th.t0):
                        last_interim = t
            self._check_waiting(t)
            if t - last_level >= 100:
                last_level = t
                for who, s in self.seg.items():
                    self.emit({"type": "level", "who": who, "rms": round(s.take_rms(), 5)})

    def on_speech(self, who, active, t):
        self.emit({"type": "speech", "who": who, "active": active, "t": round(t)})

    def on_segment(self, who, audio, t0, t1):
        if who == "me":
            covered = self.seg["them"].voiced_ms(t0, t1)
            if covered >= self.ECHO_RATIO * max(1.0, t1 - t0):
                log.info("micro ignoré (écho du son du PC : %.0f %% recouvert)", 100 * covered / max(1.0, t1 - t0))
                return
            self.tr.add(who, audio, t0, t1)
            return
        need = int((t1 - t0) * SR / 1000) - 2 * VAD_FRAME
        with self.early_lock:
            self.early_sent = {x for x in self.early_sent if x > t0 - 300000}
            if t0 in self.early_sent:
                self.early_sent.discard(t0)
                return
            got = self.ready
            if got and got[0] == t0 and got[1] >= need:
                self.ready = None
                self._emit_final("them", got[3], t0, t1, got[4], got[5] + "·anticipé")
                return
            if self.early_inflight and self.early_inflight[0] == t0 and self.early_inflight[1] >= need:
                self.waiting[t0] = (audio, t1, now_ms())
                return
        self.tr.add(who, audio, t0, t1)

    def _on_interim(self, who, t0, n, text, ms, model):
        """Résultat d'une transcription « en direct » (n = -1) ou « anticipée » du correspondant."""
        seg = self.seg.get(who)
        if n == -1 and (seg is None or seg.cur is None or seg.t0 != t0 or seg.quiet):
            return
        if text and not self.paused:
            self.emit({"type": "interim", "who": who, "text": text, "t0": round(t0)})
        with self.early_lock:
            if self.early_inflight and self.early_inflight[0] == t0 and self.early_inflight[1] == n:
                lv = self.early_inflight[2]
                self.early_inflight = None
                w = self.waiting.pop(t0, None)
                if w is not None:
                    if text:
                        self._emit_final(who, text, t0, w[1], ms, model + "·anticipé")
                    return
                self.ready = (t0, n, lv, text, ms, model)

    QUIET_FINAL_MS = 450

    def _check_waiting(self, t):
        """Phrase anticipée prête + 0,45 s de silence → envoyée tout de suite ; filet de sécurité des attentes."""
        th = self.seg["them"]
        with self.early_lock:
            r = self.ready
            if r is not None:
                if th.cur is None or th.t0 != r[0] or th.last_voice != r[2]:
                    if th.cur is not None:
                        self.ready = None
                elif t - r[2] >= self.QUIET_FINAL_MS:
                    self.ready = None
                    self.early_sent.add(r[0])
                    th.finalized = True
                    self._emit_final("them", r[3], r[0], r[2] + 200, r[4], r[5] + "·anticipé")
            late = [k for k, w in self.waiting.items() if t - w[2] > 4000]
            for k in late:
                audio, t1, _ = self.waiting.pop(k)
                self.tr.add("them", audio, k, t1)

    def _emit_final(self, who, text, t0, t1, ms, model):
        if not text:
            return
        log.info("%s → %r [%s, %d ms]", who, text[:120], model, ms)
        self.emit({"type": "final", "who": who, "text": text, "t0": round(t0), "t1": round(t1), "ms": ms, "model": model})

    def configure(self, lang=None, hint=None, keys=None):
        if lang:
            self.tr.lang = lang.split("-")[0].lower()
        if hint is not None:
            self.tr.hint = str(hint)[:400]
        if isinstance(keys, dict):
            self.tr.keys = {k: str(v).strip() for k, v in keys.items() if k in ("groq", "openai") and v}
            self.tr.cloud_off_until.clear()
            log.info("transcription en ligne : %s", ", ".join(self.tr.keys) or "aucune clé (Whisper local)")

    def status(self):
        return next((p for p, _, _ in CLOUD if self.tr.keys.get(p)), None) or self.tr.current()

    def close(self):
        self.stop_evt.set()
        for c in self.caps.values():
            c.close()


BOOST_FILE = LOG_DIR / "son-pc.json"
BOOST_CLOSE = ["qemu-system-x86_64-headless.exe", "qemu-system-x86_64.exe", "qemu-system-aarch64.exe",
               "qemu-system-i386.exe", "emulator.exe"]
PROTECT = {"chrome.exe", "msedge.exe", "msedgewebview2.exe", "phoneexperiencehost.exe", "crossdeviceservice.exe",
           "crossdeviceresume.exe", "yourphone.exe", "yourphoneserver.exe", "audiodg.exe", "svchost.exe",
           "system", "registry", "smss.exe", "csrss.exe", "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe",
           "dwm.exe", "explorer.exe", "ms-teams.exe", "teams.exe", "zoom.exe", "webexmta.exe", "ciscocollabhost.exe",
           "whatsapp.exe", "whatsapp.root.exe", "searchhost.exe", "startmenuexperiencehost.exe", "textinputhost.exe",
           "shellexperiencehost.exe", "ctfmon.exe", "fontdrvhost.exe", "memory compression", "secure system"}


def boost_settings():
    cfg = {"mode_oral": True, "fermer": BOOST_CLOSE, "ralentir": True}
    try:
        cfg.update(json.loads(BOOST_FILE.read_text(encoding="utf-8")))
    except Exception:
        pass
    return cfg


class Boost:
    def __init__(self):
        self.lowered = {}
        self.active = False
        self.lock = threading.Lock()

    def _protected(self, p, me):
        try:
            name = (p.name() or "").lower()
            if p.pid in me or name in PROTECT:
                return True
            if name in ("python.exe", "pythonw.exe"):
                cmd = " ".join(p.cmdline()).lower()
                return "phone-hub" in cmd or "aidevisio" in cmd
            return False
        except Exception:
            return True

    def start(self):
        cfg = boost_settings()
        with self.lock:
            if self.active or not cfg.get("mode_oral", True):
                return
            self.active = True
        try:
            import psutil
        except ImportError:
            log.warning("mode oral : psutil absent, rien n'est optimisé")
            return
        me = {os.getpid()}
        try:
            psutil.Process().nice(psutil.HIGH_PRIORITY_CLASS)
        except Exception:
            log.exception("priorité haute impossible")
        close = {n.lower() for n in cfg.get("fermer") or []}
        procs = list(psutil.process_iter(["name"]))
        for p in procs:
            try:
                if (p.info["name"] or "").lower() in close and not self._protected(p, me):
                    p.kill()
                    log.info("mode oral : fermé %s (pid %d)", p.info["name"], p.pid)
            except Exception:
                pass
        if not cfg.get("ralentir", True):
            return
        for p in procs:
            try:
                p.cpu_percent(None)
            except Exception:
                pass
        time.sleep(1.0)
        for p in procs:
            try:
                if p.cpu_percent(None) < 5 or self._protected(p, me):
                    continue
                prev = p.nice()
                if prev in (psutil.IDLE_PRIORITY_CLASS,):
                    continue
                # Sous le verrou : stop() ne peut pas passer entre le test et la baisse.
                with self.lock:
                    if not self.active:
                        return
                    p.nice(psutil.IDLE_PRIORITY_CLASS)
                    self.lowered[p.pid] = prev
                log.info("mode oral : priorité minimale pour %s (pid %d)", p.info["name"], p.pid)
            except Exception:
                pass

    def stop(self):
        with self.lock:
            if not self.active:
                return
            self.active = False
            lowered = list(self.lowered.items())
            self.lowered.clear()
        try:
            import psutil
        except ImportError:
            return
        for pid, prev in lowered:
            try:
                psutil.Process(pid).nice(prev)
            except Exception:
                pass
        if lowered:
            log.info("mode oral terminé : %d priorité(s) rétablie(s)", len(lowered))
        try:
            psutil.Process().nice(psutil.NORMAL_PRIORITY_CLASS)
        except Exception:
            pass


class Hub:
    def __init__(self):
        self.clients = set()
        self.started = set()
        self.engine = None
        self.loop = None
        self.close_timer = None
        self.boost = Boost()

    def broadcast(self, msg):
        data = json.dumps(msg, ensure_ascii=False)
        for ws in list(self.clients):
            self.loop.call_soon_threadsafe(asyncio.ensure_future, self._send(ws, data))

    async def _send(self, ws, data):
        try:
            await ws.send(data)
        except Exception:
            self.clients.discard(ws)

    async def transcription(self, ws, origin):
        if self.engine is None:
            self.engine = Engine(self.broadcast)
        self.clients.add(ws)
        log.info("transcription : client %s (%d)", origin, len(self.clients))
        try:
            while not self.engine.tr.ready():
                if self.engine.tr.failed:
                    await ws.send(json.dumps({"type": "info", "code": "MODEL_FAILED", "message": self.engine.tr.failed},
                                             ensure_ascii=False))
                    return
                await ws.send(json.dumps({"type": "info", "code": "MODEL_LOADING", "message": "Chargement du modèle de transcription…"}))
                await asyncio.sleep(1.0)
            await ws.send(json.dumps({"type": "ready", "model": self.engine.tr.current(), "devices": self.engine.devices()}, ensure_ascii=False))
            async for raw in ws:
                try:
                    m = json.loads(raw)
                except Exception:
                    continue
                kind = m.get("type")
                if kind == "start":
                    self.cancel_close()
                    self.started.add(ws)
                    self.engine.configure(m.get("lang"), m.get("hint"), m.get("keys"))
                    await asyncio.get_running_loop().run_in_executor(None, self.engine.open_captures)
                    self.engine.paused = False
                    asyncio.get_running_loop().run_in_executor(None, self.boost.start)
                    await ws.send(json.dumps({"type": "config", "stt": self.engine.status(),
                                              "devices": self.engine.devices()}, ensure_ascii=False))
                elif kind == "pause":
                    self.engine.paused = True
                elif kind == "resume":
                    if ws in self.started:
                        self.engine.paused = False
                elif kind == "stop":
                    deadline = time.time() + 6
                    eng = self.engine
                    # Termine la phrase en cours (fil moteur), puis attend aussi les phrases anticipées.
                    eng.flush_evt.set()
                    while eng.flush_evt.is_set() and time.time() < deadline:
                        await asyncio.sleep(0.05)
                    while (eng.tr.pending(early=True) or eng.waiting) and time.time() < deadline:
                        await asyncio.sleep(0.1)
                    await ws.send(json.dumps({"type": "drained"}))
        except websockets.ConnectionClosed:
            pass
        finally:
            self.clients.discard(ws)
            self.started.discard(ws)
            log.info("transcription : client parti (%d restant)", len(self.clients))
            if not self.started and self.engine is not None:
                self.engine.discard_evt.set()
                self.engine.paused = True
                self.engine.tr.clear()
                self.cancel_close()
                self.close_timer = asyncio.get_running_loop().call_later(
                    20, lambda: None if self.started else self.engine.close_captures())
                self.boost.stop()

    def cancel_close(self):
        if self.close_timer is not None:
            self.close_timer.cancel()
            self.close_timer = None


hub = Hub()


async def raw_pc(ws, origin):
    """Son du PC brut pour la page (en-tête {rate}, puis PCM 16 bits mono)."""
    q = asyncio.Queue()
    loop = asyncio.get_running_loop()
    state = {"rate": None}

    def sink(a, rate):
        if state["rate"] is None:
            state["rate"] = rate
        if rate != state["rate"] and a.size:
            n = max(1, round(a.size * state["rate"] / rate))
            a = np.interp(np.linspace(0, a.size - 1, n), np.arange(a.size), a).astype(np.int16)
        b = a.tobytes()
        loop.call_soon_threadsafe(lambda: (q.qsize() > 100 and q.get_nowait(), q.put_nowait(b)))

    cap = Capture("pc", sink)
    state["rate"] = cap.rate
    log.info("son brut : %s · %s · %d Hz", origin, cap.device, cap.rate)
    try:
        await ws.send(json.dumps({"rate": cap.rate, "channels": 1, "format": "s16le", "device": cap.device}))
        while True:
            await ws.send(await q.get())
    except websockets.ConnectionClosed:
        pass
    finally:
        cap.close()
        log.info("son brut : déconnexion %s", origin)


async def handler(ws):
    origin = ws.request.headers.get("Origin", "")
    path = ws.request.path.split("?")[0]
    if not origin_ok(origin) or path not in ("/son", "/transcription"):
        log.warning("refusé : origine=%r chemin=%r", origin, path)
        await ws.close(code=4003, reason="origine non autorisée")
        return
    try:
        if path == "/son":
            await raw_pc(ws, origin)
        else:
            await hub.transcription(ws, origin)
    except Exception as e:
        log.exception("connexion %s", path)
        try:
            await ws.close(code=4500, reason=str(e)[:120])
        except Exception:
            pass


async def main():
    hub.loop = asyncio.get_running_loop()
    async with websockets.serve(handler, "127.0.0.1", PORT, max_size=2 ** 16, ping_interval=20):
        log.info("à l'écoute sur ws://127.0.0.1:%d (/transcription, /son) · modèle %s", PORT, MODEL_PREF)
        print(f"Son du PC Aide Visio : ws://127.0.0.1:{PORT} (journal : {LOG_DIR / 'son-pc.log'})", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except OSError as e:
        log.error("port %d indisponible (déjà lancé ?) : %s", PORT, e)
        sys.exit(1)
