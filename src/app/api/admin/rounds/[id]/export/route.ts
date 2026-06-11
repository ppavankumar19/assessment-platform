import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const cutoffFilter = url.searchParams.get('cutoff') === 'true'

  const { data: round } = await serviceClient.from('rounds').select('title, cutoff_score').eq('id', params.id).single()

  const { data: sessions } = await serviceClient
    .from('candidate_sessions')
    .select(`
      *,
      users(email, full_name),
      submissions(*, questions(title, type, points), speed_metrics(*))
    `)
    .eq('round_id', params.id)

  if (!sessions) return NextResponse.json({ error: 'No data' }, { status: 404 })

  // Optionally filter by cutoff score
  let filteredSessions = sessions as any[]
  if (cutoffFilter && round?.cutoff_score && round.cutoff_score > 0) {
    filteredSessions = filteredSessions.filter((session: any) => {
      const totalScore = (session.submissions || [])
        .filter((sub: any) => sub.is_final)
        .reduce((sum: number, sub: any) => sum + (sub.score || 0), 0)
      return totalScore >= round.cutoff_score
    })
  }

  const rows: string[] = [
    'candidate_email,candidate_name,college_name,roll_no,branch,question_title,question_type,status,score,max_points,cpm,wpm,paste_count,total_keystrokes,fullscreen_violations,tab_switch_violations,submitted_at,session_status'
  ]

  for (const session of filteredSessions) {
    const candidateEmail = session.candidate_email || session.users?.email || ''
    const candidateName = session.candidate_name || session.users?.full_name || ''
    const collegeName = session.college_name || ''
    const rollNo = session.roll_no || ''
    const branch = session.branch || ''

    for (const sub of session.submissions || []) {
      const metrics = sub.speed_metrics?.[0] || sub.speed_metrics || {}
      rows.push([
        candidateEmail,
        candidateName,
        collegeName,
        rollNo,
        branch,
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
