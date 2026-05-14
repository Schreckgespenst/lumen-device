// Ports backend/prompts.py + the _extract_json helper from backend/llm.py.
// The JSON contract (intent / reply_markdown / food_entries / follow_up_options)
// is matched byte-for-byte so the dispatch can stay provider-agnostic.

import type { ProfileJson } from '../types'

export const SYSTEM_PROMPT_TEMPLATE = `You are a personal health assistant for the user.
You have access to the user's profile (preferences, restrictions, goals), today's food log so far, and recent weight history. Always be concise, accurate, and practical.

Never invent data. If you are estimating kcal/macros, state your assumption briefly in parentheses next to the item.

Today's date: {today}
User Profile:
{user_profile}

Today's Food Log So Far:
{todays_log}

Recent Weight (last 7 entries):
{recent_weight}

Configured meal sections: {meal_sections}

== OUTPUT CONTRACT ==
Your reply must be valid JSON. No markdown fences, no extra prose outside the JSON.
The JSON has this shape:
{
  "intent": "calorie_log" | "question" | "general",
  "reply_markdown": "<your visible reply rendered as markdown>",
  "food_entries": [
    {"date": "YYYY-MM-DD", "meal_type": "Breakfast|Lunch|Evening Snack|Dinner|Dessert",
      "food_name": "string", "kcal": number, "protein_g": number, "carbs_g": number,
      "fat_g": number, "fiber_g": number, "notes": "assumption note or empty"}
  ],
  "follow_up_options": ["string", ...]
}

== WHEN intent IS calorie_log ==
\`reply_markdown\` MUST follow this exact structure:

**Calorie Tracking: <Date>**

**<Meal Name>: ~<total> kcal**
- <Item>: <kcal> kcal (<brief assumption>)
- ...

**<Next Meal>: ~<total> kcal**
- ...

---
**Daily Summary**
- Total Consumed: ~<X> kcal
- Remaining Budget: <Y> kcal
- Estimated Protein: ~<Z>g
- Macros:
  - Protein: <consumed>g / <goal>g
  - Carbohydrates: <consumed>g / <goal>g
  - Fats: <consumed>g / <goal>g
  - Fiber: <consumed>g / <goal>g

\`food_entries\` MUST contain one row per item the user logged so the backend can persist them.

\`follow_up_options\` should include (only those that are relevant):
- "Suggestions for Optimisation"
- "Overall Strengths of Today"
- "Meal-by-Meal Analysis"
- "Dinner Suggestions"   (only if Dinner has not been logged yet)

== WHEN intent IS question OR general ==
- \`food_entries\` MUST be [].
- \`reply_markdown\` answers the user concisely, grounded in their profile/log.
- \`follow_up_options\` may be [] or short relevant prompts.

Remember: emit ONE JSON object. No prose before or after.
`

export const PROFILE_LEARNING_PROMPT = `Based on the most recent user message and your reply, extract any NEW factual information about the user's dietary habits, food preferences, cooking capabilities, meal patterns, restrictions, or lifestyle.

Return a JSON object with optional keys:
- "dietary_preferences_add": [strings]
- "cooking_capabilities_add": [strings]
- "meal_patterns_add": [strings]
- "physical_activity_habits_add": [strings]
- "food_preferences_add": [strings]
- "food_restrictions_add": [strings]

Only include keys when there is genuinely new, durable information (not one-off events). Return {} if nothing new.
Return ONLY the JSON object — no markdown fences, no prose.

Recent user message:
{user_msg}

Your reply (summary):
{reply_summary}

Existing dynamic profile (for dedup reference):
{existing_dynamic}
`

function renderTemplate(template: string, vars: Record<string, string>): string {
  // Match Python's str.format `{key}` substitution but only for declared keys —
  // every other `{` / `}` in the template (the JSON-contract schema, for example)
  // is left untouched because the .format() call in Python already requires
  // doubled braces there.
  let out = template
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(v)
  }
  return out
}

export interface LogEntry {
  meal_type: string
  food_name: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  notes: string | null
}

export interface RecentWeight {
  weight_kg: number
  logged_at: string
}

export function buildSystemPrompt(
  today: string,
  profile: ProfileJson,
  todaysLog: LogEntry[],
  recentWeight: RecentWeight[],
): string {
  const mealSections =
    profile.static?.meal_sections ?? ['Breakfast', 'Lunch', 'Evening Snack', 'Dinner', 'Dessert']
  return renderTemplate(SYSTEM_PROMPT_TEMPLATE, {
    today,
    user_profile: JSON.stringify(profile, null, 2),
    todays_log: JSON.stringify(todaysLog, null, 2),
    recent_weight: JSON.stringify(recentWeight, null, 2),
    meal_sections: mealSections.join(', '),
  })
}

export function buildProfileLearningPrompt(
  userMsg: string,
  replySummary: string,
  existingDynamic: Record<string, unknown>,
): string {
  return renderTemplate(PROFILE_LEARNING_PROMPT, {
    user_msg: userMsg,
    reply_summary: replySummary.slice(0, 1000),
    existing_dynamic: JSON.stringify(existingDynamic),
  })
}

// Best-effort JSON extraction. Handles fenced blocks and stray prose, exactly
// like backend/llm.py's _extract_json.
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  let candidate: string
  if (fence) {
    candidate = fence[1]
  } else {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end === -1 || end <= start) return null
    candidate = trimmed.slice(start, end + 1)
  }
  try {
    return JSON.parse(candidate) as Record<string, unknown>
  } catch {
    return null
  }
}
