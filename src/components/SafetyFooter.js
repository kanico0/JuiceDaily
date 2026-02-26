// ─────────────────────────────────────────────────────────────
// SafetyFooter.js — Persistent legal disclaimer footer
// Displayed at the bottom of every educational page
// ─────────────────────────────────────────────────────────────

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SAFETY_FOOTER } from '../constants/educationContent'

export default function SafetyFooter() {
  return (
    <View style={styles.wrap}>
      <View style={styles.divider} />
      <View style={styles.content}>
        <Text style={styles.title}>{SAFETY_FOOTER.title}</Text>
        <Text style={styles.text}>{SAFETY_FOOTER.text}</Text>
        <Text style={styles.dataPoint}>{SAFETY_FOOTER.dataPoint}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 24,
    paddingTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  content: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 11,
    fontWeight: '800',
    color: '#484F58',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  text: {
    fontSize: 11,
    color: '#484F58',
    lineHeight: 17,
    marginBottom: 6,
  },
  dataPoint: {
    fontSize: 11,
    color: '#484F58',
    fontStyle: 'italic',
  },
})
