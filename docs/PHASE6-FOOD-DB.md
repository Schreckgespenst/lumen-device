# Phase 6 — Curated on-device food database

Plan doc for the food-database integration. Output of the 2026-06-11 research
round (18-agent adversarial workflow over 8 candidate sources/patterns). Read
[`./ARCHITECTURE.md`](./ARCHITECTURE.md) first if you need the existing
chat-flow context.

## Goal

Replace the LLM's "guess kcal from training data" with grounded lookups, so
when the user says "had 2 rotis and rajma" the macros come from a real source
rather than the model's prior. The user-visible win: accurate calorie + macro
math, with provenance ("DB" pill vs "estimate" pill on each logged item).

## Decision: curated local SQLite seed + pre-fetch RAG

The other six candidates (Open Food Facts, USDA FDC, Nutritionix, Edamam,
FatSecret, LLM tool-calling) were refuted under our actual constraints —
single user, BYOK Groq on free tier, on-device PWA, no backend, no monthly
SaaS budget, Indian/regional foods first.

What survives is a **~1500-row hand-curated SQLite seed** delivered to the
LLM via **pre-fetched candidate rows injected into the system prompt** (not
via tool-calling).

### Why curated, not bulk

- **Quality > coverage.** A clean 1500 rows beat a dirty 50k from Open Food
  Facts. FTS5 trigram disambiguation works much better on a small clean set.
- **Bundleable.** ~400 KB gzipped vs ~10 GB for USDA full ingest or 50 GB for
  OFF dumps. Ships with the APK; no first-run download UX, no CDN.
- **Regional first.** IFCT 2017 (528 rows) covers Indian staples authoritatively;
  USDA Foundation (~200 rows) fills global gaps; the rest is hand-picked
  Indian branded SKUs (Amul, Britannia, MTR, Haldiram's, the Bangalore chains
  you actually eat).
- **No license trap.** USDA is public domain. IFCT 2017 is a published
  reference table (academic citation, not redistribution-restricted). Branded
  SKUs come from manufacturer-published nutrition panels — fair use for a
  personal app.

### Why pre-fetch, not LLM tool-calling

Tool-calling was independently refuted by the verifier. Three reasons specific
to this codebase:

1. **JSON-mode + tools is brittle on Llama 3.1 8B.** The model often emits a
   tool call on turn 1 and returns prose (not JSON) on turn 2 because the
   second hop forgets the schema. Pre-fetch keeps the single-call JSON-mode
   path that `groqChatRaw` ([`../src/llm/groq.ts`](../src/llm/groq.ts))
   already relies on.
2. **Free-tier math.** Tool-calling means 2 Groq calls per logged meal.
   At 14.4k RPD / 30 RPM free tier, that halves your headroom for a feature
   most messages don't even need ("1 cup rice ≈ 200 kcal" is something the
   model already knows).
3. **History bookkeeping.** `role: "tool"` turns break the existing
   `loadRecentHistory` trimmer ([`../src/services/chat.ts`](../src/services/chat.ts))
   and the v0.1.1 "Clear chat" semantics. Pre-fetch injects rows into the
   system prompt — which is rebuilt each turn by `buildSystemPrompt` anyway
   — so chat history is untouched.

Revisit tool-calling only if/when we move off the 8B model.

## Implementation shape

File-by-file map, ready to hand to a future session.

### 1. Schema migration

[`../src/services/schema.ts`](../src/services/schema.ts):

```sql
CREATE TABLE IF NOT EXISTS food_db (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name  TEXT NOT NULL,
  aliases         TEXT,                -- comma-separated synonyms
  kcal            REAL NOT NULL,
  protein_g       REAL NOT NULL,
  carbs_g         REAL NOT NULL,
  fat_g           REAL NOT NULL,
  fiber_g         REAL NOT NULL,
  serving_size_g  REAL,                -- nullable for "1 piece", etc.
  serving_label   TEXT,                -- "1 cup cooked", "1 roti", "per 100g"
  source          TEXT NOT NULL        -- 'ifct' | 'usda' | 'curated'
);

CREATE VIRTUAL TABLE IF NOT EXISTS food_db_fts USING fts5(
  canonical_name, aliases, content='food_db', content_rowid='id',
  tokenize='trigram'
);

-- Add provenance to food_log so the UI can show "DB" vs "estimate":
ALTER TABLE food_log ADD COLUMN source TEXT;       -- 'db' | 'estimate' | null
ALTER TABLE food_log ADD COLUMN source_id INTEGER; -- food_db.id when source='db'
```

Bump `db_version` and add the migration branch in `runMigrations`.

### 2. Seed data

New: `src/data/food-seed.json`. Shape:

```jsonc
{
  "seed_version": 1,
  "rows": [
    {
      "canonical_name": "Roti (wheat)",
      "aliases": "chapati,phulka,rotli",
      "kcal": 104, "protein_g": 3.1, "carbs_g": 21.2, "fat_g": 0.8, "fiber_g": 2.4,
      "serving_size_g": 30, "serving_label": "1 medium (30g)",
      "source": "ifct"
    },
    ...
  ]
}
```

Idempotent seeder in `src/services/foodDb.ts` (new):
- On first DB open, check `lumen.foodDb.seed_version` in Preferences.
- If less than `food-seed.json`'s `seed_version`, `DELETE FROM food_db` and
  re-insert all rows in one transaction, then rebuild FTS5
  (`INSERT INTO food_db_fts(food_db_fts) VALUES('rebuild');`).
