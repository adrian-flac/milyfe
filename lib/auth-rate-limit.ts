import { createHash } from "crypto";
import { authRateLimitPolicies, isRateLimitAttemptAllowed, isRateLimitWindowExpired, type AuthLimitScope } from "./auth-rate-limit-core";
import { prisma } from "./prisma";

function rateLimitKey(scope: AuthLimitScope, identifier: string) {
  const pepper = process.env.AUTH_SECRET ?? "milyfe-auth-rate-limit";
  return createHash("sha256").update(`${pepper}:${scope}:${identifier.trim().toLowerCase()}`).digest("hex");
}

export async function isAuthAttemptAllowed(scope: AuthLimitScope, identifier: string) {
  const policy = authRateLimitPolicies[scope];
  const key = rateLimitKey(scope, identifier);
  const now = new Date();
  const record = await prisma.authRateLimit.findUnique({ where: { key } });

  if (!record) return true;
  if (isRateLimitWindowExpired(record, policy, now)) {
    await prisma.authRateLimit.update({ where: { key }, data: { attempts: 0, windowStartedAt: now } });
    return true;
  }
  return isRateLimitAttemptAllowed(record, policy, now);
}

export async function recordAuthFailure(scope: AuthLimitScope, identifier: string) {
  const policy = authRateLimitPolicies[scope];
  const key = rateLimitKey(scope, identifier);
  const now = new Date();
  const windowStart = new Date(now.getTime() - policy.windowMs);

  await prisma.authRateLimit.updateMany({
    where: { key, windowStartedAt: { lte: windowStart } },
    data: { attempts: 0, windowStartedAt: now },
  });
  await prisma.authRateLimit.upsert({
    where: { key },
    create: { key, attempts: 1, windowStartedAt: now },
    update: { attempts: { increment: 1 } },
  });
}

export async function clearAuthFailures(scope: AuthLimitScope, identifier: string) {
  await prisma.authRateLimit.deleteMany({ where: { key: rateLimitKey(scope, identifier) } });
}
