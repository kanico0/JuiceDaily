import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Camera, Check, Crown, X } from 'lucide-react-native'
import { useReducedMotion } from '../utils/motion'
import { selectNextRefreshLabel, getQuotaDisplay } from '../services/subscriptions/subscriptionSelectors'

function formatQuotaResetDate(periodEnd) {
  if (!periodEnd) return null
  const date = new Date(periodEnd)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { dateStyle: 'long' })
}

export default function ScanPlanModal({
  visible,
  quota,
  isPro,
  onUpgrade,
  onContinue,
  onManage,
  onManualEntry,
  onDismiss,
}) {
  const isReduced = useReducedMotion()
  const quotaDisplay = getQuotaDisplay(quota, isPro, false)
  const plan = quota?.plan || (isPro ? 'pro' : 'free')
  const used = quotaDisplay.effectiveUsed
  const limit = quotaDisplay.displayLimit
  const remaining = quotaDisplay.effectiveRemaining
  const resetDate = selectNextRefreshLabel(quota)

  const isExhausted = remaining != null && remaining <= 0
  const title = isPro ? 'RawLifeFlow Pro' : 'Free Scan Plan'

  let body = null
  if (remaining == null) {
    body = 'Unable to load current allowance. Tap Continue to try again or check your connection.'
  } else if (isPro && !isExhausted) {
    body = `Your Pro plan is active. You have used ${used} of ${limit} AI scans this month. Manual ingredient entry is always unlimited.`
  } else if (isPro && isExhausted) {
    body = `You have used all ${limit} Pro AI scans for this month. Your scans refresh ${resetDate ? `on ${resetDate}` : 'when the next month starts'}. Manual ingredient entry is always unlimited.`
  } else if (!isPro && !isExhausted) {
    body = `You have used ${used} of ${limit} AI scans this month. Manual ingredient entry is always unlimited.`
  } else {
    body = `You have used all ${limit} AI scans this month. Manual ingredient entry is always unlimited.`
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={isReduced ? 'none' : 'fade'}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss scan plan" />
          <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
            <View style={styles.header}>
              <View style={styles.iconWrap} accessible={false}>
                {isPro ? <Check size={22} color="#B8F2C7" /> : <Camera size={22} color="#B8F2C7" />}
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={onDismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close scan plan"
              >
                <X size={20} color="#B8C8BD" />
              </Pressable>
            </View>
            <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Text style={styles.body}>{body}</Text>
              {resetDate && !isExhausted && (
                <Text style={styles.valueLine}>Scans refresh on {resetDate}.</Text>
              )}
              {!isPro && !isExhausted && (
                <>
                  <Text style={styles.valueLine}>RawLifeFlow Pro includes:</Text>
                  <View style={styles.bullets}>
                    <Text style={styles.bullet}>• Up to 60 successful AI scans per month</Text>
                    <Text style={styles.bullet}>• Full ingredient and estimated-nutrition analysis</Text>
                    <Text style={styles.bullet}>• Unlimited manual ingredient entry</Text>
                    <Text style={styles.bullet}>• Save and revisit your juice history and progress</Text>
                  </View>
                </>
              )}
            </ScrollView>
            <View style={styles.actions}>
              {!isPro && (
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  onPress={onUpgrade}
                  accessibilityRole="button"
                  accessibilityLabel="Explore RawLifeFlow Pro"
                >
                  <Crown size={16} color="#102717" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryText}>Explore RawLifeFlow Pro</Text>
                </Pressable>
              )}
              {isPro && onManage && (
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  onPress={onManage}
                  accessibilityRole="button"
                  accessibilityLabel="Manage subscription"
                >
                  <Text style={styles.primaryText}>Manage Subscription</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={onContinue}
                accessibilityRole="button"
                accessibilityLabel={isPro ? 'Continue using Pro' : 'Continue with Free'}
              >
                <Text style={styles.secondaryText}>{isPro ? 'Continue' : 'Continue with Free'}</Text>
              </Pressable>
              {onManualEntry && (
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                  onPress={onManualEntry}
                  accessibilityRole="button"
                  accessibilityLabel="Enter ingredients manually"
                >
                  <Text style={styles.secondaryText}>Enter Ingredients Manually</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,11,8,0.76)',
  },
  card: {
    maxHeight: '88%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(184,242,199,0.20)',
    backgroundColor: '#17221B',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(184,242,199,0.12)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    paddingBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  body: {
    color: '#C5D2C8',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  valueLine: {
    color: '#B8F2C7',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginTop: 12,
  },
  bullets: {
    marginTop: 8,
    gap: 4,
  },
  bullet: {
    color: '#C5D2C8',
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#B8F2C7',
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#102717',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(184,242,199,0.46)',
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: '#E9F7ED',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonPressed: {
    opacity: 0.74,
  },
})
