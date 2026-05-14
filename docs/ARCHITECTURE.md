# Architecture — lumen-device

Design reference for the on-device build. The sibling [`Lumen`](https://github.com/Schreckgespenst/Lumen)
repo is the hosted FastAPI + SQLite + React build; everything here is the
mechanical port of that backend **into** the app process, so each backend
concept has a one-line mapping to a file in `src/`.

For the operational picture (what's next, what's broken, env setup) read
[`HANDOFF.md`](./HANDOFF.md). This doc is the durable how-it-works.

## One-screen overview

```
┌─────────────────────────────────────────────────────────────┐
│ Android APK (Capacitor 8)                                    │
│                                                              │
│   WebView (https://localhost via androidScheme)              │
│   ┌────────────────────────────────────────────────────────┐ │
│   │ React UI                                                │ │
│   │  Dashboard · Chat · Tracker · Setup                     │ │
│   │     │                                                   │ │
│   │     ▼                                                   │ │
│   │ src/services/  ← one TS module per backend route file   │ │
│   │     │                                                   │ │
│   │     ├── @capacitor-community/sqlite  ── on-device .db   │ │
│   │     ├── @capacitor/preferences       ── BYOK key, prefs │ │
│   │     └── src/llm/groq.ts ─── HTTPS ──▶ api.groq.com      │ │
│   └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                            ▲
                                            │  Only outbound traffic.
                                            │  User's own API key.
```

No backend process. No `fetch('/api/...')` anywhere in the UI. The single
external dependency at runtime is `api.groq.com`.

## Backend-to-frontend port map

The hosted Lumen has these route files. Each maps to one TS module in this repo:

| Hosted Lumen file              | This repo                            | Purpose                                    |
|-------------------------------|--------------------------------------|--------------------------------------------|
| `backend/routes/profile.py`   | [`src/services/profile.ts`](../src/services/profile.ts) | Setup flow + dynamic-profile patches       |
| `backend/routes/food.py`      | [`src/services/food.ts`](../src/services/food.ts)       | `food_log` CRUD                            |
| `backend/routes/weight.py`    | [`src/services/weight.ts`](../src/services/weight.ts)   | `weight_log` CRUD                          |
| `backend/routes/measurements.py` | [`src/services/measurements.ts`](../src/services/measurements.ts) | `body_measurements` CRUD            |
| `backend/routes/chat.py`      | [`src/services/chat.ts`](../src/services/chat.ts)       | Chat orchestration + food/weight persist   |
| `backend/llm.py`              | [`src/llm/index.ts`](../src/llm/index.ts) + `groq.ts`   | Dispatch + Groq REST + JSON extraction     |
| `backend/prompts.py`          | [`src/llm/prompts.ts`](../src/llm/prompts.ts)           | System prompt + JSON contract              |
| `backend/profile_store.py`    | [`src/services/profile.ts`](../src/services/profile.ts) | Dynamic profile (Preferences-backed)       |
| `backend/schemas.py`          | [`src/types.ts`](../src/types.ts)                       | Shared types                               |
| `backend/db.py`               | [`src/services/db.ts`](../src/services/db.ts) + `schema.ts` | Open / migrate / persist             |

[`src/services/index.ts`](../src/services/index.ts) is the façade — UI imports
`api.<verb>` from here so swapping the underlying module is local.

## Data storage

### SQLite — table-bearing data

Same five-table schema as hosted Lumen, identical column names. Single user
(`user_id = 1`), no auth.

| Table              | Purpose                                  |
|--------------------|------------------------------------------|
| `users`            | Static profile (name, goals, macros)     |
| `food_log`         | Per-meal entries; queried by local date  |
| `weight_log`       | Time-series weight; ISO-8601 `logged_at` |
| `body_measurements`| Time-series body measurements            |
| `chat_history`     | All chat turns; oldest-first             |

Datetimes are stored as ISO-8601 TEXT. `date` columns are local `YYYY-MM-DD` —
critical for the Chat → Tracker join (see [Chat flow](#chat-flow)).

On Android the data lives in the Capacitor SQLite plugin's platform database
(via the OS-level SQLite). On web (`npm run dev`) the same plugin uses
`jeep-sqlite`, which is sql.js (Emscripten SQLite) plus an IndexedDB persist
shim — same TS surface either way.

### Preferences — key/value, secret-aware

`@capacitor/preferences` backs three things:

1. **BYOK Groq API key** (`lumen.groq.api_key`). Never embedded in the bundle.
   On Android the underlying `SharedPreferences` is encrypted on devices with
   Android Keystore. Add or rotate it under the Setup → Settings card.
2. **LLM backend + model selection** (`lumen.llm.backend`, `lumen.llm.model`).
   Only `groq` is wired today; `mediapipe.ts` is a stub that throws.
3. **Dynamic profile** (`lumen.dynamic_profile`). The free-form facts the LLM
   learns over time — preferences, restrictions, cooking constraints. Mirrors
   `backend/user_profile.json` in hosted Lumen.

## Chat flow

End-to-end for "I had 2 eggs and toast for breakfast" hitting the database:

```
Chat.tsx                 services/chat.ts          src/llm/                  Groq REST
─────────                ─────────────────         ────────                  ─────────
user types ─┐
            │
   void send(text) ───▶ sendChat(message)
                          │
                          ├─ getProfile()       ◀─── @capacitor/preferences
                          ├─ loadTodaysLog()    ◀─── SQLite (food_log WHERE date=today)
                          ├─ loadRecentWeight() ◀─── SQLite (weight_log LIMIT 7)
                          ├─ loadRecentHistory()◀─── SQLite (chat_history)
                          │
                          ├─ buildSystemPrompt(profile, log, weight, today)
                          │
                          ├─ chatJson({system, history, user}) ──▶ groqChatRaw(...) ──▶ https://api.groq.com/openai/v1/chat/completions
                          │                                                                       │
                          │                                                ◀── JSON ─────────────┘
                          │                                                {intent, reply_markdown,
                          │                                                 food_entries[], weight_kg?,
                          │                                                 follow_up_options[]}
                          │
                          ├─ persistFoodEntries(parsed.food_entries) ──▶ addFood() ──▶ SQLite
                          ├─ if (parsed.weight_kg) addWeight(...)     ──▶ SQLite
                          ├─ insertMessage('assistant', reply_markdown) ─▶ SQLite
                          │
                          ◀── { reply, follow_up_options, food_entries_added }
   render reply
   show follow-ups
```

Three durability rules baked in:

1. The user turn is committed *before* the LLM call so the user's message
   survives a network failure or a mid-flight reload.
2. `persistFoodEntries` tolerates malformed individual rows — one bad entry
   doesn't drop the whole log.
3. The profile-learning side-call ([`runProfileLearning`](../src/services/chat.ts))
   is fire-and-forget; failures never block the user-visible reply.

## LLM JSON contract

Verbatim port of [`backend/prompts.py`](https://github.com/Schreckgespenst/Lumen/blob/main/backend/prompts.py).
Every chat response must be one JSON object with this shape:

```jsonc
{
  "intent": "calorie_log" | "question" | "general",
  "reply_markdown": "<rendered as markdown in the UI>",
  "food_entries": [
    {
      "date": "YYYY-MM-DD",
      "meal_type": "Breakfast|Lunch|Evening Snack|Dinner|Dessert",
      "food_name": "string",
      "kcal": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0,
      "notes": "assumption text or empty"
    }
  ],
  "weight_kg": 0,                       // optional — set only when reporting current weight
  "follow_up_options": ["…", "…"]
}
```

Parse fallback (`extractJson` in [`src/llm/prompts.ts`](../src/llm/prompts.ts))
handles fenced blocks, extra prose, and stray whitespace. If parsing fails
entirely, the dispatch returns `intent: "general"` with the raw text as
`reply_markdown` so the UI never blanks.

## Build pipeline

```
src/*.tsx ─┐
           ├─ tsc -b        ─▶ type check
           ├─ vite build    ─▶ dist/
           │                    ├─ index.html
           │                    └─ assets/*.{js,css,wasm}
           │
           └─ copySqlWasm()    ─▶ public/sql-wasm.wasm   (dev only — sourced from node_modules/sql.js/dist)
                                                          (gitignored — re-staged on every build)

dist/ ─┐
       ├─ cap sync android   ─▶ android/app/src/main/assets/public/
       └─ ./gradlew assembleDebug ─▶ android/app/build/outputs/apk/debug/app-debug.apk  (~26 MB)
```

The WASM staging is a workaround for two issues that compound on web dev:
sql.js semver-drift (pinned to 1.11.0 via npm `overrides`) and Vite's SPA
fallback eating `/assets/*` (intercepted by middleware in
[`vite.config.ts`](../vite.config.ts) that serves the binary from any path).
On Android the platform SQLite plugin uses real OS-level SQLite — sql.js and
jeep-sqlite still get bundled but are inert at runtime.

## Locked-in architectural rules

These have been broken before; treat them as load-bearing.

- **No backend HTTP.** No `fetch('/api/...')` in `src/`. The Groq call is the
  only outbound HTTPS.
- **HashRouter, not BrowserRouter.** Capacitor serves at
  `https://localhost/` via `androidScheme` and path-based routing breaks on
  deep links there.
- **Local dates for `food_log.date`.** Chat, Dashboard, and Tracker all
  resolve "today" with a local-time helper, not `toISOString().slice(0,10)`.
  Mixing the two strands silently drops entries off the day's view east of UTC
  after local midnight.
- **Tailwind tokens are the source of truth.** Don't hardcode hex colors;
  extend the theme in [`tailwind.config.js`](../tailwind.config.js).
- **BYOK only.** Never embed a Groq key. The Settings card is the only path
  for key entry.
- **SQLite schema verbatim from hosted Lumen.** Changing column names or
  table shapes will break the port story.
- **JSON chat contract verbatim** from hosted `backend/prompts.py`. New
  optional fields are fine (we added `weight_kg`); renaming or removing
  existing ones is not.

## Where to look first

| Want to change…           | Open                                      |
|---------------------------|-------------------------------------------|
| Theme / spacing tokens    | [`tailwind.config.js`](../tailwind.config.js)           |
| Routing / top-level nav   | [`src/App.tsx`](../src/App.tsx)                          |
| A page                    | `src/pages/<Page>.tsx`                    |
| A tab inside Tracker      | `src/components/<Tab>.tsx`                |
| A REST-equivalent verb    | `src/services/<route>.ts`                 |
| LLM dispatch / providers  | [`src/llm/`](../src/llm)                                  |
| System prompt / contract  | [`src/llm/prompts.ts`](../src/llm/prompts.ts)             |
| Native plugin config      | [`capacitor.config.ts`](../capacitor.config.ts)           |
| Android `minSdk` / deps   | [`android/variables.gradle`](../android/variables.gradle) |
