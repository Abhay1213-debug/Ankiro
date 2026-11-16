import { createHash } from 'node:crypto'
import { bhagyankThemes, personalMonthThemes } from '../../src/data/numerologyThemes.js'
import { validateDate } from '../../src/lib/moolank.js'
import { numerologyProfile, type NumerologyProfile } from '../../src/shared/numerology.js'
import { json } from './bookings.js'
import { readConfig, type ServerConfig } from './config.js'
import { aiConfig, geminiCaller, type AiCall } from './gemini.js'
import { isLeadId, leadsFor, type LeadStore } from './leads.js'

/**
 * The free AI reading behind /free-insight.
 *
 *   reading  name + email + date of birth → the numbers (worked out here, never by the AI), a reading for this month
 *            and two suggested questions. The name and email are kept as a lead; the date of birth is not stored.
 *   ask      one question about their life: the two suggested ones get a full short answer, then one question of
 *            their own gets a first insight and what an expert call would go into.
 *
 * Only the first name, the numbers, the month and the question go to the AI. Never the email or the date of birth.
 */

export const LIMITS = { readingsPerDay: 3, preset: 2, typed: 1 } as const
export const CONSENT_VERSION = 'insight-2026-11-v1'
const NAME_MAX = 60
const QUESTION_MAX = 400

export type Lang = 'en' | 'hinglish'

export interface InsightCtx { cfg: ServerConfig; leads: LeadStore | null; ai: AiCall | null }

export function insightContext(cfg = readConfig()): InsightCtx {
  const ai = aiConfig()
  return { cfg, leads: leadsFor(cfg), ai: ai ? geminiCaller(ai) : cfg.dev ? devAi : null }
}

