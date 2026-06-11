# Lumen — on-device

Self-contained mobile rebuild of [Lumen](https://github.com/Schreckgespenst/Lumen).
No server to host: the entire backend (SQLite, profile store, LLM dispatch) runs
inside the app process via Capacitor on Android. The Groq LLM call goes out over
HTTPS directly from the device with a user-supplied API key (BYOK).

Sibling repo to `Lumen` — the hosted FastAPI build lives there; this repo is the
no-hosting build.

## Status

**Beta — v0.1.2.** All five build phases shipped; end-to-end tested in Chrome on
`npm run dev` and on a physical Android device over a week of real use. Profile
saves, food/weight/measurements persist across reloads, Chat hits Groq and
writes parsed entries into the Tracker without duplication. See
[`CHANGELOG.md`](./CHANGELOG.md) for the per-version cut list and
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the design.

Latest debug APK is attached to the [latest release](../../releases/latest).

## Install on Android

1. Download `app-debug.apk` from the [latest release](../../releases/latest).
2. Sideload — allow "install from unknown sources" for whatever browser or file
   manager you opened the APK with, then accept the prompt.
3. Open the app, finish the Setup screen, paste a Groq API key under Settings
   (free key at <https://console.groq.com/keys>).

The APK is unsigned debug; expect a Play Protect warning. The Groq key never
leaves the device — it lives in `@capacitor/preferences`, which on Android is
backed by SharedPreferences (encrypted on devices that have Android Keystore).

## Stack

- **Capacitor 8** + **Android** platform — native shell, WebView UI.
- **Vite 8 + React 19 + TypeScript** — same UI patterns as the original Lumen.
- **Tailwind 3.4** — identical theme tokens to the original (`bg`, `card`,
  `muted`, `accent`, `accentSoft`, `text`, `subtle`).
- **@capacitor-community/sqlite** — on-device SQLite for food, weight,
  measurements, chat history.
- **@capacitor/preferences** — secure key/value store for the Groq API key and
  the dynamic profile.
- **@capacitor/filesystem** — available for future export/import flows.

## Run (web side)

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. The WebView surface is identical, so most
development happens here before syncing to Android. SQLite-in-browser via
`jeep-sqlite` keeps the persistence model the same.

## Build APK

Requires JDK 21 (the one bundled with Android Studio works) + Android Studio +
Android SDK with platform 36. Wire these once:

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

Then, in a fresh PowerShell so the new env vars load:

```powershell
npm run build                                       # produces dist/
npx cap sync android                                # copies dist/ + plugins
cd android; .\gradlew.bat assembleDebug --no-daemon # debug APK
```

The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`. For
a Studio-driven workflow run `npx cap open android` instead of the Gradle CLI.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | Vite dev server (web) |
| `npm run build` | `tsc -b && vite build` → `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run cap:sync` | Sync `dist/` into Android project |
| `npm run cap:open:android` | Open Android Studio |

## What about Lumen (the hosted repo)?

The original [`Lumen`](https://github.com/Schreckgespenst/Lumen) repo stays as
the FastAPI + SQLite + React PWA build — useful for desktop, Raspberry Pi
deployment, or anyone who wants a hosted version. This repo is the parallel
deliverable for "just install an APK, no server."
