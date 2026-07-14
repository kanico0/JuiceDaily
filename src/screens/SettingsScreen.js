// ─────────────────────────────────────────────────────────────
// SettingsScreen.js — "Preferences & Privacy"
// Notification Control Center with categorized toggles,
// Quiet Hours picker, Intensity slider, Ghost Mode
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  Platform,
  TextInput,
  Alert,
  Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import {
  ArrowLeft,
  Bell,
  Users,
  ChefHat,
  Moon,
  Shield,
  Info,
  Snowflake,
  Eye,
  EyeOff,
  HelpCircle,
  BookOpen,
  MessageCircle,
  FlaskConical,
  Sparkles,
  Crown,
} from 'lucide-react-native'
import MeshGradientBg from '../components/MeshGradientBg'
import {
  loadNotificationSettings,
  saveNotificationSettings,
} from '../services/NotificationService'
import { useFlags, DEFAULT_FLAGS } from '../services/FeatureFlags'
import { resetFirstLaunch } from '../components/FirstLaunchOrchestrator'
import { usePro } from '../services/ProStore'
import { useChallenge } from '../services/ChallengeStore'
import { useStreak } from '../services/StreakEngine'
import { useWeightUnit, WEIGHT_MODES } from '../utils/weightFormat'
import { useOrganicPref, ORGANIC_MODES } from '../utils/organicPreference'
import { useUserProfile, resetAllUserData } from '../services/UserProfileStore'
import { useActivation } from '../services/ActivationStore'
import { useNutritionScore } from '../services/NutritionScoreStore'
import { useJuiceLog } from '../services/JuiceLogStore'
import { useSubscription } from '../services/subscriptions/SubscriptionStore'
import { useQuota } from '../services/quota/QuotaStore'
import {
  selectPlanLabel,
  selectBillingStoreLabel,
  selectRenewalLabel,
  selectQuotaLabel,
  selectNextRefreshLabel,
} from '../services/subscriptions/subscriptionSelectors'
import { MONETIZATION_ENABLED, TERMS_URL, PRIVACY_URL } from '../services/subscriptions/subscriptionConfig'
import { advanceDevDay, getDevDayOffset, resetDevClock, getDevNow } from '../utils/DevClock'
import { resetGlowStreak } from '../services/glowStreak'
import { resetFocusForToday } from '../services/focusNutrient'
import { resetAchievements } from '../services/achievements'
import { resetWeeklySummary } from '../services/weeklySummary'
import { BUILD_TARGET } from '../utils/buildTarget'
import { clearState } from '../services/storage'
import { getNudgeSettings, setNudgeSettings, resetNudgeSettings } from '../services/NudgeSettingsStore'
import {
  ensurePermissions,
  refreshNudges,
  cancelAllNudges,
  sendTestNudge,
  setAndroidNotificationChannel,
} from '../services/NotificationNudges'

// ── Intensity Stops ──────────────────────────────────────────

const INTENSITY_STOPS = [
  { key: 'zen', label: 'Zen', desc: '1/day', color: '#64B5F6' },
  { key: 'balanced', label: 'Balanced', desc: '3/day', color: '#81C784' },
  { key: 'high-vibe', label: 'High-Vibe', desc: '5/day', color: '#FFB74D' },
]

// ── Custom Toggle ────────────────────────────────────────────

function EmeraldSwitch({ value, onValueChange, disabled }) {
  return (
    <Switch
      value={value}
      onValueChange={(v) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onValueChange(v)
      }}
      trackColor={{ false: '#21262D', true: 'rgba(129,199,132,0.4)' }}
      thumbColor={value ? '#81C784' : '#484F58'}
      ios_backgroundColor="#21262D"
      disabled={disabled}
    />
  )
}

// ── Time Picker (Simple Hour Selector) ───────────────────────

function TimePicker({ label, hour, minute, onChange }) {
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`

  const adjustHour = (delta) => {
    const newHour = (hour + delta + 24) % 24
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange({ hour: newHour, minute })
  }

  const adjustMinute = (delta) => {
    const newMinute = (minute + delta + 60) % 60
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange({ hour, minute: newMinute })
  }

  return (
    <View style={styles.timePicker}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeControls}>
        <TouchableOpacity onPress={() => adjustHour(-1)} style={styles.timeBtn}>
          <Text style={styles.timeBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.timeValue}>{timeStr}</Text>
        <TouchableOpacity onPress={() => adjustHour(1)} style={styles.timeBtn}>
          <Text style={styles.timeBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Nudge Time Picker (HH:MM string) ─────────────────────────

const COMMON_TIMES = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '12:00', '14:00', '16:00', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function NudgeTimePicker({ value, onChange }) {
  const [h, m] = (value || '08:30').split(':').map(Number)

  const adjustHour = (delta) => {
    const newH = (h + delta + 24) % 24
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }

  const adjustMinute = (delta) => {
    const step = delta > 0 ? 30 : -30
    let totalMin = h * 60 + m + step
    if (totalMin < 0) totalMin += 1440
    if (totalMin >= 1440) totalMin -= 1440
    const newH = Math.floor(totalMin / 60)
    const newM = totalMin % 60
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`)
  }

  return (
    <View style={styles.timeControls}>
      <TouchableOpacity onPress={() => adjustHour(-1)} style={styles.timeBtn} hitSlop={8}>
        <Text style={styles.timeBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={[styles.timeValue, { fontSize: 16, minWidth: 50 }]}>{value}</Text>
      <TouchableOpacity onPress={() => adjustHour(1)} style={styles.timeBtn} hitSlop={8}>
        <Text style={styles.timeBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Onboarding Tooltip ───────────────────────────────────────

function SmartSetupTooltip({ visible, onDismiss }) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 100,
        useNativeDriver: true,
      }).start()
    }
  }, [visible])

  if (!visible) return null

  return (
    <Animated.View style={[styles.tooltip, { opacity: fadeAnim }]}>
      <View style={styles.tooltipIcon}>
        <Info size={16} color="#FFD54F" />
      </View>
      <View style={styles.tooltipContent}>
        <Text style={styles.tooltipTitle}>Architect's Tip</Text>
        <Text style={styles.tooltipText}>
          We recommend 'Balanced' intensity to help you cement your 7-day habit. You can always change this later!
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={styles.tooltipClose}>
        <Text style={styles.tooltipCloseText}>Got it</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ── Section Header ───────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIconWrap}>{icon}</View>
      <View style={styles.sectionTitleWrap}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  )
}

