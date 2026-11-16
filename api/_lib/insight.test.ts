import { describe, expect, it, vi } from 'vitest'
import type { ServerConfig } from './config.js'
import { geminiCaller, parseJson, textOf, type AiRequest } from './gemini.js'
import { LIMITS, hashIp, insightRequest, type InsightCtx } from './insight.js'
import { MemoryLeads } from './leads.js'

const NOW = new Date('2026-11-16T10:00:00Z')
const cfg: ServerConfig = { dev: false, payments: 'off', dodo: null, store: 'memory', supabase: null, testPrice: null, siteUrl: null }
const READING = {
  greeting: 'Hey Sanjay, your Moolank is 2.', moolank: 'm', bhagyank: 'b', month: 'This month…',
  focus: ['a', 'b', 'c'], questions: ['Is this a good month to change my job?', 'Will my relationship settle?'],
}
const ANSWER = { answer: 'A short answer.', step: 'One step.', expert: 'An expert would look at timing.' }

function setup(ai: ((r: AiRequest) => Promise<unknown>) | null = async (r) => ('questions' in (r.schema.properties as object) ? READING : ANSWER)) {
  const leads = new MemoryLeads(null)
  const calls: AiRequest[] = []
  const ctx: InsightCtx = { cfg, leads, ai: ai ? async (r) => { calls.push(r); return ai(r) } : null }
  return { ctx, leads, calls }
}
const reading = (over: Record<string, unknown> = {}) => ({ kind: 'reading', name: 'Sanjay Prabhakar', email: 'Sanjay@Example.com', dob: '1990-03-29', lang: 'en', consent: true, ...over })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = async (r: Response): Promise<Record<string, any>> => ({ status: r.status, ...((await r.json()) as Record<string, any>) })

describe('free AI reading (server)', () => {
  it('works the numbers out itself, saves the lead without the date of birth, and sends the AI no email or date', async () => {
    const { ctx, leads, calls } = setup()
    const r = await body(await insightRequest(ctx, reading(), '1.2.3.4', NOW))
    expect(r.status).toBe(200)
    expect(r.numbers.moolank.value).toBe(2)
    expect(r.numbers.bhagyank.value).toBe(6)
    expect(r.numbers.personalMonth.value).toBe(8)
    expect(r.reading.greeting).toBe(READING.greeting)
    expect(r.left).toEqual({ preset: 2, typed: 1 })
    const row = await leads.get(r.leadId)
    expect(row).toMatchObject({ name: 'Sanjay Prabhakar', email: 'sanjay@example.com', moolank: 2, bhagyank: 6, language: 'en', ip_hash: hashIp('1.2.3.4') })
    expect(JSON.stringify(row)).not.toMatch(/1990|03-29/)
    const sent = calls.map((c) => c.input + c.system).join('\n')
    expect(sent).toContain('First name: Sanjay')
    expect(sent).not.toMatch(/example\.com|1990|Prabhakar/i)
  })

  it('refuses without a name, a valid email, a real date of birth or the consent tick', async () => {
    const { ctx } = setup()
    for (const over of [{ name: ' ' }, { email: 'nope' }, { dob: '2026-02-30' }, { dob: '2030-01-01' }, { consent: false }]) {
      expect((await insightRequest(ctx, reading(over), '1.2.3.4', NOW)).status).toBe(400)
    }
  })

  it('allows 3 readings a day per address', async () => {
    const { ctx } = setup()
    for (let i = 0; i < LIMITS.readingsPerDay; i++) expect((await insightRequest(ctx, reading(), '9.9.9.9', NOW)).status).toBe(200)
    expect((await insightRequest(ctx, reading(), '9.9.9.9', NOW)).status).toBe(429)
    expect((await insightRequest(ctx, reading(), '8.8.8.8', NOW)).status).toBe(200)
  })

  it('still gives the fixed reading when the AI is unavailable', async () => {
    const { ctx } = setup(async () => null)
    const r = await body(await insightRequest(ctx, reading({ lang: 'hinglish' }), '1.2.3.4', NOW))
    expect(r.status).toBe(200)
    expect(r.ai).toBe(false)
    expect(r.reading.greeting).toBe('Hey Sanjay, aapka Moolank 2 hai.')
    expect(r.reading.month).toContain('November 2026')
    expect(r.reading.questions).toHaveLength(2)
  })

  it('answers two suggested questions and one of their own, then no more', async () => {
    const { ctx, calls } = setup()
    const { leadId } = await body(await insightRequest(ctx, reading(), '1.2.3.4', NOW))
    const ask = (question: string, preset: boolean) => insightRequest(ctx, { kind: 'ask', leadId, name: 'Sanjay', dob: '1990-03-29', lang: 'en', question, preset }, '1.2.3.4', NOW)
    expect((await body(await ask('Is this a good month to change my job?', true))).left).toEqual({ preset: 1, typed: 1 })
    expect((await body(await ask('Will my relationship settle?', true))).left).toEqual({ preset: 0, typed: 1 })
    expect((await ask('Another suggested one', true)).status).toBe(429)
    const own = await body(await ask('Will I marry my girlfriend despite our families?', false))
    expect(own).toMatchObject({ status: 200, answer: ANSWER.answer, expert: ANSWER.expert, left: { preset: 0, typed: 0 } })
    expect(calls.at(-1)!.input).toContain('do not hint at hidden bad news')
    expect((await ask('One more question of mine', false)).status).toBe(429)
  })

  it('only answers for the person the reading was for', async () => {
    const { ctx } = setup()
    const { leadId } = await body(await insightRequest(ctx, reading(), '1.2.3.4', NOW))
    const r = await insightRequest(ctx, { kind: 'ask', leadId, name: 'Sanjay', dob: '1991-07-14', question: 'Is this my month?', preset: true }, '1.2.3.4', NOW)
    expect(r.status).toBe(400)
  })
})

describe('Gemini connection', () => {
  it('reads the text of the model steps and parses JSON, even in a code fence', () => {
    expect(textOf({ steps: [{ type: 'user_input', content: [{ text: 'q' }] }, { type: 'model_output', content: [{ type: 'text', text: '{"a":' }, { text: '1}' }] }] })).toBe('{"a":1}')
    expect(textOf({ output_text: '{"b":2}' })).toBe('{"b":2}')
    expect(parseJson('```json\n{"x": 1}\n```')).toEqual({ x: 1 })
    expect(parseJson('Here you go: {"y": 2} done')).toEqual({ y: 2 })
    expect(parseJson('no json')).toBeNull()
  })

  it('sends a stateless request with the key in a header, and falls back to the second model when busy', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ text: '{"ok":true}' }] }] }), { status: 200 }))
    const call = geminiCaller({ apiKey: 'k', models: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'] }, fetchFn as unknown as typeof fetch)
    expect(await call({ system: 's', input: 'i', schema: { type: 'object' } })).toEqual({ ok: true })
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions')
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k')
    const sent = JSON.parse(init.body as string)
    expect(sent).toMatchObject({ model: 'gemini-3.8-flash', store: false, system_instruction: 's', response_format: { mime_type: 'application/json' } })
    expect(JSON.parse((fetchFn.mock.calls[1] as [string, RequestInit])[1].body as string).model).toBe('gemini-3.5-flash-lite')
  })
})
