// ─────────────────────────────────────────────────────────────
// AccountGateModal.js — Reusable account-protection modal for
// RawLifeFlow: Juicing Daily.
//
// Shown before the first funded AI scan (and from Settings). Lets an
// anonymous user attach an email to their existing identity (UUID
// preserved) or lets a returning user sign back into their original
// account. Email OTP flow, resend cooldown, double-submit protection.
//
// Keyboard UX:
//   On Android, KeyboardAvoidingView with behavior='height' shrinks
//   the layout when the keyboard opens. A ScrollView allows the
//   content to scroll when needed. The icon and top spacing shrink
//   when the keyboard is visible to maximize input visibility.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { ShieldCheck, Mail, Lock, X } from 'lucide-react-native'

import {
  beginEmailLink,
  beginSignIn,
  isValidEmail,
  signInWithPassword,
  verifyEmailLink,
  verifySignIn,
} from '../services/supabase/accountLink'

const RESEND_COOLDOWN_SECONDS = 60

const COPY = {
  protect: {
    title: 'Protect your progress',
    subtitle:
      'Create a free account to save your scan history and keep your monthly scan allowance — so your streaks, achievements, and plan are never lost.',
    cta: 'Send code',
  },
  guest: {
    title: 'Keep your juice journey going',
    subtitle:
      'You\'ve completed your first juice. Create your free account to continue scanning, logging, and building your progress.',
    supporting: 'Your first activity and current progress will carry over.',
    cta: 'Create Free Account',
  },
  signin: {
    title: 'Welcome back',
    subtitle:
      'Sign in with the email you used before to restore your history, scans, and plan on RawLifeFlow: Juicing Daily.',
    cta: 'Send sign-in code',
  },
  reviewer: {
    title: 'Reviewer access',
    subtitle:
      'For Google Play review. Enter the reviewer email and password provided in the Play Console App Access section.',
    cta: 'Sign in',
  },
}

