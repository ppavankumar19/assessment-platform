'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Plus, Trash2, Play, Pause, Download, Send, Activity, Eye, Target, Pencil, ChevronDown, ChevronUp, Ban } from 'lucide-react'
import { toast } from 'sonner'
import type { Question, TestCase } from '@/types/database'

interface SessionSummary {
  id: string; user_email: string; user_name: string | null; status: string
  candidate_email: string; college_name: string | null; roll_no: string | null; branch: string | null
  fullscreen_violations: number; tab_switch_violations: number
  questions_answered: number; total_score: number
}

interface QuestionFormData {
  sequence_order: number
  title: string
  description: string
  type: 'output_prediction' | 'coding'
  code_snippet: string
  expected_output: string
  starter_code: string
  test_cases: TestCase[]
  time_limit_s: number
  memory_limit_mb: number
  points: number
}

const defaultTestCase = (): TestCase => ({
  id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  input: '',
  expected_output: '',
  is_hidden: false,
  points: 5,
})

const emptyQuestionForm = (defaultType: 'output_prediction' | 'coding' = 'output_prediction'): QuestionFormData => ({
  sequence_order: 1,
  title: '',
  description: '',
  type: defaultType,
  code_snippet: '',
  expected_output: '',
  starter_code: '',
  test_cases: [defaultTestCase()],
  time_limit_s: 5,
  memory_limit_mb: 128,
  points: 10,
})

