import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { roundId: string } }
) {
  try {
    const body = await request.json()
    const { session_token } = body

    if (!session_token) {
      return NextResponse.json(
        { error: 'session_token is required' },
        { status: 400 }
      )
    }

    const serviceClient = await createServiceRoleClient()

    // Validate session_token matches a session for this round
    const { data: session, error: sessionError } = await serviceClient
      .from('candidate_sessions')
      .select('id, status, user_id, round_id')
      .eq('session_token', session_token)
      .eq('round_id', params.roundId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session token for this round' },
        { status: 404 }
      )
    }

    // Check session status is 'invited' (not already started)
    if (session.status !== 'invited') {
      return NextResponse.json(
        { error: `Session already ${session.status}` },
        { status: 409 }
      )
    }

    // Get round duration
    const { data: round } = await serviceClient
      .from('rounds')
      .select('duration_minutes')
      .eq('id', params.roundId)
      .single()

    if (!round) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + round.duration_minutes * 60000)

    // Update session: status='started', started_at, ip_address, user_agent
    const { error: updateError } = await serviceClient
      .from('candidate_sessions')
      .update({
        status: 'started',
        started_at: now.toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
      })
      .eq('id', session.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Get question count for this round
    const { count } = await serviceClient
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', params.roundId)

    return NextResponse.json({
      session_id: session.id,
      expires_at: expiresAt.toISOString(),
      question_count: count || 0,
    }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
