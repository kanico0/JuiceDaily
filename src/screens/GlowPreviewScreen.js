// ─────────────────────────────────────────────────────────────
// GlowPreviewScreen.js — TEMPORARY QA-ONLY visual preview harness
//
// THIS FILE IS NOT FOR COMMIT. It is a developer-only tool for
// physically inspecting representative Living Juice Glow states
// on a QA device without writing any persistent user data.
//
// It imports ONLY:
//   - GlowJourneyDrop (the existing production renderer)
//   - React/React Native primitives
//
// It does NOT import:
//   - JuiceLogStore / JuiceLog
//   - useGlowJourney / useGlowStreak
//   - glowJourneyService / glowStreak
//   - AsyncStorage
//   - Supabase
//   - RevenueCat
//   - identity / storage helpers
//   - gardenSeenState
//   - achievements
//
// It reads and writes NO persistent user data.
//
// FIX HISTORY:
//   v1 — initial harness, TODAY=Wednesday, no FIT scaling
//   v2 — TODAY=Sunday (no logged leaf can be future),
//        proportional FIT scaling so complete GlowJourneyDrop
//        (eyebrow + vessel + vine + streak + Journey row) is visible
//   v3 — Motion QA: Normal/Reduced toggle + Prev/Next transition
//        controls to observe motion transitions between presets
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, Component, useRef, useMemo, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import GlowJourneyDrop from '../components/GlowJourneyDrop'

// ── Deterministic weekday model ───────────────────────────────
// Fixed TODAY = Sunday (dayIndex = 6)
// With Sunday as today, no logged leaf can also be isFuture,
// since isFuture = (dayIndex > 6) is never true for any leaf.
// Synthetic dateKeys are QA-only — never persisted.
const TODAY_INDEX = 6
const SYNTHETIC_DATE_KEYS = [
  '2025-01-06', // Monday    (index 0)
  '2025-01-07', // Tuesday   (index 1)
  '2025-01-08', // Wednesday (index 2)
  '2025-01-09', // Thursday  (index 3)
  '2025-01-10', // Friday    (index 4)
  '2025-01-11', // Saturday  (index 5)
  '2025-01-12', // Sunday    (index 6, TODAY)
]

function buildLeafStates(loggedDayIndices) {
  const loggedSet = new Set(loggedDayIndices)
  return Array.from({ length: 7 }, (_, i) => ({
    dayIndex: i,
    dateKey: SYNTHETIC_DATE_KEYS[i],
    hasLog: loggedSet.has(i),
    isToday: i === TODAY_INDEX,
    isFuture: i > TODAY_INDEX,
    isPast: i < TODAY_INDEX,
  }))
}

// ── Preset definitions ────────────────────────────────────────
// Each preset feeds synthetic props directly into GlowJourneyDrop.
// No derivation, no persistence, no service calls.
//
// Weekday patterns (today = Sunday):
//   0 days: none
//   1 day:  M
//   2 days: M W
//   3 days: M W F
//   5 days: M T W F S
//   7 days: all
//
// With TODAY=Sunday, all logged days are past or today — never future.
const PRESETS = [
  {
    key: 'fresh',
    name: 'Fresh',
    streakCount: 0,
    lifetimeDays: 0,
    weeklyQualifyingDays: 0,
    weeklyLeafStates: buildLeafStates([]),
  },
  {
    key: 'oneThird',
    name: '1 / 3',
    streakCount: 1,
    lifetimeDays: 1,
    weeklyQualifyingDays: 1,
    weeklyLeafStates: buildLeafStates([0]),
  },
  {
    key: 'twoThirds',
    name: '2 / 3',
    streakCount: 2,
    lifetimeDays: 2,
    weeklyQualifyingDays: 2,
    weeklyLeafStates: buildLeafStates([0, 2]),
  },
  {
    key: 'goalMet',
    name: '3 / 3',
    streakCount: 3,
    lifetimeDays: 3,
    weeklyQualifyingDays: 3,
    weeklyLeafStates: buildLeafStates([0, 2, 4]),
  },
  {
    key: 'fiveDay',
    name: '5 Days',
    streakCount: 5,
    lifetimeDays: 5,
    weeklyQualifyingDays: 5,
    weeklyLeafStates: buildLeafStates([0, 1, 2, 4, 5]),
  },
  {
    key: 'perfectWeek',
    name: '7 Days',
    streakCount: 7,
    lifetimeDays: 7,
    weeklyQualifyingDays: 7,
    weeklyLeafStates: buildLeafStates([0, 1, 2, 3, 4, 5, 6]),
  },
  {
    key: 'longTerm',
    name: 'Long-Term',
    streakCount: 30,
    lifetimeDays: 120, // Radiant stage (100-199)
    weeklyQualifyingDays: 5,
    weeklyLeafStates: buildLeafStates([0, 1, 2, 4, 5]),
  },
]

// ── No-op handler — preview does not navigate into real Glow detail ──
const noop = () => {}

