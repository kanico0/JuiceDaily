// Suppress known warnings (must be imported before any module that emits them)
import './src/utils/suppressWarnings'

import React, { useEffect, useRef } from 'react'
import { View, Text, AppState } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { NavigationContainer, CommonActions } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import ModernTabBar from './src/components/ModernTabBar'
import { ChallengeProvider } from './src/services/ChallengeStore'
import { ProProvider } from './src/services/ProStore'
import { SubscriptionProvider } from './src/services/subscriptions/SubscriptionStore'
import { QuotaProvider } from './src/services/quota/QuotaStore'
import { EducationProvider } from './src/services/EducationStore'
import { FlagProvider } from './src/services/FeatureFlags'
import { PantryProvider } from './src/services/PantryStore'
import { TemplateProvider } from './src/services/TemplateStore'
import { StreakProvider } from './src/services/StreakEngine'
import { SocialChallengeProvider } from './src/services/SocialChallengeStore'
import { UserProfileProvider } from './src/services/UserProfileStore'
import { WeightUnitProvider } from './src/utils/weightFormat'
import { OrganicPrefProvider } from './src/utils/organicPreference'
import { ActivationProvider, useActivation } from './src/services/ActivationStore'
import DashboardScreen from './src/screens/DashboardScreen'
import JuiceSnapScreen from './src/screens/HomeScreen'
import RecipeDetailScreen from './src/screens/RecipeDetailScreen'
import WeeklyReportScreen from './src/screens/WeeklyReportScreen'
import HallOfVitalityScreen from './src/screens/HallOfVitalityScreen'
import SettingsScreen from './src/screens/SettingsScreen'
import VitalityHistoryScreen from './src/screens/VitalityHistoryScreen'
import MonthlyWrapScreen from './src/screens/MonthlyWrapScreen'
import VaultScreen from './src/screens/VaultScreen'
import NoviceJourneyScreen from './src/screens/NoviceJourneyScreen'
import JuiceCalculatorScreen from './src/screens/JuiceCalculatorScreen'
import ScanScreen from './src/screens/ScanScreen'
import TodayScreen from './src/screens/TodayScreen'
import GlowLibraryScreen from './src/screens/GlowLibraryScreen'
import SeasonalGlowPacksScreen from './src/screens/SeasonalGlowPacksScreen'
import BeginnerGlowPathScreen from './src/screens/BeginnerGlowPathScreen'
import WellnessFocusScreen from './src/screens/WellnessFocusScreen'
import WellnessResultsScreen from './src/screens/WellnessResultsScreen'
import ExplainFlowScreen from './src/screens/ExplainFlowScreen'
import PerformanceDashboardScreen from './src/screens/PerformanceDashboardScreen'
import PerformanceOnboardingScreen from './src/screens/PerformanceOnboardingScreen'
import ScanSuccessScreen from './src/screens/ScanSuccessScreen'
import HistoryScreen from './src/screens/HistoryScreen'
import IntroLaunchScreen from './src/screens/IntroLaunchScreen'
import JuicingExperienceScreen from './src/screens/JuicingExperienceScreen'
import LessonScreen from './src/screens/LessonScreen'
import PaywallScreen from './src/screens/PaywallScreen'
import JuicerGuideScreen from './src/screens/JuicerGuideScreen'
import ProduceRecipeResultsScreen from './src/screens/ProduceRecipeResultsScreen'
import { NutritionScoreProvider } from './src/services/NutritionScoreStore'
import { JuiceLogProvider, useJuiceLog } from './src/services/JuiceLogStore'
import { refreshNudges } from './src/services/NotificationNudges'
import { hydrateDevClock } from './src/utils/DevClock'
import { reconcileDormantReminders } from './src/services/DormantReminderService'
import {
  markNotificationOpened,
  reconcileWithPresentedNotifications,
} from './src/services/NotificationHistoryService'
import NotificationDetailScreen from './src/screens/NotificationDetailScreen'
import RecentNotificationsScreen from './src/screens/RecentNotificationsScreen'

// TEMPORARY QA-ONLY: Garden visual preview harness (not for commit)
// Gated by EXPO_PUBLIC_ENABLE_DEVELOPER_TOOLS build-time env var.
// Production Google Play builds never enable this, so the import
// and route are dead code in production.
import { DEVELOPER_TOOLS_ENABLED } from './src/hooks/useDeveloperMode'
let GardenPreviewScreen = null
if (DEVELOPER_TOOLS_ENABLED) {
  try {
    GardenPreviewScreen = require('./src/screens/GardenPreviewScreen').default
  } catch (e) {
    /* preview unavailable */
  }
}

