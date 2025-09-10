import test from 'node:test';
import assert from 'node:assert/strict';
import { getStripe, getOrigin } from '../stripe';

test('getStripe returns null when no key is set', () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  assert.equal(getStripe(), null);
  if (prev) process.env.STRIPE_SECRET_KEY = prev;
});

test('getStripe creates a client when key is provided', () => {
  const prev = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  const client = getStripe();
  assert.ok(client);
  process.env.STRIPE_SECRET_KEY = prev;
});

test('getOrigin constructs URL from headers', () => {
  const headers = new Headers([
    ['host', 'example.com'],
    ['x-forwarded-proto', 'http']
  ]);
  assert.equal(getOrigin(headers), 'http://example.com');
});
