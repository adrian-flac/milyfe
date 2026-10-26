import { timingSafeEqual } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { clearAuthFailures, isAuthAttemptAllowed, recordAuthFailure } from "../../../lib/auth-rate-limit";
import { getPasswordPolicyError } from "../../../lib/password-policy";
import { prisma } from "../../../lib/prisma";

const LEGACY_EMAIL = "local@milyfe.app";

class RegistrationInputError extends Error {}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeEquals(value: string, expected: string) {
  const actual = Buffer.from(value);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) throw new RegistrationInputError("Origen no permitido.");

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new RegistrationInputError("Solicitud inválida.");
    const { email: rawEmail, password, name, bootstrapToken } = body as Record<string, unknown>;
    if (typeof rawEmail !== "string" || typeof password !== "string") throw new RegistrationInputError("Correo y contraseña son obligatorios.");

    const email = normalizeEmail(rawEmail);
    if (!validEmail(email)) throw new RegistrationInputError("Escribe un correo válido.");
    const passwordPolicyError = getPasswordPolicyError(password, email);
    if (passwordPolicyError) throw new RegistrationInputError(passwordPolicyError);
    if (name !== undefined && (typeof name !== "string" || name.trim().length > 80)) throw new RegistrationInputError("El nombre no puede superar 80 caracteres.");

    const ownerEmail = process.env.APP_OWNER_EMAIL ? normalizeEmail(process.env.APP_OWNER_EMAIL) : null;
    const configuredBootstrapToken = process.env.BOOTSTRAP_TOKEN;
    const registrationEnabled = process.env.ALLOW_REGISTRATION === "true";
    const canAttemptBootstrap = Boolean(ownerEmail && configuredBootstrapToken && email === ownerEmail);

    if (!registrationEnabled && !canAttemptBootstrap) {
      throw new RegistrationInputError("El registro no está habilitado. Configura la activación inicial o contacta al administrador.");
    }
    if (!(await isAuthAttemptAllowed("registration", email))) {
      return NextResponse.json({ error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." }, { status: 429, headers: { "Retry-After": "900" } });
    }

    const isOwnerBootstrap = Boolean(
      ownerEmail && configuredBootstrapToken && email === ownerEmail && typeof bootstrapToken === "string" && safeEquals(bootstrapToken, configuredBootstrapToken),
    );
    const displayName = typeof name === "string" && name.trim() ? name.trim() : null;

    if (isOwnerBootstrap) {
      const existingOwner = await prisma.user.findUnique({ where: { email } });
      if (existingOwner?.passwordHash) {
        await recordAuthFailure("registration", email);
        throw new RegistrationInputError("Esta cuenta ya está configurada. Inicia sesión.");
      }

      const legacyUser = await prisma.user.findUnique({ where: { email: LEGACY_EMAIL } });
      if (legacyUser?.passwordHash) {
        await recordAuthFailure("registration", email);
        throw new RegistrationInputError("El espacio local ya fue reclamado. Inicia sesión con tu cuenta.");
      }
      if (legacyUser) {
        if (existingOwner && existingOwner.id !== legacyUser.id) {
          await recordAuthFailure("registration", email);
          throw new RegistrationInputError("Ya existe una cuenta sin activar con este correo. Usa otro correo o contacta al administrador.");
        }
        const passwordHash = await hash(password, 12);
        await prisma.user.update({ where: { id: legacyUser.id }, data: { email, name: displayName, passwordHash } });
        await clearAuthFailures("registration", email);
        return NextResponse.json({ ok: true, claimedWorkspace: true });
      }
      if (existingOwner) {
        const passwordHash = await hash(password, 12);
        await prisma.user.update({ where: { id: existingOwner.id }, data: { name: displayName, passwordHash } });
        await clearAuthFailures("registration", email);
        return NextResponse.json({ ok: true, claimedWorkspace: false });
      }
      const passwordHash = await hash(password, 12);
      await prisma.user.create({ data: { email, name: displayName, passwordHash } });
      await clearAuthFailures("registration", email);
      return NextResponse.json({ ok: true, claimedWorkspace: false }, { status: 201 });
    }

    if (!registrationEnabled) {
      await recordAuthFailure("registration", email);
      throw new RegistrationInputError("El registro no está habilitado. Configura la activación inicial o contacta al administrador.");
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await recordAuthFailure("registration", email);
      throw new RegistrationInputError("Ya existe una cuenta con este correo. Inicia sesión.");
    }

    const passwordHash = await hash(password, 12);
    await prisma.user.create({ data: { email, name: displayName, passwordHash } });
    await clearAuthFailures("registration", email);
    return NextResponse.json({ ok: true, claimedWorkspace: false }, { status: 201 });
  } catch (error) {
    if (error instanceof RegistrationInputError) {
      const status = error.message.includes("no está habilitado") ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("registration_failed");
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
