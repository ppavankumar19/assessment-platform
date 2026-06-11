import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { roundId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'token query parameter is required' },
        { status: 400 }
      )
    }

    const serviceClient = await createServiceRoleClient()

    // Validate the token belongs to an active session for this round
    const { data: session, error: sessionError } = await serviceClient
      .from('candidate_sessions')
      .select('id, status')
      .eq('session_token', token)
      .eq('round_id', params.roundId)
      .eq('status', 'started')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No active session found for this token' },
        { status: 403 }
      )
    }

    // Fetch questions for the round
    const { data: questions, error: questionsError } = await serviceClient
      .from('questions')
      .select('id, round_id, sequence_order, title, description, type, code_snippet, starter_code, test_cases, time_limit_s, memory_limit_mb, points')
      .eq('round_id', params.roundId)
      .order('sequence_order')

    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      )
    }

    // Filter based on question type
    const filtered = questions?.map(q => {
      if (q.type === 'output_prediction') {
        return {
          id: q.id,
          sequence_order: q.sequence_order,
          title: q.title,
          description: q.description,
          type: q.type,
          code_snippet: q.code_snippet,
          points: q.points,
        }
      }

      // coding questions: filter out hidden test cases
      return {
        id: q.id,
        sequence_order: q.sequence_order,
        title: q.title,
        description: q.description,
        type: q.type,
        starter_code: q.starter_code,
        test_cases: q.test_cases
          ? (q.test_cases as any[])
              .filter((tc: any) => !tc.is_hidden)
              .map((tc: any) => ({
                id: tc.id,
                input: tc.input,
                expected_output: tc.expected_output,
                is_hidden: tc.is_hidden,
                points: tc.points,
              }))
          : null,
        time_limit_s: q.time_limit_s,
        memory_limit_mb: q.memory_limit_mb,
        points: q.points,
      }
    })

    return NextResponse.json(filtered)
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
