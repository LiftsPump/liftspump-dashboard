import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getOrigin } from '@/utils/stripe'
import { createClient as createSupabaseServer } from '@/utils/supabase/server'

export async function GET(req: NextRequest) {
  const stripe = getStripe()
  const url = new URL(req.url)
  const origin = getOrigin(req.headers as unknown as Headers)

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

  if (!customerId) {
    try {
      const supabase = createSupabaseServer()
      let resolvedUserId = userIdParam
      if (!resolvedUserId && emailParam) {
        const { data } = await supabase
          .from('profile')
          .select('creator_id')
          .eq('email', emailParam)
          .limit(1)
        resolvedUserId = (data?.[0]?.creator_id as string) || undefined
      }
      if (!resolvedUserId) {
        const { data: auth } = await supabase.auth.getUser()
        resolvedUserId = auth.user?.id || undefined
      }
      if (resolvedUserId) {
        const { data: cust } = await supabase
          .from('stripe_customers')
          .select('customer_id')
          .eq('user_id', resolvedUserId)
          .limit(1)
        customerId = (cust?.[0]?.customer_id as string) || undefined
      }

      // Trainer convenience: if still not found, and the requester is a trainer,
      // open the most recent customer for this trainer to inspect portal.
      if (!customerId) {
        // Resolve trainer_id for the requester
        const { data: trainerRows } = await supabase
          .from('trainer')
          .select('trainer_id')
          .eq('creator_id', resolvedUserId)
          .limit(1)
        const tId = (trainerRows?.[0]?.trainer_id as string) || undefined
        if (tId) {
          const { data: anyCust } = await supabase
            .from('stripe_customers')
            .select('customer_id')
            .eq('trainer', tId)
            .order('created_at', { ascending: false })
            .limit(1)
          customerId = (anyCust?.[0]?.customer_id as string) || undefined
        }
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
