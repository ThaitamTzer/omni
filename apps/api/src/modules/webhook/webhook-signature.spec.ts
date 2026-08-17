import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';

// Test the signature verification logic in isolation (same algorithm as WebhookService)
function verifySignature(appSecret: string, signature: string, rawBody: string): boolean {
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (signature.length !== expected.length) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

describe('Webhook signature verification', () => {
  const secret = 'app_secret_test';
  const body = JSON.stringify({ object: 'page', entry: [] });

  it('accepts a valid signature', () => {
    const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    expect(verifySignature(secret, sig, body)).toBe(true);
  });

  it('rejects a wrong signature', () => {
    const sig = 'sha256=' + createHmac('sha256', 'other_secret').update(body).digest('hex');
    expect(verifySignature(secret, sig, body)).toBe(false);
  });

  it('rejects tampered body', () => {
    const sig = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
    expect(verifySignature(secret, sig, body + 'x')).toBe(false);
  });

  it('rejects wrong length signatures', () => {
    expect(verifySignature(secret, 'sha256:short', body)).toBe(false);
  });
});
