import { db } from '../../lib/db.js'
import { computeDerivedMetrics } from '../../lib/scoring.js'

export default async function testSubmitRoutes(app) {
  // POST /api/test/submit — save submission with pre-computed Pyodide results
  app.post('/submit', async (request, reply) => {
    const {
      session_token,
      question_id,
      code,
      test_results,   // pre-computed by client (Pyodide or server-side C)
      is_final,
      language_id,    // 71=Python3, 50=C
      speed_metrics,
      typing_replay,  // keystroke snapshot data
    } = request.body

    if (!session_token || !question_id) {
      return reply.status(400).send({ error: 'session_token and question_id are required' })
    }

    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, user_id, round_id, status, started_at, rounds(duration_minutes)')
      .eq('session_token', session_token)
      .eq('status', 'started')
      .single()

    if (sErr || !session) {
      return reply.status(403).send({ error: 'No active session found for this token' })
    }

    // Check time not expired
    const expiresAt = new Date(
      new Date(session.started_at).getTime() +
      session.rounds.duration_minutes * 60000
    )
    if (new Date() > expiresAt) {
      return reply.status(403).send({ error: 'Session expired' })
    }

    // Prevent duplicate final submission
    if (is_final) {
      const { data: existing } = await db
        .from('submissions')
        .select('id')
        .eq('session_id', session.id)
        .eq('question_id', question_id)
        .eq('is_final', true)
        .single()

      if (existing) {
        return reply.status(409).send({ error: 'Final submission already exists for this question' })
      }
    }

    // Compute score from client test results
    let finalScore = 0
    let finalStatus = 'pending'

    if (Array.isArray(test_results) && test_results.length > 0) {
      finalScore = test_results.reduce((sum, r) => sum + (r.score || 0), 0)
      const allPassed  = test_results.every(r => r.passed)
      const somePassed = test_results.some(r => r.passed)
      finalStatus = allPassed ? 'accepted' : somePassed ? 'wrong_answer' : 'wrong_answer'
    }

    const { data: submission, error: subErr } = await db
      .from('submissions')
      .insert({
        session_id:  session.id,
        question_id,
        user_id:     session.user_id || null,
        code:        code || null,
        language_id: language_id || 71, // 71=Python3, 50=C
        status:      finalScore > 0 ? finalStatus : 'pending',
        is_final:    is_final || false,
        score:       finalScore,
        test_results: test_results || null,
      })
      .select()
      .single()

    if (subErr || !submission) {
      return reply.status(400).send({ error: subErr?.message || 'Failed to create submission' })
    }

    // Save speed metrics + typing replay
    if (speed_metrics || typing_replay) {
      const derived = speed_metrics ? computeDerivedMetrics(speed_metrics) : { chars_per_minute: 0, wpm_equivalent: 0 }
      await db.from('speed_metrics').insert({
        submission_id:       submission.id,
        session_id:          session.id,
        question_id,
        total_keystrokes:    speed_metrics?.total_keystrokes || 0,
        paste_count:         speed_metrics?.paste_count || 0,
        delete_count:        speed_metrics?.delete_count || 0,
        time_to_first_key_ms: speed_metrics?.time_to_first_key_ms ?? null,
        total_active_time_ms: speed_metrics?.total_active_time_ms || 0,
        idle_periods:        speed_metrics?.idle_periods || [],
        chars_per_minute:    derived.chars_per_minute,
        wpm_equivalent:      derived.wpm_equivalent,
        keystroke_sample:    typing_replay || null,
      })
    }

    return reply.status(201).send({
      submission_id: submission.id,
      score:         finalScore,
      status:        finalStatus,
      test_results:  test_results || null,
    })
  })
}
