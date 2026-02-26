import React, { useState, useCallback } from 'react'
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
import { X, Aperture, Keyboard, Eye, Home } from 'lucide-react-native'
import { useCamera } from '../hooks/useCamera'
import { identifyProduce, isClaudeKeySet } from '../services/ClaudeVisionService'
import colors from '../constants/colors'

export default function CameraScreen({ onClose, onProduceIdentified, onManualEntry }) {
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

      if (!isClaudeKeySet()) {
        console.log('[SCAN] API key not configured')
        setError('API key not configured — add ANTHROPIC_API_KEY to .env')
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
      onProduceIdentified(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      console.log('[SCAN] analysis error:', message)
      setError(message)
      setIsApiError(true)
    } finally {
      setIsProcessing(false)
    }
  }, [takePhoto, onProduceIdentified])

  const handleManualEntry = useCallback(() => {
    if (onManualEntry) {
      onManualEntry()
    } else {
      onClose()
    }
  }, [onManualEntry, onClose])

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
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan Produce</Text>
          <View style={{ width: 40 }} />
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
