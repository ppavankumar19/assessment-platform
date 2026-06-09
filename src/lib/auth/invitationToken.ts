import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export function generateInvitationToken(roundId: string, email: string): string {
  const nonce = randomBytes(16).toString('hex');
  const payload = `${roundId}:${email}:${nonce}`;
  const hmac = createHmac('sha256', process.env.NEXTAUTH_SECRET || 'dev-secret')
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function verifyInvitationToken(token: string, roundId: string, email: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 4) return false;
    const [tRound, tEmail, tNonce] = parts;
    const tHmac = parts.slice(3).join(':');
    if (tRound !== roundId || tEmail !== email) return false;
    const expected = createHmac('sha256', process.env.NEXTAUTH_SECRET || 'dev-secret')
      .update(`${tRound}:${tEmail}:${tNonce}`)
      .digest('hex');
    return timingSafeEqual(Buffer.from(expected), Buffer.from(tHmac));
  } catch {
    return false;
  }
}
