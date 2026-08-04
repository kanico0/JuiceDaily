// ─────────────────────────────────────────────────────────────
// GardenCard.js — Today-screen card showing compact Garden
// artwork with summary text. Tappable to open Garden detail.
//
// Follows the same card treatment as the existing progress card:
//   - Glass surface, rounded corners, semantic tokens
//   - Accessible label with discovery count
//   - Touchable with 44x44pt min target
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { useWindowDimensions } from 'react-native'
import GardenCompactArtwork from './GardenCompactArtwork'
import { buildGardenVisualState, GARDEN_PALETTE } from './GardenVisualState'
import { getGardenSummary, getNextDiscoveryHint } from '../services/gardenService'
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_RADIUS, SEMANTIC_SHADOWS } from '../constants/tokens'

const MIN_CARD_WIDTH = 280
const MAX_CARD_WIDTH = 412

function GardenCard({
  entries,
  onPress,
  isReduced = false,
}) {
  const { width: screenWidth } = useWindowDimensions()

  const summary = useMemo(() => getGardenSummary(entries), [entries])
  const visualState = useMemo(() => buildGardenVisualState(summary), [summary])
  const hint = useMemo(() => getNextDiscoveryHint(entries), [entries])

  const cardWidth = Math.min(Math.max(screenWidth - 32, MIN_CARD_WIDTH), MAX_CARD_WIDTH)
  const artworkSize = Math.min(cardWidth * 0.38, 140)

  const accessibilityLabel = `RawLife Garden: ${summary.discoveredCount} produce discovered across ${summary.bedsStarted} of ${summary.totalBeds} beds. ${summary.discoveredColorCount} of ${summary.totalColors} colors discovered. ${summary.rainbowComplete ? 'Rainbow Harvest complete.' : ''}`

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Opens the RawLife Garden detail view"
      style={({ pressed }) => [
        styles.container,
        { width: cardWidth, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Compact artwork */}
        <View style={styles.artworkContainer}>
          <GardenCompactArtwork
            visualState={visualState}
            size={artworkSize}
            isReduced={isReduced}
          />
        </View>

        {/* Text summary */}
        <View style={styles.textContainer}>
          <Text style={styles.title}>RawLife Garden</Text>
          <Text style={styles.discoveryCount}>
            {summary.discoveredCount} {summary.discoveredCount === 1 ? 'discovery' : 'discoveries'}
          </Text>
          <Text style={styles.bedsText}>
            {summary.bedsStarted} of {summary.totalBeds} areas growing
          </Text>
          <Text style={styles.colorsText}>
            {summary.discoveredColorCount} of {summary.totalColors} colors found
          </Text>
          {summary.rainbowComplete && (
            <Text style={styles.rainbowText}>Rainbow Harvest complete</Text>
          )}
          {hint && !summary.rainbowComplete && (
            <Text style={styles.hintText} numberOfLines={2}>
              {hint.message}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SEMANTIC_COLORS.surfaceRaised,
    borderRadius: SEMANTIC_RADIUS.large,
    padding: 12,
    marginVertical: 6,
    alignSelf: 'center',
    ...SEMANTIC_SHADOWS.card,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artworkContainer: {
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
    flexDirection: 'column',
    gap: 2,
  },
  title: {
    ...SEMANTIC_TYPOGRAPHY.cardTitle,
    color: SEMANTIC_COLORS.textPrimary,
  },
  discoveryCount: {
    ...SEMANTIC_TYPOGRAPHY.numericEmphasis,
    color: GARDEN_PALETTE.glowColor,
    fontSize: 18,
  },
  bedsText: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
  },
  colorsText: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
  },
  rainbowText: {
    ...SEMANTIC_TYPOGRAPHY.bodyStrong,
    color: GARDEN_PALETTE.particleColor,
  },
  hintText: {
    ...SEMANTIC_TYPOGRAPHY.caption,
    color: SEMANTIC_COLORS.textMuted,
    marginTop: 2,
  },
})

export default GardenCard
