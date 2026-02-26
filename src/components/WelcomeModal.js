// ─────────────────────────────────────────────────────────────
// WelcomeModal.js — First-launch onboarding flow
// Step 1: Welcome + Name input
// Step 2: Freezer Pass explanation + Notification permission
// Step 3: Challenge start confirmation
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  ArrowRight,
  Sparkles,
} from 'lucide-react-native'
import { requestNotificationPermission } from '../services/NotificationService'

const STEPS = [
  { key: 'welcome', title: 'Welcome, Architect' },
  { key: 'start', title: 'Let\'s Begin' },
]

// ── Step 1: Welcome + Name ───────────────────────────────────

function WelcomeStep({ name, onNameChange, onNext }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[styles.stepWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.emoji}>🏗️</Text>
      <Text style={styles.stepTitle}>Welcome, Wellness Architect</Text>
      <Text style={styles.stepDesc}>
        Your first 7-day challenge begins now.{'\n'}
        Your goal: <Text style={styles.highlight}>One color per day.</Text>
      </Text>

      <View style={styles.inputWrap}>
        <Text style={styles.inputLabel}>What should we call you?</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={onNameChange}
          placeholder="Your name"
          placeholderTextColor="#484F58"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => name.trim() && onNext()}
        />
      </View>

      <TouchableOpacity
        style={[styles.nextBtn, !name.trim() && styles.nextBtnDisabled]}
        onPress={() => {
          if (!name.trim()) return
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onNext()
        }}
        activeOpacity={0.8}
        disabled={!name.trim()}
      >
        <Text style={styles.nextBtnText}>Continue</Text>
        <ArrowRight size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Step 2: Freezer Pass + Notification Permission ───────────

