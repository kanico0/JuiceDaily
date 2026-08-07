// ─────────────────────────────────────────────────────────────
// useCamera.ts — expo-camera hook for capturing produce photos
// ─────────────────────────────────────────────────────────────

import { useRef, useState, useCallback, useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

// ── Types ────────────────────────────────────────────────────

export type CameraPhase = 'idle' | 'permission_check' | 'camera_mounting' | 'camera_ready' | 'error'

// ── QA Instrumentation ───────────────────────────────────────
// Minimal sanitized logger for physical-device camera lifecycle
// debugging. Prefix [CAM_QA] for easy logcat grep. No PII.
function camQa(tag: string, extra?: Record<string, unknown>) {
  const payload = extra ? ' ' + JSON.stringify(extra) : ''
  console.log(`[CAM_QA] ${tag}${payload}`)
}

export interface CameraState {
  isReady: boolean
  hasPermission: boolean | null
  isCapturing: boolean
  error: string | null
  phase: CameraPhase
  mountError: string | null
}

export interface CapturedPhoto {
  uri: string
  base64: string
  width: number
  height: number
}

const CAMERA_READY_TIMEOUT_MS = 15000

// Grace period before the fallback readiness probe runs.
// onCameraReady is the PRIMARY readiness path — the fallback only
// activates if the native event is not delivered within this period
// (observed on Samsung Galaxy S22 Ultra with Fabric/New Architecture).
// 3s is ~3x the normal time-to-streaming, giving onCameraReady ample
// time to fire first while keeping user wait minimal.
const FALLBACK_GRACE_MS = 3000

export type ReadySource = 'native_event' | 'fallback_probe' | null

// ── Hook ─────────────────────────────────────────────────────

export function useCamera() {
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fallbackProbeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef(0)
  const readySourceRef = useRef<ReadySource>(null)
  const mountErrorRef = useRef(false)
  const appStateRef = useRef<AppStateStatus>('active')

  const [state, setState] = useState<CameraState>({
    isReady: false,
    hasPermission: null,
    isCapturing: false,
    error: null,
    phase: 'idle',
    mountError: null,
  })

  const clearReadyTimer = useCallback(() => {
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current)
      readyTimerRef.current = null
      camQa('TIMER_CLEAR', { session: sessionRef.current })
    }
  }, [])

  // Clear the fallback readiness probe timer
  const clearFallbackProbe = useCallback(() => {
    if (fallbackProbeTimerRef.current) {
      clearTimeout(fallbackProbeTimerRef.current)
      fallbackProbeTimerRef.current = null
      camQa('FALLBACK_PROBE_CLEAR', { session: sessionRef.current })
    }
  }, [])

  // Clear any pending ready timeout and fallback probe on unmount
  useEffect(() => {
    camQa('HOOK_MOUNT', { session: sessionRef.current })
    return () => {
      camQa('HOOK_UNMOUNT', { session: sessionRef.current })
      clearReadyTimer()
      clearFallbackProbe()
    }
  }, [clearReadyTimer, clearFallbackProbe])

  // Clear timer and fallback probe when app goes to background
  useEffect(() => {
    const handler = (e: AppStateStatus) => {
      appStateRef.current = e
      camQa('APP_STATE', { state: e, session: sessionRef.current })
      if (e !== 'active') {
        clearReadyTimer()
        clearFallbackProbe()
      }
    }
    const sub = AppState.addEventListener('change', handler)
    return () => {
      sub.remove()
    }
  }, [clearReadyTimer, clearFallbackProbe])

  // Start a timeout when entering camera_mounting phase.
  // The timer is tied to a session ID so that an old timer
  // cannot report failure against a newer camera session.
  const startReadyTimeout = useCallback(() => {
    clearReadyTimer()
    const session = sessionRef.current
    camQa('TIMER_ARM', { session, timeoutMs: CAMERA_READY_TIMEOUT_MS })
    readyTimerRef.current = setTimeout(() => {
      // Ignore if a newer session has started
      if (session !== sessionRef.current) {
        camQa('TIMEOUT_CALLBACK_STALE_SESSION', { armedSession: session, currentSession: sessionRef.current })
        return
      }
      camQa('TIMEOUT_CALLBACK_ENTER', { armedSession: session, currentSession: sessionRef.current })
      setState((prev) => {
        // Only fire if still in mounting phase — if the camera
        // became ready or capture started, the timer should have
        // been cleared already. This is a defensive check.
        camQa('TIMEOUT_CALLBACK_PHASE_CHECK', { phaseAtCallback: prev.phase, isReady: prev.isReady })
        if (prev.phase === 'camera_mounting') {
          camQa('TIMEOUT_FIRING', { session, phase: prev.phase })
          return {
            ...prev,
            isReady: false,
            phase: 'error',
            mountError: 'Camera initialization timed out. Please try again.',
            error: 'Camera initialization timed out. Please try again.',
          }
        }
        camQa('TIMEOUT_SUPPRESSED', { session, phase: prev.phase })
        return prev
      })
    }, CAMERA_READY_TIMEOUT_MS)
  }, [clearReadyTimer])

  // Fallback readiness probe for Samsung/Fabric where onCameraReady
  // is never delivered despite the native camera reaching ACTIVE +
  // STREAMING. Uses getAvailablePictureSizesAsync as a non-destructive
  // probe: it reads Camera2 SCALER_STREAM_CONFIGURATION_MAP and returns
  // a non-empty array when the camera is initialized, empty otherwise.
  // This is read-only and does not modify camera state.
  const startFallbackProbe = useCallback(() => {
    clearFallbackProbe()
    const session = sessionRef.current
    camQa('FALLBACK_PROBE_ARM', { session, graceMs: FALLBACK_GRACE_MS })
    fallbackProbeTimerRef.current = setTimeout(async () => {
      // Ignore if a newer session has started
      if (session !== sessionRef.current) {
        camQa('FALLBACK_PROBE_STALE_SESSION', { armedSession: session, currentSession: sessionRef.current })
        return
      }
      // Ignore if already ready (onCameraReady fired first)
      if (readySourceRef.current !== null) {
        camQa('FALLBACK_PROBE_SKIP_ALREADY_READY', { session, readySource: readySourceRef.current })
        return
      }
      // Ignore if mount error occurred
      if (mountErrorRef.current) {
        camQa('FALLBACK_PROBE_SKIP_MOUNT_ERROR', { session })
        return
      }
      // Ignore if app is not active
      if (appStateRef.current !== 'active') {
        camQa('FALLBACK_PROBE_SKIP_NOT_ACTIVE', { session, appState: appStateRef.current })
        return
      }

      camQa('FALLBACK_PROBE_ENTER', { session })

      if (!cameraRef.current) {
        camQa('FALLBACK_PROBE_NO_REF', { session })
        return
      }

      try {
        const sizes = await cameraRef.current.getAvailablePictureSizesAsync()
        camQa('FALLBACK_PROBE_RESULT', { session, sizeCount: sizes?.length || 0 })

        // Re-check session after async
        if (session !== sessionRef.current) {
          camQa('FALLBACK_PROBE_STALE_AFTER_ASYNC', { armedSession: session, currentSession: sessionRef.current })
          return
        }
        if (readySourceRef.current !== null) {
          camQa('FALLBACK_PROBE_SKIP_ALREADY_READY_AFTER_ASYNC', { session, readySource: readySourceRef.current })
          return
        }
        if (mountErrorRef.current) {
          camQa('FALLBACK_PROBE_SKIP_MOUNT_ERROR_AFTER_ASYNC', { session })
          return
        }

        if (sizes && sizes.length > 0) {
          readySourceRef.current = 'fallback_probe'
          clearReadyTimer()
          setState((prev) => {
            if (prev.phase !== 'camera_mounting') {
              camQa('FALLBACK_PROBE_SKIP_WRONG_PHASE', { session, phase: prev.phase })
              return prev
            }
            camQa('FALLBACK_PROBE_SUCCESS', { session, sizeCount: sizes.length })
            return {
              ...prev,
              isReady: true,
              phase: 'camera_ready',
              mountError: null,
            }
          })
          camQa('PHASE_TRANSITION', { to: 'camera_ready', session, reason: 'fallback_probe' })
        } else {
          camQa('FALLBACK_PROBE_EMPTY_SIZES', { session })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'probe failed'
        camQa('FALLBACK_PROBE_ERROR', { session, message })
      }
    }, FALLBACK_GRACE_MS)
  }, [clearFallbackProbe, clearReadyTimer])

  // Request camera permission
  const requestAccess = useCallback(async (): Promise<boolean> => {
    camQa('REQUEST_ACCESS_ENTER', { session: sessionRef.current })
    setState((prev) => ({ ...prev, phase: 'permission_check' }))
    camQa('PHASE_TRANSITION', { to: 'permission_check', session: sessionRef.current })
    try {
      const result = await requestPermission()
      const granted = result.granted
      camQa('PERMISSION_RESULT', { granted, session: sessionRef.current })
      if (granted) {
        sessionRef.current += 1
        camQa('SESSION_INCREMENT', { newSession: sessionRef.current })
        setState((prev) => ({
          ...prev,
          hasPermission: true,
          error: null,
          phase: 'camera_mounting',
        }))
        camQa('PHASE_TRANSITION', { to: 'camera_mounting', session: sessionRef.current })
        readySourceRef.current = null
        mountErrorRef.current = false
        startReadyTimeout()
        startFallbackProbe()
      } else {
        setState((prev) => ({
          ...prev,
          hasPermission: false,
          phase: 'error',
        }))
        camQa('PHASE_TRANSITION', { to: 'error', session: sessionRef.current, reason: 'permission_denied' })
      }
      return granted
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permission request failed'
      camQa('REQUEST_ACCESS_ERROR', { message, session: sessionRef.current })
      setState((prev) => ({
        ...prev,
        error: message,
        phase: 'error',
      }))
      camQa('PHASE_TRANSITION', { to: 'error', session: sessionRef.current, reason: 'request_exception' })
      return false
    }
  }, [requestPermission, startReadyTimeout, startFallbackProbe])

  // Camera ready callback — native camera reports readiness.
  // Cancels the initialization timer for this session.
  const onCameraReady = useCallback(() => {
    camQa('ON_CAMERA_READY', { session: sessionRef.current })
    readySourceRef.current = 'native_event'
    clearReadyTimer()
    clearFallbackProbe()
    setState((prev) => ({
      ...prev,
      isReady: true,
      phase: 'camera_ready',
      mountError: null,
    }))
    camQa('PHASE_TRANSITION', { to: 'camera_ready', session: sessionRef.current, reason: 'native_event' })
  }, [clearReadyTimer, clearFallbackProbe])

  // Camera mount error callback — native camera failed to start
  const onMountError = useCallback(
    (event: { message: string }) => {
      const message = event?.message || 'Camera could not be started'
      camQa('ON_MOUNT_ERROR', { session: sessionRef.current, message })
      mountErrorRef.current = true
      clearReadyTimer()
      clearFallbackProbe()
      setState((prev) => ({
        ...prev,
        isReady: false,
        phase: 'error',
        mountError: message,
        error: message,
      }))
      camQa('PHASE_TRANSITION', { to: 'error', session: sessionRef.current, reason: 'mount_error' })
    },
    [clearReadyTimer, clearFallbackProbe],
  )

  // Reset camera state for a fresh attempt.
  // Increments the session ID so any pending timer from the
  // previous session is invalidated.
  const resetCamera = useCallback(() => {
    camQa('RESET_CAMERA_ENTER', { session: sessionRef.current })
    clearReadyTimer()
    clearFallbackProbe()
    sessionRef.current += 1
    readySourceRef.current = null
    mountErrorRef.current = false
    camQa('SESSION_INCREMENT', { newSession: sessionRef.current, reason: 'reset' })
    setState({
      isReady: false,
      hasPermission: null,
      isCapturing: false,
      error: null,
      phase: 'idle',
      mountError: null,
    })
    camQa('PHASE_TRANSITION', { to: 'idle', session: sessionRef.current, reason: 'reset' })
  }, [clearReadyTimer, clearFallbackProbe])

  // Take a photo and return base64.
  // Defensively cancels the initialization timer when capture
  // begins — the camera is clearly ready if we can capture.
  const takePhoto = useCallback(async (): Promise<CapturedPhoto | null> => {
    if (!cameraRef.current || state.isCapturing) return null

    // Cancel any pending initialization timer — capture cannot
    // begin unless the camera is ready.
    camQa('TAKE_PHOTO_ENTER', { session: sessionRef.current, phase: state.phase, isReady: state.isReady })
    clearReadyTimer()
    clearFallbackProbe()

    setState((prev) => ({ ...prev, isCapturing: true, error: null }))

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        exif: false,
      })

      if (!photo || !photo.base64) {
        setState((prev) => ({ ...prev, isCapturing: false, error: 'No photo data returned' }))
        return null
      }

      setState((prev) => ({ ...prev, isCapturing: false }))

      return {
        uri: photo.uri,
        base64: photo.base64,
        width: photo.width,
        height: photo.height,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Photo capture failed'
      setState((prev) => ({ ...prev, isCapturing: false, error: message }))
      return null
    }
  }, [state.isCapturing, clearReadyTimer, clearFallbackProbe])

  // Derive permission status from the permission object
  const hasPermission = permission?.granted ?? null

  // If the system permission is already granted on mount, transition to mounting
  useEffect(() => {
    if (hasPermission === true && state.phase === 'idle') {
      sessionRef.current += 1
      readySourceRef.current = null
      mountErrorRef.current = false
      camQa('SESSION_INCREMENT', { newSession: sessionRef.current, reason: 'auto_transition' })
      setState((prev) => ({
        ...prev,
        hasPermission: true,
        phase: 'camera_mounting',
      }))
      camQa('PHASE_TRANSITION', { to: 'camera_mounting', session: sessionRef.current, reason: 'auto_transition' })
      startReadyTimeout()
      startFallbackProbe()
    }
  }, [hasPermission, state.phase, startReadyTimeout, startFallbackProbe])

  return {
    cameraRef,
    hasPermission,
    state: { ...state, hasPermission },
    requestAccess,
    onCameraReady,
    onMountError,
    takePhoto,
    resetCamera,
  }
}
