// LLM dispatch facade. Mirrors backend/llm.py's chat_json / chat_plain shape
// so services/chat.ts reads almost identically to the FastAPI route.
//
// Backend choice + BYOK key + model name live in Capacitor Preferences (the
// same secure-on-Android keystore-backed store used for the dynamic profile).

import { Preferences } from '@capacitor/preferences'

import { groqChatRaw } from './groq'
import { mediapipeChatRaw } from './mediapipe'
import { extractJson } from './prompts'

export type LlmBackend = 'groq' | 'mediapipe'

export interface LlmSettings {
  backend: LlmBackend
  groq_api_key: string
  model: string
}

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatJsonReply {
  intent: string
  reply_markdown: string
  food_entries: Array<Record<string, unknown>>
  follow_up_options: string[]
  weight_kg?: number | string
  [key: string]: unknown
}

const KEYS = {
  backend: 'lumen.llm.backend',
  apiKey: 'lumen.groq.api_key',
  model: 'lumen.llm.model',
}

const DEFAULT_MODEL = 'llama-3.1-8b-instant'

export async function getLlmSettings(): Promise<LlmSettings> {
  const [backend, apiKey, model] = await Promise.all([
    Preferences.get({ key: KEYS.backend }),
    Preferences.get({ key: KEYS.apiKey }),
    Preferences.get({ key: KEYS.model }),
  ])
  return {
    backend: (backend.value as LlmBackend | null) ?? 'groq',
    groq_api_key: apiKey.value ?? '',
    model: model.value ?? DEFAULT_MODEL,
  }
}

export async function setLlmSettings(patch: Partial<LlmSettings>): Promise<LlmSettings> {
  const writes: Promise<unknown>[] = []
  if (patch.backend !== undefined) {
    writes.push(Preferences.set({ key: KEYS.backend, value: patch.backend }))
  }
  if (patch.groq_api_key !== undefined) {
    writes.push(Preferences.set({ key: KEYS.apiKey, value: patch.groq_api_key }))
  }
  if (patch.model !== undefined) {
    writes.push(Preferences.set({ key: KEYS.model, value: patch.model }))
  }
  await Promise.all(writes)
  return await getLlmSettings()
}

interface ChatArgs {
  systemPrompt: string
  userMessage: string
  imageB64?: string | null
  history?: ChatTurn[]
  jsonMode?: boolean
  temperature?: number
}

async function chatRaw(args: ChatArgs): Promise<string> {
  const settings = await getLlmSettings()
  if (settings.backend === 'mediapipe') {
    mediapipeChatRaw()
  }
  if (!settings.groq_api_key) {
    throw new Error(
      'No Groq API key configured. Add one in Settings — get a free key at https://console.groq.com/keys',
    )
  }
  return groqChatRaw({
    apiKey: settings.groq_api_key,
    model: settings.model || DEFAULT_MODEL,
    systemPrompt: args.systemPrompt,
    userMessage: args.userMessage,
    imageB64: args.imageB64,
    history: args.history,
    jsonMode: args.jsonMode,
    temperature: args.temperature,
  })
}

// Mirror of backend/llm.py:chat_json — guarantees a structured reply even on
// LLM error or unparseable output, so the chat flow can always render
// something sensible.
export async function chatJson(args: Omit<ChatArgs, 'jsonMode'>): Promise<ChatJsonReply> {
  let raw: string
  try {
    raw = await chatRaw({ ...args, jsonMode: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      intent: 'general',
      reply_markdown: `_LLM error: ${message}_`,
      food_entries: [],
      follow_up_options: [],
      _error: message,
    }
  }

  const parsed = extractJson(raw)
  if (parsed === null) {
    return {
      intent: 'general',
      reply_markdown: raw || '_(empty response)_',
      food_entries: [],
      follow_up_options: [],
      _raw: raw,
    }
  }
  return {
    intent: (parsed.intent as string) ?? 'general',
    reply_markdown: (parsed.reply_markdown as string) ?? '',
    food_entries: (parsed.food_entries as Array<Record<string, unknown>>) ?? [],
    follow_up_options: (parsed.follow_up_options as string[]) ?? [],
    ...parsed,
  }
}

export async function chatPlain(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    return await chatRaw({ systemPrompt, userMessage, jsonMode: false, temperature: 0.1 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return JSON.stringify({ _error: message })
  }
}
