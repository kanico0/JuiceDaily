# RawLife Garden — SVG Asset Manifest

All files are plain SVG, no external references, no embedded raster/font
data, no scripting. Widths/heights below are the authored `viewBox`; all
files scale proportionally when the implementation sets a different
`width`/`height` in react-native-svg.

## Garden-bed files (`beds/`)

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `rawlifegarden_bed_greens.svg` | Green Garden, all 6 growth states as toggleable groups | 0 0 320 320 | 1:1 | Required |
| `rawlifegarden_bed_roots.svg` | Root Garden, all 6 growth states | 0 0 320 320 | 1:1 | Required |
| `rawlifegarden_bed_citrus.svg` | Citrus Grove, all 6 growth states | 0 0 320 320 | 1:1 | Required |
| `rawlifegarden_bed_orchard.svg` | Orchard, all 6 growth states | 0 0 320 320 | 1:1 | Required |
| `rawlifegarden_bed_berries.svg` | Berry & Purple Patch, all 6 growth states | 0 0 320 320 | 1:1 | Required |
| `rawlifegarden_bed_tropical.svg` | Tropical Garden, all 6 growth states | 0 0 320 320 | 1:1 | Required |
| `rawlifegarden_bed_herbs.svg` | Herb & Booster Bed, all 6 growth states | 0 0 320 320 | 1:1 | Required |

Each bed file ships with its demo `display` styles set to the **Harvesting**
state so it previews something meaningful on its own; the implementation is
expected to override `display` per group at runtime according to the
visibility matrix (`rawlifegarden_design_system.md` §6), not to swap files
per state.

**Named groups inside every bed file** (prefix `bed_[key]_`, where `[key]`
is one of `greens`, `roots`, `citrus`, `orchard`, `berries`, `tropical`,
`herbs`):
`container`, `soil`, `boundary`, `seed`, `sprout_stem`, `sprout_leaf_left`,
`sprout_leaf_right`, `growing_layer_01`, `growing_layer_02`,
`harvest_layer_01`, `harvest_layer_02`, `flourishing_layer_01`,
`flourishing_layer_02`, `blossoms`, `highlight`, `touch_region`.

**Animation targets:** `seed`, `sprout_stem`, `sprout_leaf_left`,
`sprout_leaf_right`, `growing_layer_01/02`, `harvest_layer_01/02`,
`flourishing_layer_01/02`, `blossoms`, `highlight` (transient use only).
**Static/never animated:** `soil`, `boundary`, `touch_region`.

## Master compositions (`system/`)

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `rawlifegarden_master_full.svg` | Canonical full-screen Garden, default "Growing Garden" demo state | 0 0 1200 900 | 4:3 | Required |
| `rawlifegarden_master_compact.svg` | Canonical Today-card Garden, default "Growing Garden" demo state | 0 0 1200 540 | 2.22:1 | Required |
| `rawlifegarden_full_state_empty.svg` | Full-screen, State 1 (New user) | 0 0 1200 900 | 4:3 | Optional (reference) |
| `rawlifegarden_full_state_early.svg` | Full-screen, State 2 (Early exploration) | 0 0 1200 900 | 4:3 | Optional (reference) |
| `rawlifegarden_full_state_growing.svg` | Full-screen, State 3 — identical to `master_full.svg` | 0 0 1200 900 | 4:3 | Optional (duplicate of master, kept for a complete labeled state set) |
| `rawlifegarden_full_state_advanced.svg` | Full-screen, State 4 (Advanced Garden) | 0 0 1200 900 | 4:3 | Optional (reference) |
| `rawlifegarden_full_state_rainbow.svg` | Full-screen, State 5 (Rainbow Harvest) | 0 0 1200 900 | 4:3 | Optional (reference) |
| `rawlifegarden_compact_state_empty.svg` | Compact card, State 1 | 0 0 1200 540 | 2.22:1 | Optional (reference) |
| `rawlifegarden_compact_state_early.svg` | Compact card, State 2 | 0 0 1200 540 | 2.22:1 | Optional (reference) |
| `rawlifegarden_compact_state_growing.svg` | Compact card, State 3 — identical to `master_compact.svg` | 0 0 1200 540 | 2.22:1 | Optional (duplicate of master) |
| `rawlifegarden_compact_state_advanced.svg` | Compact card, State 4 | 0 0 1200 540 | 2.22:1 | Optional (reference) |
| `rawlifegarden_compact_state_rainbow.svg` | Compact card, State 5 | 0 0 1200 540 | 2.22:1 | Optional (reference) |

