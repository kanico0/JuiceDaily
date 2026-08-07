// ─────────────────────────────────────────────────────────────
// GlowJourneyDetail.js — Detail modal for Glow Journey Drop.
//
// Shows: streak, weekly days, weekly goal, lifetime days,
// current stage, progress to next stage, achievements.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native'
import { X } from 'lucide-react-native'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage, GLOW_JOURNEY_STAGES } from '../constants/glowJourneyStages'
import { ACHIEVEMENTS } from '../services/achievements'
import { buildGlowJourneyVisualState } from './GlowJourneyVisualState'
import GlowJourneyDropArtwork from './GlowJourneyDropArtwork'

function GlowJourneyDetail({
  visible,
  onClose,
  streakCount = 0,
  weeklyQualifyingDays = 0,
  lifetimeDays = 0,
  unlockedAchievementIds = [],
}) {
  const stage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const nextStage = useMemo(() => getNextStage(lifetimeDays), [lifetimeDays])
  const daysToNext = useMemo(() => getDaysToNextStage(lifetimeDays), [lifetimeDays])
  const { width: screenWidth } = useWindowDimensions()
  const detailDropSize = Math.min(screenWidth * 0.55, 280)

  const unlockedSet = useMemo(() => new Set(unlockedAchievementIds), [unlockedAchievementIds])
  const earnedAchievements = useMemo(
    () => ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)),
    [unlockedSet]
  )

  const detailVisualState = useMemo(() => buildGlowJourneyVisualState({
    lifetimeDays,
    weeklyQualifyingDays,
    weeklyLeafStates: [],
    streakCount,
  }), [lifetimeDays, weeklyQualifyingDays, streakCount])

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Glow Journey</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={SEMANTIC_COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* Redesigned Drop artwork */}
            <View style={styles.dropArtworkContainer}>
              <GlowJourneyDropArtwork
                visualState={detailVisualState}
                size={detailDropSize}
                isReduced={false}
              />
            </View>

            {/* How it works guidance */}
            <View style={styles.guidanceBanner}>
              <Text style={styles.guidanceTitle}>Your Glow Journey</Text>
              <Text style={styles.guidanceBody}>
                Each day you juice, your Glow Drop grows brighter. Build streaks by
                juicing on consecutive days, hit your weekly goal of {WEEKLY_GLOW_GOAL} days,
                and progress through lifetime stages — from First Drop to Radiant.
              </Text>
            </View>

            {/* Streak */}
            <DetailRow
              label="Glow Streak"
              value={streakCount > 0 ? `${streakCount} day${streakCount !== 1 ? 's' : ''}` : 'No active streak'}
            />

            {/* Weekly */}
            <DetailRow
              label="Weekly Juicing Days"
              value={`${weeklyQualifyingDays} of ${WEEKLY_GLOW_GOAL}`}
            />
            <DetailRow
              label="Weekly Goal"
              value={`${WEEKLY_GLOW_GOAL} juicing days per week`}
            />

            {/* Lifetime */}
            <DetailRow
              label="Lifetime Juicing Days"
              value={lifetimeDays > 0 ? `${lifetimeDays} days` : 'Not started'}
            />

            {/* Stage */}
            {stage ? (
              <>
                <DetailRow
                  label="Current Stage"
                  value={`${stage.emoji} ${stage.label}`}
                />
                {nextStage ? (
                  <DetailRow
                    label="Next Stage"
                    value={`${daysToNext} day${daysToNext !== 1 ? 's' : ''} to ${nextStage.label}`}
                  />
                ) : (
                  <DetailRow
                    label="Next Stage"
                    value="Highest stage reached"
                  />
                )}

                {/* Stage progress bar */}
                <View style={styles.progressSection}>
                  <Text style={styles.progressLabel}>Journey Progress</Text>
                  <View style={styles.progressBar}>
                    {GLOW_JOURNEY_STAGES.map((s) => {
                      const isCurrent = s.key === stage.key
                      const isPassed = lifetimeDays > s.max
                      return (
                        <View
                          key={s.key}
                          style={[
                            styles.progressSegment,
                            {
                              backgroundColor: isPassed
                                ? SEMANTIC_COLORS.success
                                : isCurrent
                                  ? SEMANTIC_COLORS.success
                                  : 'rgba(255,255,255,0.06)',
                              opacity: isPassed ? 0.6 : isCurrent ? 1 : 0.4,
                            },
                          ]}
                        />
                      )
                    })}
                  </View>
                  <View style={styles.stageLabelsRow}>
                    {GLOW_JOURNEY_STAGES.map((s) => (
                      <Text
                        key={s.key}
                        style={[
                          styles.stageLabelSmall,
                          { color: s.key === stage.key ? SEMANTIC_COLORS.textPrimary : SEMANTIC_COLORS.textMuted },
                        ]}
                      >
                        {s.label}
                      </Text>
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <Text style={styles.emptyText}>Your journey starts with your first juice</Text>
            )}

            {/* Achievements */}
            {earnedAchievements.length > 0 && (
              <View style={styles.achievementsSection}>
                <Text style={styles.sectionHeader}>Recently Earned</Text>
                {earnedAchievements.map((ach) => (
                  <View key={ach.id} style={styles.achievementRow}>
                    <Text style={styles.achievementEmoji}>{ach.emoji}</Text>
                    <View>
                      <Text style={styles.achievementTitle}>{ach.title}</Text>
                      <Text style={styles.achievementSubtitle}>{ach.subtitle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: SEMANTIC_COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: SEMANTIC_COLORS.surfaceElevated,
    borderTopLeftRadius: SEMANTIC_RADIUS.xl,
    borderTopRightRadius: SEMANTIC_RADIUS.xl,
    padding: SEMANTIC_SPACE.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SEMANTIC_SPACE.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: SEMANTIC_COLORS.textPrimary,
  },
  scroll: {
    maxHeight: '70%',
  },
  dropArtworkContainer: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  guidanceBanner: {
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.large,
    paddingHorizontal: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.md,
  },
  guidanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 4,
  },
  guidanceBody: {
    fontSize: 13,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 19,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: SEMANTIC_COLORS.borderSubtle,
  },
  detailLabel: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textPrimary,
  },
  progressSection: {
    marginTop: 16,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textMuted,
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressSegment: {
    flex: 1,
    borderRadius: 3,
  },
  stageLabelsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  stageLabelSmall: {
    flex: 1,
    fontSize: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  achievementsSection: {
    marginTop: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: SEMANTIC_COLORS.textPrimary,
    marginBottom: 10,
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  achievementEmoji: {
    fontSize: 24,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textPrimary,
  },
  achievementSubtitle: {
    fontSize: 12,
    color: SEMANTIC_COLORS.textMuted,
  },
})

export default GlowJourneyDetail
