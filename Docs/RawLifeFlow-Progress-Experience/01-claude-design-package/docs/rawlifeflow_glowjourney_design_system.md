# Glow Journey Drop — Redesign (Visual & Motion System)
### Part of the combined RawLifeFlow Progress Experience, paired with RawLife Garden

This document covers the full redesign of the Glow Journey Drop. It assumes
`rawlifegarden_design_system.md` as shared context — palette tokens,
motion-timing character, and the "calm idle, brief alive" philosophy are
inherited from there and extended, not reinvented. See
`rawlifeflow_shared_style_guide.md` for exactly what's shared vs. distinct
between the two systems.

**Scope reminder:** this redesigns the *visual and motion system only*.
Streak logic, weekly-progress logic, journey-stage thresholds, celebration
triggering rules, persistence, analytics, accessibility *logic*, Juice Log
rules, and Free/Pro logic are untouched — those stay exactly as they
currently work. This document only says what things look like and when they
move, never what counts as a qualifying day or when a stage advances.

---

## 1. Design rationale — why this is a stronger design

**The old problem this solves.** A generic circular meter (ring/gauge) is
the default answer for "show consistency," which is exactly why it was
worth rejecting — it's the same shape language as every fitness app,
inseparable from Apple Fitness rings and casino-style progress wheels the
brief explicitly ruled out. A **juice drop that fills like liquid** is
specific to RawLifeFlow's actual subject matter (juicing) in a way a ring
never was — the metaphor is literal, not borrowed.

**Emotional appeal.** A liquid fill reads as accumulation in a warmer,
slower way than a ring sweeping around a track — it settles rather than
races. Combined with a soft halo of leaves rather than tick marks or
segments, the whole object reads as something grown and tended, not scored.

**Alignment with RawLifeFlow.** Same primitive family as the Garden (the
halo leaves are literally the Garden's `leaf()` shape, just arranged
radially instead of clustered on soil), same palette family, same
"restrained, premium, adult" register — but built from a completely
different base form (a drop, not a bed of plants), so it never reads as a
reskinned Garden tile.

**How it differs from the Garden, concretely:**
- The Garden is a *scene* (multiple areas, spatial, exploratory). The Drop
  is a *single object* (one drop, one halo) — intentionally more contained
  and personal, matching "showing up" being a singular, ongoing act rather
  than a spreading collection.
- The Garden's growth is per-area and *permanent* (a bed doesn't regress).
  The Drop's liquid fill is *weekly and cyclical* — it's expected to refill
  every week, which is the correct visual metaphor for a recurring habit
  rather than an accumulating collection.
- The Garden never shows a "current period" concept. The Drop's 7-leaf halo
  exists specifically to show *this week*, day by day — a concept the
  Garden has no equivalent for.
- Color means different things in each system: in the Garden, color marks
  *produce-family identity*. In the Drop, color marks *stage maturity* (the
  liquid and halo both deepen in tone as the permanent Journey Stage rises)
  — same palette family, different semantic job, so a person is never
  confused about which "color story" they're looking at.

**Calm while idle.** Exactly like the Garden: every transient element
(ripple, falling droplet, particles, milestone overlay, glow-ring flare) is
`display:none` by default in every shipped file and is switched on only for
the duration of a triggered animation. The only thing ever visible at rest
beyond stage-appropriate ornamentation is a very low, static glow-ring
opacity at higher stages (see §3) — a resting warmth, not motion.

**Premium and motivating without being game-like.** No health-bar
segmentation, no numeric badge overlays, no countdown pressure cues. The
liquid fill communicates progress the way a real object would — by getting
fuller — and the stage ornamentation rewards long-term consistency with
quiet material richness (finer line work, a touch of warm gold, a soft
resting glow) rather than bigger, louder, or more numerous elements.

---

## 2. Core static appearance

**Local coordinate space:** `0 0 400 460`. Drop apex at (200, 90), bulb
center at (200, 280) with radius 85 (bottom of drop at y=365). Halo leaves
radiate from center point (200, 240) at radius 155, at seven angles:
−105°, −70°, −35°, 0°, 35°, 70°, 105° (index 1–7, left to right — a natural
mapping to Monday–Sunday, confirmed against real day-of-week logic by
implementation, not assumed here).

