# RawLife Garden — Animation Storyboards

General motion character for all five storyboards: organic, soft, brief,
purposeful. Quick start / soft landing. Restrained spring, never elastic.
No overshoot beyond a very small (≤4%) settle. No continuous or looping
motion in any storyboard's end state.

---

## Storyboard 1 — Garden entrance

**Trigger:** Today card or full Garden screen mounts / becomes visible.
**Elements involved:** the whole composition root (`garden_background` and
everything above it as one group), no individual bed elements animate
separately.
**Starting state:** opacity 0, scale 97% (transform origin: canvas center,
600,450 for full / 600,270 for compact).
**Ending state:** opacity 100%, scale 100%, all beds already showing their
correct current growth stage — nothing grows from zero on entrance.
**Movement:** none (scale + fade only).
**Opacity:** 0 → 1, ease-out.
**Scale:** 97% → 100%, ease-out, minimal overshoot (≤1%).
**Rotation:** none.
**Timing:** 400–650ms total, single pass, no stagger between elements.
**Delay:** none.
**Overlaps:** n/a — single combined effect.
**Static elements:** every plant/produce layer is static during this
storyboard; only the outer composition transform animates.
**Reduced motion:** immediate final state, or at most a 100–150ms plain
fade with no scale change.
**Accessibility message concept:** none needed — this is a passive view
transition, not an achievement.

---

## Storyboard 2 — New produce discovery

**Trigger:** a logged juice contains at least one produce item never logged
before.
**Starting state:** relevant `symbol_[key]_glyph` (from
`rawlifegarden_discovery_symbols.svg`) at ~120% scale, positioned just above
the Garden composition (e.g., full screen: centered above y=0, or anchored
near the info panel), opacity 0.
**Ending state:** the target bed's next growth-stage layer group is visible
(display switched on), symbol and droplet are gone (opacity 0 / unmounted),
`garden_particle` groups reset to hidden.

**Elements involved, in sequence:**
1. `symbol_[key]_container` (from the discovery symbols file) — fades in
   above the Garden, holds briefly (~150ms), then translates toward the
   target bed's `bed_[key]_container` center point (documented per-bed
   center: local (160,160) in bed space, converted through that bed's
   placement transform for the current canvas).
   - Transform origin: the symbol's own `symbol_[key]_center_marker` point.
   - Opacity: 0 → 1 → 1 (holds) → 0 (fades out on arrival).
   - Scale: 120% → 100% while traveling (gentle shrink, reinforces "landing").
   - Movement: straight-line or gentle-arc translate from spawn point to
     target bed center; ease-in for the first third, ease-out for the
     landing.
2. `garden_discovery_droplet` — appears at the target bed's center just as
   the symbol arrives, small (start scale 60%), rises slightly (~-12px) and
   fades out.
   - Transform origin: bed center.
   - Opacity: 0 → 1 → 0.
   - Scale: 60% → 100% → 80% (fades while still shrinking slightly).
3. The relevant bed's newly-revealed layer group (e.g.
   `bed_greens_growing_layer_01` if this discovery pushes Green Garden from
   Sprout to Growing) — switches from `display:none` to `display:inline`
   with a quick fade + tiny scale-up (96% → 100%), transform origin: the
   bed's local base point (160, 260).
4. If the discovery is also a new color, the matching
   `marker_[key]_discovered` group swaps in over `marker_[key]_undiscovered`
   with a short fade + scale pulse (100% → 108% → 100%).
5. `bed_[key]_highlight` — switches to `display:inline` at low opacity
   (~30%), holds ~200ms, fades back to `display:none`. This is the "one
   restrained glow," not a pulsing loop — it fires exactly once.

