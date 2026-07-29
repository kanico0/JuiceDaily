import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { SEMANTIC_COLORS, SEMANTIC_TYPOGRAPHY, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { standardCard, compactSupportingCard } from '../constants/styleRecipes'

// ── Disclaimer copy (exact from Docs/disclaimer_copy.md) ───────

const FIRST_USE_TITLE = 'Before you explore'

const FIRST_USE_BODY =
  'This tool suggests juices based on nutrients that are commonly discussed ' +
  'online for general wellness topics — it\'s for education and entertainment, ' +
  'not medical advice. It doesn\'t diagnose, treat, or replace guidance from a ' +
  'doctor or registered dietitian. If you have a persistent symptom or a ' +
  'diagnosed condition, please check with a healthcare professional before ' +
  'changing your diet.'

const FIRST_USE_BUTTON = 'Got it, show me juices'

const BANNER_TEXT = 'For education & entertainment only — not medical advice.'

const BANNER_LEARN_MORE = 'Learn more'

const MICRO_DISCLAIMER = 'Nutrient info is general, not personalized. Not a substitute for medical advice.'

const SETTINGS_TITLE = 'Wellness Lookup Disclaimer'

const SETTINGS_BODY =
  'The Wellness Lookup feature suggests juices based on vitamins, minerals, ' +
  'and plant compounds that are commonly associated online with general ' +
  'wellness topics (e.g. joint comfort, immune support, energy levels). ' +
  'These associations are drawn from generally available public nutrition ' +
  'information and are provided for educational and entertainment purposes ' +
  'only.\n\n' +
  'This feature is not a medical device, does not diagnose or treat any ' +
  'condition, and is not a substitute for professional medical advice, ' +
  'diagnosis, or treatment. Individual nutritional needs vary. Always consult ' +
  'a doctor, registered dietitian, or other qualified health provider before ' +
  'making dietary changes — especially if you are pregnant or nursing, take ' +
  'medication, or manage a diagnosed medical condition.'

// ── AsyncStorage key for first-use persistence ─────────────────

const WELLNESS_DISCLAIMER_ACCEPTED_KEY = '@wellness_disclaimer_accepted'

export function useWellnessDisclaimerAccepted() {
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(WELLNESS_DISCLAIMER_ACCEPTED_KEY)
      .then((val) => {
        if (val === 'true') setAccepted(true)
      })
      .catch(() => {})
  }, [])

  const accept = useCallback(() => {
    setAccepted(true)
    AsyncStorage.setItem(WELLNESS_DISCLAIMER_ACCEPTED_KEY, 'true').catch(() => {})
  }, [])

  return [accepted, accept]
}

export function resetWellnessDisclaimer() {
  AsyncStorage.removeItem(WELLNESS_DISCLAIMER_ACCEPTED_KEY).catch(() => {})
}

// ── 1. First-use modal ─────────────────────────────────────────

export function WellnessDisclaimerModal({ visible, onAccept }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{FIRST_USE_TITLE}</Text>
          <Text style={styles.modalBody}>{FIRST_USE_BODY}</Text>
          <TouchableOpacity
            style={styles.modalBtn}
            onPress={onAccept}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={FIRST_USE_BUTTON}
          >
            <Text style={styles.modalBtnText}>{FIRST_USE_BUTTON}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── 2. Persistent banner ───────────────────────────────────────

export function WellnessBanner({ onLearnMore }) {
  return (
    <View style={styles.bannerWrap}>
      <Text style={styles.bannerText}>
        {'\u{1F9E1}'} {BANNER_TEXT}{' '}
        <Text
          style={styles.bannerLink}
          onPress={onLearnMore}
          accessibilityRole="link"
          accessibilityLabel={BANNER_LEARN_MORE}
        >
          {BANNER_LEARN_MORE}
        </Text>
      </Text>
    </View>
  )
}

// ── 3. Micro-disclaimer ────────────────────────────────────────

export function WellnessMicroDisclaimer() {
  return (
    <Text style={styles.microText}>{MICRO_DISCLAIMER}</Text>
  )
}

// ── 4. Settings / About full version ───────────────────────────

export function WellnessSettingsDisclaimer() {
  return (
    <View style={styles.settingsWrap}>
      <Text style={styles.settingsTitle}>{SETTINGS_TITLE}</Text>
      <Text style={styles.settingsBody}>{SETTINGS_BODY}</Text>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SEMANTIC_SPACE.xl,
  },
  modalCard: {
    ...standardCard,
    backgroundColor: SEMANTIC_COLORS.surfaceRaised,
    borderRadius: SEMANTIC_RADIUS.large,
    padding: SEMANTIC_SPACE.xl,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.screenTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.screenTitle.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: SEMANTIC_SPACE.md,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SEMANTIC_SPACE.lg,
  },
  modalBtn: {
    borderRadius: SEMANTIC_RADIUS.pill,
    backgroundColor: SEMANTIC_COLORS.accentPrimary,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textOnAccent,
  },
  bannerWrap: {
    ...compactSupportingCard,
    borderRadius: SEMANTIC_RADIUS.medium,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  bannerText: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 18,
  },
  bannerLink: {
    color: SEMANTIC_COLORS.accentSecondary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  microText: {
    fontSize: 10,
    color: SEMANTIC_COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 14,
  },
  settingsWrap: {
    ...standardCard,
    padding: SEMANTIC_SPACE.lg,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  settingsTitle: {
    fontSize: SEMANTIC_TYPOGRAPHY.bodyStrong.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.bodyStrong.fontWeight,
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  settingsBody: {
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 18,
  },
})