// TEMPORARY QA-ONLY: Glow visual preview harness (not for commit)
// Same gating as Garden preview.
let GlowPreviewScreen = null
if (DEVELOPER_TOOLS_ENABLED) {
  try {
    GlowPreviewScreen = require('./src/screens/GlowPreviewScreen').default
  } catch (e) {
    /* preview unavailable */
  }
}

import ProductionConfigGate from './src/components/ProductionConfigGate'
import { validateProductionConfig, isProductionBuild } from './src/services/subscriptions/productionConfig'

const RootStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const navigationRef = React.createRef()

const STACK_OPTS = {
  headerShown: false,
  animation: 'slide_from_right',
  contentStyle: { backgroundColor: '#0D1117' },
}

// ── Shared sub-screens injected into each tab stack ──────────

function addSharedScreens(StackNav) {
  return (
    <>
      <StackNav.Screen name="JuiceSnap" component={JuiceSnapScreen} />
      <StackNav.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <StackNav.Screen name="GlowLibrary" component={GlowLibraryScreen} />
      <StackNav.Screen name="SeasonalGlowPacks" component={SeasonalGlowPacksScreen} />
      <StackNav.Screen name="BeginnerGlowPath" component={BeginnerGlowPathScreen} />
      <StackNav.Screen name="WellnessFocus" component={WellnessFocusScreen} />
      <StackNav.Screen name="WellnessResults" component={WellnessResultsScreen} />
      <StackNav.Screen name="WeeklyReport" component={WeeklyReportScreen} />
      <StackNav.Screen name="HallOfVitality" component={HallOfVitalityScreen} />
      <StackNav.Screen name="Settings" component={SettingsScreen} />
      <StackNav.Screen name="VitalityHistory" component={VitalityHistoryScreen} />
      <StackNav.Screen name="MonthlyWrap" component={MonthlyWrapScreen} />
      <StackNav.Screen name="Vault" component={VaultScreen} />
      <StackNav.Screen name="NoviceJourney" component={NoviceJourneyScreen} />
      <StackNav.Screen name="JuiceCalculator" component={JuiceCalculatorScreen} />
      <StackNav.Screen name="Dashboard" component={DashboardScreen} />
      <StackNav.Screen
        name="ExplainFlow"
        component={ExplainFlowScreen}
        options={{ animation: 'fade' }}
      />
      <StackNav.Screen name="PerformanceDashboard" component={PerformanceDashboardScreen} />
      <StackNav.Screen
        name="PerformanceOnboarding"
        component={PerformanceOnboardingScreen}
        options={{ animation: 'fade' }}
      />
      <StackNav.Screen
        name="ScanSuccess"
        component={ScanSuccessScreen}
        options={{ animation: 'fade' }}
      />
      <StackNav.Screen name="HistoryScreen" component={HistoryScreen} />
      <StackNav.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <StackNav.Screen name="JuicerGuide" component={JuicerGuideScreen} />
      <StackNav.Screen name="ProduceRecipeResults" component={ProduceRecipeResultsScreen} />
      <StackNav.Screen name="Lesson" component={LessonScreen} />
      <StackNav.Screen name="NotificationDetail" component={NotificationDetailScreen} />
      <StackNav.Screen name="RecentNotifications" component={RecentNotificationsScreen} />
      {DEVELOPER_TOOLS_ENABLED && GardenPreviewScreen && (
        <StackNav.Screen name="GardenPreview" component={GardenPreviewScreen} />
      )}
      {DEVELOPER_TOOLS_ENABLED && GlowPreviewScreen && (
        <StackNav.Screen name="GlowPreview" component={GlowPreviewScreen} />
      )}
    </>
  )
}

// ── Tab Stacks ───────────────────────────────────────────────

const TodayStack = createNativeStackNavigator()
function TodayTab() {
  return (
    <TodayStack.Navigator screenOptions={STACK_OPTS}>
      <TodayStack.Screen name="TodayHome" component={TodayScreen} />
      {addSharedScreens(TodayStack)}
    </TodayStack.Navigator>
  )
}

