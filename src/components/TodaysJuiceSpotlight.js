import React from 'react'
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowRight, Check, Plus, ScanLine, Sparkles, X } from 'lucide-react-native'
import { SEMANTIC_COLORS, SEMANTIC_SPACE, SEMANTIC_RADIUS, SEMANTIC_TYPOGRAPHY, FONT_WEIGHT, RADIUS } from '../constants/tokens'

function ProduceVisual({ spotlight, isComplete }) {
  const [primaryColor, secondaryColor, darkColor] = spotlight.accentColors

  return (
    <View style={styles.visualWrap} accessible={false}>
      {spotlight.imageSource ? (
        <Image source={spotlight.imageSource} style={styles.visualImage} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={[primaryColor, secondaryColor, darkColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.visualGradient}
        >
          <View style={[styles.produceOrb, styles.produceOrbLarge, { backgroundColor: 'rgba(255,255,255,0.22)' }]} />
          <View style={[styles.produceOrb, styles.produceOrbSmall, { backgroundColor: 'rgba(255,222,120,0.82)' }]} />
          <View style={[styles.produceOrb, styles.produceOrbTiny, { backgroundColor: 'rgba(255,255,255,0.32)' }]} />
          <View style={styles.glass}>
            <View style={styles.glassHighlight} />
            <View style={styles.glassJuice} />
          </View>
          <Text style={styles.visualEmoji}>{isComplete ? '✓' : '🥬'}</Text>
        </LinearGradient>
      )}
    </View>
  )
}

function IngredientList({ labels }) {
  return (
    <Text style={styles.ingredients} accessibilityLabel={`Ingredients: ${labels.join(', ')}`}>
      {labels.join('  •  ')}
    </Text>
  )
}

export default function TodaysJuiceSpotlight({
  spotlight,
  state,
  focusNutrient,
  onViewBlend,
  onScan,
  onViewToday,
  onAddAnother,
}) {
  const isComplete = state.kind === 'completed'
  const completedLabels = state.latestEntry?.ingredients || []
  const completionTitle = state.latestEntry?.title || 'Today’s Juice'
  const primaryLabel = isComplete ? 'View Today’s Juice' : 'View This Blend'
  const secondaryLabel = isComplete ? 'Add Another Juice' : state.kind === 'new' ? 'Scan Ingredients' : 'Scan My Juice'
  const primaryHandler = isComplete ? onViewToday : onViewBlend
  const secondaryHandler = isComplete ? onAddAnother : onScan
  const focusCopy = focusNutrient && !isComplete
    ? `Inspired by today’s ${focusNutrient.name} focus.`
    : isComplete
      ? 'Your Glow is complete for today.'
      : 'A simple place to start when you are ready.'

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={isComplete ? 'Today’s juice logged' : `Today’s Juice Spotlight: ${spotlight.name}`}
    >
      <ProduceVisual spotlight={spotlight} isComplete={isComplete} />
      <View style={styles.content}>
        <View style={styles.labelRow}>
          {isComplete ? <Check size={13} color="#B8F2C7" /> : <Sparkles size={13} color="#FFF2B0" />}
          <Text style={styles.label}>{isComplete ? 'TODAY’S JUICE LOGGED' : 'TODAY’S JUICE SPOTLIGHT'}</Text>
        </View>
        <Text style={styles.name} accessibilityLabel={`Juice name: ${isComplete ? completionTitle : spotlight.name}`}>
          {isComplete ? completionTitle : spotlight.name}
        </Text>
        {isComplete && completedLabels.length > 0
          ? <IngredientList labels={completedLabels} />
          : <IngredientList labels={spotlight.ingredientLabels} />}
        <Text style={styles.description}>{focusCopy}</Text>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            onPress={primaryHandler}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
          >
            <Text style={styles.primaryText}>{primaryLabel}</Text>
            <ArrowRight size={15} color="#112817" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
            onPress={secondaryHandler}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={secondaryLabel}
          >
            {isComplete ? <Plus size={15} color={SEMANTIC_COLORS.textPrimary} /> : <ScanLine size={15} color={SEMANTIC_COLORS.textPrimary} />}
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export function JuiceSpotlightDetailsModal({ visible, spotlight, focusNutrient, onClose, onUseBlend }) {
  if (!spotlight) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalEyebrow}>TODAY’S JUICE SPOTLIGHT</Text>
              <Text style={styles.modalTitle}>{spotlight.name}</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close blend details">
              <X size={18} color={SEMANTIC_COLORS.textPrimary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            <ProduceVisual spotlight={spotlight} />
            <Text style={styles.modalDescription}>{spotlight.shortDescription}</Text>
            {focusNutrient && (
              <Text style={styles.focusConnection}>Connected to today’s {focusNutrient.name} focus.</Text>
            )}
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <IngredientList labels={spotlight.ingredientLabels} />
            <Text style={styles.sectionTitle}>Simple prep</Text>
            {spotlight.preparationSteps.slice(0, 3).map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
            <Text style={styles.note}>{spotlight.juicerNote}</Text>
            <Text style={styles.reminder}>Use what you have and adjust ingredients to your preference.</Text>
          </ScrollView>
          <Pressable style={styles.useButton} onPress={onUseBlend} accessibilityRole="button" accessibilityLabel={`Use ${spotlight.name} blend`}>
            <Text style={styles.useButtonText}>Use This Blend</Text>
            <ArrowRight size={17} color="#112817" />
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 210,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: SEMANTIC_COLORS.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(184,242,199,0.22)',
    marginBottom: SEMANTIC_SPACE.lg,
  },
  visualWrap: {
    height: 82,
    overflow: 'hidden',
  },
  visualImage: {
    width: '100%',
    height: '100%',
  },
  visualGradient: {
    flex: 1,
    overflow: 'hidden',
  },
  produceOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  produceOrbLarge: {
    width: 132,
    height: 132,
    top: -58,
    right: -14,
  },
  produceOrbSmall: {
    width: 42,
    height: 42,
    bottom: -10,
    left: 26,
  },
  produceOrbTiny: {
    width: 18,
    height: 18,
    top: 14,
    left: 64,
  },
  glass: {
    position: 'absolute',
    width: 46,
    height: 62,
    bottom: -5,
    right: 62,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.78)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  glassJuice: {
    position: 'absolute',
    left: 3,
    right: 3,
    bottom: 3,
    height: 37,
    borderRadius: 10,
    backgroundColor: 'rgba(255,245,175,0.70)',
  },
  glassHighlight: {
    position: 'absolute',
    top: 7,
    left: 6,
    width: 4,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.62)',
    zIndex: 1,
  },
  visualEmoji: {
    position: 'absolute',
    left: 20,
    top: 20,
    color: SEMANTIC_COLORS.textOnAccent,
    fontSize: 28,
    fontWeight: FONT_WEIGHT.heavy,
  },
  content: {
    padding: SEMANTIC_SPACE.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  label: {
    color: '#DDFBE5',
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    letterSpacing: 0.7,
  },
  name: {
    color: SEMANTIC_COLORS.textOnAccent,
    fontSize: 22,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: -0.5,
    marginBottom: 5,
  },
  ingredients: {
    color: '#C9DCCF',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.body.fontWeight,
    lineHeight: 18,
  },
  description: {
    color: '#AABCB0',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    lineHeight: 18,
    marginTop: SEMANTIC_SPACE.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: SEMANTIC_SPACE.sm,
    marginTop: 14,
  },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: '#B8F2C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  primaryText: {
    color: '#112817',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.buttonLabel.fontWeight,
  },
  secondaryButton: {
    minHeight: 44,
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  secondaryText: {
    color: SEMANTIC_COLORS.textPrimary,
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.semibold,
  },
  buttonPressed: {
    opacity: 0.76,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(4,11,8,0.76)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    backgroundColor: '#17221B',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(184,242,199,0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalEyebrow: {
    color: '#B8F2C7',
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modalTitle: {
    color: SEMANTIC_COLORS.textOnAccent,
    fontSize: 28,
    fontWeight: FONT_WEIGHT.heavy,
    letterSpacing: -0.7,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  modalScroll: {
    paddingBottom: 16,
  },
  modalDescription: {
    color: '#D0DED4',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    lineHeight: 21,
    marginTop: 14,
  },
  focusConnection: {
    color: '#B8F2C7',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontWeight: FONT_WEIGHT.semibold,
    marginTop: 10,
  },
  sectionTitle: {
    color: SEMANTIC_COLORS.textOnAccent,
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
    marginTop: 18,
    marginBottom: 7,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 9,
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    color: '#112817',
    backgroundColor: '#B8F2C7',
    fontSize: SEMANTIC_TYPOGRAPHY.caption.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.caption.fontWeight,
    lineHeight: 20,
  },
  stepText: {
    flex: 1,
    color: '#CBD7CE',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    lineHeight: 19,
  },
  note: {
    color: SEMANTIC_COLORS.textPrimary,
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: SEMANTIC_SPACE.sm,
  },
  reminder: {
    color: '#95A69B',
    fontSize: SEMANTIC_TYPOGRAPHY.body.fontSize,
    lineHeight: 19,
    marginTop: 12,
  },
  useButton: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#B8F2C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  useButtonText: {
    color: '#112817',
    fontSize: SEMANTIC_TYPOGRAPHY.cardTitle.fontSize,
    fontWeight: SEMANTIC_TYPOGRAPHY.cardTitle.fontWeight,
  },
})
