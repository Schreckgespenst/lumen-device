# Changelog

All notable changes to **lumen-device** are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow
[SemVer](https://semver.org/spec/v2.0.0.html).

The hosted sibling project [`Lumen`](https://github.com/Schreckgespenst/Lumen) has its own
changelog; entries here cover only what differs in the no-hosting build.

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
