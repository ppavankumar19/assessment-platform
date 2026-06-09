import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check active session
  const { data: session } = await supabase
    .from('candidate_sessions')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('round_id', params.id)
    .eq('status', 'started')
    .single()

  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 403 })

  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, round_id, sequence_order, title, description, type, code_snippet, starter_code, test_cases, time_limit_s, memory_limit_mb, points')
    .eq('round_id', params.id)
    .order('sequence_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Filter hidden test cases and remove expected_output
  const filtered = questions?.map(q => ({
    ...q,
    test_cases: q.test_cases
      ? (q.test_cases as any[]).filter((tc: any) => !tc.is_hidden)
      : null,
  }))

  return NextResponse.json(filtered)
}
