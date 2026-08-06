import { nanoid } from 'nanoid';

interface OTPStore {
  [key: string]: {
    code: string;
    expiresAt: number;
    attempts: number;
  };
}

const otpStore: OTPStore = {};
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function storeOTP(identifier: string, code: string): void {
  console.log('[OTP] Storing OTP for', identifier);
  otpStore[identifier] = {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
  };
}

export function verifyOTP(identifier: string, code: string): boolean {
  const stored = otpStore[identifier];
  
  if (!stored) {
    console.log('[OTP] No OTP found for', identifier);
    return false;
  }

  if (Date.now() > stored.expiresAt) {
    console.log('[OTP] OTP expired for', identifier);
    delete otpStore[identifier];
    return false;
  }

  if (stored.attempts >= MAX_ATTEMPTS) {
    console.log('[OTP] Max attempts reached for', identifier);
    delete otpStore[identifier];
    return false;
  }

  stored.attempts++;

  if (stored.code === code) {
    console.log('[OTP] OTP verified for', identifier);
    delete otpStore[identifier];
    return true;
  }

  console.log('[OTP] Invalid OTP for', identifier);
  return false;
}

export function clearOTP(identifier: string): void {
  delete otpStore[identifier];
}

export function generateResetToken(): string {
  return nanoid(32);
}

interface ResetTokenStore {
  [token: string]: {
    userId: string;
    expiresAt: number;
  };
}

const resetTokenStore: ResetTokenStore = {};
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

export function storeResetToken(userId: string): string {
  const token = generateResetToken();
  console.log('[Reset] Storing reset token for user', userId);
  resetTokenStore[token] = {
    userId,
    expiresAt: Date.now() + RESET_TOKEN_EXPIRY_MS,
  };
  return token;
}

export function verifyResetToken(token: string): string | null {
  const stored = resetTokenStore[token];
  
  if (!stored) {
    console.log('[Reset] No reset token found');
    return null;
  }

  if (Date.now() > stored.expiresAt) {
    console.log('[Reset] Reset token expired');
    delete resetTokenStore[token];
    return null;
  }

  console.log('[Reset] Reset token verified');
  const userId = stored.userId;
  delete resetTokenStore[token];
  return userId;
}
