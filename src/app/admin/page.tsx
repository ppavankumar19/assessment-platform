'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Eye, Play, Pause, Download, Trash2, Activity } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { Round } from '@/types/database'

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'output_prediction' as const,
    duration_minutes: 60,
    pass_score: 0,
  })

  const fetchRounds = async () => {
    const res = await fetch('/api/admin/rounds')
    if (res.ok) {
      const data = await res.json()
      setRounds(data)
    }
    setLoading(false)
  }

  useEffect(() => { fetchRounds() }, [])

  const handleCreate = async () => {
    const res = await fetch('/api/admin/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (res.ok) {
      toast.success('Round created successfully')
      setCreateOpen(false)
      setFormData({ title: '', description: '', type: 'output_prediction', duration_minutes: 60, pass_score: 0 })
      fetchRounds()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to create round')
    }
  }

  const handlePublish = async (id: string) => {
    const res = await fetch(`/api/admin/rounds/${id}/publish`, { method: 'POST' })
    if (res.ok) {
      toast.success('Round published')
      fetchRounds()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to publish')
    }
  }

  const handlePause = async (id: string) => {
    const res = await fetch(`/api/admin/rounds/${id}/pause`, { method: 'POST' })
    if (res.ok) {
      toast.success('Round paused')
      fetchRounds()
    } else {
      toast.error('Failed to pause round')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this round?')) return
    const res = await fetch(`/api/admin/rounds/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Round deleted')
      fetchRounds()
    } else {
      const err = await res.json()
      toast.error(err.error || 'Failed to delete')
    }
  }

  const getStatusBadge = (round: any) => {
    if (round.is_active) return <Badge variant="success">Active</Badge>
    if (round.is_published) return <Badge variant="secondary">Paused</Badge>
    return <Badge variant="outline">Draft</Badge>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Rounds</h1>
          <p className="text-gray-500 mt-1">Create and manage coding assessment rounds</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Round</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Round</DialogTitle>
              <DialogDescription>Set up a new assessment round for candidates.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Backend Engineering - Round 1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Round instructions and context..."
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="output_prediction">Output Prediction</SelectItem>
                      <SelectItem value="live_coding">Live Coding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Pass Score</Label>
                <Input
                  type="number"
                  value={formData.pass_score}
                  onChange={(e) => setFormData({ ...formData, pass_score: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!formData.title}>Create Round</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : rounds.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No rounds yet</h3>
            <p className="text-gray-500 mt-1">Create your first assessment round to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((round: any) => (
                <TableRow key={round.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/rounds/${round.id}`} className="text-indigo-600 hover:underline">
                      {round.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {round.type === 'output_prediction' ? 'Output Pred.' : 'Live Coding'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(round)}</TableCell>
                  <TableCell>{round.duration_minutes} min</TableCell>
                  <TableCell>{round.questions?.[0]?.count || 0}</TableCell>
                  <TableCell>{round.candidate_sessions?.[0]?.count || 0}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{formatDate(round.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/rounds/${round.id}`}>
                        <Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      {round.is_active ? (
                        <Button variant="ghost" size="icon" onClick={() => handlePause(round.id)}>
                          <Pause className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => handlePublish(round.id)}>
                            <Play className="h-4 w-4" />
                          </Button>
                          {!round.is_published && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(round.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </>
                      )}
                      {round.is_published && (
                        <Link href={`/admin/monitor/${round.id}`}>
                          <Button variant="ghost" size="icon"><Activity className="h-4 w-4" /></Button>
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
