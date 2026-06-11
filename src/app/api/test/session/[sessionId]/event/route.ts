import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const body = await request.json()
    const { session_token, event_type, event_data } = body

    if (!session_token || !event_type) {
      return NextResponse.json(
        { error: 'session_token and event_type are required' },
        { status: 400 }
      )
    }

    const serviceClient = await createServiceRoleClient()

    // Validate session_token
    const { data: session, error: sessionError } = await serviceClient
      .from('candidate_sessions')
      .select('id, status, user_id, fullscreen_violations, tab_switch_violations')
      .eq('id', params.sessionId)
      .eq('session_token', session_token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session token or session not found' },
        { status: 404 }
      )
    }

    // Create audit log entry
    if (session.user_id) {
      await serviceClient.from('audit_logs').insert({
        user_id: session.user_id,
        session_id: params.sessionId,
        event_type,
        event_data: event_data || {},
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || '',
      })
    }

    if (session.status !== 'started') {
      return NextResponse.json({ disqualified: session.status === 'disqualified' })
    }

    // INSTANT auto-submit on tab switch, fullscreen exit, or window blur
    if (['tab_switch', 'fullscreen_exit', 'window_blur'].includes(event_type)) {
      const updates: Record<string, any> = {
        status: 'disqualified',
        completed_at: new Date().toISOString(),
      }

      if (event_type === 'fullscreen_exit') {
        updates.fullscreen_violations = (session.fullscreen_violations || 0) + 1
      }
      if (event_type === 'tab_switch' || event_type === 'window_blur') {
        updates.tab_switch_violations = (session.tab_switch_violations || 0) + 1
      }

      await serviceClient
        .from('candidate_sessions')
        .update(updates)
        .eq('id', params.sessionId)

      // Mark all submissions as final
      await serviceClient
        .from('submissions')
        .update({ is_final: true })
        .eq('session_id', params.sessionId)
        .eq('is_final', false)

      // Log disqualification
      if (session.user_id) {
        await serviceClient.from('audit_logs').insert({
          user_id: session.user_id,
          session_id: params.sessionId,
          event_type: 'disqualified',
          event_data: { reason: `${event_type}_auto_submit` },
        })
      }

      return NextResponse.json({ disqualified: true })
    }

    return NextResponse.json({ disqualified: false })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
