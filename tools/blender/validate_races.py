#!/usr/bin/env python3
"""Check both bodies across all races, classes, and shared animation channels."""
from pathlib import Path
import sys
from validate_glb import validate

RACES=("sunborne","thornkin","stonehearth","aetheri","ashforged","hornwarden","hollowborn","veilkin")
CLASSES=("vanguard","spellweaver","shadeblade")
CLIPS={"idle","walk","attack","dodge","cast","death"}
JOINTS={"hips","spine","head","arm_L","arm_R","leg_L","leg_R"}
folder=Path(sys.argv[1] if len(sys.argv)>1 else "apps/client/public/assets")
for race in RACES:
 for hero_class in CLASSES:
  stem=f"hero-{race}-{hero_class}"
  for suffix in ("","-female"):
   path=folder/f"{stem}{suffix}.glb"
   doc=validate(path,CLIPS)
   nodes=doc["nodes"]
   for skin in doc["skins"]:
    assert {nodes[joint]["name"] for joint in skin["joints"]}==JOINTS, f"Incompatible rig in {path}"
   for clip in doc["animations"]:
    animated={nodes[c["target"]["node"]]["name"] for c in clip["channels"] if "node" in c["target"]}
    assert JOINTS<=animated, f"Incomplete {clip['name']} animation in {path}"
   if suffix:
    visible_meshes=[node for node in nodes if "mesh" in node]
    for style in range(4):
     assert any(n["name"].startswith(f"RU_HAIR_STYLE_{style}") for n in visible_meshes), f"Missing hairstyle {style} in {path}"
    assert any(n["name"].startswith("RU_MARKING_") for n in visible_meshes), f"Missing markings in {path}"
  assert (folder/f"{stem}.glb").read_bytes()!=(folder/f"{stem}-female.glb").read_bytes(), f"Duplicate body for {stem}"
print("PASS 48 body/race/class rigs and required clips")
