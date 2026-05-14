import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { initDb } from './services'
import './index.css'

const rootEl = document.getElementById('root')!

initDb()
  .then(() => {
    createRoot(rootEl).render(
      <StrictMode>
        <HashRouter>
          <App />
        </HashRouter>
      </StrictMode>,
    )
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    rootEl.innerHTML = `
      <div style="padding:2rem;color:#e6e7eb;font-family:Inter,sans-serif;max-width:40rem;margin:auto">
        <h1 style="font-size:1.5rem;font-weight:600;margin-bottom:.5rem">Database init failed</h1>
        <p style="color:#8a8f9b">${message}</p>
      </div>`
    console.error('Database init failed', err)
  })
