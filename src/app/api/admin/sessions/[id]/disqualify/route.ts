import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { reason } = await request.json()

  const { data: session } = await serviceClient
    .from('candidate_sessions')
    .update({ status: 'disqualified', completed_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('status', 'started')
    .select()
    .single()

  if (!session) return NextResponse.json({ error: 'Session not found or not active' }, { status: 404 })

  await serviceClient.from('audit_logs').insert({
    user_id: session.user_id,
    session_id: params.id,
    event_type: 'disqualified',
    event_data: { reason: reason || 'Admin action', disqualified_by: user.id },
  })

  return NextResponse.json({ status: 'disqualified' })
}
