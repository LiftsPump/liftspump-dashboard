import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const ACTIVE = ['active','trialing','past_due','unpaid','incomplete']
const HIGH_TIERS = ['plus','pro']

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  if (!trainer) return NextResponse.json({ users: [] })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ users: [] })

  try {
    const admin = createAdminClient(supabaseUrl, serviceKey)
    // Map customer -> user
    const { data: cust } = await admin
      .from('stripe_customers')
      .select('customer_id,user_id')
      .eq('trainer', trainer)
    const byCustomer: Record<string,string> = {}
    ;(cust ?? []).forEach((r: any) => { if (r.customer_id && r.user_id) byCustomer[r.customer_id] = r.user_id })

    // Active subs with high tiers
    const { data: subs } = await admin
      .from('stripe_subscriptions')
      .select('customer_id,tier_key,status')
      .eq('trainer', trainer)
      .in('status', ACTIVE)
    const usersSet = new Set<string>()
    ;(subs ?? []).forEach((s: any) => {
      const key = String(s?.tier_key || '').toLowerCase()
      if (HIGH_TIERS.includes(key)) {
        const uid = byCustomer[s.customer_id]
        if (uid) usersSet.add(uid)
      }
    })

    // Try to get emails from profile table if present
    let users: { user_id: string; email?: string, name?: string }[] = Array.from(usersSet).map(u => ({ user_id: u }))
    try {
      if (users.length) {
        const { data: prof } = await admin
          .from('profile')
          .select('creator_id,email,display_name,full_name,name')
          .in('creator_id', users.map(u => u.user_id))
        const infoBy: Record<string,{ email?: string, name?: string }> = {}
        ;(prof ?? []).forEach((p: any) => {
          if (p.creator_id) infoBy[p.creator_id] = { email: p.email || undefined, name: p.display_name || p.full_name || p.name || undefined }
        })
        users = users.map(u => ({ ...u, email: infoBy[u.user_id]?.email, name: infoBy[u.user_id]?.name }))
      }
    } catch {}

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ users: [] })
  }
}
