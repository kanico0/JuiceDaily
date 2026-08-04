# RawLifeFlow Progress Experience — Combined Devin Handoff

Covers both systems delivered in this package: **RawLife Garden** and the
redesigned **Glow Journey Drop**. This is the top-level technical summary —
`rawlifegarden_devin_handoff.md` and the Drop-specific docs below have the
full per-system detail; read this first to understand how they fit
together, then go deep on whichever system you're wiring up first.

**Scope reminder (both systems):** visual and motion architecture only. No
streak logic, weekly-progress logic, journey-stage thresholds, celebration
triggering rules, persistence, analytics, Garden discovery rules, Juice Log
rules, or Free/Pro logic is defined or changed here — build all of that as
you already would, and drive these visual components from it.

## 1. What ships in this package

- **RawLife Garden**: 7 bed SVGs, master full + compact compositions, 5
  explicit state renders per format, discovery symbols, color markers,
  Rainbow Harvest assets, celebration particles, reduced-motion reference.
  Full detail: `rawlifegarden_design_system.md`,
  `rawlifegarden_asset_manifest.md`, `rawlifegarden_animation_storyboard.md`,
  `rawlifegarden_responsive_spec.md`, `rawlifegarden_devin_handoff.md`.
- **Glow Journey Drop**: 1 canonical drop, 7 stage-matrix reference renders,
  6 compact card states, 1 expanded detail view, 1 standalone milestone
  overlay reference. Full detail: `rawlifeflow_glowjourney_design_system.md`,
  `rawlifeflow_glowjourney_manifest.md`, `rawlifeflow_glowjourney_storyboard.md`.
- **Shared context**: `rawlifeflow_shared_style_guide.md` — read this to
  understand why certain choices (palette, motion timing, particle caps)
  are intentionally identical across both systems, and which choices are
  intentionally different.

## 2. Where each system lives on screen

- **Today screen**: both compact cards appear as siblings — the Garden
  card (`0 0 1200 540` viewBox, wide) and the Drop card
  (`0 0 640 480` viewBox, taller/narrower) are not the same shape and
  shouldn't be forced into matching dimensions; let each keep its native
  aspect ratio in its own card container.
- **RawLife Garden screen**: full composition (`0 0 1200 900`), seven
  independent tappable regions — see the Garden handoff §8.
- **Glow Journey detail view / bottom sheet**: expanded drop
  (`0 0 900 760`), one tappable object, no sub-regions.

## 3. State-driving pattern (same approach, both systems)

Neither system should swap SVG *files* per state at runtime. In both cases:
render the component once, drive named-group `display`/style properties
from real data, position via the documented transform math. The Garden's
"5 state" files and the Drop's "6 card state" / "7 stage" files are visual
QA references showing what that live toggling should produce — not runtime
assets to swap between.

## 4. Shared technical constraints (both systems)

- No filters, blur, CSS animation, or `<script>` in any file.
- No embedded raster images or fonts; no text embedded in any path.
- Flat fills + low-opacity overlay shapes stand in for "restrained
  gradient" language throughout — no real gradients used in this pass.
- Exactly one clip path in the entire combined package (the Drop's liquid
  clip) — the Garden uses none. Don't introduce additional clips/masks
  without a genuine mechanical need, per both systems' design docs.
- Every animatable element is its own named `<g>` in both systems —
  nothing that needs independent motion is fused into a neighboring path.
- Particle cap: **7**, hard limit, identical rule in both systems, used
  only for each system's biggest celebration moment(s).

## 5. Animation coordination between systems

A single logged juice can affect both systems' underlying data at once
(e.g., it's a new produce item *and* a qualifying day *and* completes the
week). When that happens:
- Fire each system's own storyboard independently and simultaneously —
  don't build a combined "mega-animation." The Garden's discovery
  storyboard and the Drop's update storyboard were each timed
  independently (§ their respective storyboard docs) and are short enough
  (under ~2s each) that seeing both play at once on the Today screen reads
  as "a good juice," not as chaos.
- Never let one system's animation block or delay the other's.
- If both a Garden Rainbow Harvest and a Drop stage celebration
  hypothetically fire from the same event (rare, but possible depending on
  your thresholds), let both play independently rather than suppressing
  one — each is a distinct, rare, earned moment and neither should feel
  like it "lost" to the other.

## 6. Reduced motion (both systems)

Both systems follow the same rule: reduced motion is a *replacement*
behavior (instant or short-crossfade state changes), never a slowed-down
version of the full animation. Reference files:
`rawlifegarden_reduced_motion.svg` (Garden) and
`glowjourney_card_reduced_motion.svg` (Drop) — both show what every
animated moment in their respective system should resolve to instantly.

## 7. Responsive behavior (both systems)

Both master canvases (Garden's two, Drop's two) scale proportionally as a
unit; neither requires per-breakpoint re-authoring. Garden-specific detail
in `rawlifegarden_responsive_spec.md`. Drop-specific note: because the Drop
is a single centered object rather than a multi-part scene, it has
simpler responsive behavior than the Garden — no sub-elements need hiding
at any supported width; only the surrounding native safe-zone text wrapping
needs the usual large-font-scale attention.

## 8. Accessibility (both systems)

Both follow the same non-color-dependent identity rule: Garden beds are
identifiable by silhouette, Drop halo-leaf fill state is always paired with
a permanent outline so an unfilled day is never just empty space. Both cap
touch targets at a 44×44pt minimum. Both treat reduced motion as removing
movement, not slowing it.

## 9. File organization recommendation

```
/assets/progress-experience/
  garden/
    beds/                  (7 files)
    system/                (master + state references, symbols, markers, rainbow, particles, reduced-motion)
  glowjourney/
    glowjourney_drop.svg
    stage-references/      (7 files)
    card-states/           (6 files)
    glowjourney_detail_view.svg
    glowjourney_milestone_overlay.svg
  docs/
    (all .md files from both systems + the shared style guide + this handoff)
```

## 10. Suggested implementation order

1. Static Garden compact card (no animation) — establishes bed placement
   and layer-toggling pattern.
2. Static Drop compact card (no animation) — establishes the liquid-clip
   and halo-toggling pattern.
3. Garden full screen with tap regions.
4. Drop expanded detail view.
5. Reduced-motion paths for both (cheapest storyboards, validates the
   toggling architecture end-to-end before investing in full motion).
6. Garden Storyboards 1–4, Drop Storyboards 1–3 (routine moments).
7. Garden Rainbow Harvest, Drop weekly completion, Drop stage celebration
   (rare, highest-polish moments) — last, since they're the least
   frequently seen and most forgiving of a slightly later ship date.

## 11. Compatibility concerns

None of the shapes in either system are structurally complex — circles,
ellipses, and short bezier paths throughout. The Drop's liquid-fill clip is
the one piece worth a specific test pass on a mid-range Android device
early, since clip-path + animated rect geometry is the combined package's
single most implementation-sensitive piece.

## 12. Open item (both systems)

**The entire palette across both systems is provisional.** No real
RawLifeFlow screenshots, design tokens, typography, or existing SVG assets
were supplied for this brief. Every hex value in
`rawlifegarden_design_system.md` §15 and
`rawlifeflow_glowjourney_design_system.md` §7 should be checked against the
real app before shipping — worth doing as a single reconciliation pass
across both systems together (via the shared style guide's mapping table)
rather than fixing each system's palette separately, since so many tokens
are intentionally shared between them.
