from build123d import *
import math
import os
import sys

WEB = "--web" in sys.argv
DOOR_OPEN_DEG = float(os.environ.get("DOOR_OPEN_DEG", "0" if WEB else "110"))

LENGTH = 424
WIDTH = 180
WHEEL_D = 100
WHEEL_W = 30
WHEELBASE = 350
CLEAR = 60
PLATE_T = 4
LOWER_Z = CLEAR
UPPER_Z = 100
BAY_H = UPPER_Z - LOWER_Z - PLATE_T
WALL = 2

YELLOW = Color(1.0, 0.82, 0.12)
MAROON = Color(0.55, 0.07, 0.10)
RESCUE_RED = Color(0.72, 0.10, 0.12)
NAVY = Color(0.05, 0.11, 0.15)
STEEL = Color(0.24, 0.36, 0.44)
RED = Color(0.9, 0.2, 0.18)
WHITE = Color(0.93, 0.95, 0.96)

parts = []

def add(shape, label, color):
    shape.label = label
    shape.color = color
    parts.append(shape)
    return shape

def box(l, w, h, x, y, z):
    return Pos(x, y, z + h / 2) * Box(l, w, h)

def hollow_box(l, w, h, x, y, z, wall=WALL):
    outer = box(l, w, h, x, y, z)
    inner = box(l - 2 * wall, w - 2 * wall, h - wall, x, y, z)
    return outer - inner

add(box(LENGTH, WIDTH, PLATE_T, 0, 0, LOWER_Z), "Lower plate", NAVY)
add(box(LENGTH, WIDTH, PLATE_T, 0, 0, UPPER_Z), "Upper plate", NAVY)
add(hollow_box(LENGTH - 20, WIDTH - 20, BAY_H, 0, 0, LOWER_Z + PLATE_T), "Electronics bay", MAROON)

slope = Pos(LENGTH / 2 + 16, 0, LOWER_Z + 18) * Rot(0, -25, 0) * Box(70, WIDTH, PLATE_T)
add(slope, "Sloped front plate", NAVY)

for i, sx in enumerate((-1, 1)):
    ax = sx * WHEELBASE / 2
    add(Pos(ax, 0, WHEEL_D / 2) * Rot(90, 0, 0) * Cylinder(4, WIDTH + 2 * WHEEL_W + 8), f"Axle {'front' if sx > 0 else 'rear'}", STEEL)
    for sy in (-1, 1):
        wy = sy * (WIDTH / 2 + WHEEL_W / 2 + 4)
        tyre = Pos(ax, wy, WHEEL_D / 2) * Rot(90, 0, 0) * Cylinder(WHEEL_D / 2, WHEEL_W)
        hub = Pos(ax, wy, WHEEL_D / 2) * Rot(90, 0, 0) * Cylinder(WHEEL_D / 4, WHEEL_W + 2)
        add(tyre, f"Tyre {'front' if sx > 0 else 'rear'} {'left' if sy > 0 else 'right'}", NAVY)
        add(hub, f"Hub {'front' if sx > 0 else 'rear'} {'left' if sy > 0 else 'right'}", STEEL)
    for sy in (-1, 1):
        shock = Pos(ax, sy * 60, WHEEL_D / 2 + 30) * Rot(-sy * 14, 0, 0) * Cylinder(6, 58)
        add(shock, f"Shock {'front' if sx > 0 else 'rear'} {'left' if sy > 0 else 'right'}", STEEL)

z0 = UPPER_Z + PLATE_T
add(hollow_box(110, 126, 60, -150, 0, z0), "Payload compartment", RESCUE_RED)

HX0, HX1 = -90, 100
HL = HX1 - HX0
HW = 154
HH = 100
add(hollow_box(HL, HW, HH, (HX0 + HX1) / 2, 0, z0), "Drone hangar", STEEL)
door_w = HW / 2
for sy, name in ((1, "left"), (-1, "right")):
    door = Pos(0, sy * HW / 2, z0 + HH) * Rot(-sy * DOOR_OPEN_DEG, 0, 0) * Pos(0, -sy * door_w / 2, 1.5) * Box(HL, door_w, 3)
    add(door, f"Hangar door {name}", RESCUE_RED)

MAST_X = 190
add(box(16, 16, 86, MAST_X, 0, z0), "Mast", STEEL)
add(box(30, 30, 24, MAST_X, 0, z0 + 86), "Tilt servo", NAVY)

PHONE_W, PHONE_H, PHONE_T = 160, 75, 9
PIVOT_Z = z0 + 86 + 12
head = Pos(MAST_X + 24, 0, PIVOT_Z) * Rot(0, -8, 0)
add(head * Box(PHONE_T, PHONE_W, PHONE_H), "Phone", NAVY)
add(head * Pos(PHONE_T / 2 + 4, PHONE_W / 2 - 22, PHONE_H / 2 - 14) * Rot(0, 90, 0) * Cylinder(11, 8), "Camera lens", YELLOW)
add(head * Pos(PHONE_T / 2 + 3, 0, -PHONE_H / 2 + 6) * Box(6, 100, 8), "LED bar", WHITE)
add(head * Pos(-PHONE_T / 2 - 6, 0, 0) * Box(10, 20, 50), "Phone clamp spine", STEEL)

add(box(50, 52, 12, 140, -40, z0), "LCD and status LEDs", WHITE)

add(Pos(-LENGTH / 2 - 4, 0, LOWER_Z + 20) * Rot(90, 0, 0) * Torus(18, 3.5), "Tow loop", YELLOW)

BAY_MID_Z = LOWER_Z + PLATE_T + BAY_H / 2
def lettering(label, face_sign):
    t = extrude(Text("BOB", 26, font_style=FontStyle.BOLD, align=(Align.CENTER, Align.CENTER)), amount=2)
    y_out = (WIDTH - 20) / 2 + 2
    if face_sign > 0:
        return Pos(0, y_out, BAY_MID_Z) * Rot(0, 0, 180) * Rot(90, 0, 0) * t
    return Pos(0, -y_out, BAY_MID_Z) * Rot(90, 0, 0) * t

TAPE = Color(0.86, 0.89, 0.91)
bay_wall = (WIDTH - 20) / 2
for sx in (-1, 1):
    for sy in (-1, 1):
        add(box(46, 1.5, 22, sx * 140, sy * (bay_wall + 0.75), BAY_MID_Z - 11), f"Reflective tape side {sx}{sy}", TAPE)
add(box(1.5, 120, 22, -((LENGTH - 20) / 2 + 0.75), 0, BAY_MID_Z - 11), "Reflective tape rear", TAPE)
add(box(1.5, 120, 22, (LENGTH - 20) / 2 + 0.75, 0, BAY_MID_Z - 11), "Reflective tape front", TAPE)
add(box(17.5, 17.5, 14, MAST_X, 0, z0 + 40), "Reflective tape mast", TAPE)

add(lettering("left", 1), "BOB lettering left", WHITE)
add(lettering("right", -1), "BOB lettering right", WHITE)

assembly = Compound(label="Bob v2", children=parts)

if __name__ == "__main__":
    bb = assembly.bounding_box()
    print("size mm: L %.0f W %.0f H %.0f" % (bb.size.X, bb.size.Y, bb.size.Z))
    print("parts:", len(parts))
    if WEB:
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "bob-v2.glb")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        export_gltf(assembly, out, binary=True, linear_deflection=0.8, angular_deflection=0.6)
        print("wrote", os.path.normpath(out), os.path.getsize(out) // 1024, "KB")
    else:
        export_step(assembly, "bob_v2.step")
        export_stl(assembly, "bob_v2.stl")
