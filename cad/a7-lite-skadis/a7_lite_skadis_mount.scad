// Samsung Galaxy Tab A7 Lite wall cradle for IKEA SKADIS.
// Units: millimeters.

tablet_h = 212.5;
tablet_w = 124.7;
tablet_d = 8.0;

side_clearance = 1.0;
depth_clearance = 0.8;

back_thickness = 3.0;
rail_width = 4.0;
rail_front_depth = tablet_d + depth_clearance + 3.0;
bottom_lip_h = 10.0;
top_retainer_h = 8.0;
outer_margin = 5.0;

grid = 40.0;
hook_w = 4.6;
hook_h = 13.0;
hook_depth = 7.0;
hook_cap_w = 10.0;
hook_cap_h = 4.0;
hook_cap_depth = 2.6;
peg_w = 4.8;
peg_h = 12.0;
peg_depth = 5.0;

pocket_w = tablet_w + side_clearance * 2;
pocket_h = tablet_h + side_clearance * 2;
outer_w = pocket_w + rail_width * 2;
outer_h = pocket_h + outer_margin + bottom_lip_h;

x0 = -outer_w / 2;
x1 = outer_w / 2;
pocket_x0 = -pocket_w / 2;
pocket_x1 = pocket_w / 2;
pocket_y0 = bottom_lip_h;
pocket_y1 = bottom_lip_h + pocket_h;
z_front = back_thickness;
z_lip = back_thickness + rail_front_depth;

module box(x0, x1, y0, y1, z0, z1) {
  translate([x0, y0, z0]) cube([x1 - x0, y1 - y0, z1 - z0], center = false);
}

module skadis_hook(cx, cy) {
  box(cx - hook_w / 2, cx + hook_w / 2, cy - hook_h / 2, cy + hook_h / 2, -hook_depth, 0);
  box(cx - hook_cap_w / 2, cx + hook_cap_w / 2, cy + hook_h / 2 - hook_cap_h, cy + hook_h / 2, -hook_depth - hook_cap_depth, -hook_depth);
}

module skadis_peg(cx, cy) {
  box(cx - peg_w / 2, cx + peg_w / 2, cy - peg_h / 2, cy + peg_h / 2, -peg_depth, 0);
}

union() {
  // Back plate.
  box(x0, x1, 0, outer_h, 0, back_thickness);

  // Side rails.
  box(x0, pocket_x0, pocket_y0, pocket_y1, z_front, z_lip);
  box(pocket_x1, x1, pocket_y0, pocket_y1, z_front, z_lip);

  // Bottom lip split for USB-C cable clearance.
  cable_gap = 36.0;
  box(x0, -cable_gap / 2, 0, bottom_lip_h, z_front, z_lip + 2.0);
  box(cable_gap / 2, x1, 0, bottom_lip_h, z_front, z_lip + 2.0);

  // Top corner retainers.
  retainer_w = 22.0;
  box(x0, x0 + retainer_w, pocket_y1 - top_retainer_h, pocket_y1, z_front, z_lip);
  box(x1 - retainer_w, x1, pocket_y1 - top_retainer_h, pocket_y1, z_front, z_lip);

  // Low anti-rattle nubs.
  nub_h = 10.0;
  nub_w = 8.0;
  box(pocket_x0, pocket_x0 + nub_w, pocket_y0 + 22, pocket_y0 + 22 + nub_h, z_lip - 2.0, z_lip + 1.5);
  box(pocket_x1 - nub_w, pocket_x1, pocket_y0 + 22, pocket_y0 + 22 + nub_h, z_lip - 2.0, z_lip + 1.5);

  // SKADIS load hooks and lower stabilizer pegs.
  top_y = 165.0;
  bottom_y = top_y - grid;
  for (cx = [-grid / 2, grid / 2]) {
    skadis_hook(cx, top_y);
    skadis_peg(cx, bottom_y);
  }
}
