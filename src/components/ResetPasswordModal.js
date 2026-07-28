import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mail, X, ArrowLeft, ShieldCheck } from 'lucide-react-native'

import {
  isValidEmail,
  sendPasswordResetEmail,
} from '../services/supabase/accountLink'

const RESEND_COOLDOWN_SECONDS = 60

export default function ResetPasswordModal ({ visible, onClose, onBackToSignIn, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const busyRef = useRef(false)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (visible) {
      setEmail(initialEmail)
      setError(null)
      setSent(false)
      setCooldown(0)
      busyRef.current = false
      setBusy(false)
    }
  }, [visible, initialEmail])

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setInterval(() => {
      setCooldown((s) => (s > 1 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const sendReset = useCallback(async () => {
    if (busyRef.current) return
    setError(null)

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    busyRef.current = true
    setBusy(true)
    try {
      const result = await sendPasswordResetEmail(email)
      if (result.status === 'sent') {
        setSent(true)
        setCooldown(RESEND_COOLDOWN_SECONDS)
      } else if (result.status === 'rate_limited') {
        setError('Please wait a moment before requesting another reset link.')
      } else {
        setError('Unable to send reset link. Please try again.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [email])

  const resend = useCallback(async () => {
    if (busyRef.current || cooldown > 0) return
    setError(null)
    busyRef.current = true
    setBusy(true)
    try {
      const result = await sendPasswordResetEmail(email)
      if (result.status === 'sent') {
        setCooldown(RESEND_COOLDOWN_SECONDS)
      } else if (result.status === 'rate_limited') {
        setError('Please wait a moment before requesting another reset link.')
      } else {
        setError('Unable to send reset link. Please try again.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [email, cooldown])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16 }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kav}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight ?? 0}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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

              {sent ? (
                <>
                  <View style={styles.iconWrap}>
                    <ShieldCheck size={32} color="#81C784" strokeWidth={2} />
                  </View>

                  <Text style={styles.title}>Check Your Email</Text>

                  <Text style={styles.subtitle}>
                    If a RawLifeFlow account exists for that email address, you'll receive a password-reset link shortly.
                  </Text>

                  <Text style={styles.hint}>
                    Check your spam or junk folder if you don't see the message.
                  </Text>

                  <TouchableOpacity
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={resend}
                    disabled={busy || cooldown > 0}
                    accessibilityRole="button"
                    accessibilityLabel="Resend reset link"
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D1117" />
                    ) : (
                      <Text style={styles.ctaText}>
                        {cooldown > 0 ? `Resend Link in ${cooldown}s` : 'Resend Link'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={onBackToSignIn} disabled={busy} accessibilityRole="button" style={styles.linkBtn}>
                    <Text style={styles.link}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.iconWrap}>
                    <ShieldCheck size={32} color="#81C784" strokeWidth={2} />
                  </View>

                  <Text style={styles.title}>Reset Your Password</Text>

                  <Text style={styles.subtitle}>
                    Enter the email address connected to your RawLifeFlow account. We'll send you a secure link to create a new password.
                  </Text>

                  <View style={styles.inputRow}>
                    <Mail size={16} color="#8B949E" />
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#484F58"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      editable={!busy}
                      accessibilityLabel="Email address"
                      returnKeyType="done"
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={sendReset}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Send reset link"
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D1117" />
                    ) : (
                      <Text style={styles.ctaText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>

                  {error && <Text style={styles.error}>{error}</Text>}

                  <TouchableOpacity onPress={onBackToSignIn} disabled={busy} accessibilityRole="button" style={styles.linkBtn}>
                    <Text style={styles.link}>Back to Sign In</Text>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
  hint: {
    color: '#8B949E',
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
  linkBtn: {
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    color: '#81C784',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  error: {
    color: '#F97583',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 18,
  },
})