export default function AccountGateModal ({ visible, onClose, onAuthenticated, initialMode = 'protect' }) {
  // mode: 'protect' (anonymous upgrade) | 'signin' (returning user)
  const [mode, setMode] = useState(initialMode)
  // step: 'email' | 'code'
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const [keyboardVisible, setKeyboardVisible] = useState(false)
  const busyRef = useRef(false)

  // Reset state whenever the modal opens.
  useEffect(() => {
    if (visible) {
      setMode(initialMode)
      setStep('email')
      setEmail('')
      setCode('')
      setPassword('')
      setError(null)
      setCooldown(0)
      busyRef.current = false
      setBusy(false)
    }
  }, [visible, initialMode])

  // Track keyboard visibility to shrink icon/spacing when typing.
  useEffect(() => {
    if (!visible) return undefined
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true))
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [visible])

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => {
      setCooldown((s) => (s > 1 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const sendCode = useCallback(async () => {
    if (busyRef.current) return
    setError(null)

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    busyRef.current = true
    setBusy(true)
    try {
      const result = mode === 'signin'
        ? await beginSignIn(email)
        : await beginEmailLink(email)

      if (result.status === 'otp_sent') {
        setStep('code')
        setCooldown(RESEND_COOLDOWN_SECONDS)
      } else if (result.status === 'email_in_use') {
        // Collision: the email belongs to an existing account. Offer a
        // verified sign-in instead of any automatic merge.
        setMode('signin')
        setError(
          'That email already has a RawLifeFlow: Juicing Daily account. We switched you to sign-in — request a code to get back into it.'
        )
      } else if (result.status === 'rate_limited') {
        setError('Too many attempts. Please wait a minute and try again.')
      } else if (result.status === 'invalid_email') {
        setError('Please enter a valid email address.')
      } else {
        setError(result.message === 'No account found for this email'
          ? 'We couldn\u2019t find an account with that email. Check the address, or create a new account instead.'
          : 'Something went wrong sending your code. Please try again.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [email, mode])

  const confirmCode = useCallback(async () => {
    if (busyRef.current) return
    setError(null)

    if (code.trim().length < 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    busyRef.current = true
    setBusy(true)
    try {
      const result = mode === 'signin'
        ? await verifySignIn(email, code)
        : await verifyEmailLink(email, code)

      if (result.status === 'verified') {
        if (onAuthenticated) onAuthenticated(result.userId)
        if (onClose) onClose()
      } else if (result.status === 'invalid_code') {
        setError('That code doesn\u2019t match. Double-check your email and try again.')
      } else if (result.status === 'expired') {
        setError('That code has expired. Tap Resend to get a new one.')
      } else {
        setError('Verification failed. Please try again.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [code, email, mode, onAuthenticated, onClose])

  const submitReviewer = useCallback(async () => {
    if (busyRef.current) return
    setError(null)

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setError('Please enter the reviewer password.')
      return
    }

    busyRef.current = true
    setBusy(true)
    try {
      const result = await signInWithPassword(email, password)
      if (result.status === 'verified') {
        // CRITICAL: Reviewer password sign-in is complete.
        // Do NOT transition to the code/OTP step.
        // Do NOT invoke the OTP send or verify callbacks.
        // Close the modal and return to the app as the signed-in reviewer.
        if (onAuthenticated) onAuthenticated(result.userId)
        if (onClose) onClose()
      } else if (result.status === 'invalid_code') {
        setError('Invalid email or password. Please check your credentials.')
      } else {
        setError('Sign-in failed. Please check your credentials and try again.')
      }
    } finally {
      // Ensure the modal stays in reviewer mode — never transition
      // to the code/OTP step, even on error.
      setMode('reviewer')
      setStep('email')
      busyRef.current = false
      setBusy(false)
    }
  }, [email, password, onAuthenticated, onClose])

  const switchMode = useCallback(() => {
    setMode((m) => (m === 'protect' || m === 'guest' ? 'signin' : 'protect'))
    setStep('email')
    setCode('')
    setPassword('')
    setError(null)
  }, [])

  const switchToReviewer = useCallback(() => {
    setMode('reviewer')
    setStep('email')
    setCode('')
    setPassword('')
    setError(null)
  }, [])

  const copy = COPY[mode]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.avoiding}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color="#8B949E" />
              </TouchableOpacity>

              <View style={[
                styles.iconWrap,
                keyboardVisible && styles.iconWrapCompact,
              ]}>
                <ShieldCheck
                  size={keyboardVisible ? 24 : 32}
                  color="#81C784"
                  strokeWidth={2}
                />
              </View>

              <Text style={styles.title}>{copy.title}</Text>
              <Text style={[
                styles.subtitle,
                keyboardVisible && styles.subtitleCompact,
              ]}>{copy.subtitle}</Text>
              {mode === 'guest' && copy.supporting && (
                <Text style={styles.supporting}>{copy.supporting}</Text>
              )}

              {mode === 'reviewer' ? (
                <>
                  <View style={styles.inputRow}>
                    <Mail size={16} color="#8B949E" />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#90A4AE"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      editable={!busy}
                      accessibilityLabel="Reviewer email"
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <Lock size={16} color="#8B949E" />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor="#90A4AE"
                      value={password}
                      onChangeText={setPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      editable={!busy}
                      accessibilityLabel="Reviewer password"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={submitReviewer}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={copy.cta}
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D1117" />
                    ) : (
                      <Text style={styles.ctaText}>{copy.cta}</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : step === 'email' ? (
                <>
                  <View style={styles.inputRow}>
                    <Mail size={16} color="#8B949E" />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#90A4AE"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      editable={!busy}
                      accessibilityLabel="Email address"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={sendCode}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={copy.cta}
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D1117" />
                    ) : (
                      <Text style={styles.ctaText}>{copy.cta}</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.codeHint}>
                    We sent a 6-digit code to {email.trim()}
                  </Text>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="123456"
                    placeholderTextColor="#90A4AE"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!busy}
                    accessibilityLabel="Verification code"
                  />

                  <TouchableOpacity
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={confirmCode}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Verify code"
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D1117" />
                    ) : (
                      <Text style={styles.ctaText}>Verify</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={sendCode}
                    disabled={busy || cooldown > 0}
                    accessibilityRole="button"
                    accessibilityLabel="Resend code"
                  >
                    <Text style={[styles.link, (busy || cooldown > 0) && styles.linkDisabled]}>
                      {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {error && <Text style={styles.error}>{error}</Text>}

              {mode === 'reviewer' ? (
                <TouchableOpacity onPress={switchMode} disabled={busy} accessibilityRole="button">
                  <Text style={styles.link}>
                    Back to sign in
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity onPress={switchMode} disabled={busy} accessibilityRole="button">
                    <Text style={styles.link}>
                      {mode === 'protect' || mode === 'guest'
                        ? 'Already have an account? Sign in'
                        : 'New here? Create your free account'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={switchToReviewer} disabled={busy} accessibilityRole="button">
                    <Text style={styles.link}>
                      Reviewer access
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  avoiding: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#21262D',
    padding: 24,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
    zIndex: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(129,199,132,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8B949E',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitleCompact: {
    marginBottom: 12,
  },
  supporting: {
    color: '#81C784',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    paddingHorizontal: 14,
    width: '100%',
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: '#E6EDF3',
    fontSize: 15,
    paddingVertical: 12,
  },
  codeHint: {
    color: '#8B949E',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  codeInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 12,
    color: '#E6EDF3',
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
    width: '70%',
    marginBottom: 14,
  },
  cta: {
    backgroundColor: '#81C784',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#0D1117',
    fontSize: 15,
    fontWeight: '700',
  },
  link: {
    color: '#81C784',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  linkDisabled: {
    color: '#90A4AE',
  },
  error: {
    color: '#F97583',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
})
