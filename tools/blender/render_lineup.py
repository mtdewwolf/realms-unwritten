#!/usr/bin/env python3
"""Render actual exported race GLBs for side-by-side visual QA (NOT concept art)."""
import argparse
import math
import os
import sys
import bpy
from mathutils import Vector

FACTIONS={
 "radiant-accord":[("sunborne","vanguard"),("thornkin","spellweaver"),("stonehearth","shadeblade"),("aetheri","spellweaver")],
 "umbral-dominion":[("ashforged","vanguard"),("hornwarden","vanguard"),("hollowborn","shadeblade"),("veilkin","shadeblade")]
}
def material(name,color,metallic=0):
 m=bpy.data.materials.new(name)
 m.diffuse_color=(*color,1)
 m.use_nodes=True
 bsdf=m.node_tree.nodes.get("Principled BSDF")
 bsdf.inputs["Base Color"].default_value=(*color,1)
 bsdf.inputs["Metallic"].default_value=metallic
 bsdf.inputs["Roughness"].default_value=.8
 return m
def cube(name,loc,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.data.materials.append(mat)
 return obj
def light(name,loc,energy,color,size):
 data=bpy.data.lights.new(name,"AREA");data.energy=energy;data.color=color;data.shape="DISK";data.size=size
 obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc
 rot=Vector((0,0,1.5))-obj.location;obj.rotation_euler=rot.to_track_quat("-Z","Y").to_euler()
def render(faction,characters,assets,out,body_type):
 bpy.ops.object.select_all(action="SELECT");bpy.ops.object.delete(use_global=False)
 for item in list(bpy.data.materials):bpy.data.materials.remove(item)
 good=faction=="radiant-accord"
 stone=material("Stage polished stone",(.18,.26,.23) if good else (.22,.18,.25))
 back=material("Painted backdrop",(.07,.16,.18) if good else (.15,.08,.17))
 gold=material("Gold ornaments",(.70,.52,.22) if good else (.56,.28,.46),.2)
 cube("Stage floor",(0,0,-.16),(13.8,7,.32),stone)
 cube("Faction arch backdrop",(0,3.4,3.5),(14,.20,8.8),back)
 for x in (-6.35,6.35):
  cube("Hall pillar",(x,2.75,2.6),(.48,.54,5.35),stone)
  cube("Crest trim",(x,2.4,5.0),(.70,.65,.27),gold)
 for i,(race,profession) in enumerate(characters):
  suffix="-female" if body_type=="female" else ""
  asset=os.path.join(assets,f"hero-{race}-{profession}{suffix}.glb")
  assert os.path.isfile(asset),asset
  old=set(bpy.data.objects)
  bpy.ops.import_scene.gltf(filepath=asset)
  imported=set(bpy.data.objects)-old
  for obj in imported:
   if obj.name.startswith(("RU_HAIR_STYLE_1","RU_HAIR_STYLE_2","RU_HAIR_STYLE_3","RU_MARKING_")):
    obj.hide_render=True
   if obj.type=="ARMATURE" and obj.animation_data:
    obj.animation_data.action=None
    for track in obj.animation_data.nla_tracks:track.mute=True
    for bone in obj.pose.bones:bone.matrix_basis.identity()
  bpy.context.view_layer.update()
  roots=[o for o in imported if o.parent not in imported]
  group=bpy.data.objects.new("RU_LINEUP_"+race,None)
  bpy.context.collection.objects.link(group)
  for obj in roots:
   world=obj.matrix_world.copy()
   obj.parent=group
   obj.matrix_world=world
  group.location.x=(i-1.5)*3.05
  # Four silhouette platforms make each race and its height readable.
  bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=1.3,depth=.17,location=((i-1.5)*3.05,0,-.01))
  base=bpy.context.object;base.name="Plinth_"+race;base.data.materials.append(gold)
 light("Key",(-5,-8,10),850,(1.0,.85,.64),9)
 light("Fill",(5,-6,7),440,(.65,.82,1.0),8)
 light("Rim",(0,5,9),1100,(.95,.7,.85) if not good else (.75,1.0,.89),8)
 bpy.ops.object.camera_add(location=(0,-19,5.3))
 camera=bpy.context.object
 direction=Vector((0,0,1.75))-camera.location
 camera.rotation_euler=direction.to_track_quat("-Z","Y").to_euler()
 camera.data.type="ORTHO";camera.data.ortho_scale=15.6
 bpy.context.scene.camera=camera
 scene=bpy.context.scene
 scene.render.engine="CYCLES";scene.cycles.samples=32
 # Ubuntu's Blender is compiled without OpenImageDenoiser. The lighting and geometry
 # can still be rendered correctly using un-denoised CPU cycles samples.
 if hasattr(scene.cycles,"use_denoising"):scene.cycles.use_denoising=False
 for layer in scene.view_layers:
  if hasattr(layer.cycles,"use_denoising"):layer.cycles.use_denoising=False
 scene.render.resolution_x=1280;scene.render.resolution_y=640;scene.render.resolution_percentage=100
 scene.render.image_settings.file_format="PNG"
 scene.render.film_transparent=False
 scene.world.color=(.10,.10,.10)
 scene.view_settings.view_transform="Standard"
 prefix="lineup-female-" if body_type=="female" else "lineup-"
 scene.render.filepath=os.path.join(out,prefix+faction+".png")
 bpy.ops.render.render(write_still=True)
 print("RENDERED_ACTUAL_GLB_LINEUP",scene.render.filepath,os.path.getsize(scene.render.filepath),flush=True)

if __name__=="__main__":
 args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
 p=argparse.ArgumentParser();p.add_argument("--assets",default="apps/client/public/assets")
 p.add_argument("--out",default="build/lineup-previews")
 p.add_argument("--body-type",choices=("male","female"),default="male")
 a=p.parse_args(args)
 os.makedirs(a.out,exist_ok=True)
 for faction,characters in FACTIONS.items():render(faction,characters,a.assets,a.out,a.body_type)
 print("PASS ACTUAL GLB FACTION LINEUP RENDERS",flush=True)
