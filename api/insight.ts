import { json } from './_lib/bookings.js'
import { insightContext, insightRequest } from './_lib/insight.js'

/** POST /api/insight: the free AI reading ({ kind: 'reading' }) and its follow-up questions ({ kind: 'ask' }). */
export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid' }, 400)
  }
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  try {
    return await insightRequest(insightContext(), body, ip)
  } catch (e) {
    console.error(e)
    return json({ error: 'unavailable' }, 503)
  }
}
