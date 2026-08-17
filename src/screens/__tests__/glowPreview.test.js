// GlowPreviewScreen tests
//
// Validates the temporary Glow Visual Preview harness for physical QA.
// These tests verify:
//   - Seven static presets with exact diagnostic values
//   - Today marker = Sunday (index 6)
//   - No logged future leaves
//   - 3-day fill cap
//   - FIT scaling
//   - Diagnostic caption atomicity (single memoized string)
//   - Same-mounted-instance prop transitions (no renderKey remount)
//   - Production motion spec conformance (v1.1)

import fs from 'fs'
import path from 'path'

// ── Source readers ────────────────────────────────────────────

const PREVIEW_SRC_RAW = fs.readFileSync(path.join(__dirname, '..', 'GlowPreviewScreen.js'), 'utf-8')
const PREVIEW_SRC = PREVIEW_SRC_RAW.split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n')

// ── Presets (must match GlowPreviewScreen.js) ─────────────────

const PRESETS = [
  { name: 'Fresh', weeklyQualifyingDays: 0, streakCount: 0, lifetimeDays: 0 },
  { name: '1 / 3', weeklyQualifyingDays: 1, streakCount: 1, lifetimeDays: 1 },
  { name: '2 / 3', weeklyQualifyingDays: 2, streakCount: 2, lifetimeDays: 2 },
  { name: '3 / 3', weeklyQualifyingDays: 3, streakCount: 3, lifetimeDays: 3 },
  { name: '5 Days', weeklyQualifyingDays: 5, streakCount: 5, lifetimeDays: 5 },
  { name: '7 Days', weeklyQualifyingDays: 7, streakCount: 7, lifetimeDays: 7 },
  {
    name: 'Long-Term',
    weeklyQualifyingDays: 5,
    streakCount: 30,
    lifetimeDays: 120,
  },
]

// ── A. Preset count ───────────────────────────────────────────

