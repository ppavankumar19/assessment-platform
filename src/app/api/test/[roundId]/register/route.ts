import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: { roundId: string } }
) {
  try {
    const body = await request.json()
    const { candidate_name, candidate_email, college_name, roll_no, branch } = body

    // Validate all required fields
    if (!candidate_name || !candidate_email || !college_name || !roll_no || !branch) {
      return NextResponse.json(
        { error: 'All fields are required: candidate_name, candidate_email, college_name, roll_no, branch' },
        { status: 400 }
      )
    }

    const serviceClient = await createServiceRoleClient()

    // Check that the round exists, is published, and is active
    const { data: round, error: roundError } = await serviceClient
      .from('rounds')
      .select('id, title, type, duration_minutes')
      .eq('id', params.roundId)
      .eq('is_published', true)
      .eq('is_active', true)
      .single()

    if (roundError || !round) {
      return NextResponse.json(
        { error: 'Round not found or not currently active' },
        { status: 404 }
      )
    }

    // Check for duplicate session (same email + round)
    const { data: existingSession } = await serviceClient
      .from('candidate_sessions')
      .select('id')
      .eq('round_id', params.roundId)
      .eq('candidate_email', candidate_email)
      .single()

    if (existingSession) {
      return NextResponse.json(
        { error: 'A session already exists for this email in this round' },
        { status: 409 }
      )
    }

    // Find or create a user record for the candidate
    let userId: string

    const { data: existingUser } = await serviceClient
      .from('users')
      .select('id')
      .eq('email', candidate_email)
      .single()

    if (existingUser) {
      userId = existingUser.id
    } else {
      const { data: newUser, error: userError } = await serviceClient
        .from('users')
        .insert({
          email: candidate_email,
          full_name: candidate_name,
          role: 'candidate',
        })
        .select('id')
        .single()

      if (userError || !newUser) {
        return NextResponse.json(
          { error: 'Failed to create user record' },
          { status: 500 }
        )
      }
      userId = newUser.id
    }

    // Generate session token
    const session_token = crypto.randomUUID()

    // Create candidate_sessions record
    const { data: session, error: sessionError } = await serviceClient
      .from('candidate_sessions')
      .insert({
        round_id: params.roundId,
        user_id: userId,
        candidate_name,
        candidate_email,
        college_name,
        roll_no,
        branch,
        session_token,
        status: 'invited',
      })
      .select('id')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: sessionError?.message || 'Failed to create session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      session_token,
      round_title: round.title,
      round_type: round.type,
      duration_minutes: round.duration_minutes,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
