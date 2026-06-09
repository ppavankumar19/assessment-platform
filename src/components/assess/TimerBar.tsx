'use client'

import { useEffect, useState } from 'react'
import { formatTime } from '@/lib/utils'

interface Props {
  expiresAt: string
  onExpire: () => void
}

export default function TimerBar({ expiresAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)

  useEffect(() => {
    const expiryTime = new Date(expiresAt).getTime()
    const initial = expiryTime - Date.now()
    setTotalDuration(initial)
    setRemaining(initial)

    const interval = setInterval(() => {
      const r = expiryTime - Date.now()
      if (r <= 0) {
        clearInterval(interval)
        setRemaining(0)
        onExpire()
      } else {
        setRemaining(r)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  const progress = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0
  const isWarning = remaining <= 5 * 60 * 1000 // 5 minutes
  const isCritical = remaining <= 60 * 1000 // 1 minute

  return (
    <div className="w-full">
      <div className="h-1 bg-gray-200 w-full">
        <div
          className={`h-full transition-all duration-1000 ${
            isCritical ? 'bg-red-600 timer-warning' : isWarning ? 'bg-amber-500' : 'bg-indigo-600'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className={`text-right px-4 py-1 text-sm font-mono font-semibold ${
        isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-600'
      }`}>
        {formatTime(remaining)} remaining
        {isWarning && !isCritical && <span className="ml-2 text-amber-600 text-xs font-normal">5 minutes warning</span>}
        {isCritical && <span className="ml-2 text-red-600 text-xs font-normal">Last minute!</span>}
      </div>
    </div>
  )
}
