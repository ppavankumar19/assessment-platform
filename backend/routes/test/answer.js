import { db } from '../../lib/db.js'

export default async function testAnswerRoutes(app) {
  // POST /api/test/answer — submit MCQ or Output Prediction answer (server-side scoring)
  app.post('/answer', async (request, reply) => {
    const {
      session_token,
      question_id,
      answer_type,       // 'mcq' | 'output_prediction'
      selected_option,   // for MCQ: 'A'|'B'|'C'|'D'
      predictions,       // for OP: [{case_id, predicted}]
      is_final,
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

    if (answer_type === 'mcq' || question.question_type === 'mcq') {
      // ── MCQ scoring ──────────────────────────────────────────────
      const options = question.mcq_options || []
      const correctOpt = options.find(o => o.is_correct)
      const isCorrect = correctOpt && selected_option === correctOpt.label
      finalScore  = isCorrect ? (question.points || 10) : 0
      finalStatus = isCorrect ? 'accepted' : 'wrong_answer'
      testResults = { type: 'mcq', selected: selected_option, correct_option: correctOpt?.label, is_correct: isCorrect }

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

    // Store submission (use code field to store selected option for MCQ)
    const codeStored = answer_type === 'mcq' ? (selected_option || '') : null

    const { data: submission, error: subErr } = await db
      .from('submissions')
      .insert({
        session_id:   session.id,
        question_id,
        user_id:      session.user_id || null,
        code:         codeStored,
        language_id:  null,
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

    // For MCQ: don't expose correct answer in response
    const safeResults = answer_type === 'mcq'
      ? { type: 'mcq', is_correct: testResults.is_correct }
      : testResults

    return reply.status(201).send({
      submission_id: submission.id,
      score:         finalScore,
      status:        finalStatus,
      test_results:  safeResults,
    })
  })
}
