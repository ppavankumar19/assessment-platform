import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { event_type, event_data } = await request.json()
  const serviceClient = await createServiceRoleClient()

  // Log audit event
  await serviceClient.from('audit_logs').insert({
    user_id: user.id,
    session_id: params.id,
    event_type,
    event_data: event_data || {},
    ip_address: request.headers.get('x-forwarded-for') || 'unknown',
    user_agent: request.headers.get('user-agent') || '',
  })

  // Handle fullscreen exit violations
  if (event_type === 'fullscreen_exit') {
    const { data: session } = await serviceClient
      .from('candidate_sessions')
      .select('fullscreen_violations, status, rounds(fullscreen_violation_limit)')
      .eq('id', params.id)
      .single()

    if (!session || session.status !== 'started') {
      return new NextResponse(null, { status: 204 })
    }

    const newCount = (session.fullscreen_violations || 0) + 1
    await serviceClient
      .from('candidate_sessions')
      .update({ fullscreen_violations: newCount })
      .eq('id', params.id)

    const limit = (session.rounds as any)?.fullscreen_violation_limit || 3
    if (newCount >= limit) {
      await serviceClient
        .from('candidate_sessions')
        .update({ status: 'disqualified', completed_at: new Date().toISOString() })
        .eq('id', params.id)

      await serviceClient.from('audit_logs').insert({
        user_id: user.id,
        session_id: params.id,
        event_type: 'disqualified',
        event_data: { reason: 'fullscreen_violation_limit_exceeded', count: newCount },
      })

      return NextResponse.json({ disqualified: true }, { status: 200 })
    }
  }

  // Handle tab switch violations
  if (event_type === 'tab_switch') {
    const { data: session } = await serviceClient
      .from('candidate_sessions')
      .select('tab_switch_violations, status, rounds(tab_switch_limit)')
      .eq('id', params.id)
      .single()

    if (!session || session.status !== 'started') {
      return new NextResponse(null, { status: 204 })
    }

    const newCount = (session.tab_switch_violations || 0) + 1
    await serviceClient
      .from('candidate_sessions')
      .update({ tab_switch_violations: newCount })
      .eq('id', params.id)

    const limit = (session.rounds as any)?.tab_switch_limit || 5
    if (newCount >= limit) {
      await serviceClient
        .from('candidate_sessions')
        .update({ status: 'disqualified', completed_at: new Date().toISOString() })
        .eq('id', params.id)

      await serviceClient.from('audit_logs').insert({
        user_id: user.id,
        session_id: params.id,
        event_type: 'disqualified',
        event_data: { reason: 'tab_switch_limit_exceeded', count: newCount },
      })

      return NextResponse.json({ disqualified: true }, { status: 200 })
    }
  }

  return new NextResponse(null, { status: 204 })
}
