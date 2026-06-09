import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check round has questions
  const { data: questions } = await supabase.from('questions').select('id').eq('round_id', params.id)
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'Cannot publish round without questions' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('rounds')
    .update({ is_published: true, is_active: true })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
