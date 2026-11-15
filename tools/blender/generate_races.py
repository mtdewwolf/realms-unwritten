#!/usr/bin/env python3
"""Produce original faction/race/class rigs with reusable clips and named appearance regions.

Runs in Blender with: blender -b --factory-startup --python-exit-code 1
--python tools/blender/generate_races.py -- --out apps/client/public/assets
"""
import argparse
import os
import sys
import bpy

RACES={
 "sunborne":{"skin":(.78,.55,.36),"armor":(.26,.43,.57),"hair":(.33,.24,.18)},
 "thornkin":{"skin":(.48,.69,.45),"armor":(.30,.48,.34),"hair":(.28,.39,.19)},
 "stonehearth":{"skin":(.76,.45,.30),"armor":(.46,.37,.27),"hair":(.63,.24,.11)},
 "aetheri":{"skin":(.73,.70,.84),"armor":(.32,.35,.62),"hair":(.82,.78,.86)},
 "ashforged":{"skin":(.34,.49,.19),"armor":(.54,.22,.18),"hair":(.20,.18,.14)},
 "hornwarden":{"skin":(.53,.40,.29),"armor":(.38,.29,.22),"hair":(.31,.22,.15)},
 "hollowborn":{"skin":(.54,.57,.52),"armor":(.28,.30,.28),"hair":(.27,.29,.27)},
 "veilkin":{"skin":(.59,.51,.70),"armor":(.30,.30,.49),"hair":(.18,.15,.28)}
}
CLASSES=("vanguard","spellweaver","shadeblade")

def mat(name,colour):
 m=bpy.data.materials.new(name)
 m.diffuse_color=(*colour,1)
 m.use_nodes=True
 p=m.node_tree.nodes.get("Principled BSDF")
 p.inputs["Base Color"].default_value=(*colour,1)
 p.inputs["Roughness"].default_value=.8
 return m

def reset():
 bpy.ops.object.select_all(action="SELECT")
 bpy.ops.object.delete(use_global=False)
 for action in list(bpy.data.actions):bpy.data.actions.remove(action)

def skeleton():
 data=bpy.data.armatures.new("hero_skeleton")
 rig=bpy.data.objects.new("hero_rig",data)
 bpy.context.collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True)
 bpy.ops.object.mode_set(mode="EDIT")
 bones=[
  ("hips",(0,0,.85),(0,0,1.05),None),
  ("spine",(0,0,1.05),(0,0,1.68),"hips"),
  ("head",(0,0,1.68),(0,0,2.26),"spine"),
  ("arm_L",(-.45,0,1.62),(-.54,0,1.03),"spine"),
  ("arm_R",(.45,0,1.62),(.54,0,1.03),"spine"),
  ("leg_L",(-.22,0,.87),(-.22,0,.14),"hips"),
  ("leg_R",(.22,0,.87),(.22,0,.14),"hips")]
 for name,head,tail,parent in bones:
  bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
  if parent:bone.parent=data.edit_bones[parent]
 bpy.ops.object.mode_set(mode="OBJECT");rig.select_set(False)
 return rig

def piece(rig,name,bone,loc,size,material,shape="cube",hide=False):
 if shape=="sphere":bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=loc)
 elif shape=="cone":bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.5,radius2=0,depth=1,location=loc)
 elif shape=="cylinder":bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.5,depth=1,location=loc)
 else:bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 obj=bpy.context.object;obj.name=name
 obj.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 obj.data.materials.append(material)
 obj.parent=rig;obj.matrix_parent_inverse=rig.matrix_world.inverted()
 group=obj.vertex_groups.new(name=bone)
 group.add(list(range(len(obj.data.vertices))),1,"REPLACE")
 mod=obj.modifiers.new("Rig","ARMATURE");mod.object=rig
 return obj

