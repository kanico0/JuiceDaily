import React, { useCallback, useRef, useState } from 'react'
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
import { Lock, X, Eye, EyeOff, ShieldCheck } from 'lucide-react-native'

import { updateRecoveredPassword } from '../services/supabase/accountLink'

const MIN_PASSWORD_LENGTH = 6

export default function NewPasswordModal ({ visible, onClose, onUpdated, recoveryEmail = '' }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const busyRef = useRef(false)
  const confirmRef = useRef(null)
  const insets = useSafeAreaInsets()

  const reset = useCallback(() => {
    setNewPassword('')
    setConfirmPassword('')
    setShowNew(false)
    setShowConfirm(false)
    setError(null)
    setSuccess(false)
    busyRef.current = false
    setBusy(false)
  }, [])

  const validate = useCallback(() => {
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return false
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    return true
  }, [newPassword, confirmPassword])

  const submit = useCallback(async () => {
    if (busyRef.current) return
    setError(null)

    if (!validate()) return

    busyRef.current = true
    setBusy(true)
    try {
      const result = await updateRecoveredPassword(newPassword)
      if (result.status === 'updated') {
        setSuccess(true)
      } else {
        setError(result.message || 'Unable to update password. Please try again.')
      }
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [newPassword, validate])

  const handleDone = useCallback(() => {
    reset()
    if (onUpdated) onUpdated()
    if (onClose) onClose()
  }, [reset, onUpdated, onClose])

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

              {success ? (
                <>
                  <View style={styles.iconWrap}>
                    <ShieldCheck size={32} color="#81C784" strokeWidth={2} />
                  </View>

                  <Text style={styles.title}>Password Updated</Text>

                  <Text style={styles.subtitle}>
                    Your RawLifeFlow password has been reset successfully. You can now sign in with your new password.
                  </Text>

                  <TouchableOpacity
                    style={styles.cta}
                    onPress={handleDone}
                    accessibilityRole="button"
                    accessibilityLabel="Back to sign in"
                  >
                    <Text style={styles.ctaText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.iconWrap}>
                    <Lock size={32} color="#81C784" strokeWidth={2} />
                  </View>

                  <Text style={styles.title}>Create a New Password</Text>

                  <Text style={styles.subtitle}>
                    Enter a new password for your RawLifeFlow account.
                  </Text>

                  <View style={styles.inputRow}>
                    <Lock size={16} color="#8B949E" />
                    <TextInput
                      style={styles.input}
                      placeholder="New password"
                      placeholderTextColor="#484F58"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNew}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      editable={!busy}
                      accessibilityLabel="New password"
                      returnKeyType="next"
                      onSubmitEditing={() => confirmRef.current?.focus()}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNew((s) => !s)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={showNew ? 'Hide password' : 'Show password'}
                    >
                      {showNew ? <EyeOff size={16} color="#8B949E" /> : <Eye size={16} color="#8B949E" />}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inputRow}>
                    <Lock size={16} color="#8B949E" />
                    <TextInput
                      ref={confirmRef}
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor="#484F58"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      editable={!busy}
                      accessibilityLabel="Confirm new password"
                      returnKeyType="go"
                      onSubmitEditing={() => { if (!busy && validate()) submit() }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirm((s) => !s)}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <EyeOff size={16} color="#8B949E" /> : <Eye size={16} color="#8B949E" />}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.cta, busy && styles.ctaDisabled]}
                    onPress={submit}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Save new password"
                  >
                    {busy ? (
                      <ActivityIndicator color="#0D1117" />
                    ) : (
                      <Text style={styles.ctaText}>Save New Password</Text>
                    )}
                  </TouchableOpacity>

                  {error && <Text style={styles.error}>{error}</Text>}

                  <TouchableOpacity
                    onPress={() => {
                      if (onClose) onClose()
                    }}
                    disabled={busy}
                    accessibilityRole="button"
                    style={styles.linkBtn}
                  >
                    <Text style={styles.link}>Cancel</Text>
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
