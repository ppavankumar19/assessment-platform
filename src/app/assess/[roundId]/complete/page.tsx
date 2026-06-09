'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Code2 } from 'lucide-react'
import Link from 'next/link'

export default function CompletePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Assessment Complete</h1>
          <p className="text-gray-600 mb-6">
            Your answers have been submitted successfully. Thank you for completing the assessment.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Results will be available once the admin releases them. You may close this window.
          </p>
          <Link href="/assess">
            <Button variant="outline" className="w-full">
              <Code2 className="h-4 w-4 mr-2" />Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
