"""Minimal PNG encoders (no Pillow dependency).

Only the two flavours the map pipeline needs: 16-bit greyscale for the
heightmap (2 cm vertical precision over a 150 m range) and 8-bit RGBA for the
splat / colour maps.
"""

import struct
import zlib


def _chunk(tag, data):
    payload = tag + data
    return struct.pack(">I", len(data)) + payload + struct.pack(">I", zlib.crc32(payload) & 0xFFFFFFFF)


def _write(path, width, height, bit_depth, color_type, raw_rows):
    header = struct.pack(">IIBBBBB", width, height, bit_depth, color_type, 0, 0, 0)
    body = zlib.compress(b"".join(raw_rows), 9)
    with open(path, "wb") as fh:
        fh.write(b"\x89PNG\r\n\x1a\n")
        fh.write(_chunk(b"IHDR", header))
        fh.write(_chunk(b"IDAT", body))
        fh.write(_chunk(b"IEND", b""))


def write_gray16(path, width, height, samples):
    """samples: flat sequence of ints in [0, 65535], row-major, top row first."""
    rows = []
    for y in range(height):
        start = y * width
        row = samples[start:start + width]
        rows.append(b"\x00" + struct.pack(">%dH" % width, *row))
    _write(path, width, height, 16, 0, rows)


def write_rgba8(path, width, height, samples):
    """samples: flat sequence of ints in [0, 255], 4 per pixel, row-major."""
    stride = width * 4
    rows = []
    for y in range(height):
        start = y * stride
        rows.append(b"\x00" + bytes(samples[start:start + stride]))
    _write(path, width, height, 8, 6, rows)
