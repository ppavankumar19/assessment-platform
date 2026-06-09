import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { submitCode } from '@/lib/judge0/client'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { source_code, language_id, stdin, cpu_time_limit, memory_limit } = await request.json()
  if (!source_code || !language_id) {
    return NextResponse.json({ error: 'source_code and language_id required' }, { status: 400 })
  }

  try {
    const token = await submitCode({ source_code, language_id, stdin, cpu_time_limit: cpu_time_limit ?? 5, memory_limit: memory_limit ?? 128 })
    return NextResponse.json({ token }, { status: 202 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
