import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ServerConfig } from './config.js'

/**
 * People who asked for the free reading: the Supabase table public.insight_leads (supabase/insight/0800_insight_leads.sql),
 * reachable only with the server's secret key. It keeps the name, email, the two numbers and how many free questions
 * were used. The date of birth is never stored. The IP address is kept only as a salted hash, to limit readings per day.
 */
export interface LeadRow {
  id: string
  created_at: string
  name: string
  email: string
  moolank: number
  bhagyank: number
  language: 'en' | 'hinglish'
  ip_hash: string
  preset_used: number
  typed_used: number
  consent_version: string
}
export type NewLead = Omit<LeadRow, 'id' | 'created_at' | 'preset_used' | 'typed_used'>

export interface LeadStore {
  add(lead: NewLead): Promise<string>
  get(id: string): Promise<LeadRow | null>
  /** readings started from this (hashed) address since the given time */
  countSince(ipHash: string, sinceIso: string): Promise<number>
  /** Uses one free question if one is left (atomic where the store allows). False when none is left. */
  useQuestion(id: string, kind: 'preset' | 'typed', limit: number): Promise<boolean>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isLeadId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id)

class SupabaseLeads implements LeadStore {
  private db: SupabaseClient
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  async add(lead: NewLead) {
    const { data, error } = await this.db.from('insight_leads').insert(lead).select('id').single()
    if (error) throw new Error(`lead insert failed: ${error.message}`)
    return (data as { id: string }).id
  }
  async get(id: string) {
    const { data, error } = await this.db.from('insight_leads').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error(`lead read failed: ${error.message}`)
    return data as LeadRow | null
  }
  async countSince(ipHash: string, sinceIso: string) {
    const { count, error } = await this.db.from('insight_leads').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', sinceIso)
    if (error) throw new Error(`lead count failed: ${error.message}`)
    return count ?? 0
  }
  async useQuestion(id: string, kind: 'preset' | 'typed', limit: number) {
    const col = kind === 'preset' ? 'preset_used' : 'typed_used'
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await this.get(id)
      if (!row || row[col] >= limit) return false
      // compare-and-set: only succeeds if nobody used a question in between
      const { data, error } = await this.db.from('insight_leads').update({ [col]: row[col] + 1 }).eq('id', id).eq(col, row[col]).select('id')
      if (error) throw new Error(`lead update failed: ${error.message}`)
      if (data && data.length) return true
    }
    return false
  }
}

/** On this computer only: leads kept in a git-ignored file (or in memory for tests). */
export class MemoryLeads implements LeadStore {
  private rows: LeadRow[] = []
  constructor(private file: string | null) {
    if (file && existsSync(file)) this.rows = JSON.parse(readFileSync(file, 'utf8')) as LeadRow[]
  }
  private save() {
    if (!this.file) return
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file, JSON.stringify(this.rows, null, 2))
  }
  async add(lead: NewLead) {
    const id = randomUUID()
    this.rows.push({ ...lead, id, created_at: new Date().toISOString(), preset_used: 0, typed_used: 0 })
    this.save()
    return id
  }
  async get(id: string) { return this.rows.find((r) => r.id === id) ?? null }
  async countSince(ipHash: string, sinceIso: string) { return this.rows.filter((r) => r.ip_hash === ipHash && r.created_at >= sinceIso).length }
  async useQuestion(id: string, kind: 'preset' | 'typed', limit: number) {
    const row = this.rows.find((r) => r.id === id)
    const col = kind === 'preset' ? 'preset_used' : 'typed_used'
    if (!row || row[col] >= limit) return false
    row[col] += 1
    this.save()
    return true
  }
}

let cached: { key: string; store: LeadStore } | null = null
export function leadsFor(cfg: ServerConfig): LeadStore | null {
  const key = cfg.store === 'supabase' ? `s:${cfg.supabase!.url}` : cfg.store
  if (cached?.key === key) return cached.store
  const store = cfg.store === 'supabase' ? new SupabaseLeads(cfg.supabase!.url, cfg.supabase!.serviceKey)
    : cfg.store === 'memory' ? new MemoryLeads(join(process.cwd(), '.data', 'dev-leads.json'))
    : null
  cached = store ? { key, store } : null
  return store
}
