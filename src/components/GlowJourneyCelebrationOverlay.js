import React, { useMemo, useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'

const AUTO_DISMISS_MS = 3500

function GlowJourneyCelebrationOverlay({
  visible,
  stage,
  lifetimeDays,
  onDismiss,
  onModalDismiss,
  isReduced = false,
}) {
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

  if (!stage) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isReduced ? 'none' : 'fade'}
      onRequestClose={handleDismiss}
      onDismiss={onModalDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.badgeCircle}>
            <View style={styles.badgeInner} />
          </View>
          <Text style={styles.emoji}>{stage.emoji}</Text>
          <Text style={styles.title}>You're {stage.label}</Text>
          <Text style={styles.subtitle}>
            {lifetimeDays} days of adding more raw to your life
          </Text>
          <TouchableOpacity
            onPress={handleDismiss}
            style={styles.button}
            accessibilityRole="button"
            accessibilityLabel="Dismiss celebration"
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
    backgroundColor: SEMANTIC_COLORS.surfaceElevated,
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
    backgroundColor: 'rgba(245,217,139,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SEMANTIC_SPACE.sm,
  },
  badgeInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F2C14E',
  },
  emoji: {
    fontSize: 48,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: SEMANTIC_COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SEMANTIC_SPACE.lg,
  },
  button: {
    backgroundColor: SEMANTIC_COLORS.success,
    borderRadius: SEMANTIC_RADIUS.pill,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D1510',
  },
})

export default GlowJourneyCelebrationOverlay
