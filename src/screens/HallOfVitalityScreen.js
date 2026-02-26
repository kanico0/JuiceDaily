// ─────────────────────────────────────────────────────────────
// HallOfVitalityScreen.js — Badge & Rewards trophy cabinet
// Glassmorphism style, rank header, badge grid with locked/
// unlocked states, popover card, haptic celebration
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, Lock, Award } from 'lucide-react-native'
import { useChallenge } from '../services/ChallengeStore'
import MeshGradientBg from '../components/MeshGradientBg'
import {
  computeLevel,
  getRank,
  getNextRank,
  BADGE_CATEGORIES,
  evaluateBadges,
} from '../constants/badgeData'

// ── Rank Header ──────────────────────────────────────────────

function RankHeader({ challenge }) {
  const { level, xpInLevel, xpToNext } = computeLevel(challenge)
  const rank = getRank(level)
  const nextRank = getNextRank(level)
  const fillAnim = useRef(new Animated.Value(0)).current
  const progress = xpToNext > 0 ? xpInLevel / xpToNext : 1

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start()
  }, [progress])

  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  })

  return (
    <View style={styles.rankCard}>
      <LinearGradient
        colors={['rgba(22,27,34,0.9)', 'rgba(22,27,34,0.6)']}
        style={styles.rankGradient}
      >
        <Text style={styles.rankIcon}>{rank.icon}</Text>
        <Text style={[styles.rankTitle, { color: rank.color }]}>{rank.title}</Text>
        <Text style={styles.rankLevel}>Level {level}</Text>

        {/* Progress bar */}
        <View style={styles.rankBarOuter}>
          <Animated.View
            style={[styles.rankBarFill, { width: fillWidth, backgroundColor: rank.color }]}
          />
        </View>

        <View style={styles.rankBarLabels}>
          <Text style={styles.rankXp}>{xpInLevel} / {xpToNext} XP</Text>
          {nextRank && (
            <Text style={[styles.rankNext, { color: nextRank.color }]}>
              Next: {nextRank.icon} {nextRank.title}
            </Text>
          )}
        </View>
      </LinearGradient>
    </View>
  )
}

// ── Badge Cell ───────────────────────────────────────────────

function BadgeCell({ badge, onPress, isNew }) {
  const sheenAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (badge.isUnlocked) {
      Animated.loop(
        Animated.timing(sheenAnim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        })
      ).start()
    }
  }, [badge.isUnlocked])

  useEffect(() => {
    if (isNew) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        { iterations: 5 }
      ).start()
    }
  }, [isNew])

  const sheenTranslate = sheenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80],
  })

  const isSecret = badge.isSecret && !badge.isUnlocked

  return (
    <TouchableOpacity
      style={styles.badgeCell}
      onPress={() => onPress(badge)}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.badgeCircle,
          badge.isUnlocked
            ? styles.badgeUnlocked
            : styles.badgeLocked,
          isNew && { transform: [{ scale: pulseAnim }] },
        ]}
      >
        {badge.isUnlocked && (
          <Animated.View
            style={[
              styles.badgeSheen,
              { transform: [{ translateX: sheenTranslate }] },
            ]}
          />
        )}
        <Text style={[
          styles.badgeIcon,
          !badge.isUnlocked && styles.badgeIconLocked,
        ]}>
          {isSecret ? '❓' : badge.icon}
        </Text>
        {!badge.isUnlocked && !isSecret && (
          <View style={styles.badgeLockOverlay}>
            <Lock size={12} color="#484F58" />
          </View>
        )}
      </Animated.View>
      <Text
        style={[styles.badgeName, !badge.isUnlocked && styles.badgeNameLocked]}
        numberOfLines={2}
      >
        {isSecret ? '???' : badge.name}
      </Text>
    </TouchableOpacity>
  )
}

// ── Badge Popover ────────────────────────────────────────────

