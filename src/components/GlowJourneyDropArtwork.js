import React, { useRef } from 'react'
import { View } from 'react-native'
import Svg, {
  Defs, ClipPath, Path, G, Rect, Circle, Ellipse, Line,
  LinearGradient, RadialGradient, Stop, Text as SvgText,
} from 'react-native-svg'
import { GLOW_PALETTE } from './GlowJourneyVisualState'

// ─────────────────────────────────────────────────────────────
// Living Juice Glow — Hero + Week Vine artwork
// (GLOW_RECONSTRUCTION_FINAL spec §5, §6, §13)
//
// Filter-free production implementation. All blur effects from
// the reference SVGs are replaced with layered gradients, opacity,
// and stacked strokes per spec §13.
// ─────────────────────────────────────────────────────────────

// ── Locked vessel silhouette (spec §5 — do not redraw) ───────
const VESSEL_PATH = 'M118,14 C112,50 130,76 150,104 C170,132 180,152 178,176 C174,220 142,250 98,250 C56,250 22,216 22,172 C22,146 34,124 52,100 C74,70 100,44 118,14 Z'

// ── Vine constants (spec §6) ─────────────────────────────────
const VINE_VIEWBOX_W = 360
const VINE_VIEWBOX_H = 80
const VINE_STEM_PATH = 'M20,26 Q180,34 340,26'
const VINE_LEAF_CENTERS = [34, 82.7, 131.3, 180, 228.7, 277.3, 326]
const VINE_DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function vineLeafPath(cx) {
  return `M ${cx - 17},24 Q ${cx},7 ${cx + 17},24 Q ${cx},41 ${cx - 17},24 Z`
}