def animate(rig):
 timeline={
  "idle":[(1,{}),(13,{"spine":(.04,0,.018),"head":(-.018,0,0)}),(25,{})],
  "walk":[(1,{"leg_L":(.52,0,0),"leg_R":(-.52,0,0),"arm_L":(-.36,0,0),"arm_R":(.36,0,0)}),
          (9,{"leg_L":(-.52,0,0),"leg_R":(.52,0,0),"arm_L":(.36,0,0),"arm_R":(-.36,0,0)}),
          (17,{"leg_L":(.52,0,0),"leg_R":(-.52,0,0),"arm_L":(-.36,0,0),"arm_R":(.36,0,0)})],
  "attack":[(1,{"arm_R":(-.65,0,-.48)}),(7,{"arm_R":(.90,0,.62),"spine":(0,0,.2)}),(16,{})],
  "dodge":[(1,{}),(5,{"spine":(.35,0,.27),"arm_L":(.25,0,0)}),(15,{})],
  "cast":[(1,{}),(8,{"arm_R":(-1.5,0,.1),"arm_L":(-.85,0,-.15)}),
          (16,{"arm_R":(-1.2,0,0),"head":(-.12,0,0)}),(22,{})],
  "death":[(1,{}),(13,{"spine":(1.12,0,0),"head":(.6,0,0),"arm_L":(-.7,0,0),"arm_R":(-.7,0,0)}),(24,{"spine":(1.12,0,0),"head":(.6,0,0)})]}
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);rig.animation_data_create()
 for name,frames in timeline.items():
  action=bpy.data.actions.new(name);action.use_fake_user=True;rig.animation_data.action=action
  for frame,angles in frames:
   for pose in rig.pose.bones:
    pose.rotation_mode="XYZ";pose.rotation_euler=(0,0,0)
   for bone,xyz in angles.items():rig.pose.bones[bone].rotation_euler=xyz
   for pose in rig.pose.bones:pose.keyframe_insert(data_path="rotation_euler",frame=frame,group=pose.name)
  track=rig.animation_data.nla_tracks.new();track.name=name
  strip=track.strips.new(name,1,action)
  strip.action_frame_start=frames[0][0];strip.action_frame_end=frames[-1][0]
 rig.animation_data.action=None;rig.select_set(False)


