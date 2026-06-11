'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { LANGUAGES, getMonacoLanguage } from '@/lib/judge0/languages'
import { formatTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import type { Question, SpeedMetricsPayload } from '@/types/database'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface SessionData {
  session_token: string
  session_id: string
  round_id: string
  round_title: string
  round_type: string
  duration_minutes: number
  expires_at: string
  candidate_name: string
}

export default function TestExamPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.roundId as string

  const [session, setSession] = useState<SessionData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  // Output prediction state
  const [answers, setAnswers] = useState<Record<string, string>>({})

  // Coding state
  const [code, setCode] = useState<Record<string, string>>({})
  const [language, setLanguage] = useState<Record<string, number>>({})
  const [runResults, setRunResults] = useState<Record<string, any[]>>({})
  const [running, setRunning] = useState(false)

  // Common state
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)

  // Timer
  const [remaining, setRemaining] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

  // Auto-submit guard
  const isSubmittingRef = useRef(false)
  const hasCompletedRef = useRef(false)
  const sessionRef = useRef<SessionData | null>(null)
  const questionsRef = useRef<Question[]>([])
  const answersRef = useRef<Record<string, string>>({})
  const codeRef = useRef<Record<string, string>>({})
  const languageRef = useRef<Record<string, number>>({})
  const submittedRef = useRef<Set<string>>(new Set())

  // Speed metrics
  const metricsRef = useRef<
    Record<
      string,
      {
        keystrokes: number
        deletes: number
        pastes: number
        firstKey: number | null
        startTime: number
        idlePeriods: any[]
        idleStart: number | null
        lastActivity: number
      }
    >
  >({})

  // Keep refs in sync
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    questionsRef.current = questions
  }, [questions])
  useEffect(() => {
    answersRef.current = answers
  }, [answers])
  useEffect(() => {
    codeRef.current = code
  }, [code])
  useEffect(() => {
    languageRef.current = language
  }, [language])
  useEffect(() => {
    submittedRef.current = submitted
  }, [submitted])

  // Initialize session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`test_session_${roundId}`)
    if (!stored) {
      router.push('/test')
      return
    }
    try {
      const data = JSON.parse(stored) as SessionData
      if (!data.session_id || !data.expires_at) {
        router.push(`/test/${roundId}`)
        return
      }
      setSession(data)
      sessionRef.current = data

      // Set up timer
      const expiryTime = new Date(data.expires_at).getTime()
      const initial = Math.max(0, expiryTime - Date.now())
      setTotalDuration(initial)
      setRemaining(initial)
    } catch {
      router.push('/test')
    }
  }, [roundId, router])

  // Fetch questions
  useEffect(() => {
    if (!session) return
    fetch(`/api/test/${roundId}/questions?token=${encodeURIComponent(session.session_token)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load questions')
        return r.json()
      })
      .then((qs: Question[]) => {
        setQuestions(qs)
        questionsRef.current = qs

        // Initialize code/language for coding questions
        if (session.round_type === 'live_coding') {
          const initialCode: Record<string, string> = {}
          const initialLang: Record<string, number> = {}
          qs.forEach((q) => {
            initialCode[q.id] = q.starter_code || ''
            initialLang[q.id] = 71 // Default to Python
          })
          setCode(initialCode)
          codeRef.current = initialCode
          setLanguage(initialLang)
          languageRef.current = initialLang
        }

        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load questions')
        setLoading(false)
      })
  }, [session, roundId])

  // Timer countdown
  useEffect(() => {
    if (!session) return

    const expiryTime = new Date(session.expires_at).getTime()

    const interval = setInterval(() => {
      const r = expiryTime - Date.now()
      if (r <= 0) {
        clearInterval(interval)
        setRemaining(0)
        handleAutoSubmit('timer_expired')
      } else {
        setRemaining(r)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [session])

  // Poll session status (catches admin disqualification)
  useEffect(() => {
    if (!session) return

    const checkStatus = async () => {
      if (hasCompletedRef.current) return
      try {
        const res = await fetch(
          `/api/test/session/${session.session_id}/status?token=${encodeURIComponent(session.session_token)}`
        )
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'disqualified' || data.status === 'completed') {
            if (!hasCompletedRef.current) {
              hasCompletedRef.current = true
              document.exitFullscreen().catch(() => {})
              router.push(`/test/${roundId}/complete`)
            }
          }
        }
      } catch {}
    }

    const interval = setInterval(checkStatus, 10000)
    return () => clearInterval(interval)
  }, [session, roundId, router])

  // Build speed metrics for a question
  const buildMetrics = useCallback((questionId: string): SpeedMetricsPayload => {
    const m = metricsRef.current[questionId] || {
      keystrokes: 0,
      deletes: 0,
      pastes: 0,
      firstKey: null,
      startTime: Date.now(),
      idlePeriods: [],
      idleStart: null,
    }
    const idle = m.idlePeriods.reduce(
      (s: number, p: any) => s + (p.end_ms - p.start_ms),
      0
    )
    const active = Date.now() - m.startTime - idle
    return {
      total_keystrokes: m.keystrokes,
      paste_count: m.pastes,
      delete_count: m.deletes,
      time_to_first_key_ms: m.firstKey ? m.firstKey - m.startTime : null,
      total_active_time_ms: Math.max(active, 0),
      idle_periods: m.idlePeriods,
      chars_per_minute:
        active > 0 ? Math.round((m.keystrokes / (active / 60000)) * 10) / 10 : 0,
    }
  }, [])

  // Auto-submit handler (called on violations)
  const handleAutoSubmit = useCallback(
    async (reason: string) => {
      if (isSubmittingRef.current || hasCompletedRef.current) return
      isSubmittingRef.current = true
      hasCompletedRef.current = true

      const s = sessionRef.current
      if (!s) return

      // Log the violation event
      try {
        await fetch(`/api/test/session/${s.session_id}/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: s.session_token,
            event_type: reason,
            event_data: { timestamp: Date.now() },
          }),
        })
      } catch {}

      // Submit all unanswered questions with current answers
      const qs = questionsRef.current
      const sub = submittedRef.current
      const ans = answersRef.current
      const cd = codeRef.current
      const lang = languageRef.current

      for (const q of qs) {
        if (sub.has(q.id)) continue
        const hasAnswer =
          s.round_type === 'output_prediction' ? !!ans[q.id] : !!cd[q.id]
        if (!hasAnswer) continue

        try {
          const body: any = {
            session_token: s.session_token,
            session_id: s.session_id,
            question_id: q.id,
            is_final: true,
            speed_metrics: buildMetrics(q.id),
          }
          if (s.round_type === 'output_prediction') {
            body.predicted_out = ans[q.id]
          } else {
            body.code = cd[q.id]
            body.language_id = lang[q.id]
          }
          await fetch('/api/test/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        } catch {}
      }

      // Complete the session
      try {
        await fetch(`/api/test/session/${s.session_id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: s.session_token }),
        })
      } catch {}

      // Exit fullscreen and redirect
      document.exitFullscreen().catch(() => {})
      router.push(`/test/${roundId}/complete`)
    },
    [roundId, router, buildMetrics]
  )

  // Anti-cheat: auto-submit on any violation
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        handleAutoSubmit('tab_switch')
      }
    }

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        handleAutoSubmit('fullscreen_exit')
      }
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      handleAutoSubmit('tab_close')
      e.preventDefault()
      e.returnValue = ''
    }

    const handleBlur = () => {
      handleAutoSubmit('window_blur')
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable Ctrl+U, F12
      if ((e.ctrlKey && e.key === 'u') || e.key === 'F12') {
        e.preventDefault()
      }
    }

    const handleContextMenu = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('fullscreenchange', handleFullscreen)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('fullscreenchange', handleFullscreen)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [handleAutoSubmit])

  // Metrics initialization
  const initMetrics = useCallback((questionId: string) => {
    if (!metricsRef.current[questionId]) {
      metricsRef.current[questionId] = {
        keystrokes: 0,
        deletes: 0,
        pastes: 0,
        firstKey: null,
        startTime: Date.now(),
        idlePeriods: [],
        idleStart: null,
        lastActivity: Date.now(),
      }
    }
  }, [])

  // Output prediction handlers
  const handleAnswerChange = (questionId: string, value: string) => {
    initMetrics(questionId)
    const m = metricsRef.current[questionId]
    if (!m.firstKey) m.firstKey = Date.now()
    m.keystrokes++
    m.lastActivity = Date.now()
    if (m.idleStart) {
      m.idlePeriods.push({
        start_ms: m.idleStart - m.startTime,
        end_ms: Date.now() - m.startTime,
      })
      m.idleStart = null
    }
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  // Coding handlers
  const handleCodeChange = (questionId: string, value: string | undefined) => {
    if (value === undefined) return
    initMetrics(questionId)
    const m = metricsRef.current[questionId]
    if (!m.firstKey) m.firstKey = Date.now()
    m.keystrokes++
    if (m.idleStart) {
      m.idlePeriods.push({
        start_ms: m.idleStart - m.startTime,
        end_ms: Date.now() - m.startTime,
      })
      m.idleStart = null
    }
    setCode((prev) => ({ ...prev, [questionId]: value }))
  }

  const handlePaste = (questionId: string) => {
    initMetrics(questionId)
    metricsRef.current[questionId].pastes++
  }

  // Submit a single question
  const handleSubmitQuestion = async (questionId: string) => {
    if (!session || submitted.has(questionId) || submitting) return

    const isOutput = session.round_type === 'output_prediction'
    const hasContent = isOutput ? !!answers[questionId] : !!code[questionId]
    if (!hasContent) return

    setSubmitting(true)
    try {
      const body: any = {
        session_token: session.session_token,
        session_id: session.session_id,
        question_id: questionId,
        is_final: true,
        speed_metrics: buildMetrics(questionId),
      }
      if (isOutput) {
        body.predicted_out = answers[questionId]
      } else {
        body.code = code[questionId]
        body.language_id = language[questionId]
      }

      const res = await fetch('/api/test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const result = await res.json()
        setSubmitted((prev) => new Set([...prev, questionId]))
        // Show test case results for coding questions
        if (!isOutput && result.test_results) {
          const passed = result.test_results.filter((r: any) => r.passed).length
          const total = result.test_results.length
          const visibleResults = result.test_results
            .filter((r: any) => !r.is_hidden)
            .map((r: any) => ({
              case_id: r.case_id,
              passed: r.passed,
              stdout: r.stdout,
              stderr: r.stderr,
              time: r.time_ms ? `${(r.time_ms / 1000).toFixed(3)}` : null,
              memory: r.memory_kb,
              status: r.status,
              expected: '',
            }))
          setRunResults((prev) => ({ ...prev, [questionId]: visibleResults }))
          toast.success(`Submitted: ${passed}/${total} test cases passed (Score: ${result.score})`)
        } else {
          toast.success('Answer submitted')
        }
        if (currentIdx < questions.length - 1) {
          setCurrentIdx(currentIdx + 1)
        }
      } else {
        const err = await res.json()
        toast.error(err.error || 'Submit failed')
      }
    } catch {
      toast.error('Network error during submission')
    }
    setSubmitting(false)
  }

  // Run code (coding mode only)
  const handleRun = async () => {
    if (!session) return
    const q = questions[currentIdx]
    if (!q || !code[q.id]) return
    setRunning(true)
    setRunResults((prev) => ({ ...prev, [q.id]: [] }))

    try {
      const visibleCases = q.test_cases?.filter((tc) => !tc.is_hidden) || []
      const results: any[] = []

      for (const tc of visibleCases) {
        const submitRes = await fetch('/api/test/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: session.session_token,
            source_code: code[q.id],
            language_id: language[q.id],
            stdin: tc.input,
            cpu_time_limit: q.time_limit_s,
            memory_limit: q.memory_limit_mb,
          }),
        })

        if (!submitRes.ok) {
          results.push({ case_id: tc.id, error: 'Submit failed' })
          continue
        }

        const { token } = await submitRes.json()

        // Poll for result
        let result = null
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000))
          const pollRes = await fetch(`/api/test/execute/${token}`)
          if (pollRes.ok) {
            const data = await pollRes.json()
            if (data.status?.id >= 3) {
              result = data
              break
            }
          }
        }

        if (result) {
          const passed =
            result.status?.id === 3 &&
            result.stdout?.trim().toLowerCase() ===
              tc.expected_output.trim().toLowerCase()
          results.push({
            case_id: tc.id,
            passed,
            stdout: result.stdout,
            stderr: result.stderr,
            time: result.time,
            memory: result.memory,
            status: result.status?.description,
            expected: tc.expected_output,
          })
        } else {
          results.push({ case_id: tc.id, error: 'Timeout' })
        }
      }

      setRunResults((prev) => ({ ...prev, [q.id]: results }))
    } catch (e: any) {
      toast.error('Run failed: ' + e.message)
    }
    setRunning(false)
  }

  // Complete the exam (manual finish)
  const handleFinish = async () => {
    if (!session || hasCompletedRef.current) return
    hasCompletedRef.current = true

    try {
      await fetch(`/api/test/session/${session.session_id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.session_token }),
      })
    } catch {}

    document.exitFullscreen().catch(() => {})
    router.push(`/test/${roundId}/complete`)
  }

  // Loading state
  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  const currentQ = questions[currentIdx]
  if (!currentQ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <p className="text-slate-400">No questions available.</p>
      </div>
    )
  }

  const allSubmitted = questions.every((q) => submitted.has(q.id))
  const isOutputPrediction = session.round_type === 'output_prediction'
  const timerProgress = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0
  const isWarning = remaining <= 5 * 60 * 1000
  const isCritical = remaining <= 60 * 1000

  // Coding-specific values
  const results = runResults[currentQ.id] || []

  // OUTPUT PREDICTION UI
  if (isOutputPrediction) {
    return (
      <div
        className="min-h-screen bg-slate-900 text-white flex flex-col"
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Top bar */}
        <div className="bg-slate-800 border-b border-slate-700">
          <div className="flex items-center justify-between px-6 py-2">
            <span className="text-sm font-medium">
              Question {currentIdx + 1} of {questions.length}
            </span>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-slate-700 text-white">
                {currentQ.points} pts
              </Badge>
              <span
                className={`text-sm font-mono font-semibold ${
                  isCritical
                    ? 'text-red-400'
                    : isWarning
                    ? 'text-amber-400'
                    : 'text-slate-300'
                }`}
              >
                {formatTime(remaining)}
              </span>
            </div>
          </div>
          {/* Timer progress bar */}
          <div className="h-1 bg-slate-700 w-full">
            <div
              className={`h-full transition-all duration-1000 ${
                isCritical
                  ? 'bg-red-600'
                  : isWarning
                  ? 'bg-amber-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${timerProgress}%` }}
            />
          </div>
          <Progress
            value={((currentIdx + 1) / questions.length) * 100}
            className="h-1 rounded-none bg-slate-700"
          />
        </div>

        {/* Main content */}
        <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-8 overflow-y-auto">
          <h2 className="text-xl font-bold mb-2">{currentQ.title}</h2>
          {currentQ.description && (
            <p className="text-slate-300 mb-4">{currentQ.description}</p>
          )}
          <p className="text-slate-400 mb-4">
            What is the output of the following program?
          </p>

          {/* Code snippet */}
          <pre className="bg-slate-950 border border-slate-700 rounded-lg p-6 text-green-400 text-sm font-mono overflow-x-auto mb-6 leading-relaxed">
            {currentQ.code_snippet}
          </pre>

          {/* Answer input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your predicted output:
            </label>
            <Textarea
              value={answers[currentQ.id] || ''}
              onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
              onPaste={() => handlePaste(currentQ.id)}
              disabled={submitted.has(currentQ.id)}
              placeholder="Enter the exact output..."
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 font-mono min-h-[100px]"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
              className="border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex gap-2">
              {!submitted.has(currentQ.id) && (
                <Button
                  onClick={() => handleSubmitQuestion(currentQ.id)}
                  disabled={!answers[currentQ.id] || submitting}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Submit Answer'}
                </Button>
              )}
              {submitted.has(currentQ.id) &&
                currentIdx < questions.length - 1 && (
                  <Button
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              {allSubmitted && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      Finish Assessment
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Finish Assessment?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-400">
                        Are you sure you want to finish? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleFinish}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Finish
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Question nav dots */}
          <div className="flex justify-center gap-2 mt-8">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  i === currentIdx
                    ? 'bg-indigo-600 text-white'
                    : submitted.has(q.id)
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // CODING UI (live_coding)
  return (
    <div
      className="min-h-screen bg-slate-900 text-white flex flex-col"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top bar */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between px-6 py-2">
          <span className="text-sm font-medium">
            Question {currentIdx + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-slate-700 text-white">
              {currentQ.points} pts
            </Badge>
            <span
              className={`text-sm font-mono font-semibold ${
                isCritical
                  ? 'text-red-400'
                  : isWarning
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {formatTime(remaining)}
            </span>
          </div>
        </div>
        {/* Timer progress bar */}
        <div className="h-1 bg-slate-700 w-full">
          <div
            className={`h-full transition-all duration-1000 ${
              isCritical
                ? 'bg-red-600'
                : isWarning
                ? 'bg-amber-500'
                : 'bg-indigo-600'
            }`}
            style={{ width: `${timerProgress}%` }}
          />
        </div>
        <Progress
          value={((currentIdx + 1) / questions.length) * 100}
          className="h-1 rounded-none bg-slate-700"
        />
      </div>

      {/* Main split view */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Left: problem description */}
        <div className="w-full md:w-2/5 border-b md:border-b-0 md:border-r border-slate-700 overflow-y-auto p-4 md:p-6 max-h-[40vh] md:max-h-none">
          <h2 className="text-xl font-bold mb-2">{currentQ.title}</h2>
          {currentQ.description && (
            <p className="text-slate-300 mb-4 whitespace-pre-wrap">
              {currentQ.description}
            </p>
          )}

          {currentQ.test_cases && currentQ.test_cases.length > 0 && (() => {
            const visible = currentQ.test_cases!.filter(tc => !tc.is_hidden)
            const hiddenCount = currentQ.test_cases!.length - visible.length
            return (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">
                Test Cases ({visible.length} visible{hiddenCount > 0 ? `, ${hiddenCount} hidden` : ''}):
              </h3>
              <div className="space-y-2">
                {visible.map((tc) => (
                    <div
                      key={tc.id}
                      className="bg-slate-800 rounded-lg p-3 text-sm"
                    >
                      <div className="mb-1">
                        <span className="text-slate-500">Input:</span>
                      </div>
                      <pre className="text-slate-300 font-mono text-xs mb-2">
                        {tc.input}
                      </pre>
                      <div className="mb-1">
                        <span className="text-slate-500">Expected:</span>
                      </div>
                      <pre className="text-slate-300 font-mono text-xs">
                        {tc.expected_output}
                      </pre>
                    </div>
                  ))}
              </div>
            </div>
            )
          })()}

          {/* Question nav dots */}
          <div className="flex gap-2 mt-8">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  i === currentIdx
                    ? 'bg-indigo-600 text-white'
                    : submitted.has(q.id)
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Right: editor + output */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Language selector + actions */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
            <Select
              value={String(language[currentQ.id] || 71)}
              onValueChange={(v) =>
                setLanguage((prev) => ({
                  ...prev,
                  [currentQ.id]: parseInt(v),
                }))
              }
            >
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRun}
                disabled={
                  running ||
                  submitted.has(currentQ.id) ||
                  !code[currentQ.id]
                }
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                {running ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-1" />
                )}
                Run
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={
                      submitted.has(currentQ.id) ||
                      !code[currentQ.id] ||
                      submitting
                    }
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Submit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit Solution</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      This is your final submission. Your code will be tested
                      against all test cases (including hidden ones). This cannot
                      be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleSubmitQuestion(currentQ.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Submit
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1 min-h-0">
            <MonacoEditor
              height="100%"
              language={getMonacoLanguage(language[currentQ.id] || 71)}
              theme="vs-dark"
              value={code[currentQ.id] || ''}
              onChange={(v) => handleCodeChange(currentQ.id, v)}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                readOnly: submitted.has(currentQ.id),
                contextmenu: false,
                lineNumbers: 'on',
                padding: { top: 12 },
              }}
            />
          </div>

          {/* Output panel */}
          <div className="h-48 border-t border-slate-700 bg-slate-950 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">
              Output
            </h3>
            {results.length === 0 ? (
              <p className="text-slate-600 text-sm">
                Click Run to test your code against visible test cases.
              </p>
            ) : (
              <div className="space-y-1">
                {results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {r.error ? (
                      <span className="text-red-400">
                        <XCircle className="h-4 w-4 inline mr-1" />
                        Case {i + 1}: {r.error}
                      </span>
                    ) : r.passed ? (
                      <span className="text-green-400">
                        <CheckCircle className="h-4 w-4 inline mr-1" />
                        Case {i + 1}: Pass ({r.time}s)
                      </span>
                    ) : (
                      <div>
                        <span className="text-red-400">
                          <XCircle className="h-4 w-4 inline mr-1" />
                          Case {i + 1}: {r.status || 'Fail'}
                        </span>
                        {r.stdout && (
                          <pre className="text-slate-400 text-xs ml-6 mt-1">
                            Got: {r.stdout.trim()}
                          </pre>
                        )}
                        {r.stderr && (
                          <pre className="text-red-300 text-xs ml-6 mt-1">
                            {r.stderr}
                          </pre>
                        )}
                        <pre className="text-slate-500 text-xs ml-6">
                          Expected: {r.expected}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="bg-slate-800 border-t border-slate-700 px-6 py-3 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <div className="flex gap-2">
          {currentIdx < questions.length - 1 && (
            <Button
              variant="outline"
              onClick={() => setCurrentIdx(currentIdx + 1)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {allSubmitted && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  Finish Assessment
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Finish Assessment?</AlertDialogTitle>
                  <AlertDialogDescription className="text-slate-400">
                    Are you sure you want to finish? This action cannot be
                    undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleFinish}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Finish
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  )
}
