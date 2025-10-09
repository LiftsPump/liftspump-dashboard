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
  const modeParam = (url.searchParams.get('mode') || '').toLowerCase()
  const preferredTrainer = url.searchParams.get('trainer_id') || undefined
  const refreshOverride = url.searchParams.get('refresh_url') || undefined
  const returnOverride = url.searchParams.get('return_url') || undefined
  let connectAccountId = url.searchParams.get('connect_account_id') || undefined

  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe not configured. Install `stripe` and set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  let customerId = url.searchParams.get('customer_id') || undefined
  const userIdParam = url.searchParams.get('user_id') || undefined
  const emailParam = url.searchParams.get('email') || undefined
  let resolvedUserId = userIdParam || undefined
  let trainerIdForUser: string | undefined = preferredTrainer || undefined
  let requesterEmail = emailParam || undefined
  let authUserId: string | undefined
  let supabase: ReturnType<typeof createSupabaseServer> | null = null

  if (supabaseUrl && serviceKey) {
    try {
      supabase = createSupabaseServer()
    } catch {}
  }

  const client = admin ?? supabase

  if (supabase) {
    try {
      const { data: auth } = await supabase.auth.getUser()
      authUserId = auth.user?.id || authUserId
      const authEmail = auth.user?.email || undefined
      if (!resolvedUserId && authUserId) resolvedUserId = authUserId
      if (!requesterEmail && authEmail) requesterEmail = authEmail
    } catch {}
  }

  if (!resolvedUserId && requesterEmail && client) {
    try {
      const { data } = await client
        .from('profile')
        .select('creator_id')
        .eq('email', requesterEmail)
        .limit(1)
      resolvedUserId = (data?.[0]?.creator_id as string) || resolvedUserId
    } catch {}
  }

  if (resolvedUserId && !customerId && client) {
    try {
      const { data: cust } = await client
        .from('stripe_customers')
        .select('customer_id,trainer')
        .eq('user_id', resolvedUserId)
        .limit(1)
      customerId = (cust?.[0]?.customer_id as string) || customerId
      if (!trainerIdForUser) trainerIdForUser = (cust?.[0]?.trainer as string) || trainerIdForUser
    } catch {}
  }

  if (preferredTrainer && client && !connectAccountId) {
    try {
      const { data: directTrainer } = await client
        .from('trainer')
        .select('connect_account_id')
        .eq('trainer_id', preferredTrainer)
        .limit(1)
      const stored = directTrainer?.[0]?.connect_account_id as string | undefined
      if (stored) connectAccountId = stored
    } catch {}
  }

  if (resolvedUserId && client && (!trainerIdForUser || !connectAccountId)) {
    try {
      const { data: trainerRows } = await client
        .from('trainer')
        .select('trainer_id,connect_account_id')
        .eq('creator_id', resolvedUserId)
        .limit(1)
      trainerIdForUser = trainerIdForUser || (trainerRows?.[0]?.trainer_id as string)
      const stored = trainerRows?.[0]?.connect_account_id as string | undefined
      if (!connectAccountId && stored) connectAccountId = stored
    } catch {}
  }

  if (!customerId && trainerIdForUser && resolvedUserId && !modeParam.startsWith('express')) {
    const isSelfRequest = !authUserId || resolvedUserId === authUserId
    if (!isSelfRequest) {
      return NextResponse.json({ error: 'Only the trainer can create their Stripe customer' }, { status: 403 })
    }
    if (!requesterEmail && client) {
      try {
        const { data: prof } = await client
          .from('profile')
          .select('email')
          .eq('creator_id', resolvedUserId)
          .limit(1)
        requesterEmail = (prof?.[0]?.email as string) || requesterEmail
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
    } catch (_err: any) {
      return NextResponse.json({ error: _err?.message ?? 'Unable to provision Stripe customer' }, { status: 500 })
    }
  }

  if (!customerId && trainerIdForUser && !modeParam.startsWith('express') && client) {
    try {
      const { data: anyCust } = await client
        .from('stripe_customers')
        .select('customer_id')
        .eq('trainer', trainerIdForUser)
        .order('created_at', { ascending: false })
        .limit(1)
      customerId = (anyCust?.[0]?.customer_id as string) || customerId
    } catch {}
  }

  const preferExpress = modeParam === 'express' || (!modeParam && (connectAccountId || trainerIdForUser))
  const targetTrainerId = trainerIdForUser || preferredTrainer
  const writeClient = admin ?? supabase

  if (preferExpress) {
    if (!targetTrainerId) {
      return NextResponse.json({ error: 'No trainer found for Express portal' }, { status: 404 })
    }

    if (!writeClient) {
      return NextResponse.json({ error: 'Server missing Supabase credentials for Connect provisioning' }, { status: 500 })
    }

    let account: any = null
    if (connectAccountId) {
      try {
        account = await stripe.accounts.retrieve(connectAccountId)
      } catch {
        account = null
      }
    }

    if (!account) {
      try {
        account = await stripe.accounts.create({
          type: 'express',
          email: requesterEmail || undefined,
          metadata: {
            trainer_id: targetTrainerId,
            user_id: resolvedUserId || undefined,
          },
        })
        connectAccountId = account.id
      } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'Unable to create Stripe Connect account' }, { status: 500 })
      }
    }

    if (account && account.type !== 'express') {
      return NextResponse.json({ error: 'Stripe account is not an Express account' }, { status: 400 })
    }

    const accountId = (account?.id ?? connectAccountId) as string | undefined
    if (!accountId) {
      return NextResponse.json({ error: 'Unable to determine Connect account id' }, { status: 500 })
    }
    connectAccountId = accountId

    try {
      await writeClient
        .from('trainer')
        .update({ connect_account_id: accountId })
        .eq('trainer_id', targetTrainerId)
    } catch {}

    const returnUrl = returnOverride || `${origin}/payments`
    const refreshUrl = refreshOverride || `${origin}/payments?express=refresh`
    const needsOnboarding = !account?.details_submitted || (Array.isArray(account?.requirements?.currently_due) && account.requirements.currently_due.length > 0)

    if (needsOnboarding) {
      try {
        const link = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_onboarding',
        })
        return NextResponse.redirect(link.url, { status: 302 })
      } catch (err: any) {
        return NextResponse.json({ error: err?.message ?? 'Unable to start Express onboarding' }, { status: 500 })
      }
    }

    try {
      const login = await stripe.accounts.createLoginLink(account.id, { redirect_url: returnUrl })
      return NextResponse.redirect(login.url, { status: 302 })
    } catch (err: any) {
      try {
        const fallback = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: refreshUrl,
          return_url: returnUrl,
          type: 'account_update',
        })
        return NextResponse.redirect(fallback.url, { status: 302 })
      } catch (fallbackErr: any) {
        return NextResponse.json({ error: fallbackErr?.message ?? 'Unable to open Express portal' }, { status: 500 })
      }
    }
  }

  if (!customerId) {
    return NextResponse.json({ error: 'No customer found' }, { status: 404 })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnOverride || `${origin}/payments`,
    })
    return NextResponse.redirect(session.url, { status: 302 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unable to create portal session' }, { status: 500 })
  }
}