export default function RoundDetailPage() {
  const params = useParams()
  const router = useRouter()
  const roundId = params.id as string
  const [round, setRound] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [addQuestionOpen, setAddQuestionOpen] = useState(false)
  const [editQuestionOpen, setEditQuestionOpen] = useState(false)
  const [editRoundOpen, setEditRoundOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [cutoffOpen, setCutoffOpen] = useState(false)

  // Expanded question view
  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  const [cutoffValue, setCutoffValue] = useState(0)
  const [emails, setEmails] = useState('')
  const [qf, setQf] = useState<QuestionFormData>(emptyQuestionForm())
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [eqf, setEqf] = useState<QuestionFormData>(emptyQuestionForm())

  // Round edit form
  const [roundForm, setRoundForm] = useState({
    title: '', description: '', type: 'output_prediction' as string,
    duration_minutes: 60, pass_score: 0,
  })

  const fetchData = async () => {
    const [rRes, qRes, sRes] = await Promise.all([
      fetch(`/api/admin/rounds/${roundId}`),
      fetch(`/api/admin/rounds/${roundId}/questions`),
      fetch(`/api/admin/rounds/${roundId}/sessions`),
    ])
    if (rRes.ok) {
      const r = await rRes.json()
      setRound(r)
      setRoundForm({
        title: r.title, description: r.description || '',
        type: r.type, duration_minutes: r.duration_minutes, pass_score: r.pass_score,
      })
    }
    if (qRes.ok) setQuestions(await qRes.json())
    if (sRes.ok) setSessions(await sRes.json())
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [roundId])

  // --- Round CRUD ---
  const handleEditRound = async () => {
    const res = await fetch(`/api/admin/rounds/${roundId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: roundForm.title,
        description: roundForm.description || null,
        type: roundForm.type,
        duration_minutes: roundForm.duration_minutes,
        pass_score: roundForm.pass_score,
      }),
    })
    if (res.ok) {
      toast.success('Round updated')
      setEditRoundOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to update round')
    }
  }

  const handleSaveCutoff = async () => {
    const res = await fetch(`/api/admin/rounds/${roundId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cutoff_score: cutoffValue }),
    })
    if (res.ok) {
      toast.success('Cutoff score updated')
      setCutoffOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to update cutoff')
    }
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

  // --- Question CRUD ---
  const buildQuestionBody = (form: QuestionFormData) => {
    const body: any = {
      sequence_order: form.sequence_order, title: form.title,
      description: form.description || null, type: form.type, points: form.points,
    }
    if (form.type === 'output_prediction') {
      body.code_snippet = form.code_snippet
      body.expected_output = form.expected_output
      body.starter_code = null
      body.test_cases = null
    } else {
      body.starter_code = form.starter_code || null
      body.time_limit_s = form.time_limit_s
      body.memory_limit_mb = form.memory_limit_mb
      body.code_snippet = null
      body.expected_output = null
      body.test_cases = form.test_cases
    }
    return body
  }

  const handleOpenAddQuestion = () => {
    const defaultType = round?.type === 'live_coding' ? 'coding' : 'output_prediction'
    setQf({ ...emptyQuestionForm(defaultType), sequence_order: questions.length + 1 })
    setAddQuestionOpen(true)
  }

  const handleAddQuestion = async () => {
    const body = buildQuestionBody(qf)
    const res = await fetch(`/api/admin/rounds/${roundId}/questions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      toast.success('Question added')
      setAddQuestionOpen(false)
      fetchData()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed')
    }
  }

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q)
    setEqf({
      sequence_order: q.sequence_order,
      title: q.title,
      description: q.description || '',
      type: q.type as 'output_prediction' | 'coding',
      code_snippet: q.code_snippet || '',
      expected_output: q.expected_output || '',
      starter_code: q.starter_code || '',
      test_cases: q.test_cases && q.test_cases.length > 0 ? q.test_cases : [defaultTestCase()],
      time_limit_s: q.time_limit_s,
      memory_limit_mb: q.memory_limit_mb,
      points: q.points,
    })
    setEditQuestionOpen(true)
  }

  const handleEditQuestion = async () => {
    if (!editingQuestion) return
    const body = buildQuestionBody(eqf)
    const res = await fetch(`/api/admin/questions/${editingQuestion.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success('Question updated')
      setEditQuestionOpen(false)
      setEditingQuestion(null)
      fetchData()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to update question')
    }
  }

  const handleDeleteQuestion = async (qid: string) => {
    if (!confirm('Delete this question?')) return
    const res = await fetch(`/api/admin/questions/${qid}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); fetchData() }
  }

  // --- Session management ---
  const handleDisqualifySession = async (sessionId: string) => {
    if (!confirm('Disqualify this candidate? Their exam will be terminated immediately.')) return
    const res = await fetch(`/api/admin/sessions/${sessionId}/disqualify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Admin disqualification' }),
    })
    if (res.ok) { toast.success('Candidate disqualified'); fetchData() }
    else toast.error('Failed to disqualify')
  }

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Delete this candidate\'s session? This will permanently remove their submission data. This cannot be undone.')) return
    const res = await fetch(`/api/admin/sessions/${sessionId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Session deleted'); fetchData() }
    else {
      const err = await res.json()
      toast.error(err.error || 'Failed to delete session')
    }
  }

  // --- Test case helpers ---
  const updateTestCase = useCallback((
    setter: React.Dispatch<React.SetStateAction<QuestionFormData>>,
    index: number,
    field: keyof TestCase,
    value: any
  ) => {
    setter(prev => {
      const updated = [...prev.test_cases]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, test_cases: updated }
    })
  }, [])

  const addTestCase = useCallback((setter: React.Dispatch<React.SetStateAction<QuestionFormData>>) => {
    setter(prev => ({
      ...prev,
      test_cases: [...prev.test_cases, defaultTestCase()],
    }))
  }, [])

  const removeTestCase = useCallback((setter: React.Dispatch<React.SetStateAction<QuestionFormData>>, index: number) => {
    setter(prev => ({
      ...prev,
      test_cases: prev.test_cases.filter((_, i) => i !== index),
    }))
  }, [])

  // --- Invitations ---
  const handleInvite = async () => {
    const emailList = emails.split(/[\n,]/).map(e => e.trim()).filter(Boolean)
    if (!emailList.length) return
    const res = await fetch('/api/admin/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ round_id: roundId, emails: emailList }) })
    if (res.ok) { const d = await res.json(); toast.success(`Invited ${d.created} candidates`); setInviteOpen(false); setEmails(''); fetchData() }
    else toast.error('Failed to send invitations')
  }

  const getSessionStatusBadge = (status: string) => {
    const map: Record<string, any> = { started: 'success', completed: 'secondary', timed_out: 'warning', disqualified: 'destructive', invited: 'outline' }
    return <Badge variant={map[status] || 'outline'}>{status === 'started' ? 'Active' : status.replace(/_/g, ' ')}</Badge>
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
  if (!round) return <div>Round not found</div>

  // Inline question form rendering to avoid re-mount issues
  const renderQuestionForm = (form: QuestionFormData, setter: React.Dispatch<React.SetStateAction<QuestionFormData>>) => (
    <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v: any) => setter(prev => ({ ...prev, type: v }))}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="output_prediction">Output Prediction</SelectItem>
              <SelectItem value="coding">Coding</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Order</Label>
          <Input type="number" value={form.sequence_order} onChange={e => setter(prev => ({ ...prev, sequence_order: parseInt(e.target.value) || 1 }))} className="mt-1" />
        </div>
      </div>
      <div>
        <Label>Title</Label>
        <Input value={form.title} onChange={e => setter(prev => ({ ...prev, title: e.target.value }))} className="mt-1" placeholder="e.g., Pointer Arithmetic" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setter(prev => ({ ...prev, description: e.target.value }))} className="mt-1" />
      </div>
      <div>
        <Label>Points</Label>
        <Input type="number" value={form.points} onChange={e => setter(prev => ({ ...prev, points: parseInt(e.target.value) || 10 }))} className="mt-1" />
      </div>

      {form.type === 'output_prediction' ? (
        <>
          <div>
            <Label>C Code Snippet</Label>
            <Textarea value={form.code_snippet} onChange={e => setter(prev => ({ ...prev, code_snippet: e.target.value }))} className="mt-1 font-mono text-sm" rows={10} placeholder="#include<stdio.h>" />
          </div>
          <div>
            <Label>Expected Output</Label>
            <Textarea value={form.expected_output} onChange={e => setter(prev => ({ ...prev, expected_output: e.target.value }))} className="mt-1 font-mono text-sm" rows={3} />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>Starter Code</Label>
            <Textarea value={form.starter_code} onChange={e => setter(prev => ({ ...prev, starter_code: e.target.value }))} className="mt-1 font-mono text-sm" rows={5} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Time Limit (s)</Label>
              <Input type="number" value={form.time_limit_s} onChange={e => setter(prev => ({ ...prev, time_limit_s: parseInt(e.target.value) || 5 }))} className="mt-1" />
            </div>
            <div>
              <Label>Memory (MB)</Label>
              <Input type="number" value={form.memory_limit_mb} onChange={e => setter(prev => ({ ...prev, memory_limit_mb: parseInt(e.target.value) || 128 }))} className="mt-1" />
            </div>
          </div>

          {/* Test Cases UI */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Test Cases ({form.test_cases.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => addTestCase(setter)}>
                <Plus className="h-3 w-3 mr-1" />Add Test Case
              </Button>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto border rounded-lg p-3 bg-gray-50">
              {form.test_cases.map((tc, i) => (
                <div key={tc.id || i} className="bg-white border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Test Case {i + 1}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-gray-500">Hidden</Label>
                        <Switch
                          checked={tc.is_hidden}
                          onCheckedChange={(v) => updateTestCase(setter, i, 'is_hidden', v)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-xs text-gray-500">Pts</Label>
                        <Input
                          type="number"
                          value={tc.points}
                          onChange={e => updateTestCase(setter, i, 'points', parseInt(e.target.value) || 0)}
                          className="w-16 h-7 text-xs"
                        />
                      </div>
                      {form.test_cases.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTestCase(setter, i)}>
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-gray-500">Input</Label>
                      <Textarea
                        value={tc.input}
                        onChange={e => updateTestCase(setter, i, 'input', e.target.value)}
                        className="mt-0.5 font-mono text-xs"
                        rows={2}
                        placeholder="stdin input..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Expected Output</Label>
                      <Textarea
                        value={tc.expected_output}
                        onChange={e => updateTestCase(setter, i, 'expected_output', e.target.value)}
                        className="mt-0.5 font-mono text-xs"
                        rows={2}
                        placeholder="expected stdout..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.push('/admin')}><ArrowLeft className="h-4 w-4 mr-2" />Rounds</Button>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{round.title}</h1>
            <Button variant="ghost" size="icon" onClick={() => setEditRoundOpen(true)} disabled={round.is_active}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={round.is_active ? 'success' : round.is_published ? 'secondary' : 'outline'}>
              {round.is_active ? 'Active' : round.is_published ? 'Paused' : 'Draft'}
            </Badge>
            <Badge variant="secondary">{round.type === 'output_prediction' ? 'Output Prediction' : 'Live Coding'}</Badge>
            <span className="text-sm text-gray-500">{round.duration_minutes} min</span>
          </div>
          {round.description && <p className="text-gray-600 mt-2">{round.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {round.is_active ? (
            <Button variant="outline" onClick={handlePause}><Pause className="h-4 w-4 mr-2" />Pause</Button>
          ) : (
            <Button onClick={handlePublish}><Play className="h-4 w-4 mr-2" />Publish</Button>
          )}
          {round.is_published && (
            <>
              <Link href={`/admin/monitor/${roundId}`}><Button variant="outline"><Activity className="h-4 w-4 mr-2" />Monitor</Button></Link>
              <a href={`/api/admin/rounds/${roundId}/export?format=csv`}><Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button></a>
              <a href={`/api/admin/rounds/${roundId}/export?format=csv&cutoff=true`}><Button variant="outline"><Download className="h-4 w-4 mr-2" />Export Finalized</Button></a>
            </>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Questions</div><div className="text-2xl font-bold">{questions.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Candidates</div><div className="text-2xl font-bold">{sessions.length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Active</div><div className="text-2xl font-bold text-green-600">{sessions.filter(s => s.status === 'started').length}</div></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><div className="text-sm text-gray-500">Completed</div><div className="text-2xl font-bold text-indigo-600">{sessions.filter(s => s.status === 'completed').length}</div></CardContent></Card>
        <Card className="cursor-pointer hover:border-indigo-400 transition-colors" onClick={() => { setCutoffValue(round.cutoff_score || 0); setCutoffOpen(true) }}>
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-gray-500 flex items-center gap-1"><Target className="h-3 w-3" />Cutoff</div>
            <div className="text-2xl font-bold text-purple-600">{round.cutoff_score || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Round Dialog */}
      <Dialog open={editRoundOpen} onOpenChange={setEditRoundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Round</DialogTitle>
            <DialogDescription>Update round details. Cannot edit while round is active.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Title</Label>
              <Input value={roundForm.title} onChange={e => setRoundForm({ ...roundForm, title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={roundForm.description} onChange={e => setRoundForm({ ...roundForm, description: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={roundForm.type} onValueChange={v => setRoundForm({ ...roundForm, type: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="output_prediction">Output Prediction</SelectItem>
                    <SelectItem value="live_coding">Live Coding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <Input type="number" value={roundForm.duration_minutes} onChange={e => setRoundForm({ ...roundForm, duration_minutes: parseInt(e.target.value) || 60 })} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Pass Score</Label>
              <Input type="number" value={roundForm.pass_score} onChange={e => setRoundForm({ ...roundForm, pass_score: parseInt(e.target.value) || 0 })} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoundOpen(false)}>Cancel</Button>
            <Button onClick={handleEditRound} disabled={!roundForm.title}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cutoff Score Dialog */}
      <Dialog open={cutoffOpen} onOpenChange={setCutoffOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Cutoff Score</DialogTitle>
            <DialogDescription>Candidates scoring at or above this cutoff will be marked as finalized.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Cutoff Score</Label>
            <Input type="number" value={cutoffValue} onChange={e => setCutoffValue(parseInt(e.target.value) || 0)} className="mt-1" min={0} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCutoffOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCutoff}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={editQuestionOpen} onOpenChange={setEditQuestionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>Update question details.</DialogDescription>
          </DialogHeader>
          {renderQuestionForm(eqf, setEqf)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQuestionOpen(false)}>Cancel</Button>
            <Button onClick={handleEditQuestion} disabled={!eqf.title}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="candidates">Candidates ({sessions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={addQuestionOpen} onOpenChange={setAddQuestionOpen}>
              <DialogTrigger asChild>
                <Button disabled={round.is_active} onClick={handleOpenAddQuestion}>
                  <Plus className="h-4 w-4 mr-2" />Add Question
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Add Question</DialogTitle><DialogDescription>Add a new question to this round.</DialogDescription></DialogHeader>
                {renderQuestionForm(qf, setQf)}
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
                      <div
                        className="flex items-center gap-4 flex-1 cursor-pointer"
                        onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                      >
                        <span className="text-lg font-bold text-gray-400">#{q.sequence_order}</span>
                        <div className="flex-1">
                          <h3 className="font-medium">{q.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{q.type === 'output_prediction' ? 'Output Pred.' : 'Coding'}</Badge>
                            <span className="text-sm text-gray-500">{q.points} pts</span>
                            {q.type === 'coding' && q.test_cases && (
                              <span className="text-xs text-gray-400">{q.test_cases.length} test cases</span>
                            )}
                          </div>
                        </div>
                        {expandedQ === q.id
                          ? <ChevronUp className="h-4 w-4 text-gray-400" />
                          : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditQuestion(q)} disabled={round.is_active}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteQuestion(q.id)} disabled={round.is_active}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {expandedQ === q.id && (
                      <div className="mt-4 space-y-3 border-t pt-4">
                        {q.description && (
                          <div>
                            <Label className="text-xs text-gray-500">Description</Label>
                            <p className="text-sm mt-1">{q.description}</p>
                          </div>
                        )}
                        {q.code_snippet && (
                          <div>
                            <Label className="text-xs text-gray-500">Code Snippet</Label>
                            <pre className="mt-1 bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">{q.code_snippet}</pre>
                          </div>
                        )}
                        {q.expected_output && (
                          <div>
                            <Label className="text-xs text-gray-500">Expected Output</Label>
                            <pre className="mt-1 bg-gray-100 p-3 rounded-lg text-sm font-mono">{q.expected_output}</pre>
                          </div>
                        )}
                        {q.starter_code && (
                          <div>
                            <Label className="text-xs text-gray-500">Starter Code</Label>
                            <pre className="mt-1 bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto font-mono">{q.starter_code}</pre>
                          </div>
                        )}
                        {q.type === 'coding' && (
                          <div className="flex gap-4">
                            <div>
                              <Label className="text-xs text-gray-500">Time Limit</Label>
                              <p className="text-sm mt-1">{q.time_limit_s}s</p>
                            </div>
                            <div>
                              <Label className="text-xs text-gray-500">Memory Limit</Label>
                              <p className="text-sm mt-1">{q.memory_limit_mb} MB</p>
                            </div>
                          </div>
                        )}
                        {q.test_cases && q.test_cases.length > 0 && (
                          <div>
                            <Label className="text-xs text-gray-500">Test Cases ({q.test_cases.length})</Label>
                            <div className="mt-1 space-y-2 max-h-[400px] overflow-y-auto">
                              {q.test_cases.map((tc, i) => (
                                <div key={tc.id || i} className="bg-gray-50 p-3 rounded-lg text-sm">
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className="font-medium">Case {i + 1}</span>
                                    <span className="text-gray-500">{tc.points} pts</span>
                                    {tc.is_hidden && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-xs text-gray-500">Input:</span>
                                      <pre className="font-mono text-xs bg-white p-1 rounded mt-0.5">{tc.input || '(empty)'}</pre>
                                    </div>
                                    <div>
                                      <span className="text-xs text-gray-500">Expected:</span>
                                      <pre className="font-mono text-xs bg-white p-1 rounded mt-0.5">{tc.expected_output}</pre>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
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
                    <TableHead>College</TableHead>
                    <TableHead>Roll No</TableHead>
                    <TableHead>Branch</TableHead>
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
                      <TableCell className="text-sm">{s.college_name || '-'}</TableCell>
                      <TableCell className="text-sm">{s.roll_no || '-'}</TableCell>
                      <TableCell className="text-sm">{s.branch || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getSessionStatusBadge(s.status)}
                          {round.cutoff_score > 0 && s.total_score >= round.cutoff_score && (
                            <Badge variant="success">Finalized</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.fullscreen_violations > 0 && <span className="text-red-600 text-sm mr-2">FS:{s.fullscreen_violations}</span>}
                        {s.tab_switch_violations > 0 && <span className="text-amber-600 text-sm">Tab:{s.tab_switch_violations}</span>}
                        {s.fullscreen_violations === 0 && s.tab_switch_violations === 0 && <span className="text-gray-400">-</span>}
                      </TableCell>
                      <TableCell className="text-center">{s.questions_answered}</TableCell>
                      <TableCell className="text-center font-semibold">{s.total_score}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/results/${roundId}?session=${s.id}`}>
                            <Button variant="ghost" size="icon" title="View results"><Eye className="h-4 w-4" /></Button>
                          </Link>
                          {s.status === 'started' && (
                            <Button variant="ghost" size="icon" title="Disqualify" onClick={() => handleDisqualifySession(s.id)}>
                              <Ban className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" title="Delete session" onClick={() => handleDeleteSession(s.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
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
