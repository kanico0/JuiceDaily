# RawLife Garden — Implementation Handoff (for Devin)

This is the condensed technical reference. Full rationale and specs live in
`rawlifegarden_design_system.md`; full motion detail lives in
`rawlifegarden_animation_storyboard.md`; breakpoint behavior lives in
`rawlifegarden_responsive_spec.md`. This doc should be enough to start
wiring without re-reading all three, but they're the source of truth if
anything here seems ambiguous.

**Scope reminder:** this package is visual assets and specification only.
No React Native components, state management, or Juice Log logic are
included or implied — that's your layer to build on top of this.

## 1. Asset import order

1. `beds/rawlifegarden_bed_*.svg` (×7) — import as your per-area growth
   components. Each file is self-contained and structurally identical.
2. `system/rawlifegarden_master_full.svg` and `_master_compact.svg` — these
   are reference compositions showing correct placement math; in practice
   you'll likely re-compose the seven bed components live (see §4) rather
   than rendering these files verbatim, so you can drive each bed's state
   from real user data.
3. `system/rawlifegarden_discovery_symbols.svg` — discovery animation
   source.
4. `system/rawlifegarden_color_markers.svg` — color-coverage row.
5. `system/rawlifegarden_rainbow_harvest.svg` — Rainbow Harvest elements
   (also embeddable directly from the master files).
6. `system/rawlifegarden_celebration_particles.svg` — particle source (also
   embedded in the rainbow file).
7. `system/rawlifegarden_reduced_motion.svg` — visual reference only, not a
   runtime asset; confirms what "everything animated, resolved instantly"
   should look like.

## 2. Required SVG group names

Every group name is documented in full in `rawlifegarden_asset_manifest.md`.
The ones you'll touch constantly:

- Per bed (`[key]` ∈ `greens, roots, citrus, orchard, berries, tropical, herbs`):
  `bed_[key]_container`, `_soil`, `_boundary`, `_seed`, `_sprout_stem`,
  `_sprout_leaf_left`, `_sprout_leaf_right`, `_growing_layer_01/02`,
  `_harvest_layer_01/02`, `_flourishing_layer_01/02`, `_blossoms`,
  `_highlight`, `_touch_region`.
- Discovery symbols: `symbol_[key]_container`, `_glyph`, `_center_marker`
  (`[key]` ∈ `leafy, root, citrus, orchard, berry, tropical, herb`).
- Color markers: `marker_[key]_container`, `_undiscovered`, `_discovered`,
  `_selected` (`[key]` ∈ `green, red, orange, yellow, purple, tan`).
- Rainbow/celebration: `garden_rainbow_arc`, `garden_rainbow_highlight`,
  `garden_harvest_basket`, `garden_rainbow_badge`,
  `garden_rainbow_particle_01…07`, `garden_particle_01…07`,
  `garden_discovery_droplet`, `garden_discovery_sparkle_01/02/03`.

## 3. Which groups animate vs. stay static

**Animate:** `seed`, `sprout_stem`, `sprout_leaf_left/right`,
`growing_layer_01/02`, `harvest_layer_01/02`, `flourishing_layer_01/02`,
`blossoms`, `highlight` (transient only — never left visible at rest),
`symbol_*_container` (travels), `garden_discovery_droplet`,
`garden_rainbow_arc`, `garden_harvest_basket` (fill-state change only),
`garden_rainbow_badge`, all particle groups, `marker_*` state swaps.

**Never animate / always static:** `soil`, `boundary`, `touch_region`,
`garden_background`, `garden_ground`, `garden_path`.

## 4. Recommended state-driving approach

Don't swap SVG files per growth stage. Instead:
1. Render each bed's SVG (or an inlined RN-SVG component built from the same
   group structure) once per bed.
2. Drive each named layer group's visibility with a `display` prop computed
   from the user's current stage for that bed, per the visibility matrix in
   `rawlifegarden_design_system.md` §6 (same matrix, all seven beds).
3. Position each bed component using the placement table in §3 of the
   design system doc (full screen) or §4 (compact card) — `translate` +
   `scale`, bottom-center anchored.
4. Toggle `garden_rainbow_arc` / `garden_rainbow_badge` visibility based on
   whether all six colors are discovered.

This is exactly how the "five state" reference files were generated — they
are the same components with different state input, not hand-authored
per-state art.

## 5. Animation sequence

Implement the five storyboards from `rawlifegarden_animation_storyboard.md`
as five discrete, non-looping sequences triggered by app events (new produce
logged, growth-stage threshold crossed, new color logged, sixth color
completed, screen/card mount). Do not chain or queue more than 3 discovery
symbols in a single Storyboard 2 run — cap and coordinate per that doc.

## 6. Maximum particle count

**7**, hard cap, used only in Storyboard 5 (Rainbow Harvest). No other
storyboard uses particle groups. Particles always return to `display:none`
at the end of their run — never left rendered.

## 7. Reduced motion

When the OS/app reduced-motion setting is on, every storyboard has a
documented replacement behavior (not a slowed-down version) in the
storyboard doc — mostly instant `display` swaps and short (~100–200ms)
crossfades, with all traveling/scaling/particle/sequential-reveal behavior
removed entirely. Use `rawlifegarden_reduced_motion.svg` as your visual
target for "what should everything look like the instant an animation would
have finished."

## 8. Today-card vs. full-screen usage

- **Today card:** use the compact composition (§4 of the design system doc),
  single tap target for the whole card (no per-bed touch regions needed
  here), reserve the bottom ~80px band for the next-discovery message.
- **Full screen:** use the full composition (§3), seven independent touch
  regions (table in that section), selected-bed overlay per the
  accessibility section (§14) when a bed is tapped.

## 9. Details removable on narrow screens

See `rawlifegarden_responsive_spec.md` for the full table. Short version:
below 360dp you *may* hide `_blossoms` groups and/or merge the two
`flourishing_layer` groups into one render pass if profiling shows a real
need — this is a performance lever, not a required visual change, and
nothing else should be hidden at any supported width.

## 10. SVG compatibility concerns

- No filters, no blur, no CSS animation, no `<script>` in any file — all
  clear for both platforms.
- No gradients used in this pass at all (flat fills + low-opacity overlay
  shapes stand in where "restrained gradient" language appears in the
  brief) — if you want to introduce a real gradient later for the Rainbow
  Harvest glow, keep it to a simple two-stop radial and test on a
  mid-range Android device before shipping, since gradient + opacity
  stacking is the most common react-native-svg render-quality gap between
  platforms.
- All coordinates are plain decimal, two-place precision, no scientific
  notation — no parsing concerns.

## 11. Paths to simplify before implementation

None are structurally complex (every shape is a circle, ellipse, or a
2–3-command bezier path) — nothing here needs pre-simplification. If you
introduce hand-drawn replacement art later, keep individual path `d`
strings under roughly 15–20 commands to stay consistent with this system's
render-cost profile across both platforms.

## 12. Open item

The color palette in `rawlifegarden_design_system.md` §15 is **provisional**
— no real RawLifeFlow brand tokens, screenshots, or existing assets were
available when this system was built. Before shipping, swap
`primary_brand_green`, `card_surface`, `primary_text`, and `secondary_text`
for the app's real tokens at minimum; the Garden-specific produce/soil
colors can likely stay close to as-authored but should get a quick visual
check against the real Today screen first.
