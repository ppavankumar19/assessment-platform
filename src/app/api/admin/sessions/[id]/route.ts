import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

// DELETE a candidate's session and all related data
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = await createServiceRoleClient()
  const sessionId = params.id

  // Verify session exists
  const { data: session } = await serviceClient
    .from('candidate_sessions')
    .select('id, user_id, round_id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Delete in order: speed_metrics -> submissions -> audit_logs -> candidate_session
  await serviceClient.from('speed_metrics').delete().eq('session_id', sessionId)
  await serviceClient.from('submissions').delete().eq('session_id', sessionId)
  await serviceClient.from('audit_logs').delete().eq('session_id', sessionId)
  const { error } = await serviceClient.from('candidate_sessions').delete().eq('id', sessionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return new NextResponse(null, { status: 204 })
}