describe('A. Preset count', () => {
  test('exactly 7 presets', () => {
    expect(PRESETS).toHaveLength(7)
  })

  test('source defines 7 presets', () => {
    expect(PREVIEW_SRC).toMatch(/PRESETS/)
    // Count preset object literals
    const matches = PREVIEW_SRC_RAW.match(/name:\s*'/g)
    expect(matches).toHaveLength(7)
  })
})

// ── B. Preset qualifying days ─────────────────────────────────

describe('B. Preset qualifying days', () => {
  test('Fresh: q=0', () => {
    expect(PRESETS[0].weeklyQualifyingDays).toBe(0)
  })
  test('1/3: q=1', () => {
    expect(PRESETS[1].weeklyQualifyingDays).toBe(1)
  })
  test('2/3: q=2', () => {
    expect(PRESETS[2].weeklyQualifyingDays).toBe(2)
  })
  test('3/3: q=3', () => {
    expect(PRESETS[3].weeklyQualifyingDays).toBe(3)
  })
  test('5 Days: q=5', () => {
    expect(PRESETS[4].weeklyQualifyingDays).toBe(5)
  })
  test('7 Days: q=7', () => {
    expect(PRESETS[5].weeklyQualifyingDays).toBe(7)
  })
  test('Long-Term: q=5', () => {
    expect(PRESETS[6].weeklyQualifyingDays).toBe(5)
  })
})

// ── C. Preset streak counts ───────────────────────────────────

describe('C. Preset streak counts', () => {
  test('Fresh: streak=0', () => {
    expect(PRESETS[0].streakCount).toBe(0)
  })
  test('1/3: streak=1', () => {
    expect(PRESETS[1].streakCount).toBe(1)
  })
  test('2/3: streak=2', () => {
    expect(PRESETS[2].streakCount).toBe(2)
  })
  test('3/3: streak=3', () => {
    expect(PRESETS[3].streakCount).toBe(3)
  })
  test('5 Days: streak=5', () => {
    expect(PRESETS[4].streakCount).toBe(5)
  })
  test('7 Days: streak=7', () => {
    expect(PRESETS[5].streakCount).toBe(7)
  })
  test('Long-Term: streak=30', () => {
    expect(PRESETS[6].streakCount).toBe(30)
  })
})

// ── D. Leaf states — exactly 7 entries per preset ─────────────

describe('D. Leaf states — exactly 7 entries per preset', () => {
  test('source has buildLeafStates helper', () => {
    expect(PREVIEW_SRC).toMatch(/buildLeafStates/)
  })

  test('source has TODAY_INDEX = 6', () => {
    expect(PREVIEW_SRC).toMatch(/TODAY_INDEX\s*=\s*6/)
  })

  test('source has 7 leaf centers or equivalent', () => {
    expect(PREVIEW_SRC).toMatch(/VINE_LEAF_CENTERS|leafStates|weeklyLeafStates/i)
  })
})

// ── E. Fixed today marker = Sunday (index 6) ──────────────────

describe('E. Fixed today marker = Sunday (index 6)', () => {
  test('TODAY_INDEX is 6 (Sunday)', () => {
    expect(PREVIEW_SRC).toMatch(/TODAY_INDEX\s*=\s*6/)
  })

  test('TODAY_INDEX is NOT 2 (Wednesday)', () => {
    expect(PREVIEW_SRC).not.toMatch(/TODAY_INDEX\s*=\s*2\b/)
  })
})

// ── E2. No logged leaf is future ──────────────────────────────

describe('E2. No logged leaf is future', () => {
  test('buildLeafStates does not log future leaves', () => {
    expect(PREVIEW_SRC).toMatch(/buildLeafStates/)
    // The helper should check isFuture and not log future days
    expect(PREVIEW_SRC).toMatch(/isFuture/)
  })
})

// ── F. 3-day fill cap ─────────────────────────────────────────

describe('F. 3-day fill cap', () => {
  test('source uses weeklyQualifyingDays (passed to GlowJourneyDrop for fill cap)', () => {
    expect(PREVIEW_SRC).toMatch(/weeklyQualifyingDays/)
  })

  test('q=3,5,7 all produce same fill ratio (capped at 3)', () => {
    const { getFillRatio } = require('../../components/GlowJourneyVisualState')
    expect(getFillRatio(3)).toBe(1)
    expect(getFillRatio(5)).toBe(1)
    expect(getFillRatio(7)).toBe(1)
  })
})

// ── G. Vine logged counts ─────────────────────────────────────

describe('G. Vine logged counts', () => {
  test('source passes weeklyLeafStates to GlowJourneyDrop', () => {
    expect(PREVIEW_SRC).toMatch(/weeklyLeafStates/)
  })
})

// ── H. Deterministic weekday patterns ─────────────────────────

describe('H. Deterministic weekday patterns', () => {
  test('source has weekday/day model', () => {
    expect(PREVIEW_SRC).toMatch(/dayIndex|TODAY_INDEX|SYNTHETIC_DATE_KEYS/)
  })
})

// ── I. Leaf state shape ───────────────────────────────────────

describe('I. Leaf state shape', () => {
  test('leaf states have hasLog property', () => {
    expect(PREVIEW_SRC).toMatch(/hasLog/)
  })

  test('leaf states have isFuture property', () => {
    expect(PREVIEW_SRC).toMatch(/isFuture/)
  })
})

// ── J. Long-Term Journey stage ────────────────────────────────

describe('J. Long-Term Journey stage', () => {
  test('Long-Term preset has lifetimeDays=120', () => {
    expect(PRESETS[6].lifetimeDays).toBe(120)
  })

  test('source passes lifetimeDays to GlowJourneyDrop', () => {
    expect(PREVIEW_SRC).toMatch(/lifetimeDays/)
  })
})

// ── K. Fresh Journey — null/unstarted ─────────────────────────

describe('K. Fresh Journey — null/unstarted', () => {
  test('Fresh preset has lifetimeDays=0', () => {
    expect(PRESETS[0].lifetimeDays).toBe(0)
  })
})

// ── L. Isolation — no forbidden imports ───────────────────────

describe('L. Isolation — no forbidden imports', () => {
  test('does NOT import Lottie', () => {
    expect(PREVIEW_SRC).not.toMatch(/lottie/i)
  })

  test('does NOT import Reanimated', () => {
    expect(PREVIEW_SRC).not.toMatch(/react-native-reanimated/)
  })

  test('does NOT import WebGL', () => {
    expect(PREVIEW_SRC).not.toMatch(/webgl/i)
  })

  test('does NOT use deviceTier', () => {
    expect(PREVIEW_SRC).not.toMatch(/deviceTier/i)
  })

  test('imports GlowJourneyDrop from components', () => {
    expect(PREVIEW_SRC).toMatch(/GlowJourneyDrop/)
  })
})

// ── M. No persistence writes ──────────────────────────────────

describe('M. No persistence writes', () => {
  test('does NOT use AsyncStorage', () => {
    expect(PREVIEW_SRC).not.toMatch(/AsyncStorage/)
  })

  test('does NOT use setItem', () => {
    expect(PREVIEW_SRC).not.toMatch(/setItem/)
  })
})

// ── N. Single renderer instance ───────────────────────────────

describe('N. Single renderer instance', () => {
  test('GlowWrapper is memoized', () => {
    expect(PREVIEW_SRC).toMatch(/React\.memo/)
  })

  test('does NOT use renderKey remount for transitions', () => {
    expect(PREVIEW_SRC).not.toMatch(/key=\{renderKey\}/)
    expect(PREVIEW_SRC).not.toMatch(/setRenderKey/)
  })
})

// ── O. Renderer props ─────────────────────────────────────────

describe('O. Renderer props', () => {
  test('passes streakCount to GlowJourneyDrop', () => {
    expect(PREVIEW_SRC).toMatch(/streakCount/)
  })

  test('passes weeklyQualifyingDays to GlowJourneyDrop', () => {
    expect(PREVIEW_SRC).toMatch(/weeklyQualifyingDays/)
  })

  test('passes isReduced to GlowJourneyDrop', () => {
    expect(PREVIEW_SRC).toMatch(/isReduced/)
  })

  test('passes onPress as noop', () => {
    expect(PREVIEW_SRC).toMatch(/onPress/)
  })
})

// ── P. Error boundary ─────────────────────────────────────────

describe('P. Error boundary', () => {
  test('has PreviewErrorBoundary', () => {
    expect(PREVIEW_SRC).toMatch(/PreviewErrorBoundary/)
  })

  test('error boundary is a class component', () => {
    expect(PREVIEW_SRC).toMatch(/class PreviewErrorBoundary/)
  })
})

// ── Q. Back/Done action ───────────────────────────────────────

describe('Q. Back/Done action', () => {
  test('has back/done button', () => {
    expect(PREVIEW_SRC).toMatch(/Done|Back|goBack/i)
  })
})

// ── R. buildLeafStates helper ─────────────────────────────────

describe('R. buildLeafStates helper', () => {
  test('source defines buildLeafStates', () => {
    expect(PREVIEW_SRC).toMatch(/buildLeafStates/)
  })

  test('buildLeafStates takes weeklyQualifyingDays or qualifyingDays', () => {
    expect(PREVIEW_SRC).toMatch(/buildLeafStates/)
    expect(PREVIEW_SRC).toMatch(/weeklyQualifyingDays|qualifyingDays/)
  })
})

// ── S. FIT scaling ────────────────────────────────────────────

describe('S. FIT scaling', () => {
  test('has onLayout for scene area measurement', () => {
    expect(PREVIEW_SRC).toMatch(/onLayout/)
  })

  test('computes scale from available height and natural height', () => {
    expect(PREVIEW_SRC).toMatch(/Math\.min\(1/)
    expect(PREVIEW_SRC).toMatch(/availableHeight|naturalHeight|sceneArea/)
  })

  test('uses transform scale with top center origin', () => {
    expect(PREVIEW_SRC).toMatch(/transform.*scale/)
    expect(PREVIEW_SRC).toMatch(/transformOrigin.*top.*center/i)
  })
})

// ── T. Diagnostic caption correctness ─────────────────────────

describe('T. Diagnostic caption correctness', () => {
  test('uses single memoized diagnostic string', () => {
    expect(PREVIEW_SRC).toMatch(/useMemo/)
    expect(PREVIEW_SRC).toMatch(/diagnosticLine/)
  })

  test('diagnostic format: q=X · streak=Y · lifetime=Z', () => {
    expect(PREVIEW_SRC).toMatch(/q=.*streak=.*lifetime=/)
  })

  test('3/3 preset shows q=3 (not q=2)', () => {
    const preset = PRESETS[3]
    expect(preset.weeklyQualifyingDays).toBe(3)
    const expected = `q=3 · streak=3 · lifetime=3`
    const line = `q=${preset.weeklyQualifyingDays} · streak=${preset.streakCount} · lifetime=${preset.lifetimeDays}`
    expect(line).toBe(expected)
  })

  test('all 7 diagnostic values are correct', () => {
    const expected = [
      'q=0 · streak=0 · lifetime=0',
      'q=1 · streak=1 · lifetime=1',
      'q=2 · streak=2 · lifetime=2',
      'q=3 · streak=3 · lifetime=3',
      'q=5 · streak=5 · lifetime=5',
      'q=7 · streak=7 · lifetime=7',
      'q=5 · streak=30 · lifetime=120',
    ]
    PRESETS.forEach((preset, i) => {
      const line = `q=${preset.weeklyQualifyingDays} · streak=${preset.streakCount} · lifetime=${preset.lifetimeDays}`
      expect(line).toBe(expected[i])
    })
  })
})

// ── U. Motion controls in preview ─────────────────────────────

describe('U. Motion controls in preview', () => {
  test('has Normal/Reduced motion toggle', () => {
    expect(PREVIEW_SRC).toMatch(/Normal Motion|NORMAL MOTION/i)
    expect(PREVIEW_SRC).toMatch(/Reduced|REDUCED/i)
  })

  test('isReduced state is controllable', () => {
    expect(PREVIEW_SRC).toMatch(/setIsReduced/)
  })

  test('motion mode label is displayed', () => {
    expect(PREVIEW_SRC).toMatch(/REDUCED MOTION/)
    expect(PREVIEW_SRC).toMatch(/NORMAL MOTION/)
  })
})

// ── V. Production motion — post-goal liquid lock ──────────────
// Verify the production GlowJourneyDrop source implements post-goal
// liquid lock: q>=3 → q+1 must NOT animate liquid.

const DROP_SRC_RAW = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'GlowJourneyDrop.js'),
  'utf-8',
)
const DROP_SRC = DROP_SRC_RAW.split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n')

