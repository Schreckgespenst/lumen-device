import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../services'
import type { MeasurementOut } from '../types'

const DEFAULT_TYPES = ['chest', 'waist', 'hips', 'arms', 'thighs']
const RANGES = [
  { id: '30d', label: '30d', days: 30 },
  { id: '90d', label: '90d', days: 90 },
  { id: 'all', label: 'All', days: null as number | null },
] as const
type RangeId = (typeof RANGES)[number]['id']

interface ChartRow extends MeasurementOut {
  label: string
}

export default function MeasurementsTab() {
  const [rows, setRows] = useState<MeasurementOut[]>([])
  const [types, setTypes] = useState<string[]>(DEFAULT_TYPES)
  const [type, setType] = useState<string>(DEFAULT_TYPES[0])
  const [value, setValue] = useState('')
  const [range, setRange] = useState<RangeId>('30d')

  const refresh = () => api.listMeasurements().then(setRows).catch(() => setRows([]))
  useEffect(() => { void refresh() }, [])
  useEffect(() => {
    api.getProfile().then((p) => {
      const t = p?.profile?.static?.measurement_types
      if (Array.isArray(t) && t.length) { setTypes(t); setType(t[0]) }
    }).catch(() => {})
  }, [])

  const onAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!value) return
    await api.addMeasurement({ measurement_type: type, value: Number(value), unit: 'cm' })
    setValue('')
    void refresh()
  }

  const byType = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? null
    const cutoff = days ? Date.now() - days * 86400000 : null
    const out: Record<string, ChartRow[]> = {}
    for (const t of types) out[t] = []
    for (const r of rows) {
      if (cutoff && new Date(r.logged_at).getTime() < cutoff) continue
      if (!out[r.measurement_type]) out[r.measurement_type] = []
      out[r.measurement_type].push({
        ...r,
        label: new Date(r.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      })
    }
    return out
  }, [rows, types, range])

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={`text-xs px-2 py-1 rounded ${
              range === r.id ? 'bg-accent text-white' : 'text-subtle hover:text-text'
            }`}
          >{r.label}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {types.map((t) => (
          <div key={t} className="bg-card rounded-2xl border border-muted p-4">
            <div className="font-medium capitalize mb-2">{t}</div>
            <div className="h-48">
              <ResponsiveContainer>
                <LineChart data={byType[t] || []} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                  <CartesianGrid stroke="#2c3140" vertical={false} />
                  <XAxis dataKey="label" stroke="#8a8f9b" fontSize={11} />
                  <YAxis stroke="#8a8f9b" fontSize={11} domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip
                    contentStyle={{ background: '#181b22', border: '1px solid #2c3140' }}
                    labelStyle={{ color: '#8a8f9b' }}
                  />
                  <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onAdd} className="bg-card rounded-2xl border border-muted p-4 flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="bg-muted rounded-lg px-3 py-2 text-sm"
        >
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value (cm)"
          className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm"
        />
        <button className="bg-accent hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm">Log</button>
      </form>
    </div>
  )
}
