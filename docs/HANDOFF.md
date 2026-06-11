# Session Handoff — v0.1.1 live, no committed roadmap

A pointer doc for the next Claude Code session in **`lumen-device`**. Read this first to pick up state. Things that live in [`../README.md`](../README.md) or [`./ARCHITECTURE.md`](./ARCHITECTURE.md) are not repeated here — read those for the "what" and the "how it works."

## What this repo is

`lumen-device` is the **no-hosting** sibling rebuild of [`Lumen`](https://github.com/Schreckgespenst/Lumen). Same app, same UI design, same SQLite schema, same Groq JSON contract — but the FastAPI backend collapses **into** the app process so there's no server to run.

- The hosted `Lumen` repo stays the canonical desktop / Raspberry Pi build.
- `lumen-device` ships as an Android APK. Everything (UI, SQLite, profile store, LLM dispatch) runs in-process via Capacitor. The Groq HTTPS call is the only outbound traffic, with the user's own API key (BYOK).

## Where we are

All five build phases are shipped. Two beta releases are out on GitHub. The app has had a week of real-device use; the bugs that surfaced are fixed in v0.1.1.

| Phase | What | Status | Commit |
|---|---|---|---|
| 1 | Bootstrap (Vite scaffold, Tailwind, Capacitor, theme tokens, placeholder pages) | **Done** | `3873d22` |
| 2 | UI port — pages/components ported from `Lumen`, stubbed service layer | **Done** | `71d565e` |
| 3 | On-device data layer — `@capacitor-community/sqlite` + `@capacitor/preferences`, one module per backend route file | **Done** | `76e30e7` |
| 4 | LLM dispatch + Groq port + BYOK Settings | **Done** | `a332175` |
| – | WASM loading fix (sql.js pin + dev middleware) | **Done** | `277afae`, `b07e45d` |
| 5 | Android build — `cap add android`, `cap sync`, debug APK via `gradlew assembleDebug` | **Done** | `12ac2d5` (v0.1.0) |
| – | Device QA after first day on device (date desync, weight from chat, safe-area insets, auto-grow textarea) | **Done** | `12ac2d5` (v0.1.0) |
| – | Week-of-use bugs (duplicate food entries, literal placeholders in LLM replies, Clear chat button) | **Done** | v0.1.1 |
| – | Daily auto-clear chat toggle (opt-in, fires on first launch of each local day) | **Done** | v0.1.2 |
| 6 | Curated on-device food database (~1500-row SQLite seed + pre-fetch RAG into prompt) | **Planned** — see [`./PHASE6-FOOD-DB.md`](./PHASE6-FOOD-DB.md) | – |

`npm run build` is green: 771 modules, ~754 KB / ~227 KB gzipped. Debug APK is ~25.8 MB. The bundle warning about >500 KB chunks is informational — recharts + sqlite glue dominate.

**Next phase is scoped, not started.** Phase 6 (curated on-device food database) was researched in 2026-06-11 via an 18-agent adversarial workflow and the plan lives at [`./PHASE6-FOOD-DB.md`](./PHASE6-FOOD-DB.md). Pick that up directly if you want to start the work. An earlier MediaPipe + Gemma 3n on-device-LLM plan was scoped in 2026-06-07 and declined; see [v0.1.1 changelog notes](../CHANGELOG.md) for the trade-offs.

## Architectural rules (locked in)

- **No backend HTTP.** The UI imports TS service modules directly. No `fetch('/api/...')` anywhere. The Groq call in `src/llm/groq.ts` is the only outbound HTTPS.
- **HashRouter, not BrowserRouter.** Capacitor runs at `https://localhost` via `androidScheme`, and path-based routing breaks on deep links there.
- **Local-date YYYY-MM-DD for `food_log.date`.** Chat, Dashboard, and Tracker all resolve "today" with a local-time helper. `toISOString().slice(0,10)` is the wrong tool — see the v0.1.0 fix for what it broke.
- **Tailwind tokens are the source of truth** (`bg`, `card`, `muted`, `accent`, `accentSoft`, `text`, `subtle`).
- **BYOK key storage** = `@capacitor/preferences` (secure on Android Keystore-backed when available). Never embed a key.
- **SQLite schema verbatim** from Lumen — five tables: `users`, `food_log`, `weight_log`, `body_measurements`, `chat_history`. Single user (`user_id=1`), no auth. Datetimes stored as ISO-8601 TEXT.
- **JSON chat contract verbatim** from `backend/prompts.py` + the optional `weight_kg` extension added in v0.1.0. Falls back to a `general` intent with raw text when parse fails.
- **Dispatch shape mirrors Lumen's** — `src/llm/index.ts` switches on backend mode. `groq.ts` is the only working provider; `mediapipe.ts` throws a deliberate "not implemented, switch to Groq" error.

For deeper "how it works," see [`./ARCHITECTURE.md`](./ARCHITECTURE.md).

## Build + release flow (proven, repeatable)

Env is already wired on this machine — `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `gh` are all on user PATH. New PowerShell sessions pick them up automatically; old sessions need an `$env:` reload.

```powershell
# from repo root
npm run build                                       # produces dist/
npx cap sync android                                # copies dist/ + plugins into android/
cd android; .\gradlew.bat assembleDebug --no-daemon # debug APK
```

APK lands at [`../android/app/build/outputs/apk/debug/app-debug.apk`](../android/app/build/outputs/apk/debug/app-debug.apk).

For a release, bump `package.json`, add a `CHANGELOG.md` entry, commit with the inline-identity convention (see Conventions below), then:

```powershell
git tag -a vX.Y.Z -m "..." <commit>
git push origin main
git push origin vX.Y.Z
gh release create vX.Y.Z --prerelease --title "..." --notes-file .git/RELEASE_NOTES_vXYZ.md `
  android/app/build/outputs/apk/debug/app-debug.apk
```

`gh` is authenticated as `Schreckgespenst` via keyring; no re-auth needed unless the token expires.

## WASM loading — gotchas worth remembering

Three compounding bugs broke SQLite-on-web. All fixed in `277afae` + `b07e45d`, but writing them down so the next session doesn't relearn:

1. **sql.js version mismatch.** `jeep-sqlite@2.8.0` ships Emscripten glue compiled against sql.js 1.11.x. npm's `^1.11.0` semver-resolved to `1.14.1` whose WASM has new imports — `LinkError: Import #34 "a" "I"`. Fix: `"overrides": { "sql.js": "1.11.0" }` in `package.json` plus a direct devDep so it hoists.
2. **Vite reserves `/assets/*`.** jeep-sqlite's default wasmPath is `/assets`, but Vite's dev server SPA-fallbacks anything under that prefix. Setting `wasm-path` attribute on the `<jeep-sqlite>` element is **too late** — Emscripten fetches the wasm eagerly when the module's script runs. Fix: dev middleware in `vite.config.ts` intercepts every `*/sql-wasm.wasm` request and serves the staged binary regardless of URL.
3. **The wasm has to be staged.** `public/sql-wasm.wasm` is gitignored and re-copied from `node_modules/sql.js/dist/` on every dev start and prod build. Don't commit the binary.

## Open action items the user owns

1. **`Lumen-Local` cleanup** — older sibling scaffold at `../Lumen-Local` from before the `lumen-device` name was picked. Discard when convenient.
2. **No secrets to rotate.** BYOK key is stored only in `@capacitor/preferences`; never embedded.
3. **Model-quality lever.** If LLM replies still drift after v0.1.1's prompt fix, swap the Settings card's model from `llama-3.1-8b-instant` to `llama-3.3-70b-versatile` — both free on Groq, the latter follows instructions much better.

## Repo map at handoff time

| Path | What |
|---|---|
| [`../README.md`](../README.md) | What the project is, stack, install/run/build commands |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Per-version cut list |
| [`./ARCHITECTURE.md`](./ARCHITECTURE.md) | Durable how-it-works reference |
| [`./HANDOFF.md`](./HANDOFF.md) | This file — current state + next-session pointer |
| [`../index.html`](../index.html) | App shell, modern `mobile-web-app-capable` + legacy Apple equivalent |
| [`../src/main.tsx`](../src/main.tsx) | Entry — awaits `initDb()` then mounts the React tree. Paints a "Database init failed" screen on reject. |
| [`../src/App.tsx`](../src/App.tsx) | Top nav, four routes, `hasProfile` gate redirects unauthenticated to `/setup` |
| [`../src/pages/`](../src/pages/) | Dashboard / Chat / Tracker / Setup (Setup also contains the LLM Settings card) |
| [`../src/components/`](../src/components/) | CaloriesTab / WeightTab / MeasurementsTab |
| [`../src/services/`](../src/services/) | One module per backend route — `db`, `schema`, `profile`, `food`, `weight`, `measurements`, `chat`. `index.ts` is just a façade. |
| [`../src/llm/`](../src/llm/) | `index.ts` (dispatch + Preferences-backed settings), `groq.ts` (REST), `mediapipe.ts` (stub), `prompts.ts` (system prompt + JSON extractor) |
| [`../src/types.ts`](../src/types.ts) | TS port of `backend/schemas.py` + `backend/profile_store.py` |
| [`../vite.config.ts`](../vite.config.ts) | `base: './'` + `copySqlWasm()` plugin + dev middleware for `*/sql-wasm.wasm` |
| [`../capacitor.config.ts`](../capacitor.config.ts) | `appId: com.lumen.device`, SQLite plugin config |
| [`../tailwind.config.js`](../tailwind.config.js) | Lumen theme tokens + Inter fallback stack |

## Memory pointers (auto-loaded)

- `project_lumen.md` — hosted Lumen repo's durable picture
- `project_lumen_device.md` — this repo's durable picture
- `project_lumen_stitch.md` — Stitch IDs and quirks (Lumen's design system is the visual source of truth here too)
- `feedback_api_keys.md` — recurring "user pastes secrets" pattern. BYOK Settings flow means this could happen again.
- `reference_gh_cli.md` — `gh` install path and auth state for this machine; releases are one command.

If anything in this handoff contradicts memory, trust the handoff (it is newer).

## Conventions

- Short, terse responses preferred over verbose summaries.
- PowerShell syntax on Windows; use the Bash tool only for POSIX scripts.
- One bundled commit per logical shipment.
- HTTPS for `git push`, not SSH. SSH `known_hosts` is empty so SSH push fails non-interactively.
- Don't write `git config` (per project rules). Use inline `git -c user.name=... -c user.email=...` for commits — identity is `Shikher Gupta <shikherg@cadence.com>`.
- For commit messages with quotes / dashes / multiline content, write the message to `.git/COMMIT_MSG_*.txt` and use `git commit -F`. The PowerShell here-string `@'...'@` parser breaks on embedded `"…"` mid-body.
