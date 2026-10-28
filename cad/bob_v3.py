from build123d import *
from build123d import Shape
import math
import os
import sys

HANGAR_OPEN_DEG = float(os.environ.get("HANGAR_OPEN_DEG", "100"))
TRAPDOOR_OPEN_DEG = float(os.environ.get("TRAPDOOR_OPEN_DEG", "70"))

PLATE_LEN = 424
PLATE_W = 180
PLATE_T = 4
LOWER_Z = 60
UPPER_Z = 100
WHEEL_D = 100
WHEEL_W = 30
WHEELBASE = 350
WALL = 2

SHELL_HALF_W = 93
SHELL_WALL = 2.5
SHELL_BOTTOM = LOWER_Z + PLATE_T
FRONT_X = 218
REAR_X = -220
BUMP_X0, BUMP_X1 = -100, 108
REAR_TOP = 168
BUMP_TOP = 210
SLOPE_END_Z = 128
FACE_EYE_Z = 98

HX0, HX1 = -90, 100
HW = 154
HH = 100
PAYLOAD_X = -150
CHUTE_OUT = 74
CHUTE_IN = 70

CHARCOAL = Color(0.19, 0.21, 0.23)
CHARCOAL_DARK = Color(0.08, 0.09, 0.10)
ORANGE = Color(1.0, 0.35, 0.08)
STEEL = Color(0.37, 0.43, 0.50)
NAVY = Color(0.05, 0.11, 0.15)
WHITE = Color(0.95, 0.96, 0.97)
TAPE = Color(0.86, 0.89, 0.91)
RED = Color(0.85, 0.12, 0.10)
AMBER = Color(1.0, 0.65, 0.05)
GLASS = Color(0.55, 0.75, 0.9)
PCB = Color(0.1, 0.35, 0.22)
LCD_BLUE = Color(0.12, 0.35, 0.75)
BATTERY = Color(0.2, 0.45, 0.85)

parts = []


def add(shape, label, color):
    shape.label = label
    shape.color = color
    parts.append(shape)
    return shape


def box(l, w, h, x, y, z):
    return Pos(x, y, z + h / 2) * Box(l, w, h)


def hollow_box(l, w, h, x, y, z, wall=WALL, open_top=False):
    outer = box(l, w, h, x, y, z)
    if open_top:
        inner = box(l - 2 * wall, w - 2 * wall, h, x, y, z + wall)
    else:
        inner = box(l - 2 * wall, w - 2 * wall, h - wall, x, y, z)
    return outer - inner


def profile(inset=0.0):
    pts = [
        (REAR_X + inset, SHELL_BOTTOM - 1),
        (REAR_X + inset, REAR_TOP - inset),
        (BUMP_X0 + inset, REAR_TOP - inset),
        (BUMP_X0 + inset, BUMP_TOP - inset),
        (BUMP_X1 - inset, BUMP_TOP - inset),
        (BUMP_X1 - inset, 190 - inset),
        (FRONT_X - inset, SLOPE_END_Z - inset),
        (FRONT_X - inset, SHELL_BOTTOM - 1),
    ]
    return pts


def extrude_profile(pts, half_w):
    with BuildSketch(Plane.XZ) as sk:
        with BuildLine():
            Polyline(*pts, close=True)
        make_face()
    solid = extrude(sk.sketch, amount=half_w, both=True)
    return solid


outer = extrude_profile(profile(0), SHELL_HALF_W)
try:
    outer = fillet(outer.edges().filter_by(Axis.Y), 10)
except Exception:
    pass
try:
    outer = fillet(outer.edges().filter_by(Axis.Z), 14)
except Exception:
    pass
inner = extrude_profile(profile(SHELL_WALL), SHELL_HALF_W - SHELL_WALL)
inner = inner - box(400, 400, 20, 0, 0, SHELL_BOTTOM - 21)
shell = outer - inner
shell = shell - box(500, 500, 30, 0, 0, SHELL_BOTTOM - 30)

roof_hole = box(HX1 - HX0, HW, 12, (HX0 + HX1) / 2, 0, BUMP_TOP - 8)
shell = shell - roof_hole

slope_a = math.degrees(math.atan2(190 - SLOPE_END_Z, FRONT_X - BUMP_X1))
nx = math.sin(math.radians(slope_a))
nz = math.cos(math.radians(slope_a))
cx = (BUMP_X1 + FRONT_X) / 2 + 4
cz = (190 + SLOPE_END_Z) / 2 - 2
lcd_window = Pos(cx, 0, cz) * Rot(0, slope_a, 0) * Box(20, 66, 24)
shell = shell - lcd_window
eye_hole = Pos(FRONT_X, 0, FACE_EYE_Z) * Rot(0, 90, 0) * Cylinder(7.5, 16)
shell = shell - eye_hole
for sy in (-1, 1):
    head_hole = Pos(FRONT_X, sy * 62, FACE_EYE_Z) * Box(14, 30, 10)
    shell = shell - head_hole
    tail_hole = Pos(REAR_X, sy * 65, 120) * Box(14, 40, 8)
    shell = shell - tail_hole
