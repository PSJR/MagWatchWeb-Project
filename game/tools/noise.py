"""Deterministic value/perlin noise helpers used by the forest map generator.

Pure stdlib on purpose: the generator has to run in CI and in a bare container
without numpy, and the map must be byte-identical on every machine.
"""

import math

_PERM_SIZE = 256


def _build_perm(seed):
    """Fisher-Yates shuffle of 0..255 driven by a small xorshift PRNG."""
    state = (seed * 747796405 + 2891336453) & 0xFFFFFFFF
    perm = list(range(_PERM_SIZE))
    for i in range(_PERM_SIZE - 1, 0, -1):
        state ^= (state << 13) & 0xFFFFFFFF
        state ^= state >> 17
        state ^= (state << 5) & 0xFFFFFFFF
        j = state % (i + 1)
        perm[i], perm[j] = perm[j], perm[i]
    return perm + perm


_GRAD = [(1, 1), (-1, 1), (1, -1), (-1, -1), (1, 0), (-1, 0), (0, 1), (0, -1)]


def _fade(t):
    return t * t * t * (t * (t * 6 - 15) + 10)


class Perlin:
    """Classic 2D Perlin noise, output in roughly [-1, 1]."""

    def __init__(self, seed):
        self.perm = _build_perm(seed)

    def noise(self, x, y):
        xi = int(math.floor(x)) & 255
        yi = int(math.floor(y)) & 255
        xf = x - math.floor(x)
        yf = y - math.floor(y)
        u = _fade(xf)
        v = _fade(yf)
        perm = self.perm

        aa = perm[perm[xi] + yi]
        ab = perm[perm[xi] + yi + 1]
        ba = perm[perm[xi + 1] + yi]
        bb = perm[perm[xi + 1] + yi + 1]

        g = _GRAD
        n00 = g[aa & 7][0] * xf + g[aa & 7][1] * yf
        n10 = g[ba & 7][0] * (xf - 1) + g[ba & 7][1] * yf
        n01 = g[ab & 7][0] * xf + g[ab & 7][1] * (yf - 1)
        n11 = g[bb & 7][0] * (xf - 1) + g[bb & 7][1] * (yf - 1)

        x1 = n00 + u * (n10 - n00)
        x2 = n01 + u * (n11 - n01)
        return x1 + v * (x2 - x1)

    def fbm(self, x, y, octaves=5, lacunarity=2.0, gain=0.5):
        """Fractal brownian motion, normalised to about [-1, 1]."""
        amp = 1.0
        freq = 1.0
        total = 0.0
        norm = 0.0
        for _ in range(octaves):
            total += self.noise(x * freq, y * freq) * amp
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm

    def ridged(self, x, y, octaves=5, lacunarity=2.0, gain=0.5):
        """Ridged multifractal: sharp crests, good for mesas and rocky spines."""
        amp = 1.0
        freq = 1.0
        total = 0.0
        norm = 0.0
        for _ in range(octaves):
            n = 1.0 - abs(self.noise(x * freq, y * freq))
            total += n * n * amp
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm


def smoothstep(edge0, edge1, x):
    if edge1 == edge0:
        return 0.0 if x < edge0 else 1.0
    t = (x - edge0) / (edge1 - edge0)
    t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(v, lo, hi):
    return lo if v < lo else (hi if v > hi else v)
