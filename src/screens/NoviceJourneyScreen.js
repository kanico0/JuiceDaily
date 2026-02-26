// ─────────────────────────────────────────────────────────────
// NoviceJourneyScreen.js — 5-screen Novice Journey
// Progressive disclosure with exact PRD verbiage
// ─────────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft, ChevronRight, CheckCircle, Lock, BookOpen, Award, Sparkles,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import SafetyFooter from '../components/SafetyFooter'
import { useEducation } from '../services/EducationStore'
import { NOVICE_SCREENS, TOTAL_JOURNEY_XP, BEGINNER_BADGE } from '../constants/educationContent'
import { useFormatWeight } from '../utils/weightFormat'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

// ── Enzyme Comparison Visual (Screen 3) ──────────────────────
function EnzymeComparison({ comparison }) {
  return (
    <View style={cs.wrap}>
      <Text style={cs.title}>Enzyme Retention Comparison</Text>
      {[comparison.coldPress, comparison.centrifugal].map((bar) => (
        <View key={bar.label} style={cs.barRow}>
          <Text style={cs.barLabel}>{bar.label}</Text>
          <View style={cs.barTrack}>
            <View style={[cs.barFill, { width: `${bar.value}%`, backgroundColor: bar.color }]} />
          </View>
          <Text style={[cs.barValue, { color: bar.color }]}>{bar.value}%</Text>
        </View>
      ))}
      <View style={cs.diff}>
        <Text style={cs.diffText}>
          Cold-pressed retains <Text style={cs.diffBold}>3x more enzymes</Text> than centrifugal
        </Text>
      </View>
    </View>
  )
}

// ── Stat Card ────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <View style={ss.card}>
      <Text style={ss.value}>{value}</Text>
      <Text style={ss.label}>{label}</Text>
    </View>
  )
}

