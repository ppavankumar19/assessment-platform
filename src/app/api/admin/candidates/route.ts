import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = await createServiceRoleClient()
  const { data: profile } = await serviceClient.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all candidates with their invitation and session data
  const { data: candidates } = await serviceClient
    .from('users')
    .select('id, email, full_name')
    .eq('role', 'candidate')
    .order('created_at', { ascending: false })

  if (!candidates) return NextResponse.json([])

  const candidateIds = candidates.map(c => c.id)

  // Get invitation counts
  const { data: invitations } = await serviceClient
    .from('invitations')
    .select('email')

  // Get session data
  const { data: sessions } = await serviceClient
    .from('candidate_sessions')
    .select('user_id, status, started_at, submissions(score, is_final)')
    .in('user_id', candidateIds)

  const sessionMap = new Map<string, any[]>()
  sessions?.forEach(s => {
    if (!sessionMap.has(s.user_id)) sessionMap.set(s.user_id, [])
    sessionMap.get(s.user_id)!.push(s)
  })

  const inviteCountMap = new Map<string, number>()
  invitations?.forEach(i => {
    inviteCountMap.set(i.email, (inviteCountMap.get(i.email) || 0) + 1)
  })

  const enriched = candidates.map(c => {
    const userSessions = sessionMap.get(c.id) || []
    const completed = userSessions.filter(s => s.status === 'completed' || s.status === 'timed_out').length
    const totalScore = userSessions.reduce((sum, s) => {
      const finalSubs = (s.submissions || []).filter((sub: any) => sub.is_final)
      return sum + finalSubs.reduce((acc: number, sub: any) => acc + (sub.score || 0), 0)
    }, 0)
    const lastActive = userSessions
      .filter(s => s.started_at)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]?.started_at || null

    return {
      id: c.id,
      email: c.email,
      full_name: c.full_name,
      rounds_invited: inviteCountMap.get(c.email) || 0,
      rounds_completed: completed,
      total_score: totalScore,
      last_active: lastActive,
    }
  })

  return NextResponse.json(enriched)
}
