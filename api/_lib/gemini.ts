/**
 * Google Gemini, through the Interactions API (POST /v1beta/interactions), asked for JSON that matches a schema.
 * Used by the free reading. The key is a server setting (GEMINI_API_KEY) and never reaches the browser.
 *
 * Each call is stateless (store: false): Google keeps no conversation for us, and we send only what the answer needs.
 * The light model is used for speed; if it is busy or over its free quota, the call is retried once on the larger one.
 */

export interface AiConfig { apiKey: string; models: string[] }

export interface AiRequest {
  system: string
  input: string
  schema: Record<string, unknown>
  maxTokens?: number
}

export type AiCall = (req: AiRequest) => Promise<unknown | null>

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const API_REVISION = '2026-05-20'
const RETRY_ON = new Set([404, 429, 500, 502, 503, 504])

export function aiConfig(env: Record<string, string | undefined> = process.env): AiConfig | null {
  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) return null
  // the light model answers in a few seconds; the larger one is the backup when it is busy
  const main = env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite'
  const models = [...new Set([main, 'gemini-3.8-flash'])]
  return { apiKey, models }
}

/** The model's text: the SDK's output_text when present, otherwise the text of the model's output steps. */
export function textOf(response: unknown): string {
  const r = response as { output_text?: unknown; steps?: unknown }
  if (typeof r?.output_text === 'string' && r.output_text.trim()) return r.output_text
  const steps = Array.isArray(r?.steps) ? r.steps : []
  const parts: string[] = []
  for (const step of steps as { type?: string; content?: unknown; text?: unknown }[]) {
    if (step?.type === 'user_input' || step?.type === 'thought') continue
    if (typeof step?.text === 'string') parts.push(step.text)
    if (Array.isArray(step?.content)) for (const c of step.content as { text?: unknown }[]) if (typeof c?.text === 'string') parts.push(c.text)
  }
  return parts.join('')
}

/** Parses the JSON the model returned, tolerating a code fence or stray words around it. */
export function parseJson(text: string): unknown | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(t)
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try { return JSON.parse(t.slice(start, end + 1)) } catch { return null }
  }
}

export function geminiCaller(cfg: AiConfig, fetchFn: typeof fetch = fetch, timeoutMs = 25_000): AiCall {
  return async ({ system, input, schema, maxTokens = 2048 }) => {
    for (const model of cfg.models) {
      const res = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { 'x-goog-api-key': cfg.apiKey, 'content-type': 'application/json', 'api-revision': API_REVISION },
        body: JSON.stringify({
          model,
          system_instruction: system,
          input,
          store: false,
          response_format: { type: 'text', mime_type: 'application/json', schema },
          generation_config: { max_output_tokens: maxTokens },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((e: unknown) => {
        console.error(`gemini ${model} request failed`, e)
        return null
      })
      if (!res) continue
      if (!res.ok) {
        console.error(`gemini ${model} answered ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
        if (RETRY_ON.has(res.status)) continue
        return null
      }
      const parsed = parseJson(textOf(await res.json().catch(() => null)))
      if (parsed) return parsed
      console.error(`gemini ${model} returned no usable JSON`)
    }
    return null
  }
}
