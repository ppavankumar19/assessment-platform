import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { generateInvitationToken } from '@/lib/auth/invitationToken'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { round_id, emails } = await request.json()

  if (!round_id || !emails || !Array.isArray(emails)) {
    return NextResponse.json({ error: 'round_id and emails[] required' }, { status: 400 })
  }

  const serviceClient = await createServiceRoleClient()
  let created = 0, skipped = 0
  const errors: string[] = []

  for (const email of emails) {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.push(`Invalid email: ${email}`)
      continue
    }

    const token = generateInvitationToken(round_id, cleanEmail)
    const { error } = await serviceClient
      .from('invitations')
      .insert({
        round_id,
        email: cleanEmail,
        token,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_by: user.id,
      })

    if (error) {
      if (error.code === '23505') { skipped++ }
      else { errors.push(`${cleanEmail}: ${error.message}`) }
    } else {
      created++
      // Send magic link invite via Supabase Auth
      await serviceClient.auth.admin.inviteUserByEmail(cleanEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=/assess`,
        data: { invitation_token: token, round_id },
      })
    }
  }

  return NextResponse.json({ created, skipped, errors }, { status: 201 })
}
