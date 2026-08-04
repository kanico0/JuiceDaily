# Glow Journey Visual Redesign Audit Report

**Branch:** `feat/glow-journey-visual-redesign`  
**Date:** 2025-06-04  
**Base commit:** `51b7400`  
**App version:** 1.0.18  

---

## Executive Summary

This audit evaluates the existing Glow Journey implementation against the Claude design package, assesses readiness for the RawLife Garden system, and identifies gaps for the visual redesign. All 98 existing Glow Journey tests pass. The current implementation is functionally complete but visually diverges significantly from the Claude design package. The RawLife Garden has zero existing implementation and requires building from scratch.

---

## AUDIT A: Existing Glow Journey Implementation

### Files Inspected

| File | Lines | Role |
|------|-------|------|
| `src/components/GlowJourneyDrop.js` | 468 | Compact Today-card drop visual |
| `src/components/GlowJourneyDetail.js` | 270 | Expanded detail modal |
| `src/constants/glowJourneyStages.js` | 44 | Stage threshold config |
| `src/services/glowJourneyService.js` | 293 | Weekly/lifetime computation + celebration persistence |
| `src/services/glowStreak.js` | 163 | Daily streak check-in with silent grace |
| `src/screens/TodayScreen.js` | 1414 | Host screen, wires all props |
| `src/utils/motion.js` | 459 | Reduced-motion hook + easing presets |
| `src/services/__tests__/glowJourney.test.js` | 954 | 98 tests covering all logic |
| `src/services/achievements.js` | 80 | 4 achievements, AsyncStorage persisted |

### Current Architecture

**Data flow:** `JuiceLogStore.entries` → `glowJourneyService.getWeeklyLeafStates()` / `getWeeklyQualifyingDays()` / `getLifetimeQualifyingDays()` → props to `GlowJourneyDrop` → `react-native-svg` rendering.

**Stage model:** 7 stages (Seed → Sprout → Growing → Blooming → Thriving → Radiant → Legend) with thresholds at 1, 5, 15, 30, 60, 100, 200 lifetime days. Weekly goal = 3 qualifying days.

**Celebration system:** Two independent celebrations — stage transitions and weekly completions — both with baseline initialization to prevent existing-user celebration spam. Stage celebration is suppressed when an achievement overlay is showing (`!pendingAchievement && stageCelebration`).

**Reduced motion:** `useReducedMotion()` hook queries `AccessibilityInfo.isReduceMotionEnabled()`. When active: fill animation is instant, glow pulse is suppressed, stage celebration modal uses `animationType: 'none'`.

### Key Findings

1. **SVG rendering is procedural, not asset-based.** The current `GlowJourneyDrop` builds paths dynamically via `buildDropPath()` and `buildLeafPath()` functions using `react-native-svg` primitives. The Claude design package specifies a canonical `glowjourney_drop.svg` with named groups (`glowjourney_liquid_fill`, `glowjourney_leaf_XX_fill`, etc.) to be driven by data. **This is the single largest gap.**

2. **No SVG file import or named-group toggling.** The current implementation does not import or render any SVG files from the design package. It creates all shapes programmatically. The design package requires driving `display` properties on named `<g>` elements.

3. **Clip path usage differs.** Current code uses a `ClipPath` with id `dropClip` to mask the liquid fill. The design package's `glowjourney_drop.svg` uses `glowjourney_liquid_clip`. The approach is compatible but the ID and structure differ.

4. **Gradients used.** Current code uses `RadialGradient` and `LinearGradient` for drop glow and liquid fill. The design package docs say "no filters, no blur" but gradients are not explicitly prohibited. The Garden handoff says "no gradients" but the Glow Journey handoff does not. **Needs clarification.**

5. **No particle system.** Current implementation has no particles. The design package specifies up to 7 particles (`glowjourney_particle_01…07`) for the Weekly Glow completion and New Journey-stage celebration storyboards.

6. **No falling droplet or ripple.** The design package specifies `glowjourney_falling_droplet` and `glowjourney_liquid_ripple` as hidden-by-default animatable groups. Current implementation has neither.

7. **No stage ornamentation.** The design package specifies `glowjourney_stage_[name]` groups for per-stage visual motifs. Current implementation shows stage only as text + emoji in the info section below the drop.

8. **No glow ring.** The design package specifies `glowjourney_glow_ring` with a permanent resting opacity that changes on stage celebration. Current implementation has a transient glow pulse (`glowAnim`) that fades to 0.