// ── Local error boundary (QA-only — catches renderer errors) ──
class PreviewErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: String(error && error.message ? error.message : error),
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GlowPreview] Renderer error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Glow Preview Error</Text>
          <Text style={styles.errorText}>{this.state.errorMessage}</Text>
          <TouchableOpacity
            style={styles.errorResetBtn}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={styles.errorResetText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

// ── FIT-scaled Glow renderer wrapper ──────────────────────────
// Measures the natural height of GlowJourneyDrop, then scales it
// proportionally to fit the available scene area. This ensures the
// complete card (eyebrow + vessel + vine + streak + divider +
// Journey row) is visible in one screenshot without clipping.
//
// The production renderer is NOT modified. We only apply a
// transform: scale to the wrapper View.
//
// Motion QA: isReduced is now controllable via the Normal/Reduced
// toggle. When isReduced=false, the production motion system runs
// and transitions between presets will animate.
//
// KEY: ONE GlowJourneyDrop instance stays mounted. Transitions
// happen by changing synthetic props (previous → next preset),
// exactly as production transitions occur. No renderKey remount.
// A Reset/Replay button sets the starting preset, waits for
// canonical rest, then triggers the next preset on the SAME
// mounted component.
const GlowWrapper = React.memo(function GlowWrapper({ preset, availableHeight, isReduced }) {
  const [naturalHeight, setNaturalHeight] = useState(0)
  const scaleRef = useRef(1)

  // Compute scale to fit available height
  if (naturalHeight > 0 && availableHeight > 0) {
    scaleRef.current = Math.min(1, availableHeight / naturalHeight)
  }

  return (
    <PreviewErrorBoundary>
      <View
        style={{
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height
          if (h > 0 && h !== naturalHeight) {
            setNaturalHeight(h)
          }
        }}
      >
        <View
          style={{
            transform: [{ scale: scaleRef.current }],
            transformOrigin: 'top center',
          }}
        >
          <GlowJourneyDrop
            streakCount={preset.streakCount}
            entries={[]}
            lifetimeDays={preset.lifetimeDays}
            weeklyQualifyingDays={preset.weeklyQualifyingDays}
            weeklyLeafStates={preset.weeklyLeafStates}
            onPress={noop}
            isReduced={isReduced}
          />
        </View>
      </View>
    </PreviewErrorBoundary>
  )
})

// ── Preview screen component ───────────────────────────────────
export default function GlowPreviewScreen({ navigation }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [sceneArea, setSceneArea] = useState({ width: 0, height: 0 })
  const [isReduced, setIsReduced] = useState(false)
  const preset = PRESETS[selectedIdx]

  // Build diagnostic line as a single memoized string to prevent
  // partial/stale native text span updates during preset switches.
  const diagnosticLine = useMemo(
    () =>
      `q=${preset.weeklyQualifyingDays} · streak=${preset.streakCount} · lifetime=${preset.lifetimeDays}`,
    [preset],
  )

  const handleBack = useCallback(() => {
    if (navigation) navigation.goBack()
  }, [navigation])

  // Direct preset selection — changes props on the SAME mounted instance
  const handleSelectPreset = useCallback((idx) => {
    setSelectedIdx(idx)
  }, [])

  // Prev/Next transition: changes props on the SAME mounted GlowJourneyDrop
  // This is how production transitions occur — no remount.
  const handlePrev = useCallback(() => {
    setSelectedIdx((idx) => Math.max(0, idx - 1))
  }, [])

  const handleNext = useCallback(() => {
    setSelectedIdx((idx) => Math.min(PRESETS.length - 1, idx + 1))
  }, [])

  // Reset/Replay: set starting preset, wait for canonical rest, then
  // trigger next preset on the SAME mounted component.
  // This allows observing a specific transition repeatedly.
  const [replayState, setReplayState] = useState(null)
  const handleReplay = useCallback(() => {
    if (selectedIdx <= 0) {
      // Already at Fresh — just advance to next
      setSelectedIdx(1)
      return
    }
    // Reset to previous preset, then after a brief rest, advance to current+1
    const targetIdx = Math.min(selectedIdx + 1, PRESETS.length - 1)
    const startIdx = selectedIdx - 1
    setReplayState({ startIdx, targetIdx, phase: 'reset' })
    setSelectedIdx(startIdx)
  }, [selectedIdx])

  // After reset, wait for canonical rest then trigger transition
  useEffect(() => {
    if (!replayState) return
    if (replayState.phase === 'reset') {
      const timer = setTimeout(() => {
        setReplayState({ ...replayState, phase: 'transition' })
        setSelectedIdx(replayState.targetIdx)
      }, 600) // wait for canonical rest
      return () => clearTimeout(timer)
    }
    if (replayState.phase === 'transition') {
      const timer = setTimeout(() => setReplayState(null), 2500)
      return () => clearTimeout(timer)
    }
  }, [replayState])

  const handleToggleReduced = useCallback(() => {
    setIsReduced((r) => !r)
  }, [])

  const handleSceneLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout
    setSceneArea({ width, height })
  }, [])

  const canGoPrev = selectedIdx > 0
  const canGoNext = selectedIdx < PRESETS.length - 1

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Done</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Living Juice Glow Preview</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Motion mode toggle */}
      <View style={styles.motionRow}>
        <TouchableOpacity
          onPress={handleToggleReduced}
          style={[styles.motionBtn, !isReduced && styles.motionBtnActive]}
        >
          <Text style={[styles.motionText, !isReduced && styles.motionTextActive]}>
            Normal Motion
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleToggleReduced}
          style={[styles.motionBtn, isReduced && styles.motionBtnActiveReduced]}
        >
          <Text style={[styles.motionText, isReduced && styles.motionTextActive]}>
            Reduced Motion
          </Text>
        </TouchableOpacity>
      </View>

      {/* Preset selector — wraps into two rows on narrow screens */}
      <View style={styles.presetRow}>
        {PRESETS.map((p, idx) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => handleSelectPreset(idx)}
            style={[styles.presetBtn, idx === selectedIdx && styles.presetBtnActive]}
          >
            <Text style={[styles.presetText, idx === selectedIdx && styles.presetTextActive]}>
              {p.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Prev / Next transition controls */}
      <View style={styles.transitionRow}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={!canGoPrev}
          style={[styles.transitionBtn, !canGoPrev && styles.transitionBtnDisabled]}
        >
          <Text style={[styles.transitionText, !canGoPrev && styles.transitionTextDisabled]}>
            ← Prev
          </Text>
        </TouchableOpacity>
        <Text style={styles.transitionLabel}>Transition</Text>
        <TouchableOpacity
          onPress={handleNext}
          disabled={!canGoNext}
          style={[styles.transitionBtn, !canGoNext && styles.transitionBtnDisabled]}
        >
          <Text style={[styles.transitionText, !canGoNext && styles.transitionTextDisabled]}>
            Next →
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleReplay} style={styles.replayBtn}>
          <Text style={styles.replayText}>↻ Replay</Text>
        </TouchableOpacity>
      </View>

      {/* Glow card — single instance, FIT-scaled to show complete card */}
      <View style={styles.sceneArea} onLayout={handleSceneLayout}>
        {sceneArea.height > 0 && (
          <GlowWrapper preset={preset} availableHeight={sceneArea.height} isReduced={isReduced} />
        )}
      </View>

      {/* Preset label below scene */}
      <View style={styles.labelBar}>
        <Text style={styles.presetLabel}>{preset.name}</Text>
        <Text style={styles.presetDetail}>{diagnosticLine}</Text>
        <Text style={styles.motionModeLabel}>{isReduced ? 'REDUCED MOTION' : 'NORMAL MOTION'}</Text>
      </View>
    </View>
  )
}

