import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function AssessLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