- Stamp the new version.

### 3. Lookup helper

`src/services/foodDb.ts`:

```ts
export interface FoodDbRow {
  id: number
  canonical_name: string
  kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number
  serving_size_g: number | null
  serving_label: string | null
  source: 'ifct' | 'usda' | 'curated'
}

export async function searchFoods(query: string, limit = 5): Promise<FoodDbRow[]>
```

FTS5 MATCH with a fallback `LIKE %query%` if MATCH returns zero rows. Cheap.

### 4. Candidate extraction + injection

[`../src/services/chat.ts`](../src/services/chat.ts) `sendChat`, before the
`buildSystemPrompt` call (around line 154):

```ts
const candidates = await extractFoodCandidates(message, /* limit */ 8)
// extractFoodCandidates does naive noun-phrase chunking (split on commas,
// "and", "with"; strip stop-words; cap to N tokens per chunk), then calls
// searchFoods for each chunk and dedupes by food_db.id.
const systemPrompt = buildSystemPrompt(today, profile, todaysLog, recentWeight, candidates)
```

[`../src/llm/prompts.ts`](../src/llm/prompts.ts) gets a new template field and
a new `buildSystemPrompt` parameter:

```
== AVAILABLE FOOD DATABASE ENTRIES ==
The following rows came from the user's curated food database. If a row's
`canonical_name` matches a food the user is logging, COPY its kcal/macros
exactly and scale by the actual portion the user described. Add `source_id:
<id>` and `source: "db"` to the matching food_entries row.

If no row matches, fall back to your best estimate and set source: "estimate".

{food_candidates}
```

`{food_candidates}` renders as a compact markdown table — keep it under ~30
lines to avoid blowing the JSON-mode prompt budget.

### 5. JSON contract additions

[`../src/llm/index.ts`](../src/llm/index.ts) `ChatJsonReply` and
[`../src/llm/prompts.ts`](../src/llm/prompts.ts) `food_entries[]` schema gain
two optional fields per row:

```ts
source?: 'db' | 'estimate'
source_id?: number   // food_db.id, only present when source === 'db'
```

`persistFoodEntries` in chat.ts persists both into the new `food_log`
columns. Backward compatible — rows without `source` just store NULL.

### 6. Settings + UI

[`../src/pages/Setup.tsx`](../src/pages/Setup.tsx) — extend `LlmSettingsCard`
or add a sibling `FoodDbCard` with one toggle:

- `lumen.foodDb.enabled` (boolean, default true) — when off, skip
  `extractFoodCandidates` and `{food_candidates}` substitutes to an empty
  string. Useful for A/B comparing accuracy vs pure-LLM.

[`../src/components/CaloriesTab.tsx`](../src/components/CaloriesTab.tsx) —
small "DB" or "est" pill next to each logged item, sourced from
`food_log.source`. One ternary in the existing list render.

### 7. Preferences keys

```
lumen.foodDb.enabled        : 'true' | 'false'
lumen.foodDb.seed_version   : '1' (internal, increments per seed update)
```

Add to a sibling module `src/services/foodDbSettings.ts` following the
pattern in [`../src/llm/index.ts`](../src/llm/index.ts) (`KEYS` map +
typed `get`/`set`).

## Out of scope for v0.2.0

- **Per-user food contributions.** A "remember this food" button to add the
  user's own dishes into a custom rows table. Nice but later.
- **Portion language model.** Better natural-language portion parsing
  ("a small bowl", "half a chapati") — for now the LLM handles this in
  reply_markdown and the food DB row just provides per-100g or per-serving
  baselines.
- **Branded SKU updates.** No update channel for branded rows when
  manufacturers reformulate. Bumping `seed_version` on each release is the
  blunt fix.
- **Embedding-based fuzzy match.** FTS5 trigram on 1500 rows is enough;
  skip the ONNX runtime.

## Effort estimate

**3–4 days, single developer.** The break-down:

| Day | Work |
|---|---|
| 1 | Curate `food-seed.json` — transcribe IFCT 2017 PDF (528 rows), add ~200 Foundation rows from USDA CSV, hand-add ~750 Indian branded SKUs from real food_log history |
| 2 | Schema migration + FTS5 + seeder + `searchFoods` lookup |
| 3 | Candidate extraction in `chat.ts` + `food_candidates` template field + prompt instruction |
| 4 | Settings toggle + "DB" pill UI + real-meal validation |

Day 1 is the actual work — the rest is plumbing already proven by the
backend-route mirror pattern. Don't ship more rows on Day 1 than you can
manually verify; bad rows poison the LLM downstream.

## Open questions to resolve before starting

1. **Indian branded SKU source.** Manufacturer panels are scattered.
   Pre-curate a list (read the back of each pack you have at home, cross-check
   against the brand's website) — don't trust third-party aggregators.
2. **Where to put the "DB / est" pill** in [`../src/components/CaloriesTab.tsx`](../src/components/CaloriesTab.tsx)
   without adding row clutter — probably a small text-subtle label inline
   with kcal, not a dedicated column.
3. **What to do when the LLM picks a `source_id` that doesn't exist** (the
   8B model can hallucinate). Defensive: in `persistFoodEntries`, look up
   the id; if missing, drop `source_id` and stamp source = 'estimate'.

When this lands, it becomes v0.2.0 (minor bump — new schema column, new
JSON contract field).
