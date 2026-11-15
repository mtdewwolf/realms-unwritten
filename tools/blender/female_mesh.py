"""Original female silhouettes fitted to the existing hero rig and class slots."""

from math import cos, pi, sin
import bpy
from mathutils import Vector

# Shoulder, waist, hip, jaw and ear widths; the race rig supplies overall scale.
PROFILES = {
    "sunborne":   (.375, .255, .329, .157, .227),
    "thornkin":   (.399, .260, .345, .166, .396),
    "stonehearth":(.414, .315, .399, .188, .237),
    "aetheri":    (.351, .228, .312, .136, .433),
    "ashforged":  (.432, .284, .370, .190, .332),
    "hornwarden": (.453, .311, .389, .213, .374),
    "hollowborn": (.349, .225, .284, .147, .273),
    "veilkin":    (.369, .235, .332, .141, .407),
}


def bind_mesh(rig, name, bone, verts, faces, material, *, smooth=True, weights=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = rig
    mesh.materials.append(material)
    for face in mesh.polygons:
        face.use_smooth = smooth
    group = obj.vertex_groups.new(name=bone)
    if weights:
        secondary = obj.vertex_groups.new(name=weights[0])
        for v in mesh.vertices:
            blend = weights[1](v.co)
            if blend < 1:
                group.add([v.index], 1-blend, "REPLACE")
            if blend > 0:
                secondary.add([v.index], blend, "REPLACE")
    else:
        group.add(list(range(len(mesh.vertices))), 1, "REPLACE")
    mod = obj.modifiers.new("Hero skeleton", "ARMATURE")
    mod.object = rig
    return obj


def tube(rig, name, bone, path, color, sections=14, weights=None):
    """Loft elliptical sections along a curved centerline."""
    verts = []
    for index, (position, width, depth) in enumerate(path):
        tangent = Vector(path[min(index+1,len(path)-1)][0])-Vector(path[max(0,index-1)][0])
        axis = Vector((0, 1, 0)).cross(tangent).normalized()
        if axis.length < .01:
            axis = Vector((1, 0, 0))
        orthogonal = tangent.normalized().cross(axis)
        for s in range(sections):
            a = 2*pi*s/sections
            verts.append(Vector(position)+axis*width*cos(a)+orthogonal*depth*sin(a))
    faces = [tuple(reversed(range(sections)))]
    for index in range(len(path)-1):
        for side in range(sections):
            a=index*sections+side
            b=index*sections+(side+1)%sections
            faces.append((a,b,b+sections,a+sections))
    faces.append(tuple(range(len(verts)-sections,len(verts))))
    return bind_mesh(rig,name,bone,verts,faces,color,weights=weights)


def band(rig,name,bone,sections,color,weights=None):
    return tube(rig,name,bone,[((x,y,z),w,d) for z,x,y,w,d in sections],color,24,weights)


def plate(rig, name, bone, outline, depth, color):
    """Folded front with a closed back and a raised central ridge."""
    count=len(outline)
    center=tuple(sum(point[i] for point in outline)/count for i in range(3))
    verts=[*outline,(center[0],center[1]-depth,center[2])]
    verts.extend((x,y+.022,z) for x,y,z in outline)
    faces=[]
    for i in range(count):
        j=(i+1)%count
        faces.extend(((j,i,count),(i,j,count+1+j,count+1+i)))
    faces.append(tuple(count+1+i for i in range(count)))
    obj=bind_mesh(rig,name,bone,verts,faces,color,smooth=False)
    import bmesh
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def close_trim(rig,name,bone,outline,radius,color):
    return tube(rig,name,bone,[(p,radius,radius) for p in (*outline,outline[0])],color,7)


def make_female(rig, race, hero_class, skin, hair, armor, leather, steel, glow, dark, gold, ivory, piece):
    shoulder,waist,hip,jaw,ear=PROFILES[race]
    bovine=race=="hornwarden"
    elven=race in ("aetheri","veilkin")
    mage=hero_class=="spellweaver"
    guard=hero_class=="vanguard"
    # Continuous fitted torso; the two deform groups keep its hem with the pelvis.
    band(rig,"Fitted female cuirass" if guard else "Fitted female tunic","spine",[
        (.83,0,.027,hip,.193),(.95,0,.020,hip*.98,.197),(1.08,0,.010,waist,.172),
        (1.20,0,.006,waist*1.055,.185),(1.38,0,.011,shoulder*.89,.232),
        (1.51,0,.025,shoulder,.208),(1.62,0,.046,shoulder*.78,.156),
        (1.69,0,.040,.145,.127)],armor,weights=("hips",lambda pos:max(0,min(1,(1.12-pos.z)/.25))))
    band(rig,"Neck","head",[(1.62,0,.038,.118,.112),(1.75,0,.023,.125,.12),
        (1.85,0,.012,jaw*.76,.119)],skin)
    band(rig,"Contoured female face","head",[
        (1.795,0,-.042,jaw*.48,.112),(1.841,0,-.051,jaw*.83,.148),
        (1.919,0,-.037,jaw,.177),(2.001,0,-.012,jaw*1.18,.186),
        (2.085,0,.006,jaw*1.17,.181),(2.177,0,.025,jaw*.99,.152),
        (2.224,0,.051,jaw*.58,.103)],skin)
    def ell(name,loc,scale,color,bone="head"):
        ob=piece(rig,name,bone,loc,scale,color,"sphere")
        for p in ob.data.polygons:p.use_smooth=True
        return ob

    if bovine:
        ell("Broad muzzle",(0,-.241,1.924),(.195,.172,.103),skin)
        ell("Muzzle leather pad",(0,-.357,1.94),(.139,.065,.044),leather)
    else:
        nose_depth=.056 if elven else .075
        ell("Nasal bridge",(0,-.196,2.007),(.048,nose_depth,.096),skin)
        ell("Nose tip",(0,-.247,1.966),(.049,nose_depth*.76,.042),skin)
    eye_z=2.065 if elven else 2.047
    for s,bone in [(-1,"L"),(1,"R")]:
        x=s*jaw*.60
        ell("Inset eye socket",(x,-.151,eye_z),(.059,.031,.024),dark)
        ell("Eye iris",(x-s*.005,-.178,eye_z),(.024,.013,.020),glow)
        ell("Eye pupil",(x-s*.005,-.189,eye_z),(.008,.004,.014),dark)
        tube(rig,"Brow ridge","head",[
            ((x-s*.056,-.170,eye_z+.031),.008,.008),
            ((x,-.172,eye_z+.046),.017,.011),
            ((x+s*.050,-.149,eye_z+.037),.007,.008)],hair,8)
        if bovine:
            ell("Nostril",(s*.096,-.405,1.941),(.029,.009,.012),dark)
        if elven or race in ("thornkin","ashforged","hollowborn","hornwarden"):
            rise=.140 if elven else .083 if race=="thornkin" else .051
            tube(rig,"Tapered racial ear","head",[
                ((s*jaw,.003,2.015),.056,.041),((s*(ear+jaw)/2,.020,2.053),.039,.032),
                ((s*ear,.049,2.043+rise),.003,.004)],skin)
            ell("Ear clasp",(s*(ear+jaw)*.51,-.031,2.044),(.019,.019,.021),gold)
        else:
            ell("Outer ear",(s*ear*.84,.008,2.018),(.041,.040,.071),skin)
        if bovine or race in ("thornkin","ashforged"):
            horn=ear+.20 if bovine else .295 if race=="thornkin" else .256
            z=2.40 if bovine else 2.51 if race=="thornkin" else 2.425
            tube(rig,"Curved horn or antler","head",[
                ((s*jaw*.83,.092,2.151),.067,.064),
                ((s*(jaw+horn)/2,.101,2.210),.051,.047),
                ((s*horn*.90,.064,z-.054),.026,.023),
                ((s*horn,.029,z),.002,.002)],ivory if bovine else leather)
            if race=="thornkin":
                tube(rig,"Antler fork","head",[
                    ((s*.255,.096,2.276),.026,.023),((s*.352,.057,2.365),.018,.017),
                    ((s*.373,.035,2.432),.002,.002)],leather)
            if race=="ashforged":
                tube(rig,"Lower jaw tusk","head",[
                    ((s*.114,-.186,1.880),.024,.022),((s*.137,-.207,1.931),.015,.012),
                    ((s*.143,-.198,1.963),.002,.002)],ivory)
        if race=="hollowborn":
            tube(rig,"Hollow cheek ridge","head",[
                ((s*.169,-.081,1.984),.020,.013),((s*.141,-.139,1.951),.016,.011),
                ((s*.123,-.141,1.927),.006,.005)],ivory,8)
        tube(rig,"RU_MARKING_"+bone,"head",[
            ((s*jaw*.87,-.157,1.998),.005,.006),
            ((s*jaw*.79,-.175,1.975),.010,.008),
            ((s*jaw*.68,-.184,1.955),.003,.004)],glow,8)
    mouth_y=-.356 if bovine else -.188
    tube(rig,"Mouth crease","head",[
        ((-jaw*.48,mouth_y+.011,1.900),.003,.004),
        ((0,mouth_y-.005,1.897),.007,.007),
        ((jaw*.48,mouth_y+.011,1.900),.003,.004)],dark,8)

    for style in range(4):
        prefix=f"RU_HAIR_STYLE_{style}"
        ell(prefix+"_cap",(0,.050,2.148),(jaw*1.22,.178,.117),hair)
        for j in range(7):
            x=(j-3)*jaw*.24
            extra=.040*cos(j*pi/6)
            if style==0:
                tip=(x+.046,.185,2.159)
            elif style==1:
                tip=(x*1.1,.240,1.741+abs(x)*.38)
            elif style==2:
                tip=(x*1.48,.144,2.257+extra)
            else:
                tip=(x*.77,.210,2.085)
            tube(rig,prefix+f"_lock_{j}","head",[
                ((x,-.036,2.213-abs(x)*.22),.042,.034),((x+.019,.072,2.257+extra),.049,.035),
                ((tip[0],.140,2.190+extra),.039,.036),(tip,.002,.003)],hair,10)
        if style==3:
            for sign in (-1,1):
                tube(rig,prefix+f"_braid_{sign}","head",[
                    ((sign*jaw*.68,.121,2.124),.053,.047),((sign*jaw*.97,.142,2.005),.045,.043),
                    ((sign*jaw*.87,.112,1.899),.036,.030),((sign*jaw*.94,.069,1.768),.021,.020),
                    ((sign*jaw,.062,1.724),.003,.004)],hair,11)
                ell(prefix+f"_clasp_{sign}",(sign*jaw*.94,.069,1.775),(.024,.024,.025),gold)
    if race in ("sunborne","aetheri","veilkin","stonehearth"):
        band_color=steel if race=="veilkin" else gold
        tube(rig,"Ancestral diadem","head",[((-jaw,.014,2.173),.012,.013),
            ((-.71*jaw,-.135,2.157),.019,.013),((0,-.181,2.133),.021,.013),
            ((.71*jaw,-.135,2.157),.019,.013),((jaw,.014,2.173),.012,.013)],band_color,9)
        ell("Diadem fitting",(0,-.193,2.159),(.035,.025,.051),glow)
    if race=="stonehearth":
        for sign in (-1,1):
            ell("Forge lens",(sign*.081,-.159,2.186),(.056,.028,.036),gold)

    band(rig,"Leather hip belt","hips",[(.853,0,.017,hip*1.045,.200),
        (.893,0,.020,hip*1.064,.222),(.955,0,.022,hip*1.05,.220)],leather)
    ell("Gilded belt fitting",(0,-.215,.910),(.092,.028,.062),gold,"hips")
    for s,suffix in [(-1,"L"),(1,"R")]:
        arm="arm_"+suffix
        leg="leg_"+suffix
        caliber=.114 if race in ("hornwarden","ashforged","stonehearth") else .093
        tube(rig,"Contoured arm",arm,[
            ((s*.437,0,1.594),caliber*1.25,.136),((s*.498,-.018,1.465),caliber*1.23,.128),
            ((s*.547,-.036,1.325),caliber*.92,.101),((s*.573,-.066,1.183),caliber,.096),
            ((s*.592,-.087,1.038),caliber*.73,.074)],skin)
        ell("Gloved hand",(s*.601,-.106,.982),(.079,.083,.098),leather,arm)
        pauldron=[(s*.341,-.112,1.616),(s*.395,-.147,1.731),(s*.526,-.123,1.767 if guard else 1.705),
                  (s*(.651 if guard else .574),-.103,1.640),(s*.547,-.168,1.559),(s*.408,-.158,1.543)]
        plate(rig,"Fitted shoulder armor",arm,pauldron,.037,steel if guard else armor)
        close_trim(rig,"Shoulder binding",arm,pauldron,.009,gold)
        band(rig,"Fitted forearm guard",arm,[
            (.999,s*.589,-.079,caliber*.84,.086),(1.068,s*.582,-.071,caliber*1.04,.102),
            (1.191,s*.554,-.063,caliber*1.14,.106),(1.221,s*.545,-.056,caliber*.99,.091)],steel if guard else leather)
        band(rig,"Articulated leg",leg,[(.133,s*.230,.034,.103,.101),(.360,s*.237,.012,.098,.106),
            (.547,s*.232,.006,.113,.121),(.707,s*.205,.035,hip*.42,.139),
            (.865,s*.194,.039,hip*.45,.146)],leather)
        band(rig,"Boot",leg,[(.014,s*.226,-.082,.115,.178),(.056,s*.227,-.075,.131,.183),
            (.132,s*.229,-.057,.121,.159),(.209,s*.231,-.005,.111,.118),
            (.371,s*.235,.012,.117,.122),(.405,s*.235,.016,.126,.123)],dark)
        if guard:
            q=[(s*.126,-.109,.365),(s*.146,-.132,.484),(s*.232,-.158,.518),
               (s*.332,-.107,.443),(s*.318,-.125,.312),(s*.226,-.185,.260)]
            plate(rig,"Fitted greave",leg,q,.027,steel)
            close_trim(rig,"Greave binding",leg,q,.008,gold)

    # Class gear remains legible when seen from the Android gameplay camera.
    if guard:
        q=[(-waist,-.208,1.349),(-shoulder*.76,-.161,1.523),(0,-.224,1.482),
           (shoulder*.76,-.161,1.523),(waist,-.208,1.349),(0,-.248,1.211)]
        plate(rig,"Forged chestplate","spine",q,.040,steel)
        close_trim(rig,"Chestplate trim","spine",q,.009,gold)
        q=[(-.915,-.249,1.342),(-.648,-.264,1.439),(-.391,-.252,1.342),(-.438,-.288,1.071),
           (-.548,-.304,.843),(-.648,-.310,.782),(-.795,-.285,.855),(-.893,-.275,1.071)]
        plate(rig,"Kite shield","arm_L",q,.077,steel)
        close_trim(rig,"Shield inlay","arm_L",q,.014,gold)
        ell("Shield boss",(-.648,-.399,1.109),(.074,.033,.074),gold,"arm_L")
        tube(rig,"Sword grip","arm_R",[((.595,-.114,.880),.037,.033),
            ((.602,-.127,1.007),.031,.033),((.628,-.148,1.161),.034,.035)],leather)
        q=[(.560,-.151,1.140),(.697,-.154,1.149),(.731,-.181,1.646),(.693,-.190,1.794),(.633,-.173,1.648)]
        plate(rig,"Forged sword","arm_R",q,.032,steel)
        tube(rig,"Sword crossguard","arm_R",[((.504,-.164,1.140),.015,.018),
            ((.620,-.164,1.149),.030,.030),((.755,-.177,1.170),.014,.018)],gold)
    elif mage:
        band(rig,"Flared mage robe","hips",[(.253,0,.023,hip+.115,.272),(.322,0,.025,hip+.126,.274),
            (.506,0,.021,hip+.079,.245),(.703,0,.022,hip+.028,.22),(.871,0,.017,hip,.206)],armor)
        band(rig,"Robe hem","hips",[(.290,0,.024,hip+.116,.277),(.318,0,.024,hip+.129,.279)],gold)
        tube(rig,"Staff haft","arm_R",[((.772,-.114,.168),.027,.027),((.668,-.129,.637),.027,.027),
            ((.604,-.155,.990),.042,.036),((.584,-.195,1.727),.033,.032)],leather)
        for s in (-1,1):
            tube(rig,"Staff talon","arm_R",[((.584,-.195,1.717),.027,.029),
                ((.584+s*.101,-.204,1.836),.019,.020),((.584+s*.063,-.198,2.034),.007,.008)],gold)
        ell("Staff crystal",(.584,-.200,1.897),(.064,.056,.111),glow,"arm_R")
        ell("Offhand focus",(-.601,-.228,.996),(.056,.063,.075),glow,"arm_L")
    else:
        for s,suffix in [(-1,"L"),(1,"R")]:
            bone="arm_"+suffix
            tube(rig,"Dagger grip",bone,[((s*.600,-.092,1.060),.023,.024),((s*.608,-.134,.974),.030,.029),
                ((s*.630,-.156,.883),.028,.027)],leather)
            q=[(s*.566,-.176,.879),(s*.659,-.172,.906),(s*.750,-.189,.742),(s*.841,-.201,.583),
               (s*.718,-.209,.632),(s*.622,-.192,.771)]
            plate(rig,"Swept dagger",bone,q,.024,steel)
            tube(rig,"Dagger crossguard",bone,[((s*.537,-.171,.887),.011,.011),
                ((s*.623,-.187,.895),.020,.020),((s*.687,-.175,.919),.010,.012)],gold)
        tube(rig,"Cross-body weapon strap","spine",[
            ((-.283,-.161,1.561),.025,.021),((-.113,-.225,1.448),.032,.021),
            ((.083,-.207,1.225),.028,.020),((.216,-.179,1.013),.024,.019)],leather)


def merge_draws(rig):
    """Batch parts by material and visibility toggle without collapsing their skin weights."""
    batches={}
    for obj in list(rig.children):
        if obj.type!="MESH":
            continue
        name=obj.name
        visibility="_".join(name.split("_")[:4]) if name.startswith("RU_HAIR_STYLE_") else ""
        if name.startswith("RU_MARKING_"):
            visibility="RU_MARKING_FEMALE"
        batches.setdefault((obj.data.materials[0].name,visibility),[]).append(obj)
    for (material,visibility),parts in batches.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in parts:obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1:bpy.ops.object.join()
        parts[0].name=visibility or "Female "+material
