import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services'
import { getLlmSettings, setLlmSettings, type LlmBackend } from '../llm'

interface Field {
  name: string
  label: string
  type: string
  step?: string
  required?: boolean
  options?: string[]
}

interface Section {
  label?: string
  fields: Field[]
}

const SECTIONS: Section[] = [
  {
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'age', label: 'Age', type: 'number', required: true },
      { name: 'height_cm', label: 'Height (cm)', type: 'number', step: '0.1', required: true },
      { name: 'weight_kg', label: 'Weight (kg)', type: 'number', step: '0.1', required: true },
      {
        name: 'sex',
        label: 'Biological sex',
        type: 'select',
        options: ['male', 'female', 'other'],
        required: true,
      },
      {
        name: 'activity_level',
        label: 'Activity level',
        type: 'select',
        options: ['sedentary', 'light', 'moderate', 'active', 'very active'],
        required: true,
      },
    ],
  },
  {
    label: 'Daily goals',
    fields: [{ name: 'calorie_goal', label: 'Calorie goal (kcal)', type: 'number', required: true }],
  },
  {
    label: 'Optional',
    fields: [
      { name: 'body_fat_pct', label: 'Body fat %', type: 'number', step: '0.1' },
      { name: 'bmr', label: 'BMR', type: 'number' },
    ],
  },
]

type FormState = Record<string, string>

export default function Setup() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.getProfile().then((p) => {
      if (p?.user) {
        const u = p.user
        setForm({
          name: u.name ?? '',
          age: String(u.age ?? ''),
          height_cm: String(u.height_cm ?? ''),
          weight_kg: String(u.weight_kg ?? ''),
          sex: u.sex ?? '',
          activity_level: u.activity_level ?? '',
          calorie_goal: String(u.calorie_goal ?? ''),
          body_fat_pct: u.body_fat_pct == null ? '' : String(u.body_fat_pct),
          bmr: u.bmr == null ? '' : String(u.bmr),
        })
      }
    }).catch(() => {})
  }, [])

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.setup({
        name: form.name,
        age: Number(form.age),
        height_cm: Number(form.height_cm),
        weight_kg: Number(form.weight_kg),
        sex: form.sex,
        activity_level: form.activity_level,
        calorie_goal: Number(form.calorie_goal),
        body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null,
        bmr: form.bmr ? Number(form.bmr) : null,
      })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold mb-1">Set up your profile</h1>
        <p className="text-subtle">Lumen uses this to ground every reply from the AI.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-5 bg-card rounded-2xl p-6 border border-muted">
        {SECTIONS.map((section, i) => (
          <div key={i} className="space-y-4">
            {section.label && (
              <div className="pt-2 border-t border-muted">
                <div className="text-xs uppercase tracking-wide text-subtle mt-3 mb-1">
                  {section.label}
                </div>
              </div>
            )}
            {section.fields.map((f) => (
              <div key={f.name} className="grid grid-cols-3 items-center gap-3">
                <label htmlFor={f.name} className="col-span-1 text-sm text-subtle">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    id={f.name}
                    name={f.name}
                    value={form[f.name] ?? ''}
                    onChange={onChange}
                    required={f.required}
                    className="col-span-2 bg-muted rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
                  >
                    <option value="" disabled>Select…</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    id={f.name}
                    name={f.name}
                    type={f.type}
                    step={f.step}
                    value={form[f.name] ?? ''}
                    onChange={onChange}
                    required={f.required}
                    className="col-span-2 bg-muted rounded-lg px-3 py-2 tnum outline-none focus:ring-2 focus:ring-accent"
                  />
                )}
              </div>
            ))}
          </div>
        ))}
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={saving}
          className="w-full mt-2 bg-accent hover:bg-purple-500 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <LlmSettingsCard />
      <ChatSettingsCard />
    </div>
  )
}

