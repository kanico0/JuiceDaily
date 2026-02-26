// ─────────────────────────────────────────────────────────────
// MockScanner.tsx — Expo Go-friendly mock scan flow
// Simulates capture → loading → results → log/scan again/done.
// Works without native camera module.
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { X, Camera, Scan, Check, RotateCcw, ArrowLeft } from 'lucide-react-native'
import { saveJuiceLogEntry } from '../../lib/storage'
import type { JuiceLogEntry } from '../../lib/storage'

const { width: SCREEN_W } = Dimensions.get('window')
const FRAME_SIZE = SCREEN_W * 0.72

const MOCK_RESULTS = [
  { name: 'Carrot', nutrient: 'Vitamin A' },
  { name: 'Spinach', nutrient: 'Iron' },
  { name: 'Ginger', nutrient: 'Anti-inflammatory' },
]

type ScanPhase = 'ready' | 'scanning' | 'results'

export default function MockScanner() {
  const router = useRouter()
  const [phase, setPhase] = useState<ScanPhase>('ready')
  const [isSaving, setIsSaving] = useState(false)

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.replace('/(tabs)/home')
  }, [router])

  const handleCapture = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    setPhase('scanning')
    setTimeout(() => setPhase('results'), 600)
  }, [])

  const handleAddToLog = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    const entry: JuiceLogEntry = {
      id: Date.now().toString(36),
      timestamp: new Date().toISOString(),
      ingredients: MOCK_RESULTS,
      nutrients: MOCK_RESULTS.map(r => r.nutrient),
    }
    await saveJuiceLogEntry(entry)
    setIsSaving(false)
    router.replace('/(tabs)/home')
  }, [isSaving, router])

  const handleScanAgain = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setPhase('ready')
  }, [])

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <X size={24} color="#F0F6FC" strokeWidth={2} />
          </Pressable>
          <Text style={styles.topTitle}>Scan Produce</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Content area */}
        {phase === 'ready' && (
          <View style={styles.frameContainer}>
            <View style={styles.frame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <Scan size={28} color="rgba(129, 199, 132, 0.4)" strokeWidth={1.5} />
              <Text style={styles.frameHint}>Position produce in frame</Text>
              <Text style={styles.mockLabel}>Mock Scanner (Expo Go)</Text>
            </View>
          </View>
        )}

        {phase === 'scanning' && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#81C784" />
            <Text style={styles.scanningText}>Analyzing produce...</Text>
          </View>
        )}

        {phase === 'results' && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Detected Produce</Text>
            {MOCK_RESULTS.map((item, i) => (
              <View key={i} style={styles.resultRow}>
                <View style={styles.resultDot} />
                <View style={styles.resultContent}>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultNutrient}>{item.nutrient}</Text>
                </View>
              </View>
            ))}

            <View style={styles.resultActions}>
              <Pressable
                style={({ pressed }) => [styles.primaryAction, pressed && { opacity: 0.85 }]}
                onPress={handleAddToLog}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Add to today's log"
              >
                <Check size={18} color="#fff" strokeWidth={2.5} />
                <Text style={styles.primaryActionText}>
                  {isSaving ? 'Saving...' : "Add to Today's Log"}
                </Text>
              </Pressable>

              <View style={styles.secondaryActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.6 }]}
                  onPress={handleScanAgain}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Scan again"
                >
                  <RotateCcw size={16} color="#81C784" strokeWidth={2} />
                  <Text style={styles.secondaryActionText}>Scan Again</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.6 }]}
                  onPress={handleClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Done, return to dashboard"
                >
                  <ArrowLeft size={16} color="rgba(240,246,252,0.5)" strokeWidth={2} />
                  <Text style={styles.secondaryActionText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Bottom — Capture button (only in ready phase) */}
        {phase === 'ready' && (
          <View style={styles.bottomBar}>
            <Pressable
              style={({ pressed }) => [styles.captureButton, pressed && { opacity: 0.8 }]}
              onPress={handleCapture}
              accessibilityRole="button"
              accessibilityLabel="Capture photo"
            >
              <View style={styles.captureInner}>
                <Camera size={28} color="#0D1117" strokeWidth={2.5} />
              </View>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  )
}

const CORNER_SIZE = 24
const CORNER_WIDTH = 3

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E14',
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#F0F6FC',
  },

  // Frame
  frameContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  frameHint: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(240,246,252,0.35)',
  },
  mockLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(129, 199, 132, 0.4)',
    marginTop: 8,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: '#81C784',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: '#81C784',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: '#81C784',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: '#81C784',
    borderBottomRightRadius: 4,
  },

  // Scanning
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  scanningText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(240,246,252,0.6)',
  },

  // Results
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0F6FC',
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#81C784',
  },
  resultContent: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F0F6FC',
  },
  resultNutrient: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(240,246,252,0.45)',
  },
  resultActions: {
    marginTop: 20,
    gap: 12,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#43A047',
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(240,246,252,0.6)',
  },

  // Capture
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 24,
  },
  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F0F6FC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(129, 199, 132, 0.4)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F6FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
