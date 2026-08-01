import React, { useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  LayoutAnimation, Platform, UIManager,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft, ChevronRight, CheckCircle, Award,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import SafetyFooter from '../components/SafetyFooter'
import { getLesson } from '../constants/lessonContent'
import { CommonActions } from '@react-navigation/native'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

export default function LessonScreen({ route, navigation }) {
  const { level, isReplay = false } = route.params || {}
  const lesson = getLesson(level)
  const [currentIndex, setCurrentIndex] = useState(0)
  const scrollRef = useRef(null)

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (isReplay) {
      navigation.goBack()
    } else {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        })
      )
    }
  }, [navigation, isReplay])

  const handleNext = useCallback(() => {
    if (!lesson) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    const next = currentIndex + 1
    if (next < lesson.sections.length) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
      setCurrentIndex(next)
      scrollRef.current?.scrollTo({ y: 0, animated: true })
    } else {
      handleBack()
    }
  }, [currentIndex, lesson, handleBack])

  if (!lesson) {
    return (
      <View style={styles.root}>
        <MeshGradientBg />
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <Text style={styles.errorText}>Lesson not found.</Text>
            <TouchableOpacity onPress={handleBack} style={styles.errorBtn}>
              <Text style={styles.errorBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    )
  }

  const section = lesson.sections[currentIndex]
  const isLast = currentIndex === lesson.sections.length - 1
  const pct = Math.round(((currentIndex + 1) / lesson.sections.length) * 100)

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color="#C9D1D9" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEmoji}>{lesson.emoji}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
          </View>
          <View style={styles.progressBadge}>
            <Text style={styles.progressText}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.progressBarWrap}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: lesson.accentColor }]} />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          accessibilityRole="summary"
        >
          <View style={styles.sectionHero}>
            <Text style={styles.sectionEmoji}>{lesson.emoji}</Text>
            <Text
              style={styles.sectionHeadline}
              accessibilityRole="header"
            >
              {section.headline}
            </Text>
          </View>

          <Text style={styles.sectionBody}>{section.body}</Text>

          <View style={styles.sectionDots}>
            {lesson.sections.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex && { backgroundColor: lesson.accentColor },
                  i < currentIndex && { backgroundColor: 'rgba(129,199,132,0.4)' },
                ]}
              />
            ))}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navBtnSecondary}
              onPress={handleBack}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close lesson"
            >
              <Text style={styles.navBtnSecondaryText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navBtnPrimary, { backgroundColor: lesson.accentColor }]}
              onPress={handleNext}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Finish lesson' : 'Next section'}
            >
              <Text style={styles.navBtnPrimaryText}>
                {isLast ? 'Finish' : 'Next'}
              </Text>
              {isLast
                ? <Award size={16} color="#060D0A" />
                : <ChevronRight size={16} color="#060D0A" />}
            </TouchableOpacity>
          </View>

          <SafetyFooter />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060D0A' },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, marginHorizontal: 8,
  },
  headerEmoji: { fontSize: 18 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  progressBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 24,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  progressText: { fontSize: 11, fontWeight: '700', color: '#8B949E' },
  progressBarWrap: { paddingHorizontal: 20, marginBottom: 4 },
  progressBarBg: {
    height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressBarFill: { height: 4, borderRadius: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  sectionHero: { alignItems: 'center', paddingVertical: 16, marginBottom: 8 },
  sectionEmoji: { fontSize: 44, marginBottom: 10 },
  sectionHeadline: {
    fontSize: 22, fontWeight: '900', color: '#FFF',
    textAlign: 'center', lineHeight: 28,
  },
  sectionBody: {
    fontSize: 16, color: '#C9D1D9', lineHeight: 26, marginBottom: 20,
  },
  sectionDots: {
    flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  navRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  navBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  navBtnSecondaryText: { fontSize: 14, fontWeight: '700', color: '#8B949E' },
  navBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 24,
  },
  navBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#060D0A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#8B949E', marginBottom: 16 },
  errorBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorBtnText: { fontSize: 14, fontWeight: '700', color: '#C9D1D9' },
})
