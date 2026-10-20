from build123d import *
import math
import sys

ORANGE = Color(1.0, 0.35, 0.08)
CHARCOAL = Color(0.19, 0.21, 0.23)
DARK = Color(0.08, 0.09, 0.10)
STEEL = Color(0.37, 0.43, 0.50)
PCB = Color(0.1, 0.35, 0.22)
BATTERY = Color(0.2, 0.45, 0.85)
WHITE = Color(0.95, 0.96, 0.97)
GLASS = Color(0.55, 0.75, 0.9)
AMBER = Color(1.0, 0.65, 0.05)
RED = Color(0.85, 0.12, 0.10)
PACK = [Color(0.9, 0.15, 0.12), Color(0.95, 0.8, 0.1), Color(0.2, 0.7, 0.35)]

DUCT_OD = 66
DUCT_ID = 61
DUCT_H = 28
DUCT_X = 50
DUCT_Y = 34
PLATE_X = 36
PLATE_Y = 80
PLATE_T = 2.5
BOTTOM_Z = 26
TOP_Z = 44


def box(l, w, h, x, y, z):
    return Pos(x, y, z + h / 2) * Box(l, w, h)


def cyl(r, h, x, y, z):
    return Pos(x, y, z + h / 2) * Cylinder(r, h)


def build():
    parts = []

    def add(shape, label, color):
        shape.label = label
        shape.color = color
        parts.append(shape)

    corners = [(sx, sy) for sx in (1, -1) for sy in (1, -1)]

    def corner_name(sx, sy):
        return ("front" if sx > 0 else "rear") + " " + ("left" if sy > 0 else "right")

    for sx, sy in corners:
        cx, cy = sx * DUCT_X, sy * DUCT_Y
        add(cyl(DUCT_OD / 2, DUCT_H, cx, cy, 0) - cyl(DUCT_ID / 2, DUCT_H + 2, cx, cy, -1), "Duct " + corner_name(sx, sy), ORANGE)
        mount = box(DUCT_ID + 3, 3, 2.5, cx, cy, 7) + box(3, DUCT_ID + 3, 2.5, cx, cy, 7)
        add(mount, "Motor mount " + corner_name(sx, sy), CHARCOAL)
        add(cyl(7, 12, cx, cy, 9.5), "Motor " + corner_name(sx, sy), STEEL)
        blade = Pos(cx, cy, 23.4) * Rot(0, 0, 25 + (45 if sx * sy > 0 else 0)) * Box(58, 5, 1.2)
        add(blade + cyl(3, 3, cx, cy, 21.5), "Propeller " + corner_name(sx, sy), DARK)

    bottom = box(PLATE_X, PLATE_Y, PLATE_T, 0, 0, BOTTOM_Z)
    top = box(PLATE_X, PLATE_Y, PLATE_T, 0, 0, TOP_Z)
    try:
        bottom = fillet(bottom.edges().filter_by(Axis.Z), 5)
        top = fillet(top.edges().filter_by(Axis.Z), 5)
    except Exception:
        pass
    add(bottom, "Frame bottom plate", CHARCOAL)
    add(top, "Frame top plate", CHARCOAL)

    for sx, sy in corners:
        add(cyl(2, TOP_Z - BOTTOM_Z - PLATE_T, sx * 12, sy * 32, BOTTOM_Z + PLATE_T), "Standoff " + corner_name(sx, sy), STEEL)
        add(box(8, 10, 4, sx * 19, sy * DUCT_Y, BOTTOM_Z - 0.5), "Arm " + corner_name(sx, sy), CHARCOAL)

    add(box(22, 55, 14, 0, 0, BOTTOM_Z + PLATE_T), "LiPo battery (stand-in)", BATTERY)

    add(box(20, 25, 3, -8, 0, TOP_Z + PLATE_T), "Flight controller (stand-in)", PCB)
    add(cyl(1, 30, -12, 15, TOP_Z + PLATE_T), "Antenna", DARK)

    tilt = 10
    base = TOP_Z + PLATE_T
    cam_y = -9
    th_y = 11
    cam_frame = Pos(3, cam_y, base) * Rot(0, -tilt, 0)
    add(cam_frame * Pos(7, 0, 9) * Box(14, 18, 18), "Camera module", DARK)
    add(cam_frame * Pos(14 + 2.5, 0, 9) * Rot(0, 90, 0) * Cylinder(5, 5), "Camera lens", GLASS)
    th_frame = Pos(4, th_y, base) * Rot(0, -tilt, 0)
    add(th_frame * Pos(6, 0, 6) * Box(12, 14, 12), "Thermal camera (stand-in)", CHARCOAL)
    add(th_frame * Pos(12 + 1.5, 0, 6) * Rot(0, 90, 0) * Cylinder(4, 3), "Thermal lens", DARK)

    for sy in (1, -1):
        add(box(3, 10, 6, 17, sy * 29, TOP_Z + PLATE_T), "Front light " + ("left" if sy > 0 else "right"), WHITE)
    add(Pos(-10, -26, TOP_Z + PLATE_T + 4) * Sphere(4), "Beacon", AMBER)
    add(box(8, 8, 2, 0, -30, BOTTOM_Z - 2), "Belly light", WHITE)
    add(box(2, 10, 2.5, -19, 20, TOP_Z), "Rear light left", RED)
    add(box(2, 10, 2.5, -19, -20, TOP_Z), "Rear light right", RED)

    drum_z = 12
    drum = Pos(0, 0, drum_z) * Rot(90, 0, 0) * Cylinder(10, 44)
    for k in range(3):
        a = 120 * k
        slot = Pos(0, 0, drum_z) * Rot(0, a, 0) * Pos(0, 0, 8.5) * Box(9, 24, 6)
        drum = drum - slot
    add(drum, "Dispenser drum", STEEL)
    for k in range(3):
        a = 120 * k
        pk = Pos(0, 0, drum_z) * Rot(0, a, 0) * Pos(0, 0, 9) * Box(7, 22, 4.5)
        add(pk, "Packet %d" % (k + 1), PACK[k])
    add(box(12, 22.5, 22, 0, 33.5, 1.5), "Dispenser servo (stand-in)", DARK)
    add(Pos(0, 21, drum_z) * Rot(90, 0, 0) * Cylinder(2.5, 4), "Servo shaft", STEEL)
    add(box(18, 3, 2, 0, -24, drum_z - 10), "Dispenser guard", CHARCOAL)

    return parts


