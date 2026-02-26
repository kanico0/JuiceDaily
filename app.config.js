// app.config.js — Dynamic Expo config
// Injects environment variables into expo.extra for reliable runtime access
// via expo-constants: Constants.expoConfig?.extra?.ANTHROPIC_API_KEY

module.exports = ({ config }) => {
  const buildTarget = process.env.EXPO_PUBLIC_BUILD_TARGET || 'go'

  return {
    ...config,
    extra: {
      ...config.extra,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      BUILD_TARGET: buildTarget,
    },
  }
}