// ── Hero SVG ─────────────────────────────────────────────────
function GlowHero({ heroState, surfaceTranslateY, isReduced }) {
  const {
    surfaceY,
    ambientOpacity,
    rimMintOpacity,
    rimGoldOpacity,
    rimLightLowerRight,
    surfaceBloomOpacity,
    completionBloomOpacity,
    pulpCount,
    isComplete,
    beyondGoal,
  } = heroState

  const idsRef = useRef(null)
  if (!idsRef.current) {
    const s = Math.random().toString(36).slice(2, 8)
    idsRef.current = {
      clip: `glow_clip_${s}`,
      juice: `glow_juice_${s}`,
      strat: `glow_strat_${s}`,
      glass: `glow_glass_${s}`,
      rim: `glow_rim_${s}`,
      amb: `glow_amb_${s}`,
      bloom: `glow_bloom_${s}`,
      caustic: `glow_caustic_${s}`,
      depth: `glow_depth_${s}`,
      leafGlow: `glow_leafglow_${s}`,
    }
  }
  const ids = idsRef.current

  // Meniscus curve at the current surface level
  const meniscusY = 0 // local y=0 inside the translated liquid group
  const meniscusPath = `M-12,${meniscusY + 3} Q100,${meniscusY - 8} 212,${meniscusY + 3}`

  // Pulp bubble positions (5 default, 9 when beyond goal)
  const pulpPositions = [
    { cx: 78, cy: 147 }, { cx: 126, cy: 173 }, { cx: 94, cy: 203 },
    { cx: 140, cy: 229 }, { cx: 60, cy: 190 },
    { cx: 110, cy: 155 }, { cx: 150, cy: 200 }, { cx: 88, cy: 220 }, { cx: 130, cy: 240 },
  ]

  return (
    <G id="glowhero_container">
      <Defs>
        <ClipPath id={ids.clip}>
          <Path d={VESSEL_PATH} />
        </ClipPath>
        {/* Juice body gradient — vertical, surface to bottom */}
        <LinearGradient id={ids.juice} x1="0" y1={String(surfaceY)} x2="0" y2="252" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GLOW_PALETTE.juiceHighlight} />
          <Stop offset="0.38" stopColor={GLOW_PALETTE.juiceGoldMid} />
          <Stop offset="1" stopColor={GLOW_PALETTE.juiceGoldDeep} />
        </LinearGradient>
        {/* Mint stratum gradient */}
        <LinearGradient id={ids.strat} x1="0" y1={String(surfaceY - 8)} x2="0" y2={String(surfaceY + 12)} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GLOW_PALETTE.juiceMintLight} />
          <Stop offset="1" stopColor={GLOW_PALETTE.juiceMintDeep} />
        </LinearGradient>
        {/* Glass interior gradient */}
        <LinearGradient id={ids.glass} x1="0.1" y1="0" x2="0.9" y2="1">
          <Stop offset="0" stopColor="#18271F" />
          <Stop offset="1" stopColor="#0A1310" />
        </LinearGradient>
        {/* Rim gradient — mint to gold */}
        <LinearGradient id={ids.rim} x1="0" y1="0" x2="0" y2="252" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GLOW_PALETTE.juiceMint} stopOpacity="0.87" />
          <Stop offset="0.5" stopColor="#A6EDCB" stopOpacity="0.64" />
          <Stop offset="1" stopColor={GLOW_PALETTE.juiceGoldLight} stopOpacity="0.77" />
        </LinearGradient>
        {/* Ambient radial glow */}
        <RadialGradient id={ids.amb} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FF9D2E" stopOpacity="0.60" />
          <Stop offset="0.5" stopColor="#E06A16" stopOpacity="0.20" />
          <Stop offset="1" stopColor="#E06A16" stopOpacity="0" />
        </RadialGradient>
        {/* Completion bloom */}
        <RadialGradient id={ids.bloom} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#FFC163" stopOpacity="0.30" />
          <Stop offset="0.58" stopColor={GLOW_PALETTE.juiceGold} stopOpacity="0.16" />
          <Stop offset="1" stopColor={GLOW_PALETTE.juiceMint} stopOpacity="0" />
        </RadialGradient>
        {/* Bottom caustic */}
        <RadialGradient id={ids.caustic} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={GLOW_PALETTE.juiceGoldLight} stopOpacity="0.30" />
          <Stop offset="1" stopColor={GLOW_PALETTE.juiceGoldLight} stopOpacity="0" />
        </RadialGradient>
        {/* Depth shade */}
        <RadialGradient id={ids.depth} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#8E3305" stopOpacity="0.30" />
          <Stop offset="1" stopColor="#8E3305" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* z1 — ambient light (edgeless radial ellipse) */}
      <Ellipse cx="100" cy="172" rx="126" ry="140" fill={`url(#${ids.amb})`} opacity={ambientOpacity} />

      {/* z1b — completion bloom (only when goal met) */}
      {isComplete && (
        <Ellipse cx="100" cy="100" rx="110" ry="120" fill={`url(#${ids.bloom})`} opacity={completionBloomOpacity} />
      )}

      {/* z2 — vessel interior (dark glass gradient) */}
      <Path d={VESSEL_PATH} fill={`url(#${ids.glass})`} />

      {/* z2b — interior shoulder shade (upper-right flank) */}
      <Path d="M118,14 C112,50 130,76 150,104 C170,132 180,152 178,176"
            fill="none" stroke="#2A4437" strokeWidth="6" opacity="0.5" />

      {/* z3 — liquid group (clipped to vessel, translated to surface) */}
      <G clipPath={`url(#${ids.clip})`}>
        <G transform={`translate(0, ${surfaceTranslateY})`}>
          {/* Juice body — meniscus curve down to bottom */}
          <Path d={`${meniscusPath} L212,270 L-12,270 Z`} fill={`url(#${ids.juice})`} />

          {/* Bottom caustic */}
          <Ellipse cx="96" cy="236" rx="66" ry="28" fill={`url(#${ids.caustic})`} />

          {/* Depth shade (lower right) */}
          <Ellipse cx="150" cy="177" rx="40" ry="70" fill={`url(#${ids.depth})`} />

          {/* Pulp bubbles */}
          {pulpPositions.slice(0, pulpCount).map((pos, i) => (
            <Circle key={`pulp_${i}`} cx={pos.cx} cy={pos.cy} r={i % 2 === 0 ? 4.5 : 3.5}
                    fill={GLOW_PALETTE.juiceGoldLight} opacity="0.30" />
          ))}

          {/* Mint stratum — band on the surface curve */}
          <Path d={`${meniscusPath} L212,${meniscusY + 12} Q100,${meniscusY + 1} -12,${meniscusY + 12} Z`}
                fill={`url(#${ids.strat})`} opacity="0.86" />

          {/* Glow line soft halo — gradient-filled band, no blur */}
          <Path d={`${meniscusPath} L212,${meniscusY + 22} Q100,${meniscusY + 11} -12,${meniscusY + 22} Z`}
                fill={GLOW_PALETTE.juiceMintLight} opacity="0.25" />

          {/* Glow line core — crisp stroke */}
          <Path d={meniscusPath} fill="none" stroke={GLOW_PALETTE.glowLine} strokeWidth="2.8" opacity="0.95" />

          {/* Surface bloom — radial ellipse above surface */}
          <Ellipse cx="100" cy={meniscusY - 6} rx="84" ry="26"
                   fill={GLOW_PALETTE.juiceMintLight} opacity={surfaceBloomOpacity} />

          {/* Inner highlight — plain rounded path, low opacity */}
          <Path d="M64,4 C50,38 48,72 58,100" fill="none"
                stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" opacity="0.14" />

          {/* Inner rim shadow — two stacked clipped strokes */}
          <Path d={VESSEL_PATH} fill="none" stroke="#5A1F02" strokeWidth="12" opacity="0.18" />
          <Path d={VESSEL_PATH} fill="none" stroke="#5A1F02" strokeWidth="5" opacity="0.12" />
        </G>
      </G>

      {/* z4 — vessel rim (mint→gold gradient stroke) */}
      <Path d={VESSEL_PATH} fill="none" stroke={`url(#${ids.rim})`} strokeWidth="2.8"
            strokeLinejoin="round" opacity={rimMintOpacity} />

      {/* z4b — specular upper-left (plain rounded path) */}
      <Path d="M74,86 C62,104 54,120 48,138" fill="none"
            stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" opacity="0.40" />

      {/* z4c — rim light lower-right (gold stroke, progress-driven) */}
      <Path d="M166,192 C162,220 142,240 118,246" fill="none"
            stroke={GLOW_PALETTE.juiceGoldLight} strokeWidth="4"
            strokeLinecap="round" opacity={rimLightLowerRight} />
    </G>
  )
}

