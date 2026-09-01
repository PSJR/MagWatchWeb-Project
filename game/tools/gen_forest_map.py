#!/usr/bin/env python3
"""Build the 2 km x 2 km low-poly forest map.

Outputs (all under game/):
  assets/textures/heightmap_2k.png   16-bit height, 0..150 m over 1024x1024
  assets/textures/splatmap_2k.png    RGBA = grass / dirt / rock / moss weights
  assets/textures/minimap_2k.png     shaded top-down preview, north up
  data/forest_map_2k.json            world config, zones, water, landmarks, structures
  data/forest_map_2k.scatter.json    instanced vegetation and rock layers

Run:  python3 game/tools/gen_forest_map.py
"""

import json
import math
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit
import landmarks as lm_mod
import pngwrite
from noise import Perlin, clamp, lerp, smoothstep
from terrain import (HEIGHTMAP_RES, HEIGHT_MAX, HEIGHT_MIN, LAKES, RIVERS, SEED, lake_outline,
                     WORLD_SIZE, ZONE_NAMES, ZONES, HeightField, Terrain,
                     zone_at, zone_weights)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(ROOT, "assets", "textures")
DATA_DIR = os.path.join(ROOT, "data")

_TERRAIN = None
_FIELD = None
_GRAIN = None

STEP = WORLD_SIZE / (HEIGHTMAP_RES - 1)


def _init_terrain(terrain):
    global _TERRAIN
    _TERRAIN = terrain


def _init_field(field):
    global _FIELD, _GRAIN
    _FIELD = field
    _GRAIN = Perlin(SEED + 909)


def _map_rows(fn, initializer, arg, count):
    """Row-parallel map with a single-process fallback."""
    try:
        import multiprocessing as mp
        workers = min(8, mp.cpu_count())
        if workers > 1:
            with mp.Pool(workers, initializer=initializer, initargs=(arg,)) as pool:
                return pool.map(fn, range(count), chunksize=8)
    except Exception:
        pass
    initializer(arg)
    return [fn(j) for j in range(count)]


def _bake_row(j):
    z = j * STEP
    return [_TERRAIN.height(i * STEP, z) for i in range(HEIGHTMAP_RES)]


def bake_heightmap(terrain):
    rows = _map_rows(_bake_row, _init_terrain, terrain, HEIGHTMAP_RES)
    grid = [h for row in rows for h in row]
    span = HEIGHT_MAX - HEIGHT_MIN
    quant = [int(round(clamp((h - HEIGHT_MIN) / span, 0.0, 1.0) * 65535)) for h in grid]
    # Sample from the quantised values so runtime terrain and props agree exactly.
    dequant = [HEIGHT_MIN + (q / 65535.0) * span for q in quant]
    return quant, HeightField(dequant)


def write_heightmap(quant):
    # PNG row 0 is the north edge, so flip Z for a north-up texture.
    r = HEIGHTMAP_RES
    flipped = []
    for j in range(r - 1, -1, -1):
        flipped.extend(quant[j * r:(j + 1) * r])
    pngwrite.write_gray16(os.path.join(TEX_DIR, "heightmap_2k.png"), r, r, flipped)
    # Raw little-endian u16, row 0 at z=0. Browsers decode 16-bit PNG down to
    # 8 bits through <canvas>, which bands the terrain, so the web viewer reads
    # this instead. Engines import the PNG.
    import struct
    with open(os.path.join(TEX_DIR, "heightmap_2k.u16.bin"), "wb") as fh:
        fh.write(struct.pack("<%dH" % len(quant), *quant))


def _splat_row(j):
    """RGBA weights: R grass, G dirt/shore, B rock, A dark forest moss."""
    field, grain = _FIELD, _GRAIN
    z = (HEIGHTMAP_RES - 1 - j) * STEP
    out = []
    for i in range(HEIGHTMAP_RES):
        x = i * STEP
        slope = field.slope(x, z)
        depth = field.water_depth(x, z)
        n = grain.fbm(x / 90.0, z / 90.0, octaves=3)

        rock = smoothstep(20.0, 40.0, slope + n * 9.0)
        shore = smoothstep(-9.0, 1.0, depth) * (1.0 - rock)
        moss = zone_weights(x, z)["C"] * 0.75 * (1.0 - rock) * (1.0 - shore)
        grass = max(0.0, 1.0 - rock - shore - moss)
        total = rock + shore + moss + grass or 1.0
        out.extend([
            int(grass / total * 255), int(shore / total * 255),
            int(rock / total * 255), int(moss / total * 255),
        ])
    return out


