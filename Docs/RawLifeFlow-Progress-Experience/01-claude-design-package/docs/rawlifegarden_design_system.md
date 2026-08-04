# RawLife Garden — Visual & Motion Design System
### A companion feature to RawLifeFlow: Juicing Daily
Prepared for handoff to implementation (react-native-svg). This document is the
authoritative visual reference; `rawlifegarden_devin_handoff.md` is the short
technical summary for the implementation agent.

---

## 1. Executive design summary

RawLife Garden is a **calm, illustrated map of dietary exploration**. It has
no health bars, no characters, no competition, and no punishment. It is a
still, warm garden scene divided into seven recognizable areas — Green
Garden, Root Garden, Citrus Grove, Orchard, Berry & Purple Patch, Tropical
Garden, and Herb & Booster Bed — that fill in gradually as the person tries
more kinds of produce. It sits still while idle and animates briefly only at
five specific, meaningful moments. It never duplicates the Glow Journey
Drop's job of showing *consistency*; it exists only to show the *breadth* of
what someone has explored.

The system ships as layered, named SVG groups so growth can be revealed by
toggling visibility rather than by swapping flattened images, and every
animated moment has a fully static reduced-motion equivalent.

---

## 2. Visual-design rationale

**Emotional goal.** The Garden should feel like tending something calm and
personal — closer to paging through a well-loved seed catalogue than
playing a game. Nothing should demand attention. It should reward a glance,
not require one.

**Relationship to the Glow Journey Drop.** The Drop answers *"am I showing
up?"* — streaks, weekly consistency, lifetime days. The Garden answers *"how
wide has my world of produce gotten?"* — distinct items, families, colors,
areas. They use different visual grammars on purpose: the Drop is a single
animated droplet metaphor; the Garden is a multi-area illustrated scene. A
person could have a strong Glow Streak while barely starting the Garden, or
a rich Garden while rebuilding a broken streak — both should read as
legible, true, and non-contradictory states.

**Why a garden, and why this restrained.** Produce diversity is inherently
spatial and categorical (families, colors, areas) in a way a single number
isn't — a garden map is the most direct honest metaphor, not a stretch for
engagement's sake. Restraint is what keeps it from becoming a game: no
faces, no decay, no leaderboard, no infinite idle motion. The reward for
trying a new food is a quiet, brief moment of growth — then stillness again.

**Avoiding childishness.** No cartoon eyes, no mascots, no bouncing. Leaf and
produce forms are simplified but botanically legible (real leaf silhouettes,
real produce silhouettes), rendered in a restrained natural palette rather
than saturated toy colors. The closest visual cousins are premium editorial
food illustration and modern plant-identification graphics, not games.

**Idle calm.** Every element in the SVG source is static unless a named
group is explicitly animated by the implementation for one of the five
storyboard triggers. There is no ambient loop, no continuous parallax, no
perpetual sparkle layer — the "particle" and "highlight" groups exist in the
markup but are `display:none` by default and are only ever switched on for
the duration of a triggered animation, then removed.

---

## 3. Full Garden composition specification

**ViewBox:** `0 0 1200 900` (4:3-ish tall portrait canvas — chosen because
the full screen scrolls vertically on a phone, so a taller-than-wide canvas
lets all seven areas breathe without a squeezed layout; a landscape canvas
would force awkward horizontal crowding on narrow phones).

**Coordinate system:** origin top-left, y increases downward, matching
standard SVG / RN-SVG conventions. All seven bed illustrations are authored
in a shared local space (`0 0 320 320`, soil baseline at local y=260) and
placed into the master canvas with a `translate(...) scale(...)` transform —
this is what keeps every bed structurally identical (same group names, same
growth logic) while allowing each to sit at a different size and position.

**Spatial organization** — a gentle S-curved path runs from the top of the
canvas to the harvest basket at the bottom, with Orchard sitting at the
literal and visual center as the "anchor" (largest scale, most established
presence), and the other six areas arranged in three loose rows around it:

