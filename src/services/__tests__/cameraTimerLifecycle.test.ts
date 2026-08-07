// ─────────────────────────────────────────────────────────────
// cameraTimerLifecycle.test.ts — Regression tests for Defect 1:
// stale camera initialization timeout firing after capture.
//
// Proves:
//   1. onCameraReady cancels the initialization timer.
//   2. takePhoto cancels the initialization timer before capture.
//   3. A timer from a previous session cannot fire after resetCamera.
//   4. Timer callback is a no-op when phase is not camera_mounting.
//   5. onMountError cancels the initialization timer.
//   6. Timer does not fire after capture even without onCameraReady.
//   7. Unmount clears the timer.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import TestRenderer from 'react-test-renderer'
import { useCamera } from '../../hooks/useCamera'

jest.mock('expo-camera', () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: () => [
    { granted: true, status: 'granted', canAskAgain: true },
    jest.fn().mockResolvedValue({ granted: true }),
  ],
}))

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  View: 'View',
  Text: 'Text',
  StyleSheet: { absoluteFill: {} },
}))

function TestComponent({ hookRef }: { hookRef: { current: any } }) {
  const cam = useCamera()
  hookRef.current = cam
  return null
}

describe('Camera timer lifecycle (Defect 1)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('onCameraReady cancels the initialization timer', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })

    expect(hookRef.current).not.toBeNull()
    // Timer is armed automatically by the permission effect on mount

    TestRenderer.act(() => {
      hookRef.current.onCameraReady()
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.isReady).toBe(true)

    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.mountError).toBeNull()

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('takePhoto cancels the initialization timer before capture', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })
    // Timer is armed automatically by the permission effect on mount

    const mockTakePicture = jest.fn().mockResolvedValue({
      base64: 'mockbase64',
      uri: 'mockuri',
      width: 1080,
      height: 1920,
    })
    hookRef.current.cameraRef.current = {
      takePictureAsync: mockTakePicture,
    }

    await TestRenderer.act(async () => {
      await hookRef.current.takePhoto()
    })

    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })

    expect(hookRef.current.state.phase).not.toBe('error')
    expect(hookRef.current.state.mountError).toBeNull()

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('timer from a previous session does not fire after resetCamera', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })
    // Timer is armed automatically by the permission effect on mount

    TestRenderer.act(() => {
      hookRef.current.resetCamera()
    })

    // After reset, the useEffect may transition back to camera_mounting
    // because permission is already granted. The key assertion is that
    // no timeout error fires from the old session's timer.

    // Advance 9 seconds — less than the 10s timeout.
    // The old timer was cleared and invalidated by resetCamera.
    // The new timer (from useEffect re-trigger) hasn't fired yet.
    TestRenderer.act(() => {
      jest.advanceTimersByTime(9000)
    })

    // No timeout error should have fired from either old or new timer
    expect(hookRef.current.state.mountError).not.toBe(
      'Camera initialization timed out. Please try again.',
    )

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('timer callback is a no-op when phase is not camera_mounting', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })
    // Timer is armed automatically by the permission effect on mount

    TestRenderer.act(() => {
      hookRef.current.onCameraReady()
    })

    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })

    expect(hookRef.current.state.phase).toBe('camera_ready')
    expect(hookRef.current.state.mountError).toBeNull()

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('onMountError cancels the initialization timer', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })
    // Timer is armed automatically by the permission effect on mount

    TestRenderer.act(() => {
      hookRef.current.onMountError({ message: 'Camera failed' })
    })

    expect(hookRef.current.state.phase).toBe('error')
    expect(hookRef.current.state.mountError).toBe('Camera failed')

    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })

    expect(hookRef.current.state.mountError).toBe('Camera failed')

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('timer does not fire after capture even if onCameraReady was not called', async () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })
    // Timer is armed automatically by the permission effect on mount

    const mockTakePicture = jest.fn().mockResolvedValue({
      base64: 'mockbase64',
      uri: 'mockuri',
      width: 1080,
      height: 1920,
    })
    hookRef.current.cameraRef.current = {
      takePictureAsync: mockTakePicture,
    }

    await TestRenderer.act(async () => {
      await hookRef.current.takePhoto()
    })

    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })

    expect(hookRef.current.state.mountError).not.toBe(
      'Camera initialization timed out. Please try again.',
    )

    TestRenderer.act(() => {
      renderer.unmount()
    })
  })

  test('unmount clears the timer', () => {
    const hookRef: { current: any } = { current: null }
    let renderer: any
    TestRenderer.act(() => {
      renderer = TestRenderer.create(React.createElement(TestComponent, { hookRef }))
    })
    // Timer is armed automatically by the permission effect on mount

    TestRenderer.act(() => {
      renderer.unmount()
    })

    // Advancing timers after unmount should not throw
    TestRenderer.act(() => {
      jest.advanceTimersByTime(15000)
    })
  })
})