shell = shell - Pos(-165, 0, REAR_TOP) * Cylinder(10, 12)

add(shell, "Outer shell", CHARCOAL)

for sx in (-1, 1):
    ax = sx * WHEELBASE / 2
    for sy in (-1, 1):
        wy = sy * (PLATE_W / 2 + WHEEL_W / 2 + 4)
        ring = Pos(ax, wy, WHEEL_D / 2) * Rot(90, 0, 0) * (Cylinder(58, 34) - Cylinder(55, 40))
        ring = ring & box(200, 60, 80, ax, wy, WHEEL_D / 2)
        add(ring, f"Fender {'front' if sx > 0 else 'rear'} {'left' if sy > 0 else 'right'}", ORANGE)

base_lower = box(PLATE_LEN, PLATE_W, PLATE_T, 0, 0, LOWER_Z)
base_upper = box(PLATE_LEN, PLATE_W, PLATE_T, 0, 0, UPPER_Z)
chute_hole = box(CHUTE_IN, CHUTE_IN, 60, PAYLOAD_X, 0, LOWER_Z - 2)
add(base_lower - chute_hole, "Lower plate", NAVY)
add(base_upper - chute_hole, "Upper plate", NAVY)

BAY_H = UPPER_Z - LOWER_Z - PLATE_T
bay = hollow_box(PLATE_LEN - 20, PLATE_W - 20, BAY_H, 0, 0, LOWER_Z + PLATE_T)
bay = bay - box(CHUTE_OUT, CHUTE_OUT, 60, PAYLOAD_X, 0, LOWER_Z)
add(bay, "Electronics bay", CHARCOAL_DARK)

chute = box(CHUTE_OUT, CHUTE_OUT, 44, PAYLOAD_X, 0, LOWER_Z) - box(CHUTE_IN, CHUTE_IN, 50, PAYLOAD_X, 0, LOWER_Z - 2)
add(chute, "Payload chute", STEEL)
flap = Pos(PAYLOAD_X - 38, 0, LOWER_Z - 1.5) * Rot(0, TRAPDOOR_OPEN_DEG, 0) * Pos(38, 0, 0) * Box(76, 76, 3)
add(flap, "Payload trapdoor", ORANGE)

z0 = UPPER_Z + PLATE_T
add(hollow_box(110, 126, 60, PAYLOAD_X, 0, z0), "Payload compartment", STEEL)

hangar = hollow_box(HX1 - HX0, HW, HH, (HX0 + HX1) / 2, 0, z0, open_top=True)
add(hangar, "Drone hangar", STEEL)
door_w = HW / 2
door_z = BUMP_TOP - SHELL_WALL * 0.6
for sy, name in ((1, "left"), (-1, "right")):
    door = Pos((HX0 + HX1) / 2, sy * HW / 2, door_z) * Rot(-sy * HANGAR_OPEN_DEG, 0, 0) * Pos(0, -sy * door_w / 2, 0) * Box(HX1 - HX0, door_w - 0.6, 3)
    add(door, f"Hangar door {name}", ORANGE)

add(box(120, 45, 28, 60, 0, LOWER_Z + PLATE_T + WALL), "LiPo battery (stand-in)", BATTERY)
add(box(70, 54, 14, -60, 0, LOWER_Z + PLATE_T + WALL), "Arduino (stand-in)", PCB)
for sy in (-1, 1):
    add(box(40, 25, 12, -60, sy * 40, LOWER_Z + PLATE_T + WALL), f"ESC {'left' if sy > 0 else 'right'} (stand-in)", NAVY)
add(box(25, 15, 12, -100, 0, LOWER_Z + PLATE_T + WALL), "3A regulator (stand-in)", PCB)

for sx in (-1, 1):
    ax = sx * WHEELBASE / 2
    side = "front" if sx > 0 else "rear"
    add(Pos(ax, 0, WHEEL_D / 2) * Rot(90, 0, 0) * Cylinder(4, PLATE_W + 2 * WHEEL_W + 8), f"Axle {side}", STEEL)
    for sy in (-1, 1):
        wy = sy * (PLATE_W / 2 + WHEEL_W / 2 + 4)
        lr = "left" if sy > 0 else "right"
        add(Pos(ax, wy, WHEEL_D / 2) * Rot(90, 0, 0) * Cylinder(WHEEL_D / 2, WHEEL_W), f"Tyre {side} {lr}", NAVY)
        add(Pos(ax, wy, WHEEL_D / 2) * Rot(90, 0, 0) * Cylinder(WHEEL_D / 4, WHEEL_W + 2), f"Hub {side} {lr}", STEEL)
        add(Pos(ax, sy * 60, WHEEL_D / 2 + 30) * Rot(-sy * 14, 0, 0) * Cylinder(6, 58), f"Shock {side} {lr}", STEEL)

