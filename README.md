# Lumen — on-device

Self-contained mobile rebuild of [Lumen](https://github.com/Schreckgespenst/Lumen). No server to host: the entire backend (SQLite, profile store, LLM dispatch) runs inside the app process via Capacitor on Android. The Groq LLM call goes out over HTTPS directly from the device with a user-supplied API key (BYOK).

Sibling repo to `Lumen` — the hosted FastAPI build lives there; this repo is the no-hosting build.

## Status

Scaffold only. UI is placeholder pages; the data layer and LLM service are not yet wired.

## Stack

- **Capacitor 8** + **Android** platform — native shell, WebView UI.
- **Vite 8 + React 19 + TypeScript** — same UI patterns as the original Lumen.
- **Tailwind 3.4** — identical theme tokens to the original (`bg`, `card`, `muted`, `accent`, `accentSoft`, `text`, `subtle`).
- **@capacitor-community/sqlite** — on-device SQLite for food, weight, measurements, chat history.
- **@capacitor/preferences** — secure key/value store for the Groq API key and user prefs.
- **@capacitor/filesystem** — JSON profile store, mirroring `backend/user_profile.json`.

## Run (web side)

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The WebView surface is identical, so most development happens here before syncing to Android.

## Build APK

Requires JDK 21 + Android Studio + Android SDK.

```powershell
npm run build
npx cap add android        # first time only
npx cap sync
npx cap open android       # opens Android Studio; build APK from there
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (web) |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cap:sync` | Sync `dist/` into Android project |
| `npm run cap:open:android` | Open Android Studio |

## What about Lumen (the hosted repo)?

The original [`Lumen`](https://github.com/Schreckgespenst/Lumen) repo stays as the FastAPI + SQLite + React PWA build — useful for desktop, Raspberry Pi deployment, or anyone who wants a hosted version. This repo is the parallel deliverable for "just install an APK, no server."