// ── Cumulative Dashboard (Screen 5) ──────────────────────────
function CumulativeDashboard({ metrics }) {
  const { fmtLbs } = useFormatWeight()
  const totalWeightG = (metrics.totalLbsJuiced || 0) * 453.592
  const stats = [
    { icon: '🧃', value: metrics.totalJuices, label: 'Juices Logged' },
    { icon: '🥬', value: fmtLbs(totalWeightG), label: 'Total Produce' },
    { icon: '🍊', value: Math.round(metrics.totalVitC), label: 'Vitamin C (mg)' },
  ]
  return (
    <View style={ds.wrap}>
      <Text style={ds.headerTitle}>📊 Your Cumulative Progress</Text>
      <Text style={ds.subtitle}>These numbers never reset. No streaks. No shame. Just progress.</Text>
      <View style={ds.grid}>
        {stats.map((s) => (
          <View key={s.label} style={ds.stat}>
            <Text style={ds.statIcon}>{s.icon}</Text>
            <Text style={ds.statValue}>{s.value}</Text>
            <Text style={ds.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ── Badge Unlock ─────────────────────────────────────────────
function BadgeUnlock() {
  return (
    <View style={bs.wrap}>
      <Text style={bs.emoji}>{BEGINNER_BADGE.emoji}</Text>
      <Text style={bs.title}>Badge Unlocked!</Text>
      <Text style={bs.name}>{BEGINNER_BADGE.name}</Text>
      <Text style={bs.desc}>{BEGINNER_BADGE.desc}</Text>
      <View style={bs.tag}>
        <Sparkles size={12} color="#FFB74D" />
        <Text style={bs.tagText}>Reboot Recipe Library unlocked!</Text>
      </View>
    </View>
  )
}

// ── Screen List Item ─────────────────────────────────────────
function ScreenListItem({ screen, isCompleted, isUnlocked, isCurrent, onPress }) {
  return (
    <TouchableOpacity
      style={[st.item, isCurrent && st.itemCurrent, isCompleted && st.itemDone, !isUnlocked && st.itemLocked]}
      onPress={() => isUnlocked && onPress(screen)}
      activeOpacity={isUnlocked ? 0.7 : 1}
    >
      <View style={st.left}>
        <View style={[st.num, isCompleted && st.numDone, isCurrent && st.numCurrent]}>
          {isCompleted ? <CheckCircle size={14} color="#81C784" />
            : !isUnlocked ? <Lock size={12} color="#484F58" />
            : <Text style={[st.numText, isCurrent && st.numTextCurrent]}>{screen.index + 1}</Text>}
        </View>
        <View style={st.info}>
          <Text style={[st.title, !isUnlocked && st.titleLocked]}>{screen.headline}</Text>
          <Text style={st.xp}>+{screen.xp} XP</Text>
        </View>
      </View>
      {isUnlocked && !isCompleted && <ChevronRight size={16} color="#484F58" />}
    </TouchableOpacity>
  )
}

// ── Main Screen ──────────────────────────────────────────────
export default function NoviceJourneyScreen({ navigation }) {
  const education = useEducation()
  const [activeScreen, setActiveScreen] = useState(null)
  const scrollRef = useRef(null)

  const handlePress = useCallback((screen) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActiveScreen(screen)
  }, [])

  const handleMarkRead = useCallback(() => {
    if (!activeScreen) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    education.completeScreen(activeScreen.id, activeScreen.index)
  }, [activeScreen, education])

  const handleNext = useCallback(() => {
    if (!activeScreen) return
    if (!education.isScreenCompleted(activeScreen.id)) {
      education.completeScreen(activeScreen.id, activeScreen.index)
    }
    const next = activeScreen.index + 1
    if (next < NOVICE_SCREENS.length) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
      setActiveScreen(NOVICE_SCREENS[next])
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    } else {
      handleBack()
    }
  }, [activeScreen, education])

  const handleBack = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
    setActiveScreen(null)
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])

  const pct = Math.round(education.journeyProgress * 100)

  return (
    <View style={m.root}>
      <MeshGradientBg />
      <SafeAreaView style={m.safe}>
        <View style={m.header}>
          <TouchableOpacity style={m.backBtn} onPress={() => activeScreen ? handleBack() : navigation.goBack()} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#C9D1D9" />
          </TouchableOpacity>
          <View style={m.headerCenter}>
            <BookOpen size={16} color="#81C784" />
            <Text style={m.headerTitle} numberOfLines={1}>{activeScreen ? activeScreen.headline : 'Novice Journey'}</Text>
          </View>
          <View style={m.xpBadge}>
            <Sparkles size={10} color="#FFD54F" />
            <Text style={m.xpText}>{education.knowledgeXP} XP</Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} style={m.scroll} contentContainerStyle={m.content} showsVerticalScrollIndicator={false}>
          {!activeScreen && (
            <>
              <View style={m.hero}>
                <Text style={m.heroEmoji}>🧠</Text>
                <Text style={m.heroTitle}>Juice Smarter</Text>
                <Text style={m.heroSub}>5 bite-sized lessons backed by science.{'\n'}Complete all to earn your first badge.</Text>
              </View>
              <View style={m.progWrap}>
                <View style={m.progBg}><View style={[m.progFill, { width: `${pct}%` }]} /></View>
                <Text style={m.progText}>{pct}% complete • {education.knowledgeXP}/{TOTAL_JOURNEY_XP} XP</Text>
              </View>
              {NOVICE_SCREENS.map((scr) => {
                const done = education.isScreenCompleted(scr.id)
                const unlocked = education.isScreenUnlocked(scr.index)
                const current = unlocked && !done && (scr.index === 0 || education.isScreenCompleted(NOVICE_SCREENS[scr.index - 1].id))
                return <ScreenListItem key={scr.id} screen={scr} isCompleted={done} isUnlocked={unlocked} isCurrent={current} onPress={handlePress} />
              })}
              {education.journeyComplete && <BadgeUnlock />}
              <SafetyFooter />
            </>
          )}

          {activeScreen && (
            <>
              <View style={m.activeHero}>
                <Text style={{ fontSize: 48 }}>{activeScreen.emoji}</Text>
                <Text style={m.activeHL}>{activeScreen.headline}</Text>
                <View style={m.activeXP}><Sparkles size={10} color="#FFD54F" /><Text style={m.activeXPT}>+{activeScreen.xp} XP</Text></View>
              </View>
              <Text style={m.script}>{activeScreen.script}</Text>
              {activeScreen.stats?.map((s, i) => <StatCard key={i} value={s.value} label={s.label} />)}
              {activeScreen.comparison && <EnzymeComparison comparison={activeScreen.comparison} />}
              {activeScreen.showCumulativeDashboard && <CumulativeDashboard metrics={education.metrics} />}
              <View style={m.actionRow}>
                {!education.isScreenCompleted(activeScreen.id) ? (
                  <TouchableOpacity style={m.markBtn} onPress={handleMarkRead} activeOpacity={0.7}>
                    <CheckCircle size={16} color="#060D0A" /><Text style={m.markBtnT}>Mark as Read</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={m.doneTag}><CheckCircle size={14} color="#81C784" /><Text style={m.doneTagT}>Completed</Text></View>
                )}
              </View>
              <View style={m.navRow}>
                <TouchableOpacity style={m.navBtn} onPress={handleBack} activeOpacity={0.7}>
                  <Text style={m.navBtnT}>All Lessons</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[m.navBtn, m.navBtnP]} onPress={handleNext} activeOpacity={0.7}>
                  <Text style={m.navBtnTP}>{activeScreen.index < NOVICE_SCREENS.length - 1 ? 'Next' : 'Finish'}</Text>
                  {activeScreen.index < NOVICE_SCREENS.length - 1 ? <ChevronRight size={16} color="#060D0A" /> : <Award size={16} color="#060D0A" />}
                </TouchableOpacity>
              </View>
              <SafetyFooter />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────
const m = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D0A' },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  xpBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,215,79,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,215,79,0.2)' },
  xpText: { fontSize: 11, fontWeight: '800', color: '#FFD54F' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 24, marginBottom: 12 },
  heroEmoji: { fontSize: 48, marginBottom: 10 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', marginBottom: 6 },
  heroSub: { fontSize: 14, color: '#8B949E', textAlign: 'center', lineHeight: 20 },
  progWrap: { marginBottom: 20 },
  progBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 6 },
  progFill: { height: 6, borderRadius: 3, backgroundColor: '#81C784' },
  progText: { fontSize: 11, color: '#484F58', textAlign: 'center' },
  activeHero: { alignItems: 'center', paddingVertical: 20, marginBottom: 8 },
  activeHL: { fontSize: 22, fontWeight: '900', color: '#FFF', marginTop: 8, textAlign: 'center' },
  activeXP: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: 'rgba(255,215,79,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 24 },
  activeXPT: { fontSize: 11, fontWeight: '700', color: '#FFD54F' },
  script: { fontSize: 16, color: '#C9D1D9', lineHeight: 26, marginBottom: 16 },
  actionRow: { alignItems: 'center', marginTop: 20, marginBottom: 12 },
  markBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#81C784', borderRadius: 24, paddingVertical: 14, paddingHorizontal: 28 },
  markBtnT: { fontSize: 15, fontWeight: '700', color: '#060D0A' },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(129,199,132,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  doneTagT: { fontSize: 13, fontWeight: '700', color: '#81C784' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  navBtnP: { backgroundColor: '#81C784', borderColor: '#81C784' },
  navBtnT: { fontSize: 14, fontWeight: '700', color: '#8B949E' },
  navBtnTP: { fontSize: 14, fontWeight: '700', color: '#060D0A' },
})

const cs = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 24, padding: 20, marginTop: 16, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  title: { fontSize: 12, fontWeight: '800', color: '#484F58', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  barLabel: { width: 90, fontSize: 12, fontWeight: '600', color: '#8B949E' },
  barTrack: { flex: 1, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  barFill: { height: 20, borderRadius: 10 },
  barValue: { width: 40, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  diff: { marginTop: 10, backgroundColor: 'rgba(129,199,132,0.06)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 0.5, borderColor: 'rgba(129,199,132,0.15)' },
  diffText: { fontSize: 12, color: '#A5D6A7', textAlign: 'center' },
  diffBold: { fontWeight: '800', color: '#81C784' },
})

const ss = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: 'rgba(100,181,246,0.06)', borderRadius: 24, paddingVertical: 20, paddingHorizontal: 16, marginTop: 12, borderWidth: 0.5, borderColor: 'rgba(100,181,246,0.15)' },
  value: { fontSize: 36, fontWeight: '900', color: '#64B5F6' },
  label: { fontSize: 13, color: '#8B949E', textAlign: 'center', marginTop: 6, lineHeight: 18 },
})

const ds = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(206,147,216,0.06)', borderRadius: 24, padding: 20, marginTop: 16, borderWidth: 0.5, borderColor: 'rgba(206,147,216,0.15)' },
  headerTitle: { fontSize: 14, fontWeight: '800', color: '#CE93D8', marginBottom: 4 },
  subtitle: { fontSize: 12, color: '#8B949E', marginBottom: 16, lineHeight: 18 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 4 },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '900', color: '#FFF' },
  statLabel: { fontSize: 10, color: '#8B949E', fontWeight: '600', textAlign: 'center', marginTop: 2 },
})

