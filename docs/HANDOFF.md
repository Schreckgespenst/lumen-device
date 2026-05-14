# Session Handoff — Phases 1-4 done, Phase 5 ready

A pointer doc for the next Claude Code session in **`lumen-device`**. Read this first to pick up state. Things that live in [`../README.md`](../README.md) are not repeated here.

## What this repo is

`lumen-device` is the **no-hosting** sibling rebuild of [`Lumen`](https://github.com/Schreckgespenst/Lumen). Same app, same UI design, same SQLite schema, same Groq JSON contract — but the FastAPI backend collapses **into** the app process so there's no server to run.

- The hosted `Lumen` repo stays the canonical desktop / Raspberry Pi build.
- `lumen-device` ships as an Android APK. Everything (UI, SQLite, profile store, LLM dispatch) runs in-process via Capacitor. The Groq HTTPS call is the only outbound traffic, with the user's own API key (BYOK).

## Where we left off (HEAD = `b07e45d`)

End-to-end tested in Chrome on `npm run dev`. Profile saves, food/weight/measurements persist across reloads (IndexedDB), Chat actually hits Groq and returns calorie_log markdown that gets logged into the Tracker.

| Phase | What | Status | Commit |
|---|---|---|---|
| 1 | Bootstrap (Vite scaffold, Tailwind, Capacitor, theme tokens, placeholder pages) | **Done** | `3873d22` |
| 2 | UI port — pages/components ported from `Lumen`, stubbed service layer | **Done** | `71d565e` |
| 3 | On-device data layer — `@capacitor-community/sqlite` + `@capacitor/preferences`, one module per backend route file | **Done** | `76e30e7` |
| 4 | LLM dispatch + Groq port + BYOK Settings | **Done** | `a332175` |
| – | WASM loading fix (sql.js pin + dev middleware) | **Done** | `277afae`, `b07e45d` |
| 5 | Android build — `cap add android`, `cap sync`, build APK from Android Studio | **Next** | – |

`npm run build` is green: 771 modules, 753 KB / 226 KB gzipped. The bundle warning about >500 KB chunks is informational — recharts + sqlite glue dominate.

## Architectural rules (locked in)

- **No backend HTTP.** The UI imports TS service modules directly. No `fetch('/api/...')` anywhere. The Groq call in `src/llm/groq.ts` is the only outbound HTTPS.
- **HashRouter, not BrowserRouter.** Capacitor runs at `file://` (or `https://localhost` via `androidScheme`), and path-based routing breaks on deep links there.
- **Tailwind tokens are the source of truth** (`bg`, `card`, `muted`, `accent`, `accentSoft`, `text`, `subtle`).
- **BYOK key storage** = `@capacitor/preferences` (secure on Android Keystore-backed when available). Never embed a key.
- **SQLite schema verbatim** from Lumen — five tables: `users`, `food_log`, `weight_log`, `body_measurements`, `chat_history`. Single user (`user_id=1`), no auth. Datetimes stored as ISO-8601 TEXT.
- **JSON chat contract verbatim** from `backend/prompts.py` — `intent` / `reply_markdown` / `food_entries[]` / `follow_up_options[]`. Falls back to a `general` intent with raw text when parse fails.
- **Dispatch shape mirrors Lumen's** — `src/llm/index.ts` switches on backend mode. `groq.ts` is the only working provider; `mediapipe.ts` throws a deliberate "not implemented, switch to Groq" error.

## Phase 5 starter checklist

**Android tooling is installed and verified** (2026-05-14):
- Android Studio at `C:\Program Files\Android\Android Studio` with bundled OpenJDK 21.0.10 at `C:\Program Files\Android\Android Studio\jbr`
- Android SDK at `C:\Users\Shikher Gupta\AppData\Local\Android\Sdk` with platform-tools, build-tools, platforms, emulator
- adb at `C:\Users\Shikher Gupta\AppData\Local\Android\Sdk\platform-tools\adb.exe`

**Shell env still needs to be wired up** before `cap add android` works from PowerShell:

```powershell
# User-scoped, no admin needed:
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', "$env:LOCALAPPDATA\Android\Sdk", 'User')
# Append platform-tools to PATH (so `adb` works in any new shell):
$path = [Environment]::GetEnvironmentVariable('PATH', 'User')
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools"
if ($path -notlike "*$adb*") { [Environment]::SetEnvironmentVariable('PATH', "$path;$adb", 'User') }
# Open a new PowerShell window after this — current session won't pick up the change.
```

Then in a fresh PowerShell:

```powershell
cd c:\Users\Shikher Gupta\Documents\PythonProjz\lumen-device
npm run build           # produces dist/ that capacitor will package
npx cap add android     # creates ./android/ (this dir is gitignored)
npx cap sync            # copies dist/ + plugin native code into android/app/src/main/assets
npx cap open android    # opens Android Studio; build APK from there
```

Things to expect / verify:

- The WASM dev middleware (`vite.config.ts`'s `copySqlWasm`) doesn't apply on native — the Capacitor SQLite plugin uses real platform SQLite, no WASM. So sql.js + jeep-sqlite are effectively unused on Android; they only mattered for browser dev. The dependency tree still pulls them in but they're inert at runtime.
- `cap sync` will fail if `dist/` is missing — always `npm run build` first.
- Capacitor 8 minimum SDK is 23 (Android 6.0). The default in `android/variables.gradle` should be fine; don't bump it.
- `capacitor.config.ts` is already set to `appId: com.lumen.device` and configures the SQLite plugin for Android Keystore-backed encryption.
- The Groq HTTPS call needs no special Android network config — `api.groq.com` is HTTPS so the default `usesCleartextTraffic=false` is correct.
- BYOK key entry: works the same on Android. `@capacitor/preferences` is backed by `SharedPreferences` (encrypted on devices with Android Keystore).
- The `_LLM error: …` fallback path in [`../src/llm/index.ts`](../src/llm/index.ts) will fire if the device has no network — that's the desired UX. Don't add try/catch swallowing here.

## WASM loading — gotchas worth remembering

Three compounding bugs broke SQLite-on-web. All fixed in `277afae` + `b07e45d`, but writing them down so the next session doesn't relearn:

1. **sql.js version mismatch.** `jeep-sqlite@2.8.0` ships Emscripten glue compiled against sql.js 1.11.x. npm's `^1.11.0` semver-resolved to `1.14.1` whose WASM has new imports — `LinkError: Import #34 "a" "I"`. Fix: `"overrides": { "sql.js": "1.11.0" }` in `package.json` plus a direct devDep so it hoists.
2. **Vite reserves `/assets/*`.** jeep-sqlite's default wasmPath is `/assets`, but Vite's dev server SPA-fallbacks anything under that prefix. Setting `wasm-path` attribute on the `<jeep-sqlite>` element is **too late** — Emscripten fetches the wasm eagerly when the module's script runs. Fix: dev middleware in `vite.config.ts` intercepts every `*/sql-wasm.wasm` request and serves the staged binary regardless of URL.
3. **The wasm has to be staged.** `public/sql-wasm.wasm` is gitignored and re-copied from `node_modules/sql.js/dist/` on every dev start and prod build. Don't commit the binary.

## Open action items the user owns

1. **Set the JAVA_HOME / ANDROID_HOME env vars** (snippet above) before starting Phase 5.
2. **`Lumen-Local` cleanup** — older sibling scaffold at `../Lumen-Local` from before the `lumen-device` name was picked. Discard when convenient.
3. **No secrets to rotate.** BYOK key is stored only in `@capacitor/preferences`; never embedded.

## Repo map at handoff time

| Path | What |
|---|---|
| [`../README.md`](../README.md) | What the project is, stack, run/build commands |
| [`./HANDOFF.md`](./HANDOFF.md) | This file |
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

If anything in this handoff contradicts memory, trust the handoff (it is newer).

## Conventions

- Short, terse responses preferred over verbose summaries.
- PowerShell syntax on Windows; use the Bash tool only for POSIX scripts.
- One bundled commit per logical shipment.
- HTTPS for `git push`, not SSH. SSH `known_hosts` is empty so SSH push fails non-interactively.
- Don't write `git config` (per project rules). Use inline `git -c user.name=... -c user.email=...` for commits — identity is `Shikher Gupta <shikherg@cadence.com>`.
- For commit messages with quotes / dashes / multiline content, write the message to `.git/COMMIT_MSG_*.txt` and use `git commit -F`. The PowerShell here-string `@'...'@` parser breaks on embedded `"…"` mid-body.