```
                         [ rainbow arc reserved, y 10–140 ]
   ┌───────────────┐                           ┌───────────────┐
   │  Green Garden │                           │  Citrus Grove │      row 1 (y 40–340)
   └───────────────┘                           └───────────────┘
        ┌───────────┐        ┌───────────────┐        ┌───────────┐
        │ Root      │        │    Orchard    │        │  Berry &  │      row 2 (y 300–660)
        │ Garden    │        │   (anchor)    │        │  Purple   │
        └───────────┘        └───────────────┘        └───────────┘
   ┌───────────────┐                           ┌───────────────┐
   │   Tropical    │                           │  Herb &       │      row 3 (y 660–880)
   │   Garden      │                           │  Booster Bed  │
   └───────────────┘                           └───────────────┘
                    [ harvest basket / badge, ~(600,850) ]
```

**Bed placement table** (x, y, w, h = touch-region bounding box in the 1200×900
canvas; scale = the multiplier applied to each bed's local 320×320 artwork):

| Bed | x | y | w | h | Scale |
|---|---:|---:|---:|---:|---:|
| Green Garden (`greens`) | 60 | 40 | 340 | 300 | 0.78 |
| Citrus Grove (`citrus`) | 800 | 40 | 340 | 300 | 0.78 |
| Root Garden (`roots`) | 30 | 340 | 320 | 300 | 0.78 |
| Orchard (`orchard`) | 430 | 300 | 340 | 360 | 0.95 |
| Berry & Purple Patch (`berries`) | 850 | 340 | 320 | 300 | 0.72 |
| Tropical Garden (`tropical`) | 60 | 660 | 340 | 220 | 0.85 |
| Herb & Booster Bed (`herbs`) | 800 | 660 | 340 | 220 | 0.62 |

Each bed's artwork is anchored so its soil baseline sits near the bottom of
its box (`bottom margin ≈ 16px`) and its horizontal center aligns to the
box's horizontal center. Artwork (tall growth, blade leaves) is allowed to
extend slightly above its box — adjacent boxes have enough vertical gap
(≥40px) that this never causes visual overlap between areas.

**Z-order (back to front):**
1. `garden_background`
2. `garden_ground`
3. `garden_path`
4. `garden_soft_highlight` (hidden by default)
5. Seven bed containers, in this order: greens → roots → citrus → orchard →
   berries → tropical → herbs (this order only matters where boxes are close
   enough to theoretically overlap tall growth — orchard is drawn after roots
   and citrus so its canopy can slightly overlap their outer edges if fully
   flourishing, which reads as "established center of the garden")
6. `garden_rainbow_arc` (hidden until Rainbow Harvest)
7. `garden_harvest_basket` (always present)
8. `garden_rainbow_badge` (hidden until Rainbow Harvest)
9. `garden_discovery_droplet`, sparkle and particle groups (hidden by default)

**Safe text zones (full screen)** — reserved for native RN text/components,
nothing is drawn by the SVG in these regions except background:

| Zone | Approx. region (x, y, w, h) | Native content |
|---|---|---|
| Screen title / back nav | 0, 0, 1200, 90 | "RawLife Garden", back chevron |
| Overall Garden summary | 60, 90, 1080, 60 | "14 of 42 produce discovered" style summary |
| Color-coverage display | 60, 150, 1080, 70 | Six color markers row (native-composited) |
| Selected-bed info panel | 0, 900, 1200, variable (below illustration, native scroll content) | Bed name, stage, next-discovery message |
| Bottom safe area / nav | below info panel | Standard tab bar clearance |

The illustration itself occupies y 0–900; all bed *names*, counts, and
messages are native text laid over or below it — nothing is baked into the
SVG as text.

---

## 4. Compact Today-card specification

**ViewBox:** `0 0 1200 540` (a wide card ratio that reads well as a Today-screen
tile across phone widths from <360dp up to large-phone widths, per the
recommended dimensions).

**Composition:** a simplified single-row arrangement of all seven areas along
a shallow path, rather than a shrunken copy of the full scene — a direct
shrink of the full composition was rejected because at card size the three-row
layout compresses into unreadable clutter; a single confident row keeps every
area's silhouette identifiable at a glance.

| Bed | Center x | Baseline y | Scale |
|---|---:|---:|---:|
| Green Garden | 100 | 420 | 0.42 |
| Root Garden | 280 | 420 | 0.42 |
| Citrus Grove | 460 | 420 | 0.42 |
| Orchard | 620 | 420 | 0.50 |
| Berry & Purple Patch | 800 | 420 | 0.40 |
| Tropical Garden | 980 | 420 | 0.46 |
| Herb & Booster Bed | 1140 | 420 | 0.36 |

Individual per-bed touch regions are **not** used on the card — the whole
card is one tappable affordance that opens the full Garden screen. (A subtle
native chevron or "View Garden" affordance is layered on natively, not baked
into the SVG.)

**Safe text zones (compact card):**

| Zone | Approx. region (x, y, w, h) | Native content |
|---|---|---|
| Header | 40, 20, 600, 50 | "RawLife Garden" |
| Main numerical summary | 40, 70, 700, 70 | "14 produce discovered" |
| Supporting summary | 40, 140, 700, 40 | "5 of 7 areas started · 4 of 6 colors" |
| Next-discovery message | 40, 460, 1120, 60 | "Try something tropical next 🌿"-style copy (native, no emoji baked into SVG) |
| Tap affordance | bottom-right, ~1080–1180, 480–520 | Native chevron / "Open Garden" |

Illustration fills y 0–460; the bottom ~80px band is reserved for the
next-discovery message so decorative artwork never collides with it.

---

## 5. Seven Garden-area specifications

Each area shares the same layer *architecture* (soil → boundary → seed →
sprout → growing → harvest → flourishing → blossoms → highlight) but uses
different shape primitives and colors to earn a distinct silhouette. Full
detail on colors is in §15; structural notes below.

### 5.1 Green Garden (`greens`)
Upright layered broad-leaf clusters (kale/spinach/cucumber-leaf inspired).
Growth reads as an expanding rosette: 4 leaves at Growing, 6 at Harvesting,
6 larger + 2 more at Flourishing. Deliberately generic enough that it can't
be mistaken for one specific vegetable. Soil: warm medium brown, boundary a
soft raised bed edge.

### 5.2 Root Garden (`roots`)
Visible soil is the star. Feathery leaf tops grow first (carrot/beet-top
inspired); root *shoulders* — half-ellipses in orange, red, and violet —
only appear at Harvesting and Flourishing, breaking the soil line. This is
the one area where "what's underground vs. above ground" is explicit, per
brief.

### 5.3 Citrus Grove (`citrus`)
A small rounded tree: canopy is a layered circle that grows in radius and
darkens through the stages (light → mid → dark green). Fruit are small
circles with a soft highlight dot (lemon/orange/grapefruit palette), added
at Harvesting; pale blossom dots appear only at Flourishing. Distinguished
from Orchard by a smaller, tighter canopy and smaller fruit.

### 5.4 Orchard (`orchard`)
Same canopy-and-fruit language as Citrus but broader, taller, and with
larger fruit in warmer apple/pear tones — reads as the more "established"
tree, matching its role as the visual anchor. Blossoms are a soft pink-white,
appearing at both Harvesting and Flourishing (Citrus reserves blossoms for
Flourishing only) to reinforce Orchard's fuller presence.

### 5.5 Berry & Purple Patch (`berries`)
Low, small-scale from the start — short leaf clusters instead of a stem-and-
canopy structure. Berry clusters are small grouped circles in purple and
deep red-violet, appearing at Harvesting and multiplying at Flourishing.
Kept deliberately compact and low so it never looks like it's trying to be
a tree.

### 5.6 Tropical Garden (`tropical`)
The most expressive foliage in the system: large sweeping single-curve
blade leaves (built from a dedicated `blade_leaf` primitive, distinct from
the pointed-oval `leaf` primitive used everywhere else) fanning out from a
single base. One warm gold/orange fruit form (mango/pineapple-adjacent oval)
appears at Harvesting, a second at Flourishing.

### 5.7 Herb & Booster Bed (`herbs`)
Fine, thin multi-blade clusters (5–7 slim leaves per cluster, built from the
same `leaf` primitive at a much narrower width) planted in a tidy, slightly
smaller bed. To keep it from reading as visually insignificant next to the
trees, its clusters are doubled (two clusters, left and right) from the
Growing stage onward, and small lavender blossom dots appear at Flourishing
across the whole width of the bed rather than in one corner.

---

## 6. Growth-stage visibility matrix

This exact matrix applies to **every one of the seven beds** — only the
`bed_[key]_` prefix changes. `soil` and `boundary` are always visible;
`highlight` is not tied to a growth stage at all — it is switched on only
for the duration of a triggered animation (see §11) and off otherwise,
including at Flourishing rest.

| Group | Empty | Seed | Sprout | Growing | Harvesting | Flourishing |
|---|---|---|---|---|---|---|
| soil | Yes | Yes | Yes | Yes | Yes | Yes |
| boundary | Yes | Yes | Yes | Yes | Yes | Yes |
| seed | No | Yes | No | No | No | No |
| sprout_stem | No | No | Yes | Yes | Yes | Yes |
| sprout_leaf_left | No | No | Yes | Yes | Yes | Yes |
| sprout_leaf_right | No | No | Yes | Yes | Yes | Yes |
| growing_layer_01 | No | No | No | Yes | Yes | Yes |
| growing_layer_02 | No | No | No | Yes | Yes | Yes |
| harvest_layer_01 | No | No | No | No | Yes | Yes |
| harvest_layer_02 | No | No | No | No | Yes | Yes |
| flourishing_layer_01 | No | No | No | No | No | Yes |
| flourishing_layer_02 | No | No | No | No | No | Yes |
| blossoms | No | No | No | No | No | Yes |
| highlight | Temporary (animation-driven only) | Temporary | Temporary | Temporary | Temporary | Temporary |

Note: for Citrus and Orchard, `blossoms` is documented as *Optional* at
Harvesting in the general spec — implemented here as **on for Orchard,
off for Citrus** at Harvesting, both **on** at Flourishing (see §5.3–5.4).
This is the one intentional per-bed deviation from the shared matrix and it
is expressed by which bed recipe populates the `blossoms` group, not by a
structural change to the matrix.

---

## 7. Five user-state mockups

Delivered as real files (see §17), described here:

**State 1 — New user (Empty).** All seven beds at Empty. No seeds, no false
growth. The path and basket are present but the basket sits empty/simple; no
rainbow. Reads as calm and inviting rather than barren — soil and bed
boundaries alone are enough visual richness at this stage.
Files: `rawlifegarden_full_state_empty.svg`, `rawlifegarden_compact_state_empty.svg`.

**State 2 — Early exploration.** Green Garden at Sprout, Root Garden and
Berry & Purple Patch at Seed, the other four still Empty. Two or three
colors discovered (implementation-side; the color marker row communicates
this natively). Plenty of open soil signals room to grow.
Files: `rawlifegarden_full_state_early.svg`, `rawlifegarden_compact_state_early.svg`.

**State 3 — Growing Garden.** Green Garden and Berry & Purple Patch at
Harvesting; Root Garden, Orchard, and Herb & Booster Bed at Growing; Citrus
Grove at Sprout; Tropical Garden at Seed. A believable, uneven mix — this is
also the **default demo state** used for `rawlifegarden_master_full.svg` and
`rawlifegarden_master_compact.svg`.
Files: `rawlifegarden_full_state_growing.svg` / `rawlifegarden_master_full.svg`
(identical), `rawlifegarden_compact_state_growing.svg` / `rawlifegarden_master_compact.svg`
(identical).

**State 4 — Advanced Garden.** Green Garden and Orchard and Berry & Purple
Patch at Flourishing; Root Garden, Citrus Grove, Tropical Garden, and Herb &
Booster Bed at Harvesting. Rich but not crowded — no two adjacent beds are
both at their most detailed stage in a way that competes for attention.
Files: `rawlifegarden_full_state_advanced.svg`, `rawlifegarden_compact_state_advanced.svg`.

**State 5 — Rainbow Harvest.** All seven beds at Flourishing. `garden_rainbow_arc`
and `garden_rainbow_badge` switched on; `garden_harvest_basket` present as
always. This is the static **post-celebration resting state** — no
particles, no motion — matching the reduced-motion final frame in §12.
Files: `rawlifegarden_full_state_rainbow.svg`, `rawlifegarden_compact_state_rainbow.svg`.

---

## 8. Produce discovery-symbol system

File: `rawlifegarden_discovery_symbols.svg` — seven 120×120 tiles in one row,
document order: leafy, root, citrus, orchard, berry, tropical, herb.

Each is `symbol_[key]_container`, holding `symbol_[key]_glyph` (the visible
shape) and a documented, invisible `symbol_[key]_center_marker` at local
(60, 70) relative to its own tile — this is the point the implementation
should treat as the symbol's true center when animating it from its spawn
point toward the target bed in Storyboard 2.

Shapes are intentionally generic (a leaf cluster for "leafy," a root
shoulder-and-tops for "root," a circle for "citrus," etc.) so no new symbol
has to be authored per ingredient. A small, separate, optional set of
produce-specific silhouettes (e.g., a recognizable pineapple or beet shape)
can be added later for a limited set of highly recognizable items using the
same 120×120 tile convention, without touching this file's structure.

## 9. Produce-color marker system

File: `rawlifegarden_color_markers.svg` — six 140-wide tiles, document order:
green, red, orange, yellow, purple, tan (standing in for white/tan produce).

Every marker uses **shape + color together**, never color alone:

| Color | Shape | Rationale |
|---|---|---|
| Green | Leaf | Leafy greens are the greenest category by far |
| Red | Circle | Simplest, reads as a berry/tomato/apple form |
| Orange | Root diamond | Distinguishes root-vegetable oranges from citrus |
| Yellow | Sun (circle + rays) | Citrus/sun association, visually distinct from the plain red circle |
| Blue/Purple | Berry cluster (3 small circles) | Echoes the Berry & Purple Patch bed |
| White/Tan | Seed (elongated ellipse) | Neutral produce (garlic, ginger, cauliflower) reads as a seed form |

Each `marker_[key]_container` holds three mutually exclusive, display-toggled
states: `_undiscovered` (dashed outline, muted gray-tan, no fill),
`_discovered` (full color, white circular backing), and `_selected`
(discovered + an outer ring). `_discovered` is the default visible state in
the shipped file. Native text labels ("Green," "Red," etc.) always render
outside the SVG next to each marker — never solely relied upon, but never
omitted either.

## 10. Rainbow Harvest system

File: `rawlifegarden_rainbow_harvest.svg` (standalone reference, 800×480) —
the same `garden_rainbow_arc`, `garden_rainbow_highlight`,
`garden_harvest_basket`, `garden_rainbow_badge`, and seven
`garden_rainbow_particle_01…07` groups are also embedded at full scale inside
`rawlifegarden_full_state_rainbow.svg` / `rawlifegarden_compact_state_rainbow.svg`.

The arc is six soft concentric bands (one per produce-color family, at 78%
of typical rainbow saturation so it reads as "garden," not "toy"), capped
with rounded line ends. The badge is a simple restrained circle-in-circle,
not a starburst or medal shape. Particles are `display:none` in every
shipped file — they exist purely as an animation resource for the one-time
Rainbow Harvest storyboard (§11.5) and are never part of any resting state.

---

## 11. Motion storyboards

Full detail in the companion file `rawlifegarden_animation_storyboard.md`.
Summary of triggers and durations:

| # | Storyboard | Trigger | Duration |
|---|---|---|---|
| 1 | Garden entrance | Today card or Garden screen mounts | 400–650ms |
| 2 | New produce discovery | A juice adds a genuinely new produce item | 800–1,300ms (≤2s for up to 3 at once) |
| 3 | Garden-area growth stage | A bed crosses a growth-stage threshold | 900–1,600ms depending on stage |
| 4 | New produce-color discovery | First item of a color family is logged | 450–800ms |
| 5 | Rainbow Harvest | Sixth/final color family completes | 1.8–2.8s, never loops |

## 12. Reduced-motion system

File: `rawlifegarden_reduced_motion.svg` — a static reference composite (a
Flourishing Green Garden bed + all six color markers in their discovered
state + the Rainbow badge), demonstrating the **complete absence** of
traveling symbols, growth motion, particle bursts, drawn rainbow arcs, and
sequential illumination. This is what every one of the five storyboards
collapses to when Reduce Motion is on. Full per-storyboard reduced-motion
behavior is in `rawlifegarden_animation_storyboard.md`.

## 13. Responsive behavior

Full breakpoint table in `rawlifegarden_responsive_spec.md`. In short: the
SVG viewBoxes never change across breakpoints (both master canvases scale
proportionally via the RN-SVG `width`/`height` props); what changes is which
optional decorative sub-groups (`_blossoms`, `_highlight`, fine detail
strokes) the implementation is allowed to hide below 360dp, and how tightly
native text wraps in the safe zones.

## 14. Accessibility considerations

- Every bed is identifiable by silhouette and soil treatment, not color alone
  (§5). A red/green color-vision simulation of any single state should still
  let someone tell Root Garden from Berry & Purple Patch by shape alone.
- Growth stages are structurally distinct (a bare stem+2 leaves at Sprout
  cannot be confused with the branching fullness of Growing), not merely
  brighter or more saturated.
- Selected-bed state (§ below) uses an outline + halo + slight lift, never
  color-only emphasis.
- Color markers always pair shape + native text label (§9).
- Touch targets: implementation should treat every documented touch region
  as a *minimum*, expanding invisibly to at least 44×44pt per platform
  guidance where a region's natural size is smaller (relevant mainly to the
  compact-card scale beds if they are ever made individually tappable).
