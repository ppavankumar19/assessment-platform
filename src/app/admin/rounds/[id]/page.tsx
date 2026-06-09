'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Plus, Trash2, Play, Pause, Download, Send, Activity, Eye } from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types/database'

interface SessionSummary {
  id: string; user_email: string; user_name: string | null; status: string
  fullscreen_violations: number; tab_switch_violations: number
  questions_answered: number; total_score: number
}

export default function RoundDetailPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.id as string
  const [round, setRound] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [addQuestionOpen, setAddQuestionOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [emails, setEmails] = useState('')
  const [qf, setQf] = useState({
    sequence_order: 1, title: '', description: '',
    type: 'output_prediction' as 'output_prediction' | 'coding',
    code_snippet: '', expected_output: '', starter_code: '',
    test_cases: '[{"id":"tc_1","input":"","expected_output":"","is_hidden":false,"points":5}]',
    time_limit_s: 5, memory_limit_mb: 128, points: 10,
  })

  const fetchData = async () => {
    const [rRes, qRes, sRes] = await Promise.all([
      fetch(`/api/admin/rounds/${roundId}`),
      fetch(`/api/admin/rounds/${roundId}/questions`),
      fetch(`/api/admin/rounds/${roundId}/sessions`),
    ])
    if (rRes.ok) setRound(await rRes.json())
    if (qRes.ok) setQuestions(await qRes.json())
    if (sRes.ok) setSessions(await sRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [roundId])

  const handleAddQuestion = async () => {
    const body: any = { sequence_order: qf.sequence_order, title: qf.title, description: qf.description || null, type: qf.type, points: qf.points }
    if (qf.type === 'output_prediction') {
      body.code_snippet = qf.code_snippet
      body.expected_output = qf.expected_output
    } else {
      body.starter_code = qf.starter_code || null
      body.time_limit_s = qf.time_limit_s
      body.memory_limit_mb = qf.memory_limit_mb
      try { body.test_cases = JSON.parse(qf.test_cases) } catch { toast.error('Invalid test cases JSON'); return }
    }
    const res = await fetch(`/api/admin/rounds/${roundId}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      toast.success('Question added')
      setAddQuestionOpen(false)
      setQf({ ...qf, title: '', description: '', code_snippet: '', expected_output: '', starter_code: '', sequence_order: questions.length + 2 })
      fetchData()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed')
    }
  }

  const handleDeleteQuestion = async (qid: string) => {
    if (!confirm('Delete this question?')) return
    const res = await fetch(`/api/admin/questions/${qid}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); fetchData() }
  }

  const handleInvite = async () => {
    const emailList = emails.split(/[\n,]/).map(e => e.trim()).filter(Boolean)
    if (!emailList.length) return
    const res = await fetch('/api/admin/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ round_id: roundId, emails: emailList }) })
    if (res.ok) { const d = await res.json(); toast.success(`Invited ${d.created} candidates`); setInviteOpen(false); setEmails(''); fetchData() }
    else toast.error('Failed to send invitations')
  }

  const handlePublish = async () => {
    const res = await fetch(`/api/admin/rounds/${roundId}/publish`, { method: 'POST' })
    if (res.ok) { toast.success('Published!'); fetchData() }
    else { const e = await res.json(); toast.error(e.error) }
  }

  const handlePause = async () => {
    const res = await fetch(`/api/admin/rounds/${roundId}/pause`, { method: 'POST' })
    if (res.ok) { toast.success('Paused'); fetchData() }
  }

  const getSessionStatusBadge = (status: string) => {
    const map: Record<string, any> = { started: 'success', completed: 'secondary', timed_out: 'warning', disqualified: 'destructive', invited: 'outline' }
    return <Badge variant={map[status] || 'outline'}>{status === 'started' ? 'Active' : status.replace(/_/g, ' ')}</Badge>
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
  if (!round) return <div>Round not found</div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/admin')}><ArrowLeft className="h-4 w-4 mr-2" />Rounds</Button>
      </div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{round.title}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={round.is_active ? 'success' : round.is_published ? 'secondary' : 'outline'}>
              {round.is_active ? 'Active' : round.is_published ? 'Paused' : 'Draft'}
            </Badge>
            <Badge variant="secondary">{round.type === 'output_prediction' ? 'Output Prediction' : 'Live Coding'}</Badge>
            <span className="text-sm text-gray-500">{round.duration_minutes} min</span>
          </div>
          {round.description && <p className="text-gray-600 mt-2">{round.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {round.is_active ? (
            <Button variant="outline" onClick={handlePause}><Pause className="h-4 w-4 mr-2" />Pause</Button>
          ) : (
            <Button onClick={handlePublish}><Play className="h-4 w-4 mr-2" />Publish</Button>
          )}
          {round.is_published && (
            <>
              <Link href={`/admin/monitor/${roundId}`}><Button variant="outline"><Activity className="h-4 w-4 mr-2" />Monitor</Button></Link>
              <a href={`/api/admin/rounds/${roundId}/export?format=csv`}><Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button></a>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Questions</div><div className="text-2xl font-bold">{questions.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Candidates</div><div className="text-2xl font-bold">{sessions.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Active</div><div className="text-2xl font-bold text-green-600">{sessions.filter(s => s.status === 'started').length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Completed</div><div className="text-2xl font-bold text-indigo-600">{sessions.filter(s => s.status === 'completed').length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="candidates">Candidates ({sessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
              <DialogTrigger asChild><Button disabled={round.is_active}><Plus className="h-4 w-4 mr-2" />Add Question</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add Question</DialogTitle><DialogDescription>Add a new question to this round.</DialogDescription></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select value={qf.type} onValueChange={(v: any) => setQf({ ...qf, type: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="output_prediction">Output Prediction</SelectItem><SelectItem value="coding">Coding</SelectItem></SelectContent></Select>
                    </div>
                    <div><Label>Order</Label><Input type="number" value={qf.sequence_order} onChange={e => setQf({ ...qf, sequence_order: parseInt(e.target.value) || 1 })} className="mt-1" /></div>
                  </div>
                  <div><Label>Title</Label><Input value={qf.title} onChange={e => setQf({ ...qf, title: e.target.value })} className="mt-1" placeholder="e.g., Pointer Arithmetic" /></div>
                  <div><Label>Description</Label><Textarea value={qf.description} onChange={e => setQf({ ...qf, description: e.target.value })} className="mt-1" /></div>
                  <div><Label>Points</Label><Input type="number" value={qf.points} onChange={e => setQf({ ...qf, points: parseInt(e.target.value) || 10 })} className="mt-1" /></div>
                  {qf.type === 'output_prediction' ? (
                    <>
                      <div><Label>C Code Snippet</Label><Textarea value={qf.code_snippet} onChange={e => setQf({ ...qf, code_snippet: e.target.value })} className="mt-1 font-mono text-sm" rows={10} placeholder="#include<stdio.h>" /></div>
                      <div><Label>Expected Output</Label><Textarea value={qf.expected_output} onChange={e => setQf({ ...qf, expected_output: e.target.value })} className="mt-1 font-mono text-sm" rows={3} /></div>
                    </>
                  ) : (
                    <>
                      <div><Label>Starter Code</Label><Textarea value={qf.starter_code} onChange={e => setQf({ ...qf, starter_code: e.target.value })} className="mt-1 font-mono text-sm" rows={5} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Time Limit (s)</Label><Input type="number" value={qf.time_limit_s} onChange={e => setQf({ ...qf, time_limit_s: parseInt(e.target.value) || 5 })} className="mt-1" /></div>
                        <div><Label>Memory (MB)</Label><Input type="number" value={qf.memory_limit_mb} onChange={e => setQf({ ...qf, memory_limit_mb: parseInt(e.target.value) || 128 })} className="mt-1" /></div>
                      </div>
                      <div><Label>Test Cases (JSON)</Label><Textarea value={qf.test_cases} onChange={e => setQf({ ...qf, test_cases: e.target.value })} className="mt-1 font-mono text-sm" rows={8} /></div>
                    </>
                  )}
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setAddQuestionOpen(false)}>Cancel</Button><Button onClick={handleAddQuestion} disabled={!qf.title}>Add</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {questions.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">No questions yet. Add your first question.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {questions.map(q => (
                <Card key={q.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-lg font-bold text-gray-400">#{q.sequence_order}</span>
                        <div>
                          <h3 className="font-medium">{q.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{q.type === 'output_prediction' ? 'Output Pred.' : 'Coding'}</Badge>
                            <span className="text-sm text-gray-500">{q.points} pts</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} disabled={round.is_active}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                    {q.code_snippet && <pre className="mt-3 bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">{q.code_snippet}</pre>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="candidates" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild><Button><Send className="h-4 w-4 mr-2" />Invite Candidates</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Candidates</DialogTitle><DialogDescription>Enter emails, one per line or comma separated.</DialogDescription></DialogHeader>
                <Textarea value={emails} onChange={e => setEmails(e.target.value)} rows={8} placeholder={"alice@example.com\nbob@example.com"} />
                <DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button><Button onClick={handleInvite}>Send Invitations</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {sessions.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-gray-500">No candidates yet. Invite candidates to see them here.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Violations</TableHead>
                    <TableHead className="text-center">Answered</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.user_name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">{s.user_email}</div>
                      </TableCell>
                      <TableCell>{getSessionStatusBadge(s.status)}</TableCell>
                      <TableCell className="text-center">
                        {s.fullscreen_violations > 0 && <span className="text-red-600 text-sm mr-2">FS:{s.fullscreen_violations}</span>}
                        {s.tab_switch_violations > 0 && <span className="text-amber-600 text-sm">Tab:{s.tab_switch_violations}</span>}
                        {s.fullscreen_violations === 0 && s.tab_switch_violations === 0 && <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-center">{s.questions_answered}</TableCell>
                      <TableCell className="text-center font-semibold">{s.total_score}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/results/${roundId}?session=${s.id}`}>
                          <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
