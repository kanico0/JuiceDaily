import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Leaf, Sparkles, X, Camera } from 'lucide-react-native'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, FONT_WEIGHT } from '../constants/tokens'
import { card, sectionHeading, primaryAction, primaryActionLabel } from '../constants/styleRecipes'
import { trackEvent } from '../services/AnalyticsService'
import { getFocusForToday, swapFocusToday } from '../services/focusNutrient'

export default function FocusNutrientCard({ onScan, isReduced }) {
  const [focusNutrient, setFocusNutrient] = useState(null)
  const [focusSwapped, setFocusSwapped] = useState(false)
  const [showFocusDetail, setShowFocusDetail] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const n = await getFocusForToday()
      if (mounted && n) setFocusNutrient(n)
    })()
    return () => { mounted = false }
  }, [])

  const handleSwapFocus = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const result = await swapFocusToday()
    if (result.swapped) {
      setFocusNutrient(result.nutrient)
      setFocusSwapped(true)
      trackEvent('focus_nutrient_swapped', { id: result.nutrient.id })
    }
  }, [])

  if (!focusNutrient) return null

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.emoji}>{focusNutrient.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Today's Focus</Text>
            <Text style={styles.name}>{focusNutrient.name}</Text>
          </View>
          <Pressable
            onPress={handleSwapFocus}
            hitSlop={10}
            style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Swap nutrient"
          >
            <Text style={styles.swapText}>Swap</Text>
          </Pressable>
        </View>
        <Text style={styles.benefit}>{focusNutrient.benefit}</Text>
        <View style={styles.comboRow}>
          <Leaf size={13} color={SEMANTIC_COLORS.success} />
          <Text style={styles.comboText}>Try: {focusNutrient.combos[0]}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.tipsBtn, pressed && { opacity: 0.7 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setShowFocusDetail(true)
            trackEvent('focus_nutrient_tips_opened', { id: focusNutrient.id })
          }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="See tips"
        >
          <Sparkles size={14} color={SEMANTIC_COLORS.accentSecondary} />
          <Text style={styles.tipsBtnText}>See tips</Text>
        </Pressable>
      </View>

      <Modal
        visible={showFocusDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFocusDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalEmoji}>{focusNutrient.emoji}</Text>
              <Text style={styles.modalTitle}>{focusNutrient.name}</Text>
              <Pressable
                onPress={() => setShowFocusDetail(false)}
                hitSlop={12}
                style={styles.modalClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={18} color={SEMANTIC_COLORS.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.modalBenefit}>{focusNutrient.benefit}</Text>

            <Text style={styles.modalSection}>Tips</Text>
            {focusNutrient.tips.map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipBullet} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}

            <Text style={styles.modalSection}>Suggested Combos</Text>
            {focusNutrient.combos.map((combo, i) => (
              <View key={i} style={styles.comboItem}>
                <Leaf size={14} color="#81C784" />
                <Text style={styles.comboItemText}>{combo}</Text>
              </View>
            ))}

            <Pressable
              style={({ pressed }) => [styles.modalCta, pressed && { opacity: 0.8 }]}
              onPress={() => {
                setShowFocusDetail(false)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
                onScan()
              }}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Try a scan"
            >
              <Camera size={18} color={SEMANTIC_COLORS.textOnAccent} />
              <Text style={styles.modalCtaText}>Try a Scan</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    ...card,
    width: '100%',
    borderColor: 'rgba(100,181,246,0.12)',
    marginBottom: SEMANTIC_SPACE.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  emoji: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  label: {
    ...sectionHeading,
  },
  name: {
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginTop: 1,
  },
  swapBtn: {
    paddingVertical: SEMANTIC_SPACE.xs,
    paddingHorizontal: 10,
    borderRadius: SEMANTIC_RADIUS.small,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    borderWidth: 0.5,
    borderColor: SEMANTIC_COLORS.borderStrong,
  },
  swapText: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: FONT_WEIGHT.semibold,
    color: SEMANTIC_COLORS.textMuted,
  },
  benefit: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.medium,
    color: SEMANTIC_COLORS.textMuted,
    marginBottom: SEMANTIC_SPACE.sm,
    lineHeight: 18,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  comboText: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.success,
    flex: 1,
  },
  tipsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(100,181,246,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  tipsBtnText: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.semibold,
    color: SEMANTIC_COLORS.accentSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0D1A14',
    borderTopLeftRadius: SEMANTIC_RADIUS.card,
    borderTopRightRadius: SEMANTIC_RADIUS.card,
    paddingHorizontal: SEMANTIC_SPACE.xl,
    paddingTop: SEMANTIC_SPACE.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalEmoji: {
    fontSize: 28,
  },
  modalTitle: {
    flex: 1,
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SEMANTIC_COLORS.surfaceInteractive,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBenefit: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.medium,
    color: SEMANTIC_COLORS.textMuted,
    marginBottom: SEMANTIC_SPACE.lg,
    lineHeight: 20,
  },
  modalSection: {
    ...sectionHeading,
    marginBottom: 10,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  tipBullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: SEMANTIC_COLORS.accentSecondary,
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.medium,
    color: SEMANTIC_COLORS.textPrimary,
    lineHeight: 20,
  },
  comboItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(76,175,80,0.06)',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(76,175,80,0.12)',
  },
  comboItemText: {
    flex: 1,
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.medium,
    color: SEMANTIC_COLORS.success,
  },
  modalCta: {
    ...primaryAction,
    marginTop: SEMANTIC_SPACE.lg,
  },
  modalCtaText: {
    ...primaryActionLabel,
  },
})
