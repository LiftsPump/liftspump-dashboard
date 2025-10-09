import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getOrigin } from '@/utils/stripe'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const stripe = getStripe()
  const url = new URL(req.url)
  const origin = getOrigin(req.headers as unknown as Headers)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
  const admin = supabaseUrl && serviceKey ? createAdminClient(supabaseUrl, serviceKey) : null

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe not configured. Install `stripe` and set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  // Accept either direct customer_id, or resolve by user/email for convenience
  let customerId = url.searchParams.get('customer_id') || undefined
  const userIdParam = url.searchParams.get('user_id') || undefined
  const emailParam = url.searchParams.get('email') || undefined
  let resolvedUserId = userIdParam || undefined
  let trainerIdForUser: string | undefined
  let requesterEmail = emailParam || undefined
  let authUserId: string | undefined
  let supabase: ReturnType<typeof createSupabaseServer> | null = null

  if (!customerId) {
    try {
      supabase = createSupabaseServer()

      if (supabase) {
        try {
          const { data: auth } = await supabase.auth.getUser()
          authUserId = auth.user?.id || authUserId
          const authEmail = auth.user?.email || undefined
          if (!resolvedUserId && authUserId) resolvedUserId = authUserId
          if (!requesterEmail && authEmail) requesterEmail = authEmail
        } catch {}
      }

      if (!resolvedUserId && requesterEmail) {
        try {
          const client = admin ?? supabase
          if (client) {
            const { data } = await client
              .from('profile')
              .select('creator_id')
              .eq('email', requesterEmail)
              .limit(1)
            resolvedUserId = (data?.[0]?.creator_id as string) || resolvedUserId
          }
        } catch {}
      }

      if (resolvedUserId && !customerId) {
        try {
          const client = admin ?? supabase
          if (client) {
            const { data: cust } = await client
              .from('stripe_customers')
              .select('customer_id,trainer')
              .eq('user_id', resolvedUserId)
              .limit(1)
            customerId = (cust?.[0]?.customer_id as string) || customerId
            if (!trainerIdForUser) trainerIdForUser = (cust?.[0]?.trainer as string) || trainerIdForUser
          }
        } catch {}
      }

      if (!trainerIdForUser && resolvedUserId) {
        try {
          const client = admin ?? supabase
          if (client) {
            const { data: trainerRows } = await client
              .from('trainer')
              .select('trainer_id')
              .eq('creator_id', resolvedUserId)
              .limit(1)
            trainerIdForUser = (trainerRows?.[0]?.trainer_id as string) || trainerIdForUser
          }
        } catch {}
      }

      // Allow trainers to auto-create a Stripe customer for themselves if missing
      if (!customerId && trainerIdForUser && resolvedUserId) {
        const isSelfRequest = !authUserId || resolvedUserId === authUserId
        if (!isSelfRequest) {
          return NextResponse.json({ error: 'Only the trainer can create their Stripe customer' }, { status: 403 })
        }
        if (!requesterEmail) {
          try {
            const client = admin ?? supabase
            if (client) {
              const { data: prof } = await client
                .from('profile')
                .select('email')
                .eq('creator_id', resolvedUserId)
                .limit(1)
              requesterEmail = (prof?.[0]?.email as string) || requesterEmail
            }
          } catch {}
        }
        if (!admin) {
          return NextResponse.json({ error: 'Server missing Supabase credentials for customer provisioning' }, { status: 500 })
        }
        try {
          const created = await stripe.customers.create({
            email: requesterEmail || undefined,
            metadata: {
              trainer_id: trainerIdForUser,
              user_id: resolvedUserId,
              source: 'trainer-portal-autocreate',
            },
          })
          await admin
            .from('stripe_customers')
            .upsert(
              {
                customer_id: created.id,
                trainer: trainerIdForUser,
                user_id: resolvedUserId,
              },
              { onConflict: 'customer_id' }
            )
          customerId = created.id
        } catch (err: any) {
          return NextResponse.json({ error: err?.message ?? 'Unable to provision Stripe customer' }, { status: 500 })
        }
      }

      // Trainer convenience: if still not found, and the requester is a trainer,
      // open the most recent customer for this trainer to inspect portal.
      if (!customerId && trainerIdForUser) {
        try {
          const client = admin ?? supabase
          if (client) {
            const { data: anyCust } = await client
              .from('stripe_customers')
              .select('customer_id')
              .eq('trainer', trainerIdForUser)
              .order('created_at', { ascending: false })
              .limit(1)
            customerId = (anyCust?.[0]?.customer_id as string) || customerId
          }
        } catch {}
      }
    } catch {}
  }

  if (!customerId) {
    return NextResponse.json({ error: 'No customer found' }, { status: 404 })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/payments`,
    })
    return NextResponse.redirect(session.url, { status: 302 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unable to create portal session' }, { status: 500 })
  }
}
