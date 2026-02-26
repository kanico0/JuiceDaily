// ─────────────────────────────────────────────────────────────
// app/_layout.tsx — Root Stack layout with providers
// Stack screens: index (gate), onboarding, scan
// Nested group: (tabs) containing home, log, profile
// This ensures router.replace works as true stack navigation
// (not tab switching), fixing the onboarding→home flow.
// ─────────────────────────────────────────────────────────────

import '../src/utils/suppressWarnings'

import React from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ChallengeProvider } from '../src/services/ChallengeStore'
import { ProProvider } from '../src/services/ProStore'
import { EducationProvider } from '../src/services/EducationStore'
import { FlagProvider } from '../src/services/FeatureFlags'
import { PantryProvider } from '../src/services/PantryStore'
import { TemplateProvider } from '../src/services/TemplateStore'
import { StreakProvider } from '../src/services/StreakEngine'
import { SocialChallengeProvider } from '../src/services/SocialChallengeStore'
import { UserProfileProvider } from '../src/services/UserProfileStore'
import { WeightUnitProvider } from '../src/utils/weightFormat'
import { OrganicPrefProvider } from '../src/utils/organicPreference'
import { ActivationProvider } from '../src/services/ActivationStore'
import { NutritionScoreProvider } from '../src/services/NutritionScoreStore'

export default function RootLayout() {
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
      <EducationProvider>
      <UserProfileProvider>
      <ChallengeProvider>
      <NutritionScoreProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#0D1117' },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="scan"
            options={{
              presentation: 'fullScreenModal',
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </NutritionScoreProvider>
      </ChallengeProvider>
      </UserProfileProvider>
      </EducationProvider>
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