function ChatSettingsCard() {
  const [autoClearDaily, setAutoClearDaily] = useState(false)
  const [lastClearDate, setLastClearDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    api.getChatSettings().then((s) => {
      setAutoClearDaily(s.autoClearDaily)
      setLastClearDate(s.lastClearDate)
    }).catch(() => {})
  }, [])

  const onToggle = async (next: boolean) => {
    setSaving(true)
    setStatus(null)
    try {
      const s = await api.setChatSettings({ autoClearDaily: next })
      setAutoClearDaily(s.autoClearDaily)
      setLastClearDate(s.lastClearDate)
      setStatus(
        next
          ? 'Daily auto-clear enabled. Chat will wipe on the first launch of each new day.'
          : 'Daily auto-clear disabled.',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 bg-card rounded-2xl p-6 border border-muted">
      <div>
        <h2 className="text-xl font-semibold">Chat settings</h2>
        <p className="text-subtle text-sm mt-1">
          Optional daily reset for the chat panel. Food, weight, and measurements
          already in the Tracker are never touched.
        </p>
      </div>

      <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
        <div className="flex-1">
          <div className="text-sm">Auto-clear chat every day</div>
          <div className="text-subtle text-xs mt-0.5">
            Wipes chat history on the first app open each calendar day.
            {lastClearDate && (
              <> Last clear: <span className="tnum">{lastClearDate}</span>.</>
            )}
          </div>
        </div>
        <input
          type="checkbox"
          checked={autoClearDaily}
          disabled={saving}
          onChange={(e) => void onToggle(e.target.checked)}
          className="h-5 w-5 accent-accent shrink-0"
        />
      </label>

      {status && <div className="text-sm text-subtle">{status}</div>}
    </div>
  )
}

function LlmSettingsCard() {
  const [backend, setBackend] = useState<LlmBackend>('groq')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [revealKey, setRevealKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    getLlmSettings().then((s) => {
      setBackend(s.backend)
      setApiKey(s.groq_api_key)
      setModel(s.model)
    }).catch(() => {})
  }, [])

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setStatus(null)
    try {
      await setLlmSettings({ backend, groq_api_key: apiKey.trim(), model: model.trim() })
      setStatus('Saved.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-4 bg-card rounded-2xl p-6 border border-muted">
      <div>
        <h2 className="text-xl font-semibold">LLM settings</h2>
        <p className="text-subtle text-sm mt-1">
          Bring your own Groq key — get a free one at{' '}
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer"
             className="text-accent hover:underline">console.groq.com/keys</a>.
          Stored locally in Capacitor Preferences. Never uploaded.
        </p>
      </div>

      <div className="grid grid-cols-3 items-center gap-3">
        <label htmlFor="llm_backend" className="text-sm text-subtle">Backend</label>
        <select
          id="llm_backend"
          value={backend}
          onChange={(e) => setBackend(e.target.value as LlmBackend)}
          className="col-span-2 bg-muted rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="groq">Groq (cloud)</option>
          <option value="mediapipe">On-device (not implemented)</option>
        </select>
      </div>

      <div className="grid grid-cols-3 items-center gap-3">
        <label htmlFor="groq_api_key" className="text-sm text-subtle">Groq API key</label>
        <div className="col-span-2 flex gap-2">
          <input
            id="groq_api_key"
            type={revealKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="gsk_…"
            autoComplete="off"
            className="flex-1 bg-muted rounded-lg px-3 py-2 tnum outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            onClick={() => setRevealKey((v) => !v)}
            className="text-xs text-subtle hover:text-text px-2"
          >
            {revealKey ? 'hide' : 'show'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 items-center gap-3">
        <label htmlFor="llm_model" className="text-sm text-subtle">Model</label>
        <input
          id="llm_model"
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="llama-3.1-8b-instant"
          className="col-span-2 bg-muted rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {status && <div className="text-sm text-subtle">{status}</div>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent hover:bg-purple-500 text-white font-medium py-2 rounded-lg disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save LLM settings'}
      </button>
    </form>
  )
}