/** On this computer with no Gemini key: canned answers, so the whole journey can be tried. Never used on the live site. */
export const devAi: AiCall = async ({ schema }) => {
  const isReading = 'questions' in ((schema.properties ?? {}) as object)
  return isReading
    ? {
        greeting: 'Hey there, your Moolank is shown above. (Sample text: add GEMINI_API_KEY for real readings.)',
        moolank: 'Sample: this paragraph describes your nature and strengths from your Moolank.',
        bhagyank: 'Sample: this paragraph describes the direction of your life from your Bhagyank.',
        month: 'Sample: this paragraph gives a general view of your month for work, relationships and energy.',
        focus: ['Sample focus one', 'Sample focus two', 'Sample focus three'],
        questions: ['Is this a good month to change my job?', 'Will my relationship become more stable this month?'],
      }
    : { answer: 'Sample answer to the question, written from your numbers.', step: 'Sample step for this week.', expert: 'Sample: what an expert call would go into.' }
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i
const clean = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const firstName = (name: string) => name.split(' ')[0]
export const hashIp = (ip: string, salt = process.env.INSIGHT_SALT || 'ankiro-insight') => createHash('sha256').update(`${salt}:${ip}`).digest('hex')

function parseDob(raw: unknown, now: Date) {
  const m = typeof raw === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) : null
  if (!m) return null
  const v = validateDate({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, now)
  return v.ok ? v.date : null
}

// ---------- what the AI is told ----------

function system(lang: Lang) {
  return [
    'You write short, warm numerology readings for Ankiro, an Indian spiritual guidance service whose experts give one-to-one voice consultations.',
    'Use only Indian numerology: the Moolank (root number), Bhagyank (life-path number), personal year and personal month numbers you are given. The numbers are already calculated; never recalculate or change them.',
    'Never mention planets, zodiac signs, horoscopes, astrology, rituals, mantras, or gemstones as remedies.',
    'Never claim certainty or an accuracy percentage, and never predict specific events, dates, death, illness, pregnancy, exam results or court outcomes. Describe tendencies and themes, and say "may" or "is likely" where it fits.',
    'Speak directly to the person by first name, in plain, simple words. No fear, no guilt, no pressure.',
    'For health, legal, investment or mental-health worries, give gentle perspective and suggest a qualified professional. If someone mentions self-harm or wanting to die, tell them they matter, and that they can call Tele-MANAS on 14416 (free, 24x7, India) right now.',
    lang === 'hinglish'
      ? 'Write in Hinglish: conversational Hindi written in Roman (English) letters, mixed naturally with simple English words.'
      : 'Write in clear, simple Indian English.',
    'Return only JSON that matches the schema.',
  ].join('\n')
}

function facts(name: string, p: NumerologyProfile) {
  const b = bhagyankThemes[p.bhagyank.value]
  const m = personalMonthThemes[p.personalMonth.value]
  return [
    `First name: ${name}`,
    `Moolank: ${p.moolank.value}`,
    `Bhagyank: ${p.bhagyank.value} (${b.title}: ${b.text})`,
    `Personal year ${p.period.year}: ${p.personalYear.value}`,
    `Personal month for ${p.period.label}: ${p.personalMonth.value} (${m.theme}: ${m.text})`,
  ].join('\n')
}

const READING_SCHEMA = {
  type: 'object',
  properties: {
    greeting: { type: 'string', description: 'One sentence that greets them by first name and names their Moolank, e.g. "Hey Sanjay, your Moolank is 5."' },
    moolank: { type: 'string', description: '3 sentences: what their Moolank says about their nature and strengths, and one thing to watch.' },
    bhagyank: { type: 'string', description: '2-3 sentences: what their Bhagyank says about the direction of their life.' },
    month: { type: 'string', description: '4-5 sentences: a general view of this month for them, covering work or money, relationships, and energy, based on the personal month number and their Moolank.' },
    focus: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3, description: 'Three short, practical things to focus on this month (under 10 words each).' },
    questions: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2, description: 'Two questions this person is likely asking about their own life right now, written in first person and under 12 words, e.g. "Is this a good month to change my job?". One about work or money, one about relationships.' },
  },
  required: ['greeting', 'moolank', 'bhagyank', 'month', 'focus', 'questions'],
}

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    step: { type: 'string', description: 'One simple, practical step they can take this week (one sentence).' },
    expert: { type: 'string', description: 'What a one-to-one call with an Ankiro numerology expert would go deeper into for this exact question (1-2 sentences).' },
  },
  required: ['answer', 'step', 'expert'],
}

export interface Reading { greeting: string; moolank: string; bhagyank: string; month: string; focus: string[]; questions: string[] }

const strings = (x: unknown, n: number) => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()).slice(0, n) : [])

function asReading(x: unknown): Reading | null {
  const r = x as Record<string, unknown> | null
  if (!r) return null
  const text = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '')
  const reading = { greeting: text('greeting'), moolank: text('moolank'), bhagyank: text('bhagyank'), month: text('month'), focus: strings(r.focus, 3), questions: strings(r.questions, 2) }
  return reading.greeting && reading.moolank && reading.month && reading.questions.length === 2 ? reading : null
}

/** The reading without the AI: the fixed meanings, so the page always gives a result. */
export function plainReading(name: string, p: NumerologyProfile, lang: Lang): Reading {
  const b = bhagyankThemes[p.bhagyank.value]
  const m = personalMonthThemes[p.personalMonth.value]
  return {
    greeting: lang === 'hinglish' ? `Hey ${name}, aapka Moolank ${p.moolank.value} hai.` : `Hey ${name}, your Moolank is ${p.moolank.value}.`,
    moolank: '',
    bhagyank: `${b.title}. ${b.text}`,
    month: `${p.period.label} is a personal month ${p.personalMonth.value} for you: ${m.theme.toLowerCase()}. ${m.text}`,
    focus: [...m.focus],
    questions: ['Is this a good month for my career and money?', 'What does this month hold for my relationships?'],
  }
}

// ---------- requests ----------

