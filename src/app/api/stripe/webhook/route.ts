import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/utils/stripe'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ ok: true })

  const sig = req.headers.get('stripe-signature')
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !whSecret) return NextResponse.json({ ok: true })

  const body = await req.text()
  try {
    const event = stripe.webhooks.constructEvent(body, sig, whSecret)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

    const upsertSub = async (customerId: string, trainerId: string | null, subscriptionId: string | null, tierKey?: string | null) => {
      if (!supabaseUrl || !serviceKey) return
      const admin = createAdminClient(supabaseUrl, serviceKey)
      let sub: any = null
      try { if (subscriptionId) sub = await stripe.subscriptions.retrieve(subscriptionId) } catch {}
      const status = sub?.status ?? 'active'
      const priceId = sub?.items?.data?.[0]?.price?.id ?? null
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
      await admin.from('stripe_subscriptions').upsert({
        id: subscriptionId ?? `sub_${customerId}`,
        customer_id: customerId,
        trainer: trainerId,
        status,
        price_id: priceId,
        tier_key: tierKey ?? null,
        current_period_end: periodEnd,
      }, { onConflict: 'id' })
    }
    const unlinkSub = async (customerId: string, subscriptionId?: string | null) => {
      if (!supabaseUrl || !serviceKey) return
      const admin = createAdminClient(supabaseUrl, serviceKey)
      // Find mapping
      const { data: cust } = await admin
        .from('stripe_customers')
        .select('trainer,user_id')
        .eq('customer_id', customerId)
        .limit(1)
      const trainerId = (cust?.[0]?.trainer as string) || null
      const uid = (cust?.[0]?.user_id as string) || null
      if (subscriptionId) {
        await admin.from('stripe_subscriptions').upsert({
          id: subscriptionId,
          customer_id: customerId,
          trainer: trainerId,
          status: 'canceled',
        }, { onConflict: 'id' })
      }
      if (trainerId && uid) {
        const { data: tRows } = await admin
          .from('trainer')
          .select('subs')
          .eq('trainer_id', trainerId)
          .limit(1)
        const current: string[] = Array.isArray(tRows?.[0]?.subs) ? (tRows![0]!.subs as string[]) : []
        const next = current.filter((x) => x !== uid)
        await admin.from('trainer').update({ subs: next }).eq('trainer_id', trainerId)
        // Only clear profile.trainer if it matches this trainer
        await admin.from('profile').update({ trainer: null }).eq('creator_id', uid).eq('trainer', trainerId)
      }
    }

    switch (event.type) {
      case 'checkout.session.completed':
        // Persist customer/subscription if service role key is available
        try {
          const session = event.data.object as any
          const customerId = session.customer as string
          const subscriptionId = session.subscription as string
          const trainerId = session.metadata?.trainer_id || null
          const tierKey = session.metadata?.tier_key || null
          const userId = session.metadata?.user_id || null

          if (supabaseUrl && serviceKey) {
            const admin = createAdminClient(supabaseUrl, serviceKey)
            // Enrich subscription data
            const sub = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null
            const status = sub?.status ?? 'active'
            const priceId = sub?.items?.data?.[0]?.price?.id ?? null
            const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null

            // Resolve user if missing via email
            let resolvedUser = userId
            if (!resolvedUser) {
              const email = session.customer_details?.email as string | undefined
              if (email) {
                const { data: prof } = await admin.from('profile').select('creator_id').eq('email', email).limit(1)
                resolvedUser = (prof?.[0]?.creator_id as string) || null
              }
            }

            await admin.from('stripe_customers').upsert({
              customer_id: customerId,
              trainer: trainerId,
              user_id: resolvedUser,
            }, { onConflict: 'customer_id' })

            await upsertSub(customerId, trainerId, subscriptionId, tierKey)

            // Also add to trainer.subs array if user_id present
            if (trainerId && resolvedUser) {
              // fetch current subs
              const { data: tRows } = await admin
                .from('trainer')
                .select('subs')
                .eq('trainer_id', trainerId)
                .limit(1)
              const current: string[] = Array.isArray(tRows?.[0]?.subs) ? (tRows![0]!.subs as string[]) : []
              if (!current.includes(resolvedUser)) {
                const next = [...current, resolvedUser]
                await admin.from('trainer').update({ subs: next }).eq('trainer_id', trainerId)
              }

              // Link profile to trainer for easier querying in-app
              await admin
                .from('profile')
                .update({ trainer: trainerId })
                .eq('creator_id', resolvedUser)
            }
            }
          }
        } catch {}
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        try {
          if (!supabaseUrl || !serviceKey) break
          const sub = event.data.object as any
          const customerId = sub.customer as string
          const admin = createAdminClient(supabaseUrl, serviceKey)
          const { data: cust } = await admin
            .from('stripe_customers')
            .select('trainer,user_id')
            .eq('customer_id', customerId)
            .limit(1)
          const trainerId = (cust?.[0]?.trainer as string) || null
          const uid = (cust?.[0]?.user_id as string) || null
          await upsertSub(customerId, trainerId, sub.id, null)
          const status = String(sub.status || '')
          if (status === 'canceled' || status === 'incomplete_expired') {
            await unlinkSub(customerId, sub.id)
            break
          }
          if (trainerId && uid) {
            const { data: tRows } = await admin
              .from('trainer')
              .select('subs')
              .eq('trainer_id', trainerId)
              .limit(1)
            const current: string[] = Array.isArray(tRows?.[0]?.subs) ? (tRows![0]!.subs as string[]) : []
            if (!current.includes(uid)) {
              const next = [...current, uid]
              await admin.from('trainer').update({ subs: next }).eq('trainer_id', trainerId)
            }
            await admin.from('profile').update({ trainer: trainerId }).eq('creator_id', uid)
          }
        } catch {}
        break
      }
      case 'customer.subscription.deleted': {
        try {
          const sub = event.data.object as any
          const customerId = sub.customer as string
          await unlinkSub(customerId, sub.id)
        } catch {}
        break
      }
      default:
        break
    }
    return new NextResponse(null, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
}
