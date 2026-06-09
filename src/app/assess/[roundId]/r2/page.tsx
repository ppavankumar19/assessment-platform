'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import FullscreenGuard from '@/components/assess/FullscreenGuard'
import TimerBar from '@/components/assess/TimerBar'
import { LANGUAGES, getMonacoLanguage } from '@/lib/judge0/languages'
import { toast } from 'sonner'
import { Play, Send, ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle } from 'lucide-react'
import type { Question, SpeedMetricsPayload } from '@/types/database'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function Round2Page() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.roundId as string
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [code, setCode] = useState<Record<string, string>>({})
  const [language, setLanguage] = useState<Record<string, number>>({})
  const [submitted, setSubmitted] = useState<Set<string>>(new Set())
  const [runResults, setRunResults] = useState<Record<string, any[]>>({})
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [allowedLangs, setAllowedLangs] = useState<number[]>([])

  // Speed metrics
  const metricsRef = useRef<Record<string, { keystrokes: number; deletes: number; pastes: number; firstKey: number | null; startTime: number; idlePeriods: any[]; idleStart: number | null }>>({})

  useEffect(() => {
    const stored = localStorage.getItem(`session_${roundId}`)
    if (stored) {
      const { session_id, expires_at } = JSON.parse(stored)
      setSessionId(session_id)
      setExpiresAt(expires_at)
    }

    Promise.all([
      fetch(`/api/rounds/${roundId}/questions`).then(r => r.json()),
      fetch('/api/rounds').then(r => r.json()),
    ]).then(([qs, rounds]) => {
      setQuestions(qs)
      const round = rounds.find((r: any) => r.id === roundId)
      const langs = round?.allowed_languages || [71, 63, 50, 54, 62, 60]
      setAllowedLangs(langs)
      // Initialize code with starter code
      const initialCode: Record<string, string> = {}
      const initialLang: Record<string, number> = {}
      qs.forEach((q: Question) => {
        initialCode[q.id] = q.starter_code || ''
        initialLang[q.id] = langs[0] || 71
      })
      setCode(initialCode)
      setLanguage(initialLang)
      setLoading(false)
    })
  }, [roundId])

  const initMetrics = (qid: string) => {
    if (!metricsRef.current[qid]) {
      metricsRef.current[qid] = { keystrokes: 0, deletes: 0, pastes: 0, firstKey: null, startTime: Date.now(), idlePeriods: [], idleStart: null }
    }
  }

  const handleCodeChange = (qid: string, value: string | undefined) => {
    if (value === undefined) return
    initMetrics(qid)
    const m = metricsRef.current[qid]
    if (!m.firstKey) m.firstKey = Date.now()
    m.keystrokes++
    if (m.idleStart) { m.idlePeriods.push({ start_ms: m.idleStart - m.startTime, end_ms: Date.now() - m.startTime }); m.idleStart = null }
    setCode(prev => ({ ...prev, [qid]: value }))
  }

  const buildMetrics = (qid: string): SpeedMetricsPayload => {
    const m = metricsRef.current[qid] || { keystrokes: 0, deletes: 0, pastes: 0, firstKey: null, startTime: Date.now(), idlePeriods: [] }
    const idle = m.idlePeriods.reduce((s: number, p: any) => s + (p.end_ms - p.start_ms), 0)
    const active = Date.now() - m.startTime - idle
    return {
      total_keystrokes: m.keystrokes, paste_count: m.pastes, delete_count: m.deletes,
      time_to_first_key_ms: m.firstKey ? m.firstKey - m.startTime : null,
      total_active_time_ms: Math.max(active, 0), idle_periods: m.idlePeriods,
      chars_per_minute: active > 0 ? Math.round((m.keystrokes / (active / 60000)) * 10) / 10 : 0,
    }
  }

  const handleRun = async () => {
    const q = questions[currentIdx]
    if (!q || !code[q.id]) return
    setRunning(true)
    setRunResults(prev => ({ ...prev, [q.id]: [] }))

    try {
      const visibleCases = q.test_cases?.filter(tc => !tc.is_hidden) || []
      const results: any[] = []

      for (const tc of visibleCases) {
        const submitRes = await fetch('/api/execute', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_code: code[q.id], language_id: language[q.id], stdin: tc.input, cpu_time_limit: q.time_limit_s, memory_limit: q.memory_limit_mb }),
        })
        if (!submitRes.ok) { results.push({ case_id: tc.id, error: 'Submit failed' }); continue }
        const { token } = await submitRes.json()

        // Poll for result
        let result = null
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 1000))
          const pollRes = await fetch(`/api/execute/${token}`)
          if (pollRes.ok) {
            const data = await pollRes.json()
            if (data.status?.id >= 3) { result = data; break }
          }
        }

        if (result) {
          const passed = result.status?.id === 3 && (result.stdout?.trim().toLowerCase() === tc.expected_output.trim().toLowerCase())
          results.push({ case_id: tc.id, passed, stdout: result.stdout, stderr: result.stderr, time: result.time, memory: result.memory, status: result.status?.description, expected: tc.expected_output })
        } else {
          results.push({ case_id: tc.id, error: 'Timeout' })
        }
      }

      setRunResults(prev => ({ ...prev, [q.id]: results }))
    } catch (e: any) {
      toast.error('Run failed: ' + e.message)
    }
    setRunning(false)
  }

  const handleSubmit = async () => {
    const q = questions[currentIdx]
    if (!q || submitted.has(q.id)) return
    setSubmitting(true)

    const res = await fetch('/api/submissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId, question_id: q.id, code: code[q.id],
        language_id: language[q.id], is_final: true, speed_metrics: buildMetrics(q.id),
      }),
    })

    if (res.ok) {
      setSubmitted(prev => new Set([...prev, q.id]))
      toast.success('Solution submitted!')
      if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1)
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
    for (const q of questions) {
      if (!submitted.has(q.id) && code[q.id]) {
        await fetch('/api/submissions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, question_id: q.id, code: code[q.id], language_id: language[q.id], is_final: true, speed_metrics: buildMetrics(q.id) }),
        }).catch(() => {})
      }
    }
    await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' }).catch(() => {})
    document.exitFullscreen().catch(() => {})
    router.push(`/assess/${roundId}/complete`)
  }, [questions, code, language, submitted, sessionId, roundId, router])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400" /></div>

  const currentQ = questions[currentIdx]
  if (!currentQ) return null
  const allSubmitted = questions.every(q => submitted.has(q.id))
  const results = runResults[currentQ.id] || []
  const filteredLangs = LANGUAGES.filter(l => allowedLangs.includes(l.id))

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

      {/* Main split view */}
      <div className="flex-1 flex min-h-0">
        {/* Left: problem description */}
        <div className="w-2/5 border-r border-slate-700 overflow-y-auto p-6">
          <h2 className="text-xl font-bold mb-2">{currentQ.title}</h2>
          {currentQ.description && <p className="text-slate-300 mb-4 whitespace-pre-wrap">{currentQ.description}</p>}

          {currentQ.test_cases && currentQ.test_cases.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-400 mb-2">Test Cases (visible):</h3>
              <div className="space-y-2">
                {currentQ.test_cases.map((tc, i) => (
                  <div key={tc.id} className="bg-slate-800 rounded-lg p-3 text-sm">
                    <div className="mb-1"><span className="text-slate-500">Input:</span></div>
                    <pre className="text-slate-300 font-mono text-xs mb-2">{tc.input}</pre>
                    <div className="mb-1"><span className="text-slate-500">Expected:</span></div>
                    <pre className="text-slate-300 font-mono text-xs">{tc.expected_output}</pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question nav dots */}
          <div className="flex gap-2 mt-8">
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

        {/* Right: editor + output */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Language selector + actions */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
            <Select value={String(language[currentQ.id])} onValueChange={v => setLanguage(prev => ({ ...prev, [currentQ.id]: parseInt(v) }))}>
              <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {filteredLangs.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRun} disabled={running || submitted.has(currentQ.id) || !code[currentQ.id]}
                className="border-slate-600 text-slate-300 hover:bg-slate-700">
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                Run
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={submitted.has(currentQ.id) || !code[currentQ.id] || submitting}
                    className="bg-green-600 hover:bg-green-700">
                    <Send className="h-4 w-4 mr-1" />Submit
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit Solution</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">This is your final submission. Your code will be tested against all test cases (including hidden ones). This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-slate-600 text-slate-300 hover:bg-slate-700">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">Submit</AlertDialogAction>
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
              onChange={v => handleCodeChange(currentQ.id, v)}
              options={{
                fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false,
                wordWrap: 'on', readOnly: submitted.has(currentQ.id),
                contextmenu: false, lineNumbers: 'on', padding: { top: 12 },
              }}
            />
          </div>

          {/* Output panel */}
          <div className="h-48 border-t border-slate-700 bg-slate-950 overflow-y-auto p-4">
            <h3 className="text-sm font-semibold text-slate-400 mb-2">Output</h3>
            {results.length === 0 ? (
              <p className="text-slate-600 text-sm">Click Run to test your code against visible test cases.</p>
            ) : (
              <div className="space-y-1">
                {results.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {r.error ? (
                      <span className="text-red-400"><XCircle className="h-4 w-4 inline mr-1" />{r.case_id}: {r.error}</span>
                    ) : r.passed ? (
                      <span className="text-green-400"><CheckCircle className="h-4 w-4 inline mr-1" />{r.case_id}: Pass ({r.time}s)</span>
                    ) : (
                      <div>
                        <span className="text-red-400"><XCircle className="h-4 w-4 inline mr-1" />{r.case_id}: {r.status || 'Fail'}</span>
                        {r.stdout && <pre className="text-slate-400 text-xs ml-6 mt-1">Got: {r.stdout.trim()}</pre>}
                        {r.stderr && <pre className="text-red-300 text-xs ml-6 mt-1">{r.stderr}</pre>}
                        <pre className="text-slate-500 text-xs ml-6">Expected: {r.expected}</pre>
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
        <Button variant="outline" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
          className="border-slate-600 text-slate-300 hover:bg-slate-700">
          <ChevronLeft className="h-4 w-4 mr-1" />Previous
        </Button>
        <div className="flex gap-2">
          {currentIdx < questions.length - 1 && (
            <Button variant="outline" onClick={() => setCurrentIdx(currentIdx + 1)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700">
              Next<ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {allSubmitted && <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">Finish Assessment</Button>}
        </div>
      </div>
    </div>
  )
}
