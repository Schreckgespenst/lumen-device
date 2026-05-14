// Single SQLite connection used by every service module.
// On web the @capacitor-community/sqlite plugin needs the jeep-sqlite custom
// element registered + initWebStore() before any DB call works; on native it
// goes straight to the platform plugin.

import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'

import { DB_NAME, DB_VERSION, SCHEMA_SQL } from './schema'

const sqlite = new SQLiteConnection(CapacitorSQLite)
const isWeb = Capacitor.getPlatform() === 'web'

let dbPromise: Promise<SQLiteDBConnection> | null = null

async function doInit(): Promise<SQLiteDBConnection> {
  if (isWeb) {
    const { defineCustomElements } = await import('jeep-sqlite/loader')
    defineCustomElements(window)
    await customElements.whenDefined('jeep-sqlite')
    if (!document.querySelector('jeep-sqlite')) {
      const jeepEl = document.createElement('jeep-sqlite')
      document.body.appendChild(jeepEl)
    }
    await sqlite.initWebStore()
  }

  let db: SQLiteDBConnection
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result
  if (isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false)
  } else {
    db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)
  }
  await db.open()
  await db.execute(SCHEMA_SQL)
  return db
}

export function initDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) dbPromise = doInit()
  return dbPromise
}

export async function getDb(): Promise<SQLiteDBConnection> {
  if (!dbPromise) throw new Error('initDb() must be awaited before any DB access')
  return dbPromise
}

// Web-only: flush the in-memory DB to IndexedDB. No-op on native (platform
// SQLite persists writes immediately). Call after every mutating statement
// so a page reload preserves the change.
export async function persist(): Promise<void> {
  if (!isWeb) return
  await sqlite.saveToStore(DB_NAME)
}
