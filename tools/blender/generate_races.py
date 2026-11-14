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
 "ashforged":{"skin":(.49,.30,.28),"armor":(.47,.28,.26),"hair":(.21,.20,.21)},
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

def hero(out,race,profession):
 reset();rig=skeleton();palette=RACES[race]
 skin=mat("RU_SKIN",palette["skin"])
 hair=mat("RU_HAIR",palette["hair"])
 armor=mat("RU_ARMOR",palette["armor"])
 leather=mat("RU_LEATHER",(.25,.17,.12))
 metal=mat("RU_METAL",(.63,.66,.67))
 glow=mat("RU_GLOW",(.95,.73,.37) if race in ("sunborne","thornkin") else (.66,.40,.79))
 dark=mat("RU_DARK",(.12,.14,.17))
 width=1.12 if race=="ashforged" else .9 if race=="veilkin" else 1.0
 piece(rig,"Coat","spine",(0,0,1.37),(.72*width,.50,.82),armor)
 piece(rig,"Belt","hips",(0,0,.95),(.78*width,.52,.14),leather)
 piece(rig,"Face","head",(0,0,2.02),(.50,.43,.55),skin,"sphere")
 piece(rig,"Neck guard","spine",(0,0,1.79),(.56,.45,.15),metal)
 for side,s in (("L",-1),("R",1)):
  piece(rig,"Pauldron_"+side,"spine",(s*.51*width,0,1.65),(.38,.51,.22),metal)
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
 animate(rig)
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
