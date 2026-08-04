# Glow Journey Drop — Animation Storyboards

Shares its motion character with the Garden (§ shared style guide): quick
start, soft landing, restrained spring, minimal overshoot, nothing loops,
nothing idles. All five storyboards below end fully static.

---

## Storyboard 1 — Today-screen entrance

**Trigger:** Today card or expanded detail view mounts / becomes visible.
**Elements:** `glowjourney_drop_container` as one group (drop, liquid at
its current fill, halo at its current state, current stage motif) —
nothing individually staggered.
**Start state:** opacity 0, scale 96% (transform origin: drop center,
local 200,240).
**End state:** opacity 100%, scale 100%, everything already at its correct
current fill/stage/halo state — nothing fills or grows from zero on
entrance.
**Movement:** none (scale + fade only).
**Timing:** 400–600ms, single pass.
**Overlap:** n/a.
**Static elements:** liquid level, halo fill states, stage motif — all
already correct, none animate independently.
**Reduced motion:** immediate final state, or a plain ≤150ms fade with no
scale change.

---

## Storyboard 2 — Press interaction

**Trigger:** person taps/presses the card or drop.
**Elements:** `glowjourney_drop_container` as one group; optionally
`glowjourney_glow_ring` for a very subtle acknowledgment.
**Start state:** resting scale 100%, resting glow-ring opacity (per stage).
**End state:** back to resting scale 100%, resting glow-ring opacity —
this storyboard round-trips, it doesn't leave a new resting state.
**Movement:** none (scale only).
**Scale:** 100% → 97% on press-down (quick, ~90ms), → 100% on release
(~140ms, gentle settle, ≤2% overshoot).
**Glow ring:** optional +4–6 percentage points of opacity during the press
only, returning to baseline on release — a light acknowledgment, not a
flare.
**Timing:** ~230–260ms total round trip.
**Reduced motion:** no scale change at all; if desired, only the small
glow-ring opacity bump on press, released on lift.

---

## Storyboard 3 — Normal qualifying-juice update

