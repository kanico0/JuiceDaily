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
import { Camera, Leaf, X } from 'lucide-react-native'
import { useReducedMotion } from '../utils/motion'

export function formatQuotaResetDate(periodEnd) {
  if (!periodEnd) return null
  const date = new Date(periodEnd)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleDateString(undefined, { dateStyle: 'long' })
}

export function getQuotaModalContent(quota) {
  const isPro = quota?.plan === 'pro'
  const resetDate = formatQuotaResetDate(quota?.periodEnd)
  const scanLimit = quota?.limit ?? null
  const isDevicePoolExhausted = !isPro
    && quota?.effectiveRemaining != null
    && quota.effectiveRemaining <= 0
    && quota.remaining > 0

  if (isPro) {
    return {
      isPro,
      resetDate,
      title: `You’ve used your ${scanLimit} Pro AI scans for this period`,
      body: resetDate
        ? `Your scans refresh on ${resetDate}. You can continue logging ingredients manually.`
        : 'You can continue logging ingredients manually while your scan quota refreshes.',
    }
  }

  if (isDevicePoolExhausted) {
    return {
      isPro,
      resetDate,
      isDevicePoolExhausted: true,
      title: 'Free AI scans used for this month',
      body: 'This device has used its free AI scans for this month. You can continue by entering ingredients manually or explore RawLifeFlow Pro.',
    }
  }

  return {
    isPro,
    resetDate,
    title: `You’ve used your ${scanLimit} free AI scans this month`,
    body: resetDate
      ? `Keep scanning with RawLifeFlow Pro, or continue free by entering your ingredients manually. Your free scans reset on ${resetDate}.`
      : 'Keep scanning with RawLifeFlow Pro, or continue free by entering your ingredients manually.',
  }
}

export default function ScanQuotaReachedModal({
  visible,
  quota,
  isOpeningPaywall,
  onUpgrade,
  onManualEntry,
  onViewUsage,
  onDismiss,
}) {
  const isReduced = useReducedMotion()
  const content = getQuotaModalContent(quota)

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
          <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityLabel="Dismiss scan quota message" />
          <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
            <View style={styles.header}>
              <View style={styles.iconWrap} accessible={false}>
                {content.isPro ? <Camera size={22} color="#B8F2C7" /> : <Leaf size={22} color="#B8F2C7" />}
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={onDismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Not now, close scan quota message"
              >
                <X size={20} color="#B8C8BD" />
              </Pressable>
            </View>
            <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={styles.title} accessibilityRole="header">{content.title}</Text>
              <Text style={styles.body} accessibilityLabel={content.body}>{content.body}</Text>
              {!content.isPro && (
                <Text style={styles.valueLine}>Pro includes up to 60 successful AI scans per month, full ingredient analysis, and unlimited manual entry.</Text>
              )}
            </ScrollView>
            <View style={styles.actions}>
              {!content.isPro && (
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, (pressed || isOpeningPaywall) && styles.buttonPressed]}
                  onPress={onUpgrade}
                  disabled={isOpeningPaywall}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade to RawLifeFlow Pro"
                >
                  <Text style={styles.primaryText}>{isOpeningPaywall ? 'Opening plans…' : 'Upgrade to Pro'}</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                onPress={onManualEntry}
                accessibilityRole="button"
                accessibilityLabel="Enter ingredients manually for free"
              >
                <Text style={styles.secondaryText}>Enter Ingredients Manually</Text>
              </Pressable>
              {content.isPro && (
                <Pressable
                  style={({ pressed }) => [styles.usageButton, pressed && styles.buttonPressed]}
                  onPress={onViewUsage}
                  accessibilityRole="button"
                  accessibilityLabel="View scan usage"
                >
                  <Text style={styles.usageText}>View Scan Usage</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.notNowButton, pressed && styles.buttonPressed]}
                onPress={onDismiss}
                accessibilityRole="button"
                accessibilityLabel="Not now"
              >
                <Text style={styles.notNowText}>Not Now</Text>
              </Pressable>
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
  actions: {
    gap: 10,
  },
  primaryButton: {
    minHeight: 50,
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
  usageButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageText: {
    color: '#B8F2C7',
    fontSize: 14,
    fontWeight: '700',
  },
  notNowButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowText: {
    color: '#A9B9AE',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.74,
  },
})
