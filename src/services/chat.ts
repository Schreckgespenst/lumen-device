// Mirrors backend/routes/chat.py: builds the system prompt from the user's
// profile + today's log + recent weight, calls the LLM dispatch in JSON mode,
// persists any food_entries the model returned, and kicks off the profile
// learning side call in the background.

import { getDb, persist } from './db'
import { getProfile, applyDynamicPatch } from './profile'
import { addFood } from './food'
import {
  chatJson,
  chatPlain,
  type ChatTurn,
} from '../llm'
import {
  buildSystemPrompt,
  buildProfileLearningPrompt,
  extractJson,
  type LogEntry,
  type RecentWeight,
} from '../llm/prompts'
import type { ChatMessageOut, ChatOut } from '../types'

const HISTORY_TURNS = 6
const RECENT_WEIGHT_LIMIT = 7

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function rowToMessage(row: Record<string, unknown>): ChatMessageOut {
  return {
    id: row.id as number,
    role: row.role as string,
    content: (row.content as string) ?? '',
    created_at: row.created_at as string,
  }
}

async function insertMessage(role: 'user' | 'assistant', content: string): Promise<void> {
  const db = await getDb()
  await db.run('INSERT INTO chat_history (user_id, role, content) VALUES (1, ?, ?)', [
    role,
    content,
  ])
}

async function loadRecentHistory(): Promise<ChatTurn[]> {
  const db = await getDb()
  const res = await db.query(
    'SELECT role, content FROM chat_history ORDER BY created_at DESC LIMIT ?',
    [HISTORY_TURNS],
  )
  const rows = res.values ?? []
  return rows
    .reverse()
    .map((r) => ({ role: (r as Record<string, unknown>).role as ChatTurn['role'], content: (r as Record<string, unknown>).content as string }))
}

async function loadTodaysLog(today: string): Promise<LogEntry[]> {
  const db = await getDb()
  const res = await db.query(
    `SELECT meal_type, food_name, kcal, protein_g, carbs_g, fat_g, fiber_g, notes
       FROM food_log
      WHERE date = ?
      ORDER BY created_at ASC`,
    [today],
  )
  const rows = res.values ?? []
  return rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      meal_type: row.meal_type as string,
      food_name: row.food_name as string,
      kcal: (row.kcal as number) ?? 0,
      protein_g: (row.protein_g as number) ?? 0,
      carbs_g: (row.carbs_g as number) ?? 0,
      fat_g: (row.fat_g as number) ?? 0,
      fiber_g: (row.fiber_g as number) ?? 0,
      notes: (row.notes as string | null) ?? null,
    }
  })
}

async function loadRecentWeight(): Promise<RecentWeight[]> {
  const db = await getDb()
  const res = await db.query(
    'SELECT weight_kg, logged_at FROM weight_log ORDER BY logged_at DESC LIMIT ?',
    [RECENT_WEIGHT_LIMIT],
  )
  const rows = res.values ?? []
  return rows.map((r) => {
    const row = r as Record<string, unknown>
    return {
      weight_kg: row.weight_kg as number,
      logged_at: row.logged_at as string,
    }
  })
}

async function persistFoodEntries(today: string, entries: Array<Record<string, unknown>>): Promise<number> {
  let added = 0
  for (const fe of entries) {
    try {
      await addFood({
        date: (fe.date as string | undefined) || today,
        meal_type: (fe.meal_type as string | undefined) || 'Other',
        food_name: (fe.food_name as string | undefined) || '(unnamed)',
        kcal: Number(fe.kcal ?? 0),
        protein_g: Number(fe.protein_g ?? 0),
        carbs_g: Number(fe.carbs_g ?? 0),
        fat_g: Number(fe.fat_g ?? 0),
        fiber_g: Number(fe.fiber_g ?? 0),
        notes: (fe.notes as string | undefined) || null,
      })
      added += 1
    } catch {
      // skip malformed rows, match backend behaviour
    }
  }
  return added
}

async function runProfileLearning(userMsg: string, replySummary: string): Promise<void> {
  try {
    const { profile } = await getProfile()
    const existingDynamic = (profile.dynamic ?? {}) as Record<string, unknown>
    const prompt = buildProfileLearningPrompt(userMsg, replySummary, existingDynamic)
    const raw = await chatPlain('You extract durable user facts as JSON.', prompt)
    const patch = extractJson(raw)
    if (patch) await applyDynamicPatch(patch)
  } catch {
    // Non-fatal — profile learning runs in the background.
  }
}

export async function sendChat(message: string, image_b64: string | null = null): Promise<ChatOut> {
  const today = todayIso()
  const { profile } = await getProfile()
  const [todaysLog, recentWeight, history] = await Promise.all([
    loadTodaysLog(today),
    loadRecentWeight(),
    loadRecentHistory(),
  ])

  const systemPrompt = buildSystemPrompt(today, profile, todaysLog, recentWeight)

  // Persist user turn first so it's visible even if the LLM call errors.
  await insertMessage('user', message)
  await persist()

  const parsed = await chatJson({
    systemPrompt,
    userMessage: message,
    imageB64: image_b64,
    history,
  })

  const replyMd = parsed.reply_markdown || ''
  const followUps = parsed.follow_up_options || []
  const added = await persistFoodEntries(today, parsed.food_entries || [])

  await insertMessage('assistant', replyMd)
  await persist()

  // Fire-and-forget — must not block the user-visible reply.
  void runProfileLearning(message, replyMd)

  return {
    reply: replyMd,
    parsed,
    follow_up_options: followUps,
    food_entries_added: added,
  }
}

export async function chatHistory(): Promise<ChatMessageOut[]> {
  const db = await getDb()
  const res = await db.query('SELECT * FROM chat_history ORDER BY created_at ASC')
  return (res.values ?? []).map(rowToMessage)
}

export async function clearChat(): Promise<null> {
  const db = await getDb()
  await db.run('DELETE FROM chat_history')
  await persist()
  return null
}
