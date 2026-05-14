import { useEffect, useState, type ReactNode } from 'react'
import { Routes, Route, Navigate, Link, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Tracker from './pages/Tracker'
import Setup from './pages/Setup'
import { api } from './services'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const location = useLocation()

  useEffect(() => {
    api.getProfile()
      .then((p) => setHasProfile(Boolean(p?.user)))
      .catch(() => setHasProfile(false))
      .finally(() => setLoading(false))
  }, [location.pathname])

  if (loading) {
    return <div className="p-8 text-subtle">Loading…</div>
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-muted px-6 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 sm:pb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="text-2xl font-semibold tracking-tight">Lumen</Link>
        <nav className="flex gap-4 sm:gap-5 text-sm">
          <NavItem to="/" end>Dashboard</NavItem>
          <NavItem to="/chat">Chat</NavItem>
          <NavItem to="/tracker">Tracker</NavItem>
          <NavItem to="/setup">Settings</NavItem>
        </nav>
      </header>
      <main className="px-6 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] max-w-5xl mx-auto">
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route
            path="/"
            element={hasProfile ? <Dashboard /> : <Navigate to="/setup" replace />}
          />
          <Route
            path="/tracker"
            element={hasProfile ? <Tracker /> : <Navigate to="/setup" replace />}
          />
          <Route
            path="/chat"
            element={hasProfile ? <Chat /> : <Navigate to="/setup" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

function NavItem({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        isActive ? 'text-accent font-medium' : 'text-subtle hover:text-text transition'
      }
    >
      {children}
    </NavLink>
  )
}
