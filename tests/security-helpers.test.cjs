const test = require("node:test");
const assert = require("node:assert/strict");
const { getPasswordPolicyError } = require("../.test-build/password-policy.js");
const { getMutationRequestError } = require("../.test-build/request-security.js");

test("la política acepta contraseñas robustas y bloquea las débiles o ligadas al correo", () => {
  assert.equal(getPasswordPolicyError("Mi frase segura 2026!", "adrian@example.com"), null);
  assert.match(getPasswordPolicyError("aaaaaaaaaaaa", "adrian@example.com"), /combina/i);
  assert.match(getPasswordPolicyError("Adrian!2026pass", "adrian@example.com"), /correo/i);
});

test("las mutaciones solo aceptan el origen propio y JSON acotado", () => {
  const validRequest = new Request("https://milyfe.example/api/actions", {
    method: "POST",
    headers: { origin: "https://milyfe.example", "content-type": "application/json", "content-length": "18" },
  });
  assert.equal(getMutationRequestError(validRequest), null);

  const foreignOrigin = new Request("https://milyfe.example/api/actions", {
    method: "POST",
    headers: { origin: "https://other.example", "content-type": "application/json" },
  });
  assert.equal(getMutationRequestError(foreignOrigin)?.status, 403);

  const nonJson = new Request("https://milyfe.example/api/actions", {
    method: "POST",
    headers: { origin: "https://milyfe.example", "content-type": "text/plain" },
  });
  assert.equal(getMutationRequestError(nonJson)?.status, 415);

  const tooLarge = new Request("https://milyfe.example/api/actions", {
    method: "PATCH",
    headers: { origin: "https://milyfe.example", "content-type": "application/json", "content-length": "32769" },
  });
  assert.equal(getMutationRequestError(tooLarge)?.status, 413);
});
