// Mirrors backend/routes/weight.py — `weight_log` table CRUD.

import { getDb, persist } from './db'
import type { WeightIn, WeightOut, WeightPatch } from '../types'

function rowToWeightOut(row: Record<string, unknown>): WeightOut {
  return {
    id: row.id as number,
    weight_kg: row.weight_kg as number,
    logged_at: row.logged_at as string,
    created_at: row.created_at as string,
  }
}

export async function addWeight(entry: WeightIn): Promise<WeightOut | null> {
  const db = await getDb()
  const loggedAt = entry.logged_at || new Date().toISOString()
  const res = await db.run(
    'INSERT INTO weight_log (user_id, weight_kg, logged_at) VALUES (1, ?, ?)',
    [entry.weight_kg, loggedAt],
  )
  await persist()
  const id = res.changes?.lastId
  if (id == null) return null
  const q = await db.query('SELECT * FROM weight_log WHERE id = ?', [id])
  const rows = q.values ?? []
  return rows.length ? rowToWeightOut(rows[0]) : null
}

export async function listWeight(): Promise<WeightOut[]> {
  const db = await getDb()
  const res = await db.query('SELECT * FROM weight_log ORDER BY logged_at ASC')
  return (res.values ?? []).map(rowToWeightOut)
}

export async function patchWeight(id: number, data: WeightPatch): Promise<WeightOut | null> {
  const db = await getDb()
  const keys = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined)
  if (!keys.length) {
    const q = await db.query('SELECT * FROM weight_log WHERE id = ?', [id])
    const rows = q.values ?? []
    return rows.length ? rowToWeightOut(rows[0]) : null
  }
  const sets = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => (data as Record<string, unknown>)[k])
  params.push(id)
  await db.run(`UPDATE weight_log SET ${sets} WHERE id = ?`, params)
  await persist()
  const q = await db.query('SELECT * FROM weight_log WHERE id = ?', [id])
  const rows = q.values ?? []
  return rows.length ? rowToWeightOut(rows[0]) : null
}

export async function deleteWeight(id: number): Promise<null> {
  const db = await getDb()
  await db.run('DELETE FROM weight_log WHERE id = ?', [id])
  await persist()
  return null
}