def build_splatmap(field):
    rows = _map_rows(_splat_row, _init_field, field, HEIGHTMAP_RES)
    px = [v for row in rows for v in row]
    pngwrite.write_rgba8(os.path.join(TEX_DIR, "splatmap_2k.png"), HEIGHTMAP_RES, HEIGHTMAP_RES, px)


MINIMAP_PALETTE = {
    "A": (126, 186, 96), "B": (150, 143, 176),
    "C": (72, 130, 88), "D": (168, 196, 108),
}


def _minimap_row(j):
    """Shaded top-down preview: biome tint + hillshade + water."""
    field = _FIELD
    step = STEP
    palette = MINIMAP_PALETTE
    z = (HEIGHTMAP_RES - 1 - j) * step
    px = []
    if True:
        for i in range(HEIGHTMAP_RES):
            x = i * step
            w = zone_weights(x, z)
            col = [sum(w[k] * palette[k][c] for k in palette) for c in range(3)]

            h = field.at(x, z)
            slope = field.slope(x, z)
            if slope > 30:
                k = smoothstep(30, 48, slope)
                col = [lerp(c, 122 + 18 * idx, k * 0.85) for idx, c in enumerate(col)]

            # Lambert-ish hillshade from the NW key light.
            dx = (field.at(x + step, z) - field.at(x - step, z)) / (2 * step)
            dz = (field.at(x, z + step) - field.at(x, z - step)) / (2 * step)
            shade = clamp(0.62 + 0.5 * (-dx * 0.7 + dz * 0.7) / max(0.35, math.hypot(dx, dz, 1.0)), 0.45, 1.35)
            col = [c * shade for c in col]

            depth = field.water_depth(x, z)
            if depth > -0.4:
                k = clamp(0.45 + depth * 0.11, 0.45, 0.92)
                col = [lerp(c, v, k) for c, v in zip(col, (56, 132, 196))]

            col = [lerp(c, 255, clamp((h - 110) / 70.0, 0.0, 0.35)) for c in col]
            px.extend([int(clamp(c, 0, 255)) for c in col] + [255])
    return px


def build_minimap(field):
    rows = _map_rows(_minimap_row, _init_field, field, HEIGHTMAP_RES)
    px = [v for row in rows for v in row]
    pngwrite.write_rgba8(os.path.join(TEX_DIR, "minimap_2k.png"), HEIGHTMAP_RES, HEIGHTMAP_RES, px)


# --- scatter ---------------------------------------------------------------
# Per-zone vegetation recipe. `cell` is the jittered-grid spacing in metres:
# smaller cell = denser. `mix` is the weighted model palette.
SCATTER_RULES = {
    "A": {"cell": 15.0, "density": 0.55, "max_slope": 30.0,
          "mix": [("tree", 62), ("tree-high", 18), ("plant", 12), ("stones", 8)]},
    "B": {"cell": 18.0, "density": 0.46, "max_slope": 26.0,
          "mix": [("tree-high", 34), ("tree", 26), ("rocks-low", 18),
                  ("rocks-high", 12), ("plant", 10)]},
    "C": {"cell": 11.0, "density": 0.88, "max_slope": 34.0,
          "mix": [("tree-high", 58), ("tree", 30), ("plant", 8), ("stones", 4)]},
    "D": {"cell": 21.0, "density": 0.38, "max_slope": 28.0,
          "mix": [("tree", 44), ("plant", 24), ("rocks-low", 18), ("tree-high", 14)]},
}

GROUND_COVER = {"cell": 15.0, "density": 0.55, "max_slope": 34.0,
                "mix": [("patch-grass", 72), ("plant", 24), ("patch-dirt", 4)]}

# Axis-aligned quadrant bounds (x0, z0, x1, z1) so scatter only walks its own zone.
ZONE_BOUNDS = {
    "A": (0.0, 1000.0, 1000.0, 2000.0), "B": (1000.0, 1000.0, 2000.0, 2000.0),
    "C": (0.0, 0.0, 1000.0, 1000.0), "D": (1000.0, 0.0, 2000.0, 1000.0),
}


