import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()

  await serviceClient.from('submissions').update({ is_final: true }).eq('session_id', params.id).eq('is_final', false)

  const { data, error } = await serviceClient
    .from('candidate_sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await serviceClient.from('audit_logs').insert({
    user_id: user.id, session_id: params.id,
    event_type: 'session_end', event_data: { reason: 'completed' },
  })

  return NextResponse.json({ status: 'completed', completed_at: data?.completed_at })
}
