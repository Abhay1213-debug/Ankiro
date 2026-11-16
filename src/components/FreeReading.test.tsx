import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FreeReading } from './FreeReading'

afterEach(() => vi.unstubAllGlobals())

const w = (value: number) => ({ value, working: String(value) })
const READING = {
  leadId: '0b8f4d8e-2b8a-4c55-9d1f-3c2a4e6b7a10',
  ai: true,
  numbers: { moolank: w(2), bhagyank: w(6), personalYear: w(6), personalMonth: w(8), period: { label: 'November 2026' } },
  reading: { greeting: 'Hey Sanjay, your Moolank is 2.', moolank: 'You sense moods.', bhagyank: 'Your path is care.', month: 'A month for effort.', focus: ['Push one goal'], questions: ['Is this a good month to change my job?', 'Will my relationship settle?'] },
  left: { preset: 2, typed: 1 },
}

function serve() {
  const sent: Record<string, unknown>[] = []
  let left = { preset: 2, typed: 1 }
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const b = JSON.parse(init.body as string) as Record<string, unknown>
    sent.push(b)
    if (b.kind === 'reading') return new Response(JSON.stringify(READING), { status: 200 })
    left = b.preset ? { ...left, preset: left.preset - 1 } : { ...left, typed: 0 }
    return new Response(JSON.stringify({ answer: `Answer to: ${String(b.question)}`, step: 'Write it down.', expert: 'Your expert would look at the timing.', left }), { status: 200 })
  }))
  return sent
}

async function fill(user: ReturnType<typeof userEvent.setup>, tick = true) {
  await user.type(screen.getByLabelText('Your name'), 'Sanjay Prabhakar')
  await user.type(screen.getByLabelText('Email'), 'sanjay@example.com')
  await user.selectOptions(screen.getByLabelText('Day'), '29')
  await user.selectOptions(screen.getByLabelText('Month'), '3')
  await user.type(screen.getByLabelText('Year'), '1990')
  if (tick) await user.click(screen.getByRole('checkbox'))
}

describe('<FreeReading />', () => {
  it('needs the name, email, date and consent before asking for a reading', async () => {
    const sent = serve()
    render(<MemoryRouter><FreeReading /></MemoryRouter>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /get my free reading/i }))
    expect(screen.getByText('Please enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Please tick the box to continue.')).toBeInTheDocument()
    expect(sent).toHaveLength(0)
  })

  it('greets by name, then two suggested questions, one own question, and the expert step', async () => {
    const sent = serve()
    render(<MemoryRouter><FreeReading /></MemoryRouter>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: 'Hinglish' }))
    await fill(user)
    await user.click(screen.getByRole('button', { name: /get my free reading/i }))
    expect(await screen.findByRole('heading', { name: 'Hey Sanjay, your Moolank is 2.' })).toBeInTheDocument()
    expect(sent[0]).toMatchObject({ kind: 'reading', name: 'Sanjay Prabhakar', dob: '1990-03-29', lang: 'hinglish', consent: true })
    expect(screen.getByText('Your November 2026')).toBeInTheDocument()
    expect(screen.queryByLabelText(/what’s on your mind/i)).toBeNull()

    await user.click(screen.getByRole('button', { name: /change my job/i }))
    expect(await screen.findByText('Answer to: Is this a good month to change my job?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /relationship settle/i }))
    expect(await screen.findByText('Answer to: Will my relationship settle?')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /take this further/i })).toBeNull()

    const box = screen.getByLabelText(/what’s on your mind/i)
    await user.type(box, 'Will I marry my girlfriend despite our families?')
    await user.click(screen.getByRole('button', { name: /^ask/i }))
    expect(await screen.findByRole('heading', { name: /take this further with an expert/i })).toBeInTheDocument()
    // every answer ends with the expert line and a Book a consultation button
    expect(screen.getAllByText('Your expert would look at the timing.')).toHaveLength(3)
    expect(screen.getAllByRole('link', { name: /book a consultation/i })[0]).toHaveAttribute('href', '/consultation/request?service=numerology')
    expect(screen.queryByText(/written by ai/i)).toBeNull()
    expect(screen.queryByText(/how your numbers were worked out/i)).toBeNull()
    expect(screen.getByRole('link', { name: /talk to an expert/i })).toHaveAttribute('href', '/consultation/request?service=numerology')
    expect(screen.getByRole('link', { name: /explore packages/i })).toHaveAttribute('href', '/consultation#prices')
    expect(screen.queryByLabelText(/what’s on your mind/i)).toBeNull()
  })

  it('explains the daily limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"limit"}', { status: 429 })))
    render(<MemoryRouter><FreeReading /></MemoryRouter>)
    const user = userEvent.setup()
    await fill(user)
    await user.click(screen.getByRole('button', { name: /get my free reading/i }))
    expect(await screen.findByText(/used today’s free readings/i)).toBeInTheDocument()
  })
})