def _weighted(mix, rng):
    total = sum(w for _, w in mix)
    pick = rng.uniform(0, total)
    acc = 0
    for model, w in mix:
        acc += w
        if pick <= acc:
            return model
    return mix[-1][0]


GROUND_COVER_MODELS = {"patch-grass", "patch-dirt", "plant"}


def scatter(field, clear_discs, rng):
    """Jittered-grid scatter, masked by slope, water and landmark clearings."""
    clutter = Perlin(SEED + 555)
    layers = {}

    def emit(model, x, y, z, ry, scale):
        layers.setdefault(model, []).extend([round(x, 2), round(y, 2), round(z, 2),
                                             round(ry, 1), round(scale, 3)])

    def blocked(x, z):
        for cx, cz, cr in clear_discs:
            if (x - cx) ** 2 + (z - cz) ** 2 < cr * cr:
                return True
        return False

    for rules, is_cover in ((SCATTER_RULES, False), ({z: GROUND_COVER for z in SCATTER_RULES}, True)):
        for zone, rule in rules.items():
            cell = rule["cell"]
            x0, z0, x1, z1 = ZONE_BOUNDS[zone]
            for gi in range(int((x1 - x0) / cell)):
                for gj in range(int((z1 - z0) / cell)):
                    x = x0 + (gi + rng.uniform(0.08, 0.92)) * cell
                    z = z0 + (gj + rng.uniform(0.08, 0.92)) * cell
                    # Clumping: noise makes groves and clearings instead of a lawn.
                    p = rule["density"] * (0.45 + 0.85 * (clutter.fbm(x / 210.0, z / 210.0, octaves=3) + 0.55))
                    if rng.random() > p:
                        continue
                    if field.water_depth(x, z) > -1.2:
                        continue
                    if field.slope(x, z) > rule["max_slope"]:
                        continue
                    inside_clearing = blocked(x, z)
                    if inside_clearing and not is_cover:
                        continue
                    if inside_clearing and rng.random() > 0.45:
                        continue          # thinner cover on trodden ground
                    model = _weighted(rule["mix"], rng)
                    if inside_clearing and model not in GROUND_COVER_MODELS:
                        continue
                    s = kit.ASSET_SCALE * rng.uniform(0.72, 1.34)
                    if model in ("patch-grass", "patch-dirt"):
                        s = kit.ASSET_SCALE * rng.uniform(0.8, 1.6)
                    y = field.at(x, z) + kit.MODEL_Y_OFFSET.get(model, 0.0) * s
                    emit(model, x, y, z, rng.uniform(0, 360), s)

    return [{
        "model": model,
        "group": kit.MODEL_GROUP[model],
        "wind": model in kit.WIND_MODELS,
        "stride": 5,
        "format": ["x", "y", "z", "ry_deg", "scale"],
        "count": len(data) // 5,
        "data": data,
    } for model, data in sorted(layers.items())]


