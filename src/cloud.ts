import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'

// Accounts and cloud sync turn on when these two values are set (in Vercel: Settings → Environment Variables).
// Without them the app runs as a local demo and keeps data in this browser only.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && key ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }) : null
export const cloudEnabled = !!supabase
export type { Session }

const TABLE = 'user_state'

export async function loadCloudState(userId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from(TABLE).select('data').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return (data?.data as Record<string, unknown>) ?? null
}

export async function saveCloudState(userId: string, data: unknown) {
  if (!supabase) return
  const { error } = await supabase.from(TABLE).upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
  if (error) throw error
}
