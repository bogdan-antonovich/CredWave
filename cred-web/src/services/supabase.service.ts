import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/config/env'

let supabaseInstance: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!config.supabase.url || !config.supabase.anonKey) {
    return null
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.supabase.url, config.supabase.anonKey)
  }
  return supabaseInstance
}
