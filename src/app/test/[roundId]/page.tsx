'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Code2, Clock, Shield, AlertTriangle, Monitor, Loader2, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'

interface SessionData {
  session_token: string
  session_id?: string
  round_id: string
  round_title: string
  round_type: string
  duration_minutes: number
  expires_at?: string
  candidate_name: string
}

export default function TestRoundEntryPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.roundId as string

  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(`test_session_${roundId}`)
    if (!stored) {
      router.push('/test')
      return
    }
    try {
      const data = JSON.parse(stored) as SessionData
      setSession(data)
    } catch {
      router.push('/test')
      return
    }
    setLoading(false)
  }, [roundId, router])

  const handleBegin = async () => {
    if (!session || !rulesAccepted) return
    setStarting(true)

    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      toast.error('Fullscreen is required. Please allow fullscreen access and try again.')
      setStarting(false)
      return
    }

    try {
      const res = await fetch(`/api/test/${roundId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: session.session_token }),
      })

      if (res.ok) {
        const data = await res.json()
        // Update localStorage with session_id and expires_at
        const updated = {
          ...session,
          session_id: data.session_id,
          expires_at: data.expires_at,
        }
        localStorage.setItem(`test_session_${roundId}`, JSON.stringify(updated))
        router.push(`/test/${roundId}/exam`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to start assessment')
        document.exitFullscreen().catch(() => {})
        setStarting(false)
      }
    } catch {
      toast.error('Network error. Please check your connection.')
      document.exitFullscreen().catch(() => {})
      setStarting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-8">
          {/* Header */}
          <div className="text-center mb-8">
            <Code2 className="h-10 w-10 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">{session.round_title}</h1>
            <p className="text-gray-500 mt-2">
              Welcome, <span className="font-medium text-gray-700">{session.candidate_name}</span>
            </p>
          </div>

          {/* Round info */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <span>
                Duration: <strong>{session.duration_minutes} minutes</strong>
              </span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Shield className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <span>
                Type:{' '}
                <strong>
                  {session.round_type === 'output_prediction'
                    ? 'C Output Prediction'
                    : 'Live Coding'}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Monitor className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <span>
                Mode: <strong>Fullscreen (required)</strong>
              </span>
            </div>
          </div>

          {/* Rules */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-2">Important Rules</p>
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    You <strong>must</strong> use incognito/private browsing mode.
                  </li>
                  <li>
                    No browser extensions are allowed.
                  </li>
                  <li>
                    <strong>Tab switching</strong>, closing, or minimizing the browser window will{' '}
                    <strong>automatically submit</strong> your exam.
                  </li>
                  <li>
                    <strong>Fullscreen mode</strong> is mandatory. Exiting fullscreen will{' '}
                    <strong>automatically submit</strong> your exam.
                  </li>
                  <li>
                    The timer starts immediately when you click &quot;Begin Assessment&quot;.
                  </li>
                  <li>
                    Right-click and developer tools are disabled.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
            <span className="text-sm text-gray-700">
              I understand the rules above and confirm that I am using incognito/private browsing
              mode without any extensions.
            </span>
          </label>

          {/* Begin button */}
          <Button
            onClick={handleBegin}
            className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700"
            disabled={!rulesAccepted || starting}
          >
            {starting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <CheckSquare className="h-5 w-5 mr-2" />
                Begin Assessment
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
