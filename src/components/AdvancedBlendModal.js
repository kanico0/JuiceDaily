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
import { Sparkles, Crown, X, Wifi, AlertCircle } from 'lucide-react-native'
import { useReducedMotion } from '../utils/motion'
import { getAdvancedBlendRemainingText } from '../services/quota/blendAllowanceService'

export function getAdvancedBlendModalContent (stage, remaining, isPro = false) {
  switch (stage) {
    case 'fifth_ingredient_notice':
      if (isPro) {
        return {
          title: 'This is an Advanced Blend',
          subtitle: null,
          body:
            'Blends with 5 or more ingredients use an Advanced Blend analysis. ' +
            'With Pro, you have unlimited Advanced Blend analyses.',
        }
      }
      return {
        title: 'This is an Advanced Blend',
        subtitle: null,
        body:
          'Blends with 5 or more ingredients use one of your 3 lifetime Advanced Blend analyses. ' +
          'Your allowance is only used after the analysis completes successfully.',
      }
    case 'pre_analysis_confirmation': {
      const used = Math.max(0, 3 - (remaining ?? 3))
      const body = getAdvancedBlendRemainingText(used, isPro)
      return {
        title: 'Use an Advanced Blend analysis?',
        subtitle: null,
        body,
      }
    }
    case 'completion_confirmation': {
      const used = Math.max(0, 3 - (remaining ?? 3))
      const body = getAdvancedBlendRemainingText(used, isPro)
      return {
        title: 'Advanced Blend analyzed',
        subtitle: null,
        body,
      }
    }
    case 'allowance_exhausted':
      return {
        title: 'Advanced Blend analyses used',
        subtitle: 'Unlock unlimited Advanced Blend analyses',
        body:
          'You\u2019ve used all 3 complimentary Advanced Blend analyses. ' +
          'RawLifeFlow Pro gives you unlimited Advanced Blend nutrition insights. ' +
          'Simple Blends (up to 4 ingredients) and manual logging are always free.',
      }
    case 'network_retry':
      return {
        title: 'Connection Needed',
        subtitle: 'We couldn\u2019t verify your Advanced Blend allowance',
        body:
          'To analyze Advanced Blends (5+ ingredients), we need to connect to our servers. ' +
          'Please check your internet connection and try again. ' +
          'Your ingredients are saved \u2014 just tap retry when you\u2019re ready. ' +
          'No allowance has been used.',
      }
    default:
      return { title: '', subtitle: null, body: '' }
  }
}

export default function AdvancedBlendModal ({
  visible,
  stage,
  remaining,
  isPro = false,
  onUpgrade,
  onDismiss,
  onConfirm,
  onRetry,
}) {
  const isReduced = useReducedMotion()
  const content = getAdvancedBlendModalContent(stage, remaining, isPro)
  const isExhausted = stage === 'allowance_exhausted'
  const isNetworkRetry = stage === 'network_retry'
  const isNotice = stage === 'fifth_ingredient_notice'
  const isPreConfirm = stage === 'pre_analysis_confirmation'
  const isCompletion = stage === 'completion_confirmation'

  const showConfirmButton = isPreConfirm
  const showUpgradeButton = isExhausted
  const showRetryButton = isNetworkRetry
  const allowBackdropDismiss = !isCompletion

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
          <Pressable
            style={styles.backdrop}
            onPress={allowBackdropDismiss ? onDismiss : undefined}
            accessibilityLabel="Dismiss Advanced Blend message"
          />
          <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert">
            <View style={styles.header}>
              <View style={styles.iconWrap} accessible={false}>
                {isNetworkRetry ? (
                  <Wifi size={22} color="#B8F2C7" />
                ) : isExhausted ? (
                  <Crown size={22} color="#B8F2C7" />
                ) : isNotice ? (
                  <AlertCircle size={22} color="#B8F2C7" />
                ) : (
                  <Sparkles size={22} color="#B8F2C7" />
                )}
              </View>
              {allowBackdropDismiss && (
                <Pressable
                  style={styles.closeButton}
                  onPress={onDismiss}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close Advanced Blend message"
                >
                  <X size={20} color="#B8C8BD" />
                </Pressable>
              )}
            </View>
            <ScrollView
              bounces={false}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title} accessibilityRole="header">
                {content.title}
              </Text>
              {content.subtitle && (
                <Text style={styles.subtitle}>{content.subtitle}</Text>
              )}
              <Text style={styles.body} accessibilityLabel={content.body}>
                {content.body}
              </Text>
              {!isExhausted && !isNetworkRetry && !isCompletion && (
                <Text style={styles.valueLine}>
                  Simple Blends (up to 4 ingredients) are always free and unlimited.
                </Text>
              )}
            </ScrollView>
            <View style={styles.actions}>
              {showConfirmButton && (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onConfirm}
                    accessibilityRole="button"
                    accessibilityLabel="Analyze Blend"
                  >
                    <Text style={styles.primaryText}>Analyze Blend</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                  >
                    <Text style={styles.secondaryText}>Go Back</Text>
                  </Pressable>
                </>
              )}
              {showRetryButton && (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onRetry}
                    accessibilityRole="button"
                    accessibilityLabel="Retry Advanced Blend analysis"
                  >
                    <Text style={styles.primaryText}>Try Again</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.notNowButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Not now"
                  >
                    <Text style={styles.notNowText}>Not Now</Text>
                  </Pressable>
                </>
              )}
              {showUpgradeButton && (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onUpgrade}
                    accessibilityRole="button"
                    accessibilityLabel="Explore RawLifeFlow Pro for unlimited Advanced Blends"
                  >
                    <Text style={styles.primaryText}>Explore Pro</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.notNowButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Not now"
                  >
                    <Text style={styles.notNowText}>Not Now</Text>
                  </Pressable>
                </>
              )}
              {!showConfirmButton && !showRetryButton && !showUpgradeButton && (
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={onDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="OK"
                >
                  <Text style={styles.primaryText}>OK</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0D1117',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(126, 231, 135, 0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(126, 231, 135, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E6EDF3',
    marginBottom: 4,
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 14,
    color: '#7EE787',
    marginBottom: 12,
    fontWeight: '500',
  },
  body: {
    fontSize: 15,
    color: '#B8C8BD',
    lineHeight: 22,
    marginBottom: 8,
  },
  valueLine: {
    fontSize: 13,
    color: '#6E7681',
    lineHeight: 18,
    marginTop: 4,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#2EA043',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'rgba(126, 231, 135, 0.08)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(126, 231, 135, 0.2)',
  },
  secondaryText: {
    color: '#7EE787',
    fontSize: 15,
    fontWeight: '500',
  },
  notNowButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  notNowText: {
    color: '#6E7681',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.7,
  },
})