def baked(parts_in):
    from OCP.BRepBuilderAPI import BRepBuilderAPI_GTransform
    from OCP.gp import gp_GTrsf
    from OCP.TopLoc import TopLoc_Location
    out = []
    for p in parts_in:
        g = gp_GTrsf()
        g.SetTrsf(p.wrapped.Location().Transformation())
        flat = BRepBuilderAPI_GTransform(p.wrapped.Located(TopLoc_Location()), g, True).Shape()
        q = __import__("build123d").Shape.cast(flat)
        q.label = p.label
        q.color = p.color
        out.append(q)
    return out


parts = build()

WEB = "--web" in sys.argv

if __name__ == "__main__":
    if WEB:
        import os
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models", "pip.glb")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        export_gltf(Compound(label="Pip", children=parts), out, binary=True, linear_deflection=0.5, angular_deflection=0.5)
        print("wrote", os.path.normpath(out), os.path.getsize(out) // 1024, "KB")
        sys.exit(0)
    assembly = Compound(label="Pip drone", children=baked(parts))
    bb = assembly.bounding_box()
    print("size mm: L %.0f W %.0f H %.0f" % (bb.size.X, bb.size.Y, bb.size.Z), "x %.0f..%.0f y %.0f..%.0f z %.0f..%.0f" % (bb.min.X, bb.max.X, bb.min.Y, bb.max.Y, bb.min.Z, bb.max.Z))
    print("parts:", len(parts))
    export_step(assembly, "pip.step")
    export_stl(assembly, "pip.stl")
