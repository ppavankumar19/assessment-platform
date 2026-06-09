import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (token !== process.env.ADMIN_BOOTSTRAP_TOKEN) {
      return NextResponse.json({ error: 'Invalid bootstrap token' }, { status: 400 })
    }

    // Get current logged-in user
    const authClient = await createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not logged in. Please sign in first.' }, { status: 401 })
    }

    const supabase = await createServiceRoleClient()

    // Check if admin already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Bootstrap already used' }, { status: 409 })
    }

    // Ensure user profile exists (trigger may not have fired)
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      avatar_url: user.user_metadata?.avatar_url || null,
      role: 'admin',
    }, { onConflict: 'id' })

    // Update user role to admin
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'admin' })
      .eq('id', user.id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to provision admin.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Admin account provisioned', user_id: data.id })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