const ScanFlowStack = createNativeStackNavigator()
function ScanFlow() {
  return (
    <ScanFlowStack.Navigator screenOptions={STACK_OPTS}>
      <ScanFlowStack.Screen
        name="ScanHome"
        component={JuiceSnapScreen}
        options={{ animation: 'none' }}
      />
      {addSharedScreens(ScanFlowStack)}
    </ScanFlowStack.Navigator>
  )
}

const HistoryStack = createNativeStackNavigator()
function HistoryTab() {
  return (
    <HistoryStack.Navigator screenOptions={STACK_OPTS}>
      <HistoryStack.Screen name="HistoryHome" component={HistoryScreen} />
      {addSharedScreens(HistoryStack)}
    </HistoryStack.Navigator>
  )
}

const ExploreStack = createNativeStackNavigator()
function ExploreTab() {
  return (
    <ExploreStack.Navigator screenOptions={STACK_OPTS}>
      <ExploreStack.Screen name="ExploreHome" component={ScanScreen} />
      {addSharedScreens(ExploreStack)}
    </ExploreStack.Navigator>
  )
}

// ── Bottom Tab Navigator (3 tabs + FAB) ──────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="TodayTab"
      tabBar={(props) => <ModernTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="TodayTab" component={TodayTab} />
      <Tab.Screen name="HistoryTab" component={HistoryTab} />
      <Tab.Screen name="ExploreTab" component={ExploreTab} />
    </Tab.Navigator>
  )
}

// ── Root Navigator (hydration-aware intro gate) ─────────────

function RootNavigator() {
  const {
    activation,
    isHydrated: activationReady,
    recordIntroDismissed,
    setExperienceLevel,
  } = useActivation()
  const { isHydrated: logReady, totalLogCount } = useJuiceLog()
  const appStateRef = useRef(AppState.currentState)

  useEffect(() => {
    hydrateDevClock().catch(() => {})
    reconcileDormantReminders().catch(() => {})
  }, [])

  // ── Centralized notification response handler ──────────────
  // Handles BOTH:
  //   A. app already running/backgrounded (addNotificationResponseReceivedListener)
  //   B. app launched from notification/cold start (getLastNotificationResponseAsync)
  //
  // Routes to NotificationDetail with the full notification payload.
  // After handling, the response is consumed so restarting the app
  // does not repeatedly reopen the same notification.
  // Normal app launches NOT caused by a notification open normally.
  useEffect(() => {
    let lastHandledResponseId = null

    const handleNotificationResponse = (response) => {
      if (!response) return

      // Dedupe: don't handle the same response twice
      const responseId =
        response?.notification?.request?.identifier || response?.notification?.date || Date.now()
      if (lastHandledResponseId === responseId) return
      lastHandledResponseId = responseId

      const data = response?.notification?.request?.content?.data
      const title = response?.notification?.request?.content?.title || ''
      const body = response?.notification?.request?.content?.body || ''

      // Only handle RawLifeFlow notifications
      if (!data?.rawLifeFlowNotification) {
        // Legacy dormant_reminder handler (retired but kept for compat)
        if (data?.type === 'dormant_reminder' && navigationRef.isReady()) {
          navigationRef.navigate('Main', {
            screen: 'TodayTab',
            params: { screen: 'Dashboard', params: { openQuickLog: true } },
          })
        }
        return
      }

      // Mark as opened in the archive
      const scheduleIdentifier =
        data?.notificationId || response?.notification?.request?.identifier || ''
      const fullText = data?.fullText || body || ''
      const notificationType = data?.notificationType || data?.type || 'unknown'
      const scheduledFor = typeof data?.scheduledFor === 'number' ? data.scheduledFor : null

      markNotificationOpened({
        scheduleIdentifier,
        title,
        fullText,
        notificationType,
        scheduledFor,
      }).catch(() => {})

      // Navigate to NotificationDetail
      if (navigationRef.isReady()) {
        navigationRef.navigate('NotificationDetail', {
          notificationId: scheduleIdentifier,
          title,
          fullText,
          notificationType,
          scheduledFor,
        })
      }
    }

    // A. App already running / backgrounded
    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    )

    // B. App launched from notification (cold start)
    Notifications.getLastNotificationResponseAsync()
      .then(handleNotificationResponse)
      .catch(() => {})

    return () => subscription.remove()
  }, [])

  // Reconcile notification archive on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        reconcileWithPresentedNotifications().catch(() => {})
      }
    })
    return () => sub.remove()
  }, [])

  // Refresh nudge notifications on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refreshNudges().catch(() => {})
      }
      appStateRef.current = nextState
    })
    // Also refresh on initial mount
    refreshNudges().catch(() => {})
    return () => sub.remove()
  }, [])

  // Wait for both stores to hydrate before deciding
  if (!activationReady || !logReady) {
    console.log(
      '[RootNavigator] waiting for hydration — activationReady:',
      activationReady,
      'logReady:',
      logReady,
    )
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#060D0A',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#484F58', fontSize: 14 }}>Loading…</Text>
      </View>
    )
  }

  // Skip intro for returning users (have logs) or if intro was explicitly dismissed
  const skipIntro = activation.introDismissed || activation.totalLogsCount > 0 || totalLogCount > 0
  const initialRoute = skipIntro ? 'Main' : 'JuicingExperience'
  console.log(
    '[RootNavigator] hydrated — introDismissed:',
    activation.introDismissed,
    'activationLogs:',
    activation.totalLogsCount,
    'juiceLogs:',
    totalLogCount,
    '→ route:',
    initialRoute,
  )

  return (
    <RootStack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <RootStack.Screen name="IntroLaunch">
        {({ navigation }) => (
          <IntroLaunchScreen
            onReveal={() => {
              recordIntroDismissed()
              navigation.dispatch(
                CommonActions.reset({
                  index: 1,
                  routes: [{ name: 'Main' }, { name: 'ScanFlow' }],
                }),
              )
            }}
            onSeeHow={() => {
              recordIntroDismissed()
              navigation.navigate('JuicingExperience')
            }}
            onExplore={() => {
              recordIntroDismissed()
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Main', state: { routes: [{ name: 'ExploreTab' }] } }],
                }),
              )
            }}
          />
        )}
      </RootStack.Screen>

      <RootStack.Screen name="JuicingExperience">
        {({ navigation }) => (
          <JuicingExperienceScreen
            navigation={navigation}
            onSelect={(value) => {
              setExperienceLevel(value)
              const isReturning =
                activation.introDismissed || activation.totalLogsCount > 0 || totalLogCount > 0
              if (isReturning) {
                // Returning user from Today — show the lesson they selected
                navigation.navigate('Lesson', { level: value, isReplay: true })
                return
              }
              recordIntroDismissed()
              // New user — show the lesson, then navigate to Main on finish
              navigation.navigate('Lesson', { level: value, isReplay: false })
            }}
          />
        )}
      </RootStack.Screen>
      <RootStack.Screen name="Lesson" component={LessonScreen} />
      <RootStack.Screen name="Main" component={MainTabs} />
      <RootStack.Screen
        name="ScanFlow"
        component={ScanFlow}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </RootStack.Navigator>
  )
}

