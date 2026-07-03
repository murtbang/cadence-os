from pathlib import Path


# Units are millimeters.
TABLET_H = 212.5
TABLET_W = 124.7
TABLET_D = 8.0

SIDE_CLEARANCE = 1.0
DEPTH_CLEARANCE = 0.8

BACK_THICKNESS = 3.0
RAIL_WIDTH = 4.0
RAIL_FRONT_DEPTH = TABLET_D + DEPTH_CLEARANCE + 3.0
BOTTOM_LIP_H = 10.0
TOP_RETAINER_H = 8.0
OUTER_MARGIN = 5.0

HOOK_W = 4.6
HOOK_H = 13.0
HOOK_DEPTH = 7.0
HOOK_CAP_W = 10.0
HOOK_CAP_H = 4.0
HOOK_CAP_DEPTH = 2.6
PEG_W = 4.8
PEG_H = 12.0
PEG_DEPTH = 5.0

GRID = 40.0


def add_box(boxes, x0, x1, y0, y1, z0, z1):
    if x1 <= x0 or y1 <= y0 or z1 <= z0:
        raise ValueError((x0, x1, y0, y1, z0, z1))
    boxes.append((float(x0), float(x1), float(y0), float(y1), float(z0), float(z1)))


def build_boxes():
    boxes = []
    pocket_w = TABLET_W + SIDE_CLEARANCE * 2
    pocket_h = TABLET_H + SIDE_CLEARANCE * 2
    outer_w = pocket_w + RAIL_WIDTH * 2
    outer_h = pocket_h + OUTER_MARGIN + BOTTOM_LIP_H

    x0 = -outer_w / 2
    x1 = outer_w / 2
    y0 = 0
    y1 = outer_h
    z_back = 0
    z_front = BACK_THICKNESS
    z_lip = BACK_THICKNESS + RAIL_FRONT_DEPTH

    pocket_x0 = -pocket_w / 2
    pocket_x1 = pocket_w / 2
    pocket_y0 = BOTTOM_LIP_H
    pocket_y1 = BOTTOM_LIP_H + pocket_h

    # Back plate.
    add_box(boxes, x0, x1, y0, y1, z_back, z_front)

    # Side rails.
    add_box(boxes, x0, pocket_x0, pocket_y0, pocket_y1, z_front, z_lip)
    add_box(boxes, pocket_x1, x1, pocket_y0, pocket_y1, z_front, z_lip)

    # Bottom lip, split for USB-C cable clearance.
    cable_gap = 36.0
    add_box(boxes, x0, -cable_gap / 2, y0, BOTTOM_LIP_H, z_front, z_lip + 2.0)
    add_box(boxes, cable_gap / 2, x1, y0, BOTTOM_LIP_H, z_front, z_lip + 2.0)

    # Top corner retainers keep the tablet from tipping forward.
    retainer_w = 22.0
    add_box(boxes, x0, x0 + retainer_w, pocket_y1 - TOP_RETAINER_H, pocket_y1, z_front, z_lip)
    add_box(boxes, x1 - retainer_w, x1, pocket_y1 - TOP_RETAINER_H, pocket_y1, z_front, z_lip)

    # Low front nubs near the bottom reduce rattle without blocking the display.
    nub_h = 10.0
    nub_w = 8.0
    add_box(boxes, pocket_x0, pocket_x0 + nub_w, pocket_y0 + 22, pocket_y0 + 22 + nub_h, z_lip - 2.0, z_lip + 1.5)
    add_box(boxes, pocket_x1 - nub_w, pocket_x1, pocket_y0 + 22, pocket_y0 + 22 + nub_h, z_lip - 2.0, z_lip + 1.5)

    # SKADIS attachment pattern: two load hooks and two lower stabilizer pegs.
    # Centers are on a 40 x 40 mm grid and fit the stagger-insensitive vertical column.
    hook_xs = [-GRID / 2, GRID / 2]
    top_y = 165.0
    bottom_y = top_y - GRID

    for cx in hook_xs:
        # Through-slot hook stem.
        add_box(boxes, cx - HOOK_W / 2, cx + HOOK_W / 2, top_y - HOOK_H / 2, top_y + HOOK_H / 2, -HOOK_DEPTH, 0)
        # Rear cap catches behind the pegboard after the mount drops down.
        add_box(
            boxes,
            cx - HOOK_CAP_W / 2,
            cx + HOOK_CAP_W / 2,
            top_y + HOOK_H / 2 - HOOK_CAP_H,
            top_y + HOOK_H / 2,
            -HOOK_DEPTH - HOOK_CAP_DEPTH,
            -HOOK_DEPTH,
        )
        # Lower anti-sway peg.
        add_box(boxes, cx - PEG_W / 2, cx + PEG_W / 2, bottom_y - PEG_H / 2, bottom_y + PEG_H / 2, -PEG_DEPTH, 0)

    return boxes


def mesh_from_boxes(boxes):
    xs = sorted({v for b in boxes for v in (b[0], b[1])})
    ys = sorted({v for b in boxes for v in (b[2], b[3])})
    zs = sorted({v for b in boxes for v in (b[4], b[5])})

    xi = {v: i for i, v in enumerate(xs)}
    yi = {v: i for i, v in enumerate(ys)}
    zi = {v: i for i, v in enumerate(zs)}
    filled = set()

    for x0, x1, y0, y1, z0, z1 in boxes:
        for ix in range(xi[x0], xi[x1]):
            for iy in range(yi[y0], yi[y1]):
                for iz in range(zi[z0], zi[z1]):
                    filled.add((ix, iy, iz))

    faces = []

    def add_quad(points):
        faces.append((points[0], points[1], points[2]))
        faces.append((points[0], points[2], points[3]))

    for ix, iy, iz in sorted(filled):
        x0, x1 = xs[ix], xs[ix + 1]
        y0, y1 = ys[iy], ys[iy + 1]
        z0, z1 = zs[iz], zs[iz + 1]

        if (ix - 1, iy, iz) not in filled:
            add_quad([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)])
        if (ix + 1, iy, iz) not in filled:
            add_quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)])
        if (ix, iy - 1, iz) not in filled:
            add_quad([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)])
        if (ix, iy + 1, iz) not in filled:
            add_quad([(x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (x1, y1, z0)])
        if (ix, iy, iz - 1) not in filled:
            add_quad([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)])
        if (ix, iy, iz + 1) not in filled:
            add_quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)])

    return faces


def normal(a, b, c):
    ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
    nx = uy * vz - uz * vy
    ny = uz * vx - ux * vz
    nz = ux * vy - uy * vx
    length = (nx * nx + ny * ny + nz * nz) ** 0.5 or 1
    return nx / length, ny / length, nz / length


def write_stl(path, faces):
    lines = ["solid a7_lite_skadis_mount"]
    for tri in faces:
        n = normal(*tri)
        lines.append(f"  facet normal {n[0]:.6g} {n[1]:.6g} {n[2]:.6g}")
        lines.append("    outer loop")
        for x, y, z in tri:
            lines.append(f"      vertex {x:.6g} {y:.6g} {z:.6g}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append("endsolid a7_lite_skadis_mount")
    path.write_text("\n".join(lines) + "\n", encoding="ascii")


if __name__ == "__main__":
    out = Path(__file__).with_name("a7_lite_skadis_mount.stl")
    write_stl(out, mesh_from_boxes(build_boxes()))
    print(out)
