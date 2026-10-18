"""Generate original, gently filtered paper sounds; no external recordings."""
import math
from pathlib import Path
import random
import struct
import wave

RATE = 22050
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "audio"
OUTPUT.mkdir(parents=True, exist_ok=True)

for name, duration, seed, peak in [("paper-open", 1.08, 1841, .62)]:
    rng = random.Random(seed)
    samples = []
    low = slow = 0.0
    for index in range(round(duration * RATE)):
        t = index / RATE
        noise = rng.uniform(-1, 1)
        low += .22 * (noise - low)
        slow += .035 * (noise - slow)
        texture = low - slow + .025 * noise
        edge = math.sin(math.pi * index / (round(duration * RATE) - 1)) ** 1.4
        envelope = sum(level * math.exp(-.5 * ((t-center)/width) ** 2) for center, width, level in [(.13,.045,.7),(.31,.08,1),(.55,.045,.7),(.72,.075,.85),(.9,.05,.55)])
        samples.append(texture * envelope * edge)
    gain = peak / max(abs(value) for value in samples)
    data = b"".join(struct.pack("<h", round(max(-1, min(1, value * gain)) * 32767)) for value in samples)
    with wave.open(str(OUTPUT / f"{name}.wav"), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(data)
    rms = math.sqrt(sum((value * gain) ** 2 for value in samples) / len(samples))
    print(f"{name}: {duration}s, peak {peak:.2f}, RMS {rms:.3f}")
