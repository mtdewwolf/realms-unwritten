#!/usr/bin/env python3
"""Original low-poly Blender character assets for Realms Unwritten.

Run: blender -b --factory-startup --python tools/blender/generate_characters.py -- --out build/assets
Generated files are build artifacts, not source-of-truth artwork.
"""
import argparse
import math
import os
import sys
import bpy

def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="build/assets")
    return parser.parse_args(argv)

def material(name, rgba):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgba, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgba, 1)
    bsdf.inputs["Roughness"].default_value = 0.82
    return mat

def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in list(bpy.data.actions):
        bpy.data.actions.remove(data)

def armature(name, definitions):
    data = bpy.data.armatures.new(name + "_skeleton")
    rig = bpy.data.objects.new(name + "_rig", data)
    bpy.context.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for bone_name, head, tail, parent in definitions:
        bone = data.edit_bones.new(bone_name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.select_set(False)
    return rig

def part(rig, name, bone, at, dimensions, mat, shape="cube"):
    if shape == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, location=at)
    elif shape == "cone":
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.5, radius2=0, depth=1, location=at)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.name = name
    obj.scale = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = rig
    obj.matrix_parent_inverse = rig.matrix_world.inverted()
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))), 1, "REPLACE")
    modifier = obj.modifiers.new("Skin", "ARMATURE")
    modifier.object = rig
    return obj

def clips(rig, specs):
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    rig.animation_data_create()
    for clip_name, frame_values in specs.items():
        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame, rotations in frame_values:
            for pose_bone in rig.pose.bones:
                pose_bone.rotation_mode = "XYZ"
                pose_bone.rotation_euler = (0.0, 0.0, 0.0)
            for bone_name, xyz in rotations.items():
                rig.pose.bones[bone_name].rotation_euler = xyz
            for pose_bone in rig.pose.bones:
                pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame, group=pose_bone.name)
        track = rig.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, 1, action)
        strip.action_frame_start = frame_values[0][0]
        strip.action_frame_end = frame_values[-1][0]
    rig.animation_data.action = None
    rig.select_set(False)

def save_glb(rig, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.parent == rig:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_nla_strips=True,
        export_skins=True,
    )
    print("EXPORTED", path, os.path.getsize(path), "bytes", flush=True)

def make_adventurer(out):
    reset()
    defs = [
        ("hips", (0, 0, 0.86), (0, 0, 1.07), None),
        ("spine", (0, 0, 1.07), (0, 0, 1.72), "hips"),
        ("head", (0, 0, 1.72), (0, 0, 2.24), "spine"),
        ("arm_L", (-0.48, 0, 1.63), (-0.6, 0, 1.05), "spine"),
        ("arm_R", (0.48, 0, 1.63), (0.6, 0, 1.05), "spine"),
        ("leg_L", (-0.23, 0, 0.89), (-0.23, 0, 0.1), "hips"),
        ("leg_R", (0.23, 0, 0.89), (0.23, 0, 0.1), "hips"),
    ]
    rig = armature("adventurer", defs)
    blue = material("Woven blue tunic", (0.12, 0.31, 0.58))
    leather = material("Warm leather", (0.29, 0.16, 0.095))
    skin = material("Skin", (0.77, 0.53, 0.34))
    iron = material("Iron blade", (0.63, 0.77, 0.82))
    dark = material("Dark boots", (0.10, 0.09, 0.085))
    part(rig, "Tunic", "spine", (0, 0, 1.35), (0.75, 0.46, 0.78), blue)
    part(rig, "Head", "head", (0, 0, 2.02), (0.34, 0.3, 0.38), skin, "sphere")
    part(rig, "Belt", "hips", (0, 0, 0.99), (0.83, 0.49, 0.17), leather)
    for side, x in [("L", -0.5), ("R", 0.5)]:
        part(rig, "Arm_"+side, "arm_"+side, (x,0,1.31), (.27,.31,.64), blue)
        part(rig, "Glove_"+side, "arm_"+side, (x,0,1.07), (.28,.32,.18), leather)
        part(rig, "Leg_"+side, "leg_"+side, (x*.47,0,.48), (.29,.34,.76), leather)
        part(rig, "Boot_"+side, "leg_"+side, (x*.47,.05,.15), (.31,.41,.27), dark)
    part(rig, "Sword", "arm_R", (.62,.07,.58), (.12,.13,1.09), iron)
    part(rig, "Shield", "arm_L", (-.63,.27,1.09), (.66,.14,.74), iron)
    idle=[(1,{}),(12,{"spine":(.035,0,0)}),(24,{})]
    walk=[(1,{"leg_L":(.5,0,0),"leg_R":(-.5,0,0),"arm_L":(-.3,0,0),"arm_R":(.3,0,0)}),
          (9,{"leg_L":(-.5,0,0),"leg_R":(.5,0,0),"arm_L":(.3,0,0),"arm_R":(-.3,0,0)}),
          (17,{"leg_L":(.5,0,0),"leg_R":(-.5,0,0),"arm_L":(-.3,0,0),"arm_R":(.3,0,0)})]
    slash=[(1,{"arm_R":(-.75,.15,-.6)}),(7,{"arm_R":(.9,-.3,.8),"spine":(0,0,.22)}),(16,{})]
    dodge=[(1,{}),(5,{"spine":(.35,0,.25),"arm_L":(.4,0,0)}),(14,{})]
    clips(rig,{"idle":idle,"walk":walk,"attack":slash,"dodge":dodge})
    save_glb(rig,os.path.join(out,"adventurer.glb"))

