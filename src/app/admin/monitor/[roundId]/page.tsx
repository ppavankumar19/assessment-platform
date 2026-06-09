'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, RefreshCw, Ban, Eye, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime } from '@/lib/utils'
import Link from 'next/link'

interface SessionSummary {
  id: string; user_email: string; user_name: string | null; status: string
  started_at: string | null; expires_at: string | null
  fullscreen_violations: number; tab_switch_violations: number
  questions_answered: number; total_score: number
}

export default function MonitorPage() {
  const params = useParams()
  const roundId = params.roundId as string
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [disqualifyId, setDisqualifyId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const supabase = createClient()

  const fetchSessions = async () => {
    const res = await fetch(`/api/admin/rounds/${roundId}/sessions`)
    if (res.ok) setSessions(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetchSessions()
    const channel = supabase.channel('monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_sessions', filter: `round_id=eq.${roundId}` }, () => fetchSessions())
      .subscribe()
    const interval = setInterval(fetchSessions, 10000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [roundId])

  const handleDisqualify = async () => {
    if (!disqualifyId) return
    const res = await fetch(`/api/admin/sessions/${disqualifyId}/disqualify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    if (res.ok) { toast.success('Disqualified'); setDisqualifyId(null); setReason(''); fetchSessions() }
    else toast.error('Failed')
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, any> = { started: 'success', completed: 'secondary', timed_out: 'warning', disqualified: 'destructive' }
    return <Badge variant={map[status] || 'outline'}>{status === 'started' ? 'Active' : status.replace('_', ' ')}</Badge>
  }

  const getRemainingTime = (s: SessionSummary) => {
    if (s.status !== 'started' || !s.expires_at) return '-'
    const rem = new Date(s.expires_at).getTime() - Date.now()
    return rem <= 0 ? 'Expired' : formatTime(rem)
  }

  const activeCount = sessions.filter(s => s.status === 'started').length

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/admin/rounds/${roundId}`}><Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Activity className="h-6 w-6 text-indigo-600" />Live Monitor</h1>
          <p className="text-gray-500 mt-1">{activeCount} active | {sessions.length} total</p>
        </div>
        <Button variant="outline" onClick={fetchSessions}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></CardContent>
        ) : sessions.length === 0 ? (
          <CardContent className="py-12 text-center text-gray-500">No sessions yet.</CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead><TableHead>Status</TableHead><TableHead>Time Left</TableHead>
                <TableHead className="text-center">FS</TableHead><TableHead className="text-center">Tab</TableHead>
                <TableHead className="text-center">Answered</TableHead><TableHead className="text-center">Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map(s => (
                <TableRow key={s.id} className={s.status === 'disqualified' ? 'opacity-60' : ''}>
                  <TableCell><div className="font-medium">{s.user_name || 'Unknown'}</div><div className="text-sm text-gray-500">{s.user_email}</div></TableCell>
                  <TableCell>{getStatusBadge(s.status)}</TableCell>
                  <TableCell><span className={`font-mono ${s.status === 'started' ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>{getRemainingTime(s)}</span></TableCell>
                  <TableCell className="text-center"><span className={s.fullscreen_violations > 0 ? 'text-red-600 font-semibold' : ''}>{s.fullscreen_violations}</span></TableCell>
                  <TableCell className="text-center"><span className={s.tab_switch_violations > 2 ? 'text-amber-600 font-semibold' : ''}>{s.tab_switch_violations}</span></TableCell>
                  <TableCell className="text-center">{s.questions_answered}</TableCell>
                  <TableCell className="text-center font-semibold">{s.total_score}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/results/${roundId}?session=${s.id}`}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
                      {s.status === 'started' && <Button variant="ghost" size="icon" onClick={() => setDisqualifyId(s.id)}><Ban className="h-4 w-4 text-red-500" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!disqualifyId} onOpenChange={open => !open && setDisqualifyId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disqualify Candidate</DialogTitle><DialogDescription>This cannot be undone.</DialogDescription></DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason..." rows={3} />
          <DialogFooter><Button variant="outline" onClick={() => setDisqualifyId(null)}>Cancel</Button><Button variant="destructive" onClick={handleDisqualify}>Disqualify</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
