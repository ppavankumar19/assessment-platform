import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { scoreOutputPrediction } from '@/lib/scoring/normalizeOutput'
import { evaluateTestCases } from '@/lib/scoring/scoreSubmission'
import { submitAndWait } from '@/lib/judge0/client'
import { computeDerivedMetrics } from '@/lib/metrics/speedMetrics'

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { session_id, question_id, predicted_out, code, language_id, is_final, speed_metrics } = body

  const serviceClient = await createServiceRoleClient()

  // Validate session is active
  const { data: session } = await serviceClient
    .from('candidate_sessions')
    .select('*, rounds(duration_minutes)')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .eq('status', 'started')
    .single()

  if (!session) return NextResponse.json({ error: 'No active session' }, { status: 403 })

  // Check time hasn't expired
  const expiresAt = new Date(new Date(session.started_at).getTime() + (session.rounds as any).duration_minutes * 60000)
  if (new Date() > expiresAt) {
    return NextResponse.json({ error: 'Session expired' }, { status: 403 })
  }

  // Check for existing final submission
  if (is_final) {
    const { data: existing } = await serviceClient
      .from('submissions')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .eq('is_final', true)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Final submission already exists' }, { status: 409 })
    }
  }

  // Get question
  const { data: question } = await serviceClient
    .from('questions')
    .select('*')
    .eq('id', question_id)
    .single()

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  // Create submission
  const { data: submission, error } = await serviceClient
    .from('submissions')
    .insert({
      session_id,
      question_id,
      user_id: user.id,
      code: code || null,
      language_id: language_id || null,
      predicted_out: predicted_out || null,
      status: 'pending',
      is_final: is_final || false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Save speed metrics
  if (speed_metrics && submission) {
    const derived = computeDerivedMetrics(speed_metrics)
    await serviceClient.from('speed_metrics').insert({
      submission_id: submission.id,
      session_id,
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
  if (is_final && submission) {
    if (question.type === 'output_prediction' && predicted_out) {
      // Round 1 scoring
      const result = scoreOutputPrediction(predicted_out, question.expected_output || '', question.points)
      await serviceClient
        .from('submissions')
        .update({
          score: result.score,
          status: result.correct ? 'accepted' : 'wrong_answer',
        })
        .eq('id', submission.id)
    } else if (question.type === 'coding' && code && language_id) {
      // Round 2 scoring - run against all test cases
      try {
        const testCases = question.test_cases as any[] || []
        const results = await Promise.all(
          testCases.map(tc =>
            submitAndWait({
              source_code: code,
              language_id,
              stdin: tc.input,
              cpu_time_limit: question.time_limit_s,
              memory_limit: question.memory_limit_mb,
            })
          )
        )

        const { totalScore, testResults, worstStatus } = evaluateTestCases(testCases, results)

        await serviceClient
          .from('submissions')
          .update({
            score: totalScore,
            status: totalScore === question.points ? 'accepted' : worstStatus,
            test_results: testResults,
            time_ms: Math.max(...testResults.map(r => r.time_ms)),
            memory_kb: Math.max(...testResults.map(r => r.memory_kb)),
            stdout: results[0]?.stdout || null,
            stderr: results[0]?.stderr || null,
            compile_output: results[0]?.compile_output || null,
          })
          .eq('id', submission.id)
      } catch (e: any) {
        await serviceClient
          .from('submissions')
          .update({ status: 'internal_error', stderr: e.message })
          .eq('id', submission.id)
      }
    }

    // Audit log
    await serviceClient.from('audit_logs').insert({
      user_id: user.id,
      session_id,
      event_type: 'submission',
      event_data: { question_id, is_final },
    })
  }

  return NextResponse.json({ submission_id: submission?.id, status: 'pending' }, { status: 201 })
}
