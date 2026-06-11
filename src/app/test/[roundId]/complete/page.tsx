'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Code2 } from 'lucide-react'
import Link from 'next/link'

export default function TestCompletePage() {
  const params = useParams()
  const roundId = params.roundId as string

  // Clear session data for this round on mount
  useEffect(() => {
    localStorage.removeItem(`test_session_${roundId}`)
  }, [roundId])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Assessment Complete
          </h1>
          <p className="text-gray-600 mb-6">
            Your responses have been recorded. Results will be shared by the
            administrator.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Thank you for completing the assessment. You may close this window
            or return to the home page.
          </p>
          <Link href="/test">
            <Button
              variant="outline"
              className="w-full"
            >
              <Code2 className="h-4 w-4 mr-2" />
              Return to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
