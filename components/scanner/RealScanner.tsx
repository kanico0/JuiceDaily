// ─────────────────────────────────────────────────────────────
// RealScanner.tsx — Real camera scanner (Dev Build only)
// Placeholder that gracefully falls back if camera isn't available.
// Will be wired to VisionCamera + Claude Vision later.
// ─────────────────────────────────────────────────────────────

import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { X, Camera, AlertTriangle } from 'lucide-react-native'

export default function RealScanner() {
  const router = useRouter()

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.replace('/(tabs)/home')
  }, [router])

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

        {/* Fallback content */}
        <View style={styles.centerContent}>
          <View style={styles.iconWrap}>
            <AlertTriangle size={36} color="#FFB74D" strokeWidth={1.5} />
          </View>
          <Text style={styles.fallbackTitle}>Camera Not Available</Text>
          <Text style={styles.fallbackText}>
            Real camera scanning is enabled, but this build{'\n'}
            may not support it. Install a Development Build{'\n'}
            to use the real camera scanner.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Go back to dashboard"
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0E14',
  },
  safe: {
    flex: 1,
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
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 183, 77, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 183, 77, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F0F6FC',
  },
  fallbackText: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(240,246,252,0.5)',
    textAlign: 'center',
    lineHeight: 22,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F0F6FC',
  },
})
