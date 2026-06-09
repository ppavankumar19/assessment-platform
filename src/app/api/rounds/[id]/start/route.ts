import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { invitation_token } = await request.json()
  const serviceClient = await createServiceRoleClient()

  // Validate round is active
  const { data: round } = await serviceClient
    .from('rounds')
    .select('*')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (!round) return NextResponse.json({ error: 'Round not active' }, { status: 400 })

  // Validate invitation
  const { data: profile } = await serviceClient.from('users').select('email').eq('id', user.id).single()
  const { data: invitation } = await serviceClient
    .from('invitations')
    .select('*')
    .eq('round_id', params.id)
    .eq('email', profile?.email)
    .eq('status', 'pending')
    .single()

  if (!invitation) return NextResponse.json({ error: 'No valid invitation' }, { status: 403 })

  // Check no existing session
  const { data: existing } = await serviceClient
    .from('candidate_sessions')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('round_id', params.id)
    .single()

  if (existing && existing.status !== 'invited') {
    return NextResponse.json({ error: 'Session already started' }, { status: 409 })
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + round.duration_minutes * 60000)

  // Create or update session
  let session
  if (existing) {
    const { data } = await serviceClient
      .from('candidate_sessions')
      .update({ status: 'started', started_at: now.toISOString(), ip_address: request.headers.get('x-forwarded-for') || 'unknown', user_agent: request.headers.get('user-agent') || '' })
      .eq('id', existing.id)
      .select()
      .single()
    session = data
  } else {
    const { data } = await serviceClient
      .from('candidate_sessions')
      .insert({
        user_id: user.id,
        round_id: params.id,
        status: 'started',
        started_at: now.toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
      })
      .select()
      .single()
    session = data
  }

  // Mark invitation as accepted
  await serviceClient.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)

  // Create audit log
  await serviceClient.from('audit_logs').insert({
    user_id: user.id,
    session_id: session?.id,
    event_type: 'session_start',
    event_data: { round_id: params.id },
  })

  // Get question count
  const { count } = await serviceClient
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('round_id', params.id)

  return NextResponse.json({
    session_id: session?.id,
    expires_at: expiresAt.toISOString(),
    question_count: count || 0,
  }, { status: 201 })
}
