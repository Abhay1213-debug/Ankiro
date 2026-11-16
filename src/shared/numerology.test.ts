import { describe, expect, it } from 'vitest'
import { indiaMonth, numerologyProfile, reduce } from './numerology'

describe('numerology numbers', () => {
  it('reduces to one digit, 11 and 22 included', () => {
    expect(reduce(33)).toEqual({ value: 6, working: '33 → 3 + 3 = 6' })
    expect(reduce(11).value).toBe(2)
    expect(reduce(22).value).toBe(4)
    expect(reduce(7)).toEqual({ value: 7, working: '7' })
  })

  it('works out Moolank, Bhagyank, personal year and month for 29 March 1990 in November 2026', () => {
    const p = numerologyProfile({ day: 29, month: 3, year: 1990 }, new Date('2026-11-16T10:00:00Z'))
    expect(p.moolank.value).toBe(2)
    expect(p.moolank.working).toBe('2 + 9 = 11 → 1 + 1 = 2')
    expect(p.bhagyank.value).toBe(6) // 2+9+0+3+1+9+9+0 = 33 → 6
    expect(p.personalYear.value).toBe(6) // 2+9+0+3+2+0+2+6 = 24 → 6
    expect(p.personalMonth.value).toBe(8) // 6 + 1 + 1 = 8
    expect(p.period.label).toBe('November 2026')
  })

  it('uses the month in India: 1 am IST on 1 December is already December', () => {
    expect(indiaMonth(new Date('2026-11-30T19:45:00Z'))).toEqual({ month: 12, year: 2026 })
    expect(indiaMonth(new Date('2026-11-30T18:00:00Z'))).toEqual({ month: 11, year: 2026 })
  })

  it('gives a single digit for every day of a year', () => {
    for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
      const p = numerologyProfile({ day: d, month: m, year: 1985 }, new Date('2026-05-10T00:00:00Z'))
      for (const n of [p.moolank, p.bhagyank, p.personalYear, p.personalMonth]) expect(n.value).toBeGreaterThanOrEqual(1), expect(n.value).toBeLessThanOrEqual(9)
    }
  })
})
