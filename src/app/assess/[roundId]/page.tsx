'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Code2, Clock, Shield, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function RoundEntryPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.roundId as string
  const [round, setRound] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    fetch('/api/rounds').then(r => r.json()).then((rounds: any[]) => {
      const r = rounds.find((r: any) => r.id === roundId)
      setRound(r || null)
      setLoading(false)
      if (r?.session_status === 'started') {
        router.push(`/assess/${roundId}/${r.type === 'output_prediction' ? 'r1' : 'r2'}`)
      }
    })
  }, [roundId])

  const handleStart = async () => {
    if (!round) return
    setStarting(true)

    try {
      await document.documentElement.requestFullscreen()
    } catch {
      toast.error('Fullscreen is required. Please allow fullscreen access.')
      setStarting(false)
      return
    }

    const res = await fetch(`/api/rounds/${roundId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_token: round.invitation_token }),
    })

    if (res.ok) {
      const data = await res.json()
      localStorage.setItem(`session_${roundId}`, JSON.stringify(data))
      router.push(`/assess/${roundId}/${round.type === 'output_prediction' ? 'r1' : 'r2'}`)
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to start session')
      document.exitFullscreen().catch(() => {})
      setStarting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
  if (!round) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Assessment not found or no invitation.</p></div>

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-8">
          <div className="text-center mb-8">
            <Code2 className="h-10 w-10 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold">{round.title}</h1>
            {round.description && <p className="text-gray-600 mt-2">{round.description}</p>}
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="h-5 w-5 text-gray-400" />
              <span>Duration: <strong>{round.duration_minutes} minutes</strong></span>
            </div>
            <div className="flex items-center gap-3 text-gray-700">
              <Shield className="h-5 w-5 text-gray-400" />
              <span>Type: <strong>{round.type === 'output_prediction' ? 'C Output Prediction' : 'Live Coding'}</strong></span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Instructions</p>
                <ul className="list-disc pl-4 space-y-1">
                  {round.type === 'output_prediction' ? (
                    <>
                      <li>You will be shown C code snippets.</li>
                      <li>Type the exact output the program would produce.</li>
                    </>
                  ) : (
                    <>
                      <li>Write code to solve each problem.</li>
                      <li>Use Run to test, then Submit for final grading.</li>
                    </>
                  )}
                  <li>The assessment runs in fullscreen mode. Exiting fullscreen is logged as a violation.</li>
                  <li>The timer starts when you click Begin.</li>
                  <li>Do not switch tabs or windows during the assessment.</li>
                </ul>
              </div>
            </div>
          </div>

          <Button onClick={handleStart} className="w-full h-12 text-base" disabled={starting}>
            {starting ? 'Starting...' : 'Begin Assessment'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