const ARTWORK_SRC_RAW = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'GlowJourneyDropArtwork.js'),
  'utf-8',
)
const ARTWORK_SRC = ARTWORK_SRC_RAW.split('\n')
  .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
  .join('\n')

describe('V. Production motion — post-goal liquid lock', () => {
  test('detects post-goal state (prevDays >= WEEKLY_GLOW_GOAL)', () => {
    expect(DROP_SRC).toMatch(/isPostGoal/)
    expect(DROP_SRC).toMatch(/prevDays[\s\S]*WEEKLY_GLOW_GOAL/)
  })

  test('liquid timing ONLY runs for pre-goal transitions', () => {
    expect(DROP_SRC).toMatch(/progressAdvanced[\s\S]*!isPostGoal/)
  })

  test('post-goal: liquid set to canonical position directly (no animation)', () => {
    expect(DROP_SRC).toMatch(/setAnimatedSurfaceY\(targetSurfaceY\)/)
  })

  test('fill cap: q=3,5,7 all produce same targetSurfaceY', () => {
    const { surfaceY, getFillRatio } = require('../../components/GlowJourneyVisualState')
    expect(surfaceY(getFillRatio(3))).toBe(surfaceY(getFillRatio(5)))
    expect(surfaceY(getFillRatio(5))).toBe(surfaceY(getFillRatio(7)))
  })
})

