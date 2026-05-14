// Placeholder for an on-device MediaPipe / WebLLM provider. Lumen's reference
// impl uses Ollama for the local-first path; on Android that role will be
// filled by a bundled MediaPipe LLM task (or similar) in a later phase. For
// now this provider is a no-op so the dispatch enum stays meaningful — picking
// it just surfaces a helpful error instead of crashing.

export function mediapipeChatRaw(): never {
  throw new Error(
    'On-device LLM (MediaPipe) is not implemented yet. Switch the LLM backend to Groq in Settings.',
  )
}