# --- main ------------------------------------------------------------------
def main():
    t0 = time.time()
    os.makedirs(TEX_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    terrain = Terrain()
    # Pass 1: register levelling pads so camps and arenas bake in flat.
    for lm in lm_mod.LANDMARKS:
        if lm.get("pad"):
            terrain.add_pad(lm["x"], lm["z"], lm["pad"][0], lm["pad"][1])

    print("baking heightmap %dx%d ..." % (HEIGHTMAP_RES, HEIGHTMAP_RES))
    quant, field = bake_heightmap(terrain)
    write_heightmap(quant)
    print("  height %.1f s" % (time.time() - t0))

    build_splatmap(field)
    build_minimap(field)
    print("  textures %.1f s" % (time.time() - t0))

    # Pass 2: stamp landmarks against the baked field.
    structures = []
    lm_out = []
    for lm in lm_mod.LANDMARKS:
        rng = random.Random(SEED + sum(ord(c) for c in lm["id"]) * 7919)
        count = 0
        if lm["build"]:
            b = kit.Builder(field, lm["id"])
            lm["build"](b, lm, rng)
            structures.extend(b.items)
            count = len(b.items)
        lm_out.append({
            "id": lm["id"], "name": lm["name"], "zone": lm["zone"], "kind": lm["kind"],
            "x": lm["x"], "z": lm["z"], "y": round(field.at(lm["x"], lm["z"]), 2),
            "pad_radius": lm["pad"][0] if lm.get("pad") else None,
            "instances": count,
            "description": lm["desc"],
        })

    clear_discs = [(lm["x"], lm["z"], (lm["pad"][0] + 14.0) if lm.get("pad") else 46.0)
                   for lm in lm_mod.LANDMARKS]
    clear_discs += [(l["x"], l["z"], l["radius"] + 12.0) for l in LAKES]

    rng = random.Random(SEED + 4242)
    layers = scatter(field, clear_discs, rng)
    total_scatter = sum(l["count"] for l in layers)
    print("  landmarks %d instances, scatter %d instances" % (len(structures), total_scatter))

    world = {
        "name": "Floresta de Vale Alto",
        "style": "low-poly cartoon (Kenney Mini Forest 1.0, CC0)",
        "generator": "game/tools/gen_forest_map.py",
        "seed": SEED,
        "world": {
            "size_m": [WORLD_SIZE, WORLD_SIZE],
            "origin": "south-west corner is (0,0); X grows east, Z grows north, Y is up",
            "height_range_m": [HEIGHT_MIN, HEIGHT_MAX],
            "asset_scale": kit.ASSET_SCALE,
            "heightmap": {
                "file": "assets/textures/heightmap_2k.png",
                "raw_file": "assets/textures/heightmap_2k.u16.bin",
                "resolution": HEIGHTMAP_RES,
                "bit_depth": 16,
                "encoding": "y = height_range_m[0] + (pixel/65535) * (max-min)",
                "orientation": "row 0 is z=2000 (north); flip V when sampling",
            },
            "splatmap": {"file": "assets/textures/splatmap_2k.png",
                         "channels": ["grass", "dirt_shore", "rock", "moss"]},
            "minimap": {"file": "assets/textures/minimap_2k.png"},
        },
        "wind": {
            "direction_deg": 240.0,
            "speed": 1.0,
            "gust_amplitude": 0.45,
            "gust_frequency_hz": 0.11,
            "sway_scale_m": 34.0,
            "note": "Applied in the vertex shader to every instance flagged wind=true; "
                    "displacement is weighted by height above the instance origin.",
        },
        "lighting": {
            "sun_elevation_deg": 46.0,
            "sun_azimuth_deg": 128.0,
            "sun_color": "#fff3d6",
            "ambient_sky": "#a9d4ff",
            "ambient_ground": "#6f8a52",
            "fog": {"color": "#c9e6f5", "near": 420.0, "far": 2400.0},
        },
        "zones": [
            {
                "id": zid,
                "name": ZONE_NAMES[zid],
                "bounds": bounds,
                "area_km2": 1.0,
                "base_height_m": ZONES[zid]["base"],
                "relief_amplitude_m": ZONES[zid]["amp"],
            }
            for zid, bounds in (
                ("A", [0, 1000, 1000, 2000]), ("B", [1000, 1000, 2000, 2000]),
                ("C", [0, 0, 1000, 1000]), ("D", [1000, 0, 2000, 1000]))
        ],
        "rivers": [{
            "id": r["id"], "name": r["name"],
            "control_points": r["control_points"],
            "centerline": [[round(px, 1), round(pz, 1)] for px, pz in r["points"]],
            "elevation": r["elevation"], "half_width": r["half_width"],
            "bank": r["bank"], "depth": r["depth"],
        } for r in RIVERS],
        "lakes": [dict(lake, outline=[[round(px, 1), round(pz, 1)]
                                     for px, pz in lake_outline(lake)]) for lake in LAKES],
        "landmarks": lm_out,
        "structures": structures,
        "counts": {
            "landmarks": len(lm_out),
            "structure_instances": len(structures),
            "scatter_instances": total_scatter,
        },
    }

    with open(os.path.join(DATA_DIR, "forest_map_2k.json"), "w") as fh:
        json.dump(world, fh, indent=1)
    with open(os.path.join(DATA_DIR, "forest_map_2k.scatter.json"), "w") as fh:
        json.dump({"asset_scale": kit.ASSET_SCALE, "layers": layers}, fh, separators=(",", ":"))

    print("done in %.1f s" % (time.time() - t0))


if __name__ == "__main__":
    main()
