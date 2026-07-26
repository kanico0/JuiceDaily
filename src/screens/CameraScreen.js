import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { CameraView } from 'expo-camera'
import { useIsFocused } from '@react-navigation/native'
import { X, Aperture, Keyboard, Eye, Home, Camera } from 'lucide-react-native'
import { useCamera } from '../hooks/useCamera'
import { identifyProduce } from '../services/ClaudeVisionService'
import { ScanQuotaError, isServerScanAvailable } from '../services/quota/quotaService'
import { useQuota } from '../services/quota/QuotaStore'
import { useSubscription } from '../services/subscriptions/SubscriptionStore'
import { getQuotaDisplay, formatCanonicalQuotaLabel } from '../services/subscriptions/subscriptionSelectors'
import { trackEvent } from '../services/AnalyticsService'
import ScanQuotaReachedModal from '../components/ScanQuotaReachedModal'
import ScanPlanModal from '../components/ScanPlanModal'
import AccountGateModal from '../components/AccountGateModal'
import { getAccountStatus } from '../services/supabase/accountLink'
import { recordMeaningfulActivity } from '../services/DormantReminderService'
import colors from '../constants/colors'

export default function CameraScreen({ onClose, onProduceIdentified, onManualEntry, onAccountRequired, onQuotaUpgrade, onViewScanUsage, onPaywall }) {
  const {
    cameraRef,
    state: cameraState,
    requestAccess,
    onCameraReady,
    takePhoto,
  } = useCamera()

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  // true when the error is an API/analysis failure (not camera failure)
  const [isApiError, setIsApiError] = useState(false)
  const [quotaModal, setQuotaModal] = useState(null)
  const [isOpeningPaywall, setIsOpeningPaywall] = useState(false)
  const [showScanPlan, setShowScanPlan] = useState(false)
  const [showAccountGate, setShowAccountGate] = useState(false)
  const [isDurable, setIsDurable] = useState(false)
  const { applySnapshot, refresh: refreshQuota, quota, loading: quotaLoading } = useQuota()
  const { isPro, refresh: refreshSubscription } = useSubscription()
  const isScreenFocused = useIsFocused()
  const quotaDisplay = getQuotaDisplay(quota, isPro, quotaLoading)

  useEffect(() => {
    getAccountStatus().then((s) => setIsDurable(s.isDurable)).catch(() => {})
    if (isScreenFocused) refreshQuota().catch(() => {})
  }, [isScreenFocused, refreshQuota])

  useEffect(() => {
    if (isScreenFocused) setIsOpeningPaywall(false)
  }, [isScreenFocused])

  useEffect(() => {
    if (!quotaModal || !isPro) return
    setQuotaModal(null)
    setIsOpeningPaywall(false)
    refreshQuota()
  }, [isPro, quotaModal, refreshQuota])

  // Request permission on mount if needed
  React.useEffect(() => {
    if (cameraState.hasPermission === null || cameraState.hasPermission === false) {
      requestAccess()
    }
  }, [])

  const handleCapture = useCallback(async () => {
    console.log('[SCAN] shutter pressed')
    setError(null)
    setIsApiError(false)
    setIsProcessing(true)

    try {
      const photo = await takePhoto()
      console.log('[SCAN] photo captured uri:', photo?.uri ? 'present' : 'missing')
      if (!photo) {
        setError('Failed to capture photo')
        setIsProcessing(false)
        return
      }

      if (!isServerScanAvailable()) {
        console.log('[SCAN] Server scan not available')
        setError('Scan service is not configured. Install the latest preview build or use manual entry.')
        setIsApiError(true)
        setIsProcessing(false)
        return
      }

      console.log('[SCAN] starting analysis')
      const result = await identifyProduce(
        photo.base64,
        'image/jpeg',
        null,
      )

      if (result.scannedIngredients.length === 0) {
        console.log('[SCAN] no produce identified')
        setError('No produce items identified. Try again with better lighting.')
        setIsProcessing(false)
        return
      }

      console.log('[SCAN] analysis success —', result.scannedIngredients.length, 'items')
      if (result.quota) applySnapshot(result.quota)
      recordMeaningfulActivity().catch(() => {})
      onProduceIdentified(result)
    } catch (err) {
      if (err instanceof ScanQuotaError && err.code === 'monthly_limit_reached' && err.quota) {
        applySnapshot(err.quota)
        await refreshSubscription()
        trackEvent(err.quota.plan === 'pro' ? 'pro_scan_quota_modal_viewed' : 'scan_quota_modal_viewed', {
          plan: err.quota.plan,
          scans_used: err.quota.used,
          scans_limit: err.quota.limit,
          scans_remaining: err.quota.remaining,
          reset_date_available: Boolean(err.quota.periodEnd),
          platform: Platform.OS,
          paywall_source: 'scan_quota_exhausted',
        })
        setQuotaModal(err.quota)
        return
      }

      // Durable-account gate: no scan was reserved or consumed.
      if (err && err.name === 'ScanQuotaError' && err.code === 'account_required') {
        console.log('[SCAN] account required before first funded scan')
        setIsProcessing(false)
        setShowAccountGate(true)
        return
      }
      const message = err instanceof Error ? err.message : 'Something went wrong'
      console.log('[SCAN] analysis error:', message)
      setError(message)
      setIsApiError(true)
    } finally {
      setIsProcessing(false)
    }
  }, [takePhoto, onProduceIdentified, applySnapshot, refreshSubscription])

  const handleManualEntry = useCallback(() => {
    if (onManualEntry) {
      onManualEntry()
    } else {
      onClose()
    }
  }, [onManualEntry, onClose])

  const handleQuotaManualEntry = useCallback(() => {
    if (!quotaModal) return
    trackEvent('scan_quota_manual_entry_selected', {
      plan: quotaModal.plan,
      scans_used: quotaModal.used,
      scans_limit: quotaModal.limit,
      scans_remaining: quotaModal.remaining,
      reset_date_available: Boolean(quotaModal.periodEnd),
      platform: Platform.OS,
    })
    setQuotaModal(null)
    handleManualEntry()
  }, [handleManualEntry, quotaModal])

  const handleQuotaDismiss = useCallback(() => {
    if (quotaModal) {
      trackEvent('scan_quota_modal_dismissed', {
        plan: quotaModal.plan,
        scans_used: quotaModal.used,
        scans_limit: quotaModal.limit,
        scans_remaining: quotaModal.remaining,
        reset_date_available: Boolean(quotaModal.periodEnd),
        platform: Platform.OS,
      })
    }
    setQuotaModal(null)
    setIsOpeningPaywall(false)
  }, [quotaModal])

  const handleQuotaUpgrade = useCallback(() => {
    if (!quotaModal || isOpeningPaywall || quotaModal.plan === 'pro') return
    setIsOpeningPaywall(true)
    trackEvent('scan_quota_upgrade_selected', {
      plan: quotaModal.plan,
      scans_used: quotaModal.used,
      scans_limit: quotaModal.limit,
      scans_remaining: quotaModal.remaining,
      reset_date_available: Boolean(quotaModal.periodEnd),
      platform: Platform.OS,
      paywall_source: 'scan_quota_exhausted',
    })
    onQuotaUpgrade?.()
  }, [isOpeningPaywall, onQuotaUpgrade, quotaModal])

  const handleQuotaUsage = useCallback(() => {
    setQuotaModal(null)
    onViewScanUsage?.()
  }, [onViewScanUsage])

  // Permission not yet granted
  if (!cameraState.hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Aperture size={48} color={colors.primary} strokeWidth={1.5} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Juicing needs camera access to identify your produce items and estimate nutritional content.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestAccess}>
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonAlt} onPress={onClose}>
            <Text style={styles.closeButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={onCameraReady}
      />

      {/* Overlay UI */}
      <View style={styles.overlay}>
        <ScanQuotaReachedModal
          visible={Boolean(quotaModal)}
          quota={quotaModal}
          isOpeningPaywall={isOpeningPaywall}
          onUpgrade={handleQuotaUpgrade}
          onManualEntry={handleQuotaManualEntry}
          onViewUsage={handleQuotaUsage}
          onDismiss={handleQuotaDismiss}
        />
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan Produce</Text>
          <TouchableOpacity
            style={styles.quotaBadge}
            onPress={() => {
              if (!isDurable) {
                setShowAccountGate(true)
                return
              }
              const exhausted = quotaDisplay.effectiveRemaining != null && quotaDisplay.effectiveRemaining <= 0
              if (exhausted) {
                setQuotaModal(quota)
                return
              }
              setShowScanPlan(true)
              refreshQuota().catch(() => {})
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={(() => {
              if (!isDurable) return 'Sign in to view your Juice Snap plan.'
              if (quotaDisplay.loading) return 'Juice Snap plan loading.'
              if (quotaDisplay.error || quotaDisplay.effectiveRemaining == null) return 'Juice Snap plan unavailable. Double tap to view plan details.'
              const canonical = formatCanonicalQuotaLabel(quotaDisplay)
              const planName = isPro ? 'RawLifeFlow Pro' : 'Juice Snap plan'
              return `${planName}. ${canonical}. Double tap to view plan details.`
            })()}
            accessibilityHint={
              isDurable
                ? 'Opens your scan plan details and upgrade options.'
                : 'Opens sign in to protect your juice history and access Juice Snap.'
            }
            accessibilityState={{ busy: quotaDisplay.loading }}
            hitSlop={4}
          >
            {quotaDisplay.loading ? (
              <>
                <Camera size={12} color={colors.white} />
                <Text style={styles.quotaBadgeText}>…</Text>
              </>
            ) : !isDurable ? (
              <>
                <Camera size={12} color={colors.white} />
                <Text style={styles.quotaBadgeText}>Plan</Text>
              </>
            ) : quotaDisplay.error || quotaDisplay.effectiveRemaining == null ? (
              <>
                <Camera size={12} color={colors.white} />
                <Text style={styles.quotaBadgeText}>View plan</Text>
              </>
            ) : (
              <>
                <Camera size={12} color={isPro ? '#FFD54F' : '#64B5F6'} />
                <Text style={[styles.quotaBadgeText, { color: isPro ? '#FFD54F' : '#64B5F6' }]}>
                  {quotaDisplay.effectiveRemaining} left
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Center guide */}
        <View style={styles.guideContainer}>
          <View style={styles.guideFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.guideText}>
            Place produce within the frame
          </Text>
        </View>

        {/* API error fallback panel — full choices so user is never stuck */}
        {error && isApiError && (
          <View style={styles.fallbackPanel}>
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackTitle}>We couldn't analyze that photo right now.</Text>
              <Text style={styles.fallbackDesc}>{error}</Text>

              <Pressable
                style={({ pressed }) => [styles.fallbackBtn, styles.fallbackBtnPrimary, pressed && { opacity: 0.8 }]}
                onPress={handleManualEntry}
                hitSlop={8}
              >
                <Keyboard size={18} color="#FFFFFF" />
                <Text style={styles.fallbackBtnPrimaryText}>Type it in</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.fallbackBtn, pressed && { opacity: 0.7 }]}
                onPress={() => { setError(null); setIsApiError(false) }}
                hitSlop={8}
              >
                <Eye size={18} color={colors.textSecondary} />
                <Text style={styles.fallbackBtnText}>Try again</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.fallbackBtn, pressed && { opacity: 0.7 }]}
                onPress={onClose}
                hitSlop={8}
              >
                <Home size={18} color={colors.textMuted} />
                <Text style={[styles.fallbackBtnText, { color: colors.textMuted }]}>Back to Home</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Simple error banner for non-API errors (camera failures, no produce found) */}
        {error && !isApiError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          {!isApiError && (
            <>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  (isProcessing || cameraState.isCapturing) && styles.captureButtonDisabled,
                ]}
                onPress={handleCapture}
                disabled={isProcessing || cameraState.isCapturing}
                activeOpacity={0.7}
              >
                {isProcessing ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </TouchableOpacity>

              {isProcessing && (
                <Text style={styles.processingText}>
                  Identifying produce...
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      <ScanPlanModal
        visible={showScanPlan}
        quota={quota}
        isPro={isPro}
        onUpgrade={() => {
          setShowScanPlan(false)
          onQuotaUpgrade?.()
        }}
        onContinue={() => setShowScanPlan(false)}
        onManage={() => {
          setShowScanPlan(false)
          onViewScanUsage?.()
        }}
        onManualEntry={() => {
          setShowScanPlan(false)
          handleManualEntry()
        }}
        onDismiss={() => setShowScanPlan(false)}
      />

      <AccountGateModal
        visible={showAccountGate}
        initialMode="signin"
        onClose={() => setShowAccountGate(false)}
        onAuthenticated={() => {
          setShowAccountGate(false)
          refreshQuota().catch(() => {})
          getAccountStatus().then((s) => setIsDurable(s.isDurable)).catch(() => {})
        }}
      />
    </View>
  )
}

const CORNER_SIZE = 24
const CORNER_THICKNESS = 3

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  quotaBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  guideContainer: {
    alignItems: 'center',
  },
  guideFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: colors.accent,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: colors.accent,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: colors.accent,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: colors.accent,
    borderBottomRightRadius: 8,
  },
  guideText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 16,
  },
  errorBanner: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(231,111,81,0.9)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  errorText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.white,
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
  },
  processingText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  permissionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 24,
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  closeButtonAlt: {
    paddingVertical: 8,
  },
  closeButtonAltText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  // ── Fallback panel (API error recovery) ──
  fallbackPanel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  fallbackCard: {
    backgroundColor: colors.surface || '#1C2128',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 10,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 4,
  },
  fallbackDesc: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary || '#8B949E',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  fallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    minHeight: 48,
  },
  fallbackBtnPrimary: {
    backgroundColor: colors.primary || '#2E7D32',
  },
  fallbackBtnPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fallbackBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary || '#8B949E',
  },
})