9. **No milestone overlay.** The design package specifies `glowjourney_milestone_overlay` for the New Journey-stage celebration. Current implementation uses a React Native `Modal` with text-only content.

10. **Leaf halo rendering is dynamic but structurally different.** Current code renders 7 leaves as simple `Path` elements positioned by angle. The design package specifies `glowjourney_leaf_halo` containing `glowjourney_leaf_01` through `glowjourney_leaf_07`, each with `_outline` and `_fill` sub-groups.

11. **Streak label is always plural.** Line 238: `{streakCount === 1 ? 'Day Glow Streak' : 'Day Glow Streak'}` — both branches are identical. Should be "1 Day Glow Streak" vs "N Day Glow Streak" (minor, but the test at line 189-202 only checks the string format, not the component).

12. **Detail modal is a text-only list.** The design package specifies an expanded detail view with the drop visual in a larger format. Current `GlowJourneyDetail` is a bottom sheet with text rows and a segmented progress bar — no visual drop.

---

## AUDIT B: Claude Glow Journey Package Compatibility

### Package Assets

| Asset | Status | Notes |
|-------|--------|-------|
| `glowjourney_drop.svg` | Available | Canonical 400×460 viewBox, clip path, named groups |
| `glowjourney_card_*.svg` (5 files) | Available | Static reference renders for QA |
| `glowjourney_stage_*_reference.svg` (7 files) | Available | Per-stage visual reference |
| `glowjourney_detail_view.svg` | Available | Expanded detail view reference |
| `glowjourney_milestone_overlay.svg` | Available | Celebration overlay reference |
| `glowjourney_card_reduced_motion.svg` | Available | Reduced-motion state reference |

### Named Groups in Canonical SVG (from manifest)

**Animatable:** `glowjourney_liquid_fill`, `glowjourney_liquid_ripple`, `glowjourney_falling_droplet`, `glowjourney_leaf_XX_fill` (7), `glowjourney_glow_ring`, `glowjourney_stage_[name]` (7), `glowjourney_particle_01…07`, `glowjourney_milestone_overlay`

**Static:** `glowjourney_drop_outline`, `glowjourney_drop_glass`, `glowjourney_leaf_XX_outline` (7)

### Compatibility Assessment

| Requirement | Current Status | Gap |
|-------------|---------------|-----|
| Import canonical SVG | Not done | Must integrate `glowjourney_drop.svg` |
| Drive named-group `display` from data | Not done | Must map data → group visibility |
| Single clip path (`glowjourney_liquid_clip`) | Different ID (`dropClip`) | Rename or use design package ID |
| 7-leaf halo with `_outline` + `_fill` | Leaves are dynamic paths | Must use SVG named groups |
| Liquid fill animation | `AnimatedClipPath` component | Must animate `glowjourney_liquid_fill` rect height |
| Glow ring with permanent resting value | Transient glow pulse | Must implement permanent resting opacity |
| Stage ornamentation groups | Text + emoji only | Must toggle `glowjourney_stage_[name]` groups |
| Particle system (max 7) | Not implemented | Must add `glowjourney_particle_01…07` |
| Falling droplet | Not implemented | Must add `glowjourney_falling_droplet` |
| Liquid ripple | Not implemented | Must add `glowjourney_liquid_ripple` |
| Milestone overlay | Modal with text | Must implement SVG-based overlay |
| Reduced motion = replacement, not slowdown | Partial (suppresses animations) | Must implement per-storyboard replacements |
| No runtime SVG file swapping | N/A (no SVG files used) | Must use single SVG with group toggling |
| No filters, blur, CSS animation, scripts | Compliant | N/A |
| Particle cap of 7 | N/A | Must enforce when implementing |

### Storyboard Gaps

The design package defines 5 storyboards. Current implementation covers:

| Storyboard | Current Coverage | Gap |
|-----------|-----------------|-----|
| Today-screen entrance | Partial (fade-in on screen) | No drop-specific entrance animation |
| Press interaction | None | No press-scale or droplet reaction |
| Normal qualifying-juice update | Partial (fill animation + glow pulse) | Missing falling droplet, ripple, particle |
| Weekly Glow completion | None (only analytics + persistence) | Missing full celebration sequence |
| New Journey-stage celebration | Partial (modal with text) | Missing SVG milestone overlay, glow ring change, particles |

---

## AUDIT C: RawLife Garden Data and App Architecture

### Existing Garden Implementation

**None.** Zero files match `*Garden*`, `*garden*`, or `*RawLife*` in `src/`. The Garden is a completely new feature.

