import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { clearAuthFailures, isAuthAttemptAllowed, recordAuthFailure } from "../../../../lib/auth-rate-limit";
import { AuthenticationError, getCurrentUser } from "../../../../lib/current-user";
import { getPasswordPolicyError } from "../../../../lib/password-policy";
import { prisma } from "../../../../lib/prisma";

const retryAfterSeconds = 15 * 60;

class PasswordChangeInputError extends Error {}

export async function PATCH(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new PasswordChangeInputError("Solicitud inválida.");

    const { currentPassword, newPassword } = body as Record<string, unknown>;
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      throw new PasswordChangeInputError("Escribe tu contraseña actual y la nueva contraseña.");
    }
    if (!currentPassword || currentPassword.length > 128) {
      throw new PasswordChangeInputError("La contraseña actual no es válida.");
    }

    const user = await getCurrentUser();
    if (!user.passwordHash) throw new AuthenticationError();

    if (!(await isAuthAttemptAllowed("passwordChange", user.email))) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
      );
    }

    if (!(await compare(currentPassword, user.passwordHash))) {
      await recordAuthFailure("passwordChange", user.email);
      return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
    }

    const passwordPolicyError = getPasswordPolicyError(newPassword, user.email);
    if (passwordPolicyError) throw new PasswordChangeInputError(passwordPolicyError);
    if (await compare(newPassword, user.passwordHash)) {
      throw new PasswordChangeInputError("La nueva contraseña debe ser diferente de la actual.");
    }

    const result = await prisma.user.updateMany({
      where: { id: user.id, sessionVersion: user.sessionVersion },
      data: { passwordHash: await hash(newPassword, 12), sessionVersion: { increment: 1 } },
    });
    if (!result.count) {
      return NextResponse.json({ error: "Tu sesión cambió. Inicia sesión nuevamente." }, { status: 401 });
    }

    await clearAuthFailures("passwordChange", user.email);
    // Incrementing the session version invalidates the current and every other JWT.
    return NextResponse.json({ ok: true, signedOut: true });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Inicia sesión para cambiar tu contraseña." }, { status: 401 });
    }
    if (error instanceof PasswordChangeInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("password_change_failed");
    return NextResponse.json({ error: "No se pudo cambiar la contraseña." }, { status: 500 });
  }
}
