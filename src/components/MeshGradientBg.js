// ─────────────────────────────────────────────────────────────
// MeshGradientBg.js — Calm Premium Vitality atmospheric background
// Deep forest base, soft sage depth, restrained warm amber
// highlight, gentle vignette. Static — no animation, no timers.
// Android-safe: LinearGradient layers only. Memoized.
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { StyleSheet, View, Dimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SEMANTIC_ATMOSPHERIC } from '../constants/tokens'

const { width: W, height: H } = Dimensions.get('window')

function MeshGradientBg() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base — deep forest green */}
      <LinearGradient
        colors={[
          SEMANTIC_ATMOSPHERIC.backgroundBase,
          SEMANTIC_ATMOSPHERIC.backgroundDepth,
          SEMANTIC_ATMOSPHERIC.backgroundBase,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Sage depth — upper-left soft glow */}
      <LinearGradient
        colors={[
          SEMANTIC_ATMOSPHERIC.atmosphericSage,
          'transparent',
        ]}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.7, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Warm amber — very restrained, lower-right */}
      <LinearGradient
        colors={[
          'transparent',
          SEMANTIC_ATMOSPHERIC.atmosphericWarm,
        ]}
        start={{ x: 0.3, y: 0.4 }}
        end={{ x: 0.85, y: 0.95 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Cool depth — center subtle */}
      <LinearGradient
        colors={[
          'transparent',
          SEMANTIC_ATMOSPHERIC.atmosphericCool,
          'transparent',
        ]}
        start={{ x: 0.5, y: 0.3 }}
        end={{ x: 0.5, y: 0.8 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Atmospheric highlight — faint top light */}
      <LinearGradient
        colors={[
          SEMANTIC_ATMOSPHERIC.atmosphericHighlight,
          'transparent',
        ]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 0.3 }}
        style={styles.specular}
      />

      {/* Bottom vignette — darkens lower edge for depth */}
      <LinearGradient
        colors={['transparent', SEMANTIC_ATMOSPHERIC.backgroundVignette]}
        start={{ x: 0.5, y: 0.4 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Side vignettes — subtle edge darkening */}
      <View style={styles.vignetteLeft} />
      <View style={styles.vignetteRight} />
    </View>
  )
}

const styles = StyleSheet.create({
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: H * 0.3,
  },
  vignetteLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: W * 0.12,
    backgroundColor: 'rgba(3,7,5,0.2)',
  },
  vignetteRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: W * 0.12,
    backgroundColor: 'rgba(3,7,5,0.2)',
  },
})

export default React.memo(MeshGradientBg)
