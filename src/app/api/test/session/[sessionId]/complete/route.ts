import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
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

    // Validate session_token matches this session
    const { data: session, error: sessionError } = await serviceClient
      .from('candidate_sessions')
      .select('id, status, user_id')
      .eq('id', params.sessionId)
      .eq('session_token', session_token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session token or session not found' },
        { status: 404 }
      )
    }

    if (session.status === 'completed' || session.status === 'disqualified') {
      return NextResponse.json(
        { error: `Session already ${session.status}` },
        { status: 409 }
      )
    }

    // Mark all pending submissions as is_final=true
    await serviceClient
      .from('submissions')
      .update({ is_final: true })
      .eq('session_id', params.sessionId)
      .eq('is_final', false)

    // Update session status to completed
    const { error: updateError } = await serviceClient
      .from('candidate_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', params.sessionId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Create audit log entry
    if (session.user_id) {
      await serviceClient.from('audit_logs').insert({
        user_id: session.user_id,
        session_id: params.sessionId,
        event_type: 'session_end',
        event_data: { reason: 'completed' },
      })
    }

    return NextResponse.json({ status: 'completed' })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
