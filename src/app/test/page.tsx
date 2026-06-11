'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Code2, Clock, FileText, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

interface Round {
  id: string
  title: string
  description: string | null
  type: string
  duration_minutes: number
  is_active: boolean
}

const BRANCHES = ['CSE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'IT', 'AIDS', 'AIML', 'Other'] as const

export default function TestLandingPage() {
  const router = useRouter()
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [registering, setRegistering] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [rollNo, setRollNo] = useState('')
  const [college, setCollege] = useState('')
  const [branch, setBranch] = useState('')

  useEffect(() => {
    fetch('/api/test/rounds')
      .then(r => r.ok ? r.json() : [])
      .then(setRounds)
      .catch(() => setRounds([]))
      .finally(() => setLoading(false))
  }, [])

  const resetForm = () => {
    setName('')
    setEmail('')
    setRollNo('')
    setCollege('')
    setBranch('')
  }

  const handleStartClick = (round: Round) => {
    // Check if already registered for this round
    const existing = localStorage.getItem(`test_session_${round.id}`)
    if (existing) {
      router.push(`/test/${round.id}`)
      return
    }
    setSelectedRound(round)
    resetForm()
    setDialogOpen(true)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !email.trim() || !rollNo.trim() || !college.trim() || !branch) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!selectedRound) return

    setRegistering(true)
    try {
      const res = await fetch(`/api/test/${selectedRound.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: name.trim(),
          candidate_email: email.trim(),
          roll_no: rollNo.trim(),
          college_name: college.trim(),
          branch,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem(
          `test_session_${selectedRound.id}`,
          JSON.stringify({
            session_token: data.session_token,
            round_id: selectedRound.id,
            round_title: selectedRound.title,
            round_type: selectedRound.type,
            duration_minutes: selectedRound.duration_minutes,
            candidate_name: name.trim(),
          })
        )
        setDialogOpen(false)
        toast.success('Registration successful!')
        router.push(`/test/${selectedRound.id}`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Registration failed. Please try again.')
      }
    } catch {
      toast.error('Network error. Please check your connection and try again.')
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center gap-3">
          <Code2 className="h-7 w-7 text-indigo-600" />
          <span className="text-2xl font-bold text-gray-900">CodeAssess</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Technical Assessments
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Select an assessment to register and begin. Make sure you have a stable internet
            connection and are ready to take the test in one sitting.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : rounds.length === 0 ? (
          <Card className="max-w-md mx-auto">
            <CardContent className="py-16 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Active Assessments</h3>
              <p className="text-gray-500 mt-2">
                There are no assessments available at this time. Please check back later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rounds.map((round) => (
              <Card
                key={round.id}
                className="hover:shadow-lg transition-shadow border border-gray-200"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{round.title}</CardTitle>
                    <Badge
                      variant="secondary"
                      className="bg-indigo-50 text-indigo-700 border-indigo-200 whitespace-nowrap"
                    >
                      {round.type === 'output_prediction'
                        ? 'Output Prediction'
                        : 'Live Coding'}
                    </Badge>
                  </div>
                  {round.description && (
                    <CardDescription className="mt-1">
                      {round.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
                    <Clock className="h-4 w-4" />
                    <span>{round.duration_minutes} minutes</span>
                  </div>
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    onClick={() => handleStartClick(round)}
                    disabled={!round.is_active}
                  >
                    {round.is_active ? (
                      <>Start Assessment <ArrowRight className="h-4 w-4 ml-2" /></>
                    ) : (
                      'Currently Paused'
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Registration Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register for Assessment</DialogTitle>
            <DialogDescription>
              {selectedRound
                ? `Enter your details to begin "${selectedRound.title}".`
                : 'Enter your details to begin the assessment.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Student Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rollNo">Roll No *</Label>
              <Input
                id="rollNo"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="Enter your roll number"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="college">College Name *</Label>
              <Input
                id="college"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="Enter your college name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select value={branch} onValueChange={setBranch} required>
                <SelectTrigger id="branch">
                  <SelectValue placeholder="Select your branch" />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={registering}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={registering}
              >
                {registering ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Registering...
                  </>
                ) : (
                  'Register & Continue'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
