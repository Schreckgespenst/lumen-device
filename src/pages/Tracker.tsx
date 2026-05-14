import { useState } from 'react'
import CaloriesTab from '../components/CaloriesTab'
import WeightTab from '../components/WeightTab'
import MeasurementsTab from '../components/MeasurementsTab'

const TABS = ['Calories', 'Weight', 'Measurements'] as const
type Tab = (typeof TABS)[number]

export default function Tracker() {
  const [tab, setTab] = useState<Tab>('Calories')

  return (
    <div>
      <h1 className="text-3xl font-semibold mb-4">Tracker</h1>
      <div className="flex gap-2 border-b border-muted mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 -mb-px border-b-2 ${
              tab === t ? 'border-accent text-text' : 'border-transparent text-subtle hover:text-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'Calories' && <CaloriesTab />}
      {tab === 'Weight' && <WeightTab />}
      {tab === 'Measurements' && <MeasurementsTab />}
    </div>
  )
}