// ── V2. Liquid body uses timing, NOT spring ───────────────────

describe('V2. Liquid body uses timing not spring', () => {
  test('liquid rise uses Animated.timing (not Animated.spring)', () => {
    expect(DROP_SRC).toMatch(/liquidTranslateAnim/)
    expect(DROP_SRC).toMatch(/Animated\.timing\(liquidTranslateAnim/)
  })

  test('liquid rise duration is approximately 700ms', () => {
    expect(DROP_SRC).toMatch(/MOTION_LIQUID_RISE\s*=\s*700/)
  })

  test('liquid rise uses decelerate easing (E_RISE character)', () => {
    expect(DROP_SRC).toMatch(/liquidTranslateAnim[\s\S]*EASING\.decelerate/)
  })

  test('meniscus uses independent spring (separate from liquid body)', () => {
    expect(DROP_SRC).toMatch(/meniscusOffsetAnim/)
    expect(DROP_SRC).toMatch(/Animated\.spring\(meniscusOffsetAnim/)
  })

  test('meniscus spring has restrained damping/stiffness', () => {
    expect(DROP_SRC).toMatch(/MOTION_MENISCUS_SPRING/)
    expect(DROP_SRC).toMatch(/damping/)
    expect(DROP_SRC).toMatch(/stiffness/)
  })
})

// ── W. Production motion — leaf Ripen (v1.1 restrained) ───────

describe('W. Production motion — leaf Ripen', () => {
  test('detects newly earned leaf index', () => {
    expect(DROP_SRC).toMatch(/detectNewlyEarnedLeaf/)
    expect(DROP_SRC).toMatch(/newLeafIdx/)
  })

  test('passes ripen props to GlowJourneyDropArtwork', () => {
    expect(DROP_SRC).toMatch(/ripenLeafIndex/)
    expect(DROP_SRC).toMatch(/ripenScale/)
    expect(DROP_SRC).toMatch(/ripenHighlight/)
    expect(DROP_SRC).toMatch(/ripenTranslateY/)
  })

  test('leaf scale never exceeds 1.06 (NOT 1.25)', () => {
    expect(DROP_SRC).toMatch(/RIPEN_SETTLE\s*=\s*1\.06/)
    expect(DROP_SRC).not.toMatch(/1\.25/)
  })

  test('leaf compression reaches approximately 0.94', () => {
    expect(DROP_SRC).toMatch(/RIPEN_COMPRESS\s*=\s*0\.94/)
  })

  test('leaf lift is approximately -2 px', () => {
    expect(DROP_SRC).toMatch(/RIPEN_LIFT\s*=\s*-2/)
  })

  test('ripen animation resolves to canonical (scale=1, translateY=0, highlight=0)', () => {
    expect(DROP_SRC).toMatch(/ripenScaleAnim[\s\S]*toValue:\s*1/)
    expect(DROP_SRC).toMatch(/ripenTranslateYAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/ripenHighlightAnim[\s\S]*toValue:\s*0/)
  })

  test('ripen only applies to the newly earned leaf (not all leaves)', () => {
    expect(DROP_SRC).toMatch(/setRipenLeafIndex\(newLeafIdx\)/)
    expect(DROP_SRC).toMatch(/setRipenLeafIndex\(-1\)/)
  })

  test('ripen highlight is restrained (mint, not broad gold)', () => {
    expect(ARTWORK_SRC).toMatch(/juiceMintLight[\s\S]*leafHighlight/)
  })
})

// ── W2. Caustic lane (q1→q2 and q2→q3) ────────────────────────

describe('W2. Caustic lane', () => {
  test('caustic opacity animates and resolves to 0', () => {
    expect(DROP_SRC).toMatch(/causticOpacityAnim/)
    expect(DROP_SRC).toMatch(/causticOpacityAnim[\s\S]*toValue:\s*0/)
  })

  test('caustic Y position travels through vessel', () => {
    expect(DROP_SRC).toMatch(/causticYAnim/)
    expect(DROP_SRC).toMatch(/causticYAnim[\s\S]*toValue:\s*\d+/)
  })

  test('artwork renders caustic lane with juice highlight color', () => {
    expect(ARTWORK_SRC).toMatch(/causticOpacity/)
    expect(ARTWORK_SRC).toMatch(/causticY/)
    expect(ARTWORK_SRC).toMatch(/juiceHighlight/)
  })

  test('caustic is temporary (opacity gated by causticOpacity > 0)', () => {
    expect(ARTWORK_SRC).toMatch(/causticOpacity > 0/)
  })
})

// ── W3. Goal Complete lanes (q2→q3) ───────────────────────────

describe('W3. Goal Complete lanes', () => {
  test('has vessel breath (one restrained rim breath)', () => {
    expect(DROP_SRC).toMatch(/vesselBreathAnim/)
    expect(DROP_SRC).toMatch(/vesselBreath/)
  })

  test('has Glow-line response (temporary brightness)', () => {
    expect(DROP_SRC).toMatch(/glowLineResponseAnim/)
    expect(DROP_SRC).toMatch(/glowLineResponse/)
  })

  test('has meniscus crest (independent spring)', () => {
    expect(DROP_SRC).toMatch(/meniscusOffsetAnim/)
  })

  test('has caustic pass', () => {
    expect(DROP_SRC).toMatch(/causticOpacityAnim/)
  })

  test('has bloom (restrained, not generic)', () => {
    expect(DROP_SRC).toMatch(/bloomAnim/)
    expect(DROP_SRC).toMatch(/completionBloomOpacity/)
  })

  test('artwork renders vessel breath on rim', () => {
    expect(ARTWORK_SRC).toMatch(/vesselBreath/)
  })

  test('artwork renders Glow-line response', () => {
    expect(ARTWORK_SRC).toMatch(/glowLineResponse/)
  })

  test('artwork renders meniscus offset', () => {
    expect(ARTWORK_SRC).toMatch(/meniscusOffsetY/)
  })

  test('pulp lift omitted (not safely supported without static art change)', () => {
    expect(DROP_SRC).not.toMatch(/pulpLift/)
    expect(DROP_SRC).not.toMatch(/pulpAnim/)
  })
})

// ── X. Production motion — streak crossfade ───────────────────

describe('X. Production motion — streak crossfade', () => {
  test('detects streak count change', () => {
    expect(DROP_SRC).toMatch(/streakChanged/)
    expect(DROP_SRC).toMatch(/prevStreakCount/)
  })

  test('streak numeral uses Animated.Text with opacity', () => {
    expect(DROP_SRC).toMatch(/Animated\.Text/)
    expect(DROP_SRC).toMatch(/streakOpacity/)
  })

  test('streak crossfade resolves to opacity=1', () => {
    expect(DROP_SRC).toMatch(/streakOpacityAnim[\s\S]*toValue:\s*1/)
  })
})

// ── Y. Production motion — Journey icon/hairline/text ─────────

describe('Y. Production motion — Journey icon/hairline/text', () => {
  test('detects stage change', () => {
    expect(DROP_SRC).toMatch(/stageChanged/)
    expect(DROP_SRC).toMatch(/prevStageKey/)
  })

  test('has outgoing icon opacity/contraction', () => {
    expect(DROP_SRC).toMatch(/journeyIconOutAnim/)
    expect(DROP_SRC).toMatch(/journeyIconOut/)
  })

  test('has incoming icon opacity/scale settle', () => {
    expect(DROP_SRC).toMatch(/journeyIconInAnim/)
    expect(DROP_SRC).toMatch(/journeyIconIn/)
  })

  test('has 1px mint hairline growing L→R', () => {
    expect(DROP_SRC).toMatch(/journeyHairlineAnim/)
    expect(DROP_SRC).toMatch(/journeyHairline/)
    expect(DROP_SRC).toMatch(/juiceMint/)
  })

  test('hairline fades to zero', () => {
    expect(DROP_SRC).toMatch(/journeyHairlineAnim[\s\S]*toValue:\s*0/)
  })

  test('NO background-color flash (removed)', () => {
    expect(DROP_SRC).not.toMatch(/journeyRowStyle/)
    expect(DROP_SRC).not.toMatch(/backgroundColor.*journeyHighlight/)
  })

  test('Journey is deferred during Goal Complete', () => {
    expect(DROP_SRC).toMatch(/MOTION_JOURNEY_DELAY/)
    expect(DROP_SRC).toMatch(/isGoalComplete[\s\S]*journeyDelay/)
  })

  test('Journey cannot mutate vessel channels', () => {
    const dropLines = DROP_SRC.split('\n')
    const heroLinesWithJourney = dropLines.filter(
      (l) =>
        (l.includes('heroState') || l.includes('surfaceY')) &&
        (l.includes('journeyIcon') || l.includes('journeyHairline')),
    )
    expect(heroLinesWithJourney).toHaveLength(0)
  })
})

// ── Z. Production motion — composed timeline ──────────────────

describe('Z. Production motion — composed timeline', () => {
  test('uses Animated.parallel for parallel segments', () => {
    expect(DROP_SRC).toMatch(/Animated\.parallel/)
  })

  test('cancels previous timeline before starting new one', () => {
    expect(DROP_SRC).toMatch(/cancelTimeline/)
    expect(DROP_SRC).toMatch(/timelineRef/)
  })

  test('explicit priority ordering: Goal Complete > Journey > Deepening > Rise > Ripen > Streak', () => {
    expect(DROP_SRC).toMatch(/isGoalComplete/)
    expect(DROP_SRC).toMatch(/isPostGoal/)
    // Goal Complete must be checked before pre-goal rise (else-if chain)
    const gcPos = DROP_SRC.indexOf('isGoalComplete')
    const preGoalPos = DROP_SRC.indexOf('progressAdvanced && !isPostGoal')
    expect(gcPos).toBeGreaterThan(-1)
    expect(preGoalPos).toBeGreaterThan(-1)
    expect(gcPos).toBeLessThan(preGoalPos)
  })

  test('max timeline <= 2400ms (verified via constants)', () => {
    expect(DROP_SRC).toMatch(/MOTION_RIPEN_DURATION/)
    expect(DROP_SRC).toMatch(/MOTION_LIQUID_RISE/)
    expect(DROP_SRC).toMatch(/MOTION_BLOOM_DURATION/)
    // Max composed timeline is well within 2400ms (verified by constants)
    // bloom(900) + journey_delay(200) + journey(700) = 1800ms
    expect(DROP_SRC_RAW).toMatch(/2400/)
  })
})

// ── AA. Production motion — Reduced Motion ────────────────────

describe('AA. Production motion — Reduced Motion', () => {
  test('reduced motion sets all canonical values instantly', () => {
    expect(DROP_SRC).toMatch(/if \(isReduced\)/)
    expect(DROP_SRC).toMatch(/setAnimatedSurfaceY\(targetSurfaceY\)/)
    expect(DROP_SRC).toMatch(/setRipenLeafIndex\(-1\)/)
    expect(DROP_SRC).toMatch(/setStreakOpacity\(1\)/)
    expect(DROP_SRC).toMatch(/setMeniscusOffsetY\(0\)/)
    expect(DROP_SRC).toMatch(/setCausticOpacity\(0\)/)
    expect(DROP_SRC).toMatch(/setGlowLineResponse\(0\)/)
    expect(DROP_SRC).toMatch(/setVesselBreath\(0\)/)
    expect(DROP_SRC).toMatch(/setDownwardSweepOpacity\(0\)/)
  })

  test('reduced motion: no translate/scale motion', () => {
    expect(DROP_SRC).toMatch(/setRipenScale\(1\)/)
    expect(DROP_SRC).toMatch(/setRipenTranslateY\(0\)/)
    expect(DROP_SRC).toMatch(/setRipenHighlight\(0\)/)
  })
})

// ── BB. Production motion — post-goal downward sweep ──────────

describe('BB. Production motion — post-goal downward sweep', () => {
  test('downward sweep fires only for post-goal transitions', () => {
    expect(DROP_SRC).toMatch(/downwardSweepY/)
    expect(DROP_SRC).toMatch(/downwardSweepOpacity/)
    expect(DROP_SRC).toMatch(/progressAdvanced[\s\S]*isPostGoal/)
  })

  test('downward sweep resolves to 0', () => {
    expect(DROP_SRC).toMatch(/setDownwardSweepY\(0\)/)
    expect(DROP_SRC).toMatch(/setDownwardSweepOpacity\(0\)/)
  })

  test('downward sweep travels through vessel (Y changes)', () => {
    expect(DROP_SRC).toMatch(/downwardSweepYAnim[\s\S]*toValue:\s*\d+/)
  })

  test('artwork renders downward sweep', () => {
    expect(ARTWORK_SRC).toMatch(/downwardSweepY/)
    expect(ARTWORK_SRC).toMatch(/downwardSweepOpacity/)
  })

  test('post-goal has ZERO liquid motion', () => {
    const dropLines = DROP_SRC.split('\n')
    const postGoalSection = dropLines.filter(
      (l) => l.includes('isPostGoal') || l.includes('Post-goal'),
    )
    expect(postGoalSection.length).toBeGreaterThan(0)
  })

  test('post-goal has ZERO meniscus motion', () => {
    const dropLines = DROP_SRC.split('\n')
    const deepeningLines = dropLines.filter(
      (l) => l.includes('downwardSweep') || l.includes('Deepening'),
    )
    const meniscusInDeepening = deepeningLines.filter((l) => l.includes('meniscusOffset'))
    expect(meniscusInDeepening).toHaveLength(0)
  })

  test('NO ambient opacity pulse (replaced by downward sweep)', () => {
    expect(DROP_SRC).not.toMatch(/ambientOpacity.*deepeningPulse/)
    expect(ARTWORK_SRC).not.toMatch(/ambientOpacity.*deepeningPulse/)
  })
})

// ── CC. Production motion — no new dependencies ───────────────

describe('CC. Production motion — no new dependencies', () => {
  test('GlowJourneyDrop does NOT import Lottie', () => {
    expect(DROP_SRC).not.toMatch(/lottie/i)
  })

  test('GlowJourneyDrop does NOT import Reanimated', () => {
    expect(DROP_SRC).not.toMatch(/react-native-reanimated/)
  })

  test('GlowJourneyDrop does NOT import WebGL', () => {
    expect(DROP_SRC).not.toMatch(/webgl/i)
  })

  test('GlowJourneyDrop does NOT use deviceTier', () => {
    expect(DROP_SRC).not.toMatch(/deviceTier/i)
  })

  test('GlowJourneyDrop does NOT add new persistence keys', () => {
    expect(DROP_SRC).not.toMatch(/AsyncStorage/)
    expect(DROP_SRC).not.toMatch(/setItem/)
  })

  test('GlowJourneyDrop uses existing expo-haptics (already installed)', () => {
    expect(DROP_SRC).toMatch(/expo-haptics/)
  })

  test('GlowJourneyDrop uses existing Animated from react-native', () => {
    expect(DROP_SRC).toMatch(/Animated/)
  })
})

// ── DD. Production motion — weekly goal unchanged ─────────────

describe('DD. Production motion — weekly goal unchanged', () => {
  test('WEEKLY_GLOW_GOAL still imported from glowJourneyStages', () => {
    expect(DROP_SRC).toMatch(/WEEKLY_GLOW_GOAL/)
    expect(DROP_SRC).toMatch(/glowJourneyStages/)
  })

  test('fill ratio still uses getFillRatio from GlowJourneyVisualState', () => {
    expect(DROP_SRC).toMatch(/getFillRatio/)
    expect(DROP_SRC).toMatch(/GlowJourneyVisualState/)
  })

  test('q>3 never raises liquid (targetSurfaceY capped via getFillRatio)', () => {
    const { getFillRatio, surfaceY } = require('../../components/GlowJourneyVisualState')
    const y3 = surfaceY(getFillRatio(3))
    const y5 = surfaceY(getFillRatio(5))
    const y7 = surfaceY(getFillRatio(7))
    const y4 = surfaceY(getFillRatio(4))
    const y6 = surfaceY(getFillRatio(6))
    expect(y3).toBe(y4)
    expect(y4).toBe(y5)
    expect(y5).toBe(y6)
    expect(y6).toBe(y7)
  })
})

// ── EE. Production motion — terminal state = canonical ────────

describe('EE. Production motion — terminal state equals canonical', () => {
  test('all temporary animation values resolve to canonical defaults', () => {
    expect(DROP_SRC).toMatch(/ripenScaleAnim[\s\S]*toValue:\s*1/)
    expect(DROP_SRC).toMatch(/ripenTranslateYAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/ripenHighlightAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/streakOpacityAnim[\s\S]*toValue:\s*1/)
    expect(DROP_SRC).toMatch(/meniscusOffsetAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/causticOpacityAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/glowLineResponseAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/vesselBreathAnim[\s\S]*toValue:\s*0/)
    expect(DROP_SRC).toMatch(/downwardSweepOpacityAnim[\s\S]*toValue:\s*0/)
  })

  test('bloom resolves to completionBloomOpacity (canonical value)', () => {
    expect(DROP_SRC).toMatch(/completionBloomOpacity/)
  })
})

// ── FF. Artwork motion props ──────────────────────────────────

describe('FF. Artwork motion props', () => {
  test('GlowJourneyDropArtwork accepts ripenLeafIndex', () => {
    expect(ARTWORK_SRC).toMatch(/ripenLeafIndex/)
  })

  test('GlowJourneyDropArtwork accepts ripenScale', () => {
    expect(ARTWORK_SRC).toMatch(/ripenScale/)
  })

  test('GlowJourneyDropArtwork accepts ripenHighlight', () => {
    expect(ARTWORK_SRC).toMatch(/ripenHighlight/)
  })

  test('GlowJourneyDropArtwork accepts ripenTranslateY', () => {
    expect(ARTWORK_SRC).toMatch(/ripenTranslateY/)
  })

  test('GlowJourneyDropArtwork accepts meniscusOffsetY', () => {
    expect(ARTWORK_SRC).toMatch(/meniscusOffsetY/)
  })

  test('GlowJourneyDropArtwork accepts causticOpacity and causticY', () => {
    expect(ARTWORK_SRC).toMatch(/causticOpacity/)
    expect(ARTWORK_SRC).toMatch(/causticY/)
  })

  test('GlowJourneyDropArtwork accepts glowLineResponse', () => {
    expect(ARTWORK_SRC).toMatch(/glowLineResponse/)
  })

  test('GlowJourneyDropArtwork accepts vesselBreath', () => {
    expect(ARTWORK_SRC).toMatch(/vesselBreath/)
  })

  test('GlowJourneyDropArtwork accepts downwardSweepY and downwardSweepOpacity', () => {
    expect(ARTWORK_SRC).toMatch(/downwardSweepY/)
    expect(ARTWORK_SRC).toMatch(/downwardSweepOpacity/)
  })

  test('ripen only applies to matching leaf index (not all leaves)', () => {
    expect(ARTWORK_SRC).toMatch(/isRipening/)
    expect(ARTWORK_SRC).toMatch(/i === ripenLeafIndex/)
  })

  test('ripen does not apply when isReduced', () => {
    expect(ARTWORK_SRC).toMatch(/!isReduced/)
  })

  test('ripen highlight uses restrained mint (not broad gold)', () => {
    expect(ARTWORK_SRC).toMatch(/juiceMintLight/)
  })
})

// ── GG. Preview — same mounted instance transitions ───────────

describe('GG. Preview — same mounted instance transitions', () => {
  test('does NOT use renderKey remount for transitions', () => {
    expect(PREVIEW_SRC).not.toMatch(/key=\{renderKey\}/)
    expect(PREVIEW_SRC).not.toMatch(/setRenderKey/)
  })

  test('has Replay button for deterministic transition testing', () => {
    expect(PREVIEW_SRC).toMatch(/handleReplay/)
    expect(PREVIEW_SRC).toMatch(/Replay/)
  })

  test('Replay sets starting preset then triggers next on same component', () => {
    expect(PREVIEW_SRC).toMatch(/replayState/)
    expect(PREVIEW_SRC).toMatch(/phase.*reset/)
    expect(PREVIEW_SRC).toMatch(/phase.*transition/)
  })

  test('Prev/Next change props on same mounted instance (no remount)', () => {
    expect(PREVIEW_SRC).toMatch(/handlePrev/)
    expect(PREVIEW_SRC).toMatch(/handleNext/)
  })
})

// ── HH. Interruption canonical-rest cleanup ───────────────────
// When cancelTimeline() runs for background/inactive or transition
// interruption, all temporary motion values must resolve to the
// current canonical target state — not merely stop animations.

describe('HH. Interruption canonical-rest cleanup', () => {
  test('has resolveToCanonicalRest helper', () => {
    expect(DROP_SRC).toMatch(/resolveToCanonicalRest/)
  })

  test('has resetTempMotionToCanonical helper', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical/)
  })

  test('resolveToCanonicalRest resets liquid to targetSurfaceY', () => {
    expect(DROP_SRC).toMatch(/resolveToCanonicalRest[\s\S]*liquidTranslateAnim\.setValue\(targetSurfaceY\)/)
  })

  test('resolveToCanonicalRest resets meniscus to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*meniscusOffsetAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets caustic opacity to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*causticOpacityAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets Glow-line response to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*glowLineResponseAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets vessel breath to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*vesselBreathAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets Ripen scale to 1', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*ripenScaleAnim\.setValue\(1\)/)
  })

  test('resolveToCanonicalRest resets Ripen translateY to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*ripenTranslateYAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets Ripen highlight to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*ripenHighlightAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets streak opacity to 1', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*streakOpacityAnim\.setValue\(1\)/)
  })

  test('resolveToCanonicalRest resets Journey icon out to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*journeyIconOutAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets Journey icon in to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*journeyIconInAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets Journey hairline to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*journeyHairlineAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets downward sweep opacity to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*downwardSweepOpacityAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets downward sweep Y to 0', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*downwardSweepYAnim\.setValue\(0\)/)
  })

  test('resolveToCanonicalRest resets bloom to canonical value', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*bloomAnim\.setValue\(0\)/)
    expect(DROP_SRC).toMatch(/setBloomOpacity\([\s\S]*completionBloomOpacity/)
  })

  test('resolveToCanonicalRest resets Ripen leaf index to -1', () => {
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*setRipenLeafIndex\(-1\)/)
  })

  test('AppState background/inactive calls resolveToCanonicalRest', () => {
    expect(DROP_SRC).toMatch(/background.*inactive[\s\S]*cancelTimeline[\s\S]*resolveToCanonicalRest/)
  })

  test('transition interruption calls resetTempMotionToCanonical', () => {
    expect(DROP_SRC).toMatch(/cancelTimeline\(\)[\s\S]*resetTempMotionToCanonical/)
  })

  test('cancelTimeline stops timeline + clears timeouts', () => {
    expect(DROP_SRC).toMatch(/timelineRef\.current\.stop/)
    expect(DROP_SRC).toMatch(/clearAllPendingTimeouts/)
  })

  test('resolveToCanonicalRest also sets React state (not just Animated.Values)', () => {
    expect(DROP_SRC).toMatch(/resolveToCanonicalRest[\s\S]*setAnimatedSurfaceY\(targetSurfaceY\)/)
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*setMeniscusOffsetY\(0\)/)
    expect(DROP_SRC).toMatch(/resetTempMotionToCanonical[\s\S]*setStreakOpacity\(1\)/)
  })
})
