"""Terrain field for the 2 km x 2 km low-poly forest map.

World space: X east, Z north, Y up. The playable square is (0,0)..(2000,2000).
Height is analytic and deterministic, then baked to a 16-bit heightmap; every
prop is placed against the *baked* field so the runtime terrain and the props
agree exactly.
"""

import math

from noise import Perlin, clamp, lerp, smoothstep

WORLD_SIZE = 2000.0
HEIGHT_MIN = 0.0
HEIGHT_MAX = 150.0
HEIGHTMAP_RES = 1024

SEED = 20260901

# --- zone macro shape -------------------------------------------------------
# base / amplitude per quadrant, blended smoothly so the seams read as one
# continuous landscape rather than four tiles.
ZONES = {
    "A": {"base": 30.0, "amp": 13.0},   # NW - Vale das Tendas
    "B": {"base": 92.0, "amp": 30.0},   # NE - Planalto das Torres
    "C": {"base": 42.0, "amp": 20.0},   # SW - Mata Antiga
    "D": {"base": 16.0, "amp": 8.0},    # SE - Campos de Treino
}

BLEND = 620.0  # metres of cross-fade around the x=1000 / z=1000 seams


def zone_weights(x, z):
    east = smoothstep(1000.0 - BLEND * 0.5, 1000.0 + BLEND * 0.5, x)
    north = smoothstep(1000.0 - BLEND * 0.5, 1000.0 + BLEND * 0.5, z)
    return {
        "A": (1.0 - east) * north,
        "B": east * north,
        "C": (1.0 - east) * (1.0 - north),
        "D": east * (1.0 - north),
    }


def zone_at(x, z):
    """Hard quadrant label, used for tagging landmarks and scatter."""
    return ("B" if x >= 1000.0 else "A") if z >= 1000.0 else ("D" if x >= 1000.0 else "C")


ZONE_NAMES = {
    "A": "Vale das Tendas",
    "B": "Planalto das Torres",
    "C": "Mata Antiga",
    "D": "Campos de Treino",
}


# --- watercourses -----------------------------------------------------------
# Each river is a polyline plus a downstream elevation profile. Rivers are the
# natural borders between the four zones, and the bridges over them are the
# connections.
RIVERS = [
    {
        "id": "rio-prateado",
        "name": "Rio Prateado",
        "points": [(1010, 2000), (985, 1830), (1035, 1690), (1000, 1520), (955, 1380),
                   (1010, 1230), (1030, 1090), (995, 1000), (960, 880), (1020, 740),
                   (1045, 600), (1000, 460), (960, 300), (1005, 150), (985, 0)],
        "elevation": [62, 56, 50, 45, 40, 36, 32, 30, 24, 19, 14, 10, 7, 4, 2],
        "half_width": 15.0,
        "bank": 46.0,
        "depth": 4.5,
    },
    {
        "id": "corrego-escarpa",
        "name": "Corrego da Escarpa",
        "points": [(0, 1080), (150, 1055), (300, 1035), (430, 1000), (560, 1012),
                   (700, 1030), (830, 1010), (940, 1002)],
        "elevation": [52, 48, 44, 41, 38, 35, 32, 30],
        "half_width": 9.0,
        "bank": 30.0,
        "depth": 8.0,
    },
    {
        "id": "ribeira-falcao",
        "name": "Ribeira do Falcao",
        "points": [(2000, 1140), (1870, 1105), (1740, 1060), (1610, 1075), (1480, 1050),
                   (1400, 1030), (1280, 1010), (1150, 1000), (1040, 998)],
        "elevation": [88, 84, 79, 74, 68, 52, 40, 33, 30],
        "half_width": 11.0,
        "bank": 34.0,
        "depth": 5.5,
    },
]

