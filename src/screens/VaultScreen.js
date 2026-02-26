// ─────────────────────────────────────────────────────────────
// VaultScreen.js — IAP Store ("The Vault")
// Subscription tiers, Freezer Pass Packs, Snap Packs,
// Boutique Recipe Packs
// ─────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  Crown,
  Snowflake,
  Camera,
  ChefHat,
  Check,
  Zap,
  BarChart3,
  Infinity,
  Star,
  Lock,
} from 'lucide-react-native'
import {
  SUBSCRIPTION_PLANS,
  IAP_PACKS,
  PRO_FEATURES,
  usePro,
} from '../services/ProStore'
import MeshGradientBg from '../components/MeshGradientBg'

const PLAN_KEYS = ['monthly', 'annual', 'lifetime']

const PRO_PERKS = [
  { icon: <Camera size={16} color="#64B5F6" />, text: 'Unlimited AI Snaps' },
  { icon: <BarChart3 size={16} color="#81C784" />, text: 'Weekly Vitality Reports' },
  { icon: <ChefHat size={16} color="#FFB74D" />, text: 'Pro Recipe Categories' },
  { icon: <Zap size={16} color="#FFD54F" />, text: 'Advanced Nutrient Data' },
  { icon: <Infinity size={16} color="#CE93D8" />, text: 'Monthly Vitality Wraps' },
]

// ── Section Header ──────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      {icon}
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  )
}

// ── Pack Card ───────────────────────────────────────────────