export async function insightRequest(ctx: InsightCtx, raw: unknown, ip: string, now = new Date()): Promise<Response> {
  const body = (raw ?? {}) as Record<string, unknown>
  const lang: Lang = body.lang === 'hinglish' ? 'hinglish' : 'en'
  const name = clean(body.name, NAME_MAX)
  const dob = parseDob(body.dob, now)
  if (name.length < 2 || !/\p{L}/u.test(name) || !dob) return json({ error: 'invalid' }, 400)
  const profile = numerologyProfile(dob, now)
  const numbers = {
    moolank: profile.moolank, bhagyank: profile.bhagyank, personalYear: profile.personalYear, personalMonth: profile.personalMonth, period: profile.period,
  }

  if (body.kind === 'reading') {
    const email = clean(body.email, 254).toLowerCase()
    if (!EMAIL.test(email) || body.consent !== true) return json({ error: 'invalid' }, 400)
    const ipHash = hashIp(ip)
    let leadId: string | null = null
    if (ctx.leads) {
      try {
        const since = new Date(now.getTime() - 24 * 3600_000).toISOString()
        if ((await ctx.leads.countSince(ipHash, since)) >= LIMITS.readingsPerDay) return json({ error: 'limit' }, 429)
        leadId = await ctx.leads.add({ name, email, moolank: profile.moolank.value, bhagyank: profile.bhagyank.value, language: lang, ip_hash: ipHash, consent_version: CONSENT_VERSION })
      } catch (e) {
        console.error(e) // the reading still works; questions need a saved lead
      }
    }
    const fromAi = ctx.ai ? asReading(await ctx.ai({ system: system(lang), input: `Write the free reading for this person.\n${facts(firstName(name), profile)}`, schema: READING_SCHEMA })) : null
    return json({ leadId, numbers, ai: Boolean(fromAi), reading: fromAi ?? plainReading(firstName(name), profile, lang), left: leadId ? { preset: LIMITS.preset, typed: LIMITS.typed } : { preset: 0, typed: 0 } })
  }

  if (body.kind === 'ask') {
    const kind = body.preset === true ? 'preset' : 'typed'
    const question = clean(body.question, QUESTION_MAX)
    if (!isLeadId(body.leadId) || question.length < 3) return json({ error: 'invalid' }, 400)
    if (!ctx.leads || !ctx.ai) return json({ error: 'unavailable' }, 503)
    const lead = await ctx.leads.get(body.leadId)
    if (!lead || lead.moolank !== profile.moolank.value || lead.bhagyank !== profile.bhagyank.value) return json({ error: 'invalid' }, 400)
    if (!(await ctx.leads.useQuestion(lead.id, kind, LIMITS[kind]))) return json({ error: 'limit' }, 429)
    const ask = kind === 'preset'
      ? 'Answer their question in 3-4 sentences, using their numbers and this month. Then give one practical step, and in "expert" one sentence on what an expert call could add.'
      : 'This is their own question. Give a short first insight (2-3 sentences) using their numbers and this month: be honest and kind, and do not hint at hidden bad news or hold back a "secret". Give one practical step for this week. In "expert", say in 1-2 sentences what a one-to-one call with an Ankiro numerology expert would go into for this exact situation (for example timing, the specific choice in front of them, or compatibility using the other person\'s date of birth).'
    const out = (await ctx.ai({ system: system(lang), input: `${ask}\n${facts(firstName(lead.name), profile)}\nTheir question: """${question}"""`, schema: ANSWER_SCHEMA, maxTokens: 1024 })) as Record<string, unknown> | null
    const answer = typeof out?.answer === 'string' ? out.answer.trim() : ''
    if (!answer) return json({ error: 'unavailable' }, 503)
    const after = (await ctx.leads.get(lead.id)) ?? lead
    const left = { preset: Math.max(0, LIMITS.preset - after.preset_used), typed: Math.max(0, LIMITS.typed - after.typed_used) }
    return json({ answer, step: typeof out?.step === 'string' ? out.step.trim() : '', expert: typeof out?.expert === 'string' ? out.expert.trim() : '', left })
  }

  return json({ error: 'invalid' }, 400)
}
