#!/usr/bin/env python3
"""Validate the 12 generated playable class/race assets and required animation clips."""
import os
import sys
sys.path.insert(0,os.path.dirname(__file__))
from validate_glb import validate
races=("sunborne","thornkin","ashforged","veilkin")
classes=("vanguard","spellweaver","shadeblade")
folder=sys.argv[1] if len(sys.argv)>1 else "apps/client/public/assets"
for race in races:
 for hero_class in classes:
  name="hero-%s-%s.glb"%(race,hero_class)
  validate(os.path.join(folder,name),{"idle","walk","attack","dodge","cast","death"})
print("PASS 12 race/class rigs and required clips")
