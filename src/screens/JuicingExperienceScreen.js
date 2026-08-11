import React, { useCallback } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, Sparkles, BookOpen, Zap } from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import GlassSurface from '../components/GlassSurface'
import { BRAND, FONT_SIZE, FONT_WEIGHT, SPACE, RADIUS } from '../constants/tokens'

export default function JuicingExperienceScreen({ navigation, onSelect }) {
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    navigation.goBack()
  }, [navigation])

  const handleSelect = useCallback((value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSelect(value)
  }, [onSelect])

  return (
    <View style={s.root}>
      <MeshGradientBg />
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={20} color={BRAND.text.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.content}>
          <Text style={s.title}>Where are you on your juicing journey?</Text>
          <Text style={s.subtitle}>Choose the level of guidance that feels right for you. There is no wrong answer, and you can change it anytime.</Text>

          <View style={s.cardList}>
            <Pressable
              onPress={() => handleSelect('new')}
              style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="New to Juicing — Help me get started"
            >
              <GlassSurface style={s.card} borderRadius={RADIUS.xl}>
                <View style={s.cardIconWrap}>
                  <Sparkles size={18} color={BRAND.accent.vitaminC} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>New to Juicing</Text>
                  <Text style={s.cardDesc}>Start with simple blends, familiar produce, and step-by-step guidance.</Text>
                  <Text style={s.cardCta}>Help Me Get Started</Text>
                </View>
              </GlassSurface>
            </Pressable>

            <Pressable
              onPress={() => handleSelect('casual')}
              style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Casual Juicer — Keep it simple"
            >
              <GlassSurface style={s.card} borderRadius={RADIUS.xl}>
                <View style={s.cardIconWrap}>
                  <BookOpen size={18} color={BRAND.accent.chlorophyll} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Casual Juicer</Text>
                  <Text style={s.cardDesc}>Get practical ideas and helpful nutrition insights for your everyday routine.</Text>
                  <Text style={s.cardCta}>Keep It Simple</Text>
                </View>
              </GlassSurface>
            </Pressable>

            <Pressable
              onPress={() => handleSelect('experienced')}
              style={({ pressed }) => [s.cardPress, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel="Experienced Juicer — Show me more"
            >
              <GlassSurface style={s.card} borderRadius={RADIUS.xl}>
                <View style={s.cardIconWrap}>
                  <Zap size={18} color={BRAND.accent.potassium} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>Experienced Juicer</Text>
                  <Text style={s.cardDesc}>Explore expanded ingredient blends, broader produce variety, and more detailed nutrition guidance.</Text>
                  <Text style={s.cardCta}>Show Me More</Text>
                </View>
              </GlassSurface>
            </Pressable>
          </View>

          <Text style={s.note}>You can change your mind anytime in Settings.</Text>
        </View>
      </SafeAreaView>
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xl,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.heavy,
    color: BRAND.text.primary,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    marginBottom: SPACE.xl,
  },
  cardList: {
    gap: SPACE.md,
  },
  cardPress: {
    borderRadius: RADIUS.xl,
  },
  card: {
    padding: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(240, 246, 252, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.text.primary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: BRAND.text.muted,
    lineHeight: 20,
    marginBottom: 6,
  },
  cardCta: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: BRAND.accent.vitaminC,
  },
  note: {
    marginTop: SPACE.xl,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: 'rgba(240, 246, 252, 0.35)',
  },
})
