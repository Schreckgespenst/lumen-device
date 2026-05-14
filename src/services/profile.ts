// Mirrors backend/routes/profile.py + backend/profile_store.py.
//   - Static demographic fields live in the `users` row (id = 1).
//   - The JSON profile (static defaults + dynamic LLM-inferred facts) lives in
//     Capacitor Preferences, analogous to user_profile.json on the desktop.

import { Preferences } from '@capacitor/preferences'

import { getDb, persist } from './db'
import type {
  ProfileJson,
  ProfilePatch,
  ProfileResponse,
  UserOut,
  UserSetup,
} from '../types'

const PROFILE_KEY = 'lumen.profile.json'

const DEFAULT_PROFILE: ProfileJson = {
  static: {
    name: null,
    age: null,
    height_cm: null,
    weight_kg: null,
    sex: null,
    activity_level: null,
    calorie_goal: null,
    bmr: null,
    body_fat_pct: null,
    weight_unit: 'kg',
    measurement_unit: 'cm',
    meal_sections: ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner', 'Dessert'],
    measurement_types: ['chest', 'waist', 'hips', 'arms', 'thighs'],
  },
  dynamic: {
    dietary_preferences: [],
    cooking_capabilities: [],
    meal_patterns: [],
    physical_activity_habits: [],
    food_preferences: [],
    food_restrictions: [],
  },
}

async function loadProfile(): Promise<ProfileJson> {
  const { value } = await Preferences.get({ key: PROFILE_KEY })
  if (!value) {
    await Preferences.set({ key: PROFILE_KEY, value: JSON.stringify(DEFAULT_PROFILE) })
    return structuredClone(DEFAULT_PROFILE)
  }
  try {
    return JSON.parse(value) as ProfileJson
  } catch {
    return structuredClone(DEFAULT_PROFILE)
  }
}

async function saveProfile(profile: ProfileJson): Promise<void> {
  await Preferences.set({ key: PROFILE_KEY, value: JSON.stringify(profile) })
}

async function updateStatic(patch: Partial<UserSetup>): Promise<ProfileJson> {
  const profile = await loadProfile()
  profile.static = { ...profile.static }
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null) {
      ;(profile.static as Record<string, unknown>)[k] = v
    }
  }
  await saveProfile(profile)
  return profile
}

export async function applyDynamicPatch(patch: Record<string, unknown>): Promise<ProfileJson> {
  const profile = await loadProfile()
  const dyn = { ...(profile.dynamic ?? {}) } as Record<string, unknown>

  for (const [key, val] of Object.entries(patch ?? {})) {
    if (key.endsWith('_add') && Array.isArray(val)) {
      const target = key.slice(0, -4)
      const existing = Array.isArray(dyn[target]) ? [...(dyn[target] as unknown[])] : []
      for (const item of val) if (!existing.includes(item)) existing.push(item)
      dyn[target] = existing
    } else if (key.endsWith('_remove') && Array.isArray(val)) {
      const target = key.slice(0, -7)
      const existing = Array.isArray(dyn[target]) ? (dyn[target] as unknown[]) : []
      dyn[target] = existing.filter((x) => !val.includes(x))
    } else {
      dyn[key] = val
    }
  }
  profile.dynamic = dyn as ProfileJson['dynamic']
  await saveProfile(profile)
  return profile
}

function rowToUserOut(row: Record<string, unknown>): UserOut {
  return {
    id: row.id as number,
    name: row.name as string,
    age: row.age as number,
    height_cm: row.height_cm as number,
    weight_kg: row.weight_kg as number,
    sex: row.sex as string,
    activity_level: row.activity_level as string,
    calorie_goal: row.calorie_goal as number,
    bmr: (row.bmr as number | null) ?? null,
    body_fat_pct: (row.body_fat_pct as number | null) ?? null,
    created_at: row.created_at as string,
  }
}

async function fetchUser(): Promise<UserOut | null> {
  const db = await getDb()
  const res = await db.query('SELECT * FROM users ORDER BY id LIMIT 1')
  const rows = res.values ?? []
  return rows.length ? rowToUserOut(rows[0]) : null
}

export async function setup(data: UserSetup): Promise<UserOut | null> {
  const db = await getDb()
  const existing = await fetchUser()
  if (existing) {
    await db.run(
      `UPDATE users SET name=?, age=?, height_cm=?, weight_kg=?, sex=?, activity_level=?,
       calorie_goal=?, bmr=?, body_fat_pct=? WHERE id=?`,
      [
        data.name,
        data.age,
        data.height_cm,
        data.weight_kg,
        data.sex,
        data.activity_level,
        data.calorie_goal,
        data.bmr ?? null,
        data.body_fat_pct ?? null,
        existing.id,
      ],
    )
  } else {
    await db.run(
      `INSERT INTO users (name, age, height_cm, weight_kg, sex, activity_level,
         calorie_goal, bmr, body_fat_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name,
        data.age,
        data.height_cm,
        data.weight_kg,
        data.sex,
        data.activity_level,
        data.calorie_goal,
        data.bmr ?? null,
        data.body_fat_pct ?? null,
      ],
    )
  }
  await updateStatic(data)
  await persist()
  return await fetchUser()
}

export async function getProfile(): Promise<ProfileResponse> {
  const user = await fetchUser()
  const profile = await loadProfile()
  return { user, profile }
}

export async function patchProfile(data: ProfilePatch): Promise<UserOut | null> {
  const db = await getDb()
  const user = await fetchUser()
  if (!user) throw new Error('No user profile yet — call setup() first')

  const { extras, ...staticPatch } = data
  const keys = Object.keys(staticPatch).filter(
    (k) => (staticPatch as Record<string, unknown>)[k] !== undefined,
  )
  if (keys.length) {
    const sets = keys.map((k) => `${k} = ?`).join(', ')
    const params = keys.map((k) => (staticPatch as Record<string, unknown>)[k] ?? null)
    params.push(user.id)
    await db.run(`UPDATE users SET ${sets} WHERE id = ?`, params)
    await updateStatic(staticPatch)
  }
  if (extras) await applyDynamicPatch(extras)
  await persist()
  return await fetchUser()
}
