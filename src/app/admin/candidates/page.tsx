'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Users, Search, Mail } from 'lucide-react'

interface Candidate {
  id: string
  email: string
  full_name: string | null
  rounds_invited: number
  rounds_completed: number
  total_score: number
  last_active: string | null
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/candidates')
      .then(r => r.ok ? r.json() : [])
      .then(setCandidates)
      .finally(() => setLoading(false))
  }, [])

  const filtered = candidates.filter(c =>
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.full_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="text-gray-500 mt-1">{candidates.length} candidates across all rounds</p>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              {search ? 'No matching candidates' : 'No candidates yet'}
            </h3>
            <p className="text-gray-500 mt-1">
              {search ? 'Try a different search term.' : 'Invite candidates from a round to see them here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Rounds Invited</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Total Score</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-medium">
                        {(c.full_name?.[0] || c.email[0]).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{c.full_name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="h-3 w-3" />{c.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{c.rounds_invited}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.rounds_completed > 0 ? 'success' : 'outline'}>
                      {c.rounds_completed}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{c.total_score}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {c.last_active ? new Date(c.last_active).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : '-'}
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
