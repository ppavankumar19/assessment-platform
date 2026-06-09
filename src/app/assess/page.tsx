'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Code2, Clock, FileText, LogOut } from 'lucide-react'

export default function AssessPage() {
  const [rounds, setRounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetch('/api/rounds').then(r => r.ok ? r.json() : []).then(setRounds).finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-indigo-600" />
            <span className="text-xl font-bold">CodeAssess</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Your Assessments</h1>
        <p className="text-gray-500 mb-6">Complete the assessments assigned to you.</p>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : rounds.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No active assessments</h3>
              <p className="text-gray-500 mt-1">You will see assessments here when you are invited.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rounds.map((round: any) => (
              <Card key={round.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{round.title}</CardTitle>
                      {round.description && <CardDescription className="mt-1">{round.description}</CardDescription>}
                    </div>
                    {round.session_status === 'completed' && <Badge variant="success">Completed</Badge>}
                    {round.session_status === 'started' && <Badge variant="warning">In Progress</Badge>}
                    {round.session_status === 'timed_out' && <Badge variant="secondary">Timed Out</Badge>}
                    {round.session_status === 'disqualified' && <Badge variant="destructive">Disqualified</Badge>}
                    {!round.session_status && round.is_active && <Badge variant="default">Ready</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{round.duration_minutes} minutes</span>
                    <span>{round.type === 'output_prediction' ? 'C Output Prediction' : 'Live Coding'}</span>
                  </div>
                  {!round.session_status && round.is_active && (
                    <Button onClick={() => router.push(`/assess/${round.id}`)}>Begin Assessment</Button>
                  )}
                  {round.session_status === 'started' && (
                    <Button onClick={() => router.push(`/assess/${round.id}`)}>Continue Assessment</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