// ── Week Vine SVG ────────────────────────────────────────────
function GlowWeekVine({ leafStates, isReduced }) {
  const idsRef = useRef(null)
  if (!idsRef.current) {
    const s = Math.random().toString(36).slice(2, 8)
    idsRef.current = {
      leafGrad: `vine_leafgrad_${s}`,
      leafGlow: `vine_leafglow_${s}`,
    }
  }
  const ids = idsRef.current

  return (
    <G id="glowweekvine_container">
      <Defs>
        {/* Logged leaf gradient — gold vertical */}
        <LinearGradient id={ids.leafGrad} x1="0" y1="7" x2="0" y2="41" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GLOW_PALETTE.juiceGoldLight} />
          <Stop offset="0.55" stopColor={GLOW_PALETTE.juiceGold} />
          <Stop offset="1" stopColor="#EE7F16" />
        </LinearGradient>
        {/* Logged leaf glow — radial */}
        <RadialGradient id={ids.leafGlow} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={GLOW_PALETTE.juiceGold} stopOpacity="0.45" />
          <Stop offset="1" stopColor={GLOW_PALETTE.juiceGold} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Stem — drawn first, behind leaves */}
      <Path d={VINE_STEM_PATH} fill="none"
            stroke={GLOW_PALETTE.weekStem} strokeWidth="2.5" strokeLinecap="round" />

      {/* 7 leaves */}
      {VINE_LEAF_CENTERS.map((cx, i) => {
        const leaf = leafStates[i]
        if (!leaf) return null
        const vs = leaf.visual || {}
        const logged = vs.logged || leaf.hasLog
        const leafPath = vineLeafPath(cx)

        return (
          <G key={`vine_leaf_${i}`} id={`glowweekvine_leaf_${i}`}
             transform={`rotate(-16 ${cx} 24)`}>
            {/* Glow behind logged leaves only */}
            {logged && (
              <Ellipse cx={cx} cy="24" rx="26" ry="16"
                       fill={`url(#${ids.leafGlow})`} opacity="0.5" />
            )}
            {/* Leaf body */}
            <Path d={leafPath}
                  fill={logged ? `url(#${ids.leafGrad})` : GLOW_PALETTE.weekLeafOffFill}
                  opacity={leaf.isFuture ? 0.4 : 1} />
            {/* Midrib — logged only */}
            {logged && (
              <Line x1={cx - 15} y1="24" x2={cx + 15} y2="24"
                    stroke="#B85B12" strokeWidth="2" opacity="0.55" strokeLinecap="round" />
            )}
            {/* Leaf stroke */}
            <Path d={leafPath} fill="none"
                  stroke={logged ? '#FFE9C2' : GLOW_PALETTE.weekLeafOffStroke}
                  strokeWidth={logged ? 1.6 : 2}
                  strokeOpacity={logged ? 0.75 : 1} />
          </G>
        )
      })}

      {/* Day initials — M T W T F S S */}
      {VINE_LEAF_CENTERS.map((cx, i) => {
        const leaf = leafStates[i]
        if (!leaf) return null
        const vs = leaf.visual || {}
        const logged = vs.logged || leaf.hasLog
        return (
          <SvgText key={`vine_initial_${i}`}
                   x={cx} y="61" fontSize="16" fontWeight={logged ? '600' : '500'}
                   fill={logged ? GLOW_PALETTE.ink : GLOW_PALETTE.inkMuted}
                   textAnchor="middle"
                   fontFamily="system-ui, sans-serif">
            {VINE_DAY_INITIALS[i]}
          </SvgText>
        )
      })}

      {/* Today dot — mint circle under today's initial */}
      {leafStates.map((leaf, i) => {
        if (!leaf || !leaf.isToday) return null
        return (
          <Circle key="vine_today_dot"
                  cx={VINE_LEAF_CENTERS[i]} cy="71" r="3"
                  fill={GLOW_PALETTE.juiceMint} />
        )
      })}
    </G>
  )
}

