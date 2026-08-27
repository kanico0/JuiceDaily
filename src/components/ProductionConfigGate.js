// ─────────────────────────────────────────────────────────────
// ProductionConfigGate.js — Blocking recovery screen shown when
// a production binary is missing required configuration.
//
// This is a BUILD CONFIGURATION FAILURE, not a temporary service
// outage. The app must not continue into normal operation.
//
// Customer-facing copy avoids technical terminology (no mention
// of Supabase, RevenueCat, API keys, or environment variables).
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { validateProductionConfig, isProductionBuild } from '../services/subscriptions/productionConfig'
import {
  CONFIG_GATE_TITLE,
  CONFIG_GATE_BODY,
  CONFIG_GATE_CHECK_UPDATE,
  CONFIG_GATE_CHECK_AGAIN,
} from '../services/subscriptions/authCopy'

export default function ProductionConfigGate () {
  const [result, setResult] = useState(() => validateProductionConfig(isProductionBuild()))

  const handleCheckAgain = useCallback(() => {
    setResult(validateProductionConfig(isProductionBuild()))
  }, [])

  const handleCheckForUpdate = useCallback(() => {
    if (Platform.OS === 'android') {
      Linking.openURL('market://details?id=com.rawlifeflow.juicingdaily').catch(() => {
        Linking.openURL('https://play.google.com/store/apps/details?id=com.rawlifeflow.juicingdaily').catch(() => {})
      })
    } else {
      Linking.openURL('https://play.google.com/store/apps/details?id=com.rawlifeflow.juicingdaily').catch(() => {})
    }
  }, [])

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠</Text>
        </View>

        <Text style={styles.title}>{CONFIG_GATE_TITLE}</Text>

        <Text style={styles.body}>
          {CONFIG_GATE_BODY}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleCheckForUpdate}
            activeOpacity={0.7}
          >
            <Text style={styles.primaryBtnText}>{CONFIG_GATE_CHECK_UPDATE}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleCheckAgain}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryBtnText}>{CONFIG_GATE_CHECK_AGAIN}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(248, 81, 73, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
    color: '#F85149',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#E6EDF3',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: '#8B949E',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 320,
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: '#81C784',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D1117',
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#30363D',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8B949E',
  },
})
