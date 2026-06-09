import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function getAdminUser(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('rounds')
    .select('*, questions(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()

  // Check if round is active
  const { data: round } = await supabase.from('rounds').select('is_active').eq('id', params.id).single()
  if (round?.is_active) {
    return NextResponse.json({ error: 'Cannot edit active round' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('rounds')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: sessions } = await supabase
    .from('candidate_sessions')
    .select('id')
    .eq('round_id', params.id)
    .limit(1)

  if (sessions && sessions.length > 0) {
    return NextResponse.json({ error: 'Cannot delete round with existing sessions' }, { status: 409 })
  }

  const { error } = await supabase.from('rounds').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
