import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../services'
import type { WeightOut } from '../types'

const RANGES = [
  { id: '7d', label: '7d', days: 7 },
  { id: '30d', label: '30d', days: 30 },
  { id: 'all', label: 'All', days: null as number | null },
] as const
type RangeId = (typeof RANGES)[number]['id']

export default function WeightTab() {
  const [rows, setRows] = useState<WeightOut[]>([])
  const [weight, setWeight] = useState('')
  const [range, setRange] = useState<RangeId>('30d')

  const refresh = () => api.listWeight().then(setRows).catch(() => setRows([]))
  useEffect(() => { void refresh() }, [])

  const onAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!weight) return
    await api.addWeight({ weight_kg: Number(weight) })
    setWeight('')
    void refresh()
  }

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? null
    let filtered = rows
    if (days) {
      const cutoff = Date.now() - days * 86400000
      filtered = rows.filter((r) => new Date(r.logged_at).getTime() >= cutoff)
    }
    return filtered.map((r) => ({
      ...r,
      label: new Date(r.logged_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }))
  }, [rows, range])

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-muted p-4">
        <div className="flex justify-between mb-3">
          <div className="font-medium">Weight</div>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`text-xs px-2 py-1 rounded ${
                  range === r.id ? 'bg-accent text-white' : 'text-subtle hover:text-text'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="#2c3140" vertical={false} />
              <XAxis dataKey="label" stroke="#8a8f9b" fontSize={12} />
              <YAxis stroke="#8a8f9b" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip
                contentStyle={{ background: '#181b22', border: '1px solid #2c3140' }}
                labelStyle={{ color: '#8a8f9b' }}
              />
              <Line type="monotone" dataKey="weight_kg" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <form onSubmit={onAdd} className="bg-card rounded-2xl border border-muted p-4 flex gap-2">
        <input
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Weight (kg)"
          className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm"
        />
        <button className="bg-accent hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm">Log</button>
      </form>

      <div className="bg-card rounded-2xl border border-muted">
        <div className="px-4 py-3 border-b border-muted font-medium">History</div>
        {rows.length === 0 ? (
          <div className="px-4 py-3 text-subtle text-sm">No entries yet.</div>
        ) : (
          <ul>
            {[...rows].reverse().map((r) => (
              <li key={r.id} className="px-4 py-2 flex justify-between text-sm border-t border-muted/50">
                <div className="tnum text-subtle">{new Date(r.logged_at).toLocaleString()}</div>
                <div className="flex items-center gap-3">
                  <div className="tnum">{r.weight_kg.toFixed(1)} kg</div>
                  <button
                    onClick={async () => { await api.deleteWeight(r.id); void refresh() }}
                    className="text-subtle hover:text-red-400 text-xs"
                  >remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
