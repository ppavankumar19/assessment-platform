import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const serviceClient = await createServiceRoleClient()
    const { data: rounds, error } = await serviceClient
      .from('rounds')
      .select('id, title, description, type, duration_minutes, is_active')
      .eq('is_published', true)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(rounds || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
