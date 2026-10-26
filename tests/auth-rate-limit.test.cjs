const test = require("node:test");
const assert = require("node:assert/strict");
const { authRateLimitPolicies, isRateLimitAttemptAllowed } = require("../.test-build/auth-rate-limit-core.js");

test("bloquea el sexto fallo y permite de nuevo al vencer la ventana", () => {
  const policy = authRateLimitPolicies.login;
  const startedAt = new Date("2026-10-25T00:00:00.000Z");
  const now = new Date("2026-10-25T00:05:00.000Z");

  assert.equal(isRateLimitAttemptAllowed(null, policy, now), true);
  for (let attempts = 1; attempts <= policy.maxAttempts; attempts += 1) {
    assert.equal(isRateLimitAttemptAllowed({ attempts: attempts - 1, windowStartedAt: startedAt }, policy, now), true);
  }
  assert.equal(isRateLimitAttemptAllowed({ attempts: policy.maxAttempts, windowStartedAt: startedAt }, policy, now), false);
  assert.equal(isRateLimitAttemptAllowed({ attempts: policy.maxAttempts, windowStartedAt: startedAt }, policy, new Date("2026-10-25T00:16:00.000Z")), true);
});