# All designs are original. These silhouette rules are not copied from Warcraft meshes.
# Major geometries are mesh shapes rather than primitive box-only placeholders.
PROPORTIONS={
 "sunborne":(1.08,1.13),
 "thornkin":(1.15,.94),
 "stonehearth":(.76,1.32),
 "aetheri":(1.15,.87),
 "ashforged":(1.08,1.43),
 "hornwarden":(1.37,1.46),
 "hollowborn":(.96,.78),
 "veilkin":(1.06,.89)
}
def heroic_detail(rig,race,profession,palette,skin,hair,armor,leather,metal,glow,dark):
 gold=mat("RU_GOLD",(.78,.55,.21))
 bronze=mat("RU_BRONZE",(.47,.29,.16))
 steel=mat("RU_STEEL",(.58,.64,.70))
 trim=mat("RU_TRIM",(.84,.70,.43) if race in ("sunborne","aetheri","stonehearth") else (.62,.37,.33))
 eye=mat("RU_EYE",(.30,.83,.87) if race in ("aetheri","veilkin") else (.82,.65,.30))
 pearl=mat("RU_PEARL",(.90,.88,.79))
 cloak=mat("RU_CLOAK",(.24,.35,.46) if race in ("sunborne","aetheri") else (.27,.19,.31))
 # Large, visible facial geometry: chin, nose, eyes, brow and lip.
 head_depth=.51 if race in ("ashforged","hornwarden") else .43
 facew=.54 if race in ("ashforged","hornwarden") else .45
 piece(rig,"Jaw sculpt","head",(0,-.055,1.91),(facew*.75,head_depth*.70,.23),skin,"sphere")
 piece(rig,"Nose bridge","head",(0,-.24,2.04),(.095,.12,.18),skin,"sphere")
 piece(rig,"Nose tip","head",(0,-.34,1.99),(.115,.095,.09),skin,"sphere")
 for side,s in (("L",-1),("R",1)):
  piece(rig,"Eye socket "+side,"head",(s*.135,-.244,2.12),(.13,.055,.08),dark,"sphere")
  piece(rig,"Eye iris "+side,"head",(s*.135,-.309,2.12),(.075,.055,.075),eye,"sphere")
  brow=piece(rig,"Expression brow "+side,"head",(s*.14,-.282,2.22),(.18,.055,.07),hair)
  brow.rotation_euler[1]=s*.09
  piece(rig,"Cheek "+side,"head",(s*.25,-.165,1.94),(.12,.12,.09),skin,"sphere")
 piece(rig,"Mouth line","head",(0,-.291,1.86),(.19,.045,.045),dark)
 if race=="stonehearth":
  piece(rig,"Stout deep beard","head",(0,-.16,1.76),(.42,.25,.40),hair,"sphere")
  for s in (-1,1):
   braid=piece(rig,"Tied beard braid %s"%s,"head",(s*.21,-.36,1.49),(.12,.12,.34),hair,"cylinder")
   piece(rig,"Braided gold bead %s"%s,"head",(s*.21,-.36,1.3),(.15,.15,.075),gold,"cylinder")
  piece(rig,"Forge goggles bridge","head",(0,-.3,2.31),(.5,.12,.14),bronze)
  for s in (-1,1):
   piece(rig,"Forge goggle lens %s"%s,"head",(s*.18,-.34,2.31),(.26,.09,.22),gold,"cylinder")
  piece(rig,"Engineering harness","spine",(0,-.30,1.4),(.72,.16,.30),bronze)
 elif race=="ashforged":
  for s in (-1,1):
   piece(rig,"Lower tusk %s"%s,"head",(s*.21,-.36,1.84),(.15,.13,.31),pearl,"cone")
   piece(rig,"Iron shoulder spike %s"%s,"spine",(s*.68,-.01,1.89),(.36,.36,.66),steel,"cone")
  piece(rig,"Heavy jaw","head",(0,-.26,1.85),(.47,.27,.21),skin,"sphere")
 elif race=="hornwarden":
  piece(rig,"Broad muzzle","head",(0,-.29,1.97),(.49,.27,.20),skin,"sphere")
  for s in (-1,1):
   horn=piece(rig,"Great curved horn %s"%s,"head",(s*.49,0,2.39),(.28,.25,.88),pearl,"cone")
   horn.rotation_euler[1]=s*.55
   piece(rig,"Horn ferrule %s"%s,"head",(s*.45,0,2.22),(.36,.35,.18),bronze,"cylinder")
  piece(rig,"Shoulder pelt","spine",(0,.28,1.54),(1.1,.68,.34),leather,"sphere")
  piece(rig,"Ancestral totem","spine",(0,.37,1.69),(.18,.24,1.45),bronze)
 elif race=="hollowborn":
  piece(rig,"Sunken cheek mask","head",(0,-.22,1.92),(.48,.26,.38),skin,"sphere")
  for s in (-1,1):
   piece(rig,"Hollow cheek ridge %s"%s,"head",(s*.24,-.30,1.94),(.12,.09,.26),steel)
  piece(rig,"Torn collar","spine",(0,.20,1.66),(.72,.48,.28),dark)
  for s in (-1,1):
   piece(rig,"Blight potion %s"%s,"hips",(s*.37,-.2,.93),(.17,.18,.35),glow,"cylinder")
 elif race=="aetheri":
  for s in (-1,1):
   ear=piece(rig,"Arcane swept ear %s"%s,"head",(s*.39,0,2.12),(.34,.20,.52),skin,"cone")
   ear.rotation_euler[1]=s*.95
  piece(rig,"Floating circlet","head",(0,-.03,2.4),(.67,.55,.15),gold,"cylinder")
  piece(rig,"Arcane crystal brow","head",(0,-.3,2.38),(.14,.14,.22),glow,"sphere")
 elif race=="thornkin":
  for s in (-1,1):
   antler=piece(rig,"Branched antler %s"%s,"head",(s*.27,-.03,2.61),(.16,.18,.74),bronze,"cone")
   antler.rotation_euler[1]=s*.5
   piece(rig,"Leaf mantle %s"%s,"spine",(s*.48,-.07,1.71),(.59,.55,.37),armor,"sphere")
  piece(rig,"Druidic neck charm","spine",(0,-.27,1.58),(.23,.16,.27),glow,"sphere")
 elif race=="veilkin":
  for s in (-1,1):
   ear=piece(rig,"Shadow ear %s"%s,"head",(s*.40,-.04,2.14),(.30,.20,.55),skin,"cone")
   ear.rotation_euler[1]=s*1.0
   piece(rig,"Veil rune %s"%s,"head",(s*.23,-.27,1.92),(.10,.05,.15),glow)
  piece(rig,"Mystic crest","head",(0,-.23,2.41),(.24,.14,.29),glow,"sphere")
 else:
  piece(rig,"Golden brow crown","head",(0,-.04,2.43),(.70,.53,.14),gold,"cylinder")
  piece(rig,"Sun herald crest","spine",(0,-.32,1.46),(.34,.09,.34),gold,"sphere")
 # A strong chest silhouette and thick, visually legible class gear.
 for s in (-1,1):
  pauldron=piece(rig,"RU_HEROIC_PAULDRON_%s"%s,"spine",(s*.55,-.06,1.71),
   (.35,.40,.28),metal if profession=="vanguard" else armor,"sphere")
  piece(rig,"Shoulder edge %s"%s,"spine",(s*.67,-.17,1.64),(.28,.29,.13),trim)
  piece(rig,"Bracer cuff %s"%s,"arm_"+("L" if s==-1 else "R"),
    (s*.54,-.08,1.11),(.37,.42,.24),bronze if profession=="shadeblade" else metal)
  piece(rig,"Boot armor %s"%s,"leg_"+("L" if s==-1 else "R"),
    (s*.22,-.11,.25),(.33,.25,.40),leather))
  piece(rig,"Belt pouch %s"%s,"hips",(s*.39,-.22,.96),(.24,.2,.33),leather)
  piece(rig,"Pouch clasp %s"%s,"hips",(s*.40,-.35,.98),(.11,.05,.10),gold)
 piece(rig,"Chest emblem","spine",(0,-.285,1.49),(.37,.09,.42),trim,"sphere")
 piece(rig,"Gilded belt buckle","hips",(0,-.31,.95),(.30,.10,.24),gold)
 if profession=="vanguard":
  piece(rig,"Overlapping cuirass","spine",(0,-.31,1.38),(.74,.13,.52),steel)
  for s in (-1,1):
   piece(rig,"Shield crest rivet %s"%s,"arm_L",(s*.24,-.37,1.22),(.10,.09,.13),gold,"sphere")
   piece(rig,"Cuirass trim %s"%s,"spine",(s*.32,-.38,1.4),(.07,.09,.50),gold)
  piece(rig,"Tower shield face","arm_L",(-.68,-.38,1.28),(.73,.16,.89),steel)
  piece(rig,"Shield boss","arm_L",(-.68,-.50,1.28),(.18,.11,.18),gold,"sphere")
  blade=piece(rig,"Great sword tapered edge","arm_R",(.66,-.05,.59),(.25,.14,1.3),steel,"cone")
  blade.rotation_euler[0]=.12
 elif profession=="spellweaver":
  piece(rig,"Arcane robe skirt","hips",(0,0,.66),(.87,.64,1.27),armor,"cone")
  piece(rig,"Glowing chest jewel","spine",(0,-.31,1.53),(.23,.14,.35),glow,"sphere")
  for s in (-1,1):
   piece(rig,"Robe embroidery %s"%s,"hips",(s*.33,-.27,.62),(.1,.08,.89),gold)
   piece(rig,"Crystal pauldron %s"%s,"spine",(s*.63,-.06,1.9),(.34,.35,.51),glow,"cone")
  piece(rig,"Rune staff tip","arm_R",(.63,-.14,1.92),(.47,.43,.54),glow,"sphere")
 elif profession=="shadeblade":
  piece(rig,"Hooded mantle","spine",(0,.26,1.54),(.72,.16,.47),cloak)
  piece(rig,"Assassin scarf","head",(0,-.23,1.87),(.48,.21,.22),cloak)
  for s in (-1,1):
   piece(rig,"Swept blade tip %s"%s,"arm_"+("L" if s==-1 else "R"),
    (s*.59,-.13,.56),(.19,.13,.76),steel,"cone")
   piece(rig,"Assassin belt vial %s"%s,"hips",(s*.42,-.21,.85),(.16,.13,.29),glow,"cylinder")
 return

