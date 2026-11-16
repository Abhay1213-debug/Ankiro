/**
 * The numbers behind the free reading, worked out the same way on the server and in the browser. All of them use the
 * method the site already explains for the Moolank: add the digits until one digit (1–9) is left; 11 and 22 are
 * reduced too.
 *
 *   Moolank          the day of birth                          29 → 11 → 2
 *   Bhagyank         every digit of the full date of birth     29-03-1990 → 2+9+0+3+1+9+9+0 = 33 → 6
 *   Personal year    day + month of birth + the current year   for 2026: 2+9+0+3 + 2+0+2+6 = 24 → 6
 *   Personal month   personal year + the current month         November: 6 + 1+1 = 8
 *
 * "Current" means the date in India, so a reading at 1 am IST on the 1st already belongs to the new month.
 */

export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface BirthDate { day: number; month: number; year: number }

export interface NumberWorking { value: Digit; working: string }

export interface NumerologyProfile {
  moolank: NumberWorking
  bhagyank: NumberWorking
  personalYear: NumberWorking
  personalMonth: NumberWorking
  /** the month the reading is for, in India */
  period: { month: number; year: number; label: string }
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const digitsOf = (n: number | string) => String(n).replace(/\D/g, '').split('').map(Number)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/** Adds digits until one is left, recording each step: 33 → 3 + 3 = 6. */
export function reduce(total: number): NumberWorking {
  if (!Number.isInteger(total) || total < 1) throw new RangeError('total must be a positive integer')
  const steps = [String(total)]
  let n = total
  while (n > 9) {
    const next = sum(digitsOf(n))
    steps.push(`${digitsOf(n).join(' + ')} = ${next}`)
    n = next
  }
  return { value: n as Digit, working: steps.join(' → ') }
}

/** Adds the given digits, then reduces: "2 + 9 + 0 + 3 = 14 → 1 + 4 = 5". */
function fromDigits(digits: number[]): NumberWorking {
  const total = sum(digits)
  const r = reduce(total)
  const first = digits.length > 1 ? `${digits.join(' + ')} = ${total}` : String(total)
  const rest = r.working.split(' → ').slice(1)
  return { value: r.value, working: [first, ...rest].join(' → ') }
}

/** The calendar month in India for a moment in time. */
export function indiaMonth(now = new Date()): { month: number; year: number } {
  const ist = new Date(now.getTime() + 330 * 60_000)
  return { month: ist.getUTCMonth() + 1, year: ist.getUTCFullYear() }
}

export function numerologyProfile(birth: BirthDate, now = new Date()): NumerologyProfile {
  const { month, year } = indiaMonth(now)
  const dd = String(birth.day).padStart(2, '0')
  const mm = String(birth.month).padStart(2, '0')
  const personalYear = fromDigits([...digitsOf(dd), ...digitsOf(mm), ...digitsOf(year)])
  const pm = reduce(personalYear.value + sum(digitsOf(month)))
  return {
    moolank: fromDigits(digitsOf(birth.day)),
    bhagyank: fromDigits([...digitsOf(dd), ...digitsOf(mm), ...digitsOf(birth.year)]),
    personalYear,
    personalMonth: { value: pm.value, working: `${personalYear.value} + ${digitsOf(month).join(' + ')} = ${personalYear.value + sum(digitsOf(month))}${pm.working.includes('→') ? ` → ${pm.working.split(' → ').slice(1).join(' → ')}` : ''}` },
    period: { month, year, label: `${MONTH_NAMES[month - 1]} ${year}` },
  }
}
