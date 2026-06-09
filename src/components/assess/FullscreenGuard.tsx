'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

interface Props {
  sessionId: string
  onViolation?: (count: number) => void
}

export default function FullscreenGuard({ sessionId, onViolation }: Props) {
  const [showOverlay, setShowOverlay] = useState(false)
  const [violations, setViolations] = useState(0)

  const logEvent = useCallback(async (eventType: string, eventData = {}) => {
    try {
      await fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: eventType, event_data: eventData }),
      })
    } catch {}
  }, [sessionId])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        const newCount = violations + 1
        setViolations(newCount)
        setShowOverlay(true)
        logEvent('fullscreen_exit', { violation_number: newCount })
        onViolation?.(newCount)
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

    const handleCopy = (e: ClipboardEvent) => {
      logEvent('copy_detected', { length: window.getSelection()?.toString().length || 0 })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+U (view source), F12
      if ((e.ctrlKey && e.key === 'u') || e.key === 'F12') {
        e.preventDefault()
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
  }, [violations, logEvent, onViolation])

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
        <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Fullscreen Required</h2>
        <p className="text-gray-600 mb-2">You have exited fullscreen mode.</p>
        <p className="text-red-600 font-semibold mb-6">
          This has been logged as violation {violations} of 3.
        </p>
        {violations >= 3 ? (
          <p className="text-red-700 font-bold text-lg">Your session has been disqualified.</p>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-6">
              After 3 violations, your session will be automatically disqualified.
            </p>
            <Button onClick={reenterFullscreen} className="w-full">
              Return to Fullscreen
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
