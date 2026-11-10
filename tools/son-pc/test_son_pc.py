"""Tests hors ligne de « Son du PC » : aucun haut-parleur, aucun micro ouvert.

Les phrases (voix de synthèse Windows, tests/fixtures/son-pc/) sont injectées en temps réel dans la vraie
boucle du moteur, comme le ferait la capture WASAPI (y compris les trous sans aucune donnée quand rien ne
joue). Vérifie : attribution, texte en direct, phrase finale anticipée (délai), anti-écho, et le protocole
WebSocket (origine refusée, « ready » sans ouvrir de capture).

Lancer : python tools/son-pc/test_son_pc.py
"""
import asyncio
import importlib.util
import json
import os
import queue
import sys
import threading
import time
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
FIX = HERE.parent.parent / "tests" / "fixtures" / "son-pc"
os.environ.setdefault("AIDE_VISIO_MODELE", "base")
os.environ["AIDE_VISIO_SON_PC_PORT"] = "47899"
spec = importlib.util.spec_from_file_location("son_pc", HERE / "aidevisio_son_pc.py")
sp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sp)

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  ok    " + name)
    else:
        failed += 1
        print("  ÉCHEC " + name + ("  — " + detail if detail else ""))


def load(name):
    w = wave.open(str(FIX / name))
    return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16), w.getframerate()


def engine_without_devices():
    """Moteur complet (boucle, segmenteurs, transcription) mais sans capture : on injecte les images."""
    events = []
    eng = sp.Engine.__new__(sp.Engine)
    eng.broadcast = lambda m: events.append((time.time(), m))
    eng.paused = False
    eng.frames = queue.Queue(maxsize=2000)
    eng.tr = sp.Transcriber(eng.emit)
    eng.tr.on_interim = eng._on_interim
    eng.early_lock = threading.Lock()
    eng.early_mark = eng.early_inflight = None
    eng.ready, eng.early_sent, eng.waiting = None, set(), {}
    eng.seg = {"them": sp.Segmenter("them", eng.on_speech, eng.on_segment, 700, 29000),
               "me": sp.Segmenter("me", eng.on_speech, eng.on_segment, 800)}
    eng.caps, eng.caps_lock = {}, threading.Lock()
    eng.last_in = {"them": 0.0, "me": 0.0}
    eng.stop_evt = threading.Event()
    eng.flush_evt = threading.Event()
    while not eng.tr.ready():
        time.sleep(0.2)
    threading.Thread(target=eng._loop, daemon=True).start()
    eng.configure("fr-FR", "Oral d'anglais UE 218", {})
    return eng, events


def play(eng, who_pcm, rate):
    """Injecte en temps réel, par blocs de 20 ms ; who_pcm = [(who, pcm), …] joués en même temps."""
    step = rate // 50
    n = max(p.size for _, p in who_pcm)
    start = time.time()
    for k, i in enumerate(range(0, n, step)):
        for who, p in who_pcm:
            if i < p.size:
                eng._in(who, p[i:i + step], rate)
        d = start + (k + 1) * 0.02 - time.time()
        if d > 0:
            time.sleep(d)


def wait_for(cond, seconds):
    """Attend qu'une condition soit vraie (PC chargé : la transcription peut prendre du temps)."""
    deadline = time.time() + seconds
    while not cond() and time.time() < deadline:
        time.sleep(0.2)


def finals(events):
    return [m for _, m in events if m["type"] == "final"]


print("Moteur (injection temps réel, trous sans données)")
q1, rate = load("question-culture.wav")
q2, _ = load("question-salaire.wav")
eng, ev = engine_without_devices()

play(eng, [("them", q1)], rate)
t_end1 = time.time()
time.sleep(3.0)
play(eng, [("them", q2), ("me", (q2 * 0.4).astype(np.int16))], rate)
time.sleep(4.0)
play(eng, [("me", q1)], rate)
wait_for(lambda: any(m["who"] == "me" and "culture" in m["text"].lower() for m in finals(ev)), 40)
time.sleep(1.0)

