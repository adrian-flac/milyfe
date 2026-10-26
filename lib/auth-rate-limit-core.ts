export type AuthLimitScope = "login" | "registration" | "passwordChange";

export type AuthRateLimitRecord = {
  attempts: number;
  windowStartedAt: Date;
};

export const authRateLimitPolicies: Record<AuthLimitScope, { maxAttempts: number; windowMs: number }> = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  registration: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  passwordChange: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
};

export function isRateLimitWindowExpired(record: AuthRateLimitRecord, policy: { windowMs: number }, now: Date) {
  return record.windowStartedAt.getTime() <= now.getTime() - policy.windowMs;
}

export function isRateLimitAttemptAllowed(record: AuthRateLimitRecord | null, policy: { maxAttempts: number; windowMs: number }, now: Date) {
  return !record || isRateLimitWindowExpired(record, policy, now) || record.attempts < policy.maxAttempts;
}
