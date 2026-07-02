import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

// Service-role client — bypasses RLS. Use only for server-side operations.
export const db = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

// Returns a user-scoped client to verify tokens via Supabase Auth.
export function makeUserClient(accessToken) {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

export const SUPABASE_URL  = url
export const SUPABASE_ANON = anonKey
