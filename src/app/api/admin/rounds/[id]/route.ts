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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = await createServiceRoleClient()
  const { data, error } = await serviceClient
    .from('rounds')
    .select('*, questions(*)')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const serviceClient = await createServiceRoleClient()

  const { data: round } = await serviceClient.from('rounds').select('is_active').eq('id', params.id).single()

  // Allow cutoff_score updates even on active rounds
  const isCutoffOnly = Object.keys(body).length === 1 && 'cutoff_score' in body
  if (round?.is_active && !isCutoffOnly) {
    return NextResponse.json({ error: 'Cannot edit active round' }, { status: 409 })
  }

  const { data, error } = await serviceClient
    .from('rounds')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceClient = await createServiceRoleClient()
  const { data: sessions } = await serviceClient
    .from('candidate_sessions')
    .select('id')
    .eq('round_id', params.id)
    .limit(1)

  if (sessions && sessions.length > 0) {
    return NextResponse.json({ error: 'Cannot delete round with existing sessions' }, { status: 409 })
  }

  // Delete questions first, then round
  await serviceClient.from('questions').delete().eq('round_id', params.id)
  const { error } = await serviceClient.from('rounds').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return new NextResponse(null, { status: 204 })
}
