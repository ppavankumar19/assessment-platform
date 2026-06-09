import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'csv'

  const { data: round } = await supabase.from('rounds').select('title').eq('id', params.id).single()

  const { data: sessions } = await supabase
    .from('candidate_sessions')
    .select(`
      *,
      users(email, full_name),
      submissions(*, questions(title, type, points), speed_metrics(*))
    `)
    .eq('round_id', params.id)

  if (!sessions) return NextResponse.json({ error: 'No data' }, { status: 404 })

  // CSV export
  const rows: string[] = [
    'candidate_email,candidate_name,question_title,question_type,status,score,max_points,cpm,wpm,paste_count,total_keystrokes,fullscreen_violations,tab_switch_violations,submitted_at,session_status'
  ]

  for (const session of sessions as any[]) {
    for (const sub of session.submissions || []) {
      const metrics = sub.speed_metrics?.[0] || sub.speed_metrics || {}
      rows.push([
        session.users?.email || '',
        session.users?.full_name || '',
        sub.questions?.title || '',
        sub.questions?.type || '',
        sub.status,
        sub.score,
        sub.questions?.points || 0,
        metrics.chars_per_minute || 0,
        metrics.wpm_equivalent || 0,
        metrics.paste_count || 0,
        metrics.total_keystrokes || 0,
        session.fullscreen_violations,
        session.tab_switch_violations,
        sub.submitted_at,
        session.status,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    }
  }

  const csv = rows.join('\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="round-${round?.title || params.id}-results.csv"`,
    },
  })
}
