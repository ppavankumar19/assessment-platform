import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  // Admin-only migration endpoint
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check if migration already applied by testing a column
  const { error: testError } = await serviceClient.from('candidate_sessions').select('session_token').limit(1)
  if (!testError) {
    return NextResponse.json({ message: 'Migration already applied' })
  }

  return NextResponse.json({
    message: 'Migration needs to be run manually via Supabase Dashboard SQL Editor',
    sql: `-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE;
ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS candidate_name TEXT;
ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS candidate_email TEXT;
ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS college_name TEXT;
ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS roll_no TEXT;
ALTER TABLE candidate_sessions ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE candidate_sessions ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_candidate_sessions_session_token ON candidate_sessions (session_token);
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS cutoff_score INT NOT NULL DEFAULT 0;`
  })
}
