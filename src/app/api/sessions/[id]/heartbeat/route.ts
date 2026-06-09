import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session } = await supabase
    .from('candidate_sessions')
    .select('*, rounds(duration_minutes)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!session || session.status !== 'started') {
    return NextResponse.json({ valid: false, remaining_ms: 0 }, { status: 403 })
  }

  const expiresAt = new Date(new Date(session.started_at).getTime() + (session.rounds as any).duration_minutes * 60000)
  const remaining = expiresAt.getTime() - Date.now()

  if (remaining <= 0) {
    return NextResponse.json({ valid: false, remaining_ms: 0 }, { status: 403 })
  }

  return NextResponse.json({ valid: true, remaining_ms: remaining })
}