// ── App Root ─────────────────────────────────────────────────

export default function App() {
  // ── Production configuration gate ──────────────────────────
  // If a production binary is missing required configuration,
  // show a blocking recovery screen. This is a BUILD CONFIGURATION
  // FAILURE, not a temporary service outage. The app must not
  // continue into normal operation.
  const configResult = validateProductionConfig(isProductionBuild())
  if (!configResult.ok) {
    return (
      <SafeAreaProvider>
        <ProductionConfigGate />
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <WeightUnitProvider>
        <OrganicPrefProvider>
          <FlagProvider>
            <ActivationProvider>
              <PantryProvider>
                <TemplateProvider>
                  <StreakProvider>
                    <SocialChallengeProvider>
                      <ProProvider>
                        <SubscriptionProvider>
                          <QuotaProvider>
                            <EducationProvider>
                              <UserProfileProvider>
                                <ChallengeProvider>
                                  <NutritionScoreProvider>
                                    <JuiceLogProvider>
                                      <NavigationContainer ref={navigationRef}>
                                        <StatusBar style="light" />
                                        <RootNavigator />
                                      </NavigationContainer>
                                    </JuiceLogProvider>
                                  </NutritionScoreProvider>
                                </ChallengeProvider>
                              </UserProfileProvider>
                            </EducationProvider>
                          </QuotaProvider>
                        </SubscriptionProvider>
                      </ProProvider>
                    </SocialChallengeProvider>
                  </StreakProvider>
                </TemplateProvider>
              </PantryProvider>
            </ActivationProvider>
          </FlagProvider>
        </OrganicPrefProvider>
      </WeightUnitProvider>
    </SafeAreaProvider>
  )
}
