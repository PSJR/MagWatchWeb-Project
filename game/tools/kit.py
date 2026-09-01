"""Placement helpers for the Kenney Mini Forest kit.

The kit is authored on a 1-unit tile. ASSET_SCALE turns that into game metres:
at 6.0 a `tree` stands 10.1 m, a `platform` tile is 6 m square and one
`building-structure` leg section is exactly one 6 m storey, so towers,
ladders and bridge decks all land on the same vertical grid.
"""

import math

ASSET_SCALE = 6.0

# Local-space size of each model, in kit units (X, Y, Z).
MODEL_SIZE = {
    "bridge": (1.04, 0.47, 0.80),
    "building-platform": (1.30, 0.50, 1.30),
    "building-roof": (1.34, 1.05, 1.17),
    "building-structure": (1.00, 1.00, 1.00),
    "character-archer": (0.78, 0.82, 0.47),
    "fence": (1.10, 0.40, 0.25),
    "flag": (0.43, 0.75, 0.16),
    "ladder": (0.50, 1.00, 0.14),
    "patch-dirt": (1.00, 0.10, 1.00),
    "patch-grass": (1.00, 0.17, 1.00),
    "plant": (0.40, 0.19, 0.43),
    "platform": (1.00, 0.47, 1.00),
    "rocks-high": (1.00, 1.00, 1.00),
    "rocks-low": (1.00, 0.52, 1.00),
    "rocks-ramp": (1.00, 0.50, 1.00),
    "stones": (0.90, 0.45, 0.85),
    "target": (0.55, 0.58, 0.47),
    "tent": (1.26, 1.00, 1.07),
    "tree-high": (0.93, 2.28, 0.88),
    "tree": (0.93, 1.68, 0.88),
    "weapon-arrow": (0.12, 0.12, 0.46),
    "weapon-bow": (0.12, 0.48, 0.21),
}

# Models whose origin is not on their own footprint; added to Y at placement.
MODEL_Y_OFFSET = {"rocks-high": 0.5, "plant": 0.02, "weapon-arrow": 0.06}

# Folder each model was filed under, mirrored by assets/models/<group>/.
MODEL_GROUP = {
    "tree": "nature", "tree-high": "nature", "plant": "nature",
    "patch-grass": "nature", "patch-dirt": "nature", "stones": "nature",
    "rocks-low": "nature", "rocks-high": "nature", "rocks-ramp": "nature",
    "building-structure": "structures", "building-platform": "structures",
    "building-roof": "structures", "platform": "structures", "ladder": "structures",
    "bridge": "structures", "fence": "structures", "flag": "structures",
    "tent": "props", "target": "props",
    "character-archer": "characters",
    "weapon-bow": "weapons", "weapon-arrow": "weapons",
}

# Foliage reacts to wind in the shader; everything else is rigid.
WIND_MODELS = {"tree", "tree-high", "plant", "patch-grass", "flag", "tent"}


def unit(model, axis="Y"):
    """Size of a model along one axis, in metres at ASSET_SCALE."""
    return MODEL_SIZE[model]["XYZ".index(axis)] * ASSET_SCALE