def make_wolf(out):
    reset()
    defs=[
        ("root",(0,0,.68),(0,0,.92),None),
        ("spine",(0,0,.92),(0,.47,.92),"root"),
        ("head",(0,.47,.92),(0,.91,1.0),"spine"),
        ("leg_FL",(-.34,.38,.75),(-.34,.38,.1),"root"),
        ("leg_FR",(.34,.38,.75),(.34,.38,.1),"root"),
        ("leg_BL",(-.34,-.42,.75),(-.34,-.42,.1),"root"),
        ("leg_BR",(.34,-.42,.75),(.34,-.42,.1),"root"),
    ]
    rig=armature("wolf",defs)
    fur=material("Slate wolf fur",(0.27,.24,.23))
    pale=material("Wolf muzzle",(0.46,.42,.37))
    eye=material("Amber eyes",(.9,.62,.19))
    part(rig,"Body","spine",(0,0,.87),(.72,1.45,.68),fur)
    part(rig,"Head","head",(0,.79,1.02),(.54,.58,.5),fur)
    part(rig,"Muzzle","head",(0,1.13,.89),(.36,.42,.26),pale)
    for side,x in [("L",-.22),("R",.22)]:
        part(rig,"Ear_"+side,"head",(x,.65,1.42),(.18,.2,.3),fur,"cone")
        part(rig,"Eye_"+side,"head",(x,.98,1.16),(.09,.08,.08),eye,"sphere")
        for where,y in [("F",.43),("B",-.43)]:
            part(rig,"Paw_"+where+side,"leg_"+where+side,(x*1.5,y,.34),(.22,.25,.65),fur)
    idle=[(1,{}),(13,{"head":(.08,0,0)}),(25,{})]
    walk=[(1,{"leg_FL":(.32,0,0),"leg_BR":(.32,0,0),"leg_FR":(-.32,0,0),"leg_BL":(-.32,0,0)}),
          (9,{"leg_FL":(-.32,0,0),"leg_BR":(-.32,0,0),"leg_FR":(.32,0,0),"leg_BL":(.32,0,0)}),
          (17,{"leg_FL":(.32,0,0),"leg_BR":(.32,0,0),"leg_FR":(-.32,0,0),"leg_BL":(-.32,0,0)})]
    attack=[(1,{"head":(-.3,0,0)}),(6,{"spine":(.3,0,0),"head":(.35,0,0)}),(16,{})]
    death=[(1,{}),(15,{"root":(0,1.2,0),"head":(.65,0,0)}),(24,{"root":(0,1.2,0),"head":(.65,0,0)})]
    clips(rig,{"idle":idle,"walk":walk,"attack":attack,"death":death})
    save_glb(rig,os.path.join(out,"wolf.glb"))

if __name__ == "__main__":
    output=os.path.abspath(args().out)
    make_adventurer(output)
    make_wolf(output)
    print("ASSET BUILD COMPLETE",output,flush=True)