- Reduced Motion removes movement entirely rather than merely slowing it
  (§12); nothing communicated by motion is ever the *only* place that
  information appears.

### Selected-bed state
Applies as an overlay on any bed container: a soft outer ring
(`stroke="#F5D98B"`-family, 3–4px, offset ~6px outside the bed's natural
silhouette), a subtle soil highlight ellipse at 12–15% opacity, and a ~4px
upward translation of the whole bed group ("gentle lift"). No pulsing, no
color-only cue — the ring and lift both work independently of color
perception.

---

## 15. Color palette

**Status: PROVISIONAL.** No RawLifeFlow brand screenshots, tokens, or
existing SVG assets were supplied with this brief. Every color below should
be treated as a placeholder to be reconciled against RawLifeFlow's actual
design tokens before implementation — in particular `primary_brand_green`,
`card_surface`, `primary_text`, and `secondary_text` almost certainly need
to be swapped for the app's real tokens so the Garden matches the rest of
the app exactly. Everything else (soil tones, produce colors) is more
Garden-specific and may survive a token swap largely as-is.

| Name | Hex | RGB | Use | Contrast note | Status |
|---|---|---|---|---|---|
| primary_brand_green | #3F7D5C | 63,125,92 | Primary accents, stems, sprout leaves | AA on white/cream backgrounds for text-sized use | Provisional |
| deep_foliage_green | #2C5940 | 44,89,64 | Flourishing-stage foliage, orchard canopy dark | AA+ on cream | Provisional |
| light_leaf_green | #8FBF9F | 143,191,159 | Early sprout leaves, highlight foliage | Decorative only, not for text | Provisional |
| warm_soil_brown | #7A5B44 | 122,91,68 | Root Garden / Herb bed soil | AA on cream for large text only | Provisional |
| light_soil_tan | #E8DCC8 | 232,220,200 | Soil highlight, seed-state marker | Decorative only | Provisional |
| citrus_yellow | #F2C14E | 242,193,78 | Citrus fruit, yellow color marker, premium glow core | Decorative / large elements only | Provisional |
| produce_orange | #E8873A | 232,135,58 | Root vegetables, orange marker, citrus accent | Decorative only | Provisional |
| berry_purple | #7C5295 | 124,82,149 | Berry cluster, purple/blue color marker | AA on cream for large text | Provisional |
| fruit_red | #C4483A | 196,72,58 | Orchard/root red produce, red color marker | AA on cream for large text | Provisional |
| tropical_gold | #E0A83E | 224,168,62 | Tropical fruit forms | Decorative only | Provisional |
| soft_sky_background | #F6F3EC | 246,243,236 | `garden_background` fill, card/screen backdrop | Base — pair with primary_text below | Provisional |
| card_surface | #FFFFFF | 255,255,255 | Today-card / info-panel surface (native, not in SVG) | — | Provisional — should match app token |
| primary_text | #2B2620 | 43,38,32 | Headings, main summary copy (native) | AAA on soft_sky_background | Provisional — should match app token |
| secondary_text | #6B6459 | 107,100,89 | Supporting copy (native) | AA on soft_sky_background | Provisional — should match app token |
| border | #DDD6C7 | 221,214,199 | Card border, undiscovered-marker outline | Decorative only | Provisional |
| premium_glow | #F5D98B | 245,217,139 | Rainbow badge ring, highlight groups, particles | Decorative only, always at reduced opacity | Provisional |
| reduced_motion_static_highlight | #F0E4C4 | 240,228,196 | Static equivalent of any temporary highlight | Decorative only | Provisional |