// ── Main artwork component ───────────────────────────────────
function GlowJourneyDropArtwork({
  visualState,
  heroWidth = 187,
  vineWidth = 292,
  surfaceTranslateY = 0,
  isReduced = false,
}) {
  const { heroState, leafStates } = visualState

  // Hero SVG: viewBox 0 0 200 260, width = heroWidth, height follows aspect
  const heroHeight = heroWidth * (260 / 200)

  // Vine SVG: viewBox 0 0 360 80, width = vineWidth, height follows aspect
  const vineHeight = vineWidth * (80 / 360)

  return (
    <View id="glowjourney_artwork" style={{ alignItems: 'center' }}>
      {/* GlowHero — viewBox 0 0 200 260 */}
      <View testID="glowhero_wrap" style={{ alignItems: 'center' }}>
        <Svg width={heroWidth} height={heroHeight} viewBox="0 0 200 260"
             accessibilityLabel="Glow Journey hero"
             accessibilityRole="progressbar"
             accessibilityValue={{ min: 0, max: 3, now: heroState.q }}>
          <GlowHero
            heroState={heroState}
            surfaceTranslateY={surfaceTranslateY}
            isReduced={isReduced}
          />
        </Svg>
      </View>

      {/* GlowWeekVine — viewBox 0 0 360 80 */}
      <View testID="glowweekvine_wrap" style={{ marginTop: 6, alignItems: 'center' }}>
        <Svg width={vineWidth} height={vineHeight} viewBox={`0 0 ${VINE_VIEWBOX_W} ${VINE_VIEWBOX_H}`}
             accessibilityLabel="Weekly vine tracker">
          <GlowWeekVine leafStates={leafStates} isReduced={isReduced} />
        </Svg>
      </View>
    </View>
  )
}

export default GlowJourneyDropArtwork
