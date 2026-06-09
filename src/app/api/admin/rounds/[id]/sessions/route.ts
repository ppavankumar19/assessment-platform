import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sessions, error } = await serviceClient
    .from('candidate_sessions')
    .select(`
      *,
      users!inner(email, full_name),
      submissions(id, is_final, score)
    `)
    .eq('round_id', params.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: round } = await serviceClient.from('rounds').select('duration_minutes').eq('id', params.id).single()

  const enriched = sessions?.map((s: any) => ({
    id: s.id,
    user_email: s.users.email,
    user_name: s.users.full_name,
    status: s.status,
    started_at: s.started_at,
    expires_at: s.started_at ? new Date(new Date(s.started_at).getTime() + (round?.duration_minutes || 60) * 60000).toISOString() : null,
    fullscreen_violations: s.fullscreen_violations,
    tab_switch_violations: s.tab_switch_violations,
    questions_answered: s.submissions?.filter((sub: any) => sub.is_final).length || 0,
    total_score: s.submissions?.filter((sub: any) => sub.is_final).reduce((sum: number, sub: any) => sum + (sub.score || 0), 0) || 0,
  }))

  return NextResponse.json(enriched)
}
