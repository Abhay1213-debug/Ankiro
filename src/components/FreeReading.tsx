import { ArrowRight, MessageCircle, PhoneCall, Sparkles } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { moolankMeanings } from '../data/moolankMeanings'
import { validateDate } from '../lib/moolank'
import type { Digit, NumberWorking } from '../shared/numerology'
import { ButtonLink } from './ui'

/**
 * The free AI reading: name, email and date of birth give the person's numbers and a reading for this month, then two
 * suggested questions, then one question of their own, and finally the step to a one-to-one expert call.
 * The server works out the numbers, keeps the name and email (not the date of birth) and asks the AI for the words.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const pad = (n: string | number) => String(n).padStart(2, '0')
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

type Lang = 'en' | 'hinglish'
interface Numbers { moolank: NumberWorking; bhagyank: NumberWorking; personalYear: NumberWorking; personalMonth: NumberWorking; period: { label: string } }
interface Reading { greeting: string; moolank: string; bhagyank: string; month: string; focus: string[]; questions: string[] }
interface ReadingResponse { leadId: string | null; numbers: Numbers; reading: Reading; ai: boolean; left: { preset: number; typed: number } }
interface Turn { question: string; typed: boolean; answer?: string; step?: string; expert?: string; failed?: boolean }

const failMessage = (status: number) =>
  status === 429 ? 'You’ve used today’s free readings on this device. Please come back tomorrow, or talk to an expert now.'
    : status === 400 ? 'Please check your details and try again.'
      : 'We couldn’t prepare your reading just now. Please try again in a minute.'

async function post(body: object): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number }> {
  try {
    const r = await fetch('/api/insight', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) return { ok: false, status: r.status }
    return { ok: true, data: (await r.json()) as Record<string, unknown> }
  } catch {
    return { ok: false, status: 0 }
  }
}

export function FreeReading() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [lang, setLang] = useState<Lang>('en')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState('')
  const [result, setResult] = useState<ReadingResponse>()
  const [dob, setDob] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [asking, setAsking] = useState(false)
  const [own, setOwn] = useState('')
  const [ownError, setOwnError] = useState('')
  const [left, setLeft] = useState({ preset: 0, typed: 0 })
  const ids = { name: useId(), email: useId(), dob: useId(), consent: useId(), own: useId() }
  const resultRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<HTMLDivElement>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    if (name.trim().length < 2) found.name = 'Please enter your name.'
    if (!EMAIL.test(email.trim())) found.email = 'Please enter a valid email address.'
    if (!day || !month || !/^\d{4}$/.test(year)) found.dob = 'Please choose your day and month, and enter the year as four digits.'
    else {
      const v = validateDate({ day: Number(day), month: Number(month), year: Number(year) })
      if (!v.ok) found.dob = v.error
    }
    if (!consent) found.consent = 'Please tick the box to continue.'
    setErrors(found)
    setFailure('')
    if (Object.keys(found).length) return
    const iso = `${year}-${pad(month)}-${pad(day)}`
    setLoading(true)
    const r = await post({ kind: 'reading', name: name.trim(), email: email.trim(), dob: iso, lang, consent: true })
    setLoading(false)
    if (!r.ok) return setFailure(failMessage(r.status))
    const data = r.data as unknown as ReadingResponse
    setDob(iso)
    setResult(data)
    setLeft(data.left)
    setTurns([])
    requestAnimationFrame(() => resultRef.current?.focus())
  }

  async function ask(question: string, typed: boolean) {
    if (!result?.leadId || asking) return
    setAsking(true)
    setTurns((t) => [...t, { question, typed }])
    const r = await post({ kind: 'ask', leadId: result.leadId, name: name.trim(), dob, lang, question, preset: !typed })
    setAsking(false)
    setTurns((t) => t.map((turn, i) => (i === t.length - 1
      ? r.ok ? { ...turn, answer: String(r.data.answer ?? ''), step: String(r.data.step ?? ''), expert: String(r.data.expert ?? '') } : { ...turn, failed: true }
      : turn)))
    if (r.ok) setLeft(r.data.left as { preset: number; typed: number })
    else if (r.status === 429) setLeft((l) => (typed ? { ...l, typed: 0 } : { ...l, preset: 0 }))
    requestAnimationFrame(() => lastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function askOwn(e: FormEvent) {
    e.preventDefault()
    const q = own.trim()
    if (q.length < 10) return setOwnError('Tell us a little more: a sentence or two is enough.')
    setOwnError('')
    setOwn('')
    void ask(q, true)
  }

  if (!result) {
    return (
      <form className="calc reading-form" onSubmit={onSubmit} noValidate aria-label="Free reading" data-clarity-mask="True">
        <div className="reading-form__head">
          <h2>Your free reading</h2>
          <div className="lang-toggle" role="radiogroup" aria-label="Language of your reading">
            {(['en', 'hinglish'] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? 'is-on' : ''} onClick={() => setLang(l)}>
                {l === 'en' ? 'English' : 'Hinglish'}
              </button>
            ))}
          </div>
        </div>
        <label className="field" htmlFor={ids.name}>
          <span>Your name</span>
          <input id={ids.name} className="input" value={name} autoComplete="name" maxLength={60} aria-invalid={Boolean(errors.name)} onChange={(e) => setName(e.target.value)} />
          {errors.name && <span className="field-error" role="alert">{errors.name}</span>}
        </label>
        <label className="field" htmlFor={ids.email}>
          <span>Email</span>
          <input id={ids.email} className="input" type="email" inputMode="email" value={email} autoComplete="email" aria-invalid={Boolean(errors.email)} onChange={(e) => setEmail(e.target.value)} />
          {errors.email && <span className="field-error" role="alert">{errors.email}</span>}
        </label>
        <fieldset className="calc__fieldset" aria-describedby={errors.dob ? ids.dob : undefined}>
          <legend className="field-legend">Date of birth</legend>
          <div className="dob">
            <label className="dob__field"><span>Day</span>
              <select className="select" value={day} aria-invalid={Boolean(errors.dob)} autoComplete="bday-day" onChange={(e) => setDay(e.target.value)}>
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </label>
            <label className="dob__field dob__field--month"><span>Month</span>
              <select className="select" value={month} aria-invalid={Boolean(errors.dob)} autoComplete="bday-month" onChange={(e) => setMonth(e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
            <label className="dob__field"><span>Year</span>
              <input className="input" inputMode="numeric" maxLength={4} placeholder="YYYY" value={year} aria-invalid={Boolean(errors.dob)} autoComplete="bday-year" onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
          {errors.dob && <p className="field-error" id={ids.dob} role="alert">{errors.dob}</p>}
        </fieldset>
        <label className="check" htmlFor={ids.consent}>
          <input id={ids.consent} type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={Boolean(errors.consent)} />
          <span>Ankiro may keep my name and email and contact me about my reading. My date of birth is not saved. <Link to="/privacy">Privacy Policy</Link></span>
        </label>
        {errors.consent && <p className="field-error" role="alert">{errors.consent}</p>}
        {failure && <p className="field-error" role="alert">{failure}</p>}
        <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
          <Sparkles size={18} aria-hidden="true" /> {loading ? 'Preparing your reading…' : 'Get my free reading'}
        </button>
      </form>
    )
  }

  const { numbers, reading } = result
  const n = numbers.moolank.value as Digit
  const meaning = moolankMeanings[n]
  const askedPresets = new Set(turns.filter((t) => !t.typed).map((t) => t.question))
  const presetsDone = left.preset === 0 || reading.questions.every((q) => askedPresets.has(q))
  const typedTurn = turns.find((t) => t.typed && (t.answer || t.failed))
  const canAsk = Boolean(result.leadId)

  return (
    <div className="calc reading" ref={resultRef} tabIndex={-1} aria-live="polite" data-clarity-mask="True">
      <p className="eyebrow">Your free reading</p>
      <h2 className="reading__greeting">{reading.greeting}</h2>

      <div className="reading__numbers">
        {[
          { label: 'Moolank', sub: 'your root number', w: numbers.moolank },
          { label: 'Bhagyank', sub: 'your life path', w: numbers.bhagyank },
          { label: 'This month', sub: numbers.period.label, w: numbers.personalMonth },
        ].map((x) => (
          <div key={x.label} className="reading__num">
            <span className="reading__digit">{x.w.value}</span>
            <strong>{x.label}</strong>
            <span>{x.sub}</span>
          </div>
        ))}
      </div>

      <section className="reading__block">
        <h3>Your Moolank {n}</h3>
        <ul className="theme-list" aria-label={`Moolank ${n} keywords`}>{meaning.keywords.map((k) => <li key={k}>{k}</li>)}</ul>
        {reading.moolank ? <p>{reading.moolank}</p> : <ul className="reading__points">{meaning.points.map((p) => <li key={p}>{p}</li>)}</ul>}
      </section>

      {reading.bhagyank && (
        <section className="reading__block">
          <h3>Your Bhagyank {numbers.bhagyank.value}</h3>
          <p>{reading.bhagyank}</p>
        </section>
      )}

      <section className="reading__block reading__block--month">
        <h3>Your {numbers.period.label}</h3>
        <p>{reading.month}</p>
        {reading.focus.length > 0 && (
          <ul className="reading__focus" aria-label="Focus this month">{reading.focus.map((f) => <li key={f}>{f}</li>)}</ul>
        )}
      </section>

      {canAsk && (
        <section className="reading__ask" aria-labelledby="ask-h">
          <h3 id="ask-h">Ask about your life</h3>
          <div className="reading__chips">
            {reading.questions.map((q) => (
              <button key={q} type="button" className="chip-q" disabled={asking || askedPresets.has(q) || left.preset === 0} onClick={() => void ask(q, false)}>
                <MessageCircle size={16} aria-hidden="true" /> {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {turns.map((t, i) => (
        <div key={`${i}-${t.question}`} className={`turn${t.typed ? ' turn--own' : ''}`} ref={i === turns.length - 1 ? lastRef : undefined}>
          <p className="turn__q">{t.question}</p>
          {!t.answer && !t.failed && <p className="turn__a turn__a--wait">Reading your numbers…</p>}
          {t.failed && <p className="field-error">We couldn’t answer just now. Please try again later, or ask our expert directly.</p>}
          {t.answer && (
            <div className="turn__a">
              <p>{t.answer}</p>
              {t.step && <p className="turn__step"><strong>This week:</strong> {t.step}</p>}
              <div className="turn__expert">
                {t.expert && <p>{t.expert}</p>}
                <ButtonLink to="/consultation/request?service=numerology" arrow>Book a consultation</ButtonLink>
              </div>
            </div>
          )}
        </div>
      ))}

      {canAsk && presetsDone && !typedTurn && left.typed > 0 && !turns.some((t) => t.typed) && (
        <form className="reading__own" onSubmit={askOwn} noValidate>
          <label htmlFor={ids.own}><h3>What’s on your mind?</h3></label>
          <p className="hint">Tell us what you’re facing right now, in your own words.</p>
          <textarea id={ids.own} className="textarea" rows={3} maxLength={400} value={own} placeholder="For example: I’m unsure whether to accept a job offer in another city." aria-invalid={Boolean(ownError)} onChange={(e) => setOwn(e.target.value)} />
          {ownError && <p className="field-error" role="alert">{ownError}</p>}
          <button type="submit" className="btn btn--dark" disabled={asking}>Ask <ArrowRight size={16} aria-hidden="true" /></button>
        </form>
      )}

      {(!canAsk || typedTurn || (presetsDone && left.typed === 0)) && (
        <section className="expert-card" aria-labelledby="expert-h">
          <PhoneCall size={22} aria-hidden="true" />
          <h3 id="expert-h">Take this further with an expert</h3>
          <p>Your reading shows the themes. On a one-to-one voice call, an Ankiro numerology expert looks at your full situation and tells you what to do, how and when.</p>
          <div className="cluster">
            <ButtonLink to="/consultation/request?service=numerology" arrow>Talk to an expert</ButtonLink>
            <ButtonLink to="/consultation#prices" variant="ghost">Explore packages</ButtonLink>
          </div>
        </section>
      )}

    </div>
  )
}
