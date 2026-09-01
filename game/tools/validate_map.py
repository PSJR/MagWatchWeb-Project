#!/usr/bin/env python3
"""Sanity checks on the generated map data.

Run after gen_forest_map.py; exits non-zero if anything is off.
"""

import json
import os
import struct
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import kit
from terrain import HEIGHT_MAX, HEIGHT_MIN, HeightField, WORLD_SIZE

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Legs and ladders are stacked downwards on purpose so the bottom section is
# buried; everything else has to keep its geometry above the surface.
BURIED_BY_DESIGN = {"building-structure", "ladder"}


def load_field():
    path = os.path.join(ROOT, "assets", "textures", "heightmap_2k.u16.bin")
    raw = open(path, "rb").read()
    q = struct.unpack("<%dH" % (len(raw) // 2), raw)
    span = HEIGHT_MAX - HEIGHT_MIN
    return HeightField([HEIGHT_MIN + v / 65535.0 * span for v in q])


def main():
    field = load_field()
    world = json.load(open(os.path.join(ROOT, "data", "forest_map_2k.json")))
    scatter = json.load(open(os.path.join(ROOT, "data", "forest_map_2k.scatter.json")))
    errors = []

    if world["world"]["size_m"] != [2000.0, 2000.0]:
        errors.append("world is not 2000 x 2000 m: %s" % world["world"]["size_m"])

    zones = {z["id"] for z in world["zones"]}
    if zones != {"A", "B", "C", "D"}:
        errors.append("expected exactly four zones, got %s" % sorted(zones))
    for z in world["zones"]:
        x0, z0, x1, z1 = z["bounds"]
        if (x1 - x0) * (z1 - z0) != 1_000_000:
            errors.append("zone %s is not 1 km2" % z["id"])

    for lm in world["landmarks"]:
        if not (0 <= lm["x"] <= WORLD_SIZE and 0 <= lm["z"] <= WORLD_SIZE):
            errors.append("landmark %s is outside the map" % lm["id"])

    sunk = [s for s in world["structures"]
            if s["model"] not in BURIED_BY_DESIGN
            and s["pos"][1] < field.at(s["pos"][0], s["pos"][2]) - 1.5]
    if sunk:
        errors.append("%d structure instances have visible geometry below terrain "
                      "(first: %s at %s)" % (len(sunk), sunk[0]["model"], sunk[0]["pos"]))

    off = 0
    floating = 0
    for layer in scatter["layers"]:
        d, stride = layer["data"], layer["stride"]
        if len(d) != layer["count"] * stride:
            errors.append("layer %s count does not match data length" % layer["model"])
        # Models whose origin sits inside their own volume are lifted at
        # placement time; back that offset out before comparing to the ground.
        lift = kit.MODEL_Y_OFFSET.get(layer["model"], 0.0)
        for i in range(0, len(d), stride):
            x, y, z = d[i], d[i + 1], d[i + 2]
            if not (0 <= x <= WORLD_SIZE and 0 <= z <= WORLD_SIZE):
                off += 1
            if abs(y - lift * d[i + 4] - field.at(x, z)) > 0.5:
                floating += 1
    if off:
        errors.append("%d scatter instances are outside the map" % off)
    if floating:
        errors.append("%d scatter instances are not sitting on the terrain" % floating)

    for group in ("models", "textures"):
        base = os.path.join(ROOT, "assets", group)
        if not os.path.isdir(base):
            errors.append("missing assets/%s" % group)
    referenced = {(s["group"], s["model"]) for s in world["structures"]}
    referenced |= {(l["group"], l["model"]) for l in scatter["layers"]}
    for grp, model in sorted(referenced):
        path = os.path.join(ROOT, "assets", "models", grp, model + ".glb")
        if not os.path.exists(path):
            errors.append("referenced model is missing: %s" % path)

    counts = world["counts"]
    total = counts["structure_instances"] + counts["scatter_instances"]
    print("zones           : %d" % len(world["zones"]))
    print("landmarks       : %d" % counts["landmarks"])
    print("structures      : %d" % counts["structure_instances"])
    print("scatter         : %d" % counts["scatter_instances"])
    print("total instances : %d" % total)
    print("models used     : %d" % len(referenced))

    if errors:
        print("\nFAILED:")
        for e in errors:
            print("  - " + e)
        return 1
    print("\nOK - all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