// ── Exports for testing ────────────────────────────────────────
export { PRESETS, TODAY_INDEX, SYNTHETIC_DATE_KEYS, buildLeafStates }

// ── Styles ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080F0C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(217, 164, 65, 0.2)',
  },
  backBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  backText: {
    color: '#D9A441',
    fontSize: 16,
  },
  title: {
    color: '#F0D9A0',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 60,
  },
  motionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  motionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 196, 176, 0.2)',
  },
  motionBtnActive: {
    borderColor: '#7BE3B0',
    backgroundColor: 'rgba(123, 227, 176, 0.12)',
  },
  motionBtnActiveReduced: {
    borderColor: '#F0891F',
    backgroundColor: 'rgba(240, 137, 31, 0.12)',
  },
  motionText: {
    color: '#A8C4B0',
    fontSize: 12,
  },
  motionTextActive: {
    fontWeight: '600',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 196, 176, 0.2)',
  },
  presetBtnActive: {
    borderColor: '#D9A441',
    backgroundColor: 'rgba(217, 164, 65, 0.12)',
  },
  presetText: {
    color: '#A8C4B0',
    fontSize: 12,
  },
  presetTextActive: {
    color: '#F0D9A0',
    fontWeight: '600',
  },
  transitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  transitionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(217, 164, 65, 0.4)',
  },
  transitionBtnDisabled: {
    borderColor: 'rgba(168, 196, 176, 0.1)',
    opacity: 0.4,
  },
  transitionText: {
    color: '#D9A441',
    fontSize: 14,
  },
  transitionTextDisabled: {
    color: '#A8C4B0',
  },
  transitionLabel: {
    color: '#A8C4B0',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  replayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(123, 227, 176, 0.4)',
  },
  replayText: {
    color: '#7BE3B0',
    fontSize: 13,
  },
  sceneArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  labelBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
  },
  presetLabel: {
    color: '#F0D9A0',
    fontSize: 14,
    fontWeight: '600',
  },
  presetDetail: {
    color: '#A8C4B0',
    fontSize: 11,
    marginTop: 2,
  },
  motionModeLabel: {
    color: isReducedMotionActiveColor(),
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 1.2,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  errorText: {
    color: '#FFD54F',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorResetBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9A441',
  },
  errorResetText: {
    color: '#D9A441',
    fontSize: 14,
  },
})

// Helper for static style color (styles are static, so we use a neutral color)
function isReducedMotionActiveColor() {
  return '#A8C4B0'
}