**Why this palette, if I had to choose without brand input:** warm neutral
background rather than stark white or the very common AI-default cream/
terracotta pairing; greens pulled toward sage/forest rather than a bright
"eco-app" green so they sit comfortably with warm soil tones; every produce
hue is desaturated roughly 10–15% from its "toy" version so citrus yellow,
berry purple, and fruit red can all appear in the same frame without
competing.

## 16. Light and dark appearance

No confirmation was provided on whether RawLifeFlow supports dark mode.
**This system is optimized for light mode only**, matching the palette
above. Documented considerations for a future dark pass, if needed:

- `soft_sky_background` would need a deep warm neutral (not pure black) —
  something like a dark bark brown — to keep the "garden," not "screen,"
  feeling.
- Soil tones need to lighten relative to their surroundings rather than
  darken further, or beds will lose their ground plane against a dark
  background.
- `premium_glow` and the Rainbow Harvest treatment would likely need to
  brighten slightly to keep the same felt warmth against a dark backdrop.
- Produce colors (citrus_yellow, produce_orange, fruit_red, berry_purple)
  can likely stay close to their light-mode values since they're already
  saturated enough to hold up on a dark ground — this should be confirmed
  visually once real dark-mode tokens exist.
- Do not simply invert the artwork — soil, foliage, and produce all need
  independent dark-mode values, not an automatic filter.