function FreezerStep({ name, onNext }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [permissionAsked, setPermissionAsked] = useState(false)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start()
  }, [])

  const handleAllowNotifications = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const granted = await requestNotificationPermission()
    setPermissionGranted(granted)
    setPermissionAsked(true)
  }, [])

  return (
    <Animated.View style={[styles.stepWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.freezerIcon}>
        <Snowflake size={32} color="#90CAF9" />
      </View>
      <Text style={styles.stepTitle}>Your Freezer Pass</Text>
      <Text style={styles.stepDesc}>
        Life happens, {name}. If you miss a day, your{' '}
        <Text style={styles.highlightBlue}>Freezer Pass</Text> automatically
        protects your streak. You start with <Text style={styles.highlightBlue}>2 passes</Text>.
      </Text>

      <View style={styles.freezerCard}>
        <View style={styles.freezerRow}>
          <Snowflake size={16} color="#90CAF9" />
          <Text style={styles.freezerText}>Miss a day → streak frozen, not broken</Text>
        </View>
        <View style={styles.freezerRow}>
          <Snowflake size={16} color="#90CAF9" />
          <Text style={styles.freezerText}>Complete a rainbow → earn another pass</Text>
        </View>
        <View style={styles.freezerRow}>
          <Snowflake size={16} color="#90CAF9" />
          <Text style={styles.freezerText}>Max 3 passes at any time</Text>
        </View>
      </View>

      <View style={styles.notifSection}>
        <View style={styles.notifHeader}>
          <Bell size={16} color="#FFD54F" />
          <Text style={styles.notifTitle}>Stay Protected</Text>
        </View>
        <Text style={styles.notifDesc}>
          Allow notifications so we can alert you before a Freezer Pass is used.
          We'll never spam — max 3 per day.
        </Text>
        {!permissionAsked ? (
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={handleAllowNotifications}
            activeOpacity={0.8}
          >
            <Bell size={16} color="#FFFFFF" />
            <Text style={styles.notifBtnText}>Allow Notifications</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.notifResult}>
            <Text style={[styles.notifResultText, { color: permissionGranted ? '#81C784' : '#FFB74D' }]}>
              {permissionGranted ? '✓ Notifications enabled' : 'You can enable later in Settings'}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.nextBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onNext()
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.nextBtnText}>Continue</Text>
        <ArrowRight size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Step 3: Challenge Start ──────────────────────────────────

function StartStep({ name, onComplete }) {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 8, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Animated.View style={[styles.stepWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.emoji}>🌈</Text>
      <Text style={styles.stepTitle}>Ready, Architect {name}?</Text>
      <Text style={styles.stepDesc}>
        Your 7-Day Rainbow Challenge starts now.{'\n'}
        Close your three daily rings. Paint the weekly spectrum.{'\n'}
        Build the body you deserve.
      </Text>

      <View style={styles.goalCard}>
        <View style={styles.goalRow}>
          <Text style={styles.goalEmoji}>💧</Text>
          <Text style={styles.goalText}><Text style={{ color: '#64B5F6' }}>Base</Text> — Hydration foundation</Text>
        </View>
        <View style={styles.goalRow}>
          <Text style={styles.goalEmoji}>⚡</Text>
          <Text style={styles.goalText}><Text style={{ color: '#81C784' }}>Power</Text> — Dense micronutrients</Text>
        </View>
        <View style={styles.goalRow}>
          <Text style={styles.goalEmoji}>🔥</Text>
          <Text style={styles.goalText}><Text style={{ color: '#FFB74D' }}>Kick</Text> — Metabolic ignition</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          onComplete()
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#4CAF50', '#2E7D32']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.startBtnGradient}
        >
          <Sparkles size={20} color="#FFFFFF" />
          <Text style={styles.startBtnText}>Begin My Challenge</Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Main Modal ───────────────────────────────────────────────

export default function WelcomeModal({ visible, onComplete }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')

  const handleComplete = useCallback(() => {
    onComplete(name.trim())
  }, [name, onComplete])

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardWrap}
        >
          <View style={styles.card}>
            {/* Progress dots */}
            <View style={styles.dots}>
              {STEPS.map((s, i) => (
                <View
                  key={s.key}
                  style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
                />
              ))}
            </View>

            {step === 0 && (
              <WelcomeStep
                name={name}
                onNameChange={setName}
                onNext={() => {
                  // Silently request notification permission (default to enabled)
                  requestNotificationPermission().catch(() => {})
                  setStep(1)
                }}
              />
            )}
            {step === 1 && (
              <StartStep
                name={name}
                onComplete={handleComplete}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'rgba(13,17,23,0.95)',
    borderRadius: 32,
    padding: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dotActive: {
    backgroundColor: '#81C784',
    width: 24,
  },
  dotDone: {
    backgroundColor: 'rgba(129,199,132,0.4)',
  },
  stepWrap: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 15,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  highlight: {
    color: '#81C784',
    fontWeight: '700',
  },
  highlightBlue: {
    color: '#90CAF9',
    fontWeight: '700',
  },

  // Name input
  inputWrap: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  // Next button
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 28,
    width: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  nextBtnDisabled: {
    opacity: 0.3,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Freezer Pass
  freezerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(100,181,246,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.15)',
  },
  freezerCard: {
    width: '100%',
    backgroundColor: 'rgba(100,181,246,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 20,
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.1)',
  },
  freezerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  freezerText: {
    fontSize: 13,
    color: '#C9D1D9',
    flex: 1,
  },

  // Notification section
  notifSection: {
    width: '100%',
    backgroundColor: 'rgba(255,213,79,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.1)',
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD54F',
  },
  notifDesc: {
    fontSize: 13,
    color: '#8B949E',
    lineHeight: 18,
    marginBottom: 12,
  },
  notifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,213,79,0.1)',
    paddingVertical: 14,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.15)',
  },
  notifBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD54F',
  },
  notifResult: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  notifResultText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Goal card
  goalCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  goalEmoji: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  goalText: {
    fontSize: 14,
    color: '#C9D1D9',
    flex: 1,
  },

  // Start button
  startBtn: {
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  startBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
})
