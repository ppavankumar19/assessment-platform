'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import FullscreenGuard from '@/components/assess/FullscreenGuard'
import TimerBar from '@/components/assess/TimerBar'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Send } from 'lucide-react'
import type { Question, SpeedMetricsPayload } from '@/types/database'

export default function Round1Page() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.roundId as string
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [sessionId, setSessionId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Speed metrics tracking
  const metricsRef = useRef<Record<string, { keystrokes: number; deletes: number; pastes: number; firstKey: number | null; startTime: number; idlePeriods: any[]; idleStart: number | null; lastActivity: number }>>({})
  useEffect(() => {
    const stored = localStorage.getItem(`session_${roundId}`)
    if (stored) {
      const { session_id, expires_at } = JSON.parse(stored)
      setSessionId(session_id)
      setExpiresAt(expires_at)
    }
    fetch(`/api/rounds/${roundId}/questions`).then(r => r.json()).then(qs => { setQuestions(qs); setLoading(false) })
  }, [roundId])

  const initMetrics = useCallback((questionId: string) => {
    if (!metricsRef.current[questionId]) {
      metricsRef.current[questionId] = {
        keystrokes: 0, deletes: 0, pastes: 0, firstKey: null,
        startTime: Date.now(), idlePeriods: [], idleStart: null, lastActivity: Date.now(),
      }
    }
  }, [])

  const handleAnswerChange = (questionId: string, value: string) => {
    initMetrics(questionId)
    const m = metricsRef.current[questionId]
    if (!m.firstKey) m.firstKey = Date.now()
    m.keystrokes++
    m.lastActivity = Date.now()
    if (m.idleStart) {
      m.idlePeriods.push({ start_ms: m.idleStart - m.startTime, end_ms: Date.now() - m.startTime })
      m.idleStart = null
    }
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handlePaste = (questionId: string) => {
    initMetrics(questionId)
    metricsRef.current[questionId].pastes++
    fetch(`/api/sessions/${sessionId}/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'paste_detected', event_data: { question_id: questionId } }),
    }).catch(() => {})
  }

  const buildMetrics = (questionId: string): SpeedMetricsPayload => {
    const m = metricsRef.current[questionId] || { keystrokes: 0, deletes: 0, pastes: 0, firstKey: null, startTime: Date.now(), idlePeriods: [], idleStart: null }
    const activeTime = Date.now() - m.startTime - m.idlePeriods.reduce((s, p) => s + (p.end_ms - p.start_ms), 0)
    const cpm = activeTime > 0 ? (m.keystrokes / (activeTime / 60000)) : 0
    return {
      total_keystrokes: m.keystrokes, paste_count: m.pastes, delete_count: m.deletes,
      time_to_first_key_ms: m.firstKey ? m.firstKey - m.startTime : null,
      total_active_time_ms: Math.max(activeTime, 0), idle_periods: m.idlePeriods,
      chars_per_minute: Math.round(cpm * 10) / 10,
    }
  }

  const handleSubmit = async (questionId: string) => {
    if (submitted.has(questionId) || !answers[questionId]) return
    setSubmitting(true)
    const res = await fetch('/api/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId, question_id: questionId,
        predicted_out: answers[questionId], is_final: true,
        speed_metrics: buildMetrics(questionId),
      }),
    })
    if (res.ok) {
      setSubmitted(prev => new Set([...prev, questionId]))
      toast.success('Answer submitted')
      if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1)
      else handleComplete()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Submit failed')
    }
    setSubmitting(false)
  }

  const handleComplete = async () => {
    await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' })
    document.exitFullscreen().catch(() => {})
    router.push(`/assess/${roundId}/complete`)
  }

  const handleExpire = useCallback(async () => {
    // Auto-submit remaining
    for (const q of questions) {
      if (!submitted.has(q.id) && answers[q.id]) {
        await fetch('/api/submissions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, question_id: q.id, predicted_out: answers[q.id], is_final: true, speed_metrics: buildMetrics(q.id) }),
        }).catch(() => {})
      }
    }
    await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' }).catch(() => {})
    document.exitFullscreen().catch(() => {})
    router.push(`/assess/${roundId}/complete`)
  }, [questions, answers, submitted, sessionId, roundId, router])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div>

  const currentQ = questions[currentIdx]
  if (!currentQ) return null
  const allSubmitted = questions.every(q => submitted.has(q.id))

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col" onContextMenu={e => e.preventDefault()}>
      <FullscreenGuard sessionId={sessionId} />

      {/* Top bar */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between px-6 py-2">
          <span className="text-sm font-medium">Question {currentIdx + 1} of {questions.length}</span>
          <Badge variant="secondary" className="bg-slate-700 text-white">{currentQ.points} pts</Badge>
        </div>
        {expiresAt && <TimerBar expiresAt={expiresAt} onExpire={handleExpire} />}
        <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-1 rounded-none bg-slate-700" />
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        <h2 className="text-xl font-bold mb-2">{currentQ.title}</h2>
        {currentQ.description && <p className="text-slate-300 mb-4">{currentQ.description}</p>}
        <p className="text-slate-400 mb-4">What is the output of the following C program?</p>

        {/* Code snippet */}
        <pre className="bg-slate-950 border border-slate-700 rounded-lg p-6 text-green-400 text-sm font-mono overflow-x-auto mb-6 leading-relaxed">
          {currentQ.code_snippet}
        </pre>

        {/* Answer input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Your predicted output:</label>
          <Textarea
            value={answers[currentQ.id] || ''}
            onChange={e => handleAnswerChange(currentQ.id, e.target.value)}
            onPaste={() => handlePaste(currentQ.id)}
            disabled={submitted.has(currentQ.id)}
            placeholder="Enter the exact output..."
            className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 font-mono min-h-[100px]"
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
            className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <ChevronLeft className="h-4 w-4 mr-1" />Previous
          </Button>

          <div className="flex gap-2">
            {!submitted.has(currentQ.id) && (
              <Button onClick={() => handleSubmit(currentQ.id)} disabled={!answers[currentQ.id] || submitting}
                className="bg-indigo-600 hover:bg-indigo-700">
                <Send className="h-4 w-4 mr-2" />{submitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            )}
            {submitted.has(currentQ.id) && currentIdx < questions.length - 1 && (
              <Button onClick={() => setCurrentIdx(currentIdx + 1)} className="bg-indigo-600 hover:bg-indigo-700">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {allSubmitted && (
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                Finish Assessment
              </Button>
            )}
          </div>
        </div>

        {/* Question nav dots */}
        <div className="flex justify-center gap-2 mt-8">
          {questions.map((q, i) => (
            <button key={q.id} onClick={() => setCurrentIdx(i)}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                i === currentIdx ? 'bg-indigo-600 text-white' :
                submitted.has(q.id) ? 'bg-green-600 text-white' :
                'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
