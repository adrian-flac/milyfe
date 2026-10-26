import { timingSafeEqual } from "crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const LEGACY_EMAIL = "local@milyfe.app";

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
    if (origin && origin !== new URL(request.url).origin) throw new Error("Origen no permitido.");

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
    const { email: rawEmail, password, name, bootstrapToken } = body as Record<string, unknown>;
    if (typeof rawEmail !== "string" || typeof password !== "string") throw new Error("Correo y contraseña son obligatorios.");

    const email = normalizeEmail(rawEmail);
    if (!validEmail(email)) throw new Error("Escribe un correo válido.");
    if (password.length < 12 || password.length > 128) throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
    if (name !== undefined && (typeof name !== "string" || name.trim().length > 80)) throw new Error("El nombre no puede superar 80 caracteres.");

    const ownerEmail = process.env.APP_OWNER_EMAIL ? normalizeEmail(process.env.APP_OWNER_EMAIL) : null;
    const configuredBootstrapToken = process.env.BOOTSTRAP_TOKEN;
    const isOwnerBootstrap = Boolean(
      ownerEmail && configuredBootstrapToken && email === ownerEmail && typeof bootstrapToken === "string" && safeEquals(bootstrapToken, configuredBootstrapToken),
    );
    const passwordHash = await hash(password, 12);
    const displayName = typeof name === "string" && name.trim() ? name.trim() : null;

    if (isOwnerBootstrap) {
      const existingOwner = await prisma.user.findUnique({ where: { email } });
      if (existingOwner?.passwordHash) throw new Error("Esta cuenta ya está configurada. Inicia sesión.");

      const legacyUser = await prisma.user.findUnique({ where: { email: LEGACY_EMAIL } });
      if (legacyUser?.passwordHash) throw new Error("El espacio local ya fue reclamado. Inicia sesión con tu cuenta.");
      if (legacyUser) {
        if (existingOwner && existingOwner.id !== legacyUser.id) throw new Error("Ya existe una cuenta sin activar con este correo. Usa otro correo o contacta al administrador.");
        await prisma.user.update({ where: { id: legacyUser.id }, data: { email, name: displayName, passwordHash } });
        return NextResponse.json({ ok: true, claimedWorkspace: true });
      }
      if (existingOwner) {
        await prisma.user.update({ where: { id: existingOwner.id }, data: { name: displayName, passwordHash } });
        return NextResponse.json({ ok: true, claimedWorkspace: false });
      }
      await prisma.user.create({ data: { email, name: displayName, passwordHash } });
      return NextResponse.json({ ok: true, claimedWorkspace: false }, { status: 201 });
    }

    if (process.env.ALLOW_REGISTRATION !== "true") throw new Error("El registro no está habilitado. Configura la activación inicial o contacta al administrador.");
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new Error("Ya existe una cuenta con este correo. Inicia sesión.");

    await prisma.user.create({ data: { email, name: displayName, passwordHash } });
    return NextResponse.json({ ok: true, claimedWorkspace: false }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
    const status = message.includes("no está habilitado") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
