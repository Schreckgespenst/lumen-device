import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { api } from '../services'

interface ChatMessage {
  id: number
  role: string
  content: string
  created_at?: string
}

const TEXTAREA_MAX_PX = 160

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [imageB64, setImageB64] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [followUps, setFollowUps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    api.chatHistory().then((rows) => setMessages(rows as ChatMessage[])).catch(() => {})
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX_PX) + 'px'
  }, [draft])

  const send = async (text?: string) => {
    const content = (text ?? draft).trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    setMessages((m) => [...m, { role: 'user', content, id: Date.now() }])
    setDraft('')
    try {
      const res = await api.sendChat(content, imageB64)
      setImageB64(null)
      setFollowUps(res.follow_up_options || [])
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, id: Date.now() + 1 }])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const onImage = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      // strip data URL prefix — providers expect raw b64
      const b64 = String(result).split(',', 2)[1] || String(result)
      setImageB64(b64)
    }
    reader.readAsDataURL(f)
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void send()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const onClearChat = async () => {
    if (sending) return
    if (!window.confirm('Clear all chat history? Food and weight already logged stay in the Tracker.')) return
    try {
      await api.clearChat()
      setMessages([])
      setFollowUps([])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-180px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-h-[60vh]">
      <div className="flex justify-end pb-2">
        <button
          type="button"
          onClick={() => void onClearChat()}
          disabled={messages.length === 0 || sending}
          className="text-xs text-subtle hover:text-red-400 disabled:opacity-40 disabled:hover:text-subtle"
        >
          Clear chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 && (
          <div className="text-subtle text-sm">
            Try: <i>"For lunch I had 2 boiled eggs and a glass of orange juice."</i>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id ?? `${m.role}-${m.created_at}`}
            className={`rounded-2xl p-4 ${
              m.role === 'user' ? 'bg-accentSoft self-end ml-12' : 'bg-card border border-muted mr-12'
            }`}
          >
            <div className="text-[10px] uppercase tracking-[0.12em] text-subtle mb-1.5">{m.role}</div>
            <div className="markdown text-sm leading-relaxed tnum">
              <ReactMarkdown>{m.content || ''}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {followUps.length > 0 && (
        <div className="flex flex-wrap gap-2 my-3">
          {followUps.map((f) => (
            <button
              key={f}
              onClick={() => void send(f)}
              className="text-sm px-3 py-1.5 bg-muted rounded-full hover:bg-accentSoft hover:text-text"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {error && <div className="text-red-400 text-sm my-2">{error}</div>}
      {imageB64 && <div className="text-subtle text-xs mb-2">Image attached.</div>}

      <form onSubmit={onSubmit} className="flex gap-2 items-end border-t border-muted pt-3">
        <label className="bg-muted px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-accentSoft">
          📎
          <input type="file" accept="image/*" className="hidden" onChange={onImage} />
        </label>
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={sending ? 'Thinking…' : 'Tell Lumen what you ate, or ask a question.'}
          onKeyDown={onKeyDown}
          className="flex-1 bg-muted rounded-lg px-3 py-2 resize-none overflow-y-auto focus:ring-2 focus:ring-accent outline-none leading-5"
          style={{ maxHeight: TEXTAREA_MAX_PX }}
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-accent hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}