---

## 17. Layered SVG asset list

See `rawlifegarden_asset_manifest.md` for the complete per-file manifest.
High-level groups:

- **Bed files** (`beds/`): one fully layered file per Garden area, all six
  growth states present as toggleable groups, demo state = Harvesting.
- **Master compositions** (`system/`): full-screen and compact master files
  (both at the Growing-Garden demo state), plus explicit five-state variants
  of each, for ten total state mockup files.
- **Symbol & marker sheets**: discovery symbols, color markers.
- **Rainbow Harvest & celebration**: rainbow harvest reference sheet,
  celebration particle reference sheet.
- **Reduced motion**: one static reference composite.

## 18–19. Asset manifest & technical compatibility

See the standalone `rawlifegarden_asset_manifest.md`.

**Compatibility notes carried over into every file:**
- No filter effects, no blur, no CSS/JS inside any SVG.
- No embedded raster images or fonts.
- Gradients are avoided entirely in this pass (flat fills + a small number of
  simple soft-opacity overlay shapes stand in for "restrained gradients" and
  render identically on iOS and Android react-native-svg).
- All paths use two-decimal-precision coordinates, no scientific notation,
  no absurdly large numbers.
- Every animatable element is its own named `<g>`; nothing that needs to move
  independently is fused into a neighboring path.

