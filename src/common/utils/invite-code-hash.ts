import { createHmac } from 'crypto';

function getInviteCodePepper(): string {
  const pepper = process.env.INVITE_CODE_PEPPER;
  
  if (!pepper) {
    throw new Error(
      '🔒 SECURITY ERROR: INVITE_CODE_PEPPER must be set in environment variables. ' +
      'This is required for secure invitation code hashing. ' +
      'Add it to your .env file or Railway variables.'
    );
  }
  
  return pepper;
}

export function hashInviteCode(rawCode: string): string {
  const normalized = rawCode.trim().toUpperCase();
  const pepper = getInviteCodePepper();
  
  return createHmac('sha256', pepper)
    .update(normalized)
    .digest('hex');
}
