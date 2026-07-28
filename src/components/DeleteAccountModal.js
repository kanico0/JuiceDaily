// ─────────────────────────────────────────────────────────────
// DeleteAccountModal.js — Two-step account deletion confirmation
// for RawLifeFlow: Juicing Daily.
//
// UX:
//   1. Warning screen with subscription notice + Google Play link.
//   2. Type "DELETE" to enable the final destructive button.
//   3. Server-side deletion via delete-account Edge Function.
//   4. On success: clear local state, return to onboarding.
//
// Security:
//   * No one-tap deletion.
//   * Double-submit protection.
//   * Progress indicator while deletion runs.
//   * Recoverable error state if server fails.
//   * Local state cleared only after server confirms.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { Trash2, X, ExternalLink, AlertTriangle } from 'lucide-react-native'
import { getSupabase } from '../services/supabase/supabaseClient'
import { getAccessToken } from '../services/supabase/identity'
import { resetAllUserData } from '../services/UserProfileStore'
import { logOut as revenueCatLogOut } from '../services/subscriptions/revenueCatClient'
import { cancelAllNudges } from '../services/NotificationNudges'

const GOOGLE_PLAY_SUBSCRIPTION_URL = 'https://play.google.com/store/account/subscriptions?package=com.juicingapp.app&sku=juicing_daily_pro'
const GOOGLE_PLAY_SUBSCRIPTION_FALLBACK_URL = 'https://play.google.com/store/account/subscriptions'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''

export default function DeleteAccountModal ({ visible, onClose, onDeleted }) {
  const [step, setStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const busyRef = useRef(false)

  const reset = useCallback(() => {
    setStep(1)
    setConfirmText('')
    setError(null)
    busyRef.current = false
    setBusy(false)
  }, [])

  const handleClose = useCallback(() => {
    if (busyRef.current) return
    reset()
    if (onClose) onClose()
  }, [onClose, reset])

  const openGooglePlaySubscriptions = useCallback(async () => {
    const supported = await Linking.canOpenURL(GOOGLE_PLAY_SUBSCRIPTION_URL)
    const url = supported ? GOOGLE_PLAY_SUBSCRIPTION_URL : GOOGLE_PLAY_SUBSCRIPTION_FALLBACK_URL
    Linking.openURL(url)
  }, [])

  const performDeletion = useCallback(async () => {
    if (busyRef.current) return
    setError(null)

    busyRef.current = true
    setBusy(true)
    try {
      const token = await getAccessToken()
      if (!token) {
        setError('Could not verify your session. Please try again.')
        return
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        setError(data.message || 'Deletion failed. Please try again.')
        return
      }

      // Server confirmed deletion — now clear local state.
      try {
        await cancelAllNudges()
      } catch {
        // Best-effort
      }

      try {
        await revenueCatLogOut()
      } catch {
        // Best-effort
      }

      await resetAllUserData()

      // Clear Supabase session
      const supabase = getSupabase()
      if (supabase) {
        try {
          await supabase.auth.signOut()
        } catch {
          // Best-effort — user is already deleted server-side
        }
      }

      if (onDeleted) onDeleted()
      if (onClose) onClose()
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [onClose, onDeleted])

  const canSubmit = confirmText.trim() === 'DELETE' && !busy

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={20} color="#8B949E" />
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <AlertTriangle size={32} color="#F85149" strokeWidth={2} />
            </View>

            <Text style={styles.title}>Delete RawLifeFlow Account?</Text>

            <Text style={styles.body}>
              This permanently deletes your RawLifeFlow account and account-specific app data, including saved juice history, Glow progress, achievements, settings, and scan records associated with your account.
            </Text>

            <Text style={styles.body}>
              Deleting your RawLifeFlow account does not automatically cancel an active Google Play subscription. Manage or cancel your subscription in Google Play before deleting your account if you no longer want it to renew.
            </Text>

            <TouchableOpacity
              style={styles.subscriptionLink}
              onPress={openGooglePlaySubscriptions}
              disabled={busy}
              accessibilityRole="link"
              accessibilityLabel="Manage Google Play Subscription"
            >
              <ExternalLink size={14} color="#58A6FF" />
              <Text style={styles.subscriptionLinkText}>Manage Google Play Subscription</Text>
            </TouchableOpacity>

            {step === 1 ? (
              <>
                <TouchableOpacity
                  style={[styles.cancelBtn, busy && styles.btnDisabled]}
                  onPress={handleClose}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.continueBtn, busy && styles.btnDisabled]}
                  onPress={() => setStep(2)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to Delete Account"
                >
                  <Text style={styles.continueBtnText}>Continue to Delete Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.confirmLabel}>
                  Type <Text style={styles.confirmWord}>DELETE</Text> to confirm:
                </Text>

                <TextInput
                  style={styles.confirmInput}
                  placeholder="DELETE"
                  placeholderTextColor="#484F58"
                  value={confirmText}
                  onChangeText={setConfirmText}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!busy}
                  accessibilityLabel="Type DELETE to confirm"
                />

                <TouchableOpacity
                  style={[styles.cancelBtn, busy && styles.btnDisabled]}
                  onPress={() => { setStep(1); setConfirmText(''); setError(null) }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteBtn, !canSubmit && styles.deleteBtnDisabled]}
                  onPress={performDeletion}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityLabel="Permanently Delete My Account"
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#FFFFFF" />
                      <Text style={styles.deleteBtnText}>Permanently Delete My Account</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0F6FC',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    color: '#C9D1D9',
    lineHeight: 20,
    marginBottom: 12,
  },
  subscriptionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  subscriptionLinkText: {
    fontSize: 14,
    color: '#58A6FF',
    textDecorationLine: 'underline',
  },
  confirmLabel: {
    fontSize: 14,
    color: '#C9D1D9',
    marginBottom: 8,
  },
  confirmWord: {
    fontWeight: '700',
    color: '#F85149',
  },
  confirmInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#F0F6FC',
    marginBottom: 16,
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#C9D1D9',
    fontWeight: '500',
  },
  continueBtn: {
    backgroundColor: '#21262D',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueBtnText: {
    fontSize: 15,
    color: '#F0F6FC',
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: '#DA3633',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  deleteBtnDisabled: {
    opacity: 0.4,
  },
  deleteBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  error: {
    fontSize: 13,
    color: '#F85149',
    textAlign: 'center',
    marginTop: 12,
  },
})
