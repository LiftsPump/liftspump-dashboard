// Lightweight helper to obtain a Stripe client at runtime without
// causing TypeScript resolution errors if the SDK isn't installed yet.
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY as string | undefined;
  if (!key) return null;
  try {
    // Use require to avoid TS module resolution at build-time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('stripe');
    const Stripe = mod?.default ?? mod;
    const stripe = new Stripe(key, { apiVersion: '2024-06-20' } as any);
    return stripe as any;
  } catch (e) {
    return null;
  }
}

export function getOrigin(headers: Headers) {
  const forwardedHost = headers.get('x-forwarded-host');
  const host = forwardedHost || headers.get('host');
  const proto = headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

