# Glow Journey Drop — SVG Asset Manifest

Same technical constraints as the Garden manifest: no external references,
no embedded raster/font data, no scripting, one clip path total in the
whole system (the drop silhouette, reused for fill + highlight).

| Filename | Purpose | ViewBox | W:H | Required? |
|---|---|---|---|---|
| `glowjourney_drop.svg` | Canonical reference drop — Growing stage, 65% weekly fill, 4/7 days | 0 0 400 460 | 20:23 | Required |
| `glowjourney_stage_seed_reference.svg` | Stage-matrix render — Seed | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_stage_sprout_reference.svg` | Stage-matrix render — Sprout | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_stage_growing_reference.svg` | Stage-matrix render — Growing | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_stage_blooming_reference.svg` | Stage-matrix render — Blooming | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_stage_thriving_reference.svg` | Stage-matrix render — Thriving | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_stage_radiant_reference.svg` | Stage-matrix render — Radiant | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_stage_legend_reference.svg` | Stage-matrix render — RawLife Legend | 0 0 400 460 | 20:23 | Optional (reference) |
| `glowjourney_card_empty.svg` | Compact card — new user / empty | 0 0 640 480 | 4:3 | Optional (reference) |
| `glowjourney_card_partial.svg` | Compact card — partial weekly progress | 0 0 640 480 | 4:3 | Optional (reference) |
| `glowjourney_card_completed.svg` | Compact card — weekly Glow completed | 0 0 640 480 | 4:3 | Optional (reference) |
| `glowjourney_card_midstage.svg` | Compact card — mid-stage user (Blooming) | 0 0 640 480 | 4:3 | Optional (reference) |
| `glowjourney_card_highstage.svg` | Compact card — high-stage user (Radiant) | 0 0 640 480 | 4:3 | Optional (reference) |
| `glowjourney_card_reduced_motion.svg` | Compact card — reduced-motion baseline | 0 0 640 480 | 4:3 | Required (reference) |
| `glowjourney_detail_view.svg` | Expanded detail-view direction, milestone overlay shown in place | 0 0 900 760 | 15:12.7 | Required |
| `glowjourney_milestone_overlay.svg` | Standalone celebration overlay card reference | 0 0 400 200 | 2:1 | Required |

## Named groups (every drop-bearing file)

`glowjourney_drop_container`, `glowjourney_drop_glass`, `glowjourney_glow_ring`,
`glowjourney_leaf_halo` (parent of `glowjourney_leaf_01…07`, each with
`_outline` and `_fill` children), `glowjourney_liquid_fill`,
`glowjourney_liquid_highlight`, `glowjourney_drop_outline`,
`glowjourney_liquid_ripple`, `glowjourney_falling_droplet`,
`glowjourney_stage_ornamentation` (parent of `glowjourney_stage_seed`
through `glowjourney_stage_legend`, one visible at a time),
`glowjourney_particle_01…07`, `glowjourney_milestone_overlay`.

**Animate:** `glowjourney_liquid_fill` (y/height), `glowjourney_liquid_ripple`,
`glowjourney_falling_droplet`, every `glowjourney_leaf_XX_fill`,
`glowjourney_glow_ring` (opacity), the active `glowjourney_stage_[name]`
group (crossfade on stage change only), `glowjourney_particle_01…07`,
`glowjourney_milestone_overlay`.
**Never animate:** `glowjourney_drop_outline`'s path geometry itself (only
its stroke color/weight crossfade on stage change — the path never
reshapes), `glowjourney_drop_glass`, every `glowjourney_leaf_XX_outline`.

## Required z-order

`drop_glass` → `glow_ring` → `leaf_halo` → `liquid_fill` →
`liquid_highlight` → `drop_outline` → `liquid_ripple` → `falling_droplet` →
`stage_ornamentation` → `particles` → `milestone_overlay`. (Matches document
order in every generated file — do not reorder without re-checking that the
outline still renders crisply over the liquid.)