### Data Availability

**Produce data:** `PRODUCE_DATA` in `src/services/JuiceEngine.ts` contains 60+ produce entries with:
- `name`: string
- `category`: `'vegetable' | 'fruit'`
- `nutrition`: RawNutrition (calories, sugar, vitamins, minerals, yield, retention)

**Missing fields needed for Garden:**
- **Garden bed assignment** — no mapping from produceId to garden bed (greens, roots, citrus, orchard, berries, tropical, herbs)
- **Color category** — no color marker mapping (red, orange, yellow, green, blue/purple, white/tan)
- **Discovery symbol** — no produce-specific discovery symbol
- **Growth stage thresholds** — no per-bed growth stage progression data

**JuiceLogStore entry shape:**
```
{ id, createdAt, dateKey, source, title, ingredients[], nutrientSummary, scoreContribution }
```
- `ingredients` is an array of produceId strings
- `dateKey` is `YYYY-MM-DD`
- Entries are persisted via `storage.ts` with schema versioning

**Diversity stats already computed:** `uniqueToday`, `uniqueWeek`, `groupBreakdown` (by `PRODUCE_DATA[id].category`), `topRepeated`. These are available but only cover vegetable/fruit — not the 7-bed classification the Garden requires.

### Architecture Recommendations

1. **Create a produce-to-bed mapping** in a new constant file (e.g., `src/constants/gardenBeds.js`) mapping each produceId to one of the 7 Garden beds.
2. **Create a produce-to-color mapping** for the produce-color marker system.
3. **Extend `glowJourneyService` or create `gardenService`** for bed-level growth stage computation based on unique produce discoveries per bed.
4. **Garden component** should follow the same pattern as `GlowJourneyDrop`: import the master SVG, drive named-group `display` from data.

---

## AUDIT D: Garden Progress Model

### Design Package Specification

The Garden uses a **5-stage growth model per bed**:
1. Empty → 2. Seed → 3. Sprout → 4. Growing → 5. Harvesting → 6. Flourishing

**Growth is driven by unique produce discoveries** within each bed, not by juice log count. The more distinct produces from a bed the user has juiced, the further that bed grows.

### Current Progress Model

The app currently tracks:
- **Glow Streak:** consecutive daily check-ins (with 1-day silent grace)
- **Lifetime qualifying days:** unique dateKeys with at least one log entry
- **Weekly qualifying days:** unique dateKeys in current week (Monday-based)
- **Total log count:** raw entry count
- **Diversity stats:** unique produceIds today/this week

**None of these map directly to per-bed growth stages.** A new computation layer is needed:

```
uniqueProducePerBed = group entries.flatMap(e => e.ingredients)
  → map each produceId to bed via gardenBeds mapping
  → count unique produceIds per bed
  → map count to growth stage threshold
```

### Growth Stage Thresholds (from design system doc)

The design system specifies visual growth stages but the exact numeric thresholds for stage transitions are **not specified in the docs**. The docs say growth is driven by "produce discovery" but don't define how many unique produces trigger each stage. **This is an open item for implementation planning.**

---

## AUDIT E: Shared Celebration Coordination

### Current Celebration System

Three independent celebration systems exist:

1. **Achievement Overlay** (`AchievementOverlay` component) — triggered by `checkAchievements()`, shows first newly unlocked achievement. Has priority over stage celebration.

2. **Stage Celebration** (inline Modal in `TodayScreen`) — triggered by `shouldCelebrateStage()`, shows stage emoji + label + days. Suppressed when `pendingAchievement` is active.

3. **Weekly Glow Completion** — only analytics + persistence (`shouldCelebrateWeekly` / `markWeeklyCelebrated`). **No visual celebration exists.**

### Design Package Coordination Rules

From `rawlifeflow_shared_style_guide.md` and `rawlifeflow_combined_devin_handoff.md`:
- Systems are **independent and simultaneous** — no cross-navigation, no shared animation triggers
- Different "what regresses" logic — Garden beds don't regress; Glow Journey streak can reset
- Different clip/mask budgets — Glow Journey has 1 clip path; Garden has none
- Particle cap of 7 is shared across both systems
- Reduced motion is replacement behavior in both systems

### Gaps