**Timing:** 800–1,300ms total. Steps overlap: step 2 begins as step 1 is
still finishing its landing ease; steps 3–5 begin together right after step
2's droplet appears, and are allowed to overlap each other by ~100–150ms.
**Static elements:** every other bed and every other layer stay untouched.
**Multiple discoveries at once:** cap at 3 simultaneous
`symbol_[key]_container` travels, coordinated (same start delay, staggered
by ~80ms each so they don't visually collide), total sequence still resolves
in under ~2 seconds — never a longer queued "parade."
**Reduced motion:** skip steps 1–2 entirely (no traveling symbol, no
droplet). Immediately reveal the new layer group at full opacity/scale (step
3, but instant), immediately swap the color marker if relevant (step 4,
instant), and fade in a small static discovery badge/toast (native UI, not
in the SVG) instead of the glow.
**Accessibility message concept:** "New produce discovered: [item] added to
[Garden area]."

---

## Storyboard 3 — Garden-area growth stage transition

Five modular sub-transitions, each triggered independently when a bed
crosses a threshold. All operate on one `bed_[key]_container` at a time;
transform origin for every step is the bed's local base point (160, 260)
unless otherwise noted.

### Empty → Seed
- `bed_[key]_seed` display: none → inline.
- Starting: translateY -14px, opacity 0. Ending: translateY 0, opacity 1.
- Ease: gentle ease-out, no bounce ("seed lowers into soil," not "drops in").
- `bed_[key]_soil` gets a one-time highlight ellipse (reuse
  `bed_[key]_highlight` at low opacity) fading in/out around the seed point.
- Timing: ~900ms.

### Seed → Sprout
- `bed_[key]_seed`: inline → none (instant swap, no fade-out needed since
  the stem visually replaces it).
- `bed_[key]_sprout_stem`: none → inline. Scale Y 0 → 100% from the base
  point (grows upward), ~500ms, ease-out.
- `bed_[key]_sprout_leaf_left` / `_right`: none → inline, starting rotated
  ~20° further closed and opacity 0, unfolding to resting angle and opacity
  1, staggered ~120ms after the stem starts, ~450ms each, ease-out, minimal
  settle.
- Timing: ~1,000ms total.

### Sprout → Growing
- `bed_[key]_growing_layer_01`: none → inline, scale 85% → 100% + fade in,
  transform origin bed base point, ~500ms.
- `bed_[key]_growing_layer_02`: same treatment, starts ~150ms after layer 01.
- Existing sprout leaves hold in place (no re-animation).
- Timing: ~900–1,100ms.

### Growing → Harvesting
- `bed_[key]_harvest_layer_01`: none → inline, fade + scale 90% → 100%,
  transform origin bed base point, ~500ms.
- `bed_[key]_harvest_layer_02`: staggered ~150ms after layer 01, same
  treatment.
- `bed_[key]_highlight`: one pass at ~25% opacity over the new produce,
  ~400ms in, ~400ms out, does not loop.
- Timing: ~1,100–1,300ms.

### Harvesting → Flourishing
- `bed_[key]_flourishing_layer_01/02`: staggered fade + scale-in, same
  pattern as above.
- `bed_[key]_blossoms`: fades in last, ~200ms after the flourishing layers,
  small scale pulse (100%→106%→100%) rather than a hard cut.
- `bed_[key]_highlight`: one warm pass, slightly longer hold (~250ms) than
  earlier stages, then fades to `display:none` — the bed is fully still
  immediately after.
- Timing: ~1,300–1,600ms (the longest of the five, matching it being the
  most visually complete transition).

**Reduced motion (all five sub-transitions):** replace every scale/unfold/
translate step with a single ~150–200ms crossfade from the previous static
state directly to the new static state. No intermediate unfolding frame is
ever shown.
**Accessibility message concept:** "[Garden area] grew to [stage]."

---

## Storyboard 4 — New produce-color discovery

**Trigger:** the first produce item in a given color family is logged
(independent of whether it also happens to be a brand-new produce item —
if both fire at once, Storyboard 2 and Storyboard 4's marker-swap step run
together rather than twice).
**Elements involved:** one `marker_[key]_container` (color markers file),
one small matching accent on the relevant bed (reuse of that bed's
`highlight` group).
**Sequence:**
1. `marker_[key]_undiscovered` → `display:none`,
   `marker_[key]_discovered` → `display:inline`, appearing with a
   scale pulse 100% → 110% → 100%, transform origin the marker's own
   center (local 70,60 within its tile).
2. `bed_[key]_highlight` on the most relevant bed for that color fires once
   at low opacity, ~300ms, no loop.
**Opacity:** marker fill fades in over ~200ms as part of the swap; highlight
per its normal 0→~0.3→0 pass.
**Scale:** marker only, as above. No scale change on the bed itself.
**Rotation:** none.
**Timing:** 450–800ms total.
**Static elements:** every other marker and every other bed.
**Reduced motion:** instant marker swap with a short (~120ms) fade only, no
scale pulse, no bed highlight.
**Accessibility message concept:** "New color discovered: [color name]."

---

## Storyboard 5 — Rainbow Harvest

**Trigger:** the sixth and final color family is discovered.
**Elements involved:** `garden_rainbow_arc`, `garden_rainbow_highlight`,
`garden_harvest_basket` (already present — this storyboard changes its
"filled" appearance rather than its visibility), `garden_rainbow_badge`,
`garden_rainbow_particle_01…07`, plus a brief sequential brightening across
all seven `bed_[key]_highlight` groups.
**Sequence:**
1. Final `marker_[key]_discovered` swap completes (reuses Storyboard 4).
2. `garden_rainbow_arc`: `display:none` → `inline`, revealed as a left-to-
   right "draw-on" — implementation note: since this system avoids SVG
   stroke-dashoffset scripting complexity, achieve the draw-on with a
   clip-rect (a plain rectangular mask group, not a complex path clip) that
   widens from x=40 to full width over the reveal duration, OR — the
   simpler, equally acceptable option — a straight opacity fade if
   stroke-based reveal isn't worth the implementation cost. Either reading
   satisfies "reveals from one side to the other" vs. "reveals," and the
   opacity fade is the recommended default for a first release.
   Duration: ~700ms.
3. Each `bed_[key]_highlight`, greens → roots → citrus → orchard → berries →
   tropical → herbs, fires in a quick sequence (~80ms stagger, ~300ms each,
   heavy overlap) — a gentle wave of brightening across the whole Garden,
   not a spotlight jumping bed to bed.
4. `garden_harvest_basket`'s "filled" visual treatment applies (if the
   basket has an empty/filled visual difference — otherwise this step is a
   no-op and the basket's presence alone is sufficient) with a small rise
   (translateY -8px → 0) and settle, ~400ms, starting after step 3 begins.
5. `garden_rainbow_badge`: `display:none` → `inline`, fade + scale 80% →
   100%, ~350ms, starting right after the basket settles.
6. `garden_rainbow_particle_01…07`: `display:none` → `inline`, each rising
   ~40–60px from just above the badge with a fade out, staggered ~60ms
   apart, ~600ms each including the fade-out — then every particle group
   returns to `display:none` for good.
7. `garden_rainbow_highlight`: a single soft glow across the whole
   composition, fades in during steps 3–5 and settles to a very low
   resting opacity (~8–10%) rather than fading fully to zero — this is the
   one storyboard allowed a slightly-elevated (not animated) resting glow,
   since Rainbow Harvest is a permanent state, not a transient one.

**Timing:** 1.8–2.8s total, no looping, ends fully static.
**Static elements:** all seven beds' plant/produce layers themselves do not
re-animate in this storyboard — only their `highlight` groups do.
**Reduced motion:** `garden_rainbow_arc`, `garden_harvest_basket`'s filled
state, and `garden_rainbow_badge` all fade in together as one ~200ms group
(or appear instantly), no draw-on, no sequential bed brightening, no
particles, no scale pulse. `garden_rainbow_highlight` still settles to its
low resting opacity, since that's a static state, not motion.
**Accessibility message concept:** "Rainbow Harvest complete — every produce
color explored."

---

## Cross-storyboard rules

- No storyboard reuses `garden_particle_*` or `garden_rainbow_particle_*`
  outside its own sequence; both groups return to `display:none` at the end
  of every run, with no exceptions.
- No storyboard ever leaves `bed_[key]_highlight` visible at rest — it is a
  transient-only group in every one of the five storyboards.
- Maximum particle count in any single moment: 7 (Rainbow Harvest is the
  only storyboard that uses particles at all).
- Every reduced-motion variant above is a *replacement* behavior, not a
  slowed-down version of the full animation — this matches the brief's
  explicit instruction not to treat reduced motion as "merely slower."
