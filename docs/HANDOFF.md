# Session Handoff — 2026-05-14 (Phase 1 complete)

A pointer doc for the next Claude Code session in **`lumen-device`**. Read this first to pick up state. Things that live in [`../README.md`](../README.md) are not repeated here.

## What this repo is

`lumen-device` is the **no-hosting** sibling rebuild of [`Lumen`](https://github.com/Schreckgespenst/Lumen). Same app, same UI design, same SQLite schema, same Groq JSON contract — but the FastAPI backend collapses **into** the app process so there's no server to run.

- The hosted `Lumen` repo stays the canonical desktop / Raspberry Pi build.
- `lumen-device` ships as an Android APK. Everything (UI, SQLite, profile store, LLM dispatch) runs in-process via Capacitor. The Groq HTTPS call is the only outbound traffic, with the user's own API key (BYOK).

## Where we left off (HEAD = `3873d22`)

- **Phase 1 done.** Bootstrap scaffold pushed to `github.com/Schreckgespenst/lumen-device` on `main`.
- Stack landed: Capacitor 8 + Vite 8 + React 19 + TS 6 + Tailwind 3.4 + `@capacitor-community/sqlite` + `@capacitor/preferences` + `@capacitor/filesystem` + `react-router-dom@7`.
- `npm run build` passes (28 modules, 233 KB / 75 KB gzipped).
- No servers running. No persistent state in this repo yet — everything will live on-device once Phase 3 lands.

## Phased plan

| Phase | What | Status |
|---|---|---|
| 1 | Bootstrap (Vite scaffold, Tailwind, Capacitor, theme tokens, placeholder pages) | **Done** (`3873d22`) |
| 2 | UI port — copy `frontend/src/` from `Lumen` repo, convert `.jsx`→`.tsx`, stub data with empty-array TS service calls so all six screens render | **Next** |
| 3 | On-device data layer — TS service modules wrapping `@capacitor-community/sqlite`, one per backend route file. Replace `api.js`-shaped fetches with direct imports. | Pending |
| 4 | LLM dispatch + Groq port — port `backend/llm.py` to TS; `llm/groq.ts` is the only working provider; `llm/mediapipe.ts` is a no-op stub. Settings screen for BYOK key entry. | Pending |
| 5 | Android build — `cap add android`, `cap sync`, `cap open android`, produce installable APK | Blocked on Android tools (see below) |

## Phase 2 starter checklist

The fastest path to a visually-complete-but-data-stubbed app:

1. Copy these files from `../Fitness_App/frontend/src/` over:
   - `pages/Dashboard.jsx` → `src/pages/Dashboard.tsx`
   - `pages/Chat.jsx` → `src/pages/Chat.tsx`
   - `pages/Tracker.jsx` → `src/pages/Tracker.tsx`
   - `pages/Setup.jsx` → `src/pages/Setup.tsx`
   - `components/CaloriesTab.jsx` → `src/components/CaloriesTab.tsx`
   - `components/WeightTab.jsx` → `src/components/WeightTab.tsx`
   - `components/MeasurementsTab.jsx` → `src/components/MeasurementsTab.tsx`
2. Convert each `.jsx` → `.tsx`: add prop/state types, swap `useState()` → `useState<T>()`, give the array `useState` calls real element types from `src/types.ts` (which doesn't exist yet — create it by porting Pydantic models from `backend/schemas.py` and `backend/models.py`).
3. Replace every `api.<method>(...)` call with a stub from `src/services/index.ts` that returns `Promise.resolve([])` (lists) or `Promise.resolve(null)` (single objects). All real wiring is Phase 3.
4. Routes already exist in `App.tsx`. Just point them at the real pages instead of placeholders.
5. Smoke-test in the browser: `npm run dev`. All four routes should render the Lumen design with empty / "No items" states.

## Open action items the user owns

1. **Decide when to install Android tools.** Currently no `java`, `javac`, `adb`, or `ANDROID_HOME` on this machine. APK build (Phase 5) is blocked until JDK 21 + Android Studio + Android SDK are installed (~3 GB, 30–60 min). The user explicitly deferred this; revisit after Phase 4.
2. **`Lumen-Local` cleanup** — there's an older sibling scaffold at `../Lumen-Local` from before the `lumen-device` name was picked. User said discard, but a Windows process lock prevented even renaming it. It's untouched. User to delete manually when convenient.
3. **No secrets to rotate yet for this repo** — Groq key entry only happens at runtime via Settings (BYOK, stored in Capacitor Preferences). Don't ship any embedded key.

## How to start from a cold session

```powershell
cd c:\Users\Shikher Gupta\Documents\PythonProjz\lumen-device
npm install         # if node_modules is missing
npm run dev         # opens http://localhost:5173
```

Once Phase 5 is reached:
```powershell
npm run build
npx cap add android
npx cap sync
npx cap open android   # builds APK from Android Studio
```

## Architectural rules (locked in)

- **No backend HTTP.** The UI imports TS service modules directly. No `fetch('/api/...')` anywhere.
- **HashRouter, not BrowserRouter.** Capacitor runs at `file://` (or `https://localhost` via `androidScheme`), and path-based routing breaks on deep links there.
- **Tailwind tokens are the source of truth**, not the Stitch mockups' rendered hex values. Use `bg`, `card`, `muted`, `accent`, `accentSoft`, `text`, `subtle` — same as `Lumen`.
- **BYOK key storage** = `@capacitor/preferences` (secure on Android Keystore-backed when available). Never embed a key in the bundle.
- **Dispatch shape mirrors Lumen's** — `llm.ts` switches on a backend mode, `groq.ts` and `mediapipe.ts` are the two implementations. Same pattern Lumen uses for `groq` / `ollama` in `backend/llm.py`.
- **SQLite schema verbatim** from Lumen — five tables: `users`, `food_log`, `weight_log`, `body_measurements`, `chat_history`. Single user (`user_id=1`), no auth.
- **JSON chat contract verbatim** from `backend/prompts.py` — `intent` / `reply_markdown` / `food_entries[]` / `follow_up_options[]`. Same fallback (plain markdown reply, no DB writes) when JSON parsing fails.

## Repo map at handoff time

| Path | What |
|---|---|
| [`../README.md`](../README.md) | What the project is, stack, run/build commands |
| [`./HANDOFF.md`](./HANDOFF.md) | This file |
| [`../src/main.tsx`](../src/main.tsx) | Entry — wraps `App` in `HashRouter` |
| [`../src/App.tsx`](../src/App.tsx) | Top nav (NavLink active state in accent purple), four routes |
| [`../src/pages/`](../src/pages/) | Placeholder Dashboard / Chat / Tracker / Setup |
| [`../capacitor.config.ts`](../capacitor.config.ts) | `appId: com.lumen.device`, SQLite plugin config |
| [`../tailwind.config.js`](../tailwind.config.js) | Lumen theme tokens + Inter fallback stack |
| [`../vite.config.ts`](../vite.config.ts) | `base: './'` so bundled assets load inside the Android WebView |

## Memory pointers (auto-loaded)

- `project_lumen.md` — the hosted Lumen repo's durable picture
- `project_lumen_device.md` — this repo's durable picture, including Stitch-derived design decisions and known environment gaps
- `project_lumen_stitch.md` — Stitch IDs and quirks. Lumen's design system is the visual source of truth for this repo too.
- `feedback_api_keys.md` — the recurring "user pastes secrets" pattern. BYOK Settings flow means this could happen again in this repo too.

If anything in this handoff contradicts memory, trust the handoff (it is newer).

## Conventions

- Short, terse responses preferred over verbose summaries.
- PowerShell syntax on Windows; use the Bash tool only for POSIX scripts.
- Sandbox is scoped to a single project directory — sibling-directory operations need `dangerouslyDisableSandbox: true` on Bash commands (used during Phase 1 to scaffold and commit).
- One bundled commit per logical shipment.
- HTTPS for `git push`, not SSH. The bash subshell's `known_hosts` is empty so SSH push fails non-interactively.
- Don't write `git config` (per project rules). Use inline `git -c user.name=... -c user.email=...` for commits if a fresh local repo doesn't have identity set.
