import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: submissions, error } = await supabase
    .from('submissions')
    .select(`
      *,
      questions(title, points, type),
      speed_metrics(*)
    `)
    .eq('session_id', params.id)
    .order('submitted_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(submissions)
}
