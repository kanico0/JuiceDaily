// ─────────────────────────────────────────────────────────────
// GardenCelebrationOverlay.js — Celebration overlay for Garden
// events: new discovery, bed milestone, new color, Rainbow Harvest.
//
// Follows the same pattern as the existing celebration overlay:
//   - Modal with fade (or none for reduced motion)
//   - Semantic tokens for all colors
//   - Accessible labels
//   - No idle animation loops
//   - Reduced motion is a replacement, not a slowdown
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY } from '../constants/tokens'
import { GARDEN_PALETTE, getColorMarkerColor } from './GardenVisualState'
import { BED_METADATA, COLOR_METADATA } from '../constants/gardenTaxonomy'

const AUTO_DISMISS_MS = 3500

function GardenCelebrationOverlay({
  visible,
  celebration,
  onDismiss,
  onModalDismiss,
  isReduced = false,
}) {
  const { type, data } = celebration || {}

  const autoDismissTimer = useRef(null)
  const dismissedRef = useRef(false)

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current)
      autoDismissTimer.current = null
    }
    onDismiss()
  }, [onDismiss])

  useEffect(() => {
    if (visible) {
      dismissedRef.current = false
      autoDismissTimer.current = setTimeout(() => {
        autoDismissTimer.current = null
        handleDismiss()
      }, AUTO_DISMISS_MS)
    } else {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current)
        autoDismissTimer.current = null
      }
    }
    return () => {
      if (autoDismissTimer.current) {
        clearTimeout(autoDismissTimer.current)
        autoDismissTimer.current = null
      }
    }
  }, [visible])

  const content = useMemo(() => {
    if (!type || !data) return null

    if (type === 'garden_discovery') {
      const bedMeta = BED_METADATA[data.bedKey]
      return {
        emoji: '🌱',
        title: 'New Discovery!',
        subtitle: data.produceName
          ? `${data.produceName} joined your ${bedMeta ? bedMeta.shortLabel : 'Garden'}`
          : `New produce discovered in your ${bedMeta ? bedMeta.shortLabel : 'Garden'}`,
        accentColor: GARDEN_PALETTE.glowColor,
      }
    }

    if (type === 'garden_bed_milestone') {
      const bedMeta = BED_METADATA[data.bedKey]
      return {
        emoji: '🌿',
        title: `${bedMeta ? bedMeta.shortLabel : 'Garden'} is ${data.stage ? data.stage.label : 'Growing'}`,
        subtitle: `${data.produceCount || 0} ${data.produceCount === 1 ? 'discovery' : 'discoveries'} in this area`,
        accentColor: GARDEN_PALETTE.glowColor,
      }
    }

    if (type === 'garden_color') {
      const colorMeta = COLOR_METADATA[data.colorKey]
      return {
        emoji: '🎨',
        title: `New Color: ${colorMeta ? colorMeta.label : 'Discovered'}`,
        subtitle: `${data.colorsDiscovered} of 6 colors found`,
        accentColor: getColorMarkerColor(data.colorKey),
      }
    }

    if (type === 'garden_rainbow') {
      return {
        emoji: '🌈',
        title: 'Rainbow Harvest!',
        subtitle: 'You have discovered all six color groups',
        accentColor: GARDEN_PALETTE.particleColor,
      }
    }

    return null
  }, [type, data])

  if (!content) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isReduced ? 'none' : 'fade'}
      onRequestClose={handleDismiss}
      onDismiss={onModalDismiss}
      accessible
      accessibilityLabel={`Garden celebration: ${content.title}`}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.badgeCircle, { backgroundColor: content.accentColor + '40' }]}>
            <View style={[styles.badgeInner, { backgroundColor: content.accentColor }]} />
          </View>
          <Text style={styles.emoji}>{content.emoji}</Text>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Dismiss celebration"
            accessibilityHint="Closes the Garden celebration"
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SEMANTIC_SPACE.lg,
  },
  card: {
    backgroundColor: SEMANTIC_COLORS.surfaceRaised,
    borderRadius: SEMANTIC_RADIUS.xl,
    padding: SEMANTIC_SPACE.xl,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  badgeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SEMANTIC_SPACE.sm,
  },
  badgeInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  emoji: {
    fontSize: 48,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  title: {
    ...SEMANTIC_TYPOGRAPHY.screenTitle,
    color: SEMANTIC_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    ...SEMANTIC_TYPOGRAPHY.body,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SEMANTIC_SPACE.lg,
  },
  button: {
    backgroundColor: SEMANTIC_COLORS.success,
    borderRadius: SEMANTIC_RADIUS.pill,
    paddingVertical: 10,
    paddingHorizontal: 32,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  buttonText: {
    ...SEMANTIC_TYPOGRAPHY.buttonLabel,
    color: '#0D1510',
  },
})

export default GardenCelebrationOverlay
