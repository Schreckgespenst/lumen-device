import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))

// jeep-sqlite (the browser shim for @capacitor-community/sqlite) needs
// sql.js's sql-wasm.wasm to be reachable at /assets/sql-wasm.wasm at runtime.
// We don't commit the 645 KB blob; we copy it from node_modules into the
// Vite-served `public/` tree on every dev start and production build.
//
// sql.js is pinned to 1.11.0 via overrides because newer versions produce a
// WASM whose imports table doesn't match jeep-sqlite@2.8.0's bundled glue
// (LinkError on jeep-sqlite import "a.I"). npm may hoist the pin or keep it
// nested under jeep-sqlite, so we resolve via Node instead of hardcoding.
function copySqlWasm(): Plugin {
  const src = resolve(dirname(require.resolve('sql.js/package.json')), 'dist/sql-wasm.wasm')
  // Don't use `public/assets/` — Vite's dev server reserves `/assets/*` for
  // bundler-hashed module URLs, so files placed there are shadowed by the
  // SPA fallback. `public/wasm/` is served verbatim at `/wasm/...`.
  const dest = resolve(here, 'public/wasm/sql-wasm.wasm')
  const copyOnce = () => {
    try {
      const srcStat = statSync(src)
      let destSize = -1
      try { destSize = statSync(dest).size } catch { /* missing is fine */ }
      if (destSize !== srcStat.size) {
        mkdirSync(resolve(here, 'public/wasm'), { recursive: true })
        copyFileSync(src, dest)
      }
    } catch (err) {
      // Surface the failure loudly — without the wasm, every SQLite call
      // in the browser will reject during initDb().
      console.error('[copy-sql-wasm] failed to stage sql-wasm.wasm:', err)
    }
  }
  return {
    name: 'copy-sql-wasm',
    buildStart: copyOnce,
    configureServer: copyOnce,
  }
}

export default defineConfig({
  plugins: [react(), copySqlWasm()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
