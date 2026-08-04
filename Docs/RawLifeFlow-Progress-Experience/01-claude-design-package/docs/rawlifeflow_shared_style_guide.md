# RawLifeFlow Progress Experience — Shared Style Guide
### How the RawLife Garden and the Glow Journey Drop fit together as one system

## The division of labor

| | RawLife Garden | Glow Journey Drop |
|---|---|---|
| Answers | "How wide has my world of produce gotten?" | "Am I showing up?" |
| Represents | Distinct produce, families, color coverage, Rainbow Harvest | Consistency, weekly completion, Glow Streak, permanent stage |
| Time character | Cumulative, permanent, never regresses | Weekly-cyclical (liquid) + permanent (stage) — two time scales in one object |
| Composition | A scene (seven areas) | A single object (one drop, one halo) |
| Growth unit | Per-area growth stage (Empty→Flourishing) | Per-week liquid fill + permanent Journey Stage |

Neither system can answer the other's question. A Rainbow Harvest garden
says nothing about this week's consistency; a Radiant drop says nothing
about how many kinds of produce someone has tried. That's intentional and
should stay legible even to someone who's only ever looked at one of the
two.

## What's genuinely shared

**Primitive shape language.** Both systems are built from the same handful
of parametric functions — most directly, the pointed-oval `leaf()` shape
appears in the Garden's beds *and* the Drop's halo, just arranged
differently (clustered and upright in the Garden, radiating in a wreath on
the Drop). This is the single strongest visual tie between them — someone
who's seen one recognizes the other's leaves as "the same hand."

**Palette family.** The Drop's seven stage-liquid colors are drawn directly
from the Garden's palette (`stage_sprout_liquid` = Garden's
`light_leaf_green`, `stage_thriving_liquid` = Garden's
`primary_brand_green`, `stage_radiant_liquid` = Garden's
`deep_foliage_green` — see the Drop design doc §7 for the full mapping).
`premium_glow` (#F5D98B) and `stage_gold_trim` (#D9A63E) are both used only
for celebration/premium accents in both systems, never for base color.

**Glow treatment.** Both systems use the identical restraint rule: any
"glow" is a soft, low-opacity radial shape, never a hard-edged highlight or
a filter/blur effect. Both cap resting (non-animated) glow at modest
opacity — the Garden's Rainbow Harvest highlight settles at ~14–16%, the
Drop's richest stage (Legend) settles at 18%. Neither system's glow is ever
allowed to compete with the actual content for attention.

**Motion temperament.** Identical vocabulary across every storyboard in
both systems: quick start / soft landing, restrained spring, ≤2–4%
overshoot ceiling, nothing loops, nothing idles, every animated moment ends
fully static. Duration bands overlap by design (entrance ~400–650ms in
both; routine updates ~800–1,300ms in both; the biggest celebration in each
system, 1.8–2.8s in the Garden's Rainbow Harvest and 2.0–2.8s in the Drop's
stage celebration, are the two longest and rarest moments either system
ever plays).

**Particle language.** Both systems use identical small circular particles
in `premium_glow` gold, both hard-capped at 7 per moment, both used only
for genuine milestones (Garden: new produce discovery has no particles at
all — only Rainbow Harvest does; Drop: routine updates have no particles —
only weekly completion and stage celebration do). Particles are never
present at rest in either system.

**Card treatment.** Both compact cards share the same background
(`soft_sky_background`, #F6F3EC), the same "illustration on top, native
text reserved below/around" structure, and the same rule that the whole
card is one tappable affordance rather than embedding a button into the
artwork.

**Celebration language.** Both systems' biggest celebration
(Rainbow Harvest / stage celebration) follows the same shape: a glow rise,
a coordinated brightening across the composition's own elements (Garden:
bed highlights in sequence; Drop: the glow ring's continuous rise), a
badge/overlay appearing, particles peaking alongside the badge, then
everything settling to a new but still-restrained resting state.

## What's deliberately *not* shared

- **No cross-navigation baked into either illustration.** Tapping the
  Garden doesn't visually reference the Drop and vice versa — they're
  coordinated siblings on the Today screen, not a single combined widget.
- **No shared animation triggers.** A Garden discovery never triggers Drop
  motion and a qualifying juice's Drop update never triggers Garden motion,
  even though the same juice log event might affect both systems' *data* —
  each plays its own storyboard independently (implementation's job to
  fire both if a single juice happens to affect both).
- **Different clip/mask budgets.** The Garden uses zero clip paths. The
  Drop uses exactly one (justified by the liquid-fill mechanic having no
  other clean implementation). Neither should grow beyond this without a
  strong reason — both were built to the brief's "minimal clipping" rule as
  a hard constraint, not a suggestion.
- **Different "what regresses" logic.** The Garden's growth is one-way
  (never shown regressing in this visual spec). The Drop's liquid level is
  expected to reset each week — the two objects are allowed to feel
  different in this one respect because the underlying habits they
  represent genuinely work differently, and hiding that would be dishonest
  design.

## Palette reference (combined)

See `rawlifegarden_design_system.md` §15 for the base palette and
`rawlifeflow_glowjourney_design_system.md` §7 for the Drop-specific
additions. Every color in both documents carries the same "Provisional"
status — none of this has been checked against real RawLifeFlow brand
tokens, screenshots, or existing assets, because none were supplied. This
is the single biggest open item across the whole combined package (see the
combined Devin handoff, §12).

## One-paragraph test for future additions

Before adding any new element to either system, it should pass: *does this
belong to "showing up" (Drop) or "exploring" (Garden), and does it reuse an
existing primitive, color, or motion rule from this guide rather than
inventing a new one?* If a new element can't clearly answer the first
question, it's probably trying to do both systems' jobs at once and should
be reconsidered.
