// Mirrors Lumen's backend/schemas.py + backend/profile_store.py.
// Datetimes are serialized as ISO strings across the SQLite boundary.

export type Sex = 'male' | 'female' | 'other'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very active'
export type ChatRole = 'user' | 'assistant'

export interface UserSetup {
  name: string
  age: number
  height_cm: number
  weight_kg: number
  sex: Sex | string
  activity_level: ActivityLevel | string
  calorie_goal: number
  bmr?: number | null
  body_fat_pct?: number | null
}

export interface UserOut extends UserSetup {
  id: number
  created_at: string
}

export interface ProfilePatch extends Partial<UserSetup> {
  extras?: Record<string, unknown>
}

export interface ProfileStatic {
  name: string | null
  age: number | null
  height_cm: number | null
  weight_kg: number | null
  sex: string | null
  activity_level: string | null
  calorie_goal: number | null
  bmr: number | null
  body_fat_pct: number | null
  weight_unit: string
  measurement_unit: string
  meal_sections: string[]
  measurement_types: string[]
}

export interface ProfileDynamic {
  dietary_preferences: string[]
  cooking_capabilities: string[]
  meal_patterns: string[]
  physical_activity_habits: string[]
  food_preferences: string[]
  food_restrictions: string[]
  [key: string]: unknown
}

export interface ProfileJson {
  static: Partial<ProfileStatic>
  dynamic: Partial<ProfileDynamic>
}

export interface ProfileResponse {
  user: UserOut | null
  profile: ProfileJson
}

export interface FoodIn {
  date: string
  meal_type: string
  food_name: string
  kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  notes?: string | null
}

export interface FoodOut extends Required<Omit<FoodIn, 'notes'>> {
  id: number
  notes: string | null
  created_at: string
}

export interface WeightIn {
  weight_kg: number
  logged_at?: string | null
}

export interface WeightOut {
  id: number
  weight_kg: number
  logged_at: string
  created_at: string
}

export interface WeightPatch {
  weight_kg?: number
  logged_at?: string
}

export interface MeasurementIn {
  measurement_type: string
  value: number
  unit?: string
  logged_at?: string | null
}

export interface MeasurementOut {
  id: number
  measurement_type: string
  value: number
  unit: string
  logged_at: string
  created_at: string
}

export interface MeasurementPatch {
  measurement_type?: string
  value?: number
  unit?: string
  logged_at?: string
}

export interface ChatIn {
  message: string
  image_b64?: string | null
}

export interface ChatOut {
  reply: string
  parsed?: Record<string, unknown> | null
  follow_up_options: string[]
  food_entries_added: number
}

export interface ChatMessageOut {
  id: number
  role: ChatRole | string
  content: string
  created_at: string
}