**Why the "state" files exist alongside the master files:** the master files
are what the implementation actually wires up at runtime (toggling bed-layer
and rainbow/badge visibility live, per user data). The five state files per
format are static reference renders of what that live toggling should
produce at each milestone — useful for visual QA and stakeholder review, not
meant to be swapped in as separate runtime assets.

**Named groups inside every master file:** `garden_background`,
`garden_ground`, `garden_path`, `garden_soft_highlight`, one full
`bed_[key]_container` (with all its children, per the bed manifest above)
for each of the seven beds, `garden_rainbow_arc`, `garden_harvest_basket`,
`garden_rainbow_badge`, `garden_discovery_droplet`,
`garden_discovery_sparkle_01/02/03`, `garden_particle_01…07`.

**Required z-order:** exactly the document order listed above (SVG paints in
source order; do not reorder groups without re-checking overlap at the
Orchard/Root/Citrus boundary, the one place beds sit close enough to overlap
at full Flourishing scale).

## Discovery symbols

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `rawlifegarden_discovery_symbols.svg` | Seven generic produce-family symbols in one strip | 0 0 840 120 | 7:1 | Required |

Groups: `symbol_[key]_container`, `symbol_[key]_glyph`,
`symbol_[key]_center_marker` (invisible, animation anchor) for
`leafy, root, citrus, orchard, berry, tropical, herb`.

## Produce-color markers

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `rawlifegarden_color_markers.svg` | Six color markers, each with 3 states | 0 0 840 120 | 7:1 | Required |

Groups: `marker_[key]_container`, `marker_[key]_undiscovered`,
`marker_[key]_discovered`, `marker_[key]_selected` for
`green, red, orange, yellow, purple, tan`.

## Rainbow Harvest & celebration

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `rawlifegarden_rainbow_harvest.svg` | Standalone Rainbow Harvest reference (arc, glow, basket, badge, particles) | 0 0 800 480 | 5:3 | Required |
| `rawlifegarden_celebration_particles.svg` | Reference sheet, 7 particles only | 0 0 400 400 | 1:1 | Optional (particles are also embedded in every rainbow-carrying master/state file) |

Groups: `garden_rainbow_arc`, `garden_rainbow_highlight`,
`garden_harvest_basket`, `garden_rainbow_badge`,
`garden_rainbow_particle_01…07` (in the harvest file);
`garden_particle_01…07` (in the standalone particle sheet).

## Reduced motion

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `rawlifegarden_reduced_motion.svg` | Static composite reference: one flourishing bed + all color markers (discovered) + rainbow badge, zero motion elements | 0 0 900 320 | 2.8:1 | Required (reference only — the actual reduced-motion experience is produced by the master files with animation disabled, not by swapping to this file) |

## Documentation files

| Filename | Purpose |
|---|---|
| `rawlifegarden_design_system.md` | Full design rationale, composition specs, area specs, matrices, state descriptions, color palette, accessibility, QC checklist |
| `rawlifegarden_asset_manifest.md` | This file |
| `rawlifegarden_animation_storyboard.md` | All five motion storyboards in full implementation detail |
| `rawlifegarden_responsive_spec.md` | Breakpoint behavior and safe-zone adjustments |
| `rawlifegarden_devin_handoff.md` | Condensed technical handoff for the implementation agent |
