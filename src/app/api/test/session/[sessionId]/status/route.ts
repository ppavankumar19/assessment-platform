import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  const serviceClient = await createServiceRoleClient()
  const { data: session } = await serviceClient
    .from('candidate_sessions')
    .select('status')
    .eq('id', params.sessionId)
    .eq('session_token', token)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ status: session.status })
}