function PackCard({ pack, onBuy, isPurchased }) {
  return (
    <TouchableOpacity
      style={[styles.packCard, isPurchased && styles.packCardPurchased]}
      onPress={() => {
        if (!isPurchased) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          onBuy(pack)
        }
      }}
      activeOpacity={isPurchased ? 1 : 0.7}
    >
      <Text style={styles.packEmoji}>{pack.emoji}</Text>
      <View style={styles.packInfo}>
        <Text style={styles.packLabel}>{pack.label}</Text>
        <Text style={styles.packDesc}>{pack.description}</Text>
      </View>
      {isPurchased ? (
        <View style={styles.purchasedBadge}>
          <Check size={14} color="#81C784" />
          <Text style={styles.purchasedText}>Owned</Text>
        </View>
      ) : (
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{pack.price}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Main Screen ──────────────────────────────────────────────

export default function VaultScreen({ navigation }) {
  const {
    pro, isPro, subscribe, buySnapPack, buyFreezerPack,
    buyRecipePack, hasRecipePack, snapInfo,
  } = usePro()
  const [selectedPlan, setSelectedPlan] = useState('annual')
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(fadeAnim, {
      toValue: 1,
      damping: 15,
      stiffness: 100,
      useNativeDriver: true,
    }).start()
  }, [])

  const handleSubscribe = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    subscribe(selectedPlan)
  }

  const handleBuyPack = (pack) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    if (pack.type === 'freezer') buyFreezerPack(pack.quantity)
    else if (pack.type === 'snap') buySnapPack()
    else if (pack.type === 'recipe_pack') buyRecipePack(pack.id)
  }

  return (
    <View style={styles.root}>
      <MeshGradientBg />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>The Vault</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* ═══ PRO STATUS ═══════════════════════════════════ */}
            {isPro && (
              <View style={styles.proStatusCard}>
                <LinearGradient
                  colors={['rgba(255,213,79,0.12)', 'rgba(129,199,132,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.proStatusGradient}
                >
                  <Crown size={24} color="#FFD54F" />
                  <View style={styles.proStatusInfo}>
                    <Text style={styles.proStatusTitle}>Architect Pro</Text>
                    <Text style={styles.proStatusDesc}>
                      {pro.subscriptionPlan === 'lifetime'
                        ? 'Lifetime access — yours forever'
                        : `${pro.subscriptionPlan === 'annual' ? 'Annual' : 'Monthly'} plan active`}
                    </Text>
                  </View>
                  <Check size={20} color="#81C784" />
                </LinearGradient>
              </View>
            )}

            {/* ═══ SUBSCRIPTION TIERS ═══════════════════════════ */}
            {!isPro && (
              <>
                <SectionHeader
                  icon={<Crown size={20} color="#FFD54F" />}
                  title="Architect Pro"
                  subtitle="Unlock the full experience"
                />

                {/* Perks list */}
                <View style={styles.perksCard}>
                  {PRO_PERKS.map((perk, i) => (
                    <View key={i} style={styles.perkRow}>
                      {perk.icon}
                      <Text style={styles.perkText}>{perk.text}</Text>
                      <Check size={14} color="#81C784" />
                    </View>
                  ))}
                </View>

                {/* Plan cards */}
                <View style={styles.planRow}>
                  {PLAN_KEYS.map((key) => {
                    const plan = SUBSCRIPTION_PLANS[key]
                    const isSelected = selectedPlan === key
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.planCard, isSelected && styles.planCardSelected]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                          setSelectedPlan(key)
                        }}
                        activeOpacity={0.7}
                      >
                        {plan.badge && (
                          <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>{plan.badge}</Text>
                          </View>
                        )}
                        <Text style={[styles.planLabel, isSelected && styles.planLabelSelected]}>
                          {plan.label}
                        </Text>
                        <Text style={[styles.planPrice, isSelected && styles.planPriceSelected]}>
                          {plan.price}
                        </Text>
                        <Text style={styles.planPeriod}>{plan.period}</Text>
                        {plan.savings && (
                          <Text style={styles.planSavings}>{plan.savings}</Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>

                {/* Subscribe CTA */}
                <TouchableOpacity
                  style={styles.subscribeCta}
                  onPress={handleSubscribe}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#4CAF50', '#2E7D32']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.subscribeCtaGradient}
                  >
                    <Crown size={18} color="#FFFFFF" />
                    <Text style={styles.subscribeCtaText}>
                      Unlock Pro — {SUBSCRIPTION_PLANS[selectedPlan].price}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.legalText}>
                  Cancel anytime. Restore purchases available in Settings.
                </Text>
              </>
            )}

            {/* ═══ CONSUMABLE PACKS ════════════════════════════ */}
            <SectionHeader
              icon={<Snowflake size={20} color="#64B5F6" />}
              title="Power-Ups"
              subtitle="One-time purchases"
            />

            <View style={styles.packsGrid}>
              <PackCard
                pack={IAP_PACKS.freezer_3}
                onBuy={handleBuyPack}
                isPurchased={false}
              />
              <PackCard
                pack={IAP_PACKS.snap_10}
                onBuy={handleBuyPack}
                isPurchased={false}
              />
            </View>

            {/* Snap balance indicator */}
            <View style={styles.snapBalanceCard}>
              <Camera size={16} color="#64B5F6" />
              <Text style={styles.snapBalanceText}>
                AI Snaps: <Text style={styles.snapBalanceValue}>{snapInfo.label}</Text>
              </Text>
            </View>

            {/* ═══ BOUTIQUE RECIPE PACKS ═══════════════════════ */}
            <SectionHeader
              icon={<ChefHat size={20} color="#FFB74D" />}
              title="Boutique Recipes"
              subtitle="Curated juice protocols"
            />

            <View style={styles.packsGrid}>
              <PackCard
                pack={IAP_PACKS.recipe_reset}
                onBuy={handleBuyPack}
                isPurchased={hasRecipePack(IAP_PACKS.recipe_reset.id)}
              />
              <PackCard
                pack={IAP_PACKS.recipe_glow}
                onBuy={handleBuyPack}
                isPurchased={hasRecipePack(IAP_PACKS.recipe_glow.id)}
              />
              <PackCard
                pack={IAP_PACKS.recipe_energy}
                onBuy={handleBuyPack}
                isPurchased={hasRecipePack(IAP_PACKS.recipe_energy.id)}
              />
            </View>

            <View style={{ height: 40 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ── Styles ───────────────────────────────────────────────────

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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },

  // Pro Status
  proStatusCard: {
    marginBottom: 20,
    borderRadius: 28,
    overflow: 'hidden',
  },
  proStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,213,79,0.15)',
  },
  proStatusInfo: { flex: 1 },
  proStatusTitle: { fontSize: 18, fontWeight: '900', color: '#FFD54F' },
  proStatusDesc: { fontSize: 12, color: '#8B949E', marginTop: 2 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  sectionSubtitle: { fontSize: 12, color: '#484F58', marginTop: 1 },

  // Perks
  perksCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    gap: 10,
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  perkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#C9D1D9',
  },

  // Plan cards
  planRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 14,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: 'rgba(129,199,132,0.3)',
    backgroundColor: 'rgba(129,199,132,0.06)',
  },
  planBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: '#FFD54F',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 24,
  },
  planBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0D1117',
    letterSpacing: 0.5,
  },
  planLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B949E',
    marginTop: 4,
  },
  planLabelSelected: { color: '#FFFFFF' },
  planPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#C9D1D9',
    marginTop: 4,
  },
  planPriceSelected: { color: '#FFFFFF' },
  planPeriod: {
    fontSize: 10,
    color: '#484F58',
    marginTop: 2,
  },
  planSavings: {
    fontSize: 10,
    fontWeight: '800',
    color: '#81C784',
    marginTop: 4,
  },

  // Subscribe CTA
  subscribeCta: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#2D6A4F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  subscribeCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  subscribeCtaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  legalText: {
    fontSize: 11,
    color: '#484F58',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Pack cards
  packsGrid: {
    gap: 10,
    marginBottom: 16,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  packCardPurchased: {
    borderColor: 'rgba(129,199,132,0.2)',
    backgroundColor: 'rgba(129,199,132,0.04)',
  },
  packEmoji: { fontSize: 28 },
  packInfo: { flex: 1 },
  packLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  packDesc: { fontSize: 12, color: '#8B949E', marginTop: 2 },
  priceTag: {
    backgroundColor: 'rgba(129,199,132,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.2)',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#81C784',
  },
  purchasedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 24,
    backgroundColor: 'rgba(129,199,132,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(129,199,132,0.12)',
  },
  purchasedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#81C784',
  },

  // Snap balance
  snapBalanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(100,181,246,0.04)',
    borderRadius: 24,
    padding: 14,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.1)',
  },
  snapBalanceText: {
    fontSize: 13,
    color: '#8B949E',
    fontWeight: '600',
  },
  snapBalanceValue: {
    color: '#64B5F6',
    fontWeight: '800',
  },
})
