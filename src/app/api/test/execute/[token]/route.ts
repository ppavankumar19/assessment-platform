import { NextResponse } from 'next/server'
import { getSubmissionResult } from '@/lib/judge0/client'

export async function GET(request: Request, { params }: { params: { token: string } }) {
  // Public endpoint — session validation happens at submit time
  // This just polls Judge0 for a result by token
  try {
    const result = await getSubmissionResult(params.token)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
