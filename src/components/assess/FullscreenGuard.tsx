'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ShieldAlert } from 'lucide-react'

interface Props {
  sessionId: string
  maxViolations?: number
  onDisqualified?: () => void
}

export default function FullscreenGuard({ sessionId, maxViolations = 3, onDisqualified }: Props) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [violations, setViolations] = useState(0)
  const [disqualified, setDisqualified] = useState(false)
  const router = useRouter()

  const logEvent = useCallback(async (eventType: string, eventData = {}) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, event_data: eventData }),
      })
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (data?.disqualified) {
          setDisqualified(true)
          onDisqualified?.()
        }
      }
    } catch {}
  }, [sessionId, onDisqualified])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        const newCount = violations + 1
        setViolations(newCount)
        setShowOverlay(true)
        logEvent('fullscreen_exit', { violation_number: newCount })
        if (newCount >= maxViolations) {
          setDisqualified(true)
          onDisqualified?.()
        }
      } else {
        setShowOverlay(false)
        logEvent('fullscreen_enter')
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        logEvent('tab_switch', { timestamp: Date.now() })
      }
    }

    const handleCopy = () => {
      logEvent('copy_detected', { length: window.getSelection()?.toString().length || 0 })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key === 'u') || e.key === 'F12') {
        e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) {
        // Allow copy/paste but log it
      }
    }

    const handleContextMenu = (e: Event) => {
      e.preventDefault()
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [violations, logEvent, maxViolations, onDisqualified])

  const reenterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen()
      setShowOverlay(false)
    } catch {
      // User denied fullscreen
    }
  }

  if (!showOverlay) return null

  return (
    <div className="fullscreen-overlay">
      <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-2xl">
        {disqualified ? (
          <>
            <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-red-700">Session Disqualified</h2>
            <p className="text-gray-600 mb-4">
              You have exceeded the maximum number of violations.
              Your session has been terminated.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This action has been logged and cannot be reversed.
            </p>
            <Button
              onClick={() => {
                document.exitFullscreen().catch(() => {})
                router.push('/assess')
              }}
              variant="outline"
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </>
        ) : (
          <>
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Fullscreen Required</h2>
            <p className="text-gray-600 mb-2">You have exited fullscreen mode.</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 font-semibold">
                Violation {violations} of {maxViolations}
              </p>
              <p className="text-red-600 text-sm mt-1">
                {maxViolations - violations} remaining before disqualification
              </p>
            </div>
            <Button onClick={reenterFullscreen} className="w-full bg-indigo-600 hover:bg-indigo-700">
              Return to Fullscreen
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