f = finals(ev)
them = [m["text"].lower() for m in f if m["who"] == "them"]
me = [m["text"].lower() for m in f if m["who"] == "me"]
check("jury : première question transcrite", any("culture" in t for t in them), repr(them))
check("jury : question après un trou sans données", any("salari" in t or "tention" in t for t in them), repr(them))
check("écho du haut-parleur dans le micro ignoré", not any("salari" in t or "tention" in t for t in me), repr(me))
check("étudiant : sa phrase est bien « me »", any("culture" in t for t in me), repr(me))
check("texte en direct envoyé pendant la parole", any(m["type"] == "interim" and m["who"] == "them" for _, m in ev))
first = next((at for at, m in ev if m["type"] == "final" and m["who"] == "them"), None)
delay = (first - t_end1) if first else 99
check("phrase finale moins de 2 s après la fin de la parole", delay < 2.0, f"{delay:.2f} s")
print(f"        (délai mesuré : {delay:.2f} s)")

print("\nHaut-parleurs : réponse dite juste après la question (même phrase du micro)")
ev.clear()
time.sleep(1.0)
gap = np.zeros(rate * 3 // 10, dtype=np.int16)
play(eng, [("them", q2), ("me", np.concatenate([(q2 * 0.4).astype(np.int16), gap, q1]))], rate)
wait_for(lambda: {"them", "me"} <= {m["who"] for m in finals(ev)}, 40)
time.sleep(2.0)
f = finals(ev)
them = [m["text"].lower() for m in f if m["who"] == "them"]
me = [m["text"].lower() for m in f if m["who"] == "me"]
check("jury : question transcrite", any("salari" in t or "tention" in t for t in them), repr(them))
check("étudiant : réponse gardée après l'écho", any("culture" in t for t in me), repr(me))
check("étudiant : aucun mot du jury dans sa réponse", not any("salari" in t or "tention" in t for t in me), repr(me))

print("\nFilet sur le texte : mêmes mots au même moment")
got = []
keep_b = eng.broadcast
eng.broadcast = got.append
eng.emit({"type": "final", "who": "them", "text": "Why did you choose this company?", "t0": 1000, "t1": 4000})
eng.emit({"type": "final", "who": "me", "text": "why did you choose this company", "t0": 1300, "t1": 4400})
eng.emit({"type": "final", "who": "me", "text": "Because I like this company a lot.", "t0": 6500, "t1": 9000})
eng.broadcast = keep_b
check("écho transcrit : ignoré", not any(m["who"] == "me" and m["t0"] == 1300 for m in got), repr(got))
check("vraie réponse : gardée", any(m["who"] == "me" and m["t0"] == 6500 for m in got), repr(got))

print("\nPause au milieu d'une phrase (le son du PC continue : silence)")
ev.clear()
play(eng, [("them", q1[: q1.size // 2])], rate)
eng.paused = True
play(eng, [("them", np.zeros(rate * 3 // 2, dtype=np.int16))], rate)
check("pause : la phrase en cours est terminée", eng.seg["them"].cur is None)
deadline = time.time() + 30
while not any(m["who"] == "them" for m in finals(ev)) and time.time() < deadline:
    time.sleep(0.2)
check("pause : la phrase dite avant la pause est transcrite", any(m["who"] == "them" for m in finals(ev)), repr(finals(ev)))
eng.paused = False


print("\nProtocole WebSocket (port de test, aucune capture ouverte)")


async def protocol():
    import websockets
    server = await websockets.serve(sp.handler, "127.0.0.1", sp.PORT)
    sp.hub.loop = asyncio.get_running_loop()
    try:
        try:
            async with websockets.connect(f"ws://127.0.0.1:{sp.PORT}/transcription", origin="https://evil.example") as w:
                await w.recv()
            check("origine étrangère refusée", False)
        except Exception:
            check("origine étrangère refusée", True)
        async with websockets.connect(f"ws://127.0.0.1:{sp.PORT}/transcription", origin="http://localhost:8080") as w:
            ready = None
            for _ in range(120):
                m = json.loads(await asyncio.wait_for(w.recv(), 5))
                if m["type"] == "ready":
                    ready = m
                    break
            check("« ready » avec modèle et périphériques", bool(ready and ready.get("model") and ready.get("devices")), repr(ready))
            check("aucune capture ouverte sans « start »", not sp.hub.engine.caps)
    finally:
        server.close()
        await server.wait_closed()

asyncio.run(protocol())

print(f"\n{passed} réussi(s), {failed} échec(s)")
sys.exit(1 if failed else 0)
