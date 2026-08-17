// ─────────────────────────────────────────────────────────────
// GlowJourneyDetail.js — Detail modal for Glow Journey Drop.
//
// Shows the SAME canonical GlowJourneyDropArtwork used on the
// Explore card, at a slightly larger size. Includes streak,
// weekly progress, current stage, and journey progress bar.
// ─────────────────────────────────────────────────────────────

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native'
import { X } from 'lucide-react-native'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS } from '../constants/tokens'
import { WEEKLY_GLOW_GOAL, getJourneyStage, getNextStage, getDaysToNextStage, GLOW_JOURNEY_STAGES } from '../constants/glowJourneyStages'
import { ACHIEVEMENTS } from '../services/achievements'
import { buildGlowJourneyVisualState } from './GlowJourneyVisualState'
import GlowJourneyDropArtwork from './GlowJourneyDropArtwork'

// Detail artwork sizing — slightly larger than Explore card (~105px)
// but compact enough to remain an accent, not a screen-dominating graphic.
const DETAIL_HERO_WIDTH = 135

function GlowJourneyDetail({
  visible,
  onClose,
  streakCount = 0,
  weeklyQualifyingDays = 0,
  weeklyLeafStates = [],
  lifetimeDays = 0,
  unlockedAchievementIds = [],
}) {
  const stage = useMemo(() => getJourneyStage(lifetimeDays), [lifetimeDays])
  const nextStage = useMemo(() => getNextStage(lifetimeDays), [lifetimeDays])
  const daysToNext = useMemo(() => getDaysToNextStage(lifetimeDays), [lifetimeDays])

  const unlockedSet = useMemo(() => new Set(unlockedAchievementIds), [unlockedAchievementIds])
  const earnedAchievements = useMemo(
    () => ACHIEVEMENTS.filter((a) => unlockedSet.has(a.id)),
    [unlockedSet]
  )

  const detailVisualState = useMemo(() => buildGlowJourneyVisualState({
    lifetimeDays,
    weeklyQualifyingDays,
    weeklyLeafStates,
    streakCount,
  }), [lifetimeDays, weeklyQualifyingDays, weeklyLeafStates, streakCount])

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Glow Journey</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={SEMANTIC_COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            {/* Canonical Glow artwork — same family as Explore card */}
            <View style={styles.artworkContainer}>
              <GlowJourneyDropArtwork
                visualState={detailVisualState}
                heroWidth={DETAIL_HERO_WIDTH}
                vineWidth={DETAIL_HERO_WIDTH}
                surfaceTranslateY={detailVisualState.heroState.surfaceY}
                isReduced={false}
              />
            </View>

            {/* Streak numeral + label */}
            <View style={styles.streakRow}>
              <Text style={styles.streakNumeral}>{streakCount}</Text>
              <View style={styles.streakLabelWrap}>
                <Text style={styles.streakLabel}>DAY GLOW</Text>
                <Text style={styles.streakLabel}>STREAK</Text>
              </View>
            </View>

            {/* Weekly progress */}
            <View style={styles.weeklyRow}>
              <Text style={styles.weeklyLabel}>This Week</Text>
              <Text style={styles.weeklyValue}>
                {weeklyQualifyingDays} of {WEEKLY_GLOW_GOAL} Glow Days
              </Text>
            </View>

            {/* Journey stage */}
            {stage ? (
              <View style={styles.journeyRow}>
                <Text style={styles.journeyStageName}>{stage.label}</Text>
                <Text style={styles.journeyDot}> · </Text>
                <Text style={styles.journeyText}>Lifetime Journey</Text>
              </View>
            ) : (
              <Text style={styles.emptyText}>Your journey starts with your first juice</Text>
            )}

            {/* How it works guidance */}
            <View style={styles.guidanceBanner}>
              <Text style={styles.guidanceBody}>
                Each day you juice, your Glow Drop grows brighter. Build streaks by
                juicing on consecutive days, hit your weekly goal of {WEEKLY_GLOW_GOAL} days,
                and progress through lifetime stages — from First Drop to Radiant.
              </Text>
            </View>

            {/* Stage progress bar */}
            {stage && (
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
                {nextStage && (
                  <Text style={styles.nextStageHint}>
                    {daysToNext} day{daysToNext !== 1 ? 's' : ''} to {nextStage.label}
                  </Text>
                )}
              </View>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#252B33',
    borderTopLeftRadius: SEMANTIC_RADIUS.xl,
    borderTopRightRadius: SEMANTIC_RADIUS.xl,
    padding: SEMANTIC_SPACE.lg,
    maxHeight: '82%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
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
    maxHeight: '78%',
  },
  artworkContainer: {
    alignItems: 'center',
    paddingVertical: SEMANTIC_SPACE.sm,
    marginBottom: SEMANTIC_SPACE.sm,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 9,
    marginBottom: 12,
  },
  streakNumeral: {
    fontSize: 34,
    fontWeight: '600',
    color: '#FFB74D',
  },
  streakLabelWrap: {
    flexDirection: 'column',
  },
  streakLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: SEMANTIC_COLORS.textMuted,
  },
  weeklyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: SEMANTIC_COLORS.borderSubtle,
    marginBottom: 8,
  },
  weeklyLabel: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
  },
  weeklyValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textPrimary,
  },
  journeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  journeyStageName: {
    fontSize: 14,
    fontWeight: '600',
    color: SEMANTIC_COLORS.textPrimary,
  },
  journeyDot: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textMuted,
  },
  journeyText: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
  },
  guidanceBanner: {
    backgroundColor: SEMANTIC_COLORS.surface,
    borderRadius: SEMANTIC_RADIUS.large,
    paddingHorizontal: SEMANTIC_SPACE.md,
    paddingVertical: SEMANTIC_SPACE.md,
    marginBottom: SEMANTIC_SPACE.md,
  },
  guidanceBody: {
    fontSize: 13,
    color: SEMANTIC_COLORS.textSecondary,
    lineHeight: 19,
  },
  progressSection: {
    marginTop: 4,
    marginBottom: 16,
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
  nextStageHint: {
    fontSize: 12,
    color: SEMANTIC_COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: SEMANTIC_COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  achievementsSection: {
    marginTop: 12,
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
