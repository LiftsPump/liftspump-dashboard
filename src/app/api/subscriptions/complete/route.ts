import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createServerSupabase } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type FinalizePayload = {
  session_id?: string
  trainer_id?: string
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as FinalizePayload
  const sessionId = (body?.session_id ?? '').trim()
  const requestedTrainerId = (body?.trainer_id ?? '').trim()
  if (!sessionId || !requestedTrainerId) {
    return NextResponse.json({ error: 'Missing session_id or trainer_id' }, { status: 400 })
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY as string | undefined
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined

  if (!stripeSecret || !supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server billing is not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeSecret, { apiVersion: '2025-08-27.basil' })

  let checkoutSession: Stripe.Checkout.Session
  try {
    checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unable to load checkout session' }, { status: 400 })
  }

  const sessionTrainerId = (checkoutSession.metadata?.trainer_id ?? requestedTrainerId).trim()
  const tierKey = (checkoutSession.metadata?.tier_key ?? '').trim() || null
  const recordedUserId = (checkoutSession.metadata?.user_id ?? '').trim() || null

  if (sessionTrainerId !== requestedTrainerId) {
    return NextResponse.json({ error: 'Trainer mismatch' }, { status: 403 })
  }

  if (recordedUserId && recordedUserId !== user.id) {
    return NextResponse.json({ error: 'Session does not belong to the signed-in user' }, { status: 403 })
  }

  const customerId = typeof checkoutSession.customer === 'string'
    ? checkoutSession.customer
    : (checkoutSession.customer as Stripe.Customer | null)?.id ?? null

  const subscription =
    typeof checkoutSession.subscription === 'string'
      ? await stripe.subscriptions.retrieve(checkoutSession.subscription)
      : (checkoutSession.subscription as Stripe.Subscription | null)

  const subscriptionId = subscription?.id ?? null
  const subscriptionStatus = subscription?.status ?? 'active'
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? null

  const admin = createAdminClient(supabaseUrl, serviceKey)

  const effectiveUserId = recordedUserId || user.id

  if (!customerId) {
    return NextResponse.json({ error: 'Missing Stripe customer' }, { status: 400 })
  }

  // Persist or update the Stripe customer mapping
  const { error: customerError } = await admin.from('stripe_customers').upsert(
    {
      customer_id: customerId,
      trainer: sessionTrainerId,
      user_id: effectiveUserId,
    },
    { onConflict: 'customer_id' }
  )
  if (customerError) {
    return NextResponse.json({ error: customerError.message || 'Failed to store billing account' }, { status: 500 })
  }

  /*if (subscriptionId) {
    const { error: subscriptionError } = await admin.from('stripe_subscriptions').upsert(
      {
        id: subscriptionId,
        customer_id: customerId,
        trainer: sessionTrainerId,
        status: subscriptionStatus,
        price_id: priceId,
        tier_key: tierKey,
        current_period_end: currentPeriodEnd,
      },
      { onConflict: 'id' }
    )
    if (subscriptionError) {
      return NextResponse.json({ error: subscriptionError.message || 'Failed to store subscription' }, { status: 500 })
    }
  }*/

  // Ensure the user is linked to the trainer
  const { data: trainerRows, error: trainerFetchError } = await admin
    .from('trainer')
    .select('subs')
    .eq('trainer_id', sessionTrainerId)
    .single()
  if (trainerFetchError) {
    return NextResponse.json({ error: trainerFetchError.message || 'Failed to load trainer' }, { status: 500 })
  }
  if (!trainerRows) {
    return NextResponse.json({ error: 'Trainer not found' }, { status: 404 })
  }

  const currentSubs: string[] = Array.isArray(trainerRows?.subs) ? (trainerRows!.subs as string[]) : []

  if (!currentSubs.includes(effectiveUserId)) {
    const updatedSubs = [...currentSubs, effectiveUserId]
    const { error: trainerUpdateError } = await admin
      .from('trainer')
      .update({ subs: updatedSubs })
      .eq('trainer_id', sessionTrainerId)
    if (trainerUpdateError) {
      return NextResponse.json({ error: trainerUpdateError.message || 'Failed to update trainer subscribers' }, { status: 500 })
    }
  }

  const { data: profileRows, error: profileFetchError } = await admin
    .from('profile')
    .select('creator_id')
    .eq('creator_id', effectiveUserId)
    .limit(1)

  if (profileFetchError) {
    return NextResponse.json({ error: profileFetchError.message || 'Failed to load profile' }, { status: 500 })
  }

  if (profileRows && profileRows.length) {
    const { error: profileUpdateError } = await admin
      .from('profile')
      .update({ trainer: sessionTrainerId })
      .eq('creator_id', effectiveUserId)
    if (profileUpdateError) {
      return NextResponse.json({ error: profileUpdateError.message || 'Failed to link profile' }, { status: 500 })
    }
  } else {
    const { error: profileInsertError } = await admin
      .from('profile')
      .insert({ creator_id: effectiveUserId, trainer: sessionTrainerId })
    if (profileInsertError) {
      return NextResponse.json({ error: profileInsertError.message || 'Failed to create profile link' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, trainer_id: sessionTrainerId })
}
