import { NextRequest, NextResponse } from 'next/server'
import { getStripe, getOrigin } from '@/utils/stripe'

export async function GET(req: NextRequest) {
  const stripe = getStripe()
  const origin = getOrigin(req.headers as unknown as Headers)

  // If you already have a connected account id per trainer, pass it as `account_id`.
  const url = new URL(req.url)
  const accountId = url.searchParams.get('account_id') || process.env.STRIPE_CONNECT_ACCOUNT_ID

  if (!stripe || !accountId) {
    // Fallback: send to Connect dashboard registration
    return NextResponse.redirect('https://dashboard.stripe.com/connect', { status: 302 })
  }

  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/payments?connect=refresh`,
      return_url: `${origin}/payments?connect=return`,
      type: 'account_onboarding',
    })
    return NextResponse.redirect(link.url, { status: 302 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unable to create onboarding link' }, { status: 500 })
  }
}

