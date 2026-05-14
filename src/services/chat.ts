// Persistence layer for chat history (chat_history table).
//
// Phase 3 scope: history reads/writes/clear are real, sendChat() persists
// the user's message and a stub assistant reply explaining that LLM dispatch
// lands in Phase 4. The reply text never claims to have parsed food entries
// or follow-up options — those will appear once Groq is wired up.

import { getDb, persist } from './db'
import type { ChatMessageOut, ChatOut } from '../types'

const PHASE4_NOTICE =
  '_LLM dispatch lands in Phase 4 (Groq + BYOK). Your message was saved to history._'

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

export async function sendChat(message: string, _image_b64: string | null = null): Promise<ChatOut> {
  await insertMessage('user', message)
  await insertMessage('assistant', PHASE4_NOTICE)
  await persist()
  return {
    reply: PHASE4_NOTICE,
    follow_up_options: [],
    food_entries_added: 0,
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
