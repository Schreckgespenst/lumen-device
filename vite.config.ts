import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
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
  // jeep-sqlite's bundled Emscripten module loads the wasm eagerly with a
  // URL resolved relative to its own script. Vite pre-bundles jeep-sqlite
  // into node_modules/.vite/deps/, so the relative `sql-wasm.wasm` request
  // ends up under that prefix and falls through to Vite's SPA HTML
  // fallback. Two-pronged fix:
  //   1. Stage the wasm at public/sql-wasm.wasm so it's also served at
  //      the root (matches the prod build behaviour).
  //   2. Install a dev middleware that intercepts any "*/sql-wasm.wasm"
  //      request and returns the staged binary with the correct
  //      content-type, no matter what URL the Emscripten loader chose.
  const dest = resolve(here, 'public/sql-wasm.wasm')
  const copyOnce = () => {
    try {
      const srcStat = statSync(src)
      let destSize = -1
      try { destSize = statSync(dest).size } catch { /* missing is fine */ }
      if (destSize !== srcStat.size) {
        mkdirSync(resolve(here, 'public'), { recursive: true })
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
    configureServer(server) {
      copyOnce()
      // Catch every request whose path ends in /sql-wasm.wasm.
      server.middlewares.use((req, res, next) => {
        if (req.url && /\/sql-wasm\.wasm(\?.*)?$/.test(req.url)) {
          try {
            const buf = readFileSync(dest)
            res.setHeader('Content-Type', 'application/wasm')
            res.setHeader('Content-Length', buf.length)
            res.end(buf)
            return
          } catch (err) {
            console.error('[copy-sql-wasm] failed to serve wasm:', err)
          }
        }
        next()
      })
    },
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