add(box(4.5, 40.5, 27, 205, 0, FACE_EYE_Z - 13.5), "ESP32-CAM board", PCB)
add(box(6, 8.5, 8.5, 209.5, 0, FACE_EYE_Z - 4.25), "ESP32-CAM sensor", CHARCOAL_DARK)
add(Pos(214, 0, FACE_EYE_Z) * Rot(0, 90, 0) * Cylinder(4.5, 5), "ESP32-CAM lens", CHARCOAL_DARK)
add(Pos(FRONT_X - 1.5, 0, FACE_EYE_Z) * Rot(0, 90, 0) * Cylinder(8.5, 2.5), "Eye window", GLASS)
ring_eye = Pos(FRONT_X + 1.2, 0, FACE_EYE_Z) * Rot(0, 90, 0) * (Cylinder(15, 3) - Cylinder(8, 4))
add(ring_eye, "Eye ring", ORANGE)

for sy in (-1, 1):
    side = "left" if sy > 0 else "right"
    add(box(3, 30, 10, FRONT_X - 0.5, sy * 62, FACE_EYE_Z - 5), f"Headlight {side}", WHITE)
    add(box(3, 40, 8, REAR_X + 0.5, sy * 65, 116), f"Tail light {side}", RED)
add(Pos(-165, 0, REAR_TOP - 4) * Cylinder(10, 11), "Roof beacon", AMBER)

lcd_c = (cx - nx * 8, cz - nz * 8)
add(Pos(lcd_c[0], 0, lcd_c[1]) * Rot(0, slope_a, 0) * Box(36, 80, 12), "LCD 16x2 module", PCB)
scr = (cx - nx * 2, cz - nz * 2)
add(Pos(scr[0], 0, scr[1]) * Rot(0, slope_a, 0) * Box(15, 62, 2), "LCD screen", LCD_BLUE)

bay_mid = LOWER_Z + PLATE_T + BAY_H / 2
side_wall = SHELL_HALF_W
for sx in (-1, 1):
    for sy in (-1, 1):
        add(box(46, 1.5, 22, sx * 150, sy * (side_wall + 0.75), 124), f"Reflective tape side {sx}{sy}", TAPE)
add(box(1.5, 110, 20, REAR_X - 0.75, 0, 140), "Reflective tape rear", TAPE)


def lettering(sign):
    t = extrude(Text("BOB", 30, font_style=FontStyle.BOLD, align=(Align.CENTER, Align.CENTER)), amount=2)
    y_out = side_wall + 2
    if sign > 0:
        return Pos(0, y_out, 130) * Rot(0, 0, 180) * Rot(90, 0, 0) * t
    return Pos(0, -y_out, 130) * Rot(90, 0, 0) * t


add(lettering(1), "BOB lettering left", WHITE)
add(lettering(-1), "BOB lettering right", WHITE)


def baked(parts_in):
    from OCP.BRepBuilderAPI import BRepBuilderAPI_GTransform
    from OCP.gp import gp_GTrsf
    from OCP.TopLoc import TopLoc_Location
    out = []
    for p in parts_in:
        g = gp_GTrsf()
        g.SetTrsf(p.wrapped.Location().Transformation())
        flat = BRepBuilderAPI_GTransform(p.wrapped.Located(TopLoc_Location()), g, True).Shape()
        q = Shape.cast(flat)
        q.label = p.label
        q.color = p.color
        out.append(q)
    return out


import drone_pip

PIP_X = (HX0 + HX1) / 2
PIP_Z = z0 + WALL
for p in drone_pip.build():
    q = Pos(PIP_X, 0, PIP_Z) * p
    q.label = "Pip " + p.label
    q.color = p.color
    parts.append(q)


WEB = "--web" in sys.argv
assembly = Compound(label="Bob v3", children=parts if WEB else baked(parts))


if __name__ == "__main__":
    bb = assembly.bounding_box()
    print("size mm: L %.0f W %.0f H %.0f" % (bb.size.X, bb.size.Y, bb.size.Z), "x %.0f..%.0f" % (bb.min.X, bb.max.X))
    print("parts:", len(parts))
    shell_part = [p for p in parts if p.label == "Outer shell"][0]
    print("shell volume cm3 %.0f valid %s" % (shell_part.volume / 1000, shell_part.is_valid))
    if WEB:
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "bob-v3.glb")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        export_gltf(assembly, out, binary=True, linear_deflection=0.8, angular_deflection=0.6)
        print("wrote", os.path.normpath(out), os.path.getsize(out) // 1024, "KB")
    else:
        export_step(assembly, "bob_v3.step")
        export_stl(assembly, "bob_v3.stl")
