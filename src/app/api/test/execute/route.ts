import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { submitCode } from '@/lib/judge0/client'

export async function POST(request: Request) {
  const { session_token, source_code, language_id, stdin, cpu_time_limit, memory_limit } = await request.json()

  if (!session_token || !source_code || !language_id) {
    return NextResponse.json({ error: 'session_token, source_code, and language_id required' }, { status: 400 })
  }

  // Validate session token
  const serviceClient = await createServiceRoleClient()
  const { data: session } = await serviceClient
    .from('candidate_sessions')
    .select('id, status')
    .eq('session_token', session_token)
    .eq('status', 'started')
    .single()

  if (!session) {
    return NextResponse.json({ error: 'No active session' }, { status: 403 })
  }

  try {
    const token = await submitCode({
      source_code,
      language_id,
      stdin,
      cpu_time_limit: cpu_time_limit ?? 5,
      memory_limit: memory_limit ?? 128,
    })
    return NextResponse.json({ token }, { status: 202 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
