import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const trainer = body?.trainer_id as string | undefined
    const user = body?.user_id as string | undefined
    const immediate = !!body?.immediate
    if (!trainer || !user) return NextResponse.json({ error: 'Missing ids' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
    const stripeKey = process.env.STRIPE_SECRET_KEY as string | undefined
    if (!url || !key || !stripeKey) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const admin = createAdminClient(url, key)
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' })

    // Find customer+sub
    const { data: cust } = await admin
      .from('stripe_customers')
      .select('customer_id')
      .eq('trainer', trainer)
      .eq('user_id', user)
      .limit(1)
    const customerId = (cust?.[0]?.customer_id as string) || null
    if (!customerId) return NextResponse.json({ error: 'No customer' }, { status: 404 })

    const { data: subs } = await admin
      .from('stripe_subscriptions')
      .select('id,status')
      .eq('trainer', trainer)
      .eq('customer_id', customerId)
      .in('status', ['active','trialing','past_due','unpaid','incomplete'])
      .limit(1)
    const subId = (subs?.[0]?.id as string) || null

    if (subId) {
      if (immediate) await stripe.subscriptions.cancel(subId)
      else await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
      await admin.from('stripe_subscriptions').upsert({ id: subId, customer_id: customerId, trainer, status: 'canceled' }, { onConflict: 'id' })
    }

    // Remove links
    const { data: tRows } = await admin
      .from('trainer')
      .select('subs')
      .eq('trainer_id', trainer)
      .limit(1)
    const current: string[] = Array.isArray(tRows?.[0]?.subs) ? (tRows![0]!.subs as string[]) : []
    const next = current.filter((x) => x !== user)
    await admin.from('trainer').update({ subs: next }).eq('trainer_id', trainer)
    await admin.from('profile').update({ trainer: null }).eq('creator_id', user).eq('trainer', trainer)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Kick failed' }, { status: 500 })
  }
}