1. **No visual Weekly Glow celebration.** The design package specifies a full storyboard with particles, ripple, and droplet. Current code only persists and tracks analytics.
2. **No Garden celebration system.** The Garden has its own storyboards (entrance, new discovery, growth transition, color discovery, Rainbow Harvest) that need independent implementation.
3. **Celebration priority is only 2-level.** Currently: achievement > stage. With Garden added, need to ensure Garden celebrations don't conflict with Glow Journey celebrations. The design package says they're independent and simultaneous, so both could show — but UX-wise this needs consideration.
4. **No shared particle pool management.** Both systems have a max of 7 particles. If both animate simultaneously, total could be 14. The docs say "particle cap of 7" per system, but this should be clarified.

---

## AUDIT F: Responsive and Accessibility Review

### Current Responsive Behavior

- `GlowJourneyDrop` uses `useWindowDimensions()` for dynamic sizing
- `dropSize` = `Math.max(MIN_DROP_SIZE=120, Math.min(screenWidth * 0.42, MAX_DROP_SIZE=180))`
- Halo radius = `dropSize * 0.62`, leaf size = `dropSize * 0.14`
- SVG dimensions = `dropSize + leafSize * 8` (accounts for halo extent)
- No breakpoint-specific behavior — single proportional scale

### Design Package Responsive Spec

- Both master canvases scale proportionally
- No re-authoring per breakpoint
- Below 360dp: optional hiding of blossoms/flourishing layers for performance
- 360-412dp: reference width, all groups render as authored
- Large phones: optional max-width cap for full-screen
- SVG content does not resize with font scale; native text zones should be flexible

### Accessibility

| Requirement | Current Status | Gap |
|-------------|---------------|-----|
| `accessibilityRole="button"` on drop | Yes | None |
| `accessibilityLabel` with progress info | Yes (streak, weekly, stage, days to next) | None |
| `accessibilityHint` | Yes | None |
| Non-color-dependent identity | Partial (leaf states use color + opacity) | Must ensure stage identity by shape/motif/text |
| 44×44pt min touch target | `minHeight: 44` on container | Verify actual touch area |
| Reduced motion = replacement | Partial (suppresses, not replaces) | Must implement per-storyboard replacements |
| Stage celebration reduced motion | Yes (`animationType: isReduced ? 'none' : 'fade'`) | None |

### Gaps

1. **Stage identity is emoji-based.** The design package requires stage identity by shape/motif/text, not just emoji. Current implementation uses `stage.emoji` which may not render on all devices.
2. **Leaf state is color-dependent.** Filled vs unfilled leaves differ only by color (`SEMANTIC_COLORS.success` vs `rgba(255,255,255,0.08)`). The design package requires non-color-dependent identity.
3. **No reduced-motion storyboard replacements.** Current implementation suppresses animations but doesn't implement the specific replacement behaviors defined in the storyboards (e.g., instant fill, crossfade for entrance, no particles).

---

## Verification Test Results

**Existing tests:** 98/98 passed (0.031s)

**Test coverage:**
- Stage threshold boundaries (all 7 stages, all transitions)
- Days-to-next-stage computation
- Zero-history state
- Streak wording (singular/plural)
- Weekly progress ratio (capped at 100%)
- Same-day multiple logs (count as one day)
- Seven leaf states (properties, hasLog, isToday, isFuture)
- Weekly completion copy
- Highest-stage behavior
- Missing-data fallback (null, undefined, invalid dateKeys)
- Reduced-motion behavior
- Accessibility label content
- Stage celebration persistence (with baseline protection)
- Weekly celebration persistence
- Baseline initialization (existing-user protection)
- No historical celebration on first init
- Monday-based week convention
- Duplicate-prevention storage keys
- Reset clears all keys
- Analytics event schemas (no sensitive fields)
- Responsive layout (useWindowDimensions, MIN/MAX bounds)
- No hard-coded colors
- No unused imports
- TodayScreen integration (baseline, viewed ref, prevLifetimeDaysRef, stageCelebration)
- Stage celebration safe presentation (achievement priority)
- Reduced motion in celebration

---

## Implementation Plan (Phase 2 & 3)

### Phase 2: Glow Journey Visual Redesign

**Priority:** High  
**Risk:** Medium (clip-path + animated rect geometry is sensitive on mid-range Android)

#### Step 2.1: Integrate Canonical SVG
- Import `glowjourney_drop.svg` as a React Native SVG component
- Map all named groups to React Native SVG `<G>` elements with `id` props
- Replace procedural `buildDropPath()` / `buildLeafPath()` with SVG group rendering
- Rename clip path ID from `dropClip` to `glowjourney_liquid_clip`

