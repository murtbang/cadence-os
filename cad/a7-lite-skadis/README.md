# Galaxy Tab A7 Lite SKADIS mount

Printable wall cradle for a Samsung Galaxy Tab A7 Lite mounted to an IKEA SKADIS pegboard.

## Files

- `a7_lite_skadis_mount.stl` - generated printable mesh
- `generate_a7_lite_skadis_mount.py` - parametric STL generator
- `a7_lite_skadis_mount.scad` - editable reference model for OpenSCAD users

## Baseline dimensions

- Tablet: `212.5 x 124.7 x 8.0 mm`
- Design clearance: `1.0 mm` per side, `0.8 mm` depth
- SKADIS grid: `40 x 40 mm`
- SKADIS slot assumption: `15 x 5 mm`

## Print notes

- Print material: PETG recommended; PLA works if the board is not in sun/heat.
- Suggested orientation: back plate on the bed, hooks facing upward.
- Supports: on, touching build plate. The rear hooks need support in this orientation.
- Wall count: 4+ perimeters.
- Infill: 25-40%.

Check the first fit gently. If your printer runs tight, increase `SIDE_CLEARANCE` in the generator to `1.5` and regenerate.
