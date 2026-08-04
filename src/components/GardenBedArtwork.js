// ─────────────────────────────────────────────────────────────
// GardenBedArtwork.js — Renders a single garden bed with
// toggleable growth layers driven by the bed's stage.
//
// Named groups follow the design spec:
//   garden_<bed>_soil
//   garden_<bed>_sprouts
//   garden_<bed>_leaves
//   garden_<bed>_flowers
//   garden_<bed>_fruit
//   garden_<bed>_glow
//
// Visibility is driven by display prop from data, not image swapping.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { G, Rect, Path, Circle, Ellipse, LinearGradient, Stop, Defs } from 'react-native-svg'
import { getBedStageVisualProps } from './GardenVisualState'

// ── Plant shapes (simple organic primitives) ────────────────
// Sprout: small curved stem with a tiny leaf
const SPROUT_PATH = 'M 0,0 Q -2,-8 0,-14 Q 2,-8 0,0 Z'
const SPROUT_LEAF = 'M 0,-10 Q 5,-12 6,-8 Q 3,-7 0,-10 Z'

// Leaf: broader leaf shape
const LEAF_PATH = 'M 0,0 Q -8,-15 -3,-25 Q 0,-28 3,-25 Q 8,-15 0,0 Z'

// Flower: simple 5-petal flower
const FLOWER_PETAL = 'M 0,-18 Q 4,-22 0,-26 Q -4,-22 0,-18 Z'

// Fruit: simple circle
function FruitShape({ cx, cy, r, color, opacity }) {
  return <Circle cx={cx} cy={cy} r={r} fill={color} opacity={opacity} />
}

function GardenBedArtwork({
  bedKey,
  stageKey,
  position,
  bedColor = '#81C784',
  isCompact = false,
  highlight = false,
}) {
  const props = getBedStageVisualProps(stageKey)
  const { x, y, w, h } = position

  const gradId = useMemo(
    () => `garden_bed_${bedKey}_${Math.random().toString(36).slice(2, 8)}`,
    [bedKey]
  )

  const cx = x + w / 2
  const cy = y + h / 2
  const scale = isCompact ? 0.4 : 1.0

  // Plant positions within the bed (relative to bed center)
  const plantPositions = isCompact
    ? [
        { dx: -8, dy: 0 },
        { dx: 8, dy: -4 },
        { dx: 0, dy: 6 },
      ]
    : [
        { dx: -20, dy: 5 },
        { dx: 0, dy: 0 },
        { dx: 20, dy: 5 },
        { dx: -10, dy: 20 },
        { dx: 10, dy: 20 },
      ]

  const showSoil = stageKey !== 'empty'
  const showSprouts = props.showSprouts
  const showLeaves = props.showLeaves
  const showFlowers = props.showFlowers
  const showFruit = props.showFruit

  return (
    <>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={props.soilFill} stopOpacity="1" />
          <Stop offset="100%" stopColor={props.soilFill} stopOpacity="0.8" />
        </LinearGradient>
      </Defs>

      {/* garden_<bed>_soil */}
      <G id={`garden_${bedKey}_soil`} display={showSoil ? 'inline' : 'none'}>
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={isCompact ? 6 : 12}
          fill={`url(#${gradId})`}
          stroke={highlight ? 'rgba(129,199,132,0.35)' : props.soilStroke}
          strokeWidth={highlight ? 1.5 : 1}
        />
      </G>

      {/* garden_<bed>_glow */}
      <G id={`garden_${bedKey}_glow`} display={props.glowOpacity > 0 ? 'inline' : 'none'}>
        <Rect
          x={x - 2}
          y={y - 2}
          width={w + 4}
          height={h + 4}
          rx={isCompact ? 8 : 14}
          fill={bedColor}
          opacity={props.glowOpacity}
        />
      </G>

      {/* garden_<bed>_sprouts */}
      <G id={`garden_${bedKey}_sprouts`} display={showSprouts ? 'inline' : 'none'}>
        {plantPositions.map((pos, i) => (
          <G
            key={`sprout_${i}`}
            transform={`translate(${cx + pos.dx * scale}, ${cy + pos.dy * scale}) scale(${scale})`}
            opacity={props.plantOpacity}
          >
            <Path d={SPROUT_PATH} fill={bedColor} opacity="0.6" />
            <Path d={SPROUT_LEAF} fill={bedColor} opacity="0.5" />
          </G>
        ))}
      </G>

      {/* garden_<bed>_leaves */}
      <G id={`garden_${bedKey}_leaves`} display={showLeaves ? 'inline' : 'none'}>
        {plantPositions.map((pos, i) => (
          <G
            key={`leaf_${i}`}
            transform={`translate(${cx + pos.dx * scale}, ${cy + pos.dy * scale}) scale(${scale})`}
            opacity={props.plantOpacity}
          >
            <Path d={LEAF_PATH} fill={bedColor} opacity="0.7" />
          </G>
        ))}
      </G>

      {/* garden_<bed>_flowers */}
      <G id={`garden_${bedKey}_flowers`} display={showFlowers ? 'inline' : 'none'}>
        {plantPositions.map((pos, i) => (
          <G
            key={`flower_${i}`}
            transform={`translate(${cx + pos.dx * scale}, ${cy + pos.dy * scale - 20 * scale}) scale(${scale})`}
            opacity={props.plantOpacity}
          >
            {[0, 72, 144, 216, 288].map((angle) => (
              <Path
                key={`petal_${angle}`}
                d={FLOWER_PETAL}
                fill={bedColor}
                opacity="0.6"
                transform={`rotate(${angle})`}
              />
            ))}
            <Circle cx="0" cy="-22" r="2" fill="#F5D98B" opacity="0.8" />
          </G>
        ))}
      </G>

      {/* garden_<bed>_fruit */}
      <G id={`garden_${bedKey}_fruit`} display={showFruit ? 'inline' : 'none'}>
        {plantPositions.map((pos, i) => (
          <FruitShape
            key={`fruit_${i}`}
            cx={cx + pos.dx * scale}
            cy={cy + pos.dy * scale - 12 * scale}
            r={isCompact ? 2 : 4}
            color={bedColor}
            opacity={props.plantOpacity * 0.8}
          />
        ))}
      </G>
    </>
  )
}

export default GardenBedArtwork