**Drop silhouette.** A single teardrop path: pointed apex, circular bulb
base (drawn as two cubic Bézier "shoulders" plus a semicircular arc for the
bulb) — one clean path, reused for the outline, for the liquid clip, and
for the subtle "glass" base tint. This is the **one clip path in the entire
system**, used exactly twice (liquid fill, liquid highlight) — kept to a
minimum per the brief's restraint requirement.

**Interior liquid treatment.** Three layers, all clipped to the drop shape:
1. `glowjourney_drop_glass` — a permanent, very faint tint (8% opacity) of
   the current stage's liquid color across the *entire* drop interior, so
   the silhouette reads clearly even at 0% weekly fill.
2. `glowjourney_liquid_fill` — the real weekly-progress liquid, filling
   from the bottom. Fill height = `Y_TOP + (1 − fillPct) × (Y_BOTTOM − Y_TOP)`
   for the top edge of the liquid.
3. `glowjourney_liquid_highlight` — a static, soft diagonal highlight
   shape at ~30% opacity white, upper-left of the interior, standing in for
   "restrained glass highlight" without any gradient or filter.

**Depth and highlight language.** Entirely flat-fill based — the highlight
shape above is the *only* depth cue, deliberately restrained rather than a
glossy 3D glass-orb treatment, which would tip toward "generic app icon."

**Seven-leaf halo.** Each `glowjourney_leaf_XX` group (01–07) holds two
children: `_outline` (always visible — a thin, pale outline-only leaf,
present even for un-logged days so the "slot" is always legible) and
`_fill` (the solid, stage-colored leaf, switched on only for days that
qualified this week). This is the **weekly day-by-day view** — distinct
from and complementary to a native streak number.

**Stage labeling / streak-number / weekly-progress presentation.** All
native text, reserved in the safe zones below — nothing is drawn as text in
any SVG.

**Visual hierarchy.** Drop silhouette and liquid fill first (largest, most
central), halo second (frames it, slightly smaller elements), stage
ornamentation third (smallest, most restrained), native text last
(surrounds, never overlaps).

**Card framing.** See §4 (compact) and §5 (expanded).

---

## 3. Journey-stage visual matrix

Every stage shares the drop silhouette, the liquid-fill mechanic, and the
seven-leaf halo structure. What changes is color richness (liquid + halo
fill), outline weight, the permanent glow-ring resting opacity, and one
small added motif via the `glowjourney_stage_[name]` group. Motifs are
additive and cumulative in spirit (each stage feels like it kept what came
before and added a touch more), but implemented as clean, simple shapes —
never filters, never complex paths.

| Stage | Liquid / halo color | Outline weight | Resting glow-ring opacity | Added motif |
|---|---|---|---|---|
| Seed | `#DCE7D3` — barely-there pale sage | 1.5px, pale `#B9C9AE` | 0 | A small pale soil-toned mark at the drop's base — quiet anticipation, no plant growth yet |
| Sprout | `#A9D1AE` — light leaf green | 1.5px | 0 | A tiny two-leaf sprout accent just above the drop's apex |
| Growing | `#6FA97D` — mid leaf green | 2.0px | 0.05 | A thin single ring traced just outside the halo, low opacity |
| Blooming | `#4C8F63` — deepening green | 2.0px | 0.08 | Three small blossom dots at alternating halo-leaf bases |
| Thriving | `#3F7D5C` — primary brand green | 2.2px | 0.11 | Fine gold vein strokes along each of the seven halo leaves |
| Radiant | `#2C5940` — deep foliage green | 2.4px | 0.14 | Eight short soft gold rays fanning out behind the halo |
| RawLife Legend | `#244833` — richest jewel green | 2.6px | 0.18 | Gold vein strokes (as Thriving) + a soft connecting flourish between the two outermost leaves + a small badge accent at the drop's base |

**What stays constant across every stage:** the drop silhouette, the
halo's seven-position layout and leaf shape, the liquid-fill mechanic and
its independence from stage (a Seed-stage user can still fill their drop to
100% some week), the single restrained highlight shape, and the complete
absence of faces, numbers, or game-style badges baked into the artwork.

**What becomes richer at higher stages:** color depth (pale → jewel-toned),
outline confidence (thin → slightly bolder), the *permanent* resting glow
(0 → a soft 18% warmth — never more than that, so "Legend" still reads as
calm, not blazing), and the small motif set — each stage's motif is
additive to the *feel* of richness without stacking into visual clutter,
since each new file only ever shows its own stage's motif group, not a pile
of every previous stage's motif at once.

