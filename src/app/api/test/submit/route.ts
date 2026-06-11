import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { scoreOutputPrediction } from '@/lib/scoring/normalizeOutput'
import { computeDerivedMetrics } from '@/lib/metrics/speedMetrics'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_token, question_id, predicted_out, code, language_id, is_final, speed_metrics } = body

    if (!session_token || !question_id) {
      return NextResponse.json(
        { error: 'session_token and question_id are required' },
        { status: 400 }
      )
    }

    const serviceClient = await createServiceRoleClient()

    // Validate session_token belongs to an active (started) session
    const { data: session, error: sessionError } = await serviceClient
      .from('candidate_sessions')
      .select('id, user_id, round_id, status, started_at, rounds(duration_minutes)')
      .eq('session_token', session_token)
      .eq('status', 'started')
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No active session found for this token' },
        { status: 403 }
      )
    }

    // Check time hasn't expired
    const expiresAt = new Date(
      new Date(session.started_at).getTime() +
      (session.rounds as any).duration_minutes * 60000
    )
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 403 }
      )
    }

    // Check for existing final submission
    if (is_final) {
      const { data: existing } = await serviceClient
        .from('submissions')
        .select('id')
        .eq('session_id', session.id)
        .eq('question_id', question_id)
        .eq('is_final', true)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Final submission already exists for this question' },
          { status: 409 }
        )
      }
    }

    // Get question
    const { data: question } = await serviceClient
      .from('questions')
      .select('*')
      .eq('id', question_id)
      .single()

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Create submission record
    const { data: submission, error: submissionError } = await serviceClient
      .from('submissions')
      .insert({
        session_id: session.id,
        question_id,
        user_id: session.user_id,
        code: code || null,
        language_id: language_id || null,
        predicted_out: predicted_out || null,
        status: 'pending',
        is_final: is_final || false,
        score: 0,
      })
      .select()
      .single()

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: submissionError?.message || 'Failed to create submission' },
        { status: 400 }
      )
    }

    // Save speed metrics if provided
    if (speed_metrics) {
      const derived = computeDerivedMetrics(speed_metrics)
      await serviceClient.from('speed_metrics').insert({
        submission_id: submission.id,
        session_id: session.id,
        question_id,
        total_keystrokes: speed_metrics.total_keystrokes || 0,
        paste_count: speed_metrics.paste_count || 0,
        delete_count: speed_metrics.delete_count || 0,
        time_to_first_key_ms: speed_metrics.time_to_first_key_ms,
        total_active_time_ms: speed_metrics.total_active_time_ms || 0,
        idle_periods: speed_metrics.idle_periods || [],
        chars_per_minute: derived.chars_per_minute,
        wpm_equivalent: derived.wpm_equivalent,
      })
    }

    // Score the submission
    let finalScore = 0
    let finalStatus = 'pending'

    if (question.type === 'output_prediction' && predicted_out) {
      const result = scoreOutputPrediction(
        predicted_out,
        question.expected_output || '',
        question.points
      )
      finalScore = result.score
      finalStatus = result.correct ? 'accepted' : 'wrong_answer'

      await serviceClient
        .from('submissions')
        .update({ score: finalScore, status: finalStatus })
        .eq('id', submission.id)
    } else if (question.type === 'coding' && code) {
      // For coding questions: store the code, set status='pending', score=0
      // Judge0 execution is handled separately
      finalStatus = 'pending'
      finalScore = 0
    }

    return NextResponse.json({
      submission_id: submission.id,
      score: finalScore,
      status: finalStatus,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
