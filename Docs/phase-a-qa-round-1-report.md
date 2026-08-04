# Phase A — Physical QA Round 1 Implementation Report

**Branch:** `fix/1.0.19-physical-qa-round-1`
**Base:** `cac5f7e` (chore(android): prepare RawLifeFlow 1.0.19 local beta)
**Date:** 2025-01-22
**Version:** 1.0.19 (no version bump, no APK rebuild)

---

## Commits

| # | SHA | Message |
|---|-----|---------|
| 1 | `091a97d` | fix(navigation): restore history scrolling and contextual recipe back behavior |
| 2 | `d741a5e` | fix(camera): reset in-flight guard on unmount and use correct route for scan-another |
| 3 | `816df77` | fix(blend): fetch authoritative allowance before showing pre-analysis modal |
| 4 | `f1a8cc2` | feat(glow): move Glow Journey to Explore and add motivational copy |
| 5 | `27427d3` | fix(icon): update SHA-256 hash to match approved source icon |

---

## QA Items Addressed

### QA Item 1 — Modal scroll clipping in HistoryScreen
**Root cause:** Fixed `paddingBottom: 60` on ScrollView content and `maxHeight: '85%'` on modal card prevented full scrolling on devices with large safe-area insets.
**Fix:** Replaced fixed padding with safe-area-aware padding using `useSafeAreaInsets()`. Increased modal `maxHeight` to `90%`. Removed `flex: 1` from card style.
**Files:** `HistoryScreen.js`, `historyScrollDetails.test.js`

### QA Items 6 & 7 — RecipeDetail back navigation
**Root cause:** `handleBack` navigated to non-existent `'Scan'` route instead of `'ExploreHome'`. Android hardware back button was not handled.
**Fix:** Changed route to `'ExploreHome'` with restore params (`restoreBrowseIdeas`, `restorePage`, `restoreSearchQuery`). Added `BackHandler` listener for Android hardware back to use same `handleBack` logic.
**Files:** `RecipeDetailScreen.js`, `recipeBackNavigation.test.js`

### QA Item 2 — Snap Produce Again camera launch
**Root cause:** `cameraInFlightRef.current` was not reset on unmount, potentially stuck `true` if component unmounted during eligibility check. `ScanSuccessScreen.handleScanAnother` used `'JuiceSnap'` route instead of `'ScanHome'` (the correct initial route in `ScanFlowStack`).
**Fix:** Added `cameraInFlightRef.current = false` to unmount cleanup. Added focus listener to reset `isCameraOpen`, `isPreparingCamera`, and `cameraInFlightRef` when screen regains focus. Changed `handleScanAnother` to `navigation.replace('ScanHome', ...)`.
**Files:** `HomeScreen.js`, `ScanSuccessScreen.js`

### QA Items 4 & 8 — Advanced Blend count and limit enforcement
**Root cause:** `blendUsedCount` initialized to `0` and only updated after `reserveBlendAllowance`. Pre-analysis modal showed stale "3 remaining" instead of server-authoritative count.
**Fix:** Added `fetchBlendAllowance()` call on mount and on focus to update `blendUsedCount` from server before modal is shown.
**Files:** `HomeScreen.js`

### QA Item 5 — Move Glow Journey to Explore
**Root cause:** Glow Journey progress indicator was on Today screen, should be on Explore.
**Fix:** Extracted Glow Journey logic into `useGlowJourney` custom hook. Added `GlowJourneyDrop`, `GlowJourneyDetail`, and `GlowJourneyCelebrationOverlay` to `ScanScreen` (Explore home). Removed them from `TodayScreen`.
**Files:** `ScanScreen.js`, `TodayScreen.js`, `useGlowJourney.js` (new)

### QA Item 9 — Add motivational copy
**Root cause:** Glow Journey and RawLife Garden lacked motivational guidance text.
**Fix:** Added contextual motivational copy to `GlowJourneyDrop` (4 states: first juice, weekly goal met, active streak, streak reset) and `GardenCard` (4 states: no discoveries, rainbow complete, 3+ colors, early stage).
**Files:** `GlowJourneyDrop.js`, `GardenCard.js`

### QA Item 3 — Replace Play Store icon
**Root cause:** Source icon file SHA-256 hash changed but test and script still referenced old hash.
**Fix:** Computed actual hash (`3b1109ade240df4726eaa36ca5a94324301c48d88b80225cacb549d59279dcfd`) and updated test assertion and `generate-icons.js` comment.
**Files:** `iconConfiguration.test.js`, `generate-icons.js`

---

## Test Results

| Suite | Result |
|-------|--------|
| Full Jest | 102 suites, 2605 tests, **all passing** |
| TypeScript (`tsc --noEmit`) | **0 errors** |
| ESLint | **0 errors**, 1285 pre-existing prettier warnings |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/screens/HistoryScreen.js` | Safe-area-aware padding, modal maxHeight 90% |
| `src/screens/RecipeDetailScreen.js` | ExploreHome route, BackHandler, restore params |
| `src/screens/HomeScreen.js` | Camera ref reset, focus listener, blend allowance fetch |
| `src/screens/ScanSuccessScreen.js` | ScanHome route for scan-another |
| `src/screens/ScanScreen.js` | GlowJourneyDrop, detail modals, useGlowJourney hook |
| `src/screens/TodayScreen.js` | Removed GlowJourney components |
| `src/hooks/useGlowJourney.js` | New hook extracting Glow Journey logic |
| `src/components/GlowJourneyDrop.js` | Motivational copy |
| `src/components/GardenCard.js` | Motivational copy |
| `src/screens/__tests__/historyScrollDetails.test.js` | Updated for safe-area padding |
| `src/screens/__tests__/recipeBackNavigation.test.js` | Updated for ExploreHome route + hardware back test |
| `src/screens/__tests__/iconConfiguration.test.js` | Updated SHA-256 hash |
| `scripts/generate-icons.js` | Updated SHA-256 hash comment |
