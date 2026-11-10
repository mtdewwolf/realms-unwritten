#!/usr/bin/env python3
"""Validate GLB structure without third-party Python dependencies."""
import json
import os
import struct
import sys

EXPECTED = {
    "adventurer.glb": {"idle", "walk", "attack", "dodge"},
    "wolf.glb": {"idle", "walk", "attack", "death"},
}

def validate(path, required):
    with open(path, "rb") as f:
        header = f.read(12)
        magic, version, length = struct.unpack("<4sII", header)
        assert magic == b"glTF" and version == 2, f"Invalid glTF header: {path}"
        assert length == os.path.getsize(path), f"Length mismatch: {path}"
        chunk_len, chunk_type = struct.unpack("<I4s", f.read(8))
        assert chunk_type == b"JSON", f"Expected first chunk JSON: {path}"
        doc = json.loads(f.read(chunk_len).decode("utf-8").strip())
    assert doc.get("asset",{}).get("version") == "2.0"
    assert len(doc.get("meshes",[])) > 0, f"No meshes in {path}"
    assert len(doc.get("skins",[])) > 0, f"No skin/rig in {path}"
    names = {a.get("name","") for a in doc.get("animations",[])}
    assert required.issubset(names), f"Missing animation names {required-names}: found {names}"
    print(f"PASS {path}: {len(doc['meshes'])} meshes, {len(doc['skins'])} skins, clips {sorted(names)}")

if __name__ == "__main__":
    folder = sys.argv[1] if len(sys.argv) > 1 else "build/assets"
    for filename, names in EXPECTED.items():
        validate(os.path.join(folder,filename),names)
