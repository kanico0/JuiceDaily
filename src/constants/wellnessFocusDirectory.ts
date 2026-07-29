import directoryData from '../../Docs/reverse_symptom_juice_directory.json'

export interface WellnessFocusArea {
  id: string
  label: string
  search_terms: string[]
  associated_nutrients: string[]
  note: string
}

export interface WellnessNutrient {
  label: string
  juice_ingredients: string[]
}

export interface WellnessDirectory {
  _meta: {
    purpose: string
    disclaimer: string
    schema_version: string
    focus_area_count: number
    nutrient_count: number
  }
  focus_areas: WellnessFocusArea[]
  nutrients: Record<string, WellnessNutrient>
}

export const WELLNESS_DIRECTORY: WellnessDirectory = directoryData as WellnessDirectory

export const WELLNESS_FOCUS_AREAS: WellnessFocusArea[] = WELLNESS_DIRECTORY.focus_areas

export const WELLNESS_NUTRIENTS: Record<string, WellnessNutrient> = WELLNESS_DIRECTORY.nutrients

export const WELLNESS_SCHEMA_VERSION: string = WELLNESS_DIRECTORY._meta.schema_version

export function getFocusAreaById(id: string): WellnessFocusArea | undefined {
  return WELLNESS_FOCUS_AREAS.find((a) => a.id === id)
}

export function getNutrientById(id: string): WellnessNutrient | undefined {
  return WELLNESS_NUTRIENTS[id]
}