---

## 4. Compact Today-card specification

**ViewBox:** `0 0 640 480` — a taller, more square-ish ratio than the
Garden's wide card, because the Drop is a single centered object rather
than a wide scene; a wide card would leave awkward empty space on either
side of a vertical teardrop.

**Composition:** drop + halo centered horizontally, scaled to 0.72×, with
58px of top margin reserved before the illustration begins.

**Safe text zones:**

| Zone | Approx. region (x, y, w, h) | Native content |
|---|---|---|
| Stage label | 40, 12, 560, 36 | "Thriving" / current stage name |
| Streak number | 40, 400, 280, 60 | "12-day Glow Streak" style summary |
| Weekly-progress summary | 320, 400, 280, 60 | "5 of 7 days this week" |

The illustration occupies the vertical center (roughly y 58–420); stage
label sits above it, streak + weekly summary sit below it side by side.

## 5. Expanded detail-view direction

**ViewBox:** `0 0 900 760`, drop scaled to 1.35× with 120px top margin.
Reference file: `glowjourney_detail_view.svg` (shown with the milestone
overlay group switched on, to demonstrate placement — not because the
overlay should be visible at rest).

Additional reserved zones beyond the compact card:
- **Day-by-day labels** — seven small native labels (Mon–Sun) positioned
  beside each halo leaf at its documented angle/radius, so each leaf's
  filled/unfilled state is legible without color alone.
- **Next-milestone message** — a native text zone below the drop
  ("3 days to Blooming" style copy).
- **Milestone overlay anchor** — `glowjourney_milestone_overlay`'s
  documented position (a small elevated card above the drop, apex-aligned)
  is the same in both compact and expanded contexts, so the celebration
  storyboard doesn't need different positioning logic per screen.

---

## 6. Accessibility considerations (Drop-specific)

- Every halo leaf has a permanent `_outline` child, so "which days
  qualified" is never communicated by fill-color alone — an unfilled slot
  is always visibly a leaf-shaped outline, not empty space.
- Stage identity is communicated by outline weight, motif shape, and native
  text together — never by color alone (a color-vision simulation should
  still distinguish Growing's thin ring from Radiant's ray motif by shape).
- The permanent resting glow never exceeds 18% opacity at any stage —
  chosen specifically so it never interferes with liquid-fill or halo
  legibility for low-vision users.
- Reduced Motion (§ in the storyboard doc) removes the falling droplet,
  ripple, particle burst, and overlay-appearance motion entirely, replacing
  each with an instant or short-crossfade state change — never merely
  slowed down.
- Touch target: the whole card (compact) or the drop container (expanded)
  should resolve to at least 44×44pt as a single press target — there's no
  need for sub-region hit-testing on the Drop the way the Garden's seven
  beds need it, since the Drop is one object with one interaction.

---

## 7. Color additions to the shared palette

These are Drop-specific additions to the provisional palette established in
`rawlifegarden_design_system.md` §15 — same provisional-until-confirmed
status applies.

| Name | Hex | Use | Status |
|---|---|---|---|
| stage_seed_liquid | #DCE7D3 | Seed-stage liquid/halo | Provisional |
| stage_sprout_liquid | #A9D1AE | Sprout-stage (= Garden's light_leaf_green) | Provisional |
| stage_growing_liquid | #6FA97D | Growing-stage (= Garden's mid green) | Provisional |
| stage_blooming_liquid | #4C8F63 | Blooming-stage | Provisional |
| stage_thriving_liquid | #3F7D5C | Thriving-stage (= Garden's primary_brand_green) | Provisional |
| stage_radiant_liquid | #2C5940 | Radiant-stage (= Garden's deep_foliage_green) | Provisional |
| stage_legend_liquid | #244833 | Legend-stage, richest jewel tone | Provisional |
| stage_gold_trim | #D9A63E | Gold vein/flourish motifs from Thriving upward | Provisional — distinct from `tropical_gold` (#E0A83E) to read as "metallic trim" rather than "produce," at a glance |
| halo_unfilled_stroke | #C9C2B0 | Un-logged halo-leaf outline | Provisional (= Garden's `border`-adjacent neutral) |

Five of the seven stage-liquid colors are deliberately identical to
existing Garden palette tokens (§ shared style guide) — this is the primary
mechanism that makes the two systems feel like one family without looking
like duplicated art.