def hero(out,race,profession):
 reset();rig=skeleton();palette=RACES[race]
 skin=mat("RU_SKIN",palette["skin"])
 hair=mat("RU_HAIR",palette["hair"])
 armor=mat("RU_ARMOR",palette["armor"])
 leather=mat("RU_LEATHER",(.25,.17,.12))
 metal=mat("RU_METAL",(.63,.66,.67))
 glow=mat("RU_GLOW",(.95,.73,.37) if race in ("sunborne","thornkin") else (.66,.40,.79))
 dark=mat("RU_DARK",(.12,.14,.17))
 width=PROPORTIONS[race][1]
 piece(rig,"Coat","spine",(0,0,1.37),(.72*width,.50,.82),armor)
 piece(rig,"Belt","hips",(0,0,.95),(.78*width,.52,.14),leather)
 piece(rig,"Face","head",(0,0,2.02),(.41,.34,.46),skin,"sphere")
 piece(rig,"Neck guard","spine",(0,0,1.79),(.56,.45,.15),metal)
 for side,s in (("L",-1),("R",1)):
  piece(rig,"Pauldron_"+side,"spine",(s*.51*width,0,1.65),(.31,.39,.22),metal)
  piece(rig,"Arm_"+side,"arm_"+side,(s*.53*width,0,1.31),(.25,.30,.65),armor)
  piece(rig,"Hand_"+side,"arm_"+side,(s*.55*width,.0,1.06),(.25,.28,.21),skin)
  piece(rig,"Leg_"+side,"leg_"+side,(s*.22,0,.49),(.29,.37,.76),leather)
  piece(rig,"Boot_"+side,"leg_"+side,(s*.22,.06,.16),(.35,.46,.33),dark)
  if race=="thornkin":
   piece(rig,"Woodland ear "+side,"head",(s*.33,0,2.14),(.29,.25,.36),skin,"cone")
   piece(rig,"Antler "+side,"head",(s*.22,-.08,2.54),(.18,.16,.60),leather,"cone")
  elif race=="ashforged":
   piece(rig,"Obsidian horn "+side,"head",(s*.21,-.07,2.48),(.24,.22,.52),dark,"cone")
   piece(rig,"Forge emblem "+side,"spine",(s*.37,-.28,1.48),(.18,.07,.32),glow)
  elif race=="veilkin":
   piece(rig,"Veil ear "+side,"head",(s*.34,0,2.09),(.27,.17,.48),skin,"cone")
   piece(rig,"Luminous rune "+side,"head",(s*.15,-.24,2.01),(.065,.03,.09),glow)
  else:
   piece(rig,"Sun crest "+side,"head",(s*.16,0,2.43),(.15,.13,.28),glow,"cone")
 # Rig all four hairstyles but allow the client to select by object visibility.
 for style in range(4):
  name="RU_HAIR_STYLE_%s"%style
  if style==0:piece(rig,name,"head",(0,.035,2.34),(.55,.45,.15),hair)
  elif style==1:piece(rig,name,"head",(0,.16,2.24),(.61,.39,.50),hair)
  elif style==2:
   for i in range(3):piece(rig,name+"_%d"%i,"head",((i-1)*.17,0,2.49),(.24,.22,.35),hair,"cone")
  else:
   for i in range(2):piece(rig,name+"_%d"%i,"head",((i*2-1)*.20,.16,2.16),(.18,.18,.56),hair)
 # The facial-marking mesh can be recolored or hidden by the runtime.
 for side,s in (("L",-1),("R",1)):
  piece(rig,"RU_MARKING_"+side,"head",(s*.14,-.23,2.03),(.13,.03,.06),glow)
 if profession=="vanguard":
  piece(rig,"Runeblade","arm_R",(.66,-.05,.64),(.13,.17,1.15),metal)
  piece(rig,"Blade hilt","arm_R",(.66,-.05,1.15),(.36,.18,.10),leather)
  piece(rig,"Citadel shield","arm_L",(-.67,-.25,1.24),(.62,.16,.83),metal)
 elif profession=="spellweaver":
  piece(rig,"Arcane staff","arm_R",(.63,-.12,.66),(.15,.16,1.9),leather)
  piece(rig,"Staff focus","arm_R",(.63,-.12,1.66),(.35,.36,.36),glow,"sphere")
  piece(rig,"Mantle","spine",(0,.22,1.31),(.81,.14,.82),armor)
 else:
  for side,s in (("L",-1),("R",1)):
   piece(rig,"Moonsteel dagger "+side,"arm_"+side,(s*.59,-.13,.85),(.12,.14,.8),metal)
   piece(rig,"Dagger guard "+side,"arm_"+side,(s*.59,-.13,1.01),(.24,.17,.11),leather)
 heroic_detail(rig,race,profession,palette,skin,hair,armor,leather,metal,glow,dark)
 animate(rig)
 height_scale,width_scale=PROPORTIONS[race]
 rig.scale=(width_scale,width_scale,height_scale)
 os.makedirs(out,exist_ok=True)
 path=os.path.join(out,"hero-%s-%s.glb"%(race,profession))
 bpy.ops.object.select_all(action="DESELECT");rig.select_set(True)
 for obj in bpy.data.objects:
  if obj.type=="MESH" and obj.parent==rig:obj.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",use_selection=True,export_animations=True,export_nla_strips=True,export_skins=True)
 print("EXPORTED",path,os.path.getsize(path),flush=True)

if __name__=="__main__":
 argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
 parser=argparse.ArgumentParser();parser.add_argument("--out",default="apps/client/public/assets")
 config=parser.parse_args(argv)
 for race in RACES:
  for profession in CLASSES:hero(config.out,race,profession)
 print("RACE ASSET PACK COMPLETE: 12 animated original GLBs",flush=True)