## 20. Devin implementation handoff

See the standalone `rawlifegarden_devin_handoff.md`.

## 21. Quality-control results

| # | Check | Result |
|---|---|---|
| 1 | Seven Garden areas recognizable | Pass — distinct primitive language per area (§5) |
| 2 | Cohesive shared style | Pass — shared primitive functions, shared palette family |
| 3 | Six distinguishable states per area | Pass — cumulative layer reveal, verified via visibility matrix |
| 4 | Empty vs. Seed not confused | Pass — Empty has zero plant marks; Seed adds one small dot + soil highlight only |
| 5 | Harvesting vs. Flourishing visibly different | Pass — Flourishing always adds a second produce/foliage layer + blossoms |
| 6 | Compact Garden readable at phone size | Pass at design stage — recommend a real-device visual QA pass once implemented, see §13 |
| 7 | Full Garden supports seven tappable areas | Pass — non-overlapping touch regions documented (§3) |
| 8 | Artwork calm while idle | Pass — highlight/particle/rainbow groups default to hidden |
| 9 | No infinite animation required | Pass — every storyboard has a defined end state |
| 10 | Discovery animatable via named layers | Pass — symbol center points + bed layer groups documented (§8) |
| 11 | Color discoveries have non-color markers | Pass — shape system (§9) |
| 12 | Rainbow Harvest restrained | Pass — soft desaturated bands, no starburst, no confetti |
| 13 | Not visually childish | Pass — no faces, no mascots; recommend a real stakeholder review against brand tone |
| 14 | Doesn't copy competitor designs | Pass — original primitive shape language, not modeled on any named competitor |
| 15 | SVG paths clean/implementation-ready | Pass — all files parse as valid XML; simple primitives only |
| 16 | No unsupported SVG behavior | Pass — no filters, scripting, or CSS animation |
| 17 | No embedded text | Pass |
| 18 | Transform origins documented | Pass — see storyboard doc |
| 19 | Reduced-motion final states complete | Pass — §12 + dedicated file |
| 20 | Responsive simplification documented | Pass — see responsive spec doc |
| 21 | Touch regions documented | Pass — §3 |
| 22 | Safe text areas documented | Pass — §3, §4 |
| 23 | Particle count ≤ 7 | Pass — exactly 7 in every particle group |
| 24 | File/group naming consistent | Pass — snake_case throughout, verified programmatically |
| 25 | Devin handoff sufficiently detailed | Pass — see handoff doc; flagged one open item: real brand tokens are still needed (§15) |

**One caveat worth stating plainly:** this is a first design pass built
without real RawLifeFlow screenshots, tokens, or existing illustration
assets. It is internally consistent and implementation-ready as-is, but the
palette (§15) and any close visual match to existing cards/icons should be
treated as provisional until checked against the real app.