function BadgePopover({ badge, visible, onClose }) {
  if (!badge) return null
  const isSecret = badge.isSecret && !badge.isUnlocked

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.popoverOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.popoverCard}>
          <Text style={styles.popoverIcon}>
            {isSecret ? '❓' : badge.icon}
          </Text>
          <Text style={styles.popoverName}>
            {isSecret ? 'Secret Badge' : badge.name}
          </Text>

          {badge.isUnlocked && (
            <View style={styles.popoverUnlockedTag}>
              <Award size={12} color="#81C784" />
              <Text style={styles.popoverUnlockedText}>Unlocked</Text>
            </View>
          )}

          <Text style={styles.popoverDesc}>
            {isSecret ? 'Keep juicing to discover this hidden achievement...' : badge.description}
          </Text>

          {badge.isUnlocked && (
            <Text style={styles.popoverFlavor}>"{badge.flavorText}"</Text>
          )}

          {!badge.isUnlocked && !isSecret && (
            <View style={styles.popoverHowTo}>
              <Text style={styles.popoverHowToLabel}>How to unlock:</Text>
              <Text style={styles.popoverHowToText}>{badge.description}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function HallOfVitalityScreen({ navigation, route }) {
  const { challenge } = useChallenge()
  const badges = useMemo(() => evaluateBadges(challenge), [challenge])
  const [selectedBadge, setSelectedBadge] = useState(null)
  const newBadgeId = route?.params?.newBadgeId || null

  // Haptic celebration for new badge
  useEffect(() => {
    if (newBadgeId) {
      const fireworks = async () => {
        for (let i = 0; i < 4; i++) {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          await new Promise((r) => setTimeout(r, 150))
        }
      }
      fireworks()
    }
  }, [newBadgeId])

  const handleBadgePress = (badge) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedBadge(badge)
  }

  // Group badges by category
  const grouped = useMemo(() => {
    const map = {}
    for (const cat of BADGE_CATEGORIES) {
      map[cat.key] = badges.filter((b) => b.category === cat.key)
    }
    return map
  }, [badges])

  const unlockedCount = badges.filter((b) => b.isUnlocked).length

  return (
    <View style={styles.rootWrap}>
    <MeshGradientBg />
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hall of Vitality</Text>
        <Text style={styles.headerCount}>{unlockedCount}/{badges.length}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <RankHeader challenge={challenge} />

        {BADGE_CATEGORIES.map((cat) => {
          const catBadges = grouped[cat.key]
          if (!catBadges || catBadges.length === 0) return null
          return (
            <View key={cat.key} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
                <Text style={styles.categoryCount}>
                  {catBadges.filter((b) => b.isUnlocked).length}/{catBadges.length}
                </Text>
              </View>
              <View style={styles.badgeGrid}>
                {catBadges.map((badge) => (
                  <BadgeCell
                    key={badge.id}
                    badge={badge}
                    onPress={handleBadgePress}
                    isNew={badge.id === newBadgeId}
                  />
                ))}
              </View>
            </View>
          )
        })}
      </ScrollView>

      <BadgePopover
        badge={selectedBadge}
        visible={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  rootWrap: { flex: 1, backgroundColor: '#060D0A' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerCount: { fontSize: 14, fontWeight: '700', color: '#484F58' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  // Rank
  rankCard: {
    borderRadius: 28, overflow: 'hidden', marginBottom: 24,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  rankGradient: {
    padding: 20, alignItems: 'center',
  },
  rankIcon: { fontSize: 40, marginBottom: 8 },
  rankTitle: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  rankLevel: { fontSize: 13, fontWeight: '600', color: '#8B949E', marginTop: 4 },
  rankBarOuter: {
    width: '100%', height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 16, overflow: 'hidden',
  },
  rankBarFill: { height: '100%', borderRadius: 4 },
  rankBarLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginTop: 6,
  },
  rankXp: { fontSize: 11, fontWeight: '700', color: '#484F58' },
  rankNext: { fontSize: 11, fontWeight: '700' },

  // Category
  categorySection: { marginBottom: 24 },
  categoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  categoryIcon: { fontSize: 16 },
  categoryLabel: {
    flex: 1, fontSize: 14, fontWeight: '800', color: '#C9D1D9',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  categoryCount: { fontSize: 12, fontWeight: '700', color: '#484F58' },

  // Badge Grid
  badgeGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  badgeCell: {
    width: '30%', alignItems: 'center',
  },
  badgeCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', position: 'relative',
  },
  badgeUnlocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(129,199,132,0.3)',
    shadowColor: '#81C784',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 12,
  },
  badgeLocked: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.4,
  },
  badgeSheen: {
    position: 'absolute', top: 0, bottom: 0, width: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ skewX: '-20deg' }],
  },
  badgeIcon: { fontSize: 28 },
  badgeIconLocked: { opacity: 0.3 },
  badgeLockOverlay: {
    position: 'absolute', bottom: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(13,17,23,0.9)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  badgeName: {
    fontSize: 11, fontWeight: '700', color: '#C9D1D9',
    textAlign: 'center', marginTop: 6,
  },
  badgeNameLocked: { color: '#484F58' },

  // Popover
  popoverOverlay: {
    flex: 1, backgroundColor: 'rgba(13,17,23,0.9)',
    justifyContent: 'center', padding: 32,
  },
  popoverCard: {
    backgroundColor: 'rgba(13,17,23,0.95)', borderRadius: 32, padding: 26,
    alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  popoverIcon: { fontSize: 48, marginBottom: 12 },
  popoverName: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', marginBottom: 8 },
  popoverUnlockedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(129,199,132,0.06)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 24,
    marginBottom: 12,
    borderWidth: 0.5, borderColor: 'rgba(129,199,132,0.12)',
  },
  popoverUnlockedText: { fontSize: 12, fontWeight: '700', color: '#81C784' },
  popoverDesc: {
    fontSize: 14, color: '#8B949E', textAlign: 'center', lineHeight: 20,
    marginBottom: 12,
  },
  popoverFlavor: {
    fontSize: 13, color: '#C9D1D9', textAlign: 'center',
    fontStyle: 'italic', lineHeight: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24,
  },
  popoverHowTo: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24,
    width: '100%',
  },
  popoverHowToLabel: {
    fontSize: 11, fontWeight: '800', color: '#484F58',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  popoverHowToText: { fontSize: 13, color: '#8B949E', lineHeight: 18 },
})
