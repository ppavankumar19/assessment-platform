import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('email').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get rounds where candidate has invitation
  const { data: invitations } = await supabase
    .from('invitations')
    .select('round_id, token, status')
    .eq('email', profile.email)
    .in('status', ['pending', 'accepted'])

  if (!invitations || invitations.length === 0) {
    return NextResponse.json([])
  }

  const roundIds = invitations.map(i => i.round_id)
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, title, description, type, duration_minutes, is_active')
    .in('id', roundIds)
    .eq('is_published', true)

  // Also get existing sessions
  const { data: sessions } = await supabase
    .from('candidate_sessions')
    .select('round_id, status')
    .eq('user_id', user.id)

  const sessionMap = new Map(sessions?.map(s => [s.round_id, s.status]))
  const inviteMap = new Map(invitations.map(i => [i.round_id, i]))

  const enriched = rounds?.map(r => ({
    ...r,
    session_status: sessionMap.get(r.id) || null,
    invitation_token: inviteMap.get(r.id)?.token || null,
  }))

  return NextResponse.json(enriched)
}
