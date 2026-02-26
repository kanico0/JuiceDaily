// ─────────────────────────────────────────────────────────────
// GoalSelectionCard.js — Minimal goal selection UI
// 5 goal chips with accessible labels.
// Uses motion.js for subtle fade/scale, reduced-motion compliant.
// ─────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { DARK, RADIUS, SPACE, FONT_SIZE, FONT_WEIGHT } from '../constants/tokens'
import { useReducedMotion, DURATION, EASING } from '../utils/motion'

// ── Goal Definitions ─────────────────────────────────────────

const GOALS = [
  { id: 'energy', label: 'More Energy', emoji: '⚡', color: '#FFB74D' },
  { id: 'glow', label: 'Better Skin', emoji: '✨', color: '#CE93D8' },
  { id: 'immunity', label: 'Stronger Immunity', emoji: '🛡️', color: '#64B5F6' },
  { id: 'detox', label: 'Daily Detox', emoji: '🌿', color: '#81C784' },
  { id: 'explore', label: 'Just Exploring', emoji: '🧭', color: '#8B949E' },
]

// ── Goal Chip ────────────────────────────────────────────────

function GoalChip({ goal, index, selected, onSelect }) {
  const isReduced = useReducedMotion()
  const scaleAnim = useRef(new Animated.Value(0.85)).current
  const opacityAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const delay = isReduced ? 0 : index * 60
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: isReduced ? DURATION.crossfade : DURATION.enter,
          easing: isReduced ? EASING.linear : EASING.decelerate,
          useNativeDriver: true,
        }),
        ...(isReduced ? [] : [
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: DURATION.enter,
            easing: EASING.decelerate,
            useNativeDriver: true,
          }),
        ]),
      ]).start()
    }, delay)
    return () => clearTimeout(timer)
  }, [isReduced, index])

  // Set scale to 1 immediately for reduced motion
  useEffect(() => {
    if (isReduced) scaleAnim.setValue(1)
  }, [isReduced])

  const isSelected = selected === goal.id

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onSelect(goal.id)
  }, [goal.id, onSelect])

  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          chipStyles.chip,
          isSelected && { borderColor: goal.color, backgroundColor: `${goal.color}15` },
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${goal.label} goal`}
      >
        <Text style={chipStyles.emoji}>{goal.emoji}</Text>
        <Text style={[
          chipStyles.label,
          isSelected && { color: goal.color, fontWeight: FONT_WEIGHT.bold },
        ]}>
          {goal.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  emoji: {
    fontSize: 18,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: DARK.textSecondary,
  },
})

// ── Main GoalSelectionCard ───────────────────────────────────

export default function GoalSelectionCard({ selectedGoal, onSelectGoal }) {
  const isReduced = useReducedMotion()
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: isReduced ? DURATION.crossfade : DURATION.enter,
      easing: isReduced ? EASING.linear : EASING.decelerate,
      useNativeDriver: true,
    }).start()
  }, [isReduced])

  return (
    <Animated.View style={[cardStyles.container, { opacity: fadeAnim }]}>
      <Text
        style={cardStyles.title}
        accessibilityRole="header"
      >
        What brings you to juicing?
      </Text>
      <Text style={cardStyles.subtitle}>
        Pick one — we will tailor your first recipe
      </Text>

      <View
        style={cardStyles.chipGrid}
        accessibilityRole="radiogroup"
        accessibilityLabel="Select your juicing goal"
      >
        {GOALS.map((goal, i) => (
          <GoalChip
            key={goal.id}
            goal={goal}
            index={i}
            selected={selectedGoal}
            onSelect={onSelectGoal}
          />
        ))}
      </View>
    </Animated.View>
  )
}

const cardStyles = StyleSheet.create({
  container: {
    paddingVertical: SPACE.lg,
  },
  title: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.heavy,
    color: DARK.textPrimary,
    textAlign: 'center',
    marginBottom: SPACE.xs,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: DARK.textSecondary,
    textAlign: 'center',
    marginBottom: SPACE.xl,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
})

export { GOALS }
