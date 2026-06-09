import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function getAdminUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rounds, error } = await supabase
    .from('rounds')
    .select('*, questions(count), candidate_sessions(count)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(rounds)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('rounds')
    .insert({
      title: body.title,
      description: body.description || null,
      type: body.type,
      duration_minutes: body.duration_minutes,
      allowed_languages: body.allowed_languages || null,
      pass_score: body.pass_score || 0,
      fullscreen_violation_limit: body.fullscreen_violation_limit ?? 3,
      tab_switch_limit: body.tab_switch_limit ?? 5,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      created_by: admin.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
