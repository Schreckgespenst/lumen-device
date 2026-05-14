// Mirrors backend/routes/food.py — `food_log` table CRUD.

import { getDb, persist } from './db'
import type { FoodIn, FoodOut } from '../types'

function rowToFoodOut(row: Record<string, unknown>): FoodOut {
  return {
    id: row.id as number,
    date: row.date as string,
    meal_type: row.meal_type as string,
    food_name: row.food_name as string,
    kcal: (row.kcal as number) ?? 0,
    protein_g: (row.protein_g as number) ?? 0,
    carbs_g: (row.carbs_g as number) ?? 0,
    fat_g: (row.fat_g as number) ?? 0,
    fiber_g: (row.fiber_g as number) ?? 0,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
  }
}

export async function addFood(entry: FoodIn): Promise<FoodOut | null> {
  const db = await getDb()
  const res = await db.run(
    `INSERT INTO food_log (user_id, date, meal_type, food_name, kcal, protein_g,
       carbs_g, fat_g, fiber_g, notes)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.date,
      entry.meal_type,
      entry.food_name,
      entry.kcal ?? 0,
      entry.protein_g ?? 0,
      entry.carbs_g ?? 0,
      entry.fat_g ?? 0,
      entry.fiber_g ?? 0,
      entry.notes ?? null,
    ],
  )
  await persist()
  const id = res.changes?.lastId
  if (id == null) return null
  const q = await db.query('SELECT * FROM food_log WHERE id = ?', [id])
  const rows = q.values ?? []
  return rows.length ? rowToFoodOut(rows[0]) : null
}

export async function listFood(date?: string): Promise<FoodOut[]> {
  const db = await getDb()
  const sql = date
    ? 'SELECT * FROM food_log WHERE date = ? ORDER BY created_at ASC'
    : 'SELECT * FROM food_log ORDER BY created_at ASC'
  const params = date ? [date] : []
  const res = await db.query(sql, params)
  return (res.values ?? []).map(rowToFoodOut)
}

export async function deleteFood(id: number): Promise<null> {
  const db = await getDb()
  await db.run('DELETE FROM food_log WHERE id = ?', [id])
  await persist()
  return null
}
