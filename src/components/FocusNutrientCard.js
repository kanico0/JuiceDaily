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
import { DARK, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
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
          {!focusSwapped && (
            <Pressable
              onPress={handleSwapFocus}
              hitSlop={10}
              style={({ pressed }) => [styles.swapBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Swap nutrient"
            >
              <Text style={styles.swapText}>Swap</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.benefit}>{focusNutrient.benefit}</Text>
        <View style={styles.comboRow}>
          <Leaf size={13} color="#81C784" />
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
          <Sparkles size={14} color="#64B5F6" />
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
                <X size={18} color={DARK.textMuted} />
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
              <Camera size={18} color="#FFFFFF" />
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
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.12)',
    marginBottom: 12,
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
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  name: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
    marginTop: 1,
  },
  swapBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  swapText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textMuted,
  },
  benefit: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    marginBottom: 8,
    lineHeight: 18,
  },
  comboRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  comboText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: '#81C784',
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
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: '#64B5F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0D1A14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
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
    fontSize: FONT_SIZE.xl || 22,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textPrimary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBenefit: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textMuted,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalSection: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: DARK.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    backgroundColor: '#64B5F6',
    marginTop: 6,
  },
  tipText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textPrimary,
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
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: '#81C784',
  },
  modalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2E7D32',
  },
  modalCtaText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: '#FFFFFF',
  },
})