# Circular bowls holding still water.
LAKES = [
    {"id": "lago-espelho", "name": "Lago Espelho", "x": 430, "z": 1700,
     "radius": 165.0, "shore": 90.0, "level": 24.0, "depth": 7.0,
     "shape": [(3, 0.115, 0.7), (5, 0.070, 2.4), (8, 0.038, 4.1)]},
    {"id": "tarn-falcao", "name": "Espelho do Falcao", "x": 1815, "z": 1795,
     "radius": 62.0, "shore": 40.0, "level": 118.0, "depth": 4.0,
     "shape": [(3, 0.140, 1.9), (6, 0.065, 0.3)]},
]


def lake_radius(lake, angle):
    """Shoreline radius at a bearing, so lakes are lobed rather than circular."""
    k = 1.0
    for harmonic, amp, phase in lake.get("shape", ()):
        k += amp * math.sin(harmonic * angle + phase)
    return lake["radius"] * k


def lake_outline(lake, segments=96):
    """Closed shoreline polygon, shared by the carve and the water mesh."""
    pts = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        r = lake_radius(lake, a)
        pts.append((lake["x"] + math.cos(a) * r, lake["z"] + math.sin(a) * r))
    return pts


def catmull_rom(points, per_segment=10):
    """Resample authored control points into a smooth channel centreline.

    Rivers are authored with a handful of points; without smoothing the carve
    shows every control vertex as a visible kink.
    """
    if len(points) < 3:
        return list(points)
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(len(pts) - 3):
        p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
        for j in range(per_segment):
            t = j / per_segment
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t
                       + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                       + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)
                for k in (0, 1)))
    out.append(points[-1])
    return out


for _river in RIVERS:
    _river["control_points"] = list(_river["points"])
    _river["points"] = catmull_rom(_river["points"])


