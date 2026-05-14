import { useEffect, useState, type FormEvent } from 'react'
import { api, todayIso } from '../services'
import type { FoodOut } from '../types'

const DEFAULT_SECTIONS = ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner', 'Dessert']

export default function CaloriesTab() {
  const [date, setDate] = useState(todayIso())
  const [rows, setRows] = useState<FoodOut[]>([])
  const [meal, setMeal] = useState('Breakfast')
  const [food, setFood] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [sections, setSections] = useState<string[]>(DEFAULT_SECTIONS)

  const refresh = () => api.listFood(date).then(setRows).catch(() => setRows([]))

  useEffect(() => { void refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [date])
  useEffect(() => {
    api.getProfile().then((p) => {
      const ms = p?.profile?.static?.meal_sections
      if (Array.isArray(ms) && ms.length) setSections(ms)
    }).catch(() => {})
  }, [])

  const grouped = sections.map((m) => ({
    meal: m,
    items: rows.filter((r) => r.meal_type === m),
  }))
  const other = rows.filter((r) => !sections.includes(r.meal_type))
  if (other.length) grouped.push({ meal: 'Other', items: other })

  const total = rows.reduce((s, r) => s + (r.kcal || 0), 0)

  const onAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!food) return
    await api.addFood({
      date,
      meal_type: meal,
      food_name: food,
      kcal: Number(kcal) || 0,
      protein_g: Number(protein) || 0,
    })
    setFood(''); setKcal(''); setProtein('')
    void refresh()
  }

  const onDelete = async (id: number) => {
    await api.deleteFood(id)
    void refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-muted rounded-lg px-3 py-2 text-sm tnum"
        />
        <div className="text-subtle text-sm">
          Total: <span className="text-text tnum">{Math.round(total).toLocaleString()} kcal</span>
        </div>
      </div>

      {grouped.map(({ meal: m, items }) => (
        <div key={m} className="bg-card rounded-2xl border border-muted">
          <div className="px-4 py-3 border-b border-muted flex justify-between">
            <div className="font-medium">{m}</div>
            <div className="text-subtle text-sm tnum">
              {Math.round(items.reduce((s, r) => s + (r.kcal || 0), 0))} kcal
            </div>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-3 text-subtle text-sm">No items</div>
          ) : (
            <ul>
              {items.map((it) => (
                <li key={it.id} className="px-4 py-2 flex justify-between text-sm border-t border-muted/50">
                  <div>
                    <div>{it.food_name}</div>
                    {it.notes && <div className="text-subtle text-xs">{it.notes}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="tnum">{Math.round(it.kcal)} kcal</div>
                    <button
                      onClick={() => void onDelete(it.id)}
                      className="text-subtle hover:text-red-400 text-xs"
                    >
                      remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <form onSubmit={onAdd} className="bg-card rounded-2xl border border-muted p-4 space-y-3">
        <div className="font-medium">Quick add</div>
        <div className="grid grid-cols-5 gap-2">
          <select
            value={meal}
            onChange={(e) => setMeal(e.target.value)}
            className="col-span-1 bg-muted rounded-lg px-2 py-2 text-sm"
          >
            {sections.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            value={food}
            onChange={(e) => setFood(e.target.value)}
            placeholder="Food"
            className="col-span-2 bg-muted rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            placeholder="kcal"
            type="number"
            className="bg-muted rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="protein g"
            type="number"
            className="bg-muted rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button className="bg-accent hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm">Add</button>
      </form>
    </div>
  )
}
