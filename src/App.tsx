import { Routes, Route, NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Tracker from './pages/Tracker'
import Setup from './pages/Setup'

export default function App() {
  return (
    <div className="min-h-full">
      <header className="px-6 py-4 border-b border-muted flex items-center justify-between">
        <span className="text-2xl font-semibold tracking-tight">Lumen</span>
        <nav className="flex gap-5 text-sm">
          <NavItem to="/" end>Dashboard</NavItem>
          <NavItem to="/chat">Chat</NavItem>
          <NavItem to="/tracker">Tracker</NavItem>
          <NavItem to="/setup">Settings</NavItem>
        </nav>
      </header>
      <main className="px-6 py-6 max-w-5xl mx-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/setup" element={<Setup />} />
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
