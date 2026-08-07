import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native'
import { CameraView } from 'expo-camera'
import { X, Aperture, Keyboard, Eye, Home, AlertCircle, RefreshCw } from 'lucide-react-native'
import { useCamera } from '../hooks/useCamera'
import { identifyProduce, ImageProcessingError } from '../services/ClaudeVisionService'
import { recordMeaningfulActivity } from '../services/DormantReminderService'
import colors from '../constants/colors'

function camQaScreen(tag, extra) {
  const payload = extra ? ' ' + JSON.stringify(extra) : ''
  console.log(`[CAM_QA] ${tag}${payload}`)
}

export default function CameraScreen({
  onClose,
  onProduceIdentified,
  onManualEntry,
  onAccountRequired,
  guestFirstScan,
  quotaRemaining,
  isProUser,
}) {
  const {
    cameraRef,
    state: cameraState,
    requestAccess,
    onCameraReady,
    onMountError,
    takePhoto,
    resetCamera,
  } = useCamera()

  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  // true when the error is an API/analysis failure (not camera failure)
  const [isApiError, setIsApiError] = useState(false)

  // Screen mount/unmount logging
  useEffect(() => {
    camQaScreen('CAMERA_SCREEN_MOUNT')
    return () => {
      camQaScreen('CAMERA_SCREEN_UNMOUNT')
    }
  }, [])

  // Request permission on mount if needed
  useEffect(() => {
    camQaScreen('CAMERA_SCREEN_MOUNT_EFFECT', { hasPermission: cameraState.hasPermission, phase: cameraState.phase })
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

      console.log('[SCAN] starting analysis')
      const result = await identifyProduce(photo.uri, 'image/jpeg', null, photo.width, photo.height)

      if (result.scannedIngredients.length === 0) {
        console.log('[SCAN] no produce identified')
        setError('No produce items identified. Try again with better lighting.')
        setIsProcessing(false)
        return
      }

      console.log('[SCAN] analysis success —', result.scannedIngredients.length, 'items')
      recordMeaningfulActivity().catch(() => {})
      onProduceIdentified(result)
    } catch (err) {
      // Durable-account gate: no scan was reserved or consumed.
      if (err && err.name === 'ScanQuotaError' && err.code === 'account_required') {
        console.log('[SCAN] account required before first funded scan')
        setIsProcessing(false)
        if (onAccountRequired) onAccountRequired()
        return
      }
      // Image preprocessing failures are processing errors, not camera errors.
      if (err && err.name === 'ImageProcessingError') {
        console.log('[SCAN] image processing error:', err.message)
        setError(err.message)
        setIsApiError(true)
        return
      }
      const message = err instanceof Error ? err.message : 'Something went wrong'
      console.log('[SCAN] analysis error:', message)
      setError(message)
      setIsApiError(true)
    } finally {
      setIsProcessing(false)
    }
  }, [takePhoto, onProduceIdentified, onAccountRequired])

  const handleManualEntry = useCallback(() => {
    if (onManualEntry) {
      onManualEntry()
    } else {
      onClose()
    }
  }, [onManualEntry, onClose])

  // Permission not yet granted
  if (!cameraState.hasPermission) {
    const isDenied = cameraState.hasPermission === false && cameraState.phase === 'error'
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <Aperture size={48} color={colors.primary} strokeWidth={1.5} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Juicing needs camera access to identify your produce items and estimate nutritional
            content.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestAccess}>
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
          {isDenied && (
            <TouchableOpacity style={styles.settingsButton} onPress={() => Linking.openSettings()}>
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.closeButtonAlt} onPress={onClose}>
            <Text style={styles.closeButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Camera mount error or timeout.
  // Suppress the camera error card while analysis is in progress
  // — a stale initialization timer could fire after capture has
  // already started. The timer fix in useCamera prevents this, but
  // this guard ensures analysis is never interrupted by a stale
  // camera error display.
  if (cameraState.phase === 'error' && cameraState.mountError && !isProcessing) {
    camQaScreen('ERROR_CARD_RENDERED', { mountError: cameraState.mountError, phase: cameraState.phase })
    return (
      <View style={styles.container}>
        <View style={styles.permissionCard}>
          <AlertCircle size={48} color={colors.danger || '#E91E63'} strokeWidth={1.5} />
          <Text style={styles.permissionTitle}>Camera Could Not Start</Text>
          <Text style={styles.permissionText}>{cameraState.mountError}</Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => {
              resetCamera()
              requestAccess()
            }}
          >
            <RefreshCw size={18} color={colors.white || '#FFFFFF'} />
            <Text style={styles.permissionButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButtonAlt} onPress={onClose}>
            <Text style={styles.closeButtonAltText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Camera is mounting — show loading state
  const isMounting = cameraState.phase === 'camera_mounting' && !cameraState.isReady

  camQaScreen('CAMERA_SCREEN_RENDER', { phase: cameraState.phase, isReady: cameraState.isReady, isMounting, hasPermission: cameraState.hasPermission })

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={onCameraReady}
        onMountError={onMountError}
      />

      {/* Camera mounting overlay — shown while native camera initializes */}
      {isMounting && (
        <View style={styles.mountingOverlay}>
          <ActivityIndicator size="large" color={colors.accent || '#4CAF50'} />
          <Text style={styles.mountingText}>Starting camera…</Text>
        </View>
      )}

      {/* Overlay UI */}
      <View style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan Produce{'\n'}or Exit to Enter Manually</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Nonblocking first-scan notice for guests */}
        {guestFirstScan && !isProcessing && !error && (
          <View style={styles.firstScanNotice}>
            <Text style={styles.firstScanNoticeText}>
              Your first scan is free — no account needed.{'\n'}
              Point at produce, tap the button, and we'll identify it instantly.
            </Text>
          </View>
        )}

        {/* Center guide */}
        <View style={styles.guideContainer}>
          <View style={styles.guideFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.guideText}>Place produce within the frame</Text>
          <Text style={styles.guideHint}>
            Tap the button below to scan — we'll identify your produce and estimate nutrition.
          </Text>

          {/* Free quota guidance — suppressed for Pro users */}
          {!isProUser && !isProcessing && !error && (
            <Text style={styles.quotaGuidance}>
              {quotaRemaining !== null && quotaRemaining !== undefined
                ? `Free plan: ${quotaRemaining} Juice Snap${quotaRemaining === 1 ? '' : 's'} remaining. Frame your produce carefully before taking the photo.`
                : 'Free Juice Snaps are limited. Frame your produce carefully before taking the photo.'}
            </Text>
          )}
        </View>

        {/* API error fallback panel — full choices so user is never stuck */}
        {error && isApiError && (
          <View style={styles.fallbackPanel}>
            <View style={styles.fallbackCard}>
              <Text style={styles.fallbackTitle}>We couldn't analyze that photo right now.</Text>
              <Text style={styles.fallbackDesc}>{error}</Text>

              <Pressable
                style={({ pressed }) => [
                  styles.fallbackBtn,
                  styles.fallbackBtnPrimary,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleManualEntry}
                hitSlop={8}
              >
                <Keyboard size={18} color="#FFFFFF" />
                <Text style={styles.fallbackBtnPrimaryText}>Type it in</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [styles.fallbackBtn, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  setError(null)
                  setIsApiError(false)
                }}
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
                <Text style={[styles.fallbackBtnText, { color: colors.textMuted }]}>
                  Back to Home
                </Text>
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

              {isProcessing && <Text style={styles.processingText}>Identifying produce...</Text>}
            </>
          )}
        </View>
      </View>
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
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    lineHeight: 18,
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
  guideHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  quotaGuidance: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  firstScanNotice: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: 'rgba(46,125,50,0.85)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  firstScanNoticeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
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
  settingsButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 4,
  },
  settingsButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  mountingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  mountingText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
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
