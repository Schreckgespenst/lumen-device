// Groq Cloud chat completions, OpenAI-compatible REST endpoint. The only
// outbound HTTPS traffic in the whole app — uses the user's BYOK key.
//
// Llama 3.1 8B Instant is text-only; if an image is attached we append a note
// to the user message rather than 500ing, matching the Lumen reference impl.

import type { ChatTurn } from './index'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

interface GroqChoice {
  message?: { content?: string | null }
}

interface GroqCompletion {
  choices?: GroqChoice[]
  error?: { message?: string }
}

export interface GroqChatArgs {
  apiKey: string
  model: string
  systemPrompt: string
  userMessage: string
  imageB64?: string | null
  history?: ChatTurn[]
  jsonMode?: boolean
  temperature?: number
}

export async function groqChatRaw(args: GroqChatArgs): Promise<string> {
  const { apiKey, model, systemPrompt, history, imageB64 } = args
  let userMessage = args.userMessage
  if (imageB64) {
    userMessage +=
      '\n\n[Note: an image was attached but the current LLM backend ' +
      '(text-only) cannot read it. Describe the photo in words to log it.]'
  }

  const messages: ChatTurn[] = [{ role: 'system', content: systemPrompt }]
  if (history?.length) messages.push(...history)
  messages.push({ role: 'user', content: userMessage })

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: args.temperature ?? 0.3,
  }
  if (args.jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) {
    // Surface Groq's error.message when present, otherwise raw body.
    try {
      const data = JSON.parse(text) as GroqCompletion
      throw new Error(data.error?.message || `Groq ${res.status} ${res.statusText}`)
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Groq ${res.status} ${res.statusText}: ${text}`)
      }
      throw err
    }
  }

  const data = JSON.parse(text) as GroqCompletion
  return data.choices?.[0]?.message?.content ?? ''
}