#### Step 2.2: Implement Data-Driven Group Toggling
- Map `weeklyLeafStates` → `glowjourney_leaf_XX_fill` display/opacity
- Map `journeyStage` → `glowjourney_stage_[name]` display
- Map `fillRatio` → `glowjourney_liquid_fill` rect height animation
- Implement `glowjourney_glow_ring` with permanent resting opacity per stage

#### Step 2.3: Implement Storyboard Animations
- **Today-screen entrance:** Drop scale-in + leaf stagger + fill rise
- **Press interaction:** Scale-down + release spring
- **Qualifying-juice update:** Falling droplet → ripple → fill rise → glow pulse
- **Weekly Glow completion:** Particle burst (max 7) + ripple + glow ring intensify
- **New Journey-stage celebration:** Milestone overlay + glow ring permanent change + particles

#### Step 2.4: Implement Reduced-Motion Replacements
- Entrance: instant fill + crossfade (no scale)
- Press: no scale, instant state change
- Update: instant fill change, no droplet/ripple
- Completion: static particle positions, no animation
- Celebration: static overlay, no particles, instant glow ring change

#### Step 2.5: Update GlowJourneyDetail
- Replace text-only bottom sheet with SVG-based expanded view
- Use `glowjourney_detail_view.svg` as reference
- Show larger drop visual with current stage ornamentation

#### Step 2.6: Fix Streak Label Bug
- Line 238: Fix `{streakCount === 1 ? 'Day Glow Streak' : 'Day Glow Streak'}` to differentiate singular/plural

### Phase 3: RawLife Garden Implementation

**Priority:** Medium (new feature, no existing implementation)  
**Risk:** Low (no clip paths, simpler SVG structure)

#### Step 3.1: Create Garden Data Layer
- `src/constants/gardenBeds.js` — 7 bed definitions with produce-to-bed mapping
- `src/constants/gardenColors.js` — produce-to-color-marker mapping
- `src/services/gardenService.js` — bed growth stage computation from JuiceLogStore entries

#### Step 3.2: Create Garden Component
- Import `rawlifegarden_master_compact.svg` for Today card
- Import `rawlifegarden_master_full.svg` for full-screen view
- Drive named-group `display` from garden service data
- Implement 5 storyboards: entrance, new discovery, growth transition, color discovery, Rainbow Harvest

#### Step 3.3: Implement Garden Celebration Coordination
- Independent from Glow Journey celebrations
- Max 7 particles (Garden-only)
- Reduced-motion replacements per storyboard

#### Step 3.4: Responsive + Accessibility
- Proportional scaling (no breakpoint re-authoring)
- Below 360dp: optional hiding of blossoms/flourishing layers
- Non-color-dependent bed identity (shape + text)
- 44×44pt min touch targets for interactive beds

### Open Items

1. **Palette reconciliation** — Claude design package palette is provisional. Must reconcile with `SEMANTIC_COLORS` / `BRAND` tokens in `src/constants/tokens.js` before shipping.
2. **Garden growth stage thresholds** — Design docs don't specify numeric thresholds for bed growth stages. Need to define (e.g., 1 unique produce = Seed, 3 = Sprout, 5 = Growing, etc.).
3. **Gradient policy** — Garden handoff says "no gradients" but Glow Journey handoff doesn't explicitly prohibit them. Current Glow Journey uses gradients. Need clarification.
4. **Shared particle pool** — Both systems cap at 7 particles. If both celebrate simultaneously, total is 14. Need to decide if this is acceptable or if a shared pool is needed.
5. **SVG rendering approach** — `react-native-svg` can render SVG files via `SvgXml` or by translating SVG elements to RN SVG components. Need to decide approach for importing the design package SVGs.
6. **Mid-range Android clip-path testing** — The combined handoff doc specifically calls out clip-path + animated rect geometry as sensitive on mid-range Android devices. Must verify on target devices.

---

## Summary

| Area | Status | Gap Level |
|------|--------|-----------|
| Glow Journey logic | Complete, 98 tests pass | Low |
| Glow Journey visual | Functional but diverges from design | High |
| Glow Journey storyboards | 2 of 5 partially covered | High |
| RawLife Garden | Zero implementation | Full build needed |
| Garden data layer | Produce data exists, no bed/color mapping | Medium |
| Celebration coordination | 2-level priority, no visual weekly celebration | Medium |
| Responsive | Proportional scaling works, no breakpoints needed | Low |
| Accessibility | Partial (color-dependent leaf states, emoji-based stage identity) | Medium |
| Reduced motion | Suppresses but doesn't replace per storyboard | Medium |
| Palette | Provisional, needs reconciliation | Open |