// ── Subscription Section ─────────────────────────────────────
// Plan status, scan quota, manage/restore, legal links.

function SubscriptionSection({ navigation }) {
  const { state, isPro, restore, openManagement } = useSubscription()
  const { quota, refresh: refreshQuota } = useQuota()
  const [restoring, setRestoring] = useState(false)

  const planLabel = selectPlanLabel(state)
  const storeLabel = selectBillingStoreLabel(state)
  const renewalLabel = selectRenewalLabel(state)
  const quotaLabel = selectQuotaLabel(quota)
  const refreshLabel = selectNextRefreshLabel(quota)

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const outcome = await restore()
      if (outcome.status === 'restored') {
        await refreshQuota()
        Alert.alert('Purchases Restored', 'Your Pro subscription is active again.')
      } else if (outcome.status === 'no_purchases') {
        Alert.alert('No Purchases Found', 'We could not find a previous subscription for this account.')
      } else {
        Alert.alert('Restore Failed', 'Please try again later.')
      }
    } finally {
      setRestoring(false)
    }
  }

  const openLink = (url) => {
    if (url) Linking.openURL(url).catch(() => {})
  }

  return (
    <>
      <SectionHeader
        icon={<Crown size={18} color="#FFD54F" />}
        title="Subscription"
        subtitle={planLabel}
      />
      <View style={styles.settingsGroup}>
        <View style={styles.helpRow}>
          <View style={styles.helpInfo}>
            <Text style={styles.helpLabel}>Current plan: {planLabel}</Text>
            {renewalLabel ? <Text style={styles.helpDesc}>{renewalLabel}</Text> : null}
            {storeLabel ? <Text style={styles.helpDesc}>{storeLabel}</Text> : null}
            {quotaLabel ? <Text style={styles.helpDesc}>{quotaLabel}</Text> : null}
            {refreshLabel ? <Text style={styles.helpDesc}>Scans refresh on {refreshLabel}</Text> : null}
          </View>
        </View>

        {!isPro && (
          <TouchableOpacity
            style={styles.helpRow}
            onPress={() => navigation.navigate('Paywall', { source: 'settings' })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Pro"
          >
            <Sparkles size={16} color="#7EE787" />
            <View style={styles.helpInfo}>
              <Text style={styles.helpLabel}>Upgrade to Pro</Text>
              <Text style={styles.helpDesc}>60 AI scans per month, advanced reports & more</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>
        )}

        {isPro && state.managementUrl ? (
          <TouchableOpacity
            style={styles.helpRow}
            onPress={openManagement}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Manage subscription"
          >
            <View style={styles.helpInfo}>
              <Text style={styles.helpLabel}>Manage Subscription</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={styles.helpRow}
          onPress={handleRestore}
          disabled={restoring}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          <View style={styles.helpInfo}>
            <Text style={styles.helpLabel}>{restoring ? 'Restoring…' : 'Restore Purchases'}</Text>
          </View>
        </TouchableOpacity>

        {(TERMS_URL || PRIVACY_URL) && (
          <View style={[styles.helpRow, { justifyContent: 'center', gap: 24 }]}>
            {TERMS_URL ? (
              <TouchableOpacity onPress={() => openLink(TERMS_URL)} accessibilityRole="link">
                <Text style={styles.helpDesc}>Terms of Use</Text>
              </TouchableOpacity>
            ) : null}
            {PRIVACY_URL ? (
              <TouchableOpacity onPress={() => openLink(PRIVACY_URL)} accessibilityRole="link">
                <Text style={styles.helpDesc}>Privacy Policy</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </View>
    </>
  )
}

// ── Setting Row ──────────────────────────────────────────────

function SettingRow({ label, description, value, onValueChange, emergency, disabled }) {
  return (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, disabled && styles.settingLabelDisabled]}>{label}</Text>
        {description && (
          <Text style={styles.settingDesc}>{description}</Text>
        )}
        {emergency && (
          <View style={styles.emergencyTag}>
            <Snowflake size={10} color="#90CAF9" />
            <Text style={styles.emergencyText}>Bypasses quiet hours if streak is at risk</Text>
          </View>
        )}
      </View>
      <EmeraldSwitch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  )
}

// ── Main Screen ──────────────────────────────────────────────

// ── Flag display labels ──────────────────────────────────────

const FLAG_LABELS = {
  ff_today_hub: { label: 'Today Hub', phase: 'Foundation' },
  ff_3step_logger: { label: '3-Step Logger', phase: 'Foundation' },
  ff_reward_splash: { label: 'Reward Splash', phase: 'Foundation' },
  ff_smart_pantry: { label: 'Smart Pantry', phase: 'Differentiation' },
  ff_use_soon_cards: { label: 'Use-Soon Cards', phase: 'Differentiation' },
  ff_recipe_linking: { label: 'Recipe Linking', phase: 'Differentiation' },
  ff_templates: { label: 'Templates', phase: 'Premium' },
  ff_insights: { label: 'Weekly Insights', phase: 'Premium' },
  ff_streaks_grace: { label: 'Streak Grace', phase: 'Premium' },
  ff_social_challenges: { label: 'Social Challenges', phase: 'Premium' },
  ff_photo_draft: { label: 'Photo Draft', phase: 'Acceleration' },
  ff_ai_suggestions: { label: 'AI Suggestions', phase: 'Acceleration' },
  ff_liquid_motion_v2: { label: 'Liquid Motion v2', phase: 'Acceleration' },
  ff_first_launch_orchestrator: { label: 'First Launch Flow', phase: 'Emotional' },
  ff_emotional_copy: { label: 'Emotional Copy', phase: 'Emotional' },
  ff_reward_polish: { label: 'Reward Polish', phase: 'Emotional' },
  ff_streak_visual: { label: 'Streak Visual', phase: 'Emotional' },
  ff_pantry_ai_priority: { label: 'Pantry AI Priority', phase: 'Emotional' },
  ff_nutrient_halo_progress: { label: 'Nutrient Halo', phase: 'Halo' },
  ff_weekly_pillar_view: { label: 'Weekly Pillar View', phase: 'Halo' },
  ff_monthly_heatmap: { label: 'Monthly Heatmap', phase: 'Halo' },
  ff_liquid_surfaces: { label: 'Liquid Surfaces', phase: 'Liquid' },
  ff_liquid_background: { label: 'Liquid Background', phase: 'Liquid' },
  ff_liquid_motion: { label: 'Liquid Motion', phase: 'Liquid' },
  ff_juice_splash: { label: 'Juice Splash', phase: 'Liquid' },
  ff_juice_calculator: { label: 'Juice Calculator', phase: 'Calculator' },
  ff_progressive_unlock: { label: 'Progressive Unlock', phase: 'ScanFirst' },
  ff_optimize_tab: { label: 'Optimize Tab', phase: 'ScanFirst' },
  ff_scan_secondary_actions: { label: 'Scan Secondary Actions', phase: 'ScanFirst' },

  ff_expanded_recipes: { label: 'Expanded Recipes', phase: 'Dev' },
  ff_dev_disable_paywalls: { label: 'Disable Paywalls', phase: 'Dev' },
  ff_dev_force_paywalls: { label: 'Force Paywalls', phase: 'Dev' },
}

const PHASE_COLORS = {
  Foundation: '#81C784',
  Differentiation: '#64B5F6',
  Premium: '#CE93D8',
  Acceleration: '#FFB74D',
  Emotional: '#EF5350',
  Halo: '#FFD54F',
  Liquid: '#4DD0E1',
  Calculator: '#CE93D8',
  ScanFirst: '#4CAF50',
  Dev: '#FFD54F',
}

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showTooltip, setShowTooltip] = useState(false)
  const [isFirstVisit, setIsFirstVisit] = useState(false)
  const { flags, setFlag, resetAll } = useFlags()
  const { isPro, toggleDevPro } = usePro()
  const { challenge, devAdvanceDay, resetChallenge } = useChallenge()
  const streakCtx = useStreak()
  const { mode: weightMode, setMode: setWeightMode } = useWeightUnit()
  const { mode: organicMode, setMode: setOrganicMode } = useOrganicPref()
  const { profile, setName: setProfileName, resetProfile } = useUserProfile()
  const { resetScore } = useNutritionScore()
  const { activation, resetActivation } = useActivation()
  const { totalLogCount, resetLog } = useJuiceLog()
  const [profileNameInput, setProfileNameInput] = useState('')
  const [showDevFlags, setShowDevFlags] = useState(false)
  const [devClockOffset, setDevClockOffset] = useState(getDevDayOffset())
  const [nudgeSettings, setNudgeSettingsLocal] = useState(null)
  const [nudgePermDenied, setNudgePermDenied] = useState(false)

  const clearActivationStorage = useCallback(async () => {
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
      await AsyncStorage.removeItem('@juicing_activation_v1')
    } catch (e) {
      console.warn('[Settings] clearActivationStorage failed:', e)
    }
  }, [])

  // Load settings on mount
  useEffect(() => {
    loadNotificationSettings().then((s) => {
      setSettings(s)
      setIsLoading(false)
    })
    getNudgeSettings().then(setNudgeSettingsLocal)
  }, [])

  const updateNudgeSetting = useCallback(async (partial) => {
    const updated = await setNudgeSettings(partial)
    if (updated) {
      setNudgeSettingsLocal(updated)
      await refreshNudges()
    }
  }, [])

  const handleNudgeMasterToggle = useCallback(async (enabled) => {
    if (enabled) {
      const granted = await ensurePermissions()
      if (!granted) {
        setNudgePermDenied(true)
        return
      }
      setNudgePermDenied(false)
      await setAndroidNotificationChannel()
      await updateNudgeSetting({ nudges_enabled: true })
    } else {
      await cancelAllNudges()
      await updateNudgeSetting({ nudges_enabled: false })
    }
  }, [updateNudgeSetting])

  // Check first visit
  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage')
        const visited = await AsyncStorage.getItem('@settings_visited')
        if (!visited) {
          setIsFirstVisit(true)
          setShowTooltip(true)
          await AsyncStorage.setItem('@settings_visited', 'true')
        }
      } catch (e) { /* ignore */ }
    }
    checkFirstVisit()
  }, [])

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: value }
      saveNotificationSettings(updated)
      return updated
    })
  }, [])

  const handleTooltipDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setShowTooltip(false)
  }, [])

  if (isLoading || !settings) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.rootWrap}>
    <MeshGradientBg />
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences & Privacy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ ONBOARDING TOOLTIP ═══════════════════════════ */}
        <SmartSetupTooltip visible={showTooltip} onDismiss={handleTooltipDismiss} />

        {/* ═══ WEIGHT DISPLAY UNITS ═════════════════════════ */}
        <View style={styles.intensityCard}>
          <Text style={styles.intensityTitle}>Weight Display</Text>
          <View style={styles.intensityRow}>
            {WEIGHT_MODES.map((wm) => {
              const isActive = weightMode === wm.key
              const color = '#81C784'
              return (
                <TouchableOpacity
                  key={wm.key}
                  style={[
                    styles.intensityStop,
                    isActive && { borderColor: color, backgroundColor: `${color}15` },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setWeightMode(wm.key)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.intensityLabel,
                    isActive && { color },
                  ]}>
                    {wm.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ═══ ORGANIC PREFERENCE ═══════════════════════════ */}
        <View style={styles.intensityCard}>
          <Text style={styles.intensityTitle}>Organic Default</Text>
          <View style={styles.intensityRow}>
            {ORGANIC_MODES.map((om) => {
              const isActive = organicMode === om.key
              const color = '#81C784'
              return (
                <TouchableOpacity
                  key={om.key}
                  style={[
                    styles.intensityStop,
                    isActive && { borderColor: color, backgroundColor: `${color}15` },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setOrganicMode(om.key)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.intensityLabel,
                    isActive && { color },
                  ]}>
                    {om.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ═══ NOTIFICATION INTENSITY ═══════════════════════ */}
        <View style={styles.intensityCard}>
          <Text style={styles.intensityTitle}>Notification Intensity</Text>
          <View style={styles.intensityRow}>
            {INTENSITY_STOPS.map((stop) => {
              const isActive = settings.intensity === stop.key
              return (
                <TouchableOpacity
                  key={stop.key}
                  style={[
                    styles.intensityStop,
                    isActive && { borderColor: stop.color, backgroundColor: `${stop.color}15` },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    updateSetting('intensity', stop.key)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.intensityLabel,
                    isActive && { color: stop.color, fontWeight: '900' },
                  ]}>
                    {stop.label}
                  </Text>
                  <Text style={[
                    styles.intensityDesc,
                    isActive && { color: stop.color },
                  ]}>
                    {stop.desc}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* ═══ A. THE "PULSE" (Engagement) ═════════════════ */}
        <SectionHeader
          icon={<Bell size={18} color="#FFB74D" />}
          title="The Pulse"
          subtitle="Mindset & Progress"
        />

        <View style={styles.settingsGroup}>
          <SettingRow
            label="Daily Affirmations"
            description="Morning 'Wellness Architect' identity quotes"
            value={settings.affirmations}
            onValueChange={(v) => updateSetting('affirmations', v)}
          />
          <SettingRow
            label="Vitality Reminders"
            description="Alerts when rings are empty late in the day"
            value={settings.vitalityReminders}
            onValueChange={(v) => updateSetting('vitalityReminders', v)}
          />
          <SettingRow
            label="Freezer Pass Alerts"
            description="High-priority alerts to save your streak"
            value={settings.freezerAlerts}
            onValueChange={(v) => updateSetting('freezerAlerts', v)}
            emergency
          />
        </View>

        {/* ═══ B. THE "SOCIAL FEED" (Community) ════════════ */}
        <SectionHeader
          icon={<Users size={18} color="#CE93D8" />}
          title="The Social Feed"
          subtitle="Community"
        />

        <View style={styles.settingsGroup}>
          <SettingRow
            label="Glass Clinks"
            description="Get notified when friends toast your juices"
            value={settings.glassClinks}
            onValueChange={(v) => updateSetting('glassClinks', v)}
          />
          <SettingRow
            label="Weekly Leaderboard"
            description="How you rank in the community"
            value={settings.weeklyLeaderboard}
            onValueChange={(v) => updateSetting('weeklyLeaderboard', v)}
          />

          {/* Ghost Mode */}
          <View style={styles.ghostRow}>
            <View style={styles.ghostInfo}>
              <View style={styles.ghostIconRow}>
                {settings.privacyMode
                  ? <EyeOff size={16} color="#8B949E" />
                  : <Eye size={16} color="#81C784" />
                }
                <Text style={styles.ghostLabel}>Ghost Mode</Text>
              </View>
              <Text style={styles.ghostDesc}>
                Hide your vitality rings and rainbow status from the Juice Community feed
              </Text>
            </View>
            <EmeraldSwitch
              value={settings.privacyMode}
              onValueChange={(v) => updateSetting('privacyMode', v)}
            />
          </View>
        </View>

        {/* ═══ C. THE "KITCHEN" (Utility) ══════════════════ */}
        <SectionHeader
          icon={<ChefHat size={18} color="#81C784" />}
          title="The Kitchen"
          subtitle="Utility"
        />

        <View style={styles.settingsGroup}>
          <SettingRow
            label="Inventory Alerts"
            description="'Wilt Warnings' for produce in your Fridge Forager"
            value={settings.inventoryAlerts}
            onValueChange={(v) => updateSetting('inventoryAlerts', v)}
          />
          <SettingRow
            label="Shopping Reminders"
            description="What you need to complete your Weekly Rainbow"
            value={settings.shoppingReminders}
            onValueChange={(v) => updateSetting('shoppingReminders', v)}
          />
        </View>

        {/* ═══ QUIET HOURS ═════════════════════════════════ */}
        <SectionHeader
          icon={<Moon size={18} color="#90CAF9" />}
          title="My Resting Hours"
          subtitle="Do Not Disturb"
        />

        <View style={styles.quietCard}>
          <View style={styles.quietRow}>
            <TimePicker
              label="Sleep"
              hour={settings.quietStart.hour}
              minute={settings.quietStart.minute}
              onChange={(t) => updateSetting('quietStart', t)}
            />
            <View style={styles.quietDivider}>
              <Moon size={14} color="#484F58" />
            </View>
            <TimePicker
              label="Wake"
              hour={settings.quietEnd.hour}
              minute={settings.quietEnd.minute}
              onChange={(t) => updateSetting('quietEnd', t)}
            />
          </View>
          <View style={styles.quietNote}>
            <Shield size={12} color="#90CAF9" />
            <Text style={styles.quietNoteText}>
              All non-emergency notifications are silenced during this window.
              Freezer Pass alerts will bypass quiet hours if your streak is at risk.
            </Text>
          </View>
        </View>

        {/* ═══ MASTER SWITCH ═══════════════════════════════ */}
        <View style={styles.masterCard}>
          <View style={styles.masterInfo}>
            <Text style={styles.masterLabel}>All Notifications</Text>
            <Text style={styles.masterDesc}>
              Master switch for all push notifications
            </Text>
          </View>
          <EmeraldSwitch
            value={settings.enabled}
            onValueChange={(v) => updateSetting('enabled', v)}
          />
        </View>

        {/* ═══ MOTIVATION REMINDERS ═══════════════════════════ */}
        {nudgeSettings && (
          <>
            <SectionHeader
              icon={<Sparkles size={18} color="#81C784" />}
              title="Motivation Reminders"
              subtitle="Gentle nudges to keep your glow"
            />

            <View style={styles.settingsGroup}>
              {/* Master toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Motivation reminders</Text>
                  <Text style={styles.settingDesc}>
                    Daily, streak, and weekly nudges — never spammy
                  </Text>
                </View>
                <EmeraldSwitch
                  value={nudgeSettings.nudges_enabled}
                  onValueChange={handleNudgeMasterToggle}
                />
              </View>

              {/* Permission denied message */}
              {nudgePermDenied && (
                <View style={nudgeStyles.permDenied}>
                  <Text style={nudgeStyles.permDeniedText}>
                    Notifications are blocked. Please enable them in your device's Settings → Apps → JuicingApp → Notifications.
                  </Text>
                </View>
              )}

              {/* Sub-toggles (visible when master ON) */}
              {nudgeSettings.nudges_enabled && (
                <>
                  {/* Daily Glow Reminder */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Daily Glow Reminder</Text>
                      <Text style={styles.settingDesc}>
                        A gentle daily nudge to keep your glow going
                      </Text>
                    </View>
                    <EmeraldSwitch
                      value={nudgeSettings.nudges_daily_enabled}
                      onValueChange={(v) => updateNudgeSetting({ nudges_daily_enabled: v })}
                    />
                  </View>
                  {nudgeSettings.nudges_daily_enabled && (
                    <View style={nudgeStyles.timeRow}>
                      <Text style={nudgeStyles.timeLabel}>Time</Text>
                      <NudgeTimePicker
                        value={nudgeSettings.nudges_daily_time}
                        onChange={(t) => updateNudgeSetting({ nudges_daily_time: t })}
                      />
                    </View>
                  )}

                  {/* Streak Protector */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Streak Protector</Text>
                      <Text style={styles.settingDesc}>
                        If you haven't checked in by evening, we'll remind you
                      </Text>
                    </View>
                    <EmeraldSwitch
                      value={nudgeSettings.nudges_streakRisk_enabled}
                      onValueChange={(v) => updateNudgeSetting({ nudges_streakRisk_enabled: v })}
                    />
                  </View>
                  {nudgeSettings.nudges_streakRisk_enabled && (
                    <View style={nudgeStyles.timeRow}>
                      <Text style={nudgeStyles.timeLabel}>Remind at</Text>
                      <NudgeTimePicker
                        value={nudgeSettings.nudges_streakRisk_time}
                        onChange={(t) => updateNudgeSetting({ nudges_streakRisk_time: t })}
                      />
                    </View>
                  )}

                  {/* Weekly Glow Summary */}
                  <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>Weekly Glow Summary</Text>
                      <Text style={styles.settingDesc}>
                        A weekly recap of your progress
                      </Text>
                    </View>
                    <EmeraldSwitch
                      value={nudgeSettings.nudges_weekly_enabled}
                      onValueChange={(v) => updateNudgeSetting({ nudges_weekly_enabled: v })}
                    />
                  </View>
                  {nudgeSettings.nudges_weekly_enabled && (
                    <>
                      <View style={nudgeStyles.timeRow}>
                        <Text style={nudgeStyles.timeLabel}>Day</Text>
                        <View style={nudgeStyles.dayRow}>
                          {DAY_NAMES.map((name, i) => {
                            const isActive = nudgeSettings.nudges_weekly_day === i
                            return (
                              <TouchableOpacity
                                key={name}
                                style={[nudgeStyles.dayBtn, isActive && nudgeStyles.dayBtnActive]}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                                  updateNudgeSetting({ nudges_weekly_day: i })
                                }}
                                hitSlop={4}
                                activeOpacity={0.7}
                              >
                                <Text style={[nudgeStyles.dayText, isActive && nudgeStyles.dayTextActive]}>
                                  {name}
                                </Text>
                              </TouchableOpacity>
                            )
                          })}
                        </View>
                      </View>
                      <View style={nudgeStyles.timeRow}>
                        <Text style={nudgeStyles.timeLabel}>Time</Text>
                        <NudgeTimePicker
                          value={nudgeSettings.nudges_weekly_time}
                          onChange={(t) => updateNudgeSetting({ nudges_weekly_time: t })}
                        />
                      </View>
                    </>
                  )}

                  {/* Test notification button */}
                  <TouchableOpacity
                    style={nudgeStyles.testBtn}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                      const sent = await sendTestNudge()
                      Alert.alert(
                        sent ? 'Test Sent' : 'Failed',
                        sent ? 'You should see a notification in ~5 seconds.' : 'Could not schedule test notification.',
                      )
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={nudgeStyles.testBtnText}>Send test notification</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

        {/* ═══ HELP & SUPPORT ═════════════════════════════════ */}
        {MONETIZATION_ENABLED && (
          <SubscriptionSection navigation={navigation} />
        )}

        <SectionHeader
          icon={<HelpCircle size={18} color="#8B949E" />}
          title="Help & Support"
          subtitle="Learn the basics"
        />

        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.helpRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              navigation.navigate('NoviceJourney')
            }}
            activeOpacity={0.7}
          >
            <BookOpen size={16} color="#81C784" />
            <View style={styles.helpInfo}>
              <Text style={styles.helpLabel}>How to Juice</Text>
              <Text style={styles.helpDesc}>A beginner's guide to cold-pressed juicing</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.helpRow} activeOpacity={0.7}>
            <MessageCircle size={16} color="#90CAF9" />
            <View style={styles.helpInfo}>
              <Text style={styles.helpLabel}>App FAQ</Text>
              <Text style={styles.helpDesc}>Rings, streaks, Freezer Passes & more</Text>
            </View>
            <Text style={styles.helpArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* ═══ DEVELOPER FLAGS ═════════════════════════════ */}
        <SectionHeader
          icon={<FlaskConical size={18} color="#FFD54F" />}
          title="Developer Flags"
          subtitle="Toggle new features for testing"
        />

        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowDevFlags((v) => !v)
            }}
            activeOpacity={0.7}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {showDevFlags ? 'Hide' : 'Show'} Feature Flags
              </Text>
              <Text style={styles.settingDesc}>
                {Object.values(flags).filter(Boolean).length} of {Object.keys(DEFAULT_FLAGS).length} enabled
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: '#484F58' }}>{showDevFlags ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showDevFlags && (
            <>
              {/* Build Target Label */}
              <View style={devStyles.buildTargetRow}>
                <Text style={devStyles.buildTargetLabel}>Build target:</Text>
                <View style={[devStyles.buildTargetBadge, BUILD_TARGET === 'beta' && devStyles.buildTargetBadgeBeta]}>
                  <Text style={devStyles.buildTargetText}>{BUILD_TARGET.toUpperCase()}</Text>
                </View>
              </View>

              {/* Enable All / Reset All */}
              <View style={devStyles.bulkRow}>
                <TouchableOpacity
                  style={devStyles.bulkBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    Object.keys(DEFAULT_FLAGS).forEach((k) => setFlag(k, true))
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={devStyles.bulkBtnText}>Enable All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[devStyles.bulkBtn, devStyles.bulkBtnReset]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    resetAll()
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[devStyles.bulkBtnText, devStyles.bulkBtnResetText]}>Reset All</Text>
                </TouchableOpacity>
              </View>

              {/* Reset First Launch */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await resetFirstLaunch()
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset First Launch Flow</Text>
                <Text style={devStyles.resetLaunchHint}>Clears saved state — reopen app to see launcher</Text>
              </TouchableOpacity>

              {/* Reset Intro + Activation */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await clearActivationStorage()
                  resetActivation()
                  Alert.alert('Intro Reset', 'introDismissed + onboarding cleared.\nFully close + reopen the app to see IntroLaunch.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Intro + Onboarding</Text>
                <Text style={devStyles.resetLaunchHint}>
                  intro: {activation.introDismissed ? '✓ dismissed' : '✗ not seen'} · onboarding: {activation.onboardingComplete ? '✓ done' : '✗ pending'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await clearState('@juicing_log_entries_v1')
                  resetLog()
                  Alert.alert('History Reset', 'Cleared juice log entries.\nFully close + reopen the app to see IntroLaunch.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Juice Log History</Text>
                <Text style={devStyles.resetLaunchHint}>entries: {totalLogCount}</Text>
              </TouchableOpacity>

              {/* Toggle Pro Mode */}
              <TouchableOpacity
                style={[devStyles.resetLaunchBtn, isPro && devStyles.devProActiveBtn]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  toggleDevPro()
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>
                  {isPro ? '👑 Pro Mode ON' : 'Toggle Pro Mode'}
                </Text>
                <Text style={devStyles.resetLaunchHint}>
                  {isPro ? 'Tap to switch back to Free tier' : 'Tap to activate Pro for testing'}
                </Text>
              </TouchableOpacity>

              {/* Advance Day Count */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  devAdvanceDay()
                  if (streakCtx && streakCtx.devAdvanceDay) streakCtx.devAdvanceDay()
                  advanceDevDay(1)
                  setDevClockOffset(getDevDayOffset())
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>
                  Advance Day (+1)
                </Text>
                <Text style={devStyles.resetLaunchHint}>
                  Day {challenge.currentDay} · Streak {streakCtx?.currentStreak || 0} · Clock +{devClockOffset}d
                </Text>
                <Text style={devStyles.resetLaunchHint}>
                  Perceived: {getDevNow().toISOString().slice(0, 10)}
                </Text>
              </TouchableOpacity>

              {/* Reset Dev Clock */}
              {devClockOffset > 0 && (
                <TouchableOpacity
                  style={devStyles.resetLaunchBtn}
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                    resetDevClock()
                    setDevClockOffset(0)
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={devStyles.resetLaunchText}>Reset Dev Clock</Text>
                  <Text style={devStyles.resetLaunchHint}>Return to real time</Text>
                </TouchableOpacity>
              )}

              {/* Reset Glow Streak */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await resetGlowStreak()
                  Alert.alert('Glow Streak Reset', 'Streak count, check-in date, and grace date cleared.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Glow Streak (dev)</Text>
                <Text style={devStyles.resetLaunchHint}>Clears streak count + check-in state</Text>
              </TouchableOpacity>

              {/* Reset Focus Nutrient */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await resetFocusForToday()
                  Alert.alert('Focus Nutrient Reset', 'Today\'s focus nutrient and swap state cleared.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Focus Nutrient (dev)</Text>
                <Text style={devStyles.resetLaunchHint}>Clears today's pick + swap state</Text>
              </TouchableOpacity>

              {/* Reset Achievements */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await resetAchievements()
                  Alert.alert('Achievements Reset', 'All unlocked achievements cleared.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Achievements (dev)</Text>
                <Text style={devStyles.resetLaunchHint}>Clears all unlocked achievements</Text>
              </TouchableOpacity>

              {/* Reset Weekly Summary */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await resetWeeklySummary()
                  Alert.alert('Weekly Summary Reset', 'Cycle start and last-shown dates cleared.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Weekly Summary (dev)</Text>
                <Text style={devStyles.resetLaunchHint}>Clears 7-day cycle + shown state</Text>
              </TouchableOpacity>

              {/* Reset Nudge Settings */}
              <TouchableOpacity
                style={devStyles.resetLaunchBtn}
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                  await cancelAllNudges()
                  await resetNudgeSettings()
                  setNudgeSettingsLocal(await getNudgeSettings())
                  Alert.alert('Nudge Settings Reset', 'All motivation reminders canceled and settings cleared.')
                }}
                activeOpacity={0.7}
              >
                <Text style={devStyles.resetLaunchText}>Reset Nudge Settings (dev)</Text>
                <Text style={devStyles.resetLaunchHint}>Cancels all scheduled nudges + resets preferences</Text>
              </TouchableOpacity>

              {/* Beta Tester Name */}
              <View style={devStyles.nameInputWrap}>
                <Text style={devStyles.nameInputLabel}>Beta Tester Name</Text>
                <Text style={devStyles.resetLaunchHint}>
                  {profile.name ? `Current: ${profile.name}` : 'Not set — greeting will be generic'}
                </Text>
                <View style={devStyles.nameInputRow}>
                  <TextInput
                    style={devStyles.nameInput}
                    placeholder="Enter your name"
                    placeholderTextColor="#484F58"
                    value={profileNameInput}
                    onChangeText={setProfileNameInput}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (profileNameInput.trim()) {
                        setProfileName(profileNameInput.trim())
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={devStyles.nameSaveBtn}
                    onPress={() => {
                      if (profileNameInput.trim()) {
                        setProfileName(profileNameInput.trim())
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={devStyles.nameSaveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reset Challenge + Streak */}
              <TouchableOpacity
                style={[devStyles.resetLaunchBtn, { borderColor: 'rgba(233,30,99,0.3)' }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                  resetChallenge()
                  if (streakCtx && streakCtx.resetStreak) streakCtx.resetStreak()
                }}
                activeOpacity={0.7}
              >
                <Text style={[devStyles.resetLaunchText, { color: '#E91E63' }]}>
                  Reset Challenge + Streak
                </Text>
                <Text style={devStyles.resetLaunchHint}>
                  Resets day count to 1, clears all juice logs and streak data
                </Text>
              </TouchableOpacity>

              {/* ═══ NUCLEAR RESET — Reset User ═══════════════════ */}
              <TouchableOpacity
                style={[devStyles.resetLaunchBtn, { borderColor: 'rgba(244,67,54,0.5)', backgroundColor: 'rgba(244,67,54,0.06)' }]}
                onPress={() => {
                  Alert.alert(
                    'Reset All User Data',
                    'This will clear ALL app data — profile, challenge, streak, pantry, templates, preferences, and feature flags. The app will restart as if it were a fresh install.\n\nThis cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset Everything',
                        style: 'destructive',
                        onPress: async () => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
                          await resetAllUserData()
                          resetProfile()
                          resetChallenge()
                          resetScore()
                          if (streakCtx && streakCtx.resetStreak) streakCtx.resetStreak()
                          resetAll()
                          Alert.alert('Done', 'All data cleared. Please restart the app for a clean state.')
                        },
                      },
                    ]
                  )
                }}
                activeOpacity={0.7}
              >
                <Text style={[devStyles.resetLaunchText, { color: '#F44336' }]}>
                  ☢️ Reset User (Nuclear)
                </Text>
                <Text style={devStyles.resetLaunchHint}>
                  Clears ALL data — profile, challenge, streak, pantry, templates, flags, preferences. Makes you a brand new user.
                </Text>
              </TouchableOpacity>

              {/* Individual flag toggles */}
              {Object.keys(DEFAULT_FLAGS).map((key) => {
                const meta = FLAG_LABELS[key] || { label: key, phase: 'Unknown' }
                const phaseColor = PHASE_COLORS[meta.phase] || '#8B949E'
                return (
                  <View key={key} style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                      <Text style={styles.settingLabel}>{meta.label}</Text>
                      <View style={devStyles.phaseTag}>
                        <View style={[devStyles.phaseDot, { backgroundColor: phaseColor }]} />
                        <Text style={[devStyles.phaseText, { color: phaseColor }]}>{meta.phase}</Text>
                      </View>
                    </View>
                    <EmeraldSwitch
                      value={!!flags[key]}
                      onValueChange={(v) => setFlag(key, v)}
                    />
                  </View>
                )
              })}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#484F58' },

  // Tooltip
  tooltip: {
    backgroundColor: 'rgba(255,213,79,0.06)',
    borderRadius: 24, padding: 18, marginBottom: 20,
    borderWidth: 0.5, borderColor: 'rgba(255,213,79,0.15)',
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  tooltipIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,213,79,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  tooltipContent: { flex: 1 },
  tooltipTitle: {
    fontSize: 13, fontWeight: '800', color: '#FFD54F',
    marginBottom: 4,
  },
  tooltipText: { fontSize: 13, color: '#C9D1D9', lineHeight: 18 },
  tooltipClose: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 24, backgroundColor: 'rgba(255,213,79,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(255,213,79,0.15)',
  },
  tooltipCloseText: { fontSize: 12, fontWeight: '700', color: '#FFD54F' },

  // Intensity
  intensityCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 18, marginBottom: 24,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  intensityTitle: {
    fontSize: 13, fontWeight: '800', color: '#484F58',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
  },
  intensityRow: { flexDirection: 'row', gap: 8 },
  intensityStop: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 24, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  intensityLabel: { fontSize: 14, fontWeight: '700', color: '#8B949E' },
  intensityDesc: { fontSize: 11, color: '#484F58', marginTop: 2 },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: 12, marginTop: 4,
  },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitleWrap: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  sectionSubtitle: { fontSize: 11, color: '#484F58', marginTop: 1 },

  // Settings Group
  settingsGroup: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, marginBottom: 24, overflow: 'hidden',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingRowDisabled: { opacity: 0.4 },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '700', color: '#C9D1D9' },
  settingLabelDisabled: { color: '#484F58' },
  settingDesc: { fontSize: 12, color: '#484F58', marginTop: 2, lineHeight: 16 },
  emergencyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6, backgroundColor: 'rgba(100,181,246,0.06)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 24,
    alignSelf: 'flex-start',
    borderWidth: 0.5, borderColor: 'rgba(100,181,246,0.1)',
  },
  emergencyText: { fontSize: 10, color: '#90CAF9', fontWeight: '600' },

  // Ghost Mode
  ghostRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  ghostInfo: { flex: 1, marginRight: 12 },
  ghostIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  ghostLabel: { fontSize: 14, fontWeight: '700', color: '#C9D1D9' },
  ghostDesc: { fontSize: 12, color: '#484F58', lineHeight: 16 },

  // Quiet Hours
  quietCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 18, marginBottom: 24,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  quietRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  quietDivider: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  quietNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  quietNoteText: { flex: 1, fontSize: 11, color: '#484F58', lineHeight: 16 },

  // Time Picker
  timePicker: { alignItems: 'center' },
  timeLabel: {
    fontSize: 11, fontWeight: '700', color: '#484F58',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  timeControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  timeBtnText: { fontSize: 18, fontWeight: '700', color: '#8B949E' },
  timeValue: {
    fontSize: 20, fontWeight: '900', color: '#FFFFFF',
    fontVariant: ['tabular-nums'], minWidth: 60, textAlign: 'center',
  },

  // Master Switch
  masterCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 24, padding: 18,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  masterInfo: { flex: 1, marginRight: 12 },
  masterLabel: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  masterDesc: { fontSize: 12, color: '#484F58', marginTop: 2 },

  // Help rows
  helpRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  helpInfo: { flex: 1 },
  helpLabel: { fontSize: 14, fontWeight: '700', color: '#C9D1D9' },
  helpDesc: { fontSize: 12, color: '#484F58', marginTop: 2 },
  helpArrow: { fontSize: 16, color: '#484F58' },
})

const devStyles = StyleSheet.create({
  buildTargetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  buildTargetLabel: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
  },
  buildTargetBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(100,181,246,0.15)',
    borderWidth: 0.5, borderColor: 'rgba(100,181,246,0.3)',
  },
  buildTargetBadgeBeta: {
    backgroundColor: 'rgba(129,199,132,0.15)',
    borderColor: 'rgba(129,199,132,0.3)',
  },
  buildTargetText: {
    fontSize: 12, fontWeight: '800', color: '#81C784', letterSpacing: 1,
  },
  bulkRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  bulkBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(129,199,132,0.1)',
    borderWidth: 0.5, borderColor: 'rgba(129,199,132,0.2)',
    alignItems: 'center',
  },
  bulkBtnText: { fontSize: 13, fontWeight: '700', color: '#81C784' },
  bulkBtnReset: {
    backgroundColor: 'rgba(239,83,80,0.08)',
    borderColor: 'rgba(239,83,80,0.15)',
  },
  bulkBtnResetText: { color: '#EF5350' },
  phaseTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
  },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseText: { fontSize: 11, fontWeight: '600' },
  resetLaunchBtn: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,183,77,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,183,77,0.2)',
  },
  resetLaunchText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFB74D',
  },
  resetLaunchHint: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8B949E',
    marginTop: 2,
  },
  devProActiveBtn: {
    backgroundColor: 'rgba(255,213,79,0.12)',
    borderColor: 'rgba(255,213,79,0.3)',
  },
  nameInputWrap: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(100,181,246,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.2)',
  },
  nameInputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64B5F6',
    marginBottom: 2,
  },
  nameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  nameInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#E6EDF3',
  },
  nameSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(100,181,246,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(100,181,246,0.3)',
  },
  nameSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64B5F6',
  },
})

const nudgeStyles = StyleSheet.create({
  permDenied: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(255,183,77,0.06)',
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  permDeniedText: {
    fontSize: 12, color: '#FFB74D', lineHeight: 16,
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  timeLabel: {
    fontSize: 13, fontWeight: '600', color: '#484F58',
  },
  dayRow: {
    flexDirection: 'row', gap: 4,
  },
  dayBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)',
  },
  dayBtnActive: {
    backgroundColor: 'rgba(129,199,132,0.15)',
    borderColor: 'rgba(129,199,132,0.3)',
  },
  dayText: {
    fontSize: 11, fontWeight: '700', color: '#484F58',
  },
  dayTextActive: {
    color: '#81C784',
  },
  testBtn: {
    marginHorizontal: 16, marginVertical: 12,
    paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(129,199,132,0.08)',
    borderWidth: 0.5, borderColor: 'rgba(129,199,132,0.15)',
    alignItems: 'center',
  },
  testBtnText: {
    fontSize: 13, fontWeight: '700', color: '#81C784',
  },
})
