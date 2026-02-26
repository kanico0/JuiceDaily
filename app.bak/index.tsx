// ─────────────────────────────────────────────────────────────
// app/index.tsx — Entry gate / redirect
// Reads onboardingComplete from AsyncStorage, then replaces
// to /onboarding (first launch) or /home (returning user).
// Shows a minimal loading state to prevent flicker.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { getOnboardingComplete } from '../lib/onboarding'

export default function EntryGate() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    getOnboardingComplete().then((done) => {
      if (!mounted) return
      if (done) {
        router.replace('/(tabs)/home')
      } else {
        router.replace('/onboarding')
      }
      setIsChecking(false)
    })
    return () => { mounted = false }
  }, [])

  if (!isChecking) return null

  return (
    <View style={styles.root}>
      <ActivityIndicator size="small" color="#81C784" />
      {/* PROOF MARKER — remove after confirming Expo Router boots */}
      <Text style={styles.proof}>ROUTER BOOT OK</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proof: {
    color: '#81C784',
    fontSize: 12,
    marginTop: 12,
    fontWeight: '600',
  },
})