**Trigger:** a logged juice counts as a qualifying day.
**Start state:** liquid at previous fill %, current day's
`glowjourney_leaf_XX_fill` hidden (if today wasn't already logged).
**End state:** liquid at new fill %, that day's leaf fill visible, all
transient groups back to hidden.

**Sequence:**
1. `glowjourney_falling_droplet`: `display:none` → `inline`, starts above
   the apex, falls and fades in during the fall (opacity 0→1 over the first
   third), reaches the apex, then fades out on "impact" (~500ms total,
   ease-in fall).
2. `glowjourney_liquid_fill`: its clipped rect's `y`/`height` animate from
   the previous fill level to the new one, timed to finish just as the
   droplet fades out — reads as the droplet raising the level.
   (~450–600ms, ease-out settle.)
3. `glowjourney_liquid_ripple`: `display:none` → `inline` right as the
   liquid reaches its new level, a single horizontal ripple that fades out,
   ~350ms, no repeat.
4. The relevant `glowjourney_leaf_XX_fill` (today's halo position):
   `display:none` → `inline` with a short fade + tiny scale pulse
   (100%→106%→100%), starting alongside the ripple, ~350ms.
5. `glowjourney_glow_ring`: one brief pass ~6–8 points above its stage
   baseline opacity, ~300ms, then returns to baseline — not a new resting
   state.

**Timing:** 800–1,100ms total, steps 2–5 overlapping by design (they should
read as one settling moment, not a checklist).
**Static elements:** stage motif, outline, drop silhouette — untouched.
**Reduced motion:** skip the falling droplet and ripple entirely. Liquid
level and the day's leaf fill both update instantly (or with a ≤150ms
crossfade). No glow-ring pass.
**Accessibility message concept:** "Logged for [day] — [X] of 7 days this
week."

---

## Storyboard 4 — Weekly Glow completion

**Trigger:** the seventh qualifying day in the current week is logged
(all seven halo leaves now filled).
**Start state:** as Storyboard 3's end state for the final day, liquid at
whatever % represents a completed week.
**End state:** all seven leaves filled, liquid settled, everything else
static — no permanently-different "completed" ornament is added (weekly
completion is not a stage change, so nothing about the drop's permanent
richness changes; only the resting week resets next cycle per existing
logic, unchanged here).

**Sequence:**
1. Storyboard 3 runs in full for the seventh day's own update (falling
   droplet, liquid rise, ripple, that leaf's fill).
2. Once step 1 settles, all seven `glowjourney_leaf_XX_fill` groups
   receive one coordinated, gentle scale pulse together (100%→105%→100%,
   ~350ms, all seven in sync — not staggered, so it reads as "the whole
   week," not a cascading list).
3. `glowjourney_glow_ring` rises to a fuller flare (roughly stage-baseline
   +12–15 points), holds briefly (~250ms), then eases back down to the
   stage's normal resting baseline — never left elevated afterward.
4. Up to 7 `glowjourney_particle_XX` groups: `display:none` → brief rise +
   fade (as in the Garden's celebration language), ~500–650ms including
   fade-out, then back to `display:none` for good.

**Timing:** ~1,400–1,900ms total (Storyboard 3's ~900ms plus this
storyboard's additional ~600–1000ms).
**Static elements:** stage motif, outline, liquid color — unchanged.
**Reduced motion:** step 1 uses its own reduced-motion path (instant
update). Steps 2–4 are skipped; a small static "week complete" cue can
appear via a brief (~150ms) fade of the halo's collective outline to a
slightly warmer tone if desired, but no scale pulse, no glow flare, no
particles.
**Accessibility message concept:** "Weekly Glow complete — 7 of 7 days
logged."

---

## Storyboard 5 — New Journey-stage celebration

**Trigger:** the permanent Journey Stage advances (e.g., Growing → Blooming).
**Start state:** drop rendered at the previous stage's recipe (color,
outline weight, glow baseline, motif).
**End state:** drop rendered at the new stage's recipe, milestone overlay
shown then dismissed, everything else static at the new resting baseline.

**Sequence:**
1. `glowjourney_glow_ring` begins rising from the old stage's baseline,
   continuing through the whole sequence toward the new stage's baseline —
   this is the one storyboard where the ring's rise is the throughline
   connecting every other step, rather than a single brief pulse.
2. Liquid and halo-fill colors crossfade from the old stage's recipe colors
   to the new stage's (`glowjourney_liquid_fill` and every
   `glowjourney_leaf_XX_fill`'s fill color animate together), ~600ms,
   ease-in-out — a color transition, not a shape change.
3. Outline stroke width/color crossfades to the new stage's values over the
   same ~600ms window.
4. The old stage's `glowjourney_stage_[old]` motif group fades out
   (~300ms) while the new stage's `glowjourney_stage_[new]` group fades in
   (~300ms, starting ~150ms after the old one begins fading, so there's a
   brief natural overlap rather than a hard cut or a gap).
5. `glowjourney_milestone_overlay`: `display:none` → `inline`, appears
   above the drop with a fade + gentle rise (translateY +14px → 0),
   ~400ms, holds for a few seconds (implementation-controlled dwell time,
   not specified here since it's a UX/timing decision downstream of this
   spec), then fades out and returns to `display:none`.
6. Up to 7 `glowjourney_particle_XX` groups fire once, same treatment as
   Storyboard 4 step 4, timed to peak alongside the glow-ring's highest
   point (step 1) rather than at the very start.
7. `glowjourney_glow_ring` eases down to the *new* stage's resting baseline
   (not back to the old one) and stays there — this is the one place in
   the whole system where the "resting" state permanently changes as a
   result of an animation, which is correct, since the stage itself has
   permanently changed.

**Timing:** 2.0–2.8s total — the longest and most significant of the five
storyboards, matching it being the rarest and most meaningful trigger.
**Static elements:** the drop silhouette shape itself and the halo's
seven-position layout never change — only color, weight, motif, and glow
settle to new values.
**Reduced motion:** skip the crossfade choreography — the drop simply
appears at its new stage's full recipe (colors, outline, motif, resting
glow) either instantly or with a single short (~200ms) fade. The milestone
overlay still appears (fade in, dwell, fade out) since it carries
information, not motion for its own sake, but does not rise/translate — it
simply fades. No particles.
**Accessibility message concept:** "New stage reached: [Stage Name]."

---

## Cross-storyboard rules (Drop)

- `glowjourney_falling_droplet`, `glowjourney_liquid_ripple`, and every
  `glowjourney_particle_XX` return to `display:none` at the end of every
  run — never left rendered.
- `glowjourney_glow_ring` has exactly one *permanent* resting value at any
  given moment (defined by current stage) — Storyboards 2–4 only ever
  pulse *away from and back to* that value; only Storyboard 5 is allowed to
  leave it at a new resting value, because only Storyboard 5 represents a
  genuine permanent change.
- Maximum particle count in any single moment: 7, matching the Garden.
- No storyboard here duplicates the Garden's discovery-symbol travel
  animation — the Drop has no equivalent concept (see shared style guide
  for why celebration language is shared but discovery language is not).
