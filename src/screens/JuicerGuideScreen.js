// ─────────────────────────────────────────────────────────────
// JuicerGuideScreen.js — Juicer Buyer's Guide
// Renders the existing guide data from src/data/juicers.ts
// (source: JuiceReferences.md "2025 Juicer Comparison and
// Purchase Guide").
// ─────────────────────────────────────────────────────────────

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { ArrowLeft, Cog, ExternalLink, Lightbulb } from 'lucide-react-native'
import { JUICERS, BUYER_INSIGHTS } from '../data/juicers'

const TYPE_LABELS = {
  masticating: { label: 'Cold-Press (Masticating)', color: '#81C784' },
  centrifugal: { label: 'Centrifugal', color: '#FFB74D' },
}

function JuicerCard ({ juicer }) {
  const typeMeta = TYPE_LABELS[juicer.type]
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{juicer.name}</Text>
        <Text style={styles.cardPrice}>{juicer.priceRange}</Text>
      </View>
      <View style={styles.typeRow}>
        <Cog size={12} color={typeMeta.color} />
        <Text style={[styles.typeText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
      </View>
      <Text style={styles.cardSummary}>{juicer.summary}</Text>
      {juicer.keyStrengths.map((s) => (
        <Text key={s} style={styles.strength}>{'\u2022'} {s}</Text>
      ))}
      <Text style={styles.idealUser}>Best for: {juicer.idealUser}</Text>
      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          Linking.openURL(juicer.affiliateLink).catch(() => {})
        }}
        activeOpacity={0.7}
      >
        <ExternalLink size={13} color='#64B5F6' />
        <Text style={styles.linkText}>View at {juicer.affiliateLink.replace('https://', '')}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function JuicerGuideScreen ({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color='#E6EDF3' />
        </TouchableOpacity>
        <Text style={styles.title}>Juicer Buyer's Guide</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Selecting the right equipment is critical for nutrient retention and
          operational ease. Below are the top-rated models for 2025.
        </Text>

        {JUICERS.map((j) => (
          <JuicerCard key={j.id} juicer={j} />
        ))}

        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Lightbulb size={14} color='#FFD54F' />
            <Text style={styles.insightsTitle}>Consumer Insights (2025 Testing)</Text>
          </View>
          {BUYER_INSIGHTS.map((tip) => (
            <Text key={tip} style={styles.insightText}>{'\u2022'} {tip}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  title: {
    color: '#E6EDF3',
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  intro: {
    color: '#8B949E',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    color: '#E6EDF3',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  cardPrice: {
    color: '#81C784',
    fontSize: 14,
    fontWeight: '700',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardSummary: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  strength: {
    color: '#C9D1D9',
    fontSize: 12,
    lineHeight: 18,
  },
  idealUser: {
    color: '#8B949E',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  linkText: {
    color: '#64B5F6',
    fontSize: 12,
    fontWeight: '600',
  },
  insightsCard: {
    backgroundColor: '#161B22',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#2D2A1F',
  },
  insightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  insightsTitle: {
    color: '#FFD54F',
    fontSize: 13,
    fontWeight: '700',
  },
  insightText: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
})
