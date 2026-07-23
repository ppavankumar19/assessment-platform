import { db } from '../../lib/db.js'
import { executeAndScore } from '../../lib/executor.js'
import { computeDerivedMetrics } from '../../lib/scoring.js'

export default async function testAnswerRoutes(app) {
  // POST /api/test/answer — submit MCQ, Output Prediction, or Coding answer
  // Higher body limit to accommodate typing_replay snapshots for coding submissions
  app.post('/answer', { bodyLimit: 524_288 /* 512 KB */ }, async (request, reply) => {
    const {
      session_token,
      question_id,
      answer_type,       // 'mcq' | 'output_prediction' | 'coding'
      selected_option,   // for MCQ: 'A'|'B'|'C'|'D'
      predictions,       // for OP: [{case_id, predicted}]
      code,              // for coding: the submitted code
      language,          // for coding: 'python' | 'c'
      is_final,
      speed_metrics,     // for coding: keystroke/paste/delete counts
      typing_replay,     // for coding: {startTime, snapshots:[{t,code,trigger}]}
    } = request.body

    if (!session_token || !question_id) {
      return reply.status(400).send({ error: 'session_token and question_id are required' })
    }

    // Verify session is active
    const { data: session, error: sErr } = await db
      .from('candidate_sessions')
      .select('id, user_id, round_id, status, started_at, rounds(duration_minutes)')
      .eq('session_token', session_token)
      .eq('status', 'started')
      .single()

    if (sErr || !session) {
      return reply.status(403).send({ error: 'No active session found for this token' })
    }

    // Check not expired
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

    // Fetch question with mcq_options and test_cases
    const { data: question, error: qErr } = await db
      .from('questions')
      .select('id, question_type, points, mcq_options, test_cases(*)')
      .eq('id', question_id)
      .single()

    if (qErr || !question) {
      return reply.status(404).send({ error: 'Question not found' })
    }

    let finalScore = 0
    let finalStatus = 'wrong_answer'
    let testResults = null
    let compileError = null

    if (answer_type === 'mcq' || question.question_type === 'mcq') {
      // ── MCQ scoring ──────────────────────────────────────────────
      const options = question.mcq_options || []
      const correctOpt = options.find(o => o.is_correct)
      const isCorrect = correctOpt && selected_option === correctOpt.label
      finalScore  = isCorrect ? (question.points || 10) : 0
      finalStatus = isCorrect ? 'accepted' : 'wrong_answer'
      testResults = { type: 'mcq', selected: selected_option, correct_option: correctOpt?.label, is_correct: isCorrect }

    } else if (answer_type === 'coding' || question.question_type === 'coding') {
      // ── Coding — server-side execution against all test cases ─────────────
      if (!code || !language) {
        return reply.status(400).send({ error: 'code and language are required for coding questions' })
      }
      const cases = question.test_cases || []
      const { results: execResults, compile_error, error: execErr } = await executeAndScore(code, language, cases)
      if (execErr) {
        return reply.status(503).send({ error: execErr })
      }
      compileError = compile_error || null
      testResults = execResults
      finalScore  = testResults.reduce((s, r) => s + (r.score || 0), 0)
      const passed = testResults.filter(r => r.passed).length
      finalStatus  = passed === cases.length ? 'accepted'
                   : passed > 0             ? 'partial'
                   :                          'wrong_answer'

    } else if (answer_type === 'output_prediction' || question.question_type === 'output_prediction') {
      // ── Output Prediction scoring ─────────────────────────────────
      const cases = question.test_cases || []
      testResults = []

      for (const tc of cases) {
        const pred = (predictions || []).find(p => p.case_id === tc.id)
        const predicted  = (pred?.predicted || '').trim()
        const expected   = (tc.expected_output || '').trim()
        const matched    = predicted === expected
        const caseScore  = matched ? (tc.points || 0) : 0
        finalScore += caseScore
        testResults.push({
          case_id:        tc.id,
          predicted,
          expected,
          matched,
          score:          caseScore,
          points:         tc.points || 0,
          is_hidden:      tc.is_hidden,
        })
      }

      const passed = testResults.filter(r => r.matched).length
      finalStatus  = passed === cases.length ? 'accepted'
                   : passed > 0              ? 'partial'
                   :                           'wrong_answer'
    }

    // Store submission
    const codeStored = answer_type === 'mcq'    ? (selected_option || '')
                     : answer_type === 'coding'  ? (code || '')
                     : null

    const { data: submission, error: subErr } = await db
      .from('submissions')
      .insert({
        session_id:   session.id,
        question_id,
        user_id:      session.user_id || null,
        code:         codeStored,
        language_id:  answer_type === 'coding' ? (language === 'c' ? 50 : 71) : null,
        status:       finalStatus,
        is_final:     is_final || false,
        score:        finalScore,
        test_results: testResults,
      })
      .select()
      .single()

    if (subErr || !submission) {
      return reply.status(400).send({ error: subErr?.message || 'Failed to save answer' })
    }

    // Save typing replay + speed metrics for coding questions (powers the admin playback page)
    if (answer_type === 'coding' && (speed_metrics || typing_replay)) {
      const derived = speed_metrics ? computeDerivedMetrics(speed_metrics) : { chars_per_minute: 0, wpm_equivalent: 0 }
      await db.from('speed_metrics').insert({
        submission_id:        submission.id,
        session_id:           session.id,
        question_id,
        total_keystrokes:     speed_metrics?.total_keystrokes || 0,
        paste_count:          speed_metrics?.paste_count || 0,
        delete_count:         speed_metrics?.delete_count || 0,
        time_to_first_key_ms: speed_metrics?.time_to_first_key_ms ?? null,
        total_active_time_ms: speed_metrics?.total_active_time_ms || 0,
        idle_periods:         speed_metrics?.idle_periods || [],
        chars_per_minute:     derived.chars_per_minute,
        wpm_equivalent:       derived.wpm_equivalent,
        keystroke_sample:     typing_replay || null,
      }).catch(err => { /* non-fatal — don't fail the submission */ })
    }

    // Safe response — strip hidden expected outputs and correct MCQ answer
    let safeResults
    if (answer_type === 'mcq') {
      safeResults = { type: 'mcq', is_correct: testResults.is_correct }
    } else if (Array.isArray(testResults)) {
      safeResults = testResults.map(r => r.is_hidden
        ? { ...r, expected_output: undefined }
        : r
      )
    } else {
      safeResults = testResults
    }

    return reply.status(201).send({
      submission_id: submission.id,
      score:         finalScore,
      status:        finalStatus,
      test_results:  safeResults,
      compile_error: compileError || undefined,
    })
  })
}