class Polyline:
    """Cached polyline with a uniform-grid index for fast nearest-point queries.

    The heightmap bake asks for the distance to every watercourse a million
    times, so the segment table and its spatial index are built once.
    """

    CELL = 96.0

    def __init__(self, points):
        self.points = list(points)
        self.segs = []
        total = 0.0
        for i in range(len(points) - 1):
            ax, az = points[i]
            bx, bz = points[i + 1]
            L = math.hypot(bx - ax, bz - az)
            self.segs.append((ax, az, bx - ax, bz - az, L * L, total, L))
            total += L
        self.total = total or 1.0

        self.grid = {}
        reach = self.CELL  # segments within one cell of a query are candidates
        for idx, (ax, az, dx, dz, _, _, L) in enumerate(self.segs):
            steps = max(1, int(L / (self.CELL * 0.5)) + 1)
            for k in range(steps + 1):
                t = k / steps
                cx = int((ax + dx * t - reach) // self.CELL)
                cz = int((az + dz * t - reach) // self.CELL)
                for ox in range(3):
                    for oz in range(3):
                        self.grid.setdefault((cx + ox, cz + oz), set()).add(idx)
        self.grid = {k: tuple(sorted(v)) for k, v in self.grid.items()}
        self.all_indices = tuple(range(len(self.segs)))

    def query(self, x, z):
        """Return (distance, normalised arclength position).

        The grid only guarantees the true nearest segment within one cell of the
        query, which covers every distance the carve and shore rules care about.
        Beyond that we fall back to the full scan so the value stays exact.
        """
        cand = self.grid.get((int(x // self.CELL), int(z // self.CELL)))
        if cand is None:
            cand = self.all_indices
        best_d2 = float("inf")
        best_pos = 0.0
        for idx in cand:
            ax, az, dx, dz, L2, off, L = self.segs[idx]
            t = 0.0 if L2 == 0 else clamp(((x - ax) * dx + (z - az) * dz) / L2, 0.0, 1.0)
            ex = x - (ax + dx * t)
            ez = z - (az + dz * t)
            d2 = ex * ex + ez * ez
            if d2 < best_d2:
                best_d2 = d2
                best_pos = (off + L * t) / self.total
        if best_d2 > self.CELL * self.CELL and cand is not self.all_indices:
            return self._full_query(x, z)
        return math.sqrt(best_d2), best_pos

    def _full_query(self, x, z):
        best_d2 = float("inf")
        best_pos = 0.0
        for ax, az, dx, dz, L2, off, L in self.segs:
            t = 0.0 if L2 == 0 else clamp(((x - ax) * dx + (z - az) * dz) / L2, 0.0, 1.0)
            ex = x - (ax + dx * t)
            ez = z - (az + dz * t)
            d2 = ex * ex + ez * ez
            if d2 < best_d2:
                best_d2 = d2
                best_pos = (off + L * t) / self.total
        return math.sqrt(best_d2), best_pos


_POLYLINE_CACHE = {}


def _polyline_distance(points, x, z):
    key = id(points)
    pl = _POLYLINE_CACHE.get(key)
    if pl is None:
        pl = _POLYLINE_CACHE[key] = Polyline(points)
    return pl.query(x, z)


def _profile(values, pos):
    if pos <= 0:
        return values[0]
    if pos >= 1:
        return values[-1]
    f = pos * (len(values) - 1)
    i = int(f)
    return lerp(values[i], values[min(i + 1, len(values) - 1)], f - i)


def river_surface(river, x, z):
    """Water surface elevation of a river at the nearest channel point."""
    _, pos = _polyline_distance(river["points"], x, z)
    return _profile(river["elevation"], pos)


class Terrain:
    def __init__(self, seed=SEED):
        self.macro = Perlin(seed)
        self.detail = Perlin(seed + 101)
        self.mesa = Perlin(seed + 202)
        self.rough = Perlin(seed + 303)
        self.pads = []

    # -- pads ---------------------------------------------------------------
    def add_pad(self, x, z, radius, falloff, target=None):
        """Level a disc of ground so a camp, arena or tower base sits flat."""
        if target is None:
            target = self.raw_height(x, z)
        self.pads.append((x, z, radius, falloff, target))
        return target

    # -- field --------------------------------------------------------------
    def raw_height(self, x, z):
        """Terrain before landmark pads are levelled in."""
        w = zone_weights(x, z)
        base = sum(w[k] * ZONES[k]["base"] for k in ZONES)
        amp = sum(w[k] * ZONES[k]["amp"] for k in ZONES)

        h = base + amp * self.macro.fbm(x / 640.0, z / 640.0, octaves=5) * 1.7
        h += 5.0 * self.detail.fbm(x / 155.0, z / 155.0, octaves=3) * 1.7
        h += 1.6 * self.rough.fbm(x / 42.0, z / 42.0, octaves=2) * 1.7

        # NE mesas: terraced ridged noise gives flat tops with hard cliff walls.
        # Terraced ridged noise: the riser is squeezed into the top 8% of each
        # step so the transition reads as a cliff wall, not a slope.
        ridge = self.mesa.ridged(x / 400.0, z / 400.0, octaves=4)
        steps = 4.0
        terraced = (math.floor(ridge * steps) + smoothstep(0.92, 0.998, (ridge * steps) % 1.0)) / steps
        h += w["B"] * 58.0 * terraced

        # Escarpa da Serra Velha: the SW plateau breaks off above the western
        # stream, facing north across the gorge.
        west = 1.0 - smoothstep(880.0, 1080.0, x)
        scarp_z = 1000.0 + 26.0 * self.detail.fbm(x / 300.0, 41.0, octaves=2)
        h += west * 27.0 * smoothstep(scarp_z + 34.0, scarp_z - 34.0, z)

        # Ravina do Musgo: a short mossy gash through the SW forest.
        d_rav, _ = _polyline_distance([(560, 620), (660, 520), (730, 430), (860, 360)], x, z)
        h -= 26.0 * (1.0 - smoothstep(14.0, 78.0, d_rav))

        # Pedreira Roxa: a raised rock shelf in the SE with a quarry bitten out
        # of its middle, so the pit floor stays above the meadow around it.
        d_q = math.hypot(x - 1840, z - 640)
        h += 36.0 * (1.0 - smoothstep(120.0, 360.0, d_q))
        h -= 30.0 * (1.0 - smoothstep(55.0, 165.0, d_q))

        h = self._carve_water(h, x, z)

        # Soft falloff to a low rim so the 2 km square has a readable border.
        edge = min(x, z, WORLD_SIZE - x, WORLD_SIZE - z)
        h = lerp(h * 0.78 + 4.0, h, smoothstep(0.0, 95.0, edge))
        return clamp(h, HEIGHT_MIN, HEIGHT_MAX)

    def _carve_water(self, h, x, z):
        for river in RIVERS:
            d, pos = _polyline_distance(river["points"], x, z)
            hw, bank = river["half_width"], river["bank"]
            if d >= hw + bank:
                continue
            bed = _profile(river["elevation"], pos)
            if d <= hw:
                floor = bed - river["depth"] * (1.0 - (d / hw) ** 2)
                h = lerp(h, floor, 1.0)
            else:
                k = 1.0 - smoothstep(hw, hw + bank, d)
                h = lerp(h, bed + 1.0, k)
        for lake in LAKES:
            dx, dz = x - lake["x"], z - lake["z"]
            d = math.hypot(dx, dz)
            if d >= lake["radius"] * 1.2 + lake["shore"]:
                continue
            r = lake_radius(lake, math.atan2(dz, dx))
            if d <= r:
                h = lake["level"] - lake["depth"] * (1.0 - (d / r) ** 2)
            else:
                k = 1.0 - smoothstep(r, r + lake["shore"], d)
                h = lerp(h, lake["level"] + 0.8, k)
        return h

    def height(self, x, z):
        h = self.raw_height(x, z)
        for px, pz, radius, falloff, target in self.pads:
            d = math.hypot(x - px, z - pz)
            if d >= radius + falloff:
                continue
            k = 1.0 - smoothstep(radius, radius + falloff, d)
            h = lerp(h, target, k)
        return clamp(h, HEIGHT_MIN, HEIGHT_MAX)


# --- baked heightmap sampling ----------------------------------------------
class HeightField:
    """Bilinear sampler over the baked 16-bit heightmap grid."""

    def __init__(self, grid, res=HEIGHTMAP_RES, size=WORLD_SIZE):
        self.grid = grid
        self.res = res
        self.size = size
        self.step = size / (res - 1)

    def at(self, x, z):
        fx = clamp(x / self.step, 0.0, self.res - 1.0001)
        fz = clamp(z / self.step, 0.0, self.res - 1.0001)
        x0, z0 = int(fx), int(fz)
        tx, tz = fx - x0, fz - z0
        g, r = self.grid, self.res
        h00 = g[z0 * r + x0]
        h10 = g[z0 * r + x0 + 1]
        h01 = g[(z0 + 1) * r + x0]
        h11 = g[(z0 + 1) * r + x0 + 1]
        return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz)

    def slope(self, x, z, eps=3.0):
        """Slope in degrees from central differences."""
        dx = (self.at(x + eps, z) - self.at(x - eps, z)) / (2 * eps)
        dz = (self.at(x, z + eps) - self.at(x, z - eps)) / (2 * eps)
        return math.degrees(math.atan(math.hypot(dx, dz)))

    def water_depth(self, x, z):
        """Positive when the point is under a river or lake surface."""
        h = self.at(x, z)
        best = -1e9
        for lake in LAKES:
            dx, dz = x - lake["x"], z - lake["z"]
            if math.hypot(dx, dz) <= lake_radius(lake, math.atan2(dz, dx)) + 6.0:
                best = max(best, lake["level"] - h)
        for river in RIVERS:
            d, pos = _polyline_distance(river["points"], x, z)
            if d <= river["half_width"] + 8.0:
                best = max(best, _profile(river["elevation"], pos) - h)
        return best
