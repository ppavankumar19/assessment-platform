'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, FileCode, Clock, Keyboard, AlertTriangle } from 'lucide-react'

export default function ResultsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const roundId = params.roundId as string
  const sessionId = searchParams.get('session')
  const [submissions, setSubmissions] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    Promise.all([
      fetch(`/api/admin/sessions/${sessionId}/submissions`).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/sessions/${sessionId}/audit-logs`).then(r => r.ok ? r.json() : []),
    ]).then(([subs, logs]) => { setSubmissions(subs); setAuditLogs(logs); setLoading(false) })
  }, [sessionId])

  const getStatusBadge = (status: string) => {
    const v: Record<string, any> = { accepted: 'success', wrong_answer: 'destructive', time_limit_exceeded: 'warning', runtime_error: 'destructive', compile_error: 'destructive', pending: 'secondary' }
    return <Badge variant={v[status] || 'outline'}>{status.replace(/_/g, ' ')}</Badge>
  }

  const getEventColor = (type: string) => {
    if (['fullscreen_exit', 'disqualified'].includes(type)) return 'text-red-600 bg-red-50'
    if (['tab_switch', 'paste_detected'].includes(type)) return 'text-amber-600 bg-amber-50'
    if (['session_start', 'fullscreen_enter'].includes(type)) return 'text-green-600 bg-green-50'
    return 'text-gray-600 bg-gray-50'
  }

  if (!sessionId) return (
    <div className="text-center py-16">
      <p className="text-gray-500">Select a session from the monitor page.</p>
      <Link href={`/admin/monitor/${roundId}`}><Button variant="outline" className="mt-4">Go to Monitor</Button></Link>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/admin/monitor/${roundId}`}><Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" />Monitor</Button></Link>
        <h1 className="text-2xl font-bold">Session Results</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : (
        <Tabs defaultValue="submissions">
          <TabsList>
            <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
            <TabsTrigger value="audit">Audit Log ({auditLogs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-4 space-y-4">
            {submissions.map((sub: any) => (
              <Card key={sub.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2"><FileCode className="h-5 w-5 text-indigo-600" />{sub.questions?.title || 'Question'}</CardTitle>
                    <div className="flex items-center gap-2">{getStatusBadge(sub.status)}<span className="text-lg font-bold">{sub.score}/{sub.questions?.points || 0}</span></div>
                  </div>
                </CardHeader>
                <CardContent>
                  {sub.code && <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono mb-4 max-h-64 overflow-y-auto">{sub.code}</pre>}
                  {sub.predicted_out && <div className="mb-4"><span className="text-sm font-medium text-gray-500">Predicted:</span><pre className="bg-gray-100 p-3 rounded mt-1 font-mono text-sm">{sub.predicted_out}</pre></div>}
                  {sub.stdout && <div className="mb-4"><span className="text-sm font-medium text-gray-500">stdout:</span><pre className="bg-gray-100 p-3 rounded mt-1 font-mono text-sm">{sub.stdout}</pre></div>}
                  {sub.stderr && <div className="mb-4"><span className="text-sm font-medium text-red-500">stderr:</span><pre className="bg-red-50 text-red-700 p-3 rounded mt-1 font-mono text-sm">{sub.stderr}</pre></div>}
                  {sub.test_results && (
                    <Table>
                      <TableHeader><TableRow><TableHead>Case</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead><TableHead>Time</TableHead><TableHead>Memory</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {sub.test_results.map((tr: any) => (
                          <TableRow key={tr.case_id}>
                            <TableCell className="font-mono">{tr.case_id}</TableCell>
                            <TableCell>{tr.passed ? <Badge variant="success">Pass</Badge> : <Badge variant="destructive">Fail</Badge>}</TableCell>
                            <TableCell>{tr.score}</TableCell><TableCell>{tr.time_ms?.toFixed(1)} ms</TableCell><TableCell>{tr.memory_kb} KB</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {(sub.speed_metrics?.[0] || sub.speed_metrics) && (() => {
                    const m = Array.isArray(sub.speed_metrics) ? sub.speed_metrics[0] : sub.speed_metrics
                    if (!m) return null
                    return (
                      <div className="grid grid-cols-4 gap-3 mt-4 p-4 bg-gray-50 rounded-lg">
                        <div><span className="text-xs text-gray-500 flex items-center gap-1"><Keyboard className="h-3 w-3" />Keystrokes</span><span className="text-lg font-semibold">{m.total_keystrokes}</span></div>
                        <div><span className="text-xs text-gray-500">CPM</span><span className="text-lg font-semibold">{m.chars_per_minute}</span></div>
                        <div><span className="text-xs text-gray-500">Pastes</span><span className="text-lg font-semibold">{m.paste_count}</span></div>
                        <div><span className="text-xs text-gray-500"><Clock className="h-3 w-3 inline" /> Active</span><span className="text-lg font-semibold">{Math.round((m.total_active_time_ms || 0) / 1000)}s</span></div>
                      </div>
                    )
                  })()}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <Card><CardContent className="py-4">
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className={`flex items-start gap-3 p-3 rounded-lg ${getEventColor(log.event_type)}`}>
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{log.event_type.replace(/_/g, ' ')}</span>
                        <span className="text-xs opacity-75">{new Date(log.created_at).toLocaleTimeString()}</span>
                      </div>
                      {log.event_data && Object.keys(log.event_data).length > 0 && <pre className="text-xs mt-1 opacity-75">{JSON.stringify(log.event_data, null, 2)}</pre>}
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && <p className="text-center text-gray-500 py-8">No audit events.</p>}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
