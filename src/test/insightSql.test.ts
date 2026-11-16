import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const code = readFileSync(join(process.cwd(), 'supabase/insight/0800_insight_leads.sql'), 'utf8').replace(/--.*$/gm, '')

describe('free-reading leads table (0800)', () => {
  it('stops if run twice', () => {
    expect(code).toMatch(/to_regclass\('public\.insight_leads'\) is not null/)
  })
  it('never stores a date of birth', () => {
    expect(code).not.toMatch(/date_of_birth|\bdob\b|birth/i)
  })
  it('is closed to visitors and customers, open only to the website server', () => {
    expect(code).toContain('alter table public.insight_leads enable row level security;')
    expect(code).toContain('revoke all on table public.insight_leads from anon, authenticated;')
    expect(code).toContain('grant select, insert, update on table public.insight_leads to service_role;')
    expect(code).not.toMatch(/grant [^;]*delete/i)
    expect(code).not.toMatch(/create policy/i)
  })
})
