import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const trainer = url.searchParams.get('trainer_id')
  const user = url.searchParams.get('user_id')
  if (!trainer || !user) return NextResponse.json({ active: false })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ active: false })

  try {
    const admin = createAdminClient(supabaseUrl, serviceKey)
    const { data: cust } = await admin
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user)
      .eq('trainer', trainer)
      .limit(1)
    const customerId = (cust?.[0]?.customer_id as string) || null
    if (!customerId) return NextResponse.json({ active: false })
    const { data: subs } = await admin
      .from('stripe_subscriptions')
      .select('status')
      .eq('customer_id', customerId)
      .eq('trainer', trainer)
      .in('status', ['active','trialing','past_due','unpaid','incomplete'])
      .limit(1)
    const active = Array.isArray(subs) && subs.length > 0
    return NextResponse.json({ active })
  } catch {
    return NextResponse.json({ active: false })
  }
}

