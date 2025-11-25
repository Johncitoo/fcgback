import { createHmac } from 'crypto';

const INVITE_CODE_PEPPER = process.env.INVITE_CODE_PEPPER || 'change-me';

export function hashInviteCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase();
  return createHmac('sha256', INVITE_CODE_PEPPER)
    .update(normalized)
    .digest('hex');
}
