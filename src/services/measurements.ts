// Mirrors backend/routes/measurements.py — `body_measurements` table CRUD.

import { getDb, persist } from './db'
import type { MeasurementIn, MeasurementOut, MeasurementPatch } from '../types'

function rowToMeasurementOut(row: Record<string, unknown>): MeasurementOut {
  return {
    id: row.id as number,
    measurement_type: row.measurement_type as string,
    value: row.value as number,
    unit: (row.unit as string) ?? 'cm',
    logged_at: row.logged_at as string,
    created_at: row.created_at as string,
  }
}

export async function addMeasurement(entry: MeasurementIn): Promise<MeasurementOut | null> {
  const db = await getDb()
  const loggedAt = entry.logged_at || new Date().toISOString()
  const res = await db.run(
    `INSERT INTO body_measurements (user_id, measurement_type, value, unit, logged_at)
     VALUES (1, ?, ?, ?, ?)`,
    [entry.measurement_type, entry.value, entry.unit ?? 'cm', loggedAt],
  )
  await persist()
  const id = res.changes?.lastId
  if (id == null) return null
  const q = await db.query('SELECT * FROM body_measurements WHERE id = ?', [id])
  const rows = q.values ?? []
  return rows.length ? rowToMeasurementOut(rows[0]) : null
}

export async function listMeasurements(): Promise<MeasurementOut[]> {
  const db = await getDb()
  const res = await db.query('SELECT * FROM body_measurements ORDER BY logged_at ASC')
  return (res.values ?? []).map(rowToMeasurementOut)
}

export async function patchMeasurement(
  id: number,
  data: MeasurementPatch,
): Promise<MeasurementOut | null> {
  const db = await getDb()
  const keys = Object.keys(data).filter((k) => (data as Record<string, unknown>)[k] !== undefined)
  if (!keys.length) {
    const q = await db.query('SELECT * FROM body_measurements WHERE id = ?', [id])
    const rows = q.values ?? []
    return rows.length ? rowToMeasurementOut(rows[0]) : null
  }
  const sets = keys.map((k) => `${k} = ?`).join(', ')
  const params = keys.map((k) => (data as Record<string, unknown>)[k])
  params.push(id)
  await db.run(`UPDATE body_measurements SET ${sets} WHERE id = ?`, params)
  await persist()
  const q = await db.query('SELECT * FROM body_measurements WHERE id = ?', [id])
  const rows = q.values ?? []
  return rows.length ? rowToMeasurementOut(rows[0]) : null
}

export async function deleteMeasurement(id: number): Promise<null> {
  const db = await getDb()
  await db.run('DELETE FROM body_measurements WHERE id = ?', [id])
  await persist()
  return null
}
