import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('email').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get rounds where candidate has invitation
  const { data: invitations } = await serviceClient
    .from('invitations')
    .select('round_id, token, status')
    .eq('email', profile.email)
    .in('status', ['pending', 'accepted'])

  if (!invitations || invitations.length === 0) {
    return NextResponse.json([])
  }

  const roundIds = invitations.map(i => i.round_id)
  const { data: rounds } = await serviceClient
    .from('rounds')
    .select('id, title, description, type, duration_minutes, is_active, allowed_languages')
    .in('id', roundIds)
    .eq('is_published', true)

  // Also get existing sessions
  const { data: sessions } = await serviceClient
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
