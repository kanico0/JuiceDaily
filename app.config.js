// app.config.js — Dynamic Expo config
// Injects environment variables into expo.extra for reliable runtime access
// via expo-constants: Constants.expoConfig?.extra?.ANTHROPIC_API_KEY

module.exports = ({ config }) => {
  const buildTarget = process.env.EXPO_PUBLIC_BUILD_TARGET || 'go'

  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.juicingapp.app',
    },
    extra: {
      ...config.extra,
      // Anthropic key only ships in Expo Go dev builds; production scans
      // are routed through the Supabase analyze-scan Edge Function.
      ANTHROPIC_API_KEY: buildTarget === 'go' ? process.env.ANTHROPIC_API_KEY || '' : '',
      BUILD_TARGET: buildTarget,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      EXPO_PUBLIC_REVENUECAT_IOS_KEY: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '',
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '',
      EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL || '',
      EXPO_PUBLIC_PRIVACY_URL: process.env.EXPO_PUBLIC_PRIVACY_URL || '',
      EXPO_PUBLIC_MONETIZATION_ENABLED: process.env.EXPO_PUBLIC_MONETIZATION_ENABLED || '',
    },
  }
}