const bs = StyleSheet.create({
  wrap: { alignItems: 'center', backgroundColor: 'rgba(255,215,79,0.06)', borderRadius: 24, padding: 24, marginTop: 20, borderWidth: 0.5, borderColor: 'rgba(255,215,79,0.2)' },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 11, fontWeight: '800', color: '#FFD54F', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  desc: { fontSize: 13, color: '#8B949E', textAlign: 'center', marginBottom: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,183,77,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,183,77,0.2)' },
  tagText: { fontSize: 12, fontWeight: '700', color: '#FFB74D' },
})

const st = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 16, marginBottom: 8, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)' },
  itemCurrent: { borderColor: 'rgba(100,181,246,0.3)', backgroundColor: 'rgba(100,181,246,0.04)' },
  itemDone: { borderColor: 'rgba(129,199,132,0.15)', backgroundColor: 'rgba(129,199,132,0.03)' },
  itemLocked: { opacity: 0.4 },
  left: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  num: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  numDone: { backgroundColor: 'rgba(129,199,132,0.12)' },
  numCurrent: { backgroundColor: 'rgba(100,181,246,0.12)' },
  numText: { fontSize: 14, fontWeight: '700', color: '#8B949E' },
  numTextCurrent: { color: '#64B5F6' },
  info: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#C9D1D9', marginBottom: 2 },
  titleLocked: { color: '#484F58' },
  xp: { fontSize: 11, color: '#484F58', fontWeight: '600' },
})
