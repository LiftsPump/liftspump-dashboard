import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { getStripe, getOrigin } from '@/utils/stripe'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'

type Tier = { key: string; name: string; price: number; active: boolean; stripe_price_id?: string }

const DATA_FILE = path.join(process.cwd(), '.data', 'tiers.json')

export async function GET(req: NextRequest) {
  // Creates a Stripe Checkout Session in subscription mode using inline price_data
  // so you don't need pre-created Price IDs.
  const url = new URL(req.url)
  const tierKey = url.searchParams.get('tier')
  const trainerId = url.searchParams.get('trainer_id') || undefined
  const returnUrl = url.searchParams.get('return_url') || undefined
  const productId = url.searchParams.get('product_id') || process.env.STRIPE_PRODUCT_ID || undefined
  const connectFromQuery = url.searchParams.get('connect_account_id') || undefined
  const userId = url.searchParams.get('user_id') || undefined

  // Resolve a tier to use: try Supabase first, then fallback to local JSON
  let tiers: Tier[] = []
  let supabase: ReturnType<typeof createSupabaseServer> | null = null
  let connectAccountId = connectFromQuery ?? null

  try {
    supabase = createSupabaseServer()
  } catch {}

  if (supabase && trainerId) {
    try {
      const { data, error } = await supabase
        .from('tiers')
        .select('key,name,price,active,stripe_price_id')
        .eq('trainer', trainerId)
        .order('price', { ascending: true })
      if (!error && Array.isArray(data) && data.length) {
        tiers = (data as any[]).map((t) => ({
          key: t.key ?? 'default',
          name: t.name ?? 'Tier',
          // price may be stored in cents; convert when value looks like cents (>= 100)
          price: typeof t.price === 'number' ? (t.price >= 100 ? t.price / 100 : t.price) : 0,
          active: t.active ?? true,
          stripe_price_id: t.stripe_price_id ?? undefined,
        }))
      }
    } catch {}

    if (!connectAccountId) {
      try {
        const { data: trainerRows } = await supabase
          .from('trainer')
          .select('connect_account_id')
          .eq('trainer_id', trainerId)
          .limit(1)
        const stored = trainerRows?.[0]?.connect_account_id as string | undefined
        if (stored) connectAccountId = stored
      } catch {}
    }
  }
  try {
    if (!tiers.length) {
      const raw = await fs.readFile(DATA_FILE, 'utf8')
      const json = JSON.parse(raw)
      tiers = Array.isArray(json?.tiers) ? json.tiers : []
    }
  } catch {}
  const active = tiers.filter((t) => !!t.active)
  let chosen = tierKey ? active.find((t) => t.key === tierKey) : active[0]
  // Fallback: if no tiers found but a product is configured, derive price from product default price
  if (!chosen && productId) {
    try {
      const stripe = getStripe()
      if (stripe) {
        const product = await stripe.products.retrieve(productId as string, { expand: ['default_price'] })
        // @ts-ignore default_price may be object
        const unit = (typeof product.default_price === 'object' ? product.default_price?.unit_amount : undefined) as number | undefined
        const price = unit ? unit / 100 : 0
        if (price > 0) {
          chosen = { key: 'default', name: product.name || 'Subscription', price, active: true }
        }
      }
    } catch {}
  }
  if (!chosen) {
    // Final fallback: allow an env-configured cents price to proceed
    const fallbackCents = process.env.STRIPE_FALLBACK_PRICE_CENTS
    const centsVal = fallbackCents ? Number(fallbackCents) : NaN
    if (!Number.isNaN(centsVal) && centsVal > 0) {
      chosen = { key: 'env', name: 'Subscription', price: centsVal / 100, active: true }
    } else {
      return NextResponse.json({ error: 'No active tier configured' }, { status: 400 })
    }
  }

  const stripe = getStripe()
  if (!stripe) {
    // Helpful guidance when SDK or key is missing
    return NextResponse.json(
      { error: 'Stripe not configured. Install `stripe` and set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  const origin = getOrigin(req.headers as unknown as Headers)
  const success = returnUrl || `${origin}/users`
  const cancel = `${origin}/payments`

  const successUrl = (() => {
    try {
      const url = new URL(success, origin)
      const hash = url.hash || ''
      url.hash = ''
      url.searchParams.set('status', 'success')
      if (trainerId) url.searchParams.set('trainer_id', trainerId)
      if (tierKey) url.searchParams.set('tier', tierKey)
      const base = url.toString()
      const joiner = url.search ? '&' : '?'
      return `${base}${joiner}session_id={CHECKOUT_SESSION_ID}${hash}`
    } catch {
      const glue = success.includes('?') ? '&' : '?'
      return `${success}${glue}status=success&session_id={CHECKOUT_SESSION_ID}`
    }
  })()

  const cancelUrl = (() => {
    try {
      const url = new URL(cancel, origin)
      url.searchParams.set('status', 'cancel')
      if (trainerId) url.searchParams.set('trainer_id', trainerId)
      if (tierKey) url.searchParams.set('tier', tierKey)
      return url.toString()
    } catch {
      const glue = cancel.includes('?') ? '&' : '?'
      return `${cancel}${glue}status=cancel`
    }
  })()

  try {
    // Build line items prioritizing the tier's own price
    // 1) If tier has a Stripe price, use it.
    // 2) Else use inline price_data with the tier amount (associate to product if provided).
    // 3) Only if tier has no price and a product default price exists, fall back to product price.
    let lineItems: any[]
    if (chosen.stripe_price_id) {
      lineItems = [{ price: chosen.stripe_price_id, quantity: 1 }]
    } else if (chosen.price && chosen.price > 0) {
      lineItems = [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(chosen.price * 100),
          recurring: { interval: 'month' },
          ...(productId ? { product: productId } : { product_data: { name: `${chosen.name}` } }),
        },
        quantity: 1,
      }]
    } else if (productId) {
      // Fallback to product default/first price
      let priceId: string | null = null
      try {
        const product = await stripe.products.retrieve(productId as string, { expand: ['default_price'] })
        // @ts-ignore default_price may be object
        priceId = (product.default_price && (typeof product.default_price === 'string' ? product.default_price : product.default_price?.id)) || null
      } catch {}
      if (!priceId) {
        try {
          const prices = await stripe.prices.list({ product: productId as string, active: true, limit: 1 })
          priceId = prices.data?.[0]?.id || null
        } catch {}
      }
      if (priceId) {
        lineItems = [{ price: priceId, quantity: 1 }]
      } else {
        throw new Error('No price available for product')
      }
    } else {
      // Should not happen due to earlier chosen fallback, but guard anyway
      lineItems = [{
        price_data: { currency: 'usd', unit_amount: 1000, recurring: { interval: 'month' }, product_data: { name: 'Subscription' } },
        quantity: 1,
      }]
    }

    let existingCustomerId: string | null = null

    const meta = {
      trainer_id: trainerId ?? '',
      tier_key: chosen.key,
      user_id: userId ?? '',
      connect_account_id: connectAccountId ?? '',
    }

    const baseParams: any = {
      mode: 'subscription',
      allow_promotion_codes: true,
      metadata: meta,
      subscription_data: { metadata: meta },
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
    }

    if (connectAccountId) {
      baseParams.subscription_data = {
        ...baseParams.subscription_data,
        transfer_data: { destination: connectAccountId },
      }
    }

    // If already subscribed, redirect to portal instead of creating a new subscription
    if (userId && trainerId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
        if (supabaseUrl && serviceKey) {
          const admin = require('@supabase/supabase-js').createClient(supabaseUrl, serviceKey)
          const { data: cust } = await admin
            .from('stripe_customers')
            .select('customer_id')
            .eq('user_id', userId)
            .eq('trainer', trainerId)
            .limit(1)
          existingCustomerId = (cust?.[0]?.customer_id as string) || null
          /*if (existingCustomerId) {
            baseParams.customer = existingCustomerId
            const { data: subs } = await admin
              .from('stripe_subscriptions')
              .select('status')
              .eq('customer_id', existingCustomerId)
              .eq('trainer', trainerId)
              .in('status', ['active','trialing','past_due','unpaid','incomplete'])
              .limit(1)
            if (Array.isArray(subs) && subs.length) {
              // Has an active-ish subscription: redirect to billing portal
              const portal = await stripe.billingPortal.sessions.create({ customer: existingCustomerId, return_url: success })
              return NextResponse.redirect(portal.url, { status: 302 })
            }
          }
        }*/
      } catch {}
    }

    if (!baseParams.customer && userId && !trainerId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined
        if (supabaseUrl && serviceKey) {
          const admin = require('@supabase/supabase-js').createClient(supabaseUrl, serviceKey)
          const { data: cust } = await admin
            .from('stripe_customers')
            .select('customer_id')
            .eq('user_id', userId)
            .limit(1)
          const fallbackCustomer = (cust?.[0]?.customer_id as string) || null
          if (fallbackCustomer) baseParams.customer = fallbackCustomer
        }
      } catch {}
    }

    let session
    try {
      session = await stripe.checkout.sessions.create(baseParams)
    } catch (err: any) {
      // Stripe Connect is not used. Surface the original error.
      throw err
    }

    return NextResponse.redirect(session.url as string, { status: 303 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Stripe error' }, { status: 500 })
  }
}