class Builder:
    """Collects placed instances for one landmark."""

    def __init__(self, field, landmark_id):
        self.field = field
        self.landmark_id = landmark_id
        self.items = []

    def place(self, model, x, z, y=None, ry=0.0, scale=1.0, tilt=0.0):
        """Place one instance. `y` defaults to the terrain surface."""
        if y is None:
            y = self.field.at(x, z)
        s = ASSET_SCALE * scale
        y += MODEL_Y_OFFSET.get(model, 0.0) * s
        self.items.append({
            "model": model,
            "group": MODEL_GROUP[model],
            "pos": [round(x, 2), round(y, 2), round(z, 2)],
            "ry": round(ry % 360.0, 1),
            "scale": round(s, 3),
            "tilt": round(tilt, 1),
            "wind": model in WIND_MODELS,
            "landmark": self.landmark_id,
        })
        return self.items[-1]

    # -- composite pieces ---------------------------------------------------
    def tower(self, x, z, storeys=3, ry=0.0, roof=True, flag=True, ladders=True, scale=1.0):
        """Wooden watchtower: stacked leg sections, deck, optional roof + flag."""
        ground = self.field.at(x, z)
        leg = unit("building-structure", "Y") * scale
        for i in range(storeys):
            self.place("building-structure", x, z, y=ground + i * leg, ry=ry, scale=scale)
        deck_y = ground + storeys * leg
        self.place("building-platform", x, z, y=deck_y, ry=ry, scale=scale)
        deck_top = deck_y + unit("building-platform", "Y") * scale
        if roof:
            self.place("building-roof", x, z, y=deck_top, ry=ry, scale=scale)
        if flag:
            fx, fz = self._offset(x, z, ry, unit("building-platform", "X") * scale * 0.36, 0)
            self.place("flag", fx, fz, y=deck_top, ry=ry + 90, scale=scale * 0.9)
        if ladders:
            off = unit("building-structure", "X") * scale * 0.52
            lx, lz = self._offset(x, z, ry, 0, -off)
            for i in range(storeys):
                self.place("ladder", lx, lz, y=ground + i * leg, ry=ry, scale=scale)
        return deck_top

    def platform_deck(self, x, z, cols, rows, deck_y, ry=0.0, legs=True, scale=1.0):
        """A rectangular elevated deck of `platform` tiles on leg stacks."""
        tile = unit("platform", "X") * scale
        leg = unit("building-structure", "Y") * scale
        top = deck_y + unit("platform", "Y") * scale
        for cx in range(cols):
            for cz in range(rows):
                ox = (cx - (cols - 1) / 2.0) * tile
                oz = (cz - (rows - 1) / 2.0) * tile
                px, pz = self._offset(x, z, ry, ox, oz)
                self.place("platform", px, pz, y=deck_y, ry=ry, scale=scale)
                if legs and (cx in (0, cols - 1) or cz in (0, rows - 1)):
                    ground = self.field.at(px, pz)
                    n = max(1, int(round((deck_y - ground) / leg)))
                    for i in range(n):
                        y = deck_y - (i + 1) * leg
                        if y + leg <= ground:
                            break
                        self.place("building-structure", px, pz, y=y, ry=ry, scale=scale)
        return top

    def rope_bridge(self, ax, az, bx, bz, deck_y=None, scale=1.0, sag=0.0):
        """Chain of `bridge` modules from A to B, optionally sagging in the middle."""
        span = math.hypot(bx - ax, bz - az)
        seg = unit("bridge", "X") * scale
        n = max(1, int(round(span / seg)))
        ry = math.degrees(math.atan2(bx - ax, bz - az)) + 90.0
        ya = self.field.at(ax, az) if deck_y is None else deck_y
        yb = self.field.at(bx, bz) if deck_y is None else deck_y
        for i in range(n):
            t = (i + 0.5) / n
            px = ax + (bx - ax) * t
            pz = az + (bz - az) * t
            py = ya + (yb - ya) * t - sag * math.sin(math.pi * t)
            self.place("bridge", px, pz, y=py, ry=ry, scale=scale)
        return ry

    def fence_run(self, points, scale=1.0, gap=0.0):
        seg = unit("fence", "X") * scale + gap
        for i in range(len(points) - 1):
            ax, az = points[i]
            bx, bz = points[i + 1]
            span = math.hypot(bx - ax, bz - az)
            n = max(1, int(round(span / seg)))
            ry = math.degrees(math.atan2(bx - ax, bz - az)) + 90.0
            for j in range(n):
                t = (j + 0.5) / n
                self.place("fence", ax + (bx - ax) * t, az + (bz - az) * t, ry=ry, scale=scale)

    def camp_ring(self, x, z, tents, radius, rng, scale=1.0):
        """Blue tents facing a central fire ring, on trodden dirt."""
        for i in range(tents):
            a = 2 * math.pi * i / tents + rng.uniform(-0.12, 0.12)
            tx = x + math.cos(a) * radius
            tz = z + math.sin(a) * radius
            self.place("tent", tx, tz, ry=math.degrees(-a) + 90, scale=scale * rng.uniform(0.94, 1.08))
            self.place("patch-dirt", tx, tz, ry=rng.uniform(0, 360), scale=scale * 1.5)
        for i in range(7):
            a = 2 * math.pi * i / 7
            self.place("stones", x + math.cos(a) * 4.2, z + math.sin(a) * 4.2,
                       ry=rng.uniform(0, 360), scale=scale * 0.42)
        self.place("patch-dirt", x, z, scale=scale * 2.6)
        self.place("flag", x, z, ry=rng.uniform(0, 360), scale=scale * 1.2)

    def archery_lane(self, x, z, heading, targets, spacing, rng, scale=1.0):
        """Firing line of archers with a row of targets down-range."""
        rad = math.radians(heading)
        fx, fz = math.sin(rad), math.cos(rad)          # forward
        sx, sz = math.cos(rad), -math.sin(rad)         # right
        for i in range(targets):
            off = (i - (targets - 1) / 2.0) * spacing
            tx = x + fx * 46.0 + sx * off
            tz = z + fz * 46.0 + sz * off
            self.place("target", tx, tz, ry=heading + 180, scale=scale * 1.15)
            self.place("patch-grass", tx, tz, ry=rng.uniform(0, 360), scale=scale * 1.2)
        for i in range(min(targets, 3)):
            off = (i - 1) * spacing
            ax_, az_ = x + sx * off, z + sz * off
            self.place("character-archer", ax_, az_, ry=heading, scale=scale)
            self.place("weapon-bow", ax_ + sx * 1.6, az_ + sz * 1.6,
                       y=self.field.at(ax_, az_) + 2.6, ry=heading, scale=scale * 0.9)
        self.place("patch-dirt", x, z, scale=scale * 3.0)

    def rock_cluster(self, x, z, rng, count=6, spread=22.0, scale=1.0):
        for _ in range(count):
            a = rng.uniform(0, 2 * math.pi)
            r = rng.uniform(0, spread)
            model = rng.choice(["rocks-low", "rocks-high", "rocks-ramp", "stones"])
            self.place(model, x + math.cos(a) * r, z + math.sin(a) * r,
                       ry=rng.uniform(0, 360), scale=scale * rng.uniform(0.7, 1.9))

    def stair_ramp(self, x, z, ry, steps, rise, scale=1.0):
        """Rock ramps climbing a slope, the walkable route up a cliff."""
        ground = self.field.at(x, z)
        run = unit("rocks-ramp", "Z") * scale * 0.9
        rad = math.radians(ry)
        for i in range(steps):
            px = x + math.sin(rad) * run * i
            pz = z + math.cos(rad) * run * i
            self.place("rocks-ramp", px, pz, y=ground + rise * i, ry=ry, scale=scale)

    @staticmethod
    def _offset(x, z, ry, ox, oz):
        rad = math.radians(ry)
        c, s = math.cos(rad), math.sin(rad)
        return x + ox * c + oz * s, z - ox * s + oz * c
