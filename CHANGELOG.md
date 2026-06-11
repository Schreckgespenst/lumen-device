# Changelog

All notable changes to **lumen-device** are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
[SemVer](https://semver.org/spec/v2.0.0.html).

The hosted sibling project [`Lumen`](https://github.com/Schreckgespenst/Lumen) has its own
changelog; entries here cover only what differs in the no-hosting build.

## [0.1.2] — 2026-06-11

Minor feature release. One opt-in toggle, one planning doc, no schema changes.

### Added
- **Daily auto-clear chat.** New toggle under Settings → "Chat settings" that
  wipes `chat_history` on the first app open of each local day. Food, weight,
  and measurements already in the Tracker are never touched. Enabling the
  toggle does NOT immediately wipe the chat you are looking at — it baselines
  the last-clear date to today, so the wipe fires on the next first-launch
  of a new day. Implementation in
  [`src/services/chat.ts`](src/services/chat.ts) (`getChatSettings`,
  `setChatSettings`, `runDailyClearIfDue`) + a call after `initDb()` in
  [`src/main.tsx`](src/main.tsx) + a new card in
  [`src/pages/Setup.tsx`](src/pages/Setup.tsx).

### Docs
- **`docs/PHASE6-FOOD-DB.md`** — plan doc for grounding the LLM in a real
  food database instead of guesses. Captures the output of the 2026-06-11
  research workflow (curated 1500-row local SQLite seed + pre-fetch RAG into
  the system prompt, refuting 6 alternative sources/patterns). Includes a
  file-by-file implementation map, schema migration, JSON contract changes,
  effort estimate (3–4 days), and open questions. Not implemented in v0.1.2.

## [0.1.1] — 2026-06-07

Bug fixes from a week of real-device usage. No new features; no schema change.

### Fixed
- **Duplicate food entries on every new meal.** When a user logged lunch after
  already logging breakfast, the LLM was re-emitting the breakfast rows in
  `food_entries`, so the Tracker showed each earlier meal twice and again the
  next time. The system prompt's `food_entries` clause was ambiguous between
  "items from this message" and "all of today". Now tightened to "ONLY items
  the user mentioned in their MOST RECENT message" with an explicit note that
  items already present in `Today's Food Log So Far` must NOT be re-emitted.
- **Literal placeholders in LLM replies** (`~<X> kcal`, `<consumed>g / <goal>g`).
  The angle-bracket placeholders in the system prompt's `reply_markdown`
  template were being echoed verbatim by weaker models. Replaced with
  `SNAKE_CASE` substitution tokens (`SUM_OF_ALL_KCAL_TODAY`,
  `USER_DAILY_GOAL_MINUS_TOTAL`, etc.) and an explicit imperative rule that
  every such token must be replaced with the actual computed integer.

### Added
- **Clear chat button** in the Chat page. Wipes `chat_history` after a
  confirmation prompt; food/weight already in the Tracker is untouched. The
  underlying `api.clearChat()` already existed since Phase 3 — this just
  exposes the affordance.

### Notes
- On-device LLM migration to Gemma 3n / LiteRT was scoped and declined in
  this round (quality regression risk + ~3 GB model download + ~1–2 weeks of
  plugin work). Groq stays the default. If chat reply quality is still
  imperfect with `llama-3.1-8b-instant`, swapping the Settings card's model
  to `llama-3.3-70b-versatile` (also free on Groq) is the cheapest quality
  lever before any prompt or platform work.

## [0.1.0] — 2026-05-15

First beta. Phases 1–5 complete: the app runs end-to-end on Android with no backend
process. Capacitor packages a Vite + React UI that drives on-device SQLite and a BYOK
Groq HTTPS call.

### Added
- Capacitor 8 Android shell wrapping the Vite + React 19 + TS UI (Phase 1, [`3873d22`](../../commit/3873d22)).
- Full UI port from the hosted `Lumen` repo — Dashboard, Chat, Tracker (Calories / Weight /
  Measurements tabs), Setup — with the same Tailwind theme tokens (Phase 2, [`71d565e`](../../commit/71d565e)).
- On-device data layer: `@capacitor-community/sqlite` for the five-table schema
  (`users`, `food_log`, `weight_log`, `body_measurements`, `chat_history`),
  `@capacitor/preferences` for the dynamic profile and BYOK key, one service
  module per backend route file (Phase 3, [`76e30e7`](../../commit/76e30e7)).
- LLM dispatch: in-process Groq REST call with the verbatim JSON contract from
  the hosted Lumen, BYOK Settings card under Setup, fallback `_LLM error: …`
  reply rendered when offline or unauthenticated (Phase 4, [`a332175`](../../commit/a332175)).
- Optional `weight_kg` field in the chat JSON contract so a sentence like
  "my weight today is 98.8 kg" auto-logs into `weight_log` alongside food entries.
- Android safe-area-inset padding on the header and main scroll region so
  content never draws under the status bar or system gesture handle.
- Auto-growing chat textarea (caps at ~7 lines, then scrolls internally) so long
  meal descriptions stay reviewable before hitting Send.

### Changed
- README and HANDOFF updated to reflect the new shipped state.

### Fixed
- **Chat → Tracker date desync.** `services/chat.ts` used a UTC `YYYY-MM-DD`
  while Dashboard and the Calories tab queried the local date — east of UTC
  after local midnight, chat-logged food disappeared off the day's view.
  Now both paths use the same local-date helper.
- jeep-sqlite WebAssembly mismatch on web dev — sql.js pinned to 1.11.0 via
  npm `overrides` so the version jeep-sqlite was compiled against is the one
  that actually resolves ([`277afae`](../../commit/277afae)).
- Vite reserves `/assets/*` for its SPA fallback, which broke jeep-sqlite's
  default `wasmPath`. A small `copySqlWasm` plugin in `vite.config.ts`
  intercepts `*/sql-wasm.wasm` and serves the staged binary from any path
  ([`b07e45d`](../../commit/b07e45d)).

### Build
- `npm run build` → 771 modules, 754 KB / 227 KB gzipped.
- Debug APK (`./gradlew assembleDebug`) → 25.8 MB. Capacitor 8, minSdk 24,
  targetSdk 36.

## Pre-0.1.0 history

See `git log` for early scaffold and HANDOFF-only commits. Nothing user-facing
shipped before 0.1.0.
